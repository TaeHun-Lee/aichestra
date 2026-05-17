import { createId } from "../domain/ids.ts";
import type {
  BranchLease,
  ConflictRisk,
  MergeQueueEntry,
  MergeSimulationResult
} from "../domain/models.ts";

export type MergeQueuePolicyStatus = "active_mock" | "disabled" | "future";
export type MergeReadinessDecisionValue =
  | "ready"
  | "hold"
  | "blocked"
  | "warning"
  | "needs_human_review"
  | "future_manual_merge";
export type MergeQueuePriorityRuleKind =
  | "lower_conflict_first"
  | "older_first"
  | "smaller_diff_first"
  | "dependency_order"
  | "human_priority"
  | "release_blocker";
export type MergeQueueHoldKind =
  | "conflict_risk"
  | "dry_run_failed"
  | "validation_missing"
  | "approval_missing"
  | "workspace_not_ready"
  | "branch_lease_expired"
  | "edit_overlap"
  | "policy_denied"
  | "human_review_required";
export type MergeQueueHoldSeverity = "low" | "medium" | "high" | "critical";

export type MergeQueuePolicy = {
  id: string;
  name: string;
  status: MergeQueuePolicyStatus;
  requiredChecks: string[];
  blockingConditions: string[];
  warningConditions: string[];
  priorityRules: MergeQueuePriorityRule[];
  retryRules: string[];
  metadata: Record<string, unknown>;
};

export type MergeReadinessDecision = {
  id: string;
  queueEntryId: string;
  branchName: string;
  repoId: string;
  decision: MergeReadinessDecisionValue;
  reasons: string[];
  blockingReasons: string[];
  warnings: string[];
  requiredActions: string[];
  priority: number;
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  serviceAccountId?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type MergeQueuePriorityRule = {
  id: string;
  ruleKind: MergeQueuePriorityRuleKind;
  weight: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
};

export type MergeQueueHold = {
  id: string;
  queueEntryId: string;
  holdKind: MergeQueueHoldKind;
  severity: MergeQueueHoldSeverity;
  reason: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type MergeQueueWorkspaceSnapshot = {
  id: string;
  repoId: string;
  branchLeaseId?: string;
  taskRunId?: string;
  branchName?: string;
  status: string;
  isolationStatus?: string;
  workspaceKind?: string;
  updatedAt?: Date;
  metadata?: Record<string, unknown>;
};

export type MergeQueueEditOverlapSnapshot = {
  id: string;
  repoId: string;
  sessionAId: string;
  sessionBId: string;
  overlapKind: string;
  files: string[];
  severity: string;
  recommendation: string;
  metadata?: Record<string, unknown>;
};

export type MergeQueueEvidenceStatus =
  | "passed"
  | "approved"
  | "not_required"
  | "pending"
  | "failed"
  | "rejected"
  | "missing";

export type MergeQueuePolicyContext = {
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  serviceAccountId?: string;
  validationStatus?: MergeQueueEvidenceStatus;
  approvalStatus?: MergeQueueEvidenceStatus;
  humanPriority?: number;
  releaseBlocker?: boolean;
  metadata?: Record<string, unknown>;
  persist?: boolean;
};

export type MergeQueuePolicyDecisionSnapshot = {
  allowed: boolean;
  decision?: string;
  reason?: string;
  policyDecisionId?: string;
  matchedRuleIds?: string[];
};

export type MergeQueuePolicyAction =
  | "merge_queue.read"
  | "merge_queue.evaluate"
  | "merge_queue.hold"
  | "merge_queue.release_hold"
  | "merge_queue.merge_execute_future";

export type MergeQueuePolicyEvaluationInput = {
  action: MergeQueuePolicyAction;
  entry?: MergeQueueEntry;
  lease?: BranchLease;
  context: MergeQueuePolicyContext;
  metadata: Record<string, unknown>;
};

export type MergeQueuePolicyDataSource = {
  getMergeQueueEntry(id: string): MergeQueueEntry | undefined;
  listMergeQueueEntries(repoId?: string): MergeQueueEntry[];
  getBranchLease(id: string): BranchLease | undefined;
  highestConflictRiskForLease(leaseId: string): ConflictRisk | undefined;
  latestMergeSimulationForLease(leaseId: string): MergeSimulationResult | undefined;
};

export type MergeQueuePolicyServiceOptions = {
  dataSource: MergeQueuePolicyDataSource;
  policy?: MergeQueuePolicy;
  policyEvaluator?: (input: MergeQueuePolicyEvaluationInput) => MergeQueuePolicyDecisionSnapshot;
  workspaceSnapshotProvider?: (entry: MergeQueueEntry, lease?: BranchLease) => MergeQueueWorkspaceSnapshot[];
  editOverlapProvider?: (entry: MergeQueueEntry, lease?: BranchLease) => MergeQueueEditOverlapSnapshot[];
  now?: () => Date;
};

export type MergeQueuePolicyPreview = {
  policy: MergeQueuePolicy;
  decisions: MergeReadinessDecision[];
  holds: MergeQueueHold[];
  summary: MergeQueuePolicySummary;
};

export type MergeQueuePolicySummary = {
  repoId?: string;
  policyId: string;
  policyStatus: MergeQueuePolicyStatus;
  queueEntries: number;
  ready: number;
  warning: number;
  hold: number;
  blocked: number;
  needsHumanReview: number;
  futureManualMerge: number;
  activeHolds: number;
  mergeExecutionEnabled: false;
  remoteGitOperation: false;
  autoMergeEnabled: false;
  branchDeletionEnabled: false;
  secretsExposed: false;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

type EvaluatedEntry = {
  decision: MergeReadinessDecision;
  holds: MergeQueueHold[];
};

type HoldInput = {
  holdKind: MergeQueueHoldKind;
  severity: MergeQueueHoldSeverity;
  reason: string;
  metadata?: Record<string, unknown>;
};

const readyWorkspaceStatuses = new Set(["ready_for_merge", "merged"]);
const notReadyWorkspaceStatuses = new Set(["requested", "allocated", "active", "frozen", "cleanup_pending", "failed", "abandoned"]);
const severeOverlapKinds = new Set(["same_file", "same_workspace"]);
const severeOverlapRecommendations = new Set(["serialize", "split_files", "require_review", "block"]);
const severeOverlapSeverities = new Set(["high", "critical"]);
const activeEntryStatuses = new Set(["queued", "ready", "blocked"]);

const decisionRank: Record<MergeReadinessDecisionValue, number> = {
  ready: 0,
  warning: 1,
  hold: 2,
  needs_human_review: 3,
  blocked: 4,
  future_manual_merge: 5
};

const defaultPriorityRules: MergeQueuePriorityRule[] = [
  { id: "merge_queue_policy_lower_conflict_first", ruleKind: "lower_conflict_first", weight: 1000, enabled: true, metadata: { deterministic: true } },
  { id: "merge_queue_policy_older_first", ruleKind: "older_first", weight: 25, enabled: true, metadata: { deterministic: true } },
  { id: "merge_queue_policy_smaller_diff_first", ruleKind: "smaller_diff_first", weight: 10, enabled: true, metadata: { deterministic: true } },
  { id: "merge_queue_policy_dependency_order", ruleKind: "dependency_order", weight: 100, enabled: true, metadata: { metadataOnly: true } },
  { id: "merge_queue_policy_human_priority", ruleKind: "human_priority", weight: 250, enabled: true, metadata: { metadataOnly: true } },
  { id: "merge_queue_policy_release_blocker", ruleKind: "release_blocker", weight: 500, enabled: true, metadata: { metadataOnly: true } }
];

export function createDefaultMergeQueuePolicy(): MergeQueuePolicy {
  return {
    id: "merge_queue_policy_v2_default",
    name: "Merge Queue Policy v2 Default Mock Policy",
    status: "active_mock",
    requiredChecks: [
      "branch_lease_active",
      "policy_evaluate_allowed",
      "merge_execution_future_denied",
      "validation_passed_or_not_required",
      "approval_approved_or_not_required",
      "dry_run_clean",
      "workspace_ready_when_present",
      "no_high_conflict_risk",
      "no_same_file_edit_overlap"
    ],
    blockingConditions: [
      "policy_denied",
      "branch_lease_expired",
      "dry_run_text_conflict",
      "dry_run_failed",
      "validation_failed",
      "approval_rejected"
    ],
    warningConditions: [
      "workspace_metadata_missing",
      "coordination_metadata_missing",
      "dry_run_missing",
      "medium_conflict_risk"
    ],
    priorityRules: defaultPriorityRules,
    retryRules: [
      "re_evaluate_after_validation_passed",
      "re_evaluate_after_approval_recorded",
      "re_evaluate_after_workspace_ready_for_merge",
      "re_evaluate_after_dry_run_clean",
      "re_evaluate_after_overlap_resolved"
    ],
    metadata: {
      implementedStatus: "v2_implemented",
      mockFirst: true,
      metadataOnly: true,
      mergeExecutionEnabled: false,
      remoteGitOperation: false,
      autoMergeEnabled: false,
      forcePushEnabled: false,
      rebaseEnabled: false,
      branchDeletionEnabled: false,
      externalProviderCalls: false,
      secretsExposed: false,
      envValuesExposed: false
    }
  };
}

export class MergeQueuePolicyService {
  private readonly dataSource: MergeQueuePolicyDataSource;
  private readonly policy: MergeQueuePolicy;
  private readonly policyEvaluator?: (input: MergeQueuePolicyEvaluationInput) => MergeQueuePolicyDecisionSnapshot;
  private readonly workspaceSnapshotProvider?: (entry: MergeQueueEntry, lease?: BranchLease) => MergeQueueWorkspaceSnapshot[];
  private readonly editOverlapProvider?: (entry: MergeQueueEntry, lease?: BranchLease) => MergeQueueEditOverlapSnapshot[];
  private readonly now: () => Date;
  private readonly decisions: MergeReadinessDecision[] = [];
  private readonly holds: MergeQueueHold[] = [];

  constructor(options: MergeQueuePolicyServiceOptions) {
    this.dataSource = options.dataSource;
    this.policy = options.policy ?? createDefaultMergeQueuePolicy();
    this.policyEvaluator = options.policyEvaluator;
    this.workspaceSnapshotProvider = options.workspaceSnapshotProvider;
    this.editOverlapProvider = options.editOverlapProvider;
    this.now = options.now ?? (() => new Date());
  }

  getPolicy(): MergeQueuePolicy {
    return clone(this.policy);
  }

  evaluateEntry(entryId: string, context: MergeQueuePolicyContext = {}): MergeReadinessDecision {
    const entry = required(this.dataSource.getMergeQueueEntry(entryId), `Merge queue entry not found: ${entryId}`);
    return this.evaluateEntryInternal(entry, { ...context, persist: context.persist ?? true }).decision;
  }

  evaluateQueue(repoId?: string, context: MergeQueuePolicyContext = {}): MergeReadinessDecision[] {
    return this.dataSource.listMergeQueueEntries(repoId)
      .filter((entry) => activeEntryStatuses.has(entry.status))
      .map((entry) => this.evaluateEntryInternal(entry, { ...context, persist: context.persist ?? true }).decision)
      .sort(compareDecisions);
  }

  rankQueue(repoId?: string, context: MergeQueuePolicyContext = {}): MergeReadinessDecision[] {
    return this.evaluateQueue(repoId, { ...context, persist: context.persist ?? false });
  }

  previewQueue(repoId?: string, context: MergeQueuePolicyContext = {}): MergeQueuePolicyPreview {
    const evaluated = this.dataSource.listMergeQueueEntries(repoId)
      .filter((entry) => activeEntryStatuses.has(entry.status))
      .map((entry) => this.evaluateEntryInternal(entry, { ...context, persist: false }))
      .sort((left, right) => compareDecisions(left.decision, right.decision));
    const decisions = evaluated.map((entry) => entry.decision);
    const previewHolds = evaluated.flatMap((entry) => entry.holds);
    return {
      policy: this.getPolicy(),
      decisions,
      holds: previewHolds,
      summary: this.summaryFromDecisions(repoId, decisions, previewHolds)
    };
  }

  holdEntry(entryId: string, hold: HoldInput, context: MergeQueuePolicyContext = {}): MergeQueueHold {
    const entry = required(this.dataSource.getMergeQueueEntry(entryId), `Merge queue entry not found: ${entryId}`);
    const policyDecision = this.evaluatePolicy("merge_queue.hold", entry, this.dataSource.getBranchLease(entry.branchLeaseId), context, {
      holdKind: hold.holdKind,
      metadataOnly: true
    });
    if (!policyDecision.allowed) {
      return this.upsertHold(entry.id, {
        holdKind: "policy_denied",
        severity: "critical",
        reason: "merge_queue_hold_policy_denied",
        metadata: {
          policyDecisionId: policyDecision.policyDecisionId,
          policyReason: policyDecision.reason,
          requestedHoldKind: hold.holdKind
        }
      }, context, true);
    }
    return this.upsertHold(entry.id, hold, context, true);
  }

  releaseHold(entryId: string, holdId: string, context: MergeQueuePolicyContext = {}): MergeQueueHold {
    const entry = required(this.dataSource.getMergeQueueEntry(entryId), `Merge queue entry not found: ${entryId}`);
    const hold = required(this.holds.find((candidate) => candidate.id === holdId && candidate.queueEntryId === entryId), `Merge queue hold not found: ${holdId}`);
    const policyDecision = this.evaluatePolicy("merge_queue.release_hold", entry, this.dataSource.getBranchLease(entry.branchLeaseId), context, {
      holdId,
      holdKind: hold.holdKind,
      metadataOnly: true
    });
    if (!policyDecision.allowed) {
      return this.upsertHold(entry.id, {
        holdKind: "policy_denied",
        severity: "critical",
        reason: "merge_queue_release_hold_policy_denied",
        metadata: {
          policyDecisionId: policyDecision.policyDecisionId,
          policyReason: policyDecision.reason,
          requestedHoldId: holdId
        }
      }, context, true);
    }
    const released = {
      ...hold,
      metadata: sanitizeMetadata({
        ...hold.metadata,
        releasedAt: this.now().toISOString(),
        releasedBy: context.actorId ?? context.serviceAccountId ?? "system",
        releaseRequestId: context.requestId,
        releaseCorrelationId: context.correlationId,
        policyDecisionId: policyDecision.policyDecisionId
      })
    };
    this.replaceHold(released);
    return clone(released);
  }

  listDecisions(query: { repoId?: string; queueEntryId?: string } = {}): MergeReadinessDecision[] {
    return this.decisions
      .filter((decision) =>
        (query.repoId === undefined || decision.repoId === query.repoId) &&
        (query.queueEntryId === undefined || decision.queueEntryId === query.queueEntryId))
      .sort(compareDecisions)
      .map((decision) => clone(decision));
  }

  listHolds(query: { repoId?: string; queueEntryId?: string; activeOnly?: boolean } = {}): MergeQueueHold[] {
    const repoEntryIds = query.repoId
      ? new Set(this.dataSource.listMergeQueueEntries(query.repoId).map((entry) => entry.id))
      : undefined;
    return this.holds
      .filter((hold) =>
        (query.queueEntryId === undefined || hold.queueEntryId === query.queueEntryId) &&
        (repoEntryIds === undefined || repoEntryIds.has(hold.queueEntryId)) &&
        (query.activeOnly !== true || !hasReleasedAt(hold)))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((hold) => clone(hold));
  }

  getQueueSummary(repoId?: string, context: MergeQueuePolicyContext = {}): MergeQueuePolicySummary {
    const preview = this.previewQueue(repoId, context);
    return preview.summary;
  }

  private evaluateEntryInternal(entry: MergeQueueEntry, context: MergeQueuePolicyContext): EvaluatedEntry {
    const lease = this.dataSource.getBranchLease(entry.branchLeaseId);
    const conflictRisk = lease ? this.dataSource.highestConflictRiskForLease(lease.id) : undefined;
    const simulation = lease ? this.dataSource.latestMergeSimulationForLease(lease.id) : undefined;
    const workspaceEvidenceAvailable = this.workspaceSnapshotProvider !== undefined;
    const editOverlapEvidenceAvailable = this.editOverlapProvider !== undefined;
    const workspaces = this.workspaceSnapshotProvider?.(entry, lease) ?? [];
    const overlaps = this.editOverlapProvider?.(entry, lease) ?? [];
    const validationStatus = normalizeEvidenceStatus(context.validationStatus ?? metadataString(context.metadata, "validationStatus"));
    const approvalStatus = normalizeEvidenceStatus(context.approvalStatus ?? metadataString(context.metadata, "approvalStatus"));
    const humanPriority = numberValue(context.humanPriority ?? context.metadata?.humanPriority);
    const releaseBlocker = context.releaseBlocker === true || context.metadata?.releaseBlocker === true;
    const policyDecision = this.evaluatePolicy("merge_queue.evaluate", entry, lease, context, {
      riskScore: conflictRisk?.riskScore ?? entry.riskScore,
      metadataOnly: true
    });
    const mergeExecutionDecision = this.evaluatePolicy("merge_queue.merge_execute_future", entry, lease, context, {
      requestedExecution: "future_manual_merge",
      metadataOnly: true
    });

    const reasons = uniqueStrings([
      "merge_queue_policy_v2_evaluated",
      ...entry.reasons,
      ...(conflictRisk?.reasons ?? [])
    ]);
    const blockingReasons = [...entry.blockingReasons];
    const warnings: string[] = [];
    const requiredActions: string[] = [];
    const holdInputs: HoldInput[] = [];

    if (!policyDecision.allowed) {
      blockingReasons.push("policy_denied");
      requiredActions.push("resolve_policy_denial");
      holdInputs.push({
        holdKind: "policy_denied",
        severity: "critical",
        reason: "merge_queue_policy_evaluate_denied",
        metadata: { policyDecisionId: policyDecision.policyDecisionId, policyReason: policyDecision.reason }
      });
    }

    if (mergeExecutionDecision.allowed) {
      blockingReasons.push("merge_execution_policy_unexpectedly_allowed");
      requiredActions.push("review_merge_execution_policy");
      holdInputs.push({
        holdKind: "policy_denied",
        severity: "critical",
        reason: "merge_execution_future_must_remain_denied",
        metadata: { policyDecisionId: mergeExecutionDecision.policyDecisionId }
      });
    }

    if (!lease) {
      blockingReasons.push("branch_lease_missing");
      requiredActions.push("restore_branch_lease_metadata");
      holdInputs.push({
        holdKind: "branch_lease_expired",
        severity: "critical",
        reason: "branch_lease_missing",
        metadata: {}
      });
    } else if (lease.status === "expired") {
      blockingReasons.push("branch_lease_expired");
      requiredActions.push("renew_or_recreate_branch_lease");
      holdInputs.push({
        holdKind: "branch_lease_expired",
        severity: "critical",
        reason: "branch_lease_expired",
        metadata: { branchLeaseStatus: lease.status }
      });
    } else if (lease.status !== "active") {
      blockingReasons.push("branch_lease_not_active");
      requiredActions.push("review_branch_lease_status");
      holdInputs.push({
        holdKind: "branch_lease_expired",
        severity: "high",
        reason: "branch_lease_not_active",
        metadata: { branchLeaseStatus: lease.status }
      });
    }

    if (!simulation) {
      warnings.push("dry_run_missing");
      requiredActions.push("run_mock_or_allowlisted_local_dry_run");
      holdInputs.push({
        holdKind: "dry_run_failed",
        severity: "medium",
        reason: "dry_run_missing",
        metadata: {}
      });
    } else if (simulation.status === "text_conflict") {
      blockingReasons.push("dry_run_text_conflict");
      requiredActions.push("resolve_dry_run_conflict_before_merge");
      holdInputs.push({
        holdKind: "dry_run_failed",
        severity: "critical",
        reason: "dry_run_text_conflict",
        metadata: { simulationId: simulation.id, simulationStatus: simulation.status }
      });
    } else if (simulation.status === "failed") {
      blockingReasons.push("dry_run_failed");
      requiredActions.push("human_review_dry_run_failure");
      holdInputs.push({
        holdKind: "dry_run_failed",
        severity: "high",
        reason: "dry_run_failed",
        metadata: { simulationId: simulation.id, simulationStatus: simulation.status }
      });
    } else if (simulation.status === "unavailable") {
      warnings.push("dry_run_unavailable");
      requiredActions.push("rerun_dry_run_or_manual_review");
      holdInputs.push({
        holdKind: "dry_run_failed",
        severity: "medium",
        reason: "dry_run_unavailable",
        metadata: { simulationId: simulation.id, simulationStatus: simulation.status }
      });
    }

    const riskScore = Math.max(conflictRisk?.riskScore ?? 0, entry.conflictRiskScore ?? 0, entry.riskScore ?? 0);
    if (riskScore >= 0.65) {
      requiredActions.push(riskScore >= 0.85 ? "human_review_critical_conflict_risk" : "serialize_or_review_high_conflict_risk");
      holdInputs.push({
        holdKind: "conflict_risk",
        severity: riskScore >= 0.85 ? "critical" : "high",
        reason: riskScore >= 0.85 ? "critical_conflict_risk" : "high_conflict_risk",
        metadata: {
          riskScore,
          riskLevel: conflictRisk?.riskLevel,
          riskId: conflictRisk?.id
        }
      });
    } else if (riskScore >= 0.35) {
      warnings.push("medium_conflict_risk");
    }

    if (validationStatus === "missing" || validationStatus === "pending") {
      requiredActions.push("record_validation_result");
      holdInputs.push({
        holdKind: "validation_missing",
        severity: "medium",
        reason: "validation_missing",
        metadata: { validationStatus }
      });
    } else if (validationStatus === "failed") {
      blockingReasons.push("validation_failed");
      requiredActions.push("fix_failed_validation");
      holdInputs.push({
        holdKind: "validation_missing",
        severity: "high",
        reason: "validation_failed",
        metadata: { validationStatus }
      });
    }

    if (approvalStatus === "missing" || approvalStatus === "pending") {
      requiredActions.push("record_required_approval");
      holdInputs.push({
        holdKind: "approval_missing",
        severity: "medium",
        reason: "approval_missing",
        metadata: { approvalStatus }
      });
    } else if (approvalStatus === "rejected") {
      blockingReasons.push("approval_rejected");
      requiredActions.push("resolve_rejected_approval");
      holdInputs.push({
        holdKind: "approval_missing",
        severity: "high",
        reason: "approval_rejected",
        metadata: { approvalStatus }
      });
    }

    if (workspaceEvidenceAvailable && workspaces.length === 0) {
      warnings.push("workspace_metadata_missing");
    } else if (!workspaces.some((workspace) => readyWorkspaceStatuses.has(workspace.status))) {
      const worstWorkspace = workspaces.find((workspace) => notReadyWorkspaceStatuses.has(workspace.status)) ?? workspaces[0];
      requiredActions.push("mark_workspace_ready_for_merge");
      holdInputs.push({
        holdKind: "workspace_not_ready",
        severity: worstWorkspace?.status === "failed" ? "critical" : "high",
        reason: "workspace_not_ready",
        metadata: {
          workspaceLeaseId: worstWorkspace?.id,
          workspaceStatus: worstWorkspace?.status,
          isolationStatus: worstWorkspace?.isolationStatus,
          workspaceKind: worstWorkspace?.workspaceKind
        }
      });
    }
    const sharedWorkspace = workspaces.find((workspace) => workspace.isolationStatus === "shared_forbidden");
    if (sharedWorkspace) {
      requiredActions.push("assign_isolated_workspace");
      holdInputs.push({
        holdKind: "workspace_not_ready",
        severity: "critical",
        reason: "shared_workspace_forbidden",
        metadata: {
          workspaceLeaseId: sharedWorkspace.id,
          workspaceStatus: sharedWorkspace.status,
          isolationStatus: sharedWorkspace.isolationStatus
        }
      });
    }

    const severeOverlaps = overlaps.filter(isSevereOverlap);
    for (const overlap of severeOverlaps) {
      requiredActions.push(overlap.overlapKind === "same_file" ? "resolve_same_file_edit_overlap" : "resolve_coordination_overlap");
      holdInputs.push({
        holdKind: "edit_overlap",
        severity: overlap.severity === "critical" ? "critical" : "high",
        reason: overlap.overlapKind === "same_file" ? "same_file_edit_overlap" : overlap.overlapKind,
        metadata: {
          overlapId: overlap.id,
          overlapKind: overlap.overlapKind,
          severity: overlap.severity,
          recommendation: overlap.recommendation,
          files: overlap.files
        }
      });
    }
    if (!editOverlapEvidenceAvailable) {
      warnings.push("coordination_metadata_missing");
    }

    const manualHolds = this.activeHoldsForEntry(entry.id);
    for (const hold of manualHolds.filter((hold) => hold.holdKind === "human_review_required")) {
      requiredActions.push("complete_human_review");
      holdInputs.push({
        holdKind: hold.holdKind,
        severity: hold.severity,
        reason: hold.reason,
        metadata: hold.metadata
      });
    }

    const decisionValue = chooseDecision(blockingReasons, holdInputs, warnings, simulation);
    if (decisionValue === "ready" || decisionValue === "warning") {
      requiredActions.push("manual_merge_future_gate_required");
    }

    const priority = this.computePriority(entry, decisionValue, riskScore, simulation, humanPriority, releaseBlocker);
    const holds = holdInputs.map((hold) => this.upsertHold(entry.id, hold, context, context.persist === true));
    const createdAt = this.now();
    const decision: MergeReadinessDecision = {
      id: createId("mergedec"),
      queueEntryId: entry.id,
      branchName: entry.branchName,
      repoId: entry.repoId,
      decision: decisionValue,
      reasons: uniqueStrings(reasons),
      blockingReasons: uniqueStrings(blockingReasons),
      warnings: uniqueStrings(warnings),
      requiredActions: uniqueStrings(requiredActions),
      priority,
      requestId: context.requestId,
      correlationId: context.correlationId,
      actorId: context.actorId,
      serviceAccountId: context.serviceAccountId,
      createdAt,
      metadata: sanitizeMetadata({
        policyId: this.policy.id,
        policyStatus: this.policy.status,
        branchLeaseId: entry.branchLeaseId,
        branchLeaseStatus: lease?.status ?? "missing",
        conflictRiskId: conflictRisk?.id,
        conflictRiskScore: riskScore,
        conflictRiskLevel: conflictRisk?.riskLevel,
        simulationId: simulation?.id,
        simulationStatus: simulation?.status ?? "missing",
        validationStatus,
        approvalStatus,
        workspaceStatuses: workspaces.map((workspace) => ({
          id: workspace.id,
          status: workspace.status,
          isolationStatus: workspace.isolationStatus,
          workspaceKind: workspace.workspaceKind
        })),
        workspaceEvidenceAvailable,
        editOverlapIds: severeOverlaps.map((overlap) => overlap.id),
        editOverlapEvidenceAvailable,
        policyDecisionId: policyDecision.policyDecisionId,
        policyAllowed: policyDecision.allowed,
        mergeExecutionPolicyDecisionId: mergeExecutionDecision.policyDecisionId,
        mergeExecutionPolicyAllowed: mergeExecutionDecision.allowed,
        mergeExecutionEnabled: false,
        remoteGitOperation: false,
        autoMergeEnabled: false,
        branchDeletionEnabled: false,
        secretsExposed: false,
        envValuesExposed: false,
        noRealMerge: true,
        noRemoteGit: true,
        noExternalProviders: true
      })
    };
    if (context.persist === true) this.replaceDecision(decision);
    return { decision: clone(decision), holds: holds.map((hold) => clone(hold)) };
  }

  private computePriority(
    entry: MergeQueueEntry,
    decision: MergeReadinessDecisionValue,
    riskScore: number,
    simulation: MergeSimulationResult | undefined,
    humanPriority: number | undefined,
    releaseBlocker: boolean
  ): number {
    const changedFiles = simulation?.changedFiles.length ?? 0;
    let priority = entry.priority * 1000;
    priority += decisionRank[decision] * 100000;
    priority += Math.round(riskScore * ruleWeight(this.policy, "lower_conflict_first"));
    priority += changedFiles * ruleWeight(this.policy, "smaller_diff_first");
    if (humanPriority !== undefined) priority -= humanPriority * ruleWeight(this.policy, "human_priority");
    if (releaseBlocker) priority -= ruleWeight(this.policy, "release_blocker");
    return priority;
  }

  private evaluatePolicy(
    action: MergeQueuePolicyAction,
    entry: MergeQueueEntry | undefined,
    lease: BranchLease | undefined,
    context: MergeQueuePolicyContext,
    metadata: Record<string, unknown>
  ): MergeQueuePolicyDecisionSnapshot {
    if (!this.policyEvaluator) {
      return {
        allowed: action !== "merge_queue.merge_execute_future",
        decision: action === "merge_queue.merge_execute_future" ? "deny" : "allow",
        reason: action === "merge_queue.merge_execute_future"
          ? "merge execution remains disabled in Merge Queue Policy v2"
          : "mock merge queue policy allowed metadata operation"
      };
    }
    return this.policyEvaluator({
      action,
      entry,
      lease,
      context,
      metadata: sanitizeMetadata({
        ...metadata,
        policyId: this.policy.id,
        queueEntryId: entry?.id,
        repoId: entry?.repoId ?? lease?.repoId,
        branchName: entry?.branchName ?? lease?.branchName,
        taskId: entry?.taskId ?? lease?.taskId,
        taskRunId: entry?.taskRunId ?? lease?.taskRunId,
        realMergeExecution: false,
        remoteGitOperation: false,
        autoMergeEnabled: false,
        branchDeletionEnabled: false,
        secretsExposed: false,
        envValuesExposed: false
      })
    });
  }

  private upsertHold(entryId: string, hold: HoldInput, context: MergeQueuePolicyContext, persist: boolean): MergeQueueHold {
    const now = this.now();
    const existing = this.holds.find((candidate) =>
      candidate.queueEntryId === entryId &&
      candidate.holdKind === hold.holdKind &&
      candidate.reason === hold.reason &&
      !hasReleasedAt(candidate)
    );
    const next: MergeQueueHold = existing
      ? {
        ...existing,
        severity: maxSeverity(existing.severity, hold.severity),
        metadata: sanitizeMetadata({
          ...existing.metadata,
          ...hold.metadata,
          lastObservedAt: now.toISOString(),
          requestId: context.requestId ?? existing.metadata.requestId,
          correlationId: context.correlationId ?? existing.metadata.correlationId,
          actorId: context.actorId ?? existing.metadata.actorId,
          serviceAccountId: context.serviceAccountId ?? existing.metadata.serviceAccountId
        })
      }
      : {
        id: createId("mergehold"),
        queueEntryId: entryId,
        holdKind: hold.holdKind,
        severity: hold.severity,
        reason: hold.reason,
        createdAt: now,
        metadata: sanitizeMetadata({
          ...hold.metadata,
          requestId: context.requestId,
          correlationId: context.correlationId,
          actorId: context.actorId,
          serviceAccountId: context.serviceAccountId,
          metadataOnly: true,
          noRealMerge: true,
          noRemoteGit: true
        })
      };
    if (persist) this.replaceHold(next);
    return clone(next);
  }

  private replaceDecision(decision: MergeReadinessDecision): void {
    const index = this.decisions.findIndex((candidate) => candidate.queueEntryId === decision.queueEntryId);
    if (index >= 0) {
      this.decisions[index] = clone(decision);
    } else {
      this.decisions.push(clone(decision));
    }
  }

  private replaceHold(hold: MergeQueueHold): void {
    const index = this.holds.findIndex((candidate) => candidate.id === hold.id);
    if (index >= 0) {
      this.holds[index] = clone(hold);
    } else {
      this.holds.push(clone(hold));
    }
  }

  private activeHoldsForEntry(queueEntryId: string): MergeQueueHold[] {
    return this.holds.filter((hold) => hold.queueEntryId === queueEntryId && !hasReleasedAt(hold));
  }

  private summaryFromDecisions(repoId: string | undefined, decisions: MergeReadinessDecision[], holds: MergeQueueHold[]): MergeQueuePolicySummary {
    return {
      repoId,
      policyId: this.policy.id,
      policyStatus: this.policy.status,
      queueEntries: decisions.length,
      ready: decisions.filter((decision) => decision.decision === "ready").length,
      warning: decisions.filter((decision) => decision.decision === "warning").length,
      hold: decisions.filter((decision) => decision.decision === "hold").length,
      blocked: decisions.filter((decision) => decision.decision === "blocked").length,
      needsHumanReview: decisions.filter((decision) => decision.decision === "needs_human_review").length,
      futureManualMerge: decisions.filter((decision) => decision.decision === "future_manual_merge").length,
      activeHolds: holds.filter((hold) => !hasReleasedAt(hold)).length,
      mergeExecutionEnabled: false,
      remoteGitOperation: false,
      autoMergeEnabled: false,
      branchDeletionEnabled: false,
      secretsExposed: false,
      envValuesExposed: false,
      metadata: sanitizeMetadata({
        status: "v2_implemented",
        mergeQueue: "policy_ready_execution_disabled",
        retryRules: this.policy.retryRules,
        actualMergeExecution: "disabled_future_manual_only"
      })
    };
  }
}

function chooseDecision(
  blockingReasons: string[],
  holdInputs: HoldInput[],
  warnings: string[],
  simulation: MergeSimulationResult | undefined
): MergeReadinessDecisionValue {
  if (blockingReasons.includes("policy_denied") || blockingReasons.includes("branch_lease_expired") || blockingReasons.includes("branch_lease_missing")) {
    return "blocked";
  }
  if (blockingReasons.includes("dry_run_text_conflict") || blockingReasons.includes("validation_failed") || blockingReasons.includes("approval_rejected")) {
    return "blocked";
  }
  if (blockingReasons.includes("dry_run_failed") || simulation?.status === "failed") {
    return "needs_human_review";
  }
  if (holdInputs.some((hold) => hold.holdKind === "human_review_required" || hold.severity === "critical")) {
    return "needs_human_review";
  }
  if (holdInputs.length > 0) return "hold";
  if (warnings.length > 0) return "warning";
  return "ready";
}

function isSevereOverlap(overlap: MergeQueueEditOverlapSnapshot): boolean {
  return severeOverlapKinds.has(overlap.overlapKind) ||
    severeOverlapRecommendations.has(overlap.recommendation) ||
    severeOverlapSeverities.has(overlap.severity);
}

function ruleWeight(policy: MergeQueuePolicy, ruleKind: MergeQueuePriorityRuleKind): number {
  return policy.priorityRules.find((rule) => rule.ruleKind === ruleKind && rule.enabled)?.weight ?? 0;
}

function compareDecisions(left: MergeReadinessDecision, right: MergeReadinessDecision): number {
  return left.priority - right.priority ||
    decisionRank[left.decision] - decisionRank[right.decision] ||
    left.createdAt.getTime() - right.createdAt.getTime() ||
    left.queueEntryId.localeCompare(right.queueEntryId);
}

function normalizeEvidenceStatus(status: unknown): MergeQueueEvidenceStatus {
  if (status === "passed" || status === "approved" || status === "not_required" || status === "pending" || status === "failed" || status === "rejected") {
    return status;
  }
  return "missing";
}

function metadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))].sort();
}

function maxSeverity(left: MergeQueueHoldSeverity, right: MergeQueueHoldSeverity): MergeQueueHoldSeverity {
  const rank: Record<MergeQueueHoldSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  return rank[left] >= rank[right] ? left : right;
}

function hasReleasedAt(hold: MergeQueueHold): boolean {
  return typeof hold.metadata.releasedAt === "string" && hold.metadata.releasedAt.length > 0;
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message);
  return value;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sanitizeMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (isSensitiveMetadataKey(key)) {
      output[key] = "[redacted]";
      continue;
    }
    if (Array.isArray(value)) {
      output[key] = value.map((item) => typeof item === "object" && item !== null ? sanitizeMetadata(item as Record<string, unknown>) : item);
      continue;
    }
    if (value instanceof Date) {
      output[key] = value.toISOString();
      continue;
    }
    if (typeof value === "object" && value !== null) {
      output[key] = sanitizeMetadata(value as Record<string, unknown>);
      continue;
    }
    output[key] = value;
  }
  return output;
}

function isSensitiveMetadataKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (
    normalized === "secretsexposed" ||
    normalized === "nosecretsexposed" ||
    normalized === "envvaluesexposed" ||
    normalized === "noenvvaluesexposed" ||
    normalized === "nosecretsorenvvalues"
  ) {
    return false;
  }
  return /token|secret|credential|password|private.*key|api.*key/.test(normalized) ||
    normalized === "env" ||
    normalized === "envvalue" ||
    normalized === "envvalues" ||
    normalized === "rawenv";
}
