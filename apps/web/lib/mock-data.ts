import { createSeededStore } from "@aichestra/db";
import { GitHubGitProvider, GitIntegrationService, MockGitProvider } from "@aichestra/git-adapter";
import { OpenAICompatibleLLMProvider, ProviderAbstractionService, createDefaultLlmGatewayService, seedLlmModels } from "@aichestra/llm-gateway";
import { PolicyService, createPolicyContext, createPolicyResource, createPolicySubject } from "@aichestra/policy";
import { PolicyBackedRegistryMutationAuthorizer, createRegistryService } from "@aichestra/registry";
import { AgentRunnerService, MockAgentRunner, agentRunnerConfigToDto, createAgentRunnerConfigFromEnv } from "@aichestra/runner";
import { SecurityControlService } from "@aichestra/security";
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
  const policyService = new PolicyService();
  const securityService = new SecurityControlService({ policyService });
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
    packageRepository: store,
    authorizer: new PolicyBackedRegistryMutationAuthorizer({ policyService })
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
    },
    policyService
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
  const llmService = createDefaultLlmGatewayService({ usageRepository: store, policyService });
  const latestTaskRun = store.listTaskRuns(task.id).at(-1);
  const agentRunnerConfig = createAgentRunnerConfigFromEnv({});
  const agentRunnerService = new AgentRunnerService({
    runner: new MockAgentRunner(llmService),
    config: agentRunnerConfig,
    policyService,
    securityService
  });
  const agentRunnerRun = latestTaskRun
    ? await agentRunnerService.runAgent({
      taskId: task.id,
      taskRunId: latestTaskRun.id,
      actorId: task.requesterUserId,
      repoRef: { repoId: task.repoId, provider: "mock" },
      branchRef: { repoId: task.repoId, branchName: task.branchName ?? "mock-agent/dashboard", baseBranch: task.baseBranch },
      selectedModelRef: "mock-coder@1.0",
      selectedSkillRefs: latestTaskRun.selectedSkillRefs ?? [],
      selectedHarnessRef: latestTaskRun.selectedHarnessRef ?? { kind: "harness", name: "backend-node20", version: "1.0.0" },
      selectedInstructionRefs: latestTaskRun.selectedInstructionRefs ?? [],
      prompt: "Run local agent runner dashboard fixture for login.",
      allowedCommands: [],
      testCommands: ["pnpm test"],
      maxRuntimeMs: agentRunnerConfig.maxRuntimeMs,
      metadata: {
        source: "dashboard"
      }
    })
    : undefined;
  const blockedCommandExample = agentRunnerRun
    ? await agentRunnerService.executeCommandForRun(agentRunnerRun.id, {
      command: "git",
      args: ["push", "origin", "main"],
      allowedCommands: ["git push origin main"]
    })
    : undefined;
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
  const policyDecisions = [
    policyService.evaluate({
      subject: createPolicySubject({ actorId: "mock-dashboard", actorKind: "system", roles: ["system"] }),
      action: "llm.completion",
      resource: createPolicyResource({ resourceKind: "llm_provider", resourceId: "mock", metadata: { providerKind: "mock" } }),
      context: createPolicyContext({ taskId: task.id, taskRunId: latestTaskRun?.id, providerKind: "mock", environment: { budgetAllowed: true }, metadata: { source: "dashboard" } })
    }),
    policyService.evaluate({
      subject: createPolicySubject({ actorId: "mock-dashboard", actorKind: "system", roles: ["system"] }),
      action: "git.remote_operation",
      resource: createPolicyResource({ resourceKind: "git_operation", resourceId: gitRepo.id, metadata: { providerKind: "github" } }),
      context: createPolicyContext({ taskId: task.id, repoId: gitRepo.id, providerKind: "github", metadata: { source: "dashboard" } })
    }),
    policyService.evaluate({
      subject: createPolicySubject({ actorId: "mock-dashboard", actorKind: "system", roles: ["system"] }),
      action: "runner.command.execute",
      resource: createPolicyResource({ resourceKind: "command", resourceId: "git push", metadata: { command: "git push origin main" } }),
      context: createPolicyContext({ taskId: task.id, taskRunId: latestTaskRun?.id, runnerKind: "mock", command: "git push origin main", environment: { localCommandExecutionEnabled: false, harnessAllowed: true, workspaceSafe: false }, metadata: { source: "dashboard" } })
    }),
    policyService.evaluate({
      subject: createPolicySubject({ actorId: "mock-viewer", actorKind: "user", roles: ["registry_viewer"] }),
      action: "registry.update",
      resource: createPolicyResource({ resourceKind: "registry_item", resourceId: "skill_auth_debugging", metadata: { targetKind: "skill" } }),
      context: createPolicyContext({ metadata: { source: "dashboard" } })
    }),
    policyService.evaluate({
      subject: createPolicySubject({ actorId: "mock-dashboard", actorKind: "system", roles: ["system"] }),
      action: "improvement.apply",
      resource: createPolicyResource({ resourceKind: "draft_registry_change", resourceId: "draft_dashboard", metadata: { activeRegistryMutation: false } }),
      context: createPolicyContext({ metadata: { source: "dashboard" } })
    }),
    policyService.evaluate({
      subject: createPolicySubject({ actorId: "mock-dashboard", actorKind: "system", roles: ["system"] }),
      action: "secret.read",
      resource: createPolicyResource({ resourceKind: "secret_scope", resourceId: "scope_future_real_credentials" }),
      context: createPolicyContext({ metadata: { source: "dashboard" } })
    }),
    policyService.evaluate({
      subject: createPolicySubject({ actorId: "mock-dashboard", actorKind: "system", roles: ["system"] }),
      action: "network.egress",
      resource: createPolicyResource({ resourceKind: "network_egress_policy", resourceId: "network_default_deny" }),
      context: createPolicyContext({ metadata: { source: "dashboard" } })
    })
  ];
  const secretLeaseRequest = securityService.requestLease({
    secretRefId: "secretref_mock_provider_metadata",
    scopeId: "scope_mock_provider_metadata",
    taskId: task.id,
    taskRunId: latestTaskRun?.id,
    actorId: task.requesterUserId,
    reason: "dashboard_denied_example"
  });
  const sandboxSession = securityService.createSandboxSession({
    profileId: "sandbox_local_temp_fixture",
    taskId: task.id,
    taskRunId: latestTaskRun?.id,
    actorId: task.requesterUserId,
    runnerKind: "local",
    workspaceId: "workspace_dashboard_fixture",
    metadata: { source: "dashboard" }
  });
  securityService.evaluateNetworkEgress({
    host: "api.example.invalid",
    port: 443,
    taskId: task.id,
    taskRunId: latestTaskRun?.id,
    actorId: task.requesterUserId
  });
  const redactionTest = securityService.redactText({
    text: "Bearer dashboard-token OPENAI_API_KEY=sk-dashboard-secret ~/.codex/auth.json",
    taskId: task.id,
    taskRunId: latestTaskRun?.id,
    actorId: task.requesterUserId,
    metadata: { source: "dashboard" }
  });
  const providerAbstractionService = new ProviderAbstractionService({ policyService });
  const providerValidation = providerAbstractionService.validateProvider("claude-code-local");
  const providerInvocation = await providerAbstractionService.invoke({
    providerId: "claude-code-local",
    taskId: task.id,
    taskRunId: latestTaskRun?.id,
    actorId: task.requesterUserId,
    modelId: "claude-code/local",
    prompt: "Provider dashboard fixture stays blocked.",
    metadata: { source: "dashboard" }
  });
  providerAbstractionService.getCredentialReference("claude-code-local");
  providerAbstractionService.getCredentialReference("anthropic-api-key");
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
    agentRunnerConfig: agentRunnerConfigToDto(agentRunnerConfig),
    agentRunners: agentRunnerService.listRunners(),
    agentRuns: agentRunnerService.listRuns(),
    agentRun: agentRunnerRun,
    agentRunAuditEvents: agentRunnerService.listAuditEvents(),
    agentInstructionAssemblies: agentRunnerService.listInstructionAssemblies(),
    agentExecutors: agentRunnerService.listExecutors(),
    agentCommandResults: agentRunnerService.listCommandResults(),
    agentWorkspaces: agentRunnerService.listWorkspaces(),
    blockedCommandExample,
    localRunnerBlockedExample: await agentRunnerService.validateEnvironment({
      taskId: task.id,
      taskRunId: latestTaskRun?.id ?? "run_dashboard_agent"
    }),
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
    governanceAuditEvents: improvement.governanceAuditEvents,
    policyConfig: policyService.getConfig(),
    policyRules: policyService.listRules(),
    policyDecisions,
    policyAuditEntries: policyService.listAuditEntries(),
    securityConfig: securityService.getConfig(),
    secretRefs: securityService.listSecretRefs(),
    secretScopes: securityService.listSecretScopes(),
    secretLeaseRequest,
    secretLeases: securityService.listSecretLeases(),
    sandboxProfiles: securityService.listSandboxProfiles(),
    sandboxSession: sandboxSession.session,
    sandboxDecision: sandboxSession.decision,
    sandboxSessions: securityService.listSandboxSessions(),
    networkPolicies: securityService.listNetworkEgressPolicies(),
    redactionPolicies: securityService.listRedactionPolicies(),
    redactionTest,
    securityAuditEvents: securityService.listAuditEvents(),
    providerAbstractionConfig: providerAbstractionService.getConfig(),
    providerCatalog: providerAbstractionService.listProviders(),
    providerAuthTypes: providerAbstractionService.listAuthTypes(),
    providerLocalCliTemplates: providerAbstractionService.listLocalCliTemplates(),
    providerLocalAgents: providerAbstractionService.listLocalAgents(),
    providerValidation,
    providerInvocation,
    providerAuditEvents: providerAbstractionService.listAuditEvents()
  };
}
