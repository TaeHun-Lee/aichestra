import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  BranchCleanupRecoveryService,
  InMemoryBranchCleanupRecoveryRepository,
  type BranchOwnershipSnapshot,
  type WorkspaceLeaseSnapshot,
  type AgentSessionSnapshot,
  type PrOwnershipHandoffSnapshot,
  type WorktreeAllocationSnapshot
} from "@aichestra/git-adapter";
import type { BranchLease, MergeQueueEntry } from "@aichestra/core";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";
import { StaticPolicyEngine, PolicyService, createPolicyResource, createPolicySubject } from "@aichestra/policy";

const fixedNow = new Date("2026-05-18T00:00:00.000Z");

function makeBranchLease(overrides: Partial<BranchLease> = {}): BranchLease {
  return {
    id: overrides.id ?? "lease_default",
    taskId: overrides.taskId ?? "task_default",
    taskRunId: overrides.taskRunId ?? "run_default",
    repoId: overrides.repoId ?? "repo_default",
    branchId: overrides.branchId ?? "branch_default",
    branchName: overrides.branchName ?? "aichestra/test/branch-default",
    baseBranch: overrides.baseBranch ?? "main",
    files: overrides.files ?? [],
    symbols: overrides.symbols ?? [],
    tests: overrides.tests ?? [],
    status: overrides.status ?? "active",
    expiresAt: overrides.expiresAt,
    releasedAt: overrides.releasedAt,
    createdAt: overrides.createdAt ?? fixedNow,
    updatedAt: overrides.updatedAt ?? fixedNow
  };
}

function makeMergeQueueEntry(overrides: Partial<MergeQueueEntry> = {}): MergeQueueEntry {
  return {
    id: overrides.id ?? "queue_default",
    repoId: overrides.repoId ?? "repo_default",
    taskId: overrides.taskId ?? "task_default",
    taskRunId: overrides.taskRunId ?? "run_default",
    pullRequestId: overrides.pullRequestId ?? "pr_default",
    pullRequestUrl: overrides.pullRequestUrl ?? "https://example.invalid/pull/1",
    branchName: overrides.branchName ?? "aichestra/test/branch-default",
    branchLeaseId: overrides.branchLeaseId ?? "lease_default",
    priority: overrides.priority ?? 0,
    riskScore: overrides.riskScore ?? 0,
    conflictRiskScore: overrides.conflictRiskScore ?? 0,
    status: overrides.status ?? "ready",
    reasons: overrides.reasons ?? [],
    blockingReasons: overrides.blockingReasons ?? [],
    recommendation: overrides.recommendation ?? "ready_for_review",
    simulationStatus: overrides.simulationStatus,
    lastSimulationAt: overrides.lastSimulationAt,
    createdAt: overrides.createdAt ?? fixedNow,
    updatedAt: overrides.updatedAt ?? fixedNow,
    mergedAt: overrides.mergedAt,
    cancelledAt: overrides.cancelledAt
  };
}

function makeWorkspaceLease(overrides: Partial<WorkspaceLeaseSnapshot> = {}): WorkspaceLeaseSnapshot {
  return {
    id: overrides.id ?? "ws_default",
    taskId: overrides.taskId ?? "task_default",
    taskRunId: overrides.taskRunId,
    agentRunId: overrides.agentRunId ?? "agent_run_default",
    repoId: overrides.repoId ?? "repo_default",
    branchLeaseId: overrides.branchLeaseId,
    branchName: overrides.branchName ?? "aichestra/test/branch-default",
    workspacePath: overrides.workspacePath ?? "/tmp/fixture/branch-default",
    status: overrides.status ?? "active",
    isolationStatus: overrides.isolationStatus ?? "isolated",
    workspaceKind: overrides.workspaceKind ?? "fixture",
    expiresAt: overrides.expiresAt,
    ownerActorId: overrides.ownerActorId,
    ownerServiceAccountId: overrides.ownerServiceAccountId,
    latestCleanupDecision: overrides.latestCleanupDecision,
    metadata: overrides.metadata ?? {}
  };
}

function getJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(data)
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(data);
  });
}

async function withApiServer(run: (port: number) => Promise<void>): Promise<void> {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function hasSecretOrEnvValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /OPENAI_API_KEY=|ANTHROPIC_API_KEY=|AICHESTRA_LLM_API_KEY=|GITHUB_TOKEN=|VAULT_TOKEN=|AICHESTRA_DATABASE_URL=|DATABASE_URL=|SESSION_SECRET=|JWT_SECRET=|~\/\.codex|~\/\.claude|auth\.json|Google credential cache|ghp_|github_pat_|sk-[A-Za-z0-9_-]{6,}|hvs\./i.test(text);
}

test("scan detects expired branch lease, missing owner, shared worktree, abandoned session, stale queue entry, and dirty workspace", () => {
  const expiredLease = makeBranchLease({ id: "lease_expired", status: "expired" });
  const expirableLease = makeBranchLease({ id: "lease_expirable", expiresAt: new Date(fixedNow.getTime() - 60000) });
  const releasedLease = makeBranchLease({ id: "lease_released", status: "released" });
  const releasedQueue = makeMergeQueueEntry({ id: "queue_stale", branchLeaseId: "lease_released" });
  const sharedWorkspaceA = makeWorkspaceLease({
    id: "ws_shared_a",
    workspacePath: "/tmp/fixture/shared",
    branchLeaseId: "lease_expirable",
    branchName: "aichestra/test/branch-default"
  });
  const sharedWorkspaceB = makeWorkspaceLease({
    id: "ws_shared_b",
    workspacePath: "/tmp/fixture/shared",
    branchLeaseId: "lease_other",
    branchName: "aichestra/test/branch-other"
  });
  const dirtyWorkspace = makeWorkspaceLease({
    id: "ws_dirty",
    branchLeaseId: "lease_expirable",
    branchName: "aichestra/test/branch-dirty",
    workspacePath: "/tmp/fixture/dirty",
    latestCleanupDecision: "cleanup_blocked_dirty",
    status: "frozen"
  });
  const ownerlessOwnership: BranchOwnershipSnapshot = {
    id: "ownership_missing_owner",
    repoId: "repo_default",
    branchName: "aichestra/test/branch-owner",
    branchLeaseId: "lease_expirable",
    status: "active"
  };
  const abandonedSession: AgentSessionSnapshot = {
    id: "session_abandoned",
    repoId: "repo_default",
    branchName: "aichestra/test/branch-abandoned",
    status: "abandoned"
  };
  const expiredHandoff: PrOwnershipHandoffSnapshot = {
    id: "handoff_expired",
    repoId: "repo_default",
    pullRequestId: "pr_default",
    status: "expired"
  };
  const validatedWorktree: WorktreeAllocationSnapshot = {
    id: "worktree_validated",
    repoId: "repo_default",
    branchName: "aichestra/test/branch-default",
    worktreePath: "/tmp/fixture/shared",
    status: "validated",
    metadata: {}
  };

  const service = new BranchCleanupRecoveryService({
    repository: new InMemoryBranchCleanupRecoveryRepository(),
    dataSource: {
      listBranchLeases: () => [expiredLease, expirableLease, releasedLease],
      listWorkspaceLeases: () => [sharedWorkspaceA, sharedWorkspaceB, dirtyWorkspace],
      listMergeQueueEntries: () => [releasedQueue],
      listBranchOwnership: () => [ownerlessOwnership],
      listAgentSessions: () => [abandonedSession],
      listWorktreeAllocations: () => [validatedWorktree],
      listPullRequestHandoffs: () => [expiredHandoff]
    },
    now: () => fixedNow
  });

  const { orphans, recommendations } = service.scanForOrphans({}, { actorId: "actor_test", source: "test" });
  const reasons = orphans.map((orphan) => orphan.detectedReason);

  assert.equal(reasons.filter((reason) => reason === "expired").length >= 2, true);
  assert.equal(reasons.includes("missing_owner"), true);
  assert.equal(reasons.includes("abandoned_session"), true);
  assert.equal(reasons.includes("stale_queue_entry"), true);
  assert.equal(reasons.includes("inconsistent_state"), true);
  assert.equal(orphans.some((orphan) => orphan.severity === "critical" && orphan.leaseKind === "worktree"), true);
  assert.equal(recommendations.some((recommendation) => recommendation.recommendation === "release_metadata_lease" && recommendation.destructive === "false"), true);
  assert.equal(recommendations.some((recommendation) => recommendation.recommendation === "require_manual_review"), true);
  assert.equal(recommendations.every((recommendation) => recommendation.destructive !== "true_future" || ["delete_branch_future", "remove_worktree_future", "close_pr_future", "archive_record_future"].includes(recommendation.recommendation)), true);
  assert.equal(orphans.every((orphan) => !orphan.worktreePath || !orphan.worktreePath.startsWith("/tmp")), true);
  assert.equal(hasSecretOrEnvValue({ orphans, recommendations }), false);
});

test("metadata-only cleanup decision can execute and never deletes branches or worktrees", () => {
  const service = new BranchCleanupRecoveryService({
    repository: new InMemoryBranchCleanupRecoveryRepository(),
    dataSource: {
      listBranchLeases: () => [makeBranchLease({ id: "lease_expired", status: "expired" })]
    },
    now: () => fixedNow
  });

  const { recommendations } = service.scanForOrphans({}, { actorId: "actor_test" });
  const recommendation = recommendations.find((candidate) => candidate.recommendation === "release_metadata_lease");
  assert.ok(recommendation, "metadata-only recommendation must be present");

  const decision = service.decideRecommendation({
    recommendationId: recommendation!.id,
    decision: "approved_metadata_only",
    reason: "test approval"
  }, { actorId: "reviewer_test" });
  assert.equal(decision.decision, "approved_metadata_only");

  const result = service.executeMetadataOnlyCleanup(decision.id, { actorId: "reviewer_test" });
  assert.equal(result.metadataOnly, true);
  assert.equal(result.realBranchDeleted, false);
  assert.equal(result.realWorktreeRemoved, false);
  assert.equal(result.realPullRequestClosed, false);
  assert.equal(result.filesystemDeletionsExecuted, false);
  assert.equal(result.remoteGitCallsExecuted, false);
  assert.equal(result.decision.decision, "executed_metadata_only");
});

test("destructive cleanup recommendations stay future and cannot execute metadata-only", () => {
  const repository = new InMemoryBranchCleanupRecoveryRepository();
  const service = new BranchCleanupRecoveryService({
    repository,
    dataSource: {
      listBranchLeases: () => []
    },
    now: () => fixedNow
  });
  const orphan = repository.saveOrphan({
    id: "orphan_branch_missing",
    leaseKind: "branch",
    relatedId: "lease_branch_missing",
    repoId: "repo_default",
    branchName: "aichestra/test/branch-missing",
    detectedReason: "branch_missing_future",
    severity: "medium",
    detectedAt: fixedNow,
    metadata: {}
  });
  const recommendation = service.evaluateRecord(orphan.id, { actorId: "tester" });
  assert.equal(recommendation.recommendation, "delete_branch_future");
  assert.equal(recommendation.destructive, "true_future");

  const decision = service.decideRecommendation({
    recommendationId: recommendation.id,
    decision: "approved_metadata_only",
    reason: "attempt unsafe approval"
  }, { actorId: "tester" });
  assert.equal(decision.decision, "future_destructive_review");

  assert.throws(() => service.executeMetadataOnlyCleanup(decision.id, { actorId: "tester" }),
    /not approved for metadata-only execution|Destructive cleanup remains future-only/);
});

test("policy denies destructive cleanup, branch deletion, worktree removal, and PR closure by default", () => {
  const policyService = new PolicyService({ engine: new StaticPolicyEngine() });
  const subject = createPolicySubject({ actorId: "mock-actor", actorKind: "user", roles: ["platform_admin"] });

  for (const action of ["cleanup.destructive_execute_future", "branch.delete_future", "worktree.remove_future", "pr.close_future"] as const) {
    const resource = createPolicyResource({
      resourceKind: action === "branch.delete_future" ? "branch" : action === "worktree.remove_future" ? "workspace" : action === "pr.close_future" ? "pull_request" : "cleanup",
      resourceId: "test"
    });
    const decision = policyService.evaluate({
      subject,
      resource,
      action,
      context: { environment: { metadataOnly: false }, metadata: {} }
    });
    assert.equal(decision.decision, "deny", `${action} must be denied by default`);
  }
});

test("policy allows cleanup.scan, cleanup.recommend, cleanup.decide, cleanup.metadata_execute under mock metadata-only context", () => {
  const policyService = new PolicyService({ engine: new StaticPolicyEngine() });
  const subject = createPolicySubject({ actorId: "mock-actor", actorKind: "user", roles: ["platform_admin"] });
  const resource = createPolicyResource({ resourceKind: "cleanup", resourceId: "cleanup_default" });
  const environment = {
    metadataOnly: true,
    destructiveCleanupEnabled: false,
    realBranchDeletion: false,
    realWorktreeRemoval: false,
    realPullRequestClosed: false
  };
  for (const action of ["cleanup.scan", "cleanup.recommend", "cleanup.decide", "cleanup.metadata_execute"] as const) {
    const decision = policyService.evaluate({ subject, resource, action, context: { environment, metadata: {} } });
    assert.equal(decision.decision, "allow", `${action} must be allowed by default`);
  }
});

test("dirty workspace blocks cleanup and lands as require_manual_review", () => {
  const service = new BranchCleanupRecoveryService({
    repository: new InMemoryBranchCleanupRecoveryRepository(),
    dataSource: {
      listBranchLeases: () => [],
      listWorkspaceLeases: () => [makeWorkspaceLease({
        id: "ws_dirty",
        latestCleanupDecision: "cleanup_blocked_uncommitted",
        status: "frozen"
      })]
    },
    now: () => fixedNow
  });
  const { recommendations, orphans } = service.scanForOrphans({}, { actorId: "tester" });
  assert.equal(orphans.some((orphan) => orphan.leaseKind === "workspace" && orphan.metadata.cleanupDecision === "cleanup_blocked_uncommitted"), true);
  assert.equal(recommendations.some((recommendation) => recommendation.recommendation === "require_manual_review"), true);
});

test("Branch Cleanup readiness API endpoints are metadata-only and never destructive", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/git/cleanup/summary");
    const orphans = await getJson(port, "/git/cleanup/orphans");
    const scanResult = await postJson(port, "/git/cleanup/scan", {});
    const decisions = await getJson(port, "/git/cleanup/decisions");
    const recoveryActions = await getJson(port, "/git/cleanup/recovery-actions");
    const recommendations = await getJson(port, "/git/cleanup/recommendations");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).destructiveCleanupEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).realBranchDeleted, false);
    assert.equal(orphans.statusCode, 200);
    assert.equal(Array.isArray(orphans.body.orphans), true);
    assert.equal(scanResult.statusCode, 201);
    assert.equal(Array.isArray(scanResult.body.orphans), true);
    assert.equal(Array.isArray(scanResult.body.recommendations), true);
    assert.equal(decisions.statusCode, 200);
    assert.equal(Array.isArray(decisions.body.decisions), true);
    assert.equal(recoveryActions.statusCode, 200);
    assert.equal(Array.isArray(recoveryActions.body.recoveryActions), true);
    assert.equal(recommendations.statusCode, 200);
    assert.equal(Array.isArray(recommendations.body.recommendations), true);

    const health = await getJson(port, "/health");
    assert.equal((health.body.branchCleanup as Record<string, unknown>).destructiveCleanupEnabled, false);
    assert.equal((health.body.branchCleanup as Record<string, unknown>).realBranchDeleted, false);
    assert.equal((health.body.branchCleanup as Record<string, unknown>).realWorktreeRemoved, false);
    assert.equal((health.body.branchCleanup as Record<string, unknown>).realPullRequestClosed, false);
    assert.equal((health.body.branchCleanup as Record<string, unknown>).filesystemDeletionsExecuted, false);
    assert.equal((health.body.branchCleanup as Record<string, unknown>).remoteGitCallsExecuted, false);
    assert.equal((health.body.branchCleanup as Record<string, unknown>).noSecretsExposed, true);

    assert.equal(hasSecretOrEnvValue({ summary, orphans, scanResult, decisions, recoveryActions, recommendations, health }), false);
  });
});

test("dashboard panel renders Branch Cleanup metadata-only safety status without secrets", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/git-cleanup");
    const panel = dashboard.body.branchCleanup as Record<string, unknown>;
    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).destructiveCleanupEnabled, false);
    assert.equal((panel.policyStatus as Record<string, unknown>).destructiveCleanupAllowed, false);
    assert.equal((panel.policyStatus as Record<string, unknown>).branchDeletionAllowed, false);
    assert.equal((panel.policyStatus as Record<string, unknown>).worktreeRemovalAllowed, false);
    assert.equal((panel.policyStatus as Record<string, unknown>).prClosureAllowed, false);
    assert.equal((panel.noDestructiveStatus as Record<string, unknown>).realBranchDeleted, false);
    assert.equal((panel.noDestructiveStatus as Record<string, unknown>).realWorktreeRemoved, false);
    assert.equal((panel.noDestructiveStatus as Record<string, unknown>).realPullRequestClosed, false);
    assert.equal(hasSecretOrEnvValue(dashboard), false);
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Branch Cleanup / Orphan Lease Recovery"), true);
  assert.equal(html.includes("destructive cleanup enabled false"), true);
  assert.equal(html.includes("real branch deleted false"), true);
  assert.equal(html.includes("real worktree removed false"), true);
  assert.equal(html.includes("real PR closed false"), true);
  assert.equal(hasSecretOrEnvValue(html), false);
});
