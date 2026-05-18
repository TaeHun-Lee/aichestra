import path from "node:path";
import { createId } from "../domain/ids.ts";
import type { BranchLease, GitPullRequestSyncState, MergeQueueEntry, PullRequest } from "../domain/models.ts";

export type PrOwnerKind = "human" | "agent" | "service_account" | "team" | "unknown";

export type PrOwnershipStatus =
  | "active"
  | "review_requested"
  | "handoff_requested"
  | "handed_off"
  | "blocked"
  | "abandoned"
  | "merged"
  | "closed_future";

export type PrHandoffKind =
  | "human_to_human"
  | "agent_to_human"
  | "human_to_agent_future"
  | "service_to_human"
  | "team_handoff";

export type PrHandoffStatus =
  | "requested"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled"
  | "blocked_policy"
  | "blocked_missing_context";

export type PrHandoffDecisionValue =
  | "accept"
  | "reject"
  | "hold"
  | "request_more_info"
  | "expired"
  | "blocked";

export type PrOwnershipAuditEventType =
  | "ownership_created"
  | "reviewer_added"
  | "review_requested"
  | "handoff_requested"
  | "handoff_accepted"
  | "handoff_rejected"
  | "handoff_expired"
  | "ownership_transferred"
  | "ownership_blocked"
  | "ownership_abandoned";

export type PrOwnershipPolicyAction =
  | "pr_ownership.read"
  | "pr_ownership.create"
  | "pr_ownership.update"
  | "pr_handoff.request"
  | "pr_handoff.accept"
  | "pr_handoff.reject"
  | "pr_handoff.expire"
  | "pr_reviewer.assign_future"
  | "pr_remote_update_future";

export type PrOwnershipContext = {
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  source?: string;
  actorKind?: PrOwnerKind | string;
  roles?: string[];
  teams?: string[];
  metadata?: Record<string, unknown>;
};

export type PrOwnershipRecord = {
  id: string;
  repoId: string;
  pullRequestId?: string;
  pullRequestNumber?: number;
  branchName: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  mergeQueueEntryId?: string;
  conflictResolutionPlanId?: string;
  taskId?: string;
  taskRunId?: string;
  agentRunId?: string;
  ownerActorId: string;
  ownerPrincipalId?: string;
  ownerKind: PrOwnerKind;
  ownerTeamId?: string;
  reviewerActorIds: string[];
  reviewerTeamIds: string[];
  status: PrOwnershipStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type PrHandoffRequest = {
  id: string;
  ownershipRecordId: string;
  repoId: string;
  branchName: string;
  pullRequestId?: string;
  fromActorId: string;
  toActorId?: string;
  toTeamId?: string;
  toServiceAccountId?: string;
  handoffKind: PrHandoffKind;
  reason: string;
  requestedAt: Date;
  expiresAt?: Date;
  status: PrHandoffStatus;
  requiredEvidence: string[];
  metadata: Record<string, unknown>;
};

export type PrHandoffDecision = {
  id: string;
  handoffRequestId: string;
  decision: PrHandoffDecisionValue;
  decidedByActorId: string;
  decidedAt: Date;
  reason: string;
  conditions: string[];
  metadata: Record<string, unknown>;
};

export type PrOwnershipAuditEvent = {
  id: string;
  ownershipRecordId: string;
  eventType: PrOwnershipAuditEventType;
  actorId: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
};

export type CreatePrOwnershipInput = {
  id?: string;
  repoId?: string;
  pullRequestId?: string;
  pullRequestNumber?: number;
  branchName?: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  mergeQueueEntryId?: string;
  conflictResolutionPlanId?: string;
  taskId?: string;
  taskRunId?: string;
  agentRunId?: string;
  ownerActorId?: string;
  ownerPrincipalId?: string;
  ownerKind?: PrOwnerKind;
  ownerTeamId?: string;
  reviewerActorIds?: string[];
  reviewerTeamIds?: string[];
  status?: PrOwnershipStatus;
  metadata?: Record<string, unknown>;
};

export type RequestPrHandoffInput = {
  id?: string;
  ownershipRecordId: string;
  fromActorId?: string;
  toActorId?: string;
  toTeamId?: string;
  toServiceAccountId?: string;
  handoffKind?: PrHandoffKind;
  reason?: string;
  requestedAt?: Date;
  expiresAt?: Date;
  requiredEvidence?: string[];
  metadata?: Record<string, unknown>;
};

export type DecidePrHandoffInput = {
  decision: PrHandoffDecisionValue;
  decidedByActorId?: string;
  reason?: string;
  conditions?: string[];
  metadata?: Record<string, unknown>;
};

export type AddPrReviewerInput = {
  ownershipRecordId: string;
  reviewerActorId?: string;
  reviewerTeamId?: string;
  metadata?: Record<string, unknown>;
};

export type PrOwnershipQuery = {
  repoId?: string;
  branchName?: string;
  pullRequestId?: string;
  branchLeaseId?: string;
  mergeQueueEntryId?: string;
  conflictResolutionPlanId?: string;
  ownerActorId?: string;
  ownerTeamId?: string;
  status?: PrOwnershipStatus;
};

export type PrHandoffQuery = {
  repoId?: string;
  ownershipRecordId?: string;
  status?: PrHandoffStatus;
  toActorId?: string;
  toTeamId?: string;
};

export type PrMergeQueueOwnershipReadiness = {
  id: string;
  repoId: string;
  mergeQueueEntryId?: string;
  branchName?: string;
  pullRequestId?: string;
  ownerRequired: true;
  ownerPresent: boolean;
  ownershipRecordId?: string;
  ownerActorId?: string;
  reviewerCount: number;
  status: "owner_present" | "missing_owner";
  mergeQueueReadyBlocked: boolean;
  remotePrUpdateDisabled: true;
  metadata: Record<string, unknown>;
};

export type PrConflictResolutionOwnershipLink = {
  conflictResolutionPlanId: string;
  ownershipRecordIds: string[];
  ownerActorIds: string[];
  reviewerActorIds: string[];
  reviewerTeamIds: string[];
  reviewRequired: boolean;
  metadata: Record<string, unknown>;
};

export type PrOwnershipSummary = {
  repoId?: string;
  status: "v1_implemented";
  ownershipRecords: number;
  activeOwnershipRecords: number;
  reviewRequested: number;
  handoffRequests: number;
  pendingHandoffs: number;
  acceptedHandoffs: number;
  rejectedHandoffs: number;
  expiredHandoffs: number;
  blockedHandoffs: number;
  reviewerAssignments: number;
  mergeQueueEntriesMissingOwner: number;
  remotePrUpdateEnabled: false;
  remoteReviewerAssignmentEnabled: false;
  githubApiCalls: false;
  autoMergeEnabled: false;
  branchDeletionEnabled: false;
  workspaceMutation: false;
  secretsExposed: false;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type PrOwnershipPolicyDecisionSnapshot = {
  allowed: boolean;
  decision?: string;
  reason?: string;
  policyDecisionId?: string;
  matchedRuleIds?: string[];
};

export type PrOwnershipPolicyEvaluationInput = {
  action: PrOwnershipPolicyAction;
  ownership?: PrOwnershipRecord;
  handoff?: PrHandoffRequest;
  context: PrOwnershipContext;
  metadata: Record<string, unknown>;
};

export type PrOwnershipDataSource = {
  getBranchLease?(id: string): BranchLease | undefined;
  getMergeQueueEntry?(id: string): MergeQueueEntry | undefined;
  listMergeQueueEntries?(repoId?: string): MergeQueueEntry[];
  getPullRequest?(id: string): PullRequest | undefined;
  getPullRequestSyncState?(repoId: string, pullRequestNumber: number): GitPullRequestSyncState | undefined;
};

export type PrOwnershipServiceOptions = {
  dataSource?: PrOwnershipDataSource;
  policyEvaluator?: (input: PrOwnershipPolicyEvaluationInput) => PrOwnershipPolicyDecisionSnapshot;
  now?: () => Date;
};

const ownerReadyStatuses = new Set<PrOwnershipStatus>(["active", "review_requested", "handoff_requested", "handed_off"]);

export class PrOwnershipService {
  private readonly dataSource: PrOwnershipDataSource;
  private readonly policyEvaluator?: (input: PrOwnershipPolicyEvaluationInput) => PrOwnershipPolicyDecisionSnapshot;
  private readonly now: () => Date;
  private readonly ownershipRecords: PrOwnershipRecord[] = [];
  private readonly handoffRequests: PrHandoffRequest[] = [];
  private readonly handoffDecisions: PrHandoffDecision[] = [];
  private readonly auditEvents: PrOwnershipAuditEvent[] = [];

  constructor(options: PrOwnershipServiceOptions = {}) {
    this.dataSource = options.dataSource ?? {};
    this.policyEvaluator = options.policyEvaluator;
    this.now = options.now ?? (() => new Date());
  }

  createOwnership(input: CreatePrOwnershipInput, context: PrOwnershipContext = {}): PrOwnershipRecord {
    const evidence = this.resolveOwnershipEvidence(input);
    const repoId = input.repoId ?? evidence.mergeQueueEntry?.repoId ?? evidence.branchLease?.repoId ?? evidence.pullRequest?.repoId;
    const branchName = input.branchName ?? evidence.mergeQueueEntry?.branchName ?? evidence.branchLease?.branchName ?? evidence.pullRequestSyncState?.headBranch;
    if (!repoId || !branchName) {
      throw new Error("PR ownership requires repoId and branchName, directly or through branch/merge/PR metadata.");
    }
    const createdAt = this.now();
    const ownerActorId = input.ownerActorId ?? context.actorId ?? context.serviceAccountId ?? "unknown_owner";
    const record: PrOwnershipRecord = {
      id: input.id ?? createId("prown"),
      repoId,
      pullRequestId: input.pullRequestId ?? evidence.mergeQueueEntry?.pullRequestId ?? evidence.pullRequest?.id ?? evidence.pullRequestSyncState?.pullRequestId,
      pullRequestNumber: input.pullRequestNumber ?? evidence.pullRequestSyncState?.pullRequestNumber,
      branchName,
      branchLeaseId: input.branchLeaseId ?? evidence.mergeQueueEntry?.branchLeaseId ?? evidence.branchLease?.id ?? evidence.pullRequestSyncState?.branchLeaseId,
      workspaceLeaseId: input.workspaceLeaseId,
      mergeQueueEntryId: input.mergeQueueEntryId ?? evidence.pullRequestSyncState?.mergeQueueEntryId,
      conflictResolutionPlanId: input.conflictResolutionPlanId,
      taskId: input.taskId ?? evidence.mergeQueueEntry?.taskId ?? evidence.branchLease?.taskId ?? evidence.pullRequest?.taskId ?? evidence.pullRequestSyncState?.taskId,
      taskRunId: input.taskRunId ?? evidence.mergeQueueEntry?.taskRunId ?? evidence.branchLease?.taskRunId ?? evidence.pullRequestSyncState?.taskRunId,
      agentRunId: input.agentRunId,
      ownerActorId,
      ownerPrincipalId: input.ownerPrincipalId ?? context.principalId,
      ownerKind: input.ownerKind ?? inferOwnerKind(context, ownerActorId, input.ownerTeamId),
      ownerTeamId: input.ownerTeamId,
      reviewerActorIds: uniqueStrings(input.reviewerActorIds ?? []),
      reviewerTeamIds: uniqueStrings(input.reviewerTeamIds ?? []),
      status: input.status ?? "active",
      createdAt,
      updatedAt: createdAt,
      metadata: sanitizeMetadata({
        ...input.metadata,
        ...contextMetadata(context),
        metadataOnly: true,
        remotePrUpdate: false,
        remoteReviewerAssignment: false,
        noGitHubApiCall: true,
        noAutoMerge: true,
        branchDeletion: false,
        branchLeaseFound: evidence.branchLease !== undefined,
        mergeQueueEntryFound: evidence.mergeQueueEntry !== undefined,
        pullRequestFound: evidence.pullRequest !== undefined,
        pullRequestSyncStateFound: evidence.pullRequestSyncState !== undefined
      })
    };
    const policy = this.evaluatePolicy("pr_ownership.create", record, undefined, context, {
      metadataOnly: true,
      remotePrUpdate: false
    });
    const saved = policy.allowed
      ? record
      : {
        ...record,
        status: "blocked" as const,
        metadata: sanitizeMetadata({
          ...record.metadata,
          policyDecisionId: policy.policyDecisionId,
          policyReason: policy.reason,
          blockedByPolicy: true
        })
      };
    this.upsertOwnership(saved);
    this.appendAudit(saved.id, "ownership_created", context, {
      policyDecisionId: policy.policyDecisionId,
      policyAllowed: policy.allowed,
      metadataOnly: true
    });
    return clone(saved);
  }

  getOwnership(id: string): PrOwnershipRecord | undefined {
    return clone(this.ownershipRecords.find((record) => record.id === id));
  }

  listOwnership(query: PrOwnershipQuery = {}): PrOwnershipRecord[] {
    return this.ownershipRecords
      .filter((record) =>
        (query.repoId === undefined || record.repoId === query.repoId) &&
        (query.branchName === undefined || record.branchName === query.branchName) &&
        (query.pullRequestId === undefined || record.pullRequestId === query.pullRequestId) &&
        (query.branchLeaseId === undefined || record.branchLeaseId === query.branchLeaseId) &&
        (query.mergeQueueEntryId === undefined || record.mergeQueueEntryId === query.mergeQueueEntryId) &&
        (query.conflictResolutionPlanId === undefined || record.conflictResolutionPlanId === query.conflictResolutionPlanId) &&
        (query.ownerActorId === undefined || record.ownerActorId === query.ownerActorId) &&
        (query.ownerTeamId === undefined || record.ownerTeamId === query.ownerTeamId) &&
        (query.status === undefined || record.status === query.status))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((record): PrOwnershipRecord => clone(record));
  }

  requestHandoff(input: RequestPrHandoffInput, context: PrOwnershipContext = {}): PrHandoffRequest {
    const ownership = this.requireOwnership(input.ownershipRecordId);
    const requestedAt = input.requestedAt ?? this.now();
    const fromActorId = input.fromActorId ?? context.actorId ?? ownership.ownerActorId;
    const handoffKind = input.handoffKind ?? inferHandoffKind(ownership, input);
    const missingContext = !fromActorId || (!input.toActorId && !input.toTeamId && !input.toServiceAccountId);
    const request: PrHandoffRequest = {
      id: input.id ?? createId("prhandoff"),
      ownershipRecordId: ownership.id,
      repoId: ownership.repoId,
      branchName: ownership.branchName,
      pullRequestId: ownership.pullRequestId,
      fromActorId,
      toActorId: input.toActorId,
      toTeamId: input.toTeamId,
      toServiceAccountId: input.toServiceAccountId,
      handoffKind,
      reason: input.reason ?? "handoff_requested",
      requestedAt,
      expiresAt: input.expiresAt,
      status: missingContext ? "blocked_missing_context" : "requested",
      requiredEvidence: uniqueStrings(input.requiredEvidence ?? defaultRequiredEvidence(handoffKind)),
      metadata: sanitizeMetadata({
        ...input.metadata,
        ...contextMetadata(context),
        metadataOnly: true,
        remotePrUpdate: false,
        remoteReviewerAssignment: false,
        futureAgentHandoff: handoffKind === "human_to_agent_future",
        noGitHubApiCall: true
      })
    };
    const policy = this.evaluatePolicy("pr_handoff.request", ownership, request, context, {
      metadataOnly: true,
      remotePrUpdate: false,
      handoffKind
    });
    const saved = policy.allowed && !missingContext
      ? request
      : {
        ...request,
        status: missingContext ? "blocked_missing_context" as const : "blocked_policy" as const,
        metadata: sanitizeMetadata({
          ...request.metadata,
          policyDecisionId: policy.policyDecisionId,
          policyReason: policy.reason,
          blockedByPolicy: !policy.allowed
        })
      };
    this.handoffRequests.push(clone(saved));
    if (saved.status === "requested") {
      this.updateOwnershipRecord({
        ...ownership,
        status: "handoff_requested",
        updatedAt: requestedAt,
        metadata: sanitizeMetadata({
          ...ownership.metadata,
          latestHandoffRequestId: saved.id,
          latestHandoffStatus: saved.status
        })
      });
    }
    this.appendAudit(ownership.id, "handoff_requested", context, {
      handoffRequestId: saved.id,
      handoffStatus: saved.status,
      policyDecisionId: policy.policyDecisionId,
      policyAllowed: policy.allowed
    });
    return clone(saved);
  }

  decideHandoff(handoffRequestId: string, input: DecidePrHandoffInput, context: PrOwnershipContext = {}): PrHandoffDecision {
    const handoff = this.requireHandoff(handoffRequestId);
    const ownership = this.requireOwnership(handoff.ownershipRecordId);
    const decidedAt = this.now();
    const decidedByActorId = input.decidedByActorId ?? context.actorId ?? context.serviceAccountId ?? "unknown_decider";
    const action = policyActionForDecision(input.decision);
    const expired = handoff.expiresAt !== undefined && handoff.expiresAt.getTime() <= decidedAt.getTime();
    const futureAgentAcceptBlocked = input.decision === "accept" && handoff.handoffKind === "human_to_agent_future";
    const missingAcceptTarget = input.decision === "accept" && !handoff.toActorId && !handoff.toTeamId && !handoff.toServiceAccountId;
    const policy = this.evaluatePolicy(action, ownership, handoff, context, {
      metadataOnly: true,
      remotePrUpdate: false,
      handoffKind: handoff.handoffKind,
      decision: input.decision
    });
    const blocked = !policy.allowed || futureAgentAcceptBlocked || missingAcceptTarget || (handoff.status !== "requested" && input.decision !== "expired");
    const decisionValue: PrHandoffDecisionValue = expired ? "expired" : blocked ? "blocked" : input.decision;
    const decision: PrHandoffDecision = {
      id: createId("prhandoffdec"),
      handoffRequestId: handoff.id,
      decision: decisionValue,
      decidedByActorId,
      decidedAt,
      reason: input.reason ?? decisionReason(decisionValue, handoff, policy),
      conditions: uniqueStrings([
        ...(input.conditions ?? []),
        ...(futureAgentAcceptBlocked ? ["human_to_agent_future_accept_blocked"] : []),
        ...(missingAcceptTarget ? ["missing_handoff_target"] : []),
        ...(!policy.allowed ? ["policy_denied"] : [])
      ]),
      metadata: sanitizeMetadata({
        ...input.metadata,
        ...contextMetadata(context),
        policyDecisionId: policy.policyDecisionId,
        policyAllowed: policy.allowed,
        metadataOnly: true,
        remotePrUpdate: false,
        noGitHubApiCall: true
      })
    };
    this.handoffDecisions.push(clone(decision));
    this.applyHandoffDecision(handoff, ownership, decision, context);
    return clone(decision);
  }

  expireHandoffs(now: Date = this.now(), context: PrOwnershipContext = {}): PrHandoffRequest[] {
    const expired: PrHandoffRequest[] = [];
    for (const handoff of this.handoffRequests.filter((request) => request.status === "requested" && request.expiresAt !== undefined && request.expiresAt.getTime() <= now.getTime())) {
      const ownership = this.requireOwnership(handoff.ownershipRecordId);
      const policy = this.evaluatePolicy("pr_handoff.expire", ownership, handoff, context, { metadataOnly: true, remotePrUpdate: false });
      const updated: PrHandoffRequest = {
        ...handoff,
        status: policy.allowed ? "expired" : "blocked_policy",
        metadata: sanitizeMetadata({
          ...handoff.metadata,
          ...contextMetadata(context),
          expiredAt: now.toISOString(),
          policyDecisionId: policy.policyDecisionId,
          policyAllowed: policy.allowed
        })
      };
      this.replaceHandoff(updated);
      this.updateOwnershipRecord({
        ...ownership,
        status: ownership.status === "handoff_requested" ? "active" : ownership.status,
        updatedAt: now,
        metadata: sanitizeMetadata({ ...ownership.metadata, latestHandoffStatus: updated.status })
      });
      this.appendAudit(ownership.id, "handoff_expired", context, { handoffRequestId: updated.id, policyAllowed: policy.allowed });
      expired.push(clone(updated));
    }
    return expired;
  }

  addReviewer(input: AddPrReviewerInput, context: PrOwnershipContext = {}): PrOwnershipRecord {
    const ownership = this.requireOwnership(input.ownershipRecordId);
    const policy = this.evaluatePolicy("pr_ownership.update", ownership, undefined, context, {
      metadataOnly: true,
      remoteReviewerAssignment: false
    });
    if (!policy.allowed) {
      const blocked = this.markBlocked(ownership.id, policy.reason ?? "pr_ownership_update_policy_denied", context);
      return blocked;
    }
    const updated: PrOwnershipRecord = {
      ...ownership,
      reviewerActorIds: uniqueStrings([...ownership.reviewerActorIds, input.reviewerActorId].filter(isString)),
      reviewerTeamIds: uniqueStrings([...ownership.reviewerTeamIds, input.reviewerTeamId].filter(isString)),
      status: ownership.status === "active" ? "review_requested" : ownership.status,
      updatedAt: this.now(),
      metadata: sanitizeMetadata({
        ...ownership.metadata,
        ...input.metadata,
        reviewerMetadataOnly: true,
        remoteReviewerAssignment: false
      })
    };
    this.updateOwnershipRecord(updated);
    this.appendAudit(updated.id, "reviewer_added", context, {
      reviewerActorId: input.reviewerActorId,
      reviewerTeamId: input.reviewerTeamId,
      remoteReviewerAssignment: false,
      policyDecisionId: policy.policyDecisionId
    });
    return clone(updated);
  }

  markReviewRequested(id: string, context: PrOwnershipContext = {}): PrOwnershipRecord {
    const ownership = this.requireOwnership(id);
    const updated = this.patchOwnership(ownership, { status: "review_requested" }, context, "review_requested");
    return clone(updated);
  }

  markBlocked(id: string, reason: string, context: PrOwnershipContext = {}): PrOwnershipRecord {
    const ownership = this.requireOwnership(id);
    const updated = this.patchOwnership(ownership, {
      status: "blocked",
      metadata: sanitizeMetadata({ ...ownership.metadata, blockedReason: reason })
    }, context, "ownership_blocked");
    return clone(updated);
  }

  markMerged(id: string, context: PrOwnershipContext = {}): PrOwnershipRecord {
    const ownership = this.requireOwnership(id);
    const updated = this.patchOwnership(ownership, { status: "merged" }, context, "review_requested");
    return clone(updated);
  }

  markAbandoned(id: string, context: PrOwnershipContext = {}): PrOwnershipRecord {
    const ownership = this.requireOwnership(id);
    const updated = this.patchOwnership(ownership, { status: "abandoned" }, context, "ownership_abandoned");
    return clone(updated);
  }

  listHandoffs(query: PrHandoffQuery = {}): PrHandoffRequest[] {
    return this.handoffRequests
      .filter((handoff) =>
        (query.repoId === undefined || handoff.repoId === query.repoId) &&
        (query.ownershipRecordId === undefined || handoff.ownershipRecordId === query.ownershipRecordId) &&
        (query.status === undefined || handoff.status === query.status) &&
        (query.toActorId === undefined || handoff.toActorId === query.toActorId) &&
        (query.toTeamId === undefined || handoff.toTeamId === query.toTeamId))
      .sort((left, right) => left.requestedAt.getTime() - right.requestedAt.getTime() || left.id.localeCompare(right.id))
      .map((record): PrHandoffRequest => clone(record));
  }

  listDecisions(handoffRequestId?: string): PrHandoffDecision[] {
    return this.handoffDecisions
      .filter((decision) => handoffRequestId === undefined || decision.handoffRequestId === handoffRequestId)
      .sort((left, right) => left.decidedAt.getTime() - right.decidedAt.getTime() || left.id.localeCompare(right.id))
      .map((record): PrHandoffDecision => clone(record));
  }

  listAuditEvents(query: { ownershipRecordId?: string; eventType?: PrOwnershipAuditEventType } = {}): PrOwnershipAuditEvent[] {
    return this.auditEvents
      .filter((event) =>
        (query.ownershipRecordId === undefined || event.ownershipRecordId === query.ownershipRecordId) &&
        (query.eventType === undefined || event.eventType === query.eventType))
      .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime() || left.id.localeCompare(right.id))
      .map((record): PrOwnershipAuditEvent => clone(record));
  }

  getMergeQueueOwnershipReadiness(input: string | MergeQueueEntry | { id?: string; repoId: string; branchName: string; pullRequestId?: string }): PrMergeQueueOwnershipReadiness {
    const entry = typeof input === "string" ? this.dataSource.getMergeQueueEntry?.(input) : input;
    if (!entry) throw new Error(`Merge queue entry not found: ${String(input)}`);
    const ownership = this.findOwnershipForQueueEntry(entry);
    return {
      id: createId("prownready"),
      repoId: entry.repoId,
      mergeQueueEntryId: entry.id,
      branchName: entry.branchName,
      pullRequestId: entry.pullRequestId,
      ownerRequired: true,
      ownerPresent: ownership !== undefined,
      ownershipRecordId: ownership?.id,
      ownerActorId: ownership?.ownerActorId,
      reviewerCount: ownership ? ownership.reviewerActorIds.length + ownership.reviewerTeamIds.length : 0,
      status: ownership ? "owner_present" : "missing_owner",
      mergeQueueReadyBlocked: ownership === undefined,
      remotePrUpdateDisabled: true,
      metadata: sanitizeMetadata({
        metadataOnly: true,
        remotePrUpdate: false,
        autoMerge: false,
        ownerStatus: ownership?.status
      })
    };
  }

  listMergeQueueOwnershipReadiness(repoId?: string): PrMergeQueueOwnershipReadiness[] {
    return (this.dataSource.listMergeQueueEntries?.(repoId) ?? [])
      .map((entry) => this.getMergeQueueOwnershipReadiness(entry))
      .sort((left, right) => (left.branchName ?? "").localeCompare(right.branchName ?? "") || (left.mergeQueueEntryId ?? "").localeCompare(right.mergeQueueEntryId ?? ""));
  }

  getConflictResolutionPlanOwnership(planId: string): PrConflictResolutionOwnershipLink {
    const records = this.listOwnership({ conflictResolutionPlanId: planId });
    const reviewerActorIds = uniqueStrings(records.flatMap((record) => record.reviewerActorIds));
    const reviewerTeamIds = uniqueStrings(records.flatMap((record) => record.reviewerTeamIds));
    return {
      conflictResolutionPlanId: planId,
      ownershipRecordIds: records.map((record) => record.id),
      ownerActorIds: uniqueStrings(records.map((record) => record.ownerActorId)),
      reviewerActorIds,
      reviewerTeamIds,
      reviewRequired: records.length === 0 || records.some((record) => record.status === "review_requested" || record.reviewerActorIds.length + record.reviewerTeamIds.length > 0),
      metadata: sanitizeMetadata({
        metadataOnly: true,
        conflictResolutionPlanLinked: records.length > 0,
        remotePrUpdate: false,
        noAutoApply: true
      })
    };
  }

  getSummary(repoId?: string): PrOwnershipSummary {
    const records = this.listOwnership({ repoId });
    const recordIds = new Set(records.map((record) => record.id));
    const handoffs = this.handoffRequests.filter((handoff) => recordIds.has(handoff.ownershipRecordId));
    const readiness = this.listMergeQueueOwnershipReadiness(repoId);
    return {
      repoId,
      status: "v1_implemented",
      ownershipRecords: records.length,
      activeOwnershipRecords: records.filter((record) => ownerReadyStatuses.has(record.status)).length,
      reviewRequested: records.filter((record) => record.status === "review_requested").length,
      handoffRequests: handoffs.length,
      pendingHandoffs: handoffs.filter((handoff) => handoff.status === "requested").length,
      acceptedHandoffs: handoffs.filter((handoff) => handoff.status === "accepted").length,
      rejectedHandoffs: handoffs.filter((handoff) => handoff.status === "rejected").length,
      expiredHandoffs: handoffs.filter((handoff) => handoff.status === "expired").length,
      blockedHandoffs: handoffs.filter((handoff) => handoff.status === "blocked_policy" || handoff.status === "blocked_missing_context").length,
      reviewerAssignments: records.reduce((total, record) => total + record.reviewerActorIds.length + record.reviewerTeamIds.length, 0),
      mergeQueueEntriesMissingOwner: readiness.filter((entry) => !entry.ownerPresent).length,
      remotePrUpdateEnabled: false,
      remoteReviewerAssignmentEnabled: false,
      githubApiCalls: false,
      autoMergeEnabled: false,
      branchDeletionEnabled: false,
      workspaceMutation: false,
      secretsExposed: false,
      envValuesExposed: false,
      metadata: sanitizeMetadata({
        mockFirst: true,
        metadataOnly: true,
        deterministic: true,
        noGitHubApiCall: true,
        remotePrUpdate: false,
        remoteReviewerAssignment: false,
        noAutoMerge: true,
        policyDenyWins: true
      })
    };
  }

  private resolveOwnershipEvidence(input: CreatePrOwnershipInput): {
    branchLease?: BranchLease;
    mergeQueueEntry?: MergeQueueEntry;
    pullRequest?: PullRequest;
    pullRequestSyncState?: GitPullRequestSyncState;
  } {
    const mergeQueueEntry = input.mergeQueueEntryId ? this.dataSource.getMergeQueueEntry?.(input.mergeQueueEntryId) : undefined;
    const branchLeaseId = input.branchLeaseId ?? mergeQueueEntry?.branchLeaseId;
    const branchLease = branchLeaseId ? this.dataSource.getBranchLease?.(branchLeaseId) : undefined;
    const pullRequestId = input.pullRequestId ?? mergeQueueEntry?.pullRequestId;
    const pullRequest = pullRequestId ? this.dataSource.getPullRequest?.(pullRequestId) : undefined;
    const repoId = input.repoId ?? mergeQueueEntry?.repoId ?? branchLease?.repoId ?? pullRequest?.repoId;
    const pullRequestNumber = input.pullRequestNumber;
    const pullRequestSyncState = repoId && pullRequestNumber !== undefined
      ? this.dataSource.getPullRequestSyncState?.(repoId, pullRequestNumber)
      : undefined;
    return { branchLease, mergeQueueEntry, pullRequest, pullRequestSyncState };
  }

  private evaluatePolicy(
    action: PrOwnershipPolicyAction,
    ownership: PrOwnershipRecord | undefined,
    handoff: PrHandoffRequest | undefined,
    context: PrOwnershipContext,
    metadata: Record<string, unknown>
  ): PrOwnershipPolicyDecisionSnapshot {
    if (!this.policyEvaluator) {
      return { allowed: true, decision: "allow", reason: "no_pr_ownership_policy_evaluator_configured_mock_allow" };
    }
    return this.policyEvaluator({
      action,
      ownership,
      handoff,
      context,
      metadata: sanitizeMetadata({
        ...metadata,
        ownershipRecordId: ownership?.id,
        handoffRequestId: handoff?.id,
        repoId: ownership?.repoId ?? handoff?.repoId,
        branchName: ownership?.branchName ?? handoff?.branchName
      })
    });
  }

  private applyHandoffDecision(handoff: PrHandoffRequest, ownership: PrOwnershipRecord, decision: PrHandoffDecision, context: PrOwnershipContext): void {
    if (decision.decision === "accept") {
      const transferred = transferOwnership(ownership, handoff, decision.decidedAt);
      this.updateOwnershipRecord(transferred);
      this.replaceHandoff({
        ...handoff,
        status: "accepted",
        metadata: sanitizeMetadata({ ...handoff.metadata, decisionId: decision.id, acceptedAt: decision.decidedAt.toISOString() })
      });
      this.appendAudit(transferred.id, "handoff_accepted", context, { handoffRequestId: handoff.id, decisionId: decision.id });
      this.appendAudit(transferred.id, "ownership_transferred", context, {
        handoffRequestId: handoff.id,
        decisionId: decision.id,
        newOwnerActorId: transferred.ownerActorId,
        newOwnerKind: transferred.ownerKind
      });
      return;
    }
    if (decision.decision === "reject") {
      this.replaceHandoff({
        ...handoff,
        status: "rejected",
        metadata: sanitizeMetadata({ ...handoff.metadata, decisionId: decision.id, rejectedAt: decision.decidedAt.toISOString() })
      });
      this.updateOwnershipRecord({
        ...ownership,
        status: ownership.status === "handoff_requested" ? "active" : ownership.status,
        updatedAt: decision.decidedAt,
        metadata: sanitizeMetadata({ ...ownership.metadata, latestHandoffStatus: "rejected" })
      });
      this.appendAudit(ownership.id, "handoff_rejected", context, { handoffRequestId: handoff.id, decisionId: decision.id });
      return;
    }
    if (decision.decision === "expired") {
      this.replaceHandoff({
        ...handoff,
        status: "expired",
        metadata: sanitizeMetadata({ ...handoff.metadata, decisionId: decision.id, expiredAt: decision.decidedAt.toISOString() })
      });
      this.updateOwnershipRecord({
        ...ownership,
        status: ownership.status === "handoff_requested" ? "active" : ownership.status,
        updatedAt: decision.decidedAt,
        metadata: sanitizeMetadata({ ...ownership.metadata, latestHandoffStatus: "expired" })
      });
      this.appendAudit(ownership.id, "handoff_expired", context, { handoffRequestId: handoff.id, decisionId: decision.id });
      return;
    }
    if (decision.decision === "blocked") {
      this.replaceHandoff({
        ...handoff,
        status: "blocked_policy",
        metadata: sanitizeMetadata({ ...handoff.metadata, decisionId: decision.id, blockedAt: decision.decidedAt.toISOString() })
      });
      this.appendAudit(ownership.id, "ownership_blocked", context, { handoffRequestId: handoff.id, decisionId: decision.id, reason: decision.reason });
      return;
    }
    this.replaceHandoff({
      ...handoff,
      metadata: sanitizeMetadata({ ...handoff.metadata, decisionId: decision.id, latestDecision: decision.decision })
    });
  }

  private findOwnershipForQueueEntry(entry: MergeQueueEntry | { id?: string; repoId: string; branchName: string; pullRequestId?: string }): PrOwnershipRecord | undefined {
    return this.ownershipRecords
      .filter((record) => ownerReadyStatuses.has(record.status))
      .find((record) =>
        record.repoId === entry.repoId &&
        (record.mergeQueueEntryId === entry.id ||
          record.pullRequestId === entry.pullRequestId ||
          record.branchName === entry.branchName));
  }

  private patchOwnership(
    ownership: PrOwnershipRecord,
    patch: Partial<PrOwnershipRecord>,
    context: PrOwnershipContext,
    eventType: PrOwnershipAuditEventType
  ): PrOwnershipRecord {
    const updated: PrOwnershipRecord = {
      ...ownership,
      ...patch,
      metadata: sanitizeMetadata({ ...ownership.metadata, ...patch.metadata }),
      updatedAt: this.now()
    };
    this.updateOwnershipRecord(updated);
    this.appendAudit(updated.id, eventType, context, { status: updated.status });
    return updated;
  }

  private upsertOwnership(record: PrOwnershipRecord): void {
    const index = this.ownershipRecords.findIndex((candidate) => candidate.id === record.id);
    if (index >= 0) this.ownershipRecords[index] = clone(record);
    else this.ownershipRecords.push(clone(record));
  }

  private updateOwnershipRecord(record: PrOwnershipRecord): void {
    const index = this.ownershipRecords.findIndex((candidate) => candidate.id === record.id);
    if (index < 0) throw new Error(`PR ownership record not found: ${record.id}`);
    this.ownershipRecords[index] = clone(record);
  }

  private replaceHandoff(handoff: PrHandoffRequest): void {
    const index = this.handoffRequests.findIndex((candidate) => candidate.id === handoff.id);
    if (index < 0) throw new Error(`PR handoff request not found: ${handoff.id}`);
    this.handoffRequests[index] = clone(handoff);
  }

  private appendAudit(ownershipRecordId: string, eventType: PrOwnershipAuditEventType, context: PrOwnershipContext, metadata: Record<string, unknown> = {}): void {
    this.auditEvents.push({
      id: createId("prowaudit"),
      ownershipRecordId,
      eventType,
      actorId: context.actorId ?? context.serviceAccountId ?? "system",
      principalId: context.principalId,
      serviceAccountId: context.serviceAccountId,
      requestId: context.requestId,
      correlationId: context.correlationId,
      timestamp: this.now(),
      metadata: sanitizeMetadata({
        ...metadata,
        source: context.source,
        metadataOnly: true,
        remotePrUpdate: false,
        noGitHubApiCall: true
      })
    });
  }

  private requireOwnership(id: string): PrOwnershipRecord {
    const record = this.ownershipRecords.find((candidate) => candidate.id === id);
    if (!record) throw new Error(`PR ownership record not found: ${id}`);
    return clone(record);
  }

  private requireHandoff(id: string): PrHandoffRequest {
    const request = this.handoffRequests.find((candidate) => candidate.id === id);
    if (!request) throw new Error(`PR handoff request not found: ${id}`);
    return clone(request);
  }
}

function transferOwnership(ownership: PrOwnershipRecord, handoff: PrHandoffRequest, updatedAt: Date): PrOwnershipRecord {
  const ownerActorId = handoff.toActorId ?? handoff.toServiceAccountId ?? handoff.toTeamId ?? ownership.ownerActorId;
  return {
    ...ownership,
    ownerActorId,
    ownerKind: handoff.toTeamId ? "team" : handoff.toServiceAccountId ? "service_account" : "human",
    ownerTeamId: handoff.toTeamId ?? ownership.ownerTeamId,
    status: "handed_off",
    updatedAt,
    metadata: sanitizeMetadata({
      ...ownership.metadata,
      previousOwnerActorId: ownership.ownerActorId,
      latestHandoffRequestId: handoff.id,
      latestHandoffStatus: "accepted",
      remotePrUpdate: false
    })
  };
}

function inferOwnerKind(context: PrOwnershipContext, ownerActorId: string, ownerTeamId?: string): PrOwnerKind {
  if (ownerTeamId) return "team";
  if (context.serviceAccountId && ownerActorId === context.serviceAccountId) return "service_account";
  if (context.actorKind === "service_account") return "service_account";
  if (context.actorKind === "local_agent" || ownerActorId.startsWith("agent") || ownerActorId.startsWith("agentrun")) return "agent";
  if (ownerActorId === "unknown_owner") return "unknown";
  return "human";
}

function inferHandoffKind(ownership: PrOwnershipRecord, input: RequestPrHandoffInput): PrHandoffKind {
  if (input.toTeamId) return "team_handoff";
  if (ownership.ownerKind === "agent" && input.toActorId) return "agent_to_human";
  if (ownership.ownerKind === "service_account" && input.toActorId) return "service_to_human";
  if (input.toServiceAccountId) return "human_to_agent_future";
  return "human_to_human";
}

function defaultRequiredEvidence(kind: PrHandoffKind): string[] {
  if (kind === "agent_to_human") return ["agent_run_summary", "changed_files", "validation_status"];
  if (kind === "human_to_agent_future") return ["human_review_note", "future_agent_acceptance_gate"];
  if (kind === "service_to_human") return ["service_context", "human_review_acknowledgement"];
  if (kind === "team_handoff") return ["team_review_acknowledgement"];
  return ["handoff_reason"];
}

function policyActionForDecision(decision: PrHandoffDecisionValue): PrOwnershipPolicyAction {
  if (decision === "accept") return "pr_handoff.accept";
  if (decision === "expired") return "pr_handoff.expire";
  return "pr_handoff.reject";
}

function decisionReason(decision: PrHandoffDecisionValue, handoff: PrHandoffRequest, policy: PrOwnershipPolicyDecisionSnapshot): string {
  if (!policy.allowed) return policy.reason ?? "pr_handoff_policy_denied";
  if (decision === "blocked" && handoff.handoffKind === "human_to_agent_future") return "human_to_agent_future_acceptance_blocked_in_v1";
  if (decision === "accept") return "handoff_accepted_metadata_only";
  if (decision === "reject") return "handoff_rejected_metadata_only";
  if (decision === "expired") return "handoff_expired_metadata_only";
  return "handoff_decision_recorded_metadata_only";
}

function contextMetadata(context: PrOwnershipContext): Record<string, unknown> {
  return sanitizeMetadata({
    requestId: context.requestId,
    correlationId: context.correlationId,
    actorId: context.actorId,
    principalId: context.principalId,
    serviceAccountId: context.serviceAccountId,
    source: context.source,
    actorKind: context.actorKind,
    roles: context.roles,
    teams: context.teams,
    ...context.metadata
  });
}

function sanitizeMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (isSensitiveMetadataKey(key)) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = sanitizeMetadataValue(value);
  }
  return output;
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (/(OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|VAULT_TOKEN|DATABASE_URL|AICHESTRA_[A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD))=/i.test(value)) {
      return "[redacted]";
    }
    if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) {
      const normalized = value.trim().replaceAll("\\", "/").replace(/\/+/g, "/");
      const basename = path.basename(normalized);
      return basename ? `[file-path]/${basename}` : "[file-path]";
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeMetadataValue(item));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null) return sanitizeMetadata(value as Record<string, unknown>);
  return value;
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
  return /token|secret|credential|password|private.*key|api.*key|authorization|cookie/.test(normalized) ||
    normalized === "env" ||
    normalized === "envvalue" ||
    normalized === "envvalues" ||
    normalized === "rawenv";
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].filter(Boolean).sort((left, right) => left.localeCompare(right));
}

function clone<T>(value: T): T;
function clone<T>(value: T | undefined): T | undefined;
function clone<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : structuredClone(value);
}
