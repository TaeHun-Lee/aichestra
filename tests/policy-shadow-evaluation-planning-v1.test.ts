import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-16T00:00:00.000Z");

function hasUnsafePolicyShadowValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /POLICY_SHADOW_SECRET=|POLICY_RUNTIME_TOKEN=|POLICY_BUNDLE_SECRET=|OPA_TOKEN=|CEDAR_SECRET=|Bearer\s+policy|sk-policy-secret|ghp_policy_secret|SESSION_SECRET=|JWT_SECRET=|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|VAULT_TOKEN=|AICHESTRA_VAULT_TOKEN|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
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

test("policy shadow planning models are deterministic, read-only, and enforcement-neutral", () => {
  const service = createDeploymentReadinessService({
    env: {
      POLICY_SHADOW_SECRET: "sk-policy-secret",
      POLICY_RUNTIME_TOKEN: "runtime-secret",
      OPA_TOKEN: "Bearer policy-token",
      CEDAR_SECRET: "cedar-secret",
      JWT_SECRET: "jwt-secret"
    },
    now: () => fixedNow
  });

  const plan = service.getPolicyShadowEvaluationPlan();
  const rules = service.listPolicyShadowComparisonRules();
  const mismatches = service.listPolicyShadowMismatchTaxonomy();
  const reports = service.listPolicyShadowEvaluationReports();
  const checks = service.listPolicyShadowReadinessChecks();
  const summary = service.getPolicyShadowEvaluationSummary();

  assert.equal(plan.status, "ready_for_design");
  assert.equal(plan.sourceOfTruth, "StaticPolicyEngine");
  assert.equal(plan.enforcementMode, "shadow_only");
  assert.equal(plan.candidateRuntimeKinds.includes("signed_json_yaml_bundle_evaluator_future"), true);
  assert.equal(plan.domains.includes("secretref_vault_credential_resolution"), true);
  assert.equal(rules.length, 6);
  assert.equal(rules.some((rule) => rule.comparisonKind === "effect_match" && rule.required && rule.severityOnMismatch === "critical"), true);
  assert.equal(rules.some((rule) => rule.comparisonKind === "redaction_match" && rule.required && rule.severityOnMismatch === "critical"), true);
  assert.equal(mismatches.length, 10);
  assert.equal(mismatches.some((mismatch) => mismatch.mismatchKind === "static_deny_candidate_allow" && mismatch.severity === "critical"), true);
  assert.equal(mismatches.some((mismatch) => mismatch.mismatchKind === "redaction_mismatch" && mismatch.defaultAction === "block_rollout_future"), true);
  assert.equal(reports.length, 1);
  assert.equal(reports[0]?.enforcementChanged, false);
  assert.equal(reports[0]?.sourceOfTruth, "StaticPolicyEngine");
  assert.equal(checks.some((check) => check.category === "candidate_runtime" && check.status === "future"), true);
  assert.equal(checks.some((check) => check.category === "safety" && check.status === "pass" && check.severity === "critical"), true);
  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.sourceOfTruth, "StaticPolicyEngine");
  assert.equal(summary.enforcementMode, "shadow_only");
  assert.equal(summary.shadowEvaluatorImplemented, false);
  assert.equal(summary.candidateRuntimeImplemented, false);
  assert.equal(summary.candidateRuntimeInterfaceImplemented, false);
  assert.equal(summary.enforcementChanged, false);
  assert.equal(summary.staticPolicyEngineUnchanged, true);
  assert.equal(summary.goldenHarnessSourceOfTruth, "StaticPolicyEngine");
  assert.equal(summary.comparisonRuleCount, 6);
  assert.equal(summary.mismatchTaxonomyCount, 10);
  assert.equal(summary.criticalMismatchKindCount, 3);
  assert.equal(summary.dynamicPolicyExecutionEnabled, false);
  assert.equal(summary.policyCodeExecuted, false);
  assert.equal(summary.externalPolicyServiceCallsEnabled, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(hasUnsafePolicyShadowValue({ plan, rules, mismatches, reports, checks, summary }), false);
});

test("policy shadow readiness APIs are read-only and do not run candidate runtimes", async () => {
  await withApiServer(async (port) => {
    const plan = await getJson(port, "/readiness/policy-shadow/plan");
    const rules = await getJson(port, "/readiness/policy-shadow/comparison-rules");
    const mismatches = await getJson(port, "/readiness/policy-shadow/mismatches");
    const checks = await getJson(port, "/readiness/policy-shadow/checks?category=safety");
    const summary = await getJson(port, "/readiness/policy-shadow/summary");
    const writeAttempt = await postJson(port, "/readiness/policy-shadow/summary");

    assert.equal(plan.statusCode, 200);
    assert.equal((plan.body.plan as Record<string, unknown>).sourceOfTruth, "StaticPolicyEngine");
    assert.equal((plan.body.plan as Record<string, unknown>).enforcementMode, "shadow_only");
    assert.equal(rules.statusCode, 200);
    assert.equal((rules.body.comparisonRules as unknown[]).length, 6);
    assert.equal(mismatches.statusCode, 200);
    assert.equal((mismatches.body.mismatches as unknown[]).length, 10);
    assert.equal(checks.statusCode, 200);
    assert.equal((checks.body.checks as Array<Record<string, unknown>>).every((check) => check.category === "safety"), true);
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).sourceOfTruth, "StaticPolicyEngine");
    assert.equal((summary.body.summary as Record<string, unknown>).shadowEvaluatorImplemented, false);
    assert.equal((summary.body.summary as Record<string, unknown>).candidateRuntimeImplemented, false);
    assert.equal((summary.body.summary as Record<string, unknown>).enforcementChanged, false);
    assert.equal((summary.body.summary as Record<string, unknown>).dynamicPolicyExecutionEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).policyCodeExecuted, false);
    assert.equal((summary.body.summary as Record<string, unknown>).externalPolicyServiceCallsEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((summary.body.summary as Record<string, unknown>).envValuesExposed, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasUnsafePolicyShadowValue({ plan, rules, mismatches, checks, summary }), false);
  }, {
    POLICY_SHADOW_SECRET: "sk-policy-secret",
    POLICY_RUNTIME_TOKEN: "runtime-secret",
    OPA_TOKEN: "Bearer policy-token",
    CEDAR_SECRET: "cedar-secret"
  });
});

test("policy runtime dashboard exposes shadow planning without claiming active shadow evaluation", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/policy-runtime-poc");
    const panel = dashboard.body.policyRuntimePoc as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.shadowSummary as Record<string, unknown>).status, "v1_implemented");
    assert.equal((panel.shadowSummary as Record<string, unknown>).sourceOfTruth, "StaticPolicyEngine");
    assert.equal((panel.shadowSummary as Record<string, unknown>).shadowEvaluatorImplemented, false);
    assert.equal((panel.shadowSummary as Record<string, unknown>).candidateRuntimeImplemented, false);
    assert.equal((panel.shadowSummary as Record<string, unknown>).enforcementChanged, false);
    assert.equal((panel.shadowSummary as Record<string, unknown>).dynamicPolicyExecutionEnabled, false);
    assert.equal(Array.isArray(panel.shadowComparisonRules), true);
    assert.equal((panel.shadowComparisonRules as unknown[]).length, 6);
    assert.equal(Array.isArray(panel.shadowMismatchTaxonomy), true);
    assert.equal((panel.shadowMismatchTaxonomy as unknown[]).length, 10);
    assert.equal((panel.shadowEvaluation as Record<string, unknown>).enforcementChanged, false);
    assert.equal((panel.shadowEvaluation as Record<string, unknown>).candidateRuntimeImplemented, false);
    assert.equal(hasUnsafePolicyShadowValue(dashboard), false);
  }, {
    POLICY_SHADOW_SECRET: "sk-policy-secret"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Policy Runtime PoC Planning"), true);
  assert.equal(html.includes("Shadow planning v1"), true);
  assert.equal(html.includes("Shadow comparison rules"), true);
  assert.equal(html.includes("Shadow mismatch taxonomy"), true);
  assert.equal(html.includes("enforcement changed false"), true);
  assert.equal(hasUnsafePolicyShadowValue(html), false);
});
