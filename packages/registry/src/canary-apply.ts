import { createId } from "@aichestra/core";

export type RegistryCanaryTargetKind =
  | "skill"
  | "harness"
  | "instruction"
  | "registry_package";

export type RegistryCanaryKind =
  | "mock_deterministic"
  | "fixture_subset"
  | "task_subset_future"
  | "tenant_subset_future"
  | "provider_subset_future"
  | "external_future";

export type RegistryCanaryPlanStatus = "planned" | "ready" | "blocked" | "future";

export type RegistryCanaryRunStatus =
  | "requested"
  | "running_mock"
  | "passed"
  | "failed"
  | "warning"
  | "skipped"
  | "blocked_policy"
  | "blocked_missing_eval"
  | "blocked_missing_approval"
  | "future_external";

export type RegistryCanaryMetricKind =
  | "pass_rate"
  | "failure_rate"
  | "token_cost"
  | "runtime"
  | "policy_denial_rate"
  | "rollback_signal"
  | "user_feedback_future";

export type RegistryCanaryVerdictKind = "pass" | "fail" | "warning" | "skipped";

export type RegistryCanaryOverallVerdict = "passed" | "failed" | "warning" | "skipped" | "blocked";

export type RegistryCanaryApplyGateImpact =
  | "no_change"
  | "improves_readiness"
  | "blocks_apply"
  | "future_manual_review";

export type RegistryApplyWorkflowStatus =
  | "draft"
  | "eval_required"
  | "canary_required"
  | "approval_required"
  | "ready_for_manual_apply_future"
  | "blocked"
  | "applied_metadata_only"
  | "applied_future";

export type RegistryApplyMode = "metadata_only" | "manual_future" | "automatic_forbidden";

export type RegistryApplyGateDecisionKind =
  | "blocked_missing_eval"
  | "blocked_failed_eval"
  | "blocked_missing_canary"
  | "blocked_failed_canary"
  | "blocked_missing_approval"
  | "blocked_policy_denied"
  | "blocked_auto_apply_disabled"
  | "ready_for_manual_future"
  | "metadata_only_recorded";

export type RegistryRollbackKind =
  | "metadata_only"
  | "registry_history_revert_future"
  | "package_version_revert_future"
  | "manual_review";

export type RegistryRollbackStatus = "planned" | "missing" | "blocked" | "future";

export type RegistryCanaryPlan = {
  id: string;
  proposalId?: string;
  draftRegistryChangeId?: string;
  targetKind: RegistryCanaryTargetKind;
  targetId: string;
  canaryKind: RegistryCanaryKind;
  status: RegistryCanaryPlanStatus;
  requiredEvalRunIds: string[];
  requiredApprovalIds: string[];
  sampleStrategy: string;
  rollbackPlanId?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type RegistryCanaryRun = {
  id: string;
  canaryPlanId: string;
  status: RegistryCanaryRunStatus;
  startedAt: Date;
  completedAt?: Date;
  requestId?: string;
  correlationId?: string;
  requestedByActorId?: string;
  requestedByServiceAccountId?: string;
  metadata: Record<string, unknown>;
};

export type RegistryCanaryResult = {
  id: string;
  canaryRunId: string;
  metricKind: RegistryCanaryMetricKind;
  value: number;
  threshold: number;
  verdict: RegistryCanaryVerdictKind;
  metadata: Record<string, unknown>;
};

export type RegistryCanaryVerdict = {
  id: string;
  canaryRunId: string;
  overallVerdict: RegistryCanaryOverallVerdict;
  requiredForApply: boolean;
  applyGateImpact: RegistryCanaryApplyGateImpact;
  resultIds: string[];
  metadata: Record<string, unknown>;
};

export type RegistryApplyWorkflow = {
  id: string;
  proposalId: string;
  draftRegistryChangeId: string;
  targetKind: RegistryCanaryTargetKind;
  targetId: string;
  status: RegistryApplyWorkflowStatus;
  requiredEvalRunIds: string[];
  requiredCanaryRunIds: string[];
  requiredApprovalIds: string[];
  rollbackPlanId: string;
  applyMode: RegistryApplyMode;
  autoApplyEnabled: false;
  activeRegistryMutationAllowed: false;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type RegistryApplyGateDecision = {
  id: string;
  workflowId: string;
  decision: RegistryApplyGateDecisionKind;
  reasons: string[];
  requiredActions: string[];
  applyPerformed: false;
  activeRegistryMutated: false;
  decidedAt: Date;
  metadata: Record<string, unknown>;
};

export type RegistryRollbackPlan = {
  id: string;
  workflowId: string;
  rollbackKind: RegistryRollbackKind;
  status: RegistryRollbackStatus;
  requiredEvidence: string[];
  metadata: Record<string, unknown>;
};

export type RegistryCanaryApplySummary = {
  status: "v1_implemented";
  planningOnly: true;
  generatedAt: Date;
  canaryPlanCount: number;
  canaryRunCount: number;
  canaryResultCount: number;
  canaryVerdictCount: number;
  applyWorkflowCount: number;
  applyGateDecisionCount: number;
  rollbackPlanCount: number;
  passedCanaryRunCount: number;
  failedCanaryRunCount: number;
  warningCanaryRunCount: number;
  blockedCanaryRunCount: number;
  skippedCanaryRunCount: number;
  readyForManualApplyCount: number;
  blockedApplyDecisionCount: number;
  metadataOnlyApplyDecisionCount: number;
  autoApplyEnabled: false;
  activeRegistryMutationAllowed: false;
  applyPerformed: false;
  activeRegistryMutated: false;
  externalCanaryExecuted: false;
  realEvalExecuted: false;
  realProviderCallExecuted: false;
  noSecretsExposed: true;
  envValuesExposed: false;
};

export type RegistryCanaryApplyServiceContext = {
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type RegistryCanaryApplyPolicyAction =
  | "registry.canary.plan"
  | "registry.canary.run_mock"
  | "registry.canary.run_external_future"
  | "registry.apply_workflow.create"
  | "registry.apply_gate.evaluate"
  | "registry.apply.metadata_record"
  | "registry.apply.execute_future"
  | "registry.apply.auto_apply_future";

export type RegistryCanaryApplyPolicyDecisionSnapshot = {
  decision: "allow" | "deny" | "require_approval" | "not_applicable";
  matchedRuleIds: string[];
  reason: string;
};

export type RegistryCanaryApplyPolicyEvaluationInput = {
  action: RegistryCanaryApplyPolicyAction;
  context: RegistryCanaryApplyServiceContext;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

export type RegistryEvalReference = {
  evalRunId: string;
  status: "pass" | "fail" | "missing" | "future";
};

export type RegistryApprovalReference = {
  approvalId: string;
  status: "approved" | "missing" | "rejected" | "future";
};

export type RegistryCanaryApplyDataSource = {
  listEvalReferences?: () => RegistryEvalReference[];
  listApprovalReferences?: () => RegistryApprovalReference[];
};

export type RegistryCanaryApplyServicesInput = {
  policyEvaluator?: (input: RegistryCanaryApplyPolicyEvaluationInput) => RegistryCanaryApplyPolicyDecisionSnapshot;
  dataSource?: RegistryCanaryApplyDataSource;
  now?: () => Date;
};

export type CreateRegistryCanaryPlanInput = {
  proposalId?: string;
  draftRegistryChangeId?: string;
  targetKind: RegistryCanaryTargetKind;
  targetId: string;
  canaryKind?: RegistryCanaryKind;
  requiredEvalRunIds?: string[];
  requiredApprovalIds?: string[];
  sampleStrategy?: string;
  rollbackPlanId?: string;
  metadata?: Record<string, unknown>;
};

export type RequestRegistryCanaryRunInput = {
  canaryPlanId: string;
  metadata?: Record<string, unknown>;
};

export type CreateRegistryApplyWorkflowInput = {
  proposalId: string;
  draftRegistryChangeId: string;
  targetKind: RegistryCanaryTargetKind;
  targetId: string;
  requiredEvalRunIds?: string[];
  requiredCanaryRunIds?: string[];
  requiredApprovalIds?: string[];
  rollbackPlanId: string;
  applyMode?: RegistryApplyMode;
  metadata?: Record<string, unknown>;
};

export type CreateRegistryRollbackPlanInput = {
  workflowId: string;
  rollbackKind?: RegistryRollbackKind;
  status?: RegistryRollbackStatus;
  requiredEvidence?: string[];
  metadata?: Record<string, unknown>;
};

const DEFAULT_THRESHOLDS: Record<RegistryCanaryMetricKind, number> = {
  pass_rate: 0.95,
  failure_rate: 0.05,
  token_cost: 1.2,
  runtime: 1.2,
  policy_denial_rate: 0.02,
  rollback_signal: 0,
  user_feedback_future: 0
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function policyAllow(decision?: RegistryCanaryApplyPolicyDecisionSnapshot): boolean {
  return !decision || decision.decision === "allow";
}

function deterministicHash(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function deterministicMetric(seed: string, metricKind: RegistryCanaryMetricKind): number {
  const hash = deterministicHash(`${seed}::${metricKind}`);
  switch (metricKind) {
    case "pass_rate":
      return 0.9 + ((hash % 100) / 1000);
    case "failure_rate":
      return ((hash % 60) / 1000);
    case "token_cost":
      return 1 + ((hash % 30) / 100);
    case "runtime":
      return 1 + ((hash % 25) / 100);
    case "policy_denial_rate":
      return ((hash % 25) / 1000);
    case "rollback_signal":
      return 0;
    case "user_feedback_future":
      return 0;
  }
}

function verdictFromValue(metricKind: RegistryCanaryMetricKind, value: number, threshold: number): RegistryCanaryVerdictKind {
  switch (metricKind) {
    case "pass_rate":
      if (value >= threshold) return "pass";
      if (value >= threshold - 0.05) return "warning";
      return "fail";
    case "failure_rate":
    case "policy_denial_rate":
    case "rollback_signal":
      if (value <= threshold) return "pass";
      if (value <= threshold * 1.5) return "warning";
      return "fail";
    case "token_cost":
    case "runtime":
      if (value <= threshold) return "pass";
      if (value <= threshold * 1.15) return "warning";
      return "fail";
    case "user_feedback_future":
      return "skipped";
  }
}

function aggregateOverallVerdict(verdicts: RegistryCanaryVerdictKind[]): RegistryCanaryOverallVerdict {
  if (verdicts.length === 0) return "skipped";
  if (verdicts.includes("fail")) return "failed";
  if (verdicts.includes("warning")) return "warning";
  if (verdicts.every((value) => value === "skipped")) return "skipped";
  return "passed";
}

function applyGateImpactFromVerdict(overall: RegistryCanaryOverallVerdict): RegistryCanaryApplyGateImpact {
  switch (overall) {
    case "passed":
      return "improves_readiness";
    case "warning":
      return "future_manual_review";
    case "failed":
      return "blocks_apply";
    case "blocked":
      return "blocks_apply";
    case "skipped":
      return "no_change";
  }
}

function isMockExecutable(canaryKind: RegistryCanaryKind): boolean {
  return canaryKind === "mock_deterministic" || canaryKind === "fixture_subset";
}

export class CanaryExecutionService {
  private readonly plans: RegistryCanaryPlan[] = [];
  private readonly runs: RegistryCanaryRun[] = [];
  private readonly results: RegistryCanaryResult[] = [];
  private readonly verdicts: RegistryCanaryVerdict[] = [];
  private readonly policyEvaluator?: (input: RegistryCanaryApplyPolicyEvaluationInput) => RegistryCanaryApplyPolicyDecisionSnapshot;
  private readonly dataSource: RegistryCanaryApplyDataSource;
  private readonly now: () => Date;

  constructor(input: RegistryCanaryApplyServicesInput = {}) {
    this.now = input.now ?? (() => new Date());
    this.policyEvaluator = input.policyEvaluator;
    this.dataSource = input.dataSource ?? {};
  }

  createCanaryPlan(input: CreateRegistryCanaryPlanInput, context: RegistryCanaryApplyServiceContext = {}): RegistryCanaryPlan {
    const policyResult = this.policyEvaluator?.({
      action: "registry.canary.plan",
      context,
      resourceId: input.targetId,
      metadata: { targetKind: input.targetKind }
    });
    const status: RegistryCanaryPlanStatus = !policyAllow(policyResult)
      ? "blocked"
      : input.canaryKind === undefined || isMockExecutable(input.canaryKind)
      ? "planned"
      : "future";
    const plan: RegistryCanaryPlan = {
      id: createId("canary_plan"),
      proposalId: input.proposalId,
      draftRegistryChangeId: input.draftRegistryChangeId,
      targetKind: input.targetKind,
      targetId: input.targetId,
      canaryKind: input.canaryKind ?? "mock_deterministic",
      status,
      requiredEvalRunIds: [...(input.requiredEvalRunIds ?? [])],
      requiredApprovalIds: [...(input.requiredApprovalIds ?? [])],
      sampleStrategy: input.sampleStrategy ?? "mock_deterministic_seed",
      rollbackPlanId: input.rollbackPlanId,
      createdAt: this.now(),
      metadata: {
        ...(input.metadata ?? {}),
        describesMock: true,
        policyDecision: policyResult?.decision ?? "not_applicable",
        autoApplyEnabled: false,
        activeRegistryMutationAllowed: false,
        externalCanaryExecuted: false,
        realProviderCallExecuted: false
      }
    };
    this.plans.push(plan);
    return clone(plan);
  }

  listCanaryPlans(): RegistryCanaryPlan[] {
    return this.plans.map(clone);
  }

  getCanaryPlan(planId: string): RegistryCanaryPlan | undefined {
    const plan = this.plans.find((entry) => entry.id === planId);
    return plan ? clone(plan) : undefined;
  }

  requestCanaryRun(input: RequestRegistryCanaryRunInput, context: RegistryCanaryApplyServiceContext = {}): RegistryCanaryRun {
    const plan = this.plans.find((entry) => entry.id === input.canaryPlanId);
    if (!plan) {
      throw new Error(`canary_plan_not_found:${input.canaryPlanId}`);
    }
    const policyResult = this.policyEvaluator?.({
      action: plan.canaryKind === "mock_deterministic" || plan.canaryKind === "fixture_subset"
        ? "registry.canary.run_mock"
        : "registry.canary.run_external_future",
      context,
      resourceId: plan.targetId,
      metadata: { canaryKind: plan.canaryKind, canaryPlanId: plan.id }
    });
    let status: RegistryCanaryRunStatus = "requested";
    if (!policyAllow(policyResult)) status = "blocked_policy";
    else if (!isMockExecutable(plan.canaryKind)) status = "future_external";
    else if (this.hasMissingRequiredEvals(plan)) status = "blocked_missing_eval";
    else if (this.hasMissingRequiredApprovals(plan)) status = "blocked_missing_approval";
    const run: RegistryCanaryRun = {
      id: createId("canary_run"),
      canaryPlanId: plan.id,
      status,
      startedAt: this.now(),
      requestId: context.requestId,
      correlationId: context.correlationId,
      requestedByActorId: context.actorId,
      requestedByServiceAccountId: context.serviceAccountId,
      metadata: {
        ...(input.metadata ?? {}),
        describesMock: true,
        canaryKind: plan.canaryKind,
        policyDecision: policyResult?.decision ?? "not_applicable",
        autoApplyEnabled: false,
        activeRegistryMutationAllowed: false,
        externalCanaryExecuted: false,
        realProviderCallExecuted: false
      }
    };
    this.runs.push(run);
    return clone(run);
  }

  executeMockCanaryRun(runId: string, context: RegistryCanaryApplyServiceContext = {}): RegistryCanaryVerdict {
    const run = this.runs.find((entry) => entry.id === runId);
    if (!run) throw new Error(`canary_run_not_found:${runId}`);
    const plan = this.plans.find((entry) => entry.id === run.canaryPlanId);
    if (!plan) throw new Error(`canary_plan_not_found:${run.canaryPlanId}`);
    if (run.status !== "requested") {
      const existing = this.verdicts.find((entry) => entry.canaryRunId === runId);
      if (existing) return clone(existing);
      return this.recordVerdictForBlockedRun(run);
    }
    const policyResult = this.policyEvaluator?.({
      action: "registry.canary.run_mock",
      context,
      resourceId: plan.targetId,
      metadata: { canaryRunId: run.id }
    });
    if (!policyAllow(policyResult)) {
      run.status = "blocked_policy";
      run.metadata = { ...run.metadata, policyDecision: policyResult?.decision ?? "not_applicable" };
      return this.recordVerdictForBlockedRun(run);
    }
    run.status = "running_mock";
    const seed = `${plan.id}::${plan.targetKind}::${plan.targetId}`;
    const metricKinds: RegistryCanaryMetricKind[] = ["pass_rate", "failure_rate", "token_cost", "runtime", "policy_denial_rate", "rollback_signal"];
    const runResults: RegistryCanaryResult[] = metricKinds.map((metricKind) => {
      const threshold = DEFAULT_THRESHOLDS[metricKind];
      const value = deterministicMetric(seed, metricKind);
      return {
        id: createId("canary_result"),
        canaryRunId: run.id,
        metricKind,
        value,
        threshold,
        verdict: verdictFromValue(metricKind, value, threshold),
        metadata: {
          describesMock: true,
          autoApplyEnabled: false,
          activeRegistryMutationAllowed: false,
          realProviderCallExecuted: false
        }
      };
    });
    for (const result of runResults) this.results.push(result);
    const overall = aggregateOverallVerdict(runResults.map((entry) => entry.verdict));
    run.completedAt = this.now();
    run.status = overall === "passed" ? "passed" : overall === "warning" ? "warning" : overall === "failed" ? "failed" : "skipped";
    const verdict: RegistryCanaryVerdict = {
      id: createId("canary_verdict"),
      canaryRunId: run.id,
      overallVerdict: overall,
      requiredForApply: true,
      applyGateImpact: applyGateImpactFromVerdict(overall),
      resultIds: runResults.map((entry) => entry.id),
      metadata: {
        describesMock: true,
        autoApplyEnabled: false,
        activeRegistryMutationAllowed: false,
        externalCanaryExecuted: false,
        realProviderCallExecuted: false
      }
    };
    this.verdicts.push(verdict);
    return clone(verdict);
  }

  private recordVerdictForBlockedRun(run: RegistryCanaryRun): RegistryCanaryVerdict {
    const verdict: RegistryCanaryVerdict = {
      id: createId("canary_verdict"),
      canaryRunId: run.id,
      overallVerdict: "blocked",
      requiredForApply: true,
      applyGateImpact: "blocks_apply",
      resultIds: [],
      metadata: {
        describesMock: true,
        runStatus: run.status,
        autoApplyEnabled: false,
        activeRegistryMutationAllowed: false,
        externalCanaryExecuted: false,
        realProviderCallExecuted: false
      }
    };
    this.verdicts.push(verdict);
    return clone(verdict);
  }

  getCanaryRun(runId: string): RegistryCanaryRun | undefined {
    const run = this.runs.find((entry) => entry.id === runId);
    return run ? clone(run) : undefined;
  }

  listCanaryRuns(query: { canaryPlanId?: string; status?: RegistryCanaryRunStatus } = {}): RegistryCanaryRun[] {
    return this.runs
      .filter((run) => query.canaryPlanId === undefined || run.canaryPlanId === query.canaryPlanId)
      .filter((run) => query.status === undefined || run.status === query.status)
      .map(clone);
  }

  listCanaryResults(query: { canaryRunId?: string } = {}): RegistryCanaryResult[] {
    return this.results
      .filter((result) => query.canaryRunId === undefined || result.canaryRunId === query.canaryRunId)
      .map(clone);
  }

  listCanaryVerdicts(query: { canaryRunId?: string } = {}): RegistryCanaryVerdict[] {
    return this.verdicts
      .filter((verdict) => query.canaryRunId === undefined || verdict.canaryRunId === query.canaryRunId)
      .map(clone);
  }

  getCanaryVerdictForRun(runId: string): RegistryCanaryVerdict | undefined {
    const verdict = this.verdicts.find((entry) => entry.canaryRunId === runId);
    return verdict ? clone(verdict) : undefined;
  }

  getRunsMatchingApprovedVerdicts(): RegistryCanaryRun[] {
    const passedRunIds = new Set(this.verdicts.filter((verdict) => verdict.overallVerdict === "passed").map((verdict) => verdict.canaryRunId));
    return this.runs.filter((run) => passedRunIds.has(run.id)).map(clone);
  }

  private hasMissingRequiredEvals(plan: RegistryCanaryPlan): boolean {
    if (plan.requiredEvalRunIds.length === 0) return false;
    const evals = this.dataSource.listEvalReferences?.() ?? [];
    if (evals.length === 0) return true;
    const passing = new Set(evals.filter((entry) => entry.status === "pass").map((entry) => entry.evalRunId));
    return plan.requiredEvalRunIds.some((id) => !passing.has(id));
  }

  private hasMissingRequiredApprovals(plan: RegistryCanaryPlan): boolean {
    if (plan.requiredApprovalIds.length === 0) return false;
    const approvals = this.dataSource.listApprovalReferences?.() ?? [];
    if (approvals.length === 0) return true;
    const approved = new Set(approvals.filter((entry) => entry.status === "approved").map((entry) => entry.approvalId));
    return plan.requiredApprovalIds.some((id) => !approved.has(id));
  }
}

export class ApplyWorkflowService {
  private readonly workflows: RegistryApplyWorkflow[] = [];
  private readonly gateDecisions: RegistryApplyGateDecision[] = [];
  private readonly rollbackPlans: RegistryRollbackPlan[] = [];
  private readonly canaryService?: CanaryExecutionService;
  private readonly policyEvaluator?: (input: RegistryCanaryApplyPolicyEvaluationInput) => RegistryCanaryApplyPolicyDecisionSnapshot;
  private readonly dataSource: RegistryCanaryApplyDataSource;
  private readonly now: () => Date;

  constructor(input: RegistryCanaryApplyServicesInput & { canaryService?: CanaryExecutionService } = {}) {
    this.now = input.now ?? (() => new Date());
    this.policyEvaluator = input.policyEvaluator;
    this.dataSource = input.dataSource ?? {};
    this.canaryService = input.canaryService;
  }

  createApplyWorkflow(input: CreateRegistryApplyWorkflowInput, context: RegistryCanaryApplyServiceContext = {}): RegistryApplyWorkflow {
    const policyResult = this.policyEvaluator?.({
      action: "registry.apply_workflow.create",
      context,
      resourceId: input.targetId,
      metadata: { targetKind: input.targetKind }
    });
    const allowed = policyAllow(policyResult);
    const initialStatus: RegistryApplyWorkflowStatus = !allowed
      ? "blocked"
      : (input.requiredEvalRunIds?.length ?? 0) > 0
      ? "eval_required"
      : (input.requiredCanaryRunIds?.length ?? 0) > 0
      ? "canary_required"
      : (input.requiredApprovalIds?.length ?? 0) > 0
      ? "approval_required"
      : "draft";
    const workflow: RegistryApplyWorkflow = {
      id: createId("apply_workflow"),
      proposalId: input.proposalId,
      draftRegistryChangeId: input.draftRegistryChangeId,
      targetKind: input.targetKind,
      targetId: input.targetId,
      status: initialStatus,
      requiredEvalRunIds: [...(input.requiredEvalRunIds ?? [])],
      requiredCanaryRunIds: [...(input.requiredCanaryRunIds ?? [])],
      requiredApprovalIds: [...(input.requiredApprovalIds ?? [])],
      rollbackPlanId: input.rollbackPlanId,
      applyMode: input.applyMode ?? "metadata_only",
      autoApplyEnabled: false,
      activeRegistryMutationAllowed: false,
      createdAt: this.now(),
      metadata: {
        ...(input.metadata ?? {}),
        describesMock: true,
        policyDecision: policyResult?.decision ?? "not_applicable",
        autoApplyEnabled: false,
        activeRegistryMutationAllowed: false,
        applyPerformed: false,
        activeRegistryMutated: false
      }
    };
    this.workflows.push(workflow);
    return clone(workflow);
  }

  createRollbackPlan(input: CreateRegistryRollbackPlanInput): RegistryRollbackPlan {
    const workflow = this.workflows.find((entry) => entry.id === input.workflowId);
    if (!workflow) throw new Error(`apply_workflow_not_found:${input.workflowId}`);
    const rollbackPlan: RegistryRollbackPlan = {
      id: createId("rollback_plan"),
      workflowId: workflow.id,
      rollbackKind: input.rollbackKind ?? "metadata_only",
      status: input.status ?? "planned",
      requiredEvidence: [...(input.requiredEvidence ?? ["draft_change_reference", "governance_approval_reference", "registry_history_checkpoint"])],
      metadata: {
        ...(input.metadata ?? {}),
        describesMock: true,
        autoApplyEnabled: false,
        activeRegistryMutationAllowed: false,
        rollbackExecuted: false
      }
    };
    this.rollbackPlans.push(rollbackPlan);
    workflow.metadata = { ...workflow.metadata, rollbackPlanId: rollbackPlan.id };
    return clone(rollbackPlan);
  }

  evaluateApplyGate(workflowId: string, context: RegistryCanaryApplyServiceContext = {}): RegistryApplyGateDecision {
    const workflow = this.workflows.find((entry) => entry.id === workflowId);
    if (!workflow) throw new Error(`apply_workflow_not_found:${workflowId}`);
    const policyResult = this.policyEvaluator?.({
      action: "registry.apply_gate.evaluate",
      context,
      resourceId: workflow.id,
      metadata: { targetKind: workflow.targetKind, targetId: workflow.targetId }
    });
    if (!policyAllow(policyResult)) {
      return this.recordDecision(workflow, "blocked_policy_denied", [policyResult?.reason ?? "policy_denied"], ["resolve_policy_denial"], { policyDecision: policyResult?.decision });
    }
    if (workflow.applyMode === "automatic_forbidden") {
      return this.recordDecision(workflow, "blocked_auto_apply_disabled", ["auto_apply_forbidden_v1"], ["keep_apply_metadata_only"], {});
    }
    const missingEval = this.findMissingEvals(workflow);
    if (missingEval.length > 0) {
      workflow.status = "eval_required";
      return this.recordDecision(workflow, "blocked_missing_eval", missingEval, ["attach_required_eval_runs"], { missingEval });
    }
    const failedEval = this.findFailedEvals(workflow);
    if (failedEval.length > 0) {
      workflow.status = "blocked";
      return this.recordDecision(workflow, "blocked_failed_eval", failedEval, ["resolve_failed_eval_runs"], { failedEval });
    }
    const missingCanary = this.findMissingCanary(workflow);
    if (missingCanary.length > 0) {
      workflow.status = "canary_required";
      return this.recordDecision(workflow, "blocked_missing_canary", missingCanary, ["request_canary_run"], { missingCanary });
    }
    const failedCanary = this.findFailedCanary(workflow);
    if (failedCanary.length > 0) {
      workflow.status = "blocked";
      return this.recordDecision(workflow, "blocked_failed_canary", failedCanary, ["resolve_failed_canary"], { failedCanary });
    }
    const missingApproval = this.findMissingApproval(workflow);
    if (missingApproval.length > 0) {
      workflow.status = "approval_required";
      return this.recordDecision(workflow, "blocked_missing_approval", missingApproval, ["request_manual_approval"], { missingApproval });
    }
    if (!this.hasReadyRollback(workflow)) {
      workflow.status = "blocked";
      return this.recordDecision(workflow, "blocked_missing_approval", ["rollback_plan_not_ready"], ["finalize_rollback_plan"], { rollbackPlanReady: false });
    }
    workflow.status = "ready_for_manual_apply_future";
    return this.recordDecision(workflow, "ready_for_manual_future", ["all_prerequisites_present"], ["wait_for_manual_apply_governance_v2"], { autoApplyEnabled: false });
  }

  recordMetadataOnlyApplyDecision(workflowId: string, context: RegistryCanaryApplyServiceContext = {}): RegistryApplyGateDecision {
    const workflow = this.workflows.find((entry) => entry.id === workflowId);
    if (!workflow) throw new Error(`apply_workflow_not_found:${workflowId}`);
    const gateDecision = this.evaluateApplyGate(workflowId, context);
    if (gateDecision.decision !== "ready_for_manual_future") return gateDecision;
    const policyResult = this.policyEvaluator?.({
      action: "registry.apply.metadata_record",
      context,
      resourceId: workflow.id,
      metadata: { targetKind: workflow.targetKind, targetId: workflow.targetId }
    });
    if (!policyAllow(policyResult)) {
      return this.recordDecision(workflow, "blocked_policy_denied", [policyResult?.reason ?? "policy_denied_metadata_record"], ["resolve_policy_denial"], { policyDecision: policyResult?.decision });
    }
    workflow.status = "applied_metadata_only";
    workflow.metadata = {
      ...workflow.metadata,
      applyPerformed: false,
      activeRegistryMutated: false,
      autoApplyEnabled: false,
      activeRegistryMutationAllowed: false,
      metadataOnlyApplyRecordedAt: this.now().toISOString()
    };
    return this.recordDecision(workflow, "metadata_only_recorded", ["metadata_only_record"], ["await_future_real_apply_governance"], {
      autoApplyEnabled: false,
      activeRegistryMutationAllowed: false,
      applyPerformed: false,
      activeRegistryMutated: false
    });
  }

  listWorkflows(query: { status?: RegistryApplyWorkflowStatus } = {}): RegistryApplyWorkflow[] {
    return this.workflows
      .filter((workflow) => query.status === undefined || workflow.status === query.status)
      .map(clone);
  }

  getWorkflow(id: string): RegistryApplyWorkflow | undefined {
    const workflow = this.workflows.find((entry) => entry.id === id);
    return workflow ? clone(workflow) : undefined;
  }

  listGateDecisions(query: { workflowId?: string } = {}): RegistryApplyGateDecision[] {
    return this.gateDecisions
      .filter((decision) => query.workflowId === undefined || decision.workflowId === query.workflowId)
      .map(clone);
  }

  listRollbackPlans(query: { workflowId?: string } = {}): RegistryRollbackPlan[] {
    return this.rollbackPlans
      .filter((plan) => query.workflowId === undefined || plan.workflowId === query.workflowId)
      .map(clone);
  }

  private recordDecision(
    workflow: RegistryApplyWorkflow,
    decision: RegistryApplyGateDecisionKind,
    reasons: string[],
    requiredActions: string[],
    extraMetadata: Record<string, unknown>
  ): RegistryApplyGateDecision {
    const gateDecision: RegistryApplyGateDecision = {
      id: createId("apply_gate_decision"),
      workflowId: workflow.id,
      decision,
      reasons,
      requiredActions,
      applyPerformed: false,
      activeRegistryMutated: false,
      decidedAt: this.now(),
      metadata: {
        ...extraMetadata,
        describesMock: true,
        autoApplyEnabled: false,
        activeRegistryMutationAllowed: false,
        applyPerformed: false,
        activeRegistryMutated: false
      }
    };
    this.gateDecisions.push(gateDecision);
    return clone(gateDecision);
  }

  private findMissingEvals(workflow: RegistryApplyWorkflow): string[] {
    if (workflow.requiredEvalRunIds.length === 0) return [];
    const evals = this.dataSource.listEvalReferences?.() ?? [];
    if (evals.length === 0) return [...workflow.requiredEvalRunIds];
    const present = new Set(evals.map((entry) => entry.evalRunId));
    return workflow.requiredEvalRunIds.filter((id) => !present.has(id));
  }

  private findFailedEvals(workflow: RegistryApplyWorkflow): string[] {
    if (workflow.requiredEvalRunIds.length === 0) return [];
    const evals = this.dataSource.listEvalReferences?.() ?? [];
    return evals.filter((entry) => workflow.requiredEvalRunIds.includes(entry.evalRunId) && entry.status === "fail").map((entry) => entry.evalRunId);
  }

  private findMissingCanary(workflow: RegistryApplyWorkflow): string[] {
    if (workflow.requiredCanaryRunIds.length === 0) return [];
    if (!this.canaryService) return [...workflow.requiredCanaryRunIds];
    const runs = this.canaryService.listCanaryRuns();
    const present = new Set(runs.map((run) => run.id));
    return workflow.requiredCanaryRunIds.filter((id) => !present.has(id));
  }

  private findFailedCanary(workflow: RegistryApplyWorkflow): string[] {
    if (workflow.requiredCanaryRunIds.length === 0) return [];
    if (!this.canaryService) return [];
    const failed: string[] = [];
    for (const runId of workflow.requiredCanaryRunIds) {
      const verdict = this.canaryService.getCanaryVerdictForRun(runId);
      if (!verdict) continue;
      if (verdict.overallVerdict === "failed" || verdict.overallVerdict === "blocked") failed.push(runId);
    }
    return failed;
  }

  private findMissingApproval(workflow: RegistryApplyWorkflow): string[] {
    if (workflow.requiredApprovalIds.length === 0) return ["governance_approval_required_v1"];
    const approvals = this.dataSource.listApprovalReferences?.() ?? [];
    if (approvals.length === 0) return [...workflow.requiredApprovalIds];
    const approved = new Set(approvals.filter((entry) => entry.status === "approved").map((entry) => entry.approvalId));
    return workflow.requiredApprovalIds.filter((id) => !approved.has(id));
  }

  private hasReadyRollback(workflow: RegistryApplyWorkflow): boolean {
    const plan = this.rollbackPlans.find((entry) => entry.workflowId === workflow.id);
    if (!plan) return false;
    return plan.status === "planned" && (plan.rollbackKind === "metadata_only" || plan.rollbackKind === "manual_review");
  }
}

export function createCanaryAndApplyServices(input: RegistryCanaryApplyServicesInput = {}): {
  canaryService: CanaryExecutionService;
  applyWorkflowService: ApplyWorkflowService;
  getSummary: () => RegistryCanaryApplySummary;
} {
  const canaryService = new CanaryExecutionService(input);
  const applyWorkflowService = new ApplyWorkflowService({ ...input, canaryService });
  const now = input.now ?? (() => new Date());
  const getSummary = (): RegistryCanaryApplySummary => {
    const runs = canaryService.listCanaryRuns();
    const verdicts = canaryService.listCanaryVerdicts();
    const workflows = applyWorkflowService.listWorkflows();
    const decisions = applyWorkflowService.listGateDecisions();
    const rollbacks = applyWorkflowService.listRollbackPlans();
    return {
      status: "v1_implemented",
      planningOnly: true,
      generatedAt: now(),
      canaryPlanCount: canaryService.listCanaryPlans().length,
      canaryRunCount: runs.length,
      canaryResultCount: canaryService.listCanaryResults().length,
      canaryVerdictCount: verdicts.length,
      applyWorkflowCount: workflows.length,
      applyGateDecisionCount: decisions.length,
      rollbackPlanCount: rollbacks.length,
      passedCanaryRunCount: verdicts.filter((entry) => entry.overallVerdict === "passed").length,
      failedCanaryRunCount: verdicts.filter((entry) => entry.overallVerdict === "failed").length,
      warningCanaryRunCount: verdicts.filter((entry) => entry.overallVerdict === "warning").length,
      blockedCanaryRunCount: verdicts.filter((entry) => entry.overallVerdict === "blocked").length,
      skippedCanaryRunCount: verdicts.filter((entry) => entry.overallVerdict === "skipped").length,
      readyForManualApplyCount: decisions.filter((entry) => entry.decision === "ready_for_manual_future").length,
      blockedApplyDecisionCount: decisions.filter((entry) => entry.decision.startsWith("blocked_")).length,
      metadataOnlyApplyDecisionCount: decisions.filter((entry) => entry.decision === "metadata_only_recorded").length,
      autoApplyEnabled: false,
      activeRegistryMutationAllowed: false,
      applyPerformed: false,
      activeRegistryMutated: false,
      externalCanaryExecuted: false,
      realEvalExecuted: false,
      realProviderCallExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    };
  };
  return { canaryService, applyWorkflowService, getSummary };
}
