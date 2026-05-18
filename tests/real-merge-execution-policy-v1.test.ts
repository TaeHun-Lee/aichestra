import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import {
  RealMergeExecutionPolicyService,
  type EvaluateRealMergeExecutionRequestInput,
  type RealMergeExecutionPolicyEvaluationInput,
  type RealMergeWorkspaceSnapshot,
  type ConflictRisk,
  type MergeSimulationStatus
} from "@aichestra/core";
import { createApiServer } from "@aichestra/api";
import { InMemoryAichestraStore, createSeededStore } from "@aichestra/db";
import { renderDashboardHtml } from "../apps/web/src/render.ts";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";

type Fixture = {
  store: InMemoryAichestraStore;
  repoId: string;
  branchLeaseId: string;
  mergeQueueEntryId: string;
  dryRunMergeId?: string;
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

function fixture(input: {
  simulationStatus?: MergeSimulationStatus;
  leaseStatus?: "active" | "released" | "expired";
  queueStatus?: "queued" | "ready" | "blocked" | "merged" | "cancelled";
  competingLease?: boolean;
  recordDryRun?: boolean;
} = {}): Fixture {
  const store = new InMemoryAichestraStore();
  const repoId = "repo_real_merge_policy";
  const branchName = "ai/real-merge-policy";
  const task = store.createTask({
    title: "Real merge execution policy fixture",
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
    files: ["src/merge-policy.ts"],
    symbols: [],
    tests: ["pnpm test"],
    status: input.leaseStatus ?? "active"
  });

  if (input.competingLease === true) {
    const otherTask = store.createTask({
      title: "Competing merge policy fixture",
      repoId,
      baseBranch: "main",
      selectedSkillIds: []
    });
    const otherRun = store.createTaskRun({
      taskId: otherTask.id,
      attempt: 1,
      status: "running",
      agent: "codex",
      model: "mock-model"
    });
    store.createBranchLease({
      taskId: otherTask.id,
      taskRunId: otherRun.id,
      repoId,
      branchId: `branch_${otherRun.id}`,
      branchName: "ai/competing-real-merge-policy",
      baseBranch: "main",
      files: ["src/merge-policy.ts"],
      symbols: [],
      tests: [],
      status: "active"
    });
  }

  let dryRunMergeId: string | undefined;
  if (input.recordDryRun !== false) {
    const simulationStatus = input.simulationStatus ?? "clean";
    const simulation = store.recordMergeSimulation({
      id: `sim_${lease.id}`,
      repoId,
      baseRef: "main",
      sourceRef: branchName,
      targetRef: "main",
      taskRunId: run.id,
      branchLeaseId: lease.id,
      mode: "mock",
      status: simulationStatus,
      conflictingFiles: simulationStatus === "clean" ? [] : ["src/merge-policy.ts"],
      changedFiles: ["src/merge-policy.ts"],
      summary: `${simulationStatus} real merge policy fixture`,
      riskContribution: simulationStatus === "clean" ? 0.05 : 0.7,
      createdAt: new Date("2026-01-01T00:00:00.000Z")
    });
    dryRunMergeId = simulation.id;
  }

  const entry = store.createMergeQueueEntry({
    repoId,
    taskId: task.id,
    taskRunId: run.id,
    branchLeaseId: lease.id,
    pullRequestId: `pr_${run.id}`,
    pullRequestUrl: `mock://pull-requests/${run.id}`,
    branchName,
    priority: 10,
    riskScore: 0,
    status: input.queueStatus ?? "ready",
    recommendation: "safe_to_queue"
  });

  return {
    store,
    repoId,
    branchLeaseId: lease.id,
    mergeQueueEntryId: entry.id,
    dryRunMergeId,
    branchName
  };
}

function service(
  setup: Fixture,
  options: {
    ownerPresent?: boolean;
    workspace?: RealMergeWorkspaceSnapshot;
    highConflictRisk?: boolean;
    policyEvaluator?: (input: RealMergeExecutionPolicyEvaluationInput) => { allowed: boolean; decision?: string; reason?: string };
  } = {}
): RealMergeExecutionPolicyService {
  return new RealMergeExecutionPolicyService({
    dataSource: {
      getBranchLease: (id) => setup.store.getBranchLease(id),
      getMergeQueueEntry: (id) => setup.store.getMergeQueueEntry(id),
      getMergeSimulation: (id) => setup.store.listMergeSimulations().find((simulation) => simulation.id === id),
      latestMergeSimulationForLease: (id) => setup.store.latestMergeSimulationForLease(id),
      highestConflictRiskForLease: (id) => options.highConflictRisk === true ? highConflictRisk(setup, id) : setup.store.highestConflictRiskForLease(id),
      getWorkspaceLease: (id) => options.workspace?.id === id ? options.workspace : undefined,
      listEditOverlapsForRequest: () => [],
      getPrOwnershipReadiness: () => options.ownerPresent === false
        ? undefined
        : {
          status: "owner_present",
          ownershipRecordId: "pr_owner_fixture",
          ownerActorId: "user_reviewer",
          reviewerActorIds: ["user_reviewer"]
        },
      getMergeQueueReadiness: () => ({ decision: "ready", blockingReasons: [], warnings: [] })
    },
    policyEvaluator: options.policyEvaluator
  });
}

function highConflictRisk(setup: Fixture, leaseId: string): ConflictRisk {
  return {
    id: "risk_high_real_merge_policy",
    repoId: setup.repoId,
    sourceLeaseId: leaseId,
    targetLeaseId: "competing_branch_lease",
    sourceTaskRunId: "task_run_source",
    targetTaskRunId: "task_run_target",
    overlapFiles: ["src/merge-policy.ts"],
    riskScore: 0.95,
    riskLevel: "high",
    reasons: ["same_file_edit"],
    recommendation: "block",
    computedAt: new Date("2026-01-01T00:00:00.000Z")
  };
}

function validInput(setup: Fixture): EvaluateRealMergeExecutionRequestInput {
  return {
    repoId: setup.repoId,
    baseBranch: "main",
    sourceBranch: setup.branchName,
    mergeQueueEntryId: setup.mergeQueueEntryId,
    branchLeaseId: setup.branchLeaseId,
    dryRunMergeId: setup.dryRunMergeId,
    prOwnershipId: "pr_owner_fixture",
    validationStatus: "passed",
    approvalStatus: "approved",
    rollbackPlanStatus: "passed",
    tenantScopeStatus: "match",
    metadata: { source: "test" }
  };
}

function context() {
  return {
    requestId: "req_real_merge_policy",
    correlationId: "corr_real_merge_policy",
    actorId: "user_reviewer",
    principalId: "principal_reviewer",
    source: "test"
  };
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

test("Real Merge Execution Policy v1 exposes disabled policy and forbidden operations", () => {
  const mergePolicy = new RealMergeExecutionPolicyService();
  const policy = mergePolicy.getPolicy();
  const forbidden = mergePolicy.listForbiddenOperations();

  assert.equal(policy.mergeExecutionEnabled, false);
  assert.equal(policy.autoMergeEnabled, false);
  assert.equal(policy.remotePushEnabled, false);
  assert.equal(forbidden.some((operation) => operation.operation === "auto_merge"), true);
  assert.equal(forbidden.some((operation) => operation.operation === "force_push"), true);
  assert.equal(forbidden.some((operation) => operation.operation === "rebase"), true);
  assert.equal(forbidden.some((operation) => operation.operation === "branch_delete"), true);
});

test("Real Merge Execution Policy v1 denies default request and never performs merge side effects", () => {
  const decision = new RealMergeExecutionPolicyService().evaluateRequest({}, context());

  assert.equal(decision.decision, "denied_default");
  assert.equal(decision.mergeExecutionPerformed, false);
  assert.equal(decision.autoMergePerformed, false);
  assert.equal(decision.remotePushPerformed, false);
});

test("Real Merge Execution Policy v1 blocks missing and failed dry-run evidence", () => {
  const missing = fixture({ recordDryRun: false });
  const missingDecision = service(missing).evaluateRequest(validInput(missing), context());
  assert.equal(missingDecision.decision, "blocked_missing_dry_run");
  assert.equal(missingDecision.blockingReasons.some((reason) => reason.includes("dry_run_merge_missing")), true);

  const failed = fixture({ simulationStatus: "failed" });
  const failedDecision = service(failed).evaluateRequest(validInput(failed), context());
  assert.equal(failedDecision.decision, "blocked_missing_dry_run");
  assert.equal(failedDecision.blockingReasons.some((reason) => reason.includes("dry_run_failed")), true);
});

test("Real Merge Execution Policy v1 blocks high conflict risk and missing PR owner", () => {
  const risky = fixture();
  const conflictDecision = service(risky, { highConflictRisk: true }).evaluateRequest(validInput(risky), context());
  assert.equal(conflictDecision.decision, "blocked_conflict_risk");
  assert.equal(conflictDecision.blockingReasons.some((reason) => reason.includes("conflict_risk_high")), true);

  const noOwner = fixture();
  const noOwnerDecision = service(noOwner, { ownerPresent: false }).evaluateRequest({
    ...validInput(noOwner),
    prOwnershipId: undefined
  }, context());
  assert.equal(noOwnerDecision.decision, "blocked_no_owner");
});

test("Real Merge Execution Policy v1 blocks missing approval and invalid branch lease", () => {
  const missingApproval = fixture();
  const approvalDecision = service(missingApproval).evaluateRequest({
    ...validInput(missingApproval),
    approvalStatus: undefined
  }, context());
  assert.equal(approvalDecision.decision, "blocked_missing_approval");

  const expiredLease = fixture({ leaseStatus: "expired" });
  const leaseDecision = service(expiredLease).evaluateRequest(validInput(expiredLease), context());
  assert.equal(leaseDecision.decision, "blocked_branch_lease_invalid");
});

test("Real Merge Execution Policy v1 blocks workspace not ready, tenant mismatch, and policy deny", () => {
  const workspaceSetup = fixture();
  const workspaceDecision = service(workspaceSetup, {
    workspace: {
      id: "workspace_not_ready",
      repoId: workspaceSetup.repoId,
      branchLeaseId: workspaceSetup.branchLeaseId,
      branchName: workspaceSetup.branchName,
      status: "active"
    }
  }).evaluateRequest({
    ...validInput(workspaceSetup),
    workspaceLeaseId: "workspace_not_ready"
  }, context());
  assert.equal(workspaceDecision.decision, "blocked_workspace_not_ready");

  const tenantSetup = fixture();
  const tenantDecision = service(tenantSetup).evaluateRequest({
    ...validInput(tenantSetup),
    tenantScopeStatus: "mismatch"
  }, context());
  assert.equal(tenantDecision.decision, "blocked_scope_mismatch");

  const policySetup = fixture();
  const policyDecision = service(policySetup, {
    policyEvaluator: (input) => ({
      allowed: input.action !== "merge_execution.evaluate",
      decision: input.action === "merge_execution.evaluate" ? "deny" : "allow",
      reason: input.action === "merge_execution.evaluate" ? "mock_policy_denied" : "mock_policy_allowed"
    })
  }).evaluateRequest(validInput(policySetup), context());
  assert.equal(policyDecision.decision, "blocked_policy_denied");
});

test("Real Merge Execution Policy v1 returns ready_for_manual_future only when modeled metadata preconditions pass", () => {
  const setup = fixture();
  const mergePolicy = service(setup);
  const decision = mergePolicy.evaluateRequest(validInput(setup), context());
  const preconditions = mergePolicy.listPreconditions(decision.requestId);

  assert.equal(decision.decision, "ready_for_manual_future");
  assert.equal(decision.mergeExecutionPerformed, false);
  assert.equal(preconditions.filter((precondition) => precondition.required).every((precondition) => precondition.status === "pass" || precondition.status === "not_applicable"), true);
  assert.equal(mergePolicy.getSummary().readyForManualFuture, 1);
});

test("Real Merge Execution Policy v1 sanitizes metadata and does not mutate source fixture files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aichestra-real-merge-policy-"));
  const fixtureFile = path.join(tempDir, "source.ts");
  fs.writeFileSync(fixtureFile, "export const value = 1;\n");
  const before = fs.readFileSync(fixtureFile, "utf8");
  const setup = fixture();
  const mergePolicy = service(setup);
  const decision = mergePolicy.evaluateRequest({
    ...validInput(setup),
    metadata: {
      sourceFixturePath: fixtureFile,
      tokenPreview: "GITHUB_TOKEN=ghp_secret",
      apiKey: "OPENAI_API_KEY=sk-test"
    }
  }, context());
  const after = fs.readFileSync(fixtureFile, "utf8");

  assert.equal(before, after);
  assert.equal(decision.mergeExecutionPerformed, false);
  assert.equal(noUnsafeValue(decision), true);
  assert.equal(noUnsafeValue(mergePolicy.listPreconditions(decision.requestId)), true);
});

test("Real Merge Execution Policy v1 API endpoints are metadata-only and safe", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const policy = await getJson(port, "/git/merge-execution/policy");
    const forbidden = await getJson(port, "/git/merge-execution/forbidden-operations");
    const evaluated = await postJson(port, "/git/merge-execution/evaluate", {
      metadata: { tokenPreview: "GITHUB_TOKEN=ghp_secret" }
    });
    const summary = await getJson(port, "/git/merge-execution/summary");

    assert.equal(policy.statusCode, 200);
    assert.equal((policy.body.policy as { mergeExecutionEnabled: boolean }).mergeExecutionEnabled, false);
    assert.equal(forbidden.statusCode, 200);
    assert.equal(Array.isArray(forbidden.body.forbiddenOperations), true);
    assert.equal(evaluated.statusCode, 409);
    assert.equal((evaluated.body.decision as { mergeExecutionPerformed: boolean }).mergeExecutionPerformed, false);
    assert.equal(summary.statusCode, 200);
    assert.equal(noUnsafeValue(evaluated.body), true);
    assert.equal(noUnsafeValue(summary.body), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Real Merge Execution Policy v1 dashboard panel renders without secrets or env values", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("Real Merge Execution Policy"), true);
  assert.equal(html.includes("merge execution disabled"), true);
  assert.equal(html.includes("auto_merge"), true);
  assert.equal(html.includes("GITHUB_TOKEN="), false);
  assert.equal(html.includes("OPENAI_API_KEY="), false);
  assert.equal(html.includes("ANTHROPIC_API_KEY="), false);
  assert.equal(html.includes("VAULT_TOKEN="), false);
  assert.equal(html.includes("ghp_"), false);
  assert.equal(html.includes("sk-dashboard-secret"), false);
});
