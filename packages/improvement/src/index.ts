import { createId, slugify } from "@aichestra/core";
import type {
  AutoImprovementSafetyPolicy,
  AutoImprovementAnalysis,
  CanaryReadiness,
  CanaryRolloutPlan,
  CanaryRolloutStatus,
  CanaryStage,
  DraftRegistryChange,
  DraftRegistryChangeStatus,
  DraftRegistryChangeType,
  EvalRequirement,
  EvalRequirementRequiredStatus,
  EvalRequirementType,
  FailureCluster,
  FailureClusterStatus,
  FailureSeverity,
  FailureSignal,
  FailureSignalSourceType,
  FailureSignalTargetKind,
  ImprovementGovernanceAuditAction,
  ImprovementGovernanceAuditEvent,
  ImprovementCandidate,
  ImprovementCandidateStatus,
  ImprovementCandidateType,
  ImprovementPriority,
  ImprovementProposal,
  ImprovementProposalChangeType,
  ImprovementProposalStatus,
  ImprovementTargetKind,
  ProposalApplyGate,
  ProposalEvalRun,
  ProposalEvalRunStatus,
  ProposalGovernanceDecision,
  ProposalGovernanceDecisionType,
  ProposalReadiness,
  ProposalReviewQueueItem,
  ProposalReviewReadinessStatus,
  ProposalReviewRecommendedAction
} from "@aichestra/core";
import { PolicyService, createPolicyContext, createPolicyResource, createPolicySubject } from "@aichestra/policy";

export type CreateFailureSignalInput = Omit<FailureSignal, "id" | "observedAt" | "metadata"> &
  Partial<Pick<FailureSignal, "id" | "observedAt" | "metadata">>;

export type UpsertFailureClusterInput = FailureCluster;

export type CreateImprovementCandidateInput = {
  sourceClusterId: string;
  targetKind?: ImprovementTargetKind;
  targetId?: string;
  targetName?: string;
  targetVersion?: string;
  candidateType?: ImprovementCandidateType;
  priority?: ImprovementPriority;
  summary?: string;
  evidence?: string[];
};

export type TriageImprovementCandidateInput = {
  id: string;
  status: ImprovementCandidateStatus;
};

export type CreateImprovementProposalInput = {
  candidateId: string;
  proposedChangeType?: ImprovementProposalChangeType;
  proposedPatch?: Record<string, unknown>;
  proposedSummary?: string;
  rationale?: string;
  safetyNotes?: string[];
  createdBy?: string;
};

export type TransitionImprovementProposalInput = {
  id: string;
  status: ImprovementProposalStatus;
};

export type CreateEvalRequirementInput = Omit<EvalRequirement, "id" | "createdAt"> &
  Partial<Pick<EvalRequirement, "id" | "createdAt">>;

export type CreateCanaryRolloutPlanInput = Omit<CanaryRolloutPlan, "id" | "status" | "createdAt" | "updatedAt"> &
  Partial<Pick<CanaryRolloutPlan, "id" | "status" | "createdAt" | "updatedAt">>;

export type UpdateSafetyPolicyInput = Partial<
  Pick<
    AutoImprovementSafetyPolicy,
    | "name"
    | "enabled"
    | "allowedTargetKinds"
    | "allowAutoApply"
    | "requireHumanApproval"
    | "requireEvalPassed"
    | "requireCanary"
    | "maxChangesPerProposal"
    | "blockedPathsOrScopes"
  >
>;

export type AutoImprovementEngine = {
  analyzeFailureCluster(clusterId: string): AutoImprovementAnalysis;
  generateImprovementCandidate(clusterId: string): ImprovementCandidate;
  generateImprovementProposal(candidateId: string): ImprovementProposal;
  prepareDraftRegistryChange(proposalId: string): DraftRegistryChange;
  evaluateProposalReadiness(proposalId: string): ProposalReadiness;
};

export type CreateDraftRegistryChangeInput = Omit<DraftRegistryChange, "id" | "status" | "createdAt" | "updatedAt"> &
  Partial<Pick<DraftRegistryChange, "id" | "status" | "createdAt" | "updatedAt">>;

export type TransitionDraftRegistryChangeInput = {
  id: string;
  status: DraftRegistryChangeStatus;
};

export type CreateGovernanceDecisionInput = {
  proposalId: string;
  actorId?: string;
  decision: ProposalGovernanceDecisionType;
  reason: string;
  createdAt?: Date;
};

export type CreateProposalEvalRunInput = Omit<ProposalEvalRun, "id" | "attachedAt" | "attachedBy"> &
  Partial<Pick<ProposalEvalRun, "id" | "attachedAt" | "attachedBy">>;

export type ImprovementPolicyInput = {
  policyService?: PolicyService;
};

export type ProposalReviewQueueFilter = {
  status?: ImprovementProposalStatus;
  targetKind?: ImprovementTargetKind;
  recommendedAction?: ProposalReviewRecommendedAction;
  includeArchived?: boolean;
};

export type FailureSignalRepository = {
  createFailureSignal(input: FailureSignal): FailureSignal;
  listFailureSignals(): FailureSignal[];
  getFailureSignal(id: string): FailureSignal | undefined;
};

export type FailureClusterRepository = {
  upsertFailureCluster(input: FailureCluster): FailureCluster;
  listFailureClusters(): FailureCluster[];
  getFailureCluster(id: string): FailureCluster | undefined;
  updateFailureCluster(id: string, patch: Partial<FailureCluster>): FailureCluster;
};

export type ImprovementCandidateRepository = {
  createImprovementCandidate(input: ImprovementCandidate): ImprovementCandidate;
  listImprovementCandidates(): ImprovementCandidate[];
  getImprovementCandidate(id: string): ImprovementCandidate | undefined;
  updateImprovementCandidate(id: string, patch: Partial<ImprovementCandidate>): ImprovementCandidate;
};

export type ImprovementProposalRepository = {
  createImprovementProposal(input: ImprovementProposal): ImprovementProposal;
  listImprovementProposals(): ImprovementProposal[];
  getImprovementProposal(id: string): ImprovementProposal | undefined;
  updateImprovementProposal(id: string, patch: Partial<ImprovementProposal>): ImprovementProposal;
};

export type EvalRequirementRepository = {
  createEvalRequirement(input: EvalRequirement): EvalRequirement;
  listEvalRequirements(): EvalRequirement[];
  getEvalRequirement(id: string): EvalRequirement | undefined;
};

export type CanaryRolloutPlanRepository = {
  createCanaryRolloutPlan(input: CanaryRolloutPlan): CanaryRolloutPlan;
  listCanaryRolloutPlans(): CanaryRolloutPlan[];
  getCanaryRolloutPlan(id: string): CanaryRolloutPlan | undefined;
};

export type AutoImprovementSafetyPolicyRepository = {
  listSafetyPolicies(): AutoImprovementSafetyPolicy[];
  getSafetyPolicy(id: string): AutoImprovementSafetyPolicy | undefined;
  upsertSafetyPolicy(input: AutoImprovementSafetyPolicy): AutoImprovementSafetyPolicy;
  updateSafetyPolicy(id: string, patch: Partial<AutoImprovementSafetyPolicy>): AutoImprovementSafetyPolicy;
};

export type AutoImprovementAnalysisRepository = {
  createAutoImprovementAnalysis(input: AutoImprovementAnalysis): AutoImprovementAnalysis;
  listAutoImprovementAnalyses(): AutoImprovementAnalysis[];
  getAutoImprovementAnalysis(id: string): AutoImprovementAnalysis | undefined;
  getAutoImprovementAnalysisForCluster(clusterId: string): AutoImprovementAnalysis | undefined;
};

export type DraftRegistryChangeRepository = {
  createDraftRegistryChange(input: DraftRegistryChange): DraftRegistryChange;
  listDraftRegistryChanges(): DraftRegistryChange[];
  getDraftRegistryChange(id: string): DraftRegistryChange | undefined;
  getDraftRegistryChangeForProposal(proposalId: string): DraftRegistryChange | undefined;
  updateDraftRegistryChange(id: string, patch: Partial<DraftRegistryChange>): DraftRegistryChange;
};

export type ProposalReadinessRepository = {
  upsertProposalReadiness(input: ProposalReadiness): ProposalReadiness;
  listProposalReadiness(): ProposalReadiness[];
  getProposalReadiness(proposalId: string): ProposalReadiness | undefined;
};

export type ProposalGovernanceDecisionRepository = {
  createProposalGovernanceDecision(input: ProposalGovernanceDecision): ProposalGovernanceDecision;
  listProposalGovernanceDecisions(proposalId?: string): ProposalGovernanceDecision[];
};

export type ProposalEvalRunRepository = {
  createProposalEvalRun(input: ProposalEvalRun): ProposalEvalRun;
  listProposalEvalRuns(proposalId?: string): ProposalEvalRun[];
};

export type CanaryReadinessRepository = {
  upsertCanaryReadiness(input: CanaryReadiness): CanaryReadiness;
  getCanaryReadiness(proposalId: string): CanaryReadiness | undefined;
  listCanaryReadiness(): CanaryReadiness[];
};

export type ProposalApplyGateRepository = {
  upsertProposalApplyGate(input: ProposalApplyGate): ProposalApplyGate;
  getProposalApplyGate(proposalId: string): ProposalApplyGate | undefined;
  listProposalApplyGates(): ProposalApplyGate[];
};

export type ImprovementGovernanceAuditRepository = {
  appendImprovementGovernanceAuditEvent(input: ImprovementGovernanceAuditEvent): ImprovementGovernanceAuditEvent;
  listImprovementGovernanceAuditEvents(proposalId?: string): ImprovementGovernanceAuditEvent[];
};

export type ImprovementRepository =
  & FailureSignalRepository
  & FailureClusterRepository
  & ImprovementCandidateRepository
  & ImprovementProposalRepository
  & EvalRequirementRepository
  & CanaryRolloutPlanRepository
  & AutoImprovementSafetyPolicyRepository
  & AutoImprovementAnalysisRepository
  & DraftRegistryChangeRepository
  & ProposalReadinessRepository
  & ProposalGovernanceDecisionRepository
  & ProposalEvalRunRepository
  & CanaryReadinessRepository
  & ProposalApplyGateRepository
  & ImprovementGovernanceAuditRepository;

export type ImprovementSnapshot = {
  failureSignals?: FailureSignal[];
  failureClusters?: FailureCluster[];
  candidates?: ImprovementCandidate[];
  proposals?: ImprovementProposal[];
  evalRequirements?: EvalRequirement[];
  canaryRolloutPlans?: CanaryRolloutPlan[];
  safetyPolicies?: AutoImprovementSafetyPolicy[];
  analyses?: AutoImprovementAnalysis[];
  draftRegistryChanges?: DraftRegistryChange[];
  proposalReadiness?: ProposalReadiness[];
  governanceDecisions?: ProposalGovernanceDecision[];
  proposalEvalRuns?: ProposalEvalRun[];
  canaryReadiness?: CanaryReadiness[];
  proposalApplyGates?: ProposalApplyGate[];
  governanceAuditEvents?: ImprovementGovernanceAuditEvent[];
};

export type FailureSignalDto = Omit<FailureSignal, "observedAt"> & { observedAt: string };
export type FailureClusterDto = Omit<FailureCluster, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
export type ImprovementCandidateDto = Omit<ImprovementCandidate, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
export type ImprovementProposalDto = Omit<ImprovementProposal, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
export type EvalRequirementDto = Omit<EvalRequirement, "createdAt"> & { createdAt: string };
export type CanaryRolloutPlanDto = Omit<CanaryRolloutPlan, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
export type AutoImprovementSafetyPolicyDto = Omit<AutoImprovementSafetyPolicy, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
export type AutoImprovementAnalysisDto = Omit<AutoImprovementAnalysis, "createdAt"> & { createdAt: string };
export type DraftRegistryChangeDto = Omit<DraftRegistryChange, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
export type ProposalReadinessDto = Omit<ProposalReadiness, "evaluatedAt"> & { evaluatedAt: string };
export type ProposalReviewQueueItemDto = Omit<ProposalReviewQueueItem, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
export type ProposalGovernanceDecisionDto = Omit<ProposalGovernanceDecision, "createdAt"> & { createdAt: string };
export type ProposalEvalRunDto = Omit<ProposalEvalRun, "attachedAt"> & { attachedAt: string };
export type CanaryReadinessDto = Omit<CanaryReadiness, "evaluatedAt"> & { evaluatedAt: string };
export type ProposalApplyGateDto = Omit<ProposalApplyGate, "evaluatedAt"> & { evaluatedAt: string };
export type ImprovementGovernanceAuditEventDto = Omit<ImprovementGovernanceAuditEvent, "createdAt"> & { createdAt: string };

const sourceTypes = new Set<FailureSignalSourceType>([
  "task_run",
  "conflict_manager",
  "registry_resolver",
  "test_result",
  "usage_ledger",
  "manual"
]);
const signalTargetKinds = new Set<FailureSignalTargetKind>(["skill", "harness", "instruction", "model", "conflict_manager", "unknown"]);
const improvementTargetKinds = new Set<ImprovementTargetKind>(["skill", "harness", "instruction"]);
const severities = new Set<FailureSeverity>(["low", "medium", "high", "critical"]);
const candidateTypes = new Set<ImprovementCandidateType>([
  "update_instruction",
  "update_skill",
  "update_harness",
  "adjust_resolver",
  "add_eval_requirement"
]);
const priorities = new Set<ImprovementPriority>(["low", "medium", "high"]);
const candidateStatuses = new Set<ImprovementCandidateStatus>(["new", "triaged", "proposal_requested", "proposal_created", "dismissed"]);
const proposalChangeTypes = new Set<ImprovementProposalChangeType>([
  "patch",
  "new_version",
  "status_change",
  "eval_requirement",
  "instruction_update"
]);
const proposalStatuses = new Set<ImprovementProposalStatus>([
  "draft",
  "awaiting_review",
  "eval_required",
  "approved_for_canary",
  "rejected",
  "applied",
  "archived"
]);
const evalRequirementTypes = new Set<EvalRequirementType>(["unit_test", "integration_test", "golden_case", "manual_review", "mock_eval"]);
const evalRequiredStatuses = new Set<EvalRequirementRequiredStatus>(["passed", "approved"]);
const canaryStatuses = new Set<CanaryRolloutStatus>(["draft", "ready", "running", "paused", "completed", "failed"]);
const draftRegistryChangeTypes = new Set<DraftRegistryChangeType>(["patch", "new_version", "metadata_update", "eval_requirement", "instruction_update"]);
const draftRegistryChangeStatuses = new Set<DraftRegistryChangeStatus>(["draft", "awaiting_review", "rejected", "superseded"]);
const governanceDecisionTypes = new Set<ProposalGovernanceDecisionType>([
  "approve",
  "reject",
  "request_changes",
  "mark_eval_required",
  "mark_canary_required",
  "archive"
]);
const proposalEvalRunStatuses = new Set<ProposalEvalRunStatus>(["pending", "passed", "failed", "skipped"]);
const governanceAuditActions = new Set<ImprovementGovernanceAuditAction>([
  "proposal_decision_recorded",
  "proposal_approved",
  "proposal_rejected",
  "proposal_changes_requested",
  "proposal_eval_attached",
  "proposal_canary_readiness_checked",
  "proposal_apply_gate_checked",
  "proposal_apply_blocked"
]);

const proposalTransitions: Record<ImprovementProposalStatus, ImprovementProposalStatus[]> = {
  draft: ["awaiting_review", "eval_required", "rejected", "archived"],
  awaiting_review: ["eval_required", "approved_for_canary", "rejected", "archived"],
  eval_required: ["awaiting_review", "approved_for_canary", "rejected", "archived"],
  approved_for_canary: ["rejected", "archived"],
  rejected: ["archived"],
  applied: [],
  archived: []
};

const draftRegistryChangeTransitions: Record<DraftRegistryChangeStatus, DraftRegistryChangeStatus[]> = {
  draft: ["awaiting_review", "rejected", "superseded"],
  awaiting_review: ["rejected", "superseded"],
  rejected: [],
  superseded: []
};

function cloneRecord<T>(value: T): T {
  return structuredClone(value);
}

function cloneFailureSignal(signal: FailureSignal): FailureSignal {
  return { ...signal, observedAt: new Date(signal.observedAt), metadata: cloneRecord(signal.metadata) };
}

function cloneFailureCluster(cluster: FailureCluster): FailureCluster {
  return { ...cluster, signalIds: [...cluster.signalIds], createdAt: new Date(cluster.createdAt), updatedAt: new Date(cluster.updatedAt) };
}

function cloneCandidate(candidate: ImprovementCandidate): ImprovementCandidate {
  return { ...candidate, evidence: [...candidate.evidence], createdAt: new Date(candidate.createdAt), updatedAt: new Date(candidate.updatedAt) };
}

function cloneProposal(proposal: ImprovementProposal): ImprovementProposal {
  return {
    ...proposal,
    proposedPatch: proposal.proposedPatch ? cloneRecord(proposal.proposedPatch) : undefined,
    safetyNotes: [...proposal.safetyNotes],
    createdAt: new Date(proposal.createdAt),
    updatedAt: new Date(proposal.updatedAt)
  };
}

function cloneEvalRequirement(requirement: EvalRequirement): EvalRequirement {
  return { ...requirement, createdAt: new Date(requirement.createdAt) };
}

function cloneCanaryPlan(plan: CanaryRolloutPlan): CanaryRolloutPlan {
  return {
    ...plan,
    stages: plan.stages.map((stage) => ({
      ...stage,
      successCriteria: [...stage.successCriteria],
      rollbackCriteria: [...stage.rollbackCriteria]
    })),
    createdAt: new Date(plan.createdAt),
    updatedAt: new Date(plan.updatedAt)
  };
}

function cloneSafetyPolicy(policy: AutoImprovementSafetyPolicy): AutoImprovementSafetyPolicy {
  return {
    ...policy,
    allowedTargetKinds: [...policy.allowedTargetKinds],
    blockedPathsOrScopes: policy.blockedPathsOrScopes ? [...policy.blockedPathsOrScopes] : undefined,
    createdAt: new Date(policy.createdAt),
    updatedAt: new Date(policy.updatedAt)
  };
}

function cloneAnalysis(analysis: AutoImprovementAnalysis): AutoImprovementAnalysis {
  return {
    ...analysis,
    evidence: [...analysis.evidence],
    createdAt: new Date(analysis.createdAt)
  };
}

function cloneDraftRegistryChange(change: DraftRegistryChange): DraftRegistryChange {
  return {
    ...change,
    draftPayload: cloneRecord(change.draftPayload),
    createdAt: new Date(change.createdAt),
    updatedAt: new Date(change.updatedAt)
  };
}

function cloneProposalReadiness(readiness: ProposalReadiness): ProposalReadiness {
  return {
    ...readiness,
    requiredEvalIds: [...readiness.requiredEvalIds],
    blockingReasons: [...readiness.blockingReasons],
    evaluatedAt: new Date(readiness.evaluatedAt)
  };
}

function cloneProposalReviewQueueItem(item: ProposalReviewQueueItem): ProposalReviewQueueItem {
  return {
    ...item,
    blockingReasons: [...item.blockingReasons],
    requiredEvalIds: [...item.requiredEvalIds],
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt)
  };
}

function cloneGovernanceDecision(decision: ProposalGovernanceDecision): ProposalGovernanceDecision {
  return { ...decision, createdAt: new Date(decision.createdAt) };
}

function cloneProposalEvalRun(run: ProposalEvalRun): ProposalEvalRun {
  return {
    ...run,
    metadata: run.metadata ? cloneRecord(run.metadata) : undefined,
    attachedAt: new Date(run.attachedAt)
  };
}

function cloneCanaryReadiness(readiness: CanaryReadiness): CanaryReadiness {
  return {
    ...readiness,
    blockingReasons: [...readiness.blockingReasons],
    evaluatedAt: new Date(readiness.evaluatedAt)
  };
}

function cloneProposalApplyGate(gate: ProposalApplyGate): ProposalApplyGate {
  return {
    ...gate,
    blockingReasons: [...gate.blockingReasons],
    evaluatedAt: new Date(gate.evaluatedAt)
  };
}

function cloneGovernanceAuditEvent(event: ImprovementGovernanceAuditEvent): ImprovementGovernanceAuditEvent {
  return {
    ...event,
    metadata: event.metadata ? cloneRecord(event.metadata) : undefined,
    createdAt: new Date(event.createdAt)
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
    throw new Error(`${field} must be a non-empty string array`);
  }
  return value;
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function severityRank(severity: FailureSeverity): number {
  return ["low", "medium", "high", "critical"].indexOf(severity);
}

function highestSeverity(signals: FailureSignal[]): FailureSeverity {
  return signals.reduce<FailureSeverity>((current, signal) => severityRank(signal.severity) > severityRank(current) ? signal.severity : current, "low");
}

function sortById<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

function isImprovementTargetKind(value: FailureSignalTargetKind): value is ImprovementTargetKind {
  return improvementTargetKinds.has(value as ImprovementTargetKind);
}

function defaultCandidateType(targetKind: ImprovementTargetKind): ImprovementCandidateType {
  if (targetKind === "instruction") return "update_instruction";
  if (targetKind === "harness") return "update_harness";
  return "update_skill";
}

function defaultChangeType(candidateType: ImprovementCandidateType): ImprovementProposalChangeType {
  if (candidateType === "update_instruction") return "instruction_update";
  if (candidateType === "add_eval_requirement") return "eval_requirement";
  if (candidateType === "update_skill" || candidateType === "update_harness") return "patch";
  return "patch";
}

function parseTargetRef(targetRef: string | undefined, fallbackKind: ImprovementTargetKind): { id: string; name: string; version: string } {
  if (!targetRef) {
    return {
      id: `${fallbackKind}_unknown`,
      name: `unknown-${fallbackKind}`,
      version: "0.0.0"
    };
  }
  const [namePart, versionPart] = targetRef.split("@");
  const name = namePart && namePart.length > 0 ? namePart : `unknown-${fallbackKind}`;
  return {
    id: `${fallbackKind}_${slugify(name)}`,
    name,
    version: versionPart && versionPart.length > 0 ? versionPart : "0.0.0"
  };
}

function stableClusterId(category: string, targetKind: FailureSignalTargetKind, targetRef: string | undefined): string {
  return `cluster_${slugify(`${category}-${targetKind}-${targetRef ?? "none"}`)}`;
}

function stableAnalysisId(clusterId: string): string {
  return `analysis_${slugify(clusterId)}`;
}

function stableCandidateId(clusterId: string, candidateType: ImprovementCandidateType): string {
  return `candidate_${slugify(`${clusterId}-${candidateType}`)}`;
}

function stableProposalId(candidateId: string): string {
  return `proposal_${slugify(candidateId)}`;
}

function stableDraftChangeId(proposalId: string): string {
  return `draft_change_${slugify(proposalId)}`;
}

function stableReviewQueueItemId(proposalId: string): string {
  return `proposal_review_${slugify(proposalId)}`;
}

function createGovernanceEventId(action: ImprovementGovernanceAuditAction, proposalId: string | undefined, createdAt: Date): string {
  return `governance_event_${slugify(`${action}-${proposalId ?? "none"}-${createdAt.toISOString()}`)}`;
}

function targetKindForCluster(cluster: FailureCluster): ImprovementTargetKind {
  if (cluster.category === "instruction_checksum_mismatch") return "instruction";
  if (cluster.category === "harness_runtime_failure") return "harness";
  if (cluster.category === "conflict_risk_repeated") return "skill";
  if (cluster.targetKind === "skill" || cluster.targetKind === "harness" || cluster.targetKind === "instruction") return cluster.targetKind;
  return "skill";
}

function targetRefForCluster(cluster: FailureCluster, targetKind: ImprovementTargetKind): string | undefined {
  if (cluster.category === "conflict_risk_repeated") return "conflict-risk-reviewer@1.0.0";
  if (cluster.targetRef) return cluster.targetRef;
  if (cluster.category === "cost_spike") return "model-routing@0.0.0";
  return `${targetKind}-unknown@0.0.0`;
}

function candidateTypeForCluster(cluster: FailureCluster, targetKind: ImprovementTargetKind): ImprovementCandidateType {
  if (cluster.category === "instruction_checksum_mismatch") return "update_instruction";
  if (cluster.category === "repeated_eval_failed" && targetKind === "skill") return "update_skill";
  if (cluster.category === "harness_runtime_failure") return "update_harness";
  if (cluster.category === "registry_resolution_warning") return targetKind === "instruction" ? "update_instruction" : "adjust_resolver";
  if (cluster.category === "conflict_risk_repeated") return "update_skill";
  if (cluster.category === "cost_spike") return "adjust_resolver";
  return defaultCandidateType(targetKind);
}

function proposalChangeTypeForCandidate(candidate: ImprovementCandidate, cluster?: FailureCluster): ImprovementProposalChangeType {
  if (cluster?.category === "repeated_eval_failed" && candidate.targetKind === "skill") return "new_version";
  if (cluster?.category === "cost_spike") return "status_change";
  if (candidate.candidateType === "update_instruction") return "instruction_update";
  if (candidate.candidateType === "add_eval_requirement") return "eval_requirement";
  if (candidate.candidateType === "update_skill" && cluster?.category === "conflict_risk_repeated") return "patch";
  return defaultChangeType(candidate.candidateType);
}

function draftChangeTypeForProposal(proposal: ImprovementProposal): DraftRegistryChangeType {
  if (proposal.proposedChangeType === "status_change") return "metadata_update";
  return proposal.proposedChangeType;
}

function bumpPatchVersion(version: string): string {
  const [major, minor, patch] = version.split(".").map((part) => Number.parseInt(part, 10));
  if (Number.isNaN(major) || Number.isNaN(minor) || Number.isNaN(patch)) return `${version}-draft`;
  return `${major}.${minor}.${patch + 1}`;
}

export function createDefaultSafetyPolicy(now = new Date()): AutoImprovementSafetyPolicy {
  return {
    id: "policy_auto_improvement_default",
    name: "Default mock auto-improvement safety policy",
    enabled: true,
    allowedTargetKinds: ["skill", "harness", "instruction"],
    allowAutoApply: false,
    requireHumanApproval: true,
    requireEvalPassed: true,
    requireCanary: true,
    maxChangesPerProposal: 1,
    blockedPathsOrScopes: [],
    createdAt: new Date(now),
    updatedAt: new Date(now)
  };
}

export function createFailureSignal(input: CreateFailureSignalInput): FailureSignal {
  if (!sourceTypes.has(input.sourceType)) throw new Error("sourceType must be task_run, conflict_manager, registry_resolver, test_result, usage_ledger, or manual");
  if (!signalTargetKinds.has(input.targetKind)) throw new Error("targetKind must be skill, harness, instruction, model, conflict_manager, or unknown");
  if (!severities.has(input.severity)) throw new Error("severity must be low, medium, high, or critical");
  const observedAt = input.observedAt ?? new Date();
  if (!isValidDate(observedAt)) throw new Error("observedAt must be a valid Date");
  return {
    ...input,
    id: input.id ?? createId("failure_signal"),
    sourceId: requireString(input.sourceId, "sourceId"),
    category: requireString(input.category, "category"),
    summary: requireString(input.summary, "summary"),
    observedAt,
    metadata: input.metadata ? cloneRecord(input.metadata) : {}
  };
}

export function createEvalRequirement(input: CreateEvalRequirementInput): EvalRequirement {
  if (!improvementTargetKinds.has(input.targetKind)) throw new Error("targetKind must be skill, harness, or instruction");
  if (!evalRequirementTypes.has(input.requirementType)) throw new Error("requirementType must be unit_test, integration_test, golden_case, manual_review, or mock_eval");
  if (!evalRequiredStatuses.has(input.requiredStatus)) throw new Error("requiredStatus must be passed or approved");
  return {
    ...input,
    id: input.id ?? createId("eval_requirement"),
    requirementName: requireString(input.requirementName, "requirementName"),
    description: requireString(input.description, "description"),
    createdAt: input.createdAt ?? new Date()
  };
}

export function createCanaryRolloutPlan(input: CreateCanaryRolloutPlanInput): CanaryRolloutPlan {
  if (!improvementTargetKinds.has(input.targetKind)) throw new Error("targetKind must be skill, harness, or instruction");
  if (input.status !== undefined && !canaryStatuses.has(input.status)) throw new Error("status must be draft, ready, running, paused, completed, or failed");
  validateCanaryStages(input.stages);
  const now = new Date();
  return {
    ...input,
    id: input.id ?? createId("canary_plan"),
    proposalId: requireString(input.proposalId, "proposalId"),
    targetId: requireString(input.targetId, "targetId"),
    status: input.status ?? "draft",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

export function createDraftRegistryChange(input: CreateDraftRegistryChangeInput): DraftRegistryChange {
  if (!improvementTargetKinds.has(input.targetKind)) throw new Error("targetKind must be skill, harness, or instruction");
  if (!draftRegistryChangeTypes.has(input.changeType)) throw new Error("changeType is invalid");
  if (input.status !== undefined && !draftRegistryChangeStatuses.has(input.status)) throw new Error("status must be draft, awaiting_review, rejected, or superseded");
  const now = new Date();
  return {
    ...input,
    id: input.id ?? createId("draft_registry_change"),
    proposalId: requireString(input.proposalId, "proposalId"),
    targetId: requireString(input.targetId, "targetId"),
    targetName: requireString(input.targetName, "targetName"),
    targetVersion: requireString(input.targetVersion, "targetVersion"),
    draftPayload: cloneRecord(input.draftPayload),
    status: input.status ?? "draft",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  };
}

export function createGovernanceDecision(input: CreateGovernanceDecisionInput): ProposalGovernanceDecision {
  if (!governanceDecisionTypes.has(input.decision)) throw new Error("decision is invalid");
  return {
    id: createId("proposal_decision"),
    proposalId: requireString(input.proposalId, "proposalId"),
    actorId: input.actorId ?? "mock-admin",
    decision: input.decision,
    reason: requireString(input.reason, "reason"),
    createdAt: input.createdAt ?? new Date()
  };
}

export function createProposalEvalRun(input: CreateProposalEvalRunInput): ProposalEvalRun {
  if (!proposalEvalRunStatuses.has(input.status)) throw new Error("status must be pending, passed, failed, or skipped");
  return {
    ...input,
    id: input.id ?? createId("proposal_eval_run"),
    proposalId: requireString(input.proposalId, "proposalId"),
    evalRequirementId: requireString(input.evalRequirementId, "evalRequirementId"),
    summary: requireString(input.summary, "summary"),
    attachedBy: input.attachedBy ?? "mock-admin",
    attachedAt: input.attachedAt ?? new Date(),
    metadata: input.metadata ? cloneRecord(input.metadata) : undefined
  };
}

function createGovernanceAuditEvent(input: Omit<ImprovementGovernanceAuditEvent, "id" | "createdAt"> & Partial<Pick<ImprovementGovernanceAuditEvent, "id" | "createdAt">>): ImprovementGovernanceAuditEvent {
  if (!governanceAuditActions.has(input.action)) throw new Error("governance audit action is invalid");
  const createdAt = input.createdAt ?? new Date();
  return {
    ...input,
    id: input.id ?? createGovernanceEventId(input.action, input.proposalId, createdAt),
    actorId: input.actorId,
    message: requireString(input.message, "message"),
    metadata: input.metadata ? cloneRecord(input.metadata) : undefined,
    createdAt
  };
}

function activeSafetyPolicy(repository: AutoImprovementSafetyPolicyRepository): AutoImprovementSafetyPolicy {
  const policy = repository.listSafetyPolicies().find((entry) => entry.enabled) ?? repository.listSafetyPolicies()[0];
  if (!policy) throw new Error("Auto-improvement safety policy not found");
  return policy;
}

function requiredEvalIdsForProposal(repository: EvalRequirementRepository, proposal: ImprovementProposal): string[] {
  return repository.listEvalRequirements()
    .filter((requirement) => requirement.blocking)
    .filter((requirement) => requirement.targetKind === proposal.targetKind)
    .filter((requirement) => requirement.targetId === undefined || requirement.targetId === proposal.targetId)
    .map((requirement) => requirement.id)
    .sort();
}

function latestDecisionForProposal(repository: ProposalGovernanceDecisionRepository, proposalId: string): ProposalGovernanceDecision | undefined {
  return repository.listProposalGovernanceDecisions(proposalId).at(-1);
}

function evalStatusForProposal(repository: ProposalEvalRunRepository, proposalId: string, requiredEvalIds: string[]): ProposalReadiness["evalStatus"] {
  if (requiredEvalIds.length === 0) return "not_required";
  const runs = repository.listProposalEvalRuns(proposalId)
    .filter((run) => requiredEvalIds.includes(run.evalRequirementId));
  if (runs.some((run) => run.status === "failed")) return "failed";
  if (requiredEvalIds.every((id) => runs.some((run) => run.evalRequirementId === id && run.status === "passed"))) return "passed";
  return "pending";
}

function canaryReadyForProposal(repository: CanaryRolloutPlanRepository, proposalId: string): boolean {
  return repository.listCanaryRolloutPlans().some((plan) => plan.proposalId === proposalId && plan.status === "ready");
}

function readinessStatusForProposal(proposal: ImprovementProposal, readiness: ProposalReadiness): ProposalReviewReadinessStatus {
  if (proposal.status === "rejected" || proposal.status === "archived" || proposal.status === "applied") return "closed";
  if (readiness.blockingReasons.length > 0) {
    if (readiness.blockingReasons.every((reason) => reason === "auto_apply_disabled" || reason === "active_apply_not_implemented")) {
      return "ready_for_review";
    }
    return "blocked";
  }
  if (proposal.status === "approved_for_canary") return "ready_for_canary";
  return "ready_for_review";
}

function recommendedActionForReadiness(readiness: ProposalReadiness): ProposalReviewRecommendedAction {
  if (readiness.blockingReasons.includes("eval_pass_required")) return "attach_eval_result";
  if (readiness.blockingReasons.includes("canary_required")) return "prepare_canary_plan";
  if (readiness.latestDecision === "approve" && readiness.requiredCanary) return "ready_for_canary_review";
  if (readiness.blockingReasons.length === 0 || readiness.blockingReasons.every((reason) => reason === "auto_apply_disabled" || reason === "active_apply_not_implemented")) {
    return "review_proposal";
  }
  return "no_action";
}

function evaluateReadinessSnapshot(repository: ImprovementRepository, proposal: ImprovementProposal): ProposalReadiness {
  const policy = activeSafetyPolicy(repository);
  const requiredEvalIds = requiredEvalIdsForProposal(repository, proposal);
  const latestDecision = latestDecisionForProposal(repository, proposal.id);
  const evalStatus = evalStatusForProposal(repository, proposal.id, requiredEvalIds);
  const canaryReady = canaryReadyForProposal(repository, proposal.id);
  const draftChange = repository.getDraftRegistryChangeForProposal(proposal.id);
  const blockingReasons = new Set<string>();

  if (policy.requireHumanApproval && latestDecision?.decision !== "approve") blockingReasons.add("human_approval_required");
  if (policy.requireEvalPassed && evalStatus !== "passed") blockingReasons.add("eval_pass_required");
  if (policy.requireCanary && !canaryReady) blockingReasons.add("canary_required");
  if (!policy.allowAutoApply) blockingReasons.add("auto_apply_disabled");
  if (!draftChange || draftChange.status === "rejected" || draftChange.status === "superseded") blockingReasons.add("draft_registry_change_required");
  if (proposal.status === "rejected" || proposal.status === "archived" || proposal.status === "applied") blockingReasons.add(`proposal_status_${proposal.status}`);

  return {
    proposalId: proposal.id,
    readyForReview: proposal.status === "draft" || proposal.status === "awaiting_review" || proposal.status === "eval_required",
    requiredEvalIds,
    requiredApproval: policy.requireHumanApproval,
    requiredCanary: policy.requireCanary,
    blockingReasons: [...blockingReasons],
    safetyPolicyId: policy.id,
    latestDecision: latestDecision?.decision,
    evalStatus,
    canaryReady,
    draftChangeStatus: draftChange?.status,
    evaluatedAt: new Date()
  };
}

function validateCanaryStages(stages: CanaryStage[]): void {
  if (!Array.isArray(stages) || stages.length === 0) {
    throw new Error("stages must include at least one canary stage");
  }
  for (const stage of stages) {
    requireString(stage.name, "stage.name");
    requireString(stage.scope, "stage.scope");
    requireStringArray(stage.successCriteria, "stage.successCriteria");
    requireStringArray(stage.rollbackCriteria, "stage.rollbackCriteria");
    if (stage.percentage !== undefined && (stage.percentage < 0 || stage.percentage > 100)) {
      throw new Error("stage.percentage must be between 0 and 100");
    }
  }
}

function mockImprovementSubject(actorId = "mock-admin") {
  const roles = actorId.includes("admin")
    ? ["registry_admin"]
    : actorId.includes("reviewer")
      ? ["registry_reviewer"]
      : actorId.startsWith("mock")
        ? ["system"]
        : [];
  return createPolicySubject({
    actorId,
    actorKind: actorId.startsWith("mock") ? "system" : "user",
    roles
  });
}

export class InMemoryImprovementRepository implements ImprovementRepository {
  private failureSignals: FailureSignal[];
  private failureClusters: FailureCluster[];
  private candidates: ImprovementCandidate[];
  private proposals: ImprovementProposal[];
  private evalRequirements: EvalRequirement[];
  private canaryRolloutPlans: CanaryRolloutPlan[];
  private safetyPolicies: AutoImprovementSafetyPolicy[];
  private analyses: AutoImprovementAnalysis[];
  private draftRegistryChanges: DraftRegistryChange[];
  private proposalReadiness: ProposalReadiness[];
  private governanceDecisions: ProposalGovernanceDecision[];
  private proposalEvalRuns: ProposalEvalRun[];
  private canaryReadiness: CanaryReadiness[];
  private proposalApplyGates: ProposalApplyGate[];
  private governanceAuditEvents: ImprovementGovernanceAuditEvent[];

  constructor(snapshot: ImprovementSnapshot = {}) {
    this.failureSignals = (snapshot.failureSignals ?? []).map(cloneFailureSignal);
    this.failureClusters = (snapshot.failureClusters ?? []).map(cloneFailureCluster);
    this.candidates = (snapshot.candidates ?? []).map(cloneCandidate);
    this.proposals = (snapshot.proposals ?? []).map(cloneProposal);
    this.evalRequirements = (snapshot.evalRequirements ?? []).map(cloneEvalRequirement);
    this.canaryRolloutPlans = (snapshot.canaryRolloutPlans ?? []).map(cloneCanaryPlan);
    this.safetyPolicies = (snapshot.safetyPolicies ?? [createDefaultSafetyPolicy()]).map(cloneSafetyPolicy);
    this.analyses = (snapshot.analyses ?? []).map(cloneAnalysis);
    this.draftRegistryChanges = (snapshot.draftRegistryChanges ?? []).map(cloneDraftRegistryChange);
    this.proposalReadiness = (snapshot.proposalReadiness ?? []).map(cloneProposalReadiness);
    this.governanceDecisions = (snapshot.governanceDecisions ?? []).map(cloneGovernanceDecision);
    this.proposalEvalRuns = (snapshot.proposalEvalRuns ?? []).map(cloneProposalEvalRun);
    this.canaryReadiness = (snapshot.canaryReadiness ?? []).map(cloneCanaryReadiness);
    this.proposalApplyGates = (snapshot.proposalApplyGates ?? []).map(cloneProposalApplyGate);
    this.governanceAuditEvents = (snapshot.governanceAuditEvents ?? []).map(cloneGovernanceAuditEvent);
  }

  createFailureSignal(input: FailureSignal): FailureSignal {
    const signal = cloneFailureSignal(input);
    this.failureSignals.push(signal);
    return cloneFailureSignal(signal);
  }

  listFailureSignals(): FailureSignal[] {
    return sortById(this.failureSignals).map(cloneFailureSignal);
  }

  getFailureSignal(id: string): FailureSignal | undefined {
    const signal = this.failureSignals.find((entry) => entry.id === id);
    return signal ? cloneFailureSignal(signal) : undefined;
  }

  upsertFailureCluster(input: FailureCluster): FailureCluster {
    const existingIndex = this.failureClusters.findIndex((entry) => entry.id === input.id);
    const cluster = cloneFailureCluster(input);
    if (existingIndex >= 0) {
      this.failureClusters[existingIndex] = cluster;
    } else {
      this.failureClusters.push(cluster);
    }
    return cloneFailureCluster(cluster);
  }

  listFailureClusters(): FailureCluster[] {
    return sortById(this.failureClusters).map(cloneFailureCluster);
  }

  getFailureCluster(id: string): FailureCluster | undefined {
    const cluster = this.failureClusters.find((entry) => entry.id === id);
    return cluster ? cloneFailureCluster(cluster) : undefined;
  }

  updateFailureCluster(id: string, patch: Partial<FailureCluster>): FailureCluster {
    const index = this.failureClusters.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error(`Failure cluster not found: ${id}`);
    const updated = { ...this.failureClusters[index], ...patch, id, updatedAt: new Date() };
    this.failureClusters[index] = cloneFailureCluster(updated);
    return cloneFailureCluster(updated);
  }

  createImprovementCandidate(input: ImprovementCandidate): ImprovementCandidate {
    const candidate = cloneCandidate(input);
    this.candidates.push(candidate);
    return cloneCandidate(candidate);
  }

  listImprovementCandidates(): ImprovementCandidate[] {
    return sortById(this.candidates).map(cloneCandidate);
  }

  getImprovementCandidate(id: string): ImprovementCandidate | undefined {
    const candidate = this.candidates.find((entry) => entry.id === id);
    return candidate ? cloneCandidate(candidate) : undefined;
  }

  updateImprovementCandidate(id: string, patch: Partial<ImprovementCandidate>): ImprovementCandidate {
    const index = this.candidates.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error(`Improvement candidate not found: ${id}`);
    const updated = { ...this.candidates[index], ...patch, id, updatedAt: new Date() };
    this.candidates[index] = cloneCandidate(updated);
    return cloneCandidate(updated);
  }

  createImprovementProposal(input: ImprovementProposal): ImprovementProposal {
    const proposal = cloneProposal(input);
    this.proposals.push(proposal);
    return cloneProposal(proposal);
  }

  listImprovementProposals(): ImprovementProposal[] {
    return sortById(this.proposals).map(cloneProposal);
  }

  getImprovementProposal(id: string): ImprovementProposal | undefined {
    const proposal = this.proposals.find((entry) => entry.id === id);
    return proposal ? cloneProposal(proposal) : undefined;
  }

  updateImprovementProposal(id: string, patch: Partial<ImprovementProposal>): ImprovementProposal {
    const index = this.proposals.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error(`Improvement proposal not found: ${id}`);
    const updated = { ...this.proposals[index], ...patch, id, updatedAt: new Date() };
    this.proposals[index] = cloneProposal(updated);
    return cloneProposal(updated);
  }

  createEvalRequirement(input: EvalRequirement): EvalRequirement {
    const requirement = cloneEvalRequirement(input);
    this.evalRequirements.push(requirement);
    return cloneEvalRequirement(requirement);
  }

  listEvalRequirements(): EvalRequirement[] {
    return sortById(this.evalRequirements).map(cloneEvalRequirement);
  }

  getEvalRequirement(id: string): EvalRequirement | undefined {
    const requirement = this.evalRequirements.find((entry) => entry.id === id);
    return requirement ? cloneEvalRequirement(requirement) : undefined;
  }

  createCanaryRolloutPlan(input: CanaryRolloutPlan): CanaryRolloutPlan {
    const plan = cloneCanaryPlan(input);
    this.canaryRolloutPlans.push(plan);
    return cloneCanaryPlan(plan);
  }

  listCanaryRolloutPlans(): CanaryRolloutPlan[] {
    return sortById(this.canaryRolloutPlans).map(cloneCanaryPlan);
  }

  getCanaryRolloutPlan(id: string): CanaryRolloutPlan | undefined {
    const plan = this.canaryRolloutPlans.find((entry) => entry.id === id);
    return plan ? cloneCanaryPlan(plan) : undefined;
  }

  listSafetyPolicies(): AutoImprovementSafetyPolicy[] {
    return sortById(this.safetyPolicies).map(cloneSafetyPolicy);
  }

  getSafetyPolicy(id: string): AutoImprovementSafetyPolicy | undefined {
    const policy = this.safetyPolicies.find((entry) => entry.id === id);
    return policy ? cloneSafetyPolicy(policy) : undefined;
  }

  upsertSafetyPolicy(input: AutoImprovementSafetyPolicy): AutoImprovementSafetyPolicy {
    const index = this.safetyPolicies.findIndex((entry) => entry.id === input.id);
    const policy = cloneSafetyPolicy(input);
    if (index >= 0) {
      this.safetyPolicies[index] = policy;
    } else {
      this.safetyPolicies.push(policy);
    }
    return cloneSafetyPolicy(policy);
  }

  updateSafetyPolicy(id: string, patch: Partial<AutoImprovementSafetyPolicy>): AutoImprovementSafetyPolicy {
    const index = this.safetyPolicies.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error(`Auto-improvement safety policy not found: ${id}`);
    const updated = { ...this.safetyPolicies[index], ...patch, id, updatedAt: new Date() };
    this.safetyPolicies[index] = cloneSafetyPolicy(updated);
    return cloneSafetyPolicy(updated);
  }

  createAutoImprovementAnalysis(input: AutoImprovementAnalysis): AutoImprovementAnalysis {
    const existingIndex = this.analyses.findIndex((entry) => entry.id === input.id);
    const analysis = cloneAnalysis(input);
    if (existingIndex >= 0) {
      this.analyses[existingIndex] = analysis;
    } else {
      this.analyses.push(analysis);
    }
    return cloneAnalysis(analysis);
  }

  listAutoImprovementAnalyses(): AutoImprovementAnalysis[] {
    return sortById(this.analyses).map(cloneAnalysis);
  }

  getAutoImprovementAnalysis(id: string): AutoImprovementAnalysis | undefined {
    const analysis = this.analyses.find((entry) => entry.id === id);
    return analysis ? cloneAnalysis(analysis) : undefined;
  }

  getAutoImprovementAnalysisForCluster(clusterId: string): AutoImprovementAnalysis | undefined {
    const analysis = this.analyses.find((entry) => entry.clusterId === clusterId);
    return analysis ? cloneAnalysis(analysis) : undefined;
  }

  createDraftRegistryChange(input: DraftRegistryChange): DraftRegistryChange {
    const existingIndex = this.draftRegistryChanges.findIndex((entry) => entry.id === input.id);
    const change = cloneDraftRegistryChange(input);
    if (existingIndex >= 0) {
      this.draftRegistryChanges[existingIndex] = change;
    } else {
      this.draftRegistryChanges.push(change);
    }
    return cloneDraftRegistryChange(change);
  }

  listDraftRegistryChanges(): DraftRegistryChange[] {
    return sortById(this.draftRegistryChanges).map(cloneDraftRegistryChange);
  }

  getDraftRegistryChange(id: string): DraftRegistryChange | undefined {
    const change = this.draftRegistryChanges.find((entry) => entry.id === id);
    return change ? cloneDraftRegistryChange(change) : undefined;
  }

  getDraftRegistryChangeForProposal(proposalId: string): DraftRegistryChange | undefined {
    const change = this.draftRegistryChanges.find((entry) => entry.proposalId === proposalId);
    return change ? cloneDraftRegistryChange(change) : undefined;
  }

  updateDraftRegistryChange(id: string, patch: Partial<DraftRegistryChange>): DraftRegistryChange {
    const index = this.draftRegistryChanges.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error(`Draft registry change not found: ${id}`);
    const updated = { ...this.draftRegistryChanges[index], ...patch, id, updatedAt: new Date() };
    this.draftRegistryChanges[index] = cloneDraftRegistryChange(updated);
    return cloneDraftRegistryChange(updated);
  }

  upsertProposalReadiness(input: ProposalReadiness): ProposalReadiness {
    const existingIndex = this.proposalReadiness.findIndex((entry) => entry.proposalId === input.proposalId);
    const readiness = cloneProposalReadiness(input);
    if (existingIndex >= 0) {
      this.proposalReadiness[existingIndex] = readiness;
    } else {
      this.proposalReadiness.push(readiness);
    }
    return cloneProposalReadiness(readiness);
  }

  listProposalReadiness(): ProposalReadiness[] {
    return [...this.proposalReadiness]
      .sort((left, right) => left.proposalId.localeCompare(right.proposalId))
      .map(cloneProposalReadiness);
  }

  getProposalReadiness(proposalId: string): ProposalReadiness | undefined {
    const readiness = this.proposalReadiness.find((entry) => entry.proposalId === proposalId);
    return readiness ? cloneProposalReadiness(readiness) : undefined;
  }

  createProposalGovernanceDecision(input: ProposalGovernanceDecision): ProposalGovernanceDecision {
    const decision = cloneGovernanceDecision(input);
    this.governanceDecisions.push(decision);
    return cloneGovernanceDecision(decision);
  }

  listProposalGovernanceDecisions(proposalId?: string): ProposalGovernanceDecision[] {
    return this.governanceDecisions
      .filter((decision) => proposalId === undefined || decision.proposalId === proposalId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(cloneGovernanceDecision);
  }

  createProposalEvalRun(input: ProposalEvalRun): ProposalEvalRun {
    const run = cloneProposalEvalRun(input);
    this.proposalEvalRuns.push(run);
    return cloneProposalEvalRun(run);
  }

  listProposalEvalRuns(proposalId?: string): ProposalEvalRun[] {
    return this.proposalEvalRuns
      .filter((run) => proposalId === undefined || run.proposalId === proposalId)
      .sort((left, right) => left.attachedAt.getTime() - right.attachedAt.getTime() || left.id.localeCompare(right.id))
      .map(cloneProposalEvalRun);
  }

  upsertCanaryReadiness(input: CanaryReadiness): CanaryReadiness {
    const existingIndex = this.canaryReadiness.findIndex((entry) => entry.proposalId === input.proposalId);
    const readiness = cloneCanaryReadiness(input);
    if (existingIndex >= 0) {
      this.canaryReadiness[existingIndex] = readiness;
    } else {
      this.canaryReadiness.push(readiness);
    }
    return cloneCanaryReadiness(readiness);
  }

  getCanaryReadiness(proposalId: string): CanaryReadiness | undefined {
    const readiness = this.canaryReadiness.find((entry) => entry.proposalId === proposalId);
    return readiness ? cloneCanaryReadiness(readiness) : undefined;
  }

  listCanaryReadiness(): CanaryReadiness[] {
    return [...this.canaryReadiness]
      .sort((left, right) => left.proposalId.localeCompare(right.proposalId))
      .map(cloneCanaryReadiness);
  }

  upsertProposalApplyGate(input: ProposalApplyGate): ProposalApplyGate {
    const existingIndex = this.proposalApplyGates.findIndex((entry) => entry.proposalId === input.proposalId);
    const gate = cloneProposalApplyGate(input);
    if (existingIndex >= 0) {
      this.proposalApplyGates[existingIndex] = gate;
    } else {
      this.proposalApplyGates.push(gate);
    }
    return cloneProposalApplyGate(gate);
  }

  getProposalApplyGate(proposalId: string): ProposalApplyGate | undefined {
    const gate = this.proposalApplyGates.find((entry) => entry.proposalId === proposalId);
    return gate ? cloneProposalApplyGate(gate) : undefined;
  }

  listProposalApplyGates(): ProposalApplyGate[] {
    return [...this.proposalApplyGates]
      .sort((left, right) => left.proposalId.localeCompare(right.proposalId))
      .map(cloneProposalApplyGate);
  }

  appendImprovementGovernanceAuditEvent(input: ImprovementGovernanceAuditEvent): ImprovementGovernanceAuditEvent {
    const event = cloneGovernanceAuditEvent(input);
    this.governanceAuditEvents.push(event);
    return cloneGovernanceAuditEvent(event);
  }

  listImprovementGovernanceAuditEvents(proposalId?: string): ImprovementGovernanceAuditEvent[] {
    return this.governanceAuditEvents
      .filter((event) => proposalId === undefined || event.proposalId === proposalId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(cloneGovernanceAuditEvent);
  }
}

export class FailureSignalService {
  private readonly repository: FailureSignalRepository;

  constructor(repository: FailureSignalRepository) {
    this.repository = repository;
  }

  createSignal(input: CreateFailureSignalInput): FailureSignal {
    return this.repository.createFailureSignal(createFailureSignal(input));
  }

  listSignals(): FailureSignal[] {
    return this.repository.listFailureSignals();
  }
}

export class FailureClusteringService {
  private readonly repository: FailureSignalRepository & FailureClusterRepository;

  constructor(repository: FailureSignalRepository & FailureClusterRepository) {
    this.repository = repository;
  }

  listClusters(): FailureCluster[] {
    return this.repository.listFailureClusters();
  }

  recomputeClusters(): FailureCluster[] {
    const groups = new Map<string, FailureSignal[]>();
    for (const signal of this.repository.listFailureSignals()) {
      const key = `${signal.category}|${signal.targetKind}|${signal.targetRef ?? ""}`;
      groups.set(key, [...(groups.get(key) ?? []), signal]);
    }

    const clusters: FailureCluster[] = [];
    for (const signals of [...groups.values()].sort((left, right) => {
      const leftKey = `${left[0]?.category}|${left[0]?.targetKind}|${left[0]?.targetRef ?? ""}`;
      const rightKey = `${right[0]?.category}|${right[0]?.targetKind}|${right[0]?.targetRef ?? ""}`;
      return leftKey.localeCompare(rightKey);
    })) {
      const first = signals[0];
      if (!first) continue;
      const id = stableClusterId(first.category, first.targetKind, first.targetRef);
      const existing = this.repository.getFailureCluster(id);
      const now = new Date();
      const cluster: FailureCluster = {
        id,
        title: `${first.category} affecting ${first.targetRef ?? first.targetKind}`,
        category: first.category,
        targetKind: first.targetKind,
        targetRef: first.targetRef,
        signalIds: signals.map((signal) => signal.id).sort(),
        severity: highestSeverity(signals),
        status: existing?.status ?? "open",
        summary: `${signals.length} signal(s) grouped by ${first.category}, ${first.targetKind}, and ${first.targetRef ?? "no target ref"}.`,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      };
      clusters.push(this.repository.upsertFailureCluster(cluster));
    }
    return clusters;
  }
}

export class ImprovementCandidateService {
  private readonly repository: ImprovementCandidateRepository & FailureClusterRepository;

  constructor(repository: ImprovementCandidateRepository & FailureClusterRepository) {
    this.repository = repository;
  }

  listCandidates(): ImprovementCandidate[] {
    return this.repository.listImprovementCandidates();
  }

  createCandidateFromCluster(input: CreateImprovementCandidateInput): ImprovementCandidate {
    const cluster = this.repository.getFailureCluster(input.sourceClusterId);
    if (!cluster) throw new Error(`Failure cluster not found: ${input.sourceClusterId}`);
    const targetKind = input.targetKind ?? (isImprovementTargetKind(cluster.targetKind) ? cluster.targetKind : "skill");
    if (!improvementTargetKinds.has(targetKind)) throw new Error("targetKind must be skill, harness, or instruction");
    const target = parseTargetRef(cluster.targetRef, targetKind);
    const candidateType = input.candidateType ?? defaultCandidateType(targetKind);
    if (!candidateTypes.has(candidateType)) throw new Error("candidateType is invalid");
    const priority = input.priority ?? (cluster.severity === "critical" || cluster.severity === "high" ? "high" : cluster.severity === "medium" ? "medium" : "low");
    if (!priorities.has(priority)) throw new Error("priority must be low, medium, or high");
    const now = new Date();
    return this.repository.createImprovementCandidate({
      id: createId("improvement_candidate"),
      sourceClusterId: cluster.id,
      targetKind,
      targetId: input.targetId ?? target.id,
      targetName: input.targetName ?? target.name,
      targetVersion: input.targetVersion ?? target.version,
      candidateType,
      priority,
      summary: input.summary ?? `Review ${targetKind} ${target.name}@${target.version} for ${cluster.category}.`,
      evidence: input.evidence ?? [cluster.summary, ...cluster.signalIds],
      status: "new",
      createdAt: now,
      updatedAt: now
    });
  }

  triageCandidate(input: TriageImprovementCandidateInput): ImprovementCandidate {
    if (!candidateStatuses.has(input.status)) throw new Error("status must be new, triaged, proposal_requested, proposal_created, or dismissed");
    return this.repository.updateImprovementCandidate(input.id, { status: input.status });
  }

  isCandidateProposable(candidate: ImprovementCandidate): boolean {
    return candidate.status !== "dismissed";
  }
}

export class ImprovementProposalService {
  private readonly repository: ImprovementProposalRepository & ImprovementCandidateRepository;

  constructor(repository: ImprovementProposalRepository & ImprovementCandidateRepository) {
    this.repository = repository;
  }

  listProposals(): ImprovementProposal[] {
    return this.repository.listImprovementProposals();
  }

  createDraftProposal(input: CreateImprovementProposalInput): ImprovementProposal {
    const candidate = this.repository.getImprovementCandidate(input.candidateId);
    if (!candidate) throw new Error(`Improvement candidate not found: ${input.candidateId}`);
    if (candidate.status === "dismissed") throw new Error("Dismissed candidates cannot create proposals");
    const proposedChangeType = input.proposedChangeType ?? defaultChangeType(candidate.candidateType);
    if (!proposalChangeTypes.has(proposedChangeType)) throw new Error("proposedChangeType is invalid");
    const now = new Date();
    const proposal = this.repository.createImprovementProposal({
      id: createId("improvement_proposal"),
      candidateId: candidate.id,
      targetKind: candidate.targetKind,
      targetId: candidate.targetId,
      targetName: candidate.targetName,
      targetVersion: candidate.targetVersion,
      proposedChangeType,
      proposedPatch: input.proposedPatch ? cloneRecord(input.proposedPatch) : undefined,
      proposedSummary: input.proposedSummary ?? `Draft-only ${proposedChangeType} proposal for ${candidate.targetName}@${candidate.targetVersion}.`,
      rationale: input.rationale ?? candidate.summary,
      safetyNotes: input.safetyNotes ?? [
        "Phase 4 Preparation stores proposal metadata only.",
        "No registry entry is mutated or activated by this proposal."
      ],
      status: "draft",
      createdBy: input.createdBy ?? "mock-admin",
      createdAt: now,
      updatedAt: now
    });
    this.repository.updateImprovementCandidate(candidate.id, { status: "proposal_created" });
    return proposal;
  }

  transitionProposalStatus(input: TransitionImprovementProposalInput): ImprovementProposal {
    if (!proposalStatuses.has(input.status)) throw new Error("status is invalid");
    if (input.status === "applied") {
      throw new Error("Applying proposals is out of scope for Phase 4 Preparation");
    }
    const proposal = this.repository.getImprovementProposal(input.id);
    if (!proposal) throw new Error(`Improvement proposal not found: ${input.id}`);
    if (!proposalTransitions[proposal.status].includes(input.status)) {
      throw new Error(`Invalid proposal status transition: ${proposal.status} -> ${input.status}`);
    }
    return this.repository.updateImprovementProposal(input.id, { status: input.status });
  }
}

export class EvalRequirementService {
  private readonly repository: EvalRequirementRepository;

  constructor(repository: EvalRequirementRepository) {
    this.repository = repository;
  }

  createRequirement(input: CreateEvalRequirementInput): EvalRequirement {
    return this.repository.createEvalRequirement(createEvalRequirement(input));
  }

  listRequirements(): EvalRequirement[] {
    return this.repository.listEvalRequirements();
  }
}

export class CanaryRolloutPlanService {
  private readonly repository: CanaryRolloutPlanRepository;

  constructor(repository: CanaryRolloutPlanRepository) {
    this.repository = repository;
  }

  createPlan(input: CreateCanaryRolloutPlanInput): CanaryRolloutPlan {
    return this.repository.createCanaryRolloutPlan(createCanaryRolloutPlan(input));
  }

  listPlans(): CanaryRolloutPlan[] {
    return this.repository.listCanaryRolloutPlans();
  }
}

export class AutoImprovementSafetyPolicyService {
  private readonly repository: AutoImprovementSafetyPolicyRepository;

  constructor(repository: AutoImprovementSafetyPolicyRepository) {
    this.repository = repository;
  }

  listPolicies(): AutoImprovementSafetyPolicy[] {
    return this.repository.listSafetyPolicies();
  }

  updatePolicy(id: string, input: UpdateSafetyPolicyInput): AutoImprovementSafetyPolicy {
    if (input.allowAutoApply === true) {
      throw new Error("Auto-apply is disabled during Phase 4 Preparation");
    }
    if (input.allowedTargetKinds !== undefined && input.allowedTargetKinds.some((kind) => !improvementTargetKinds.has(kind))) {
      throw new Error("allowedTargetKinds must contain only skill, harness, or instruction");
    }
    if (input.maxChangesPerProposal !== undefined && input.maxChangesPerProposal < 1) {
      throw new Error("maxChangesPerProposal must be at least 1");
    }
    return this.repository.updateSafetyPolicy(id, input);
  }
}

export class DraftRegistryChangeService {
  private readonly repository: DraftRegistryChangeRepository;

  constructor(repository: DraftRegistryChangeRepository) {
    this.repository = repository;
  }

  listDraftChanges(): DraftRegistryChange[] {
    return this.repository.listDraftRegistryChanges();
  }

  getDraftChange(id: string): DraftRegistryChange | undefined {
    return this.repository.getDraftRegistryChange(id);
  }

  createDraftChange(input: CreateDraftRegistryChangeInput): DraftRegistryChange {
    return this.repository.createDraftRegistryChange(createDraftRegistryChange(input));
  }

  transitionDraftChange(input: TransitionDraftRegistryChangeInput): DraftRegistryChange {
    if (!draftRegistryChangeStatuses.has(input.status)) throw new Error("status must be draft, awaiting_review, rejected, or superseded");
    const change = this.repository.getDraftRegistryChange(input.id);
    if (!change) throw new Error(`Draft registry change not found: ${input.id}`);
    if (!draftRegistryChangeTransitions[change.status].includes(input.status)) {
      throw new Error(`Invalid draft registry change status transition: ${change.status} -> ${input.status}`);
    }
    return this.repository.updateDraftRegistryChange(input.id, { status: input.status });
  }
}

export class ProposalReadinessService {
  private readonly repository: ProposalReadinessRepository;

  constructor(repository: ProposalReadinessRepository) {
    this.repository = repository;
  }

  listReadiness(): ProposalReadiness[] {
    return this.repository.listProposalReadiness();
  }

  getReadiness(proposalId: string): ProposalReadiness | undefined {
    return this.repository.getProposalReadiness(proposalId);
  }
}

export class ProposalGovernanceService {
  private readonly repository: ImprovementRepository;
  private readonly policyService: PolicyService;

  constructor(repository: ImprovementRepository, input: ImprovementPolicyInput = {}) {
    this.repository = repository;
    this.policyService = input.policyService ?? new PolicyService();
  }

  listReviewQueue(filter: ProposalReviewQueueFilter = {}): ProposalReviewQueueItem[] {
    return this.repository.listImprovementProposals()
      .filter((proposal) => filter.includeArchived === true || (proposal.status !== "rejected" && proposal.status !== "archived" && proposal.status !== "applied"))
      .filter((proposal) => proposal.status === "draft" || proposal.status === "awaiting_review" || proposal.status === "eval_required" || filter.includeArchived === true)
      .filter((proposal) => filter.status === undefined || proposal.status === filter.status)
      .filter((proposal) => filter.targetKind === undefined || proposal.targetKind === filter.targetKind)
      .map((proposal) => this.queueItemForProposal(proposal))
      .filter((item) => filter.recommendedAction === undefined || item.recommendedAction === filter.recommendedAction)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.proposalId.localeCompare(right.proposalId))
      .map(cloneProposalReviewQueueItem);
  }

  recordDecision(input: CreateGovernanceDecisionInput): ProposalGovernanceDecision {
    const proposal = this.requireProposal(input.proposalId);
    if (input.decision === "approve") {
      const policyDecision = this.policyService.evaluate({
        subject: mockImprovementSubject(input.actorId),
        action: "improvement.proposal.approve",
        resource: createPolicyResource({
          resourceKind: "improvement_proposal",
          resourceId: proposal.id,
          metadata: { status: proposal.status, targetKind: proposal.targetKind }
        }),
        context: createPolicyContext({
          metadata: {
            source: "improvement_governance",
            decision: input.decision
          }
        })
      });
      if (!policyDecision.allowed) throw new Error(policyDecision.reason);
    }
    const decision = this.repository.createProposalGovernanceDecision(createGovernanceDecision(input));
    const nextStatus = this.statusForDecision(proposal, decision.decision);
    if (nextStatus !== proposal.status) {
      this.repository.updateImprovementProposal(proposal.id, { status: nextStatus });
    }
    this.appendAudit("proposal_decision_recorded", proposal.id, decision.actorId, `Recorded ${decision.decision} decision for ${proposal.id}.`, {
      decision: decision.decision
    });
    if (decision.decision === "approve") {
      this.appendAudit("proposal_approved", proposal.id, decision.actorId, `Approved proposal ${proposal.id} for the next governance gate.`);
    }
    if (decision.decision === "reject") {
      this.appendAudit("proposal_rejected", proposal.id, decision.actorId, `Rejected proposal ${proposal.id}.`);
    }
    if (decision.decision === "request_changes") {
      this.appendAudit("proposal_changes_requested", proposal.id, decision.actorId, `Requested changes for proposal ${proposal.id}.`);
    }
    return decision;
  }

  listDecisions(proposalId: string): ProposalGovernanceDecision[] {
    this.requireProposal(proposalId);
    return this.repository.listProposalGovernanceDecisions(proposalId);
  }

  listAuditEvents(proposalId?: string): ImprovementGovernanceAuditEvent[] {
    return this.repository.listImprovementGovernanceAuditEvents(proposalId);
  }

  private queueItemForProposal(proposal: ImprovementProposal): ProposalReviewQueueItem {
    const readiness = evaluateReadinessSnapshot(this.repository, proposal);
    const latestDecision = latestDecisionForProposal(this.repository, proposal.id);
    return {
      id: stableReviewQueueItemId(proposal.id),
      proposalId: proposal.id,
      candidateId: proposal.candidateId,
      targetKind: proposal.targetKind,
      targetId: proposal.targetId,
      targetName: proposal.targetName,
      targetVersion: proposal.targetVersion,
      proposedChangeType: proposal.proposedChangeType,
      proposalStatus: proposal.status,
      readinessStatus: readinessStatusForProposal(proposal, readiness),
      blockingReasons: readiness.blockingReasons,
      requiredEvalIds: readiness.requiredEvalIds,
      requiredApproval: readiness.requiredApproval,
      requiredCanary: readiness.requiredCanary,
      latestDecision: latestDecision?.decision,
      recommendedAction: recommendedActionForReadiness(readiness),
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt
    };
  }

  private statusForDecision(proposal: ImprovementProposal, decision: ProposalGovernanceDecisionType): ImprovementProposalStatus {
    if (decision === "reject") return "rejected";
    if (decision === "request_changes") return "draft";
    if (decision === "mark_eval_required") return "eval_required";
    if (decision === "mark_canary_required") return "approved_for_canary";
    if (decision === "archive") return "archived";
    if (decision === "approve") {
      const readiness = evaluateReadinessSnapshot(this.repository, proposal);
      if (readiness.evalStatus !== "not_required" && readiness.evalStatus !== "passed") return "eval_required";
      return readiness.requiredCanary ? "approved_for_canary" : "awaiting_review";
    }
    return proposal.status;
  }

  private appendAudit(action: ImprovementGovernanceAuditAction, proposalId: string, actorId: string, message: string, metadata?: Record<string, unknown>): void {
    this.repository.appendImprovementGovernanceAuditEvent(createGovernanceAuditEvent({
      action,
      proposalId,
      actorId,
      message,
      metadata
    }));
  }

  private requireProposal(proposalId: string): ImprovementProposal {
    const proposal = this.repository.getImprovementProposal(proposalId);
    if (!proposal) throw new Error(`Improvement proposal not found: ${proposalId}`);
    return proposal;
  }
}

export class ProposalEvalRunService {
  private readonly repository: ImprovementRepository;

  constructor(repository: ImprovementRepository) {
    this.repository = repository;
  }

  attachEvalRun(input: CreateProposalEvalRunInput): ProposalEvalRun {
    const proposal = this.repository.getImprovementProposal(input.proposalId);
    if (!proposal) throw new Error(`Improvement proposal not found: ${input.proposalId}`);
    const requirement = this.repository.getEvalRequirement(input.evalRequirementId);
    if (!requirement) throw new Error(`Eval requirement not found: ${input.evalRequirementId}`);
    if (requirement.targetKind !== proposal.targetKind || (requirement.targetId !== undefined && requirement.targetId !== proposal.targetId)) {
      throw new Error("Eval requirement does not apply to proposal target");
    }
    const run = this.repository.createProposalEvalRun(createProposalEvalRun(input));
    this.repository.appendImprovementGovernanceAuditEvent(createGovernanceAuditEvent({
      action: "proposal_eval_attached",
      proposalId: proposal.id,
      actorId: run.attachedBy,
      message: `Attached ${run.status} eval run ${run.id} to proposal ${proposal.id}.`,
      metadata: { evalRequirementId: run.evalRequirementId, status: run.status }
    }));
    return run;
  }

  listEvalRuns(proposalId: string): ProposalEvalRun[] {
    const proposal = this.repository.getImprovementProposal(proposalId);
    if (!proposal) throw new Error(`Improvement proposal not found: ${proposalId}`);
    return this.repository.listProposalEvalRuns(proposalId);
  }
}

export class CanaryReadinessService {
  private readonly repository: ImprovementRepository;

  constructor(repository: ImprovementRepository) {
    this.repository = repository;
  }

  evaluate(proposalId: string): CanaryReadiness {
    const proposal = this.repository.getImprovementProposal(proposalId);
    if (!proposal) throw new Error(`Improvement proposal not found: ${proposalId}`);
    const policy = activeSafetyPolicy(this.repository);
    const ready = !policy.requireCanary || canaryReadyForProposal(this.repository, proposal.id);
    const readiness: CanaryReadiness = {
      proposalId: proposal.id,
      required: policy.requireCanary,
      ready,
      blockingReasons: policy.requireCanary && !ready ? ["canary_required"] : [],
      evaluatedAt: new Date()
    };
    const result = this.repository.upsertCanaryReadiness(readiness);
    this.repository.appendImprovementGovernanceAuditEvent(createGovernanceAuditEvent({
      action: "proposal_canary_readiness_checked",
      proposalId: proposal.id,
      actorId: "mock-admin",
      message: `Checked canary readiness for proposal ${proposal.id}.`,
      metadata: { ready: result.ready, required: result.required }
    }));
    return result;
  }
}

export class ProposalApplyGateService {
  private readonly repository: ImprovementRepository;
  private readonly policyService: PolicyService;

  constructor(repository: ImprovementRepository, input: ImprovementPolicyInput = {}) {
    this.repository = repository;
    this.policyService = input.policyService ?? new PolicyService();
  }

  evaluate(proposalId: string): ProposalApplyGate {
    const proposal = this.repository.getImprovementProposal(proposalId);
    if (!proposal) throw new Error(`Improvement proposal not found: ${proposalId}`);
    const policy = activeSafetyPolicy(this.repository);
    const readiness = evaluateReadinessSnapshot(this.repository, proposal);
    const blockingReasons = new Set<string>(["active_apply_not_implemented"]);
    const policyDecision = this.policyService.evaluate({
      subject: mockImprovementSubject("mock-admin"),
      action: "improvement.apply",
      resource: createPolicyResource({
        resourceKind: "draft_registry_change",
        resourceId: this.repository.getDraftRegistryChangeForProposal(proposal.id)?.id,
        metadata: {
          proposalId: proposal.id,
          targetKind: proposal.targetKind
        }
      }),
      context: createPolicyContext({
        metadata: {
          source: "proposal_apply_gate"
        }
      })
    });
    if (!policyDecision.allowed) blockingReasons.add("policy_denied_improvement_apply");
    for (const reason of readiness.blockingReasons) blockingReasons.add(reason);
    const gate: ProposalApplyGate = {
      proposalId: proposal.id,
      canApply: false,
      blockingReasons: [...blockingReasons].sort(),
      requiredApproval: policy.requireHumanApproval,
      requiredEvalPassed: policy.requireEvalPassed,
      requiredCanaryReady: policy.requireCanary,
      safetyPolicyId: policy.id,
      evaluatedAt: new Date()
    };
    const result = this.repository.upsertProposalApplyGate(gate);
    this.repository.appendImprovementGovernanceAuditEvent(createGovernanceAuditEvent({
      action: "proposal_apply_gate_checked",
      proposalId: proposal.id,
      actorId: "mock-admin",
      message: `Checked apply gate for proposal ${proposal.id}.`,
      metadata: { canApply: result.canApply, blockingReasons: result.blockingReasons, policyDecisionId: policyDecision.id }
    }));
    if (!result.canApply) {
      this.repository.appendImprovementGovernanceAuditEvent(createGovernanceAuditEvent({
        action: "proposal_apply_blocked",
        proposalId: proposal.id,
        actorId: "mock-admin",
        message: `Blocked apply for proposal ${proposal.id}; apply is not implemented in Governance v1.`,
        metadata: { blockingReasons: result.blockingReasons }
      }));
    }
    return result;
  }

  blockApplyAttempt(proposalId: string): ProposalApplyGate {
    return this.evaluate(proposalId);
  }
}

export class MockAutoImprovementEngine implements AutoImprovementEngine {
  private readonly repository: ImprovementRepository;
  private readonly policyService: PolicyService;

  constructor(repository: ImprovementRepository, input: ImprovementPolicyInput = {}) {
    this.repository = repository;
    this.policyService = input.policyService ?? new PolicyService();
  }

  analyzeFailureCluster(clusterId: string): AutoImprovementAnalysis {
    const existing = this.repository.getAutoImprovementAnalysisForCluster(clusterId);
    if (existing) return existing;
    const cluster = this.requireCluster(clusterId);
    const signals = cluster.signalIds
      .map((id) => this.repository.getFailureSignal(id))
      .filter((signal): signal is FailureSignal => signal !== undefined);
    const targetKind = targetKindForCluster(cluster);
    const targetRef = targetRefForCluster(cluster, targetKind);
    const recommendedCandidateType = candidateTypeForCluster(cluster, targetKind);
    const evidence = [
      cluster.summary,
      ...signals.map((signal) => `${signal.severity}:${signal.category}:${signal.summary}`)
    ];
    return this.repository.createAutoImprovementAnalysis({
      id: stableAnalysisId(cluster.id),
      clusterId: cluster.id,
      summary: `Deterministic mock analysis recommends ${recommendedCandidateType} for ${targetRef ?? targetKind}.`,
      targetKind,
      targetRef,
      evidence,
      recommendedCandidateType,
      confidence: signals.length > 1 || cluster.severity === "high" || cluster.severity === "critical" ? 0.82 : 0.64,
      createdAt: new Date()
    });
  }

  generateImprovementCandidate(clusterId: string): ImprovementCandidate {
    const analysis = this.analyzeFailureCluster(clusterId);
    const target = parseTargetRef(analysis.targetRef, analysis.targetKind);
    const id = stableCandidateId(clusterId, analysis.recommendedCandidateType);
    const existing = this.repository.getImprovementCandidate(id);
    if (existing) return existing;
    return this.repository.createImprovementCandidate({
      id,
      sourceClusterId: clusterId,
      targetKind: analysis.targetKind,
      targetId: target.id,
      targetName: target.name,
      targetVersion: target.version,
      candidateType: analysis.recommendedCandidateType,
      priority: analysis.confidence >= 0.8 ? "high" : "medium",
      summary: `Mock candidate for ${target.name}@${target.version}: ${analysis.summary}`,
      evidence: analysis.evidence,
      status: "new",
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  generateImprovementProposal(candidateId: string): ImprovementProposal {
    const candidate = this.repository.getImprovementCandidate(candidateId);
    if (!candidate) throw new Error(`Improvement candidate not found: ${candidateId}`);
    if (candidate.status === "dismissed") throw new Error("Dismissed candidates cannot create proposals");
    const id = stableProposalId(candidate.id);
    const existing = this.repository.getImprovementProposal(id);
    if (existing) return existing;
    const cluster = this.repository.getFailureCluster(candidate.sourceClusterId);
    const proposedChangeType = proposalChangeTypeForCandidate(candidate, cluster);
    const proposal = this.repository.createImprovementProposal({
      id,
      candidateId: candidate.id,
      targetKind: candidate.targetKind,
      targetId: candidate.targetId,
      targetName: candidate.targetName,
      targetVersion: candidate.targetVersion,
      proposedChangeType,
      proposedPatch: {
        draftOnly: true,
        category: cluster?.category ?? "unknown",
        target: `${candidate.targetName}@${candidate.targetVersion}`,
        suggestedVersion: proposedChangeType === "new_version" ? bumpPatchVersion(candidate.targetVersion) : undefined
      },
      proposedSummary: `Draft-only mock ${proposedChangeType} proposal for ${candidate.targetName}@${candidate.targetVersion}.`,
      rationale: candidate.summary,
      safetyNotes: [
        "MockAutoImprovementEngine does not call LLMs or external services.",
        "This proposal does not mutate or activate registry entries.",
        "Future approval, eval, and canary gates must be satisfied separately."
      ],
      status: "draft",
      createdBy: "mock-auto-improvement-engine",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    this.repository.updateImprovementCandidate(candidate.id, { status: "proposal_created" });
    if (cluster) this.repository.updateFailureCluster(cluster.id, { status: "proposal_created" });
    return proposal;
  }

  prepareDraftRegistryChange(proposalId: string): DraftRegistryChange {
    const proposal = this.requireProposal(proposalId);
    const existing = this.repository.getDraftRegistryChangeForProposal(proposal.id);
    if (existing) return existing;
    const policyDecision = this.policyService.evaluate({
      subject: mockImprovementSubject("mock-auto-improvement"),
      action: "improvement.draft_change.prepare",
      resource: createPolicyResource({
        resourceKind: "draft_registry_change",
        resourceId: proposal.id,
        metadata: {
          targetKind: proposal.targetKind,
          proposedChangeType: proposal.proposedChangeType
        }
      }),
      context: createPolicyContext({
        metadata: {
          source: "mock_auto_improvement_engine"
        }
      })
    });
    if (!policyDecision.allowed) throw new Error(policyDecision.reason);
    const changeType = draftChangeTypeForProposal(proposal);
    return this.repository.createDraftRegistryChange(createDraftRegistryChange({
      id: stableDraftChangeId(proposal.id),
      proposalId: proposal.id,
      targetKind: proposal.targetKind,
      targetId: proposal.targetId,
      targetName: proposal.targetName,
      targetVersion: proposal.targetVersion,
      changeType,
      draftPayload: {
        draftOnly: true,
        activeRegistryMutation: false,
        target: {
          kind: proposal.targetKind,
          id: proposal.targetId,
          name: proposal.targetName,
          version: proposal.targetVersion
        },
        proposedChangeType: proposal.proposedChangeType,
        proposedPatch: proposal.proposedPatch,
        proposedSummary: proposal.proposedSummary
      }
    }));
  }

  evaluateProposalReadiness(proposalId: string): ProposalReadiness {
    const proposal = this.requireProposal(proposalId);
    return this.repository.upsertProposalReadiness(evaluateReadinessSnapshot(this.repository, proposal));
  }

  listAnalyses(): AutoImprovementAnalysis[] {
    return this.repository.listAutoImprovementAnalyses();
  }

  getAnalysis(id: string): AutoImprovementAnalysis | undefined {
    return this.repository.getAutoImprovementAnalysis(id);
  }

  private requireCluster(clusterId: string): FailureCluster {
    const cluster = this.repository.getFailureCluster(clusterId);
    if (!cluster) throw new Error(`Failure cluster not found: ${clusterId}`);
    return cluster;
  }

  private requireProposal(proposalId: string): ImprovementProposal {
    const proposal = this.repository.getImprovementProposal(proposalId);
    if (!proposal) throw new Error(`Improvement proposal not found: ${proposalId}`);
    return proposal;
  }
}

export type ImprovementServices = {
  signals: FailureSignalService;
  clustering: FailureClusteringService;
  candidates: ImprovementCandidateService;
  proposals: ImprovementProposalService;
  evalRequirements: EvalRequirementService;
  canaryPlans: CanaryRolloutPlanService;
  safetyPolicies: AutoImprovementSafetyPolicyService;
  draftRegistryChanges: DraftRegistryChangeService;
  proposalReadiness: ProposalReadinessService;
  autoImprovement: MockAutoImprovementEngine;
  governance: ProposalGovernanceService;
  proposalEvalRuns: ProposalEvalRunService;
  canaryReadiness: CanaryReadinessService;
  applyGate: ProposalApplyGateService;
};

export function createImprovementServices(repository: ImprovementRepository = new InMemoryImprovementRepository(), input: ImprovementPolicyInput = {}): ImprovementServices {
  return {
    signals: new FailureSignalService(repository),
    clustering: new FailureClusteringService(repository),
    candidates: new ImprovementCandidateService(repository),
    proposals: new ImprovementProposalService(repository),
    evalRequirements: new EvalRequirementService(repository),
    canaryPlans: new CanaryRolloutPlanService(repository),
    safetyPolicies: new AutoImprovementSafetyPolicyService(repository),
    draftRegistryChanges: new DraftRegistryChangeService(repository),
    proposalReadiness: new ProposalReadinessService(repository),
    autoImprovement: new MockAutoImprovementEngine(repository, input),
    governance: new ProposalGovernanceService(repository, input),
    proposalEvalRuns: new ProposalEvalRunService(repository),
    canaryReadiness: new CanaryReadinessService(repository),
    applyGate: new ProposalApplyGateService(repository, input)
  };
}

export function failureSignalToDto(signal: FailureSignal): FailureSignalDto {
  return { ...cloneFailureSignal(signal), observedAt: signal.observedAt.toISOString() };
}

export function failureClusterToDto(cluster: FailureCluster): FailureClusterDto {
  return { ...cloneFailureCluster(cluster), createdAt: cluster.createdAt.toISOString(), updatedAt: cluster.updatedAt.toISOString() };
}

export function improvementCandidateToDto(candidate: ImprovementCandidate): ImprovementCandidateDto {
  return { ...cloneCandidate(candidate), createdAt: candidate.createdAt.toISOString(), updatedAt: candidate.updatedAt.toISOString() };
}

export function improvementProposalToDto(proposal: ImprovementProposal): ImprovementProposalDto {
  return { ...cloneProposal(proposal), createdAt: proposal.createdAt.toISOString(), updatedAt: proposal.updatedAt.toISOString() };
}

export function evalRequirementToDto(requirement: EvalRequirement): EvalRequirementDto {
  return { ...cloneEvalRequirement(requirement), createdAt: requirement.createdAt.toISOString() };
}

export function canaryRolloutPlanToDto(plan: CanaryRolloutPlan): CanaryRolloutPlanDto {
  return { ...cloneCanaryPlan(plan), createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString() };
}

export function safetyPolicyToDto(policy: AutoImprovementSafetyPolicy): AutoImprovementSafetyPolicyDto {
  return { ...cloneSafetyPolicy(policy), createdAt: policy.createdAt.toISOString(), updatedAt: policy.updatedAt.toISOString() };
}

export function autoImprovementAnalysisToDto(analysis: AutoImprovementAnalysis): AutoImprovementAnalysisDto {
  return { ...cloneAnalysis(analysis), createdAt: analysis.createdAt.toISOString() };
}

export function draftRegistryChangeToDto(change: DraftRegistryChange): DraftRegistryChangeDto {
  return { ...cloneDraftRegistryChange(change), createdAt: change.createdAt.toISOString(), updatedAt: change.updatedAt.toISOString() };
}

export function proposalReadinessToDto(readiness: ProposalReadiness): ProposalReadinessDto {
  return { ...cloneProposalReadiness(readiness), evaluatedAt: readiness.evaluatedAt.toISOString() };
}

export function proposalReviewQueueItemToDto(item: ProposalReviewQueueItem): ProposalReviewQueueItemDto {
  return { ...cloneProposalReviewQueueItem(item), createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() };
}

export function proposalGovernanceDecisionToDto(decision: ProposalGovernanceDecision): ProposalGovernanceDecisionDto {
  return { ...cloneGovernanceDecision(decision), createdAt: decision.createdAt.toISOString() };
}

export function proposalEvalRunToDto(run: ProposalEvalRun): ProposalEvalRunDto {
  return { ...cloneProposalEvalRun(run), attachedAt: run.attachedAt.toISOString() };
}

export function canaryReadinessToDto(readiness: CanaryReadiness): CanaryReadinessDto {
  return { ...cloneCanaryReadiness(readiness), evaluatedAt: readiness.evaluatedAt.toISOString() };
}

export function proposalApplyGateToDto(gate: ProposalApplyGate): ProposalApplyGateDto {
  return { ...cloneProposalApplyGate(gate), evaluatedAt: gate.evaluatedAt.toISOString() };
}

export function improvementGovernanceAuditEventToDto(event: ImprovementGovernanceAuditEvent): ImprovementGovernanceAuditEventDto {
  return { ...cloneGovernanceAuditEvent(event), createdAt: event.createdAt.toISOString() };
}

export function isFailureSeverity(value: unknown): value is FailureSeverity {
  return typeof value === "string" && severities.has(value as FailureSeverity);
}

export function isFailureSignalTargetKind(value: unknown): value is FailureSignalTargetKind {
  return typeof value === "string" && signalTargetKinds.has(value as FailureSignalTargetKind);
}

export function isImprovementCandidateStatus(value: unknown): value is ImprovementCandidateStatus {
  return typeof value === "string" && candidateStatuses.has(value as ImprovementCandidateStatus);
}

export function isImprovementProposalStatus(value: unknown): value is ImprovementProposalStatus {
  return typeof value === "string" && proposalStatuses.has(value as ImprovementProposalStatus);
}

export function isDraftRegistryChangeStatus(value: unknown): value is DraftRegistryChangeStatus {
  return typeof value === "string" && draftRegistryChangeStatuses.has(value as DraftRegistryChangeStatus);
}

export function isProposalGovernanceDecision(value: unknown): value is ProposalGovernanceDecisionType {
  return typeof value === "string" && governanceDecisionTypes.has(value as ProposalGovernanceDecisionType);
}

export function isProposalEvalRunStatus(value: unknown): value is ProposalEvalRunStatus {
  return typeof value === "string" && proposalEvalRunStatuses.has(value as ProposalEvalRunStatus);
}
