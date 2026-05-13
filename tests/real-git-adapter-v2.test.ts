import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  GitHubGitProvider,
  GitIntegrationService,
  GitWebhookReceiverService,
  HmacGitHubWebhookVerifier,
  MockGitHubWebhookVerifier,
  NoopGitHubWebhookVerifier,
  createGitHubWebhookConfigFromEnv,
  createGitHubWebhookRuntimeFromEnv,
  supportedGitHubWebhookEvents
} from "@aichestra/git-adapter";
import type {
  GitChangedFile,
  GitHubBranch,
  GitHubClient,
  GitHubPullRequest,
  GitHubRepository,
  GitHubWebhookRuntimeConfig,
  GitProviderRuntimeConfig
} from "@aichestra/git-adapter";
import { PolicyService, StaticPolicyEngine, createPolicyContext, createPolicyResource, createPolicySubject } from "@aichestra/policy";

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
      head: "ai/pr-sync",
      base: "main",
      state: "open"
    };
  }

  async getPullRequestChangedFiles(owner: string, repo: string, number: number): Promise<GitChangedFile[]> {
    this.calls.push(`getPullRequestChangedFiles:${owner}/${repo}:${number}`);
    return [
      { path: "src/webhook.ts", status: "modified" },
      { path: "tests/webhook.test.ts", status: "added" }
    ];
  }
}

function webhookConfig(overrides: Partial<GitHubWebhookRuntimeConfig> = {}): GitHubWebhookRuntimeConfig {
  return {
    webhooksEnabled: true,
    webhookSecretConfigured: true,
    webhookSecretSource: "legacy_env",
    webhookSecretStatus: "resolved",
    webhookAllowedRepos: ["aichestra/demo-backend"],
    webhookAllowedRepoCount: 1,
    webhookIntegrationTestsEnabled: false,
    webhookAcceptUnverified: false,
    supportedWebhookEvents: [...supportedGitHubWebhookEvents],
    envSecretProviderEnabled: false,
    allowedSecretEnvKeyCount: 0,
    ...overrides
  };
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

function serviceFixture(configOverrides: Partial<GitHubWebhookRuntimeConfig> = {}) {
  const store = createSeededStore();
  const repo = store.createRepo({
    provider: "github",
    owner: "aichestra",
    name: "demo-backend",
    defaultBranch: "main"
  });
  const client = new FixtureGitHubClient();
  const gitConfig = githubConfig();
  const gitProvider = new GitHubGitProvider({
    remoteGitEnabled: gitConfig.remoteGitEnabled,
    remoteBranchCreateEnabled: gitConfig.remoteBranchCreateEnabled,
    remotePullRequestCreateEnabled: gitConfig.remotePullRequestCreateEnabled,
    token: "ghp_fixturetoken",
    owner: gitConfig.githubOwner,
    repo: gitConfig.githubRepo,
    allowedRepos: gitConfig.githubAllowedRepos,
    allowedBranchPrefix: gitConfig.githubAllowedBranchPrefix,
    integrationTestsEnabled: gitConfig.githubIntegrationTestsEnabled,
    client
  });
  const policyService = new PolicyService();
  const gitIntegrationService = new GitIntegrationService({
    store,
    provider: gitProvider,
    config: gitConfig,
    policyService
  });
  const receiver = new GitWebhookReceiverService({
    store,
    gitIntegrationService,
    config: webhookConfig(configOverrides),
    verifier: new MockGitHubWebhookVerifier(),
    policyService
  });
  return { store, repo, client, receiver };
}

function prPayload(action: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const merged = overrides.merged === true;
  return {
    action,
    repository: {
      full_name: "aichestra/demo-backend",
      owner: { login: "aichestra" },
      name: "demo-backend"
    },
    pull_request: {
      number: 42,
      id: 4200,
      state: action === "closed" ? "closed" : "open",
      merged,
      draft: false,
      head: { ref: "ai/pr-sync", sha: String(overrides.sha ?? "head-sha-1") },
      base: { ref: "main" },
      labels: [{ name: "safe-sync" }],
      mergeable_state: "clean",
      ...overrides
    },
    changed_files: ["src/webhook.ts", "tests/webhook.test.ts"]
  };
}

function webhookInput(eventType: string, deliveryId: string, payload: Record<string, unknown>, signatureHeader = "mock-valid") {
  return {
    headers: {
      "x-github-event": eventType,
      "x-github-delivery": deliveryId,
      "x-hub-signature-256": signatureHeader
    },
    rawBody: Buffer.from(JSON.stringify(payload))
  };
}

function sign(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
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

function postRaw(port: number, requestPath: string, body: string, headers: Record<string, string>): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: requestPath,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        ...headers
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
    request.end(body);
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

async function withEnv(env: Record<string, string | undefined>, run: () => Promise<void>): Promise<void> {
  const previous = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Real Git Adapter v2 webhook config is disabled by default and requires a secret when enabled", () => {
  const disabled = createGitHubWebhookConfigFromEnv({});
  const missingSecret = createGitHubWebhookRuntimeFromEnv({ AICHESTRA_ENABLE_GITHUB_WEBHOOKS: "true" });

  assert.equal(disabled.webhooksEnabled, false);
  assert.equal(disabled.webhookSecretConfigured, false);
  assert.equal(disabled.webhookAcceptUnverified, false);
  assert.equal(disabled.supportedWebhookEvents.includes("pull_request"), true);
  assert.equal(missingSecret.config.webhookSecretConfigured, false);
  assert.equal(missingSecret.config.webhookSecretStatus, "missing");
  assert.equal(missingSecret.verifier.getVerifierKind(), "noop");
  assert.equal(JSON.stringify(missingSecret.config).includes("webhook-secret-value"), false);
});

test("webhook verifier implementations accept valid fixtures and reject invalid signatures without exposing secrets", () => {
  const mock = new MockGitHubWebhookVerifier();
  assert.equal(mock.verify({ deliveryId: "delivery-valid", signatureHeader: "mock-valid", rawBody: "{}" }).verified, true);
  assert.equal(mock.verify({ deliveryId: "delivery-invalid", signatureHeader: "mock-invalid", rawBody: "{}" }).verified, false);

  const body = JSON.stringify({ zen: "fixture" });
  const hmac = new HmacGitHubWebhookVerifier({ enabled: true, secret: "webhook-secret-value" });
  assert.equal(hmac.verify({ deliveryId: "delivery-hmac", signatureHeader: sign("webhook-secret-value", body), rawBody: body }).verified, true);
  assert.equal(hmac.verify({ deliveryId: "delivery-hmac", signatureHeader: sign("wrong-secret", body), rawBody: body }).verified, false);
  assert.equal(JSON.stringify(hmac.verify({ deliveryId: "delivery-hmac", signatureHeader: "sha256=bad", rawBody: body })).includes("webhook-secret-value"), false);
});

test("webhook receiver blocks disabled, missing-secret, malformed, and unverified payloads", async () => {
  const disabled = serviceFixture({ webhooksEnabled: false });
  const disabledResult = await disabled.receiver.receiveGitHubWebhook(webhookInput("ping", "delivery-disabled", { repository: { full_name: "aichestra/demo-backend" } }));
  assert.equal(disabledResult.ok, false);
  assert.equal(disabledResult.reason, "github_webhooks_disabled");

  const missing = serviceFixture({ webhookSecretConfigured: false, webhookSecretStatus: "missing", webhookSecretReason: "github_webhook_secret_missing" });
  const missingResult = await missing.receiver.receiveGitHubWebhook(webhookInput("ping", "delivery-missing", { repository: { full_name: "aichestra/demo-backend" } }));
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.reason, "github_webhook_secret_missing");

  const unverified = serviceFixture();
  const unverifiedResult = await unverified.receiver.receiveGitHubWebhook(webhookInput("ping", "delivery-bad-signature", { repository: { full_name: "aichestra/demo-backend" } }, "mock-invalid"));
  assert.equal(unverifiedResult.ok, false);
  assert.equal(unverifiedResult.statusCode, 401);
  assert.equal(unverified.store.listGitWebhookAuditEvents().some((event) => event.eventType === "github_webhook_signature_rejected"), true);

  const malformed = serviceFixture();
  const malformedResult = await malformed.receiver.receiveGitHubWebhook({
    headers: {
      "x-github-event": "pull_request",
      "x-github-delivery": "delivery-malformed",
      "x-hub-signature-256": "mock-valid"
    },
    rawBody: Buffer.from("{not-json")
  });
  assert.equal(malformedResult.ok, false);
  assert.equal(malformedResult.reason, "malformed_json");
});

test("webhook receiver processes ping and ignores unsupported events with audit", async () => {
  const fixture = serviceFixture();
  const ping = await fixture.receiver.receiveGitHubWebhook(webhookInput("ping", "delivery-ping", { repository: { full_name: "aichestra/demo-backend" } }));
  assert.equal(ping.ok, true);
  assert.equal(ping.status, "processed");

  const unsupported = await fixture.receiver.receiveGitHubWebhook(webhookInput("issues", "delivery-issues", { repository: { full_name: "aichestra/demo-backend" } }));
  assert.equal(unsupported.ok, true);
  assert.equal(unsupported.status, "ignored");
  assert.equal(fixture.store.listGitWebhookAuditEvents().some((event) => event.eventType === "github_webhook_unsupported_event"), true);
});

test("webhook receiver ignores duplicate deliveries and rejects replay hash mismatches", async () => {
  const fixture = serviceFixture();
  const firstPayload = prPayload("opened", { sha: "head-sha-duplicate-1" });
  const first = await fixture.receiver.receiveGitHubWebhook(webhookInput("pull_request", "delivery-duplicate", firstPayload));
  assert.equal(first.ok, true);
  assert.equal(first.status, "processed");

  const duplicate = await fixture.receiver.receiveGitHubWebhook(webhookInput("pull_request", "delivery-duplicate", firstPayload));
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.statusCode, 202);
  assert.equal(duplicate.status, "ignored");
  assert.equal(duplicate.reason, "duplicate_delivery");
  assert.equal(fixture.store.listGitWebhookEvents({ deliveryId: "delivery-duplicate" }).length, 1);
  assert.equal(fixture.store.listGitWebhookAuditEvents().some((event) => event.eventType === "github_webhook_duplicate_ignored"), true);

  const replay = await fixture.receiver.receiveGitHubWebhook(webhookInput("pull_request", "delivery-duplicate", prPayload("opened", { sha: "head-sha-replay" })));
  assert.equal(replay.ok, false);
  assert.equal(replay.statusCode, 409);
  assert.equal(replay.status, "rejected");
  assert.equal(replay.reason, "replay_rejected");
  assert.equal(fixture.store.listGitWebhookEvents({ deliveryId: "delivery-duplicate" }).length, 1);
  assert.equal(fixture.store.listGitWebhookAuditEvents().some((event) =>
    event.eventType === "github_webhook_duplicate_rejected" &&
    event.reason === "replay_rejected"
  ), true);
});

test("pull_request webhook sync creates PR and branch sync read models and updates merge queue risk non-destructively", async () => {
  const fixture = serviceFixture();
  const task = fixture.store.createTask({ title: "Webhook PR sync", repoId: fixture.repo.id, baseBranch: "main" });
  const taskRun = fixture.store.createTaskRun({ taskId: task.id, attempt: 1, status: "running", agent: "codex", model: "mock-model" });
  const lease = fixture.store.createBranchLease({
    taskId: task.id,
    taskRunId: taskRun.id,
    repoId: fixture.repo.id,
    branchId: "branch_fixture",
    branchName: "ai/pr-sync",
    baseBranch: "main",
    files: ["src/existing.ts"],
    symbols: [],
    tests: [],
    status: "active"
  });
  const pullRequest = fixture.store.createPullRequest({
    taskId: task.id,
    repoId: fixture.repo.id,
    provider: "github",
    externalId: "42",
    url: "https://github.example.invalid/aichestra/demo-backend/pull/42",
    status: "open"
  });
  const queue = fixture.store.createMergeQueueEntry({
    repoId: fixture.repo.id,
    taskId: task.id,
    taskRunId: taskRun.id,
    branchLeaseId: lease.id,
    pullRequestId: pullRequest.id,
    pullRequestUrl: pullRequest.url ?? "",
    branchName: lease.branchName,
    priority: 100,
    riskScore: 0
  });

  const opened = await fixture.receiver.receiveGitHubWebhook(webhookInput("pull_request", "delivery-pr-opened", prPayload("opened")));
  assert.equal(opened.ok, true);
  const openedState = fixture.store.getGitPullRequestSyncState("aichestra/demo-backend", 42);
  assert.equal(openedState?.pullRequestId, pullRequest.id);
  assert.equal(openedState?.taskRunId, taskRun.id);
  assert.equal(openedState?.branchLeaseId, lease.id);
  assert.equal(openedState?.mergeQueueEntryId, queue.id);
  assert.equal(openedState?.changedFiles.includes("tests/webhook.test.ts"), true);
  assert.equal(fixture.store.getBranchLease(lease.id)?.files.includes("src/webhook.ts"), true);
  assert.equal(fixture.store.getGitBranchSyncState("aichestra/demo-backend", "ai/pr-sync")?.exists, true);

  const synchronized = await fixture.receiver.receiveGitHubWebhook(webhookInput("pull_request", "delivery-pr-sync", prPayload("synchronize", { sha: "head-sha-2" })));
  assert.equal(synchronized.ok, true);
  assert.equal(fixture.store.getGitPullRequestSyncState("aichestra/demo-backend", 42)?.latestSha, "head-sha-2");

  const closed = await fixture.receiver.receiveGitHubWebhook(webhookInput("pull_request", "delivery-pr-closed", prPayload("closed", { merged: true })));
  assert.equal(closed.ok, true);
  assert.equal(fixture.store.getGitPullRequestSyncState("aichestra/demo-backend", 42)?.state, "merged");
  assert.equal(fixture.store.listGitWebhookAuditEvents().some((event) => event.eventType === "github_pr_sync_completed"), true);
});

test("push webhook updates branch sync metadata without deleting branches", async () => {
  const fixture = serviceFixture();
  const deletedPush = await fixture.receiver.receiveGitHubWebhook(webhookInput("push", "delivery-push", {
    repository: { full_name: "aichestra/demo-backend" },
    ref: "refs/heads/ai/pr-sync",
    after: "0000000000000000000000000000000000000000",
    deleted: true
  }));
  assert.equal(deletedPush.ok, true);
  const state = fixture.store.getGitBranchSyncState("aichestra/demo-backend", "ai/pr-sync");
  assert.equal(state?.exists, false);
  assert.equal(fixture.store.listBranchLeases(fixture.repo.id).length, 0);
});

test("manual PR sync and changed-file refresh are policy-gated and use GitHubClient only when safe", async () => {
  const fixture = serviceFixture();
  fixture.store.createPullRequest({
    taskId: "task_manual_sync",
    repoId: fixture.repo.id,
    provider: "github",
    externalId: "42",
    url: "https://github.example.invalid/aichestra/demo-backend/pull/42",
    status: "open"
  });
  const manual = fixture.receiver.manualSyncPullRequest(fixture.repo.id, 42);
  assert.equal(manual.ok, true);

  const refresh = await fixture.receiver.refreshChangedFiles(fixture.repo.id, 42);
  assert.equal(refresh.ok, true);
  assert.equal(refresh.changedFiles?.some((file) => file.path === "src/webhook.ts"), true);
  assert.equal(fixture.client.calls.some((call) => call.startsWith("getPullRequestChangedFiles:")), true);

  const denied = serviceFixture({ webhookAllowedRepos: ["aichestra/other"], webhookAllowedRepoCount: 1 });
  denied.store.createPullRequest({
    taskId: "task_denied_sync",
    repoId: denied.repo.id,
    provider: "github",
    externalId: "42",
    url: "https://github.example.invalid/aichestra/demo-backend/pull/42",
    status: "open"
  });
  const deniedManual = denied.receiver.manualSyncPullRequest(denied.repo.id, 42);
  assert.equal(deniedManual.ok, false);
  assert.equal(deniedManual.reason, "policy_denied");
});

test("policy defaults deny unverified webhooks, merge, and rebase while allowing verified read-model sync", () => {
  const engine = new StaticPolicyEngine();
  const subject = createPolicySubject({ actorId: "v2-policy-test", actorKind: "service", roles: ["system"] });
  const unverified = engine.evaluate({
    subject,
    action: "git.webhook.process",
    resource: createPolicyResource({ resourceKind: "git_operation", resourceId: "aichestra/demo-backend", metadata: { providerKind: "github" } }),
    context: createPolicyContext({ providerKind: "github", environment: { githubWebhooksEnabled: true, signatureVerified: false, repoAllowlisted: true, secretConfigured: true } })
  });
  const verified = engine.evaluate({
    subject,
    action: "git.webhook.process",
    resource: createPolicyResource({ resourceKind: "git_operation", resourceId: "aichestra/demo-backend", metadata: { providerKind: "github" } }),
    context: createPolicyContext({ providerKind: "github", environment: { githubWebhooksEnabled: true, signatureVerified: true, repoAllowlisted: true, secretConfigured: true } })
  });
  const merge = engine.evaluate({
    subject,
    action: "git.merge",
    resource: createPolicyResource({ resourceKind: "git_operation", resourceId: "aichestra/demo-backend", metadata: { providerKind: "github" } }),
    context: createPolicyContext({ providerKind: "github" })
  });
  const rebase = engine.evaluate({
    subject,
    action: "git.rebase",
    resource: createPolicyResource({ resourceKind: "git_operation", resourceId: "aichestra/demo-backend", metadata: { providerKind: "github" } }),
    context: createPolicyContext({ providerKind: "github" })
  });

  assert.equal(unverified.allowed, false);
  assert.equal(verified.allowed, true);
  assert.equal(merge.allowed, false);
  assert.equal(rebase.allowed, false);
});

test("GitHub webhook API is disabled by default and exposes no secrets in health, config, or dashboard", async () => {
  await withApiServer(async (port) => {
    const payload = JSON.stringify({ repository: { full_name: "demo/backend" } });
    const response = await postRaw(port, "/git/github/webhooks", payload, {
      "x-github-event": "ping",
      "x-github-delivery": "delivery-default",
      "x-hub-signature-256": "sha256=invalid"
    });
    const health = await getJson(port, "/health");
    const config = await getJson(port, "/git/github/webhooks/config");
    const dashboard = await getJson(port, "/dashboard/git");

    assert.equal(response.statusCode, 409);
    assert.equal(response.body.reason, "github_webhooks_disabled");
    assert.equal(((health.git as Record<string, unknown>).githubWebhooksEnabled), false);
    assert.equal(((health.git as Record<string, unknown>).githubWebhookSecretConfigured), false);
    assert.equal(((dashboard.git as Record<string, unknown>).webhookConfig as Record<string, unknown>).webhooksEnabled, false);
    assert.equal(JSON.stringify({ health, config, dashboard }).includes("AICHESTRA_GITHUB_WEBHOOK_SECRET"), false);
    assert.equal(JSON.stringify({ health, config, dashboard }).includes("ghp_fixturetoken"), false);
  });
});

test("GitHub webhook API accepts verified HMAC payloads and exposes events, sync states, and audit safely", async () => {
  await withEnv({
    AICHESTRA_ENABLE_GITHUB_WEBHOOKS: "true",
    AICHESTRA_GITHUB_WEBHOOK_SECRET: "webhook-secret-value",
    AICHESTRA_GITHUB_WEBHOOK_ALLOWED_REPOS: "demo/backend"
  }, async () => {
    await withApiServer(async (port) => {
      const pingBody = JSON.stringify({ repository: { full_name: "demo/backend" } });
      const ping = await postRaw(port, "/git/github/webhooks", pingBody, {
        "x-github-event": "ping",
        "x-github-delivery": "delivery-api-ping",
        "x-hub-signature-256": sign("webhook-secret-value", pingBody)
      });
      const bad = await postRaw(port, "/git/github/webhooks", pingBody, {
        "x-github-event": "ping",
        "x-github-delivery": "delivery-api-bad",
        "x-hub-signature-256": "sha256=bad"
      });
      const events = await getJson(port, "/git/github/webhooks/events") as { events: unknown[] };
      const audit = await getJson(port, "/git/github/webhooks/audit") as { auditEvents: unknown[] };
      const dashboard = await getJson(port, "/dashboard/git");

      assert.equal(ping.statusCode, 202);
      assert.equal(ping.body.ok, true);
      assert.equal(bad.statusCode, 401);
      assert.equal(events.events.length >= 1, true);
      assert.equal(audit.auditEvents.length >= 1, true);
      assert.equal(((dashboard.git as Record<string, unknown>).webhookEvents as unknown[]).length >= 1, true);
      assert.equal(JSON.stringify({ ping, bad, events, audit, dashboard }).includes("webhook-secret-value"), false);
    });
  });
});

const remoteWebhookIntegrationReady = process.env.AICHESTRA_GITHUB_WEBHOOK_INTEGRATION_TESTS === "true" &&
  process.env.AICHESTRA_ENABLE_GITHUB_WEBHOOKS === "true" &&
  Boolean(process.env.AICHESTRA_GITHUB_WEBHOOK_SECRET || process.env.AICHESTRA_GITHUB_WEBHOOK_SECRET_REF) &&
  Boolean(process.env.AICHESTRA_GITHUB_WEBHOOK_ALLOWED_REPOS);

test("optional real GitHub webhook integration is skipped unless every explicit webhook gate is set", {
  skip: remoteWebhookIntegrationReady ? false : "real GitHub webhook integration env vars are not fully configured"
}, () => {
  assert.equal(remoteWebhookIntegrationReady, true);
});
