import { createSeededStore } from "@aichestra/db";
import { MergeQueuePolicyService } from "@aichestra/core";
import { BranchOrchestratorService, GitHubGitProvider, GitIntegrationService, MockGitProvider } from "@aichestra/git-adapter";
import { LocalAgentProtocolService, OpenAICompatibleLLMProvider, ProviderAbstractionService, createDefaultLlmGatewayService, seedLlmModels } from "@aichestra/llm-gateway";
import { PolicyService, createPolicyContext, createPolicyResource, createPolicySubject } from "@aichestra/policy";
import { PolicyBackedRegistryMutationAuthorizer, createRegistryService } from "@aichestra/registry";
import {
  AgentRunCoordinationService,
  AgentRunnerService,
  EditIntentGraphService,
  MockAgentRunner,
  editIntentGraphToDto,
  editIntentOverlapSummaryToDto,
  editIntentToDto,
  editOverlapAssessmentToDto,
  fileLeaseToDto,
  agentRunnerConfigToDto,
  agentWorkspaceCleanupDecisionToDto,
  agentWorkspaceLeaseToDto,
  agentWorkspaceLifecycleEventToDto,
  agentWorkspaceToDto,
  createAgentRunnerConfigFromEnv
} from "@aichestra/runner";
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
  const remoteBranchBlockedOperation = await gitService.createRemoteBranch(gitRepo.id, {
    branchName: "ai/blocked-remote-branch",
    baseBranch: "main",
    taskId: task.id
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
  const dashboardWorkspaceLease = agentRunnerRun?.workspaceLeaseId
    ? agentRunnerService.getWorkspaceLease(agentRunnerRun.workspaceLeaseId)
    : undefined;
  if (dashboardWorkspaceLease && agentRunnerRun) {
    agentRunnerService.requestWorkspaceLeaseCleanup(dashboardWorkspaceLease.id, {
      actorId: task.requesterUserId,
      metadata: { source: "dashboard" }
    });
    agentRunnerService.evaluateWorkspaceLeaseCleanup(dashboardWorkspaceLease.id, {
      changedFiles: agentRunnerRun.changedFiles,
      mergeStatus: "unmerged",
      reason: "dashboard_fixture_workspace_retained_for_review"
    }, {
      actorId: task.requesterUserId,
      metadata: { source: "dashboard" }
    });
  }
  const agentRunCoordinationService = new AgentRunCoordinationService({
    branchLeaseLookup: (branchLeaseId) => store.getBranchLease(branchLeaseId),
    workspaceLookup: (workspaceLeaseId) => agentRunnerService.getWorkspaceLease(workspaceLeaseId)
  });
  const branchOrchestratorService = new BranchOrchestratorService({
    repoLookup: (repoId) => store.getRepo(repoId),
    branchLeaseLookup: (branchLeaseId) => store.getBranchLease(branchLeaseId),
    activeBranchLeaseLookup: (repoId, branchName) => store.listBranchLeases(repoId, "active").filter((lease) => lease.branchName === branchName),
    branchLeaseCreator: (input) => store.createBranchLease(input),
    workspaceLeaseLookup: (workspaceLeaseId) => agentRunnerService.getWorkspaceLease(workspaceLeaseId),
    sessionLookup: (query) => agentRunCoordinationService.listSessions({ repoId: query.repoId })
      .filter((session) => query.branchName === undefined || session.branchName === query.branchName)
      .map((session) => ({
        id: session.id,
        repoId: session.repoId,
        branchName: session.branchName,
        agentRunId: session.agentRunId,
        status: session.status,
        workspaceLeaseId: session.workspaceLeaseId
      })),
    mergeQueueLookup: (query) => store.listMergeQueueEntries(query.repoId)
      .filter((entry) =>
        (query.branchLeaseId === undefined || entry.branchLeaseId === query.branchLeaseId) &&
        (query.branchName === undefined || entry.branchName === query.branchName) &&
        (query.taskRunId === undefined || entry.taskRunId === query.taskRunId))
  });
  if (agentRunnerRun) {
    const sharedWorkspaceLeaseId = agentRunnerRun.workspaceLeaseId ?? dashboardWorkspaceLease?.id;
    agentRunCoordinationService.registerSession({
      userId: task.requesterUserId,
      actorId: task.requesterUserId,
      taskId: task.id,
      taskRunId: latestTaskRun?.id,
      agentRunId: agentRunnerRun.id,
      repoId: task.repoId,
      branchLeaseId: gitBranch.branchLease?.id,
      workspaceLeaseId: sharedWorkspaceLeaseId,
      baseBranch: task.baseBranch,
      branchName: gitBranch.branch?.branchName ?? "codex/fix-login-timeout",
      targetFiles: ["src/auth/session.ts", "tests/auth/session.test.ts"],
      sourceScope: { scopeKind: "directory", paths: ["src/auth"], metadata: { source: "dashboard" } },
      status: "running",
      metadata: { source: "dashboard", noAgentExecution: true }
    });
    agentRunCoordinationService.registerSession({
      userId: "user_dashboard_parallel",
      actorId: "user_dashboard_parallel",
      taskId: overlappingTask.id,
      agentRunId: "agentrun_dashboard_parallel_session",
      repoId: task.repoId,
      workspaceLeaseId: sharedWorkspaceLeaseId,
      baseBranch: task.baseBranch,
      branchName: "codex/parallel-auth-session",
      targetFiles: ["src/auth/session.ts", "src/auth/token.ts"],
      sourceScope: { scopeKind: "directory", paths: ["src/auth"], metadata: { source: "dashboard" } },
      status: "running",
      metadata: { source: "dashboard", noAgentExecution: true }
    });
    const primaryBranchDecision = branchOrchestratorService.allocateBranch({
      userId: task.requesterUserId,
      actorId: task.requesterUserId,
      taskId: task.id,
      taskRunId: latestTaskRun?.id,
      agentRunId: agentRunnerRun.id,
      sessionId: "agentsession_dashboard_primary",
      repoId: task.repoId,
      baseBranch: task.baseBranch,
      branchPurpose: "agent_work",
      targetFiles: ["src/auth/session.ts", "tests/auth/session.test.ts"],
      sourceScope: { scopeKind: "directory", paths: ["src/auth"], metadata: { source: "dashboard" } },
      workspaceLeaseId: sharedWorkspaceLeaseId,
      metadata: { source: "dashboard", currentBaseBranch: task.baseBranch, noRealGit: true }
    });
    branchOrchestratorService.markReadyForReview(primaryBranchDecision.branchName, {
      actorId: task.requesterUserId,
      source: "dashboard",
      metadata: { mergeReadiness: "review_pending" }
    });
    branchOrchestratorService.allocateBranch({
      userId: "user_dashboard_parallel",
      actorId: "user_dashboard_parallel",
      taskId: overlappingTask.id,
      taskRunId: store.listTaskRuns(overlappingTask.id).at(-1)?.id,
      agentRunId: "agentrun_dashboard_branch_collision",
      sessionId: "agentsession_dashboard_collision",
      repoId: task.repoId,
      baseBranch: task.baseBranch,
      requestedBranchName: primaryBranchDecision.branchName,
      branchPurpose: "agent_work",
      targetFiles: ["src/auth/session.ts"],
      sourceScope: { scopeKind: "file", paths: ["src/auth/session.ts"], metadata: { source: "dashboard" } },
      metadata: { source: "dashboard", noRealGit: true }
    });
    branchOrchestratorService.allocateBranch({
      userId: "user_dashboard_workspace",
      actorId: "user_dashboard_workspace",
      taskId: overlappingTask.id,
      agentRunId: "agentrun_dashboard_same_workspace",
      sessionId: "agentsession_dashboard_same_workspace",
      repoId: task.repoId,
      baseBranch: task.baseBranch,
      requestedBranchName: "aichestra/demo-backend/workspace-collision-check",
      branchPurpose: "agent_work",
      targetFiles: ["src/auth/token.ts"],
      sourceScope: { scopeKind: "file", paths: ["src/auth/token.ts"], metadata: { source: "dashboard" } },
      workspaceLeaseId: sharedWorkspaceLeaseId,
      metadata: { source: "dashboard", noRealGit: true }
    });
    branchOrchestratorService.allocateBranch({
      userId: "user_dashboard_drift",
      actorId: "user_dashboard_drift",
      taskId: task.id,
      agentRunId: "agentrun_dashboard_base_drift",
      sessionId: "agentsession_dashboard_base_drift",
      repoId: task.repoId,
      baseBranch: task.baseBranch,
      requestedBranchName: "aichestra/demo-backend/base-drift-check",
      branchPurpose: "review_fixup",
      targetFiles: ["src/auth/session.ts"],
      sourceScope: { scopeKind: "file", paths: ["src/auth/session.ts"], metadata: { source: "dashboard" } },
      metadata: { source: "dashboard", currentBaseBranch: "develop", noRealGit: true }
    });
  }
  const editIntentGraphService = new EditIntentGraphService();
  editIntentGraphService.declareIntent({
    repoId: task.repoId,
    sessionId: "session_dashboard_primary",
    agentRunId: agentRunnerRun?.id,
    taskId: task.id,
    branchName: gitBranch.branch?.branchName ?? "codex/fix-login-timeout",
    workspaceLeaseId: agentRunnerRun?.workspaceLeaseId,
    intentKind: "modify",
    filePaths: ["src/auth/session.ts", "tests/auth/session.test.ts"],
    directoryScopes: ["src/auth"],
    confidence: "high",
    status: "active",
    metadata: { source: "dashboard" }
  });
  editIntentGraphService.declareIntent({
    repoId: task.repoId,
    sessionId: "session_dashboard_parallel",
    agentRunId: "agentrun_dashboard_parallel_session",
    taskId: overlappingTask.id,
    branchName: "codex/parallel-auth-session",
    workspaceLeaseId: agentRunnerRun?.workspaceLeaseId,
    intentKind: "refactor",
    filePaths: ["src/auth/session.ts", "src/auth/token.ts"],
    directoryScopes: ["src/auth"],
    confidence: "medium",
    status: "active",
    metadata: { source: "dashboard", apiToken: "OPENAI_API_KEY=sk-test" }
  });
  editIntentGraphService.requestFileLease({
    repoId: task.repoId,
    filePath: "src/auth/session.ts",
    leaseKind: "write_intent",
    ownerSessionId: "session_dashboard_primary",
    ownerAgentRunId: agentRunnerRun?.id,
    ownerTaskId: task.id,
    ownerActorId: task.requesterUserId,
    branchName: gitBranch.branch?.branchName ?? "codex/fix-login-timeout",
    workspaceLeaseId: agentRunnerRun?.workspaceLeaseId,
    metadata: { source: "dashboard" }
  });
  editIntentGraphService.requestFileLease({
    repoId: task.repoId,
    filePath: "src/auth/session.ts",
    leaseKind: "write_intent",
    ownerSessionId: "session_dashboard_parallel",
    ownerAgentRunId: "agentrun_dashboard_parallel_session",
    ownerTaskId: overlappingTask.id,
    ownerActorId: "user_dashboard_parallel",
    branchName: "codex/parallel-auth-session",
    workspaceLeaseId: agentRunnerRun?.workspaceLeaseId,
    metadata: { source: "dashboard" }
  });
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
  // Intentionally ungated demo fixture: the provider must return a blocked result and make no HTTP call.
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
  const localAgentProtocolService = new LocalAgentProtocolService({ policyService, securityService });
  const fixtureStarted = localAgentProtocolService.startFixtureAgent({
    userId: task.requesterUserId,
    hostId: "host_dashboard_mock",
    displayName: "Dashboard Mock Local Agent",
    agentVersion: "0.1.0-fixture",
    platform: "linux-x64",
    metadata: { source: "dashboard" }
  });
  const protocolAgent = fixtureStarted.agent;
  const protocolChannel = localAgentProtocolService.connectChannel(protocolAgent.id);
  const protocolCompatibility = localAgentProtocolService.checkCompatibility({
    providerId: "codex-cli-local",
    agentId: protocolAgent.id,
    command: "codex",
    providerTemplateId: "codex-cli-jsonl",
    parserMode: "jsonl",
    reportedVersion: "0.1.0",
    metadata: { source: "dashboard" }
  });
  const protocolInvocation = localAgentProtocolService.createInvocationEnvelope({
    taskId: task.id,
    taskRunId: latestTaskRun?.id,
    actorId: task.requesterUserId,
    providerId: "codex-cli-local",
    localAgentId: protocolAgent.id,
    workspaceRef: "workspace_dashboard_protocol",
    promptRef: "prompt_dashboard_protocol",
    requiredConsentLevel: "read_only",
    sandboxProfileId: "sandbox_default_deny",
    networkPolicyId: "network_default_deny",
    redactionPolicyId: "redaction_default",
    secretScopeIds: [],
    metadata: {
      source: "dashboard",
      requireChannel: true,
      channelId: protocolChannel.channel.id,
      compatibilityRequired: true,
      compatibilityCompatible: protocolCompatibility.compatible,
      compatibilityResultId: protocolCompatibility.id,
      providerTemplateId: "codex-cli-jsonl",
      fixtureDaemon: true
    }
  });
  const protocolConsentRequest = localAgentProtocolService.requestConsent(protocolInvocation.invocation.id);
  const protocolConsentDecision = localAgentProtocolService.recordConsentDecision({
    consentRequestId: protocolConsentRequest.id,
    userId: task.requesterUserId,
    decision: "approved_once",
    reason: "dashboard mock consent"
  });
  const protocolDispatched = await localAgentProtocolService.dispatchInvocation(protocolInvocation.invocation.id);
  localAgentProtocolService.receiveInvocationEvent({
    invocationId: protocolDispatched.id,
    source: "stdout",
    type: "message",
    payload: { text: "dashboard stdout OPENAI_API_KEY=sk-dashboard-secret" }
  });
  const protocolCompleted = localAgentProtocolService.completeInvocation({
    invocationId: protocolDispatched.id,
    exitCode: 0,
    statusReason: "dashboard_mock_completed"
  });
  localAgentProtocolService.recordDirectLocalCliExecutionBlocked({ providerId: "codex-cli-local", metadata: { source: "dashboard" } });
  localAgentProtocolService.recordCredentialCacheAccessDenied({ providerId: "codex-cli-local", metadata: { requestedPath: "~/.codex/auth.json" } });
  const providerAbstractionService = new ProviderAbstractionService({ policyService, localAgentProtocolService });
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
  const mergeQueuePolicyService = new MergeQueuePolicyService({
    dataSource: store,
    workspaceSnapshotProvider: (entry, lease) => agentRunnerService.listWorkspaceLeases({ branchLeaseId: lease?.id ?? entry.branchLeaseId })
      .map((workspace) => ({
        id: workspace.id,
        repoId: workspace.repoId,
        branchLeaseId: workspace.branchLeaseId,
        taskRunId: workspace.taskRunId,
        branchName: workspace.branchName,
        status: workspace.status,
        isolationStatus: workspace.isolationStatus,
        workspaceKind: workspace.workspaceKind,
        updatedAt: workspace.updatedAt,
        metadata: { workspacePathRedacted: true, metadataOnly: true }
      })),
    editOverlapProvider: (entry, lease) => {
      const sessions = agentRunCoordinationService.listSessions({ repoId: entry.repoId })
        .filter((session) =>
          session.branchLeaseId === (lease?.id ?? entry.branchLeaseId) ||
          session.taskRunId === entry.taskRunId ||
          session.branchName === entry.branchName);
      const sessionIds = new Set(sessions.map((session) => session.id));
      const coordinationOverlaps = [...sessionIds].flatMap((sessionId) =>
        agentRunCoordinationService.listSessionOverlaps({ repoId: entry.repoId, sessionId })
          .map((overlap) => ({
            id: overlap.id,
            repoId: overlap.repoId,
            sessionAId: overlap.sessionAId,
            sessionBId: overlap.sessionBId,
            overlapKind: overlap.overlapKind,
            files: overlap.files,
            severity: overlap.severity,
            recommendation: overlap.recommendation,
            metadata: { source: "agent_run_coordination" }
          })));
      const editIntentOverlaps = [...sessionIds].flatMap((sessionId) =>
        editIntentGraphService.listOverlapAssessments({ repoId: entry.repoId, sessionId })
          .map((overlap) => ({
            id: overlap.id,
            repoId: overlap.repoId,
            sessionAId: overlap.sessionIds[0] ?? sessionId,
            sessionBId: overlap.sessionIds[1] ?? sessionId,
            overlapKind: overlap.overlapKind,
            files: overlap.files,
            severity: overlap.severity,
            recommendation: overlap.recommendation,
            metadata: { source: "edit_intent_graph", reason: overlap.reason }
          })));
      return [...new Map([...coordinationOverlaps, ...editIntentOverlaps].map((overlap) => [overlap.id, overlap])).values()];
    },
    policyEvaluator: (input) => {
      const decision = policyService.evaluate({
        subject: createPolicySubject({
          actorId: input.context.actorId ?? "mock-dashboard",
          actorKind: "system",
          roles: ["system", "reviewer", "developer"],
          serviceAccountId: input.context.serviceAccountId,
          requestId: input.context.requestId,
          correlationId: input.context.correlationId,
          source: "dashboard_merge_queue_policy"
        }),
        action: input.action,
        resource: createPolicyResource({
          resourceKind: "merge_queue",
          resourceId: input.entry?.id,
          metadata: input.metadata
        }),
        context: createPolicyContext({
          taskId: input.entry?.taskId ?? input.lease?.taskId,
          taskRunId: input.entry?.taskRunId ?? input.lease?.taskRunId,
          repoId: input.entry?.repoId ?? input.lease?.repoId,
          branchName: input.entry?.branchName ?? input.lease?.branchName,
          riskScore: typeof input.metadata.riskScore === "number" ? input.metadata.riskScore : undefined,
          environment: {
            metadataOnly: true,
            realMergeExecution: false,
            remoteGitOperation: false,
            autoMergeEnabled: false,
            branchDeletionEnabled: false,
            secretsExposed: false,
            envValuesExposed: false
          },
          metadata: { ...input.metadata, source: "dashboard" }
        })
      });
      return {
        allowed: decision.allowed,
        decision: decision.decision,
        reason: decision.reason,
        policyDecisionId: decision.id,
        matchedRuleIds: decision.matchedRuleIds
      };
    }
  });
  const mergeQueuePolicyPreview = mergeQueuePolicyService.previewQueue("repo_demo_backend", {
    actorId: "mock-dashboard",
    serviceAccountId: "dashboard_read_model",
    validationStatus: "passed",
    approvalStatus: "approved",
    metadata: { source: "dashboard", releaseBlocker: true }
  });
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
    mergeQueuePolicy: mergeQueuePolicyPreview.policy,
    mergeReadinessDecisions: mergeQueuePolicyPreview.decisions,
    mergeQueueHolds: mergeQueuePolicyPreview.holds,
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
      recommendation: entry.recommendation,
      policyDecision: mergeQueuePolicyPreview.decisions.find((decision) => decision.queueEntryId === entry.id)?.decision ?? "not_evaluated",
      mergeExecutionEnabled: false
    })),
    branchOrchestrationRequests: branchOrchestratorService.listOrchestrationRequests(),
    branchOrchestrationDecisions: branchOrchestratorService.listOrchestrationDecisions(),
    branchOwnershipRecords: branchOrchestratorService.listBranchOwnershipRecords(),
    branchDriftStatuses: branchOrchestratorService.listBaseBranchDrift(),
    branchNamingPolicies: branchOrchestratorService.listNamingPolicies(),
    branchOrchestratorAuditEvents: branchOrchestratorService.listAuditEvents(),
    branchOrchestratorSummary: branchOrchestratorService.getSummary(),
    gitAuditEvents: gitService.listGitAuditEvents(),
    gitRemoteAuditEvents: gitService.listGitAuditEvents().filter((event) => event.action.includes("github_") || event.action.includes("remote_git")),
    remoteBlockedOperation,
    remoteBranchBlockedOperation,
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
    agentWorkspaces: agentRunnerService.listWorkspaces().map(agentWorkspaceToDto),
    agentWorkspaceLeases: agentRunnerService.listWorkspaceLeases().map(agentWorkspaceLeaseToDto),
    agentWorkspaceLifecycleEvents: agentRunnerService.listWorkspaceLifecycleEvents().map(agentWorkspaceLifecycleEventToDto),
    agentWorkspaceCleanupDecisions: agentRunnerService.listWorkspaceCleanupDecisions().map(agentWorkspaceCleanupDecisionToDto),
    agentCoordinationSessions: agentRunCoordinationService.listSessions(),
    agentCoordinationGroups: agentRunCoordinationService.listCoordinationGroups(),
    agentSessionOverlaps: agentRunCoordinationService.listSessionOverlaps(),
    agentConcurrencyPolicies: agentRunCoordinationService.listConcurrencyPolicies(),
    agentCoordinationAuditEvents: agentRunCoordinationService.listAuditEvents(),
    agentCoordinationSummary: agentRunCoordinationService.getSummary(),
    agentEditIntents: editIntentGraphService.listIntents().map(editIntentToDto),
    agentFileLeases: editIntentGraphService.listLeases().map(fileLeaseToDto),
    agentEditIntentGraph: editIntentGraphToDto(editIntentGraphService.listGraph({ repoId: task.repoId })),
    agentEditOverlapAssessments: editIntentGraphService.listOverlapAssessments().map(editOverlapAssessmentToDto),
    agentEditIntentSummary: editIntentOverlapSummaryToDto(editIntentGraphService.getOverlapSummary(task.repoId)),
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
    localAgentProtocolConfig: localAgentProtocolService.getConfig(),
    localAgentRegistrations: localAgentProtocolService.listAgents(),
    localAgentConsentRequests: localAgentProtocolService.listConsentRequests(),
    localAgentConsentDecision: protocolConsentDecision,
    localAgentInvocations: localAgentProtocolService.listInvocations(),
    localAgentInvocation: protocolCompleted,
    localAgentEvents: localAgentProtocolService.listEvents({ invocationId: protocolCompleted.id }),
    localAgentChannels: localAgentProtocolService.listChannels({ agentId: protocolAgent.id }),
    localAgentHandshakes: localAgentProtocolService.listHandshakes({ agentId: protocolAgent.id }),
    localAgentCapabilityAdvertisements: localAgentProtocolService.listCapabilityAdvertisements({ agentId: protocolAgent.id }),
    localAgentCompatibilityEntries: localAgentProtocolService.listCompatibilityEntries(),
    localAgentCompatibilityResults: localAgentProtocolService.listCompatibilityResults({ agentId: protocolAgent.id }),
    localAgentStream: localAgentProtocolService.getStreamForInvocation(protocolCompleted.id),
    localAgentStreamEvents: localAgentProtocolService.listStreamEvents({ invocationId: protocolCompleted.id }),
    localAgentAuditEvents: localAgentProtocolService.listAuditEvents(),
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
