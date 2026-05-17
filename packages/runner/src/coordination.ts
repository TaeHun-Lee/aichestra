import { createId, slugify } from "@aichestra/core";
import type { BranchLease } from "@aichestra/core";
import type { AgentWorkspaceLease } from "./workspace-lifecycle.ts";

export type AgentSessionStatus =
  | "requested"
  | "assigned"
  | "running"
  | "paused"
  | "waiting_on_conflict"
  | "ready_for_review"
  | "ready_for_merge"
  | "completed"
  | "failed"
  | "abandoned";

export type AgentSessionSourceScopeKind = "repo" | "directory" | "file" | "symbol" | "unknown";

export type AgentSessionSourceScope = {
  scopeKind: AgentSessionSourceScopeKind;
  paths: string[];
  description?: string;
  metadata: Record<string, unknown>;
};

export type AgentSession = {
  id: string;
  userId: string;
  actorId: string;
  taskId?: string;
  taskRunId?: string;
  agentRunId: string;
  repoId: string;
  providerId?: string;
  modelId?: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  baseBranch: string;
  branchName?: string;
  targetFiles: string[];
  sourceScope: AgentSessionSourceScope;
  status: AgentSessionStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type AgentRunCoordinationMode =
  | "isolated_by_workspace"
  | "serialized"
  | "allow_parallel_with_warnings"
  | "blocked";

export type AgentRunCoordinationGroupStatus =
  | "healthy"
  | "overlap_warning"
  | "conflict_risk"
  | "blocked"
  | "requires_human_review";

export type AgentRunCoordinationGroup = {
  id: string;
  repoId: string;
  baseBranch: string;
  taskId?: string;
  userId?: string;
  activeSessionIds: string[];
  coordinationMode: AgentRunCoordinationMode;
  status: AgentRunCoordinationGroupStatus;
  metadata: Record<string, unknown>;
};

export type AgentSessionOverlapKind =
  | "same_file"
  | "same_directory"
  | "same_symbol_future"
  | "same_branch"
  | "same_workspace"
  | "base_branch_drift"
  | "unknown_target_files";

export type AgentSessionOverlapSeverity = "low" | "medium" | "high" | "critical";

export type AgentSessionOverlapRecommendation =
  | "allow"
  | "warn"
  | "serialize"
  | "split_files"
  | "require_review"
  | "block";

export type AgentSessionOverlap = {
  id: string;
  sessionAId: string;
  sessionBId: string;
  repoId: string;
  overlapKind: AgentSessionOverlapKind;
  files: string[];
  severity: AgentSessionOverlapSeverity;
  recommendation: AgentSessionOverlapRecommendation;
  metadata: Record<string, unknown>;
};

export type AgentConcurrencyPolicyScopeKind = "repo" | "task" | "user" | "branch" | "workspace" | "file";

export type AgentConcurrencyPolicyMode =
  | "require_isolated_workspace"
  | "require_unique_branch"
  | "warn_on_overlap"
  | "serialize_on_same_file"
  | "block_same_workspace"
  | "future_symbol_aware";

export type AgentConcurrencyPolicy = {
  id: string;
  scopeKind: AgentConcurrencyPolicyScopeKind;
  mode: AgentConcurrencyPolicyMode;
  enabled: boolean;
  metadata: Record<string, unknown>;
};

export type AgentRunCoordinationAuditEvent = {
  id: string;
  eventType: string;
  sessionId?: string;
  groupId?: string;
  repoId?: string;
  result: "allowed" | "warned" | "blocked" | "recorded";
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  reason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type AgentRunCoordinationContext = {
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type RegisterAgentSessionInput = {
  id?: string;
  userId: string;
  actorId?: string;
  taskId?: string;
  taskRunId?: string;
  agentRunId: string;
  repoId: string;
  providerId?: string;
  modelId?: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  baseBranch: string;
  branchName?: string;
  targetFiles?: string[];
  sourceScope?: Partial<AgentSessionSourceScope>;
  status?: AgentSessionStatus;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

export type CoordinationGroupQuery = {
  repoId?: string;
  taskId?: string;
  userId?: string;
  status?: AgentRunCoordinationGroupStatus;
};

export type SessionOverlapQuery = {
  repoId?: string;
  sessionId?: string;
  severity?: AgentSessionOverlapSeverity;
};

export type AgentRunCoordinationRecommendation = {
  groupId: string;
  action: AgentSessionOverlapRecommendation;
  reasons: string[];
  blockingOverlapIds: string[];
  noDestructiveAction: true;
  remoteGitOperation: false;
  agentExecution: false;
  metadata: Record<string, unknown>;
};

export type AgentRunCoordinationSummary = {
  activeSessions: number;
  coordinationGroups: number;
  overlaps: number;
  criticalBlockers: number;
  sameWorkspaceBlockers: number;
  sameFileWarnings: number;
  missingTargetFileWarnings: number;
  readyForReview: number;
  readyForMerge: number;
  noDestructiveAction: true;
  remoteGitOperation: false;
  agentExecution: false;
  secretsExposed: false;
  metadata: Record<string, unknown>;
};

export type AgentRunCoordinationRepository = {
  saveSession(session: AgentSession): AgentSession;
  updateSession(id: string, patch: Partial<Omit<AgentSession, "id" | "createdAt">>): AgentSession;
  getSession(id: string): AgentSession | undefined;
  listSessions(filter?: { repoId?: string; taskId?: string; taskRunId?: string; userId?: string; status?: AgentSessionStatus }): AgentSession[];
  replaceOverlapsForRepo(repoId: string, overlaps: AgentSessionOverlap[]): AgentSessionOverlap[];
  listOverlaps(filter?: SessionOverlapQuery): AgentSessionOverlap[];
  listPolicies(): AgentConcurrencyPolicy[];
  savePolicy(policy: AgentConcurrencyPolicy): AgentConcurrencyPolicy;
  appendAuditEvent(event: Omit<AgentRunCoordinationAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): AgentRunCoordinationAuditEvent;
  listAuditEvents(filter?: { repoId?: string; sessionId?: string; groupId?: string }): AgentRunCoordinationAuditEvent[];
};

export type AgentRunCoordinationServiceOptions = {
  repository?: AgentRunCoordinationRepository;
  branchLeaseLookup?: (branchLeaseId: string) => BranchLease | undefined;
  workspaceLookup?: (workspaceLeaseId: string) => AgentWorkspaceLease | undefined;
};

const terminalSessionStatuses: AgentSessionStatus[] = ["completed", "failed", "abandoned"];

const severityRank: Record<AgentSessionOverlapSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const recommendationRank: Record<AgentSessionOverlapRecommendation, number> = {
  allow: 0,
  warn: 1,
  split_files: 2,
  serialize: 3,
  require_review: 4,
  block: 5
};

export function createDefaultAgentConcurrencyPolicies(): AgentConcurrencyPolicy[] {
  return [
    {
      id: "agent_concurrency_workspace_isolation",
      scopeKind: "workspace",
      mode: "require_isolated_workspace",
      enabled: true,
      metadata: { defaultPolicy: true, reason: "active_agent_sessions_must_not_share_workspace_metadata" }
    },
    {
      id: "agent_concurrency_unique_branch",
      scopeKind: "branch",
      mode: "require_unique_branch",
      enabled: true,
      metadata: { defaultPolicy: true, reason: "active_agent_sessions_should_use_distinct_branch_names" }
    },
    {
      id: "agent_concurrency_same_file_serialization",
      scopeKind: "file",
      mode: "serialize_on_same_file",
      enabled: true,
      metadata: { defaultPolicy: true, reason: "same_file_overlap_requires_serialized_or_split_work" }
    },
    {
      id: "agent_concurrency_overlap_warning",
      scopeKind: "repo",
      mode: "warn_on_overlap",
      enabled: true,
      metadata: { defaultPolicy: true, reason: "directory_or_unknown_scope_overlap_should_be_visible_early" }
    },
    {
      id: "agent_concurrency_symbol_future",
      scopeKind: "file",
      mode: "future_symbol_aware",
      enabled: false,
      metadata: { futureOnly: true, reason: "symbol_aware_overlap_is_not_implemented_in_v1" }
    }
  ];
}

export class InMemoryAgentRunCoordinationRepository implements AgentRunCoordinationRepository {
  private readonly sessions: AgentSession[] = [];
  private readonly overlaps: AgentSessionOverlap[] = [];
  private readonly policies: AgentConcurrencyPolicy[] = createDefaultAgentConcurrencyPolicies();
  private readonly auditEvents: AgentRunCoordinationAuditEvent[] = [];

  saveSession(session: AgentSession): AgentSession {
    this.sessions.push(clone(session));
    return clone(session);
  }

  updateSession(id: string, patch: Partial<Omit<AgentSession, "id" | "createdAt">>): AgentSession {
    const session = this.sessions.find((candidate) => candidate.id === id);
    if (!session) {
      throw new Error(`Agent session not found: ${id}`);
    }
    Object.assign(session, clone(patch), { updatedAt: patch.updatedAt ?? new Date() });
    return clone(session);
  }

  getSession(id: string): AgentSession | undefined {
    const session = this.sessions.find((candidate) => candidate.id === id);
    return session ? clone(session) : undefined;
  }

  listSessions(filter: { repoId?: string; taskId?: string; taskRunId?: string; userId?: string; status?: AgentSessionStatus } = {}): AgentSession[] {
    return this.sessions
      .filter((session) =>
        (filter.repoId === undefined || session.repoId === filter.repoId) &&
        (filter.taskId === undefined || session.taskId === filter.taskId) &&
        (filter.taskRunId === undefined || session.taskRunId === filter.taskRunId) &&
        (filter.userId === undefined || session.userId === filter.userId) &&
        (filter.status === undefined || session.status === filter.status))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((session) => clone(session));
  }

  replaceOverlapsForRepo(repoId: string, overlaps: AgentSessionOverlap[]): AgentSessionOverlap[] {
    for (let index = this.overlaps.length - 1; index >= 0; index -= 1) {
      if (this.overlaps[index]?.repoId === repoId) {
        this.overlaps.splice(index, 1);
      }
    }
    this.overlaps.push(...overlaps.map((overlap) => clone(overlap)));
    return overlaps.map((overlap) => clone(overlap));
  }

  listOverlaps(filter: SessionOverlapQuery = {}): AgentSessionOverlap[] {
    return this.overlaps
      .filter((overlap) =>
        (filter.repoId === undefined || overlap.repoId === filter.repoId) &&
        (filter.sessionId === undefined || overlap.sessionAId === filter.sessionId || overlap.sessionBId === filter.sessionId) &&
        (filter.severity === undefined || overlap.severity === filter.severity))
      .sort((left, right) =>
        severityRank[right.severity] - severityRank[left.severity] ||
        recommendationRank[right.recommendation] - recommendationRank[left.recommendation] ||
        left.id.localeCompare(right.id))
      .map((overlap) => clone(overlap));
  }

  listPolicies(): AgentConcurrencyPolicy[] {
    return this.policies.map((policy) => clone(policy));
  }

  savePolicy(policy: AgentConcurrencyPolicy): AgentConcurrencyPolicy {
    const existing = this.policies.findIndex((candidate) => candidate.id === policy.id);
    if (existing >= 0) {
      this.policies[existing] = clone(policy);
    } else {
      this.policies.push(clone(policy));
    }
    return clone(policy);
  }

  appendAuditEvent(event: Omit<AgentRunCoordinationAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): AgentRunCoordinationAuditEvent {
    const saved = {
      ...event,
      id: event.id ?? createId("coordaudit"),
      createdAt: event.createdAt ?? new Date(),
      metadata: sanitizeMetadata(event.metadata)
    };
    this.auditEvents.push(clone(saved));
    return clone(saved);
  }

  listAuditEvents(filter: { repoId?: string; sessionId?: string; groupId?: string } = {}): AgentRunCoordinationAuditEvent[] {
    return this.auditEvents
      .filter((event) =>
        (filter.repoId === undefined || event.repoId === filter.repoId) &&
        (filter.sessionId === undefined || event.sessionId === filter.sessionId) &&
        (filter.groupId === undefined || event.groupId === filter.groupId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((event) => clone(event));
  }
}

export class AgentRunCoordinationService {
  private readonly repository: AgentRunCoordinationRepository;
  private readonly branchLeaseLookup?: (branchLeaseId: string) => BranchLease | undefined;
  private readonly workspaceLookup?: (workspaceLeaseId: string) => AgentWorkspaceLease | undefined;

  constructor(options: AgentRunCoordinationServiceOptions = {}) {
    this.repository = options.repository ?? new InMemoryAgentRunCoordinationRepository();
    this.branchLeaseLookup = options.branchLeaseLookup;
    this.workspaceLookup = options.workspaceLookup;
  }

  registerSession(input: RegisterAgentSessionInput, context: AgentRunCoordinationContext = {}): AgentSession {
    const now = input.createdAt ?? new Date();
    const branchLease = input.branchLeaseId ? this.branchLeaseLookup?.(input.branchLeaseId) : undefined;
    const workspace = input.workspaceLeaseId ? this.workspaceLookup?.(input.workspaceLeaseId) : undefined;
    const session: AgentSession = {
      id: input.id ?? createId("agentsession"),
      userId: input.userId,
      actorId: input.actorId ?? context.actorId ?? input.userId,
      taskId: input.taskId ?? branchLease?.taskId,
      taskRunId: input.taskRunId ?? branchLease?.taskRunId,
      agentRunId: input.agentRunId,
      repoId: input.repoId,
      providerId: input.providerId,
      modelId: input.modelId,
      branchLeaseId: input.branchLeaseId,
      workspaceLeaseId: input.workspaceLeaseId,
      baseBranch: input.baseBranch || branchLease?.baseBranch || "main",
      branchName: input.branchName ?? branchLease?.branchName,
      targetFiles: normalizeFiles(input.targetFiles && input.targetFiles.length > 0 ? input.targetFiles : branchLease?.files ?? []),
      sourceScope: normalizeSourceScope(input.sourceScope),
      status: input.status ?? "requested",
      createdAt: now,
      updatedAt: now,
      metadata: sanitizeMetadata({
        ...input.metadata,
        branchLeaseStatus: branchLease?.status,
        workspaceStatus: workspace?.status,
        noAgentExecution: true,
        noWorkspaceMutation: true,
        noRemoteGit: true,
        ...contextMetadata(context)
      })
    };
    this.repository.saveSession(session);
    this.recordAudit("agent_session_registered", session, "recorded", context, {
      targetFiles: session.targetFiles,
      branchLeaseId: session.branchLeaseId,
      workspaceLeaseId: session.workspaceLeaseId
    });
    this.evaluateOverlap(session.repoId, context);
    return this.repository.getSession(session.id) ?? session;
  }

  assignBranchLease(sessionId: string, branchLeaseId: string, context: AgentRunCoordinationContext = {}): AgentSession {
    const session = this.requireSession(sessionId);
    const lease = this.branchLeaseLookup?.(branchLeaseId);
    const updated = this.repository.updateSession(session.id, {
      branchLeaseId,
      taskId: session.taskId ?? lease?.taskId,
      taskRunId: session.taskRunId ?? lease?.taskRunId,
      branchName: session.branchName ?? lease?.branchName,
      baseBranch: lease?.baseBranch ?? session.baseBranch,
      targetFiles: session.targetFiles.length > 0 ? session.targetFiles : normalizeFiles(lease?.files ?? []),
      status: session.status === "requested" ? "assigned" : session.status,
      metadata: sanitizeMetadata({
        ...session.metadata,
        branchLeaseStatus: lease?.status ?? "metadata_only",
        ...contextMetadata(context)
      })
    });
    this.recordAudit("agent_session_branch_lease_assigned", updated, "recorded", context, { branchLeaseId });
    this.evaluateOverlap(updated.repoId, context);
    return this.repository.getSession(updated.id) ?? updated;
  }

  assignWorkspaceLease(sessionId: string, workspaceLeaseId: string, context: AgentRunCoordinationContext = {}): AgentSession {
    const session = this.requireSession(sessionId);
    const workspace = this.workspaceLookup?.(workspaceLeaseId);
    const shared = this.activeSessions(session.repoId).some((candidate) => candidate.id !== session.id && candidate.workspaceLeaseId === workspaceLeaseId);
    const updated = this.repository.updateSession(session.id, {
      workspaceLeaseId,
      status: shared ? "waiting_on_conflict" : session.status === "requested" ? "assigned" : session.status,
      metadata: sanitizeMetadata({
        ...session.metadata,
        workspaceStatus: workspace?.status ?? "metadata_only",
        workspaceConflict: shared,
        ...contextMetadata(context)
      })
    });
    this.recordAudit(shared ? "agent_session_workspace_conflict" : "agent_session_workspace_lease_assigned", updated, shared ? "blocked" : "recorded", context, {
      workspaceLeaseId,
      reason: shared ? "same_workspace_active_session" : "workspace_metadata_assigned"
    });
    this.evaluateOverlap(updated.repoId, context);
    return this.repository.getSession(updated.id) ?? updated;
  }

  updateTargetFiles(sessionId: string, files: string[], context: AgentRunCoordinationContext = {}): AgentSession {
    const session = this.requireSession(sessionId);
    const updated = this.repository.updateSession(session.id, {
      targetFiles: normalizeFiles(files),
      updatedAt: new Date(),
      metadata: sanitizeMetadata({
        ...session.metadata,
        targetFilesUpdatedBy: context.actorId ?? context.serviceAccountId ?? "system",
        ...contextMetadata(context)
      })
    });
    this.recordAudit("agent_session_target_files_updated", updated, "recorded", context, { targetFileCount: updated.targetFiles.length });
    this.evaluateOverlap(updated.repoId, context);
    return this.repository.getSession(updated.id) ?? updated;
  }

  evaluateOverlap(repoId: string, context: AgentRunCoordinationContext = {}): AgentSessionOverlap[] {
    const sessions = this.activeSessions(repoId);
    const overlaps: AgentSessionOverlap[] = [];
    for (let index = 0; index < sessions.length; index += 1) {
      for (let nextIndex = index + 1; nextIndex < sessions.length; nextIndex += 1) {
        const left = sessions[index];
        const right = sessions[nextIndex];
        if (!left || !right) continue;
        overlaps.push(...detectPairOverlaps(left, right));
      }
    }
    const saved = this.repository.replaceOverlapsForRepo(repoId, overlaps);
    for (const session of sessions) {
      const sessionOverlaps = saved.filter((overlap) => overlap.sessionAId === session.id || overlap.sessionBId === session.id);
      const blocking = sessionOverlaps.find((overlap) => overlap.recommendation === "block");
      const serializing = sessionOverlaps.find((overlap) => overlap.recommendation === "serialize" || overlap.recommendation === "require_review");
      if (blocking || serializing) {
        this.repository.updateSession(session.id, {
          status: "waiting_on_conflict",
          metadata: sanitizeMetadata({
            ...session.metadata,
            coordinationBlocker: blocking?.overlapKind,
            coordinationWarning: serializing?.overlapKind,
            latestOverlapEvaluationAt: new Date().toISOString()
          })
        });
      }
    }
    this.repository.appendAuditEvent({
      eventType: "agent_session_overlap_evaluated",
      repoId,
      result: saved.some((overlap) => overlap.recommendation === "block") ? "blocked" : saved.length > 0 ? "warned" : "recorded",
      reason: saved.length > 0 ? "overlap_metadata_recorded" : "no_active_overlap",
      metadata: {
        overlapCount: saved.length,
        activeSessionCount: sessions.length,
        ...contextMetadata(context)
      }
    });
    return saved;
  }

  listCoordinationGroups(query: CoordinationGroupQuery = {}): AgentRunCoordinationGroup[] {
    const sessions = this.activeSessions(query.repoId)
      .filter((session) =>
        (query.taskId === undefined || session.taskId === query.taskId) &&
        (query.userId === undefined || session.userId === query.userId));
    const groupsByKey = new Map<string, AgentSession[]>();
    for (const session of sessions) {
      const key = `${session.repoId}:${session.baseBranch}`;
      groupsByKey.set(key, [...(groupsByKey.get(key) ?? []), session]);
    }
    const groups = [...groupsByKey.values()].map((groupSessions) => this.groupFromSessions(groupSessions));
    return groups
      .filter((group) => query.status === undefined || group.status === query.status)
      .sort((left, right) => left.repoId.localeCompare(right.repoId) || left.baseBranch.localeCompare(right.baseBranch) || left.id.localeCompare(right.id));
  }

  getCoordinationGroup(id: string): AgentRunCoordinationGroup | undefined {
    return this.listCoordinationGroups().find((group) => group.id === id);
  }

  listSessionOverlaps(query: SessionOverlapQuery = {}): AgentSessionOverlap[] {
    return this.repository.listOverlaps(query);
  }

  listSessions(filter: { repoId?: string; taskId?: string; taskRunId?: string; userId?: string; status?: AgentSessionStatus } = {}): AgentSession[] {
    return this.repository.listSessions(filter);
  }

  listConcurrencyPolicies(): AgentConcurrencyPolicy[] {
    return this.repository.listPolicies();
  }

  listAuditEvents(filter: { repoId?: string; sessionId?: string; groupId?: string } = {}): AgentRunCoordinationAuditEvent[] {
    return this.repository.listAuditEvents(filter);
  }

  recommendCoordinationAction(groupId: string): AgentRunCoordinationRecommendation {
    const group = this.getCoordinationGroup(groupId);
    if (!group) {
      throw new Error(`Agent run coordination group not found: ${groupId}`);
    }
    const sessionIds = new Set(group.activeSessionIds);
    const overlaps = this.listSessionOverlaps({ repoId: group.repoId })
      .filter((overlap) => sessionIds.has(overlap.sessionAId) && sessionIds.has(overlap.sessionBId));
    const action = strongestRecommendation(overlaps);
    const blockingOverlapIds = overlaps
      .filter((overlap) => overlap.recommendation === "block" || overlap.recommendation === "serialize" || overlap.recommendation === "require_review")
      .map((overlap) => overlap.id);
    return {
      groupId,
      action,
      reasons: recommendationReasons(overlaps, group),
      blockingOverlapIds,
      noDestructiveAction: true,
      remoteGitOperation: false,
      agentExecution: false,
      metadata: {
        groupStatus: group.status,
        coordinationMode: group.coordinationMode,
        activeSessionCount: group.activeSessionIds.length,
        overlapCount: overlaps.length
      }
    };
  }

  markReadyForReview(sessionId: string, context: AgentRunCoordinationContext = {}): AgentSession {
    return this.markSessionStatus(sessionId, "ready_for_review", "agent_session_ready_for_review", context);
  }

  markReadyForMerge(sessionId: string, context: AgentRunCoordinationContext = {}): AgentSession {
    return this.markSessionStatus(sessionId, "ready_for_merge", "agent_session_ready_for_merge", context);
  }

  getSummary(): AgentRunCoordinationSummary {
    const active = this.activeSessions();
    const groups = this.listCoordinationGroups();
    const overlaps = this.listSessionOverlaps();
    return {
      activeSessions: active.length,
      coordinationGroups: groups.length,
      overlaps: overlaps.length,
      criticalBlockers: overlaps.filter((overlap) => overlap.severity === "critical").length,
      sameWorkspaceBlockers: overlaps.filter((overlap) => overlap.overlapKind === "same_workspace").length,
      sameFileWarnings: overlaps.filter((overlap) => overlap.overlapKind === "same_file").length,
      missingTargetFileWarnings: overlaps.filter((overlap) => overlap.overlapKind === "unknown_target_files").length,
      readyForReview: active.filter((session) => session.status === "ready_for_review").length,
      readyForMerge: active.filter((session) => session.status === "ready_for_merge").length,
      noDestructiveAction: true,
      remoteGitOperation: false,
      agentExecution: false,
      secretsExposed: false,
      metadata: {
        status: "v1_implemented",
        storage: "in_memory",
        mockFirst: true,
        realWorkspaceMutation: false,
        realBranchMutation: false
      }
    };
  }

  private groupFromSessions(sessions: AgentSession[]): AgentRunCoordinationGroup {
    const [first] = sessions;
    if (!first) {
      throw new Error("Cannot build coordination group without sessions");
    }
    const sessionIds = new Set(sessions.map((session) => session.id));
    const groupOverlaps = this.listSessionOverlaps({ repoId: first.repoId })
      .filter((overlap) => sessionIds.has(overlap.sessionAId) && sessionIds.has(overlap.sessionBId));
    const userIds = unique(sessions.map((session) => session.userId));
    const taskIds = unique(sessions.map((session) => session.taskId).filter(isString));
    const sourceScopeKeys = unique(sessions.map(sourceScopeKey));
    const worst = worstOverlap(groupOverlaps);
    const status = groupStatus(groupOverlaps, worst);
    return {
      id: groupId(first.repoId, first.baseBranch, taskIds.length === 1 ? taskIds[0] : undefined, userIds.length === 1 ? userIds[0] : undefined),
      repoId: first.repoId,
      baseBranch: first.baseBranch,
      taskId: taskIds.length === 1 ? taskIds[0] : undefined,
      userId: userIds.length === 1 ? userIds[0] : undefined,
      activeSessionIds: sessions.map((session) => session.id),
      coordinationMode: groupMode(groupOverlaps, worst),
      status,
      metadata: {
        userIds,
        taskIds,
        sourceScopeKeys,
        branchNames: unique(sessions.map((session) => session.branchName).filter(isString)),
        branchLeaseIds: unique(sessions.map((session) => session.branchLeaseId).filter(isString)),
        workspaceLeaseIds: unique(sessions.map((session) => session.workspaceLeaseId).filter(isString)),
        overlapCount: groupOverlaps.length,
        recommendedAction: strongestRecommendation(groupOverlaps),
        noDestructiveAction: true,
        remoteGitOperation: false,
        agentExecution: false
      }
    };
  }

  private activeSessions(repoId?: string): AgentSession[] {
    return this.repository.listSessions({ repoId }).filter((session) => !terminalSessionStatuses.includes(session.status));
  }

  private requireSession(sessionId: string): AgentSession {
    const session = this.repository.getSession(sessionId);
    if (!session) {
      throw new Error(`Agent session not found: ${sessionId}`);
    }
    return session;
  }

  private markSessionStatus(sessionId: string, status: AgentSessionStatus, eventType: string, context: AgentRunCoordinationContext): AgentSession {
    const session = this.requireSession(sessionId);
    const updated = this.repository.updateSession(sessionId, {
      status,
      metadata: sanitizeMetadata({
        ...session.metadata,
        ...contextMetadata(context)
      })
    });
    this.recordAudit(eventType, updated, "recorded", context, { status });
    this.evaluateOverlap(updated.repoId, context);
    return this.repository.getSession(updated.id) ?? updated;
  }

  private recordAudit(
    eventType: string,
    session: AgentSession,
    result: AgentRunCoordinationAuditEvent["result"],
    context: AgentRunCoordinationContext,
    metadata: Record<string, unknown>
  ): AgentRunCoordinationAuditEvent {
    return this.repository.appendAuditEvent({
      eventType,
      sessionId: session.id,
      repoId: session.repoId,
      result,
      actorId: context.actorId ?? session.actorId,
      principalId: context.principalId,
      serviceAccountId: context.serviceAccountId,
      requestId: context.requestId,
      correlationId: context.correlationId,
      source: context.source,
      reason: typeof metadata.reason === "string" ? metadata.reason : undefined,
      metadata: sanitizeMetadata({
        ...metadata,
        taskId: session.taskId,
        taskRunId: session.taskRunId,
        agentRunId: session.agentRunId,
        noAgentExecution: true,
        noRemoteGit: true,
        noWorkspaceMutation: true
      })
    });
  }
}

function detectPairOverlaps(left: AgentSession, right: AgentSession): AgentSessionOverlap[] {
  const overlaps: AgentSessionOverlap[] = [];
  if (left.workspaceLeaseId && right.workspaceLeaseId && left.workspaceLeaseId === right.workspaceLeaseId) {
    overlaps.push(createOverlap(left, right, "same_workspace", [], "critical", "block", {
      workspaceLeaseId: left.workspaceLeaseId,
      reason: "active_sessions_share_workspace_metadata"
    }));
  }
  if (left.branchName && right.branchName && left.branchName === right.branchName) {
    overlaps.push(createOverlap(left, right, "same_branch", [], "high", "serialize", {
      branchName: left.branchName,
      reason: "active_sessions_share_branch_name"
    }));
  }
  if (left.baseBranch !== right.baseBranch) {
    overlaps.push(createOverlap(left, right, "base_branch_drift", [], "low", "warn", {
      leftBaseBranch: left.baseBranch,
      rightBaseBranch: right.baseBranch,
      reason: "active_sessions_use_different_base_branches"
    }));
  }
  if (left.targetFiles.length === 0 || right.targetFiles.length === 0) {
    overlaps.push(createOverlap(left, right, "unknown_target_files", [], "medium", "warn", {
      leftTargetFileCount: left.targetFiles.length,
      rightTargetFileCount: right.targetFiles.length,
      reason: "missing_target_files_prevents_precise_overlap_detection"
    }));
    return overlaps;
  }
  const sameFiles = intersection(left.targetFiles, right.targetFiles);
  if (sameFiles.length > 0) {
    overlaps.push(createOverlap(left, right, "same_file", sameFiles, "high", "serialize", {
      reason: "active_sessions_target_same_file"
    }));
  }
  const sameDirectories = intersection(directoriesFor(left), directoriesFor(right)).filter((directory) => directory.length > 0);
  if (sameFiles.length === 0 && sameDirectories.length > 0) {
    overlaps.push(createOverlap(left, right, "same_directory", sameDirectories, "medium", "split_files", {
      reason: "active_sessions_target_same_directory"
    }));
  }
  return overlaps;
}

function createOverlap(
  left: AgentSession,
  right: AgentSession,
  overlapKind: AgentSessionOverlapKind,
  files: string[],
  severity: AgentSessionOverlapSeverity,
  recommendation: AgentSessionOverlapRecommendation,
  metadata: Record<string, unknown>
): AgentSessionOverlap {
  return {
    id: createId("sessionoverlap"),
    sessionAId: left.id,
    sessionBId: right.id,
    repoId: left.repoId,
    overlapKind,
    files: normalizeFiles(files),
    severity,
    recommendation,
    metadata: sanitizeMetadata({
      ...metadata,
      taskIds: [left.taskId, right.taskId].filter(isString),
      userIds: [left.userId, right.userId],
      noDestructiveAction: true,
      remoteGitOperation: false,
      agentExecution: false
    })
  };
}

function normalizeSourceScope(input: Partial<AgentSessionSourceScope> | undefined): AgentSessionSourceScope {
  return {
    scopeKind: input?.scopeKind ?? "unknown",
    paths: normalizeFiles(input?.paths ?? []),
    description: input?.description,
    metadata: sanitizeMetadata(input?.metadata ?? {})
  };
}

function normalizeFiles(files: string[]): string[] {
  return unique(files
    .filter((file): file is string => typeof file === "string" && file.trim().length > 0)
    .map((file) => file.trim().replaceAll("\\", "/").replace(/^\.\//, "")))
    .sort((left, right) => left.localeCompare(right));
}

function directoriesFor(session: AgentSession): string[] {
  const targetDirectories = session.targetFiles.map((file) => {
    const parts = file.split("/");
    parts.pop();
    return parts.join("/");
  });
  const scopeDirectories = session.sourceScope.paths.map((path) => path.endsWith("/") ? path.slice(0, -1) : path);
  return unique([...targetDirectories, ...scopeDirectories]);
}

function intersection(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}

function groupStatus(overlaps: AgentSessionOverlap[], worst: AgentSessionOverlap | undefined): AgentRunCoordinationGroupStatus {
  if (!worst) return "healthy";
  if (worst.severity === "critical" || overlaps.some((overlap) => overlap.recommendation === "block")) return "blocked";
  if (overlaps.some((overlap) => overlap.recommendation === "require_review")) return "requires_human_review";
  if (worst.severity === "high") return "conflict_risk";
  return "overlap_warning";
}

function groupMode(overlaps: AgentSessionOverlap[], worst: AgentSessionOverlap | undefined): AgentRunCoordinationMode {
  if (!worst) return "isolated_by_workspace";
  if (overlaps.some((overlap) => overlap.recommendation === "block")) return "blocked";
  if (overlaps.some((overlap) => overlap.recommendation === "serialize" || overlap.recommendation === "require_review")) return "serialized";
  return "allow_parallel_with_warnings";
}

function strongestRecommendation(overlaps: AgentSessionOverlap[]): AgentSessionOverlapRecommendation {
  return overlaps
    .map((overlap) => overlap.recommendation)
    .sort((left, right) => recommendationRank[right] - recommendationRank[left])[0] ?? "allow";
}

function worstOverlap(overlaps: AgentSessionOverlap[]): AgentSessionOverlap | undefined {
  return [...overlaps].sort((left, right) =>
    severityRank[right.severity] - severityRank[left.severity] ||
    recommendationRank[right.recommendation] - recommendationRank[left.recommendation] ||
    left.id.localeCompare(right.id))[0];
}

function recommendationReasons(overlaps: AgentSessionOverlap[], group: AgentRunCoordinationGroup): string[] {
  if (overlaps.length === 0) {
    return ["active_sessions_have_distinct_branch_workspace_and_file_metadata"];
  }
  return unique([
    ...overlaps.map((overlap) => `${overlap.overlapKind}:${overlap.recommendation}`),
    `coordination_mode:${group.coordinationMode}`,
    `group_status:${group.status}`
  ]);
}

function groupId(repoId: string, baseBranch: string, taskId?: string, userId?: string): string {
  return `coord_${slugify(repoId)}_${slugify(baseBranch)}_${slugify(taskId ?? "multi-task")}_${slugify(userId ?? "multi-user")}`;
}

function sourceScopeKey(session: AgentSession): string {
  return `${session.sourceScope.scopeKind}:${session.sourceScope.paths.join(",") || "unknown"}`;
}

function contextMetadata(context: AgentRunCoordinationContext): Record<string, unknown> {
  return sanitizeMetadata({
    requestId: context.requestId,
    correlationId: context.correlationId,
    principalId: context.principalId,
    serviceAccountId: context.serviceAccountId,
    source: context.source,
    ...context.metadata
  });
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const clone = cloneRecord(metadata);
  for (const key of Object.keys(clone)) {
    const lowered = key.toLowerCase();
    if (lowered.includes("token") || lowered.includes("secret") || lowered.includes("password") || lowered.includes("credential") || lowered.includes("key")) {
      clone[key] = "[redacted]";
      continue;
    }
    const value = clone[key];
    if (typeof value === "string" && /(OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|VAULT_TOKEN|DATABASE_URL|AICHESTRA_[A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD))=/i.test(value)) {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(value);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
