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
    githubConfigured: Boolean(env.AICHESTRA_GITHUB_TOKEN),
    githubOwner: env.AICHESTRA_GITHUB_OWNER,
    githubRepo: env.AICHESTRA_GITHUB_REPO,
    githubOwnerConfigured: Boolean(env.AICHESTRA_GITHUB_OWNER),
    githubRepoConfigured: Boolean(env.AICHESTRA_GITHUB_REPO),
    githubAllowedRepos: allowedRepos,
    githubAllowedRepoCount: allowedRepos.length,
    githubAllowedBranchPrefix: branchPrefix,
    githubIntegrationTestsEnabled: flag(env.AICHESTRA_GITHUB_INTEGRATION_TESTS),
    localBranchCreateEnabled: flag(env.AICHESTRA_ALLOW_LOCAL_BRANCH_CREATE)
  };
}

export function createGitProviderFromConfig(
  config: GitProviderRuntimeConfig,
  env: Record<string, string | undefined> = process.env
): GitProvider {
  if (config.providerKind === "local") {
    return new LocalGitProvider({
      allowLocalBranchCreate: config.localBranchCreateEnabled
    });
  }

  if (config.providerKind === "github") {
    const token = env.AICHESTRA_GITHUB_TOKEN;
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

export function createGitProviderFromEnv(env: Record<string, string | undefined> = process.env): {
  provider: GitProvider;
  config: GitProviderRuntimeConfig;
} {
  const config = createGitProviderConfigFromEnv(env);
  return {
    provider: createGitProviderFromConfig(config, env),
    config
  };
}
