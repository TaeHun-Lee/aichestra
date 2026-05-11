import test from "node:test";
import assert from "node:assert/strict";
import { createSeededStore } from "@aichestra/db";
import { runAgentTaskWorkflow } from "@aichestra/worker";

test("mock workflow completes the first MVP vertical slice", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Fix login timeout bug",
    description: "Investigate and fix intermittent login timeout failures.",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedAgent: "codex",
    selectedModel: "mock-model",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20",
    budgetLimitUsd: 20
  });

  const result = await runAgentTaskWorkflow(task.id, { store });
  const updatedTask = store.getTask(task.id);
  const taskRun = store.listTaskRuns(task.id).at(-1);
  const pullRequest = store.listPullRequests(task.id).at(-1);
  const lease = store.listBranchLeases(task.repoId, "active").at(-1);
  const queueEntry = store.listMergeQueueEntries(task.repoId).at(-1);
  const mergeSimulation = taskRun ? store.listMergeSimulations({ taskRunId: taskRun.id }).at(0) : undefined;

  assert.equal(result.status, "completed");
  assert.equal(updatedTask?.status, "completed");
  assert.equal(taskRun?.status, "succeeded");
  assert.deepEqual(taskRun?.selectedSkillRefs?.map((ref) => `${ref.name}@${ref.version}`), ["auth-debugging@1.0.0"]);
  assert.equal(taskRun?.selectedHarnessRef?.name, "backend-node20");
  assert.deepEqual(taskRun?.selectedInstructionRefs?.map((ref) => `${ref.name}@${ref.version}`), [
    "org-secure-coding-baseline@1.0.0",
    "repo-agents-md@1.0.0"
  ]);
  assert.equal(lease?.taskRunId, taskRun?.id);
  assert.equal(lease?.status, "active");
  assert.equal(queueEntry?.taskRunId, taskRun?.id);
  assert.equal(queueEntry?.status, "ready");
  assert.equal(queueEntry?.simulationStatus, "clean");
  assert.equal(queueEntry?.recommendation, "safe_to_queue");
  assert.equal(mergeSimulation?.status, "clean");
  assert.deepEqual(taskRun?.changedFiles, ["src/auth/session.ts", "tests/auth/session.test.ts"]);
  assert.equal(taskRun?.diffSummary, "2 files changed, 18 insertions, 4 deletions");
  assert.equal(pullRequest?.url?.startsWith("mock://pull-requests/"), true);
  assert.equal(pullRequest?.provider, "mock");
  assert.equal(store.listUsageEvents().filter((event) => event.taskId === task.id).length, 1);
});

test("mock workflow blocks merge queue entry for high-risk active overlap", async () => {
  const store = createSeededStore();
  const firstTask = store.createTask({
    title: "Fix auth session timeout",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20"
  });
  const secondTask = store.createTask({
    title: "Update auth session refresh",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20"
  });

  const first = await runAgentTaskWorkflow(firstTask.id, { store });
  const second = await runAgentTaskWorkflow(secondTask.id, { store });
  const queueEntries = store.listMergeQueueEntries("repo_demo_backend");
  const secondQueueEntry = queueEntries.find((entry) => entry.taskRunId === second.taskRunId);
  const risks = store.computeRepoConflictRisks("repo_demo_backend");

  assert.equal(first.status, "completed");
  assert.equal(second.status, "review_required");
  assert.equal(secondQueueEntry?.status, "blocked");
  assert.equal(secondQueueEntry?.riskScore, 0.9);
  assert.equal(risks[0]?.riskLevel, "critical");
  assert.equal(secondQueueEntry?.simulationStatus, "clean");
  assert.equal(secondQueueEntry?.recommendation, "manual_review_required");
});

test("mock workflow records dry-run conflict simulation on queue entries", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Conflict auth session branch",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20"
  });

  const result = await runAgentTaskWorkflow(task.id, { store });
  const queueEntry = store.listMergeQueueEntries(task.repoId).at(-1);
  const mergeSimulation = store.listMergeSimulations({ taskRunId: result.taskRunId }).at(0);

  assert.equal(result.status, "conflict_detected");
  assert.equal(mergeSimulation?.status, "text_conflict");
  assert.deepEqual(mergeSimulation?.conflictingFiles, ["src/auth/session.ts"]);
  assert.equal(queueEntry?.status, "blocked");
  assert.equal(queueEntry?.simulationStatus, "text_conflict");
  assert.equal(queueEntry?.recommendation, "conflict_detected");
  assert.equal(queueEntry?.blockingReasons.includes("conflict_detected"), true);
});

test("marking merge queue entry as merged releases the branch lease", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Update example module",
    repoId: "repo_demo_backend",
    baseBranch: "main"
  });

  await runAgentTaskWorkflow(task.id, { store });
  const queueEntry = store.listMergeQueueEntries(task.repoId).at(-1);
  assert.ok(queueEntry);

  const merged = store.markMergeQueueEntryMerged(queueEntry.id);
  const lease = store.getBranchLease(queueEntry.branchLeaseId);

  assert.equal(merged.status, "merged");
  assert.equal(lease?.status, "released");
  assert.ok(lease?.releasedAt);
});

test("mock workflow allows a new TaskRun after completed", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Fix login timeout bug",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20"
  });

  const first = await runAgentTaskWorkflow(task.id, { store });
  const second = await runAgentTaskWorkflow(task.id, { store });
  const taskRuns = store.listTaskRuns(task.id);

  assert.equal(first.status, "completed");
  assert.equal(second.status, "completed");
  assert.equal(taskRuns.length, 2);
  assert.equal(taskRuns[0]?.attempt, 1);
  assert.equal(taskRuns[1]?.attempt, 2);
});

test("mock workflow allows a new TaskRun after failed", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "force-fail login timeout task",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20"
  });

  const first = await runAgentTaskWorkflow(task.id, { store });
  const second = await runAgentTaskWorkflow(task.id, { store });
  const taskRuns = store.listTaskRuns(task.id);

  assert.equal(first.status, "failed");
  assert.equal(second.status, "failed");
  assert.equal(taskRuns.length, 2);
  assert.equal(taskRuns[0]?.attempt, 1);
  assert.equal(taskRuns[1]?.attempt, 2);
});

test("mock workflow rejects a new run while an active TaskRun exists", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Fix login timeout bug",
    repoId: "repo_demo_backend",
    baseBranch: "main"
  });
  const activeRun = store.createTaskRun({
    taskId: task.id,
    attempt: 1,
    status: "running",
    agent: "codex",
    model: "mock-model"
  });

  await assert.rejects(
    () => runAgentTaskWorkflow(task.id, { store }),
    new RegExp(`already has active run ${activeRun.id}`)
  );
});

test("mock workflow blocks policy-denied tasks before provider behavior", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Over-budget refactor",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedAgent: "codex",
    selectedModel: "mock-model",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20",
    budgetLimitUsd: 2000
  });

  const result = await runAgentTaskWorkflow(task.id, { store });

  assert.equal(result.status, "policy_blocked");
  assert.equal(store.listUsageEvents().filter((event) => event.taskId === task.id).length, 0);
  assert.equal(store.listPullRequests(task.id).length, 0);
});

test("usage ledger attributes model, skill, harness, task, and run", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Update example module",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20"
  });

  const result = await runAgentTaskWorkflow(task.id, { store });
  const usage = store.listUsageEvents().find((event) => event.id === result.usageEventIds[0]);

  assert.equal(usage?.taskId, task.id);
  assert.equal(usage?.taskRunId, result.taskRunId);
  assert.equal(usage?.repoId, task.repoId);
  assert.equal(usage?.provider, "mock");
  assert.equal(usage?.model, "mock-model");
  assert.equal(usage?.skillVersion, "auth-debugging@1.0.0");
  assert.equal(usage?.harnessVersion, "backend-node20@1.0.0");
  assert.equal(usage?.metadata?.skill_id, "skill_auth_debugging");
  assert.equal(usage?.metadata?.harness_id, "harness_backend_node20");
  assert.deepEqual(usage?.metadata?.selected_skill_refs, ["auth-debugging@1.0.0"]);
  assert.equal(usage?.metadata?.selected_harness_ref, "backend-node20@1.0.0");
});

test("Skill, Harness, and Instruction records stay separate", () => {
  const store = createSeededStore();
  const skill = store.listSkills()[0];
  const harness = store.listHarnesses()[0];
  const instruction = store.listInstructions()[0];

  assert.equal(skill.requiredHarnesses.includes("backend-node20"), true);
  assert.equal("networkMode" in skill, false);
  assert.equal(harness.networkPolicy.mode, "allowlist");
  assert.equal(harness.testCommands.includes("pnpm test"), true);
  assert.equal("checksum" in harness, false);
  assert.equal(instruction.type, "org_policy");
  assert.equal(instruction.scope, "org");
  assert.equal(instruction.checksum.startsWith("sha256:"), true);
});
