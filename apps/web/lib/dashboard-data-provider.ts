import {
  dashboardReadModelEndpoints,
  sanitizeDashboardArray,
  sanitizeDashboardObject,
  type AgentRunnerReadModel,
  type AuthRbacProductionReadinessReadModel,
  type AuthReadModel,
  type AuditSummaryReadModel,
  type BranchCleanupReadModel,
  type RegistryCompatibilityReadModel,
  type CICDPipelineReadModel,
  type ConflictManagerReadModel,
  type DashboardJsonObject,
  type DashboardOverviewReadModel,
  type DashboardPanelScopeSummary,
  type DashboardReadModels,
  type DashboardReadModelSource,
  type DashboardScopeFilterReadModel,
  type DashboardTenantScopePlanningReadModel,
  type DatabaseOperationsReadModel,
  type DeploymentReadinessReadModel,
  type DurableCollaborationStoresReadModel,
  type EnterpriseProviderReadModel,
  type GitHubAppHardeningReadModel,
  type GitHubAppIntegrationTestReadModel,
  type GitIntegrationReadModel,
  type LLMGatewayReadModel,
  type LLMIntegrationTestReadModel,
  type LocalAgentReadModel,
  type MCPGatewayReadModel,
  type ObservabilityReadModel,
  type PolicyBundleReadinessReadModel,
  type PolicyReadModel,
  type PolicyShadowEvaluationReadModel,
  type ProductionAuthProviderSkeletonReadModel,
  type ReadinessEndpointScopeSummary,
  type PolicyRuntimePocReadinessReadModel,
  type RegistryReadModel,
  type RegistryDriftReadModel,
  type RegistryCanaryApplyReadModel,
  type ScopedReadModelMetadata,
  type SecurityReadModel,
  type ScopeReadinessReadModel,
  type SecretBackendDecisionReadModel,
  type SecretBackendMigrationReadModel,
  type StagingDeploymentDryRunReadModel,
  type StagingDeploymentExecutionReadModel,
  type StagingDeploymentReadModel,
  type StagingReleaseCandidateReadModel,
  type TaskRunSummaryReadModel,
  type TenantScopeEnforcementReadModel,
  type VaultIntegrationTestReadModel,
  type MergeQueueIntegrationTestReadModel,
  type VaultSecretBackendReadModel
} from "@aichestra/shared";
import { createDashboardReadinessTenantScopePlanningService, createDashboardScopeFilteringService } from "@aichestra/deployment-readiness";
import { createTenantScopeEnforcementService } from "@aichestra/auth";
import { createDisabledPolicyShadowEvaluator, policyShadowEvaluatorMismatchTypes, runPolicyShadowGoldenMockReport } from "@aichestra/policy";

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

function nestedCount(value: unknown, key: string): number {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return 0;
  const child = (value as Record<string, unknown>)[key];
  return Array.isArray(child) ? child.length : 0;
}

function arrayValue(value: unknown): DashboardJsonObject[] {
  return sanitizeDashboardArray(Array.isArray(value) ? value : []);
}

function objectValue(value: unknown): DashboardJsonObject {
  return sanitizeDashboardObject(value);
}

function fallbackScopeMetadata(surfaceId: string): ScopedReadModelMetadata {
  return {
    scopeStatus: "metadata_only",
    appliedScopes: [],
    requiredScopes: [],
    missingScopes: [],
    sensitivity: "internal_metadata",
    roleVisibility: sanitizeDashboardObject({ allowedRoles: ["platform_admin"], hint: "No explicit tenant scope plan was found for this surface." }),
    redactionStatus: "metadata_only",
    tenantFilteringImplemented: false,
    productionEnforcementImplemented: false,
    warnings: ["scope_plan_not_found", "tenant_filtering_implemented:false", "production_tenant_enforcement:false"],
    metadata: sanitizeDashboardObject({
      surfaceId,
      planningOnly: true,
      noSecretsOrEnvValues: true,
      productionReady: false
    })
  };
}

function withDemoEnforcementMetadata(
  scopeMetadata: ScopedReadModelMetadata,
  tenantScopeEnforcementService: ReturnType<typeof createTenantScopeEnforcementService>,
  panelScope: DashboardPanelScopeSummary | undefined,
  panelId: string
): ScopedReadModelMetadata {
  const decision = panelScope
    ? tenantScopeEnforcementService.evaluateDashboardPanelAccess(undefined, panelScope, { source: `dashboard:${panelId}` })
    : tenantScopeEnforcementService.evaluateScopeAccess(undefined, undefined, { source: `dashboard:${panelId}` });
  const decisionSummary = tenantScopeEnforcementService.summarizeDecision(decision);
  return sanitizeDashboardObject({
    ...scopeMetadata,
    tenantScopeEnforcementImplemented: "partial",
    enforcementMode: decision.enforcementMode,
    scopeDecisionSummary: decisionSummary,
    warnings: [
      ...new Set([
        ...scopeMetadata.warnings,
        ...decisionSummary.warnings
      ])
    ],
    metadata: {
      ...scopeMetadata.metadata,
      tenantScopeEnforcementStatus: "v1_implemented_partial",
      representativeEnforcementOnly: true,
      productionTenantEnforcement: false
    }
  }) as unknown as ScopedReadModelMetadata;
}

function withScopeMetadata<T extends object>(
  readModel: T,
  scopeMetadata: unknown
): T & { scopeMetadata: ScopedReadModelMetadata } {
  return {
    ...readModel,
    scopeMetadata: sanitizeDashboardObject(scopeMetadata) as unknown as ScopedReadModelMetadata
  };
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
      branchOrchestratorOwnershipRecords: sections.git.branchOwnershipRecords.length,
      prOwnershipRecords: sections.git.prOwnershipRecords.length,
      prHandoffRequests: sections.git.prHandoffRequests.length,
      branchOrchestratorBlockedCollisions: numeric(sections.git.branchOrchestratorSummary.blockedCollisions),
      branchOrchestratorSameWorkspaceBlockers: numeric(sections.git.branchOrchestratorSummary.sameWorkspaceBlockers),
      conflictAssistantRequests: sections.conflicts.conflictResolutionRequests.length,
      conflictAssistantPlans: sections.conflicts.conflictResolutionPlans.length,
      realMergeExecutionDecisions: sections.conflicts.realMergeExecutionDecisions.length,
      realMergeForbiddenOperations: sections.conflicts.realMergeForbiddenOperations.length,
      githubAppReadinessBlockers: sections.githubApp.blockers.length,
      githubAppPermissions: sections.githubApp.permissionMatrix.length,
      githubWebhookAllowlistedEvents: sections.githubApp.webhookEventAllowlist.length,
      githubAppIntegrationMissingGates: numeric(sections.githubAppIntegration.summary.missingGateCount),
      githubAppIntegrationUnsafeGates: numeric(sections.githubAppIntegration.summary.unsafeGateCount),
      githubAppIntegrationTestCases: sections.githubAppIntegration.testCases.length,
      llmModels: sections.llm.models.length,
      llmUsageEvents: sections.llm.usageEvents.length,
      llmIntegrationMissingGates: numeric(sections.llmIntegration.summary.missingGateCount),
      llmIntegrationUnsafeGates: numeric(sections.llmIntegration.summary.unsafeGateCount),
      llmIntegrationTestCases: sections.llmIntegration.testCases.length,
      agentRuns: sections.agents.runs.length,
      agentCoordinationSessions: sections.agents.coordinationSessions.length,
      agentCoordinationOverlaps: sections.agents.sessionOverlaps.length,
      agentCoordinationCriticalBlockers: numeric(sections.agents.coordinationSummary.criticalBlockers),
      policyRules: sections.policy.rules.length,
      policyBundleReadinessBlockers: sections.policyBundles.blockers.length,
      policyBundleDomainsMapped: sections.policyBundles.domainMappings.filter((mapping) => mapping.migrationStatus === "mapped").length,
      policyEngineOptions: sections.policyBundles.engineOptions.length,
      policyRuntimePocOptions: sections.policyRuntimePoc.options.length,
      policyRuntimePocDomainMappings: sections.policyRuntimePoc.domainMappings.length,
      policyRuntimePocGoldenCases: sections.policyRuntimePoc.goldenCases.length,
      policyRuntimeGoldenHarnessCases: numeric(sections.policyRuntimePoc.goldenHarness.totalCases),
      policyRuntimeGoldenHarnessFailures: numeric(sections.policyRuntimePoc.goldenHarness.failedCases),
      policyShadowComparisonRules: sections.policyRuntimePoc.shadowComparisonRules.length,
      policyShadowMismatchKinds: sections.policyRuntimePoc.shadowMismatchTaxonomy.length,
      policyShadowCriticalMismatchKinds: sections.policyRuntimePoc.shadowMismatchTaxonomy.filter((mismatch) => mismatch.severity === "critical").length,
      authRoles: sections.auth.roles.length,
      authActors: sections.auth.actors.length,
      authProductionReadinessBlockers: sections.authProduction.blockers.length,
      authProviderOptions: sections.authProduction.providerOptions.length,
      productionAuthProviderConfigs: sections.authProviders.configs.length,
      productionAuthProviderBlockers: sections.authProviders.blockers.length,
      authServiceAccountPlans: sections.authProduction.serviceAccountPlans.length,
      providerCatalogEntries: sections.providers.catalog.length,
      securityAuditEvents: sections.security.auditEvents.length,
      localAgents: sections.localAgents.registrations.length,
      mcpServers: sections.mcp.servers.length,
      mcpTools: sections.mcp.tools.length,
      scopeTenants: sections.scopes.tenants.length,
      scopeRepos: sections.scopes.repos.length,
      scopeProviders: sections.scopes.providers.length,
      scopeModels: sections.scopes.models.length,
      scopeSecrets: sections.scopes.secrets.length,
      tenantScopePlanningPanels: sections.tenantScopePlanning.dashboardPlans.length,
      tenantScopePlanningReadinessEndpoints: sections.tenantScopePlanning.readinessPlans.length,
      tenantScopePlanningProductionBlockers: numeric(sections.tenantScopePlanning.summary.productionBlockerCount),
      tenantScopePlanningSecretAdjacentSurfaces: numeric(sections.tenantScopePlanning.summary.secretAdjacentSurfaces),
      tenantScopeEnforcementModes: sections.tenantScopeEnforcement.modes.length,
      tenantScopeEnforcementMismatches: sections.tenantScopeEnforcement.mismatches.length,
      productionReadinessCriticalBlockers: numeric(sections.readiness.summary.criticalBlockerCount),
      productionReadinessHighRisks: numeric(sections.readiness.summary.highRiskOpenCount),
      databaseOperationsCriticalBlockers: numeric(sections.database.summary.criticalBlockerCount),
      databaseMigrationFiles: sections.database.migrations.length,
      databaseIndexReviewItems: sections.database.indexReview.length,
      durableCollaborationRepositoryGroups: sections.collaborationStores.repositories.length,
      durableCollaborationRequiredRecords: numeric(sections.collaborationStores.summary.requiredDurableRecordCount),
      durableCollaborationPostgresTables: numeric(sections.collaborationStores.schema.tableCount),
      secretBackendReadinessBlockers: sections.secretBackend.blockers.length,
      secretBackendOptions: sections.secretBackend.backendOptions.length,
      secretRotationPlans: sections.secretBackend.rotationPlans.length,
      secretBackendDecisionCriteria: sections.secretBackendDecision.criteria.length,
      secretBackendDecisionRisks: sections.secretBackendDecision.risks.length,
      vaultSecretBackendChecks: sections.vaultSecretBackend.checks.length,
      vaultSecretBackendAuditEvents: sections.vaultSecretBackend.auditEvents.length,
      vaultIntegrationMissingGates: numeric(sections.vaultIntegration.summary.missingGateCount),
      vaultIntegrationUnsafeGates: numeric(sections.vaultIntegration.summary.unsafeGateCount),
      vaultIntegrationTestCases: sections.vaultIntegration.testCases.length,
      stagingReadinessBlockers: sections.staging.blockers.length,
      stagingIntegrationGates: sections.staging.integrationGates.length,
      stagingPromotionCriteria: sections.staging.promotionCriteria.length,
      stagingDryRunBlockers: sections.stagingDryRun.blockers.length,
      stagingDryRunCriticalBlockers: sections.stagingDryRun.criticalBlockers.length,
      stagingDryRunSkippedIntegrations: sections.stagingDryRun.skippedIntegrationProfiles.length,
      stagingRcBlockers: sections.stagingReleaseCandidate.blockers.length,
      stagingRcCriticalBlockers: sections.stagingReleaseCandidate.criticalBlockers.length,
      stagingRcPendingSignoffs: sections.stagingReleaseCandidate.pendingSignoffs.length,
      stagingRcSkippedTests: sections.stagingReleaseCandidate.skippedTests.length,
      stagingExecutionBlockers: sections.stagingExecution.blockers.length,
      stagingExecutionPendingSignoffs: sections.stagingExecution.pendingSignoffs.length,
      stagingExecutionGoNoGoStatus: sections.stagingExecution.goNoGoDecision.status ?? "not_ready",
      cicdReadinessBlockers: sections.cicd.blockers.length,
      cicdJobs: sections.cicd.jobs.length,
      cicdIntegrationGates: sections.cicd.integrationGates.length,
      pendingConsentRequests: sections.localAgents.consentQueue.length,
      normalizedAuditEvents: numeric(sections.observability.auditSummary.totalEvents),
      auditSourcesCovered: sections.observability.sourceCoverage.filter((source) => source.normalized === "yes").length,
      observabilityTraceSpans: sections.observability.traceSpans.length,
      observabilityExportFutureBackends: sections.observability.futureBackends.length,
      observabilityExportFailedSafetyChecks: numeric(sections.observability.exportReadinessSummary.failedSafetyCheckCount),
      auditEvents: numeric(sections.audit.summary.totalEvents)
    }),
    sections: {
      tasks: { status: totalTasks > 0 ? "available" : "empty", count: totalTasks, notes: sections.tasks.warnings },
      git: { status: "available", count: sections.git.repos.length, notes: ["Remote Git gates remain explicit and token-free; branch orchestration is metadata-only."] },
      githubApp: { status: "available", count: sections.githubApp.blockers.length, notes: ["GitHub App and production webhook hardening are planning-only; no live App or token exchange is implemented."] },
      githubAppIntegration: { status: "available", count: sections.githubAppIntegration.testCases.length, notes: ["GitHub App integration-test profile v1 is skipped by default and never exposes private keys, installation tokens, or env values."] },
      conflicts: { status: sections.conflicts.branchLeases.length > 0 ? "available" : "empty", count: sections.conflicts.mergeQueue.length, notes: [] },
      registry: { status: "available", count: sections.registry.skills.length + sections.registry.harnesses.length + sections.registry.instructions.length, notes: [] },
      llm: { status: "available", count: sections.llm.models.length, notes: ["Remote LLM calls require explicit v1 gates and API key remains hidden."] },
      llmIntegration: { status: "available", count: sections.llmIntegration.testCases.length, notes: ["LLM Gateway integration-test profile v1 is skipped by default and never exposes API keys, env values, or raw provider responses."] },
      agents: { status: "available", count: sections.agents.runs.length, notes: ["Runner command execution remains gated; session coordination is metadata-only and mock-first."] },
      policy: { status: "available", count: sections.policy.rules.length, notes: [] },
      policyBundles: { status: "available", count: sections.policyBundles.blockers.length, notes: ["Policy Bundle / OPA-Cedar v0 is planning-only; StaticPolicyEngine remains the runtime and no external policy engine is enabled."] },
      policyRuntimePoc: { status: "available", count: sections.policyRuntimePoc.blockers.length, notes: ["Policy Bundle Runtime PoC Planning v0 and Shadow Evaluation Planning v1 are planning-only; StaticPolicyEngine remains source of truth and no runtime evaluator is implemented.", "Policy Runtime PoC Golden Test Harness v1 runs offline deterministic StaticPolicyEngine comparisons only."] },
      auth: { status: "available", count: sections.auth.actors.length, notes: ["Mock auth is not production authentication."] },
      authProduction: { status: "available", count: sections.authProduction.blockers.length, notes: ["Production Auth/RBAC v1 is planning-only; no real IdP, login, session, JWT, or cookie flow is implemented."] },
      authProviders: { status: "available", count: sections.authProviders.configs.length, notes: ["Production Auth Provider Skeleton v1 is disabled-by-default; MockAuthProvider remains active and no token/session validation is running."] },
      providers: { status: "available", count: sections.providers.catalog.length, notes: ["Provider adapters remain skeleton/mock-first."] },
      security: { status: "available", count: sections.security.auditEvents.length, notes: ["Secrets are metadata-only."] },
      localAgents: { status: "available", count: sections.localAgents.registrations.length, notes: ["Protocol is mock/fixture-only."] },
      mcp: { status: "available", count: sections.mcp.tools.length, notes: ["MCP Gateway v0 is mock-first; real transport is disabled."] },
      scopes: { status: "available", count: sections.scopes.tenants.length + sections.scopes.repos.length + sections.scopes.providers.length, notes: ["Tenant/repo/provider scopes are metadata/readiness-only; enforcement and dashboard filtering remain future."] },
      tenantScopePlanning: { status: "available", count: sections.tenantScopePlanning.dashboardPlans.length + sections.tenantScopePlanning.readinessPlans.length, notes: ["Dashboard/Readiness Tenant Scope Planning v1 is planning-only; tenant filtering and production enforcement remain false."] },
      tenantScopeEnforcement: { status: "available", count: sections.tenantScopeEnforcement.modes.length, notes: ["Tenant Scope Enforcement v1 is partial/representative metadata; tenant filtering and production enforcement remain false."] },
      readiness: { status: "available", count: sections.readiness.productionBlockers.length, notes: ["Production deployment readiness is planning-only and currently blocked."] },
      database: { status: "available", count: sections.database.blockers.length, notes: ["Persistent DB Production Operations v1 is read-only planning; no production DB connection or destructive job is run."] },
      collaborationStores: { status: "available", count: sections.collaborationStores.repositories.length, notes: ["Durable Collaboration Stores v1 exposes repository and schema metadata; default runtime remains in-memory and optional Postgres is gated."] },
      secretBackend: { status: "available", count: sections.secretBackend.blockers.length, notes: ["Secret Backend Migration v0 is planning/readiness-only; no real backend is contacted and env values are hidden."] },
      secretBackendDecision: { status: "available", count: sections.secretBackendDecision.risks.length, notes: ["Production Secret Backend Option Decision v0 selects Vault for v1 planning only; no backend is contacted and no secret values are read."] },
      vaultSecretBackend: { status: "available", count: sections.vaultSecretBackend.checks.length, notes: ["Vault Secret Backend v1 is gated and non-default; dashboard data is metadata-only and does not read Vault."] },
      vaultIntegration: { status: "available", count: sections.vaultIntegration.testCases.length, notes: ["Vault Integration-Test Profile v1 is skipped by default and never exposes tokens, secret values, raw paths, or env values."] },
      mergeQueueIntegration: { status: "available", count: sections.mergeQueueIntegration.testCases.length, notes: ["Merge Queue Live Integration-Test Profile v1 is skipped by default; no real merge, remote rebase, force-push, or branch deletion is executed and no env values, repo URLs, or branch names are exposed."] },
      staging: { status: "available", count: sections.staging.blockers.length, notes: ["Staging Deployment Profile v0 is non-production/readiness-only; no deployment, production traffic, or external provider call is enabled."] },
      stagingDryRun: { status: "available", count: sections.stagingDryRun.blockers.length, notes: ["Staging Deployment Dry-run Profile v0 aggregates readiness only; it does not deploy, call providers, or run integration tests."] },
      stagingReleaseCandidate: { status: "available", count: sections.stagingReleaseCandidate.blockers.length, notes: ["Staging Release Candidate Checklist v0 is read-only; it does not create releases, tags, GitHub releases, deployments, or run integration tests."] },
      stagingExecution: { status: "available", count: sections.stagingExecution.blockers.length, notes: ["Staging Deployment Execution Plan v0 is planning-only; it does not deploy, create releases or tags, call providers, or run integration tests."] },
      cicd: { status: "available", count: sections.cicd.blockers.length, notes: ["Staging CI/CD Pipeline Planning v0 is read-only; no active workflow, deployment, or default remote integration test is enabled."] },
      observability: { status: "available", count: numeric(sections.observability.auditSummary.totalEvents), notes: ["Observability v0 is in-memory/read-only. External Observability Export v1 is skeleton-only; external calls, raw-payload export, and secret export remain disabled."] },
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
      mcpRealTransportEnabled: false,
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
    webhookConfig: sanitizeDashboardObject({
      webhooksEnabled: false,
      webhookSecretConfigured: false,
      webhookSecretSource: "none",
      webhookSecretStatus: "missing",
      webhookAcceptUnverified: false,
      supportedWebhookEventCount: 7
    }),
    providers: arrayValue(data.gitProviders),
    repos: arrayValue(data.gitRepos),
    branchRecords: arrayValue(data.gitBranches),
    pullRequests: arrayValue(data.gitPullRequests),
    webhookEvents: [],
    webhookAuditEvents: [],
    pullRequestSyncStates: [],
    branchSyncStates: [],
    changedFiles: arrayValue(data.gitChangedFiles),
    changedFilesRefreshStatus: sanitizeDashboardObject({ lastResult: "none", refreshAuditEvents: 0 }),
    mergeQueueLinkage: arrayValue(data.gitMergeQueueLinkage),
    branchOrchestrationRequests: arrayValue(data.branchOrchestrationRequests),
    branchOrchestrationDecisions: arrayValue(data.branchOrchestrationDecisions),
    branchOwnershipRecords: arrayValue(data.branchOwnershipRecords),
    branchDriftStatuses: arrayValue(data.branchDriftStatuses),
    branchNamingPolicies: arrayValue(data.branchNamingPolicies),
    branchOrchestratorAuditEvents: arrayValue(data.branchOrchestratorAuditEvents),
    branchOrchestratorSummary: sanitizeDashboardObject(data.branchOrchestratorSummary),
    prOwnershipRecords: arrayValue(data.prOwnershipRecords),
    prHandoffRequests: arrayValue(data.prHandoffRequests),
    prHandoffDecisions: arrayValue(data.prHandoffDecisions),
    prOwnershipAuditEvents: arrayValue(data.prOwnershipAuditEvents),
    prOwnershipSummary: sanitizeDashboardObject(data.prOwnershipSummary),
    prMergeQueueOwnershipReadiness: arrayValue(data.prMergeQueueOwnershipReadiness),
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
      branchOrchestratorStatus: objectValue(data.branchOrchestratorSummary).status ?? "v2_implemented",
      branchOrchestratorRemoteGitOperation: false,
      branchOrchestratorNoDestructiveGit: true,
      prOwnershipStatus: objectValue(data.prOwnershipSummary).status ?? "v1_implemented",
      remotePrUpdateEnabled: false,
      remoteReviewerAssignmentEnabled: false,
      prOwnershipGithubApiCalls: false,
      prOwnershipAutoMergeEnabled: false,
      tokenExposed: false
    })
  };

  const branchCleanup: BranchCleanupReadModel = {
    summary: sanitizeDashboardObject({
      status: objectValue(data.branchCleanupSummary).status ?? "v1_implemented",
      orphanRecords: arrayValue(data.branchCleanupOrphans).length,
      recommendations: arrayValue(data.branchCleanupRecommendations).length,
      destructiveCleanupEnabled: false,
      branchDeletionEnabled: false,
      worktreeRemovalEnabled: false,
      remotePrCloseEnabled: false,
      secretsExposed: false,
      envValuesExposed: false
    }),
    orphanRecords: arrayValue(data.branchCleanupOrphans),
    criticalOrphanRecords: arrayValue(data.branchCleanupCriticalOrphans),
    highSeverityOrphanRecords: arrayValue(data.branchCleanupHighSeverityOrphans),
    recommendations: arrayValue(data.branchCleanupRecommendations),
    destructiveFutureRecommendations: arrayValue(data.branchCleanupDestructiveFutureRecommendations),
    metadataOnlyRecommendations: arrayValue(data.branchCleanupMetadataOnlyRecommendations),
    decisions: arrayValue(data.branchCleanupDecisions),
    recoveryActions: arrayValue(data.branchCleanupRecoveryActions),
    policyStatus: sanitizeDashboardObject({
      metadataOnly: true,
      policyDenyWins: true
    }),
    noDestructiveStatus: sanitizeDashboardObject({
      destructiveCleanupEnabled: false,
      branchDeletionEnabled: false,
      worktreeRemovalEnabled: false,
      remotePrCloseEnabled: false,
      realGitOperation: false
    })
  };

  const githubApp: GitHubAppHardeningReadModel = {
    summary: sanitizeDashboardObject({
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      githubAppLiveEnabled: false,
      productionWebhooksEnabled: false,
      externalCallsEnabled: false,
      permissionCount: 11,
      webhookEventCount: 12,
      blockerCount: 4,
      noSecretsExposed: true
    }),
    runtimeConfig: sanitizeDashboardObject({
      authMode: "legacy_token",
      enabled: false,
      configured: false,
      appIdConfigured: false,
      privateKeySecretRefConfigured: false,
      webhookSecretRefConfigured: false,
      allowedInstallationCount: 0,
      allowedRepoCount: 0,
      tokenProviderKind: "disabled",
      realInstallationTokenExchangeEnabled: false,
      secretsExposed: false,
      tokensExposed: false
    }),
    runtimeInstallations: sanitizeDashboardArray([]),
    runtimeRepositoryGrants: sanitizeDashboardArray([]),
    tokenReadiness: sanitizeDashboardObject({
      authMode: "legacy_token",
      enabled: false,
      configured: false,
      tokenProviderKind: "disabled",
      privateKeySecretRefConfigured: false,
      legacyTokenFallbackWarning: false,
      realInstallationTokenExchangeEnabled: false
    }),
    runtimeAuditEvents: sanitizeDashboardArray([]),
    controlledImplementation: sanitizeDashboardObject({
      status: "disabled_or_blocked",
      implemented: true,
      productionReady: false,
      liveGitHubAppCallsEnabled: false,
      privateKeySigningEnabled: false,
      tokenExchangeEnabled: false,
      rawTokensReturned: false
    }),
    appDescriptors: sanitizeDashboardArray([
      {
        id: "github_app_descriptor_planned",
        appSlug: "aichestra-production-planned",
        status: "planned",
        permissions: { metadata: "read", contents: "write", pull_requests: "write", workflows: "none", administration: "none", secrets: "none" },
        events: ["ping", "pull_request", "push", "installation", "installation_repositories"],
        metadata: { planningOnly: true }
      }
    ]),
    installations: sanitizeDashboardArray([
      { id: "github_app_installation_planned", status: "planned", repositorySelection: "selected", accountType: "organization" }
    ]),
    repositoryGrants: sanitizeDashboardArray([
      { id: "github_app_repo_grant_demo", repoOwner: "aichestra", repoName: "demo-backend", status: "allowed", permissions: { metadata: "read", pull_requests: "write" } }
    ]),
    permissionMatrix: sanitizeDashboardArray([
      { githubPermissionName: "metadata", requiredLevel: "read", productionDefault: "allow", riskLevel: "low" },
      { githubPermissionName: "contents", requiredLevel: "write", productionDefault: "future_review", riskLevel: "high" },
      { githubPermissionName: "pull_requests", requiredLevel: "write", productionDefault: "future_review", riskLevel: "medium" },
      { githubPermissionName: "workflows", requiredLevel: "none", productionDefault: "deny", riskLevel: "critical" },
      { githubPermissionName: "administration", requiredLevel: "none", productionDefault: "deny", riskLevel: "critical" },
      { githubPermissionName: "secrets", requiredLevel: "none", productionDefault: "deny", riskLevel: "critical" }
    ]),
    webhookEventAllowlist: sanitizeDashboardArray([
      { eventName: "ping", supportStatus: "supported_now", sideEffects: ["record_audit"] },
      { eventName: "pull_request", supportStatus: "supported_now", sideEffects: ["upsert_pr_sync_state"] },
      { eventName: "push", supportStatus: "supported_now", sideEffects: ["upsert_branch_sync_state"] },
      { eventName: "installation", supportStatus: "planned", sideEffects: ["future_upsert_installation_read_model"] },
      { eventName: "workflow_run", supportStatus: "ignored", sideEffects: ["record_unsupported_event_audit"] },
      { eventName: "deployment", supportStatus: "denied", sideEffects: ["record_denied_event_audit"] }
    ]),
    replayProtection: sanitizeDashboardObject({
      status: "planning_only",
      deliveryIdUniqueness: "required",
      payloadHashStrategy: "sha256_metadata_only",
      productionReady: false,
      persistenceRequirement: "durable shared storage required before production"
    }),
    webhookDeliveries: sanitizeDashboardArray([
      { deliveryId: "delivery-demo-first", eventType: "pull_request", replayStatus: "first_seen", processingStatus: "processed", payloadHash: "sha256:demo-first" },
      { deliveryId: "delivery-demo-first", eventType: "pull_request", replayStatus: "duplicate", processingStatus: "ignored", payloadHash: "sha256:demo-first" }
    ]),
    deadLetterPlan: sanitizeDashboardObject({
      status: "planning_only",
      maxRetryAttempts: 5,
      backoffStrategy: "exponential_backoff_with_jitter_future_worker",
      productionReady: false
    }),
    deadLetterRecords: sanitizeDashboardArray([
      { deliveryId: "delivery-demo-dead-letter", eventType: "pull_request", reason: "malformed_payload_non_retryable", retryable: false, sanitizedPayloadPreview: "{\"action\":\"[redacted-invalid-preview]\"}" }
    ]),
    credentialReadiness: sanitizeDashboardObject({
      status: "planning_only",
      privateKeySecretRefRequired: true,
      privateKeyConfigured: false,
      webhookSecretRefRequired: true,
      webhookSecretConfiguredForProduction: false,
      installationTokenExchangeImplemented: false,
      legacyEnvTokenProductionReady: false,
      noSecretsStored: true
    }),
    productionEndpoint: sanitizeDashboardObject({
      endpointPath: "/git/github/webhooks",
      status: "planning_only",
      tlsRequired: true,
      rawBodyPreservationRequired: true,
      queueRequired: true,
      productionReady: false
    }),
    readinessChecks: sanitizeDashboardArray([
      { id: "github_app_private_key_secretref_required", status: "fail", severity: "critical", category: "credentials" },
      { id: "github_app_permissions_least_privilege_defined", status: "pass", severity: "medium", category: "permissions" },
      { id: "github_webhook_replay_storage_required", status: "fail", severity: "high", category: "replay" },
      { id: "github_webhook_dead_letter_worker_required", status: "fail", severity: "high", category: "dead_letter" }
    ]),
    productionRisks: sanitizeDashboardArray([
      { id: "risk_github_app_private_key_mismanagement", severity: "critical", status: "open" },
      { id: "risk_github_webhook_replay_without_shared_state", severity: "high", status: "open" },
      { id: "risk_github_app_overprivileged_permissions", severity: "high", status: "open" }
    ]),
    blockers: sanitizeDashboardArray([
      { id: "github_app_private_key_secretref_required", status: "fail", severity: "critical" },
      { id: "github_webhook_replay_storage_required", status: "fail", severity: "high" },
      { id: "github_webhook_dead_letter_worker_required", status: "fail", severity: "high" }
    ]),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      privateKeysStored: false,
      webhookSecretsExposed: false,
      installationTokensIssued: false,
      rawWebhookPayloadsStored: false,
      externalCallsEnabled: false
    })
  };

  const githubAppIntegration: GitHubAppIntegrationTestReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      liveTestsEnabled: false,
      canRunLiveTests: false,
      defaultLiveTestsSkipped: true,
      requiredGateCount: 12,
      configuredGateCount: 0,
      missingGateCount: 12,
      unsafeGateCount: 0,
      allowedRepoCount: 0,
      allowedBranchPrefix: "ai/",
      branchPrefixConfigured: false,
      branchPrefixMatchesRequired: false,
      testCaseCount: 8,
      gatedLiveTestCaseCount: 5,
      webhookFixtureTestsEnabled: true,
      liveWebhookTestsEnabled: false,
      cleanupPolicyStatus: "manual_close_or_mark_only",
      noAutoMerge: true,
      noForcePush: true,
      noBranchDelete: true,
      noSecretsExposed: true,
      envValuesExposed: false,
      privateKeyExposed: false,
      installationTokenExposed: false,
      githubCallsInDefaultTests: false
    }),
    profile: sanitizeDashboardObject({
      id: "github_app_integration_test_profile_v1",
      name: "GitHub App integration-test profile v1",
      status: "disabled",
      allowedBranchPrefix: "ai/",
      allowedOperations: ["config_validation", "branch_create", "pr_create", "changed_files", "webhook_fixture"],
      forbiddenOperations: ["auto_merge", "rebase_push", "force_push", "branch_delete", "private_key_value_return", "installation_token_value_return"]
    }),
    testCases: sanitizeDashboardArray([
      { id: "github_app_it_config_validation", category: "config_validation", enabledByDefault: true, requiresLiveGitHub: false, status: "active_mock" },
      { id: "github_app_it_installation_token_gated", category: "installation_token", enabledByDefault: false, requiresLiveGitHub: true, status: "gated_live" },
      { id: "github_app_it_branch_create", category: "branch_create", enabledByDefault: false, requiresLiveGitHub: true, status: "gated_live" },
      { id: "github_app_it_pr_create", category: "pr_create", enabledByDefault: false, requiresLiveGitHub: true, status: "gated_live" },
      { id: "github_app_it_webhook_fixture", category: "webhook_fixture", enabledByDefault: true, requiresLiveGitHub: false, status: "active_mock" }
    ]),
    gatedLiveTestCases: sanitizeDashboardArray([
      { id: "github_app_it_installation_token_gated", category: "installation_token" },
      { id: "github_app_it_branch_create", category: "branch_create" },
      { id: "github_app_it_pr_create", category: "pr_create" }
    ]),
    fixtureTestCases: sanitizeDashboardArray([
      { id: "github_app_it_config_validation", category: "config_validation" },
      { id: "github_app_it_webhook_fixture", category: "webhook_fixture" }
    ]),
    safetyChecks: sanitizeDashboardArray([
      { id: "github_app_it_env_gates_missing_skip", category: "env_gates", status: "warning", severity: "high" },
      { id: "github_app_it_repo_allowlist_required", category: "repo_allowlist", status: "warning", severity: "critical" },
      { id: "github_app_it_no_auto_merge", category: "no_auto_merge", status: "pass", severity: "critical" },
      { id: "github_app_it_no_force_push", category: "no_force_push", status: "pass", severity: "critical" },
      { id: "github_app_it_no_branch_delete", category: "no_branch_delete", status: "pass", severity: "critical" }
    ]),
    blockers: sanitizeDashboardArray([]),
    warnings: sanitizeDashboardArray([
      { id: "github_app_it_env_gates_missing_skip", severity: "high" },
      { id: "github_app_it_repo_allowlist_required", severity: "critical" }
    ]),
    cleanupPolicy: sanitizeDashboardObject({
      status: "manual_close_or_mark_only",
      branchDeletionAllowed: false,
      remoteCleanupCallsEnabledByDefault: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      privateKeyExposed: false,
      installationTokenExposed: false,
      githubCallsInDefaultTests: false,
      noAutoMerge: true,
      noForcePush: true,
      noBranchDelete: true
    })
  };

  const llmIntegration: LLMIntegrationTestReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      liveTestsEnabled: false,
      canRunLiveTests: false,
      defaultLiveTestsSkipped: true,
      requiredGateCount: 13,
      configuredGateCount: 0,
      missingGateCount: 13,
      unsafeGateCount: 0,
      providerKind: "openai_compatible",
      remoteLlmEnabled: false,
      remoteCompletionEnabled: false,
      baseUrlConfigured: false,
      apiKeyConfigured: false,
      secretRefConfigured: false,
      rawEnvApiKeyConfigured: false,
      allowedModelCount: 0,
      defaultModelConfigured: false,
      defaultModelAllowlisted: false,
      routingModeAllowed: false,
      fallbackSafe: true,
      budgetConfigured: false,
      promptClassConfigured: false,
      testCaseCount: 9,
      gatedLiveTestCaseCount: 2,
      mockTestCaseCount: 7,
      noStreaming: true,
      noToolCalls: true,
      noVendorCli: true,
      noCredentialCacheRead: true,
      noSecretsExposed: true,
      envValuesExposed: false,
      apiKeyExposed: false,
      rawProviderResponseExposed: false,
      remoteLlmCallsInDefaultTests: false
    }),
    profile: sanitizeDashboardObject({
      id: "llm_gateway_integration_test_profile_v1",
      name: "LLM Gateway integration-test profile v1",
      status: "disabled",
      providerKind: "openai_compatible",
      allowedModels: ["configured_model_allowlist_required"],
      allowedOperations: ["config_validation", "credential_resolution_status_only", "model_allowlist_validation", "budget_guard_validation", "mock_completion_fixture"],
      forbiddenOperations: ["streaming", "tool_calls", "local_cli_provider_execution", "vendor_cli_execution", "credential_cache_read", "raw_api_key_return"]
    }),
    testCases: sanitizeDashboardArray([
      { id: "llm_it_config_validation", category: "config_validation", enabledByDefault: true, requiresRemoteLLM: false, status: "active_mock" },
      { id: "llm_it_credential_resolution_status", category: "credential_resolution", enabledByDefault: true, requiresRemoteLLM: false, status: "active_mock" },
      { id: "llm_it_model_allowlist", category: "model_allowlist", enabledByDefault: true, requiresRemoteLLM: false, status: "active_mock" },
      { id: "llm_it_budget_guard", category: "budget_guard", enabledByDefault: true, requiresRemoteLLM: false, status: "active_mock" },
      { id: "llm_it_remote_completion_gated", category: "remote_completion", enabledByDefault: false, requiresRemoteLLM: true, status: "gated_live" }
    ]),
    gatedLiveTestCases: sanitizeDashboardArray([
      { id: "llm_it_remote_completion_gated", category: "remote_completion" },
      { id: "llm_it_usage_ledger", category: "usage_ledger" }
    ]),
    mockTestCases: sanitizeDashboardArray([
      { id: "llm_it_config_validation", category: "config_validation" },
      { id: "llm_it_mock_completion", category: "mock_completion" },
      { id: "llm_it_audit_redaction", category: "audit_redaction" }
    ]),
    safetyChecks: sanitizeDashboardArray([
      { id: "llm_it_env_gates_missing_skip", category: "env_gates", status: "warning", severity: "high" },
      { id: "llm_it_secretref_preferred", category: "secretref", status: "warning", severity: "critical" },
      { id: "llm_it_model_allowlist_required", category: "model_allowlist", status: "warning", severity: "critical" },
      { id: "llm_it_budget_cap_required", category: "budget", status: "warning", severity: "critical" },
      { id: "llm_it_no_streaming", category: "no_streaming", status: "pass", severity: "high" },
      { id: "llm_it_no_tool_calls", category: "no_tool_calls", status: "pass", severity: "high" }
    ]),
    blockers: sanitizeDashboardArray([]),
    warnings: sanitizeDashboardArray([
      { id: "llm_it_env_gates_missing_skip", severity: "high" },
      { id: "llm_it_secretref_preferred", severity: "critical" },
      { id: "llm_it_model_allowlist_required", severity: "critical" },
      { id: "llm_it_budget_cap_required", severity: "critical" }
    ]),
    gateStatus: sanitizeDashboardObject({
      configuredGateCount: 0,
      missingGateCount: 13,
      unsafeGateCount: 0,
      providerKind: "openai_compatible",
      baseUrlConfigured: false,
      apiKeyConfigured: false,
      secretRefConfigured: false,
      allowedModelCount: 0,
      budgetConfigured: false,
      fallbackSafe: true,
      envValuesReturned: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      apiKeyExposed: false,
      rawProviderResponseExposed: false,
      remoteLlmCallsInDefaultTests: false,
      noStreaming: true,
      noToolCalls: true,
      noVendorCli: true,
      noCredentialCacheRead: true
    })
  };

  const conflicts: ConflictManagerReadModel = {
    branchLeases: arrayValue(data.activeLeases),
    conflictRisks: arrayValue(data.conflictRisks),
    mergeQueue: arrayValue(data.mergeQueue),
    mergeSimulations: arrayValue(data.mergeSimulations),
    mergeQueuePolicy: sanitizeDashboardObject(data.mergeQueuePolicy),
    mergeReadinessDecisions: arrayValue(data.mergeReadinessDecisions),
    mergeQueueHolds: arrayValue(data.mergeQueueHolds),
    conflictResolutionRequests: arrayValue(data.conflictResolutionRequests),
    conflictSummaries: arrayValue(data.conflictSummaries),
    conflictResolutionPlans: arrayValue(data.conflictResolutionPlans),
    conflictResolutionRecommendations: arrayValue(data.conflictResolutionRecommendations),
    conflictAssistantSummary: sanitizeDashboardObject(data.conflictAssistantSummary),
    realMergeExecutionPolicy: sanitizeDashboardObject(data.realMergeExecutionPolicy),
    realMergeExecutionRequests: arrayValue(data.realMergeExecutionRequests),
    realMergeExecutionDecisions: arrayValue(data.realMergeExecutionDecisions),
    realMergePreconditions: arrayValue(data.realMergePreconditions),
    realMergeForbiddenOperations: arrayValue(data.realMergeForbiddenOperations),
    realMergePostExecutionEvidenceTemplate: sanitizeDashboardObject(data.realMergePostExecutionEvidenceTemplate),
    realMergeExecutionSummary: sanitizeDashboardObject(data.realMergeExecutionSummary),
    summary: sanitizeDashboardObject({
      activeLeases: Array.isArray(data.activeLeases) ? data.activeLeases.length : 0,
      conflictRisks: Array.isArray(data.conflictRisks) ? data.conflictRisks.length : 0,
      mergeQueueEntries: Array.isArray(data.mergeQueue) ? data.mergeQueue.length : 0,
      dryRunSimulations: Array.isArray(data.mergeSimulations) ? data.mergeSimulations.length : 0,
      mergeQueuePolicyStatus: typeof (data.mergeQueuePolicy as Record<string, unknown> | undefined)?.status === "string"
        ? (data.mergeQueuePolicy as Record<string, unknown>).status
        : "not_evaluated",
      mergeQueuePolicyReady: Array.isArray(data.mergeReadinessDecisions)
        ? data.mergeReadinessDecisions.filter((decision) => (decision as Record<string, unknown>).decision === "ready").length
        : 0,
      mergeQueuePolicyHolds: Array.isArray(data.mergeQueueHolds) ? data.mergeQueueHolds.length : 0,
      mergeExecutionEnabled: false,
      autoMergeEnabled: false,
      conflictAssistantStatus: typeof (data.conflictAssistantSummary as Record<string, unknown> | undefined)?.status === "string"
        ? (data.conflictAssistantSummary as Record<string, unknown>).status
        : "v1_implemented",
      conflictAssistantRequests: Array.isArray(data.conflictResolutionRequests) ? data.conflictResolutionRequests.length : 0,
      conflictAssistantPlans: Array.isArray(data.conflictResolutionPlans) ? data.conflictResolutionPlans.length : 0,
      conflictAssistantRecommendations: Array.isArray(data.conflictResolutionRecommendations) ? data.conflictResolutionRecommendations.length : 0,
      conflictAssistantApplyAllowed: false,
      conflictAssistantRealLlmUsed: false,
      realMergeExecutionStatus: typeof (data.realMergeExecutionSummary as Record<string, unknown> | undefined)?.status === "string"
        ? (data.realMergeExecutionSummary as Record<string, unknown>).status
        : "v1_implemented",
      realMergePolicyStatus: typeof (data.realMergeExecutionSummary as Record<string, unknown> | undefined)?.policyStatus === "string"
        ? (data.realMergeExecutionSummary as Record<string, unknown>).policyStatus
        : "policy_defined",
      realMergeRequests: Array.isArray(data.realMergeExecutionRequests) ? data.realMergeExecutionRequests.length : 0,
      realMergeDecisions: Array.isArray(data.realMergeExecutionDecisions) ? data.realMergeExecutionDecisions.length : 0,
      realMergeReadyForManualFuture: Array.isArray(data.realMergeExecutionDecisions)
        ? data.realMergeExecutionDecisions.filter((decision) => (decision as Record<string, unknown>).decision === "ready_for_manual_future").length
        : 0,
      realMergeBlocked: Array.isArray(data.realMergeExecutionDecisions)
        ? data.realMergeExecutionDecisions.filter((decision) => (decision as Record<string, unknown>).decision !== "ready_for_manual_future").length
        : 0,
      realMergePreconditions: Array.isArray(data.realMergePreconditions) ? data.realMergePreconditions.length : 0,
      realMergeForbiddenOperations: Array.isArray(data.realMergeForbiddenOperations) ? data.realMergeForbiddenOperations.length : 0,
      realMergeExecutionEnabled: false,
      realMergeAutoMergeEnabled: false,
      realMergeRemotePushEnabled: false,
      realMergeExecutionPerformed: false
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
    scopeSummary: sanitizeDashboardObject({
      totalResources: Array.isArray(data.skills) && Array.isArray(data.harnesses) && Array.isArray(data.instructions)
        ? data.skills.length + data.harnesses.length + data.instructions.length + (Array.isArray(data.registryPackages) ? data.registryPackages.length : 0)
        : 0,
      inScope: 0,
      warnings: 0,
      denied: 0,
      missingScope: 0,
      enforcementMode: "warning",
      productionEnforcement: false,
      metadata: {
        status: "v1_implemented_partial",
        demoFallback: true,
        noSecretsExposed: true,
        envValuesExposed: false
      }
    }),
    scopeDecisions: [],
    approvalQueueScopeSummary: sanitizeDashboardObject({
      totalResources: Array.isArray(data.registryApprovalQueue) ? data.registryApprovalQueue.length : 0,
      inScope: 0,
      warnings: 0,
      denied: 0,
      missingScope: 0,
      enforcementMode: "warning",
      productionEnforcement: false
    }),
    artifactTrustSummary: sanitizeDashboardObject({
      totalArtifacts: Array.isArray(data.registryPackages) ? data.registryPackages.length : 0,
      trusted: 0,
      warnings: Array.isArray(data.registryPackages) ? data.registryPackages.length : 0,
      blocked: 0,
      unsigned: Array.isArray(data.registryPackages) ? data.registryPackages.length : 0,
      missingProvenance: Array.isArray(data.registryPackages) ? data.registryPackages.length : 0,
      realSigningImplemented: false,
      realVerificationImplemented: false,
      externalRegistryCalls: false,
      metadata: {
        status: "v1_implemented",
        demoFallback: true,
        noRealCrypto: true
      }
    }),
    artifactTrustDecisions: [],
    artifactTrustPolicies: [],
    artifactTrustStatus: sanitizeDashboardObject({
      digestStatusVisible: true,
      signatureStatusVisible: true,
      provenanceStatusVisible: true,
      futureRealVerificationDisabled: true,
      signingKeysGenerated: false,
      noExternalRegistryCalls: true,
      resolverGatesPreserved: true,
      lifecycleApprovalEvalChecksumGatesPreserved: true,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    evalSuiteSummary: sanitizeDashboardObject({
      status: "v1_implemented",
      executionMode: "mock_deterministic_only",
      suiteCount: 6,
      caseCount: 6,
      runCount: 0,
      resultCount: 0,
      passedRuns: 0,
      failedRuns: 0,
      warningRuns: 0,
      skippedRuns: 0,
      blockedRuns: 0,
      externalEvalImplemented: false,
      realProviderCalls: false,
      llmCallsExecuted: false,
      mcpCallsExecuted: false,
      vendorCliExecuted: false,
      canaryExecuted: false,
      autoApplyEnabled: false,
      activeRegistryMutationExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    evalSuites: sanitizeDashboardArray([]),
    evalCases: sanitizeDashboardArray([]),
    evalRuns: sanitizeDashboardArray([]),
    evalCaseResults: sanitizeDashboardArray([]),
    evalVerdicts: sanitizeDashboardArray([]),
    evalAttachments: sanitizeDashboardArray([]),
    evalSuiteStatus: sanitizeDashboardObject({
      status: "v1_implemented",
      executionMode: "mock_deterministic_only",
      mockExecutionOnly: true,
      externalEvalImplemented: false,
      realProviderCalls: false,
      llmCallsExecuted: false,
      mcpCallsExecuted: false,
      vendorCliExecuted: false,
      canaryExecuted: false,
      autoApplyEnabled: false,
      activeRegistryMutationExecuted: false,
      resolverGatesPreserved: true,
      applyGateStillRequired: true,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    resolverScopeStatus: sanitizeDashboardObject({
      scopeMetadataAttached: true,
      resolverGatesPreserved: true,
      productionEnforcement: false
    }),
    mutationScopeStatus: sanitizeDashboardObject({
      mutationScopeCheckEnabled: true,
      policyDenyStillWins: true,
      activeRegistryMutationThroughAutoImprovement: false,
      productionEnforcement: false
    }),
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
    routes: arrayValue(data.llmRoutes),
    routing: objectValue(data.llmRoutingConfig),
    providerHealth: arrayValue(data.llmProviderHealth),
    fallbackPolicies: arrayValue(data.llmFallbackPolicies),
    routingDecisions: arrayValue(data.llmRoutingDecisions),
    fallbackAttempts: arrayValue(data.llmFallbackAttempts),
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
    workspaceLeases: arrayValue(data.agentWorkspaceLeases),
    workspaceEvents: arrayValue(data.agentWorkspaceLifecycleEvents),
    cleanupDecisions: arrayValue(data.agentWorkspaceCleanupDecisions),
    workspaceLifecycle: sanitizeDashboardObject({
      status: "v2_implemented",
      activeWorkspaceLeases: arrayValue(data.agentWorkspaceLeases).filter((lease) => lease.status === "active").length,
      fixtureWorkspaceLeases: arrayValue(data.agentWorkspaceLeases).filter((lease) => lease.workspaceKind === "fixture").length,
      futureGitWorktreeLeases: arrayValue(data.agentWorkspaceLeases).filter((lease) => lease.workspaceKind === "git_worktree_future").length,
      sharedWorkspaceForbidden: arrayValue(data.agentWorkspaceLeases).some((lease) => lease.isolationStatus === "shared_forbidden"),
      cleanupDecisionCount: arrayValue(data.agentWorkspaceCleanupDecisions).length,
      destructiveCleanupEnabled: false,
      realGitWorktreeExecutionEnabled: false,
      fullWorkspacePathsExposed: false,
      noSecretsExposed: true
    }),
    worktreeAllocationRequests: arrayValue(data.agentWorktreeAllocationRequests),
    worktreeAllocationResults: arrayValue(data.agentWorktreeAllocationResults),
    worktreeSafetyChecks: arrayValue(data.agentWorktreeSafetyChecks),
    worktreeAllocationSummary: sanitizeDashboardObject(data.agentWorktreeAllocationSummary ?? {
      status: "v1_implemented",
      allocationEnabled: false,
      fixtureOnly: true,
      productionWorktreeAllocation: false,
      workspaceRootAllowlistCount: 0,
      requests: 0,
      allocations: 0,
      safetyChecks: 0,
      realGitWorktreeExecuted: false,
      destructiveCleanupExecuted: false,
      fullLocalPathsExposed: false
    }),
    coordinationSessions: arrayValue(data.agentCoordinationSessions),
    coordinationGroups: arrayValue(data.agentCoordinationGroups),
    sessionOverlaps: arrayValue(data.agentSessionOverlaps),
    concurrencyPolicies: arrayValue(data.agentConcurrencyPolicies),
    coordinationAuditEvents: arrayValue(data.agentCoordinationAuditEvents),
    coordinationSummary: objectValue(data.agentCoordinationSummary),
    editIntents: arrayValue(data.agentEditIntents),
    fileLeases: arrayValue(data.agentFileLeases),
    editIntentGraph: objectValue(data.agentEditIntentGraph),
    editOverlapAssessments: arrayValue(data.agentEditOverlapAssessments),
    editIntentSummary: objectValue(data.agentEditIntentSummary),
    blockedExamples: sanitizeDashboardArray([data.blockedCommandExample, data.localRunnerBlockedExample])
  };

  const policy: PolicyReadModel = {
    config: objectValue(data.policyConfig),
    rules: arrayValue(data.policyRules),
    auditEntries: arrayValue(data.policyAuditEntries),
    blockedExamples: arrayValue(data.policyDecisions).filter((decision) => decision.allowed !== true)
  };

  const policyBundles: PolicyBundleReadinessReadModel = {
    summary: sanitizeDashboardObject({
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      currentEngineKind: "static_typescript_current",
      policyBundleManagementEnabled: false,
      externalPolicyEngineEnabled: false,
      opaIntegrationEnabled: false,
      cedarIntegrationEnabled: false,
      signedBundleSupportEnabled: false,
      signedBundleVerificationEnabled: false,
      dynamicPolicyExecutionEnabled: false,
      remotePolicyLoadingEnabled: false,
      policyRuntimeChanged: false,
      staticPolicyRuleCount: policy.rules.length,
      engineOptionCount: 5,
      bundlePlanCount: 4,
      domainMappingCount: 14,
      mappedDomainCount: 11,
      readinessCheckCount: 10,
      criticalBlockerCount: 2,
      riskCount: 5,
      migrationPhaseCount: 5,
      reviewWorkflowStatus: "planned_not_implemented",
      testStrategyStatus: "planned_not_implemented",
      rolloutStatus: "planned_not_implemented",
      rollbackStatus: "planned_not_implemented",
      breakGlassStatus: "planned_not_implemented",
      noSecretsExposed: true,
      policyCodeExecuted: false,
      externalCallsEnabled: false
    }),
    engineOptions: sanitizeDashboardArray([
      { id: "policy_engine_static_typescript_current", engineKind: "static_typescript_current", status: "current", productionRecommended: false },
      { id: "policy_engine_signed_json_yaml_bundle", engineKind: "signed_json_yaml_bundle", status: "recommended", productionRecommended: true },
      { id: "policy_engine_opa_rego", engineKind: "opa_rego", status: "planned", productionRecommended: true },
      { id: "policy_engine_cedar", engineKind: "cedar", status: "future", productionRecommended: false }
    ]),
    bundlePlans: sanitizeDashboardArray([
      { id: "policy_bundle_static_typescript_legacy", bundleKind: "static_typescript_legacy", status: "ready_for_design" },
      { id: "policy_bundle_schema_bridge", bundleKind: "json_yaml_policy_bundle", status: "planned" },
      { id: "policy_bundle_opa_future", bundleKind: "opa_bundle", status: "future" },
      { id: "policy_bundle_cedar_future", bundleKind: "cedar_policy_set", status: "future" }
    ]),
    domainMappings: sanitizeDashboardArray([
      { id: "policy_domain_git", domain: "git", migrationStatus: "mapped", riskLevel: "high" },
      { id: "policy_domain_llm", domain: "llm", migrationStatus: "mapped", riskLevel: "critical" },
      { id: "policy_domain_mcp", domain: "mcp", migrationStatus: "mapped", riskLevel: "critical" },
      { id: "policy_domain_secretref", domain: "secretref", migrationStatus: "mapped", riskLevel: "critical" },
      { id: "policy_domain_auth", domain: "auth", migrationStatus: "gap", riskLevel: "critical" }
    ]),
    readinessChecks: sanitizeDashboardArray([
      { id: "policy_bundle_engine_options_documented", category: "engine_selection", status: "pass", severity: "medium" },
      { id: "policy_bundle_signing_future", category: "signing", status: "fail", severity: "high" },
      { id: "policy_bundle_break_glass_future", category: "break_glass", status: "fail", severity: "critical" },
      { id: "policy_bundle_dashboard_panel_available", category: "dashboard", status: "pass", severity: "low" }
    ]),
    risks: sanitizeDashboardArray([
      { id: "policy_bundle_risk_dynamic_execution", severity: "critical", status: "open" },
      { id: "policy_bundle_risk_unsigned_policy_change", severity: "high", status: "open" }
    ]),
    migrationPhases: sanitizeDashboardArray([
      { id: "policy_bundle_phase_1_inventory", order: 1, status: "ready_for_design" },
      { id: "policy_bundle_phase_2_schema_and_tests", order: 2, status: "planned" },
      { id: "policy_bundle_phase_3_review_and_signing", order: 3, status: "blocked" }
    ]),
    blockers: sanitizeDashboardArray([
      { id: "policy_bundle_signing_future", severity: "high" },
      { id: "policy_bundle_break_glass_future", severity: "critical" }
    ]),
    recommendedPath: sanitizeDashboardObject({
      engineKind: "signed_json_yaml_bundle",
      displayName: "Signed JSON/YAML Policy Bundle",
      status: "recommended",
      runtimeImplemented: false
    }),
    reviewWorkflow: sanitizeDashboardObject({ status: "planned_not_implemented", workflowEngineImplemented: false }),
    testStrategy: sanitizeDashboardObject({ status: "planned_not_implemented", bundleTestRunnerImplemented: false }),
    rolloutRollback: sanitizeDashboardObject({ rolloutStatus: "planned_not_implemented", rollbackStatus: "planned_not_implemented", shadowEvaluationImplemented: false }),
    breakGlass: sanitizeDashboardObject({ status: "planned_not_implemented", implemented: false, canReadRawSecrets: false }),
    noExecutionStatus: sanitizeDashboardObject({
      dynamicPolicyExecutionEnabled: false,
      externalPolicyEngineEnabled: false,
      policyCodeExecuted: false,
      remotePolicyLoadingEnabled: false,
      opaIntegrationEnabled: false,
      cedarIntegrationEnabled: false,
      noSecretsExposed: true,
      runtimeChanged: false
    })
  };

  const policyShadowEvaluatorStatus = createDisabledPolicyShadowEvaluator().getStatus();
  const policyShadowEvaluatorMockReport = runPolicyShadowGoldenMockReport();
  const policyShadowEvaluatorPreview = policyShadowEvaluatorMockReport.results.slice(0, 5).map((result) => ({
    id: result.id,
    status: result.status,
    sourceOfTruthRuntime: result.sourceOfTruthRuntime,
    candidateRuntimeKind: result.candidateRuntimeKind,
    enforcementChanged: result.enforcementChanged,
    mismatchCount: result.mismatches.length,
    comparison: result.comparison
  }));

  const policyShadow: PolicyShadowEvaluationReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      sourceOfTruth: "StaticPolicyEngine",
      enforcementMode: "shadow_only",
      enforcementChanged: false,
      staticPolicyEngineAuthoritative: true,
      shadowEvaluatorSkeletonImplemented: true,
      shadowEvaluatorEnabled: false,
      mockComparisonSupported: true,
      shadowEvaluatorImplemented: false,
      candidateRuntimeImplemented: false,
      candidateRuntimeExecuted: false,
      candidateBundleValidated: false,
      dynamicPolicyExecutionEnabled: false,
      externalPolicyServiceCallsEnabled: false,
      remotePolicyBundleLoadingEnabled: false,
      signedBundleVerificationRuntimeEnabled: false,
      opaRuntimeEnabled: false,
      cedarRuntimeEnabled: false,
      policyCodeExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      comparisonRuleCount: 6,
      mismatchTaxonomyCount: 10,
      criticalMismatchKindCount: 3,
      readinessCheckCount: 11,
      goldenCaseSource: "Policy Runtime PoC Golden Test Harness v1",
      recommendedNextTask: "Policy Runtime Shadow Evaluator Implementation Planning v1, or Signed JSON/YAML Bundle Schema v1"
    }),
    plan: sanitizeDashboardObject({
      id: "policy_shadow_evaluation_v1_plan",
      status: "ready_for_design",
      sourceOfTruth: "StaticPolicyEngine",
      candidateRuntimeKinds: ["signed_json_yaml_bundle", "opa_rego", "cedar", "custom_future"],
      domains: ["git", "llm", "mcp", "runner", "secretref", "local_agent", "provider", "auth"],
      rolloutStages: ["docs_planning", "golden_harness_only", "offline_candidate_runtime_evaluation_future", "live_shadow_record_only_future", "critical_mismatch_alerting_future", "selected_non_critical_enforcement_future", "production_enforcement_future"],
      enforcementMode: "shadow_only"
    }),
    comparisonRules: sanitizeDashboardArray([
      { id: "policy_shadow_compare_effect_match", comparisonKind: "effect_match", required: true, severityOnMismatch: "critical" },
      { id: "policy_shadow_compare_reason_match", comparisonKind: "reason_match", required: false, severityOnMismatch: "medium" },
      { id: "policy_shadow_compare_rule_id_match", comparisonKind: "rule_id_match", required: true, severityOnMismatch: "high" },
      { id: "policy_shadow_compare_obligation_match", comparisonKind: "obligation_match", required: true, severityOnMismatch: "high" },
      { id: "policy_shadow_compare_redaction_match", comparisonKind: "redaction_match", required: true, severityOnMismatch: "critical" },
      { id: "policy_shadow_compare_audit_metadata_match", comparisonKind: "audit_metadata_match", required: true, severityOnMismatch: "medium" }
    ]),
    mismatchTaxonomy: sanitizeDashboardArray([
      { id: "policy_shadow_mismatch_static_deny_candidate_allow", mismatchKind: "static_deny_candidate_allow", severity: "critical", defaultAction: "block_rollout_future" },
      { id: "policy_shadow_mismatch_static_block_candidate_allow", mismatchKind: "static_block_candidate_allow", severity: "critical", defaultAction: "block_rollout_future" },
      { id: "policy_shadow_mismatch_redaction_mismatch", mismatchKind: "redaction_mismatch", severity: "critical", defaultAction: "block_rollout_future" },
      { id: "policy_shadow_mismatch_error_in_candidate", mismatchKind: "error_in_candidate", severity: "high", defaultAction: "block_rollout_future" }
    ]),
    readinessChecks: sanitizeDashboardArray([
      { id: "policy_shadow_golden_cases_available", category: "golden_cases", status: "pass", severity: "medium" },
      { id: "policy_shadow_candidate_runtime_future", category: "candidate_runtime", status: "future", severity: "high" },
      { id: "policy_shadow_safety_guarantees_hold", category: "safety", status: "pass", severity: "critical" }
    ]),
    reports: sanitizeDashboardArray([
      { id: "policy_shadow_report_planning_only_v1", domain: "deployment_readiness", caseCount: 0, mismatchCount: 0, enforcementChanged: false }
    ]),
    evaluatorStatus: sanitizeDashboardObject(policyShadowEvaluatorStatus),
    evaluatorSummary: sanitizeDashboardObject(policyShadowEvaluatorMockReport.summary),
    evaluatorMismatchTypes: sanitizeDashboardArray(policyShadowEvaluatorMismatchTypes),
    evaluatorMockReport: sanitizeDashboardObject({
      fixtureReport: policyShadowEvaluatorMockReport.fixtureReport,
      summary: policyShadowEvaluatorMockReport.summary,
      previewCount: policyShadowEvaluatorPreview.length,
      resultPreview: policyShadowEvaluatorPreview
    }),
    criticalMismatchExamples: sanitizeDashboardArray([
      { mismatchKind: "static_deny_candidate_allow", example: "static denies secret.read but candidate allows" },
      { mismatchKind: "static_block_candidate_allow", example: "static blocks governance apply but candidate allows" },
      { mismatchKind: "redaction_mismatch", example: "candidate omits no-secret redaction requirement" }
    ]),
    rollout: sanitizeDashboardObject({
      currentStage: "docs_planning",
      rolloutStages: ["docs_planning", "golden_harness_only", "offline_candidate_runtime_evaluation_future", "live_shadow_record_only_future"],
      liveShadowEvaluationEnabled: false,
      productionEnforcementEnabled: false
    }),
    noExecutionStatus: sanitizeDashboardObject({
      sourceOfTruth: "StaticPolicyEngine",
      enforcementMode: "shadow_only",
      enforcementChanged: false,
      staticPolicyEngineAuthoritative: true,
      shadowEvaluatorSkeletonImplemented: true,
      shadowEvaluatorEnabled: false,
      mockComparisonSupported: true,
      shadowEvaluatorImplemented: false,
      candidateRuntimeImplemented: false,
      candidateRuntimeExecuted: false,
      dynamicPolicyExecutionEnabled: false,
      externalPolicyServiceCallsEnabled: false,
      remotePolicyBundleLoadingEnabled: false,
      policyCodeExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    })
  };


  const policyRuntimePoc: PolicyRuntimePocReadinessReadModel = {
    summary: sanitizeDashboardObject({
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      currentRuntime: "StaticPolicyEngine",
      staticPolicyEngineUnchanged: true,
      recommendedPocOptionId: "policy_runtime_poc_signed_json_yaml",
      recommendedPocPath: "signed_json_yaml_shadow_first",
      runtimeEnforcementEnabled: false,
      shadowEvaluationImplemented: false,
      externalPolicyEngineEnabled: false,
      opaRuntimeImplemented: false,
      cedarRuntimeImplemented: false,
      signedJsonYamlRuntimeImplemented: false,
      customPolicyServiceImplemented: false,
      dynamicPolicyExecutionEnabled: false,
      remotePolicyLoadingEnabled: false,
      hotReloadEnabled: false,
      policyCodeExecuted: false,
      optionCount: 6,
      domainMappingCount: 13,
      goldenCaseCount: 15,
      readinessCheckCount: 8,
      criticalBlockerCount: 1,
      riskCount: 5,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    options: sanitizeDashboardArray([
      { id: "policy_runtime_poc_static_baseline", optionKind: "static_policy_engine_baseline", status: "baseline", runtimeImplemented: false },
      { id: "policy_runtime_poc_signed_json_yaml", optionKind: "signed_json_yaml_bundle_evaluator_future", status: "recommended_for_poc", runtimeImplemented: false },
      { id: "policy_runtime_poc_opa_local", optionKind: "opa_rego_local_library_future", status: "candidate", runtimeImplemented: false },
      { id: "policy_runtime_poc_cedar", optionKind: "cedar_local_evaluator_future", status: "candidate", runtimeImplemented: false }
    ]),
    inputContract: sanitizeDashboardObject({
      version: "policy_runtime_poc_input_v0",
      subjectFields: ["actorId", "principalId", "actorKind", "serviceAccountId", "roles", "teams", "authMode", "isMockActor"],
      requestFields: ["requestId", "correlationId", "source", "taskId", "taskRunId"],
      outputFields: ["decision", "reason", "ruleId", "policyBundleId", "policyVersion", "obligations", "auditMetadata", "redactionRequirements"]
    }),
    domainMappings: sanitizeDashboardArray([
      { id: "policy_runtime_poc_domain_git_remote_operation", domain: "git_remote_operation", currentStaticAction: "git.remote_operation", expectedDenyByDefaultBehavior: "destructive Git denied" },
      { id: "policy_runtime_poc_domain_llm_remote_completion", domain: "llm_remote_completion", currentStaticAction: "llm.remote_completion", expectedDenyByDefaultBehavior: "remote LLM requires gates" },
      { id: "policy_runtime_poc_domain_secretref_vault", domain: "secretref_vault_credential_resolution", currentStaticAction: "provider.credential.resolve", expectedDenyByDefaultBehavior: "raw secrets denied" }
    ]),
    goldenCases: sanitizeDashboardArray([
      { id: "git_remote_merge_denied", action: "git.merge", expectedDecision: "deny" },
      { id: "secret_read_denied", action: "secret.read", expectedDecision: "deny" },
      { id: "llm_remote_completion_requires_gates", action: "llm.remote_completion", expectedDecision: "deny" },
      { id: "tenant_scope_mismatch_denied_future", action: "readiness.read", expectedDecision: "deny" }
    ]),
    goldenHarness: sanitizeDashboardObject({
      status: "pass",
      sourceOfTruth: "StaticPolicyEngine",
      totalCases: 42,
      passedCases: 42,
      failedCases: 0,
      domainCount: 11,
      domainsCovered: ["dashboard_readiness", "git", "governance", "llm", "local_agent", "mcp", "registry", "runner", "scope", "secretref_vault", "tenant_scope"],
      expectedAllowCases: 6,
      expectedDenyCases: 35,
      expectedBlockCases: 1,
      expectedWarnCases: 0,
      staticPolicyEngineOnly: true,
      dynamicPolicyExecutionEnabled: false,
      opaRuntimeExecuted: false,
      cedarRuntimeExecuted: false,
      signedBundleRuntimeExecuted: false,
      externalPolicyServiceCallsEnabled: false,
      remotePolicyLoadingEnabled: false,
      hotReloadEnabled: false,
      secretsInFixtures: false,
      envValuesExposed: false
    }),
    goldenHarnessResults: sanitizeDashboardArray([
      { id: "git_remote_merge_denied", domain: "git", action: "git.merge", passed: true, expectedEffect: "deny", actualEffect: "deny", expectedRuleId: "policy_git_merge_deny", actualRuleId: "policy_git_merge_deny", mismatchCount: 0 },
      { id: "secret_read_denied", domain: "secretref_vault", action: "secret.read", passed: true, expectedEffect: "deny", actualEffect: "deny", expectedRuleId: "policy_secret_read_deny", actualRuleId: "policy_secret_read_deny", mismatchCount: 0 },
      { id: "mcp_critical_tool_denied", domain: "mcp", action: "mcp.tool.invoke", passed: true, expectedEffect: "deny", actualEffect: "deny", expectedRuleId: "policy_mcp_critical_tool_deny", actualRuleId: "policy_mcp_critical_tool_deny", mismatchCount: 0 },
      { id: "governance_apply_denied", domain: "governance", action: "improvement.apply", passed: true, expectedEffect: "deny", actualEffect: "deny", expectedRuleId: "policy_improvement_apply_deny", actualRuleId: "policy_improvement_apply_deny", mismatchCount: 0 }
    ]),
    readinessChecks: sanitizeDashboardArray([
      { id: "policy_runtime_poc_input_contract_defined", category: "input_contract", status: "pass", severity: "high" },
      { id: "policy_runtime_poc_shadow_evaluator_future", category: "shadow_evaluation", status: "fail", severity: "critical" },
      { id: "policy_runtime_poc_runtime_execution_disabled", category: "safety", status: "pass", severity: "critical" }
    ]),
    risks: sanitizeDashboardArray([
      { id: "policy_runtime_poc_risk_dynamic_execution", severity: "critical", status: "open" },
      { id: "policy_runtime_poc_risk_shadow_mismatch", severity: "high", status: "open" }
    ]),
    blockers: sanitizeDashboardArray([
      { id: "policy_runtime_poc_shadow_evaluator_future", severity: "critical" }
    ]),
    recommendedPath: sanitizeDashboardObject({
      optionId: "policy_runtime_poc_signed_json_yaml",
      optionKind: "signed_json_yaml_bundle_evaluator_future",
      status: "recommended_for_poc",
      runtimeImplemented: false
    }),
    shadowEvaluation: sanitizeDashboardObject({
      sourceOfTruth: "StaticPolicyEngine",
      shadowEvaluationImplemented: false,
      candidateRuntimeImplemented: false,
      enforcementChanged: false,
      mismatchesEnforced: false,
      rolloutPhase: "docs_planning_golden_harness_only"
    }),
    rolloutRollback: sanitizeDashboardObject({
      rolloutPhases: ["docs_only", "offline_golden_tests", "shadow_evaluator"],
      rollbackStrategy: "keep_StaticPolicyEngine",
      runtimeEnforcementEnabled: false
    }),
    noExecutionStatus: sanitizeDashboardObject({
      dynamicPolicyExecutionEnabled: false,
      externalPolicyEngineEnabled: false,
      opaRuntimeImplemented: false,
      cedarRuntimeImplemented: false,
      signedJsonYamlRuntimeImplemented: false,
      customPolicyServiceImplemented: false,
      remotePolicyLoadingEnabled: false,
      hotReloadEnabled: false,
      policyCodeExecuted: false,
      staticPolicyEngineUnchanged: true,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    shadowPlan: sanitizeDashboardObject({
      id: "policy_shadow_evaluation_v1_plan",
      status: "ready_for_design",
      sourceOfTruth: "StaticPolicyEngine",
      candidateRuntimeKinds: ["signed_json_yaml_bundle_evaluator_future", "opa_rego_local_library_future", "cedar_local_evaluator_future", "custom_policy_decision_service_future"],
      domains: ["git_remote_operation", "llm_remote_completion", "secretref_vault_credential_resolution", "mcp_tool_invocation", "governance_apply_gate"],
      rolloutStages: ["docs_planning", "golden_harness_only", "offline_candidate_runtime_evaluation_future", "live_shadow_record_only_future"],
      enforcementMode: "shadow_only",
      metadata: { shadowEvaluatorImplemented: false, candidateRuntimeImplemented: false, enforcementChanged: false }
    }),
    shadowComparisonRules: sanitizeDashboardArray([
      { id: "policy_shadow_compare_effect", comparisonKind: "effect_match", required: true, severityOnMismatch: "critical" },
      { id: "policy_shadow_compare_redaction", comparisonKind: "redaction_match", required: true, severityOnMismatch: "critical" },
      { id: "policy_shadow_compare_audit_metadata", comparisonKind: "audit_metadata_match", required: true, severityOnMismatch: "high" }
    ]),
    shadowMismatchTaxonomy: sanitizeDashboardArray([
      { id: "policy_shadow_mismatch_static_deny_candidate_allow", mismatchKind: "static_deny_candidate_allow", severity: "critical", defaultAction: "block_rollout_future" },
      { id: "policy_shadow_mismatch_static_block_candidate_allow", mismatchKind: "static_block_candidate_allow", severity: "critical", defaultAction: "block_rollout_future" },
      { id: "policy_shadow_mismatch_redaction", mismatchKind: "redaction_mismatch", severity: "critical", defaultAction: "block_rollout_future" },
      { id: "policy_shadow_mismatch_candidate_error", mismatchKind: "error_in_candidate", severity: "high", defaultAction: "alert_future" }
    ]),
    shadowReports: sanitizeDashboardArray([
      { id: "policy_shadow_report_planning_seed", domain: "all_domains", caseCount: 0, matchCount: 0, mismatchCount: 0, criticalMismatchCount: 0, enforcementChanged: false, sourceOfTruth: "StaticPolicyEngine", candidateRuntimeKind: "signed_json_yaml_bundle_evaluator_future" }
    ]),
    shadowReadinessChecks: sanitizeDashboardArray([
      { id: "policy_shadow_golden_cases_ready", category: "golden_cases", status: "pass", severity: "high" },
      { id: "policy_shadow_candidate_runtime_future", category: "candidate_runtime", status: "future", severity: "critical" },
      { id: "policy_shadow_safety_invariants_hold", category: "safety", status: "pass", severity: "critical" }
    ]),
    shadowSummary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      sourceOfTruth: "StaticPolicyEngine",
      enforcementMode: "shadow_only",
      currentRolloutStage: "docs_planning_golden_harness_only",
      shadowEvaluatorImplemented: false,
      candidateRuntimeImplemented: false,
      candidateRuntimeInterfaceImplemented: false,
      enforcementChanged: false,
      staticPolicyEngineUnchanged: true,
      goldenHarnessSourceOfTruth: "StaticPolicyEngine",
      comparisonRuleCount: 6,
      mismatchTaxonomyCount: 10,
      criticalMismatchKindCount: 3,
      readinessCheckCount: 10,
      reportCount: 1,
      noDynamicPolicyExecution: true,
      dynamicPolicyExecutionEnabled: false,
      policyCodeExecuted: false,
      externalPolicyServiceCallsEnabled: false,
      noSecretsExposed: true,
      envValuesExposed: false
    })
  };


  const auth: AuthReadModel = {
    config: sanitizeDashboardObject({
      providerKind: "mock",
      authMode: "mock",
      productionAuthEnabled: false,
      mockActorEnabled: true,
      roleCatalogCount: 7,
      permissionCatalogCount: 40,
      secretsExposed: false,
      tokensExposed: false
    }),
    currentActor: sanitizeDashboardObject({
      actor: { id: "mock-admin", displayName: "Mock Admin", actorKind: "anonymous_mock" },
      principal: { id: "principal_mock_admin", principalKind: "system", displayName: "Mock Admin Principal" },
      authMode: "mock",
      authenticated: true,
      roles: ["system_admin", "platform_admin"],
      teams: ["platform"],
      isMockActor: true,
      productionAuthEnabled: false
    }),
    principals: [],
    actors: sanitizeDashboardArray([{ id: "mock-admin", actorKind: "anonymous_mock", roles: ["system_admin", "platform_admin"], status: "active" }]),
    teams: sanitizeDashboardArray([{ id: "team_platform", name: "platform", status: "active" }]),
    roles: sanitizeDashboardArray([{ id: "role_viewer", name: "viewer" }, { id: "role_developer", name: "developer" }, { id: "role_platform_admin", name: "platform_admin" }]),
    permissions: sanitizeDashboardArray([{ action: "dashboard.read", resourceKind: "dashboard", riskLevel: "low" }]),
    roleBindings: [],
    serviceAccounts: sanitizeDashboardArray([{ id: "svcacct_runner", name: "runner-service", status: "active", rawCredentialStored: false }]),
    identityProviders: sanitizeDashboardArray([{ id: "idp_mock", providerKind: "mock", status: "active" }, { id: "idp_oidc_future", providerKind: "oidc_future", status: "disabled" }]),
    auditEvents: [],
    authorizationExamples: sanitizeDashboardArray([
      { action: "dashboard.read", allowed: true, reason: "allowed" },
      { action: "git.merge", allowed: false, reason: "policy_denied" }
    ]),
    warning: "Mock auth is visible for planning only and is not production authentication."
  };

  const authProduction: AuthRbacProductionReadinessReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      currentProfileId: "local",
      productionAuthEnabled: false,
      authMode: "mock",
      mockActorEnabled: true,
      mockActorWarning: "mock_actor_allowed_for_local_only",
      futureIdpConfigured: false,
      externalIdpCallsEnabled: false,
      realSessionsImplemented: false,
      realJwtIssuanceImplemented: false,
      passwordLoginImplemented: false,
      serviceAccountCredentialIssuanceImplemented: false,
      requestContextPropagationStatus: "partial_mock_only",
      tenantScopeModelReady: false,
      noTokensExposed: true,
      cookiesExposed: false,
      sessionIdsExposed: false,
      passwordsExposed: false,
      rawIdentityAssertionsExposed: false
    }),
    providerOptions: sanitizeDashboardArray([
      { id: "auth_provider_oidc", providerKind: "oidc", status: "recommended", productionRecommended: true },
      { id: "auth_provider_saml", providerKind: "saml", status: "planned", productionRecommended: true },
      { id: "auth_provider_scim", providerKind: "scim", status: "planned", productionRecommended: true },
      { id: "auth_provider_mock", providerKind: "mock", status: "not_recommended", productionRecommended: false }
    ]),
    migrationPhases: sanitizeDashboardArray([
      { id: "auth_phase_1_inventory", order: 1, status: "ready_for_design", name: "Inventory actors and context gaps" },
      { id: "auth_phase_5_mock_actor_deprecation", order: 5, status: "blocked", name: "Disable mock actor behavior" }
    ]),
    readinessChecks: sanitizeDashboardArray([
      { id: "auth_identity_provider_required", category: "identity_provider", status: "fail", severity: "critical" },
      { id: "auth_tenant_isolation_required", category: "tenant_isolation", status: "fail", severity: "critical" },
      { id: "auth_mock_actor_deprecation_required", category: "mock_actor_deprecation", status: "fail", severity: "critical" }
    ]),
    risks: sanitizeDashboardArray([
      { id: "auth_risk_mock_actor_production", severity: "critical", status: "open" },
      { id: "auth_risk_tenant_data_leakage", severity: "critical", status: "open" }
    ]),
    tenantBoundaryPlans: sanitizeDashboardArray([
      { id: "tenant_boundary_organization", tenantKind: "organization", status: "not_ready" },
      { id: "tenant_boundary_repo_scope", tenantKind: "repo_scope", status: "planned" }
    ]),
    serviceAccountPlans: sanitizeDashboardArray([
      { id: "service_account_worker", serviceAccountKind: "worker", status: "planned" },
      { id: "service_account_git_webhook", serviceAccountKind: "git_webhook", status: "planned" }
    ]),
    permissionMatrix: sanitizeDashboardArray([
      { id: "rbac_role_viewer", roleName: "viewer", productionDefault: "allow" },
      { id: "rbac_role_security_admin", roleName: "security_admin", productionDefault: "allow" },
      { id: "rbac_role_break_glass_admin_future", roleName: "break_glass_admin_future", productionDefault: "deny" }
    ]),
    blockers: sanitizeDashboardArray([
      { id: "auth_identity_provider_required", severity: "critical" },
      { id: "auth_tenant_isolation_required", severity: "critical" },
      { id: "auth_mock_actor_deprecation_required", severity: "critical" }
    ]),
    mockActorStatus: sanitizeDashboardObject({
      enabled: true,
      warning: "mock_actor_allowed_for_local_only",
      productionReady: false,
      headerActorOverrideProductionReady: false
    }),
    noTokenStatus: sanitizeDashboardObject({
      noTokensExposed: true,
      cookiesExposed: false,
      sessionIdsExposed: false,
      passwordsExposed: false,
      rawIdentityAssertionsExposed: false,
      externalIdpCallsEnabled: false
    })
  };

  const authProviders: ProductionAuthProviderSkeletonReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      activeProviderKind: "mock",
      selectedProviderKind: "mock",
      selectedProviderStatus: "active_mock",
      productionAuthEnabled: false,
      requireAuthForApi: false,
      futureProviderSelected: false,
      futureProviderBlocked: false,
      tokenValidationEnabled: false,
      sessionBoundaryEnabled: false,
      sessionBoundaryStatus: "disabled",
      identityMappingStatus: "not_configured",
      externalCallsEnabled: false,
      missingConfigCount: 0,
      blockerCount: 1,
      noTokensExposed: true,
      authorizationHeadersStored: false,
      cookiesStored: false,
      sessionIdsExposed: false,
      envValuesExposed: false,
      secretsExposed: false,
      productionReady: false
    }),
    configs: sanitizeDashboardArray([
      { id: "production_auth_provider_mock", providerKind: "mock", status: "active_mock", displayName: "MockAuthProvider", tokenValidationEnabled: false, externalCallsEnabled: false, productionReady: false },
      { id: "production_auth_provider_oidc_future", providerKind: "oidc_future", status: "future", displayName: "Disabled OIDC provider", tokenValidationEnabled: false, externalCallsEnabled: false, productionReady: false },
      { id: "production_auth_provider_saml_future", providerKind: "saml_future", status: "future", displayName: "Disabled SAML provider", tokenValidationEnabled: false, externalCallsEnabled: false, productionReady: false },
      { id: "production_auth_provider_scim_future", providerKind: "scim_future", status: "future", displayName: "Disabled SCIM directory provider", tokenValidationEnabled: false, externalCallsEnabled: false, productionReady: false },
      { id: "production_auth_provider_microsoft_entra_future", providerKind: "microsoft_entra_future", status: "future", displayName: "Disabled Microsoft Entra provider", tokenValidationEnabled: false, externalCallsEnabled: false, productionReady: false },
      { id: "production_auth_provider_okta_future", providerKind: "okta_future", status: "future", displayName: "Disabled Okta provider", tokenValidationEnabled: false, externalCallsEnabled: false, productionReady: false },
      { id: "production_auth_provider_auth0_future", providerKind: "auth0_future", status: "future", displayName: "Disabled Auth0 provider", tokenValidationEnabled: false, externalCallsEnabled: false, productionReady: false },
      { id: "production_auth_provider_google_workspace_future", providerKind: "google_workspace_future", status: "future", displayName: "Disabled Google Workspace provider", tokenValidationEnabled: false, externalCallsEnabled: false, productionReady: false },
      { id: "production_auth_provider_github_enterprise_future", providerKind: "github_enterprise_future", status: "future", displayName: "Disabled GitHub Enterprise identity provider", tokenValidationEnabled: false, externalCallsEnabled: false, productionReady: false },
      { id: "production_auth_provider_custom_future", providerKind: "custom_future", status: "future", displayName: "Disabled custom production auth provider", tokenValidationEnabled: false, externalCallsEnabled: false, productionReady: false }
    ]),
    readiness: sanitizeDashboardArray([
      { id: "readiness_mock", providerKind: "mock", status: "ready_mock", blockers: ["production_auth_provider_not_implemented"], missingConfig: [] },
      { id: "readiness_oidc_future", providerKind: "oidc_future", status: "future", blockers: [], missingConfig: [] },
      { id: "readiness_saml_future", providerKind: "saml_future", status: "future", blockers: [], missingConfig: [] },
      { id: "readiness_scim_future", providerKind: "scim_future", status: "future", blockers: [], missingConfig: [] },
      { id: "readiness_microsoft_entra_future", providerKind: "microsoft_entra_future", status: "future", blockers: [], missingConfig: [] },
      { id: "readiness_okta_future", providerKind: "okta_future", status: "future", blockers: [], missingConfig: [] },
      { id: "readiness_auth0_future", providerKind: "auth0_future", status: "future", blockers: [], missingConfig: [] },
      { id: "readiness_google_workspace_future", providerKind: "google_workspace_future", status: "future", blockers: [], missingConfig: [] },
      { id: "readiness_github_enterprise_future", providerKind: "github_enterprise_future", status: "future", blockers: [], missingConfig: [] },
      { id: "readiness_custom_future", providerKind: "custom_future", status: "future", blockers: [], missingConfig: [] }
    ]),
    sessionBoundary: sanitizeDashboardArray([
      { id: "session_token_boundary_cookie_session_future", boundaryKind: "cookie_session_future", status: "future", tokenIssued: false, validationEnabled: false },
      { id: "session_token_boundary_bearer_jwt_future", boundaryKind: "bearer_jwt_future", status: "future", tokenIssued: false, validationEnabled: false },
      { id: "session_token_boundary_api_key_future", boundaryKind: "api_key_future", status: "future", tokenIssued: false, validationEnabled: false },
      { id: "session_token_boundary_service_account_token_future", boundaryKind: "service_account_token_future", status: "future", tokenIssued: false, validationEnabled: false },
      { id: "session_token_boundary_local_agent_pairing_future", boundaryKind: "local_agent_pairing_future", status: "future", tokenIssued: false, validationEnabled: false }
    ]),
    identityMapping: sanitizeDashboardArray([
      { id: "identity_mapping_subject_to_principal", mappingKind: "subject_to_principal", status: "future", targetModel: "Principal" },
      { id: "identity_mapping_group_to_team", mappingKind: "group_to_team", status: "future", targetModel: "Team" },
      { id: "identity_mapping_role_claim_to_role", mappingKind: "role_claim_to_role", status: "future", targetModel: "RoleBinding" },
      { id: "identity_mapping_tenant_claim_to_tenant_scope", mappingKind: "tenant_claim_to_tenant_scope", status: "future", targetModel: "TenantScope" },
      { id: "identity_mapping_repo_claim_to_repo_scope", mappingKind: "repo_claim_to_repo_scope", status: "future", targetModel: "RepoScope" },
      { id: "identity_mapping_service_account_mapping", mappingKind: "service_account_mapping", status: "future", targetModel: "ServiceAccount" }
    ]),
    selectedProvider: sanitizeDashboardObject({ providerKind: "mock", status: "active_mock", productionReady: false }),
    blockers: sanitizeDashboardArray([{ providerKind: "mock", blocker: "production_auth_provider_not_implemented" }]),
    noTokenStatus: sanitizeDashboardObject({
      noTokensExposed: true,
      authorizationHeadersStored: false,
      cookiesStored: false,
      sessionIdsExposed: false,
      envValuesExposed: false,
      secretsExposed: false,
      tokenValidationEnabled: false,
      sessionBoundaryEnabled: false,
      externalCallsEnabled: false
    })
  };

  const providers: EnterpriseProviderReadModel = {
    config: objectValue(data.providerAbstractionConfig),
    catalog: arrayValue(data.providerCatalog),
    authTypes: Array.isArray(data.providerAuthTypes) ? data.providerAuthTypes.filter((item): item is string => typeof item === "string") : [],
    localCliTemplates: arrayValue(data.providerLocalCliTemplates),
    localCliCompatibilityRules: arrayValue(data.providerLocalCliCompatibilityRules),
    localCliParserProfiles: arrayValue(data.providerLocalCliParserProfiles),
    localCliSecurityConstraints: arrayValue(data.providerLocalCliSecurityConstraints),
    localCliReadiness: objectValue(data.providerLocalCliReadiness),
    localAgents: arrayValue(data.providerLocalAgents),
    auditEvents: arrayValue(data.providerAuditEvents),
    readiness: sanitizeDashboardObject({
      localCliProviderReadiness: (data.providerInvocation as Record<string, unknown> | undefined)?.status ?? "local_agent_required",
      credentialCacheAccess: "denied",
      directLocalCliExecution: "blocked",
      secretForwarding: "denied",
      ptySupport: "unsupported"
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

  const mcp: MCPGatewayReadModel = {
    config: sanitizeDashboardObject({
      gatewayKind: "mock",
      mockGatewayEnabled: true,
      realTransportEnabled: false,
      serverCount: 5,
      activeToolCount: 6,
      highCriticalEnabledToolCount: 0,
      externalCallsEnabled: false,
      secretForwardingEnabled: false,
      networkAccessEnabled: false
    }),
    servers: sanitizeDashboardArray([
      { id: "mock-github-mcp", serverKind: "mock", status: "active" },
      { id: "mock-docs-search-mcp", serverKind: "mock", status: "active" },
      { id: "mock-jira-mcp", serverKind: "mock", status: "active" }
    ]),
    tools: sanitizeDashboardArray([
      { id: "github.get_issue", riskLevel: "low", status: "active" },
      { id: "docs.search", riskLevel: "low", status: "active" },
      { id: "db.run_write_query", riskLevel: "critical", status: "disabled" }
    ]),
    riskSummary: sanitizeDashboardObject({ low: 2, high: 0, critical: 1, highCriticalEnabled: 0 }),
    invocations: [],
    auditEvents: [],
    blockedExamples: sanitizeDashboardArray([
      { operation: "mcp.real_transport", reason: "real_mcp_transport_disabled" },
      { operation: "mcp.tool.secret.resolve", reason: "secret_forwarding_disabled_v0" },
      { operation: "mcp.tool.network_access", reason: "network_access_denied_by_default" }
    ]),
    integration: sanitizeDashboardObject({
      llmAutoToolExecution: false,
      runnerDirectToolExecution: false,
      localAgentMcpTransport: "future_placeholder_disabled",
      secretsExposed: false
    })
  };

  const readiness: DeploymentReadinessReadModel = {
    summary: sanitizeDashboardObject({
      currentProfileId: "local",
      productionReadinessStatus: "blocked",
      productionReady: false,
      criticalBlockerCount: 5,
      highRiskOpenCount: 5,
      planningOnly: true,
      noSecretsExposed: true
    }),
    profiles: sanitizeDashboardArray([
      { id: "local", storageMode: "in_memory", authMode: "mock", secretMode: "metadata_only_env_optional" },
      { id: "integration", storageMode: "postgres_optional", authMode: "mock", secretMode: "secretref_env" },
      { id: "staging", storageMode: "postgres_required", authMode: "future_oidc_saml", secretMode: "real_secret_backend_required" },
      { id: "production", storageMode: "postgres_required", authMode: "production_required", secretMode: "real_secret_backend_required" }
    ]),
    checks: sanitizeDashboardArray([
      { id: "production_auth_required", profileId: "production", status: "fail", severity: "critical", category: "identity" },
      { id: "production_secret_backend_required", profileId: "production", status: "fail", severity: "critical", category: "secrets" },
      { id: "production_postgres_required", profileId: "production", status: "fail", severity: "critical", category: "database" }
    ]),
    risks: sanitizeDashboardArray([
      { id: "risk_mock_auth_in_production", severity: "critical", status: "open", title: "Mock auth accidentally promoted" },
      { id: "risk_env_secret_provider", severity: "critical", status: "open", title: "Env SecretRef provider is insufficient for production" }
    ]),
    productionBlockers: sanitizeDashboardArray([
      { id: "production_auth_required", name: "Production Auth/RBAC required", severity: "critical" },
      { id: "production_secret_backend_required", name: "Production secret backend required", severity: "critical" }
    ]),
    environmentWarnings: [
      "mock_actor_warning",
      "in_memory_repository_warning",
      "missing_production_auth_warning",
      "missing_real_secret_backend_warning"
    ],
    missingProductionRequirements: [
      "Production Auth/RBAC required",
      "Production secret backend required",
      "Production Postgres and migrations required"
    ],
    noSecretsExposed: true
  };

  const database: DatabaseOperationsReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      storageProviderKind: "in_memory",
      databaseUrlConfigured: false,
      testDatabaseUrlConfigured: false,
      migrationRunnerAvailable: true,
      migrationFileCount: 1,
      schemaInventoryCount: 11,
      indexReviewItemCount: 11,
      readinessCheckCount: 9,
      criticalBlockerCount: 2,
      riskCount: 5,
      poolingStatus: "planned_not_enabled",
      backupStatus: "planned_not_configured",
      restoreStatus: "planned_not_tested",
      retentionDeletionJobsEnabled: false,
      productionDbConnectionAttempted: false,
      noSecretsExposed: true,
      databaseUrlExposed: false
    }),
    profiles: sanitizeDashboardArray([
      { id: "local", status: "partial", storageProvider: "in_memory", postgresRequired: false },
      { id: "integration", status: "ready_for_testing", storageProvider: "postgres", postgresRequired: false },
      { id: "staging", status: "not_ready", storageProvider: "postgres_required", postgresRequired: true },
      { id: "production", status: "not_ready", storageProvider: "postgres_required", postgresRequired: true }
    ]),
    checks: sanitizeDashboardArray([
      { id: "db_pooling_required", category: "pooling", status: "fail", severity: "critical" },
      { id: "db_backup_restore_required", category: "backup", status: "fail", severity: "critical" },
      { id: "db_retention_no_deletion_v1", category: "retention", status: "fail", severity: "high" },
      { id: "db_webhook_dedupe_persistence_required", category: "webhook_dedupe", status: "fail", severity: "high" }
    ]),
    risks: sanitizeDashboardArray([
      { id: "risk_db_psql_cli_runtime", severity: "critical", status: "open", title: "Per-query psql client is not production-grade" },
      { id: "risk_db_audit_growth_unbounded", severity: "high", status: "open", title: "Audit and event tables can grow without operational controls" }
    ]),
    migrations: sanitizeDashboardArray([
      { id: "migration_0001_initial_aichestra_schema_sql", name: "0001_initial_aichestra_schema.sql", status: "pending", checksum: "sha256:demo" }
    ]),
    schemaInventory: sanitizeDashboardArray([
      { tableName: "tasks", ownerModule: "core", highGrowth: false },
      { tableName: "git_webhook_events", ownerModule: "git-adapter", highGrowth: true },
      { tableName: "observability_audit_events", ownerModule: "observability", highGrowth: true, futureOnly: true }
    ]),
    indexReview: sanitizeDashboardArray([
      { tableName: "tasks", status: "recommended", recommendedIndex: "idx_tasks_repo_status_created_at" },
      { tableName: "git_webhook_events", status: "recommended", recommendedIndex: "delivery_id unique future" },
      { tableName: "observability_audit_events", status: "future", recommendedIndex: "category,created_at" }
    ]),
    retentionPlan: sanitizeDashboardObject({
      status: "planning_only",
      deletionJobsEnabled: false,
      partitioningImplemented: false,
      legalHoldImplemented: false,
      highGrowthTables: ["audit_events", "git_webhook_events", "llm_audit_events"]
    }),
    auditGrowthPlan: sanitizeDashboardObject({
      status: "planning_only",
      noDeletionInV1: true,
      partitioningCandidates: ["audit_events", "git_webhook_events", "observability_audit_events_future"]
    }),
    webhookPersistencePlan: sanitizeDashboardObject({
      status: "planning_only",
      deliveryIdUniqueness: "required",
      payloadHashStrategy: "sha256_metadata_only",
      backgroundWorkerImplemented: false,
      rawPayloadStorage: false
    }),
    criticalRisks: sanitizeDashboardArray([
      { id: "risk_db_psql_cli_runtime", severity: "critical" },
      { id: "risk_db_backup_restore_absent", severity: "critical" }
    ]),
    blockers: sanitizeDashboardArray([
      { id: "db_pooling_required", severity: "critical" },
      { id: "db_backup_restore_required", severity: "critical" }
    ]),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      databaseUrlExposed: false,
      databaseUrlValueReturned: false,
      productionDbConnectionAttempted: false,
      destructiveOperationsEnabled: false,
      retentionDeletionJobsEnabled: false
    })
  };

  const collaborationStores: DurableCollaborationStoresReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      providerKind: "in_memory",
      defaultRuntime: "in_memory",
      durableCollaborationStoreConfigured: false,
      productionReady: false,
      repositoryGroupCount: 9,
      implementedRepositoryGroupCount: 9,
      requiredDurableRecordCount: 28,
      recommendedDurableRecordCount: 4,
      ephemeralRecordCount: 3,
      postgresTableCount: 28,
      migrationCoverage: "v1_schema_skeleton",
      optionalPostgresSupported: true,
      optionalPostgresTestsConfigured: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      databaseUrlExposed: false,
      remoteGitOperationsExecuted: false,
      workspaceMutationExecuted: false,
      externalCallsExecuted: false
    }),
    inventory: sanitizeDashboardArray([
      { modelName: "BranchOwnershipRecord", classification: "required_durable", group: "branch_orchestration", repositoryNeeded: true, postgresTableNeeded: true, migrationStatus: "implemented_skeleton" },
      { modelName: "AgentWorkspaceLease", classification: "required_durable", group: "agent_workspace", repositoryNeeded: true, postgresTableNeeded: true, migrationStatus: "implemented_skeleton" },
      { modelName: "AgentSession", classification: "required_durable", group: "agent_session_coordination", repositoryNeeded: true, postgresTableNeeded: true, migrationStatus: "implemented_skeleton" },
      { modelName: "EditIntent", classification: "required_durable", group: "edit_intent", repositoryNeeded: true, postgresTableNeeded: true, migrationStatus: "implemented_skeleton" },
      { modelName: "MergeReadinessDecision", classification: "required_durable", group: "merge_queue_policy", repositoryNeeded: true, postgresTableNeeded: true, migrationStatus: "implemented_skeleton" },
      { modelName: "ConflictResolutionPlan", classification: "required_durable", group: "conflict_resolution", repositoryNeeded: true, postgresTableNeeded: true, migrationStatus: "implemented_skeleton" }
    ]),
    repositories: sanitizeDashboardArray([
      { group: "branch_orchestration", label: "Branch Orchestration", providerKind: "in_memory", implemented: true, recordCount: 0, eventCount: 0 },
      { group: "agent_session_coordination", label: "Agent Session Coordination", providerKind: "in_memory", implemented: true, recordCount: 0, eventCount: 0 },
      { group: "agent_workspace", label: "Agent Workspace Lifecycle", providerKind: "in_memory", implemented: true, recordCount: 0, eventCount: 0 },
      { group: "agent_worktree_allocation", label: "Agent Worktree Allocation", providerKind: "in_memory", implemented: true, recordCount: 0, eventCount: 0 },
      { group: "edit_intent", label: "File Lease / Edit Intent Graph", providerKind: "in_memory", implemented: true, recordCount: 0, eventCount: 0 },
      { group: "merge_queue_policy", label: "Merge Queue Policy", providerKind: "in_memory", implemented: true, recordCount: 0, eventCount: 0 },
      { group: "conflict_resolution", label: "Conflict Resolution Assistant", providerKind: "in_memory", implemented: true, recordCount: 0, eventCount: 0 },
      { group: "pr_ownership", label: "PR Ownership / Handoff", providerKind: "in_memory", implemented: true, recordCount: 0, eventCount: 0 },
      { group: "cleanup_recovery", label: "Branch Cleanup / Orphan Recovery", providerKind: "in_memory", implemented: true, recordCount: 0, eventCount: 0 }
    ]),
    schema: sanitizeDashboardObject({
      status: "implemented_skeleton",
      tableCount: 28,
      eventTableName: "durable_collaboration_events",
      safeColumnsOnly: true,
      credentialColumnsPresent: false,
      envValueColumnsPresent: false,
      databaseUrlColumnsPresent: false,
      rawPayloadColumnsPresent: false
    }),
    safety: sanitizeDashboardObject({
      defaultRuntime: "in_memory",
      durableCollaborationStoreConfigured: false,
      productionReady: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      databaseUrlExposed: false,
      remoteGitOperationsExecuted: false,
      workspaceMutationExecuted: false,
      externalCallsExecuted: false,
      rawPayloadStorageAllowed: false,
      credentialStorageAllowed: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      databaseUrlExposed: false,
      databaseUrlValueReturned: false,
      credentialStorageAllowed: false,
      rawPayloadStorageAllowed: false
    })
  };

  const secretBackend: SecretBackendMigrationReadModel = {
    summary: sanitizeDashboardObject({
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      currentProfileId: "local",
      realSecretBackendConfigured: false,
      externalCallsEnabled: false,
      credentialResolutionAttempted: false,
      rotationJobsImplemented: false,
      productionCredentialIssuanceImplemented: false,
      credentialCachesRead: false,
      envFallbackAllowedForCurrentProfile: true,
      envFallbackWarning: "env_fallback_allowed_for_local_only",
      envSecretProviderEnabled: false,
      allowedSecretEnvKeyCount: 0,
      legacyEnvFallbackProductionReady: false,
      backendOptionCount: 7,
      recommendedBackendCount: 4,
      migrationPhaseCount: 6,
      readinessCheckCount: 11,
      criticalBlockerCount: 2,
      riskCount: 6,
      rotationPlanCount: 9,
      leasePolicyCount: 7,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    backendOptions: sanitizeDashboardArray([
      { id: "secret_backend_vault", backendKind: "vault", status: "recommended", productionRecommended: true, operationalComplexity: "high" },
      { id: "secret_backend_aws_secrets_manager", backendKind: "aws_secrets_manager", status: "planned", productionRecommended: true, operationalComplexity: "medium" },
      { id: "secret_backend_env_legacy", backendKind: "env_legacy", status: "not_recommended", productionRecommended: false, operationalComplexity: "low" },
      { id: "secret_backend_mock", backendKind: "mock", status: "allowed_for_integration", productionRecommended: false, operationalComplexity: "low" }
    ]),
    migrationPhases: sanitizeDashboardArray([
      { id: "secret_migration_phase_1_inventory", order: 1, status: "ready_for_design", name: "Inventory SecretRefs and legacy env fallbacks" },
      { id: "secret_migration_phase_3_core_credentials", order: 3, status: "planned", name: "Migrate GitHub, webhook, and LLM credentials" },
      { id: "secret_migration_phase_6_disable_env_fallback", order: 6, status: "blocked", name: "Disable env fallback for staging and production" }
    ]),
    readinessChecks: sanitizeDashboardArray([
      { id: "secret_backend_selection_required", category: "backend_selection", status: "fail", severity: "critical" },
      { id: "secret_env_fallback_blocked_for_production", category: "env_fallback", status: "fail", severity: "critical" },
      { id: "secret_ref_schema_metadata_only", category: "secret_ref_schema", status: "pass", severity: "medium" },
      { id: "secret_dashboard_panel_available", category: "dashboard", status: "pass", severity: "low" }
    ]),
    risks: sanitizeDashboardArray([
      { id: "risk_secret_env_fallback_in_production", severity: "critical", status: "open", title: "Legacy env fallback used in production" },
      { id: "risk_secret_backend_outage", severity: "high", status: "open", title: "Secret backend outage blocks provider operations" }
    ]),
    rotationPlans: sanitizeDashboardArray([
      { id: "rotation_github_token", secretKind: "github_token", status: "planned", rotationMode: "manual", targetIntervalDays: 90 },
      { id: "rotation_github_webhook_secret", secretKind: "github_webhook_secret", status: "planned", rotationMode: "manual", targetIntervalDays: 180 },
      { id: "rotation_llm_api_key", secretKind: "llm_api_key", status: "planned", rotationMode: "manual", targetIntervalDays: 90 }
    ]),
    leasePolicies: sanitizeDashboardArray([
      { id: "lease_policy_github_token", secretKind: "github_token", status: "planned", maxTtlSeconds: 3600, requiresApproval: true },
      { id: "lease_policy_github_webhook_secret", secretKind: "github_webhook_secret", status: "planned", maxTtlSeconds: 300, requiresApproval: false },
      { id: "lease_policy_llm_api_key", secretKind: "llm_api_key", status: "planned", maxTtlSeconds: 1800, requiresApproval: true }
    ]),
    blockers: sanitizeDashboardArray([
      { id: "secret_backend_selection_required", severity: "critical" },
      { id: "secret_env_fallback_blocked_for_production", severity: "critical" }
    ]),
    credentialKindStatus: sanitizeDashboardArray([
      { secretKind: "github_token", rotationStatus: "planned", leaseStatus: "planned", noSecretValueExposed: true },
      { secretKind: "github_webhook_secret", rotationStatus: "planned", leaseStatus: "planned", noSecretValueExposed: true },
      { secretKind: "llm_api_key", rotationStatus: "planned", leaseStatus: "planned", noSecretValueExposed: true }
    ]),
    envFallback: sanitizeDashboardObject({
      allowedForCurrentProfile: true,
      warning: "env_fallback_allowed_for_local_only",
      envSecretProviderEnabled: false,
      allowedSecretEnvKeyCount: 0,
      productionReady: false,
      envValuesExposed: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      credentialCachesRead: false,
      credentialResolutionAttempted: false,
      rotationJobsImplemented: false,
      productionCredentialIssuanceImplemented: false,
      externalCallsEnabled: false
    })
  };

  const secretBackendDecision: SecretBackendDecisionReadModel = {
    summary: sanitizeDashboardObject({
      status: "v0_implemented",
      planningOnly: true,
      decisionStatus: "accepted_mock",
      recommendedBackend: "vault",
      secondChoiceBackend: "aws_secrets_manager_future",
      implementationReady: true,
      productionSecretBackendImplemented: false,
      envFallbackProductionAllowed: false,
      externalCallsEnabled: false,
      secretReadsAttempted: false,
      secretRotationsAttempted: false,
      secretMigrationsAttempted: false,
      productionCredentialsIssued: false,
      credentialCachesRead: false,
      criterionCount: 20,
      scoreCount: 8,
      implementationScopeCount: 1,
      riskCount: 15,
      criticalRiskCount: 4,
      providerMappingCount: 7,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    decision: sanitizeDashboardObject({
      id: "production_secret_backend_option_decision_v0",
      recommendedBackend: "vault",
      secondChoiceBackend: "aws_secrets_manager_future",
      decisionStatus: "accepted_mock",
      implementationScopeRef: "docs/roadmaps/production-secret-backend-option-decision/implementation-scope-v1.md"
    }),
    criteria: sanitizeDashboardArray([
      { id: "security_posture", weight: 10 },
      { id: "secretref_compatibility", weight: 10 },
      { id: "lease_ttl_support", weight: 9 },
      { id: "audit_capability", weight: 9 }
    ]),
    scores: sanitizeDashboardArray([
      { id: "score_vault_security_posture", backendKind: "vault", criterionId: "security_posture", score: 5, weightedScore: 50 },
      { id: "score_aws_security_posture", backendKind: "aws_secrets_manager_future", criterionId: "security_posture", score: 4, weightedScore: 40 },
      { id: "score_env_production_suitability", backendKind: "env", criterionId: "security_posture", score: 1, weightedScore: 10 }
    ]),
    implementationScopes: sanitizeDashboardArray([
      { id: "vault_secret_backend_implementation_scope_v1", backendKind: "vault", version: "v1", status: "v1_implemented" }
    ]),
    providerMappings: sanitizeDashboardArray([
      { id: "secret_backend_provider_mapping_vault", providerValue: "vault", productionStatus: "v1_implemented_gated" },
      { id: "secret_backend_provider_mapping_env", providerValue: "env", productionStatus: "local_integration_only" },
      { id: "secret_backend_provider_mapping_mock", providerValue: "mock", productionStatus: "test_only" }
    ]),
    risks: sanitizeDashboardArray([
      { id: "secret_decision_risk_env_fallback_production", severity: "critical", status: "open" },
      { id: "secret_decision_risk_overbroad_iam", severity: "critical", status: "open" },
      { id: "secret_decision_risk_backend_outage", severity: "high", status: "open" }
    ]),
    backendScoreSummary: sanitizeDashboardArray([
      { backendKind: "vault", weightedScore: 120, scoreCount: 3 },
      { backendKind: "aws_secrets_manager_future", weightedScore: 40, scoreCount: 1 },
      { backendKind: "env", weightedScore: 10, scoreCount: 1 }
    ]),
    envFallbackWarning: sanitizeDashboardObject({
      productionAllowed: false,
      recommendedAsProductionDefault: false,
      policy: "env fallback remains local/integration only and must not be production primary storage"
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      externalCallsEnabled: false,
      secretReadsAttempted: false,
      secretRotationsAttempted: false,
      secretMigrationsAttempted: false,
      productionCredentialsIssued: false,
      credentialCachesRead: false,
      productionSecretBackendImplemented: false
    })
  };

  const vaultSecretBackend: VaultSecretBackendReadModel = {
    summary: sanitizeDashboardObject({
      status: "disabled",
      provider: "vault",
      selectedProvider: "mock",
      vaultProviderEnabled: false,
      vaultAddressConfigured: false,
      vaultNamespaceConfigured: false,
      vaultAuthMethod: "token",
      vaultAllowedPathPrefixCount: 0,
      vaultIntegrationTestsEnabled: false,
      vaultClientKind: "disabled",
      liveUsageReady: false,
      checkCount: 6,
      failingCheckCount: 0,
      productionSecretBackendImplemented: false,
      envFallbackProductionAllowed: false,
      noSecretsExposed: true,
      noEnvValuesExposed: true,
      containsSecretMaterial: false
    }),
    config: sanitizeDashboardObject({
      selectedProvider: "mock",
      vaultProviderEnabled: false,
      vaultAddressConfigured: false,
      vaultNamespaceConfigured: false,
      vaultAuthMethod: "token",
      vaultTokenConfigured: false,
      vaultAllowedPathPrefixCount: 0,
      vaultIntegrationTestsEnabled: false,
      liveUsageReady: false,
      configStatus: "disabled",
      productionSecretBackendImplemented: false,
      envFallbackProductionAllowed: false
    }),
    health: sanitizeDashboardObject({
      clientKind: "disabled",
      status: "disabled",
      configStatus: "disabled",
      liveCallAttempted: false,
      containsSecretMaterial: false
    }),
    checks: sanitizeDashboardArray([
      { id: "vault_provider_non_default", category: "config", status: "pass", severity: "low" },
      { id: "vault_enable_gate", category: "config", status: "skipped", severity: "medium" },
      { id: "vault_default_tests_skip_live", category: "tests", status: "pass", severity: "medium" }
    ]),
    auditEvents: sanitizeDashboardArray([]),
    secretRefExamples: sanitizeDashboardArray([]),
    blockedExamples: sanitizeDashboardArray([
      { operation: "vault.default_runtime_call", reason: "vault_provider_disabled_by_default" },
      { operation: "vault.token_exposure", reason: "vault_token_never_returned" }
    ]),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      noEnvValuesExposed: true,
      vaultTokenExposed: false,
      vaultSecretValueExposed: false,
      credentialCachesRead: false,
      liveVaultCallAttemptedByDashboard: false,
      productionSecretBackendImplemented: false
    })
  };

  const vaultIntegration: VaultIntegrationTestReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      profileStatus: "disabled",
      backendKind: "vault",
      liveTestsEnabled: false,
      canRunLiveTests: false,
      defaultLiveTestsSkipped: true,
      requiredGateCount: 10,
      configuredGateCount: 0,
      missingGateCount: 10,
      unsafeGateCount: 0,
      vaultBackendSelected: false,
      vaultProviderEnabled: false,
      vaultAddressConfigured: false,
      vaultNamespaceConfigured: false,
      vaultAuthMethod: "token",
      vaultAuthMethodConfigured: false,
      vaultTokenConfigured: false,
      vaultKvMountConfigured: false,
      pathAllowlistConfigured: false,
      pathAllowlistPrefixCount: 0,
      testSecretPathConfigured: false,
      testSecretKeyConfigured: false,
      testSecretPathAllowlisted: false,
      testSecretPathLooksTestOnly: false,
      credentialSource: "none",
      envFallbackUsed: false,
      testCaseCount: 8,
      gatedLiveTestCaseCount: 2,
      mockTestCaseCount: 6,
      noWrite: true,
      noDelete: true,
      noRotate: true,
      noBroadList: true,
      noSecretsExposed: true,
      envValuesExposed: false,
      vaultTokenExposed: false,
      vaultAddressValueExposed: false,
      vaultSecretValueExposed: false,
      vaultCallsInDefaultTests: false
    }),
    profile: sanitizeDashboardObject({
      id: "vault_integration_test_profile_v1",
      name: "Vault Integration-Test Profile v1",
      status: "disabled",
      backendKind: "vault",
      allowedOperations: ["config_validation", "secretref_validation", "path_allowlist", "kv_v2_read_status_only", "credential_resolution_status_only"],
      forbiddenOperations: ["write", "delete", "rotate", "broad_list", "production_secret_path", "raw_secret_return", "vault_token_return", "env_value_return"]
    }),
    testCases: sanitizeDashboardArray([
      { id: "vault_it_config_validation", category: "config_validation", enabledByDefault: true, requiresLiveVault: false, status: "active_mock" },
      { id: "vault_it_secretref_validation", category: "secretref_validation", enabledByDefault: true, requiresLiveVault: false, status: "active_mock" },
      { id: "vault_it_path_allowlist", category: "path_allowlist", enabledByDefault: true, requiresLiveVault: false, status: "active_mock" },
      { id: "vault_it_kv_v2_read_gated", category: "kv_v2_read", enabledByDefault: false, requiresLiveVault: true, status: "gated_live" },
      { id: "vault_it_credential_resolution_gated", category: "credential_resolution", enabledByDefault: false, requiresLiveVault: true, status: "gated_live" },
      { id: "vault_it_auth_policy_gate", category: "auth_policy_gate", enabledByDefault: true, requiresLiveVault: false, status: "active_mock" },
      { id: "vault_it_audit_redaction", category: "audit_redaction", enabledByDefault: true, requiresLiveVault: false, status: "active_mock" },
      { id: "vault_it_no_secret_exposure", category: "no_secret_exposure", enabledByDefault: true, requiresLiveVault: false, status: "active_mock" }
    ]),
    gatedLiveTestCases: sanitizeDashboardArray([
      { id: "vault_it_kv_v2_read_gated", category: "kv_v2_read" },
      { id: "vault_it_credential_resolution_gated", category: "credential_resolution" }
    ]),
    mockTestCases: sanitizeDashboardArray([
      { id: "vault_it_config_validation", category: "config_validation" },
      { id: "vault_it_secretref_validation", category: "secretref_validation" },
      { id: "vault_it_path_allowlist", category: "path_allowlist" },
      { id: "vault_it_auth_policy_gate", category: "auth_policy_gate" },
      { id: "vault_it_audit_redaction", category: "audit_redaction" },
      { id: "vault_it_no_secret_exposure", category: "no_secret_exposure" }
    ]),
    safetyChecks: sanitizeDashboardArray([
      { id: "vault_it_env_gates_missing_skip", category: "env_gates", status: "warning", severity: "high" },
      { id: "vault_it_vault_address_boolean_only", category: "vault_address", status: "warning", severity: "medium" },
      { id: "vault_it_token_presence_boolean_only", category: "token_presence", status: "warning", severity: "critical" },
      { id: "vault_it_path_allowlist_required", category: "path_allowlist", status: "warning", severity: "critical" },
      { id: "vault_it_test_path_required", category: "test_secret_path", status: "warning", severity: "critical" },
      { id: "vault_it_no_write", category: "no_write", status: "pass", severity: "critical" },
      { id: "vault_it_no_delete", category: "no_delete", status: "pass", severity: "critical" },
      { id: "vault_it_no_rotate", category: "no_rotate", status: "pass", severity: "critical" },
      { id: "vault_it_no_broad_list", category: "no_broad_list", status: "pass", severity: "critical" },
      { id: "vault_it_no_secret_exposure", category: "no_secret_exposure", status: "pass", severity: "critical" }
    ]),
    blockers: sanitizeDashboardArray([]),
    warnings: sanitizeDashboardArray([
      { id: "vault_it_env_gates_missing_skip", severity: "high" },
      { id: "vault_it_path_allowlist_required", severity: "critical" },
      { id: "vault_it_test_path_required", severity: "critical" }
    ]),
    gateStatus: sanitizeDashboardObject({
      requiredGateCount: 10,
      configuredGateCount: 0,
      missingGateCount: 10,
      unsafeGateCount: 0,
      vaultBackendSelected: false,
      vaultProviderEnabled: false,
      vaultAddressConfigured: false,
      vaultNamespaceConfigured: false,
      vaultAuthMethod: "token",
      vaultTokenConfigured: false,
      pathAllowlistPrefixCount: 0,
      testSecretPathConfigured: false,
      testSecretKeyConfigured: false,
      testSecretPathAllowlisted: false,
      testSecretPathLooksTestOnly: false,
      rawAddressReturned: false,
      rawPathReturned: false
    }),
    operationPolicy: sanitizeDashboardObject({
      noWrite: true,
      noDelete: true,
      noRotate: true,
      noBroadList: true,
      cleanupRequired: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      vaultTokenExposed: false,
      vaultAddressExposed: false,
      vaultSecretValueExposed: false,
      vaultCallsInDefaultTests: false,
      credentialCachesRead: false
    })
  };

  const mergeQueueIntegration: MergeQueueIntegrationTestReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      productionReady: false,
      profileStatus: "disabled",
      liveTestsEnabled: false,
      canRunLiveTests: false,
      defaultLiveTestsSkipped: true,
      requiredGateCount: 9,
      configuredGateCount: 0,
      missingGateCount: 9,
      unsafeGateCount: 0,
      gitProviderConfigured: false,
      gitProviderAllowed: false,
      remoteGitEnabled: false,
      githubIntegrationProfileEnabled: false,
      allowedRepoCount: 0,
      requiredBranchPrefix: "aichestra/test/",
      branchPrefixConfigured: false,
      branchPrefixMatchesRequired: false,
      testRepoConfigured: false,
      testRepoAllowlisted: false,
      testBaseBranchConfigured: false,
      testSourceBranchCount: 0,
      testSourceBranchesMatchPrefix: false,
      baseBranchDistinctFromSources: false,
      dryRunOnly: false,
      autoMergeForbidden: true,
      remoteMergeForbidden: true,
      remoteRebaseForbidden: true,
      remoteForcePushForbidden: true,
      remoteBranchDeleteForbidden: true,
      cleanupPolicy: "manual_mark_only",
      branchDeletionAllowed: false,
      testCaseCount: 8,
      gatedLiveTestCaseCount: 1,
      activeMockTestCaseCount: 7,
      noAutoMerge: true,
      noForcePush: true,
      noBranchDelete: true,
      noSecretsExposed: true,
      envValuesExposed: false,
      repoUrlsExposed: false,
      branchNamesExposed: false,
      remoteGitCallsInDefaultTests: false,
      realMergeExecuted: false
    }),
    profile: sanitizeDashboardObject({
      id: "merge_queue_integration_test_profile_v1",
      name: "Merge Queue live integration-test profile v1",
      status: "disabled",
      requiredBranchPrefix: "aichestra/test/",
      cleanupPolicy: "manual_mark_only",
      allowedOperations: ["config_validation", "queue_readiness_metadata_evaluation", "local_dry_run_merge_simulation_only", "policy_decision_metadata_check"],
      forbiddenOperations: ["real_merge_execution", "auto_merge", "remote_merge_api_call", "remote_rebase", "remote_force_push", "remote_branch_delete"]
    }),
    testCases: sanitizeDashboardArray([
      { id: "mq_it_config_validation", category: "config_validation", enabledByDefault: true, requiresLiveGit: false, status: "active_mock" },
      { id: "mq_it_queue_readiness", category: "queue_readiness", enabledByDefault: true, requiresLiveGit: false, status: "active_mock" },
      { id: "mq_it_dry_run_merge_local", category: "dry_run_merge", enabledByDefault: true, requiresLiveGit: false, status: "active_mock" },
      { id: "mq_it_branch_lease_check", category: "branch_lease_check", enabledByDefault: true, requiresLiveGit: false, status: "active_mock" },
      { id: "mq_it_conflict_risk_check", category: "conflict_risk_check", enabledByDefault: true, requiresLiveGit: false, status: "active_mock" },
      { id: "mq_it_policy_decision_check", category: "policy_decision_check", enabledByDefault: true, requiresLiveGit: false, status: "active_mock" },
      { id: "mq_it_cleanup_check", category: "cleanup_check", enabledByDefault: true, requiresLiveGit: false, status: "active_mock" },
      { id: "mq_it_live_dry_run_evaluation_gated", category: "queue_readiness", enabledByDefault: false, requiresLiveGit: true, status: "gated_live" }
    ]),
    gatedLiveTestCases: sanitizeDashboardArray([
      { id: "mq_it_live_dry_run_evaluation_gated", category: "queue_readiness" }
    ]),
    mockTestCases: sanitizeDashboardArray([
      { id: "mq_it_config_validation", category: "config_validation" },
      { id: "mq_it_queue_readiness", category: "queue_readiness" },
      { id: "mq_it_dry_run_merge_local", category: "dry_run_merge" },
      { id: "mq_it_branch_lease_check", category: "branch_lease_check" },
      { id: "mq_it_conflict_risk_check", category: "conflict_risk_check" },
      { id: "mq_it_policy_decision_check", category: "policy_decision_check" },
      { id: "mq_it_cleanup_check", category: "cleanup_check" }
    ]),
    safetyChecks: sanitizeDashboardArray([
      { id: "mq_it_env_gates_missing_skip", category: "env_gates", status: "warning", severity: "high" },
      { id: "mq_it_repo_allowlist_required", category: "repo_allowlist", status: "warning", severity: "critical" },
      { id: "mq_it_branch_prefix_required", category: "branch_prefix", status: "warning", severity: "critical" },
      { id: "mq_it_no_auto_merge", category: "no_auto_merge", status: "pass", severity: "critical" },
      { id: "mq_it_no_force_push", category: "no_force_push", status: "pass", severity: "critical" },
      { id: "mq_it_no_branch_delete", category: "no_branch_delete", status: "pass", severity: "critical" },
      { id: "mq_it_dry_run_only", category: "dry_run_only", status: "warning", severity: "critical" },
      { id: "mq_it_cleanup_manual", category: "cleanup", status: "pass", severity: "high" },
      { id: "mq_it_audit_sanitized", category: "audit", status: "pass", severity: "high" }
    ]),
    blockers: sanitizeDashboardArray([]),
    warnings: sanitizeDashboardArray([
      { id: "mq_it_env_gates_missing_skip", severity: "high" },
      { id: "mq_it_repo_allowlist_required", severity: "critical" },
      { id: "mq_it_branch_prefix_required", severity: "critical" },
      { id: "mq_it_dry_run_only", severity: "critical" }
    ]),
    gateStatus: sanitizeDashboardObject({
      configuredGateCount: 0,
      missingGateCount: 9,
      unsafeGateCount: 0,
      gitProviderAllowed: false,
      remoteGitEnabled: false,
      githubIntegrationProfileEnabled: false,
      allowedRepoCount: 0,
      requiredBranchPrefix: "aichestra/test/",
      branchPrefixConfigured: false,
      branchPrefixMatchesRequired: false,
      testRepoConfigured: false,
      testRepoAllowlisted: false,
      testBaseBranchConfigured: false,
      testSourceBranchCount: 0,
      testSourceBranchesMatchPrefix: false,
      baseBranchDistinctFromSources: false,
      envValuesReturned: false,
      repoUrlsReturned: false,
      branchNamesReturned: false
    }),
    operationPolicy: sanitizeDashboardObject({
      dryRunOnly: false,
      autoMergeForbidden: true,
      remoteMergeForbidden: true,
      remoteRebaseForbidden: true,
      remoteForcePushForbidden: true,
      remoteBranchDeleteForbidden: true,
      realMergeExecuted: false,
      remoteGitCallsInDefaultTests: false
    }),
    cleanupPolicy: sanitizeDashboardObject({
      status: "manual_mark_only",
      branchDeletionAllowed: false,
      manualMarkOnly: true,
      remoteCleanupCallsEnabledByDefault: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      repoUrlsExposed: false,
      branchNamesExposed: false,
      remoteGitCallsInDefaultTests: false,
      realMergeExecuted: false,
      noAutoMerge: true,
      noForcePush: true,
      noBranchDelete: true
    })
  };

  const registryCompatibility: RegistryCompatibilityReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      totalCandidates: 0,
      compatibleCount: 0,
      compatibleWithWarningsCount: 0,
      incompatibleCount: 0,
      blockedByPolicyCount: 0,
      blockedByRegistryGateCount: 0,
      futureUnknownCount: 0,
      ruleCount: 16,
      skillProfileCount: 3,
      harnessProfileCount: 3,
      instructionProfileCount: 2,
      resolverGatesPreserved: true,
      autoApplyEnabled: false,
      registryMutationsExecuted: false,
      externalCallsExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    rules: sanitizeDashboardArray([]),
    skillProfiles: sanitizeDashboardArray([]),
    harnessProfiles: sanitizeDashboardArray([]),
    instructionProfiles: sanitizeDashboardArray([]),
    candidateDecisions: sanitizeDashboardArray([]),
    compatibleCandidates: sanitizeDashboardArray([]),
    warningCandidates: sanitizeDashboardArray([]),
    incompatibleCandidates: sanitizeDashboardArray([]),
    blockedByPolicyCandidates: sanitizeDashboardArray([]),
    blockedByRegistryGateCandidates: sanitizeDashboardArray([]),
    futureUnknownCandidates: sanitizeDashboardArray([]),
    resolverGateRelationship: sanitizeDashboardObject({
      resolverGatesPreserved: true,
      lifecycleGate: "preserved",
      approvalGate: "preserved",
      evalGate: "preserved",
      checksumGate: "preserved",
      semverGate: "preserved",
      compatibilityCanBypassResolver: false
    }),
    scopeRelationship: sanitizeDashboardObject({
      productionTenantEnforcement: false,
      scopeMismatchSeverity: "warning",
      tenantScopeEnforcementImplemented: "partial",
      autoApplyEnabled: false
    }),
    noAutoApplyStatus: sanitizeDashboardObject({
      autoApplyEnabled: false,
      registryMutationsExecuted: false,
      externalCallsExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    })
  };

  const registryDrift: RegistryDriftReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      signalCount: 0,
      baselineCount: 0,
      assessmentCount: 0,
      recommendationCount: 0,
      criticalSignalCount: 0,
      highSignalCount: 0,
      applyAllowed: false,
      registryMutationExecuted: false,
      evalExecuted: false,
      canaryExecuted: false,
      autoImprovementApplied: false,
      externalCallExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    signals: sanitizeDashboardArray([]),
    baselines: sanitizeDashboardArray([]),
    assessments: sanitizeDashboardArray([]),
    recommendations: sanitizeDashboardArray([]),
    criticalAssessments: sanitizeDashboardArray([]),
    degradedAssessments: sanitizeDashboardArray([]),
    watchAssessments: sanitizeDashboardArray([]),
    insufficientDataAssessments: sanitizeDashboardArray([]),
    governanceFollowUps: sanitizeDashboardArray([]),
    noAutoApplyStatus: sanitizeDashboardObject({
      applyAllowed: false,
      autoImprovementApplied: false,
      registryMutationExecuted: false,
      evalExecuted: false,
      canaryExecuted: false,
      externalCallExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    })
  };

  const registryCanaryApply: RegistryCanaryApplyReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      planningOnly: true,
      canaryPlanCount: 0,
      canaryRunCount: 0,
      canaryResultCount: 0,
      canaryVerdictCount: 0,
      applyWorkflowCount: 0,
      applyGateDecisionCount: 0,
      rollbackPlanCount: 0,
      passedCanaryRunCount: 0,
      failedCanaryRunCount: 0,
      warningCanaryRunCount: 0,
      readyForManualApplyCount: 0,
      blockedApplyDecisionCount: 0,
      metadataOnlyApplyDecisionCount: 0,
      externalCanaryExecuted: false,
      realEvalExecuted: false,
      realProviderCallExecuted: false,
      autoApplyEnabled: false,
      activeRegistryMutationAllowed: false,
      applyPerformed: false,
      activeRegistryMutated: false,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    canaryPlans: sanitizeDashboardArray([]),
    canaryRuns: sanitizeDashboardArray([]),
    canaryResults: sanitizeDashboardArray([]),
    canaryVerdicts: sanitizeDashboardArray([]),
    applyWorkflows: sanitizeDashboardArray([]),
    applyGateDecisions: sanitizeDashboardArray([]),
    rollbackPlans: sanitizeDashboardArray([]),
    blockedApplyDecisions: sanitizeDashboardArray([]),
    metadataOnlyApplyDecisions: sanitizeDashboardArray([]),
    noAutoApplyStatus: sanitizeDashboardObject({
      autoApplyEnabled: false,
      activeRegistryMutationAllowed: false,
      applyPerformed: false,
      activeRegistryMutated: false,
      externalCanaryExecuted: false,
      realEvalExecuted: false,
      realProviderCallExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    })
  };

  const staging: StagingDeploymentReadModel = {
    summary: sanitizeDashboardObject({
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      stagingDeployed: false,
      productionTrafficAllowed: false,
      currentProfileId: "local",
      profileStatus: "not_ready",
      requiredComponentCount: 5,
      requiredEnvGateCount: 3,
      forbiddenEnvGateCount: 4,
      integrationGateCount: 10,
      allowedGateCount: 0,
      gatedGateCount: 4,
      blockedGateCount: 2,
      futureGateCount: 4,
      readinessCheckCount: 19,
      criticalBlockerCount: 1,
      warningCount: 4,
      promotionCriteriaCount: 6,
      promotionCriteriaMetCount: 3,
      rollbackCriteriaCount: 5,
      mockActorWarning: "mock_actor_blocked_for_staging_profile",
      envFallbackWarning: "env_fallback_blocked_for_staging_profile",
      postgresRequired: true,
      apiDashboardRequired: true,
      remoteMergeForbidden: true,
      remoteMcpForbidden: true,
      vendorCliForbidden: true,
      deploymentExecuted: false,
      externalCallsEnabled: false,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    profile: sanitizeDashboardObject({
      id: "staging_profile_v0",
      name: "staging",
      status: "not_ready",
      requiredComponents: ["api", "web", "worker", "migration-job", "background-job"],
      requiredStorageMode: "postgres_required",
      requiredAuthMode: "future_oidc_saml",
      requiredSecretMode: "real_secret_backend_required",
      requiredPolicyMode: "managed_bundle_required",
      requiredObservabilityMode: "required_external_stack",
      productionTrafficAllowed: false,
      stagingDeployed: false
    }),
    integrationGates: sanitizeDashboardArray([
      { id: "staging_gate_postgres", integrationKind: "postgres", status: "gated", requiredEnvVars: ["AICHESTRA_STORAGE_PROVIDER"], forbiddenEnvVars: [] },
      { id: "staging_gate_github_app", integrationKind: "github_app", status: "gated", requiredEnvVars: ["AICHESTRA_ENABLE_GITHUB_APP"], forbiddenEnvVars: ["GITHUB_APP_PRIVATE_KEY"] },
      { id: "staging_gate_mcp_remote", integrationKind: "mcp_remote", status: "blocked", requiredEnvVars: [], forbiddenEnvVars: ["AICHESTRA_ENABLE_MCP_REAL_TRANSPORT"] },
      { id: "staging_gate_secret_backend", integrationKind: "secret_backend", status: "future", requiredEnvVars: ["AICHESTRA_SECRET_BACKEND_PROVIDER"], forbiddenEnvVars: ["AICHESTRA_ENABLE_ENV_SECRET_PROVIDER"] },
      { id: "staging_gate_observability_export", integrationKind: "observability_export", status: "blocked", requiredEnvVars: [], forbiddenEnvVars: ["future observability exporter credentials"] }
    ]),
    readinessChecks: sanitizeDashboardArray([
      { id: "staging_storage_postgres_required", category: "storage", status: "fail", severity: "high" },
      { id: "staging_auth_mock_actor_warning", category: "auth", status: "warning", severity: "critical" },
      { id: "staging_secret_backend_required", category: "secrets", status: "fail", severity: "critical" },
      { id: "staging_mcp_remote_forbidden", category: "mcp", status: "pass", severity: "critical" },
      { id: "staging_dashboard_api_required", category: "dashboard", status: "pass", severity: "medium" }
    ]),
    promotionCriteria: sanitizeDashboardArray([
      { id: "staging_promotion_validation_green", status: "pass", required: true },
      { id: "staging_promotion_postgres_profile", status: "fail", required: true },
      { id: "staging_promotion_destructive_ops_disabled", status: "pass", required: true },
      { id: "staging_promotion_dashboard_api", status: "pass", required: true }
    ]),
    rollbackCriteria: sanitizeDashboardArray([
      { id: "staging_rollback_secret_exposure", severity: "critical", status: "planned" },
      { id: "staging_rollback_external_call_outside_gate", severity: "critical", status: "planned" },
      { id: "staging_rollback_destructive_git_enabled", severity: "critical", status: "planned" },
      { id: "staging_rollback_policy_bypass", severity: "critical", status: "planned" }
    ]),
    blockers: sanitizeDashboardArray([
      { id: "staging_storage_postgres_required", severity: "high" },
      { id: "staging_secret_backend_required", severity: "critical" }
    ]),
    warnings: sanitizeDashboardArray([
      { id: "staging_auth_mock_actor_warning", severity: "critical" },
      { id: "staging_env_fallback_warning_visible", severity: "high" }
    ]),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      deploymentExecuted: false,
      externalCallsEnabled: false,
      productionTrafficAllowed: false,
      stagingDeployed: false
    })
  };

  const stagingDryRun: StagingDeploymentDryRunReadModel = {
    summary: sanitizeDashboardObject({
      status: "v0_implemented",
      planningOnly: true,
      dryRunMode: "read_only",
      overallStatus: "blocked",
      profileStatus: "blocked",
      productionReady: false,
      stagingDeployed: false,
      deploymentExecuted: false,
      externalCallsEnabled: false,
      remoteIntegrationTestsExecuted: false,
      validationCommandsExecuted: false,
      sourceCount: 17,
      requiredSourceCount: 15,
      optionalSourceCount: 2,
      checkCount: 20,
      requiredCheckCount: 14,
      blockerCount: 5,
      criticalBlockerCount: 2,
      warningCount: 8,
      skippedIntegrationProfileCount: 2,
      noSecretsExposed: true,
      envValuesExposed: false,
      productionReadyClaimed: false,
      stagingDeploymentClaimed: false
    }),
    profile: sanitizeDashboardObject({
      id: "staging_dry_run_profile_v0",
      name: "Staging Deployment Dry-run Profile v0",
      status: "blocked",
      dryRunMode: "read_only",
      requiredReadinessSources: ["staging_profile", "ci_cd", "postgres", "secret_backend", "auth_rbac", "policy_bundle", "observability", "dashboard"],
      optionalReadinessSources: ["github_integration_tests", "llm_integration_tests"],
      blockedCapabilities: ["deployment_execution", "external_provider_calls", "remote_merge", "force_push", "branch_deletion", "vendor_cli_execution", "secret_or_env_value_exposure"]
    }),
    sources: sanitizeDashboardArray([
      { id: "staging_dry_run_source_staging_profile", sourceKind: "staging_profile", status: "fail", severity: "critical", summary: "Staging profile exists with rollout blockers." },
      { id: "staging_dry_run_source_postgres", sourceKind: "postgres", status: "fail", severity: "high", summary: "Postgres is required for staging validation." },
      { id: "staging_dry_run_source_secret_backend", sourceKind: "secret_backend", status: "warning", severity: "critical", summary: "Real secret backend is not implemented." },
      { id: "staging_dry_run_source_github_integration_tests", sourceKind: "github_integration_tests", status: "skipped", severity: "medium", summary: "GitHub live profile is skipped by default." },
      { id: "staging_dry_run_source_llm_integration_tests", sourceKind: "llm_integration_tests", status: "skipped", severity: "medium", summary: "LLM live profile is skipped by default." },
      { id: "staging_dry_run_source_dashboard", sourceKind: "dashboard", status: "pass", severity: "low", summary: "Dashboard read model is available." }
    ]),
    requiredSources: sanitizeDashboardArray([
      { id: "staging_dry_run_source_staging_profile", sourceKind: "staging_profile", status: "fail", severity: "critical" },
      { id: "staging_dry_run_source_postgres", sourceKind: "postgres", status: "fail", severity: "high" },
      { id: "staging_dry_run_source_secret_backend", sourceKind: "secret_backend", status: "warning", severity: "critical" },
      { id: "staging_dry_run_source_dashboard", sourceKind: "dashboard", status: "pass", severity: "low" }
    ]),
    optionalSources: sanitizeDashboardArray([
      { id: "staging_dry_run_source_github_integration_tests", sourceKind: "github_integration_tests", status: "skipped", severity: "medium" },
      { id: "staging_dry_run_source_llm_integration_tests", sourceKind: "llm_integration_tests", status: "skipped", severity: "medium" }
    ]),
    checks: sanitizeDashboardArray([
      { id: "dry_run_no_deployment_execution", category: "environment", status: "pass", severity: "critical", requiredForStaging: true },
      { id: "dry_run_no_external_calls", category: "environment", status: "pass", severity: "critical", requiredForStaging: true },
      { id: "dry_run_no_secret_or_env_exposure", category: "security", status: "pass", severity: "critical", requiredForStaging: true },
      { id: "dry_run_remote_merge_forbidden", category: "git", status: "pass", severity: "critical", requiredForStaging: true },
      { id: "dry_run_postgres_staging_required", category: "storage", status: "fail", severity: "high", requiredForStaging: true },
      { id: "dry_run_github_live_profile_classified", category: "github_app", status: "skipped", severity: "medium", requiredForStaging: false },
      { id: "dry_run_llm_live_profile_classified", category: "llm", status: "skipped", severity: "medium", requiredForStaging: false }
    ]),
    requiredChecks: sanitizeDashboardArray([
      { id: "dry_run_no_deployment_execution", status: "pass", severity: "critical" },
      { id: "dry_run_no_external_calls", status: "pass", severity: "critical" },
      { id: "dry_run_no_secret_or_env_exposure", status: "pass", severity: "critical" },
      { id: "dry_run_postgres_staging_required", status: "fail", severity: "high" }
    ]),
    blockers: sanitizeDashboardArray([
      { id: "blocker_dry_run_postgres_staging_required", severity: "high", blockingLevel: "blocks_staging_deployment" },
      { id: "blocker_missing_secret_backend", severity: "critical", blockingLevel: "blocks_staging_deployment" },
      { id: "blocker_mock_auth_production", severity: "critical", blockingLevel: "blocks_production_only" },
      { id: "blocker_observability_backend_missing", severity: "high", blockingLevel: "blocks_staging_deployment" }
    ]),
    criticalBlockers: sanitizeDashboardArray([
      { id: "blocker_missing_secret_backend", severity: "critical", blockingLevel: "blocks_staging_deployment" },
      { id: "blocker_mock_auth_production", severity: "critical", blockingLevel: "blocks_production_only" }
    ]),
    warnings: sanitizeDashboardArray([
      { id: "staging_dry_run_source_github_integration_tests", status: "skipped", severity: "medium" },
      { id: "staging_dry_run_source_llm_integration_tests", status: "skipped", severity: "medium" }
    ]),
    skippedIntegrationProfiles: sanitizeDashboardArray([
      { id: "github_app_integration_test_profile_v1", status: "skipped", skippedByDefault: true },
      { id: "llm_gateway_integration_test_profile_v1", status: "skipped", skippedByDefault: true }
    ]),
    integrationProfiles: sanitizeDashboardArray([
      { id: "github_app_integration_test_profile_v1", status: "skipped", requiredForStaging: false, skippedByDefault: true },
      { id: "llm_gateway_integration_test_profile_v1", status: "skipped", requiredForStaging: false, skippedByDefault: true }
    ]),
    recommendedNextActions: [
      "Keep the dry-run read-only and do not mark staging as deployed.",
      "Choose a real secret backend or document a controlled non-production fallback decision.",
      "Configure Postgres readiness before staging validation."
    ],
    promotionGuidance: [
      "Do not mark staging as deployed from this report.",
      "Resolve staging dry-run and staging deployment blockers before validation."
    ],
    rollbackGuidance: [
      "No rollback action is executed by this read-only profile.",
      "If future validation exposes secrets, revoke credentials out of band and block the dry-run."
    ],
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      deploymentExecuted: false,
      externalCallsEnabled: false,
      remoteIntegrationTestsExecuted: false,
      validationCommandsExecuted: false,
      productionReady: false,
      stagingDeployed: false
    })
  };

  const stagingReleaseCandidate: StagingReleaseCandidateReadModel = {
    summary: sanitizeDashboardObject({
      status: "v0_implemented",
      planningOnly: true,
      overallStatus: "not_ready",
      checklistStatus: "not_ready",
      productionReady: false,
      stagingDeployed: false,
      releaseCreated: false,
      gitTagCreated: false,
      githubReleaseCreated: false,
      deploymentExecuted: false,
      externalCallsEnabled: false,
      remoteIntegrationTestsExecuted: false,
      gateCount: 24,
      requiredGateCount: 13,
      blockerCount: 12,
      criticalBlockerCount: 0,
      signoffCount: 6,
      requiredSignoffCount: 6,
      pendingSignoffCount: 6,
      releaseNoteRequirementCount: 10,
      missingReleaseNoteRequirementCount: 10,
      rollbackItemCount: 9,
      missingRollbackItemCount: 0,
      skippedTestCount: 3,
      noSecretsExposed: true,
      envValuesExposed: false,
      productionReadyClaimed: false,
      stagingDeploymentClaimed: false
    }),
    checklist: sanitizeDashboardObject({
      id: "staging_release_candidate_checklist_v0",
      name: "Staging Release Candidate Checklist v0",
      status: "not_ready",
      requiredValidationGates: ["pnpm lint", "pnpm typecheck", "pnpm test", "pnpm build", "git diff --check", "safe integration compliance scan"],
      optionalIntegrationProfiles: ["optional_postgres_contracts", "github_app_integration_test_profile_v1", "llm_gateway_integration_test_profile_v1", "mcp_real_transport_future", "external_auth_future"],
      allowedSkippedTests: ["optional_postgres_contracts_when_test_database_url_absent", "github_app_live_tests_when_gates_absent", "llm_live_tests_when_gates_absent", "mcp_live_tests_until_real_transport_future", "external_auth_tests_until_production_auth_future"],
      requiredSignoffs: ["engineering_owner", "platform_owner", "security_reviewer", "product_owner", "qa_reviewer", "release_manager"]
    }),
    gates: sanitizeDashboardArray([
      { id: "staging_rc_pnpm_lint", category: "validation", status: "not_checked", required: true, severity: "high" },
      { id: "staging_rc_pnpm_typecheck", category: "validation", status: "not_checked", required: true, severity: "high" },
      { id: "staging_rc_pnpm_test", category: "validation", status: "not_checked", required: true, severity: "high" },
      { id: "staging_rc_pnpm_build", category: "validation", status: "not_checked", required: true, severity: "high" },
      { id: "staging_rc_git_diff_check", category: "validation", status: "not_checked", required: true, severity: "high" },
      { id: "staging_rc_safe_integration_scan", category: "security", status: "not_checked", required: true, severity: "high" },
      { id: "staging_rc_github_integration_profile_documented", category: "git_integration", status: "skipped", required: false, severity: "medium" },
      { id: "staging_rc_llm_integration_profile_documented", category: "llm_integration", status: "skipped", required: false, severity: "medium" },
      { id: "staging_rc_optional_postgres_profile_documented", category: "db", status: "skipped", required: false, severity: "medium" },
      { id: "staging_rc_no_secret_or_env_exposure", category: "security", status: "pass", required: true, severity: "critical" },
      { id: "staging_rc_no_release_or_deployment_execution", category: "security", status: "pass", required: true, severity: "critical" },
      { id: "staging_rc_no_ready_overclaim", category: "docs", status: "pass", required: true, severity: "critical" },
      { id: "staging_rc_dashboard_readiness", category: "dashboard", status: "pass", required: true, severity: "low" }
    ]),
    requiredGates: sanitizeDashboardArray([
      { id: "staging_rc_pnpm_lint", status: "not_checked", severity: "high" },
      { id: "staging_rc_pnpm_typecheck", status: "not_checked", severity: "high" },
      { id: "staging_rc_pnpm_test", status: "not_checked", severity: "high" },
      { id: "staging_rc_pnpm_build", status: "not_checked", severity: "high" },
      { id: "staging_rc_git_diff_check", status: "not_checked", severity: "high" },
      { id: "staging_rc_safe_integration_scan", status: "not_checked", severity: "high" },
      { id: "staging_rc_no_secret_or_env_exposure", status: "pass", severity: "critical" },
      { id: "staging_rc_no_release_or_deployment_execution", status: "pass", severity: "critical" },
      { id: "staging_rc_no_ready_overclaim", status: "pass", severity: "critical" }
    ]),
    blockers: sanitizeDashboardArray([
      { id: "blocker_staging_rc_pnpm_lint_not_checked", category: "validation", severity: "high", blockingLevel: "blocks_release_candidate", status: "open" },
      { id: "blocker_staging_rc_pnpm_typecheck_not_checked", category: "validation", severity: "high", blockingLevel: "blocks_release_candidate", status: "open" },
      { id: "blocker_staging_rc_pnpm_test_not_checked", category: "validation", severity: "high", blockingLevel: "blocks_release_candidate", status: "open" },
      { id: "blocker_staging_rc_pnpm_build_not_checked", category: "validation", severity: "high", blockingLevel: "blocks_release_candidate", status: "open" },
      { id: "blocker_staging_rc_git_diff_check_not_checked", category: "validation", severity: "high", blockingLevel: "blocks_release_candidate", status: "open" },
      { id: "blocker_staging_rc_production_auth_missing", category: "auth", severity: "medium", blockingLevel: "blocks_production_only", status: "accepted" },
      { id: "blocker_staging_rc_real_secret_backend_missing", category: "secrets", severity: "medium", blockingLevel: "blocks_production_only", status: "accepted" }
    ]),
    criticalBlockers: [],
    signoffs: sanitizeDashboardArray([
      { id: "staging_rc_signoff_engineering_owner", role: "engineering_owner", required: true, status: "pending" },
      { id: "staging_rc_signoff_platform_owner", role: "platform_owner", required: true, status: "pending" },
      { id: "staging_rc_signoff_security_reviewer", role: "security_reviewer", required: true, status: "pending" },
      { id: "staging_rc_signoff_product_owner", role: "product_owner", required: true, status: "pending" },
      { id: "staging_rc_signoff_qa_reviewer", role: "qa_reviewer", required: true, status: "pending" },
      { id: "staging_rc_signoff_release_manager", role: "release_manager", required: true, status: "pending" }
    ]),
    pendingSignoffs: sanitizeDashboardArray([
      { id: "staging_rc_signoff_engineering_owner", role: "engineering_owner", status: "pending" },
      { id: "staging_rc_signoff_platform_owner", role: "platform_owner", status: "pending" },
      { id: "staging_rc_signoff_security_reviewer", role: "security_reviewer", status: "pending" },
      { id: "staging_rc_signoff_product_owner", role: "product_owner", status: "pending" },
      { id: "staging_rc_signoff_qa_reviewer", role: "qa_reviewer", status: "pending" },
      { id: "staging_rc_signoff_release_manager", role: "release_manager", status: "pending" }
    ]),
    releaseNoteRequirements: sanitizeDashboardArray([
      "summary",
      "changed_areas",
      "validation",
      "skipped_tests",
      "known_limitations",
      "safety_gates",
      "migration_notes",
      "dashboard_readiness",
      "rollback_notes",
      "follow_ups"
    ].map((section) => ({ id: `staging_rc_release_note_${section}`, section, required: true, status: "missing" }))),
    missingReleaseNoteRequirements: sanitizeDashboardArray([
      "summary",
      "changed_areas",
      "validation",
      "skipped_tests",
      "known_limitations",
      "safety_gates",
      "migration_notes",
      "dashboard_readiness",
      "rollback_notes",
      "follow_ups"
    ].map((section) => ({ id: `staging_rc_release_note_${section}`, section, status: "missing" }))),
    rollbackChecklist: sanitizeDashboardArray([
      "code_revert",
      "database",
      "config",
      "feature_flags",
      "git_integration",
      "llm_integration",
      "secrets",
      "observability",
      "dashboard"
    ].map((category) => ({ id: `staging_rc_rollback_${category}`, category, required: true, status: "planned" }))),
    missingRollbackItems: [],
    skippedTests: [
      "staging_rc_optional_postgres_profile_documented",
      "staging_rc_github_integration_profile_documented",
      "staging_rc_llm_integration_profile_documented"
    ],
    recommendedNextActions: [
      "Do not create a release, Git tag, GitHub release, or deployment from this checklist.",
      "Run required local validation commands and record their status before staging RC designation.",
      "Document skipped optional integration tests and why their gates were not configured."
    ],
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      releaseCreated: false,
      gitTagCreated: false,
      githubReleaseCreated: false,
      deploymentExecuted: false,
      externalCallsEnabled: false,
      remoteIntegrationTestsExecuted: false,
      productionReady: false,
      stagingDeployed: false
    })
  };

  const stagingExecution: StagingDeploymentExecutionReadModel = {
    summary: sanitizeDashboardObject({
      status: "v0_implemented",
      planningOnly: true,
      planStatus: "ready_for_signoff",
      goNoGoStatus: "not_ready",
      productionReady: false,
      stagingDeployed: false,
      deploymentExecuted: false,
      releaseCreated: false,
      gitTagCreated: false,
      externalCallsEnabled: false,
      remoteIntegrationTestsExecuted: false,
      gateCount: 26,
      requiredGateCount: 19,
      blockerCount: 1,
      criticalBlockerCount: 0,
      warningCount: 11,
      stepCount: 20,
      readyStepCount: 6,
      signoffPackAvailable: true,
      requiredSignoffCount: 6,
      pendingSignoffCount: 6,
      approvedSignoffCount: 0,
      conditionalSignoffCount: 0,
      rejectedSignoffCount: 0,
      missingRequiredSignoffCount: 6,
      signoffStatus: "pending",
      actualDeploymentBlocked: true,
      rollbackStepCount: 10,
      noSecretsExposed: true,
      envValuesExposed: false,
      productionReadyClaimed: false,
      stagingDeployedClaimed: false
    }),
    plan: sanitizeDashboardObject({
      id: "staging_deployment_execution_plan_v0",
      name: "Staging Deployment Execution Plan v0",
      status: "ready_for_signoff",
      requiredSignoffs: ["engineering_owner", "platform_owner", "security_reviewer", "product_owner", "qa_reviewer", "release_manager"]
    }),
    steps: sanitizeDashboardArray([
      { id: "staging_execution_step_01_confirm_worktree_or_diff_scope", order: 1, phase: "pre_deploy", status: "ready", automationLevel: "manual" },
      { id: "staging_execution_step_05_collect_human_signoffs", order: 5, phase: "approval", status: "blocked", automationLevel: "manual" },
      { id: "staging_execution_step_18_future_deployment_execution_placeholder", order: 18, phase: "deployment_placeholder", status: "future", automationLevel: "scripted_future" }
    ]),
    gates: sanitizeDashboardArray([
      { id: "staging_execution_pnpm_lint", category: "validation", status: "pass", severity: "high", required: true },
      { id: "staging_execution_human_signoff_collected", category: "signoff", status: "fail", severity: "high", required: true },
      { id: "staging_execution_github_app_decision", category: "github_app", status: "skipped", severity: "medium", required: false },
      { id: "staging_execution_llm_decision", category: "llm", status: "skipped", severity: "medium", required: false },
      { id: "staging_execution_vault_decision", category: "vault", status: "skipped", severity: "medium", required: false },
      { id: "staging_execution_no_release_tag_deploy_side_effects", category: "environment", status: "pass", severity: "critical", required: true }
    ]),
    requiredGates: sanitizeDashboardArray([
      { id: "staging_execution_pnpm_lint", status: "pass", severity: "high" },
      { id: "staging_execution_human_signoff_collected", status: "fail", severity: "high" },
      { id: "staging_execution_no_release_tag_deploy_side_effects", status: "pass", severity: "critical" }
    ]),
    blockers: sanitizeDashboardArray([
      { id: "staging_execution_human_signoff_collected", category: "signoff", status: "fail", severity: "high" }
    ]),
    warnings: sanitizeDashboardArray([
      { id: "staging_execution_rc_audit_accepted", category: "signoff", status: "warning", severity: "medium" },
      { id: "staging_execution_github_app_decision", category: "github_app", status: "skipped", severity: "medium" },
      { id: "staging_execution_llm_decision", category: "llm", status: "skipped", severity: "medium" },
      { id: "staging_execution_vault_decision", category: "vault", status: "skipped", severity: "medium" }
    ]),
    goNoGoDecision: sanitizeDashboardObject({
      id: "staging_deployment_execution_go_no_go_v0",
      status: "not_ready",
      pendingApprovals: ["engineering_owner", "platform_owner", "security_reviewer", "product_owner", "qa_reviewer", "release_manager"],
      blockers: ["staging_execution_human_signoff_collected"]
    }),
    signoffPack: sanitizeDashboardObject({
      available: true,
      status: "pending",
      requiredRoleCount: 6,
      pendingRoleCount: 6,
      approvedRoleCount: 0,
      conditionalRoleCount: 0,
      rejectedRoleCount: 0,
      missingRequiredRoleCount: 6,
      actualDeploymentBlocked: true,
      evidenceChecklistStatus: "present_pending_review",
      decisionPolicyStatus: "evaluated_pending_required_signoffs",
      approvalAuditRequired: true,
      docs: "docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md",
      evidenceChecklistDocs: "docs/roadmaps/staging-deployment-execution/signoff-evidence-checklist-v0.md",
      decisionPolicyDocs: "docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md"
    }),
    pendingSignoffs: sanitizeDashboardArray([
      "engineering_owner",
      "platform_owner",
      "security_reviewer",
      "product_owner",
      "qa_reviewer",
      "release_manager"
    ].map((role) => ({ role, status: "pending" }))),
    optionalIntegrationDecisions: sanitizeDashboardArray([
      { id: "staging_execution_github_app_decision", category: "github_app", status: "skipped" },
      { id: "staging_execution_llm_decision", category: "llm", status: "skipped" },
      { id: "staging_execution_vault_decision", category: "vault", status: "skipped" },
      { id: "staging_execution_mcp_policy", category: "mcp", status: "not_applicable" }
    ]),
    rollbackPlan: sanitizeDashboardObject({
      id: "staging_deployment_execution_rollback_plan_v0",
      status: "ready_for_review",
      rollbackExecuted: false
    }),
    rollbackSteps: sanitizeDashboardArray([
      { id: "staging_execution_rollback_code", name: "Code rollback", status: "planned" },
      { id: "staging_execution_rollback_config", name: "Config rollback", status: "planned" },
      { id: "staging_execution_rollback_manual_verification", name: "Manual verification", status: "planned" }
    ]),
    recommendedNextActions: [
      "Collect real human signoffs before any staging deployment execution.",
      "Keep staging deployed false and production ready false until future execution/audit work."
    ],
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      deploymentExecuted: false,
      releaseCreated: false,
      gitTagCreated: false,
      externalCallsEnabled: false,
      remoteIntegrationTestsExecuted: false,
      productionReady: false,
      stagingDeployed: false
    })
  };

  const cicd: CICDPipelineReadModel = {
    summary: sanitizeDashboardObject({
      status: "v0_implemented",
      planningOnly: true,
      productionReady: false,
      stagingDeployed: false,
      deploymentWorkflowCreated: false,
      activeWorkflowCreated: false,
      externalCallsEnabledByDefault: false,
      remoteIntegrationTestsEnabledByDefault: false,
      secretsExposed: false,
      envValuesExposed: false,
      packageManager: "pnpm",
      expectedNodeVersion: ">=24.0.0",
      voltaNodeVersion: "24.15.0",
      currentNodeVersion: "demo",
      nodeVersionStatus: "unknown",
      profileCount: 5,
      jobCount: 20,
      requiredJobCount: 14,
      optionalJobCount: 6,
      safetyJobCount: 7,
      integrationGateCount: 8,
      disabledByDefaultIntegrationGateCount: 8,
      readinessCheckCount: 9,
      criticalBlockerCount: 0,
      riskCount: 5,
      stagingPromotionReady: false,
      artifactPolicyStatus: "planned_redacted_only",
      cleanupRollbackStatus: "planned_manual_only",
      noSecretScanStatus: "planned_required"
    }),
    profiles: sanitizeDashboardArray([
      { id: "cicd_profile_local_validation", name: "local_validation", status: "ready_for_dry_run" },
      { id: "cicd_profile_pull_request", name: "pull_request", status: "ready_for_dry_run" },
      { id: "cicd_profile_integration", name: "integration", status: "planned" },
      { id: "cicd_profile_staging", name: "staging", status: "blocked" },
      { id: "cicd_profile_release_candidate", name: "release_candidate", status: "future" }
    ]),
    jobs: sanitizeDashboardArray([
      { id: "cicd_job_lint", category: "lint", command: "pnpm lint", required: true, allowedToCallExternalServices: false },
      { id: "cicd_job_typecheck", category: "typecheck", command: "pnpm typecheck", required: true, allowedToCallExternalServices: false },
      { id: "cicd_job_test", category: "test", command: "pnpm test", required: true, allowedToCallExternalServices: false },
      { id: "cicd_job_build", category: "build", command: "pnpm build", required: true, allowedToCallExternalServices: false },
      { id: "cicd_job_diff_check", category: "security_scan", command: "git diff --check", required: true, allowedToCallExternalServices: false },
      { id: "cicd_job_optional_remote_llm", category: "optional_remote_llm", required: false, allowedToCallExternalServices: true }
    ]),
    requiredJobs: sanitizeDashboardArray([
      { id: "cicd_job_lint", command: "pnpm lint" },
      { id: "cicd_job_typecheck", command: "pnpm typecheck" },
      { id: "cicd_job_test", command: "pnpm test" },
      { id: "cicd_job_build", command: "pnpm build" },
      { id: "cicd_job_diff_check", command: "git diff --check" }
    ]),
    optionalJobs: sanitizeDashboardArray([
      { id: "cicd_job_optional_postgres", category: "optional_postgres", enabledByDefault: false },
      { id: "cicd_job_optional_remote_git", category: "optional_remote_git", enabledByDefault: false },
      { id: "cicd_job_optional_remote_llm", category: "optional_remote_llm", enabledByDefault: false }
    ]),
    safetyJobs: sanitizeDashboardArray([
      { id: "cicd_job_safe_integration_scan", category: "security_scan" },
      { id: "cicd_job_secret_exposure_scan", category: "secret_scan" },
      { id: "cicd_job_dashboard_smoke", category: "dashboard_smoke" },
      { id: "cicd_job_health_smoke", category: "readiness_check" }
    ]),
    integrationGates: sanitizeDashboardArray([
      { id: "cicd_gate_postgres", integrationKind: "postgres", enabledByDefault: false, riskLevel: "medium" },
      { id: "cicd_gate_remote_git", integrationKind: "remote_git", enabledByDefault: false, riskLevel: "high" },
      { id: "cicd_gate_remote_llm", integrationKind: "remote_llm", enabledByDefault: false, riskLevel: "high" },
      { id: "cicd_gate_remote_mcp", integrationKind: "remote_mcp", enabledByDefault: false, riskLevel: "critical" }
    ]),
    readinessChecks: sanitizeDashboardArray([
      { id: "cicd_node_24_baseline", category: "node", status: "pass", severity: "medium" },
      { id: "cicd_optional_remote_tests_disabled_default", category: "test_profiles", status: "pass", severity: "critical" },
      { id: "cicd_secret_env_safety_policy", category: "secrets", status: "pass", severity: "critical" },
      { id: "cicd_staging_promotion_blocked", category: "staging_promotion", status: "warning", severity: "critical" }
    ]),
    risks: sanitizeDashboardArray([
      { id: "cicd_risk_remote_tests_accidentally_enabled", severity: "critical", status: "open" },
      { id: "cicd_risk_secret_leak_in_logs", severity: "critical", status: "open" }
    ]),
    blockers: sanitizeDashboardArray([]),
    stagingPromotion: sanitizeDashboardObject({
      ready: false,
      productionReady: false,
      stagingDeployed: false,
      remoteIntegrationTestsEnabledByDefault: false
    }),
    artifactPolicy: sanitizeDashboardObject({
      status: "planned_redacted_only",
      rawSecretArtifactsAllowed: false,
      rawPromptArtifactsAllowed: false,
      rawProviderOutputArtifactsAllowed: false,
      rawWebhookPayloadArtifactsAllowed: false
    }),
    cleanupRollback: sanitizeDashboardObject({
      status: "planned_manual_only",
      cleanupJobsImplemented: false,
      remoteCleanupCallsEnabled: false,
      rollbackAutomationImplemented: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      externalCallsEnabledByDefault: false,
      activeWorkflowCreated: false,
      deploymentWorkflowCreated: false
    })
  };

  const observabilityEvents = sanitizeDashboardArray([
    ...git.auditEvents,
    ...llm.auditEvents,
    ...agents.auditEvents,
    ...policy.auditEntries,
    ...auth.auditEvents,
    ...security.auditEvents,
    ...mcp.auditEvents,
    ...providers.auditEvents,
    ...localAgents.auditEvents,
    ...registry.auditLogs
  ]);
  const tenantScopePlanningService = createDashboardReadinessTenantScopePlanningService();
  const tenantScopeEnforcementService = createTenantScopeEnforcementService();
  const scopeModelDecision = tenantScopeEnforcementService.evaluateDashboardPanelAccess(
    undefined,
    tenantScopePlanningService.getDashboardPanelScopeSummary("scope_model") ?? { panelId: "scope_model", requiredScopes: ["tenant", "team", "project", "audit_query"], redactionClass: "sensitive_metadata" },
    { source: "dashboard:scope_model" }
  );
  const scopes: ScopeReadinessReadModel = {
    summary: sanitizeDashboardObject({
      status: "v1_implemented",
      enforcementStatus: "planning_model_only",
      tenantFilteringStatus: "future",
      productionTenantEnforcement: false,
      noSecretsExposed: true,
      tenants: 1,
      teams: 1,
      projects: 1,
      repos: 2,
      providers: 2,
      models: 2,
      secrets: 2,
      mcpTools: 2,
      registryPackages: 3,
      localAgentHosts: 1,
      auditQueries: 1
    }),
    tenants: sanitizeDashboardArray([{ tenantId: "mock-tenant", tenantKind: "workspace", status: "active_mock" }]),
    teams: sanitizeDashboardArray([{ tenantId: "mock-tenant", teamId: "platform-team", status: "active_mock" }]),
    projects: sanitizeDashboardArray([{ tenantId: "mock-tenant", teamId: "platform-team", projectId: "aichestra-core", status: "active_mock" }]),
    repos: sanitizeDashboardArray([
      { repoId: "repo_demo_backend", repoProvider: "mock", tenantId: "mock-tenant", projectId: "aichestra-core" },
      { repoId: "repo_local_fixture", repoProvider: "local", tenantId: "mock-tenant", projectId: "aichestra-core" }
    ]),
    providers: sanitizeDashboardArray([
      { providerId: "mock-llm-provider", providerKind: "mock", tenantId: "mock-tenant" },
      { providerId: "openai-compatible", providerKind: "openai_compatible", tenantId: "mock-tenant", liveCallsEnabled: false }
    ]),
    models: sanitizeDashboardArray([
      { providerId: "mock-llm-provider", modelId: "mock-small", modelKind: "mock" },
      { providerId: "mock-llm-provider", modelId: "mock-coder", modelKind: "mock" }
    ]),
    secrets: sanitizeDashboardArray([
      { secretRefId: "github_token", secretKind: "github_token", provider: "env_or_vault_gated", containsSecretMaterial: false },
      { secretRefId: "llm_api_key", secretKind: "llm_api_key", provider: "env_or_vault_gated", containsSecretMaterial: false }
    ]),
    mcpTools: sanitizeDashboardArray([{ mcpServerId: "mock-github-mcp", mcpToolId: "github.get_issue", riskLevel: "low" }]),
    registryPackages: sanitizeDashboardArray([
      { packageId: "skill:code-reviewer", packageKind: "skill" },
      { packageId: "harness:unit-test", packageKind: "harness" },
      { packageId: "instruction:default-coding", packageKind: "instruction" }
    ]),
    localAgentHosts: sanitizeDashboardArray([{ hostId: "host_demo", agentId: "local-agent-fixture" }]),
    auditQueries: sanitizeDashboardArray([{ tenantId: "mock-tenant", projectId: "aichestra-core", readOnly: true }]),
    enforcement: sanitizeDashboardObject({
      status: "v1_implemented_partial",
      planningStatus: "planning_model_only",
      enforcementMode: scopeModelDecision.enforcementMode,
      scopeDecisionSummary: tenantScopeEnforcementService.summarizeDecision(scopeModelDecision),
      tenantScopeEnforcementImplemented: "partial",
      representativeEnforcementOnly: true,
      productionTenantEnforcement: false,
      tenantFilteringImplemented: false,
      tenantFilteringStatus: "future",
      dashboardFilteringStatus: "future"
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      rawCredentialsExposed: false
    })
  };
  const tenantScopePlanningSummary = tenantScopePlanningService.getSummary();
  const tenantScopeEnforcementSummary = tenantScopeEnforcementService.getSummary();
  const tenantScopePlanning: DashboardTenantScopePlanningReadModel = {
    scopeMetadata: withDemoEnforcementMetadata(
      sanitizeDashboardObject(tenantScopePlanningService.getDashboardPanelScopeMetadata("tenant_scope_planning") ?? fallbackScopeMetadata("tenant_scope_planning")) as unknown as ScopedReadModelMetadata,
      tenantScopeEnforcementService,
      tenantScopePlanningService.getDashboardPanelScopeSummary("tenant_scope_planning"),
      "tenant_scope_planning"
    ),
    summary: sanitizeDashboardObject(tenantScopePlanningSummary),
    dashboardPlans: sanitizeDashboardArray(tenantScopePlanningService.listDashboardPlans()),
    readinessPlans: sanitizeDashboardArray(tenantScopePlanningService.listReadinessPlans()),
    panelScopeSummaries: sanitizeDashboardArray(tenantScopePlanningService.listDashboardPanelScopeSummaries()) as unknown as DashboardPanelScopeSummary[],
    readinessScopeSummaries: sanitizeDashboardArray(tenantScopePlanningService.listReadinessEndpointScopeSummaries()) as unknown as ReadinessEndpointScopeSummary[],
    enforcementSummary: sanitizeDashboardObject(tenantScopeEnforcementSummary),
    enforcementModes: sanitizeDashboardArray(tenantScopeEnforcementService.listModes()),
    enforcementMismatches: sanitizeDashboardArray(tenantScopeEnforcementService.listMismatches()),
    roleVisibility: sanitizeDashboardArray(tenantScopePlanningService.getRoleVisibilityMatrix()),
    fallbackBehavior: sanitizeDashboardArray(tenantScopePlanningService.getFallbackBehavior()),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: tenantScopePlanningSummary.noSecretsExposed,
      envValuesExposed: tenantScopePlanningSummary.envValuesExposed,
      tenantFilteringImplemented: tenantScopePlanningSummary.tenantFilteringImplemented,
      productionTenantEnforcement: tenantScopePlanningSummary.productionTenantEnforcement,
      productionReady: tenantScopePlanningSummary.productionReady
    })
  };
  const tenantScopeEnforcement: TenantScopeEnforcementReadModel = {
    summary: sanitizeDashboardObject(tenantScopeEnforcementSummary),
    modes: sanitizeDashboardArray(tenantScopeEnforcementService.listModes()),
    mismatches: sanitizeDashboardArray(tenantScopeEnforcementService.listMismatches()),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: tenantScopeEnforcementSummary.noSecretsExposed,
      envValuesExposed: tenantScopeEnforcementSummary.envValuesExposed,
      tenantFilteringImplemented: tenantScopeEnforcementSummary.tenantFilteringImplemented,
      productionTenantEnforcement: tenantScopeEnforcementSummary.productionTenantEnforcement,
      productionAuthImplemented: tenantScopeEnforcementSummary.productionAuthImplemented,
      rowLevelSecurityImplemented: tenantScopeEnforcementSummary.rowLevelSecurityImplemented
    })
  };
  const dashboardScopeFilteringService = createDashboardScopeFilteringService();
  const dashboardScopeFilterContext = dashboardScopeFilteringService.buildFilterContext({
    source: "demo",
    authMode: "mock_actor"
  });
  const dashboardScopeFilterDecisions = dashboardScopeFilteringService.evaluatePanels(
    tenantScopePlanningService.listDashboardPanelScopeSummaries(),
    dashboardScopeFilterContext
  );
  const dashboardScopeFilterSummary = dashboardScopeFilteringService.summarizeDecisions(
    dashboardScopeFilterDecisions,
    dashboardScopeFilterContext
  );
  const dashboardScopeFilter: DashboardScopeFilterReadModel = {
    summary: sanitizeDashboardObject(dashboardScopeFilterSummary),
    decisions: sanitizeDashboardArray(dashboardScopeFilterDecisions),
    visiblePanels: sanitizeDashboardArray(dashboardScopeFilterDecisions
      .filter((decision) => decision.decision === "visible")
      .map((decision) => ({ panelId: decision.panelId, panelName: decision.panelName, decision: decision.decision }))),
    redactedPanels: sanitizeDashboardArray(dashboardScopeFilterDecisions
      .filter((decision) => decision.decision === "redacted")
      .map((decision) => ({ panelId: decision.panelId, panelName: decision.panelName, redactedFields: decision.redactedFields }))),
    hiddenPanels: sanitizeDashboardArray(dashboardScopeFilterDecisions
      .filter((decision) => decision.decision === "hidden")
      .map((decision) => ({ panelId: decision.panelId, panelName: decision.panelName, requiredRoles: decision.requiredRoles, requiredScopes: decision.requiredScopes }))),
    warningPanels: sanitizeDashboardArray(dashboardScopeFilterDecisions
      .filter((decision) => decision.decision === "warning_only")
      .map((decision) => ({ panelId: decision.panelId, panelName: decision.panelName, reason: decision.reason }))),
    context: sanitizeDashboardObject({
      actorId: dashboardScopeFilterContext.actorId,
      principalId: dashboardScopeFilterContext.principalId,
      roles: dashboardScopeFilterContext.roles,
      tenantIds: dashboardScopeFilterContext.tenantIds,
      teamIds: dashboardScopeFilterContext.teamIds,
      projectIds: dashboardScopeFilterContext.projectIds,
      resourceScopes: dashboardScopeFilterContext.resourceScopes,
      source: dashboardScopeFilterContext.source,
      authMode: dashboardScopeFilterContext.authMode,
      productionAuthImplemented: false,
      productionTenantEnforcement: false,
      externalIdentityProviderCalled: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      productionFiltering: false,
      productionAuthImplemented: false,
      productionTenantEnforcement: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      externalIdentityProviderCalled: false
    })
  };
  const observabilityFutureBackends = [
    "opentelemetry_future",
    "datadog_future",
    "grafana_cloud_future",
    "cloudwatch_future",
    "opensearch_future",
    "splunk_future",
    "siem_future",
    "s3_future",
    "custom_future"
  ].map((exporterKind) => ({
    id: `observability_exporter_${exporterKind}`,
    exporterKind,
    status: "future",
    exportLogsEnabled: false,
    exportMetricsEnabled: false,
    exportTracesEnabled: false,
    exportAuditEnabled: false,
    externalCallsEnabled: false,
    endpointConfigured: false,
    authConfigured: false,
    tenantScopeRequired: true,
    redactionRequired: true,
    metadata: {
      futureBackend: true,
      productionReady: false,
      endpointValueExposed: false,
      authValueExposed: false
    }
  }));
  const observabilityExportSafetyChecks = sanitizeDashboardArray([
    { id: "observability_export_check_exporter_disabled_by_default", checkKind: "exporter_disabled_by_default", status: "pass", severity: "critical" },
    { id: "observability_export_check_no_raw_payload", checkKind: "no_raw_payload", status: "pass", severity: "critical" },
    { id: "observability_export_check_no_secret_fields", checkKind: "no_secret_fields", status: "pass", severity: "critical" },
    { id: "observability_export_check_no_env_values", checkKind: "no_env_values", status: "pass", severity: "critical" },
    { id: "observability_export_check_redaction_applied", checkKind: "redaction_applied", status: "pass", severity: "high" },
    { id: "observability_export_check_tenant_scope_present", checkKind: "tenant_scope_present", status: "pass", severity: "medium" },
    { id: "observability_export_check_retention_class_present", checkKind: "retention_class_present", status: "pass", severity: "high" },
    { id: "observability_export_check_endpoint_not_exposed", checkKind: "endpoint_not_exposed", status: "pass", severity: "high" },
    { id: "observability_export_check_auth_not_exposed", checkKind: "auth_not_exposed", status: "pass", severity: "high" }
  ]);
  const observability: ObservabilityReadModel = {
    config: sanitizeDashboardObject({
      status: "v0_implemented",
      aggregationMode: "in_memory_read_model",
      externalBackendEnabled: false,
      externalExportEnabled: false,
      alertDeliveryEnabled: false,
      retentionDeletionJobsEnabled: false,
      rawPayloadStorageEnabled: false,
      noSecretsExposed: true
    }),
    auditSummary: sanitizeDashboardObject({
      totalEvents: observabilityEvents.length,
      byCategory: { git: git.auditEvents.length, llm: llm.auditEvents.length, security: security.auditEvents.length, mcp: mcp.auditEvents.length },
      byOutcome: { success: observabilityEvents.length, denied: 0, blocked: 0, failed: 0, skipped: 0, unknown: 0 },
      noSecretsExposed: true
    }),
    recentEvents: observabilityEvents.slice(-10),
    recentSecurityEvents: security.auditEvents.slice(-10),
    deniedOrBlockedEvents: sanitizeDashboardArray([
      ...security.auditEvents.filter((event) => event.result === "blocked"),
      ...policy.auditEntries.filter((entry) => entry.decision === "deny")
    ]),
    retentionClasses: sanitizeDashboardArray([
      { id: "short_debug", defaultTtlDays: 7, exportable: false, deleteEligible: true },
      { id: "operational", defaultTtlDays: 90, exportable: true, deleteEligible: true },
      { id: "security", defaultTtlDays: 365, exportable: true, deleteEligible: false },
      { id: "compliance", defaultTtlDays: 2555, exportable: true, deleteEligible: false },
      { id: "ephemeral", defaultTtlDays: 1, exportable: false, deleteEligible: true }
    ]),
    redactionClasses: sanitizeDashboardArray([
      { id: "public_metadata", maxPreviewBytes: 4096 },
      { id: "internal_metadata", maxPreviewBytes: 4096 },
      { id: "sensitive_metadata", maxPreviewBytes: 2048 },
      { id: "secret_adjacent", maxPreviewBytes: 512 },
      { id: "contains_user_content_redacted", maxPreviewBytes: 512 },
      { id: "never_store_raw", maxPreviewBytes: 0 }
    ]),
    retentionPolicies: sanitizeDashboardArray([
      { id: "retention_security_events", retentionClass: "security", deletionMode: "none", status: "active" },
      { id: "retention_operational_events", retentionClass: "operational", deletionMode: "none", status: "active" },
      { id: "retention_redacted_user_content_previews", retentionClass: "short_debug", deletionMode: "none", status: "active" }
    ]),
    metricDefinitions: sanitizeDashboardArray([
      { name: "audit.events.total", unit: "count" },
      { name: "audit.events.denied_blocked", unit: "count" },
      { name: "traces.spans.total", unit: "count" },
      { name: "observability.external_exporter.enabled", unit: "boolean" }
    ]),
    metricSnapshot: sanitizeDashboardObject({
      externalExporterEnabled: false,
      points: [
        { metricName: "audit.events.total", value: observabilityEvents.length },
        { metricName: "observability.external_exporter.enabled", value: 0 }
      ]
    }),
    traceSpans: sanitizeDashboardArray([
      { id: "span_demo_observability", traceId: "trace_demo_observability", name: "dashboard.demo_observability", status: "ok", metadata: { skeletonOnly: true } }
    ]),
    traceSummary: sanitizeDashboardObject({ spanCount: 1, externalExporterEnabled: false, skeletonOnly: true }),
    sourceCoverage: sanitizeDashboardArray([
      { moduleName: "Auth/RBAC", normalized: "yes", eventCount: auth.auditEvents.length },
      { moduleName: "Policy", normalized: "yes", eventCount: policy.auditEntries.length },
      { moduleName: "SecretRef/Credentials", normalized: "yes", eventCount: security.credentialAuditEvents.length },
      { moduleName: "Secrets/Sandbox", normalized: "yes", eventCount: security.auditEvents.length },
      { moduleName: "Git", normalized: "yes", eventCount: git.auditEvents.length },
      { moduleName: "LLM Gateway", normalized: "yes", eventCount: llm.auditEvents.length },
      { moduleName: "MCP Gateway", normalized: "yes", eventCount: mcp.auditEvents.length },
      { moduleName: "Runner", normalized: "yes", eventCount: agents.auditEvents.length },
      { moduleName: "Registry", normalized: "yes", eventCount: registry.auditLogs.length },
      { moduleName: "Improvement Governance", normalized: "yes", eventCount: nestedCount(registry.governance, "governanceAuditEvents") },
      { moduleName: "Local Agent Protocol", normalized: "yes", eventCount: localAgents.auditEvents.length },
      { moduleName: "Deployment Readiness", normalized: "partial", eventCount: readiness.checks.length }
    ]),
    productionReadinessBlockers: readiness.checks.filter((check) => check.category === "observability" || check.category === "audit"),
    exporterConfigs: sanitizeDashboardArray([
      {
        id: "observability_exporter_disabled",
        exporterKind: "disabled",
        status: "disabled",
        exportLogsEnabled: false,
        exportMetricsEnabled: false,
        exportTracesEnabled: false,
        exportAuditEnabled: false,
        externalCallsEnabled: false,
        endpointConfigured: false,
        authConfigured: false,
        tenantScopeRequired: true,
        redactionRequired: true,
        metadata: { defaultRuntime: true, productionReady: false, endpointValueExposed: false, authValueExposed: false }
      },
      {
        id: "observability_exporter_mock",
        exporterKind: "mock",
        status: "not_configured",
        exportLogsEnabled: false,
        exportMetricsEnabled: false,
        exportTracesEnabled: false,
        exportAuditEnabled: false,
        externalCallsEnabled: false,
        endpointConfigured: false,
        authConfigured: false,
        tenantScopeRequired: true,
        redactionRequired: true,
        metadata: { testsOnly: true, productionReady: false, endpointValueExposed: false, authValueExposed: false }
      },
      ...observabilityFutureBackends
    ]),
    futureBackends: sanitizeDashboardArray(observabilityFutureBackends),
    exportSafetyChecks: observabilityExportSafetyChecks,
    exportReadinessSummary: sanitizeDashboardObject({
      exporterEnabled: false,
      externalCallsEnabled: false,
      configuredExporterCount: 0,
      futureExporterCount: observabilityFutureBackends.length,
      safetyCheckCount: observabilityExportSafetyChecks.length,
      failedSafetyCheckCount: 0,
      rawPayloadExportAllowed: false,
      secretExportAllowed: false,
      metadata: {
        status: "v1_implemented_skeleton",
        productionObservabilityExportImplemented: false,
        noExternalCalls: true,
        noRawPayloadExport: true,
        noSecretsOrEnvValues: true
      }
    }),
    exportNoSecretStatus: sanitizeDashboardObject({
      exporterEnabled: false,
      externalCallsEnabled: false,
      rawPayloadExportAllowed: false,
      secretExportAllowed: false,
      envValuesExposed: false,
      endpointValuesExposed: false,
      authValuesExposed: false,
      noSecretsExposed: true
    }),
    auditScopeSummary: sanitizeDashboardObject({
      status: "v1_implemented_partial",
      defaultDetailLevel: "summary",
      redactionPlanCount: 4,
      rawPayloadAllowed: false,
      productionStorageEnforcement: false,
      externalExportEnabled: false,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    auditScopeDecision: sanitizeDashboardObject({
      decision: "deny_detail",
      reason: "viewer_detail_not_allowed",
      allowedDetailLevel: "summary",
      redactedFieldCount: 26,
      missingScopes: ["role_with_audit_metadata_access", "tenant_or_team_or_project", "project_or_repo_or_provider", "audit_query"],
      rawPayloadAllowed: false,
      productionStorageEnforcement: false,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    auditScopeRedactionPlans: sanitizeDashboardArray([
      { id: "audit_scope_plan_summary", detailLevel: "summary", fieldsToRedact: ["rawPayload", "Authorization", "cookie", "prompt"] },
      { id: "audit_scope_plan_metadata", detailLevel: "metadata", fieldsToRedact: ["rawPayload", "Authorization", "cookie"] },
      { id: "audit_scope_plan_detail", detailLevel: "detail", fieldsToRedact: ["rawPayload", "Authorization", "cookie"] },
      { id: "audit_scope_plan_raw_forbidden", detailLevel: "raw_payload_forbidden", fieldsToRedact: ["rawPayload", "Authorization", "cookie", "prompt"] }
    ]),
    auditScopeStatus: sanitizeDashboardObject({
      status: "v1_implemented_partial",
      allowedDetailLevel: "summary",
      redactedDetailCount: 26,
      missingScopeWarnings: ["audit_query"],
      rawPayloadForbidden: true,
      productionStorageEnforcement: false,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      rawPayloadsStored: false,
      externalExporterEnabled: false,
      retentionDeletesEnabled: false
    })
  };

  const audit: AuditSummaryReadModel = {
    auditGroups: sanitizeDashboardArray([
      { source: "registry", count: registry.auditLogs.length, recentEvents: registry.auditLogs.slice(-5) },
      { source: "git", count: git.auditEvents.length, recentEvents: git.auditEvents.slice(-5) },
      { source: "llm", count: llm.auditEvents.length, recentEvents: llm.auditEvents.slice(-5) },
      { source: "agent_runner", count: agents.auditEvents.length, recentEvents: agents.auditEvents.slice(-5) },
      { source: "policy", count: policy.auditEntries.length, recentEvents: policy.auditEntries.slice(-5) },
      { source: "auth", count: auth.auditEvents.length, recentEvents: auth.auditEvents.slice(-5) },
      { source: "security", count: security.auditEvents.length, recentEvents: security.auditEvents.slice(-5) },
      { source: "mcp", count: mcp.auditEvents.length, recentEvents: mcp.auditEvents.slice(-5) },
      { source: "deployment_readiness", count: readiness.checks.length + readiness.risks.length, recentEvents: readiness.productionBlockers.slice(-5) },
      { source: "enterprise_provider", count: providers.auditEvents.length, recentEvents: providers.auditEvents.slice(-5) },
      { source: "local_agent_protocol", count: localAgents.auditEvents.length, recentEvents: localAgents.auditEvents.slice(-5) }
    ]),
    recentEvents: sanitizeDashboardArray([
      ...git.auditEvents.slice(-3),
      ...llm.auditEvents.slice(-3),
      ...auth.auditEvents.slice(-3),
      ...security.auditEvents.slice(-3),
      ...mcp.auditEvents.slice(-3),
      ...readiness.productionBlockers.slice(-3),
      ...localAgents.auditEvents.slice(-3)
    ]),
    auditScopeSummary: sanitizeDashboardObject({
      status: "v1_implemented_partial",
      rawPayloadAllowed: false,
      productionStorageEnforcement: false,
      noSecretsExposed: true,
      envValuesExposed: false
    }),
    auditScopeDecision: sanitizeDashboardObject({
      decision: "deny_detail",
      allowedDetailLevel: "summary",
      rawPayloadAllowed: false,
      productionStorageEnforcement: false
    }),
    summary: sanitizeDashboardObject({
      groupCount: 11,
      totalEvents: git.auditEvents.length + llm.auditEvents.length + agents.auditEvents.length + policy.auditEntries.length + auth.auditEvents.length + security.auditEvents.length + mcp.auditEvents.length + readiness.checks.length + readiness.risks.length + providers.auditEvents.length + localAgents.auditEvents.length + registry.auditLogs.length,
      noSecretsExposed: true
    })
  };

  const sections = {
    overview: {} as DashboardOverviewReadModel,
    tasks,
    git,
    githubApp,
    githubAppIntegration,
    conflicts,
    registry,
    llm,
    llmIntegration,
    agents,
    policy,
    policyBundles,
    policyShadow,
    policyRuntimePoc,
    auth,
    authProduction,
    authProviders,
    providers,
    security,
    localAgents,
    mcp,
    scopes,
    tenantScopePlanning,
    tenantScopeEnforcement,
    dashboardScopeFilter,
    readiness,
    database,
    collaborationStores,
    secretBackend,
    secretBackendDecision,
    vaultSecretBackend,
    vaultIntegration,
    mergeQueueIntegration,
    branchCleanup,
    registryCompatibility,
    registryDrift,
    registryCanaryApply,
    staging,
    stagingDryRun,
    stagingReleaseCandidate,
    stagingExecution,
    cicd,
    observability,
    audit
  };
  const scopeMetadataFor = (panelId: string): ScopedReadModelMetadata =>
    withDemoEnforcementMetadata(
      sanitizeDashboardObject(tenantScopePlanningService.getDashboardPanelScopeMetadata(panelId) ?? fallbackScopeMetadata(panelId)) as unknown as ScopedReadModelMetadata,
      tenantScopeEnforcementService,
      tenantScopePlanningService.getDashboardPanelScopeSummary(panelId),
      panelId
    );
  const overview = withScopeMetadata(sourceOverview(source, sections), scopeMetadataFor("overview"));

  return {
    overview,
    tasks: withScopeMetadata(tasks, scopeMetadataFor("tasks")),
    git: withScopeMetadata(git, scopeMetadataFor("git")),
    githubApp: withScopeMetadata(githubApp, scopeMetadataFor("github_app")),
    githubAppIntegration: withScopeMetadata(githubAppIntegration, scopeMetadataFor("github_app_integration")),
    conflicts: withScopeMetadata(conflicts, scopeMetadataFor("conflict_risks")),
    registry: withScopeMetadata(registry, scopeMetadataFor("registry")),
    llm: withScopeMetadata(llm, scopeMetadataFor("llm_gateway")),
    llmIntegration: withScopeMetadata(llmIntegration, scopeMetadataFor("llm_integration")),
    agents: withScopeMetadata(agents, scopeMetadataFor("local_agent_runner")),
    policy: withScopeMetadata(policy, scopeMetadataFor("policy")),
    policyBundles: withScopeMetadata(policyBundles, scopeMetadataFor("policy_bundles")),
    policyShadow: withScopeMetadata(policyShadow, scopeMetadataFor("policy_shadow")),
    policyRuntimePoc: withScopeMetadata(policyRuntimePoc, scopeMetadataFor("policy_runtime_poc")),
    auth: withScopeMetadata(auth, scopeMetadataFor("auth")),
    authProduction: withScopeMetadata(authProduction, scopeMetadataFor("auth_production")),
    authProviders: withScopeMetadata(authProviders, scopeMetadataFor("auth_provider_skeleton")),
    providers: withScopeMetadata(providers, scopeMetadataFor("providers")),
    security: withScopeMetadata(security, scopeMetadataFor("security")),
    localAgents: withScopeMetadata(localAgents, scopeMetadataFor("local_agent_protocol")),
    mcp: withScopeMetadata(mcp, scopeMetadataFor("mcp_gateway")),
    scopes: withScopeMetadata(scopes, scopeMetadataFor("scope_model")),
    tenantScopePlanning,
    tenantScopeEnforcement,
    dashboardScopeFilter: withScopeMetadata(dashboardScopeFilter, scopeMetadataFor("tenant_scope_enforcement")),
    readiness: withScopeMetadata(readiness, scopeMetadataFor("production_readiness")),
    database: withScopeMetadata(database, scopeMetadataFor("database")),
    collaborationStores: withScopeMetadata(collaborationStores, scopeMetadataFor("collaboration_stores")),
    secretBackend: withScopeMetadata(secretBackend, scopeMetadataFor("secret_backend")),
    secretBackendDecision: withScopeMetadata(secretBackendDecision, scopeMetadataFor("secret_backend_decision")),
    vaultSecretBackend: withScopeMetadata(vaultSecretBackend, scopeMetadataFor("vault_secret_backend")),
    vaultIntegration: withScopeMetadata(vaultIntegration, scopeMetadataFor("vault_integration")),
    mergeQueueIntegration: withScopeMetadata(mergeQueueIntegration, scopeMetadataFor("merge_queue_integration")),
    branchCleanup: withScopeMetadata(branchCleanup, scopeMetadataFor("branch_cleanup")),
    registryCompatibility: withScopeMetadata(registryCompatibility, scopeMetadataFor("registry_compatibility")),
    registryDrift: withScopeMetadata(registryDrift, scopeMetadataFor("registry_drift")),
    registryCanaryApply: withScopeMetadata(registryCanaryApply, scopeMetadataFor("registry_canary_apply")),
    staging: withScopeMetadata(staging, scopeMetadataFor("staging")),
    stagingDryRun: withScopeMetadata(stagingDryRun, scopeMetadataFor("staging_dry_run")),
    stagingReleaseCandidate: withScopeMetadata(stagingReleaseCandidate, scopeMetadataFor("staging_rc")),
    stagingExecution: withScopeMetadata(stagingExecution, scopeMetadataFor("staging_execution")),
    cicd: withScopeMetadata(cicd, scopeMetadataFor("ci_cd")),
    observability: withScopeMetadata(observability, scopeMetadataFor("observability")),
    audit: withScopeMetadata(audit, scopeMetadataFor("audit"))
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
        githubAppResponse,
        githubAppIntegrationResponse,
        conflictsResponse,
        registryResponse,
        llmResponse,
        llmIntegrationResponse,
        vaultIntegrationResponse,
        mergeQueueIntegrationResponse,
        branchCleanupResponse,
        registryCompatibilityResponse,
        registryDriftResponse,
        registryCanaryApplyResponse,
        agentsResponse,
        policyResponse,
        policyBundlesResponse,
        policyShadowResponse,
        policyRuntimePocResponse,
        authResponse,
        authProductionResponse,
        authProvidersResponse,
        providersResponse,
        securityResponse,
        localAgentsResponse,
        mcpResponse,
        scopesResponse,
        tenantScopePlanningResponse,
        tenantScopeEnforcementResponse,
        dashboardScopeFilterResponse,
        readinessResponse,
        databaseResponse,
        collaborationStoresResponse,
        secretBackendResponse,
        secretBackendDecisionResponse,
        vaultSecretBackendResponse,
        stagingResponse,
        stagingDryRunResponse,
        stagingReleaseCandidateResponse,
        stagingExecutionResponse,
        cicdResponse,
        observabilityResponse,
        auditResponse
      ] = await Promise.all(dashboardReadModelEndpoints.map((endpoint) => this.getJson(endpoint)));

      return {
        overview: objectValue((overviewResponse as Record<string, unknown>).overview) as unknown as DashboardOverviewReadModel,
        tasks: objectValue((tasksResponse as Record<string, unknown>).tasks) as unknown as TaskRunSummaryReadModel,
        git: objectValue((gitResponse as Record<string, unknown>).git) as unknown as GitIntegrationReadModel,
        githubApp: objectValue((githubAppResponse as Record<string, unknown>).githubApp) as unknown as GitHubAppHardeningReadModel,
        githubAppIntegration: objectValue((githubAppIntegrationResponse as Record<string, unknown>).githubAppIntegration) as unknown as GitHubAppIntegrationTestReadModel,
        conflicts: objectValue((conflictsResponse as Record<string, unknown>).conflicts) as unknown as ConflictManagerReadModel,
        registry: objectValue((registryResponse as Record<string, unknown>).registry) as unknown as RegistryReadModel,
        llm: objectValue((llmResponse as Record<string, unknown>).llm) as unknown as LLMGatewayReadModel,
        llmIntegration: objectValue((llmIntegrationResponse as Record<string, unknown>).llmIntegration) as unknown as LLMIntegrationTestReadModel,
        agents: objectValue((agentsResponse as Record<string, unknown>).agents) as unknown as AgentRunnerReadModel,
        policy: objectValue((policyResponse as Record<string, unknown>).policy) as unknown as PolicyReadModel,
        policyBundles: objectValue((policyBundlesResponse as Record<string, unknown>).policyBundles) as unknown as PolicyBundleReadinessReadModel,
        policyShadow: objectValue((policyShadowResponse as Record<string, unknown>).policyShadow) as unknown as PolicyShadowEvaluationReadModel,
        policyRuntimePoc: objectValue((policyRuntimePocResponse as Record<string, unknown>).policyRuntimePoc) as unknown as PolicyRuntimePocReadinessReadModel,
        auth: objectValue((authResponse as Record<string, unknown>).auth) as unknown as AuthReadModel,
        authProduction: objectValue((authProductionResponse as Record<string, unknown>).authProduction) as unknown as AuthRbacProductionReadinessReadModel,
        authProviders: objectValue((authProvidersResponse as Record<string, unknown>).authProviders) as unknown as ProductionAuthProviderSkeletonReadModel,
        providers: objectValue((providersResponse as Record<string, unknown>).providers) as unknown as EnterpriseProviderReadModel,
        security: objectValue((securityResponse as Record<string, unknown>).security) as unknown as SecurityReadModel,
        localAgents: objectValue((localAgentsResponse as Record<string, unknown>).localAgents) as unknown as LocalAgentReadModel,
        mcp: objectValue((mcpResponse as Record<string, unknown>).mcp) as unknown as MCPGatewayReadModel,
        scopes: objectValue((scopesResponse as Record<string, unknown>).scopes) as unknown as ScopeReadinessReadModel,
        tenantScopePlanning: objectValue((tenantScopePlanningResponse as Record<string, unknown>).tenantScopePlanning) as unknown as DashboardTenantScopePlanningReadModel,
        tenantScopeEnforcement: objectValue((tenantScopeEnforcementResponse as Record<string, unknown>).tenantScopeEnforcement) as unknown as TenantScopeEnforcementReadModel,
        dashboardScopeFilter: objectValue((dashboardScopeFilterResponse as Record<string, unknown>).dashboardScopeFilter) as unknown as DashboardScopeFilterReadModel,
        readiness: objectValue((readinessResponse as Record<string, unknown>).readiness) as unknown as DeploymentReadinessReadModel,
        database: objectValue((databaseResponse as Record<string, unknown>).database) as unknown as DatabaseOperationsReadModel,
        collaborationStores: objectValue((collaborationStoresResponse as Record<string, unknown>).collaborationStores) as unknown as DurableCollaborationStoresReadModel,
        secretBackend: objectValue((secretBackendResponse as Record<string, unknown>).secretBackend) as unknown as SecretBackendMigrationReadModel,
        secretBackendDecision: objectValue((secretBackendDecisionResponse as Record<string, unknown>).secretBackendDecision) as unknown as SecretBackendDecisionReadModel,
        vaultSecretBackend: objectValue((vaultSecretBackendResponse as Record<string, unknown>).vaultSecretBackend) as unknown as VaultSecretBackendReadModel,
        vaultIntegration: objectValue((vaultIntegrationResponse as Record<string, unknown>).vaultIntegration) as unknown as VaultIntegrationTestReadModel,
        mergeQueueIntegration: objectValue((mergeQueueIntegrationResponse as Record<string, unknown>).mergeQueueIntegration) as unknown as MergeQueueIntegrationTestReadModel,
        branchCleanup: objectValue((branchCleanupResponse as Record<string, unknown>).branchCleanup) as unknown as BranchCleanupReadModel,
        registryCompatibility: objectValue((registryCompatibilityResponse as Record<string, unknown>).registryCompatibility) as unknown as RegistryCompatibilityReadModel,
        registryDrift: objectValue((registryDriftResponse as Record<string, unknown>).registryDrift) as unknown as RegistryDriftReadModel,
        registryCanaryApply: objectValue((registryCanaryApplyResponse as Record<string, unknown>).registryCanaryApply) as unknown as RegistryCanaryApplyReadModel,
        staging: objectValue((stagingResponse as Record<string, unknown>).staging) as unknown as StagingDeploymentReadModel,
        stagingDryRun: objectValue((stagingDryRunResponse as Record<string, unknown>).stagingDryRun) as unknown as StagingDeploymentDryRunReadModel,
        stagingReleaseCandidate: objectValue((stagingReleaseCandidateResponse as Record<string, unknown>).stagingReleaseCandidate) as unknown as StagingReleaseCandidateReadModel,
        stagingExecution: objectValue((stagingExecutionResponse as Record<string, unknown>).stagingExecution) as unknown as StagingDeploymentExecutionReadModel,
        cicd: objectValue((cicdResponse as Record<string, unknown>).cicd) as unknown as CICDPipelineReadModel,
        observability: objectValue((observabilityResponse as Record<string, unknown>).observability) as unknown as ObservabilityReadModel,
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
