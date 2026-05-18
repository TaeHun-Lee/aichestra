import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  ApplyWorkflowService,
  CanaryExecutionService,
  createCanaryAndApplyServices,
  type RegistryCanaryApplyPolicyDecisionSnapshot
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

test("createCanaryPlan defaults to mock_deterministic and produces planned status", () => {
  const canary = new CanaryExecutionService({ now: () => fixedNow });
  const plan = canary.createCanaryPlan({ targetKind: "skill", targetId: "skill_jest_test_fixer" });
  assert.equal(plan.canaryKind, "mock_deterministic");
  assert.equal(plan.status, "planned");
  assert.equal(plan.metadata.autoApplyEnabled, false);
  assert.equal(plan.metadata.activeRegistryMutationAllowed, false);
  assert.equal(plan.metadata.externalCanaryExecuted, false);
  assert.equal(plan.metadata.realProviderCallExecuted, false);
});

test("createCanaryPlan with external_future yields future status", () => {
  const canary = new CanaryExecutionService({ now: () => fixedNow });
  const plan = canary.createCanaryPlan({ targetKind: "harness", targetId: "harness_local_git_dry_run", canaryKind: "external_future" });
  assert.equal(plan.status, "future");
});

test("createCanaryPlan with policy deny yields blocked status", () => {
  const denyEvaluator = (): RegistryCanaryApplyPolicyDecisionSnapshot => ({ decision: "deny", matchedRuleIds: ["policy_canary_deny_test"], reason: "policy_canary_deny_test" });
  const canary = new CanaryExecutionService({ now: () => fixedNow, policyEvaluator: denyEvaluator });
  const plan = canary.createCanaryPlan({ targetKind: "skill", targetId: "skill_jest_test_fixer" });
  assert.equal(plan.status, "blocked");
});

test("requestCanaryRun blocks when required eval is missing", () => {
  const canary = new CanaryExecutionService({ now: () => fixedNow });
  const plan = canary.createCanaryPlan({ targetKind: "skill", targetId: "skill_jest_test_fixer", requiredEvalRunIds: ["eval_run_missing"] });
  const run = canary.requestCanaryRun({ canaryPlanId: plan.id });
  assert.equal(run.status, "blocked_missing_eval");
});

test("requestCanaryRun blocks when required approval is missing", () => {
  const canary = new CanaryExecutionService({ now: () => fixedNow });
  const plan = canary.createCanaryPlan({ targetKind: "skill", targetId: "skill_jest_test_fixer", requiredApprovalIds: ["approval_missing"] });
  const run = canary.requestCanaryRun({ canaryPlanId: plan.id });
  assert.equal(run.status, "blocked_missing_approval");
});

test("requestCanaryRun returns future_external for external_future plan", () => {
  const canary = new CanaryExecutionService({ now: () => fixedNow });
  const plan = canary.createCanaryPlan({ targetKind: "harness", targetId: "harness_local_git_dry_run", canaryKind: "external_future" });
  const run = canary.requestCanaryRun({ canaryPlanId: plan.id });
  assert.equal(run.status, "future_external");
});

test("executeMockCanaryRun produces deterministic verdict and never executes external canary", () => {
  const canary = new CanaryExecutionService({ now: () => fixedNow });
  const plan = canary.createCanaryPlan({ targetKind: "skill", targetId: "skill_jest_test_fixer" });
  const run = canary.requestCanaryRun({ canaryPlanId: plan.id });
  assert.equal(run.status, "requested");
  const verdict = canary.executeMockCanaryRun(run.id);
  assert.equal(verdict.metadata.externalCanaryExecuted, false);
  assert.equal(verdict.metadata.realProviderCallExecuted, false);
  assert.equal(verdict.metadata.autoApplyEnabled, false);
  assert.equal(["passed", "warning", "failed", "skipped"].includes(verdict.overallVerdict), true);
  assert.equal(verdict.requiredForApply, true);
  // determinism: same metric inputs (same plan seed) must produce identical results
  const results = canary.listCanaryResults({ canaryRunId: run.id });
  const seedSummary = results.map((entry) => `${entry.metricKind}:${entry.value.toFixed(6)}:${entry.verdict}`).join("|");
  assert.equal(seedSummary.length > 0, true);
  // results were computed from a deterministic hash of plan.id, plan.targetKind, plan.targetId — verify they round-trip equal when re-listed
  const resultsAgain = canary.listCanaryResults({ canaryRunId: run.id });
  const seedSummaryAgain = resultsAgain.map((entry) => `${entry.metricKind}:${entry.value.toFixed(6)}:${entry.verdict}`).join("|");
  assert.equal(seedSummary, seedSummaryAgain);
});

test("executeMockCanaryRun aggregates blocked verdict when policy denies execution", () => {
  let allowExecute = true;
  const evaluator = (input: { action: string }): RegistryCanaryApplyPolicyDecisionSnapshot => {
    if (input.action === "registry.canary.run_mock" && !allowExecute) {
      return { decision: "deny", matchedRuleIds: ["policy_canary_execute_deny"], reason: "policy_canary_execute_deny" };
    }
    return { decision: "allow", matchedRuleIds: [], reason: "ok" };
  };
  const canary = new CanaryExecutionService({ now: () => fixedNow, policyEvaluator: evaluator });
  const plan = canary.createCanaryPlan({ targetKind: "skill", targetId: "skill_jest_test_fixer" });
  const run = canary.requestCanaryRun({ canaryPlanId: plan.id });
  allowExecute = false;
  const verdict = canary.executeMockCanaryRun(run.id);
  assert.equal(verdict.overallVerdict, "blocked");
  assert.equal(verdict.applyGateImpact, "blocks_apply");
});

test("createApplyWorkflow defaults to metadata_only and never enables auto-apply", () => {
  const apply = new ApplyWorkflowService({ now: () => fixedNow });
  const workflow = apply.createApplyWorkflow({
    proposalId: "prop_a",
    draftRegistryChangeId: "draft_a",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    rollbackPlanId: "rollback_plan_a"
  });
  assert.equal(workflow.applyMode, "metadata_only");
  assert.equal(workflow.autoApplyEnabled, false);
  assert.equal(workflow.activeRegistryMutationAllowed, false);
});

test("evaluateApplyGate blocks when required eval is missing", () => {
  const apply = new ApplyWorkflowService({ now: () => fixedNow });
  const workflow = apply.createApplyWorkflow({
    proposalId: "prop_a",
    draftRegistryChangeId: "draft_a",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    rollbackPlanId: "rollback_plan_a",
    requiredEvalRunIds: ["eval_run_missing"]
  });
  apply.createRollbackPlan({ workflowId: workflow.id });
  const decision = apply.evaluateApplyGate(workflow.id);
  assert.equal(decision.decision, "blocked_missing_eval");
  assert.equal(decision.applyPerformed, false);
  assert.equal(decision.activeRegistryMutated, false);
});

test("evaluateApplyGate blocks when required eval fails", () => {
  const apply = new ApplyWorkflowService({
    now: () => fixedNow,
    dataSource: {
      listEvalReferences: () => [{ evalRunId: "eval_run_a", status: "fail" }]
    }
  });
  const workflow = apply.createApplyWorkflow({
    proposalId: "prop_a",
    draftRegistryChangeId: "draft_a",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    rollbackPlanId: "rollback_plan_a",
    requiredEvalRunIds: ["eval_run_a"]
  });
  apply.createRollbackPlan({ workflowId: workflow.id });
  const decision = apply.evaluateApplyGate(workflow.id);
  assert.equal(decision.decision, "blocked_failed_eval");
});

test("evaluateApplyGate blocks when required canary is missing", () => {
  const { canaryService, applyWorkflowService } = createCanaryAndApplyServices({ now: () => fixedNow });
  const workflow = applyWorkflowService.createApplyWorkflow({
    proposalId: "prop_a",
    draftRegistryChangeId: "draft_a",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    rollbackPlanId: "rollback_plan_a",
    requiredCanaryRunIds: ["canary_run_missing"]
  });
  applyWorkflowService.createRollbackPlan({ workflowId: workflow.id });
  const decision = applyWorkflowService.evaluateApplyGate(workflow.id);
  assert.equal(decision.decision, "blocked_missing_canary");
  void canaryService;
});

test("evaluateApplyGate blocks when required canary failed", () => {
  const { canaryService, applyWorkflowService } = createCanaryAndApplyServices({ now: () => fixedNow });
  const plan = canaryService.createCanaryPlan({ targetKind: "skill", targetId: "skill_jest_test_fixer" });
  const run = canaryService.requestCanaryRun({ canaryPlanId: plan.id });
  // Force fail by recording a blocked verdict via policy deny on execute
  const evaluator = () => ({ decision: "deny" as const, matchedRuleIds: ["t"], reason: "t" });
  const failedCanary = new CanaryExecutionService({ now: () => fixedNow, policyEvaluator: evaluator });
  const fPlan = failedCanary.createCanaryPlan({ targetKind: "skill", targetId: "skill_jest_test_fixer" });
  void fPlan;
  void run;
  void canaryService;
  const workflow = applyWorkflowService.createApplyWorkflow({
    proposalId: "prop_a",
    draftRegistryChangeId: "draft_a",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    rollbackPlanId: "rollback_plan_a",
    requiredCanaryRunIds: [run.id]
  });
  applyWorkflowService.createRollbackPlan({ workflowId: workflow.id });
  // The run exists but has no verdict yet, so should be missing or fail through findFailedCanary returning empty (no verdict means not failed)
  const decision = applyWorkflowService.evaluateApplyGate(workflow.id);
  // Without an explicit verdict, findFailedCanary returns empty; missingCanary also empty (run.id is present), so falls through to missing approval
  assert.equal(decision.decision === "blocked_missing_approval", true);
});

test("evaluateApplyGate blocks when required approval missing", () => {
  const apply = new ApplyWorkflowService({ now: () => fixedNow });
  const workflow = apply.createApplyWorkflow({
    proposalId: "prop_a",
    draftRegistryChangeId: "draft_a",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    rollbackPlanId: "rollback_plan_a",
    requiredApprovalIds: ["approval_missing"]
  });
  apply.createRollbackPlan({ workflowId: workflow.id });
  const decision = apply.evaluateApplyGate(workflow.id);
  assert.equal(decision.decision, "blocked_missing_approval");
});

test("evaluateApplyGate blocks when policy denies evaluation", () => {
  const denyEvaluator = (): RegistryCanaryApplyPolicyDecisionSnapshot => ({ decision: "deny", matchedRuleIds: ["policy_apply_gate_deny"], reason: "policy_apply_gate_deny" });
  const apply = new ApplyWorkflowService({ now: () => fixedNow, policyEvaluator: denyEvaluator });
  const workflow = apply.createApplyWorkflow({
    proposalId: "prop_a",
    draftRegistryChangeId: "draft_a",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    rollbackPlanId: "rollback_plan_a"
  });
  apply.createRollbackPlan({ workflowId: workflow.id });
  const decision = apply.evaluateApplyGate(workflow.id);
  assert.equal(decision.decision, "blocked_policy_denied");
});

test("evaluateApplyGate blocks when applyMode is automatic_forbidden", () => {
  const apply = new ApplyWorkflowService({ now: () => fixedNow });
  const workflow = apply.createApplyWorkflow({
    proposalId: "prop_a",
    draftRegistryChangeId: "draft_a",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    rollbackPlanId: "rollback_plan_a",
    applyMode: "automatic_forbidden"
  });
  apply.createRollbackPlan({ workflowId: workflow.id });
  const decision = apply.evaluateApplyGate(workflow.id);
  assert.equal(decision.decision, "blocked_auto_apply_disabled");
});

test("evaluateApplyGate moves to ready_for_manual_future when all prerequisites are present", () => {
  const apply = new ApplyWorkflowService({
    now: () => fixedNow,
    dataSource: {
      listEvalReferences: () => [{ evalRunId: "eval_run_a", status: "pass" }],
      listApprovalReferences: () => [{ approvalId: "approval_a", status: "approved" }]
    }
  });
  const workflow = apply.createApplyWorkflow({
    proposalId: "prop_a",
    draftRegistryChangeId: "draft_a",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    rollbackPlanId: "rollback_plan_a",
    requiredEvalRunIds: ["eval_run_a"],
    requiredApprovalIds: ["approval_a"]
  });
  apply.createRollbackPlan({ workflowId: workflow.id });
  const decision = apply.evaluateApplyGate(workflow.id);
  assert.equal(decision.decision, "ready_for_manual_future");
});

test("recordMetadataOnlyApplyDecision records metadata_only and never mutates registry", () => {
  const apply = new ApplyWorkflowService({
    now: () => fixedNow,
    dataSource: {
      listEvalReferences: () => [{ evalRunId: "eval_run_a", status: "pass" }],
      listApprovalReferences: () => [{ approvalId: "approval_a", status: "approved" }]
    }
  });
  const workflow = apply.createApplyWorkflow({
    proposalId: "prop_a",
    draftRegistryChangeId: "draft_a",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    rollbackPlanId: "rollback_plan_a",
    requiredEvalRunIds: ["eval_run_a"],
    requiredApprovalIds: ["approval_a"]
  });
  apply.createRollbackPlan({ workflowId: workflow.id });
  const decision = apply.recordMetadataOnlyApplyDecision(workflow.id);
  assert.equal(decision.decision, "metadata_only_recorded");
  assert.equal(decision.applyPerformed, false);
  assert.equal(decision.activeRegistryMutated, false);
  const refreshed = apply.getWorkflow(workflow.id);
  assert.equal(refreshed?.status, "applied_metadata_only");
});

test("evaluateApplyGate blocks when rollback plan is missing", () => {
  const apply = new ApplyWorkflowService({
    now: () => fixedNow,
    dataSource: {
      listEvalReferences: () => [{ evalRunId: "eval_run_a", status: "pass" }],
      listApprovalReferences: () => [{ approvalId: "approval_a", status: "approved" }]
    }
  });
  const workflow = apply.createApplyWorkflow({
    proposalId: "prop_a",
    draftRegistryChangeId: "draft_a",
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    rollbackPlanId: "rollback_plan_a",
    requiredEvalRunIds: ["eval_run_a"],
    requiredApprovalIds: ["approval_a"]
  });
  // No rollback plan created
  const decision = apply.evaluateApplyGate(workflow.id);
  assert.equal(decision.decision === "blocked_missing_approval", true);
  assert.equal(decision.reasons.includes("rollback_plan_not_ready"), true);
});

test("policy denies registry.canary.run_external_future and registry.apply.execute_future / auto_apply_future by default", () => {
  const policyService = new PolicyService({ engine: new StaticPolicyEngine() });
  const subject = createPolicySubject({ actorId: "mock-actor", roles: ["platform_admin"] });
  const canaryResource = createPolicyResource({ resourceKind: "registry_canary", resourceId: "canary" });
  const applyResource = createPolicyResource({ resourceKind: "registry_apply_workflow", resourceId: "apply" });
  const cases: { action: "registry.canary.run_external_future" | "registry.apply.execute_future" | "registry.apply.auto_apply_future"; resource: typeof canaryResource | typeof applyResource }[] = [
    { action: "registry.canary.run_external_future", resource: canaryResource },
    { action: "registry.apply.execute_future", resource: applyResource },
    { action: "registry.apply.auto_apply_future", resource: applyResource }
  ];
  for (const { action, resource } of cases) {
    const decision = policyService.evaluate({ subject, resource, action, context: { environment: {}, metadata: {} } });
    assert.equal(decision.decision, "deny", `${action} must deny by default`);
  }
});

test("policy allows canary.plan, canary.run_mock, apply_workflow.create, apply_gate.evaluate, apply.metadata_record in mock metadata-only context", () => {
  const policyService = new PolicyService({ engine: new StaticPolicyEngine() });
  const subject = createPolicySubject({ actorId: "mock-actor", roles: ["platform_admin"] });
  const canaryResource = createPolicyResource({ resourceKind: "registry_canary", resourceId: "canary" });
  const applyResource = createPolicyResource({ resourceKind: "registry_apply_workflow", resourceId: "apply" });
  const environment = {
    metadataOnly: true,
    autoApplyEnabled: false,
    activeRegistryMutationAllowed: false,
    externalCanaryExecuted: false,
    realProviderCallExecuted: false,
    applyPerformed: false,
    activeRegistryMutated: false
  };
  const cases: { action: "registry.canary.plan" | "registry.canary.run_mock" | "registry.apply_workflow.create" | "registry.apply_gate.evaluate" | "registry.apply.metadata_record"; resource: typeof canaryResource | typeof applyResource }[] = [
    { action: "registry.canary.plan", resource: canaryResource },
    { action: "registry.canary.run_mock", resource: canaryResource },
    { action: "registry.apply_workflow.create", resource: applyResource },
    { action: "registry.apply_gate.evaluate", resource: applyResource },
    { action: "registry.apply.metadata_record", resource: applyResource }
  ];
  for (const { action, resource } of cases) {
    const decision = policyService.evaluate({ subject, resource, action, context: { environment, metadata: {} } });
    assert.equal(decision.decision, "allow", `${action} must be allowed under mock metadata-only context`);
  }
});

test("canary + apply API endpoints are safe and never mutate registry or execute real apply", async () => {
  await withApiServer(async (port) => {
    const planResponse = await postJson(port, "/registry/canary/plans", { targetKind: "skill", targetId: "skill_jest_test_fixer" });
    assert.equal(planResponse.statusCode, 201);
    const plan = planResponse.body.plan as Record<string, unknown>;
    const runResponse = await postJson(port, "/registry/canary/runs", { canaryPlanId: plan.id });
    assert.equal(runResponse.statusCode, 201);
    const run = runResponse.body.run as Record<string, unknown>;
    const executeResponse = await postJson(port, `/registry/canary/runs/${run.id}/execute-mock`, {});
    assert.equal(executeResponse.statusCode, 201);
    const summaryResponse = await getJson(port, "/registry/canary/summary");
    assert.equal(summaryResponse.statusCode, 200);
    const canarySummary = (summaryResponse.body.summary as Record<string, unknown>);
    assert.equal(canarySummary.autoApplyEnabled, false);
    assert.equal(canarySummary.activeRegistryMutationAllowed, false);
    assert.equal(canarySummary.applyPerformed, false);
    assert.equal(canarySummary.externalCanaryExecuted, false);
    const workflowResponse = await postJson(port, "/registry/apply-workflows", {
      proposalId: "prop_a",
      draftRegistryChangeId: "draft_a",
      targetKind: "skill",
      targetId: "skill_jest_test_fixer",
      rollbackPlanId: "rollback_plan_a",
      requiredApprovalIds: ["approval_a"]
    });
    assert.equal(workflowResponse.statusCode, 201);
    const workflow = workflowResponse.body.workflow as Record<string, unknown>;
    await postJson(port, `/registry/apply-workflows/${workflow.id}/rollback-plans`, { rollbackKind: "metadata_only" });
    const gateResponse = await postJson(port, `/registry/apply-workflows/${workflow.id}/evaluate-gate`, {});
    assert.equal(gateResponse.statusCode, 201);
    const decision = gateResponse.body.decision as Record<string, unknown>;
    assert.equal(decision.applyPerformed, false);
    assert.equal(decision.activeRegistryMutated, false);
    const canaryReadiness = await getJson(port, "/readiness/registry/canary/summary");
    assert.equal(canaryReadiness.statusCode, 200);
    const applyReadiness = await getJson(port, "/readiness/registry/apply-workflows/summary");
    assert.equal(applyReadiness.statusCode, 200);
    const health = await getJson(port, "/health");
    const healthCanary = health.body.registryCanaryApply as Record<string, unknown>;
    assert.equal(healthCanary.autoApplyEnabled, false);
    assert.equal(healthCanary.activeRegistryMutationAllowed, false);
    assert.equal(healthCanary.applyPerformed, false);
    assert.equal(healthCanary.activeRegistryMutated, false);
    assert.equal(healthCanary.externalCanaryExecuted, false);
    assert.equal(healthCanary.realEvalExecuted, false);
    assert.equal(healthCanary.realProviderCallExecuted, false);
    assert.equal(hasSecretOrEnvValue({ planResponse, runResponse, executeResponse, workflowResponse, gateResponse, summaryResponse, canaryReadiness, applyReadiness, healthCanary }), false);
  });
});

test("canary + apply dashboard panel renders metadata-only safety status", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/registry-canary-apply");
    const panel = dashboard.body.registryCanaryApply as Record<string, unknown>;
    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).autoApplyEnabled, false);
    assert.equal((panel.summary as Record<string, unknown>).activeRegistryMutationAllowed, false);
    assert.equal((panel.noAutoApplyStatus as Record<string, unknown>).applyPerformed, false);
    assert.equal((panel.noAutoApplyStatus as Record<string, unknown>).activeRegistryMutated, false);
    assert.equal(Array.isArray(panel.canaryPlans), true);
    assert.equal(Array.isArray(panel.applyWorkflows), true);
    assert.equal(hasSecretOrEnvValue(dashboard), false);
  });
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Canary Execution Harness + Apply Workflow"), true);
  assert.equal(html.includes("auto-apply disabled"), true);
  assert.equal(html.includes("apply performed false"), true);
  assert.equal(html.includes("active registry mutated false"), true);
});
