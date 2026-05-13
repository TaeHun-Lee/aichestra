import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  DisabledGitHubAppTokenProvider,
  GitHubAppRuntimeService,
  GitHubGitProvider,
  GitIntegrationService,
  MockGitHubAppTokenProvider,
  createGitHubAppRuntimeConfigFromEnv,
  createGitHubInstallationTokenRequest,
  createGitHubWebhookConfigFromEnv,
  createGitProviderConfigFromEnv,
  sanitizeGitHubAppMetadata
} from "@aichestra/git-adapter";
import type {
  GitChangedFile,
  GitHubBranch,
  GitHubClient,
  GitHubPullRequest,
  GitHubRepository,
  GitProviderRuntimeConfig
} from "@aichestra/git-adapter";
import { PolicyService } from "@aichestra/policy";

class FixtureGitHubClient implements GitHubClient {
  readonly calls: string[] = [];

  async validateConnection(): Promise<{ ok: boolean; message: string }> {
    this.calls.push("validateConnection");
    return { ok: true, message: "fixture connection" };
  }

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    this.calls.push(`getRepository:${owner}/${repo}`);
    return { owner, name: repo, defaultBranch: "main" };
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<GitHubBranch> {
    this.calls.push(`getBranch:${owner}/${repo}:${branch}`);
    return { name: branch, sha: "base-sha" };
  }

  async createBranch(owner: string, repo: string, baseBranch: string, newBranch: string): Promise<GitHubBranch> {
    this.calls.push(`createBranch:${owner}/${repo}:${baseBranch}:${newBranch}`);
    return { name: newBranch, sha: "branch-sha" };
  }

  async createPullRequest(owner: string, repo: string, title: string, head: string, base: string): Promise<GitHubPullRequest> {
    this.calls.push(`createPullRequest:${owner}/${repo}:${head}:${base}:${title}`);
    return {
      number: 7,
      id: 700,
      htmlUrl: `https://github.example.invalid/${owner}/${repo}/pull/7`,
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
      head: "ai/app-token",
      base: "main",
      state: "open"
    };
  }

  async getPullRequestChangedFiles(owner: string, repo: string, number: number): Promise<GitChangedFile[]> {
    this.calls.push(`getPullRequestChangedFiles:${owner}/${repo}:${number}`);
    return [{ path: "src/app-token.ts", status: "modified" }];
  }
}

function hasUnsafeSecret(value: unknown): boolean {
  const text = JSON.stringify(value);
  return text.includes("ghp_") ||
    text.includes("github_pat_") ||
    text.includes("ghs_") ||
    text.includes("-----BEGIN") ||
    text.includes("PRIVATE KEY") ||
    text.includes("installation-token-secret") ||
    text.includes("webhook-secret-value") ||
    text.includes("AICHESTRA_GITHUB_WEBHOOK_SECRET=");
}

function appEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    AICHESTRA_GIT_PROVIDER: "github",
    AICHESTRA_ENABLE_REMOTE_GIT: "true",
    AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE: "true",
    AICHESTRA_ALLOW_REMOTE_PR_CREATE: "true",
    AICHESTRA_GITHUB_AUTH_MODE: "github_app",
    AICHESTRA_ENABLE_GITHUB_APP: "true",
    AICHESTRA_GITHUB_APP_ID: "12345",
    AICHESTRA_GITHUB_APP_SLUG: "aichestra-fixture",
    AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF: "secretref_github_app_private_key",
    AICHESTRA_GITHUB_APP_WEBHOOK_SECRET_REF: "secretref_github_app_webhook",
    AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS: "98765",
    AICHESTRA_GITHUB_APP_ALLOWED_REPOS: "aichestra/demo-backend",
    AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX: "ai/",
    ...overrides
  };
}

function tokenRequest(overrides: Record<string, unknown> = {}) {
  return createGitHubInstallationTokenRequest({
    appConfigId: "github_app_runtime_config",
    installationId: "98765",
    repoRef: "aichestra/demo-backend",
    purpose: "branch_create",
    policyContext: {},
    metadata: {},
    ...overrides
  });
}

function configuredAppService(configOverrides: Partial<GitProviderRuntimeConfig> = {}) {
  const store = createSeededStore();
  const repo = store.createRepo({
    provider: "github",
    owner: "aichestra",
    name: "demo-backend",
    defaultBranch: "main"
  });
  const policyService = new PolicyService();
  const gitConfig = {
    ...createGitProviderConfigFromEnv(appEnv()),
    ...configOverrides
  };
  const client = new FixtureGitHubClient();
  const provider = new GitHubGitProvider({
    remoteGitEnabled: gitConfig.remoteGitEnabled,
    remoteBranchCreateEnabled: gitConfig.remoteBranchCreateEnabled,
    remotePullRequestCreateEnabled: gitConfig.remotePullRequestCreateEnabled,
    configured: true,
    authMode: "github_app",
    owner: "aichestra",
    repo: "demo-backend",
    allowedRepos: ["aichestra/demo-backend"],
    allowedBranchPrefix: "ai/",
    client
  });
  const githubAppService = new GitHubAppRuntimeService({
    store,
    config: gitConfig.githubApp ?? createGitHubAppRuntimeConfigFromEnv(appEnv()),
    policyService,
    secretRefMetadataResolver: () => ({
      id: "secretref_github_app_private_key",
      secretKind: "github_app_private_key",
      status: "active"
    }),
    authorizationChecker: () => ({
      allowed: true,
      reason: "fixture_auth_allowed"
    })
  });
  const gitService = new GitIntegrationService({
    store,
    provider,
    config: gitConfig,
    policyService,
    githubAppTokenIssuer: githubAppService
  });
  return { store, repo, client, gitService, githubAppService };
}

async function withEnv<T>(env: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    previous[key] = process.env[key];
    if (env[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = env[key];
    }
  }
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function getJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown> });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  const text = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(text)
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown> });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(text);
  });
}

async function withApiServer(run: (port: number) => Promise<void>): Promise<void> {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    await run(address.port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("GitHub App config gates are disabled by default and reject incomplete app mode", () => {
  const disabled = createGitProviderConfigFromEnv({});
  const missingEnable = createGitProviderConfigFromEnv(appEnv({ AICHESTRA_ENABLE_GITHUB_APP: "false" }));
  const missingAppId = createGitProviderConfigFromEnv(appEnv({ AICHESTRA_GITHUB_APP_ID: undefined }));
  const missingPrivateKeyRef = createGitProviderConfigFromEnv(appEnv({ AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF: undefined }));
  const missingInstallation = createGitProviderConfigFromEnv(appEnv({ AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS: undefined }));
  const missingRepo = createGitProviderConfigFromEnv(appEnv({ AICHESTRA_GITHUB_APP_ALLOWED_REPOS: undefined }));
  const rawPrivateKeyEnv = createGitProviderConfigFromEnv(appEnv({ GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----fake-----END PRIVATE KEY-----" }));

  assert.equal(disabled.githubAuthMode, "legacy_token");
  assert.equal(disabled.githubApp?.enabled, false);
  assert.equal(missingEnable.githubConfigured, false);
  assert.equal(missingEnable.githubCredentialReason, "github_app_disabled");
  assert.equal(missingAppId.githubApp?.blockedReasons.includes("github_app_id_missing"), true);
  assert.equal(missingPrivateKeyRef.githubApp?.blockedReasons.includes("github_app_private_key_secret_ref_missing"), true);
  assert.equal(missingInstallation.githubApp?.blockedReasons.includes("github_app_installation_allowlist_missing"), true);
  assert.equal(missingRepo.githubApp?.blockedReasons.includes("github_app_repo_allowlist_missing"), true);
  assert.equal(rawPrivateKeyEnv.githubApp?.blockedReasons.includes("github_app_private_key_env_unsupported"), true);
  assert.equal(hasUnsafeSecret(rawPrivateKeyEnv), false);
});

test("mock GitHub App token provider issues handle metadata only and blocks missing or revoked SecretRefs", () => {
  const config = createGitHubAppRuntimeConfigFromEnv(appEnv());
  const disabled = new DisabledGitHubAppTokenProvider().createInstallationToken(tokenRequest());
  const issued = new MockGitHubAppTokenProvider({
    config,
    secretRefMetadataResolver: () => ({ id: "secretref_github_app_private_key", secretKind: "github_app_private_key", status: "active" })
  }).createInstallationToken(tokenRequest());
  const missing = new MockGitHubAppTokenProvider({
    config,
    secretRefMetadataResolver: () => undefined
  }).createInstallationToken(tokenRequest());
  const revoked = new MockGitHubAppTokenProvider({
    config,
    secretRefMetadataResolver: () => ({ id: "secretref_github_app_private_key", secretKind: "github_app_private_key", status: "revoked" })
  }).createInstallationToken(tokenRequest());
  const policyDenied = new MockGitHubAppTokenProvider({
    config,
    secretRefMetadataResolver: () => ({ id: "secretref_github_app_private_key", secretKind: "github_app_private_key", status: "active" })
  }).createInstallationToken(tokenRequest({ repoRef: "evil/repo" }));

  assert.equal(disabled.status, "blocked");
  assert.equal(issued.status, "issued_mock");
  assert.equal(typeof issued.tokenHandleId, "string");
  assert.equal(JSON.stringify(issued).includes("installation-token-secret"), false);
  assert.equal(JSON.stringify(issued).includes("ghs_"), false);
  assert.equal(missing.status, "missing_secret");
  assert.equal(revoked.status, "denied");
  assert.equal(revoked.metadata.reason, "github_app_private_key_secret_ref_revoked");
  assert.equal(policyDenied.status, "denied");
  assert.equal(typeof policyDenied.policyDecisionId, "string");
  assert.equal(hasUnsafeSecret({ issued, missing, revoked, policyDenied }), false);
});

test("Auth/RBAC denial blocks before SecretRef metadata lookup", () => {
  const config = createGitHubAppRuntimeConfigFromEnv(appEnv());
  let secretLookupCount = 0;
  const denied = new MockGitHubAppTokenProvider({
    config,
    authorizationChecker: () => ({ allowed: false, reason: "permission_denied:github_app.installation_token.issue" }),
    secretRefMetadataResolver: () => {
      secretLookupCount += 1;
      return { id: "secretref_github_app_private_key", secretKind: "github_app_private_key", status: "active" };
    }
  }).createInstallationToken(tokenRequest({ actorId: "user_demo_developer" }));

  assert.equal(denied.status, "denied");
  assert.match(String(denied.metadata.reason), /authorization_denied/);
  assert.equal(secretLookupCount, 0);
});

test("GitHub provider uses mock GitHub App token handle for branch, PR, and changed-file operations", async () => {
  const { repo, client, gitService } = configuredAppService();
  const branch = await gitService.createBranch(repo.id, {
    taskId: "task_github_app",
    taskRunId: "run_github_app",
    branchName: "ai/app-token",
    baseBranch: "main"
  });
  const pr = await gitService.createPullRequest(repo.id, {
    taskId: "task_github_app",
    taskRunId: "run_github_app",
    branchName: "ai/app-token",
    baseBranch: "main",
    title: "GitHub App token PR"
  });
  const changedFiles = await gitService.getPullRequestChangedFiles(repo.id, { pullRequestNumber: 7 });
  const merge = gitService.blockUnsupportedRemoteOperation("merge", { repoId: repo.id, branchName: "ai/app-token" });
  const rebase = gitService.blockUnsupportedRemoteOperation("rebase", { repoId: repo.id, branchName: "ai/app-token" });
  const appAudit = gitService.listGitAuditEvents().filter((event) => event.action.includes("github_app_"));

  assert.equal(branch.ok, true);
  assert.equal(pr.ok, true);
  assert.equal(changedFiles.ok, true);
  assert.deepEqual(client.calls.filter((call) => call.startsWith("createBranch")).length, 1);
  assert.deepEqual(client.calls.filter((call) => call.startsWith("createPullRequest")).length, 1);
  assert.deepEqual(client.calls.filter((call) => call.startsWith("getPullRequestChangedFiles")).length, 1);
  assert.equal(merge.ok, false);
  assert.equal(merge.reason, "remote_merge_unsupported");
  assert.equal(rebase.ok, false);
  assert.equal(rebase.reason, "remote_rebase_unsupported");
  assert.equal(appAudit.some((event) => event.action === "git.github_app_token_issued_mock"), true);
  assert.equal(appAudit.some((event) => event.action === "git.github_app_operation_used_for_branch_create"), true);
  assert.equal(appAudit.some((event) => event.action === "git.github_app_operation_used_for_pr_create"), true);
  assert.equal(appAudit.some((event) => event.action === "git.github_app_operation_used_for_changed_files"), true);
  assert.equal(hasUnsafeSecret(appAudit), false);
});

test("GitHub App webhook SecretRef path is recognized without exposing secret values", () => {
  const config = createGitHubWebhookConfigFromEnv(appEnv({
    AICHESTRA_ENABLE_GITHUB_WEBHOOKS: "true",
    AICHESTRA_GITHUB_WEBHOOK_SECRET_REF: undefined,
    AICHESTRA_GITHUB_WEBHOOK_SECRET: undefined,
    AICHESTRA_GITHUB_WEBHOOK_ALLOWED_REPOS: "aichestra/demo-backend"
  }));

  assert.equal(config.webhookSecretConfigured, true);
  assert.equal(config.webhookSecretRef, "secretref_github_app_webhook");
  assert.equal(config.webhookSecretSource, "secret_ref");
  assert.equal(hasUnsafeSecret(config), false);
});

test("GitHub App controlled API, health, and dashboard return status-only sanitized data", async () => {
  await withEnv(appEnv(), async () => {
    await withApiServer(async (port) => {
      const config = await getJson(port, "/git/github-app/config");
      const installations = await getJson(port, "/git/github-app/installations");
      const grants = await getJson(port, "/git/github-app/repository-grants");
      const validation = await postJson(port, "/git/github-app/validate");
      const tokenCheck = await postJson(port, "/git/github-app/installations/98765/token/check", {
        repoRef: "aichestra/demo-backend",
        purpose: "branch_create"
      });
      const audit = await getJson(port, "/git/github-app/audit");
      const health = await getJson(port, "/health");
      const dashboard = await getJson(port, "/dashboard/github-app");

      assert.equal(config.statusCode, 200);
      assert.equal((config.body.config as Record<string, unknown>).authMode, "github_app");
      assert.equal((config.body.config as Record<string, unknown>).privateKeySecretRefConfigured, true);
      assert.equal((config.body.config as Record<string, unknown>).tokensExposed, false);
      assert.equal(installations.statusCode, 200);
      assert.equal((installations.body.installations as unknown[]).length, 1);
      assert.equal(grants.statusCode, 200);
      assert.equal((grants.body.repositoryGrants as unknown[]).length, 1);
      assert.equal(validation.statusCode, 200);
      assert.equal(tokenCheck.statusCode, 200);
      assert.equal(((tokenCheck.body.result as Record<string, unknown>).status), "missing_secret");
      assert.equal(audit.statusCode, 200);
      assert.equal(((health.body.git as Record<string, unknown>).githubAuthMode), "github_app");
      assert.equal(((health.body.git as Record<string, unknown>).githubAppPrivateKeySecretRefConfigured), true);
      const panel = dashboard.body.githubApp as Record<string, unknown>;
      assert.equal((panel.runtimeConfig as Record<string, unknown>).authMode, "github_app");
      assert.equal((panel.controlledImplementation as Record<string, unknown>).tokenExchangeEnabled, false);
      assert.equal((panel.noSecretStatus as Record<string, unknown>).noSecretsExposed, true);
      assert.equal(hasUnsafeSecret({ config, installations, grants, validation, tokenCheck, audit, health, dashboard }), false);
    });
  });
});

test("GitHub App audit sanitizer redacts private keys and token-like strings", () => {
  const sanitized = sanitizeGitHubAppMetadata({
    privateKey: "-----BEGIN PRIVATE KEY-----fake-----END PRIVATE KEY-----",
    installationToken: "ghs_installation-token-secret",
    webhookSecret: "AICHESTRA_GITHUB_WEBHOOK_SECRET=webhook-secret-value",
    githubToken: "ghp_secretfixture",
    tokenHandleId: "ghapp_token_handle_safe"
  }) as Record<string, unknown>;

  assert.equal(sanitized.privateKey, "[redacted]");
  assert.equal(sanitized.installationToken, "[redacted]");
  assert.equal(sanitized.webhookSecret, "[redacted]");
  assert.equal(sanitized.githubToken, "[redacted]");
  assert.equal(sanitized.tokenHandleId, "ghapp_token_handle_safe");
  assert.equal(hasUnsafeSecret(sanitized), false);
});
