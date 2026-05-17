import path from "node:path";
import { createId } from "@aichestra/core";
import { LocalAgentWorkspaceManager } from "./workspace.ts";
import type { AgentWorkspaceManager } from "./agent-runner.ts";

export type AgentWorkspaceKind =
  | "fixture"
  | "git_worktree_future"
  | "clone_future"
  | "remote_workspace_future";

export type AgentWorkspaceLifecycleStatus =
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

export type AgentWorkspaceIsolationStatus = "isolated" | "shared_forbidden" | "unknown";

export type AgentWorkspaceLifecycleEventType =
  | "requested"
  | "allocated"
  | "activated"
  | "frozen"
  | "ready_for_merge"
  | "merge_completed"
  | "abandoned"
  | "cleanup_requested"
  | "cleanup_completed"
  | "cleanup_blocked"
  | "failed";

export type AgentWorkspaceCleanupDecisionValue =
  | "keep"
  | "cleanup_allowed"
  | "cleanup_blocked_dirty"
  | "cleanup_blocked_uncommitted"
  | "cleanup_blocked_unmerged"
  | "cleanup_blocked_policy"
  | "future_manual_review";

export type AgentWorkspaceMergeStatus = "unknown" | "ready_for_merge" | "merged" | "unmerged";

export type AgentWorkspaceLease = {
  id: string;
  taskId: string;
  taskRunId?: string;
  agentRunId: string;
  repoId: string;
  branchLeaseId?: string;
  branchName: string;
  baseBranch: string;
  workspaceKind: AgentWorkspaceKind;
  workspacePath: string;
  status: AgentWorkspaceLifecycleStatus;
  isolationStatus: AgentWorkspaceIsolationStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  ownerActorId: string;
  ownerServiceAccountId?: string;
  metadata: Record<string, unknown>;
};

export type AgentWorkspaceLifecycleEvent = {
  id: string;
  workspaceLeaseId: string;
  eventType: AgentWorkspaceLifecycleEventType;
  actorId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
};

export type AgentWorkspaceCleanupDecision = {
  id: string;
  workspaceLeaseId: string;
  decision: AgentWorkspaceCleanupDecisionValue;
  reason: string;
  changedFiles: string[];
  uncommittedChanges: boolean;
  mergeStatus: AgentWorkspaceMergeStatus;
  policyDecisionId?: string;
  metadata: Record<string, unknown>;
  evaluatedAt: Date;
};

export type AgentWorkspaceLifecycleContext = {
  actorId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

export type AgentWorkspaceRequestInput = {
  taskId: string;
  taskRunId?: string;
  agentRunId: string;
  repoId: string;
  branchLeaseId?: string;
  branchName: string;
  baseBranch: string;
  workspaceKind: AgentWorkspaceKind;
  workspacePath?: string;
  expiresAt?: Date;
  ownerActorId?: string;
  ownerServiceAccountId?: string;
  metadata?: Record<string, unknown>;
};

export type AllocateFixtureWorkspaceInput = Omit<AgentWorkspaceRequestInput, "workspaceKind"> & {
  workspacePath: string;
};

export type CleanupEvaluationInput = {
  changedFiles?: string[];
  dirty?: boolean;
  uncommittedChanges?: boolean;
  mergeStatus?: AgentWorkspaceMergeStatus;
  policyAllowed?: boolean;
  policyDecisionId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type AgentWorkspaceLifecycleQuery = {
  taskId?: string;
  taskRunId?: string;
  agentRunId?: string;
  repoId?: string;
  branchLeaseId?: string;
  status?: AgentWorkspaceLifecycleStatus;
  workspaceKind?: AgentWorkspaceKind;
};

export type AgentWorkspaceLifecycleRepository = {
  saveLease(input: AgentWorkspaceLease): AgentWorkspaceLease;
  updateLease(id: string, patch: Partial<Omit<AgentWorkspaceLease, "id" | "createdAt">>): AgentWorkspaceLease;
  getLease(id: string): AgentWorkspaceLease | undefined;
  listLeases(query?: AgentWorkspaceLifecycleQuery): AgentWorkspaceLease[];
  appendEvent(input: AgentWorkspaceLifecycleEvent): AgentWorkspaceLifecycleEvent;
  listEvents(workspaceLeaseId?: string): AgentWorkspaceLifecycleEvent[];
  saveCleanupDecision(input: AgentWorkspaceCleanupDecision): AgentWorkspaceCleanupDecision;
  listCleanupDecisions(workspaceLeaseId?: string): AgentWorkspaceCleanupDecision[];
  getLatestCleanupDecision(workspaceLeaseId: string): AgentWorkspaceCleanupDecision | undefined;
};

const activeWorkspaceStatuses = new Set<AgentWorkspaceLifecycleStatus>([
  "requested",
  "allocated",
  "active",
  "frozen",
  "ready_for_merge",
  "cleanup_pending"
]);

function cloneLease(lease: AgentWorkspaceLease): AgentWorkspaceLease {
  return structuredClone(lease);
}

function normalizeWorkspacePath(workspacePath: string): string {
  if (workspacePath.startsWith("[future-workspace]")) return workspacePath;
  return path.resolve(workspacePath);
}

function pathKey(workspacePath: string): string {
  return normalizeWorkspacePath(workspacePath).toLowerCase();
}

export function sanitizeWorkspacePathForDto(workspacePath: string): string {
  if (workspacePath.startsWith("[future-workspace]")) return workspacePath;
  const normalized = path.normalize(workspacePath);
  const basename = path.basename(normalized);
  return basename ? `[workspace-path]/${basename}` : "[workspace-path]";
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

function isSensitiveMetadataKey(key: string): boolean {
  return /token|secret|password|credential|authorization|cookie|private[_-]?key|api[_-]?key|env(ironment)?[_-]?value/i.test(key);
}

export function sanitizeWorkspaceLifecycleMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => {
    if (isSensitiveMetadataKey(key)) return [key, "[redacted]"];
    if (Array.isArray(value)) {
      return [key, value.map((item) => isPlainRecord(item) ? sanitizeWorkspaceLifecycleMetadata(item) : item)];
    }
    if (isPlainRecord(value)) return [key, sanitizeWorkspaceLifecycleMetadata(value)];
    if (typeof value === "string" && path.isAbsolute(value)) return [key, sanitizeWorkspacePathForDto(value)];
    return [key, value];
  }));
}

function ownerActor(input: AgentWorkspaceRequestInput, context: AgentWorkspaceLifecycleContext): string {
  return input.ownerActorId ?? context.actorId ?? "runner_service";
}

function eventFromContext(
  workspaceLeaseId: string,
  eventType: AgentWorkspaceLifecycleEventType,
  context: AgentWorkspaceLifecycleContext,
  metadata: Record<string, unknown> = {}
): AgentWorkspaceLifecycleEvent {
  return {
    id: createId("agentwsevent"),
    workspaceLeaseId,
    eventType,
    actorId: context.actorId,
    serviceAccountId: context.serviceAccountId,
    requestId: context.requestId,
    correlationId: context.correlationId,
    timestamp: new Date(),
    metadata: sanitizeWorkspaceLifecycleMetadata({
      ...context.metadata,
      ...metadata
    })
  };
}

export class InMemoryAgentWorkspaceLifecycleRepository implements AgentWorkspaceLifecycleRepository {
  private readonly leases: AgentWorkspaceLease[] = [];
  private readonly events: AgentWorkspaceLifecycleEvent[] = [];
  private readonly cleanupDecisions: AgentWorkspaceCleanupDecision[] = [];

  saveLease(input: AgentWorkspaceLease): AgentWorkspaceLease {
    this.leases.push(cloneLease(input));
    return cloneLease(input);
  }

  updateLease(id: string, patch: Partial<Omit<AgentWorkspaceLease, "id" | "createdAt">>): AgentWorkspaceLease {
    const lease = this.leases.find((candidate) => candidate.id === id);
    if (!lease) {
      throw new Error(`Agent workspace lease not found: ${id}`);
    }
    Object.assign(lease, structuredClone(patch), { updatedAt: new Date() });
    return cloneLease(lease);
  }

  getLease(id: string): AgentWorkspaceLease | undefined {
    const lease = this.leases.find((candidate) => candidate.id === id);
    return lease ? cloneLease(lease) : undefined;
  }

  listLeases(query: AgentWorkspaceLifecycleQuery = {}): AgentWorkspaceLease[] {
    return this.leases
      .filter((lease) =>
        (query.taskId === undefined || lease.taskId === query.taskId) &&
        (query.taskRunId === undefined || lease.taskRunId === query.taskRunId) &&
        (query.agentRunId === undefined || lease.agentRunId === query.agentRunId) &&
        (query.repoId === undefined || lease.repoId === query.repoId) &&
        (query.branchLeaseId === undefined || lease.branchLeaseId === query.branchLeaseId) &&
        (query.status === undefined || lease.status === query.status) &&
        (query.workspaceKind === undefined || lease.workspaceKind === query.workspaceKind)
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(cloneLease);
  }

  appendEvent(input: AgentWorkspaceLifecycleEvent): AgentWorkspaceLifecycleEvent {
    this.events.push(structuredClone(input));
    return structuredClone(input);
  }

  listEvents(workspaceLeaseId?: string): AgentWorkspaceLifecycleEvent[] {
    return this.events
      .filter((event) => workspaceLeaseId === undefined || event.workspaceLeaseId === workspaceLeaseId)
      .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime())
      .map((event) => structuredClone(event));
  }

  saveCleanupDecision(input: AgentWorkspaceCleanupDecision): AgentWorkspaceCleanupDecision {
    this.cleanupDecisions.push(structuredClone(input));
    return structuredClone(input);
  }

  listCleanupDecisions(workspaceLeaseId?: string): AgentWorkspaceCleanupDecision[] {
    return this.cleanupDecisions
      .filter((decision) => workspaceLeaseId === undefined || decision.workspaceLeaseId === workspaceLeaseId)
      .sort((left, right) => left.evaluatedAt.getTime() - right.evaluatedAt.getTime())
      .map((decision) => structuredClone(decision));
  }

  getLatestCleanupDecision(workspaceLeaseId: string): AgentWorkspaceCleanupDecision | undefined {
    return this.listCleanupDecisions(workspaceLeaseId).at(-1);
  }
}

export type AgentWorkspaceLifecycleServiceInput = {
  repository?: AgentWorkspaceLifecycleRepository;
  workspaceManager?: AgentWorkspaceManager;
};

export class AgentWorkspaceLifecycleService {
  private readonly repository: AgentWorkspaceLifecycleRepository;
  private readonly workspaceManager: AgentWorkspaceManager;

  constructor(input: AgentWorkspaceLifecycleServiceInput = {}) {
    this.repository = input.repository ?? new InMemoryAgentWorkspaceLifecycleRepository();
    this.workspaceManager = input.workspaceManager ?? new LocalAgentWorkspaceManager();
  }

  requestWorkspace(input: AgentWorkspaceRequestInput, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    const existing = this.activeLeaseForAgentRun(input.agentRunId);
    if (existing) {
      this.repository.appendEvent(eventFromContext(existing.id, "requested", context, {
        duplicateRequest: true,
        existingWorkspaceLeaseId: existing.id
      }));
      return existing;
    }

    const workspacePath = input.workspacePath ?? `[future-workspace]/${input.repoId}/${input.branchName}`;
    const hasConcreteWorkspacePath = !workspacePath.startsWith("[future-workspace]");
    const isolationStatus = input.workspaceKind === "fixture" || hasConcreteWorkspacePath
      ? this.isSharedPath(workspacePath, input.agentRunId) ? "shared_forbidden" : "isolated"
      : "unknown";
    const status: AgentWorkspaceLifecycleStatus = isolationStatus === "shared_forbidden" ? "failed" : "requested";
    const lease = this.repository.saveLease({
      id: createId("agentwslease"),
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      agentRunId: input.agentRunId,
      repoId: input.repoId,
      branchLeaseId: input.branchLeaseId,
      branchName: input.branchName,
      baseBranch: input.baseBranch,
      workspaceKind: input.workspaceKind,
      workspacePath: normalizeWorkspacePath(workspacePath),
      status,
      isolationStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: input.expiresAt,
      ownerActorId: ownerActor(input, context),
      ownerServiceAccountId: input.ownerServiceAccountId ?? context.serviceAccountId,
      metadata: sanitizeWorkspaceLifecycleMetadata({
        ...input.metadata,
        futureWorktreeExecutionEnabled: false,
        destructiveCleanupEnabled: false,
        reason: isolationStatus === "shared_forbidden" ? "shared_workspace_forbidden" : undefined
      })
    });
    this.repository.appendEvent(eventFromContext(lease.id, status === "failed" ? "failed" : "requested", context, {
      workspaceKind: lease.workspaceKind,
      isolationStatus: lease.isolationStatus,
      branchLeaseId: lease.branchLeaseId
    }));
    return lease;
  }

  async allocateFixtureWorkspace(input: AllocateFixtureWorkspaceInput, context: AgentWorkspaceLifecycleContext = {}): Promise<AgentWorkspaceLease> {
    const existing = this.activeLeaseForAgentRun(input.agentRunId);
    if (existing) {
      this.repository.appendEvent(eventFromContext(existing.id, "allocated", context, {
        duplicateAllocation: true,
        existingWorkspaceLeaseId: existing.id
      }));
      return existing;
    }

    const validation = await this.workspaceManager.validateWorkspace(input.workspacePath, { allowRepositoryRootFixture: false });
    const shared = validation.ok && this.isSharedPath(validation.resolvedPath ?? input.workspacePath, input.agentRunId);
    const status: AgentWorkspaceLifecycleStatus = validation.ok && !shared ? "allocated" : "failed";
    const lease = this.repository.saveLease({
      id: createId("agentwslease"),
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      agentRunId: input.agentRunId,
      repoId: input.repoId,
      branchLeaseId: input.branchLeaseId,
      branchName: input.branchName,
      baseBranch: input.baseBranch,
      workspaceKind: "fixture",
      workspacePath: normalizeWorkspacePath(validation.resolvedPath ?? input.workspacePath),
      status,
      isolationStatus: shared ? "shared_forbidden" : validation.ok ? "isolated" : "unknown",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: input.expiresAt,
      ownerActorId: ownerActor({ ...input, workspaceKind: "fixture" }, context),
      ownerServiceAccountId: input.ownerServiceAccountId ?? context.serviceAccountId,
      metadata: sanitizeWorkspaceLifecycleMetadata({
        ...input.metadata,
        validationReason: validation.reason,
        fixtureOnly: true,
        futureWorktreeExecutionEnabled: false,
        destructiveCleanupEnabled: false,
        reason: shared ? "shared_workspace_forbidden" : validation.ok ? undefined : validation.reason
      })
    });
    this.repository.appendEvent(eventFromContext(lease.id, status === "allocated" ? "allocated" : "failed", context, {
      workspaceKind: "fixture",
      validationReason: validation.reason,
      isolationStatus: lease.isolationStatus,
      branchLeaseId: lease.branchLeaseId
    }));
    return lease;
  }

  markActive(workspaceId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.transition(workspaceId, "active", "activated", context);
  }

  freezeWorkspace(workspaceId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.transition(workspaceId, "frozen", "frozen", context);
  }

  markReadyForMerge(workspaceId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.transition(workspaceId, "ready_for_merge", "ready_for_merge", context);
  }

  recordMergeCompleted(workspaceId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.transition(workspaceId, "merged", "merge_completed", context);
  }

  abandonWorkspace(workspaceId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.transition(workspaceId, "abandoned", "abandoned", context);
  }

  requestCleanup(workspaceId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.transition(workspaceId, "cleanup_pending", "cleanup_requested", context);
  }

  evaluateCleanup(
    workspaceId: string,
    input: CleanupEvaluationInput = {},
    context: AgentWorkspaceLifecycleContext = {}
  ): AgentWorkspaceCleanupDecision {
    const lease = this.requireLease(workspaceId);
    const changedFiles = input.changedFiles ?? [];
    const uncommittedChanges = input.uncommittedChanges ?? false;
    const mergeStatus = input.mergeStatus ?? "unknown";
    const policyAllowed = input.policyAllowed ?? true;
    const dirty = input.dirty ?? changedFiles.length > 0;
    let decision: AgentWorkspaceCleanupDecisionValue = "keep";
    let reason = input.reason ?? "workspace_retained";

    if (!policyAllowed) {
      decision = "cleanup_blocked_policy";
      reason = input.reason ?? "cleanup_policy_denied";
    } else if (lease.workspaceKind !== "fixture") {
      decision = "future_manual_review";
      reason = input.reason ?? "future_workspace_cleanup_requires_manual_review";
    } else if (dirty) {
      decision = "cleanup_blocked_dirty";
      reason = input.reason ?? "workspace_has_changed_files";
    } else if (uncommittedChanges) {
      decision = "cleanup_blocked_uncommitted";
      reason = input.reason ?? "workspace_has_uncommitted_changes";
    } else if (mergeStatus === "unmerged") {
      decision = "cleanup_blocked_unmerged";
      reason = input.reason ?? "workspace_not_merged";
    } else {
      decision = "cleanup_allowed";
      reason = input.reason ?? "fixture_workspace_cleanup_allowed_metadata_only";
    }

    const cleanupDecision = this.repository.saveCleanupDecision({
      id: createId("agentwscleanup"),
      workspaceLeaseId: workspaceId,
      decision,
      reason,
      changedFiles,
      uncommittedChanges,
      mergeStatus,
      policyDecisionId: input.policyDecisionId,
      metadata: sanitizeWorkspaceLifecycleMetadata({
        ...context.metadata,
        ...input.metadata,
        destructiveCleanupExecuted: false,
        nonFixtureDeletionAllowed: false
      }),
      evaluatedAt: new Date()
    });
    this.repository.appendEvent(eventFromContext(workspaceId, decision === "cleanup_allowed" ? "cleanup_requested" : "cleanup_blocked", context, {
      cleanupDecisionId: cleanupDecision.id,
      decision,
      reason
    }));
    return cleanupDecision;
  }

  recordCleanupCompleted(workspaceId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    const lease = this.requireLease(workspaceId);
    const latestDecision = this.repository.getLatestCleanupDecision(workspaceId);
    if (lease.workspaceKind !== "fixture" || latestDecision?.decision !== "cleanup_allowed") {
      this.repository.appendEvent(eventFromContext(workspaceId, "cleanup_blocked", context, {
        reason: lease.workspaceKind !== "fixture" ? "non_fixture_cleanup_not_executed" : "cleanup_allowed_decision_missing",
        destructiveCleanupExecuted: false
      }));
      return lease;
    }
    return this.transition(workspaceId, "cleaned", "cleanup_completed", context, {
      destructiveCleanupExecuted: false,
      fixtureMetadataOnly: true
    });
  }

  listWorkspaces(query: AgentWorkspaceLifecycleQuery = {}): AgentWorkspaceLease[] {
    return this.repository.listLeases(query);
  }

  getWorkspace(workspaceId: string): AgentWorkspaceLease | undefined {
    return this.repository.getLease(workspaceId);
  }

  listEvents(workspaceId?: string): AgentWorkspaceLifecycleEvent[] {
    return this.repository.listEvents(workspaceId);
  }

  listCleanupDecisions(workspaceId?: string): AgentWorkspaceCleanupDecision[] {
    return this.repository.listCleanupDecisions(workspaceId);
  }

  getLatestCleanupDecision(workspaceId: string): AgentWorkspaceCleanupDecision | undefined {
    return this.repository.getLatestCleanupDecision(workspaceId);
  }

  private activeLeaseForAgentRun(agentRunId: string): AgentWorkspaceLease | undefined {
    return this.repository
      .listLeases({ agentRunId })
      .find((lease) => activeWorkspaceStatuses.has(lease.status));
  }

  private isSharedPath(workspacePath: string, agentRunId: string): boolean {
    const key = pathKey(workspacePath);
    return this.repository
      .listLeases()
      .some((lease) =>
        lease.agentRunId !== agentRunId &&
        activeWorkspaceStatuses.has(lease.status) &&
        pathKey(lease.workspacePath) === key
      );
  }

  private requireLease(workspaceId: string): AgentWorkspaceLease {
    const lease = this.repository.getLease(workspaceId);
    if (!lease) {
      throw new Error(`Agent workspace lease not found: ${workspaceId}`);
    }
    return lease;
  }

  private transition(
    workspaceId: string,
    status: AgentWorkspaceLifecycleStatus,
    eventType: AgentWorkspaceLifecycleEventType,
    context: AgentWorkspaceLifecycleContext,
    metadata: Record<string, unknown> = {}
  ): AgentWorkspaceLease {
    const lease = this.repository.updateLease(workspaceId, {
      status,
      metadata: sanitizeWorkspaceLifecycleMetadata({
        ...this.requireLease(workspaceId).metadata,
        ...metadata
      })
    });
    this.repository.appendEvent(eventFromContext(workspaceId, eventType, context, {
      status,
      ...metadata
    }));
    return lease;
  }
}

export function agentWorkspaceLeaseToDto(lease: AgentWorkspaceLease) {
  return {
    ...lease,
    workspacePath: sanitizeWorkspacePathForDto(lease.workspacePath),
    workspacePathRedacted: !lease.workspacePath.startsWith("[future-workspace]"),
    workspacePathBasename: lease.workspacePath.startsWith("[future-workspace]") ? null : path.basename(lease.workspacePath),
    createdAt: lease.createdAt.toISOString(),
    updatedAt: lease.updatedAt.toISOString(),
    expiresAt: lease.expiresAt?.toISOString(),
    metadata: sanitizeWorkspaceLifecycleMetadata(lease.metadata)
  };
}

export function agentWorkspaceLifecycleEventToDto(event: AgentWorkspaceLifecycleEvent) {
  return {
    ...event,
    timestamp: event.timestamp.toISOString(),
    metadata: sanitizeWorkspaceLifecycleMetadata(event.metadata)
  };
}

export function agentWorkspaceCleanupDecisionToDto(decision: AgentWorkspaceCleanupDecision) {
  return {
    ...decision,
    evaluatedAt: decision.evaluatedAt.toISOString(),
    metadata: sanitizeWorkspaceLifecycleMetadata(decision.metadata)
  };
}

export function workspaceLeaseIdFromMetadata(metadata: Record<string, unknown>): string | undefined {
  return stringMetadata(metadata.workspaceLeaseId);
}
