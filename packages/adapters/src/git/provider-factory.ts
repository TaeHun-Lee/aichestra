import type { GitProvider, GitProviderConfigView, GitProviderKind } from "../interfaces.ts";
import { GitHubGitProvider } from "./github-git-provider.ts";
import { LocalGitProvider } from "./local-git-provider.ts";
import { MockGitProvider } from "./mock-git-provider.ts";

export type GitProviderRuntimeConfig = GitProviderConfigView & {
  localBranchCreateEnabled: boolean;
};

function flag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function providerKindFromEnv(value: string | undefined): GitProviderKind {
  if (value === "local" || value === "github") return value;
  return "mock";
}

export function createGitProviderConfigFromEnv(env: Record<string, string | undefined> = process.env): GitProviderRuntimeConfig {
  const providerKind = providerKindFromEnv(env.AICHESTRA_GIT_PROVIDER);
  return {
    providerKind,
    remoteGitEnabled: flag(env.AICHESTRA_ENABLE_REMOTE_GIT),
    remoteBranchCreateEnabled: flag(env.AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE),
    remotePullRequestCreateEnabled: flag(env.AICHESTRA_ALLOW_REMOTE_PR_CREATE),
    remoteMergeEnabled: false,
    githubConfigured: Boolean(env.AICHESTRA_GITHUB_TOKEN),
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
    return new GitHubGitProvider({
      remoteGitEnabled: config.remoteGitEnabled,
      remoteBranchCreateEnabled: config.remoteBranchCreateEnabled,
      remotePullRequestCreateEnabled: config.remotePullRequestCreateEnabled,
      token: env.AICHESTRA_GITHUB_TOKEN
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
