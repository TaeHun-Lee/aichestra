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
  return /sk-secret-backend-decision|ghp_secret_backend_decision|github_pat_|Bearer\s+decision|AICHESTRA_LLM_API_KEY=|AICHESTRA_GITHUB_TOKEN=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|GITHUB_APP_PRIVATE_KEY=|VAULT_TOKEN=|AWS_SECRET_ACCESS_KEY=|GCP_SECRET=|AZURE_KEY=|SESSION_SECRET=|JWT_SECRET=|credential-cache-secret|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
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

test("production secret backend decision models select gated Vault v1 without production rollout", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_GITHUB_TOKEN: "ghp_secret_backend_decision",
      AICHESTRA_LLM_API_KEY: "sk-secret-backend-decision",
      VAULT_TOKEN: "credential-cache-secret",
      SESSION_SECRET: "decision-session-secret"
    },
    now: () => fixedNow
  });

  const decision = service.getSecretBackendOptionDecision();
  const criteria = service.listSecretBackendDecisionCriteria();
  const scores = service.listSecretBackendDecisionScores();
  const scopes = service.listSecretBackendImplementationScopes();
  const mappings = service.listSecretBackendProviderMappings();
  const risks = service.listSecretBackendDecisionRisks();
  const summary = service.getSecretBackendOptionDecisionSummary();

  assert.equal(decision.recommendedBackend, "vault");
  assert.equal(decision.secondChoiceBackend, "aws_secrets_manager_future");
  assert.equal(decision.decisionStatus, "accepted_mock");
  assert.equal(criteria.some((criterion) => criterion.id === "security_posture" && criterion.weight === 10), true);
  assert.equal(criteria.some((criterion) => criterion.id === "future_extension_compatibility"), true);
  assert.equal(scores.some((score) => score.backendKind === "vault" && score.criterionId === "lease_ttl_support" && score.score === 5 && score.metadata.productionReady === false), true);
  assert.equal(scores.some((score) => score.backendKind === "env" && score.metadata.productionDefaultAllowed === false), true);
  assert.equal(scopes.some((scope) => scope.backendKind === "vault" && scope.status === "v1_implemented"), true);
  assert.equal(scopes.some((scope) => scope.excludedCapabilities.includes("automatic secret migration")), true);
  assert.equal(mappings.some((mapping) => mapping.providerValue === "vault" && mapping.productionStatus === "v1_implemented_gated"), true);
  assert.equal(mappings.some((mapping) => mapping.providerValue === "env" && mapping.productionStatus === "local_integration_only"), true);
  assert.equal(risks.some((risk) => risk.id === "secret_decision_risk_env_fallback_production" && risk.severity === "critical"), true);
  assert.equal(summary.status, "v0_implemented");
  assert.equal(summary.implementationReady, true);
  assert.equal(summary.productionSecretBackendImplemented, false);
  assert.equal(summary.envFallbackProductionAllowed, false);
  assert.equal(summary.externalCallsEnabled, false);
  assert.equal(summary.secretReadsAttempted, false);
  assert.equal(summary.secretRotationsAttempted, false);
  assert.equal(summary.secretMigrationsAttempted, false);
  assert.equal(summary.productionCredentialsIssued, false);
  assert.equal(summary.credentialCachesRead, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(hasSecretOrEnvValue({ decision, criteria, scores, scopes, mappings, risks, summary }), false);
});

test("production secret backend decision APIs and health metadata are read-only and sanitized", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/secret-backend-decision/summary");
    const decision = await getJson(port, "/readiness/secret-backend-decision/decision");
    const criteria = await getJson(port, "/readiness/secret-backend-decision/criteria");
    const scores = await getJson(port, "/readiness/secret-backend-decision/scores");
    const implementationScope = await getJson(port, "/readiness/secret-backend-decision/implementation-scope");
    const providerMapping = await getJson(port, "/readiness/secret-backend-decision/provider-mapping");
    const risks = await getJson(port, "/readiness/secret-backend-decision/risks");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/secret-backend-decision/decision");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).recommendedBackend, "vault");
    assert.equal((summary.body.summary as Record<string, unknown>).productionSecretBackendImplemented, false);
    assert.equal(decision.statusCode, 200);
    assert.equal((decision.body.decision as Record<string, unknown>).recommendedBackend, "vault");
    assert.equal(criteria.statusCode, 200);
    assert.equal((criteria.body.criteria as unknown[]).length > 0, true);
    assert.equal(scores.statusCode, 200);
    assert.equal((scores.body.scores as unknown[]).length > 0, true);
    assert.equal(implementationScope.statusCode, 200);
    assert.equal((implementationScope.body.implementationScopes as Array<Record<string, unknown>>).some((scope) => scope.backendKind === "vault" && scope.status === "v1_implemented"), true);
    assert.equal(providerMapping.statusCode, 200);
    assert.equal((providerMapping.body.providerMappings as Array<Record<string, unknown>>).some((mapping) => mapping.providerValue === "env" && mapping.productionStatus === "local_integration_only"), true);
    assert.equal(risks.statusCode, 200);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.secretBackendDecision as Record<string, unknown>).recommendedBackend, "vault");
    assert.equal((health.body.secretBackendDecision as Record<string, unknown>).productionSecretBackendImplemented, false);
    assert.equal((health.body.secretBackendDecision as Record<string, unknown>).envFallbackProductionAllowed, false);
    assert.equal((health.body.secretBackendDecision as Record<string, unknown>).noSecretValuesExposed, true);
    assert.equal((health.body.secretBackendDecision as Record<string, unknown>).noEnvValuesExposed, true);
    assert.equal((health.body.secretBackendDecision as Record<string, unknown>).credentialCachesRead, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasSecretOrEnvValue({ summary, decision, criteria, scores, implementationScope, providerMapping, risks, health }), false);
  }, {
    AICHESTRA_GITHUB_TOKEN: "ghp_secret_backend_decision",
    AICHESTRA_GITHUB_WEBHOOK_SECRET: "super-secret-decision-webhook",
    AICHESTRA_LLM_API_KEY: "sk-secret-backend-decision",
    GITHUB_APP_PRIVATE_KEY: "decision-private-key",
    VAULT_TOKEN: "credential-cache-secret",
    AWS_SECRET_ACCESS_KEY: "decision-aws-secret",
    SESSION_SECRET: "decision-session-secret",
    JWT_SECRET: "decision-jwt-secret"
  });
});

test("production secret backend decision dashboard panel renders decision data without secret values", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/secret-backend-decision");
    const panel = dashboard.body.secretBackendDecision as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).recommendedBackend, "vault");
    assert.equal((panel.summary as Record<string, unknown>).productionSecretBackendImplemented, false);
    assert.equal((panel.envFallbackWarning as Record<string, unknown>).productionAllowed, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).envValuesExposed, false);
    assert.equal(Array.isArray(panel.criteria), true);
    assert.equal(Array.isArray(panel.scores), true);
    assert.equal(Array.isArray(panel.implementationScopes), true);
    assert.equal(Array.isArray(panel.providerMappings), true);
    assert.equal(hasSecretOrEnvValue(dashboard), false);
  }, {
    AICHESTRA_GITHUB_TOKEN: "ghp_secret_backend_decision",
    AICHESTRA_LLM_API_KEY: "sk-secret-backend-decision",
    VAULT_TOKEN: "credential-cache-secret"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Production Secret Backend Decision"), true);
  assert.equal(html.includes("vault"), true);
  assert.equal(html.includes("Backend score summary"), true);
  assert.equal(html.includes("Env fallback warning"), true);
  assert.equal(html.includes("No-secret/no-env status"), true);
  assert.equal(hasSecretOrEnvValue(html), false);
});
