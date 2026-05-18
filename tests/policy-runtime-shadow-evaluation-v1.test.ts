import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import {
  createDisabledPolicyShadowEvaluator,
  createMockPolicyShadowEvaluator,
  goldenCaseExpectedDecisionToMockCandidate,
  policyRuntimeGoldenCaseToShadowInput,
  policyRuntimeGoldenCases,
  policyShadowEvaluatorMismatchTypes,
  runPolicyShadowGoldenMockReport
} from "@aichestra/policy";
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
  assert.equal(summary.shadowEvaluatorSkeletonImplemented, true);
  assert.equal(summary.shadowEvaluatorEnabled, false);
  assert.equal(summary.mockComparisonSupported, true);
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

test("policy shadow evaluator skeleton defaults to disabled and compares mock decisions deterministically", () => {
  const fixed = new Date("2026-05-17T01:00:00.000Z");
  const denyCase = policyRuntimeGoldenCases.find((goldenCase) => goldenCase.id === "git_remote_merge_denied");
  const blockCase = policyRuntimeGoldenCases.find((goldenCase) => goldenCase.id === "local_agent_consent_required");
  assert.ok(denyCase);
  assert.ok(blockCase);

  const disabled = createDisabledPolicyShadowEvaluator({ now: () => fixed });
  const disabledStatus = disabled.getStatus();
  const disabledResult = disabled.evaluateShadow(policyRuntimeGoldenCaseToShadowInput(denyCase));

  assert.equal(disabledStatus.enabled, false);
  assert.equal(disabledStatus.running, false);
  assert.equal(disabledStatus.candidateRuntimeImplemented, false);
  assert.equal(disabledStatus.enforcementChanged, false);
  assert.equal(disabledStatus.sourceOfTruth, "StaticPolicyEngine");
  assert.equal(disabledResult.status, "disabled");
  assert.equal(disabledResult.candidateRuntimeKind, "disabled");
  assert.equal(disabledResult.enforcementChanged, false);
  assert.equal(disabledResult.comparison.summary, "candidate_runtime_not_executed");
  assert.equal(disabledResult.metadata.noDynamicPolicyExecution, true);

  const mock = createMockPolicyShadowEvaluator({ now: () => fixed });
  const matchingResult = mock.evaluateShadow({
    ...policyRuntimeGoldenCaseToShadowInput(denyCase),
    candidateDecision: goldenCaseExpectedDecisionToMockCandidate(denyCase)
  });

  assert.equal(matchingResult.status, "compared_mock");
  assert.equal(matchingResult.candidateRuntimeKind, "mock");
  assert.equal(matchingResult.enforcementChanged, false);
  assert.equal(matchingResult.comparison.effectMatches, true);
  assert.equal(matchingResult.comparison.reasonMatches, true);
  assert.equal(matchingResult.mismatches.length, 0);
  assert.equal(matchingResult.metadata.candidateRuntimeImplemented, false);
  assert.equal(matchingResult.metadata.candidateRuntimeExecuted, false);

  const denyVsAllow = mock.evaluateShadow({
    ...policyRuntimeGoldenCaseToShadowInput(denyCase),
    candidateDecision: {
      ...goldenCaseExpectedDecisionToMockCandidate(denyCase),
      effect: "allow",
      reason: "candidate incorrectly allowed static deny"
    }
  });
  assert.equal(denyVsAllow.status, "mismatch_detected");
  assert.equal(denyVsAllow.mismatches.some((mismatch) => mismatch.mismatchKind === "static_deny_candidate_allow" && mismatch.severity === "critical" && mismatch.defaultAction === "block_rollout_future"), true);

  const blockVsAllow = mock.evaluateShadow({
    ...policyRuntimeGoldenCaseToShadowInput(blockCase),
    candidateDecision: {
      ...goldenCaseExpectedDecisionToMockCandidate(blockCase),
      effect: "allow",
      reason: "candidate incorrectly allowed static block"
    }
  });
  assert.equal(blockVsAllow.status, "mismatch_detected");
  assert.equal(blockVsAllow.mismatches.some((mismatch) => mismatch.mismatchKind === "static_block_candidate_allow" && mismatch.severity === "critical" && mismatch.defaultAction === "block_rollout_future"), true);

  const reasonMismatch = mock.evaluateShadow({
    ...policyRuntimeGoldenCaseToShadowInput(denyCase),
    candidateDecision: {
      ...goldenCaseExpectedDecisionToMockCandidate(denyCase),
      reason: "candidate supplied a different reason"
    }
  });
  assert.equal(reasonMismatch.mismatches.some((mismatch) => mismatch.mismatchKind === "reason_mismatch" && mismatch.defaultAction === "record_only"), true);

  const redactionMismatch = mock.evaluateShadow({
    ...policyRuntimeGoldenCaseToShadowInput(denyCase),
    candidateDecision: {
      ...goldenCaseExpectedDecisionToMockCandidate(denyCase),
      redactionRequirements: ["never_return_raw_secrets"]
    }
  });
  assert.equal(redactionMismatch.mismatches.some((mismatch) => mismatch.mismatchKind === "redaction_mismatch" && mismatch.severity === "critical" && mismatch.defaultAction === "block_rollout_future"), true);
  assert.equal([...denyVsAllow.mismatches, ...blockVsAllow.mismatches, ...reasonMismatch.mismatches, ...redactionMismatch.mismatches].some((mismatch) => String(mismatch.defaultAction) === "enforce_now"), false);
  assert.equal(policyShadowEvaluatorMismatchTypes.every((mismatch) => mismatch.defaultAction === "record_only" || mismatch.defaultAction === "block_rollout_future"), true);
});

test("policy shadow golden mock report exposes fixture coverage without changing enforcement", () => {
  const report = runPolicyShadowGoldenMockReport();

  assert.equal(report.fixtureReport.goldenCaseCount, 42);
  assert.equal(report.fixtureReport.domainsCovered.includes("git"), true);
  assert.equal(report.fixtureReport.domainsCovered.includes("tenant_scope"), true);
  assert.equal(report.fixtureReport.mockComparisonSupported, true);
  assert.equal(report.fixtureReport.shadowEvaluatorEnabled, false);
  assert.equal(report.fixtureReport.enforcementChanged, false);
  assert.equal(report.fixtureReport.sourceOfTruth, "StaticPolicyEngine");
  assert.equal(report.summary.goldenCaseCount, 42);
  assert.equal(report.summary.comparedMockResults, 42);
  assert.equal(report.summary.sourceOfTruth, "StaticPolicyEngine");
  assert.equal(report.summary.staticPolicyEngineAuthoritative, true);
  assert.equal(report.summary.candidateRuntimeImplemented, false);
  assert.equal(report.summary.enforcementChanged, false);
  assert.equal(report.summary.noDynamicPolicyExecution, true);
  assert.equal(report.summary.externalPolicyServiceCallsEnabled, false);
  assert.equal(report.summary.noSecretsExposed, true);
  assert.equal(report.summary.envValuesExposed, false);
  assert.equal(hasUnsafePolicyShadowValue(report), false);
});

test("policy shadow readiness APIs and health metadata are read-only and sanitized", async () => {
  await withApiServer(async (port) => {
    const plan = await getJson(port, "/readiness/policy-shadow/plan");
    const rules = await getJson(port, "/readiness/policy-shadow/comparison-rules");
    const mismatches = await getJson(port, "/readiness/policy-shadow/mismatches");
    const reports = await getJson(port, "/readiness/policy-shadow/reports");
    const checks = await getJson(port, "/readiness/policy-shadow/checks?category=safety");
    const summary = await getJson(port, "/readiness/policy-shadow/summary");
    const evaluatorStatus = await getJson(port, "/readiness/policy-shadow/evaluator/status");
    const evaluatorSummary = await getJson(port, "/readiness/policy-shadow/evaluator/summary");
    const evaluatorMismatchTypes = await getJson(port, "/readiness/policy-shadow/evaluator/mismatch-types");
    const evaluatorMockReport = await getJson(port, "/readiness/policy-shadow/evaluator/mock-report");
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
    assert.equal((summary.body.summary as Record<string, unknown>).shadowEvaluatorSkeletonImplemented, true);
    assert.equal((summary.body.summary as Record<string, unknown>).shadowEvaluatorEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).mockComparisonSupported, true);
    assert.equal((summary.body.summary as Record<string, unknown>).candidateRuntimeImplemented, false);
    assert.equal((summary.body.summary as Record<string, unknown>).dynamicPolicyExecutionEnabled, false);
    assert.equal(evaluatorStatus.statusCode, 200);
    assert.equal(((evaluatorStatus.body.status as Record<string, unknown>)).enabled, false);
    assert.equal(((evaluatorStatus.body.status as Record<string, unknown>)).running, false);
    assert.equal(((evaluatorStatus.body.status as Record<string, unknown>)).candidateRuntimeImplemented, false);
    assert.equal(((evaluatorStatus.body.status as Record<string, unknown>)).enforcementChanged, false);
    assert.equal(evaluatorSummary.statusCode, 200);
    assert.equal(((evaluatorSummary.body.summary as Record<string, unknown>)).goldenCaseCount, 42);
    assert.equal(((evaluatorSummary.body.summary as Record<string, unknown>)).mockComparisonSupported, true);
    assert.equal(((evaluatorSummary.body.summary as Record<string, unknown>)).candidateRuntimeImplemented, false);
    assert.equal(((evaluatorSummary.body.summary as Record<string, unknown>)).enforcementChanged, false);
    assert.equal(evaluatorMismatchTypes.statusCode, 200);
    assert.equal((evaluatorMismatchTypes.body.mismatchTypes as Array<Record<string, unknown>>).every((mismatch) => mismatch.defaultAction === "record_only" || mismatch.defaultAction === "block_rollout_future"), true);
    assert.equal((evaluatorMismatchTypes.body.mismatchTypes as Array<Record<string, unknown>>).some((mismatch) => mismatch.defaultAction === "enforce_now"), false);
    assert.equal(evaluatorMockReport.statusCode, 200);
    assert.equal((evaluatorMockReport.body.fixtureReport as Record<string, unknown>).goldenCaseCount, 42);
    assert.equal((evaluatorMockReport.body.summary as Record<string, unknown>).comparedMockResults, 42);
    assert.equal((evaluatorMockReport.body.summary as Record<string, unknown>).enforcementChanged, false);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).sourceOfTruth, "StaticPolicyEngine");
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).enforcementChanged, false);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).shadowEvaluatorSkeletonImplemented, true);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).shadowEvaluatorEnabled, false);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).mockComparisonSupported, true);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).candidateRuntimeImplemented, false);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).policyCodeExecuted, false);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((health.body.policyShadowEvaluation as Record<string, unknown>).envValuesExposed, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasUnsafePolicyShadowValue({ plan, rules, mismatches, reports, checks, summary, evaluatorStatus, evaluatorSummary, evaluatorMismatchTypes, evaluatorMockReport, health }), false);
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
    assert.equal(summary.shadowEvaluatorSkeletonImplemented, true);
    assert.equal(summary.shadowEvaluatorEnabled, false);
    assert.equal(summary.mockComparisonSupported, true);
    assert.equal(noExecutionStatus.staticPolicyEngineAuthoritative, true);
    assert.equal(noExecutionStatus.candidateRuntimeExecuted, false);
    assert.equal(noExecutionStatus.policyCodeExecuted, false);
    assert.equal(noExecutionStatus.noSecretsExposed, true);
    assert.equal(noExecutionStatus.envValuesExposed, false);
    assert.equal(Array.isArray(panel.comparisonRules), true);
    assert.equal(Array.isArray(panel.mismatchTaxonomy), true);
    assert.equal(((panel.evaluatorStatus as Record<string, unknown>)).enabled, false);
    assert.equal(((panel.evaluatorSummary as Record<string, unknown>)).goldenCaseCount, 42);
    assert.equal((panel.evaluatorMismatchTypes as Array<Record<string, unknown>>).every((mismatch) => mismatch.defaultAction === "record_only" || mismatch.defaultAction === "block_rollout_future"), true);
    assert.equal(((panel.evaluatorMockReport as Record<string, unknown>)).previewCount, 5);
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
  assert.equal(html.includes("Evaluator skeleton"), true);
  assert.equal(html.includes("evaluator enabled false"), true);
  assert.equal(html.includes("mock comparison ready"), true);
  assert.equal(html.includes("dynamic execution disabled"), true);
  assert.equal(hasUnsafePolicyShadowValue(html), false);
});
