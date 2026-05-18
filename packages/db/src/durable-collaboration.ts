export type DurableCollaborationProviderKind = "in_memory" | "persistent" | "postgres";

export type DurableCollaborationRepositoryGroup =
  | "branch_orchestration"
  | "agent_session_coordination"
  | "agent_workspace"
  | "agent_worktree_allocation"
  | "edit_intent"
  | "merge_queue_policy"
  | "conflict_resolution"
  | "pr_ownership"
  | "cleanup_recovery";

export const DURABLE_COLLABORATION_REPOSITORY_GROUPS = [
  "branch_orchestration",
  "agent_session_coordination",
  "agent_workspace",
  "agent_worktree_allocation",
  "edit_intent",
  "merge_queue_policy",
  "conflict_resolution",
  "pr_ownership",
  "cleanup_recovery"
] as const satisfies readonly DurableCollaborationRepositoryGroup[];

export const DURABLE_COLLABORATION_GROUP_LABELS: Record<DurableCollaborationRepositoryGroup, string> = {
  branch_orchestration: "Branch Orchestration",
  agent_session_coordination: "Agent Session Coordination",
  agent_workspace: "Agent Workspace Lifecycle",
  agent_worktree_allocation: "Agent Worktree Allocation",
  edit_intent: "File Lease / Edit Intent Graph",
  merge_queue_policy: "Merge Queue Policy",
  conflict_resolution: "Conflict Resolution Assistant",
  pr_ownership: "PR Ownership / Handoff",
  cleanup_recovery: "Branch Cleanup / Orphan Recovery"
};

export type DurableCollaborationRecordKind =
  | "BranchOrchestrationRequest"
  | "BranchOrchestrationDecision"
  | "BranchOwnershipRecord"
  | "AgentSession"
  | "AgentRunCoordinationGroup"
  | "AgentSessionOverlap"
  | "AgentWorkspaceLease"
  | "AgentWorkspaceLifecycleEvent"
  | "AgentWorkspaceCleanupDecision"
  | "AgentWorktreeAllocationRequest"
  | "AgentWorktreeAllocationResult"
  | "FileLease"
  | "EditIntent"
  | "EditOverlapAssessment"
  | "MergeQueuePolicy"
  | "MergeReadinessDecision"
  | "MergeQueueHold"
  | "ConflictResolutionRequest"
  | "ConflictSummary"
  | "ConflictResolutionPlan"
  | "ConflictResolutionRecommendation"
  | "PrOwnershipRecord"
  | "PrHandoffRequest"
  | "PrHandoffDecision"
  | "OrphanLeaseRecord"
  | "CleanupRecommendation"
  | "CleanupDecision"
  | "RecoveryAction";

export const DURABLE_COLLABORATION_RECORD_KINDS_BY_GROUP: Record<
  DurableCollaborationRepositoryGroup,
  readonly DurableCollaborationRecordKind[]
> = {
  branch_orchestration: [
    "BranchOrchestrationRequest",
    "BranchOrchestrationDecision",
    "BranchOwnershipRecord"
  ],
  agent_session_coordination: ["AgentSession", "AgentRunCoordinationGroup", "AgentSessionOverlap"],
  agent_workspace: ["AgentWorkspaceLease", "AgentWorkspaceLifecycleEvent", "AgentWorkspaceCleanupDecision"],
  agent_worktree_allocation: ["AgentWorktreeAllocationRequest", "AgentWorktreeAllocationResult"],
  edit_intent: ["FileLease", "EditIntent", "EditOverlapAssessment"],
  merge_queue_policy: ["MergeQueuePolicy", "MergeReadinessDecision", "MergeQueueHold"],
  conflict_resolution: [
    "ConflictResolutionRequest",
    "ConflictSummary",
    "ConflictResolutionPlan",
    "ConflictResolutionRecommendation"
  ],
  pr_ownership: ["PrOwnershipRecord", "PrHandoffRequest", "PrHandoffDecision"],
  cleanup_recovery: ["OrphanLeaseRecord", "CleanupRecommendation", "CleanupDecision", "RecoveryAction"]
};

export const DURABLE_COLLABORATION_RECORD_TABLES: Record<DurableCollaborationRecordKind, string> = {
  BranchOrchestrationRequest: "branch_orchestration_requests",
  BranchOrchestrationDecision: "branch_orchestration_decisions",
  BranchOwnershipRecord: "branch_ownership_records",
  AgentSession: "agent_sessions",
  AgentRunCoordinationGroup: "agent_run_coordination_groups",
  AgentSessionOverlap: "agent_session_overlaps",
  AgentWorkspaceLease: "agent_workspace_leases",
  AgentWorkspaceLifecycleEvent: "agent_workspace_lifecycle_events",
  AgentWorkspaceCleanupDecision: "agent_workspace_cleanup_decisions",
  AgentWorktreeAllocationRequest: "agent_worktree_allocation_requests",
  AgentWorktreeAllocationResult: "agent_worktree_allocation_results",
  FileLease: "file_leases",
  EditIntent: "edit_intents",
  EditOverlapAssessment: "edit_overlap_assessments",
  MergeQueuePolicy: "merge_queue_policies",
  MergeReadinessDecision: "merge_readiness_decisions",
  MergeQueueHold: "merge_queue_holds",
  ConflictResolutionRequest: "conflict_resolution_requests",
  ConflictSummary: "conflict_summaries",
  ConflictResolutionPlan: "conflict_resolution_plans",
  ConflictResolutionRecommendation: "conflict_resolution_recommendations",
  PrOwnershipRecord: "pr_ownership_records",
  PrHandoffRequest: "pr_handoff_requests",
  PrHandoffDecision: "pr_handoff_decisions",
  OrphanLeaseRecord: "orphan_lease_records",
  CleanupRecommendation: "cleanup_recommendations",
  CleanupDecision: "cleanup_decisions",
  RecoveryAction: "recovery_actions"
};

export type DurableCollaborationRecordClassification =
  | "required_durable"
  | "recommended_durable"
  | "ephemeral_recomputable";

export type DurableCollaborationStoreInventoryItem = {
  modelName: string;
  classification: DurableCollaborationRecordClassification;
  group?: DurableCollaborationRepositoryGroup;
  sourcePath: string;
  currentStorage: string;
  targetStorage: string;
  repositoryNeeded: boolean;
  postgresTableNeeded: boolean;
  tableName?: string;
  migrationStatus: "implemented_skeleton" | "future" | "not_applicable";
  productionImpact: string;
};

export type DurableCollaborationMetadata = Record<string, unknown>;

export type DurableCollaborationRecord = {
  id: string;
  group: DurableCollaborationRepositoryGroup;
  recordKind: DurableCollaborationRecordKind;
  repoId?: string;
  taskId?: string;
  taskRunId?: string;
  agentRunId?: string;
  branchName?: string;
  branchLeaseId?: string;
  workspaceLeaseId?: string;
  status?: string;
  decision?: string;
  severity?: string;
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  serviceAccountId?: string;
  metadata: DurableCollaborationMetadata;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateDurableCollaborationRecordInput = Omit<
  DurableCollaborationRecord,
  "group" | "metadata" | "createdAt" | "updatedAt"
> & {
  metadata?: DurableCollaborationMetadata;
  createdAt?: Date;
  updatedAt?: Date;
};

export type UpdateDurableCollaborationStatusInput = {
  status?: string;
  decision?: string;
  severity?: string;
  metadata?: DurableCollaborationMetadata;
  updatedAt?: Date;
};

export type DurableCollaborationEvent = {
  id: string;
  group: DurableCollaborationRepositoryGroup;
  recordKind: DurableCollaborationRecordKind;
  recordId: string;
  eventType: string;
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  serviceAccountId?: string;
  metadata: DurableCollaborationMetadata;
  createdAt: Date;
};

export type CreateDurableCollaborationEventInput = Omit<
  DurableCollaborationEvent,
  "group" | "metadata" | "createdAt"
> & {
  metadata?: DurableCollaborationMetadata;
  createdAt?: Date;
};

export type DurableCollaborationRepositorySummary = {
  group: DurableCollaborationRepositoryGroup;
  label: string;
  providerKind: DurableCollaborationProviderKind;
  implemented: boolean;
  recordKinds: DurableCollaborationRecordKind[];
  tableNames: string[];
  recordCount: number;
  eventCount: number;
  noSecretsExposed: boolean;
  envValuesExposed: boolean;
  databaseUrlExposed: boolean;
};

export type DurableCollaborationSchemaTableStatus = {
  tableName: string;
  recordKind: DurableCollaborationRecordKind;
  group: DurableCollaborationRepositoryGroup;
  implemented: boolean;
  safeColumnsOnly: boolean;
  metadataJsonStoresSecrets: false;
};

export type DurableCollaborationSchemaStatus = {
  status: "implemented_skeleton";
  tableCount: number;
  eventTableName: "durable_collaboration_events";
  safeColumnsOnly: true;
  credentialColumnsPresent: false;
  envValueColumnsPresent: false;
  databaseUrlColumnsPresent: false;
  rawPayloadColumnsPresent: false;
  tables: DurableCollaborationSchemaTableStatus[];
};

export type DurableCollaborationSummary = {
  status: "v1_implemented";
  providerKind: DurableCollaborationProviderKind;
  defaultRuntime: "in_memory";
  durableCollaborationStoreConfigured: boolean;
  productionReady: false;
  repositoryGroupCount: number;
  implementedRepositoryGroupCount: number;
  requiredDurableRecordCount: number;
  recommendedDurableRecordCount: number;
  ephemeralRecordCount: number;
  postgresTableCount: number;
  migrationCoverage: "v1_schema_skeleton";
  optionalPostgresSupported: boolean;
  optionalPostgresTestsConfigured: boolean;
  noSecretsExposed: boolean;
  envValuesExposed: boolean;
  databaseUrlExposed: boolean;
  remoteGitOperationsExecuted: false;
  workspaceMutationExecuted: false;
  externalCallsExecuted: false;
  metadata: {
    storeMode: "metadata_only";
    realGitOperationsAllowed: false;
    destructiveCleanupAllowed: false;
    rawPayloadStorageAllowed: false;
    credentialStorageAllowed: false;
  };
};

export type DurableCollaborationGroupRepository = {
  readonly group: DurableCollaborationRepositoryGroup;
  create(input: CreateDurableCollaborationRecordInput): DurableCollaborationRecord;
  getById(id: string): DurableCollaborationRecord | undefined;
  list(): DurableCollaborationRecord[];
  updateStatus(id: string, input: UpdateDurableCollaborationStatusInput): DurableCollaborationRecord;
  updateMetadata(id: string, metadata: DurableCollaborationMetadata): DurableCollaborationRecord;
  appendEvent(input: CreateDurableCollaborationEventInput): DurableCollaborationEvent;
  listEvents(recordId?: string): DurableCollaborationEvent[];
  summarize(): DurableCollaborationRepositorySummary;
};

export type DurableBranchOrchestrationRepository = DurableCollaborationGroupRepository;
export type DurableAgentSessionCoordinationRepository = DurableCollaborationGroupRepository;
export type DurableAgentWorkspaceRepository = DurableCollaborationGroupRepository;
export type DurableAgentWorktreeAllocationRepository = DurableCollaborationGroupRepository;
export type DurableEditIntentRepository = DurableCollaborationGroupRepository;
export type DurableMergeQueuePolicyRepository = DurableCollaborationGroupRepository;
export type DurableConflictResolutionRepository = DurableCollaborationGroupRepository;
export type DurablePrOwnershipRepository = DurableCollaborationGroupRepository;
export type DurableCleanupRecoveryRepository = DurableCollaborationGroupRepository;

export type DurableCollaborationRepositories = {
  branchOrchestration: DurableBranchOrchestrationRepository;
  agentSessionCoordination: DurableAgentSessionCoordinationRepository;
  agentWorkspace: DurableAgentWorkspaceRepository;
  agentWorktreeAllocation: DurableAgentWorktreeAllocationRepository;
  editIntent: DurableEditIntentRepository;
  mergeQueuePolicy: DurableMergeQueuePolicyRepository;
  conflictResolution: DurableConflictResolutionRepository;
  prOwnership: DurablePrOwnershipRepository;
  cleanupRecovery: DurableCleanupRecoveryRepository;
  listInventory(): DurableCollaborationStoreInventoryItem[];
  listRepositorySummaries(): DurableCollaborationRepositorySummary[];
  getSchemaStatus(): DurableCollaborationSchemaStatus;
  getSummary(input?: { optionalPostgresTestsConfigured?: boolean }): DurableCollaborationSummary;
};

const groupPropertyNames: Record<DurableCollaborationRepositoryGroup, keyof DurableCollaborationRepositories> = {
  branch_orchestration: "branchOrchestration",
  agent_session_coordination: "agentSessionCoordination",
  agent_workspace: "agentWorkspace",
  agent_worktree_allocation: "agentWorktreeAllocation",
  edit_intent: "editIntent",
  merge_queue_policy: "mergeQueuePolicy",
  conflict_resolution: "conflictResolution",
  pr_ownership: "prOwnership",
  cleanup_recovery: "cleanupRecovery"
};

const recordKindToGroup = new Map<DurableCollaborationRecordKind, DurableCollaborationRepositoryGroup>(
  DURABLE_COLLABORATION_REPOSITORY_GROUPS.flatMap((group) =>
    DURABLE_COLLABORATION_RECORD_KINDS_BY_GROUP[group].map((recordKind) => [recordKind, group] as const)
  )
);

export const DURABLE_COLLABORATION_STORE_INVENTORY: DurableCollaborationStoreInventoryItem[] = [
  requiredItem(
    "BranchOrchestrationRequest",
    "packages/git-adapter/src/branch-orchestrator.ts",
    "In-memory branch orchestrator repository",
    "Needed to replay branch allocation intent safely."
  ),
  requiredItem(
    "BranchOrchestrationDecision",
    "packages/git-adapter/src/branch-orchestrator.ts",
    "In-memory branch orchestrator repository",
    "Needed to preserve branch allocation decisions."
  ),
  requiredItem(
    "BranchOwnershipRecord",
    "packages/git-adapter/src/branch-orchestrator.ts",
    "In-memory branch orchestrator repository",
    "Needed for durable ownership and handoff coordination."
  ),
  requiredItem(
    "AgentSession",
    "packages/runner/src/coordination.ts",
    "In-memory coordination repository",
    "Needed to coordinate overlapping agent runs across restarts."
  ),
  requiredItem(
    "AgentRunCoordinationGroup",
    "packages/runner/src/coordination.ts",
    "Derived from in-memory sessions",
    "Needed to preserve run grouping evidence."
  ),
  requiredItem(
    "AgentSessionOverlap",
    "packages/runner/src/coordination.ts",
    "In-memory coordination repository",
    "Needed for durable overlap and blocker evidence."
  ),
  requiredItem(
    "AgentWorkspaceLease",
    "packages/runner/src/workspace-lifecycle.ts",
    "In-memory workspace lifecycle repository",
    "Needed before production workspace lifecycle coordination."
  ),
  requiredItem(
    "AgentWorkspaceLifecycleEvent",
    "packages/runner/src/workspace-lifecycle.ts",
    "In-memory workspace lifecycle repository",
    "Needed for audit and cleanup reconstruction."
  ),
  requiredItem(
    "AgentWorkspaceCleanupDecision",
    "packages/runner/src/workspace-lifecycle.ts",
    "In-memory workspace lifecycle repository",
    "Needed to preserve non-destructive cleanup decisions."
  ),
  requiredItem(
    "AgentWorktreeAllocationRequest",
    "packages/runner/src/worktree-allocation.ts",
    "Service-local array",
    "Needed for allocation replay and safety review."
  ),
  requiredItem(
    "AgentWorktreeAllocationResult",
    "packages/runner/src/worktree-allocation.ts",
    "Service-local array",
    "Needed for durable fixture allocation evidence."
  ),
  requiredItem(
    "FileLease",
    "packages/runner/src/edit-intent.ts",
    "In-memory edit intent repository",
    "Needed for file-level collaboration coordination."
  ),
  requiredItem(
    "EditIntent",
    "packages/runner/src/edit-intent.ts",
    "In-memory edit intent repository",
    "Needed to preserve intended edits across restarts."
  ),
  requiredItem(
    "EditOverlapAssessment",
    "packages/runner/src/edit-intent.ts",
    "In-memory edit intent repository",
    "Needed to preserve overlap warnings and blockers."
  ),
  requiredItem(
    "MergeQueuePolicy",
    "packages/core/src/conflicts/merge-queue-policy.ts",
    "Static/in-memory policy metadata",
    "Needed before persistent queue policy tuning."
  ),
  requiredItem(
    "MergeReadinessDecision",
    "packages/core/src/conflicts/merge-queue-policy.ts",
    "Service-local array",
    "Needed to preserve readiness decisions and evidence."
  ),
  requiredItem(
    "MergeQueueHold",
    "packages/core/src/conflicts/merge-queue-policy.ts",
    "Service-local array",
    "Needed to preserve holds across service restarts."
  ),
  requiredItem(
    "ConflictResolutionRequest",
    "packages/core/src/conflicts/conflict-resolution-assistant.ts",
    "Service-local array",
    "Needed to retain conflict assistant request evidence."
  ),
  requiredItem(
    "ConflictSummary",
    "packages/core/src/conflicts/conflict-resolution-assistant.ts",
    "Service-local array",
    "Needed to retain deterministic summaries."
  ),
  requiredItem(
    "ConflictResolutionPlan",
    "packages/core/src/conflicts/conflict-resolution-assistant.ts",
    "Service-local array",
    "Needed to retain review-only plan evidence."
  ),
  requiredItem(
    "ConflictResolutionRecommendation",
    "packages/core/src/conflicts/conflict-resolution-assistant.ts",
    "Service-local array",
    "Needed to preserve recommendation metadata."
  ),
  requiredItem(
    "PrOwnershipRecord",
    "packages/core/src/conflicts/pr-ownership-handoff.ts",
    "Service-local array",
    "Needed to preserve PR ownership and reviewer metadata."
  ),
  requiredItem(
    "PrHandoffRequest",
    "packages/core/src/conflicts/pr-ownership-handoff.ts",
    "Service-local array",
    "Needed to preserve handoff request evidence."
  ),
  requiredItem(
    "PrHandoffDecision",
    "packages/core/src/conflicts/pr-ownership-handoff.ts",
    "Service-local array",
    "Needed to preserve handoff decisions."
  ),
  requiredItem(
    "OrphanLeaseRecord",
    "packages/git-adapter/src/branch-cleanup.ts",
    "In-memory cleanup repository",
    "Needed to preserve orphan detection evidence."
  ),
  requiredItem(
    "CleanupRecommendation",
    "packages/git-adapter/src/branch-cleanup.ts",
    "In-memory cleanup repository",
    "Needed to preserve advisory cleanup recommendations."
  ),
  requiredItem(
    "CleanupDecision",
    "packages/git-adapter/src/branch-cleanup.ts",
    "In-memory cleanup repository",
    "Needed to preserve non-destructive cleanup decisions."
  ),
  requiredItem(
    "RecoveryAction",
    "packages/git-adapter/src/branch-cleanup.ts",
    "In-memory cleanup repository",
    "Needed to preserve recovery action metadata."
  ),
  recommendedItem(
    "DashboardReadinessSummary",
    "apps/api/src/dashboard-read-model.ts",
    "Derived read model",
    "Recompute from durable records; optional snapshot later",
    "Useful for fast reads, not required for correctness."
  ),
  recommendedItem(
    "AuditCorrelationSnapshot",
    "multiple packages",
    "Embedded metadata and audit logs",
    "Keep request/correlation fields in durable record metadata",
    "Useful to reconstruct decisions without exposing secrets."
  ),
  recommendedItem(
    "BaseBranchDriftStatus",
    "packages/git-adapter/src/branch-orchestrator.ts",
    "In-memory branch orchestrator repository",
    "Durable branch orchestration metadata/table extension later",
    "Useful for production merge readiness correlation."
  ),
  recommendedItem(
    "WorkspaceSafetyCheck",
    "packages/runner/src/worktree-allocation.ts",
    "Service-local/derived metadata",
    "Durable worktree/workspace metadata later",
    "Useful before enabling real worktree allocation."
  ),
  ephemeralItem(
    "VisualGraphLayout",
    "apps/web/src/render.ts",
    "Browser/UI computation",
    "Recompute in UI",
    "No durable correctness impact."
  ),
  ephemeralItem(
    "DashboardDisplayGrouping",
    "apps/api/src/dashboard-read-model.ts",
    "Derived read model/UI grouping",
    "Recompute from durable records",
    "No durable correctness impact."
  ),
  ephemeralItem(
    "DerivedCounts",
    "dashboard/readiness summaries",
    "Derived from records",
    "Recompute on read",
    "No durable correctness impact."
  )
];

export function getDurableCollaborationRecordGroup(
  recordKind: DurableCollaborationRecordKind
): DurableCollaborationRepositoryGroup {
  const group = recordKindToGroup.get(recordKind);
  if (!group) {
    throw new Error(`Unsupported durable collaboration record kind: ${recordKind}`);
  }
  return group;
}

export function sanitizeDurableCollaborationMetadata(
  metadata: DurableCollaborationMetadata | undefined
): DurableCollaborationMetadata {
  return sanitizeValue(metadata ?? {}) as DurableCollaborationMetadata;
}

export function getDurableCollaborationSchemaStatus(): DurableCollaborationSchemaStatus {
  const tables = DURABLE_COLLABORATION_REPOSITORY_GROUPS.flatMap((group) =>
    DURABLE_COLLABORATION_RECORD_KINDS_BY_GROUP[group].map((recordKind) => ({
      tableName: DURABLE_COLLABORATION_RECORD_TABLES[recordKind],
      recordKind,
      group,
      implemented: true,
      safeColumnsOnly: true,
      metadataJsonStoresSecrets: false as const
    }))
  );
  return {
    status: "implemented_skeleton",
    tableCount: tables.length,
    eventTableName: "durable_collaboration_events",
    safeColumnsOnly: true,
    credentialColumnsPresent: false,
    envValueColumnsPresent: false,
    databaseUrlColumnsPresent: false,
    rawPayloadColumnsPresent: false,
    tables
  };
}

export function createInMemoryDurableCollaborationRepositories(
  providerKind: DurableCollaborationProviderKind = "in_memory"
): DurableCollaborationRepositories {
  const repositories = {} as Record<DurableCollaborationRepositoryGroup, DurableCollaborationGroupRepository>;
  for (const group of DURABLE_COLLABORATION_REPOSITORY_GROUPS) {
    repositories[group] = new InMemoryDurableCollaborationGroupRepository(group, providerKind);
  }
  return createDurableCollaborationRepositorySet(providerKind, repositories);
}

export function createDurableCollaborationRepositorySet(
  providerKind: DurableCollaborationProviderKind,
  repositories: Record<DurableCollaborationRepositoryGroup, DurableCollaborationGroupRepository>
): DurableCollaborationRepositories {
  const repositorySet = Object.fromEntries(
    DURABLE_COLLABORATION_REPOSITORY_GROUPS.map((group) => [groupPropertyNames[group], repositories[group]])
  ) as Pick<
    DurableCollaborationRepositories,
    | "branchOrchestration"
    | "agentSessionCoordination"
    | "agentWorkspace"
    | "agentWorktreeAllocation"
    | "editIntent"
    | "mergeQueuePolicy"
    | "conflictResolution"
    | "prOwnership"
    | "cleanupRecovery"
  >;

  return {
    ...repositorySet,
    listInventory: () => DURABLE_COLLABORATION_STORE_INVENTORY.map((item) => ({ ...item })),
    listRepositorySummaries: () => DURABLE_COLLABORATION_REPOSITORY_GROUPS.map((group) => repositories[group].summarize()),
    getSchemaStatus: getDurableCollaborationSchemaStatus,
    getSummary: (input) =>
      createDurableCollaborationSummary(providerKind, repositories, {
        optionalPostgresTestsConfigured: Boolean(input?.optionalPostgresTestsConfigured)
      })
  };
}

class InMemoryDurableCollaborationGroupRepository implements DurableCollaborationGroupRepository {
  readonly group: DurableCollaborationRepositoryGroup;
  private readonly providerKind: DurableCollaborationProviderKind;
  private readonly records = new Map<string, DurableCollaborationRecord>();
  private readonly events: DurableCollaborationEvent[] = [];

  constructor(group: DurableCollaborationRepositoryGroup, providerKind: DurableCollaborationProviderKind) {
    this.group = group;
    this.providerKind = providerKind;
  }

  create(input: CreateDurableCollaborationRecordInput): DurableCollaborationRecord {
    this.assertRecordKind(input.recordKind);
    if (this.records.has(input.id)) {
      throw new Error(`Durable collaboration record already exists: ${input.id}`);
    }
    const now = input.createdAt ?? new Date();
    const record: DurableCollaborationRecord = {
      ...input,
      group: this.group,
      metadata: sanitizeDurableCollaborationMetadata(input.metadata),
      createdAt: now,
      updatedAt: input.updatedAt ?? now
    };
    this.records.set(record.id, cloneRecord(record));
    return cloneRecord(record);
  }

  getById(id: string): DurableCollaborationRecord | undefined {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  list(): DurableCollaborationRecord[] {
    return [...this.records.values()].map(cloneRecord);
  }

  updateStatus(id: string, input: UpdateDurableCollaborationStatusInput): DurableCollaborationRecord {
    const existing = this.requireRecord(id);
    const updated: DurableCollaborationRecord = {
      ...existing,
      status: input.status ?? existing.status,
      decision: input.decision ?? existing.decision,
      severity: input.severity ?? existing.severity,
      metadata: mergeMetadata(existing.metadata, input.metadata),
      updatedAt: input.updatedAt ?? new Date()
    };
    this.records.set(id, cloneRecord(updated));
    return cloneRecord(updated);
  }

  updateMetadata(id: string, metadata: DurableCollaborationMetadata): DurableCollaborationRecord {
    const existing = this.requireRecord(id);
    const updated: DurableCollaborationRecord = {
      ...existing,
      metadata: mergeMetadata(existing.metadata, metadata),
      updatedAt: new Date()
    };
    this.records.set(id, cloneRecord(updated));
    return cloneRecord(updated);
  }

  appendEvent(input: CreateDurableCollaborationEventInput): DurableCollaborationEvent {
    this.assertRecordKind(input.recordKind);
    this.requireRecord(input.recordId);
    if (this.events.some((event) => event.id === input.id)) {
      throw new Error(`Durable collaboration event already exists: ${input.id}`);
    }
    const event: DurableCollaborationEvent = {
      ...input,
      group: this.group,
      metadata: sanitizeDurableCollaborationMetadata(input.metadata),
      createdAt: input.createdAt ?? new Date()
    };
    this.events.push(cloneEvent(event));
    return cloneEvent(event);
  }

  listEvents(recordId?: string): DurableCollaborationEvent[] {
    return this.events.filter((event) => !recordId || event.recordId === recordId).map(cloneEvent);
  }

  summarize(): DurableCollaborationRepositorySummary {
    const recordKinds = [...DURABLE_COLLABORATION_RECORD_KINDS_BY_GROUP[this.group]];
    return {
      group: this.group,
      label: DURABLE_COLLABORATION_GROUP_LABELS[this.group],
      providerKind: this.providerKind,
      implemented: true,
      recordKinds,
      tableNames: recordKinds.map((recordKind) => DURABLE_COLLABORATION_RECORD_TABLES[recordKind]),
      recordCount: this.records.size,
      eventCount: this.events.length,
      noSecretsExposed: true,
      envValuesExposed: false,
      databaseUrlExposed: false
    };
  }

  private assertRecordKind(recordKind: DurableCollaborationRecordKind): void {
    const expectedGroup = getDurableCollaborationRecordGroup(recordKind);
    if (expectedGroup !== this.group) {
      throw new Error(`Record kind ${recordKind} belongs to ${expectedGroup}, not ${this.group}.`);
    }
  }

  private requireRecord(id: string): DurableCollaborationRecord {
    const existing = this.records.get(id);
    if (!existing) {
      throw new Error(`Durable collaboration record not found: ${id}`);
    }
    return existing;
  }
}

function createDurableCollaborationSummary(
  providerKind: DurableCollaborationProviderKind,
  repositories: Record<DurableCollaborationRepositoryGroup, DurableCollaborationGroupRepository>,
  input: { optionalPostgresTestsConfigured: boolean }
): DurableCollaborationSummary {
  const repositorySummaries = DURABLE_COLLABORATION_REPOSITORY_GROUPS.map((group) => repositories[group].summarize());
  const inventory = DURABLE_COLLABORATION_STORE_INVENTORY;
  return {
    status: "v1_implemented",
    providerKind,
    defaultRuntime: "in_memory",
    durableCollaborationStoreConfigured: providerKind === "postgres",
    productionReady: false,
    repositoryGroupCount: repositorySummaries.length,
    implementedRepositoryGroupCount: repositorySummaries.filter((summary) => summary.implemented).length,
    requiredDurableRecordCount: inventory.filter((item) => item.classification === "required_durable").length,
    recommendedDurableRecordCount: inventory.filter((item) => item.classification === "recommended_durable").length,
    ephemeralRecordCount: inventory.filter((item) => item.classification === "ephemeral_recomputable").length,
    postgresTableCount: getDurableCollaborationSchemaStatus().tableCount,
    migrationCoverage: "v1_schema_skeleton",
    optionalPostgresSupported: true,
    optionalPostgresTestsConfigured: input.optionalPostgresTestsConfigured,
    noSecretsExposed: repositorySummaries.every((summary) => summary.noSecretsExposed),
    envValuesExposed: repositorySummaries.some((summary) => summary.envValuesExposed),
    databaseUrlExposed: repositorySummaries.some((summary) => summary.databaseUrlExposed),
    remoteGitOperationsExecuted: false,
    workspaceMutationExecuted: false,
    externalCallsExecuted: false,
    metadata: {
      storeMode: "metadata_only",
      realGitOperationsAllowed: false,
      destructiveCleanupAllowed: false,
      rawPayloadStorageAllowed: false,
      credentialStorageAllowed: false
    }
  };
}

function requiredItem(
  modelName: DurableCollaborationRecordKind,
  sourcePath: string,
  currentStorage: string,
  productionImpact: string
): DurableCollaborationStoreInventoryItem {
  return {
    modelName,
    classification: "required_durable",
    group: getDurableCollaborationRecordGroup(modelName),
    sourcePath,
    currentStorage,
    targetStorage: "Durable collaboration repository group plus optional Postgres table",
    repositoryNeeded: true,
    postgresTableNeeded: true,
    tableName: DURABLE_COLLABORATION_RECORD_TABLES[modelName],
    migrationStatus: "implemented_skeleton",
    productionImpact
  };
}

function recommendedItem(
  modelName: string,
  sourcePath: string,
  currentStorage: string,
  targetStorage: string,
  productionImpact: string
): DurableCollaborationStoreInventoryItem {
  return {
    modelName,
    classification: "recommended_durable",
    sourcePath,
    currentStorage,
    targetStorage,
    repositoryNeeded: false,
    postgresTableNeeded: false,
    migrationStatus: "future",
    productionImpact
  };
}

function ephemeralItem(
  modelName: string,
  sourcePath: string,
  currentStorage: string,
  targetStorage: string,
  productionImpact: string
): DurableCollaborationStoreInventoryItem {
  return {
    modelName,
    classification: "ephemeral_recomputable",
    sourcePath,
    currentStorage,
    targetStorage,
    repositoryNeeded: false,
    postgresTableNeeded: false,
    migrationStatus: "not_applicable",
    productionImpact
  };
}

function mergeMetadata(
  existing: DurableCollaborationMetadata,
  metadata: DurableCollaborationMetadata | undefined
): DurableCollaborationMetadata {
  return {
    ...existing,
    ...sanitizeDurableCollaborationMetadata(metadata)
  };
}

function cloneRecord(record: DurableCollaborationRecord): DurableCollaborationRecord {
  return {
    ...record,
    metadata: sanitizeDurableCollaborationMetadata(record.metadata),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt)
  };
}

function cloneEvent(event: DurableCollaborationEvent): DurableCollaborationEvent {
  return {
    ...event,
    metadata: sanitizeDurableCollaborationMetadata(event.metadata),
    createdAt: new Date(event.createdAt)
  };
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        isSensitiveKey(key) ? "[redacted]" : sanitizeValue(entryValue)
      ])
    );
  }
  if (typeof value === "string") {
    if (isSensitiveValue(value) || looksLikeAbsolutePath(value)) {
      return "[redacted]";
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
    return value;
  }
  return String(value);
}

function isSensitiveKey(key: string): boolean {
  return /raw[_-]?payload|rawprompt|prompt|provider[_-]?response|authorization|cookie|token|secret|password|credential|private[_-]?key|api[_-]?key|database[_-]?url|connection[_-]?string|postgres[_-]?url|env[_-]?value|vault/i.test(
    key
  );
}

function isSensitiveValue(value: string): boolean {
  return /(postgres(?:ql)?:\/\/|bearer\s+[a-z0-9._-]+|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|VAULT_TOKEN|DATABASE_URL|AICHESTRA_[A-Z0-9_]*(TOKEN|SECRET|KEY|PASSWORD|DATABASE_URL))/i.test(
    value
  );
}

function looksLikeAbsolutePath(value: string): boolean {
  return /^[A-Za-z]:\\/.test(value) || /^\/(home|users|var|tmp|workspace|mnt)\//i.test(value);
}
