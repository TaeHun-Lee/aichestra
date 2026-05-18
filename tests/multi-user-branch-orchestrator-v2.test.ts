import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { BranchOrchestratorService } from "@aichestra/git-adapter";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

function createServiceFixture() {
  const store = createSeededStore();
  const service = new BranchOrchestratorService({
    repoLookup: (repoId) => store.getRepo(repoId),
    branchLeaseLookup: (branchLeaseId) => store.getBranchLease(branchLeaseId),
    activeBranchLeaseLookup: (repoId, branchName) => store.listBranchLeases(repoId, "active").filter((lease) => lease.branchName === branchName),
    branchLeaseCreator: (input) => store.createBranchLease(input),
    workspaceLeaseLookup: (workspaceLeaseId) => ({ id: workspaceLeaseId, status: "active", repoId: "repo_demo_backend" }),
    mergeQueueLookup: (query) => store.listMergeQueueEntries(query.repoId)
      .filter((entry) =>
        (query.branchLeaseId === undefined || entry.branchLeaseId === query.branchLeaseId) &&
        (query.branchName === undefined || entry.branchName === query.branchName) &&
        (query.taskRunId === undefined || entry.taskRunId === query.taskRunId))
  });
  return { store, service };
}

function orchestrationInput(overrides: Partial<Parameters<BranchOrchestratorService["allocateBranch"]>[0]> = {}) {
  return {
    userId: "user_branch",
    actorId: "actor_branch",
    taskId: "task_branch",
    taskRunId: "taskrun_branch",
    agentRunId: "agentrun_branch_a",
    sessionId: "session_branch_a",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    branchPurpose: "agent_work" as const,
    targetFiles: ["src/auth/session.ts"],
    sourceScope: { scopeKind: "file" as const, paths: ["src/auth/session.ts"], metadata: {} },
    metadata: { source: "test" },
    ...overrides
  };
}

function getJson(port: number, requestPath: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

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
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(serialized);
  });
}

function serializedHasSecretMaterial(value: unknown): boolean {
  const serialized = JSON.stringify(value);
  return [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GITHUB_TOKEN",
    "VAULT_TOKEN",
    "sk-test",
    "ghp_",
    "github_pat_",
    "DATABASE_URL="
  ].some((needle) => serialized.includes(needle));
}

test("Multi-user Branch Orchestrator v2 allocates deterministic safe branch names and branch leases", () => {
  const { store, service } = createServiceFixture();

  const decision = service.allocateBranch(orchestrationInput({
    workspaceLeaseId: "workspace_branch_a"
  }));
  const ownership = service.listBranchOwnershipRecords({ branchName: decision.branchName })[0];

  assert.equal(decision.decision, "allocated");
  assert.match(decision.branchName, /^aichestra\/demo-backend\/task-branch\/agentrun-branch-a$/);
  assert.equal(decision.branchLeaseId !== undefined, true);
  assert.equal(store.getBranchLease(decision.branchLeaseId ?? "")?.branchName, decision.branchName);
  assert.equal(ownership?.workspaceLeaseId, "workspace_branch_a");
  assert.equal(service.getSummary().remoteGitOperation, false);
  assert.equal(service.getSummary().noDestructiveGit, true);
});

test("Multi-user Branch Orchestrator v2 sanitizes branch names and rejects reserved targets", () => {
  const { service } = createServiceFixture();

  const sanitized = service.validateBranchName("Aichestra/DEMO Backend/Unsafe Name!");
  const reserved = service.validateBranchName("main");
  const traversal = service.validateBranchName("aichestra/../escape");

  assert.equal(sanitized.ok, true);
  assert.equal(sanitized.branchName, "aichestra/demo-backend/unsafe-name");
  assert.equal(sanitized.warnings.includes("branch_name_sanitized"), true);
  assert.equal(reserved.ok, false);
  assert.equal(reserved.reason, "reserved_branch_name_rejected");
  assert.equal(traversal.ok, false);
  assert.equal(traversal.reason, "branch_name_path_traversal_rejected");
});

test("Multi-user Branch Orchestrator v2 detects branch collisions and shared workspace blockers", () => {
  const { service } = createServiceFixture();

  const first = service.allocateBranch(orchestrationInput({
    requestedBranchName: "aichestra/demo-backend/shared-branch",
    workspaceLeaseId: "workspace_shared_a"
  }));
  const collision = service.allocateBranch(orchestrationInput({
    userId: "user_branch_b",
    actorId: "actor_branch_b",
    taskRunId: "taskrun_branch_b",
    agentRunId: "agentrun_branch_b",
    sessionId: "session_branch_b",
    requestedBranchName: first.branchName,
    workspaceLeaseId: "workspace_shared_b"
  }));
  const workspaceBlock = service.allocateBranch(orchestrationInput({
    userId: "user_branch_c",
    actorId: "actor_branch_c",
    agentRunId: "agentrun_branch_c",
    sessionId: "session_branch_c",
    requestedBranchName: "aichestra/demo-backend/isolated-branch",
    workspaceLeaseId: "workspace_shared_a"
  }));

  assert.equal(collision.decision, "blocked_collision");
  assert.equal(collision.reason, "active_branch_name_collision");
  assert.equal(workspaceBlock.decision, "blocked_same_workspace");
  assert.equal(service.getSummary().blockedCollisions, 1);
  assert.equal(service.getSummary().sameWorkspaceBlockers, 1);
});

test("Multi-user Branch Orchestrator v2 models base drift and merge readiness without Git mutation", () => {
  const { service } = createServiceFixture();

  const decision = service.allocateBranch(orchestrationInput({
    requestedBranchName: "aichestra/demo-backend/base-drift",
    metadata: { currentBaseBranch: "develop", GITHUB_TOKEN: "ghp_should_redact" }
  }));
  const readyForReview = service.markReadyForReview(decision.branchName, { actorId: "reviewer", metadata: { noMergeExecuted: true } });
  const readyForMerge = service.markReadyForMerge(decision.branchName, { actorId: "reviewer", metadata: { noMergeExecuted: true } });
  const drift = service.listBaseBranchDrift({ branchName: decision.branchName })[0];
  const payload = { decision, readyForReview, readyForMerge, drift, audit: service.listAuditEvents() };

  assert.equal(decision.decision, "warning_base_branch_drift");
  assert.equal(drift?.status, "base_changed");
  assert.equal(drift?.severity, "high");
  assert.equal(drift?.recommendation, "manual_review");
  assert.equal(readyForReview.status, "ready_for_review");
  assert.equal(readyForMerge.status, "ready_for_merge");
  assert.equal(service.getSummary().readyForMerge, 1);
  assert.equal(service.getSummary().branchDeletion, false);
  assert.equal(serializedHasSecretMaterial(payload), false);
});

test("Multi-user Branch Orchestrator v2 API endpoints are metadata-only and safe", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const first = await postJson(address.port, "/git/branches/orchestrate", {
      userId: "user_api_a",
      agentRunId: "agentrun_api_a",
      taskId: "task_api",
      taskRunId: "taskrun_api",
      sessionId: "session_api_a",
      repoId: "repo_demo_backend",
      baseBranch: "main",
      workspaceLeaseId: "workspace_api_a",
      targetFiles: ["src/auth/session.ts"],
      sourceScope: { scopeKind: "file", paths: ["src/auth/session.ts"], metadata: { token: "ghp_should_redact" } },
      metadata: { source: "api_test", raw: "OPENAI_API_KEY=sk-test" }
    });
    const firstDecision = first.body.decision as Record<string, unknown>;
    const collision = await postJson(address.port, "/git/branches/orchestrate", {
      userId: "user_api_b",
      agentRunId: "agentrun_api_b",
      taskId: "task_api_b",
      taskRunId: "taskrun_api_b",
      sessionId: "session_api_b",
      repoId: "repo_demo_backend",
      baseBranch: "main",
      requestedBranchName: firstDecision.branchName
    });
    const orchestration = await getJson(address.port, "/git/branches/orchestration?repoId=repo_demo_backend");
    const ownership = await getJson(address.port, "/git/branches/ownership?repoId=repo_demo_backend");
    const drift = await getJson(address.port, "/git/branches/drift?repoId=repo_demo_backend");
    const summary = await getJson(address.port, "/git/branches/orchestration/summary");
    const policies = await getJson(address.port, "/git/branches/orchestration/policies");
    const audit = await getJson(address.port, "/git/branches/orchestration/audit?repoId=repo_demo_backend");
    const dashboard = await getJson(address.port, "/dashboard/git");
    const safePayload = { first, collision, orchestration, ownership, drift, summary, policies, audit, dashboard };

    assert.equal(first.statusCode, 201);
    assert.equal(collision.statusCode, 409);
    assert.equal((collision.body.decision as Record<string, unknown>).decision, "blocked_collision");
    assert.equal(orchestration.statusCode, 200);
    assert.equal(ownership.statusCode, 200);
    assert.equal(drift.statusCode, 200);
    assert.equal(summary.statusCode, 200);
    assert.equal(policies.statusCode, 200);
    assert.equal(audit.statusCode, 200);
    assert.equal(dashboard.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).remoteGitOperation, false);
    assert.equal((summary.body.summary as Record<string, unknown>).noDestructiveGit, true);
    assert.equal((summary.body.summary as Record<string, unknown>).branchDeletion, false);
    assert.equal(serializedHasSecretMaterial(safePayload), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Multi-user Branch Orchestrator v2 dashboard panel renders branch ownership and blockers", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("Branch Orchestrator"), true);
  assert.equal(html.includes("v2_implemented"), true);
  assert.equal(html.includes("blocked_collision"), true);
  assert.equal(html.includes("blocked_same_workspace"), true);
  assert.equal(html.includes("Base drift"), true);
  assert.equal(html.includes("no destructive Git true"), true);
  assert.equal(serializedHasSecretMaterial(html), false);
});
