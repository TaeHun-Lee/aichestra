export type AuditCategory =
  | "auth"
  | "policy"
  | "credential"
  | "git"
  | "git_webhook"
  | "llm"
  | "mcp"
  | "runner"
  | "registry"
  | "improvement"
  | "local_agent"
  | "security"
  | "dashboard"
  | "system";

export type AuditSeverity = "debug" | "info" | "warning" | "error" | "critical";

export type AuditOutcome = "success" | "denied" | "blocked" | "failed" | "skipped" | "unknown";

export type AuditRetentionClassName = "short_debug" | "operational" | "security" | "compliance" | "ephemeral";

export type AuditRedactionClassName =
  | "public_metadata"
  | "internal_metadata"
  | "sensitive_metadata"
  | "secret_adjacent"
  | "contains_user_content_redacted"
  | "never_store_raw";

export type AuditEventEnvelope = {
  id: string;
  timestamp: Date;
  category: AuditCategory;
  eventType: string;
  severity: AuditSeverity;
  outcome: AuditOutcome;
  actorId?: string;
  principalId?: string;
  authMode?: string;
  requestId?: string;
  correlationId?: string;
  taskId?: string;
  taskRunId?: string;
  agentRunId?: string;
  repoId?: string;
  providerId?: string;
  providerKind?: string;
  modelId?: string;
  toolId?: string;
  secretRefId?: string;
  policyDecisionId?: string;
  sourceModule: string;
  retentionClass: AuditRetentionClassName;
  redactionClass: AuditRedactionClassName;
  sanitizedSummary: string;
  sanitizedMetadata: Record<string, unknown>;
  createdAt: Date;
};

export type AuditRetentionClass = {
  id: AuditRetentionClassName;
  name: AuditRetentionClassName;
  description: string;
  defaultTtlDays?: number;
  exportable: boolean;
  deleteEligible: boolean;
  requiresLegalReview: boolean;
  metadata: Record<string, unknown>;
};

export type AuditRedactionClass = {
  id: AuditRedactionClassName;
  name: AuditRedactionClassName;
  description: string;
  maskSecrets: boolean;
  maskTokens: boolean;
  maskCredentialPaths: boolean;
  maskPromptContent: boolean;
  maskToolInput: boolean;
  maxPreviewBytes: number;
  metadata: Record<string, unknown>;
};

export type AuditQuery = {
  categories?: AuditCategory[];
  eventTypes?: string[];
  actorId?: string;
  taskId?: string;
  taskRunId?: string;
  providerId?: string;
  outcome?: AuditOutcome;
  severity?: AuditSeverity;
  since?: Date;
  until?: Date;
  limit?: number;
};

export type AuditQueryResult = {
  events: AuditEventEnvelope[];
  total: number;
  truncated: boolean;
  querySummary: Record<string, unknown>;
};

export type AuditSummary = {
  generatedAt: Date;
  totalEvents: number;
  byCategory: Record<AuditCategory, number>;
  byOutcome: Record<AuditOutcome, number>;
  bySeverity: Record<AuditSeverity, number>;
  recentSecurityEvents: AuditEventEnvelope[];
  deniedOrBlockedEvents: AuditEventEnvelope[];
  noSecretsExposed: true;
  metadata: Record<string, unknown>;
};

export type AuditRetentionPolicy = {
  id: string;
  name: string;
  retentionClass: AuditRetentionClassName;
  ttlDays?: number;
  appliesToCategories: AuditCategory[];
  exportable: boolean;
  deletionMode: "none" | "future_manual" | "future_scheduled";
  legalHoldSupported: boolean;
  status: "active" | "disabled";
  metadata: Record<string, unknown>;
};

export type MetricDefinition = {
  id: string;
  name: string;
  description: string;
  unit: string;
  category: string;
  dimensions: string[];
  aggregation: string;
  metadata: Record<string, unknown>;
};

export type MetricPoint = {
  id: string;
  metricName: string;
  value: number;
  dimensions: Record<string, string>;
  timestamp: Date;
};

export type MetricSnapshot = {
  generatedAt: Date;
  definitions: MetricDefinition[];
  points: MetricPoint[];
  externalExporterEnabled: false;
  metadata: Record<string, unknown>;
};

export type TraceSpanStatus = "ok" | "error" | "cancelled" | "unknown";

export type TraceSpan = {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  category: AuditCategory;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: TraceSpanStatus;
  taskId?: string;
  taskRunId?: string;
  providerId?: string;
  metadata: Record<string, unknown>;
};

export type TraceQuery = {
  traceId?: string;
  taskId?: string;
  taskRunId?: string;
  providerId?: string;
  limit?: number;
};

export type CorrelationContext = {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  source: string;
};

export type AuditSourceCoverage = {
  id: string;
  moduleName: string;
  auditSource: string;
  currentRepositoryStorage: string;
  normalized: "yes" | "partial" | "no";
  sourceModule: string;
  category: AuditCategory;
  eventCount: number;
  keyEventTypes: string[];
  sensitiveFields: string[];
  retentionClass: AuditRetentionClassName;
  redactionClass: AuditRedactionClassName;
  missingGaps: string[];
};

export type ObservabilityAuditSources = {
  coreAuditLogs?: unknown[];
  authAuditEvents?: unknown[];
  policyAuditEntries?: unknown[];
  securityAuditEvents?: unknown[];
  gitAuditEvents?: unknown[];
  gitWebhookAuditEvents?: unknown[];
  llmAuditEvents?: unknown[];
  mcpAuditEvents?: unknown[];
  agentRunAuditEvents?: unknown[];
  registryAuditLogs?: unknown[];
  improvementGovernanceAuditEvents?: unknown[];
  localAgentAuditEvents?: unknown[];
  providerAuditEvents?: unknown[];
  deploymentReadinessChecks?: unknown[];
  deploymentRisks?: unknown[];
};

export type ObservabilityConfig = {
  status: "v0_implemented";
  aggregationMode: "in_memory_read_model";
  externalBackendEnabled: false;
  externalExportEnabled: false;
  alertDeliveryEnabled: false;
  retentionDeletionJobsEnabled: false;
  rawPayloadStorageEnabled: false;
  maxQueryLimit: number;
  noSecretsExposed: true;
  metadata: Record<string, unknown>;
};

export type ObservabilityDashboardReadModel = {
  config: ObservabilityConfig;
  auditSummary: AuditSummary;
  recentEvents: AuditEventEnvelope[];
  recentSecurityEvents: AuditEventEnvelope[];
  deniedOrBlockedEvents: AuditEventEnvelope[];
  retentionClasses: AuditRetentionClass[];
  redactionClasses: AuditRedactionClass[];
  retentionPolicies: AuditRetentionPolicy[];
  metricDefinitions: MetricDefinition[];
  metricSnapshot: MetricSnapshot;
  traceSpans: TraceSpan[];
  traceSummary: Record<string, unknown>;
  sourceCoverage: AuditSourceCoverage[];
  productionReadinessBlockers: Record<string, unknown>[];
  noSecretStatus: {
    noSecretsExposed: true;
    rawPayloadsStored: false;
    externalExporterEnabled: false;
    retentionDeletesEnabled: false;
  };
};
