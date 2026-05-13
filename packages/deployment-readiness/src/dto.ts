import type {
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
  SecretBackendMigrationPhase,
  SecretBackendMigrationSummary,
  SecretBackendOption,
  SecretBackendReadinessCheck,
  SecretBackendRisk,
  SecretLeasePolicy,
  SecretRotationPlan
} from "./types.ts";

const sensitiveKeyPattern = /^(token|accessToken|refreshToken|apiKey|api_key|authorization|password|rawSecret|secretValue|credentialValue|privateKey|private_key|webhookSecret|session|cookie|databaseUrl|database_url|connectionString|postgresUrl|clientSecret|vaultToken|secretAccessKey)$/i;
const secretLikePattern = /(Bearer\s+)[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{6,}|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|postgres(?:ql)?:\/\/[^\s"']+|((?:OPENAI_API_KEY|ANTHROPIC_API_KEY|AICHESTRA_LLM_API_KEY|LLM_API_KEY|GITHUB_TOKEN|AICHESTRA_GITHUB_TOKEN|AICHESTRA_GITHUB_WEBHOOK_SECRET|GITHUB_APP_PRIVATE_KEY|PRIVATE_KEY|DATABASE_URL|AICHESTRA_DATABASE_URL|AICHESTRA_TEST_DATABASE_URL|SESSION_SECRET|JWT_SECRET|VAULT_TOKEN|AWS_SECRET_ACCESS_KEY|AWS_SECRET|GCP_SECRET|AZURE_KEY|AZURE_CLIENT_SECRET|[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|PRIVATE_KEY))=)[^\s"']+/g;

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
