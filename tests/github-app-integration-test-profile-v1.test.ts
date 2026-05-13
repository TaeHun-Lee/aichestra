import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-14T00:00:00.000Z");

function hasSecretOrEnvValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /ghp_github_app_it|github_pat_|sk-github-app-it|-----BEGIN PRIVATE KEY-----|app-private-key-value|installation-token-value|webhook-secret-value|Bearer\s+github-app-it|postgres:\/\/|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|SESSION_SECRET=|JWT_SECRET=|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
}

function getJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "2"
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end("{}");
  });
}

async function withApiServer(run: (port: number) => Promise<void>, envPatch: Record<string, string | undefined> = {}): Promise<void> {
  const previousEnv = new Map(Object.keys(envPatch).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(envPatch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("GitHub App integration-test readiness models are disabled by default and expose no secrets", () => {
  const service = createDeploymentReadinessService({
    env: {
      GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY----- app-private-key-value",
      AICHESTRA_GITHUB_TOKEN: "ghp_github_app_it_token",
      AICHESTRA_GITHUB_WEBHOOK_SECRET: "webhook-secret-value",
      SESSION_SECRET: "sk-github-app-it-session"
    },
    now: () => fixedNow
  });

  const profile = service.getGitHubAppIntegrationTestProfile();
  const testCases = service.listGitHubAppIntegrationTestCases();
  const safetyChecks = service.listGitHubAppIntegrationTestSafetyChecks();
  const branchChecks = service.listGitHubAppIntegrationTestSafetyChecks({ category: "branch_prefix" });
  const summary = service.getGitHubAppIntegrationTestReadinessSummary();

  assert.equal(profile.status, "blocked");
  assert.equal(profile.allowedBranchPrefix, "ai/");
  assert.equal(profile.forbiddenOperations.includes("auto_merge"), true);
  assert.equal(profile.forbiddenOperations.includes("force_push"), true);
  assert.equal(profile.forbiddenOperations.includes("branch_delete"), true);
  assert.equal(testCases.some((testCase) => testCase.category === "webhook_fixture" && testCase.enabledByDefault), true);
  assert.equal(testCases.some((testCase) => testCase.category === "branch_create" && testCase.requiresLiveGitHub), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_auto_merge" && check.status === "pass"), true);
  assert.equal(branchChecks.every((check) => check.category === "branch_prefix"), true);
  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.liveTestsEnabled, false);
  assert.equal(summary.canRunLiveTests, false);
  assert.equal(summary.defaultLiveTestsSkipped, true);
  assert.equal(summary.missingGateCount, summary.requiredGateCount);
  assert.equal(summary.unsafeGateWarnings.includes("raw_github_app_private_key_env_unsupported"), true);
  assert.equal(summary.allowedRepoCount, 0);
  assert.equal(summary.allowedBranchPrefix, "ai/");
  assert.equal(summary.webhookFixtureTestsEnabled, true);
  assert.equal(summary.noAutoMerge, true);
  assert.equal(summary.noForcePush, true);
  assert.equal(summary.noBranchDelete, true);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(summary.privateKeyExposed, false);
  assert.equal(summary.installationTokenExposed, false);
  assert.equal(summary.githubCallsInDefaultTests, false);
  assert.equal(hasSecretOrEnvValue({ profile, testCases, safetyChecks, summary }), false);
});

test("GitHub App integration-test profile can become runnable only when all explicit gates are configured", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_GITHUB_APP_INTEGRATION_TESTS: "true",
      AICHESTRA_ENABLE_REMOTE_GIT: "true",
      AICHESTRA_GITHUB_AUTH_MODE: "github_app",
      AICHESTRA_ENABLE_GITHUB_APP: "true",
      AICHESTRA_GITHUB_APP_ID: "123456",
      AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF: "secretref:github-app-private-key",
      AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS: "42",
      AICHESTRA_GITHUB_APP_ALLOWED_REPOS: "owner/test-repo",
      AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX: "ai/",
      AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE: "true",
      AICHESTRA_ALLOW_REMOTE_PR_CREATE: "true",
      AICHESTRA_ALLOW_REMOTE_MERGE: "false",
      AICHESTRA_GITHUB_WEBHOOK_SECRET_REF: "secretref:webhook",
      AICHESTRA_ENABLE_GITHUB_WEBHOOKS: "true",
      AICHESTRA_GITHUB_WEBHOOK_ACCEPT_UNVERIFIED: "false",
      GITHUB_APP_PRIVATE_KEY: undefined
    },
    now: () => fixedNow
  });

  const summary = service.getGitHubAppIntegrationTestReadinessSummary();
  const profile = service.getGitHubAppIntegrationTestProfile();
  const safetyChecks = service.listGitHubAppIntegrationTestSafetyChecks();

  assert.equal(summary.liveTestsEnabled, true);
  assert.equal(summary.canRunLiveTests, true);
  assert.equal(summary.missingGateCount, 0);
  assert.equal(summary.unsafeGateCount, 0);
  assert.equal(summary.allowedRepoCount, 1);
  assert.equal(summary.branchPrefixMatchesRequired, true);
  assert.equal(summary.configuredSecretRefCount, 2);
  assert.equal(summary.liveWebhookTestsEnabled, true);
  assert.equal(profile.status, "ready_if_configured");
  assert.deepEqual(profile.allowedRepos, ["configured_repo_allowlist_redacted"]);
  assert.equal(safetyChecks.every((check) => check.status === "pass"), true);
  assert.equal(hasSecretOrEnvValue({ summary, profile, safetyChecks }), false);
});

test("GitHub App integration-test readiness flags unsafe merge and branch-prefix gates", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_GITHUB_APP_INTEGRATION_TESTS: "true",
      AICHESTRA_ENABLE_REMOTE_GIT: "true",
      AICHESTRA_GITHUB_AUTH_MODE: "github_app",
      AICHESTRA_ENABLE_GITHUB_APP: "true",
      AICHESTRA_GITHUB_APP_ID: "123456",
      AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF: "secretref:github-app-private-key",
      AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS: "42",
      AICHESTRA_GITHUB_APP_ALLOWED_REPOS: "owner/test-repo",
      AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX: "feature/",
      AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE: "true",
      AICHESTRA_ALLOW_REMOTE_PR_CREATE: "true",
      AICHESTRA_ALLOW_REMOTE_MERGE: "true"
    },
    now: () => fixedNow
  });

  const summary = service.getGitHubAppIntegrationTestReadinessSummary();
  const safetyChecks = service.listGitHubAppIntegrationTestSafetyChecks();

  assert.equal(summary.canRunLiveTests, false);
  assert.equal(summary.unsafeGateWarnings.includes("remote_merge_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("branch_prefix_mismatch"), true);
  assert.equal(summary.branchPrefixMatchesRequired, false);
  assert.equal(safetyChecks.some((check) => check.category === "no_auto_merge" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "branch_prefix" && check.status === "fail"), true);
  assert.equal(hasSecretOrEnvValue({ summary, safetyChecks }), false);
});

test("GitHub App integration-test readiness APIs and health metadata are read-only and sanitized", async () => {
  await withApiServer(async (port) => {
    const profile = await getJson(port, "/readiness/github-app-integration/profile");
    const testCases = await getJson(port, "/readiness/github-app-integration/test-cases");
    const safetyChecks = await getJson(port, "/readiness/github-app-integration/safety-checks?category=no_auto_merge");
    const summary = await getJson(port, "/readiness/github-app-integration/summary");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/github-app-integration/summary");

    assert.equal(profile.statusCode, 200);
    assert.equal((profile.body.profile as Record<string, unknown>).status, "blocked");
    assert.equal(testCases.statusCode, 200);
    assert.equal((testCases.body.testCases as unknown[]).length > 0, true);
    assert.equal(safetyChecks.statusCode, 200);
    assert.equal((safetyChecks.body.safetyChecks as Array<Record<string, unknown>>).every((check) => check.category === "no_auto_merge"), true);
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).productionReady, false);
    assert.equal((summary.body.summary as Record<string, unknown>).canRunLiveTests, false);
    assert.equal((summary.body.summary as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((summary.body.summary as Record<string, unknown>).envValuesExposed, false);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.githubAppIntegrationTests as Record<string, unknown>).enabled, true);
    assert.equal((health.body.githubAppIntegrationTests as Record<string, unknown>).canRunLiveTests, false);
    assert.equal((health.body.githubAppIntegrationTests as Record<string, unknown>).unsafeGatesCount, 2);
    assert.equal((health.body.githubAppIntegrationTests as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((health.body.githubAppIntegrationTests as Record<string, unknown>).envValuesExposed, false);
    assert.equal((health.body.githubAppIntegrationTests as Record<string, unknown>).privateKeyExposed, false);
    assert.equal((health.body.githubAppIntegrationTests as Record<string, unknown>).installationTokenExposed, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasSecretOrEnvValue({ profile, testCases, safetyChecks, summary, health }), false);
  }, {
    AICHESTRA_GITHUB_APP_INTEGRATION_TESTS: "true",
    AICHESTRA_ALLOW_REMOTE_MERGE: "true",
    GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY----- app-private-key-value",
    AICHESTRA_GITHUB_WEBHOOK_SECRET: "webhook-secret-value",
    AICHESTRA_GITHUB_TOKEN: "ghp_github_app_it_token",
    SESSION_SECRET: "sk-github-app-it-session"
  });
});

test("GitHub App integration-test dashboard panel renders skip, safety, and no-secret status", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/github-app-integration");
    const panel = dashboard.body.githubAppIntegration as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).defaultLiveTestsSkipped, true);
    assert.equal((panel.summary as Record<string, unknown>).githubCallsInDefaultTests, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).envValuesExposed, false);
    assert.equal((panel.cleanupPolicy as Record<string, unknown>).branchDeletionAllowed, false);
    assert.equal(Array.isArray(panel.testCases), true);
    assert.equal(Array.isArray(panel.gatedLiveTestCases), true);
    assert.equal(Array.isArray(panel.safetyChecks), true);
    assert.equal(hasSecretOrEnvValue(dashboard), false);
  }, {
    GITHUB_APP_PRIVATE_KEY: "-----BEGIN PRIVATE KEY----- app-private-key-value",
    AICHESTRA_GITHUB_TOKEN: "ghp_github_app_it_token"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("GitHub App Integration Tests"), true);
  assert.equal(html.includes("Forbidden operations"), true);
  assert.equal(html.includes("manual_close_or_mark_only"), true);
  assert.equal(hasSecretOrEnvValue(html), false);
});

const liveGateSummary = createDeploymentReadinessService({ env: process.env, now: () => fixedNow }).getGitHubAppIntegrationTestReadinessSummary();

test("optional live GitHub App integration test skeleton is skipped in default runs", {
  skip: liveGateSummary.canRunLiveTests
    ? "live GitHub provider execution is intentionally not implemented in v1"
    : `missing gates: ${liveGateSummary.missingRequiredEnvVars.join(",") || "unsafe gates present"}`
}, () => {
  assert.fail("Live GitHub App integration skeleton must never run in default tests.");
});
