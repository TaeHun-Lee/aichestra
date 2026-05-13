import { randomUUID } from "node:crypto";

export type GitHubAuthMode = "legacy_token" | "github_app";

export type GitHubAppRuntimeStatus = "disabled" | "configured_mock" | "enabled_gated" | "future_live";

export type GitHubAppAccountType = "user" | "organization" | "enterprise" | "unknown";

export type GitHubAppRepositorySelection = "all" | "selected" | "unknown";

export type GitHubAppInstallationStatus = "active_mock" | "enabled_gated" | "suspended" | "removed" | "disabled";

export type GitHubAppRepositoryGrantStatus = "allowed" | "blocked" | "removed" | "unknown";

export type GitHubInstallationTokenPurpose =
  | "branch_create"
  | "pr_create"
  | "pr_read"
  | "changed_files_read"
  | "webhook_sync";

export type GitHubInstallationTokenResultStatus =
  | "issued_mock"
  | "issued_gated"
  | "blocked"
  | "denied"
  | "missing_secret"
  | "unavailable"
  | "expired";

export type GitHubAppRuntimeConfig = {
  id: string;
  authMode: GitHubAuthMode;
  appId?: string;
  appSlug?: string;
  status: GitHubAppRuntimeStatus;
  enabled: boolean;
  appIdConfigured: boolean;
  privateKeySecretRefId?: string;
  webhookSecretRefId?: string;
  privateKeySecretRefConfigured: boolean;
  webhookSecretRefConfigured: boolean;
  privateKeyEnvConfiguredUnsupported: boolean;
  allowedInstallationIds: string[];
  allowedRepos: string[];
  allowedBranchPrefix: string;
  permissions: Record<string, "none" | "read" | "write">;
  events: string[];
  integrationTestsEnabled: boolean;
  tokenProviderKind: "disabled" | "mock" | "gated_future";
  configured: boolean;
  blockedReasons: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type GitHubAppInstallationState = {
  id: string;
  appConfigId: string;
  installationId: string;
  accountLogin: string;
  accountType: GitHubAppAccountType;
  repositorySelection: GitHubAppRepositorySelection;
  allowedRepos: string[];
  status: GitHubAppInstallationStatus;
  lastSyncedAt?: Date;
  metadata: Record<string, unknown>;
};

export type GitHubAppRepositoryGrantState = {
  id: string;
  installationStateId: string;
  repoOwner: string;
  repoName: string;
  repoId?: string;
  permissions: Record<string, "none" | "read" | "write">;
  status: GitHubAppRepositoryGrantStatus;
  metadata: Record<string, unknown>;
};

export type GitHubInstallationTokenRequest = {
  id: string;
  appConfigId: string;
  installationId: string;
  repoRef?: string;
  purpose: GitHubInstallationTokenPurpose;
  actorId?: string;
  principalId?: string;
  policyContext: Record<string, unknown>;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type GitHubInstallationTokenResult = {
  id: string;
  requestId: string;
  status: GitHubInstallationTokenResultStatus;
  tokenHandleId?: string;
  expiresAt?: Date;
  policyDecisionId?: string;
  authorizationDecisionId?: string;
  auditEventId?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export function createGitHubAppRuntimeConfigFromEnv(
  env: Record<string, string | undefined> = process.env
): GitHubAppRuntimeConfig {
  const authMode = env.AICHESTRA_GITHUB_AUTH_MODE === "github_app" ? "github_app" : "legacy_token";
  const enabled = flag(env.AICHESTRA_ENABLE_GITHUB_APP);
  const appId = optional(env.AICHESTRA_GITHUB_APP_ID);
  const privateKeySecretRefId = optional(env.AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF);
  const webhookSecretRefId = optional(env.AICHESTRA_GITHUB_APP_WEBHOOK_SECRET_REF);
  const allowedInstallationIds = csv(env.AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS ?? env.AICHESTRA_GITHUB_APP_INSTALLATION_ID);
  const allowedRepos = csv(env.AICHESTRA_GITHUB_APP_ALLOWED_REPOS).map((value) => value.toLowerCase());
  const privateKeyEnvConfiguredUnsupported = Boolean(env.GITHUB_APP_PRIVATE_KEY || env.AICHESTRA_GITHUB_APP_PRIVATE_KEY);
  const blockedReasons = githubAppBlockedReasons({
    authMode,
    enabled,
    appIdConfigured: Boolean(appId),
    privateKeySecretRefConfigured: Boolean(privateKeySecretRefId),
    allowedInstallationIds,
    allowedRepos,
    privateKeyEnvConfiguredUnsupported
  });
  const configured = authMode === "github_app" && blockedReasons.length === 0;
  const now = new Date();
  return {
    id: "github_app_runtime_config",
    authMode,
    appId,
    appSlug: optional(env.AICHESTRA_GITHUB_APP_SLUG),
    status: !enabled || authMode !== "github_app" ? "disabled" : configured ? "configured_mock" : "disabled",
    enabled,
    appIdConfigured: Boolean(appId),
    privateKeySecretRefId,
    webhookSecretRefId,
    privateKeySecretRefConfigured: Boolean(privateKeySecretRefId),
    webhookSecretRefConfigured: Boolean(webhookSecretRefId),
    privateKeyEnvConfiguredUnsupported,
    allowedInstallationIds,
    allowedRepos,
    allowedBranchPrefix: optional(env.AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX) ?? optional(env.AICHESTRA_GITHUB_ALLOWED_BRANCH_PREFIX) ?? "ai/",
    permissions: leastPrivilegePermissions(),
    events: supportedGitHubAppEvents(),
    integrationTestsEnabled: flag(env.AICHESTRA_GITHUB_APP_INTEGRATION_TESTS),
    tokenProviderKind: authMode === "github_app" && enabled ? "mock" : "disabled",
    configured,
    blockedReasons,
    createdAt: now,
    updatedAt: now,
    metadata: {
      mockFirst: true,
      realInstallationTokenExchangeEnabled: false,
      privateKeyEnvFallbackSupported: false
    }
  };
}

export function validateGitHubAppRuntimeConfig(config: GitHubAppRuntimeConfig): { ok: true; reasons: [] } | { ok: false; reasons: string[] } {
  const reasons = githubAppBlockedReasons({
    authMode: config.authMode,
    enabled: config.enabled,
    appIdConfigured: config.appIdConfigured,
    privateKeySecretRefConfigured: config.privateKeySecretRefConfigured,
    allowedInstallationIds: config.allowedInstallationIds,
    allowedRepos: config.allowedRepos,
    privateKeyEnvConfiguredUnsupported: config.privateKeyEnvConfiguredUnsupported
  });
  return reasons.length === 0 ? { ok: true, reasons: [] } : { ok: false, reasons };
}

export function buildGitHubAppInstallationStates(config: GitHubAppRuntimeConfig): GitHubAppInstallationState[] {
  return config.allowedInstallationIds.map((installationId) => ({
    id: `github_app_installation_${installationId}`,
    appConfigId: config.id,
    installationId,
    accountLogin: `installation-${installationId}`,
    accountType: "unknown",
    repositorySelection: config.allowedRepos.length > 0 ? "selected" : "unknown",
    allowedRepos: [...config.allowedRepos],
    status: config.configured ? "active_mock" : "disabled",
    metadata: {
      source: "env_allowlist",
      liveSynced: false
    }
  }));
}

export function buildGitHubAppRepositoryGrantStates(config: GitHubAppRuntimeConfig): GitHubAppRepositoryGrantState[] {
  const installation = config.allowedInstallationIds[0] ?? "unconfigured";
  return config.allowedRepos.map((repoRef) => {
    const [repoOwner = "unknown", repoName = "unknown"] = repoRef.split("/");
    return {
      id: `github_app_repo_grant_${installation}_${repoOwner}_${repoName}`,
      installationStateId: `github_app_installation_${installation}`,
      repoOwner,
      repoName,
      permissions: leastPrivilegePermissions(),
      status: config.configured ? "allowed" : "blocked",
      metadata: {
        source: "env_allowlist",
        destructiveOperationsAllowed: false
      }
    };
  });
}

export function createGitHubInstallationTokenRequest(input: Omit<GitHubInstallationTokenRequest, "id" | "createdAt" | "metadata"> & {
  id?: string;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}): GitHubInstallationTokenRequest {
  return {
    ...input,
    id: input.id ?? createGitHubAppId("ghapptokreq"),
    createdAt: input.createdAt ?? new Date(),
    metadata: sanitizeGitHubAppMetadata(input.metadata ?? {}) as Record<string, unknown>
  };
}

export function createGitHubInstallationTokenResult(input: Omit<GitHubInstallationTokenResult, "id" | "createdAt" | "metadata"> & {
  id?: string;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
}): GitHubInstallationTokenResult {
  return {
    ...input,
    id: input.id ?? createGitHubAppId("ghapptokres"),
    createdAt: input.createdAt ?? new Date(),
    metadata: sanitizeGitHubAppMetadata(input.metadata ?? {}) as Record<string, unknown>
  };
}

export function gitHubAppRuntimeConfigToDto(config: GitHubAppRuntimeConfig): Record<string, unknown> {
  return sanitizeGitHubAppMetadata({
    id: config.id,
    authMode: config.authMode,
    status: config.status,
    enabled: config.enabled,
    configured: config.configured,
    appIdConfigured: config.appIdConfigured,
    appSlugConfigured: Boolean(config.appSlug),
    privateKeySecretRefConfigured: config.privateKeySecretRefConfigured,
    webhookSecretRefConfigured: config.webhookSecretRefConfigured,
    privateKeyEnvConfiguredUnsupported: config.privateKeyEnvConfiguredUnsupported,
    allowedInstallationCount: config.allowedInstallationIds.length,
    allowedRepoCount: config.allowedRepos.length,
    allowedBranchPrefix: config.allowedBranchPrefix,
    permissions: config.permissions,
    events: config.events,
    integrationTestsEnabled: config.integrationTestsEnabled,
    tokenProviderKind: config.tokenProviderKind,
    blockedReasons: config.blockedReasons,
    realInstallationTokenExchangeEnabled: false,
    secretsExposed: false,
    tokensExposed: false,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  }) as Record<string, unknown>;
}

export function gitHubAppInstallationStateToDto(state: GitHubAppInstallationState): Record<string, unknown> {
  return sanitizeGitHubAppMetadata({
    ...state,
    allowedRepoCount: state.allowedRepos.length
  }) as Record<string, unknown>;
}

export function gitHubAppRepositoryGrantStateToDto(state: GitHubAppRepositoryGrantState): Record<string, unknown> {
  return sanitizeGitHubAppMetadata(state) as Record<string, unknown>;
}

export function gitHubInstallationTokenResultToDto(result: GitHubInstallationTokenResult): Record<string, unknown> {
  return sanitizeGitHubAppMetadata({
    id: result.id,
    requestId: result.requestId,
    status: result.status,
    tokenHandleId: result.tokenHandleId,
    tokenIssued: result.status === "issued_mock" || result.status === "issued_gated",
    expiresAt: result.expiresAt,
    policyDecisionId: result.policyDecisionId,
    authorizationDecisionId: result.authorizationDecisionId,
    auditEventId: result.auditEventId,
    createdAt: result.createdAt,
    metadata: result.metadata
  }) as Record<string, unknown>;
}

export function sanitizeGitHubAppMetadata(value: unknown, key = ""): unknown {
  if (/private[_-]?key|token|secret|authorization|credential|jwt|password/i.test(key)) {
    if (/secretRefConfigured|SecretRefConfigured/i.test(key)) return value;
    if (/tokenHandleId/i.test(key)) return value;
    if (/tokenProviderKind|tokensExposed|secretsExposed/i.test(key)) return value;
    return "[redacted]";
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeGitHubAppMetadata(item));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeGitHubAppMetadata(entryValue, entryKey)
    ]));
  }
  if (typeof value === "string") {
    return value
      .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[redacted-private-key]")
      .replace(/ghs_[A-Za-z0-9_]+/g, "[redacted]")
      .replace(/ghp_[A-Za-z0-9_]+/g, "[redacted]")
      .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]")
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
      .replace(/AICHESTRA_GITHUB_WEBHOOK_SECRET=[^\s]+/g, "[redacted]");
  }
  return value;
}

export function leastPrivilegePermissions(): Record<string, "none" | "read" | "write"> {
  return {
    metadata: "read",
    contents: "write",
    pull_requests: "write",
    checks: "read",
    statuses: "read",
    issues: "none",
    workflows: "none",
    administration: "none",
    secrets: "none",
    deployments: "none"
  };
}

export function supportedGitHubAppEvents(): string[] {
  return [
    "ping",
    "pull_request",
    "push",
    "check_run",
    "check_suite",
    "status",
    "pull_request_review",
    "installation",
    "installation_repositories",
    "repository"
  ];
}

function githubAppBlockedReasons(input: {
  authMode: GitHubAuthMode;
  enabled: boolean;
  appIdConfigured: boolean;
  privateKeySecretRefConfigured: boolean;
  allowedInstallationIds: string[];
  allowedRepos: string[];
  privateKeyEnvConfiguredUnsupported: boolean;
}): string[] {
  const reasons: string[] = [];
  if (input.authMode !== "github_app") reasons.push("github_app_auth_mode_not_selected");
  if (!input.enabled) reasons.push("github_app_disabled");
  if (!input.appIdConfigured) reasons.push("github_app_id_missing");
  if (!input.privateKeySecretRefConfigured) reasons.push("github_app_private_key_secret_ref_missing");
  if (input.allowedInstallationIds.length === 0) reasons.push("github_app_installation_allowlist_missing");
  if (input.allowedRepos.length === 0) reasons.push("github_app_repo_allowlist_missing");
  if (input.privateKeyEnvConfiguredUnsupported) reasons.push("github_app_private_key_env_unsupported");
  return reasons;
}

function createGitHubAppId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function flag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function csv(value: string | undefined): string[] {
  return typeof value === "string"
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}

function optional(value: string | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
