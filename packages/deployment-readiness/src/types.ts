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
export type GitHubAppDescriptorStatus = "planned" | "configured_mock" | "disabled" | "future_live";
export type GitHubAppInstallationStatus = "planned" | "active_mock" | "suspended" | "removed" | "future_live";
export type GitHubAppAccountType = "user" | "organization" | "enterprise" | "unknown";
export type GitHubRepositorySelection = "all" | "selected" | "unknown";
export type GitHubRepositoryGrantStatus = "allowed" | "blocked" | "removed" | "unknown";
export type GitHubPermissionLevel = "none" | "read" | "write";
export type GitHubPlanningRiskLevel = "low" | "medium" | "high" | "critical";
export type GitHubWebhookEventSupportStatus = "supported_now" | "planned" | "ignored" | "denied";
export type GitHubWebhookReplayStatus = "first_seen" | "duplicate" | "replay_rejected" | "unknown";
export type GitHubWebhookProcessingStatus = "pending" | "processed" | "failed" | "dead_lettered" | "ignored";
export type DatabaseDeploymentProfileName = "local" | "integration" | "staging" | "production";
export type DatabaseOperationsStatus = "planned" | "partial" | "ready_for_testing" | "not_ready";
export type DatabaseReadinessCategory =
  | "connection"
  | "migration"
  | "backup"
  | "restore"
  | "indexes"
  | "retention"
  | "audit_growth"
  | "webhook_dedupe"
  | "pooling"
  | "monitoring";
export type DatabaseMigrationStatusValue = "planned" | "pending" | "applied" | "failed" | "rolled_back" | "unknown";
export type DatabaseIndexReviewStatus = "implemented_in_schema" | "recommended" | "future";
export type DatabaseStorageProviderKind = "in_memory" | "postgres" | "unknown";
export type SecretBackendKind =
  | "vault"
  | "aws_secrets_manager"
  | "gcp_secret_manager"
  | "azure_key_vault"
  | "env_legacy"
  | "mock"
  | "custom_future";
export type SecretBackendOptionStatus = "planned" | "recommended" | "allowed_for_integration" | "not_recommended" | "future";
export type SecretBackendOperationalComplexity = "low" | "medium" | "high";
export type SecretBackendMigrationPhaseStatus = "planned" | "ready_for_design" | "blocked" | "future";
export type SecretBackendReadinessCategory =
  | "backend_selection"
  | "secret_ref_schema"
  | "lease_ttl"
  | "rotation"
  | "audit"
  | "auth_policy"
  | "env_fallback"
  | "provider_integration"
  | "dashboard"
  | "observability"
  | "incident_response";
export type SecretRotationMode = "manual" | "scheduled_future" | "provider_managed_future" | "not_supported";
export type SecretRotationPlanStatus = "planned" | "future" | "not_ready";
export type SecretLeasePolicyStatus = "planned" | "active_mock" | "future";
export type SecretCredentialKind =
  | "github_token"
  | "github_webhook_secret"
  | "llm_api_key"
  | "provider_api_key"
  | "webhook_secret"
  | "future_oauth_token"
  | "future_cloud_identity"
  | "future_mcp_tool_secret"
  | "future_local_agent_pairing_secret"
  | "future_service_account_signing_key"
  | "future_byok_key";

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

export type GitHubAppDescriptor = {
  id: string;
  appSlug: string;
  appId?: string;
  name: string;
  status: GitHubAppDescriptorStatus;
  webhookUrl?: string;
  permissions: Record<string, GitHubPermissionLevel>;
  events: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type GitHubAppInstallation = {
  id: string;
  appDescriptorId: string;
  installationId?: string;
  accountLogin: string;
  accountType: GitHubAppAccountType;
  repositorySelection: GitHubRepositorySelection;
  status: GitHubAppInstallationStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type GitHubAppRepositoryGrant = {
  id: string;
  installationId: string;
  repoOwner: string;
  repoName: string;
  repoId?: string;
  permissions: Record<string, GitHubPermissionLevel>;
  status: GitHubRepositoryGrantStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type GitHubAppPermissionMatrixEntry = {
  id: string;
  githubPermissionName: string;
  requiredLevel: GitHubPermissionLevel;
  requiredFor: string;
  riskLevel: GitHubPlanningRiskLevel;
  productionDefault: "allow" | "deny" | "future_review";
  approvalRequirement: string;
  auditRequirement: string;
  currentlyImplemented: boolean;
  futureOnly: boolean;
  metadata: Record<string, unknown>;
};

export type GitHubWebhookEventAllowlistEntry = {
  id: string;
  eventName: string;
  supportStatus: GitHubWebhookEventSupportStatus;
  actionsHandled: string[];
  signatureVerificationRequired: true;
  idempotencyKey: string;
  sideEffects: string[];
  auditEvents: string[];
  readModelUpdates: string[];
  riskNotes: string[];
  metadata: Record<string, unknown>;
};

export type GitHubWebhookDeliveryRecord = {
  id: string;
  deliveryId: string;
  eventType: string;
  repoRef?: string;
  action?: string;
  receivedAt: Date;
  signatureVerified: boolean;
  replayStatus: GitHubWebhookReplayStatus;
  processingStatus: GitHubWebhookProcessingStatus;
  payloadHash: string;
  attemptCount: number;
  lastAttemptAt?: Date;
  metadata: Record<string, unknown>;
};

export type GitHubWebhookDeadLetterRecord = {
  id: string;
  deliveryId: string;
  eventType: string;
  repoRef?: string;
  reason: string;
  sanitizedPayloadPreview?: string;
  retryable: boolean;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type GitHubWebhookReplayProtectionPlan = {
  id: string;
  status: "planning_only";
  deliveryIdUniqueness: "required";
  payloadHashStrategy: "sha256_metadata_only";
  timestampToleranceSeconds?: number;
  duplicateDeliveryBehavior: string;
  replayRejectedBehavior: string;
  idempotentProcessingBehavior: string;
  persistenceRequirement: string;
  productionReady: false;
  auditEvents: string[];
  testStrategy: string[];
  metadata: Record<string, unknown>;
};

export type GitHubWebhookDeadLetterPlan = {
  id: string;
  status: "planning_only";
  retryableErrors: string[];
  nonRetryableErrors: string[];
  maxRetryAttempts: number;
  backoffStrategy: string;
  manualReviewProcess: string;
  productionReady: false;
  auditEvents: string[];
  observabilityMetrics: string[];
  metadata: Record<string, unknown>;
};

export type GitHubAppCredentialReadiness = {
  id: string;
  status: "planning_only";
  privateKeySecretRefRequired: true;
  privateKeyConfigured: false;
  webhookSecretRefRequired: true;
  webhookSecretConfiguredForProduction: false;
  installationTokenExchangeImplemented: false;
  tokenTtlSeconds: number;
  legacyEnvTokenProductionReady: false;
  migrationSteps: string[];
  auditEvents: string[];
  redactionRequirements: string[];
  noSecretsStored: true;
  metadata: Record<string, unknown>;
};

export type GitHubProductionWebhookEndpointPlan = {
  id: string;
  endpointPath: string;
  status: "planning_only";
  tlsRequired: true;
  rawBodyPreservationRequired: true;
  payloadSizeLimitBytes: number;
  rateLimitStrategy: string;
  queueRequired: true;
  productionReady: false;
  failureModes: string[];
  rolloutSteps: string[];
  metadata: Record<string, unknown>;
};

export type GitHubAppReadinessCheck = {
  id: string;
  category: "permissions" | "credentials" | "webhook_endpoint" | "replay" | "dead_letter" | "observability" | "policy" | "auth" | "storage";
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type GitHubAppProductionRisk = {
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

export type GitHubWebhookHardeningSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  productionReady: false;
  githubAppLiveEnabled: false;
  productionWebhooksEnabled: false;
  externalCallsEnabled: false;
  appDescriptorCount: number;
  installationCount: number;
  repositoryGrantCount: number;
  permissionCount: number;
  webhookEventCount: number;
  supportedNowEventCount: number;
  plannedEventCount: number;
  deniedEventCount: number;
  replayProtectionStatus: "planned_not_production_ready";
  deadLetterStatus: "planned_not_implemented";
  credentialStatus: "github_app_private_key_future_secretref";
  endpointStatus: "planned_not_deployed";
  blockerCount: number;
  riskCount: number;
  noSecretsExposed: true;
  metadata: Record<string, unknown>;
};

export type DatabaseDeploymentProfile = {
  id: DatabaseDeploymentProfileName;
  name: DatabaseDeploymentProfileName;
  storageProvider: DatabaseStorageProviderKind | "postgres_required";
  postgresRequired: boolean;
  migrationsRequired: boolean;
  poolingRequired: boolean;
  backupRequired: boolean;
  restoreTestRequired: boolean;
  retentionPolicyRequired: boolean;
  monitoringRequired: boolean;
  status: DatabaseOperationsStatus;
  metadata: Record<string, unknown>;
};

export type DatabaseReadinessCheck = {
  id: string;
  profileId: DatabaseDeploymentProfileName;
  category: DatabaseReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type DatabaseOperationRisk = {
  id: string;
  category: DatabaseReadinessCategory | "migration_rollback" | "tenant_scope" | "secret_handling";
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type DatabaseMigrationStatus = {
  id: string;
  migrationId: string;
  name: string;
  status: DatabaseMigrationStatusValue;
  checksum?: string;
  appliedAt?: Date;
  metadata: Record<string, unknown>;
};

export type DatabaseSchemaInventoryItem = {
  id: string;
  tableName: string;
  purpose: string;
  ownerModule: string;
  highGrowth: boolean;
  retentionClass?: string;
  keyIndexes: string[];
  missingIndexes: string[];
  metadata: Record<string, unknown>;
};

export type DatabaseIndexReviewItem = {
  id: string;
  tableName: string;
  queryPattern: string;
  recommendedIndex: string;
  uniquenessRequirements: string;
  retentionPartitioningNotes: string;
  status: DatabaseIndexReviewStatus;
  metadata: Record<string, unknown>;
};

export type DatabaseRetentionPlan = {
  id: string;
  status: "planning_only";
  deletionJobsEnabled: false;
  retentionClassesAligned: true;
  partitioningImplemented: false;
  archiveExportImplemented: false;
  legalHoldImplemented: false;
  highGrowthTables: string[];
  retentionClasses: string[];
  operationalRisks: string[];
  metadata: Record<string, unknown>;
};

export type DatabaseAuditGrowthPlan = {
  id: string;
  status: "planning_only";
  highGrowthTables: string[];
  auditCategories: string[];
  partitioningCandidates: string[];
  requiredQueryLimits: string[];
  noDeletionInV1: true;
  metadata: Record<string, unknown>;
};

export type DatabaseWebhookPersistencePlan = {
  id: string;
  status: "planning_only";
  deliveryRecordTable: string;
  deadLetterTable: string;
  deliveryIdUniqueness: "required";
  payloadHashStrategy: "sha256_metadata_only";
  duplicateDetection: string;
  replayRejection: string;
  retryCounterStrategy: string;
  backgroundWorkerImplemented: false;
  rawPayloadStorage: false;
  indexRequirements: string[];
  retentionRequirements: string[];
  observabilityMetrics: string[];
  metadata: Record<string, unknown>;
};

export type DatabaseOperationsSummary = {
  generatedAt: Date;
  status: "v1_implemented";
  planningOnly: true;
  productionReady: false;
  storageProviderKind: DatabaseStorageProviderKind;
  databaseUrlConfigured: boolean;
  testDatabaseUrlConfigured: boolean;
  migrationRunnerAvailable: boolean;
  migrationFileCount: number;
  schemaInventoryCount: number;
  indexReviewItemCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  riskCount: number;
  poolingStatus: "planned_not_enabled";
  backupStatus: "planned_not_configured";
  restoreStatus: "planned_not_tested";
  retentionDeletionJobsEnabled: false;
  productionDbConnectionAttempted: false;
  noSecretsExposed: true;
  databaseUrlExposed: false;
  metadata: Record<string, unknown>;
};

export type SecretBackendOption = {
  id: string;
  backendKind: SecretBackendKind;
  displayName: string;
  status: SecretBackendOptionStatus;
  supportsLease: boolean;
  supportsRotation: boolean;
  supportsVersioning: boolean;
  supportsAudit: boolean;
  supportsIAM: boolean;
  supportsNamespace: boolean;
  supportsReplication: boolean;
  operationalComplexity: SecretBackendOperationalComplexity;
  productionRecommended: boolean;
  notes: string[];
  metadata: Record<string, unknown>;
};

export type SecretBackendMigrationPhase = {
  id: string;
  name: string;
  order: number;
  sourceProvider: SecretBackendKind;
  targetProvider: SecretBackendKind | "selected_real_backend";
  credentialKinds: SecretCredentialKind[];
  requiredPreconditions: string[];
  migrationSteps: string[];
  validationChecks: string[];
  rollbackPlan: string[];
  status: SecretBackendMigrationPhaseStatus;
  metadata: Record<string, unknown>;
};

export type SecretBackendReadinessCheck = {
  id: string;
  category: SecretBackendReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type SecretBackendRisk = {
  id: string;
  category: SecretBackendReadinessCategory | "credential_migration" | "backend_operations" | "provider_identity";
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type SecretRotationPlan = {
  id: string;
  secretKind: SecretCredentialKind;
  backendKind: SecretBackendKind | "selected_real_backend";
  rotationMode: SecretRotationMode;
  targetIntervalDays?: number;
  requiresDowntime: boolean;
  validationChecks: string[];
  rollbackPlan: string[];
  auditRequirements: string[];
  status: SecretRotationPlanStatus;
  metadata: Record<string, unknown>;
};

export type SecretLeasePolicy = {
  id: string;
  secretKind: SecretCredentialKind;
  maxTtlSeconds: number;
  renewable: boolean;
  requiresApproval: boolean;
  allowedActors: string[];
  allowedPurposes: string[];
  status: SecretLeasePolicyStatus;
  metadata: Record<string, unknown>;
};

export type SecretBackendMigrationSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  productionReady: false;
  currentProfileId: DeploymentProfileName;
  realSecretBackendConfigured: false;
  externalCallsEnabled: false;
  credentialResolutionAttempted: false;
  rotationJobsImplemented: false;
  productionCredentialIssuanceImplemented: false;
  credentialCachesRead: false;
  envFallbackAllowedForCurrentProfile: boolean;
  envFallbackWarning: string;
  envSecretProviderEnabled: boolean;
  allowedSecretEnvKeyCount: number;
  legacyEnvFallbackProductionReady: false;
  backendOptionCount: number;
  recommendedBackendCount: number;
  migrationPhaseCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  riskCount: number;
  rotationPlanCount: number;
  leasePolicyCount: number;
  noSecretsExposed: true;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};
