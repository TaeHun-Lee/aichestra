import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
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
  defaultProductionRisks,
  defaultReadinessChecks,
  defaultSecretBackendMigrationPhases,
  defaultSecretBackendOptions,
  defaultSecretBackendReadinessChecks,
  defaultSecretBackendRisks,
  defaultSecretLeasePolicies,
  defaultSecretRotationPlans
} from "./catalog.ts";
import type {
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
  SecretRotationPlan
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
}

export function createDeploymentReadinessService(input: DeploymentReadinessServiceInput = {}): DeploymentReadinessService {
  return new DeploymentReadinessService(input);
}
