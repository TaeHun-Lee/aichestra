import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import {
  ConflictResolutionAssistantService,
  type ConflictAssistantEditOverlapSnapshot,
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
  simulationId: string;
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

function getJson(port: number, requestPath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      });
    });
    request.on("error", reject);
  });
}

function fixture(input: {
  files?: string[];
  competingFiles?: string[];
  simulationStatus?: MergeSimulationStatus;
} = {}): Fixture {
  const store = new InMemoryAichestraStore();
  const repoId = "repo_demo_backend";
  const files = input.files ?? ["src/auth/session.ts"];
  const competingFiles = input.competingFiles ?? files;
  const task = store.createTask({
    title: "Conflict assistant fixture",
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
    files,
    symbols: [],
    tests: ["tests/auth/session.test.ts"],
    status: "active"
  });
  const competingTask = store.createTask({
    title: "Competing work",
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
    files: competingFiles,
    symbols: [],
    tests: [],
    status: "active"
  });
  const simulationStatus = input.simulationStatus ?? "text_conflict";
  const simulation = store.recordMergeSimulation({
    id: `sim_${lease.id}`,
    repoId,
    baseRef: "main",
    sourceRef: lease.branchName,
    targetRef: "main",
    taskRunId: run.id,
    branchLeaseId: lease.id,
    mode: "mock",
    status: simulationStatus,
    conflictingFiles: simulationStatus === "text_conflict" ? files : [],
    changedFiles: files,
    summary: `${simulationStatus} fixture`,
    riskContribution: simulationStatus === "text_conflict" ? 0.8 : simulationStatus === "failed" ? 0.35 : 0.1,
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
    priority: 10,
    riskScore: 0
  });
  return { store, entryId: entry.id, leaseId: lease.id, simulationId: simulation.id };
}

function service(store: InMemoryAichestraStore, overlaps: ConflictAssistantEditOverlapSnapshot[] = []): ConflictResolutionAssistantService {
  return new ConflictResolutionAssistantService({
    dataSource: {
      getMergeSimulation: (id) => store.listMergeSimulations().find((simulation) => simulation.id === id),
      latestMergeSimulationForLease: (leaseId) => store.latestMergeSimulationForLease(leaseId),
      getMergeQueueEntry: (id) => store.getMergeQueueEntry(id),
      getConflictRisk: (id) => store.computeRepoConflictRisks("repo_demo_backend").find((risk) => risk.id === id),
      highestConflictRiskForLease: (leaseId) => store.highestConflictRiskForLease(leaseId),
      getBranchLease: (id) => store.getBranchLease(id),
      getEditOverlap: (id) => overlaps.find((overlap) => overlap.id === id),
      listEditOverlapsForRequest: () => overlaps
    }
  });
}

test("Conflict Resolution Assistant v1 creates metadata-only conflict requests", () => {
  const setup = fixture();
  const assistant = service(setup.store);
  const request = assistant.createRequest({
    repoId: "repo_demo_backend",
    baseBranch: "main",
    sourceBranch: "ai/conflict",
    targetBranch: "main",
    mergeQueueEntryId: setup.entryId,
    branchLeaseIds: [setup.leaseId],
    metadata: { apiKey: "OPENAI_API_KEY=sk-test" }
  }, { actorId: "tester", requestId: "req_test" });

  assert.equal(request.repoId, "repo_demo_backend");
  assert.equal(request.files.includes("src/auth/session.ts"), true);
  assert.equal(request.metadata.noSourceMutation, true);
  assert.equal(request.metadata.noRealMerge, true);
  assert.equal(JSON.stringify(request).includes("sk-test"), false);
});

test("Conflict Resolution Assistant v1 summarizes same-file dry-run conflicts", () => {
  const setup = fixture({ simulationStatus: "text_conflict" });
  const assistant = service(setup.store);
  const request = assistant.createRequest({
    repoId: "repo_demo_backend",
    baseBranch: "main",
    sourceBranch: "ai/conflict",
    mergeSimulationId: setup.simulationId,
    branchLeaseIds: [setup.leaseId]
  });
  const summary = assistant.summarizeConflict(request.id);

  assert.equal(summary.conflictKind, "same_file_edit");
  assert.equal(summary.severity, "critical");
  assert.equal(summary.conflictFiles.includes("src/auth/session.ts"), true);
});

test("Conflict Resolution Assistant v1 summarizes same-directory refactors", () => {
  const setup = fixture({
    files: ["src/auth/session.ts"],
    competingFiles: ["src/auth/token.ts"],
    simulationStatus: "clean"
  });
  const overlaps: ConflictAssistantEditOverlapSnapshot[] = [{
    id: "overlap_same_directory",
    repoId: "repo_demo_backend",
    sessionIds: ["session_a", "session_b"],
    overlapKind: "same_directory",
    files: [],
    directories: ["src/auth"],
    severity: "high",
    recommendation: "require_review",
    reason: "broad_refactor_targets_same_directory"
  }];
  const assistant = service(setup.store, overlaps);
  const request = assistant.createRequest({
    repoId: "repo_demo_backend",
    baseBranch: "main",
    sourceBranch: "ai/refactor",
    branchLeaseIds: [setup.leaseId],
    editOverlapIds: ["overlap_same_directory"]
  });
  const summary = assistant.summarizeConflict(request.id);

  assert.equal(summary.conflictKind, "same_directory_refactor");
  assert.equal(summary.severity, "high");
  assert.equal(summary.affectedAreas.includes("directory-refactor"), true);
});

test("Conflict Resolution Assistant v1 generates manual review plans with validation and no apply", () => {
  const setup = fixture({ files: ["pnpm-lock.yaml"], competingFiles: ["pnpm-lock.yaml"], simulationStatus: "clean" });
  const assistant = service(setup.store);
  const request = assistant.createRequest({
    repoId: "repo_demo_backend",
    baseBranch: "main",
    sourceBranch: "ai/dependency-update",
    branchLeaseIds: [setup.leaseId],
    files: ["pnpm-lock.yaml"]
  });
  assistant.summarizeConflict(request.id);
  const plan = assistant.generateResolutionPlan(request.id);

  assert.equal(plan.strategy, "manual_review");
  assert.equal(plan.applyAllowed, false);
  assert.equal(plan.suggestedValidation.includes("pnpm test"), true);
  assert.equal(plan.suggestedValidation.includes("pnpm build"), true);
});

test("Conflict Resolution Assistant v1 links merge queue holds without release or apply", () => {
  const setup = fixture();
  const assistant = service(setup.store);
  const request = assistant.createRequest({
    repoId: "repo_demo_backend",
    baseBranch: "main",
    sourceBranch: "ai/conflict",
    mergeQueueEntryId: setup.entryId,
    branchLeaseIds: [setup.leaseId]
  });
  const plan = assistant.generateResolutionPlan(request.id);
  const linked = assistant.linkMergeQueueHold(plan.id, "mergehold_review_required", { actorId: "reviewer" });

  assert.deepEqual(linked.metadata.linkedMergeQueueHoldIds, ["mergehold_review_required"]);
  assert.equal(linked.metadata.releaseHoldAutomatically, false);
  assert.equal(linked.applyAllowed, false);
  assert.equal(assistant.listRecommendations(plan.id).some((item) => item.recommendationKind === "update_merge_queue_hold"), true);
});

test("Conflict Resolution Assistant v1 records no real LLM calls and no source mutation", () => {
  const setup = fixture();
  const assistant = service(setup.store);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aichestra-conflict-assistant-"));
  const fixtureFile = path.join(tempDir, "source.ts");
  fs.writeFileSync(fixtureFile, "export const value = 1;\n", "utf8");
  const before = fs.readFileSync(fixtureFile, "utf8");
  const request = assistant.createRequest({
    repoId: "repo_demo_backend",
    baseBranch: "main",
    sourceBranch: "ai/conflict",
    files: [fixtureFile],
    branchLeaseIds: [setup.leaseId]
  });
  const summary = assistant.summarizeConflict(request.id);
  const plan = assistant.generateResolutionPlan(request.id);
  const after = fs.readFileSync(fixtureFile, "utf8");

  assert.equal(before, after);
  assert.equal(summary.metadata.realLlmUsed, false);
  assert.equal(plan.metadata.realLlmUsed, false);
  assert.equal(assistant.getSummary().sourceMutation, false);
});

test("Conflict Resolution Assistant v1 API endpoints are metadata-only and safe", async () => {
  const setup = fixture();
  const server = createApiServer(setup.store);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const created = await postJson(address.port, "/git/conflicts/assistant/requests", {
      repoId: "repo_demo_backend",
      baseBranch: "main",
      sourceBranch: "ai/api-conflict",
      mergeQueueEntryId: setup.entryId,
      branchLeaseIds: [setup.leaseId],
      metadata: { token: "OPENAI_API_KEY=sk-test" }
    });
    const request = created.body.request as Record<string, unknown>;
    const requestId = String(request.id);
    const summarized = await postJson(address.port, `/git/conflicts/assistant/requests/${requestId}/summarize`);
    const planned = await postJson(address.port, `/git/conflicts/assistant/requests/${requestId}/plan`);
    const summary = await getJson(address.port, "/git/conflicts/assistant/summary?repoId=repo_demo_backend");
    const serialized = JSON.stringify({ created, summarized, planned, summary });

    assert.equal(created.statusCode, 201);
    assert.equal((planned.body.plan as Record<string, unknown>).applyAllowed, false);
    assert.equal((summary.summary as Record<string, unknown>).mergeExecution, false);
    assert.equal(serialized.includes("sk-test"), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Conflict Resolution Assistant v1 dashboard panel renders without secrets", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("Conflict Resolution Assistant"), true);
  assert.equal(html.includes("apply allowed false"), true);
  assert.equal(html.includes("real LLM used false"), true);
  assert.equal(html.includes("sk-dashboard-secret"), false);
  assert.equal(html.includes("auth.json"), false);
});
