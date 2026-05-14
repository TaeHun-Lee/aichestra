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
  return /postgres:\/\/|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|GITHUB_TOKEN=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|GITHUB_APP_PRIVATE_KEY=|GITHUB_APP_ID=|GITHUB_INSTALLATION_ID=|AICHESTRA_LLM_API_KEY=|LLM_API_KEY=|VAULT_TOKEN=|AICHESTRA_VAULT_TOKEN=|hvs\.stagingtoken|SESSION_SECRET=|JWT_SECRET=|Bearer\s+staging|sk-staging|ghp_staging|github_pat_|AWS_SECRET_ACCESS_KEY=|GCP_SECRET=|AZURE_KEY=|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
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

test("staging execution models expose plan, steps, gates, go/no-go, rollback, and summary safely", () => {
  const service = createDeploymentReadinessService({ now: () => fixedNow });
  const plan = service.getStagingDeploymentExecutionPlan();
  const steps = service.listStagingDeploymentExecutionSteps();
  const gates = service.listStagingDeploymentExecutionGates();
  const validationGates = service.listStagingDeploymentExecutionGates({ category: "validation" });
  const decision = service.getStagingDeploymentGoNoGoDecision();
  const rollback = service.getStagingDeploymentRollbackPlan();
  const summary = service.getStagingDeploymentExecutionSummary();

  assert.equal(plan.id, "staging_deployment_execution_plan_v0");
  assert.equal(plan.status, "ready_for_signoff");
  assert.equal(plan.requiredSignoffs.length, 6);
  assert.equal(plan.deploymentSteps.length, 20);
  assert.equal(steps.length, 20);
  assert.equal(steps.some((step) => step.phase === "deployment_placeholder" && step.status === "future"), true);
  assert.equal(steps.some((step) => step.id === "staging_execution_step_05_collect_human_signoffs" && step.status === "blocked"), true);
  assert.equal(validationGates.every((gate) => gate.category === "validation"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_no_release_tag_deploy_side_effects" && gate.status === "pass" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_no_secret_no_env" && gate.status === "pass" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_human_signoff_collected" && gate.status === "fail" && gate.severity === "high"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_github_app_decision" && gate.status === "skipped"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_llm_decision" && gate.status === "skipped"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_vault_decision" && gate.status === "skipped"), true);
  assert.equal(decision.status, "not_ready");
  assert.equal(decision.pendingApprovals.length, 6);
  assert.equal(decision.blockers.includes("staging_execution_human_signoff_collected"), true);
  assert.equal(rollback.status, "ready_for_review");
  assert.equal(rollback.rollbackSteps.length, 10);
  assert.equal(summary.status, "v0_implemented");
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.planStatus, "ready_for_signoff");
  assert.equal(summary.goNoGoStatus, "not_ready");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.stagingDeployed, false);
  assert.equal(summary.deploymentExecuted, false);
  assert.equal(summary.releaseCreated, false);
  assert.equal(summary.gitTagCreated, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.remoteIntegrationTestsExecuted, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(hasSecretOrEnvValue({ plan, steps, gates, decision, rollback, summary }), false);
});

test("staging execution evaluation blocks validation failure, side effects, destructive Git, overclaims, and secret exposure", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_ALLOW_REMOTE_MERGE: "true",
      AICHESTRA_ALLOW_REMOTE_FORCE_PUSH: "true",
      AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE: "true"
    },
    stagingDeploymentExecutionOptions: {
      validationCommandStatus: "fail",
      failedValidationCommands: ["pnpm test"],
      diffCheckStatus: "fail",
      safeIntegrationScanStatus: "fail",
      noSecretExposureStatus: "fail",
      secretsExposed: true,
      envValuesExposed: true,
      deploymentExecuted: true,
      releaseCreated: true,
      gitTagCreated: true,
      externalCallsExecuted: true,
      productionReadyClaimed: true,
      stagingDeployedClaimed: true
    },
    now: () => fixedNow
  });

  const gates = service.listStagingDeploymentExecutionGates();
  const decision = service.getStagingDeploymentGoNoGoDecision();
  const summary = service.getStagingDeploymentExecutionSummary();

  assert.equal(gates.some((gate) => gate.id === "staging_execution_pnpm_test" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_git_diff_check" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_safe_integration_scan" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_no_secret_no_env" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_no_release_tag_deploy_side_effects" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_no_ready_overclaim" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(gates.some((gate) => gate.id === "staging_execution_destructive_git_disabled" && gate.status === "fail" && gate.severity === "critical"), true);
  assert.equal(decision.status, "no_go");
  assert.equal(summary.planStatus, "blocked");
  assert.equal(summary.criticalBlockerCount > 0, true);
  assert.equal(summary.deploymentExecuted, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.noSecretsExposed, false);
  assert.equal(summary.envValuesExposed, true);
  assert.equal(summary.productionReadyClaimed, true);
  assert.equal(summary.stagingDeployedClaimed, true);
  assert.equal(hasSecretOrEnvValue({ gates, decision, summary }), false);
});

test("staging execution can reach go_with_warnings only after required mock signoffs are present", () => {
  const signoffStatuses = {
    engineering_owner: "approved_mock",
    platform_owner: "approved_mock",
    security_reviewer: "approved_mock",
    product_owner: "approved_mock",
    qa_reviewer: "approved_mock",
    release_manager: "approved_mock"
  } as const;
  const service = createDeploymentReadinessService({
    stagingDeploymentExecutionOptions: {
      signoffStatuses,
      validationCommandStatus: "pass",
      diffCheckStatus: "pass",
      safeIntegrationScanStatus: "pass",
      noSecretExposureStatus: "pass",
      releaseNotesPresent: true,
      rollbackPlanPresent: true
    },
    now: () => fixedNow
  });

  const plan = service.getStagingDeploymentExecutionPlan();
  const steps = service.listStagingDeploymentExecutionSteps();
  const decision = service.getStagingDeploymentGoNoGoDecision();
  const summary = service.getStagingDeploymentExecutionSummary();

  assert.equal(plan.status, "planned");
  assert.equal(steps.some((step) => step.id === "staging_execution_step_05_collect_human_signoffs" && step.status === "ready"), true);
  assert.equal(decision.pendingApprovals.length, 0);
  assert.equal(decision.blockers.length, 0);
  assert.equal(decision.status, "go_with_warnings");
  assert.equal(summary.pendingSignoffCount, 0);
  assert.equal(summary.goNoGoStatus, "go_with_warnings");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.stagingDeployed, false);
  assert.equal(hasSecretOrEnvValue({ plan, steps, decision, summary }), false);
});

test("staging execution APIs, dashboard panel, and health metadata are read-only and sanitized", async () => {
  await withApiServer(async (port) => {
    const plan = await getJson(port, "/readiness/staging-execution/plan");
    const steps = await getJson(port, "/readiness/staging-execution/steps");
    const gates = await getJson(port, "/readiness/staging-execution/gates?category=validation");
    const decision = await getJson(port, "/readiness/staging-execution/go-no-go");
    const rollback = await getJson(port, "/readiness/staging-execution/rollback");
    const summary = await getJson(port, "/readiness/staging-execution/summary");
    const health = await getJson(port, "/health");
    const dashboard = await getJson(port, "/dashboard/staging-execution");
    const writeAttempt = await postJson(port, "/readiness/staging-execution/summary");

    assert.equal(plan.statusCode, 200);
    assert.equal((plan.body.plan as Record<string, unknown>).id, "staging_deployment_execution_plan_v0");
    assert.equal(steps.statusCode, 200);
    assert.equal((steps.body.steps as unknown[]).length, 20);
    assert.equal(gates.statusCode, 200);
    assert.equal((gates.body.gates as Array<Record<string, unknown>>).every((gate) => gate.category === "validation"), true);
    assert.equal(decision.statusCode, 200);
    assert.equal((decision.body.decision as Record<string, unknown>).status, "not_ready");
    assert.equal(rollback.statusCode, 200);
    assert.equal(((rollback.body.rollback as Record<string, unknown>).rollbackSteps as unknown[]).length, 10);
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).status, "v0_implemented");
    assert.equal((summary.body.summary as Record<string, unknown>).deploymentExecuted, false);
    assert.equal((summary.body.summary as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).productionReady, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).stagingDeployed, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).deploymentExecuted, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).releaseCreated, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).gitTagCreated, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal((health.body.stagingExecution as Record<string, unknown>).noSecretsExposed, true);
    assert.equal(dashboard.statusCode, 200);
    assert.equal((dashboard.body.stagingExecution as Record<string, unknown>).noSecretStatus instanceof Object, true);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasSecretOrEnvValue({ plan, steps, gates, decision, rollback, summary, health, dashboard }), false);
  }, {
    AICHESTRA_DATABASE_URL: "postgres://user:password@example.invalid/aichestra",
    AICHESTRA_TEST_DATABASE_URL: "postgres://user:password@example.invalid/aichestra_test",
    GITHUB_TOKEN: "ghp_staging_token",
    GITHUB_APP_PRIVATE_KEY: "sk-staging-private-key",
    AICHESTRA_GITHUB_WEBHOOK_SECRET: "staging-webhook-secret",
    AICHESTRA_LLM_API_KEY: "sk-staging-llm",
    AICHESTRA_VAULT_TOKEN: "hvs.stagingtoken",
    SESSION_SECRET: "staging-session-secret",
    JWT_SECRET: "staging-jwt-secret"
  });
});

test("staging execution dashboard HTML renders planning status without secrets or deployment claims", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("Staging Deployment Execution Plan"), true);
  assert.equal(html.includes("Step sequence"), true);
  assert.equal(html.includes("Go/no-go decision"), true);
  assert.equal(html.includes("Optional integration decisions"), true);
  assert.equal(html.includes("Rollback readiness"), true);
  assert.equal(html.includes("deployment true"), false);
  assert.equal(html.includes("deployed true"), false);
  assert.equal(html.includes("Git tag created"), false);
  assert.equal(hasSecretOrEnvValue(html), false);
});
