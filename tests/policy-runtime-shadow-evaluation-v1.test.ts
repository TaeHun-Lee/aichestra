import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-17T00:00:00.000Z");

function hasUnsafePolicyShadowValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /POLICY_BUNDLE_SECRET=|POLICY_SHADOW_SECRET=|OPA_TOKEN=|CEDAR_SECRET=|Bearer\s+policy|sk-policy-secret|ghp_policy_secret|OPENAI_API_KEY=|ANTHROPIC_API_KEY=|GITHUB_TOKEN=|GITHUB_APP_PRIVATE_KEY=|SESSION_SECRET=|JWT_SECRET=|DATABASE_URL=|AICHESTRA_DATABASE_URL=|VAULT_TOKEN=|~\/\.codex|~\/\.claude|auth\.json|credential[_\s-]*cache[_\s-]*(path|file|value)=/i.test(text);
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

test("policy shadow evaluation planning models are read-only and keep StaticPolicyEngine authoritative", () => {
  const service = createDeploymentReadinessService({
    env: {
      POLICY_SHADOW_SECRET: "sk-policy-secret",
      OPA_TOKEN: "Bearer policy-token",
      CEDAR_SECRET: "cedar-secret",
      SESSION_SECRET: "session-secret"
    },
    staticPolicyRuleCount: 42,
    now: () => fixedNow
  });

  const plan = service.getPolicyShadowEvaluationPlan();
  const rules = service.listPolicyShadowComparisonRules();
  const mismatches = service.listPolicyShadowMismatches();
  const reports = service.listPolicyShadowEvaluationReports();
  const checks = service.listPolicyShadowReadinessChecks();
  const summary = service.getPolicyShadowEvaluationSummary();

  assert.equal(plan.sourceOfTruth, "StaticPolicyEngine");
  assert.equal(plan.enforcementMode, "shadow_only");
  assert.equal(plan.metadata.enforcementChanged, false);
  assert.equal(plan.metadata.shadowEvaluatorImplemented, false);
  assert.equal(plan.metadata.candidateRuntimeImplemented, false);
  assert.equal(rules.some((rule) => rule.comparisonKind === "effect_match" && rule.required && rule.severityOnMismatch === "critical"), true);
  assert.equal(rules.some((rule) => rule.comparisonKind === "redaction_match" && rule.required), true);
  assert.equal(mismatches.some((mismatch) => mismatch.mismatchKind === "static_deny_candidate_allow" && mismatch.severity === "critical" && mismatch.defaultAction === "block_rollout_future"), true);
  assert.equal(mismatches.some((mismatch) => mismatch.mismatchKind === "redaction_mismatch" && mismatch.severity === "critical"), true);
  assert.equal(reports.every((report) => report.enforcementChanged === false && report.caseCount === 0), true);
  assert.equal(checks.some((check) => check.category === "safety" && check.status === "pass"), true);
  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.sourceOfTruth, "StaticPolicyEngine");
  assert.equal(summary.enforcementChanged, false);
  assert.equal(summary.staticPolicyEngineAuthoritative, true);
  assert.equal(summary.shadowEvaluatorImplemented, false);
  assert.equal(summary.candidateRuntimeImplemented, false);
  assert.equal(summary.candidateRuntimeExecuted, false);
  assert.equal(summary.dynamicPolicyExecutionEnabled, false);
  assert.equal(summary.externalPolicyServiceCallsEnabled, false);
  assert.equal(summary.policyCodeExecuted, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(hasUnsafePolicyShadowValue({ plan, rules, mismatches, reports, checks, summary }), false);
});

test("policy shadow readiness APIs and health metadata are read-only and sanitized", async () => {
  await withApiServer(async (port) => {
    const plan = await getJson(port, "/readiness/policy-shadow/plan");
    const rules = await getJson(port, "/readiness/policy-shadow/comparison-rules");
    const mismatches = await getJson(port, "/readiness/policy-shadow/mismatches");
    const reports = await getJson(port, "/readiness/policy-shadow/reports");
    const checks = await getJson(port, "/readiness/policy-shadow/checks?category=safety");
    const summary = await getJson(port, "/readiness/policy-shadow/summary");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/policy-shadow/summary");

    assert.equal(plan.statusCode, 200);
    assert.equal((plan.body.plan as Record<string, unknown>).sourceOfTruth, "StaticPolicyEngine");
    assert.equal((plan.body.plan as Record<string, unknown>).enforcementMode, "shadow_only");
    assert.equal(rules.statusCode, 200);
    assert.equal((rules.body.comparisonRules as unknown[]).length >= 6, true);
    assert.equal(mismatches.statusCode, 200);
    assert.equal((mismatches.body.mismatches as unknown[]).length >= 10, true);
    assert.equal(reports.statusCode, 200);
    assert.equal((reports.body.reports as Array<Record<string, unknown>>).every((report) => report.enforcementChanged === false), true);
    assert.equal(checks.statusCode, 200);
    assert.equal((checks.body.checks as Array<Record<string, unknown>>).every((check) => check.category === "safety"), true);
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).status, "v1_implemented");
    assert.equal((summary.body.summary as Record<string, unknown>).enforcementChanged, false);
    assert.equal((summary.body.summary as Record<string, unknown>).candidateRuntimeImplemented, false);
    assert.equal((summary.body.summary as Record<string, unknown>).dynamicPolicyExecutionEnabled, false);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).sourceOfTruth, "StaticPolicyEngine");
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).enforcementChanged, false);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).candidateRuntimeImplemented, false);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).policyCodeExecuted, false);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).envValuesExposed, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasUnsafePolicyShadowValue({ plan, rules, mismatches, reports, checks, summary, health }), false);
  }, {
    POLICY_SHADOW_SECRET: "sk-policy-secret",
    OPA_TOKEN: "Bearer policy-token",
    CEDAR_SECRET: "cedar-secret",
    JWT_SECRET: "jwt-secret"
  });
});

test("policy shadow dashboard panel does not imply runtime execution", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/policy-shadow");
    const panel = dashboard.body.policyShadow as Record<string, unknown>;
    const summary = panel.summary as Record<string, unknown>;
    const noExecutionStatus = panel.noExecutionStatus as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal(summary.productionReady, false);
    assert.equal(summary.sourceOfTruth, "StaticPolicyEngine");
    assert.equal(summary.enforcementChanged, false);
    assert.equal(summary.candidateRuntimeImplemented, false);
    assert.equal(summary.shadowEvaluatorImplemented, false);
    assert.equal(noExecutionStatus.staticPolicyEngineAuthoritative, true);
    assert.equal(noExecutionStatus.candidateRuntimeExecuted, false);
    assert.equal(noExecutionStatus.policyCodeExecuted, false);
    assert.equal(noExecutionStatus.noSecretsExposed, true);
    assert.equal(noExecutionStatus.envValuesExposed, false);
    assert.equal(Array.isArray(panel.comparisonRules), true);
    assert.equal(Array.isArray(panel.mismatchTaxonomy), true);
    assert.equal(Array.isArray(panel.criticalMismatchExamples), true);
    assert.equal(hasUnsafePolicyShadowValue(dashboard), false);
  }, {
    POLICY_SHADOW_SECRET: "sk-policy-secret",
    OPA_TOKEN: "Bearer policy-token"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Policy Runtime Shadow Evaluation"), true);
  assert.equal(html.includes("StaticPolicyEngine"), true);
  assert.equal(html.includes("candidate runtime not implemented"), true);
  assert.equal(html.includes("dynamic execution disabled"), true);
  assert.equal(hasUnsafePolicyShadowValue(html), false);
});
