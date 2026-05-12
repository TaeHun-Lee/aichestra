import type { InMemoryAichestraStore } from "@aichestra/db";
import type { GitIntegrationService, GitProviderRuntimeConfig } from "@aichestra/git-adapter";
import type { ImprovementServices } from "@aichestra/improvement";
import type { LLMGatewayService, LocalAgentProtocolService, ProviderAbstractionService } from "@aichestra/llm-gateway";
import type { PolicyService } from "@aichestra/policy";
import type { RegistryService } from "@aichestra/registry";
import type { AgentRunnerService } from "@aichestra/runner";
import type { SecurityControlService } from "@aichestra/security";
import {
  sanitizeDashboardArray,
  sanitizeDashboardObject,
  type AgentRunnerReadModel,
  type AuditSummaryReadModel,
  type ConflictManagerReadModel,
  type DashboardJsonObject,
  type DashboardOverviewReadModel,
  type DashboardReadModels,
  type DashboardReadModelSource,
  type EnterpriseProviderReadModel,
  type GitIntegrationReadModel,
  type LLMGatewayReadModel,
  type LocalAgentReadModel,
  type PolicyReadModel,
  type RegistryReadModel,
  type SecurityReadModel,
  type TaskRunSummaryReadModel
} from "@aichestra/shared";

export type DashboardReadModelContext = {
  store: InMemoryAichestraStore;
  gitIntegrationService: GitIntegrationService;
  gitProviderConfig: GitProviderRuntimeConfig;
  llmGatewayService: LLMGatewayService;
  agentRunnerService: AgentRunnerService;
  registryService: RegistryService;
  improvementServices: ImprovementServices;
  policyService: PolicyService;
  providerAbstractionService: ProviderAbstractionService;
  securityService: SecurityControlService;
  localAgentProtocolService: LocalAgentProtocolService;
};

function last<T>(items: T[]): T | undefined {
  return items.at(-1);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function statusForCount(count: number): "available" | "empty" {
  return count > 0 ? "available" : "empty";
}

function remoteGitAuditEvent(event: { action?: string }): boolean {
  return typeof event.action === "string" && (event.action.includes("github_") || event.action.includes("remote_git"));
}

function registryTargets(context: DashboardReadModelContext): Array<{ kind: "skill" | "harness" | "instruction"; id: string }> {
  return [
    ...context.registryService.listSkills().map((entry) => ({ kind: "skill" as const, id: entry.id })),
    ...context.registryService.listHarnesses().map((entry) => ({ kind: "harness" as const, id: entry.id })),
    ...context.registryService.listInstructions().map((entry) => ({ kind: "instruction" as const, id: entry.id }))
  ];
}

function buildTasks(context: DashboardReadModelContext): TaskRunSummaryReadModel {
  const tasks = context.store.listTasks();
  const taskRuns = context.store.listTaskRuns();
  const usageEvents = context.store.listUsageEvents();
  const pullRequests = context.store.listPullRequests();
  const recentTasks = tasks.map((task) => {
    const runs = taskRuns.filter((run) => run.taskId === task.id);
    const latestRun = last(runs);
    const taskUsage = usageEvents.filter((event) => event.taskId === task.id);
    return {
      id: task.id,
      title: task.title,
      status: task.status,
      selectedAgent: task.selectedAgent ?? null,
      selectedModel: task.selectedModel ?? null,
      branchName: task.branchName ?? null,
      conflictRiskScore: task.conflictRiskScore ?? 0,
      latestRunId: latestRun?.id ?? null,
      latestRunStatus: latestRun?.status ?? null,
      latestRunSummary: latestRun?.resultSummary ?? null,
      pullRequestCount: pullRequests.filter((pullRequest) => pullRequest.taskId === task.id).length,
      usageCostUsd: taskUsage.reduce((total, event) => total + (event.costUsd ?? 0), 0)
    };
  });

  return {
    tasks: sanitizeDashboardArray(tasks),
    taskRuns: sanitizeDashboardArray(taskRuns),
    recentTasks: sanitizeDashboardArray(recentTasks),
    usageEvents: sanitizeDashboardArray(usageEvents),
    warnings: tasks.length === 0 ? ["No tasks have been created in the current API store."] : []
  };
}

function buildConflicts(context: DashboardReadModelContext): ConflictManagerReadModel {
  const branchLeases = context.store.listBranchLeases();
  const conflictRisks = context.store.listRepos().flatMap((repo) => context.store.computeRepoConflictRisks(repo.id));
  const mergeQueue = context.store.listMergeQueueEntries();
  const mergeSimulations = context.store.listMergeSimulations();

  return {
    branchLeases: sanitizeDashboardArray(branchLeases),
    conflictRisks: sanitizeDashboardArray(conflictRisks),
    mergeQueue: sanitizeDashboardArray(mergeQueue),
    mergeSimulations: sanitizeDashboardArray(mergeSimulations),
    summary: sanitizeDashboardObject({
      activeLeases: branchLeases.filter((lease) => lease.status === "active").length,
      conflictRisks: conflictRisks.length,
      mergeQueueEntries: mergeQueue.length,
      dryRunSimulations: mergeSimulations.length
    })
  };
}

function buildGit(context: DashboardReadModelContext): GitIntegrationReadModel {
  const repos = context.gitIntegrationService.listRepos();
  const branchRecords = context.store.listBranchLeases();
  const pullRequests = context.gitIntegrationService.listPullRequests();
  const auditEvents = context.gitIntegrationService.listGitAuditEvents();
  const changedFiles = branchRecords.flatMap((lease) =>
    lease.files.map((file) => ({
      path: file,
      status: "tracked_by_branch_lease",
      repoId: lease.repoId,
      taskId: lease.taskId,
      taskRunId: lease.taskRunId,
      branchLeaseId: lease.id
    }))
  );
  const mergeQueue = context.store.listMergeQueueEntries();

  return {
    config: sanitizeDashboardObject(context.gitIntegrationService.getConfig()),
    providers: sanitizeDashboardArray(context.gitIntegrationService.listProviders()),
    repos: sanitizeDashboardArray(repos),
    branchRecords: sanitizeDashboardArray(branchRecords),
    pullRequests: sanitizeDashboardArray(pullRequests),
    changedFiles: sanitizeDashboardArray(changedFiles),
    mergeQueueLinkage: sanitizeDashboardArray(mergeQueue.map((entry) => ({
      taskRunId: entry.taskRunId,
      mergeQueueEntryId: entry.id,
      pullRequestId: entry.pullRequestId,
      recommendation: entry.recommendation
    }))),
    auditEvents: sanitizeDashboardArray(auditEvents),
    remoteAuditEvents: sanitizeDashboardArray(auditEvents.filter(remoteGitAuditEvent)),
    blockedExamples: sanitizeDashboardArray([
      {
        operation: "github_branch_create",
        reason: context.gitProviderConfig.remoteGitEnabled ? "requires_branch_create_gate_policy_and_allowlist" : "remote_git_disabled"
      },
      {
        operation: "github_pr_create",
        reason: context.gitProviderConfig.remoteGitEnabled ? "requires_pr_create_gate_policy_and_allowlist" : "remote_git_disabled"
      },
      {
        operation: "github_merge",
        reason: "remote_merge_unsupported"
      },
      {
        operation: "github_rebase",
        reason: "rebase_unsupported"
      }
    ]),
    safety: sanitizeDashboardObject({
      remoteGitEnabled: context.gitProviderConfig.remoteGitEnabled,
      remoteBranchCreateEnabled: context.gitProviderConfig.remoteBranchCreateEnabled,
      remotePullRequestCreateEnabled: context.gitProviderConfig.remotePullRequestCreateEnabled,
      remoteMergeEnabled: false,
      githubConfigured: context.gitProviderConfig.githubConfigured,
      githubAllowedRepoCount: context.gitProviderConfig.githubAllowedRepoCount ?? context.gitProviderConfig.githubAllowedRepos?.length ?? 0,
      githubAllowedBranchPrefix: context.gitProviderConfig.githubAllowedBranchPrefix ?? "ai/",
      tokenExposed: false
    })
  };
}

function buildRegistry(context: DashboardReadModelContext): RegistryReadModel {
  const skills = context.registryService.listSkills();
  const harnesses = context.registryService.listHarnesses();
  const instructions = context.registryService.listInstructions();
  const targets = registryTargets(context);
  const revisions = targets.flatMap((target) => context.registryService.listRevisionsForTarget(target.kind, target.id));
  const evalResults = targets.flatMap((target) => context.registryService.listEvalResultsForTarget(target.kind, target.id));
  const proposals = context.improvementServices.proposals.listProposals();
  const draftChanges = context.improvementServices.draftRegistryChanges.listDraftChanges();

  return {
    summary: sanitizeDashboardObject({
      activeSkills: skills.filter((entry) => entry.status === "active").length,
      activeHarnesses: harnesses.filter((entry) => entry.status === "active").length,
      activeInstructions: instructions.filter((entry) => entry.status === "active").length,
      approvalQueueItems: context.registryService.listApprovalQueue().length,
      packageManifests: context.registryService.listPackageManifests().length,
      improvementProposals: proposals.length,
      draftRegistryChanges: draftChanges.length,
      autoApplyEnabled: context.improvementServices.safetyPolicies.listPolicies().some((policy) => policy.allowAutoApply)
    }),
    skills: sanitizeDashboardArray(skills),
    harnesses: sanitizeDashboardArray(harnesses),
    instructions: sanitizeDashboardArray(instructions),
    approvalQueue: sanitizeDashboardArray(context.registryService.listApprovalQueue()),
    packages: sanitizeDashboardArray(context.registryService.listPackageManifests()),
    auditLogs: sanitizeDashboardArray(context.registryService.listAuditLogs()),
    revisions: sanitizeDashboardArray(revisions),
    evalResults: sanitizeDashboardArray(evalResults),
    governance: sanitizeDashboardObject({
      failureSignals: context.improvementServices.signals.listSignals(),
      failureClusters: context.improvementServices.clustering.listClusters(),
      improvementCandidates: context.improvementServices.candidates.listCandidates(),
      improvementProposals: proposals,
      autoImprovementAnalyses: context.improvementServices.autoImprovement.listAnalyses(),
      draftRegistryChanges: draftChanges,
      proposalReadiness: context.improvementServices.proposalReadiness.listReadiness(),
      proposalReviewQueue: context.improvementServices.governance.listReviewQueue(),
      governanceDecisions: proposals.flatMap((proposal) => context.improvementServices.governance.listDecisions(proposal.id)),
      evalRequirements: context.improvementServices.evalRequirements.listRequirements(),
      proposalEvalRuns: proposals.flatMap((proposal) => context.improvementServices.proposalEvalRuns.listEvalRuns(proposal.id)),
      canaryRolloutPlans: context.improvementServices.canaryPlans.listPlans(),
      safetyPolicies: context.improvementServices.safetyPolicies.listPolicies(),
      governanceAuditEvents: context.improvementServices.governance.listAuditEvents()
    })
  };
}

function buildLlm(context: DashboardReadModelContext): LLMGatewayReadModel {
  const config = context.llmGatewayService.getConfig();
  return {
    config: sanitizeDashboardObject(config),
    providers: sanitizeDashboardArray(context.llmGatewayService.listProviders()),
    models: sanitizeDashboardArray(context.llmGatewayService.listModels()),
    virtualKeys: sanitizeDashboardArray(context.llmGatewayService.listVirtualKeys()),
    usageEvents: sanitizeDashboardArray(context.llmGatewayService.listUsageEvents()),
    auditEvents: sanitizeDashboardArray(context.llmGatewayService.listAuditEvents()),
    blockedExamples: sanitizeDashboardArray([
      {
        operation: "remote_llm_completion",
        reason: config.remoteLlmEnabled ? "remote_llm_completion_disabled_or_not_implemented" : "blocked_remote_llm_disabled"
      },
      {
        operation: "provider_api_key_exposure",
        reason: "provider_credentials_never_returned"
      }
    ]),
    budget: sanitizeDashboardObject({
      budgetChecksEnabled: true,
      usageLedgerLinked: true,
      apiKeyExposed: false
    })
  };
}

function buildAgents(context: DashboardReadModelContext): AgentRunnerReadModel {
  return {
    config: sanitizeDashboardObject(context.agentRunnerService.getConfig()),
    runners: sanitizeDashboardArray(context.agentRunnerService.listRunners()),
    executors: sanitizeDashboardArray(context.agentRunnerService.listExecutors()),
    runs: sanitizeDashboardArray(context.agentRunnerService.listRuns()),
    auditEvents: sanitizeDashboardArray(context.agentRunnerService.listAuditEvents()),
    instructionAssemblies: sanitizeDashboardArray(context.agentRunnerService.listInstructionAssemblies()),
    commandResults: sanitizeDashboardArray(context.agentRunnerService.listCommandResults()),
    workspaces: sanitizeDashboardArray(context.agentRunnerService.listWorkspaces()),
    blockedExamples: sanitizeDashboardArray([
      {
        operation: "runner.command.execute",
        reason: context.agentRunnerService.getConfig().localCommandExecutionEnabled ? "requires_harness_workspace_and_policy_gates" : "local_command_execution_disabled"
      },
      {
        operation: "runner.remote_git",
        reason: "remote_git_disabled_for_runner"
      },
      {
        operation: "runner.secret.inject",
        reason: "runner_secret_injection_denied"
      }
    ])
  };
}

function buildPolicy(context: DashboardReadModelContext): PolicyReadModel {
  return {
    config: sanitizeDashboardObject(context.policyService.getConfig()),
    rules: sanitizeDashboardArray(context.policyService.listRules()),
    auditEntries: sanitizeDashboardArray(context.policyService.listAuditEntries()),
    blockedExamples: sanitizeDashboardArray([
      { action: "git.merge", reason: "merge_denied" },
      { action: "git.rebase", reason: "rebase_denied" },
      { action: "llm.remote_completion", reason: "remote_llm_denied" },
      { action: "runner.command.execute", reason: "runner_command_execution_denied_by_default" },
      { action: "credential.cache.read", reason: "credential_cache_read_denied" },
      { action: "local_cli.danger_full_access", reason: "danger_full_access_denied" },
      { action: "improvement.apply", reason: "auto_apply_denied" }
    ])
  };
}

function buildProviders(context: DashboardReadModelContext): EnterpriseProviderReadModel {
  const config = context.providerAbstractionService.getConfig();
  return {
    config: sanitizeDashboardObject(config),
    catalog: sanitizeDashboardArray(context.providerAbstractionService.listProviders()),
    authTypes: context.providerAbstractionService.listAuthTypes(),
    localCliTemplates: sanitizeDashboardArray(context.providerAbstractionService.listLocalCliTemplates()),
    localAgents: sanitizeDashboardArray(context.providerAbstractionService.listLocalAgents()),
    auditEvents: sanitizeDashboardArray(context.providerAbstractionService.listAuditEvents()),
    readiness: sanitizeDashboardObject({
      localCliProviderReadiness: config.connectedLocalAgents > 0 ? "local_agent_available" : "local_agent_required",
      credentialCacheAccess: "denied",
      directLocalCliExecution: "blocked",
      productionProviderCalls: "not_implemented"
    }),
    blockedExamples: sanitizeDashboardArray([
      { operation: "local_cli.invoke.direct", reason: "direct_local_cli_execution_blocked" },
      { operation: "credential.cache.read", reason: "credential_cache_access_denied" },
      { operation: "provider.remote_call", reason: "provider_adapter_skeleton_only" }
    ])
  };
}

function buildSecurity(context: DashboardReadModelContext): SecurityReadModel {
  return {
    config: sanitizeDashboardObject(context.securityService.getConfig()),
    secretRefs: sanitizeDashboardArray(context.securityService.listSecretRefs()),
    secretScopes: sanitizeDashboardArray(context.securityService.listSecretScopes()),
    secretLeases: sanitizeDashboardArray(context.securityService.listSecretLeases()),
    sandboxProfiles: sanitizeDashboardArray(context.securityService.listSandboxProfiles()),
    sandboxSessions: sanitizeDashboardArray(context.securityService.listSandboxSessions()),
    networkPolicies: sanitizeDashboardArray(context.securityService.listNetworkEgressPolicies()),
    redactionPolicies: sanitizeDashboardArray(context.securityService.listRedactionPolicies()),
    auditEvents: sanitizeDashboardArray(context.securityService.listAuditEvents()),
    blockedExamples: sanitizeDashboardArray([
      { operation: "secret.lease.issue", reason: "no_secret_lease_issued_by_default" },
      { operation: "network.egress", reason: "network_default_deny" },
      { operation: "local_agent.secret.forward", reason: "secret_forwarding_denied" },
      { operation: "credential_cache_path", reason: "credential cache paths redacted" }
    ]),
    redaction: sanitizeDashboardObject({
      enabled: context.securityService.getConfig().redactionEnabled,
      policyCount: context.securityService.listRedactionPolicies().length,
      rawOutputStored: false
    })
  };
}

function buildLocalAgents(context: DashboardReadModelContext): LocalAgentReadModel {
  const invocations = context.localAgentProtocolService.listInvocations();
  const consentDecisions = context.localAgentProtocolService.listConsentDecisions();
  const approved = consentDecisions.filter((decision) =>
    decision.decision === "approved" ||
    decision.decision === "approved_once" ||
    decision.decision === "approved_for_session"
  );
  const denied = consentDecisions.filter((decision) => decision.decision === "denied" || decision.decision === "expired");

  return {
    config: sanitizeDashboardObject(context.localAgentProtocolService.getConfig()),
    registrations: sanitizeDashboardArray(context.localAgentProtocolService.listAgents()),
    sessions: sanitizeDashboardArray(context.localAgentProtocolService.listSessions()),
    channels: sanitizeDashboardArray(context.localAgentProtocolService.listChannels()),
    handshakes: sanitizeDashboardArray(context.localAgentProtocolService.listHandshakes()),
    capabilityAdvertisements: sanitizeDashboardArray(context.localAgentProtocolService.listCapabilityAdvertisements()),
    compatibilityEntries: sanitizeDashboardArray(context.localAgentProtocolService.listCompatibilityEntries()),
    compatibilityResults: sanitizeDashboardArray(context.localAgentProtocolService.listCompatibilityResults()),
    consentQueue: sanitizeDashboardArray(context.localAgentProtocolService.listConsentRequests({ pendingOnly: true })),
    consentHistory: sanitizeDashboardObject({
      approved,
      denied
    }),
    invocations: sanitizeDashboardArray(invocations),
    events: sanitizeDashboardArray(context.localAgentProtocolService.listEvents()),
    streams: sanitizeDashboardArray(invocations.map((invocation) => context.localAgentProtocolService.getStreamForInvocation(invocation.id)).filter(Boolean)),
    streamEvents: sanitizeDashboardArray(context.localAgentProtocolService.listStreamEvents()),
    auditEvents: sanitizeDashboardArray(context.localAgentProtocolService.listAuditEvents()),
    blockedExamples: sanitizeDashboardArray([
      { operation: "real_transport", reason: "real_transport_disabled" },
      { operation: "vendor_cli_execution", reason: "vendor_cli_execution_disabled" },
      { operation: "credential_cache_access", reason: "credential_cache_access_denied" },
      { operation: "danger_full_access", reason: "danger_full_access_denied" }
    ])
  };
}

function auditGroup(source: string, events: unknown[]): DashboardJsonObject {
  return sanitizeDashboardObject({
    source,
    count: events.length,
    recentEvents: events.slice(-5)
  });
}

function buildAudit(context: DashboardReadModelContext): AuditSummaryReadModel {
  const groups = [
    auditGroup("core", context.store.listAuditLogs()),
    auditGroup("registry", context.registryService.listAuditLogs()),
    auditGroup("git", context.gitIntegrationService.listGitAuditEvents()),
    auditGroup("llm", context.llmGatewayService.listAuditEvents()),
    auditGroup("agent_runner", context.agentRunnerService.listAuditEvents()),
    auditGroup("policy", context.policyService.listAuditEntries()),
    auditGroup("security", context.securityService.listAuditEvents()),
    auditGroup("enterprise_provider", context.providerAbstractionService.listAuditEvents()),
    auditGroup("local_agent_protocol", context.localAgentProtocolService.listAuditEvents()),
    auditGroup("governance", context.improvementServices.governance.listAuditEvents())
  ];
  const recentEvents = groups.flatMap((group) => Array.isArray(group.recentEvents) ? group.recentEvents : []);

  return {
    auditGroups: groups,
    recentEvents: sanitizeDashboardArray(recentEvents),
    summary: sanitizeDashboardObject({
      groupCount: groups.length,
      totalEvents: groups.reduce((total, group) => total + (typeof group.count === "number" ? group.count : 0), 0),
      noSecretsExposed: true
    })
  };
}

function buildOverview(
  source: DashboardReadModelSource,
  tasks: TaskRunSummaryReadModel,
  git: GitIntegrationReadModel,
  conflicts: ConflictManagerReadModel,
  registry: RegistryReadModel,
  llm: LLMGatewayReadModel,
  agents: AgentRunnerReadModel,
  policy: PolicyReadModel,
  providers: EnterpriseProviderReadModel,
  security: SecurityReadModel,
  localAgents: LocalAgentReadModel,
  audit: AuditSummaryReadModel
): DashboardOverviewReadModel {
  const totalTasks = tasks.tasks.length;
  const runningTasks = tasks.tasks.filter((task) => task.status === "running").length;
  const conflictTasks = tasks.tasks.filter((task) => task.status === "conflict_detected" || task.status === "review_required").length;
  const completedTasks = tasks.tasks.filter((task) => task.status === "completed").length;
  const mockCostUsd = tasks.usageEvents.reduce((total, event) => total + (typeof event.costUsd === "number" ? event.costUsd : 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    source,
    status: "available",
    metrics: sanitizeDashboardObject({
      totalTasks,
      runningTasks,
      conflictTasks,
      completedTasks,
      mockCostUsd,
      activeSkills: registry.summary.activeSkills ?? 0,
      activeHarnesses: registry.summary.activeHarnesses ?? 0,
      activeInstructions: registry.summary.activeInstructions ?? 0,
      gitRepos: git.repos.length,
      gitPullRequests: git.pullRequests.length,
      llmModels: llm.models.length,
      llmUsageEvents: llm.usageEvents.length,
      agentRuns: agents.runs.length,
      policyRules: policy.rules.length,
      providerCatalogEntries: providers.catalog.length,
      securityAuditEvents: security.auditEvents.length,
      localAgents: localAgents.registrations.length,
      pendingConsentRequests: localAgents.consentQueue.length,
      auditEvents: audit.summary.totalEvents ?? 0
    }),
    sections: {
      tasks: { status: statusForCount(tasks.tasks.length), count: tasks.tasks.length, notes: tasks.warnings },
      git: { status: "available", count: git.repos.length, notes: ["Remote Git gates remain explicit and token-free."] },
      conflicts: { status: statusForCount(conflicts.mergeQueue.length + conflicts.branchLeases.length), count: conflicts.mergeQueue.length, notes: [] },
      registry: { status: "available", count: registry.skills.length + registry.harnesses.length + registry.instructions.length, notes: [] },
      llm: { status: "available", count: llm.models.length, notes: ["Remote LLM calls remain disabled in v0."] },
      agents: { status: "available", count: agents.runs.length, notes: ["Runner command execution remains gated."] },
      policy: { status: "available", count: policy.rules.length, notes: [] },
      providers: { status: "available", count: providers.catalog.length, notes: ["Provider adapters remain skeleton/mock-first."] },
      security: { status: "available", count: security.auditEvents.length, notes: ["Secrets are metadata-only."] },
      localAgents: { status: "available", count: localAgents.registrations.length, notes: ["Protocol is mock/fixture-only."] },
      audit: { status: "available", count: typeof audit.summary.totalEvents === "number" ? audit.summary.totalEvents : 0, notes: [] }
    },
    safety: {
      remoteGitEnabled: git.config.remoteGitEnabled === true,
      remoteBranchCreateEnabled: git.config.remoteBranchCreateEnabled === true,
      remotePullRequestCreateEnabled: git.config.remotePullRequestCreateEnabled === true,
      remoteMergeEnabled: false,
      remoteLlmEnabled: llm.config.remoteLlmEnabled === true,
      remoteLlmCompletionEnabled: llm.config.remoteCompletionEnabled === true,
      localRunnerEnabled: agents.config.localRunnerEnabled === true,
      localCommandExecutionEnabled: agents.config.localCommandExecutionEnabled === true,
      realTransportEnabled: false,
      vendorCliExecutionEnabled: false,
      credentialCacheAccessAllowed: false,
      productionSecretInjection: false,
      noSecretsExposed: true
    },
    warnings: unique([
      ...tasks.warnings,
      "Dashboard read models are read-only and do not execute workflows or provider calls."
    ])
  };
}

export function buildDashboardReadModels(context: DashboardReadModelContext, source: DashboardReadModelSource = "api"): DashboardReadModels {
  const tasks = buildTasks(context);
  const git = buildGit(context);
  const conflicts = buildConflicts(context);
  const registry = buildRegistry(context);
  const llm = buildLlm(context);
  const agents = buildAgents(context);
  const policy = buildPolicy(context);
  const providers = buildProviders(context);
  const security = buildSecurity(context);
  const localAgents = buildLocalAgents(context);
  const audit = buildAudit(context);
  const overview = buildOverview(source, tasks, git, conflicts, registry, llm, agents, policy, providers, security, localAgents, audit);

  return {
    overview,
    tasks,
    git,
    conflicts,
    registry,
    llm,
    agents,
    policy,
    providers,
    security,
    localAgents,
    audit
  };
}
