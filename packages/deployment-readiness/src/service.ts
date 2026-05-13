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
  defaultProductionRisks,
  defaultReadinessChecks,
  defaultSecretBackendMigrationPhases,
  defaultSecretBackendOptions,
  defaultSecretBackendReadinessChecks,
  defaultSecretBackendRisks,
  defaultServiceAccountPlans,
  defaultStagingDeploymentProfile,
  defaultStagingIntegrationGates,
  defaultStagingPromotionCriteria,
  defaultStagingReadinessChecks,
  defaultStagingRollbackCriteria,
  defaultTenantBoundaryPlans,
  defaultSecretLeasePolicies,
  defaultSecretRotationPlans
} from "./catalog.ts";
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
  ProductionRisk,
  ReadinessCheck,
  ReadinessCheckStatus,
  ReadinessSeverity,
  SecretBackendMigrationPhase,
  SecretBackendMigrationSummary,
  SecretBackendOption,
  SecretBackendReadinessCategory,
  SecretBackendReadinessCheck,
  SecretBackendRisk,
  SecretLeasePolicy,
  SecretRotationPlan,
  ServiceAccountPlan,
  StagingDeploymentProfile,
  StagingDeploymentSummary,
  StagingIntegrationGate,
  StagingPromotionCriterion,
  StagingReadinessCategory,
  StagingReadinessCheck,
  StagingRollbackCriterion,
  TenantBoundaryPlan
} from "./types.ts";

const checkStatuses: ReadinessCheckStatus[] = ["pass", "fail", "warning", "not_applicable", "not_checked"];
const severities: ReadinessSeverity[] = ["low", "medium", "high", "critical"];

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
  authProviderOptions?: AuthProviderOption[];
  authRbacMigrationPhases?: AuthRbacMigrationPhase[];
  authRbacReadinessChecks?: AuthRbacReadinessCheck[];
  authRbacProductionRisks?: AuthRbacProductionRisk[];
  tenantBoundaryPlans?: TenantBoundaryPlan[];
  serviceAccountPlans?: ServiceAccountPlan[];
  authRbacPermissionMatrix?: AuthRbacPermissionMatrixEntry[];
  policyEngineOptions?: PolicyEngineOption[];
  policyBundlePlans?: PolicyBundlePlan[];
  policyDomainMappings?: PolicyDomainMapping[];
  policyBundleReadinessChecks?: PolicyBundleReadinessCheck[];
  policyBundleRisks?: PolicyBundleRisk[];
  policyBundleMigrationPhases?: PolicyBundleMigrationPhase[];
  stagingDeploymentProfile?: StagingDeploymentProfile;
  stagingIntegrationGates?: StagingIntegrationGate[];
  stagingReadinessChecks?: StagingReadinessCheck[];
  stagingPromotionCriteria?: StagingPromotionCriterion[];
  stagingRollbackCriteria?: StagingRollbackCriterion[];
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
  staticPolicyRuleCount?: number;
  repoRoot?: string;
  migrationsDir?: string;
  migrationRunnerPath?: string;
  now?: () => Date;
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
  private readonly authProviderOptions: AuthProviderOption[];
  private readonly authRbacMigrationPhases: AuthRbacMigrationPhase[];
  private readonly authRbacReadinessChecks: AuthRbacReadinessCheck[];
  private readonly authRbacProductionRisks: AuthRbacProductionRisk[];
  private readonly tenantBoundaryPlans: TenantBoundaryPlan[];
  private readonly serviceAccountPlans: ServiceAccountPlan[];
  private readonly authRbacPermissionMatrix: AuthRbacPermissionMatrixEntry[];
  private readonly policyEngineOptions: PolicyEngineOption[];
  private readonly policyBundlePlans: PolicyBundlePlan[];
  private readonly policyDomainMappings: PolicyDomainMapping[];
  private readonly policyBundleReadinessChecks: PolicyBundleReadinessCheck[];
  private readonly policyBundleRisks: PolicyBundleRisk[];
  private readonly policyBundleMigrationPhases: PolicyBundleMigrationPhase[];
  private readonly stagingDeploymentProfile: StagingDeploymentProfile;
  private readonly stagingIntegrationGates: StagingIntegrationGate[];
  private readonly stagingReadinessChecks: StagingReadinessCheck[];
  private readonly stagingPromotionCriteria: StagingPromotionCriterion[];
  private readonly stagingRollbackCriteria: StagingRollbackCriterion[];
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
    this.authProviderOptions = clone(input.authProviderOptions ?? defaultAuthProviderOptions);
    this.authRbacMigrationPhases = clone(input.authRbacMigrationPhases ?? defaultAuthRbacMigrationPhases);
    this.authRbacReadinessChecks = clone(input.authRbacReadinessChecks ?? defaultAuthRbacReadinessChecks);
    this.authRbacProductionRisks = clone(input.authRbacProductionRisks ?? defaultAuthRbacProductionRisks);
    this.tenantBoundaryPlans = clone(input.tenantBoundaryPlans ?? defaultTenantBoundaryPlans);
    this.serviceAccountPlans = clone(input.serviceAccountPlans ?? defaultServiceAccountPlans);
    this.authRbacPermissionMatrix = clone(input.authRbacPermissionMatrix ?? defaultAuthRbacPermissionMatrix);
    this.policyEngineOptions = clone(input.policyEngineOptions ?? defaultPolicyEngineOptions);
    this.policyBundlePlans = clone(input.policyBundlePlans ?? defaultPolicyBundlePlans);
    this.policyDomainMappings = clone(input.policyDomainMappings ?? defaultPolicyDomainMappings);
    this.policyBundleReadinessChecks = clone(input.policyBundleReadinessChecks ?? defaultPolicyBundleReadinessChecks);
    this.policyBundleRisks = clone(input.policyBundleRisks ?? defaultPolicyBundleRisks);
    this.policyBundleMigrationPhases = clone(input.policyBundleMigrationPhases ?? defaultPolicyBundleMigrationPhases);
    this.stagingDeploymentProfile = clone(input.stagingDeploymentProfile ?? defaultStagingDeploymentProfile);
    this.stagingIntegrationGates = clone(input.stagingIntegrationGates ?? defaultStagingIntegrationGates);
    this.stagingReadinessChecks = clone(input.stagingReadinessChecks ?? defaultStagingReadinessChecks);
    this.stagingPromotionCriteria = clone(input.stagingPromotionCriteria ?? defaultStagingPromotionCriteria);
    this.stagingRollbackCriteria = clone(input.stagingRollbackCriteria ?? defaultStagingRollbackCriteria);
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
        realVaultIntegrationImplemented: false,
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

  private llmIntegrationRoutingModeAllowed(): boolean {
    return this.env.AICHESTRA_LLM_ROUTING_MODE === "single_provider" ||
      this.env.AICHESTRA_LLM_ROUTING_MODE === "multi_provider";
  }
}

export function createDeploymentReadinessService(input: DeploymentReadinessServiceInput = {}): DeploymentReadinessService {
  return new DeploymentReadinessService(input);
}
