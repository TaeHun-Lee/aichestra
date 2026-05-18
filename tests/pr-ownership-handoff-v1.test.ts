import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  PrOwnershipService,
  type PrOwnershipPolicyEvaluationInput
} from "@aichestra/core";
import { createApiServer } from "@aichestra/api";
import { InMemoryAichestraStore } from "@aichestra/db";
import { renderDashboardHtml } from "../apps/web/src/render.ts";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";

type Fixture = {
  store: InMemoryAichestraStore;
  repoId: string;
  branchLeaseId: string;
  mergeQueueEntryId: string;
  pullRequestId: string;
  taskId: string;
  taskRunId: string;
  branchName: string;
};

function postJson(port: number, requestPath: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: requestPath,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized)
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
        });
      });
    });
    request.on("error", reject);
    request.end(serialized);
  });
}

function getJson(port: number, requestPath: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
        });
      });
    });
    request.on("error", reject);
  });
}

function fixture(): Fixture {
  const store = new InMemoryAichestraStore();
  const repoId = "repo_pr_ownership";
  const branchName = "ai/pr-ownership-fixture";
  const task = store.createTask({
    title: "PR ownership fixture",
    repoId,
    baseBranch: "main",
    selectedSkillIds: []
  });
  const run = store.createTaskRun({
    taskId: task.id,
    attempt: 1,
    status: "succeeded",
    agent: "codex",
    model: "mock-model"
  });
  const lease = store.createBranchLease({
    taskId: task.id,
    taskRunId: run.id,
    repoId,
    branchId: `branch_${run.id}`,
    branchName,
    baseBranch: "main",
    files: ["src/pr-owner.ts"],
    symbols: [],
    tests: ["pnpm test"],
    status: "active"
  });
  const pullRequest = store.createPullRequest({
    taskId: task.id,
    repoId,
    provider: "mock",
    externalId: "42",
    url: "mock://pull-requests/42",
    status: "open"
  });
  const entry = store.createMergeQueueEntry({
    repoId,
    taskId: task.id,
    taskRunId: run.id,
    branchLeaseId: lease.id,
    pullRequestId: pullRequest.id,
    pullRequestUrl: pullRequest.url ?? "mock://pull-requests/42",
    branchName,
    priority: 5,
    riskScore: 0
  });
  store.upsertGitPullRequestSyncState({
    repoRef: repoId,
    repoId,
    pullRequestNumber: 42,
    pullRequestId: pullRequest.id,
    taskId: task.id,
    taskRunId: run.id,
    branchLeaseId: lease.id,
    mergeQueueEntryId: entry.id,
    state: "open",
    headBranch: branchName,
    baseBranch: "main",
    changedFiles: ["src/pr-owner.ts"],
    metadata: { source: "test" }
  });
  return {
    store,
    repoId,
    branchLeaseId: lease.id,
    mergeQueueEntryId: entry.id,
    pullRequestId: pullRequest.id,
    taskId: task.id,
    taskRunId: run.id,
    branchName
  };
}

function service(
  setup: Fixture,
  policyEvaluator?: (input: PrOwnershipPolicyEvaluationInput) => { allowed: boolean; reason?: string; policyDecisionId?: string }
): PrOwnershipService {
  return new PrOwnershipService({
    dataSource: {
      getBranchLease: (id) => setup.store.getBranchLease(id),
      getMergeQueueEntry: (id) => setup.store.getMergeQueueEntry(id),
      listMergeQueueEntries: (repoId) => setup.store.listMergeQueueEntries(repoId),
      getPullRequest: (id) => setup.store.listPullRequests().find((pullRequest) => pullRequest.id === id),
      getPullRequestSyncState: (repoId, pullRequestNumber) => setup.store.getGitPullRequestSyncState(repoId, pullRequestNumber)
    },
    policyEvaluator
  });
}

function noUnsafeValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return !text.includes("GITHUB_TOKEN=") &&
    !text.includes("OPENAI_API_KEY=") &&
    !text.includes("ANTHROPIC_API_KEY=") &&
    !text.includes("VAULT_TOKEN=") &&
    !text.includes("credential cache") &&
    !text.includes("ghp_") &&
    !text.includes("sk-test");
}

test("PR Ownership / Handoff v1 creates ownership records linked to branch lease and PR metadata", () => {
  const setup = fixture();
  const ownership = service(setup).createOwnership({
    mergeQueueEntryId: setup.mergeQueueEntryId,
    pullRequestNumber: 42,
    ownerActorId: "agent_codex_fixture",
    ownerKind: "agent",
    reviewerActorIds: ["user_reviewer"],
    metadata: { source: "test", tokenPreview: "GITHUB_TOKEN=ghp_secret" }
  }, { actorId: "tester", requestId: "req_pr_owner" });

  assert.equal(ownership.repoId, setup.repoId);
  assert.equal(ownership.branchName, setup.branchName);
  assert.equal(ownership.branchLeaseId, setup.branchLeaseId);
  assert.equal(ownership.pullRequestId, setup.pullRequestId);
  assert.equal(ownership.mergeQueueEntryId, setup.mergeQueueEntryId);
  assert.equal(ownership.ownerKind, "agent");
  assert.equal(ownership.metadata.remotePrUpdate, false);
  assert.equal(noUnsafeValue(ownership), true);
});

test("PR Ownership / Handoff v1 accepts handoff and transfers owner metadata locally", () => {
  const setup = fixture();
  const prOwnership = service(setup);
  const ownership = prOwnership.createOwnership({
    repoId: setup.repoId,
    branchName: setup.branchName,
    pullRequestId: setup.pullRequestId,
    branchLeaseId: setup.branchLeaseId,
    mergeQueueEntryId: setup.mergeQueueEntryId,
    ownerActorId: "agent_codex_fixture",
    ownerKind: "agent"
  });
  const handoff = prOwnership.requestHandoff({
    ownershipRecordId: ownership.id,
    toActorId: "user_reviewer",
    handoffKind: "agent_to_human",
    reason: "agent work needs human review"
  }, { actorId: "agent_codex_fixture", requestId: "req_handoff" });
  const decision = prOwnership.decideHandoff(handoff.id, {
    decision: "accept",
    decidedByActorId: "user_reviewer",
    reason: "accepted for review"
  }, { actorId: "user_reviewer", correlationId: "corr_handoff" });
  const transferred = prOwnership.getOwnership(ownership.id);

  assert.equal(handoff.status, "requested");
  assert.equal(decision.decision, "accept");
  assert.equal(transferred?.ownerActorId, "user_reviewer");
  assert.equal(transferred?.ownerKind, "human");
  assert.equal(prOwnership.listAuditEvents({ ownershipRecordId: ownership.id }).some((event) => event.eventType === "ownership_transferred"), true);
  assert.equal(prOwnership.getSummary().githubApiCalls, false);
});

test("PR Ownership / Handoff v1 rejects and expires handoffs without changing owner", () => {
  const setup = fixture();
  const prOwnership = service(setup);
  const ownership = prOwnership.createOwnership({
    repoId: setup.repoId,
    branchName: setup.branchName,
    ownerActorId: "user_original",
    ownerKind: "human"
  });
  const rejected = prOwnership.requestHandoff({
    ownershipRecordId: ownership.id,
    toActorId: "user_reviewer",
    handoffKind: "human_to_human"
  });
  prOwnership.decideHandoff(rejected.id, { decision: "reject", decidedByActorId: "user_reviewer" });
  assert.equal(prOwnership.getOwnership(ownership.id)?.ownerActorId, "user_original");
  assert.equal(prOwnership.listHandoffs({ ownershipRecordId: ownership.id }).find((handoff) => handoff.id === rejected.id)?.status, "rejected");

  const expiring = prOwnership.requestHandoff({
    ownershipRecordId: ownership.id,
    toActorId: "user_later",
    expiresAt: new Date("2026-01-01T00:00:00.000Z")
  });
  const expired = prOwnership.expireHandoffs(new Date("2026-01-02T00:00:00.000Z"));
  assert.equal(expired.some((handoff) => handoff.id === expiring.id), true);
  assert.equal(prOwnership.getOwnership(ownership.id)?.ownerActorId, "user_original");
});

test("PR Ownership / Handoff v1 policy denial blocks handoff without transfer", () => {
  const setup = fixture();
  const prOwnership = service(setup, (input) => ({
    allowed: input.action !== "pr_handoff.request",
    reason: input.action === "pr_handoff.request" ? "mock_policy_denied" : "mock_allowed",
    policyDecisionId: `policy_${input.action.replaceAll(".", "_")}`
  }));
  const ownership = prOwnership.createOwnership({
    repoId: setup.repoId,
    branchName: setup.branchName,
    ownerActorId: "user_original"
  });
  const handoff = prOwnership.requestHandoff({
    ownershipRecordId: ownership.id,
    toActorId: "user_blocked"
  });

  assert.equal(handoff.status, "blocked_policy");
  assert.equal(prOwnership.getOwnership(ownership.id)?.ownerActorId, "user_original");
  assert.equal(prOwnership.getSummary().blockedHandoffs, 1);
});

test("PR Ownership / Handoff v1 stores local reviewer metadata only", () => {
  const setup = fixture();
  const prOwnership = service(setup);
  const ownership = prOwnership.createOwnership({
    repoId: setup.repoId,
    branchName: setup.branchName,
    ownerActorId: "user_owner"
  });
  const reviewed = prOwnership.addReviewer({
    ownershipRecordId: ownership.id,
    reviewerActorId: "user_reviewer",
    reviewerTeamId: "team_review",
    metadata: { remoteReviewerAssignment: true }
  });

  assert.equal(reviewed.reviewerActorIds.includes("user_reviewer"), true);
  assert.equal(reviewed.reviewerTeamIds.includes("team_review"), true);
  assert.equal(reviewed.metadata.remoteReviewerAssignment, false);
  assert.equal(prOwnership.getSummary().remoteReviewerAssignmentEnabled, false);
});

test("PR Ownership / Handoff v1 keeps human-to-agent handoff acceptance future-blocked", () => {
  const setup = fixture();
  const prOwnership = service(setup);
  const ownership = prOwnership.createOwnership({
    repoId: setup.repoId,
    branchName: setup.branchName,
    ownerActorId: "user_owner",
    ownerKind: "human"
  });
  const handoff = prOwnership.requestHandoff({
    ownershipRecordId: ownership.id,
    toServiceAccountId: "future_agent_owner",
    handoffKind: "human_to_agent_future"
  });
  const decision = prOwnership.decideHandoff(handoff.id, {
    decision: "accept",
    decidedByActorId: "future_agent_owner"
  });

  assert.equal(handoff.status, "requested");
  assert.equal(decision.decision, "blocked");
  assert.equal(prOwnership.getOwnership(ownership.id)?.ownerActorId, "user_owner");
});

test("PR Ownership / Handoff v1 exposes merge queue and conflict resolution ownership links", () => {
  const setup = fixture();
  const prOwnership = service(setup);
  const missing = prOwnership.getMergeQueueOwnershipReadiness(setup.mergeQueueEntryId);
  assert.equal(missing.status, "missing_owner");
  assert.equal(missing.mergeQueueReadyBlocked, true);

  const ownership = prOwnership.createOwnership({
    repoId: setup.repoId,
    branchName: setup.branchName,
    mergeQueueEntryId: setup.mergeQueueEntryId,
    conflictResolutionPlanId: "conflict_plan_review",
    ownerActorId: "user_owner",
    reviewerActorIds: ["user_reviewer"]
  });
  const ready = prOwnership.getMergeQueueOwnershipReadiness(setup.mergeQueueEntryId);
  const conflictLink = prOwnership.getConflictResolutionPlanOwnership("conflict_plan_review");

  assert.equal(ready.status, "owner_present");
  assert.equal(ready.ownershipRecordId, ownership.id);
  assert.equal(conflictLink.ownershipRecordIds.includes(ownership.id), true);
  assert.equal(conflictLink.reviewerActorIds.includes("user_reviewer"), true);
});

test("PR Ownership / Handoff v1 does not mutate source store records", () => {
  const setup = fixture();
  const before = JSON.stringify(setup.store.snapshot());
  const prOwnership = service(setup);
  const ownership = prOwnership.createOwnership({
    repoId: setup.repoId,
    branchName: setup.branchName,
    ownerActorId: "user_owner"
  });
  prOwnership.requestHandoff({ ownershipRecordId: ownership.id, toActorId: "user_next" });
  assert.equal(JSON.stringify(setup.store.snapshot()), before);
});

test("PR Ownership / Handoff v1 API endpoints are metadata-only and safe", async () => {
  const setup = fixture();
  const server = createApiServer(setup.store);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const created = await postJson(port, "/git/pr-ownership", {
      mergeQueueEntryId: setup.mergeQueueEntryId,
      ownerActorId: "agent_api_owner",
      ownerKind: "agent",
      metadata: { source: "api_test", token: "GITHUB_TOKEN=ghp_secret" }
    });
    assert.equal(created.statusCode, 201);
    const ownership = created.body.ownership as Record<string, unknown>;
    const handoff = await postJson(port, `/git/pr-ownership/${ownership.id}/handoff`, {
      toActorId: "user_api_reviewer",
      handoffKind: "agent_to_human",
      reason: "api test handoff"
    });
    assert.equal(handoff.statusCode, 201);
    const handoffRecord = handoff.body.handoff as Record<string, unknown>;
    const decision = await postJson(port, `/git/pr-handoffs/${handoffRecord.id}/decision`, {
      decision: "accept",
      decidedByActorId: "user_api_reviewer",
      reason: "api test accepted"
    });
    assert.equal(decision.statusCode, 200);
    const summary = await getJson(port, "/git/pr-ownership/summary");
    const readiness = await getJson(port, "/readiness/pr-ownership/summary");
    const dashboard = await getJson(port, "/dashboard/git");

    assert.equal(summary.statusCode, 200);
    assert.equal(((summary.body.summary as Record<string, unknown>).remotePrUpdateEnabled), false);
    assert.equal(((summary.body.summary as Record<string, unknown>).githubApiCalls), false);
    assert.equal(readiness.statusCode, 200);
    assert.equal(dashboard.statusCode, 200);
    assert.equal(noUnsafeValue({ created, handoff, decision, summary, readiness, dashboard }), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("PR Ownership / Handoff v1 dashboard panel renders without secrets or remote PR mutation", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("PR Ownership / Handoff"), true);
  assert.equal(html.includes("remote PR update disabled"), true);
  assert.equal(html.includes("GitHub API calls disabled"), true);
  assert.equal(html.includes("GITHUB_TOKEN="), false);
  assert.equal(html.includes("OPENAI_API_KEY="), false);
});
