import { createSeededStore } from "@aichestra/db";
import { GitHubGitProvider, GitIntegrationService, MockGitProvider } from "@aichestra/git-adapter";
import { OpenAICompatibleLLMProvider, createDefaultLlmGatewayService, seedLlmModels } from "@aichestra/llm-gateway";
import { createRegistryService } from "@aichestra/registry";
import { runAgentTaskWorkflow } from "@aichestra/worker";
import { createImprovementDemoData } from "./improvement-demo.ts";

export async function getDashboardData() {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Fix login timeout bug",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedAgent: "codex",
    selectedModel: "mock-model",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20",
    budgetLimitUsd: 20
  });
  const overlappingTask = store.createTask({
    title: "Update auth session refresh",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedAgent: "codex",
    selectedModel: "mock-model",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20",
    budgetLimitUsd: 20
  });
  await runAgentTaskWorkflow(task.id, { store });
  await runAgentTaskWorkflow(overlappingTask.id, { store });
  const registryService = createRegistryService({
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
  registryService.updateSkillApproval("skill_auth_debugging", { approvalStatus: "pending", reason: "dashboard review queue fixture" });
  registryService.attachEvalResult("harness", "harness_backend_node20", {
    evalName: "mock harness smoke",
    evalType: "mock",
    status: "passed",
    summary: "Mock harness smoke eval passed.",
    source: "mock",
    updateEvalStatus: true
  });
  const skillManifest = registryService.exportPackageManifest({ packageKind: "skill", targetId: "skill_auth_debugging" });
  const bundleManifest = registryService.exportPackageManifest({
    packageKind: "bundle",
    name: "dashboard-registry-bundle",
    version: "1.0.0"
  });
  const gitService = new GitIntegrationService({
    store,
    provider: new MockGitProvider(),
    config: {
      providerKind: "mock",
      remoteGitEnabled: false,
      remoteBranchCreateEnabled: false,
      remotePullRequestCreateEnabled: false,
      remoteMergeEnabled: false,
      githubConfigured: false,
      localBranchCreateEnabled: false
    }
  });
  const gitRepo = gitService.createRepo({
    provider: "mock",
    owner: "aichestra",
    name: "demo-backend",
    defaultBranch: "main"
  });
  const gitBranch = await gitService.createBranch(gitRepo.id, {
    branchName: "codex/fix-login-timeout",
    baseBranch: "main",
    taskId: task.id,
    files: ["src/auth/session.ts", "tests/auth/session.test.ts"]
  });
  const gitPullRequest = await gitService.createPullRequest(gitRepo.id, {
    taskId: task.id,
    branchName: gitBranch.branch?.branchName ?? "codex/fix-login-timeout",
    baseBranch: "main",
    title: "Fix login timeout bug"
  });
  const gitChangedFiles = await gitService.getChangedFiles(gitRepo.id, {
    branchName: gitBranch.branch?.branchName ?? "codex/fix-login-timeout",
    baseBranch: "main"
  });
  const remoteBlockedOperation = await new GitHubGitProvider({
    remoteGitEnabled: false,
    remoteBranchCreateEnabled: false,
    remotePullRequestCreateEnabled: false
  }).createPullRequest({
    repoRef: { repoId: "github_demo_backend", provider: "github", owner: "aichestra", name: "demo-backend" },
    taskId: task.id,
    repoId: "github_demo_backend",
    provider: "github",
    branchName: "codex/fix-login-timeout",
    baseBranch: "main",
    title: "Blocked remote PR example"
  });
  const llmService = createDefaultLlmGatewayService({ usageRepository: store });
  const latestTaskRun = store.listTaskRuns(task.id).at(-1);
  const llmCompletion = latestTaskRun
    ? await llmService.routeCompletion({
      taskId: task.id,
      taskRunId: latestTaskRun.id,
      actorId: task.requesterUserId,
      modelRef: "mock-registry-reviewer@1.0",
      prompt: "Review registry status for dashboard visibility.",
      repoId: task.repoId,
      budgetLimitUsd: 1
    })
    : undefined;
  const remoteLlmBlockedOperation = await new OpenAICompatibleLLMProvider().createCompletion({
    taskId: task.id,
    taskRunId: latestTaskRun?.id ?? "run_dashboard_llm",
    prompt: "This remote provider call must stay blocked."
  }, seedLlmModels().find((model) => model.id === "openai-compatible/default") ?? seedLlmModels()[0]);
  const improvement = createImprovementDemoData();

  return {
    totalTasks: store.listTasks().length,
    runningTasks: store.listTasks().filter((item) => item.status === "running").length,
    conflictTasks: store.listTasks().filter((item) => item.status === "conflict_detected" || item.status === "review_required").length,
    mockCostUsd: store.listUsageEvents().reduce((total, event) => total + (event.costUsd ?? 0), 0),
    registryOverview: {
      activeSkills: store.listSkills().filter((skill) => skill.status === "active").length,
      activeHarnesses: store.listHarnesses().filter((harness) => harness.status === "active").length,
      activeInstructions: store.listInstructions().filter((instruction) => instruction.status === "active").length
    },
    tasks: store.listTasks(),
    taskRuns: store.listTaskRuns(),
    activeLeases: store.listBranchLeases("repo_demo_backend", "active"),
    conflictRisks: store.computeRepoConflictRisks("repo_demo_backend"),
    mergeQueue: store.listMergeQueueEntries("repo_demo_backend"),
    mergeSimulations: store.listMergeSimulations({ repoId: "repo_demo_backend" }),
    skills: store.listSkills(),
    harnesses: store.listHarnesses(),
    instructions: store.listInstructions(),
    registryAuditLogs: store.listRegistryAuditLogs(),
    registryRevisions: store.listRevisionsForTarget("skill", "skill_auth_debugging"),
    registryApprovalQueue: registryService.listApprovalQueue(),
    registryEvalResults: store.listEvalResultsForTarget("harness", "harness_backend_node20"),
    registryPackages: registryService.listPackageManifests(),
    registryPackageDiff: registryService.diffPackageManifests(skillManifest, bundleManifest),
    registryVersionResolution: registryService.resolveVersion("skill", "jest-test-fixer", "^1.0.0"),
    pendingApprovalVersionResolution: registryService.resolveVersion("skill", "auth-debugging", "^1.0.0"),
    gitProviderConfig: gitService.getConfig(),
    gitProviders: gitService.listProviders(),
    gitRepos: gitService.listRepos(),
    gitBranches: await gitService.listBranches(gitRepo.id),
    gitPullRequests: gitService.listPullRequests(gitRepo.id),
    gitChangedFiles: gitChangedFiles.changedFiles,
    gitMergeQueueLinkage: store.listMergeQueueEntries("repo_demo_backend").map((entry) => ({
      taskRunId: entry.taskRunId,
      mergeQueueEntryId: entry.id,
      pullRequestId: entry.pullRequestId,
      recommendation: entry.recommendation
    })),
    gitAuditEvents: gitService.listGitAuditEvents(),
    remoteBlockedOperation,
    gitDemoPullRequest: gitPullRequest.pullRequest,
    llmProviderConfig: llmService.getConfig(),
    llmProviders: llmService.listProviders(),
    llmModels: llmService.listModels(),
    virtualModelKeys: llmService.listVirtualKeys(),
    llmCompletion,
    llmUsageEvents: llmService.listUsageEvents(),
    llmAuditEvents: llmService.listAuditEvents(),
    remoteLlmBlockedOperation,
    improvementFailureSignals: improvement.failureSignals,
    improvementFailureClusters: improvement.failureClusters,
    improvementCandidates: improvement.improvementCandidates,
    improvementProposals: improvement.improvementProposals,
    evalRequirements: improvement.evalRequirements,
    canaryRolloutPlans: improvement.canaryRolloutPlans,
    autoImprovementSafetyPolicies: improvement.safetyPolicies,
    autoImprovementAnalyses: improvement.autoImprovementAnalyses,
    draftRegistryChanges: improvement.draftRegistryChanges,
    proposalReadiness: improvement.proposalReadiness,
    proposalReviewQueue: improvement.proposalReviewQueue,
    governanceDecisions: improvement.governanceDecisions,
    proposalEvalRuns: improvement.proposalEvalRuns,
    canaryReadiness: improvement.canaryReadiness,
    proposalApplyGates: improvement.proposalApplyGates,
    governanceAuditEvents: improvement.governanceAuditEvents
  };
}
