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

function hasPolicySecretOrRuntimeValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /POLICY_BUNDLE_SECRET=|OPA_TOKEN=|CEDAR_SECRET=|Bearer\s+policy|sk-policy-secret|ghp_policy_secret|SESSION_SECRET=|JWT_SECRET=|DATABASE_URL=|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
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

test("policy bundle planning models expose engines, bundles, domain mappings, checks, risks, phases, and summary safely", () => {
  const service = createDeploymentReadinessService({
    env: {
      POLICY_BUNDLE_SECRET: "sk-policy-secret",
      OPA_TOKEN: "Bearer policy-token",
      CEDAR_SECRET: "cedar-secret",
      SESSION_SECRET: "session-secret"
    },
    staticPolicyRuleCount: 42,
    now: () => fixedNow
  });

  const summary = service.getPolicyBundleReadinessSummary();
  const engines = service.listPolicyEngineOptions();
  const plans = service.listPolicyBundlePlans();
  const mappings = service.listPolicyDomainMappings();
  const checks = service.listPolicyBundleReadinessChecks();
  const risks = service.listPolicyBundleRisks();
  const phases = service.listPolicyBundleMigrationPhases();

  assert.equal(summary.status, "v0_implemented");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.currentEngineKind, "static_typescript_current");
  assert.equal(summary.staticPolicyRuleCount, 42);
  assert.equal(summary.externalPolicyEngineEnabled, false);
  assert.equal(summary.opaIntegrationEnabled, false);
  assert.equal(summary.cedarIntegrationEnabled, false);
  assert.equal(summary.signedBundleVerificationEnabled, false);
  assert.equal(summary.dynamicPolicyExecutionEnabled, false);
  assert.equal(summary.remotePolicyLoadingEnabled, false);
  assert.equal(summary.policyRuntimeChanged, false);
  assert.equal(summary.policyCodeExecuted, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(engines.some((engine) => engine.engineKind === "static_typescript_current" && engine.status === "current"), true);
  assert.equal(engines.some((engine) => engine.engineKind === "signed_json_yaml_bundle" && engine.status === "recommended"), true);
  assert.equal(engines.some((engine) => engine.engineKind === "opa_rego" && !engine.metadata.runtimeImplemented), true);
  assert.equal(engines.some((engine) => engine.engineKind === "cedar" && !engine.metadata.runtimeImplemented), true);
  assert.equal(plans.some((plan) => plan.id === "policy_bundle_schema_bridge" && plan.status === "planned"), true);
  assert.equal(mappings.length >= 14, true);
  assert.equal(mappings.some((mapping) => mapping.domain === "secretref" && mapping.migrationStatus === "mapped"), true);
  assert.equal(mappings.some((mapping) => mapping.domain === "auth" && mapping.migrationStatus === "gap"), true);
  assert.equal(checks.some((check) => check.id === "policy_bundle_break_glass_future" && check.status === "fail" && check.severity === "critical"), true);
  assert.equal(risks.some((risk) => risk.id === "policy_bundle_risk_dynamic_execution" && risk.severity === "critical"), true);
  assert.equal(phases.some((phase) => phase.id === "policy_bundle_phase_3_review_and_signing" && phase.status === "blocked"), true);
  assert.equal(hasPolicySecretOrRuntimeValue({ summary, engines, plans, mappings, checks, risks, phases }), false);
});

test("policy bundle readiness APIs and health metadata are read-only and do not enable dynamic policy execution", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/policy-bundles/summary");
    const engines = await getJson(port, "/readiness/policy-bundles/engines");
    const plans = await getJson(port, "/readiness/policy-bundles/plans");
    const mappings = await getJson(port, "/readiness/policy-bundles/domain-mapping");
    const checks = await getJson(port, "/readiness/policy-bundles/checks?category=break_glass");
    const risks = await getJson(port, "/readiness/policy-bundles/risks");
    const phases = await getJson(port, "/readiness/policy-bundles/migration-phases");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/policy-bundles/summary");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).status, "v0_implemented");
    assert.equal((summary.body.summary as Record<string, unknown>).productionReady, false);
    assert.equal((summary.body.summary as Record<string, unknown>).externalPolicyEngineEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).dynamicPolicyExecutionEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).policyCodeExecuted, false);
    assert.equal(engines.statusCode, 200);
    assert.equal((engines.body.engines as unknown[]).length > 0, true);
    assert.equal(plans.statusCode, 200);
    assert.equal((plans.body.plans as unknown[]).length > 0, true);
    assert.equal(mappings.statusCode, 200);
    assert.equal((mappings.body.domainMapping as unknown[]).length >= 14, true);
    assert.equal(checks.statusCode, 200);
    assert.equal((checks.body.checks as Array<Record<string, unknown>>).every((check) => check.category === "break_glass"), true);
    assert.equal(risks.statusCode, 200);
    assert.equal(phases.statusCode, 200);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.policyBundleReadiness as Record<string, unknown>).policyEngineKind, "static_typescript_current");
    assert.equal((health.body.policyBundleReadiness as Record<string, unknown>).externalPolicyEngineEnabled, false);
    assert.equal((health.body.policyBundleReadiness as Record<string, unknown>).signedBundleVerificationEnabled, false);
    assert.equal((health.body.policyBundleReadiness as Record<string, unknown>).dynamicPolicyExecutionEnabled, false);
    assert.equal((health.body.policyBundleReadiness as Record<string, unknown>).remotePolicyLoadingEnabled, false);
    assert.equal((health.body.policyBundleReadiness as Record<string, unknown>).policyCodeExecuted, false);
    assert.equal((health.body.policyBundleReadiness as Record<string, unknown>).noSecretsExposed, true);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasPolicySecretOrRuntimeValue({ summary, engines, plans, mappings, checks, risks, phases, health }), false);
  }, {
    POLICY_BUNDLE_SECRET: "sk-policy-secret",
    OPA_TOKEN: "Bearer policy-token",
    CEDAR_SECRET: "cedar-secret",
    JWT_SECRET: "jwt-secret"
  });
});

test("policy bundle dashboard panel renders readiness without executing policy code or exposing secrets", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/policy-bundles");
    const panel = dashboard.body.policyBundles as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).currentEngineKind, "static_typescript_current");
    assert.equal((panel.noExecutionStatus as Record<string, unknown>).dynamicPolicyExecutionEnabled, false);
    assert.equal((panel.noExecutionStatus as Record<string, unknown>).externalPolicyEngineEnabled, false);
    assert.equal((panel.noExecutionStatus as Record<string, unknown>).policyCodeExecuted, false);
    assert.equal(Array.isArray(panel.engineOptions), true);
    assert.equal(Array.isArray(panel.domainMappings), true);
    assert.equal(hasPolicySecretOrRuntimeValue(dashboard), false);
  }, {
    POLICY_BUNDLE_SECRET: "sk-policy-secret",
    OPA_TOKEN: "Bearer policy-token"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Policy Bundle / OPA-Cedar Readiness"), true);
  assert.equal(html.includes("Engine options"), true);
  assert.equal(html.includes("Domain mapping coverage"), true);
  assert.equal(html.includes("Review workflow"), true);
  assert.equal(html.includes("Policy test strategy"), true);
  assert.equal(html.includes("Rollout and rollback"), true);
  assert.equal(html.includes("Break-glass"), true);
  assert.equal(html.includes("No dynamic policy execution"), true);
  assert.equal(hasPolicySecretOrRuntimeValue(html), false);
});

test("policy bundle planning keeps StaticPolicyEngine as runtime and all real policy engines disabled", () => {
  const service = createDeploymentReadinessService({ staticPolicyRuleCount: 17, now: () => fixedNow });
  const summary = service.getPolicyBundleReadinessSummary();
  const engines = service.listPolicyEngineOptions();
  const phases = service.listPolicyBundleMigrationPhases();

  assert.equal(summary.currentEngineKind, "static_typescript_current");
  assert.equal(summary.policyRuntimeChanged, false);
  assert.equal(summary.policyBundleManagementEnabled, false);
  assert.equal(summary.externalPolicyEngineEnabled, false);
  assert.equal(summary.dynamicPolicyExecutionEnabled, false);
  assert.equal(summary.remotePolicyLoadingEnabled, false);
  assert.equal(engines.some((engine) => engine.engineKind === "opa_rego" && engine.metadata.runtimeImplemented === false), true);
  assert.equal(engines.some((engine) => engine.engineKind === "cedar" && engine.metadata.runtimeImplemented === false), true);
  assert.equal(phases.some((phase) => phase.metadata.runtimeActivationImplemented === false), true);
});
