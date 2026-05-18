import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { AichestraError, ConflictResolutionAssistantService, MergeQueuePolicyService, NotFoundError, PrOwnershipService, RealMergeExecutionPolicyService, isTaskStatus } from "@aichestra/core";
import type { BranchLeaseStatus, ConflictResolutionRequestContext, MergeQueueHoldKind, MergeQueueHoldSeverity, MergeQueuePolicyAction, MergeQueuePolicyContext, MergeSimulationMode, MergeSimulationStatus, PrHandoffDecisionValue, PrHandoffKind, PrHandoffStatus, PrOwnerKind, PrOwnershipContext, PrOwnershipStatus, RealMergeEvidenceStatus, RealMergeExecutionContext, RegistryVersionRef, Task } from "@aichestra/core";
import type { TaskStatus } from "@aichestra/core";
import {
  InMemoryAichestraStore,
  createInMemoryStorageProvider,
  createPostgresStorageProviderFromEnv,
  createSeededStore
} from "@aichestra/db";
import type { StorageProvider } from "@aichestra/db";
import {
  authProviderOptionToDto,
  productionAuthProviderConfigToDto,
  productionAuthProviderReadinessToDto,
  productionAuthProviderSkeletonSummaryToDto,
  sessionTokenBoundaryPlanToDto,
  identityMappingPlanToDto,
  authRbacMigrationPhaseToDto,
  authRbacPermissionMatrixEntryToDto,
  authRbacProductionRiskToDto,
  authRbacProductionSummaryToDto,
  authRbacReadinessCheckToDto,
  cicdIntegrationTestGateToDto,
  cicdJobDefinitionToDto,
  cicdPipelineProfileToDto,
  cicdPipelineReadinessSummaryToDto,
  cicdReadinessCheckToDto,
  cicdRiskToDto,
  captureLocalStagingSignoffScope,
  createDashboardReadinessTenantScopePlanningService,
  createDashboardScopeFilteringService,
  parseDashboardFilterHeaders,
  createDeploymentReadinessService,
  dashboardPanelScopeSummaryToDto,
  databaseAuditGrowthPlanToDto,
  databaseDeploymentProfileToDto,
  databaseIndexReviewItemToDto,
  databaseMigrationStatusToDto,
  databaseOperationRiskToDto,
  databaseOperationsSummaryToDto,
  databaseReadinessCheckToDto,
  databaseRetentionPlanToDto,
  databaseSchemaInventoryItemToDto,
  databaseWebhookPersistencePlanToDto,
  deploymentProfileToDto,
  deploymentReadinessSummaryToDto,
  dashboardTenantScopePlanToDto,
  githubAppCredentialReadinessToDto,
  githubAppDescriptorToDto,
  githubAppIntegrationTestCaseToDto,
  githubAppIntegrationTestProfileToDto,
  githubAppIntegrationTestReadinessSummaryToDto,
  githubAppIntegrationTestSafetyCheckToDto,
  githubAppInstallationToDto,
  githubAppPermissionMatrixEntryToDto,
  githubAppProductionRiskToDto,
  githubAppReadinessCheckToDto,
  githubAppRepositoryGrantToDto,
  githubProductionWebhookEndpointPlanToDto,
  githubWebhookDeadLetterPlanToDto,
  githubWebhookDeadLetterRecordToDto,
  githubWebhookDeliveryRecordToDto,
  githubWebhookEventAllowlistEntryToDto,
  githubWebhookHardeningSummaryToDto,
  githubWebhookReplayProtectionPlanToDto,
  llmIntegrationTestCaseToDto,
  llmIntegrationTestProfileToDto,
  llmIntegrationTestReadinessSummaryToDto,
  llmIntegrationTestSafetyCheckToDto,
  vaultIntegrationTestCaseToDto,
  vaultIntegrationTestProfileToDto,
  vaultIntegrationTestReadinessSummaryToDto,
  vaultIntegrationTestSafetyCheckToDto,
  mergeQueueIntegrationTestCaseToDto,
  mergeQueueIntegrationTestProfileToDto,
  mergeQueueIntegrationTestReadinessSummaryToDto,
  mergeQueueIntegrationSafetyCheckToDto,
  policyBundleMigrationPhaseToDto,
  policyBundlePlanToDto,
  policyBundleReadinessCheckToDto,
  policyBundleReadinessSummaryToDto,
  policyBundleRiskToDto,
  policyDomainMappingToDto,
  policyEngineOptionToDto,
  policyShadowComparisonRuleToDto,
  policyShadowEvaluationPlanToDto,
  policyShadowEvaluationReportToDto,
  policyRuntimePocDomainMappingToDto,
  policyRuntimePocGoldenCaseToDto,
  policyRuntimePocInputContractToDto,
  policyRuntimePocOptionToDto,
  policyRuntimePocReadinessCheckToDto,
  policyRuntimePocRiskToDto,
  policyRuntimePocSummaryToDto,
  policyShadowEvaluationSummaryToDto,
  policyShadowMismatchToDto,
  policyShadowReadinessCheckToDto,
  productionRiskToDto,
  readinessCheckToDto,
  readinessEndpointScopeSummaryToDto,
  readinessTenantScopePlanToDto,
  secretBackendDecisionCriterionToDto,
  secretBackendDecisionRiskToDto,
  secretBackendDecisionScoreToDto,
  secretBackendImplementationScopeToDto,
  secretBackendMigrationPhaseToDto,
  secretBackendMigrationSummaryToDto,
  secretBackendOptionToDto,
  secretBackendOptionDecisionSummaryToDto,
  secretBackendOptionDecisionToDto,
  secretBackendProviderMappingToDto,
  secretBackendReadinessCheckToDto,
  secretBackendRiskToDto,
  secretLeasePolicyToDto,
  secretRotationPlanToDto,
  serviceAccountPlanToDto,
  stagingSignoffScopeEvidencePath,
  stagingSignoffValidationEvidencePaths,
  stagingDeploymentDryRunBlockerToDto,
  stagingDeploymentDryRunCheckToDto,
  stagingDeploymentDryRunProfileToDto,
  stagingDeploymentDryRunReportToDto,
  stagingDeploymentDryRunSourceToDto,
  stagingDeploymentDryRunSummaryToDto,
  stagingDeploymentExecutionPlanToDto,
  stagingDeploymentExecutionSummaryToDto,
  stagingDeploymentGateToDto,
  stagingDeploymentGoNoGoDecisionToDto,
  stagingDeploymentRollbackPlanToDto,
  stagingDeploymentStepToDto,
  stagingHumanSignoffEvidenceToDto,
  stagingDeploymentProfileToDto,
  stagingDeploymentSummaryToDto,
  stagingIntegrationGateToDto,
  stagingPromotionCriterionToDto,
  stagingReadinessCheckToDto,
  stagingReleaseCandidateBlockerToDto,
  stagingReleaseCandidateChecklistToDto,
  stagingReleaseCandidateGateToDto,
  stagingReleaseCandidateReportToDto,
  stagingReleaseCandidateSignoffToDto,
  stagingReleaseCandidateSummaryToDto,
  stagingReleaseNoteRequirementToDto,
  stagingRollbackChecklistItemToDto,
  stagingRollbackCriterionToDto,
  tenantBoundaryPlanToDto,
  tenantScopeFallbackBehaviorToDto,
  tenantScopePlanningSummaryToDto,
  tenantScopeRoleVisibilityToDto,
  scopedReadModelMetadataToDto
} from "@aichestra/deployment-readiness";
import type { AuthRbacReadinessCategory, CICDJobCategory, CICDPipelineProfileName, CICDReadinessCategory, DashboardReadinessTenantScopePlanningService, DeploymentReadinessService, GitHubAppIntegrationTestSafetyCategory, LLMIntegrationTestSafetyCategory, MergeQueueIntegrationSafetyCategory, PolicyBundleReadinessCategory, PolicyRuntimePocReadinessCategory, PolicyShadowReadinessCategory, SecretBackendReadinessCategory, StagingDeploymentDryRunCheckCategory, StagingDeploymentGateCategory, StagingHumanSignoffEvidence, StagingHumanSignoffStatus, StagingReadinessCategory, StagingReleaseCandidateGateCategory, StagingReleaseCandidateSignoffRole, StagingSignoffScopeReview, StagingSignoffScopeSnapshot, VaultIntegrationTestSafetyCategory } from "@aichestra/deployment-readiness";
import {
  AuthorizationService,
  InMemoryAuthRepository,
  MockAuthProvider,
  ProductionAuthProviderRegistry,
  RequestContextResolver,
  ServiceAccountContextFactory,
  actorToDto,
  authAuditEventToDto,
  authContextToDto,
  authorizationDecisionToDto,
  buildOidcClaimsMappingPlan,
  buildOidcDiscoveryReadiness,
  buildOidcJwksReadiness,
  buildOidcProviderConfig,
  buildOidcProviderSkeletonSummary,
  buildOidcTokenValidationBoundary,
  createTenantScopeEnforcementService,
  identityProviderToDto,
  listMockScopeCatalog,
  permissionToDto,
  principalToDto,
  roleBindingToDto,
  roleToDto,
  serviceAccountToDto,
  scopeSummary,
  tenantScopeEnforcementModeToDto,
  tenantScopeEnforcementSummaryToDto,
  tenantScopeMismatchToDto,
  teamToDto
} from "@aichestra/auth";
import type { AuthorizationResource, RequestSource, ResourceScope, TenantScopeEnforcementService } from "@aichestra/auth";
import {
  BranchCleanupRecoveryService,
  BranchOrchestratorService,
  GitIntegrationService,
  GitHubAppRuntimeService,
  GitWebhookReceiverService,
  InMemoryBranchCleanupRecoveryRepository,
  InMemoryBranchOrchestratorRepository,
  LocalGitDryRunMergeSimulator,
  MockMergeSimulator,
  baseBranchDriftStatusToDto,
  branchNamingPolicyToDto,
  branchOrchestrationDecisionToDto,
  branchOrchestrationRequestToDto,
  branchOrchestratorAuditEventToDto,
  branchOrchestratorSummaryToDto,
  branchOwnershipRecordToDto,
  createGitHubAppRuntimeConfigFromEnv,
  createGitHubWebhookRuntimeFromEnv,
  createGitProviderFromEnv
} from "@aichestra/git-adapter";
import type { BaseBranchDriftStatusValue, BranchCleanupDecisionInput, BranchOrchestrationDecisionValue, BranchOwnershipStatus, BranchPurpose, CleanupDecisionValue, GitHubAppRuntimeConfig, GitHubWebhookRuntimeConfig, GitProviderRuntimeConfig, OrphanLeaseKind, OrphanSeverity } from "@aichestra/git-adapter";
import {
  budgetDecisionToDto,
  credentialReferenceResultToDto,
  createDefaultLlmGatewayService,
  LocalAgentProtocolError,
  LocalAgentProtocolService,
  localAgentCapabilityAdvertisementToDto,
  localAgentChannelToDto,
  localAgentDescriptorToDto,
  localAgentConsentDecisionToDto,
  localAgentConsentRequestToDto,
  localAgentHandshakeToDto,
  localAgentInvocationEnvelopeToDto,
  localAgentInvocationStreamToDto,
  localAgentInvocationToDto,
  localAgentNormalizedEventToDto,
  localAgentProtocolAuditEventToDto,
  localAgentRegistrationToDto,
  localAgentSessionToDto,
  localAgentStreamEventToDto,
  localCliCompatibilityRuleToDto,
  localCliCompatibilityEntryToDto,
  localCliCompatibilityResultToDto,
  localCliParserProfileToDto,
  localCliProviderTemplateReadinessToDto,
  localCliProviderTemplateToDto,
  localCliSecurityConstraintToDto,
  isLlmModelStatus,
  isLlmProviderKind,
  isVirtualModelKeyStatus,
  llmAuditEventToDto,
  llmCompletionResultToDto,
  llmConfigToDto,
  llmFallbackPolicyToDto,
  llmModelToDto,
  llmProviderHealthToDto,
  llmRouteToDto,
  llmRoutingDecisionToDto,
  providerAuditEventToDto,
  providerCatalogEntryToDto,
  providerInvocationResultToDto,
  providerValidationResultToDto,
  ProviderAbstractionService,
  virtualModelKeyToDto
} from "@aichestra/llm-gateway";
import type { LLMGatewayService } from "@aichestra/llm-gateway";
import {
  createDefaultMCPGateway,
  mcpGatewayConfigToDto,
  mcpServerCatalogEntryToDto,
  mcpToolAuditEventToDto,
  mcpToolDefinitionToDto,
  mcpToolInvocationResultToDto
} from "@aichestra/mcp-gateway";
import type { MCPGateway, MCPToolInvocationStatus } from "@aichestra/mcp-gateway";
import {
  auditQueryResultToDto,
  auditRedactionClassToDto,
  auditRetentionClassToDto,
  auditRetentionPolicyToDto,
  auditSourceCoverageToDto,
  auditSummaryToDto,
  createAuditQueryScopeEnforcementService,
  createObservabilityService,
  metricDefinitionToDto,
  metricSnapshotToDto,
  observabilityConfigToDto,
  traceSpanToDto
} from "@aichestra/observability";
import type { AuditCategory, AuditQueryRequestedDetailLevel, AuditOutcome, AuditSeverity, ObservabilityService, AuditQueryScopeEnforcementService } from "@aichestra/observability";
import {
  AgentRunnerService,
  AgentRunCoordinationService,
  EditIntentGraphService,
  InMemoryAgentRunCoordinationRepository,
  MockAgentRunner,
  agentConcurrencyPolicyToDto,
  editIntentGraphToDto,
  editIntentOverlapSummaryToDto,
  editIntentToDto,
  editOverlapAssessmentToDto,
  fileLeaseToDto,
  agentRunCoordinationAuditEventToDto,
  agentRunCoordinationGroupToDto,
  agentRunCoordinationRecommendationToDto,
  agentRunCoordinationSummaryToDto,
  agentRunAuditEventToDto,
  agentSessionOverlapToDto,
  agentSessionToDto,
  agentRunToDto,
  agentRunnerConfigToDto,
  agentWorkspaceToDto,
  agentWorkspaceCleanupDecisionToDto,
  agentWorkspaceLeaseToDto,
  agentWorkspaceLifecycleEventToDto,
  AgentWorkspaceLifecycleService,
  AgentWorktreeAllocationService,
  commandExecutionResultToDto,
  createInMemoryAgentRunnerRepositories,
  createAgentRunnerConfigFromEnv,
  createAgentRunnerFromConfig,
  createAgentWorktreeAllocationServiceFromEnv,
  agentWorktreeAllocationRequestToDto,
  agentWorktreeAllocationResultToDto,
  agentWorktreeAllocationSummaryToDto,
  agentWorktreeSafetyCheckToDto,
  instructionAssemblyToDto,
  LocalAgentWorkspaceManager
} from "@aichestra/runner";
import type {
  AgentWorktreeAllocationDecision,
  AgentWorktreeAllocationMode,
  AgentWorktreeSafetyCheckKind,
  AgentWorktreeSafetyStatus,
  AgentRunnerRuntimeConfig,
  EditIntentConfidence,
  EditIntentKind,
  EditIntentStatus,
  EditOverlapKind,
  EditOverlapRecommendation,
  EditOverlapSeverity,
  FileLeaseKind,
  FileLeaseStatus,
  AgentSessionOverlapSeverity,
  AgentSessionSourceScopeKind,
  AgentSessionStatus,
  AgentWorkspaceKind,
  AgentWorkspaceLifecycleStatus,
  AgentWorkspaceMergeStatus
} from "@aichestra/runner";
import {
  autoImprovementAnalysisToDto,
  canaryReadinessToDto,
  canaryRolloutPlanToDto,
  createImprovementServices,
  draftRegistryChangeToDto,
  evalRequirementToDto,
  failureClusterToDto,
  failureSignalToDto,
  improvementGovernanceAuditEventToDto,
  improvementCandidateToDto,
  improvementProposalToDto,
  isDraftRegistryChangeStatus,
  isFailureSeverity,
  isFailureSignalTargetKind,
  isImprovementCandidateStatus,
  isImprovementProposalStatus,
  isProposalEvalRunStatus,
  isProposalGovernanceDecision,
  proposalApplyGateToDto,
  proposalEvalRunToDto,
  proposalGovernanceDecisionToDto,
  proposalReadinessToDto,
  proposalReviewQueueItemToDto,
  safetyPolicyToDto
} from "@aichestra/improvement";
import type { ImprovementServices } from "@aichestra/improvement";
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject,
  isPolicyAction,
  isPolicyResourceKind,
  policyDecisionAuditEntryToDto,
  policyDecisionToDto,
  policyRuleToDto,
  runPolicyRuntimeGoldenHarness
} from "@aichestra/policy";
import type { PolicyActorKind } from "@aichestra/policy";
import {
  PolicyBackedRegistryMutationAuthorizer,
  RegistryCompatibilityService,
  RegistryArtifactTrustService,
  RegistryDriftDetectionService,
  CanaryExecutionService,
  ApplyWorkflowService,
  EvalSuiteExecutionService,
  createRegistryService,
  createRegistryCompatibilityService,
  createRegistryArtifactTrustService,
  createRegistryDriftDetectionService,
  createCanaryAndApplyServices,
  createEvalSuiteExecutionService,
  createRegistryTenantScopeEnforcementService,
  registryEvalAttachmentToDto,
  registryEvalCaseResultToDto,
  registryEvalCaseToDto,
  registryEvalRunToDto,
  registryEvalSuiteToDto,
  registryEvalSummaryToDto,
  registryEvalTargetFromRegistryPackage,
  registryEvalVerdictToDto,
  harnessToDto,
  instructionToDto,
  isApprovalStatus,
  isEvalStatus,
  isRegistryEvalResultSource,
  isRegistryEvalResultStatus,
  isRegistryEvalResultType,
  isRegistryStatus,
  registryAuditLogToDto,
  registryApprovalQueueItemToDto,
  registryArtifactInputFromPackageManifest,
  registryArtifactProvenanceToDto,
  registryArtifactSignatureToDto,
  registryArtifactTrustDecisionToDto,
  registryArtifactTrustPolicyToDto,
  registryArtifactTrustSummaryToDto,
  registryEvalResultToDto,
  registryImportResultToDto,
  registryPackageManifestToDto,
  registryResolutionToDto,
  registryRevisionToDto,
  registryRollbackResultToDto,
  registryResourceInputFromHarness,
  registryResourceInputFromInstruction,
  registryResourceInputFromPackageManifest,
  registryResourceInputFromSkill,
  registryScopeDecisionToDto,
  registryScopeEnforcementSummaryToDto,
  skillToDto
} from "@aichestra/registry";
import type { RegistryArtifactKind, RegistryArtifactTrustDecisionValue, RegistryArtifactTrustEvaluationInput, RegistryArtifactTrustContext, RegistryCompatibilityContextInput, RegistryCompatibilityServiceContext, RegistryEvalRunStatus, RegistryEvalServiceContext, RegistryEvalTargetKind, RegistryEvalTargetSnapshot, RegistryScopeEvaluationInput, RegistryScopeResourceKind, RegistryScopeServiceContext, RegistryService, RegistryTenantScopeEnforcementService } from "@aichestra/registry";
import {
  SecurityControlService,
  credentialResolutionResultToDto,
  networkEgressPolicyToDto,
  redactionPolicyToDto,
  redactionResultToDto,
  sandboxDecisionToDto,
  sandboxProfileToDto,
  sandboxSessionToDto,
  secretLeaseToDto,
  secretRefToDto,
  secretScopeToDto,
  securityAuditEventToDto,
  vaultClientHealthToDto,
  vaultSecretProviderConfigToDto
} from "@aichestra/security";
import type { SecretKind, SecretProviderKind, SecretRefStatus } from "@aichestra/security";
import { runAgentTaskWorkflow } from "@aichestra/worker";
import { buildDashboardReadModels } from "./dashboard-read-model.ts";
import { ApiRequestContextMiddleware } from "./request-context-middleware.ts";
export { ApiRequestContextMiddleware } from "./request-context-middleware.ts";

type RouteContext = {
  store: InMemoryAichestraStore;
  storageProvider: StorageProvider;
  gitIntegrationService: GitIntegrationService;
  branchOrchestratorService: BranchOrchestratorService;
  gitProviderConfig: GitProviderRuntimeConfig;
  githubAppRuntimeService: GitHubAppRuntimeService;
  githubAppRuntimeConfig: GitHubAppRuntimeConfig;
  gitWebhookReceiverService: GitWebhookReceiverService;
  gitWebhookConfig: GitHubWebhookRuntimeConfig;
  llmGatewayService: LLMGatewayService;
  agentRunnerService: AgentRunnerService;
  agentRunCoordinationService: AgentRunCoordinationService;
  agentWorktreeAllocationService: AgentWorktreeAllocationService;
  mergeQueuePolicyService: MergeQueuePolicyService;
  conflictResolutionAssistantService: ConflictResolutionAssistantService;
  prOwnershipService: PrOwnershipService;
  realMergeExecutionPolicyService: RealMergeExecutionPolicyService;
  branchCleanupRecoveryService: BranchCleanupRecoveryService;
  editIntentGraphService: EditIntentGraphService;
  agentRunnerConfig: AgentRunnerRuntimeConfig;
  registryService: RegistryService;
  registryCompatibilityService: RegistryCompatibilityService;
  registryArtifactTrustService: RegistryArtifactTrustService;
  evalSuiteExecutionService: EvalSuiteExecutionService;
  registryDriftDetectionService: RegistryDriftDetectionService;
  canaryExecutionService: CanaryExecutionService;
  applyWorkflowService: ApplyWorkflowService;
  registryCanaryApplyGetSummary: () => import("@aichestra/registry").RegistryCanaryApplySummary;
  registryTenantScopeEnforcementService: RegistryTenantScopeEnforcementService;
  improvementServices: ImprovementServices;
  policyService: PolicyService;
  authorizationService: AuthorizationService;
  requestContextResolver: RequestContextResolver;
  apiRequestContextMiddleware: ApiRequestContextMiddleware;
  providerAbstractionService: ProviderAbstractionService;
  securityService: SecurityControlService;
  localAgentProtocolService: LocalAgentProtocolService;
  mcpGatewayService: MCPGateway;
  deploymentReadinessService: DeploymentReadinessService;
  tenantScopePlanningService: DashboardReadinessTenantScopePlanningService;
  dashboardScopeFilteringService: import("@aichestra/deployment-readiness").DashboardScopeFilteringService;
  tenantScopeEnforcementService: TenantScopeEnforcementService;
  observabilityService: ObservabilityService;
  auditQueryScopeEnforcementService: AuditQueryScopeEnforcementService;
};

type JsonValue = Record<string, unknown> | unknown[];
let activeApiServer: Server | undefined;

function sendJson(response: ServerResponse, statusCode: number, body: JsonValue): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body, null, 2));
}

function fallbackReadinessScopeMetadata(endpointKey: string): Record<string, unknown> {
  return {
    scopeStatus: "metadata_only",
    appliedScopes: [],
    requiredScopes: [],
    missingScopes: [],
    sensitivity: "internal_metadata",
    roleVisibility: { allowedRoles: ["platform_admin"] },
    redactionStatus: "metadata_only",
    tenantFilteringImplemented: false,
    productionEnforcementImplemented: false,
    warnings: ["scope_plan_not_found", "tenant_filtering_implemented:false", "production_tenant_enforcement:false"],
    metadata: {
      endpointKey,
      planningOnly: true,
      noSecretsOrEnvValues: true,
      productionReady: false
    }
  };
}

function readinessScopedPayload(context: RouteContext, endpointKey: string, payload: Record<string, unknown>): Record<string, unknown> {
  const metadata = context.tenantScopePlanningService.getReadinessEndpointScopeMetadata(endpointKey);
  const summary = context.tenantScopePlanningService.getReadinessEndpointScopeSummary(endpointKey);
  const decision = summary
    ? context.tenantScopeEnforcementService.evaluateReadinessEndpointAccess(undefined, summary, { source: `readiness:${endpointKey}` })
    : context.tenantScopeEnforcementService.evaluateScopeAccess(undefined, undefined, { source: `readiness:${endpointKey}` });
  const decisionSummary = context.tenantScopeEnforcementService.summarizeDecision(decision);
  const baseScopeMetadata = metadata ? scopedReadModelMetadataToDto(metadata) : fallbackReadinessScopeMetadata(endpointKey);
  return {
    ...payload,
    scopeMetadata: {
      ...baseScopeMetadata,
      tenantScopeEnforcementImplemented: "partial",
      enforcementMode: decision.enforcementMode,
      scopeDecisionSummary: decisionSummary,
      warnings: [
        ...new Set([
          ...((baseScopeMetadata.warnings as string[] | undefined) ?? []),
          ...decisionSummary.warnings
        ])
      ],
      metadata: {
        ...((baseScopeMetadata.metadata as Record<string, unknown> | undefined) ?? {}),
        tenantScopeEnforcementStatus: "v1_implemented_partial",
        representativeEnforcementOnly: true,
        productionTenantEnforcement: false
      }
    },
    endpointScopeSummary: summary ? readinessEndpointScopeSummaryToDto(summary) : undefined,
    enforcementMode: decision.enforcementMode,
    scopeDecisionSummary: decisionSummary
  };
}

function sendHtml(response: ServerResponse, statusCode: number, body: string): void {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8"
  });
  response.end(body);
}

function sendRedirect(response: ServerResponse, location: string): void {
  response.writeHead(303, { location });
  response.end();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function htmlValue(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return escapeHtml(fallback);
  if (Array.isArray(value)) return escapeHtml(value.map((item) => String(item)).join(", ") || fallback);
  return escapeHtml(String(value));
}

function notFound(resource: string, id: string): never {
  throw new NotFoundError(resource, id);
}

function taskView(task: Task): Record<string, unknown> {
  return {
    ...task,
    state: task.status
  };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readRawBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readRequestBodyRecord(request: IncomingMessage): Promise<{ body: Record<string, unknown>; formEncoded: boolean }> {
  const contentType = request.headers["content-type"] ?? "";
  if (typeof contentType === "string" && contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams((await readRawBody(request)).toString("utf8"));
    const body: Record<string, unknown> = {};
    for (const [key, value] of params.entries()) {
      const existing = body[key];
      if (existing === undefined) {
        body[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        body[key] = [existing, value];
      }
    }
    return { body, formEncoded: true };
  }
  return { body: recordValue(await readJson(request)), formEncoded: false };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function registryScopeContextFromRequest(
  requestContext: ReturnType<ApiRequestContextMiddleware["requireApiContext"]>
): RegistryScopeServiceContext {
  return {
    requestContext,
    authContext: requestContext.authContext,
    actorId: requestContext.authContext.actor.id,
    principalId: requestContext.authContext.principal.id,
    serviceAccountId: stringValue(requestContext.authContext.metadata.serviceAccountId),
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
    source: requestContext.source,
    roles: requestContext.authContext.roles.map((role) => role.name),
    tenantId: requestContext.tenantId,
    teamId: requestContext.teamId,
    projectId: requestContext.projectId,
    resourceScopes: requestContext.resourceScopes,
    metadata: requestContext.metadata
  };
}

function registryScopeInputsFromRegistry(registryService: RegistryService): RegistryScopeEvaluationInput[] {
  return [
    ...registryService.listSkills().map(registryResourceInputFromSkill),
    ...registryService.listHarnesses().map(registryResourceInputFromHarness),
    ...registryService.listInstructions().map(registryResourceInputFromInstruction),
    ...registryService.listPackageManifests().map(registryResourceInputFromPackageManifest)
  ];
}

function registryArtifactTrustContextFromRequest(
  requestContext: ReturnType<ApiRequestContextMiddleware["requireApiContext"]>
): RegistryArtifactTrustContext {
  return {
    requestContext,
    authContext: requestContext.authContext,
    actorId: requestContext.authContext.actor.id,
    principalId: requestContext.authContext.principal.id,
    serviceAccountId: stringValue(requestContext.authContext.metadata.serviceAccountId),
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
    source: requestContext.source,
    roles: requestContext.authContext.roles.map((role) => role.name),
    resourceScopes: requestContext.resourceScopes,
    metadata: {
      ...(requestContext.metadata ?? {}),
      metadataOnly: true,
      resolverGatesPreserved: true,
      realSigningImplemented: false,
      realVerificationImplemented: false,
      externalRegistryCalls: false
    }
  };
}

function registryArtifactTrustInputsFromRegistry(registryService: RegistryService): RegistryArtifactTrustEvaluationInput[] {
  return registryService.listPackageManifests().map(registryArtifactInputFromPackageManifest);
}

function registryArtifactTrustInputFromBody(body: Record<string, unknown>): RegistryArtifactTrustEvaluationInput | undefined {
  const artifactId = stringValue(body.artifactId) ?? stringValue(body.packageId);
  if (!artifactId) return undefined;
  const artifactKind = isRegistryArtifactKind(body.artifactKind) ? body.artifactKind : undefined;
  const metadata = recordValue(body.metadata);
  return {
    artifactId,
    packageId: stringValue(body.packageId),
    artifactKind,
    checksum: stringValue(body.checksum),
    digest: isRecordValue(body.digest) ? body.digest as RegistryArtifactTrustEvaluationInput["digest"] : undefined,
    signature: isRecordValue(body.signature) ? body.signature as RegistryArtifactTrustEvaluationInput["signature"] : undefined,
    provenance: isRecordValue(body.provenance) ? body.provenance as RegistryArtifactTrustEvaluationInput["provenance"] : undefined,
    sensitive: body.sensitive === true,
    metadata
  };
}

function registryEvalContextFromRequest(
  requestContext: ReturnType<ApiRequestContextMiddleware["requireApiContext"]>
): RegistryEvalServiceContext {
  return {
    requestContext,
    authContext: requestContext.authContext,
    actorId: requestContext.authContext.actor.id,
    principalId: requestContext.authContext.principal.id,
    serviceAccountId: stringValue(requestContext.authContext.metadata.serviceAccountId),
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
    source: requestContext.source,
    roles: requestContext.authContext.roles.map((role) => role.name),
    resourceScopes: requestContext.resourceScopes,
    metadata: {
      ...(requestContext.metadata ?? {}),
      metadataOnly: true,
      mockExecutionOnly: true,
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
    }
  };
}

function registryEvalTargetFromServices(
  registryService: RegistryService,
  improvementServices: ImprovementServices,
  targetKind: RegistryEvalTargetKind,
  targetId: string
): RegistryEvalTargetSnapshot | undefined {
  if (targetKind === "skill") {
    const target = registryService.getSkill(targetId);
    return target ? {
      targetKind,
      targetId: target.id,
      targetName: target.name,
      targetVersion: target.version,
      status: target.status,
      approvalStatus: target.approvalStatus,
      evalStatus: target.evalStatus,
      metadata: {
        owner: target.owner,
        compatibleAgents: target.compatibleAgents,
        requiredHarnesses: target.requiredHarnesses,
        dependencyCount: target.dependencies?.length ?? 0
      }
    } : undefined;
  }
  if (targetKind === "harness") {
    const target = registryService.getHarness(targetId);
    return target ? {
      targetKind,
      targetId: target.id,
      targetName: target.name,
      targetVersion: target.version,
      status: target.status,
      approvalStatus: target.approvalStatus,
      evalStatus: target.evalStatus,
      metadata: {
        owner: target.owner,
        runtimeType: target.runtimeType,
        dependencyCount: target.dependencies?.length ?? 0
      }
    } : undefined;
  }
  if (targetKind === "instruction") {
    const target = registryService.getInstruction(targetId);
    return target ? {
      targetKind,
      targetId: target.id,
      targetName: target.name,
      targetVersion: target.version,
      status: target.status,
      approvalStatus: target.approvalStatus,
      evalStatus: target.evalStatus,
      checksumStatus: target.checksumStatus,
      metadata: {
        type: target.type,
        scope: target.scope,
        precedence: target.precedence,
        checksumAlgorithm: target.checksumAlgorithm,
        dependencyCount: target.dependencies?.length ?? 0
      }
    } : undefined;
  }
  if (targetKind === "registry_package") {
    const manifest = registryService.getPackageManifest(targetId);
    return manifest ? registryEvalTargetFromRegistryPackage(manifest) : undefined;
  }
  if (targetKind === "draft_registry_change") {
    const change = improvementServices.draftRegistryChanges.getDraftChange(targetId);
    return change ? {
      targetKind,
      targetId: change.id,
      targetName: change.targetName,
      targetVersion: change.targetVersion,
      status: change.status,
      draftRegistryChange: change,
      proposal: improvementServices.proposals.listProposals().find((proposal) => proposal.id === change.proposalId),
      metadata: {
        proposalId: change.proposalId,
        targetKind: change.targetKind,
        targetId: change.targetId,
        changeType: change.changeType,
        draftOnly: true,
        activeRegistryMutation: false
      }
    } : undefined;
  }
  return undefined;
}

function isRegistryEvalTargetKind(value: unknown): value is RegistryEvalTargetKind {
  return value === "skill" ||
    value === "harness" ||
    value === "instruction" ||
    value === "registry_package" ||
    value === "draft_registry_change";
}

function isRegistryEvalRunStatus(value: unknown): value is RegistryEvalRunStatus {
  return value === "requested" ||
    value === "running_mock" ||
    value === "passed" ||
    value === "failed" ||
    value === "warning" ||
    value === "skipped" ||
    value === "blocked_policy" ||
    value === "blocked_missing_target" ||
    value === "future_external";
}

function isRegistryScopeResourceKind(value: unknown): value is RegistryScopeResourceKind {
  return value === "skill" ||
    value === "harness" ||
    value === "instruction" ||
    value === "package" ||
    value === "eval_result" ||
    value === "approval_queue" ||
    value === "history" ||
    value === "audit";
}

function isRegistryArtifactKind(value: unknown): value is RegistryArtifactKind {
  return value === "skill_package" ||
    value === "harness_package" ||
    value === "instruction_artifact" ||
    value === "registry_bundle" ||
    value === "policy_bundle_future" ||
    value === "unknown";
}

function isRegistryArtifactTrustDecision(value: unknown): value is RegistryArtifactTrustDecisionValue {
  return value === "trusted" ||
    value === "trusted_with_warnings" ||
    value === "untrusted" ||
    value === "blocked_unsigned" ||
    value === "blocked_digest_mismatch" ||
    value === "blocked_invalid_signature" ||
    value === "blocked_missing_provenance" ||
    value === "future_verification_required";
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const observabilityAuditCategories = new Set<AuditCategory>([
  "auth",
  "policy",
  "credential",
  "git",
  "git_webhook",
  "llm",
  "mcp",
  "runner",
  "registry",
  "improvement",
  "local_agent",
  "security",
  "dashboard",
  "system"
]);
const observabilityAuditOutcomes = new Set<AuditOutcome>(["success", "denied", "blocked", "failed", "skipped", "unknown"]);
const observabilityAuditSeverities = new Set<AuditSeverity>(["debug", "info", "warning", "error", "critical"]);

function csvQueryValues(url: URL, ...names: string[]): string[] {
  return names.flatMap((name) => url.searchParams.getAll(name))
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseAuditCategories(url: URL): AuditCategory[] | undefined {
  const values = csvQueryValues(url, "category", "categories");
  const categories = values.filter((value): value is AuditCategory => observabilityAuditCategories.has(value as AuditCategory));
  return categories.length > 0 ? categories : undefined;
}

function parseAuditOutcome(url: URL): AuditOutcome | undefined {
  const value = url.searchParams.get("outcome") ?? undefined;
  return value && observabilityAuditOutcomes.has(value as AuditOutcome) ? value as AuditOutcome : undefined;
}

function parseAuditSeverity(url: URL): AuditSeverity | undefined {
  const value = url.searchParams.get("severity") ?? undefined;
  return value && observabilityAuditSeverities.has(value as AuditSeverity) ? value as AuditSeverity : undefined;
}

function parseAuditQueryDetailLevel(value: string | null | undefined): AuditQueryRequestedDetailLevel | undefined {
  if (value === "summary" || value === "metadata" || value === "detail" || value === "raw_payload_forbidden") return value;
  return undefined;
}

function parseDateQuery(url: URL, name: string): Date | undefined {
  const value = url.searchParams.get(name);
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function dateValue(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value !== "string" || value.length === 0) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parsePositiveIntegerQuery(url: URL, name: string): number | undefined {
  const value = url.searchParams.get(name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function isMergeSimulationStatus(value: unknown): value is MergeSimulationStatus {
  return value === "clean" || value === "text_conflict" || value === "failed" || value === "unavailable";
}

function isMergeQueueHoldKind(value: unknown): value is MergeQueueHoldKind {
  return value === "conflict_risk" ||
    value === "dry_run_failed" ||
    value === "validation_missing" ||
    value === "approval_missing" ||
    value === "workspace_not_ready" ||
    value === "branch_lease_expired" ||
    value === "edit_overlap" ||
    value === "policy_denied" ||
    value === "human_review_required";
}

function isMergeQueueHoldSeverity(value: unknown): value is MergeQueueHoldSeverity {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

function mergeQueuePolicyContextFromInput(
  requestContext: ReturnType<ApiRequestContextMiddleware["requireApiContext"]>,
  body: Record<string, unknown> = {}
): MergeQueuePolicyContext {
  const metadata = recordValue(body.metadata);
  return {
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
    actorId: stringValue(body.actorId) ?? requestContext.authContext.actor.id,
    serviceAccountId: stringValue(body.serviceAccountId) ?? stringValue((requestContext.authContext.actor as { serviceAccountId?: unknown }).serviceAccountId),
    validationStatus: mergeQueueEvidenceStatus(body.validationStatus ?? metadata.validationStatus),
    approvalStatus: mergeQueueEvidenceStatus(body.approvalStatus ?? metadata.approvalStatus),
    humanPriority: finiteNumber(body.humanPriority ?? metadata.humanPriority),
    releaseBlocker: body.releaseBlocker === true || metadata.releaseBlocker === true,
    metadata: {
      ...metadata,
      source: metadata.source ?? "api",
      authMode: requestContext.authContext.authMode,
      principalId: requestContext.authContext.principal.id
    }
  };
}

function conflictResolutionAssistantContextFromInput(
  requestContext: ReturnType<ApiRequestContextMiddleware["requireApiContext"]>,
  body: Record<string, unknown> = {}
): ConflictResolutionRequestContext {
  const metadata = recordValue(body.metadata);
  return {
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
    actorId: stringValue(body.actorId) ?? requestContext.authContext.actor.id,
    principalId: requestContext.authContext.principal.id,
    serviceAccountId: stringValue(body.serviceAccountId) ?? stringValue((requestContext.authContext.actor as { serviceAccountId?: unknown }).serviceAccountId),
    source: stringValue(body.source) ?? stringValue(metadata.source) ?? "api_conflict_resolution_assistant",
    metadata: {
      ...metadata,
      authMode: requestContext.authContext.authMode,
      metadataOnly: true,
      noSourceMutation: true,
      noRealMerge: true,
      noExternalLlmCall: true
    }
  };
}

function prOwnershipContextFromInput(
  requestContext: ReturnType<ApiRequestContextMiddleware["requireApiContext"]>,
  body: Record<string, unknown> = {}
): PrOwnershipContext {
  const metadata = recordValue(body.metadata);
  const serviceAccountId = stringValue(body.serviceAccountId) ?? stringValue(requestContext.authContext.metadata.serviceAccountId);
  return {
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
    actorId: stringValue(body.actorId) ?? requestContext.authContext.actor.id,
    principalId: requestContext.authContext.principal.id,
    serviceAccountId,
    source: stringValue(body.source) ?? stringValue(metadata.source) ?? "api_pr_ownership_handoff",
    actorKind: stringValue(body.actorKind) ?? requestContext.authContext.actor.actorKind,
    roles: requestContext.authContext.roles.map((role) => role.name),
    teams: requestContext.authContext.teams?.map((team) => team.id),
    metadata: {
      ...metadata,
      authMode: requestContext.authContext.authMode,
      metadataOnly: true,
      remotePrUpdate: false,
      remoteReviewerAssignment: false,
      noGitHubApiCall: true,
      noAutoMerge: true,
      noBranchDeletion: true
    }
  };
}

function realMergeExecutionContextFromInput(
  requestContext: ReturnType<ApiRequestContextMiddleware["requireApiContext"]>,
  body: Record<string, unknown> = {}
): RealMergeExecutionContext {
  const metadata = recordValue(body.metadata);
  const serviceAccountId = stringValue(body.serviceAccountId) ?? stringValue(requestContext.authContext.metadata.serviceAccountId);
  return {
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
    actorId: stringValue(body.actorId) ?? requestContext.authContext.actor.id,
    principalId: requestContext.authContext.principal.id,
    serviceAccountId,
    source: stringValue(body.source) ?? stringValue(metadata.source) ?? "api_real_merge_execution_policy",
    roles: requestContext.authContext.roles.map((role) => role.name),
    teams: requestContext.authContext.teams?.map((team) => team.id),
    validationStatus: realMergeEvidenceStatus(body.validationStatus ?? metadata.validationStatus),
    approvalStatus: realMergeEvidenceStatus(body.approvalStatus ?? metadata.approvalStatus),
    rollbackPlanStatus: realMergeEvidenceStatus(body.rollbackPlanStatus ?? metadata.rollbackPlanStatus),
    tenantScopeStatus: realMergeTenantScopeStatus(body.tenantScopeStatus ?? metadata.tenantScopeStatus),
    metadata: {
      ...metadata,
      authMode: requestContext.authContext.authMode,
      metadataOnly: true,
      mergeExecutionEnabled: false,
      autoMergeEnabled: false,
      remotePushEnabled: false,
      noRealMerge: true,
      noAutoMerge: true,
      noRemoteGit: true,
      noBranchDeletion: true,
      noWorkspaceMutation: true,
      noGitHubApiCall: true
    }
  };
}

function realMergeEvidenceStatus(value: unknown): RealMergeEvidenceStatus | undefined {
  return value === "passed" ||
    value === "approved" ||
    value === "not_required" ||
    value === "pending" ||
    value === "failed" ||
    value === "rejected" ||
    value === "missing"
    ? value
    : undefined;
}

function realMergeTenantScopeStatus(value: unknown): RealMergeExecutionContext["tenantScopeStatus"] {
  return value === "match" ||
    value === "mismatch" ||
    value === "unknown" ||
    value === "not_applicable"
    ? value
    : undefined;
}

function isPrOwnerKind(value: unknown): value is PrOwnerKind {
  return value === "human" || value === "agent" || value === "service_account" || value === "team" || value === "unknown";
}

function isPrOwnershipStatus(value: unknown): value is PrOwnershipStatus {
  return value === "active" ||
    value === "review_requested" ||
    value === "handoff_requested" ||
    value === "handed_off" ||
    value === "blocked" ||
    value === "abandoned" ||
    value === "merged" ||
    value === "closed_future";
}

function isPrHandoffKind(value: unknown): value is PrHandoffKind {
  return value === "human_to_human" ||
    value === "agent_to_human" ||
    value === "human_to_agent_future" ||
    value === "service_to_human" ||
    value === "team_handoff";
}

function isPrHandoffStatus(value: unknown): value is PrHandoffStatus {
  return value === "requested" ||
    value === "accepted" ||
    value === "rejected" ||
    value === "expired" ||
    value === "cancelled" ||
    value === "blocked_policy" ||
    value === "blocked_missing_context";
}

function isPrHandoffDecisionValue(value: unknown): value is PrHandoffDecisionValue {
  return value === "accept" ||
    value === "reject" ||
    value === "hold" ||
    value === "request_more_info" ||
    value === "expired" ||
    value === "blocked";
}

function isAgentWorktreeAllocationMode(value: unknown): value is AgentWorktreeAllocationMode {
  return value === "fixture_only" || value === "dry_run" || value === "git_worktree_future";
}

function isAgentWorktreeAllocationDecision(value: unknown): value is AgentWorktreeAllocationDecision {
  return value === "allocated_fixture" ||
    value === "dry_run_valid" ||
    value === "blocked_root_not_allowed" ||
    value === "blocked_path_collision" ||
    value === "blocked_branch_missing" ||
    value === "blocked_policy" ||
    value === "future_git_worktree_required";
}

function isAgentWorktreeSafetyStatus(value: unknown): value is AgentWorktreeSafetyStatus {
  return value === "pass" || value === "warning" || value === "fail" || value === "not_applicable";
}

function isAgentWorktreeSafetyCheckKind(value: unknown): value is AgentWorktreeSafetyCheckKind {
  return value === "workspace_root_allowed" ||
    value === "path_within_root" ||
    value === "path_not_shared" ||
    value === "branch_lease_present" ||
    value === "branch_name_safe" ||
    value === "no_remote_git" ||
    value === "cleanup_safe" ||
    value === "fixture_only";
}

function agentWorktreeAllocationStatusCode(decision: AgentWorktreeAllocationDecision): number {
  return decision === "allocated_fixture" || decision === "dry_run_valid" ? 201 : 409;
}

function agentWorktreeAllocationContextFromInput(
  requestContext: ReturnType<ApiRequestContextMiddleware["requireApiContext"]>,
  body: Record<string, unknown> = {}
) {
  const metadata = recordValue(body.metadata);
  return {
    actorId: stringValue(body.actorId) ?? requestContext.authContext.actor.id,
    principalId: requestContext.authContext.principal.id,
    serviceAccountId: stringValue(body.serviceAccountId) ?? stringValue((requestContext.authContext.actor as { serviceAccountId?: unknown }).serviceAccountId),
    requestId: requestContext.requestId,
    correlationId: requestContext.correlationId,
    source: stringValue(body.source) ?? stringValue(metadata.source) ?? "api_agent_worktree_allocation",
    metadata: {
      ...metadata,
      authMode: requestContext.authContext.authMode,
      metadataOnly: true,
      noRealGitWorktree: true,
      noRemoteGit: true,
      noDestructiveCleanup: true
    }
  };
}

function mergeQueueEvidenceStatus(value: unknown): MergeQueuePolicyContext["validationStatus"] {
  if (value === "passed" ||
    value === "approved" ||
    value === "not_required" ||
    value === "pending" ||
    value === "failed" ||
    value === "rejected" ||
    value === "missing") {
    return value;
  }
  return undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isAgentWorkspaceKind(value: unknown): value is AgentWorkspaceKind {
  return value === "fixture" ||
    value === "git_worktree_future" ||
    value === "clone_future" ||
    value === "remote_workspace_future";
}

function isAgentWorkspaceLifecycleStatus(value: unknown): value is AgentWorkspaceLifecycleStatus {
  return value === "requested" ||
    value === "allocated" ||
    value === "active" ||
    value === "frozen" ||
    value === "ready_for_merge" ||
    value === "merged" ||
    value === "abandoned" ||
    value === "cleanup_pending" ||
    value === "cleaned" ||
    value === "failed";
}

function isAgentWorkspaceMergeStatus(value: unknown): value is AgentWorkspaceMergeStatus {
  return value === "unknown" || value === "ready_for_merge" || value === "merged" || value === "unmerged";
}

function isAgentSessionStatus(value: unknown): value is AgentSessionStatus {
  return value === "requested" ||
    value === "assigned" ||
    value === "running" ||
    value === "paused" ||
    value === "waiting_on_conflict" ||
    value === "ready_for_review" ||
    value === "ready_for_merge" ||
    value === "completed" ||
    value === "failed" ||
    value === "abandoned";
}

function isAgentSessionOverlapSeverity(value: unknown): value is AgentSessionOverlapSeverity {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

function isAgentSessionSourceScopeKind(value: unknown): value is AgentSessionSourceScopeKind {
  return value === "repo" || value === "directory" || value === "file" || value === "symbol" || value === "unknown";
}

function isBranchPurpose(value: unknown): value is BranchPurpose {
  return value === "agent_work" ||
    value === "conflict_resolution" ||
    value === "review_fixup" ||
    value === "merge_candidate" ||
    value === "experiment";
}

function isBranchOwnershipStatus(value: unknown): value is BranchOwnershipStatus {
  return value === "active" ||
    value === "frozen" ||
    value === "ready_for_review" ||
    value === "ready_for_merge" ||
    value === "merged" ||
    value === "abandoned" ||
    value === "expired";
}

function isBranchOrchestrationDecision(value: unknown): value is BranchOrchestrationDecisionValue {
  return value === "allocated" ||
    value === "reused_existing_lease" ||
    value === "blocked_collision" ||
    value === "blocked_policy" ||
    value === "blocked_same_workspace" ||
    value === "warning_base_branch_drift" ||
    value === "future_manual_review";
}

function isBaseBranchDriftStatus(value: unknown): value is BaseBranchDriftStatusValue {
  return value === "current" ||
    value === "behind_base" ||
    value === "base_changed" ||
    value === "unknown" ||
    value === "future_check_required";
}

function isFileLeaseKind(value: unknown): value is FileLeaseKind {
  return value === "read" || value === "write_intent" || value === "exclusive_write_future" || value === "review";
}

function isFileLeaseStatus(value: unknown): value is FileLeaseStatus {
  return value === "requested" ||
    value === "active" ||
    value === "warning_overlap" ||
    value === "blocked_overlap" ||
    value === "released" ||
    value === "expired";
}

function isEditIntentKind(value: unknown): value is EditIntentKind {
  return value === "modify" ||
    value === "create" ||
    value === "delete_future" ||
    value === "rename_future" ||
    value === "read_only" ||
    value === "refactor" ||
    value === "test_update" ||
    value === "docs_update";
}

function isEditIntentStatus(value: unknown): value is EditIntentStatus {
  return value === "declared" ||
    value === "active" ||
    value === "completed" ||
    value === "abandoned" ||
    value === "expired";
}

function isEditIntentConfidence(value: unknown): value is EditIntentConfidence {
  return value === "low" || value === "medium" || value === "high";
}

function isEditOverlapSeverity(value: unknown): value is EditOverlapSeverity {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

function isEditOverlapRecommendation(value: unknown): value is EditOverlapRecommendation {
  return value === "allow" ||
    value === "warn" ||
    value === "serialize" ||
    value === "split_files" ||
    value === "require_review" ||
    value === "block";
}

function isEditOverlapKind(value: unknown): value is EditOverlapKind {
  return value === "same_file" ||
    value === "same_directory" ||
    value === "same_branch" ||
    value === "same_workspace" ||
    value === "same_symbol_future" ||
    value === "broad_unknown";
}

function allowedLocalRepoPrefixes(env: Record<string, string | undefined> = process.env): string[] {
  return (env.AICHESTRA_ALLOWED_REPO_PATHS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry));
}

function isRepoPathAllowlisted(repoPath: string, prefixes = allowedLocalRepoPrefixes()): boolean {
  const resolved = path.resolve(repoPath);
  return prefixes.some((prefix) => resolved === prefix || resolved.startsWith(`${prefix}${path.sep}`));
}

function isRegistryTargetKind(value: unknown): value is "skill" | "harness" | "instruction" {
  return value === "skill" || value === "harness" || value === "instruction";
}

function isValidEvalResultPayload(body: Record<string, unknown>): boolean {
  return typeof body.evalName === "string" &&
    isRegistryEvalResultType(body.evalType) &&
    isRegistryEvalResultStatus(body.status) &&
    typeof body.summary === "string" &&
    isRegistryEvalResultSource(body.source);
}

function registryRefValue(value: unknown, fallbackKind: RegistryVersionRef["kind"], fallbackName: string): RegistryVersionRef {
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (isRegistryTargetKind(record.kind) && typeof record.name === "string" && typeof record.version === "string") {
      return {
        kind: record.kind,
        name: record.name,
        version: record.version,
        versionRange: typeof record.versionRange === "string" ? record.versionRange : undefined,
        id: typeof record.id === "string" ? record.id : undefined,
        checksum: typeof record.checksum === "string" ? record.checksum : undefined
      };
    }
  }
  return {
    kind: fallbackKind,
    name: fallbackName,
    version: "1.0.0"
  };
}

function registryRefsValue(value: unknown, fallbackKind: RegistryVersionRef["kind"], fallbackName: string): RegistryVersionRef[] {
  if (!Array.isArray(value)) return [registryRefValue(undefined, fallbackKind, fallbackName)];
  const refs = value.map((item) => registryRefValue(item, fallbackKind, fallbackName));
  return refs.length > 0 ? refs : [registryRefValue(undefined, fallbackKind, fallbackName)];
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const stagingSignoffRoles: StagingReleaseCandidateSignoffRole[] = [
  "engineering_owner",
  "platform_owner",
  "security_reviewer",
  "product_owner",
  "qa_reviewer",
  "release_manager"
];

const stagingSignoffEvidencePaths = [
  "docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md",
  "docs/roadmaps/staging-deployment-execution/signoff-evidence-checklist-v0.md",
  "docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md",
  stagingSignoffScopeEvidencePath,
  "docs/audits/2026-05-14-staging-go-no-go-audit-v0.md",
  "docs/audits/2026-05-14-staging-release-candidate-audit-v0-rerun.md",
  "docs/audits/staging-rc-evidence-pack-v0.md",
  "docs/roadmaps/staging-release-candidate/release-notes-draft-v0.md",
  "docs/roadmaps/staging-release-candidate/rollback-evidence-v0.md",
  "docs/roadmaps/staging-deployment-execution/v0.md"
];

function stagingSignoffRoleValue(value: unknown): StagingReleaseCandidateSignoffRole | undefined {
  return stagingSignoffRoles.includes(value as StagingReleaseCandidateSignoffRole)
    ? value as StagingReleaseCandidateSignoffRole
    : undefined;
}

function stagingHumanSignoffStatusValue(value: unknown): StagingHumanSignoffStatus | undefined {
  return value === "approved" || value === "rejected" || value === "conditionally_approved" ? value : undefined;
}

function textArrayFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string" && value.trim().length > 0) return [value];
  return [];
}

function stagingHumanSignoffEvidenceFromBody(
  body: Record<string, unknown>,
  submittedAt: Date,
  currentScope: StagingSignoffScopeSnapshot
): { ok: true; evidence: StagingHumanSignoffEvidence } | { ok: false; error: string; message: string } {
  const role = stagingSignoffRoleValue(body.role);
  const status = stagingHumanSignoffStatusValue(body.status);
  if (!role) return { ok: false, error: "invalid_signoff_role", message: "role must be a required staging signoff role." };
  if (!status) return { ok: false, error: "invalid_signoff_status", message: "status must be approved, rejected, or conditionally_approved." };
  const reviewedEvidence = textArrayFromUnknown(body.reviewedEvidence);
  return {
    ok: true,
    evidence: {
      role,
      required: true,
      status,
      approverName: stringValue(body.approverName),
      approverContact: stringValue(body.approverContact),
      signedAt: stringValue(body.signedAt) ?? submittedAt.toISOString(),
      reviewedEvidence: reviewedEvidence.length > 0 ? reviewedEvidence : stagingSignoffEvidencePaths,
      reviewedCommitSha: currentScope.reviewedCommitSha,
      reviewedBranch: currentScope.reviewedBranch,
      reviewedScopeMethod: currentScope.reviewedScopeMethod,
      reviewedDiffScope: currentScope.reviewedDiffScope,
      scopeCapturedAt: currentScope.scopeCapturedAt,
      scopeEvidencePath: currentScope.scopeEvidencePath,
      validationEvidencePaths: currentScope.validationEvidencePaths,
      conditions: textArrayFromUnknown(body.conditions),
      notes: stringValue(body.notes),
      signatureMethod: stringValue(body.signatureMethod) ?? "typed_name",
      evidenceSource: stringValue(body.evidenceSource) ?? "staging_signoff_collection_ui",
      metadata: {
        submittedAt: submittedAt.toISOString(),
        submittedVia: "staging_signoff_collection_ui",
        localOnly: true,
        identityVerified: false,
        productionAuthImplemented: false,
        actualDeploymentAuthorized: false
      }
    }
  };
}

function policyActorKindValue(value: unknown): PolicyActorKind | undefined {
  return value === "user" ||
    value === "team" ||
    value === "system" ||
    value === "service" ||
    value === "human_user" ||
    value === "service_account" ||
    value === "local_agent" ||
    value === "external_integration" ||
    value === "anonymous_mock"
    ? value
    : undefined;
}

function requestSourceValue(value: unknown): RequestSource | undefined {
  return value === "api" || value === "worker" || value === "dashboard" || value === "readiness" || value === "test" || value === "system" || value === "webhook" || value === "local_agent"
    ? value
    : undefined;
}

function resourceScopeValue(value: unknown): ResourceScope | undefined {
  const record = recordValue(value);
  const scopeKind = record.scopeKind;
  if (
    scopeKind !== "global" &&
    scopeKind !== "org" &&
    scopeKind !== "team" &&
    scopeKind !== "repo" &&
    scopeKind !== "project" &&
    scopeKind !== "task" &&
    scopeKind !== "registry" &&
    scopeKind !== "provider" &&
    scopeKind !== "local_agent"
  ) {
    return undefined;
  }
  return {
    id: stringValue(record.id) ?? `${scopeKind}:${stringValue(record.scopeId) ?? "global"}`,
    scopeKind,
    scopeId: stringValue(record.scopeId),
    description: stringValue(record.description) ?? "API authorization check scope",
    metadata: recordValue(record.metadata)
  };
}

function authorizationResourceFromBody(body: Record<string, unknown>): AuthorizationResource | undefined {
  const resourceRecord = recordValue(body.resource);
  const resourceKind = stringValue(resourceRecord.resourceKind) ?? stringValue(body.resourceKind);
  if (!resourceKind) return undefined;
  return {
    resourceKind,
    resourceId: stringValue(resourceRecord.resourceId) ?? stringValue(body.resourceId),
    scope: resourceScopeValue(resourceRecord.scope ?? body.scope),
    metadata: recordValue(resourceRecord.metadata ?? body.metadata)
  };
}

function secretProviderKindValue(value: unknown): SecretProviderKind | undefined {
  return value === "mock" ||
    value === "env" ||
    value === "vault" ||
    value === "vault_future" ||
    value === "aws_secrets_manager_future" ||
    value === "gcp_secret_manager_future" ||
    value === "azure_key_vault_future" ||
    value === "env_future"
    ? value
    : undefined;
}

function secretKindValue(value: unknown): SecretKind | undefined {
  return value === "mock_metadata" ||
    value === "github_token" ||
    value === "github_app_private_key" ||
    value === "github_webhook_secret" ||
    value === "llm_api_key" ||
    value === "provider_api_key" ||
    value === "webhook_secret" ||
    value === "future_oauth_token" ||
    value === "future_cloud_identity"
    ? value
    : undefined;
}

function secretRefStatusValue(value: unknown): SecretRefStatus | undefined {
  return value === "active" || value === "disabled" || value === "revoked" ? value : undefined;
}

function credentialPurposeValue(value: unknown): "github_api_call" | "github_app_private_key_signing" | "github_webhook_verification" | "llm_api_call" | "provider_api_call" | "webhook_verification_future" | undefined {
  return value === "github_api_call" ||
    value === "github_app_private_key_signing" ||
    value === "github_webhook_verification" ||
    value === "llm_api_call" ||
    value === "provider_api_call" ||
    value === "webhook_verification_future"
    ? value
    : undefined;
}

function githubInstallationTokenPurposeValue(value: unknown): "branch_create" | "pr_create" | "pr_read" | "changed_files_read" | "webhook_sync" | undefined {
  return value === "branch_create" ||
    value === "pr_create" ||
    value === "pr_read" ||
    value === "changed_files_read" ||
    value === "webhook_sync"
    ? value
    : undefined;
}

function mcpInvocationStatusCode(status: MCPToolInvocationStatus): number {
  if (status === "completed") return 200;
  if (status === "unavailable") return 409;
  return 403;
}

function llmPromptClassValue(value: unknown): "code_generation" | "code_review" | "conflict_resolution" | "registry_review" | "summarization" | "general" | "unknown" | undefined {
  return value === "code_generation" ||
    value === "code_review" ||
    value === "conflict_resolution" ||
    value === "registry_review" ||
    value === "summarization" ||
    value === "general" ||
    value === "unknown"
    ? value
    : undefined;
}

function containsRawSecretField(body: Record<string, unknown>): boolean {
  return Object.entries(body).some(([key, value]) => {
    if (/^(value|secretValue|rawSecret|token|apiKey|credentialValue|password)$/i.test(key)) {
      return value !== undefined && value !== null && String(value).length > 0;
    }
    return typeof value === "string" && (/sk-[A-Za-z0-9_-]{8,}/.test(value) || /ghp_[A-Za-z0-9_]{8,}/.test(value) || /github_pat_[A-Za-z0-9_]{8,}/.test(value) || /Bearer\s+[A-Za-z0-9._~+/=-]+/i.test(value) || /[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*[^\s]+/i.test(value) || /~\/\.codex\/auth\.json|~\/\.claude/i.test(value));
  });
}

function scopeFilesHtml(files: string[]): string {
  if (files.length === 0) return "<span>none</span>";
  return `<ul>${files.map((file) => `<li><code>${htmlValue(file)}</code></li>`).join("")}</ul>`;
}

function scopeRoleStatus(role: StagingReleaseCandidateSignoffRole, review: StagingSignoffScopeReview): string {
  if (review.rejectedRoles.includes(role)) return "rejected";
  if (review.staleRoles.includes(role)) return "stale";
  if (review.pendingRoles.includes(role)) return "pending";
  return "matched";
}

function isLocalAgentConsentLevel(value: unknown): value is "read_only" | "workspace_write" | "shell_execution" | "network_or_secret_access" | "danger_full_access" {
  return value === "read_only" ||
    value === "workspace_write" ||
    value === "shell_execution" ||
    value === "network_or_secret_access" ||
    value === "danger_full_access";
}

function isLocalAgentRegistrationStatus(value: unknown): value is "pending" | "connected" | "disconnected" | "revoked" | "unknown" {
  return value === "pending" || value === "connected" || value === "disconnected" || value === "revoked" || value === "unknown";
}

function isLocalAgentConsentDecision(value: unknown): value is "approved" | "approved_once" | "approved_for_session" | "denied" | "expired" {
  return value === "approved" || value === "approved_once" || value === "approved_for_session" || value === "denied" || value === "expired";
}

function isLocalAgentChannelKind(value: unknown): value is "mock_in_memory" | "future_websocket" | "future_grpc" | "future_http_tunnel" {
  return value === "mock_in_memory" || value === "future_websocket" || value === "future_grpc" || value === "future_http_tunnel";
}

function isProviderParserMode(value: unknown): value is "raw" | "json" | "jsonl" | "ndjson" {
  return value === "raw" || value === "json" || value === "jsonl" || value === "ndjson";
}

function parserModeArrayValue(value: unknown): Array<"raw" | "json" | "jsonl" | "ndjson"> | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isProviderParserMode);
}

function consentLevelArrayValue(value: unknown): Array<"read_only" | "workspace_write" | "shell_execution" | "network_or_secret_access" | "danger_full_access"> | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isLocalAgentConsentLevel);
}

function sendLocalAgentProtocolError(response: ServerResponse, error: unknown): void {
  if (error instanceof LocalAgentProtocolError) {
    const statusCode = error.code.includes("not_found") ? 404 : error.code.startsWith("invalid_") ? 400 : 409;
    sendJson(response, statusCode, { error: error.code, message: error.message });
    return;
  }
  sendJson(response, 400, { error: "local_agent_protocol_error", message: error instanceof Error ? error.message : "Local Agent Protocol error." });
}

function renderStagingSignoffCollectionHtml(
  readiness: DeploymentReadinessService,
  currentScope: StagingSignoffScopeSnapshot,
  scopeReview: StagingSignoffScopeReview,
  message?: { kind: "ok" | "error"; text: string }
): string {
  const summary = readiness.getStagingDeploymentExecutionSummary();
  const decision = readiness.getStagingDeploymentGoNoGoDecision();
  const evidenceByRole = new Map(readiness.listStagingHumanSignoffEvidence().map((evidence) => [evidence.role, evidence]));
  const rows = stagingSignoffRoles.map((role) => {
    const evidence = evidenceByRole.get(role);
    return `<tr>
      <td><code>${htmlValue(role)}</code></td>
      <td>${htmlValue(evidence?.status ?? "pending")}</td>
      <td>${htmlValue(evidence?.approverName, "")}</td>
      <td>${htmlValue(evidence?.signedAt, "")}</td>
      <td>${htmlValue(scopeRoleStatus(role, scopeReview))}</td>
      <td>${htmlValue(evidence?.signatureMethod, "")}</td>
      <td>${htmlValue(evidence?.notes, "")}</td>
    </tr>`;
  }).join("");
  const evidenceChecks = stagingSignoffEvidencePaths.map((path) =>
    `<label class="check"><input type="checkbox" name="reviewedEvidence" value="${htmlValue(path)}" checked> <span>${htmlValue(path)}</span></label>`
  ).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Staging Human Signoff Collection</title>
  <style>
    :root { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #171a20; background: #f6f7fa; }
    body { margin: 0; }
    header { background: #ffffff; border-bottom: 1px solid #d9dee8; }
    main, .topbar { width: min(1120px, calc(100vw - 32px)); margin: 0 auto; }
    .topbar { min-height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    nav { display: flex; gap: 14px; font-size: 14px; }
    a { color: #1b5d8f; text-decoration: none; }
    main { padding: 28px 0 42px; }
    h1 { margin: 0 0 18px; font-size: 28px; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 18px; letter-spacing: 0; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
    .metric, .panel { background: #ffffff; border: 1px solid #d9dee8; border-radius: 8px; }
    .metric { padding: 14px; }
    .label { color: #596372; font-size: 13px; margin-bottom: 7px; }
    .value { font-size: 24px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr); gap: 16px; align-items: start; }
    .panel { padding: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #edf0f5; vertical-align: top; }
    th { color: #596372; font-weight: 600; }
    form { display: grid; gap: 12px; }
    label { display: grid; gap: 6px; color: #313844; font-size: 14px; }
    input, select, textarea { width: 100%; box-sizing: border-box; border: 1px solid #c9d1dc; border-radius: 6px; padding: 9px 10px; font: inherit; background: #ffffff; }
    textarea { min-height: 86px; resize: vertical; }
    button { border: 0; border-radius: 6px; background: #1f6f55; color: #ffffff; font-weight: 700; padding: 10px 14px; cursor: pointer; }
    .check { grid-template-columns: 20px minmax(0, 1fr); align-items: start; gap: 8px; color: #48505d; }
    .check input { width: 16px; margin-top: 2px; }
    .notice { margin-bottom: 16px; border-radius: 8px; padding: 12px 14px; border: 1px solid #d9dee8; background: #ffffff; }
    .notice.ok { border-color: #b8d9ca; background: #edf8f2; }
    .notice.error { border-color: #efb8b8; background: #fff0f0; }
    .safety { color: #596372; line-height: 1.45; }
    code { overflow-wrap: anywhere; }
    .scope-lists { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 12px; }
    .scope-lists ul { margin: 0; padding-left: 18px; color: #313844; }
    @media (max-width: 860px) { .metrics, .grid, .scope-lists { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <div class="topbar">
      <strong>Aichestra</strong>
      <nav>
        <a href="/dashboard/staging-execution">Dashboard read model</a>
        <a href="/readiness/staging-execution/summary">Summary JSON</a>
      </nav>
    </div>
  </header>
  <main>
    <h1>Staging Human Signoff Collection</h1>
    ${message ? `<div class="notice ${htmlValue(message.kind)}">${htmlValue(message.text)}</div>` : ""}
    <div class="metrics">
      <div class="metric"><div class="label">Decision</div><div class="value">${htmlValue(summary.goNoGoStatus)}</div></div>
      <div class="metric"><div class="label">Pending</div><div class="value">${htmlValue(summary.pendingSignoffCount)}</div></div>
      <div class="metric"><div class="label">Approved</div><div class="value">${htmlValue(summary.approvedSignoffCount)}</div></div>
      <div class="metric"><div class="label">Rejected</div><div class="value">${htmlValue(summary.rejectedSignoffCount)}</div></div>
    </div>
    <section class="panel" style="margin-bottom:16px">
      <h2>Current Repository Scope</h2>
      <div class="safety">
        HEAD=<code>${htmlValue(currentScope.reviewedCommitSha)}</code> /
        branch=<code>${htmlValue(currentScope.reviewedBranch)}</code> /
        worktree=${htmlValue(currentScope.reviewedDiffScope.worktreeStatus)} /
        reviewedScopeMethod=${htmlValue(currentScope.reviewedScopeMethod)} /
        scopeCapturedAt=${htmlValue(currentScope.scopeCapturedAt)} /
        scopeRevalidation=${htmlValue(scopeReview.status)}
      </div>
      <div class="scope-lists">
        <div><div class="label">Modified files</div>${scopeFilesHtml(currentScope.reviewedDiffScope.modifiedFiles)}</div>
        <div><div class="label">Untracked files</div>${scopeFilesHtml(currentScope.reviewedDiffScope.untrackedFiles)}</div>
      </div>
    </section>
    <div class="grid">
      <section class="panel">
        <h2>Required Roles</h2>
        <table>
          <thead><tr><th>Role</th><th>Status</th><th>Approver</th><th>Timestamp</th><th>Scope</th><th>Signature</th><th>Notes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
      <section class="panel">
        <h2>Record Signoff</h2>
        <form method="post" action="/staging/signoffs/evidence">
          <label>Role
            <select name="role" required>
              ${stagingSignoffRoles.map((role) => `<option value="${htmlValue(role)}">${htmlValue(role)}</option>`).join("")}
            </select>
          </label>
          <label>Decision
            <select name="status" required>
              <option value="approved">Approve</option>
              <option value="rejected">Reject</option>
              <option value="conditionally_approved">Conditionally approve</option>
            </select>
          </label>
          <label>Approver name<input name="approverName" autocomplete="name" required></label>
          <label>Approver contact<input name="approverContact" autocomplete="email"></label>
          <label>Signature method
            <select name="signatureMethod" required>
              <option value="typed_name">Typed name</option>
              <option value="ticket_comment">Ticket comment</option>
              <option value="meeting_record">Meeting record</option>
              <option value="email_approval">Email approval</option>
              <option value="other_recorded_method">Other recorded method</option>
            </select>
          </label>
          <label>Conditions<textarea name="conditions"></textarea></label>
          <label>Notes / rejection reason<textarea name="notes"></textarea></label>
          <div>
            <div class="label">Reviewed evidence</div>
            ${evidenceChecks}
          </div>
          <button type="submit">Record signoff</button>
        </form>
      </section>
    </div>
    <section class="panel" style="margin-top:16px">
      <h2>Safety State</h2>
      <div class="safety">
        actualDeploymentBlocked=${htmlValue(summary.actualDeploymentBlocked)} /
        productionReady=${htmlValue(summary.productionReady)} /
        stagingDeployed=${htmlValue(summary.stagingDeployed)} /
        deploymentExecuted=${htmlValue(summary.deploymentExecuted)} /
        scopeRevalidation=${htmlValue(scopeReview.status)} /
        approvalAuditCanPass=${htmlValue(scopeReview.approvalAuditCanPass)} /
        approvalAuditRequired=${htmlValue(summary.metadata.approvalAuditRequired, "true")} /
        blockers=${htmlValue(decision.blockers)}
      </div>
    </section>
  </main>
</body>
</html>`;
}

function policyEvaluationRequestFromBody(body: Record<string, unknown>) {
  const action = body.action;
  const subjectRecord = recordValue(body.subject);
  const resourceRecord = recordValue(body.resource);
  const contextRecord = recordValue(body.context);
  const resourceKind = resourceRecord.resourceKind ?? body.resourceKind;
  if (!isPolicyAction(action)) {
    return { ok: false as const, error: "invalid_policy_action", message: "action must be a valid policy action." };
  }
  if (!isPolicyResourceKind(resourceKind)) {
    return { ok: false as const, error: "invalid_policy_resource_kind", message: "resource.resourceKind must be a valid policy resource kind." };
  }
  const actorKind = policyActorKindValue(subjectRecord.actorKind);
  if (subjectRecord.actorKind !== undefined && actorKind === undefined) {
    return { ok: false as const, error: "invalid_policy_actor_kind", message: "subject.actorKind must be a valid policy actor kind." };
  }
  return {
    ok: true as const,
    request: {
      subject: createPolicySubject({
        actorId: stringValue(subjectRecord.actorId),
        principalId: stringValue(subjectRecord.principalId),
        actorKind,
        roles: stringArrayValue(subjectRecord.roles),
        teams: stringArrayValue(subjectRecord.teams),
        authMode: stringValue(subjectRecord.authMode),
        serviceAccountId: stringValue(subjectRecord.serviceAccountId),
        isMockActor: subjectRecord.isMockActor === true,
        metadata: recordValue(subjectRecord.metadata)
      }),
      action,
      resource: createPolicyResource({
        resourceKind,
        resourceId: stringValue(resourceRecord.resourceId),
        metadata: recordValue(resourceRecord.metadata)
      }),
      context: createPolicyContext({
        taskId: stringValue(contextRecord.taskId),
        taskRunId: stringValue(contextRecord.taskRunId),
        repoId: stringValue(contextRecord.repoId),
        branchName: stringValue(contextRecord.branchName),
        modelId: stringValue(contextRecord.modelId),
        providerKind: stringValue(contextRecord.providerKind),
        runnerKind: stringValue(contextRecord.runnerKind),
        command: stringValue(contextRecord.command),
        skillRefs: Array.isArray(contextRecord.skillRefs) ? contextRecord.skillRefs : undefined,
        harnessRef: contextRecord.harnessRef,
        instructionRefs: Array.isArray(contextRecord.instructionRefs) ? contextRecord.instructionRefs : undefined,
        riskScore: typeof contextRecord.riskScore === "number" ? contextRecord.riskScore : undefined,
        environment: recordValue(contextRecord.environment),
        metadata: recordValue(contextRecord.metadata)
      })
    }
  };
}

async function handleRequest(request: IncomingMessage, response: ServerResponse, context: RouteContext): Promise<void> {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean);
    const method = request.method ?? "GET";
    const store = context.store;
    const registryService = context.registryService;
    const improvementServices = context.improvementServices;
    const apiRequestContext = context.apiRequestContextMiddleware.resolveApiContext(request, {
      route: url.pathname,
      method,
      metadata: { apiIngress: true }
    });

    if (method === "GET" && url.pathname === "/health") {
      const storage = await context.storageProvider.healthCheck();
      const databaseOperations = context.deploymentReadinessService.getDatabaseOperationsSummary();
      const secretBackendMigration = context.deploymentReadinessService.getSecretBackendMigrationSummary();
      const secretBackendDecision = context.deploymentReadinessService.getSecretBackendOptionDecisionSummary();
      const authRbacProduction = context.deploymentReadinessService.getAuthRbacProductionSummary();
      const productionAuthProvider = context.deploymentReadinessService.getProductionAuthProviderSkeletonSummary();
      const oidcProviderSkeleton = buildOidcProviderSkeletonSummary(process.env);
      const oidcProviderConfig = buildOidcProviderConfig(process.env);
      const oidcDiscovery = buildOidcDiscoveryReadiness(process.env);
      const oidcJwks = buildOidcJwksReadiness(process.env);
      const oidcClaimsMapping = buildOidcClaimsMappingPlan(process.env);
      const oidcTokenBoundary = buildOidcTokenValidationBoundary(process.env);
      const policyBundleReadiness = context.deploymentReadinessService.getPolicyBundleReadinessSummary();
      const policyShadowEvaluation = context.deploymentReadinessService.getPolicyShadowEvaluationSummary();
      const policyRuntimePoc = context.deploymentReadinessService.getPolicyRuntimePocSummary();
      const stagingDeployment = context.deploymentReadinessService.getStagingDeploymentSummary();
      const stagingDryRun = context.deploymentReadinessService.getStagingDeploymentDryRunSummary();
      const stagingReleaseCandidate = context.deploymentReadinessService.getStagingReleaseCandidateSummary();
      const stagingExecution = context.deploymentReadinessService.getStagingDeploymentExecutionSummary();
      const cicdReadiness = context.deploymentReadinessService.getCicdPipelineReadinessSummary();
      const githubAppIntegration = context.deploymentReadinessService.getGitHubAppIntegrationTestReadinessSummary();
      const llmIntegration = context.deploymentReadinessService.getLLMIntegrationTestReadinessSummary();
      const vaultIntegration = context.deploymentReadinessService.getVaultIntegrationTestReadinessSummary();
      const mergeQueueIntegration = context.deploymentReadinessService.getMergeQueueIntegrationTestReadinessSummary();
      const tenantScopePlanning = context.tenantScopePlanningService.getSummary();
      const tenantScopeEnforcement = context.tenantScopeEnforcementService.getSummary();
      const secretRefs = context.securityService.listSecretRefs();
      const conflictAssistant = context.conflictResolutionAssistantService.getSummary();
      const prOwnership = context.prOwnershipService.getSummary();
      const realMergeExecution = context.realMergeExecutionPolicyService.getSummary();
      const worktreeAllocation = context.agentWorktreeAllocationService.getSummary();
      const auditQueryScope = context.auditQueryScopeEnforcementService.getSummary();
      sendJson(response, storage.healthy ? 200 : 503, {
        status: storage.healthy ? "ok" : "degraded",
        service: "aichestra-api",
        storage: {
          kind: storage.kind,
          healthy: storage.healthy,
          message: storage.message,
          checkedAt: storage.checkedAt.toISOString()
        },
        databaseOperations: {
          status: databaseOperations.status,
          planningOnly: databaseOperations.planningOnly,
          productionReady: databaseOperations.productionReady,
          storageProviderKind: databaseOperations.storageProviderKind,
          databaseUrlConfigured: databaseOperations.databaseUrlConfigured,
          databaseUrlExposed: databaseOperations.databaseUrlExposed,
          optionalPostgresTestUrlConfigured: databaseOperations.testDatabaseUrlConfigured,
          migrationRunnerAvailable: databaseOperations.migrationRunnerAvailable,
          migrationFileCount: databaseOperations.migrationFileCount,
          poolingEnabled: false,
          backupConfigured: false,
          restoreTested: false,
          retentionDeletionJobsEnabled: false,
          productionDbConnectionAttempted: false,
          noSecretsExposed: true
        },
        secretBackendMigration: {
          status: secretBackendMigration.status,
          planningOnly: secretBackendMigration.planningOnly,
          productionReady: secretBackendMigration.productionReady,
          currentProfileId: secretBackendMigration.currentProfileId,
          envFallbackAllowedForCurrentProfile: secretBackendMigration.envFallbackAllowedForCurrentProfile,
          envFallbackWarning: secretBackendMigration.envFallbackWarning,
          realSecretBackendConfigured: secretBackendMigration.realSecretBackendConfigured,
          activeSecretRefCount: secretRefs.filter((secretRef) => secretRef.status === "active").length,
          disabledSecretRefCount: secretRefs.filter((secretRef) => secretRef.status === "disabled").length,
          revokedSecretRefCount: secretRefs.filter((secretRef) => secretRef.status === "revoked").length,
          noSecretValuesExposed: secretBackendMigration.noSecretsExposed,
          noEnvValuesExposed: !secretBackendMigration.envValuesExposed,
          credentialCachesRead: secretBackendMigration.credentialCachesRead,
          credentialResolutionAttempted: secretBackendMigration.credentialResolutionAttempted,
          rotationJobsImplemented: secretBackendMigration.rotationJobsImplemented,
          productionCredentialIssuanceImplemented: secretBackendMigration.productionCredentialIssuanceImplemented,
          externalCallsEnabled: secretBackendMigration.externalCallsEnabled
        },
        secretBackendDecision: {
          status: secretBackendDecision.status,
          planningOnly: secretBackendDecision.planningOnly,
          decisionStatus: secretBackendDecision.decisionStatus,
          recommendedBackend: secretBackendDecision.recommendedBackend,
          secondChoiceBackend: secretBackendDecision.secondChoiceBackend,
          implementationReady: secretBackendDecision.implementationReady,
          productionSecretBackendImplemented: secretBackendDecision.productionSecretBackendImplemented,
          envFallbackProductionAllowed: secretBackendDecision.envFallbackProductionAllowed,
          criterionCount: secretBackendDecision.criterionCount,
          scoreCount: secretBackendDecision.scoreCount,
          implementationScopeCount: secretBackendDecision.implementationScopeCount,
          riskCount: secretBackendDecision.riskCount,
          criticalRiskCount: secretBackendDecision.criticalRiskCount,
          providerMappingCount: secretBackendDecision.providerMappingCount,
          noSecretValuesExposed: secretBackendDecision.noSecretsExposed,
          noEnvValuesExposed: !secretBackendDecision.envValuesExposed,
          externalCallsEnabled: secretBackendDecision.externalCallsEnabled,
          secretReadsAttempted: secretBackendDecision.secretReadsAttempted,
          secretRotationsAttempted: secretBackendDecision.secretRotationsAttempted,
          secretMigrationsAttempted: secretBackendDecision.secretMigrationsAttempted,
          productionCredentialsIssued: secretBackendDecision.productionCredentialsIssued,
          credentialCachesRead: secretBackendDecision.credentialCachesRead
        },
        vaultSecretBackend: {
          selectedProvider: context.securityService.getVaultConfig().selectedProvider,
          vaultProviderEnabled: context.securityService.getVaultConfig().vaultProviderEnabled,
          vaultAddressConfigured: context.securityService.getVaultConfig().vaultAddressConfigured,
          vaultNamespaceConfigured: context.securityService.getVaultConfig().vaultNamespaceConfigured,
          vaultAuthMethod: context.securityService.getVaultConfig().vaultAuthMethod,
          vaultAllowedPathPrefixCount: context.securityService.getVaultConfig().vaultAllowedPathPrefixCount,
          vaultIntegrationTestsEnabled: context.securityService.getVaultConfig().vaultIntegrationTestsEnabled,
          vaultClientKind: context.securityService.getVaultHealth().clientKind,
          vaultHealthStatus: context.securityService.getVaultHealth().status,
          implementationReady: context.securityService.getVaultConfig().configStatus === "ready",
          productionSecretBackendImplemented: false,
          envFallbackProductionAllowed: false,
          noSecretValuesExposed: true,
          noEnvValuesExposed: true
        },
        git: {
          providerKind: context.gitProviderConfig.providerKind,
          remoteGitEnabled: context.gitProviderConfig.remoteGitEnabled,
          remoteBranchCreateEnabled: context.gitProviderConfig.remoteBranchCreateEnabled,
          remotePullRequestCreateEnabled: context.gitProviderConfig.remotePullRequestCreateEnabled,
          remoteMergeEnabled: false,
          githubConfigured: context.gitProviderConfig.githubConfigured,
          githubOwnerConfigured: context.gitProviderConfig.githubOwnerConfigured ?? false,
          githubRepoConfigured: context.gitProviderConfig.githubRepoConfigured ?? false,
          githubAllowedRepoCount: context.gitProviderConfig.githubAllowedRepoCount ?? context.gitProviderConfig.githubAllowedRepos?.length ?? 0,
          githubAllowedBranchPrefix: context.gitProviderConfig.githubAllowedBranchPrefix ?? "ai/",
          githubIntegrationTestsEnabled: context.gitProviderConfig.githubIntegrationTestsEnabled ?? false,
          githubCredentialSource: context.gitProviderConfig.githubCredentialSource ?? "none",
          githubCredentialStatus: context.gitProviderConfig.githubCredentialStatus ?? (context.gitProviderConfig.githubConfigured ? "resolved" : "missing"),
          githubAuthMode: context.gitProviderConfig.githubAuthMode ?? "legacy_token",
          githubAppEnabled: context.githubAppRuntimeConfig.enabled,
          githubAppConfigured: context.githubAppRuntimeConfig.configured,
          githubAppIdConfigured: context.githubAppRuntimeConfig.appIdConfigured,
          githubAppPrivateKeySecretRefConfigured: context.githubAppRuntimeConfig.privateKeySecretRefConfigured,
          githubAppWebhookSecretRefConfigured: context.githubAppRuntimeConfig.webhookSecretRefConfigured,
          githubAppAllowedInstallationCount: context.githubAppRuntimeConfig.allowedInstallationIds.length,
          githubAppAllowedRepoCount: context.githubAppRuntimeConfig.allowedRepos.length,
          githubAppTokenProviderKind: context.githubAppRuntimeConfig.tokenProviderKind,
          githubLegacyTokenFallbackEnabled: context.gitProviderConfig.githubLegacyTokenFallbackEnabled ?? false,
          envSecretProviderEnabled: context.gitProviderConfig.envSecretProviderEnabled ?? false,
          githubWebhooksEnabled: context.gitWebhookConfig.webhooksEnabled,
          githubWebhookSecretConfigured: context.gitWebhookConfig.webhookSecretConfigured,
          githubWebhookAcceptUnverified: context.gitWebhookConfig.webhookAcceptUnverified,
          githubWebhookSupportedEventCount: context.gitWebhookConfig.supportedWebhookEvents.length,
          githubWebhookAllowedRepoCount: context.gitWebhookConfig.webhookAllowedRepoCount,
          githubWebhookIntegrationTestsEnabled: context.gitWebhookConfig.webhookIntegrationTestsEnabled,
          githubWebhookSecretSource: context.gitWebhookConfig.webhookSecretSource,
          githubWebhookSecretStatus: context.gitWebhookConfig.webhookSecretStatus
        },
        conflictResolutionAssistant: {
          status: conflictAssistant.status,
          requests: conflictAssistant.requests,
          summaries: conflictAssistant.summaries,
          plans: conflictAssistant.plans,
          recommendations: conflictAssistant.recommendations,
          applyAllowed: conflictAssistant.applyAllowed,
          realLlmUsed: conflictAssistant.realLlmUsed,
          sourceMutation: conflictAssistant.sourceMutation,
          mergeExecution: conflictAssistant.mergeExecution,
          patchApplication: conflictAssistant.patchApplication,
          externalProviderCalls: conflictAssistant.externalProviderCalls,
          secretsExposed: conflictAssistant.secretsExposed,
          envValuesExposed: conflictAssistant.envValuesExposed
        },
        prOwnershipHandoff: {
          status: prOwnership.status,
          ownershipRecords: prOwnership.ownershipRecords,
          activeOwnershipRecords: prOwnership.activeOwnershipRecords,
          handoffRequests: prOwnership.handoffRequests,
          pendingHandoffs: prOwnership.pendingHandoffs,
          acceptedHandoffs: prOwnership.acceptedHandoffs,
          rejectedHandoffs: prOwnership.rejectedHandoffs,
          expiredHandoffs: prOwnership.expiredHandoffs,
          blockedHandoffs: prOwnership.blockedHandoffs,
          reviewerAssignments: prOwnership.reviewerAssignments,
          mergeQueueEntriesMissingOwner: prOwnership.mergeQueueEntriesMissingOwner,
          remotePrUpdateEnabled: prOwnership.remotePrUpdateEnabled,
          remoteReviewerAssignmentEnabled: prOwnership.remoteReviewerAssignmentEnabled,
          githubApiCalls: prOwnership.githubApiCalls,
          autoMergeEnabled: prOwnership.autoMergeEnabled,
          branchDeletionEnabled: prOwnership.branchDeletionEnabled,
          workspaceMutation: prOwnership.workspaceMutation,
          secretsExposed: prOwnership.secretsExposed,
          envValuesExposed: prOwnership.envValuesExposed
        },
        realMergeExecutionPolicy: {
          status: realMergeExecution.status,
          policyStatus: realMergeExecution.policyStatus,
          requests: realMergeExecution.requests,
          decisions: realMergeExecution.decisions,
          readyForManualFuture: realMergeExecution.readyForManualFuture,
          blocked: realMergeExecution.blocked,
          preconditions: realMergeExecution.preconditions,
          forbiddenOperations: realMergeExecution.forbiddenOperations,
          mergeExecutionEnabled: realMergeExecution.mergeExecutionEnabled,
          autoMergeEnabled: realMergeExecution.autoMergeEnabled,
          remotePushEnabled: realMergeExecution.remotePushEnabled,
          mergeExecutionPerformed: realMergeExecution.mergeExecutionPerformed,
          autoMergePerformed: realMergeExecution.autoMergePerformed,
          remotePushPerformed: realMergeExecution.remotePushPerformed,
          branchDeletionPerformed: realMergeExecution.branchDeletionPerformed,
          workspaceMutationPerformed: realMergeExecution.workspaceMutationPerformed,
          githubApiCalls: realMergeExecution.githubApiCalls,
          realLlmCalls: realMergeExecution.realLlmCalls,
          secretsExposed: realMergeExecution.secretsExposed,
          envValuesExposed: realMergeExecution.envValuesExposed
        },
        agentWorktreeAllocation: {
          status: worktreeAllocation.status,
          allocationEnabled: worktreeAllocation.allocationEnabled,
          fixtureOnly: worktreeAllocation.fixtureOnly,
          productionWorktreeAllocation: worktreeAllocation.productionWorktreeAllocation,
          integrationTestsEnabled: worktreeAllocation.integrationTestsEnabled,
          workspaceRootAllowlistConfigured: worktreeAllocation.workspaceRootAllowlistConfigured,
          workspaceRootAllowlistCount: worktreeAllocation.workspaceRootAllowlistCount,
          requests: worktreeAllocation.requests,
          allocations: worktreeAllocation.allocations,
          safetyChecks: worktreeAllocation.safetyChecks,
          blockedAllocations: worktreeAllocation.blockedAllocations,
          realGitWorktreeExecuted: worktreeAllocation.realGitWorktreeExecuted,
          remoteGitOperation: worktreeAllocation.remoteGitOperation,
          destructiveCleanupExecuted: worktreeAllocation.destructiveCleanupExecuted,
          sourceMutation: worktreeAllocation.sourceMutation,
          secretsExposed: worktreeAllocation.secretsExposed,
          envValuesExposed: worktreeAllocation.envValuesExposed,
          fullLocalPathsExposed: worktreeAllocation.fullLocalPathsExposed
        },
        llm: {
          providerKind: context.llmGatewayService.getConfig().providerKind,
          routingMode: context.llmGatewayService.getConfig().routingMode,
          fallbackEnabled: context.llmGatewayService.getConfig().fallbackEnabled,
          maxFallbackAttempts: context.llmGatewayService.getConfig().maxFallbackAttempts,
          providerCount: context.llmGatewayService.listProviderHealth().length,
          enabledProviderCount: context.llmGatewayService.listProviderHealth().filter((health) => health.status === "healthy").length,
          remoteProviderCount: context.llmGatewayService.listProviderHealth().filter((health) => health.remoteEnabled === true).length,
          remoteLlmEnabled: context.llmGatewayService.getConfig().remoteLlmEnabled,
          remoteCompletionEnabled: context.llmGatewayService.getConfig().remoteCompletionEnabled,
          baseUrlConfigured: context.llmGatewayService.getConfig().baseUrlConfigured,
          apiKeyConfigured: context.llmGatewayService.getConfig().apiKeyConfigured,
          allowedModelCount: context.llmGatewayService.getConfig().allowedModelCount,
          defaultModelConfigured: context.llmGatewayService.getConfig().defaultModelConfigured,
          integrationTestsEnabled: context.llmGatewayService.getConfig().integrationTestsEnabled,
          credentialSource: context.llmGatewayService.getConfig().credentialSource,
          credentialStatus: context.llmGatewayService.getConfig().credentialStatus,
          envSecretProviderEnabled: context.llmGatewayService.getConfig().envSecretProviderEnabled,
          modelCatalogStatus: "available",
          gatewayHealth: "available"
        },
        agentRunner: {
          runnerKind: context.agentRunnerService.getConfig().runnerKind,
          localRunnerEnabled: context.agentRunnerService.getConfig().localRunnerEnabled,
          localCommandExecutionEnabled: context.agentRunnerService.getConfig().localCommandExecutionEnabled,
          workspaceRootConfigured: context.agentRunnerService.getConfig().workspaceRootConfigured,
          commandExecutorKind: context.agentRunnerService.getConfig().commandExecutorKind,
          maxRuntimeMs: context.agentRunnerService.getConfig().maxRuntimeMs,
          workspaceLifecycleStatus: "v2_implemented",
          activeWorkspaceLeaseCount: context.agentRunnerService.listWorkspaceLeases().filter((lease) => lease.status === "active").length,
          worktreeAllocationStatus: worktreeAllocation.status,
          worktreeAllocationEnabled: worktreeAllocation.allocationEnabled,
          worktreeAllocationCount: worktreeAllocation.allocations,
          editIntentGraphStatus: "v1_implemented",
          activeEditIntentCount: context.editIntentGraphService.getOverlapSummary().activeIntents,
          activeFileLeaseCount: context.editIntentGraphService.getOverlapSummary().activeFileLeases,
          fileLockingEnabled: false,
          sourceFileMutationEnabled: false,
          futureGitWorktreeExecutionEnabled: false,
          destructiveWorkspaceCleanupEnabled: false,
          llmProviderKind: context.llmGatewayService.getConfig().providerKind,
          gitProviderKind: context.gitProviderConfig.providerKind
        },
        policy: {
          engineKind: context.policyService.getConfig().engineKind,
          rulesLoaded: context.policyService.getConfig().ruleCount,
          auditEnabled: context.policyService.getConfig().auditEnabled
        },
        policyBundleReadiness: {
          status: policyBundleReadiness.status,
          planningOnly: policyBundleReadiness.planningOnly,
          productionReady: policyBundleReadiness.productionReady,
          policyEngineKind: policyBundleReadiness.currentEngineKind,
          policyBundleManagementStatus: "planned_not_enabled",
          externalPolicyEngineEnabled: policyBundleReadiness.externalPolicyEngineEnabled,
          signedBundleSupportEnabled: policyBundleReadiness.signedBundleSupportEnabled,
          signedBundleVerificationEnabled: policyBundleReadiness.signedBundleVerificationEnabled,
          staticPolicyRuleCount: context.policyService.getConfig().ruleCount,
          readinessStatus: policyBundleReadiness.criticalBlockerCount > 0 ? "blocked" : "planning_only",
          dynamicPolicyExecutionEnabled: policyBundleReadiness.dynamicPolicyExecutionEnabled,
          remotePolicyLoadingEnabled: policyBundleReadiness.remotePolicyLoadingEnabled,
          policyCodeExecuted: policyBundleReadiness.policyCodeExecuted,
          noSecretsExposed: policyBundleReadiness.noSecretsExposed
        },
        policyShadowEvaluation: {
          status: policyShadowEvaluation.status,
          planningOnly: policyShadowEvaluation.planningOnly,
          productionReady: policyShadowEvaluation.productionReady,
          sourceOfTruth: policyShadowEvaluation.sourceOfTruth,
          enforcementMode: policyShadowEvaluation.enforcementMode,
          enforcementChanged: policyShadowEvaluation.enforcementChanged,
          staticPolicyEngineAuthoritative: policyShadowEvaluation.staticPolicyEngineAuthoritative,
          shadowEvaluatorImplemented: policyShadowEvaluation.shadowEvaluatorImplemented,
          candidateRuntimeImplemented: policyShadowEvaluation.candidateRuntimeImplemented,
          candidateRuntimeExecuted: policyShadowEvaluation.candidateRuntimeExecuted,
          comparisonRuleCount: policyShadowEvaluation.comparisonRuleCount,
          mismatchTaxonomyCount: policyShadowEvaluation.mismatchTaxonomyCount,
          criticalMismatchKindCount: policyShadowEvaluation.criticalMismatchKindCount,
          dynamicPolicyExecutionEnabled: policyShadowEvaluation.dynamicPolicyExecutionEnabled,
          externalPolicyServiceCallsEnabled: policyShadowEvaluation.externalPolicyServiceCallsEnabled,
          remotePolicyBundleLoadingEnabled: policyShadowEvaluation.remotePolicyBundleLoadingEnabled,
          policyCodeExecuted: policyShadowEvaluation.policyCodeExecuted,
          noSecretsExposed: policyShadowEvaluation.noSecretsExposed,
          envValuesExposed: policyShadowEvaluation.envValuesExposed
        },
        policyRuntimePoc: {
          status: policyRuntimePoc.status,
          planningOnly: policyRuntimePoc.planningOnly,
          productionReady: policyRuntimePoc.productionReady,
          currentRuntime: policyRuntimePoc.currentRuntime,
          recommendedPocPath: policyRuntimePoc.recommendedPocPath,
          runtimeEnforcementEnabled: policyRuntimePoc.runtimeEnforcementEnabled,
          shadowEvaluationImplemented: policyRuntimePoc.shadowEvaluationImplemented,
          optionCount: policyRuntimePoc.optionCount,
          domainMappingCount: policyRuntimePoc.domainMappingCount,
          goldenCaseCount: policyRuntimePoc.goldenCaseCount,
          readinessStatus: policyRuntimePoc.criticalBlockerCount > 0 ? "blocked" : "planning_only",
          externalPolicyEngineEnabled: policyRuntimePoc.externalPolicyEngineEnabled,
          opaRuntimeImplemented: policyRuntimePoc.opaRuntimeImplemented,
          cedarRuntimeImplemented: policyRuntimePoc.cedarRuntimeImplemented,
          signedJsonYamlRuntimeImplemented: policyRuntimePoc.signedJsonYamlRuntimeImplemented,
          customPolicyServiceImplemented: policyRuntimePoc.customPolicyServiceImplemented,
          dynamicPolicyExecutionEnabled: policyRuntimePoc.dynamicPolicyExecutionEnabled,
          remotePolicyLoadingEnabled: policyRuntimePoc.remotePolicyLoadingEnabled,
          hotReloadEnabled: policyRuntimePoc.hotReloadEnabled,
          policyCodeExecuted: policyRuntimePoc.policyCodeExecuted,
          staticPolicyEngineUnchanged: policyRuntimePoc.staticPolicyEngineUnchanged,
          noSecretsExposed: policyRuntimePoc.noSecretsExposed,
          noEnvValuesExposed: !policyRuntimePoc.envValuesExposed
        },
        stagingDeployment: {
          status: stagingDeployment.status,
          planningOnly: stagingDeployment.planningOnly,
          currentProfileId: stagingDeployment.currentProfileId,
          profileStatus: stagingDeployment.profileStatus,
          productionReady: stagingDeployment.productionReady,
          stagingDeployed: stagingDeployment.stagingDeployed,
          productionTrafficAllowed: stagingDeployment.productionTrafficAllowed,
          requiredComponentCount: stagingDeployment.requiredComponentCount,
          requiredEnvGateCount: stagingDeployment.requiredEnvGateCount,
          forbiddenEnvGateCount: stagingDeployment.forbiddenEnvGateCount,
          criticalBlockerCount: stagingDeployment.criticalBlockerCount,
          warningCount: stagingDeployment.warningCount,
          mockActorWarning: stagingDeployment.mockActorWarning,
          envFallbackWarning: stagingDeployment.envFallbackWarning,
          postgresRequired: stagingDeployment.postgresRequired,
          apiDashboardRequired: stagingDeployment.apiDashboardRequired,
          remoteMergeForbidden: stagingDeployment.remoteMergeForbidden,
          remoteMcpForbidden: stagingDeployment.remoteMcpForbidden,
          vendorCliForbidden: stagingDeployment.vendorCliForbidden,
          deploymentExecuted: stagingDeployment.deploymentExecuted,
          externalCallsEnabled: stagingDeployment.externalCallsEnabled,
          noSecretsExposed: stagingDeployment.noSecretsExposed,
          envValuesExposed: stagingDeployment.envValuesExposed
        },
        stagingDryRun: {
          status: stagingDryRun.status,
          planningOnly: stagingDryRun.planningOnly,
          dryRunMode: stagingDryRun.dryRunMode,
          overallStatus: stagingDryRun.overallStatus,
          profileStatus: stagingDryRun.profileStatus,
          productionReady: stagingDryRun.productionReady,
          stagingDeployed: stagingDryRun.stagingDeployed,
          blockerCount: stagingDryRun.blockerCount,
          criticalBlockerCount: stagingDryRun.criticalBlockerCount,
          warningCount: stagingDryRun.warningCount,
          skippedIntegrationProfileCount: stagingDryRun.skippedIntegrationProfileCount,
          generatedAt: stagingDryRun.generatedAt.toISOString(),
          deploymentExecuted: stagingDryRun.deploymentExecuted,
          externalCallsEnabled: stagingDryRun.externalCallsEnabled,
          remoteIntegrationTestsExecuted: stagingDryRun.remoteIntegrationTestsExecuted,
          validationCommandsExecuted: stagingDryRun.validationCommandsExecuted,
          noSecretsExposed: stagingDryRun.noSecretsExposed,
          envValuesExposed: stagingDryRun.envValuesExposed,
          productionReadyClaimed: stagingDryRun.productionReadyClaimed,
          stagingDeploymentClaimed: stagingDryRun.stagingDeploymentClaimed
        },
        stagingReleaseCandidate: {
          status: stagingReleaseCandidate.status,
          planningOnly: stagingReleaseCandidate.planningOnly,
          overallStatus: stagingReleaseCandidate.overallStatus,
          checklistStatus: stagingReleaseCandidate.checklistStatus,
          productionReady: stagingReleaseCandidate.productionReady,
          stagingDeployed: stagingReleaseCandidate.stagingDeployed,
          releaseCreated: stagingReleaseCandidate.releaseCreated,
          gitTagCreated: stagingReleaseCandidate.gitTagCreated,
          githubReleaseCreated: stagingReleaseCandidate.githubReleaseCreated,
          deploymentExecuted: stagingReleaseCandidate.deploymentExecuted,
          externalCallsEnabled: stagingReleaseCandidate.externalCallsEnabled,
          remoteIntegrationTestsExecuted: stagingReleaseCandidate.remoteIntegrationTestsExecuted,
          gateCount: stagingReleaseCandidate.gateCount,
          requiredGateCount: stagingReleaseCandidate.requiredGateCount,
          blockerCount: stagingReleaseCandidate.blockerCount,
          criticalBlockerCount: stagingReleaseCandidate.criticalBlockerCount,
          signoffCount: stagingReleaseCandidate.signoffCount,
          requiredSignoffCount: stagingReleaseCandidate.requiredSignoffCount,
          pendingSignoffCount: stagingReleaseCandidate.pendingSignoffCount,
          releaseNoteRequirementCount: stagingReleaseCandidate.releaseNoteRequirementCount,
          missingReleaseNoteRequirementCount: stagingReleaseCandidate.missingReleaseNoteRequirementCount,
          rollbackItemCount: stagingReleaseCandidate.rollbackItemCount,
          missingRollbackItemCount: stagingReleaseCandidate.missingRollbackItemCount,
          skippedTestCount: stagingReleaseCandidate.skippedTestCount,
          generatedAt: stagingReleaseCandidate.generatedAt.toISOString(),
          noSecretsExposed: stagingReleaseCandidate.noSecretsExposed,
          envValuesExposed: stagingReleaseCandidate.envValuesExposed,
          productionReadyClaimed: stagingReleaseCandidate.productionReadyClaimed,
          stagingDeploymentClaimed: stagingReleaseCandidate.stagingDeploymentClaimed
        },
        stagingExecution: {
          status: stagingExecution.status,
          planningOnly: stagingExecution.planningOnly,
          planStatus: stagingExecution.planStatus,
          goNoGoStatus: stagingExecution.goNoGoStatus,
          productionReady: stagingExecution.productionReady,
          stagingDeployed: stagingExecution.stagingDeployed,
          deploymentExecuted: stagingExecution.deploymentExecuted,
          releaseCreated: stagingExecution.releaseCreated,
          gitTagCreated: stagingExecution.gitTagCreated,
          externalCallsEnabled: stagingExecution.externalCallsEnabled,
          remoteIntegrationTestsExecuted: stagingExecution.remoteIntegrationTestsExecuted,
          gateCount: stagingExecution.gateCount,
          requiredGateCount: stagingExecution.requiredGateCount,
          blockerCount: stagingExecution.blockerCount,
          criticalBlockerCount: stagingExecution.criticalBlockerCount,
          warningCount: stagingExecution.warningCount,
          stepCount: stagingExecution.stepCount,
          signoffPackAvailable: stagingExecution.signoffPackAvailable,
          requiredSignoffCount: stagingExecution.requiredSignoffCount,
          pendingSignoffCount: stagingExecution.pendingSignoffCount,
          approvedSignoffCount: stagingExecution.approvedSignoffCount,
          conditionalSignoffCount: stagingExecution.conditionalSignoffCount,
          rejectedSignoffCount: stagingExecution.rejectedSignoffCount,
          missingRequiredSignoffCount: stagingExecution.missingRequiredSignoffCount,
          signoffStatus: stagingExecution.signoffStatus,
          actualDeploymentBlocked: stagingExecution.actualDeploymentBlocked,
          rollbackStepCount: stagingExecution.rollbackStepCount,
          noSecretsExposed: stagingExecution.noSecretsExposed,
          envValuesExposed: stagingExecution.envValuesExposed,
          productionReadyClaimed: stagingExecution.productionReadyClaimed,
          stagingDeployedClaimed: stagingExecution.stagingDeployedClaimed
        },
        cicdPipeline: {
          status: cicdReadiness.status,
          planningOnly: cicdReadiness.planningOnly,
          productionReady: cicdReadiness.productionReady,
          stagingDeployed: cicdReadiness.stagingDeployed,
          deploymentWorkflowCreated: cicdReadiness.deploymentWorkflowCreated,
          activeWorkflowCreated: cicdReadiness.activeWorkflowCreated,
          expectedNodeVersion: cicdReadiness.expectedNodeVersion,
          currentNodeVersion: cicdReadiness.currentNodeVersion,
          nodeVersionStatus: cicdReadiness.nodeVersionStatus,
          packageManager: cicdReadiness.packageManager,
          requiredValidationCommandsCount: cicdReadiness.requiredJobCount,
          optionalIntegrationProfilesCount: cicdReadiness.integrationGateCount,
          remoteIntegrationTestsEnabledByDefault: cicdReadiness.remoteIntegrationTestsEnabledByDefault,
          externalCallsEnabledByDefault: cicdReadiness.externalCallsEnabledByDefault,
          secretsExposed: cicdReadiness.secretsExposed,
          envValuesExposed: cicdReadiness.envValuesExposed
        },
        githubAppIntegrationTests: {
          status: githubAppIntegration.status,
          planningOnly: githubAppIntegration.planningOnly,
          productionReady: githubAppIntegration.productionReady,
          enabled: githubAppIntegration.liveTestsEnabled,
          canRunLiveTests: githubAppIntegration.canRunLiveTests,
          defaultLiveTestsSkipped: githubAppIntegration.defaultLiveTestsSkipped,
          requiredGatesConfiguredCount: githubAppIntegration.configuredGateCount,
          missingGatesCount: githubAppIntegration.missingGateCount,
          unsafeGatesCount: githubAppIntegration.unsafeGateCount,
          allowedRepoCount: githubAppIntegration.allowedRepoCount,
          allowedBranchPrefix: githubAppIntegration.allowedBranchPrefix,
          branchPrefixConfigured: githubAppIntegration.branchPrefixConfigured,
          branchPrefixMatchesRequired: githubAppIntegration.branchPrefixMatchesRequired,
          webhookFixtureTestsEnabled: githubAppIntegration.webhookFixtureTestsEnabled,
          liveWebhookTestsEnabled: githubAppIntegration.liveWebhookTestsEnabled,
          noAutoMerge: githubAppIntegration.noAutoMerge,
          noForcePush: githubAppIntegration.noForcePush,
          noBranchDelete: githubAppIntegration.noBranchDelete,
          noSecretsExposed: githubAppIntegration.noSecretsExposed,
          envValuesExposed: githubAppIntegration.envValuesExposed,
          privateKeyExposed: githubAppIntegration.privateKeyExposed,
          installationTokenExposed: githubAppIntegration.installationTokenExposed,
          githubCallsInDefaultTests: githubAppIntegration.githubCallsInDefaultTests
        },
        llmIntegrationTests: {
          status: llmIntegration.status,
          planningOnly: llmIntegration.planningOnly,
          productionReady: llmIntegration.productionReady,
          enabled: llmIntegration.liveTestsEnabled,
          canRunLiveTests: llmIntegration.canRunLiveTests,
          defaultLiveTestsSkipped: llmIntegration.defaultLiveTestsSkipped,
          requiredGatesConfiguredCount: llmIntegration.configuredGateCount,
          missingGatesCount: llmIntegration.missingGateCount,
          unsafeGatesCount: llmIntegration.unsafeGateCount,
          providerKind: llmIntegration.providerKind,
          remoteLlmEnabled: llmIntegration.remoteLlmEnabled,
          remoteCompletionEnabled: llmIntegration.remoteCompletionEnabled,
          baseUrlConfigured: llmIntegration.baseUrlConfigured,
          apiKeyConfigured: llmIntegration.apiKeyConfigured,
          secretRefConfigured: llmIntegration.secretRefConfigured,
          rawEnvApiKeyConfigured: llmIntegration.rawEnvApiKeyConfigured,
          allowedModelCount: llmIntegration.allowedModelCount,
          defaultModelConfigured: llmIntegration.defaultModelConfigured,
          defaultModelAllowlisted: llmIntegration.defaultModelAllowlisted,
          routingModeAllowed: llmIntegration.routingModeAllowed,
          fallbackSafe: llmIntegration.fallbackSafe,
          budgetConfigured: llmIntegration.budgetConfigured,
          promptClassConfigured: llmIntegration.promptClassConfigured,
          noStreaming: llmIntegration.noStreaming,
          noToolCalls: llmIntegration.noToolCalls,
          noVendorCli: llmIntegration.noVendorCli,
          noCredentialCacheRead: llmIntegration.noCredentialCacheRead,
          noSecretsExposed: llmIntegration.noSecretsExposed,
          envValuesExposed: llmIntegration.envValuesExposed,
          apiKeyExposed: llmIntegration.apiKeyExposed,
          rawProviderResponseExposed: llmIntegration.rawProviderResponseExposed,
          remoteLlmCallsInDefaultTests: llmIntegration.remoteLlmCallsInDefaultTests
        },
        vaultIntegrationTests: {
          status: vaultIntegration.status,
          planningOnly: vaultIntegration.planningOnly,
          productionReady: vaultIntegration.productionReady,
          profileStatus: vaultIntegration.profileStatus,
          enabled: vaultIntegration.liveTestsEnabled,
          canRunLiveTests: vaultIntegration.canRunLiveTests,
          defaultLiveTestsSkipped: vaultIntegration.defaultLiveTestsSkipped,
          requiredGatesConfiguredCount: vaultIntegration.configuredGateCount,
          missingGatesCount: vaultIntegration.missingGateCount,
          unsafeGatesCount: vaultIntegration.unsafeGateCount,
          vaultBackendSelected: vaultIntegration.vaultBackendSelected,
          vaultProviderEnabled: vaultIntegration.vaultProviderEnabled,
          vaultAddressConfigured: vaultIntegration.vaultAddressConfigured,
          vaultNamespaceConfigured: vaultIntegration.vaultNamespaceConfigured,
          vaultAuthMethod: vaultIntegration.vaultAuthMethod,
          vaultTokenConfigured: vaultIntegration.vaultTokenConfigured,
          vaultKvMountConfigured: vaultIntegration.vaultKvMountConfigured,
          pathAllowlistPrefixCount: vaultIntegration.pathAllowlistPrefixCount,
          testSecretPathConfigured: vaultIntegration.testSecretPathConfigured,
          testSecretKeyConfigured: vaultIntegration.testSecretKeyConfigured,
          testSecretPathAllowlisted: vaultIntegration.testSecretPathAllowlisted,
          testSecretPathLooksTestOnly: vaultIntegration.testSecretPathLooksTestOnly,
          noWrite: vaultIntegration.noWrite,
          noDelete: vaultIntegration.noDelete,
          noRotate: vaultIntegration.noRotate,
          noBroadList: vaultIntegration.noBroadList,
          noSecretsExposed: vaultIntegration.noSecretsExposed,
          envValuesExposed: vaultIntegration.envValuesExposed,
          vaultTokenExposed: vaultIntegration.vaultTokenExposed,
          vaultAddressExposed: vaultIntegration.vaultAddressExposed,
          vaultSecretValueExposed: vaultIntegration.vaultSecretValueExposed,
          vaultCallsInDefaultTests: vaultIntegration.vaultCallsInDefaultTests
        },
        mergeQueueIntegrationTests: {
          status: mergeQueueIntegration.status,
          planningOnly: mergeQueueIntegration.planningOnly,
          productionReady: mergeQueueIntegration.productionReady,
          profileStatus: mergeQueueIntegration.profileStatus,
          enabled: mergeQueueIntegration.liveTestsEnabled,
          canRunLiveTests: mergeQueueIntegration.canRunLiveTests,
          defaultLiveTestsSkipped: mergeQueueIntegration.defaultLiveTestsSkipped,
          requiredGatesConfiguredCount: mergeQueueIntegration.configuredGateCount,
          missingGatesCount: mergeQueueIntegration.missingGateCount,
          unsafeGatesCount: mergeQueueIntegration.unsafeGateCount,
          gitProviderAllowed: mergeQueueIntegration.gitProviderAllowed,
          remoteGitEnabled: mergeQueueIntegration.remoteGitEnabled,
          githubIntegrationProfileEnabled: mergeQueueIntegration.githubIntegrationProfileEnabled,
          allowedRepoCount: mergeQueueIntegration.allowedRepoCount,
          branchPrefixConfigured: mergeQueueIntegration.branchPrefixConfigured,
          branchPrefixMatchesRequired: mergeQueueIntegration.branchPrefixMatchesRequired,
          testRepoConfigured: mergeQueueIntegration.testRepoConfigured,
          testRepoAllowlisted: mergeQueueIntegration.testRepoAllowlisted,
          testBaseBranchConfigured: mergeQueueIntegration.testBaseBranchConfigured,
          testSourceBranchCount: mergeQueueIntegration.testSourceBranchCount,
          testSourceBranchesMatchPrefix: mergeQueueIntegration.testSourceBranchesMatchPrefix,
          dryRunOnly: mergeQueueIntegration.dryRunOnly,
          remoteMergeForbidden: mergeQueueIntegration.remoteMergeForbidden,
          remoteRebaseForbidden: mergeQueueIntegration.remoteRebaseForbidden,
          remoteForcePushForbidden: mergeQueueIntegration.remoteForcePushForbidden,
          remoteBranchDeleteForbidden: mergeQueueIntegration.remoteBranchDeleteForbidden,
          noAutoMerge: mergeQueueIntegration.noAutoMerge,
          noForcePush: mergeQueueIntegration.noForcePush,
          noBranchDelete: mergeQueueIntegration.noBranchDelete,
          noSecretsExposed: mergeQueueIntegration.noSecretsExposed,
          envValuesExposed: mergeQueueIntegration.envValuesExposed,
          repoUrlsExposed: mergeQueueIntegration.repoUrlsExposed,
          branchNamesExposed: mergeQueueIntegration.branchNamesExposed,
          remoteGitCallsInDefaultTests: mergeQueueIntegration.remoteGitCallsInDefaultTests,
          realMergeExecuted: mergeQueueIntegration.realMergeExecuted
        },
        registryDrift: (() => {
          const summary = context.registryDriftDetectionService.getSummary();
          return {
            status: summary.status,
            planningOnly: summary.planningOnly,
            signalCount: summary.signalCount,
            baselineCount: summary.baselineCount,
            assessmentCount: summary.assessmentCount,
            recommendationCount: summary.recommendationCount,
            criticalSignalCount: summary.criticalSignalCount,
            highSignalCount: summary.highSignalCount,
            applyAllowed: summary.applyAllowed,
            registryMutationExecuted: summary.registryMutationExecuted,
            evalExecuted: summary.evalExecuted,
            canaryExecuted: summary.canaryExecuted,
            autoImprovementApplied: summary.autoImprovementApplied,
            externalCallExecuted: summary.externalCallExecuted,
            noSecretsExposed: summary.noSecretsExposed,
            envValuesExposed: summary.envValuesExposed
          };
        })(),
        registryCanaryApply: (() => {
          const summary = context.registryCanaryApplyGetSummary();
          return {
            status: summary.status,
            planningOnly: summary.planningOnly,
            canaryPlanCount: summary.canaryPlanCount,
            canaryRunCount: summary.canaryRunCount,
            canaryResultCount: summary.canaryResultCount,
            canaryVerdictCount: summary.canaryVerdictCount,
            applyWorkflowCount: summary.applyWorkflowCount,
            applyGateDecisionCount: summary.applyGateDecisionCount,
            rollbackPlanCount: summary.rollbackPlanCount,
            passedCanaryRunCount: summary.passedCanaryRunCount,
            failedCanaryRunCount: summary.failedCanaryRunCount,
            warningCanaryRunCount: summary.warningCanaryRunCount,
            blockedCanaryRunCount: summary.blockedCanaryRunCount,
            skippedCanaryRunCount: summary.skippedCanaryRunCount,
            readyForManualApplyCount: summary.readyForManualApplyCount,
            blockedApplyDecisionCount: summary.blockedApplyDecisionCount,
            metadataOnlyApplyDecisionCount: summary.metadataOnlyApplyDecisionCount,
            autoApplyEnabled: summary.autoApplyEnabled,
            activeRegistryMutationAllowed: summary.activeRegistryMutationAllowed,
            applyPerformed: summary.applyPerformed,
            activeRegistryMutated: summary.activeRegistryMutated,
            externalCanaryExecuted: summary.externalCanaryExecuted,
            realEvalExecuted: summary.realEvalExecuted,
            realProviderCallExecuted: summary.realProviderCallExecuted,
            noSecretsExposed: summary.noSecretsExposed,
            envValuesExposed: summary.envValuesExposed
          };
        })(),
        registryCompatibility: (() => {
          const summary = context.registryCompatibilityService.getSummary();
          return {
            status: summary.status,
            planningOnly: summary.planningOnly,
            ruleCount: summary.ruleCount,
            skillProfileCount: summary.skillProfileCount,
            harnessProfileCount: summary.harnessProfileCount,
            instructionProfileCount: summary.instructionProfileCount,
            resolverGatesPreserved: summary.resolverGatesPreserved,
            autoApplyEnabled: summary.autoApplyEnabled,
            registryMutationsExecuted: summary.registryMutationsExecuted,
            externalCallsExecuted: summary.externalCallsExecuted,
            noSecretsExposed: summary.noSecretsExposed,
            envValuesExposed: summary.envValuesExposed
          };
        })(),
        registryArtifactTrust: (() => {
          const summary = context.registryArtifactTrustService.getTrustSummary();
          return {
            status: "v1_implemented",
            totalArtifacts: summary.totalArtifacts,
            trusted: summary.trusted,
            warnings: summary.warnings,
            blocked: summary.blocked,
            unsigned: summary.unsigned,
            missingProvenance: summary.missingProvenance,
            realSigningImplemented: summary.realSigningImplemented,
            realVerificationImplemented: summary.realVerificationImplemented,
            externalRegistryCalls: summary.externalRegistryCalls,
            noSigningKeysGenerated: true,
            noSecretsExposed: true,
            envValuesExposed: false
          };
        })(),
        registryEvalSuites: (() => {
          const summary = context.evalSuiteExecutionService.getEvalSummary();
          return {
            status: summary.status,
            executionMode: summary.executionMode,
            suiteCount: summary.suiteCount,
            caseCount: summary.caseCount,
            runCount: summary.runCount,
            resultCount: summary.resultCount,
            passedRuns: summary.passedRuns,
            failedRuns: summary.failedRuns,
            warningRuns: summary.warningRuns,
            skippedRuns: summary.skippedRuns,
            blockedRuns: summary.blockedRuns,
            externalEvalImplemented: summary.externalEvalImplemented,
            realProviderCalls: summary.realProviderCalls,
            llmCallsExecuted: summary.llmCallsExecuted,
            mcpCallsExecuted: summary.mcpCallsExecuted,
            vendorCliExecuted: summary.vendorCliExecuted,
            canaryExecuted: summary.canaryExecuted,
            autoApplyEnabled: summary.autoApplyEnabled,
            activeRegistryMutationExecuted: summary.activeRegistryMutationExecuted,
            noSecretsExposed: summary.noSecretsExposed,
            envValuesExposed: summary.envValuesExposed
          };
        })(),
        registryTenantScope: (() => {
          const summary = context.registryTenantScopeEnforcementService.getSummary();
          return {
            status: "v1_implemented_partial",
            totalResources: summary.totalResources,
            inScope: summary.inScope,
            warnings: summary.warnings,
            denied: summary.denied,
            missingScope: summary.missingScope,
            enforcementMode: summary.enforcementMode,
            productionEnforcement: summary.productionEnforcement,
            noSecretsExposed: true,
            envValuesExposed: false
          };
        })(),
        branchCleanup: (() => {
          const cleanupSummary = context.branchCleanupRecoveryService.getSummary();
          return {
            status: cleanupSummary.status,
            scans: cleanupSummary.scans,
            orphanRecords: cleanupSummary.orphanRecords,
            recommendations: cleanupSummary.recommendations,
            decisions: cleanupSummary.decisions,
            recoveryActions: cleanupSummary.recoveryActions,
            destructiveFutureRecommendations: cleanupSummary.destructiveFutureRecommendations,
            metadataOnlyRecommendations: cleanupSummary.metadataOnlyRecommendations,
            destructiveCleanupEnabled: cleanupSummary.destructiveCleanupEnabled,
            realBranchDeleted: cleanupSummary.realBranchDeleted,
            realWorktreeRemoved: cleanupSummary.realWorktreeRemoved,
            realPullRequestClosed: cleanupSummary.realPullRequestClosed,
            remoteGitCallsExecuted: cleanupSummary.remoteGitCallsExecuted,
            filesystemDeletionsExecuted: cleanupSummary.filesystemDeletionsExecuted,
            noSecretsExposed: cleanupSummary.noSecretsExposed,
            envValuesExposed: cleanupSummary.envValuesExposed
          };
        })(),
        auth: {
          providerKind: context.authorizationService.getConfig().providerKind,
          authMode: context.authorizationService.getConfig().authMode,
          productionAuthEnabled: false,
          selectedProviderKind: context.authorizationService.getConfig().selectedAuthProviderKind,
          selectedProviderStatus: context.authorizationService.getConfig().productionAuthProviderStatus,
          tokenValidationEnabled: false,
          sessionBoundaryStatus: context.authorizationService.getConfig().sessionBoundaryStatus,
          identityMappingStatus: context.authorizationService.getConfig().identityMappingStatus,
          mockActorEnabled: context.authorizationService.getConfig().mockActorEnabled,
          roleCatalogCount: context.authorizationService.getConfig().roleCatalogCount,
          permissionCatalogCount: context.authorizationService.getConfig().permissionCatalogCount,
          authorizationHeadersStored: false,
          cookiesStored: false,
          sessionIdsExposed: false,
          secretsExposed: false,
          tokensExposed: false,
          envValuesExposed: false
        },
        requestContext: context.apiRequestContextMiddleware.getSafeRequestContextSummary(apiRequestContext, { includeIds: false }) as unknown as JsonValue,
        authReadiness: {
          status: authRbacProduction.status,
          planningOnly: authRbacProduction.planningOnly,
          productionReady: authRbacProduction.productionReady,
          currentProfileId: authRbacProduction.currentProfileId,
          productionAuthEnabled: authRbacProduction.productionAuthEnabled,
          authMode: authRbacProduction.authMode,
          mockActorEnabled: authRbacProduction.mockActorEnabled,
          mockActorWarning: authRbacProduction.mockActorWarning,
          futureIdpConfigured: authRbacProduction.futureIdpConfigured,
          serviceAccountModelReady: authRbacProduction.serviceAccountModelReady,
          requestContextPropagationStatus: authRbacProduction.requestContextPropagationStatus,
          tenantScopeModelReady: authRbacProduction.tenantScopeModelReady,
          noTokensExposed: authRbacProduction.noTokensExposed,
          cookiesExposed: authRbacProduction.cookiesExposed,
          sessionIdsExposed: authRbacProduction.sessionIdsExposed,
          passwordsExposed: authRbacProduction.passwordsExposed,
          rawIdentityAssertionsExposed: authRbacProduction.rawIdentityAssertionsExposed,
          externalIdpCallsEnabled: authRbacProduction.externalIdpCallsEnabled,
          realSessionsImplemented: authRbacProduction.realSessionsImplemented,
          realJwtIssuanceImplemented: authRbacProduction.realJwtIssuanceImplemented
        },
        authProviderSkeleton: {
          status: productionAuthProvider.status,
          planningOnly: productionAuthProvider.planningOnly,
          activeProviderKind: productionAuthProvider.activeProviderKind,
          selectedProviderKind: productionAuthProvider.selectedProviderKind,
          selectedProviderStatus: productionAuthProvider.selectedProviderStatus,
          productionAuthEnabled: productionAuthProvider.productionAuthEnabled,
          requireAuthForApi: productionAuthProvider.requireAuthForApi,
          futureProviderSelected: productionAuthProvider.futureProviderSelected,
          futureProviderBlocked: productionAuthProvider.futureProviderBlocked,
          tokenValidationEnabled: productionAuthProvider.tokenValidationEnabled,
          sessionBoundaryEnabled: productionAuthProvider.sessionBoundaryEnabled,
          sessionBoundaryStatus: productionAuthProvider.sessionBoundaryStatus,
          identityMappingStatus: productionAuthProvider.identityMappingStatus,
          missingConfigCount: productionAuthProvider.missingConfigCount,
          blockerCount: productionAuthProvider.blockerCount,
          noTokensExposed: productionAuthProvider.noTokensExposed,
          authorizationHeadersStored: productionAuthProvider.authorizationHeadersStored,
          cookiesStored: productionAuthProvider.cookiesStored,
          sessionIdsExposed: productionAuthProvider.sessionIdsExposed,
          envValuesExposed: productionAuthProvider.envValuesExposed,
          secretsExposed: productionAuthProvider.secretsExposed,
          externalCallsEnabled: productionAuthProvider.externalCallsEnabled,
          externalIdpCallsEnabled: productionAuthProvider.externalIdpCallsEnabled,
          productionReady: productionAuthProvider.productionReady
        },
        oidcProviderSkeleton: {
          status: oidcProviderSkeleton.status,
          selected: oidcProviderSkeleton.selected,
          enabled: false,
          providerKind: oidcProviderSkeleton.providerKind,
          providerStatus: oidcProviderSkeleton.providerStatus,
          productionAuthEnabled: oidcProviderSkeleton.productionAuthEnabled,
          tokenValidationEnabled: oidcProviderSkeleton.tokenValidationEnabled,
          externalCallsEnabled: oidcProviderSkeleton.externalCallsEnabled,
          issuerConfigured: oidcProviderConfig.issuerConfigured,
          audienceConfigured: oidcProviderConfig.audienceConfigured,
          clientIdConfigured: oidcProviderConfig.clientIdConfigured,
          jwksUriConfigured: oidcJwks.jwksUriConfigured,
          discoveryUrlConfigured: oidcProviderConfig.discoveryUrlConfigured,
          claimsMappingConfigured: oidcProviderConfig.claimsMappingConfigured,
          discoveryFetchEnabled: oidcDiscovery.discoveryFetchEnabled,
          jwksFetchEnabled: oidcJwks.jwksFetchEnabled,
          claimsMappingStatus: oidcClaimsMapping.mappingStatus,
          tenantMappingStatus: oidcProviderConfig.tenantMappingConfigured ? "planned" : "not_configured",
          idTokenValidationEnabled: oidcTokenBoundary.idTokenValidationEnabled,
          accessTokenValidationEnabled: oidcTokenBoundary.accessTokenValidationEnabled,
          noTokensStored: oidcProviderSkeleton.noTokensStored,
          noSessionsIssued: oidcProviderSkeleton.noSessionsIssued,
          noCookiesStored: oidcProviderSkeleton.noCookiesStored,
          noSecretsExposed: oidcProviderSkeleton.noSecretsExposed,
          noEnvValuesExposed: true
        },
        providerAbstraction: {
          status: context.providerAbstractionService.getConfig().status,
          providerCatalogCount: context.providerAbstractionService.getConfig().providerCatalogCount,
          localAgentSupportEnabled: context.providerAbstractionService.getConfig().localAgentSupportEnabled,
          connectedLocalAgents: context.providerAbstractionService.getConfig().connectedLocalAgents,
          credentialManagerKind: context.providerAbstractionService.getConfig().credentialManagerKind,
          tokenResolverKind: context.providerAbstractionService.getConfig().tokenResolverKind
        },
        localAgentProtocol: {
          status: context.localAgentProtocolService.getConfig().status,
          transportKind: context.localAgentProtocolService.getConfig().transportKind,
          mockTransportEnabled: context.localAgentProtocolService.getConfig().mockTransportEnabled,
          fixtureDaemonSupportEnabled: context.localAgentProtocolService.getConfig().fixtureDaemonSupportEnabled,
          mockChannelSupportEnabled: context.localAgentProtocolService.getConfig().mockChannelSupportEnabled,
          connectedLocalAgents: context.localAgentProtocolService.getConfig().connectedAgents,
          connectedFixtureAgents: context.localAgentProtocolService.getConfig().connectedFixtureAgents,
          activeMockChannels: context.localAgentProtocolService.getConfig().activeMockChannels,
          pendingConsentRequests: context.localAgentProtocolService.getConfig().pendingConsentRequests,
          realTransportEnabled: false,
          vendorCliExecutionEnabled: false,
          localCliExecutionEnabled: false,
          credentialCacheAccessAllowed: false
        },
        mcp: {
          gatewayKind: context.mcpGatewayService.getConfig().gatewayKind,
          realMcpTransportEnabled: context.mcpGatewayService.getConfig().realTransportEnabled,
          serverCount: context.mcpGatewayService.getConfig().serverCount,
          activeToolCount: context.mcpGatewayService.getConfig().activeToolCount,
          highCriticalToolsEnabledCount: context.mcpGatewayService.getConfig().highCriticalEnabledToolCount,
          externalCallsEnabled: context.mcpGatewayService.getConfig().externalCallsEnabled,
          secretForwardingEnabled: context.mcpGatewayService.getConfig().secretForwardingEnabled,
          networkAccessEnabled: context.mcpGatewayService.getConfig().networkAccessEnabled,
          secretsExposed: false,
          tokensExposed: false
        },
        deploymentReadiness: {
          currentProfileId: context.deploymentReadinessService.getSummary().currentProfileId,
          productionReady: false,
          productionReadinessStatus: context.deploymentReadinessService.getSummary().productionReadinessStatus,
          criticalBlockerCount: context.deploymentReadinessService.getSummary().criticalBlockerCount,
          highRiskOpenCount: context.deploymentReadinessService.getSummary().highRiskOpenCount,
          planningOnly: true,
          realDeploymentImplemented: false,
          secretsExposed: false,
          tokensExposed: false
        },
        dashboardTenantScopePlanning: {
          status: tenantScopePlanning.status,
          implementationStatus: tenantScopePlanning.implementationStatus,
          scopeMetadataStatus: tenantScopePlanning.scopeMetadataStatus,
          planningOnly: tenantScopePlanning.planningOnly,
          dashboardPanelCount: tenantScopePlanning.dashboardPanelCount,
          readinessEndpointCount: tenantScopePlanning.readinessEndpointCount,
          dashboardPanelScopeSummaryCount: tenantScopePlanning.dashboardPanelScopeSummaryCount,
          readinessEndpointScopeSummaryCount: tenantScopePlanning.readinessEndpointScopeSummaryCount,
          panelsRequiringTenantScope: tenantScopePlanning.panelsRequiringTenantScope,
          endpointsRequiringTenantScope: tenantScopePlanning.endpointsRequiringTenantScope,
          secretAdjacentSurfaces: tenantScopePlanning.secretAdjacentSurfaces,
          auditScopedSurfaces: tenantScopePlanning.auditScopedSurfaces,
          productionBlockerCount: tenantScopePlanning.productionBlockerCount,
          tenantFilteringImplemented: tenantScopePlanning.tenantFilteringImplemented,
          productionTenantEnforcement: tenantScopePlanning.productionTenantEnforcement,
          productionEnforcementImplemented: false,
          productionReady: tenantScopePlanning.productionReady,
          noSecretsExposed: tenantScopePlanning.noSecretsExposed,
          envValuesExposed: tenantScopePlanning.envValuesExposed
        },
        tenantScopeEnforcement: {
          status: tenantScopeEnforcement.status,
          enforcementModes: tenantScopeEnforcement.enforcementModes,
          mismatchKinds: tenantScopeEnforcement.mismatchKinds,
          defaultMode: tenantScopeEnforcement.defaultMode,
          dashboardReadinessMetadataEnabled: tenantScopeEnforcement.dashboardReadinessMetadataEnabled,
          representativeEnforcementOnly: tenantScopeEnforcement.representativeEnforcementOnly,
          tenantFilteringImplemented: tenantScopeEnforcement.tenantFilteringImplemented,
          productionTenantEnforcement: tenantScopeEnforcement.productionTenantEnforcement,
          productionAuthImplemented: tenantScopeEnforcement.productionAuthImplemented,
          rowLevelSecurityImplemented: tenantScopeEnforcement.rowLevelSecurityImplemented,
          noSecretsExposed: tenantScopeEnforcement.noSecretsExposed,
          envValuesExposed: tenantScopeEnforcement.envValuesExposed
        },
        observability: {
          status: context.observabilityService.getConfig().status,
          aggregationMode: context.observabilityService.getConfig().aggregationMode,
          normalizedAuditEventCount: context.observabilityService.getAuditSummary().totalEvents,
          auditSourceCount: context.observabilityService.listAuditSources().length,
          retentionPolicyCount: context.observabilityService.listRetentionPolicies().length,
          metricDefinitionCount: context.observabilityService.listMetricDefinitions().length,
          traceSkeletonEnabled: true,
          externalBackendEnabled: false,
          externalExportEnabled: false,
          alertDeliveryEnabled: false,
          retentionDeletionJobsEnabled: false,
          rawPayloadStorageEnabled: false,
          secretsExposed: false,
          tokensExposed: false
        },
        auditQueryScope: {
          status: auditQueryScope.status,
          rawPayloadAllowed: auditQueryScope.rawPayloadAllowed,
          productionStorageEnforcement: auditQueryScope.productionStorageEnforcement,
          externalExportEnabled: auditQueryScope.externalExportEnabled,
          redactionPlanCount: auditQueryScope.redactionPlanCount,
          noSecretsExposed: auditQueryScope.noSecretsExposed,
          envValuesExposed: auditQueryScope.envValuesExposed
        },
        security: {
          secretManagerKind: context.securityService.getConfig().secretManagerKind,
          credentialManagerKind: context.securityService.getConfig().credentialManagerKind,
          envSecretProviderEnabled: context.securityService.getConfig().envSecretProviderEnabled,
          allowedSecretEnvKeyCount: context.securityService.getConfig().allowedSecretEnvKeyCount,
          activeSecretRefCount: context.securityService.getConfig().activeSecretRefCount,
          githubCredentialConfigured: context.securityService.getConfig().githubCredentialConfigured,
          githubWebhookSecretConfigured: context.securityService.getConfig().githubWebhookSecretConfigured,
          llmCredentialConfigured: context.securityService.getConfig().llmCredentialConfigured,
          sandboxSupportStatus: context.securityService.getConfig().sandboxSupportStatus,
          defaultSandboxProfile: context.securityService.getConfig().defaultSandboxProfile,
          networkDefaultAction: context.securityService.getConfig().networkDefaultAction,
          redactionEnabled: context.securityService.getConfig().redactionEnabled,
          productionSecretInjection: false,
          productionSandboxRuntime: false
        }
      });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "audit-scope") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Audit scope readiness endpoints are read-only." });
        return;
      }
      const auditScope = context.auditQueryScopeEnforcementService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "audit_scope_summary", {
          summary: auditScope.getSummary(),
          noSecretStatus: {
            noSecretsExposed: true,
            envValuesExposed: false,
            rawPayloadAllowed: false,
            productionStorageEnforcement: false,
            externalExportEnabled: false
          }
        }) as JsonValue);
        return;
      }
      if (segments.length === 3 && segments[2] === "redaction-plans") {
        sendJson(response, 200, readinessScopedPayload(context, "audit_scope_redaction_plans", {
          redactionPlans: auditScope.listRedactionPlans(),
          summary: auditScope.getSummary()
        }) as JsonValue);
        return;
      }
      sendJson(response, 404, { error: "audit_scope_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "agent-worktrees") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Agent worktree allocation readiness endpoints are read-only metadata." });
        return;
      }
      const worktreeService = context.agentWorktreeAllocationService;
      if (segments[2] === "summary" || segments.length === 2) {
        sendJson(response, 200, readinessScopedPayload(context, "agent_worktrees", {
          summary: agentWorktreeAllocationSummaryToDto(worktreeService.getSummary())
        }));
        return;
      }
      if (segments[2] === "safety-checks") {
        sendJson(response, 200, readinessScopedPayload(context, "agent_worktrees", {
          safetyChecks: worktreeService.listSafetyChecks({
            status: isAgentWorktreeSafetyStatus(url.searchParams.get("status")) ? url.searchParams.get("status") as AgentWorktreeSafetyStatus : undefined,
            checkKind: isAgentWorktreeSafetyCheckKind(url.searchParams.get("checkKind")) ? url.searchParams.get("checkKind") as AgentWorktreeSafetyCheckKind : undefined
          }).map(agentWorktreeSafetyCheckToDto)
        }));
        return;
      }
    }

    if (segments[0] === "readiness" && segments[1] === "registry" && segments[2] === "compatibility" && segments[3] === "summary") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Registry compatibility readiness endpoint is read-only metadata." });
        return;
      }
      sendJson(response, 200, readinessScopedPayload(context, "registry_compatibility", {
        summary: context.registryCompatibilityService.getSummary(),
        ruleCount: context.registryCompatibilityService.listRules().length,
        skillProfileCount: context.registryCompatibilityService.listSkillProfiles().length,
        harnessProfileCount: context.registryCompatibilityService.listHarnessProfiles().length,
        instructionProfileCount: context.registryCompatibilityService.listInstructionProfiles().length,
        resolverGatesPreserved: true,
        autoApplyEnabled: false,
        registryMutationsExecuted: false,
        externalCallsExecuted: false,
        noSecretsExposed: true
      }));
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "registry" && segments[2] === "artifact-trust" && segments[3] === "summary") {
      const readinessRequestContext = context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Registry artifact trust readiness endpoint is read-only metadata." });
        return;
      }
      const trustContext = registryArtifactTrustContextFromRequest(readinessRequestContext);
      const decisions = registryArtifactTrustInputsFromRegistry(context.registryService)
        .map((input) => context.registryArtifactTrustService.evaluateArtifactTrust(input, trustContext));
      sendJson(response, 200, readinessScopedPayload(context, "registry_artifact_trust", {
        summary: registryArtifactTrustSummaryToDto(context.registryArtifactTrustService.summarizeDecisions(decisions)),
        policies: context.registryArtifactTrustService.listTrustPolicies().map(registryArtifactTrustPolicyToDto),
        decisions: decisions.map(registryArtifactTrustDecisionToDto),
        resolverGatesPreserved: true,
        lifecycleApprovalEvalChecksumGatesPreserved: true,
        realSigningImplemented: false,
        realVerificationImplemented: false,
        signingKeysGenerated: false,
        externalRegistryCalls: false,
        noSecretsExposed: true,
        envValuesExposed: false
      }));
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "registry" && segments[2] === "evals" && segments[3] === "summary") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Registry eval suite readiness endpoint is read-only metadata." });
        return;
      }
      const evalService = context.evalSuiteExecutionService;
      const suites = evalService.listSuites();
      const runs = evalService.listEvalRuns();
      sendJson(response, 200, readinessScopedPayload(context, "registry_evals", {
        summary: registryEvalSummaryToDto(evalService.getEvalSummary()),
        suites: suites.map(registryEvalSuiteToDto),
        caseCount: suites.reduce((count, suite) => count + evalService.listCases(suite.id).length, 0),
        runCount: runs.length,
        verdicts: runs.flatMap((run) => {
          const verdict = evalService.getEvalVerdict(run.id);
          return verdict ? [registryEvalVerdictToDto(verdict)] : [];
        }),
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
      }));
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "registry" && segments[2] === "drift" && segments[3] === "summary") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Registry drift readiness endpoint is read-only metadata." });
        return;
      }
      const driftSummary = context.registryDriftDetectionService.getSummary();
      sendJson(response, 200, readinessScopedPayload(context, "registry_drift", {
        summary: driftSummary,
        signalCount: driftSummary.signalCount,
        baselineCount: driftSummary.baselineCount,
        assessmentCount: driftSummary.assessmentCount,
        recommendationCount: driftSummary.recommendationCount,
        applyAllowed: driftSummary.applyAllowed,
        evalExecuted: driftSummary.evalExecuted,
        canaryExecuted: driftSummary.canaryExecuted,
        autoImprovementApplied: driftSummary.autoImprovementApplied,
        registryMutationExecuted: driftSummary.registryMutationExecuted,
        externalCallExecuted: driftSummary.externalCallExecuted,
        noSecretsExposed: driftSummary.noSecretsExposed
      }));
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "registry" && segments[2] === "canary" && segments[3] === "summary") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Registry canary readiness endpoint is read-only metadata." });
        return;
      }
      const summary = context.registryCanaryApplyGetSummary();
      sendJson(response, 200, readinessScopedPayload(context, "registry_canary", {
        summary,
        canaryPlanCount: summary.canaryPlanCount,
        canaryRunCount: summary.canaryRunCount,
        canaryVerdictCount: summary.canaryVerdictCount,
        externalCanaryExecuted: summary.externalCanaryExecuted,
        autoApplyEnabled: summary.autoApplyEnabled,
        activeRegistryMutationAllowed: summary.activeRegistryMutationAllowed,
        applyPerformed: summary.applyPerformed,
        activeRegistryMutated: summary.activeRegistryMutated,
        realProviderCallExecuted: summary.realProviderCallExecuted,
        noSecretsExposed: summary.noSecretsExposed,
        envValuesExposed: summary.envValuesExposed
      }));
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "registry" && segments[2] === "apply-workflows" && segments[3] === "summary") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Registry apply workflows readiness endpoint is read-only metadata." });
        return;
      }
      const summary = context.registryCanaryApplyGetSummary();
      sendJson(response, 200, readinessScopedPayload(context, "registry_apply_workflow", {
        summary,
        applyWorkflowCount: summary.applyWorkflowCount,
        applyGateDecisionCount: summary.applyGateDecisionCount,
        readyForManualApplyCount: summary.readyForManualApplyCount,
        blockedApplyDecisionCount: summary.blockedApplyDecisionCount,
        metadataOnlyApplyDecisionCount: summary.metadataOnlyApplyDecisionCount,
        rollbackPlanCount: summary.rollbackPlanCount,
        autoApplyEnabled: summary.autoApplyEnabled,
        activeRegistryMutationAllowed: summary.activeRegistryMutationAllowed,
        applyPerformed: summary.applyPerformed,
        activeRegistryMutated: summary.activeRegistryMutated,
        noSecretsExposed: summary.noSecretsExposed,
        envValuesExposed: summary.envValuesExposed
      }));
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "registry" && segments[2] === "scope" && segments[3] === "summary") {
      const readinessRequestContext = context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Registry scope readiness endpoint is read-only metadata." });
        return;
      }
      const serviceContext = registryScopeContextFromRequest(readinessRequestContext);
      const decisions = context.registryTenantScopeEnforcementService.evaluateRegistryResources(
        registryScopeInputsFromRegistry(context.registryService),
        serviceContext
      );
      const approvalQueueDecisions = context.registryService.listApprovalQueue({ requestContext: readinessRequestContext })
        .map((item) => context.registryTenantScopeEnforcementService.evaluateApprovalQueueItem(item, serviceContext));
      sendJson(response, 200, readinessScopedPayload(context, "registry_scope", {
        summary: registryScopeEnforcementSummaryToDto(context.registryTenantScopeEnforcementService.summarizeDecisions([...decisions, ...approvalQueueDecisions])),
        decisions: decisions.map(registryScopeDecisionToDto),
        approvalQueueScopeSummary: registryScopeEnforcementSummaryToDto(context.registryTenantScopeEnforcementService.summarizeDecisions(approvalQueueDecisions)),
        resolverGatesPreserved: true,
        productionEnforcement: false,
        rowLevelSecurityImplemented: false,
        productionAuthImplemented: false,
        externalCallsExecuted: false,
        noSecretsExposed: true,
        envValuesExposed: false
      }));
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "pr-ownership") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "PR ownership readiness endpoints are read-only metadata." });
        return;
      }
      const repoId = url.searchParams.get("repoId") ?? undefined;
      sendJson(response, 200, readinessScopedPayload(context, "pr_ownership", {
        summary: context.prOwnershipService.getSummary(repoId),
        mergeQueueOwnershipReadiness: context.prOwnershipService.listMergeQueueOwnershipReadiness(repoId),
        remotePrUpdateEnabled: false,
        remoteReviewerAssignmentEnabled: false,
        githubApiCalls: false,
        autoMergeEnabled: false
      }));
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "merge-execution") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Real merge execution policy readiness endpoints are read-only metadata." });
        return;
      }
      const repoId = url.searchParams.get("repoId") ?? undefined;
      sendJson(response, 200, readinessScopedPayload(context, "real_merge_execution", {
        summary: context.realMergeExecutionPolicyService.getSummary(repoId),
        policy: context.realMergeExecutionPolicyService.getPolicy(),
        forbiddenOperations: context.realMergeExecutionPolicyService.listForbiddenOperations(),
        postExecutionEvidenceTemplate: context.realMergeExecutionPolicyService.getPostExecutionEvidenceTemplate(),
        mergeExecutionEnabled: false,
        autoMergeEnabled: false,
        remotePushEnabled: false
      }));
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "tenant-scope") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Dashboard/readiness tenant scope planning endpoints are read-only planning models." });
        return;
      }
      const planning = context.tenantScopePlanningService;
      if (segments.length === 3 && segments[2] === "dashboard-plans") {
        sendJson(response, 200, readinessScopedPayload(context, "tenant_scope", {
          dashboardPlans: planning.listDashboardPlans().map(dashboardTenantScopePlanToDto),
          panelScopeSummaries: planning.listDashboardPanelScopeSummaries().map(dashboardPanelScopeSummaryToDto)
        }));
        return;
      }
      if (segments.length === 3 && segments[2] === "dashboard-scope-summaries") {
        sendJson(response, 200, readinessScopedPayload(context, "tenant_scope", {
          panelScopeSummaries: planning.listDashboardPanelScopeSummaries().map(dashboardPanelScopeSummaryToDto)
        }));
        return;
      }
      if (segments.length === 3 && segments[2] === "readiness-plans") {
        sendJson(response, 200, readinessScopedPayload(context, "tenant_scope", {
          readinessPlans: planning.listReadinessPlans().map(readinessTenantScopePlanToDto),
          readinessScopeSummaries: planning.listReadinessEndpointScopeSummaries().map(readinessEndpointScopeSummaryToDto)
        }));
        return;
      }
      if (segments.length === 3 && segments[2] === "readiness-scope-summaries") {
        sendJson(response, 200, readinessScopedPayload(context, "tenant_scope", {
          readinessScopeSummaries: planning.listReadinessEndpointScopeSummaries().map(readinessEndpointScopeSummaryToDto)
        }));
        return;
      }
      if (segments.length === 3 && segments[2] === "role-visibility") {
        sendJson(response, 200, readinessScopedPayload(context, "tenant_scope", { roleVisibility: planning.getRoleVisibilityMatrix().map(tenantScopeRoleVisibilityToDto) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "fallback-behavior") {
        sendJson(response, 200, readinessScopedPayload(context, "tenant_scope", { fallbackBehavior: planning.getFallbackBehavior().map(tenantScopeFallbackBehaviorToDto) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "tenant_scope", { summary: tenantScopePlanningSummaryToDto(planning.getSummary()) }));
        return;
      }
      sendJson(response, 404, { error: "tenant_scope_planning_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "tenant-enforcement") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Tenant scope enforcement v1 endpoints are read-only metadata models." });
        return;
      }
      const enforcement = context.tenantScopeEnforcementService;
      if (segments.length === 3 && segments[2] === "modes") {
        sendJson(response, 200, {
          modes: enforcement.listModes().map(tenantScopeEnforcementModeToDto),
          summary: tenantScopeEnforcementSummaryToDto(enforcement.getSummary())
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "mismatches") {
        sendJson(response, 200, {
          mismatches: enforcement.listMismatches().map(tenantScopeMismatchToDto),
          summary: tenantScopeEnforcementSummaryToDto(enforcement.getSummary())
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, {
          summary: tenantScopeEnforcementSummaryToDto(enforcement.getSummary()),
          noSecretStatus: {
            noSecretsExposed: true,
            envValuesExposed: false,
            tenantFilteringImplemented: false,
            productionTenantEnforcement: false
          }
        });
        return;
      }
      sendJson(response, 404, { error: "tenant_scope_enforcement_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "scopes") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Scope readiness endpoints are read-only metadata models." });
        return;
      }
      const catalog = listMockScopeCatalog();
      const safeContextSummary = context.apiRequestContextMiddleware.getSafeRequestContextSummary(apiRequestContext, { includeIds: false });
      const envelope = (payload: Record<string, unknown>): Record<string, unknown> => readinessScopedPayload(context, "scopes", {
        ...payload,
        enforcementStatus: "planning_model_only",
        productionTenantEnforcement: false,
        productionAuthEnabled: false,
        tenantFilteringStatus: "future",
        noSecretsExposed: true,
        requestContext: safeContextSummary
      });
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, envelope({ summary: scopeSummary(catalog) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "tenants") {
        sendJson(response, 200, envelope({ tenants: catalog.tenants }));
        return;
      }
      if (segments.length === 3 && segments[2] === "teams") {
        sendJson(response, 200, envelope({ teams: catalog.teams }));
        return;
      }
      if (segments.length === 3 && segments[2] === "projects") {
        sendJson(response, 200, envelope({ projects: catalog.projects }));
        return;
      }
      if (segments.length === 3 && segments[2] === "repos") {
        sendJson(response, 200, envelope({ repos: catalog.repos }));
        return;
      }
      if (segments.length === 3 && segments[2] === "providers") {
        sendJson(response, 200, envelope({ providers: catalog.providers }));
        return;
      }
      if (segments.length === 3 && segments[2] === "models") {
        sendJson(response, 200, envelope({ models: catalog.models }));
        return;
      }
      if (segments.length === 3 && segments[2] === "secrets") {
        sendJson(response, 200, envelope({ secrets: catalog.secrets }));
        return;
      }
      if (segments.length === 3 && segments[2] === "mcp-tools") {
        sendJson(response, 200, envelope({ mcpTools: catalog.mcpTools }));
        return;
      }
      if (segments.length === 3 && segments[2] === "registry-packages") {
        sendJson(response, 200, envelope({ registryPackages: catalog.registryPackages }));
        return;
      }
      if (segments.length === 3 && segments[2] === "local-agents") {
        sendJson(response, 200, envelope({ localAgentHosts: catalog.localAgentHosts }));
        return;
      }
      if (segments.length === 3 && segments[2] === "audit-queries") {
        sendJson(response, 200, envelope({ auditQueries: catalog.auditQueries }));
        return;
      }
      sendJson(response, 404, { error: "scope_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "deployment") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Deployment readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "profiles") {
        sendJson(response, 200, { profiles: readiness.listProfiles().map(deploymentProfileToDto) });
        return;
      }
      if (segments.length === 4 && segments[2] === "profiles") {
        const profile = readiness.getProfile(segments[3] ?? "");
        if (!profile) {
          sendJson(response, 404, { error: "deployment_profile_not_found", message: `Deployment profile not found: ${segments[3]}` });
          return;
        }
        sendJson(response, 200, { profile: deploymentProfileToDto(profile) });
        return;
      }
      if (segments.length === 3 && segments[2] === "checks") {
        const profileId = url.searchParams.get("profileId") ?? undefined;
        sendJson(response, 200, {
          checks: readiness.listChecks(profileId === "local" || profileId === "integration" || profileId === "staging" || profileId === "production" ? { profileId } : {})
            .map(readinessCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "risks") {
        sendJson(response, 200, { risks: readiness.listRisks().map(productionRiskToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "deployment", { summary: deploymentReadinessSummaryToDto(readiness.getSummary()) }));
        return;
      }
      sendJson(response, 404, { error: "deployment_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "database") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Database operations readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "database", { summary: databaseOperationsSummaryToDto(readiness.getDatabaseOperationsSummary()) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "profiles") {
        sendJson(response, 200, { profiles: readiness.listDatabaseDeploymentProfiles().map(databaseDeploymentProfileToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "checks") {
        const profileId = url.searchParams.get("profileId") ?? undefined;
        sendJson(response, 200, {
          checks: readiness.listDatabaseReadinessChecks(profileId === "local" || profileId === "integration" || profileId === "staging" || profileId === "production" ? { profileId } : {})
            .map(databaseReadinessCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "risks") {
        sendJson(response, 200, { risks: readiness.listDatabaseOperationRisks().map(databaseOperationRiskToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "migrations") {
        sendJson(response, 200, { migrations: readiness.getDatabaseMigrationStatus().map(databaseMigrationStatusToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "schema") {
        sendJson(response, 200, { schema: readiness.getDatabaseSchemaInventory().map(databaseSchemaInventoryItemToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "index-review") {
        sendJson(response, 200, { indexReview: readiness.getDatabaseIndexReview().map(databaseIndexReviewItemToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "retention") {
        sendJson(response, 200, { retention: databaseRetentionPlanToDto(readiness.getDatabaseRetentionPlan()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "audit-growth") {
        sendJson(response, 200, { auditGrowth: databaseAuditGrowthPlanToDto(readiness.getDatabaseAuditGrowthPlan()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "webhook-persistence") {
        sendJson(response, 200, { webhookPersistence: databaseWebhookPersistencePlanToDto(readiness.getDatabaseWebhookPersistencePlan()) });
        return;
      }
      sendJson(response, 404, { error: "database_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "auth") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Production Auth/RBAC readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", { summary: authRbacProductionSummaryToDto(readiness.getAuthRbacProductionSummary()) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "providers") {
        sendJson(response, 200, { providers: readiness.listAuthProviderOptions().map(authProviderOptionToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "migration-phases") {
        sendJson(response, 200, { migrationPhases: readiness.listAuthRbacMigrationPhases().map(authRbacMigrationPhaseToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["identity_provider", "group_sync", "role_mapping", "tenant_isolation", "service_accounts", "local_agent_identity", "webhook_identity", "request_context", "audit_attribution", "mock_actor_deprecation", "policy_subject_mapping", "dashboard_visibility", "break_glass"];
        sendJson(response, 200, {
          checks: readiness.listAuthRbacReadinessChecks(category && categories.includes(category) ? { category: category as AuthRbacReadinessCategory } : {})
            .map(authRbacReadinessCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "risks") {
        sendJson(response, 200, { risks: readiness.listAuthRbacProductionRisks().map(authRbacProductionRiskToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "tenant-boundaries") {
        sendJson(response, 200, { tenantBoundaries: readiness.listTenantBoundaryPlans().map(tenantBoundaryPlanToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "service-accounts") {
        sendJson(response, 200, { serviceAccounts: readiness.listServiceAccountPlans().map(serviceAccountPlanToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "permission-matrix") {
        sendJson(response, 200, { permissionMatrix: readiness.listProductionRbacPermissionMatrix().map(authRbacPermissionMatrixEntryToDto) });
        return;
      }
      sendJson(response, 404, { error: "auth_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "auth-providers") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Production auth provider skeleton endpoints are read-only readiness models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 4 && segments[2] === "oidc" && segments[3] === "config") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", { oidcConfig: buildOidcProviderConfig(process.env) }));
        return;
      }
      if (segments.length === 4 && segments[2] === "oidc" && segments[3] === "discovery") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", { oidcDiscovery: buildOidcDiscoveryReadiness(process.env) }));
        return;
      }
      if (segments.length === 4 && segments[2] === "oidc" && segments[3] === "jwks") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", { oidcJwks: buildOidcJwksReadiness(process.env) }));
        return;
      }
      if (segments.length === 4 && segments[2] === "oidc" && segments[3] === "claims-mapping") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", { oidcClaimsMapping: buildOidcClaimsMappingPlan(process.env) }));
        return;
      }
      if (segments.length === 4 && segments[2] === "oidc" && segments[3] === "token-boundary") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", { oidcTokenBoundary: buildOidcTokenValidationBoundary(process.env) }));
        return;
      }
      if (segments.length === 4 && segments[2] === "oidc" && segments[3] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", { oidcSummary: buildOidcProviderSkeletonSummary(process.env) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "config") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", {
          selectedProvider: productionAuthProviderConfigToDto(readiness.listProductionAuthProviderConfigs().find((config) => config.metadata.selected === true) ?? readiness.listProductionAuthProviderConfigs()[0]),
          configs: readiness.listProductionAuthProviderConfigs().map(productionAuthProviderConfigToDto)
        }));
        return;
      }
      if (segments.length === 3 && segments[2] === "options") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", {
          configs: readiness.listProductionAuthProviderConfigs().map(productionAuthProviderConfigToDto),
          readiness: readiness.listProductionAuthProviderReadiness().map(productionAuthProviderReadinessToDto)
        }));
        return;
      }
      if (segments.length === 3 && segments[2] === "session-boundary") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", {
          sessionBoundary: readiness.listSessionTokenBoundaryPlans().map(sessionTokenBoundaryPlanToDto)
        }));
        return;
      }
      if (segments.length === 3 && segments[2] === "identity-mapping") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", {
          identityMapping: readiness.listIdentityMappingPlans().map(identityMappingPlanToDto)
        }));
        return;
      }
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "auth", {
          summary: productionAuthProviderSkeletonSummaryToDto(readiness.getProductionAuthProviderSkeletonSummary())
        }));
        return;
      }
      sendJson(response, 404, { error: "auth_provider_skeleton_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "secrets") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Secret backend migration readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "secrets", { summary: secretBackendMigrationSummaryToDto(readiness.getSecretBackendMigrationSummary()) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "backends") {
        sendJson(response, 200, { backends: readiness.listSecretBackendOptions().map(secretBackendOptionToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "migration-phases") {
        sendJson(response, 200, { migrationPhases: readiness.listSecretBackendMigrationPhases().map(secretBackendMigrationPhaseToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["backend_selection", "secret_ref_schema", "lease_ttl", "rotation", "audit", "auth_policy", "env_fallback", "provider_integration", "dashboard", "observability", "incident_response"];
        sendJson(response, 200, {
          checks: readiness.listSecretBackendReadinessChecks(category && categories.includes(category) ? { category: category as SecretBackendReadinessCategory } : {})
            .map(secretBackendReadinessCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "risks") {
        sendJson(response, 200, { risks: readiness.listSecretBackendRisks().map(secretBackendRiskToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "rotation-plans") {
        sendJson(response, 200, { rotationPlans: readiness.listSecretRotationPlans().map(secretRotationPlanToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "lease-policies") {
        sendJson(response, 200, { leasePolicies: readiness.listSecretLeasePolicies().map(secretLeasePolicyToDto) });
        return;
      }
      if (segments.length === 4 && segments[2] === "vault" && segments[3] === "config") {
        sendJson(response, 200, { config: vaultSecretProviderConfigToDto(context.securityService.getVaultConfig()) });
        return;
      }
      if (segments.length === 4 && segments[2] === "vault" && segments[3] === "checks") {
        sendJson(response, 200, { checks: context.securityService.listVaultReadinessChecks() });
        return;
      }
      if (segments.length === 4 && segments[2] === "vault" && segments[3] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "vault_secret_backend", { summary: context.securityService.getVaultSummary() }));
        return;
      }
      sendJson(response, 404, { error: "secret_backend_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "secret-backend-decision") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Secret backend option decision endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "secret_backend_decision", { summary: secretBackendOptionDecisionSummaryToDto(readiness.getSecretBackendOptionDecisionSummary()) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "decision") {
        sendJson(response, 200, { decision: secretBackendOptionDecisionToDto(readiness.getSecretBackendOptionDecision()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "criteria") {
        sendJson(response, 200, { criteria: readiness.listSecretBackendDecisionCriteria().map(secretBackendDecisionCriterionToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "scores") {
        sendJson(response, 200, { scores: readiness.listSecretBackendDecisionScores().map(secretBackendDecisionScoreToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "implementation-scope") {
        sendJson(response, 200, { implementationScopes: readiness.listSecretBackendImplementationScopes().map(secretBackendImplementationScopeToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "risks") {
        sendJson(response, 200, { risks: readiness.listSecretBackendDecisionRisks().map(secretBackendDecisionRiskToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "provider-mapping") {
        sendJson(response, 200, { providerMappings: readiness.listSecretBackendProviderMappings().map(secretBackendProviderMappingToDto) });
        return;
      }
      sendJson(response, 404, { error: "secret_backend_decision_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "github-app") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "GitHub App readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "github_app", {
          summary: githubWebhookHardeningSummaryToDto(readiness.getGitHubWebhookHardeningSummary()),
          descriptors: readiness.listGitHubAppDescriptors().map(githubAppDescriptorToDto),
          installations: readiness.listGitHubAppInstallations().map(githubAppInstallationToDto),
          repositoryGrants: readiness.listGitHubAppRepositoryGrants().map(githubAppRepositoryGrantToDto),
          readinessChecks: readiness.listGitHubAppReadinessChecks().map(githubAppReadinessCheckToDto)
        }));
        return;
      }
      if (segments.length === 3 && segments[2] === "permissions") {
        sendJson(response, 200, { permissions: readiness.listGitHubAppPermissionMatrix().map(githubAppPermissionMatrixEntryToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "webhook-events") {
        sendJson(response, 200, { events: readiness.listGitHubWebhookEventAllowlist().map(githubWebhookEventAllowlistEntryToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "replay-protection") {
        sendJson(response, 200, {
          plan: githubWebhookReplayProtectionPlanToDto(readiness.getGitHubWebhookReplayProtectionPlan()),
          deliveryRecords: readiness.listGitHubWebhookDeliveryRecords().map(githubWebhookDeliveryRecordToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "dead-letter") {
        sendJson(response, 200, {
          plan: githubWebhookDeadLetterPlanToDto(readiness.getGitHubWebhookDeadLetterPlan()),
          records: readiness.listGitHubWebhookDeadLetterRecords().map(githubWebhookDeadLetterRecordToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "credentials") {
        sendJson(response, 200, { readiness: githubAppCredentialReadinessToDto(readiness.getGitHubAppCredentialReadiness()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "endpoint") {
        sendJson(response, 200, { endpoint: githubProductionWebhookEndpointPlanToDto(readiness.getGitHubProductionWebhookEndpointPlan()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "risks") {
        sendJson(response, 200, { risks: readiness.listGitHubAppProductionRisks().map(githubAppProductionRiskToDto) });
        return;
      }
      sendJson(response, 404, { error: "github_app_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "github-app-integration") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "GitHub App integration-test readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "profile") {
        sendJson(response, 200, { profile: githubAppIntegrationTestProfileToDto(readiness.getGitHubAppIntegrationTestProfile()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "test-cases") {
        sendJson(response, 200, { testCases: readiness.listGitHubAppIntegrationTestCases().map(githubAppIntegrationTestCaseToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "safety-checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["env_gates", "repo_allowlist", "branch_prefix", "secretref", "cleanup", "no_auto_merge", "no_force_push", "no_branch_delete", "audit", "observability"];
        sendJson(response, 200, {
          safetyChecks: readiness.listGitHubAppIntegrationTestSafetyChecks(category && categories.includes(category) ? { category: category as GitHubAppIntegrationTestSafetyCategory } : {})
            .map(githubAppIntegrationTestSafetyCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "github_app_integration", { summary: githubAppIntegrationTestReadinessSummaryToDto(readiness.getGitHubAppIntegrationTestReadinessSummary()) }));
        return;
      }
      sendJson(response, 404, { error: "github_app_integration_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "llm-integration") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "LLM integration-test readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "profile") {
        sendJson(response, 200, { profile: llmIntegrationTestProfileToDto(readiness.getLLMIntegrationTestProfile()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "test-cases") {
        sendJson(response, 200, { testCases: readiness.listLLMIntegrationTestCases().map(llmIntegrationTestCaseToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "safety-checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["env_gates", "secretref", "model_allowlist", "budget", "policy", "auth", "redaction", "audit", "no_streaming", "no_tool_calls", "no_unbounded_fallback"];
        sendJson(response, 200, {
          safetyChecks: readiness.listLLMIntegrationTestSafetyChecks(category && categories.includes(category) ? { category: category as LLMIntegrationTestSafetyCategory } : {})
            .map(llmIntegrationTestSafetyCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "llm_integration", { summary: llmIntegrationTestReadinessSummaryToDto(readiness.getLLMIntegrationTestReadinessSummary()) }));
        return;
      }
      sendJson(response, 404, { error: "llm_integration_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "vault-integration") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Vault integration-test readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "profile") {
        sendJson(response, 200, { profile: vaultIntegrationTestProfileToDto(readiness.getVaultIntegrationTestProfile()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "test-cases") {
        sendJson(response, 200, { testCases: readiness.listVaultIntegrationTestCases().map(vaultIntegrationTestCaseToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "safety-checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["env_gates", "vault_address", "auth_method", "token_presence", "path_allowlist", "test_secret_path", "no_write", "no_delete", "no_rotate", "no_broad_list", "redaction", "audit", "no_secret_exposure"];
        sendJson(response, 200, {
          safetyChecks: readiness.listVaultIntegrationTestSafetyChecks(category && categories.includes(category) ? { category: category as VaultIntegrationTestSafetyCategory } : {})
            .map(vaultIntegrationTestSafetyCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "vault_integration", { summary: vaultIntegrationTestReadinessSummaryToDto(readiness.getVaultIntegrationTestReadinessSummary()) }));
        return;
      }
      sendJson(response, 404, { error: "vault_integration_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "merge-queue-integration") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Merge queue integration-test readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "profile") {
        sendJson(response, 200, { profile: mergeQueueIntegrationTestProfileToDto(readiness.getMergeQueueIntegrationTestProfile()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "test-cases") {
        sendJson(response, 200, { testCases: readiness.listMergeQueueIntegrationTestCases().map(mergeQueueIntegrationTestCaseToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "safety-checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["env_gates", "repo_allowlist", "branch_prefix", "no_auto_merge", "no_force_push", "no_branch_delete", "dry_run_only", "cleanup", "audit"];
        sendJson(response, 200, {
          safetyChecks: readiness.listMergeQueueIntegrationSafetyChecks(category && categories.includes(category) ? { category: category as MergeQueueIntegrationSafetyCategory } : {})
            .map(mergeQueueIntegrationSafetyCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "merge_queue_integration", { summary: mergeQueueIntegrationTestReadinessSummaryToDto(readiness.getMergeQueueIntegrationTestReadinessSummary()) }));
        return;
      }
      sendJson(response, 404, { error: "merge_queue_integration_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "policy-bundles") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Policy bundle readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "policy_bundles", { summary: policyBundleReadinessSummaryToDto(readiness.getPolicyBundleReadinessSummary()) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "engines") {
        sendJson(response, 200, { engines: readiness.listPolicyEngineOptions().map(policyEngineOptionToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "plans") {
        sendJson(response, 200, { plans: readiness.listPolicyBundlePlans().map(policyBundlePlanToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "domain-mapping") {
        sendJson(response, 200, { domainMapping: readiness.listPolicyDomainMappings().map(policyDomainMappingToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["engine_selection", "bundle_schema", "signing", "review_workflow", "rollout", "rollback", "tests", "audit", "break_glass", "tenant_scoping", "auth_mapping", "secret_policy", "provider_policy", "dashboard"];
        sendJson(response, 200, {
          checks: readiness.listPolicyBundleReadinessChecks(category && categories.includes(category) ? { category: category as PolicyBundleReadinessCategory } : {})
            .map(policyBundleReadinessCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "risks") {
        sendJson(response, 200, { risks: readiness.listPolicyBundleRisks().map(policyBundleRiskToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "migration-phases") {
        sendJson(response, 200, { migrationPhases: readiness.listPolicyBundleMigrationPhases().map(policyBundleMigrationPhaseToDto) });
        return;
      }
      sendJson(response, 404, { error: "policy_bundle_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "policy-runtime-poc") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Policy runtime PoC readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, { summary: policyRuntimePocSummaryToDto(readiness.getPolicyRuntimePocSummary()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "options") {
        sendJson(response, 200, { options: readiness.listPolicyRuntimePocOptions().map(policyRuntimePocOptionToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "input-contract") {
        sendJson(response, 200, { inputContract: policyRuntimePocInputContractToDto(readiness.getPolicyRuntimePocInputContract()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "domain-mappings") {
        sendJson(response, 200, { domainMappings: readiness.listPolicyRuntimePocDomainMappings().map(policyRuntimePocDomainMappingToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "golden-cases") {
        sendJson(response, 200, { goldenCases: readiness.listPolicyRuntimePocGoldenCases().map(policyRuntimePocGoldenCaseToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "golden-summary") {
        const goldenHarness = runPolicyRuntimeGoldenHarness();
        sendJson(response, 200, {
          goldenSummary: goldenHarness.summary,
          goldenResults: goldenHarness.results.map((result) => ({
            id: result.id,
            domain: result.domain,
            action: result.action,
            passed: result.passed,
            expectedEffect: result.expectedEffect,
            actualEffect: result.actualEffect,
            expectedRuleId: result.expectedRuleId,
            actualRuleId: result.actualRuleId,
            mismatchCount: result.mismatches.length
          }))
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["goals", "input_contract", "domain_mapping", "golden_tests", "shadow_evaluation", "rollout", "rollback", "safety", "audit", "dashboard"];
        sendJson(response, 200, {
          checks: readiness.listPolicyRuntimePocReadinessChecks(category && categories.includes(category) ? { category: category as PolicyRuntimePocReadinessCategory } : {})
            .map(policyRuntimePocReadinessCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "risks") {
        sendJson(response, 200, { risks: readiness.listPolicyRuntimePocRisks().map(policyRuntimePocRiskToDto) });
        return;
      }
      sendJson(response, 404, { error: "policy_runtime_poc_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "policy-shadow") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Policy shadow evaluation endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "plan") {
        sendJson(response, 200, { plan: policyShadowEvaluationPlanToDto(readiness.getPolicyShadowEvaluationPlan()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "comparison-rules") {
        sendJson(response, 200, { comparisonRules: readiness.listPolicyShadowComparisonRules().map(policyShadowComparisonRuleToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "mismatches") {
        sendJson(response, 200, { mismatches: readiness.listPolicyShadowMismatches().map(policyShadowMismatchToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "reports") {
        sendJson(response, 200, { reports: readiness.listPolicyShadowEvaluationReports().map(policyShadowEvaluationReportToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["input_contract", "golden_cases", "candidate_runtime", "comparison_rules", "audit", "observability", "dashboard", "rollout", "rollback", "safety"];
        sendJson(response, 200, {
          checks: readiness.listPolicyShadowReadinessChecks(category && categories.includes(category) ? { category: category as PolicyShadowReadinessCategory } : {})
            .map(policyShadowReadinessCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "policy_shadow", { summary: policyShadowEvaluationSummaryToDto(readiness.getPolicyShadowEvaluationSummary()) }));
        return;
      }
      sendJson(response, 404, { error: "policy_shadow_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "staging") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Staging deployment profile endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "staging", { summary: stagingDeploymentSummaryToDto(readiness.getStagingDeploymentSummary()) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "profile") {
        sendJson(response, 200, { profile: stagingDeploymentProfileToDto(readiness.getStagingDeploymentProfile()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "gates") {
        sendJson(response, 200, { gates: readiness.listStagingIntegrationGates().map(stagingIntegrationGateToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["storage", "auth", "secrets", "git", "github_app", "webhook", "llm", "mcp", "runner", "local_agent", "policy", "observability", "dashboard", "ci", "security"];
        sendJson(response, 200, {
          checks: readiness.listStagingReadinessChecks(category && categories.includes(category) ? { category: category as StagingReadinessCategory } : {})
            .map(stagingReadinessCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "promotion-criteria") {
        sendJson(response, 200, { promotionCriteria: readiness.listStagingPromotionCriteria().map(stagingPromotionCriterionToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "rollback-criteria") {
        sendJson(response, 200, { rollbackCriteria: readiness.listStagingRollbackCriteria().map(stagingRollbackCriterionToDto) });
        return;
      }
      sendJson(response, 404, { error: "staging_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "staging-dry-run") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Staging deployment dry-run endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "staging_dry_run", { summary: stagingDeploymentDryRunSummaryToDto(readiness.getStagingDeploymentDryRunSummary()) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "profile") {
        sendJson(response, 200, { profile: stagingDeploymentDryRunProfileToDto(readiness.getStagingDeploymentDryRunProfile()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "sources") {
        sendJson(response, 200, { sources: readiness.listStagingDeploymentDryRunSources().map(stagingDeploymentDryRunSourceToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["validation", "environment", "storage", "secrets", "auth", "policy", "git", "github_app", "webhook", "llm", "mcp", "runner", "local_agent", "observability", "dashboard", "ci_cd", "security", "rollback"];
        sendJson(response, 200, {
          checks: readiness.listStagingDeploymentDryRunChecks(category && categories.includes(category) ? { category: category as StagingDeploymentDryRunCheckCategory } : {})
            .map(stagingDeploymentDryRunCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "blockers") {
        sendJson(response, 200, { blockers: readiness.listStagingDeploymentDryRunBlockers().map(stagingDeploymentDryRunBlockerToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "report") {
        sendJson(response, 200, { report: stagingDeploymentDryRunReportToDto(readiness.generateStagingDeploymentDryRunReport()) });
        return;
      }
      sendJson(response, 404, { error: "staging_dry_run_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "staging-rc") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Staging release candidate checklist endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "staging_rc", { summary: stagingReleaseCandidateSummaryToDto(readiness.getStagingReleaseCandidateSummary()) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "checklist") {
        sendJson(response, 200, { checklist: stagingReleaseCandidateChecklistToDto(readiness.getStagingReleaseCandidateChecklist()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "gates") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["validation", "docs", "staging_dry_run", "ci_cd", "git_integration", "llm_integration", "mcp", "db", "secrets", "auth", "policy", "observability", "dashboard", "security", "rollback"];
        sendJson(response, 200, {
          gates: readiness.listStagingReleaseCandidateGates(category && categories.includes(category) ? { category: category as StagingReleaseCandidateGateCategory } : {})
            .map(stagingReleaseCandidateGateToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "blockers") {
        sendJson(response, 200, { blockers: readiness.listStagingReleaseCandidateBlockers().map(stagingReleaseCandidateBlockerToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "signoffs") {
        sendJson(response, 200, { signoffs: readiness.listStagingReleaseCandidateSignoffs().map(stagingReleaseCandidateSignoffToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "release-notes") {
        sendJson(response, 200, { releaseNoteRequirements: readiness.listStagingReleaseNoteRequirements().map(stagingReleaseNoteRequirementToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "rollback") {
        sendJson(response, 200, { rollbackChecklist: readiness.listStagingRollbackChecklist().map(stagingRollbackChecklistItemToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "report") {
        sendJson(response, 200, { report: stagingReleaseCandidateReportToDto(readiness.generateStagingReleaseCandidateReport()) });
        return;
      }
      sendJson(response, 404, { error: "staging_rc_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "staging-execution") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Staging deployment execution endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "staging_execution", { summary: stagingDeploymentExecutionSummaryToDto(readiness.getStagingDeploymentExecutionSummary()) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "plan") {
        sendJson(response, 200, { plan: stagingDeploymentExecutionPlanToDto(readiness.getStagingDeploymentExecutionPlan()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "steps") {
        sendJson(response, 200, { steps: readiness.listStagingDeploymentExecutionSteps().map(stagingDeploymentStepToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "gates") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["validation", "signoff", "environment", "database", "secrets", "auth", "policy", "git", "github_app", "webhook", "llm", "vault", "mcp", "observability", "dashboard", "rollback"];
        sendJson(response, 200, {
          gates: readiness.listStagingDeploymentExecutionGates(category && categories.includes(category) ? { category: category as StagingDeploymentGateCategory } : {})
            .map(stagingDeploymentGateToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "go-no-go") {
        sendJson(response, 200, { decision: stagingDeploymentGoNoGoDecisionToDto(readiness.getStagingDeploymentGoNoGoDecision()) });
        return;
      }
      if (segments.length === 3 && segments[2] === "rollback") {
        sendJson(response, 200, { rollback: stagingDeploymentRollbackPlanToDto(readiness.getStagingDeploymentRollbackPlan()) });
        return;
      }
      sendJson(response, 404, { error: "staging_execution_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "readiness" && segments[1] === "ci-cd") {
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Staging CI/CD readiness endpoints are read-only planning models." });
        return;
      }
      const readiness = context.deploymentReadinessService;
      if (segments.length === 3 && segments[2] === "summary") {
        sendJson(response, 200, readinessScopedPayload(context, "ci_cd", { summary: cicdPipelineReadinessSummaryToDto(readiness.getCicdPipelineReadinessSummary()) }));
        return;
      }
      if (segments.length === 3 && segments[2] === "profiles") {
        sendJson(response, 200, { profiles: readiness.listCicdPipelineProfiles().map(cicdPipelineProfileToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "jobs") {
        const profileId = url.searchParams.get("profileId") ?? undefined;
        const category = url.searchParams.get("category") ?? undefined;
        const profiles = ["local_validation", "pull_request", "integration", "staging", "release_candidate"];
        const categories = ["install", "lint", "typecheck", "test", "build", "security_scan", "secret_scan", "optional_postgres", "optional_remote_git", "optional_github_app", "optional_webhook", "optional_remote_llm", "optional_mcp", "optional_auth", "dashboard_smoke", "readiness_check"];
        sendJson(response, 200, {
          jobs: readiness.listCicdJobDefinitions({
            profileId: profileId && profiles.includes(profileId) ? profileId as CICDPipelineProfileName : undefined,
            category: category && categories.includes(category) ? category as CICDJobCategory : undefined
          }).map(cicdJobDefinitionToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "integration-gates") {
        sendJson(response, 200, { integrationGates: readiness.listCicdIntegrationTestGates().map(cicdIntegrationTestGateToDto) });
        return;
      }
      if (segments.length === 3 && segments[2] === "checks") {
        const category = url.searchParams.get("category") ?? undefined;
        const categories = ["node", "package_manager", "validation", "test_profiles", "secrets", "integration_gates", "artifacts", "cleanup", "rollback", "security", "staging_promotion"];
        sendJson(response, 200, {
          checks: readiness.listCicdReadinessChecks(category && categories.includes(category) ? { category: category as CICDReadinessCategory } : {})
            .map(cicdReadinessCheckToDto)
        });
        return;
      }
      if (segments.length === 3 && segments[2] === "risks") {
        sendJson(response, 200, { risks: readiness.listCicdRisks().map(cicdRiskToDto) });
        return;
      }
      sendJson(response, 404, { error: "cicd_readiness_route_not_found" });
      return;
    }

    if (segments[0] === "observability") {
      const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
      const auditScope = context.auditQueryScopeEnforcementService;
      if (segments.length === 4 && segments[1] === "audit" && segments[2] === "query-scope" && segments[3] === "check") {
        if (method !== "POST") {
          sendJson(response, 405, { error: "method_not_allowed", message: "Audit query scope checks use POST and do not mutate audit storage." });
          return;
        }
        const body = recordValue(await readJson(request));
        const decision = auditScope.evaluateAuditQuery({
          id: stringValue(body.id),
          actorId: stringValue(body.actorId),
          principalId: stringValue(body.principalId),
          roles: stringArrayValue(body.roles),
          tenantIds: stringArrayValue(body.tenantIds),
          teamIds: stringArrayValue(body.teamIds),
          projectIds: stringArrayValue(body.projectIds),
          repoIds: stringArrayValue(body.repoIds),
          providerIds: stringArrayValue(body.providerIds),
          resourceKinds: stringArrayValue(body.resourceKinds),
          auditSources: stringArrayValue(body.auditSources),
          requestedDetailLevel: parseAuditQueryDetailLevel(stringValue(body.requestedDetailLevel)) ?? "summary",
          metadata: {
            ...recordValue(body.metadata),
            source: "observability:audit_query_scope_check"
          }
        }, requestContext);
        sendJson(response, 200, {
          decision,
          summary: auditScope.summarizeAuditQueryDecision(decision),
          redactionPlans: auditScope.listRedactionPlans()
        } as JsonValue);
        return;
      }
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Observability endpoints are read-only." });
        return;
      }
      const observability = context.observabilityService;
      if (segments.length === 2 && segments[1] === "config") {
        sendJson(response, 200, {
          config: observabilityConfigToDto(observability.getConfig()),
          retentionPolicies: observability.listRetentionPolicies().map(auditRetentionPolicyToDto)
        } as JsonValue);
        return;
      }
      if (segments[1] === "audit") {
        if (segments.length === 3 && segments[2] === "events") {
          const decision = auditScope.evaluateAuditQuery({
            requestedDetailLevel: parseAuditQueryDetailLevel(url.searchParams.get("detailLevel")) ?? "metadata",
            resourceKinds: csvQueryValues(url, "resourceKind", "resourceKinds"),
            auditSources: csvQueryValues(url, "auditSource", "auditSources", "source", "sources"),
            metadata: {
              source: "observability:audit_events",
              auditQueryScope: url.searchParams.get("auditQueryScope") === "present" ? "present" : undefined
            }
          }, requestContext);
          const result = auditQueryResultToDto(observability.listAuditEvents({
            categories: parseAuditCategories(url),
            eventTypes: csvQueryValues(url, "eventType", "eventTypes"),
            actorId: url.searchParams.get("actorId") ?? undefined,
            taskId: url.searchParams.get("taskId") ?? undefined,
            taskRunId: url.searchParams.get("taskRunId") ?? undefined,
            providerId: url.searchParams.get("providerId") ?? undefined,
            outcome: parseAuditOutcome(url),
            severity: parseAuditSeverity(url),
            since: parseDateQuery(url, "since"),
            until: parseDateQuery(url, "until"),
            limit: parsePositiveIntegerQuery(url, "limit")
          }));
          sendJson(response, 200, auditScope.redactAuditResult(result, decision) as JsonValue);
          return;
        }
        if (segments.length === 3 && segments[2] === "summary") {
          sendJson(response, 200, { summary: auditSummaryToDto(observability.getAuditSummary()) } as JsonValue);
          return;
        }
        if (segments.length === 3 && segments[2] === "retention-classes") {
          sendJson(response, 200, { retentionClasses: observability.listRetentionClasses().map(auditRetentionClassToDto) } as JsonValue);
          return;
        }
        if (segments.length === 3 && segments[2] === "redaction-classes") {
          sendJson(response, 200, { redactionClasses: observability.listRedactionClasses().map(auditRedactionClassToDto) } as JsonValue);
          return;
        }
        if (segments.length === 3 && segments[2] === "sources") {
          sendJson(response, 200, { sources: observability.listAuditSources().map(auditSourceCoverageToDto) } as JsonValue);
          return;
        }
      }
      if (segments.length === 2 && segments[1] === "metrics") {
        sendJson(response, 200, { metrics: observability.listMetricDefinitions().map(metricDefinitionToDto) } as JsonValue);
        return;
      }
      if (segments.length === 3 && segments[1] === "metrics" && segments[2] === "snapshot") {
        sendJson(response, 200, { snapshot: metricSnapshotToDto(observability.getMetricSnapshot()) } as JsonValue);
        return;
      }
      if (segments.length === 2 && segments[1] === "traces") {
        sendJson(response, 200, {
          traceSpans: observability.listTraceSpans({
            traceId: url.searchParams.get("traceId") ?? undefined,
            taskId: url.searchParams.get("taskId") ?? undefined,
            taskRunId: url.searchParams.get("taskRunId") ?? undefined,
            providerId: url.searchParams.get("providerId") ?? undefined,
            limit: parsePositiveIntegerQuery(url, "limit")
          }).map(traceSpanToDto)
        } as JsonValue);
        return;
      }
      sendJson(response, 404, { error: "observability_route_not_found" });
      return;
    }

    if (segments[0] === "dashboard") {
      context.apiRequestContextMiddleware.requireApiContext(request);
      if (method !== "GET") {
        sendJson(response, 405, { error: "method_not_allowed", message: "Dashboard read models are read-only." });
        return;
      }
      const filterHeaderInput = parseDashboardFilterHeaders(request.headers as Record<string, string | string[] | undefined>);
      const filterContext = Object.keys(filterHeaderInput).length > 0
        ? context.dashboardScopeFilteringService.buildFilterContext({
          ...filterHeaderInput,
          source: "api",
          authMode: "demo_request_header"
        })
        : undefined;
      const dashboard = buildDashboardReadModels(context, "api", filterContext);
      const section = segments[1] ?? "overview";
      if (section === "scope-filter") {
        sendJson(response, 200, { dashboardScopeFilter: dashboard.dashboardScopeFilter });
        return;
      }
      if (section === "overview" && segments.length <= 2) {
        sendJson(response, 200, { overview: dashboard.overview });
        return;
      }
      if (section === "tasks") {
        sendJson(response, 200, { tasks: dashboard.tasks });
        return;
      }
      if (section === "git") {
        sendJson(response, 200, { git: dashboard.git });
        return;
      }
      if (section === "github-app") {
        sendJson(response, 200, { githubApp: dashboard.githubApp });
        return;
      }
      if (section === "github-app-integration") {
        sendJson(response, 200, { githubAppIntegration: dashboard.githubAppIntegration });
        return;
      }
      if (section === "conflicts") {
        sendJson(response, 200, { conflicts: dashboard.conflicts });
        return;
      }
      if (section === "registry") {
        sendJson(response, 200, { registry: dashboard.registry });
        return;
      }
      if (section === "llm") {
        sendJson(response, 200, { llm: dashboard.llm });
        return;
      }
      if (section === "llm-integration") {
        sendJson(response, 200, { llmIntegration: dashboard.llmIntegration });
        return;
      }
      if (section === "agents") {
        sendJson(response, 200, { agents: dashboard.agents });
        return;
      }
      if (section === "policy") {
        sendJson(response, 200, { policy: dashboard.policy });
        return;
      }
      if (section === "policy-bundles") {
        sendJson(response, 200, { policyBundles: dashboard.policyBundles });
        return;
      }
      if (section === "policy-shadow") {
        sendJson(response, 200, { policyShadow: dashboard.policyShadow });
        return;
      }
      if (section === "policy-runtime-poc") {
        sendJson(response, 200, { policyRuntimePoc: dashboard.policyRuntimePoc });
        return;
      }
      if (section === "auth") {
        sendJson(response, 200, { auth: dashboard.auth });
        return;
      }
      if (section === "auth-production") {
        sendJson(response, 200, { authProduction: dashboard.authProduction });
        return;
      }
      if (section === "auth-providers") {
        sendJson(response, 200, { authProviders: dashboard.authProviders });
        return;
      }
      if (section === "providers") {
        sendJson(response, 200, { providers: dashboard.providers });
        return;
      }
      if (section === "security") {
        sendJson(response, 200, { security: dashboard.security });
        return;
      }
      if (section === "local-agents") {
        sendJson(response, 200, { localAgents: dashboard.localAgents });
        return;
      }
      if (section === "mcp") {
        sendJson(response, 200, { mcp: dashboard.mcp });
        return;
      }
      if (section === "scopes") {
        sendJson(response, 200, { scopes: dashboard.scopes });
        return;
      }
      if (section === "tenant-scope") {
        sendJson(response, 200, { tenantScopePlanning: dashboard.tenantScopePlanning });
        return;
      }
      if (section === "tenant-enforcement") {
        sendJson(response, 200, { tenantScopeEnforcement: dashboard.tenantScopeEnforcement });
        return;
      }
      if (section === "scope-filter") {
        sendJson(response, 200, { dashboardScopeFilter: dashboard.dashboardScopeFilter });
        return;
      }
      if (section === "readiness") {
        sendJson(response, 200, { readiness: dashboard.readiness });
        return;
      }
      if (section === "database") {
        sendJson(response, 200, { database: dashboard.database });
        return;
      }
      if (section === "secret-backend") {
        sendJson(response, 200, { secretBackend: dashboard.secretBackend });
        return;
      }
      if (section === "secret-backend-decision") {
        sendJson(response, 200, { secretBackendDecision: dashboard.secretBackendDecision });
        return;
      }
      if (section === "vault-secret-backend") {
        sendJson(response, 200, { vaultSecretBackend: dashboard.vaultSecretBackend });
        return;
      }
      if (section === "vault-integration") {
        sendJson(response, 200, { vaultIntegration: dashboard.vaultIntegration });
        return;
      }
      if (section === "merge-queue-integration") {
        sendJson(response, 200, { mergeQueueIntegration: dashboard.mergeQueueIntegration });
        return;
      }
      if (section === "git-cleanup") {
        sendJson(response, 200, { branchCleanup: dashboard.branchCleanup });
        return;
      }
      if (section === "registry-compatibility") {
        sendJson(response, 200, { registryCompatibility: dashboard.registryCompatibility });
        return;
      }
      if (section === "registry-drift") {
        sendJson(response, 200, { registryDrift: dashboard.registryDrift });
        return;
      }
      if (section === "registry-canary-apply") {
        sendJson(response, 200, { registryCanaryApply: dashboard.registryCanaryApply });
        return;
      }
      if (section === "staging") {
        sendJson(response, 200, { staging: dashboard.staging });
        return;
      }
      if (section === "staging-dry-run") {
        sendJson(response, 200, { stagingDryRun: dashboard.stagingDryRun });
        return;
      }
      if (section === "staging-rc") {
        sendJson(response, 200, { stagingReleaseCandidate: dashboard.stagingReleaseCandidate });
        return;
      }
      if (section === "staging-execution") {
        sendJson(response, 200, { stagingExecution: dashboard.stagingExecution });
        return;
      }
      if (section === "ci-cd") {
        sendJson(response, 200, { cicd: dashboard.cicd });
        return;
      }
      if (section === "observability") {
        sendJson(response, 200, { observability: dashboard.observability });
        return;
      }
      if (section === "audit") {
        sendJson(response, 200, { audit: dashboard.audit });
        return;
      }
      sendJson(response, 404, { error: "dashboard_read_model_not_found", message: `Dashboard read model not found: ${section}` });
      return;
    }

    if (segments[0] === "staging" && segments[1] === "signoffs") {
      const readiness = context.deploymentReadinessService;
      if (method === "GET" && segments.length === 2) {
        const currentScope = await captureLocalStagingSignoffScope({
          scopeEvidencePath: stagingSignoffScopeEvidencePath,
          validationEvidencePaths: stagingSignoffValidationEvidencePaths
        });
        const scopeReview = readiness.getStagingHumanSignoffScopeReview(currentScope);
        sendHtml(response, 200, renderStagingSignoffCollectionHtml(readiness, currentScope, scopeReview));
        return;
      }
      if (method === "GET" && segments.length === 3 && segments[2] === "evidence") {
        const currentScope = await captureLocalStagingSignoffScope({
          scopeEvidencePath: stagingSignoffScopeEvidencePath,
          validationEvidencePaths: stagingSignoffValidationEvidencePaths
        });
        sendJson(response, 200, {
          evidence: readiness.listStagingHumanSignoffEvidence().map(stagingHumanSignoffEvidenceToDto),
          summary: stagingDeploymentExecutionSummaryToDto(readiness.getStagingDeploymentExecutionSummary()),
          decision: stagingDeploymentGoNoGoDecisionToDto(readiness.getStagingDeploymentGoNoGoDecision()),
          currentScope,
          scopeReview: readiness.getStagingHumanSignoffScopeReview(currentScope)
        });
        return;
      }
      if (method === "POST" && segments.length === 3 && segments[2] === "evidence") {
        const { body, formEncoded } = await readRequestBodyRecord(request);
        if (containsRawSecretField(body)) {
          const message = "Signoff evidence must not include raw secrets, tokens, env values, or credential-cache paths.";
          if (formEncoded) {
            const currentScope = await captureLocalStagingSignoffScope({
              scopeEvidencePath: stagingSignoffScopeEvidencePath,
              validationEvidencePaths: stagingSignoffValidationEvidencePaths
            });
            sendHtml(response, 400, renderStagingSignoffCollectionHtml(
              readiness,
              currentScope,
              readiness.getStagingHumanSignoffScopeReview(currentScope),
              { kind: "error", text: message }
            ));
          } else {
            sendJson(response, 400, { error: "raw_secret_material_rejected", message });
          }
          return;
        }
        const submittedAt = new Date();
        const currentScope = await captureLocalStagingSignoffScope({
          capturedAt: submittedAt,
          scopeEvidencePath: stagingSignoffScopeEvidencePath,
          validationEvidencePaths: stagingSignoffValidationEvidencePaths
        });
        const parsed = stagingHumanSignoffEvidenceFromBody(body, submittedAt, currentScope);
        if (!parsed.ok) {
          if (formEncoded) {
            sendHtml(response, 400, renderStagingSignoffCollectionHtml(
              readiness,
              currentScope,
              readiness.getStagingHumanSignoffScopeReview(currentScope),
              { kind: "error", text: parsed.message }
            ));
          } else {
            sendJson(response, 400, { error: parsed.error, message: parsed.message });
          }
          return;
        }
        try {
          const evidence = readiness.recordStagingHumanSignoffEvidence(parsed.evidence);
          if (formEncoded) {
            sendRedirect(response, "/staging/signoffs");
          } else {
            sendJson(response, 201, {
              evidence: stagingHumanSignoffEvidenceToDto(evidence),
              summary: stagingDeploymentExecutionSummaryToDto(readiness.getStagingDeploymentExecutionSummary()),
              decision: stagingDeploymentGoNoGoDecisionToDto(readiness.getStagingDeploymentGoNoGoDecision()),
              currentScope,
              scopeReview: readiness.getStagingHumanSignoffScopeReview(currentScope)
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invalid staging signoff evidence.";
          if (formEncoded) {
            sendHtml(response, 400, renderStagingSignoffCollectionHtml(
              readiness,
              currentScope,
              readiness.getStagingHumanSignoffScopeReview(currentScope),
              { kind: "error", text: message }
            ));
          } else {
            sendJson(response, 400, { error: "invalid_staging_signoff_evidence", message });
          }
        }
        return;
      }
      sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
        error: method === "GET" || method === "POST" ? "staging_signoff_route_not_found" : "method_not_allowed",
        message: "Staging signoff collection supports GET /staging/signoffs, GET /staging/signoffs/evidence, and POST /staging/signoffs/evidence."
      });
      return;
    }

    if (segments[0] === "mcp") {
      const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
      const mcp = context.mcpGatewayService;

      if (method === "GET" && segments[1] === "config") {
        const listDecision = mcp.listServers({ authContext: requestContext.authContext });
        if (!listDecision.allowed) {
          sendJson(response, 403, { error: "authorization_denied", reason: listDecision.reason, decision: listDecision.authorizationDecision ? authorizationDecisionToDto(listDecision.authorizationDecision) : undefined });
          return;
        }
        sendJson(response, 200, { config: mcpGatewayConfigToDto(mcp.getConfig()) });
        return;
      }

      if (method === "GET" && segments[1] === "servers" && segments.length === 2) {
        const result = mcp.listServers({ authContext: requestContext.authContext });
        if (!result.allowed) {
          sendJson(response, 403, { error: "authorization_denied", reason: result.reason, decision: result.authorizationDecision ? authorizationDecisionToDto(result.authorizationDecision) : undefined });
          return;
        }
        sendJson(response, 200, { servers: result.items.map(mcpServerCatalogEntryToDto) });
        return;
      }

      if (method === "GET" && segments[1] === "servers" && segments.length === 3) {
        const result = mcp.listServers({ authContext: requestContext.authContext });
        if (!result.allowed) {
          sendJson(response, 403, { error: "authorization_denied", reason: result.reason, decision: result.authorizationDecision ? authorizationDecisionToDto(result.authorizationDecision) : undefined });
          return;
        }
        const server = mcp.getServer(segments[2] ?? "");
        if (!server) {
          sendJson(response, 404, { error: "mcp_server_not_found", message: `MCP server not found: ${segments[2]}` });
          return;
        }
        sendJson(response, 200, { server: mcpServerCatalogEntryToDto(server) });
        return;
      }

      if (method === "GET" && segments[1] === "servers" && segments.length === 4 && segments[3] === "tools") {
        const serverId = segments[2] ?? "";
        const result = mcp.listTools(serverId, { authContext: requestContext.authContext });
        if (!result.allowed) {
          const statusCode = result.reason === "server_not_found" ? 404 : 403;
          sendJson(response, statusCode, { error: statusCode === 404 ? "mcp_server_not_found" : "authorization_denied", reason: result.reason, decision: result.authorizationDecision ? authorizationDecisionToDto(result.authorizationDecision) : undefined });
          return;
        }
        sendJson(response, 200, { tools: result.items.map(mcpToolDefinitionToDto) });
        return;
      }

      if (method === "GET" && segments[1] === "tools" && segments.length === 3) {
        const tool = mcp.getToolById(segments[2] ?? "");
        if (!tool) {
          sendJson(response, 404, { error: "mcp_tool_not_found", message: `MCP tool not found: ${segments[2]}` });
          return;
        }
        const result = mcp.listTools(tool.serverId, { authContext: requestContext.authContext });
        if (!result.allowed) {
          sendJson(response, 403, { error: "authorization_denied", reason: result.reason, decision: result.authorizationDecision ? authorizationDecisionToDto(result.authorizationDecision) : undefined });
          return;
        }
        sendJson(response, 200, { tool: mcpToolDefinitionToDto(tool) });
        return;
      }

      if (method === "POST" && segments[1] === "tools" && segments.length === 4 && segments[3] === "invoke") {
        const tool = mcp.getToolById(segments[2] ?? "");
        if (!tool) {
          sendJson(response, 404, { error: "mcp_tool_not_found", message: `MCP tool not found: ${segments[2]}` });
          return;
        }
        const body = recordValue(await readJson(request));
        const input = recordValue(body.input);
        const result = await mcp.invokeTool({
          id: stringValue(body.id) ?? requestContext.requestId,
          serverId: stringValue(body.serverId) ?? tool.serverId,
          toolId: tool.id,
          toolName: tool.name,
          actorId: requestContext.authContext.actor.id,
          principalId: requestContext.authContext.principal.id,
          taskId: stringValue(body.taskId),
          taskRunId: stringValue(body.taskRunId),
          agentRunId: stringValue(body.agentRunId),
          authContext: requestContext.authContext,
          requestContext,
          input,
          purpose: stringValue(body.purpose) ?? "api_mcp_tool_invoke",
          metadata: {
            ...recordValue(body.metadata),
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            source: requestContext.source
          },
          createdAt: new Date()
        });
        sendJson(response, mcpInvocationStatusCode(result.status), { result: mcpToolInvocationResultToDto(result) });
        return;
      }

      if (method === "GET" && segments[1] === "invocations" && segments.length === 2) {
        const mcpReadEnvironment = {
          readOnly: true,
          serverKind: "mock",
          serverStatus: "active",
          realTransportEnabled: false
        };
        const readDecision = context.authorizationService.check({
          authContext: requestContext.authContext,
          action: "mcp.tool.list",
          resource: {
            resourceKind: "mcp_tool",
            resourceId: "mcp_invocations",
            metadata: { ...mcpReadEnvironment, mcpGateway: true }
          },
          policyContext: {
            environment: mcpReadEnvironment,
            metadata: { mcpGateway: true }
          }
        });
        if (!readDecision.allowed) {
          sendJson(response, 403, { error: "authorization_denied", decision: authorizationDecisionToDto(readDecision) });
          return;
        }
        sendJson(response, 200, { invocations: mcp.listInvocations().map(mcpToolInvocationResultToDto) });
        return;
      }

      if (method === "GET" && segments[1] === "invocations" && segments.length === 3) {
        const mcpReadEnvironment = {
          readOnly: true,
          serverKind: "mock",
          serverStatus: "active",
          realTransportEnabled: false
        };
        const readDecision = context.authorizationService.check({
          authContext: requestContext.authContext,
          action: "mcp.tool.list",
          resource: {
            resourceKind: "mcp_tool",
            resourceId: "mcp_invocations",
            metadata: { ...mcpReadEnvironment, mcpGateway: true }
          },
          policyContext: {
            environment: mcpReadEnvironment,
            metadata: { mcpGateway: true }
          }
        });
        if (!readDecision.allowed) {
          sendJson(response, 403, { error: "authorization_denied", decision: authorizationDecisionToDto(readDecision) });
          return;
        }
        const invocation = mcp.getInvocation(segments[2] ?? "");
        if (!invocation) {
          sendJson(response, 404, { error: "mcp_invocation_not_found", message: `MCP invocation not found: ${segments[2]}` });
          return;
        }
        sendJson(response, 200, { invocation: mcpToolInvocationResultToDto(invocation) });
        return;
      }

      if (method === "GET" && segments[1] === "audit") {
        const auditDecision = context.authorizationService.hasPermission(requestContext.authContext, "mcp.audit.read", {
          resourceKind: "mcp_tool",
          resourceId: "mcp_audit",
          metadata: { readOnly: true }
        });
        if (!auditDecision.allowed) {
          sendJson(response, 403, { error: "authorization_denied", decision: authorizationDecisionToDto(auditDecision) });
          return;
        }
        sendJson(response, 200, { auditEvents: mcp.listAuditEvents().map(mcpToolAuditEventToDto) });
        return;
      }

      sendJson(response, 404, { error: "mcp_endpoint_not_found", message: `MCP endpoint not found: ${url.pathname}` });
      return;
    }

    if (segments[0] === "auth") {
      const authService = context.authorizationService;
      const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);

      if (method === "GET") {
        const readDecision = authService.hasPermission(requestContext.authContext, "auth.read", {
          resourceKind: "auth",
          resourceId: segments[1] ?? "config",
          metadata: { readOnly: true }
        });
        if (!readDecision.allowed) {
          sendJson(response, 403, { error: "authorization_denied", decision: authorizationDecisionToDto(readDecision) as JsonValue });
          return;
        }

        if (segments[1] === "config") {
          const providerSummary = authService.getProductionAuthProviderSummary();
          sendJson(response, 200, {
            config: authService.getConfig(),
            productionAuthProvider: providerSummary,
            identityProviders: authService.listIdentityProviders().map(identityProviderToDto),
            productionAuthEnabled: false,
            providerKind: providerSummary.activeProviderKind,
            providerStatus: providerSummary.selectedProviderStatus,
            selectedProviderKind: providerSummary.selectedProviderKind,
            tokenValidationEnabled: false,
            sessionBoundaryStatus: providerSummary.sessionBoundaryStatus,
            identityMappingStatus: providerSummary.identityMappingStatus,
            mockAuthWarning: "MockAuthProvider is default and is not production authentication."
          });
          return;
        }
        if (segments[1] === "me") {
          sendJson(response, 200, {
            authContext: authContextToDto(requestContext.authContext) as JsonValue,
            requestContext: context.apiRequestContextMiddleware.getSafeRequestContextSummary(requestContext) as unknown as JsonValue
          });
          return;
        }
        if (segments[1] === "roles") {
          sendJson(response, 200, { roles: authService.listRoles().map(roleToDto) as JsonValue });
          return;
        }
        if (segments[1] === "permissions") {
          sendJson(response, 200, { permissions: authService.listPermissions().map(permissionToDto) as JsonValue });
          return;
        }
        if (segments[1] === "teams") {
          sendJson(response, 200, { teams: authService.listTeams().map(teamToDto) as JsonValue });
          return;
        }
        if (segments[1] === "actors") {
          sendJson(response, 200, { actors: authService.listActors().map(actorToDto) as JsonValue });
          return;
        }
        if (segments[1] === "service-accounts") {
          sendJson(response, 200, { serviceAccounts: authService.listServiceAccounts().map(serviceAccountToDto) as JsonValue });
          return;
        }
        if (segments[1] === "role-bindings") {
          sendJson(response, 200, { roleBindings: authService.listRoleBindings().map(roleBindingToDto) as JsonValue });
          return;
        }
        if (segments[1] === "principals") {
          sendJson(response, 200, { principals: authService.listPrincipals().map(principalToDto) as JsonValue });
          return;
        }
        if (segments[1] === "identity-providers") {
          sendJson(response, 200, { identityProviders: authService.listIdentityProviders().map(identityProviderToDto) as JsonValue });
          return;
        }
        if (segments[1] === "audit") {
          sendJson(response, 200, {
            auditEvents: authService.listAuditEvents({
              actorId: url.searchParams.get("actorId") ?? undefined,
              principalId: url.searchParams.get("principalId") ?? undefined,
              eventType: url.searchParams.get("eventType") ?? undefined,
              action: url.searchParams.get("action") ?? undefined
            }).map(authAuditEventToDto) as JsonValue
          });
          return;
        }
      }

      if (method === "POST" && segments[1] === "authorize" && segments[2] === "check") {
        const gateDecision = authService.hasPermission(requestContext.authContext, "auth.authorize.check", {
          resourceKind: "auth",
          resourceId: "authorize_check",
          metadata: { readOnly: true }
        });
        if (!gateDecision.allowed) {
          sendJson(response, 403, { error: "authorization_denied", decision: authorizationDecisionToDto(gateDecision) as JsonValue });
          return;
        }

        const body = await readJson(request) as Record<string, unknown>;
        const action = stringValue(body.action);
        const resource = authorizationResourceFromBody(body);
        if (!action || !resource) {
          sendJson(response, 400, { error: "invalid_authorization_check", message: "action and resourceKind are required." });
          return;
        }
        const subjectRecord = recordValue(body.subject);
        const targetAuthContext = authService.getAuthContext({
          actorId: stringValue(body.actorId) ?? stringValue(subjectRecord.actorId),
          requestId: stringValue(body.requestId),
          correlationId: stringValue(body.correlationId),
          source: requestSourceValue(body.source) ?? "api",
          metadata: {
            authorizationCheckTarget: true
          }
        });
        const decision = authService.check({
          authContext: targetAuthContext,
          action,
          resource,
          policyContext: {
            taskId: stringValue(body.taskId),
            taskRunId: stringValue(body.taskRunId),
            repoId: stringValue(body.repoId),
            branchName: stringValue(body.branchName),
            modelId: stringValue(body.modelId),
            providerKind: stringValue(body.providerKind),
            runnerKind: stringValue(body.runnerKind),
            command: stringValue(body.command),
            riskScore: typeof body.riskScore === "number" ? body.riskScore : undefined,
            environment: recordValue(body.environment),
            metadata: recordValue(body.policyMetadata)
          }
        });
        sendJson(response, decision.allowed ? 200 : 403, { decision: authorizationDecisionToDto(decision) as JsonValue });
        return;
      }
    }

    if (segments[0] === "policy") {
      const policyService = context.policyService;

      if (method === "GET" && segments[1] === "config") {
        sendJson(response, 200, { config: policyService.getConfig() });
        return;
      }

      if (method === "GET" && segments[1] === "rules" && segments.length === 2) {
        sendJson(response, 200, { rules: policyService.listRules().map(policyRuleToDto) });
        return;
      }

      if (method === "GET" && segments[1] === "rules" && segments.length === 3) {
        const rule = policyService.getRule(segments[2]);
        if (!rule) notFound("policy rule", segments[2]);
        sendJson(response, 200, { rule: policyRuleToDto(rule) });
        return;
      }

      if (method === "POST" && segments[1] === "evaluate") {
        const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
        const body = await readJson(request) as Record<string, unknown>;
        const parsed = policyEvaluationRequestFromBody(body);
        if (!parsed.ok) {
          sendJson(response, 400, { error: parsed.error, message: parsed.message });
          return;
        }
        const subjectProvided = Object.keys(recordValue(body.subject)).length > 0;
        sendJson(response, 200, {
          decision: policyDecisionToDto(policyService.evaluate({
            ...parsed.request,
            subject: subjectProvided ? parsed.request.subject : context.authorizationService.toPolicySubject(requestContext.authContext),
            context: createPolicyContext({
              ...parsed.request.context,
              metadata: {
                ...parsed.request.context.metadata,
                requestId: requestContext.requestId,
                correlationId: requestContext.correlationId,
                source: requestContext.source
              }
            })
          }))
        });
        return;
      }

      if (method === "POST" && segments[1] === "evaluate-many") {
        const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
        const body = await readJson(request) as Record<string, unknown>;
        const requests = Array.isArray(body.requests) ? body.requests : undefined;
        if (!requests) {
          sendJson(response, 400, { error: "invalid_policy_requests", message: "requests must be an array." });
          return;
        }
        const parsed = requests.map((item) => policyEvaluationRequestFromBody(recordValue(item)));
        const invalid = parsed.find((item) => !item.ok);
        if (invalid && !invalid.ok) {
          sendJson(response, 400, { error: invalid.error, message: invalid.message });
          return;
        }
        const decisions = policyService.evaluateMany(parsed.filter((item): item is Extract<typeof item, { ok: true }> => item.ok).map((item, index) => {
          const original = recordValue(requests[index]);
          const subjectProvided = Object.keys(recordValue(original.subject)).length > 0;
          return {
            ...item.request,
            subject: subjectProvided ? item.request.subject : context.authorizationService.toPolicySubject(requestContext.authContext),
            context: createPolicyContext({
              ...item.request.context,
              metadata: {
                ...item.request.context.metadata,
                requestId: requestContext.requestId,
                correlationId: requestContext.correlationId,
                source: requestContext.source
              }
            })
          };
        }));
        sendJson(response, 200, { decisions: decisions.map(policyDecisionToDto) });
        return;
      }

      if (method === "GET" && segments[1] === "audit") {
        const action = url.searchParams.get("action") ?? undefined;
        if (action !== undefined && !isPolicyAction(action)) {
          sendJson(response, 400, { error: "invalid_policy_action", message: "action must be a valid policy action." });
          return;
        }
        sendJson(response, 200, {
          auditEntries: policyService.listAuditEntries({
            action,
            actorId: url.searchParams.get("actorId") ?? undefined,
            taskId: url.searchParams.get("taskId") ?? undefined,
            taskRunId: url.searchParams.get("taskRunId") ?? undefined
          }).map(policyDecisionAuditEntryToDto)
        });
        return;
      }
    }

    if (segments[0] === "security") {
      const securityService = context.securityService;

      if (segments[1] === "credentials") {
        if (method === "GET" && segments[2] === "refs") {
          sendJson(response, 200, { credentialRefs: securityService.listSecretRefs().map(secretRefToDto) });
          return;
        }
        if (method === "POST" && segments[2] === "refs") {
          const body = await readJson(request) as Record<string, unknown>;
          if (containsRawSecretField(body)) {
            sendJson(response, 400, { error: "raw_secret_value_rejected", message: "Credential refs may contain envKey references only, never raw secret values." });
            return;
          }
          const id = stringValue(body.id);
          const name = stringValue(body.name);
          const provider = secretProviderKindValue(body.provider);
          const secretKind = secretKindValue(body.secretKind);
          const scope = stringValue(body.scope) ?? "scope_env_provider_credentials";
          if (!id || !name || !provider || !secretKind) {
            sendJson(response, 400, { error: "invalid_credential_ref", message: "id, name, provider, and secretKind are required." });
            return;
          }
          try {
            const secretRef = securityService.createSecretRef({
              id,
              name,
              provider,
              secretKind,
              envKey: stringValue(body.envKey),
              scope,
              description: stringValue(body.description),
              status: secretRefStatusValue(body.status) ?? "active",
              metadata: recordValue(body.metadata)
            });
            sendJson(response, 201, { credentialRef: secretRefToDto(secretRef) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_credential_ref", message: error instanceof Error ? error.message : "Credential ref rejected." });
          }
          return;
        }
        if (method === "PATCH" && segments[2] === "refs" && segments[3] && segments[4] === "status") {
          const body = await readJson(request) as Record<string, unknown>;
          const status = secretRefStatusValue(body.status);
          if (!status) {
            sendJson(response, 400, { error: "invalid_credential_ref_status", message: "status must be active, disabled, or revoked." });
            return;
          }
          try {
            sendJson(response, 200, { credentialRef: secretRefToDto(securityService.updateSecretRefStatus(segments[3], status, stringValue(body.actorId))) });
          } catch (error) {
            sendJson(response, 404, { error: "credential_ref_not_found", message: error instanceof Error ? error.message : "Credential ref not found." });
          }
          return;
        }
        if (method === "POST" && segments[2] === "resolve" && segments[3] === "check") {
          const body = await readJson(request) as Record<string, unknown>;
          const secretRefId = stringValue(body.secretRefId);
          const purpose = credentialPurposeValue(body.purpose);
          if (!secretRefId || !purpose) {
            sendJson(response, 400, { error: "invalid_credential_resolution_check", message: "secretRefId and purpose are required." });
            return;
          }
          const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
          const result = securityService.resolveCredential({
            secretRefId,
            purpose,
            actorId: requestContext.authContext.actor.id,
            principalId: requestContext.authContext.principal.id,
            authContext: requestContext.authContext,
            requestContext,
            taskId: stringValue(body.taskId),
            taskRunId: stringValue(body.taskRunId),
            providerId: stringValue(body.providerId),
            policyContext: {
              ...recordValue(body.policyContext),
              requestId: requestContext.requestId,
              correlationId: requestContext.correlationId,
              source: requestContext.source,
              requestedActorId: stringValue(body.actorId)
            }
          });
          sendJson(response, 200, { result: credentialResolutionResultToDto(result) });
          return;
        }
        if (method === "GET" && segments[2] === "audit") {
          sendJson(response, 200, {
            auditEvents: securityService.listAuditEvents({
              targetKind: "secret",
              eventType: url.searchParams.get("eventType") ?? undefined,
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined,
              actorId: url.searchParams.get("actorId") ?? undefined
            }).map(securityAuditEventToDto)
          });
          return;
        }
      }

      if (segments[1] === "secrets") {
        if (segments[2] === "vault") {
          if (method === "GET" && segments[3] === "config") {
            sendJson(response, 200, { config: vaultSecretProviderConfigToDto(securityService.getVaultConfig()) });
            return;
          }
          if (method === "GET" && segments[3] === "health") {
            sendJson(response, 200, { health: vaultClientHealthToDto(securityService.getVaultHealth()) });
            return;
          }
          if (method === "POST" && segments[3] === "resolve" && segments[4] === "check") {
            const body = await readJson(request) as Record<string, unknown>;
            const secretRefId = stringValue(body.secretRefId);
            const purpose = credentialPurposeValue(body.purpose);
            if (!secretRefId || !purpose) {
              sendJson(response, 400, { error: "invalid_vault_resolution_check", message: "secretRefId and purpose are required." });
              return;
            }
            const secretRef = securityService.getSecretMetadata(secretRefId);
            if (secretRef?.provider !== "vault") {
              sendJson(response, 409, { result: { allowed: false, status: "blocked", blockedReason: "secret_ref_provider_not_vault", containsSecretMaterial: false } });
              return;
            }
            const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
            const result = securityService.resolveCredential({
              secretRefId,
              purpose,
              actorId: requestContext.authContext.actor.id,
              principalId: requestContext.authContext.principal.id,
              authContext: requestContext.authContext,
              requestContext,
              taskId: stringValue(body.taskId),
              taskRunId: stringValue(body.taskRunId),
              providerId: stringValue(body.providerId),
              policyContext: {
                ...recordValue(body.policyContext),
                requestId: requestContext.requestId,
                correlationId: requestContext.correlationId,
                source: requestContext.source,
                requestedActorId: stringValue(body.actorId)
              }
            });
            sendJson(response, 200, { result: credentialResolutionResultToDto(result) });
            return;
          }
          if (method === "GET" && segments[3] === "audit") {
            sendJson(response, 200, {
              auditEvents: securityService.listAuditEvents({
                targetKind: "secret",
                eventType: url.searchParams.get("eventType") ?? undefined,
                taskId: url.searchParams.get("taskId") ?? undefined,
                taskRunId: url.searchParams.get("taskRunId") ?? undefined,
                actorId: url.searchParams.get("actorId") ?? undefined
              })
                .filter((event) => event.eventType.startsWith("vault_"))
                .map(securityAuditEventToDto)
            });
            return;
          }
        }
        if (method === "GET" && segments[2] === "refs") {
          sendJson(response, 200, { secretRefs: securityService.listSecretRefs().map(secretRefToDto) });
          return;
        }
        if (method === "GET" && segments[2] === "scopes") {
          sendJson(response, 200, { secretScopes: securityService.listSecretScopes().map(secretScopeToDto) });
          return;
        }
        if (method === "POST" && segments[2] === "leases" && segments[3] === "request") {
          const body = await readJson(request) as Record<string, unknown>;
          const secretRefId = stringValue(body.secretRefId);
          const scopeId = stringValue(body.scopeId);
          if (!secretRefId || !scopeId) {
            sendJson(response, 400, { error: "invalid_secret_lease_request", message: "secretRefId and scopeId are required." });
            return;
          }
          const lease = securityService.requestLease({
            secretRefId,
            scopeId,
            taskId: stringValue(body.taskId),
            taskRunId: stringValue(body.taskRunId),
            actorId: stringValue(body.actorId),
            ttlSeconds: typeof body.ttlSeconds === "number" ? body.ttlSeconds : undefined,
            reason: stringValue(body.reason),
            metadata: recordValue(body.metadata)
          });
          sendJson(response, lease.status === "issued" ? 201 : 409, { lease: secretLeaseToDto(lease), safeEnvironment: securityService.getSafeEnvironment(lease.id) });
          return;
        }
        if (method === "GET" && segments[2] === "leases") {
          sendJson(response, 200, {
            leases: securityService.listSecretLeases({
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined
            }).map(secretLeaseToDto)
          });
          return;
        }
        if (method === "POST" && segments[2] === "leases" && segments[4] === "revoke") {
          try {
            sendJson(response, 200, { lease: secretLeaseToDto(securityService.revokeLease(segments[3])) });
          } catch (error) {
            sendJson(response, 404, { error: "secret_lease_not_found", message: error instanceof Error ? error.message : "Secret lease not found." });
          }
          return;
        }
        if (method === "GET" && segments[2] === "audit") {
          sendJson(response, 200, {
            auditEvents: securityService.listAuditEvents({
              targetKind: "secret",
              eventType: url.searchParams.get("eventType") ?? undefined,
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined,
              actorId: url.searchParams.get("actorId") ?? undefined
            }).map(securityAuditEventToDto)
          });
          return;
        }
      }

      if (segments[1] === "sandbox") {
        if (method === "GET" && segments[2] === "profiles") {
          sendJson(response, 200, { sandboxProfiles: securityService.listSandboxProfiles().map(sandboxProfileToDto) });
          return;
        }
        if (method === "GET" && segments[2] === "sessions") {
          sendJson(response, 200, {
            sandboxSessions: securityService.listSandboxSessions({
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined
            }).map(sandboxSessionToDto)
          });
          return;
        }
        if (method === "POST" && segments[2] === "sessions") {
          const body = await readJson(request) as Record<string, unknown>;
          const profileId = stringValue(body.profileId);
          if (!profileId) {
            sendJson(response, 400, { error: "invalid_sandbox_session", message: "profileId is required." });
            return;
          }
          const result = securityService.createSandboxSession({
            profileId,
            taskId: stringValue(body.taskId),
            taskRunId: stringValue(body.taskRunId),
            actorId: stringValue(body.actorId),
            runnerKind: stringValue(body.runnerKind),
            workspaceId: stringValue(body.workspaceId),
            metadata: recordValue(body.metadata)
          });
          sendJson(response, result.session ? 201 : 409, {
            session: result.session ? sandboxSessionToDto(result.session) : undefined,
            decision: sandboxDecisionToDto(result.decision)
          });
          return;
        }
        if (method === "GET" && segments[2] === "audit") {
          sendJson(response, 200, {
            auditEvents: securityService.listAuditEvents({
              targetKind: "sandbox",
              eventType: url.searchParams.get("eventType") ?? undefined,
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined,
              actorId: url.searchParams.get("actorId") ?? undefined
            }).map(securityAuditEventToDto)
          });
          return;
        }
      }

      if (segments[1] === "network" && method === "GET" && segments[2] === "policies") {
        sendJson(response, 200, { networkPolicies: securityService.listNetworkEgressPolicies().map(networkEgressPolicyToDto) });
        return;
      }

      if (segments[1] === "redaction") {
        if (method === "GET" && segments[2] === "policies") {
          sendJson(response, 200, { redactionPolicies: securityService.listRedactionPolicies().map(redactionPolicyToDto) });
          return;
        }
        if (method === "POST" && segments[2] === "test") {
          const body = await readJson(request) as Record<string, unknown>;
          const text = typeof body.text === "string" ? body.text : "";
          const result = securityService.redactText({
            text,
            policyId: stringValue(body.policyId),
            actorId: stringValue(body.actorId),
            taskId: stringValue(body.taskId),
            taskRunId: stringValue(body.taskRunId),
            metadata: { source: "api_redaction_test" }
          });
          sendJson(response, 200, { result: redactionResultToDto(result) });
          return;
        }
      }
    }

    if (segments[0] === "local-agents") {
      const localAgentService = context.localAgentProtocolService;

      if (segments[1] === "fixture") {
        if (method === "POST" && segments[2] === "start") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            const userId = stringValue(body.userId);
            if (!userId) {
              sendJson(response, 400, { error: "invalid_fixture_agent", message: "userId is required." });
              return;
            }
            const started = localAgentService.startFixtureAgent({
              userId,
              hostId: stringValue(body.hostId),
              displayName: stringValue(body.displayName),
              agentVersion: stringValue(body.agentVersion),
              platform: stringValue(body.platform),
              scenario: body.scenario === "timeout" || body.scenario === "parser_error" || body.scenario === "stderr_progress" || body.scenario === "cancellation" ? body.scenario : undefined,
              metadata: recordValue(body.metadata)
            });
            sendJson(response, 201, {
              localAgent: localAgentRegistrationToDto(started.agent),
              advertisement: localAgentCapabilityAdvertisementToDto(started.advertisement)
            });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
        const fixtureAgentId = segments[2];
        if (fixtureAgentId && method === "POST" && segments[3] === "stop") {
          try {
            sendJson(response, 200, { localAgent: localAgentRegistrationToDto(localAgentService.stopFixtureAgent(fixtureAgentId)) });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
        if (fixtureAgentId && method === "POST" && segments[3] === "disconnect") {
          try {
            sendJson(response, 200, { localAgent: localAgentRegistrationToDto(localAgentService.disconnectAgent(fixtureAgentId)) });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
        if (fixtureAgentId && method === "POST" && segments[3] === "reconnect") {
          try {
            sendJson(response, 200, { localAgent: localAgentRegistrationToDto(localAgentService.reconnectAgent(fixtureAgentId)) });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
      }

      if (segments[1] === "compatibility") {
        if (method === "GET") {
          sendJson(response, 200, {
            entries: localAgentService.listCompatibilityEntries().map(localCliCompatibilityEntryToDto),
            results: localAgentService.listCompatibilityResults({
              agentId: url.searchParams.get("agentId") ?? undefined,
              providerId: url.searchParams.get("providerId") ?? undefined
            }).map(localCliCompatibilityResultToDto)
          });
          return;
        }
        if (method === "POST" && segments[2] === "check") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            const providerId = stringValue(body.providerId);
            const agentId = stringValue(body.agentId);
            const command = stringValue(body.command);
            const providerTemplateId = stringValue(body.providerTemplateId);
            const parserMode = stringValue(body.parserMode);
            if (!providerId || !agentId || !command || !providerTemplateId || !isProviderParserMode(parserMode)) {
              sendJson(response, 400, { error: "invalid_compatibility_check", message: "providerId, agentId, command, providerTemplateId, and parserMode are required." });
              return;
            }
            const result = localAgentService.checkCompatibility({
              providerId,
              agentId,
              command,
              providerTemplateId,
              parserMode,
              reportedVersion: stringValue(body.reportedVersion),
              metadata: recordValue(body.metadata)
            });
            sendJson(response, result.compatible ? 200 : 409, { result: localCliCompatibilityResultToDto(result) });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
      }

      if (segments[1] === "channels") {
        const channelId = segments[2];
        if (!channelId) {
          sendJson(response, 400, { error: "missing_channel_id", message: "channel id is required." });
          return;
        }
        if (method === "POST" && segments[3] === "handshake") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            const result = localAgentService.verifyHandshake({
              channelId,
              response: stringValue(body.response),
              actorId: stringValue(body.actorId),
              metadata: recordValue(body.metadata)
            });
            sendJson(response, result.channel.status === "established" ? 200 : 409, {
              channel: localAgentChannelToDto(result.channel),
              handshake: localAgentHandshakeToDto(result.handshake)
            });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
        if (method === "POST" && segments[3] === "revoke") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            sendJson(response, 200, { channel: localAgentChannelToDto(localAgentService.revokeChannel(channelId, stringValue(body.actorId))) });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
      }

      if (segments[1] === "invocations") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, {
            invocations: localAgentService.listInvocations({
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined,
              localAgentId: url.searchParams.get("localAgentId") ?? undefined,
              providerId: url.searchParams.get("providerId") ?? undefined
            }).map(localAgentInvocationToDto)
          });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
            const body = await readJson(request) as Record<string, unknown>;
            const providerId = stringValue(body.providerId);
            const localAgentId = stringValue(body.localAgentId);
            const workspaceRef = stringValue(body.workspaceRef);
            if (!providerId || !localAgentId || !workspaceRef || !isLocalAgentConsentLevel(body.requiredConsentLevel)) {
              sendJson(response, 400, { error: "invalid_local_agent_invocation", message: "providerId, localAgentId, workspaceRef, and valid requiredConsentLevel are required." });
              return;
            }
            const result = localAgentService.createInvocationEnvelope({
              providerId,
              localAgentId,
              workspaceRef,
              taskId: stringValue(body.taskId),
              taskRunId: stringValue(body.taskRunId),
              actorId: stringValue(body.actorId) ?? requestContext.authContext.actor.id,
              instructionSetHash: stringValue(body.instructionSetHash),
              promptRef: stringValue(body.promptRef),
              requiredConsentLevel: body.requiredConsentLevel,
              sandboxProfileId: stringValue(body.sandboxProfileId),
              networkPolicyId: stringValue(body.networkPolicyId),
              redactionPolicyId: stringValue(body.redactionPolicyId),
              secretScopeIds: stringArrayValue(body.secretScopeIds),
              timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
              metadata: {
                ...recordValue(body.metadata),
                requestId: requestContext.requestId,
                correlationId: requestContext.correlationId,
                principalId: requestContext.authContext.principal.id,
                authMode: requestContext.authContext.authMode,
                source: requestContext.source
              }
            });
            const consentRequest = body.requestConsent === false ? undefined : localAgentService.requestConsent(result.invocation.id);
            sendJson(response, 201, {
              envelope: localAgentInvocationEnvelopeToDto(result.envelope),
              invocation: localAgentInvocationToDto(localAgentService.getInvocation(result.invocation.id) ?? result.invocation),
              consentRequest: consentRequest ? localAgentConsentRequestToDto(consentRequest) : undefined
            });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
        const invocationId = segments[2];
        if (!invocationId) {
          sendJson(response, 400, { error: "missing_invocation_id", message: "invocation id is required." });
          return;
        }
        const invocation = localAgentService.getInvocation(invocationId);
        if (!invocation) {
          sendJson(response, 404, { error: "local_agent_invocation_not_found", message: `Local Agent invocation not found: ${invocationId}` });
          return;
        }
        if (method === "GET" && segments.length === 3) {
          const envelope = localAgentService.getEnvelope(invocation.envelopeId);
          sendJson(response, 200, {
            invocation: localAgentInvocationToDto(invocation),
            envelope: envelope ? localAgentInvocationEnvelopeToDto(envelope) : undefined
          });
          return;
        }
        if (method === "POST" && segments[3] === "dispatch") {
          try {
            const dispatched = await localAgentService.dispatchInvocation(invocationId);
            sendJson(response, dispatched.state === "running" || dispatched.state === "completed" ? 200 : 409, {
              invocation: localAgentInvocationToDto(dispatched),
              consentRequests: localAgentService.listConsentRequests({ invocationId }).map(localAgentConsentRequestToDto)
            });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
        if (method === "POST" && segments[3] === "cancel") {
          try {
            sendJson(response, 200, { invocation: localAgentInvocationToDto(await localAgentService.cancelInvocation(invocationId)) });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
        if (method === "POST" && segments[3] === "complete") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            const completed = localAgentService.completeInvocation({
              invocationId,
              exitCode: typeof body.exitCode === "number" ? body.exitCode : undefined,
              statusReason: stringValue(body.statusReason),
              metadata: recordValue(body.metadata)
            });
            sendJson(response, completed.state === "completed" ? 200 : 409, { invocation: localAgentInvocationToDto(completed) });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
        if (method === "GET" && segments[3] === "events") {
          sendJson(response, 200, { events: localAgentService.listEvents({ invocationId }).map(localAgentNormalizedEventToDto) });
          return;
        }
        if (method === "GET" && segments[3] === "stream") {
          const stream = localAgentService.getStreamForInvocation(invocationId);
          if (segments.length === 4) {
            sendJson(response, 200, { stream: stream ? localAgentInvocationStreamToDto(stream) : undefined });
            return;
          }
          if (segments[4] === "events") {
            sendJson(response, 200, {
              stream: stream ? localAgentInvocationStreamToDto(stream) : undefined,
              events: localAgentService.listStreamEvents({ invocationId }).map(localAgentStreamEventToDto)
            });
            return;
          }
        }
      }

      if (segments[1] === "consent-requests") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, {
            consentRequests: localAgentService.listConsentRequests({
              userId: url.searchParams.get("userId") ?? undefined,
              invocationId: url.searchParams.get("invocationId") ?? undefined,
              pendingOnly: url.searchParams.get("pendingOnly") === "true"
            }).map(localAgentConsentRequestToDto)
          });
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "decision") {
          const consentRequestId = segments[2];
          try {
            const body = await readJson(request) as Record<string, unknown>;
            const userId = stringValue(body.userId);
            if (!userId || !isLocalAgentConsentDecision(body.decision)) {
              sendJson(response, 400, { error: "invalid_consent_decision", message: "userId and valid decision are required." });
              return;
            }
            const decision = localAgentService.recordConsentDecision({
              consentRequestId,
              userId,
              decision: body.decision,
              reason: stringValue(body.reason),
              metadata: recordValue(body.metadata)
            });
            sendJson(response, 201, { decision: localAgentConsentDecisionToDto(decision) });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
      }

      if (method === "GET" && segments[1] === "consent-queue") {
        sendJson(response, 200, {
          consentRequests: localAgentService.listConsentRequests({ pendingOnly: true }).map(localAgentConsentRequestToDto)
        });
        return;
      }

      if (method === "GET" && segments[1] === "consent-history") {
        sendJson(response, 200, {
          approved: localAgentService.listConsentDecisions().filter((decision) => decision.decision === "approved" || decision.decision === "approved_once" || decision.decision === "approved_for_session").map(localAgentConsentDecisionToDto),
          denied: localAgentService.listConsentDecisions().filter((decision) => decision.decision === "denied" || decision.decision === "expired").map(localAgentConsentDecisionToDto)
        });
        return;
      }

      if (method === "GET" && segments[1] === "audit") {
        sendJson(response, 200, {
          auditEvents: localAgentService.listAuditEvents({
            agentId: url.searchParams.get("agentId") ?? undefined,
            invocationId: url.searchParams.get("invocationId") ?? undefined,
            providerId: url.searchParams.get("providerId") ?? undefined
          }).map(localAgentProtocolAuditEventToDto)
        });
        return;
      }

      if (method === "GET" && segments.length === 1) {
        sendJson(response, 200, { localAgents: localAgentService.listAgents().map(localAgentRegistrationToDto) });
        return;
      }

      if (method === "POST" && segments[1] === "register") {
        try {
          const body = await readJson(request) as Record<string, unknown>;
          const userId = stringValue(body.userId);
          const hostId = stringValue(body.hostId);
          const displayName = stringValue(body.displayName);
          const agentVersion = stringValue(body.agentVersion);
          const platform = stringValue(body.platform);
          if (!userId || !hostId || !displayName || !agentVersion || !platform) {
            sendJson(response, 400, { error: "invalid_local_agent_registration", message: "userId, hostId, displayName, agentVersion, and platform are required." });
            return;
          }
          const agent = localAgentService.registerAgent({
            userId,
            hostId,
            displayName,
            agentVersion,
            platform,
            status: isLocalAgentRegistrationStatus(body.status) ? body.status : undefined,
            metadata: recordValue(body.metadata),
            actorId: stringValue(body.actorId)
          });
          sendJson(response, 201, { localAgent: localAgentRegistrationToDto(agent) });
        } catch (error) {
          sendLocalAgentProtocolError(response, error);
        }
        return;
      }

      const agentId = segments[1];
      if (agentId) {
        const agent = localAgentService.getAgent(agentId);
        if (!agent) {
          sendJson(response, 404, { error: "local_agent_not_found", message: `Local Agent not found: ${agentId}` });
          return;
        }
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, {
            localAgent: localAgentRegistrationToDto(agent),
            sessions: localAgentService.listSessions({ agentId }).map(localAgentSessionToDto)
          });
          return;
        }
        if (segments[2] === "channels") {
          if (method === "GET") {
            sendJson(response, 200, {
              channels: localAgentService.listChannels({ agentId }).map(localAgentChannelToDto),
              handshakes: localAgentService.listHandshakes({ agentId }).map(localAgentHandshakeToDto)
            });
            return;
          }
          if (method === "POST") {
            try {
              const body = await readJson(request) as Record<string, unknown>;
              const created = localAgentService.createChannel({
                agentId,
                channelKind: isLocalAgentChannelKind(body.channelKind) ? body.channelKind : undefined,
                expiresInMs: typeof body.expiresInMs === "number" ? body.expiresInMs : undefined,
                actorId: stringValue(body.actorId),
                metadata: recordValue(body.metadata)
              });
              sendJson(response, 201, {
                channel: localAgentChannelToDto(created.channel),
                handshake: localAgentHandshakeToDto(created.handshake)
              });
            } catch (error) {
              sendLocalAgentProtocolError(response, error);
            }
            return;
          }
        }
        if (segments[2] === "capabilities") {
          if (method === "GET") {
            sendJson(response, 200, {
              capabilities: agent.capabilities,
              advertisements: localAgentService.listCapabilityAdvertisements({ agentId }).map(localAgentCapabilityAdvertisementToDto)
            });
            return;
          }
          if (method === "POST" && segments[3] === "advertise") {
            try {
              const body = await readJson(request) as Record<string, unknown>;
              const advertisement = localAgentService.advertiseCapabilities({
                agentId,
                supportedProviderTemplates: stringArrayValue(body.supportedProviderTemplates),
                supportedParserModes: parserModeArrayValue(body.supportedParserModes),
                supportedConsentLevels: consentLevelArrayValue(body.supportedConsentLevels),
                supportedSandboxKinds: stringArrayValue(body.supportedSandboxKinds),
                maxTimeoutMs: typeof body.maxTimeoutMs === "number" ? body.maxTimeoutMs : undefined,
                supportsStreaming: typeof body.supportsStreaming === "boolean" ? body.supportsStreaming : undefined,
                supportsCancellation: typeof body.supportsCancellation === "boolean" ? body.supportsCancellation : undefined,
                metadata: recordValue(body.metadata)
              });
              sendJson(response, 201, { advertisement: localAgentCapabilityAdvertisementToDto(advertisement) });
            } catch (error) {
              sendLocalAgentProtocolError(response, error);
            }
            return;
          }
        }
        if (method === "POST" && segments[2] === "heartbeat") {
          try {
            sendJson(response, 200, { localAgent: localAgentRegistrationToDto(localAgentService.heartbeat(agentId)) });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
        if (method === "POST" && segments[2] === "revoke") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            sendJson(response, 200, { localAgent: localAgentRegistrationToDto(localAgentService.revokeAgent(agentId, stringValue(body.actorId))) });
          } catch (error) {
            sendLocalAgentProtocolError(response, error);
          }
          return;
        }
      }
    }

    if (segments[0] === "providers") {
      const providerService = context.providerAbstractionService;

      if (method === "GET" && segments.length === 1) {
        sendJson(response, 200, { providers: providerService.listProviders().map(providerCatalogEntryToDto) });
        return;
      }

      if (method === "GET" && segments[1] === "catalog") {
        sendJson(response, 200, { providers: providerService.listProviders().map(providerCatalogEntryToDto) });
        return;
      }

      if (method === "POST" && segments[1] === "validate") {
        const body = await readJson(request) as Record<string, unknown>;
        const providerId = stringValue(body.providerId);
        if (!providerId) {
          sendJson(response, 400, { error: "invalid_provider_validation", message: "providerId is required." });
          return;
        }
        const validation = providerService.validateProvider(providerId);
        sendJson(response, validation.ok ? 200 : 409, { validation: providerValidationResultToDto(validation) });
        return;
      }

      if (method === "GET" && segments[1] === "auth-types") {
        sendJson(response, 200, { authTypes: providerService.listAuthTypes() });
        return;
      }

      if (segments[1] === "local-cli") {
        if (method !== "GET") {
          sendJson(response, 405, { error: "local_cli_read_only", message: "Local CLI provider template endpoints are read-only." });
          return;
        }
        if (segments[2] === "templates" && segments.length === 3) {
          sendJson(response, 200, { templates: providerService.listLocalCliTemplates().map(localCliProviderTemplateToDto) });
          return;
        }
        if (segments[2] === "templates" && segments.length === 4) {
          const template = providerService.getLocalCliTemplate(segments[3]);
          if (!template) {
            notFound("local CLI provider template", segments[3]);
          }
          sendJson(response, 200, { template: localCliProviderTemplateToDto(template) });
          return;
        }
        if (segments[2] === "compatibility") {
          sendJson(response, 200, {
            rules: providerService.listLocalCliCompatibilityRules({
              providerId: url.searchParams.get("providerId") ?? undefined,
              templateId: url.searchParams.get("templateId") ?? undefined
            }).map(localCliCompatibilityRuleToDto),
            parserProfiles: providerService.listLocalCliParserProfiles({
              providerId: url.searchParams.get("providerId") ?? undefined
            }).map(localCliParserProfileToDto)
          });
          return;
        }
        if (segments[2] === "security-constraints") {
          sendJson(response, 200, {
            constraints: providerService.listLocalCliSecurityConstraints({
              providerId: url.searchParams.get("providerId") ?? undefined,
              constraint: url.searchParams.get("constraint") ?? undefined
            }).map(localCliSecurityConstraintToDto)
          });
          return;
        }
        if (segments[2] === "readiness") {
          sendJson(response, 200, { readiness: localCliProviderTemplateReadinessToDto(providerService.getLocalCliReadiness()) });
          return;
        }
      }

      if (method === "GET" && segments[1] === "local-agents") {
        sendJson(response, 200, { localAgents: providerService.listLocalAgents().map(localAgentDescriptorToDto) });
        return;
      }

      if (method === "POST" && segments[1] === "invoke") {
        const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
        const body = await readJson(request) as Record<string, unknown>;
        const providerId = stringValue(body.providerId);
        const prompt = stringValue(body.prompt);
        if (!providerId || !prompt) {
          sendJson(response, 400, { error: "invalid_provider_invocation", message: "providerId and prompt are required." });
          return;
        }
        const result = await providerService.invoke({
          providerId,
          prompt,
          taskId: stringValue(body.taskId),
          taskRunId: stringValue(body.taskRunId),
          actorId: stringValue(body.actorId) ?? requestContext.authContext.actor.id,
          modelId: stringValue(body.modelId),
          context: recordValue(body.context),
          instructionSetHash: stringValue(body.instructionSetHash),
          workspaceRef: stringValue(body.workspaceRef),
          metadata: {
            ...recordValue(body.metadata),
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            principalId: requestContext.authContext.principal.id,
            authMode: requestContext.authContext.authMode,
            source: requestContext.source
          }
        });
        sendJson(response, result.status === "completed" ? 201 : 409, { result: providerInvocationResultToDto(result) });
        return;
      }

      if (method === "GET" && segments[1] === "audit") {
        sendJson(response, 200, {
          auditEvents: providerService.listAuditEvents({
            providerId: url.searchParams.get("providerId") ?? undefined,
            eventType: url.searchParams.get("eventType") ?? undefined,
            actorId: url.searchParams.get("actorId") ?? undefined
          }).map(providerAuditEventToDto)
        });
        return;
      }

      if (method === "GET" && segments.length === 2) {
        const provider = providerService.getProvider(segments[1]);
        if (!provider) notFound("provider catalog entry", segments[1]);
        sendJson(response, 200, {
          provider: providerCatalogEntryToDto(provider),
          credentialReference: credentialReferenceResultToDto(providerService.getCredentialReference(provider.id))
        });
        return;
      }
    }

    if (segments[0] === "agents") {
      const agentService = context.agentRunnerService;

      if (method === "GET" && segments[1] === "runners") {
        sendJson(response, 200, { runners: agentService.listRunners() });
        return;
      }

      if (method === "GET" && segments[1] === "config") {
        sendJson(response, 200, { config: agentRunnerConfigToDto(agentService.getConfig()) });
        return;
      }

      if (method === "GET" && segments[1] === "executors") {
        sendJson(response, 200, { executors: agentService.listExecutors() });
        return;
      }

      if (segments[1] === "sessions") {
        const coordinationService = context.agentRunCoordinationService;
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, {
            sessions: coordinationService.listSessions({
              repoId: url.searchParams.get("repoId") ?? undefined,
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined,
              userId: url.searchParams.get("userId") ?? undefined,
              status: isAgentSessionStatus(url.searchParams.get("status")) ? url.searchParams.get("status") as AgentSessionStatus : undefined
            }).map(agentSessionToDto)
          });
          return;
        }

        if (method === "POST" && segments.length === 2) {
          const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
          const body = await readJson(request) as Record<string, unknown>;
          const userId = stringValue(body.userId) ?? requestContext.authContext.principal.id;
          const agentRunId = stringValue(body.agentRunId);
          const repoId = stringValue(body.repoId);
          const baseBranch = stringValue(body.baseBranch) ?? "main";
          if (!agentRunId || !repoId) {
            sendJson(response, 400, { error: "invalid_agent_session", message: "agentRunId and repoId are required." });
            return;
          }
          const session = coordinationService.registerSession({
            userId,
            actorId: stringValue(body.actorId) ?? requestContext.authContext.actor.id,
            taskId: stringValue(body.taskId),
            taskRunId: stringValue(body.taskRunId),
            agentRunId,
            repoId,
            providerId: stringValue(body.providerId),
            modelId: stringValue(body.modelId),
            branchLeaseId: stringValue(body.branchLeaseId),
            workspaceLeaseId: stringValue(body.workspaceLeaseId),
            baseBranch,
            branchName: stringValue(body.branchName),
            targetFiles: stringArrayValue(body.targetFiles),
            sourceScope: {
              scopeKind: isAgentSessionSourceScopeKind(recordValue(body.sourceScope).scopeKind) ? recordValue(body.sourceScope).scopeKind as AgentSessionSourceScopeKind : undefined,
              paths: stringArrayValue(recordValue(body.sourceScope).paths),
              description: stringValue(recordValue(body.sourceScope).description),
              metadata: recordValue(recordValue(body.sourceScope).metadata)
            },
            status: isAgentSessionStatus(body.status) ? body.status : undefined,
            metadata: recordValue(body.metadata)
          }, {
            actorId: requestContext.authContext.actor.id,
            principalId: requestContext.authContext.principal.id,
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            source: "api",
            metadata: { authMode: requestContext.authContext.authMode }
          });
          sendJson(response, 201, { session: agentSessionToDto(session) });
          return;
        }

        const sessionId = segments[2];
        if (!sessionId) {
          sendJson(response, 400, { error: "missing_agent_session_id", message: "agent session id is required." });
          return;
        }

        if (method === "POST") {
          const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
          const body = await readJson(request) as Record<string, unknown>;
          const coordinationContext = {
            actorId: requestContext.authContext.actor.id,
            principalId: requestContext.authContext.principal.id,
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            source: "api",
            metadata: { authMode: requestContext.authContext.authMode }
          };
          try {
            if (segments[3] === "target-files") {
              const session = coordinationService.updateTargetFiles(sessionId, stringArrayValue(body.files ?? body.targetFiles), coordinationContext);
              sendJson(response, 200, { session: agentSessionToDto(session) });
              return;
            }
            if (segments[3] === "branch-lease") {
              const branchLeaseId = stringValue(body.branchLeaseId);
              if (!branchLeaseId) {
                sendJson(response, 400, { error: "invalid_branch_lease_assignment", message: "branchLeaseId is required." });
                return;
              }
              const session = coordinationService.assignBranchLease(sessionId, branchLeaseId, coordinationContext);
              sendJson(response, 200, { session: agentSessionToDto(session) });
              return;
            }
            if (segments[3] === "workspace-lease") {
              const workspaceLeaseId = stringValue(body.workspaceLeaseId);
              if (!workspaceLeaseId) {
                sendJson(response, 400, { error: "invalid_workspace_lease_assignment", message: "workspaceLeaseId is required." });
                return;
              }
              const session = coordinationService.assignWorkspaceLease(sessionId, workspaceLeaseId, coordinationContext);
              sendJson(response, session.status === "waiting_on_conflict" ? 409 : 200, { session: agentSessionToDto(session) });
              return;
            }
            if (segments[3] === "ready-for-review") {
              const session = coordinationService.markReadyForReview(sessionId, coordinationContext);
              sendJson(response, 200, { session: agentSessionToDto(session) });
              return;
            }
            if (segments[3] === "ready-for-merge") {
              const session = coordinationService.markReadyForMerge(sessionId, coordinationContext);
              sendJson(response, 200, { session: agentSessionToDto(session) });
              return;
            }
          } catch (error) {
            sendJson(response, 404, { error: "agent_session_not_found", message: error instanceof Error ? error.message : "Agent session not found" });
            return;
          }
        }
      }

      if (segments[1] === "coordination") {
        const coordinationService = context.agentRunCoordinationService;
        if (method === "GET" && segments[2] === "groups" && segments[3] && segments[4] === "recommendation") {
          try {
            sendJson(response, 200, { recommendation: agentRunCoordinationRecommendationToDto(coordinationService.recommendCoordinationAction(segments[3])) });
          } catch (error) {
            sendJson(response, 404, { error: "coordination_group_not_found", message: error instanceof Error ? error.message : "Coordination group not found" });
          }
          return;
        }
        if (method === "GET" && segments[2] === "groups") {
          sendJson(response, 200, {
            groups: coordinationService.listCoordinationGroups({
              repoId: url.searchParams.get("repoId") ?? undefined,
              taskId: url.searchParams.get("taskId") ?? undefined,
              userId: url.searchParams.get("userId") ?? undefined
            }).map(agentRunCoordinationGroupToDto)
          });
          return;
        }
        if (method === "GET" && segments[2] === "overlaps") {
          sendJson(response, 200, {
            overlaps: coordinationService.listSessionOverlaps({
              repoId: url.searchParams.get("repoId") ?? undefined,
              sessionId: url.searchParams.get("sessionId") ?? undefined,
              severity: isAgentSessionOverlapSeverity(url.searchParams.get("severity")) ? url.searchParams.get("severity") as AgentSessionOverlapSeverity : undefined
            }).map(agentSessionOverlapToDto)
          });
          return;
        }
        if (method === "GET" && segments[2] === "summary") {
          sendJson(response, 200, { summary: agentRunCoordinationSummaryToDto(coordinationService.getSummary()) });
          return;
        }
        if (method === "GET" && segments[2] === "policies") {
          sendJson(response, 200, { policies: coordinationService.listConcurrencyPolicies().map(agentConcurrencyPolicyToDto) });
          return;
        }
        if (method === "GET" && segments[2] === "audit") {
          sendJson(response, 200, {
            auditEvents: coordinationService.listAuditEvents({
              repoId: url.searchParams.get("repoId") ?? undefined,
              sessionId: url.searchParams.get("sessionId") ?? undefined,
              groupId: url.searchParams.get("groupId") ?? undefined
            }).map(agentRunCoordinationAuditEventToDto)
          });
          return;
        }
        if (method === "POST" && segments[2] === "evaluate") {
          const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
          const body = await readJson(request) as Record<string, unknown>;
          const repoId = stringValue(body.repoId) ?? url.searchParams.get("repoId") ?? undefined;
          if (!repoId) {
            sendJson(response, 400, { error: "invalid_overlap_evaluation", message: "repoId is required." });
            return;
          }
          const overlaps = coordinationService.evaluateOverlap(repoId, {
            actorId: requestContext.authContext.actor.id,
            principalId: requestContext.authContext.principal.id,
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            source: "api",
            metadata: { authMode: requestContext.authContext.authMode }
          });
          sendJson(response, 200, { overlaps: overlaps.map(agentSessionOverlapToDto) });
          return;
        }
      }

      if (segments[1] === "edit-intents") {
        const editIntentService = context.editIntentGraphService;
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, {
            editIntents: editIntentService.listIntents({
              repoId: url.searchParams.get("repoId") ?? undefined,
              sessionId: url.searchParams.get("sessionId") ?? undefined,
              agentRunId: url.searchParams.get("agentRunId") ?? undefined,
              taskId: url.searchParams.get("taskId") ?? undefined,
              status: isEditIntentStatus(url.searchParams.get("status")) ? url.searchParams.get("status") as EditIntentStatus : undefined,
              intentKind: isEditIntentKind(url.searchParams.get("intentKind")) ? url.searchParams.get("intentKind") as EditIntentKind : undefined,
              workspaceLeaseId: url.searchParams.get("workspaceLeaseId") ?? undefined
            }).map(editIntentToDto)
          });
          return;
        }

        if (method === "POST" && segments.length === 2) {
          const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
          const body = await readJson(request) as Record<string, unknown>;
          const repoId = stringValue(body.repoId);
          const sessionId = stringValue(body.sessionId);
          const branchName = stringValue(body.branchName);
          const intentKind = isEditIntentKind(body.intentKind) ? body.intentKind : undefined;
          if (!repoId || !sessionId || !branchName || !intentKind) {
            sendJson(response, 400, { error: "invalid_edit_intent", message: "repoId, sessionId, branchName, and intentKind are required." });
            return;
          }
          const intent = editIntentService.declareIntent({
            repoId,
            sessionId,
            agentRunId: stringValue(body.agentRunId),
            taskId: stringValue(body.taskId),
            branchName,
            workspaceLeaseId: stringValue(body.workspaceLeaseId),
            intentKind,
            filePaths: stringArrayValue(body.filePaths),
            directoryScopes: stringArrayValue(body.directoryScopes),
            declaredSymbols: stringArrayValue(body.declaredSymbols),
            confidence: isEditIntentConfidence(body.confidence) ? body.confidence : undefined,
            status: isEditIntentStatus(body.status) ? body.status : undefined,
            metadata: recordValue(body.metadata)
          }, {
            actorId: requestContext.authContext.actor.id,
            principalId: requestContext.authContext.principal.id,
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            source: "api",
            metadata: { authMode: requestContext.authContext.authMode }
          });
          sendJson(response, 201, { editIntent: editIntentToDto(intent) });
          return;
        }
      }

      if (segments[1] === "file-leases") {
        const editIntentService = context.editIntentGraphService;
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, {
            fileLeases: editIntentService.listLeases({
              repoId: url.searchParams.get("repoId") ?? undefined,
              ownerSessionId: url.searchParams.get("ownerSessionId") ?? url.searchParams.get("sessionId") ?? undefined,
              ownerAgentRunId: url.searchParams.get("ownerAgentRunId") ?? url.searchParams.get("agentRunId") ?? undefined,
              ownerTaskId: url.searchParams.get("ownerTaskId") ?? url.searchParams.get("taskId") ?? undefined,
              status: isFileLeaseStatus(url.searchParams.get("status")) ? url.searchParams.get("status") as FileLeaseStatus : undefined,
              leaseKind: isFileLeaseKind(url.searchParams.get("leaseKind")) ? url.searchParams.get("leaseKind") as FileLeaseKind : undefined,
              workspaceLeaseId: url.searchParams.get("workspaceLeaseId") ?? undefined
            }).map(fileLeaseToDto)
          });
          return;
        }

        if (method === "POST" && segments.length === 2) {
          const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
          const body = await readJson(request) as Record<string, unknown>;
          const repoId = stringValue(body.repoId);
          const filePath = stringValue(body.filePath);
          const leaseKind = isFileLeaseKind(body.leaseKind) ? body.leaseKind : undefined;
          const ownerSessionId = stringValue(body.ownerSessionId) ?? stringValue(body.sessionId);
          const branchName = stringValue(body.branchName);
          if (!repoId || !filePath || !leaseKind || !ownerSessionId || !branchName) {
            sendJson(response, 400, { error: "invalid_file_lease", message: "repoId, filePath, leaseKind, ownerSessionId, and branchName are required." });
            return;
          }
          const lease = editIntentService.requestFileLease({
            repoId,
            filePath,
            leaseKind,
            ownerSessionId,
            ownerAgentRunId: stringValue(body.ownerAgentRunId) ?? stringValue(body.agentRunId),
            ownerTaskId: stringValue(body.ownerTaskId) ?? stringValue(body.taskId),
            ownerActorId: stringValue(body.ownerActorId) ?? requestContext.authContext.actor.id,
            branchName,
            workspaceLeaseId: stringValue(body.workspaceLeaseId),
            status: isFileLeaseStatus(body.status) ? body.status : undefined,
            metadata: recordValue(body.metadata)
          }, {
            actorId: requestContext.authContext.actor.id,
            principalId: requestContext.authContext.principal.id,
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            source: "api",
            metadata: { authMode: requestContext.authContext.authMode }
          });
          sendJson(response, lease.status === "blocked_overlap" ? 409 : 201, { fileLease: fileLeaseToDto(lease) });
          return;
        }

        if (method === "POST" && segments[2] && segments[3] === "release") {
          const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
          try {
            const lease = editIntentService.releaseFileLease(segments[2], {
              actorId: requestContext.authContext.actor.id,
              principalId: requestContext.authContext.principal.id,
              requestId: requestContext.requestId,
              correlationId: requestContext.correlationId,
              source: "api",
              metadata: { authMode: requestContext.authContext.authMode }
            });
            sendJson(response, 200, { fileLease: fileLeaseToDto(lease) });
          } catch (error) {
            sendJson(response, 404, { error: "file_lease_not_found", message: error instanceof Error ? error.message : "File lease not found" });
          }
          return;
        }
      }

      if (method === "GET" && segments[1] === "edit-intent-graph") {
        const repoId = url.searchParams.get("repoId") ?? undefined;
        sendJson(response, 200, { graph: editIntentGraphToDto(context.editIntentGraphService.listGraph({ repoId })) });
        return;
      }

      if (segments[1] === "edit-overlaps") {
        const editIntentService = context.editIntentGraphService;
        if (method === "GET" && segments[2] && segments[3] === "recommendation") {
          try {
            sendJson(response, 200, { overlap: editOverlapAssessmentToDto(editIntentService.recommendAction(segments[2])) });
          } catch (error) {
            sendJson(response, 404, { error: "edit_overlap_not_found", message: error instanceof Error ? error.message : "Edit overlap assessment not found" });
          }
          return;
        }
        if (method === "GET") {
          sendJson(response, 200, {
            overlaps: editIntentService.listOverlapAssessments({
              repoId: url.searchParams.get("repoId") ?? undefined,
              sessionId: url.searchParams.get("sessionId") ?? undefined,
              severity: isEditOverlapSeverity(url.searchParams.get("severity")) ? url.searchParams.get("severity") as EditOverlapSeverity : undefined,
              recommendation: isEditOverlapRecommendation(url.searchParams.get("recommendation")) ? url.searchParams.get("recommendation") as EditOverlapRecommendation : undefined,
              overlapKind: isEditOverlapKind(url.searchParams.get("overlapKind")) ? url.searchParams.get("overlapKind") as EditOverlapKind : undefined
            }).map(editOverlapAssessmentToDto)
          });
          return;
        }
      }

      if (method === "GET" && segments[1] === "edit-intent-summary") {
        sendJson(response, 200, { summary: editIntentOverlapSummaryToDto(context.editIntentGraphService.getOverlapSummary(url.searchParams.get("repoId") ?? undefined)) });
        return;
      }

      if (segments[1] === "worktrees") {
        const worktreeService = context.agentWorktreeAllocationService;
        if (method === "GET" && segments[2] === "allocations") {
          sendJson(response, 200, {
            requests: worktreeService.listRequests({
              repoId: url.searchParams.get("repoId") ?? undefined,
              branchLeaseId: url.searchParams.get("branchLeaseId") ?? undefined,
              workspaceLeaseId: url.searchParams.get("workspaceLeaseId") ?? undefined,
              allocationMode: isAgentWorktreeAllocationMode(url.searchParams.get("allocationMode")) ? url.searchParams.get("allocationMode") as AgentWorktreeAllocationMode : undefined
            }).map(agentWorktreeAllocationRequestToDto),
            allocations: worktreeService.listAllocations({
              repoId: url.searchParams.get("repoId") ?? undefined,
              branchLeaseId: url.searchParams.get("branchLeaseId") ?? undefined,
              workspaceLeaseId: url.searchParams.get("workspaceLeaseId") ?? undefined,
              allocationMode: isAgentWorktreeAllocationMode(url.searchParams.get("allocationMode")) ? url.searchParams.get("allocationMode") as AgentWorktreeAllocationMode : undefined,
              decision: isAgentWorktreeAllocationDecision(url.searchParams.get("decision")) ? url.searchParams.get("decision") as AgentWorktreeAllocationDecision : undefined
            }).map(agentWorktreeAllocationResultToDto)
          });
          return;
        }
        if (method === "GET" && segments[2] === "safety-checks") {
          sendJson(response, 200, {
            safetyChecks: worktreeService.listSafetyChecks({
              requestId: url.searchParams.get("requestId") ?? undefined,
              resultId: url.searchParams.get("resultId") ?? undefined,
              status: isAgentWorktreeSafetyStatus(url.searchParams.get("status")) ? url.searchParams.get("status") as AgentWorktreeSafetyStatus : undefined,
              checkKind: isAgentWorktreeSafetyCheckKind(url.searchParams.get("checkKind")) ? url.searchParams.get("checkKind") as AgentWorktreeSafetyCheckKind : undefined
            }).map(agentWorktreeSafetyCheckToDto)
          });
          return;
        }
        if (method === "GET" && segments[2] === "summary") {
          sendJson(response, 200, { summary: agentWorktreeAllocationSummaryToDto(worktreeService.getSummary()) });
          return;
        }
        if (method === "POST" && (segments[2] === "dry-run" || segments[2] === "fixture-allocate")) {
          const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
          const body = await readJson(request) as Record<string, unknown>;
          const repoId = stringValue(body.repoId);
          const branchName = stringValue(body.branchName);
          const requestedPath = stringValue(body.requestedPath);
          const workspaceRoot = stringValue(body.workspaceRoot);
          const agentRunId = stringValue(body.agentRunId);
          const branchLeaseId = stringValue(body.branchLeaseId);
          if (!repoId || !branchName || !requestedPath || !workspaceRoot || !agentRunId || !branchLeaseId) {
            sendJson(response, 400, {
              error: "invalid_agent_worktree_allocation_request",
              message: "repoId, branchName, branchLeaseId, requestedPath, workspaceRoot, and agentRunId are required."
            });
            return;
          }
          const input = {
            id: stringValue(body.id),
            repoId,
            baseRepoPath: stringValue(body.baseRepoPath),
            baseBranch: stringValue(body.baseBranch) ?? "main",
            branchName,
            branchLeaseId,
            workspaceLeaseId: stringValue(body.workspaceLeaseId),
            requestedPath,
            workspaceRoot,
            agentRunId,
            taskId: stringValue(body.taskId),
            userId: stringValue(body.userId) ?? requestContext.authContext.principal.id,
            allocationMode: segments[2] === "fixture-allocate" ? "fixture_only" as const : "dry_run" as const,
            metadata: recordValue(body.metadata)
          };
          const allocationContext = agentWorktreeAllocationContextFromInput(requestContext, body);
          const result = segments[2] === "fixture-allocate"
            ? await worktreeService.allocateFixtureWorktree(input, allocationContext)
            : worktreeService.dryRunAllocate(input, allocationContext);
          sendJson(response, agentWorktreeAllocationStatusCode(result.decision), {
            allocation: agentWorktreeAllocationResultToDto(result),
            summary: agentWorktreeAllocationSummaryToDto(worktreeService.getSummary())
          });
          return;
        }
      }

      if (segments[1] === "workspaces") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, {
            workspaces: agentService.listWorkspaces().map(agentWorkspaceToDto),
            workspaceLeases: agentService.listWorkspaceLeases({
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined,
              agentRunId: url.searchParams.get("agentRunId") ?? undefined,
              repoId: url.searchParams.get("repoId") ?? undefined,
              branchLeaseId: url.searchParams.get("branchLeaseId") ?? undefined,
              status: isAgentWorkspaceLifecycleStatus(url.searchParams.get("status")) ? url.searchParams.get("status") as AgentWorkspaceLifecycleStatus : undefined,
              workspaceKind: isAgentWorkspaceKind(url.searchParams.get("workspaceKind")) ? url.searchParams.get("workspaceKind") as AgentWorkspaceKind : undefined
            }).map(agentWorkspaceLeaseToDto),
            cleanupDecisions: agentService.listWorkspaceCleanupDecisions().map(agentWorkspaceCleanupDecisionToDto)
          });
          return;
        }

        if (method === "POST" && segments[2] === "request") {
          const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
          const body = await readJson(request) as Record<string, unknown>;
          const taskId = stringValue(body.taskId);
          const agentRunId = stringValue(body.agentRunId);
          const repoId = stringValue(body.repoId);
          const branchName = stringValue(body.branchName);
          const baseBranch = stringValue(body.baseBranch) ?? "main";
          const workspaceKind = isAgentWorkspaceKind(body.workspaceKind) ? body.workspaceKind : "git_worktree_future";
          if (!taskId || !agentRunId || !repoId || !branchName) {
            sendJson(response, 400, { error: "invalid_workspace_request", message: "taskId, agentRunId, repoId, and branchName are required." });
            return;
          }
          const lifecycleContext = {
            actorId: requestContext.authContext.actor.id,
            serviceAccountId: stringValue((requestContext.authContext.actor as { serviceAccountId?: unknown }).serviceAccountId),
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            metadata: {
              source: "api",
              authMode: requestContext.authContext.authMode,
              principalId: requestContext.authContext.principal.id
            }
          };
          const common = {
            taskId,
            taskRunId: stringValue(body.taskRunId),
            agentRunId,
            repoId,
            branchLeaseId: stringValue(body.branchLeaseId),
            branchName,
            baseBranch,
            ownerActorId: stringValue(body.ownerActorId) ?? requestContext.authContext.actor.id,
            ownerServiceAccountId: stringValue(body.ownerServiceAccountId),
            metadata: recordValue(body.metadata)
          };
          const workspacePath = stringValue(body.workspacePath);
          const lease = workspaceKind === "fixture" && workspacePath
            ? await agentService.allocateFixtureWorkspaceLease({ ...common, workspacePath }, lifecycleContext)
            : agentService.requestWorkspaceLease({ ...common, workspaceKind, workspacePath }, lifecycleContext);
          sendJson(response, lease.status === "failed" ? 409 : 201, { workspaceLease: agentWorkspaceLeaseToDto(lease) });
          return;
        }

        const workspaceId = segments[2];
        if (!workspaceId) {
          sendJson(response, 400, { error: "missing_workspace_id", message: "workspace id is required." });
          return;
        }

        const workspaceLease = agentService.getWorkspaceLease(workspaceId);
        if (method === "GET" && segments[3] === "events") {
          if (!workspaceLease) notFound("agent workspace lease", workspaceId);
          sendJson(response, 200, { events: agentService.listWorkspaceLifecycleEvents(workspaceId).map(agentWorkspaceLifecycleEventToDto) });
          return;
        }

        if (method === "POST") {
          const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
          if (!workspaceLease) notFound("agent workspace lease", workspaceId);
          const lifecycleContext = {
            actorId: requestContext.authContext.actor.id,
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            metadata: { source: "api", authMode: requestContext.authContext.authMode }
          };
          if (segments[3] === "activate") {
            sendJson(response, 200, { workspaceLease: agentWorkspaceLeaseToDto(agentService.markWorkspaceLeaseActive(workspaceId, lifecycleContext)) });
            return;
          }
          if (segments[3] === "freeze") {
            sendJson(response, 200, { workspaceLease: agentWorkspaceLeaseToDto(agentService.freezeWorkspaceLease(workspaceId, lifecycleContext)) });
            return;
          }
          if (segments[3] === "ready-for-merge") {
            sendJson(response, 200, { workspaceLease: agentWorkspaceLeaseToDto(agentService.markWorkspaceLeaseReadyForMerge(workspaceId, lifecycleContext)) });
            return;
          }
          if (segments[3] === "merge-completed") {
            sendJson(response, 200, { workspaceLease: agentWorkspaceLeaseToDto(agentService.recordWorkspaceLeaseMergeCompleted(workspaceId, lifecycleContext)) });
            return;
          }
          if (segments[3] === "cleanup" && segments[4] === "check") {
            const body = await readJson(request) as Record<string, unknown>;
            agentService.requestWorkspaceLeaseCleanup(workspaceId, lifecycleContext);
            const decision = agentService.evaluateWorkspaceLeaseCleanup(workspaceId, {
              changedFiles: stringArrayValue(body.changedFiles),
              dirty: typeof body.dirty === "boolean" ? body.dirty : undefined,
              uncommittedChanges: typeof body.uncommittedChanges === "boolean" ? body.uncommittedChanges : undefined,
              mergeStatus: isAgentWorkspaceMergeStatus(body.mergeStatus) ? body.mergeStatus : undefined,
              policyAllowed: typeof body.policyAllowed === "boolean" ? body.policyAllowed : undefined,
              policyDecisionId: stringValue(body.policyDecisionId),
              reason: stringValue(body.reason),
              metadata: recordValue(body.metadata)
            }, lifecycleContext);
            sendJson(response, 200, { cleanupDecision: agentWorkspaceCleanupDecisionToDto(decision) });
            return;
          }
        }

        const workspace = agentService.getWorkspace(workspaceId);
        if (!workspace && !workspaceLease) notFound("agent workspace", workspaceId);
        if (method === "GET") {
          const cleanupDecision = workspaceLease
            ? agentService.listWorkspaceCleanupDecisions(workspaceLease.id).map(agentWorkspaceCleanupDecisionToDto).at(-1)
            : undefined;
          sendJson(response, 200, {
            workspace: workspace ? agentWorkspaceToDto(workspace) : undefined,
            workspaceLease: workspaceLease ? agentWorkspaceLeaseToDto(workspaceLease) : undefined,
            cleanupDecision
          });
          return;
        }
      }

      if (segments[1] === "runs") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, {
            agentRuns: agentService.listRuns({
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined
            }).map(agentRunToDto)
          });
          return;
        }

        if (method === "POST" && segments.length === 2) {
          const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
          const body = await readJson(request) as Record<string, unknown>;
          const taskId = stringValue(body.taskId);
          const taskRunId = stringValue(body.taskRunId);
          const prompt = stringValue(body.prompt);
          const selectedModelRef = stringValue(body.selectedModelRef) ?? "mock-coder@1.0";
          if (!taskId || !taskRunId || !prompt) {
            sendJson(response, 400, { error: "invalid_agent_run", message: "taskId, taskRunId, and prompt are required." });
            return;
          }
          const run = await agentService.runAgent({
            taskId,
            taskRunId,
            actorId: stringValue(body.actorId) ?? requestContext.authContext.actor.id,
            repoRef: {
              repoId: stringValue(body.repoId) ?? "repo_demo_backend",
              localPath: stringValue(body.localPath)
            },
            branchRef: {
              repoId: stringValue(body.repoId) ?? "repo_demo_backend",
              branchName: stringValue(body.branchName) ?? "mock-agent-run",
              baseBranch: stringValue(body.baseBranch) ?? "main"
            },
            selectedModelRef,
            selectedSkillRefs: registryRefsValue(body.selectedSkillRefs, "skill", "mock-runner-skill"),
            selectedHarnessRef: registryRefValue(body.selectedHarnessRef, "harness", "backend-node20"),
            selectedInstructionRefs: registryRefsValue(body.selectedInstructionRefs, "instruction", "org-secure-coding-baseline"),
            prompt,
            allowedCommands: Array.isArray(body.allowedCommands) ? body.allowedCommands.filter((command): command is string => typeof command === "string") : [],
            testCommands: Array.isArray(body.testCommands) ? body.testCommands.filter((command): command is string => typeof command === "string") : ["pnpm test"],
            maxRuntimeMs: typeof body.maxRuntimeMs === "number" ? body.maxRuntimeMs : context.agentRunnerConfig.maxRuntimeMs,
            metadata: {
              budgetLimitUsd: typeof body.budgetLimitUsd === "number" ? body.budgetLimitUsd : undefined,
              source: "api",
              requestId: requestContext.requestId,
              correlationId: requestContext.correlationId,
              principalId: requestContext.authContext.principal.id,
              authMode: requestContext.authContext.authMode,
              branchLeaseId: stringValue(body.branchLeaseId),
              workspaceLeaseId: stringValue(body.workspaceLeaseId)
            }
          });
          sendJson(response, run.status === "blocked" ? 409 : 201, { agentRun: agentRunToDto(run) });
          return;
        }

        const runId = segments[2];
        if (!runId) {
          sendJson(response, 400, { error: "missing_agent_run_id", message: "agent run id is required." });
          return;
        }
        const run = agentService.getRun(runId);
        if (!run) notFound("agent run", runId);

        if (method === "GET" && segments.length === 3) {
          sendJson(response, 200, { agentRun: agentRunToDto(run) });
          return;
        }
        if (method === "GET" && segments[3] === "audit") {
          sendJson(response, 200, { auditEvents: agentService.listAuditEvents({ runId }).map(agentRunAuditEventToDto) });
          return;
        }
        if (method === "GET" && segments[3] === "instructions") {
          const assembly = agentService.getInstructionAssemblyForTaskRun(run.taskRunId);
          sendJson(response, 200, { instructionAssembly: assembly ? instructionAssemblyToDto(assembly) : undefined });
          return;
        }
        if (method === "GET" && segments[3] === "commands") {
          sendJson(response, 200, {
            commandResults: agentService.listCommandResults({ agentRunId: runId }).map(commandExecutionResultToDto)
          });
          return;
        }
        if (method === "GET" && segments[3] === "workspace") {
          const workspace = agentService.getWorkspaceForRun(runId);
          sendJson(response, 200, { workspace: workspace ? agentWorkspaceToDto(workspace) : undefined });
          return;
        }
        if (method === "POST" && segments[3] === "execute-command") {
          const body = await readJson(request) as Record<string, unknown>;
          const command = stringValue(body.command);
          const args = Array.isArray(body.args) ? body.args.filter((arg): arg is string => typeof arg === "string") : [];
          if (!command) {
            sendJson(response, 400, { error: "invalid_command", message: "command is required." });
            return;
          }
          const commandResult = await agentService.executeCommandForRun(runId, {
            workspacePath: stringValue(body.workspacePath),
            command,
            args,
            allowedCommands: Array.isArray(body.allowedCommands) ? body.allowedCommands.filter((item): item is string => typeof item === "string") : [],
            deniedCommands: Array.isArray(body.deniedCommands) ? body.deniedCommands.filter((item): item is string => typeof item === "string") : undefined,
            timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined
          });
          sendJson(response, commandResult.status === "blocked" ? 409 : 200, { commandResult: commandExecutionResultToDto(commandResult) });
          return;
        }
      }
    }

    if (segments[0] === "improvement") {
      if (segments[1] === "failure-signals") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { failureSignals: improvementServices.signals.listSignals().map(failureSignalToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (!isFailureSeverity(body.severity) || !isFailureSignalTargetKind(body.targetKind)) {
              sendJson(response, 400, { error: "invalid_failure_signal", message: "severity and targetKind must be valid Phase 4 preparation values." });
              return;
            }
            const signal = improvementServices.signals.createSignal(body as Parameters<ImprovementServices["signals"]["createSignal"]>[0]);
            sendJson(response, 201, { failureSignal: failureSignalToDto(signal) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_failure_signal", message: error instanceof Error ? error.message : "Invalid failure signal" });
          }
          return;
        }
      }

      if (segments[1] === "failure-clusters") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { failureClusters: improvementServices.clustering.listClusters().map(failureClusterToDto) });
          return;
        }
        if (method === "POST" && segments[2] === "recompute") {
          sendJson(response, 200, { failureClusters: improvementServices.clustering.recomputeClusters().map(failureClusterToDto) });
          return;
        }
      }

      if (segments[1] === "clusters") {
        const clusterId = segments[2];
        if (method === "POST" && segments[3] === "analyze") {
          if (!clusterId) {
            sendJson(response, 400, { error: "missing_cluster_id", message: "cluster id is required." });
            return;
          }
          try {
            const analysis = improvementServices.autoImprovement.analyzeFailureCluster(clusterId, { requestContext: apiRequestContext });
            sendJson(response, 201, { analysis: autoImprovementAnalysisToDto(analysis) });
          } catch (error) {
            sendJson(response, 404, { error: "cluster_analysis_failed", message: error instanceof Error ? error.message : "Cluster analysis failed" });
          }
          return;
        }
        if (method === "POST" && segments[3] === "generate-candidate") {
          if (!clusterId) {
            sendJson(response, 400, { error: "missing_cluster_id", message: "cluster id is required." });
            return;
          }
          try {
            const candidate = improvementServices.autoImprovement.generateImprovementCandidate(clusterId, { requestContext: apiRequestContext });
            sendJson(response, 201, { candidate: improvementCandidateToDto(candidate) });
          } catch (error) {
            sendJson(response, 404, { error: "candidate_generation_failed", message: error instanceof Error ? error.message : "Candidate generation failed" });
          }
          return;
        }
      }

      if (segments[1] === "analyses") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { analyses: improvementServices.autoImprovement.listAnalyses().map(autoImprovementAnalysisToDto) });
          return;
        }
        if (method === "GET" && segments.length === 3) {
          const analysis = improvementServices.autoImprovement.getAnalysis(segments[2]);
          if (!analysis) {
            sendJson(response, 404, { error: "analysis_not_found", message: `Auto-improvement analysis not found: ${segments[2]}` });
            return;
          }
          sendJson(response, 200, { analysis: autoImprovementAnalysisToDto(analysis) });
          return;
        }
      }

      if (segments[1] === "candidates") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { candidates: improvementServices.candidates.listCandidates().map(improvementCandidateToDto) });
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "generate-proposal") {
          if (!segments[2]) {
            sendJson(response, 400, { error: "missing_candidate_id", message: "candidate id is required." });
            return;
          }
          try {
            const proposal = improvementServices.autoImprovement.generateImprovementProposal(segments[2], { requestContext: apiRequestContext });
            sendJson(response, 201, { proposal: improvementProposalToDto(proposal) });
          } catch (error) {
            sendJson(response, 404, { error: "proposal_generation_failed", message: error instanceof Error ? error.message : "Proposal generation failed" });
          }
          return;
        }
        if (method === "POST" && segments[2] === "triage") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (typeof body.id === "string" || typeof body.candidateId === "string") {
              const status = body.status;
              if (!isImprovementCandidateStatus(status)) {
                sendJson(response, 400, { error: "invalid_candidate_status", message: "status must be new, triaged, proposal_requested, proposal_created, or dismissed." });
                return;
              }
              const candidate = improvementServices.candidates.triageCandidate({ id: String(body.id ?? body.candidateId), status });
              sendJson(response, 200, { candidate: improvementCandidateToDto(candidate) });
              return;
            }
            const candidate = improvementServices.candidates.createCandidateFromCluster(body as Parameters<ImprovementServices["candidates"]["createCandidateFromCluster"]>[0]);
            const triaged = improvementServices.candidates.triageCandidate({ id: candidate.id, status: "triaged" });
            sendJson(response, 201, { candidate: improvementCandidateToDto(triaged) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_candidate_triage", message: error instanceof Error ? error.message : "Invalid candidate triage" });
          }
          return;
        }
      }

      if (segments[1] === "proposal-review-queue") {
        if (method === "GET" && segments.length === 2) {
          const status = url.searchParams.get("status") ?? undefined;
          const targetKind = url.searchParams.get("targetKind") ?? undefined;
          const recommendedAction = url.searchParams.get("recommendedAction") ?? undefined;
          const includeArchived = url.searchParams.get("includeArchived") === "true";
          if (status !== undefined && !isImprovementProposalStatus(status)) {
            sendJson(response, 400, { error: "invalid_proposal_status", message: "status is invalid." });
            return;
          }
          if (targetKind !== undefined && !["skill", "harness", "instruction"].includes(targetKind)) {
            sendJson(response, 400, { error: "invalid_target_kind", message: "targetKind must be skill, harness, or instruction." });
            return;
          }
          const queue = improvementServices.governance.listReviewQueue({
            status,
            targetKind: targetKind as "skill" | "harness" | "instruction" | undefined,
            recommendedAction: recommendedAction as "review_proposal" | "attach_eval_result" | "prepare_canary_plan" | "ready_for_canary_review" | "no_action" | undefined,
            includeArchived
          });
          sendJson(response, 200, { proposalReviewQueue: queue.map(proposalReviewQueueItemToDto) });
          return;
        }
      }

      if (segments[1] === "proposals") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { proposals: improvementServices.proposals.listProposals().map(improvementProposalToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Parameters<ImprovementServices["proposals"]["createDraftProposal"]>[0];
            const proposal = improvementServices.proposals.createDraftProposal({ ...body, requestContext: apiRequestContext });
            sendJson(response, 201, { proposal: improvementProposalToDto(proposal) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_improvement_proposal", message: error instanceof Error ? error.message : "Invalid improvement proposal" });
          }
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "prepare-draft-change") {
          if (!segments[2]) {
            sendJson(response, 400, { error: "missing_proposal_id", message: "proposal id is required." });
            return;
          }
          try {
            const draftChange = improvementServices.autoImprovement.prepareDraftRegistryChange(segments[2], { requestContext: apiRequestContext });
            sendJson(response, 201, { draftRegistryChange: draftRegistryChangeToDto(draftChange) });
          } catch (error) {
            sendJson(response, 404, { error: "draft_change_preparation_failed", message: error instanceof Error ? error.message : "Draft registry change preparation failed" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "decisions") {
          try {
            const decisions = improvementServices.governance.listDecisions(segments[2]);
            sendJson(response, 200, { decisions: decisions.map(proposalGovernanceDecisionToDto) });
          } catch (error) {
            sendJson(response, 404, { error: "proposal_decisions_failed", message: error instanceof Error ? error.message : "Proposal decisions failed" });
          }
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "decisions") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (!isProposalGovernanceDecision(body.decision)) {
              sendJson(response, 400, { error: "invalid_governance_decision", message: "decision is invalid." });
              return;
            }
            const decision = improvementServices.governance.recordDecision({
              proposalId: segments[2],
              actorId: typeof body.actorId === "string" ? body.actorId : "mock-admin",
              requestContext: apiRequestContext,
              decision: body.decision,
              reason: typeof body.reason === "string" ? body.reason : "",
              metadata: {
                apiRoute: "/improvement/proposals/:id/decisions"
              }
            });
            sendJson(response, 201, { decision: proposalGovernanceDecisionToDto(decision) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_governance_decision", message: error instanceof Error ? error.message : "Invalid governance decision" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "eval-runs") {
          try {
            const runs = improvementServices.proposalEvalRuns.listEvalRuns(segments[2]);
            sendJson(response, 200, { evalRuns: runs.map(proposalEvalRunToDto) });
          } catch (error) {
            sendJson(response, 404, { error: "proposal_eval_runs_failed", message: error instanceof Error ? error.message : "Proposal eval runs failed" });
          }
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "eval-runs") {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (!isProposalEvalRunStatus(body.status)) {
              sendJson(response, 400, { error: "invalid_eval_run_status", message: "status must be pending, passed, failed, or skipped." });
              return;
            }
            const run = improvementServices.proposalEvalRuns.attachEvalRun({
              ...body,
              proposalId: segments[2],
              status: body.status,
              requestContext: apiRequestContext
            } as Parameters<ImprovementServices["proposalEvalRuns"]["attachEvalRun"]>[0]);
            sendJson(response, 201, { evalRun: proposalEvalRunToDto(run) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_eval_run", message: error instanceof Error ? error.message : "Invalid proposal eval run" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "canary-readiness") {
          try {
            const readiness = improvementServices.canaryReadiness.evaluate(segments[2], { requestContext: apiRequestContext });
            sendJson(response, 200, { canaryReadiness: canaryReadinessToDto(readiness) });
          } catch (error) {
            sendJson(response, 404, { error: "canary_readiness_failed", message: error instanceof Error ? error.message : "Canary readiness failed" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "apply-gate") {
          try {
            const gate = improvementServices.applyGate.evaluate(segments[2], { requestContext: apiRequestContext });
            sendJson(response, 200, { applyGate: proposalApplyGateToDto(gate) });
          } catch (error) {
            sendJson(response, 404, { error: "apply_gate_failed", message: error instanceof Error ? error.message : "Apply gate failed" });
          }
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "apply") {
          try {
            const gate = improvementServices.applyGate.blockApplyAttempt(segments[2], { requestContext: apiRequestContext });
            sendJson(response, 403, {
              error: "apply_not_implemented",
              message: "Applying draft registry changes is not implemented in Phase 4 Governance v1.",
              applyGate: proposalApplyGateToDto(gate)
            });
          } catch (error) {
            sendJson(response, 404, { error: "apply_gate_failed", message: error instanceof Error ? error.message : "Apply gate failed" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "readiness") {
          if (!segments[2]) {
            sendJson(response, 400, { error: "missing_proposal_id", message: "proposal id is required." });
            return;
          }
          try {
            const readiness = improvementServices.autoImprovement.evaluateProposalReadiness(segments[2], { requestContext: apiRequestContext });
            sendJson(response, 200, { readiness: proposalReadinessToDto(readiness) });
          } catch (error) {
            sendJson(response, 404, { error: "proposal_readiness_failed", message: error instanceof Error ? error.message : "Proposal readiness failed" });
          }
          return;
        }
        if (method === "PATCH" && segments.length === 4 && segments[3] === "status") {
          const body = await readJson(request) as Record<string, unknown>;
          if (!isImprovementProposalStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_proposal_status", message: "status is invalid." });
            return;
          }
          try {
            const proposal = improvementServices.proposals.transitionProposalStatus({ id: segments[2], status: body.status });
            sendJson(response, 200, { proposal: improvementProposalToDto(proposal) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_proposal_transition", message: error instanceof Error ? error.message : "Invalid proposal status transition" });
          }
          return;
        }
      }

      if (segments[1] === "governance-audit") {
        if (method === "GET" && segments.length === 2) {
          const proposalId = url.searchParams.get("proposalId") ?? undefined;
          sendJson(response, 200, { events: improvementServices.governance.listAuditEvents(proposalId).map(improvementGovernanceAuditEventToDto) });
          return;
        }
      }

      if (segments[1] === "draft-registry-changes") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { draftRegistryChanges: improvementServices.draftRegistryChanges.listDraftChanges().map(draftRegistryChangeToDto) });
          return;
        }
        if (method === "GET" && segments.length === 3) {
          const draftChange = improvementServices.draftRegistryChanges.getDraftChange(segments[2]);
          if (!draftChange) {
            sendJson(response, 404, { error: "draft_registry_change_not_found", message: `Draft registry change not found: ${segments[2]}` });
            return;
          }
          sendJson(response, 200, { draftRegistryChange: draftRegistryChangeToDto(draftChange) });
          return;
        }
        if (method === "PATCH" && segments.length === 4 && segments[3] === "status") {
          const body = await readJson(request) as Record<string, unknown>;
          if (!isDraftRegistryChangeStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_draft_registry_change_status", message: "status must be draft, awaiting_review, rejected, or superseded." });
            return;
          }
          try {
            const draftChange = improvementServices.draftRegistryChanges.transitionDraftChange({ id: segments[2], status: body.status, requestContext: apiRequestContext });
            sendJson(response, 200, { draftRegistryChange: draftRegistryChangeToDto(draftChange) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_draft_registry_change_transition", message: error instanceof Error ? error.message : "Invalid draft registry change transition" });
          }
          return;
        }
      }

      if (segments[1] === "eval-requirements") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { evalRequirements: improvementServices.evalRequirements.listRequirements().map(evalRequirementToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const requirement = improvementServices.evalRequirements.createRequirement(await readJson(request) as Parameters<ImprovementServices["evalRequirements"]["createRequirement"]>[0]);
            sendJson(response, 201, { evalRequirement: evalRequirementToDto(requirement) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_eval_requirement", message: error instanceof Error ? error.message : "Invalid eval requirement" });
          }
          return;
        }
      }

      if (segments[1] === "canary-plans") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { canaryPlans: improvementServices.canaryPlans.listPlans().map(canaryRolloutPlanToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const plan = improvementServices.canaryPlans.createPlan(await readJson(request) as Parameters<ImprovementServices["canaryPlans"]["createPlan"]>[0]);
            sendJson(response, 201, { canaryPlan: canaryRolloutPlanToDto(plan) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_canary_plan", message: error instanceof Error ? error.message : "Invalid canary plan" });
          }
          return;
        }
      }

      if (segments[1] === "safety-policies") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { safetyPolicies: improvementServices.safetyPolicies.listPolicies().map(safetyPolicyToDto) });
          return;
        }
        if (method === "PATCH" && segments.length === 3) {
          try {
            const policy = improvementServices.safetyPolicies.updatePolicy(segments[2], await readJson(request) as Parameters<ImprovementServices["safetyPolicies"]["updatePolicy"]>[1]);
            sendJson(response, 200, { safetyPolicy: safetyPolicyToDto(policy) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_safety_policy_update", message: error instanceof Error ? error.message : "Invalid safety policy update" });
          }
          return;
        }
      }
    }

    if (segments[0] === "registry") {
      if (segments[1] === "audit" && method === "GET") {
        const targetKindParam = url.searchParams.get("targetKind") ?? undefined;
        const targetId = url.searchParams.get("targetId") ?? undefined;
        if (targetKindParam !== undefined && !isRegistryTargetKind(targetKindParam)) {
          sendJson(response, 400, { error: "invalid_target_kind", message: "targetKind must be skill, harness, or instruction." });
          return;
        }
        const targetKind = targetKindParam;
        const auditScopeDecision = context.registryTenantScopeEnforcementService.evaluateRegistryAuditQuery({
          resourceId: targetKind && targetId ? `${targetKind}:${targetId}:audit` : "registry_audit_query"
        }, registryScopeContextFromRequest(apiRequestContext));
        sendJson(response, 200, {
          auditLogs: registryService.listAuditLogs({ targetKind, targetId, requestContext: apiRequestContext }).map(registryAuditLogToDto),
          scopeDecision: registryScopeDecisionToDto(auditScopeDecision)
        });
        return;
      }

      if (segments[1] === "approval-queue" && method === "GET") {
        const targetKindParam = url.searchParams.get("targetKind") ?? undefined;
        const approvalStatusParam = url.searchParams.get("approvalStatus") ?? undefined;
        if (targetKindParam !== undefined && !isRegistryTargetKind(targetKindParam)) {
          sendJson(response, 400, { error: "invalid_target_kind", message: "targetKind must be skill, harness, or instruction." });
          return;
        }
        if (approvalStatusParam !== undefined && !isApprovalStatus(approvalStatusParam)) {
          sendJson(response, 400, { error: "invalid_approval_status", message: "approvalStatus must be not_required, pending, approved, or rejected." });
          return;
        }
        const approvalQueue = registryService.listApprovalQueue({
          targetKind: targetKindParam,
          approvalStatus: approvalStatusParam,
          owner: url.searchParams.get("owner") ?? undefined,
          includeArchived: url.searchParams.get("includeArchived") === "true",
          requestContext: apiRequestContext
        });
        const approvalScopeDecisions = approvalQueue.map((item) => context.registryTenantScopeEnforcementService.evaluateApprovalQueueItem(item, registryScopeContextFromRequest(apiRequestContext)));
        sendJson(response, 200, {
          approvalQueue: approvalQueue.map(registryApprovalQueueItemToDto),
          scopeSummary: registryScopeEnforcementSummaryToDto(context.registryTenantScopeEnforcementService.summarizeDecisions(approvalScopeDecisions))
        });
        return;
      }

      if (segments[1] === "eval-suites") {
        const evalService = context.evalSuiteExecutionService;
        if (method === "GET" && segments.length === 2) {
          const suites = evalService.listSuites();
          sendJson(response, 200, {
            suites: suites.map(registryEvalSuiteToDto),
            summary: registryEvalSummaryToDto(evalService.getEvalSummary()),
            externalEvalImplemented: false,
            realProviderCalls: false,
            llmCallsExecuted: false,
            mcpCallsExecuted: false,
            vendorCliExecuted: false,
            noSecretsExposed: true,
            envValuesExposed: false
          });
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "cases") {
          const suiteId = segments[2];
          if (!evalService.listSuites().some((suite) => suite.id === suiteId)) {
            sendJson(response, 404, { error: "eval_suite_not_found", message: `Registry eval suite not found: ${suiteId}` });
            return;
          }
          sendJson(response, 200, {
            cases: evalService.listCases(suiteId).map(registryEvalCaseToDto),
            mockExecutionOnly: true,
            noExternalCalls: true
          });
          return;
        }
        sendJson(response, method === "GET" ? 404 : 405, {
          error: method === "GET" ? "registry_eval_suite_route_not_found" : "method_not_allowed",
          message: "Registry eval suite endpoints are metadata/readiness only."
        });
        return;
      }

      if (segments[1] === "eval-runs") {
        const evalService = context.evalSuiteExecutionService;
        const evalContext = registryEvalContextFromRequest(apiRequestContext);
        if (method === "GET" && segments.length === 2) {
          const targetKindParam = url.searchParams.get("targetKind") ?? undefined;
          const statusParam = url.searchParams.get("status") ?? undefined;
          if (targetKindParam !== undefined && !isRegistryEvalTargetKind(targetKindParam)) {
            sendJson(response, 400, { error: "invalid_eval_target_kind", message: "targetKind is not supported for registry eval runs." });
            return;
          }
          if (statusParam !== undefined && !isRegistryEvalRunStatus(statusParam)) {
            sendJson(response, 400, { error: "invalid_eval_run_status", message: "status is not supported for registry eval runs." });
            return;
          }
          const runs = evalService.listEvalRuns({
            suiteId: url.searchParams.get("suiteId") ?? undefined,
            targetKind: targetKindParam,
            targetId: url.searchParams.get("targetId") ?? undefined,
            proposalId: url.searchParams.get("proposalId") ?? undefined,
            status: statusParam
          });
          sendJson(response, 200, {
            evalRuns: runs.map(registryEvalRunToDto),
            summary: registryEvalSummaryToDto(evalService.getEvalSummary()),
            mockExecutionOnly: true,
            externalEvalImplemented: false,
            noSecretsExposed: true,
            envValuesExposed: false
          });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          const body = recordValue(await readJson(request));
          const suiteId = stringValue(body.suiteId);
          const targetKind = stringValue(body.targetKind);
          const targetId = stringValue(body.targetId);
          if (!suiteId || !isRegistryEvalTargetKind(targetKind) || !targetId) {
            sendJson(response, 400, { error: "invalid_eval_run_request", message: "suiteId, targetKind, and targetId are required." });
            return;
          }
          try {
            const run = evalService.requestEvalRun({
              suiteId,
              targetKind,
              targetId,
              draftRegistryChangeId: stringValue(body.draftRegistryChangeId),
              proposalId: stringValue(body.proposalId),
              metadata: recordValue(body.metadata)
            }, evalContext);
            const verdict = evalService.getEvalVerdict(run.id);
            sendJson(response, 201, {
              evalRun: registryEvalRunToDto(run),
              verdict: verdict ? registryEvalVerdictToDto(verdict) : undefined,
              mockExecutionOnly: true,
              externalEvalImplemented: false,
              noSecretsExposed: true,
              envValuesExposed: false
            });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_eval_run_request", message: error instanceof Error ? error.message : "Invalid registry eval run request" });
          }
          return;
        }
        if (method === "GET" && segments.length === 3) {
          const run = evalService.getEvalRun(segments[2]);
          if (!run) {
            sendJson(response, 404, { error: "eval_run_not_found", message: `Registry eval run not found: ${segments[2]}` });
            return;
          }
          const verdict = evalService.getEvalVerdict(run.id);
          sendJson(response, 200, {
            evalRun: registryEvalRunToDto(run),
            verdict: verdict ? registryEvalVerdictToDto(verdict) : undefined
          });
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "execute-mock") {
          if (!evalService.getEvalRun(segments[2])) {
            sendJson(response, 404, { error: "eval_run_not_found", message: `Registry eval run not found: ${segments[2]}` });
            return;
          }
          const run = evalService.executeMockEvalRun(segments[2], evalContext);
          const verdict = evalService.getEvalVerdict(run.id);
          sendJson(response, 200, {
            evalRun: registryEvalRunToDto(run),
            results: evalService.listCaseResults(run.id).map(registryEvalCaseResultToDto),
            verdict: verdict ? registryEvalVerdictToDto(verdict) : undefined,
            mockExecutionOnly: true,
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
          });
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "results") {
          if (!evalService.getEvalRun(segments[2])) {
            sendJson(response, 404, { error: "eval_run_not_found", message: `Registry eval run not found: ${segments[2]}` });
            return;
          }
          sendJson(response, 200, { results: evalService.listCaseResults(segments[2]).map(registryEvalCaseResultToDto) });
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "verdict") {
          if (!evalService.getEvalRun(segments[2])) {
            sendJson(response, 404, { error: "eval_run_not_found", message: `Registry eval run not found: ${segments[2]}` });
            return;
          }
          const verdict = evalService.getEvalVerdict(segments[2]);
          sendJson(response, 200, { verdict: verdict ? registryEvalVerdictToDto(verdict) : undefined });
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "attach") {
          if (!evalService.getEvalRun(segments[2])) {
            sendJson(response, 404, { error: "eval_run_not_found", message: `Registry eval run not found: ${segments[2]}` });
            return;
          }
          const body = recordValue(await readJson(request));
          try {
            const attachment = evalService.attachEvalResultToRegistryTarget({
              runId: segments[2],
              updateRegistryEvalStatus: body.updateRegistryEvalStatus === true,
              attachToProposal: body.attachToProposal === true,
              evalRequirementId: stringValue(body.evalRequirementId),
              metadata: recordValue(body.metadata)
            }, evalContext);
            sendJson(response, 201, {
              attachment: registryEvalAttachmentToDto(attachment),
              mockExecutionOnly: true,
              registryContentMutated: false,
              activeRegistryMutationExecuted: false,
              canaryExecuted: false,
              autoApplyEnabled: false,
              noSecretsExposed: true,
              envValuesExposed: false
            });
          } catch (error) {
            sendJson(response, 400, { error: "eval_result_attach_failed", message: error instanceof Error ? error.message : "Could not attach eval result metadata" });
          }
          return;
        }
        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "registry_eval_run_route_not_found" : "method_not_allowed",
          message: "Registry eval run endpoints only execute deterministic mock/local eval metadata and never call external providers."
        });
        return;
      }

      if (segments[1] === "scope") {
        const scopeService = context.registryTenantScopeEnforcementService;
        const serviceContext = registryScopeContextFromRequest(apiRequestContext);
        if (method === "GET" && segments.length === 3 && segments[2] === "summary") {
          const decisions = scopeService.evaluateRegistryResources(registryScopeInputsFromRegistry(registryService), serviceContext);
          const approvalQueueDecisions = registryService.listApprovalQueue({ requestContext: apiRequestContext })
            .map((item) => scopeService.evaluateApprovalQueueItem(item, serviceContext));
          sendJson(response, 200, {
            summary: registryScopeEnforcementSummaryToDto(scopeService.summarizeDecisions([...decisions, ...approvalQueueDecisions])),
            productionEnforcement: false,
            noSecretsExposed: true,
            envValuesExposed: false
          });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "decisions") {
          const kind = url.searchParams.get("registryResourceKind") ?? undefined;
          if (kind !== undefined && !isRegistryScopeResourceKind(kind)) {
            sendJson(response, 400, { error: "invalid_registry_scope_kind", message: "registryResourceKind is not supported." });
            return;
          }
          sendJson(response, 200, {
            decisions: scopeService.listDecisions({ registryResourceKind: kind }).map(registryScopeDecisionToDto),
            summary: registryScopeEnforcementSummaryToDto(scopeService.getSummary())
          });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "evaluate") {
          const body = recordValue(await readJson(request));
          const registryResourceKind = stringValue(body.registryResourceKind);
          const resourceId = stringValue(body.resourceId);
          if (!isRegistryScopeResourceKind(registryResourceKind) || !resourceId) {
            sendJson(response, 400, { error: "invalid_registry_scope_request", message: "registryResourceKind and resourceId are required." });
            return;
          }
          const decision = scopeService.evaluateRegistryResource({
            registryResourceKind,
            resourceId,
            tenantId: stringValue(body.tenantId),
            teamId: stringValue(body.teamId),
            projectId: stringValue(body.projectId),
            repoId: stringValue(body.repoId),
            providerId: stringValue(body.providerId),
            enforcementMode: body.enforcementMode === "metadata_only" || body.enforcementMode === "warning" || body.enforcementMode === "deny_sensitive" || body.enforcementMode === "future_production"
              ? body.enforcementMode
              : undefined,
            sensitive: body.sensitive === true,
            metadata: recordValue(body.metadata)
          }, serviceContext);
          sendJson(response, 201, {
            decision: registryScopeDecisionToDto(decision),
            productionEnforcement: false,
            noSecretsExposed: true,
            envValuesExposed: false
          });
          return;
        }
        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "registry_scope_route_not_found" : "method_not_allowed",
          message: "Registry scope endpoints are metadata/readiness only and do not mutate registry entries."
        });
        return;
      }

      if (segments[1] === "artifact-trust") {
        const trustService = context.registryArtifactTrustService;
        const trustContext = registryArtifactTrustContextFromRequest(apiRequestContext);
        if (method === "GET" && segments.length === 3 && segments[2] === "policies") {
          sendJson(response, 200, {
            policies: trustService.listTrustPolicies().map(registryArtifactTrustPolicyToDto),
            realSigningImplemented: false,
            realVerificationImplemented: false,
            externalRegistryCalls: false,
            noSecretsExposed: true,
            envValuesExposed: false
          });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "decisions") {
          const decisionFilter = url.searchParams.get("decision") ?? undefined;
          if (decisionFilter !== undefined && !isRegistryArtifactTrustDecision(decisionFilter)) {
            sendJson(response, 400, { error: "invalid_artifact_trust_decision", message: "decision is not supported." });
            return;
          }
          const decisions = trustService.listTrustDecisions({
            artifactId: url.searchParams.get("artifactId") ?? undefined,
            decision: decisionFilter
          });
          sendJson(response, 200, {
            decisions: decisions.map(registryArtifactTrustDecisionToDto),
            summary: registryArtifactTrustSummaryToDto(trustService.summarizeDecisions(decisions)),
            realSigningImplemented: false,
            realVerificationImplemented: false,
            externalRegistryCalls: false,
            noSecretsExposed: true,
            envValuesExposed: false
          });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "summary") {
          const decisions = registryArtifactTrustInputsFromRegistry(registryService)
            .map((input) => trustService.evaluateArtifactTrust(input, trustContext));
          sendJson(response, 200, {
            summary: registryArtifactTrustSummaryToDto(trustService.summarizeDecisions(decisions)),
            policyCount: trustService.listTrustPolicies().length,
            resolverGatesPreserved: true,
            lifecycleApprovalEvalChecksumGatesPreserved: true,
            realSigningImplemented: false,
            realVerificationImplemented: false,
            signingKeysGenerated: false,
            externalRegistryCalls: false,
            noSecretsExposed: true,
            envValuesExposed: false
          });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "evaluate") {
          const body = recordValue(await readJson(request));
          const packageId = stringValue(body.packageId);
          const manifest = packageId ? registryService.getPackageManifest(packageId) : undefined;
          if (packageId && !manifest) notFound("registry package", packageId);
          const decision = manifest
            ? trustService.evaluatePackageTrust(manifest, trustContext)
            : (() => {
                const input = registryArtifactTrustInputFromBody(body);
                if (!input) return undefined;
                return trustService.evaluateArtifactTrust(input, trustContext);
              })();
          if (!decision) {
            sendJson(response, 400, { error: "invalid_artifact_trust_request", message: "artifactId or packageId is required." });
            return;
          }
          sendJson(response, 201, {
            decision: registryArtifactTrustDecisionToDto(decision),
            summary: registryArtifactTrustSummaryToDto(trustService.getTrustSummary()),
            realSigningImplemented: false,
            realVerificationImplemented: false,
            externalRegistryCalls: false,
            noSecretsExposed: true,
            envValuesExposed: false
          });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "mock-signature") {
          const body = recordValue(await readJson(request));
          const artifactId = stringValue(body.artifactId);
          if (!artifactId) {
            sendJson(response, 400, { error: "invalid_mock_signature_request", message: "artifactId is required." });
            return;
          }
          const expiresAtRaw = stringValue(body.expiresAt);
          const expiresAt = expiresAtRaw && Number.isFinite(new Date(expiresAtRaw).getTime())
            ? new Date(expiresAtRaw)
            : undefined;
          const signature = trustService.createMockSignatureMetadata({
            artifactId,
            signatureStatus: body.signatureStatus === "invalid" || body.signatureStatus === "revoked" || body.signatureStatus === "unsigned" || body.signatureStatus === "mock_signed"
              ? body.signatureStatus
              : undefined,
            signerId: stringValue(body.signerId),
            signingAuthority: stringValue(body.signingAuthority),
            keyRefId: stringValue(body.keyRefId),
            expiresAt,
            metadata: recordValue(body.metadata)
          }, trustContext);
          sendJson(response, 201, {
            signature: registryArtifactSignatureToDto(signature),
            realSigningPerformed: false,
            realSignatureVerificationPerformed: false,
            signingKeyGenerated: false,
            noSecretsExposed: true,
            envValuesExposed: false
          });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "provenance") {
          const body = recordValue(await readJson(request));
          const artifactId = stringValue(body.artifactId);
          if (!artifactId) {
            sendJson(response, 400, { error: "invalid_artifact_provenance_request", message: "artifactId is required." });
            return;
          }
          const provenance = trustService.attachProvenanceMetadata({
            artifactId,
            sourceRepoId: stringValue(body.sourceRepoId),
            sourceCommitSha: stringValue(body.sourceCommitSha),
            sourceBranch: stringValue(body.sourceBranch),
            buildRunId: stringValue(body.buildRunId),
            taskRunId: stringValue(body.taskRunId),
            agentRunId: stringValue(body.agentRunId),
            buildSystem: body.buildSystem === "local_fixture" || body.buildSystem === "ci_future" || body.buildSystem === "external_future"
              ? body.buildSystem
              : "mock",
            provenanceStatus: body.provenanceStatus === "present_mock" || body.provenanceStatus === "missing" || body.provenanceStatus === "incomplete" || body.provenanceStatus === "untrusted" || body.provenanceStatus === "trusted_future"
              ? body.provenanceStatus
              : undefined,
            metadata: recordValue(body.metadata)
          }, trustContext);
          sendJson(response, 201, {
            provenance: registryArtifactProvenanceToDto(provenance),
            externalRegistryCalls: false,
            externalBuildSystemCalled: false,
            noSecretsExposed: true,
            envValuesExposed: false
          });
          return;
        }
        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "registry_artifact_trust_route_not_found" : "method_not_allowed",
          message: "Registry artifact trust endpoints are metadata-only and never perform real signing, verification, or external registry calls."
        });
        return;
      }

      if (segments[1] === "compatibility") {
        const compatibilityService = context.registryCompatibilityService;
        const serviceContext: RegistryCompatibilityServiceContext = {
          actorId: apiRequestContext.authContext.actor.id,
          principalId: apiRequestContext.authContext.principal.id,
          serviceAccountId: typeof apiRequestContext.authContext.metadata.serviceAccountId === "string"
            ? (apiRequestContext.authContext.metadata.serviceAccountId as string)
            : undefined,
          requestId: apiRequestContext.requestId,
          correlationId: apiRequestContext.correlationId,
          source: "api"
        };
        if (method === "GET" && segments.length === 3 && segments[2] === "rules") {
          sendJson(response, 200, { rules: compatibilityService.listRules() });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "summary") {
          sendJson(response, 200, { summary: compatibilityService.getSummary(serviceContext) });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "candidates") {
          const taskKind = url.searchParams.get("taskKind") ?? undefined;
          const context0 = compatibilityService.buildContext({
            taskKind,
            repoId: url.searchParams.get("repoId") ?? undefined,
            providerKind: url.searchParams.get("providerKind") ?? undefined,
            modelId: url.searchParams.get("modelId") ?? undefined,
            modelCapabilities: url.searchParams.get("modelCapabilities")?.split(",").map((value) => value.trim()).filter(Boolean) ?? undefined,
            runnerKind: url.searchParams.get("runnerKind") ?? undefined,
            tenantId: url.searchParams.get("tenantId") ?? undefined
          }, serviceContext);
          const decisions = compatibilityService.evaluateCandidates(context0, serviceContext);
          sendJson(response, 200, {
            context: context0,
            decisions,
            summary: compatibilityService.summarizeDecisions(decisions, serviceContext)
          });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "evaluate") {
          const body = recordValue(await readJson(request));
          const contextInput = recordValue(body.context) as RegistryCompatibilityContextInput;
          const compatibilityContext = compatibilityService.buildContext(contextInput, serviceContext);
          const candidateKind = stringValue(body.candidateKind);
          const candidateId = stringValue(body.candidateId);
          if (!candidateKind || !candidateId) {
            sendJson(response, 400, { error: "invalid_compatibility_request", message: "candidateKind and candidateId are required." });
            return;
          }
          let decision;
          if (candidateKind === "skill") decision = compatibilityService.evaluateSkill(candidateId, compatibilityContext, serviceContext);
          else if (candidateKind === "harness") decision = compatibilityService.evaluateHarness(candidateId, compatibilityContext, serviceContext);
          else if (candidateKind === "instruction") decision = compatibilityService.evaluateInstruction(candidateId, compatibilityContext, serviceContext);
          else if (candidateKind === "package" || candidateKind === "bundle") decision = compatibilityService.evaluatePackage(candidateId, compatibilityContext, serviceContext);
          else {
            sendJson(response, 400, { error: "invalid_candidate_kind", message: "candidateKind must be skill, harness, instruction, package, or bundle." });
            return;
          }
          sendJson(response, 201, { context: compatibilityContext, decision });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "evaluate-many") {
          const body = recordValue(await readJson(request));
          const contextInput = recordValue(body.context) as RegistryCompatibilityContextInput;
          const compatibilityContext = compatibilityService.buildContext(contextInput, serviceContext);
          const decisions = compatibilityService.evaluateCandidates(compatibilityContext, serviceContext);
          sendJson(response, 201, {
            context: compatibilityContext,
            decisions,
            summary: compatibilityService.summarizeDecisions(decisions, serviceContext)
          });
          return;
        }
        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "registry_compatibility_route_not_found" : "method_not_allowed",
          message: "Registry compatibility endpoints are advisory metadata only and never mutate registry entries."
        });
        return;
      }

      if (segments[1] === "drift") {
        const driftService = context.registryDriftDetectionService;
        const driftServiceContext = {
          actorId: apiRequestContext.authContext.actor.id,
          principalId: apiRequestContext.authContext.principal.id,
          serviceAccountId: typeof apiRequestContext.authContext.metadata.serviceAccountId === "string"
            ? (apiRequestContext.authContext.metadata.serviceAccountId as string)
            : undefined,
          requestId: apiRequestContext.requestId,
          correlationId: apiRequestContext.correlationId,
          source: "api"
        };
        const driftTargetKindParam = url.searchParams.get("targetKind") ?? undefined;
        const driftTargetIdParam = url.searchParams.get("targetId") ?? undefined;
        const driftSeverityParam = url.searchParams.get("severity") ?? undefined;
        const allowedDriftKinds = ["skill", "harness", "instruction", "registry_package", "compatibility_profile"] as const;
        const allowedDriftSeverities = ["info", "low", "medium", "high", "critical"] as const;
        const driftTargetKind = driftTargetKindParam && (allowedDriftKinds as readonly string[]).includes(driftTargetKindParam)
          ? (driftTargetKindParam as (typeof allowedDriftKinds)[number])
          : undefined;
        const driftSeverity = driftSeverityParam && (allowedDriftSeverities as readonly string[]).includes(driftSeverityParam)
          ? (driftSeverityParam as (typeof allowedDriftSeverities)[number])
          : undefined;
        const driftQuery = {
          targetKind: driftTargetKind,
          targetId: driftTargetIdParam,
          severity: driftSeverity
        };
        if (method === "GET" && segments.length === 3 && segments[2] === "signals") {
          sendJson(response, 200, { signals: driftService.collectSignals(driftQuery, driftServiceContext) });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "baselines") {
          sendJson(response, 200, { baselines: driftService.listBaselines(driftQuery) });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "assessments") {
          sendJson(response, 200, { assessments: driftService.listAssessments(driftQuery) });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "recommendations") {
          sendJson(response, 200, { recommendations: driftService.listRecommendations(driftQuery) });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "summary") {
          sendJson(response, 200, { summary: driftService.getSummary() });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "assess") {
          const body = recordValue(await readJson(request));
          const targetKindBody = stringValue(body.targetKind);
          const targetIdBody = stringValue(body.targetId);
          if (!targetKindBody || !targetIdBody || !(allowedDriftKinds as readonly string[]).includes(targetKindBody)) {
            sendJson(response, 400, { error: "invalid_drift_assess_request", message: "targetKind and targetId are required; targetKind must be skill, harness, instruction, registry_package, or compatibility_profile." });
            return;
          }
          const assessment = driftService.assessTarget({ targetKind: targetKindBody as (typeof allowedDriftKinds)[number], targetId: targetIdBody }, driftServiceContext);
          sendJson(response, 201, { assessment });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "assess-all") {
          const assessments = driftService.assessAll(driftServiceContext);
          sendJson(response, 201, { assessments, summary: driftService.getSummary() });
          return;
        }
        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "registry_drift_route_not_found" : "method_not_allowed",
          message: "Registry drift endpoints are advisory metadata only and never mutate registry entries or run eval/canary."
        });
        return;
      }

      if (segments[1] === "canary") {
        const canaryService = context.canaryExecutionService;
        const canaryServiceContext = {
          actorId: apiRequestContext.authContext.actor.id,
          principalId: apiRequestContext.authContext.principal.id,
          serviceAccountId: typeof apiRequestContext.authContext.metadata.serviceAccountId === "string"
            ? (apiRequestContext.authContext.metadata.serviceAccountId as string)
            : undefined,
          requestId: apiRequestContext.requestId,
          correlationId: apiRequestContext.correlationId,
          source: "api"
        };
        const allowedCanaryTargetKinds = ["skill", "harness", "instruction", "registry_package"] as const;
        const allowedCanaryKinds = ["mock_deterministic", "fixture_subset", "task_subset_future", "tenant_subset_future", "provider_subset_future", "external_future"] as const;
        if (method === "GET" && segments.length === 3 && segments[2] === "plans") {
          sendJson(response, 200, { plans: canaryService.listCanaryPlans() });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "plans") {
          const body = recordValue(await readJson(request));
          const targetKind = stringValue(body.targetKind);
          const targetId = stringValue(body.targetId);
          if (!targetKind || !targetId || !(allowedCanaryTargetKinds as readonly string[]).includes(targetKind)) {
            sendJson(response, 400, { error: "invalid_canary_plan_request", message: "targetKind and targetId are required; targetKind must be skill, harness, instruction, or registry_package." });
            return;
          }
          const canaryKindBody = stringValue(body.canaryKind);
          const canaryKind = canaryKindBody && (allowedCanaryKinds as readonly string[]).includes(canaryKindBody)
            ? (canaryKindBody as (typeof allowedCanaryKinds)[number])
            : undefined;
          const plan = canaryService.createCanaryPlan({
            targetKind: targetKind as (typeof allowedCanaryTargetKinds)[number],
            targetId,
            canaryKind,
            proposalId: stringValue(body.proposalId),
            draftRegistryChangeId: stringValue(body.draftRegistryChangeId),
            requiredEvalRunIds: Array.isArray(body.requiredEvalRunIds) ? body.requiredEvalRunIds.filter((entry: unknown): entry is string => typeof entry === "string") : [],
            requiredApprovalIds: Array.isArray(body.requiredApprovalIds) ? body.requiredApprovalIds.filter((entry: unknown): entry is string => typeof entry === "string") : [],
            sampleStrategy: stringValue(body.sampleStrategy),
            rollbackPlanId: stringValue(body.rollbackPlanId),
            metadata: recordValue(body.metadata) ?? undefined
          }, canaryServiceContext);
          sendJson(response, 201, { plan });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "runs") {
          sendJson(response, 200, { runs: canaryService.listCanaryRuns() });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "runs") {
          const body = recordValue(await readJson(request));
          const canaryPlanId = stringValue(body.canaryPlanId);
          if (!canaryPlanId) {
            sendJson(response, 400, { error: "invalid_canary_run_request", message: "canaryPlanId is required." });
            return;
          }
          try {
            const run = canaryService.requestCanaryRun({ canaryPlanId, metadata: recordValue(body.metadata) ?? undefined }, canaryServiceContext);
            sendJson(response, 201, { run });
          } catch (error) {
            sendJson(response, 400, { error: "canary_run_request_failed", message: error instanceof Error ? error.message : "canary_run_request_failed" });
          }
          return;
        }
        if (method === "POST" && segments.length === 5 && segments[2] === "runs" && segments[4] === "execute-mock") {
          const runId = segments[3];
          try {
            const verdict = canaryService.executeMockCanaryRun(runId, canaryServiceContext);
            sendJson(response, 201, { verdict });
          } catch (error) {
            sendJson(response, 400, { error: "canary_run_execute_failed", message: error instanceof Error ? error.message : "canary_run_execute_failed" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[2] === "runs") {
          const run = canaryService.getCanaryRun(segments[3]);
          if (!run) {
            sendJson(response, 404, { error: "canary_run_not_found" });
            return;
          }
          sendJson(response, 200, { run });
          return;
        }
        if (method === "GET" && segments.length === 5 && segments[2] === "runs" && segments[4] === "verdict") {
          const verdict = canaryService.getCanaryVerdictForRun(segments[3]);
          if (!verdict) {
            sendJson(response, 404, { error: "canary_verdict_not_found" });
            return;
          }
          sendJson(response, 200, { verdict });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "summary") {
          sendJson(response, 200, { summary: context.registryCanaryApplyGetSummary() });
          return;
        }
        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "registry_canary_route_not_found" : "method_not_allowed",
          message: "Registry canary endpoints execute deterministic mock canaries only and never mutate active registry entries, call providers, or execute real apply."
        });
        return;
      }

      if (segments[1] === "apply-workflows") {
        const applyService = context.applyWorkflowService;
        const applyServiceContext = {
          actorId: apiRequestContext.authContext.actor.id,
          principalId: apiRequestContext.authContext.principal.id,
          serviceAccountId: typeof apiRequestContext.authContext.metadata.serviceAccountId === "string"
            ? (apiRequestContext.authContext.metadata.serviceAccountId as string)
            : undefined,
          requestId: apiRequestContext.requestId,
          correlationId: apiRequestContext.correlationId,
          source: "api"
        };
        const allowedApplyTargetKinds = ["skill", "harness", "instruction", "registry_package"] as const;
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { workflows: applyService.listWorkflows() });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          const body = recordValue(await readJson(request));
          const proposalId = stringValue(body.proposalId);
          const draftRegistryChangeId = stringValue(body.draftRegistryChangeId);
          const targetKind = stringValue(body.targetKind);
          const targetId = stringValue(body.targetId);
          const rollbackPlanId = stringValue(body.rollbackPlanId);
          if (!proposalId || !draftRegistryChangeId || !targetKind || !targetId || !rollbackPlanId || !(allowedApplyTargetKinds as readonly string[]).includes(targetKind)) {
            sendJson(response, 400, { error: "invalid_apply_workflow_request", message: "proposalId, draftRegistryChangeId, targetKind, targetId, and rollbackPlanId are required; targetKind must be skill, harness, instruction, or registry_package." });
            return;
          }
          const workflow = applyService.createApplyWorkflow({
            proposalId,
            draftRegistryChangeId,
            targetKind: targetKind as (typeof allowedApplyTargetKinds)[number],
            targetId,
            requiredEvalRunIds: Array.isArray(body.requiredEvalRunIds) ? body.requiredEvalRunIds.filter((entry: unknown): entry is string => typeof entry === "string") : [],
            requiredCanaryRunIds: Array.isArray(body.requiredCanaryRunIds) ? body.requiredCanaryRunIds.filter((entry: unknown): entry is string => typeof entry === "string") : [],
            requiredApprovalIds: Array.isArray(body.requiredApprovalIds) ? body.requiredApprovalIds.filter((entry: unknown): entry is string => typeof entry === "string") : [],
            rollbackPlanId,
            applyMode: body.applyMode === "manual_future" || body.applyMode === "automatic_forbidden" || body.applyMode === "metadata_only" ? body.applyMode : "metadata_only",
            metadata: recordValue(body.metadata) ?? undefined
          }, applyServiceContext);
          sendJson(response, 201, { workflow });
          return;
        }
        if (method === "GET" && segments.length === 3) {
          const workflow = applyService.getWorkflow(segments[2]);
          if (!workflow) {
            sendJson(response, 404, { error: "apply_workflow_not_found" });
            return;
          }
          sendJson(response, 200, { workflow });
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "evaluate-gate") {
          try {
            const decision = applyService.evaluateApplyGate(segments[2], applyServiceContext);
            sendJson(response, 201, { decision });
          } catch (error) {
            sendJson(response, 400, { error: "apply_gate_evaluate_failed", message: error instanceof Error ? error.message : "apply_gate_evaluate_failed" });
          }
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "metadata-record") {
          try {
            const decision = applyService.recordMetadataOnlyApplyDecision(segments[2], applyServiceContext);
            sendJson(response, 201, { decision });
          } catch (error) {
            sendJson(response, 400, { error: "apply_metadata_record_failed", message: error instanceof Error ? error.message : "apply_metadata_record_failed" });
          }
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "rollback-plans") {
          const body = recordValue(await readJson(request));
          try {
            const plan = applyService.createRollbackPlan({
              workflowId: segments[2],
              rollbackKind: body.rollbackKind === "metadata_only" || body.rollbackKind === "manual_review" || body.rollbackKind === "registry_history_revert_future" || body.rollbackKind === "package_version_revert_future" ? body.rollbackKind : "metadata_only",
              status: body.status === "planned" || body.status === "missing" || body.status === "blocked" || body.status === "future" ? body.status : "planned",
              requiredEvidence: Array.isArray(body.requiredEvidence) ? body.requiredEvidence.filter((entry: unknown): entry is string => typeof entry === "string") : undefined,
              metadata: recordValue(body.metadata) ?? undefined
            });
            sendJson(response, 201, { rollbackPlan: plan });
          } catch (error) {
            sendJson(response, 400, { error: "rollback_plan_create_failed", message: error instanceof Error ? error.message : "rollback_plan_create_failed" });
          }
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "rollback-plans") {
          sendJson(response, 200, { rollbackPlans: applyService.listRollbackPlans({ workflowId: segments[2] }) });
          return;
        }
        if (method === "GET" && segments.length === 4 && segments[3] === "decisions") {
          sendJson(response, 200, { decisions: applyService.listGateDecisions({ workflowId: segments[2] }) });
          return;
        }
        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "registry_apply_workflow_route_not_found" : "method_not_allowed",
          message: "Registry apply workflow endpoints are metadata only and never mutate active registry entries, execute real apply, or auto-apply."
        });
        return;
      }

      if (segments[1] === "packages") {
        if (method === "GET" && segments.length === 2) {
          const packages = registryService.listPackageManifests();
          const scopeDecisions = packages.map((manifest) => context.registryTenantScopeEnforcementService.evaluateRegistryResource(registryResourceInputFromPackageManifest(manifest), registryScopeContextFromRequest(apiRequestContext)));
          const trustDecisions = packages.map((manifest) => context.registryArtifactTrustService.evaluatePackageTrust(manifest, registryArtifactTrustContextFromRequest(apiRequestContext)));
          sendJson(response, 200, {
            packages: packages.map(registryPackageManifestToDto),
            scopeSummary: registryScopeEnforcementSummaryToDto(context.registryTenantScopeEnforcementService.summarizeDecisions(scopeDecisions)),
            artifactTrustSummary: registryArtifactTrustSummaryToDto(context.registryArtifactTrustService.summarizeDecisions(trustDecisions))
          });
          return;
        }
        if (method === "GET" && segments.length === 3) {
          const manifest = registryService.getPackageManifest(segments[2]) ?? notFound("registry package", segments[2]);
          const scopeDecision = context.registryTenantScopeEnforcementService.evaluateRegistryResource(registryResourceInputFromPackageManifest(manifest), registryScopeContextFromRequest(apiRequestContext));
          const artifactTrustDecision = context.registryArtifactTrustService.evaluatePackageTrust(manifest, registryArtifactTrustContextFromRequest(apiRequestContext));
          sendJson(response, 200, {
            package: registryPackageManifestToDto(manifest),
            scopeDecision: registryScopeDecisionToDto(scopeDecision),
            artifactTrustDecision: registryArtifactTrustDecisionToDto(artifactTrustDecision)
          });
          return;
        }
        if (method === "POST" && segments[2] === "export") {
          try {
            const body = await readJson(request) as Parameters<RegistryService["exportPackageManifest"]>[0];
            const manifest = registryService.exportPackageManifest({ ...body, requestContext: apiRequestContext });
            const artifactTrustDecision = context.registryArtifactTrustService.evaluatePackageTrust(manifest, registryArtifactTrustContextFromRequest(apiRequestContext));
            sendJson(response, 201, {
              package: registryPackageManifestToDto(manifest),
              artifactTrustDecision: registryArtifactTrustDecisionToDto(artifactTrustDecision)
            });
          } catch (error) {
            sendJson(response, 400, { error: "package_export_failed", message: error instanceof Error ? error.message : "Package export failed" });
          }
          return;
        }
        if (method === "POST" && segments[2] === "import") {
          const body = await readJson(request) as Parameters<RegistryService["importPackageManifest"]>[0];
          const result = registryService.importPackageManifest({
            ...body,
            dryRun: segments[3] === "dry-run" ? true : body.dryRun,
            requestContext: apiRequestContext
          });
          const artifactTrustDecision = context.registryArtifactTrustService.evaluatePackageTrust(result.manifest, registryArtifactTrustContextFromRequest(apiRequestContext));
          sendJson(response, result.errors.length > 0 ? 400 : result.dryRun ? 200 : 201, {
            importResult: registryImportResultToDto(result),
            artifactTrustDecision: registryArtifactTrustDecisionToDto(artifactTrustDecision)
          });
          return;
        }
        if (method === "POST" && segments[2] === "diff") {
          const body = await readJson(request) as { fromPackageId?: string; toPackageId?: string };
          const from = body.fromPackageId ? registryService.getPackageManifest(body.fromPackageId) : undefined;
          const to = body.toPackageId ? registryService.getPackageManifest(body.toPackageId) : undefined;
          if (!from || !to) {
            sendJson(response, 400, { error: "invalid_package_diff", message: "fromPackageId and toPackageId must reference existing package manifests." });
            return;
          }
          sendJson(response, 200, { diff: registryService.diffPackageManifests(from, to) });
          return;
        }
      }

      if (method === "POST" && (url.pathname === "/registry/import" || url.pathname === "/registry/packages/import" || url.pathname === "/registry/packages/import/dry-run")) {
        const body = await readJson(request) as Parameters<RegistryService["importPackageManifest"]>[0];
        const result = registryService.importPackageManifest({
          ...body,
          dryRun: url.pathname.endsWith("/dry-run") ? true : body.dryRun,
          requestContext: apiRequestContext
        });
        const artifactTrustDecision = context.registryArtifactTrustService.evaluatePackageTrust(result.manifest, registryArtifactTrustContextFromRequest(apiRequestContext));
        sendJson(response, result.errors.length > 0 ? 400 : result.dryRun ? 200 : 201, {
          importResult: registryImportResultToDto(result),
          artifactTrustDecision: registryArtifactTrustDecisionToDto(artifactTrustDecision)
        });
        return;
      }

      if (method === "GET" && url.pathname === "/registry/bundle/manifest") {
        const manifest = registryService.exportPackageManifest({ packageKind: "bundle", name: "registry-bundle", version: "1.0.0", requestContext: apiRequestContext });
        const artifactTrustDecision = context.registryArtifactTrustService.evaluatePackageTrust(manifest, registryArtifactTrustContextFromRequest(apiRequestContext));
        sendJson(response, 200, {
          package: registryPackageManifestToDto(manifest),
          artifactTrustDecision: registryArtifactTrustDecisionToDto(artifactTrustDecision)
        });
        return;
      }

      if (segments[1] === "skills") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { skills: registryService.listSkills().map(skillToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Parameters<RegistryService["createSkill"]>[0];
            sendJson(response, 201, { skill: skillToDto(registryService.createSkill(body, { requestContext: apiRequestContext })) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_skill", message: error instanceof Error ? error.message : "Invalid skill" });
          }
          return;
        }
        const skillId = segments[2];
        if (!skillId) notFound("skill", "");
        if (method === "GET" && segments.length === 3) {
          const skill = registryService.getSkill(skillId) ?? notFound("skill", skillId);
          sendJson(response, 200, { skill: skillToDto(skill) });
          return;
        }
        if (method === "GET" && segments[3] === "manifest") {
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          const manifest = registryService.exportPackageManifest({ packageKind: "skill", targetId: skillId, requestContext: apiRequestContext });
          sendJson(response, 200, { package: registryPackageManifestToDto(manifest) });
          return;
        }
        if (method === "GET" && segments[3] === "history") {
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          sendJson(response, 200, { revisions: registryService.listRevisionsForTarget("skill", skillId).map(registryRevisionToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "rollback") {
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          const body = await readJson(request) as { targetRevisionId?: string; revisionNumber?: number; reason?: string };
          if (!body.reason) {
            sendJson(response, 400, { error: "invalid_rollback", message: "reason is required." });
            return;
          }
          try {
            const result = registryService.rollback({ targetKind: "skill", targetId: skillId, targetRevisionId: body.targetRevisionId, revisionNumber: body.revisionNumber, reason: body.reason, requestContext: apiRequestContext });
            sendJson(response, 200, { rollback: registryRollbackResultToDto(result), skill: skillToDto(registryService.getSkill(skillId) ?? notFound("skill", skillId)) });
          } catch (error) {
            sendJson(response, 400, { error: "rollback_failed", message: error instanceof Error ? error.message : "Rollback failed" });
          }
          return;
        }
        if (method === "GET" && segments[3] === "eval-results") {
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          sendJson(response, 200, { evalResults: registryService.listEvalResultsForTarget("skill", skillId).map(registryEvalResultToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "eval-results") {
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          const body = await readJson(request) as Record<string, unknown>;
          if (!isValidEvalResultPayload(body)) {
            sendJson(response, 400, { error: "invalid_eval_result", message: "evalName, evalType, status, summary, and source are required." });
            return;
          }
          const result = registryService.attachEvalResult("skill", skillId, { ...body, requestContext: apiRequestContext } as Parameters<RegistryService["attachEvalResult"]>[2]);
          sendJson(response, 201, { evalResult: registryEvalResultToDto(result), skill: skillToDto(registryService.getSkill(skillId) ?? notFound("skill", skillId)) });
          return;
        }
        if (method === "PATCH" && segments[3] === "status") {
          const body = await readJson(request) as { status?: unknown };
          if (!isRegistryStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_status", message: "Status must be draft, active, deprecated, or archived." });
            return;
          }
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          sendJson(response, 200, { skill: skillToDto(registryService.updateSkillStatus(skillId, { status: body.status, requestContext: apiRequestContext })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "approval") {
          const body = await readJson(request) as { approvalStatus?: unknown; reason?: string };
          if (!isApprovalStatus(body.approvalStatus)) {
            sendJson(response, 400, { error: "invalid_approval_status", message: "approvalStatus must be not_required, pending, approved, or rejected." });
            return;
          }
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          sendJson(response, 200, { skill: skillToDto(registryService.updateSkillApproval(skillId, { approvalStatus: body.approvalStatus, reason: body.reason, requestContext: apiRequestContext })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "eval") {
          const body = await readJson(request) as { evalStatus?: unknown; reason?: string };
          if (!isEvalStatus(body.evalStatus)) {
            sendJson(response, 400, { error: "invalid_eval_status", message: "evalStatus must be not_required, pending, passed, or failed." });
            return;
          }
          if (!registryService.getSkill(skillId)) notFound("skill", skillId);
          sendJson(response, 200, { skill: skillToDto(registryService.updateSkillEval(skillId, { evalStatus: body.evalStatus, reason: body.reason, requestContext: apiRequestContext })) });
          return;
        }
      }

      if (segments[1] === "harnesses") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { harnesses: registryService.listHarnesses().map(harnessToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Parameters<RegistryService["createHarness"]>[0];
            sendJson(response, 201, { harness: harnessToDto(registryService.createHarness(body, { requestContext: apiRequestContext })) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_harness", message: error instanceof Error ? error.message : "Invalid harness" });
          }
          return;
        }
        const harnessId = segments[2];
        if (!harnessId) notFound("harness", "");
        if (method === "GET" && segments.length === 3) {
          const harness = registryService.getHarness(harnessId) ?? notFound("harness", harnessId);
          sendJson(response, 200, { harness: harnessToDto(harness) });
          return;
        }
        if (method === "GET" && segments[3] === "manifest") {
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          const manifest = registryService.exportPackageManifest({ packageKind: "harness", targetId: harnessId, requestContext: apiRequestContext });
          sendJson(response, 200, { package: registryPackageManifestToDto(manifest) });
          return;
        }
        if (method === "GET" && segments[3] === "history") {
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          sendJson(response, 200, { revisions: registryService.listRevisionsForTarget("harness", harnessId).map(registryRevisionToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "rollback") {
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          const body = await readJson(request) as { targetRevisionId?: string; revisionNumber?: number; reason?: string };
          if (!body.reason) {
            sendJson(response, 400, { error: "invalid_rollback", message: "reason is required." });
            return;
          }
          try {
            const result = registryService.rollback({ targetKind: "harness", targetId: harnessId, targetRevisionId: body.targetRevisionId, revisionNumber: body.revisionNumber, reason: body.reason, requestContext: apiRequestContext });
            sendJson(response, 200, { rollback: registryRollbackResultToDto(result), harness: harnessToDto(registryService.getHarness(harnessId) ?? notFound("harness", harnessId)) });
          } catch (error) {
            sendJson(response, 400, { error: "rollback_failed", message: error instanceof Error ? error.message : "Rollback failed" });
          }
          return;
        }
        if (method === "GET" && segments[3] === "eval-results") {
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          sendJson(response, 200, { evalResults: registryService.listEvalResultsForTarget("harness", harnessId).map(registryEvalResultToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "eval-results") {
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          const body = await readJson(request) as Record<string, unknown>;
          if (!isValidEvalResultPayload(body)) {
            sendJson(response, 400, { error: "invalid_eval_result", message: "evalName, evalType, status, summary, and source are required." });
            return;
          }
          const result = registryService.attachEvalResult("harness", harnessId, { ...body, requestContext: apiRequestContext } as Parameters<RegistryService["attachEvalResult"]>[2]);
          sendJson(response, 201, { evalResult: registryEvalResultToDto(result), harness: harnessToDto(registryService.getHarness(harnessId) ?? notFound("harness", harnessId)) });
          return;
        }
        if (method === "PATCH" && segments[3] === "status") {
          const body = await readJson(request) as { status?: unknown };
          if (!isRegistryStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_status", message: "Status must be draft, active, deprecated, or archived." });
            return;
          }
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          sendJson(response, 200, { harness: harnessToDto(registryService.updateHarnessStatus(harnessId, { status: body.status, requestContext: apiRequestContext })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "approval") {
          const body = await readJson(request) as { approvalStatus?: unknown; reason?: string };
          if (!isApprovalStatus(body.approvalStatus)) {
            sendJson(response, 400, { error: "invalid_approval_status", message: "approvalStatus must be not_required, pending, approved, or rejected." });
            return;
          }
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          sendJson(response, 200, { harness: harnessToDto(registryService.updateHarnessApproval(harnessId, { approvalStatus: body.approvalStatus, reason: body.reason, requestContext: apiRequestContext })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "eval") {
          const body = await readJson(request) as { evalStatus?: unknown; reason?: string };
          if (!isEvalStatus(body.evalStatus)) {
            sendJson(response, 400, { error: "invalid_eval_status", message: "evalStatus must be not_required, pending, passed, or failed." });
            return;
          }
          if (!registryService.getHarness(harnessId)) notFound("harness", harnessId);
          sendJson(response, 200, { harness: harnessToDto(registryService.updateHarnessEval(harnessId, { evalStatus: body.evalStatus, reason: body.reason, requestContext: apiRequestContext })) });
          return;
        }
      }

      if (segments[1] === "instructions") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { instructions: registryService.listInstructions().map(instructionToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Parameters<RegistryService["createInstruction"]>[0];
            sendJson(response, 201, { instruction: instructionToDto(registryService.createInstruction(body, { requestContext: apiRequestContext })) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_instruction", message: error instanceof Error ? error.message : "Invalid instruction" });
          }
          return;
        }
        const instructionId = segments[2];
        if (!instructionId) notFound("instruction", "");
        if (method === "GET" && segments.length === 3) {
          const instruction = registryService.getInstruction(instructionId) ?? notFound("instruction", instructionId);
          sendJson(response, 200, { instruction: instructionToDto(instruction) });
          return;
        }
        if (method === "GET" && segments[3] === "manifest") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          const manifest = registryService.exportPackageManifest({ packageKind: "instruction", targetId: instructionId, requestContext: apiRequestContext });
          sendJson(response, 200, { package: registryPackageManifestToDto(manifest) });
          return;
        }
        if (method === "GET" && segments[3] === "history") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { revisions: registryService.listRevisionsForTarget("instruction", instructionId).map(registryRevisionToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "rollback") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          const body = await readJson(request) as { targetRevisionId?: string; revisionNumber?: number; reason?: string };
          if (!body.reason) {
            sendJson(response, 400, { error: "invalid_rollback", message: "reason is required." });
            return;
          }
          try {
            const result = registryService.rollback({ targetKind: "instruction", targetId: instructionId, targetRevisionId: body.targetRevisionId, revisionNumber: body.revisionNumber, reason: body.reason, requestContext: apiRequestContext });
            sendJson(response, 200, { rollback: registryRollbackResultToDto(result), instruction: instructionToDto(registryService.getInstruction(instructionId) ?? notFound("instruction", instructionId)) });
          } catch (error) {
            sendJson(response, 400, { error: "rollback_failed", message: error instanceof Error ? error.message : "Rollback failed" });
          }
          return;
        }
        if (method === "GET" && segments[3] === "eval-results") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { evalResults: registryService.listEvalResultsForTarget("instruction", instructionId).map(registryEvalResultToDto) });
          return;
        }
        if (method === "POST" && segments[3] === "eval-results") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          const body = await readJson(request) as Record<string, unknown>;
          if (!isValidEvalResultPayload(body)) {
            sendJson(response, 400, { error: "invalid_eval_result", message: "evalName, evalType, status, summary, and source are required." });
            return;
          }
          const result = registryService.attachEvalResult("instruction", instructionId, { ...body, requestContext: apiRequestContext } as Parameters<RegistryService["attachEvalResult"]>[2]);
          sendJson(response, 201, { evalResult: registryEvalResultToDto(result), instruction: instructionToDto(registryService.getInstruction(instructionId) ?? notFound("instruction", instructionId)) });
          return;
        }
        if (method === "PATCH" && segments[3] === "status") {
          const body = await readJson(request) as { status?: unknown };
          if (!isRegistryStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_status", message: "Status must be draft, active, deprecated, or archived." });
            return;
          }
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { instruction: instructionToDto(registryService.updateInstructionStatus(instructionId, { status: body.status, requestContext: apiRequestContext })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "approval") {
          const body = await readJson(request) as { approvalStatus?: unknown; reason?: string };
          if (!isApprovalStatus(body.approvalStatus)) {
            sendJson(response, 400, { error: "invalid_approval_status", message: "approvalStatus must be not_required, pending, approved, or rejected." });
            return;
          }
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { instruction: instructionToDto(registryService.updateInstructionApproval(instructionId, { approvalStatus: body.approvalStatus, reason: body.reason, requestContext: apiRequestContext })) });
          return;
        }
        if (method === "PATCH" && segments[3] === "eval") {
          const body = await readJson(request) as { evalStatus?: unknown; reason?: string };
          if (!isEvalStatus(body.evalStatus)) {
            sendJson(response, 400, { error: "invalid_eval_status", message: "evalStatus must be not_required, pending, passed, or failed." });
            return;
          }
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { instruction: instructionToDto(registryService.updateInstructionEval(instructionId, { evalStatus: body.evalStatus, reason: body.reason, requestContext: apiRequestContext })) });
          return;
        }
        if (method === "POST" && segments[3] === "verify-checksum") {
          if (!registryService.getInstruction(instructionId)) notFound("instruction", instructionId);
          sendJson(response, 200, { instruction: instructionToDto(registryService.verifyInstructionChecksum(instructionId, { repoRoot: process.cwd(), requestContext: apiRequestContext })) });
          return;
        }
      }

      if (segments[1] === "resolve" && method === "POST") {
        const body = await readJson(request) as { taskId?: unknown; agent?: unknown };
        const taskId = stringValue(body.taskId);
        if (!taskId) {
          sendJson(response, 400, { error: "invalid_registry_resolution_request", message: "taskId is required." });
          return;
        }
        const task = store.getTask(taskId) ?? notFound("task", taskId);
        const resolution = registryService.resolveRegistryContextForTask({
          task,
          agent: (stringValue(body.agent) ?? task.selectedAgent ?? "codex") as NonNullable<Task["selectedAgent"]>,
          repo: store.getRepo(task.repoId),
          requestContext: apiRequestContext
        });
        sendJson(response, 200, { resolution: registryResolutionToDto(resolution) });
        return;
      }
    }

    if (segments[0] === "tasks") {
      if (method === "POST" && segments.length === 1) {
        sendJson(response, 201, taskView(store.createTask(await readJson(request))));
        return;
      }
      if (method === "GET" && segments.length === 1) {
        sendJson(response, 200, { tasks: store.listTasks().map(taskView) });
        return;
      }
      const taskId = segments[1];
      if (!taskId) notFound("task", "");
      const task = store.getTask(taskId) ?? notFound("task", taskId);

      if (method === "GET" && segments.length === 2) {
        sendJson(response, 200, {
          task: taskView(task),
          taskRuns: store.listTaskRuns(task.id),
          pullRequests: store.listPullRequests(task.id),
          usageEvents: store.listUsageEvents().filter((event) => event.taskId === task.id)
        });
        return;
      }
      if (method === "POST" && segments[2] === "run") {
        const result = await runAgentTaskWorkflow(task.id, { store });
        const updatedTask = store.getTask(task.id) ?? task;
        sendJson(response, 200, {
          task: taskView(updatedTask),
          result,
          taskRuns: store.listTaskRuns(task.id),
          pullRequests: store.listPullRequests(task.id),
          usageEvents: store.listUsageEvents().filter((event) => event.taskId === task.id)
        });
        return;
      }
      if (method === "POST" && segments[2] === "run-agent") {
        const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
        const activeRun = store.listTaskRuns(task.id).find((run) => run.status === "queued" || run.status === "running");
        if (activeRun) {
          sendJson(response, 409, { error: "conflict", message: `Task ${task.id} already has active run ${activeRun.id}` });
          return;
        }
        const agent = task.selectedAgent ?? "codex";
        const registryResolution = registryService.resolveRegistryContextForTask({
          task,
          agent,
          repo: store.getRepo(task.repoId),
          requestContext
        });
        const selectedHarness = registryResolution.selectedHarness.id ? store.getHarness(registryResolution.selectedHarness.id) : undefined;
        const taskRun = store.createTaskRun({
          taskId: task.id,
          attempt: store.listTaskRuns(task.id).length + 1,
          status: "running",
          agent,
          model: task.selectedModel ?? "mock-coder@1.0",
          modelProvider: "mock",
          selectedHarnessId: selectedHarness?.id,
          harnessVersion: `${registryResolution.selectedHarness.name}@${registryResolution.selectedHarness.version}`,
          selectedSkillRefs: registryResolution.selectedSkills,
          selectedHarnessRef: registryResolution.selectedHarness,
          selectedInstructionRefs: registryResolution.selectedInstructions,
          registryResolutionWarnings: registryResolution.warnings,
          registryResolutionErrors: registryResolution.errors,
          startedAt: new Date()
        });
        const agentRun = await context.agentRunnerService.runAgent({
          taskId: task.id,
          taskRunId: taskRun.id,
          actorId: requestContext.authContext.actor.id,
          repoRef: {
            repoId: task.repoId,
            provider: store.getRepo(task.repoId)?.provider,
            localPath: undefined
          },
          branchRef: {
            repoId: task.repoId,
            branchName: task.branchName ?? `mock-agent/${task.id}`,
            baseBranch: task.baseBranch
          },
          selectedModelRef: task.selectedModel ?? "mock-coder@1.0",
          selectedSkillRefs: registryResolution.selectedSkills,
          selectedHarnessRef: registryResolution.selectedHarness,
          selectedInstructionRefs: registryResolution.selectedInstructions,
          prompt: task.description ?? task.title,
          allowedCommands: selectedHarness?.allowedTools ?? [],
          testCommands: selectedHarness?.testCommands ?? ["pnpm test"],
          maxRuntimeMs: context.agentRunnerConfig.maxRuntimeMs,
          metadata: {
            budgetLimitUsd: task.budgetLimitUsd,
            gitProviderKind: context.gitProviderConfig.providerKind,
            source: "task_run_agent_endpoint",
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            principalId: requestContext.authContext.principal.id,
            authMode: requestContext.authContext.authMode,
            taskRequesterUserId: task.requesterUserId
          }
        });
        store.updateTaskRun(taskRun.id, {
          status: agentRun.status === "completed" ? "succeeded" : "failed",
          finishedAt: new Date(),
          resultSummary: agentRun.status === "completed" ? "Agent runner completed." : `Agent runner ${agentRun.status}.`,
          changedFiles: agentRun.changedFiles,
          diffSummary: agentRun.diffSummary,
          errorMessage: agentRun.status === "completed" ? undefined : String(agentRun.metadata.reason ?? agentRun.status)
        });
        sendJson(response, agentRun.status === "blocked" ? 409 : 201, {
          task: taskView(store.getTask(task.id) ?? task),
          taskRun: store.listTaskRuns(task.id).find((run) => run.id === taskRun.id),
          agentRun: agentRunToDto(agentRun),
          usageEvents: store.listUsageEvents().filter((event) => event.taskRunId === taskRun.id)
        });
        return;
      }
      if (method === "GET" && segments[2] === "runs") {
        sendJson(response, 200, { taskRuns: store.listTaskRuns(task.id) });
        return;
      }
      if (method === "GET" && segments[2] === "agent-runs") {
        sendJson(response, 200, { agentRuns: context.agentRunnerService.listRuns({ taskId: task.id }).map(agentRunToDto) });
        return;
      }
      if (method === "POST" && segments[2] === "plan") {
        sendJson(response, 200, store.transitionTask(task.id, "planned") as unknown as JsonValue);
        return;
      }
      if (method === "POST" && segments[2] === "start") {
        if (task.status === "draft") {
          store.transitionTask(task.id, "planned");
        }
        sendJson(response, 200, store.transitionTask(task.id, "queued") as unknown as JsonValue);
        return;
      }
      if (method === "POST" && segments[2] === "cancel") {
        sendJson(response, 200, store.transitionTask(task.id, "cancelled") as unknown as JsonValue);
        return;
      }
      if (method === "POST" && segments[2] === "status") {
        const body = await readJson(request) as { status?: string };
        if (!body.status || !isTaskStatus(body.status)) {
          sendJson(response, 400, { error: "Invalid status" });
          return;
        }
        sendJson(response, 200, store.transitionTask(task.id, body.status as TaskStatus) as unknown as JsonValue);
        return;
      }
    }

    if (segments[0] === "branches" && segments[1] === "leases" && method === "GET") {
      const repoId = url.searchParams.get("repoId") ?? undefined;
      const status = url.searchParams.get("status") as BranchLeaseStatus | null;
      sendJson(response, 200, {
        branchLeases: store.listBranchLeases(repoId, status ?? undefined)
      });
      return;
    }

    if (segments[0] === "conflicts" && segments[1] === "risks" && method === "GET") {
      const repoId = url.searchParams.get("repoId") ?? undefined;
      const taskRunId = url.searchParams.get("taskRunId") ?? undefined;
      const conflictRisks = taskRunId
        ? store.computeConflictRisksForTaskRun(taskRunId)
        : repoId
          ? store.computeRepoConflictRisks(repoId)
          : store.listRepos().flatMap((repo) => store.computeRepoConflictRisks(repo.id));
      sendJson(response, 200, { conflictRisks });
      return;
    }

    if (segments[0] === "merge-simulations") {
      if (method === "GET" && segments.length === 1) {
        sendJson(response, 200, {
          mergeSimulations: store.listMergeSimulations({
            repoId: url.searchParams.get("repoId") ?? undefined,
            taskRunId: url.searchParams.get("taskRunId") ?? undefined,
            branchLeaseId: url.searchParams.get("branchLeaseId") ?? undefined
          })
        });
        return;
      }

      if (method === "POST" && segments.length === 1) {
        const body = await readJson(request) as Record<string, unknown>;
        const branchLeaseId = stringValue(body.branchLeaseId);
        const lease = branchLeaseId ? store.getBranchLease(branchLeaseId) ?? notFound("branch lease", branchLeaseId) : undefined;
        const mode: MergeSimulationMode = body.mode === "local_git_merge_tree" ? "local_git_merge_tree" : "mock";
        const repoId = stringValue(body.repoId) ?? lease?.repoId;
        const baseRef = stringValue(body.baseRef) ?? lease?.baseBranch;
        const sourceRef = stringValue(body.sourceRef) ?? lease?.branchName;
        if (!repoId || !baseRef || !sourceRef) {
          sendJson(response, 400, { error: "invalid_merge_simulation_request", message: "repoId, baseRef, and sourceRef are required unless branchLeaseId supplies them." });
          return;
        }

        const simulator = mode === "local_git_merge_tree" ? new LocalGitDryRunMergeSimulator() : new MockMergeSimulator();
        const repoPath = stringValue(body.repoPath);
        if (mode === "local_git_merge_tree") {
          if (!repoPath) {
            sendJson(response, 400, { error: "repo_path_required", message: "local_git_merge_tree mode requires repoPath." });
            return;
          }
          if (!isRepoPathAllowlisted(repoPath)) {
            sendJson(response, 400, { error: "repo_path_not_allowlisted", message: "repoPath must be under AICHESTRA_ALLOWED_REPO_PATHS for local dry-run simulation." });
            return;
          }
        }
        const mergeSimulation = await simulator.simulate({
          repoId,
          repoPath,
          baseRef,
          sourceRef,
          targetRef: stringValue(body.targetRef) ?? baseRef,
          taskRunId: stringValue(body.taskRunId) ?? lease?.taskRunId,
          branchLeaseId,
          mode,
          requestedStatus: isMergeSimulationStatus(body.requestedStatus)
            ? body.requestedStatus
            : isMergeSimulationStatus(body.status)
              ? body.status
              : undefined
        });
        store.recordMergeSimulation(mergeSimulation);
        sendJson(response, 201, {
          mergeSimulation,
          mergeQueue: branchLeaseId
            ? store.listMergeQueueEntries(repoId).filter((entry) => entry.branchLeaseId === branchLeaseId)
            : []
        });
        return;
      }
    }

    if (segments[0] === "merge-queue") {
      if (method === "GET" && segments.length === 1) {
        const repoId = url.searchParams.get("repoId") ?? undefined;
        sendJson(response, 200, { mergeQueue: store.listMergeQueueEntries(repoId) });
        return;
      }
      const entryId = segments[1];
      if (!entryId) notFound("merge queue entry", "");
      if (method === "POST" && segments[2] === "mark-merged") {
        if (!store.getMergeQueueEntry(entryId)) notFound("merge queue entry", entryId);
        sendJson(response, 200, { mergeQueueEntry: store.markMergeQueueEntryMerged(entryId) });
        return;
      }
      if (method === "POST" && segments[2] === "cancel") {
        if (!store.getMergeQueueEntry(entryId)) notFound("merge queue entry", entryId);
        const body = await readJson(request) as { reason?: string };
        sendJson(response, 200, { mergeQueueEntry: store.cancelMergeQueueEntry(entryId, body.reason) });
        return;
      }
    }

    if (segments[0] === "git") {
      const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
      const gitService = context.gitIntegrationService;
      const branchOrchestratorService = context.branchOrchestratorService;
      const webhookService = context.gitWebhookReceiverService;
      const githubAppService = context.githubAppRuntimeService;

      if (segments[1] === "merge-execution") {
        const realMergePolicyService = context.realMergeExecutionPolicyService;
        const repoId = url.searchParams.get("repoId") ?? undefined;

        if (method === "GET" && segments.length === 3 && segments[2] === "policy") {
          sendJson(response, 200, { policy: realMergePolicyService.getPolicy() });
          return;
        }

        if (method === "GET" && segments.length === 3 && segments[2] === "forbidden-operations") {
          sendJson(response, 200, { forbiddenOperations: realMergePolicyService.listForbiddenOperations() });
          return;
        }

        if (method === "GET" && segments.length === 3 && segments[2] === "post-evidence-template") {
          sendJson(response, 200, { postExecutionEvidenceTemplate: realMergePolicyService.getPostExecutionEvidenceTemplate() });
          return;
        }

        if (method === "POST" && segments.length === 3 && segments[2] === "evaluate") {
          const body = recordValue(await readJson(request));
          const decision = realMergePolicyService.evaluateRequest({
            id: stringValue(body.id),
            repoId: stringValue(body.repoId),
            baseBranch: stringValue(body.baseBranch),
            sourceBranch: stringValue(body.sourceBranch),
            branchName: stringValue(body.branchName),
            mergeQueueEntryId: stringValue(body.mergeQueueEntryId),
            branchLeaseId: stringValue(body.branchLeaseId),
            workspaceLeaseId: stringValue(body.workspaceLeaseId),
            prOwnershipId: stringValue(body.prOwnershipId),
            conflictResolutionPlanId: stringValue(body.conflictResolutionPlanId),
            dryRunMergeId: stringValue(body.dryRunMergeId),
            requestedByActorId: stringValue(body.requestedByActorId),
            requestedByPrincipalId: stringValue(body.requestedByPrincipalId),
            validationStatus: realMergeEvidenceStatus(body.validationStatus),
            approvalStatus: realMergeEvidenceStatus(body.approvalStatus),
            rollbackPlanStatus: realMergeEvidenceStatus(body.rollbackPlanStatus),
            tenantScopeStatus: realMergeTenantScopeStatus(body.tenantScopeStatus),
            metadata: recordValue(body.metadata)
          }, realMergeExecutionContextFromInput(requestContext, body));
          const statusCode = decision.decision === "ready_for_manual_future" ? 200 : 409;
          sendJson(response, statusCode, {
            decision,
            preconditions: realMergePolicyService.listPreconditions(decision.requestId),
            mergeExecutionPerformed: false,
            autoMergePerformed: false,
            remotePushPerformed: false
          });
          return;
        }

        if (method === "GET" && segments.length === 3 && segments[2] === "decisions") {
          sendJson(response, 200, {
            decisions: realMergePolicyService.listDecisions(url.searchParams.get("requestId") ?? undefined)
          });
          return;
        }

        if (method === "GET" && segments.length === 3 && segments[2] === "summary") {
          sendJson(response, 200, {
            summary: realMergePolicyService.getSummary(repoId),
            requests: realMergePolicyService.listRequests(repoId),
            decisions: realMergePolicyService.listDecisions(),
            preconditions: realMergePolicyService.listPreconditions(),
            forbiddenOperations: realMergePolicyService.listForbiddenOperations()
          });
          return;
        }

        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "real_merge_execution_policy_route_not_found" : "method_not_allowed",
          message: "Real merge execution policy endpoints are metadata-only and never execute merges, remote Git, auto-merge, branch deletion, or workspace mutation."
        });
        return;
      }

      if (segments[1] === "pr-ownership") {
        const prOwnershipService = context.prOwnershipService;
        const repoId = url.searchParams.get("repoId") ?? undefined;

        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, {
            ownershipRecords: prOwnershipService.listOwnership({
              repoId,
              branchName: url.searchParams.get("branchName") ?? undefined,
              pullRequestId: url.searchParams.get("pullRequestId") ?? undefined,
              branchLeaseId: url.searchParams.get("branchLeaseId") ?? undefined,
              mergeQueueEntryId: url.searchParams.get("mergeQueueEntryId") ?? undefined,
              conflictResolutionPlanId: url.searchParams.get("conflictResolutionPlanId") ?? undefined,
              ownerActorId: url.searchParams.get("ownerActorId") ?? undefined,
              ownerTeamId: url.searchParams.get("ownerTeamId") ?? undefined,
              status: isPrOwnershipStatus(url.searchParams.get("status")) ? url.searchParams.get("status") as PrOwnershipStatus : undefined
            })
          });
          return;
        }

        if (method === "POST" && segments.length === 2) {
          const body = recordValue(await readJson(request));
          const ownership = prOwnershipService.createOwnership({
            id: stringValue(body.id),
            repoId: stringValue(body.repoId),
            pullRequestId: stringValue(body.pullRequestId),
            pullRequestNumber: finiteNumber(body.pullRequestNumber),
            branchName: stringValue(body.branchName),
            branchLeaseId: stringValue(body.branchLeaseId),
            workspaceLeaseId: stringValue(body.workspaceLeaseId),
            mergeQueueEntryId: stringValue(body.mergeQueueEntryId),
            conflictResolutionPlanId: stringValue(body.conflictResolutionPlanId),
            taskId: stringValue(body.taskId),
            taskRunId: stringValue(body.taskRunId),
            agentRunId: stringValue(body.agentRunId),
            ownerActorId: stringValue(body.ownerActorId),
            ownerPrincipalId: stringValue(body.ownerPrincipalId),
            ownerKind: isPrOwnerKind(body.ownerKind) ? body.ownerKind : undefined,
            ownerTeamId: stringValue(body.ownerTeamId),
            reviewerActorIds: stringArrayValue(body.reviewerActorIds),
            reviewerTeamIds: stringArrayValue(body.reviewerTeamIds),
            status: isPrOwnershipStatus(body.status) ? body.status : undefined,
            metadata: recordValue(body.metadata)
          }, prOwnershipContextFromInput(requestContext, body));
          sendJson(response, ownership.status === "blocked" ? 403 : 201, { ownership });
          return;
        }

        if (method === "GET" && segments.length === 3 && segments[2] === "summary") {
          sendJson(response, 200, {
            summary: prOwnershipService.getSummary(repoId),
            mergeQueueOwnershipReadiness: prOwnershipService.listMergeQueueOwnershipReadiness(repoId),
            remotePrUpdateEnabled: false,
            remoteReviewerAssignmentEnabled: false,
            githubApiCalls: false,
            autoMergeEnabled: false
          });
          return;
        }

        const ownershipId = segments[2];
        if (!ownershipId) {
          sendJson(response, 400, { error: "missing_pr_ownership_id", message: "PR ownership id is required." });
          return;
        }

        if (method === "GET" && segments.length === 3) {
          const ownership = prOwnershipService.getOwnership(ownershipId) ?? notFound("PR ownership record", ownershipId);
          sendJson(response, 200, {
            ownership,
            handoffs: prOwnershipService.listHandoffs({ ownershipRecordId: ownershipId }),
            auditEvents: prOwnershipService.listAuditEvents({ ownershipRecordId: ownershipId })
          });
          return;
        }

        if (method === "POST" && segments.length === 4 && segments[3] === "review-request") {
          const body = recordValue(await readJson(request));
          const requestContextForOwnership = prOwnershipContextFromInput(requestContext, body);
          const reviewerActorId = stringValue(body.reviewerActorId);
          const reviewerTeamId = stringValue(body.reviewerTeamId);
          const ownership = reviewerActorId || reviewerTeamId
            ? prOwnershipService.addReviewer({
              ownershipRecordId: ownershipId,
              reviewerActorId,
              reviewerTeamId,
              metadata: recordValue(body.metadata)
            }, requestContextForOwnership)
            : prOwnershipService.markReviewRequested(ownershipId, requestContextForOwnership);
          sendJson(response, ownership.status === "blocked" ? 403 : 200, { ownership });
          return;
        }

        if (method === "POST" && segments.length === 4 && segments[3] === "handoff") {
          const body = recordValue(await readJson(request));
          const handoff = prOwnershipService.requestHandoff({
            id: stringValue(body.id),
            ownershipRecordId: ownershipId,
            fromActorId: stringValue(body.fromActorId),
            toActorId: stringValue(body.toActorId),
            toTeamId: stringValue(body.toTeamId),
            toServiceAccountId: stringValue(body.toServiceAccountId),
            handoffKind: isPrHandoffKind(body.handoffKind) ? body.handoffKind : undefined,
            reason: stringValue(body.reason),
            requestedAt: dateValue(body.requestedAt),
            expiresAt: dateValue(body.expiresAt),
            requiredEvidence: stringArrayValue(body.requiredEvidence),
            metadata: recordValue(body.metadata)
          }, prOwnershipContextFromInput(requestContext, body));
          const statusCode = handoff.status === "requested" ? 201 : handoff.status === "blocked_policy" ? 403 : 400;
          sendJson(response, statusCode, { handoff });
          return;
        }

        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "pr_ownership_route_not_found" : "method_not_allowed",
          message: "PR ownership endpoints are metadata-only and never update remote PRs, reviewers, branches, or merge state."
        });
        return;
      }

      if (segments[1] === "pr-handoffs") {
        const prOwnershipService = context.prOwnershipService;
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, {
            handoffs: prOwnershipService.listHandoffs({
              repoId: url.searchParams.get("repoId") ?? undefined,
              ownershipRecordId: url.searchParams.get("ownershipRecordId") ?? undefined,
              status: isPrHandoffStatus(url.searchParams.get("status")) ? url.searchParams.get("status") as PrHandoffStatus : undefined,
              toActorId: url.searchParams.get("toActorId") ?? undefined,
              toTeamId: url.searchParams.get("toTeamId") ?? undefined
            }),
            decisions: prOwnershipService.listDecisions()
          });
          return;
        }

        const handoffId = segments[2];
        if (!handoffId) {
          sendJson(response, 400, { error: "missing_pr_handoff_id", message: "PR handoff id is required." });
          return;
        }

        if (method === "POST" && segments.length === 4 && segments[3] === "decision") {
          const body = recordValue(await readJson(request));
          if (!isPrHandoffDecisionValue(body.decision)) {
            sendJson(response, 400, { error: "invalid_pr_handoff_decision", message: "decision must be accept, reject, hold, request_more_info, expired, or blocked." });
            return;
          }
          const decision = prOwnershipService.decideHandoff(handoffId, {
            decision: body.decision,
            decidedByActorId: stringValue(body.decidedByActorId),
            reason: stringValue(body.reason),
            conditions: stringArrayValue(body.conditions),
            metadata: recordValue(body.metadata)
          }, prOwnershipContextFromInput(requestContext, body));
          sendJson(response, decision.decision === "blocked" ? 403 : 200, {
            decision,
            handoffs: prOwnershipService.listHandoffs()
          });
          return;
        }

        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "pr_handoff_route_not_found" : "method_not_allowed",
          message: "PR handoff endpoints are metadata-only and never update remote PRs, reviewers, branches, or merge state."
        });
        return;
      }

      if (segments[1] === "conflicts" && segments[2] === "assistant") {
        const assistant = context.conflictResolutionAssistantService;
        const repoId = url.searchParams.get("repoId") ?? undefined;

        if (segments[3] === "requests") {
          if (method === "GET" && segments.length === 4) {
            sendJson(response, 200, { requests: assistant.listRequests({ repoId }) });
            return;
          }

          if (method === "POST" && segments.length === 4) {
            const body = recordValue(await readJson(request));
            const mergeQueueEntryId = stringValue(body.mergeQueueEntryId);
            const branchLeaseIds = stringArrayValue(body.branchLeaseIds);
            const mergeQueueEntry = mergeQueueEntryId ? store.getMergeQueueEntry(mergeQueueEntryId) ?? notFound("merge queue entry", mergeQueueEntryId) : undefined;
            const primaryLeaseId = stringValue(body.branchLeaseId) ?? mergeQueueEntry?.branchLeaseId ?? branchLeaseIds[0];
            const primaryLease = primaryLeaseId ? store.getBranchLease(primaryLeaseId) ?? notFound("branch lease", primaryLeaseId) : undefined;
            const requestRepoId = stringValue(body.repoId) ?? mergeQueueEntry?.repoId ?? primaryLease?.repoId;
            const baseBranch = stringValue(body.baseBranch) ?? primaryLease?.baseBranch;
            const sourceBranch = stringValue(body.sourceBranch) ?? mergeQueueEntry?.branchName ?? primaryLease?.branchName;
            if (!requestRepoId || !baseBranch || !sourceBranch) {
              sendJson(response, 400, {
                error: "invalid_conflict_resolution_request",
                message: "repoId, baseBranch, and sourceBranch are required unless mergeQueueEntryId or branchLeaseId supplies them."
              });
              return;
            }
            const conflictRequest = assistant.createRequest({
              id: stringValue(body.id),
              repoId: requestRepoId,
              baseBranch,
              sourceBranch,
              targetBranch: stringValue(body.targetBranch) ?? baseBranch,
              mergeSimulationId: stringValue(body.mergeSimulationId),
              mergeQueueEntryId,
              conflictRiskId: stringValue(body.conflictRiskId),
              branchLeaseIds: [...branchLeaseIds, primaryLeaseId].filter((value): value is string => typeof value === "string"),
              workspaceLeaseIds: stringArrayValue(body.workspaceLeaseIds),
              editOverlapIds: stringArrayValue(body.editOverlapIds),
              files: stringArrayValue(body.files),
              metadata: recordValue(body.metadata)
            }, conflictResolutionAssistantContextFromInput(requestContext, body));
            sendJson(response, 201, { request: conflictRequest });
            return;
          }

          const requestId = segments[4];
          if (!requestId) {
            sendJson(response, 400, { error: "missing_conflict_resolution_request_id", message: "request id is required." });
            return;
          }
          if (method === "GET" && segments.length === 5) {
            const conflictRequest = assistant.getRequest(requestId) ?? notFound("conflict resolution request", requestId);
            sendJson(response, 200, { request: conflictRequest });
            return;
          }
          if (method === "POST" && segments.length === 6 && segments[5] === "summarize") {
            const body = recordValue(await readJson(request));
            const summary = assistant.summarizeConflict(requestId, conflictResolutionAssistantContextFromInput(requestContext, body));
            sendJson(response, 200, { summary });
            return;
          }
          if (method === "POST" && segments.length === 6 && segments[5] === "plan") {
            const body = recordValue(await readJson(request));
            const plan = assistant.generateResolutionPlan(requestId, conflictResolutionAssistantContextFromInput(requestContext, body));
            sendJson(response, 201, {
              plan,
              recommendations: assistant.listRecommendations(plan.id)
            });
            return;
          }
        }

        if (method === "GET" && segments[3] === "plans") {
          sendJson(response, 200, { plans: assistant.listPlans() });
          return;
        }

        if (method === "GET" && segments[3] === "recommendations") {
          sendJson(response, 200, { recommendations: assistant.listRecommendations(url.searchParams.get("planId") ?? undefined) });
          return;
        }

        if (method === "GET" && segments[3] === "summary") {
          sendJson(response, 200, {
            summary: assistant.getSummary(repoId),
            summaries: assistant.listSummaries({ repoId }),
            plans: assistant.listPlans()
          });
          return;
        }

        if (method === "POST" && segments[3] === "plans" && segments[5] === "reviewed") {
          const body = recordValue(await readJson(request));
          const planId = segments[4];
          if (!planId) {
            sendJson(response, 400, { error: "missing_conflict_resolution_plan_id", message: "plan id is required." });
            return;
          }
          sendJson(response, 200, { plan: assistant.markPlanReviewed(planId, conflictResolutionAssistantContextFromInput(requestContext, body)) });
          return;
        }

        if (method === "POST" && segments[3] === "plans" && segments[5] === "link-merge-queue-hold") {
          const body = recordValue(await readJson(request));
          const planId = segments[4];
          const holdId = stringValue(body.holdId) ?? segments[6];
          if (!planId || !holdId) {
            sendJson(response, 400, { error: "missing_plan_or_hold_id", message: "plan id and hold id are required." });
            return;
          }
          sendJson(response, 200, { plan: assistant.linkMergeQueueHold(planId, holdId, conflictResolutionAssistantContextFromInput(requestContext, body)) });
          return;
        }

        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "conflict_resolution_assistant_route_not_found" : "method_not_allowed",
          message: "Conflict Resolution Assistant endpoints are metadata-only and never apply patches or execute merges."
        });
        return;
      }

      if (segments[1] === "merge-queue") {
        const mergeQueuePolicyService = context.mergeQueuePolicyService;
        const repoId = url.searchParams.get("repoId") ?? undefined;
        if (method === "GET" && segments.length === 3 && segments[2] === "policy") {
          sendJson(response, 200, { policy: mergeQueuePolicyService.getPolicy() });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "decisions") {
          const preview = mergeQueuePolicyService.previewQueue(repoId, mergeQueuePolicyContextFromInput(requestContext, {
            metadata: { source: "api_merge_queue_policy_decisions" }
          }));
          sendJson(response, 200, { decisions: preview.decisions });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "holds") {
          const preview = mergeQueuePolicyService.previewQueue(repoId, mergeQueuePolicyContextFromInput(requestContext, {
            metadata: { source: "api_merge_queue_policy_holds" }
          }));
          sendJson(response, 200, { holds: preview.holds });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "summary") {
          const preview = mergeQueuePolicyService.previewQueue(repoId, mergeQueuePolicyContextFromInput(requestContext, {
            metadata: { source: "api_merge_queue_policy_summary" }
          }));
          sendJson(response, 200, { summary: preview.summary, decisions: preview.decisions, holds: preview.holds });
          return;
        }

        const entryId = segments[2];
        if (!entryId) {
          sendJson(response, 400, { error: "missing_merge_queue_entry_id", message: "merge queue entry id is required." });
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "evaluate") {
          const body = recordValue(await readJson(request));
          const decision = mergeQueuePolicyService.evaluateEntry(entryId, mergeQueuePolicyContextFromInput(requestContext, body));
          sendJson(response, decision.decision === "blocked" ? 409 : 200, { decision });
          return;
        }
        if (method === "POST" && segments.length === 4 && segments[3] === "hold") {
          const body = recordValue(await readJson(request));
          const holdKind = isMergeQueueHoldKind(body.holdKind) ? body.holdKind : "human_review_required";
          const severity = isMergeQueueHoldSeverity(body.severity) ? body.severity : "medium";
          const reason = stringValue(body.reason) ?? holdKind;
          const hold = mergeQueuePolicyService.holdEntry(entryId, {
            holdKind,
            severity,
            reason,
            metadata: recordValue(body.metadata)
          }, mergeQueuePolicyContextFromInput(requestContext, body));
          sendJson(response, hold.holdKind === "policy_denied" ? 403 : 201, { hold });
          return;
        }
        if (method === "POST" && segments.length >= 4 && segments[3] === "release-hold") {
          const body = recordValue(await readJson(request));
          const holdId = segments[4] ?? stringValue(body.holdId);
          if (!holdId) {
            sendJson(response, 400, { error: "missing_merge_queue_hold_id", message: "holdId is required." });
            return;
          }
          const hold = mergeQueuePolicyService.releaseHold(entryId, holdId, mergeQueuePolicyContextFromInput(requestContext, body));
          sendJson(response, hold.holdKind === "policy_denied" ? 403 : 200, { hold });
          return;
        }
        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "merge_queue_policy_route_not_found" : "method_not_allowed",
          message: "Merge queue policy endpoints are metadata-only and never execute merges."
        });
        return;
      }

      if (segments[1] === "cleanup") {
        const cleanupService = context.branchCleanupRecoveryService;
        const cleanupRepoId = url.searchParams.get("repoId") ?? undefined;
        const cleanupLeaseKindParam = url.searchParams.get("leaseKind");
        const cleanupSeverityParam = url.searchParams.get("severity");
        const cleanupLeaseKinds: OrphanLeaseKind[] = ["branch", "workspace", "worktree", "merge_queue", "pr_ownership", "agent_session"];
        const cleanupSeverities: OrphanSeverity[] = ["low", "medium", "high", "critical"];
        const cleanupLeaseKind = cleanupLeaseKindParam && cleanupLeaseKinds.includes(cleanupLeaseKindParam as OrphanLeaseKind)
          ? (cleanupLeaseKindParam as OrphanLeaseKind)
          : undefined;
        const cleanupSeverity = cleanupSeverityParam && cleanupSeverities.includes(cleanupSeverityParam as OrphanSeverity)
          ? (cleanupSeverityParam as OrphanSeverity)
          : undefined;
        const cleanupContext = (() => ({
          actorId: requestContext.authContext.actor.id,
          principalId: requestContext.authContext.principal.id,
          serviceAccountId: typeof requestContext.authContext.metadata.serviceAccountId === "string"
            ? (requestContext.authContext.metadata.serviceAccountId as string)
            : undefined,
          requestId: requestContext.requestId,
          correlationId: requestContext.correlationId,
          source: "api"
        }));

        if (method === "GET" && segments.length === 3 && segments[2] === "orphans") {
          sendJson(response, 200, {
            orphans: cleanupService.listOrphanRecords({ repoId: cleanupRepoId, leaseKind: cleanupLeaseKind, severity: cleanupSeverity })
          });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "recommendations") {
          sendJson(response, 200, { recommendations: cleanupService.listRecommendations() });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "summary") {
          sendJson(response, 200, { summary: cleanupService.getSummary() });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "recovery-actions") {
          sendJson(response, 200, { recoveryActions: cleanupService.listRecoveryActions() });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "decisions") {
          sendJson(response, 200, { decisions: cleanupService.listDecisions() });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "scan") {
          const result = cleanupService.scanForOrphans({ repoId: cleanupRepoId }, cleanupContext());
          sendJson(response, 201, {
            orphans: result.orphans,
            recommendations: result.recommendations,
            summary: cleanupService.getSummary()
          });
          return;
        }
        if (method === "POST" && segments.length === 5 && segments[2] === "recommendations" && segments[4] === "decision") {
          const recommendationId = segments[3];
          const body = recordValue(await readJson(request));
          const decisionValueRaw = stringValue(body.decision);
          const allowedDecisions: CleanupDecisionValue[] = ["approved_metadata_only", "rejected", "held", "future_destructive_review", "blocked_policy", "executed_metadata_only"];
          if (!decisionValueRaw || !allowedDecisions.includes(decisionValueRaw as CleanupDecisionValue)) {
            sendJson(response, 400, { error: "invalid_cleanup_decision", message: "decision is required and must be one of the documented values." });
            return;
          }
          const decisionInput: BranchCleanupDecisionInput = {
            recommendationId,
            decision: decisionValueRaw as CleanupDecisionValue,
            reason: stringValue(body.reason),
            metadata: recordValue(body.metadata)
          };
          try {
            const decision = cleanupService.decideRecommendation(decisionInput, cleanupContext());
            sendJson(response, 201, { decision });
          } catch (error) {
            sendJson(response, 404, { error: "cleanup_recommendation_not_found", message: (error as Error).message });
          }
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "metadata-execute") {
          const body = recordValue(await readJson(request));
          const decisionId = stringValue(body.decisionId);
          if (!decisionId) {
            sendJson(response, 400, { error: "missing_cleanup_decision_id", message: "decisionId is required." });
            return;
          }
          try {
            const result = cleanupService.executeMetadataOnlyCleanup(decisionId, cleanupContext());
            sendJson(response, 200, result);
          } catch (error) {
            sendJson(response, 409, { error: "cleanup_metadata_execute_blocked", message: (error as Error).message });
          }
          return;
        }
        if (method === "POST" && segments.length === 5 && segments[2] === "orphans" && segments[4] === "propose-recovery") {
          const orphanId = segments[3];
          try {
            const actions = cleanupService.proposeRecovery(orphanId, cleanupContext());
            sendJson(response, 201, { recoveryActions: actions });
          } catch (error) {
            sendJson(response, 404, { error: "cleanup_orphan_not_found", message: (error as Error).message });
          }
          return;
        }
        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "cleanup_route_not_found" : "method_not_allowed",
          message: "Branch cleanup endpoints are metadata-only and never delete branches, worktrees, or PRs."
        });
        return;
      }

      if (segments[1] === "branches" && segments[2] === "orchestrate" && method === "POST") {
        const body = await readJson(request) as Record<string, unknown>;
        const repoId = stringValue(body.repoId);
        const agentRunId = stringValue(body.agentRunId);
        if (!repoId || !agentRunId) {
          sendJson(response, 400, { error: "invalid_branch_orchestration_request", message: "repoId and agentRunId are required." });
          return;
        }
        const sourceScope = recordValue(body.sourceScope);
        const decision = branchOrchestratorService.allocateBranch({
          userId: stringValue(body.userId) ?? requestContext.authContext.principal.id,
          actorId: stringValue(body.actorId) ?? requestContext.authContext.actor.id,
          taskId: stringValue(body.taskId),
          taskRunId: stringValue(body.taskRunId),
          agentRunId,
          sessionId: stringValue(body.sessionId),
          repoId,
          baseBranch: stringValue(body.baseBranch),
          requestedBranchName: stringValue(body.requestedBranchName) ?? stringValue(body.branchName),
          branchPurpose: isBranchPurpose(body.branchPurpose) ? body.branchPurpose : undefined,
          targetFiles: stringArrayValue(body.targetFiles),
          sourceScope: {
            scopeKind: isAgentSessionSourceScopeKind(sourceScope.scopeKind) ? sourceScope.scopeKind : undefined,
            paths: stringArrayValue(sourceScope.paths),
            description: stringValue(sourceScope.description),
            metadata: recordValue(sourceScope.metadata)
          },
          branchLeaseId: stringValue(body.branchLeaseId),
          workspaceLeaseId: stringValue(body.workspaceLeaseId),
          expiresAt: dateValue(body.expiresAt),
          metadata: recordValue(body.metadata)
        }, {
          actorId: requestContext.authContext.actor.id,
          principalId: requestContext.authContext.principal.id,
          requestId: requestContext.requestId,
          correlationId: requestContext.correlationId,
          source: "api",
          metadata: { authMode: requestContext.authContext.authMode }
        });
        const blocked = decision.decision === "blocked_collision" || decision.decision === "blocked_policy" || decision.decision === "blocked_same_workspace";
        sendJson(response, decision.decision === "blocked_policy" ? 400 : blocked ? 409 : 201, {
          decision: branchOrchestrationDecisionToDto(decision),
          request: branchOrchestrationRequestToDto(branchOrchestratorService.getOrchestrationRequest(decision.requestId) ?? notFound("branch orchestration request", decision.requestId)),
          summary: branchOrchestratorSummaryToDto(branchOrchestratorService.getSummary())
        });
        return;
      }

      if (segments[1] === "branches" && segments[2] === "orchestration") {
        if (method === "GET" && segments.length === 3) {
          const decisionFilter = url.searchParams.get("decision");
          sendJson(response, 200, {
            requests: branchOrchestratorService.listOrchestrationRequests({
              repoId: url.searchParams.get("repoId") ?? undefined,
              userId: url.searchParams.get("userId") ?? undefined,
              taskId: url.searchParams.get("taskId") ?? undefined,
              sessionId: url.searchParams.get("sessionId") ?? undefined,
              decision: isBranchOrchestrationDecision(decisionFilter) ? decisionFilter : undefined
            }).map(branchOrchestrationRequestToDto),
            decisions: branchOrchestratorService.listOrchestrationDecisions({
              repoId: url.searchParams.get("repoId") ?? undefined,
              userId: url.searchParams.get("userId") ?? undefined,
              taskId: url.searchParams.get("taskId") ?? undefined,
              sessionId: url.searchParams.get("sessionId") ?? undefined,
              decision: isBranchOrchestrationDecision(decisionFilter) ? decisionFilter : undefined
            }).map(branchOrchestrationDecisionToDto)
          });
          return;
        }
        if (method === "GET" && segments[3] === "summary") {
          sendJson(response, 200, { summary: branchOrchestratorSummaryToDto(branchOrchestratorService.getSummary()) });
          return;
        }
        if (method === "GET" && segments[3] === "policies") {
          sendJson(response, 200, { policies: branchOrchestratorService.listNamingPolicies().map(branchNamingPolicyToDto) });
          return;
        }
        if (method === "GET" && segments[3] === "audit") {
          sendJson(response, 200, {
            auditEvents: branchOrchestratorService.listAuditEvents({
              repoId: url.searchParams.get("repoId") ?? undefined,
              branchName: url.searchParams.get("branchName") ?? undefined,
              requestId: url.searchParams.get("requestId") ?? undefined
            }).map(branchOrchestratorAuditEventToDto)
          });
          return;
        }
        if (method === "GET" && segments[3]) {
          const id = segments[3];
          const requestRecord = branchOrchestratorService.getOrchestrationRequest(id);
          const decision = branchOrchestratorService.getOrchestrationDecision(id);
          if (!requestRecord && !decision) notFound("branch orchestration record", id);
          sendJson(response, 200, {
            request: requestRecord ? branchOrchestrationRequestToDto(requestRecord) : undefined,
            decision: decision ? branchOrchestrationDecisionToDto(decision) : undefined
          });
          return;
        }
      }

      if (segments[1] === "branches" && segments[2] === "ownership" && method === "GET") {
        const status = url.searchParams.get("status");
        sendJson(response, 200, {
          ownershipRecords: branchOrchestratorService.listBranchOwnershipRecords({
            repoId: url.searchParams.get("repoId") ?? undefined,
            userId: url.searchParams.get("userId") ?? undefined,
            taskId: url.searchParams.get("taskId") ?? undefined,
            taskRunId: url.searchParams.get("taskRunId") ?? undefined,
            agentRunId: url.searchParams.get("agentRunId") ?? undefined,
            sessionId: url.searchParams.get("sessionId") ?? undefined,
            branchName: url.searchParams.get("branchName") ?? undefined,
            status: isBranchOwnershipStatus(status) ? status : undefined
          }).map(branchOwnershipRecordToDto)
        });
        return;
      }

      if (segments[1] === "branches" && segments[2] === "drift" && method === "GET") {
        const status = url.searchParams.get("status");
        sendJson(response, 200, {
          driftStatuses: branchOrchestratorService.listBaseBranchDrift({
            repoId: url.searchParams.get("repoId") ?? undefined,
            branchName: url.searchParams.get("branchName") ?? undefined,
            status: isBaseBranchDriftStatus(status) ? status : undefined
          }).map(baseBranchDriftStatusToDto)
        });
        return;
      }

      if (segments[1] === "github-app") {
        if (method === "GET" && segments.length === 3 && segments[2] === "config") {
          sendJson(response, 200, { config: githubAppService.getConfigDto() });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "installations") {
          sendJson(response, 200, { installations: githubAppService.listInstallationsDto() });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "repository-grants") {
          sendJson(response, 200, { repositoryGrants: githubAppService.listRepositoryGrantsDto() });
          return;
        }
        if (method === "POST" && segments.length === 3 && segments[2] === "validate") {
          const validation = githubAppService.validate();
          sendJson(response, validation.ok ? 200 : 409, validation);
          return;
        }
        if (method === "POST" && segments.length === 6 && segments[2] === "installations" && segments[4] === "token" && segments[5] === "check") {
          const body = await readJson(request) as Record<string, unknown>;
          const purpose = githubInstallationTokenPurposeValue(body.purpose) ?? "branch_create";
          const result = githubAppService.checkInstallationToken({
            installationId: segments[3],
            repoRef: stringValue(body.repoRef),
            purpose,
            actorId: stringValue(body.actorId) ?? requestContext.authContext.actor.id,
            principalId: stringValue(body.principalId) ?? requestContext.authContext.principal.id,
            policyContext: typeof body.policyContext === "object" && body.policyContext !== null && !Array.isArray(body.policyContext)
              ? body.policyContext as Record<string, unknown>
              : {},
            metadata: {
              source: "api_token_check",
              requestId: requestContext.requestId,
              correlationId: requestContext.correlationId,
              actorId: requestContext.authContext.actor.id,
              principalId: requestContext.authContext.principal.id
            }
          });
          sendJson(response, 200, { result });
          return;
        }
        if (method === "GET" && segments.length === 3 && segments[2] === "audit") {
          sendJson(response, 200, { auditEvents: githubAppService.listAuditEventsDto() });
          return;
        }
        sendJson(response, method === "GET" || method === "POST" ? 404 : 405, {
          error: method === "GET" || method === "POST" ? "github_app_route_not_found" : "method_not_allowed",
          message: "GitHub App controlled implementation endpoints are metadata/status only and never return tokens."
        });
        return;
      }

      if (segments[1] === "github" && segments[2] === "webhooks") {
        if (method === "POST" && segments.length === 3) {
          const result = await webhookService.receiveGitHubWebhook({
            headers: request.headers,
            rawBody: await readRawBody(request)
          });
          sendJson(response, result.statusCode, result as unknown as JsonValue);
          return;
        }
        if (method === "GET" && segments[3] === "config") {
          sendJson(response, 200, { config: webhookService.getConfig() });
          return;
        }
        if (method === "GET" && segments[3] === "events" && segments.length === 4) {
          sendJson(response, 200, {
            events: webhookService.listEvents({
              repoRef: url.searchParams.get("repoRef") ?? undefined,
              eventType: url.searchParams.get("eventType") ?? undefined
            })
          });
          return;
        }
        if (method === "GET" && segments[3] === "events" && segments[4]) {
          const event = webhookService.getEvent(segments[4]);
          sendJson(response, 200, { event: event ?? notFound("git webhook event", segments[4]) });
          return;
        }
        if (method === "GET" && segments[3] === "audit") {
          sendJson(response, 200, {
            auditEvents: webhookService.listAuditEvents({
              repoRef: url.searchParams.get("repoRef") ?? undefined,
              deliveryId: url.searchParams.get("deliveryId") ?? undefined,
              eventType: url.searchParams.get("eventType") ?? undefined
            })
          });
          return;
        }
      }

      if (method === "GET" && segments[1] === "providers") {
        sendJson(response, 200, { providers: gitService.listProviders() });
        return;
      }

      if (method === "GET" && segments[1] === "config") {
        sendJson(response, 200, { config: gitService.getConfig() });
        return;
      }

      if (method === "POST" && segments[1] === "github" && segments[2] === "validate") {
        const result = await gitService.validateGitHubConnection();
        sendJson(response, result.ok ? 200 : 409, {
          ok: result.ok,
          reason: "reason" in result ? result.reason : undefined,
          result: "data" in result ? result.data : undefined,
          config: gitService.getConfig()
        });
        return;
      }

      if (method === "GET" && segments[1] === "remote" && segments[2] === "audit") {
        sendJson(response, 200, {
          auditEvents: gitService.listGitAuditEvents().filter((event) =>
            event.action.includes("github_") || event.action.includes("remote_git")
          )
        });
        return;
      }

      if (segments[1] === "repos") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { repos: gitService.listRepos() });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            sendJson(response, 201, { repo: gitService.createRepo(await readJson(request)) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_repo", message: error instanceof Error ? error.message : "Invalid repository" });
          }
          return;
        }

        const repoId = segments[2];
        if (!repoId) {
          sendJson(response, 400, { error: "missing_repo_id", message: "repo id is required." });
          return;
        }

        if (method === "GET" && segments.length === 3) {
          sendJson(response, 200, { repo: gitService.getRepo(repoId) ?? notFound("repo", repoId) });
          return;
        }

        if (segments[3] === "pr-sync") {
          if (method === "GET" && segments.length === 4) {
            sendJson(response, 200, { pullRequestSyncStates: webhookService.listPullRequestSyncStates(repoId) });
            return;
          }
          if (method === "GET" && segments[4]) {
            const pullRequestNumber = Number(segments[4]);
            if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) {
              sendJson(response, 400, { error: "invalid_pull_request_number", message: "pull request number must be a positive integer." });
              return;
            }
            sendJson(response, 200, { pullRequestSyncState: webhookService.getPullRequestSyncState(repoId, pullRequestNumber) ?? notFound("pull request sync state", `${repoId}:${pullRequestNumber}`) });
            return;
          }
        }

        if (segments[3] === "branch-sync") {
          if (method === "GET" && segments.length === 4) {
            sendJson(response, 200, { branchSyncStates: webhookService.listBranchSyncStates(repoId) });
            return;
          }
          if (method === "GET" && segments[4]) {
            const branchName = decodeURIComponent(segments.slice(4).join("/"));
            sendJson(response, 200, { branchSyncState: webhookService.getBranchSyncState(repoId, branchName) ?? notFound("branch sync state", `${repoId}:${branchName}`) });
            return;
          }
        }

        if (segments[3] === "branches") {
          if (method === "GET" && segments.length === 4) {
            sendJson(response, 200, { branches: await gitService.listBranches(repoId, url.searchParams.get("localPath") ?? undefined) });
            return;
          }
          if (method === "POST" && (segments.length === 4 || segments[4] === "remote")) {
            const body = await readJson(request) as Record<string, unknown>;
            const branchName = stringValue(body.branchName);
            if (!branchName) {
              sendJson(response, 400, { error: "invalid_branch_request", message: "branchName is required." });
              return;
            }
            const input = {
              branchName,
              baseBranch: stringValue(body.baseBranch),
              taskId: stringValue(body.taskId),
              taskRunId: stringValue(body.taskRunId),
              actorId: requestContext.authContext.actor.id,
              principalId: requestContext.authContext.principal.id,
              authContext: requestContext.authContext,
              requestContext,
              branchLeaseId: stringValue(body.branchLeaseId),
              localPath: stringValue(body.localPath),
              files: Array.isArray(body.files) ? body.files.filter((file): file is string => typeof file === "string") : undefined,
              symbols: Array.isArray(body.symbols) ? body.symbols.filter((symbol): symbol is string => typeof symbol === "string") : undefined,
              tests: Array.isArray(body.tests) ? body.tests.filter((testPath): testPath is string => typeof testPath === "string") : undefined
            };
            const result = segments[4] === "remote"
              ? await gitService.createRemoteBranch(repoId, input)
              : await gitService.createBranch(repoId, input);
            sendJson(response, result.ok ? 201 : 409, result as unknown as JsonValue);
            return;
          }
        }

        if (segments[3] === "pull-requests") {
          if (method === "POST" && segments.length === 6 && segments[5] === "sync") {
            const pullRequestNumber = Number(segments[4]);
            if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) {
              sendJson(response, 400, { error: "invalid_pull_request_number", message: "pull request number must be a positive integer." });
              return;
            }
            const result = webhookService.manualSyncPullRequest(repoId, pullRequestNumber);
            sendJson(response, result.ok ? 200 : 409, result as unknown as JsonValue);
            return;
          }
          if (method === "POST" && segments.length === 6 && segments[5] === "refresh-changed-files") {
            const pullRequestNumber = Number(segments[4]);
            if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) {
              sendJson(response, 400, { error: "invalid_pull_request_number", message: "pull request number must be a positive integer." });
              return;
            }
            const result = await webhookService.refreshChangedFiles(repoId, pullRequestNumber);
            sendJson(response, result.ok ? 200 : 409, result as unknown as JsonValue);
            return;
          }
          if (method === "GET" && segments.length === 6 && segments[5] === "changed-files") {
            const pullRequestNumber = Number(segments[4]);
            if (!Number.isInteger(pullRequestNumber) || pullRequestNumber < 1) {
              sendJson(response, 400, { error: "invalid_pull_request_number", message: "pull request number must be a positive integer." });
              return;
            }
            sendJson(response, 200, await gitService.getPullRequestChangedFiles(repoId, {
              pullRequestNumber,
              taskId: url.searchParams.get("taskId") ?? undefined,
              taskRunId: url.searchParams.get("taskRunId") ?? undefined,
              actorId: requestContext.authContext.actor.id,
              principalId: requestContext.authContext.principal.id,
              authContext: requestContext.authContext,
              requestContext
            }) as unknown as JsonValue);
            return;
          }
          if (method === "GET" && segments.length === 4) {
            sendJson(response, 200, { pullRequests: gitService.listPullRequests(repoId) });
            return;
          }
          if (method === "POST" && (segments.length === 4 || segments[4] === "remote")) {
            const body = await readJson(request) as Record<string, unknown>;
            const taskId = stringValue(body.taskId);
            const branchName = stringValue(body.branchName);
            const title = stringValue(body.title);
            if (!taskId || !branchName || !title) {
              sendJson(response, 400, { error: "invalid_pull_request", message: "taskId, branchName, and title are required." });
              return;
            }
            const input = {
              taskId,
              taskRunId: stringValue(body.taskRunId),
              actorId: requestContext.authContext.actor.id,
              principalId: requestContext.authContext.principal.id,
              authContext: requestContext.authContext,
              requestContext,
              branchLeaseId: stringValue(body.branchLeaseId),
              branchName,
              baseBranch: stringValue(body.baseBranch),
              title,
              body: stringValue(body.body),
              localPath: stringValue(body.localPath)
            };
            const result = segments[4] === "remote"
              ? await gitService.createRemotePullRequest(repoId, input)
              : await gitService.createPullRequest(repoId, input);
            sendJson(response, result.ok ? 201 : 409, result as unknown as JsonValue);
            return;
          }
        }
      }

      if (segments[1] === "pull-requests") {
        const pullRequestId = segments[2];
        if (!pullRequestId) {
          sendJson(response, 400, { error: "missing_pull_request_id", message: "pull request id is required." });
          return;
        }
        const pullRequest = gitService.getPullRequest(pullRequestId);
        if (!pullRequest) notFound("pull request", pullRequestId);
        if (method === "GET" && segments.length === 3) {
          sendJson(response, 200, { pullRequest });
          return;
        }
        if (method === "GET" && segments[3] === "changed-files") {
          const branchName = url.searchParams.get("branchName") ?? pullRequest.externalId?.replace(/^mock-pr_/, "");
          if (!branchName) {
            sendJson(response, 400, { error: "missing_branch_name", message: "branchName query parameter is required for changed-file inspection." });
            return;
          }
          sendJson(response, 200, await gitService.getChangedFiles(pullRequest.repoId, {
            branchName,
            baseBranch: url.searchParams.get("baseBranch") ?? undefined,
            localPath: url.searchParams.get("localPath") ?? undefined,
            actorId: requestContext.authContext.actor.id,
            principalId: requestContext.authContext.principal.id,
            authContext: requestContext.authContext,
            requestContext
          }) as unknown as JsonValue);
          return;
        }
      }

      if (method === "GET" && segments[1] === "audit") {
        sendJson(response, 200, { auditEvents: gitService.listGitAuditEvents() });
        return;
      }
    }

    if (segments[0] === "llm") {
      const llmService = context.llmGatewayService;

      if (method === "GET" && segments[1] === "routing" && segments[2] === "config") {
        sendJson(response, 200, { config: llmService.getRoutingConfig() });
        return;
      }

      if (method === "GET" && segments[1] === "routing" && segments[2] === "decisions") {
        sendJson(response, 200, { decisions: llmService.listRoutingDecisions().map(llmRoutingDecisionToDto) });
        return;
      }

      if (method === "GET" && segments[1] === "providers" && segments[2] === "health") {
        sendJson(response, 200, { providerHealth: llmService.listProviderHealth().map(llmProviderHealthToDto) });
        return;
      }

      if (segments[1] === "routes") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { routes: llmService.listRoutes().map(llmRouteToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (typeof body.id !== "string" || typeof body.name !== "string" || typeof body.providerId !== "string" || !isLlmProviderKind(body.providerKind) || typeof body.modelId !== "string") {
              sendJson(response, 400, { error: "invalid_llm_route", message: "id, name, providerId, providerKind, and modelId are required." });
              return;
            }
            const promptClasses = Array.isArray(body.promptClasses)
              ? body.promptClasses.map(llmPromptClassValue).filter((value): value is NonNullable<ReturnType<typeof llmPromptClassValue>> => value !== undefined)
              : ["general" as const, "unknown" as const];
            const route = llmService.createRoute({
              id: body.id,
              name: body.name,
              description: stringValue(body.description) ?? "Custom LLM route",
              providerId: body.providerId,
              providerKind: body.providerKind,
              modelId: body.modelId,
              priority: typeof body.priority === "number" ? body.priority : 500,
              enabled: body.enabled !== false,
              capabilities: Array.isArray(body.capabilities) ? body.capabilities.filter((value): value is string => typeof value === "string") : ["completion"],
              promptClasses,
              maxInputTokens: typeof body.maxInputTokens === "number" ? body.maxInputTokens : undefined,
              maxOutputTokens: typeof body.maxOutputTokens === "number" ? body.maxOutputTokens : undefined,
              estimatedInputTokenCostUsd: typeof body.estimatedInputTokenCostUsd === "number" ? body.estimatedInputTokenCostUsd : undefined,
              estimatedOutputTokenCostUsd: typeof body.estimatedOutputTokenCostUsd === "number" ? body.estimatedOutputTokenCostUsd : undefined,
              requiresRemote: body.requiresRemote === true,
              requiresSecretRef: body.requiresSecretRef === true,
              fallbackAllowed: body.fallbackAllowed === true,
              metadata: recordValue(body.metadata)
            });
            sendJson(response, 201, { route: llmRouteToDto(route) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_llm_route", message: error instanceof Error ? error.message : "Invalid LLM route." });
          }
          return;
        }
        if (method === "PATCH" && segments.length === 4 && segments[3] === "status") {
          const body = await readJson(request) as Record<string, unknown>;
          if (typeof body.enabled !== "boolean") {
            sendJson(response, 400, { error: "invalid_llm_route_status", message: "enabled boolean is required." });
            return;
          }
          try {
            sendJson(response, 200, { route: llmRouteToDto(llmService.updateRouteStatus(segments[2], body.enabled)) });
          } catch (error) {
            sendJson(response, 404, { error: "llm_route_not_found", message: error instanceof Error ? error.message : "LLM route not found." });
          }
          return;
        }
      }

      if (segments[1] === "fallback-policies") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { fallbackPolicies: llmService.listFallbackPolicies().map(llmFallbackPolicyToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (typeof body.id !== "string" || typeof body.name !== "string") {
              sendJson(response, 400, { error: "invalid_llm_fallback_policy", message: "id and name are required." });
              return;
            }
            const policy = llmService.createFallbackPolicy({
              id: body.id,
              name: body.name,
              enabled: body.enabled === true,
              maxAttempts: typeof body.maxAttempts === "number" ? body.maxAttempts : 0,
              allowedProviderKinds: Array.isArray(body.allowedProviderKinds) ? body.allowedProviderKinds.filter(isLlmProviderKind) : ["mock"],
              disallowedProviderKinds: Array.isArray(body.disallowedProviderKinds) ? body.disallowedProviderKinds.filter(isLlmProviderKind) : ["local_cli"],
              requireSameDataClass: body.requireSameDataClass !== false,
              requireBudgetRemaining: body.requireBudgetRemaining !== false,
              requirePolicyAllow: body.requirePolicyAllow !== false,
              stopOnPolicyDeny: body.stopOnPolicyDeny !== false,
              stopOnCredentialDeny: body.stopOnCredentialDeny !== false,
              stopOnBudgetDeny: body.stopOnBudgetDeny !== false,
              metadata: recordValue(body.metadata)
            });
            sendJson(response, 201, { fallbackPolicy: llmFallbackPolicyToDto(policy) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_llm_fallback_policy", message: error instanceof Error ? error.message : "Invalid LLM fallback policy." });
          }
          return;
        }
      }

      if (method === "GET" && segments[1] === "providers") {
        sendJson(response, 200, { providers: llmService.listProviders() });
        return;
      }

      if (method === "GET" && segments[1] === "config") {
        sendJson(response, 200, { config: llmConfigToDto(llmService.getConfig()) });
        return;
      }

      if (segments[1] === "models") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { models: llmService.listModels().map(llmModelToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (!isLlmProviderKind(body.providerKind) || !isLlmModelStatus(body.status) || typeof body.id !== "string" || typeof body.displayName !== "string") {
              sendJson(response, 400, { error: "invalid_llm_model", message: "id, displayName, providerKind, and status are required." });
              return;
            }
            const model = llmService.registerModel({
              id: body.id,
              providerKind: body.providerKind,
              displayName: body.displayName,
              contextWindow: typeof body.contextWindow === "number" ? body.contextWindow : 16000,
              supportsTools: body.supportsTools === true,
              supportsStreaming: body.supportsStreaming === true,
              inputTokenCostUsd: typeof body.inputTokenCostUsd === "number" ? body.inputTokenCostUsd : undefined,
              outputTokenCostUsd: typeof body.outputTokenCostUsd === "number" ? body.outputTokenCostUsd : undefined,
              status: body.status,
              metadata: typeof body.metadata === "object" && body.metadata !== null ? body.metadata as Record<string, unknown> : {}
            });
            sendJson(response, 201, { model: llmModelToDto(model) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_llm_model", message: error instanceof Error ? error.message : "Invalid LLM model." });
          }
          return;
        }
        const modelId = decodeURIComponent(segments[2] ?? "");
        if (method === "GET" && segments.length === 3) {
          const model = llmService.getModel(modelId);
          if (!model) notFound("llm model", modelId);
          sendJson(response, 200, { model: llmModelToDto(model) });
          return;
        }
        if (method === "PATCH" && segments.length === 4 && segments[3] === "status") {
          const body = await readJson(request) as Record<string, unknown>;
          if (!isLlmModelStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_llm_model_status", message: "status must be active, disabled, or deprecated." });
            return;
          }
          try {
            sendJson(response, 200, { model: llmModelToDto(llmService.updateModelStatus(modelId, body.status)) });
          } catch (error) {
            sendJson(response, 404, { error: "llm_model_not_found", message: error instanceof Error ? error.message : "LLM model not found." });
          }
          return;
        }
      }

      if (segments[1] === "virtual-keys") {
        if (method === "GET" && segments.length === 2) {
          sendJson(response, 200, { virtualKeys: llmService.listVirtualKeys().map(virtualModelKeyToDto) });
          return;
        }
        if (method === "POST" && segments.length === 2) {
          try {
            const body = await readJson(request) as Record<string, unknown>;
            if (!isVirtualModelKeyStatus(body.status) || typeof body.ownerKind !== "string" || typeof body.ownerId !== "string" || typeof body.displayName !== "string") {
              sendJson(response, 400, { error: "invalid_virtual_model_key", message: "ownerKind, ownerId, displayName, and status are required." });
              return;
            }
            const allowedProviderKinds = Array.isArray(body.allowedProviderKinds)
              ? body.allowedProviderKinds.filter(isLlmProviderKind)
              : [];
            const allowedModelIds = Array.isArray(body.allowedModelIds)
              ? body.allowedModelIds.filter((value): value is string => typeof value === "string")
              : [];
            const key = llmService.createVirtualKey({
              ownerKind: body.ownerKind as "user" | "team" | "project" | "system",
              ownerId: body.ownerId,
              displayName: body.displayName,
              allowedProviderKinds,
              allowedModelIds,
              monthlyBudgetUsd: typeof body.monthlyBudgetUsd === "number" ? body.monthlyBudgetUsd : undefined,
              perTaskBudgetUsd: typeof body.perTaskBudgetUsd === "number" ? body.perTaskBudgetUsd : undefined,
              rpmLimit: typeof body.rpmLimit === "number" ? body.rpmLimit : undefined,
              tpmLimit: typeof body.tpmLimit === "number" ? body.tpmLimit : undefined,
              status: body.status
            });
            sendJson(response, 201, { virtualKey: virtualModelKeyToDto(key) });
          } catch (error) {
            sendJson(response, 400, { error: "invalid_virtual_model_key", message: error instanceof Error ? error.message : "Invalid virtual model key." });
          }
          return;
        }
        if (method === "PATCH" && segments.length === 4 && segments[3] === "status") {
          const body = await readJson(request) as Record<string, unknown>;
          if (!isVirtualModelKeyStatus(body.status)) {
            sendJson(response, 400, { error: "invalid_virtual_model_key_status", message: "status must be active or disabled." });
            return;
          }
          try {
            sendJson(response, 200, { virtualKey: virtualModelKeyToDto(llmService.updateVirtualKeyStatus(segments[2], body.status)) });
          } catch (error) {
            sendJson(response, 404, { error: "virtual_model_key_not_found", message: error instanceof Error ? error.message : "Virtual model key not found." });
          }
          return;
        }
      }

      if (method === "POST" && segments[1] === "route") {
        const body = await readJson(request) as Record<string, unknown>;
        const taskId = stringValue(body.taskId);
        const taskRunId = stringValue(body.taskRunId);
        const prompt = stringValue(body.prompt);
        if (!taskId || !taskRunId || !prompt) {
          sendJson(response, 400, { error: "invalid_llm_route", message: "taskId, taskRunId, and prompt are required." });
          return;
        }
        const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
        const route = llmService.routeRequest({
          taskId,
          taskRunId,
          actorId: requestContext.authContext.actor.id,
          principalId: requestContext.authContext.principal.id,
          authContext: requestContext.authContext,
          requestContext,
          modelRef: stringValue(body.modelRef),
          providerId: stringValue(body.providerId),
          providerKind: isLlmProviderKind(body.providerKind) ? body.providerKind : undefined,
          virtualKeyId: stringValue(body.virtualKeyId),
          promptClass: llmPromptClassValue(body.promptClass),
          requestedCapabilities: Array.isArray(body.requestedCapabilities) ? body.requestedCapabilities.filter((value): value is string => typeof value === "string") : undefined,
          maxFallbackAttempts: typeof body.maxFallbackAttempts === "number" ? body.maxFallbackAttempts : undefined,
          prompt,
          budgetLimitUsd: typeof body.budgetLimitUsd === "number" ? body.budgetLimitUsd : undefined,
          metadata: {
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            source: requestContext.source
          }
        });
        sendJson(response, route.ok ? 200 : 409, {
          ok: route.ok,
          model: route.model ? llmModelToDto(route.model) : undefined,
          route: route.route ? llmRouteToDto(route.route) : undefined,
          budgetDecision: route.budgetDecision ? budgetDecisionToDto(route.budgetDecision) : undefined,
          routingDecision: route.routingDecision ? llmRoutingDecisionToDto(route.routingDecision) : undefined,
          reason: route.reason
        });
        return;
      }

      if (method === "POST" && segments[1] === "completions") {
        const body = await readJson(request) as Record<string, unknown>;
        const taskId = stringValue(body.taskId);
        const taskRunId = stringValue(body.taskRunId);
        const prompt = stringValue(body.prompt);
        if (!taskId || !taskRunId || !prompt) {
          sendJson(response, 400, { error: "invalid_llm_completion", message: "taskId, taskRunId, and prompt are required." });
          return;
        }
        const requestContext = context.apiRequestContextMiddleware.requireApiContext(request);
        const result = await llmService.routeCompletion({
          taskId,
          taskRunId,
          actorId: requestContext.authContext.actor.id,
          principalId: requestContext.authContext.principal.id,
          authContext: requestContext.authContext,
          requestContext,
          modelRef: stringValue(body.modelRef),
          providerId: stringValue(body.providerId),
          providerKind: isLlmProviderKind(body.providerKind) ? body.providerKind : undefined,
          virtualKeyId: stringValue(body.virtualKeyId),
          promptClass: llmPromptClassValue(body.promptClass),
          requestedCapabilities: Array.isArray(body.requestedCapabilities) ? body.requestedCapabilities.filter((value): value is string => typeof value === "string") : undefined,
          maxFallbackAttempts: typeof body.maxFallbackAttempts === "number" ? body.maxFallbackAttempts : undefined,
          prompt,
          systemInstructions: stringValue(body.systemInstructions),
          maxTokens: typeof body.maxTokens === "number" ? body.maxTokens : undefined,
          temperature: typeof body.temperature === "number" ? body.temperature : undefined,
          budgetLimitUsd: typeof body.budgetLimitUsd === "number" ? body.budgetLimitUsd : undefined,
          repoId: stringValue(body.repoId),
          metadata: {
            ...recordValue(body.metadata),
            requestId: requestContext.requestId,
            correlationId: requestContext.correlationId,
            source: requestContext.source
          }
        });
        sendJson(response, result.ok ? 201 : 409, {
          ok: result.ok,
          result: result.result ? llmCompletionResultToDto(result.result) : undefined,
          usageEvent: result.usageEvent,
          budgetDecision: result.budgetDecision ? budgetDecisionToDto(result.budgetDecision) : undefined,
          routingDecision: result.routingDecision ? llmRoutingDecisionToDto(result.routingDecision) : undefined,
          fallbackAttempts: result.fallbackAttempts?.map(llmRoutingDecisionToDto),
          reason: result.reason
        });
        return;
      }

      if (method === "GET" && segments[1] === "usage") {
        sendJson(response, 200, { usageEvents: llmService.listUsageEvents() });
        return;
      }

      if (method === "GET" && segments[1] === "audit") {
        sendJson(response, 200, { auditEvents: llmService.listAuditEvents().map(llmAuditEventToDto) });
        return;
      }
    }

    if (segments[0] === "repos") {
      if (method === "POST" && segments.length === 1) {
        sendJson(response, 201, store.createRepo(await readJson(request)) as unknown as JsonValue);
        return;
      }
      if (method === "GET" && segments.length === 1) {
        sendJson(response, 200, { repos: store.listRepos() });
        return;
      }
      const repoId = segments[1];
      if (method === "GET" && segments.length === 2 && repoId) {
        sendJson(response, 200, store.getRepo(repoId) ?? notFound("repo", repoId) as unknown as JsonValue);
        return;
      }
      if (method === "GET" && segments[2] === "branches" && repoId) {
        sendJson(response, 200, {
          branches: store.listBranchLeases(repoId).map((lease) => ({
            branchName: lease.branchName,
            taskId: lease.taskId,
            status: lease.status
          }))
        });
        return;
      }
    }

    if (method === "GET" && url.pathname === "/skills") {
      sendJson(response, 200, { skills: registryService.listSkills().map(skillToDto) });
      return;
    }
    if (method === "GET" && url.pathname === "/harnesses") {
      sendJson(response, 200, { harnesses: registryService.listHarnesses().map(harnessToDto) });
      return;
    }
    if (method === "GET" && url.pathname === "/instructions") {
      sendJson(response, 200, { instructions: registryService.listInstructions().map(instructionToDto) });
      return;
    }
    if (method === "GET" && url.pathname === "/usage/events") {
      sendJson(response, 200, { usageEvents: store.listUsageEvents() });
      return;
    }
    if (method === "GET" && url.pathname === "/usage") {
      const taskId = url.searchParams.get("taskId") ?? undefined;
      sendJson(response, 200, {
        usageEvents: store.listUsageEvents().filter((event) => taskId === undefined || event.taskId === taskId)
      });
      return;
    }
    if (method === "GET" && url.pathname === "/audit-logs") {
      sendJson(response, 200, { auditLogs: store.listAuditLogs() });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    if (error instanceof AichestraError) {
      const statusCode = error.code === "not_found" ? 404 : error.code === "conflict" ? 409 : 400;
      sendJson(response, statusCode, {
        error: error.code,
        message: error.message
      });
      return;
    }
    sendJson(response, 500, {
      error: "internal_error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export function createApiServer(store: InMemoryAichestraStore = createSeededStore()) {
  const storage = createInMemoryStorageProvider({ store, repoRoot: process.cwd() });
  return createApiServerWithStorage(storage);
}

export type ApiServerOverrides = {
  llmGatewayService?: LLMGatewayService;
};

export function createApiServerWithStorage(storage: StorageProvider, overrides: ApiServerOverrides = {}) {
  const store = storage.repositoryFactory.createDataStore();
  const policyService = new PolicyService();
  const authRepository = new InMemoryAuthRepository();
  const productionAuthProviderRegistry = new ProductionAuthProviderRegistry({
    env: process.env,
    repository: authRepository
  });
  const authorizationService = new AuthorizationService({
    repository: authRepository,
    provider: new MockAuthProvider({ repository: authRepository }),
    policyService,
    productionAuthProviderRegistry
  });
  const requestContextResolver = new RequestContextResolver(authorizationService);
  const apiRequestContextMiddleware = new ApiRequestContextMiddleware({ resolver: requestContextResolver });
  const serviceAccountContextFactory = new ServiceAccountContextFactory({ authorizationService });
  const securityService = new SecurityControlService({ policyService, authorizationService, serviceAccountContextFactory });
  const localAgentProtocolService = new LocalAgentProtocolService({ policyService, securityService });
  const providerAbstractionService = new ProviderAbstractionService({ policyService, localAgentProtocolService });
  const tenantScopeEnforcementService = createTenantScopeEnforcementService();
  const registryTenantScopeEnforcementService = createRegistryTenantScopeEnforcementService({
    tenantScopeEnforcementService,
    policyEvaluator: (input) => {
      const subject = createPolicySubject({
        actorId: input.context.actorId ?? "registry_scope_service",
        principalId: input.context.principalId,
        serviceAccountId: input.context.serviceAccountId,
        actorKind: input.context.serviceAccountId ? "service_account" : "user",
        roles: input.context.roles?.length ? input.context.roles : ["system"],
        tenantIds: input.context.tenantId ? [input.context.tenantId] : undefined,
        teamIds: input.context.teamId ? [input.context.teamId] : undefined,
        projectIds: input.context.projectId ? [input.context.projectId] : undefined,
        resourceScopes: input.context.resourceScopes,
        requestId: input.context.requestId,
        correlationId: input.context.correlationId,
        source: input.context.source,
        isMockActor: true
      });
      const decision = policyService.evaluate({
        subject,
        resource: createPolicyResource({
          resourceKind: "registry_scope",
          resourceId: input.resourceId ?? "registry_scope",
          tenantId: input.context.tenantId,
          teamId: input.context.teamId,
          projectId: input.context.projectId,
          metadata: {
            registryResourceKind: input.resourceKind,
            ...(input.metadata ?? {})
          }
        }),
        action: input.action,
        context: createPolicyContext({
          environment: {
            metadataOnly: true,
            productionEnforcement: false,
            resolverGatesPreserved: true,
            registryMutationExecuted: false,
            activeRegistryMutationThroughAutoImprovement: false,
            externalCallExecuted: false
          },
          metadata: {
            registryResourceKind: input.resourceKind,
            registryResourceId: input.resourceId,
            ...(input.metadata ?? {})
          }
        })
      });
      return {
        decision: decision.decision,
        matchedRuleIds: decision.matchedRuleIds,
        reason: decision.reason
      };
    }
  });
  const registryArtifactTrustService = createRegistryArtifactTrustService({
    policyEvaluator: (input) => {
      const subject = createPolicySubject({
        actorId: input.context.actorId ?? "registry_artifact_trust_service",
        principalId: input.context.principalId,
        serviceAccountId: input.context.serviceAccountId,
        actorKind: input.context.serviceAccountId ? "service_account" : "user",
        roles: input.context.roles?.length ? input.context.roles : ["system"],
        resourceScopes: input.context.resourceScopes,
        requestId: input.context.requestId,
        correlationId: input.context.correlationId,
        source: input.context.source,
        isMockActor: true
      });
      const decision = policyService.evaluate({
        subject,
        resource: createPolicyResource({
          resourceKind: "registry_artifact_trust",
          resourceId: input.artifactId ?? "registry_artifact_trust",
          metadata: {
            ...(input.metadata ?? {}),
            artifactTrustMetadataOnly: true
          }
        }),
        action: input.action,
        context: createPolicyContext({
          environment: {
            metadataOnly: true,
            resolverGatesPreserved: true,
            registryMutationExecuted: false,
            activeRegistryMutationThroughAutoImprovement: false,
            realSigningImplemented: false,
            realVerificationImplemented: false,
            realSigningPerformed: false,
            realSignatureVerificationPerformed: false,
            signingKeyGenerated: false,
            externalBuildSystemCalled: false,
            externalRegistryCalls: false,
            externalCallExecuted: false
          },
          metadata: {
            artifactId: input.artifactId,
            ...(input.metadata ?? {})
          }
        })
      });
      return {
        decision: decision.decision,
        matchedRuleIds: decision.matchedRuleIds,
        reason: decision.reason
      };
    }
  });
  const registryService = createRegistryService({
    ...storage.repositoryFactory.createRegistryRepositories(),
    authorizer: new PolicyBackedRegistryMutationAuthorizer({ policyService }),
    scopeEnforcementService: registryTenantScopeEnforcementService,
    artifactTrustService: registryArtifactTrustService
  });
  const registryCompatibilityService = createRegistryCompatibilityService({
    registry: {
      listSkills: () => registryService.listSkills(),
      listHarnesses: () => registryService.listHarnesses(),
      listInstructions: () => registryService.listInstructions()
    },
    policyEvaluator: (input) => {
      const subject = createPolicySubject({
        actorId: input.context.actorId,
        principalId: input.context.principalId,
        serviceAccountId: input.context.serviceAccountId,
        actorKind: input.context.serviceAccountId ? "service_account" : "user",
        roles: ["system"]
      });
      const decision = policyService.evaluate({
        subject,
        resource: createPolicyResource({ resourceKind: "registry_compatibility", resourceId: input.candidateId ?? "registry_compatibility" }),
        action: input.action,
        context: {
          metadata: {
            registryMutationExecuted: false,
            autoApplyEnabled: false,
            externalCallExecuted: false,
            resolverGatesPreserved: true,
            ...(input.metadata ?? {})
          },
          environment: {
            metadataOnly: true,
            registryMutationExecuted: false,
            autoApplyEnabled: false,
            resolverGatesPreserved: true,
            externalCallExecuted: false
          }
        }
      });
      return {
        decision: decision.decision,
        matchedRuleIds: decision.matchedRuleIds,
        reason: decision.reason
      };
    }
  });
  const registryDriftDetectionService = createRegistryDriftDetectionService({
    dataSource: {
      listSkills: () => registryService.listSkills(),
      listHarnesses: () => registryService.listHarnesses(),
      listInstructions: () => registryService.listInstructions()
    },
    policyEvaluator: (input) => {
      const subject = createPolicySubject({
        actorId: input.context.actorId,
        principalId: input.context.principalId,
        serviceAccountId: input.context.serviceAccountId,
        actorKind: input.context.serviceAccountId ? "service_account" : "user",
        roles: ["system"]
      });
      const decision = policyService.evaluate({
        subject,
        resource: createPolicyResource({ resourceKind: "registry_drift", resourceId: input.targetId ?? "registry_drift" }),
        action: input.action,
        context: {
          metadata: {
            registryMutationExecuted: false,
            autoApplyEnabled: false,
            evalExecuted: false,
            canaryExecuted: false,
            externalCallExecuted: false,
            resolverGatesPreserved: true,
            ...(input.metadata ?? {})
          },
          environment: {
            metadataOnly: true,
            registryMutationExecuted: false,
            autoApplyEnabled: false,
            evalExecuted: false,
            canaryExecuted: false,
            resolverGatesPreserved: true,
            externalCallExecuted: false
          }
        }
      });
      return {
        decision: decision.decision,
        matchedRuleIds: decision.matchedRuleIds,
        reason: decision.reason
      };
    }
  });
  const improvementServices = createImprovementServices(storage.repositoryFactory.createImprovementRepositories(), { policyService });
  const evalSuiteExecutionService = createEvalSuiteExecutionService({
    dataSource: {
      getTarget: (targetKind, targetId) => registryEvalTargetFromServices(registryService, improvementServices, targetKind, targetId),
      listTargets: () => [
        ...registryService.listSkills().map((target) => registryEvalTargetFromServices(registryService, improvementServices, "skill", target.id)),
        ...registryService.listHarnesses().map((target) => registryEvalTargetFromServices(registryService, improvementServices, "harness", target.id)),
        ...registryService.listInstructions().map((target) => registryEvalTargetFromServices(registryService, improvementServices, "instruction", target.id)),
        ...registryService.listPackageManifests().map((target) => registryEvalTargetFromServices(registryService, improvementServices, "registry_package", target.id))
      ].filter((target): target is RegistryEvalTargetSnapshot => target !== undefined),
      attachRegistryEvalResult: (input) => registryService.attachEvalResult(input.targetKind, input.targetId, {
        evalName: input.evalName,
        evalType: "mock",
        status: input.status,
        score: input.score,
        maxScore: input.maxScore,
        summary: input.summary,
        details: input.details,
        source: "mock",
        artifactRef: input.artifactRef,
        updateEvalStatus: input.updateEvalStatus,
        actorId: input.context?.actorId,
        requestContext: input.context?.requestContext,
        authContext: input.context?.authContext,
        metadata: {
          ...(input.metadata ?? {}),
          evalSuiteHarnessMetadataOnly: true,
          noExternalProviderCall: true,
          noActiveRegistryContentMutation: true,
          noAutoApply: true
        }
      }),
      attachProposalEvalRun: (input) => improvementServices.proposalEvalRuns.attachEvalRun({
        proposalId: input.proposalId,
        evalRequirementId: input.evalRequirementId,
        status: input.status,
        summary: input.summary,
        score: input.score,
        maxScore: input.maxScore,
        requestContext: input.context?.requestContext,
        authContext: input.context?.authContext,
        metadata: {
          ...(input.metadata ?? {}),
          evalSuiteHarnessMetadataOnly: true,
          noExternalProviderCall: true,
          noCanaryExecution: true,
          noAutoApply: true
        }
      })
    },
    policyEvaluator: (input) => {
      const subject = createPolicySubject({
        actorId: input.context.actorId ?? "registry_eval_suite_service",
        principalId: input.context.principalId,
        serviceAccountId: input.context.serviceAccountId,
        actorKind: input.context.serviceAccountId ? "service_account" : "user",
        roles: input.context.roles?.length ? input.context.roles : ["system", "registry_reviewer"],
        resourceScopes: input.context.resourceScopes,
        requestId: input.context.requestId,
        correlationId: input.context.correlationId,
        source: input.context.source,
        isMockActor: true,
        metadata: {
          ...(input.context.metadata ?? {}),
          metadataOnly: true,
          mockExecutionOnly: true,
          externalEvalImplemented: false
        }
      });
      const decision = policyService.evaluate({
        subject,
        resource: createPolicyResource({
          resourceKind: "registry_eval_suite",
          resourceId: input.runId ?? input.suiteId ?? input.targetId ?? "registry_eval_suite",
          metadata: {
            ...(input.metadata ?? {}),
            suiteId: input.suiteId,
            runId: input.runId,
            targetKind: input.targetKind,
            targetId: input.targetId,
            registryMutationExecuted: false,
            activeRegistryMutationThroughAutoImprovement: false
          }
        }),
        action: input.action,
        context: createPolicyContext({
          environment: {
            metadataOnly: true,
            mockExecutionOnly: true,
            externalEvalImplemented: false,
            realProviderCalls: false,
            llmCallsExecuted: false,
            mcpCallsExecuted: false,
            vendorCliExecuted: false,
            canaryExecuted: false,
            autoApplyEnabled: false,
            activeRegistryMutationExecuted: false,
            externalCallExecuted: false,
            secretsExposed: false,
            envValuesExposed: false
          },
          metadata: {
            ...(input.metadata ?? {}),
            suiteId: input.suiteId,
            runId: input.runId,
            targetKind: input.targetKind,
            targetId: input.targetId
          }
        })
      });
      return {
        decision: decision.decision,
        matchedRuleIds: decision.matchedRuleIds,
        reason: decision.reason
      };
    }
  });
  const canaryApplyPolicyEvaluator = (resourceKind: "registry_canary" | "registry_apply_workflow") =>
    (input: import("@aichestra/registry").RegistryCanaryApplyPolicyEvaluationInput): import("@aichestra/registry").RegistryCanaryApplyPolicyDecisionSnapshot => {
      const subject = createPolicySubject({
        actorId: input.context.actorId,
        principalId: input.context.principalId,
        serviceAccountId: input.context.serviceAccountId,
        actorKind: input.context.serviceAccountId ? "service_account" : "user",
        roles: ["system"]
      });
      const decision = policyService.evaluate({
        subject,
        resource: createPolicyResource({ resourceKind, resourceId: input.resourceId ?? resourceKind }),
        action: input.action,
        context: {
          metadata: {
            autoApplyEnabled: false,
            activeRegistryMutationAllowed: false,
            externalCanaryExecuted: false,
            realProviderCallExecuted: false,
            applyPerformed: false,
            activeRegistryMutated: false,
            ...(input.metadata ?? {})
          },
          environment: {
            metadataOnly: true,
            autoApplyEnabled: false,
            activeRegistryMutationAllowed: false,
            externalCanaryExecuted: false,
            realProviderCallExecuted: false,
            applyPerformed: false,
            activeRegistryMutated: false
          }
        }
      });
      return {
        decision: decision.decision,
        matchedRuleIds: decision.matchedRuleIds,
        reason: decision.reason
      };
    };
  const canaryApplyDataSource = {
    listEvalReferences: () => evalSuiteExecutionService.listEvalRuns().map((run) => ({
      evalRunId: run.id,
      status: (run.status === "passed" ? "pass" : run.status === "failed" ? "fail" : run.status === "skipped" ? "missing" : "missing") as "pass" | "fail" | "missing" | "future"
    })),
    listApprovalReferences: () => [] as { approvalId: string; status: "approved" | "missing" | "rejected" | "future" }[]
  };
  const { canaryService: canaryExecutionService, applyWorkflowService, getSummary: registryCanaryApplyGetSummary } = createCanaryAndApplyServices({
    dataSource: canaryApplyDataSource,
    policyEvaluator: (input) => {
      const resourceKind: "registry_canary" | "registry_apply_workflow" =
        input.action.startsWith("registry.canary.") ? "registry_canary" : "registry_apply_workflow";
      return canaryApplyPolicyEvaluator(resourceKind)(input);
    }
  });
  const recordLegacyCredentialFallback = (event: {
    providerId: string;
    purpose: string;
    envKey: string;
    reason: string;
    metadata: Record<string, unknown>;
  }) => {
    securityService.recordSecretAudit({
      eventType: "credential_legacy_env_fallback_used",
      targetId: event.providerId,
      result: "allowed",
      reason: event.reason,
      metadata: {
        ...event.metadata,
        providerId: event.providerId,
        purpose: event.purpose,
        envVarName: event.envKey
      }
    });
  };
  const git = createGitProviderFromEnv(process.env, {
    credentialResolver: (resolutionRequest) => {
      const resolved = securityService.resolveCredentialForInternalUse(resolutionRequest);
      return {
        ok: resolved.allowed,
        status: resolved.status,
        value: resolved.value,
        reason: resolved.blockedReason,
        credentialHandleId: resolved.credentialHandle?.id
      };
    },
    legacyCredentialFallbackAuditor: recordLegacyCredentialFallback
  });
  const githubAppRuntimeService = new GitHubAppRuntimeService({
    store,
    config: git.config.githubApp ?? createGitHubAppRuntimeConfigFromEnv(process.env),
    policyService,
    actorId: "github_app_token_service",
    authorizationChecker: (authorizationRequest) => {
      const actorId = authorizationRequest.actorId && authorizationRequest.actorId !== "mock-git-actor"
        ? authorizationRequest.actorId
        : "github_app_token_service";
      const authContext = actorId === "github_app_token_service"
        ? serviceAccountContextFactory.createServiceAccountAuthContext("github_app_token_service", {
          source: "system",
          metadata: { source: "github_app_runtime_service" }
        })
        : authorizationService.getAuthContext({ actorId, source: "system" });
      const decision = authorizationService.check({
        authContext,
        action: authorizationRequest.action,
        resource: {
          resourceKind: authorizationRequest.resourceKind,
          resourceId: authorizationRequest.resourceId,
          metadata: {
            providerKind: "github",
            privateKeyMaterialExposed: false
          }
        },
        policyContext: {
          providerKind: "github",
          environment: {
            ...authorizationRequest.policyContext,
            secretRefActive: true
          },
          metadata: {
            source: "github_app_runtime_service"
          }
        }
      });
      return {
        allowed: decision.allowed,
        reason: decision.reason,
        actorId: decision.actorId,
        principalId: decision.principalId,
        policyDecisionId: decision.policyDecision?.id,
        authorizationDecisionId: decision.auditEvent?.id
      };
    },
    secretRefMetadataResolver: (secretRefId) => {
      const secretRef = securityService.getSecretMetadata(secretRefId);
      return secretRef
        ? {
          id: secretRef.id,
          secretKind: secretRef.secretKind,
          status: secretRef.status
        }
        : undefined;
    }
  });
  const gitIntegrationService = new GitIntegrationService({
    store,
    provider: git.provider,
    config: git.config,
    policyService,
    githubAppTokenIssuer: githubAppRuntimeService
  });
  const gitWebhook = createGitHubWebhookRuntimeFromEnv(process.env, {
    secretResolver: (resolutionRequest) => {
      const resolved = securityService.resolveCredentialForInternalUse(resolutionRequest);
      return {
        ok: resolved.allowed,
        status: resolved.status,
        value: resolved.value,
        reason: resolved.blockedReason,
        credentialHandleId: resolved.credentialHandle?.id
      };
    },
    legacySecretFallbackAuditor: recordLegacyCredentialFallback
  });
  const gitWebhookReceiverService = new GitWebhookReceiverService({
    store,
    gitIntegrationService,
    config: gitWebhook.config,
    verifier: gitWebhook.verifier,
    policyService
  });
  const llmGatewayService = overrides.llmGatewayService ?? createDefaultLlmGatewayService({
    usageRepository: store,
    policyService,
    authorizationService,
    credentialResolver: (resolutionRequest) => securityService.resolveCredentialForInternalUse(resolutionRequest),
    legacyCredentialFallbackAuditor: recordLegacyCredentialFallback
  });
  const mcpGatewayService = createDefaultMCPGateway({
    policyService,
    authorizationService,
    securityService
  });
  const deploymentReadinessService = createDeploymentReadinessService({
    staticPolicyRuleCount: policyService.getConfig().ruleCount
  });
  const tenantScopePlanningService = createDashboardReadinessTenantScopePlanningService();
  const dashboardScopeFilteringService = createDashboardScopeFilteringService();
  const agentRunnerConfig = createAgentRunnerConfigFromEnv();
  const agentRunnerRepositories = createInMemoryAgentRunnerRepositories();
  const agentRunnerWorkspaceManager = new LocalAgentWorkspaceManager({
    workspaceRoot: agentRunnerConfig.workspaceRoot,
    workspaceRepository: agentRunnerRepositories.workspaceRepository
  });
  const agentWorkspaceLifecycleService = new AgentWorkspaceLifecycleService({
    workspaceManager: agentRunnerWorkspaceManager
  });
  const agentRunner = agentRunnerConfig.runnerKind === "mock"
    ? new MockAgentRunner(llmGatewayService)
    : createAgentRunnerFromConfig(agentRunnerConfig, {
      llmGateway: llmGatewayService,
      commandResultRepository: agentRunnerRepositories.commandExecutionResultRepository,
      workspaceManager: agentRunnerWorkspaceManager
    });
  const agentRunnerService = new AgentRunnerService({
    runner: agentRunner,
    config: agentRunnerConfig,
    runRepository: agentRunnerRepositories.runRepository,
    auditRepository: agentRunnerRepositories.auditRepository,
    instructionAssemblyRepository: agentRunnerRepositories.instructionAssemblyRepository,
    commandExecutionResultRepository: agentRunnerRepositories.commandExecutionResultRepository,
    workspaceRepository: agentRunnerRepositories.workspaceRepository,
    workspaceLifecycleService: agentWorkspaceLifecycleService,
    policyService,
    securityService
  });
  const agentWorktreeAllocationService = createAgentWorktreeAllocationServiceFromEnv(process.env, {
    workspaceLifecycleService: agentWorkspaceLifecycleService,
    branchLeaseLookup: (branchLeaseId) => store.getBranchLease(branchLeaseId),
    workspaceLeaseLookup: (workspaceLeaseId) => agentRunnerService.getWorkspaceLease(workspaceLeaseId)
  });
  const agentRunCoordinationService = new AgentRunCoordinationService({
    repository: new InMemoryAgentRunCoordinationRepository(),
    branchLeaseLookup: (branchLeaseId) => store.getBranchLease(branchLeaseId),
    workspaceLookup: (workspaceLeaseId) => agentRunnerService.getWorkspaceLease(workspaceLeaseId)
  });
  const branchOrchestratorService = new BranchOrchestratorService({
    repository: new InMemoryBranchOrchestratorRepository(),
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
  const editIntentGraphService = new EditIntentGraphService();
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
        metadata: {
          workspacePathRedacted: true,
          metadataOnly: true
        }
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
      const byId = new Map([...coordinationOverlaps, ...editIntentOverlaps].map((overlap) => [overlap.id, overlap]));
      return [...byId.values()];
    },
    policyEvaluator: (input) => {
      const decision = policyService.evaluate({
        subject: createPolicySubject({
          actorId: input.context.actorId,
          actorKind: "system",
          roles: ["system", "reviewer", "developer"],
          serviceAccountId: input.context.serviceAccountId,
          requestId: input.context.requestId,
          correlationId: input.context.correlationId,
          source: "merge_queue_policy_service",
          metadata: { metadataOnly: true }
        }),
        action: input.action,
        resource: createPolicyResource({
          resourceKind: "merge_queue",
          resourceId: input.entry?.id,
          scopeKind: "repo",
          scopeId: input.entry?.repoId ?? input.lease?.repoId,
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
          metadata: {
            ...input.metadata,
            requestId: input.context.requestId,
            correlationId: input.context.correlationId
          }
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
  const conflictResolutionAssistantService = new ConflictResolutionAssistantService({
    dataSource: {
      getMergeSimulation: (mergeSimulationId) => store.listMergeSimulations().find((simulation) => simulation.id === mergeSimulationId),
      latestMergeSimulationForLease: (branchLeaseId) => store.latestMergeSimulationForLease(branchLeaseId),
      getMergeQueueEntry: (mergeQueueEntryId) => store.getMergeQueueEntry(mergeQueueEntryId),
      getConflictRisk: (conflictRiskId) => store.listRepos()
        .flatMap((repo) => store.computeRepoConflictRisks(repo.id))
        .find((risk) => risk.id === conflictRiskId),
      highestConflictRiskForLease: (branchLeaseId) => store.highestConflictRiskForLease(branchLeaseId),
      getBranchLease: (branchLeaseId) => store.getBranchLease(branchLeaseId),
      getWorkspaceLease: (workspaceLeaseId) => {
        const workspace = agentRunnerService.getWorkspaceLease(workspaceLeaseId);
        if (!workspace) return undefined;
        return {
          id: workspace.id,
          repoId: workspace.repoId,
          branchLeaseId: workspace.branchLeaseId,
          taskRunId: workspace.taskRunId,
          branchName: workspace.branchName,
          status: workspace.status,
          isolationStatus: workspace.isolationStatus,
          workspaceKind: workspace.workspaceKind,
          metadata: {
            workspacePathRedacted: true,
            metadataOnly: true
          }
        };
      },
      getEditOverlap: (editOverlapId) => {
        const overlap = editIntentGraphService.listOverlapAssessments().find((candidate) => candidate.id === editOverlapId);
        return overlap ? {
          id: overlap.id,
          repoId: overlap.repoId,
          sessionIds: overlap.sessionIds,
          overlapKind: overlap.overlapKind,
          files: overlap.files,
          directories: overlap.directories,
          severity: overlap.severity,
          recommendation: overlap.recommendation,
          reason: overlap.reason,
          metadata: overlap.metadata
        } : undefined;
      },
      listEditOverlapsForRequest: (conflictRequest) => {
        const files = new Set(conflictRequest.files);
        const directories = new Set(conflictRequest.files
          .map((filePath) => filePath.split("/").slice(0, -1).join("/"))
          .filter(Boolean));
        return editIntentGraphService.listOverlapAssessments({ repoId: conflictRequest.repoId })
          .filter((overlap) =>
            overlap.files.some((file) => files.has(file)) ||
            overlap.directories.some((directory) => directories.has(directory)) ||
            conflictRequest.editOverlapIds?.includes(overlap.id))
          .map((overlap) => ({
            id: overlap.id,
            repoId: overlap.repoId,
            sessionIds: overlap.sessionIds,
            overlapKind: overlap.overlapKind,
            files: overlap.files,
            directories: overlap.directories,
            severity: overlap.severity,
            recommendation: overlap.recommendation,
            reason: overlap.reason,
            metadata: overlap.metadata
          }));
      }
    }
  });
  const prOwnershipService = new PrOwnershipService({
    dataSource: {
      getBranchLease: (branchLeaseId) => store.getBranchLease(branchLeaseId),
      getMergeQueueEntry: (mergeQueueEntryId) => store.getMergeQueueEntry(mergeQueueEntryId),
      listMergeQueueEntries: (repoId) => store.listMergeQueueEntries(repoId),
      getPullRequest: (pullRequestId) => store.listPullRequests().find((pullRequest) => pullRequest.id === pullRequestId),
      getPullRequestSyncState: (repoId, pullRequestNumber) => store.getGitPullRequestSyncState(repoId, pullRequestNumber)
    },
    policyEvaluator: (input) => {
      const actorKind = policyActorKindValue(input.context.actorKind) ??
        (input.context.serviceAccountId ? "service_account" : "system");
      const repoId = input.ownership?.repoId ?? input.handoff?.repoId;
      const branchName = input.ownership?.branchName ?? input.handoff?.branchName;
      const futureAgentHandoff = input.metadata.handoffKind === "human_to_agent_future";
      const decision = policyService.evaluate({
        subject: createPolicySubject({
          actorId: input.context.actorId,
          principalId: input.context.principalId,
          actorKind,
          roles: input.context.roles?.length ? input.context.roles : ["system"],
          teams: input.context.teams,
          serviceAccountId: input.context.serviceAccountId,
          requestId: input.context.requestId,
          correlationId: input.context.correlationId,
          source: "pr_ownership_service",
          metadata: {
            metadataOnly: true,
            noRemotePrUpdate: true
          }
        }),
        action: input.action,
        resource: createPolicyResource({
          resourceKind: "pull_request",
          resourceId: input.ownership?.pullRequestId ?? input.handoff?.pullRequestId ?? input.ownership?.id ?? input.handoff?.id,
          scopeKind: "repo",
          scopeId: repoId,
          metadata: input.metadata
        }),
        context: createPolicyContext({
          taskId: input.ownership?.taskId,
          taskRunId: input.ownership?.taskRunId,
          repoId,
          branchName,
          environment: {
            metadataOnly: true,
            remotePrUpdate: false,
            remoteReviewerAssignment: false,
            githubApiCalls: false,
            autoMergeEnabled: false,
            branchDeletionEnabled: false,
            workspaceMutation: false,
            secretsExposed: false,
            envValuesExposed: false,
            futureAgentHandoff
          },
          metadata: {
            ...input.metadata,
            requestId: input.context.requestId,
            correlationId: input.context.correlationId
          }
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
  const realMergeExecutionPolicyService = new RealMergeExecutionPolicyService({
    dataSource: {
      getBranchLease: (branchLeaseId) => store.getBranchLease(branchLeaseId),
      getMergeQueueEntry: (mergeQueueEntryId) => store.getMergeQueueEntry(mergeQueueEntryId),
      latestMergeSimulationForLease: (branchLeaseId) => store.latestMergeSimulationForLease(branchLeaseId),
      getMergeSimulation: (mergeSimulationId) => store.listMergeSimulations().find((simulation) => simulation.id === mergeSimulationId),
      highestConflictRiskForLease: (branchLeaseId) => store.highestConflictRiskForLease(branchLeaseId),
      getWorkspaceLease: (workspaceLeaseId) => {
        const workspace = agentRunnerService.getWorkspaceLease(workspaceLeaseId);
        if (!workspace) return undefined;
        return {
          id: workspace.id,
          repoId: workspace.repoId,
          branchLeaseId: workspace.branchLeaseId,
          taskRunId: workspace.taskRunId,
          branchName: workspace.branchName,
          status: workspace.status,
          isolationStatus: workspace.isolationStatus,
          workspaceKind: workspace.workspaceKind,
          metadata: {
            workspacePathRedacted: true,
            metadataOnly: true
          }
        };
      },
      getWorktreeAllocation: (realMergeRequest) => {
        const allocation = agentWorktreeAllocationService.listAllocations({
          branchLeaseId: realMergeRequest.branchLeaseId,
          workspaceLeaseId: realMergeRequest.workspaceLeaseId
        }).at(-1);
        return allocation ? {
          id: allocation.id,
          requestId: allocation.requestId,
          workspaceLeaseId: allocation.workspaceLeaseId,
          branchLeaseId: allocation.branchLeaseId,
          branchName: allocation.branchName,
          decision: allocation.decision,
          metadata: {
            metadataOnly: true,
            worktreePathRedacted: true
          }
        } : undefined;
      },
      listEditOverlapsForRequest: (realMergeRequest) => {
        const requestFiles = Array.isArray(realMergeRequest.metadata.files)
          ? new Set(realMergeRequest.metadata.files.filter((file): file is string => typeof file === "string"))
          : new Set<string>();
        return editIntentGraphService.listOverlapAssessments({ repoId: realMergeRequest.repoId })
          .filter((overlap) =>
            requestFiles.size === 0 ||
            overlap.files.some((file) => requestFiles.has(file)))
          .map((overlap) => ({
            id: overlap.id,
            repoId: overlap.repoId,
            overlapKind: overlap.overlapKind,
            files: overlap.files,
            severity: overlap.severity,
            recommendation: overlap.recommendation,
            metadata: {
              source: "edit_intent_graph",
              reason: overlap.reason
            }
          }));
      },
      getConflictResolutionPlan: (planId) => {
        const plan = conflictResolutionAssistantService.getPlan(planId);
        return plan ? {
          id: plan.id,
          status: plan.status,
          applyAllowed: plan.applyAllowed,
          metadata: plan.metadata
        } : undefined;
      },
      getPrOwnershipReadiness: (realMergeRequest) => {
        if (realMergeRequest.mergeQueueEntryId) {
          const readiness = prOwnershipService.getMergeQueueOwnershipReadiness(realMergeRequest.mergeQueueEntryId);
          return readiness ? {
            status: readiness.status,
            ownershipRecordId: readiness.ownershipRecordId,
            ownerActorId: readiness.ownerActorId,
            metadata: {
              mergeQueueEntryId: readiness.mergeQueueEntryId,
              branchName: readiness.branchName
            }
          } : undefined;
        }
        if (realMergeRequest.prOwnershipId) {
          const ownership = prOwnershipService.getOwnership(realMergeRequest.prOwnershipId);
          return ownership ? {
            status: ownership.status === "active" || ownership.status === "review_requested" || ownership.status === "handed_off"
              ? "owner_present"
              : `ownership_${ownership.status}`,
            ownershipRecordId: ownership.id,
            ownerActorId: ownership.ownerActorId,
            reviewerActorIds: ownership.reviewerActorIds,
            metadata: { branchName: ownership.branchName }
          } : undefined;
        }
        return undefined;
      },
      getMergeQueueReadiness: (mergeQueueEntryId) => {
        const decision = mergeQueuePolicyService.listDecisions({ queueEntryId: mergeQueueEntryId }).at(-1);
        return decision ? {
          decision: decision.decision,
          blockingReasons: decision.blockingReasons,
          warnings: decision.warnings,
          metadata: {
            decisionId: decision.id,
            mergeExecutionEnabled: false
          }
        } : undefined;
      }
    },
    policyEvaluator: (input) => {
      const decision = policyService.evaluate({
        subject: createPolicySubject({
          actorId: input.context.actorId,
          principalId: input.context.principalId,
          actorKind: input.context.serviceAccountId ? "service_account" : "system",
          roles: input.context.roles?.length ? input.context.roles : ["system", "reviewer", "developer"],
          teams: input.context.teams,
          serviceAccountId: input.context.serviceAccountId,
          requestId: input.context.requestId,
          correlationId: input.context.correlationId,
          source: "real_merge_execution_policy_service",
          metadata: {
            metadataOnly: true,
            mergeExecutionEnabled: false
          }
        }),
        action: input.action,
        resource: createPolicyResource({
          resourceKind: "merge_execution",
          resourceId: input.request.id,
          scopeKind: "repo",
          scopeId: input.request.repoId,
          metadata: input.metadata
        }),
        context: createPolicyContext({
          taskId: input.queueEntry?.taskId ?? input.lease?.taskId,
          taskRunId: input.queueEntry?.taskRunId ?? input.lease?.taskRunId,
          repoId: input.request.repoId,
          branchName: input.request.sourceBranch,
          environment: {
            metadataOnly: true,
            realMergeExecution: false,
            mergeExecutionEnabled: false,
            autoMergeEnabled: false,
            remotePushEnabled: false,
            remoteGitOperation: false,
            branchDeletionEnabled: false,
            workspaceMutation: false,
            secretsExposed: false,
            envValuesExposed: false
          },
          metadata: {
            ...input.metadata,
            requestId: input.context.requestId,
            correlationId: input.context.correlationId
          }
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
  const branchCleanupRecoveryService = new BranchCleanupRecoveryService({
    repository: new InMemoryBranchCleanupRecoveryRepository(),
    dataSource: {
      listBranchLeases: (repoId) => store.listBranchLeases(repoId),
      listWorkspaceLeases: (repoId) => agentRunnerService.listWorkspaceLeases({ repoId }).map((lease) => ({
        id: lease.id,
        taskId: lease.taskId,
        taskRunId: lease.taskRunId,
        agentRunId: lease.agentRunId,
        repoId: lease.repoId,
        branchLeaseId: lease.branchLeaseId,
        branchName: lease.branchName,
        workspacePath: lease.workspacePath,
        status: lease.status,
        isolationStatus: lease.isolationStatus,
        workspaceKind: lease.workspaceKind,
        expiresAt: lease.expiresAt,
        ownerActorId: lease.ownerActorId,
        ownerServiceAccountId: lease.ownerServiceAccountId,
        latestCleanupDecision: agentWorkspaceLifecycleService.getLatestCleanupDecision(lease.id)?.decision,
        metadata: { workspacePathRedacted: true }
      })),
      listMergeQueueEntries: (repoId) => store.listMergeQueueEntries(repoId),
      listBranchOwnership: (repoId) => branchOrchestratorService.listBranchOwnershipRecords({ repoId }).map((record) => ({
        id: record.id,
        repoId: record.repoId,
        branchName: record.branchName,
        branchLeaseId: record.branchLeaseId,
        workspaceLeaseId: record.workspaceLeaseId,
        ownerActorId: record.actorId,
        status: record.status,
        expiresAt: record.expiresAt
      })),
      listAgentSessions: (repoId) => agentRunCoordinationService.listSessions({ repoId }).map((session) => ({
        id: session.id,
        repoId: session.repoId,
        taskRunId: session.taskRunId,
        branchName: session.branchName,
        branchLeaseId: session.branchLeaseId,
        workspaceLeaseId: session.workspaceLeaseId,
        ownerActorId: session.userId,
        status: session.status,
        lastActivityAt: session.updatedAt
      })),
      listWorktreeAllocations: () => [],
      listPullRequestHandoffs: () => prOwnershipService.listHandoffs().map((handoff) => ({
        id: handoff.id,
        repoId: handoff.repoId,
        pullRequestId: handoff.pullRequestId ?? handoff.ownershipRecordId,
        fromActorId: handoff.fromActorId,
        toActorId: handoff.toActorId ?? handoff.toTeamId ?? handoff.toServiceAccountId,
        status: handoff.status === "accepted" || handoff.status === "rejected" || handoff.status === "expired"
          ? handoff.status
          : "pending",
        expiresAt: handoff.expiresAt
      })),
      getTaskStatus: (taskId) => {
        const task = store.getTask(taskId);
        return task ? { taskId: task.id, status: task.status } : undefined;
      }
    }
  });
  const observabilityService = createObservabilityService({
    sourceProvider: () => ({
      coreAuditLogs: store.listAuditLogs().filter((event) => !event.action.startsWith("git.")),
      authAuditEvents: authorizationService.listAuditEvents(),
      policyAuditEntries: policyService.listAuditEntries(),
      securityAuditEvents: securityService.listAuditEvents(),
      gitAuditEvents: gitIntegrationService.listGitAuditEvents(),
      gitWebhookAuditEvents: gitWebhookReceiverService.listAuditEvents(),
      llmAuditEvents: llmGatewayService.listAuditEvents(),
      mcpAuditEvents: mcpGatewayService.listAuditEvents(),
      agentRunAuditEvents: agentRunnerService.listAuditEvents(),
      registryAuditLogs: registryService.listAuditLogs(),
      improvementGovernanceAuditEvents: improvementServices.governance.listAuditEvents(),
      localAgentAuditEvents: localAgentProtocolService.listAuditEvents(),
      providerAuditEvents: providerAbstractionService.listAuditEvents(),
      deploymentReadinessChecks: deploymentReadinessService.listChecks(),
      deploymentRisks: deploymentReadinessService.listRisks()
    })
  });
  const auditQueryScopeEnforcementService = createAuditQueryScopeEnforcementService();
  return createServer((request, response) => {
    void handleRequest(request, response, {
      store,
      storageProvider: storage,
      gitIntegrationService,
      branchOrchestratorService,
      gitProviderConfig: git.config,
      githubAppRuntimeService,
      githubAppRuntimeConfig: git.config.githubApp ?? createGitHubAppRuntimeConfigFromEnv(process.env),
      gitWebhookReceiverService,
      gitWebhookConfig: gitWebhook.config,
      llmGatewayService,
      agentRunnerService,
      agentRunCoordinationService,
      agentWorktreeAllocationService,
      mergeQueuePolicyService,
      conflictResolutionAssistantService,
      prOwnershipService,
      realMergeExecutionPolicyService,
      registryCompatibilityService,
      registryArtifactTrustService,
      evalSuiteExecutionService,
      registryDriftDetectionService,
      canaryExecutionService,
      applyWorkflowService,
      registryCanaryApplyGetSummary,
      registryTenantScopeEnforcementService,
      branchCleanupRecoveryService,
      editIntentGraphService,
      agentRunnerConfig,
      registryService,
      improvementServices,
      policyService,
      authorizationService,
      requestContextResolver,
      apiRequestContextMiddleware,
      providerAbstractionService,
      securityService,
      localAgentProtocolService,
      mcpGatewayService,
      deploymentReadinessService,
      tenantScopePlanningService,
      dashboardScopeFilteringService,
      tenantScopeEnforcementService,
      observabilityService,
      auditQueryScopeEnforcementService
    });
  });
}

export function createApiStorageProviderFromEnv(env: Record<string, string | undefined> = process.env): StorageProvider {
  if (env.AICHESTRA_STORAGE_PROVIDER === "postgres") {
    return createPostgresStorageProviderFromEnv(env);
  }
  return createInMemoryStorageProvider({ repoRoot: process.cwd() });
}

function isMain(): boolean {
  return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
}

async function start(): Promise<void> {
  const host = process.env.AICHESTRA_API_HOST ?? "127.0.0.1";
  const port = Number(process.env.AICHESTRA_API_PORT ?? "3000");
  const storage = createApiStorageProviderFromEnv();
  const health = await storage.healthCheck();
  if (!health.healthy) {
    throw new Error(`Storage provider ${health.kind} is not healthy: ${health.message}`);
  }
  activeApiServer = createApiServerWithStorage(storage);
  activeApiServer.listen(port, host, () => {
    console.log(`aichestra-api listening on http://${host}:${port}`);
  });
}

if (isMain()) {
  void start().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
