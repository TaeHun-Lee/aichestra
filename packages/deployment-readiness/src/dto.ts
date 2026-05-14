import type {
  AuthProviderOption,
  AuthRbacMigrationPhase,
  AuthRbacPermissionMatrixEntry,
  AuthRbacProductionRisk,
  AuthRbacProductionSummary,
  AuthRbacReadinessCheck,
  CICDIntegrationTestGate,
  CICDJobDefinition,
  CICDPipelineProfile,
  CICDPipelineReadinessSummary,
  CICDReadinessCheck,
  CICDRisk,
  DatabaseAuditGrowthPlan,
  DatabaseDeploymentProfile,
  DatabaseIndexReviewItem,
  DatabaseMigrationStatus,
  DatabaseOperationRisk,
  DatabaseOperationsSummary,
  DatabaseReadinessCheck,
  DatabaseRetentionPlan,
  DatabaseSchemaInventoryItem,
  DatabaseWebhookPersistencePlan,
  DeploymentProfile,
  DeploymentReadinessSummary,
  GitHubAppCredentialReadiness,
  GitHubAppDescriptor,
  GitHubAppIntegrationTestCase,
  GitHubAppIntegrationTestProfile,
  GitHubAppIntegrationTestReadinessSummary,
  GitHubAppIntegrationTestSafetyCheck,
  LLMIntegrationTestCase,
  LLMIntegrationTestProfile,
  LLMIntegrationTestReadinessSummary,
  LLMIntegrationTestSafetyCheck,
  VaultIntegrationTestCase,
  VaultIntegrationTestProfile,
  VaultIntegrationTestReadinessSummary,
  VaultIntegrationTestSafetyCheck,
  GitHubAppInstallation,
  GitHubAppPermissionMatrixEntry,
  GitHubAppProductionRisk,
  GitHubAppReadinessCheck,
  GitHubAppRepositoryGrant,
  GitHubProductionWebhookEndpointPlan,
  GitHubWebhookDeadLetterPlan,
  GitHubWebhookDeadLetterRecord,
  GitHubWebhookDeliveryRecord,
  GitHubWebhookEventAllowlistEntry,
  GitHubWebhookHardeningSummary,
  GitHubWebhookReplayProtectionPlan,
  PolicyBundleMigrationPhase,
  PolicyBundlePlan,
  PolicyBundleReadinessCheck,
  PolicyBundleReadinessSummary,
  PolicyBundleRisk,
  PolicyDomainMapping,
  PolicyEngineOption,
  ProductionRisk,
  ReadinessCheck,
  SecretBackendDecisionCriterion,
  SecretBackendDecisionRisk,
  SecretBackendDecisionScore,
  SecretBackendImplementationScope,
  SecretBackendMigrationPhase,
  SecretBackendMigrationSummary,
  SecretBackendOption,
  SecretBackendOptionDecision,
  SecretBackendOptionDecisionSummary,
  SecretBackendProviderMapping,
  SecretBackendReadinessCheck,
  SecretBackendRisk,
  SecretLeasePolicy,
  SecretRotationPlan,
  ServiceAccountPlan,
  StagingDeploymentDryRunBlocker,
  StagingDeploymentDryRunCheck,
  StagingDeploymentDryRunIntegrationProfileStatus,
  StagingDeploymentDryRunProfile,
  StagingDeploymentDryRunReport,
  StagingDeploymentDryRunSource,
  StagingDeploymentDryRunSummary,
  StagingDeploymentExecutionPlan,
  StagingDeploymentExecutionSummary,
  StagingDeploymentGate,
  StagingDeploymentGoNoGoDecision,
  StagingDeploymentRollbackPlan,
  StagingDeploymentStep,
  StagingDeploymentProfile,
  StagingDeploymentSummary,
  StagingReleaseCandidateBlocker,
  StagingReleaseCandidateChecklist,
  StagingReleaseCandidateGate,
  StagingReleaseCandidateReport,
  StagingReleaseCandidateSignoff,
  StagingReleaseCandidateSummary,
  StagingReleaseNoteRequirement,
  StagingRollbackChecklistItem,
  StagingIntegrationGate,
  StagingPromotionCriterion,
  StagingReadinessCheck,
  StagingRollbackCriterion,
  TenantBoundaryPlan
} from "./types.ts";

const sensitiveKeyPattern = /^(token|accessToken|refreshToken|apiKey|api_key|authorization|password|rawSecret|secretValue|credentialValue|privateKey|private_key|webhookSecret|session|cookie|databaseUrl|database_url|connectionString|postgresUrl|clientSecret|vaultToken|secretAccessKey)$/i;
const secretLikePattern = /(Bearer\s+)[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{6,}|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|postgres(?:ql)?:\/\/[^\s"']+|((?:OPENAI_API_KEY|ANTHROPIC_API_KEY|AICHESTRA_LLM_API_KEY|LLM_API_KEY|GITHUB_TOKEN|AICHESTRA_GITHUB_TOKEN|AICHESTRA_GITHUB_WEBHOOK_SECRET|GITHUB_APP_PRIVATE_KEY|PRIVATE_KEY|DATABASE_URL|AICHESTRA_DATABASE_URL|AICHESTRA_TEST_DATABASE_URL|SESSION_SECRET|JWT_SECRET|VAULT_TOKEN|AWS_SECRET_ACCESS_KEY|AWS_SECRET|GCP_SECRET|AZURE_KEY|AZURE_CLIENT_SECRET|OKTA_TOKEN|AUTH0_CLIENT_SECRET|ENTRA_CLIENT_SECRET|GOOGLE_WORKSPACE_TOKEN|SAML_ASSERTION|OIDC_ID_TOKEN|SCIM_TOKEN|[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY|SESSION|COOKIE))=)[^\s"']+/g;

function sanitize(value: unknown, key = ""): unknown {
  if (sensitiveKeyPattern.test(key)) return "[redacted]";
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null || typeof value === "number" || typeof value === "boolean") return value ?? null;
  if (typeof value === "string") {
    return value.replaceAll(secretLikePattern, (match, bearerPrefix, envPrefix) => {
      if (bearerPrefix) return `${bearerPrefix}[redacted]`;
      if (envPrefix) return `${envPrefix}[redacted]`;
      return "[redacted]";
    });
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      output[childKey] = sanitize(childValue, childKey);
    }
    return output;
  }
  return String(value);
}

export function deploymentProfileToDto(profile: DeploymentProfile) {
  return sanitize(profile);
}

export function readinessCheckToDto(check: ReadinessCheck) {
  return sanitize(check);
}

export function productionRiskToDto(risk: ProductionRisk) {
  return sanitize(risk);
}

export function deploymentReadinessSummaryToDto(summary: DeploymentReadinessSummary) {
  return sanitize(summary);
}

export function githubAppDescriptorToDto(descriptor: GitHubAppDescriptor) {
  return sanitize(descriptor);
}

export function githubAppInstallationToDto(installation: GitHubAppInstallation) {
  return sanitize(installation);
}

export function githubAppRepositoryGrantToDto(grant: GitHubAppRepositoryGrant) {
  return sanitize(grant);
}

export function githubAppPermissionMatrixEntryToDto(entry: GitHubAppPermissionMatrixEntry) {
  return sanitize(entry);
}

export function githubWebhookEventAllowlistEntryToDto(entry: GitHubWebhookEventAllowlistEntry) {
  return sanitize(entry);
}

export function githubWebhookDeliveryRecordToDto(record: GitHubWebhookDeliveryRecord) {
  return sanitize(record);
}

export function githubWebhookDeadLetterRecordToDto(record: GitHubWebhookDeadLetterRecord) {
  return sanitize(record);
}

export function githubWebhookReplayProtectionPlanToDto(plan: GitHubWebhookReplayProtectionPlan) {
  return sanitize(plan);
}

export function githubWebhookDeadLetterPlanToDto(plan: GitHubWebhookDeadLetterPlan) {
  return sanitize(plan);
}

export function githubAppCredentialReadinessToDto(readiness: GitHubAppCredentialReadiness) {
  return sanitize(readiness);
}

export function githubProductionWebhookEndpointPlanToDto(plan: GitHubProductionWebhookEndpointPlan) {
  return sanitize(plan);
}

export function githubAppReadinessCheckToDto(check: GitHubAppReadinessCheck) {
  return sanitize(check);
}

export function githubAppProductionRiskToDto(risk: GitHubAppProductionRisk) {
  return sanitize(risk);
}

export function githubWebhookHardeningSummaryToDto(summary: GitHubWebhookHardeningSummary) {
  return sanitize(summary);
}

export function githubAppIntegrationTestProfileToDto(profile: GitHubAppIntegrationTestProfile) {
  return sanitize(profile);
}

export function githubAppIntegrationTestCaseToDto(testCase: GitHubAppIntegrationTestCase) {
  return sanitize(testCase);
}

export function githubAppIntegrationTestSafetyCheckToDto(check: GitHubAppIntegrationTestSafetyCheck) {
  return sanitize(check);
}

export function githubAppIntegrationTestReadinessSummaryToDto(summary: GitHubAppIntegrationTestReadinessSummary) {
  return sanitize(summary);
}

export function llmIntegrationTestProfileToDto(profile: LLMIntegrationTestProfile) {
  return sanitize(profile);
}

export function llmIntegrationTestCaseToDto(testCase: LLMIntegrationTestCase) {
  return sanitize(testCase);
}

export function llmIntegrationTestSafetyCheckToDto(check: LLMIntegrationTestSafetyCheck) {
  return sanitize(check);
}

export function llmIntegrationTestReadinessSummaryToDto(summary: LLMIntegrationTestReadinessSummary) {
  return sanitize(summary);
}

export function vaultIntegrationTestProfileToDto(profile: VaultIntegrationTestProfile) {
  return sanitize(profile);
}

export function vaultIntegrationTestCaseToDto(testCase: VaultIntegrationTestCase) {
  return sanitize(testCase);
}

export function vaultIntegrationTestSafetyCheckToDto(check: VaultIntegrationTestSafetyCheck) {
  return sanitize(check);
}

export function vaultIntegrationTestReadinessSummaryToDto(summary: VaultIntegrationTestReadinessSummary) {
  return sanitize(summary);
}

export function databaseDeploymentProfileToDto(profile: DatabaseDeploymentProfile) {
  return sanitize(profile);
}

export function databaseReadinessCheckToDto(check: DatabaseReadinessCheck) {
  return sanitize(check);
}

export function databaseOperationRiskToDto(risk: DatabaseOperationRisk) {
  return sanitize(risk);
}

export function databaseMigrationStatusToDto(status: DatabaseMigrationStatus) {
  return sanitize(status);
}

export function databaseSchemaInventoryItemToDto(item: DatabaseSchemaInventoryItem) {
  return sanitize(item);
}

export function databaseIndexReviewItemToDto(item: DatabaseIndexReviewItem) {
  return sanitize(item);
}

export function databaseRetentionPlanToDto(plan: DatabaseRetentionPlan) {
  return sanitize(plan);
}

export function databaseAuditGrowthPlanToDto(plan: DatabaseAuditGrowthPlan) {
  return sanitize(plan);
}

export function databaseWebhookPersistencePlanToDto(plan: DatabaseWebhookPersistencePlan) {
  return sanitize(plan);
}

export function databaseOperationsSummaryToDto(summary: DatabaseOperationsSummary) {
  return sanitize(summary);
}

export function secretBackendOptionToDto(option: SecretBackendOption) {
  return sanitize(option);
}

export function secretBackendMigrationPhaseToDto(phase: SecretBackendMigrationPhase) {
  return sanitize(phase);
}

export function secretBackendReadinessCheckToDto(check: SecretBackendReadinessCheck) {
  return sanitize(check);
}

export function secretBackendRiskToDto(risk: SecretBackendRisk) {
  return sanitize(risk);
}

export function secretRotationPlanToDto(plan: SecretRotationPlan) {
  return sanitize(plan);
}

export function secretLeasePolicyToDto(policy: SecretLeasePolicy) {
  return sanitize(policy);
}

export function secretBackendMigrationSummaryToDto(summary: SecretBackendMigrationSummary) {
  return sanitize(summary);
}

export function secretBackendOptionDecisionToDto(decision: SecretBackendOptionDecision) {
  return sanitize(decision);
}

export function secretBackendDecisionCriterionToDto(criterion: SecretBackendDecisionCriterion) {
  return sanitize(criterion);
}

export function secretBackendDecisionScoreToDto(score: SecretBackendDecisionScore) {
  return sanitize(score);
}

export function secretBackendImplementationScopeToDto(scope: SecretBackendImplementationScope) {
  return sanitize(scope);
}

export function secretBackendProviderMappingToDto(mapping: SecretBackendProviderMapping) {
  return sanitize(mapping);
}

export function secretBackendDecisionRiskToDto(risk: SecretBackendDecisionRisk) {
  return sanitize(risk);
}

export function secretBackendOptionDecisionSummaryToDto(summary: SecretBackendOptionDecisionSummary) {
  return sanitize(summary);
}

export function authProviderOptionToDto(option: AuthProviderOption) {
  return sanitize(option);
}

export function authRbacMigrationPhaseToDto(phase: AuthRbacMigrationPhase) {
  return sanitize(phase);
}

export function authRbacReadinessCheckToDto(check: AuthRbacReadinessCheck) {
  return sanitize(check);
}

export function authRbacProductionRiskToDto(risk: AuthRbacProductionRisk) {
  return sanitize(risk);
}

export function tenantBoundaryPlanToDto(plan: TenantBoundaryPlan) {
  return sanitize(plan);
}

export function serviceAccountPlanToDto(plan: ServiceAccountPlan) {
  return sanitize(plan);
}

export function authRbacPermissionMatrixEntryToDto(entry: AuthRbacPermissionMatrixEntry) {
  return sanitize(entry);
}

export function authRbacProductionSummaryToDto(summary: AuthRbacProductionSummary) {
  return sanitize(summary);
}

export function policyEngineOptionToDto(option: PolicyEngineOption) {
  return sanitize(option);
}

export function policyBundlePlanToDto(plan: PolicyBundlePlan) {
  return sanitize(plan);
}

export function policyDomainMappingToDto(mapping: PolicyDomainMapping) {
  return sanitize(mapping);
}

export function policyBundleReadinessCheckToDto(check: PolicyBundleReadinessCheck) {
  return sanitize(check);
}

export function policyBundleRiskToDto(risk: PolicyBundleRisk) {
  return sanitize(risk);
}

export function policyBundleMigrationPhaseToDto(phase: PolicyBundleMigrationPhase) {
  return sanitize(phase);
}

export function policyBundleReadinessSummaryToDto(summary: PolicyBundleReadinessSummary) {
  return sanitize(summary);
}

export function stagingDeploymentProfileToDto(profile: StagingDeploymentProfile) {
  return sanitize(profile);
}

export function stagingIntegrationGateToDto(gate: StagingIntegrationGate) {
  return sanitize(gate);
}

export function stagingReadinessCheckToDto(check: StagingReadinessCheck) {
  return sanitize(check);
}

export function stagingPromotionCriterionToDto(criterion: StagingPromotionCriterion) {
  return sanitize(criterion);
}

export function stagingRollbackCriterionToDto(criterion: StagingRollbackCriterion) {
  return sanitize(criterion);
}

export function stagingDeploymentSummaryToDto(summary: StagingDeploymentSummary) {
  return sanitize(summary);
}

export function stagingDeploymentDryRunProfileToDto(profile: StagingDeploymentDryRunProfile) {
  return sanitize(profile);
}

export function stagingDeploymentDryRunSourceToDto(source: StagingDeploymentDryRunSource) {
  return sanitize(source);
}

export function stagingDeploymentDryRunCheckToDto(check: StagingDeploymentDryRunCheck) {
  return sanitize(check);
}

export function stagingDeploymentDryRunBlockerToDto(blocker: StagingDeploymentDryRunBlocker) {
  return sanitize(blocker);
}

export function stagingDeploymentDryRunIntegrationProfileStatusToDto(status: StagingDeploymentDryRunIntegrationProfileStatus) {
  return sanitize(status);
}

export function stagingDeploymentDryRunReportToDto(report: StagingDeploymentDryRunReport) {
  return sanitize(report);
}

export function stagingDeploymentDryRunSummaryToDto(summary: StagingDeploymentDryRunSummary) {
  return sanitize(summary);
}

export function stagingReleaseCandidateChecklistToDto(checklist: StagingReleaseCandidateChecklist) {
  return sanitize(checklist);
}

export function stagingReleaseCandidateGateToDto(gate: StagingReleaseCandidateGate) {
  return sanitize(gate);
}

export function stagingReleaseCandidateBlockerToDto(blocker: StagingReleaseCandidateBlocker) {
  return sanitize(blocker);
}

export function stagingReleaseCandidateSignoffToDto(signoff: StagingReleaseCandidateSignoff) {
  return sanitize(signoff);
}

export function stagingReleaseNoteRequirementToDto(requirement: StagingReleaseNoteRequirement) {
  return sanitize(requirement);
}

export function stagingRollbackChecklistItemToDto(item: StagingRollbackChecklistItem) {
  return sanitize(item);
}

export function stagingReleaseCandidateReportToDto(report: StagingReleaseCandidateReport) {
  return sanitize(report);
}

export function stagingReleaseCandidateSummaryToDto(summary: StagingReleaseCandidateSummary) {
  return sanitize(summary);
}

export function stagingDeploymentExecutionPlanToDto(plan: StagingDeploymentExecutionPlan) {
  return sanitize(plan);
}

export function stagingDeploymentStepToDto(step: StagingDeploymentStep) {
  return sanitize(step);
}

export function stagingDeploymentGateToDto(gate: StagingDeploymentGate) {
  return sanitize(gate);
}

export function stagingDeploymentGoNoGoDecisionToDto(decision: StagingDeploymentGoNoGoDecision) {
  return sanitize(decision);
}

export function stagingDeploymentRollbackPlanToDto(plan: StagingDeploymentRollbackPlan) {
  return sanitize(plan);
}

export function stagingDeploymentExecutionSummaryToDto(summary: StagingDeploymentExecutionSummary) {
  return sanitize(summary);
}

export function cicdPipelineProfileToDto(profile: CICDPipelineProfile) {
  return sanitize(profile);
}

export function cicdJobDefinitionToDto(job: CICDJobDefinition) {
  return sanitize(job);
}

export function cicdIntegrationTestGateToDto(gate: CICDIntegrationTestGate) {
  return sanitize(gate);
}

export function cicdReadinessCheckToDto(check: CICDReadinessCheck) {
  return sanitize(check);
}

export function cicdRiskToDto(risk: CICDRisk) {
  return sanitize(risk);
}

export function cicdPipelineReadinessSummaryToDto(summary: CICDPipelineReadinessSummary) {
  return sanitize(summary);
}
