import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  AgentRunnerService,
  AgentWorkspaceLifecycleService,
  LocalAgentWorkspaceManager,
  MockAgentRunner,
  agentWorkspaceLeaseToDto
} from "@aichestra/runner";
import type { AgentRunRequest } from "@aichestra/runner";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

function requestFixture(patch: Partial<AgentRunRequest> = {}): AgentRunRequest {
  return {
    taskId: "task_workspace_lifecycle_v2",
    taskRunId: "run_workspace_lifecycle_v2",
    actorId: "user_workspace_owner",
    repoRef: { repoId: "repo_workspace_lifecycle", provider: "mock" },
    branchRef: { repoId: "repo_workspace_lifecycle", branchName: "codex/workspace-lifecycle-v2", baseBranch: "main" },
    selectedModelRef: "mock-coder@1.0",
    selectedSkillRefs: [{ kind: "skill", name: "workspace-lifecycle", version: "1.0.0" }],
    selectedHarnessRef: { kind: "harness", name: "backend-node20", version: "1.0.0" },
    selectedInstructionRefs: [],
    prompt: "Fix login workspace lifecycle metadata",
    allowedCommands: [],
    testCommands: [],
    maxRuntimeMs: 2_000,
    metadata: {},
    ...patch
  };
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

function getJson(port: number, requestPath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

test("AgentWorkspaceLifecycleService requests future worktree leases and records lifecycle transitions", () => {
  const service = new AgentWorkspaceLifecycleService();
  const lease = service.requestWorkspace({
    taskId: "task_lifecycle_request",
    taskRunId: "run_lifecycle_request",
    agentRunId: "agentrun_lifecycle_request",
    repoId: "repo_lifecycle",
    branchLeaseId: "branchlease_lifecycle",
    branchName: "codex/lifecycle-request",
    baseBranch: "main",
    workspaceKind: "git_worktree_future",
    ownerActorId: "user_lifecycle"
  }, {
    actorId: "user_lifecycle",
    requestId: "req_lifecycle",
    correlationId: "corr_lifecycle"
  });

  assert.equal(lease.status, "requested");
  assert.equal(lease.workspaceKind, "git_worktree_future");
  assert.equal(lease.isolationStatus, "unknown");
  assert.equal(lease.branchLeaseId, "branchlease_lifecycle");
  assert.equal(lease.metadata.futureWorktreeExecutionEnabled, false);
  assert.equal(lease.metadata.destructiveCleanupEnabled, false);

  assert.equal(service.markActive(lease.id).status, "active");
  assert.equal(service.freezeWorkspace(lease.id).status, "frozen");
  assert.equal(service.markReadyForMerge(lease.id).status, "ready_for_merge");
  assert.equal(service.recordMergeCompleted(lease.id).status, "merged");
  assert.deepEqual(service.listEvents(lease.id).map((event) => event.eventType), [
    "requested",
    "activated",
    "frozen",
    "ready_for_merge",
    "merge_completed"
  ]);
});

test("fixture workspace leases enforce one active workspace per AgentRun and flag shared paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "aichestra-workspace-lifecycle-v2-"));
  try {
    const service = new AgentWorkspaceLifecycleService({
      workspaceManager: new LocalAgentWorkspaceManager({ workspaceRoot: root })
    });
    const workspaceA = path.join(root, "agent-a");
    const workspaceB = path.join(root, "agent-b");
    await mkdir(workspaceA, { recursive: true });
    await mkdir(workspaceB, { recursive: true });

    const first = await service.allocateFixtureWorkspace({
      taskId: "task_fixture",
      taskRunId: "run_fixture",
      agentRunId: "agentrun_fixture_a",
      repoId: "repo_fixture",
      branchLeaseId: "branchlease_fixture",
      branchName: "codex/fixture-a",
      baseBranch: "main",
      workspacePath: workspaceA,
      ownerActorId: "user_fixture"
    });
    assert.equal(first.status, "allocated");
    assert.equal(first.isolationStatus, "isolated");
    assert.equal(service.markActive(first.id).status, "active");

    const duplicateAgentRun = await service.allocateFixtureWorkspace({
      taskId: "task_fixture",
      taskRunId: "run_fixture",
      agentRunId: "agentrun_fixture_a",
      repoId: "repo_fixture",
      branchName: "codex/fixture-a",
      baseBranch: "main",
      workspacePath: workspaceB,
      ownerActorId: "user_fixture"
    });
    assert.equal(duplicateAgentRun.id, first.id);

    const shared = await service.allocateFixtureWorkspace({
      taskId: "task_fixture",
      taskRunId: "run_fixture_2",
      agentRunId: "agentrun_fixture_b",
      repoId: "repo_fixture",
      branchName: "codex/fixture-b",
      baseBranch: "main",
      workspacePath: workspaceA,
      ownerActorId: "user_fixture"
    });
    assert.equal(shared.status, "failed");
    assert.equal(shared.isolationStatus, "shared_forbidden");
    assert.equal(shared.metadata.reason, "shared_workspace_forbidden");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("cleanup decisions block dirty or unmerged workspaces and never delete non-fixture paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "aichestra-workspace-cleanup-v2-"));
  try {
    const service = new AgentWorkspaceLifecycleService({
      workspaceManager: new LocalAgentWorkspaceManager({ workspaceRoot: root })
    });
    const fixturePath = path.join(root, "dirty-fixture");
    const futurePath = path.join(root, "future-worktree");
    await mkdir(fixturePath, { recursive: true });
    await mkdir(futurePath, { recursive: true });

    const fixture = await service.allocateFixtureWorkspace({
      taskId: "task_cleanup",
      taskRunId: "run_cleanup",
      agentRunId: "agentrun_cleanup",
      repoId: "repo_cleanup",
      branchName: "codex/cleanup",
      baseBranch: "main",
      workspacePath: fixturePath,
      ownerActorId: "user_cleanup"
    });
    service.requestCleanup(fixture.id);
    const dirty = service.evaluateCleanup(fixture.id, {
      changedFiles: ["src/app.ts"],
      mergeStatus: "ready_for_merge"
    });
    assert.equal(dirty.decision, "cleanup_blocked_dirty");

    const unmerged = service.evaluateCleanup(fixture.id, {
      dirty: false,
      changedFiles: [],
      mergeStatus: "unmerged"
    });
    assert.equal(unmerged.decision, "cleanup_blocked_unmerged");

    const future = service.requestWorkspace({
      taskId: "task_cleanup_future",
      taskRunId: "run_cleanup_future",
      agentRunId: "agentrun_cleanup_future",
      repoId: "repo_cleanup",
      branchName: "codex/cleanup-future",
      baseBranch: "main",
      workspaceKind: "git_worktree_future",
      workspacePath: futurePath,
      ownerActorId: "user_cleanup"
    });
    service.requestCleanup(future.id);
    const futureDecision = service.evaluateCleanup(future.id, { dirty: false, changedFiles: [], mergeStatus: "merged" });
    assert.equal(futureDecision.decision, "future_manual_review");
    service.recordCleanupCompleted(future.id);
    await assert.doesNotReject(() => stat(futurePath));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("AgentRunnerService adds workspaceLeaseId metadata and links branch leases", async () => {
  const service = new AgentRunnerService({ runner: new MockAgentRunner() });
  const run = await service.runAgent(requestFixture({
    metadata: {
      branchLeaseId: "branchlease_runner_workspace",
      serviceAccountId: "runner_service"
    }
  }));

  assert.equal(run.status, "completed");
  assert.equal(typeof run.workspaceLeaseId, "string");
  assert.equal(run.metadata.workspaceLeaseId, run.workspaceLeaseId);
  const lease = service.getWorkspaceLease(run.workspaceLeaseId ?? "");
  assert.equal(lease?.workspaceKind, "git_worktree_future");
  assert.equal(lease?.branchLeaseId, "branchlease_runner_workspace");
  assert.equal(lease?.agentRunId, run.id);
});

test("Agent workspace API endpoints mutate metadata only and return sanitized read models", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "aichestra-workspace-api-v2-"));
  const previousRoot = process.env.AICHESTRA_AGENT_WORKSPACE_ROOT;
  process.env.AICHESTRA_AGENT_WORKSPACE_ROOT = root;
  const fixturePath = path.join(root, "api-fixture");
  await mkdir(fixturePath, { recursive: true });
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health") as { agentRunner: { workspaceLifecycleStatus: string; destructiveWorkspaceCleanupEnabled: boolean; futureGitWorktreeExecutionEnabled: boolean } };
    assert.equal(health.agentRunner.workspaceLifecycleStatus, "v2_implemented");
    assert.equal(health.agentRunner.destructiveWorkspaceCleanupEnabled, false);
    assert.equal(health.agentRunner.futureGitWorktreeExecutionEnabled, false);

    const requested = await postJson(address.port, "/agents/workspaces/request", {
      taskId: "task_api_workspace",
      taskRunId: "run_api_workspace",
      agentRunId: "agentrun_api_workspace",
      repoId: "repo_api_workspace",
      branchLeaseId: "branchlease_api_workspace",
      branchName: "codex/api-workspace",
      baseBranch: "main",
      workspaceKind: "fixture",
      workspacePath: fixturePath,
      metadata: {
        apiKey: "sk-workspace-secret",
        safeLabel: "api_fixture"
      }
    });
    assert.equal(requested.statusCode, 201);
    const workspaceLease = requested.body.workspaceLease as { id: string; workspacePath: string; workspacePathRedacted: boolean; metadata: Record<string, unknown> };
    assert.equal(workspaceLease.workspacePath, "[workspace-path]/api-fixture");
    assert.equal(workspaceLease.workspacePathRedacted, true);
    assert.equal(workspaceLease.metadata.apiKey, "[redacted]");
    assert.equal(workspaceLease.metadata.safeLabel, "api_fixture");

    const activated = await postJson(address.port, `/agents/workspaces/${workspaceLease.id}/activate`);
    assert.equal(activated.statusCode, 200);
    assert.equal(((activated.body.workspaceLease as Record<string, unknown>).status), "active");

    const cleanup = await postJson(address.port, `/agents/workspaces/${workspaceLease.id}/cleanup/check`, {
      dirty: false,
      changedFiles: [],
      mergeStatus: "unmerged",
      metadata: { token: "ghp_workspace_secret" }
    });
    assert.equal(cleanup.statusCode, 200);
    const cleanupDecision = cleanup.body.cleanupDecision as { decision: string; metadata: Record<string, unknown> };
    assert.equal(cleanupDecision.decision, "cleanup_blocked_unmerged");
    assert.equal(cleanupDecision.metadata.token, "[redacted]");

    const events = await getJson(address.port, `/agents/workspaces/${workspaceLease.id}/events`) as { events: unknown[] };
    assert.equal(events.events.length >= 3, true);
    const listed = await getJson(address.port, "/agents/workspaces") as { workspaceLeases: unknown[]; cleanupDecisions: unknown[] };
    assert.equal(listed.workspaceLeases.length >= 1, true);
    assert.equal(listed.cleanupDecisions.length >= 1, true);

    const serialized = JSON.stringify({ requested, cleanup, events, listed });
    assert.equal(serialized.includes("sk-workspace-secret"), false);
    assert.equal(serialized.includes("ghp_workspace_secret"), false);
    assert.equal(serialized.includes(fixturePath), false);
    await assert.doesNotReject(() => stat(fixturePath));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousRoot === undefined) delete process.env.AICHESTRA_AGENT_WORKSPACE_ROOT; else process.env.AICHESTRA_AGENT_WORKSPACE_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});

test("dashboard renders Agent Workspace Lifecycle v2 status and cleanup safety", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.match(html, /Workspace lifecycle/);
  assert.match(html, /v2_implemented/);
  assert.match(html, /Workspace leases/);
  assert.match(html, /Cleanup decisions/);
  assert.match(html, /no destructive cleanup/);

  const service = new AgentWorkspaceLifecycleService();
  const dto = agentWorkspaceLeaseToDto(service.requestWorkspace({
    taskId: "task_dashboard_dto",
    agentRunId: "agentrun_dashboard_dto",
    repoId: "repo_dashboard_dto",
    branchName: "codex/dashboard-dto",
    baseBranch: "main",
    workspaceKind: "git_worktree_future",
    metadata: { secretToken: "token-dashboard-secret", safeLabel: "dashboard" }
  }));
  assert.equal(dto.metadata.secretToken, "[redacted]");
  assert.equal(dto.metadata.safeLabel, "dashboard");
});
