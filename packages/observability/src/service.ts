import {
  defaultAuditRedactionClasses,
  defaultAuditRetentionClasses,
  defaultAuditRetentionPolicies,
  defaultMetricDefinitions
} from "./catalog.ts";
import { containsUnsafeAuditMaterial, sanitizeAuditMetadata, redactAuditString } from "./sanitizer.ts";
import type {
  AuditCategory,
  AuditEventEnvelope,
  AuditOutcome,
  AuditQuery,
  AuditQueryResult,
  AuditRedactionClass,
  AuditRedactionClassName,
  AuditRetentionClass,
  AuditRetentionClassName,
  AuditRetentionPolicy,
  AuditSeverity,
  AuditSourceCoverage,
  AuditSummary,
  MetricDefinition,
  MetricPoint,
  MetricSnapshot,
  ObservabilityAuditSources,
  ObservabilityConfig,
  ObservabilityDashboardReadModel,
  TraceQuery,
  TraceSpan,
  TraceSpanStatus
} from "./types.ts";

const auditCategories: AuditCategory[] = [
  "auth",
  "policy",
  "credential",
  "git",
  "git_webhook",
  "llm",
  "mcp",
  "runner",
  "registry",
  "improvement",
  "local_agent",
  "security",
  "dashboard",
  "system"
];
const auditOutcomes: AuditOutcome[] = ["success", "denied", "blocked", "failed", "skipped", "unknown"];
const auditSeverities: AuditSeverity[] = ["debug", "info", "warning", "error", "critical"];

export type ObservabilityServiceInput = {
  sourceProvider?: () => ObservabilityAuditSources;
  now?: () => Date;
  maxQueryLimit?: number;
  retentionClasses?: AuditRetentionClass[];
  redactionClasses?: AuditRedactionClass[];
  retentionPolicies?: AuditRetentionPolicy[];
  metricDefinitions?: MetricDefinition[];
};

type SourceDefinition = {
  id: string;
  moduleName: string;
  auditSource: string;
  currentRepositoryStorage: string;
  normalized: "yes" | "partial" | "no";
  sourceModule: string;
  category: AuditCategory;
  key: keyof ObservabilityAuditSources;
  eventFilter?: (event: unknown) => boolean;
  sensitiveFields: string[];
  retentionClass: AuditRetentionClassName;
  redactionClass: AuditRedactionClassName;
  missingGaps: string[];
};

const sourceDefinitions: SourceDefinition[] = [
  {
    id: "source_core",
    moduleName: "Core workflow",
    auditSource: "AuditLog",
    currentRepositoryStorage: "InMemoryAichestraStore.auditLogs",
    normalized: "yes",
    sourceModule: "core",
    category: "system",
    key: "coreAuditLogs",
    sensitiveFields: ["metadata"],
    retentionClass: "operational",
    redactionClass: "internal_metadata",
    missingGaps: ["Generic store audit is still in-memory by default."]
  },
  {
    id: "source_auth",
    moduleName: "Auth/RBAC",
    auditSource: "AuthAuditEvent",
    currentRepositoryStorage: "InMemoryAuthRepository",
    normalized: "yes",
    sourceModule: "auth",
    category: "auth",
    key: "authAuditEvents",
    sensitiveFields: ["metadata"],
    retentionClass: "security",
    redactionClass: "sensitive_metadata",
    missingGaps: ["Production auth/session audit is future work."]
  },
  {
    id: "source_policy",
    moduleName: "Policy",
    auditSource: "PolicyDecisionAuditEntry",
    currentRepositoryStorage: "PolicyService in-memory audit repository",
    normalized: "yes",
    sourceModule: "policy",
    category: "policy",
    key: "policyAuditEntries",
    sensitiveFields: ["context", "metadata"],
    retentionClass: "security",
    redactionClass: "sensitive_metadata",
    missingGaps: ["No signed policy bundle or persistent production policy audit yet."]
  },
  {
    id: "source_credentials",
    moduleName: "SecretRef/Credentials",
    auditSource: "SecurityAuditEvent credential_*",
    currentRepositoryStorage: "SecurityControlService in-memory audit repository",
    normalized: "yes",
    sourceModule: "security_credentials",
    category: "credential",
    key: "securityAuditEvents",
    eventFilter: (event) => stringField(event, "eventType").startsWith("credential_"),
    sensitiveFields: ["secretRefId", "env values", "metadata"],
    retentionClass: "security",
    redactionClass: "secret_adjacent",
    missingGaps: ["Vault/cloud secret backend audit is future work."]
  },
  {
    id: "source_security",
    moduleName: "Secrets/Sandbox",
    auditSource: "SecurityAuditEvent",
    currentRepositoryStorage: "SecurityControlService in-memory audit repository",
    normalized: "yes",
    sourceModule: "security",
    category: "security",
    key: "securityAuditEvents",
    eventFilter: (event) => !stringField(event, "eventType").startsWith("credential_"),
    sensitiveFields: ["secretRefId", "sandbox metadata", "redaction previews"],
    retentionClass: "security",
    redactionClass: "secret_adjacent",
    missingGaps: ["No production sandbox or OS-level network audit backend yet."]
  },
  {
    id: "source_git",
    moduleName: "Git",
    auditSource: "git.* AuditLog",
    currentRepositoryStorage: "InMemoryAichestraStore.auditLogs",
    normalized: "yes",
    sourceModule: "git",
    category: "git",
    key: "gitAuditEvents",
    sensitiveFields: ["metadata", "provider credentials"],
    retentionClass: "operational",
    redactionClass: "sensitive_metadata",
    missingGaps: ["Production GitHub App audit/export remains future work."]
  },
  {
    id: "source_git_webhook",
    moduleName: "GitHub Webhook",
    auditSource: "GitWebhookAuditEvent",
    currentRepositoryStorage: "InMemoryAichestraStore.gitWebhookAuditEvents",
    normalized: "yes",
    sourceModule: "git_webhook",
    category: "git_webhook",
    key: "gitWebhookAuditEvents",
    sensitiveFields: ["webhook secret", "raw payload", "delivery metadata"],
    retentionClass: "security",
    redactionClass: "never_store_raw",
    missingGaps: ["Production replay/idempotency hardening and durable export are future work."]
  },
  {
    id: "source_llm",
    moduleName: "LLM Gateway",
    auditSource: "LLMAuditEvent",
    currentRepositoryStorage: "LLMGatewayService in-memory audit repository",
    normalized: "yes",
    sourceModule: "llm",
    category: "llm",
    key: "llmAuditEvents",
    sensitiveFields: ["prompt", "output", "provider credentials", "metadata"],
    retentionClass: "operational",
    redactionClass: "contains_user_content_redacted",
    missingGaps: ["Persistent route/audit stores and provider export are future work."]
  },
  {
    id: "source_mcp",
    moduleName: "MCP Gateway",
    auditSource: "MCPToolAuditEvent",
    currentRepositoryStorage: "InMemoryMCPToolAuditRepository",
    normalized: "yes",
    sourceModule: "mcp",
    category: "mcp",
    key: "mcpAuditEvents",
    sensitiveFields: ["tool input", "tool output", "requiredSecretRefs"],
    retentionClass: "operational",
    redactionClass: "contains_user_content_redacted",
    missingGaps: ["Real MCP transport audit is future work."]
  },
  {
    id: "source_runner",
    moduleName: "Runner",
    auditSource: "AgentRunAuditEvent",
    currentRepositoryStorage: "InMemoryAgentRunAuditRepository",
    normalized: "yes",
    sourceModule: "runner",
    category: "runner",
    key: "agentRunAuditEvents",
    sensitiveFields: ["stdout/stderr previews", "workspace paths", "metadata"],
    retentionClass: "operational",
    redactionClass: "contains_user_content_redacted",
    missingGaps: ["Production sandbox and durable runner audit are future work."]
  },
  {
    id: "source_registry",
    moduleName: "Registry",
    auditSource: "RegistryAuditLogEntry",
    currentRepositoryStorage: "RegistryAuditRepository",
    normalized: "yes",
    sourceModule: "registry",
    category: "registry",
    key: "registryAuditLogs",
    sensitiveFields: ["before", "after"],
    retentionClass: "compliance",
    redactionClass: "internal_metadata",
    missingGaps: ["Artifact signing and production package registry audit are future work."]
  },
  {
    id: "source_improvement",
    moduleName: "Improvement Governance",
    auditSource: "ImprovementGovernanceAuditEvent",
    currentRepositoryStorage: "Improvement governance in-memory repository",
    normalized: "yes",
    sourceModule: "improvement",
    category: "improvement",
    key: "improvementGovernanceAuditEvents",
    sensitiveFields: ["proposal metadata", "draft change metadata"],
    retentionClass: "compliance",
    redactionClass: "internal_metadata",
    missingGaps: ["Production governance persistence/export remains future work."]
  },
  {
    id: "source_local_agent",
    moduleName: "Local Agent Protocol",
    auditSource: "LocalAgentProtocolAuditEvent",
    currentRepositoryStorage: "Local Agent Protocol in-memory repository",
    normalized: "yes",
    sourceModule: "local_agent",
    category: "local_agent",
    key: "localAgentAuditEvents",
    sensitiveFields: ["stream previews", "credential cache paths", "metadata"],
    retentionClass: "operational",
    redactionClass: "contains_user_content_redacted",
    missingGaps: ["Real daemon/transport audit is future work."]
  },
  {
    id: "source_provider",
    moduleName: "Enterprise Provider Abstraction",
    auditSource: "ProviderAuditEvent",
    currentRepositoryStorage: "Provider audit repository",
    normalized: "partial",
    sourceModule: "enterprise_provider",
    category: "llm",
    key: "providerAuditEvents",
    sensitiveFields: ["provider credentials", "local CLI metadata"],
    retentionClass: "operational",
    redactionClass: "secret_adjacent",
    missingGaps: ["Provider adapter skeletons remain blocked; no real provider execution audit exists."]
  },
  {
    id: "source_deployment_readiness",
    moduleName: "Deployment Readiness",
    auditSource: "ReadinessCheck and ProductionRisk planning records",
    currentRepositoryStorage: "DeploymentReadinessService seeded read model",
    normalized: "partial",
    sourceModule: "deployment_readiness",
    category: "system",
    key: "deploymentReadinessChecks",
    sensitiveFields: ["environment flags"],
    retentionClass: "operational",
    redactionClass: "public_metadata",
    missingGaps: ["Readiness records are not audit events and do not run live checks."]
  }
];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringField(value: unknown, key: string): string {
  const field = record(value)[key];
  return typeof field === "string" ? field : "";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function metadataOf(event: unknown): Record<string, unknown> {
  const source = record(event);
  const metadata = record(source.metadata);
  const sanitizedMetadata = record(source.sanitizedMetadata);
  return { ...metadata, ...sanitizedMetadata };
}

function dateField(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
}

function eventDate(event: unknown): Date {
  const source = record(event);
  return dateField(source.createdAt) ??
    dateField(source.timestamp) ??
    dateField(source.receivedAt) ??
    dateField(source.observedAt) ??
    dateField(source.evaluatedAt) ??
    new Date(0);
}

function eventTypeFor(event: unknown): string {
  const source = record(event);
  return optionalString(source.eventType) ??
    optionalString(source.action) ??
    optionalString(source.name) ??
    optionalString(source.id) ??
    "unknown_event";
}

function stableSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "unknown";
}

function stableId(sourceModule: string, event: unknown, index: number): string {
  const source = record(event);
  return `auditenv_${stableSegment(sourceModule)}_${stableSegment(optionalString(source.id) ?? `${eventTypeFor(event)}_${index}`)}`;
}

function valueFromEventOrMetadata(event: unknown, key: string): string | undefined {
  const source = record(event);
  return optionalString(source[key]) ?? optionalString(metadataOf(event)[key]);
}

function outcomeFrom(event: unknown): AuditOutcome {
  const source = record(event);
  const metadata = metadataOf(event);
  const rawValues = [
    source.result,
    source.outcome,
    source.status,
    source.decision,
    metadata.result,
    metadata.outcome,
    metadata.status,
    metadata.decision
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
  const eventType = eventTypeFor(event).toLowerCase();
  if (source.allowed === false) return "denied";
  if (source.allowed === true) return "success";
  if (rawValues.some((value) => ["denied", "deny", "rejected", "unauthorized"].includes(value)) || eventType.includes("denied")) return "denied";
  if (rawValues.some((value) => ["blocked", "missing", "revoked", "disabled", "unavailable"].includes(value)) || eventType.includes("blocked")) return "blocked";
  if (rawValues.some((value) => ["failed", "failure", "error"].includes(value)) || eventType.includes("failed") || eventType.includes("error")) return "failed";
  if (rawValues.some((value) => ["skipped", "ignored", "not_applicable"].includes(value)) || eventType.includes("ignored") || eventType.includes("skipped")) return "skipped";
  if (rawValues.some((value) => ["success", "succeeded", "allowed", "allow", "resolved", "completed", "processed", "created", "updated", "verified", "received", "redacted", "pass", "passed"].includes(value))) return "success";
  if (eventType.includes("rejected")) return "denied";
  if (eventType.includes("completed") || eventType.includes("allowed") || eventType.includes("created") || eventType.includes("updated")) return "success";
  return "unknown";
}

function severityFrom(event: unknown, outcome: AuditOutcome): AuditSeverity {
  const source = record(event);
  const metadata = metadataOf(event);
  const rawSeverity = optionalString(source.severity) ?? optionalString(metadata.severity);
  if (rawSeverity === "critical" || rawSeverity === "high") return rawSeverity === "critical" ? "critical" : "error";
  if (rawSeverity === "medium") return "warning";
  if (rawSeverity === "low") return "info";
  if (outcome === "failed") return "error";
  if (outcome === "denied" || outcome === "blocked") return "warning";
  if (outcome === "skipped") return "debug";
  return "info";
}

function retentionClassFor(category: AuditCategory): AuditRetentionClassName {
  if (category === "auth" || category === "policy" || category === "credential" || category === "git_webhook" || category === "security") return "security";
  if (category === "registry" || category === "improvement") return "compliance";
  return "operational";
}

function redactionClassFor(category: AuditCategory, eventType: string): AuditRedactionClassName {
  const lowered = eventType.toLowerCase();
  if (lowered.includes("payload") || lowered.includes("webhook") || lowered.includes("credential_cache")) return "never_store_raw";
  if (category === "credential" || lowered.includes("credential") || lowered.includes("secret") || lowered.includes("token")) return "secret_adjacent";
  if (category === "llm" || category === "mcp" || category === "runner" || category === "local_agent" || lowered.includes("output") || lowered.includes("prompt") || lowered.includes("tool")) return "contains_user_content_redacted";
  if (category === "auth" || category === "policy" || category === "security") return "sensitive_metadata";
  if (category === "system" || category === "dashboard") return "public_metadata";
  return "internal_metadata";
}

function summaryFor(event: unknown, eventType: string, outcome: AuditOutcome): string {
  const source = record(event);
  const reason = optionalString(source.reason) ?? optionalString(metadataOf(event).reason);
  const message = optionalString(source.message) ?? optionalString(metadataOf(event).message);
  return redactAuditString(message ?? reason ?? `${eventType} ${outcome}`);
}

function metadataFor(event: unknown): Record<string, unknown> {
  const source = record(event);
  return sanitizeAuditMetadata({
    sourceId: source.id,
    result: source.result,
    status: source.status,
    decision: source.decision,
    reason: source.reason,
    action: source.action,
    targetType: source.targetType,
    targetKind: source.targetKind,
    targetId: source.targetId,
    resourceKind: source.resourceKind,
    resourceId: source.resourceId,
    matchedRuleIds: source.matchedRuleIds,
    deliveryId: source.deliveryId,
    repoRef: source.repoRef,
    serverId: source.serverId,
    toolId: source.toolId,
    operation: source.operation,
    before: source.before,
    after: source.after,
    ...metadataOf(event)
  });
}

function normalizeEvent(event: unknown, definition: SourceDefinition, index: number): AuditEventEnvelope {
  const eventType = eventTypeFor(event);
  const category = definition.category;
  const outcome = outcomeFrom(event);
  const severity = severityFrom(event, outcome);
  const metadata = metadataFor(event);
  const timestamp = eventDate(event);
  const providerKind = valueFromEventOrMetadata(event, "providerKind") ?? valueFromEventOrMetadata(event, "provider");
  return {
    id: stableId(definition.sourceModule, event, index),
    timestamp,
    category,
    eventType,
    severity,
    outcome,
    actorId: valueFromEventOrMetadata(event, "actorId") ?? valueFromEventOrMetadata(event, "actorUserId"),
    principalId: valueFromEventOrMetadata(event, "principalId"),
    authMode: valueFromEventOrMetadata(event, "authMode"),
    requestId: valueFromEventOrMetadata(event, "requestId"),
    correlationId: valueFromEventOrMetadata(event, "correlationId"),
    taskId: valueFromEventOrMetadata(event, "taskId"),
    taskRunId: valueFromEventOrMetadata(event, "taskRunId"),
    agentRunId: valueFromEventOrMetadata(event, "agentRunId") ?? valueFromEventOrMetadata(event, "runId"),
    repoId: valueFromEventOrMetadata(event, "repoId") ?? valueFromEventOrMetadata(event, "repoRef"),
    providerId: valueFromEventOrMetadata(event, "providerId"),
    providerKind,
    modelId: valueFromEventOrMetadata(event, "modelId") ?? valueFromEventOrMetadata(event, "model"),
    toolId: valueFromEventOrMetadata(event, "toolId"),
    secretRefId: valueFromEventOrMetadata(event, "secretRefId"),
    policyDecisionId: valueFromEventOrMetadata(event, "policyDecisionId"),
    sourceModule: definition.sourceModule,
    retentionClass: definition.retentionClass ?? retentionClassFor(category),
    redactionClass: redactionClassFor(category, eventType),
    sanitizedSummary: summaryFor(event, eventType, outcome),
    sanitizedMetadata: metadata,
    createdAt: timestamp
  };
}

function sourceItems(sources: ObservabilityAuditSources, definition: SourceDefinition): unknown[] {
  const items = sources[definition.key];
  if (!Array.isArray(items)) return [];
  return definition.eventFilter ? items.filter(definition.eventFilter) : items;
}

function buildCounts<T extends string>(keys: T[], events: AuditEventEnvelope[], selector: (event: AuditEventEnvelope) => T): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, events.filter((event) => selector(event) === key).length])) as Record<T, number>;
}

function applyAuditQuery(events: AuditEventEnvelope[], query: AuditQuery): AuditEventEnvelope[] {
  return events.filter((event) =>
    (query.categories === undefined || query.categories.includes(event.category)) &&
    (query.eventTypes === undefined || query.eventTypes.includes(event.eventType)) &&
    (query.actorId === undefined || event.actorId === query.actorId) &&
    (query.taskId === undefined || event.taskId === query.taskId) &&
    (query.taskRunId === undefined || event.taskRunId === query.taskRunId) &&
    (query.providerId === undefined || event.providerId === query.providerId) &&
    (query.outcome === undefined || event.outcome === query.outcome) &&
    (query.severity === undefined || event.severity === query.severity) &&
    (query.since === undefined || event.timestamp >= query.since) &&
    (query.until === undefined || event.timestamp <= query.until)
  );
}

function spanStatus(outcome: AuditOutcome): TraceSpanStatus {
  if (outcome === "failed") return "error";
  if (outcome === "skipped") return "cancelled";
  if (outcome === "unknown") return "unknown";
  return "ok";
}

function traceIdFor(event: AuditEventEnvelope): string {
  return event.correlationId ?? event.requestId ?? event.taskRunId ?? event.taskId ?? event.providerId ?? `trace_${event.id}`;
}

function metricPoint(metricName: string, value: number, dimensions: Record<string, string>, timestamp: Date): MetricPoint {
  return {
    id: `metricpoint_${stableSegment(metricName)}_${stableSegment(Object.values(dimensions).join("_") || "global")}`,
    metricName,
    value,
    dimensions,
    timestamp
  };
}

export class ObservabilityService {
  private readonly sourceProvider: () => ObservabilityAuditSources;
  private readonly now: () => Date;
  private readonly maxQueryLimit: number;
  private readonly retentionClasses: AuditRetentionClass[];
  private readonly redactionClasses: AuditRedactionClass[];
  private readonly retentionPolicies: AuditRetentionPolicy[];
  private readonly metricDefinitions: MetricDefinition[];

  constructor(input: ObservabilityServiceInput = {}) {
    this.sourceProvider = input.sourceProvider ?? (() => ({}));
    this.now = input.now ?? (() => new Date());
    this.maxQueryLimit = input.maxQueryLimit ?? 100;
    this.retentionClasses = structuredClone(input.retentionClasses ?? defaultAuditRetentionClasses);
    this.redactionClasses = structuredClone(input.redactionClasses ?? defaultAuditRedactionClasses);
    this.retentionPolicies = structuredClone(input.retentionPolicies ?? defaultAuditRetentionPolicies);
    this.metricDefinitions = structuredClone(input.metricDefinitions ?? defaultMetricDefinitions);
  }

  getConfig(): ObservabilityConfig {
    return {
      status: "v0_implemented",
      aggregationMode: "in_memory_read_model",
      externalBackendEnabled: false,
      externalExportEnabled: false,
      alertDeliveryEnabled: false,
      retentionDeletionJobsEnabled: false,
      rawPayloadStorageEnabled: false,
      maxQueryLimit: this.maxQueryLimit,
      noSecretsExposed: true,
      metadata: {
        mockFirst: true,
        noExternalBackend: true,
        noRetentionDeletion: true
      }
    };
  }

  listAuditEvents(query: AuditQuery = {}): AuditQueryResult {
    const limit = Math.max(0, Math.min(query.limit ?? 50, this.maxQueryLimit));
    const matching = applyAuditQuery(this.collectEnvelopes(), query)
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
    return {
      events: structuredClone(matching.slice(0, limit)),
      total: matching.length,
      truncated: matching.length > limit,
      querySummary: sanitizeAuditMetadata({
        categories: query.categories,
        eventTypes: query.eventTypes,
        actorId: query.actorId,
        taskId: query.taskId,
        taskRunId: query.taskRunId,
        providerId: query.providerId,
        outcome: query.outcome,
        severity: query.severity,
        since: query.since?.toISOString(),
        until: query.until?.toISOString(),
        requestedLimit: query.limit,
        appliedLimit: limit
      })
    };
  }

  getAuditSummary(): AuditSummary {
    const events = this.collectEnvelopes();
    const securityEvents = events.filter((event) => event.retentionClass === "security" || event.category === "security" || event.category === "credential");
    const deniedOrBlocked = events.filter((event) => event.outcome === "denied" || event.outcome === "blocked");
    return {
      generatedAt: this.now(),
      totalEvents: events.length,
      byCategory: buildCounts(auditCategories, events, (event) => event.category),
      byOutcome: buildCounts(auditOutcomes, events, (event) => event.outcome),
      bySeverity: buildCounts(auditSeverities, events, (event) => event.severity),
      recentSecurityEvents: structuredClone(securityEvents.slice(-10).reverse()),
      deniedOrBlockedEvents: structuredClone(deniedOrBlocked.slice(-10).reverse()),
      noSecretsExposed: true,
      metadata: {
        sourceCount: this.listAuditSources().length,
        unsafeMaterialDetected: containsUnsafeAuditMaterial(events)
      }
    };
  }

  listRetentionClasses(): AuditRetentionClass[] {
    return structuredClone(this.retentionClasses);
  }

  listRedactionClasses(): AuditRedactionClass[] {
    return structuredClone(this.redactionClasses);
  }

  listRetentionPolicies(): AuditRetentionPolicy[] {
    return structuredClone(this.retentionPolicies);
  }

  listAuditSources(): AuditSourceCoverage[] {
    const sources = this.sourceProvider();
    return sourceDefinitions.map((definition) => {
      const items = sourceItems(sources, definition);
      const eventTypes = [...new Set(items.map(eventTypeFor))].filter(Boolean).slice(0, 12);
      return {
        id: definition.id,
        moduleName: definition.moduleName,
        auditSource: definition.auditSource,
        currentRepositoryStorage: definition.currentRepositoryStorage,
        normalized: definition.normalized,
        sourceModule: definition.sourceModule,
        category: definition.category,
        eventCount: items.length,
        keyEventTypes: eventTypes,
        sensitiveFields: definition.sensitiveFields,
        retentionClass: definition.retentionClass,
        redactionClass: definition.redactionClass,
        missingGaps: definition.missingGaps
      };
    });
  }

  listMetricDefinitions(): MetricDefinition[] {
    return structuredClone(this.metricDefinitions);
  }

  getMetricSnapshot(): MetricSnapshot {
    const timestamp = this.now();
    const events = this.collectEnvelopes();
    const sources = this.listAuditSources();
    const spans = this.listTraceSpans();
    const points: MetricPoint[] = [
      metricPoint("audit.events.total", events.length, { sourceModule: "all" }, timestamp),
      metricPoint("audit.events.denied_blocked", events.filter((event) => event.outcome === "denied" || event.outcome === "blocked").length, { category: "all", outcome: "denied_or_blocked" }, timestamp),
      metricPoint("audit.events.security_recent", events.filter((event) => event.retentionClass === "security" || event.category === "security" || event.category === "credential").length, { category: "security" }, timestamp),
      metricPoint("audit.sources.coverage", sources.filter((source) => source.normalized === "yes").length, { normalized: "yes" }, timestamp),
      metricPoint("audit.sources.coverage", sources.filter((source) => source.normalized === "partial").length, { normalized: "partial" }, timestamp),
      metricPoint("retention.policies.total", this.retentionPolicies.filter((policy) => policy.status === "active").length, { status: "active" }, timestamp),
      metricPoint("traces.spans.total", spans.length, { status: "all" }, timestamp),
      metricPoint("observability.external_exporter.enabled", 0, { exporter: "none" }, timestamp)
    ];
    return {
      generatedAt: timestamp,
      definitions: this.listMetricDefinitions(),
      points,
      externalExporterEnabled: false,
      metadata: {
        inMemoryOnly: true,
        externalExporter: false
      }
    };
  }

  listTraceSpans(query: TraceQuery = {}): TraceSpan[] {
    const limit = Math.max(0, Math.min(query.limit ?? 50, this.maxQueryLimit));
    return this.collectEnvelopes()
      .filter((event) =>
        (query.taskId === undefined || event.taskId === query.taskId) &&
        (query.taskRunId === undefined || event.taskRunId === query.taskRunId) &&
        (query.providerId === undefined || event.providerId === query.providerId) &&
        (query.traceId === undefined || traceIdFor(event) === query.traceId)
      )
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
      .slice(0, limit)
      .map((event) => ({
        id: `span_${event.id}`,
        traceId: traceIdFor(event),
        name: `${event.category}.${event.eventType}`,
        category: event.category,
        startTime: event.timestamp,
        durationMs: numberField(event.sanitizedMetadata.durationMs) ?? numberField(event.sanitizedMetadata.latencyMs),
        status: spanStatus(event.outcome),
        taskId: event.taskId,
        taskRunId: event.taskRunId,
        providerId: event.providerId,
        metadata: sanitizeAuditMetadata({
          auditEventId: event.id,
          sourceModule: event.sourceModule,
          outcome: event.outcome,
          skeletonOnly: true,
          externalExporter: false
        })
      }));
  }

  buildDashboardObservabilityReadModel(): ObservabilityDashboardReadModel {
    const summary = this.getAuditSummary();
    const recent = this.listAuditEvents({ limit: 10 }).events;
    const spans = this.listTraceSpans({ limit: 10 });
    const sources = this.listAuditSources();
    const readinessBlockers = [
      ...sourceItems(this.sourceProvider(), {
        ...sourceDefinitions.find((source) => source.id === "source_deployment_readiness")!,
        key: "deploymentReadinessChecks"
      }).filter((item) => stringField(item, "category") === "observability" || stringField(item, "category") === "audit"),
      ...(this.sourceProvider().deploymentRisks ?? []).filter((item) => stringField(item, "category") === "observability" || stringField(item, "category") === "audit")
    ].map((item) => sanitizeAuditMetadata(item));
    return {
      config: this.getConfig(),
      auditSummary: summary,
      recentEvents: recent,
      recentSecurityEvents: summary.recentSecurityEvents,
      deniedOrBlockedEvents: summary.deniedOrBlockedEvents,
      retentionClasses: this.listRetentionClasses(),
      redactionClasses: this.listRedactionClasses(),
      retentionPolicies: this.listRetentionPolicies(),
      metricDefinitions: this.listMetricDefinitions(),
      metricSnapshot: this.getMetricSnapshot(),
      traceSpans: spans,
      traceSummary: sanitizeAuditMetadata({
        spanCount: spans.length,
        uniqueTraceIds: new Set(spans.map((span) => span.traceId)).size,
        externalExporterEnabled: false,
        skeletonOnly: true
      }),
      sourceCoverage: sources,
      productionReadinessBlockers: readinessBlockers,
      noSecretStatus: {
        noSecretsExposed: true,
        rawPayloadsStored: false,
        externalExporterEnabled: false,
        retentionDeletesEnabled: false
      }
    };
  }

  private collectEnvelopes(): AuditEventEnvelope[] {
    const sources = this.sourceProvider();
    const envelopes: AuditEventEnvelope[] = [];
    for (const definition of sourceDefinitions) {
      sourceItems(sources, definition).forEach((event, index) => {
        envelopes.push(normalizeEvent(event, definition, index));
      });
    }
    return envelopes;
  }
}

export function createObservabilityService(input: ObservabilityServiceInput = {}): ObservabilityService {
  return new ObservabilityService(input);
}
