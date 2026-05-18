import { createId } from "../domain/ids.ts";
import type {
  BranchLease,
  ConflictRisk,
  MergeQueueEntry,
  MergeSimulationResult
} from "../domain/models.ts";

export type RealMergeExecutionPolicyStatus =
  | "disabled"
  | "policy_defined"
  | "ready_for_future_integration"
  | "blocked";

export type RealMergeExecutionDecisionValue =
  | "denied_default"
  | "blocked_missing_approval"
  | "blocked_missing_dry_run"
  | "blocked_conflict_risk"
  | "blocked_workspace_not_ready"
  | "blocked_branch_lease_invalid"
  | "blocked_scope_mismatch"
  | "blocked_policy_denied"
  | "blocked_no_owner"
  | "ready_for_manual_future"
  | "future_execution_allowed";

export type RealMergePreconditionCategory =
  | "branch_lease"
  | "workspace"
  | "worktree"
  | "merge_queue"
  | "dry_run"
  | "conflict_resolution"
  | "validation"
  | "approval"
  | "pr_ownership"
  | "tenant_scope"
  | "policy"
  | "auth"
  | "observability"
  | "rollback";

export type RealMergePreconditionStatus =
  | "pass"
  | "warning"
  | "fail"
  | "missing"
  | "not_applicable"
  | "future";

export type RealMergePreconditionSeverity = "low" | "medium" | "high" | "critical";

export type RealMergeForbiddenOperationKind =
  | "auto_merge"
  | "remote_push"
  | "force_push"
  | "rebase"
  | "branch_delete"
  | "worktree_delete"
  | "bypass_policy"
  | "bypass_approval"
  | "bypass_dry_run";

export type RealMergeForbiddenOperationStatus =
  | "forbidden"
  | "future_manual_only"
  | "blocked";

export type RealMergeEvidenceStatus =
  | "passed"
  | "approved"
  | "not_required"
  | "pending"
  | "failed"
  | "rejected"
  | "missing";

export type RealMergeExecutionPolicy = {
  id: string;
  name: string;
  status: RealMergeExecutionPolicyStatus;
  mergeExecutionEnabled: false;
  autoMergeEnabled: false;
  remotePushEnabled: false;
  requiredEvidence: string[];
  requiredApprovals: string[];
  requiredChecks: string[];
  forbiddenOperations: RealMergeForbiddenOperationKind[];
  allowedFutureModes: string[];
  metadata: Record<string, unknown>;
};

export type RealMergeExecutionRequest = {
  id: string;
  repoId: string;
  baseBranch: string;
  sourceBranch: string;
  mergeQueueEntryId?: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  prOwnershipId?: string;
  conflictResolutionPlanId?: string;
  dryRunMergeId?: string;
  requestedByActorId: string;
  requestedByPrincipalId?: string;
  requestId?: string;
  correlationId?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type RealMergeExecutionDecision = {
  id: string;
  requestId: string;
  decision: RealMergeExecutionDecisionValue;
  reasons: string[];
  blockingReasons: string[];
  warnings: string[];
  requiredActions: string[];
  mergeExecutionPerformed: false;
  autoMergePerformed: false;
  remotePushPerformed: false;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type RealMergePrecondition = {
  id: string;
  requestId: string;
  category: RealMergePreconditionCategory;
  status: RealMergePreconditionStatus;
  required: boolean;
  severity: RealMergePreconditionSeverity;
  evidence: string;
  remediation: string;
  metadata: Record<string, unknown>;
};

export type RealMergeForbiddenOperation = {
  id: string;
  operation: RealMergeForbiddenOperationKind;
  status: RealMergeForbiddenOperationStatus;
  reason: string;
  metadata: Record<string, unknown>;
};

export type RealMergePostExecutionEvidenceTemplate = {
  id: string;
  requiredFields: string[];
  healthChecks: string[];
  validationChecks: string[];
  auditRequirements: string[];
  rollbackCheckpoint: string;
  metadata: Record<string, unknown>;
};

export type RealMergeExecutionSummary = {
  status: "v1_implemented";
  policyId: string;
  policyStatus: RealMergeExecutionPolicyStatus;
  requests: number;
  decisions: number;
  readyForManualFuture: number;
  blocked: number;
  preconditions: number;
  forbiddenOperations: number;
  mergeExecutionEnabled: false;
  autoMergeEnabled: false;
  remotePushEnabled: false;
  mergeExecutionPerformed: false;
  autoMergePerformed: false;
  remotePushPerformed: false;
  branchDeletionPerformed: false;
  workspaceMutationPerformed: false;
  githubApiCalls: false;
  realLlmCalls: false;
  secretsExposed: false;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type RealMergeExecutionContext = {
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  source?: string;
  roles?: string[];
  teams?: string[];
  validationStatus?: RealMergeEvidenceStatus;
  approvalStatus?: RealMergeEvidenceStatus;
  rollbackPlanStatus?: RealMergeEvidenceStatus;
  tenantScopeStatus?: "match" | "mismatch" | "unknown" | "not_applicable";
  metadata?: Record<string, unknown>;
  persist?: boolean;
};

export type EvaluateRealMergeExecutionRequestInput = {
  id?: string;
  repoId?: string;
  baseBranch?: string;
  sourceBranch?: string;
  branchName?: string;
  mergeQueueEntryId?: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  prOwnershipId?: string;
  conflictResolutionPlanId?: string;
  dryRunMergeId?: string;
  requestedByActorId?: string;
  requestedByPrincipalId?: string;
  validationStatus?: RealMergeEvidenceStatus;
  approvalStatus?: RealMergeEvidenceStatus;
  rollbackPlanStatus?: RealMergeEvidenceStatus;
  tenantScopeStatus?: "match" | "mismatch" | "unknown" | "not_applicable";
  metadata?: Record<string, unknown>;
};

export type RealMergePolicyDecisionSnapshot = {
  allowed: boolean;
  decision?: string;
  reason?: string;
  policyDecisionId?: string;
  matchedRuleIds?: string[];
};

export type RealMergeExecutionPolicyAction =
  | "merge_execution.policy.read"
  | "merge_execution.evaluate"
  | "merge_execution.request"
  | "merge_execution.execute_future"
  | "merge_execution.override_future"
  | "merge_execution.post_evidence.record_future";

export type RealMergeExecutionPolicyEvaluationInput = {
  action: RealMergeExecutionPolicyAction;
  request: RealMergeExecutionRequest;
  queueEntry?: MergeQueueEntry;
  lease?: BranchLease;
  context: RealMergeExecutionContext;
  metadata: Record<string, unknown>;
};

export type RealMergeWorkspaceSnapshot = {
  id: string;
  repoId?: string;
  branchLeaseId?: string;
  taskRunId?: string;
  branchName?: string;
  status: string;
  isolationStatus?: string;
  workspaceKind?: string;
  metadata?: Record<string, unknown>;
};

export type RealMergeWorktreeAllocationSnapshot = {
  id: string;
  requestId?: string;
  workspaceLeaseId?: string;
  branchLeaseId?: string;
  branchName?: string;
  decision?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

export type RealMergeEditOverlapSnapshot = {
  id: string;
  repoId: string;
  overlapKind: string;
  files: string[];
  severity: string;
  recommendation?: string;
  metadata?: Record<string, unknown>;
};

export type RealMergeConflictResolutionPlanSnapshot = {
  id: string;
  status: string;
  applyAllowed?: boolean;
  metadata?: Record<string, unknown>;
};

export type RealMergePrOwnershipReadinessSnapshot = {
  status: string;
  ownershipRecordId?: string;
  ownerActorId?: string;
  reviewerActorIds?: string[];
  metadata?: Record<string, unknown>;
};

export type RealMergeQueueReadinessSnapshot = {
  decision?: string;
  blockingReasons?: string[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
};

export type RealMergeExecutionPolicyDataSource = {
  getBranchLease?(branchLeaseId: string): BranchLease | undefined;
  getMergeQueueEntry?(mergeQueueEntryId: string): MergeQueueEntry | undefined;
  latestMergeSimulationForLease?(branchLeaseId: string): MergeSimulationResult | undefined;
  getMergeSimulation?(mergeSimulationId: string): MergeSimulationResult | undefined;
  highestConflictRiskForLease?(branchLeaseId: string): ConflictRisk | undefined;
  getWorkspaceLease?(workspaceLeaseId: string): RealMergeWorkspaceSnapshot | undefined;
  getWorktreeAllocation?(input: RealMergeExecutionRequest): RealMergeWorktreeAllocationSnapshot | undefined;
  listEditOverlapsForRequest?(input: RealMergeExecutionRequest): RealMergeEditOverlapSnapshot[];
  getConflictResolutionPlan?(planId: string): RealMergeConflictResolutionPlanSnapshot | undefined;
  getPrOwnershipReadiness?(input: RealMergeExecutionRequest): RealMergePrOwnershipReadinessSnapshot | undefined;
  getMergeQueueReadiness?(mergeQueueEntryId: string): RealMergeQueueReadinessSnapshot | undefined;
};

export type RealMergeExecutionPolicyServiceOptions = {
  dataSource?: RealMergeExecutionPolicyDataSource;
  policy?: RealMergeExecutionPolicy;
  policyEvaluator?: (input: RealMergeExecutionPolicyEvaluationInput) => RealMergePolicyDecisionSnapshot;
  now?: () => Date;
};

type PreconditionInput = {
  category: RealMergePreconditionCategory;
  status: RealMergePreconditionStatus;
  required: boolean;
  severity: RealMergePreconditionSeverity;
  evidence: string;
  remediation: string;
  metadata?: Record<string, unknown>;
};

const highConflictLevels = new Set(["high", "critical"]);
const mediumConflictLevels = new Set(["medium"]);
const readyWorkspaceStatuses = new Set(["ready", "ready_for_merge", "merged", "fixture_ready"]);
const notReadyWorkspaceStatuses = new Set(["requested", "allocated", "active", "frozen", "cleanup_pending", "failed", "abandoned"]);
const highOverlapSeverities = new Set(["high", "critical"]);
const policyActions: RealMergeExecutionPolicyAction[] = [
  "merge_execution.policy.read",
  "merge_execution.evaluate",
  "merge_execution.request",
  "merge_execution.execute_future",
  "merge_execution.override_future",
  "merge_execution.post_evidence.record_future"
];

export function createDefaultRealMergeExecutionPolicy(): RealMergeExecutionPolicy {
  return {
    id: "real_merge_execution_policy_v1_default",
    name: "Real Merge Execution Policy v1",
    status: "policy_defined",
    mergeExecutionEnabled: false,
    autoMergeEnabled: false,
    remotePushEnabled: false,
    requiredEvidence: [
      "active_branch_lease",
      "ready_merge_queue_entry",
      "clean_dry_run_merge",
      "low_or_accepted_conflict_risk",
      "no_high_edit_overlap",
      "no_unresolved_conflict_resolution_plan",
      "pr_owner_present",
      "human_approval_present",
      "validation_green",
      "tenant_scope_matches",
      "rollback_plan_present",
      "observability_metadata_present"
    ],
    requiredApprovals: [
      "human_merge_signoff",
      "policy_allows_request_metadata",
      "future_execution_gate_denied_in_v1"
    ],
    requiredChecks: [
      "merge_execution_enabled_false",
      "auto_merge_enabled_false",
      "remote_push_enabled_false",
      "forbidden_operations_enforced",
      "no_real_git_operation",
      "no_workspace_mutation",
      "no_secret_or_env_exposure"
    ],
    forbiddenOperations: [
      "auto_merge",
      "remote_push",
      "force_push",
      "rebase",
      "branch_delete",
      "worktree_delete",
      "bypass_policy",
      "bypass_approval",
      "bypass_dry_run"
    ],
    allowedFutureModes: [
      "manual_reviewed_local_merge_future",
      "merge_queue_controlled_future",
      "integration_test_profile_future"
    ],
    metadata: {
      version: "v1",
      metadataOnly: true,
      defaultRuntimeSafe: true,
      noRealMerge: true,
      noAutoMerge: true,
      noRemotePush: true,
      productionReady: false
    }
  };
}

export class RealMergeExecutionPolicyService {
  private readonly policy: RealMergeExecutionPolicy;
  private readonly dataSource: RealMergeExecutionPolicyDataSource;
  private readonly policyEvaluator?: (input: RealMergeExecutionPolicyEvaluationInput) => RealMergePolicyDecisionSnapshot;
  private readonly now: () => Date;
  private readonly requests = new Map<string, RealMergeExecutionRequest>();
  private readonly decisions = new Map<string, RealMergeExecutionDecision>();
  private readonly preconditions = new Map<string, RealMergePrecondition[]>();
  private readonly forbiddenOperations: RealMergeForbiddenOperation[];
  private readonly postEvidenceTemplate: RealMergePostExecutionEvidenceTemplate;

  constructor(options: RealMergeExecutionPolicyServiceOptions = {}) {
    this.policy = clonePolicy(options.policy ?? createDefaultRealMergeExecutionPolicy());
    this.dataSource = options.dataSource ?? {};
    this.policyEvaluator = options.policyEvaluator;
    this.now = options.now ?? (() => new Date());
    this.forbiddenOperations = this.policy.forbiddenOperations.map((operation) => ({
      id: `real_merge_forbidden_${operation}`,
      operation,
      status: operation === "bypass_policy" || operation === "bypass_approval" || operation === "bypass_dry_run"
        ? "blocked"
        : "forbidden",
      reason: forbiddenReason(operation),
      metadata: sanitizeMetadata({
        metadataOnly: true,
        mergeExecutionEnabled: false,
        autoMergeEnabled: false,
        remotePushEnabled: false
      })
    }));
    this.postEvidenceTemplate = {
      id: "real_merge_post_execution_evidence_template_v1",
      requiredFields: [
        "merge_request_id",
        "merge_decision_id",
        "merge_commit_sha_future",
        "merged_by_actor_id_future",
        "merge_queue_entry_id",
        "dry_run_merge_id",
        "validation_result_ids",
        "rollback_checkpoint_id"
      ],
      healthChecks: [
        "post_merge_build_health_future",
        "post_merge_test_health_future",
        "deployment_readiness_health_future"
      ],
      validationChecks: [
        "lint_future",
        "typecheck_future",
        "test_future",
        "build_future"
      ],
      auditRequirements: [
        "request_id",
        "correlation_id",
        "actor_id",
        "policy_decision_id",
        "approval_signoff_id_future",
        "no_secret_or_env_exposure"
      ],
      rollbackCheckpoint: "rollback_or_revert_plan_must_exist_before_future_execution",
      metadata: sanitizeMetadata({
        metadataOnly: true,
        mergeExecutionPerformed: false,
        templateOnly: true
      })
    };
  }

  getPolicy(): RealMergeExecutionPolicy {
    return clonePolicy(this.policy);
  }

  evaluateRequest(
    input: EvaluateRealMergeExecutionRequestInput,
    context: RealMergeExecutionContext = {}
  ): RealMergeExecutionDecision {
    const createdAt = this.now();
    const queueEntry = input.mergeQueueEntryId ? this.dataSource.getMergeQueueEntry?.(input.mergeQueueEntryId) : undefined;
    const branchLeaseId = input.branchLeaseId ?? queueEntry?.branchLeaseId;
    const lease = branchLeaseId ? this.dataSource.getBranchLease?.(branchLeaseId) : undefined;
    const dryRunMergeId = input.dryRunMergeId;
    const request: RealMergeExecutionRequest = {
      id: input.id ?? createId("real_merge_request"),
      repoId: input.repoId ?? queueEntry?.repoId ?? lease?.repoId ?? "unknown_repo",
      baseBranch: input.baseBranch ?? lease?.baseBranch ?? "unknown_base",
      sourceBranch: input.sourceBranch ?? input.branchName ?? queueEntry?.branchName ?? lease?.branchName ?? "unknown_source",
      mergeQueueEntryId: input.mergeQueueEntryId,
      branchLeaseId,
      workspaceLeaseId: input.workspaceLeaseId,
      prOwnershipId: input.prOwnershipId,
      conflictResolutionPlanId: input.conflictResolutionPlanId,
      dryRunMergeId,
      requestedByActorId: input.requestedByActorId ?? context.actorId ?? context.serviceAccountId ?? "system",
      requestedByPrincipalId: input.requestedByPrincipalId ?? context.principalId,
      requestId: context.requestId,
      correlationId: context.correlationId,
      createdAt,
      metadata: sanitizeMetadata({
        ...input.metadata,
        ...contextMetadata(context),
        metadataOnly: true,
        mergeExecutionEnabled: false,
        mergeExecutionPerformed: false
      })
    };

    const dryRun = dryRunMergeId
      ? this.dataSource.getMergeSimulation?.(dryRunMergeId)
      : branchLeaseId
        ? this.dataSource.latestMergeSimulationForLease?.(branchLeaseId)
        : undefined;
    const conflictRisk = branchLeaseId ? this.dataSource.highestConflictRiskForLease?.(branchLeaseId) : undefined;
    const workspace = input.workspaceLeaseId ? this.dataSource.getWorkspaceLease?.(input.workspaceLeaseId) : undefined;
    const worktree = this.dataSource.getWorktreeAllocation?.(request);
    const overlaps = this.dataSource.listEditOverlapsForRequest?.(request) ?? [];
    const conflictPlan = input.conflictResolutionPlanId
      ? this.dataSource.getConflictResolutionPlan?.(input.conflictResolutionPlanId)
      : undefined;
    const ownership = this.dataSource.getPrOwnershipReadiness?.(request);
    const mergeQueueReadiness = input.mergeQueueEntryId ? this.dataSource.getMergeQueueReadiness?.(input.mergeQueueEntryId) : undefined;

    const policyRead = this.evaluatePolicy("merge_execution.policy.read", request, queueEntry, lease, context, {
      stage: "policy_read",
      metadataOnly: true
    });
    const policyEvaluate = this.evaluatePolicy("merge_execution.evaluate", request, queueEntry, lease, context, {
      stage: "evaluate",
      metadataOnly: true
    });
    const policyRequest = this.evaluatePolicy("merge_execution.request", request, queueEntry, lease, context, {
      stage: "request",
      metadataOnly: true
    });
    const policyExecuteFuture = this.evaluatePolicy("merge_execution.execute_future", request, queueEntry, lease, context, {
      stage: "execute_future",
      metadataOnly: true,
      mergeExecutionEnabled: false
    });

    const preconditions = this.buildPreconditions({
      request,
      queueEntry,
      lease,
      dryRun,
      conflictRisk,
      workspace,
      worktree,
      overlaps,
      conflictPlan,
      ownership,
      mergeQueueReadiness,
      policyRead,
      policyEvaluate,
      policyRequest,
      policyExecuteFuture,
      input,
      context
    });

    const decisionValue = chooseDecision(preconditions, policyRead, policyEvaluate, policyRequest, policyExecuteFuture, input);
    const blockingReasons = preconditions
      .filter((precondition) => precondition.required && (precondition.status === "fail" || precondition.status === "missing"))
      .map((precondition) => `${precondition.category}:${precondition.evidence}`);
    const warnings = preconditions
      .filter((precondition) => precondition.status === "warning" || precondition.status === "future")
      .map((precondition) => `${precondition.category}:${precondition.evidence}`);
    const allRequiredPassed = preconditions
      .filter((precondition) => precondition.required)
      .every((precondition) => precondition.status === "pass" || precondition.status === "not_applicable");

    const decision: RealMergeExecutionDecision = {
      id: createId("real_merge_decision"),
      requestId: request.id,
      decision: decisionValue,
      reasons: [
        this.policy.mergeExecutionEnabled === false ? "merge_execution_disabled_in_v1" : "merge_execution_gate_unexpected",
        decisionValue === "ready_for_manual_future" && allRequiredPassed
          ? "all_modeled_preconditions_passed_for_future_manual_path"
          : "real_merge_execution_not_performed",
        policyExecuteFuture.allowed ? "future_execute_policy_unexpectedly_allowed" : "future_execute_policy_denied_as_expected"
      ],
      blockingReasons: unique(blockingReasons),
      warnings: unique([
        ...warnings,
        "future_execution_allowed_never_returned_in_v1",
        "post_execution_evidence_template_only"
      ]),
      requiredActions: requiredActionsFor(preconditions, decisionValue),
      mergeExecutionPerformed: false,
      autoMergePerformed: false,
      remotePushPerformed: false,
      createdAt,
      metadata: sanitizeMetadata({
        metadataOnly: true,
        noRealGitOperation: true,
        noRemotePush: true,
        noAutoMerge: true,
        noBranchDeletion: true,
        noWorkspaceMutation: true,
        policyRead,
        policyEvaluate,
        policyRequest,
        policyExecuteFuture,
        allRequiredPassed
      })
    };

    this.requests.set(request.id, cloneRequest(request));
    this.decisions.set(decision.id, cloneDecision(decision));
    this.preconditions.set(request.id, preconditions.map(clonePrecondition));
    return cloneDecision(decision);
  }

  listRequests(repoId?: string): RealMergeExecutionRequest[] {
    return [...this.requests.values()]
      .filter((request) => repoId === undefined || request.repoId === repoId)
      .map(cloneRequest);
  }

  listDecisions(requestId?: string): RealMergeExecutionDecision[] {
    return [...this.decisions.values()]
      .filter((decision) => requestId === undefined || decision.requestId === requestId)
      .map(cloneDecision);
  }

  listPreconditions(requestId?: string): RealMergePrecondition[] {
    const values = requestId
      ? this.preconditions.get(requestId) ?? []
      : [...this.preconditions.values()].flat();
    return values.map(clonePrecondition);
  }

  listForbiddenOperations(): RealMergeForbiddenOperation[] {
    return this.forbiddenOperations.map(cloneForbiddenOperation);
  }

  getPostExecutionEvidenceTemplate(): RealMergePostExecutionEvidenceTemplate {
    return clonePostEvidenceTemplate(this.postEvidenceTemplate);
  }

  getSummary(repoId?: string): RealMergeExecutionSummary {
    const requests = this.listRequests(repoId);
    const requestIds = new Set(requests.map((request) => request.id));
    const decisions = this.listDecisions().filter((decision) => requestIds.has(decision.requestId));
    const preconditions = requests.flatMap((request) => this.preconditions.get(request.id) ?? []);
    return {
      status: "v1_implemented",
      policyId: this.policy.id,
      policyStatus: this.policy.status,
      requests: requests.length,
      decisions: decisions.length,
      readyForManualFuture: decisions.filter((decision) => decision.decision === "ready_for_manual_future").length,
      blocked: decisions.filter((decision) => decision.decision !== "ready_for_manual_future").length,
      preconditions: preconditions.length,
      forbiddenOperations: this.forbiddenOperations.length,
      mergeExecutionEnabled: false,
      autoMergeEnabled: false,
      remotePushEnabled: false,
      mergeExecutionPerformed: false,
      autoMergePerformed: false,
      remotePushPerformed: false,
      branchDeletionPerformed: false,
      workspaceMutationPerformed: false,
      githubApiCalls: false,
      realLlmCalls: false,
      secretsExposed: false,
      envValuesExposed: false,
      metadata: sanitizeMetadata({
        latestDecision: decisions.at(-1)?.decision ?? "none",
        noAutoMergeGuarantee: true,
        noRealMergeGuarantee: true,
        defaultRuntimeSafe: true,
        productionReady: false
      })
    };
  }

  private evaluatePolicy(
    action: RealMergeExecutionPolicyAction,
    request: RealMergeExecutionRequest,
    queueEntry: MergeQueueEntry | undefined,
    lease: BranchLease | undefined,
    context: RealMergeExecutionContext,
    metadata: Record<string, unknown>
  ): RealMergePolicyDecisionSnapshot {
    if (!this.policyEvaluator) {
      return {
        allowed: action === "merge_execution.policy.read" ||
          action === "merge_execution.evaluate" ||
          action === "merge_execution.request",
        decision: action === "merge_execution.execute_future" ||
          action === "merge_execution.override_future" ||
          action === "merge_execution.post_evidence.record_future"
          ? "deny"
          : "allow",
        reason: "default_static_real_merge_execution_policy_v1"
      };
    }
    return this.policyEvaluator({
      action,
      request,
      queueEntry,
      lease,
      context,
      metadata: sanitizeMetadata({
        ...metadata,
        policyAction: action,
        mergeExecutionEnabled: false,
        autoMergeEnabled: false,
        remotePushEnabled: false,
        allowedPolicyActions: policyActions
      })
    });
  }

  private buildPreconditions(input: {
    request: RealMergeExecutionRequest;
    queueEntry?: MergeQueueEntry;
    lease?: BranchLease;
    dryRun?: MergeSimulationResult;
    conflictRisk?: ConflictRisk;
    workspace?: RealMergeWorkspaceSnapshot;
    worktree?: RealMergeWorktreeAllocationSnapshot;
    overlaps: RealMergeEditOverlapSnapshot[];
    conflictPlan?: RealMergeConflictResolutionPlanSnapshot;
    ownership?: RealMergePrOwnershipReadinessSnapshot;
    mergeQueueReadiness?: RealMergeQueueReadinessSnapshot;
    policyRead: RealMergePolicyDecisionSnapshot;
    policyEvaluate: RealMergePolicyDecisionSnapshot;
    policyRequest: RealMergePolicyDecisionSnapshot;
    policyExecuteFuture: RealMergePolicyDecisionSnapshot;
    input: EvaluateRealMergeExecutionRequestInput;
    context: RealMergeExecutionContext;
  }): RealMergePrecondition[] {
    const preconditions: PreconditionInput[] = [];
    const {
      request,
      queueEntry,
      lease,
      dryRun,
      conflictRisk,
      workspace,
      worktree,
      overlaps,
      conflictPlan,
      ownership,
      mergeQueueReadiness,
      policyRead,
      policyEvaluate,
      policyRequest,
      policyExecuteFuture
    } = input;
    const validationStatus = input.input.validationStatus ?? input.context.validationStatus ?? evidenceStatusFromMetadata(input.input.metadata, "validationStatus");
    const approvalStatus = input.input.approvalStatus ?? input.context.approvalStatus ?? evidenceStatusFromMetadata(input.input.metadata, "approvalStatus");
    const rollbackStatus = input.input.rollbackPlanStatus ?? input.context.rollbackPlanStatus ?? rollbackStatusFromMetadata(input.input.metadata);
    const tenantScopeStatus = input.input.tenantScopeStatus ?? input.context.tenantScopeStatus ?? tenantScopeStatusFromMetadata(input.input.metadata);

    if (!request.branchLeaseId) {
      preconditions.push(missing("branch_lease", "branch_lease_id_missing", "Provide an active BranchLease id before any future merge request.", "high"));
    } else if (!lease) {
      preconditions.push(fail("branch_lease", "branch_lease_not_found", "Create or refresh a BranchLease for the source branch.", "high", { branchLeaseId: request.branchLeaseId }));
    } else if (lease.status !== "active") {
      preconditions.push(fail("branch_lease", `branch_lease_${lease.status}`, "Renew or replace the branch lease before future merge evaluation.", "high", { branchLeaseId: lease.id, status: lease.status }));
    } else if (lease.repoId !== request.repoId || lease.branchName !== request.sourceBranch || lease.baseBranch !== request.baseBranch) {
      preconditions.push(fail("branch_lease", "branch_lease_scope_mismatch", "Align repo, source branch, and base branch metadata before future merge evaluation.", "high", {
        branchLeaseId: lease.id,
        leaseRepoId: lease.repoId,
        requestRepoId: request.repoId,
        leaseBranchName: lease.branchName,
        sourceBranch: request.sourceBranch,
        leaseBaseBranch: lease.baseBranch,
        baseBranch: request.baseBranch
      }));
    } else {
      preconditions.push(pass("branch_lease", "active_branch_lease_scope_matches", "No remediation required.", "medium", {
        branchLeaseId: lease.id,
        taskId: lease.taskId,
        taskRunId: lease.taskRunId
      }));
    }

    if (!request.mergeQueueEntryId) {
      preconditions.push(missing("merge_queue", "merge_queue_entry_id_missing", "Link a ready merge queue entry before future execution.", "high"));
    } else if (!queueEntry) {
      preconditions.push(fail("merge_queue", "merge_queue_entry_not_found", "Create or refresh merge queue metadata.", "high", { mergeQueueEntryId: request.mergeQueueEntryId }));
    } else if (queueEntry.status !== "ready") {
      preconditions.push(fail("merge_queue", `merge_queue_${queueEntry.status}`, "Evaluate queue readiness and clear holds before future execution.", "high", {
        mergeQueueEntryId: queueEntry.id,
        status: queueEntry.status,
        policyDecision: mergeQueueReadiness?.decision
      }));
    } else {
      preconditions.push(pass("merge_queue", "merge_queue_ready", "No remediation required.", "medium", {
        mergeQueueEntryId: queueEntry.id,
        policyDecision: mergeQueueReadiness?.decision ?? "ready_metadata"
      }));
    }

    if (!dryRun) {
      preconditions.push(missing("dry_run", "dry_run_merge_missing", "Run or link a clean dry-run merge simulation before future execution.", "high"));
    } else if (dryRun.status !== "clean") {
      preconditions.push(fail("dry_run", `dry_run_${dryRun.status}`, "Resolve conflicts or rerun dry-run simulation until it is clean.", "critical", {
        dryRunMergeId: dryRun.id,
        status: dryRun.status,
        conflictingFiles: dryRun.conflictingFiles
      }));
    } else {
      preconditions.push(pass("dry_run", "dry_run_clean", "No remediation required.", "medium", {
        dryRunMergeId: dryRun.id,
        changedFiles: dryRun.changedFiles.length
      }));
    }

    if (!conflictRisk) {
      preconditions.push(pass("conflict_resolution", "no_conflict_risk_metadata_found", "No remediation required for absent risk metadata in v1.", "low"));
    } else if (highConflictLevels.has(conflictRisk.riskLevel)) {
      preconditions.push(fail("conflict_resolution", `conflict_risk_${conflictRisk.riskLevel}`, "Resolve or explicitly review high conflict risk before future execution.", "critical", {
        conflictRiskId: conflictRisk.id,
        riskScore: conflictRisk.riskScore,
        overlapFiles: conflictRisk.overlapFiles
      }));
    } else if (mediumConflictLevels.has(conflictRisk.riskLevel)) {
      preconditions.push(warning("conflict_resolution", "conflict_risk_medium", "Review medium conflict risk before future execution.", "medium", {
        conflictRiskId: conflictRisk.id,
        riskScore: conflictRisk.riskScore
      }));
    } else {
      preconditions.push(pass("conflict_resolution", `conflict_risk_${conflictRisk.riskLevel}`, "No remediation required.", "medium", {
        conflictRiskId: conflictRisk.id,
        riskScore: conflictRisk.riskScore
      }));
    }

    const severeOverlaps = overlaps.filter((overlap) => highOverlapSeverities.has(overlap.severity));
    if (severeOverlaps.length > 0) {
      preconditions.push(fail("conflict_resolution", "unresolved_high_edit_overlap", "Serialize or resolve high/critical edit overlaps before future execution.", "critical", {
        overlapIds: severeOverlaps.map((overlap) => overlap.id),
        files: unique(severeOverlaps.flatMap((overlap) => overlap.files))
      }));
    } else if (overlaps.length > 0) {
      preconditions.push(warning("conflict_resolution", "edit_overlap_review_recommended", "Review non-blocking edit overlaps before future execution.", "medium", {
        overlapIds: overlaps.map((overlap) => overlap.id)
      }));
    } else {
      preconditions.push(pass("conflict_resolution", "no_high_edit_overlap", "No remediation required.", "low"));
    }

    if (request.conflictResolutionPlanId) {
      if (!conflictPlan) {
        preconditions.push(missing("conflict_resolution", "conflict_resolution_plan_missing", "Link or regenerate the conflict resolution plan.", "high", {
          conflictResolutionPlanId: request.conflictResolutionPlanId
        }));
      } else if (conflictPlan.status === "blocked" || conflictPlan.status === "review_required" || conflictPlan.status === "draft") {
        preconditions.push(fail("conflict_resolution", `conflict_resolution_plan_${conflictPlan.status}`, "Review and close the conflict resolution plan before future execution.", "critical", {
          conflictResolutionPlanId: conflictPlan.id,
          applyAllowed: conflictPlan.applyAllowed === true
        }));
      } else {
        preconditions.push(pass("conflict_resolution", "conflict_resolution_plan_reviewed_no_apply", "No remediation required.", "medium", {
          conflictResolutionPlanId: conflictPlan.id,
          status: conflictPlan.status,
          applyAllowed: false
        }));
      }
    }

    if (!request.prOwnershipId && !ownership) {
      preconditions.push(missing("pr_ownership", "pr_owner_missing", "Create PR ownership metadata and assign a responsible owner/reviewer.", "high"));
    } else if (ownership && ownership.status !== "owner_present") {
      preconditions.push(fail("pr_ownership", `pr_ownership_${ownership.status}`, "Resolve PR ownership or handoff status before future execution.", "high", {
        ownershipRecordId: ownership.ownershipRecordId,
        status: ownership.status
      }));
    } else {
      preconditions.push(pass("pr_ownership", "pr_owner_present", "No remediation required.", "medium", {
        prOwnershipId: request.prOwnershipId ?? ownership?.ownershipRecordId,
        ownerActorId: ownership?.ownerActorId,
        reviewerActorIds: ownership?.reviewerActorIds ?? []
      }));
    }

    if (request.workspaceLeaseId) {
      if (!workspace) {
        preconditions.push(fail("workspace", "workspace_lease_not_found", "Refresh workspace lifecycle metadata before future execution.", "high", {
          workspaceLeaseId: request.workspaceLeaseId
        }));
      } else if (readyWorkspaceStatuses.has(workspace.status)) {
        preconditions.push(pass("workspace", `workspace_${workspace.status}`, "No remediation required.", "medium", {
          workspaceLeaseId: workspace.id,
          workspacePathRedacted: true
        }));
      } else if (notReadyWorkspaceStatuses.has(workspace.status)) {
        preconditions.push(fail("workspace", `workspace_${workspace.status}`, "Freeze, validate, or complete workspace lifecycle before future execution.", "high", {
          workspaceLeaseId: workspace.id,
          status: workspace.status
        }));
      } else {
        preconditions.push(warning("workspace", `workspace_${workspace.status}`, "Review workspace status before future execution.", "medium", {
          workspaceLeaseId: workspace.id,
          status: workspace.status
        }));
      }
    } else {
      preconditions.push(notApplicable("workspace", "workspace_not_linked_in_request", "Link workspace readiness when future execution requires a workspace.", "medium"));
    }

    if (worktree) {
      const decision = worktree.decision ?? worktree.status ?? "unknown";
      if (decision === "allocated_fixture" || decision === "dry_run_valid" || decision === "ready") {
        preconditions.push(pass("worktree", `worktree_${decision}`, "No remediation required.", "medium", {
          worktreeAllocationId: worktree.id,
          workspaceLeaseId: worktree.workspaceLeaseId
        }));
      } else {
        preconditions.push(warning("worktree", `worktree_${decision}`, "Review worktree allocation metadata before future execution.", "medium", {
          worktreeAllocationId: worktree.id
        }));
      }
    } else {
      preconditions.push(future("worktree", "worktree_allocation_optional_future", "Add production worktree readiness gates in a future task.", "low"));
    }

    preconditions.push(evidencePrecondition("validation", validationStatus, "validation_green_or_not_required", "Run required validation and record green status before future execution."));
    preconditions.push(evidencePrecondition("approval", approvalStatus, "human_approval_present", "Record human merge approval/signoff before future execution."));

    if (tenantScopeStatus === "mismatch") {
      preconditions.push(fail("tenant_scope", "tenant_scope_mismatch", "Align tenant/repo/provider scope metadata before future execution.", "critical"));
    } else if (tenantScopeStatus === "match") {
      preconditions.push(pass("tenant_scope", "tenant_scope_matches", "No remediation required.", "medium"));
    } else if (tenantScopeStatus === "not_applicable") {
      preconditions.push(notApplicable("tenant_scope", "tenant_scope_not_applicable", "No remediation required.", "low"));
    } else {
      preconditions.push(warning("tenant_scope", "tenant_scope_unknown", "Review tenant/repo scope evidence before future execution.", "medium"));
    }

    preconditions.push(evidencePrecondition("rollback", rollbackStatus, "rollback_plan_present", "Create rollback/revert plan metadata before future execution."));

    if (policyRead.allowed && policyEvaluate.allowed && policyRequest.allowed && !policyExecuteFuture.allowed) {
      preconditions.push(pass("policy", "policy_allows_metadata_and_denies_execution", "No remediation required.", "medium", {
        policyRead,
        policyEvaluate,
        policyRequest,
        policyExecuteFuture
      }));
    } else {
      preconditions.push(fail("policy", "policy_not_satisfied", "Policy must allow metadata evaluation/request and deny future execution in v1.", "critical", {
        policyRead,
        policyEvaluate,
        policyRequest,
        policyExecuteFuture
      }));
    }

    if (request.requestedByActorId && request.requestedByActorId !== "system") {
      preconditions.push(pass("auth", "request_actor_attributed", "No remediation required.", "medium", {
        actorId: request.requestedByActorId,
        principalId: request.requestedByPrincipalId
      }));
    } else {
      preconditions.push(warning("auth", "request_actor_system_or_missing", "Use RequestContext/AuthContext attribution for future merge requests.", "medium", {
        actorId: request.requestedByActorId
      }));
    }

    if (request.requestId && request.correlationId) {
      preconditions.push(pass("observability", "request_and_correlation_ids_present", "No remediation required.", "medium", {
        requestId: request.requestId,
        correlationId: request.correlationId
      }));
    } else {
      preconditions.push(warning("observability", "request_or_correlation_id_missing", "Record request and correlation ids before future execution.", "medium", {
        requestIdPresent: Boolean(request.requestId),
        correlationIdPresent: Boolean(request.correlationId)
      }));
    }

    return preconditions.map((precondition, index) => ({
      id: `real_merge_precondition_${request.id}_${index + 1}_${precondition.category}`,
      requestId: request.id,
      category: precondition.category,
      status: precondition.status,
      required: precondition.required,
      severity: precondition.severity,
      evidence: precondition.evidence,
      remediation: precondition.remediation,
      metadata: sanitizeMetadata(precondition.metadata ?? {})
    }));
  }
}

function chooseDecision(
  preconditions: RealMergePrecondition[],
  policyRead: RealMergePolicyDecisionSnapshot,
  policyEvaluate: RealMergePolicyDecisionSnapshot,
  policyRequest: RealMergePolicyDecisionSnapshot,
  policyExecuteFuture: RealMergePolicyDecisionSnapshot,
  input: EvaluateRealMergeExecutionRequestInput
): RealMergeExecutionDecisionValue {
  if (!input.mergeQueueEntryId &&
    !input.branchLeaseId &&
    !input.dryRunMergeId &&
    !input.prOwnershipId &&
    !input.workspaceLeaseId) {
    return "denied_default";
  }
  if (!policyRead.allowed || !policyEvaluate.allowed || !policyRequest.allowed || policyExecuteFuture.allowed) {
    return "blocked_policy_denied";
  }
  if (hasFail(preconditions, "tenant_scope")) return "blocked_scope_mismatch";
  if (hasBlocking(preconditions, "branch_lease")) return "blocked_branch_lease_invalid";
  if (hasBlocking(preconditions, "pr_ownership")) return "blocked_no_owner";
  if (hasFail(preconditions, "workspace")) return "blocked_workspace_not_ready";
  if (hasBlocking(preconditions, "dry_run")) return "blocked_missing_dry_run";
  if (preconditions.some((precondition) =>
    precondition.category === "conflict_resolution" &&
    precondition.required &&
    precondition.status === "fail" &&
    (precondition.evidence.includes("conflict_risk") || precondition.evidence.includes("edit_overlap") || precondition.evidence.includes("plan_")))) {
    return "blocked_conflict_risk";
  }
  if (hasBlocking(preconditions, "approval")) return "blocked_missing_approval";
  if (preconditions.some((precondition) => precondition.required && (precondition.status === "fail" || precondition.status === "missing"))) {
    return "denied_default";
  }
  return "ready_for_manual_future";
}

function hasBlocking(preconditions: RealMergePrecondition[], category: RealMergePreconditionCategory): boolean {
  return preconditions.some((precondition) =>
    precondition.category === category &&
    precondition.required &&
    (precondition.status === "fail" || precondition.status === "missing"));
}

function hasFail(preconditions: RealMergePrecondition[], category: RealMergePreconditionCategory): boolean {
  return preconditions.some((precondition) =>
    precondition.category === category &&
    precondition.required &&
    precondition.status === "fail");
}

function requiredActionsFor(preconditions: RealMergePrecondition[], decision: RealMergeExecutionDecisionValue): string[] {
  const actions = preconditions
    .filter((precondition) => precondition.required && (precondition.status === "fail" || precondition.status === "missing"))
    .map((precondition) => precondition.remediation);
  if (decision === "ready_for_manual_future") {
    actions.push("Keep execution disabled until a future explicit approval/execution profile is implemented.");
  }
  actions.push("Do not run real merge, remote push, auto-merge, force-push, rebase, branch deletion, or workspace mutation in v1.");
  return unique(actions);
}

function evidencePrecondition(
  category: "validation" | "approval" | "rollback",
  status: RealMergeEvidenceStatus | undefined,
  passEvidence: string,
  remediation: string
): PreconditionInput {
  if (status === "passed" || status === "approved" || status === "not_required") {
    return pass(category, passEvidence, "No remediation required.", "medium", { status });
  }
  if (status === "failed" || status === "rejected") {
    return fail(category, `${category}_${status}`, remediation, category === "rollback" ? "high" : "critical", { status });
  }
  return missing(category, `${category}_missing`, remediation, category === "rollback" ? "high" : "critical", { status: status ?? "missing" });
}

function pass(
  category: RealMergePreconditionCategory,
  evidence: string,
  remediation: string,
  severity: RealMergePreconditionSeverity,
  metadata?: Record<string, unknown>
): PreconditionInput {
  return { category, status: "pass", required: true, severity, evidence, remediation, metadata };
}

function warning(
  category: RealMergePreconditionCategory,
  evidence: string,
  remediation: string,
  severity: RealMergePreconditionSeverity,
  metadata?: Record<string, unknown>
): PreconditionInput {
  return { category, status: "warning", required: false, severity, evidence, remediation, metadata };
}

function fail(
  category: RealMergePreconditionCategory,
  evidence: string,
  remediation: string,
  severity: RealMergePreconditionSeverity,
  metadata?: Record<string, unknown>
): PreconditionInput {
  return { category, status: "fail", required: true, severity, evidence, remediation, metadata };
}

function missing(
  category: RealMergePreconditionCategory,
  evidence: string,
  remediation: string,
  severity: RealMergePreconditionSeverity,
  metadata?: Record<string, unknown>
): PreconditionInput {
  return { category, status: "missing", required: true, severity, evidence, remediation, metadata };
}

function future(
  category: RealMergePreconditionCategory,
  evidence: string,
  remediation: string,
  severity: RealMergePreconditionSeverity,
  metadata?: Record<string, unknown>
): PreconditionInput {
  return { category, status: "future", required: false, severity, evidence, remediation, metadata };
}

function notApplicable(
  category: RealMergePreconditionCategory,
  evidence: string,
  remediation: string,
  severity: RealMergePreconditionSeverity,
  metadata?: Record<string, unknown>
): PreconditionInput {
  return { category, status: "not_applicable", required: false, severity, evidence, remediation, metadata };
}

function evidenceStatusFromMetadata(
  metadata: Record<string, unknown> | undefined,
  key: string
): RealMergeEvidenceStatus | undefined {
  const value = metadata?.[key];
  return isEvidenceStatus(value) ? value : undefined;
}

function rollbackStatusFromMetadata(metadata: Record<string, unknown> | undefined): RealMergeEvidenceStatus | undefined {
  const status = evidenceStatusFromMetadata(metadata, "rollbackPlanStatus");
  if (status) return status;
  if (metadata?.rollbackPlanPresent === true) return "passed";
  if (metadata?.rollbackPlanPresent === false) return "missing";
  return undefined;
}

function tenantScopeStatusFromMetadata(
  metadata: Record<string, unknown> | undefined
): RealMergeExecutionContext["tenantScopeStatus"] | undefined {
  const status = metadata?.tenantScopeStatus;
  if (status === "match" || status === "mismatch" || status === "unknown" || status === "not_applicable") {
    return status;
  }
  if (metadata?.tenantScopeMatch === true) return "match";
  if (metadata?.tenantScopeMatch === false) return "mismatch";
  return undefined;
}

function isEvidenceStatus(value: unknown): value is RealMergeEvidenceStatus {
  return value === "passed" ||
    value === "approved" ||
    value === "not_required" ||
    value === "pending" ||
    value === "failed" ||
    value === "rejected" ||
    value === "missing";
}

function forbiddenReason(operation: RealMergeForbiddenOperationKind): string {
  switch (operation) {
    case "auto_merge":
      return "Auto-merge remains disabled in Real Merge Execution Policy v1.";
    case "remote_push":
      return "Remote push is not part of the v1 policy/readiness boundary.";
    case "force_push":
      return "Force-push is destructive and remains forbidden.";
    case "rebase":
      return "Rebase is out of scope for the v1 boundary.";
    case "branch_delete":
      return "Branch deletion remains a future cleanup boundary and is not merge execution.";
    case "worktree_delete":
      return "Worktree deletion remains disabled outside explicit future cleanup gates.";
    case "bypass_policy":
      return "Policy deny decisions must win.";
    case "bypass_approval":
      return "Human approval/signoff cannot be bypassed.";
    case "bypass_dry_run":
      return "Clean dry-run merge evidence cannot be bypassed.";
  }
}

function contextMetadata(context: RealMergeExecutionContext): Record<string, unknown> {
  return {
    requestId: context.requestId,
    correlationId: context.correlationId,
    actorId: context.actorId,
    principalId: context.principalId,
    serviceAccountId: context.serviceAccountId,
    source: context.source,
    roles: context.roles,
    teams: context.teams,
    ...context.metadata
  };
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(metadata) as Record<string, unknown>;
}

function sanitizeValue(value: unknown, key = ""): unknown {
  if (key && isSensitiveKey(key)) return "[redacted]";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (typeof value === "string") {
    if (containsSecretLikeValue(value)) return "[redacted]";
    return value.length > 2000 ? `${value.slice(0, 2000)}...` : value;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([entryKey, entryValue]) => [entryKey, sanitizeValue(entryValue, entryKey)]));
  }
  return value;
}

function isSensitiveKey(key: string): boolean {
  return /token|secret|password|credential|api[_-]?key|private[_-]?key|vault/i.test(key);
}

function containsSecretLikeValue(value: string): boolean {
  return /(OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|VAULT_TOKEN|PASSWORD|SECRET|TOKEN|PRIVATE_KEY)\s*=/i.test(value);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function clonePolicy(policy: RealMergeExecutionPolicy): RealMergeExecutionPolicy {
  return {
    ...policy,
    requiredEvidence: [...policy.requiredEvidence],
    requiredApprovals: [...policy.requiredApprovals],
    requiredChecks: [...policy.requiredChecks],
    forbiddenOperations: [...policy.forbiddenOperations],
    allowedFutureModes: [...policy.allowedFutureModes],
    metadata: sanitizeMetadata(policy.metadata)
  };
}

function cloneRequest(request: RealMergeExecutionRequest): RealMergeExecutionRequest {
  return {
    ...request,
    createdAt: new Date(request.createdAt),
    metadata: sanitizeMetadata(request.metadata)
  };
}

function cloneDecision(decision: RealMergeExecutionDecision): RealMergeExecutionDecision {
  return {
    ...decision,
    reasons: [...decision.reasons],
    blockingReasons: [...decision.blockingReasons],
    warnings: [...decision.warnings],
    requiredActions: [...decision.requiredActions],
    createdAt: new Date(decision.createdAt),
    metadata: sanitizeMetadata(decision.metadata)
  };
}

function clonePrecondition(precondition: RealMergePrecondition): RealMergePrecondition {
  return {
    ...precondition,
    metadata: sanitizeMetadata(precondition.metadata)
  };
}

function cloneForbiddenOperation(operation: RealMergeForbiddenOperation): RealMergeForbiddenOperation {
  return {
    ...operation,
    metadata: sanitizeMetadata(operation.metadata)
  };
}

function clonePostEvidenceTemplate(template: RealMergePostExecutionEvidenceTemplate): RealMergePostExecutionEvidenceTemplate {
  return {
    ...template,
    requiredFields: [...template.requiredFields],
    healthChecks: [...template.healthChecks],
    validationChecks: [...template.validationChecks],
    auditRequirements: [...template.auditRequirements],
    metadata: sanitizeMetadata(template.metadata)
  };
}
