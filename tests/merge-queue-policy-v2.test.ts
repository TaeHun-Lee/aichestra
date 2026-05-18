import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  MergeQueuePolicyService,
  type MergeQueueEditOverlapSnapshot,
  type MergeQueuePolicyEvaluationInput,
  type MergeQueueWorkspaceSnapshot,
  type MergeSimulationStatus
} from "@aichestra/core";
import { createApiServer } from "@aichestra/api";
import { InMemoryAichestraStore } from "@aichestra/db";
import { renderDashboardHtml } from "../apps/web/src/render.ts";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";

type Fixture = {
  store: InMemoryAichestraStore;
  entryId: string;
  leaseId: string;
};

function postJsonWithStatus(port: number, path: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
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
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(serialized);
  });
}

function getJson(port: number, path: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
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

function fixture(input: {
  files?: string[];
  competingFiles?: string[];
  simulationStatus?: MergeSimulationStatus;
  leaseStatus?: "active" | "released" | "expired";
  priority?: number;
} = {}): Fixture {
  const store = new InMemoryAichestraStore();
  const repoId = "repo_demo_backend";
  const task = store.createTask({
    title: "Merge queue policy fixture",
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
    branchName: `ai/${run.id}`,
    baseBranch: "main",
    files: input.files ?? ["src/auth/session.ts"],
    symbols: [],
    tests: [],
    status: input.leaseStatus ?? "active"
  });
  if (input.competingFiles) {
    const competingTask = store.createTask({
      title: "Competing branch",
      repoId,
      baseBranch: "main",
      selectedSkillIds: []
    });
    const competingRun = store.createTaskRun({
      taskId: competingTask.id,
      attempt: 1,
      status: "running",
      agent: "codex",
      model: "mock-model"
    });
    store.createBranchLease({
      taskId: competingTask.id,
      taskRunId: competingRun.id,
      repoId,
      branchId: `branch_${competingRun.id}`,
      branchName: `ai/${competingRun.id}`,
      baseBranch: "main",
      files: input.competingFiles,
      symbols: [],
      tests: [],
      status: "active"
    });
  }
  const simulationStatus = input.simulationStatus ?? "clean";
  store.recordMergeSimulation({
    id: `sim_${lease.id}`,
    repoId,
    baseRef: "main",
    sourceRef: lease.branchName,
    targetRef: "main",
    taskRunId: run.id,
    branchLeaseId: lease.id,
    mode: "mock",
    status: simulationStatus,
    conflictingFiles: simulationStatus === "text_conflict" ? ["src/auth/session.ts"] : [],
    changedFiles: input.files ?? ["src/auth/session.ts"],
    summary: `${simulationStatus} fixture`,
    riskContribution: simulationStatus === "clean" ? 0.1 : simulationStatus === "text_conflict" ? 0.8 : 0.35,
    createdAt: new Date("2026-01-01T00:00:00.000Z")
  });
  const entry = store.createMergeQueueEntry({
    repoId,
    taskId: task.id,
    taskRunId: run.id,
    branchLeaseId: lease.id,
    pullRequestId: `pr_${run.id}`,
    pullRequestUrl: `mock://pull-requests/${run.id}`,
    branchName: lease.branchName,
    priority: input.priority ?? 10,
    riskScore: 0
  });
  return { store, entryId: entry.id, leaseId: lease.id };
}

function service(
  store: InMemoryAichestraStore,
  options: {
    workspaces?: MergeQueueWorkspaceSnapshot[];
    overlaps?: MergeQueueEditOverlapSnapshot[];
    policyEvaluator?: (input: MergeQueuePolicyEvaluationInput) => { allowed: boolean; reason?: string; policyDecisionId?: string };
  } = {}
): MergeQueuePolicyService {
  return new MergeQueuePolicyService({
    dataSource: store,
    workspaceSnapshotProvider: () => options.workspaces ?? [{
      id: "workspace_ready",
      repoId: "repo_demo_backend",
      status: "ready_for_merge",
      isolationStatus: "isolated",
      workspaceKind: "fixture"
    }],
    editOverlapProvider: () => options.overlaps ?? [],
    policyEvaluator: options.policyEvaluator
  });
}

test("Merge Queue Policy v2 evaluates a safe entry as ready", () => {
  const setup = fixture();
  const decision = service(setup.store).evaluateEntry(setup.entryId, {
    validationStatus: "passed",
    approvalStatus: "approved"
  });

  assert.equal(decision.decision, "ready");
  assert.equal(decision.blockingReasons.length, 0);
  assert.equal(decision.metadata.mergeExecutionEnabled, false);
});

test("Merge Queue Policy v2 holds high conflict risk entries", () => {
  const setup = fixture({ competingFiles: ["package.json"], files: ["package.json"] });
  const mergeQueuePolicy = service(setup.store);
  const decision = mergeQueuePolicy.evaluateEntry(setup.entryId, {
    validationStatus: "passed",
    approvalStatus: "approved"
  });

  assert.equal(decision.decision, "hold");
  assert.equal(mergeQueuePolicy.listHolds({ queueEntryId: setup.entryId, activeOnly: true }).some((hold) => hold.holdKind === "conflict_risk"), true);
});

test("Merge Queue Policy v2 blocks or reviews failed dry-runs", () => {
  const setup = fixture({ simulationStatus: "failed" });
  const decision = service(setup.store).evaluateEntry(setup.entryId, {
    validationStatus: "passed",
    approvalStatus: "approved"
  });

  assert.equal(decision.decision, "needs_human_review");
  assert.equal(decision.blockingReasons.includes("dry_run_failed"), true);
});

test("Merge Queue Policy v2 holds missing validation and approval", () => {
  const setup = fixture();
  const decision = service(setup.store).evaluateEntry(setup.entryId);

  assert.equal(decision.decision, "hold");
  assert.equal(decision.requiredActions.includes("record_validation_result"), true);
  assert.equal(decision.requiredActions.includes("record_required_approval"), true);
});

test("Merge Queue Policy v2 blocks expired branch leases", () => {
  const setup = fixture({ leaseStatus: "expired" });
  const decision = service(setup.store).evaluateEntry(setup.entryId, {
    validationStatus: "passed",
    approvalStatus: "approved"
  });

  assert.equal(decision.decision, "blocked");
  assert.equal(decision.blockingReasons.includes("branch_lease_expired"), true);
});

test("Merge Queue Policy v2 holds workspaces that are not ready", () => {
  const setup = fixture();
  const decision = service(setup.store, {
    workspaces: [{ id: "workspace_active", repoId: "repo_demo_backend", status: "active", isolationStatus: "isolated", workspaceKind: "fixture" }]
  }).evaluateEntry(setup.entryId, {
    validationStatus: "passed",
    approvalStatus: "approved"
  });

  assert.equal(decision.decision, "hold");
  assert.equal(decision.requiredActions.includes("mark_workspace_ready_for_merge"), true);
});

test("Merge Queue Policy v2 holds same-file edit overlaps", () => {
  const setup = fixture();
  const decision = service(setup.store, {
    overlaps: [{
      id: "overlap_same_file",
      repoId: "repo_demo_backend",
      sessionAId: "session_a",
      sessionBId: "session_b",
      overlapKind: "same_file",
      files: ["src/auth/session.ts"],
      severity: "high",
      recommendation: "serialize"
    }]
  }).evaluateEntry(setup.entryId, {
    validationStatus: "passed",
    approvalStatus: "approved"
  });

  assert.equal(decision.decision, "hold");
  assert.equal(decision.requiredActions.includes("resolve_same_file_edit_overlap"), true);
});

test("Merge Queue Policy v2 lets policy deny win", () => {
  const setup = fixture();
  const decision = service(setup.store, {
    policyEvaluator: (input) => ({
      allowed: input.action !== "merge_queue.evaluate" && input.action !== "merge_queue.merge_execute_future",
      reason: "test_policy_deny",
      policyDecisionId: `policy_${input.action}`
    })
  }).evaluateEntry(setup.entryId, {
    validationStatus: "passed",
    approvalStatus: "approved"
  });

  assert.equal(decision.decision, "blocked");
  assert.equal(decision.blockingReasons.includes("policy_denied"), true);
});

test("Merge Queue Policy v2 ranks ready lower-conflict entries first", () => {
  const first = fixture({ priority: 20 });
  const second = fixture({ priority: 1, competingFiles: ["package.json"], files: ["package.json"] });
  const shared = new InMemoryAichestraStore({
    tasks: [...first.store.listTasks(), ...second.store.listTasks()],
    taskRuns: [...first.store.listTaskRuns(), ...second.store.listTaskRuns()],
    branchLeases: [...first.store.listBranchLeases(), ...second.store.listBranchLeases()],
    mergeQueueEntries: [...first.store.listMergeQueueEntries(), ...second.store.listMergeQueueEntries()],
    mergeSimulations: [...first.store.listMergeSimulations(), ...second.store.listMergeSimulations()]
  });
  const ranked = service(shared).rankQueue("repo_demo_backend", {
    validationStatus: "passed",
    approvalStatus: "approved"
  });

  assert.equal(ranked[0]?.decision, "ready");
  assert.equal(ranked[0]?.queueEntryId, first.entryId);
});

test("Merge Queue Policy v2 keeps merge execution denied", () => {
  const setup = fixture();
  const decision = service(setup.store).evaluateEntry(setup.entryId, {
    validationStatus: "passed",
    approvalStatus: "approved"
  });

  assert.equal(decision.metadata.mergeExecutionPolicyAllowed, false);
  assert.equal(decision.requiredActions.includes("manual_merge_future_gate_required"), true);
});

test("Merge Queue Policy v2 API endpoints are metadata-only", async () => {
  const setup = fixture();
  const store = setup.store;
  const server = createApiServer(store);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const policy = await getJson(address.port, "/git/merge-queue/policy");
    const summary = await getJson(address.port, "/git/merge-queue/summary?repoId=repo_demo_backend") as { summary: Record<string, unknown> };
    const entry = store.getMergeQueueEntry(setup.entryId);
    assert.ok(entry);
    const evaluated = await postJsonWithStatus(address.port, `/git/merge-queue/${entry.id}/evaluate`, {
      validationStatus: "passed",
      approvalStatus: "approved"
    });

    assert.equal((policy.policy as Record<string, unknown>).status, "active_mock");
    assert.equal(summary.summary.mergeExecutionEnabled, false);
    assert.equal(evaluated.statusCode === 200 || evaluated.statusCode === 409, true);
    assert.equal(((evaluated.body.decision as Record<string, unknown>).metadata as Record<string, unknown>).remoteGitOperation, false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Merge Queue Policy v2 dashboard renders decisions safely", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("Merge Queue Policy"), true);
  assert.equal(html.includes("merge execution disabled"), true);
  assert.equal(html.includes("resolve_same_file_edit_overlap"), true);
  assert.equal(html.includes("sk-dashboard-secret"), false);
  assert.equal(html.includes("auth.json"), false);
});
