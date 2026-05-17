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

export type ScopedReadModelScopeStatus =
  | "metadata_only"
  | "missing_scope_warning"
  | "scoped_future"
  | "enforcement_future";

export type ScopedReadModelSensitivity =
  | "public_metadata"
  | "internal_metadata"
  | "sensitive_metadata"
  | "secret_adjacent"
  | "never_store_raw";

export type ScopedReadModelMetadata = {
  scopeStatus: ScopedReadModelScopeStatus;
  appliedScopes: string[];
  requiredScopes: string[];
  missingScopes: string[];
  sensitivity: ScopedReadModelSensitivity;
  roleVisibility: DashboardJsonObject;
  redactionStatus: string;
  tenantFilteringImplemented: false;
  productionEnforcementImplemented: false;
  tenantScopeEnforcementImplemented?: false | "partial";
  enforcementMode?: string;
  scopeDecisionSummary?: DashboardJsonObject;
  warnings: string[];
  metadata: DashboardJsonObject;
};

export type DashboardPanelScopeSummary = {
  panelId: string;
  panelName: string;
  requiredScopes: string[];
  availableScopes: string[];
  missingScopes: string[];
  allowedRoles: string[];
  redactionClass: ScopedReadModelSensitivity;
  enforcementStatus: string;
  fallbackBehavior: string;
  warnings: string[];
};

export type ReadinessEndpointScopeSummary = {
  endpointGroup: string;
  endpointPattern: string;
  requiredScopes: string[];
  availableScopes: string[];
  missingScopes: string[];
  allowedRoles: string[];
  redactionClass: ScopedReadModelSensitivity;
  enforcementStatus: string;
  fallbackBehavior: string;
  warnings: string[];
};

export type TenantScopeEnforcementReadModel = {
  summary: DashboardJsonObject;
  modes: DashboardJsonObject[];
  mismatches: DashboardJsonObject[];
  noSecretStatus: DashboardJsonObject;
};

export type DashboardOverviewReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  generatedAt: string;
  source: DashboardReadModelSource;
  status: "available";
  metrics: DashboardJsonObject;
  sections: Record<string, DashboardSectionReadiness>;
  safety: DashboardSafetyFlags;
  warnings: string[];
};

export type TaskRunSummaryReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  tasks: DashboardJsonObject[];
  taskRuns: DashboardJsonObject[];
  recentTasks: DashboardJsonObject[];
  usageEvents: DashboardJsonObject[];
  warnings: string[];
};

export type GitIntegrationReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
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
  scopeMetadata?: ScopedReadModelMetadata;
  branchLeases: DashboardJsonObject[];
  conflictRisks: DashboardJsonObject[];
  mergeQueue: DashboardJsonObject[];
  mergeSimulations: DashboardJsonObject[];
  summary: DashboardJsonObject;
};

export type RegistryReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
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
  scopeMetadata?: ScopedReadModelMetadata;
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
  scopeMetadata?: ScopedReadModelMetadata;
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
  scopeMetadata?: ScopedReadModelMetadata;
  config: DashboardJsonObject;
  rules: DashboardJsonObject[];
  auditEntries: DashboardJsonObject[];
  blockedExamples: DashboardJsonObject[];
};

export type PolicyBundleReadinessReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  engineOptions: DashboardJsonObject[];
  bundlePlans: DashboardJsonObject[];
  domainMappings: DashboardJsonObject[];
  readinessChecks: DashboardJsonObject[];
  risks: DashboardJsonObject[];
  migrationPhases: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  recommendedPath: DashboardJsonObject;
  reviewWorkflow: DashboardJsonObject;
  testStrategy: DashboardJsonObject;
  rolloutRollback: DashboardJsonObject;
  breakGlass: DashboardJsonObject;
  noExecutionStatus: DashboardJsonObject;
};

export type PolicyShadowEvaluationReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  plan: DashboardJsonObject;
  comparisonRules: DashboardJsonObject[];
  mismatchTaxonomy: DashboardJsonObject[];
  readinessChecks: DashboardJsonObject[];
  reports: DashboardJsonObject[];
  criticalMismatchExamples: DashboardJsonObject[];
  rollout: DashboardJsonObject;
  noExecutionStatus: DashboardJsonObject;
};

export type AuthReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
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

export type AuthRbacProductionReadinessReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  providerOptions: DashboardJsonObject[];
  migrationPhases: DashboardJsonObject[];
  readinessChecks: DashboardJsonObject[];
  risks: DashboardJsonObject[];
  tenantBoundaryPlans: DashboardJsonObject[];
  serviceAccountPlans: DashboardJsonObject[];
  permissionMatrix: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  mockActorStatus: DashboardJsonObject;
  noTokenStatus: DashboardJsonObject;
};

export type ProductionAuthProviderSkeletonReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  configs: DashboardJsonObject[];
  readiness: DashboardJsonObject[];
  sessionBoundary: DashboardJsonObject[];
  identityMapping: DashboardJsonObject[];
  selectedProvider: DashboardJsonObject;
  blockers: DashboardJsonObject[];
  noTokenStatus: DashboardJsonObject;
};

export type EnterpriseProviderReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
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
  scopeMetadata?: ScopedReadModelMetadata;
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
  scopeMetadata?: ScopedReadModelMetadata;
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
  scopeMetadata?: ScopedReadModelMetadata;
  config: DashboardJsonObject;
  servers: DashboardJsonObject[];
  tools: DashboardJsonObject[];
  riskSummary: DashboardJsonObject;
  invocations: DashboardJsonObject[];
  auditEvents: DashboardJsonObject[];
  blockedExamples: DashboardJsonObject[];
  integration: DashboardJsonObject;
};

export type ScopeReadinessReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  tenants: DashboardJsonObject[];
  teams: DashboardJsonObject[];
  projects: DashboardJsonObject[];
  repos: DashboardJsonObject[];
  providers: DashboardJsonObject[];
  models: DashboardJsonObject[];
  secrets: DashboardJsonObject[];
  mcpTools: DashboardJsonObject[];
  registryPackages: DashboardJsonObject[];
  localAgentHosts: DashboardJsonObject[];
  auditQueries: DashboardJsonObject[];
  enforcement: DashboardJsonObject;
  noSecretStatus: DashboardJsonObject;
};

export type DashboardTenantScopePlanningReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  dashboardPlans: DashboardJsonObject[];
  readinessPlans: DashboardJsonObject[];
  panelScopeSummaries: DashboardPanelScopeSummary[];
  readinessScopeSummaries: ReadinessEndpointScopeSummary[];
  enforcementSummary?: DashboardJsonObject;
  enforcementModes?: DashboardJsonObject[];
  enforcementMismatches?: DashboardJsonObject[];
  roleVisibility: DashboardJsonObject[];
  fallbackBehavior: DashboardJsonObject[];
  noSecretStatus: DashboardJsonObject;
};

export type DeploymentReadinessReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
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
  scopeMetadata?: ScopedReadModelMetadata;
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
  scopeMetadata?: ScopedReadModelMetadata;
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

export type SecretBackendDecisionReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  decision: DashboardJsonObject;
  criteria: DashboardJsonObject[];
  scores: DashboardJsonObject[];
  implementationScopes: DashboardJsonObject[];
  providerMappings: DashboardJsonObject[];
  risks: DashboardJsonObject[];
  backendScoreSummary: DashboardJsonObject[];
  envFallbackWarning: DashboardJsonObject;
  noSecretStatus: DashboardJsonObject;
};

export type VaultSecretBackendReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  config: DashboardJsonObject;
  health: DashboardJsonObject;
  checks: DashboardJsonObject[];
  auditEvents: DashboardJsonObject[];
  secretRefExamples: DashboardJsonObject[];
  blockedExamples: DashboardJsonObject[];
  noSecretStatus: DashboardJsonObject;
};

export type StagingDeploymentReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  profile: DashboardJsonObject;
  integrationGates: DashboardJsonObject[];
  readinessChecks: DashboardJsonObject[];
  promotionCriteria: DashboardJsonObject[];
  rollbackCriteria: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  warnings: DashboardJsonObject[];
  noSecretStatus: DashboardJsonObject;
};

export type StagingDeploymentDryRunReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  profile: DashboardJsonObject;
  sources: DashboardJsonObject[];
  requiredSources: DashboardJsonObject[];
  optionalSources: DashboardJsonObject[];
  checks: DashboardJsonObject[];
  requiredChecks: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  criticalBlockers: DashboardJsonObject[];
  warnings: DashboardJsonObject[];
  skippedIntegrationProfiles: DashboardJsonObject[];
  integrationProfiles: DashboardJsonObject[];
  recommendedNextActions: string[];
  promotionGuidance: string[];
  rollbackGuidance: string[];
  noSecretStatus: DashboardJsonObject;
};

export type StagingReleaseCandidateReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  checklist: DashboardJsonObject;
  gates: DashboardJsonObject[];
  requiredGates: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  criticalBlockers: DashboardJsonObject[];
  signoffs: DashboardJsonObject[];
  pendingSignoffs: DashboardJsonObject[];
  releaseNoteRequirements: DashboardJsonObject[];
  missingReleaseNoteRequirements: DashboardJsonObject[];
  rollbackChecklist: DashboardJsonObject[];
  missingRollbackItems: DashboardJsonObject[];
  skippedTests: string[];
  recommendedNextActions: string[];
  noSecretStatus: DashboardJsonObject;
};

export type StagingDeploymentExecutionReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  plan: DashboardJsonObject;
  steps: DashboardJsonObject[];
  gates: DashboardJsonObject[];
  requiredGates: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  warnings: DashboardJsonObject[];
  goNoGoDecision: DashboardJsonObject;
  signoffPack: DashboardJsonObject;
  pendingSignoffs: DashboardJsonObject[];
  optionalIntegrationDecisions: DashboardJsonObject[];
  rollbackPlan: DashboardJsonObject;
  rollbackSteps: DashboardJsonObject[];
  recommendedNextActions: string[];
  noSecretStatus: DashboardJsonObject;
};

export type CICDPipelineReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  profiles: DashboardJsonObject[];
  jobs: DashboardJsonObject[];
  requiredJobs: DashboardJsonObject[];
  optionalJobs: DashboardJsonObject[];
  safetyJobs: DashboardJsonObject[];
  integrationGates: DashboardJsonObject[];
  readinessChecks: DashboardJsonObject[];
  risks: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  stagingPromotion: DashboardJsonObject;
  artifactPolicy: DashboardJsonObject;
  cleanupRollback: DashboardJsonObject;
  noSecretStatus: DashboardJsonObject;
};

export type GitHubAppHardeningReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  runtimeConfig: DashboardJsonObject;
  runtimeInstallations: DashboardJsonObject[];
  runtimeRepositoryGrants: DashboardJsonObject[];
  tokenReadiness: DashboardJsonObject;
  runtimeAuditEvents: DashboardJsonObject[];
  controlledImplementation: DashboardJsonObject;
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

export type GitHubAppIntegrationTestReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  profile: DashboardJsonObject;
  testCases: DashboardJsonObject[];
  gatedLiveTestCases: DashboardJsonObject[];
  fixtureTestCases: DashboardJsonObject[];
  safetyChecks: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  warnings: DashboardJsonObject[];
  cleanupPolicy: DashboardJsonObject;
  noSecretStatus: DashboardJsonObject;
};

export type LLMIntegrationTestReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  profile: DashboardJsonObject;
  testCases: DashboardJsonObject[];
  gatedLiveTestCases: DashboardJsonObject[];
  mockTestCases: DashboardJsonObject[];
  safetyChecks: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  warnings: DashboardJsonObject[];
  gateStatus: DashboardJsonObject;
  noSecretStatus: DashboardJsonObject;
};

export type VaultIntegrationTestReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
  summary: DashboardJsonObject;
  profile: DashboardJsonObject;
  testCases: DashboardJsonObject[];
  gatedLiveTestCases: DashboardJsonObject[];
  mockTestCases: DashboardJsonObject[];
  safetyChecks: DashboardJsonObject[];
  blockers: DashboardJsonObject[];
  warnings: DashboardJsonObject[];
  gateStatus: DashboardJsonObject;
  operationPolicy: DashboardJsonObject;
  noSecretStatus: DashboardJsonObject;
};

export type ObservabilityReadModel = {
  scopeMetadata?: ScopedReadModelMetadata;
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
  scopeMetadata?: ScopedReadModelMetadata;
  auditGroups: DashboardJsonObject[];
  recentEvents: DashboardJsonObject[];
  summary: DashboardJsonObject;
};

export type DashboardReadModels = {
  overview: DashboardOverviewReadModel;
  tasks: TaskRunSummaryReadModel;
  git: GitIntegrationReadModel;
  githubApp: GitHubAppHardeningReadModel;
  githubAppIntegration: GitHubAppIntegrationTestReadModel;
  conflicts: ConflictManagerReadModel;
  registry: RegistryReadModel;
  llm: LLMGatewayReadModel;
  llmIntegration: LLMIntegrationTestReadModel;
  vaultIntegration: VaultIntegrationTestReadModel;
  agents: AgentRunnerReadModel;
  policy: PolicyReadModel;
  policyBundles: PolicyBundleReadinessReadModel;
  policyShadow: PolicyShadowEvaluationReadModel;
  auth: AuthReadModel;
  authProduction: AuthRbacProductionReadinessReadModel;
  authProviders: ProductionAuthProviderSkeletonReadModel;
  providers: EnterpriseProviderReadModel;
  security: SecurityReadModel;
  localAgents: LocalAgentReadModel;
  mcp: MCPGatewayReadModel;
  scopes: ScopeReadinessReadModel;
  tenantScopePlanning: DashboardTenantScopePlanningReadModel;
  tenantScopeEnforcement: TenantScopeEnforcementReadModel;
  readiness: DeploymentReadinessReadModel;
  database: DatabaseOperationsReadModel;
  secretBackend: SecretBackendMigrationReadModel;
  secretBackendDecision: SecretBackendDecisionReadModel;
  vaultSecretBackend: VaultSecretBackendReadModel;
  staging: StagingDeploymentReadModel;
  stagingDryRun: StagingDeploymentDryRunReadModel;
  stagingReleaseCandidate: StagingReleaseCandidateReadModel;
  stagingExecution: StagingDeploymentExecutionReadModel;
  cicd: CICDPipelineReadModel;
  observability: ObservabilityReadModel;
  audit: AuditSummaryReadModel;
};

export const dashboardReadModelEndpoints = [
  "/dashboard/overview",
  "/dashboard/tasks",
  "/dashboard/git",
  "/dashboard/github-app",
  "/dashboard/github-app-integration",
  "/dashboard/conflicts",
  "/dashboard/registry",
  "/dashboard/llm",
  "/dashboard/llm-integration",
  "/dashboard/vault-integration",
  "/dashboard/agents",
  "/dashboard/policy",
  "/dashboard/policy-bundles",
  "/dashboard/policy-shadow",
  "/dashboard/auth",
  "/dashboard/auth-production",
  "/dashboard/auth-providers",
  "/dashboard/providers",
  "/dashboard/security",
  "/dashboard/local-agents",
  "/dashboard/mcp",
  "/dashboard/scopes",
  "/dashboard/tenant-scope",
  "/dashboard/tenant-enforcement",
  "/dashboard/readiness",
  "/dashboard/database",
  "/dashboard/secret-backend",
  "/dashboard/secret-backend-decision",
  "/dashboard/vault-secret-backend",
  "/dashboard/staging",
  "/dashboard/staging-dry-run",
  "/dashboard/staging-rc",
  "/dashboard/staging-execution",
  "/dashboard/ci-cd",
  "/dashboard/observability",
  "/dashboard/audit"
] as const;

const sensitiveKeyPattern = /^(token|accessToken|refreshToken|apiKey|api_key|authorization|password|rawSecret|secretValue|credentialValue|privateKey|private_key|databaseUrl|database_url|connectionString|postgresUrl|clientSecret|vaultToken|secretAccessKey|session|sessionId|cookie|assertion|idToken|samlAssertion)$/i;
const tokenLikePattern = /(Bearer\s+)[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{6,}|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|hvs\.[A-Za-z0-9_-]+|hvb\.[A-Za-z0-9_-]+|postgres(?:ql)?:\/\/[^\s"']+|((?:OPENAI_API_KEY|ANTHROPIC_API_KEY|AICHESTRA_LLM_API_KEY|LLM_API_KEY|GITHUB_TOKEN|AICHESTRA_GITHUB_TOKEN|AICHESTRA_GITHUB_WEBHOOK_SECRET|GITHUB_APP_PRIVATE_KEY|PRIVATE_KEY|DATABASE_URL|AICHESTRA_DATABASE_URL|AICHESTRA_TEST_DATABASE_URL|SESSION_SECRET|JWT_SECRET|VAULT_TOKEN|AICHESTRA_VAULT_TOKEN|AWS_SECRET_ACCESS_KEY|AWS_SECRET|GCP_SECRET|AZURE_KEY|AZURE_CLIENT_SECRET|OKTA_TOKEN|AUTH0_CLIENT_SECRET|ENTRA_CLIENT_SECRET|GOOGLE_WORKSPACE_TOKEN|SAML_ASSERTION|OIDC_ID_TOKEN|SCIM_TOKEN|[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY|SESSION|COOKIE))=)[^\s"']+/g;
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
