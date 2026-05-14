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
  return /postgres:\/\/|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|GITHUB_TOKEN=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|GITHUB_APP_PRIVATE_KEY=|AICHESTRA_LLM_API_KEY=|LLM_API_KEY=|SESSION_SECRET=|JWT_SECRET=|Bearer\s+rc|sk-rc|ghp_rc|github_pat_|VAULT_TOKEN=|AWS_SECRET_ACCESS_KEY=|GCP_SECRET=|AZURE_KEY=|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
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

test("staging RC models expose checklist, gates, blockers, signoffs, release notes, rollback, report, and summary safely", () => {
  const service = createDeploymentReadinessService({ now: () => fixedNow });
  const checklist = service.getStagingReleaseCandidateChecklist();
  const gates = service.listStagingReleaseCandidateGates();
  const blockers = service.listStagingReleaseCandidateBlockers();
  const signoffs = service.listStagingReleaseCandidateSignoffs();
  const releaseNotes = service.listStagingReleaseNoteRequirements();
  const rollback = service.listStagingRollbackChecklist();
  const report = service.generateStagingReleaseCandidateReport();
  const summary = service.getStagingReleaseCandidateSummary();

  assert.equal(checklist.id, "staging_release_candidate_checklist_v0");
  assert.equal(checklist.status, "not_ready");
  assert.equal(checklist.allowedSkippedTests.includes("github_app_integration_skipped_without_all_explicit_gates"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_no_release_or_deployment_execution" && gate.status === "pass" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_no_secret_or_env_exposure" && gate.status === "pass" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_github_integration_profile_documented" && gate.status === "skipped"), true);
  assert.equal(blockers.some((blocker) => blocker.id === "blocker_staging_rc_production_auth_missing" && blocker.blockingLevel === "blocks_production_only" && blocker.status === "accepted"), true);
  assert.equal(blockers.some((blocker) => blocker.id === "blocker_staging_rc_real_secret_backend_missing" && blocker.blockingLevel === "blocks_production_only" && blocker.status === "accepted"), true);
  assert.equal(signoffs.length, 6);
  assert.equal(signoffs.every((signoff) => signoff.status === "pending"), true);
  assert.equal(releaseNotes.length, 10);
  assert.equal(releaseNotes.every((note) => note.status === "missing"), true);
  assert.equal(rollback.length, 9);
  assert.equal(rollback.every((item) => item.status === "planned"), true);
  assert.equal(report.overallStatus, "not_ready");
  assert.equal(report.skippedTests.length >= 2, true);
  assert.equal(report.recommendedNextActions.length > 0, true);
  assert.equal(summary.status, "v0_implemented");
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.stagingDeployed, false);
  assert.equal(summary.releaseCreated, false);
  assert.equal(summary.gitTagCreated, false);
  assert.equal(summary.githubReleaseCreated, false);
  assert.equal(summary.deploymentExecuted, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.remoteIntegrationTestsExecuted, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(hasSecretOrEnvValue({ checklist, gates, blockers, signoffs, releaseNotes, rollback, report, summary }), false);
});

test("staging RC evaluation blocks critical validation, destructive Git, real MCP, release/deployment execution, overclaims, and secret exposure", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_ALLOW_REMOTE_MERGE: "true",
      AICHESTRA_ALLOW_REMOTE_FORCE_PUSH: "true",
      AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE: "true",
      AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION: "true",
      AICHESTRA_ENABLE_MCP_REAL_TRANSPORT: "true"
    },
    stagingReleaseCandidateOptions: {
      validationCommandStatus: "fail",
      failedValidationCommands: ["pnpm test"],
      diffCheckStatus: "fail",
      secretsExposed: true,
      envValuesExposed: true,
      releaseCreated: true,
      gitTagCreated: true,
      githubReleaseCreated: true,
      deploymentExecuted: true,
      externalCallsExecuted: true,
      productionReadyClaimed: true,
      stagingDeployedClaimed: true
    },
    now: () => fixedNow
  });

  const gates = service.listStagingReleaseCandidateGates();
  const blockers = service.listStagingReleaseCandidateBlockers();
  const summary = service.getStagingReleaseCandidateSummary();

  assert.equal(gates.some((gate) => gate.id === "staging_rc_pnpm_test" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_git_diff_check" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_remote_merge_forbidden" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_force_push_forbidden" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_branch_deletion_forbidden" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_vendor_cli_forbidden" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_real_mcp_transport_forbidden" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_no_secret_or_env_exposure" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_no_release_or_deployment_execution" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_no_ready_overclaim" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(blockers.some((blocker) => blocker.blockingLevel === "blocks_release_candidate" && blocker.severity === "critical"), true);
  assert.equal(summary.overallStatus, "blocked");
  assert.equal(summary.noSecretsExposed, false);
  assert.equal(summary.envValuesExposed, true);
  assert.equal(summary.productionReadyClaimed, true);
  assert.equal(summary.stagingDeploymentClaimed, true);
  assert.equal(hasSecretOrEnvValue({ gates, blockers, summary }), false);
});

test("staging RC allows documented optional skips and treats missing production auth/secrets as production blockers", () => {
  const approvedSignoffs = {
    engineering_owner: "approved_mock",
    platform_owner: "approved_mock",
    security_reviewer: "approved_mock",
    product_owner: "approved_mock",
    qa_reviewer: "approved_mock",
    release_manager: "approved_mock"
  } as const;
  const presentNotes = {
    summary: true,
    changed_areas: true,
    validation: true,
    skipped_tests: true,
    known_limitations: true,
    safety_gates: true,
    migration_notes: true,
    dashboard_readiness: true,
    rollback_notes: true,
    follow_ups: true
  };
  const service = createDeploymentReadinessService({
    stagingReleaseCandidateOptions: {
      validationCommandStatus: "pass",
      diffCheckStatus: "pass",
      signoffStatuses: approvedSignoffs,
      releaseNoteSectionsPresent: presentNotes
    },
    now: () => fixedNow
  });

  const gates = service.listStagingReleaseCandidateGates();
  const blockers = service.listStagingReleaseCandidateBlockers();
  const report = service.generateStagingReleaseCandidateReport();

  assert.equal(gates.some((gate) => gate.id === "staging_rc_optional_postgres_profile_documented" && gate.status === "skipped"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_github_integration_profile_documented" && gate.status === "skipped"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_rc_llm_integration_profile_documented" && gate.status === "skipped"), true);
  assert.equal(blockers.some((blocker) => blocker.id === "blocker_staging_rc_production_auth_missing" && blocker.blockingLevel === "blocks_release_candidate"), false);
  assert.equal(blockers.some((blocker) => blocker.id === "blocker_staging_rc_real_secret_backend_missing" && blocker.blockingLevel === "blocks_release_candidate"), false);
  assert.equal(report.skippedTests.includes("staging_rc_github_integration_profile_documented"), true);
  assert.equal(report.recommendedNextActions.some((action) => action.includes("skipped optional integration tests")), true);
  assert.equal(hasSecretOrEnvValue({ gates, blockers, report }), false);
});

test("staging RC APIs, dashboard panel, and health metadata are read-only and hide env values", async () => {
  await withApiServer(async (port) => {
    const checklist = await getJson(port, "/readiness/staging-rc/checklist");
    const gates = await getJson(port, "/readiness/staging-rc/gates?category=validation");
    const blockers = await getJson(port, "/readiness/staging-rc/blockers");
    const signoffs = await getJson(port, "/readiness/staging-rc/signoffs");
    const releaseNotes = await getJson(port, "/readiness/staging-rc/release-notes");
    const rollback = await getJson(port, "/readiness/staging-rc/rollback");
    const report = await getJson(port, "/readiness/staging-rc/report");
    const summary = await getJson(port, "/readiness/staging-rc/summary");
    const health = await getJson(port, "/health");
    const dashboard = await getJson(port, "/dashboard/staging-rc");
    const writeAttempt = await postJson(port, "/readiness/staging-rc/report");

    assert.equal(checklist.statusCode, 200);
    assert.equal((checklist.body.checklist as Record<string, unknown>).id, "staging_release_candidate_checklist_v0");
    assert.equal(gates.statusCode, 200);
    assert.equal((gates.body.gates as Array<Record<string, unknown>>).every((gate) => gate.category === "validation"), true);
    assert.equal(blockers.statusCode, 200);
    assert.equal((blockers.body.blockers as unknown[]).length > 0, true);
    assert.equal(signoffs.statusCode, 200);
    assert.equal((signoffs.body.signoffs as unknown[]).length, 6);
    assert.equal(releaseNotes.statusCode, 200);
    assert.equal((releaseNotes.body.releaseNoteRequirements as unknown[]).length, 10);
    assert.equal(rollback.statusCode, 200);
    assert.equal((rollback.body.rollbackChecklist as unknown[]).length, 9);
    assert.equal(report.statusCode, 200);
    assert.equal(["blocked", "not_ready"].includes(String((report.body.report as Record<string, unknown>).overallStatus)), true);
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).status, "v0_implemented");
    assert.equal((summary.body.summary as Record<string, unknown>).releaseCreated, false);
    assert.equal((summary.body.summary as Record<string, unknown>).deploymentExecuted, false);
    assert.equal((summary.body.summary as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.stagingReleaseCandidate as Record<string, unknown>).productionReady, false);
    assert.equal((health.body.stagingReleaseCandidate as Record<string, unknown>).stagingDeployed, false);
    assert.equal((health.body.stagingReleaseCandidate as Record<string, unknown>).releaseCreated, false);
    assert.equal((health.body.stagingReleaseCandidate as Record<string, unknown>).gitTagCreated, false);
    assert.equal((health.body.stagingReleaseCandidate as Record<string, unknown>).githubReleaseCreated, false);
    assert.equal((health.body.stagingReleaseCandidate as Record<string, unknown>).deploymentExecuted, false);
    assert.equal((health.body.stagingReleaseCandidate as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal((health.body.stagingReleaseCandidate as Record<string, unknown>).noSecretsExposed, true);
    assert.equal(dashboard.statusCode, 200);
    assert.equal((dashboard.body.stagingReleaseCandidate as Record<string, unknown>).noSecretStatus instanceof Object, true);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasSecretOrEnvValue({ checklist, gates, blockers, signoffs, releaseNotes, rollback, report, summary, health, dashboard }), false);
  }, {
    AICHESTRA_DATABASE_URL: "postgres://user:password@example.invalid/aichestra",
    AICHESTRA_TEST_DATABASE_URL: "postgres://user:password@example.invalid/aichestra_test",
    GITHUB_TOKEN: "ghp_rc_token",
    GITHUB_APP_PRIVATE_KEY: "sk-rc-private-key",
    AICHESTRA_GITHUB_WEBHOOK_SECRET: "rc-webhook-secret",
    AICHESTRA_LLM_API_KEY: "sk-rc-llm",
    SESSION_SECRET: "rc-session-secret",
    JWT_SECRET: "rc-jwt-secret"
  });
});

test("staging RC dashboard HTML renders the panel without secrets, releases, or deployment claims", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("Staging Release Candidate Checklist"), true);
  assert.equal(html.includes("Required gates"), true);
  assert.equal(html.includes("Skipped optional tests"), true);
  assert.equal(html.includes("Release notes"), true);
  assert.equal(html.includes("Rollback checklist"), true);
  assert.equal(html.includes("release created true"), false);
  assert.equal(html.includes("deployed true"), false);
  assert.equal(hasSecretOrEnvValue(html), false);
});
