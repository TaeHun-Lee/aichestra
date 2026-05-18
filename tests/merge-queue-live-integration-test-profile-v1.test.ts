import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-18T00:00:00.000Z");

function hasSecretOrEnvValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /AICHESTRA_GIT_ALLOWED_REPOS=|AICHESTRA_TEST_MERGE_QUEUE_REPO=|AICHESTRA_TEST_MERGE_QUEUE_BASE_BRANCH=|AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES=|github\.com\/aichestra-test\/test-repo|aichestra\/test\/queue-fixture-a|aichestra\/test\/queue-fixture-b|aichestra\/test\/queue-base|hvs\.merge-queue-it|ghp_merge_queue_it|github_pat_merge_queue/i.test(text);
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

test("Merge Queue integration-test readiness is disabled by default and exposes no env values", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_GIT_ALLOWED_REPOS: "aichestra-test/test-repo",
      AICHESTRA_TEST_MERGE_QUEUE_REPO: "aichestra-test/test-repo",
      AICHESTRA_TEST_MERGE_QUEUE_BASE_BRANCH: "aichestra/test/queue-base",
      AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES: "aichestra/test/queue-fixture-a,aichestra/test/queue-fixture-b"
    },
    now: () => fixedNow
  });

  const profile = service.getMergeQueueIntegrationTestProfile();
  const testCases = service.listMergeQueueIntegrationTestCases();
  const safetyChecks = service.listMergeQueueIntegrationSafetyChecks();
  const branchChecks = service.listMergeQueueIntegrationSafetyChecks({ category: "branch_prefix" });
  const summary = service.getMergeQueueIntegrationTestReadinessSummary();

  assert.equal(profile.status, "disabled");
  assert.equal(profile.requiredBranchPrefix, "aichestra/test/");
  assert.equal(profile.cleanupPolicy, "manual_mark_only");
  assert.equal(profile.forbiddenOperations.includes("real_merge_execution"), true);
  assert.equal(profile.forbiddenOperations.includes("auto_merge"), true);
  assert.equal(profile.forbiddenOperations.includes("remote_merge_api_call"), true);
  assert.equal(profile.forbiddenOperations.includes("remote_force_push"), true);
  assert.equal(profile.forbiddenOperations.includes("remote_branch_delete"), true);
  assert.equal(testCases.some((testCase) => testCase.category === "dry_run_merge" && testCase.enabledByDefault), true);
  assert.equal(testCases.some((testCase) => testCase.category === "queue_readiness" && testCase.requiresLiveGit), true);
  assert.equal(branchChecks.every((check) => check.category === "branch_prefix"), true);
  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.liveTestsEnabled, false);
  assert.equal(summary.canRunLiveTests, false);
  assert.equal(summary.defaultLiveTestsSkipped, true);
  assert.equal(summary.missingGateCount > 0, true);
  assert.equal(summary.requiredBranchPrefix, "aichestra/test/");
  assert.equal(summary.dryRunOnly, false);
  assert.equal(summary.autoMergeForbidden, true);
  assert.equal(summary.remoteMergeForbidden, true);
  assert.equal(summary.remoteRebaseForbidden, true);
  assert.equal(summary.remoteForcePushForbidden, true);
  assert.equal(summary.remoteBranchDeleteForbidden, true);
  assert.equal(summary.cleanupPolicy, "manual_mark_only");
  assert.equal(summary.branchDeletionAllowed, false);
  assert.equal(summary.noAutoMerge, true);
  assert.equal(summary.noForcePush, true);
  assert.equal(summary.noBranchDelete, true);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(summary.repoUrlsExposed, false);
  assert.equal(summary.branchNamesExposed, false);
  assert.equal(summary.remoteGitCallsInDefaultTests, false);
  assert.equal(summary.realMergeExecuted, false);
  assert.equal(hasSecretOrEnvValue({ profile, testCases, safetyChecks, summary }), false);
});

test("Merge Queue integration-test profile becomes runnable only when every required gate is configured", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_MERGE_QUEUE_INTEGRATION_TESTS: "true",
      AICHESTRA_ENABLE_REMOTE_GIT: "true",
      AICHESTRA_GITHUB_INTEGRATION_TESTS: "true",
      AICHESTRA_GIT_PROVIDER: "github",
      AICHESTRA_GIT_ALLOWED_REPOS: "aichestra-test/test-repo",
      AICHESTRA_GIT_ALLOWED_BRANCH_PREFIX: "aichestra/test/",
      AICHESTRA_ALLOW_REMOTE_MERGE: "false",
      AICHESTRA_ALLOW_REMOTE_REBASE: "false",
      AICHESTRA_ALLOW_REMOTE_FORCE_PUSH: "false",
      AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE: "false",
      AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY: "true",
      AICHESTRA_TEST_MERGE_QUEUE_REPO: "aichestra-test/test-repo",
      AICHESTRA_TEST_MERGE_QUEUE_BASE_BRANCH: "aichestra/test/queue-base",
      AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES: "aichestra/test/queue-fixture-a,aichestra/test/queue-fixture-b"
    },
    now: () => fixedNow
  });

  const profile = service.getMergeQueueIntegrationTestProfile();
  const summary = service.getMergeQueueIntegrationTestReadinessSummary();
  const safetyChecks = service.listMergeQueueIntegrationSafetyChecks();

  assert.equal(summary.liveTestsEnabled, true);
  assert.equal(summary.canRunLiveTests, true);
  assert.equal(summary.missingGateCount, 0);
  assert.equal(summary.unsafeGateCount, 0);
  assert.equal(summary.allowedRepoCount, 1);
  assert.equal(summary.branchPrefixMatchesRequired, true);
  assert.equal(summary.testRepoAllowlisted, true);
  assert.equal(summary.testSourceBranchesMatchPrefix, true);
  assert.equal(summary.baseBranchDistinctFromSources, true);
  assert.equal(summary.dryRunOnly, true);
  assert.equal(profile.status, "ready_if_configured");
  assert.deepEqual(profile.requiredRepoAllowlist, ["configured_repo_allowlist_redacted"]);
  assert.equal(safetyChecks.every((check) => check.status === "pass"), true);
  assert.equal(hasSecretOrEnvValue({ profile, summary, safetyChecks }), false);
});

test("Merge Queue integration-test readiness flags unsafe merge, rebase, force-push, branch-delete, and dry-run-disabled gates", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_MERGE_QUEUE_INTEGRATION_TESTS: "true",
      AICHESTRA_ENABLE_REMOTE_GIT: "true",
      AICHESTRA_GITHUB_INTEGRATION_TESTS: "true",
      AICHESTRA_GIT_PROVIDER: "github",
      AICHESTRA_GIT_ALLOWED_REPOS: "aichestra-test/test-repo",
      AICHESTRA_GIT_ALLOWED_BRANCH_PREFIX: "aichestra/test/",
      AICHESTRA_ALLOW_REMOTE_MERGE: "true",
      AICHESTRA_ALLOW_REMOTE_REBASE: "true",
      AICHESTRA_ALLOW_REMOTE_FORCE_PUSH: "true",
      AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE: "true",
      AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY: "false",
      AICHESTRA_TEST_MERGE_QUEUE_REPO: "aichestra-test/test-repo",
      AICHESTRA_TEST_MERGE_QUEUE_BASE_BRANCH: "aichestra/test/queue-base",
      AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES: "aichestra/test/queue-fixture-a"
    },
    now: () => fixedNow
  });

  const summary = service.getMergeQueueIntegrationTestReadinessSummary();
  const safetyChecks = service.listMergeQueueIntegrationSafetyChecks();

  assert.equal(summary.canRunLiveTests, false);
  assert.equal(summary.unsafeGateWarnings.includes("remote_merge_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("remote_rebase_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("remote_force_push_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("remote_branch_delete_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("dry_run_only_disabled"), true);
  assert.equal(summary.remoteMergeForbidden, false);
  assert.equal(summary.remoteRebaseForbidden, false);
  assert.equal(summary.remoteForcePushForbidden, false);
  assert.equal(summary.remoteBranchDeleteForbidden, false);
  assert.equal(safetyChecks.some((check) => check.category === "no_auto_merge" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_force_push" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_branch_delete" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "dry_run_only" && check.status === "fail"), true);
  assert.equal(hasSecretOrEnvValue({ summary, safetyChecks }), false);
});

test("Merge Queue integration-test readiness flags branch-prefix and repo-allowlist mismatches", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_MERGE_QUEUE_INTEGRATION_TESTS: "true",
      AICHESTRA_ENABLE_REMOTE_GIT: "true",
      AICHESTRA_GITHUB_INTEGRATION_TESTS: "true",
      AICHESTRA_GIT_PROVIDER: "github",
      AICHESTRA_GIT_ALLOWED_REPOS: "aichestra-test/test-repo",
      AICHESTRA_GIT_ALLOWED_BRANCH_PREFIX: "feature/",
      AICHESTRA_ALLOW_REMOTE_MERGE: "false",
      AICHESTRA_ALLOW_REMOTE_REBASE: "false",
      AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY: "true",
      AICHESTRA_TEST_MERGE_QUEUE_REPO: "other-org/other-repo",
      AICHESTRA_TEST_MERGE_QUEUE_BASE_BRANCH: "main",
      AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES: "feature/a,feature/b"
    },
    now: () => fixedNow
  });

  const summary = service.getMergeQueueIntegrationTestReadinessSummary();
  const safetyChecks = service.listMergeQueueIntegrationSafetyChecks();

  assert.equal(summary.canRunLiveTests, false);
  assert.equal(summary.unsafeGateWarnings.includes("branch_prefix_mismatch"), true);
  assert.equal(summary.unsafeGateWarnings.includes("test_source_branches_outside_prefix"), true);
  assert.equal(summary.unsafeGateWarnings.includes("test_repo_not_allowlisted"), true);
  assert.equal(summary.branchPrefixMatchesRequired, false);
  assert.equal(summary.testRepoAllowlisted, false);
  assert.equal(summary.testSourceBranchesMatchPrefix, false);
  assert.equal(safetyChecks.some((check) => check.category === "branch_prefix" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "repo_allowlist" && check.status === "fail"), true);
  assert.equal(hasSecretOrEnvValue({ summary, safetyChecks }), false);
});

test("Merge Queue integration-test readiness APIs and health metadata are read-only and sanitized", async () => {
  await withApiServer(async (port) => {
    const profile = await getJson(port, "/readiness/merge-queue-integration/profile");
    const testCases = await getJson(port, "/readiness/merge-queue-integration/test-cases");
    const safetyChecks = await getJson(port, "/readiness/merge-queue-integration/safety-checks?category=no_auto_merge");
    const summary = await getJson(port, "/readiness/merge-queue-integration/summary");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/merge-queue-integration/summary");

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
    assert.equal((health.body.mergeQueueIntegrationTests as Record<string, unknown>).enabled, true);
    assert.equal((health.body.mergeQueueIntegrationTests as Record<string, unknown>).canRunLiveTests, false);
    assert.equal((health.body.mergeQueueIntegrationTests as Record<string, unknown>).unsafeGatesCount, 4);
    assert.equal((health.body.mergeQueueIntegrationTests as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((health.body.mergeQueueIntegrationTests as Record<string, unknown>).envValuesExposed, false);
    assert.equal((health.body.mergeQueueIntegrationTests as Record<string, unknown>).noAutoMerge, true);
    assert.equal((health.body.mergeQueueIntegrationTests as Record<string, unknown>).noForcePush, true);
    assert.equal((health.body.mergeQueueIntegrationTests as Record<string, unknown>).noBranchDelete, true);
    assert.equal((health.body.mergeQueueIntegrationTests as Record<string, unknown>).realMergeExecuted, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasSecretOrEnvValue({ profile, testCases, safetyChecks, summary, health }), false);
  }, {
    AICHESTRA_MERGE_QUEUE_INTEGRATION_TESTS: "true",
    AICHESTRA_ALLOW_REMOTE_MERGE: "true",
    AICHESTRA_ALLOW_REMOTE_REBASE: "true",
    AICHESTRA_ALLOW_REMOTE_FORCE_PUSH: "true",
    AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE: "true"
  });
});

test("Merge Queue integration-test dashboard panel renders skip, safety, and no-secret status", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/merge-queue-integration");
    const panel = dashboard.body.mergeQueueIntegration as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).defaultLiveTestsSkipped, true);
    assert.equal((panel.summary as Record<string, unknown>).remoteGitCallsInDefaultTests, false);
    assert.equal((panel.summary as Record<string, unknown>).realMergeExecuted, false);
    assert.equal((panel.cleanupPolicy as Record<string, unknown>).status, "manual_mark_only");
    assert.equal((panel.cleanupPolicy as Record<string, unknown>).branchDeletionAllowed, false);
    assert.equal((panel.operationPolicy as Record<string, unknown>).autoMergeForbidden, true);
    assert.equal((panel.operationPolicy as Record<string, unknown>).remoteMergeForbidden, true);
    assert.equal((panel.operationPolicy as Record<string, unknown>).remoteRebaseForbidden, true);
    assert.equal((panel.operationPolicy as Record<string, unknown>).remoteForcePushForbidden, true);
    assert.equal((panel.operationPolicy as Record<string, unknown>).remoteBranchDeleteForbidden, true);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).envValuesExposed, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).repoUrlsExposed, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).branchNamesExposed, false);
    assert.equal(Array.isArray(panel.testCases), true);
    assert.equal(Array.isArray(panel.gatedLiveTestCases), true);
    assert.equal(Array.isArray(panel.safetyChecks), true);
    assert.equal(hasSecretOrEnvValue(dashboard), false);
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Merge Queue Live Integration Tests"), true);
  assert.equal(html.includes("manual_mark_only"), true);
  assert.equal(html.includes("real merge executed false"), true);
  assert.equal(hasSecretOrEnvValue(html), false);
});

const liveGateSummary = createDeploymentReadinessService({ env: process.env, now: () => fixedNow }).getMergeQueueIntegrationTestReadinessSummary();

test("optional live merge queue integration test skeleton is skipped in default runs", {
  skip: liveGateSummary.canRunLiveTests
    ? "live merge queue execution is intentionally not implemented in v1"
    : `missing gates: ${liveGateSummary.missingRequiredEnvVars.join(",") || "unsafe gates present"}`
}, () => {
  assert.fail("Live merge queue integration skeleton must never run in default tests.");
});
