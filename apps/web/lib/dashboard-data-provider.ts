import {
  dashboardReadModelEndpoints,
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

export type DashboardDataProvider = {
  getReadModels(): Promise<DashboardReadModels>;
};

type DashboardFetchResponse = {
  ok: boolean;
  status: number;
  text(): Promise<string>;
};

type DashboardFetch = (input: string | URL, init?: { method?: string; headers?: Record<string, string> }) => Promise<DashboardFetchResponse>;

type ApiDashboardDataProviderOptions = {
  baseUrl: string;
  fetchImpl?: DashboardFetch;
  fallbackProvider?: DashboardDataProvider;
  warnOnFallback?: boolean;
};

function numeric(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function arrayValue(value: unknown): DashboardJsonObject[] {
  return sanitizeDashboardArray(Array.isArray(value) ? value : []);
}

function objectValue(value: unknown): DashboardJsonObject {
  return sanitizeDashboardObject(value);
}

function sourceOverview(source: DashboardReadModelSource, sections: DashboardReadModels): DashboardOverviewReadModel {
  const totalTasks = sections.tasks.tasks.length;
  const runningTasks = sections.tasks.tasks.filter((task) => task.status === "running").length;
  const conflictTasks = sections.tasks.tasks.filter((task) => task.status === "conflict_detected" || task.status === "review_required").length;
  const completedTasks = sections.tasks.tasks.filter((task) => task.status === "completed").length;
  const mockCostUsd = sections.tasks.usageEvents.reduce((total, event) => total + numeric(event.costUsd), 0);

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
      activeSkills: numeric(sections.registry.summary.activeSkills),
      activeHarnesses: numeric(sections.registry.summary.activeHarnesses),
      activeInstructions: numeric(sections.registry.summary.activeInstructions),
      gitRepos: sections.git.repos.length,
      gitPullRequests: sections.git.pullRequests.length,
      llmModels: sections.llm.models.length,
      llmUsageEvents: sections.llm.usageEvents.length,
      agentRuns: sections.agents.runs.length,
      policyRules: sections.policy.rules.length,
      providerCatalogEntries: sections.providers.catalog.length,
      securityAuditEvents: sections.security.auditEvents.length,
      localAgents: sections.localAgents.registrations.length,
      pendingConsentRequests: sections.localAgents.consentQueue.length,
      auditEvents: numeric(sections.audit.summary.totalEvents)
    }),
    sections: {
      tasks: { status: totalTasks > 0 ? "available" : "empty", count: totalTasks, notes: sections.tasks.warnings },
      git: { status: "available", count: sections.git.repos.length, notes: ["Remote Git gates remain explicit and token-free."] },
      conflicts: { status: sections.conflicts.branchLeases.length > 0 ? "available" : "empty", count: sections.conflicts.mergeQueue.length, notes: [] },
      registry: { status: "available", count: sections.registry.skills.length + sections.registry.harnesses.length + sections.registry.instructions.length, notes: [] },
      llm: { status: "available", count: sections.llm.models.length, notes: ["Remote LLM calls require explicit v1 gates and API key remains hidden."] },
      agents: { status: "available", count: sections.agents.runs.length, notes: ["Runner command execution remains gated."] },
      policy: { status: "available", count: sections.policy.rules.length, notes: [] },
      providers: { status: "available", count: sections.providers.catalog.length, notes: ["Provider adapters remain skeleton/mock-first."] },
      security: { status: "available", count: sections.security.auditEvents.length, notes: ["Secrets are metadata-only."] },
      localAgents: { status: "available", count: sections.localAgents.registrations.length, notes: ["Protocol is mock/fixture-only."] },
      audit: { status: "available", count: numeric(sections.audit.summary.totalEvents), notes: [] }
    },
    safety: {
      remoteGitEnabled: sections.git.config.remoteGitEnabled === true,
      remoteBranchCreateEnabled: sections.git.config.remoteBranchCreateEnabled === true,
      remotePullRequestCreateEnabled: sections.git.config.remotePullRequestCreateEnabled === true,
      remoteMergeEnabled: false,
      remoteLlmEnabled: sections.llm.config.remoteLlmEnabled === true,
      remoteLlmCompletionEnabled: sections.llm.config.remoteCompletionEnabled === true,
      localRunnerEnabled: sections.agents.config.localRunnerEnabled === true,
      localCommandExecutionEnabled: sections.agents.config.localCommandExecutionEnabled === true,
      realTransportEnabled: false,
      vendorCliExecutionEnabled: false,
      credentialCacheAccessAllowed: false,
      productionSecretInjection: false,
      noSecretsExposed: true
    },
    warnings: [
      ...sections.tasks.warnings,
      "Dashboard read models are read-only and do not execute workflows or provider calls."
    ]
  };
}

export function dashboardReadModelsFromLegacyData(data: Record<string, unknown>, source: DashboardReadModelSource = "demo"): DashboardReadModels {
  const taskRuns = arrayValue(data.taskRuns);
  const tasks: TaskRunSummaryReadModel = {
    tasks: arrayValue(data.tasks),
    taskRuns,
    recentTasks: arrayValue(data.tasks).map((task) => {
      const latestRun = taskRuns.filter((run) => run.taskId === task.id).at(-1);
      return sanitizeDashboardObject({
        id: task.id,
        title: task.title,
        status: task.status,
        selectedAgent: task.selectedAgent,
        selectedModel: task.selectedModel,
        branchName: task.branchName,
        conflictRiskScore: task.conflictRiskScore,
        latestRunId: latestRun?.id,
        latestRunStatus: latestRun?.status,
        latestRunSummary: latestRun?.resultSummary
      });
    }),
    usageEvents: arrayValue(data.llmUsageEvents),
    warnings: []
  };

  const git: GitIntegrationReadModel = {
    config: objectValue(data.gitProviderConfig),
    providers: arrayValue(data.gitProviders),
    repos: arrayValue(data.gitRepos),
    branchRecords: arrayValue(data.gitBranches),
    pullRequests: arrayValue(data.gitPullRequests),
    changedFiles: arrayValue(data.gitChangedFiles),
    mergeQueueLinkage: arrayValue(data.gitMergeQueueLinkage),
    auditEvents: arrayValue(data.gitAuditEvents),
    remoteAuditEvents: arrayValue(data.gitRemoteAuditEvents),
    blockedExamples: sanitizeDashboardArray([
      data.remoteBlockedOperation,
      data.remoteBranchBlockedOperation,
      { operation: "github_merge", reason: "remote_merge_unsupported" }
    ]),
    safety: sanitizeDashboardObject({
      ...objectValue(data.gitProviderConfig),
      remoteMergeEnabled: false,
      tokenExposed: false
    })
  };

  const conflicts: ConflictManagerReadModel = {
    branchLeases: arrayValue(data.activeLeases),
    conflictRisks: arrayValue(data.conflictRisks),
    mergeQueue: arrayValue(data.mergeQueue),
    mergeSimulations: arrayValue(data.mergeSimulations),
    summary: sanitizeDashboardObject({
      activeLeases: Array.isArray(data.activeLeases) ? data.activeLeases.length : 0,
      conflictRisks: Array.isArray(data.conflictRisks) ? data.conflictRisks.length : 0,
      mergeQueueEntries: Array.isArray(data.mergeQueue) ? data.mergeQueue.length : 0,
      dryRunSimulations: Array.isArray(data.mergeSimulations) ? data.mergeSimulations.length : 0
    })
  };

  const registry: RegistryReadModel = {
    summary: sanitizeDashboardObject({
      ...objectValue(data.registryOverview),
      approvalQueueItems: Array.isArray(data.registryApprovalQueue) ? data.registryApprovalQueue.length : 0,
      packageManifests: Array.isArray(data.registryPackages) ? data.registryPackages.length : 0,
      improvementProposals: Array.isArray(data.improvementProposals) ? data.improvementProposals.length : 0,
      draftRegistryChanges: Array.isArray(data.draftRegistryChanges) ? data.draftRegistryChanges.length : 0,
      autoApplyEnabled: false
    }),
    skills: arrayValue(data.skills),
    harnesses: arrayValue(data.harnesses),
    instructions: arrayValue(data.instructions),
    approvalQueue: arrayValue(data.registryApprovalQueue),
    packages: arrayValue(data.registryPackages),
    auditLogs: arrayValue(data.registryAuditLogs),
    revisions: arrayValue(data.registryRevisions),
    evalResults: arrayValue(data.registryEvalResults),
    governance: sanitizeDashboardObject({
      failureSignals: data.improvementFailureSignals,
      failureClusters: data.improvementFailureClusters,
      improvementCandidates: data.improvementCandidates,
      improvementProposals: data.improvementProposals,
      autoImprovementAnalyses: data.autoImprovementAnalyses,
      draftRegistryChanges: data.draftRegistryChanges,
      proposalReviewQueue: data.proposalReviewQueue,
      governanceDecisions: data.governanceDecisions,
      evalRequirements: data.evalRequirements,
      proposalEvalRuns: data.proposalEvalRuns,
      canaryRolloutPlans: data.canaryRolloutPlans,
      safetyPolicies: data.autoImprovementSafetyPolicies,
      proposalReadiness: data.proposalReadiness,
      canaryReadiness: data.canaryReadiness,
      proposalApplyGates: data.proposalApplyGates,
      governanceAuditEvents: data.governanceAuditEvents
    })
  };

  const llm: LLMGatewayReadModel = {
    config: objectValue(data.llmProviderConfig),
    providers: arrayValue(data.llmProviders),
    models: arrayValue(data.llmModels),
    virtualKeys: arrayValue(data.virtualModelKeys),
    usageEvents: arrayValue(data.llmUsageEvents),
    auditEvents: arrayValue(data.llmAuditEvents),
    blockedExamples: sanitizeDashboardArray([data.remoteLlmBlockedOperation]),
    budget: sanitizeDashboardObject({
      budgetDecision: objectValue((data.llmCompletion as Record<string, unknown> | undefined)?.budgetDecision),
      usageLedgerLinked: true,
      remoteProviderPath: "openai_compatible",
      selectedModel: objectValue(data.llmProviderConfig).defaultModel ?? "openai-compatible/default",
      allowedModels: objectValue(data.llmProviderConfig).allowedModels ?? [],
      apiKeyConfigured: objectValue(data.llmProviderConfig).apiKeyConfigured === true,
      apiKeyExposed: false
    })
  };

  const agents: AgentRunnerReadModel = {
    config: objectValue(data.agentRunnerConfig),
    runners: arrayValue(data.agentRunners),
    executors: arrayValue(data.agentExecutors),
    runs: arrayValue(data.agentRuns),
    auditEvents: arrayValue(data.agentRunAuditEvents),
    instructionAssemblies: arrayValue(data.agentInstructionAssemblies),
    commandResults: arrayValue(data.agentCommandResults),
    workspaces: arrayValue(data.agentWorkspaces),
    blockedExamples: sanitizeDashboardArray([data.blockedCommandExample, data.localRunnerBlockedExample])
  };

  const policy: PolicyReadModel = {
    config: objectValue(data.policyConfig),
    rules: arrayValue(data.policyRules),
    auditEntries: arrayValue(data.policyAuditEntries),
    blockedExamples: arrayValue(data.policyDecisions).filter((decision) => decision.allowed !== true)
  };

  const providers: EnterpriseProviderReadModel = {
    config: objectValue(data.providerAbstractionConfig),
    catalog: arrayValue(data.providerCatalog),
    authTypes: Array.isArray(data.providerAuthTypes) ? data.providerAuthTypes.filter((item): item is string => typeof item === "string") : [],
    localCliTemplates: arrayValue(data.providerLocalCliTemplates),
    localAgents: arrayValue(data.providerLocalAgents),
    auditEvents: arrayValue(data.providerAuditEvents),
    readiness: sanitizeDashboardObject({
      localCliProviderReadiness: (data.providerInvocation as Record<string, unknown> | undefined)?.status ?? "local_agent_required",
      credentialCacheAccess: "denied",
      directLocalCliExecution: "blocked"
    }),
    blockedExamples: sanitizeDashboardArray([data.providerInvocation])
  };

  const security: SecurityReadModel = {
    config: objectValue(data.securityConfig),
    secretRefs: arrayValue(data.secretRefs),
    secretScopes: arrayValue(data.secretScopes),
    secretLeases: arrayValue(data.secretLeases),
    sandboxProfiles: arrayValue(data.sandboxProfiles),
    sandboxSessions: arrayValue(data.sandboxSessions),
    networkPolicies: arrayValue(data.networkPolicies),
    redactionPolicies: arrayValue(data.redactionPolicies),
    auditEvents: arrayValue(data.securityAuditEvents),
    credentialAuditEvents: arrayValue(data.securityAuditEvents).filter((event) => typeof event.eventType === "string" && event.eventType.startsWith("credential_")),
    credentialStatus: sanitizeDashboardObject({
      credentialManagerKind: (data.securityConfig as Record<string, unknown> | undefined)?.credentialManagerKind ?? "secretref_env_v1",
      envSecretProviderEnabled: (data.securityConfig as Record<string, unknown> | undefined)?.envSecretProviderEnabled ?? false,
      github: (data.securityConfig as Record<string, unknown> | undefined)?.githubCredentialConfigured === true ? "configured" : "missing",
      llm: (data.securityConfig as Record<string, unknown> | undefined)?.llmCredentialConfigured === true ? "configured" : "missing",
      rawValuesExposed: false
    }),
    blockedExamples: sanitizeDashboardArray([data.secretLeaseRequest, { operation: "credential_cache_path", reason: "credential cache paths redacted" }]),
    redaction: sanitizeDashboardObject(data.redactionTest)
  };

  const localAgents: LocalAgentReadModel = {
    config: objectValue(data.localAgentProtocolConfig),
    registrations: arrayValue(data.localAgentRegistrations),
    sessions: [],
    channels: arrayValue(data.localAgentChannels),
    handshakes: arrayValue(data.localAgentHandshakes),
    capabilityAdvertisements: arrayValue(data.localAgentCapabilityAdvertisements),
    compatibilityEntries: arrayValue(data.localAgentCompatibilityEntries),
    compatibilityResults: arrayValue(data.localAgentCompatibilityResults),
    consentQueue: arrayValue(data.localAgentConsentRequests).filter((request) => request.status === "pending"),
    consentHistory: sanitizeDashboardObject({
      approved: [data.localAgentConsentDecision],
      denied: []
    }),
    invocations: arrayValue(data.localAgentInvocations),
    events: arrayValue(data.localAgentEvents),
    streams: sanitizeDashboardArray([data.localAgentStream]),
    streamEvents: arrayValue(data.localAgentStreamEvents),
    auditEvents: arrayValue(data.localAgentAuditEvents),
    blockedExamples: sanitizeDashboardArray([
      { operation: "real_transport", reason: "real_transport_disabled" },
      { operation: "vendor_cli_execution", reason: "vendor_cli_execution_disabled" },
      { operation: "credential_cache_access", reason: "credential_cache_access_denied" },
      { operation: "danger_full_access", reason: "danger_full_access_denied" }
    ])
  };

  const audit: AuditSummaryReadModel = {
    auditGroups: sanitizeDashboardArray([
      { source: "registry", count: registry.auditLogs.length, recentEvents: registry.auditLogs.slice(-5) },
      { source: "git", count: git.auditEvents.length, recentEvents: git.auditEvents.slice(-5) },
      { source: "llm", count: llm.auditEvents.length, recentEvents: llm.auditEvents.slice(-5) },
      { source: "agent_runner", count: agents.auditEvents.length, recentEvents: agents.auditEvents.slice(-5) },
      { source: "policy", count: policy.auditEntries.length, recentEvents: policy.auditEntries.slice(-5) },
      { source: "security", count: security.auditEvents.length, recentEvents: security.auditEvents.slice(-5) },
      { source: "enterprise_provider", count: providers.auditEvents.length, recentEvents: providers.auditEvents.slice(-5) },
      { source: "local_agent_protocol", count: localAgents.auditEvents.length, recentEvents: localAgents.auditEvents.slice(-5) }
    ]),
    recentEvents: sanitizeDashboardArray([
      ...git.auditEvents.slice(-3),
      ...llm.auditEvents.slice(-3),
      ...security.auditEvents.slice(-3),
      ...localAgents.auditEvents.slice(-3)
    ]),
    summary: sanitizeDashboardObject({
      groupCount: 8,
      totalEvents: git.auditEvents.length + llm.auditEvents.length + agents.auditEvents.length + policy.auditEntries.length + security.auditEvents.length + providers.auditEvents.length + localAgents.auditEvents.length + registry.auditLogs.length,
      noSecretsExposed: true
    })
  };

  const sections = {
    overview: {} as DashboardOverviewReadModel,
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
  const overview = sourceOverview(source, sections);

  return {
    ...sections,
    overview
  };
}

export class DemoDashboardDataProvider implements DashboardDataProvider {
  async getReadModels(): Promise<DashboardReadModels> {
    const { getDashboardData } = await import("./mock-data.ts");
    return dashboardReadModelsFromLegacyData(await getDashboardData() as Record<string, unknown>, "demo");
  }
}

export class ApiDashboardDataProvider implements DashboardDataProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: DashboardFetch;
  private readonly fallbackProvider?: DashboardDataProvider;
  private readonly warnOnFallback: boolean;

  constructor(options: ApiDashboardDataProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    const fetchImpl = options.fetchImpl ?? globalThis.fetch as DashboardFetch | undefined;
    if (!fetchImpl) {
      throw new Error("ApiDashboardDataProvider requires a fetch implementation.");
    }
    this.fetchImpl = fetchImpl;
    this.fallbackProvider = options.fallbackProvider;
    this.warnOnFallback = options.warnOnFallback ?? true;
  }

  async getReadModels(): Promise<DashboardReadModels> {
    try {
      const [
        overviewResponse,
        tasksResponse,
        gitResponse,
        conflictsResponse,
        registryResponse,
        llmResponse,
        agentsResponse,
        policyResponse,
        providersResponse,
        securityResponse,
        localAgentsResponse,
        auditResponse
      ] = await Promise.all(dashboardReadModelEndpoints.map((endpoint) => this.getJson(endpoint)));

      return {
        overview: objectValue((overviewResponse as Record<string, unknown>).overview) as unknown as DashboardOverviewReadModel,
        tasks: objectValue((tasksResponse as Record<string, unknown>).tasks) as unknown as TaskRunSummaryReadModel,
        git: objectValue((gitResponse as Record<string, unknown>).git) as unknown as GitIntegrationReadModel,
        conflicts: objectValue((conflictsResponse as Record<string, unknown>).conflicts) as unknown as ConflictManagerReadModel,
        registry: objectValue((registryResponse as Record<string, unknown>).registry) as unknown as RegistryReadModel,
        llm: objectValue((llmResponse as Record<string, unknown>).llm) as unknown as LLMGatewayReadModel,
        agents: objectValue((agentsResponse as Record<string, unknown>).agents) as unknown as AgentRunnerReadModel,
        policy: objectValue((policyResponse as Record<string, unknown>).policy) as unknown as PolicyReadModel,
        providers: objectValue((providersResponse as Record<string, unknown>).providers) as unknown as EnterpriseProviderReadModel,
        security: objectValue((securityResponse as Record<string, unknown>).security) as unknown as SecurityReadModel,
        localAgents: objectValue((localAgentsResponse as Record<string, unknown>).localAgents) as unknown as LocalAgentReadModel,
        audit: objectValue((auditResponse as Record<string, unknown>).audit) as unknown as AuditSummaryReadModel
      };
    } catch (error) {
      if (this.fallbackProvider) {
        if (this.warnOnFallback) {
          console.warn(`Dashboard API unavailable; using explicit demo fallback: ${error instanceof Error ? error.message : String(error)}`);
        }
        return this.fallbackProvider.getReadModels();
      }
      throw error;
    }
  }

  private async getJson(endpoint: string): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers: { accept: "application/json" }
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Dashboard API ${endpoint} failed with ${response.status}: ${text.slice(0, 160)}`);
    }
    return JSON.parse(text);
  }
}

export function createDashboardDataProviderFromEnv(env: Record<string, string | undefined> = process.env): DashboardDataProvider {
  const source = env.AICHESTRA_DASHBOARD_DATA_SOURCE ?? "api";
  const apiBaseUrl = env.AICHESTRA_DASHBOARD_API_BASE_URL ?? env.AICHESTRA_API_BASE_URL;
  if (source === "demo") {
    return new DemoDashboardDataProvider();
  }
  if (source === "api" || apiBaseUrl) {
    const enableDemoFallback = env.AICHESTRA_DASHBOARD_ENABLE_DEMO_FALLBACK === "true" ||
      env.AICHESTRA_DASHBOARD_DISABLE_DEMO_FALLBACK === "false";
    return new ApiDashboardDataProvider({
      baseUrl: apiBaseUrl ?? "http://127.0.0.1:3000",
      fallbackProvider: enableDemoFallback ? new DemoDashboardDataProvider() : undefined
    });
  }
  throw new Error(`Unsupported AICHESTRA_DASHBOARD_DATA_SOURCE: ${source}`);
}

export async function getDashboardReadModels(provider: DashboardDataProvider = createDashboardDataProviderFromEnv()): Promise<DashboardReadModels> {
  return provider.getReadModels();
}
