import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { InMemoryAichestraStore } from "@aichestra/db";
import {
  AgentWorkspaceLifecycleService,
  AgentWorktreeAllocationService,
  LocalAgentWorkspaceManager
} from "@aichestra/runner";
import type { AgentWorktreeAllocationInput } from "@aichestra/runner";
import { renderDashboardHtml } from "../apps/web/src/render.ts";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";

type WorktreeFixture = {
  root: string;
  store: InMemoryAichestraStore;
  taskId: string;
  taskRunId: string;
  branchLeaseId: string;
  branchName: string;
  service: AgentWorktreeAllocationService;
};

async function createFixture(): Promise<WorktreeFixture> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "aichestra-worktree-v1-"));
  const store = new InMemoryAichestraStore();
  const task = store.createTask({
    title: "Agent worktree allocation fixture",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: []
  });
  const run = store.createTaskRun({
    taskId: task.id,
    attempt: 1,
    status: "running",
    agent: "codex",
    model: "mock-model"
  });
  const lease = store.createBranchLease({
    taskId: task.id,
    taskRunId: run.id,
    repoId: task.repoId,
    branchId: `branch_${run.id}`,
    branchName: `aichestra/${run.id}/agent-worktree`,
    baseBranch: "main",
    files: ["src/auth/session.ts"],
    symbols: [],
    tests: ["tests/auth/session.test.ts"],
    status: "active"
  });
  const lifecycle = new AgentWorkspaceLifecycleService({
    workspaceManager: new LocalAgentWorkspaceManager({ workspaceRoot: root })
  });
  const service = new AgentWorktreeAllocationService({
    allowedWorkspaceRoots: [root],
    workspaceLifecycleService: lifecycle,
    branchLeaseLookup: (branchLeaseId) => store.getBranchLease(branchLeaseId),
    workspaceLeaseLookup: (workspaceLeaseId) => lifecycle.getWorkspace(workspaceLeaseId)
  });
  return {
    root,
    store,
    taskId: task.id,
    taskRunId: run.id,
    branchLeaseId: lease.id,
    branchName: lease.branchName,
    service
  };
}

function safeInput(fixture: WorktreeFixture, overrides: Partial<AgentWorktreeAllocationInput> = {}): AgentWorktreeAllocationInput {
  return {
    repoId: "repo_demo_backend",
    baseBranch: "main",
    branchName: fixture.branchName,
    branchLeaseId: fixture.branchLeaseId,
    requestedPath: path.join(fixture.root, "agent-one"),
    workspaceRoot: fixture.root,
    agentRunId: "agent_run_one",
    taskId: fixture.taskId,
    userId: "user_mock",
    metadata: { source: "test", note: "OPENAI_API_KEY=redacted" },
    ...overrides
  };
}

async function cleanup(root: string): Promise<void> {
  await fs.rm(root, { recursive: true, force: true });
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

test("Agent Worktree Allocation v1 validates safe dry-run requests", async () => {
  const fixture = await createFixture();
  try {
    const result = fixture.service.dryRunAllocate(safeInput(fixture));
    const summary = fixture.service.getSummary();

    assert.equal(result.decision, "dry_run_valid");
    assert.equal(result.metadata.realGitWorktreeExecuted, false);
    assert.equal(result.metadata.destructiveCleanupExecuted, false);
    assert.equal(result.sanitizedPath?.startsWith("[workspace-path]/"), true);
    assert.equal(JSON.stringify(result).includes(fixture.root), false);
    assert.equal(JSON.stringify(fixture.service.listRequests()).includes("OPENAI_API_KEY"), false);
    assert.equal(summary.status, "v1_implemented");
    assert.equal(summary.realGitWorktreeExecuted, false);
  } finally {
    await cleanup(fixture.root);
  }
});

test("Agent Worktree Allocation v1 fixture allocation records metadata and workspace lease linkage", async () => {
  const fixture = await createFixture();
  try {
    const sentinel = path.join(fixture.root, "sentinel.txt");
    await fs.writeFile(sentinel, "unchanged");

    const result = await fixture.service.allocateFixtureWorktree(safeInput(fixture, {
      requestedPath: path.join(fixture.root, "fixture-agent"),
      agentRunId: "agent_run_fixture"
    }));

    assert.equal(result.decision, "allocated_fixture");
    assert.ok(result.workspaceLeaseId);
    assert.equal(result.metadata.fixtureOnly, true);
    assert.equal(await fs.readFile(sentinel, "utf8"), "unchanged");
    assert.equal(JSON.stringify(result).includes(fixture.root), false);
  } finally {
    await cleanup(fixture.root);
  }
});

test("Agent Worktree Allocation v1 blocks production git worktree mode", async () => {
  const fixture = await createFixture();
  try {
    const result = fixture.service.dryRunAllocate(safeInput(fixture, {
      allocationMode: "git_worktree_future"
    }));

    assert.equal(result.decision, "future_git_worktree_required");
    assert.equal(result.metadata.realGitWorktreeExecuted, false);
    const checks = fixture.service.evaluateSafety(safeInput(fixture, {
      allocationMode: "git_worktree_future",
      requestedPath: path.join(fixture.root, "future-agent")
    }));
    assert.equal(checks.find((check) => check.checkKind === "fixture_only")?.status, "warning");
  } finally {
    await cleanup(fixture.root);
  }
});

test("Agent Worktree Allocation v1 validateRequest reports future git worktree as blocked", async () => {
  const fixture = await createFixture();
  try {
    const validation = fixture.service.validateRequest(safeInput(fixture, {
      allocationMode: "git_worktree_future",
      requestedPath: path.join(fixture.root, "future-agent")
    }));

    assert.equal(validation.decision, "future_git_worktree_required");
    assert.equal(validation.checks.find((check) => check.checkKind === "fixture_only")?.status, "warning");
  } finally {
    await cleanup(fixture.root);
  }
});

test("Agent Worktree Allocation v1 blocks missing branch leases", async () => {
  const fixture = await createFixture();
  try {
    const result = fixture.service.dryRunAllocate(safeInput(fixture, {
      branchLeaseId: "branchlease_missing",
      requestedPath: path.join(fixture.root, "missing-lease-agent")
    }));

    assert.equal(result.decision, "blocked_branch_missing");
    assert.equal(fixture.service.listSafetyChecks({ requestId: result.requestId, checkKind: "branch_lease_present" }).at(-1)?.status, "fail");
  } finally {
    await cleanup(fixture.root);
  }
});

test("Agent Worktree Allocation v1 blocks unsafe branch names", async () => {
  const fixture = await createFixture();
  try {
    const result = fixture.service.dryRunAllocate(safeInput(fixture, {
      branchName: "../reset",
      requestedPath: path.join(fixture.root, "unsafe-branch-agent")
    }));

    assert.equal(result.decision, "blocked_policy");
    assert.equal(fixture.service.listSafetyChecks({ requestId: result.requestId, checkKind: "branch_name_safe" }).at(-1)?.status, "fail");
  } finally {
    await cleanup(fixture.root);
  }
});

test("Agent Worktree Allocation v1 blocks path traversal", async () => {
  const fixture = await createFixture();
  try {
    const result = fixture.service.dryRunAllocate(safeInput(fixture, {
      requestedPath: "../escape"
    }));

    assert.equal(result.decision, "blocked_root_not_allowed");
    assert.equal(fixture.service.listSafetyChecks({ requestId: result.requestId, checkKind: "path_within_root" }).at(-1)?.status, "fail");
  } finally {
    await cleanup(fixture.root);
  }
});

test("Agent Worktree Allocation v1 blocks paths outside the workspace root", async () => {
  const fixture = await createFixture();
  try {
    const result = fixture.service.dryRunAllocate(safeInput(fixture, {
      requestedPath: path.join(os.tmpdir(), "outside-worktree-agent")
    }));

    assert.equal(result.decision, "blocked_root_not_allowed");
  } finally {
    await cleanup(fixture.root);
  }
});

test("Agent Worktree Allocation v1 blocks shared worktree paths", async () => {
  const fixture = await createFixture();
  try {
    const first = fixture.service.dryRunAllocate(safeInput(fixture, {
      requestedPath: path.join(fixture.root, "shared-agent"),
      agentRunId: "agent_run_first"
    }));
    const second = fixture.service.dryRunAllocate(safeInput(fixture, {
      requestedPath: path.join(fixture.root, "shared-agent"),
      agentRunId: "agent_run_second"
    }));

    assert.equal(first.decision, "dry_run_valid");
    assert.equal(second.decision, "blocked_path_collision");
  } finally {
    await cleanup(fixture.root);
  }
});

test("Agent Worktree Allocation v1 API endpoints are metadata-only and redacted", async () => {
  const fixture = await createFixture();
  const previousRoot = process.env.AICHESTRA_AGENT_WORKSPACE_ROOT;
  const previousAllowlist = process.env.AICHESTRA_WORKSPACE_ROOT_ALLOWLIST;
  process.env.AICHESTRA_AGENT_WORKSPACE_ROOT = fixture.root;
  process.env.AICHESTRA_WORKSPACE_ROOT_ALLOWLIST = fixture.root;
  try {
    const server = createApiServer(fixture.store);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const port = (server.address() as AddressInfo).port;
      const response = await postJson(port, "/agents/worktrees/dry-run", safeInput(fixture, {
        metadata: { token: "GITHUB_TOKEN=secret" }
      }));
      const summary = await getJson(port, "/agents/worktrees/summary");
      const allocations = await getJson(port, "/agents/worktrees/allocations");
      const readiness = await getJson(port, "/readiness/agent-worktrees/summary");

      assert.equal(response.statusCode, 201);
      const allocation = response.body.allocation as Record<string, unknown>;
      const responseSummary = response.body.summary as Record<string, unknown>;
      assert.equal(allocation.decision, "dry_run_valid");
      assert.equal(responseSummary.secretsExposed, false);
      assert.equal(responseSummary.envValuesExposed, false);
      assert.equal(JSON.stringify(response.body).includes("GITHUB_TOKEN=secret"), false);
      assert.equal(JSON.stringify(response.body).includes("GITHUB_TOKEN"), false);
      assert.equal(JSON.stringify(response.body).includes(fixture.root), false);
      assert.equal(((summary.body.summary as Record<string, unknown>).realGitWorktreeExecuted), false);
      assert.equal(Array.isArray(allocations.body.allocations), true);
      assert.equal(readiness.statusCode, 200);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    if (previousRoot === undefined) {
      delete process.env.AICHESTRA_AGENT_WORKSPACE_ROOT;
    } else {
      process.env.AICHESTRA_AGENT_WORKSPACE_ROOT = previousRoot;
    }
    if (previousAllowlist === undefined) {
      delete process.env.AICHESTRA_WORKSPACE_ROOT_ALLOWLIST;
    } else {
      process.env.AICHESTRA_WORKSPACE_ROOT_ALLOWLIST = previousAllowlist;
    }
    await cleanup(fixture.root);
  }
});

test("Agent Worktree Allocation v1 dashboard panel renders without secrets or full paths", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.match(html, /Worktree allocation/);
  assert.match(html, /v1_implemented/);
  assert.match(html, /real git worktree/);
  assert.equal(html.includes("OPENAI_API_KEY"), false);
  assert.equal(html.includes("/tmp/aichestra-dashboard-worktrees"), false);
});
