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
  return /postgres:\/\/|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|GITHUB_TOKEN=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|GITHUB_APP_PRIVATE_KEY=|AICHESTRA_LLM_API_KEY=|LLM_API_KEY=|SESSION_SECRET=|JWT_SECRET=|Bearer\s+dryrun|sk-dryrun|ghp_dryrun|github_pat_|VAULT_TOKEN=|AWS_SECRET_ACCESS_KEY=|GCP_SECRET=|AZURE_KEY=|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
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

test("staging dry-run models expose profile, sources, checks, blockers, report, and summary safely", () => {
  const service = createDeploymentReadinessService({ now: () => fixedNow });
  const profile = service.getStagingDeploymentDryRunProfile();
  const sources = service.listStagingDeploymentDryRunSources();
  const checks = service.listStagingDeploymentDryRunChecks();
  const blockers = service.listStagingDeploymentDryRunBlockers();
  const report = service.generateStagingDeploymentDryRunReport();
  const summary = service.getStagingDeploymentDryRunSummary();

  assert.equal(profile.id, "staging_dry_run_profile_v0");
  assert.equal(profile.dryRunMode, "read_only");
  assert.equal(profile.status, "blocked");
  assert.equal(profile.requiredReadinessSources.includes("staging_profile"), true);
  assert.equal(profile.optionalReadinessSources.includes("github_integration_tests"), true);
  assert.equal(sources.some((source) => source.sourceKind === "staging_profile" && source.status === "fail" && source.severity === "critical"), true);
  assert.equal(sources.some((source) => source.sourceKind === "github_integration_tests" && source.status === "skipped"), true);
  assert.equal(sources.some((source) => source.sourceKind === "llm_integration_tests" && source.status === "skipped"), true);
  assert.equal(checks.some((check) => check.id === "dry_run_no_deployment_execution" && check.status === "pass" && check.severity === "critical"), true);
  assert.equal(checks.some((check) => check.id === "dry_run_no_external_calls" && check.status === "pass" && check.severity === "critical"), true);
  assert.equal(checks.some((check) => check.id === "dry_run_no_secret_or_env_exposure" && check.status === "pass" && check.severity === "critical"), true);
  assert.equal(checks.some((check) => check.id === "dry_run_postgres_staging_required" && check.status === "fail" && check.severity === "high"), true);
  assert.equal(blockers.some((blocker) => blocker.id === "blocker_missing_secret_backend" && blocker.severity === "critical"), true);
  assert.equal(report.overallStatus, "blocked");
  assert.equal(report.recommendedNextActions.length > 0, true);
  assert.equal(report.promotionGuidance.some((item) => item.includes("Do not mark staging as deployed")), true);
  assert.equal(report.rollbackGuidance.length > 0, true);
  assert.equal(summary.status, "v0_implemented");
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.dryRunMode, "read_only");
  assert.equal(summary.overallStatus, "blocked");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.stagingDeployed, false);
  assert.equal(summary.deploymentExecuted, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.remoteIntegrationTestsExecuted, false);
  assert.equal(summary.validationCommandsExecuted, false);
  assert.equal(summary.skippedIntegrationProfileCount, 2);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(hasSecretOrEnvValue({ profile, sources, checks, blockers, report, summary }), false);
});

test("staging dry-run aggregation blocks destructive Git, vendor CLI, real MCP, validation failure, and secret exposure", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_ALLOW_REMOTE_MERGE: "true",
      AICHESTRA_ALLOW_REMOTE_FORCE_PUSH: "true",
      AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE: "true",
      AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION: "true",
      AICHESTRA_ENABLE_MCP_REAL_TRANSPORT: "true"
    },
    stagingDryRunOptions: {
      validationCommandStatus: "fail",
      failedValidationCommands: ["pnpm test"],
      secretsExposed: true,
      envValuesExposed: true
    },
    now: () => fixedNow
  });

  const checks = service.listStagingDeploymentDryRunChecks();
  const blockers = service.listStagingDeploymentDryRunBlockers();
  const summary = service.getStagingDeploymentDryRunSummary();

  assert.equal(checks.some((check) => check.id === "dry_run_remote_merge_forbidden" && check.status === "fail" && check.severity === "critical"), true);
  assert.equal(checks.some((check) => check.id === "dry_run_force_push_forbidden" && check.status === "fail" && check.severity === "critical"), true);
  assert.equal(checks.some((check) => check.id === "dry_run_branch_deletion_forbidden" && check.status === "fail" && check.severity === "critical"), true);
  assert.equal(checks.some((check) => check.id === "dry_run_vendor_cli_forbidden" && check.status === "fail" && check.severity === "critical"), true);
  assert.equal(checks.some((check) => check.id === "dry_run_real_mcp_transport_forbidden" && check.status === "fail" && check.severity === "critical"), true);
  assert.equal(checks.some((check) => check.id === "dry_run_validation_commands_status" && check.status === "fail" && check.severity === "critical"), true);
  assert.equal(checks.some((check) => check.id === "dry_run_no_secret_or_env_exposure" && check.status === "fail" && check.severity === "critical"), true);
  assert.equal(blockers.some((blocker) => blocker.blockingLevel === "blocks_staging_dry_run" && blocker.severity === "critical"), true);
  assert.equal(summary.overallStatus, "blocked");
  assert.equal(summary.noSecretsExposed, false);
  assert.equal(summary.envValuesExposed, true);
  assert.equal(hasSecretOrEnvValue({ checks, blockers, summary }), false);
});

test("staging dry-run skips missing live GitHub and LLM gates unless the profile requires them", () => {
  const optionalService = createDeploymentReadinessService({ now: () => fixedNow });
  const optionalReport = optionalService.generateStagingDeploymentDryRunReport();
  const optionalGitHub = optionalReport.integrationProfiles.find((profile) => profile.id === "github_app_integration_test_profile_v1");
  const optionalLlm = optionalReport.integrationProfiles.find((profile) => profile.id === "llm_gateway_integration_test_profile_v1");

  assert.equal(optionalGitHub?.status, "skipped");
  assert.equal(optionalLlm?.status, "skipped");
  assert.equal(optionalService.listStagingDeploymentDryRunChecks().some((check) => check.id === "dry_run_github_live_profile_classified" && check.status === "skipped"), true);
  assert.equal(optionalService.listStagingDeploymentDryRunChecks().some((check) => check.id === "dry_run_llm_live_profile_classified" && check.status === "skipped"), true);

  const requiredService = createDeploymentReadinessService({
    stagingDryRunOptions: {
      requireLiveGitHubValidation: true,
      requireLiveLLMValidation: true
    },
    now: () => fixedNow
  });
  const requiredChecks = requiredService.listStagingDeploymentDryRunChecks();
  const requiredBlockers = requiredService.listStagingDeploymentDryRunBlockers();
  const requiredReport = requiredService.generateStagingDeploymentDryRunReport();

  assert.equal(requiredChecks.some((check) => check.id === "dry_run_github_live_profile_classified" && check.status === "fail" && check.severity === "high"), true);
  assert.equal(requiredChecks.some((check) => check.id === "dry_run_llm_live_profile_classified" && check.status === "fail" && check.severity === "high"), true);
  assert.equal(requiredBlockers.some((blocker) => blocker.id === "blocker_github_live_validation_required" && blocker.blockingLevel === "blocks_staging_deployment"), true);
  assert.equal(requiredBlockers.some((blocker) => blocker.id === "blocker_llm_live_validation_required" && blocker.blockingLevel === "blocks_staging_deployment"), true);
  assert.equal(requiredReport.integrationProfiles.some((profile) => profile.id === "github_app_integration_test_profile_v1" && profile.status === "gated"), true);
  assert.equal(requiredReport.integrationProfiles.some((profile) => profile.id === "llm_gateway_integration_test_profile_v1" && profile.status === "gated"), true);
});

test("staging dry-run APIs, dashboard panel, and health metadata are read-only and hide env values", async () => {
  await withApiServer(async (port) => {
    const profile = await getJson(port, "/readiness/staging-dry-run/profile");
    const sources = await getJson(port, "/readiness/staging-dry-run/sources");
    const checks = await getJson(port, "/readiness/staging-dry-run/checks?category=security");
    const blockers = await getJson(port, "/readiness/staging-dry-run/blockers");
    const report = await getJson(port, "/readiness/staging-dry-run/report");
    const summary = await getJson(port, "/readiness/staging-dry-run/summary");
    const health = await getJson(port, "/health");
    const dashboard = await getJson(port, "/dashboard/staging-dry-run");
    const writeAttempt = await postJson(port, "/readiness/staging-dry-run/report");

    assert.equal(profile.statusCode, 200);
    assert.equal((profile.body.profile as Record<string, unknown>).dryRunMode, "read_only");
    assert.equal(sources.statusCode, 200);
    assert.equal((sources.body.sources as unknown[]).length > 0, true);
    assert.equal(checks.statusCode, 200);
    assert.equal((checks.body.checks as Array<Record<string, unknown>>).every((check) => check.category === "security"), true);
    assert.equal(blockers.statusCode, 200);
    assert.equal((blockers.body.blockers as unknown[]).length > 0, true);
    assert.equal(report.statusCode, 200);
    assert.equal((report.body.report as Record<string, unknown>).overallStatus, "blocked");
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).status, "v0_implemented");
    assert.equal((summary.body.summary as Record<string, unknown>).deploymentExecuted, false);
    assert.equal((summary.body.summary as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).remoteIntegrationTestsExecuted, false);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.stagingDryRun as Record<string, unknown>).productionReady, false);
    assert.equal((health.body.stagingDryRun as Record<string, unknown>).stagingDeployed, false);
    assert.equal((health.body.stagingDryRun as Record<string, unknown>).deploymentExecuted, false);
    assert.equal((health.body.stagingDryRun as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal((health.body.stagingDryRun as Record<string, unknown>).noSecretsExposed, true);
    assert.equal(dashboard.statusCode, 200);
    assert.equal((dashboard.body.stagingDryRun as Record<string, unknown>).noSecretStatus instanceof Object, true);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasSecretOrEnvValue({ profile, sources, checks, blockers, report, summary, health, dashboard }), false);
  }, {
    AICHESTRA_DATABASE_URL: "postgres://user:password@example.invalid/aichestra",
    AICHESTRA_TEST_DATABASE_URL: "postgres://user:password@example.invalid/aichestra_test",
    GITHUB_TOKEN: "ghp_dryrun_token",
    GITHUB_APP_PRIVATE_KEY: "sk-dryrun-private-key",
    AICHESTRA_GITHUB_WEBHOOK_SECRET: "dryrun-webhook-secret",
    AICHESTRA_LLM_API_KEY: "sk-dryrun-llm",
    SESSION_SECRET: "dryrun-session-secret",
    JWT_SECRET: "dryrun-jwt-secret"
  });
});

test("staging dry-run dashboard HTML renders the panel without secrets or deployment claims", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("Staging Deployment Dry-run"), true);
  assert.equal(html.includes("Source summary"), true);
  assert.equal(html.includes("Skipped integrations"), true);
  assert.equal(html.includes("Recommended next actions"), true);
  assert.equal(html.includes("No-secret/no-env status"), true);
  assert.equal(html.includes("deployed true"), false);
  assert.equal(hasSecretOrEnvValue(html), false);
});
