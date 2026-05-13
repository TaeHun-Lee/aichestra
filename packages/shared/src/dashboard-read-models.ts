export type DashboardJsonPrimitive = string | number | boolean | null;

export type DashboardJsonValue =
  | DashboardJsonPrimitive
  | DashboardJsonValue[]
  | { [key: string]: DashboardJsonValue };

export type DashboardJsonObject = { [key: string]: DashboardJsonValue };

export type DashboardReadModelSource = "api" | "demo";

export type DashboardSectionStatus = "available" | "empty" | "degraded";

export type DashboardSectionReadiness = {
  status: DashboardSectionStatus;
  count: number;
  notes: string[];
};

export type DashboardSafetyFlags = {
  remoteGitEnabled: boolean;
  remoteBranchCreateEnabled: boolean;
  remotePullRequestCreateEnabled: boolean;
  remoteMergeEnabled: false;
  remoteLlmEnabled: boolean;
  remoteLlmCompletionEnabled: boolean;
  localRunnerEnabled: boolean;
  localCommandExecutionEnabled: boolean;
  realTransportEnabled: false;
  vendorCliExecutionEnabled: false;
  credentialCacheAccessAllowed: false;
  productionSecretInjection: false;
  mcpRealTransportEnabled: false;
  noSecretsExposed: true;
};

export type DashboardOverviewReadModel = {
  generatedAt: string;
  source: DashboardReadModelSource;
  status: "available";
  metrics: DashboardJsonObject;
  sections: Record<string, DashboardSectionReadiness>;
  safety: DashboardSafetyFlags;
  warnings: string[];
};

export type TaskRunSummaryReadModel = {
  tasks: DashboardJsonObject[];
  taskRuns: DashboardJsonObject[];
  recentTasks: DashboardJsonObject[];
  usageEvents: DashboardJsonObject[];
  warnings: string[];
};

export type GitIntegrationReadModel = {
  config: DashboardJsonObject;
  webhookConfig: DashboardJsonObject;
  providers: DashboardJsonObject[];
  repos: DashboardJsonObject[];
  branchRecords: DashboardJsonObject[];
  pullRequests: DashboardJsonObject[];
  webhookEvents: DashboardJsonObject[];
  webhookAuditEvents: DashboardJsonObject[];
  pullRequestSyncStates: DashboardJsonObject[];
  branchSyncStates: DashboardJsonObject[];
  changedFiles: DashboardJsonObject[];
  changedFilesRefreshStatus: DashboardJsonObject;
  mergeQueueLinkage: DashboardJsonObject[];
  auditEvents: DashboardJsonObject[];
  remoteAuditEvents: DashboardJsonObject[];
  blockedExamples: DashboardJsonObject[];
  safety: DashboardJsonObject;
};

export type ConflictManagerReadModel = {
  branchLeases: DashboardJsonObject[];
  conflictRisks: DashboardJsonObject[];
  mergeQueue: DashboardJsonObject[];
  mergeSimulations: DashboardJsonObject[];
  summary: DashboardJsonObject;
};

export type RegistryReadModel = {
  summary: DashboardJsonObject;
  skills: DashboardJsonObject[];
  harnesses: DashboardJsonObject[];
  instructions: DashboardJsonObject[];
  approvalQueue: DashboardJsonObject[];
  packages: DashboardJsonObject[];
  auditLogs: DashboardJsonObject[];
  revisions: DashboardJsonObject[];
  evalResults: DashboardJsonObject[];
  governance: DashboardJsonObject;
};

export type LLMGatewayReadModel = {
  config: DashboardJsonObject;
  providers: DashboardJsonObject[];
  routes: DashboardJsonObject[];
  routing: DashboardJsonObject;
  providerHealth: DashboardJsonObject[];
  fallbackPolicies: DashboardJsonObject[];
  routingDecisions: DashboardJsonObject[];
  fallbackAttempts: DashboardJsonObject[];
  models: DashboardJsonObject[];
  virtualKeys: DashboardJsonObject[];
  usageEvents: DashboardJsonObject[];
  auditEvents: DashboardJsonObject[];
  blockedExamples: DashboardJsonObject[];
  budget: DashboardJsonObject;
};

export type AgentRunnerReadModel = {
  config: DashboardJsonObject;
  runners: DashboardJsonObject[];
  executors: DashboardJsonObject[];
  runs: DashboardJsonObject[];
  auditEvents: DashboardJsonObject[];
  instructionAssemblies: DashboardJsonObject[];
  commandResults: DashboardJsonObject[];
  workspaces: DashboardJsonObject[];
  blockedExamples: DashboardJsonObject[];
};

export type PolicyReadModel = {
  config: DashboardJsonObject;
  rules: DashboardJsonObject[];
  auditEntries: DashboardJsonObject[];
  blockedExamples: DashboardJsonObject[];
};

export type AuthReadModel = {
  config: DashboardJsonObject;
  currentActor: DashboardJsonObject;
  principals: DashboardJsonObject[];
  actors: DashboardJsonObject[];
  teams: DashboardJsonObject[];
  roles: DashboardJsonObject[];
  permissions: DashboardJsonObject[];
  roleBindings: DashboardJsonObject[];
  serviceAccounts: DashboardJsonObject[];
  identityProviders: DashboardJsonObject[];
  auditEvents: DashboardJsonObject[];
  authorizationExamples: DashboardJsonObject[];
  warning: string;
};

export type EnterpriseProviderReadModel = {
  config: DashboardJsonObject;
  catalog: DashboardJsonObject[];
  authTypes: string[];
  localCliTemplates: DashboardJsonObject[];
  localAgents: DashboardJsonObject[];
  auditEvents: DashboardJsonObject[];
  readiness: DashboardJsonObject;
  blockedExamples: DashboardJsonObject[];
};

export type SecurityReadModel = {
  config: DashboardJsonObject;
  secretRefs: DashboardJsonObject[];
  secretScopes: DashboardJsonObject[];
  secretLeases: DashboardJsonObject[];
  sandboxProfiles: DashboardJsonObject[];
  sandboxSessions: DashboardJsonObject[];
  networkPolicies: DashboardJsonObject[];
  redactionPolicies: DashboardJsonObject[];
  auditEvents: DashboardJsonObject[];
  credentialAuditEvents: DashboardJsonObject[];
  credentialStatus: DashboardJsonObject;
  blockedExamples: DashboardJsonObject[];
  redaction: DashboardJsonObject;
};

export type LocalAgentReadModel = {
  config: DashboardJsonObject;
  registrations: DashboardJsonObject[];
  sessions: DashboardJsonObject[];
  channels: DashboardJsonObject[];
  handshakes: DashboardJsonObject[];
  capabilityAdvertisements: DashboardJsonObject[];
  compatibilityEntries: DashboardJsonObject[];
  compatibilityResults: DashboardJsonObject[];
  consentQueue: DashboardJsonObject[];
  consentHistory: DashboardJsonObject;
  invocations: DashboardJsonObject[];
  events: DashboardJsonObject[];
  streams: DashboardJsonObject[];
  streamEvents: DashboardJsonObject[];
  auditEvents: DashboardJsonObject[];
  blockedExamples: DashboardJsonObject[];
};

export type MCPGatewayReadModel = {
  config: DashboardJsonObject;
  servers: DashboardJsonObject[];
  tools: DashboardJsonObject[];
  riskSummary: DashboardJsonObject;
  invocations: DashboardJsonObject[];
  auditEvents: DashboardJsonObject[];
  blockedExamples: DashboardJsonObject[];
  integration: DashboardJsonObject;
};

export type DeploymentReadinessReadModel = {
  summary: DashboardJsonObject;
  profiles: DashboardJsonObject[];
  checks: DashboardJsonObject[];
  risks: DashboardJsonObject[];
  productionBlockers: DashboardJsonObject[];
  environmentWarnings: string[];
  missingProductionRequirements: string[];
  noSecretsExposed: true;
};

export type DatabaseOperationsReadModel = {
  summary: DashboardJsonObject;
  profiles: DashboardJsonObject[];
  checks: DashboardJsonObject[];
  risks: DashboardJsonObject[];
  migrations: DashboardJsonObject[];
  schemaInventory: DashboardJsonObject[];
  indexReview: DashboardJsonObject[];
  retentionPlan: DashboardJsonObject;
  auditGrowthPlan: DashboardJsonObject;
  webhookPersistencePlan: DashboardJsonObject;
  criticalRisks: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  noSecretStatus: DashboardJsonObject;
};

export type SecretBackendMigrationReadModel = {
  summary: DashboardJsonObject;
  backendOptions: DashboardJsonObject[];
  migrationPhases: DashboardJsonObject[];
  readinessChecks: DashboardJsonObject[];
  risks: DashboardJsonObject[];
  rotationPlans: DashboardJsonObject[];
  leasePolicies: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  credentialKindStatus: DashboardJsonObject[];
  envFallback: DashboardJsonObject;
  noSecretStatus: DashboardJsonObject;
};

export type GitHubAppHardeningReadModel = {
  summary: DashboardJsonObject;
  appDescriptors: DashboardJsonObject[];
  installations: DashboardJsonObject[];
  repositoryGrants: DashboardJsonObject[];
  permissionMatrix: DashboardJsonObject[];
  webhookEventAllowlist: DashboardJsonObject[];
  replayProtection: DashboardJsonObject;
  webhookDeliveries: DashboardJsonObject[];
  deadLetterPlan: DashboardJsonObject;
  deadLetterRecords: DashboardJsonObject[];
  credentialReadiness: DashboardJsonObject;
  productionEndpoint: DashboardJsonObject;
  readinessChecks: DashboardJsonObject[];
  productionRisks: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  noSecretStatus: DashboardJsonObject;
};

export type ObservabilityReadModel = {
  config: DashboardJsonObject;
  auditSummary: DashboardJsonObject;
  recentEvents: DashboardJsonObject[];
  recentSecurityEvents: DashboardJsonObject[];
  deniedOrBlockedEvents: DashboardJsonObject[];
  retentionClasses: DashboardJsonObject[];
  redactionClasses: DashboardJsonObject[];
  retentionPolicies: DashboardJsonObject[];
  metricDefinitions: DashboardJsonObject[];
  metricSnapshot: DashboardJsonObject;
  traceSpans: DashboardJsonObject[];
  traceSummary: DashboardJsonObject;
  sourceCoverage: DashboardJsonObject[];
  productionReadinessBlockers: DashboardJsonObject[];
  noSecretStatus: DashboardJsonObject;
};

export type AuditSummaryReadModel = {
  auditGroups: DashboardJsonObject[];
  recentEvents: DashboardJsonObject[];
  summary: DashboardJsonObject;
};

export type DashboardReadModels = {
  overview: DashboardOverviewReadModel;
  tasks: TaskRunSummaryReadModel;
  git: GitIntegrationReadModel;
  githubApp: GitHubAppHardeningReadModel;
  conflicts: ConflictManagerReadModel;
  registry: RegistryReadModel;
  llm: LLMGatewayReadModel;
  agents: AgentRunnerReadModel;
  policy: PolicyReadModel;
  auth: AuthReadModel;
  providers: EnterpriseProviderReadModel;
  security: SecurityReadModel;
  localAgents: LocalAgentReadModel;
  mcp: MCPGatewayReadModel;
  readiness: DeploymentReadinessReadModel;
  database: DatabaseOperationsReadModel;
  secretBackend: SecretBackendMigrationReadModel;
  observability: ObservabilityReadModel;
  audit: AuditSummaryReadModel;
};

export const dashboardReadModelEndpoints = [
  "/dashboard/overview",
  "/dashboard/tasks",
  "/dashboard/git",
  "/dashboard/github-app",
  "/dashboard/conflicts",
  "/dashboard/registry",
  "/dashboard/llm",
  "/dashboard/agents",
  "/dashboard/policy",
  "/dashboard/auth",
  "/dashboard/providers",
  "/dashboard/security",
  "/dashboard/local-agents",
  "/dashboard/mcp",
  "/dashboard/readiness",
  "/dashboard/database",
  "/dashboard/secret-backend",
  "/dashboard/observability",
  "/dashboard/audit"
] as const;

const sensitiveKeyPattern = /^(token|accessToken|refreshToken|apiKey|api_key|authorization|password|rawSecret|secretValue|credentialValue|privateKey|private_key|databaseUrl|database_url|connectionString|postgresUrl|clientSecret|vaultToken|secretAccessKey)$/i;
const tokenLikePattern = /(Bearer\s+)[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{6,}|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|postgres(?:ql)?:\/\/[^\s"']+|((?:OPENAI_API_KEY|ANTHROPIC_API_KEY|AICHESTRA_LLM_API_KEY|LLM_API_KEY|GITHUB_TOKEN|AICHESTRA_GITHUB_TOKEN|AICHESTRA_GITHUB_WEBHOOK_SECRET|GITHUB_APP_PRIVATE_KEY|PRIVATE_KEY|DATABASE_URL|AICHESTRA_DATABASE_URL|AICHESTRA_TEST_DATABASE_URL|SESSION_SECRET|JWT_SECRET|VAULT_TOKEN|AWS_SECRET_ACCESS_KEY|AWS_SECRET|GCP_SECRET|AZURE_KEY|AZURE_CLIENT_SECRET|[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY))=)[^\s"']+/g;
const credentialCachePattern = /~\/\.codex\/auth\.json|~\/\.claude[^\s"']*|Google credential cache/gi;

export function sanitizeDashboardValue(value: unknown): DashboardJsonValue {
  if (value === undefined) return null;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value
      .replaceAll(tokenLikePattern, (match, bearerPrefix, envPrefix) => {
        if (bearerPrefix) return `${bearerPrefix}[redacted]`;
        if (envPrefix) return "[redacted]";
        return "[redacted]";
      })
      .replaceAll(credentialCachePattern, "[redacted-credential-cache]");
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => sanitizeDashboardValue(item));
  if (typeof value === "object") {
    const sanitized: DashboardJsonObject = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      sanitized[key] = sensitiveKeyPattern.test(key) ? "[redacted]" : sanitizeDashboardValue(child);
    }
    return sanitized;
  }
  return String(value);
}

export function sanitizeDashboardObject(value: unknown): DashboardJsonObject {
  const sanitized = sanitizeDashboardValue(value);
  return typeof sanitized === "object" && sanitized !== null && !Array.isArray(sanitized) ? sanitized : {};
}

export function sanitizeDashboardArray(value: unknown): DashboardJsonObject[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => sanitizeDashboardObject(item));
}
