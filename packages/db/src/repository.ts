import {
  assertTaskStatusTransition,
  createConflictRisk,
  createId,
  createRepoSchema,
  createTaskSchema,
  mergeQueueDecision,
  repoFromInput,
  seedHarnesses,
  seedInstructions,
  seedRepos,
  seedSkills,
  seedUsers,
  taskFromInput
} from "@aichestra/core";
import type {
  AuditLog,
  BranchLease,
  BranchLeaseStatus,
  ConflictRisk,
  CreateRepoInput,
  CreateTaskInput,
  GitBranchSyncState,
  GitPullRequestSyncState,
  GitWebhookAuditEvent,
  GitWebhookEvent,
  GitWebhookVerificationResult,
  HarnessPackage,
  InstructionArtifact,
  InstructionSet,
  MergeQueueEntry,
  MergeQueueStatus,
  MergeSimulationResult,
  PullRequest,
  Repo,
  RegistryAuditLogEntry,
  RegistryEvalResult,
  RegistryKind,
  RegistryPackageManifest,
  RegistryRevision,
  RegistryStatus,
  SkillPackage,
  Task,
  TaskRun,
  TaskStatus,
  UsageEvent,
  User
} from "@aichestra/core";

export type AichestraStoreSnapshot = {
  users: User[];
  repos: Repo[];
  tasks: Task[];
  taskRuns: TaskRun[];
  branchLeases: BranchLease[];
  mergeQueueEntries: MergeQueueEntry[];
  mergeSimulations: MergeSimulationResult[];
  pullRequests: PullRequest[];
  gitWebhookEvents: GitWebhookEvent[];
  gitWebhookVerificationResults: GitWebhookVerificationResult[];
  gitPullRequestSyncStates: GitPullRequestSyncState[];
  gitBranchSyncStates: GitBranchSyncState[];
  gitWebhookAuditEvents: GitWebhookAuditEvent[];
  skills: SkillPackage[];
  harnesses: HarnessPackage[];
  instructions: InstructionArtifact[];
  instructionSets: InstructionSet[];
  usageEvents: UsageEvent[];
  auditLogs: AuditLog[];
  registryAuditLogs: RegistryAuditLogEntry[];
  registryRevisions: RegistryRevision[];
  registryEvalResults: RegistryEvalResult[];
  registryPackageManifests: RegistryPackageManifest[];
};

function uniqueOrdered(values: string[]): string[] {
  return [...new Set(values)];
}

function isRegistryStatus(value: unknown): value is RegistryStatus {
  return value === "draft" || value === "active" || value === "deprecated" || value === "archived";
}

function requireRegistryStatus(value: unknown): RegistryStatus {
  if (!isRegistryStatus(value)) {
    throw new Error("Registry status must be draft, active, deprecated, or archived");
  }
  return value;
}

function cloneArray<T>(values: T[]): T[] {
  return structuredClone(values);
}

export class InMemoryAichestraStore {
  private state: AichestraStoreSnapshot;

  constructor(seed: Partial<AichestraStoreSnapshot> = {}) {
    this.state = {
      users: cloneArray(seed.users ?? seedUsers),
      repos: cloneArray(seed.repos ?? seedRepos),
      tasks: cloneArray(seed.tasks ?? []),
      taskRuns: cloneArray(seed.taskRuns ?? []),
      branchLeases: cloneArray(seed.branchLeases ?? []),
      mergeQueueEntries: cloneArray(seed.mergeQueueEntries ?? []),
      mergeSimulations: cloneArray(seed.mergeSimulations ?? []),
      pullRequests: cloneArray(seed.pullRequests ?? []),
      gitWebhookEvents: cloneArray(seed.gitWebhookEvents ?? []),
      gitWebhookVerificationResults: cloneArray(seed.gitWebhookVerificationResults ?? []),
      gitPullRequestSyncStates: cloneArray(seed.gitPullRequestSyncStates ?? []),
      gitBranchSyncStates: cloneArray(seed.gitBranchSyncStates ?? []),
      gitWebhookAuditEvents: cloneArray(seed.gitWebhookAuditEvents ?? []),
      skills: cloneArray(seed.skills ?? seedSkills),
      harnesses: cloneArray(seed.harnesses ?? seedHarnesses),
      instructions: cloneArray(seed.instructions ?? seedInstructions),
      instructionSets: cloneArray(seed.instructionSets ?? []),
      usageEvents: cloneArray(seed.usageEvents ?? []),
      auditLogs: cloneArray(seed.auditLogs ?? []),
      registryAuditLogs: cloneArray(seed.registryAuditLogs ?? []),
      registryRevisions: cloneArray(seed.registryRevisions ?? []),
      registryEvalResults: cloneArray(seed.registryEvalResults ?? []),
      registryPackageManifests: cloneArray(seed.registryPackageManifests ?? [])
    };
  }

  snapshot(): AichestraStoreSnapshot {
    return structuredClone(this.state);
  }

  createRepo(input: unknown): Repo {
    const repo = repoFromInput(createRepoSchema.parse(input) as CreateRepoInput);
    this.state.repos.push(repo);
    return repo;
  }

  listRepos(): Repo[] {
    return [...this.state.repos];
  }

  getRepo(id: string): Repo | undefined {
    return this.state.repos.find((repo) => repo.id === id);
  }

  createTask(input: unknown): Task {
    const task = taskFromInput(createTaskSchema.parse(input) as CreateTaskInput);
    this.state.tasks.push(task);
    this.recordAudit({
      action: "task.created",
      targetType: "task",
      targetId: task.id,
      taskId: task.id,
      actorUserId: task.requesterUserId,
      repoId: task.repoId,
      metadata: { status: task.status }
    });
    return task;
  }

  listTasks(): Task[] {
    return [...this.state.tasks];
  }

  getTask(id: string): Task | undefined {
    return this.state.tasks.find((task) => task.id === id);
  }

  updateTask(id: string, patch: Partial<Task>): Task {
    const task = this.getTask(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    Object.assign(task, patch, { updatedAt: new Date() });
    return task;
  }

  transitionTask(id: string, status: TaskStatus): Task {
    const task = this.getTask(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    const previous = task.status;
    assertTaskStatusTransition(previous, status);
    task.status = status;
    task.updatedAt = new Date();
    this.recordAudit({
      action: "task.status_changed",
      targetType: "task",
      targetId: task.id,
      taskId: task.id,
      actorUserId: task.requesterUserId,
      repoId: task.repoId,
      metadata: { from: previous, to: status }
    });
    return task;
  }

  createTaskRun(input: Omit<TaskRun, "id" | "createdAt" | "updatedAt">): TaskRun {
    const now = new Date();
    const taskRun = {
      ...input,
      id: createId("run"),
      createdAt: now,
      updatedAt: now
    };
    this.state.taskRuns.push(taskRun);
    return taskRun;
  }

  updateTaskRun(id: string, patch: Partial<TaskRun>): TaskRun {
    const taskRun = this.state.taskRuns.find((run) => run.id === id);
    if (!taskRun) {
      throw new Error(`Task run not found: ${id}`);
    }
    Object.assign(taskRun, patch, { updatedAt: new Date() });
    return taskRun;
  }

  listTaskRuns(taskId?: string): TaskRun[] {
    return this.state.taskRuns.filter((run) => taskId === undefined || run.taskId === taskId);
  }

  createBranchLease(input: Omit<BranchLease, "id" | "createdAt" | "updatedAt">): BranchLease {
    const now = new Date();
    const lease = {
      ...input,
      id: createId("lease"),
      createdAt: now,
      updatedAt: now
    };
    this.state.branchLeases.push(lease);
    return lease;
  }

  getBranchLease(id: string): BranchLease | undefined {
    return this.state.branchLeases.find((lease) => lease.id === id);
  }

  updateBranchLease(id: string, patch: Partial<BranchLease>): BranchLease {
    const lease = this.getBranchLease(id);
    if (!lease) {
      throw new Error(`Branch lease not found: ${id}`);
    }
    Object.assign(lease, patch, { updatedAt: new Date() });
    return lease;
  }

  releaseBranchLease(id: string): BranchLease {
    return this.updateBranchLease(id, {
      status: "released",
      releasedAt: new Date()
    });
  }

  listBranchLeases(repoId?: string, status?: BranchLeaseStatus): BranchLease[] {
    return this.state.branchLeases.filter((lease) => {
      const repoMatches = repoId === undefined || lease.repoId === repoId;
      const statusMatches = status === undefined || lease.status === status;
      return repoMatches && statusMatches;
    });
  }

  listActiveBranchLeases(repoId: string): BranchLease[] {
    return this.listBranchLeases(repoId, "active");
  }

  listBranchLeasesByTaskRun(taskRunId: string): BranchLease[] {
    return this.state.branchLeases.filter((lease) => lease.taskRunId === taskRunId);
  }

  recordMergeSimulation(input: MergeSimulationResult): MergeSimulationResult {
    this.state.mergeSimulations.push(input);
    if (input.branchLeaseId) {
      const lease = this.getBranchLease(input.branchLeaseId);
      if (lease) {
        const riskScore = Math.max(this.highestConflictRiskForLease(lease.id)?.riskScore ?? 0, input.riskContribution);
        this.updateTask(lease.taskId, { conflictRiskScore: riskScore });
      }
      this.refreshMergeQueueEntriesForLease(input.branchLeaseId);
    }
    return input;
  }

  listMergeSimulations(filter: { repoId?: string; taskRunId?: string; branchLeaseId?: string } = {}): MergeSimulationResult[] {
    return this.state.mergeSimulations
      .filter((simulation) => {
        const repoMatches = filter.repoId === undefined || simulation.repoId === filter.repoId;
        const taskRunMatches = filter.taskRunId === undefined || simulation.taskRunId === filter.taskRunId;
        const leaseMatches = filter.branchLeaseId === undefined || simulation.branchLeaseId === filter.branchLeaseId;
        return repoMatches && taskRunMatches && leaseMatches;
      })
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id));
  }

  latestMergeSimulationForLease(leaseId: string): MergeSimulationResult | undefined {
    return this.listMergeSimulations({ branchLeaseId: leaseId })[0];
  }

  latestMergeSimulationForTaskRun(taskRunId: string): MergeSimulationResult | undefined {
    return this.listMergeSimulations({ taskRunId })[0];
  }

  private latestMergeSimulationForLeasePair(source: BranchLease, target: BranchLease): MergeSimulationResult | undefined {
    const leaseIds = new Set([source.id, target.id]);
    return this.state.mergeSimulations
      .filter((simulation) => simulation.branchLeaseId !== undefined && leaseIds.has(simulation.branchLeaseId))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id))[0];
  }

  computeRepoConflictRisks(repoId: string): ConflictRisk[] {
    const activeLeases = this.listActiveBranchLeases(repoId);
    const risks: ConflictRisk[] = [];
    for (let sourceIndex = 0; sourceIndex < activeLeases.length; sourceIndex += 1) {
      for (let targetIndex = sourceIndex + 1; targetIndex < activeLeases.length; targetIndex += 1) {
        const source = activeLeases[sourceIndex];
        const target = activeLeases[targetIndex];
        if (!source || !target || source.taskRunId === target.taskRunId || source.taskId === target.taskId) continue;
        risks.push(createConflictRisk(source, target, new Date(), this.latestMergeSimulationForLeasePair(source, target)));
      }
    }
    return risks.sort((left, right) => right.riskScore - left.riskScore || left.id.localeCompare(right.id));
  }

  computeConflictRisksForLease(leaseId: string): ConflictRisk[] {
    const lease = this.getBranchLease(leaseId);
    if (!lease || lease.status !== "active") return [];
    return this.listActiveBranchLeases(lease.repoId)
      .filter((target) => target.id !== lease.id && target.taskRunId !== lease.taskRunId && target.taskId !== lease.taskId)
      .map((target) => createConflictRisk(lease, target, new Date(), this.latestMergeSimulationForLeasePair(lease, target)))
      .sort((left, right) => right.riskScore - left.riskScore || left.id.localeCompare(right.id));
  }

  computeConflictRisksForTaskRun(taskRunId: string): ConflictRisk[] {
    const leaseIds = new Set(this.listBranchLeasesByTaskRun(taskRunId).map((lease) => lease.id));
    return this.state.repos.flatMap((repo) => this.computeRepoConflictRisks(repo.id))
      .filter((risk) => leaseIds.has(risk.sourceLeaseId) || leaseIds.has(risk.targetLeaseId));
  }

  highestConflictRiskForLease(leaseId: string): ConflictRisk | undefined {
    return this.computeConflictRisksForLease(leaseId)[0];
  }

  mergeQueueFieldsForLease(leaseId: string): Pick<
    MergeQueueEntry,
    "riskScore" | "conflictRiskScore" | "status" | "reasons" | "blockingReasons" | "recommendation" | "simulationStatus" | "lastSimulationAt"
  > {
    const risk = this.highestConflictRiskForLease(leaseId);
    const simulation = this.latestMergeSimulationForLease(leaseId);
    const conflictRiskScore = risk?.riskScore ?? 0;
    const riskScore = Math.max(conflictRiskScore, simulation?.riskContribution ?? 0);
    const decision = mergeQueueDecision(riskScore, simulation);

    return {
      riskScore,
      conflictRiskScore,
      status: decision.status,
      reasons: uniqueOrdered([...decision.reasons, ...(risk?.reasons ?? [])]),
      blockingReasons: decision.blockingReasons,
      recommendation: decision.recommendation,
      simulationStatus: simulation?.status,
      lastSimulationAt: simulation?.createdAt
    };
  }

  createPullRequest(input: Omit<PullRequest, "id" | "createdAt" | "updatedAt">): PullRequest {
    const now = new Date();
    const pullRequest = {
      ...input,
      id: createId("pr"),
      createdAt: now,
      updatedAt: now
    };
    this.state.pullRequests.push(pullRequest);
    return pullRequest;
  }

  listPullRequests(taskId?: string): PullRequest[] {
    return this.state.pullRequests.filter((pullRequest) => taskId === undefined || pullRequest.taskId === taskId);
  }

  recordGitWebhookVerificationResult(input: Omit<GitWebhookVerificationResult, "id" | "createdAt">): GitWebhookVerificationResult {
    const result = {
      ...input,
      id: createId("gitverify"),
      createdAt: new Date()
    };
    this.state.gitWebhookVerificationResults.push(result);
    return result;
  }

  listGitWebhookVerificationResults(deliveryId?: string): GitWebhookVerificationResult[] {
    return this.state.gitWebhookVerificationResults
      .filter((result) => deliveryId === undefined || result.deliveryId === deliveryId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id));
  }

  recordGitWebhookEvent(input: Omit<GitWebhookEvent, "id" | "receivedAt">): GitWebhookEvent {
    const event = {
      ...input,
      id: createId("gitwebhook"),
      receivedAt: new Date()
    };
    this.state.gitWebhookEvents.push(event);
    return event;
  }

  updateGitWebhookEvent(id: string, patch: Partial<GitWebhookEvent>): GitWebhookEvent {
    const event = this.getGitWebhookEvent(id);
    if (!event) {
      throw new Error(`Git webhook event not found: ${id}`);
    }
    Object.assign(event, patch);
    return event;
  }

  getGitWebhookEvent(id: string): GitWebhookEvent | undefined {
    return this.state.gitWebhookEvents.find((event) => event.id === id);
  }

  listGitWebhookEvents(filter: { repoRef?: string; eventType?: string; status?: GitWebhookEvent["status"]; deliveryId?: string } = {}): GitWebhookEvent[] {
    return this.state.gitWebhookEvents
      .filter((event) => {
        const repoMatches = filter.repoRef === undefined || event.repoRef === filter.repoRef;
        const eventTypeMatches = filter.eventType === undefined || event.eventType === filter.eventType;
        const statusMatches = filter.status === undefined || event.status === filter.status;
        const deliveryMatches = filter.deliveryId === undefined || event.deliveryId === filter.deliveryId;
        return repoMatches && eventTypeMatches && statusMatches && deliveryMatches;
      })
      .sort((left, right) => right.receivedAt.getTime() - left.receivedAt.getTime() || left.id.localeCompare(right.id));
  }

  upsertGitPullRequestSyncState(input: Omit<GitPullRequestSyncState, "id" | "lastSyncedAt"> & Partial<Pick<GitPullRequestSyncState, "id" | "lastSyncedAt">>): GitPullRequestSyncState {
    const existing = this.state.gitPullRequestSyncStates.find((state) =>
      (input.id !== undefined && state.id === input.id) ||
      (state.repoRef === input.repoRef && state.pullRequestNumber === input.pullRequestNumber)
    );
    const now = new Date();
    if (existing) {
      Object.assign(existing, input, { id: existing.id, lastSyncedAt: input.lastSyncedAt ?? now });
      return existing;
    }
    const state = {
      ...input,
      id: input.id ?? createId("prsync"),
      lastSyncedAt: input.lastSyncedAt ?? now
    };
    this.state.gitPullRequestSyncStates.push(state);
    return state;
  }

  listGitPullRequestSyncStates(repoRef?: string): GitPullRequestSyncState[] {
    return this.state.gitPullRequestSyncStates
      .filter((state) => repoRef === undefined || state.repoRef === repoRef || state.repoId === repoRef)
      .sort((left, right) => right.lastSyncedAt.getTime() - left.lastSyncedAt.getTime() || left.id.localeCompare(right.id));
  }

  getGitPullRequestSyncState(repoRef: string, pullRequestNumber: number): GitPullRequestSyncState | undefined {
    return this.state.gitPullRequestSyncStates.find((state) =>
      (state.repoRef === repoRef || state.repoId === repoRef) && state.pullRequestNumber === pullRequestNumber
    );
  }

  upsertGitBranchSyncState(input: Omit<GitBranchSyncState, "id" | "lastSyncedAt"> & Partial<Pick<GitBranchSyncState, "id" | "lastSyncedAt">>): GitBranchSyncState {
    const existing = this.state.gitBranchSyncStates.find((state) =>
      (input.id !== undefined && state.id === input.id) ||
      (state.repoRef === input.repoRef && state.branchName === input.branchName)
    );
    const now = new Date();
    if (existing) {
      Object.assign(existing, input, { id: existing.id, lastSyncedAt: input.lastSyncedAt ?? now });
      return existing;
    }
    const state = {
      ...input,
      id: input.id ?? createId("branchsync"),
      lastSyncedAt: input.lastSyncedAt ?? now
    };
    this.state.gitBranchSyncStates.push(state);
    return state;
  }

  listGitBranchSyncStates(repoRef?: string): GitBranchSyncState[] {
    return this.state.gitBranchSyncStates
      .filter((state) => repoRef === undefined || state.repoRef === repoRef || state.repoId === repoRef)
      .sort((left, right) => right.lastSyncedAt.getTime() - left.lastSyncedAt.getTime() || left.id.localeCompare(right.id));
  }

  getGitBranchSyncState(repoRef: string, branchName: string): GitBranchSyncState | undefined {
    return this.state.gitBranchSyncStates.find((state) =>
      (state.repoRef === repoRef || state.repoId === repoRef) && state.branchName === branchName
    );
  }

  recordGitWebhookAuditEvent(input: Omit<GitWebhookAuditEvent, "id" | "createdAt">): GitWebhookAuditEvent {
    const event = {
      ...input,
      id: createId("gitwhaudit"),
      createdAt: new Date()
    };
    this.state.gitWebhookAuditEvents.push(event);
    return event;
  }

  listGitWebhookAuditEvents(filter: { eventType?: string; repoRef?: string; deliveryId?: string } = {}): GitWebhookAuditEvent[] {
    return this.state.gitWebhookAuditEvents
      .filter((event) => {
        const eventTypeMatches = filter.eventType === undefined || event.eventType === filter.eventType;
        const repoMatches = filter.repoRef === undefined || event.repoRef === filter.repoRef;
        const deliveryMatches = filter.deliveryId === undefined || event.deliveryId === filter.deliveryId;
        return eventTypeMatches && repoMatches && deliveryMatches;
      })
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id));
  }

  createMergeQueueEntry(
    input: Omit<
      MergeQueueEntry,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "status"
      | "reasons"
      | "blockingReasons"
      | "recommendation"
      | "conflictRiskScore"
      | "simulationStatus"
      | "lastSimulationAt"
    > & {
      status?: MergeQueueStatus;
      reasons?: string[];
      blockingReasons?: string[];
      recommendation?: MergeQueueEntry["recommendation"];
      conflictRiskScore?: number;
      simulationStatus?: MergeQueueEntry["simulationStatus"];
      lastSimulationAt?: Date;
    }
  ): MergeQueueEntry {
    const now = new Date();
    const derived = this.mergeQueueFieldsForLease(input.branchLeaseId);
    const entry = {
      ...input,
      id: createId("queue"),
      riskScore: Math.max(input.riskScore, derived.riskScore),
      conflictRiskScore: input.conflictRiskScore ?? derived.conflictRiskScore,
      status: input.status ?? derived.status,
      reasons: uniqueOrdered([...(input.reasons ?? []), ...derived.reasons]),
      blockingReasons: input.blockingReasons ?? derived.blockingReasons,
      recommendation: input.recommendation ?? derived.recommendation,
      simulationStatus: input.simulationStatus ?? derived.simulationStatus,
      lastSimulationAt: input.lastSimulationAt ?? derived.lastSimulationAt,
      createdAt: now,
      updatedAt: now
    };
    this.state.mergeQueueEntries.push(entry);
    return entry;
  }

  getMergeQueueEntry(id: string): MergeQueueEntry | undefined {
    return this.state.mergeQueueEntries.find((entry) => entry.id === id);
  }

  updateMergeQueueEntry(id: string, patch: Partial<MergeQueueEntry>): MergeQueueEntry {
    const entry = this.getMergeQueueEntry(id);
    if (!entry) {
      throw new Error(`Merge queue entry not found: ${id}`);
    }
    Object.assign(entry, patch, { updatedAt: new Date() });
    return entry;
  }

  listMergeQueueEntries(repoId?: string): MergeQueueEntry[] {
    return this.state.mergeQueueEntries
      .filter((entry) => repoId === undefined || entry.repoId === repoId)
      .sort((left, right) => left.priority - right.priority || left.createdAt.getTime() - right.createdAt.getTime());
  }

  refreshMergeQueueEntryRisk(id: string): MergeQueueEntry {
    const entry = this.getMergeQueueEntry(id);
    if (!entry) {
      throw new Error(`Merge queue entry not found: ${id}`);
    }
    const fields = this.mergeQueueFieldsForLease(entry.branchLeaseId);
    return this.updateMergeQueueEntry(id, {
      ...fields
    });
  }

  refreshMergeQueueEntriesForLease(leaseId: string): MergeQueueEntry[] {
    return this.state.mergeQueueEntries
      .filter((entry) => entry.branchLeaseId === leaseId && entry.status !== "merged" && entry.status !== "cancelled")
      .map((entry) => this.refreshMergeQueueEntryRisk(entry.id));
  }

  markMergeQueueEntryMerged(id: string): MergeQueueEntry {
    const entry = this.getMergeQueueEntry(id);
    if (!entry) {
      throw new Error(`Merge queue entry not found: ${id}`);
    }
    this.releaseBranchLease(entry.branchLeaseId);
    return this.updateMergeQueueEntry(id, {
      status: "merged",
      mergedAt: new Date()
    });
  }

  cancelMergeQueueEntry(id: string, reason = "cancelled"): MergeQueueEntry {
    const entry = this.getMergeQueueEntry(id);
    if (!entry) {
      throw new Error(`Merge queue entry not found: ${id}`);
    }
    this.releaseBranchLease(entry.branchLeaseId);
    return this.updateMergeQueueEntry(id, {
      status: "cancelled",
      cancelledAt: new Date(),
      reasons: [...entry.reasons, reason]
    });
  }

  listSkills(): SkillPackage[] {
    return [...this.state.skills];
  }

  getSkill(id: string): SkillPackage | undefined {
    return this.state.skills.find((skill) => skill.id === id);
  }

  getSkillById(id: string): SkillPackage | undefined {
    return this.getSkill(id);
  }

  getSkillByNameVersion(name: string, version: string): SkillPackage | undefined {
    return this.state.skills.find((skill) => skill.name === name && skill.version === version);
  }

  createSkill(input: Omit<SkillPackage, "id" | "createdAt" | "updatedAt"> & Partial<Pick<SkillPackage, "id">>): SkillPackage {
    const now = new Date();
    const skill = {
      ...input,
      id: input.id ?? createId("skill"),
      status: requireRegistryStatus(input.status),
      createdAt: now,
      updatedAt: now
    };
    this.state.skills.push(skill);
    return skill;
  }

  updateSkillStatus(id: string, status: RegistryStatus): SkillPackage {
    const skill = this.getSkill(id);
    if (!skill) {
      throw new Error(`Skill not found: ${id}`);
    }
    skill.status = requireRegistryStatus(status);
    skill.updatedAt = new Date();
    return skill;
  }

  updateSkill(id: string, patch: Partial<SkillPackage>): SkillPackage {
    const skill = this.getSkill(id);
    if (!skill) {
      throw new Error(`Skill not found: ${id}`);
    }
    Object.assign(skill, patch, { updatedAt: new Date() });
    return skill;
  }

  listHarnesses(): HarnessPackage[] {
    return [...this.state.harnesses];
  }

  getHarness(id: string): HarnessPackage | undefined {
    return this.state.harnesses.find((harness) => harness.id === id);
  }

  getHarnessById(id: string): HarnessPackage | undefined {
    return this.getHarness(id);
  }

  getHarnessByNameVersion(name: string, version: string): HarnessPackage | undefined {
    return this.state.harnesses.find((harness) => harness.name === name && harness.version === version);
  }

  createHarness(input: Omit<HarnessPackage, "id" | "createdAt" | "updatedAt"> & Partial<Pick<HarnessPackage, "id">>): HarnessPackage {
    const now = new Date();
    const harness = {
      ...input,
      id: input.id ?? createId("harness"),
      status: requireRegistryStatus(input.status),
      createdAt: now,
      updatedAt: now
    };
    this.state.harnesses.push(harness);
    return harness;
  }

  updateHarnessStatus(id: string, status: RegistryStatus): HarnessPackage {
    const harness = this.getHarness(id);
    if (!harness) {
      throw new Error(`Harness not found: ${id}`);
    }
    harness.status = requireRegistryStatus(status);
    harness.updatedAt = new Date();
    return harness;
  }

  updateHarness(id: string, patch: Partial<HarnessPackage>): HarnessPackage {
    const harness = this.getHarness(id);
    if (!harness) {
      throw new Error(`Harness not found: ${id}`);
    }
    Object.assign(harness, patch, { updatedAt: new Date() });
    return harness;
  }

  listInstructions(): InstructionArtifact[] {
    return [...this.state.instructions];
  }

  getInstruction(id: string): InstructionArtifact | undefined {
    return this.state.instructions.find((instruction) => instruction.id === id);
  }

  getInstructionById(id: string): InstructionArtifact | undefined {
    return this.getInstruction(id);
  }

  getInstructionByNameVersion(name: string, version: string): InstructionArtifact | undefined {
    return this.state.instructions.find((instruction) => instruction.name === name && instruction.version === version);
  }

  createInstruction(
    input: Omit<InstructionArtifact, "id" | "createdAt" | "updatedAt"> & Partial<Pick<InstructionArtifact, "id">>
  ): InstructionArtifact {
    const now = new Date();
    const instruction = {
      ...input,
      id: input.id ?? createId("instr"),
      status: requireRegistryStatus(input.status),
      createdAt: now,
      updatedAt: now
    };
    this.state.instructions.push(instruction);
    return instruction;
  }

  updateInstructionStatus(id: string, status: RegistryStatus): InstructionArtifact {
    const instruction = this.getInstruction(id);
    if (!instruction) {
      throw new Error(`Instruction artifact not found: ${id}`);
    }
    instruction.status = requireRegistryStatus(status);
    instruction.updatedAt = new Date();
    return instruction;
  }

  updateInstruction(id: string, patch: Partial<InstructionArtifact>): InstructionArtifact {
    const instruction = this.getInstruction(id);
    if (!instruction) {
      throw new Error(`Instruction artifact not found: ${id}`);
    }
    Object.assign(instruction, patch, { updatedAt: new Date() });
    return instruction;
  }

  saveInstructionSet(instructionSet: InstructionSet): InstructionSet {
    this.state.instructionSets.push(instructionSet);
    return instructionSet;
  }

  recordUsage(input: Omit<UsageEvent, "id" | "createdAt">): UsageEvent {
    const usageEvent = {
      ...input,
      id: createId("usage"),
      createdAt: new Date()
    };
    this.state.usageEvents.push(usageEvent);
    return usageEvent;
  }

  listUsageEvents(): UsageEvent[] {
    return [...this.state.usageEvents];
  }

  recordAudit(input: Omit<AuditLog, "id" | "createdAt">): AuditLog {
    const auditLog = {
      ...input,
      id: createId("audit"),
      createdAt: new Date()
    };
    this.state.auditLogs.push(auditLog);
    return auditLog;
  }

  listAuditLogs(): AuditLog[] {
    return [...this.state.auditLogs];
  }

  appendAuditLog(input: Omit<RegistryAuditLogEntry, "id" | "createdAt">): RegistryAuditLogEntry {
    const auditLog = {
      ...input,
      id: createId("regaudit"),
      createdAt: new Date()
    };
    this.state.registryAuditLogs.push(auditLog);
    return auditLog;
  }

  listRegistryAuditLogs(): RegistryAuditLogEntry[] {
    return [...this.state.registryAuditLogs];
  }

  listAuditLogsForTarget(targetKind: RegistryKind, targetId: string): RegistryAuditLogEntry[] {
    return this.state.registryAuditLogs.filter((log) => log.targetKind === targetKind && log.targetId === targetId);
  }

  appendRevision(input: Omit<RegistryRevision, "id" | "createdAt">): RegistryRevision {
    const revision = {
      ...input,
      id: createId("regrev"),
      createdAt: new Date()
    };
    this.state.registryRevisions.push(revision);
    return revision;
  }

  listRevisionsForTarget(targetKind: RegistryKind, targetId: string): RegistryRevision[] {
    return this.state.registryRevisions
      .filter((revision) => revision.targetKind === targetKind && revision.targetId === targetId)
      .sort((left, right) => left.revisionNumber - right.revisionNumber || left.createdAt.getTime() - right.createdAt.getTime());
  }

  getRevision(id: string): RegistryRevision | undefined {
    return this.state.registryRevisions.find((revision) => revision.id === id);
  }

  getLatestRevisionForTarget(targetKind: RegistryKind, targetId: string): RegistryRevision | undefined {
    return this.listRevisionsForTarget(targetKind, targetId).at(-1);
  }

  appendEvalResult(input: Omit<RegistryEvalResult, "id" | "attachedAt">): RegistryEvalResult {
    const result = {
      ...input,
      id: createId("regeval"),
      attachedAt: new Date()
    };
    this.state.registryEvalResults.push(result);
    return result;
  }

  listEvalResultsForTarget(targetKind: RegistryKind, targetId: string): RegistryEvalResult[] {
    return this.state.registryEvalResults
      .filter((result) => result.targetKind === targetKind && result.targetId === targetId)
      .sort((left, right) => left.attachedAt.getTime() - right.attachedAt.getTime() || left.id.localeCompare(right.id));
  }

  getLatestEvalResultForTarget(targetKind: RegistryKind, targetId: string): RegistryEvalResult | undefined {
    return this.listEvalResultsForTarget(targetKind, targetId).at(-1);
  }

  createPackageManifest(input: RegistryPackageManifest): RegistryPackageManifest {
    this.state.registryPackageManifests.push(structuredClone(input));
    return structuredClone(input);
  }

  listPackageManifests(): RegistryPackageManifest[] {
    return structuredClone(this.state.registryPackageManifests);
  }

  getPackageManifestById(id: string): RegistryPackageManifest | undefined {
    return structuredClone(this.state.registryPackageManifests.find((manifest) => manifest.id === id));
  }

  getPackageManifestByNameVersion(name: string, version: string): RegistryPackageManifest | undefined {
    return structuredClone(this.state.registryPackageManifests.find((manifest) => manifest.name === name && manifest.version === version));
  }
}

export function createSeededStore(): InMemoryAichestraStore {
  return new InMemoryAichestraStore();
}
