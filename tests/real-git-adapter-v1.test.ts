import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  GitHubGitProvider,
  GitIntegrationService,
  createGitProviderConfigFromEnv,
  createGitProviderFromEnv
} from "@aichestra/git-adapter";
import type { GitChangedFile, GitHubBranch, GitHubClient, GitHubPullRequest, GitHubRepository, GitProviderRuntimeConfig } from "@aichestra/git-adapter";
import { PolicyService } from "@aichestra/policy";

class FixtureGitHubClient implements GitHubClient {
  readonly calls: string[] = [];
  throwOnCreateBranch?: string;

  async validateConnection(): Promise<{ ok: boolean; message: string }> {
    this.calls.push("validateConnection");
    return { ok: true, message: "fixture github connection validated" };
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    this.calls.push(`getRepository:${owner}/${repo}`);
    return { owner, name: repo, defaultBranch: "main" };
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<GitHubBranch> {
    this.calls.push(`getBranch:${owner}/${repo}:${branch}`);
    return { name: branch, sha: "abc123fixture" };
  }

  async createBranch(owner: string, repo: string, baseBranch: string, newBranch: string): Promise<GitHubBranch> {
    this.calls.push(`createBranch:${owner}/${repo}:${baseBranch}:${newBranch}`);
    if (this.throwOnCreateBranch) throw new Error(this.throwOnCreateBranch);
    return { name: newBranch, sha: "abc123fixture" };
  }

  async createPullRequest(owner: string, repo: string, title: string, head: string, base: string): Promise<GitHubPullRequest> {
    this.calls.push(`createPullRequest:${owner}/${repo}:${head}:${base}:${title}`);
    return {
      number: 42,
      id: 4200,
      htmlUrl: `https://github.example.invalid/${owner}/${repo}/pull/42`,
      title,
      head,
      base,
      state: "open"
    };
  }

  async listPullRequests(owner: string, repo: string): Promise<GitHubPullRequest[]> {
    this.calls.push(`listPullRequests:${owner}/${repo}`);
    return [];
  }

  async getPullRequest(owner: string, repo: string, number: number): Promise<GitHubPullRequest> {
    this.calls.push(`getPullRequest:${owner}/${repo}:${number}`);
    return {
      number,
      id: number,
      htmlUrl: `https://github.example.invalid/${owner}/${repo}/pull/${number}`,
      title: "Fixture PR",
      head: "ai/fixture",
      base: "main",
      state: "open"
    };
  }

  async getPullRequestChangedFiles(owner: string, repo: string, number: number): Promise<GitChangedFile[]> {
    this.calls.push(`getPullRequestChangedFiles:${owner}/${repo}:${number}`);
    return [
      { path: "src/auth/session.ts", status: "modified" },
      { path: "tests/auth/session.test.ts", status: "added" }
    ];
  }
}

function githubConfig(overrides: Partial<GitProviderRuntimeConfig> = {}): GitProviderRuntimeConfig {
  return {
    providerKind: "github",
    remoteGitEnabled: true,
    remoteBranchCreateEnabled: true,
    remotePullRequestCreateEnabled: true,
    remoteMergeEnabled: false,
    githubConfigured: true,
    githubOwner: "aichestra",
    githubRepo: "demo-backend",
    githubOwnerConfigured: true,
    githubRepoConfigured: true,
    githubAllowedRepos: ["aichestra/demo-backend"],
    githubAllowedRepoCount: 1,
    githubAllowedBranchPrefix: "ai/",
    githubIntegrationTestsEnabled: false,
    localBranchCreateEnabled: false,
    ...overrides
  };
}

function githubService(client: FixtureGitHubClient, overrides: Partial<GitProviderRuntimeConfig> = {}) {
  const store = createSeededStore();
  const repo = store.createRepo({
    provider: "github",
    owner: "aichestra",
    name: "demo-backend",
    defaultBranch: "main"
  });
  const config = githubConfig(overrides);
  const provider = new GitHubGitProvider({
    remoteGitEnabled: config.remoteGitEnabled,
    remoteBranchCreateEnabled: config.remoteBranchCreateEnabled,
    remotePullRequestCreateEnabled: config.remotePullRequestCreateEnabled,
    token: config.githubConfigured ? "ghp_fixturetoken" : undefined,
    owner: config.githubOwner,
    repo: config.githubRepo,
    allowedRepos: config.githubAllowedRepos,
    allowedBranchPrefix: config.githubAllowedBranchPrefix,
    integrationTestsEnabled: config.githubIntegrationTestsEnabled,
    client
  });
  const service = new GitIntegrationService({
    store,
    provider,
    config,
    policyService: new PolicyService()
  });
  return { store, repo, service };
}

function getJson(port: number, requestPath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, requestPath: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: requestPath,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized)
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(serialized);
  });
}

test("Real Git Adapter v1 config gates are disabled by default and expose safe metadata only", () => {
  const config = createGitProviderConfigFromEnv({});

  assert.equal(config.providerKind, "mock");
  assert.equal(config.remoteGitEnabled, false);
  assert.equal(config.remoteBranchCreateEnabled, false);
  assert.equal(config.remotePullRequestCreateEnabled, false);
  assert.equal(config.remoteMergeEnabled, false);
  assert.equal(config.githubConfigured, false);
  assert.equal(config.githubAllowedBranchPrefix, "ai/");
  assert.equal(config.githubAllowedRepoCount, 0);
});

test("GitHub branch creation blocks before client calls unless every gate passes", async () => {
  const disabledClient = new FixtureGitHubClient();
  const disabled = githubService(disabledClient, { remoteBranchCreateEnabled: false });
  const disabledResult = await disabled.service.createRemoteBranch(disabled.repo.id, { branchName: "ai/blocked", baseBranch: "main" });
  assert.equal(disabledResult.ok, false);
  assert.equal(disabledResult.reason, "remote_branch_create_disabled");
  assert.deepEqual(disabledClient.calls, []);

  const missingTokenClient = new FixtureGitHubClient();
  const missingToken = githubService(missingTokenClient, { githubConfigured: false });
  const missingTokenResult = await missingToken.service.createRemoteBranch(missingToken.repo.id, { branchName: "ai/blocked", baseBranch: "main" });
  assert.equal(missingTokenResult.ok, false);
  assert.equal(missingTokenResult.reason, "github_credentials_missing");
  assert.deepEqual(missingTokenClient.calls, []);

  const allowlistClient = new FixtureGitHubClient();
  const allowlist = githubService(allowlistClient, { githubAllowedRepos: ["aichestra/other"], githubAllowedRepoCount: 1 });
  const allowlistResult = await allowlist.service.createRemoteBranch(allowlist.repo.id, { branchName: "ai/blocked", baseBranch: "main" });
  assert.equal(allowlistResult.ok, false);
  assert.equal(allowlistResult.reason, "repo_not_allowlisted");
  assert.deepEqual(allowlistClient.calls, []);

  const prefixClient = new FixtureGitHubClient();
  const prefix = githubService(prefixClient);
  const prefixResult = await prefix.service.createRemoteBranch(prefix.repo.id, { branchName: "feature/not-allowed", baseBranch: "main" });
  assert.equal(prefixResult.ok, false);
  assert.equal(prefixResult.reason, "branch_prefix_not_allowed");
  assert.deepEqual(prefixClient.calls, []);
});

test("GitHub branch and PR creation succeed through mocked client with audit and durable metadata", async () => {
  const client = new FixtureGitHubClient();
  const { store, repo, service } = githubService(client);
  const task = store.createTask({ title: "Remote Git v1", repoId: repo.id, baseBranch: "main" });
  const taskRun = store.createTaskRun({ taskId: task.id, attempt: 1, status: "running", agent: "codex", model: "mock-model" });

  const branch = await service.createRemoteBranch(repo.id, {
    branchName: "ai/remote-git-v1",
    baseBranch: "main",
    taskId: task.id,
    taskRunId: taskRun.id,
    files: ["src/auth/session.ts"]
  });
  assert.equal(branch.ok, true);
  assert.equal(branch.branchLease?.taskRunId, taskRun.id);
  assert.equal(client.calls.some((call) => call.startsWith("createBranch:")), true);

  const pr = await service.createRemotePullRequest(repo.id, {
    taskId: task.id,
    taskRunId: taskRun.id,
    branchLeaseId: branch.branchLease?.id,
    branchName: "ai/remote-git-v1",
    baseBranch: "main",
    title: "Remote Git v1 PR",
    body: "Fixture body"
  });
  assert.equal(pr.ok, true);
  assert.equal(pr.pullRequest?.externalId, "42");
  assert.equal(pr.mergeQueueEntry?.branchLeaseId, branch.branchLease?.id);
  assert.equal(client.calls.some((call) => call.startsWith("createPullRequest:")), true);

  const audit = service.listGitAuditEvents();
  assert.equal(audit.some((event) => event.action === "git.github_branch_created"), true);
  assert.equal(audit.some((event) => event.action === "git.github_pr_created"), true);
  assert.equal(JSON.stringify(audit).includes("ghp_fixturetoken"), false);
});

test("GitHub changed files read is gated, sanitized, and audited", async () => {
  const client = new FixtureGitHubClient();
  const { repo, service } = githubService(client);

  const changedFiles = await service.getPullRequestChangedFiles(repo.id, { pullRequestNumber: 42 });

  assert.equal(changedFiles.ok, true);
  assert.equal(changedFiles.changedFiles.some((file) => file.path === "src/auth/session.ts" && file.status === "modified"), true);
  assert.equal(client.calls.some((call) => call.startsWith("getPullRequestChangedFiles:")), true);
  assert.equal(service.listGitAuditEvents().some((event) => event.action === "git.github_changed_files_read"), true);
});

test("GitHub provider errors and audit metadata redact token-like strings", async () => {
  const client = new FixtureGitHubClient();
  client.throwOnCreateBranch = "upstream failed ghp_leaksecretvalue";
  const { repo, service } = githubService(client);

  const result = await service.createRemoteBranch(repo.id, { branchName: "ai/redaction", baseBranch: "main" });

  assert.equal(result.ok, false);
  assert.equal(result.reason?.includes("ghp_leaksecretvalue"), false);
  assert.equal(JSON.stringify(service.listGitAuditEvents()).includes("ghp_leaksecretvalue"), false);
});

test("Remote merge and rebase remain unsupported and policy-audited", () => {
  const client = new FixtureGitHubClient();
  const { repo, service } = githubService(client);

  const merge = service.blockUnsupportedRemoteOperation("merge", { repoId: repo.id, branchName: "ai/remote-git-v1" });
  const rebase = service.blockUnsupportedRemoteOperation("rebase", { repoId: repo.id, branchName: "ai/remote-git-v1" });

  assert.equal(merge.ok, false);
  assert.equal(merge.reason, "remote_merge_unsupported");
  assert.equal(rebase.ok, false);
  assert.equal(rebase.reason, "remote_rebase_unsupported");
  assert.equal(service.listGitAuditEvents().some((event) => event.action === "git.github_merge_attempt_blocked"), true);
  assert.equal(service.listGitAuditEvents().some((event) => event.action === "git.github_rebase_attempt_blocked"), true);
});

test("Git API remote endpoints and health are blocked by default without secrets", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health") as { git: Record<string, unknown> };
    assert.equal(health.git.remoteGitEnabled, false);
    assert.equal(health.git.remoteMergeEnabled, false);
    assert.equal(health.git.githubConfigured, false);
    assert.equal(JSON.stringify(health).includes("GITHUB_TOKEN"), false);

    const validate = await postJson(address.port, "/git/github/validate");
    assert.equal(validate.statusCode, 409);
    assert.equal(validate.body.reason, "remote_git_disabled");

    const branch = await postJson(address.port, "/git/repos/repo_demo_backend/branches/remote", {
      branchName: "ai/api-remote",
      baseBranch: "main"
    });
    assert.equal(branch.statusCode, 409);
    assert.equal(branch.body.reason, "remote_git_disabled");

    const pr = await postJson(address.port, "/git/repos/repo_demo_backend/pull-requests/remote", {
      taskId: "task_api_remote",
      branchName: "ai/api-remote",
      title: "Remote API PR"
    });
    assert.equal(pr.statusCode, 409);
    assert.equal(pr.body.reason, "remote_git_disabled");

    const changed = await getJson(address.port, "/git/repos/repo_demo_backend/pull-requests/42/changed-files");
    assert.equal(changed.ok, false);
    assert.equal(changed.reason, "remote_git_disabled");

    const audit = await getJson(address.port, "/git/remote/audit") as { auditEvents: Array<{ action: string }> };
    assert.equal(audit.auditEvents.some((event) => event.action === "git.github_branch_create_blocked"), true);
    assert.equal(JSON.stringify(audit).includes("GITHUB_TOKEN"), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

const remoteGitHubIntegrationReady = process.env.AICHESTRA_GITHUB_INTEGRATION_TESTS === "true" &&
  process.env.AICHESTRA_ENABLE_REMOTE_GIT === "true" &&
  process.env.AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE === "true" &&
  process.env.AICHESTRA_ALLOW_REMOTE_PR_CREATE === "true" &&
  Boolean(process.env.AICHESTRA_GITHUB_TOKEN) &&
  Boolean(process.env.AICHESTRA_GITHUB_ALLOWED_REPOS);

test("optional real GitHub integration is skipped unless every explicit remote gate is set", {
  skip: remoteGitHubIntegrationReady ? false : "remote GitHub integration env vars are not fully configured"
}, async () => {
  const { provider, config } = createGitProviderFromEnv();
  const [owner, name] = (process.env.AICHESTRA_GITHUB_ALLOWED_REPOS ?? "").split(",")[0]?.split("/") ?? [];
  assert.ok(owner);
  assert.ok(name);
  const store = createSeededStore();
  const repo = store.createRepo({ provider: "github", owner, name, defaultBranch: process.env.AICHESTRA_GITHUB_BASE_BRANCH ?? "main" });
  const service = new GitIntegrationService({ store, provider, config, policyService: new PolicyService() });
  const branchName = `${config.githubAllowedBranchPrefix ?? "ai/"}aichestra-v1-${Date.now()}`;
  const branch = await service.createRemoteBranch(repo.id, { branchName, baseBranch: repo.defaultBranch });
  assert.equal(branch.ok, true);
  const pr = await service.createRemotePullRequest(repo.id, {
    taskId: "task_real_github_optional",
    branchName,
    baseBranch: repo.defaultBranch,
    title: "Aichestra optional Real Git Adapter v1 validation"
  });
  assert.equal(pr.ok, true);
});
