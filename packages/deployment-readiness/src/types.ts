export type DeploymentProfileName = "local" | "integration" | "staging" | "production";
export type DeploymentUnit = "api" | "web" | "worker" | "local-agent" | "migration-job" | "background-job" | "future";
export type ReadinessCheckStatus = "pass" | "fail" | "warning" | "not_applicable" | "not_checked";
export type ReadinessSeverity = "low" | "medium" | "high" | "critical";
export type ProductionRiskLikelihood = "low" | "medium" | "high";
export type ProductionRiskStatus = "open" | "accepted" | "mitigated" | "deferred";
export type StorageMode = "in_memory" | "postgres_optional" | "postgres_required";
export type AuthMode = "mock" | "production_required" | "future_oidc_saml";
export type SecretMode = "metadata_only_env_optional" | "secretref_env" | "real_secret_backend_required";
export type PolicyMode = "static_typescript" | "managed_bundle_required";
export type ObservabilityMode = "local_logs_only" | "required_external_stack";

export type DeploymentProfile = {
  id: DeploymentProfileName;
  name: DeploymentProfileName;
  description: string;
  requiredComponents: DeploymentUnit[];
  requiredEnvVars: string[];
  disabledFeatures: string[];
  allowedProviderKinds: string[];
  storageMode: StorageMode;
  authMode: AuthMode;
  secretMode: SecretMode;
  policyMode: PolicyMode;
  observabilityMode: ObservabilityMode;
  readinessChecks: string[];
  metadata: Record<string, unknown>;
};

export type ReadinessCheck = {
  id: string;
  profileId: DeploymentProfileName;
  category: string;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type ProductionRisk = {
  id: string;
  category: string;
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  owner?: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type DeploymentReadinessEnvironment = {
  requestedProfileId: DeploymentProfileName;
  storageProvider: string;
  databaseConfigured: boolean;
  remoteGitEnabled: boolean;
  githubProviderSelected: boolean;
  githubTokenSecretRefConfigured: boolean;
  githubLegacyTokenConfigured: boolean;
  githubWebhooksEnabled: boolean;
  githubWebhookSecretRefConfigured: boolean;
  githubWebhookLegacySecretConfigured: boolean;
  remoteLlmEnabled: boolean;
  remoteLlmCompletionEnabled: boolean;
  llmProvider: string;
  llmSecretRefConfigured: boolean;
  llmLegacyApiKeyConfigured: boolean;
  llmBaseUrlConfigured: boolean;
  llmRoutingMode: string;
  llmFallbackEnabled: boolean;
  envSecretProviderEnabled: boolean;
  allowedSecretEnvKeyCount: number;
  localAgentRunnerEnabled: boolean;
  localCommandExecutionEnabled: boolean;
  dashboardDataSource: string;
  mcpRealTransportEnabled: false;
  productionAuthEnabled: false;
  realSecretBackendEnabled: false;
  policyBundleRuntimeEnabled: false;
  observabilityBackendConfigured: false;
  auditExportConfigured: false;
  secretsExposed: false;
};

export type DeploymentReadinessSummary = {
  generatedAt: Date;
  currentProfileId: DeploymentProfileName;
  productionReadinessStatus: "planning_only" | "not_ready" | "blocked";
  productionReady: false;
  profileCount: number;
  checkCount: number;
  riskCount: number;
  criticalBlockerCount: number;
  highRiskOpenCount: number;
  checksByStatus: Record<ReadinessCheckStatus, number>;
  risksBySeverity: Record<ReadinessSeverity, number>;
  criticalBlockers: ReadinessCheck[];
  highRiskAreas: ProductionRisk[];
  missingProductionRequirements: string[];
  environmentWarnings: string[];
  environment: DeploymentReadinessEnvironment;
  noSecretsExposed: true;
  metadata: Record<string, unknown>;
};
