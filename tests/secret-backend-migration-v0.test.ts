import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-13T00:00:00.000Z");

function hasSecretOrEnvValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /sk-secret-backend|ghp_secret_backend|github_pat_|Bearer\s+secret|AICHESTRA_LLM_API_KEY=|AICHESTRA_GITHUB_TOKEN=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|VAULT_TOKEN=|AWS_SECRET_ACCESS_KEY=|GCP_SECRET=|AZURE_KEY=|SESSION_SECRET=|JWT_SECRET=|super-secret|credential-cache-secret|~\/\.codex|~\/\.claude|Google credential cache/i.test(text);
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

test("secret backend planning models expose options, phases, risks, rotation, leases, and summary without secret values", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_DEPLOYMENT_PROFILE: "production",
      AICHESTRA_ENABLE_ENV_SECRET_PROVIDER: "true",
      AICHESTRA_ALLOWED_SECRET_ENV_KEYS: "AICHESTRA_GITHUB_TOKEN,AICHESTRA_LLM_API_KEY",
      AICHESTRA_GITHUB_TOKEN: "ghp_secret_backend_token",
      AICHESTRA_GITHUB_WEBHOOK_SECRET: "super-secret-webhook",
      AICHESTRA_LLM_API_KEY: "sk-secret-backend-key",
      VAULT_TOKEN: "credential-cache-secret"
    },
    now: () => fixedNow
  });

  const summary = service.getSecretBackendMigrationSummary();
  const options = service.listSecretBackendOptions();
  const phases = service.listSecretBackendMigrationPhases();
  const checks = service.listSecretBackendReadinessChecks();
  const risks = service.listSecretBackendRisks();
  const rotations = service.listSecretRotationPlans();
  const leases = service.listSecretLeasePolicies();

  assert.equal(summary.status, "v0_implemented");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.currentProfileId, "production");
  assert.equal(summary.envFallbackAllowedForCurrentProfile, false);
  assert.equal(summary.envFallbackWarning, "env_fallback_blocked_for_production_profile");
  assert.equal(summary.envSecretProviderEnabled, true);
  assert.equal(summary.allowedSecretEnvKeyCount, 2);
  assert.equal(summary.realSecretBackendConfigured, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.credentialResolutionAttempted, false);
  assert.equal(summary.rotationJobsImplemented, false);
  assert.equal(summary.productionCredentialIssuanceImplemented, false);
  assert.equal(summary.credentialCachesRead, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(options.some((option) => option.backendKind === "vault" && option.productionRecommended), true);
  assert.equal(options.some((option) => option.backendKind === "env_legacy" && !option.productionRecommended), true);
  assert.equal(phases.some((phase) => phase.id === "secret_migration_phase_6_disable_env_fallback" && phase.status === "blocked"), true);
  assert.equal(checks.some((check) => check.id === "secret_env_fallback_blocked_for_production" && check.status === "fail"), true);
  assert.equal(risks.some((risk) => risk.id === "risk_secret_env_fallback_in_production" && risk.severity === "critical"), true);
  assert.equal(rotations.some((plan) => plan.secretKind === "github_token" && plan.rotationMode === "manual"), true);
  assert.equal(leases.some((policy) => policy.secretKind === "github_webhook_secret" && policy.maxTtlSeconds === 300), true);
  assert.equal(hasSecretOrEnvValue({ summary, options, phases, checks, risks, rotations, leases }), false);
});

test("secret backend readiness APIs and health metadata are read-only and hide env values", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/secrets/summary");
    const backends = await getJson(port, "/readiness/secrets/backends");
    const phases = await getJson(port, "/readiness/secrets/migration-phases");
    const checks = await getJson(port, "/readiness/secrets/checks?category=env_fallback");
    const risks = await getJson(port, "/readiness/secrets/risks");
    const rotations = await getJson(port, "/readiness/secrets/rotation-plans");
    const leases = await getJson(port, "/readiness/secrets/lease-policies");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/secrets/summary");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).currentProfileId, "production");
    assert.equal((summary.body.summary as Record<string, unknown>).envFallbackAllowedForCurrentProfile, false);
    assert.equal((summary.body.summary as Record<string, unknown>).envValuesExposed, false);
    assert.equal(backends.statusCode, 200);
    assert.equal((backends.body.backends as unknown[]).length > 0, true);
    assert.equal(phases.statusCode, 200);
    assert.equal((phases.body.migrationPhases as unknown[]).length > 0, true);
    assert.equal(checks.statusCode, 200);
    assert.equal((checks.body.checks as Array<Record<string, unknown>>).every((check) => check.category === "env_fallback"), true);
    assert.equal(risks.statusCode, 200);
    assert.equal(rotations.statusCode, 200);
    assert.equal(leases.statusCode, 200);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.secretBackendMigration as Record<string, unknown>).productionReady, false);
    assert.equal((health.body.secretBackendMigration as Record<string, unknown>).realSecretBackendConfigured, false);
    assert.equal((health.body.secretBackendMigration as Record<string, unknown>).noSecretValuesExposed, true);
    assert.equal((health.body.secretBackendMigration as Record<string, unknown>).noEnvValuesExposed, true);
    assert.equal((health.body.secretBackendMigration as Record<string, unknown>).credentialCachesRead, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasSecretOrEnvValue({ summary, backends, phases, checks, risks, rotations, leases, health }), false);
  }, {
    AICHESTRA_DEPLOYMENT_PROFILE: "production",
    AICHESTRA_ENABLE_ENV_SECRET_PROVIDER: "true",
    AICHESTRA_ALLOWED_SECRET_ENV_KEYS: "AICHESTRA_GITHUB_TOKEN,AICHESTRA_LLM_API_KEY",
    AICHESTRA_GITHUB_TOKEN: "ghp_secret_backend_token",
    AICHESTRA_GITHUB_WEBHOOK_SECRET: "super-secret-webhook",
    AICHESTRA_LLM_API_KEY: "sk-secret-backend-key",
    SESSION_SECRET: "super-secret-session",
    JWT_SECRET: "super-secret-jwt",
    AWS_SECRET_ACCESS_KEY: "super-secret-aws"
  });
});

test("secret backend dashboard panel renders planning status without secret or env values", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/secret-backend");
    const panel = dashboard.body.secretBackend as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).realSecretBackendConfigured, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).envValuesExposed, false);
    assert.equal(Array.isArray(panel.backendOptions), true);
    assert.equal(Array.isArray(panel.rotationPlans), true);
    assert.equal(Array.isArray(panel.leasePolicies), true);
    assert.equal(hasSecretOrEnvValue(dashboard), false);
  }, {
    AICHESTRA_GITHUB_TOKEN: "ghp_secret_backend_token",
    AICHESTRA_LLM_API_KEY: "sk-secret-backend-key"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Secret Backend Migration"), true);
  assert.equal(html.includes("Backend options"), true);
  assert.equal(html.includes("Env fallback warning"), true);
  assert.equal(html.includes("Credential kind migration"), true);
  assert.equal(html.includes("Lease TTL and rotation"), true);
  assert.equal(html.includes("No-secret/no-env status"), true);
  assert.equal(hasSecretOrEnvValue(html), false);
});

test("secret backend planning keeps production integration and rotation disabled", () => {
  const service = createDeploymentReadinessService({ now: () => fixedNow });
  const summary = service.getSecretBackendMigrationSummary();
  const phases = service.listSecretBackendMigrationPhases();
  const rotations = service.listSecretRotationPlans();

  assert.equal(summary.realSecretBackendConfigured, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.rotationJobsImplemented, false);
  assert.equal(summary.productionCredentialIssuanceImplemented, false);
  assert.equal(phases.some((phase) => phase.metadata.actualSecretMigrationImplemented === false), true);
  assert.equal(rotations.some((plan) => plan.metadata.oauthImplemented === false), true);
  assert.equal(rotations.some((plan) => plan.metadata.wifIamImplemented === false), true);
});
