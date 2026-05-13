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
export type AuthProviderOptionKind =
  | "oidc"
  | "saml"
  | "scim"
  | "github_enterprise"
  | "google_workspace"
  | "microsoft_entra"
  | "okta"
  | "auth0"
  | "custom"
  | "mock";
export type AuthProviderOptionStatus = "planned" | "recommended" | "future" | "not_recommended" | "disabled";
export type AuthRbacOperationalComplexity = "low" | "medium" | "high";
export type AuthRbacMigrationPhaseStatus = "planned" | "ready_for_design" | "blocked" | "future";
export type AuthRbacReadinessCategory =
  | "identity_provider"
  | "group_sync"
  | "role_mapping"
  | "tenant_isolation"
  | "service_accounts"
  | "local_agent_identity"
  | "webhook_identity"
  | "request_context"
  | "audit_attribution"
  | "mock_actor_deprecation"
  | "policy_subject_mapping"
  | "dashboard_visibility"
  | "break_glass";
export type TenantBoundaryKind = "organization" | "workspace" | "team" | "project" | "repo_scope";
export type TenantBoundaryPlanStatus = "planned" | "future" | "not_ready";
export type ServiceAccountPlanKind =
  | "worker"
  | "git_webhook"
  | "git_provider"
  | "llm_gateway"
  | "mcp_gateway"
  | "local_agent_protocol"
  | "deployment"
  | "observability_export";
export type ServiceAccountPlanStatus = "planned" | "future" | "not_ready";
export type ProductionRbacRoleName =
  | "viewer"
  | "developer"
  | "reviewer"
  | "security_admin"
  | "platform_admin"
  | "system_admin"
  | "service_account_runner"
  | "git_webhook_service"
  | "llm_gateway_service"
  | "mcp_gateway_service"
  | "local_agent_user"
  | "local_agent_admin"
  | "audit_reader"
  | "break_glass_admin_future";
export type PolicyEngineOptionKind =
  | "static_typescript_current"
  | "opa_rego"
  | "cedar"
  | "signed_json_yaml_bundle"
  | "custom_future";
export type PolicyEngineOptionStatus = "current" | "planned" | "recommended" | "not_recommended" | "future";
export type PolicyBundleOperationalComplexity = "low" | "medium" | "high";
export type PolicyBundleKind = "opa_bundle" | "cedar_policy_set" | "json_yaml_policy_bundle" | "static_typescript_legacy";
export type PolicyBundlePlanStatus = "planned" | "ready_for_design" | "blocked" | "future";
export type PolicyDomainName =
  | "git"
  | "git_webhook"
  | "llm"
  | "mcp"
  | "runner"
  | "registry"
  | "improvement"
  | "secretref"
  | "secrets_sandbox"
  | "local_agent"
  | "provider"
  | "auth"
  | "dashboard"
  | "deployment_readiness";
export type PolicyDomainMigrationStatus = "current_static" | "mapped" | "gap" | "future";
export type PolicyBundleReadinessCategory =
  | "engine_selection"
  | "bundle_schema"
  | "signing"
  | "review_workflow"
  | "rollout"
  | "rollback"
  | "tests"
  | "audit"
  | "break_glass"
  | "tenant_scoping"
  | "auth_mapping"
  | "secret_policy"
  | "provider_policy"
  | "dashboard";
export type PolicyBundleMigrationPhaseStatus = "planned" | "ready_for_design" | "blocked" | "future";
export type StagingDeploymentStatus = "planned" | "ready_for_internal_validation" | "blocked" | "not_ready";
export type StagingIntegrationKind =
  | "postgres"
  | "github_app"
  | "github_webhook"
  | "llm_remote"
  | "mcp_remote"
  | "local_agent"
  | "secret_backend"
  | "auth_provider"
  | "policy_bundle"
  | "observability_export";
export type StagingIntegrationGateStatus = "allowed" | "blocked" | "gated" | "future";
export type StagingReadinessCategory =
  | "storage"
  | "auth"
  | "secrets"
  | "git"
  | "github_app"
  | "webhook"
  | "llm"
  | "mcp"
  | "runner"
  | "local_agent"
  | "policy"
  | "observability"
  | "dashboard"
  | "ci"
  | "security";
export type StagingCriterionStatus = "pass" | "warning" | "fail" | "not_checked";
export type StagingRollbackCriterionStatus = "planned" | "active_mock" | "future";
export type CICDPipelineProfileName = "local_validation" | "pull_request" | "integration" | "staging" | "release_candidate";
export type CICDPipelineProfileStatus = "planned" | "ready_for_dry_run" | "blocked" | "future";
export type CICDJobCategory =
  | "install"
  | "lint"
  | "typecheck"
  | "test"
  | "build"
  | "security_scan"
  | "secret_scan"
  | "optional_postgres"
  | "optional_remote_git"
  | "optional_github_app"
  | "optional_webhook"
  | "optional_remote_llm"
  | "optional_mcp"
  | "optional_auth"
  | "dashboard_smoke"
  | "readiness_check";
export type CICDJobStatus = "planned" | "active_mock" | "future";
export type CICDIntegrationKind =
  | "postgres"
  | "remote_git"
  | "github_app"
  | "github_webhook"
  | "remote_llm"
  | "remote_mcp"
  | "external_auth"
  | "vendor_cli";
export type CICDReadinessCategory =
  | "node"
  | "package_manager"
  | "validation"
  | "test_profiles"
  | "secrets"
  | "integration_gates"
  | "artifacts"
  | "cleanup"
  | "rollback"
  | "security"
  | "staging_promotion";
export type CICDRiskStatus = "open" | "accepted" | "mitigated" | "deferred";
export type GitHubAppIntegrationTestProfileStatus = "disabled" | "ready_if_configured" | "blocked" | "future";
export type GitHubAppIntegrationTestCaseCategory =
  | "config_validation"
  | "installation_token"
  | "branch_create"
  | "pr_create"
  | "changed_files"
  | "webhook_fixture"
  | "webhook_live_future"
  | "cleanup";
export type GitHubAppIntegrationTestCaseStatus = "planned" | "active_mock" | "gated_live" | "future";
export type GitHubAppIntegrationTestSafetyCategory =
  | "env_gates"
  | "repo_allowlist"
  | "branch_prefix"
  | "secretref"
  | "cleanup"
  | "no_auto_merge"
  | "no_force_push"
  | "no_branch_delete"
  | "audit"
  | "observability";
export type LLMIntegrationTestProfileStatus = "disabled" | "ready_if_configured" | "blocked" | "future";
export type LLMIntegrationTestCaseCategory =
  | "config_validation"
  | "credential_resolution"
  | "model_allowlist"
  | "budget_guard"
  | "mock_completion"
  | "remote_completion"
  | "usage_ledger"
  | "audit_redaction"
  | "fallback_disabled";
export type LLMIntegrationTestCaseStatus = "planned" | "active_mock" | "gated_live" | "future";
export type LLMIntegrationTestSafetyCategory =
  | "env_gates"
  | "secretref"
  | "model_allowlist"
  | "budget"
  | "policy"
  | "auth"
  | "redaction"
  | "audit"
  | "no_streaming"
  | "no_tool_calls"
  | "no_unbounded_fallback";

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

export type AuthProviderOption = {
  id: string;
  providerKind: AuthProviderOptionKind;
  displayName: string;
  status: AuthProviderOptionStatus;
  supportsSso: boolean;
  supportsScim: boolean;
  supportsGroups: boolean;
  supportsServiceAccounts: boolean;
  supportsMfaSignals: boolean;
  supportsDeviceTrust: boolean;
  productionRecommended: boolean;
  operationalComplexity: AuthRbacOperationalComplexity;
  notes: string[];
  metadata: Record<string, unknown>;
};

export type AuthRbacMigrationPhase = {
  id: string;
  name: string;
  order: number;
  sourceMode: string;
  targetMode: string;
  requiredPreconditions: string[];
  migrationSteps: string[];
  validationChecks: string[];
  rollbackPlan: string[];
  status: AuthRbacMigrationPhaseStatus;
  metadata: Record<string, unknown>;
};

export type AuthRbacReadinessCheck = {
  id: string;
  category: AuthRbacReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type AuthRbacProductionRisk = {
  id: string;
  category: AuthRbacReadinessCategory | "actor_attribution" | "identity_operations" | "service_boundary";
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type TenantBoundaryPlan = {
  id: string;
  tenantKind: TenantBoundaryKind;
  description: string;
  isolationRequirements: string[];
  dataAccessRules: string[];
  providerAccessRules: string[];
  secretAccessRules: string[];
  auditRequirements: string[];
  status: TenantBoundaryPlanStatus;
  metadata: Record<string, unknown>;
};

export type ServiceAccountPlan = {
  id: string;
  serviceAccountKind: ServiceAccountPlanKind;
  requiredScopes: string[];
  allowedActions: string[];
  forbiddenActions: string[];
  credentialStrategy: string;
  rotationStrategy: string;
  auditRequirements: string[];
  status: ServiceAccountPlanStatus;
  metadata: Record<string, unknown>;
};

export type AuthRbacPermissionMatrixEntry = {
  id: string;
  roleName: ProductionRbacRoleName;
  purpose: string;
  allowedActions: string[];
  deniedActions: string[];
  requiredScopes: string[];
  riskLevel: ReadinessSeverity;
  productionDefault: "allow" | "deny" | "future_review";
  auditRequirement: string;
  currentImplementationStatus: "implemented_mock" | "partial_mock" | "planned" | "future_only";
  futureWork: string[];
  metadata: Record<string, unknown>;
};

export type AuthRbacProductionSummary = {
  generatedAt: Date;
  status: "v1_implemented";
  planningOnly: true;
  productionReady: false;
  currentProfileId: DeploymentProfileName;
  productionAuthEnabled: false;
  authMode: "mock";
  mockActorEnabled: boolean;
  mockActorWarning: string;
  futureIdpConfigured: false;
  externalIdpCallsEnabled: false;
  realSessionsImplemented: false;
  realJwtIssuanceImplemented: false;
  passwordLoginImplemented: false;
  serviceAccountCredentialIssuanceImplemented: false;
  requestContextPropagationStatus: "partial_mock_only";
  serviceAccountModelReady: boolean;
  tenantScopeModelReady: false;
  policySubjectTenantMappingImplemented: false;
  mockHeaderOverrideProductionReady: false;
  providerOptionCount: number;
  recommendedProviderCount: number;
  migrationPhaseCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  riskCount: number;
  tenantBoundaryPlanCount: number;
  serviceAccountPlanCount: number;
  permissionMatrixRoleCount: number;
  noTokensExposed: true;
  cookiesExposed: false;
  sessionIdsExposed: false;
  passwordsExposed: false;
  rawIdentityAssertionsExposed: false;
  metadata: Record<string, unknown>;
};

export type PolicyEngineOption = {
  id: string;
  engineKind: PolicyEngineOptionKind;
  displayName: string;
  status: PolicyEngineOptionStatus;
  supportsPartialEvaluation: boolean;
  supportsSignedBundles: boolean;
  supportsDecisionLogs: boolean;
  supportsPolicyTests: boolean;
  supportsHumanReadableReview: boolean;
  supportsResourceHierarchy: boolean;
  supportsTenantIsolation: boolean;
  operationalComplexity: PolicyBundleOperationalComplexity;
  productionRecommended: boolean;
  notes: string[];
  metadata: Record<string, unknown>;
};

export type PolicyBundlePlan = {
  id: string;
  name: string;
  bundleKind: PolicyBundleKind;
  status: PolicyBundlePlanStatus;
  targetDomains: PolicyDomainName[];
  versioningStrategy: string;
  signingStrategy: string;
  reviewStrategy: string;
  rolloutStrategy: string;
  rollbackStrategy: string;
  testStrategy: string;
  metadata: Record<string, unknown>;
};

export type PolicyDomainMapping = {
  id: string;
  domain: PolicyDomainName;
  currentImplementation: string;
  futurePolicyBundle: string;
  requiredInputs: string[];
  requiredOutputs: string[];
  migrationStatus: PolicyDomainMigrationStatus;
  riskLevel: ReadinessSeverity;
  metadata: Record<string, unknown>;
};

export type PolicyBundleReadinessCheck = {
  id: string;
  category: PolicyBundleReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type PolicyBundleRisk = {
  id: string;
  category: PolicyBundleReadinessCategory | "runtime_safety" | "policy_governance" | "migration";
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type PolicyBundleMigrationPhase = {
  id: string;
  name: string;
  order: number;
  sourceMode: string;
  targetMode: string;
  domains: PolicyDomainName[];
  requiredPreconditions: string[];
  migrationSteps: string[];
  validationChecks: string[];
  rollbackPlan: string[];
  status: PolicyBundleMigrationPhaseStatus;
  metadata: Record<string, unknown>;
};

export type PolicyBundleReadinessSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  productionReady: false;
  currentEngineKind: "static_typescript_current";
  policyBundleManagementEnabled: false;
  externalPolicyEngineEnabled: false;
  opaIntegrationEnabled: false;
  cedarIntegrationEnabled: false;
  signedBundleSupportEnabled: false;
  signedBundleVerificationEnabled: false;
  dynamicPolicyExecutionEnabled: false;
  remotePolicyLoadingEnabled: false;
  policyRuntimeChanged: false;
  staticPolicyRuleCount: number;
  engineOptionCount: number;
  recommendedEngineCount: number;
  bundlePlanCount: number;
  domainMappingCount: number;
  mappedDomainCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  riskCount: number;
  migrationPhaseCount: number;
  reviewWorkflowStatus: "planned_not_implemented";
  testStrategyStatus: "planned_not_implemented";
  rolloutStatus: "planned_not_implemented";
  rollbackStatus: "planned_not_implemented";
  breakGlassStatus: "planned_not_implemented";
  noSecretsExposed: true;
  policyCodeExecuted: false;
  externalCallsEnabled: false;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentProfile = {
  id: string;
  name: "staging";
  description: string;
  status: StagingDeploymentStatus;
  requiredComponents: DeploymentUnit[];
  requiredEnvGates: string[];
  forbiddenEnvGates: string[];
  allowedIntegrations: StagingIntegrationKind[];
  blockedIntegrations: StagingIntegrationKind[];
  requiredStorageMode: StorageMode;
  requiredAuthMode: AuthMode;
  requiredSecretMode: SecretMode;
  requiredPolicyMode: PolicyMode;
  requiredObservabilityMode: ObservabilityMode;
  readinessChecks: string[];
  productionBlockers: string[];
  metadata: Record<string, unknown>;
};

export type StagingIntegrationGate = {
  id: string;
  integrationKind: StagingIntegrationKind;
  status: StagingIntegrationGateStatus;
  requiredEnvVars: string[];
  forbiddenEnvVars: string[];
  requiredPolicies: string[];
  requiredSecrets: string[];
  notes: string[];
  metadata: Record<string, unknown>;
};

export type StagingReadinessCheck = {
  id: string;
  category: StagingReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type StagingPromotionCriterion = {
  id: string;
  fromProfile: "local" | "integration";
  toProfile: "staging";
  criterion: string;
  required: boolean;
  status: StagingCriterionStatus;
  evidence: string[];
  remediation: string;
  metadata: Record<string, unknown>;
};

export type StagingRollbackCriterion = {
  id: string;
  trigger: string;
  severity: ReadinessSeverity;
  requiredAction: string;
  owner?: string;
  status: StagingRollbackCriterionStatus;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  productionReady: false;
  stagingDeployed: false;
  productionTrafficAllowed: false;
  currentProfileId: DeploymentProfileName;
  profileStatus: StagingDeploymentStatus;
  requiredComponentCount: number;
  requiredEnvGateCount: number;
  forbiddenEnvGateCount: number;
  integrationGateCount: number;
  allowedGateCount: number;
  gatedGateCount: number;
  blockedGateCount: number;
  futureGateCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  warningCount: number;
  promotionCriteriaCount: number;
  promotionCriteriaMetCount: number;
  rollbackCriteriaCount: number;
  mockActorWarning: string;
  envFallbackWarning: string;
  postgresRequired: true;
  apiDashboardRequired: true;
  remoteMergeForbidden: true;
  remoteMcpForbidden: true;
  vendorCliForbidden: true;
  deploymentExecuted: false;
  externalCallsEnabled: false;
  noSecretsExposed: true;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type CICDPipelineProfile = {
  id: string;
  name: CICDPipelineProfileName;
  description: string;
  status: CICDPipelineProfileStatus;
  requiredJobs: string[];
  optionalJobs: string[];
  forbiddenJobs: string[];
  requiredEnvGates: string[];
  forbiddenEnvGates: string[];
  requiredSecrets: string[];
  artifactPolicy: string;
  approvalPolicy: string;
  metadata: Record<string, unknown>;
};

export type CICDJobDefinition = {
  id: string;
  profileId: CICDPipelineProfileName;
  name: string;
  category: CICDJobCategory;
  command: string;
  required: boolean;
  allowedToCallExternalServices: boolean;
  requiresSecrets: boolean;
  requiredEnvVars: string[];
  timeoutMinutes?: number;
  artifacts: string[];
  status: CICDJobStatus;
  metadata: Record<string, unknown>;
};

export type CICDIntegrationTestGate = {
  id: string;
  integrationKind: CICDIntegrationKind;
  enabledByDefault: boolean;
  requiredEnvVars: string[];
  requiredSecrets: string[];
  requiredApprovals: string[];
  cleanupRequired: boolean;
  allowedProfiles: CICDPipelineProfileName[];
  blockedProfiles: CICDPipelineProfileName[];
  riskLevel: ReadinessSeverity;
  metadata: Record<string, unknown>;
};

export type CICDReadinessCheck = {
  id: string;
  category: CICDReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type CICDRisk = {
  id: string;
  category: CICDReadinessCategory | "remote_integration" | "deployment_safety" | "artifact_governance";
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  status: CICDRiskStatus;
  metadata: Record<string, unknown>;
};

export type CICDPipelineReadinessSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  productionReady: false;
  stagingDeployed: false;
  deploymentWorkflowCreated: false;
  activeWorkflowCreated: false;
  externalCallsEnabledByDefault: false;
  remoteIntegrationTestsEnabledByDefault: false;
  secretsExposed: false;
  envValuesExposed: false;
  packageManager: "pnpm";
  expectedNodeVersion: string;
  voltaNodeVersion: string;
  currentNodeVersion: string;
  nodeVersionStatus: "pass" | "warning" | "unknown";
  profileCount: number;
  jobCount: number;
  requiredJobCount: number;
  optionalJobCount: number;
  safetyJobCount: number;
  integrationGateCount: number;
  disabledByDefaultIntegrationGateCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  riskCount: number;
  stagingPromotionReady: false;
  artifactPolicyStatus: "planned_redacted_only";
  cleanupRollbackStatus: "planned_manual_only";
  noSecretScanStatus: "planned_required";
  metadata: Record<string, unknown>;
};

export type GitHubAppIntegrationTestProfile = {
  id: string;
  name: string;
  status: GitHubAppIntegrationTestProfileStatus;
  requiredEnvVars: string[];
  requiredSecretRefs: string[];
  allowedRepos: string[];
  allowedBranchPrefix: string;
  allowedOperations: string[];
  forbiddenOperations: string[];
  cleanupPolicy: string;
  auditRequirements: string[];
  metadata: Record<string, unknown>;
};

export type GitHubAppIntegrationTestCase = {
  id: string;
  profileId: string;
  name: string;
  category: GitHubAppIntegrationTestCaseCategory;
  enabledByDefault: boolean;
  requiresLiveGitHub: boolean;
  requiredEnvVars: string[];
  expectedSideEffects: string[];
  cleanupRequired: boolean;
  status: GitHubAppIntegrationTestCaseStatus;
  metadata: Record<string, unknown>;
};

export type GitHubAppIntegrationTestSafetyCheck = {
  id: string;
  category: GitHubAppIntegrationTestSafetyCategory;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type GitHubAppIntegrationTestReadinessSummary = {
  generatedAt: Date;
  status: "v1_implemented";
  planningOnly: true;
  productionReady: false;
  liveTestsEnabled: boolean;
  canRunLiveTests: boolean;
  defaultLiveTestsSkipped: true;
  requiredGateCount: number;
  configuredGateCount: number;
  missingGateCount: number;
  unsafeGateCount: number;
  missingRequiredEnvVars: string[];
  unsafeGateWarnings: string[];
  allowedRepoCount: number;
  allowedBranchPrefix: "ai/";
  branchPrefixConfigured: boolean;
  branchPrefixMatchesRequired: boolean;
  requiredSecretRefCount: number;
  configuredSecretRefCount: number;
  testCaseCount: number;
  gatedLiveTestCaseCount: number;
  webhookFixtureTestsEnabled: true;
  liveWebhookTestsEnabled: boolean;
  cleanupPolicyStatus: "manual_close_or_mark_only";
  noAutoMerge: true;
  noForcePush: true;
  noBranchDelete: true;
  noSecretsExposed: true;
  envValuesExposed: false;
  privateKeyExposed: false;
  installationTokenExposed: false;
  githubCallsInDefaultTests: false;
  metadata: Record<string, unknown>;
};

export type LLMIntegrationTestProfile = {
  id: string;
  name: string;
  status: LLMIntegrationTestProfileStatus;
  providerKind: "openai_compatible";
  providerId?: string;
  requiredEnvVars: string[];
  requiredSecretRefs: string[];
  allowedModels: string[];
  requiredBudgetLimitUsd: number;
  requiredPolicies: string[];
  allowedOperations: string[];
  forbiddenOperations: string[];
  promptPolicy: string;
  outputPolicy: string;
  auditRequirements: string[];
  metadata: Record<string, unknown>;
};

export type LLMIntegrationTestCase = {
  id: string;
  profileId: string;
  name: string;
  category: LLMIntegrationTestCaseCategory;
  enabledByDefault: boolean;
  requiresRemoteLLM: boolean;
  requiredEnvVars: string[];
  expectedSideEffects: string[];
  cleanupRequired: boolean;
  status: LLMIntegrationTestCaseStatus;
  metadata: Record<string, unknown>;
};

export type LLMIntegrationTestSafetyCheck = {
  id: string;
  category: LLMIntegrationTestSafetyCategory;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type LLMIntegrationTestReadinessSummary = {
  generatedAt: Date;
  status: "v1_implemented";
  planningOnly: true;
  productionReady: false;
  liveTestsEnabled: boolean;
  canRunLiveTests: boolean;
  defaultLiveTestsSkipped: true;
  requiredGateCount: number;
  configuredGateCount: number;
  missingGateCount: number;
  unsafeGateCount: number;
  missingRequiredEnvVars: string[];
  unsafeGateWarnings: string[];
  providerKind: "openai_compatible";
  providerId: "openai_compatible";
  remoteLlmEnabled: boolean;
  remoteCompletionEnabled: boolean;
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  secretRefConfigured: boolean;
  rawEnvApiKeyConfigured: boolean;
  credentialSource: "secret_ref" | "test_env" | "none";
  envSecretProviderEnabled: boolean;
  allowedSecretEnvKeyConfigured: boolean;
  allowedModelCount: number;
  defaultModelConfigured: boolean;
  defaultModelAllowlisted: boolean;
  routingMode: string;
  routingModeAllowed: boolean;
  fallbackEnabled: boolean;
  maxFallbackAttempts: number;
  fallbackSafe: boolean;
  budgetConfigured: boolean;
  budgetLimitUsdConfigured: boolean;
  promptClassConfigured: boolean;
  requiredSecretRefCount: number;
  configuredSecretRefCount: number;
  testCaseCount: number;
  gatedLiveTestCaseCount: number;
  mockTestCaseCount: number;
  noStreaming: true;
  noToolCalls: true;
  noVendorCli: true;
  noCredentialCacheRead: true;
  noSecretsExposed: true;
  envValuesExposed: false;
  apiKeyExposed: false;
  rawProviderResponseExposed: false;
  remoteLlmCallsInDefaultTests: false;
  metadata: Record<string, unknown>;
};
