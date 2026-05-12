import type { GitProvider, GitProviderConfigView, GitProviderKind } from "../interfaces.ts";
import { FetchGitHubClient } from "./github-client.ts";
import { GitHubGitProvider } from "./github-git-provider.ts";
import { LocalGitProvider } from "./local-git-provider.ts";
import { MockGitProvider } from "./mock-git-provider.ts";

export type GitProviderRuntimeConfig = GitProviderConfigView & {
  localBranchCreateEnabled: boolean;
  githubOwner?: string;
  githubRepo?: string;
  githubAllowedRepos?: string[];
  githubAllowedBranchPrefix?: string;
  githubIntegrationTestsEnabled?: boolean;
  githubTokenSecretRef?: string;
  githubCredentialSource?: "none" | "legacy_env" | "secret_ref";
  githubCredentialStatus?: "resolved" | "blocked" | "missing" | "denied" | "unavailable";
  githubCredentialReason?: string;
  envSecretProviderEnabled?: boolean;
  allowedSecretEnvKeyCount?: number;
};

export type GitCredentialResolutionRequest = {
  secretRefId: string;
  purpose: "github_api_call";
  providerId: string;
  policyContext: Record<string, unknown>;
};

export type GitCredentialResolution = {
  ok: boolean;
  status: "resolved" | "blocked" | "missing" | "denied" | "unavailable";
  value?: string;
  reason?: string;
  credentialHandleId?: string;
};

export type GitProviderFactoryOptions = {
  credentialResolver?: (request: GitCredentialResolutionRequest) => GitCredentialResolution;
  resolvedCredentialValue?: string;
};

function flag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function providerKindFromEnv(value: string | undefined): GitProviderKind {
  if (value === "local" || value === "github") return value;
  return "mock";
}

function csv(value: string | undefined): string[] {
  return typeof value === "string"
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}

export function createGitProviderConfigFromEnv(env: Record<string, string | undefined> = process.env): GitProviderRuntimeConfig {
  const providerKind = providerKindFromEnv(env.AICHESTRA_GIT_PROVIDER);
  const allowedRepos = csv(env.AICHESTRA_GITHUB_ALLOWED_REPOS);
  const branchPrefix = env.AICHESTRA_GITHUB_ALLOWED_BRANCH_PREFIX?.trim() || "ai/";
  return {
    providerKind,
    remoteGitEnabled: flag(env.AICHESTRA_ENABLE_REMOTE_GIT),
    remoteBranchCreateEnabled: flag(env.AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE),
    remotePullRequestCreateEnabled: flag(env.AICHESTRA_ALLOW_REMOTE_PR_CREATE),
    remoteMergeEnabled: false,
    githubConfigured: Boolean(env.AICHESTRA_GITHUB_TOKEN || env.AICHESTRA_GITHUB_TOKEN_SECRET_REF),
    githubOwner: env.AICHESTRA_GITHUB_OWNER,
    githubRepo: env.AICHESTRA_GITHUB_REPO,
    githubOwnerConfigured: Boolean(env.AICHESTRA_GITHUB_OWNER),
    githubRepoConfigured: Boolean(env.AICHESTRA_GITHUB_REPO),
    githubAllowedRepos: allowedRepos,
    githubAllowedRepoCount: allowedRepos.length,
    githubAllowedBranchPrefix: branchPrefix,
    githubIntegrationTestsEnabled: flag(env.AICHESTRA_GITHUB_INTEGRATION_TESTS),
    localBranchCreateEnabled: flag(env.AICHESTRA_ALLOW_LOCAL_BRANCH_CREATE),
    githubTokenSecretRef: env.AICHESTRA_GITHUB_TOKEN_SECRET_REF,
    githubCredentialSource: env.AICHESTRA_GITHUB_TOKEN_SECRET_REF ? "secret_ref" : env.AICHESTRA_GITHUB_TOKEN ? "legacy_env" : "none",
    githubCredentialStatus: env.AICHESTRA_GITHUB_TOKEN || env.AICHESTRA_GITHUB_TOKEN_SECRET_REF ? "resolved" : "missing",
    githubCredentialReason: env.AICHESTRA_GITHUB_TOKEN_SECRET_REF ? undefined : env.AICHESTRA_GITHUB_TOKEN ? "legacy_env_token_configured" : "github_credentials_missing",
    envSecretProviderEnabled: flag(env.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER),
    allowedSecretEnvKeyCount: csv(env.AICHESTRA_ALLOWED_SECRET_ENV_KEYS).length
  };
}

export function createGitProviderFromConfig(
  config: GitProviderRuntimeConfig,
  env: Record<string, string | undefined> = process.env,
  options: GitProviderFactoryOptions = {}
): GitProvider {
  if (config.providerKind === "local") {
    return new LocalGitProvider({
      allowLocalBranchCreate: config.localBranchCreateEnabled
    });
  }

  if (config.providerKind === "github") {
    const credential = options.resolvedCredentialValue
      ? { ok: true, status: "resolved" as const, value: options.resolvedCredentialValue, reason: "resolved_credential_value" }
      : resolveGitHubCredential(config, env, options);
    const token = credential.value;
    const client = config.remoteGitEnabled && token && (config.githubAllowedRepos?.length ?? 0) > 0
      ? new FetchGitHubClient({ token })
      : undefined;
    return new GitHubGitProvider({
      remoteGitEnabled: config.remoteGitEnabled,
      remoteBranchCreateEnabled: config.remoteBranchCreateEnabled,
      remotePullRequestCreateEnabled: config.remotePullRequestCreateEnabled,
      token,
      owner: config.githubOwner,
      repo: config.githubRepo,
      allowedRepos: config.githubAllowedRepos,
      allowedBranchPrefix: config.githubAllowedBranchPrefix,
      integrationTestsEnabled: config.githubIntegrationTestsEnabled,
      client
    });
  }

  return new MockGitProvider();
}

export function createGitProviderFromEnv(): {
  provider: GitProvider;
  config: GitProviderRuntimeConfig;
};
export function createGitProviderFromEnv(
  env: Record<string, string | undefined>,
  options?: GitProviderFactoryOptions
): {
  provider: GitProvider;
  config: GitProviderRuntimeConfig;
};
export function createGitProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
  options: GitProviderFactoryOptions = {}
): {
  provider: GitProvider;
  config: GitProviderRuntimeConfig;
} {
  const config = createGitProviderConfigFromEnv(env);
  const credential = resolveGitHubCredential(config, env, options);
  const resolvedConfig = {
    ...config,
    githubConfigured: credential.ok,
    githubCredentialStatus: credential.status,
    githubCredentialReason: credential.reason,
    githubCredentialSource: config.githubTokenSecretRef ? "secret_ref" as const : credential.ok ? "legacy_env" as const : "none" as const
  };
  return {
    provider: createGitProviderFromConfig(resolvedConfig, env, { resolvedCredentialValue: credential.value }),
    config: resolvedConfig
  };
}

function resolveGitHubCredential(
  config: GitProviderRuntimeConfig,
  env: Record<string, string | undefined>,
  options: GitProviderFactoryOptions
): GitCredentialResolution {
  if (config.githubTokenSecretRef) {
    if (!options.credentialResolver) {
      return { ok: false, status: "blocked", reason: "credential_resolver_unavailable" };
    }
    const resolved = options.credentialResolver({
      secretRefId: config.githubTokenSecretRef,
      purpose: "github_api_call",
      providerId: "github",
      policyContext: {
        providerKind: "github",
        remoteGitEnabled: config.remoteGitEnabled,
        remoteBranchCreateEnabled: config.remoteBranchCreateEnabled,
        remotePullRequestCreateEnabled: config.remotePullRequestCreateEnabled,
        repoAllowlisted: (config.githubAllowedRepos?.length ?? 0) > 0,
        credentialsConfigured: true,
        envSecretProviderEnabled: config.envSecretProviderEnabled === true
      }
    });
    return resolved;
  }
  const token = env.AICHESTRA_GITHUB_TOKEN;
  if (token) {
    return { ok: true, status: "resolved", value: token, reason: "legacy_env_token_configured" };
  }
  return { ok: false, status: "missing", reason: "github_credentials_missing" };
}
