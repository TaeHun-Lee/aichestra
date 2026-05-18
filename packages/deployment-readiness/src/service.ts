import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  defaultAuthProviderOptions,
  defaultAuthRbacMigrationPhases,
  defaultAuthRbacPermissionMatrix,
  defaultAuthRbacProductionRisks,
  defaultAuthRbacReadinessChecks,
  defaultCicdIntegrationTestGates,
  defaultCicdJobDefinitions,
  defaultCicdPipelineProfiles,
  defaultCicdReadinessChecks,
  defaultCicdRisks,
  defaultDatabaseAuditGrowthPlan,
  defaultDatabaseDeploymentProfiles,
  defaultDatabaseIndexReview,
  defaultDatabaseOperationRisks,
  defaultDatabaseReadinessChecks,
  defaultDatabaseRetentionPlan,
  defaultDatabaseSchemaInventory,
  defaultDatabaseWebhookPersistencePlan,
  defaultDeploymentProfiles,
  defaultGitHubAppCredentialReadiness,
  defaultGitHubAppDescriptors,
  defaultGitHubAppIntegrationTestCases,
  defaultGitHubAppIntegrationTestProfile,
  defaultGitHubAppIntegrationTestSafetyChecks,
  defaultLLMIntegrationTestCases,
  defaultLLMIntegrationTestProfile,
  defaultLLMIntegrationTestSafetyChecks,
  defaultVaultIntegrationTestCases,
  defaultVaultIntegrationTestProfile,
  defaultVaultIntegrationTestSafetyChecks,
  defaultMergeQueueIntegrationTestCases,
  defaultMergeQueueIntegrationTestProfile,
  defaultMergeQueueIntegrationSafetyChecks,
  defaultGitHubAppInstallations,
  defaultGitHubAppPermissionMatrix,
  defaultGitHubAppProductionRisks,
  defaultGitHubAppReadinessChecks,
  defaultGitHubAppRepositoryGrants,
  defaultGitHubProductionWebhookEndpointPlan,
  defaultGitHubWebhookDeadLetterPlan,
  defaultGitHubWebhookDeadLetterRecords,
  defaultGitHubWebhookDeliveryRecords,
  defaultGitHubWebhookEventAllowlist,
  defaultGitHubWebhookReplayProtectionPlan,
  defaultPolicyBundleMigrationPhases,
  defaultPolicyBundlePlans,
  defaultPolicyBundleReadinessChecks,
  defaultPolicyBundleRisks,
  defaultPolicyDomainMappings,
  defaultPolicyEngineOptions,
  defaultPolicyRuntimePocDomainMappings,
  defaultPolicyRuntimePocGoldenCases,
  defaultPolicyRuntimePocInputContract,
  defaultPolicyRuntimePocOptions,
  defaultPolicyRuntimePocReadinessChecks,
  defaultPolicyRuntimePocRisks,
  defaultPolicyShadowComparisonRules,
  defaultPolicyShadowEvaluationPlan,
  defaultPolicyShadowEvaluationReports,
  defaultPolicyShadowMismatches,
  defaultPolicyShadowReadinessChecks,
  defaultProductionAuthProviderConfigs,
  defaultProductionAuthProviderReadiness,
  defaultProductionRisks,
  defaultReadinessChecks,
  defaultSecretBackendDecisionCriteria,
  defaultSecretBackendDecisionRisks,
  defaultSecretBackendDecisionScores,
  defaultSecretBackendImplementationScopes,
  defaultSecretBackendMigrationPhases,
  defaultSecretBackendOptions,
  defaultSecretBackendOptionDecision,
  defaultSecretBackendProviderMappings,
  defaultSecretBackendReadinessChecks,
  defaultSecretBackendRisks,
  defaultServiceAccountPlans,
  defaultSessionTokenBoundaryPlans,
  defaultStagingDeploymentProfile,
  defaultStagingDeploymentDryRunProfile,
  defaultStagingDeploymentExecutionPlan,
  defaultStagingReleaseCandidateChecklist,
  defaultStagingIntegrationGates,
  defaultStagingPromotionCriteria,
  defaultStagingReadinessChecks,
  defaultStagingRollbackCriteria,
  defaultTenantBoundaryPlans,
  defaultSecretLeasePolicies,
  defaultSecretRotationPlans,
  defaultIdentityMappingPlans
} from "./catalog.ts";
import { signoffEvidenceHasScope, signoffEvidenceScopeMatches } from "./signoff-scope.ts";
import type {
  AuthProviderOption,
  AuthRbacMigrationPhase,
  AuthRbacPermissionMatrixEntry,
  AuthRbacProductionRisk,
  AuthRbacProductionSummary,
  AuthRbacReadinessCategory,
  AuthRbacReadinessCheck,
  CICDIntegrationTestGate,
  CICDJobCategory,
  CICDJobDefinition,
  CICDPipelineProfile,
  CICDPipelineProfileName,
  CICDPipelineReadinessSummary,
  CICDReadinessCategory,
  CICDReadinessCheck,
  CICDRisk,
  DatabaseAuditGrowthPlan,
  DatabaseDeploymentProfile,
  DatabaseDeploymentProfileName,
  DatabaseIndexReviewItem,
  DatabaseMigrationStatus,
  DatabaseOperationRisk,
  DatabaseOperationsSummary,
  DatabaseReadinessCheck,
  DatabaseRetentionPlan,
  DatabaseSchemaInventoryItem,
  DatabaseStorageProviderKind,
  DatabaseWebhookPersistencePlan,
  DeploymentProfile,
  DeploymentProfileName,
  DeploymentReadinessEnvironment,
  DeploymentReadinessSummary,
  GitHubAppCredentialReadiness,
  GitHubAppDescriptor,
  GitHubAppIntegrationTestCase,
  GitHubAppIntegrationTestProfile,
  GitHubAppIntegrationTestReadinessSummary,
  GitHubAppIntegrationTestSafetyCategory,
  GitHubAppIntegrationTestSafetyCheck,
  LLMIntegrationTestCase,
  LLMIntegrationTestProfile,
  LLMIntegrationTestReadinessSummary,
  LLMIntegrationTestSafetyCategory,
  LLMIntegrationTestSafetyCheck,
  VaultIntegrationTestCase,
  VaultIntegrationTestProfile,
  VaultIntegrationTestProfileStatus,
  VaultIntegrationTestReadinessSummary,
  VaultIntegrationTestSafetyCategory,
  VaultIntegrationTestSafetyCheck,
  VaultLiveIntegrationReadiness,
  VaultLiveIntegrationReadinessStatus,
  VaultLiveIntegrationRunbook,
  VaultLiveIntegrationSummary,
  VaultLiveValidationCheck,
  VaultLiveValidationRunRecord,
  MergeQueueIntegrationTestCase,
  MergeQueueIntegrationTestProfile,
  MergeQueueIntegrationTestProfileStatus,
  MergeQueueIntegrationTestReadinessSummary,
  MergeQueueIntegrationSafetyCategory,
  MergeQueueIntegrationSafetyCheck,
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
  PolicyBundleReadinessCategory,
  PolicyBundleReadinessCheck,
  PolicyBundleReadinessSummary,
  PolicyBundleRisk,
  PolicyDomainMapping,
  PolicyEngineOption,
  PolicyRuntimePocDomainMapping,
  PolicyRuntimePocGoldenCase,
  PolicyRuntimePocInputContract,
  PolicyRuntimePocOption,
  PolicyRuntimePocReadinessCategory,
  PolicyRuntimePocReadinessCheck,
  PolicyRuntimePocRisk,
  PolicyRuntimePocSummary,
  PolicyShadowComparisonRule,
  PolicyShadowEvaluationPlan,
  PolicyShadowEvaluationReport,
  PolicyShadowEvaluationSummary,
  PolicyShadowMismatch,
  PolicyShadowReadinessCategory,
  PolicyShadowReadinessCheck,
  ProductionAuthProviderConfig,
  ProductionAuthProviderKind,
  ProductionAuthProviderReadiness,
  ProductionAuthProviderSkeletonSummary,
  ProductionRisk,
  ReadinessCheck,
  ReadinessCheckStatus,
  ReadinessSeverity,
  SecretBackendMigrationPhase,
  SecretBackendMigrationSummary,
  SecretBackendOption,
  SecretBackendDecisionCriterion,
  SecretBackendDecisionRisk,
  SecretBackendDecisionScore,
  SecretBackendImplementationScope,
  SecretBackendOptionDecision,
  SecretBackendOptionDecisionSummary,
  SecretBackendProviderMapping,
  SecretBackendReadinessCategory,
  SecretBackendReadinessCheck,
  SecretBackendRisk,
  SecretLeasePolicy,
  SecretRotationPlan,
  SessionTokenBoundaryPlan,
  ServiceAccountPlan,
  StagingDeploymentDryRunBlocker,
  StagingDeploymentDryRunCheck,
  StagingDeploymentDryRunCheckCategory,
  StagingDeploymentDryRunCheckStatus,
  StagingDeploymentDryRunIntegrationProfileStatus,
  StagingDeploymentDryRunIntegrationStatus,
  StagingDeploymentDryRunOptions,
  StagingDeploymentDryRunOverallStatus,
  StagingDeploymentDryRunProfile,
  StagingDeploymentDryRunReport,
  StagingDeploymentDryRunSource,
  StagingDeploymentDryRunSourceKind,
  StagingDeploymentDryRunSourceStatus,
  StagingDeploymentDryRunSummary,
  StagingDeploymentExecutionOptions,
  StagingDeploymentExecutionPlan,
  StagingDeploymentExecutionPlanStatus,
  StagingDeploymentExecutionSummary,
  StagingDeploymentGate,
  StagingDeploymentGateCategory,
  StagingDeploymentGateStatus,
  StagingDeploymentGoNoGoDecision,
  StagingDeploymentRollbackPlan,
  StagingDeploymentStep,
  StagingHumanSignoffEvidence,
  StagingHumanSignoffStatus,
  StagingSignoffReviewedDiffScope,
  StagingSignoffScopeReview,
  StagingSignoffScopeSnapshot,
  StagingDeploymentProfile,
  StagingDeploymentSummary,
  StagingReleaseCandidateBlocker,
  StagingReleaseCandidateChecklist,
  StagingReleaseCandidateGate,
  StagingReleaseCandidateGateCategory,
  StagingReleaseCandidateGateStatus,
  StagingReleaseCandidateOptions,
  StagingReleaseCandidateOverallStatus,
  StagingReleaseCandidateReport,
  StagingReleaseCandidateSignoff,
  StagingReleaseCandidateSignoffRole,
  StagingReleaseCandidateSummary,
  StagingReleaseNoteRequirement,
  StagingReleaseNoteSection,
  StagingRollbackChecklistItem,
  StagingRollbackChecklistCategory,
  StagingIntegrationGate,
  StagingPromotionCriterion,
  StagingReadinessCategory,
  StagingReadinessCheck,
  StagingRollbackCriterion,
  TenantBoundaryPlan,
  IdentityMappingPlan
} from "./types.ts";

const checkStatuses: ReadinessCheckStatus[] = ["pass", "fail", "warning", "not_applicable", "not_checked"];
const severities: ReadinessSeverity[] = ["low", "medium", "high", "critical"];
const dryRunSourceStatuses: StagingDeploymentDryRunSourceStatus[] = ["pass", "warning", "fail", "skipped", "future", "not_applicable"];
const dryRunCheckStatuses: StagingDeploymentDryRunCheckStatus[] = ["pass", "warning", "fail", "skipped", "not_checked", "not_applicable"];
const dryRunIntegrationStatuses: StagingDeploymentDryRunIntegrationStatus[] = ["ready", "gated", "skipped", "blocked", "future"];
const stagingRcGateStatuses: StagingReleaseCandidateGateStatus[] = ["pass", "warning", "fail", "skipped", "not_checked", "not_applicable"];
const stagingExecutionGateStatuses: StagingDeploymentGateStatus[] = ["pass", "warning", "fail", "skipped", "not_checked", "not_applicable"];

export type DeploymentReadinessServiceInput = {
  env?: Record<string, string | undefined>;
  profiles?: DeploymentProfile[];
  checks?: ReadinessCheck[];
  risks?: ProductionRisk[];
  githubAppDescriptors?: GitHubAppDescriptor[];
  githubAppInstallations?: GitHubAppInstallation[];
  githubAppRepositoryGrants?: GitHubAppRepositoryGrant[];
  githubAppPermissionMatrix?: GitHubAppPermissionMatrixEntry[];
  githubWebhookEventAllowlist?: GitHubWebhookEventAllowlistEntry[];
  githubWebhookDeliveryRecords?: GitHubWebhookDeliveryRecord[];
  githubWebhookDeadLetterRecords?: GitHubWebhookDeadLetterRecord[];
  githubWebhookReplayProtectionPlan?: GitHubWebhookReplayProtectionPlan;
  githubWebhookDeadLetterPlan?: GitHubWebhookDeadLetterPlan;
  githubAppCredentialReadiness?: GitHubAppCredentialReadiness;
  githubProductionWebhookEndpointPlan?: GitHubProductionWebhookEndpointPlan;
  githubAppReadinessChecks?: GitHubAppReadinessCheck[];
  githubAppProductionRisks?: GitHubAppProductionRisk[];
  databaseDeploymentProfiles?: DatabaseDeploymentProfile[];
  databaseReadinessChecks?: DatabaseReadinessCheck[];
  databaseOperationRisks?: DatabaseOperationRisk[];
  databaseSchemaInventory?: DatabaseSchemaInventoryItem[];
  databaseIndexReview?: DatabaseIndexReviewItem[];
  databaseRetentionPlan?: DatabaseRetentionPlan;
  databaseAuditGrowthPlan?: DatabaseAuditGrowthPlan;
  databaseWebhookPersistencePlan?: DatabaseWebhookPersistencePlan;
  secretBackendOptions?: SecretBackendOption[];
  secretBackendMigrationPhases?: SecretBackendMigrationPhase[];
  secretBackendReadinessChecks?: SecretBackendReadinessCheck[];
  secretBackendRisks?: SecretBackendRisk[];
  secretRotationPlans?: SecretRotationPlan[];
  secretLeasePolicies?: SecretLeasePolicy[];
  secretBackendOptionDecision?: SecretBackendOptionDecision;
  secretBackendDecisionCriteria?: SecretBackendDecisionCriterion[];
  secretBackendDecisionScores?: SecretBackendDecisionScore[];
  secretBackendImplementationScopes?: SecretBackendImplementationScope[];
  secretBackendProviderMappings?: SecretBackendProviderMapping[];
  secretBackendDecisionRisks?: SecretBackendDecisionRisk[];
  authProviderOptions?: AuthProviderOption[];
  authRbacMigrationPhases?: AuthRbacMigrationPhase[];
  authRbacReadinessChecks?: AuthRbacReadinessCheck[];
  authRbacProductionRisks?: AuthRbacProductionRisk[];
  tenantBoundaryPlans?: TenantBoundaryPlan[];
  serviceAccountPlans?: ServiceAccountPlan[];
  authRbacPermissionMatrix?: AuthRbacPermissionMatrixEntry[];
  productionAuthProviderConfigs?: ProductionAuthProviderConfig[];
  productionAuthProviderReadiness?: ProductionAuthProviderReadiness[];
  sessionTokenBoundaryPlans?: SessionTokenBoundaryPlan[];
  identityMappingPlans?: IdentityMappingPlan[];
  policyEngineOptions?: PolicyEngineOption[];
  policyBundlePlans?: PolicyBundlePlan[];
  policyDomainMappings?: PolicyDomainMapping[];
  policyBundleReadinessChecks?: PolicyBundleReadinessCheck[];
  policyBundleRisks?: PolicyBundleRisk[];
  policyBundleMigrationPhases?: PolicyBundleMigrationPhase[];
  policyRuntimePocOptions?: PolicyRuntimePocOption[];
  policyRuntimePocInputContract?: PolicyRuntimePocInputContract;
  policyRuntimePocDomainMappings?: PolicyRuntimePocDomainMapping[];
  policyRuntimePocGoldenCases?: PolicyRuntimePocGoldenCase[];
  policyRuntimePocReadinessChecks?: PolicyRuntimePocReadinessCheck[];
  policyRuntimePocRisks?: PolicyRuntimePocRisk[];
  policyShadowEvaluationPlan?: PolicyShadowEvaluationPlan;
  policyShadowComparisonRules?: PolicyShadowComparisonRule[];
  policyShadowMismatches?: PolicyShadowMismatch[];
  policyShadowEvaluationReports?: PolicyShadowEvaluationReport[];
  policyShadowReadinessChecks?: PolicyShadowReadinessCheck[];
  stagingDeploymentProfile?: StagingDeploymentProfile;
  stagingIntegrationGates?: StagingIntegrationGate[];
  stagingReadinessChecks?: StagingReadinessCheck[];
  stagingPromotionCriteria?: StagingPromotionCriterion[];
  stagingRollbackCriteria?: StagingRollbackCriterion[];
  stagingDryRunProfile?: StagingDeploymentDryRunProfile;
  stagingDryRunOptions?: StagingDeploymentDryRunOptions;
  stagingReleaseCandidateChecklist?: StagingReleaseCandidateChecklist;
  stagingReleaseCandidateOptions?: StagingReleaseCandidateOptions;
  stagingDeploymentExecutionPlan?: StagingDeploymentExecutionPlan;
  stagingDeploymentExecutionOptions?: StagingDeploymentExecutionOptions;
  cicdPipelineProfiles?: CICDPipelineProfile[];
  cicdJobDefinitions?: CICDJobDefinition[];
  cicdIntegrationTestGates?: CICDIntegrationTestGate[];
  cicdReadinessChecks?: CICDReadinessCheck[];
  cicdRisks?: CICDRisk[];
  githubAppIntegrationTestProfile?: GitHubAppIntegrationTestProfile;
  githubAppIntegrationTestCases?: GitHubAppIntegrationTestCase[];
  githubAppIntegrationTestSafetyChecks?: GitHubAppIntegrationTestSafetyCheck[];
  llmIntegrationTestProfile?: LLMIntegrationTestProfile;
  llmIntegrationTestCases?: LLMIntegrationTestCase[];
  llmIntegrationTestSafetyChecks?: LLMIntegrationTestSafetyCheck[];
  vaultIntegrationTestProfile?: VaultIntegrationTestProfile;
  vaultIntegrationTestCases?: VaultIntegrationTestCase[];
  vaultIntegrationTestSafetyChecks?: VaultIntegrationTestSafetyCheck[];
  mergeQueueIntegrationTestProfile?: MergeQueueIntegrationTestProfile;
  mergeQueueIntegrationTestCases?: MergeQueueIntegrationTestCase[];
  mergeQueueIntegrationSafetyChecks?: MergeQueueIntegrationSafetyCheck[];
  staticPolicyRuleCount?: number;
  repoRoot?: string;
  migrationsDir?: string;
  migrationRunnerPath?: string;
  now?: () => Date;
};

type StagingDeploymentExecutionSignoffCollection = {
  requiredSignoffCount: number;
  pendingApprovals: StagingReleaseCandidateSignoffRole[];
  approvedApprovals: StagingReleaseCandidateSignoffRole[];
  conditionalApprovals: StagingReleaseCandidateSignoffRole[];
  rejectedApprovals: StagingReleaseCandidateSignoffRole[];
  invalidEvidenceRoles: StagingReleaseCandidateSignoffRole[];
  realHumanEvidenceProvidedCount: number;
  approvedSignoffCount: number;
  conditionalSignoffCount: number;
  rejectedSignoffCount: number;
  missingRequiredSignoffCount: number;
  signoffStatus: StagingHumanSignoffStatus;
  collectionMode: "real_evidence" | "mock_planning";
  actualDeploymentBlocked: true;
};

export type GitHubWebhookDeliveryClassificationInput = {
  deliveryId: string;
  eventType: string;
  payloadHash: string;
  repoRef?: string;
  action?: string;
  signatureVerified?: boolean;
  previousDeliveries?: GitHubWebhookDeliveryRecord[];
  now?: Date;
  metadata?: Record<string, unknown>;
};

function flag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function csvCount(value: string | undefined): number {
  return typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean).length : 0;
}

function csvValues(value: string | undefined): string[] {
  return typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function positiveNumber(value: string | undefined): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function stringConfigured(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeProductionAuthProviderKind(value: string | undefined): ProductionAuthProviderKind {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "mock") return "mock";
  if (normalized === "oidc" || normalized === "oidc_future" || normalized === "future_oidc") return "oidc_future";
  if (normalized === "saml" || normalized === "saml_future" || normalized === "future_saml") return "saml_future";
  if (normalized === "scim" || normalized === "scim_future") return "scim_future";
  if (normalized === "microsoft_entra" || normalized === "microsoft_entra_future" || normalized === "microsoft_future" || normalized === "entra") return "microsoft_entra_future";
  if (normalized === "okta" || normalized === "okta_future") return "okta_future";
  if (normalized === "auth0" || normalized === "auth0_future") return "auth0_future";
  if (normalized === "google_workspace" || normalized === "google_workspace_future" || normalized === "google_future") return "google_workspace_future";
  if (normalized === "github_enterprise" || normalized === "github_enterprise_future" || normalized === "github_future") return "github_enterprise_future";
  if (normalized === "custom" || normalized === "custom_future") return "custom_future";
  return "mock";
}

function nonEmptyText(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasExplicitHumanDecisionEvidence(record: StagingHumanSignoffEvidence): boolean {
  if (record.status === "pending" || record.status === "waived") return false;
  const hasRequiredFields = nonEmptyText(record.approverName) &&
    nonEmptyText(record.signedAt) &&
    nonEmptyText(record.signatureMethod) &&
    Array.isArray(record.reviewedEvidence) &&
    record.reviewedEvidence.some((item) => item.trim().length > 0);
  if (!hasRequiredFields) return false;
  if (record.status === "rejected") {
    return nonEmptyText(record.notes);
  }
  if (record.status === "conditionally_approved") {
    return Array.isArray(record.conditions) && record.conditions.some((condition) => condition.trim().length > 0);
  }
  return true;
}

function hasExplicitHumanSignoffEvidence(record: StagingHumanSignoffEvidence): boolean {
  return hasExplicitHumanDecisionEvidence(record) && signoffEvidenceHasScope(record);
}

function cleanText(value: string | undefined, maxLength = 1000): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : undefined;
}

function cleanTextArray(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function cleanStagingSignoffDiffScope(scope: StagingHumanSignoffEvidence["reviewedDiffScope"]): StagingSignoffReviewedDiffScope | undefined {
  if (scope === undefined) return undefined;
  const worktreeStatus = scope.worktreeStatus === "clean" || scope.worktreeStatus === "dirty" ? scope.worktreeStatus : undefined;
  if (worktreeStatus === undefined) return undefined;
  return {
    worktreeStatus,
    modifiedFiles: cleanTextArray(scope.modifiedFiles ?? []).map((value) => value.slice(0, 500)),
    untrackedFiles: cleanTextArray(scope.untrackedFiles ?? []).map((value) => value.slice(0, 500)),
    diffNameStatus: cleanTextArray(scope.diffNameStatus ?? []).map((value) => value.slice(0, 1000)),
    diffStat: cleanTextArray(scope.diffStat ?? []).map((value) => value.slice(0, 1000)),
    diffScopeHash: cleanText(scope.diffScopeHash, 120)
  };
}

function testSecretPathAllowedByPrefix(pathValue: string, prefix: string): boolean {
  const normalizedPath = pathValue.trim().replace(/^\/+/, "");
  const normalizedPrefix = prefix.trim().replace(/^\/+/, "");
  return normalizedPrefix.length > 0 &&
    (normalizedPath === normalizedPrefix || normalizedPath.startsWith(normalizedPrefix.endsWith("/") ? normalizedPrefix : `${normalizedPrefix}/`));
}

function looksLikeTestOnlyVaultPath(pathValue: string): boolean {
  return /(^|[/_-])(test|tests|dev|development|integration|sandbox|nonprod|non-production|ci)([/_-]|$)/i.test(pathValue);
}

function looksLikeProductionVaultPath(pathValue: string): boolean {
  return /(^|[/_-])(prod|production|customer|tenant|live|real|payment|billing|private|root)([/_-]|$)/i.test(pathValue);
}

function looksLikeTestOnlyVaultKey(keyValue: string): boolean {
  return /(^|[_-])(test|tests|dummy|mock|sample|sandbox|nonprod|ci)([_-]|$)/i.test(keyValue);
}

function looksLikeSensitiveVaultKey(keyValue: string): boolean {
  return /(^|[_-])(api[_-]?key|token|password|passwd|secret|private[_-]?key|credential|webhook[_-]?secret)([_-]|$)/i.test(keyValue);
}

function profileFromEnv(value: string | undefined): DeploymentProfileName {
  if (value === "integration" || value === "staging" || value === "production") return value;
  return "local";
}

function countByStatus(checks: ReadinessCheck[]): Record<ReadinessCheckStatus, number> {
  return Object.fromEntries(checkStatuses.map((status) => [status, checks.filter((check) => check.status === status).length])) as Record<ReadinessCheckStatus, number>;
}

function countBySeverity(items: Array<{ severity: ReadinessSeverity }>): Record<ReadinessSeverity, number> {
  return Object.fromEntries(severities.map((severity) => [severity, items.filter((item) => item.severity === severity).length])) as Record<ReadinessSeverity, number>;
}

function countDryRunSourcesByStatus(sources: StagingDeploymentDryRunSource[]): Record<StagingDeploymentDryRunSourceStatus, number> {
  return Object.fromEntries(dryRunSourceStatuses.map((status) => [status, sources.filter((source) => source.status === status).length])) as Record<StagingDeploymentDryRunSourceStatus, number>;
}

function countDryRunChecksByStatus(checks: StagingDeploymentDryRunCheck[]): Record<StagingDeploymentDryRunCheckStatus, number> {
  return Object.fromEntries(dryRunCheckStatuses.map((status) => [status, checks.filter((check) => check.status === status).length])) as Record<StagingDeploymentDryRunCheckStatus, number>;
}

function countDryRunIntegrationProfilesByStatus(profiles: StagingDeploymentDryRunIntegrationProfileStatus[]): Record<StagingDeploymentDryRunIntegrationStatus, number> {
  return Object.fromEntries(dryRunIntegrationStatuses.map((status) => [status, profiles.filter((profile) => profile.status === status).length])) as Record<StagingDeploymentDryRunIntegrationStatus, number>;
}

function countStagingRcGatesByStatus(gates: StagingReleaseCandidateGate[]): Record<StagingReleaseCandidateGateStatus, number> {
  return Object.fromEntries(stagingRcGateStatuses.map((status) => [status, gates.filter((gate) => gate.status === status).length])) as Record<StagingReleaseCandidateGateStatus, number>;
}

function countStagingExecutionGatesByStatus(gates: StagingDeploymentGate[]): Record<StagingDeploymentGateStatus, number> {
  return Object.fromEntries(stagingExecutionGateStatuses.map((status) => [status, gates.filter((gate) => gate.status === status).length])) as Record<StagingDeploymentGateStatus, number>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function safeIdPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "unknown";
}

export class DeploymentReadinessService {
  private readonly env: Record<string, string | undefined>;
  private readonly profiles: DeploymentProfile[];
  private readonly checks: ReadinessCheck[];
  private readonly risks: ProductionRisk[];
  private readonly githubAppDescriptors: GitHubAppDescriptor[];
  private readonly githubAppInstallations: GitHubAppInstallation[];
  private readonly githubAppRepositoryGrants: GitHubAppRepositoryGrant[];
  private readonly githubAppPermissionMatrix: GitHubAppPermissionMatrixEntry[];
  private readonly githubWebhookEventAllowlist: GitHubWebhookEventAllowlistEntry[];
  private readonly githubWebhookDeliveryRecords: GitHubWebhookDeliveryRecord[];
  private readonly githubWebhookDeadLetterRecords: GitHubWebhookDeadLetterRecord[];
  private readonly githubWebhookReplayProtectionPlan: GitHubWebhookReplayProtectionPlan;
  private readonly githubWebhookDeadLetterPlan: GitHubWebhookDeadLetterPlan;
  private readonly githubAppCredentialReadiness: GitHubAppCredentialReadiness;
  private readonly githubProductionWebhookEndpointPlan: GitHubProductionWebhookEndpointPlan;
  private readonly githubAppReadinessChecks: GitHubAppReadinessCheck[];
  private readonly githubAppProductionRisks: GitHubAppProductionRisk[];
  private readonly databaseDeploymentProfiles: DatabaseDeploymentProfile[];
  private readonly databaseReadinessChecks: DatabaseReadinessCheck[];
  private readonly databaseOperationRisks: DatabaseOperationRisk[];
  private readonly databaseSchemaInventory: DatabaseSchemaInventoryItem[];
  private readonly databaseIndexReview: DatabaseIndexReviewItem[];
  private readonly databaseRetentionPlan: DatabaseRetentionPlan;
  private readonly databaseAuditGrowthPlan: DatabaseAuditGrowthPlan;
  private readonly databaseWebhookPersistencePlan: DatabaseWebhookPersistencePlan;
  private readonly secretBackendOptions: SecretBackendOption[];
  private readonly secretBackendMigrationPhases: SecretBackendMigrationPhase[];
  private readonly secretBackendReadinessChecks: SecretBackendReadinessCheck[];
  private readonly secretBackendRisks: SecretBackendRisk[];
  private readonly secretRotationPlans: SecretRotationPlan[];
  private readonly secretLeasePolicies: SecretLeasePolicy[];
  private readonly secretBackendOptionDecision: SecretBackendOptionDecision;
  private readonly secretBackendDecisionCriteria: SecretBackendDecisionCriterion[];
  private readonly secretBackendDecisionScores: SecretBackendDecisionScore[];
  private readonly secretBackendImplementationScopes: SecretBackendImplementationScope[];
  private readonly secretBackendProviderMappings: SecretBackendProviderMapping[];
  private readonly secretBackendDecisionRisks: SecretBackendDecisionRisk[];
  private readonly authProviderOptions: AuthProviderOption[];
  private readonly authRbacMigrationPhases: AuthRbacMigrationPhase[];
  private readonly authRbacReadinessChecks: AuthRbacReadinessCheck[];
  private readonly authRbacProductionRisks: AuthRbacProductionRisk[];
  private readonly tenantBoundaryPlans: TenantBoundaryPlan[];
  private readonly serviceAccountPlans: ServiceAccountPlan[];
  private readonly authRbacPermissionMatrix: AuthRbacPermissionMatrixEntry[];
  private readonly productionAuthProviderConfigs: ProductionAuthProviderConfig[];
  private readonly productionAuthProviderReadiness: ProductionAuthProviderReadiness[];
  private readonly sessionTokenBoundaryPlans: SessionTokenBoundaryPlan[];
  private readonly identityMappingPlans: IdentityMappingPlan[];
  private readonly policyEngineOptions: PolicyEngineOption[];
  private readonly policyBundlePlans: PolicyBundlePlan[];
  private readonly policyDomainMappings: PolicyDomainMapping[];
  private readonly policyBundleReadinessChecks: PolicyBundleReadinessCheck[];
  private readonly policyBundleRisks: PolicyBundleRisk[];
  private readonly policyBundleMigrationPhases: PolicyBundleMigrationPhase[];
  private readonly policyRuntimePocOptions: PolicyRuntimePocOption[];
  private readonly policyRuntimePocInputContract: PolicyRuntimePocInputContract;
  private readonly policyRuntimePocDomainMappings: PolicyRuntimePocDomainMapping[];
  private readonly policyRuntimePocGoldenCases: PolicyRuntimePocGoldenCase[];
  private readonly policyRuntimePocReadinessChecks: PolicyRuntimePocReadinessCheck[];
  private readonly policyRuntimePocRisks: PolicyRuntimePocRisk[];
  private readonly policyShadowEvaluationPlan: PolicyShadowEvaluationPlan;
  private readonly policyShadowComparisonRules: PolicyShadowComparisonRule[];
  private readonly policyShadowMismatches: PolicyShadowMismatch[];
  private readonly policyShadowEvaluationReports: PolicyShadowEvaluationReport[];
  private readonly policyShadowReadinessChecks: PolicyShadowReadinessCheck[];
  private readonly stagingDeploymentProfile: StagingDeploymentProfile;
  private readonly stagingIntegrationGates: StagingIntegrationGate[];
  private readonly stagingReadinessChecks: StagingReadinessCheck[];
  private readonly stagingPromotionCriteria: StagingPromotionCriterion[];
  private readonly stagingRollbackCriteria: StagingRollbackCriterion[];
  private readonly stagingDryRunProfile: StagingDeploymentDryRunProfile;
  private readonly stagingDryRunOptions: StagingDeploymentDryRunOptions;
  private readonly stagingReleaseCandidateChecklist: StagingReleaseCandidateChecklist;
  private readonly stagingReleaseCandidateOptions: StagingReleaseCandidateOptions;
  private readonly stagingDeploymentExecutionPlan: StagingDeploymentExecutionPlan;
  private readonly stagingDeploymentExecutionOptions: StagingDeploymentExecutionOptions;
  private readonly stagingHumanSignoffs: Partial<Record<StagingReleaseCandidateSignoffRole, StagingHumanSignoffEvidence>>;
  private readonly cicdPipelineProfiles: CICDPipelineProfile[];
  private readonly cicdJobDefinitions: CICDJobDefinition[];
  private readonly cicdIntegrationTestGates: CICDIntegrationTestGate[];
  private readonly cicdReadinessChecks: CICDReadinessCheck[];
  private readonly cicdRisks: CICDRisk[];
  private readonly githubAppIntegrationTestProfile: GitHubAppIntegrationTestProfile;
  private readonly githubAppIntegrationTestCases: GitHubAppIntegrationTestCase[];
  private readonly githubAppIntegrationTestSafetyChecks: GitHubAppIntegrationTestSafetyCheck[];
  private readonly llmIntegrationTestProfile: LLMIntegrationTestProfile;
  private readonly llmIntegrationTestCases: LLMIntegrationTestCase[];
  private readonly llmIntegrationTestSafetyChecks: LLMIntegrationTestSafetyCheck[];
  private readonly vaultIntegrationTestProfile: VaultIntegrationTestProfile;
  private readonly vaultIntegrationTestCases: VaultIntegrationTestCase[];
  private readonly vaultIntegrationTestSafetyChecks: VaultIntegrationTestSafetyCheck[];
  private readonly mergeQueueIntegrationTestProfile: MergeQueueIntegrationTestProfile;
  private readonly mergeQueueIntegrationTestCases: MergeQueueIntegrationTestCase[];
  private readonly mergeQueueIntegrationSafetyChecks: MergeQueueIntegrationSafetyCheck[];
  private readonly staticPolicyRuleCount: number;
  private readonly repoRoot: string;
  private readonly migrationsDir: string;
  private readonly migrationRunnerPath: string;
  private readonly now: () => Date;

  constructor(input: DeploymentReadinessServiceInput = {}) {
    this.env = input.env ?? process.env;
    this.profiles = clone(input.profiles ?? defaultDeploymentProfiles);
    this.checks = clone(input.checks ?? defaultReadinessChecks);
    this.risks = clone(input.risks ?? defaultProductionRisks);
    this.githubAppDescriptors = clone(input.githubAppDescriptors ?? defaultGitHubAppDescriptors);
    this.githubAppInstallations = clone(input.githubAppInstallations ?? defaultGitHubAppInstallations);
    this.githubAppRepositoryGrants = clone(input.githubAppRepositoryGrants ?? defaultGitHubAppRepositoryGrants);
    this.githubAppPermissionMatrix = clone(input.githubAppPermissionMatrix ?? defaultGitHubAppPermissionMatrix);
    this.githubWebhookEventAllowlist = clone(input.githubWebhookEventAllowlist ?? defaultGitHubWebhookEventAllowlist);
    this.githubWebhookDeliveryRecords = clone(input.githubWebhookDeliveryRecords ?? defaultGitHubWebhookDeliveryRecords);
    this.githubWebhookDeadLetterRecords = clone(input.githubWebhookDeadLetterRecords ?? defaultGitHubWebhookDeadLetterRecords);
    this.githubWebhookReplayProtectionPlan = clone(input.githubWebhookReplayProtectionPlan ?? defaultGitHubWebhookReplayProtectionPlan);
    this.githubWebhookDeadLetterPlan = clone(input.githubWebhookDeadLetterPlan ?? defaultGitHubWebhookDeadLetterPlan);
    this.githubAppCredentialReadiness = clone(input.githubAppCredentialReadiness ?? defaultGitHubAppCredentialReadiness);
    this.githubProductionWebhookEndpointPlan = clone(input.githubProductionWebhookEndpointPlan ?? defaultGitHubProductionWebhookEndpointPlan);
    this.githubAppReadinessChecks = clone(input.githubAppReadinessChecks ?? defaultGitHubAppReadinessChecks);
    this.githubAppProductionRisks = clone(input.githubAppProductionRisks ?? defaultGitHubAppProductionRisks);
    this.databaseDeploymentProfiles = clone(input.databaseDeploymentProfiles ?? defaultDatabaseDeploymentProfiles);
    this.databaseReadinessChecks = clone(input.databaseReadinessChecks ?? defaultDatabaseReadinessChecks);
    this.databaseOperationRisks = clone(input.databaseOperationRisks ?? defaultDatabaseOperationRisks);
    this.databaseSchemaInventory = clone(input.databaseSchemaInventory ?? defaultDatabaseSchemaInventory);
    this.databaseIndexReview = clone(input.databaseIndexReview ?? defaultDatabaseIndexReview);
    this.databaseRetentionPlan = clone(input.databaseRetentionPlan ?? defaultDatabaseRetentionPlan);
    this.databaseAuditGrowthPlan = clone(input.databaseAuditGrowthPlan ?? defaultDatabaseAuditGrowthPlan);
    this.databaseWebhookPersistencePlan = clone(input.databaseWebhookPersistencePlan ?? defaultDatabaseWebhookPersistencePlan);
    this.secretBackendOptions = clone(input.secretBackendOptions ?? defaultSecretBackendOptions);
    this.secretBackendMigrationPhases = clone(input.secretBackendMigrationPhases ?? defaultSecretBackendMigrationPhases);
    this.secretBackendReadinessChecks = clone(input.secretBackendReadinessChecks ?? defaultSecretBackendReadinessChecks);
    this.secretBackendRisks = clone(input.secretBackendRisks ?? defaultSecretBackendRisks);
    this.secretRotationPlans = clone(input.secretRotationPlans ?? defaultSecretRotationPlans);
    this.secretLeasePolicies = clone(input.secretLeasePolicies ?? defaultSecretLeasePolicies);
    this.secretBackendOptionDecision = clone(input.secretBackendOptionDecision ?? defaultSecretBackendOptionDecision);
    this.secretBackendDecisionCriteria = clone(input.secretBackendDecisionCriteria ?? defaultSecretBackendDecisionCriteria);
    this.secretBackendDecisionScores = clone(input.secretBackendDecisionScores ?? defaultSecretBackendDecisionScores);
    this.secretBackendImplementationScopes = clone(input.secretBackendImplementationScopes ?? defaultSecretBackendImplementationScopes);
    this.secretBackendProviderMappings = clone(input.secretBackendProviderMappings ?? defaultSecretBackendProviderMappings);
    this.secretBackendDecisionRisks = clone(input.secretBackendDecisionRisks ?? defaultSecretBackendDecisionRisks);
    this.authProviderOptions = clone(input.authProviderOptions ?? defaultAuthProviderOptions);
    this.authRbacMigrationPhases = clone(input.authRbacMigrationPhases ?? defaultAuthRbacMigrationPhases);
    this.authRbacReadinessChecks = clone(input.authRbacReadinessChecks ?? defaultAuthRbacReadinessChecks);
    this.authRbacProductionRisks = clone(input.authRbacProductionRisks ?? defaultAuthRbacProductionRisks);
    this.tenantBoundaryPlans = clone(input.tenantBoundaryPlans ?? defaultTenantBoundaryPlans);
    this.serviceAccountPlans = clone(input.serviceAccountPlans ?? defaultServiceAccountPlans);
    this.authRbacPermissionMatrix = clone(input.authRbacPermissionMatrix ?? defaultAuthRbacPermissionMatrix);
    this.productionAuthProviderConfigs = clone(input.productionAuthProviderConfigs ?? defaultProductionAuthProviderConfigs);
    this.productionAuthProviderReadiness = clone(input.productionAuthProviderReadiness ?? defaultProductionAuthProviderReadiness);
    this.sessionTokenBoundaryPlans = clone(input.sessionTokenBoundaryPlans ?? defaultSessionTokenBoundaryPlans);
    this.identityMappingPlans = clone(input.identityMappingPlans ?? defaultIdentityMappingPlans);
    this.policyEngineOptions = clone(input.policyEngineOptions ?? defaultPolicyEngineOptions);
    this.policyBundlePlans = clone(input.policyBundlePlans ?? defaultPolicyBundlePlans);
    this.policyDomainMappings = clone(input.policyDomainMappings ?? defaultPolicyDomainMappings);
    this.policyBundleReadinessChecks = clone(input.policyBundleReadinessChecks ?? defaultPolicyBundleReadinessChecks);
    this.policyBundleRisks = clone(input.policyBundleRisks ?? defaultPolicyBundleRisks);
    this.policyBundleMigrationPhases = clone(input.policyBundleMigrationPhases ?? defaultPolicyBundleMigrationPhases);
    this.policyRuntimePocOptions = clone(input.policyRuntimePocOptions ?? defaultPolicyRuntimePocOptions);
    this.policyRuntimePocInputContract = clone(input.policyRuntimePocInputContract ?? defaultPolicyRuntimePocInputContract);
    this.policyRuntimePocDomainMappings = clone(input.policyRuntimePocDomainMappings ?? defaultPolicyRuntimePocDomainMappings);
    this.policyRuntimePocGoldenCases = clone(input.policyRuntimePocGoldenCases ?? defaultPolicyRuntimePocGoldenCases);
    this.policyRuntimePocReadinessChecks = clone(input.policyRuntimePocReadinessChecks ?? defaultPolicyRuntimePocReadinessChecks);
    this.policyRuntimePocRisks = clone(input.policyRuntimePocRisks ?? defaultPolicyRuntimePocRisks);
    this.policyShadowEvaluationPlan = clone(input.policyShadowEvaluationPlan ?? defaultPolicyShadowEvaluationPlan);
    this.policyShadowComparisonRules = clone(input.policyShadowComparisonRules ?? defaultPolicyShadowComparisonRules);
    this.policyShadowMismatches = clone(input.policyShadowMismatches ?? defaultPolicyShadowMismatches);
    this.policyShadowEvaluationReports = clone(input.policyShadowEvaluationReports ?? defaultPolicyShadowEvaluationReports);
    this.policyShadowReadinessChecks = clone(input.policyShadowReadinessChecks ?? defaultPolicyShadowReadinessChecks);
    this.stagingDeploymentProfile = clone(input.stagingDeploymentProfile ?? defaultStagingDeploymentProfile);
    this.stagingIntegrationGates = clone(input.stagingIntegrationGates ?? defaultStagingIntegrationGates);
    this.stagingReadinessChecks = clone(input.stagingReadinessChecks ?? defaultStagingReadinessChecks);
    this.stagingPromotionCriteria = clone(input.stagingPromotionCriteria ?? defaultStagingPromotionCriteria);
    this.stagingRollbackCriteria = clone(input.stagingRollbackCriteria ?? defaultStagingRollbackCriteria);
    this.stagingDryRunProfile = clone(input.stagingDryRunProfile ?? defaultStagingDeploymentDryRunProfile);
    this.stagingDryRunOptions = clone(input.stagingDryRunOptions ?? {});
    this.stagingReleaseCandidateChecklist = clone(input.stagingReleaseCandidateChecklist ?? defaultStagingReleaseCandidateChecklist);
    this.stagingReleaseCandidateOptions = clone(input.stagingReleaseCandidateOptions ?? {});
    this.stagingDeploymentExecutionPlan = clone(input.stagingDeploymentExecutionPlan ?? defaultStagingDeploymentExecutionPlan);
    this.stagingDeploymentExecutionOptions = clone(input.stagingDeploymentExecutionOptions ?? {});
    this.stagingHumanSignoffs = clone(this.stagingDeploymentExecutionOptions.humanSignoffs ?? {});
    this.cicdPipelineProfiles = clone(input.cicdPipelineProfiles ?? defaultCicdPipelineProfiles);
    this.cicdJobDefinitions = clone(input.cicdJobDefinitions ?? defaultCicdJobDefinitions);
    this.cicdIntegrationTestGates = clone(input.cicdIntegrationTestGates ?? defaultCicdIntegrationTestGates);
    this.cicdReadinessChecks = clone(input.cicdReadinessChecks ?? defaultCicdReadinessChecks);
    this.cicdRisks = clone(input.cicdRisks ?? defaultCicdRisks);
    this.githubAppIntegrationTestProfile = clone(input.githubAppIntegrationTestProfile ?? defaultGitHubAppIntegrationTestProfile);
    this.githubAppIntegrationTestCases = clone(input.githubAppIntegrationTestCases ?? defaultGitHubAppIntegrationTestCases);
    this.githubAppIntegrationTestSafetyChecks = clone(input.githubAppIntegrationTestSafetyChecks ?? defaultGitHubAppIntegrationTestSafetyChecks);
    this.llmIntegrationTestProfile = clone(input.llmIntegrationTestProfile ?? defaultLLMIntegrationTestProfile);
    this.llmIntegrationTestCases = clone(input.llmIntegrationTestCases ?? defaultLLMIntegrationTestCases);
    this.llmIntegrationTestSafetyChecks = clone(input.llmIntegrationTestSafetyChecks ?? defaultLLMIntegrationTestSafetyChecks);
    this.vaultIntegrationTestProfile = clone(input.vaultIntegrationTestProfile ?? defaultVaultIntegrationTestProfile);
    this.vaultIntegrationTestCases = clone(input.vaultIntegrationTestCases ?? defaultVaultIntegrationTestCases);
    this.vaultIntegrationTestSafetyChecks = clone(input.vaultIntegrationTestSafetyChecks ?? defaultVaultIntegrationTestSafetyChecks);
    this.mergeQueueIntegrationTestProfile = clone(input.mergeQueueIntegrationTestProfile ?? defaultMergeQueueIntegrationTestProfile);
    this.mergeQueueIntegrationTestCases = clone(input.mergeQueueIntegrationTestCases ?? defaultMergeQueueIntegrationTestCases);
    this.mergeQueueIntegrationSafetyChecks = clone(input.mergeQueueIntegrationSafetyChecks ?? defaultMergeQueueIntegrationSafetyChecks);
    this.staticPolicyRuleCount = input.staticPolicyRuleCount ?? 0;
    this.repoRoot = input.repoRoot ?? process.cwd();
    this.migrationsDir = input.migrationsDir ?? path.join(this.repoRoot, "infra", "migrations");
    this.migrationRunnerPath = input.migrationRunnerPath ?? path.join(this.repoRoot, "scripts", "db", "migrate.mjs");
    this.now = input.now ?? (() => new Date());
  }

  listProfiles(): DeploymentProfile[] {
    return clone(this.profiles);
  }

  getProfile(id: string): DeploymentProfile | undefined {
    return clone(this.profiles.find((profile) => profile.id === id));
  }

  listChecks(filter: { profileId?: DeploymentProfileName; status?: ReadinessCheckStatus } = {}): ReadinessCheck[] {
    return clone(this.checks.filter((check) =>
      (filter.profileId === undefined || check.profileId === filter.profileId) &&
      (filter.status === undefined || check.status === filter.status)
    ));
  }

  listRisks(filter: { status?: ProductionRisk["status"]; severity?: ReadinessSeverity } = {}): ProductionRisk[] {
    return clone(this.risks.filter((risk) =>
      (filter.status === undefined || risk.status === filter.status) &&
      (filter.severity === undefined || risk.severity === filter.severity)
    ));
  }

  listGitHubAppDescriptors(): GitHubAppDescriptor[] {
    return clone(this.githubAppDescriptors);
  }

  listGitHubAppInstallations(): GitHubAppInstallation[] {
    return clone(this.githubAppInstallations);
  }

  listGitHubAppRepositoryGrants(): GitHubAppRepositoryGrant[] {
    return clone(this.githubAppRepositoryGrants);
  }

  listGitHubAppPermissionMatrix(): GitHubAppPermissionMatrixEntry[] {
    return clone(this.githubAppPermissionMatrix);
  }

  listGitHubWebhookEventAllowlist(): GitHubWebhookEventAllowlistEntry[] {
    return clone(this.githubWebhookEventAllowlist);
  }

  listGitHubWebhookDeliveryRecords(): GitHubWebhookDeliveryRecord[] {
    return clone(this.githubWebhookDeliveryRecords);
  }

  listGitHubWebhookDeadLetterRecords(): GitHubWebhookDeadLetterRecord[] {
    return clone(this.githubWebhookDeadLetterRecords);
  }

  getGitHubWebhookReplayProtectionPlan(): GitHubWebhookReplayProtectionPlan {
    return clone(this.githubWebhookReplayProtectionPlan);
  }

  getGitHubWebhookDeadLetterPlan(): GitHubWebhookDeadLetterPlan {
    return clone(this.githubWebhookDeadLetterPlan);
  }

  getGitHubAppCredentialReadiness(): GitHubAppCredentialReadiness {
    return clone(this.githubAppCredentialReadiness);
  }

  getGitHubProductionWebhookEndpointPlan(): GitHubProductionWebhookEndpointPlan {
    return clone(this.githubProductionWebhookEndpointPlan);
  }

  listGitHubAppReadinessChecks(): GitHubAppReadinessCheck[] {
    return clone(this.githubAppReadinessChecks);
  }

  listGitHubAppProductionRisks(): GitHubAppProductionRisk[] {
    return clone(this.githubAppProductionRisks);
  }

  listDatabaseDeploymentProfiles(): DatabaseDeploymentProfile[] {
    return clone(this.databaseDeploymentProfiles);
  }

  listDatabaseReadinessChecks(filter: { profileId?: DatabaseDeploymentProfileName } = {}): DatabaseReadinessCheck[] {
    return clone(this.databaseReadinessChecks.filter((check) => filter.profileId === undefined || check.profileId === filter.profileId));
  }

  listDatabaseOperationRisks(): DatabaseOperationRisk[] {
    return clone(this.databaseOperationRisks);
  }

  getDatabaseMigrationStatus(): DatabaseMigrationStatus[] {
    if (!existsSync(this.migrationsDir)) return [];
    const migrationFiles = readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort((left, right) => left.localeCompare(right));
    return migrationFiles.map((file) => {
      const fullPath = path.join(this.migrationsDir, file);
      const sql = readFileSync(fullPath, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      return {
        id: `migration_${safeIdPart(file)}`,
        migrationId: file.replace(/\.sql$/i, ""),
        name: file,
        status: "pending",
        checksum: `sha256:${checksum}`,
        metadata: {
          relativePath: path.relative(this.repoRoot, fullPath).replaceAll("\\", "/"),
          byteLength: Buffer.byteLength(sql, "utf8"),
          migrationRunnerAvailable: this.isMigrationRunnerAvailable(),
          executedByService: false,
          databaseConnectionAttempted: false
        }
      };
    });
  }

  getDatabaseSchemaInventory(): DatabaseSchemaInventoryItem[] {
    return clone(this.databaseSchemaInventory);
  }

  getDatabaseIndexReview(): DatabaseIndexReviewItem[] {
    return clone(this.databaseIndexReview);
  }

  getDatabaseRetentionPlan(): DatabaseRetentionPlan {
    return clone(this.databaseRetentionPlan);
  }

  getDatabaseAuditGrowthPlan(): DatabaseAuditGrowthPlan {
    return clone(this.databaseAuditGrowthPlan);
  }

  getDatabaseWebhookPersistencePlan(): DatabaseWebhookPersistencePlan {
    return clone(this.databaseWebhookPersistencePlan);
  }

  listSecretBackendOptions(): SecretBackendOption[] {
    return clone(this.secretBackendOptions);
  }

  listSecretBackendMigrationPhases(): SecretBackendMigrationPhase[] {
    return clone(this.secretBackendMigrationPhases);
  }

  listSecretBackendReadinessChecks(filter: { category?: SecretBackendReadinessCategory } = {}): SecretBackendReadinessCheck[] {
    return clone(this.secretBackendReadinessChecks.filter((check) => filter.category === undefined || check.category === filter.category));
  }

  listSecretBackendRisks(): SecretBackendRisk[] {
    return clone(this.secretBackendRisks);
  }

  listSecretRotationPlans(): SecretRotationPlan[] {
    return clone(this.secretRotationPlans);
  }

  listSecretLeasePolicies(): SecretLeasePolicy[] {
    return clone(this.secretLeasePolicies);
  }

  getSecretBackendOptionDecision(): SecretBackendOptionDecision {
    return clone(this.secretBackendOptionDecision);
  }

  listSecretBackendDecisionCriteria(): SecretBackendDecisionCriterion[] {
    return clone(this.secretBackendDecisionCriteria);
  }

  listSecretBackendDecisionScores(): SecretBackendDecisionScore[] {
    return clone(this.secretBackendDecisionScores);
  }

  listSecretBackendImplementationScopes(): SecretBackendImplementationScope[] {
    return clone(this.secretBackendImplementationScopes);
  }

  listSecretBackendProviderMappings(): SecretBackendProviderMapping[] {
    return clone(this.secretBackendProviderMappings);
  }

  listSecretBackendDecisionRisks(): SecretBackendDecisionRisk[] {
    return clone(this.secretBackendDecisionRisks);
  }

  listAuthProviderOptions(): AuthProviderOption[] {
    return clone(this.authProviderOptions);
  }

  listAuthRbacMigrationPhases(): AuthRbacMigrationPhase[] {
    return clone(this.authRbacMigrationPhases);
  }

  listAuthRbacReadinessChecks(filter: { category?: AuthRbacReadinessCategory } = {}): AuthRbacReadinessCheck[] {
    return clone(this.authRbacReadinessChecks.filter((check) => filter.category === undefined || check.category === filter.category));
  }

  listAuthRbacProductionRisks(): AuthRbacProductionRisk[] {
    return clone(this.authRbacProductionRisks);
  }

  listTenantBoundaryPlans(): TenantBoundaryPlan[] {
    return clone(this.tenantBoundaryPlans);
  }

  listServiceAccountPlans(): ServiceAccountPlan[] {
    return clone(this.serviceAccountPlans);
  }

  listProductionRbacPermissionMatrix(): AuthRbacPermissionMatrixEntry[] {
    return clone(this.authRbacPermissionMatrix);
  }

  listProductionAuthProviderConfigs(): ProductionAuthProviderConfig[] {
    return clone(this.productionAuthProviderConfigs).map((config) => this.applyProductionAuthProviderEnvStatus(config));
  }

  listProductionAuthProviderReadiness(): ProductionAuthProviderReadiness[] {
    const selected = this.selectedProductionAuthProviderKind();
    return clone(this.productionAuthProviderReadiness).map((readiness) => this.applyProductionAuthProviderReadinessStatus(readiness, selected));
  }

  listSessionTokenBoundaryPlans(): SessionTokenBoundaryPlan[] {
    return clone(this.sessionTokenBoundaryPlans);
  }

  listIdentityMappingPlans(): IdentityMappingPlan[] {
    return clone(this.identityMappingPlans);
  }

  getProductionAuthProviderSkeletonSummary(): ProductionAuthProviderSkeletonSummary {
    const selected = this.selectedProductionAuthProviderKind();
    const configs = this.listProductionAuthProviderConfigs();
    const selectedConfig = configs.find((config) => config.providerKind === selected) ?? configs[0];
    const readiness = this.listProductionAuthProviderReadiness();
    const selectedReadiness = readiness.find((check) => check.providerKind === selected);
    return {
      generatedAt: this.now(),
      status: "v1_implemented",
      planningOnly: true,
      activeProviderKind: "mock",
      selectedProviderKind: selected,
      selectedProviderStatus: selectedConfig?.status ?? "active_mock",
      productionAuthEnabled: false,
      requireAuthForApi: false,
      futureProviderSelected: selected !== "mock",
      futureProviderBlocked: selected !== "mock",
      tokenValidationEnabled: false,
      sessionBoundaryEnabled: false,
      sessionBoundaryStatus: selected === "mock" ? "disabled" : "future",
      identityMappingStatus: selected === "mock" ? "not_configured" : "future",
      externalCallsEnabled: false,
      externalIdpCallsEnabled: false,
      missingConfigCount: selectedReadiness?.missingConfig.length ?? 0,
      blockerCount: selectedReadiness?.blockers.length ?? 0,
      providerOptionCount: configs.length,
      readinessCheckCount: readiness.length,
      sessionBoundaryPlanCount: this.sessionTokenBoundaryPlans.length,
      identityMappingPlanCount: this.identityMappingPlans.length,
      noTokensExposed: true,
      authorizationHeadersStored: false,
      cookiesStored: false,
      sessionIdsExposed: false,
      envValuesExposed: false,
      secretsExposed: false,
      productionReady: false,
      metadata: {
        docs: "docs/foundations/auth-rbac/production-auth-provider-skeleton-v1.md",
        planDocs: "docs/foundations/auth-rbac/production-auth-provider-skeleton-v1-plan.md",
        mockProviderDefault: true,
        enableProductionAuthRequested: flag(this.env.AICHESTRA_ENABLE_PRODUCTION_AUTH),
        requireAuthForApiRequested: flag(this.env.AICHESTRA_REQUIRE_AUTH_FOR_API),
        productionAuthProviderSkeleton: "v1",
        rawEnvValuesReturned: false,
        rawHeadersStored: false,
        cookiesStored: false,
        sessionsIssued: false,
        jwtIssued: false,
        apiKeysIssued: false,
        serviceAccountCredentialsIssued: false,
        externalIdentityProviderCallsEnabled: false
      }
    };
  }

  private selectedProductionAuthProviderKind(): ProductionAuthProviderKind {
    return normalizeProductionAuthProviderKind(this.env.AICHESTRA_AUTH_PROVIDER);
  }

  private applyProductionAuthProviderEnvStatus(config: ProductionAuthProviderConfig): ProductionAuthProviderConfig {
    const selected = this.selectedProductionAuthProviderKind() === config.providerKind;
    const requiredConfig = this.productionAuthProviderRequiredConfig(config);
    const missingConfig = requiredConfig.filter((key) => !stringConfigured(this.env[key]));
    const status = config.providerKind === "mock"
      ? "active_mock"
      : selected && missingConfig.length > 0
        ? "not_configured"
        : selected
          ? "disabled"
          : "future";
    return {
      ...config,
      status,
      issuerConfigured: stringConfigured(this.env.AICHESTRA_AUTH_OIDC_ISSUER),
      audienceConfigured: stringConfigured(this.env.AICHESTRA_AUTH_OIDC_AUDIENCE),
      jwksConfigured: stringConfigured(this.env.AICHESTRA_AUTH_OIDC_JWKS_URI),
      metadataUrlConfigured: stringConfigured(this.env.AICHESTRA_AUTH_SAML_METADATA_URL),
      scimEndpointConfigured: stringConfigured(this.env.AICHESTRA_AUTH_SCIM_ENDPOINT),
      groupMappingConfigured: stringConfigured(this.env.AICHESTRA_AUTH_GROUP_MAPPING),
      tenantMappingConfigured: stringConfigured(this.env.AICHESTRA_AUTH_TENANT_MAPPING),
      sessionBoundaryConfigured: false,
      tokenValidationEnabled: false,
      externalCallsEnabled: false,
      productionReady: false,
      metadata: {
        ...config.metadata,
        selected,
        requiredConfig,
        missingConfig,
        rawEnvValuesReturned: false,
        noTokenValidation: true,
        noSessionIssuance: true,
        noExternalCalls: true
      }
    };
  }

  private applyProductionAuthProviderReadinessStatus(readiness: ProductionAuthProviderReadiness, selected: ProductionAuthProviderKind): ProductionAuthProviderReadiness {
    if (readiness.providerKind === "mock") {
      return {
        ...readiness,
        status: "ready_mock",
        missingConfig: [],
        metadata: {
          ...readiness.metadata,
          selected: selected === "mock",
          productionReady: false,
          rawEnvValuesReturned: false
        }
      };
    }
    const selectedFuture = selected === readiness.providerKind;
    const requiredConfig = [...readiness.requiredConfig];
    const missingConfig = selectedFuture ? requiredConfig.filter((key) => !stringConfigured(this.env[key])) : [];
    return {
      ...readiness,
      status: selectedFuture && missingConfig.length > 0 ? "missing_config" : selectedFuture ? "blocked" : "future",
      missingConfig,
      blockers: selectedFuture ? ["provider_not_implemented", "production_auth_enabled:false"] : [],
      metadata: {
        ...readiness.metadata,
        selected: selectedFuture,
        rawEnvValuesReturned: false,
        noTokenValidation: true,
        noSessionIssuance: true,
        noExternalCalls: true
      }
    };
  }

  private productionAuthProviderRequiredConfig(config: ProductionAuthProviderConfig): string[] {
    return Array.isArray(config.metadata.requiredConfig)
      ? config.metadata.requiredConfig.filter((item): item is string => typeof item === "string")
      : [];
  }

  listPolicyEngineOptions(): PolicyEngineOption[] {
    return clone(this.policyEngineOptions);
  }

  listPolicyBundlePlans(): PolicyBundlePlan[] {
    return clone(this.policyBundlePlans);
  }

  listPolicyDomainMappings(): PolicyDomainMapping[] {
    return clone(this.policyDomainMappings);
  }

  listPolicyBundleReadinessChecks(filter: { category?: PolicyBundleReadinessCategory } = {}): PolicyBundleReadinessCheck[] {
    return clone(this.policyBundleReadinessChecks.filter((check) => filter.category === undefined || check.category === filter.category));
  }

  listPolicyBundleRisks(): PolicyBundleRisk[] {
    return clone(this.policyBundleRisks);
  }

  listPolicyBundleMigrationPhases(): PolicyBundleMigrationPhase[] {
    return clone(this.policyBundleMigrationPhases);
  }

  listPolicyRuntimePocOptions(): PolicyRuntimePocOption[] {
    return clone(this.policyRuntimePocOptions);
  }

  getPolicyRuntimePocInputContract(): PolicyRuntimePocInputContract {
    return clone(this.policyRuntimePocInputContract);
  }

  listPolicyRuntimePocDomainMappings(): PolicyRuntimePocDomainMapping[] {
    return clone(this.policyRuntimePocDomainMappings);
  }

  listPolicyRuntimePocGoldenCases(): PolicyRuntimePocGoldenCase[] {
    return clone(this.policyRuntimePocGoldenCases);
  }

  listPolicyRuntimePocReadinessChecks(filter: { category?: PolicyRuntimePocReadinessCategory } = {}): PolicyRuntimePocReadinessCheck[] {
    return clone(this.policyRuntimePocReadinessChecks.filter((check) => filter.category === undefined || check.category === filter.category));
  }

  listPolicyRuntimePocRisks(): PolicyRuntimePocRisk[] {
    return clone(this.policyRuntimePocRisks);
  }

  getPolicyShadowEvaluationPlan(): PolicyShadowEvaluationPlan {
    return clone(this.policyShadowEvaluationPlan);
  }

  listPolicyShadowComparisonRules(): PolicyShadowComparisonRule[] {
    return clone(this.policyShadowComparisonRules);
  }

  listPolicyShadowMismatches(): PolicyShadowMismatch[] {
    return clone(this.policyShadowMismatches);
  }

  listPolicyShadowMismatchTaxonomy(): PolicyShadowMismatch[] {
    return clone(this.policyShadowMismatches);
  }

  listPolicyShadowEvaluationReports(): PolicyShadowEvaluationReport[] {
    return clone(this.policyShadowEvaluationReports);
  }

  listPolicyShadowReadinessChecks(filter: { category?: PolicyShadowReadinessCategory } = {}): PolicyShadowReadinessCheck[] {
    return clone(this.policyShadowReadinessChecks.filter((check) => filter.category === undefined || check.category === filter.category));
  }

  getStagingDeploymentProfile(): StagingDeploymentProfile {
    return clone(this.stagingDeploymentProfile);
  }

  listStagingIntegrationGates(): StagingIntegrationGate[] {
    return clone(this.stagingIntegrationGates);
  }

  listStagingReadinessChecks(filter: { category?: StagingReadinessCategory } = {}): StagingReadinessCheck[] {
    return clone(this.stagingReadinessChecks.filter((check) => filter.category === undefined || check.category === filter.category));
  }

  listStagingPromotionCriteria(): StagingPromotionCriterion[] {
    return clone(this.stagingPromotionCriteria);
  }

  listStagingRollbackCriteria(): StagingRollbackCriterion[] {
    return clone(this.stagingRollbackCriteria);
  }

  getStagingDeploymentSummary(): StagingDeploymentSummary {
    const currentProfileId = profileFromEnv(this.env.AICHESTRA_DEPLOYMENT_PROFILE);
    const blockers = this.stagingReadinessChecks.filter((check) => check.status === "fail");
    const warnings = this.stagingReadinessChecks.filter((check) => check.status === "warning");
    return {
      generatedAt: this.now(),
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      stagingDeployed: false,
      productionTrafficAllowed: false,
      currentProfileId,
      profileStatus: this.stagingDeploymentProfile.status,
      requiredComponentCount: this.stagingDeploymentProfile.requiredComponents.length,
      requiredEnvGateCount: this.stagingDeploymentProfile.requiredEnvGates.length,
      forbiddenEnvGateCount: this.stagingDeploymentProfile.forbiddenEnvGates.length,
      integrationGateCount: this.stagingIntegrationGates.length,
      allowedGateCount: this.stagingIntegrationGates.filter((gate) => gate.status === "allowed").length,
      gatedGateCount: this.stagingIntegrationGates.filter((gate) => gate.status === "gated").length,
      blockedGateCount: this.stagingIntegrationGates.filter((gate) => gate.status === "blocked").length,
      futureGateCount: this.stagingIntegrationGates.filter((gate) => gate.status === "future").length,
      readinessCheckCount: this.stagingReadinessChecks.length,
      criticalBlockerCount: blockers.filter((check) => check.severity === "critical").length,
      warningCount: warnings.length,
      promotionCriteriaCount: this.stagingPromotionCriteria.length,
      promotionCriteriaMetCount: this.stagingPromotionCriteria.filter((criterion) => criterion.status === "pass").length,
      rollbackCriteriaCount: this.stagingRollbackCriteria.length,
      mockActorWarning: this.authMockActorWarning(currentProfileId === "local" || currentProfileId === "integration" ? "staging" : currentProfileId),
      envFallbackWarning: this.secretBackendEnvFallbackWarning(currentProfileId === "local" || currentProfileId === "integration" ? "staging" : currentProfileId),
      postgresRequired: true,
      apiDashboardRequired: true,
      remoteMergeForbidden: true,
      remoteMcpForbidden: true,
      vendorCliForbidden: true,
      deploymentExecuted: false,
      externalCallsEnabled: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      metadata: {
        docs: "docs/roadmaps/staging-deployment-profile/v0.md",
        planDocs: "docs/roadmaps/staging-deployment-profile/v0-plan.md",
        gateMatrixDocs: "docs/reference/staging-environment-gate-matrix.md",
        profileContractDocs: "docs/roadmaps/staging-deployment-profile/profile-contract-v0.md",
        integrationTestPolicyDocs: "docs/roadmaps/staging-deployment-profile/integration-test-policy-v0.md",
        riskRegisterDocs: "docs/roadmaps/staging-deployment-profile/staging-risk-register-v0.md",
        deploymentImplemented: false,
        infrastructureCodeAdded: false,
        productionReadyClaimed: false,
        externalProviderCallsEnabled: false,
        envValuesReturned: false,
        secretValuesReturned: false
      }
    };
  }

  getStagingDeploymentDryRunProfile(): StagingDeploymentDryRunProfile {
    const reportStatus = this.calculateStagingDryRunOverallStatus(
      this.listStagingDeploymentDryRunSources(),
      this.listStagingDeploymentDryRunChecks(),
      this.listStagingDeploymentDryRunBlockers()
    );
    return clone({
      ...this.stagingDryRunProfile,
      status: reportStatus === "blocked"
        ? "blocked" as const
        : reportStatus === "pass"
          ? "ready_to_evaluate" as const
          : "warning" as const,
      metadata: {
        ...this.stagingDryRunProfile.metadata,
        generatedByService: true,
        noDeploymentExecution: true,
        noExternalCalls: true,
        noIntegrationTestsExecuted: true
      }
    });
  }

  listStagingDeploymentDryRunSources(): StagingDeploymentDryRunSource[] {
    const staging = this.getStagingDeploymentSummary();
    const cicd = this.getCicdPipelineReadinessSummary();
    const database = this.getDatabaseOperationsSummary();
    const githubHardening = this.getGitHubWebhookHardeningSummary();
    const githubIntegration = this.getGitHubAppIntegrationTestReadinessSummary();
    const llmIntegration = this.getLLMIntegrationTestReadinessSummary();
    const auth = this.getAuthRbacProductionSummary();
    const secretBackend = this.getSecretBackendMigrationSummary();
    const policyBundle = this.getPolicyBundleReadinessSummary();
    const environment = this.getEnvironment();
    const options = this.stagingDryRunOptions;
    const unsafeGitEnabled = this.remoteMergeEnabled() || this.remoteForcePushEnabled() || this.remoteBranchDeletionEnabled();
    const vendorCliEnabled = this.vendorCliExecutionEnabled();
    const realMcpTransportEnabled = this.realMcpTransportEnabled();
    const postgresConfiguredForStaging = database.storageProviderKind === "postgres" && database.databaseUrlConfigured;
    const source = (
      sourceKind: StagingDeploymentDryRunSourceKind,
      status: StagingDeploymentDryRunSourceStatus,
      severity: ReadinessSeverity,
      summary: string,
      evidence: string[],
      remediation: string,
      metadata: Record<string, unknown> = {}
    ): StagingDeploymentDryRunSource => ({
      id: `staging_dry_run_source_${sourceKind}`,
      sourceKind,
      status,
      severity,
      summary,
      evidence,
      remediation,
      metadata: {
        readOnly: true,
        deploymentExecuted: false,
        externalCallsExecuted: false,
        secretsReturned: false,
        envValuesReturned: false,
        ...metadata
      }
    });

    return clone([
      source(
        "staging_profile",
        staging.criticalBlockerCount > 0 ? "fail" : staging.warningCount > 0 ? "warning" : "pass",
        staging.criticalBlockerCount > 0 ? "critical" : staging.warningCount > 0 ? "high" : "low",
        "Staging Deployment Profile v0 is available, but current staging readiness still contains rollout blockers.",
        ["docs/roadmaps/staging-deployment-profile/v0.md"],
        "Resolve staging profile fail checks before attempting a real staging validation.",
        {
          profileStatus: staging.profileStatus,
          criticalBlockerCount: staging.criticalBlockerCount,
          warningCount: staging.warningCount
        }
      ),
      source(
        "ci_cd",
        cicd.criticalBlockerCount > 0 ? "fail" : cicd.stagingPromotionReady ? "pass" : "warning",
        cicd.criticalBlockerCount > 0 ? "critical" : "medium",
        "Staging CI/CD Pipeline Planning v0 is available as metadata; no active workflow is created.",
        ["docs/roadmaps/staging-ci-cd-pipeline/v0.md"],
        "Keep validation commands local and add active staging workflow only in a future explicit task.",
        {
          activeWorkflowCreated: cicd.activeWorkflowCreated,
          deploymentWorkflowCreated: cicd.deploymentWorkflowCreated,
          remoteIntegrationTestsEnabledByDefault: cicd.remoteIntegrationTestsEnabledByDefault
        }
      ),
      source(
        "postgres",
        postgresConfiguredForStaging ? "pass" : "fail",
        postgresConfiguredForStaging ? "low" : "high",
        "Persistent DB Production Operations v1 exposes read-only database readiness; staging still requires Postgres configuration.",
        ["docs/roadmaps/persistent-db-production-operations/v1.md"],
        "Use Postgres for staging validation and keep migrations explicitly invoked.",
        {
          storageProviderKind: database.storageProviderKind,
          databaseUrlConfigured: database.databaseUrlConfigured,
          databaseUrlExposed: database.databaseUrlExposed,
          productionDbConnectionAttempted: database.productionDbConnectionAttempted
        }
      ),
      source(
        "github_app",
        githubHardening.blockerCount > 0 ? "warning" : "pass",
        githubHardening.blockerCount > 0 ? "high" : "low",
        "GitHub App hardening is planning-only; live app rollout remains gated and mock-first.",
        ["docs/roadmaps/github-app-production-webhook-hardening/v0.md", "docs/features/real-git-adapter/v2.md"],
        "Keep live GitHub App operations behind explicit gates and SecretRef metadata.",
        {
          githubAppLiveEnabled: githubHardening.githubAppLiveEnabled,
          productionWebhooksEnabled: githubHardening.productionWebhooksEnabled,
          externalCallsEnabled: githubHardening.externalCallsEnabled,
          blockerCount: githubHardening.blockerCount
        }
      ),
      source(
        "github_integration_tests",
        githubIntegration.unsafeGateCount > 0
          ? "fail"
          : githubIntegration.canRunLiveTests
            ? "pass"
            : options.requireLiveGitHubValidation
              ? "fail"
              : "skipped",
        githubIntegration.unsafeGateCount > 0 ? "critical" : options.requireLiveGitHubValidation && !githubIntegration.canRunLiveTests ? "high" : "medium",
        "GitHub App integration-test profile v1 is skipped by default unless every live-test gate is configured.",
        ["docs/roadmaps/github-app-integration-test-profile/v1.md"],
        options.requireLiveGitHubValidation
          ? "Configure all GitHub App integration-test gates or remove live GitHub validation from the staging dry-run requirements."
          : "Keep live GitHub tests skipped until an explicit gated validation run is requested.",
        {
          liveTestsEnabled: githubIntegration.liveTestsEnabled,
          canRunLiveTests: githubIntegration.canRunLiveTests,
          defaultLiveTestsSkipped: githubIntegration.defaultLiveTestsSkipped,
          missingGateCount: githubIntegration.missingGateCount,
          unsafeGateCount: githubIntegration.unsafeGateCount,
          requiredForStaging: Boolean(options.requireLiveGitHubValidation)
        }
      ),
      source(
        "llm_gateway",
        llmIntegration.unsafeGateCount > 0 ? "fail" : llmIntegration.remoteCompletionEnabled && !llmIntegration.canRunLiveTests ? "warning" : "pass",
        llmIntegration.unsafeGateCount > 0 ? "critical" : llmIntegration.remoteCompletionEnabled ? "high" : "low",
        "LLM Gateway v2 stays mock-first by default; remote completion remains gated.",
        ["docs/features/llm-gateway/v2.md"],
        "Use remote LLM only through LLM Gateway v2 gates, model allowlists, budget policy, Auth/RBAC, and Policy checks.",
        {
          remoteLlmEnabled: llmIntegration.remoteLlmEnabled,
          remoteCompletionEnabled: llmIntegration.remoteCompletionEnabled,
          routingMode: llmIntegration.routingMode,
          unsafeGateCount: llmIntegration.unsafeGateCount
        }
      ),
      source(
        "llm_integration_tests",
        llmIntegration.unsafeGateCount > 0
          ? "fail"
          : llmIntegration.canRunLiveTests
            ? "pass"
            : options.requireLiveLLMValidation
              ? "fail"
              : "skipped",
        llmIntegration.unsafeGateCount > 0 ? "critical" : options.requireLiveLLMValidation && !llmIntegration.canRunLiveTests ? "high" : "medium",
        "LLM Gateway integration-test profile v1 is skipped by default unless every live-test gate is configured.",
        ["docs/roadmaps/llm-gateway-integration-test-profile/v1.md"],
        options.requireLiveLLMValidation
          ? "Configure all LLM integration-test gates or remove live LLM validation from staging dry-run requirements."
          : "Keep live LLM tests skipped until an explicit gated validation run is requested.",
        {
          liveTestsEnabled: llmIntegration.liveTestsEnabled,
          canRunLiveTests: llmIntegration.canRunLiveTests,
          defaultLiveTestsSkipped: llmIntegration.defaultLiveTestsSkipped,
          missingGateCount: llmIntegration.missingGateCount,
          unsafeGateCount: llmIntegration.unsafeGateCount,
          requiredForStaging: Boolean(options.requireLiveLLMValidation)
        }
      ),
      source(
        "mcp_gateway",
        realMcpTransportEnabled ? "fail" : "pass",
        realMcpTransportEnabled ? "critical" : "low",
        "MCP Gateway v0 remains mock-first; real transport is disabled for staging dry-run v0.",
        ["docs/features/mcp-gateway/v0.md"],
        "Keep real MCP transport disabled until policy, SecretRef, sandbox, and audit readiness exist.",
        { realMcpTransportEnabled }
      ),
      source(
        "auth_rbac",
        "warning",
        "critical",
        "Production Auth/RBAC v1 Planning exists, but real IdP, sessions, JWT issuance, and service-account credentials are not implemented.",
        ["docs/roadmaps/auth-rbac-production/v1.md"],
        "Treat mock auth as acceptable only for this read-only dry-run; implement production auth before promotion.",
        {
          productionAuthEnabled: auth.productionAuthEnabled,
          authMode: auth.authMode,
          mockActorWarning: auth.mockActorWarning,
          externalIdpCallsEnabled: auth.externalIdpCallsEnabled
        }
      ),
      source(
        "secret_backend",
        "warning",
        "critical",
        "Secret Backend Migration v0 exists, but no real Vault/cloud/custom backend is configured.",
        ["docs/roadmaps/secret-backend-migration/v0.md"],
        "Choose and implement a real secret backend or record a controlled staging fallback decision before provider validation.",
        {
          realSecretBackendConfigured: secretBackend.realSecretBackendConfigured,
          externalCallsEnabled: secretBackend.externalCallsEnabled,
          envFallbackWarning: secretBackend.envFallbackWarning,
          envValuesExposed: secretBackend.envValuesExposed
        }
      ),
      source(
        "secretref_credentials",
        secretBackend.envSecretProviderEnabled ? "warning" : "pass",
        secretBackend.envSecretProviderEnabled ? "medium" : "low",
        "SecretRef-backed provider credential models are implemented with metadata-only env fallback, not a real backend.",
        ["docs/foundations/secretref-provider-credentials/v1.md", "docs/features/secrets-sandbox/v0.md"],
        "Keep credential values out of read models and migrate SecretRef resolution to a real backend later.",
        {
          envSecretProviderEnabled: secretBackend.envSecretProviderEnabled,
          allowedSecretEnvKeyCount: secretBackend.allowedSecretEnvKeyCount,
          credentialResolutionAttempted: secretBackend.credentialResolutionAttempted
        }
      ),
      source(
        "policy_bundle",
        "warning",
        "high",
        "Policy Bundle / OPA-Cedar Planning v0 exists; StaticPolicyEngine remains runtime and dynamic policy execution is disabled.",
        ["docs/roadmaps/policy-bundle-opa-cedar/v0.md"],
        "Keep static policy authoritative until reviewed, signed, testable policy bundles are implemented.",
        {
          externalPolicyEngineEnabled: policyBundle.externalPolicyEngineEnabled,
          dynamicPolicyExecutionEnabled: policyBundle.dynamicPolicyExecutionEnabled,
          policyCodeExecuted: policyBundle.policyCodeExecuted
        }
      ),
      source(
        "observability",
        "warning",
        "high",
        "Observability / Audit Retention v0 is mock-first and read-only; no external observability backend/export is enabled.",
        ["docs/foundations/observability-audit-retention/v0.md"],
        "Add durable audit/metrics/logging readiness before treating staging as operational.",
        {
          externalBackendConfigured: environment.observabilityBackendConfigured,
          auditExportConfigured: environment.auditExportConfigured
        }
      ),
      source(
        "dashboard",
        "pass",
        "low",
        "Dashboard API-backed read models are implemented and remain read-only.",
        ["docs/features/dashboard/v0.md"],
        "Keep dashboard endpoints read-only and sanitized.",
        { dashboardDataSource: environment.dashboardDataSource }
      ),
      source(
        "local_agent",
        vendorCliEnabled ? "fail" : "pass",
        vendorCliEnabled ? "critical" : "low",
        "Local Agent Protocol v1 remains mock/fixture metadata coordination only.",
        ["docs/features/local-agent-protocol/v1.md"],
        "Keep vendor CLI execution and credential-cache reads disabled.",
        { vendorCliExecutionEnabled: vendorCliEnabled, realTransportEnabled: false }
      ),
      source(
        "runner",
        vendorCliEnabled ? "fail" : "pass",
        vendorCliEnabled ? "critical" : "low",
        "Local Agent Runner v1 stays mock-first with command execution disabled by default.",
        ["docs/features/local-agent-runner/v1.md"],
        "Keep command execution disabled outside explicit fixture/temp workspaces and never use vendor CLI execution in staging dry-run.",
        {
          localAgentRunnerEnabled: environment.localAgentRunnerEnabled,
          localCommandExecutionEnabled: environment.localCommandExecutionEnabled,
          vendorCliExecutionEnabled: vendorCliEnabled
        }
      ),
      source(
        "git",
        unsafeGitEnabled ? "fail" : environment.remoteGitEnabled ? "warning" : "pass",
        unsafeGitEnabled ? "critical" : environment.remoteGitEnabled ? "medium" : "low",
        "Real Git Adapter v2 remains mock-first; remote Git is allowed only through explicit safe gates.",
        ["docs/features/real-git-adapter/v2.md"],
        "Keep remote merge, force-push, and branch deletion disabled.",
        {
          remoteGitEnabled: environment.remoteGitEnabled,
          remoteMergeEnabled: this.remoteMergeEnabled(),
          forcePushEnabled: this.remoteForcePushEnabled(),
          branchDeletionEnabled: this.remoteBranchDeletionEnabled()
        }
      )
    ]);
  }

  listStagingDeploymentDryRunChecks(filter: { category?: StagingDeploymentDryRunCheckCategory } = {}): StagingDeploymentDryRunCheck[] {
    const database = this.getDatabaseOperationsSummary();
    const githubIntegration = this.getGitHubAppIntegrationTestReadinessSummary();
    const llmIntegration = this.getLLMIntegrationTestReadinessSummary();
    const options = this.stagingDryRunOptions;
    const validationFailed = options.validationCommandStatus === "fail";
    const secretOrEnvExposureDetected = Boolean(options.secretsExposed || options.envValuesExposed);
    const postgresConfiguredForStaging = database.storageProviderKind === "postgres" && database.databaseUrlConfigured;
    const githubLiveRequired = Boolean(options.requireLiveGitHubValidation);
    const llmLiveRequired = Boolean(options.requireLiveLLMValidation);
    const githubLiveStatus: StagingDeploymentDryRunCheckStatus = githubIntegration.unsafeGateCount > 0
      ? "fail"
      : githubIntegration.canRunLiveTests
        ? "pass"
        : githubLiveRequired
          ? "fail"
          : "skipped";
    const llmLiveStatus: StagingDeploymentDryRunCheckStatus = llmIntegration.unsafeGateCount > 0
      ? "fail"
      : llmIntegration.canRunLiveTests
        ? "pass"
        : llmLiveRequired
          ? "fail"
          : "skipped";
    const check = (
      id: string,
      category: StagingDeploymentDryRunCheckCategory,
      name: string,
      status: StagingDeploymentDryRunCheckStatus,
      severity: ReadinessSeverity,
      requiredForStaging: boolean,
      description: string,
      evidence: string[],
      remediation: string,
      metadata: Record<string, unknown> = {}
    ): StagingDeploymentDryRunCheck => ({
      id,
      category,
      name,
      status,
      severity,
      requiredForStaging,
      description,
      evidence,
      remediation,
      metadata: {
        readOnly: true,
        deploymentExecuted: false,
        externalCallsExecuted: false,
        secretValuesReturned: false,
        envValuesReturned: false,
        ...metadata
      }
    });

    const checks: StagingDeploymentDryRunCheck[] = [
      check(
        "dry_run_validation_commands_status",
        "validation",
        "Validation command status",
        validationFailed ? "fail" : "not_checked",
        "critical",
        true,
        "The dry-run records validation status without executing commands itself.",
        ["docs/roadmaps/staging-deployment-dry-run/v0.md"],
        validationFailed ? "Fix failing validation commands before staging dry-run can be trusted." : "Run normal local validation after implementation.",
        {
          commandsExecutedByDryRun: false,
          failedCommandCount: options.failedValidationCommands?.length ?? 0,
          failedCommands: options.failedValidationCommands ?? []
        }
      ),
      check(
        "dry_run_no_deployment_execution",
        "environment",
        "No deployment execution",
        "pass",
        "critical",
        true,
        "The dry-run produces read models only and never deploys resources.",
        ["AGENTS.md", "docs/roadmaps/staging-deployment-dry-run/v0.md"],
        "Keep deployment commands and infrastructure changes out of this profile.",
        { deploymentExecuted: false, stagingDeployed: false, productionReady: false }
      ),
      check(
        "dry_run_no_external_calls",
        "environment",
        "No external provider calls",
        "pass",
        "critical",
        true,
        "The dry-run does not call GitHub, LLM, MCP, cloud, identity, policy, registry, or observability providers.",
        ["AGENTS.md"],
        "Keep external validation behind separately invoked gated integration-test profiles.",
        { externalCallsExecuted: false }
      ),
      check(
        "dry_run_no_remote_integration_tests",
        "validation",
        "No remote integration tests executed",
        "pass",
        "high",
        true,
        "The dry-run classifies GitHub and LLM integration profiles but does not execute them.",
        ["docs/roadmaps/github-app-integration-test-profile/v1.md", "docs/roadmaps/llm-gateway-integration-test-profile/v1.md"],
        "Run live integration profiles only as explicit, separately gated tasks.",
        { remoteIntegrationTestsExecuted: false }
      ),
      check(
        "dry_run_no_secret_or_env_exposure",
        "security",
        "No secret or env exposure",
        secretOrEnvExposureDetected ? "fail" : "pass",
        "critical",
        true,
        "Dry-run API, dashboard, health, and report data must expose booleans/counts/statuses only.",
        ["packages/deployment-readiness/src/dto.ts"],
        "Redact or remove any secret/env value from read models before continuing.",
        { noSecretsExposed: !options.secretsExposed, envValuesExposed: Boolean(options.envValuesExposed) }
      ),
      check(
        "dry_run_remote_merge_forbidden",
        "git",
        "Remote merge disabled",
        this.remoteMergeEnabled() ? "fail" : "pass",
        "critical",
        true,
        "Remote merge must remain unsupported and disabled for staging dry-run.",
        ["docs/features/real-git-adapter/v2.md"],
        "Set AICHESTRA_ALLOW_REMOTE_MERGE=false or unset it.",
        { remoteMergeEnabled: this.remoteMergeEnabled() }
      ),
      check(
        "dry_run_force_push_forbidden",
        "git",
        "Force push disabled",
        this.remoteForcePushEnabled() ? "fail" : "pass",
        "critical",
        true,
        "Force-push behavior is not part of Real Git Adapter v2 and blocks staging dry-run.",
        ["docs/features/real-git-adapter/v2.md"],
        "Unset force-push gates and keep branch operations non-destructive.",
        { forcePushEnabled: this.remoteForcePushEnabled() }
      ),
      check(
        "dry_run_branch_deletion_forbidden",
        "git",
        "Branch deletion disabled",
        this.remoteBranchDeletionEnabled() ? "fail" : "pass",
        "critical",
        true,
        "Remote branch deletion is not supported and blocks staging dry-run.",
        ["docs/features/real-git-adapter/v2.md"],
        "Unset branch deletion gates.",
        { branchDeletionEnabled: this.remoteBranchDeletionEnabled() }
      ),
      check(
        "dry_run_vendor_cli_forbidden",
        "runner",
        "Vendor CLI execution disabled",
        this.vendorCliExecutionEnabled() ? "fail" : "pass",
        "critical",
        true,
        "Vendor CLI execution and credential-cache reads are outside this milestone.",
        ["docs/features/local-agent-runner/v1.md", "docs/features/local-agent-protocol/v1.md"],
        "Keep command execution and vendor CLI gates disabled.",
        { vendorCliExecutionEnabled: this.vendorCliExecutionEnabled() }
      ),
      check(
        "dry_run_real_mcp_transport_forbidden",
        "mcp",
        "Real MCP transport disabled",
        this.realMcpTransportEnabled() ? "fail" : "pass",
        "critical",
        true,
        "Real MCP transport is blocked until policy, SecretRef, sandbox, and audit readiness exist.",
        ["docs/features/mcp-gateway/v0.md"],
        "Keep AICHESTRA_ENABLE_MCP_REAL_TRANSPORT unset or false.",
        { realMcpTransportEnabled: this.realMcpTransportEnabled() }
      ),
      check(
        "dry_run_postgres_staging_required",
        "storage",
        "Postgres configured for staging",
        postgresConfiguredForStaging ? "pass" : "fail",
        "high",
        true,
        "Staging validation should not rely on in-memory repositories.",
        ["docs/roadmaps/persistent-db-production-operations/v1.md"],
        "Configure Postgres through safe deployment config and rehearse migration/backup/restore planning.",
        { storageProviderKind: database.storageProviderKind, databaseUrlConfigured: database.databaseUrlConfigured }
      ),
      check(
        "dry_run_github_live_profile_classified",
        "github_app",
        "GitHub App integration-test profile classified",
        githubLiveStatus,
        githubIntegration.unsafeGateCount > 0 ? "critical" : githubLiveRequired ? "high" : "medium",
        githubLiveRequired,
        "GitHub live tests are classified without being executed.",
        ["docs/roadmaps/github-app-integration-test-profile/v1.md"],
        githubLiveRequired ? "Configure all live GitHub gates or make the profile optional for this dry-run." : "Leave skipped until an explicit live validation run.",
        {
          liveTestsEnabled: githubIntegration.liveTestsEnabled,
          canRunLiveTests: githubIntegration.canRunLiveTests,
          defaultLiveTestsSkipped: githubIntegration.defaultLiveTestsSkipped,
          missingGateCount: githubIntegration.missingGateCount,
          unsafeGateCount: githubIntegration.unsafeGateCount
        }
      ),
      check(
        "dry_run_llm_live_profile_classified",
        "llm",
        "LLM integration-test profile classified",
        llmLiveStatus,
        llmIntegration.unsafeGateCount > 0 ? "critical" : llmLiveRequired ? "high" : "medium",
        llmLiveRequired,
        "LLM live tests are classified without being executed.",
        ["docs/roadmaps/llm-gateway-integration-test-profile/v1.md"],
        llmLiveRequired ? "Configure all live LLM gates or make the profile optional for this dry-run." : "Leave skipped until an explicit live validation run.",
        {
          liveTestsEnabled: llmIntegration.liveTestsEnabled,
          canRunLiveTests: llmIntegration.canRunLiveTests,
          defaultLiveTestsSkipped: llmIntegration.defaultLiveTestsSkipped,
          missingGateCount: llmIntegration.missingGateCount,
          unsafeGateCount: llmIntegration.unsafeGateCount
        }
      ),
      check(
        "dry_run_mock_auth_warning",
        "auth",
        "Mock auth remains staging warning",
        "warning",
        "critical",
        false,
        "Missing production auth blocks production and remains visible as staging warning.",
        ["docs/roadmaps/auth-rbac-production/v1.md"],
        "Implement real Auth/RBAC before production and before any staging profile that requires real identity.",
        { blockingLevel: "blocks_production_only" }
      ),
      check(
        "dry_run_secret_backend_warning",
        "secrets",
        "Real secret backend missing",
        "warning",
        "critical",
        true,
        "Missing real secret backend blocks meaningful provider validation unless a controlled staging fallback is explicitly accepted.",
        ["docs/roadmaps/secret-backend-migration/v0.md"],
        "Choose a real secret backend or document a controlled staging fallback before provider validation.",
        { blockingLevel: "blocks_staging_deployment" }
      ),
      check(
        "dry_run_policy_bundle_warning",
        "policy",
        "Policy bundle runtime not implemented",
        "warning",
        "high",
        false,
        "StaticPolicyEngine remains authoritative and no dynamic OPA/Cedar execution is enabled.",
        ["docs/roadmaps/policy-bundle-opa-cedar/v0.md"],
        "Keep static policy in place until policy bundle governance is implemented.",
        { dynamicPolicyExecutionEnabled: false, externalPolicyEngineEnabled: false }
      ),
      check(
        "dry_run_observability_warning",
        "observability",
        "External observability backend missing",
        "warning",
        "high",
        true,
        "Observability v0 provides sanitized read models but no external backend/export.",
        ["docs/foundations/observability-audit-retention/v0.md"],
        "Add durable observability and alerting before staging is considered operational.",
        { externalBackendConfigured: false, auditExportConfigured: false }
      ),
      check(
        "dry_run_dashboard_read_model",
        "dashboard",
        "Dashboard read model available",
        "pass",
        "low",
        true,
        "Dashboard API-backed read models expose safe dry-run data.",
        ["docs/features/dashboard/v0.md"],
        "Keep dashboard read-only.",
        { dashboardReadOnly: true }
      ),
      check(
        "dry_run_rollback_guidance_defined",
        "rollback",
        "Rollback guidance defined",
        "pass",
        "medium",
        true,
        "The dry-run report includes rollback guidance without running rollback actions.",
        ["docs/roadmaps/staging-deployment-dry-run/report-format-v0.md"],
        "Keep rollback execution out of this profile.",
        { rollbackExecuted: false }
      )
    ];

    return clone(checks.filter((checkItem) => filter.category === undefined || checkItem.category === filter.category));
  }

  listStagingDeploymentDryRunBlockers(): StagingDeploymentDryRunBlocker[] {
    const checks = this.listStagingDeploymentDryRunChecks();
    const githubIntegration = this.getGitHubAppIntegrationTestReadinessSummary();
    const llmIntegration = this.getLLMIntegrationTestReadinessSummary();
    const options = this.stagingDryRunOptions;
    const blocker = (
      id: string,
      category: StagingDeploymentDryRunCheckCategory | StagingDeploymentDryRunSourceKind,
      title: string,
      severity: ReadinessSeverity,
      blockingLevel: StagingDeploymentDryRunBlocker["blockingLevel"],
      description: string,
      remediation: string,
      sourceIds: string[],
      metadata: Record<string, unknown> = {}
    ): StagingDeploymentDryRunBlocker => ({
      id,
      category,
      title,
      severity,
      blockingLevel,
      description,
      remediation,
      sourceIds,
      status: "open",
      metadata: {
        readOnly: true,
        deploymentExecuted: false,
        externalCallsExecuted: false,
        secretValuesReturned: false,
        envValuesReturned: false,
        ...metadata
      }
    });
    const blockers: StagingDeploymentDryRunBlocker[] = [];

    for (const checkItem of checks.filter((check) => check.status === "fail")) {
      const level: StagingDeploymentDryRunBlocker["blockingLevel"] = checkItem.severity === "critical"
        ? "blocks_staging_dry_run"
        : "blocks_staging_deployment";
      blockers.push(blocker(
        `blocker_${checkItem.id}`,
        checkItem.category,
        checkItem.name,
        checkItem.severity,
        level,
        checkItem.description,
        checkItem.remediation,
        [checkItem.id],
        checkItem.metadata
      ));
    }

    blockers.push(
      blocker(
        "blocker_missing_secret_backend",
        "secret_backend",
        "Real secret backend missing",
        "critical",
        "blocks_staging_deployment",
        "Staging provider validation is not meaningful until secret resolution no longer depends on local env fallback, unless a controlled staging fallback is explicitly accepted.",
        "Choose and implement a real secret backend or document a controlled non-production fallback decision.",
        ["staging_dry_run_source_secret_backend", "dry_run_secret_backend_warning"],
        { productionBlocker: true, realSecretBackendConfigured: false }
      ),
      blocker(
        "blocker_mock_auth_production",
        "auth_rbac",
        "Production auth missing",
        "critical",
        "blocks_production_only",
        "Mock auth can support this read-only dry-run but cannot be promoted to production.",
        "Implement production Auth/RBAC and tenant-aware request context before production.",
        ["staging_dry_run_source_auth_rbac", "dry_run_mock_auth_warning"],
        { productionAuthEnabled: false }
      ),
      blocker(
        "blocker_policy_bundle_planning_only",
        "policy_bundle",
        "Managed policy bundles missing",
        "high",
        "blocks_production_only",
        "Policy bundle planning exists, but runtime policy still uses static TypeScript rules.",
        "Keep StaticPolicyEngine authoritative until signed policy bundles are implemented and tested.",
        ["staging_dry_run_source_policy_bundle", "dry_run_policy_bundle_warning"],
        { dynamicPolicyExecutionEnabled: false }
      ),
      blocker(
        "blocker_observability_backend_missing",
        "observability",
        "External observability backend missing",
        "high",
        "blocks_staging_deployment",
        "The dry-run can report readiness, but staging operations need durable logs, metrics, audit retention, and alerting.",
        "Add durable observability planning or implementation before operational staging validation.",
        ["staging_dry_run_source_observability", "dry_run_observability_warning"],
        { externalBackendConfigured: false }
      )
    );

    if (githubIntegration.unsafeGateCount > 0) {
      blockers.push(blocker(
        "blocker_github_integration_unsafe_gates",
        "github_integration_tests",
        "GitHub integration-test unsafe gates enabled",
        "critical",
        "blocks_staging_dry_run",
        "Unsafe GitHub integration-test gates are enabled in the environment metadata.",
        "Disable remote merge, force-push, branch deletion, unverified webhook acceptance, raw private-key env values, and branch-prefix mismatches.",
        ["staging_dry_run_source_github_integration_tests", "dry_run_github_live_profile_classified"],
        { unsafeGateCount: githubIntegration.unsafeGateCount, unsafeGateWarnings: githubIntegration.unsafeGateWarnings }
      ));
    } else if (options.requireLiveGitHubValidation && !githubIntegration.canRunLiveTests) {
      blockers.push(blocker(
        "blocker_github_live_validation_required",
        "github_integration_tests",
        "GitHub live validation required but gated",
        "high",
        "blocks_staging_deployment",
        "The staging dry-run requires live GitHub validation, but required gates are missing.",
        "Configure every GitHub App integration-test gate or make the profile optional.",
        ["staging_dry_run_source_github_integration_tests", "dry_run_github_live_profile_classified"],
        { missingGateCount: githubIntegration.missingGateCount }
      ));
    }

    if (llmIntegration.unsafeGateCount > 0) {
      blockers.push(blocker(
        "blocker_llm_integration_unsafe_gates",
        "llm_integration_tests",
        "LLM integration-test unsafe gates enabled",
        "critical",
        "blocks_staging_dry_run",
        "Unsafe LLM integration-test gates are enabled in the environment metadata.",
        "Disable unbounded fallback, streaming, tool calls, BYOK/OAuth/WIF/IAM, credential cache references, invalid budgets, and model allowlist mismatches.",
        ["staging_dry_run_source_llm_integration_tests", "dry_run_llm_live_profile_classified"],
        { unsafeGateCount: llmIntegration.unsafeGateCount, unsafeGateWarnings: llmIntegration.unsafeGateWarnings }
      ));
    } else if (options.requireLiveLLMValidation && !llmIntegration.canRunLiveTests) {
      blockers.push(blocker(
        "blocker_llm_live_validation_required",
        "llm_integration_tests",
        "LLM live validation required but gated",
        "high",
        "blocks_staging_deployment",
        "The staging dry-run requires live LLM validation, but required gates are missing.",
        "Configure every LLM Gateway integration-test gate or make the profile optional.",
        ["staging_dry_run_source_llm_integration_tests", "dry_run_llm_live_profile_classified"],
        { missingGateCount: llmIntegration.missingGateCount }
      ));
    }

    return clone(blockers);
  }

  generateStagingDeploymentDryRunReport(): StagingDeploymentDryRunReport {
    const profile = this.getStagingDeploymentDryRunProfile();
    const sources = this.listStagingDeploymentDryRunSources();
    const checks = this.listStagingDeploymentDryRunChecks();
    const blockers = this.listStagingDeploymentDryRunBlockers();
    const integrationProfiles = this.getStagingDryRunIntegrationProfiles();
    const overallStatus = this.calculateStagingDryRunOverallStatus(sources, checks, blockers);
    const criticalBlockerCount = blockers.filter((blockerItem) => blockerItem.status === "open" && blockerItem.severity === "critical").length;
    const skippedProfiles = integrationProfiles.filter((profileItem) => profileItem.status === "skipped");
    return clone({
      id: "staging_dry_run_report_v0",
      generatedAt: this.now(),
      overallStatus,
      summary: overallStatus === "blocked"
        ? "Staging deployment validation is blocked by critical readiness or safety blockers."
        : overallStatus === "not_ready"
          ? "Staging deployment validation is not ready; resolve high-priority rollout blockers first."
          : overallStatus === "pass_with_warnings"
            ? "The dry-run passed with warnings and skipped optional integration profiles."
            : "The dry-run passed all required read-only checks.",
      profile,
      sourceSummaries: sources,
      checks,
      blockers,
      integrationProfiles,
      promotionGuidance: [
        "Do not mark staging as deployed from this report.",
        "Resolve all blocks_staging_dry_run and blocks_staging_deployment blockers before attempting deployment validation.",
        "Run normal local validation commands outside the dry-run report.",
        "Run optional GitHub App or LLM live profiles only as explicit gated validation tasks."
      ],
      rollbackGuidance: [
        "Because this profile does not deploy anything, rollback is limited to reverting configuration proposals and documentation changes.",
        "If a future staging validation exposes secret/env data, revoke exposed credentials out of band and block the dry-run until sanitized.",
        "If a future staging validation enables destructive Git or vendor CLI capabilities, disable gates before retrying."
      ],
      recommendedNextActions: this.stagingDryRunRecommendedNextActions(blockers, skippedProfiles),
      metadata: {
        docs: "docs/roadmaps/staging-deployment-dry-run/v0.md",
        reportFormatDocs: "docs/roadmaps/staging-deployment-dry-run/report-format-v0.md",
        blockerTaxonomyDocs: "docs/roadmaps/staging-deployment-dry-run/blocker-taxonomy-v0.md",
        sourceCount: sources.length,
        checkCount: checks.length,
        blockerCount: blockers.length,
        criticalBlockerCount,
        skippedIntegrationProfileCount: skippedProfiles.length,
        deploymentExecuted: false,
        externalCallsExecuted: false,
        remoteIntegrationTestsExecuted: false,
        secretsReturned: false,
        envValuesReturned: false,
        productionReady: false,
        stagingDeployed: false
      }
    });
  }

  getStagingDeploymentDryRunSummary(): StagingDeploymentDryRunSummary {
    const report = this.generateStagingDeploymentDryRunReport();
    const sources = report.sourceSummaries;
    const checks = report.checks;
    const blockers = report.blockers;
    const integrationProfiles = report.integrationProfiles;
    const warnings = checks.filter((check) => check.status === "warning").length +
      sources.filter((source) => source.status === "warning" || source.status === "skipped").length;
    const sourceRequired = new Set(this.stagingDryRunProfile.requiredReadinessSources);
    const sourceOptional = new Set(this.stagingDryRunProfile.optionalReadinessSources);
    return clone({
      generatedAt: report.generatedAt,
      status: "v0_implemented",
      planningOnly: true,
      dryRunMode: "read_only",
      overallStatus: report.overallStatus,
      profileStatus: report.profile.status,
      productionReady: false,
      stagingDeployed: false,
      deploymentExecuted: false,
      externalCallsEnabled: false,
      remoteIntegrationTestsExecuted: false,
      validationCommandsExecuted: false,
      sourceCount: sources.length,
      requiredSourceCount: sources.filter((source) => sourceRequired.has(source.sourceKind)).length,
      optionalSourceCount: sources.filter((source) => sourceOptional.has(source.sourceKind)).length,
      sourcesByStatus: countDryRunSourcesByStatus(sources),
      checkCount: checks.length,
      requiredCheckCount: checks.filter((check) => check.requiredForStaging).length,
      checksByStatus: countDryRunChecksByStatus(checks),
      blockerCount: blockers.length,
      criticalBlockerCount: blockers.filter((blockerItem) => blockerItem.status === "open" && blockerItem.severity === "critical").length,
      warningCount: warnings,
      integrationProfileCount: integrationProfiles.length,
      integrationProfilesByStatus: countDryRunIntegrationProfilesByStatus(integrationProfiles),
      skippedIntegrationProfileCount: integrationProfiles.filter((profileItem) => profileItem.status === "skipped").length,
      recommendedNextActionCount: report.recommendedNextActions.length,
      noSecretsExposed: !this.stagingDryRunOptions.secretsExposed,
      envValuesExposed: Boolean(this.stagingDryRunOptions.envValuesExposed),
      productionReadyClaimed: false,
      stagingDeploymentClaimed: false,
      metadata: {
        docs: "docs/roadmaps/staging-deployment-dry-run/v0.md",
        reportId: report.id,
        reportFormatDocs: "docs/roadmaps/staging-deployment-dry-run/report-format-v0.md",
        blockerTaxonomyDocs: "docs/roadmaps/staging-deployment-dry-run/blocker-taxonomy-v0.md",
        deploymentImplemented: false,
        infrastructureCodeAdded: false,
        externalProviderCallsEnabled: false,
        envValuesReturned: false,
        secretValuesReturned: false
      }
    });
  }

  getStagingReleaseCandidateChecklist(): StagingReleaseCandidateChecklist {
    const gates = this.listStagingReleaseCandidateGates();
    const blockers = this.listStagingReleaseCandidateBlockers();
    const signoffs = this.listStagingReleaseCandidateSignoffs();
    const releaseNotes = this.listStagingReleaseNoteRequirements();
    const rollback = this.listStagingRollbackChecklist();
    const overallStatus = this.calculateStagingReleaseCandidateOverallStatus(gates, blockers, signoffs, releaseNotes, rollback);
    return clone({
      ...this.stagingReleaseCandidateChecklist,
      status: overallStatus === "pass"
        ? "pass" as const
        : overallStatus === "pass_with_warnings"
          ? "pass_with_warnings" as const
          : overallStatus === "blocked"
            ? "blocked" as const
            : "not_ready" as const,
      metadata: {
        ...this.stagingReleaseCandidateChecklist.metadata,
        generatedByService: true,
        noReleaseCreation: true,
        noDeploymentExecution: true,
        noExternalCalls: true,
        noIntegrationTestsExecuted: true
      }
    });
  }

  listStagingReleaseCandidateGates(filter: { category?: StagingReleaseCandidateGateCategory } = {}): StagingReleaseCandidateGate[] {
    const dryRun = this.getStagingDeploymentDryRunSummary();
    const cicd = this.getCicdPipelineReadinessSummary();
    const githubIntegration = this.getGitHubAppIntegrationTestReadinessSummary();
    const llmIntegration = this.getLLMIntegrationTestReadinessSummary();
    const database = this.getDatabaseOperationsSummary();
    const auth = this.getAuthRbacProductionSummary();
    const secretBackend = this.getSecretBackendMigrationSummary();
    const policyBundle = this.getPolicyBundleReadinessSummary();
    const deployment = this.getSummary();
    const options = this.stagingReleaseCandidateOptions;
    const validationStatus = options.validationCommandStatus ?? "not_checked";
    const diffStatus = options.diffCheckStatus ?? "not_checked";
    const failedCommands = new Set(options.failedValidationCommands ?? []);
    const validationGateStatus = (command: string): StagingReleaseCandidateGateStatus => {
      if (validationStatus === "pass") return "pass";
      if (validationStatus === "fail" && (failedCommands.size === 0 || failedCommands.has(command))) return "fail";
      return validationStatus === "fail" ? "not_checked" : "not_checked";
    };
    const docsMissing = (options.missingRequiredDocs ?? []).length > 0;
    const secretOrEnvExposure = Boolean(options.secretsExposed || options.envValuesExposed);
    const releaseOrDeploymentExecuted = Boolean(options.releaseCreated || options.gitTagCreated || options.githubReleaseCreated || options.deploymentExecuted || options.externalCallsExecuted);
    const overclaimDetected = Boolean(options.productionReadyClaimed || options.stagingDeployedClaimed);
    const gate = (
      id: string,
      category: StagingReleaseCandidateGateCategory,
      name: string,
      status: StagingReleaseCandidateGateStatus,
      required: boolean,
      severity: ReadinessSeverity,
      description: string,
      evidence: string[],
      remediation: string,
      metadata: Record<string, unknown> = {}
    ): StagingReleaseCandidateGate => ({
      id,
      category,
      name,
      status,
      required,
      severity,
      description,
      evidence,
      remediation,
      metadata: {
        readOnly: true,
        releaseCreated: false,
        gitTagCreated: false,
        githubReleaseCreated: false,
        deploymentExecuted: false,
        externalCallsExecuted: false,
        secretValuesReturned: false,
        envValuesReturned: false,
        ...metadata
      }
    });

    const gates: StagingReleaseCandidateGate[] = [
      gate(
        "staging_rc_pnpm_lint",
        "validation",
        "pnpm lint",
        validationGateStatus("pnpm lint"),
        true,
        validationStatus === "fail" && (failedCommands.size === 0 || failedCommands.has("pnpm lint")) ? "critical" : "high",
        "The lint gate must pass before a branch can be called a staging release candidate.",
        ["README.md", "docs/roadmaps/staging-ci-cd-pipeline/v0.md"],
        "Run pnpm lint and fix reported issues.",
        { commandExecutedByChecklist: false }
      ),
      gate(
        "staging_rc_pnpm_typecheck",
        "validation",
        "pnpm typecheck",
        validationGateStatus("pnpm typecheck"),
        true,
        validationStatus === "fail" && (failedCommands.size === 0 || failedCommands.has("pnpm typecheck")) ? "critical" : "high",
        "The TypeScript typecheck gate must pass before staging RC designation.",
        ["README.md"],
        "Run pnpm typecheck and fix type errors.",
        { commandExecutedByChecklist: false }
      ),
      gate(
        "staging_rc_pnpm_test",
        "validation",
        "pnpm test",
        validationGateStatus("pnpm test"),
        true,
        validationStatus === "fail" && (failedCommands.size === 0 || failedCommands.has("pnpm test")) ? "critical" : "high",
        "The deterministic test suite must pass before staging RC designation.",
        ["README.md"],
        "Run pnpm test and fix failures.",
        { commandExecutedByChecklist: false }
      ),
      gate(
        "staging_rc_pnpm_build",
        "validation",
        "pnpm build",
        validationGateStatus("pnpm build"),
        true,
        validationStatus === "fail" && (failedCommands.size === 0 || failedCommands.has("pnpm build")) ? "critical" : "high",
        "The scaffold build smoke check must pass before staging RC designation.",
        ["README.md"],
        "Run pnpm build and fix failures.",
        { commandExecutedByChecklist: false }
      ),
      gate(
        "staging_rc_git_diff_check",
        "validation",
        "git diff --check",
        diffStatus === "fail" ? "fail" : diffStatus === "warning" ? "warning" : diffStatus === "pass" ? "pass" : "not_checked",
        true,
        diffStatus === "fail" ? "critical" : "high",
        "Whitespace validation must pass; documented line-ending-only issues may be treated as warnings.",
        ["docs/roadmaps/staging-release-candidate/v0-plan.md"],
        diffStatus === "fail" ? "Fix git diff --check errors." : "Run git diff --check before RC designation.",
        { commandExecutedByChecklist: false, knownWarnings: options.knownDiffCheckWarnings ?? [] }
      ),
      gate(
        "staging_rc_safe_integration_scan",
        "security",
        "Safe integration compliance scan",
        validationStatus === "pass" ? "pass" : validationStatus === "fail" ? "fail" : "not_checked",
        true,
        validationStatus === "fail" ? "critical" : "high",
        "The RC checklist requires a scan for direct external calls, unsafe release/deployment behavior, and secret exposure.",
        ["docs/roadmaps/staging-release-candidate/v0.md"],
        "Run the safe integration scan and classify findings before RC designation.",
        { scanExecutedByChecklist: false }
      ),
      gate(
        "staging_rc_required_docs_present",
        "docs",
        "Required RC docs present",
        docsMissing ? "fail" : "pass",
        true,
        docsMissing ? "high" : "low",
        "The RC checklist, report format, release notes template, rollback checklist, README, AGENTS, and index docs must be present.",
        ["docs/README.md", "README.md", "AGENTS.md"],
        "Add missing required docs before RC designation.",
        { missingRequiredDocs: options.missingRequiredDocs ?? [] }
      ),
      gate(
        "staging_rc_dry_run_reviewed",
        "staging_dry_run",
        "Staging dry-run reviewed",
        dryRun.overallStatus === "pass" ? "pass" : dryRun.overallStatus === "pass_with_warnings" ? "warning" : dryRun.overallStatus === "blocked" ? "fail" : "warning",
        true,
        dryRun.overallStatus === "blocked" ? "high" : "medium",
        "The staging dry-run report must be reviewed before RC designation. Production-only blockers can be accepted as documented limitations for v0.",
        ["docs/roadmaps/staging-deployment-dry-run/v0.md"],
        "Resolve blocks_staging_dry_run blockers and document accepted staging limitations.",
        { dryRunOverallStatus: dryRun.overallStatus, dryRunCriticalBlockerCount: dryRun.criticalBlockerCount }
      ),
      gate(
        "staging_rc_cicd_baseline",
        "ci_cd",
        "CI/CD baseline planned",
        cicd.criticalBlockerCount > 0 ? "fail" : cicd.activeWorkflowCreated ? "warning" : "pass",
        true,
        cicd.criticalBlockerCount > 0 ? "critical" : "medium",
        "Staging CI/CD planning must define the required local validation profile without creating active deployment workflows.",
        ["docs/roadmaps/staging-ci-cd-pipeline/v0.md"],
        "Keep active workflows out of this task and use the documented local validation profile.",
        { activeWorkflowCreated: cicd.activeWorkflowCreated, deploymentWorkflowCreated: cicd.deploymentWorkflowCreated }
      ),
      gate(
        "staging_rc_optional_postgres_profile_documented",
        "db",
        "Optional Postgres profile documented",
        database.testDatabaseUrlConfigured ? "pass" : "skipped",
        false,
        "medium",
        "Optional Postgres repository contracts may skip unless the test database URL is configured.",
        ["docs/roadmaps/persistent-db-production-operations/v1.md"],
        "Document the skip in release notes when the optional Postgres URL is absent.",
        { testDatabaseUrlConfigured: database.testDatabaseUrlConfigured, databaseUrlExposed: database.databaseUrlExposed }
      ),
      gate(
        "staging_rc_github_integration_profile_documented",
        "git_integration",
        "GitHub integration-test profile documented",
        githubIntegration.unsafeGateCount > 0 ? "fail" : githubIntegration.canRunLiveTests ? "pass" : "skipped",
        false,
        githubIntegration.unsafeGateCount > 0 ? "critical" : "medium",
        "GitHub App integration-test profile v1 is optional and skipped by default unless all live gates are configured.",
        ["docs/roadmaps/github-app-integration-test-profile/v1.md"],
        "Keep skipped by default or run as a separate gated live validation task.",
        { canRunLiveTests: githubIntegration.canRunLiveTests, missingGateCount: githubIntegration.missingGateCount, unsafeGateCount: githubIntegration.unsafeGateCount }
      ),
      gate(
        "staging_rc_llm_integration_profile_documented",
        "llm_integration",
        "LLM integration-test profile documented",
        llmIntegration.unsafeGateCount > 0 ? "fail" : llmIntegration.canRunLiveTests ? "pass" : "skipped",
        false,
        llmIntegration.unsafeGateCount > 0 ? "critical" : "medium",
        "LLM Gateway integration-test profile v1 is optional and skipped by default unless all live gates are configured.",
        ["docs/roadmaps/llm-gateway-integration-test-profile/v1.md"],
        "Keep skipped by default or run as a separate gated live validation task.",
        { canRunLiveTests: llmIntegration.canRunLiveTests, missingGateCount: llmIntegration.missingGateCount, unsafeGateCount: llmIntegration.unsafeGateCount }
      ),
      gate(
        "staging_rc_remote_merge_forbidden",
        "git_integration",
        "Remote merge disabled",
        this.remoteMergeEnabled() ? "fail" : "pass",
        true,
        "critical",
        "Remote merge must remain unsupported for staging RC v0.",
        ["docs/features/real-git-adapter/v2.md"],
        "Unset AICHESTRA_ALLOW_REMOTE_MERGE.",
        { remoteMergeEnabled: this.remoteMergeEnabled() }
      ),
      gate(
        "staging_rc_force_push_forbidden",
        "git_integration",
        "Force push disabled",
        this.remoteForcePushEnabled() ? "fail" : "pass",
        true,
        "critical",
        "Force push is destructive and blocks staging RC designation.",
        ["docs/features/real-git-adapter/v2.md"],
        "Unset force-push gates.",
        { forcePushEnabled: this.remoteForcePushEnabled() }
      ),
      gate(
        "staging_rc_branch_deletion_forbidden",
        "git_integration",
        "Branch deletion disabled",
        this.remoteBranchDeletionEnabled() ? "fail" : "pass",
        true,
        "critical",
        "Branch deletion is destructive and blocks staging RC designation.",
        ["docs/features/real-git-adapter/v2.md"],
        "Unset branch deletion gates.",
        { branchDeletionEnabled: this.remoteBranchDeletionEnabled() }
      ),
      gate(
        "staging_rc_real_mcp_transport_forbidden",
        "mcp",
        "Real MCP transport disabled",
        this.realMcpTransportEnabled() ? "fail" : "pass",
        true,
        "critical",
        "Real MCP transport remains out of scope for staging RC v0.",
        ["docs/features/mcp-gateway/v0.md"],
        "Keep AICHESTRA_ENABLE_MCP_REAL_TRANSPORT unset or false.",
        { realMcpTransportEnabled: this.realMcpTransportEnabled() }
      ),
      gate(
        "staging_rc_vendor_cli_forbidden",
        "security",
        "Vendor CLI execution disabled",
        this.vendorCliExecutionEnabled() ? "fail" : "pass",
        true,
        "critical",
        "Vendor CLI execution and credential-cache reads block staging RC designation.",
        ["docs/features/local-agent-runner/v1.md", "docs/features/local-agent-protocol/v1.md"],
        "Keep vendor CLI and local command execution gates disabled.",
        { vendorCliExecutionEnabled: this.vendorCliExecutionEnabled() }
      ),
      gate(
        "staging_rc_no_secret_or_env_exposure",
        "security",
        "No secret or env exposure",
        secretOrEnvExposure ? "fail" : "pass",
        true,
        "critical",
        "No readiness, health, API, dashboard, report, release-note, or rollback output may expose secret/env values.",
        ["packages/deployment-readiness/src/dto.ts", "packages/shared/src/dashboard-read-models.ts"],
        "Redact or remove exposed secret/env values before RC designation.",
        { noSecretsExposed: !options.secretsExposed, envValuesExposed: Boolean(options.envValuesExposed) }
      ),
      gate(
        "staging_rc_no_release_or_deployment_execution",
        "security",
        "No release or deployment execution",
        releaseOrDeploymentExecuted ? "fail" : "pass",
        true,
        "critical",
        "The RC checklist must not create releases, Git tags, GitHub releases, deployments, or external calls.",
        ["AGENTS.md", "docs/roadmaps/staging-release-candidate/v0-plan.md"],
        "Remove release/deployment side effects and rerun validation.",
        {
          releaseCreated: Boolean(options.releaseCreated),
          gitTagCreated: Boolean(options.gitTagCreated),
          githubReleaseCreated: Boolean(options.githubReleaseCreated),
          deploymentExecuted: Boolean(options.deploymentExecuted),
          externalCallsExecuted: Boolean(options.externalCallsExecuted)
        }
      ),
      gate(
        "staging_rc_no_ready_overclaim",
        "docs",
        "No staging/production overclaim",
        overclaimDetected ? "fail" : "pass",
        true,
        "critical",
        "Docs, health, dashboard, and reports must not claim staging is deployed or production is ready.",
        ["docs/roadmaps/production-deployment-readiness/checklist-v0.md"],
        "Remove overclaims and keep productionReady=false and stagingDeployed=false.",
        { productionReadyClaimed: Boolean(options.productionReadyClaimed), stagingDeployedClaimed: Boolean(options.stagingDeployedClaimed) }
      ),
      gate(
        "staging_rc_production_auth_documented",
        "auth",
        "Production auth limitation documented",
        auth.productionAuthEnabled ? "pass" : "warning",
        false,
        "medium",
        "Missing production auth is a production blocker, but not a staging RC blocker when documented.",
        ["docs/roadmaps/auth-rbac-production/v1.md"],
        "Keep this limitation in release notes and do not call production ready.",
        { productionAuthEnabled: auth.productionAuthEnabled, blockingLevel: "blocks_production_only" }
      ),
      gate(
        "staging_rc_secret_backend_documented",
        "secrets",
        "Secret backend limitation documented",
        secretBackend.realSecretBackendConfigured ? "pass" : "warning",
        false,
        "medium",
        "Missing real secret backend is a production blocker and accepted staging RC limitation only when documented.",
        ["docs/roadmaps/secret-backend-migration/v0.md"],
        "Document the limitation and avoid live provider validation without a controlled SecretRef path.",
        { realSecretBackendConfigured: secretBackend.realSecretBackendConfigured, blockingLevel: "blocks_production_only" }
      ),
      gate(
        "staging_rc_policy_bundle_documented",
        "policy",
        "Policy bundle limitation documented",
        policyBundle.dynamicPolicyExecutionEnabled ? "fail" : "warning",
        false,
        policyBundle.dynamicPolicyExecutionEnabled ? "critical" : "medium",
        "Policy Bundle / OPA-Cedar remains planning-only; StaticPolicyEngine stays runtime.",
        ["docs/roadmaps/policy-bundle-opa-cedar/v0.md"],
        "Keep dynamic policy execution disabled and document production limitation.",
        { dynamicPolicyExecutionEnabled: policyBundle.dynamicPolicyExecutionEnabled }
      ),
      gate(
        "staging_rc_observability_documented",
        "observability",
        "Observability limitation documented",
        deployment.missingProductionRequirements.includes("durable_observability_backend") ? "warning" : "pass",
        false,
        "medium",
        "Observability v0 is read-only and local; external backend/export remains future work.",
        ["docs/foundations/observability-audit-retention/v0.md"],
        "Document limitation and do not treat staging as operationally deployed.",
        { externalObservabilityBackendConfigured: false }
      ),
      gate(
        "staging_rc_dashboard_readiness",
        "dashboard",
        "Dashboard/readiness panel available",
        "pass",
        true,
        "low",
        "Dashboard API read models expose staging RC status without secrets.",
        ["docs/features/dashboard/v0.md"],
        "Keep dashboard endpoints read-only and sanitized.",
        { dashboardReadOnly: true }
      ),
      gate(
        "staging_rc_rollback_checklist_defined",
        "rollback",
        "Rollback checklist defined",
        "pass",
        true,
        "medium",
        "The RC checklist defines rollback expectations without executing rollback.",
        ["docs/roadmaps/staging-release-candidate/rollback-checklist-v0.md"],
        "Keep rollback execution out of this profile.",
        { rollbackExecuted: false }
      )
    ];

    return clone(gates.filter((gateItem) => filter.category === undefined || gateItem.category === filter.category));
  }

  listStagingReleaseCandidateBlockers(): StagingReleaseCandidateBlocker[] {
    const gates = this.listStagingReleaseCandidateGates();
    const signoffs = this.listStagingReleaseCandidateSignoffs();
    const releaseNotes = this.listStagingReleaseNoteRequirements();
    const rollback = this.listStagingRollbackChecklist();
    const dryRunReport = this.generateStagingDeploymentDryRunReport();
    const blocker = (
      id: string,
      category: StagingReleaseCandidateBlocker["category"],
      title: string,
      severity: ReadinessSeverity,
      blockingLevel: StagingReleaseCandidateBlocker["blockingLevel"],
      description: string,
      evidence: string[],
      remediation: string,
      source: string,
      status: StagingReleaseCandidateBlocker["status"] = "open",
      metadata: Record<string, unknown> = {}
    ): StagingReleaseCandidateBlocker => ({
      id,
      category,
      title,
      severity,
      blockingLevel,
      description,
      evidence,
      remediation,
      source,
      status,
      metadata: {
        readOnly: true,
        releaseCreated: false,
        deploymentExecuted: false,
        externalCallsExecuted: false,
        secretValuesReturned: false,
        envValuesReturned: false,
        ...metadata
      }
    });
    const blockers: StagingReleaseCandidateBlocker[] = [];

    for (const gateItem of gates.filter((gate) => gate.status === "fail")) {
      blockers.push(blocker(
        `blocker_${gateItem.id}`,
        gateItem.category,
        gateItem.name,
        gateItem.severity,
        gateItem.severity === "critical" ? "blocks_release_candidate" : "blocks_release_candidate",
        gateItem.description,
        gateItem.evidence,
        gateItem.remediation,
        gateItem.id,
        "open",
        gateItem.metadata
      ));
    }

    for (const gateItem of gates.filter((gate) => gate.required && gate.status === "not_checked")) {
      blockers.push(blocker(
        `blocker_${gateItem.id}_not_checked`,
        gateItem.category,
        `${gateItem.name} not checked`,
        "high",
        "blocks_release_candidate",
        "Required RC validation gate has not been checked.",
        gateItem.evidence,
        gateItem.remediation,
        gateItem.id,
        "open",
        gateItem.metadata
      ));
    }

    for (const dryRunBlocker of dryRunReport.blockers.filter((item) => item.blockingLevel === "blocks_staging_dry_run" && item.status === "open")) {
      blockers.push(blocker(
        `blocker_staging_rc_${dryRunBlocker.id}`,
        "staging_dry_run",
        dryRunBlocker.title,
        dryRunBlocker.severity,
        "blocks_release_candidate",
        dryRunBlocker.description,
        dryRunBlocker.sourceIds,
        dryRunBlocker.remediation,
        dryRunBlocker.id,
        "open",
        dryRunBlocker.metadata
      ));
    }

    for (const signoff of signoffs.filter((item) => item.required && item.status === "pending")) {
      blockers.push(blocker(
        `blocker_staging_rc_signoff_${signoff.role}`,
        "security",
        `${signoff.role} signoff pending`,
        "high",
        "blocks_release_candidate",
        "Required staging RC signoff is pending.",
        ["docs/roadmaps/staging-release-candidate/v0.md"],
        "Record required signoff or an explicit waiver before RC designation.",
        signoff.id,
        "open",
        { role: signoff.role }
      ));
    }

    for (const note of releaseNotes.filter((item) => item.required && item.status === "missing")) {
      blockers.push(blocker(
        `blocker_staging_rc_release_note_${note.section}`,
        "docs",
        `${note.section} release note section missing`,
        "high",
        "blocks_release_candidate",
        "Required release-note section is missing.",
        ["docs/roadmaps/staging-release-candidate/release-notes-template-v0.md"],
        "Add the required release-note section before RC designation.",
        note.id,
        "open",
        { section: note.section }
      ));
    }

    for (const item of rollback.filter((entry) => entry.required && entry.status === "missing")) {
      blockers.push(blocker(
        `blocker_staging_rc_rollback_${item.category}`,
        "rollback",
        `${item.name} rollback item missing`,
        "high",
        "blocks_release_candidate",
        "Required rollback checklist item is missing.",
        ["docs/roadmaps/staging-release-candidate/rollback-checklist-v0.md"],
        "Define the rollback item before RC designation.",
        item.id,
        "open",
        { category: item.category }
      ));
    }

    blockers.push(
      blocker(
        "blocker_staging_rc_production_auth_missing",
        "auth",
        "Production auth missing",
        "medium",
        "blocks_production_only",
        "Production Auth/RBAC remains planning-only. This is documented as a production blocker, not a staging RC blocker for v0.",
        ["docs/roadmaps/auth-rbac-production/v1.md"],
        "Keep this limitation in release notes and do not mark production ready.",
        "staging_rc_production_auth_documented",
        "accepted",
        { productionAuthEnabled: false }
      ),
      blocker(
        "blocker_staging_rc_real_secret_backend_missing",
        "secrets",
        "Real secret backend missing",
        "medium",
        "blocks_production_only",
        "Secret Backend Migration v0 is planning-only. This is documented as a production blocker and accepted staging RC limitation for v0.",
        ["docs/roadmaps/secret-backend-migration/v0.md"],
        "Choose a production secret backend in a future task before live provider validation or production rollout.",
        "staging_rc_secret_backend_documented",
        "accepted",
        { realSecretBackendConfigured: false }
      )
    );

    return clone(blockers);
  }

  listStagingReleaseCandidateSignoffs(): StagingReleaseCandidateSignoff[] {
    const labels: Record<StagingReleaseCandidateSignoffRole, string> = {
      engineering_owner: "Engineering owner validates code scope and local validation evidence.",
      platform_owner: "Platform owner validates staging readiness and deployment boundaries.",
      security_reviewer: "Security reviewer validates no-secret/no-env exposure and safety gates.",
      product_owner: "Product owner validates user-facing scope and known limitation acceptance.",
      qa_reviewer: "QA reviewer validates test evidence and skipped-test documentation.",
      release_manager: "Release manager validates RC checklist, release notes, and rollback plan."
    };
    return clone(this.stagingReleaseCandidateChecklist.requiredSignoffs.map((role) => ({
      id: `staging_rc_signoff_${role}`,
      role,
      required: true,
      status: this.stagingReleaseCandidateOptions.signoffStatuses?.[role] ?? "pending",
      reason: labels[role],
      metadata: {
        readOnly: true,
        mockApprovalOnly: true,
        productionAuthRequiredForRealApproval: true
      }
    })));
  }

  listStagingReleaseNoteRequirements(): StagingReleaseNoteRequirement[] {
    const guidance: Record<StagingReleaseNoteSection, string> = {
      summary: "Summarize the candidate scope without claiming release creation or deployment.",
      changed_areas: "List packages, apps, docs, and tests changed.",
      validation: "Record lint, typecheck, test, build, git diff --check, and safety scan results.",
      skipped_tests: "List skipped optional Postgres/GitHub/LLM/MCP/auth tests with gate reasons.",
      known_limitations: "Document production auth, real secret backend, observability, staging deployment, and live integration limitations.",
      safety_gates: "State no release, no tag, no deployment, no external calls, no secret/env exposure, no destructive Git, no vendor CLI, and no real MCP transport.",
      migration_notes: "State whether dependency metadata, DB schema, migrations, or storage behavior changed.",
      dashboard_readiness: "Record readiness API, dashboard panel, health metadata, no-release/no-deployment, and no-secret/no-env status.",
      rollback_notes: "Reference the rollback checklist and any config/documentation reversal steps.",
      follow_ups: "List the next recommended task and non-blocking follow-ups."
    };
    return clone(this.stagingReleaseCandidateChecklist.requiredReleaseNotes.map((section) => ({
      id: `staging_rc_release_note_${section}`,
      section,
      required: true,
      status: this.stagingReleaseCandidateOptions.releaseNoteSectionsPresent?.[section] === true ? "present" : "missing",
      guidance: guidance[section],
      metadata: {
        readOnly: true,
        templateDocs: "docs/roadmaps/staging-release-candidate/release-notes-template-v0.md"
      }
    })));
  }

  listStagingRollbackChecklist(): StagingRollbackChecklistItem[] {
    const descriptions: Record<StagingRollbackChecklistCategory, string> = {
      code_revert: "Identify the commit range or branch changes to revert if the RC is rejected.",
      database: "Document migration and data rollback considerations without running migrations.",
      config: "Document config/env gate rollback without exposing env values.",
      feature_flags: "Document any feature flags or gates to disable.",
      git_integration: "Document Git/GitHub gate rollback while keeping merge/force-push/delete disabled.",
      llm_integration: "Document remote LLM gate rollback while keeping mock default and budget/policy gates.",
      secrets: "Document SecretRef/env fallback rollback and credential revocation expectations without secret values.",
      observability: "Document audit/observability review and no-export/no-alert limitations.",
      dashboard: "Document dashboard/readiness panel rollback or disablement steps."
    };
    return clone((this.stagingReleaseCandidateChecklist.rollbackChecklist as StagingRollbackChecklistCategory[]).map((category) => ({
      id: `staging_rc_rollback_${category}`,
      category,
      name: category.replaceAll("_", " "),
      required: true,
      status: this.stagingReleaseCandidateOptions.rollbackStatuses?.[category] ?? "planned",
      description: descriptions[category],
      metadata: {
        readOnly: true,
        rollbackExecuted: false,
        docs: "docs/roadmaps/staging-release-candidate/rollback-checklist-v0.md"
      }
    })));
  }

  generateStagingReleaseCandidateReport(): StagingReleaseCandidateReport {
    const gates = this.listStagingReleaseCandidateGates();
    const blockers = this.listStagingReleaseCandidateBlockers();
    const signoffs = this.listStagingReleaseCandidateSignoffs();
    const releaseNoteRequirements = this.listStagingReleaseNoteRequirements();
    const rollbackChecklist = this.listStagingRollbackChecklist();
    const overallStatus = this.calculateStagingReleaseCandidateOverallStatus(gates, blockers, signoffs, releaseNoteRequirements, rollbackChecklist);
    const checklist = this.getStagingReleaseCandidateChecklist();
    const skippedTests = this.stagingReleaseCandidateSkippedTests(gates);
    return clone({
      id: "staging_release_candidate_report_v0",
      generatedAt: this.now(),
      overallStatus,
      summary: overallStatus === "blocked"
        ? "Staging release candidate designation is blocked by critical safety or validation blockers."
        : overallStatus === "not_ready"
          ? "Staging release candidate checklist is not ready; required validation, signoff, release notes, or rollback evidence is missing."
          : overallStatus === "pass_with_warnings"
            ? "Staging release candidate checklist passes with documented warnings and skipped optional integration tests."
            : "Staging release candidate checklist passes all required read-only criteria.",
      checklist,
      gates,
      blockers,
      signoffs,
      releaseNoteRequirements,
      rollbackChecklist,
      skippedTests,
      recommendedNextActions: this.stagingReleaseCandidateRecommendedNextActions(gates, blockers, signoffs, releaseNoteRequirements, rollbackChecklist, skippedTests),
      metadata: {
        docs: "docs/roadmaps/staging-release-candidate/v0.md",
        reportFormatDocs: "docs/roadmaps/staging-release-candidate/report-format-v0.md",
        releaseNotesTemplateDocs: "docs/roadmaps/staging-release-candidate/release-notes-template-v0.md",
        rollbackChecklistDocs: "docs/roadmaps/staging-release-candidate/rollback-checklist-v0.md",
        gateCount: gates.length,
        blockerCount: blockers.length,
        criticalBlockerCount: blockers.filter((blockerItem) => blockerItem.status === "open" && blockerItem.severity === "critical").length,
        releaseCreated: false,
        gitTagCreated: false,
        githubReleaseCreated: false,
        deploymentExecuted: false,
        externalCallsExecuted: false,
        remoteIntegrationTestsExecuted: false,
        secretsReturned: false,
        envValuesReturned: false,
        productionReady: false,
        stagingDeployed: false
      }
    });
  }

  getStagingReleaseCandidateSummary(): StagingReleaseCandidateSummary {
    const report = this.generateStagingReleaseCandidateReport();
    const requiredSignoffs = report.signoffs.filter((signoff) => signoff.required);
    const missingNotes = report.releaseNoteRequirements.filter((note) => note.required && note.status === "missing");
    const missingRollback = report.rollbackChecklist.filter((item) => item.required && item.status === "missing");
    return clone({
      generatedAt: report.generatedAt,
      status: "v0_implemented",
      planningOnly: true,
      overallStatus: report.overallStatus,
      checklistStatus: report.checklist.status,
      productionReady: false,
      stagingDeployed: false,
      releaseCreated: false,
      gitTagCreated: false,
      githubReleaseCreated: false,
      deploymentExecuted: false,
      externalCallsEnabled: false,
      remoteIntegrationTestsExecuted: false,
      gateCount: report.gates.length,
      requiredGateCount: report.gates.filter((gate) => gate.required).length,
      gatesByStatus: countStagingRcGatesByStatus(report.gates),
      blockerCount: report.blockers.length,
      criticalBlockerCount: report.blockers.filter((blockerItem) => blockerItem.status === "open" && blockerItem.severity === "critical").length,
      signoffCount: report.signoffs.length,
      requiredSignoffCount: requiredSignoffs.length,
      pendingSignoffCount: requiredSignoffs.filter((signoff) => signoff.status === "pending").length,
      releaseNoteRequirementCount: report.releaseNoteRequirements.length,
      missingReleaseNoteRequirementCount: missingNotes.length,
      rollbackItemCount: report.rollbackChecklist.length,
      missingRollbackItemCount: missingRollback.length,
      skippedTestCount: report.skippedTests.length,
      recommendedNextActionCount: report.recommendedNextActions.length,
      noSecretsExposed: !this.stagingReleaseCandidateOptions.secretsExposed,
      envValuesExposed: Boolean(this.stagingReleaseCandidateOptions.envValuesExposed),
      productionReadyClaimed: Boolean(this.stagingReleaseCandidateOptions.productionReadyClaimed),
      stagingDeploymentClaimed: Boolean(this.stagingReleaseCandidateOptions.stagingDeployedClaimed),
      metadata: {
        docs: "docs/roadmaps/staging-release-candidate/v0.md",
        reportId: report.id,
        releaseCreated: false,
        gitTagCreated: false,
        githubReleaseCreated: false,
        deploymentExecuted: false,
        externalCallsEnabled: false,
        envValuesReturned: false,
        secretValuesReturned: false
      }
    });
  }

  getStagingDeploymentExecutionPlan(): StagingDeploymentExecutionPlan {
    const gates = this.listStagingDeploymentExecutionGates();
    const signoffCollection = this.getStagingDeploymentExecutionSignoffCollection();
    const pendingApprovals = signoffCollection.pendingApprovals;
    const requiredSignoffCount = signoffCollection.requiredSignoffCount;
    const criticalFail = gates.some((gate) => gate.status === "fail" && gate.severity === "critical");
    const status: StagingDeploymentExecutionPlanStatus = criticalFail
      ? "blocked"
      : pendingApprovals.length > 0
        ? "ready_for_signoff"
        : "planned";
    return clone({
      ...this.stagingDeploymentExecutionPlan,
      status,
      metadata: {
        ...this.stagingDeploymentExecutionPlan.metadata,
        generatedByService: true,
        noDeploymentExecution: true,
        noReleaseCreation: true,
        noGitTagCreation: true,
        noExternalCalls: true,
        noIntegrationTestsExecuted: true,
        signoffPackAvailable: true,
        signoffPackDocs: "docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md",
        signoffEvidenceChecklistDocs: "docs/roadmaps/staging-deployment-execution/signoff-evidence-checklist-v0.md",
        signoffDecisionPolicyDocs: "docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md",
        requiredSignoffCount,
        pendingApprovalCount: pendingApprovals.length,
        approvedSignoffCount: signoffCollection.approvedSignoffCount,
        conditionalSignoffCount: signoffCollection.conditionalSignoffCount,
        rejectedSignoffCount: signoffCollection.rejectedSignoffCount,
        missingRequiredSignoffCount: signoffCollection.missingRequiredSignoffCount,
        signoffStatus: signoffCollection.signoffStatus,
        actualDeploymentBlocked: signoffCollection.actualDeploymentBlocked
      }
    });
  }

  listStagingDeploymentExecutionSteps(): StagingDeploymentStep[] {
    const signoffCollection = this.getStagingDeploymentExecutionSignoffCollection();
    const pendingApprovals = signoffCollection.pendingApprovals;
    const step = (
      order: number,
      phase: StagingDeploymentStep["phase"],
      name: string,
      description: string,
      required: boolean,
      status: StagingDeploymentStep["status"],
      automationLevel: StagingDeploymentStep["automationLevel"],
      ownerRole: StagingDeploymentStep["ownerRole"],
      evidenceRequired: string[],
      metadata: Record<string, unknown> = {}
    ): StagingDeploymentStep => ({
      id: `staging_execution_step_${String(order).padStart(2, "0")}_${safeIdPart(name)}`,
      order,
      phase,
      name,
      description,
      required,
      status,
      automationLevel,
      ownerRole,
      evidenceRequired,
      metadata: {
        readOnly: true,
        deploymentExecuted: false,
        externalCallsExecuted: false,
        releaseCreated: false,
        gitTagCreated: false,
        secretValuesReturned: false,
        envValuesReturned: false,
        ...metadata
      }
    });
    return clone([
      step(1, "pre_deploy", "Confirm clean worktree or documented diff scope", "Record whether the staging candidate scope is clean or intentionally dirty before deployment execution.", true, "ready", "manual", "engineering_owner", ["git status review", "diff scope note"], { destructiveGitAllowed: false }),
      step(2, "pre_deploy", "Confirm Node/Volta baseline", "Verify the Node/Volta and pnpm baseline before any staging execution task.", true, "ready", "manual", "platform_owner", ["package.json engines", "README install section"], { deploymentExecutedByStep: false }),
      step(3, "validation", "Run required validation", "Run lint, typecheck, test, build, diff check, and safety scans before signoff.", true, "ready", "manual", "qa_reviewer", ["validation command output", "safe integration scan classification"], { commandExecutionByPlan: false }),
      step(4, "validation", "Confirm staging RC decision", "Confirm the latest Staging RC audit decision and accepted warnings.", true, "ready", "manual", "release_manager", ["docs/audits/2026-05-14-staging-release-candidate-audit-v0-rerun.md"], { acceptedRcDecision: "staging_rc_pass_with_warnings" }),
      step(5, "approval", "Collect human signoffs", "Collect required human approvals before any staging deployment execution.", true, pendingApprovals.length > 0 ? "blocked" : "ready", "manual", "release_manager", ["engineering_owner", "platform_owner", "security_reviewer", "product_owner", "qa_reviewer", "release_manager"], { pendingApprovals }),
      step(6, "config_freeze", "Freeze config/environment gates", "Record the exact staging environment gate decisions without exposing env values.", true, pendingApprovals.length > 0 ? "planned" : "ready", "manual", "platform_owner", ["environment gate matrix review"], { envValuesReturned: false }),
      step(7, "validation", "Decide whether optional live integration tests are required", "Document which optional live integrations remain skipped or are separately approved.", true, "planned", "manual", "release_manager", ["live integration decision record"], { liveTestsExecutedByPlan: false }),
      step(8, "migration_decision", "Confirm Postgres/staging DB decision", "Decide whether optional Postgres contracts and migration rehearsal are required for this staging execution.", true, "planned", "manual", "platform_owner", ["DB readiness review", "migration decision note"], { migrationsExecutedByPlan: false }),
      step(9, "migration_decision", "Confirm secret backend / Vault decision", "Confirm whether gated Vault validation is required or skipped for this staging execution.", true, "planned", "manual", "security_reviewer", ["Vault integration profile summary"], { vaultCallsExecutedByPlan: false }),
      step(10, "validation", "Confirm GitHub App integration test decision", "Decide whether skipped-by-default GitHub App live tests are required.", true, "planned", "manual", "platform_owner", ["GitHub App integration profile summary"], { githubCallsExecutedByPlan: false }),
      step(11, "validation", "Confirm LLM integration test decision", "Decide whether skipped-by-default LLM live tests are required.", true, "planned", "manual", "qa_reviewer", ["LLM integration profile summary"], { llmCallsExecutedByPlan: false }),
      step(12, "validation", "Confirm MCP remains mock/future", "Confirm real MCP transport remains blocked for staging execution v0.", true, "ready", "manual", "security_reviewer", ["MCP Gateway v0 docs"], { realMcpTransportEnabled: false }),
      step(13, "approval", "Confirm Auth/RBAC remains mock/planning or staging-approved", "Accept mock/planning auth as a staging limitation or block deployment execution until production auth exists.", true, "planned", "manual", "security_reviewer", ["Auth/RBAC production readiness review"], { productionAuthEnabled: false }),
      step(14, "pre_deploy", "Confirm dashboard/readiness surfaces", "Confirm API-backed readiness and dashboard surfaces are available and sanitized.", true, "ready", "manual", "qa_reviewer", ["dashboard read model smoke list"], { dashboardReadOnly: true }),
      step(15, "observability_check", "Confirm observability/audit readiness", "Confirm v0 audit/observability metadata is available and external export remains disabled.", true, "planned", "manual", "platform_owner", ["observability summary"], { externalObservabilityExporterEnabled: false }),
      step(16, "rollback_decision", "Confirm rollback plan", "Confirm rollback criteria and manual verification are ready before execution.", true, "ready", "manual", "release_manager", ["rollback evidence", "rollback plan"], { rollbackExecutedByPlan: false }),
      step(17, "approval", "Final go/no-go decision", "Record final go/no-go after signoffs and gates are reviewed.", true, pendingApprovals.length > 0 ? "blocked" : "ready", "manual", "release_manager", ["go/no-go decision record"], { pendingApprovals }),
      step(18, "deployment_placeholder", "Future deployment execution placeholder", "Placeholder for a future explicit deployment execution task; this plan never deploys.", true, "future", "scripted_future", "operator", ["future deployment runbook"], { deploymentExecuted: false }),
      step(19, "smoke_test", "Post-deployment smoke test placeholder", "Placeholder for future smoke checks after an explicitly executed staging deployment.", true, "future", "scripted_future", "qa_reviewer", ["future smoke results"], { smokeExecutedByPlan: false }),
      step(20, "post_deploy_review", "Post-deployment review placeholder", "Placeholder for future post-deployment review and incident/triage closure.", true, "future", "manual", "release_manager", ["future review notes"], { postDeployReviewExecuted: false })
    ]);
  }

  listStagingDeploymentExecutionGates(filter: { category?: StagingDeploymentGateCategory } = {}): StagingDeploymentGate[] {
    const options = this.stagingDeploymentExecutionOptions;
    const githubIntegration = this.getGitHubAppIntegrationTestReadinessSummary();
    const llmIntegration = this.getLLMIntegrationTestReadinessSummary();
    const vaultIntegration = this.getVaultIntegrationTestReadinessSummary();
    const database = this.getDatabaseOperationsSummary();
    const dryRun = this.getStagingDeploymentDryRunSummary();
    const rcAuditStatus = "staging_rc_pass_with_warnings";
    const signoffCollection = this.getStagingDeploymentExecutionSignoffCollection();
    const pendingApprovals = signoffCollection.pendingApprovals;
    const validationStatus = options.validationCommandStatus ?? "pass";
    const diffStatus = options.diffCheckStatus ?? "pass";
    const safeScanStatus = options.safeIntegrationScanStatus ?? "pass";
    const noSecretStatus = options.noSecretExposureStatus ?? "pass";
    const failedCommands = new Set(options.failedValidationCommands ?? []);
    const validationGateStatus = (command: string): StagingDeploymentGateStatus => {
      if (validationStatus === "pass") return "pass";
      if (validationStatus === "fail" && (failedCommands.size === 0 || failedCommands.has(command))) return "fail";
      return "not_checked";
    };
    const sideEffectDetected = Boolean(options.deploymentExecuted || options.releaseCreated || options.gitTagCreated || options.externalCallsExecuted);
    const exposureDetected = Boolean(options.secretsExposed || options.envValuesExposed || noSecretStatus === "fail");
    const overclaimDetected = Boolean(options.productionReadyClaimed || options.stagingDeployedClaimed);
    const gate = (
      id: string,
      category: StagingDeploymentGateCategory,
      name: string,
      status: StagingDeploymentGateStatus,
      severity: ReadinessSeverity,
      required: boolean,
      description: string,
      evidence: string[],
      remediation: string,
      metadata: Record<string, unknown> = {}
    ): StagingDeploymentGate => ({
      id,
      category,
      name,
      status,
      severity,
      required,
      description,
      evidence,
      remediation,
      metadata: {
        readOnly: true,
        deploymentExecuted: false,
        releaseCreated: false,
        gitTagCreated: false,
        externalCallsExecuted: false,
        secretValuesReturned: false,
        envValuesReturned: false,
        ...metadata
      }
    });
    const gates: StagingDeploymentGate[] = [
      gate("staging_execution_pnpm_lint", "validation", "pnpm lint", validationGateStatus("pnpm lint"), validationStatus === "fail" ? "critical" : "high", true, "Lint must pass before staging execution.", ["README.md"], "Run pnpm lint and fix failures.", { commandExecutedByPlan: false }),
      gate("staging_execution_pnpm_typecheck", "validation", "pnpm typecheck", validationGateStatus("pnpm typecheck"), validationStatus === "fail" ? "critical" : "high", true, "Typecheck must pass before staging execution.", ["README.md"], "Run pnpm typecheck and fix failures.", { commandExecutedByPlan: false }),
      gate("staging_execution_pnpm_test", "validation", "pnpm test", validationGateStatus("pnpm test"), validationStatus === "fail" ? "critical" : "high", true, "The deterministic test suite must pass before staging execution.", ["README.md"], "Run pnpm test and fix failures.", { commandExecutedByPlan: false }),
      gate("staging_execution_pnpm_build", "validation", "pnpm build", validationGateStatus("pnpm build"), validationStatus === "fail" ? "critical" : "high", true, "Build must pass before staging execution.", ["README.md"], "Run pnpm build and fix failures.", { commandExecutedByPlan: false }),
      gate("staging_execution_git_diff_check", "validation", "git diff --check", diffStatus === "fail" ? "fail" : diffStatus === "warning" ? "warning" : diffStatus === "pass" ? "pass" : "not_checked", diffStatus === "fail" ? "critical" : "high", true, "Whitespace validation must pass before staging execution.", ["docs/roadmaps/staging-ci-cd-pipeline/v0.md"], "Run git diff --check and fix failures.", { commandExecutedByPlan: false }),
      gate("staging_execution_safe_integration_scan", "validation", "Safe integration scan", safeScanStatus === "fail" ? "fail" : safeScanStatus === "pass" ? "pass" : "not_checked", safeScanStatus === "fail" ? "critical" : "high", true, "Safe integration compliance must be reviewed before deployment execution.", ["docs/audits/2026-05-14-staging-release-candidate-audit-v0-rerun.md"], "Run and classify the safe integration scan.", { scanExecutedByPlan: false }),
      gate("staging_execution_no_secret_no_env", "secrets", "No secret/no-env exposure", exposureDetected ? "fail" : "pass", "critical", true, "No readiness, API, health, dashboard, audit, docs, or smoke output may expose secrets or env values.", ["docs/audits/2026-05-14-staging-release-candidate-audit-v0-rerun.md"], "Redact exposed values and block staging execution.", { noSecretsExposed: !options.secretsExposed, envValuesExposed: Boolean(options.envValuesExposed) }),
      gate("staging_execution_no_release_tag_deploy_side_effects", "environment", "No release, tag, deployment, or external call executed", sideEffectDetected ? "fail" : "pass", "critical", true, "This execution plan must remain planning-only until an explicit future deployment task.", ["AGENTS.md"], "Remove side effects and rerun audit.", { deploymentExecuted: Boolean(options.deploymentExecuted), releaseCreated: Boolean(options.releaseCreated), gitTagCreated: Boolean(options.gitTagCreated), externalCallsExecuted: Boolean(options.externalCallsExecuted) }),
      gate("staging_execution_no_ready_overclaim", "environment", "No staging/production overclaim", overclaimDetected ? "fail" : "pass", "critical", true, "Docs and read models must not claim staging is deployed or production is ready.", ["docs/roadmaps/production-deployment-readiness/checklist-v0.md"], "Remove staging-deployed or production-ready overclaims.", { productionReadyClaimed: Boolean(options.productionReadyClaimed), stagingDeployedClaimed: Boolean(options.stagingDeployedClaimed) }),
      gate("staging_execution_rc_audit_accepted", "signoff", "Staging RC audit rerun accepted", "warning", "medium", true, "The latest audit returned staging_rc_pass_with_warnings, not staging_rc_pass.", ["docs/audits/2026-05-14-staging-release-candidate-audit-v0-rerun.md"], "Treat warnings as accepted limitations and collect real signoffs before deployment.", { rcAuditStatus, runtimeRcStatus: this.getStagingReleaseCandidateSummary().overallStatus }),
      gate("staging_execution_human_signoff_collected", "signoff", "Human signoffs collected", pendingApprovals.length > 0 || signoffCollection.rejectedSignoffCount > 0 ? "fail" : "pass", "high", true, "Real human signoffs are required before actual staging deployment execution.", ["docs/roadmaps/staging-release-candidate/signoff-readiness-v0.md"], "Collect required signoffs; do not fake approval.", {
        pendingApprovals,
        approvedApprovals: signoffCollection.approvedApprovals,
        conditionalApprovals: signoffCollection.conditionalApprovals,
        rejectedApprovals: signoffCollection.rejectedApprovals,
        invalidEvidenceRoles: signoffCollection.invalidEvidenceRoles,
        collectionMode: signoffCollection.collectionMode,
        actualDeploymentBlocked: signoffCollection.actualDeploymentBlocked
      }),
      gate("staging_execution_release_notes_present", "environment", "Release notes present", options.releaseNotesPresent === false ? "fail" : "pass", "high", true, "Release notes draft/evidence must be present before staging execution.", ["docs/roadmaps/staging-release-candidate/release-notes-draft-v0.md"], "Complete release notes before execution.", { releaseArtifactCreated: false }),
      gate("staging_execution_rollback_plan_present", "rollback", "Rollback plan present", options.rollbackPlanPresent === false ? "fail" : "pass", "high", true, "Rollback plan and manual verification must be present before staging execution.", ["docs/roadmaps/staging-release-candidate/rollback-evidence-v0.md"], "Complete rollback plan before execution.", { rollbackExecuted: false }),
      gate("staging_execution_config_freeze_planned", "environment", "Config/environment gate freeze planned", "warning", "medium", true, "Config freeze is a manual pre-deployment activity and has not been executed by this plan.", ["docs/reference/environment-gate-matrix.md"], "Record final non-secret config gates before deployment execution.", { envValuesReturned: false }),
      gate("staging_execution_postgres_decision", "database", "Postgres/staging DB decision", options.requirePostgresLiveValidation && !database.testDatabaseUrlConfigured ? "fail" : "warning", options.requirePostgresLiveValidation ? "high" : "medium", true, "Postgres validation is optional but recommended unless staging mandates live DB evidence.", ["docs/roadmaps/persistent-db-production-operations/v1.md"], "Run optional Postgres tests only under explicit non-production gates or accept the skip.", { testDatabaseUrlConfigured: database.testDatabaseUrlConfigured, liveValidationRequired: Boolean(options.requirePostgresLiveValidation), databaseUrlExposed: database.databaseUrlExposed }),
      gate("staging_execution_github_app_decision", "github_app", "GitHub App integration decision", options.requireGitHubLiveValidation && !githubIntegration.canRunLiveTests ? "fail" : "skipped", options.requireGitHubLiveValidation ? "high" : "medium", false, "GitHub App live tests remain skipped unless separately required and fully gated.", ["docs/roadmaps/github-app-integration-test-profile/v1.md"], "Keep skipped or run a separate gated non-production validation task.", { canRunLiveTests: githubIntegration.canRunLiveTests, missingGateCount: githubIntegration.missingGateCount, unsafeGateCount: githubIntegration.unsafeGateCount }),
      gate("staging_execution_github_webhook_decision", "webhook", "GitHub webhook integration decision", "skipped", "medium", false, "Live webhook validation remains skipped/future unless explicitly configured.", ["docs/roadmaps/github-app-integration-test-profile/v1.md"], "Keep skipped or run a separate gated webhook validation task.", { liveWebhookTestsEnabled: githubIntegration.liveWebhookTestsEnabled }),
      gate("staging_execution_llm_decision", "llm", "LLM integration decision", options.requireLLMLiveValidation && !llmIntegration.canRunLiveTests ? "fail" : "skipped", options.requireLLMLiveValidation ? "high" : "medium", false, "LLM live tests remain skipped unless separately required and fully gated.", ["docs/roadmaps/llm-gateway-integration-test-profile/v1.md"], "Keep skipped or run a separate gated non-production validation task.", { canRunLiveTests: llmIntegration.canRunLiveTests, missingGateCount: llmIntegration.missingGateCount, unsafeGateCount: llmIntegration.unsafeGateCount }),
      gate("staging_execution_vault_decision", "vault", "Vault integration decision", options.requireVaultLiveValidation && !vaultIntegration.canRunLiveTests ? "fail" : "skipped", options.requireVaultLiveValidation ? "high" : "medium", false, "Vault live tests remain skipped unless separately required and fully gated.", ["docs/roadmaps/vault-integration-test-profile/v1.md"], "Keep skipped or run a separate gated non-production Vault validation task.", { canRunLiveTests: vaultIntegration.canRunLiveTests, missingGateCount: vaultIntegration.missingGateCount, unsafeGateCount: vaultIntegration.unsafeGateCount }),
      gate("staging_execution_secret_backend_acknowledged", "secrets", "Secret backend readiness acknowledged", "warning", "medium", false, "Vault-backed Secret Backend v1 is gated and non-default; production secret backend readiness remains false.", ["docs/foundations/vault-secret-backend/v1.md", "docs/roadmaps/secret-backend-migration/v0.md"], "Keep production secret readiness false and do not use env fallback as a production backend.", { productionSecretBackendReady: false }),
      gate("staging_execution_auth_rbac_acknowledged", "auth", "Auth/RBAC limitation acknowledged", "warning", "medium", false, "Production Auth/RBAC remains planning-only; mock auth must be explicitly accepted as a staging limitation.", ["docs/roadmaps/auth-rbac-production/v1.md"], "Collect security/product acceptance or block deployment until production auth exists.", { productionAuthReady: false }),
      gate("staging_execution_policy_static_runtime", "policy", "Policy runtime remains static/mock-first", this.realMcpTransportEnabled() ? "fail" : "warning", this.realMcpTransportEnabled() ? "critical" : "medium", true, "StaticPolicyEngine remains runtime; real OPA/Cedar execution is out of scope.", ["docs/roadmaps/policy-bundle-opa-cedar/v0.md"], "Keep dynamic policy execution disabled.", { dynamicPolicyExecutionEnabled: false }),
      gate("staging_execution_destructive_git_disabled", "git", "Destructive Git disabled", this.remoteMergeEnabled() || this.remoteForcePushEnabled() || this.remoteBranchDeletionEnabled() ? "fail" : "pass", "critical", true, "Remote merge, force-push, and branch deletion must remain disabled.", ["docs/features/real-git-adapter/v2.md"], "Disable destructive Git gates.", { remoteMergeEnabled: this.remoteMergeEnabled(), forcePushEnabled: this.remoteForcePushEnabled(), branchDeletionEnabled: this.remoteBranchDeletionEnabled() }),
      gate("staging_execution_mcp_policy", "mcp", "MCP remains mock/future", this.realMcpTransportEnabled() ? "fail" : "not_applicable", this.realMcpTransportEnabled() ? "critical" : "low", false, "Real MCP transport remains future/blocked for staging execution v0.", ["docs/features/mcp-gateway/v0.md"], "Keep real MCP transport disabled.", { realMcpTransportEnabled: this.realMcpTransportEnabled() }),
      gate("staging_execution_observability_ready", "observability", "Observability/audit readiness reviewed", "warning", "medium", true, "Observability v0 is available but external exporter and durable production retention remain future work.", ["docs/foundations/observability-audit-retention/v0.md"], "Accept limitation for staging or implement durable observability before execution.", { externalObservabilityBackendEnabled: false }),
      gate("staging_execution_dashboard_ready", "dashboard", "Dashboard/readiness surfaces ready", "pass", "low", true, "Dashboard and readiness surfaces are read-only and sanitized.", ["docs/features/dashboard/v0.md"], "Keep dashboard read-only.", { dashboardReadOnly: true }),
      gate("staging_execution_dry_run_reviewed", "environment", "Staging dry-run reviewed", dryRun.criticalBlockerCount > 0 ? "warning" : "pass", "medium", true, "Dry-run blockers and production-only limitations must be acknowledged before execution.", ["docs/roadmaps/staging-deployment-dry-run/v0.md"], "Document accepted limitations and do not treat dry-run as deployment execution.", { dryRunOverallStatus: dryRun.overallStatus, dryRunCriticalBlockerCount: dryRun.criticalBlockerCount })
    ];
    return clone(gates.filter((gateItem) => filter.category === undefined || gateItem.category === filter.category));
  }

  getStagingDeploymentGoNoGoDecision(): StagingDeploymentGoNoGoDecision {
    const gates = this.listStagingDeploymentExecutionGates();
    const signoffCollection = this.getStagingDeploymentExecutionSignoffCollection();
    const pendingApprovals = signoffCollection.pendingApprovals;
    const blockers = gates.filter((gate) => gate.required && gate.status === "fail").map((gate) => gate.id);
    const criticalBlockers = gates.filter((gate) => gate.status === "fail" && gate.severity === "critical").map((gate) => gate.id);
    const notChecked = gates.filter((gate) => gate.required && gate.status === "not_checked").map((gate) => gate.id);
    const warnings = gates.filter((gate) => gate.status === "warning" || gate.status === "skipped").map((gate) => gate.id);
    // Go/no-go is deliberately conservative: critical safety or validation
    // failures are no_go; pending real signoff or unchecked required gates keep
    // the execution plan not_ready; optional skipped integrations produce
    // go_with_warnings only after required approvals are complete.
    const status: StagingDeploymentGoNoGoDecision["status"] = signoffCollection.rejectedSignoffCount > 0 || criticalBlockers.length > 0
      ? "no_go"
      : pendingApprovals.length > 0 || blockers.length > 0 || notChecked.length > 0
        ? "not_ready"
        : warnings.length > 0
          ? "go_with_warnings"
          : "go";
    return clone({
      id: "staging_deployment_execution_go_no_go_v0",
      status,
      reason: signoffCollection.rejectedSignoffCount > 0
        ? "A required human signoff was rejected."
        : status === "no_go"
        ? "Critical staging execution blocker is open."
        : status === "not_ready"
          ? "Required human signoffs or required gates are still pending before any staging deployment execution."
          : status === "go_with_warnings"
            ? "Required gates are satisfied, but optional integrations and production limitations remain documented warnings."
            : "Required gates and approvals are satisfied for a future explicit staging deployment task.",
      requiredApprovals: this.stagingDeploymentExecutionPlan.requiredSignoffs,
      pendingApprovals,
      blockers: [...new Set([...criticalBlockers, ...blockers, ...notChecked])],
      acceptedRisks: warnings,
      generatedAt: this.now(),
      metadata: {
        docs: "docs/roadmaps/staging-deployment-execution/v0.md",
        deploymentExecuted: false,
        releaseCreated: false,
        gitTagCreated: false,
        externalCallsExecuted: false,
        productionReady: false,
        stagingDeployed: false,
        signoffPackAvailable: true,
        signoffPackDocs: "docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md",
        requiredSignoffCount: signoffCollection.requiredSignoffCount,
        pendingSignoffCount: pendingApprovals.length,
        approvedSignoffCount: signoffCollection.approvedSignoffCount,
        conditionalSignoffCount: signoffCollection.conditionalSignoffCount,
        rejectedSignoffCount: signoffCollection.rejectedSignoffCount,
        missingRequiredSignoffCount: signoffCollection.missingRequiredSignoffCount,
        signoffStatus: signoffCollection.signoffStatus,
        actualDeploymentBlocked: signoffCollection.actualDeploymentBlocked,
        secretValuesReturned: false,
        envValuesReturned: false
      }
    });
  }

  getStagingDeploymentRollbackPlan(): StagingDeploymentRollbackPlan {
    const rollbackStep = (
      order: number,
      name: string,
      ownerRole: StagingDeploymentStep["ownerRole"],
      description: string,
      metadata: Record<string, unknown> = {}
    ): StagingDeploymentStep => ({
      id: `staging_execution_rollback_step_${String(order).padStart(2, "0")}_${safeIdPart(name)}`,
      order,
      phase: "rollback_decision",
      name,
      description,
      required: true,
      status: "planned",
      automationLevel: "manual",
      ownerRole,
      evidenceRequired: ["manual rollback review"],
      metadata: {
        readOnly: true,
        rollbackExecuted: false,
        destructiveCommandExecuted: false,
        deploymentExecuted: false,
        secretValuesReturned: false,
        envValuesReturned: false,
        ...metadata
      }
    });
    return clone({
      id: "staging_deployment_execution_rollback_plan_v0",
      status: "ready_for_review",
      triggers: [
        "health check failure after future deployment",
        "dashboard/readiness no-secret failure",
        "unexpected external provider call",
        "destructive Git gate enabled",
        "migration failure or data inconsistency",
        "policy/Auth/RBAC bypass",
        "observability/audit gap during validation"
      ],
      rollbackSteps: [
        rollbackStep(1, "Code rollback", "engineering_owner", "Revert the future staging deployment candidate through a reviewed code rollback path."),
        rollbackStep(2, "Config rollback", "platform_owner", "Restore prior staging config gates without exposing env values."),
        rollbackStep(3, "Environment gate rollback", "platform_owner", "Disable optional live integration and remote provider gates."),
        rollbackStep(4, "Database migration rollback consideration", "platform_owner", "Follow migration rollback decision points; this plan does not run migrations."),
        rollbackStep(5, "GitHub integration rollback", "platform_owner", "Disable GitHub App/webhook/live Git gates; no branch deletion or remote cleanup is automated."),
        rollbackStep(6, "LLM integration rollback", "qa_reviewer", "Return LLM routing to mock-only gates and preserve budget/policy controls."),
        rollbackStep(7, "Vault/SecretRef rollback", "security_reviewer", "Disable Vault live test/provider gates and keep SecretRef values hidden."),
        rollbackStep(8, "Dashboard/readiness rollback", "qa_reviewer", "Remove or hide stale readiness panels if they overclaim deployment state."),
        rollbackStep(9, "Observability/audit review", "security_reviewer", "Review sanitized audit/readiness records and record incident evidence."),
        rollbackStep(10, "Manual verification", "release_manager", "Manually verify health, dashboard, readiness, no-secret, no-env, and productionReady=false.")
      ],
      manualVerification: [
        "GET /health reports deploymentExecuted=false before future execution and no secrets/env values",
        "dashboard readiness panels do not expose tokens, database URLs, Vault values, or env values",
        "stagingDeployed and productionReady remain false until explicitly updated by future approved work",
        "optional live integration gates are disabled unless separately approved"
      ],
      dataConsiderations: [
        "No database rollback command is run by this plan.",
        "Future migration rollback must be decided before deployment execution.",
        "No real secret migration or rotation is performed by this plan.",
        "No production data or production secrets may be used in staging validation."
      ],
      auditRequirements: [
        "Record owner, decision, timestamp, reason, and sanitized evidence.",
        "Do not store raw secrets, env values, raw webhook payloads, raw prompts, raw provider responses, or credential cache paths.",
        "Document accepted limitations and post-incident follow-ups."
      ],
      ownerRoles: this.stagingDeploymentExecutionPlan.requiredSignoffs,
      metadata: {
        docs: "docs/roadmaps/staging-deployment-execution/rollback-plan-v0.md",
        rollbackExecuted: false,
        destructiveCommandExecuted: false,
        deploymentExecuted: false,
        secretValuesReturned: false,
        envValuesReturned: false
      }
    });
  }

  getStagingDeploymentExecutionSummary(): StagingDeploymentExecutionSummary {
    const plan = this.getStagingDeploymentExecutionPlan();
    const gates = this.listStagingDeploymentExecutionGates();
    const steps = this.listStagingDeploymentExecutionSteps();
    const decision = this.getStagingDeploymentGoNoGoDecision();
    const rollback = this.getStagingDeploymentRollbackPlan();
    const signoffCollection = this.getStagingDeploymentExecutionSignoffCollection();
    const warnings = gates.filter((gate) => gate.status === "warning" || gate.status === "skipped");
    const blockers = gates.filter((gate) => gate.required && (gate.status === "fail" || gate.status === "not_checked"));
    const requiredSignoffCount = signoffCollection.requiredSignoffCount;
    const pendingSignoffCount = decision.pendingApprovals.length;
    const approvedSignoffCount = signoffCollection.approvedSignoffCount;
    const signoffStatus = signoffCollection.signoffStatus;
    return clone({
      generatedAt: decision.generatedAt,
      status: "v0_implemented",
      planningOnly: true,
      planStatus: plan.status,
      goNoGoStatus: decision.status,
      productionReady: false,
      stagingDeployed: false,
      deploymentExecuted: false,
      releaseCreated: false,
      gitTagCreated: false,
      externalCallsEnabled: false,
      remoteIntegrationTestsExecuted: false,
      gateCount: gates.length,
      requiredGateCount: gates.filter((gate) => gate.required).length,
      gatesByStatus: countStagingExecutionGatesByStatus(gates),
      blockerCount: blockers.length,
      criticalBlockerCount: gates.filter((gate) => gate.status === "fail" && gate.severity === "critical").length,
      warningCount: warnings.length,
      stepCount: steps.length,
      readyStepCount: steps.filter((step) => step.status === "ready").length,
      signoffPackAvailable: true,
      requiredSignoffCount,
      pendingSignoffCount,
      approvedSignoffCount,
      conditionalSignoffCount: signoffCollection.conditionalSignoffCount,
      rejectedSignoffCount: signoffCollection.rejectedSignoffCount,
      missingRequiredSignoffCount: signoffCollection.missingRequiredSignoffCount,
      signoffStatus,
      actualDeploymentBlocked: signoffCollection.actualDeploymentBlocked,
      optionalIntegrationDecisionCount: gates.filter((gate) => !gate.required && ["github_app", "webhook", "llm", "vault", "mcp"].includes(gate.category)).length,
      rollbackStepCount: rollback.rollbackSteps.length,
      noSecretsExposed: !this.stagingDeploymentExecutionOptions.secretsExposed,
      envValuesExposed: Boolean(this.stagingDeploymentExecutionOptions.envValuesExposed),
      productionReadyClaimed: Boolean(this.stagingDeploymentExecutionOptions.productionReadyClaimed),
      stagingDeployedClaimed: Boolean(this.stagingDeploymentExecutionOptions.stagingDeployedClaimed),
      metadata: {
        docs: "docs/roadmaps/staging-deployment-execution/v0.md",
        goNoGoDecisionId: decision.id,
        rollbackPlanId: rollback.id,
        releaseCreated: false,
        gitTagCreated: false,
        deploymentExecuted: false,
        externalCallsEnabled: false,
        remoteIntegrationTestsExecuted: false,
        signoffPackAvailable: true,
        signoffPackDocs: "docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md",
        signoffEvidenceChecklistDocs: "docs/roadmaps/staging-deployment-execution/signoff-evidence-checklist-v0.md",
        signoffDecisionPolicyDocs: "docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md",
        requiredSignoffCount,
        pendingSignoffCount,
        approvedSignoffCount,
        conditionalSignoffCount: signoffCollection.conditionalSignoffCount,
        rejectedSignoffCount: signoffCollection.rejectedSignoffCount,
        missingRequiredSignoffCount: signoffCollection.missingRequiredSignoffCount,
        realHumanEvidenceProvidedCount: signoffCollection.realHumanEvidenceProvidedCount,
        invalidSignoffEvidenceRoles: signoffCollection.invalidEvidenceRoles,
        rejectedApprovals: signoffCollection.rejectedApprovals,
        conditionalApprovals: signoffCollection.conditionalApprovals,
        signoffCollectionMode: signoffCollection.collectionMode,
        signoffEvidenceChecklistStatus: "present_pending_review",
        signoffDecisionPolicyStatus: signoffCollection.rejectedSignoffCount > 0 ? "evaluated_no_go_rejected" : pendingSignoffCount > 0 ? "evaluated_pending_required_signoffs" : "evaluated_required_signoffs_collected",
        approvalAuditRequired: true,
        signoffStatus,
        actualDeploymentBlocked: signoffCollection.actualDeploymentBlocked,
        secretValuesReturned: false,
        envValuesReturned: false,
        recommendedNextActions: [
          "Collect real human signoffs before any staging deployment execution.",
          "Run optional live integrations only as separate explicitly gated non-production validation tasks.",
          "Keep staging deployed false and production ready false until future execution/audit work."
        ]
      }
    });
  }

  listStagingHumanSignoffEvidence(): StagingHumanSignoffEvidence[] {
    return clone(this.stagingDeploymentExecutionPlan.requiredSignoffs
      .map((role) => this.stagingHumanSignoffs[role])
      .filter((evidence): evidence is StagingHumanSignoffEvidence => evidence !== undefined));
  }

  getStagingHumanSignoffScopeReview(currentScope: StagingSignoffScopeSnapshot): StagingSignoffScopeReview {
    const requiredRoles = this.stagingDeploymentExecutionPlan.requiredSignoffs;
    const matchingRoles: StagingReleaseCandidateSignoffRole[] = [];
    const pendingRoles: StagingReleaseCandidateSignoffRole[] = [];
    const staleRoles: StagingReleaseCandidateSignoffRole[] = [];
    const rejectedRoles: StagingReleaseCandidateSignoffRole[] = [];
    const conditionalRoles: StagingReleaseCandidateSignoffRole[] = [];

    for (const role of requiredRoles) {
      const evidence = this.stagingHumanSignoffs[role];
      if (evidence === undefined || !hasExplicitHumanDecisionEvidence(evidence)) {
        pendingRoles.push(role);
        continue;
      }
      if (evidence.status === "rejected") {
        rejectedRoles.push(role);
        continue;
      }
      if (!signoffEvidenceHasScope(evidence)) {
        staleRoles.push(role);
        continue;
      }
      if (!signoffEvidenceScopeMatches(evidence, currentScope)) {
        staleRoles.push(role);
        continue;
      }
      matchingRoles.push(role);
      if (evidence.status === "conditionally_approved") conditionalRoles.push(role);
    }

    const status: StagingSignoffScopeReview["status"] = rejectedRoles.length > 0
      ? "rejected"
      : staleRoles.length > 0
        ? "stale"
        : pendingRoles.length > 0
          ? "pending"
          : "matched";

    return clone({
      status,
      requiredRoleCount: requiredRoles.length,
      matchingRoleCount: matchingRoles.length,
      pendingRoles,
      staleRoles,
      rejectedRoles,
      conditionalRoles,
      currentScope,
      actualDeploymentBlocked: true,
      productionReady: false,
      stagingDeployed: false,
      approvalAuditCanPass: status === "matched",
      metadata: {
        scopeEvidencePath: currentScope.scopeEvidencePath,
        reviewedScopeMethod: currentScope.reviewedScopeMethod,
        currentDiffScopeHash: currentScope.reviewedDiffScope.diffScopeHash,
        secretValuesReturned: false,
        envValuesReturned: false,
        rawDiffStored: false,
        actualDeploymentAuthorized: false
      }
    });
  }

  recordStagingHumanSignoffEvidence(input: StagingHumanSignoffEvidence): StagingHumanSignoffEvidence {
    const role = input.role;
    if (!this.stagingDeploymentExecutionPlan.requiredSignoffs.includes(role)) {
      throw new Error(`Unsupported staging signoff role: ${String(role)}`);
    }
    if (input.status !== "approved" && input.status !== "rejected" && input.status !== "conditionally_approved") {
      throw new Error("Staging signoff status must be approved, rejected, or conditionally_approved.");
    }
    const reviewedScopeMethod = input.reviewedScopeMethod === "commit_sha" || input.reviewedScopeMethod === "explicit_diff_scope"
      ? input.reviewedScopeMethod
      : undefined;
    const evidence: StagingHumanSignoffEvidence = {
      role,
      required: true,
      status: input.status,
      approverName: cleanText(input.approverName, 200),
      approverContact: cleanText(input.approverContact, 200),
      signedAt: cleanText(input.signedAt, 80) ?? this.now().toISOString(),
      reviewedEvidence: cleanTextArray(input.reviewedEvidence),
      reviewedCommitSha: cleanText(input.reviewedCommitSha, 80),
      reviewedBranch: cleanText(input.reviewedBranch, 200),
      reviewedScopeMethod,
      reviewedDiffScope: cleanStagingSignoffDiffScope(input.reviewedDiffScope),
      scopeCapturedAt: cleanText(input.scopeCapturedAt, 80),
      scopeEvidencePath: cleanText(input.scopeEvidencePath, 500),
      validationEvidencePaths: cleanTextArray(input.validationEvidencePaths ?? []).map((value) => value.slice(0, 500)),
      conditions: cleanTextArray(input.conditions ?? []),
      notes: cleanText(input.notes, 2000),
      signatureMethod: cleanText(input.signatureMethod, 120),
      evidenceSource: cleanText(input.evidenceSource, 300) ?? "staging_signoff_collection_ui",
      metadata: {
        ...(input.metadata ?? {}),
        localOnly: true,
        identityVerified: false,
        productionAuthImplemented: false,
        submittedVia: input.metadata.submittedVia ?? "staging_signoff_collection_ui",
        noDeploymentAuthorization: true,
        approvalAuditRequired: true,
        secretValuesStored: false,
        envValuesStored: false
      }
    };
    if (!hasExplicitHumanSignoffEvidence(evidence)) {
      throw new Error("Staging signoff evidence is incomplete. Approver name, timestamp, signature method, reviewed evidence, reviewed repository scope, and rejection reason or conditional terms when applicable are required.");
    }
    this.stagingHumanSignoffs[role] = evidence;
    return clone(evidence);
  }

  listCicdPipelineProfiles(): CICDPipelineProfile[] {
    return clone(this.cicdPipelineProfiles);
  }

  listCicdJobDefinitions(filter: { profileId?: CICDPipelineProfileName; category?: CICDJobCategory } = {}): CICDJobDefinition[] {
    return clone(this.cicdJobDefinitions.filter((job) =>
      (filter.profileId === undefined || job.profileId === filter.profileId) &&
      (filter.category === undefined || job.category === filter.category)
    ));
  }

  listCicdIntegrationTestGates(): CICDIntegrationTestGate[] {
    return clone(this.cicdIntegrationTestGates);
  }

  listCicdReadinessChecks(filter: { category?: CICDReadinessCategory } = {}): CICDReadinessCheck[] {
    return clone(this.cicdReadinessChecks.filter((check) => filter.category === undefined || check.category === filter.category));
  }

  listCicdRisks(): CICDRisk[] {
    return clone(this.cicdRisks);
  }

  getCicdPipelineReadinessSummary(): CICDPipelineReadinessSummary {
    const criticalBlockers = this.cicdReadinessChecks.filter((check) => check.status === "fail" && check.severity === "critical");
    const currentNodeVersion = process.version;
    const currentNodeMajor = Number.parseInt(currentNodeVersion.replace(/^v/, "").split(".")[0] ?? "", 10);
    return {
      generatedAt: this.now(),
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      stagingDeployed: false,
      deploymentWorkflowCreated: false,
      activeWorkflowCreated: false,
      externalCallsEnabledByDefault: false,
      remoteIntegrationTestsEnabledByDefault: false,
      secretsExposed: false,
      envValuesExposed: false,
      packageManager: "pnpm",
      expectedNodeVersion: ">=24.0.0",
      voltaNodeVersion: "24.15.0",
      currentNodeVersion,
      nodeVersionStatus: Number.isInteger(currentNodeMajor) ? currentNodeMajor >= 24 ? "pass" : "warning" : "unknown",
      profileCount: this.cicdPipelineProfiles.length,
      jobCount: this.cicdJobDefinitions.length,
      requiredJobCount: this.cicdJobDefinitions.filter((job) => job.required).length,
      optionalJobCount: this.cicdJobDefinitions.filter((job) => !job.required).length,
      safetyJobCount: this.cicdJobDefinitions.filter((job) => job.category === "security_scan" || job.category === "secret_scan" || job.category === "dashboard_smoke" || job.category === "readiness_check").length,
      integrationGateCount: this.cicdIntegrationTestGates.length,
      disabledByDefaultIntegrationGateCount: this.cicdIntegrationTestGates.filter((gate) => gate.enabledByDefault === false).length,
      readinessCheckCount: this.cicdReadinessChecks.length,
      criticalBlockerCount: criticalBlockers.length,
      riskCount: this.cicdRisks.length,
      stagingPromotionReady: false,
      artifactPolicyStatus: "planned_redacted_only",
      cleanupRollbackStatus: "planned_manual_only",
      noSecretScanStatus: "planned_required",
      metadata: {
        docs: "docs/roadmaps/staging-ci-cd-pipeline/v0.md",
        planDocs: "docs/roadmaps/staging-ci-cd-pipeline/v0-plan.md",
        jobMatrixDocs: "docs/roadmaps/staging-ci-cd-pipeline/job-matrix-v0.md",
        integrationGateDocs: "docs/roadmaps/staging-ci-cd-pipeline/integration-test-gates-v0.md",
        secretEnvSafetyDocs: "docs/roadmaps/staging-ci-cd-pipeline/secret-env-safety-v0.md",
        artifactPolicyDocs: "docs/roadmaps/staging-ci-cd-pipeline/artifact-report-policy-v0.md",
        stagingPromotionDocs: "docs/roadmaps/staging-ci-cd-pipeline/staging-promotion-v0.md",
        cleanupRollbackDocs: "docs/roadmaps/staging-ci-cd-pipeline/cleanup-rollback-v0.md",
        workflowCreated: false,
        deploymentImplemented: false,
        remoteIntegrationTestsRunByDefault: false,
        secretsReturned: false,
        envValuesReturned: false
      }
    };
  }

  getGitHubAppIntegrationTestProfile(): GitHubAppIntegrationTestProfile {
    const summary = this.getGitHubAppIntegrationTestReadinessSummary();
    return clone({
      ...this.githubAppIntegrationTestProfile,
      status: summary.unsafeGateCount > 0
        ? "blocked"
        : summary.liveTestsEnabled
          ? "ready_if_configured"
          : "disabled",
      allowedRepos: summary.allowedRepoCount > 0 ? ["configured_repo_allowlist_redacted"] : this.githubAppIntegrationTestProfile.allowedRepos,
      metadata: {
        ...this.githubAppIntegrationTestProfile.metadata,
        liveTestsEnabled: summary.liveTestsEnabled,
        canRunLiveTests: summary.canRunLiveTests,
        missingGateCount: summary.missingGateCount,
        unsafeGateCount: summary.unsafeGateCount,
        allowedRepoCount: summary.allowedRepoCount,
        envValuesReturned: false,
        secretValuesReturned: false
      }
    });
  }

  listGitHubAppIntegrationTestCases(): GitHubAppIntegrationTestCase[] {
    return clone(this.githubAppIntegrationTestCases);
  }

  listGitHubAppIntegrationTestSafetyChecks(filter: { category?: GitHubAppIntegrationTestSafetyCategory } = {}): GitHubAppIntegrationTestSafetyCheck[] {
    const summary = this.getGitHubAppIntegrationTestReadinessSummary();
    const checks = this.githubAppIntegrationTestSafetyChecks.map((check) => {
      if (check.category === "env_gates") {
        return {
          ...check,
          status: summary.canRunLiveTests ? "pass" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            liveTestsEnabled: summary.liveTestsEnabled,
            missingGateCount: summary.missingGateCount,
            missingRequiredEnvVars: summary.missingRequiredEnvVars,
            skipReason: summary.canRunLiveTests ? undefined : "live_github_tests_skip_until_all_gates_configured"
          }
        };
      }
      if (check.category === "repo_allowlist") {
        return {
          ...check,
          status: summary.allowedRepoCount > 0 ? "pass" as const : "warning" as const,
          metadata: { ...check.metadata, allowedRepoCount: summary.allowedRepoCount, envValuesReturned: false }
        };
      }
      if (check.category === "branch_prefix") {
        return {
          ...check,
          status: summary.branchPrefixMatchesRequired ? "pass" as const : summary.branchPrefixConfigured ? "fail" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            expectedPrefix: summary.allowedBranchPrefix,
            branchPrefixConfigured: summary.branchPrefixConfigured,
            branchPrefixMatchesRequired: summary.branchPrefixMatchesRequired,
            configuredPrefixReturned: false
          }
        };
      }
      if (check.category === "secretref") {
        return {
          ...check,
          status: summary.configuredSecretRefCount > 0 ? "pass" as const : "warning" as const,
          metadata: { ...check.metadata, configuredSecretRefCount: summary.configuredSecretRefCount, secretRefIdsReturned: false }
        };
      }
      if (check.category === "no_auto_merge") {
        return {
          ...check,
          status: summary.unsafeGateWarnings.includes("remote_merge_enabled") ? "fail" as const : "pass" as const,
          metadata: { ...check.metadata, remoteMergeForbidden: summary.noAutoMerge }
        };
      }
      return check;
    });
    return clone(checks.filter((check) => filter.category === undefined || check.category === filter.category));
  }

  canRunGitHubAppIntegrationLiveTests(): boolean {
    return this.getGitHubAppIntegrationTestReadinessSummary().canRunLiveTests;
  }

  getGitHubAppIntegrationTestReadinessSummary(): GitHubAppIntegrationTestReadinessSummary {
    const missingRequiredEnvVars = this.githubAppIntegrationMissingRequiredEnvVars();
    const unsafeGateWarnings = this.githubAppIntegrationUnsafeGateWarnings();
    const allowedRepoCount = csvCount(this.env.AICHESTRA_GITHUB_APP_ALLOWED_REPOS);
    const configuredSecretRefCount = [
      this.env.AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF,
      this.env.AICHESTRA_GITHUB_APP_WEBHOOK_SECRET_REF ?? this.env.AICHESTRA_GITHUB_WEBHOOK_SECRET_REF
    ].filter((value) => typeof value === "string" && value.trim().length > 0).length;
    const branchPrefixConfigured = typeof this.env.AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX === "string" &&
      this.env.AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX.trim().length > 0;
    const branchPrefixMatchesRequired = this.env.AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX === "ai/";
    const liveTestsEnabled = flag(this.env.AICHESTRA_GITHUB_APP_INTEGRATION_TESTS);
    const canRunLiveTests = liveTestsEnabled && missingRequiredEnvVars.length === 0 && unsafeGateWarnings.length === 0;
    const liveWebhookTestsEnabled = canRunLiveTests &&
      flag(this.env.AICHESTRA_ENABLE_GITHUB_WEBHOOKS) &&
      Boolean(this.env.AICHESTRA_GITHUB_WEBHOOK_SECRET_REF || this.env.AICHESTRA_GITHUB_APP_WEBHOOK_SECRET_REF) &&
      this.env.AICHESTRA_GITHUB_WEBHOOK_ACCEPT_UNVERIFIED === "false";
    return {
      generatedAt: this.now(),
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      liveTestsEnabled,
      canRunLiveTests,
      defaultLiveTestsSkipped: true,
      requiredGateCount: this.githubAppIntegrationTestProfile.requiredEnvVars.length,
      configuredGateCount: this.githubAppIntegrationTestProfile.requiredEnvVars.length - missingRequiredEnvVars.length,
      missingGateCount: missingRequiredEnvVars.length,
      unsafeGateCount: unsafeGateWarnings.length,
      missingRequiredEnvVars,
      unsafeGateWarnings,
      allowedRepoCount,
      allowedBranchPrefix: "ai/",
      branchPrefixConfigured,
      branchPrefixMatchesRequired,
      requiredSecretRefCount: this.githubAppIntegrationTestProfile.requiredSecretRefs.length,
      configuredSecretRefCount,
      testCaseCount: this.githubAppIntegrationTestCases.length,
      gatedLiveTestCaseCount: this.githubAppIntegrationTestCases.filter((testCase) => testCase.requiresLiveGitHub).length,
      webhookFixtureTestsEnabled: true,
      liveWebhookTestsEnabled,
      cleanupPolicyStatus: "manual_close_or_mark_only",
      noAutoMerge: true,
      noForcePush: true,
      noBranchDelete: true,
      noSecretsExposed: true,
      envValuesExposed: false,
      privateKeyExposed: false,
      installationTokenExposed: false,
      githubCallsInDefaultTests: false,
      metadata: {
        docs: "docs/roadmaps/github-app-integration-test-profile/v1.md",
        planDocs: "docs/roadmaps/github-app-integration-test-profile/v1-plan.md",
        defaultTestsCallGitHub: false,
        liveTestsSkipWhenGatesMissing: true,
        rawPrivateKeyReturned: false,
        rawInstallationTokenReturned: false,
        rawWebhookSecretReturned: false,
        envValuesReturned: false,
        automaticMergeEnabled: false,
        forcePushEnabled: false,
        branchDeletionEnabled: false
      }
    };
  }

  getLLMIntegrationTestProfile(): LLMIntegrationTestProfile {
    const summary = this.getLLMIntegrationTestReadinessSummary();
    return clone({
      ...this.llmIntegrationTestProfile,
      status: summary.unsafeGateCount > 0
        ? "blocked"
        : summary.liveTestsEnabled
          ? "ready_if_configured"
          : "disabled",
      allowedModels: summary.allowedModelCount > 0 ? ["configured_model_allowlist_redacted"] : this.llmIntegrationTestProfile.allowedModels,
      metadata: {
        ...this.llmIntegrationTestProfile.metadata,
        liveTestsEnabled: summary.liveTestsEnabled,
        canRunLiveTests: summary.canRunLiveTests,
        missingGateCount: summary.missingGateCount,
        unsafeGateCount: summary.unsafeGateCount,
        allowedModelCount: summary.allowedModelCount,
        baseUrlReturned: false,
        envValuesReturned: false,
        secretValuesReturned: false,
        rawProviderResponseReturned: false
      }
    });
  }

  listLLMIntegrationTestCases(): LLMIntegrationTestCase[] {
    return clone(this.llmIntegrationTestCases);
  }

  listLLMIntegrationTestSafetyChecks(filter: { category?: LLMIntegrationTestSafetyCategory } = {}): LLMIntegrationTestSafetyCheck[] {
    const summary = this.getLLMIntegrationTestReadinessSummary();
    const checks = this.llmIntegrationTestSafetyChecks.map((check) => {
      if (check.category === "env_gates") {
        return {
          ...check,
          status: summary.canRunLiveTests ? "pass" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            liveTestsEnabled: summary.liveTestsEnabled,
            missingGateCount: summary.missingGateCount,
            missingRequiredEnvVars: summary.missingRequiredEnvVars,
            skipReason: summary.canRunLiveTests ? undefined : "live_llm_tests_skip_until_all_gates_configured"
          }
        };
      }
      if (check.category === "secretref") {
        return {
          ...check,
          status: summary.secretRefConfigured ? "pass" as const : summary.rawEnvApiKeyConfigured ? "warning" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            secretRefConfigured: summary.secretRefConfigured,
            credentialSource: summary.credentialSource,
            secretRefIdsReturned: false,
            apiKeyReturned: false
          }
        };
      }
      if (check.category === "model_allowlist") {
        const modelUnsafe = summary.unsafeGateWarnings.includes("default_model_not_allowlisted");
        return {
          ...check,
          status: modelUnsafe ? "fail" as const : summary.allowedModelCount > 0 && summary.defaultModelAllowlisted ? "pass" as const : summary.liveTestsEnabled ? "fail" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            allowedModelCount: summary.allowedModelCount,
            defaultModelConfigured: summary.defaultModelConfigured,
            defaultModelAllowlisted: summary.defaultModelAllowlisted,
            modelNamesReturned: false
          }
        };
      }
      if (check.category === "budget") {
        const budgetUnsafe = summary.unsafeGateWarnings.includes("budget_cap_exceeds_profile_limit") || summary.unsafeGateWarnings.includes("budget_cap_invalid");
        return {
          ...check,
          status: budgetUnsafe ? "fail" as const : summary.budgetConfigured ? "pass" as const : summary.liveTestsEnabled ? "fail" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            budgetConfigured: summary.budgetConfigured,
            budgetLimitUsdConfigured: summary.budgetLimitUsdConfigured,
            budgetValueReturned: false
          }
        };
      }
      if (check.category === "no_streaming") {
        return {
          ...check,
          status: summary.unsafeGateWarnings.includes("streaming_enabled") ? "fail" as const : "pass" as const,
          metadata: { ...check.metadata, streamingAllowed: false }
        };
      }
      if (check.category === "no_tool_calls") {
        return {
          ...check,
          status: summary.unsafeGateWarnings.includes("tool_calls_enabled") ? "fail" as const : "pass" as const,
          metadata: { ...check.metadata, toolCallsAllowed: false }
        };
      }
      if (check.category === "no_unbounded_fallback") {
        return {
          ...check,
          status: summary.fallbackSafe ? "pass" as const : "fail" as const,
          metadata: {
            ...check.metadata,
            fallbackEnabled: summary.fallbackEnabled,
            maxFallbackAttempts: summary.maxFallbackAttempts
          }
        };
      }
      return check;
    });
    return clone(checks.filter((check) => filter.category === undefined || check.category === filter.category));
  }

  canRunLLMIntegrationLiveTests(): boolean {
    return this.getLLMIntegrationTestReadinessSummary().canRunLiveTests;
  }

  getLLMIntegrationTestReadinessSummary(): LLMIntegrationTestReadinessSummary {
    const missingRequiredEnvVars = this.llmIntegrationMissingRequiredEnvVars();
    const unsafeGateWarnings = this.llmIntegrationUnsafeGateWarnings();
    const allowedModels = csvValues(this.env.AICHESTRA_LLM_ALLOWED_MODELS);
    const defaultModel = this.env.AICHESTRA_LLM_DEFAULT_MODEL;
    const defaultModelConfigured = typeof defaultModel === "string" && defaultModel.trim().length > 0;
    const defaultModelAllowlisted = defaultModelConfigured && allowedModels.includes(defaultModel.trim());
    const secretRefConfigured = typeof this.env.AICHESTRA_LLM_API_KEY_SECRET_REF === "string" && this.env.AICHESTRA_LLM_API_KEY_SECRET_REF.trim().length > 0;
    const rawEnvApiKeyConfigured = typeof this.env.AICHESTRA_LLM_API_KEY === "string" && this.env.AICHESTRA_LLM_API_KEY.trim().length > 0;
    const envSecretProviderEnabled = flag(this.env.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER);
    const allowedSecretEnvKeyConfigured = csvValues(this.env.AICHESTRA_ALLOWED_SECRET_ENV_KEYS).includes("AICHESTRA_LLM_API_KEY");
    const budgetLimit = positiveNumber(this.env.AICHESTRA_LLM_TEST_BUDGET_USD);
    const liveTestsEnabled = flag(this.env.AICHESTRA_LLM_INTEGRATION_TESTS);
    const maxFallbackAttempts = Number.isFinite(Number(this.env.AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS))
      ? Number(this.env.AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS)
      : 0;
    const fallbackEnabled = flag(this.env.AICHESTRA_ENABLE_LLM_FALLBACK);
    const fallbackSafe = !fallbackEnabled && maxFallbackAttempts === 0;
    const canRunLiveTests = liveTestsEnabled && missingRequiredEnvVars.length === 0 && unsafeGateWarnings.length === 0;
    return {
      generatedAt: this.now(),
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      liveTestsEnabled,
      canRunLiveTests,
      defaultLiveTestsSkipped: true,
      requiredGateCount: this.llmIntegrationTestProfile.requiredEnvVars.length,
      configuredGateCount: this.llmIntegrationTestProfile.requiredEnvVars.length - missingRequiredEnvVars.length,
      missingGateCount: missingRequiredEnvVars.length,
      unsafeGateCount: unsafeGateWarnings.length,
      missingRequiredEnvVars,
      unsafeGateWarnings,
      providerKind: "openai_compatible",
      providerId: "openai_compatible",
      remoteLlmEnabled: flag(this.env.AICHESTRA_ENABLE_REMOTE_LLM),
      remoteCompletionEnabled: flag(this.env.AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION),
      baseUrlConfigured: typeof this.env.AICHESTRA_LLM_BASE_URL === "string" && this.env.AICHESTRA_LLM_BASE_URL.trim().length > 0,
      apiKeyConfigured: secretRefConfigured || rawEnvApiKeyConfigured,
      secretRefConfigured,
      rawEnvApiKeyConfigured,
      credentialSource: secretRefConfigured ? "secret_ref" : rawEnvApiKeyConfigured ? "test_env" : "none",
      envSecretProviderEnabled,
      allowedSecretEnvKeyConfigured,
      allowedModelCount: allowedModels.length,
      defaultModelConfigured,
      defaultModelAllowlisted,
      routingMode: this.env.AICHESTRA_LLM_ROUTING_MODE ?? "mock_only",
      routingModeAllowed: this.llmIntegrationRoutingModeAllowed(),
      fallbackEnabled,
      maxFallbackAttempts,
      fallbackSafe,
      budgetConfigured: budgetLimit !== undefined,
      budgetLimitUsdConfigured: budgetLimit !== undefined,
      promptClassConfigured: typeof this.env.AICHESTRA_LLM_TEST_PROMPT_CLASS === "string" && this.env.AICHESTRA_LLM_TEST_PROMPT_CLASS.trim().length > 0,
      requiredSecretRefCount: this.llmIntegrationTestProfile.requiredSecretRefs.length,
      configuredSecretRefCount: secretRefConfigured ? 1 : 0,
      testCaseCount: this.llmIntegrationTestCases.length,
      gatedLiveTestCaseCount: this.llmIntegrationTestCases.filter((testCase) => testCase.requiresRemoteLLM).length,
      mockTestCaseCount: this.llmIntegrationTestCases.filter((testCase) => !testCase.requiresRemoteLLM).length,
      noStreaming: true,
      noToolCalls: true,
      noVendorCli: true,
      noCredentialCacheRead: true,
      noSecretsExposed: true,
      envValuesExposed: false,
      apiKeyExposed: false,
      rawProviderResponseExposed: false,
      remoteLlmCallsInDefaultTests: false,
      metadata: {
        docs: "docs/roadmaps/llm-gateway-integration-test-profile/v1.md",
        planDocs: "docs/roadmaps/llm-gateway-integration-test-profile/v1-plan.md",
        defaultTestsCallRemoteLLM: false,
        liveTestsSkipWhenGatesMissing: true,
        baseUrlReturned: false,
        apiKeyReturned: false,
        rawEnvValuesReturned: false,
        rawPromptReturned: false,
        rawProviderResponseReturned: false,
        streamingEnabled: false,
        toolCallsEnabled: false,
        vendorCliEnabled: false,
        credentialCacheRead: false
      }
    };
  }

  getVaultIntegrationTestProfile(): VaultIntegrationTestProfile {
    const summary = this.getVaultIntegrationTestReadinessSummary();
    return clone({
      ...this.vaultIntegrationTestProfile,
      status: summary.profileStatus,
      requiredPathAllowlist: summary.pathAllowlistConfigured ? ["configured_path_allowlist_redacted"] : this.vaultIntegrationTestProfile.requiredPathAllowlist,
      metadata: {
        ...this.vaultIntegrationTestProfile.metadata,
        liveTestsEnabled: summary.liveTestsEnabled,
        canRunLiveTests: summary.canRunLiveTests,
        missingGateCount: summary.missingGateCount,
        unsafeGateCount: summary.unsafeGateCount,
        vaultBackendSelected: summary.vaultBackendSelected,
        vaultProviderEnabled: summary.vaultProviderEnabled,
        vaultAddressConfigured: summary.vaultAddressConfigured,
        vaultNamespaceConfigured: summary.vaultNamespaceConfigured,
        pathAllowlistPrefixCount: summary.pathAllowlistPrefixCount,
        testSecretPathAllowlisted: summary.testSecretPathAllowlisted,
        envValuesReturned: false,
        secretValuesReturned: false,
        vaultTokenReturned: false,
        vaultAddressReturned: false,
        rawPathReturned: false
      }
    });
  }

  listVaultIntegrationTestCases(): VaultIntegrationTestCase[] {
    return clone(this.vaultIntegrationTestCases);
  }

  listVaultIntegrationTestSafetyChecks(filter: { category?: VaultIntegrationTestSafetyCategory } = {}): VaultIntegrationTestSafetyCheck[] {
    const summary = this.getVaultIntegrationTestReadinessSummary();
    const checks = this.vaultIntegrationTestSafetyChecks.map((check) => {
      if (check.category === "env_gates") {
        return {
          ...check,
          status: summary.unsafeGateCount > 0 ? "fail" as const : summary.canRunLiveTests ? "pass" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            liveTestsEnabled: summary.liveTestsEnabled,
            missingGateCount: summary.missingGateCount,
            missingRequiredEnvVars: summary.missingRequiredEnvVars,
            unsafeGateCount: summary.unsafeGateCount,
            skipReason: summary.canRunLiveTests ? undefined : summary.reason,
            envValuesReturned: false
          }
        };
      }
      if (check.category === "vault_address") {
        return {
          ...check,
          status: summary.vaultAddressConfigured ? "pass" as const : summary.liveTestsEnabled ? "fail" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            configured: summary.vaultAddressConfigured,
            addressValueReturned: false
          }
        };
      }
      if (check.category === "auth_method") {
        return {
          ...check,
          status: summary.vaultAuthMethodConfigured && summary.vaultAuthMethod === "token" ? "pass" as const : summary.liveTestsEnabled ? "fail" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            authMethod: summary.vaultAuthMethod,
            authMethodConfigured: summary.vaultAuthMethodConfigured,
            tokenAuthRequired: true
          }
        };
      }
      if (check.category === "token_presence") {
        return {
          ...check,
          status: summary.vaultTokenConfigured ? "pass" as const : summary.liveTestsEnabled ? "fail" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            tokenConfigured: summary.vaultTokenConfigured,
            tokenValueReturned: false
          }
        };
      }
      if (check.category === "path_allowlist") {
        const unsafeAllowlist = summary.unsafeGateWarnings.includes("test_secret_path_not_allowlisted") ||
          summary.unsafeGateWarnings.includes("path_allowlist_prefix_not_test_only") ||
          summary.unsafeGateWarnings.includes("production_like_path_allowlist_configured");
        return {
          ...check,
          status: unsafeAllowlist ? "fail" as const : summary.pathAllowlistConfigured && summary.testSecretPathAllowlisted ? "pass" as const : summary.liveTestsEnabled ? "fail" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            pathAllowlistConfigured: summary.pathAllowlistConfigured,
            pathAllowlistPrefixCount: summary.pathAllowlistPrefixCount,
            testSecretPathAllowlisted: summary.testSecretPathAllowlisted,
            pathValuesReturned: false
          }
        };
      }
      if (check.category === "test_secret_path") {
        const unsafePath = summary.unsafeGateWarnings.includes("test_secret_path_not_allowlisted") ||
          summary.unsafeGateWarnings.includes("test_secret_path_not_test_only") ||
          summary.unsafeGateWarnings.includes("production_like_test_path_configured") ||
          summary.unsafeGateWarnings.includes("test_secret_key_not_test_marker");
        return {
          ...check,
          status: unsafePath ? "fail" as const : summary.testSecretPathConfigured && summary.testSecretKeyConfigured ? "pass" as const : summary.liveTestsEnabled ? "fail" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            testSecretPathConfigured: summary.testSecretPathConfigured,
            testSecretKeyConfigured: summary.testSecretKeyConfigured,
            testSecretPathAllowlisted: summary.testSecretPathAllowlisted,
            testSecretPathLooksTestOnly: summary.testSecretPathLooksTestOnly,
            rawPathReturned: false,
            rawKeyReturned: false
          }
        };
      }
      if (check.category === "no_write") {
        return {
          ...check,
          status: summary.unsafeGateWarnings.includes("vault_write_enabled") ? "fail" as const : "pass" as const,
          metadata: { ...check.metadata, writeAllowed: false }
        };
      }
      if (check.category === "no_delete") {
        return {
          ...check,
          status: summary.unsafeGateWarnings.includes("vault_delete_enabled") ? "fail" as const : "pass" as const,
          metadata: { ...check.metadata, deleteAllowed: false }
        };
      }
      if (check.category === "no_rotate") {
        return {
          ...check,
          status: summary.unsafeGateWarnings.includes("vault_rotate_enabled") ? "fail" as const : "pass" as const,
          metadata: { ...check.metadata, rotateAllowed: false }
        };
      }
      if (check.category === "no_broad_list") {
        return {
          ...check,
          status: summary.unsafeGateWarnings.includes("vault_broad_list_enabled") ? "fail" as const : "pass" as const,
          metadata: { ...check.metadata, broadListAllowed: false }
        };
      }
      return check;
    });
    return clone(checks.filter((check) => filter.category === undefined || check.category === filter.category));
  }

  canRunVaultIntegrationLiveTests(): boolean {
    return this.getVaultIntegrationTestReadinessSummary().canRunLiveTests;
  }

  getVaultIntegrationTestReadinessSummary(): VaultIntegrationTestReadinessSummary {
    const missingRequiredEnvVars = this.vaultIntegrationMissingRequiredEnvVars();
    const unsafeGateWarnings = this.vaultIntegrationUnsafeGateWarnings();
    const liveTestsEnabled = flag(this.env.AICHESTRA_VAULT_INTEGRATION_TESTS);
    const vaultBackendSelected = this.env.AICHESTRA_SECRET_BACKEND_PROVIDER === "vault";
    const vaultProviderEnabled = flag(this.env.AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER);
    const vaultAddressConfigured = stringConfigured(this.env.AICHESTRA_VAULT_ADDR);
    const vaultNamespaceConfigured = stringConfigured(this.env.AICHESTRA_VAULT_NAMESPACE);
    const vaultAuthMethodConfigured = stringConfigured(this.env.AICHESTRA_VAULT_AUTH_METHOD);
    const vaultAuthMethod = this.env.AICHESTRA_VAULT_AUTH_METHOD ?? "token";
    const vaultTokenConfigured = stringConfigured(this.env.AICHESTRA_VAULT_TOKEN);
    const vaultKvMountConfigured = stringConfigured(this.env.AICHESTRA_VAULT_KV_MOUNT);
    const pathPrefixes = csvValues(this.env.AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES);
    const testSecretPath = this.env.AICHESTRA_TEST_VAULT_SECRET_PATH?.trim();
    const testSecretKey = this.env.AICHESTRA_TEST_VAULT_SECRET_KEY?.trim();
    const testSecretPathConfigured = Boolean(testSecretPath);
    const testSecretKeyConfigured = Boolean(testSecretKey);
    const configuredTestSecretPath = testSecretPath ?? "";
    const testSecretPathAllowlisted = testSecretPathConfigured && pathPrefixes.some((prefix) => testSecretPathAllowedByPrefix(configuredTestSecretPath, prefix));
    const testSecretPathLooksTestOnly = testSecretPathConfigured && looksLikeTestOnlyVaultPath(configuredTestSecretPath);
    const configuredSecretRefCount = vaultBackendSelected && vaultKvMountConfigured && testSecretPathConfigured && testSecretKeyConfigured ? 1 : 0;
    const canRunLiveTests = liveTestsEnabled && missingRequiredEnvVars.length === 0 && unsafeGateWarnings.length === 0;
    const profileStatus: VaultIntegrationTestProfileStatus = unsafeGateWarnings.length > 0
      ? "blocked"
      : liveTestsEnabled
        ? "ready_if_configured"
        : "disabled";
    return {
      generatedAt: this.now(),
      id: "vault_integration_test_summary_v1",
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      profileStatus,
      backendKind: "vault",
      liveTestsEnabled,
      canRunLiveTests,
      defaultLiveTestsSkipped: true,
      requiredGateCount: this.vaultIntegrationTestProfile.requiredEnvVars.length,
      configuredGateCount: this.vaultIntegrationTestProfile.requiredEnvVars.length - missingRequiredEnvVars.length,
      missingGateCount: missingRequiredEnvVars.length,
      unsafeGateCount: unsafeGateWarnings.length,
      missingRequiredEnvVars,
      unsafeGateWarnings,
      reason: canRunLiveTests ? "all_vault_integration_gates_configured" : unsafeGateWarnings.length > 0 ? "unsafe_vault_integration_gate_detected" : "live_vault_tests_skip_until_all_gates_configured",
      vaultBackendSelected,
      vaultProviderEnabled,
      vaultAddressConfigured,
      vaultNamespaceConfigured,
      vaultAuthMethodConfigured,
      vaultAuthMethod,
      vaultTokenConfigured,
      vaultKvMountConfigured,
      pathAllowlistConfigured: pathPrefixes.length > 0,
      pathAllowlistPrefixCount: pathPrefixes.length,
      testSecretPathConfigured,
      testSecretKeyConfigured,
      testSecretPathAllowlisted,
      testSecretPathLooksTestOnly,
      requiredSecretRefCount: this.vaultIntegrationTestProfile.requiredSecretRefs.length,
      configuredSecretRefCount,
      credentialSource: configuredSecretRefCount > 0 ? "vault_secretref" : "none",
      envFallbackUsed: false,
      testCaseCount: this.vaultIntegrationTestCases.length,
      gatedLiveTestCaseCount: this.vaultIntegrationTestCases.filter((testCase) => testCase.requiresLiveVault).length,
      activeMockTestCaseCount: this.vaultIntegrationTestCases.filter((testCase) => !testCase.requiresLiveVault).length,
      noWrite: true,
      noDelete: true,
      noRotate: true,
      noBroadList: true,
      noSecretsExposed: true,
      envValuesExposed: false,
      vaultTokenExposed: false,
      vaultAddressExposed: false,
      vaultSecretValueExposed: false,
      vaultCallsInDefaultTests: false,
      metadata: {
        docs: "docs/roadmaps/vault-integration-test-profile/v1.md",
        planDocs: "docs/roadmaps/vault-integration-test-profile/v1-plan.md",
        vaultBackendDocs: "docs/foundations/vault-secret-backend/v1.md",
        liveTestsSkipWhenGatesMissing: true,
        defaultTestsCallVault: false,
        vaultAddressReturned: false,
        vaultTokenReturned: false,
        secretPathReturned: false,
        secretKeyReturned: false,
        secretValueReturned: false,
        envValuesReturned: false,
        writeAllowed: false,
        deleteAllowed: false,
        rotateAllowed: false,
        broadListAllowed: false,
        productionSecretBackendReady: false
      }
    };
  }

  getVaultLiveIntegrationReadiness(): VaultLiveIntegrationReadiness {
    const summary = this.getVaultIntegrationTestReadinessSummary();
    const unsafe = new Set(summary.unsafeGateWarnings);
    const testPathLooksSafe = summary.testSecretPathConfigured &&
      summary.testSecretPathAllowlisted &&
      summary.testSecretPathLooksTestOnly &&
      !unsafe.has("production_like_test_path_configured") &&
      !unsafe.has("production_like_path_allowlist_configured") &&
      !unsafe.has("path_allowlist_prefix_not_test_only") &&
      !unsafe.has("test_secret_key_not_test_marker");
    const status: VaultLiveIntegrationReadinessStatus = summary.unsafeGateCount > 0
      ? "blocked_unsafe"
      : summary.liveTestsEnabled && summary.missingGateCount === 0
        ? "ready_for_manual_live_test"
        : summary.liveTestsEnabled
          ? "ready_if_configured"
          : "skipped";

    return clone({
      id: "vault_live_integration_readiness_v1",
      status,
      requiredGateCount: summary.requiredGateCount,
      configuredGateCount: summary.configuredGateCount,
      missingGates: summary.missingRequiredEnvVars,
      unsafeGates: summary.unsafeGateWarnings,
      testPathAllowlisted: summary.testSecretPathAllowlisted,
      testPathLooksSafe,
      writeOperationsAllowed: false,
      deleteOperationsAllowed: false,
      rotationAllowed: false,
      broadListAllowed: false,
      metadata: {
        docs: "docs/foundations/vault-secret-backend/live-integration-enablement-v1.md",
        planDocs: "docs/foundations/vault-secret-backend/live-integration-enablement-v1-plan.md",
        profileDocs: "docs/roadmaps/vault-integration-test-profile/v1.md",
        liveTestsEnabled: summary.liveTestsEnabled,
        canRunLiveValidation: status === "ready_for_manual_live_test",
        vaultBackendSelected: summary.vaultBackendSelected,
        vaultProviderEnabled: summary.vaultProviderEnabled,
        vaultAddressConfigured: summary.vaultAddressConfigured,
        vaultTokenConfigured: summary.vaultTokenConfigured,
        vaultKvMountConfigured: summary.vaultKvMountConfigured,
        testSecretPathConfigured: summary.testSecretPathConfigured,
        testSecretKeyConfigured: summary.testSecretKeyConfigured,
        pathAllowlistPrefixCount: summary.pathAllowlistPrefixCount,
        vaultAddressReturned: false,
        vaultTokenReturned: false,
        rawPathReturned: false,
        rawKeyReturned: false,
        secretValueReturned: false,
        envValuesReturned: false,
        productionVaultRolloutImplemented: false
      }
    });
  }

  listVaultLiveValidationChecks(): VaultLiveValidationCheck[] {
    const summary = this.getVaultIntegrationTestReadinessSummary();
    const readiness = this.getVaultLiveIntegrationReadiness();
    const unsafe = new Set(summary.unsafeGateWarnings);
    const inactiveStatus = summary.liveTestsEnabled ? "warning" as const : "skipped" as const;
    const gateStatus = (configured: boolean): "pass" | "warning" | "fail" | "skipped" => configured ? "pass" : inactiveStatus;
    const failIfUnsafe = (warningIds: string[], fallback: "pass" | "warning" | "fail" | "skipped"): "pass" | "warning" | "fail" | "skipped" =>
      warningIds.some((warning) => unsafe.has(warning)) ? "fail" : fallback;

    const checks: VaultLiveValidationCheck[] = [
      {
        id: "vault_live_env_gates",
        checkKind: "env_gates",
        status: readiness.status === "blocked_unsafe" ? "fail" : summary.missingGateCount === 0 ? "pass" : inactiveStatus,
        severity: "critical",
        remediation: "Configure every required Vault live validation gate only in a reviewed non-production environment.",
        metadata: {
          requiredGateCount: summary.requiredGateCount,
          configuredGateCount: summary.configuredGateCount,
          missingGateCount: summary.missingGateCount,
          unsafeGateCount: summary.unsafeGateCount,
          envValuesReturned: false
        }
      },
      {
        id: "vault_live_provider_selected",
        checkKind: "provider_selected",
        status: gateStatus(summary.vaultBackendSelected),
        severity: "high",
        remediation: "Set AICHESTRA_SECRET_BACKEND_PROVIDER=vault for live validation only.",
        metadata: { vaultBackendSelected: summary.vaultBackendSelected, providerValueReturned: false }
      },
      {
        id: "vault_live_enable_flag",
        checkKind: "enable_flag",
        status: gateStatus(summary.vaultProviderEnabled),
        severity: "high",
        remediation: "Set AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true only for the reviewed live validation run.",
        metadata: { vaultProviderEnabled: summary.vaultProviderEnabled }
      },
      {
        id: "vault_live_addr_configured",
        checkKind: "vault_addr_configured",
        status: gateStatus(summary.vaultAddressConfigured),
        severity: "critical",
        remediation: "Configure AICHESTRA_VAULT_ADDR; readiness surfaces must expose only configured true/false.",
        metadata: { vaultAddressConfigured: summary.vaultAddressConfigured, vaultAddressReturned: false }
      },
      {
        id: "vault_live_token_configured",
        checkKind: "token_configured",
        status: gateStatus(summary.vaultTokenConfigured),
        severity: "critical",
        remediation: "Configure AICHESTRA_VAULT_TOKEN for the test-only run and keep it out of logs, API, health, dashboard, and audit.",
        metadata: { vaultTokenConfigured: summary.vaultTokenConfigured, vaultTokenReturned: false }
      },
      {
        id: "vault_live_mount_configured",
        checkKind: "mount_configured",
        status: gateStatus(summary.vaultKvMountConfigured),
        severity: "high",
        remediation: "Configure AICHESTRA_VAULT_KV_MOUNT for the test KV v2 mount.",
        metadata: { vaultKvMountConfigured: summary.vaultKvMountConfigured, mountValueReturned: false }
      },
      {
        id: "vault_live_path_allowlist",
        checkKind: "path_allowlist",
        status: failIfUnsafe(
          ["test_secret_path_not_allowlisted", "path_allowlist_prefix_not_test_only", "production_like_path_allowlist_configured"],
          summary.pathAllowlistConfigured && summary.testSecretPathAllowlisted ? "pass" : inactiveStatus
        ),
        severity: "critical",
        remediation: "Set AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES to a narrow test-only prefix that contains the configured test path.",
        metadata: {
          pathAllowlistConfigured: summary.pathAllowlistConfigured,
          pathAllowlistPrefixCount: summary.pathAllowlistPrefixCount,
          testPathAllowlisted: summary.testSecretPathAllowlisted,
          pathValuesReturned: false
        }
      },
      {
        id: "vault_live_test_path_safe",
        checkKind: "test_path_safe",
        status: failIfUnsafe(
          ["test_secret_path_not_test_only", "production_like_test_path_configured", "test_secret_key_not_test_marker"],
          readiness.testPathLooksSafe ? "pass" : inactiveStatus
        ),
        severity: "critical",
        remediation: "Use an allowlisted non-production path and a test-marked key; avoid production-looking path and key names.",
        metadata: {
          testSecretPathConfigured: summary.testSecretPathConfigured,
          testSecretKeyConfigured: summary.testSecretKeyConfigured,
          testPathAllowlisted: readiness.testPathAllowlisted,
          testPathLooksSafe: readiness.testPathLooksSafe,
          rawPathReturned: false,
          rawKeyReturned: false
        }
      },
      {
        id: "vault_live_no_write",
        checkKind: "no_write",
        status: unsafe.has("vault_write_enabled") ? "fail" : "pass",
        severity: "critical",
        remediation: "Remove any Vault write enablement flag; this profile is read-only.",
        metadata: { writeOperationsAllowed: false, writeAttempted: false }
      },
      {
        id: "vault_live_no_delete",
        checkKind: "no_delete",
        status: unsafe.has("vault_delete_enabled") ? "fail" : "pass",
        severity: "critical",
        remediation: "Remove any Vault delete enablement flag; this profile never deletes secrets.",
        metadata: { deleteOperationsAllowed: false, deleteAttempted: false }
      },
      {
        id: "vault_live_no_rotate",
        checkKind: "no_rotate",
        status: unsafe.has("vault_rotate_enabled") ? "fail" : "pass",
        severity: "critical",
        remediation: "Remove any Vault rotation enablement flag; rotation remains a future task.",
        metadata: { rotationAllowed: false }
      },
      {
        id: "vault_live_no_broad_list",
        checkKind: "no_broad_list",
        status: unsafe.has("vault_broad_list_enabled") ? "fail" : "pass",
        severity: "critical",
        remediation: "Remove any broad-list enablement flag; live validation reads only one configured KV v2 key.",
        metadata: { broadListAllowed: false, broadListAttempted: false }
      },
      {
        id: "vault_live_no_secret_exposure",
        checkKind: "no_secret_exposure",
        status: "pass",
        severity: "critical",
        remediation: "Keep DTO, health, dashboard, audit, and test assertions limited to booleans/counts/status metadata.",
        metadata: {
          noSecretsExposed: true,
          envValuesExposed: false,
          vaultTokenExposed: false,
          vaultAddressExposed: false,
          vaultPathExposed: false,
          vaultKeyExposed: false,
          secretValueExposed: false
        }
      }
    ];

    return clone(checks);
  }

  canRunVaultLiveValidation(): boolean {
    return this.getVaultLiveIntegrationReadiness().status === "ready_for_manual_live_test";
  }

  getVaultLiveValidationRunRecord(): VaultLiveValidationRunRecord {
    const readiness = this.getVaultLiveIntegrationReadiness();
    const status = readiness.status === "blocked_unsafe"
      ? "blocked"
      : readiness.status === "ready_for_manual_live_test"
        ? "ready"
        : "skipped";
    return clone({
      id: "vault_live_validation_run_record_v1",
      status,
      secretValueExposed: false,
      writeAttempted: false,
      deleteAttempted: false,
      broadListAttempted: false,
      metadata: {
        liveValidationExecutedByDefault: false,
        liveVaultCallAttempted: false,
        readyForManualLiveTest: status === "ready",
        blockedUnsafe: status === "blocked",
        skippedByDefault: status === "skipped",
        rotateAttempted: false,
        envValuesReturned: false,
        tokenReturned: false,
        productionVaultRolloutImplemented: false
      }
    });
  }

  getVaultLiveIntegrationRunbook(): VaultLiveIntegrationRunbook {
    const profile = this.getVaultIntegrationTestProfile();
    return clone({
      id: "vault_live_integration_runbook_v1",
      title: "Vault Live Integration Enablement v1 safe runbook",
      status: "metadata_only",
      requiredEnvVars: profile.requiredEnvVars,
      optionalEnvVars: ["AICHESTRA_VAULT_NAMESPACE", "AICHESTRA_VAULT_REQUEST_TIMEOUT_MS"],
      preparationSteps: [
        "Use a non-production Vault instance and a KV v2 mount dedicated to integration validation.",
        "Create one small test-only secret out of band under an allowlisted path that includes a test/dev/sandbox marker.",
        "Use a test-marked key name and do not use production credential names or production secret values.",
        "Configure only the required gates for the manual validation session; do not commit env files.",
        "Confirm /readiness/secrets/vault/live-readiness reports ready_for_manual_live_test before running the live skeleton."
      ],
      validationSteps: [
        "Run default pnpm lint, pnpm typecheck, pnpm test, and pnpm build first; these must not call Vault.",
        "After explicit operator approval and all gates are configured, run the targeted Vault backend live skeleton such as pnpm test tests/vault-secret-backend-v1.test.ts.",
        "Inspect only status, metadata, and audit redaction assertions; do not print token, path, key, env, or secret values.",
        "Clear live validation env gates after the run and keep production Vault rollout false."
      ],
      forbiddenOperations: [
        "vault_write",
        "vault_delete",
        "vault_rotate",
        "vault_broad_list",
        "secret_value_output",
        "env_value_output",
        "credential_cache_read",
        "production_vault_rollout"
      ],
      expectedSkipBehavior: "Default runtime/tests skip live validation unless every required gate is configured and unsafe gates are empty.",
      troubleshooting: [
        "If status is skipped, configure only the missing gate names shown by readiness output.",
        "If status is blocked_unsafe, remove unsafe gate settings before any live validation.",
        "If the path is not allowlisted, narrow AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES to the test-only prefix containing the test path.",
        "If the path is production-like, replace it with a path containing test, dev, integration, sandbox, nonprod, or ci and no production markers.",
        "If no-secret checks fail, stop and inspect redaction before retrying; do not run the live skeleton."
      ],
      metadata: {
        docs: "docs/foundations/vault-secret-backend/live-integration-enablement-v1.md",
        valuesReturned: false,
        liveVaultCallInRunbook: false,
        productionVaultRolloutImplemented: false
      }
    });
  }

  getVaultLiveIntegrationSummary(): VaultLiveIntegrationSummary {
    const readiness = this.getVaultLiveIntegrationReadiness();
    return clone({
      id: "vault_live_integration_summary_v1",
      status: "v1_implemented",
      readinessStatus: readiness.status,
      canRunLiveValidation: this.canRunVaultLiveValidation(),
      requiredGateCount: readiness.requiredGateCount,
      configuredGateCount: readiness.configuredGateCount,
      missingGateCount: readiness.missingGates.length,
      unsafeGateCount: readiness.unsafeGates.length,
      testPathAllowlisted: readiness.testPathAllowlisted,
      testPathLooksSafe: readiness.testPathLooksSafe,
      productionVaultRolloutImplemented: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      vaultTokenExposed: false,
      vaultAddressExposed: false,
      vaultPathExposed: false,
      vaultKeyExposed: false,
      writeOperationsAllowed: false,
      deleteOperationsAllowed: false,
      rotationAllowed: false,
      broadListAllowed: false,
      metadata: {
        docs: "docs/foundations/vault-secret-backend/live-integration-enablement-v1.md",
        liveTestsEnabledByDefault: false,
        defaultRuntimeCallsVault: false,
        liveValidationExecutedByDefault: false
      }
    });
  }

  getMergeQueueIntegrationTestProfile(): MergeQueueIntegrationTestProfile {
    const summary = this.getMergeQueueIntegrationTestReadinessSummary();
    return clone({
      ...this.mergeQueueIntegrationTestProfile,
      status: summary.profileStatus,
      requiredRepoAllowlist: summary.allowedRepoCount > 0
        ? ["configured_repo_allowlist_redacted"]
        : this.mergeQueueIntegrationTestProfile.requiredRepoAllowlist,
      metadata: {
        ...this.mergeQueueIntegrationTestProfile.metadata,
        liveTestsEnabled: summary.liveTestsEnabled,
        canRunLiveTests: summary.canRunLiveTests,
        missingGateCount: summary.missingGateCount,
        unsafeGateCount: summary.unsafeGateCount,
        allowedRepoCount: summary.allowedRepoCount,
        branchPrefixMatchesRequired: summary.branchPrefixMatchesRequired,
        dryRunOnly: summary.dryRunOnly,
        envValuesReturned: false,
        repoUrlsReturned: false,
        branchNamesReturned: false
      }
    });
  }

  listMergeQueueIntegrationTestCases(): MergeQueueIntegrationTestCase[] {
    return clone(this.mergeQueueIntegrationTestCases);
  }

  listMergeQueueIntegrationSafetyChecks(filter: { category?: MergeQueueIntegrationSafetyCategory } = {}): MergeQueueIntegrationSafetyCheck[] {
    const summary = this.getMergeQueueIntegrationTestReadinessSummary();
    const unsafe = (warning: string): boolean => summary.unsafeGateWarnings.includes(warning);
    const checks = this.mergeQueueIntegrationSafetyChecks.map((check) => {
      if (check.category === "env_gates") {
        return {
          ...check,
          status: summary.unsafeGateCount > 0 ? "fail" as const : summary.canRunLiveTests ? "pass" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            liveTestsEnabled: summary.liveTestsEnabled,
            missingGateCount: summary.missingGateCount,
            missingRequiredEnvVars: summary.missingRequiredEnvVars,
            unsafeGateCount: summary.unsafeGateCount,
            skipReason: summary.canRunLiveTests ? undefined : summary.reason,
            envValuesReturned: false
          }
        };
      }
      if (check.category === "repo_allowlist") {
        const unsafeRepo = unsafe("test_repo_not_allowlisted");
        return {
          ...check,
          status: unsafeRepo ? "fail" as const : summary.allowedRepoCount > 0 && summary.testRepoConfigured && summary.testRepoAllowlisted ? "pass" as const : summary.liveTestsEnabled ? "fail" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            allowedRepoCount: summary.allowedRepoCount,
            testRepoConfigured: summary.testRepoConfigured,
            testRepoAllowlisted: summary.testRepoAllowlisted,
            repoValuesReturned: false
          }
        };
      }
      if (check.category === "branch_prefix") {
        const unsafeBranch = unsafe("branch_prefix_mismatch") || unsafe("test_source_branches_outside_prefix");
        return {
          ...check,
          status: unsafeBranch ? "fail" as const : summary.branchPrefixMatchesRequired && summary.testSourceBranchesMatchPrefix ? "pass" as const : summary.liveTestsEnabled ? "fail" as const : "warning" as const,
          metadata: {
            ...check.metadata,
            requiredBranchPrefix: summary.requiredBranchPrefix,
            branchPrefixConfigured: summary.branchPrefixConfigured,
            branchPrefixMatchesRequired: summary.branchPrefixMatchesRequired,
            testSourceBranchesMatchPrefix: summary.testSourceBranchesMatchPrefix,
            branchValuesReturned: false
          }
        };
      }
      if (check.category === "no_auto_merge") {
        return {
          ...check,
          status: unsafe("remote_merge_enabled") || unsafe("remote_rebase_enabled") ? "fail" as const : "pass" as const,
          metadata: {
            ...check.metadata,
            remoteMergeEnabled: !summary.remoteMergeForbidden,
            remoteRebaseEnabled: !summary.remoteRebaseForbidden
          }
        };
      }
      if (check.category === "no_force_push") {
        return {
          ...check,
          status: unsafe("remote_force_push_enabled") ? "fail" as const : "pass" as const,
          metadata: { ...check.metadata, forcePushEnabled: !summary.remoteForcePushForbidden }
        };
      }
      if (check.category === "no_branch_delete") {
        return {
          ...check,
          status: unsafe("remote_branch_delete_enabled") ? "fail" as const : "pass" as const,
          metadata: { ...check.metadata, branchDeletionAllowed: !summary.remoteBranchDeleteForbidden }
        };
      }
      if (check.category === "dry_run_only") {
        return {
          ...check,
          status: unsafe("dry_run_only_disabled") ? "fail" as const : summary.dryRunOnly ? "pass" as const : "warning" as const,
          metadata: { ...check.metadata, dryRunOnly: summary.dryRunOnly }
        };
      }
      if (check.category === "cleanup") {
        return {
          ...check,
          status: summary.branchDeletionAllowed ? "fail" as const : "pass" as const,
          metadata: { ...check.metadata, cleanupPolicy: summary.cleanupPolicy, branchDeletionAllowed: summary.branchDeletionAllowed }
        };
      }
      if (check.category === "audit") {
        return {
          ...check,
          status: summary.noSecretsExposed && !summary.envValuesExposed && !summary.repoUrlsExposed && !summary.branchNamesExposed ? "pass" as const : "fail" as const,
          metadata: {
            ...check.metadata,
            envValuesExposed: summary.envValuesExposed,
            repoUrlsExposed: summary.repoUrlsExposed,
            branchNamesExposed: summary.branchNamesExposed
          }
        };
      }
      return check;
    });
    return clone(checks.filter((check) => filter.category === undefined || check.category === filter.category));
  }

  canRunMergeQueueIntegrationLiveTests(): boolean {
    return this.getMergeQueueIntegrationTestReadinessSummary().canRunLiveTests;
  }

  getMergeQueueIntegrationTestReadinessSummary(): MergeQueueIntegrationTestReadinessSummary {
    const missingRequiredEnvVars = this.mergeQueueIntegrationMissingRequiredEnvVars();
    const unsafeGateWarnings = this.mergeQueueIntegrationUnsafeGateWarnings();
    const liveTestsEnabled = flag(this.env.AICHESTRA_MERGE_QUEUE_INTEGRATION_TESTS);
    const gitProviderConfigured = stringConfigured(this.env.AICHESTRA_GIT_PROVIDER);
    const gitProviderAllowed = this.env.AICHESTRA_GIT_PROVIDER === "github";
    const remoteGitEnabled = flag(this.env.AICHESTRA_ENABLE_REMOTE_GIT);
    const githubIntegrationProfileEnabled = flag(this.env.AICHESTRA_GITHUB_INTEGRATION_TESTS) ||
      flag(this.env.AICHESTRA_GITHUB_APP_INTEGRATION_TESTS);
    const allowedRepos = csvValues(this.env.AICHESTRA_GIT_ALLOWED_REPOS);
    const requiredBranchPrefix = "aichestra/test/" as const;
    const configuredBranchPrefix = this.env.AICHESTRA_GIT_ALLOWED_BRANCH_PREFIX?.trim() ?? "";
    const branchPrefixConfigured = configuredBranchPrefix.length > 0;
    const branchPrefixMatchesRequired = configuredBranchPrefix === requiredBranchPrefix;
    const testRepo = this.env.AICHESTRA_TEST_MERGE_QUEUE_REPO?.trim() ?? "";
    const testRepoConfigured = testRepo.length > 0;
    const testRepoAllowlisted = testRepoConfigured && allowedRepos.includes(testRepo);
    const testBaseBranch = this.env.AICHESTRA_TEST_MERGE_QUEUE_BASE_BRANCH?.trim() ?? "";
    const testBaseBranchConfigured = testBaseBranch.length > 0;
    const testSourceBranches = csvValues(this.env.AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES);
    const testSourceBranchCount = testSourceBranches.length;
    const testSourceBranchesMatchPrefix = testSourceBranchCount > 0 &&
      testSourceBranches.every((branch) => branch.startsWith(requiredBranchPrefix));
    const baseBranchDistinctFromSources = testBaseBranchConfigured &&
      !testSourceBranches.includes(testBaseBranch);
    const dryRunOnly = flag(this.env.AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY);
    const remoteMergeForbidden = !this.remoteMergeEnabled();
    const remoteRebaseForbidden = !flag(this.env.AICHESTRA_ALLOW_REMOTE_REBASE);
    const remoteForcePushForbidden = !this.remoteForcePushEnabled();
    const remoteBranchDeleteForbidden = !this.remoteBranchDeletionEnabled();
    const canRunLiveTests = liveTestsEnabled &&
      missingRequiredEnvVars.length === 0 &&
      unsafeGateWarnings.length === 0;
    const profileStatus: MergeQueueIntegrationTestProfileStatus = unsafeGateWarnings.length > 0
      ? "blocked"
      : liveTestsEnabled
        ? "ready_if_configured"
        : "disabled";
    const reason = canRunLiveTests
      ? "all_merge_queue_integration_gates_configured"
      : unsafeGateWarnings.length > 0
        ? "unsafe_merge_queue_integration_gate_detected"
        : "live_merge_queue_tests_skip_until_all_gates_configured";
    return {
      generatedAt: this.now(),
      id: "merge_queue_integration_test_summary_v1",
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      profileStatus,
      liveTestsEnabled,
      canRunLiveTests,
      defaultLiveTestsSkipped: true,
      requiredGateCount: this.mergeQueueIntegrationTestProfile.requiredEnvVars.length,
      configuredGateCount: this.mergeQueueIntegrationTestProfile.requiredEnvVars.length - missingRequiredEnvVars.length,
      missingGateCount: missingRequiredEnvVars.length,
      unsafeGateCount: unsafeGateWarnings.length,
      missingRequiredEnvVars,
      unsafeGateWarnings,
      reason,
      gitProviderConfigured,
      gitProviderAllowed,
      remoteGitEnabled,
      githubIntegrationProfileEnabled,
      allowedRepoCount: allowedRepos.length,
      requiredBranchPrefix,
      branchPrefixConfigured,
      branchPrefixMatchesRequired,
      testRepoConfigured,
      testRepoAllowlisted,
      testBaseBranchConfigured,
      testSourceBranchCount,
      testSourceBranchesMatchPrefix,
      baseBranchDistinctFromSources,
      dryRunOnly,
      autoMergeForbidden: true,
      remoteMergeForbidden,
      remoteRebaseForbidden,
      remoteForcePushForbidden,
      remoteBranchDeleteForbidden,
      cleanupPolicy: "manual_mark_only",
      branchDeletionAllowed: false,
      testCaseCount: this.mergeQueueIntegrationTestCases.length,
      gatedLiveTestCaseCount: this.mergeQueueIntegrationTestCases.filter((testCase) => testCase.requiresLiveGit).length,
      activeMockTestCaseCount: this.mergeQueueIntegrationTestCases.filter((testCase) => !testCase.requiresLiveGit).length,
      noAutoMerge: true,
      noForcePush: true,
      noBranchDelete: true,
      noSecretsExposed: true,
      envValuesExposed: false,
      repoUrlsExposed: false,
      branchNamesExposed: false,
      remoteGitCallsInDefaultTests: false,
      realMergeExecuted: false,
      metadata: {
        docs: "docs/features/merge-queue-live-integration-test-profile/v1.md",
        planDocs: "docs/features/merge-queue-live-integration-test-profile/v1-plan.md",
        mergeQueuePolicyDocs: "docs/features/merge-queue-policy/v2.md",
        realGitAdapterDocs: "docs/features/real-git-adapter/v2.md",
        liveTestsSkipWhenGatesMissing: true,
        defaultTestsCallRemoteGit: false,
        defaultTestsExecuteMerges: false,
        envValuesReturned: false,
        repoUrlsReturned: false,
        branchNamesReturned: false
      }
    };
  }

  getAuthRbacProductionSummary(): AuthRbacProductionSummary {
    const currentProfileId = profileFromEnv(this.env.AICHESTRA_DEPLOYMENT_PROFILE);
    const criticalBlockers = this.authRbacReadinessChecks.filter((check) => check.status === "fail" && check.severity === "critical");
    const mockActorEnabled = true;
    return {
      generatedAt: this.now(),
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      currentProfileId,
      productionAuthEnabled: false,
      authMode: "mock",
      mockActorEnabled,
      mockActorWarning: this.authMockActorWarning(currentProfileId),
      futureIdpConfigured: false,
      externalIdpCallsEnabled: false,
      realSessionsImplemented: false,
      realJwtIssuanceImplemented: false,
      passwordLoginImplemented: false,
      serviceAccountCredentialIssuanceImplemented: false,
      requestContextPropagationStatus: "partial_mock_only",
      serviceAccountModelReady: this.serviceAccountPlans.length > 0,
      tenantScopeModelReady: false,
      policySubjectTenantMappingImplemented: false,
      mockHeaderOverrideProductionReady: false,
      providerOptionCount: this.authProviderOptions.length,
      recommendedProviderCount: this.authProviderOptions.filter((option) => option.productionRecommended).length,
      migrationPhaseCount: this.authRbacMigrationPhases.length,
      readinessCheckCount: this.authRbacReadinessChecks.length,
      criticalBlockerCount: criticalBlockers.length,
      riskCount: this.authRbacProductionRisks.length,
      tenantBoundaryPlanCount: this.tenantBoundaryPlans.length,
      serviceAccountPlanCount: this.serviceAccountPlans.length,
      permissionMatrixRoleCount: this.authRbacPermissionMatrix.length,
      noTokensExposed: true,
      cookiesExposed: false,
      sessionIdsExposed: false,
      passwordsExposed: false,
      rawIdentityAssertionsExposed: false,
      metadata: {
        docs: "docs/roadmaps/auth-rbac-production/v1.md",
        planDocs: "docs/foundations/auth-rbac/v1-plan.md",
        permissionMatrixDocs: "docs/reference/production-rbac-permission-matrix.md",
        idpOptionsDocs: "docs/roadmaps/auth-rbac-production/idp-options-v1.md",
        requestContextDocs: "docs/roadmaps/auth-rbac-production/request-context-propagation-v1.md",
        mockActorDeprecationDocs: "docs/roadmaps/auth-rbac-production/mock-actor-deprecation-v1.md",
        noLoginEndpointsImplemented: true,
        noTokenIssuanceImplemented: true,
        noExternalIdentityProviderCalls: true
      }
    };
  }

  getPolicyBundleReadinessSummary(): PolicyBundleReadinessSummary {
    const criticalBlockers = this.policyBundleReadinessChecks.filter((check) => check.status === "fail" && check.severity === "critical");
    const mappedDomainCount = this.policyDomainMappings.filter((mapping) => mapping.migrationStatus === "mapped").length;
    return {
      generatedAt: this.now(),
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      currentEngineKind: "static_typescript_current",
      policyBundleManagementEnabled: false,
      externalPolicyEngineEnabled: false,
      opaIntegrationEnabled: false,
      cedarIntegrationEnabled: false,
      signedBundleSupportEnabled: false,
      signedBundleVerificationEnabled: false,
      dynamicPolicyExecutionEnabled: false,
      remotePolicyLoadingEnabled: false,
      policyRuntimeChanged: false,
      staticPolicyRuleCount: this.staticPolicyRuleCount,
      engineOptionCount: this.policyEngineOptions.length,
      recommendedEngineCount: this.policyEngineOptions.filter((option) => option.productionRecommended).length,
      bundlePlanCount: this.policyBundlePlans.length,
      domainMappingCount: this.policyDomainMappings.length,
      mappedDomainCount,
      readinessCheckCount: this.policyBundleReadinessChecks.length,
      criticalBlockerCount: criticalBlockers.length,
      riskCount: this.policyBundleRisks.length,
      migrationPhaseCount: this.policyBundleMigrationPhases.length,
      reviewWorkflowStatus: "planned_not_implemented",
      testStrategyStatus: "planned_not_implemented",
      rolloutStatus: "planned_not_implemented",
      rollbackStatus: "planned_not_implemented",
      breakGlassStatus: "planned_not_implemented",
      noSecretsExposed: true,
      policyCodeExecuted: false,
      externalCallsEnabled: false,
      metadata: {
        docs: "docs/roadmaps/policy-bundle-opa-cedar/v0.md",
        planDocs: "docs/roadmaps/policy-bundle-opa-cedar/v0-plan.md",
        engineOptionsDocs: "docs/roadmaps/policy-bundle-opa-cedar/engine-options-v0.md",
        schemaDocs: "docs/roadmaps/policy-bundle-opa-cedar/policy-bundle-schema-v0.md",
        domainMappingDocs: "docs/reference/policy-domain-mapping.md",
        reviewWorkflowDocs: "docs/roadmaps/policy-bundle-opa-cedar/policy-review-workflow-v0.md",
        testStrategyDocs: "docs/roadmaps/policy-bundle-opa-cedar/policy-test-strategy-v0.md",
        rolloutRollbackDocs: "docs/roadmaps/policy-bundle-opa-cedar/policy-rollout-rollback-v0.md",
        breakGlassDocs: "docs/roadmaps/policy-bundle-opa-cedar/break-glass-policy-v0.md",
        opaRuntimeImplemented: false,
        cedarRuntimeImplemented: false,
        externalPolicyDecisionServiceImplemented: false,
        evalPolicyCodeImplemented: false,
        newFunctionPolicyCodeImplemented: false,
        wasmPolicyExecutionImplemented: false,
        remotePolicyBundleLoadingImplemented: false,
        policyHotReloadImplemented: false,
        productionPolicyReady: false
      }
    };
  }

  getPolicyRuntimePocSummary(): PolicyRuntimePocSummary {
    const criticalBlockers = this.policyRuntimePocReadinessChecks.filter((check) => check.status === "fail" && check.severity === "critical");
    return {
      generatedAt: this.now(),
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      currentRuntime: "StaticPolicyEngine",
      staticPolicyEngineUnchanged: true,
      recommendedPocOptionId: "policy_runtime_poc_signed_json_yaml",
      recommendedPocPath: "signed_json_yaml_shadow_first",
      runtimeEnforcementEnabled: false,
      shadowEvaluationImplemented: false,
      externalPolicyEngineEnabled: false,
      opaRuntimeImplemented: false,
      cedarRuntimeImplemented: false,
      signedJsonYamlRuntimeImplemented: false,
      customPolicyServiceImplemented: false,
      dynamicPolicyExecutionEnabled: false,
      remotePolicyLoadingEnabled: false,
      hotReloadEnabled: false,
      policyCodeExecuted: false,
      optionCount: this.policyRuntimePocOptions.length,
      domainMappingCount: this.policyRuntimePocDomainMappings.length,
      goldenCaseCount: this.policyRuntimePocGoldenCases.length,
      readinessCheckCount: this.policyRuntimePocReadinessChecks.length,
      criticalBlockerCount: criticalBlockers.length,
      riskCount: this.policyRuntimePocRisks.length,
      noSecretsExposed: true,
      envValuesExposed: false,
      metadata: {
        docs: "docs/roadmaps/policy-bundle-runtime-poc/v0.md",
        planDocs: "docs/roadmaps/policy-bundle-runtime-poc/v0-plan.md",
        runtimeOptionsDocs: "docs/roadmaps/policy-bundle-runtime-poc/runtime-options-v0.md",
        inputContractDocs: "docs/roadmaps/policy-bundle-runtime-poc/policy-io-contract-v0.md",
        domainMappingDocs: "docs/roadmaps/policy-bundle-runtime-poc/domain-poc-mapping-v0.md",
        shadowEvaluationDocs: "docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v0.md",
        goldenDecisionDocs: "docs/roadmaps/policy-bundle-runtime-poc/golden-decision-tests-v0.md",
        staticPolicyEngineSourceOfTruth: true,
        runtimeImplemented: false,
        shadowEvaluatorImplemented: false,
        opaRuntimeImplemented: false,
        cedarRuntimeImplemented: false,
        jsonYamlEvaluatorImplemented: false,
        customPolicyServiceImplemented: false,
        externalPolicyServiceCallsEnabled: false
      }
    };
  }

  getPolicyShadowEvaluationSummary(): PolicyShadowEvaluationSummary {
    const warningCount = this.policyShadowReadinessChecks.filter((check) => check.status === "warning").length;
    const futureCount = this.policyShadowReadinessChecks.filter((check) => check.status === "future").length;
    const failCount = this.policyShadowReadinessChecks.filter((check) => check.status === "fail").length;
    const criticalMismatchKinds = this.policyShadowMismatches.filter((mismatch) => mismatch.severity === "critical");
    return {
      generatedAt: this.now(),
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      sourceOfTruth: "StaticPolicyEngine",
      enforcementMode: "shadow_only",
      enforcementChanged: false,
      staticPolicyEngineAuthoritative: true,
      shadowEvaluatorSkeletonImplemented: true,
      shadowEvaluatorEnabled: false,
      mockComparisonSupported: true,
      shadowEvaluatorImplemented: false,
      candidateRuntimeImplemented: false,
      candidateRuntimeExecuted: false,
      candidateBundleValidated: false,
      dynamicPolicyExecutionEnabled: false,
      externalPolicyServiceCallsEnabled: false,
      remotePolicyBundleLoadingEnabled: false,
      signedBundleVerificationRuntimeEnabled: false,
      opaRuntimeEnabled: false,
      cedarRuntimeEnabled: false,
      policyCodeExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      planStatus: this.policyShadowEvaluationPlan.status,
      candidateRuntimeKindCount: this.policyShadowEvaluationPlan.candidateRuntimeKinds.length,
      domainCount: this.policyShadowEvaluationPlan.domains.length,
      rolloutStageCount: this.policyShadowEvaluationPlan.rolloutStages.length,
      comparisonRuleCount: this.policyShadowComparisonRules.length,
      requiredComparisonRuleCount: this.policyShadowComparisonRules.filter((rule) => rule.required).length,
      mismatchTaxonomyCount: this.policyShadowMismatches.length,
      criticalMismatchKindCount: this.policyShadowMismatches.filter((mismatch) => mismatch.severity === "critical").length,
      readinessCheckCount: this.policyShadowReadinessChecks.length,
      readinessFutureCount: futureCount,
      readinessWarningCount: warningCount,
      readinessFailCount: failCount,
      reportCount: this.policyShadowEvaluationReports.length,
      goldenCaseSource: "Policy Runtime PoC Golden Test Harness v1",
      recommendedNextTask: "Policy Runtime Shadow Evaluator Implementation Planning v1, or Signed JSON/YAML Bundle Schema v1",
      currentRolloutStage: "docs_planning_golden_harness_only",
      candidateRuntimeInterfaceImplemented: false,
      staticPolicyEngineUnchanged: true,
      goldenHarnessSourceOfTruth: "StaticPolicyEngine",
      noDynamicPolicyExecution: true,
      metadata: {
        docs: "docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v1.md",
        planDocs: "docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v1-plan.md",
        candidateRuntimeInterfaceDocs: "docs/roadmaps/policy-bundle-runtime-poc/candidate-runtime-interface-v1.md",
        evaluatorSkeletonDocs: "docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluator-skeleton-v1.md",
        mismatchTaxonomyDocs: "docs/roadmaps/policy-bundle-runtime-poc/shadow-mismatch-taxonomy-v1.md",
        reportingDocs: "docs/roadmaps/policy-bundle-runtime-poc/shadow-reporting-v1.md",
        rolloutRollbackDocs: "docs/roadmaps/policy-bundle-runtime-poc/shadow-rollout-rollback-v1.md",
        goldenHarnessDocs: "docs/roadmaps/policy-bundle-runtime-poc/golden-test-harness-v1.md",
        staticPolicyEngineAuthoritative: true,
        noEnforcementChange: true,
        noDynamicPolicyExecution: true,
        noExternalPolicyServiceCalls: true,
        noSecretsOrEnvValues: true,
        shadowEvaluatorSkeletonImplemented: true,
        shadowEvaluatorEnabled: false,
        mockComparisonSupported: true,
        staticPolicyEngineSourceOfTruth: true,
        shadowEvaluatorImplemented: false,
        candidateRuntimeImplemented: false,
        externalPolicyServiceCallsEnabled: false
      }
    };
  }

  getSecretBackendMigrationSummary(): SecretBackendMigrationSummary {
    const currentProfileId = profileFromEnv(this.env.AICHESTRA_DEPLOYMENT_PROFILE);
    const criticalBlockers = this.secretBackendReadinessChecks.filter((check) => check.status === "fail" && check.severity === "critical");
    const envFallbackAllowed = currentProfileId === "local" || currentProfileId === "integration";
    return {
      generatedAt: this.now(),
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      currentProfileId,
      realSecretBackendConfigured: false,
      externalCallsEnabled: false,
      credentialResolutionAttempted: false,
      rotationJobsImplemented: false,
      productionCredentialIssuanceImplemented: false,
      credentialCachesRead: false,
      envFallbackAllowedForCurrentProfile: envFallbackAllowed,
      envFallbackWarning: this.secretBackendEnvFallbackWarning(currentProfileId),
      envSecretProviderEnabled: flag(this.env.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER),
      allowedSecretEnvKeyCount: csvCount(this.env.AICHESTRA_ALLOWED_SECRET_ENV_KEYS),
      legacyEnvFallbackProductionReady: false,
      backendOptionCount: this.secretBackendOptions.length,
      recommendedBackendCount: this.secretBackendOptions.filter((option) => option.productionRecommended).length,
      migrationPhaseCount: this.secretBackendMigrationPhases.length,
      readinessCheckCount: this.secretBackendReadinessChecks.length,
      criticalBlockerCount: criticalBlockers.length,
      riskCount: this.secretBackendRisks.length,
      rotationPlanCount: this.secretRotationPlans.length,
      leasePolicyCount: this.secretLeasePolicies.length,
      noSecretsExposed: true,
      envValuesExposed: false,
      metadata: {
        docs: "docs/roadmaps/secret-backend-migration/v0.md",
        backendOptionsDocs: "docs/roadmaps/secret-backend-migration/backend-options-v0.md",
        envFallbackDeprecationDocs: "docs/roadmaps/secret-backend-migration/env-fallback-deprecation-v0.md",
        vaultSecretBackendV1Implemented: true,
        realVaultIntegrationImplemented: true,
        realCloudSecretManagerIntegrationImplemented: false,
        actualSecretMigrationImplemented: false,
        actualSecretRotationImplemented: false,
        byokImplemented: false,
        oauthImplemented: false,
        wifIamImplemented: false,
        envValuesReturned: false,
        secretValuesReturned: false
      }
    };
  }

  getSecretBackendOptionDecisionSummary(): SecretBackendOptionDecisionSummary {
    const criticalRisks = this.secretBackendDecisionRisks.filter((risk) => risk.status === "open" && risk.severity === "critical");
    // This summary is deterministic metadata only. It may reflect that a
    // gated provider boundary exists, but it must never inspect env values,
    // call Vault/cloud secret managers, or imply production readiness.
    return {
      generatedAt: this.now(),
      status: "v0_implemented",
      planningOnly: true,
      decisionStatus: this.secretBackendOptionDecision.decisionStatus,
      recommendedBackend: this.secretBackendOptionDecision.recommendedBackend,
      secondChoiceBackend: this.secretBackendOptionDecision.secondChoiceBackend,
      implementationReady: this.secretBackendImplementationScopes.some((scope) => scope.backendKind === this.secretBackendOptionDecision.recommendedBackend && (scope.status === "ready_for_implementation" || scope.status === "v1_implemented")),
      productionSecretBackendImplemented: false,
      envFallbackProductionAllowed: false,
      externalCallsEnabled: false,
      secretReadsAttempted: false,
      secretRotationsAttempted: false,
      secretMigrationsAttempted: false,
      productionCredentialsIssued: false,
      credentialCachesRead: false,
      criterionCount: this.secretBackendDecisionCriteria.length,
      scoreCount: this.secretBackendDecisionScores.length,
      implementationScopeCount: this.secretBackendImplementationScopes.length,
      riskCount: this.secretBackendDecisionRisks.length,
      criticalRiskCount: criticalRisks.length,
      providerMappingCount: this.secretBackendProviderMappings.length,
      noSecretsExposed: true,
      envValuesExposed: false,
      metadata: {
        docs: "docs/roadmaps/production-secret-backend-option-decision/recommendation-v0.md",
        criteriaDocs: "docs/roadmaps/production-secret-backend-option-decision/decision-criteria-v0.md",
        backendEvaluationDocs: "docs/roadmaps/production-secret-backend-option-decision/backend-evaluation-v0.md",
        implementationScopeDocs: "docs/roadmaps/production-secret-backend-option-decision/implementation-scope-v1.md",
        providerMappingDocs: "docs/roadmaps/production-secret-backend-option-decision/secretref-provider-mapping-v0.md",
        selectedBackendImplemented: true,
        vaultSecretBackendV1Implemented: true,
        realVaultIntegrationImplemented: true,
        awsSecretsManagerImplemented: false,
        gcpSecretManagerImplemented: false,
        azureKeyVaultImplemented: false,
        customSecretBackendImplemented: false,
        envFallbackProductionDefault: false,
        backendCallsExecuted: false,
        secretValuesReturned: false,
        envValuesReturned: false
      }
    };
  }

  getDatabaseOperationsSummary(): DatabaseOperationsSummary {
    const criticalBlockers = this.databaseReadinessChecks.filter((check) => check.status === "fail" && check.severity === "critical");
    const migrations = this.getDatabaseMigrationStatus();
    return {
      generatedAt: this.now(),
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      storageProviderKind: this.databaseStorageProviderKind(),
      databaseUrlConfigured: this.databaseUrlConfigured(),
      testDatabaseUrlConfigured: Boolean(this.env.AICHESTRA_TEST_DATABASE_URL),
      migrationRunnerAvailable: this.isMigrationRunnerAvailable(),
      migrationFileCount: migrations.length,
      schemaInventoryCount: this.databaseSchemaInventory.length,
      indexReviewItemCount: this.databaseIndexReview.length,
      readinessCheckCount: this.databaseReadinessChecks.length,
      criticalBlockerCount: criticalBlockers.length,
      riskCount: this.databaseOperationRisks.length,
      poolingStatus: "planned_not_enabled",
      backupStatus: "planned_not_configured",
      restoreStatus: "planned_not_tested",
      retentionDeletionJobsEnabled: false,
      productionDbConnectionAttempted: false,
      noSecretsExposed: true,
      databaseUrlExposed: false,
      metadata: {
        migrationsDir: path.relative(this.repoRoot, this.migrationsDir).replaceAll("\\", "/"),
        migrationRunnerPath: path.relative(this.repoRoot, this.migrationRunnerPath).replaceAll("\\", "/"),
        automaticMigrationsEnabled: false,
        backupJobsImplemented: false,
        restoreJobsImplemented: false,
        poolingImplemented: false,
        retentionDeletionImplemented: false,
        destructiveOperationsEnabled: false,
        docs: "docs/roadmaps/persistent-db-production-operations/v1.md"
      }
    };
  }

  classifyGitHubWebhookDelivery(input: GitHubWebhookDeliveryClassificationInput): GitHubWebhookDeliveryRecord {
    const previousDeliveries = input.previousDeliveries ?? this.githubWebhookDeliveryRecords;
    const previous = previousDeliveries.find((delivery) => delivery.deliveryId === input.deliveryId);
    const receivedAt = input.now ?? this.now();
    const replayStatus = previous
      ? previous.payloadHash === input.payloadHash
        ? "duplicate"
        : "replay_rejected"
      : "first_seen";
    const processingStatus = replayStatus === "first_seen" ? "pending" : replayStatus === "duplicate" ? "ignored" : "failed";
    return {
      id: `github_delivery_classified_${safeIdPart(input.deliveryId)}_${replayStatus}`,
      deliveryId: input.deliveryId,
      eventType: input.eventType,
      repoRef: input.repoRef,
      action: input.action,
      receivedAt,
      signatureVerified: input.signatureVerified ?? false,
      replayStatus,
      processingStatus,
      payloadHash: input.payloadHash,
      attemptCount: previous ? previous.attemptCount + 1 : 1,
      lastAttemptAt: receivedAt,
      metadata: {
        planningOnly: true,
        readModelOnly: true,
        externalCallsExecuted: false,
        rawPayloadStored: false,
        duplicateOf: replayStatus === "duplicate" ? previous?.id : undefined,
        rejectedBecause: replayStatus === "replay_rejected" ? "same_delivery_id_different_payload_hash" : undefined,
        ...(input.metadata ?? {})
      }
    };
  }

  getGitHubWebhookHardeningSummary(): GitHubWebhookHardeningSummary {
    const readinessBlockers = this.githubAppReadinessChecks.filter((check) => check.status === "fail");
    const supportedNowEventCount = this.githubWebhookEventAllowlist.filter((event) => event.supportStatus === "supported_now").length;
    const plannedEventCount = this.githubWebhookEventAllowlist.filter((event) => event.supportStatus === "planned").length;
    const deniedEventCount = this.githubWebhookEventAllowlist.filter((event) => event.supportStatus === "denied").length;
    return {
      generatedAt: this.now(),
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      githubAppLiveEnabled: false,
      productionWebhooksEnabled: false,
      externalCallsEnabled: false,
      appDescriptorCount: this.githubAppDescriptors.length,
      installationCount: this.githubAppInstallations.length,
      repositoryGrantCount: this.githubAppRepositoryGrants.length,
      permissionCount: this.githubAppPermissionMatrix.length,
      webhookEventCount: this.githubWebhookEventAllowlist.length,
      supportedNowEventCount,
      plannedEventCount,
      deniedEventCount,
      replayProtectionStatus: "planned_not_production_ready",
      deadLetterStatus: "planned_not_implemented",
      credentialStatus: "github_app_private_key_future_secretref",
      endpointStatus: "planned_not_deployed",
      blockerCount: readinessBlockers.length,
      riskCount: this.githubAppProductionRisks.length,
      noSecretsExposed: true,
      metadata: {
        noPrivateKeysStored: true,
        noWebhookSecretsStored: true,
        noInstallationTokenExchange: true,
        rawWebhookPayloadsStored: false,
        automaticMergeEnabled: false,
        forcePushEnabled: false,
        branchDeletionEnabled: false,
        docs: "docs/roadmaps/github-app-production-webhook-hardening/v0.md"
      }
    };
  }

  getEnvironment(): DeploymentReadinessEnvironment {
    const env = this.env;
    return {
      requestedProfileId: profileFromEnv(env.AICHESTRA_DEPLOYMENT_PROFILE),
      storageProvider: env.AICHESTRA_STORAGE_PROVIDER ?? "memory",
      databaseConfigured: Boolean(env.AICHESTRA_DATABASE_URL),
      remoteGitEnabled: flag(env.AICHESTRA_ENABLE_REMOTE_GIT),
      githubProviderSelected: env.AICHESTRA_GIT_PROVIDER === "github",
      githubTokenSecretRefConfigured: Boolean(env.AICHESTRA_GITHUB_TOKEN_SECRET_REF),
      githubLegacyTokenConfigured: Boolean(env.AICHESTRA_GITHUB_TOKEN),
      githubWebhooksEnabled: flag(env.AICHESTRA_ENABLE_GITHUB_WEBHOOKS),
      githubWebhookSecretRefConfigured: Boolean(env.AICHESTRA_GITHUB_WEBHOOK_SECRET_REF),
      githubWebhookLegacySecretConfigured: Boolean(env.AICHESTRA_GITHUB_WEBHOOK_SECRET),
      remoteLlmEnabled: flag(env.AICHESTRA_ENABLE_REMOTE_LLM),
      remoteLlmCompletionEnabled: flag(env.AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION),
      llmProvider: env.AICHESTRA_LLM_PROVIDER ?? "mock",
      llmSecretRefConfigured: Boolean(env.AICHESTRA_LLM_API_KEY_SECRET_REF),
      llmLegacyApiKeyConfigured: Boolean(env.AICHESTRA_LLM_API_KEY),
      llmBaseUrlConfigured: Boolean(env.AICHESTRA_LLM_BASE_URL),
      llmRoutingMode: env.AICHESTRA_LLM_ROUTING_MODE ?? "mock_only",
      llmFallbackEnabled: flag(env.AICHESTRA_ENABLE_LLM_FALLBACK),
      envSecretProviderEnabled: flag(env.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER),
      allowedSecretEnvKeyCount: csvCount(env.AICHESTRA_ALLOWED_SECRET_ENV_KEYS),
      localAgentRunnerEnabled: flag(env.AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER),
      localCommandExecutionEnabled: flag(env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION),
      dashboardDataSource: env.AICHESTRA_DASHBOARD_DATA_SOURCE ?? "api",
      mcpRealTransportEnabled: false,
      productionAuthEnabled: false,
      realSecretBackendEnabled: false,
      policyBundleRuntimeEnabled: false,
      observabilityBackendConfigured: false,
      auditExportConfigured: false,
      secretsExposed: false
    };
  }

  getSummary(): DeploymentReadinessSummary {
    const environment = this.getEnvironment();
    const productionChecks = this.listChecks({ profileId: "production" });
    const criticalBlockers = productionChecks.filter((check) => check.status === "fail" && check.severity === "critical");
    const highRiskAreas = this.risks.filter((risk) => risk.status === "open" && (risk.severity === "high" || risk.severity === "critical"));
    const environmentWarnings = this.environmentWarnings(environment);
    const productionFails = productionChecks.filter((check) => check.status === "fail");
    return {
      generatedAt: this.now(),
      currentProfileId: environment.requestedProfileId,
      productionReadinessStatus: criticalBlockers.length > 0 ? "blocked" : productionFails.length > 0 ? "not_ready" : "planning_only",
      productionReady: false,
      profileCount: this.profiles.length,
      checkCount: this.checks.length,
      riskCount: this.risks.length,
      criticalBlockerCount: criticalBlockers.length,
      highRiskOpenCount: highRiskAreas.length,
      checksByStatus: countByStatus(this.checks),
      risksBySeverity: countBySeverity(this.risks),
      criticalBlockers: clone(criticalBlockers),
      highRiskAreas: clone(highRiskAreas),
      missingProductionRequirements: productionFails.map((check) => check.name),
      environmentWarnings,
      environment,
      noSecretsExposed: true,
      metadata: {
        planningOnly: true,
        externalChecksExecuted: false,
        productionDeploymentImplemented: false
      }
    };
  }

  private getStagingDryRunIntegrationProfiles(): StagingDeploymentDryRunIntegrationProfileStatus[] {
    const githubIntegration = this.getGitHubAppIntegrationTestReadinessSummary();
    const llmIntegration = this.getLLMIntegrationTestReadinessSummary();
    const githubRequired = Boolean(this.stagingDryRunOptions.requireLiveGitHubValidation);
    const llmRequired = Boolean(this.stagingDryRunOptions.requireLiveLLMValidation);
    const classify = (
      id: string,
      name: string,
      requiredForStaging: boolean,
      canRunLiveTests: boolean,
      liveTestsEnabled: boolean,
      unsafeGateCount: number,
      missingGateCount: number,
      docs: string
    ): StagingDeploymentDryRunIntegrationProfileStatus => {
      const status: StagingDeploymentDryRunIntegrationStatus = unsafeGateCount > 0
        ? "blocked"
        : canRunLiveTests
          ? "ready"
          : requiredForStaging
            ? "gated"
            : liveTestsEnabled || missingGateCount > 0
              ? "skipped"
              : "skipped";
      return {
        id,
        name,
        status,
        requiredForStaging,
        skippedByDefault: true,
        summary: status === "ready"
          ? `${name} can run if invoked separately with explicit gates.`
          : status === "blocked"
            ? `${name} has unsafe gate metadata and blocks dry-run trust.`
            : status === "gated"
              ? `${name} is required for this dry-run but required gates are missing.`
              : `${name} is skipped by default and is not a failure unless required.`,
        remediation: requiredForStaging
          ? "Configure every live-test gate or make this integration profile optional."
          : "Keep skipped until an explicit gated live validation task is requested.",
        metadata: {
          docs,
          canRunLiveTests,
          liveTestsEnabled,
          unsafeGateCount,
          missingGateCount,
          integrationTestsExecutedByDryRun: false,
          externalCallsExecutedByDryRun: false
        }
      };
    };
    return clone([
      classify(
        "github_app_integration_test_profile_v1",
        "GitHub App integration-test profile v1",
        githubRequired,
        githubIntegration.canRunLiveTests,
        githubIntegration.liveTestsEnabled,
        githubIntegration.unsafeGateCount,
        githubIntegration.missingGateCount,
        "docs/roadmaps/github-app-integration-test-profile/v1.md"
      ),
      classify(
        "llm_gateway_integration_test_profile_v1",
        "LLM Gateway integration-test profile v1",
        llmRequired,
        llmIntegration.canRunLiveTests,
        llmIntegration.liveTestsEnabled,
        llmIntegration.unsafeGateCount,
        llmIntegration.missingGateCount,
        "docs/roadmaps/llm-gateway-integration-test-profile/v1.md"
      )
    ]);
  }

  private getStagingDeploymentExecutionSignoffCollection(): StagingDeploymentExecutionSignoffCollection {
    const requiredSignoffs = this.stagingDeploymentExecutionPlan.requiredSignoffs;
    const humanSignoffs = this.stagingHumanSignoffs;
    const hasRealEvidenceInput = Object.keys(humanSignoffs).length > 0;
    const pendingApprovals: StagingReleaseCandidateSignoffRole[] = [];
    const approvedApprovals: StagingReleaseCandidateSignoffRole[] = [];
    const conditionalApprovals: StagingReleaseCandidateSignoffRole[] = [];
    const rejectedApprovals: StagingReleaseCandidateSignoffRole[] = [];
    const invalidEvidenceRoles: StagingReleaseCandidateSignoffRole[] = [];

    for (const role of requiredSignoffs) {
      const evidence = humanSignoffs[role];
      if (hasRealEvidenceInput) {
        if (evidence === undefined || evidence.role !== role || evidence.required !== true || !hasExplicitHumanDecisionEvidence(evidence)) {
          pendingApprovals.push(role);
          if (evidence !== undefined && evidence.status !== "pending") invalidEvidenceRoles.push(role);
          continue;
        }
        if (evidence.status === "approved") {
          approvedApprovals.push(role);
          continue;
        }
        if (evidence.status === "rejected") {
          rejectedApprovals.push(role);
          continue;
        }
        if (evidence.status === "conditionally_approved") {
          conditionalApprovals.push(role);
          pendingApprovals.push(role);
          continue;
        }
        pendingApprovals.push(role);
        continue;
      }

      if ((this.stagingDeploymentExecutionOptions.signoffStatuses?.[role] ?? "pending") === "pending") {
        pendingApprovals.push(role);
      }
    }

    const signoffStatus: StagingHumanSignoffStatus = rejectedApprovals.length > 0
      ? "rejected"
      : hasRealEvidenceInput && approvedApprovals.length === requiredSignoffs.length
        ? "approved"
        : conditionalApprovals.length > 0
          ? "conditionally_approved"
          : "pending";

    return {
      requiredSignoffCount: requiredSignoffs.length,
      pendingApprovals,
      approvedApprovals,
      conditionalApprovals,
      rejectedApprovals,
      invalidEvidenceRoles,
      realHumanEvidenceProvidedCount: Object.values(humanSignoffs).filter((evidence) => evidence !== undefined && hasExplicitHumanDecisionEvidence(evidence)).length,
      approvedSignoffCount: hasRealEvidenceInput ? approvedApprovals.length : 0,
      conditionalSignoffCount: hasRealEvidenceInput ? conditionalApprovals.length : 0,
      rejectedSignoffCount: hasRealEvidenceInput ? rejectedApprovals.length : 0,
      missingRequiredSignoffCount: pendingApprovals.length,
      signoffStatus: hasRealEvidenceInput ? signoffStatus : "pending",
      collectionMode: hasRealEvidenceInput ? "real_evidence" : "mock_planning",
      actualDeploymentBlocked: true
    };
  }

  private stagingDryRunRecommendedNextActions(
    blockers: StagingDeploymentDryRunBlocker[],
    skippedProfiles: StagingDeploymentDryRunIntegrationProfileStatus[]
  ): string[] {
    const actions = [
      "Keep the dry-run read-only and do not mark staging as deployed.",
      "Resolve critical staging dry-run blockers before attempting staging deployment validation."
    ];
    if (blockers.some((blocker) => blocker.id === "blocker_missing_secret_backend")) {
      actions.push("Choose a real secret backend or document a controlled non-production fallback decision.");
    }
    if (blockers.some((blocker) => blocker.category === "storage")) {
      actions.push("Configure Postgres readiness, migration ordering, backup, and restore rehearsal before staging validation.");
    }
    if (blockers.some((blocker) => blocker.category === "observability")) {
      actions.push("Add durable observability and sanitized audit evidence for staging operations.");
    }
    if (skippedProfiles.length > 0) {
      actions.push("Leave GitHub App and LLM live integration profiles skipped until a separate gated validation task is requested.");
    }
    actions.push("Run local validation commands outside the dry-run report before publishing a release candidate checklist.");
    return [...new Set(actions)];
  }

  private stagingReleaseCandidateSkippedTests(gates: StagingReleaseCandidateGate[]): string[] {
    return gates
      .filter((gate) => gate.status === "skipped")
      .map((gate) => gate.id);
  }

  private stagingReleaseCandidateRecommendedNextActions(
    gates: StagingReleaseCandidateGate[],
    blockers: StagingReleaseCandidateBlocker[],
    signoffs: StagingReleaseCandidateSignoff[],
    releaseNotes: StagingReleaseNoteRequirement[],
    rollback: StagingRollbackChecklistItem[],
    skippedTests: string[]
  ): string[] {
    const actions = [
      "Do not create a release, Git tag, GitHub release, or deployment from this checklist.",
      "Run required local validation commands and record their status before staging RC designation."
    ];
    if (blockers.some((blocker) => blocker.severity === "critical" && blocker.status === "open")) {
      actions.push("Resolve critical RC blockers before calling the branch a staging release candidate.");
    }
    if (gates.some((gate) => gate.required && gate.status === "not_checked")) {
      actions.push("Check all required validation gates: pnpm lint, pnpm typecheck, pnpm test, pnpm build, git diff --check, and safety scans.");
    }
    if (signoffs.some((signoff) => signoff.required && signoff.status === "pending")) {
      actions.push("Record required signoffs or explicit waivers before RC designation.");
    }
    if (releaseNotes.some((note) => note.required && note.status === "missing")) {
      actions.push("Complete the staging RC release notes template.");
    }
    if (rollback.some((item) => item.required && item.status === "missing")) {
      actions.push("Complete required rollback checklist items.");
    }
    if (skippedTests.length > 0) {
      actions.push("Document skipped optional integration tests and why their gates were not configured.");
    }
    actions.push("Keep production auth, real secret backend, external observability, staging deployment, and active release workflows as known limitations.");
    return [...new Set(actions)];
  }

  private calculateStagingReleaseCandidateOverallStatus(
    gates: StagingReleaseCandidateGate[],
    blockers: StagingReleaseCandidateBlocker[],
    signoffs: StagingReleaseCandidateSignoff[],
    releaseNotes: StagingReleaseNoteRequirement[],
    rollback: StagingRollbackChecklistItem[]
  ): StagingReleaseCandidateOverallStatus {
    // RC evaluation is metadata-only. Critical open blockers such as failed
    // validation, release/deployment side effects, destructive Git, real MCP,
    // vendor CLI, secret/env exposure, or readiness overclaims block outright.
    // Production-only limitations stay warnings when they are documented.
    if (blockers.some((blocker) => blocker.status === "open" && blocker.severity === "critical")) return "blocked";
    if (
      gates.some((gate) => gate.required && gate.status === "fail") ||
      gates.some((gate) => gate.required && gate.status === "not_checked") ||
      blockers.some((blocker) => blocker.status === "open" && blocker.blockingLevel === "blocks_release_candidate") ||
      signoffs.some((signoff) => signoff.required && signoff.status === "pending") ||
      releaseNotes.some((note) => note.required && note.status === "missing") ||
      rollback.some((item) => item.required && item.status === "missing")
    ) {
      return "not_ready";
    }
    if (
      gates.some((gate) => gate.status === "warning" || gate.status === "skipped") ||
      blockers.some((blocker) => blocker.status === "open" || blocker.status === "accepted") ||
      signoffs.some((signoff) => signoff.status === "waived") ||
      releaseNotes.some((note) => note.status === "not_applicable") ||
      rollback.some((item) => item.status === "not_applicable")
    ) {
      return "pass_with_warnings";
    }
    return "pass";
  }

  private calculateStagingDryRunOverallStatus(
    sources: StagingDeploymentDryRunSource[],
    checks: StagingDeploymentDryRunCheck[],
    blockers: StagingDeploymentDryRunBlocker[]
  ): StagingDeploymentDryRunOverallStatus {
    // Aggregation rules are deliberately conservative: critical required-source
    // failures and any critical open blocker make the dry-run blocked; high
    // staging blockers keep deployment validation not_ready; optional skipped
    // live profiles stay warnings unless this dry-run explicitly requires them.
    const requiredSourceKinds = new Set(this.stagingDryRunProfile.requiredReadinessSources);
    const criticalFailedRequiredSource = sources.some((source) =>
      requiredSourceKinds.has(source.sourceKind) &&
      source.status === "fail" &&
      source.severity === "critical"
    );
    const criticalOpenBlocker = blockers.some((blocker) => blocker.status === "open" && blocker.severity === "critical");
    const dryRunBlocker = blockers.some((blocker) => blocker.status === "open" && blocker.blockingLevel === "blocks_staging_dry_run");
    if (criticalFailedRequiredSource || criticalOpenBlocker || dryRunBlocker) return "blocked";
    if (
      sources.some((source) => requiredSourceKinds.has(source.sourceKind) && source.status === "fail") ||
      checks.some((check) => check.requiredForStaging && check.status === "fail") ||
      blockers.some((blocker) => blocker.status === "open" && blocker.blockingLevel === "blocks_staging_deployment")
    ) {
      return "not_ready";
    }
    if (
      sources.some((source) => source.status === "warning" || source.status === "skipped" || source.status === "future") ||
      checks.some((check) => check.status === "warning" || check.status === "skipped" || check.status === "not_checked") ||
      blockers.some((blocker) => blocker.status === "open")
    ) {
      return "pass_with_warnings";
    }
    return "pass";
  }

  private remoteMergeEnabled(): boolean {
    return flag(this.env.AICHESTRA_ALLOW_REMOTE_MERGE);
  }

  private remoteForcePushEnabled(): boolean {
    return flag(this.env.AICHESTRA_ALLOW_REMOTE_FORCE_PUSH);
  }

  private remoteBranchDeletionEnabled(): boolean {
    return flag(this.env.AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE);
  }

  private realMcpTransportEnabled(): boolean {
    return flag(this.env.AICHESTRA_ENABLE_MCP_REAL_TRANSPORT);
  }

  private vendorCliExecutionEnabled(): boolean {
    return flag(this.env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION) ||
      flag(this.env.AICHESTRA_ENABLE_VENDOR_CLI_EXECUTION) ||
      flag(this.env.AICHESTRA_ENABLE_CODEX_CLI) ||
      flag(this.env.AICHESTRA_ENABLE_CLAUDE_CODE) ||
      flag(this.env.AICHESTRA_ENABLE_AIDER);
  }

  private environmentWarnings(environment: DeploymentReadinessEnvironment): string[] {
    const warnings = [
      "mock_actor_warning",
      "missing_production_auth_warning",
      "missing_real_secret_backend_warning",
      "static_policy_bundle_warning",
      "observability_backend_missing_warning"
    ];
    if (environment.storageProvider !== "postgres") warnings.push("in_memory_repository_warning");
    if (environment.envSecretProviderEnabled) warnings.push("env_secret_provider_not_production_warning");
    if (environment.githubLegacyTokenConfigured || environment.githubWebhookLegacySecretConfigured || environment.llmLegacyApiKeyConfigured) {
      warnings.push("legacy_env_credential_present_redacted_warning");
    }
    if (environment.remoteGitEnabled) warnings.push("remote_git_enabled_requires_integration_or_stronger_profile_warning");
    if (environment.remoteLlmEnabled || environment.remoteLlmCompletionEnabled) warnings.push("remote_llm_enabled_requires_budget_policy_secretref_and_allowlist_warning");
    if (environment.localCommandExecutionEnabled) warnings.push("local_command_execution_not_production_sandboxed_warning");
    return warnings;
  }

  private isMigrationRunnerAvailable(): boolean {
    return existsSync(this.migrationRunnerPath);
  }

  private databaseUrlConfigured(): boolean {
    return Boolean(this.env.AICHESTRA_DATABASE_URL || this.env.DATABASE_URL);
  }

  private databaseStorageProviderKind(): DatabaseStorageProviderKind {
    if (this.env.AICHESTRA_STORAGE_PROVIDER === "postgres") return "postgres";
    if (this.env.AICHESTRA_STORAGE_PROVIDER === undefined || this.env.AICHESTRA_STORAGE_PROVIDER === "" || this.env.AICHESTRA_STORAGE_PROVIDER === "memory" || this.env.AICHESTRA_STORAGE_PROVIDER === "in_memory") {
      return "in_memory";
    }
    return "unknown";
  }

  private secretBackendEnvFallbackWarning(profileId: DeploymentProfileName): string {
    if (profileId === "production") return "env_fallback_blocked_for_production_profile";
    if (profileId === "staging") return "env_fallback_blocked_for_staging_profile";
    if (profileId === "integration") return "env_fallback_allowed_with_warning_for_integration_profile";
    return "env_fallback_allowed_for_local_only";
  }

  private authMockActorWarning(profileId: DeploymentProfileName): string {
    if (profileId === "production") return "mock_actor_blocked_for_production_profile";
    if (profileId === "staging") return "mock_actor_blocked_for_staging_profile";
    if (profileId === "integration") return "mock_actor_allowed_with_warning_for_integration_profile";
    return "mock_actor_allowed_for_local_only";
  }

  private githubAppIntegrationMissingRequiredEnvVars(): string[] {
    const expectedValues: Record<string, string> = {
      AICHESTRA_GITHUB_APP_INTEGRATION_TESTS: "true",
      AICHESTRA_ENABLE_REMOTE_GIT: "true",
      AICHESTRA_GITHUB_AUTH_MODE: "github_app",
      AICHESTRA_ENABLE_GITHUB_APP: "true",
      AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX: "ai/",
      AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE: "true",
      AICHESTRA_ALLOW_REMOTE_PR_CREATE: "true",
      AICHESTRA_ALLOW_REMOTE_MERGE: "false"
    };
    return this.githubAppIntegrationTestProfile.requiredEnvVars.filter((name) => {
      const expectedValue = expectedValues[name];
      const actualValue = this.env[name];
      if (expectedValue !== undefined) return actualValue !== expectedValue;
      return typeof actualValue !== "string" || actualValue.trim().length === 0;
    });
  }

  private githubAppIntegrationUnsafeGateWarnings(): string[] {
    const warnings: string[] = [];
    if (flag(this.env.AICHESTRA_ALLOW_REMOTE_MERGE)) warnings.push("remote_merge_enabled");
    if (flag(this.env.AICHESTRA_ALLOW_REMOTE_FORCE_PUSH)) warnings.push("force_push_enabled");
    if (flag(this.env.AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE)) warnings.push("branch_delete_enabled");
    if (flag(this.env.AICHESTRA_GITHUB_WEBHOOK_ACCEPT_UNVERIFIED)) warnings.push("webhook_accept_unverified_enabled");
    if (typeof this.env.AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX === "string" &&
      this.env.AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX.trim().length > 0 &&
      this.env.AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX !== "ai/") {
      warnings.push("branch_prefix_mismatch");
    }
    if (typeof this.env.GITHUB_APP_PRIVATE_KEY === "string" && this.env.GITHUB_APP_PRIVATE_KEY.trim().length > 0) {
      warnings.push("raw_github_app_private_key_env_unsupported");
    }
    if (typeof this.env.AICHESTRA_GITHUB_APP_PRIVATE_KEY === "string" && this.env.AICHESTRA_GITHUB_APP_PRIVATE_KEY.trim().length > 0) {
      warnings.push("raw_aichestra_github_app_private_key_env_unsupported");
    }
    return warnings;
  }

  private llmIntegrationMissingRequiredEnvVars(): string[] {
    const expectedValues: Record<string, string> = {
      AICHESTRA_LLM_INTEGRATION_TESTS: "true",
      AICHESTRA_LLM_PROVIDER: "openai_compatible",
      AICHESTRA_ENABLE_REMOTE_LLM: "true",
      AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION: "true",
      AICHESTRA_ENABLE_LLM_FALLBACK: "false",
      AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS: "0"
    };
    return this.llmIntegrationTestProfile.requiredEnvVars.filter((name) => {
      if (name === "AICHESTRA_LLM_API_KEY_SECRET_REF_or_AICHESTRA_LLM_API_KEY") {
        return !this.env.AICHESTRA_LLM_API_KEY_SECRET_REF && !this.env.AICHESTRA_LLM_API_KEY;
      }
      if (name === "AICHESTRA_LLM_ROUTING_MODE") {
        return !this.llmIntegrationRoutingModeAllowed();
      }
      if (name === "AICHESTRA_LLM_TEST_BUDGET_USD") {
        return positiveNumber(this.env.AICHESTRA_LLM_TEST_BUDGET_USD) === undefined;
      }
      const expectedValue = expectedValues[name];
      const actualValue = this.env[name];
      if (expectedValue !== undefined) return actualValue !== expectedValue;
      return typeof actualValue !== "string" || actualValue.trim().length === 0;
    });
  }

  private llmIntegrationUnsafeGateWarnings(): string[] {
    const warnings: string[] = [];
    const allowedModels = csvValues(this.env.AICHESTRA_LLM_ALLOWED_MODELS);
    const defaultModel = this.env.AICHESTRA_LLM_DEFAULT_MODEL?.trim();
    const budgetLimit = positiveNumber(this.env.AICHESTRA_LLM_TEST_BUDGET_USD);
    if (typeof this.env.AICHESTRA_LLM_PROVIDER === "string" &&
      this.env.AICHESTRA_LLM_PROVIDER.trim().length > 0 &&
      this.env.AICHESTRA_LLM_PROVIDER !== "openai_compatible") {
      warnings.push("provider_kind_not_openai_compatible");
    }
    if (defaultModel && allowedModels.length > 0 && !allowedModels.includes(defaultModel)) {
      warnings.push("default_model_not_allowlisted");
    }
    if (budgetLimit !== undefined && budgetLimit > this.llmIntegrationTestProfile.requiredBudgetLimitUsd) {
      warnings.push("budget_cap_exceeds_profile_limit");
    }
    if (typeof this.env.AICHESTRA_LLM_TEST_BUDGET_USD === "string" &&
      this.env.AICHESTRA_LLM_TEST_BUDGET_USD.trim().length > 0 &&
      budgetLimit === undefined) {
      warnings.push("budget_cap_invalid");
    }
    if (flag(this.env.AICHESTRA_ENABLE_LLM_FALLBACK)) warnings.push("fallback_enabled");
    if (this.env.AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS !== undefined && this.env.AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS !== "0") {
      warnings.push("fallback_attempts_enabled");
    }
    if (flag(this.env.AICHESTRA_ENABLE_LLM_STREAMING)) warnings.push("streaming_enabled");
    if (flag(this.env.AICHESTRA_ENABLE_LLM_TOOL_CALLS)) warnings.push("tool_calls_enabled");
    if (flag(this.env.AICHESTRA_ENABLE_LLM_BYOK)) warnings.push("byok_enabled");
    if (flag(this.env.AICHESTRA_ENABLE_LLM_OAUTH) || flag(this.env.AICHESTRA_ENABLE_LLM_WIF) || flag(this.env.AICHESTRA_ENABLE_LLM_IAM)) {
      warnings.push("cloud_identity_exchange_enabled");
    }
    if (typeof this.env.AICHESTRA_LLM_CREDENTIAL_CACHE_PATH === "string" && this.env.AICHESTRA_LLM_CREDENTIAL_CACHE_PATH.trim().length > 0) {
      warnings.push("credential_cache_reference_configured");
    }
    if (typeof this.env.GOOGLE_APPLICATION_CREDENTIALS === "string" && this.env.GOOGLE_APPLICATION_CREDENTIALS.trim().length > 0) {
      warnings.push("credential_cache_reference_configured");
    }
    return [...new Set(warnings)];
  }

  private vaultIntegrationMissingRequiredEnvVars(): string[] {
    return this.vaultIntegrationTestProfile.requiredEnvVars.filter((name) => {
      if (name === "AICHESTRA_VAULT_INTEGRATION_TESTS") return !flag(this.env.AICHESTRA_VAULT_INTEGRATION_TESTS);
      if (name === "AICHESTRA_SECRET_BACKEND_PROVIDER") return this.env.AICHESTRA_SECRET_BACKEND_PROVIDER !== "vault";
      if (name === "AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER") return !flag(this.env.AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER);
      if (name === "AICHESTRA_VAULT_AUTH_METHOD") return this.env.AICHESTRA_VAULT_AUTH_METHOD !== "token";
      return !stringConfigured(this.env[name]);
    });
  }

  private vaultIntegrationUnsafeGateWarnings(): string[] {
    const warnings: string[] = [];
    const testSecretPath = this.env.AICHESTRA_TEST_VAULT_SECRET_PATH?.trim();
    const testSecretKey = this.env.AICHESTRA_TEST_VAULT_SECRET_KEY?.trim();
    const pathPrefixes = csvValues(this.env.AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES);
    if (stringConfigured(this.env.AICHESTRA_VAULT_AUTH_METHOD) && this.env.AICHESTRA_VAULT_AUTH_METHOD !== "token") {
      warnings.push("vault_auth_method_not_token");
    }
    for (const prefix of pathPrefixes) {
      if (!looksLikeTestOnlyVaultPath(prefix)) {
        warnings.push("path_allowlist_prefix_not_test_only");
      }
      if (looksLikeProductionVaultPath(prefix)) {
        warnings.push("production_like_path_allowlist_configured");
      }
    }
    if (testSecretPath) {
      if (!pathPrefixes.some((prefix) => testSecretPathAllowedByPrefix(testSecretPath, prefix))) {
        warnings.push("test_secret_path_not_allowlisted");
      }
      if (!looksLikeTestOnlyVaultPath(testSecretPath)) {
        warnings.push("test_secret_path_not_test_only");
      }
      if (looksLikeProductionVaultPath(testSecretPath)) {
        warnings.push("production_like_test_path_configured");
      }
    }
    if (testSecretKey && looksLikeSensitiveVaultKey(testSecretKey) && !looksLikeTestOnlyVaultKey(testSecretKey)) {
      warnings.push("test_secret_key_not_test_marker");
    }
    if (flag(this.env.AICHESTRA_VAULT_ALLOW_WRITE) || flag(this.env.AICHESTRA_ALLOW_VAULT_WRITE)) warnings.push("vault_write_enabled");
    if (flag(this.env.AICHESTRA_VAULT_ALLOW_DELETE) || flag(this.env.AICHESTRA_ALLOW_VAULT_DELETE)) warnings.push("vault_delete_enabled");
    if (flag(this.env.AICHESTRA_VAULT_ALLOW_ROTATE) || flag(this.env.AICHESTRA_ALLOW_VAULT_ROTATE)) warnings.push("vault_rotate_enabled");
    if (flag(this.env.AICHESTRA_VAULT_ALLOW_BROAD_LIST) || flag(this.env.AICHESTRA_ALLOW_VAULT_BROAD_LIST)) warnings.push("vault_broad_list_enabled");
    if (stringConfigured(this.env.AICHESTRA_VAULT_CREDENTIAL_CACHE_PATH) ||
      stringConfigured(this.env.AICHESTRA_VAULT_CLI_AUTH_PATH) ||
      stringConfigured(this.env.AICHESTRA_VAULT_CLI_TOKEN_PATH) ||
      stringConfigured(this.env.VAULT_TOKEN_FILE) ||
      stringConfigured(this.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      warnings.push("credential_cache_reference_configured");
    }
    return [...new Set(warnings)];
  }

  private llmIntegrationRoutingModeAllowed(): boolean {
    return this.env.AICHESTRA_LLM_ROUTING_MODE === "single_provider" ||
      this.env.AICHESTRA_LLM_ROUTING_MODE === "multi_provider";
  }

  private mergeQueueIntegrationMissingRequiredEnvVars(): string[] {
    return this.mergeQueueIntegrationTestProfile.requiredEnvVars.filter((name) => {
      if (name === "AICHESTRA_MERGE_QUEUE_INTEGRATION_TESTS") return !flag(this.env.AICHESTRA_MERGE_QUEUE_INTEGRATION_TESTS);
      if (name === "AICHESTRA_ENABLE_REMOTE_GIT") return !flag(this.env.AICHESTRA_ENABLE_REMOTE_GIT);
      if (name === "AICHESTRA_GIT_PROVIDER") return this.env.AICHESTRA_GIT_PROVIDER !== "github";
      if (name === "AICHESTRA_GIT_ALLOWED_BRANCH_PREFIX") return this.env.AICHESTRA_GIT_ALLOWED_BRANCH_PREFIX !== "aichestra/test/";
      if (name === "AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY") return !flag(this.env.AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY);
      if (name === "AICHESTRA_GIT_ALLOWED_REPOS") {
        return csvValues(this.env.AICHESTRA_GIT_ALLOWED_REPOS).length === 0;
      }
      if (name === "AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES") {
        return csvValues(this.env.AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES).length === 0;
      }
      return !stringConfigured(this.env[name]);
    });
  }

  private mergeQueueIntegrationUnsafeGateWarnings(): string[] {
    const warnings: string[] = [];
    if (this.remoteMergeEnabled()) warnings.push("remote_merge_enabled");
    if (flag(this.env.AICHESTRA_ALLOW_REMOTE_REBASE)) warnings.push("remote_rebase_enabled");
    if (this.remoteForcePushEnabled()) warnings.push("remote_force_push_enabled");
    if (this.remoteBranchDeletionEnabled()) warnings.push("remote_branch_delete_enabled");
    if (stringConfigured(this.env.AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY) && !flag(this.env.AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY)) {
      warnings.push("dry_run_only_disabled");
    }
    if (flag(this.env.AICHESTRA_ENABLE_AUTO_MERGE)) warnings.push("auto_merge_enabled");
    const provider = this.env.AICHESTRA_GIT_PROVIDER?.trim();
    if (provider && provider !== "github") warnings.push("git_provider_not_github");
    const configuredBranchPrefix = this.env.AICHESTRA_GIT_ALLOWED_BRANCH_PREFIX?.trim();
    if (configuredBranchPrefix && configuredBranchPrefix !== "aichestra/test/") {
      warnings.push("branch_prefix_mismatch");
    }
    const allowedRepos = csvValues(this.env.AICHESTRA_GIT_ALLOWED_REPOS);
    const testRepo = this.env.AICHESTRA_TEST_MERGE_QUEUE_REPO?.trim();
    if (testRepo && allowedRepos.length > 0 && !allowedRepos.includes(testRepo)) {
      warnings.push("test_repo_not_allowlisted");
    }
    const testSourceBranches = csvValues(this.env.AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES);
    if (testSourceBranches.length > 0 && !testSourceBranches.every((branch) => branch.startsWith("aichestra/test/"))) {
      warnings.push("test_source_branches_outside_prefix");
    }
    const testBaseBranch = this.env.AICHESTRA_TEST_MERGE_QUEUE_BASE_BRANCH?.trim();
    if (testBaseBranch && testSourceBranches.includes(testBaseBranch)) {
      warnings.push("test_base_branch_overlaps_source_branches");
    }
    return [...new Set(warnings)];
  }
}

export class VaultLiveIntegrationReadinessService {
  private readonly deploymentReadiness: DeploymentReadinessService;

  constructor(deploymentReadiness: DeploymentReadinessService) {
    this.deploymentReadiness = deploymentReadiness;
  }

  getReadiness(): VaultLiveIntegrationReadiness {
    return this.deploymentReadiness.getVaultLiveIntegrationReadiness();
  }

  listChecks(): VaultLiveValidationCheck[] {
    return this.deploymentReadiness.listVaultLiveValidationChecks();
  }

  canRunLiveValidation(): boolean {
    return this.deploymentReadiness.canRunVaultLiveValidation();
  }

  getRunbook(): VaultLiveIntegrationRunbook {
    return this.deploymentReadiness.getVaultLiveIntegrationRunbook();
  }

  getSummary(): VaultLiveIntegrationSummary {
    return this.deploymentReadiness.getVaultLiveIntegrationSummary();
  }
}

export function createDeploymentReadinessService(input: DeploymentReadinessServiceInput = {}): DeploymentReadinessService {
  return new DeploymentReadinessService(input);
}
