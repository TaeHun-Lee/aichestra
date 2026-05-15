import type {
  GitBranchSyncState,
  GitPullRequestSyncState,
  GitWebhookAuditEvent,
  GitWebhookEvent,
  GitWebhookVerificationResult,
  PullRequest,
  Repo
} from "@aichestra/core";
import type { InMemoryAichestraStore } from "@aichestra/db";
import type { GitChangedFile, GitHubWebhookRuntimeConfig, GitHubWebhookVerifier } from "@aichestra/adapters";
import { hashWebhookPayload } from "@aichestra/adapters";
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject
} from "@aichestra/policy";
import type { PolicyAction, PolicyDecision } from "@aichestra/policy";
import type { GitIntegrationService } from "./service.ts";
import {
  createServiceAccountPolicySubject,
  serviceAccountAuditMetadata
} from "@aichestra/auth";

export type GitWebhookReceiverServiceInput = {
  store: InMemoryAichestraStore;
  gitIntegrationService: GitIntegrationService;
  config: GitHubWebhookRuntimeConfig;
  verifier: GitHubWebhookVerifier;
  actorId?: string;
  policyService?: PolicyService;
};

export type GitHubWebhookReceiveInput = {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer | string;
};

export type GitWebhookReceiveResult = {
  ok: boolean;
  statusCode: number;
  status: GitWebhookEvent["status"] | "disabled" | "blocked";
  reason?: string;
  event?: GitWebhookEvent;
  verification?: GitWebhookVerificationResult;
  syncState?: GitPullRequestSyncState | GitBranchSyncState;
};

export type GitHubManualSyncResult = {
  ok: boolean;
  reason?: string;
  pullRequestSyncState?: GitPullRequestSyncState;
  branchSyncState?: GitBranchSyncState;
  changedFiles?: GitChangedFile[];
  policyDecisionId?: string;
};

export class GitWebhookReceiverService {
  private readonly store: InMemoryAichestraStore;
  private readonly config: GitHubWebhookRuntimeConfig;
  private readonly verifier: GitHubWebhookVerifier;
  private readonly syncService: GitHubSyncService;
  private readonly actorId: string;
  private readonly policyService: PolicyService;

  constructor(input: GitWebhookReceiverServiceInput) {
    this.store = input.store;
    this.config = input.config;
    this.verifier = input.verifier;
    this.actorId = input.actorId ?? "git_webhook_service";
    this.policyService = input.policyService ?? new PolicyService();
    this.syncService = new GitHubSyncService({
      store: input.store,
      gitIntegrationService: input.gitIntegrationService,
      config: input.config,
      actorId: input.actorId ?? "git_sync_service",
      policyService: this.policyService
    });
  }

  getConfig(): GitHubWebhookRuntimeConfig {
    return {
      ...this.config,
      webhookSecretConfigured: this.config.webhookSecretConfigured,
      supportedWebhookEvents: [...this.config.supportedWebhookEvents],
      webhookAllowedRepos: [...this.config.webhookAllowedRepos]
    };
  }

  listEvents(filter: { repoRef?: string; eventType?: string; status?: GitWebhookEvent["status"] } = {}): GitWebhookEvent[] {
    return this.store.listGitWebhookEvents(filter);
  }

  getEvent(id: string): GitWebhookEvent | undefined {
    return this.store.getGitWebhookEvent(id);
  }

  listAuditEvents(filter: { eventType?: string; repoRef?: string; deliveryId?: string } = {}): GitWebhookAuditEvent[] {
    return this.store.listGitWebhookAuditEvents(filter);
  }

  listPullRequestSyncStates(repoRef?: string): GitPullRequestSyncState[] {
    return this.store.listGitPullRequestSyncStates(repoRef);
  }

  getPullRequestSyncState(repoRef: string, pullRequestNumber: number): GitPullRequestSyncState | undefined {
    return this.store.getGitPullRequestSyncState(repoRef, pullRequestNumber);
  }

  listBranchSyncStates(repoRef?: string): GitBranchSyncState[] {
    return this.store.listGitBranchSyncStates(repoRef);
  }

  getBranchSyncState(repoRef: string, branchName: string): GitBranchSyncState | undefined {
    return this.store.getGitBranchSyncState(repoRef, branchName);
  }

  async receiveGitHubWebhook(input: GitHubWebhookReceiveInput): Promise<GitWebhookReceiveResult> {
    const deliveryId = headerValue(input.headers, "x-github-delivery") ?? "missing-delivery";
    const eventType = headerValue(input.headers, "x-github-event") ?? "missing-event";
    const signatureHeader = headerValue(input.headers, "x-hub-signature-256");
    const payloadHash = hashWebhookPayload(input.rawBody);

    if (!this.config.webhooksEnabled) {
      this.recordWebhookAudit("github_webhook_disabled", "blocked", {
        deliveryId,
        result: "blocked",
        reason: "github_webhooks_disabled",
        sanitizedMetadata: { eventType, payloadHash }
      });
      return { ok: false, statusCode: 409, status: "disabled", reason: "github_webhooks_disabled" };
    }

    if (!this.config.webhookSecretConfigured) {
      this.recordWebhookAudit("github_webhook_payload_rejected", "blocked", {
        deliveryId,
        result: "blocked",
        reason: this.config.webhookSecretReason ?? "github_webhook_secret_missing",
        sanitizedMetadata: { eventType, payloadHash, secretConfigured: false }
      });
      return { ok: false, statusCode: 409, status: "blocked", reason: this.config.webhookSecretReason ?? "github_webhook_secret_missing" };
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(Buffer.isBuffer(input.rawBody) ? input.rawBody.toString("utf8") : input.rawBody) as Record<string, unknown>;
    } catch {
      this.recordWebhookAudit("github_webhook_payload_rejected", "rejected", {
        deliveryId,
        result: "rejected",
        reason: "malformed_json",
        sanitizedMetadata: { eventType, payloadHash }
      });
      const rejected = this.store.recordGitWebhookEvent({
        providerKind: "github",
        eventType,
        deliveryId,
        repoRef: "unknown",
        action: undefined,
        payloadHash,
        signatureVerified: false,
        status: "rejected",
        processedAt: new Date(),
        metadata: { reason: "malformed_json" }
      });
      return { ok: false, statusCode: 400, status: "rejected", reason: "malformed_json", event: rejected };
    }

    const action = stringValue(payload.action);
    const repoRef = repoRefFromPayload(payload);
    const repoAllowed = this.repoAllowlisted(repoRef);

    this.recordWebhookAudit("github_webhook_received", "received", {
      deliveryId,
      repoRef,
      result: "received",
      sanitizedMetadata: { eventType, action, payloadHash, repoAllowlisted: repoAllowed }
    });

    if (!eventType || eventType === "missing-event" || !deliveryId || deliveryId === "missing-delivery") {
      this.recordWebhookAudit("github_webhook_payload_rejected", "rejected", {
        deliveryId,
        repoRef,
        result: "rejected",
        reason: "required_headers_missing",
        sanitizedMetadata: { eventType, action, payloadHash }
      });
      const rejected = this.recordEvent(eventType, deliveryId, repoRef, action, payloadHash, false, "rejected", {
        reason: "required_headers_missing"
      });
      return { ok: false, statusCode: 400, status: "rejected", reason: "required_headers_missing", event: rejected };
    }

    if (!repoAllowed) {
      this.recordWebhookAudit("github_webhook_payload_rejected", "rejected", {
        deliveryId,
        repoRef,
        result: "rejected",
        reason: "repo_not_allowlisted",
        sanitizedMetadata: { eventType, action, payloadHash }
      });
      const rejected = this.recordEvent(eventType, deliveryId, repoRef, action, payloadHash, false, "rejected", {
        reason: "repo_not_allowlisted"
      });
      return { ok: false, statusCode: 403, status: "rejected", reason: "repo_not_allowlisted", event: rejected };
    }

    const verification = this.verifier.verify({ deliveryId, signatureHeader, rawBody: input.rawBody });
    this.store.recordGitWebhookVerificationResult({
      deliveryId: verification.deliveryId,
      verified: verification.verified,
      reason: verification.reason,
      algorithm: verification.algorithm
    });

    this.recordWebhookAudit(
      verification.verified ? "github_webhook_signature_verified" : "github_webhook_signature_rejected",
      verification.verified ? "verified" : "rejected",
      {
        deliveryId,
        repoRef,
        result: verification.verified ? "verified" : "rejected",
        reason: verification.verified ? undefined : verification.reason,
        sanitizedMetadata: { eventType, action, algorithm: verification.algorithm }
      }
    );

    const verifyPolicy = this.evaluatePolicy("git.webhook.verify", "git_operation", repoRef, {
      providerKind: "github",
      environment: {
        githubWebhooksEnabled: this.config.webhooksEnabled,
        signatureVerified: verification.verified,
        acceptUnverified: this.config.webhookAcceptUnverified,
        repoAllowlisted: repoAllowed,
        secretConfigured: this.config.webhookSecretConfigured
      },
      metadata: { eventType, action }
    });
    const receivePolicy = this.evaluatePolicy("git.webhook.receive", "git_operation", repoRef, {
      providerKind: "github",
      environment: {
        githubWebhooksEnabled: this.config.webhooksEnabled,
        signatureVerified: verification.verified,
        acceptUnverified: this.config.webhookAcceptUnverified,
        repoAllowlisted: repoAllowed,
        secretConfigured: this.config.webhookSecretConfigured
      },
      metadata: { eventType, action }
    });

    if (!verification.verified || !verifyPolicy.allowed || !receivePolicy.allowed) {
      const reason = verification.verified ? "policy_denied" : verification.reason;
      const event = this.recordEvent(eventType, deliveryId, repoRef, action, payloadHash, verification.verified, "rejected", {
        reason,
        verifyPolicyDecisionId: verifyPolicy.id,
        receivePolicyDecisionId: receivePolicy.id
      });
      return { ok: false, statusCode: verification.verified ? 403 : 401, status: "rejected", reason, event, verification };
    }

    const existingDelivery = this.findEventByDeliveryId(deliveryId);
    if (existingDelivery) {
      if (existingDelivery.payloadHash !== payloadHash) {
        this.recordWebhookAudit("github_webhook_duplicate_rejected", "rejected", {
          deliveryId,
          repoRef,
          result: "rejected",
          reason: "replay_rejected",
          sanitizedMetadata: {
            eventType,
            action,
            existingEventId: existingDelivery.id,
            existingPayloadHash: existingDelivery.payloadHash,
            payloadHash
          }
        });
        return { ok: false, statusCode: 409, status: "rejected", reason: "replay_rejected", event: existingDelivery, verification };
      }
      this.recordWebhookAudit("github_webhook_duplicate_ignored", "ignored", {
        deliveryId,
        repoRef,
        result: "ignored",
        reason: "duplicate_delivery",
        sanitizedMetadata: {
          eventType,
          action,
          existingEventId: existingDelivery.id,
          payloadHash
        }
      });
      return { ok: true, statusCode: 202, status: "ignored", reason: "duplicate_delivery", event: existingDelivery, verification };
    }

    const event = this.recordEvent(eventType, deliveryId, repoRef, action, payloadHash, true, "verified", {
      verifyPolicyDecisionId: verifyPolicy.id,
      receivePolicyDecisionId: receivePolicy.id
    });

    if (!this.isKnownEvent(eventType)) {
      this.store.updateGitWebhookEvent(event.id, { status: "ignored", processedAt: new Date(), metadata: { ...event.metadata, reason: "unsupported_event" } });
      this.recordWebhookAudit("github_webhook_unsupported_event", "ignored", {
        deliveryId,
        repoRef,
        result: "ignored",
        reason: "unsupported_event",
        sanitizedMetadata: { eventType, action }
      });
      return { ok: true, statusCode: 202, status: "ignored", reason: "unsupported_event", event: this.store.getGitWebhookEvent(event.id) ?? event, verification };
    }

    const processPolicy = this.evaluatePolicy("git.webhook.process", "git_operation", repoRef, {
      providerKind: "github",
      environment: {
        githubWebhooksEnabled: this.config.webhooksEnabled,
        signatureVerified: verification.verified,
        repoAllowlisted: repoAllowed,
        secretConfigured: this.config.webhookSecretConfigured
      },
      metadata: { eventType, action }
    });
    if (!processPolicy.allowed) {
      const blocked = this.store.updateGitWebhookEvent(event.id, {
        status: "rejected",
        processedAt: new Date(),
        metadata: { ...event.metadata, reason: "policy_denied", processPolicyDecisionId: processPolicy.id }
      });
      return { ok: false, statusCode: 403, status: "rejected", reason: "policy_denied", event: blocked, verification };
    }

    try {
      const syncState = await this.dispatchEvent(event, payload);
      const processed = this.store.updateGitWebhookEvent(event.id, {
        status: "processed",
        processedAt: new Date(),
        taskId: "taskId" in (syncState ?? {}) ? (syncState as GitPullRequestSyncState).taskId : event.taskId,
        taskRunId: "taskRunId" in (syncState ?? {}) ? (syncState as GitPullRequestSyncState).taskRunId : event.taskRunId
      });
      this.recordWebhookAudit("github_webhook_processed", "processed", {
        deliveryId,
        repoRef,
        result: "processed",
        sanitizedMetadata: { eventType, action, syncStateId: syncState?.id }
      });
      return { ok: true, statusCode: 202, status: "processed", event: processed, verification, syncState };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "webhook_processing_failed";
      const failed = this.store.updateGitWebhookEvent(event.id, {
        status: "failed",
        processedAt: new Date(),
        metadata: { ...event.metadata, reason, processingStatus: "dead_lettered", retryable: false }
      });
      this.recordWebhookAudit("github_webhook_processed", "failed", {
        deliveryId,
        repoRef,
        result: "failed",
        reason,
        sanitizedMetadata: { eventType, action }
      });
      this.recordWebhookAudit("github_webhook_dead_lettered", "failed", {
        deliveryId,
        repoRef,
        result: "failed",
        reason,
        sanitizedMetadata: { eventType, action, retryable: false }
      });
      return { ok: false, statusCode: 500, status: "failed", reason, event: failed, verification };
    }
  }

  manualSyncPullRequest(repoId: string, pullRequestNumber: number): GitHubManualSyncResult {
    return this.syncService.manualSyncPullRequest(repoId, pullRequestNumber);
  }

  async refreshChangedFiles(repoId: string, pullRequestNumber: number): Promise<GitHubManualSyncResult> {
    return this.syncService.refreshChangedFiles(repoId, pullRequestNumber);
  }

  private async dispatchEvent(event: GitWebhookEvent, payload: Record<string, unknown>): Promise<GitPullRequestSyncState | GitBranchSyncState | undefined> {
    if (event.eventType === "ping") {
      return undefined;
    }
    if (event.eventType === "pull_request") {
      if (!["opened", "synchronize", "reopened", "closed"].includes(event.action ?? "")) {
        this.recordWebhookAudit("github_webhook_unsupported_event", "ignored", {
          deliveryId: event.deliveryId,
          repoRef: event.repoRef,
          result: "ignored",
          reason: "unsupported_pull_request_action",
          sanitizedMetadata: { action: event.action }
        });
        return undefined;
      }
      return this.syncService.syncPullRequestFromWebhook(event, payload);
    }
    if (event.eventType === "push") {
      return this.syncService.syncBranchFromPushWebhook(event, payload);
    }
    return undefined;
  }

  private isKnownEvent(eventType: string): boolean {
    return this.config.supportedWebhookEvents.includes(eventType);
  }

  private repoAllowlisted(repoRef: string): boolean {
    const allowed = this.config.webhookAllowedRepos.map((entry) => entry.toLowerCase());
    return allowed.length === 0 || allowed.includes(repoRef.toLowerCase());
  }

  private recordEvent(
    eventType: string,
    deliveryId: string,
    repoRef: string,
    action: string | undefined,
    payloadHash: string,
    signatureVerified: boolean,
    status: GitWebhookEvent["status"],
    metadata: Record<string, unknown>
  ): GitWebhookEvent {
    return this.store.recordGitWebhookEvent({
      providerKind: "github",
      eventType,
      deliveryId,
      repoRef,
      action,
      payloadHash,
      signatureVerified,
      status,
      processedAt: status === "rejected" || status === "ignored" || status === "failed" ? new Date() : undefined,
      metadata: sanitizeMetadata(metadata)
    });
  }

  private findEventByDeliveryId(deliveryId: string): GitWebhookEvent | undefined {
    return this.store.listGitWebhookEvents({ deliveryId }).at(0);
  }

  private evaluatePolicy(
    action: PolicyAction,
    resourceKind: "git_operation" | "pull_request" | "branch",
    resourceId: string,
    input: {
      taskId?: string;
      taskRunId?: string;
      branchName?: string;
      providerKind?: string;
      environment?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  ): PolicyDecision {
    return this.policyService.evaluate({
      subject: this.actorId === "git_webhook_service"
        ? createServiceAccountPolicySubject("git_webhook_service", {
          source: "webhook",
          metadata: { boundary: "git_webhook_receiver_service" }
        })
        : createPolicySubject({ actorId: this.actorId, actorKind: "service", roles: ["system"] }),
      action,
      resource: createPolicyResource({
        resourceKind,
        resourceId,
        metadata: {
          providerKind: input.providerKind ?? "github",
          ...input.metadata
        }
      }),
      context: createPolicyContext({
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        repoId: resourceId,
        branchName: input.branchName,
        providerKind: input.providerKind ?? "github",
        environment: input.environment ?? {},
        metadata: input.metadata ?? {}
      })
    });
  }

  private recordWebhookAudit(
    eventType: string,
    result: GitWebhookAuditEvent["result"],
    input: {
      deliveryId?: string;
      repoRef?: string;
      reason?: string;
      result?: GitWebhookAuditEvent["result"];
      sanitizedMetadata?: Record<string, unknown>;
    }
  ): void {
    recordWebhookAudit(this.store, this.actorId, eventType, result, input);
  }
}

export type GitHubSyncServiceInput = {
  store: InMemoryAichestraStore;
  gitIntegrationService: GitIntegrationService;
  config: GitHubWebhookRuntimeConfig;
  actorId?: string;
  policyService?: PolicyService;
};

export class GitHubSyncService {
  private readonly store: InMemoryAichestraStore;
  private readonly gitIntegrationService: GitIntegrationService;
  private readonly config: GitHubWebhookRuntimeConfig;
  private readonly actorId: string;
  private readonly policyService: PolicyService;

  constructor(input: GitHubSyncServiceInput) {
    this.store = input.store;
    this.gitIntegrationService = input.gitIntegrationService;
    this.config = input.config;
    this.actorId = input.actorId ?? "git_sync_service";
    this.policyService = input.policyService ?? new PolicyService();
  }

  syncPullRequestFromWebhook(event: GitWebhookEvent, payload: Record<string, unknown>): GitPullRequestSyncState {
    recordWebhookAudit(this.store, this.actorId, "github_pr_sync_started", "received", {
      deliveryId: event.deliveryId,
      repoRef: event.repoRef,
      sanitizedMetadata: { eventId: event.id, action: event.action }
    });
    const pullRequest = asRecord(payload.pull_request);
    const prNumber = numberValue(pullRequest.number);
    if (!prNumber || prNumber < 1) {
      recordWebhookAudit(this.store, this.actorId, "github_pr_sync_failed", "failed", {
        deliveryId: event.deliveryId,
        repoRef: event.repoRef,
        reason: "pull_request_number_missing",
        sanitizedMetadata: { eventId: event.id }
      });
      throw new Error("pull_request_number_missing");
    }

    const repo = this.repoByRef(event.repoRef);
    const head = asRecord(pullRequest.head);
    const base = asRecord(pullRequest.base);
    const headBranch = stringValue(head.ref) ?? "unknown";
    const baseBranch = stringValue(base.ref) ?? repo?.defaultBranch ?? "unknown";
    const latestSha = stringValue(head.sha);
    const existingSync = this.store.getGitPullRequestSyncState(event.repoRef, prNumber);
    const mappedPullRequest = this.findPullRequest(repo, prNumber);
    const branchLease = this.findBranchLease(repo, headBranch, mappedPullRequest);
    const mergeQueueEntry = this.findMergeQueueEntry(repo, mappedPullRequest, branchLease?.id);
    const changedFiles = extractChangedFiles(payload);
    const effectiveChangedFiles = changedFiles.length > 0 ? changedFiles : existingSync?.changedFiles ?? [];
    if (branchLease && effectiveChangedFiles.length > 0) {
      this.store.updateBranchLease(branchLease.id, {
        files: uniqueStrings([...branchLease.files, ...effectiveChangedFiles])
      });
      this.store.refreshMergeQueueEntriesForLease(branchLease.id);
    }
    const state = this.store.upsertGitPullRequestSyncState({
      repoRef: event.repoRef,
      repoId: repo?.id,
      pullRequestNumber: prNumber,
      providerPullRequestId: stringValue(pullRequest.id),
      pullRequestId: mappedPullRequest?.id,
      taskId: mappedPullRequest?.taskId ?? branchLease?.taskId,
      taskRunId: branchLease?.taskRunId,
      branchLeaseId: branchLease?.id,
      mergeQueueEntryId: mergeQueueEntry?.id,
      state: pullRequestState(pullRequest),
      headBranch,
      baseBranch,
      latestSha,
      changedFiles: effectiveChangedFiles,
      labels: extractLabels(pullRequest),
      mergeableState: stringValue(pullRequest.mergeable_state),
      sourceEventId: event.id,
      metadata: sanitizeMetadata({
        source: "github_webhook",
        webhookAction: event.action,
        mapped: Boolean(mappedPullRequest),
        branchLeaseMapped: Boolean(branchLease),
        mergeQueueMapped: Boolean(mergeQueueEntry)
      })
    });
    this.syncBranchState(event.repoRef, repo, headBranch, latestSha, true, event.id);
    recordWebhookAudit(this.store, this.actorId, "github_pr_sync_completed", "processed", {
      deliveryId: event.deliveryId,
      repoRef: event.repoRef,
      sanitizedMetadata: { eventId: event.id, pullRequestNumber: prNumber, syncStateId: state.id }
    });
    return state;
  }

  syncBranchFromPushWebhook(event: GitWebhookEvent, payload: Record<string, unknown>): GitBranchSyncState {
    recordWebhookAudit(this.store, this.actorId, "github_branch_sync_started", "received", {
      deliveryId: event.deliveryId,
      repoRef: event.repoRef,
      sanitizedMetadata: { eventId: event.id, source: "push" }
    });
    const ref = stringValue(payload.ref);
    if (!ref?.startsWith("refs/heads/")) {
      recordWebhookAudit(this.store, this.actorId, "github_branch_sync_failed", "failed", {
        deliveryId: event.deliveryId,
        repoRef: event.repoRef,
        reason: "unsupported_push_ref",
        sanitizedMetadata: { eventId: event.id, ref }
      });
      throw new Error("unsupported_push_ref");
    }
    const repo = this.repoByRef(event.repoRef);
    const branchName = ref.slice("refs/heads/".length);
    const branch = this.syncBranchState(event.repoRef, repo, branchName, stringValue(payload.after), payload.deleted !== true, event.id);
    recordWebhookAudit(this.store, this.actorId, "github_branch_sync_completed", "processed", {
      deliveryId: event.deliveryId,
      repoRef: event.repoRef,
      sanitizedMetadata: { eventId: event.id, branchName, exists: branch.exists }
    });
    return branch;
  }

  manualSyncPullRequest(repoId: string, pullRequestNumber: number): GitHubManualSyncResult {
    const repo = this.store.getRepo(repoId);
    if (!repo) return { ok: false, reason: `Repo not found: ${repoId}` };
    if (repo.provider !== "github") return { ok: false, reason: "repo_not_github" };
    const repoRef = repoSlug(repo);
    const mappedPullRequest = this.findPullRequest(repo, pullRequestNumber);
    const policy = this.evaluatePolicy("git.pull_request.sync", "pull_request", repo.id, {
      providerKind: "github",
      environment: {
        repoKnown: true,
        repoAllowlisted: this.repoAllowlisted(repoRef),
        destructiveOperation: false,
        manualSyncRequested: true
      },
      metadata: { pullRequestNumber }
    });
    if (!policy.allowed) {
      recordWebhookAudit(this.store, this.actorId, "github_pr_sync_failed", "blocked", {
        repoRef,
        reason: "policy_denied",
        sanitizedMetadata: { pullRequestNumber, policyDecisionId: policy.id }
      });
      return { ok: false, reason: "policy_denied", policyDecisionId: policy.id };
    }

    const existingSync = this.store.getGitPullRequestSyncState(repoRef, pullRequestNumber);
    const branchLease = existingSync?.headBranch
      ? this.findBranchLease(repo, existingSync.headBranch, mappedPullRequest)
      : undefined;
    const state = this.store.upsertGitPullRequestSyncState({
      repoRef,
      repoId: repo.id,
      pullRequestNumber,
      providerPullRequestId: existingSync?.providerPullRequestId,
      pullRequestId: mappedPullRequest?.id ?? existingSync?.pullRequestId,
      taskId: mappedPullRequest?.taskId ?? existingSync?.taskId ?? branchLease?.taskId,
      taskRunId: existingSync?.taskRunId ?? branchLease?.taskRunId,
      branchLeaseId: existingSync?.branchLeaseId ?? branchLease?.id,
      mergeQueueEntryId: existingSync?.mergeQueueEntryId,
      state: existingSync?.state ?? (mappedPullRequest?.status === "open" ? "open" : mappedPullRequest?.status === "merged" ? "merged" : mappedPullRequest?.status === "closed" ? "closed" : "unknown"),
      headBranch: existingSync?.headBranch ?? "unknown",
      baseBranch: existingSync?.baseBranch ?? repo.defaultBranch,
      latestSha: existingSync?.latestSha,
      changedFiles: existingSync?.changedFiles ?? [],
      labels: existingSync?.labels,
      mergeableState: existingSync?.mergeableState,
      sourceEventId: existingSync?.sourceEventId,
      metadata: sanitizeMetadata({
        source: "manual_sync",
        mapped: Boolean(mappedPullRequest),
        previousSyncStateId: existingSync?.id
      })
    });
    recordWebhookAudit(this.store, this.actorId, "github_pr_sync_completed", "processed", {
      repoRef,
      sanitizedMetadata: { pullRequestNumber, syncStateId: state.id, source: "manual_sync" }
    });
    return { ok: true, pullRequestSyncState: state };
  }

  async refreshChangedFiles(repoId: string, pullRequestNumber: number): Promise<GitHubManualSyncResult> {
    const repo = this.store.getRepo(repoId);
    if (!repo) return { ok: false, reason: `Repo not found: ${repoId}` };
    const repoRef = repoSlug(repo);
    recordWebhookAudit(this.store, this.actorId, "github_changed_files_refresh_started", "received", {
      repoRef,
      sanitizedMetadata: { pullRequestNumber }
    });
    const gitConfig = this.gitIntegrationService.getConfig();
    const policy = this.evaluatePolicy("git.changed_files.read", "git_operation", repo.id, {
      providerKind: "github",
      environment: {
        remoteGitEnabled: gitConfig.remoteGitEnabled,
        remoteOperationAllowed: true,
        repoAllowlisted: this.repoAllowlisted(repoRef),
        credentialsConfigured: gitConfig.githubConfigured,
        destructiveOperation: false
      },
      metadata: { pullRequestNumber }
    });
    if (!policy.allowed) {
      recordWebhookAudit(this.store, this.actorId, "github_changed_files_refresh_blocked", "blocked", {
        repoRef,
        reason: "policy_denied",
        sanitizedMetadata: { pullRequestNumber, policyDecisionId: policy.id }
      });
      return { ok: false, reason: "policy_denied", policyDecisionId: policy.id };
    }

    const result = await this.gitIntegrationService.getPullRequestChangedFiles(repoId, { pullRequestNumber });
    if (!result.ok) {
      recordWebhookAudit(this.store, this.actorId, "github_changed_files_refresh_blocked", "blocked", {
        repoRef,
        reason: result.reason,
        sanitizedMetadata: { pullRequestNumber }
      });
      return { ok: false, reason: result.reason };
    }

    const changedFiles = result.changedFiles.map((file) => file.path);
    const existing = this.store.getGitPullRequestSyncState(repoRef, pullRequestNumber);
    const pullRequest = this.findPullRequest(repo, pullRequestNumber);
    const branchLease = existing?.headBranch ? this.findBranchLease(repo, existing.headBranch, pullRequest) : undefined;
    if (branchLease) {
      this.store.updateBranchLease(branchLease.id, {
        files: uniqueStrings([...branchLease.files, ...changedFiles])
      });
      this.store.refreshMergeQueueEntriesForLease(branchLease.id);
    }
    const state = this.store.upsertGitPullRequestSyncState({
      repoRef,
      repoId: repo.id,
      pullRequestNumber,
      providerPullRequestId: existing?.providerPullRequestId,
      pullRequestId: pullRequest?.id ?? existing?.pullRequestId,
      taskId: pullRequest?.taskId ?? existing?.taskId ?? branchLease?.taskId,
      taskRunId: existing?.taskRunId ?? branchLease?.taskRunId,
      branchLeaseId: existing?.branchLeaseId ?? branchLease?.id,
      mergeQueueEntryId: existing?.mergeQueueEntryId,
      state: existing?.state ?? "unknown",
      headBranch: existing?.headBranch ?? branchLease?.branchName ?? "unknown",
      baseBranch: existing?.baseBranch ?? repo.defaultBranch,
      latestSha: existing?.latestSha,
      changedFiles,
      labels: existing?.labels,
      mergeableState: existing?.mergeableState,
      sourceEventId: existing?.sourceEventId,
      metadata: sanitizeMetadata({ ...(existing?.metadata ?? {}), changedFilesRefreshed: true })
    });
    recordWebhookAudit(this.store, this.actorId, "github_changed_files_refresh_completed", "processed", {
      repoRef,
      sanitizedMetadata: { pullRequestNumber, changedFileCount: changedFiles.length, syncStateId: state.id }
    });
    return { ok: true, pullRequestSyncState: state, changedFiles: result.changedFiles };
  }

  private syncBranchState(
    repoRef: string,
    repo: Repo | undefined,
    branchName: string,
    latestSha: string | undefined,
    exists: boolean,
    sourceEventId: string
  ): GitBranchSyncState {
    const policy = this.evaluatePolicy("git.branch.sync", "branch", repo?.id ?? repoRef, {
      branchName,
      providerKind: "github",
      environment: {
        repoKnown: Boolean(repo),
        repoAllowlisted: this.repoAllowlisted(repoRef),
        destructiveOperation: false
      },
      metadata: { repoRef }
    });
    if (!policy.allowed) {
      recordWebhookAudit(this.store, this.actorId, "github_branch_sync_failed", "blocked", {
        repoRef,
        reason: "policy_denied",
        sanitizedMetadata: { branchName, policyDecisionId: policy.id }
      });
      throw new Error("policy_denied");
    }
    return this.store.upsertGitBranchSyncState({
      repoRef,
      repoId: repo?.id,
      branchName,
      latestSha,
      exists,
      protectedBranch: undefined,
      sourceEventId,
      metadata: sanitizeMetadata({ source: "github_webhook" })
    });
  }

  private findPullRequest(repo: Repo | undefined, pullRequestNumber: number): PullRequest | undefined {
    if (!repo) return undefined;
    return this.store.listPullRequests().find((pullRequest) =>
      pullRequest.repoId === repo.id && pullRequest.externalId === String(pullRequestNumber)
    );
  }

  private findBranchLease(repo: Repo | undefined, headBranch: string, pullRequest: PullRequest | undefined) {
    if (!repo) return undefined;
    return this.store.listBranchLeases(repo.id)
      .find((lease) =>
        lease.branchName === headBranch &&
        (pullRequest === undefined || lease.taskId === pullRequest.taskId)
      );
  }

  private findMergeQueueEntry(repo: Repo | undefined, pullRequest: PullRequest | undefined, branchLeaseId: string | undefined) {
    if (!repo) return undefined;
    return this.store.listMergeQueueEntries(repo.id)
      .find((entry) =>
        (pullRequest !== undefined && entry.pullRequestId === pullRequest.id) ||
        (branchLeaseId !== undefined && entry.branchLeaseId === branchLeaseId)
      );
  }

  private repoByRef(repoRef: string): Repo | undefined {
    return this.store.listRepos().find((repo) => repoSlug(repo) === repoRef.toLowerCase());
  }

  private repoAllowlisted(repoRef: string): boolean {
    const webhookAllowed = this.config.webhookAllowedRepos.map((entry) => entry.toLowerCase());
    return webhookAllowed.length === 0 || webhookAllowed.includes(repoRef.toLowerCase());
  }

  private evaluatePolicy(
    action: PolicyAction,
    resourceKind: "git_operation" | "pull_request" | "branch",
    resourceId: string,
    input: {
      taskId?: string;
      taskRunId?: string;
      branchName?: string;
      providerKind?: string;
      environment?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }
  ): PolicyDecision {
    return this.policyService.evaluate({
      subject: this.actorId === "git_sync_service"
        ? createServiceAccountPolicySubject("git_sync_service", {
          source: "worker",
          metadata: { boundary: "github_sync_service" }
        })
        : createPolicySubject({ actorId: this.actorId, actorKind: "service", roles: ["system"] }),
      action,
      resource: createPolicyResource({
        resourceKind,
        resourceId,
        metadata: {
          providerKind: input.providerKind ?? "github",
          ...input.metadata
        }
      }),
      context: createPolicyContext({
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        repoId: resourceId,
        branchName: input.branchName,
        providerKind: input.providerKind ?? "github",
        environment: input.environment ?? {},
        metadata: input.metadata ?? {}
      })
    });
  }
}

function recordWebhookAudit(
  store: InMemoryAichestraStore,
  actorId: string,
  eventType: string,
  result: GitWebhookAuditEvent["result"],
  input: {
    deliveryId?: string;
    repoRef?: string;
    reason?: string;
    sanitizedMetadata?: Record<string, unknown>;
  }
): void {
  const serviceMetadata = actorId === "git_webhook_service"
    ? serviceAccountAuditMetadata("git_webhook_service", { boundary: "git_webhook_receiver_service" })
    : actorId === "git_sync_service"
      ? serviceAccountAuditMetadata("git_sync_service", { boundary: "github_sync_service" })
      : {};
  const metadata = sanitizeMetadata({
    ...serviceMetadata,
    ...(input.sanitizedMetadata ?? {})
  });
  store.recordGitWebhookAuditEvent({
    eventType,
    deliveryId: input.deliveryId,
    repoRef: input.repoRef,
    result,
    reason: input.reason,
    sanitizedMetadata: metadata
  });
  store.recordAudit({
    action: `git.${eventType}`,
    targetType: "git",
    targetId: input.repoRef ?? input.deliveryId ?? "github_webhook",
    actorUserId: actorId,
    repoId: input.repoRef,
    metadata: sanitizeMetadata({
      deliveryId: input.deliveryId,
      repoRef: input.repoRef,
      result,
      reason: input.reason,
      ...metadata
    })
  });
}

function headerValue(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const direct = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (Array.isArray(direct)) return direct[0];
  return direct;
}

function repoRefFromPayload(payload: Record<string, unknown>): string {
  const repository = asRecord(payload.repository);
  const fullName = stringValue(repository.full_name);
  if (fullName) return fullName.toLowerCase();
  const owner = asRecord(repository.owner);
  const ownerName = stringValue(owner.login) ?? stringValue(owner.name) ?? stringValue(repository.owner);
  const repoName = stringValue(repository.name);
  return ownerName && repoName ? `${ownerName}/${repoName}`.toLowerCase() : "unknown";
}

function repoSlug(repo: Repo): string {
  return `${repo.owner}/${repo.name}`.toLowerCase();
}

function pullRequestState(pullRequest: Record<string, unknown>): GitPullRequestSyncState["state"] {
  if (pullRequest.merged === true) return "merged";
  if (pullRequest.draft === true) return "draft";
  const state = stringValue(pullRequest.state);
  if (state === "open" || state === "closed") return state;
  return "unknown";
}

function extractChangedFiles(payload: Record<string, unknown>): string[] {
  const pullRequest = asRecord(payload.pull_request);
  const files: unknown[] = Array.isArray(payload.changed_files)
    ? payload.changed_files
    : Array.isArray(pullRequest.changed_files)
      ? pullRequest.changed_files
      : [];
  return uniqueStrings(files.filter((file): file is string => typeof file === "string").map(sanitizePath));
}

function extractLabels(pullRequest: Record<string, unknown>): string[] | undefined {
  if (!Array.isArray(pullRequest.labels)) return undefined;
  const labels = pullRequest.labels.map((label) => {
    if (typeof label === "string") return label;
    return stringValue(asRecord(label).name);
  }).filter((label): label is string => Boolean(label));
  return labels.length > 0 ? uniqueStrings(labels) : undefined;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function sanitizePath(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").replace(/^\/+/, "").slice(0, 500);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(number) ? number : undefined;
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(metadata) as Record<string, unknown>;
}

function sanitizeValue(value: unknown, key = ""): unknown {
  if (/token|secret|credential|authorization|api[_-]?key|rawBody|payload/i.test(key)) {
    return "[redacted]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, entryKey)
    ]));
  }
  if (typeof value === "string") {
    return value
      .replace(/ghp_[A-Za-z0-9_]+/g, "[redacted]")
      .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
  }
  return value;
}
