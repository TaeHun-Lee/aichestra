import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-15T00:00:00.000Z");

function hasUnsafePolicyRuntimeValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /POLICY_BUNDLE_SECRET=|OPA_TOKEN=|CEDAR_SECRET=|POLICY_RUNTIME_TOKEN=|Bearer\s+policy|sk-policy-secret|ghp_policy_secret|SESSION_SECRET=|JWT_SECRET=|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|VAULT_TOKEN=|AICHESTRA_VAULT_TOKEN=|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
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

test("policy runtime PoC models expose options, contract, mappings, golden cases, checks, risks, and summary safely", () => {
  const service = createDeploymentReadinessService({
    env: {
      POLICY_BUNDLE_SECRET: "sk-policy-secret",
      OPA_TOKEN: "Bearer policy-token",
      CEDAR_SECRET: "cedar-secret",
      POLICY_RUNTIME_TOKEN: "runtime-secret",
      JWT_SECRET: "jwt-secret"
    },
    now: () => fixedNow
  });

  const summary = service.getPolicyRuntimePocSummary();
  const options = service.listPolicyRuntimePocOptions();
  const contract = service.getPolicyRuntimePocInputContract();
  const mappings = service.listPolicyRuntimePocDomainMappings();
  const goldenCases = service.listPolicyRuntimePocGoldenCases();
  const checks = service.listPolicyRuntimePocReadinessChecks();
  const risks = service.listPolicyRuntimePocRisks();

  assert.equal(summary.status, "v0_implemented");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.currentRuntime, "StaticPolicyEngine");
  assert.equal(summary.staticPolicyEngineUnchanged, true);
  assert.equal(summary.recommendedPocOptionId, "policy_runtime_poc_signed_json_yaml");
  assert.equal(summary.runtimeEnforcementEnabled, false);
  assert.equal(summary.shadowEvaluationImplemented, false);
  assert.equal(summary.externalPolicyEngineEnabled, false);
  assert.equal(summary.opaRuntimeImplemented, false);
  assert.equal(summary.cedarRuntimeImplemented, false);
  assert.equal(summary.signedJsonYamlRuntimeImplemented, false);
  assert.equal(summary.customPolicyServiceImplemented, false);
  assert.equal(summary.dynamicPolicyExecutionEnabled, false);
  assert.equal(summary.remotePolicyLoadingEnabled, false);
  assert.equal(summary.hotReloadEnabled, false);
  assert.equal(summary.policyCodeExecuted, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(options.some((option) => option.optionKind === "signed_json_yaml_bundle_evaluator_future" && option.status === "recommended_for_poc"), true);
  assert.equal(options.some((option) => option.optionKind === "opa_rego_local_library_future" && option.runtimeImplemented === false), true);
  assert.equal(options.some((option) => option.optionKind === "cedar_local_evaluator_future" && option.runtimeImplemented === false), true);
  assert.equal(contract.subjectFields.includes("actorId"), true);
  assert.equal(contract.resourceFields.includes("tenantId"), true);
  assert.equal(contract.outputFields.includes("redactionRequirements"), true);
  assert.equal(contract.supportedDecisions.includes("warn"), true);
  assert.equal(mappings.length, 13);
  assert.equal(mappings.some((mapping) => mapping.domain === "secretref_vault_credential_resolution"), true);
  assert.equal(goldenCases.length, 15);
  assert.equal(goldenCases.some((goldenCase) => goldenCase.id === "git_remote_merge_denied" && goldenCase.expectedDecision === "deny"), true);
  assert.equal(goldenCases.some((goldenCase) => goldenCase.id === "vault_secret_resolution_requires_auth_policy_path_allowlist" && goldenCase.expectedDecision === "allow_when_gated"), true);
  assert.equal(checks.some((check) => check.id === "policy_runtime_poc_shadow_evaluator_future" && check.status === "fail" && check.severity === "critical"), true);
  assert.equal(risks.some((risk) => risk.id === "policy_runtime_poc_risk_dynamic_execution" && risk.severity === "critical"), true);
  assert.equal(hasUnsafePolicyRuntimeValue({ summary, options, contract, mappings, goldenCases, checks, risks }), false);
});

test("policy runtime PoC readiness APIs and health metadata are read-only and do not execute policy runtimes", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/policy-runtime-poc/summary");
    const options = await getJson(port, "/readiness/policy-runtime-poc/options");
    const contract = await getJson(port, "/readiness/policy-runtime-poc/input-contract");
    const mappings = await getJson(port, "/readiness/policy-runtime-poc/domain-mappings");
    const goldenCases = await getJson(port, "/readiness/policy-runtime-poc/golden-cases");
    const goldenSummary = await getJson(port, "/readiness/policy-runtime-poc/golden-summary");
    const checks = await getJson(port, "/readiness/policy-runtime-poc/checks?category=shadow_evaluation");
    const risks = await getJson(port, "/readiness/policy-runtime-poc/risks");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/policy-runtime-poc/summary");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).currentRuntime, "StaticPolicyEngine");
    assert.equal((summary.body.summary as Record<string, unknown>).runtimeEnforcementEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).dynamicPolicyExecutionEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).policyCodeExecuted, false);
    assert.equal(options.statusCode, 200);
    assert.equal((options.body.options as unknown[]).length >= 6, true);
    assert.equal(contract.statusCode, 200);
    assert.equal(((contract.body.inputContract as Record<string, unknown>).outputFields as unknown[]).includes("decision"), true);
    assert.equal(mappings.statusCode, 200);
    assert.equal((mappings.body.domainMappings as unknown[]).length, 13);
    assert.equal(goldenCases.statusCode, 200);
    assert.equal((goldenCases.body.goldenCases as unknown[]).length, 15);
    assert.equal(goldenSummary.statusCode, 200);
    assert.equal((goldenSummary.body.goldenSummary as Record<string, unknown>).sourceOfTruth, "StaticPolicyEngine");
    assert.equal((goldenSummary.body.goldenSummary as Record<string, unknown>).totalCases, 42);
    assert.equal((goldenSummary.body.goldenSummary as Record<string, unknown>).failedCases, 0);
    assert.equal((goldenSummary.body.goldenSummary as Record<string, unknown>).dynamicPolicyExecutionEnabled, false);
    assert.equal((goldenSummary.body.goldenResults as unknown[]).length, 42);
    assert.equal(checks.statusCode, 200);
    assert.equal((checks.body.checks as Array<Record<string, unknown>>).every((check) => check.category === "shadow_evaluation"), true);
    assert.equal(risks.statusCode, 200);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.policyRuntimePoc as Record<string, unknown>).currentRuntime, "StaticPolicyEngine");
    assert.equal((health.body.policyRuntimePoc as Record<string, unknown>).runtimeEnforcementEnabled, false);
    assert.equal((health.body.policyRuntimePoc as Record<string, unknown>).shadowEvaluationImplemented, false);
    assert.equal((health.body.policyRuntimePoc as Record<string, unknown>).dynamicPolicyExecutionEnabled, false);
    assert.equal((health.body.policyRuntimePoc as Record<string, unknown>).policyCodeExecuted, false);
    assert.equal((health.body.policyRuntimePoc as Record<string, unknown>).staticPolicyEngineUnchanged, true);
    assert.equal((health.body.policyRuntimePoc as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((health.body.policyRuntimePoc as Record<string, unknown>).noEnvValuesExposed, true);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasUnsafePolicyRuntimeValue({ summary, options, contract, mappings, goldenCases, goldenSummary, checks, risks, health }), false);
  }, {
    POLICY_BUNDLE_SECRET: "sk-policy-secret",
    OPA_TOKEN: "Bearer policy-token",
    CEDAR_SECRET: "cedar-secret",
    POLICY_RUNTIME_TOKEN: "runtime-secret"
  });
});

test("policy runtime PoC dashboard panel renders without runtime execution or secret exposure", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/policy-runtime-poc");
    const panel = dashboard.body.policyRuntimePoc as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).currentRuntime, "StaticPolicyEngine");
    assert.equal((panel.summary as Record<string, unknown>).runtimeEnforcementEnabled, false);
    assert.equal((panel.noExecutionStatus as Record<string, unknown>).dynamicPolicyExecutionEnabled, false);
    assert.equal((panel.noExecutionStatus as Record<string, unknown>).opaRuntimeImplemented, false);
    assert.equal((panel.noExecutionStatus as Record<string, unknown>).cedarRuntimeImplemented, false);
    assert.equal((panel.noExecutionStatus as Record<string, unknown>).policyCodeExecuted, false);
    assert.equal(Array.isArray(panel.options), true);
    assert.equal(Array.isArray(panel.domainMappings), true);
    assert.equal(Array.isArray(panel.goldenCases), true);
    assert.equal((panel.goldenHarness as Record<string, unknown>).sourceOfTruth, "StaticPolicyEngine");
    assert.equal((panel.goldenHarness as Record<string, unknown>).totalCases, 42);
    assert.equal((panel.goldenHarness as Record<string, unknown>).failedCases, 0);
    assert.equal(Array.isArray(panel.goldenHarnessResults), true);
    assert.equal(hasUnsafePolicyRuntimeValue(dashboard), false);
  }, {
    POLICY_RUNTIME_TOKEN: "runtime-secret"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Policy Runtime PoC Planning"), true);
  assert.equal(html.includes("PoC options"), true);
  assert.equal(html.includes("Input/output contract"), true);
  assert.equal(html.includes("Domain PoC mapping"), true);
  assert.equal(html.includes("Golden decision tests"), true);
  assert.equal(html.includes("Golden harness"), true);
  assert.equal(html.includes("Shadow evaluation"), true);
  assert.equal(html.includes("No runtime execution"), true);
  assert.equal(hasUnsafePolicyRuntimeValue(html), false);
});
