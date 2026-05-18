import type {
  AuditRedactionClass,
  AuditRetentionClass,
  AuditRetentionPolicy,
  MetricDefinition
} from "./types.ts";

export const defaultAuditRetentionClasses: AuditRetentionClass[] = [
  {
    id: "short_debug",
    name: "short_debug",
    description: "Short-lived debug and demo metadata.",
    defaultTtlDays: 7,
    exportable: false,
    deleteEligible: true,
    requiresLegalReview: false,
    metadata: { productionReady: false }
  },
  {
    id: "operational",
    name: "operational",
    description: "Operational audit and status records for local and integration use.",
    defaultTtlDays: 90,
    exportable: true,
    deleteEligible: true,
    requiresLegalReview: false,
    metadata: { defaultFor: ["git", "llm", "mcp", "runner", "dashboard", "system"] }
  },
  {
    id: "security",
    name: "security",
    description: "Security-relevant authorization, policy, credential, webhook, secret, and sandbox records.",
    defaultTtlDays: 365,
    exportable: true,
    deleteEligible: false,
    requiresLegalReview: true,
    metadata: { longRetention: true }
  },
  {
    id: "compliance",
    name: "compliance",
    description: "Governance, registry mutation, and compliance-relevant audit records.",
    defaultTtlDays: 2555,
    exportable: true,
    deleteEligible: false,
    requiresLegalReview: true,
    metadata: { futureLegalHold: true }
  },
  {
    id: "ephemeral",
    name: "ephemeral",
    description: "Derived metric and trace skeleton data that can be rebuilt from audit sources.",
    defaultTtlDays: 1,
    exportable: false,
    deleteEligible: true,
    requiresLegalReview: false,
    metadata: { derivedOnly: true }
  }
];

export const defaultAuditRedactionClasses: AuditRedactionClass[] = [
  {
    id: "public_metadata",
    name: "public_metadata",
    description: "Low-risk status and count metadata.",
    maskSecrets: true,
    maskTokens: true,
    maskCredentialPaths: true,
    maskPromptContent: false,
    maskToolInput: false,
    maxPreviewBytes: 4096,
    metadata: {}
  },
  {
    id: "internal_metadata",
    name: "internal_metadata",
    description: "Internal operational metadata with standard secret and token masking.",
    maskSecrets: true,
    maskTokens: true,
    maskCredentialPaths: true,
    maskPromptContent: false,
    maskToolInput: false,
    maxPreviewBytes: 4096,
    metadata: {}
  },
  {
    id: "sensitive_metadata",
    name: "sensitive_metadata",
    description: "Sensitive operational metadata with bounded previews.",
    maskSecrets: true,
    maskTokens: true,
    maskCredentialPaths: true,
    maskPromptContent: true,
    maskToolInput: true,
    maxPreviewBytes: 2048,
    metadata: {}
  },
  {
    id: "secret_adjacent",
    name: "secret_adjacent",
    description: "Credential and SecretRef-adjacent metadata. Raw values are never stored.",
    maskSecrets: true,
    maskTokens: true,
    maskCredentialPaths: true,
    maskPromptContent: true,
    maskToolInput: true,
    maxPreviewBytes: 512,
    metadata: { exportControlled: true }
  },
  {
    id: "contains_user_content_redacted",
    name: "contains_user_content_redacted",
    description: "Prompt, output, or tool content where only redacted previews may exist.",
    maskSecrets: true,
    maskTokens: true,
    maskCredentialPaths: true,
    maskPromptContent: true,
    maskToolInput: true,
    maxPreviewBytes: 512,
    metadata: { rawContentAllowed: false }
  },
  {
    id: "never_store_raw",
    name: "never_store_raw",
    description: "Events whose raw payloads, secrets, credentials, or prompt/tool inputs must never be stored.",
    maskSecrets: true,
    maskTokens: true,
    maskCredentialPaths: true,
    maskPromptContent: true,
    maskToolInput: true,
    maxPreviewBytes: 0,
    metadata: { rawPayloadStorageEnabled: false }
  }
];

export const defaultAuditRetentionPolicies: AuditRetentionPolicy[] = [
  {
    id: "retention_security_events",
    name: "Security events long retention",
    retentionClass: "security",
    ttlDays: 365,
    appliesToCategories: ["auth", "policy", "credential", "git_webhook", "security"],
    exportable: true,
    deletionMode: "none",
    legalHoldSupported: true,
    status: "active",
    metadata: { v0DeletesData: false }
  },
  {
    id: "retention_operational_events",
    name: "Operational events medium retention",
    retentionClass: "operational",
    ttlDays: 90,
    appliesToCategories: ["git", "llm", "mcp", "runner", "dashboard", "system"],
    exportable: true,
    deletionMode: "none",
    legalHoldSupported: false,
    status: "active",
    metadata: { v0DeletesData: false }
  },
  {
    id: "retention_debug_demo_events",
    name: "Debug and demo events short retention",
    retentionClass: "short_debug",
    ttlDays: 7,
    appliesToCategories: ["dashboard", "system"],
    exportable: false,
    deletionMode: "none",
    legalHoldSupported: false,
    status: "active",
    metadata: { v0DeletesData: false }
  },
  {
    id: "retention_secret_adjacent_events",
    name: "Secret-adjacent events strict redaction",
    retentionClass: "security",
    ttlDays: 365,
    appliesToCategories: ["credential", "security", "git_webhook"],
    exportable: false,
    deletionMode: "none",
    legalHoldSupported: true,
    status: "active",
    metadata: { redactionClass: "secret_adjacent", v0DeletesData: false }
  },
  {
    id: "retention_redacted_user_content_previews",
    name: "Redacted prompt/output previews short retention",
    retentionClass: "short_debug",
    ttlDays: 14,
    appliesToCategories: ["llm", "mcp", "runner", "local_agent"],
    exportable: false,
    deletionMode: "none",
    legalHoldSupported: false,
    status: "active",
    metadata: { redactionClass: "contains_user_content_redacted", rawContentAllowed: false, v0DeletesData: false }
  }
];

export const defaultMetricDefinitions: MetricDefinition[] = [
  {
    id: "metric_audit_events_total",
    name: "audit.events.total",
    description: "Total normalized audit events visible to the v0 read model.",
    unit: "count",
    category: "audit",
    dimensions: ["sourceModule"],
    aggregation: "sum",
    metadata: { externalExporter: false }
  },
  {
    id: "metric_audit_events_denied_blocked",
    name: "audit.events.denied_blocked",
    description: "Denied or blocked normalized audit events.",
    unit: "count",
    category: "audit",
    dimensions: ["category", "outcome"],
    aggregation: "sum",
    metadata: { externalExporter: false }
  },
  {
    id: "metric_audit_events_security_recent",
    name: "audit.events.security_recent",
    description: "Recent security-relevant audit events.",
    unit: "count",
    category: "security",
    dimensions: ["category"],
    aggregation: "sum",
    metadata: { externalExporter: false }
  },
  {
    id: "metric_audit_source_coverage",
    name: "audit.sources.coverage",
    description: "Number of audit sources covered by the common envelope.",
    unit: "count",
    category: "audit",
    dimensions: ["normalized"],
    aggregation: "sum",
    metadata: { externalExporter: false }
  },
  {
    id: "metric_retention_policies_total",
    name: "retention.policies.total",
    description: "Total modeled retention policies.",
    unit: "count",
    category: "retention",
    dimensions: ["status"],
    aggregation: "sum",
    metadata: { externalExporter: false, deletesData: false }
  },
  {
    id: "metric_traces_spans_total",
    name: "traces.spans.total",
    description: "Total trace skeleton spans derived from audit events.",
    unit: "count",
    category: "trace",
    dimensions: ["status"],
    aggregation: "sum",
    metadata: { externalExporter: false }
  },
  {
    id: "metric_observability_external_exporter_enabled",
    name: "observability.external_exporter.enabled",
    description: "External observability exporter enabled flag. Always zero in v0 and External Observability Export v1 skeleton.",
    unit: "boolean",
    category: "observability",
    dimensions: ["exporter"],
    aggregation: "latest",
    metadata: { externalExporter: false }
  },
  {
    id: "metric_github_webhook_deliveries_received",
    name: "github.webhook.deliveries.received",
    description: "Planned count of GitHub webhook deliveries received by the hardened endpoint.",
    unit: "count",
    category: "git_webhook",
    dimensions: ["eventType"],
    aggregation: "sum",
    metadata: { plannedOnly: true, externalExporter: false }
  },
  {
    id: "metric_github_webhook_deliveries_verified",
    name: "github.webhook.deliveries.verified",
    description: "Planned count of GitHub webhook deliveries with verified signatures.",
    unit: "count",
    category: "git_webhook",
    dimensions: ["eventType"],
    aggregation: "sum",
    metadata: { plannedOnly: true, externalExporter: false }
  },
  {
    id: "metric_github_webhook_deliveries_rejected",
    name: "github.webhook.deliveries.rejected",
    description: "Planned count of rejected GitHub webhook deliveries.",
    unit: "count",
    category: "git_webhook",
    dimensions: ["reason"],
    aggregation: "sum",
    metadata: { plannedOnly: true, externalExporter: false }
  },
  {
    id: "metric_github_webhook_duplicate_deliveries",
    name: "github.webhook.duplicate_deliveries",
    description: "Planned count of duplicate or replay-rejected webhook deliveries.",
    unit: "count",
    category: "git_webhook",
    dimensions: ["replayStatus"],
    aggregation: "sum",
    metadata: { plannedOnly: true, externalExporter: false }
  },
  {
    id: "metric_github_webhook_dead_letters",
    name: "github.webhook.dead_letters",
    description: "Planned count of webhook deliveries moved to dead-letter review.",
    unit: "count",
    category: "git_webhook",
    dimensions: ["eventType", "retryable"],
    aggregation: "sum",
    metadata: { plannedOnly: true, externalExporter: false }
  },
  {
    id: "metric_github_pr_sync_success",
    name: "github.pr_sync.success",
    description: "Planned count of successful GitHub PR sync read-model updates.",
    unit: "count",
    category: "git",
    dimensions: ["repoRef"],
    aggregation: "sum",
    metadata: { plannedOnly: true, externalExporter: false }
  },
  {
    id: "metric_github_pr_sync_failure",
    name: "github.pr_sync.failure",
    description: "Planned count of failed GitHub PR sync read-model updates.",
    unit: "count",
    category: "git",
    dimensions: ["repoRef", "reason"],
    aggregation: "sum",
    metadata: { plannedOnly: true, externalExporter: false }
  },
  {
    id: "metric_github_branch_sync_success",
    name: "github.branch_sync.success",
    description: "Planned count of successful GitHub branch sync read-model updates.",
    unit: "count",
    category: "git",
    dimensions: ["repoRef"],
    aggregation: "sum",
    metadata: { plannedOnly: true, externalExporter: false }
  },
  {
    id: "metric_github_branch_sync_failure",
    name: "github.branch_sync.failure",
    description: "Planned count of failed GitHub branch sync read-model updates.",
    unit: "count",
    category: "git",
    dimensions: ["repoRef", "reason"],
    aggregation: "sum",
    metadata: { plannedOnly: true, externalExporter: false }
  },
  {
    id: "metric_github_api_rate_limit_warnings",
    name: "github.api.rate_limit_warnings",
    description: "Planned count of future GitHub API rate-limit warnings.",
    unit: "count",
    category: "git",
    dimensions: ["providerId"],
    aggregation: "sum",
    metadata: { plannedOnly: true, externalExporter: false }
  },
  {
    id: "metric_github_webhook_processing_latency_ms",
    name: "github.webhook.processing_latency_ms",
    description: "Planned GitHub webhook processing latency after queue-backed processing exists.",
    unit: "milliseconds",
    category: "git_webhook",
    dimensions: ["eventType", "processingStatus"],
    aggregation: "histogram",
    metadata: { plannedOnly: true, externalExporter: false }
  }
];
