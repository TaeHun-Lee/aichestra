import path from "node:path";
import { createId } from "../domain/ids.ts";
import type {
  BranchLease,
  ConflictRisk,
  ConflictRiskLevel,
  MergeQueueEntry,
  MergeSimulationResult
} from "../domain/models.ts";

export type ConflictKind =
  | "same_file_edit"
  | "same_directory_refactor"
  | "rename_modify_future"
  | "delete_modify_future"
  | "generated_file"
  | "dependency_lockfile"
  | "unknown";

export type ConflictSeverity = "low" | "medium" | "high" | "critical";

export type ConflictResolutionPlanStatus = "draft" | "review_required" | "blocked" | "future_apply";

export type ConflictResolutionStrategy =
  | "manual_review"
  | "choose_branch_a"
  | "choose_branch_b"
  | "combine_changes"
  | "split_commits_future"
  | "rerun_agent_future"
  | "human_resolution_required";

export type ConflictResolutionRecommendationKind =
  | "review_file"
  | "run_test"
  | "request_human_review"
  | "rerun_dry_merge"
  | "split_work"
  | "defer_branch"
  | "update_merge_queue_hold";

export type ConflictResolutionRequestContext = {
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type ConflictAssistantWorkspaceSnapshot = {
  id: string;
  repoId?: string;
  branchLeaseId?: string;
  taskRunId?: string;
  branchName?: string;
  status?: string;
  isolationStatus?: string;
  workspaceKind?: string;
  metadata?: Record<string, unknown>;
};

export type ConflictAssistantEditOverlapSnapshot = {
  id: string;
  repoId: string;
  sessionIds?: string[];
  sessionAId?: string;
  sessionBId?: string;
  overlapKind: string;
  files: string[];
  directories?: string[];
  severity: string;
  recommendation: string;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type ConflictResolutionRequest = {
  id: string;
  repoId: string;
  baseBranch: string;
  sourceBranch: string;
  targetBranch: string;
  mergeSimulationId?: string;
  mergeQueueEntryId?: string;
  conflictRiskId?: string;
  branchLeaseIds: string[];
  workspaceLeaseIds?: string[];
  editOverlapIds?: string[];
  files: string[];
  createdAt: Date;
  requestContext?: ConflictResolutionRequestContext;
  metadata: Record<string, unknown>;
};

export type ConflictSummary = {
  id: string;
  requestId: string;
  repoId: string;
  branches: {
    baseBranch: string;
    sourceBranch: string;
    targetBranch: string;
  };
  conflictFiles: string[];
  conflictKind: ConflictKind;
  severity: ConflictSeverity;
  likelyCause: string;
  affectedAreas: string[];
  metadata: Record<string, unknown>;
};

export type ConflictResolutionPlan = {
  id: string;
  requestId: string;
  status: ConflictResolutionPlanStatus;
  strategy: ConflictResolutionStrategy;
  steps: string[];
  suggestedValidation: string[];
  suggestedTests: string[];
  risks: string[];
  applyAllowed: false;
  metadata: Record<string, unknown>;
};

export type ConflictResolutionRecommendation = {
  id: string;
  planId: string;
  recommendationKind: ConflictResolutionRecommendationKind;
  reason: string;
  priority: number;
  metadata: Record<string, unknown>;
};

export type CreateConflictResolutionRequestInput = {
  id?: string;
  repoId: string;
  baseBranch: string;
  sourceBranch: string;
  targetBranch?: string;
  mergeSimulationId?: string;
  mergeQueueEntryId?: string;
  conflictRiskId?: string;
  branchLeaseIds?: string[];
  workspaceLeaseIds?: string[];
  editOverlapIds?: string[];
  files?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

export type ConflictResolutionAssistantSummary = {
  repoId?: string;
  status: "v1_implemented";
  requests: number;
  activeRequests: number;
  summaries: number;
  plans: number;
  recommendations: number;
  highestSeverity?: ConflictSeverity;
  reviewRequiredPlans: number;
  blockedPlans: number;
  mergeQueueLinkedPlans: number;
  applyAllowed: false;
  realLlmUsed: false;
  sourceMutation: false;
  mergeExecution: false;
  patchApplication: false;
  externalProviderCalls: false;
  secretsExposed: false;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type ConflictResolutionAssistantDataSource = {
  getMergeSimulation?(id: string): MergeSimulationResult | undefined;
  latestMergeSimulationForLease?(leaseId: string): MergeSimulationResult | undefined;
  getMergeQueueEntry?(id: string): MergeQueueEntry | undefined;
  getConflictRisk?(id: string): ConflictRisk | undefined;
  highestConflictRiskForLease?(leaseId: string): ConflictRisk | undefined;
  getBranchLease?(id: string): BranchLease | undefined;
  getWorkspaceLease?(id: string): ConflictAssistantWorkspaceSnapshot | undefined;
  getEditOverlap?(id: string): ConflictAssistantEditOverlapSnapshot | undefined;
  listEditOverlapsForRequest?(request: ConflictResolutionRequest): ConflictAssistantEditOverlapSnapshot[];
};

export type ConflictResolutionAssistantServiceOptions = {
  dataSource?: ConflictResolutionAssistantDataSource;
  now?: () => Date;
};

type ConflictEvidence = {
  mergeQueueEntry?: MergeQueueEntry;
  simulations: MergeSimulationResult[];
  conflictRisks: ConflictRisk[];
  branchLeases: BranchLease[];
  workspaces: ConflictAssistantWorkspaceSnapshot[];
  editOverlaps: ConflictAssistantEditOverlapSnapshot[];
};

const severityRank: Record<ConflictSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const conflictRiskSeverity: Record<ConflictRiskLevel, ConflictSeverity> = {
  none: "low",
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical"
};

const editOverlapSeverity: Record<string, ConflictSeverity> = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical"
};

const validConflictKinds = new Set<ConflictKind>([
  "same_file_edit",
  "same_directory_refactor",
  "rename_modify_future",
  "delete_modify_future",
  "generated_file",
  "dependency_lockfile",
  "unknown"
]);

export class ConflictResolutionAssistantService {
  private readonly dataSource: ConflictResolutionAssistantDataSource;
  private readonly now: () => Date;
  private readonly requests: ConflictResolutionRequest[] = [];
  private readonly summaries: ConflictSummary[] = [];
  private readonly plans: ConflictResolutionPlan[] = [];
  private readonly recommendations: ConflictResolutionRecommendation[] = [];

  constructor(options: ConflictResolutionAssistantServiceOptions = {}) {
    this.dataSource = options.dataSource ?? {};
    this.now = options.now ?? (() => new Date());
  }

  createRequest(input: CreateConflictResolutionRequestInput, context: ConflictResolutionRequestContext = {}): ConflictResolutionRequest {
    const initialRequest: ConflictResolutionRequest = {
      id: input.id ?? createId("conflictreq"),
      repoId: input.repoId,
      baseBranch: input.baseBranch,
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch ?? input.baseBranch,
      mergeSimulationId: input.mergeSimulationId,
      mergeQueueEntryId: input.mergeQueueEntryId,
      conflictRiskId: input.conflictRiskId,
      branchLeaseIds: uniqueStrings(input.branchLeaseIds ?? []),
      workspaceLeaseIds: uniqueStrings(input.workspaceLeaseIds ?? []),
      editOverlapIds: uniqueStrings(input.editOverlapIds ?? []),
      files: normalizeFilePaths(input.files ?? []),
      createdAt: input.createdAt ?? this.now(),
      requestContext: sanitizeContext(context),
      metadata: sanitizeMetadata({
        ...input.metadata,
        ...contextMetadata(context),
        status: "v1_implemented",
        metadataOnly: true,
        noSourceMutation: true,
        noPatchApply: true,
        noRealMerge: true,
        noExternalLlmCall: true
      })
    };
    const evidence = this.evidenceForRequest(initialRequest);
    const request = this.withDerivedEvidence(initialRequest, evidence);
    this.replaceRequest(request);
    return clone(request);
  }

  getRequest(requestId: string): ConflictResolutionRequest | undefined {
    return clone(this.requests.find((request) => request.id === requestId));
  }

  listRequests(query: { repoId?: string } = {}): ConflictResolutionRequest[] {
    return this.requests
      .filter((request) => query.repoId === undefined || request.repoId === query.repoId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((request) => clone(request));
  }

  summarizeConflict(requestId: string, context: ConflictResolutionRequestContext = {}): ConflictSummary {
    const request = this.requireRequest(requestId);
    const evidence = this.evidenceForRequest(request);
    const files = conflictFilesFor(request, evidence);
    const conflictKind = classifyConflict(request, evidence, files);
    const severity = classifySeverity(request, evidence, conflictKind);
    const summary: ConflictSummary = {
      id: createId("conflictsum"),
      requestId: request.id,
      repoId: request.repoId,
      branches: {
        baseBranch: request.baseBranch,
        sourceBranch: request.sourceBranch,
        targetBranch: request.targetBranch
      },
      conflictFiles: files,
      conflictKind,
      severity,
      likelyCause: likelyCause(conflictKind, evidence),
      affectedAreas: affectedAreas(files, conflictKind),
      metadata: sanitizeMetadata({
        ...contextMetadata(context),
        mergeSimulationIds: evidence.simulations.map((simulation) => simulation.id),
        mergeSimulationStatuses: evidence.simulations.map((simulation) => simulation.status),
        conflictRiskIds: evidence.conflictRisks.map((risk) => risk.id),
        conflictRiskLevels: evidence.conflictRisks.map((risk) => risk.riskLevel),
        branchLeaseIds: evidence.branchLeases.map((lease) => lease.id),
        workspaceLeaseIds: evidence.workspaces.map((workspace) => workspace.id),
        editOverlapIds: evidence.editOverlaps.map((overlap) => overlap.id),
        evidenceSources: evidenceSources(evidence),
        deterministic: true,
        metadataOnly: true,
        noSourceMutation: true,
        noPatchApply: true,
        noRealMerge: true,
        noExternalLlmCall: true,
        realLlmUsed: false
      })
    };
    this.replaceSummary(summary);
    return clone(summary);
  }

  listSummaries(query: { repoId?: string; requestId?: string } = {}): ConflictSummary[] {
    return this.summaries
      .filter((summary) =>
        (query.repoId === undefined || summary.repoId === query.repoId) &&
        (query.requestId === undefined || summary.requestId === query.requestId))
      .sort((left, right) =>
        severityRank[right.severity] - severityRank[left.severity] ||
        left.id.localeCompare(right.id))
      .map((summary) => clone(summary));
  }

  generateResolutionPlan(requestId: string, context: ConflictResolutionRequestContext = {}): ConflictResolutionPlan {
    const summary = this.latestSummary(requestId) ?? this.summarizeConflict(requestId, context);
    const request = this.requireRequest(requestId);
    const evidence = this.evidenceForRequest(request);
    const strategy = strategyFor(summary);
    const existingPlan = this.plans.find((candidate) => candidate.requestId === requestId);
    const plan: ConflictResolutionPlan = {
      id: existingPlan?.id ?? createId("conflictplan"),
      requestId,
      status: summary.severity === "critical" ? "blocked" : "review_required",
      strategy,
      steps: planSteps(summary, strategy),
      suggestedValidation: suggestedValidation(summary),
      suggestedTests: suggestedTests(summary, evidence),
      risks: planRisks(summary, evidence),
      applyAllowed: false,
      metadata: sanitizeMetadata({
        ...contextMetadata(context),
        summaryId: summary.id,
        mergeQueueEntryId: request.mergeQueueEntryId,
        conflictRiskId: request.conflictRiskId,
        mergeSimulationId: request.mergeSimulationId,
        futureLlmHook: "Conflict Resolution Assistant LLM Proposal Profile v1",
        llmProviderMode: "mock_metadata_only",
        realLlmUsed: false,
        metadataOnly: true,
        noSourceMutation: true,
        noPatchApply: true,
        noRealMerge: true,
        noAutoApply: true,
        applyAllowed: false
      })
    };
    this.replacePlan(plan);
    this.replaceRecommendations(plan.id, recommendationsFor(plan, summary, request));
    return clone(plan);
  }

  getPlan(planId: string): ConflictResolutionPlan | undefined {
    return clone(this.plans.find((plan) => plan.id === planId));
  }

  listPlans(query: { requestId?: string; status?: ConflictResolutionPlanStatus } = {}): ConflictResolutionPlan[] {
    return this.plans
      .filter((plan) =>
        (query.requestId === undefined || plan.requestId === query.requestId) &&
        (query.status === undefined || plan.status === query.status))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((plan) => clone(plan));
  }

  listRecommendations(planId?: string): ConflictResolutionRecommendation[] {
    return this.recommendations
      .filter((recommendation) => planId === undefined || recommendation.planId === planId)
      .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id))
      .map((recommendation) => clone(recommendation));
  }

  markPlanReviewed(planId: string, context: ConflictResolutionRequestContext = {}): ConflictResolutionPlan {
    const plan = this.requirePlan(planId);
    const reviewed: ConflictResolutionPlan = {
      ...plan,
      status: plan.status === "blocked" ? "blocked" : "future_apply",
      applyAllowed: false,
      metadata: sanitizeMetadata({
        ...plan.metadata,
        ...contextMetadata(context),
        reviewedAt: this.now().toISOString(),
        reviewedBy: context.actorId ?? context.serviceAccountId ?? "system",
        reviewStatus: "reviewed_v1_no_apply",
        applyAllowed: false,
        noAutoApply: true
      })
    };
    this.replacePlan(reviewed);
    return clone(reviewed);
  }

  linkMergeQueueHold(planId: string, holdId: string, context: ConflictResolutionRequestContext = {}): ConflictResolutionPlan {
    const plan = this.requirePlan(planId);
    const existingHoldIds = stringArray(plan.metadata.linkedMergeQueueHoldIds);
    const linked: ConflictResolutionPlan = {
      ...plan,
      applyAllowed: false,
      metadata: sanitizeMetadata({
        ...plan.metadata,
        ...contextMetadata(context),
        linkedMergeQueueHoldIds: uniqueStrings([...existingHoldIds, holdId]),
        latestLinkedMergeQueueHoldId: holdId,
        mergeQueueHoldLinkedAt: this.now().toISOString(),
        releaseHoldAutomatically: false,
        applyAllowed: false
      })
    };
    this.replacePlan(linked);
    if (!this.recommendations.some((recommendation) => recommendation.planId === planId && recommendation.recommendationKind === "update_merge_queue_hold")) {
      this.recommendations.push({
        id: createId("conflictrec"),
        planId,
        recommendationKind: "update_merge_queue_hold",
        reason: "Link the merge queue hold to this review-only conflict resolution plan for reviewer visibility.",
        priority: 35,
        metadata: sanitizeMetadata({
          holdId,
          releaseHoldAutomatically: false,
          metadataOnly: true
        })
      });
    }
    return clone(linked);
  }

  getSummary(repoId?: string): ConflictResolutionAssistantSummary {
    const requestIds = new Set(this.requests.filter((request) => repoId === undefined || request.repoId === repoId).map((request) => request.id));
    const summaries = this.summaries.filter((summary) => requestIds.has(summary.requestId));
    const plans = this.plans.filter((plan) => requestIds.has(plan.requestId));
    const planIds = new Set(plans.map((plan) => plan.id));
    const recommendations = this.recommendations.filter((recommendation) => planIds.has(recommendation.planId));
    return {
      repoId,
      status: "v1_implemented",
      requests: requestIds.size,
      activeRequests: [...requestIds].filter((requestId) => !plans.some((plan) => plan.requestId === requestId && plan.status === "future_apply")).length,
      summaries: summaries.length,
      plans: plans.length,
      recommendations: recommendations.length,
      highestSeverity: summaries.map((summary) => summary.severity).sort(compareSeverityDesc)[0],
      reviewRequiredPlans: plans.filter((plan) => plan.status === "review_required").length,
      blockedPlans: plans.filter((plan) => plan.status === "blocked").length,
      mergeQueueLinkedPlans: plans.filter((plan) => stringArray(plan.metadata.linkedMergeQueueHoldIds).length > 0 || typeof plan.metadata.mergeQueueEntryId === "string").length,
      applyAllowed: false,
      realLlmUsed: false,
      sourceMutation: false,
      mergeExecution: false,
      patchApplication: false,
      externalProviderCalls: false,
      secretsExposed: false,
      envValuesExposed: false,
      metadata: sanitizeMetadata({
        mockFirst: true,
        metadataOnly: true,
        deterministic: true,
        futureLlmHook: "Conflict Resolution Assistant LLM Proposal Profile v1",
        noAutoApply: true,
        noRealMerge: true,
        noRemoteGit: true
      })
    };
  }

  private evidenceForRequest(request: ConflictResolutionRequest): ConflictEvidence {
    const mergeQueueEntry = request.mergeQueueEntryId ? this.dataSource.getMergeQueueEntry?.(request.mergeQueueEntryId) : undefined;
    const branchLeaseIds = uniqueStrings([
      ...request.branchLeaseIds,
      mergeQueueEntry?.branchLeaseId
    ].filter(isString));
    const branchLeases = branchLeaseIds
      .map((id) => this.dataSource.getBranchLease?.(id))
      .filter(isDefined);
    const simulations = uniqueById([
      request.mergeSimulationId ? this.dataSource.getMergeSimulation?.(request.mergeSimulationId) : undefined,
      ...branchLeaseIds.map((id) => this.dataSource.latestMergeSimulationForLease?.(id))
    ].filter(isDefined));
    const conflictRisks = uniqueById([
      request.conflictRiskId ? this.dataSource.getConflictRisk?.(request.conflictRiskId) : undefined,
      ...branchLeaseIds.map((id) => this.dataSource.highestConflictRiskForLease?.(id))
    ].filter(isDefined));
    const workspaces = uniqueById((request.workspaceLeaseIds ?? [])
      .map((id) => this.dataSource.getWorkspaceLease?.(id))
      .filter(isDefined));
    const explicitOverlaps = (request.editOverlapIds ?? [])
      .map((id) => this.dataSource.getEditOverlap?.(id))
      .filter(isDefined);
    const providerOverlaps = this.dataSource.listEditOverlapsForRequest?.(request) ?? [];
    const editOverlaps = uniqueById([...explicitOverlaps, ...providerOverlaps]);
    return {
      mergeQueueEntry,
      simulations,
      conflictRisks,
      branchLeases,
      workspaces,
      editOverlaps
    };
  }

  private withDerivedEvidence(request: ConflictResolutionRequest, evidence: ConflictEvidence): ConflictResolutionRequest {
    return {
      ...request,
      branchLeaseIds: uniqueStrings([
        ...request.branchLeaseIds,
        ...evidence.branchLeases.map((lease) => lease.id),
        evidence.mergeQueueEntry?.branchLeaseId
      ].filter(isString)),
      files: conflictFilesFor(request, evidence),
      metadata: sanitizeMetadata({
        ...request.metadata,
        mergeQueueEntryFound: evidence.mergeQueueEntry !== undefined,
        evidenceSources: evidenceSources(evidence),
        derivedFromDryRun: evidence.simulations.length > 0,
        derivedFromConflictRisk: evidence.conflictRisks.length > 0,
        derivedFromEditOverlap: evidence.editOverlaps.length > 0
      })
    };
  }

  private replaceRequest(request: ConflictResolutionRequest): void {
    const index = this.requests.findIndex((candidate) => candidate.id === request.id);
    if (index >= 0) {
      this.requests[index] = clone(request);
    } else {
      this.requests.push(clone(request));
    }
  }

  private replaceSummary(summary: ConflictSummary): void {
    const index = this.summaries.findIndex((candidate) => candidate.requestId === summary.requestId);
    if (index >= 0) {
      this.summaries[index] = clone(summary);
    } else {
      this.summaries.push(clone(summary));
    }
  }

  private replacePlan(plan: ConflictResolutionPlan): void {
    const index = this.plans.findIndex((candidate) => candidate.requestId === plan.requestId);
    if (index >= 0) {
      this.plans[index] = clone(plan);
    } else {
      this.plans.push(clone(plan));
    }
  }

  private replaceRecommendations(planId: string, recommendations: ConflictResolutionRecommendation[]): void {
    for (let index = this.recommendations.length - 1; index >= 0; index -= 1) {
      if (this.recommendations[index]?.planId === planId) {
        this.recommendations.splice(index, 1);
      }
    }
    this.recommendations.push(...recommendations.map((recommendation) => clone(recommendation)));
  }

  private requireRequest(requestId: string): ConflictResolutionRequest {
    const request = this.requests.find((candidate) => candidate.id === requestId);
    if (!request) throw new Error(`Conflict resolution request not found: ${requestId}`);
    return clone(request);
  }

  private requirePlan(planId: string): ConflictResolutionPlan {
    const plan = this.plans.find((candidate) => candidate.id === planId);
    if (!plan) throw new Error(`Conflict resolution plan not found: ${planId}`);
    return clone(plan);
  }

  private latestSummary(requestId: string): ConflictSummary | undefined {
    return clone(this.summaries.find((summary) => summary.requestId === requestId));
  }
}

function conflictFilesFor(request: ConflictResolutionRequest, evidence: ConflictEvidence): string[] {
  return normalizeFilePaths([
    ...request.files,
    ...evidence.simulations.flatMap((simulation) => [...simulation.conflictingFiles, ...simulation.changedFiles]),
    ...evidence.conflictRisks.flatMap((risk) => risk.overlapFiles),
    ...evidence.branchLeases.flatMap((lease) => lease.files),
    ...evidence.editOverlaps.flatMap((overlap) => overlap.files)
  ]);
}

function classifyConflict(request: ConflictResolutionRequest, evidence: ConflictEvidence, files: string[]): ConflictKind {
  const hinted = stringValue(request.metadata.conflictKind);
  if (hinted && validConflictKinds.has(hinted as ConflictKind)) return hinted as ConflictKind;
  if (files.some(isDependencyLockfile)) return "dependency_lockfile";
  if (hasFutureKind(evidence, "rename")) return "rename_modify_future";
  if (hasFutureKind(evidence, "delete")) return "delete_modify_future";
  if (files.some(isGeneratedFile)) return "generated_file";
  if (evidence.simulations.some((simulation) => simulation.status === "text_conflict")) return "same_file_edit";
  if (evidence.editOverlaps.some((overlap) => overlap.overlapKind === "same_file")) return "same_file_edit";
  if (evidence.conflictRisks.some((risk) => risk.overlapFiles.length > 0)) return "same_file_edit";
  if (evidence.editOverlaps.some((overlap) => overlap.overlapKind === "same_directory" || stringValue(overlap.metadata?.reason)?.includes("refactor"))) {
    return "same_directory_refactor";
  }
  if (evidence.conflictRisks.some((risk) => risk.reasons.includes("same_top_level_directory_activity"))) return "same_directory_refactor";
  return "unknown";
}

function classifySeverity(request: ConflictResolutionRequest, evidence: ConflictEvidence, conflictKind: ConflictKind): ConflictSeverity {
  let severity: ConflictSeverity = conflictKind === "unknown" ? "low" : "medium";
  if (conflictKind === "dependency_lockfile") severity = maxSeverity(severity, "high");
  if (evidence.simulations.some((simulation) => simulation.status === "text_conflict")) severity = maxSeverity(severity, "critical");
  if (evidence.simulations.some((simulation) => simulation.status === "failed")) severity = maxSeverity(severity, "high");
  for (const risk of evidence.conflictRisks) {
    severity = maxSeverity(severity, conflictRiskSeverity[risk.riskLevel]);
    if (risk.riskScore >= 0.85) severity = maxSeverity(severity, "critical");
    else if (risk.riskScore >= 0.65) severity = maxSeverity(severity, "high");
    else if (risk.riskScore >= 0.35) severity = maxSeverity(severity, "medium");
  }
  for (const overlap of evidence.editOverlaps) {
    severity = maxSeverity(severity, editOverlapSeverity[overlap.severity] ?? "medium");
    if (overlap.recommendation === "block") severity = maxSeverity(severity, "critical");
  }
  if (evidence.workspaces.some((workspace) => workspace.isolationStatus === "shared_forbidden" || workspace.status === "failed")) {
    severity = maxSeverity(severity, "critical");
  }
  const hintedSeverity = stringValue(request.metadata.severity);
  if (hintedSeverity && isConflictSeverity(hintedSeverity)) severity = maxSeverity(severity, hintedSeverity);
  return severity;
}

function likelyCause(conflictKind: ConflictKind, evidence: ConflictEvidence): string {
  if (evidence.simulations.some((simulation) => simulation.status === "text_conflict")) {
    return "Dry-run merge simulation reported text conflicts in overlapping changed files.";
  }
  switch (conflictKind) {
    case "same_file_edit":
      return "Multiple branches or sessions changed the same file and should be reviewed together.";
    case "same_directory_refactor":
      return "Parallel work targets the same directory or a broad refactor scope.";
    case "rename_modify_future":
      return "A future rename intent overlaps with another modification and needs human mapping.";
    case "delete_modify_future":
      return "A future delete intent overlaps with another modification and needs human ownership review.";
    case "generated_file":
      return "Generated or build output appears in the conflict set and should be regenerated through the owning workflow.";
    case "dependency_lockfile":
      return "Dependency manifest or lockfile changes overlap across branches.";
    case "unknown":
      return "Available metadata is insufficient to classify the conflict precisely.";
  }
}

function affectedAreas(files: string[], conflictKind: ConflictKind): string[] {
  const areas = new Set<string>();
  for (const file of files) {
    if (isDependencyLockfile(file)) areas.add("dependencies");
    else if (isTestFile(file)) areas.add("tests");
    else if (isDocsFile(file)) areas.add("docs");
    else if (isGeneratedFile(file)) areas.add("generated");
    else areas.add(directoryForFile(file) ?? "repo-root");
  }
  if (conflictKind === "same_directory_refactor") areas.add("directory-refactor");
  return [...areas].sort();
}

function strategyFor(summary: ConflictSummary): ConflictResolutionStrategy {
  if (summary.severity === "critical") return "human_resolution_required";
  if (summary.conflictKind === "same_file_edit") return "combine_changes";
  if (summary.conflictKind === "same_directory_refactor") return "split_commits_future";
  if (summary.conflictKind === "dependency_lockfile" || summary.conflictKind === "generated_file") return "manual_review";
  if (summary.conflictKind === "rename_modify_future" || summary.conflictKind === "delete_modify_future") return "human_resolution_required";
  return "manual_review";
}

function planSteps(summary: ConflictSummary, strategy: ConflictResolutionStrategy): string[] {
  const base = [
    "Review the listed conflict files in a human-controlled workspace.",
    "Compare source and target branch intent before editing.",
    "Keep the merge queue hold active until a reviewer records validation evidence."
  ];
  if (strategy === "combine_changes") {
    base.splice(2, 0, "Combine non-overlapping behavior from both branches and preserve existing tests.");
  } else if (strategy === "split_commits_future") {
    base.splice(2, 0, "Split broad directory changes into smaller reviewer-owned commits before retrying.");
  } else if (summary.conflictKind === "dependency_lockfile") {
    base.splice(2, 0, "Regenerate dependency metadata only after a reviewer chooses the intended dependency graph.");
  } else if (summary.conflictKind === "generated_file") {
    base.splice(2, 0, "Identify the generator and regenerate artifacts rather than hand-editing generated output.");
  } else {
    base.splice(2, 0, "Write a manual resolution note that explains which branch intent wins for each file.");
  }
  base.push("Rerun the mock or allowlisted local dry-run merge after a human-authored resolution.");
  return base;
}

function suggestedValidation(summary: ConflictSummary): string[] {
  const commands = new Set<string>();
  if (summary.conflictKind === "dependency_lockfile") {
    commands.add("pnpm install --lockfile-only");
    commands.add("pnpm test");
    commands.add("pnpm typecheck");
    commands.add("pnpm build");
  } else if (summary.conflictKind === "generated_file") {
    commands.add("pnpm build");
    commands.add("pnpm test");
  } else if (summary.conflictFiles.every(isDocsFile)) {
    commands.add("pnpm lint");
  } else {
    commands.add("pnpm test");
    commands.add("pnpm typecheck");
  }
  return [...commands];
}

function suggestedTests(summary: ConflictSummary, evidence: ConflictEvidence): string[] {
  const tests = new Set<string>();
  for (const file of summary.conflictFiles) {
    if (isTestFile(file)) tests.add(file);
  }
  for (const lease of evidence.branchLeases) {
    for (const test of lease.tests) tests.add(test);
  }
  if (tests.size === 0 && !summary.conflictFiles.every(isDocsFile)) tests.add("pnpm test");
  if (summary.conflictKind === "dependency_lockfile") tests.add("pnpm test");
  return [...tests].sort();
}

function planRisks(summary: ConflictSummary, evidence: ConflictEvidence): string[] {
  const risks = new Set<string>();
  if (summary.severity === "critical") risks.add("critical_conflict_requires_human_review");
  if (summary.conflictKind === "dependency_lockfile") risks.add("dependency_graph_may_change_transitively");
  if (summary.conflictKind === "generated_file") risks.add("manual_generated_file_edits_may_be_overwritten");
  if (evidence.workspaces.some((workspace) => workspace.isolationStatus === "shared_forbidden")) risks.add("shared_workspace_conflict_must_remain_blocked");
  if (evidence.editOverlaps.some((overlap) => overlap.recommendation === "block")) risks.add("coordination_overlap_blocks_safe_merge_readiness");
  if (risks.size === 0) risks.add("manual_review_required_before_any_future_apply");
  return [...risks].sort();
}

function recommendationsFor(
  plan: ConflictResolutionPlan,
  summary: ConflictSummary,
  request: ConflictResolutionRequest
): ConflictResolutionRecommendation[] {
  const recommendations: ConflictResolutionRecommendation[] = [];
  for (const file of summary.conflictFiles.slice(0, 10)) {
    recommendations.push({
      id: createId("conflictrec"),
      planId: plan.id,
      recommendationKind: "review_file",
      reason: `Review ${file} before recording any resolution.`,
      priority: 10,
      metadata: sanitizeMetadata({ file, metadataOnly: true })
    });
  }
  for (const command of plan.suggestedValidation) {
    recommendations.push({
      id: createId("conflictrec"),
      planId: plan.id,
      recommendationKind: "run_test",
      reason: `Suggested validation after manual resolution: ${command}`,
      priority: 20,
      metadata: sanitizeMetadata({ command, executionByAssistant: false })
    });
  }
  if (summary.severity === "high" || summary.severity === "critical") {
    recommendations.push({
      id: createId("conflictrec"),
      planId: plan.id,
      recommendationKind: "request_human_review",
      reason: "High or critical conflict evidence requires human review before readiness can change.",
      priority: 5,
      metadata: sanitizeMetadata({ severity: summary.severity, applyAllowed: false })
    });
  }
  recommendations.push({
    id: createId("conflictrec"),
    planId: plan.id,
    recommendationKind: "rerun_dry_merge",
    reason: "Rerun a mock or allowlisted local dry-run merge after a human-authored resolution.",
    priority: 30,
    metadata: sanitizeMetadata({ noRealMergeByAssistant: true })
  });
  if (summary.conflictKind === "same_directory_refactor") {
    recommendations.push({
      id: createId("conflictrec"),
      planId: plan.id,
      recommendationKind: "split_work",
      reason: "Directory-level overlap should be split or serialized before retrying readiness.",
      priority: 25,
      metadata: sanitizeMetadata({ conflictKind: summary.conflictKind })
    });
  }
  if (request.mergeQueueEntryId) {
    recommendations.push({
      id: createId("conflictrec"),
      planId: plan.id,
      recommendationKind: "update_merge_queue_hold",
      reason: "Keep or link a merge queue hold until the conflict plan is reviewed.",
      priority: 35,
      metadata: sanitizeMetadata({
        mergeQueueEntryId: request.mergeQueueEntryId,
        releaseHoldAutomatically: false
      })
    });
  }
  return recommendations;
}

function evidenceSources(evidence: ConflictEvidence): string[] {
  const sources = [];
  if (evidence.mergeQueueEntry) sources.push("merge_queue_entry");
  if (evidence.simulations.length > 0) sources.push("dry_run_merge_simulation");
  if (evidence.conflictRisks.length > 0) sources.push("conflict_risk");
  if (evidence.branchLeases.length > 0) sources.push("branch_lease");
  if (evidence.workspaces.length > 0) sources.push("workspace_lease");
  if (evidence.editOverlaps.length > 0) sources.push("edit_overlap");
  return sources.sort();
}

function hasFutureKind(evidence: ConflictEvidence, kind: "rename" | "delete"): boolean {
  return evidence.editOverlaps.some((overlap) => {
    const values = [
      overlap.overlapKind,
      overlap.reason,
      stringValue(overlap.metadata?.conflictKind),
      stringValue(overlap.metadata?.intentKind),
      stringValue(overlap.metadata?.leftIntentKind),
      stringValue(overlap.metadata?.rightIntentKind)
    ].filter(isString);
    return values.some((value) => kind === "rename" ? value.includes("rename") : value.includes("delete"));
  });
}

function normalizeFilePath(filePath: string): string {
  const normalized = filePath.trim().replaceAll("\\", "/").replace(/\/+/g, "/").replace(/^\.\//, "");
  if (path.isAbsolute(filePath) || /^[A-Za-z]:[\\/]/.test(filePath)) {
    const basename = path.basename(normalized);
    return basename ? `[file-path]/${basename}` : "[file-path]";
  }
  return normalized;
}

function normalizeFilePaths(files: string[]): string[] {
  return uniqueStrings(files.filter(isString).map(normalizeFilePath).filter(Boolean));
}

function directoryForFile(filePath: string): string | undefined {
  const normalized = normalizeFilePath(filePath);
  if (normalized.endsWith("/")) return normalized.replace(/\/$/, "");
  const segments = normalized.split("/");
  segments.pop();
  const directory = segments.join("/");
  return directory.length > 0 ? directory : undefined;
}

function isDependencyLockfile(filePath: string): boolean {
  const normalized = normalizeFilePath(filePath).toLowerCase();
  return normalized === "package.json" ||
    normalized === "pnpm-lock.yaml" ||
    normalized === "package-lock.json" ||
    normalized === "yarn.lock" ||
    normalized.endsWith("/package.json") ||
    normalized.endsWith("/pnpm-lock.yaml") ||
    normalized.endsWith("/package-lock.json") ||
    normalized.endsWith("/yarn.lock");
}

function isGeneratedFile(filePath: string): boolean {
  const normalized = normalizeFilePath(filePath).toLowerCase();
  return normalized.includes("/generated/") ||
    normalized.startsWith("generated/") ||
    normalized.includes("/dist/") ||
    normalized.startsWith("dist/") ||
    normalized.includes("/build/") ||
    normalized.startsWith("build/") ||
    normalized.endsWith(".generated.ts") ||
    normalized.endsWith(".generated.js") ||
    normalized.endsWith(".gen.ts") ||
    normalized.endsWith(".gen.js") ||
    normalized.endsWith(".pb.ts");
}

function isTestFile(filePath: string): boolean {
  const normalized = normalizeFilePath(filePath).toLowerCase();
  return normalized.includes(".test.") ||
    normalized.includes(".spec.") ||
    normalized.includes("/__tests__/") ||
    normalized.startsWith("tests/") ||
    normalized.startsWith("test/");
}

function isDocsFile(filePath: string): boolean {
  const normalized = normalizeFilePath(filePath).toLowerCase();
  return normalized.startsWith("docs/") || normalized.endsWith(".md") || normalized.endsWith(".mdx");
}

function sanitizeContext(context: ConflictResolutionRequestContext): ConflictResolutionRequestContext | undefined {
  const sanitized = sanitizeMetadata({
    requestId: context.requestId,
    correlationId: context.correlationId,
    actorId: context.actorId,
    principalId: context.principalId,
    serviceAccountId: context.serviceAccountId,
    source: context.source,
    metadata: context.metadata
  });
  return Object.keys(sanitized).length > 0 ? sanitized as ConflictResolutionRequestContext : undefined;
}

function contextMetadata(context: ConflictResolutionRequestContext): Record<string, unknown> {
  return sanitizeMetadata({
    requestId: context.requestId,
    correlationId: context.correlationId,
    actorId: context.actorId,
    principalId: context.principalId,
    serviceAccountId: context.serviceAccountId,
    source: context.source,
    ...context.metadata
  });
}

function sanitizeMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (isSensitiveMetadataKey(key)) {
      output[key] = "[redacted]";
      continue;
    }
    if (value instanceof Date) {
      output[key] = value.toISOString();
      continue;
    }
    if (Array.isArray(value)) {
      output[key] = value.map((item) => sanitizeMetadataValue(item));
      continue;
    }
    output[key] = sanitizeMetadataValue(value);
  }
  return output;
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (/(OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|VAULT_TOKEN|DATABASE_URL|AICHESTRA_[A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD))=/i.test(value)) {
      return "[redacted]";
    }
    if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) {
      return normalizeFilePath(value);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeMetadataValue(item));
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null) return sanitizeMetadata(value as Record<string, unknown>);
  return value;
}

function isSensitiveMetadataKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (
    normalized === "secretsexposed" ||
    normalized === "nosecretsexposed" ||
    normalized === "envvaluesexposed" ||
    normalized === "noenvvaluesexposed" ||
    normalized === "nosecretsorenvvalues"
  ) {
    return false;
  }
  return /token|secret|credential|password|private.*key|api.*key|authorization|cookie/.test(normalized) ||
    normalized === "env" ||
    normalized === "envvalue" ||
    normalized === "envvalues" ||
    normalized === "rawenv";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isString) : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isConflictSeverity(value: string): value is ConflictSeverity {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

function maxSeverity(left: ConflictSeverity, right: ConflictSeverity): ConflictSeverity {
  return severityRank[left] >= severityRank[right] ? left : right;
}

function compareSeverityDesc(left: ConflictSeverity, right: ConflictSeverity): number {
  return severityRank[right] - severityRank[left];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].filter((value) => value.length > 0).sort((left, right) => left.localeCompare(right));
}

function uniqueById<T extends { id: string }>(values: T[]): T[] {
  return [...new Map(values.map((value) => [value.id, value])).values()].sort((left, right) => left.id.localeCompare(right.id));
}

function clone<T>(value: T): T;
function clone<T>(value: T | undefined): T | undefined;
function clone<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : structuredClone(value);
}
