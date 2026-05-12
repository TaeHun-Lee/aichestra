import type { GitProvider } from "@aichestra/adapters";
import { MockGitProvider, MockMergeSimulator } from "@aichestra/git-adapter";
import { CatalogModelRouter, createDefaultLlmGatewayService } from "@aichestra/llm-gateway";
import { MockPolicyEngine } from "@aichestra/policy";
import { ConflictError, assembleInstructionSet, createId, slugify } from "@aichestra/core";
import type { AgentKind, InstructionArtifact, MergeSimulationMode, MergeSimulator, SkillPackage, Task, TaskStatus } from "@aichestra/core";
import type { LlmGateway } from "@aichestra/llm-gateway";
import type { ModelRouter } from "@aichestra/llm-gateway";
import type { LegacyTaskPolicyEngine } from "@aichestra/policy";
import { createRegistryService, registryRefLabel } from "@aichestra/registry";
import type { RegistryService } from "@aichestra/registry";
import { InMemoryAichestraStore, MockUsageLedger } from "@aichestra/db";
import type { UsageLedger } from "@aichestra/db";
import { MockAgentRunner, MockTestRunner } from "@aichestra/runner";
import type { AgentRunner, TestRunner } from "@aichestra/runner";
import { inferLeaseTargets } from "../activities/lease-targets.ts";

export type RunAgentTaskWorkflowDeps = {
  store: InMemoryAichestraStore;
  gitProvider?: GitProvider;
  llmGateway?: LlmGateway;
  modelRouter?: ModelRouter;
  policyEngine?: LegacyTaskPolicyEngine;
  agentRunner?: AgentRunner;
  testRunner?: TestRunner;
  usageLedger?: UsageLedger;
  mergeSimulator?: MergeSimulator;
  mergeSimulationMode?: MergeSimulationMode;
  repoPath?: string;
  registryService?: RegistryService;
};

export type RunAgentTaskWorkflowResult = {
  taskId: string;
  status: TaskStatus;
  branchName?: string;
  pullRequestUrl?: string;
  taskRunId?: string;
  changedFiles?: string[];
  diffSummary?: string;
  usageEventIds: string[];
};

function transitionIfNeeded(store: InMemoryAichestraStore, task: Task, status: TaskStatus): Task {
  if (task.status === status) return task;
  return store.transitionTask(task.id, status);
}

function findActiveTaskRun(store: InMemoryAichestraStore, taskId: string) {
  return store.listTaskRuns(taskId).find((run) => run.status === "queued" || run.status === "running");
}

function transitionToPolicyBlocked(store: InMemoryAichestraStore, task: Task): Task {
  if (task.status === "policy_blocked") return task;
  if (task.status === "completed" || task.status === "failed") {
    return transitionIfNeeded(store, transitionIfNeeded(store, task, "queued"), "policy_blocked");
  }
  if (task.status === "queued") {
    return transitionIfNeeded(store, task, "policy_blocked");
  }
  return transitionIfNeeded(store, transitionIfNeeded(store, task, "planned"), "policy_blocked");
}

function sanitizeTaskPromptForAgent(input: string): string {
  return input
    .replace(/<\|im_start\|/gi, "[escaped-im-start]")
    .replace(/<\|im_end\|/gi, "[escaped-im-end]")
    .replace(/<\/?system>/gi, "[escaped-system-tag]")
    .replace(/<\/?developer>/gi, "[escaped-developer-tag]");
}

function composeAgentUserPrompt(input: string): string {
  return [
    "AICHESTRA_USER_TASK_INPUT_START",
    sanitizeTaskPromptForAgent(input),
    "AICHESTRA_USER_TASK_INPUT_END"
  ].join("\n");
}

export async function runAgentTaskWorkflow(taskId: string, deps: RunAgentTaskWorkflowDeps): Promise<RunAgentTaskWorkflowResult> {
  const store = deps.store;
  const gitProvider = deps.gitProvider ?? new MockGitProvider();
  const llmGateway = deps.llmGateway ?? createDefaultLlmGatewayService({ usageRepository: store });
  const modelRouter = deps.modelRouter ?? new CatalogModelRouter();
  const policyEngine = deps.policyEngine ?? new MockPolicyEngine();
  const agentRunner = deps.agentRunner ?? new MockAgentRunner(llmGateway);
  const testRunner = deps.testRunner ?? new MockTestRunner();
  const usageLedger = deps.usageLedger ?? new MockUsageLedger(store);
  const mergeSimulator = deps.mergeSimulator ?? new MockMergeSimulator();
  const registryService = deps.registryService ?? createRegistryService({
    skillRepository: store,
    harnessRepository: store,
    instructionRepository: store,
    auditRepository: {
      appendAuditLog: (input) => store.appendAuditLog(input),
      listAuditLogs: () => store.listRegistryAuditLogs(),
      listAuditLogsForTarget: (targetKind, targetId) => store.listAuditLogsForTarget(targetKind, targetId)
    },
    historyRepository: store,
    evalResultRepository: store,
    packageRepository: store
  });
  let task = store.getTask(taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  const activeRun = findActiveTaskRun(store, task.id);
  if (activeRun) {
    throw new ConflictError(`Task ${task.id} already has active run ${activeRun.id}`);
  }

  const agent: AgentKind = task.selectedAgent ?? "codex";
  const repo = store.getRepo(task.repoId);
  const registryResolution = registryService.resolveRegistryContextForTask({
    task,
    agent,
    repo
  });
  const selectedHarness = registryResolution.selectedHarness.id ? store.getHarness(registryResolution.selectedHarness.id) : undefined;
  if (!selectedHarness) {
    throw new Error("No harness packages are registered");
  }
  const selectedSkills = registryResolution.selectedSkills
    .map((ref) => ref.id ? store.getSkill(ref.id) : undefined)
    .filter((skill): skill is SkillPackage => skill !== undefined);
  const selectedSkill = selectedSkills[0];
  const selectedSkillIds = selectedSkills.map((skill) => skill.id);
  const skillVersions = registryResolution.selectedSkills.map(registryRefLabel);
  const harnessVersion = registryRefLabel(registryResolution.selectedHarness);
  const modelSelection = await modelRouter.selectModel({
    task,
    agent,
    skills: selectedSkills,
    preferredModel: task.selectedModel
  });
  const targets = inferLeaseTargets(task);
  const policyDecision = policyEngine.evaluateTask({
    taskId: task.id,
    files: targets.files,
    budgetLimitUsd: task.budgetLimitUsd
  });

  if (!policyDecision.allowed) {
    task = transitionToPolicyBlocked(store, task);
    store.recordAudit({
      action: "policy.blocked",
      targetType: "task",
      targetId: task.id,
      actorUserId: task.requesterUserId,
      taskId: task.id,
      repoId: task.repoId,
      metadata: { reason: policyDecision.reason }
    });
    return { taskId: task.id, status: task.status, usageEventIds: [] };
  }

  if (task.status === "completed" || task.status === "failed") {
    task = transitionIfNeeded(store, task, "queued");
  } else {
    task = transitionIfNeeded(store, task, "planned");
    task = transitionIfNeeded(store, task, "queued");
  }
  task = store.updateTask(task.id, {
    selectedAgent: agent,
    selectedModel: modelSelection.model,
    selectedSkillIds,
    selectedHarnessId: selectedHarness.id
  });

  const branchName = `ai/${task.id}/${agent}/${slugify(task.title)}`;
  await gitProvider.createBranch({
    repoId: task.repoId,
    branchName,
    baseBranch: task.baseBranch
  });

  task = store.updateTask(task.id, {
    branchName
  });
  task = transitionIfNeeded(store, task, "branch_created");

  const taskRun = store.createTaskRun({
    taskId: task.id,
    attempt: store.listTaskRuns(task.id).length + 1,
    status: "running",
    agent,
    model: modelSelection.model,
    modelProvider: modelSelection.provider,
    selectedSkillId: selectedSkill?.id,
    skillVersion: selectedSkill ? `${selectedSkill.name}@${selectedSkill.version}` : undefined,
    selectedHarnessId: selectedHarness.id,
    harnessVersion,
    selectedSkillRefs: registryResolution.selectedSkills,
    selectedHarnessRef: registryResolution.selectedHarness,
    selectedInstructionRefs: registryResolution.selectedInstructions,
    registryResolutionWarnings: registryResolution.warnings,
    registryResolutionErrors: registryResolution.errors,
    startedAt: new Date()
  });

  task = transitionIfNeeded(store, task, "running");

  const instructionSet = assembleInstructionSet({
    taskRunId: taskRun.id,
    artifacts: registryResolution.selectedInstructions
      .map((ref) => ref.id ? store.getInstruction(ref.id) : undefined)
      .filter((instruction): instruction is InstructionArtifact => instruction !== undefined),
    agent
  });
  store.saveInstructionSet(instructionSet);
  store.updateTask(task.id, { instructionSetId: instructionSet.id });

  const prompt = composeAgentUserPrompt(task.description ?? task.title);
  const agentRun = await agentRunner.run({
    taskId: task.id,
    taskRunId: taskRun.id,
    userId: task.requesterUserId,
    repoId: task.repoId,
    branch: branchName,
    agent,
    model: modelSelection.model,
    prompt,
    skillVersions,
    harnessVersion,
    instructionSet
  });
  const usageEvent = await usageLedger.record({
    ...agentRun.usage,
    metadata: {
      ...agentRun.usage.metadata,
      model_provider: modelSelection.provider,
      model_selection_reason: modelSelection.reason,
      skill_id: selectedSkill?.id,
      harness_id: selectedHarness.id,
      selected_skill_refs: registryResolution.selectedSkills.map(registryRefLabel),
      selected_harness_ref: registryRefLabel(registryResolution.selectedHarness),
      selected_instruction_refs: registryResolution.selectedInstructions.map(registryRefLabel),
      instruction_set_id: instructionSet.id,
      instruction_set_hash: instructionSet.assembledHash,
      registry_resolution_warnings: registryResolution.warnings,
      registry_resolution_errors: registryResolution.errors
    }
  });
  const lease = store.createBranchLease({
    taskId: task.id,
    taskRunId: taskRun.id,
    repoId: task.repoId,
    branchId: `branch_${taskRun.id}`,
    branchName,
    baseBranch: task.baseBranch,
    files: agentRun.changedFiles,
    symbols: targets.symbols,
    tests: agentRun.changedFiles.filter((file) => file.includes(".test.") || file.includes(".spec.") || file.startsWith("tests/")),
    status: "active"
  });
  const mergeSimulation = await mergeSimulator.simulate({
    repoId: task.repoId,
    repoPath: deps.repoPath,
    baseRef: task.baseBranch,
    sourceRef: branchName,
    targetRef: task.baseBranch,
    taskRunId: taskRun.id,
    branchLeaseId: lease.id,
    mode: deps.mergeSimulationMode ?? "mock"
  });
  store.recordMergeSimulation(mergeSimulation);
  const highestRisk = store.highestConflictRiskForLease(lease.id);
  task = store.updateTask(task.id, {
    conflictRiskScore: Math.max(highestRisk?.riskScore ?? 0, mergeSimulation.riskContribution)
  });

  task = transitionIfNeeded(store, task, "testing");

  const testResult = await testRunner.run({
    taskId: task.id,
    commands: selectedHarness.testCommands,
    changedFiles: agentRun.changedFiles,
    prompt
  });

  if (!agentRun.testsPassed || !testResult.passed) {
    store.updateTaskRun(taskRun.id, {
      status: "failed",
      finishedAt: new Date(),
      resultSummary: agentRun.summary,
      changedFiles: agentRun.changedFiles,
      diffSummary: agentRun.diffSummary,
      instructionSetId: instructionSet.id,
      errorMessage: testResult.output
    });
    task = transitionIfNeeded(store, task, "failed");
    return {
      taskId: task.id,
      status: task.status,
      branchName,
      taskRunId: taskRun.id,
      changedFiles: agentRun.changedFiles,
      diffSummary: agentRun.diffSummary,
      usageEventIds: [usageEvent.id]
    };
  }

  const pullRequest = await gitProvider.createDraftPullRequest({
    taskId: task.id,
    repoId: task.repoId,
    provider: "mock",
    branchName,
    baseBranch: task.baseBranch,
    title: task.title
  });
  const savedPullRequest = store.createPullRequest({
    taskId: pullRequest.taskId,
    repoId: pullRequest.repoId,
    provider: pullRequest.provider,
    externalId: pullRequest.externalId,
    url: pullRequest.url,
    status: pullRequest.status
  });
  const queueRisk = store.highestConflictRiskForLease(lease.id);
  const queueFields = store.mergeQueueFieldsForLease(lease.id);
  const mergeQueueEntry = store.createMergeQueueEntry({
    repoId: task.repoId,
    taskId: task.id,
    taskRunId: taskRun.id,
    branchLeaseId: lease.id,
    pullRequestId: savedPullRequest.id,
    pullRequestUrl: savedPullRequest.url ?? "",
    branchName,
    priority: 100,
    riskScore: queueFields.riskScore,
    conflictRiskScore: queueFields.conflictRiskScore,
    reasons: queueRisk?.reasons ?? queueFields.reasons,
    blockingReasons: queueFields.blockingReasons,
    recommendation: queueFields.recommendation,
    simulationStatus: queueFields.simulationStatus,
    lastSimulationAt: queueFields.lastSimulationAt
  });

  let finalStatus: TaskStatus = "pr_draft_ready";
  if (mergeSimulation.status === "text_conflict") {
    finalStatus = "conflict_detected";
  } else if (mergeQueueEntry.status === "blocked" || policyDecision.reviewRequired) {
    finalStatus = "review_required";
  }

  store.updateTaskRun(taskRun.id, {
    status: "succeeded",
    finishedAt: new Date(),
    resultSummary: agentRun.summary,
    changedFiles: agentRun.changedFiles,
    diffSummary: agentRun.diffSummary,
    pullRequestUrl: savedPullRequest.url,
    instructionSetId: instructionSet.id
  });
  task = transitionIfNeeded(store, task, finalStatus);
  if (finalStatus === "pr_draft_ready") {
    task = transitionIfNeeded(store, task, "completed");
  }

  return {
    taskId: task.id,
    status: task.status,
    branchName,
    pullRequestUrl: savedPullRequest.url,
    taskRunId: taskRun.id,
    changedFiles: agentRun.changedFiles,
    diffSummary: agentRun.diffSummary,
    usageEventIds: [usageEvent.id]
  };
}

export function createWorkflowId(taskId: string): string {
  return createId(`workflow_${taskId}`);
}
