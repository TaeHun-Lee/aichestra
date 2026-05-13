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
  return /postgres:\/\/|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|GITHUB_TOKEN=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|GITHUB_APP_PRIVATE_KEY=|AICHESTRA_LLM_API_KEY=|LLM_API_KEY=|SESSION_SECRET=|JWT_SECRET=|Bearer\s+staging|sk-staging|ghp_staging|github_pat_|VAULT_TOKEN=|AWS_SECRET_ACCESS_KEY=|GCP_SECRET=|AZURE_KEY=|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
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

test("staging deployment readiness models expose profile, gates, checks, criteria, and summary safely", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_DEPLOYMENT_PROFILE: "staging",
      AICHESTRA_DATABASE_URL: "postgres://user:password@example.invalid/aichestra",
      GITHUB_APP_PRIVATE_KEY: "sk-staging-private-key",
      AICHESTRA_GITHUB_WEBHOOK_SECRET: "staging-webhook-secret",
      AICHESTRA_LLM_API_KEY: "sk-staging-llm"
    },
    now: () => fixedNow
  });

  const summary = service.getStagingDeploymentSummary();
  const profile = service.getStagingDeploymentProfile();
  const gates = service.listStagingIntegrationGates();
  const checks = service.listStagingReadinessChecks();
  const promotion = service.listStagingPromotionCriteria();
  const rollback = service.listStagingRollbackCriteria();

  assert.equal(summary.status, "v0_implemented");
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.stagingDeployed, false);
  assert.equal(summary.productionTrafficAllowed, false);
  assert.equal(summary.currentProfileId, "staging");
  assert.equal(summary.profileStatus, "not_ready");
  assert.equal(summary.postgresRequired, true);
  assert.equal(summary.remoteMergeForbidden, true);
  assert.equal(summary.remoteMcpForbidden, true);
  assert.equal(summary.vendorCliForbidden, true);
  assert.equal(summary.deploymentExecuted, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(summary.mockActorWarning, "mock_actor_blocked_for_staging_profile");
  assert.equal(summary.envFallbackWarning, "env_fallback_blocked_for_staging_profile");
  assert.equal(profile.name, "staging");
  assert.equal(profile.status, "not_ready");
  assert.equal(profile.requiredStorageMode, "postgres_required");
  assert.equal(profile.requiredAuthMode, "future_oidc_saml");
  assert.equal(gates.some((gate) => gate.integrationKind === "postgres" && gate.status === "gated"), true);
  assert.equal(gates.some((gate) => gate.integrationKind === "mcp_remote" && gate.status === "blocked"), true);
  assert.equal(gates.some((gate) => gate.integrationKind === "observability_export" && gate.status === "blocked"), true);
  assert.equal(gates.some((gate) => gate.integrationKind === "secret_backend" && gate.status === "future"), true);
  assert.equal(checks.some((check) => check.id === "staging_secret_backend_required" && check.status === "fail" && check.severity === "critical"), true);
  assert.equal(checks.some((check) => check.id === "staging_mcp_remote_forbidden" && check.status === "pass" && check.severity === "critical"), true);
  assert.equal(promotion.some((criterion) => criterion.id === "staging_promotion_destructive_ops_disabled" && criterion.status === "pass"), true);
  assert.equal(promotion.some((criterion) => criterion.id === "staging_promotion_postgres_profile" && criterion.status === "fail"), true);
  assert.equal(rollback.some((criterion) => criterion.id === "staging_rollback_secret_exposure" && criterion.severity === "critical"), true);
  assert.equal(hasSecretOrEnvValue({ summary, profile, gates, checks, promotion, rollback }), false);
});

test("staging readiness APIs and health metadata are read-only and hide env values", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/staging/summary");
    const profile = await getJson(port, "/readiness/staging/profile");
    const gates = await getJson(port, "/readiness/staging/gates");
    const checks = await getJson(port, "/readiness/staging/checks?category=mcp");
    const promotion = await getJson(port, "/readiness/staging/promotion-criteria");
    const rollback = await getJson(port, "/readiness/staging/rollback-criteria");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/staging/summary");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).status, "v0_implemented");
    assert.equal((summary.body.summary as Record<string, unknown>).productionReady, false);
    assert.equal((summary.body.summary as Record<string, unknown>).stagingDeployed, false);
    assert.equal((summary.body.summary as Record<string, unknown>).deploymentExecuted, false);
    assert.equal((summary.body.summary as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((summary.body.summary as Record<string, unknown>).envValuesExposed, false);
    assert.equal(profile.statusCode, 200);
    assert.equal((profile.body.profile as Record<string, unknown>).name, "staging");
    assert.equal(gates.statusCode, 200);
    assert.equal((gates.body.gates as unknown[]).length > 0, true);
    assert.equal(checks.statusCode, 200);
    assert.equal((checks.body.checks as Array<Record<string, unknown>>).every((check) => check.category === "mcp"), true);
    assert.equal(promotion.statusCode, 200);
    assert.equal((promotion.body.promotionCriteria as unknown[]).length > 0, true);
    assert.equal(rollback.statusCode, 200);
    assert.equal((rollback.body.rollbackCriteria as unknown[]).length > 0, true);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.stagingDeployment as Record<string, unknown>).productionReady, false);
    assert.equal((health.body.stagingDeployment as Record<string, unknown>).stagingDeployed, false);
    assert.equal((health.body.stagingDeployment as Record<string, unknown>).remoteMergeForbidden, true);
    assert.equal((health.body.stagingDeployment as Record<string, unknown>).remoteMcpForbidden, true);
    assert.equal((health.body.stagingDeployment as Record<string, unknown>).vendorCliForbidden, true);
    assert.equal((health.body.stagingDeployment as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((health.body.stagingDeployment as Record<string, unknown>).envValuesExposed, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasSecretOrEnvValue({ summary, profile, gates, checks, promotion, rollback, health }), false);
  }, {
    AICHESTRA_DEPLOYMENT_PROFILE: "staging",
    AICHESTRA_DATABASE_URL: "postgres://user:password@example.invalid/aichestra",
    GITHUB_APP_PRIVATE_KEY: "sk-staging-private-key",
    AICHESTRA_GITHUB_WEBHOOK_SECRET: "staging-webhook-secret",
    SESSION_SECRET: "session-secret",
    JWT_SECRET: "jwt-secret"
  });
});

test("staging dashboard panel renders blockers, warnings, and no-secret status without env values", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/staging");
    const panel = dashboard.body.staging as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).stagingDeployed, false);
    assert.equal((panel.summary as Record<string, unknown>).remoteMergeForbidden, true);
    assert.equal((panel.summary as Record<string, unknown>).remoteMcpForbidden, true);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).envValuesExposed, false);
    assert.equal(Array.isArray(panel.integrationGates), true);
    assert.equal(Array.isArray(panel.promotionCriteria), true);
    assert.equal(Array.isArray(panel.rollbackCriteria), true);
    assert.equal(hasSecretOrEnvValue(dashboard), false);
  }, {
    AICHESTRA_DATABASE_URL: "postgres://user:password@example.invalid/aichestra",
    AICHESTRA_LLM_API_KEY: "sk-staging-llm"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Staging Deployment Profile"), true);
  assert.equal(html.includes("Integration gates"), true);
  assert.equal(html.includes("Readiness checks"), true);
  assert.equal(html.includes("Promotion criteria"), true);
  assert.equal(html.includes("Rollback criteria"), true);
  assert.equal(html.includes("No-secret/no-env status"), true);
  assert.equal(hasSecretOrEnvValue(html), false);
});

test("staging profile keeps deployment, remote MCP, vendor CLI, and production traffic disabled", () => {
  const service = createDeploymentReadinessService({ now: () => fixedNow });
  const summary = service.getStagingDeploymentSummary();
  const gates = service.listStagingIntegrationGates();
  const checks = service.listStagingReadinessChecks();

  assert.equal(summary.stagingDeployed, false);
  assert.equal(summary.deploymentExecuted, false);
  assert.equal(summary.productionTrafficAllowed, false);
  assert.equal(summary.remoteMergeForbidden, true);
  assert.equal(summary.remoteMcpForbidden, true);
  assert.equal(summary.vendorCliForbidden, true);
  assert.equal(gates.some((gate) => gate.integrationKind === "mcp_remote" && gate.status === "blocked"), true);
  assert.equal(gates.some((gate) => gate.integrationKind === "local_agent" && gate.forbiddenEnvVars.includes("AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION")), true);
  assert.equal(checks.some((check) => check.id === "staging_runner_command_execution_forbidden" && check.metadata.vendorCliExecutionEnabled === false), true);
});
