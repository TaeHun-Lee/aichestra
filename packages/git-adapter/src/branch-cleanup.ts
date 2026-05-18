import { createId } from "@aichestra/core";
import type {
  BranchLease,
  MergeQueueEntry
} from "@aichestra/core";

export type OrphanLeaseKind =
  | "branch"
  | "workspace"
  | "worktree"
  | "merge_queue"
  | "pr_ownership"
  | "agent_session";

export type OrphanDetectedReason =
  | "expired"
  | "missing_owner"
  | "task_completed"
  | "task_failed"
  | "merge_completed"
  | "branch_missing_future"
  | "workspace_missing_future"
  | "stale_queue_entry"
  | "abandoned_session"
  | "inconsistent_state";

export type OrphanSeverity = "low" | "medium" | "high" | "critical";

export type OrphanLeaseRecord = {
  id: string;
  leaseKind: OrphanLeaseKind;
  relatedId: string;
  repoId?: string;
  branchName?: string;
  workspaceLeaseId?: string;
  worktreePath?: string;
  ownerActorId?: string;
  ownerServiceAccountId?: string;
  detectedReason: OrphanDetectedReason;
  severity: OrphanSeverity;
  detectedAt: Date;
  metadata: Record<string, unknown>;
};

export type CleanupRecommendationKind =
  | "keep"
  | "mark_abandoned"
  | "release_metadata_lease"
  | "mark_cleanup_pending"
  | "require_manual_review"
  | "delete_branch_future"
  | "remove_worktree_future"
  | "close_pr_future"
  | "archive_record_future";

export type CleanupDestructiveFlag = "false" | "true_future";

export type CleanupRequiredApproval =
  | "none"
  | "owner"
  | "platform_owner"
  | "release_manager"
  | "security_reviewer"
  | "future_policy";

export type CleanupRecommendation = {
  id: string;
  orphanRecordId: string;
  recommendation: CleanupRecommendationKind;
  destructive: CleanupDestructiveFlag;
  requiredApproval: CleanupRequiredApproval;
  reason: string;
  safetyChecks: string[];
  metadata: Record<string, unknown>;
};

export type CleanupDecisionValue =
  | "approved_metadata_only"
  | "rejected"
  | "held"
  | "future_destructive_review"
  | "blocked_policy"
  | "executed_metadata_only";

export type CleanupDecision = {
  id: string;
  recommendationId: string;
  decision: CleanupDecisionValue;
  decidedByActorId?: string;
  decidedAt?: Date;
  reason: string;
  metadata: Record<string, unknown>;
};

export type RecoveryActionKind =
  | "relink_branch_lease"
  | "relink_workspace_lease"
  | "refresh_status"
  | "recreate_metadata_record"
  | "mark_failed"
  | "mark_abandoned"
  | "manual_reconciliation";

export type RecoveryActionStatus =
  | "proposed"
  | "executed_metadata_only"
  | "blocked"
  | "future";

export type RecoveryAction = {
  id: string;
  orphanRecordId: string;
  action: RecoveryActionKind;
  status: RecoveryActionStatus;
  metadata: Record<string, unknown>;
};

export type BranchCleanupSummary = {
  status: "v1_implemented";
  scans: number;
  orphanRecords: number;
  recommendations: number;
  decisions: number;
  recoveryActions: number;
  destructiveFutureRecommendations: number;
  metadataOnlyRecommendations: number;
  blockedDirtyWorkspaces: number;
  expiredLeases: number;
  staleMergeQueueEntries: number;
  inconsistentSharedWorktreeFindings: number;
  destructiveCleanupEnabled: false;
  realBranchDeleted: false;
  realWorktreeRemoved: false;
  realPullRequestClosed: false;
  remoteGitCallsExecuted: false;
  filesystemDeletionsExecuted: false;
  noSecretsExposed: true;
  envValuesExposed: false;
};

export type BranchCleanupOrphanQuery = {
  leaseKind?: OrphanLeaseKind;
  severity?: OrphanSeverity;
  repoId?: string;
  detectedReason?: OrphanDetectedReason;
};

export type BranchCleanupRecommendationQuery = {
  orphanRecordId?: string;
  recommendation?: CleanupRecommendationKind;
  destructive?: CleanupDestructiveFlag;
};

export type BranchCleanupRecoveryRepository = {
  saveOrphan(record: OrphanLeaseRecord): OrphanLeaseRecord;
  listOrphans(query?: BranchCleanupOrphanQuery): OrphanLeaseRecord[];
  getOrphan(id: string): OrphanLeaseRecord | undefined;
  saveRecommendation(record: CleanupRecommendation): CleanupRecommendation;
  listRecommendations(query?: BranchCleanupRecommendationQuery): CleanupRecommendation[];
  getRecommendation(id: string): CleanupRecommendation | undefined;
  saveDecision(record: CleanupDecision): CleanupDecision;
  getLatestDecision(recommendationId: string): CleanupDecision | undefined;
  listDecisions(): CleanupDecision[];
  saveRecoveryAction(record: RecoveryAction): RecoveryAction;
  listRecoveryActions(orphanRecordId?: string): RecoveryAction[];
  updateRecoveryAction(id: string, patch: Partial<Omit<RecoveryAction, "id" | "orphanRecordId">>): RecoveryAction;
};

export type WorkspaceLeaseSnapshot = {
  id: string;
  taskId: string;
  taskRunId?: string;
  agentRunId: string;
  repoId: string;
  branchLeaseId?: string;
  branchName: string;
  workspacePath: string;
  status:
    | "requested"
    | "allocated"
    | "active"
    | "frozen"
    | "ready_for_merge"
    | "merged"
    | "abandoned"
    | "cleanup_pending"
    | "cleaned"
    | "failed";
  isolationStatus: "isolated" | "shared_forbidden" | "unknown";
  workspaceKind: "fixture" | "git_worktree_future" | "clone_future" | "remote_workspace_future";
  expiresAt?: Date;
  ownerActorId?: string;
  ownerServiceAccountId?: string;
  latestCleanupDecision?:
    | "keep"
    | "cleanup_allowed"
    | "cleanup_blocked_dirty"
    | "cleanup_blocked_uncommitted"
    | "cleanup_blocked_unmerged"
    | "cleanup_blocked_policy"
    | "future_manual_review";
  metadata: Record<string, unknown>;
};

export type BranchOwnershipSnapshot = {
  id: string;
  repoId: string;
  branchName: string;
  branchLeaseId: string;
  workspaceLeaseId?: string;
  ownerActorId?: string;
  ownerServiceAccountId?: string;
  status:
    | "active"
    | "frozen"
    | "ready_for_review"
    | "ready_for_merge"
    | "merged"
    | "abandoned"
    | "expired";
  expiresAt?: Date;
};

export type AgentSessionSnapshot = {
  id: string;
  repoId: string;
  taskRunId?: string;
  branchName?: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  ownerActorId?: string;
  status: string;
  lastActivityAt?: Date;
};

export type WorktreeAllocationSnapshot = {
  id: string;
  repoId: string;
  branchName: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  worktreePath: string;
  status: "proposed" | "validated" | "rejected" | "future";
  metadata: Record<string, unknown>;
};

export type PrOwnershipHandoffSnapshot = {
  id: string;
  repoId: string;
  pullRequestId: string;
  fromActorId?: string;
  toActorId?: string;
  status: "pending" | "accepted" | "expired" | "rejected";
  expiresAt?: Date;
};

export type TaskStatusSnapshot = {
  taskId: string;
  status: string;
};

export type BranchCleanupDataSource = {
  listBranchLeases(repoId?: string): BranchLease[];
  listWorkspaceLeases?(repoId?: string): WorkspaceLeaseSnapshot[];
  listMergeQueueEntries?(repoId?: string): MergeQueueEntry[];
  listBranchOwnership?(repoId?: string): BranchOwnershipSnapshot[];
  listAgentSessions?(repoId?: string): AgentSessionSnapshot[];
  listWorktreeAllocations?(repoId?: string): WorktreeAllocationSnapshot[];
  listPullRequestHandoffs?(repoId?: string): PrOwnershipHandoffSnapshot[];
  getTaskStatus?(taskId: string): TaskStatusSnapshot | undefined;
};

export type BranchCleanupRecoveryContext = {
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type BranchCleanupScanQuery = {
  repoId?: string;
};

export type BranchCleanupDecisionInput = {
  recommendationId: string;
  decision: CleanupDecisionValue;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type BranchCleanupExecuteResult = {
  decisionId: string;
  recommendationId: string;
  decision: CleanupDecision;
  recoveryActions: RecoveryAction[];
  metadataOnly: true;
  realBranchDeleted: false;
  realWorktreeRemoved: false;
  realPullRequestClosed: false;
  filesystemDeletionsExecuted: false;
  remoteGitCallsExecuted: false;
};

const destructiveRecommendations: ReadonlySet<CleanupRecommendationKind> = new Set([
  "delete_branch_future",
  "remove_worktree_future",
  "close_pr_future",
  "archive_record_future"
]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sanitizeWorktreePath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("[workspace-path]") || value.startsWith("[future-workspace]")) return value;
  const segments = value.split(/[\\/]/);
  const tail = segments[segments.length - 1] ?? "";
  return tail ? `[workspace-path]/${tail}` : "[workspace-path]";
}

export class InMemoryBranchCleanupRecoveryRepository implements BranchCleanupRecoveryRepository {
  private readonly orphans: OrphanLeaseRecord[] = [];
  private readonly recommendations: CleanupRecommendation[] = [];
  private readonly decisions: CleanupDecision[] = [];
  private readonly recoveryActions: RecoveryAction[] = [];

  saveOrphan(record: OrphanLeaseRecord): OrphanLeaseRecord {
    const stored = clone(record);
    this.orphans.push(stored);
    return clone(stored);
  }

  listOrphans(query: BranchCleanupOrphanQuery = {}): OrphanLeaseRecord[] {
    return this.orphans
      .filter((orphan) => query.leaseKind === undefined || orphan.leaseKind === query.leaseKind)
      .filter((orphan) => query.severity === undefined || orphan.severity === query.severity)
      .filter((orphan) => query.repoId === undefined || orphan.repoId === query.repoId)
      .filter((orphan) => query.detectedReason === undefined || orphan.detectedReason === query.detectedReason)
      .map(clone);
  }

  getOrphan(id: string): OrphanLeaseRecord | undefined {
    const record = this.orphans.find((orphan) => orphan.id === id);
    return record ? clone(record) : undefined;
  }

  saveRecommendation(record: CleanupRecommendation): CleanupRecommendation {
    const stored = clone(record);
    this.recommendations.push(stored);
    return clone(stored);
  }

  listRecommendations(query: BranchCleanupRecommendationQuery = {}): CleanupRecommendation[] {
    return this.recommendations
      .filter((recommendation) => query.orphanRecordId === undefined || recommendation.orphanRecordId === query.orphanRecordId)
      .filter((recommendation) => query.recommendation === undefined || recommendation.recommendation === query.recommendation)
      .filter((recommendation) => query.destructive === undefined || recommendation.destructive === query.destructive)
      .map(clone);
  }

  getRecommendation(id: string): CleanupRecommendation | undefined {
    const record = this.recommendations.find((recommendation) => recommendation.id === id);
    return record ? clone(record) : undefined;
  }

  saveDecision(record: CleanupDecision): CleanupDecision {
    const stored = clone(record);
    this.decisions.push(stored);
    return clone(stored);
  }

  getLatestDecision(recommendationId: string): CleanupDecision | undefined {
    const matches = this.decisions.filter((decision) => decision.recommendationId === recommendationId);
    if (matches.length === 0) return undefined;
    return clone(matches[matches.length - 1]);
  }

  listDecisions(): CleanupDecision[] {
    return this.decisions.map(clone);
  }

  saveRecoveryAction(record: RecoveryAction): RecoveryAction {
    const stored = clone(record);
    this.recoveryActions.push(stored);
    return clone(stored);
  }

  listRecoveryActions(orphanRecordId?: string): RecoveryAction[] {
    return this.recoveryActions
      .filter((action) => orphanRecordId === undefined || action.orphanRecordId === orphanRecordId)
      .map(clone);
  }

  updateRecoveryAction(id: string, patch: Partial<Omit<RecoveryAction, "id" | "orphanRecordId">>): RecoveryAction {
    const index = this.recoveryActions.findIndex((action) => action.id === id);
    if (index < 0) throw new Error(`Recovery action not found: ${id}`);
    const merged: RecoveryAction = {
      ...this.recoveryActions[index],
      ...patch,
      metadata: {
        ...this.recoveryActions[index].metadata,
        ...(patch.metadata ?? {})
      }
    };
    this.recoveryActions[index] = merged;
    return clone(merged);
  }
}

export type BranchCleanupRecoveryServiceInput = {
  repository?: BranchCleanupRecoveryRepository;
  dataSource: BranchCleanupDataSource;
  now?: () => Date;
};

export class BranchCleanupRecoveryService {
  private readonly repository: BranchCleanupRecoveryRepository;
  private readonly dataSource: BranchCleanupDataSource;
  private readonly now: () => Date;
  private scanCount = 0;

  constructor(input: BranchCleanupRecoveryServiceInput) {
    this.repository = input.repository ?? new InMemoryBranchCleanupRecoveryRepository();
    this.dataSource = input.dataSource;
    this.now = input.now ?? (() => new Date());
  }

  scanForOrphans(query: BranchCleanupScanQuery = {}, context: BranchCleanupRecoveryContext = {}): {
    orphans: OrphanLeaseRecord[];
    recommendations: CleanupRecommendation[];
  } {
    this.scanCount += 1;
    const orphans: OrphanLeaseRecord[] = [];

    const now = this.now();

    const branchLeases = this.dataSource.listBranchLeases(query.repoId);
    const workspaceLeases = this.dataSource.listWorkspaceLeases?.(query.repoId) ?? [];
    const mergeQueueEntries = this.dataSource.listMergeQueueEntries?.(query.repoId) ?? [];
    const branchOwnership = this.dataSource.listBranchOwnership?.(query.repoId) ?? [];
    const sessions = this.dataSource.listAgentSessions?.(query.repoId) ?? [];
    const worktrees = this.dataSource.listWorktreeAllocations?.(query.repoId) ?? [];
    const handoffs = this.dataSource.listPullRequestHandoffs?.(query.repoId) ?? [];

    const branchLeaseById = new Map(branchLeases.map((lease) => [lease.id, lease] as const));
    const activeWorkspaceLeases = workspaceLeases.filter((lease) =>
      ["requested", "allocated", "active", "frozen", "ready_for_merge", "cleanup_pending"].includes(lease.status)
    );

    // Rule 1: expired branch leases.
    for (const lease of branchLeases) {
      if (lease.status === "expired") {
        const stillActiveSession = sessions.some((session) => session.branchLeaseId === lease.id && !["completed", "failed", "abandoned", "expired"].includes(session.status));
        orphans.push(this.recordOrphan(now, {
          leaseKind: "branch",
          relatedId: lease.id,
          repoId: lease.repoId,
          branchName: lease.branchName,
          detectedReason: "expired",
          severity: stillActiveSession ? "high" : "medium",
          metadata: { branchLeaseStatus: lease.status, stillActiveSession }
        }, context));
      } else if (lease.status === "active" && lease.expiresAt && lease.expiresAt.getTime() <= now.getTime()) {
        orphans.push(this.recordOrphan(now, {
          leaseKind: "branch",
          relatedId: lease.id,
          repoId: lease.repoId,
          branchName: lease.branchName,
          detectedReason: "expired",
          severity: "medium",
          metadata: { branchLeaseStatus: lease.status, expiresAtPassed: true }
        }, context));
      }
    }

    // Rule 2: branch ownership with missing owner.
    for (const ownership of branchOwnership) {
      if (ownership.ownerActorId === undefined && ownership.ownerServiceAccountId === undefined && ownership.status === "active") {
        orphans.push(this.recordOrphan(now, {
          leaseKind: "branch",
          relatedId: ownership.id,
          repoId: ownership.repoId,
          branchName: ownership.branchName,
          detectedReason: "missing_owner",
          severity: "high",
          metadata: { ownershipStatus: ownership.status }
        }, context));
      }
    }

    // Rule 3: workspace lease still active for completed/failed task.
    for (const lease of activeWorkspaceLeases) {
      const taskStatus = this.dataSource.getTaskStatus?.(lease.taskId)?.status;
      if (taskStatus === "completed" || taskStatus === "failed") {
        orphans.push(this.recordOrphan(now, {
          leaseKind: "workspace",
          relatedId: lease.id,
          repoId: lease.repoId,
          branchName: lease.branchName,
          workspaceLeaseId: lease.id,
          worktreePath: sanitizeWorktreePath(lease.workspacePath),
          ownerActorId: lease.ownerActorId,
          ownerServiceAccountId: lease.ownerServiceAccountId,
          detectedReason: taskStatus === "completed" ? "task_completed" : "task_failed",
          severity: taskStatus === "failed" ? "high" : "medium",
          metadata: { workspaceStatus: lease.status, taskStatus }
        }, context));
      }
    }

    // Rule 4: workspace ready_for_merge but no merge queue entry.
    for (const lease of workspaceLeases) {
      if (lease.status !== "ready_for_merge" || !lease.branchLeaseId) continue;
      const hasMergeQueue = mergeQueueEntries.some((entry) => entry.branchLeaseId === lease.branchLeaseId);
      if (!hasMergeQueue) {
        orphans.push(this.recordOrphan(now, {
          leaseKind: "workspace",
          relatedId: lease.id,
          repoId: lease.repoId,
          branchName: lease.branchName,
          workspaceLeaseId: lease.id,
          worktreePath: sanitizeWorktreePath(lease.workspacePath),
          detectedReason: "inconsistent_state",
          severity: "medium",
          metadata: { reason: "workspace_ready_for_merge_without_queue_entry" }
        }, context));
      }
    }

    // Rule 5: stale merge queue entry referencing released/expired branch lease, or branch ownership marked abandoned/merged.
    for (const entry of mergeQueueEntries) {
      const lease = entry.branchLeaseId ? branchLeaseById.get(entry.branchLeaseId) : undefined;
      if (lease && (lease.status === "released" || lease.status === "expired")) {
        orphans.push(this.recordOrphan(now, {
          leaseKind: "merge_queue",
          relatedId: entry.id,
          repoId: entry.repoId,
          branchName: lease.branchName,
          detectedReason: "stale_queue_entry",
          severity: "medium",
          metadata: { branchLeaseStatus: lease.status, mergeQueueStatus: entry.status }
        }, context));
      }
      const owner = branchOwnership.find((record) => record.branchName === lease?.branchName && record.repoId === entry.repoId);
      if (owner && (owner.status === "abandoned" || owner.status === "merged")) {
        orphans.push(this.recordOrphan(now, {
          leaseKind: "merge_queue",
          relatedId: entry.id,
          repoId: entry.repoId,
          branchName: lease?.branchName,
          detectedReason: "stale_queue_entry",
          severity: "medium",
          metadata: { ownershipStatus: owner.status, mergeQueueStatus: entry.status }
        }, context));
      }
    }

    // Rule 6: abandoned agent sessions.
    for (const session of sessions) {
      if (session.status === "abandoned" || session.status === "expired") {
        orphans.push(this.recordOrphan(now, {
          leaseKind: "agent_session",
          relatedId: session.id,
          repoId: session.repoId,
          branchName: session.branchName,
          workspaceLeaseId: session.workspaceLeaseId,
          ownerActorId: session.ownerActorId,
          detectedReason: "abandoned_session",
          severity: "medium",
          metadata: { sessionStatus: session.status }
        }, context));
      }
    }

    // Rule 7: shared worktree referenced by multiple active leases / ownership records.
    const worktreeRefCount = new Map<string, number>();
    const recordWorktreeReference = (path: string | undefined): void => {
      if (!path) return;
      const key = path.toLowerCase();
      worktreeRefCount.set(key, (worktreeRefCount.get(key) ?? 0) + 1);
    };
    for (const lease of activeWorkspaceLeases) {
      recordWorktreeReference(lease.workspacePath);
    }
    for (const worktree of worktrees) {
      if (worktree.status === "validated") {
        recordWorktreeReference(worktree.worktreePath);
      }
    }
    const sharedWorktrees = new Set(
      Array.from(worktreeRefCount.entries()).filter(([, count]) => count > 1).map(([path]) => path)
    );
    if (sharedWorktrees.size > 0) {
      for (const lease of activeWorkspaceLeases) {
        if (sharedWorktrees.has(lease.workspacePath.toLowerCase())) {
          orphans.push(this.recordOrphan(now, {
            leaseKind: "worktree",
            relatedId: lease.id,
            repoId: lease.repoId,
            branchName: lease.branchName,
            workspaceLeaseId: lease.id,
            worktreePath: sanitizeWorktreePath(lease.workspacePath),
            detectedReason: "inconsistent_state",
            severity: "critical",
            metadata: { reason: "shared_worktree" }
          }, context));
        }
      }
    }

    // Rule 8: branch merged but workspace still active.
    for (const ownership of branchOwnership) {
      if (ownership.status !== "merged") continue;
      const linkedWorkspace = workspaceLeases.find((lease) => lease.id === ownership.workspaceLeaseId);
      if (linkedWorkspace && linkedWorkspace.status !== "merged" && linkedWorkspace.status !== "cleaned" && linkedWorkspace.status !== "abandoned" && linkedWorkspace.status !== "failed") {
        orphans.push(this.recordOrphan(now, {
          leaseKind: "workspace",
          relatedId: linkedWorkspace.id,
          repoId: linkedWorkspace.repoId,
          branchName: linkedWorkspace.branchName,
          workspaceLeaseId: linkedWorkspace.id,
          worktreePath: sanitizeWorktreePath(linkedWorkspace.workspacePath),
          detectedReason: "merge_completed",
          severity: "low",
          metadata: { ownershipStatus: ownership.status, workspaceStatus: linkedWorkspace.status }
        }, context));
      }
    }

    // Rule 9: dirty workspace cleanup blocked.
    for (const lease of workspaceLeases) {
      if (lease.latestCleanupDecision === "cleanup_blocked_dirty" || lease.latestCleanupDecision === "cleanup_blocked_uncommitted") {
        orphans.push(this.recordOrphan(now, {
          leaseKind: "workspace",
          relatedId: lease.id,
          repoId: lease.repoId,
          branchName: lease.branchName,
          workspaceLeaseId: lease.id,
          worktreePath: sanitizeWorktreePath(lease.workspacePath),
          detectedReason: "inconsistent_state",
          severity: "medium",
          metadata: { cleanupDecision: lease.latestCleanupDecision }
        }, context));
      }
    }

    // Rule 10: expired PR ownership handoff.
    for (const handoff of handoffs) {
      if (handoff.status === "expired" || (handoff.expiresAt && handoff.expiresAt.getTime() <= now.getTime() && handoff.status === "pending")) {
        orphans.push(this.recordOrphan(now, {
          leaseKind: "pr_ownership",
          relatedId: handoff.id,
          repoId: handoff.repoId,
          detectedReason: "expired",
          severity: "medium",
          metadata: { handoffStatus: handoff.status, pullRequestId: handoff.pullRequestId }
        }, context));
      }
    }

    const recommendations = orphans.map((orphan) => this.recommendForOrphan(orphan));
    return { orphans: orphans.map(clone), recommendations: recommendations.map(clone) };
  }

  evaluateRecord(orphanRecordId: string, context: BranchCleanupRecoveryContext = {}): CleanupRecommendation {
    const orphan = this.repository.getOrphan(orphanRecordId);
    if (!orphan) throw new Error(`Orphan record not found: ${orphanRecordId}`);
    void context;
    return this.recommendForOrphan(orphan);
  }

  listOrphanRecords(query: BranchCleanupOrphanQuery = {}): OrphanLeaseRecord[] {
    return this.repository.listOrphans(query);
  }

  listRecommendations(query: BranchCleanupRecommendationQuery = {}): CleanupRecommendation[] {
    return this.repository.listRecommendations(query);
  }

  decideRecommendation(input: BranchCleanupDecisionInput, context: BranchCleanupRecoveryContext = {}): CleanupDecision {
    const recommendation = this.repository.getRecommendation(input.recommendationId);
    if (!recommendation) throw new Error(`Recommendation not found: ${input.recommendationId}`);
    const decisionValue: CleanupDecisionValue = recommendation.destructive === "true_future" && input.decision === "approved_metadata_only"
      ? "future_destructive_review"
      : input.decision;
    const decision: CleanupDecision = {
      id: createId("cleanup_decision"),
      recommendationId: input.recommendationId,
      decision: decisionValue,
      decidedByActorId: context.actorId,
      decidedAt: this.now(),
      reason: input.reason ?? recommendation.reason,
      metadata: {
        recommendation: recommendation.recommendation,
        destructive: recommendation.destructive,
        requiredApproval: recommendation.requiredApproval,
        requestId: context.requestId,
        correlationId: context.correlationId,
        source: context.source,
        ...(input.metadata ?? {})
      }
    };
    return this.repository.saveDecision(decision);
  }

  executeMetadataOnlyCleanup(decisionId: string, context: BranchCleanupRecoveryContext = {}): BranchCleanupExecuteResult {
    const decision = this.repository.listDecisions().find((candidate) => candidate.id === decisionId);
    if (!decision) throw new Error(`Cleanup decision not found: ${decisionId}`);
    const recommendation = this.repository.getRecommendation(decision.recommendationId);
    if (!recommendation) throw new Error(`Recommendation not found: ${decision.recommendationId}`);
    if (decision.decision !== "approved_metadata_only" && decision.decision !== "executed_metadata_only") {
      throw new Error(`Cleanup decision is not approved for metadata-only execution: ${decision.decision}`);
    }
    if (recommendation.destructive === "true_future") {
      throw new Error("Destructive cleanup remains future-only; metadata execute is forbidden for true_future recommendations.");
    }
    const executedDecision: CleanupDecision = {
      ...decision,
      decision: "executed_metadata_only",
      metadata: {
        ...decision.metadata,
        executedAt: this.now().toISOString(),
        requestId: context.requestId ?? decision.metadata.requestId,
        correlationId: context.correlationId ?? decision.metadata.correlationId,
        source: context.source ?? decision.metadata.source,
        executedByActorId: context.actorId ?? decision.decidedByActorId
      }
    };
    this.repository.saveDecision(executedDecision);

    const orphan = this.repository.getOrphan(recommendation.orphanRecordId);
    const recoveryActions: RecoveryAction[] = [];
    if (orphan) {
      const recovery = this.proposeRecovery(orphan.id, context).find((action) => action.action === recoveryActionForRecommendation(recommendation.recommendation));
      if (recovery) {
        const updated = this.repository.updateRecoveryAction(recovery.id, {
          status: "executed_metadata_only",
          metadata: {
            ...recovery.metadata,
            decisionId: executedDecision.id,
            executedAt: this.now().toISOString()
          }
        });
        recoveryActions.push(updated);
      }
    }

    return {
      decisionId: executedDecision.id,
      recommendationId: recommendation.id,
      decision: executedDecision,
      recoveryActions,
      metadataOnly: true,
      realBranchDeleted: false,
      realWorktreeRemoved: false,
      realPullRequestClosed: false,
      filesystemDeletionsExecuted: false,
      remoteGitCallsExecuted: false
    };
  }

  proposeRecovery(orphanRecordId: string, context: BranchCleanupRecoveryContext = {}): RecoveryAction[] {
    const orphan = this.repository.getOrphan(orphanRecordId);
    if (!orphan) throw new Error(`Orphan record not found: ${orphanRecordId}`);
    const existing = this.repository.listRecoveryActions(orphanRecordId);
    if (existing.length > 0) return existing;

    const actions: RecoveryAction[] = [];
    const baseMetadata: Record<string, unknown> = {
      detectedReason: orphan.detectedReason,
      severity: orphan.severity,
      leaseKind: orphan.leaseKind,
      requestId: context.requestId,
      correlationId: context.correlationId,
      source: context.source
    };

    switch (orphan.detectedReason) {
      case "expired":
        actions.push({
          id: createId("recovery"),
          orphanRecordId: orphan.id,
          action: orphan.leaseKind === "branch" ? "relink_branch_lease" : "refresh_status",
          status: "proposed",
          metadata: { ...baseMetadata, recommendation: "review_metadata_only" }
        });
        break;
      case "missing_owner":
        actions.push({
          id: createId("recovery"),
          orphanRecordId: orphan.id,
          action: "manual_reconciliation",
          status: "proposed",
          metadata: { ...baseMetadata, requiredApproval: "platform_owner" }
        });
        break;
      case "task_completed":
      case "merge_completed":
        actions.push({
          id: createId("recovery"),
          orphanRecordId: orphan.id,
          action: "refresh_status",
          status: "proposed",
          metadata: { ...baseMetadata, recommendation: "mark_cleanup_pending" }
        });
        break;
      case "task_failed":
        actions.push({
          id: createId("recovery"),
          orphanRecordId: orphan.id,
          action: "mark_failed",
          status: "proposed",
          metadata: baseMetadata
        });
        break;
      case "stale_queue_entry":
        actions.push({
          id: createId("recovery"),
          orphanRecordId: orphan.id,
          action: "refresh_status",
          status: "proposed",
          metadata: baseMetadata
        });
        break;
      case "abandoned_session":
        actions.push({
          id: createId("recovery"),
          orphanRecordId: orphan.id,
          action: "mark_abandoned",
          status: "proposed",
          metadata: baseMetadata
        });
        break;
      case "inconsistent_state":
        actions.push({
          id: createId("recovery"),
          orphanRecordId: orphan.id,
          action: "manual_reconciliation",
          status: "proposed",
          metadata: baseMetadata
        });
        break;
      case "branch_missing_future":
      case "workspace_missing_future":
        actions.push({
          id: createId("recovery"),
          orphanRecordId: orphan.id,
          action: "recreate_metadata_record",
          status: "future",
          metadata: baseMetadata
        });
        break;
    }

    return actions.map((action) => this.repository.saveRecoveryAction(action));
  }

  listRecoveryActions(orphanRecordId?: string): RecoveryAction[] {
    return this.repository.listRecoveryActions(orphanRecordId);
  }

  listDecisions(): CleanupDecision[] {
    return this.repository.listDecisions();
  }

  getSummary(): BranchCleanupSummary {
    const orphans = this.repository.listOrphans();
    const recommendations = this.repository.listRecommendations();
    const decisions = this.repository.listDecisions();
    const recoveryActions = this.repository.listRecoveryActions();
    const destructiveFutureRecommendations = recommendations.filter((recommendation) => recommendation.destructive === "true_future").length;
    const metadataOnlyRecommendations = recommendations.length - destructiveFutureRecommendations;
    const blockedDirtyWorkspaces = orphans.filter((orphan) =>
      orphan.detectedReason === "inconsistent_state" && typeof orphan.metadata.cleanupDecision === "string"
    ).length;
    const expiredLeases = orphans.filter((orphan) => orphan.detectedReason === "expired" && orphan.leaseKind === "branch").length;
    const staleMergeQueueEntries = orphans.filter((orphan) => orphan.detectedReason === "stale_queue_entry").length;
    const inconsistentSharedWorktreeFindings = orphans.filter((orphan) => orphan.leaseKind === "worktree").length;
    return {
      status: "v1_implemented",
      scans: this.scanCount,
      orphanRecords: orphans.length,
      recommendations: recommendations.length,
      decisions: decisions.length,
      recoveryActions: recoveryActions.length,
      destructiveFutureRecommendations,
      metadataOnlyRecommendations,
      blockedDirtyWorkspaces,
      expiredLeases,
      staleMergeQueueEntries,
      inconsistentSharedWorktreeFindings,
      destructiveCleanupEnabled: false,
      realBranchDeleted: false,
      realWorktreeRemoved: false,
      realPullRequestClosed: false,
      remoteGitCallsExecuted: false,
      filesystemDeletionsExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    };
  }

  private recordOrphan(
    now: Date,
    input: Omit<OrphanLeaseRecord, "id" | "detectedAt" | "metadata"> & { metadata?: Record<string, unknown> },
    context: BranchCleanupRecoveryContext
  ): OrphanLeaseRecord {
    const orphan: OrphanLeaseRecord = {
      id: createId("orphan"),
      leaseKind: input.leaseKind,
      relatedId: input.relatedId,
      repoId: input.repoId,
      branchName: input.branchName,
      workspaceLeaseId: input.workspaceLeaseId,
      worktreePath: input.worktreePath,
      ownerActorId: input.ownerActorId,
      ownerServiceAccountId: input.ownerServiceAccountId,
      detectedReason: input.detectedReason,
      severity: input.severity,
      detectedAt: now,
      metadata: {
        ...(input.metadata ?? {}),
        requestId: context.requestId,
        correlationId: context.correlationId,
        actorId: context.actorId,
        serviceAccountId: context.serviceAccountId,
        source: context.source
      }
    };
    return this.repository.saveOrphan(orphan);
  }

  private recommendForOrphan(orphan: OrphanLeaseRecord): CleanupRecommendation {
    let recommendation: CleanupRecommendationKind = "require_manual_review";
    let destructive: CleanupDestructiveFlag = "false";
    let requiredApproval: CleanupRequiredApproval = "platform_owner";
    let reason = "";
    const safetyChecks: string[] = [
      "no_real_branch_deletion",
      "no_real_worktree_removal",
      "no_real_pr_closure",
      "no_filesystem_deletion",
      "no_remote_git",
      "no_secret_exposure"
    ];

    switch (orphan.detectedReason) {
      case "expired":
        recommendation = orphan.leaseKind === "branch" ? "release_metadata_lease" : "mark_abandoned";
        requiredApproval = "owner";
        reason = `${orphan.leaseKind} record expired; recommend metadata-only release.`;
        break;
      case "missing_owner":
        recommendation = "require_manual_review";
        requiredApproval = "platform_owner";
        reason = "branch ownership missing actor or service-account; manual review required.";
        break;
      case "task_completed":
        recommendation = "mark_cleanup_pending";
        requiredApproval = "owner";
        reason = "task completed; recommend metadata-only cleanup pending.";
        break;
      case "task_failed":
        recommendation = "mark_abandoned";
        requiredApproval = "owner";
        reason = "task failed; recommend marking record abandoned (metadata-only).";
        break;
      case "merge_completed":
        recommendation = "mark_cleanup_pending";
        requiredApproval = "owner";
        reason = "branch merged but workspace still active; recommend metadata-only cleanup pending.";
        break;
      case "stale_queue_entry":
        recommendation = "mark_abandoned";
        requiredApproval = "owner";
        reason = "merge queue entry references stale lease; recommend metadata-only mark abandoned.";
        break;
      case "abandoned_session":
        recommendation = "mark_abandoned";
        requiredApproval = "owner";
        reason = "agent session abandoned/expired; recommend metadata-only mark abandoned.";
        break;
      case "inconsistent_state":
        recommendation = "require_manual_review";
        requiredApproval = "platform_owner";
        reason = "inconsistent state detected (shared worktree, dirty workspace, or workspace_ready_without_queue); manual review required.";
        break;
      case "branch_missing_future":
        recommendation = "delete_branch_future";
        destructive = "true_future";
        requiredApproval = "release_manager";
        reason = "future destructive cleanup: branch is missing remotely; review-only until destructive flow is enabled.";
        break;
      case "workspace_missing_future":
        recommendation = "remove_worktree_future";
        destructive = "true_future";
        requiredApproval = "release_manager";
        reason = "future destructive cleanup: workspace is missing on disk; review-only until destructive flow is enabled.";
        break;
    }

    const record: CleanupRecommendation = {
      id: createId("cleanup_recommendation"),
      orphanRecordId: orphan.id,
      recommendation,
      destructive,
      requiredApproval,
      reason,
      safetyChecks,
      metadata: {
        leaseKind: orphan.leaseKind,
        detectedReason: orphan.detectedReason,
        severity: orphan.severity,
        destructiveAllowed: destructive === "false",
        manualReviewRequired: recommendation === "require_manual_review" || destructiveRecommendations.has(recommendation)
      }
    };
    return this.repository.saveRecommendation(record);
  }
}

function recoveryActionForRecommendation(recommendation: CleanupRecommendationKind): RecoveryActionKind {
  switch (recommendation) {
    case "mark_abandoned":
      return "mark_abandoned";
    case "release_metadata_lease":
      return "refresh_status";
    case "mark_cleanup_pending":
      return "refresh_status";
    case "require_manual_review":
      return "manual_reconciliation";
    case "delete_branch_future":
    case "remove_worktree_future":
    case "close_pr_future":
    case "archive_record_future":
      return "manual_reconciliation";
    case "keep":
    default:
      return "refresh_status";
  }
}
