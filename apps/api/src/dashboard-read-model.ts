import { listMockScopeCatalog, scopeSummary } from "@aichestra/auth";
import type { AuthorizationService } from "@aichestra/auth";
import type { TenantScopeEnforcementService } from "@aichestra/auth";
import type { InMemoryAichestraStore } from "@aichestra/db";
import type { DashboardReadinessTenantScopePlanningService, DeploymentReadinessService } from "@aichestra/deployment-readiness";
import type { GitHubAppRuntimeService, GitHubWebhookRuntimeConfig, GitIntegrationService, GitProviderRuntimeConfig, GitWebhookReceiverService } from "@aichestra/git-adapter";
import type { ImprovementServices } from "@aichestra/improvement";
import type { LLMGatewayService, LocalAgentProtocolService, ProviderAbstractionService } from "@aichestra/llm-gateway";
import type { MCPGateway } from "@aichestra/mcp-gateway";
import type { ObservabilityService } from "@aichestra/observability";
import type { PolicyService } from "@aichestra/policy";
import type { RegistryService } from "@aichestra/registry";
import type { AgentRunnerService } from "@aichestra/runner";
import type { SecurityControlService } from "@aichestra/security";
import {
  sanitizeDashboardArray,
  sanitizeDashboardObject,
  type AgentRunnerReadModel,
  type AuthRbacProductionReadinessReadModel,
  type AuthReadModel,
  type AuditSummaryReadModel,
  type CICDPipelineReadModel,
  type ConflictManagerReadModel,
  type DashboardJsonObject,
  type DashboardOverviewReadModel,
  type DashboardPanelScopeSummary,
  type DashboardReadModels,
  type DashboardReadModelSource,
  type DashboardTenantScopePlanningReadModel,
  type TenantScopeEnforcementReadModel,
  type DatabaseOperationsReadModel,
  type DeploymentReadinessReadModel,
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
  type RegistryReadModel,
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
  type VaultIntegrationTestReadModel,
  type VaultSecretBackendReadModel
} from "@aichestra/shared";

export type DashboardReadModelContext = {
  store: InMemoryAichestraStore;
  gitIntegrationService: GitIntegrationService;
  gitProviderConfig: GitProviderRuntimeConfig;
  githubAppRuntimeService: GitHubAppRuntimeService;
  gitWebhookReceiverService: GitWebhookReceiverService;
  gitWebhookConfig: GitHubWebhookRuntimeConfig;
  llmGatewayService: LLMGatewayService;
  agentRunnerService: AgentRunnerService;
  registryService: RegistryService;
  improvementServices: ImprovementServices;
  policyService: PolicyService;
  authorizationService: AuthorizationService;
  providerAbstractionService: ProviderAbstractionService;
  securityService: SecurityControlService;
  localAgentProtocolService: LocalAgentProtocolService;
  mcpGatewayService: MCPGateway;
  deploymentReadinessService: DeploymentReadinessService;
  tenantScopePlanningService: DashboardReadinessTenantScopePlanningService;
  tenantScopeEnforcementService: TenantScopeEnforcementService;
  observabilityService: ObservabilityService;
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

function fallbackScopeMetadata(surfaceId: string): ScopedReadModelMetadata {
  return {
    scopeStatus: "metadata_only",
    appliedScopes: [],
    requiredScopes: [],
    missingScopes: [],
    sensitivity: "internal_metadata",
    roleVisibility: sanitizeDashboardObject({
      allowedRoles: ["platform_admin"],
      hint: "No explicit tenant scope plan was found for this surface."
    }),
    redactionStatus: "metadata_only",
    tenantFilteringImplemented: false,
    productionEnforcementImplemented: false,
    warnings: [
      "scope_plan_not_found",
      "tenant_filtering_implemented:false",
      "production_tenant_enforcement:false"
    ],
    metadata: sanitizeDashboardObject({
      surfaceId,
      planningOnly: true,
      noSecretsOrEnvValues: true,
      productionReady: false
    })
  };
}

function dashboardScopeMetadata(context: DashboardReadModelContext, panelId: string): ScopedReadModelMetadata {
  const baseMetadata = context.tenantScopePlanningService.getDashboardPanelScopeMetadata(panelId) ?? fallbackScopeMetadata(panelId);
  const panelSummary = context.tenantScopePlanningService.getDashboardPanelScopeSummary(panelId);
  const decision = panelSummary
    ? context.tenantScopeEnforcementService.evaluateDashboardPanelAccess(undefined, panelSummary, { source: `dashboard:${panelId}` })
    : context.tenantScopeEnforcementService.evaluateScopeAccess(undefined, undefined, { source: `dashboard:${panelId}` });
  const decisionSummary = context.tenantScopeEnforcementService.summarizeDecision(decision);
  return sanitizeDashboardObject({
    ...baseMetadata,
    tenantScopeEnforcementImplemented: "partial",
    enforcementMode: decision.enforcementMode,
    scopeDecisionSummary: decisionSummary,
    warnings: unique([
      ...baseMetadata.warnings,
      ...decisionSummary.warnings
    ]),
    metadata: {
      ...baseMetadata.metadata,
      tenantScopeEnforcementStatus: "v1_implemented_partial",
      representativeEnforcementOnly: true,
      productionTenantEnforcement: false
    }
  }) as unknown as ScopedReadModelMetadata;
}

function withScopeMetadata<T extends { scopeMetadata?: ScopedReadModelMetadata }>(
  readModel: T,
  scopeMetadata: ScopedReadModelMetadata
): T {
  return {
    ...readModel,
    scopeMetadata
  };
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
  const webhookConfig = context.gitWebhookReceiverService.getConfig();
  const webhookEvents = context.gitWebhookReceiverService.listEvents();
  const webhookAuditEvents = context.gitWebhookReceiverService.listAuditEvents();
  const pullRequestSyncStates = context.gitWebhookReceiverService.listPullRequestSyncStates();
  const branchSyncStates = context.gitWebhookReceiverService.listBranchSyncStates();
  const lastChangedFilesAudit = webhookAuditEvents.find((event) => event.eventType.startsWith("github_changed_files_refresh_"));
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
    webhookConfig: sanitizeDashboardObject({
      webhooksEnabled: webhookConfig.webhooksEnabled,
      webhookSecretConfigured: webhookConfig.webhookSecretConfigured,
      webhookSecretSource: webhookConfig.webhookSecretSource,
      webhookSecretStatus: webhookConfig.webhookSecretStatus,
      webhookAcceptUnverified: webhookConfig.webhookAcceptUnverified,
      webhookAllowedRepoCount: webhookConfig.webhookAllowedRepoCount,
      webhookIntegrationTestsEnabled: webhookConfig.webhookIntegrationTestsEnabled,
      supportedWebhookEventCount: webhookConfig.supportedWebhookEvents.length
    }),
    providers: sanitizeDashboardArray(context.gitIntegrationService.listProviders()),
    repos: sanitizeDashboardArray(repos),
    branchRecords: sanitizeDashboardArray(branchRecords),
    pullRequests: sanitizeDashboardArray(pullRequests),
    webhookEvents: sanitizeDashboardArray(webhookEvents.slice(0, 20)),
    webhookAuditEvents: sanitizeDashboardArray(webhookAuditEvents.slice(0, 20)),
    pullRequestSyncStates: sanitizeDashboardArray(pullRequestSyncStates),
    branchSyncStates: sanitizeDashboardArray(branchSyncStates),
    changedFiles: sanitizeDashboardArray(changedFiles),
    changedFilesRefreshStatus: sanitizeDashboardObject({
      lastResult: lastChangedFilesAudit?.result ?? "none",
      lastReason: lastChangedFilesAudit?.reason ?? null,
      lastEventType: lastChangedFilesAudit?.eventType ?? null,
      refreshAuditEvents: webhookAuditEvents.filter((event) => event.eventType.startsWith("github_changed_files_refresh_")).length
    }),
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
      },
      {
        operation: "github_webhook_unverified",
        reason: webhookConfig.webhooksEnabled ? "signature_verification_required" : "github_webhooks_disabled"
      }
    ]),
    safety: sanitizeDashboardObject({
      remoteGitEnabled: context.gitProviderConfig.remoteGitEnabled,
      remoteBranchCreateEnabled: context.gitProviderConfig.remoteBranchCreateEnabled,
      remotePullRequestCreateEnabled: context.gitProviderConfig.remotePullRequestCreateEnabled,
      remoteMergeEnabled: false,
      githubConfigured: context.gitProviderConfig.githubConfigured,
      githubCredentialSource: context.gitProviderConfig.githubCredentialSource ?? "none",
      githubCredentialStatus: context.gitProviderConfig.githubCredentialStatus ?? (context.gitProviderConfig.githubConfigured ? "resolved" : "missing"),
      githubAllowedRepoCount: context.gitProviderConfig.githubAllowedRepoCount ?? context.gitProviderConfig.githubAllowedRepos?.length ?? 0,
      githubAllowedBranchPrefix: context.gitProviderConfig.githubAllowedBranchPrefix ?? "ai/",
      githubWebhooksEnabled: webhookConfig.webhooksEnabled,
      githubWebhookSecretConfigured: webhookConfig.webhookSecretConfigured,
      githubWebhookAcceptUnverified: webhookConfig.webhookAcceptUnverified,
      automaticMergeEnabled: false,
      rebasePushEnabled: false,
      forcePushEnabled: false,
      branchDeletionEnabled: false,
      tokenExposed: false,
      webhookSecretExposed: false
    })
  };
}

function buildGitHubApp(context: DashboardReadModelContext): GitHubAppHardeningReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getGitHubWebhookHardeningSummary();
  const readinessChecks = readiness.listGitHubAppReadinessChecks();
  const runtimeConfig = context.githubAppRuntimeService.getConfigDto();
  const runtimeInstallations = context.githubAppRuntimeService.listInstallationsDto();
  const runtimeRepositoryGrants = context.githubAppRuntimeService.listRepositoryGrantsDto();
  const runtimeAuditEvents = context.githubAppRuntimeService.listAuditEventsDto().slice(0, 20);
  return {
    summary: sanitizeDashboardObject(summary),
    runtimeConfig: sanitizeDashboardObject(runtimeConfig),
    runtimeInstallations: sanitizeDashboardArray(runtimeInstallations),
    runtimeRepositoryGrants: sanitizeDashboardArray(runtimeRepositoryGrants),
    tokenReadiness: sanitizeDashboardObject({
      authMode: runtimeConfig.authMode,
      enabled: runtimeConfig.enabled,
      configured: runtimeConfig.configured,
      tokenProviderKind: runtimeConfig.tokenProviderKind,
      privateKeySecretRefConfigured: runtimeConfig.privateKeySecretRefConfigured,
      allowedInstallationCount: runtimeConfig.allowedInstallationCount,
      allowedRepoCount: runtimeConfig.allowedRepoCount,
      legacyTokenFallbackWarning: context.gitProviderConfig.githubLegacyTokenFallbackEnabled === true,
      realInstallationTokenExchangeEnabled: false
    }),
    runtimeAuditEvents: sanitizeDashboardArray(runtimeAuditEvents),
    controlledImplementation: sanitizeDashboardObject({
      status: runtimeConfig.configured === true ? "configured_mock" : "disabled_or_blocked",
      implemented: true,
      productionReady: false,
      liveGitHubAppCallsEnabled: false,
      privateKeySigningEnabled: false,
      tokenExchangeEnabled: false,
      rawTokensReturned: false
    }),
    appDescriptors: sanitizeDashboardArray(readiness.listGitHubAppDescriptors()),
    installations: sanitizeDashboardArray(readiness.listGitHubAppInstallations()),
    repositoryGrants: sanitizeDashboardArray(readiness.listGitHubAppRepositoryGrants()),
    permissionMatrix: sanitizeDashboardArray(readiness.listGitHubAppPermissionMatrix()),
    webhookEventAllowlist: sanitizeDashboardArray(readiness.listGitHubWebhookEventAllowlist()),
    replayProtection: sanitizeDashboardObject(readiness.getGitHubWebhookReplayProtectionPlan()),
    webhookDeliveries: sanitizeDashboardArray(readiness.listGitHubWebhookDeliveryRecords()),
    deadLetterPlan: sanitizeDashboardObject(readiness.getGitHubWebhookDeadLetterPlan()),
    deadLetterRecords: sanitizeDashboardArray(readiness.listGitHubWebhookDeadLetterRecords()),
    credentialReadiness: sanitizeDashboardObject(readiness.getGitHubAppCredentialReadiness()),
    productionEndpoint: sanitizeDashboardObject(readiness.getGitHubProductionWebhookEndpointPlan()),
    readinessChecks: sanitizeDashboardArray(readinessChecks),
    productionRisks: sanitizeDashboardArray(readiness.listGitHubAppProductionRisks()),
    blockers: sanitizeDashboardArray(readinessChecks.filter((check) => check.status === "fail")),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      privateKeysStored: false,
      webhookSecretsExposed: false,
      installationTokensIssued: false,
      tokenHandlesOnly: true,
      rawWebhookPayloadsStored: false,
      externalCallsEnabled: summary.externalCallsEnabled
    })
  };
}

function buildGitHubAppIntegration(context: DashboardReadModelContext): GitHubAppIntegrationTestReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getGitHubAppIntegrationTestReadinessSummary();
  const safetyChecks = readiness.listGitHubAppIntegrationTestSafetyChecks();
  const testCases = readiness.listGitHubAppIntegrationTestCases();
  return {
    summary: sanitizeDashboardObject(summary),
    profile: sanitizeDashboardObject(readiness.getGitHubAppIntegrationTestProfile()),
    testCases: sanitizeDashboardArray(testCases),
    gatedLiveTestCases: sanitizeDashboardArray(testCases.filter((testCase) => testCase.requiresLiveGitHub)),
    fixtureTestCases: sanitizeDashboardArray(testCases.filter((testCase) => !testCase.requiresLiveGitHub)),
    safetyChecks: sanitizeDashboardArray(safetyChecks),
    blockers: sanitizeDashboardArray(safetyChecks.filter((check) => check.status === "fail")),
    warnings: sanitizeDashboardArray(safetyChecks.filter((check) => check.status === "warning")),
    cleanupPolicy: sanitizeDashboardObject({
      status: summary.cleanupPolicyStatus,
      branchDeletionAllowed: false,
      remoteCleanupCallsEnabledByDefault: false,
      manualCloseOrMarkOnly: true
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed,
      privateKeyExposed: summary.privateKeyExposed,
      installationTokenExposed: summary.installationTokenExposed,
      githubCallsInDefaultTests: summary.githubCallsInDefaultTests,
      noAutoMerge: summary.noAutoMerge,
      noForcePush: summary.noForcePush,
      noBranchDelete: summary.noBranchDelete
    })
  };
}

function buildLlmIntegration(context: DashboardReadModelContext): LLMIntegrationTestReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getLLMIntegrationTestReadinessSummary();
  const safetyChecks = readiness.listLLMIntegrationTestSafetyChecks();
  const testCases = readiness.listLLMIntegrationTestCases();
  return {
    summary: sanitizeDashboardObject(summary),
    profile: sanitizeDashboardObject(readiness.getLLMIntegrationTestProfile()),
    testCases: sanitizeDashboardArray(testCases),
    gatedLiveTestCases: sanitizeDashboardArray(testCases.filter((testCase) => testCase.requiresRemoteLLM)),
    mockTestCases: sanitizeDashboardArray(testCases.filter((testCase) => !testCase.requiresRemoteLLM)),
    safetyChecks: sanitizeDashboardArray(safetyChecks),
    blockers: sanitizeDashboardArray(safetyChecks.filter((check) => check.status === "fail")),
    warnings: sanitizeDashboardArray(safetyChecks.filter((check) => check.status === "warning")),
    gateStatus: sanitizeDashboardObject({
      configuredGateCount: summary.configuredGateCount,
      missingGateCount: summary.missingGateCount,
      unsafeGateCount: summary.unsafeGateCount,
      providerKind: summary.providerKind,
      baseUrlConfigured: summary.baseUrlConfigured,
      apiKeyConfigured: summary.apiKeyConfigured,
      secretRefConfigured: summary.secretRefConfigured,
      allowedModelCount: summary.allowedModelCount,
      budgetConfigured: summary.budgetConfigured,
      fallbackSafe: summary.fallbackSafe,
      envValuesReturned: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed,
      apiKeyExposed: summary.apiKeyExposed,
      rawProviderResponseExposed: summary.rawProviderResponseExposed,
      remoteLlmCallsInDefaultTests: summary.remoteLlmCallsInDefaultTests,
      noStreaming: summary.noStreaming,
      noToolCalls: summary.noToolCalls,
      noVendorCli: summary.noVendorCli,
      noCredentialCacheRead: summary.noCredentialCacheRead
    })
  };
}

function buildDatabase(context: DashboardReadModelContext): DatabaseOperationsReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getDatabaseOperationsSummary();
  const checks = readiness.listDatabaseReadinessChecks();
  const risks = readiness.listDatabaseOperationRisks();
  return {
    summary: sanitizeDashboardObject(summary),
    profiles: sanitizeDashboardArray(readiness.listDatabaseDeploymentProfiles()),
    checks: sanitizeDashboardArray(checks),
    risks: sanitizeDashboardArray(risks),
    migrations: sanitizeDashboardArray(readiness.getDatabaseMigrationStatus()),
    schemaInventory: sanitizeDashboardArray(readiness.getDatabaseSchemaInventory()),
    indexReview: sanitizeDashboardArray(readiness.getDatabaseIndexReview()),
    retentionPlan: sanitizeDashboardObject(readiness.getDatabaseRetentionPlan()),
    auditGrowthPlan: sanitizeDashboardObject(readiness.getDatabaseAuditGrowthPlan()),
    webhookPersistencePlan: sanitizeDashboardObject(readiness.getDatabaseWebhookPersistencePlan()),
    criticalRisks: sanitizeDashboardArray(risks.filter((risk) => risk.status === "open" && (risk.severity === "critical" || risk.severity === "high"))),
    blockers: sanitizeDashboardArray(checks.filter((check) => check.status === "fail")),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      databaseUrlExposed: summary.databaseUrlExposed,
      databaseUrlValueReturned: false,
      productionDbConnectionAttempted: summary.productionDbConnectionAttempted,
      destructiveOperationsEnabled: false,
      retentionDeletionJobsEnabled: summary.retentionDeletionJobsEnabled
    })
  };
}

function buildSecretBackend(context: DashboardReadModelContext): SecretBackendMigrationReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getSecretBackendMigrationSummary();
  const checks = readiness.listSecretBackendReadinessChecks();
  const risks = readiness.listSecretBackendRisks();
  const rotationPlans = readiness.listSecretRotationPlans();
  const leasePolicies = readiness.listSecretLeasePolicies();
  const credentialKinds = [...new Set([
    ...rotationPlans.map((plan) => plan.secretKind),
    ...leasePolicies.map((policy) => policy.secretKind)
  ])];
  return {
    summary: sanitizeDashboardObject(summary),
    backendOptions: sanitizeDashboardArray(readiness.listSecretBackendOptions()),
    migrationPhases: sanitizeDashboardArray(readiness.listSecretBackendMigrationPhases()),
    readinessChecks: sanitizeDashboardArray(checks),
    risks: sanitizeDashboardArray(risks),
    rotationPlans: sanitizeDashboardArray(rotationPlans),
    leasePolicies: sanitizeDashboardArray(leasePolicies),
    blockers: sanitizeDashboardArray(checks.filter((check) => check.status === "fail")),
    credentialKindStatus: sanitizeDashboardArray(credentialKinds.map((secretKind) => ({
      secretKind,
      rotationStatus: rotationPlans.find((plan) => plan.secretKind === secretKind)?.status ?? "future",
      leaseStatus: leasePolicies.find((policy) => policy.secretKind === secretKind)?.status ?? "future",
      noSecretValueExposed: true
    }))),
    envFallback: sanitizeDashboardObject({
      allowedForCurrentProfile: summary.envFallbackAllowedForCurrentProfile,
      warning: summary.envFallbackWarning,
      envSecretProviderEnabled: summary.envSecretProviderEnabled,
      allowedSecretEnvKeyCount: summary.allowedSecretEnvKeyCount,
      productionReady: summary.legacyEnvFallbackProductionReady,
      envValuesExposed: summary.envValuesExposed
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed,
      credentialCachesRead: summary.credentialCachesRead,
      credentialResolutionAttempted: summary.credentialResolutionAttempted,
      rotationJobsImplemented: summary.rotationJobsImplemented,
      productionCredentialIssuanceImplemented: summary.productionCredentialIssuanceImplemented,
      externalCallsEnabled: summary.externalCallsEnabled
    })
  };
}

function buildSecretBackendDecision(context: DashboardReadModelContext): SecretBackendDecisionReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getSecretBackendOptionDecisionSummary();
  const decision = readiness.getSecretBackendOptionDecision();
  const scores = readiness.listSecretBackendDecisionScores();
  const scoreTotals = new Map<string, { backendKind: string; weightedScore: number; scoreCount: number }>();
  for (const score of scores) {
    const current = scoreTotals.get(score.backendKind) ?? { backendKind: score.backendKind, weightedScore: 0, scoreCount: 0 };
    current.weightedScore += score.weightedScore;
    current.scoreCount += 1;
    scoreTotals.set(score.backendKind, current);
  }

  return {
    summary: sanitizeDashboardObject(summary),
    decision: sanitizeDashboardObject(decision),
    criteria: sanitizeDashboardArray(readiness.listSecretBackendDecisionCriteria()),
    scores: sanitizeDashboardArray(scores),
    implementationScopes: sanitizeDashboardArray(readiness.listSecretBackendImplementationScopes()),
    providerMappings: sanitizeDashboardArray(readiness.listSecretBackendProviderMappings()),
    risks: sanitizeDashboardArray(readiness.listSecretBackendDecisionRisks()),
    backendScoreSummary: sanitizeDashboardArray([...scoreTotals.values()].sort((left, right) => right.weightedScore - left.weightedScore)),
    envFallbackWarning: sanitizeDashboardObject({
      productionAllowed: summary.envFallbackProductionAllowed,
      recommendedAsProductionDefault: false,
      policy: "env fallback remains local/integration only and must not be production primary storage"
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed,
      externalCallsEnabled: summary.externalCallsEnabled,
      secretReadsAttempted: summary.secretReadsAttempted,
      secretRotationsAttempted: summary.secretRotationsAttempted,
      secretMigrationsAttempted: summary.secretMigrationsAttempted,
      productionCredentialsIssued: summary.productionCredentialsIssued,
      credentialCachesRead: summary.credentialCachesRead,
      productionSecretBackendImplemented: summary.productionSecretBackendImplemented
    })
  };
}

function buildVaultSecretBackend(context: DashboardReadModelContext): VaultSecretBackendReadModel {
  const summary = context.securityService.getVaultSummary();
  const config = context.securityService.getVaultConfig();
  const health = context.securityService.getVaultHealth();
  const checks = context.securityService.listVaultReadinessChecks();
  const vaultAuditEvents = context.securityService.listAuditEvents({ targetKind: "secret" })
    .filter((event) => event.eventType.startsWith("vault_"));
  const vaultRefs = context.securityService.listSecretRefs().filter((secretRef) => secretRef.provider === "vault");
  return {
    summary: sanitizeDashboardObject(summary),
    config: sanitizeDashboardObject({
      selectedProvider: config.selectedProvider,
      vaultProviderEnabled: config.vaultProviderEnabled,
      vaultAddressConfigured: config.vaultAddressConfigured,
      vaultNamespaceConfigured: config.vaultNamespaceConfigured,
      vaultAuthMethod: config.vaultAuthMethod,
      vaultTokenConfigured: config.vaultTokenConfigured,
      vaultAllowedPathPrefixCount: config.vaultAllowedPathPrefixCount,
      vaultIntegrationTestsEnabled: config.vaultIntegrationTestsEnabled,
      liveUsageReady: config.liveUsageReady,
      configStatus: config.configStatus,
      productionSecretBackendImplemented: false,
      envFallbackProductionAllowed: false
    }),
    health: sanitizeDashboardObject(health),
    checks: sanitizeDashboardArray(checks),
    auditEvents: sanitizeDashboardArray(vaultAuditEvents),
    secretRefExamples: sanitizeDashboardArray(vaultRefs.map((secretRef) => ({
      id: secretRef.id,
      secretKind: secretRef.secretKind,
      status: secretRef.status,
      vaultMountConfigured: Boolean(secretRef.metadata.vaultMount),
      vaultPathConfigured: Boolean(secretRef.metadata.vaultPath),
      vaultKeyConfigured: Boolean(secretRef.metadata.vaultKey),
      containsSecretMaterial: false
    }))),
    blockedExamples: sanitizeDashboardArray([
      { operation: "vault.default_runtime_call", reason: "vault_provider_disabled_by_default" },
      { operation: "vault.path_not_allowlisted", reason: "vault_path_not_allowlisted_blocks_before_client_read" },
      { operation: "vault.token_exposure", reason: "vault_token_never_returned" },
      { operation: "secret.read", reason: "secret_read_denied_by_policy" }
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
}

function buildVaultIntegration(context: DashboardReadModelContext): VaultIntegrationTestReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getVaultIntegrationTestReadinessSummary();
  const safetyChecks = readiness.listVaultIntegrationTestSafetyChecks();
  const testCases = readiness.listVaultIntegrationTestCases();
  return {
    summary: sanitizeDashboardObject(summary),
    profile: sanitizeDashboardObject(readiness.getVaultIntegrationTestProfile()),
    testCases: sanitizeDashboardArray(testCases),
    gatedLiveTestCases: sanitizeDashboardArray(testCases.filter((testCase) => testCase.requiresLiveVault)),
    mockTestCases: sanitizeDashboardArray(testCases.filter((testCase) => !testCase.requiresLiveVault)),
    safetyChecks: sanitizeDashboardArray(safetyChecks),
    blockers: sanitizeDashboardArray(safetyChecks.filter((check) => check.status === "fail")),
    warnings: sanitizeDashboardArray(safetyChecks.filter((check) => check.status === "warning")),
    gateStatus: sanitizeDashboardObject({
      configuredGateCount: summary.configuredGateCount,
      missingGateCount: summary.missingGateCount,
      unsafeGateCount: summary.unsafeGateCount,
      vaultBackendSelected: summary.vaultBackendSelected,
      vaultProviderEnabled: summary.vaultProviderEnabled,
      vaultAddressConfigured: summary.vaultAddressConfigured,
      vaultNamespaceConfigured: summary.vaultNamespaceConfigured,
      vaultAuthMethod: summary.vaultAuthMethod,
      vaultTokenConfigured: summary.vaultTokenConfigured,
      vaultKvMountConfigured: summary.vaultKvMountConfigured,
      pathAllowlistPrefixCount: summary.pathAllowlistPrefixCount,
      testSecretPathConfigured: summary.testSecretPathConfigured,
      testSecretKeyConfigured: summary.testSecretKeyConfigured,
      testSecretPathAllowlisted: summary.testSecretPathAllowlisted,
      testSecretPathLooksTestOnly: summary.testSecretPathLooksTestOnly,
      envValuesReturned: false,
      rawPathReturned: false
    }),
    operationPolicy: sanitizeDashboardObject({
      noWrite: summary.noWrite,
      noDelete: summary.noDelete,
      noRotate: summary.noRotate,
      noBroadList: summary.noBroadList,
      cleanupRequired: false,
      liveVaultCallInDashboard: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed,
      vaultTokenExposed: summary.vaultTokenExposed,
      vaultAddressExposed: summary.vaultAddressExposed,
      vaultSecretValueExposed: summary.vaultSecretValueExposed,
      vaultCallsInDefaultTests: summary.vaultCallsInDefaultTests,
      credentialCachesRead: false
    })
  };
}

function buildStaging(context: DashboardReadModelContext): StagingDeploymentReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getStagingDeploymentSummary();
  const checks = readiness.listStagingReadinessChecks();
  return {
    summary: sanitizeDashboardObject(summary),
    profile: sanitizeDashboardObject(readiness.getStagingDeploymentProfile()),
    integrationGates: sanitizeDashboardArray(readiness.listStagingIntegrationGates()),
    readinessChecks: sanitizeDashboardArray(checks),
    promotionCriteria: sanitizeDashboardArray(readiness.listStagingPromotionCriteria()),
    rollbackCriteria: sanitizeDashboardArray(readiness.listStagingRollbackCriteria()),
    blockers: sanitizeDashboardArray(checks.filter((check) => check.status === "fail")),
    warnings: sanitizeDashboardArray(checks.filter((check) => check.status === "warning")),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed,
      deploymentExecuted: summary.deploymentExecuted,
      externalCallsEnabled: summary.externalCallsEnabled,
      productionTrafficAllowed: summary.productionTrafficAllowed,
      stagingDeployed: summary.stagingDeployed
    })
  };
}

function buildStagingDryRun(context: DashboardReadModelContext): StagingDeploymentDryRunReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getStagingDeploymentDryRunSummary();
  const report = readiness.generateStagingDeploymentDryRunReport();
  const sources = readiness.listStagingDeploymentDryRunSources();
  const checks = readiness.listStagingDeploymentDryRunChecks();
  const blockers = readiness.listStagingDeploymentDryRunBlockers();
  const requiredSourceKinds = new Set(report.profile.requiredReadinessSources);
  const optionalSourceKinds = new Set(report.profile.optionalReadinessSources);
  return {
    summary: sanitizeDashboardObject(summary),
    profile: sanitizeDashboardObject(report.profile),
    sources: sanitizeDashboardArray(sources),
    requiredSources: sanitizeDashboardArray(sources.filter((source) => requiredSourceKinds.has(source.sourceKind))),
    optionalSources: sanitizeDashboardArray(sources.filter((source) => optionalSourceKinds.has(source.sourceKind))),
    checks: sanitizeDashboardArray(checks),
    requiredChecks: sanitizeDashboardArray(checks.filter((check) => check.requiredForStaging)),
    blockers: sanitizeDashboardArray(blockers),
    criticalBlockers: sanitizeDashboardArray(blockers.filter((blocker) => blocker.severity === "critical" && blocker.status === "open")),
    warnings: sanitizeDashboardArray([
      ...sources.filter((source) => source.status === "warning" || source.status === "skipped"),
      ...checks.filter((check) => check.status === "warning" || check.status === "skipped" || check.status === "not_checked")
    ]),
    skippedIntegrationProfiles: sanitizeDashboardArray(report.integrationProfiles.filter((profile) => profile.status === "skipped")),
    integrationProfiles: sanitizeDashboardArray(report.integrationProfiles),
    recommendedNextActions: report.recommendedNextActions,
    promotionGuidance: report.promotionGuidance,
    rollbackGuidance: report.rollbackGuidance,
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed,
      deploymentExecuted: summary.deploymentExecuted,
      externalCallsEnabled: summary.externalCallsEnabled,
      remoteIntegrationTestsExecuted: summary.remoteIntegrationTestsExecuted,
      validationCommandsExecuted: summary.validationCommandsExecuted,
      productionReady: summary.productionReady,
      stagingDeployed: summary.stagingDeployed
    })
  };
}

function buildStagingReleaseCandidate(context: DashboardReadModelContext): StagingReleaseCandidateReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getStagingReleaseCandidateSummary();
  const report = readiness.generateStagingReleaseCandidateReport();
  const gates = readiness.listStagingReleaseCandidateGates();
  const blockers = readiness.listStagingReleaseCandidateBlockers();
  const signoffs = readiness.listStagingReleaseCandidateSignoffs();
  const releaseNoteRequirements = readiness.listStagingReleaseNoteRequirements();
  const rollbackChecklist = readiness.listStagingRollbackChecklist();
  return {
    summary: sanitizeDashboardObject(summary),
    checklist: sanitizeDashboardObject(report.checklist),
    gates: sanitizeDashboardArray(gates),
    requiredGates: sanitizeDashboardArray(gates.filter((gate) => gate.required)),
    blockers: sanitizeDashboardArray(blockers),
    criticalBlockers: sanitizeDashboardArray(blockers.filter((blocker) => blocker.status === "open" && blocker.severity === "critical")),
    signoffs: sanitizeDashboardArray(signoffs),
    pendingSignoffs: sanitizeDashboardArray(signoffs.filter((signoff) => signoff.required && signoff.status === "pending")),
    releaseNoteRequirements: sanitizeDashboardArray(releaseNoteRequirements),
    missingReleaseNoteRequirements: sanitizeDashboardArray(releaseNoteRequirements.filter((requirement) => requirement.required && requirement.status === "missing")),
    rollbackChecklist: sanitizeDashboardArray(rollbackChecklist),
    missingRollbackItems: sanitizeDashboardArray(rollbackChecklist.filter((item) => item.required && item.status === "missing")),
    skippedTests: report.skippedTests,
    recommendedNextActions: report.recommendedNextActions,
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed,
      releaseCreated: summary.releaseCreated,
      gitTagCreated: summary.gitTagCreated,
      githubReleaseCreated: summary.githubReleaseCreated,
      deploymentExecuted: summary.deploymentExecuted,
      externalCallsEnabled: summary.externalCallsEnabled,
      remoteIntegrationTestsExecuted: summary.remoteIntegrationTestsExecuted,
      productionReady: summary.productionReady,
      stagingDeployed: summary.stagingDeployed
    })
  };
}

function buildStagingExecution(context: DashboardReadModelContext): StagingDeploymentExecutionReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getStagingDeploymentExecutionSummary();
  const plan = readiness.getStagingDeploymentExecutionPlan();
  const steps = readiness.listStagingDeploymentExecutionSteps();
  const gates = readiness.listStagingDeploymentExecutionGates();
  const decision = readiness.getStagingDeploymentGoNoGoDecision();
  const rollback = readiness.getStagingDeploymentRollbackPlan();
  return {
    summary: sanitizeDashboardObject(summary),
    plan: sanitizeDashboardObject(plan),
    steps: sanitizeDashboardArray(steps),
    gates: sanitizeDashboardArray(gates),
    requiredGates: sanitizeDashboardArray(gates.filter((gate) => gate.required)),
    blockers: sanitizeDashboardArray(gates.filter((gate) => gate.required && (gate.status === "fail" || gate.status === "not_checked"))),
    warnings: sanitizeDashboardArray(gates.filter((gate) => gate.status === "warning" || gate.status === "skipped")),
    goNoGoDecision: sanitizeDashboardObject(decision),
    signoffPack: sanitizeDashboardObject({
      available: summary.signoffPackAvailable,
      status: summary.signoffStatus,
      requiredRoleCount: summary.requiredSignoffCount,
      pendingRoleCount: summary.pendingSignoffCount,
      approvedRoleCount: summary.approvedSignoffCount,
      conditionalRoleCount: summary.conditionalSignoffCount,
      rejectedRoleCount: summary.rejectedSignoffCount,
      missingRequiredRoleCount: summary.missingRequiredSignoffCount,
      actualDeploymentBlocked: summary.actualDeploymentBlocked,
      evidenceChecklistStatus: summary.metadata.signoffEvidenceChecklistStatus ?? "present_pending_review",
      decisionPolicyStatus: summary.metadata.signoffDecisionPolicyStatus ?? "evaluated_pending_required_signoffs",
      approvalAuditRequired: summary.metadata.approvalAuditRequired ?? true,
      docs: "docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md",
      evidenceChecklistDocs: "docs/roadmaps/staging-deployment-execution/signoff-evidence-checklist-v0.md",
      decisionPolicyDocs: "docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md"
    }),
    pendingSignoffs: sanitizeDashboardArray(decision.pendingApprovals.map((role) => ({ role, status: "pending" }))),
    optionalIntegrationDecisions: sanitizeDashboardArray(gates.filter((gate) => !gate.required && ["github_app", "webhook", "llm", "vault", "mcp"].includes(gate.category))),
    rollbackPlan: sanitizeDashboardObject(rollback),
    rollbackSteps: sanitizeDashboardArray(rollback.rollbackSteps),
    recommendedNextActions: Array.isArray(summary.metadata.recommendedNextActions) ? summary.metadata.recommendedNextActions.map(String) : [],
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed,
      deploymentExecuted: summary.deploymentExecuted,
      releaseCreated: summary.releaseCreated,
      gitTagCreated: summary.gitTagCreated,
      externalCallsEnabled: summary.externalCallsEnabled,
      remoteIntegrationTestsExecuted: summary.remoteIntegrationTestsExecuted,
      productionReady: summary.productionReady,
      stagingDeployed: summary.stagingDeployed
    })
  };
}

function buildCicd(context: DashboardReadModelContext): CICDPipelineReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getCicdPipelineReadinessSummary();
  const jobs = readiness.listCicdJobDefinitions();
  const checks = readiness.listCicdReadinessChecks();
  return {
    summary: sanitizeDashboardObject(summary),
    profiles: sanitizeDashboardArray(readiness.listCicdPipelineProfiles()),
    jobs: sanitizeDashboardArray(jobs),
    requiredJobs: sanitizeDashboardArray(jobs.filter((job) => job.required)),
    optionalJobs: sanitizeDashboardArray(jobs.filter((job) => !job.required)),
    safetyJobs: sanitizeDashboardArray(jobs.filter((job) => job.category === "security_scan" || job.category === "secret_scan" || job.category === "dashboard_smoke" || job.category === "readiness_check")),
    integrationGates: sanitizeDashboardArray(readiness.listCicdIntegrationTestGates()),
    readinessChecks: sanitizeDashboardArray(checks),
    risks: sanitizeDashboardArray(readiness.listCicdRisks()),
    blockers: sanitizeDashboardArray(checks.filter((check) => check.status === "fail")),
    stagingPromotion: sanitizeDashboardObject({
      ready: summary.stagingPromotionReady,
      productionReady: summary.productionReady,
      stagingDeployed: summary.stagingDeployed,
      requiredValidationCommandsCount: summary.requiredJobCount,
      remoteIntegrationTestsEnabledByDefault: summary.remoteIntegrationTestsEnabledByDefault
    }),
    artifactPolicy: sanitizeDashboardObject({
      status: summary.artifactPolicyStatus,
      rawSecretArtifactsAllowed: false,
      rawPromptArtifactsAllowed: false,
      rawProviderOutputArtifactsAllowed: false,
      rawWebhookPayloadArtifactsAllowed: false
    }),
    cleanupRollback: sanitizeDashboardObject({
      status: summary.cleanupRollbackStatus,
      cleanupJobsImplemented: false,
      remoteCleanupCallsEnabled: false,
      rollbackAutomationImplemented: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: !summary.secretsExposed,
      envValuesExposed: summary.envValuesExposed,
      externalCallsEnabledByDefault: summary.externalCallsEnabledByDefault,
      activeWorkflowCreated: summary.activeWorkflowCreated,
      deploymentWorkflowCreated: summary.deploymentWorkflowCreated
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
    routes: sanitizeDashboardArray(context.llmGatewayService.listRoutes()),
    routing: sanitizeDashboardObject(context.llmGatewayService.getRoutingConfig()),
    providerHealth: sanitizeDashboardArray(context.llmGatewayService.listProviderHealth()),
    fallbackPolicies: sanitizeDashboardArray(context.llmGatewayService.listFallbackPolicies()),
    routingDecisions: sanitizeDashboardArray(context.llmGatewayService.listRoutingDecisions()),
    fallbackAttempts: sanitizeDashboardArray(context.llmGatewayService.listRoutingDecisions().filter((decision) => typeof decision.metadata.fallback_attempt === "number" && decision.metadata.fallback_attempt > 0)),
    models: sanitizeDashboardArray(context.llmGatewayService.listModels()),
    virtualKeys: sanitizeDashboardArray(context.llmGatewayService.listVirtualKeys()),
    usageEvents: sanitizeDashboardArray(context.llmGatewayService.listUsageEvents()),
    auditEvents: sanitizeDashboardArray(context.llmGatewayService.listAuditEvents()),
    blockedExamples: sanitizeDashboardArray([
      {
        operation: "remote_llm_completion",
        reason: config.remoteLlmEnabled
          ? config.remoteCompletionEnabled
            ? "requires_policy_budget_credentials_and_allowlisted_model"
            : "remote_llm_completion_disabled"
          : "blocked_remote_llm_disabled"
      },
      {
        operation: "provider_api_key_exposure",
        reason: "provider_credentials_never_returned"
      },
      {
        operation: "local_cli_route",
        reason: "local_agent_required_not_direct_execution"
      }
    ]),
    budget: sanitizeDashboardObject({
      budgetChecksEnabled: true,
      usageLedgerLinked: true,
      remoteProviderPath: "openai_compatible",
      selectedModel: config.defaultModel ?? "openai-compatible/default",
      allowedModels: config.allowedModels,
      apiKeyConfigured: config.apiKeyConfigured,
      credentialSource: config.credentialSource,
      credentialStatus: config.credentialStatus,
      envSecretProviderEnabled: config.envSecretProviderEnabled,
      apiKeyExposed: false,
      integrationTestsEnabled: config.integrationTestsEnabled
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

function buildPolicyBundles(context: DashboardReadModelContext): PolicyBundleReadinessReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getPolicyBundleReadinessSummary();
  const checks = readiness.listPolicyBundleReadinessChecks();
  const risks = readiness.listPolicyBundleRisks();
  const engineOptions = readiness.listPolicyEngineOptions();
  const recommended = engineOptions.find((option) => option.status === "recommended") ?? engineOptions.find((option) => option.productionRecommended);
  return {
    summary: sanitizeDashboardObject(summary),
    engineOptions: sanitizeDashboardArray(engineOptions),
    bundlePlans: sanitizeDashboardArray(readiness.listPolicyBundlePlans()),
    domainMappings: sanitizeDashboardArray(readiness.listPolicyDomainMappings()),
    readinessChecks: sanitizeDashboardArray(checks),
    risks: sanitizeDashboardArray(risks),
    migrationPhases: sanitizeDashboardArray(readiness.listPolicyBundleMigrationPhases()),
    blockers: sanitizeDashboardArray(checks.filter((check) => check.status === "fail")),
    recommendedPath: sanitizeDashboardObject({
      engineKind: recommended?.engineKind ?? "signed_json_yaml_bundle",
      displayName: recommended?.displayName ?? "Signed JSON/YAML Policy Bundle",
      status: recommended?.status ?? "recommended",
      runtimeImplemented: false,
      reason: "near_term_schema_driven_bundle_before_real_opa_or_cedar_runtime"
    }),
    reviewWorkflow: sanitizeDashboardObject({
      status: summary.reviewWorkflowStatus,
      requiredRoles: ["policy_author", "domain_owner", "security_approver"],
      workflowEngineImplemented: false,
      auditEventsPlanned: ["policy_bundle_review_requested_future", "policy_bundle_approved_future", "policy_bundle_rejected_future"]
    }),
    testStrategy: sanitizeDashboardObject({
      status: summary.testStrategyStatus,
      requiredSuites: ["golden_decisions", "deny_by_default_regression", "secret_exposure", "tenant_isolation", "provider_specific"],
      bundleTestRunnerImplemented: false
    }),
    rolloutRollback: sanitizeDashboardObject({
      rolloutStatus: summary.rolloutStatus,
      rollbackStatus: summary.rollbackStatus,
      shadowEvaluationImplemented: false,
      runtimeActivationImplemented: false
    }),
    breakGlass: sanitizeDashboardObject({
      status: summary.breakGlassStatus,
      implemented: false,
      canReadRawSecrets: false,
      canEnableDestructiveGit: false,
      requiresPostIncidentReview: true
    }),
    noExecutionStatus: sanitizeDashboardObject({
      dynamicPolicyExecutionEnabled: summary.dynamicPolicyExecutionEnabled,
      externalPolicyEngineEnabled: summary.externalPolicyEngineEnabled,
      policyCodeExecuted: summary.policyCodeExecuted,
      remotePolicyLoadingEnabled: summary.remotePolicyLoadingEnabled,
      opaIntegrationEnabled: summary.opaIntegrationEnabled,
      cedarIntegrationEnabled: summary.cedarIntegrationEnabled,
      noSecretsExposed: summary.noSecretsExposed,
      runtimeChanged: summary.policyRuntimeChanged
    })
  };
}

function buildPolicyShadow(context: DashboardReadModelContext): PolicyShadowEvaluationReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getPolicyShadowEvaluationSummary();
  const plan = readiness.getPolicyShadowEvaluationPlan();
  const mismatches = readiness.listPolicyShadowMismatches();
  return {
    summary: sanitizeDashboardObject(summary),
    plan: sanitizeDashboardObject(plan),
    comparisonRules: sanitizeDashboardArray(readiness.listPolicyShadowComparisonRules()),
    mismatchTaxonomy: sanitizeDashboardArray(mismatches),
    readinessChecks: sanitizeDashboardArray(readiness.listPolicyShadowReadinessChecks()),
    reports: sanitizeDashboardArray(readiness.listPolicyShadowEvaluationReports()),
    criticalMismatchExamples: sanitizeDashboardArray(mismatches.filter((mismatch) => mismatch.severity === "critical")),
    rollout: sanitizeDashboardObject({
      currentStage: plan.rolloutStages[0] ?? "docs_planning",
      rolloutStages: plan.rolloutStages,
      liveShadowEvaluationEnabled: false,
      alertingOnCriticalMismatchEnabled: false,
      selectedNonCriticalEnforcementEnabled: false,
      productionEnforcementEnabled: false,
      rollbackActions: ["disable_shadow_evaluator_future", "fall_back_to_StaticPolicyEngine", "invalidate_candidate_bundle_future", "record_audit_event_future"]
    }),
    noExecutionStatus: sanitizeDashboardObject({
      sourceOfTruth: summary.sourceOfTruth,
      enforcementMode: summary.enforcementMode,
      enforcementChanged: summary.enforcementChanged,
      staticPolicyEngineAuthoritative: summary.staticPolicyEngineAuthoritative,
      shadowEvaluatorImplemented: summary.shadowEvaluatorImplemented,
      candidateRuntimeImplemented: summary.candidateRuntimeImplemented,
      candidateRuntimeExecuted: summary.candidateRuntimeExecuted,
      dynamicPolicyExecutionEnabled: summary.dynamicPolicyExecutionEnabled,
      externalPolicyServiceCallsEnabled: summary.externalPolicyServiceCallsEnabled,
      remotePolicyBundleLoadingEnabled: summary.remotePolicyBundleLoadingEnabled,
      signedBundleVerificationRuntimeEnabled: summary.signedBundleVerificationRuntimeEnabled,
      opaRuntimeEnabled: summary.opaRuntimeEnabled,
      cedarRuntimeEnabled: summary.cedarRuntimeEnabled,
      policyCodeExecuted: summary.policyCodeExecuted,
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed
    })
  };
}

function buildAuth(context: DashboardReadModelContext): AuthReadModel {
  const currentContext = context.authorizationService.getAuthContext({
    source: "dashboard",
    metadata: { readModel: true }
  });
  const dashboardDecision = context.authorizationService.hasPermission(currentContext, "dashboard.read", {
    resourceKind: "dashboard",
    resourceId: "dashboard_api_read_model",
    metadata: { readOnly: true }
  });
  const mergeDecision = context.authorizationService.hasPermission(currentContext, "git.merge", {
    resourceKind: "git_operation",
    resourceId: "merge_future",
    metadata: { destructiveOperation: true }
  });

  return {
    config: sanitizeDashboardObject(context.authorizationService.getConfig()),
    currentActor: sanitizeDashboardObject({
      actor: currentContext.actor,
      principal: currentContext.principal,
      authMode: currentContext.authMode,
      authenticated: currentContext.authenticated,
      roles: currentContext.roles.map((role) => role.name),
      teams: currentContext.teams.map((team) => team.name),
      isMockActor: currentContext.metadata.isMockActor === true,
      productionAuthEnabled: false
    }),
    principals: sanitizeDashboardArray(context.authorizationService.listPrincipals()),
    actors: sanitizeDashboardArray(context.authorizationService.listActors()),
    teams: sanitizeDashboardArray(context.authorizationService.listTeams()),
    roles: sanitizeDashboardArray(context.authorizationService.listRoles()),
    permissions: sanitizeDashboardArray(context.authorizationService.listPermissions()),
    roleBindings: sanitizeDashboardArray(context.authorizationService.listRoleBindings()),
    serviceAccounts: sanitizeDashboardArray(context.authorizationService.listServiceAccounts()),
    identityProviders: sanitizeDashboardArray(context.authorizationService.listIdentityProviders()),
    auditEvents: sanitizeDashboardArray(context.authorizationService.listAuditEvents().slice(0, 20)),
    authorizationExamples: sanitizeDashboardArray([
      {
        action: "dashboard.read",
        allowed: dashboardDecision.allowed,
        reason: dashboardDecision.reason
      },
      {
        action: "git.merge",
        allowed: mergeDecision.allowed,
        reason: mergeDecision.reason,
        policyDecisionId: mergeDecision.policyDecision?.id
      }
    ]),
    warning: "Mock auth is visible for planning only and is not production authentication."
  };
}

function buildAuthProduction(context: DashboardReadModelContext): AuthRbacProductionReadinessReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getAuthRbacProductionSummary();
  const checks = readiness.listAuthRbacReadinessChecks();
  const risks = readiness.listAuthRbacProductionRisks();
  return {
    summary: sanitizeDashboardObject(summary),
    providerOptions: sanitizeDashboardArray(readiness.listAuthProviderOptions()),
    migrationPhases: sanitizeDashboardArray(readiness.listAuthRbacMigrationPhases()),
    readinessChecks: sanitizeDashboardArray(checks),
    risks: sanitizeDashboardArray(risks),
    tenantBoundaryPlans: sanitizeDashboardArray(readiness.listTenantBoundaryPlans()),
    serviceAccountPlans: sanitizeDashboardArray(readiness.listServiceAccountPlans()),
    permissionMatrix: sanitizeDashboardArray(readiness.listProductionRbacPermissionMatrix()),
    blockers: sanitizeDashboardArray(checks.filter((check) => check.status === "fail")),
    mockActorStatus: sanitizeDashboardObject({
      enabled: summary.mockActorEnabled,
      warning: summary.mockActorWarning,
      productionReady: false,
      headerActorOverrideProductionReady: summary.mockHeaderOverrideProductionReady
    }),
    noTokenStatus: sanitizeDashboardObject({
      noTokensExposed: summary.noTokensExposed,
      cookiesExposed: summary.cookiesExposed,
      sessionIdsExposed: summary.sessionIdsExposed,
      passwordsExposed: summary.passwordsExposed,
      rawIdentityAssertionsExposed: summary.rawIdentityAssertionsExposed,
      externalIdpCallsEnabled: summary.externalIdpCallsEnabled,
      realSessionsImplemented: summary.realSessionsImplemented,
      realJwtIssuanceImplemented: summary.realJwtIssuanceImplemented
    })
  };
}

function buildAuthProviders(context: DashboardReadModelContext): ProductionAuthProviderSkeletonReadModel {
  const readiness = context.deploymentReadinessService;
  const summary = readiness.getProductionAuthProviderSkeletonSummary();
  const configs = readiness.listProductionAuthProviderConfigs();
  const checks = readiness.listProductionAuthProviderReadiness();
  const selectedProvider = configs.find((config) => config.providerKind === summary.selectedProviderKind) ?? configs[0];
  return {
    summary: sanitizeDashboardObject(summary),
    configs: sanitizeDashboardArray(configs),
    readiness: sanitizeDashboardArray(checks),
    sessionBoundary: sanitizeDashboardArray(readiness.listSessionTokenBoundaryPlans()),
    identityMapping: sanitizeDashboardArray(readiness.listIdentityMappingPlans()),
    selectedProvider: sanitizeDashboardObject(selectedProvider),
    blockers: sanitizeDashboardArray(checks.flatMap((check) => check.blockers.map((blocker) => ({
      providerKind: check.providerKind,
      blocker
    })))),
    noTokenStatus: sanitizeDashboardObject({
      noTokensExposed: summary.noTokensExposed,
      authorizationHeadersStored: summary.authorizationHeadersStored,
      cookiesStored: summary.cookiesStored,
      sessionIdsExposed: summary.sessionIdsExposed,
      envValuesExposed: summary.envValuesExposed,
      secretsExposed: summary.secretsExposed,
      tokenValidationEnabled: summary.tokenValidationEnabled,
      sessionBoundaryEnabled: summary.sessionBoundaryEnabled,
      externalCallsEnabled: summary.externalCallsEnabled
    })
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
  const credentialAuditEvents = context.securityService.listAuditEvents({ targetKind: "secret" })
    .filter((event) => event.eventType.startsWith("credential_"));
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
    credentialAuditEvents: sanitizeDashboardArray(credentialAuditEvents),
    credentialStatus: sanitizeDashboardObject({
      credentialManagerKind: context.securityService.getConfig().credentialManagerKind,
      envSecretProviderEnabled: context.securityService.getConfig().envSecretProviderEnabled,
      github: context.securityService.getConfig().githubCredentialConfigured ? "configured" : "missing",
      githubWebhookSecret: context.securityService.getConfig().githubWebhookSecretConfigured ? "configured" : "missing",
      llm: context.securityService.getConfig().llmCredentialConfigured ? "configured" : "missing",
      rawValuesExposed: false
    }),
    blockedExamples: sanitizeDashboardArray([
      { operation: "secret.lease.issue", reason: "no_secret_lease_issued_by_default" },
      { operation: "network.egress", reason: "network_default_deny" },
      { operation: "local_agent.secret.forward", reason: "secret_forwarding_denied" },
      { operation: "credential_cache_path", reason: "credential cache paths redacted" },
      { operation: "env_secret_provider", reason: context.securityService.getConfig().envSecretProviderEnabled ? "requires_secret_ref_policy_and_allowlist" : "env_secret_provider_disabled" }
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

function buildMcp(context: DashboardReadModelContext): MCPGatewayReadModel {
  const servers = context.mcpGatewayService.listServers();
  const tools = servers.items.flatMap((server) => context.mcpGatewayService.listTools(server.id).items);
  const invocations = context.mcpGatewayService.listInvocations();
  const auditEvents = context.mcpGatewayService.listAuditEvents();
  const activeTools = tools.filter((tool) => tool.status === "active");
  return {
    config: sanitizeDashboardObject(context.mcpGatewayService.getConfig()),
    servers: sanitizeDashboardArray(servers.items),
    tools: sanitizeDashboardArray(tools),
    riskSummary: sanitizeDashboardObject({
      low: tools.filter((tool) => tool.riskLevel === "low").length,
      medium: tools.filter((tool) => tool.riskLevel === "medium").length,
      high: tools.filter((tool) => tool.riskLevel === "high").length,
      critical: tools.filter((tool) => tool.riskLevel === "critical").length,
      active: activeTools.length,
      disabled: tools.filter((tool) => tool.status === "disabled").length,
      highCriticalEnabled: activeTools.filter((tool) => tool.riskLevel === "high" || tool.riskLevel === "critical").length
    }),
    invocations: sanitizeDashboardArray(invocations.slice(0, 20)),
    auditEvents: sanitizeDashboardArray(auditEvents.slice(0, 20)),
    blockedExamples: sanitizeDashboardArray([
      { operation: "mcp.real_transport", reason: "real_mcp_transport_disabled" },
      { operation: "mcp.tool.invoke.high_risk", reason: "high_risk_tool_denied_by_default" },
      { operation: "mcp.tool.invoke.critical", reason: "critical_tool_denied_by_default" },
      { operation: "mcp.tool.secret.resolve", reason: "secret_forwarding_disabled_v0" },
      { operation: "mcp.tool.network_access", reason: "network_access_denied_by_default" },
      { operation: "mcp.tool.write", reason: "write_tools_disabled_v0" },
      { operation: "mcp.tool.deploy", reason: "deploy_tools_disabled_v0" }
    ]),
    integration: sanitizeDashboardObject({
      llmAutoToolExecution: false,
      runnerDirectToolExecution: false,
      localAgentMcpTransport: "future_placeholder_disabled",
      mockGatewayDefault: context.mcpGatewayService.getGatewayKind() === "mock",
      rawOutputStored: false,
      secretsExposed: false,
      tokensExposed: false
    })
  };
}

function buildScopes(context: DashboardReadModelContext): ScopeReadinessReadModel {
  const catalog = listMockScopeCatalog();
  const enforcementSummary = context.tenantScopeEnforcementService.getSummary();
  const scopeDecision = context.tenantScopeEnforcementService.evaluateDashboardPanelAccess(
    undefined,
    context.tenantScopePlanningService.getDashboardPanelScopeSummary("scope_model") ?? { panelId: "scope_model", requiredScopes: ["tenant", "team", "project", "audit_query"], redactionClass: "sensitive_metadata" },
    { source: "dashboard:scope_model" }
  );
  return {
    summary: sanitizeDashboardObject(scopeSummary(catalog)),
    tenants: sanitizeDashboardArray(catalog.tenants),
    teams: sanitizeDashboardArray(catalog.teams),
    projects: sanitizeDashboardArray(catalog.projects),
    repos: sanitizeDashboardArray(catalog.repos),
    providers: sanitizeDashboardArray(catalog.providers),
    models: sanitizeDashboardArray(catalog.models),
    secrets: sanitizeDashboardArray(catalog.secrets),
    mcpTools: sanitizeDashboardArray(catalog.mcpTools),
    registryPackages: sanitizeDashboardArray(catalog.registryPackages),
    localAgentHosts: sanitizeDashboardArray(catalog.localAgentHosts),
    auditQueries: sanitizeDashboardArray(catalog.auditQueries),
    enforcement: sanitizeDashboardObject({
      status: "v1_implemented_partial",
      planningStatus: "planning_model_only",
      enforcementMode: scopeDecision.enforcementMode,
      scopeDecisionSummary: context.tenantScopeEnforcementService.summarizeDecision(scopeDecision),
      tenantScopeEnforcementImplemented: "partial",
      representativeEnforcementOnly: enforcementSummary.representativeEnforcementOnly,
      productionTenantEnforcement: false,
      tenantFilteringImplemented: false,
      tenantFilteringStatus: "future",
      dashboardFilteringStatus: "future",
      externalScopeLookupEnabled: false
    }),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: true,
      envValuesExposed: false,
      rawCredentialsExposed: false
    })
  };
}

function buildTenantScopePlanning(context: DashboardReadModelContext): DashboardTenantScopePlanningReadModel {
  const planning = context.tenantScopePlanningService;
  const summary = planning.getSummary();
  const enforcement = context.tenantScopeEnforcementService.getSummary();
  return {
    scopeMetadata: dashboardScopeMetadata(context, "tenant_scope_planning"),
    summary: sanitizeDashboardObject(summary),
    dashboardPlans: sanitizeDashboardArray(planning.listDashboardPlans()),
    readinessPlans: sanitizeDashboardArray(planning.listReadinessPlans()),
    panelScopeSummaries: sanitizeDashboardArray(planning.listDashboardPanelScopeSummaries()) as unknown as DashboardPanelScopeSummary[],
    readinessScopeSummaries: sanitizeDashboardArray(planning.listReadinessEndpointScopeSummaries()) as unknown as ReadinessEndpointScopeSummary[],
    enforcementSummary: sanitizeDashboardObject(enforcement),
    enforcementModes: sanitizeDashboardArray(context.tenantScopeEnforcementService.listModes()),
    enforcementMismatches: sanitizeDashboardArray(context.tenantScopeEnforcementService.listMismatches()),
    roleVisibility: sanitizeDashboardArray(planning.getRoleVisibilityMatrix()),
    fallbackBehavior: sanitizeDashboardArray(planning.getFallbackBehavior()),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed,
      tenantFilteringImplemented: summary.tenantFilteringImplemented,
      productionTenantEnforcement: summary.productionTenantEnforcement,
      productionReady: summary.productionReady
    })
  };
}

function buildTenantScopeEnforcement(context: DashboardReadModelContext): TenantScopeEnforcementReadModel {
  const summary = context.tenantScopeEnforcementService.getSummary();
  return {
    summary: sanitizeDashboardObject(summary),
    modes: sanitizeDashboardArray(context.tenantScopeEnforcementService.listModes()),
    mismatches: sanitizeDashboardArray(context.tenantScopeEnforcementService.listMismatches()),
    noSecretStatus: sanitizeDashboardObject({
      noSecretsExposed: summary.noSecretsExposed,
      envValuesExposed: summary.envValuesExposed,
      tenantFilteringImplemented: summary.tenantFilteringImplemented,
      productionTenantEnforcement: summary.productionTenantEnforcement,
      productionAuthImplemented: summary.productionAuthImplemented,
      rowLevelSecurityImplemented: summary.rowLevelSecurityImplemented
    })
  };
}

function buildReadiness(context: DashboardReadModelContext): DeploymentReadinessReadModel {
  const summary = context.deploymentReadinessService.getSummary();
  const checks = context.deploymentReadinessService.listChecks();
  const risks = context.deploymentReadinessService.listRisks();
  return {
    summary: sanitizeDashboardObject(summary),
    profiles: sanitizeDashboardArray(context.deploymentReadinessService.listProfiles()),
    checks: sanitizeDashboardArray(checks),
    risks: sanitizeDashboardArray(risks),
    productionBlockers: sanitizeDashboardArray(summary.criticalBlockers),
    environmentWarnings: summary.environmentWarnings,
    missingProductionRequirements: summary.missingProductionRequirements,
    noSecretsExposed: true
  };
}

function buildObservability(context: DashboardReadModelContext): ObservabilityReadModel {
  const observability = context.observabilityService.buildDashboardObservabilityReadModel();
  return {
    config: sanitizeDashboardObject(observability.config),
    auditSummary: sanitizeDashboardObject(observability.auditSummary),
    recentEvents: sanitizeDashboardArray(observability.recentEvents),
    recentSecurityEvents: sanitizeDashboardArray(observability.recentSecurityEvents),
    deniedOrBlockedEvents: sanitizeDashboardArray(observability.deniedOrBlockedEvents),
    retentionClasses: sanitizeDashboardArray(observability.retentionClasses),
    redactionClasses: sanitizeDashboardArray(observability.redactionClasses),
    retentionPolicies: sanitizeDashboardArray(observability.retentionPolicies),
    metricDefinitions: sanitizeDashboardArray(observability.metricDefinitions),
    metricSnapshot: sanitizeDashboardObject(observability.metricSnapshot),
    traceSpans: sanitizeDashboardArray(observability.traceSpans),
    traceSummary: sanitizeDashboardObject(observability.traceSummary),
    sourceCoverage: sanitizeDashboardArray(observability.sourceCoverage),
    productionReadinessBlockers: sanitizeDashboardArray(observability.productionReadinessBlockers),
    noSecretStatus: sanitizeDashboardObject(observability.noSecretStatus)
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
    auditGroup("auth", context.authorizationService.listAuditEvents()),
    auditGroup("security", context.securityService.listAuditEvents()),
    auditGroup("mcp", context.mcpGatewayService.listAuditEvents()),
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
  githubApp: GitHubAppHardeningReadModel,
  githubAppIntegration: GitHubAppIntegrationTestReadModel,
  conflicts: ConflictManagerReadModel,
  registry: RegistryReadModel,
  llm: LLMGatewayReadModel,
  llmIntegration: LLMIntegrationTestReadModel,
  vaultIntegration: VaultIntegrationTestReadModel,
  agents: AgentRunnerReadModel,
  policy: PolicyReadModel,
  policyBundles: PolicyBundleReadinessReadModel,
  policyShadow: PolicyShadowEvaluationReadModel,
  auth: AuthReadModel,
  authProduction: AuthRbacProductionReadinessReadModel,
  authProviders: ProductionAuthProviderSkeletonReadModel,
  providers: EnterpriseProviderReadModel,
  security: SecurityReadModel,
  localAgents: LocalAgentReadModel,
  mcp: MCPGatewayReadModel,
  scopes: ScopeReadinessReadModel,
  tenantScopePlanning: DashboardTenantScopePlanningReadModel,
  tenantScopeEnforcement: TenantScopeEnforcementReadModel,
  readiness: DeploymentReadinessReadModel,
  database: DatabaseOperationsReadModel,
  secretBackend: SecretBackendMigrationReadModel,
  secretBackendDecision: SecretBackendDecisionReadModel,
  vaultSecretBackend: VaultSecretBackendReadModel,
  staging: StagingDeploymentReadModel,
  stagingDryRun: StagingDeploymentDryRunReadModel,
  stagingReleaseCandidate: StagingReleaseCandidateReadModel,
  stagingExecution: StagingDeploymentExecutionReadModel,
  cicd: CICDPipelineReadModel,
  observability: ObservabilityReadModel,
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
      githubAppReadinessBlockers: githubApp.blockers.length,
      githubAppPermissions: githubApp.permissionMatrix.length,
      githubWebhookAllowlistedEvents: githubApp.webhookEventAllowlist.length,
      githubAppIntegrationMissingGates: githubAppIntegration.summary.missingGateCount ?? 0,
      githubAppIntegrationUnsafeGates: githubAppIntegration.summary.unsafeGateCount ?? 0,
      githubAppIntegrationTestCases: githubAppIntegration.testCases.length,
      llmModels: llm.models.length,
      llmUsageEvents: llm.usageEvents.length,
      llmIntegrationMissingGates: llmIntegration.summary.missingGateCount ?? 0,
      llmIntegrationUnsafeGates: llmIntegration.summary.unsafeGateCount ?? 0,
      llmIntegrationTestCases: llmIntegration.testCases.length,
      vaultIntegrationMissingGates: vaultIntegration.summary.missingGateCount ?? 0,
      vaultIntegrationUnsafeGates: vaultIntegration.summary.unsafeGateCount ?? 0,
      vaultIntegrationTestCases: vaultIntegration.testCases.length,
      agentRuns: agents.runs.length,
      policyRules: policy.rules.length,
      policyBundleReadinessBlockers: policyBundles.blockers.length,
      policyBundleDomainsMapped: policyBundles.domainMappings.filter((mapping) => mapping.migrationStatus === "mapped").length,
      policyEngineOptions: policyBundles.engineOptions.length,
      policyShadowComparisonRules: policyShadow.comparisonRules.length,
      policyShadowMismatchKinds: policyShadow.mismatchTaxonomy.length,
      policyShadowCriticalMismatchKinds: policyShadow.criticalMismatchExamples.length,
      authRoles: auth.roles.length,
      authActors: auth.actors.length,
      authProductionReadinessBlockers: authProduction.blockers.length,
      authProviderOptions: authProduction.providerOptions.length,
      productionAuthProviderConfigs: authProviders.configs.length,
      productionAuthProviderBlockers: authProviders.blockers.length,
      authServiceAccountPlans: authProduction.serviceAccountPlans.length,
      providerCatalogEntries: providers.catalog.length,
      securityAuditEvents: security.auditEvents.length,
      localAgents: localAgents.registrations.length,
      mcpServers: mcp.servers.length,
      mcpTools: mcp.tools.length,
      scopeTenants: scopes.tenants.length,
      scopeRepos: scopes.repos.length,
      scopeProviders: scopes.providers.length,
      scopeModels: scopes.models.length,
      scopeSecrets: scopes.secrets.length,
      tenantScopePlanningPanels: tenantScopePlanning.dashboardPlans.length,
      tenantScopePlanningReadinessEndpoints: tenantScopePlanning.readinessPlans.length,
      tenantScopePlanningProductionBlockers: tenantScopePlanning.summary.productionBlockerCount ?? 0,
      tenantScopePlanningSecretAdjacentSurfaces: tenantScopePlanning.summary.secretAdjacentSurfaces ?? 0,
      tenantScopeEnforcementModes: tenantScopeEnforcement.modes.length,
      tenantScopeEnforcementMismatches: tenantScopeEnforcement.mismatches.length,
      productionReadinessCriticalBlockers: readiness.summary.criticalBlockerCount ?? 0,
      productionReadinessHighRisks: readiness.summary.highRiskOpenCount ?? 0,
      databaseOperationsCriticalBlockers: database.summary.criticalBlockerCount ?? database.blockers.length,
      databaseMigrationFiles: database.migrations.length,
      databaseIndexReviewItems: database.indexReview.length,
      secretBackendReadinessBlockers: secretBackend.blockers.length,
      secretBackendOptions: secretBackend.backendOptions.length,
      secretRotationPlans: secretBackend.rotationPlans.length,
      secretBackendDecisionCriteria: secretBackendDecision.criteria.length,
      secretBackendDecisionRisks: secretBackendDecision.risks.length,
      vaultSecretBackendChecks: vaultSecretBackend.checks.length,
      vaultSecretBackendAuditEvents: vaultSecretBackend.auditEvents.length,
      stagingReadinessBlockers: staging.blockers.length,
      stagingIntegrationGates: staging.integrationGates.length,
      stagingPromotionCriteria: staging.promotionCriteria.length,
      stagingDryRunBlockers: stagingDryRun.blockers.length,
      stagingDryRunCriticalBlockers: stagingDryRun.criticalBlockers.length,
      stagingDryRunSkippedIntegrations: stagingDryRun.skippedIntegrationProfiles.length,
      stagingRcBlockers: stagingReleaseCandidate.blockers.length,
      stagingRcCriticalBlockers: stagingReleaseCandidate.criticalBlockers.length,
      stagingRcPendingSignoffs: stagingReleaseCandidate.pendingSignoffs.length,
      stagingRcSkippedTests: stagingReleaseCandidate.skippedTests.length,
      stagingExecutionBlockers: stagingExecution.blockers.length,
      stagingExecutionPendingSignoffs: stagingExecution.pendingSignoffs.length,
      stagingExecutionGoNoGoStatus: stagingExecution.goNoGoDecision.status ?? "not_ready",
      cicdReadinessBlockers: cicd.blockers.length,
      cicdJobs: cicd.jobs.length,
      cicdIntegrationGates: cicd.integrationGates.length,
      pendingConsentRequests: localAgents.consentQueue.length,
      normalizedAuditEvents: observability.auditSummary.totalEvents ?? 0,
      auditSourcesCovered: observability.sourceCoverage.filter((source) => source.normalized === "yes").length,
      observabilityTraceSpans: observability.traceSpans.length,
      auditEvents: audit.summary.totalEvents ?? 0
    }),
    sections: {
      tasks: { status: statusForCount(tasks.tasks.length), count: tasks.tasks.length, notes: tasks.warnings },
      git: { status: "available", count: git.repos.length, notes: ["Remote Git gates remain explicit and token-free."] },
      githubApp: { status: "available", count: githubApp.blockers.length, notes: ["GitHub App and production webhook hardening are planning-only; no live App or token exchange is implemented."] },
      githubAppIntegration: { status: "available", count: githubAppIntegration.testCases.length, notes: ["GitHub App integration-test profile v1 is skipped by default and never exposes private keys, installation tokens, or env values."] },
      conflicts: { status: statusForCount(conflicts.mergeQueue.length + conflicts.branchLeases.length), count: conflicts.mergeQueue.length, notes: [] },
      registry: { status: "available", count: registry.skills.length + registry.harnesses.length + registry.instructions.length, notes: [] },
      llm: { status: "available", count: llm.models.length, notes: ["Remote LLM calls require explicit v1 gates and API key remains hidden."] },
      llmIntegration: { status: "available", count: llmIntegration.testCases.length, notes: ["LLM Gateway integration-test profile v1 is skipped by default and never exposes API keys, env values, or raw provider responses."] },
      vaultIntegration: { status: "available", count: vaultIntegration.testCases.length, notes: ["Vault integration-test profile v1 is skipped by default and never exposes Vault tokens, env values, secret paths, or secret values."] },
      agents: { status: "available", count: agents.runs.length, notes: ["Runner command execution remains gated."] },
      policy: { status: "available", count: policy.rules.length, notes: [] },
      policyBundles: { status: "available", count: policyBundles.blockers.length, notes: ["Policy Bundle / OPA-Cedar v0 is planning-only; StaticPolicyEngine remains the runtime and no external policy engine is enabled."] },
      policyShadow: { status: "available", count: policyShadow.mismatchTaxonomy.length, notes: ["Policy Runtime Shadow Evaluation Planning v1 is planning-only; no shadow evaluator or candidate runtime is running."] },
      auth: { status: "available", count: auth.actors.length, notes: ["Mock auth is not production authentication."] },
      authProduction: { status: "available", count: authProduction.blockers.length, notes: ["Production Auth/RBAC v1 is planning-only; no real IdP, sessions, JWTs, cookies, or login flow is implemented."] },
      authProviders: { status: "available", count: authProviders.configs.length, notes: ["Production Auth Provider Skeleton v1 is disabled-by-default; MockAuthProvider remains active and no token/session validation is running."] },
      providers: { status: "available", count: providers.catalog.length, notes: ["Provider adapters remain skeleton/mock-first."] },
      security: { status: "available", count: security.auditEvents.length, notes: ["Secrets are metadata-only."] },
      localAgents: { status: "available", count: localAgents.registrations.length, notes: ["Protocol is mock/fixture-only."] },
      mcp: { status: "available", count: mcp.tools.length, notes: ["MCP Gateway v0 is mock-first; real transport is disabled."] },
      scopes: { status: "available", count: scopes.tenants.length + scopes.repos.length + scopes.providers.length, notes: ["Tenant/repo/provider scopes are metadata/readiness-only; tenant enforcement and dashboard filtering remain future."] },
      tenantScopePlanning: { status: "available", count: tenantScopePlanning.dashboardPlans.length + tenantScopePlanning.readinessPlans.length, notes: ["Dashboard/Readiness Tenant Scope Planning v1 is planning-only; tenant filtering and production enforcement remain false."] },
      tenantScopeEnforcement: { status: "available", count: tenantScopeEnforcement.modes.length, notes: ["Tenant Scope Enforcement v1 is partial/representative metadata; tenant filtering and production enforcement remain false."] },
      readiness: { status: "available", count: readiness.productionBlockers.length, notes: ["Production deployment readiness is planning-only and currently blocked."] },
      database: { status: "available", count: database.blockers.length, notes: ["Persistent DB Production Operations v1 is read-only planning; no production DB connection or destructive job is run."] },
      secretBackend: { status: "available", count: secretBackend.blockers.length, notes: ["Secret Backend Migration v0 is planning/readiness-only; no real backend is contacted and env values are hidden."] },
      secretBackendDecision: { status: "available", count: secretBackendDecision.risks.length, notes: ["Production Secret Backend Option Decision v0 selects Vault for v1 planning only; no backend is contacted and no secret values are read."] },
      vaultSecretBackend: { status: "available", count: vaultSecretBackend.checks.length, notes: ["Vault Secret Backend v1 is gated and non-default; dashboard data is metadata-only and does not read Vault."] },
      staging: { status: "available", count: staging.blockers.length, notes: ["Staging Deployment Profile v0 is non-production/readiness-only; no deployment, production traffic, or external provider call is enabled."] },
      stagingDryRun: { status: "available", count: stagingDryRun.blockers.length, notes: ["Staging Deployment Dry-run Profile v0 aggregates readiness only; it does not deploy, call providers, or run integration tests."] },
      stagingReleaseCandidate: { status: "available", count: stagingReleaseCandidate.blockers.length, notes: ["Staging Release Candidate Checklist v0 is read-only; it does not create releases, tags, GitHub releases, deployments, or run integration tests."] },
      stagingExecution: { status: "available", count: stagingExecution.blockers.length, notes: ["Staging Deployment Execution Plan v0 is planning-only; it does not deploy, create releases or tags, call providers, or run integration tests."] },
      cicd: { status: "available", count: cicd.blockers.length, notes: ["Staging CI/CD Pipeline Planning v0 is read-only; it does not create active workflows, deploy, or enable remote integration tests by default."] },
      observability: { status: "available", count: typeof observability.auditSummary.totalEvents === "number" ? observability.auditSummary.totalEvents : 0, notes: ["Observability v0 is in-memory/read-only and has no external exporter."] },
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
      mcpRealTransportEnabled: false,
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
  const githubApp = buildGitHubApp(context);
  const githubAppIntegration = buildGitHubAppIntegration(context);
  const conflicts = buildConflicts(context);
  const registry = buildRegistry(context);
  const llm = buildLlm(context);
  const llmIntegration = buildLlmIntegration(context);
  const vaultIntegration = buildVaultIntegration(context);
  const agents = buildAgents(context);
  const policy = buildPolicy(context);
  const policyBundles = buildPolicyBundles(context);
  const policyShadow = buildPolicyShadow(context);
  const auth = buildAuth(context);
  const authProduction = buildAuthProduction(context);
  const authProviders = buildAuthProviders(context);
  const providers = buildProviders(context);
  const security = buildSecurity(context);
  const localAgents = buildLocalAgents(context);
  const mcp = buildMcp(context);
  const scopes = buildScopes(context);
  const tenantScopePlanning = buildTenantScopePlanning(context);
  const tenantScopeEnforcement = buildTenantScopeEnforcement(context);
  const readiness = buildReadiness(context);
  const database = buildDatabase(context);
  const secretBackend = buildSecretBackend(context);
  const secretBackendDecision = buildSecretBackendDecision(context);
  const vaultSecretBackend = buildVaultSecretBackend(context);
  const staging = buildStaging(context);
  const stagingDryRun = buildStagingDryRun(context);
  const stagingReleaseCandidate = buildStagingReleaseCandidate(context);
  const stagingExecution = buildStagingExecution(context);
  const cicd = buildCicd(context);
  const observability = buildObservability(context);
  const audit = buildAudit(context);
  const overview = buildOverview(source, tasks, git, githubApp, githubAppIntegration, conflicts, registry, llm, llmIntegration, vaultIntegration, agents, policy, policyBundles, policyShadow, auth, authProduction, authProviders, providers, security, localAgents, mcp, scopes, tenantScopePlanning, tenantScopeEnforcement, readiness, database, secretBackend, secretBackendDecision, vaultSecretBackend, staging, stagingDryRun, stagingReleaseCandidate, stagingExecution, cicd, observability, audit);

  return {
    overview: withScopeMetadata(overview, dashboardScopeMetadata(context, "overview")),
    tasks: withScopeMetadata(tasks, dashboardScopeMetadata(context, "tasks")),
    git: withScopeMetadata(git, dashboardScopeMetadata(context, "git")),
    githubApp: withScopeMetadata(githubApp, dashboardScopeMetadata(context, "github_app")),
    githubAppIntegration: withScopeMetadata(githubAppIntegration, dashboardScopeMetadata(context, "github_app_integration")),
    conflicts: withScopeMetadata(conflicts, dashboardScopeMetadata(context, "conflict_risks")),
    registry: withScopeMetadata(registry, dashboardScopeMetadata(context, "registry")),
    llm: withScopeMetadata(llm, dashboardScopeMetadata(context, "llm_gateway")),
    llmIntegration: withScopeMetadata(llmIntegration, dashboardScopeMetadata(context, "llm_integration")),
    vaultIntegration: withScopeMetadata(vaultIntegration, dashboardScopeMetadata(context, "vault_integration")),
    agents: withScopeMetadata(agents, dashboardScopeMetadata(context, "local_agent_runner")),
    policy: withScopeMetadata(policy, dashboardScopeMetadata(context, "policy")),
    policyBundles: withScopeMetadata(policyBundles, dashboardScopeMetadata(context, "policy_bundles")),
    policyShadow: withScopeMetadata(policyShadow, dashboardScopeMetadata(context, "policy_shadow")),
    auth: withScopeMetadata(auth, dashboardScopeMetadata(context, "auth")),
    authProduction: withScopeMetadata(authProduction, dashboardScopeMetadata(context, "auth_production")),
    authProviders: withScopeMetadata(authProviders, dashboardScopeMetadata(context, "auth_provider_skeleton")),
    providers: withScopeMetadata(providers, dashboardScopeMetadata(context, "providers")),
    security: withScopeMetadata(security, dashboardScopeMetadata(context, "security")),
    localAgents: withScopeMetadata(localAgents, dashboardScopeMetadata(context, "local_agent_protocol")),
    mcp: withScopeMetadata(mcp, dashboardScopeMetadata(context, "mcp_gateway")),
    scopes: withScopeMetadata(scopes, dashboardScopeMetadata(context, "scope_model")),
    tenantScopePlanning,
    tenantScopeEnforcement,
    readiness: withScopeMetadata(readiness, dashboardScopeMetadata(context, "production_readiness")),
    database: withScopeMetadata(database, dashboardScopeMetadata(context, "database")),
    secretBackend: withScopeMetadata(secretBackend, dashboardScopeMetadata(context, "secret_backend")),
    secretBackendDecision: withScopeMetadata(secretBackendDecision, dashboardScopeMetadata(context, "secret_backend_decision")),
    vaultSecretBackend: withScopeMetadata(vaultSecretBackend, dashboardScopeMetadata(context, "vault_secret_backend")),
    staging: withScopeMetadata(staging, dashboardScopeMetadata(context, "staging")),
    stagingDryRun: withScopeMetadata(stagingDryRun, dashboardScopeMetadata(context, "staging_dry_run")),
    stagingReleaseCandidate: withScopeMetadata(stagingReleaseCandidate, dashboardScopeMetadata(context, "staging_rc")),
    stagingExecution: withScopeMetadata(stagingExecution, dashboardScopeMetadata(context, "staging_execution")),
    cicd: withScopeMetadata(cicd, dashboardScopeMetadata(context, "ci_cd")),
    observability: withScopeMetadata(observability, dashboardScopeMetadata(context, "observability")),
    audit: withScopeMetadata(audit, dashboardScopeMetadata(context, "audit"))
  };
}
