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
  return /postgres:\/\/|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|GITHUB_TOKEN=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|GITHUB_APP_PRIVATE_KEY=|AICHESTRA_LLM_API_KEY=|LLM_API_KEY=|SESSION_SECRET=|JWT_SECRET=|Bearer\s+cicd|sk-cicd|ghp_cicd|github_pat_|VAULT_TOKEN=|AWS_SECRET_ACCESS_KEY=|GCP_SECRET=|AZURE_KEY=|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
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

test("staging CI/CD readiness models expose profiles, jobs, gates, checks, risks, and summary safely", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_DEPLOYMENT_PROFILE: "staging",
      AICHESTRA_TEST_DATABASE_URL: "postgres://user:password@example.invalid/aichestra",
      GITHUB_TOKEN: "ghp_cicd_token",
      GITHUB_APP_PRIVATE_KEY: "sk-cicd-private-key",
      AICHESTRA_GITHUB_WEBHOOK_SECRET: "cicd-webhook-secret",
      AICHESTRA_LLM_API_KEY: "sk-cicd-llm",
      SESSION_SECRET: "cicd-session-secret"
    },
    now: () => fixedNow
  });

  const summary = service.getCicdPipelineReadinessSummary();
  const profiles = service.listCicdPipelineProfiles();
  const jobs = service.listCicdJobDefinitions();
  const remoteGitJobs = service.listCicdJobDefinitions({ category: "optional_remote_git" });
  const stagingJobs = service.listCicdJobDefinitions({ profileId: "staging" });
  const gates = service.listCicdIntegrationTestGates();
  const checks = service.listCicdReadinessChecks();
  const secretChecks = service.listCicdReadinessChecks({ category: "secrets" });
  const risks = service.listCicdRisks();

  assert.equal(summary.status, "v0_implemented");
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.stagingDeployed, false);
  assert.equal(summary.deploymentWorkflowCreated, false);
  assert.equal(summary.activeWorkflowCreated, false);
  assert.equal(summary.externalCallsEnabledByDefault, false);
  assert.equal(summary.remoteIntegrationTestsEnabledByDefault, false);
  assert.equal(summary.secretsExposed, false);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(summary.packageManager, "pnpm");
  assert.equal(summary.expectedNodeVersion, ">=24.0.0");
  assert.equal(summary.disabledByDefaultIntegrationGateCount, summary.integrationGateCount);
  assert.equal(summary.artifactPolicyStatus, "planned_redacted_only");
  assert.equal(summary.cleanupRollbackStatus, "planned_manual_only");
  assert.equal(summary.noSecretScanStatus, "planned_required");
  assert.equal(profiles.some((profile) => profile.name === "staging" && profile.status === "blocked"), true);
  assert.equal(jobs.some((job) => job.id === "cicd_job_lint" && job.command === "pnpm lint" && job.required), true);
  assert.equal(jobs.some((job) => job.id === "cicd_job_build" && job.command === "pnpm build" && job.required), true);
  assert.equal(jobs.some((job) => job.id === "cicd_job_optional_remote_llm" && !job.required && job.allowedToCallExternalServices), true);
  assert.equal(remoteGitJobs.every((job) => job.category === "optional_remote_git"), true);
  assert.equal(stagingJobs.length > 0, true);
  assert.equal(gates.every((gate) => gate.enabledByDefault === false), true);
  assert.equal(gates.some((gate) => gate.integrationKind === "remote_mcp" && gate.blockedProfiles.includes("staging")), true);
  assert.equal(gates.some((gate) => gate.integrationKind === "vendor_cli" && gate.blockedProfiles.includes("staging")), true);
  assert.equal(checks.some((check) => check.id === "cicd_optional_remote_tests_disabled_default" && check.status === "pass"), true);
  assert.equal(secretChecks.every((check) => check.category === "secrets"), true);
  assert.equal(risks.some((risk) => risk.id === "cicd_risk_remote_tests_accidentally_enabled" && risk.severity === "critical"), true);
  assert.equal(hasSecretOrEnvValue({ summary, profiles, jobs, gates, checks, risks }), false);
});

test("staging CI/CD readiness APIs and health metadata are read-only and hide env values", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/ci-cd/summary");
    const profiles = await getJson(port, "/readiness/ci-cd/profiles");
    const jobs = await getJson(port, "/readiness/ci-cd/jobs?category=optional_remote_git");
    const stagingJobs = await getJson(port, "/readiness/ci-cd/jobs?profileId=staging");
    const gates = await getJson(port, "/readiness/ci-cd/integration-gates");
    const checks = await getJson(port, "/readiness/ci-cd/checks?category=secrets");
    const risks = await getJson(port, "/readiness/ci-cd/risks");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/ci-cd/summary");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).status, "v0_implemented");
    assert.equal((summary.body.summary as Record<string, unknown>).productionReady, false);
    assert.equal((summary.body.summary as Record<string, unknown>).stagingDeployed, false);
    assert.equal((summary.body.summary as Record<string, unknown>).deploymentWorkflowCreated, false);
    assert.equal((summary.body.summary as Record<string, unknown>).activeWorkflowCreated, false);
    assert.equal((summary.body.summary as Record<string, unknown>).externalCallsEnabledByDefault, false);
    assert.equal((summary.body.summary as Record<string, unknown>).remoteIntegrationTestsEnabledByDefault, false);
    assert.equal((summary.body.summary as Record<string, unknown>).secretsExposed, false);
    assert.equal((summary.body.summary as Record<string, unknown>).envValuesExposed, false);
    assert.equal(profiles.statusCode, 200);
    assert.equal((profiles.body.profiles as unknown[]).length > 0, true);
    assert.equal(jobs.statusCode, 200);
    assert.equal((jobs.body.jobs as Array<Record<string, unknown>>).every((job) => job.category === "optional_remote_git"), true);
    assert.equal(stagingJobs.statusCode, 200);
    assert.equal((stagingJobs.body.jobs as Array<Record<string, unknown>>).every((job) => job.profileId === "staging"), true);
    assert.equal(gates.statusCode, 200);
    assert.equal((gates.body.integrationGates as Array<Record<string, unknown>>).every((gate) => gate.enabledByDefault === false), true);
    assert.equal(checks.statusCode, 200);
    assert.equal((checks.body.checks as Array<Record<string, unknown>>).every((check) => check.category === "secrets"), true);
    assert.equal(risks.statusCode, 200);
    assert.equal((risks.body.risks as unknown[]).length > 0, true);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.cicdPipeline as Record<string, unknown>).productionReady, false);
    assert.equal((health.body.cicdPipeline as Record<string, unknown>).stagingDeployed, false);
    assert.equal((health.body.cicdPipeline as Record<string, unknown>).activeWorkflowCreated, false);
    assert.equal((health.body.cicdPipeline as Record<string, unknown>).remoteIntegrationTestsEnabledByDefault, false);
    assert.equal((health.body.cicdPipeline as Record<string, unknown>).externalCallsEnabledByDefault, false);
    assert.equal((health.body.cicdPipeline as Record<string, unknown>).secretsExposed, false);
    assert.equal((health.body.cicdPipeline as Record<string, unknown>).envValuesExposed, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasSecretOrEnvValue({ summary, profiles, jobs, stagingJobs, gates, checks, risks, health }), false);
  }, {
    AICHESTRA_TEST_DATABASE_URL: "postgres://user:password@example.invalid/aichestra",
    GITHUB_TOKEN: "ghp_cicd_token",
    GITHUB_APP_PRIVATE_KEY: "sk-cicd-private-key",
    AICHESTRA_GITHUB_WEBHOOK_SECRET: "cicd-webhook-secret",
    AICHESTRA_LLM_API_KEY: "sk-cicd-llm",
    SESSION_SECRET: "cicd-session-secret",
    JWT_SECRET: "cicd-jwt-secret"
  });
});

test("staging CI/CD dashboard panel renders job matrix, gates, risks, and no-secret status", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/ci-cd");
    const panel = dashboard.body.cicd as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).stagingDeployed, false);
    assert.equal((panel.summary as Record<string, unknown>).activeWorkflowCreated, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).envValuesExposed, false);
    assert.equal((panel.stagingPromotion as Record<string, unknown>).remoteIntegrationTestsEnabledByDefault, false);
    assert.equal(Array.isArray(panel.profiles), true);
    assert.equal(Array.isArray(panel.jobs), true);
    assert.equal(Array.isArray(panel.integrationGates), true);
    assert.equal(Array.isArray(panel.risks), true);
    assert.equal(hasSecretOrEnvValue(dashboard), false);
  }, {
    AICHESTRA_TEST_DATABASE_URL: "postgres://user:password@example.invalid/aichestra",
    AICHESTRA_LLM_API_KEY: "sk-cicd-llm"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Staging CI/CD Pipeline"), true);
  assert.equal(html.includes("Job matrix"), true);
  assert.equal(html.includes("Optional integration gates"), true);
  assert.equal(html.includes("Staging promotion"), true);
  assert.equal(html.includes("No-secret/no-env status"), true);
  assert.equal(hasSecretOrEnvValue(html), false);
});

test("staging CI/CD defaults do not deploy or enable remote integrations", () => {
  const service = createDeploymentReadinessService({ now: () => fixedNow });
  const summary = service.getCicdPipelineReadinessSummary();
  const profiles = service.listCicdPipelineProfiles();
  const gates = service.listCicdIntegrationTestGates();
  const jobs = service.listCicdJobDefinitions();

  assert.equal(summary.stagingDeployed, false);
  assert.equal(summary.deploymentWorkflowCreated, false);
  assert.equal(summary.activeWorkflowCreated, false);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.externalCallsEnabledByDefault, false);
  assert.equal(summary.remoteIntegrationTestsEnabledByDefault, false);
  assert.equal(summary.stagingPromotionReady, false);
  assert.equal(profiles.some((profile) => profile.name === "staging" && profile.forbiddenJobs.includes("cicd_job_deploy_future")), true);
  assert.equal(gates.every((gate) => gate.enabledByDefault === false), true);
  assert.equal(gates.some((gate) => gate.integrationKind === "remote_mcp" && gate.blockedProfiles.includes("staging")), true);
  assert.equal(gates.some((gate) => gate.integrationKind === "external_auth" && gate.blockedProfiles.includes("staging")), true);
  assert.equal(gates.some((gate) => gate.integrationKind === "vendor_cli" && gate.blockedProfiles.includes("staging")), true);
  assert.equal(jobs.some((job) => job.id === "cicd_job_optional_remote_git" && !job.required && job.allowedToCallExternalServices), true);
  assert.equal(jobs.some((job) => job.id === "cicd_job_optional_mcp" && job.status === "future"), true);
});
