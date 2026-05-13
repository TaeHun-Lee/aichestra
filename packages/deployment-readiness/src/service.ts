import { defaultDeploymentProfiles, defaultProductionRisks, defaultReadinessChecks } from "./catalog.ts";
import type {
  DeploymentProfile,
  DeploymentProfileName,
  DeploymentReadinessEnvironment,
  DeploymentReadinessSummary,
  ProductionRisk,
  ReadinessCheck,
  ReadinessCheckStatus,
  ReadinessSeverity
} from "./types.ts";

const checkStatuses: ReadinessCheckStatus[] = ["pass", "fail", "warning", "not_applicable", "not_checked"];
const severities: ReadinessSeverity[] = ["low", "medium", "high", "critical"];

export type DeploymentReadinessServiceInput = {
  env?: Record<string, string | undefined>;
  profiles?: DeploymentProfile[];
  checks?: ReadinessCheck[];
  risks?: ProductionRisk[];
  now?: () => Date;
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

export class DeploymentReadinessService {
  private readonly env: Record<string, string | undefined>;
  private readonly profiles: DeploymentProfile[];
  private readonly checks: ReadinessCheck[];
  private readonly risks: ProductionRisk[];
  private readonly now: () => Date;

  constructor(input: DeploymentReadinessServiceInput = {}) {
    this.env = input.env ?? process.env;
    this.profiles = clone(input.profiles ?? defaultDeploymentProfiles);
    this.checks = clone(input.checks ?? defaultReadinessChecks);
    this.risks = clone(input.risks ?? defaultProductionRisks);
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
}

export function createDeploymentReadinessService(input: DeploymentReadinessServiceInput = {}): DeploymentReadinessService {
  return new DeploymentReadinessService(input);
}
