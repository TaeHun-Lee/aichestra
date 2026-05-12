import path from "node:path";
import { createSeededStore } from "@aichestra/db";
import { GitHubGitProvider, GitIntegrationService, MockGitProvider } from "@aichestra/git-adapter";
import { OpenAICompatibleLLMProvider, ProviderAbstractionService, createDefaultLlmGatewayService, seedLlmModels } from "@aichestra/llm-gateway";
import { PolicyService, createPolicyContext, createPolicyResource, createPolicySubject } from "@aichestra/policy";
import { PolicyBackedRegistryMutationAuthorizer, createRegistryService } from "@aichestra/registry";
import { AgentRunnerService, MockAgentRunner, createAgentRunnerConfigFromEnv } from "@aichestra/runner";
import { SecurityControlService } from "@aichestra/security";
import { runAgentTaskWorkflow } from "@aichestra/worker";
import { createImprovementDemoData } from "../lib/improvement-demo.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function renderDashboardHtml(): Promise<string> {
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
  const overlappingTask = store.createTask({
    title: "Update auth session refresh",
    description: "Adjust auth session refresh behavior in the same files.",
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
  const tasks = store.listTasks();
  const taskRuns = store.listTaskRuns(task.id);
  const latestRun = taskRuns.at(-1);
  const pullRequest = store.listPullRequests(task.id).at(-1);
  const mockCost = store.listUsageEvents().reduce((total, event) => total + (event.costUsd ?? 0), 0);
  const activeLeases = store.listBranchLeases("repo_demo_backend", "active");
  const conflictRisks = store.computeRepoConflictRisks("repo_demo_backend");
  const mergeQueue = store.listMergeQueueEntries("repo_demo_backend");
  const mergeSimulations = store.listMergeSimulations({ repoId: "repo_demo_backend" });
  const registryAuditLogs = store.listRegistryAuditLogs();
  const registryApprovalQueue = registryService.listApprovalQueue();
  const registryRevisions = store.listRevisionsForTarget("skill", "skill_auth_debugging");
  const registryEvalResults = store.listEvalResultsForTarget("harness", "harness_backend_node20");
  const registryPackages = registryService.listPackageManifests();
  const registryPackageDiff = registryService.diffPackageManifests(skillManifest, bundleManifest);
  const registryVersionResolution = registryService.resolveVersion("skill", "auth-debugging", "^1.0.0");
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
  await gitService.createPullRequest(gitRepo.id, {
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
  const agentRunnerConfig = createAgentRunnerConfigFromEnv({});
  const agentRunnerService = new AgentRunnerService({
    runner: new MockAgentRunner(llmService),
    config: agentRunnerConfig,
    policyService,
    securityService
  });
  const agentRun = latestRun
    ? await agentRunnerService.runAgent({
      taskId: task.id,
      taskRunId: latestRun.id,
      actorId: task.requesterUserId,
      repoRef: { repoId: task.repoId, provider: "mock" },
      branchRef: { repoId: task.repoId, branchName: task.branchName ?? "mock-agent/dashboard", baseBranch: task.baseBranch },
      selectedModelRef: "mock-coder@1.0",
      selectedSkillRefs: latestRun.selectedSkillRefs ?? [],
      selectedHarnessRef: latestRun.selectedHarnessRef ?? { kind: "harness", name: "backend-node20", version: "1.0.0" },
      selectedInstructionRefs: latestRun.selectedInstructionRefs ?? [],
      prompt: "Run local agent runner dashboard fixture for login.",
      allowedCommands: [],
      testCommands: ["pnpm test"],
      maxRuntimeMs: agentRunnerConfig.maxRuntimeMs,
      metadata: { source: "dashboard" }
    })
    : undefined;
  const blockedCommandExample = agentRun
    ? await agentRunnerService.executeCommandForRun(agentRun.id, {
      command: "git",
      args: ["push", "origin", "main"],
      allowedCommands: ["git push origin main"]
    })
    : undefined;
  const localRunnerBlockedExample = await agentRunnerService.validateEnvironment({
    taskId: task.id,
    taskRunId: latestRun?.id ?? "run_dashboard_agent"
  });
  const llmCompletion = latestRun
    ? await llmService.routeCompletion({
      taskId: task.id,
      taskRunId: latestRun.id,
      actorId: task.requesterUserId,
      modelRef: "mock-registry-reviewer@1.0",
      prompt: "Review registry status for dashboard visibility.",
      repoId: task.repoId,
      budgetLimitUsd: 1
    })
    : undefined;
  const remoteLlmBlockedOperation = await new OpenAICompatibleLLMProvider().createCompletion({
    taskId: task.id,
    taskRunId: latestRun?.id ?? "run_dashboard_llm",
    prompt: "This remote provider call must stay blocked."
  }, seedLlmModels().find((model) => model.id === "openai-compatible/default") ?? seedLlmModels()[0]);
  const policyDecisions = [
    policyService.evaluate({
      subject: createPolicySubject({ actorId: "mock-dashboard", actorKind: "system", roles: ["system"] }),
      action: "llm.completion",
      resource: createPolicyResource({ resourceKind: "llm_provider", resourceId: "mock", metadata: { providerKind: "mock" } }),
      context: createPolicyContext({ taskId: task.id, taskRunId: latestRun?.id, providerKind: "mock", environment: { budgetAllowed: true }, metadata: { source: "dashboard" } })
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
      context: createPolicyContext({ taskId: task.id, taskRunId: latestRun?.id, runnerKind: "mock", command: "git push origin main", environment: { localCommandExecutionEnabled: false, harnessAllowed: true, workspaceSafe: false }, metadata: { source: "dashboard" } })
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
    taskRunId: latestRun?.id,
    actorId: task.requesterUserId,
    reason: "dashboard_denied_example"
  });
  const sandboxSession = securityService.createSandboxSession({
    profileId: "sandbox_local_temp_fixture",
    taskId: task.id,
    taskRunId: latestRun?.id,
    actorId: task.requesterUserId,
    runnerKind: "local",
    workspaceId: "workspace_dashboard_fixture",
    metadata: { source: "dashboard" }
  });
  securityService.evaluateNetworkEgress({
    host: "api.example.invalid",
    port: 443,
    taskId: task.id,
    taskRunId: latestRun?.id,
    actorId: task.requesterUserId
  });
  const redactionTest = securityService.redactText({
    text: "Bearer dashboard-token OPENAI_API_KEY=sk-dashboard-secret ~/.codex/auth.json",
    taskId: task.id,
    taskRunId: latestRun?.id,
    actorId: task.requesterUserId,
    metadata: { source: "dashboard" }
  });
  const providerAbstractionService = new ProviderAbstractionService({ policyService });
  const providerValidation = providerAbstractionService.validateProvider("claude-code-local");
  const providerInvocation = await providerAbstractionService.invoke({
    providerId: "claude-code-local",
    taskId: task.id,
    taskRunId: latestRun?.id,
    actorId: task.requesterUserId,
    modelId: "claude-code/local",
    prompt: "Provider dashboard fixture stays blocked.",
    metadata: { source: "dashboard" }
  });
  providerAbstractionService.getCredentialReference("claude-code-local");
  providerAbstractionService.getCredentialReference("anthropic-api-key");
  const improvement = createImprovementDemoData();
  const activeSkills = store.listSkills().filter((skill) => skill.status === "active").length;
  const activeHarnesses = store.listHarnesses().filter((harness) => harness.status === "active").length;
  const activeInstructions = store.listInstructions().filter((instruction) => instruction.status === "active").length;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Aichestra Dashboard</title>
  <style>
    :root {
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #171a20;
      background: #f6f7fa;
    }
    body {
      margin: 0;
    }
    header {
      border-bottom: 1px solid #d9dee8;
      background: #ffffff;
    }
    .shell {
      width: min(1160px, calc(100vw - 32px));
      margin: 0 auto;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 64px;
      gap: 16px;
    }
    .brand {
      font-size: 20px;
      font-weight: 700;
    }
    nav {
      display: flex;
      gap: 16px;
      color: #48505d;
      font-size: 14px;
    }
    main {
      padding: 28px 0 40px;
    }
    h1 {
      font-size: 28px;
      margin: 0 0 18px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 18px;
      margin: 0 0 12px;
      letter-spacing: 0;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .metric,
    .panel,
    .item {
      background: #ffffff;
      border: 1px solid #d9dee8;
      border-radius: 8px;
    }
    .metric {
      padding: 16px;
    }
    .label {
      color: #596372;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .value {
      font-size: 26px;
      font-weight: 700;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.8fr);
      gap: 16px;
    }
    .panel {
      padding: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th,
    td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid #edf0f5;
      vertical-align: top;
    }
    th {
      color: #596372;
      font-weight: 600;
    }
    .status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 999px;
      background: #e7f4ed;
      color: #17623b;
      font-size: 12px;
      white-space: nowrap;
    }
    .list {
      display: grid;
      gap: 10px;
    }
    .item {
      padding: 12px;
    }
    .item strong {
      display: block;
      font-size: 14px;
      margin-bottom: 4px;
    }
    .item span {
      color: #596372;
      font-size: 13px;
    }
    @media (max-width: 760px) {
      .metrics,
      .grid {
        grid-template-columns: 1fr;
      }
      .topbar {
        align-items: flex-start;
        flex-direction: column;
        padding: 14px 0;
      }
      nav {
        flex-wrap: wrap;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="shell topbar">
      <div class="brand">Aichestra</div>
      <nav aria-label="Primary">
        <a href="/">Dashboard</a>
        <a href="/tasks">Tasks</a>
        <a href="/registries">Registries</a>
      </nav>
    </div>
  </header>
  <main class="shell">
    <h1>AgentOps Control Plane</h1>
    <section class="metrics" aria-label="Summary metrics">
      <div class="metric"><div class="label">Total tasks</div><div class="value">${tasks.length}</div></div>
      <div class="metric"><div class="label">Completed</div><div class="value">${tasks.filter((item) => item.status === "completed").length}</div></div>
      <div class="metric"><div class="label">Conflicts</div><div class="value">${tasks.filter((item) => item.status === "conflict_detected").length}</div></div>
      <div class="metric"><div class="label">Mock cost</div><div class="value">$${mockCost.toFixed(3)}</div></div>
      <div class="metric"><div class="label">Active skills</div><div class="value">${activeSkills}</div></div>
      <div class="metric"><div class="label">Active harnesses</div><div class="value">${activeHarnesses}</div></div>
      <div class="metric"><div class="label">Active instructions</div><div class="value">${activeInstructions}</div></div>
    </section>
    <section class="grid">
      <div class="panel">
        <h2>Recent Tasks</h2>
        <table>
          <thead><tr><th>Task</th><th>Status</th><th>Agent</th><th>Branch</th><th>Risk</th><th>Queue</th><th>Simulation</th><th>Mock PR</th><th>Cost</th></tr></thead>
          <tbody>
            ${tasks.map((item) => {
              const itemPr = store.listPullRequests(item.id).at(-1);
              const itemRun = store.listTaskRuns(item.id).at(-1);
              const itemQueueEntry = mergeQueue.find((entry) => entry.taskRunId === itemRun?.id);
              const itemCost = store.listUsageEvents().filter((event) => event.taskId === item.id).reduce((total, event) => total + (event.costUsd ?? 0), 0);
              return `<tr><td>${escapeHtml(item.title)}</td><td><span class="status">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.selectedAgent ?? "codex")} / ${escapeHtml(item.selectedModel ?? "mock-model")}</td><td>${escapeHtml(item.branchName ?? "pending")}</td><td>${(item.conflictRiskScore ?? 0).toFixed(2)}</td><td>${escapeHtml(itemQueueEntry?.recommendation ?? itemQueueEntry?.status ?? "pending")}</td><td>${escapeHtml(itemQueueEntry?.simulationStatus ?? "pending")}</td><td>${itemPr?.url ? `<a href="${escapeHtml(itemPr.url)}">${escapeHtml(itemPr.externalId ?? "mock PR")}</a>` : "pending"}</td><td>$${itemCost.toFixed(3)}</td></tr>`;
            }).join("")}
          </tbody>
        </table>
        <h2>Task Detail</h2>
        <div class="item">
          <strong>${escapeHtml(task.title)}</strong>
          <span>${escapeHtml(latestRun?.resultSummary ?? "No run summary")}</span>
        </div>
        <div class="item">
          <strong>Changed files</strong>
          <span>${escapeHtml((latestRun?.changedFiles ?? []).join(", ") || "none")}</span>
        </div>
        <div class="item">
          <strong>Diff summary</strong>
          <span>${escapeHtml(latestRun?.diffSummary ?? "pending")}</span>
        </div>
        <div class="item">
          <strong>Registry selection</strong>
          <span>Skills: ${escapeHtml(latestRun?.selectedSkillRefs?.map((ref) => `${ref.name}@${ref.version}`).join(", ") ?? "pending")} / Harness: ${escapeHtml(latestRun?.selectedHarnessRef ? `${latestRun.selectedHarnessRef.name}@${latestRun.selectedHarnessRef.version}` : "pending")} / Instructions: ${escapeHtml(latestRun?.selectedInstructionRefs?.map((ref) => `${ref.name}@${ref.version}`).join(", ") ?? "pending")}</span>
        </div>
        <div class="item">
          <strong>Registry warnings</strong>
          <span>${escapeHtml(latestRun?.registryResolutionWarnings?.join(", ") || "none")}</span>
        </div>
        <div class="item">
          <strong>Mock PR</strong>
          <span>${pullRequest?.url ? `<a href="${escapeHtml(pullRequest.url)}">${escapeHtml(pullRequest.url)}</a>` : "pending"}</span>
        </div>
        <h2>Active Leases</h2>
        <table>
          <thead><tr><th>Task run</th><th>Branch</th><th>Files</th><th>Status</th></tr></thead>
          <tbody>
            ${activeLeases.map((lease) => `<tr><td>${escapeHtml(lease.taskRunId)}</td><td>${escapeHtml(lease.branchName)}</td><td>${escapeHtml(lease.files.join(", "))}</td><td>${escapeHtml(lease.status)}</td></tr>`).join("")}
          </tbody>
        </table>
        <h2>Conflict Risks</h2>
        <table>
          <thead><tr><th>Source</th><th>Target</th><th>Overlap</th><th>Score</th><th>Dry-run</th><th>Recommendation</th></tr></thead>
          <tbody>
            ${conflictRisks.map((risk) => `<tr><td>${escapeHtml(risk.sourceTaskRunId)}</td><td>${escapeHtml(risk.targetTaskRunId)}</td><td>${escapeHtml(risk.overlapFiles.join(", ") || "none")}</td><td>${risk.riskScore.toFixed(2)}</td><td>${escapeHtml(risk.simulationStatus ?? "not_run")}</td><td>${escapeHtml(risk.recommendation)}</td></tr>`).join("")}
          </tbody>
        </table>
        <h2>Dry-run Merge Simulations</h2>
        <table>
          <thead><tr><th>Task run</th><th>Mode</th><th>Status</th><th>Conflicts</th><th>Changed files</th></tr></thead>
          <tbody>
            ${mergeSimulations.map((simulation) => `<tr><td>${escapeHtml(simulation.taskRunId ?? "unknown")}</td><td>${escapeHtml(simulation.mode)}</td><td>${escapeHtml(simulation.status)}</td><td>${escapeHtml(simulation.conflictingFiles.join(", ") || "none")}</td><td>${escapeHtml(simulation.changedFiles.join(", ") || "none")}</td></tr>`).join("")}
          </tbody>
        </table>
        <h2>Merge Queue</h2>
        <table>
          <thead><tr><th>Task run</th><th>Branch</th><th>PR</th><th>Score</th><th>Status</th><th>Simulation</th><th>Recommendation</th><th>Reasons</th></tr></thead>
          <tbody>
            ${mergeQueue.map((entry) => `<tr><td>${escapeHtml(entry.taskRunId)}</td><td>${escapeHtml(entry.branchName)}</td><td><a href="${escapeHtml(entry.pullRequestUrl)}">${escapeHtml(entry.pullRequestId)}</a></td><td>${entry.riskScore.toFixed(2)}</td><td>${escapeHtml(entry.status)}</td><td>${escapeHtml(entry.simulationStatus ?? "not_run")}</td><td>${escapeHtml(entry.recommendation)}</td><td>${escapeHtml(entry.reasons.join(", "))}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <aside class="panel">
        <h2>Registries</h2>
        <div class="list">
          ${store.listSkills().map((skill) => `<div class="item"><strong>${escapeHtml(skill.name)}</strong><span>Skill ${escapeHtml(skill.version)} / ${escapeHtml(skill.status)} / approval ${escapeHtml(skill.approvalStatus)} / eval ${escapeHtml(skill.evalStatus)}</span></div>`).join("")}
          ${store.listHarnesses().map((harness) => `<div class="item"><strong>${escapeHtml(harness.name)}</strong><span>Harness ${escapeHtml(harness.version)} / ${escapeHtml(harness.status)} / approval ${escapeHtml(harness.approvalStatus)} / eval ${escapeHtml(harness.evalStatus)} / ${escapeHtml(harness.runtimeType)}</span></div>`).join("")}
          ${store.listInstructions().map((instruction) => `<div class="item"><strong>${escapeHtml(instruction.name)}</strong><span>Instruction ${escapeHtml(instruction.version)} / ${escapeHtml(instruction.type)} / ${escapeHtml(instruction.status)} / approval ${escapeHtml(instruction.approvalStatus)} / eval ${escapeHtml(instruction.evalStatus)} / checksum ${escapeHtml(instruction.checksumStatus)}</span></div>`).join("")}
        </div>
        <h2>Registry Audit</h2>
        <div class="list">
          ${(registryAuditLogs.length > 0 ? registryAuditLogs : []).map((log) => `<div class="item"><strong>${escapeHtml(log.action)}</strong><span>${escapeHtml(log.targetKind)} ${escapeHtml(log.targetName)}@${escapeHtml(log.targetVersion)} by ${escapeHtml(log.actorId)}</span></div>`).join("") || `<div class="item"><strong>No registry audit events</strong><span>Registry mutations will appear here.</span></div>`}
        </div>
        <h2>Approval Queue</h2>
        <div class="list">
          ${registryApprovalQueue.map((item) => `<div class="item"><strong>${escapeHtml(item.targetName)}</strong><span>${escapeHtml(item.targetKind)} ${escapeHtml(item.targetVersion)} / ${escapeHtml(item.approvalStatus)} / ${escapeHtml(item.recommendedAction)}</span></div>`).join("") || `<div class="item"><strong>No pending approvals</strong><span>Pending registry approvals will appear here.</span></div>`}
        </div>
        <h2>Registry Operations</h2>
        <div class="list">
          <div class="item"><strong>History</strong><span>${registryRevisions.length} revisions for auth-debugging; rollback is available through the API.</span></div>
          <div class="item"><strong>Latest eval</strong><span>${escapeHtml(registryEvalResults.at(-1)?.summary ?? "No eval result attached")}</span></div>
        </div>
        <h2>Registry Packages</h2>
        <div class="list">
          ${registryPackages.map((manifest) => `<div class="item"><strong>${escapeHtml(manifest.name)}@${escapeHtml(manifest.version)}</strong><span>${escapeHtml(manifest.packageKind)} / ${manifest.entries.length} entries / ${escapeHtml(manifest.checksum)}</span></div>`).join("")}
          <div class="item"><strong>Version resolution</strong><span>${escapeHtml(registryVersionResolution.name)} ${escapeHtml(registryVersionResolution.requestedRange)} -> ${escapeHtml(registryVersionResolution.selected?.version ?? "unresolved")}</span></div>
          <div class="item"><strong>Package diff</strong><span>${escapeHtml(registryPackageDiff.summary)} / risk ${escapeHtml(registryPackageDiff.riskLevel)}</span></div>
        </div>
        <h2>Git Adapter</h2>
        <div class="list">
          <div class="item"><strong>Provider</strong><span>${escapeHtml(gitService.getConfig().providerKind)} / remote Git ${gitService.getConfig().remoteGitEnabled ? "enabled" : "disabled"} / branch create ${gitService.getConfig().remoteBranchCreateEnabled ? "enabled" : "disabled"} / PR create ${gitService.getConfig().remotePullRequestCreateEnabled ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Branches</strong><span>${escapeHtml((await gitService.listBranches(gitRepo.id)).map((branch) => branch.branchName).join(", ") || "none")}</span></div>
          <div class="item"><strong>Pull requests</strong><span>${escapeHtml(gitService.listPullRequests(gitRepo.id).map((pr) => `${pr.externalId ?? pr.id} -> ${pr.url ?? "no-url"}`).join(", ") || "none")}</span></div>
          <div class="item"><strong>Changed files</strong><span>${escapeHtml(gitChangedFiles.changedFiles.map((file) => `${file.path}:${file.status}`).join(", ") || "none")}</span></div>
          <div class="item"><strong>Merge queue linkage</strong><span>${escapeHtml(mergeQueue.map((entry) => `${entry.pullRequestId}:${entry.recommendation}`).join(", ") || "none")}</span></div>
          <div class="item"><strong>Git audit</strong><span>${escapeHtml(gitService.listGitAuditEvents().map((event) => event.action).join(", ") || "none")}</span></div>
          <div class="item"><strong>Remote blocked example</strong><span>${escapeHtml(remoteBlockedOperation.reason ?? "remote operation blocked")}</span></div>
        </div>
        <h2>LLM Gateway</h2>
        <div class="list">
          <div class="item"><strong>Provider</strong><span>${escapeHtml(llmService.getConfig().providerKind)} / remote LLM ${llmService.getConfig().remoteLlmEnabled ? "enabled" : "disabled"} / remote completion ${llmService.getConfig().remoteCompletionEnabled ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Model catalog</strong><span>${escapeHtml(llmService.listModels().map((model) => `${model.id}:${model.status}`).join(", "))}</span></div>
          <div class="item"><strong>Virtual model keys</strong><span>${escapeHtml(llmService.listVirtualKeys().map((key) => `${key.id}:${key.status}:storesProviderSecret=false`).join(", "))}</span></div>
          <div class="item"><strong>Budget policy</strong><span>${escapeHtml(llmCompletion?.budgetDecision?.reason ?? "not evaluated")} / cost $${(llmCompletion?.budgetDecision?.estimatedCostUsd ?? 0).toFixed(6)}</span></div>
          <div class="item"><strong>Recent LLM usage</strong><span>${escapeHtml(llmService.listUsageEvents().map((event) => `${event.model}:${event.costUsd}`).join(", ") || "none")}</span></div>
          <div class="item"><strong>LLM audit</strong><span>${escapeHtml(llmService.listAuditEvents().map((event) => event.eventType).join(", ") || "none")}</span></div>
          <div class="item"><strong>Remote LLM blocked example</strong><span>${escapeHtml(remoteLlmBlockedOperation.reason ?? "remote LLM blocked")}</span></div>
        </div>
        <h2>Agent Runner</h2>
        <div class="list">
          <div class="item"><strong>Runner</strong><span>${escapeHtml(agentRunnerConfig.runnerKind)} / local runner ${agentRunnerConfig.localRunnerEnabled ? "enabled" : "disabled"} / command execution ${agentRunnerConfig.localCommandExecutionEnabled ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Command executor</strong><span>${escapeHtml(agentRunnerConfig.commandExecutorKind)} / max runtime ${agentRunnerConfig.maxRuntimeMs}ms</span></div>
          <div class="item"><strong>Latest agent run</strong><span>${escapeHtml(agentRun?.status ?? "not run")} / ${escapeHtml(agentRun?.diffSummary ?? "no diff")}</span></div>
          <div class="item"><strong>Changed files</strong><span>${escapeHtml(agentRun?.changedFiles.join(", ") ?? "none")}</span></div>
          <div class="item"><strong>Test results</strong><span>${escapeHtml(agentRun?.testResults.map((result) => `${result.command}:${result.status}`).join(", ") ?? "none")}</span></div>
          <div class="item"><strong>Instruction assembly</strong><span>${escapeHtml(agentRunnerService.listInstructionAssemblies().at(0)?.instructionSetHash ?? "none")} / refs ${agentRunnerService.listInstructionAssemblies().at(0)?.selectedInstructionRefs.length ?? 0}</span></div>
          <div class="item"><strong>LLM linkage</strong><span>${escapeHtml(agentRun?.llmGatewayRequestIds.join(", ") || "none")} / usage ${escapeHtml(agentRun?.usageLedgerEntryIds.join(", ") || "none")}</span></div>
          <div class="item"><strong>Git linkage</strong><span>provider ${escapeHtml(gitService.getConfig().providerKind)} / remote Git disabled</span></div>
          <div class="item"><strong>Command results</strong><span>${escapeHtml(agentRunnerService.listCommandResults().map((result) => `${path.basename(result.command)}:${result.status}`).join(", ") || "none")}</span></div>
          <div class="item"><strong>Workspace status</strong><span>${escapeHtml(agentRunnerService.listWorkspaces().map((workspace) => `${workspace.mode}:${workspace.status}`).join(", ") || "no local workspace")}</span></div>
          <div class="item"><strong>Blocked command example</strong><span>${escapeHtml(blockedCommandExample?.blockedReason ?? blockedCommandExample?.status ?? "none")}</span></div>
          <div class="item"><strong>Local runner blocked example</strong><span>${escapeHtml(localRunnerBlockedExample.reason ?? "mock runner available")}</span></div>
        </div>
        <h2>Policy-as-code</h2>
        <div class="list">
          <div class="item"><strong>Policy engine</strong><span>${escapeHtml(policyService.getConfig().engineKind)} / ${policyService.getConfig().ruleCount} rules / audit ${policyService.getConfig().auditEnabled ? "enabled" : "disabled"}</span></div>
          <div class="item"><strong>Default policy summary</strong><span>remote Git denied, remote LLM denied, runner commands denied by default, improvement apply denied.</span></div>
          <div class="item"><strong>Recent policy decisions</strong><span>${escapeHtml(policyDecisions.map((decision) => `${decision.action}:${decision.decision}`).join(", "))}</span></div>
          <div class="item"><strong>Blocked operation examples</strong><span>${escapeHtml(policyDecisions.filter((decision) => !decision.allowed).map((decision) => `${decision.action}:${decision.matchedRuleIds.join("+")}`).join(", "))}</span></div>
          <div class="item"><strong>Policy audit</strong><span>${escapeHtml(policyService.listAuditEntries().map((entry) => `${entry.action}:${entry.decision}`).join(", ") || "none")}</span></div>
        </div>
        <h2>Secrets and Sandbox</h2>
        <div class="list">
          <div class="item"><strong>Secret manager</strong><span>${escapeHtml(securityService.getConfig().secretManagerKind)} / production injection disabled / raw secrets unavailable</span></div>
          <div class="item"><strong>Secret refs</strong><span>${escapeHtml(securityService.listSecretRefs().map((ref) => `${ref.id}:${ref.status}:material=false`).join(", "))}</span></div>
          <div class="item"><strong>Secret scopes</strong><span>${escapeHtml(securityService.listSecretScopes().map((scope) => `${scope.id}:approval=${scope.requiresApproval}`).join(", "))}</span></div>
          <div class="item"><strong>Lease request example</strong><span>${escapeHtml(secretLeaseRequest.status)} / ${escapeHtml(secretLeaseRequest.reason ?? "no secret material issued")}</span></div>
          <div class="item"><strong>Sandbox profiles</strong><span>${escapeHtml(securityService.listSandboxProfiles().map((profile) => `${profile.id}:${profile.kind}:${profile.status}`).join(", "))}</span></div>
          <div class="item"><strong>Sandbox session</strong><span>${escapeHtml(sandboxSession.session?.status ?? sandboxSession.decision.reason)} / network denied / secrets denied / remote Git denied</span></div>
          <div class="item"><strong>Network egress policy</strong><span>${escapeHtml(securityService.listNetworkEgressPolicies().map((policy) => `${policy.id}:${policy.defaultAction}`).join(", "))}</span></div>
          <div class="item"><strong>Redaction policy</strong><span>${escapeHtml(securityService.listRedactionPolicies().map((policy) => `${policy.id}:maxPreview=${policy.maxPreviewBytes}`).join(", "))} / preview ${escapeHtml(redactionTest.preview)}</span></div>
          <div class="item"><strong>Security audit</strong><span>${escapeHtml(securityService.listAuditEvents().map((event) => `${event.eventType}:${event.result}`).join(", ") || "none")}</span></div>
          <div class="item"><strong>Blocked examples</strong><span>secret reads denied, network egress blocked, credential cache paths redacted.</span></div>
        </div>
        <h2>Enterprise LLM Providers</h2>
        <div class="list">
          <div class="item"><strong>Provider abstraction</strong><span>${escapeHtml(providerAbstractionService.getConfig().status)} / ${providerAbstractionService.getConfig().providerCatalogCount} catalog entries</span></div>
          <div class="item"><strong>Provider kinds</strong><span>${escapeHtml(providerAbstractionService.listProviders().map((provider) => provider.kind).join(", "))}</span></div>
          <div class="item"><strong>Auth types</strong><span>${escapeHtml(providerAbstractionService.listAuthTypes().join(", "))}</span></div>
          <div class="item"><strong>Local CLI readiness</strong><span>${escapeHtml(providerInvocation.error?.code ?? "none")} / Local Agent required</span></div>
          <div class="item"><strong>Credential cache access</strong><span>denied; credential references only</span></div>
          <div class="item"><strong>PTY fallback</strong><span>disabled by policy</span></div>
          <div class="item"><strong>Provider audit</strong><span>${providerAbstractionService.listAuditEvents().length} event(s); validation ${providerValidation.ok ? "passed" : escapeHtml(providerValidation.reason ?? "failed")}</span></div>
        </div>
        <h2>Phase 4 Preparation</h2>
        <div class="list">
          <div class="item"><strong>Failure signals</strong><span>${improvement.failureSignals.length} captured / ${escapeHtml(improvement.failureSignals.at(0)?.category ?? "none")}</span></div>
          <div class="item"><strong>Failure clusters</strong><span>${improvement.failureClusters.length} deterministic clusters / ${escapeHtml(improvement.failureClusters.at(0)?.severity ?? "none")}</span></div>
          <div class="item"><strong>Improvement candidates</strong><span>${improvement.improvementCandidates.length} candidate(s) / ${escapeHtml(improvement.improvementCandidates.at(0)?.status ?? "none")}</span></div>
          <div class="item"><strong>Improvement proposals</strong><span>${improvement.improvementProposals.length} draft proposal(s); no auto-apply path exists.</span></div>
          <div class="item"><strong>Auto-improvement analyses</strong><span>${improvement.autoImprovementAnalyses.length} mock analysis / ${escapeHtml(improvement.autoImprovementAnalyses.at(0)?.recommendedCandidateType ?? "none")}</span></div>
          <div class="item"><strong>Draft registry changes</strong><span>${improvement.draftRegistryChanges.length} draft change(s); not active registry entries.</span></div>
          <div class="item"><strong>Proposal readiness</strong><span>${escapeHtml(improvement.proposalReadiness.at(0)?.blockingReasons.join(", ") ?? "not evaluated")}</span></div>
          <div class="item"><strong>Eval requirements</strong><span>${improvement.evalRequirements.length} requirement(s); evals are not executed.</span></div>
          <div class="item"><strong>Canary plans</strong><span>${improvement.canaryRolloutPlans.length} draft plan(s); rollout is not executed.</span></div>
          <div class="item"><strong>Safety policy</strong><span>auto-apply ${improvement.safetyPolicies.at(0)?.allowAutoApply === true ? "enabled" : "disabled"} / human approval ${improvement.safetyPolicies.at(0)?.requireHumanApproval === true ? "required" : "not required"}</span></div>
        </div>
        <h2>Phase 4 Governance</h2>
        <div class="list">
          <div class="item"><strong>Review queue</strong><span>${improvement.proposalReviewQueue.length} item(s) / ${escapeHtml(improvement.proposalReviewQueue.at(0)?.recommendedAction ?? "none")}</span></div>
          <div class="item"><strong>Governance decisions</strong><span>${improvement.governanceDecisions.length} decision(s) / ${escapeHtml(improvement.governanceDecisions.at(0)?.decision ?? "none")}</span></div>
          <div class="item"><strong>Proposal eval runs</strong><span>${improvement.proposalEvalRuns.length} attached; eval execution is manual/mock-only.</span></div>
          <div class="item"><strong>Canary readiness</strong><span>${escapeHtml(improvement.canaryReadiness.at(0)?.blockingReasons.join(", ") ?? "not checked")} / rollout is not executed.</span></div>
          <div class="item"><strong>Apply gate</strong><span>${escapeHtml(improvement.proposalApplyGates.at(0)?.blockingReasons.join(", ") ?? "not checked")} / apply is not implemented.</span></div>
          <div class="item"><strong>Governance audit</strong><span>${improvement.governanceAuditEvents.length} event(s); draft changes are not active.</span></div>
        </div>
      </aside>
    </section>
    <template data-current-task="${escapeHtml(task.id)}"></template>
  </main>
</body>
</html>`;
}
