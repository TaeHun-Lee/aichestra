import { redactAuditString, sanitizeAuditMetadata } from "./sanitizer.ts";

export type AuditQueryRequestedDetailLevel = "summary" | "metadata" | "detail" | "raw_payload_forbidden";
export type AuditQueryAllowedDetailLevel = "summary" | "metadata" | "detail" | "none";
export type AuditQueryScopeDecisionValue =
  | "allow_summary"
  | "allow_metadata"
  | "redact_detail"
  | "deny_detail"
  | "deny_query"
  | "warning_missing_scope";

export type AuditQueryScopeRequest = {
  id: string;
  actorId: string;
  principalId?: string;
  roles: string[];
  tenantIds: string[];
  teamIds: string[];
  projectIds: string[];
  repoIds: string[];
  providerIds: string[];
  resourceKinds: string[];
  auditSources: string[];
  requestedDetailLevel: AuditQueryRequestedDetailLevel;
  requestId?: string;
  correlationId?: string;
  metadata: Record<string, unknown>;
};

export type AuditQueryScopeRequestInput = Partial<Omit<AuditQueryScopeRequest, "id" | "metadata">> & {
  id?: string;
  metadata?: Record<string, unknown>;
};

export type AuditQueryScopeDecision = {
  id: string;
  decision: AuditQueryScopeDecisionValue;
  reason: string;
  matchedScopes: string[];
  missingScopes: string[];
  mismatchedScopes: string[];
  allowedDetailLevel: AuditQueryAllowedDetailLevel;
  redactedFields: string[];
  source: string;
  requestId?: string;
  correlationId?: string;
  metadata: Record<string, unknown>;
};

export type AuditQueryRedactionPlan = {
  id: string;
  auditSource: string;
  detailLevel: AuditQueryRequestedDetailLevel;
  fieldsToRedact: string[];
  reason: string;
  metadata: Record<string, unknown>;
};

export type AuditQueryScopeDecisionSummary = {
  id: string;
  decision: AuditQueryScopeDecisionValue;
  reason: string;
  allowedDetailLevel: AuditQueryAllowedDetailLevel;
  redactedFieldCount: number;
  missingScopes: string[];
  mismatchedScopes: string[];
  rawPayloadAllowed: false;
  productionStorageEnforcement: false;
  noSecretsExposed: true;
  envValuesExposed: false;
  warnings: string[];
  metadata: Record<string, unknown>;
};

export type AuditQueryScopeEnforcementSummary = {
  id: string;
  status: "v1_implemented_partial";
  defaultDetailLevel: AuditQueryRequestedDetailLevel;
  redactionPlanCount: number;
  rawPayloadAllowed: false;
  productionStorageEnforcement: false;
  externalExportEnabled: false;
  noSecretsExposed: true;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type AuditQueryScopeRequestContextLike = {
  requestId?: string;
  correlationId?: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  resourceScopes?: Array<Record<string, unknown>>;
  authContext?: {
    actor?: { id?: string };
    principal?: { id?: string };
    roles?: Array<{ id?: string; name?: string }>;
    teams?: Array<{ id?: string }>;
    tenantScopes?: Array<{ tenantId?: string }>;
    teamScopes?: Array<{ teamId?: string }>;
    projectScopes?: Array<{ projectId?: string }>;
    resourceScopes?: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
};

const rawPayloadFields = [
  "rawPayload",
  "raw_payload",
  "payload",
  "payloadRaw",
  "webhookPayload",
  "providerPayload"
];

const secretLikeFields = [
  "Authorization",
  "authorization",
  "cookie",
  "Cookie",
  "setCookie",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
  "secretValue",
  "session",
  "sessionId",
  "jwt",
  "credential",
  "credentials",
  "credentialCache",
  "credentialCachePath",
  "privateKey",
  "env",
  "envValue",
  "envValues"
];

const userContentFields = [
  "prompt",
  "rawPrompt",
  "toolInput",
  "toolOutput",
  "providerRequest",
  "providerResponse",
  "rawOutput"
];

const metadataOnlyRedactions = [...rawPayloadFields, ...secretLikeFields];
const detailRedactions = [...metadataOnlyRedactions, ...userContentFields];

const redactionPlans: AuditQueryRedactionPlan[] = [
  plan("audit_scope_plan_summary", "all", "summary", detailRedactions, "summary_level_removes_detail_metadata"),
  plan("audit_scope_plan_metadata", "all", "metadata", metadataOnlyRedactions, "metadata_level_redacts_raw_payload_and_secret_like_fields"),
  plan("audit_scope_plan_detail", "all", "detail", metadataOnlyRedactions, "detail_level_still_redacts_secret_like_fields"),
  plan("audit_scope_plan_raw_forbidden", "all", "raw_payload_forbidden", detailRedactions, "raw_payload_forbidden_in_v1")
];

export class AuditQueryScopeEnforcementService {
  evaluateAuditQuery(
    input: AuditQueryScopeRequestInput = {},
    requestContext?: AuditQueryScopeRequestContextLike
  ): AuditQueryScopeDecision {
    const request = normalizeRequest(input, requestContext);
    const roles = new Set(request.roles.map(normalizeRole));
    const requested = request.requestedDetailLevel;
    const scopeStatus = scopeStatusFor(request);
    const source = stringMetadata(request.metadata.source) ?? "observability:audit_query_scope";

    if (requested === "raw_payload_forbidden") {
      return decisionFor(request, {
        decision: "deny_query",
        reason: "raw_payload_forbidden_in_v1",
        allowedDetailLevel: "none",
        redactedFields: detailRedactions,
        missingScopes: [],
        mismatchedScopes: [],
        matchedScopes: scopeStatus.matchedScopes,
        source
      });
    }

    if (roles.has("viewer") || roles.size === 0) {
      if (requested === "summary") {
        return decisionFor(request, {
          decision: "allow_summary",
          reason: "viewer_summary_allowed",
          allowedDetailLevel: "summary",
          redactedFields: detailRedactions,
          matchedScopes: ["role:viewer", ...scopeStatus.matchedScopes],
          missingScopes: scopeStatus.missingScopes,
          mismatchedScopes: scopeStatus.mismatchedScopes,
          source
        });
      }
      return decisionFor(request, {
        decision: requested === "detail" ? "deny_detail" : "warning_missing_scope",
        reason: "viewer_detail_not_allowed",
        allowedDetailLevel: "summary",
        redactedFields: detailRedactions,
        matchedScopes: ["role:viewer", ...scopeStatus.matchedScopes],
        missingScopes: uniqueStrings(["role_with_audit_metadata_access", ...scopeStatus.missingScopes]),
        mismatchedScopes: scopeStatus.mismatchedScopes,
        source
      });
    }

    if (roles.has("service_account_runner")) {
      return decisionFor(request, {
        decision: requested === "summary" ? "allow_summary" : "deny_detail",
        reason: "service_account_cannot_bypass_audit_scope",
        allowedDetailLevel: "summary",
        redactedFields: detailRedactions,
        matchedScopes: ["role:service_account_runner", ...scopeStatus.matchedScopes],
        missingScopes: uniqueStrings(["human_or_audit_reader_role", ...scopeStatus.missingScopes]),
        mismatchedScopes: scopeStatus.mismatchedScopes,
        source
      });
    }

    if (roles.has("security_admin") || roles.has("platform_admin") || roles.has("system_admin") || roles.has("system_admin_future")) {
      return decisionFor(request, {
        decision: requested === "summary" ? "allow_summary" : requested === "metadata" ? "allow_metadata" : "redact_detail",
        reason: "admin_operational_metadata_allowed_with_redaction",
        allowedDetailLevel: requested === "summary" ? "summary" : requested === "metadata" ? "metadata" : "detail",
        redactedFields: requested === "detail" ? metadataOnlyRedactions : detailRedactions,
        matchedScopes: [`role:${roles.has("security_admin") ? "security_admin" : "platform_admin"}`, ...scopeStatus.matchedScopes],
        missingScopes: scopeStatus.missingScopes,
        mismatchedScopes: scopeStatus.mismatchedScopes,
        source
      });
    }

    if (roles.has("audit_reader")) {
      if (!scopeStatus.hasAuditQueryScope) {
        return decisionFor(request, {
          decision: requested === "summary" ? "warning_missing_scope" : "deny_detail",
          reason: "audit_reader_requires_audit_query_scope",
          allowedDetailLevel: "summary",
          redactedFields: detailRedactions,
          matchedScopes: ["role:audit_reader", ...scopeStatus.matchedScopes],
          missingScopes: uniqueStrings(["audit_query", ...scopeStatus.missingScopes]),
          mismatchedScopes: scopeStatus.mismatchedScopes,
          source
        });
      }
      return decisionFor(request, {
        decision: requested === "summary" ? "allow_summary" : requested === "metadata" ? "allow_metadata" : "redact_detail",
        reason: "audit_reader_scope_present",
        allowedDetailLevel: requested === "summary" ? "summary" : requested === "metadata" ? "metadata" : "detail",
        redactedFields: requested === "detail" ? metadataOnlyRedactions : detailRedactions,
        matchedScopes: uniqueStrings(["role:audit_reader", "audit_query", ...scopeStatus.matchedScopes]),
        missingScopes: scopeStatus.missingScopes,
        mismatchedScopes: scopeStatus.mismatchedScopes,
        source
      });
    }

    if (roles.has("developer")) {
      if (!scopeStatus.hasDeveloperScope) {
        return decisionFor(request, {
          decision: requested === "detail" ? "deny_detail" : "warning_missing_scope",
          reason: "developer_metadata_requires_project_repo_or_provider_scope",
          allowedDetailLevel: "summary",
          redactedFields: detailRedactions,
          matchedScopes: ["role:developer", ...scopeStatus.matchedScopes],
          missingScopes: uniqueStrings(["project_or_repo_or_provider", ...scopeStatus.missingScopes]),
          mismatchedScopes: scopeStatus.mismatchedScopes,
          source
        });
      }
      return decisionFor(request, {
        decision: requested === "summary" ? "allow_summary" : requested === "metadata" ? "allow_metadata" : "redact_detail",
        reason: "developer_scoped_metadata_allowed",
        allowedDetailLevel: requested === "summary" ? "summary" : "metadata",
        redactedFields: detailRedactions,
        matchedScopes: uniqueStrings(["role:developer", "project_or_repo_or_provider", ...scopeStatus.matchedScopes]),
        missingScopes: scopeStatus.missingScopes,
        mismatchedScopes: scopeStatus.mismatchedScopes,
        source
      });
    }

    return decisionFor(request, {
      decision: requested === "summary" ? "allow_summary" : "warning_missing_scope",
      reason: "role_metadata_access_not_configured",
      allowedDetailLevel: "summary",
      redactedFields: detailRedactions,
      matchedScopes: scopeStatus.matchedScopes,
      missingScopes: uniqueStrings(["recognized_audit_role", ...scopeStatus.missingScopes]),
      mismatchedScopes: scopeStatus.mismatchedScopes,
      source
    });
  }

  redactAuditResult<T>(result: T, decision: AuditQueryScopeDecision): T & { scopeDecisionSummary: AuditQueryScopeDecisionSummary } {
    if (decision.decision === "deny_query") {
      return {
        events: [],
        total: 0,
        truncated: false,
        querySummary: {
          auditQueryDenied: true,
          reason: decision.reason,
          rawPayloadAllowed: false,
          productionStorageEnforcement: false
        },
        scopeDecisionSummary: this.summarizeAuditQueryDecision(decision)
      } as unknown as T & { scopeDecisionSummary: AuditQueryScopeDecisionSummary };
    }

    const redacted = redactByDecision(result, decision);
    if (redacted && typeof redacted === "object" && !Array.isArray(redacted)) {
      return {
        ...(redacted as Record<string, unknown>),
        scopeDecisionSummary: this.summarizeAuditQueryDecision(decision)
      } as T & { scopeDecisionSummary: AuditQueryScopeDecisionSummary };
    }
    return {
      value: redacted,
      scopeDecisionSummary: this.summarizeAuditQueryDecision(decision)
    } as unknown as T & { scopeDecisionSummary: AuditQueryScopeDecisionSummary };
  }

  summarizeAuditQueryDecision(decision: AuditQueryScopeDecision): AuditQueryScopeDecisionSummary {
    const warnings = uniqueStrings([
      ...decision.missingScopes.map((scope) => `missing_scope:${scope}`),
      ...decision.mismatchedScopes.map((scope) => `mismatched_scope:${scope}`),
      decision.decision === "deny_query" ? "raw_payload_forbidden" : undefined,
      decision.decision === "deny_detail" ? "audit_detail_denied" : undefined,
      decision.decision === "warning_missing_scope" ? "missing_scope_warning" : undefined,
      "production_storage_enforcement:false"
    ]);
    return {
      id: decision.id,
      decision: decision.decision,
      reason: decision.reason,
      allowedDetailLevel: decision.allowedDetailLevel,
      redactedFieldCount: decision.redactedFields.length,
      missingScopes: [...decision.missingScopes],
      mismatchedScopes: [...decision.mismatchedScopes],
      rawPayloadAllowed: false,
      productionStorageEnforcement: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      warnings,
      metadata: sanitizeAuditMetadata({
        source: decision.source,
        representativeOnly: true,
        productionReady: false,
        noExternalExport: true
      })
    };
  }

  listRedactionPlans(): AuditQueryRedactionPlan[] {
    return structuredClone(redactionPlans);
  }

  getSummary(): AuditQueryScopeEnforcementSummary {
    return {
      id: "audit_query_scope_enforcement_v1",
      status: "v1_implemented_partial",
      defaultDetailLevel: "summary",
      redactionPlanCount: redactionPlans.length,
      rawPayloadAllowed: false,
      productionStorageEnforcement: false,
      externalExportEnabled: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      metadata: sanitizeAuditMetadata({
        docs: "docs/features/audit-query-scope-enforcement/v1.md",
        observabilityVersion: "v0_implemented",
        tenantScopeEnforcement: "v1_implemented_partial",
        storageFilteringImplemented: false,
        externalSiemExportImplemented: false,
        rawPayloadForbidden: true
      })
    };
  }
}

export function createAuditQueryScopeEnforcementService(): AuditQueryScopeEnforcementService {
  return new AuditQueryScopeEnforcementService();
}

function plan(
  id: string,
  auditSource: string,
  detailLevel: AuditQueryRequestedDetailLevel,
  fieldsToRedact: string[],
  reason: string
): AuditQueryRedactionPlan {
  return {
    id,
    auditSource,
    detailLevel,
    fieldsToRedact: uniqueStrings(fieldsToRedact),
    reason,
    metadata: {
      productionStorageEnforcement: false,
      rawPayloadAllowed: false,
      noSecretsExposed: true
    }
  };
}

function normalizeRequest(
  input: AuditQueryScopeRequestInput,
  context?: AuditQueryScopeRequestContextLike
): AuditQueryScopeRequest {
  const roles = input.roles?.length
    ? input.roles
    : (context?.authContext?.roles ?? []).map((role) => role.name ?? role.id).filter((role): role is string => Boolean(role));
  const tenantIds = uniqueStrings([
    ...(input.tenantIds ?? []),
    context?.tenantId,
    ...(context?.authContext?.tenantScopes ?? []).map((scope) => scope.tenantId),
    ...scopeIdsFor(context, "tenant")
  ]);
  const teamIds = uniqueStrings([
    ...(input.teamIds ?? []),
    context?.teamId,
    ...(context?.authContext?.teams ?? []).map((team) => team.id),
    ...(context?.authContext?.teamScopes ?? []).map((scope) => scope.teamId),
    ...scopeIdsFor(context, "team")
  ]);
  const projectIds = uniqueStrings([
    ...(input.projectIds ?? []),
    context?.projectId,
    ...(context?.authContext?.projectScopes ?? []).map((scope) => scope.projectId),
    ...scopeIdsFor(context, "project")
  ]);
  return {
    id: input.id ?? stableId("audit_query_request", [
      input.actorId ?? context?.authContext?.actor?.id ?? "anonymous",
      input.requestedDetailLevel ?? "summary",
      tenantIds.join(".") || "no_tenant",
      projectIds.join(".") || "no_project"
    ]),
    actorId: input.actorId ?? context?.authContext?.actor?.id ?? "anonymous",
    principalId: input.principalId ?? context?.authContext?.principal?.id,
    roles: uniqueStrings(roles.map(normalizeRole)),
    tenantIds,
    teamIds,
    projectIds,
    repoIds: uniqueStrings([...(input.repoIds ?? []), ...scopeIdsFor(context, "repo")]),
    providerIds: uniqueStrings([...(input.providerIds ?? []), ...scopeIdsFor(context, "provider")]),
    resourceKinds: uniqueStrings(input.resourceKinds ?? []),
    auditSources: uniqueStrings(input.auditSources ?? []),
    requestedDetailLevel: input.requestedDetailLevel ?? "summary",
    requestId: input.requestId ?? context?.requestId,
    correlationId: input.correlationId ?? context?.correlationId,
    metadata: sanitizeAuditMetadata({
      ...(input.metadata ?? {}),
      serviceAccountId: context?.authContext?.metadata?.serviceAccountId,
      productionStorageEnforcement: false,
      rawPayloadAllowed: false
    })
  };
}

function scopeIdsFor(context: AuditQueryScopeRequestContextLike | undefined, scopeKind: string): string[] {
  const scopes = [
    ...(context?.resourceScopes ?? []),
    ...(context?.authContext?.resourceScopes ?? [])
  ];
  return scopes
    .filter((scope) => scope.scopeKind === scopeKind)
    .map((scope) => typeof scope.scopeId === "string" ? scope.scopeId : undefined)
    .filter((scope): scope is string => Boolean(scope));
}

function scopeStatusFor(request: AuditQueryScopeRequest): {
  hasDeveloperScope: boolean;
  hasAuditQueryScope: boolean;
  matchedScopes: string[];
  missingScopes: string[];
  mismatchedScopes: string[];
} {
  const hasTenantScope = request.tenantIds.length > 0 || request.teamIds.length > 0 || request.projectIds.length > 0;
  const hasDeveloperScope = request.projectIds.length > 0 || request.repoIds.length > 0 || request.providerIds.length > 0;
  const explicitAuditQueryScope = request.resourceKinds.length > 0 ||
    request.auditSources.length > 0 ||
    request.metadata.auditQueryScope === true ||
    request.metadata.auditQueryScope === "present" ||
    request.metadata.auditQueryScopeStatus === "present";
  const hasAuditQueryScope = hasTenantScope && explicitAuditQueryScope;
  const matchedScopes = uniqueStrings([
    request.tenantIds.length > 0 ? "tenant" : undefined,
    request.teamIds.length > 0 ? "team" : undefined,
    request.projectIds.length > 0 ? "project" : undefined,
    request.repoIds.length > 0 ? "repo" : undefined,
    request.providerIds.length > 0 ? "provider" : undefined,
    explicitAuditQueryScope ? "audit_query" : undefined
  ]);
  const missingScopes = uniqueStrings([
    hasTenantScope ? undefined : "tenant_or_team_or_project",
    hasDeveloperScope ? undefined : "project_or_repo_or_provider",
    hasAuditQueryScope ? undefined : "audit_query"
  ]);
  return {
    hasDeveloperScope,
    hasAuditQueryScope,
    matchedScopes,
    missingScopes,
    mismatchedScopes: []
  };
}

function decisionFor(request: AuditQueryScopeRequest, input: {
  decision: AuditQueryScopeDecisionValue;
  reason: string;
  matchedScopes: string[];
  missingScopes: string[];
  mismatchedScopes: string[];
  allowedDetailLevel: AuditQueryAllowedDetailLevel;
  redactedFields: string[];
  source: string;
}): AuditQueryScopeDecision {
  return {
    id: stableId("audit_query_decision", [request.id, input.decision, input.reason]),
    decision: input.decision,
    reason: input.reason,
    matchedScopes: uniqueStrings(input.matchedScopes),
    missingScopes: uniqueStrings(input.missingScopes),
    mismatchedScopes: uniqueStrings(input.mismatchedScopes),
    allowedDetailLevel: input.allowedDetailLevel,
    redactedFields: uniqueStrings(input.redactedFields),
    source: input.source,
    requestId: request.requestId,
    correlationId: request.correlationId,
    metadata: sanitizeAuditMetadata({
      request,
      rawPayloadAllowed: false,
      productionStorageEnforcement: false,
      noExternalProviderCall: true,
      noExternalExport: true
    })
  };
}

function redactByDecision(value: unknown, decision: AuditQueryScopeDecision): unknown {
  if (Array.isArray(value)) return value.map((item) => redactByDecision(item, decision));
  if (!value || typeof value !== "object") return sanitizeScalar(value);
  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  const summaryOnly = decision.allowedDetailLevel === "summary" || decision.decision === "deny_detail" || decision.decision === "warning_missing_scope";
  const fields = new Set(decision.redactedFields.map((field) => field.toLowerCase()));

  for (const [key, child] of Object.entries(source)) {
    if (fields.has(key.toLowerCase()) || isSecretLikeKey(key)) {
      output[key] = "[redacted]";
      continue;
    }
    if (summaryOnly && key === "sanitizedMetadata") {
      output[key] = { redactedByAuditQueryScope: true };
      continue;
    }
    if (summaryOnly && key === "events" && Array.isArray(child)) {
      output[key] = child.map(summaryEvent);
      continue;
    }
    output[key] = redactByDecision(child, decision);
  }
  if (summaryOnly) {
    output.auditDetailRedacted = true;
  }
  return output;
}

function summaryEvent(value: unknown): Record<string, unknown> {
  const event = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    id: sanitizeScalar(event.id),
    timestamp: sanitizeScalar(event.timestamp),
    category: sanitizeScalar(event.category),
    eventType: sanitizeScalar(event.eventType),
    severity: sanitizeScalar(event.severity),
    outcome: sanitizeScalar(event.outcome),
    sourceModule: sanitizeScalar(event.sourceModule),
    retentionClass: sanitizeScalar(event.retentionClass),
    redactionClass: sanitizeScalar(event.redactionClass),
    sanitizedSummary: sanitizeScalar(event.sanitizedSummary),
    auditDetailRedacted: true
  };
}

function sanitizeScalar(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return redactAuditString(value);
  if (value === undefined || value === null || typeof value === "number" || typeof value === "boolean") return value ?? null;
  return String(value);
}

function isSecretLikeKey(key: string): boolean {
  return /token|secret|password|authorization|cookie|api[_-]?key|raw[_-]?payload|payload[_-]?raw|session|jwt|credential|private[_-]?key|env[_-]?value/i.test(key);
}

function stableId(prefix: string, parts: Array<string | undefined>): string {
  const segment = parts
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return `${prefix}_${segment || "metadata"}`;
}

function normalizeRole(role: string | undefined): string {
  if (!role) return "";
  return role.toLowerCase().replace(/^role_/, "");
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
