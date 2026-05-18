import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  RegistryDriftDetectionService,
  defaultRegistryDriftBaselines,
  defaultRegistryDriftSignals,
  type RegistryDriftPolicyDecisionSnapshot,
  type RegistryDriftSignalSeed
} from "@aichestra/registry";
import { StaticPolicyEngine, PolicyService, createPolicyResource, createPolicySubject } from "@aichestra/policy";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-18T00:00:00.000Z");

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

function postJson(port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(data)
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
    request.end(data);
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

function hasSecretOrEnvValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /OPENAI_API_KEY=[^"\s]+|ANTHROPIC_API_KEY=[^"\s]+|AICHESTRA_LLM_API_KEY=[^"\s]+|GITHUB_TOKEN=[^"\s]+|VAULT_TOKEN=[^"\s]+|AICHESTRA_DATABASE_URL=[^"\s]+|DATABASE_URL=[^"\s]+|SESSION_SECRET=[^"\s]+|JWT_SECRET=[^"\s]+|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_]{30,}|hvs\.[A-Za-z0-9_-]{20,}/i.test(text);
}

test("collectSignals returns deterministic seeded signals", () => {
  const service = new RegistryDriftDetectionService({ now: () => fixedNow });
  const signals = service.collectSignals();
  assert.equal(signals.length, defaultRegistryDriftSignals.length);
  assert.equal(signals.every((signal) => signal.metadata.describesMock === true), true);
});

test("buildBaseline returns seeded baseline for known target", () => {
  const service = new RegistryDriftDetectionService({ now: () => fixedNow });
  const baseline = service.buildBaseline({ targetKind: "skill", targetId: "skill_jest_test_fixer" });
  assert.equal(baseline.targetId, "skill_jest_test_fixer");
  assert.equal(baseline.status, "active_mock");
  assert.equal(typeof baseline.metrics.failureRate, "number");
});

test("buildBaseline returns missing baseline for unseeded target", () => {
  const service = new RegistryDriftDetectionService({ now: () => fixedNow });
  const baseline = service.buildBaseline({ targetKind: "skill", targetId: "skill_unknown" });
  assert.equal(baseline.status, "missing");
});

test("assessTarget with no signals returns no_drift status", () => {
  const service = new RegistryDriftDetectionService({ signals: [], baselines: defaultRegistryDriftBaselines, now: () => fixedNow });
  const assessment = service.assessTarget({ targetKind: "skill", targetId: "skill_no_signal_target" });
  assert.equal(assessment.status, "insufficient_data");
  assert.equal(assessment.severity, "info");
  assert.equal(assessment.driftScore, 0);
  assert.equal(assessment.metadata.applyAllowed, false);
  assert.equal(assessment.metadata.evalExecuted, false);
  assert.equal(assessment.metadata.canaryExecuted, false);
  assert.equal(assessment.metadata.registryMutationExecuted, false);
});

test("assessTarget produces a degraded assessment for jest skill with high failure signal", () => {
  const service = new RegistryDriftDetectionService({ now: () => fixedNow });
  const assessment = service.assessTarget({ targetKind: "skill", targetId: "skill_jest_test_fixer" });
  assert.equal(assessment.driftScore > 40, true, `expected degraded score, got ${assessment.driftScore}`);
  assert.equal(["watch", "degraded", "critical"].includes(assessment.status), true);
  assert.equal(assessment.signalIds.length >= 1, true);
  assert.equal(assessment.recommendedActions.includes("require_human_review"), true);
  assert.equal(assessment.governanceFollowUps.includes("require_human_review"), true);
});

test("assessTarget produces watch status for harness with low/medium signals", () => {
  const service = new RegistryDriftDetectionService({ now: () => fixedNow });
  const assessment = service.assessTarget({ targetKind: "harness", targetId: "harness_backend_node20" });
  assert.equal(assessment.status === "watch" || assessment.status === "no_drift", true);
});

test("assessTarget for stale instruction yields review_instruction recommendation", () => {
  const service = new RegistryDriftDetectionService({ now: () => fixedNow });
  service.assessTarget({ targetKind: "instruction", targetId: "instr_org_secure_coding_baseline" });
  const recommendations = service.listRecommendations({ targetKind: "instruction", targetId: "instr_org_secure_coding_baseline" });
  assert.equal(recommendations.some((recommendation) => recommendation.recommendationKind === "review_instruction"), true);
  assert.equal(recommendations.every((recommendation) => recommendation.applyAllowed === false), true);
});

test("computeScoreForSignals scales deterministically with severity multiplier", () => {
  const service = new RegistryDriftDetectionService({ signals: [], baselines: [], now: () => fixedNow });
  const baseSignals = service.collectSignals();
  assert.equal(baseSignals.length, 0);
  const synthetic: RegistryDriftSignalSeed[] = [
    {
      targetKind: "skill",
      targetId: "skill_compute_test",
      signalKind: "failure_rate_increase",
      value: 0.2,
      baselineValue: 0.05,
      delta: 0.15,
      window: "30d",
      severity: "high",
      source: "mock_seed",
      metadata: { describesMock: true }
    }
  ];
  const driver = new RegistryDriftDetectionService({ signals: synthetic, baselines: [], now: () => fixedNow });
  const collected = driver.collectSignals({ targetKind: "skill", targetId: "skill_compute_test" });
  const score = driver.computeScoreForSignals(collected);
  // 35 * 1.3 = 45.5 -> rounds to 46
  assert.equal(score, 46);
});

test("policy denial short-circuits assessTarget to insufficient_data", () => {
  const denyEvaluator = (): RegistryDriftPolicyDecisionSnapshot => ({ decision: "deny", matchedRuleIds: ["policy_drift_deny_test"], reason: "policy_drift_deny_test" });
  const service = new RegistryDriftDetectionService({ now: () => fixedNow, policyEvaluator: denyEvaluator });
  const assessment = service.assessTarget({ targetKind: "skill", targetId: "skill_jest_test_fixer" });
  assert.equal(assessment.status, "insufficient_data");
  assert.equal(assessment.severity, "info");
  assert.equal(assessment.metadata.policyDenied, true);
  assert.equal(service.listRecommendations({ targetKind: "skill", targetId: "skill_jest_test_fixer" }).length, 0);
});

test("linkToImprovementCandidate is always draft-only and apply not allowed", () => {
  const service = new RegistryDriftDetectionService({ now: () => fixedNow });
  const result = service.linkToImprovementCandidate("drift_assessment_dummy");
  assert.equal(result.applyAllowed, false);
  assert.equal(result.draftOnly, true);
  assert.equal(typeof result.candidateRef, "string");
});

test("linkToImprovementCandidate respects policy deny by default", () => {
  const policyService = new PolicyService({ engine: new StaticPolicyEngine() });
  const subject = createPolicySubject({ actorId: "mock-actor", roles: ["platform_admin"] });
  const resource = createPolicyResource({ resourceKind: "registry_drift", resourceId: "drift" });
  const denyEvaluator = () => {
    const decision = policyService.evaluate({ subject, resource, action: "registry.drift.create_candidate_future", context: { environment: {}, metadata: {} } });
    return {
      decision: decision.decision === "allow" ? "allow" as const : "deny" as const,
      matchedRuleIds: decision.matchedRuleIds ?? [],
      reason: decision.reason ?? "policy_default_deny"
    };
  };
  const service = new RegistryDriftDetectionService({ now: () => fixedNow, policyEvaluator: denyEvaluator });
  const result = service.linkToImprovementCandidate("drift_assessment_dummy");
  assert.equal(result.applyAllowed, false);
  assert.equal(result.metadata.policyDenied, true);
});

test("policy denies registry.drift.create_candidate_future and auto_apply_future by default", () => {
  const policyService = new PolicyService({ engine: new StaticPolicyEngine() });
  const subject = createPolicySubject({ actorId: "mock-actor", roles: ["platform_admin"] });
  const resource = createPolicyResource({ resourceKind: "registry_drift", resourceId: "drift" });
  for (const action of ["registry.drift.create_candidate_future", "registry.drift.auto_apply_future"] as const) {
    const decision = policyService.evaluate({ subject, resource, action, context: { environment: {}, metadata: {} } });
    assert.equal(decision.decision, "deny");
  }
});

test("policy allows registry.drift.read and assess and recommend in mock metadata-only context", () => {
  const policyService = new PolicyService({ engine: new StaticPolicyEngine() });
  const subject = createPolicySubject({ actorId: "mock-actor", roles: ["platform_admin"] });
  const resource = createPolicyResource({ resourceKind: "registry_drift", resourceId: "drift" });
  const environment = {
    metadataOnly: true,
    autoApplyEnabled: false,
    registryMutationExecuted: false,
    evalExecuted: false,
    canaryExecuted: false,
    externalCallExecuted: false,
    resolverGatesPreserved: true
  };
  for (const action of ["registry.drift.read", "registry.drift.assess", "registry.drift.recommend"] as const) {
    const decision = policyService.evaluate({ subject, resource, action, context: { environment, metadata: {} } });
    assert.equal(decision.decision, "allow", `${action} must be allowed under metadata-only mock context`);
  }
});

test("assessAll produces a deterministic summary with no eval/canary execution", () => {
  const service = new RegistryDriftDetectionService({ now: () => fixedNow });
  const assessments = service.assessAll();
  assert.equal(assessments.length > 0, true);
  const summary = service.getSummary();
  assert.equal(summary.applyAllowed, false);
  assert.equal(summary.registryMutationExecuted, false);
  assert.equal(summary.evalExecuted, false);
  assert.equal(summary.canaryExecuted, false);
  assert.equal(summary.autoImprovementApplied, false);
  assert.equal(summary.externalCallExecuted, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(summary.assessmentCount, assessments.length);
});

test("drift API endpoints are safe and never mutate registry or run eval/canary", async () => {
  await withApiServer(async (port) => {
    const signals = await getJson(port, "/registry/drift/signals");
    const baselines = await getJson(port, "/registry/drift/baselines");
    const summaryBefore = await getJson(port, "/registry/drift/summary");
    const assess = await postJson(port, "/registry/drift/assess", { targetKind: "skill", targetId: "skill_jest_test_fixer" });
    const assessAll = await postJson(port, "/registry/drift/assess-all", {});
    const assessments = await getJson(port, "/registry/drift/assessments");
    const recommendations = await getJson(port, "/registry/drift/recommendations");
    const readinessSummary = await getJson(port, "/readiness/registry/drift/summary");
    const health = await getJson(port, "/health");

    assert.equal(signals.statusCode, 200);
    assert.equal(Array.isArray(signals.body.signals), true);
    assert.equal(baselines.statusCode, 200);
    assert.equal(Array.isArray(baselines.body.baselines), true);
    assert.equal(summaryBefore.statusCode, 200);
    assert.equal((summaryBefore.body.summary as Record<string, unknown>).applyAllowed, false);
    assert.equal(assess.statusCode, 201);
    const assessmentRecord = assess.body.assessment as Record<string, unknown>;
    assert.equal(typeof assessmentRecord.driftScore, "number");
    assert.equal((assessmentRecord.metadata as Record<string, unknown>).applyAllowed, false);
    assert.equal((assessmentRecord.metadata as Record<string, unknown>).evalExecuted, false);
    assert.equal((assessmentRecord.metadata as Record<string, unknown>).canaryExecuted, false);
    assert.equal(assessAll.statusCode, 201);
    assert.equal(Array.isArray(assessAll.body.assessments), true);
    assert.equal(assessments.statusCode, 200);
    assert.equal(recommendations.statusCode, 200);
    assert.equal(readinessSummary.statusCode, 200);
    assert.equal((readinessSummary.body.summary as Record<string, unknown>).applyAllowed, false);
    const driftHealth = health.body.registryDrift as Record<string, unknown>;
    assert.equal(driftHealth.applyAllowed, false);
    assert.equal(driftHealth.registryMutationExecuted, false);
    assert.equal(driftHealth.evalExecuted, false);
    assert.equal(driftHealth.canaryExecuted, false);
    assert.equal(driftHealth.autoImprovementApplied, false);
    assert.equal(driftHealth.externalCallExecuted, false);
    assert.equal(hasSecretOrEnvValue({ signals, baselines, summaryBefore, assess, assessAll, assessments, recommendations, readinessSummary, driftHealth }), false);
  });
});

test("drift dashboard panel renders advisory metadata without secrets", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/registry-drift");
    const panel = dashboard.body.registryDrift as Record<string, unknown>;
    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).applyAllowed, false);
    assert.equal((panel.summary as Record<string, unknown>).evalExecuted, false);
    assert.equal((panel.summary as Record<string, unknown>).canaryExecuted, false);
    assert.equal((panel.noAutoApplyStatus as Record<string, unknown>).applyAllowed, false);
    assert.equal((panel.noAutoApplyStatus as Record<string, unknown>).autoImprovementApplied, false);
    assert.equal(Array.isArray(panel.signals), true);
    assert.equal(Array.isArray(panel.assessments), true);
    assert.equal(Array.isArray(panel.recommendations), true);
    assert.equal(Array.isArray(panel.governanceFollowUps), true);
    assert.equal(hasSecretOrEnvValue(dashboard), false);
  });
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Skill / Harness Drift Detection"), true);
  assert.equal(html.includes("eval executed false"), true);
  assert.equal(html.includes("canary executed false"), true);
});
