import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";

function hasSecret(value: unknown): boolean {
  return /sk-[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._~+/=-]+|ghp_|github_pat_|AICHESTRA_LLM_API_KEY=|AICHESTRA_GITHUB_TOKEN=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|SESSION_SECRET=|JWT_SECRET=|PASSWORD=|auth\.json|~\/\.claude/.test(JSON.stringify(value));
}

function getJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
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
  });
}

function postJson(port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
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

async function withApiServer(run: (port: number) => Promise<void>): Promise<void> {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("deployment readiness models expose local, integration, staging, and production planning state", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_DEPLOYMENT_PROFILE: "local",
      AICHESTRA_STORAGE_PROVIDER: "memory",
      AICHESTRA_ENABLE_ENV_SECRET_PROVIDER: "true",
      AICHESTRA_ALLOWED_SECRET_ENV_KEYS: "AICHESTRA_LLM_API_KEY",
      AICHESTRA_LLM_API_KEY: "sk-production-readiness-redacted"
    },
    now: () => new Date("2026-05-13T00:00:00.000Z")
  });
  const profiles = service.listProfiles();
  const summary = service.getSummary();
  const localChecks = service.listChecks({ profileId: "local" });
  const integrationChecks = service.listChecks({ profileId: "integration" });
  const stagingChecks = service.listChecks({ profileId: "staging" });
  const productionChecks = service.listChecks({ profileId: "production" });
  const risks = service.listRisks();

  assert.deepEqual(profiles.map((profile) => profile.id), ["local", "integration", "staging", "production"]);
  assert.equal(localChecks.some((check) => check.status === "pass"), true);
  assert.equal(integrationChecks.some((check) => check.status === "warning"), true);
  assert.equal(stagingChecks.some((check) => check.status === "fail" && check.severity === "critical"), true);
  assert.equal(productionChecks.some((check) => check.id === "production_auth_required" && check.status === "fail"), true);
  assert.equal(risks.some((risk) => risk.id === "risk_mock_auth_in_production" && risk.severity === "critical"), true);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.criticalBlockerCount > 0, true);
  assert.equal(summary.environmentWarnings.includes("mock_actor_warning"), true);
  assert.equal(summary.environmentWarnings.includes("env_secret_provider_not_production_warning"), true);
  assert.equal(summary.environmentWarnings.includes("legacy_env_credential_present_redacted_warning"), true);
  assert.equal(hasSecret(summary), false);
});

test("deployment readiness API and dashboard panel are read-only and expose no secrets", async () => {
  await withApiServer(async (port) => {
    const profiles = await getJson(port, "/readiness/deployment/profiles");
    const production = await getJson(port, "/readiness/deployment/profiles/production");
    const checks = await getJson(port, "/readiness/deployment/checks?profileId=production");
    const risks = await getJson(port, "/readiness/deployment/risks");
    const summary = await getJson(port, "/readiness/deployment/summary");
    const dashboard = await getJson(port, "/dashboard/readiness");
    const writeAttempt = await postJson(port, "/readiness/deployment/summary", {});

    assert.equal(profiles.statusCode, 200);
    assert.equal(production.statusCode, 200);
    assert.equal(checks.statusCode, 200);
    assert.equal(risks.statusCode, 200);
    assert.equal(summary.statusCode, 200);
    assert.equal(dashboard.statusCode, 200);
    assert.equal(writeAttempt.statusCode, 405);

    assert.equal(Array.isArray(profiles.body.profiles), true);
    assert.equal((production.body.profile as { id?: string }).id, "production");
    assert.equal((checks.body.checks as Array<{ id: string }>).some((check) => check.id === "production_secret_backend_required"), true);
    assert.equal((summary.body.summary as { productionReady?: boolean }).productionReady, false);
    assert.equal((dashboard.body.readiness as { noSecretsExposed?: boolean }).noSecretsExposed, true);
    assert.equal(hasSecret({ profiles, production, checks, risks, summary, dashboard }), false);
  });
});
