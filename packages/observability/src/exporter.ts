import { containsUnsafeAuditMaterial, redactAuditString, sanitizeAuditMetadata } from "./sanitizer.ts";
import type {
  AuditRedactionClassName,
  AuditRetentionClassName,
  ObservabilityExportEnvelope,
  ObservabilityExportEnvelopeKind,
  ObservabilityExporterConfig,
  ObservabilityExporterKind,
  ObservabilityExporterStatus,
  ObservabilityExportNoSecretStatus,
  ObservabilityExportReadinessSummary,
  ObservabilityExportSafetyCheck,
  ObservabilityExportSafetyCheckKind,
  ObservabilityExportSafetyCheckStatus,
  ObservabilityExportSafetySeverity
} from "./types.ts";

export type ObservabilityExportEnvelopeInput = {
  id?: string;
  envelopeKind?: ObservabilityExportEnvelopeKind;
  source?: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  resourceScope?: Record<string, unknown>;
  redactionClass?: AuditRedactionClassName;
  retentionClass?: AuditRetentionClassName;
  payloadSummary?: string;
  rawPayloadIncluded?: boolean;
  rawPayload?: unknown;
  metadata?: Record<string, unknown>;
};

export type ObservabilityExportResult = {
  id: string;
  exporterKind: ObservabilityExporterKind;
  status: "skipped" | "recorded_mock_metadata" | "future_not_configured" | "blocked";
  envelopeId?: string;
  envelopeKind?: ObservabilityExportEnvelopeKind;
  externalCallAttempted: false;
  rawPayloadExported: false;
  secretExported: false;
  metadata: Record<string, unknown>;
};

export type ObservabilityMockExportRecord = {
  id: string;
  envelopeId: string;
  envelopeKind: ObservabilityExportEnvelopeKind;
  source: string;
  retentionClass: AuditRetentionClassName;
  redactionClass: AuditRedactionClassName;
  payloadSummary: string;
  rawPayloadIncluded: false;
  secretFieldsRedacted: true;
  recordedAt: Date;
  metadata: Record<string, unknown>;
};

export interface ObservabilityExporter {
  getExporterKind(): ObservabilityExporterKind;
  getStatus(): ObservabilityExporterStatus;
  validateConfig(): ObservabilityExportSafetyCheck[];
  exportEnvelope(envelope: ObservabilityExportEnvelope): ObservabilityExportResult;
  getReadiness(): ObservabilityExportReadinessSummary;
}

const futureExporterKinds: ObservabilityExporterKind[] = [
  "opentelemetry_future",
  "datadog_future",
  "grafana_cloud_future",
  "cloudwatch_future",
  "opensearch_future",
  "splunk_future",
  "siem_future",
  "s3_future",
  "custom_future"
];

const safetyCheckOrder: ObservabilityExportSafetyCheckKind[] = [
  "exporter_disabled_by_default",
  "no_raw_payload",
  "no_secret_fields",
  "no_env_values",
  "redaction_applied",
  "tenant_scope_present",
  "retention_class_present",
  "endpoint_not_exposed",
  "auth_not_exposed"
];

const defaultSeverities: Record<ObservabilityExportSafetyCheckKind, ObservabilityExportSafetySeverity> = {
  exporter_disabled_by_default: "critical",
  no_raw_payload: "critical",
  no_secret_fields: "critical",
  no_env_values: "critical",
  redaction_applied: "high",
  tenant_scope_present: "medium",
  retention_class_present: "high",
  endpoint_not_exposed: "high",
  auth_not_exposed: "high"
};

const defaultRemediations: Record<ObservabilityExportSafetyCheckKind, string> = {
  exporter_disabled_by_default: "Keep external export disabled until production gates and allowlists are explicitly reviewed.",
  no_raw_payload: "Export only payload summaries and metadata; never include raw prompts, responses, webhook payloads, or tool data.",
  no_secret_fields: "Redact or drop secret-like fields before any export envelope is accepted.",
  no_env_values: "Never copy environment variable values into export metadata or payload summaries.",
  redaction_applied: "Attach an explicit redaction class and preserve sanitized metadata only.",
  tenant_scope_present: "Attach tenant, team, project, or resource-scope metadata before future production export.",
  retention_class_present: "Attach a retention class before any future export decision.",
  endpoint_not_exposed: "Expose endpoint configuration status only; never return endpoint values.",
  auth_not_exposed: "Expose auth configuration status only; never return credentials, tokens, cookies, or auth headers."
};

const sensitiveFieldPattern = /(?:^|_|-|\b)(token|secret|password|authorization|api[_-]?key|raw[_-]?payload|payload[_-]?raw|prompt|provider[_-]?response|tool[_-]?input|tool[_-]?output|cookie|session[_-]?id|session[_-]?secret|jwt[_-]?secret|credential|private[_-]?key|database[_-]?url|vault|webhook[_-]?secret)(?:$|_|-|\b)/i;
const endpointFieldPattern = /(?:^|_|-|\b)(endpoint|endpoint[_-]?url|exporter[_-]?endpoint|collector[_-]?url|url|host)(?:$|_|-|\b)/i;
const authFieldPattern = /(?:^|_|-|\b)(auth|authorization|credential|token|api[_-]?key|cookie|session)(?:$|_|-|\b)/i;
const envValuePattern = /\b[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|DATABASE_URL|VAULT)[A-Z0-9_]*\s*=\s*(?!\[redacted\])[^\s"',}]+/i;
const secretValuePattern = /\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|Bearer\s+(?!\[redacted\])[A-Za-z0-9._~+/=-]+|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|postgres:\/\/[^\s"',}]+)\b/i;

function stableSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "unknown";
}

function exporterConfig(
  exporterKind: ObservabilityExporterKind,
  status: ObservabilityExporterStatus,
  metadata: Record<string, unknown> = {}
): ObservabilityExporterConfig {
  return {
    id: `observability_exporter_${stableSegment(exporterKind)}`,
    exporterKind,
    status,
    exportLogsEnabled: false,
    exportMetricsEnabled: false,
    exportTracesEnabled: false,
    exportAuditEnabled: false,
    externalCallsEnabled: false,
    endpointConfigured: false,
    authConfigured: false,
    tenantScopeRequired: true,
    redactionRequired: true,
    metadata: sanitizeAuditMetadata({
      ...metadata,
      externalExporterRuntime: "disabled_or_mock_metadata_only",
      endpointValueExposed: false,
      authValueExposed: false,
      rawPayloadExportAllowed: false,
      secretExportAllowed: false,
      productionReady: false
    })
  };
}

export function createDefaultObservabilityExporterConfigs(): ObservabilityExporterConfig[] {
  return [
    exporterConfig("disabled", "disabled", { defaultRuntime: true }),
    exporterConfig("mock", "not_configured", { testsOnly: true, externalCalls: false }),
    ...futureExporterKinds.map((kind) => exporterConfig(kind, "future", { futureBackend: true, implementationStatus: "not_implemented" }))
  ];
}

function redactedString(value: unknown): string {
  return redactAuditString(typeof value === "string" ? value : JSON.stringify(value ?? ""));
}

function sanitizeExportMetadata(input: Record<string, unknown> | undefined): Record<string, unknown> {
  const metadata = input ?? {};
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (endpointFieldPattern.test(key)) {
      output[key] = "[withheld-endpoint]";
      continue;
    }
    if (authFieldPattern.test(key) || sensitiveFieldPattern.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = sanitizeExportMetadata(value as Record<string, unknown>);
      continue;
    }
    output[key] = value;
  }
  return sanitizeAuditMetadata(output);
}

function safetyCheck(
  checkKind: ObservabilityExportSafetyCheckKind,
  status: ObservabilityExportSafetyCheckStatus,
  metadata: Record<string, unknown> = {},
  severity: ObservabilityExportSafetySeverity = defaultSeverities[checkKind],
  remediation = defaultRemediations[checkKind]
): ObservabilityExportSafetyCheck {
  return {
    id: `observability_export_check_${stableSegment(checkKind)}`,
    checkKind,
    status,
    severity,
    remediation,
    metadata: sanitizeAuditMetadata(metadata)
  };
}

function safeSummaryFromChecks(checks: ObservabilityExportSafetyCheck[]): ObservabilityExportReadinessSummary {
  return {
    exporterEnabled: false,
    externalCallsEnabled: false,
    configuredExporterCount: 0,
    futureExporterCount: futureExporterKinds.length,
    safetyCheckCount: checks.length,
    failedSafetyCheckCount: checks.filter((check) => check.status === "fail").length,
    rawPayloadExportAllowed: false,
    secretExportAllowed: false,
    metadata: sanitizeAuditMetadata({
      status: "v1_implemented_skeleton",
      productionObservabilityExportImplemented: false,
      externalExporterRuntime: "disabled",
      noExternalCalls: true,
      noRawPayloadExport: true,
      noSecretsOrEnvValues: true
    })
  };
}

function walkForFindings(value: unknown, path: string[] = []): {
  secretFields: string[];
  envValueFields: string[];
  endpointFields: string[];
  authFields: string[];
} {
  const findings = {
    secretFields: [] as string[],
    envValueFields: [] as string[],
    endpointFields: [] as string[],
    authFields: [] as string[]
  };
  const recordFinding = (key: string, target: keyof typeof findings): void => {
    findings[target].push([...path, key].join("."));
  };
  const isSafeSchemaFlag = (key: string, child: unknown): boolean =>
    (key === "rawPayloadIncluded" && child === false) ||
    (key === "secretFieldsRedacted" && child === true) ||
    (key === "rawPayloadExportAllowed" && child === false) ||
    (key === "secretExportAllowed" && child === false) ||
    (key === "endpointConfigured" && typeof child === "boolean") ||
    (key === "authConfigured" && typeof child === "boolean");
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const childText = typeof child === "string" ? child : JSON.stringify(child);
      if (!isSafeSchemaFlag(key, child) && sensitiveFieldPattern.test(key) && child !== "[redacted]" && child !== "[withheld-endpoint]") recordFinding(key, "secretFields");
      if (!isSafeSchemaFlag(key, child) && authFieldPattern.test(key) && child !== "[redacted]") recordFinding(key, "authFields");
      if (!isSafeSchemaFlag(key, child) && endpointFieldPattern.test(key) && child !== "[withheld-endpoint]") recordFinding(key, "endpointFields");
      if (typeof childText === "string" && envValuePattern.test(childText)) recordFinding(key, "envValueFields");
      if (typeof childText === "string" && secretValuePattern.test(childText)) recordFinding(key, "secretFields");
      const nested = walkForFindings(child, [...path, key]);
      findings.secretFields.push(...nested.secretFields);
      findings.envValueFields.push(...nested.envValueFields);
      findings.endpointFields.push(...nested.endpointFields);
      findings.authFields.push(...nested.authFields);
    }
    return findings;
  }
  if (typeof value === "string") {
    if (envValuePattern.test(value)) findings.envValueFields.push(path.join(".") || "value");
    if (secretValuePattern.test(value)) findings.secretFields.push(path.join(".") || "value");
  }
  return findings;
}

function hasTenantScope(envelope?: ObservabilityExportEnvelope): boolean {
  if (!envelope) return true;
  return Boolean(envelope.tenantId || envelope.teamId || envelope.projectId || envelope.resourceScope);
}

export class ExternalObservabilityExportReadinessService {
  private readonly configs: ObservabilityExporterConfig[];

  constructor(input: { exporterConfigs?: ObservabilityExporterConfig[] } = {}) {
    this.configs = structuredClone(input.exporterConfigs ?? createDefaultObservabilityExporterConfigs());
  }

  getExporterConfigs(): ObservabilityExporterConfig[] {
    return structuredClone(this.configs);
  }

  listFutureBackends(): ObservabilityExporterConfig[] {
    return this.getExporterConfigs().filter((config) => config.exporterKind.endsWith("_future"));
  }

  buildSafeExportEnvelope(input: ObservabilityExportEnvelopeInput = {}): ObservabilityExportEnvelope {
    const metadata = sanitizeExportMetadata({
      ...input.metadata,
      sourceContentAttempted: input.rawPayload !== undefined || input.rawPayloadIncluded === true,
      sourceContentDropped: input.rawPayload !== undefined || input.rawPayloadIncluded === true,
      envelopeBuiltBy: "ExternalObservabilityExportReadinessService",
      checkOnly: true
    });
    return {
      id: input.id ?? `observability_export_envelope_${stableSegment(input.source ?? "manual_check")}`,
      envelopeKind: input.envelopeKind ?? "readiness",
      source: redactAuditString(input.source ?? "observability_export_check"),
      tenantId: input.tenantId ? redactAuditString(input.tenantId) : undefined,
      teamId: input.teamId ? redactAuditString(input.teamId) : undefined,
      projectId: input.projectId ? redactAuditString(input.projectId) : undefined,
      resourceScope: input.resourceScope ? sanitizeAuditMetadata(input.resourceScope) : undefined,
      redactionClass: input.redactionClass ?? "internal_metadata",
      retentionClass: input.retentionClass ?? "operational",
      payloadSummary: redactedString(input.payloadSummary ?? "safe export envelope check only"),
      rawPayloadIncluded: false,
      secretFieldsRedacted: true,
      metadata
    };
  }

  validateEnvelope(envelope?: ObservabilityExportEnvelope): ObservabilityExportSafetyCheck[] {
    const findings = walkForFindings(envelope);
    const unsafeMaterial = envelope ? containsUnsafeAuditMaterial(envelope) : false;
    const rawPayloadIncluded = envelope ? envelope.rawPayloadIncluded !== false : false;
    const redactionPresent = envelope ? Boolean(envelope.redactionClass) && envelope.secretFieldsRedacted === true : true;
    const retentionPresent = envelope ? Boolean(envelope.retentionClass) : true;
    const tenantScopePresent = hasTenantScope(envelope);
    const unsafeSecretFields = unsafeMaterial || findings.secretFields.length > 0;

    return safetyCheckOrder.map((checkKind) => {
      if (checkKind === "exporter_disabled_by_default") {
        return safetyCheck(checkKind, this.configs.every((config) => config.externalCallsEnabled === false) ? "pass" : "fail", {
          externalCallsEnabled: false,
          exporterEnabled: false
        });
      }
      if (checkKind === "no_raw_payload") {
        return safetyCheck(checkKind, rawPayloadIncluded ? "fail" : "pass", {
          rawPayloadIncluded: envelope?.rawPayloadIncluded ?? false
        });
      }
      if (checkKind === "no_secret_fields") {
        return safetyCheck(checkKind, unsafeSecretFields ? "fail" : "pass", {
          secretFieldCount: findings.secretFields.length,
          unsafeMaterialDetected: unsafeMaterial,
          redactedOnly: !unsafeSecretFields
        });
      }
      if (checkKind === "no_env_values") {
        return safetyCheck(checkKind, findings.envValueFields.length > 0 ? "fail" : "pass", {
          envValueFieldCount: findings.envValueFields.length
        });
      }
      if (checkKind === "redaction_applied") {
        return safetyCheck(checkKind, redactionPresent ? "pass" : "fail", {
          redactionClass: envelope?.redactionClass,
          secretFieldsRedacted: envelope?.secretFieldsRedacted ?? true
        });
      }
      if (checkKind === "tenant_scope_present") {
        return safetyCheck(checkKind, tenantScopePresent ? "pass" : "warning", {
          tenantScopeRequired: true,
          tenantIdPresent: Boolean(envelope?.tenantId),
          teamIdPresent: Boolean(envelope?.teamId),
          projectIdPresent: Boolean(envelope?.projectId),
          resourceScopePresent: Boolean(envelope?.resourceScope)
        });
      }
      if (checkKind === "retention_class_present") {
        return safetyCheck(checkKind, retentionPresent ? "pass" : "fail", {
          retentionClass: envelope?.retentionClass
        });
      }
      if (checkKind === "endpoint_not_exposed") {
        return safetyCheck(checkKind, findings.endpointFields.length > 0 ? "fail" : "pass", {
          endpointValueExposed: findings.endpointFields.length > 0,
          endpointConfigured: false
        });
      }
      return safetyCheck(checkKind, findings.authFields.length > 0 ? "fail" : "pass", {
        authValueExposed: findings.authFields.length > 0,
        authConfigured: false
      });
    });
  }

  getSafetyChecks(): ObservabilityExportSafetyCheck[] {
    return this.validateEnvelope();
  }

  getSummary(checks = this.getSafetyChecks()): ObservabilityExportReadinessSummary {
    return {
      ...safeSummaryFromChecks(checks),
      configuredExporterCount: this.configs.filter((config) => config.status === "active_mock").length,
      futureExporterCount: this.listFutureBackends().length
    };
  }

  getNoSecretStatus(): ObservabilityExportNoSecretStatus {
    return {
      exporterEnabled: false,
      externalCallsEnabled: false,
      rawPayloadExportAllowed: false,
      secretExportAllowed: false,
      envValuesExposed: false,
      endpointValuesExposed: false,
      authValuesExposed: false,
      noSecretsExposed: true
    };
  }
}

export class DisabledObservabilityExporter implements ObservabilityExporter {
  private readonly service = new ExternalObservabilityExportReadinessService();

  getExporterKind(): ObservabilityExporterKind {
    return "disabled";
  }

  getStatus(): ObservabilityExporterStatus {
    return "disabled";
  }

  validateConfig(): ObservabilityExportSafetyCheck[] {
    return this.service.getSafetyChecks();
  }

  exportEnvelope(envelope: ObservabilityExportEnvelope): ObservabilityExportResult {
    return {
      id: `observability_export_result_disabled_${stableSegment(envelope.id)}`,
      exporterKind: "disabled",
      status: "skipped",
      envelopeId: envelope.id,
      envelopeKind: envelope.envelopeKind,
      externalCallAttempted: false,
      rawPayloadExported: false,
      secretExported: false,
      metadata: sanitizeAuditMetadata({
        reason: "external_export_disabled_by_default",
        envelopeAcceptedForExternalExport: false,
        checkOnly: true
      })
    };
  }

  getReadiness(): ObservabilityExportReadinessSummary {
    return this.service.getSummary();
  }
}

export class MockObservabilityExporter implements ObservabilityExporter {
  private readonly records: ObservabilityMockExportRecord[] = [];
  private readonly now: () => Date;
  private readonly service: ExternalObservabilityExportReadinessService;

  constructor(input: { now?: () => Date } = {}) {
    this.now = input.now ?? (() => new Date());
    this.service = new ExternalObservabilityExportReadinessService({
      exporterConfigs: [
        exporterConfig("disabled", "disabled", { defaultRuntime: true }),
        exporterConfig("mock", "active_mock", { testsOnly: true, externalCalls: false })
      ]
    });
  }

  getExporterKind(): ObservabilityExporterKind {
    return "mock";
  }

  getStatus(): ObservabilityExporterStatus {
    return "active_mock";
  }

  validateConfig(): ObservabilityExportSafetyCheck[] {
    return this.service.getSafetyChecks();
  }

  exportEnvelope(envelope: ObservabilityExportEnvelope): ObservabilityExportResult {
    const checks = this.service.validateEnvelope(envelope);
    if (checks.some((check) => check.status === "fail")) {
      return {
        id: `observability_export_result_mock_blocked_${stableSegment(envelope.id)}`,
        exporterKind: "mock",
        status: "blocked",
        envelopeId: envelope.id,
        envelopeKind: envelope.envelopeKind,
        externalCallAttempted: false,
        rawPayloadExported: false,
        secretExported: false,
        metadata: sanitizeAuditMetadata({
          failedSafetyCheckCount: checks.filter((check) => check.status === "fail").length,
          recorded: false
        })
      };
    }

    const record: ObservabilityMockExportRecord = {
      id: `observability_mock_export_record_${this.records.length + 1}`,
      envelopeId: envelope.id,
      envelopeKind: envelope.envelopeKind,
      source: envelope.source,
      retentionClass: envelope.retentionClass,
      redactionClass: envelope.redactionClass,
      payloadSummary: envelope.payloadSummary,
      rawPayloadIncluded: false,
      secretFieldsRedacted: true,
      recordedAt: this.now(),
      metadata: sanitizeAuditMetadata({
        envelopeMetadataKeys: Object.keys(envelope.metadata).sort(),
        externalCallAttempted: false,
        metadataOnly: true
      })
    };
    this.records.push(record);
    return {
      id: `observability_export_result_mock_${stableSegment(envelope.id)}`,
      exporterKind: "mock",
      status: "recorded_mock_metadata",
      envelopeId: envelope.id,
      envelopeKind: envelope.envelopeKind,
      externalCallAttempted: false,
      rawPayloadExported: false,
      secretExported: false,
      metadata: sanitizeAuditMetadata({
        recordId: record.id,
        recordedMetadataOnly: true,
        externalCallAttempted: false
      })
    };
  }

  getReadiness(): ObservabilityExportReadinessSummary {
    return this.service.getSummary();
  }

  listRecordedMetadata(): ObservabilityMockExportRecord[] {
    return structuredClone(this.records);
  }
}

export class FutureObservabilityExporter implements ObservabilityExporter {
  private readonly exporterKind: ObservabilityExporterKind;
  private readonly service = new ExternalObservabilityExportReadinessService();

  constructor(exporterKind: ObservabilityExporterKind) {
    this.exporterKind = exporterKind.endsWith("_future") ? exporterKind : "custom_future";
  }

  getExporterKind(): ObservabilityExporterKind {
    return this.exporterKind;
  }

  getStatus(): ObservabilityExporterStatus {
    return "future";
  }

  validateConfig(): ObservabilityExportSafetyCheck[] {
    return this.service.getSafetyChecks();
  }

  exportEnvelope(envelope: ObservabilityExportEnvelope): ObservabilityExportResult {
    return {
      id: `observability_export_result_future_${stableSegment(this.exporterKind)}_${stableSegment(envelope.id)}`,
      exporterKind: this.exporterKind,
      status: "future_not_configured",
      envelopeId: envelope.id,
      envelopeKind: envelope.envelopeKind,
      externalCallAttempted: false,
      rawPayloadExported: false,
      secretExported: false,
      metadata: sanitizeAuditMetadata({
        futureBackend: true,
        configured: false,
        externalCallsEnabled: false
      })
    };
  }

  getReadiness(): ObservabilityExportReadinessSummary {
    return this.service.getSummary();
  }
}

export function createExternalObservabilityExportReadinessService(): ExternalObservabilityExportReadinessService {
  return new ExternalObservabilityExportReadinessService();
}
