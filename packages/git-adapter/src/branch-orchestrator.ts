import { createId, slugify } from "@aichestra/core";
import type { BranchLease, MergeQueueEntry, Repo } from "@aichestra/core";

export type BranchPurpose =
  | "agent_work"
  | "conflict_resolution"
  | "review_fixup"
  | "merge_candidate"
  | "experiment";

export type BranchOrchestrationDecisionValue =
  | "allocated"
  | "reused_existing_lease"
  | "blocked_collision"
  | "blocked_policy"
  | "blocked_same_workspace"
  | "warning_base_branch_drift"
  | "future_manual_review";

export type BranchOwnershipStatus =
  | "active"
  | "frozen"
  | "ready_for_review"
  | "ready_for_merge"
  | "merged"
  | "abandoned"
  | "expired";

export type BaseBranchDriftStatusValue =
  | "current"
  | "behind_base"
  | "base_changed"
  | "unknown"
  | "future_check_required";

export type BaseBranchDriftSeverity = "low" | "medium" | "high" | "critical";

export type BaseBranchDriftRecommendation =
  | "continue"
  | "refresh_needed"
  | "rebase_future"
  | "merge_base_future"
  | "manual_review";

export type BranchOrchestrationSourceScope = {
  scopeKind: "repo" | "directory" | "file" | "symbol" | "unknown";
  paths: string[];
  description?: string;
  metadata: Record<string, unknown>;
};

export type BranchOrchestrationRequest = {
  id: string;
  userId: string;
  actorId: string;
  taskId?: string;
  taskRunId?: string;
  agentRunId: string;
  sessionId?: string;
  repoId: string;
  baseBranch: string;
  requestedBranchName?: string;
  branchPurpose: BranchPurpose;
  targetFiles: string[];
  sourceScope: BranchOrchestrationSourceScope;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type BranchOrchestrationDecision = {
  id: string;
  requestId: string;
  decision: BranchOrchestrationDecisionValue;
  branchName: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  reason: string;
  warnings: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type BranchNamingPolicy = {
  id: string;
  prefix: string;
  pattern: string;
  maxLength: number;
  includeUser: boolean;
  includeTask: boolean;
  includeAgentRun: boolean;
  includeTimestamp: boolean;
  sanitizeRules: string[];
  forbiddenPatterns: string[];
  metadata: Record<string, unknown>;
};

export type BranchOwnershipRecord = {
  id: string;
  branchName: string;
  repoId: string;
  baseBranch: string;
  userId: string;
  actorId: string;
  taskId?: string;
  taskRunId?: string;
  agentRunId?: string;
  sessionId?: string;
  branchLeaseId: string;
  workspaceLeaseId?: string;
  status: BranchOwnershipStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
};

export type BaseBranchDriftStatus = {
  id: string;
  repoId: string;
  baseBranch: string;
  branchName: string;
  status: BaseBranchDriftStatusValue;
  severity: BaseBranchDriftSeverity;
  recommendation: BaseBranchDriftRecommendation;
  metadata: Record<string, unknown>;
  evaluatedAt: Date;
};

export type BranchOrchestratorAuditEvent = {
  id: string;
  eventType: string;
  requestId?: string;
  decisionId?: string;
  ownershipRecordId?: string;
  repoId?: string;
  branchName?: string;
  result: "allocated" | "reused" | "warned" | "blocked" | "recorded";
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  correlationId?: string;
  source?: string;
  reason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type BranchOrchestrationContext = {
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type BranchOrchestrationInput = {
  id?: string;
  userId: string;
  actorId?: string;
  taskId?: string;
  taskRunId?: string;
  agentRunId: string;
  sessionId?: string;
  repoId: string;
  baseBranch?: string;
  requestedBranchName?: string;
  branchPurpose?: BranchPurpose;
  targetFiles?: string[];
  sourceScope?: Partial<BranchOrchestrationSourceScope>;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
};

export type BranchOwnershipQuery = {
  repoId?: string;
  userId?: string;
  taskId?: string;
  taskRunId?: string;
  agentRunId?: string;
  sessionId?: string;
  branchName?: string;
  status?: BranchOwnershipStatus;
};

export type BranchOrchestrationQuery = {
  repoId?: string;
  userId?: string;
  taskId?: string;
  sessionId?: string;
  decision?: BranchOrchestrationDecisionValue;
};

export type BaseBranchDriftQuery = {
  repoId?: string;
  branchName?: string;
  status?: BaseBranchDriftStatusValue;
};

export type BranchNameValidationResult =
  | { ok: true; branchName: string; warnings: string[] }
  | { ok: false; branchName: string; reason: string; warnings: string[] };

export type BranchCollisionResult = {
  repoId: string;
  branchName: string;
  collision: boolean;
  blocking: boolean;
  reason?: string;
  ownershipRecordIds: string[];
  branchLeaseIds: string[];
  sessionIds: string[];
  metadata: Record<string, unknown>;
};

export type BranchOrchestratorSummary = {
  status: "v2_implemented";
  requests: number;
  decisions: number;
  activeOwnershipRecords: number;
  ownershipRecords: number;
  blockedCollisions: number;
  sameWorkspaceBlockers: number;
  baseBranchDriftWarnings: number;
  readyForReview: number;
  readyForMerge: number;
  branchNamingPolicy: BranchNamingPolicy;
  noDestructiveGit: true;
  remoteGitOperation: false;
  branchDeletion: false;
  workspaceMutation: false;
  secretsExposed: false;
  metadata: Record<string, unknown>;
};

export type BranchOrchestratorRepository = {
  saveRequest(request: BranchOrchestrationRequest): BranchOrchestrationRequest;
  getRequest(id: string): BranchOrchestrationRequest | undefined;
  listRequests(query?: BranchOrchestrationQuery): BranchOrchestrationRequest[];
  saveDecision(decision: BranchOrchestrationDecision): BranchOrchestrationDecision;
  getDecision(id: string): BranchOrchestrationDecision | undefined;
  listDecisions(query?: BranchOrchestrationQuery): BranchOrchestrationDecision[];
  saveOwnership(record: BranchOwnershipRecord): BranchOwnershipRecord;
  updateOwnership(id: string, patch: Partial<Omit<BranchOwnershipRecord, "id" | "createdAt">>): BranchOwnershipRecord;
  getOwnership(id: string): BranchOwnershipRecord | undefined;
  listOwnership(query?: BranchOwnershipQuery): BranchOwnershipRecord[];
  saveDriftStatus(status: BaseBranchDriftStatus): BaseBranchDriftStatus;
  listDriftStatuses(query?: BaseBranchDriftQuery): BaseBranchDriftStatus[];
  saveNamingPolicy(policy: BranchNamingPolicy): BranchNamingPolicy;
  listNamingPolicies(): BranchNamingPolicy[];
  appendAuditEvent(event: Omit<BranchOrchestratorAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): BranchOrchestratorAuditEvent;
  listAuditEvents(filter?: { repoId?: string; branchName?: string; requestId?: string }): BranchOrchestratorAuditEvent[];
};

export type BranchLeaseCreator = (input: Omit<BranchLease, "id" | "createdAt" | "updatedAt">) => BranchLease;

export type BranchOrchestratorServiceOptions = {
  repository?: BranchOrchestratorRepository;
  namingPolicy?: BranchNamingPolicy;
  repoLookup?: (repoId: string) => Pick<Repo, "id" | "owner" | "name" | "defaultBranch"> | undefined;
  branchLeaseLookup?: (branchLeaseId: string) => BranchLease | undefined;
  activeBranchLeaseLookup?: (repoId: string, branchName: string) => BranchLease[];
  branchLeaseCreator?: BranchLeaseCreator;
  workspaceLeaseLookup?: (workspaceLeaseId: string) => { id: string; agentRunId?: string; repoId?: string; branchName?: string; status?: string } | undefined;
  sessionLookup?: (query: { repoId?: string; branchName?: string; status?: string }) => Array<{ id: string; repoId: string; branchName?: string; sessionId?: string; agentRunId?: string; status?: string; workspaceLeaseId?: string }>;
  mergeQueueLookup?: (query: { repoId?: string; branchLeaseId?: string; branchName?: string; taskRunId?: string }) => MergeQueueEntry[];
};

const activeOwnershipStatuses = new Set<BranchOwnershipStatus>([
  "active",
  "frozen",
  "ready_for_review",
  "ready_for_merge"
]);

const reusableStatuses = new Set<BranchOwnershipStatus>([
  "active",
  "frozen",
  "ready_for_review",
  "ready_for_merge"
]);

const reservedBranchNames = new Set(["main", "master", "develop", "development", "trunk", "release", "head"]);

export function createDefaultBranchNamingPolicy(): BranchNamingPolicy {
  return {
    id: "branch_naming_aichestra_default_v2",
    prefix: "aichestra/",
    pattern: "aichestra/{repoSlug}/{taskId}/{agentRunId}",
    maxLength: 160,
    includeUser: false,
    includeTask: true,
    includeAgentRun: true,
    includeTimestamp: false,
    sanitizeRules: [
      "lowercase",
      "slash_separated_segments",
      "collapse_unsafe_characters_to_dash",
      "forbid_path_traversal",
      "forbid_reserved_branch_names",
      "enforce_prefix"
    ],
    forbiddenPatterns: ["main", "master", "develop", "release", "head", "force", "delete", "..", "refs/heads"],
    metadata: {
      deterministicByDefault: true,
      remoteGitOperation: false,
      branchCreationExecuted: false
    }
  };
}

export class InMemoryBranchOrchestratorRepository implements BranchOrchestratorRepository {
  private readonly requests: BranchOrchestrationRequest[] = [];
  private readonly decisions: BranchOrchestrationDecision[] = [];
  private readonly ownershipRecords: BranchOwnershipRecord[] = [];
  private readonly driftStatuses: BaseBranchDriftStatus[] = [];
  private readonly namingPolicies: BranchNamingPolicy[] = [createDefaultBranchNamingPolicy()];
  private readonly auditEvents: BranchOrchestratorAuditEvent[] = [];

  saveRequest(request: BranchOrchestrationRequest): BranchOrchestrationRequest {
    this.requests.push(clone(request));
    return clone(request);
  }

  getRequest(id: string): BranchOrchestrationRequest | undefined {
    return cloneMaybe(this.requests.find((request) => request.id === id));
  }

  listRequests(query: BranchOrchestrationQuery = {}): BranchOrchestrationRequest[] {
    const decisionByRequest = new Map(this.decisions.map((decision) => [decision.requestId, decision.decision]));
    return this.requests
      .filter((request) =>
        (query.repoId === undefined || request.repoId === query.repoId) &&
        (query.userId === undefined || request.userId === query.userId) &&
        (query.taskId === undefined || request.taskId === query.taskId) &&
        (query.sessionId === undefined || request.sessionId === query.sessionId) &&
        (query.decision === undefined || decisionByRequest.get(request.id) === query.decision))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }

  saveDecision(decision: BranchOrchestrationDecision): BranchOrchestrationDecision {
    this.decisions.push(clone(decision));
    return clone(decision);
  }

  getDecision(id: string): BranchOrchestrationDecision | undefined {
    return cloneMaybe(this.decisions.find((decision) => decision.id === id));
  }

  listDecisions(query: BranchOrchestrationQuery = {}): BranchOrchestrationDecision[] {
    const requestById = new Map(this.requests.map((request) => [request.id, request]));
    return this.decisions
      .filter((decision) => {
        const request = requestById.get(decision.requestId);
        return (query.repoId === undefined || request?.repoId === query.repoId) &&
          (query.userId === undefined || request?.userId === query.userId) &&
          (query.taskId === undefined || request?.taskId === query.taskId) &&
          (query.sessionId === undefined || request?.sessionId === query.sessionId) &&
          (query.decision === undefined || decision.decision === query.decision);
      })
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }

  saveOwnership(record: BranchOwnershipRecord): BranchOwnershipRecord {
    this.ownershipRecords.push(clone(record));
    return clone(record);
  }

  updateOwnership(id: string, patch: Partial<Omit<BranchOwnershipRecord, "id" | "createdAt">>): BranchOwnershipRecord {
    const record = this.ownershipRecords.find((candidate) => candidate.id === id);
    if (!record) {
      throw new Error(`Branch ownership record not found: ${id}`);
    }
    Object.assign(record, clone(patch), { updatedAt: patch.updatedAt ?? new Date() });
    return clone(record);
  }

  getOwnership(id: string): BranchOwnershipRecord | undefined {
    return cloneMaybe(this.ownershipRecords.find((record) => record.id === id));
  }

  listOwnership(query: BranchOwnershipQuery = {}): BranchOwnershipRecord[] {
    return this.ownershipRecords
      .filter((record) =>
        (query.repoId === undefined || record.repoId === query.repoId) &&
        (query.userId === undefined || record.userId === query.userId) &&
        (query.taskId === undefined || record.taskId === query.taskId) &&
        (query.taskRunId === undefined || record.taskRunId === query.taskRunId) &&
        (query.agentRunId === undefined || record.agentRunId === query.agentRunId) &&
        (query.sessionId === undefined || record.sessionId === query.sessionId) &&
        (query.branchName === undefined || record.branchName === query.branchName) &&
        (query.status === undefined || record.status === query.status))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }

  saveDriftStatus(status: BaseBranchDriftStatus): BaseBranchDriftStatus {
    this.driftStatuses.push(clone(status));
    return clone(status);
  }

  listDriftStatuses(query: BaseBranchDriftQuery = {}): BaseBranchDriftStatus[] {
    return this.driftStatuses
      .filter((status) =>
        (query.repoId === undefined || status.repoId === query.repoId) &&
        (query.branchName === undefined || status.branchName === query.branchName) &&
        (query.status === undefined || status.status === query.status))
      .sort((left, right) => right.evaluatedAt.getTime() - left.evaluatedAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }

  saveNamingPolicy(policy: BranchNamingPolicy): BranchNamingPolicy {
    const index = this.namingPolicies.findIndex((candidate) => candidate.id === policy.id);
    if (index >= 0) {
      this.namingPolicies[index] = clone(policy);
    } else {
      this.namingPolicies.push(clone(policy));
    }
    return clone(policy);
  }

  listNamingPolicies(): BranchNamingPolicy[] {
    return this.namingPolicies.map(clone);
  }

  appendAuditEvent(event: Omit<BranchOrchestratorAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): BranchOrchestratorAuditEvent {
    const saved: BranchOrchestratorAuditEvent = {
      ...event,
      id: event.id ?? createId("branchaudit"),
      createdAt: event.createdAt ?? new Date(),
      metadata: sanitizeMetadata(event.metadata)
    };
    this.auditEvents.push(clone(saved));
    return clone(saved);
  }

  listAuditEvents(filter: { repoId?: string; branchName?: string; requestId?: string } = {}): BranchOrchestratorAuditEvent[] {
    return this.auditEvents
      .filter((event) =>
        (filter.repoId === undefined || event.repoId === filter.repoId) &&
        (filter.branchName === undefined || event.branchName === filter.branchName) &&
        (filter.requestId === undefined || event.requestId === filter.requestId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class BranchOrchestratorService {
  private readonly repository: BranchOrchestratorRepository;
  private readonly namingPolicy: BranchNamingPolicy;
  private readonly repoLookup?: BranchOrchestratorServiceOptions["repoLookup"];
  private readonly branchLeaseLookup?: BranchOrchestratorServiceOptions["branchLeaseLookup"];
  private readonly activeBranchLeaseLookup?: BranchOrchestratorServiceOptions["activeBranchLeaseLookup"];
  private readonly branchLeaseCreator?: BranchOrchestratorServiceOptions["branchLeaseCreator"];
  private readonly workspaceLeaseLookup?: BranchOrchestratorServiceOptions["workspaceLeaseLookup"];
  private readonly sessionLookup?: BranchOrchestratorServiceOptions["sessionLookup"];
  private readonly mergeQueueLookup?: BranchOrchestratorServiceOptions["mergeQueueLookup"];

  constructor(options: BranchOrchestratorServiceOptions = {}) {
    this.repository = options.repository ?? new InMemoryBranchOrchestratorRepository();
    this.namingPolicy = options.namingPolicy ?? createDefaultBranchNamingPolicy();
    this.repository.saveNamingPolicy(this.namingPolicy);
    this.repoLookup = options.repoLookup;
    this.branchLeaseLookup = options.branchLeaseLookup;
    this.activeBranchLeaseLookup = options.activeBranchLeaseLookup;
    this.branchLeaseCreator = options.branchLeaseCreator;
    this.workspaceLeaseLookup = options.workspaceLeaseLookup;
    this.sessionLookup = options.sessionLookup;
    this.mergeQueueLookup = options.mergeQueueLookup;
  }

  requestBranch(input: BranchOrchestrationInput, context: BranchOrchestrationContext = {}): BranchOrchestrationRequest {
    const repo = this.repoLookup?.(input.repoId);
    const branchLease = input.branchLeaseId ? this.branchLeaseLookup?.(input.branchLeaseId) : undefined;
    const request: BranchOrchestrationRequest = {
      id: input.id ?? createId("branchrequest"),
      userId: input.userId,
      actorId: input.actorId ?? context.actorId ?? input.userId,
      taskId: input.taskId ?? branchLease?.taskId,
      taskRunId: input.taskRunId ?? branchLease?.taskRunId,
      agentRunId: input.agentRunId,
      sessionId: input.sessionId,
      repoId: input.repoId,
      baseBranch: input.baseBranch ?? branchLease?.baseBranch ?? repo?.defaultBranch ?? "main",
      requestedBranchName: input.requestedBranchName,
      branchPurpose: input.branchPurpose ?? "agent_work",
      targetFiles: normalizePaths(input.targetFiles ?? branchLease?.files ?? []),
      sourceScope: normalizeSourceScope(input.sourceScope),
      createdAt: new Date(),
      metadata: sanitizeMetadata({
        ...input.metadata,
        branchLeaseId: input.branchLeaseId,
        workspaceLeaseId: input.workspaceLeaseId,
        repoSlug: repo ? repoSlug(repo) : undefined,
        remoteGitOperation: false,
        branchCreationExecuted: false,
        workspaceMutation: false,
        ...contextMetadata(context)
      })
    };
    this.repository.saveRequest(request);
    this.recordAudit("branch_orchestration_requested", "recorded", context, {
      request,
      branchName: request.requestedBranchName,
      reason: "metadata_request_recorded"
    });
    return request;
  }

  allocateBranch(input: BranchOrchestrationInput, context: BranchOrchestrationContext = {}): BranchOrchestrationDecision {
    const request = this.requestBranch(input, context);
    const repo = this.repoLookup?.(request.repoId);
    const generated = !request.requestedBranchName;
    const candidate = request.requestedBranchName ?? this.generateBranchName(request, repo);
    const branchName = sanitizeBranchName(candidate, this.namingPolicy, { generated });
    const validation = validateBranchNameWithPolicy(branchName, this.namingPolicy, candidate);
    if (!validation.ok) {
      return this.saveDecision(request, {
        decision: "blocked_policy",
        branchName,
        reason: validation.reason,
        warnings: validation.warnings,
        workspaceLeaseId: input.workspaceLeaseId,
        context,
        metadata: { validation, requestedBranchName: request.requestedBranchName }
      });
    }

    const workspaceBlocker = this.detectSameWorkspaceBlocker(request, input.workspaceLeaseId);
    if (workspaceBlocker.blocking) {
      return this.saveDecision(request, {
        decision: "blocked_same_workspace",
        branchName,
        reason: workspaceBlocker.reason ?? "same_workspace_active_branch_ownership",
        warnings: ["workspace_lease_already_owned_by_active_branch"],
        workspaceLeaseId: input.workspaceLeaseId,
        context,
        metadata: workspaceBlocker.metadata
      });
    }

    const collision = this.detectBranchCollision(request.repoId, branchName, request);
    if (collision.blocking) {
      return this.saveDecision(request, {
        decision: "blocked_collision",
        branchName,
        reason: collision.reason ?? "active_branch_collision",
        warnings: ["branch_name_already_owned_by_active_session"],
        workspaceLeaseId: input.workspaceLeaseId,
        context,
        metadata: collision
      });
    }

    const reusable = this.findReusableOwnership(branchName, request);
    if (reusable) {
      return this.saveDecision(request, {
        decision: "reused_existing_lease",
        branchName,
        reason: "matching_active_branch_ownership_reused",
        warnings: validation.warnings,
        branchLeaseId: reusable.branchLeaseId,
        workspaceLeaseId: reusable.workspaceLeaseId,
        context,
        metadata: {
          ownershipRecordId: reusable.id,
          noBranchCreation: true
        }
      });
    }

    const branchLease = this.resolveOrCreateBranchLease(request, branchName, input.branchLeaseId);
    const drift = this.evaluateBaseBranchDriftForRequest(request, branchName, input.metadata);
    const ownership = this.repository.saveOwnership({
      id: createId("branchowner"),
      branchName,
      repoId: request.repoId,
      baseBranch: request.baseBranch,
      userId: request.userId,
      actorId: request.actorId,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      agentRunId: request.agentRunId,
      sessionId: request.sessionId,
      branchLeaseId: branchLease?.id ?? `metadata_${slugify(request.agentRunId)}`,
      workspaceLeaseId: input.workspaceLeaseId,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: input.expiresAt,
      metadata: sanitizeMetadata({
        requestId: request.id,
        branchPurpose: request.branchPurpose,
        targetFiles: request.targetFiles,
        sourceScope: request.sourceScope,
        branchLeaseStatus: branchLease?.status ?? "metadata_only",
        mergeQueue: this.mergeQueueMetadata(request, branchLease?.id, branchName),
        baseBranchDriftStatusId: drift.id,
        remoteGitOperation: false,
        branchCreationExecuted: false,
        workspaceMutation: false,
        noDestructiveGit: true,
        ...contextMetadata(context)
      })
    });
    this.recordAudit("branch_ownership_recorded", "allocated", context, {
      request,
      decisionId: undefined,
      ownershipRecordId: ownership.id,
      branchName,
      reason: "branch_ownership_metadata_recorded",
      branchLeaseId: ownership.branchLeaseId,
      workspaceLeaseId: ownership.workspaceLeaseId
    });
    const driftWarning = drift.status === "current" || drift.status === "unknown" ? undefined : drift;
    return this.saveDecision(request, {
      decision: driftWarning ? "warning_base_branch_drift" : "allocated",
      branchName,
      reason: driftWarning ? "branch_allocated_with_base_branch_drift_warning" : "branch_allocated_metadata_only",
      warnings: [...validation.warnings, ...(driftWarning ? [`base_branch_drift:${drift.status}`] : [])],
      branchLeaseId: ownership.branchLeaseId,
      workspaceLeaseId: ownership.workspaceLeaseId,
      context,
      metadata: {
        ownershipRecordId: ownership.id,
        baseBranchDriftStatusId: drift.id,
        branchLeaseCreated: branchLease !== undefined && branchLease.id !== input.branchLeaseId,
        noBranchCreation: true,
        noRemoteGit: true
      }
    });
  }

  validateBranchName(branchName: string): BranchNameValidationResult {
    const sanitized = sanitizeBranchName(branchName, this.namingPolicy, { generated: false });
    return validateBranchNameWithPolicy(sanitized, this.namingPolicy, branchName);
  }

  detectBranchCollision(repoId: string, branchName: string, request?: Pick<BranchOrchestrationRequest, "sessionId" | "agentRunId" | "taskRunId" | "userId">): BranchCollisionResult {
    const activeOwnerships = this.repository.listOwnership({ repoId, branchName })
      .filter((record) => activeOwnershipStatuses.has(record.status));
    const activeLeases = this.activeBranchLeaseLookup?.(repoId, branchName).filter((lease) => lease.status === "active") ?? [];
    const activeSessions = this.sessionLookup?.({ repoId, branchName }) ?? [];

    const blockingOwnerships = activeOwnerships.filter((record) => !sameLogicalOwner(record, request));
    const blockingLeases = activeLeases.filter((lease) => request?.taskRunId === undefined || lease.taskRunId !== request.taskRunId);
    const blockingSessions = activeSessions.filter((session) =>
      session.status !== "completed" &&
      session.status !== "failed" &&
      session.status !== "abandoned" &&
      request?.sessionId !== session.id &&
      request?.agentRunId !== session.agentRunId
    );
    const blocking = blockingOwnerships.length > 0 || blockingLeases.length > 0 || blockingSessions.length > 0;
    return {
      repoId,
      branchName,
      collision: activeOwnerships.length > 0 || activeLeases.length > 0 || activeSessions.length > 0,
      blocking,
      reason: blocking ? "active_branch_name_collision" : undefined,
      ownershipRecordIds: activeOwnerships.map((record) => record.id),
      branchLeaseIds: activeLeases.map((lease) => lease.id),
      sessionIds: activeSessions.map((session) => session.id),
      metadata: sanitizeMetadata({
        activeOwnershipCount: activeOwnerships.length,
        activeBranchLeaseCount: activeLeases.length,
        activeSessionCount: activeSessions.length,
        noRemoteGit: true,
        noBranchMutation: true
      })
    };
  }

  linkBranchLease(branchName: string, branchLeaseId: string, context: BranchOrchestrationContext = {}): BranchOwnershipRecord {
    const record = this.requireOwnershipByBranchName(branchName);
    const lease = this.branchLeaseLookup?.(branchLeaseId);
    const updated = this.repository.updateOwnership(record.id, {
      branchLeaseId,
      taskId: record.taskId ?? lease?.taskId,
      taskRunId: record.taskRunId ?? lease?.taskRunId,
      baseBranch: lease?.baseBranch ?? record.baseBranch,
      updatedAt: new Date(),
      metadata: sanitizeMetadata({
        ...record.metadata,
        branchLeaseStatus: lease?.status ?? "metadata_only",
        branchLeaseLinkedAt: new Date().toISOString(),
        ...contextMetadata(context)
      })
    });
    this.recordAudit("branch_lease_linked", "recorded", context, {
      ownershipRecordId: updated.id,
      branchName,
      branchLeaseId,
      reason: "branch_lease_metadata_linked"
    });
    return updated;
  }

  linkWorkspaceLease(branchName: string, workspaceLeaseId: string, context: BranchOrchestrationContext = {}): BranchOwnershipRecord {
    const record = this.requireOwnershipByBranchName(branchName);
    const shared = this.detectSameWorkspaceBlocker(record, workspaceLeaseId);
    const workspace = this.workspaceLeaseLookup?.(workspaceLeaseId);
    const updated = this.repository.updateOwnership(record.id, {
      workspaceLeaseId,
      status: shared.blocking ? "frozen" : record.status,
      updatedAt: new Date(),
      metadata: sanitizeMetadata({
        ...record.metadata,
        workspaceLeaseStatus: workspace?.status ?? "metadata_only",
        workspaceLeaseLinkedAt: new Date().toISOString(),
        sameWorkspaceBlocked: shared.blocking,
        ...contextMetadata(context)
      })
    });
    this.recordAudit(shared.blocking ? "branch_workspace_link_blocked" : "branch_workspace_linked", shared.blocking ? "blocked" : "recorded", context, {
      ownershipRecordId: updated.id,
      branchName,
      workspaceLeaseId,
      reason: shared.blocking ? "workspace_lease_already_owned_by_active_branch" : "workspace_lease_metadata_linked"
    });
    return updated;
  }

  markReadyForReview(branchName: string, context: BranchOrchestrationContext = {}): BranchOwnershipRecord {
    return this.markOwnershipStatus(branchName, "ready_for_review", "branch_ready_for_review", context);
  }

  markReadyForMerge(branchName: string, context: BranchOrchestrationContext = {}): BranchOwnershipRecord {
    return this.markOwnershipStatus(branchName, "ready_for_merge", "branch_ready_for_merge", context);
  }

  markMerged(branchName: string, context: BranchOrchestrationContext = {}): BranchOwnershipRecord {
    return this.markOwnershipStatus(branchName, "merged", "branch_marked_merged_metadata_only", context);
  }

  markAbandoned(branchName: string, context: BranchOrchestrationContext = {}): BranchOwnershipRecord {
    return this.markOwnershipStatus(branchName, "abandoned", "branch_marked_abandoned_metadata_only", context);
  }

  evaluateBaseBranchDrift(branchName: string): BaseBranchDriftStatus {
    const record = this.requireOwnershipByBranchName(branchName);
    const status = this.driftFromMetadata(record.repoId, record.baseBranch, branchName, record.metadata);
    return this.repository.saveDriftStatus(status);
  }

  listBranchOwnershipRecords(query: BranchOwnershipQuery = {}): BranchOwnershipRecord[] {
    return this.repository.listOwnership(query);
  }

  getBranchOwnershipRecord(id: string): BranchOwnershipRecord | undefined {
    return this.repository.getOwnership(id);
  }

  listOrchestrationRequests(query: BranchOrchestrationQuery = {}): BranchOrchestrationRequest[] {
    return this.repository.listRequests(query);
  }

  getOrchestrationRequest(id: string): BranchOrchestrationRequest | undefined {
    return this.repository.getRequest(id);
  }

  listOrchestrationDecisions(query: BranchOrchestrationQuery = {}): BranchOrchestrationDecision[] {
    return this.repository.listDecisions(query);
  }

  getOrchestrationDecision(id: string): BranchOrchestrationDecision | undefined {
    return this.repository.getDecision(id);
  }

  listBaseBranchDrift(query: BaseBranchDriftQuery = {}): BaseBranchDriftStatus[] {
    return this.repository.listDriftStatuses(query);
  }

  listNamingPolicies(): BranchNamingPolicy[] {
    return this.repository.listNamingPolicies();
  }

  listAuditEvents(filter: { repoId?: string; branchName?: string; requestId?: string } = {}): BranchOrchestratorAuditEvent[] {
    return this.repository.listAuditEvents(filter);
  }

  getSummary(): BranchOrchestratorSummary {
    const ownership = this.repository.listOwnership();
    const decisions = this.repository.listDecisions();
    const drift = this.repository.listDriftStatuses();
    return {
      status: "v2_implemented",
      requests: this.repository.listRequests().length,
      decisions: decisions.length,
      activeOwnershipRecords: ownership.filter((record) => activeOwnershipStatuses.has(record.status)).length,
      ownershipRecords: ownership.length,
      blockedCollisions: decisions.filter((decision) => decision.decision === "blocked_collision").length,
      sameWorkspaceBlockers: decisions.filter((decision) => decision.decision === "blocked_same_workspace").length +
        ownership.filter((record) => record.metadata.sameWorkspaceBlocked === true).length,
      baseBranchDriftWarnings: drift.filter((status) => status.status !== "current" && status.status !== "unknown").length,
      readyForReview: ownership.filter((record) => record.status === "ready_for_review").length,
      readyForMerge: ownership.filter((record) => record.status === "ready_for_merge").length,
      branchNamingPolicy: clone(this.namingPolicy),
      noDestructiveGit: true,
      remoteGitOperation: false,
      branchDeletion: false,
      workspaceMutation: false,
      secretsExposed: false,
      metadata: {
        storage: "in_memory",
        branchCreationExecuted: false,
        realWorkspaceMutation: false,
        mergeQueueMutation: false
      }
    };
  }

  private generateBranchName(request: BranchOrchestrationRequest, repo?: Pick<Repo, "owner" | "name">): string {
    const repoSegment = repo ? `${repo.owner}-${repo.name}` : request.repoId;
    const segments = [
      this.namingPolicy.prefix.replace(/\/+$/u, ""),
      repoSegment,
      this.namingPolicy.includeUser ? request.userId : undefined,
      this.namingPolicy.includeTask ? request.taskId ?? "task" : undefined,
      this.namingPolicy.includeAgentRun ? request.agentRunId : undefined,
      this.namingPolicy.includeTimestamp ? String(Math.floor(request.createdAt.getTime() / 1000)) : undefined
    ].filter(isString);
    return segments.join("/");
  }

  private resolveOrCreateBranchLease(request: BranchOrchestrationRequest, branchName: string, branchLeaseId?: string): BranchLease | undefined {
    if (branchLeaseId) return this.branchLeaseLookup?.(branchLeaseId);
    if (!this.branchLeaseCreator || !request.taskId || !request.taskRunId) return undefined;
    return this.branchLeaseCreator({
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      repoId: request.repoId,
      branchId: `branch_${slugify(request.taskRunId)}_${slugify(request.agentRunId)}`,
      branchName,
      baseBranch: request.baseBranch,
      files: request.targetFiles,
      symbols: request.sourceScope.scopeKind === "symbol" ? request.sourceScope.paths : [],
      tests: request.targetFiles.filter((file) => file.includes(".test.") || file.includes(".spec.") || file.startsWith("tests/")),
      status: "active"
    });
  }

  private findReusableOwnership(branchName: string, request: BranchOrchestrationRequest): BranchOwnershipRecord | undefined {
    return this.repository.listOwnership({ repoId: request.repoId, branchName })
      .find((record) => reusableStatuses.has(record.status) && sameLogicalOwner(record, request));
  }

  private detectSameWorkspaceBlocker(
    input: Pick<BranchOrchestrationRequest | BranchOwnershipRecord, "repoId" | "agentRunId">,
    workspaceLeaseId?: string
  ): { blocking: boolean; reason?: string; metadata: Record<string, unknown> } {
    if (!workspaceLeaseId) return { blocking: false, metadata: {} };
    const active = this.repository.listOwnership({ repoId: input.repoId })
      .filter((record) => activeOwnershipStatuses.has(record.status) && record.workspaceLeaseId === workspaceLeaseId && record.agentRunId !== input.agentRunId);
    return {
      blocking: active.length > 0,
      reason: active.length > 0 ? "workspace_lease_already_owned_by_active_branch" : undefined,
      metadata: sanitizeMetadata({
        workspaceLeaseId,
        ownershipRecordIds: active.map((record) => record.id),
        workspaceLeaseStatus: this.workspaceLeaseLookup?.(workspaceLeaseId)?.status,
        noWorkspaceMutation: true
      })
    };
  }

  private evaluateBaseBranchDriftForRequest(
    request: BranchOrchestrationRequest,
    branchName: string,
    metadata: Record<string, unknown> | undefined
  ): BaseBranchDriftStatus {
    return this.repository.saveDriftStatus(this.driftFromMetadata(request.repoId, request.baseBranch, branchName, metadata));
  }

  private driftFromMetadata(repoId: string, baseBranch: string, branchName: string, metadata: Record<string, unknown> | undefined): BaseBranchDriftStatus {
    const currentBaseBranch = stringMetadata(metadata?.currentBaseBranch);
    const explicitStatus = baseBranchDriftStatusValue(metadata?.baseBranchDriftStatus);
    let status: BaseBranchDriftStatusValue = explicitStatus ?? "unknown";
    if (!explicitStatus && currentBaseBranch) {
      status = currentBaseBranch === baseBranch ? "current" : "base_changed";
    } else if (!explicitStatus && metadata?.baseBranchDrift === true) {
      status = "behind_base";
    } else if (!explicitStatus && metadata?.futureBaseBranchCheckRequired === true) {
      status = "future_check_required";
    }
    const severity = driftSeverity(status);
    return {
      id: createId("basedrift"),
      repoId,
      baseBranch,
      branchName,
      status,
      severity,
      recommendation: driftRecommendation(status),
      metadata: sanitizeMetadata({
        currentBaseBranch,
        metadataOnly: true,
        noRebaseExecuted: true,
        noMergeExecuted: true
      }),
      evaluatedAt: new Date()
    };
  }

  private mergeQueueMetadata(request: BranchOrchestrationRequest, branchLeaseId: string | undefined, branchName: string): Record<string, unknown> {
    const entries = this.mergeQueueLookup?.({
      repoId: request.repoId,
      branchLeaseId,
      branchName,
      taskRunId: request.taskRunId
    }) ?? [];
    return {
      linkedEntryCount: entries.length,
      statuses: unique(entries.map((entry) => entry.status)),
      recommendations: unique(entries.map((entry) => entry.recommendation)),
      readyForMergeEntries: entries.filter((entry) => entry.status === "ready").length,
      metadataOnly: true,
      mergeQueueMutation: false
    };
  }

  private saveDecision(
    request: BranchOrchestrationRequest,
    input: {
      decision: BranchOrchestrationDecisionValue;
      branchName: string;
      branchLeaseId?: string;
      workspaceLeaseId?: string;
      reason: string;
      warnings: string[];
      context: BranchOrchestrationContext;
      metadata?: Record<string, unknown>;
    }
  ): BranchOrchestrationDecision {
    const decision = this.repository.saveDecision({
      id: createId("branchdecision"),
      requestId: request.id,
      decision: input.decision,
      branchName: input.branchName,
      branchLeaseId: input.branchLeaseId,
      workspaceLeaseId: input.workspaceLeaseId,
      reason: input.reason,
      warnings: [...new Set(input.warnings)],
      metadata: sanitizeMetadata({
        ...(input.metadata ?? {}),
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        agentRunId: request.agentRunId,
        sessionId: request.sessionId,
        repoId: request.repoId,
        noBranchCreation: true,
        noRemoteGit: true,
        noCheckout: true,
        noWorkspaceMutation: true,
        ...contextMetadata(input.context)
      }),
      createdAt: new Date()
    });
    const result = input.decision === "blocked_collision" || input.decision === "blocked_policy" || input.decision === "blocked_same_workspace"
      ? "blocked"
      : input.decision === "reused_existing_lease"
        ? "reused"
        : input.decision === "warning_base_branch_drift"
          ? "warned"
          : "allocated";
    this.recordAudit("branch_orchestration_decided", result, input.context, {
      request,
      decisionId: decision.id,
      branchName: decision.branchName,
      branchLeaseId: decision.branchLeaseId,
      workspaceLeaseId: decision.workspaceLeaseId,
      reason: decision.reason,
      decision: decision.decision
    });
    return decision;
  }

  private requireOwnershipByBranchName(branchName: string): BranchOwnershipRecord {
    const record = this.repository.listOwnership({ branchName })
      .filter((candidate) => activeOwnershipStatuses.has(candidate.status))
      .at(-1) ?? this.repository.listOwnership({ branchName }).at(-1);
    if (!record) {
      throw new Error(`Branch ownership record not found for branch: ${branchName}`);
    }
    return record;
  }

  private markOwnershipStatus(
    branchName: string,
    status: BranchOwnershipStatus,
    eventType: string,
    context: BranchOrchestrationContext
  ): BranchOwnershipRecord {
    const record = this.requireOwnershipByBranchName(branchName);
    const updated = this.repository.updateOwnership(record.id, {
      status,
      updatedAt: new Date(),
      metadata: sanitizeMetadata({
        ...record.metadata,
        mergeQueue: this.mergeQueueMetadata(recordToRequestLike(record), record.branchLeaseId, record.branchName),
        noMergeExecuted: true,
        noBranchDeletion: true,
        ...contextMetadata(context)
      })
    });
    this.recordAudit(eventType, "recorded", context, {
      ownershipRecordId: updated.id,
      branchName,
      reason: `${status}_metadata_only`,
      branchLeaseId: updated.branchLeaseId,
      workspaceLeaseId: updated.workspaceLeaseId
    });
    return updated;
  }

  private recordAudit(
    eventType: string,
    result: BranchOrchestratorAuditEvent["result"],
    context: BranchOrchestrationContext,
    input: {
      request?: Pick<BranchOrchestrationRequest, "id" | "repoId" | "actorId">;
      decisionId?: string;
      ownershipRecordId?: string;
      branchName?: string;
      branchLeaseId?: string;
      workspaceLeaseId?: string;
      reason?: string;
      decision?: BranchOrchestrationDecisionValue;
    }
  ): BranchOrchestratorAuditEvent {
    return this.repository.appendAuditEvent({
      eventType,
      requestId: input.request?.id,
      decisionId: input.decisionId,
      ownershipRecordId: input.ownershipRecordId,
      repoId: input.request?.repoId,
      branchName: input.branchName,
      result,
      actorId: context.actorId ?? input.request?.actorId,
      principalId: context.principalId,
      serviceAccountId: context.serviceAccountId,
      correlationId: context.correlationId,
      source: context.source,
      reason: input.reason,
      metadata: sanitizeMetadata({
        decision: input.decision,
        branchLeaseId: input.branchLeaseId,
        workspaceLeaseId: input.workspaceLeaseId,
        requestId: context.requestId,
        correlationId: context.correlationId,
        noRemoteGit: true,
        noBranchMutation: true,
        noWorkspaceMutation: true,
        ...context.metadata
      })
    });
  }
}

export function branchOrchestrationRequestToDto(request: BranchOrchestrationRequest) {
  return {
    ...request,
    createdAt: request.createdAt.toISOString()
  };
}

export function branchOrchestrationDecisionToDto(decision: BranchOrchestrationDecision) {
  return {
    ...decision,
    createdAt: decision.createdAt.toISOString()
  };
}

export function branchNamingPolicyToDto(policy: BranchNamingPolicy) {
  return policy;
}

export function branchOwnershipRecordToDto(record: BranchOwnershipRecord) {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    expiresAt: record.expiresAt?.toISOString()
  };
}

export function baseBranchDriftStatusToDto(status: BaseBranchDriftStatus) {
  return {
    ...status,
    evaluatedAt: status.evaluatedAt.toISOString()
  };
}

export function branchOrchestratorSummaryToDto(summary: BranchOrchestratorSummary) {
  return summary;
}

export function branchOrchestratorAuditEventToDto(event: BranchOrchestratorAuditEvent) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString()
  };
}

function normalizeSourceScope(input: Partial<BranchOrchestrationSourceScope> | undefined): BranchOrchestrationSourceScope {
  return {
    scopeKind: input?.scopeKind ?? "unknown",
    paths: normalizePaths(input?.paths ?? []),
    description: input?.description,
    metadata: sanitizeMetadata(input?.metadata ?? {})
  };
}

function normalizePaths(paths: string[]): string[] {
  return unique(paths
    .filter((path): path is string => typeof path === "string" && path.trim().length > 0)
    .map((path) => path.trim().replaceAll("\\", "/").replace(/^\.\//u, ""))
    .filter((path) => !path.includes("\0")))
    .sort((left, right) => left.localeCompare(right));
}

function sanitizeBranchName(raw: string, policy: BranchNamingPolicy, options: { generated: boolean }): string {
  const withoutRefs = raw.replace(/^refs\/heads\//iu, "");
  const normalized = withoutRefs.replaceAll("\\", "/").replace(/\/+/gu, "/").replace(/^\/+|\/+$/gu, "");
  const sanitized = normalized
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => slugify(segment))
    .join("/");
  const prefixed = sanitized.startsWith(policy.prefix)
    ? sanitized
    : `${policy.prefix.replace(/\/+$/u, "")}/${sanitized}`;
  if (options.generated && prefixed.length > policy.maxLength) {
    return trimBranchName(prefixed, policy.maxLength);
  }
  return prefixed;
}

function trimBranchName(branchName: string, maxLength: number): string {
  const trimmed = branchName.slice(0, maxLength).replace(/\/+$/u, "");
  return trimmed.length > 0 ? trimmed : "aichestra/branch";
}

function validateBranchNameWithPolicy(branchName: string, policy: BranchNamingPolicy, raw: string): BranchNameValidationResult {
  const warnings: string[] = [];
  if (raw.trim().length === 0 || branchName.trim().length === 0) {
    return { ok: false, branchName, reason: "branch_name_empty", warnings };
  }
  if (raw.includes("..") || raw.split(/[\\/]/u).some((segment) => segment === "." || segment === "..")) {
    return { ok: false, branchName, reason: "branch_name_path_traversal_rejected", warnings };
  }
  if (!branchName.startsWith(policy.prefix)) {
    return { ok: false, branchName, reason: "branch_prefix_not_allowed", warnings };
  }
  if (branchName.length > policy.maxLength) {
    return { ok: false, branchName, reason: "branch_name_too_long", warnings };
  }
  const segments = branchName.toLowerCase().split("/").filter(Boolean);
  const target = segments.at(-1) ?? "";
  if (reservedBranchNames.has(branchName.toLowerCase()) || reservedBranchNames.has(target)) {
    return { ok: false, branchName, reason: "reserved_branch_name_rejected", warnings };
  }
  if (segments.some((segment) => segment === "force" || segment === "delete" || segment === "branch-d" || segment === "rm")) {
    return { ok: false, branchName, reason: "destructive_branch_name_rejected", warnings };
  }
  if (branchName.includes("//") || branchName.endsWith("/") || branchName.startsWith("/")) {
    return { ok: false, branchName, reason: "branch_name_malformed", warnings };
  }
  if (raw !== branchName) {
    warnings.push("branch_name_sanitized");
  }
  return { ok: true, branchName, warnings };
}

function sameLogicalOwner(record: BranchOwnershipRecord, request?: Pick<BranchOrchestrationRequest, "sessionId" | "agentRunId" | "taskRunId" | "userId">): boolean {
  if (!request) return false;
  if (request.sessionId && record.sessionId === request.sessionId) return true;
  if (request.agentRunId && record.agentRunId === request.agentRunId) return true;
  if (request.taskRunId && record.taskRunId === request.taskRunId) return true;
  return false;
}

function driftSeverity(status: BaseBranchDriftStatusValue): BaseBranchDriftSeverity {
  if (status === "base_changed") return "high";
  if (status === "behind_base" || status === "future_check_required") return "medium";
  return "low";
}

function driftRecommendation(status: BaseBranchDriftStatusValue): BaseBranchDriftRecommendation {
  if (status === "base_changed") return "manual_review";
  if (status === "behind_base") return "refresh_needed";
  if (status === "future_check_required") return "merge_base_future";
  return "continue";
}

function baseBranchDriftStatusValue(value: unknown): BaseBranchDriftStatusValue | undefined {
  return value === "current" ||
    value === "behind_base" ||
    value === "base_changed" ||
    value === "unknown" ||
    value === "future_check_required"
    ? value
    : undefined;
}

function recordToRequestLike(record: BranchOwnershipRecord): BranchOrchestrationRequest {
  return {
    id: `request_${record.id}`,
    userId: record.userId,
    actorId: record.actorId,
    taskId: record.taskId,
    taskRunId: record.taskRunId,
    agentRunId: record.agentRunId ?? "unknown",
    sessionId: record.sessionId,
    repoId: record.repoId,
    baseBranch: record.baseBranch,
    branchPurpose: "agent_work",
    targetFiles: [],
    sourceScope: { scopeKind: "unknown", paths: [], metadata: {} },
    createdAt: record.createdAt,
    metadata: record.metadata
  };
}

function repoSlug(repo: Pick<Repo, "owner" | "name">): string {
  return `${repo.owner}/${repo.name}`.toLowerCase();
}

function contextMetadata(context: BranchOrchestrationContext): Record<string, unknown> {
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
  return sanitizeValue(metadata) as Record<string, unknown>;
}

function sanitizeValue(value: unknown, key = ""): unknown {
  if (/token|secret|password|credential|authorization|cookie|private[_-]?key|api[_-]?key|env(ironment)?[_-]?value/i.test(key)) {
    return "[redacted]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key));
  }
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, entryKey)
    ]));
  }
  if (typeof value === "string") {
    if (/(OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|VAULT_TOKEN|DATABASE_URL|AICHESTRA_[A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD))=/iu.test(value)) {
      return "[redacted]";
    }
    return value
      .replace(/ghp_[A-Za-z0-9_]+/g, "[redacted]")
      .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/giu, "Bearer [redacted]");
  }
  return value;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function cloneMaybe<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clone(value);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
