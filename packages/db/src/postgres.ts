import { spawnSync } from "node:child_process";
import {
  assertTaskStatusTransition,
  createConflictRisk,
  createId,
  createRepoSchema,
  createTaskSchema,
  mergeQueueDecision,
  repoFromInput,
  taskFromInput
} from "@aichestra/core";
import type {
  AuditLog,
  BranchLease,
  BranchLeaseStatus,
  ConflictRisk,
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
  RegistryAuditLogEntry,
  RegistryEvalResult,
  RegistryKind,
  RegistryPackageManifest,
  RegistryRevision,
  RegistryStatus,
  Repo,
  SkillPackage,
  Task,
  TaskRun,
  TaskStatus,
  UsageEvent,
  CreateRepoInput,
  CreateTaskInput
} from "@aichestra/core";
import { InMemoryImprovementRepository, type ImprovementRepository } from "@aichestra/improvement";
import type { RegistryServiceInput } from "@aichestra/registry";
import {
  createDurableCollaborationRepositorySet,
  DURABLE_COLLABORATION_GROUP_LABELS,
  DURABLE_COLLABORATION_RECORD_KINDS_BY_GROUP,
  DURABLE_COLLABORATION_RECORD_TABLES,
  DURABLE_COLLABORATION_REPOSITORY_GROUPS,
  getDurableCollaborationRecordGroup,
  sanitizeDurableCollaborationMetadata,
  type CreateDurableCollaborationEventInput,
  type CreateDurableCollaborationRecordInput,
  type DurableCollaborationEvent,
  type DurableCollaborationGroupRepository,
  type DurableCollaborationMetadata,
  type DurableCollaborationRecord,
  type DurableCollaborationRecordKind,
  type DurableCollaborationRepositories,
  type DurableCollaborationRepositoryGroup,
  type DurableCollaborationRepositorySummary,
  type UpdateDurableCollaborationStatusInput
} from "./durable-collaboration.ts";
import { InMemoryAichestraStore } from "./repository.ts";
import type {
  ConflictRepositories,
  RepositoryFactory,
  StorageHealth,
  StorageProvider,
  TaskRepository,
  TaskRunRepository,
  UsageLedgerRepository
} from "./storage.ts";
import { MockUsageLedger, type UsageLedger } from "./usage-ledger.ts";

export type DatabaseClient = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string): T[];
  execute(sql: string): void;
  transaction<T>(callback: (client: DatabaseClient) => T): T;
  healthCheck(): StorageHealth;
  close(): void;
};

export type PostgresStorageProviderInput = {
  databaseUrl: string;
  psqlBin?: string;
  improvementRepository?: ImprovementRepository;
};

type Row = Record<string, unknown>;

const jsonPrefix = "aichestra_json:";

export class PsqlCliDatabaseClient implements DatabaseClient {
  private readonly databaseUrl: string;
  private readonly psqlBin: string;

  constructor(input: { databaseUrl: string; psqlBin?: string }) {
    if (!input.databaseUrl) {
      throw new Error("AICHESTRA_DATABASE_URL is required when AICHESTRA_STORAGE_PROVIDER=postgres.");
    }
    this.databaseUrl = input.databaseUrl;
    this.psqlBin = input.psqlBin ?? "psql";
  }

  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string): T[] {
    const wrappedSql = [
      "SELECT",
      `${sqlLiteral(jsonPrefix)} || COALESCE(json_agg(row_to_json(__aichestra_query)), '[]'::json)::text`,
      "FROM (",
      sql,
      ") AS __aichestra_query"
    ].join(" ");
    const output = this.run(wrappedSql);
    const line = output
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find((value) => value.startsWith(jsonPrefix));
    if (!line) return [];
    return JSON.parse(line.slice(jsonPrefix.length)) as T[];
  }

  execute(sql: string): void {
    this.run(sql);
  }

  transaction<T>(callback: (client: DatabaseClient) => T): T {
    this.execute("BEGIN");
    try {
      const result = callback(this);
      this.execute("COMMIT");
      return result;
    } catch (error) {
      this.execute("ROLLBACK");
      throw error;
    }
  }

  healthCheck(): StorageHealth {
    try {
      this.execute("SELECT 1");
      return {
        kind: "postgres",
        healthy: true,
        message: "Postgres storage provider is reachable.",
        checkedAt: new Date()
      };
    } catch (error) {
      return {
        kind: "postgres",
        healthy: false,
        message: sanitizeDatabaseError(error),
        checkedAt: new Date()
      };
    }
  }

  close(): void {
    // psql is invoked per query, so there is no process or pool to close.
  }

  private run(sql: string): string {
    const result = spawnSync(
      this.psqlBin,
      ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", this.databaseUrl, "-c", sql],
      { encoding: "utf8", windowsHide: true }
    );

    if (result.error) {
      throw new Error(`Postgres command failed: ${result.error.message}`);
    }
    if (result.status !== 0) {
      const stderr = sanitizeDatabaseMessage(result.stderr);
      const stdout = sanitizeDatabaseMessage(result.stdout);
      throw new Error(`Postgres command failed with status ${result.status}: ${stderr || stdout || "no output"}`);
    }
    return result.stdout;
  }
}

export class PostgresAichestraStore extends InMemoryAichestraStore {
  private readonly client: DatabaseClient;

  constructor(client: DatabaseClient) {
    super({
      users: [],
      repos: [],
      tasks: [],
      taskRuns: [],
      branchLeases: [],
      mergeQueueEntries: [],
      mergeSimulations: [],
      pullRequests: [],
      gitWebhookEvents: [],
      gitWebhookVerificationResults: [],
      gitPullRequestSyncStates: [],
      gitBranchSyncStates: [],
      gitWebhookAuditEvents: [],
      skills: [],
      harnesses: [],
      instructions: [],
      instructionSets: [],
      usageEvents: [],
      auditLogs: [],
      registryAuditLogs: [],
      registryRevisions: [],
      registryEvalResults: [],
      registryPackageManifests: []
    });
    this.client = client;
  }

  override createRepo(input: unknown): Repo {
    const repo = repoFromInput(createRepoSchema.parse(input) as CreateRepoInput);
    this.insert("repos", repoToDb(repo));
    return repo;
  }

  override listRepos(): Repo[] {
    return this.rows(`${repoSelect()} ORDER BY created_at, id`).map(mapRepo);
  }

  override getRepo(id: string): Repo | undefined {
    const row = this.one(`${repoSelect()} WHERE id = ${sqlLiteral(id)}`);
    return row ? mapRepo(row) : undefined;
  }

  override createTask(input: unknown): Task {
    const task = taskFromInput(createTaskSchema.parse(input) as CreateTaskInput);
    this.insert("tasks", taskToDb(task));
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

  override listTasks(): Task[] {
    return this.rows(`${taskSelect()} ORDER BY created_at, id`).map(mapTask);
  }

  override getTask(id: string): Task | undefined {
    const row = this.one(`${taskSelect()} WHERE id = ${sqlLiteral(id)}`);
    return row ? mapTask(row) : undefined;
  }

  override updateTask(id: string, patch: Partial<Task>): Task {
    const current = required(this.getTask(id), `Task not found: ${id}`);
    const updated = { ...current, ...patch, updatedAt: new Date() };
    this.update("tasks", taskToDb(updated), `id = ${sqlLiteral(id)}`);
    return updated;
  }

  override transitionTask(id: string, status: TaskStatus): Task {
    const task = required(this.getTask(id), `Task not found: ${id}`);
    const previous = task.status;
    assertTaskStatusTransition(previous, status);
    const updated = this.updateTask(id, { status });
    this.recordAudit({
      action: "task.status_changed",
      targetType: "task",
      targetId: task.id,
      taskId: task.id,
      actorUserId: task.requesterUserId,
      repoId: task.repoId,
      metadata: { from: previous, to: status }
    });
    return updated;
  }

  override createTaskRun(input: Parameters<InMemoryAichestraStore["createTaskRun"]>[0]): TaskRun {
    const now = new Date();
    const taskRun = {
      ...input,
      id: createId("run"),
      createdAt: now,
      updatedAt: now
    };
    this.insert("task_runs", taskRunToDb(taskRun));
    return taskRun;
  }

  override updateTaskRun(id: string, patch: Partial<TaskRun>): TaskRun {
    const current = required(this.listTaskRuns().find((run) => run.id === id), `Task run not found: ${id}`);
    const updated = { ...current, ...patch, updatedAt: new Date() };
    this.update("task_runs", taskRunToDb(updated), `id = ${sqlLiteral(id)}`);
    return updated;
  }

  override listTaskRuns(taskId?: string): TaskRun[] {
    const where = taskId ? ` WHERE task_id = ${sqlLiteral(taskId)}` : "";
    return this.rows(`${taskRunSelect()}${where} ORDER BY created_at, id`).map(mapTaskRun);
  }

  override createBranchLease(input: Parameters<InMemoryAichestraStore["createBranchLease"]>[0]): BranchLease {
    const now = new Date();
    const lease = {
      ...input,
      id: createId("lease"),
      createdAt: now,
      updatedAt: now
    };
    this.insert("branch_leases", branchLeaseToDb(lease));
    return lease;
  }

  override getBranchLease(id: string): BranchLease | undefined {
    const row = this.one(`${branchLeaseSelect()} WHERE id = ${sqlLiteral(id)}`);
    return row ? mapBranchLease(row) : undefined;
  }

  override updateBranchLease(id: string, patch: Partial<BranchLease>): BranchLease {
    const current = required(this.getBranchLease(id), `Branch lease not found: ${id}`);
    const updated = { ...current, ...patch, updatedAt: new Date() };
    this.update("branch_leases", branchLeaseToDb(updated), `id = ${sqlLiteral(id)}`);
    return updated;
  }

  override releaseBranchLease(id: string): BranchLease {
    return this.updateBranchLease(id, { status: "released", releasedAt: new Date() });
  }

  override listBranchLeases(repoId?: string, status?: BranchLeaseStatus): BranchLease[] {
    const conditions = [
      repoId ? `repo_id = ${sqlLiteral(repoId)}` : undefined,
      status ? `status = ${sqlLiteral(status)}` : undefined
    ].filter(Boolean);
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    return this.rows(`${branchLeaseSelect()}${where} ORDER BY created_at, id`).map(mapBranchLease);
  }

  override listActiveBranchLeases(repoId: string): BranchLease[] {
    return this.listBranchLeases(repoId, "active");
  }

  override listBranchLeasesByTaskRun(taskRunId: string): BranchLease[] {
    return this.rows(`${branchLeaseSelect()} WHERE task_run_id = ${sqlLiteral(taskRunId)} ORDER BY created_at, id`).map(mapBranchLease);
  }

  override recordMergeSimulation(input: MergeSimulationResult): MergeSimulationResult {
    this.insert("merge_simulation_results", mergeSimulationToDb(input));
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

  override listMergeSimulations(filter: { repoId?: string; taskRunId?: string; branchLeaseId?: string } = {}): MergeSimulationResult[] {
    const conditions = [
      filter.repoId ? `repo_id = ${sqlLiteral(filter.repoId)}` : undefined,
      filter.taskRunId ? `task_run_id = ${sqlLiteral(filter.taskRunId)}` : undefined,
      filter.branchLeaseId ? `branch_lease_id = ${sqlLiteral(filter.branchLeaseId)}` : undefined
    ].filter(Boolean);
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    return this.rows(`${mergeSimulationSelect()}${where} ORDER BY created_at DESC, id`).map(mapMergeSimulation);
  }

  override latestMergeSimulationForLease(leaseId: string): MergeSimulationResult | undefined {
    return this.listMergeSimulations({ branchLeaseId: leaseId })[0];
  }

  override latestMergeSimulationForTaskRun(taskRunId: string): MergeSimulationResult | undefined {
    return this.listMergeSimulations({ taskRunId })[0];
  }

  override computeRepoConflictRisks(repoId: string): ConflictRisk[] {
    const activeLeases = this.listActiveBranchLeases(repoId);
    const risks: ConflictRisk[] = [];
    for (let sourceIndex = 0; sourceIndex < activeLeases.length; sourceIndex += 1) {
      for (let targetIndex = sourceIndex + 1; targetIndex < activeLeases.length; targetIndex += 1) {
        const source = activeLeases[sourceIndex];
        const target = activeLeases[targetIndex];
        if (!source || !target || source.taskRunId === target.taskRunId || source.taskId === target.taskId) continue;
        risks.push(createConflictRisk(source, target, new Date(), this.latestMergeSimulationForLeasePairPostgres(source, target)));
      }
    }
    return risks.sort((left, right) => right.riskScore - left.riskScore || left.id.localeCompare(right.id));
  }

  override computeConflictRisksForLease(leaseId: string): ConflictRisk[] {
    const lease = this.getBranchLease(leaseId);
    if (!lease || lease.status !== "active") return [];
    return this.listActiveBranchLeases(lease.repoId)
      .filter((target) => target.id !== lease.id && target.taskRunId !== lease.taskRunId && target.taskId !== lease.taskId)
      .map((target) => createConflictRisk(lease, target, new Date(), this.latestMergeSimulationForLeasePairPostgres(lease, target)))
      .sort((left, right) => right.riskScore - left.riskScore || left.id.localeCompare(right.id));
  }

  override computeConflictRisksForTaskRun(taskRunId: string): ConflictRisk[] {
    const leaseIds = new Set(this.listBranchLeasesByTaskRun(taskRunId).map((lease) => lease.id));
    return this.listRepos()
      .flatMap((repo) => this.computeRepoConflictRisks(repo.id))
      .filter((risk) => leaseIds.has(risk.sourceLeaseId) || leaseIds.has(risk.targetLeaseId));
  }

  override highestConflictRiskForLease(leaseId: string): ConflictRisk | undefined {
    return this.computeConflictRisksForLease(leaseId)[0];
  }

  override mergeQueueFieldsForLease(leaseId: string): ReturnType<InMemoryAichestraStore["mergeQueueFieldsForLease"]> {
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

  override createPullRequest(input: Parameters<InMemoryAichestraStore["createPullRequest"]>[0]): PullRequest {
    const now = new Date();
    const pullRequest = {
      ...input,
      id: createId("pr"),
      createdAt: now,
      updatedAt: now
    };
    this.insert("pull_requests", pullRequestToDb(pullRequest));
    return pullRequest;
  }

  override listPullRequests(taskId?: string): PullRequest[] {
    const where = taskId ? ` WHERE task_id = ${sqlLiteral(taskId)}` : "";
    return this.rows(`${pullRequestSelect()}${where} ORDER BY created_at, id`).map(mapPullRequest);
  }

  override recordGitWebhookVerificationResult(input: Parameters<InMemoryAichestraStore["recordGitWebhookVerificationResult"]>[0]): GitWebhookVerificationResult {
    const result = {
      ...input,
      id: createId("gitverify"),
      createdAt: new Date()
    };
    this.insert("git_webhook_verification_results", gitWebhookVerificationToDb(result));
    return result;
  }

  override listGitWebhookVerificationResults(deliveryId?: string): GitWebhookVerificationResult[] {
    const where = deliveryId ? ` WHERE delivery_id = ${sqlLiteral(deliveryId)}` : "";
    return this.rows(`${gitWebhookVerificationSelect()}${where} ORDER BY created_at DESC, id`).map(mapGitWebhookVerification);
  }

  override recordGitWebhookEvent(input: Parameters<InMemoryAichestraStore["recordGitWebhookEvent"]>[0]): GitWebhookEvent {
    const event = {
      ...input,
      id: createId("gitwebhook"),
      receivedAt: new Date()
    };
    this.insert("git_webhook_events", gitWebhookEventToDb(event));
    return event;
  }

  override updateGitWebhookEvent(id: string, patch: Partial<GitWebhookEvent>): GitWebhookEvent {
    const current = required(this.getGitWebhookEvent(id), `Git webhook event not found: ${id}`);
    const updated = { ...current, ...patch };
    this.update("git_webhook_events", gitWebhookEventToDb(updated), `id = ${sqlLiteral(id)}`);
    return updated;
  }

  override getGitWebhookEvent(id: string): GitWebhookEvent | undefined {
    const row = this.one(`${gitWebhookEventSelect()} WHERE id = ${sqlLiteral(id)}`);
    return row ? mapGitWebhookEvent(row) : undefined;
  }

  override listGitWebhookEvents(filter: { repoRef?: string; eventType?: string; status?: GitWebhookEvent["status"]; deliveryId?: string } = {}): GitWebhookEvent[] {
    const conditions = [
      filter.repoRef ? `repo_ref = ${sqlLiteral(filter.repoRef)}` : undefined,
      filter.eventType ? `event_type = ${sqlLiteral(filter.eventType)}` : undefined,
      filter.status ? `status = ${sqlLiteral(filter.status)}` : undefined,
      filter.deliveryId ? `delivery_id = ${sqlLiteral(filter.deliveryId)}` : undefined
    ].filter(Boolean);
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    return this.rows(`${gitWebhookEventSelect()}${where} ORDER BY received_at DESC, id`).map(mapGitWebhookEvent);
  }

  override upsertGitPullRequestSyncState(input: Parameters<InMemoryAichestraStore["upsertGitPullRequestSyncState"]>[0]): GitPullRequestSyncState {
    const existing = input.id
      ? this.one(`${gitPullRequestSyncSelect()} WHERE id = ${sqlLiteral(input.id)}`)
      : this.one(`${gitPullRequestSyncSelect()} WHERE repo_ref = ${sqlLiteral(input.repoRef)} AND pull_request_number = ${input.pullRequestNumber}`);
    const now = new Date();
    const state = {
      ...input,
      id: existing ? asString(existing, "id") : input.id ?? createId("prsync"),
      lastSyncedAt: input.lastSyncedAt ?? now
    };
    if (existing) this.update("git_pull_request_sync_states", gitPullRequestSyncToDb(state), `id = ${sqlLiteral(state.id)}`);
    else this.insert("git_pull_request_sync_states", gitPullRequestSyncToDb(state));
    return state;
  }

  override listGitPullRequestSyncStates(repoRef?: string): GitPullRequestSyncState[] {
    const where = repoRef ? ` WHERE repo_ref = ${sqlLiteral(repoRef)} OR repo_id = ${sqlLiteral(repoRef)}` : "";
    return this.rows(`${gitPullRequestSyncSelect()}${where} ORDER BY last_synced_at DESC, id`).map(mapGitPullRequestSync);
  }

  override getGitPullRequestSyncState(repoRef: string, pullRequestNumber: number): GitPullRequestSyncState | undefined {
    const row = this.one(`${gitPullRequestSyncSelect()} WHERE (repo_ref = ${sqlLiteral(repoRef)} OR repo_id = ${sqlLiteral(repoRef)}) AND pull_request_number = ${pullRequestNumber}`);
    return row ? mapGitPullRequestSync(row) : undefined;
  }

  override upsertGitBranchSyncState(input: Parameters<InMemoryAichestraStore["upsertGitBranchSyncState"]>[0]): GitBranchSyncState {
    const existing = input.id
      ? this.one(`${gitBranchSyncSelect()} WHERE id = ${sqlLiteral(input.id)}`)
      : this.one(`${gitBranchSyncSelect()} WHERE repo_ref = ${sqlLiteral(input.repoRef)} AND branch_name = ${sqlLiteral(input.branchName)}`);
    const now = new Date();
    const state = {
      ...input,
      id: existing ? asString(existing, "id") : input.id ?? createId("branchsync"),
      lastSyncedAt: input.lastSyncedAt ?? now
    };
    if (existing) this.update("git_branch_sync_states", gitBranchSyncToDb(state), `id = ${sqlLiteral(state.id)}`);
    else this.insert("git_branch_sync_states", gitBranchSyncToDb(state));
    return state;
  }

  override listGitBranchSyncStates(repoRef?: string): GitBranchSyncState[] {
    const where = repoRef ? ` WHERE repo_ref = ${sqlLiteral(repoRef)} OR repo_id = ${sqlLiteral(repoRef)}` : "";
    return this.rows(`${gitBranchSyncSelect()}${where} ORDER BY last_synced_at DESC, id`).map(mapGitBranchSync);
  }

  override getGitBranchSyncState(repoRef: string, branchName: string): GitBranchSyncState | undefined {
    const row = this.one(`${gitBranchSyncSelect()} WHERE (repo_ref = ${sqlLiteral(repoRef)} OR repo_id = ${sqlLiteral(repoRef)}) AND branch_name = ${sqlLiteral(branchName)}`);
    return row ? mapGitBranchSync(row) : undefined;
  }

  override recordGitWebhookAuditEvent(input: Parameters<InMemoryAichestraStore["recordGitWebhookAuditEvent"]>[0]): GitWebhookAuditEvent {
    const event = {
      ...input,
      id: createId("gitwhaudit"),
      createdAt: new Date()
    };
    this.insert("git_webhook_audit_events", gitWebhookAuditToDb(event));
    return event;
  }

  override listGitWebhookAuditEvents(filter: { eventType?: string; repoRef?: string; deliveryId?: string } = {}): GitWebhookAuditEvent[] {
    const conditions = [
      filter.eventType ? `event_type = ${sqlLiteral(filter.eventType)}` : undefined,
      filter.repoRef ? `repo_ref = ${sqlLiteral(filter.repoRef)}` : undefined,
      filter.deliveryId ? `delivery_id = ${sqlLiteral(filter.deliveryId)}` : undefined
    ].filter(Boolean);
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
    return this.rows(`${gitWebhookAuditSelect()}${where} ORDER BY created_at DESC, id`).map(mapGitWebhookAudit);
  }

  override createMergeQueueEntry(input: Parameters<InMemoryAichestraStore["createMergeQueueEntry"]>[0]): MergeQueueEntry {
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
    this.insert("merge_queue_entries", mergeQueueToDb(entry));
    return entry;
  }

  override getMergeQueueEntry(id: string): MergeQueueEntry | undefined {
    const row = this.one(`${mergeQueueSelect()} WHERE id = ${sqlLiteral(id)}`);
    return row ? mapMergeQueue(row) : undefined;
  }

  override updateMergeQueueEntry(id: string, patch: Partial<MergeQueueEntry>): MergeQueueEntry {
    const current = required(this.getMergeQueueEntry(id), `Merge queue entry not found: ${id}`);
    const updated = { ...current, ...patch, updatedAt: new Date() };
    this.update("merge_queue_entries", mergeQueueToDb(updated), `id = ${sqlLiteral(id)}`);
    return updated;
  }

  override listMergeQueueEntries(repoId?: string): MergeQueueEntry[] {
    const where = repoId ? ` WHERE repo_id = ${sqlLiteral(repoId)}` : "";
    return this.rows(`${mergeQueueSelect()}${where} ORDER BY priority, created_at, id`).map(mapMergeQueue);
  }

  override refreshMergeQueueEntryRisk(id: string): MergeQueueEntry {
    const entry = required(this.getMergeQueueEntry(id), `Merge queue entry not found: ${id}`);
    return this.updateMergeQueueEntry(id, this.mergeQueueFieldsForLease(entry.branchLeaseId));
  }

  override refreshMergeQueueEntriesForLease(leaseId: string): MergeQueueEntry[] {
    return this.listMergeQueueEntries()
      .filter((entry) => entry.branchLeaseId === leaseId && entry.status !== "merged" && entry.status !== "cancelled")
      .map((entry) => this.refreshMergeQueueEntryRisk(entry.id));
  }

  override markMergeQueueEntryMerged(id: string): MergeQueueEntry {
    const entry = required(this.getMergeQueueEntry(id), `Merge queue entry not found: ${id}`);
    this.releaseBranchLease(entry.branchLeaseId);
    return this.updateMergeQueueEntry(id, { status: "merged", mergedAt: new Date() });
  }

  override cancelMergeQueueEntry(id: string, reason = "cancelled"): MergeQueueEntry {
    const entry = required(this.getMergeQueueEntry(id), `Merge queue entry not found: ${id}`);
    this.releaseBranchLease(entry.branchLeaseId);
    return this.updateMergeQueueEntry(id, {
      status: "cancelled",
      cancelledAt: new Date(),
      reasons: [...entry.reasons, reason]
    });
  }

  override listSkills(): SkillPackage[] {
    return this.rows(`${skillSelect()} ORDER BY name, version, id`).map(mapSkill);
  }

  override getSkill(id: string): SkillPackage | undefined {
    return this.getSkillById(id);
  }

  override getSkillById(id: string): SkillPackage | undefined {
    const row = this.one(`${skillSelect()} WHERE id = ${sqlLiteral(id)}`);
    return row ? mapSkill(row) : undefined;
  }

  override getSkillByNameVersion(name: string, version: string): SkillPackage | undefined {
    const row = this.one(`${skillSelect()} WHERE name = ${sqlLiteral(name)} AND version = ${sqlLiteral(version)}`);
    return row ? mapSkill(row) : undefined;
  }

  override createSkill(input: SkillPackage): SkillPackage {
    this.insert("skills", skillToDb(input));
    return input;
  }

  override updateSkill(id: string, patch: Partial<SkillPackage>): SkillPackage {
    const updated = { ...required(this.getSkillById(id), `Skill not found: ${id}`), ...patch, updatedAt: new Date() };
    this.update("skills", skillToDb(updated), `id = ${sqlLiteral(id)}`);
    return updated;
  }

  override updateSkillStatus(id: string, status: RegistryStatus): SkillPackage {
    return this.updateSkill(id, { status });
  }

  override listHarnesses(): HarnessPackage[] {
    return this.rows(`${harnessSelect()} ORDER BY name, version, id`).map(mapHarness);
  }

  override getHarness(id: string): HarnessPackage | undefined {
    return this.getHarnessById(id);
  }

  override getHarnessById(id: string): HarnessPackage | undefined {
    const row = this.one(`${harnessSelect()} WHERE id = ${sqlLiteral(id)}`);
    return row ? mapHarness(row) : undefined;
  }

  override getHarnessByNameVersion(name: string, version: string): HarnessPackage | undefined {
    const row = this.one(`${harnessSelect()} WHERE name = ${sqlLiteral(name)} AND version = ${sqlLiteral(version)}`);
    return row ? mapHarness(row) : undefined;
  }

  override createHarness(input: HarnessPackage): HarnessPackage {
    this.insert("harnesses", harnessToDb(input));
    return input;
  }

  override updateHarness(id: string, patch: Partial<HarnessPackage>): HarnessPackage {
    const updated = { ...required(this.getHarnessById(id), `Harness not found: ${id}`), ...patch, updatedAt: new Date() };
    this.update("harnesses", harnessToDb(updated), `id = ${sqlLiteral(id)}`);
    return updated;
  }

  override updateHarnessStatus(id: string, status: RegistryStatus): HarnessPackage {
    return this.updateHarness(id, { status });
  }

  override listInstructions(): InstructionArtifact[] {
    return this.rows(`${instructionSelect()} ORDER BY name, version, id`).map(mapInstruction);
  }

  override getInstruction(id: string): InstructionArtifact | undefined {
    return this.getInstructionById(id);
  }

  override getInstructionById(id: string): InstructionArtifact | undefined {
    const row = this.one(`${instructionSelect()} WHERE id = ${sqlLiteral(id)}`);
    return row ? mapInstruction(row) : undefined;
  }

  override getInstructionByNameVersion(name: string, version: string): InstructionArtifact | undefined {
    const row = this.one(`${instructionSelect()} WHERE name = ${sqlLiteral(name)} AND version = ${sqlLiteral(version)}`);
    return row ? mapInstruction(row) : undefined;
  }

  override createInstruction(input: InstructionArtifact): InstructionArtifact {
    this.insert("instructions", instructionToDb(input));
    return input;
  }

  override updateInstruction(id: string, patch: Partial<InstructionArtifact>): InstructionArtifact {
    const updated = { ...required(this.getInstructionById(id), `Instruction artifact not found: ${id}`), ...patch, updatedAt: new Date() };
    this.update("instructions", instructionToDb(updated), `id = ${sqlLiteral(id)}`);
    return updated;
  }

  override updateInstructionStatus(id: string, status: RegistryStatus): InstructionArtifact {
    return this.updateInstruction(id, { status });
  }

  override saveInstructionSet(instructionSet: InstructionSet): InstructionSet {
    this.insert("instruction_sets", instructionSetToDb(instructionSet));
    return instructionSet;
  }

  override recordUsage(input: Omit<UsageEvent, "id" | "createdAt">): UsageEvent {
    const usageEvent = {
      ...input,
      id: createId("usage"),
      createdAt: new Date()
    };
    this.insert("usage_ledger_entries", usageToDb(usageEvent));
    return usageEvent;
  }

  override listUsageEvents(): UsageEvent[] {
    return this.rows(`${usageSelect()} ORDER BY created_at, id`).map(mapUsage);
  }

  override recordAudit(input: Omit<AuditLog, "id" | "createdAt">): AuditLog {
    const auditLog = {
      ...input,
      id: createId("audit"),
      createdAt: new Date()
    };
    this.insert("audit_events", auditToDb(auditLog));
    return auditLog;
  }

  override listAuditLogs(): AuditLog[] {
    return this.rows(`${auditSelect()} ORDER BY created_at, id`).map(mapAudit);
  }

  override appendAuditLog(input: Omit<RegistryAuditLogEntry, "id" | "createdAt">): RegistryAuditLogEntry {
    const auditLog = {
      ...input,
      id: createId("regaudit"),
      createdAt: new Date()
    };
    this.insert("registry_audit_logs", registryAuditToDb(auditLog));
    return auditLog;
  }

  override listRegistryAuditLogs(): RegistryAuditLogEntry[] {
    return this.rows(`${registryAuditSelect()} ORDER BY created_at, id`).map(mapRegistryAudit);
  }

  override listAuditLogsForTarget(targetKind: RegistryKind, targetId: string): RegistryAuditLogEntry[] {
    return this.rows(
      `${registryAuditSelect()} WHERE target_kind = ${sqlLiteral(targetKind)} AND target_id = ${sqlLiteral(targetId)} ORDER BY created_at, id`
    ).map(mapRegistryAudit);
  }

  override appendRevision(input: Omit<RegistryRevision, "id" | "createdAt">): RegistryRevision {
    const revision = {
      ...input,
      id: createId("regrev"),
      createdAt: new Date()
    };
    this.insert("registry_revisions", registryRevisionToDb(revision));
    return revision;
  }

  override listRevisionsForTarget(targetKind: RegistryKind, targetId: string): RegistryRevision[] {
    return this.rows(
      `${registryRevisionSelect()} WHERE target_kind = ${sqlLiteral(targetKind)} AND target_id = ${sqlLiteral(targetId)} ORDER BY revision_number, created_at, id`
    ).map(mapRegistryRevision);
  }

  override getRevision(id: string): RegistryRevision | undefined {
    const row = this.one(`${registryRevisionSelect()} WHERE id = ${sqlLiteral(id)}`);
    return row ? mapRegistryRevision(row) : undefined;
  }

  override getLatestRevisionForTarget(targetKind: RegistryKind, targetId: string): RegistryRevision | undefined {
    return this.listRevisionsForTarget(targetKind, targetId).at(-1);
  }

  override appendEvalResult(input: Omit<RegistryEvalResult, "id" | "attachedAt">): RegistryEvalResult {
    const result = {
      ...input,
      id: createId("regeval"),
      attachedAt: new Date()
    };
    this.insert("registry_eval_results", registryEvalToDb(result));
    return result;
  }

  override listEvalResultsForTarget(targetKind: RegistryKind, targetId: string): RegistryEvalResult[] {
    return this.rows(
      `${registryEvalSelect()} WHERE target_kind = ${sqlLiteral(targetKind)} AND target_id = ${sqlLiteral(targetId)} ORDER BY attached_at, id`
    ).map(mapRegistryEval);
  }

  override getLatestEvalResultForTarget(targetKind: RegistryKind, targetId: string): RegistryEvalResult | undefined {
    return this.listEvalResultsForTarget(targetKind, targetId).at(-1);
  }

  override createPackageManifest(input: RegistryPackageManifest): RegistryPackageManifest {
    this.insert("registry_packages", packageManifestToDb(input));
    return structuredClone(input);
  }

  override listPackageManifests(): RegistryPackageManifest[] {
    return this.rows(`${packageManifestSelect()} ORDER BY created_at, id`).map(mapPackageManifest);
  }

  override getPackageManifestById(id: string): RegistryPackageManifest | undefined {
    const row = this.one(`${packageManifestSelect()} WHERE id = ${sqlLiteral(id)}`);
    return row ? mapPackageManifest(row) : undefined;
  }

  override getPackageManifestByNameVersion(name: string, version: string): RegistryPackageManifest | undefined {
    const row = this.one(`${packageManifestSelect()} WHERE name = ${sqlLiteral(name)} AND version = ${sqlLiteral(version)}`);
    return row ? mapPackageManifest(row) : undefined;
  }

  private latestMergeSimulationForLeasePairPostgres(source: BranchLease, target: BranchLease): MergeSimulationResult | undefined {
    const leaseIds = new Set([source.id, target.id]);
    return this.listMergeSimulations({ repoId: source.repoId })
      .filter((simulation) => simulation.branchLeaseId !== undefined && leaseIds.has(simulation.branchLeaseId))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id))[0];
  }

  private rows<T extends Row = Row>(sql: string): T[] {
    return this.client.query<T>(sql);
  }

  private one<T extends Row = Row>(sql: string): T | undefined {
    return this.rows<T>(`${sql} LIMIT 1`)[0];
  }

  private insert(table: string, values: Record<string, unknown>): void {
    const entries = Object.entries(values);
    this.client.execute(
      `INSERT INTO ${table} (${entries.map(([key]) => key).join(", ")}) VALUES (${entries.map(([, value]) => sqlValue(value)).join(", ")})`
    );
  }

  private update(table: string, values: Record<string, unknown>, where: string): void {
    const assignments = Object.entries(values)
      .filter(([key]) => key !== "id")
      .map(([key, value]) => `${key} = ${sqlValue(value)}`)
      .join(", ");
    this.client.execute(`UPDATE ${table} SET ${assignments} WHERE ${where}`);
  }
}

export class PostgresRepositoryFactory implements RepositoryFactory {
  private readonly store: PostgresAichestraStore;
  private readonly usageLedger: UsageLedger;
  private readonly improvementRepository: ImprovementRepository;
  private readonly durableCollaborationRepositories: DurableCollaborationRepositories;

  constructor(input: { client: DatabaseClient; improvementRepository?: ImprovementRepository }) {
    this.store = new PostgresAichestraStore(input.client);
    this.usageLedger = new MockUsageLedger(this.store);
    this.improvementRepository = input.improvementRepository ?? new InMemoryImprovementRepository();
    this.durableCollaborationRepositories = createPostgresDurableCollaborationRepositories(input.client);
  }

  createDataStore(): InMemoryAichestraStore {
    return this.store;
  }

  createTaskRepository(): TaskRepository {
    return this.store;
  }

  createTaskRunRepository(): TaskRunRepository {
    return this.store;
  }

  createUsageLedgerRepository(): UsageLedgerRepository {
    return this.store;
  }

  createUsageLedger(): UsageLedger {
    return this.usageLedger;
  }

  createConflictRepositories(): ConflictRepositories {
    return this.store;
  }

  createDurableCollaborationRepositories(): DurableCollaborationRepositories {
    return this.durableCollaborationRepositories;
  }

  createRegistryRepositories(): RegistryServiceInput {
    return {
      skillRepository: this.store,
      harnessRepository: this.store,
      instructionRepository: this.store,
      auditRepository: {
        appendAuditLog: (input) => this.store.appendAuditLog(input),
        listAuditLogs: () => this.store.listRegistryAuditLogs(),
        listAuditLogsForTarget: (targetKind, targetId) => this.store.listAuditLogsForTarget(targetKind, targetId)
      },
      historyRepository: this.store,
      evalResultRepository: this.store,
      packageRepository: this.store
    };
  }

  createImprovementRepositories(): ImprovementRepository {
    return this.improvementRepository;
  }
}

export function createPostgresDurableCollaborationRepositories(
  client: DatabaseClient
): DurableCollaborationRepositories {
  const repositories = {} as Record<DurableCollaborationRepositoryGroup, DurableCollaborationGroupRepository>;
  for (const group of DURABLE_COLLABORATION_REPOSITORY_GROUPS) {
    repositories[group] = new PostgresDurableCollaborationGroupRepository(client, group);
  }
  return createDurableCollaborationRepositorySet("postgres", repositories);
}

class PostgresDurableCollaborationGroupRepository implements DurableCollaborationGroupRepository {
  readonly group: DurableCollaborationRepositoryGroup;
  private readonly client: DatabaseClient;

  constructor(client: DatabaseClient, group: DurableCollaborationRepositoryGroup) {
    this.client = client;
    this.group = group;
  }

  create(input: CreateDurableCollaborationRecordInput): DurableCollaborationRecord {
    this.assertRecordKind(input.recordKind);
    const now = input.createdAt ?? new Date();
    const record: DurableCollaborationRecord = {
      ...input,
      group: this.group,
      metadata: sanitizeDurableCollaborationMetadata(input.metadata),
      createdAt: now,
      updatedAt: input.updatedAt ?? now
    };
    this.client.execute(
      `INSERT INTO ${this.tableFor(record.recordKind)} (${durableRecordColumns().join(", ")})
       VALUES (${durableRecordValues(record).join(", ")})`
    );
    return cloneDurableRecord(record);
  }

  getById(id: string): DurableCollaborationRecord | undefined {
    for (const recordKind of DURABLE_COLLABORATION_RECORD_KINDS_BY_GROUP[this.group]) {
      const rows = this.client.query(`${durableRecordSelect(this.group, recordKind)} WHERE id = ${sqlValue(id)} LIMIT 1`);
      if (rows[0]) {
        return mapDurableRecord(rows[0]);
      }
    }
    return undefined;
  }

  list(): DurableCollaborationRecord[] {
    return DURABLE_COLLABORATION_RECORD_KINDS_BY_GROUP[this.group].flatMap((recordKind) =>
      this.client.query(durableRecordSelect(this.group, recordKind)).map(mapDurableRecord)
    );
  }

  updateStatus(id: string, input: UpdateDurableCollaborationStatusInput): DurableCollaborationRecord {
    const existing = this.requireRecord(id);
    const updated: DurableCollaborationRecord = {
      ...existing,
      status: input.status ?? existing.status,
      decision: input.decision ?? existing.decision,
      severity: input.severity ?? existing.severity,
      metadata: {
        ...existing.metadata,
        ...sanitizeDurableCollaborationMetadata(input.metadata)
      },
      updatedAt: input.updatedAt ?? new Date()
    };
    this.client.execute(
      `UPDATE ${this.tableFor(existing.recordKind)}
       SET status = ${sqlValue(updated.status)},
           decision = ${sqlValue(updated.decision)},
           severity = ${sqlValue(updated.severity)},
           metadata_json = ${sqlValue(updated.metadata)},
           updated_at = ${sqlValue(updated.updatedAt)}
       WHERE id = ${sqlValue(id)}`
    );
    return cloneDurableRecord(updated);
  }

  updateMetadata(id: string, metadata: DurableCollaborationMetadata): DurableCollaborationRecord {
    const existing = this.requireRecord(id);
    const updated: DurableCollaborationRecord = {
      ...existing,
      metadata: {
        ...existing.metadata,
        ...sanitizeDurableCollaborationMetadata(metadata)
      },
      updatedAt: new Date()
    };
    this.client.execute(
      `UPDATE ${this.tableFor(existing.recordKind)}
       SET metadata_json = ${sqlValue(updated.metadata)}, updated_at = ${sqlValue(updated.updatedAt)}
       WHERE id = ${sqlValue(id)}`
    );
    return cloneDurableRecord(updated);
  }

  appendEvent(input: CreateDurableCollaborationEventInput): DurableCollaborationEvent {
    this.assertRecordKind(input.recordKind);
    this.requireRecord(input.recordId);
    const event: DurableCollaborationEvent = {
      ...input,
      group: this.group,
      metadata: sanitizeDurableCollaborationMetadata(input.metadata),
      createdAt: input.createdAt ?? new Date()
    };
    this.client.execute(
      `INSERT INTO durable_collaboration_events (
          id,
          group_name,
          record_kind,
          record_table,
          record_id,
          event_type,
          request_id,
          correlation_id,
          actor_id,
          service_account_id,
          metadata_json,
          created_at
        )
       VALUES (
          ${sqlValue(event.id)},
          ${sqlValue(event.group)},
          ${sqlValue(event.recordKind)},
          ${sqlValue(this.tableFor(event.recordKind))},
          ${sqlValue(event.recordId)},
          ${sqlValue(event.eventType)},
          ${sqlValue(event.requestId)},
          ${sqlValue(event.correlationId)},
          ${sqlValue(event.actorId)},
          ${sqlValue(event.serviceAccountId)},
          ${sqlValue(event.metadata)},
          ${sqlValue(event.createdAt)}
        )`
    );
    return cloneDurableEvent(event);
  }

  listEvents(recordId?: string): DurableCollaborationEvent[] {
    const where = [`group_name = ${sqlValue(this.group)}`];
    if (recordId) where.push(`record_id = ${sqlValue(recordId)}`);
    return this.client
      .query(`${durableEventSelect()} WHERE ${where.join(" AND ")} ORDER BY created_at, id`)
      .map(mapDurableEvent);
  }

  summarize(): DurableCollaborationRepositorySummary {
    const recordKinds = [...DURABLE_COLLABORATION_RECORD_KINDS_BY_GROUP[this.group]];
    const recordCount = recordKinds.reduce((total, recordKind) => total + this.safeCount(this.tableFor(recordKind)), 0);
    const eventCount = this.safeEventCount();
    return {
      group: this.group,
      label: DURABLE_COLLABORATION_GROUP_LABELS[this.group],
      providerKind: "postgres",
      implemented: true,
      recordKinds,
      tableNames: recordKinds.map((recordKind) => this.tableFor(recordKind)),
      recordCount,
      eventCount,
      noSecretsExposed: true,
      envValuesExposed: false,
      databaseUrlExposed: false
    };
  }

  private tableFor(recordKind: DurableCollaborationRecordKind): string {
    return DURABLE_COLLABORATION_RECORD_TABLES[recordKind];
  }

  private assertRecordKind(recordKind: DurableCollaborationRecordKind): void {
    const expectedGroup = getDurableCollaborationRecordGroup(recordKind);
    if (expectedGroup !== this.group) {
      throw new Error(`Record kind ${recordKind} belongs to ${expectedGroup}, not ${this.group}.`);
    }
  }

  private requireRecord(id: string): DurableCollaborationRecord {
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Durable collaboration record not found: ${id}`);
    }
    return existing;
  }

  private safeCount(tableName: string): number {
    try {
      const row = this.client.query<{ count: string }>(`SELECT COUNT(*) AS count FROM ${tableName}`)[0];
      return row ? Number(row.count) : 0;
    } catch {
      return 0;
    }
  }

  private safeEventCount(): number {
    try {
      const row = this.client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM durable_collaboration_events WHERE group_name = ${sqlValue(this.group)}`
      )[0];
      return row ? Number(row.count) : 0;
    } catch {
      return 0;
    }
  }
}

export function createPostgresStorageProvider(input: PostgresStorageProviderInput): StorageProvider {
  const client = new PsqlCliDatabaseClient({
    databaseUrl: input.databaseUrl,
    psqlBin: input.psqlBin
  });
  return {
    kind: "postgres",
    repositoryFactory: new PostgresRepositoryFactory({
      client,
      improvementRepository: input.improvementRepository
    }),
    async healthCheck() {
      return client.healthCheck();
    },
    async close() {
      client.close();
    }
  };
}

export function createPostgresStorageProviderFromEnv(env: Record<string, string | undefined>): StorageProvider {
  const databaseUrl = env.AICHESTRA_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("AICHESTRA_DATABASE_URL is required when AICHESTRA_STORAGE_PROVIDER=postgres.");
  }
  return createPostgresStorageProvider({
    databaseUrl,
    psqlBin: env.AICHESTRA_PSQL_BIN
  });
}

function uniqueOrdered(values: string[]): string[] {
  return [...new Set(values)];
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlValue(value: unknown): string {
  if (value === undefined || value === null) return "NULL";
  if (value instanceof Date) return sqlLiteral(value.toISOString());
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot persist a non-finite number.");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (Array.isArray(value) || typeof value === "object") return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
  return sqlLiteral(String(value));
}

function durableRecordColumns(): string[] {
  return [
    "id",
    "repo_id",
    "task_id",
    "task_run_id",
    "agent_run_id",
    "branch_name",
    "branch_lease_id",
    "workspace_lease_id",
    "status",
    "decision",
    "severity",
    "request_id",
    "correlation_id",
    "actor_id",
    "service_account_id",
    "metadata_json",
    "created_at",
    "updated_at"
  ];
}

function durableRecordValues(record: DurableCollaborationRecord): string[] {
  return [
    sqlValue(record.id),
    sqlValue(record.repoId),
    sqlValue(record.taskId),
    sqlValue(record.taskRunId),
    sqlValue(record.agentRunId),
    sqlValue(record.branchName),
    sqlValue(record.branchLeaseId),
    sqlValue(record.workspaceLeaseId),
    sqlValue(record.status),
    sqlValue(record.decision),
    sqlValue(record.severity),
    sqlValue(record.requestId),
    sqlValue(record.correlationId),
    sqlValue(record.actorId),
    sqlValue(record.serviceAccountId),
    sqlValue(record.metadata),
    sqlValue(record.createdAt),
    sqlValue(record.updatedAt)
  ];
}

function durableRecordSelect(
  group: DurableCollaborationRepositoryGroup,
  recordKind: DurableCollaborationRecordKind
): string {
  return `SELECT id,
    ${sqlValue(group)} AS "group",
    ${sqlValue(recordKind)} AS "recordKind",
    repo_id AS "repoId",
    task_id AS "taskId",
    task_run_id AS "taskRunId",
    agent_run_id AS "agentRunId",
    branch_name AS "branchName",
    branch_lease_id AS "branchLeaseId",
    workspace_lease_id AS "workspaceLeaseId",
    status,
    decision,
    severity,
    request_id AS "requestId",
    correlation_id AS "correlationId",
    actor_id AS "actorId",
    service_account_id AS "serviceAccountId",
    metadata_json AS metadata,
    created_at AS "createdAt",
    updated_at AS "updatedAt"
    FROM ${DURABLE_COLLABORATION_RECORD_TABLES[recordKind]}`;
}

function durableEventSelect(): string {
  return `SELECT id,
    group_name AS "group",
    record_kind AS "recordKind",
    record_id AS "recordId",
    event_type AS "eventType",
    request_id AS "requestId",
    correlation_id AS "correlationId",
    actor_id AS "actorId",
    service_account_id AS "serviceAccountId",
    metadata_json AS metadata,
    created_at AS "createdAt"
    FROM durable_collaboration_events`;
}

function mapDurableRecord(row: Row): DurableCollaborationRecord {
  return {
    id: asString(row, "id"),
    group: asString(row, "group") as DurableCollaborationRepositoryGroup,
    recordKind: asString(row, "recordKind") as DurableCollaborationRecordKind,
    repoId: asOptionalString(row, "repoId"),
    taskId: asOptionalString(row, "taskId"),
    taskRunId: asOptionalString(row, "taskRunId"),
    agentRunId: asOptionalString(row, "agentRunId"),
    branchName: asOptionalString(row, "branchName"),
    branchLeaseId: asOptionalString(row, "branchLeaseId"),
    workspaceLeaseId: asOptionalString(row, "workspaceLeaseId"),
    status: asOptionalString(row, "status"),
    decision: asOptionalString(row, "decision"),
    severity: asOptionalString(row, "severity"),
    requestId: asOptionalString(row, "requestId"),
    correlationId: asOptionalString(row, "correlationId"),
    actorId: asOptionalString(row, "actorId"),
    serviceAccountId: asOptionalString(row, "serviceAccountId"),
    metadata: sanitizeDurableCollaborationMetadata(asRecord(row, "metadata")),
    createdAt: asDate(row, "createdAt"),
    updatedAt: asDate(row, "updatedAt")
  };
}

function mapDurableEvent(row: Row): DurableCollaborationEvent {
  return {
    id: asString(row, "id"),
    group: asString(row, "group") as DurableCollaborationRepositoryGroup,
    recordKind: asString(row, "recordKind") as DurableCollaborationRecordKind,
    recordId: asString(row, "recordId"),
    eventType: asString(row, "eventType"),
    requestId: asOptionalString(row, "requestId"),
    correlationId: asOptionalString(row, "correlationId"),
    actorId: asOptionalString(row, "actorId"),
    serviceAccountId: asOptionalString(row, "serviceAccountId"),
    metadata: sanitizeDurableCollaborationMetadata(asRecord(row, "metadata")),
    createdAt: asDate(row, "createdAt")
  };
}

function cloneDurableRecord(record: DurableCollaborationRecord): DurableCollaborationRecord {
  return {
    ...record,
    metadata: sanitizeDurableCollaborationMetadata(record.metadata),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt)
  };
}

function cloneDurableEvent(event: DurableCollaborationEvent): DurableCollaborationEvent {
  return {
    ...event,
    metadata: sanitizeDurableCollaborationMetadata(event.metadata),
    createdAt: new Date(event.createdAt)
  };
}

function sanitizeDatabaseError(error: unknown): string {
  return error instanceof Error ? sanitizeDatabaseMessage(error.message) : "Unknown database error.";
}

function sanitizeDatabaseMessage(message: string): string {
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://[redacted]");
}

function required<T>(value: T | undefined, message: string): T {
  if (!value) throw new Error(message);
  return value;
}

function asString(row: Row, key: string): string {
  return String(row[key]);
}

function asOptionalString(row: Row, key: string): string | undefined {
  const value = row[key];
  return value === undefined || value === null ? undefined : String(value);
}

function asNumber(row: Row, key: string): number {
  return Number(row[key]);
}

function asOptionalNumber(row: Row, key: string): number | undefined {
  const value = row[key];
  return value === undefined || value === null ? undefined : Number(value);
}

function asDate(row: Row, key: string): Date {
  return new Date(asString(row, key));
}

function asOptionalDate(row: Row, key: string): Date | undefined {
  const value = asOptionalString(row, key);
  return value ? new Date(value) : undefined;
}

function asArray<T>(row: Row, key: string): T[] {
  const value = row[key];
  return Array.isArray(value) ? (value as T[]) : [];
}

function asRecord(row: Row, key: string): Record<string, unknown> {
  const value = row[key];
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function repoSelect(): string {
  return `SELECT id, provider, owner, name, default_branch AS "defaultBranch", remote_url AS "remoteUrl", status, created_at AS "createdAt", updated_at AS "updatedAt" FROM repos`;
}

function repoToDb(repo: Repo): Record<string, unknown> {
  return {
    id: repo.id,
    provider: repo.provider,
    owner: repo.owner,
    name: repo.name,
    default_branch: repo.defaultBranch,
    remote_url: repo.remoteUrl,
    status: repo.status,
    created_at: repo.createdAt,
    updated_at: repo.updatedAt
  };
}

function mapRepo(row: Row): Repo {
  return {
    id: asString(row, "id"),
    provider: asString(row, "provider") as Repo["provider"],
    owner: asString(row, "owner"),
    name: asString(row, "name"),
    defaultBranch: asString(row, "defaultBranch"),
    remoteUrl: asOptionalString(row, "remoteUrl"),
    status: asString(row, "status") as Repo["status"],
    createdAt: asDate(row, "createdAt"),
    updatedAt: asDate(row, "updatedAt")
  };
}

function taskSelect(): string {
  return `SELECT id, title, description, status, requester_user_id AS "requesterUserId", repo_id AS "repoId", base_branch AS "baseBranch", branch_name AS "branchName", selected_agent AS "selectedAgent", selected_model AS "selectedModel", selected_skill_ids AS "selectedSkillIds", selected_harness_id AS "selectedHarnessId", instruction_set_id AS "instructionSetId", budget_limit_usd AS "budgetLimitUsd", conflict_risk_score AS "conflictRiskScore", created_at AS "createdAt", updated_at AS "updatedAt" FROM tasks`;
}

function taskToDb(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    requester_user_id: task.requesterUserId,
    repo_id: task.repoId,
    base_branch: task.baseBranch,
    branch_name: task.branchName,
    selected_agent: task.selectedAgent,
    selected_model: task.selectedModel,
    selected_skill_ids: task.selectedSkillIds,
    selected_harness_id: task.selectedHarnessId,
    instruction_set_id: task.instructionSetId,
    budget_limit_usd: task.budgetLimitUsd,
    conflict_risk_score: task.conflictRiskScore,
    created_at: task.createdAt,
    updated_at: task.updatedAt
  };
}

function mapTask(row: Row): Task {
  return {
    id: asString(row, "id"),
    title: asString(row, "title"),
    description: asOptionalString(row, "description"),
    status: asString(row, "status") as TaskStatus,
    requesterUserId: asString(row, "requesterUserId"),
    repoId: asString(row, "repoId"),
    baseBranch: asString(row, "baseBranch"),
    branchName: asOptionalString(row, "branchName"),
    selectedAgent: asOptionalString(row, "selectedAgent") as Task["selectedAgent"],
    selectedModel: asOptionalString(row, "selectedModel"),
    selectedSkillIds: asArray<string>(row, "selectedSkillIds"),
    selectedHarnessId: asOptionalString(row, "selectedHarnessId"),
    instructionSetId: asOptionalString(row, "instructionSetId"),
    budgetLimitUsd: asOptionalNumber(row, "budgetLimitUsd"),
    conflictRiskScore: asOptionalNumber(row, "conflictRiskScore"),
    createdAt: asDate(row, "createdAt"),
    updatedAt: asDate(row, "updatedAt")
  };
}

function taskRunSelect(): string {
  return `SELECT id, task_id AS "taskId", attempt, status, agent, model, model_provider AS "modelProvider", selected_skill_id AS "selectedSkillId", skill_version AS "skillVersion", selected_harness_id AS "selectedHarnessId", harness_version AS "harnessVersion", selected_skill_refs AS "selectedSkillRefs", selected_harness_ref AS "selectedHarnessRef", selected_instruction_refs AS "selectedInstructionRefs", registry_resolution_warnings AS "registryResolutionWarnings", registry_resolution_errors AS "registryResolutionErrors", instruction_set_id AS "instructionSetId", started_at AS "startedAt", finished_at AS "finishedAt", result_summary AS "resultSummary", changed_files AS "changedFiles", diff_summary AS "diffSummary", pull_request_url AS "pullRequestUrl", error_message AS "errorMessage", created_at AS "createdAt", updated_at AS "updatedAt" FROM task_runs`;
}

function taskRunToDb(run: TaskRun): Record<string, unknown> {
  return {
    id: run.id,
    task_id: run.taskId,
    attempt: run.attempt,
    status: run.status,
    agent: run.agent,
    model: run.model,
    model_provider: run.modelProvider,
    selected_skill_id: run.selectedSkillId,
    skill_version: run.skillVersion,
    selected_harness_id: run.selectedHarnessId,
    harness_version: run.harnessVersion,
    selected_skill_refs: run.selectedSkillRefs,
    selected_harness_ref: run.selectedHarnessRef,
    selected_instruction_refs: run.selectedInstructionRefs,
    registry_resolution_warnings: run.registryResolutionWarnings,
    registry_resolution_errors: run.registryResolutionErrors,
    instruction_set_id: run.instructionSetId,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    result_summary: run.resultSummary,
    changed_files: run.changedFiles,
    diff_summary: run.diffSummary,
    pull_request_url: run.pullRequestUrl,
    error_message: run.errorMessage,
    created_at: run.createdAt,
    updated_at: run.updatedAt
  };
}

function mapTaskRun(row: Row): TaskRun {
  return {
    id: asString(row, "id"),
    taskId: asString(row, "taskId"),
    attempt: asNumber(row, "attempt"),
    status: asString(row, "status") as TaskRun["status"],
    agent: asString(row, "agent") as TaskRun["agent"],
    model: asString(row, "model"),
    modelProvider: asOptionalString(row, "modelProvider") as TaskRun["modelProvider"],
    selectedSkillId: asOptionalString(row, "selectedSkillId"),
    skillVersion: asOptionalString(row, "skillVersion"),
    selectedHarnessId: asOptionalString(row, "selectedHarnessId"),
    harnessVersion: asOptionalString(row, "harnessVersion"),
    selectedSkillRefs: asArray(row, "selectedSkillRefs"),
    selectedHarnessRef: row.selectedHarnessRef as TaskRun["selectedHarnessRef"],
    selectedInstructionRefs: asArray(row, "selectedInstructionRefs"),
    registryResolutionWarnings: asArray<string>(row, "registryResolutionWarnings"),
    registryResolutionErrors: asArray<string>(row, "registryResolutionErrors"),
    instructionSetId: asOptionalString(row, "instructionSetId"),
    startedAt: asOptionalDate(row, "startedAt"),
    finishedAt: asOptionalDate(row, "finishedAt"),
    resultSummary: asOptionalString(row, "resultSummary"),
    changedFiles: asArray<string>(row, "changedFiles"),
    diffSummary: asOptionalString(row, "diffSummary"),
    pullRequestUrl: asOptionalString(row, "pullRequestUrl"),
    errorMessage: asOptionalString(row, "errorMessage"),
    createdAt: asDate(row, "createdAt"),
    updatedAt: asDate(row, "updatedAt")
  };
}

function branchLeaseSelect(): string {
  return `SELECT id, task_id AS "taskId", task_run_id AS "taskRunId", repo_id AS "repoId", branch_id AS "branchId", branch_name AS "branchName", base_branch AS "baseBranch", files, symbols, tests, status, expires_at AS "expiresAt", released_at AS "releasedAt", created_at AS "createdAt", updated_at AS "updatedAt" FROM branch_leases`;
}

function branchLeaseToDb(lease: BranchLease): Record<string, unknown> {
  return {
    id: lease.id,
    task_id: lease.taskId,
    task_run_id: lease.taskRunId,
    repo_id: lease.repoId,
    branch_id: lease.branchId,
    branch_name: lease.branchName,
    base_branch: lease.baseBranch,
    files: lease.files,
    symbols: lease.symbols,
    tests: lease.tests,
    status: lease.status,
    expires_at: lease.expiresAt,
    released_at: lease.releasedAt,
    created_at: lease.createdAt,
    updated_at: lease.updatedAt
  };
}

function mapBranchLease(row: Row): BranchLease {
  return {
    id: asString(row, "id"),
    taskId: asString(row, "taskId"),
    taskRunId: asString(row, "taskRunId"),
    repoId: asString(row, "repoId"),
    branchId: asString(row, "branchId"),
    branchName: asString(row, "branchName"),
    baseBranch: asString(row, "baseBranch"),
    files: asArray<string>(row, "files"),
    symbols: asArray<string>(row, "symbols"),
    tests: asArray<string>(row, "tests"),
    status: asString(row, "status") as BranchLeaseStatus,
    expiresAt: asOptionalDate(row, "expiresAt"),
    releasedAt: asOptionalDate(row, "releasedAt"),
    createdAt: asDate(row, "createdAt"),
    updatedAt: asDate(row, "updatedAt")
  };
}

function mergeSimulationSelect(): string {
  return `SELECT id, repo_id AS "repoId", repo_path AS "repoPath", base_ref AS "baseRef", source_ref AS "sourceRef", target_ref AS "targetRef", task_run_id AS "taskRunId", branch_lease_id AS "branchLeaseId", mode, status, conflicting_files AS "conflictingFiles", changed_files AS "changedFiles", summary, raw_command_metadata AS "rawCommandMetadata", risk_contribution AS "riskContribution", created_at AS "createdAt" FROM merge_simulation_results`;
}

function mergeSimulationToDb(result: MergeSimulationResult): Record<string, unknown> {
  return {
    id: result.id,
    repo_id: result.repoId,
    repo_path: result.repoPath,
    base_ref: result.baseRef,
    source_ref: result.sourceRef,
    target_ref: result.targetRef,
    task_run_id: result.taskRunId,
    branch_lease_id: result.branchLeaseId,
    mode: result.mode,
    status: result.status,
    conflicting_files: result.conflictingFiles,
    changed_files: result.changedFiles,
    summary: result.summary,
    raw_command_metadata: result.rawCommandMetadata,
    risk_contribution: result.riskContribution,
    created_at: result.createdAt
  };
}

function mapMergeSimulation(row: Row): MergeSimulationResult {
  return {
    id: asString(row, "id"),
    repoId: asString(row, "repoId"),
    repoPath: asOptionalString(row, "repoPath"),
    baseRef: asString(row, "baseRef"),
    sourceRef: asString(row, "sourceRef"),
    targetRef: asOptionalString(row, "targetRef"),
    taskRunId: asOptionalString(row, "taskRunId"),
    branchLeaseId: asOptionalString(row, "branchLeaseId"),
    mode: asString(row, "mode") as MergeSimulationResult["mode"],
    status: asString(row, "status") as MergeSimulationResult["status"],
    conflictingFiles: asArray<string>(row, "conflictingFiles"),
    changedFiles: asArray<string>(row, "changedFiles"),
    summary: asString(row, "summary"),
    rawCommandMetadata: row.rawCommandMetadata as MergeSimulationResult["rawCommandMetadata"],
    riskContribution: asNumber(row, "riskContribution"),
    createdAt: asDate(row, "createdAt")
  };
}

function pullRequestSelect(): string {
  return `SELECT id, task_id AS "taskId", repo_id AS "repoId", provider, external_id AS "externalId", url, status, created_at AS "createdAt", updated_at AS "updatedAt" FROM pull_requests`;
}

function pullRequestToDb(pr: PullRequest): Record<string, unknown> {
  return {
    id: pr.id,
    task_id: pr.taskId,
    repo_id: pr.repoId,
    provider: pr.provider,
    external_id: pr.externalId,
    url: pr.url,
    status: pr.status,
    created_at: pr.createdAt,
    updated_at: pr.updatedAt
  };
}

function mapPullRequest(row: Row): PullRequest {
  return {
    id: asString(row, "id"),
    taskId: asString(row, "taskId"),
    repoId: asString(row, "repoId"),
    provider: asString(row, "provider") as PullRequest["provider"],
    externalId: asOptionalString(row, "externalId"),
    url: asOptionalString(row, "url"),
    status: asString(row, "status") as PullRequest["status"],
    createdAt: asDate(row, "createdAt"),
    updatedAt: asDate(row, "updatedAt")
  };
}

function gitWebhookVerificationSelect(): string {
  return `SELECT id, delivery_id AS "deliveryId", verified, reason, algorithm, created_at AS "createdAt" FROM git_webhook_verification_results`;
}

function gitWebhookVerificationToDb(result: GitWebhookVerificationResult): Record<string, unknown> {
  return {
    id: result.id,
    delivery_id: result.deliveryId,
    verified: result.verified,
    reason: result.reason,
    algorithm: result.algorithm,
    created_at: result.createdAt
  };
}

function mapGitWebhookVerification(row: Row): GitWebhookVerificationResult {
  return {
    id: asString(row, "id"),
    deliveryId: asString(row, "deliveryId"),
    verified: Boolean(row.verified),
    reason: asString(row, "reason"),
    algorithm: asString(row, "algorithm") as GitWebhookVerificationResult["algorithm"],
    createdAt: asDate(row, "createdAt")
  };
}

function gitWebhookEventSelect(): string {
  return `SELECT id, provider_kind AS "providerKind", event_type AS "eventType", delivery_id AS "deliveryId", repo_ref AS "repoRef", action, payload_hash AS "payloadHash", signature_verified AS "signatureVerified", status, received_at AS "receivedAt", processed_at AS "processedAt", task_id AS "taskId", task_run_id AS "taskRunId", metadata FROM git_webhook_events`;
}

function gitWebhookEventToDb(event: GitWebhookEvent): Record<string, unknown> {
  return {
    id: event.id,
    provider_kind: event.providerKind,
    event_type: event.eventType,
    delivery_id: event.deliveryId,
    repo_ref: event.repoRef,
    action: event.action,
    payload_hash: event.payloadHash,
    signature_verified: event.signatureVerified,
    status: event.status,
    received_at: event.receivedAt,
    processed_at: event.processedAt,
    task_id: event.taskId,
    task_run_id: event.taskRunId,
    metadata: event.metadata
  };
}

function mapGitWebhookEvent(row: Row): GitWebhookEvent {
  return {
    id: asString(row, "id"),
    providerKind: asString(row, "providerKind") as GitWebhookEvent["providerKind"],
    eventType: asString(row, "eventType"),
    deliveryId: asString(row, "deliveryId"),
    repoRef: asString(row, "repoRef"),
    action: asOptionalString(row, "action"),
    payloadHash: asString(row, "payloadHash"),
    signatureVerified: Boolean(row.signatureVerified),
    status: asString(row, "status") as GitWebhookEvent["status"],
    receivedAt: asDate(row, "receivedAt"),
    processedAt: asOptionalDate(row, "processedAt"),
    taskId: asOptionalString(row, "taskId"),
    taskRunId: asOptionalString(row, "taskRunId"),
    metadata: asRecord(row, "metadata")
  };
}

function gitPullRequestSyncSelect(): string {
  return `SELECT id, repo_ref AS "repoRef", repo_id AS "repoId", pull_request_number AS "pullRequestNumber", provider_pull_request_id AS "providerPullRequestId", pull_request_id AS "pullRequestId", task_id AS "taskId", task_run_id AS "taskRunId", branch_lease_id AS "branchLeaseId", merge_queue_entry_id AS "mergeQueueEntryId", state, head_branch AS "headBranch", base_branch AS "baseBranch", latest_sha AS "latestSha", changed_files AS "changedFiles", labels, mergeable_state AS "mergeableState", last_synced_at AS "lastSyncedAt", source_event_id AS "sourceEventId", metadata FROM git_pull_request_sync_states`;
}

function gitPullRequestSyncToDb(state: GitPullRequestSyncState): Record<string, unknown> {
  return {
    id: state.id,
    repo_ref: state.repoRef,
    repo_id: state.repoId,
    pull_request_number: state.pullRequestNumber,
    provider_pull_request_id: state.providerPullRequestId,
    pull_request_id: state.pullRequestId,
    task_id: state.taskId,
    task_run_id: state.taskRunId,
    branch_lease_id: state.branchLeaseId,
    merge_queue_entry_id: state.mergeQueueEntryId,
    state: state.state,
    head_branch: state.headBranch,
    base_branch: state.baseBranch,
    latest_sha: state.latestSha,
    changed_files: state.changedFiles,
    labels: state.labels,
    mergeable_state: state.mergeableState,
    last_synced_at: state.lastSyncedAt,
    source_event_id: state.sourceEventId,
    metadata: state.metadata
  };
}

function mapGitPullRequestSync(row: Row): GitPullRequestSyncState {
  return {
    id: asString(row, "id"),
    repoRef: asString(row, "repoRef"),
    repoId: asOptionalString(row, "repoId"),
    pullRequestNumber: asNumber(row, "pullRequestNumber"),
    providerPullRequestId: asOptionalString(row, "providerPullRequestId"),
    pullRequestId: asOptionalString(row, "pullRequestId"),
    taskId: asOptionalString(row, "taskId"),
    taskRunId: asOptionalString(row, "taskRunId"),
    branchLeaseId: asOptionalString(row, "branchLeaseId"),
    mergeQueueEntryId: asOptionalString(row, "mergeQueueEntryId"),
    state: asString(row, "state") as GitPullRequestSyncState["state"],
    headBranch: asString(row, "headBranch"),
    baseBranch: asString(row, "baseBranch"),
    latestSha: asOptionalString(row, "latestSha"),
    changedFiles: asArray<string>(row, "changedFiles"),
    labels: asArray<string>(row, "labels"),
    mergeableState: asOptionalString(row, "mergeableState"),
    lastSyncedAt: asDate(row, "lastSyncedAt"),
    sourceEventId: asOptionalString(row, "sourceEventId"),
    metadata: asRecord(row, "metadata")
  };
}

function gitBranchSyncSelect(): string {
  return `SELECT id, repo_ref AS "repoRef", repo_id AS "repoId", branch_name AS "branchName", latest_sha AS "latestSha", exists, protected_branch AS "protectedBranch", last_synced_at AS "lastSyncedAt", source_event_id AS "sourceEventId", metadata FROM git_branch_sync_states`;
}

function gitBranchSyncToDb(state: GitBranchSyncState): Record<string, unknown> {
  return {
    id: state.id,
    repo_ref: state.repoRef,
    repo_id: state.repoId,
    branch_name: state.branchName,
    latest_sha: state.latestSha,
    exists: state.exists,
    protected_branch: state.protectedBranch,
    last_synced_at: state.lastSyncedAt,
    source_event_id: state.sourceEventId,
    metadata: state.metadata
  };
}

function mapGitBranchSync(row: Row): GitBranchSyncState {
  return {
    id: asString(row, "id"),
    repoRef: asString(row, "repoRef"),
    repoId: asOptionalString(row, "repoId"),
    branchName: asString(row, "branchName"),
    latestSha: asOptionalString(row, "latestSha"),
    exists: Boolean(row.exists),
    protectedBranch: typeof row.protectedBranch === "boolean" ? row.protectedBranch : undefined,
    lastSyncedAt: asDate(row, "lastSyncedAt"),
    sourceEventId: asOptionalString(row, "sourceEventId"),
    metadata: asRecord(row, "metadata")
  };
}

function gitWebhookAuditSelect(): string {
  return `SELECT id, event_type AS "eventType", delivery_id AS "deliveryId", repo_ref AS "repoRef", result, reason, sanitized_metadata AS "sanitizedMetadata", created_at AS "createdAt" FROM git_webhook_audit_events`;
}

function gitWebhookAuditToDb(event: GitWebhookAuditEvent): Record<string, unknown> {
  return {
    id: event.id,
    event_type: event.eventType,
    delivery_id: event.deliveryId,
    repo_ref: event.repoRef,
    result: event.result,
    reason: event.reason,
    sanitized_metadata: event.sanitizedMetadata,
    created_at: event.createdAt
  };
}

function mapGitWebhookAudit(row: Row): GitWebhookAuditEvent {
  return {
    id: asString(row, "id"),
    eventType: asString(row, "eventType"),
    deliveryId: asOptionalString(row, "deliveryId"),
    repoRef: asOptionalString(row, "repoRef"),
    result: asString(row, "result") as GitWebhookAuditEvent["result"],
    reason: asOptionalString(row, "reason"),
    sanitizedMetadata: asRecord(row, "sanitizedMetadata"),
    createdAt: asDate(row, "createdAt")
  };
}

function mergeQueueSelect(): string {
  return `SELECT id, repo_id AS "repoId", task_id AS "taskId", task_run_id AS "taskRunId", branch_lease_id AS "branchLeaseId", pull_request_id AS "pullRequestId", pull_request_url AS "pullRequestUrl", branch_name AS "branchName", priority, risk_score AS "riskScore", conflict_risk_score AS "conflictRiskScore", status, reasons, blocking_reasons AS "blockingReasons", recommendation, simulation_status AS "simulationStatus", last_simulation_at AS "lastSimulationAt", created_at AS "createdAt", updated_at AS "updatedAt", merged_at AS "mergedAt", cancelled_at AS "cancelledAt" FROM merge_queue_entries`;
}

function mergeQueueToDb(entry: MergeQueueEntry): Record<string, unknown> {
  return {
    id: entry.id,
    repo_id: entry.repoId,
    task_id: entry.taskId,
    task_run_id: entry.taskRunId,
    branch_lease_id: entry.branchLeaseId,
    pull_request_id: entry.pullRequestId,
    pull_request_url: entry.pullRequestUrl,
    branch_name: entry.branchName,
    priority: entry.priority,
    risk_score: entry.riskScore,
    conflict_risk_score: entry.conflictRiskScore,
    status: entry.status,
    reasons: entry.reasons,
    blocking_reasons: entry.blockingReasons,
    recommendation: entry.recommendation,
    simulation_status: entry.simulationStatus,
    last_simulation_at: entry.lastSimulationAt,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
    merged_at: entry.mergedAt,
    cancelled_at: entry.cancelledAt
  };
}

function mapMergeQueue(row: Row): MergeQueueEntry {
  return {
    id: asString(row, "id"),
    repoId: asString(row, "repoId"),
    taskId: asString(row, "taskId"),
    taskRunId: asString(row, "taskRunId"),
    branchLeaseId: asString(row, "branchLeaseId"),
    pullRequestId: asString(row, "pullRequestId"),
    pullRequestUrl: asString(row, "pullRequestUrl"),
    branchName: asString(row, "branchName"),
    priority: asNumber(row, "priority"),
    riskScore: asNumber(row, "riskScore"),
    conflictRiskScore: asNumber(row, "conflictRiskScore"),
    status: asString(row, "status") as MergeQueueStatus,
    reasons: asArray<string>(row, "reasons"),
    blockingReasons: asArray<string>(row, "blockingReasons"),
    recommendation: asString(row, "recommendation") as MergeQueueEntry["recommendation"],
    simulationStatus: asOptionalString(row, "simulationStatus") as MergeQueueEntry["simulationStatus"],
    lastSimulationAt: asOptionalDate(row, "lastSimulationAt"),
    createdAt: asDate(row, "createdAt"),
    updatedAt: asDate(row, "updatedAt"),
    mergedAt: asOptionalDate(row, "mergedAt"),
    cancelledAt: asOptionalDate(row, "cancelledAt")
  };
}

function skillSelect(): string {
  return `SELECT id, name, version, description, status, approval_status AS "approvalStatus", eval_status AS "evalStatus", owner, compatible_agents AS "compatibleAgents", compatible_models AS "compatibleModels", required_tools AS "requiredTools", required_harnesses AS "requiredHarnesses", invocation_rules AS "invocationRules", instruction_ref AS "instructionRef", instruction_body AS "instructionBody", eval_refs AS "evalRefs", dependencies, tags, created_at AS "createdAt", updated_at AS "updatedAt" FROM skills`;
}

function skillToDb(skill: SkillPackage): Record<string, unknown> {
  return {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    description: skill.description,
    status: skill.status,
    approval_status: skill.approvalStatus,
    eval_status: skill.evalStatus,
    owner: skill.owner,
    compatible_agents: skill.compatibleAgents,
    compatible_models: skill.compatibleModels,
    required_tools: skill.requiredTools,
    required_harnesses: skill.requiredHarnesses,
    invocation_rules: skill.invocationRules,
    instruction_ref: skill.instructionRef,
    instruction_body: skill.instructionBody,
    eval_refs: skill.evalRefs,
    dependencies: skill.dependencies,
    tags: skill.tags,
    created_at: skill.createdAt,
    updated_at: skill.updatedAt
  };
}

function mapSkill(row: Row): SkillPackage {
  return {
    id: asString(row, "id"),
    name: asString(row, "name"),
    version: asString(row, "version"),
    description: asString(row, "description"),
    status: asString(row, "status") as SkillPackage["status"],
    approvalStatus: asString(row, "approvalStatus") as SkillPackage["approvalStatus"],
    evalStatus: asString(row, "evalStatus") as SkillPackage["evalStatus"],
    owner: asString(row, "owner"),
    compatibleAgents: asArray(row, "compatibleAgents"),
    compatibleModels: asArray<string>(row, "compatibleModels"),
    requiredTools: asArray<string>(row, "requiredTools"),
    requiredHarnesses: asArray<string>(row, "requiredHarnesses"),
    invocationRules: asArray<string>(row, "invocationRules"),
    instructionRef: row.instructionRef as SkillPackage["instructionRef"],
    instructionBody: asOptionalString(row, "instructionBody"),
    evalRefs: asArray<string>(row, "evalRefs"),
    dependencies: asArray(row, "dependencies"),
    tags: asArray<string>(row, "tags"),
    createdAt: asDate(row, "createdAt"),
    updatedAt: asDate(row, "updatedAt")
  };
}

function harnessSelect(): string {
  return `SELECT id, name, version, description, status, approval_status AS "approvalStatus", eval_status AS "evalStatus", owner, runtime_type AS "runtimeType", runtime_image AS "runtimeImage", allowed_tools AS "allowedTools", allowed_mcp_servers AS "allowedMcpServers", secret_scopes AS "secretScopes", network_policy AS "networkPolicy", test_commands AS "testCommands", dependencies, compatible_agents AS "compatibleAgents", instruction_loading_policy AS "instructionLoadingPolicy", created_at AS "createdAt", updated_at AS "updatedAt" FROM harnesses`;
}

function harnessToDb(harness: HarnessPackage): Record<string, unknown> {
  return {
    id: harness.id,
    name: harness.name,
    version: harness.version,
    description: harness.description,
    status: harness.status,
    approval_status: harness.approvalStatus,
    eval_status: harness.evalStatus,
    owner: harness.owner,
    runtime_type: harness.runtimeType,
    runtime_image: harness.runtimeImage,
    allowed_tools: harness.allowedTools,
    allowed_mcp_servers: harness.allowedMcpServers,
    secret_scopes: harness.secretScopes,
    network_policy: harness.networkPolicy,
    test_commands: harness.testCommands,
    dependencies: harness.dependencies,
    compatible_agents: harness.compatibleAgents,
    instruction_loading_policy: harness.instructionLoadingPolicy,
    created_at: harness.createdAt,
    updated_at: harness.updatedAt
  };
}

function mapHarness(row: Row): HarnessPackage {
  return {
    id: asString(row, "id"),
    name: asString(row, "name"),
    version: asString(row, "version"),
    description: asString(row, "description"),
    status: asString(row, "status") as HarnessPackage["status"],
    approvalStatus: asString(row, "approvalStatus") as HarnessPackage["approvalStatus"],
    evalStatus: asString(row, "evalStatus") as HarnessPackage["evalStatus"],
    owner: asString(row, "owner"),
    runtimeType: asString(row, "runtimeType") as HarnessPackage["runtimeType"],
    runtimeImage: asOptionalString(row, "runtimeImage"),
    allowedTools: asArray<string>(row, "allowedTools"),
    allowedMcpServers: asArray<string>(row, "allowedMcpServers"),
    secretScopes: asArray<string>(row, "secretScopes"),
    networkPolicy: row.networkPolicy as HarnessPackage["networkPolicy"],
    testCommands: asArray<string>(row, "testCommands"),
    dependencies: asArray(row, "dependencies"),
    compatibleAgents: asArray(row, "compatibleAgents"),
    instructionLoadingPolicy: row.instructionLoadingPolicy as HarnessPackage["instructionLoadingPolicy"],
    createdAt: asDate(row, "createdAt"),
    updatedAt: asDate(row, "updatedAt")
  };
}

function instructionSelect(): string {
  return `SELECT id, name, version, description, status, approval_status AS "approvalStatus", eval_status AS "evalStatus", owner, type, scope, path, body, checksum, checksum_algorithm AS "checksumAlgorithm", checksum_status AS "checksumStatus", checksum_verified_at AS "checksumVerifiedAt", precedence, applies_to_agents AS "appliesToAgents", applies_to_repos AS "appliesToRepos", applies_to_directories AS "appliesToDirectories", dependencies, max_context_bytes AS "maxContextBytes", created_at AS "createdAt", updated_at AS "updatedAt" FROM instructions`;
}

function instructionToDb(instruction: InstructionArtifact): Record<string, unknown> {
  return {
    id: instruction.id,
    name: instruction.name,
    version: instruction.version,
    description: instruction.description,
    status: instruction.status,
    approval_status: instruction.approvalStatus,
    eval_status: instruction.evalStatus,
    owner: instruction.owner,
    type: instruction.type,
    scope: instruction.scope,
    path: instruction.path,
    body: instruction.body,
    checksum: instruction.checksum,
    checksum_algorithm: instruction.checksumAlgorithm,
    checksum_status: instruction.checksumStatus,
    checksum_verified_at: instruction.checksumVerifiedAt,
    precedence: instruction.precedence,
    applies_to_agents: instruction.appliesToAgents,
    applies_to_repos: instruction.appliesToRepos,
    applies_to_directories: instruction.appliesToDirectories,
    dependencies: instruction.dependencies,
    max_context_bytes: instruction.maxContextBytes,
    created_at: instruction.createdAt,
    updated_at: instruction.updatedAt
  };
}

function mapInstruction(row: Row): InstructionArtifact {
  return {
    id: asString(row, "id"),
    name: asString(row, "name"),
    version: asString(row, "version"),
    description: asString(row, "description"),
    status: asString(row, "status") as InstructionArtifact["status"],
    approvalStatus: asString(row, "approvalStatus") as InstructionArtifact["approvalStatus"],
    evalStatus: asString(row, "evalStatus") as InstructionArtifact["evalStatus"],
    owner: asString(row, "owner"),
    type: asString(row, "type") as InstructionArtifact["type"],
    scope: asString(row, "scope") as InstructionArtifact["scope"],
    path: asOptionalString(row, "path"),
    body: asOptionalString(row, "body"),
    checksum: asString(row, "checksum"),
    checksumAlgorithm: asString(row, "checksumAlgorithm") as InstructionArtifact["checksumAlgorithm"],
    checksumStatus: asString(row, "checksumStatus") as InstructionArtifact["checksumStatus"],
    checksumVerifiedAt: asOptionalDate(row, "checksumVerifiedAt"),
    precedence: asNumber(row, "precedence"),
    appliesToAgents: asArray(row, "appliesToAgents"),
    appliesToRepos: asArray<string>(row, "appliesToRepos"),
    appliesToDirectories: asArray<string>(row, "appliesToDirectories"),
    dependencies: asArray(row, "dependencies"),
    maxContextBytes: asNumber(row, "maxContextBytes"),
    createdAt: asDate(row, "createdAt"),
    updatedAt: asDate(row, "updatedAt")
  };
}

function instructionSetToDb(instructionSet: InstructionSet): Record<string, unknown> {
  return {
    id: instructionSet.id,
    task_run_id: instructionSet.taskRunId,
    artifacts: instructionSet.artifacts,
    assembled_hash: instructionSet.assembledHash,
    max_context_bytes: instructionSet.maxContextBytes,
    created_at: instructionSet.createdAt
  };
}

function usageSelect(): string {
  return `SELECT id, task_id AS "taskId", task_run_id AS "taskRunId", user_id AS "userId", repo_id AS "repoId", provider, model, event_type AS "eventType", input_tokens AS "inputTokens", output_tokens AS "outputTokens", cost_usd AS "costUsd", latency_ms AS "latencyMs", skill_version AS "skillVersion", harness_version AS "harnessVersion", metadata, created_at AS "createdAt" FROM usage_ledger_entries`;
}

function usageToDb(event: UsageEvent): Record<string, unknown> {
  return {
    id: event.id,
    task_id: event.taskId,
    task_run_id: event.taskRunId,
    user_id: event.userId,
    repo_id: event.repoId,
    provider: event.provider,
    model: event.model,
    event_type: event.eventType,
    input_tokens: event.inputTokens,
    output_tokens: event.outputTokens,
    cost_usd: event.costUsd,
    latency_ms: event.latencyMs,
    skill_version: event.skillVersion,
    harness_version: event.harnessVersion,
    metadata: event.metadata,
    created_at: event.createdAt
  };
}

function mapUsage(row: Row): UsageEvent {
  return {
    id: asString(row, "id"),
    taskId: asOptionalString(row, "taskId"),
    taskRunId: asOptionalString(row, "taskRunId"),
    userId: asString(row, "userId"),
    repoId: asOptionalString(row, "repoId"),
    provider: asString(row, "provider"),
    model: asOptionalString(row, "model"),
    eventType: asString(row, "eventType") as UsageEvent["eventType"],
    inputTokens: asOptionalNumber(row, "inputTokens"),
    outputTokens: asOptionalNumber(row, "outputTokens"),
    costUsd: asOptionalNumber(row, "costUsd"),
    latencyMs: asOptionalNumber(row, "latencyMs"),
    skillVersion: asOptionalString(row, "skillVersion"),
    harnessVersion: asOptionalString(row, "harnessVersion"),
    metadata: asRecord(row, "metadata"),
    createdAt: asDate(row, "createdAt")
  };
}

function auditSelect(): string {
  return `SELECT id, actor_user_id AS "actorUserId", action, target_type AS "targetType", target_id AS "targetId", task_id AS "taskId", repo_id AS "repoId", metadata, created_at AS "createdAt" FROM audit_events`;
}

function auditToDb(event: AuditLog): Record<string, unknown> {
  return {
    id: event.id,
    actor_user_id: event.actorUserId,
    action: event.action,
    target_type: event.targetType,
    target_id: event.targetId,
    task_id: event.taskId,
    repo_id: event.repoId,
    metadata: event.metadata,
    created_at: event.createdAt
  };
}

function mapAudit(row: Row): AuditLog {
  return {
    id: asString(row, "id"),
    actorUserId: asOptionalString(row, "actorUserId"),
    action: asString(row, "action"),
    targetType: asString(row, "targetType"),
    targetId: asString(row, "targetId"),
    taskId: asOptionalString(row, "taskId"),
    repoId: asOptionalString(row, "repoId"),
    metadata: asRecord(row, "metadata"),
    createdAt: asDate(row, "createdAt")
  };
}

function registryAuditSelect(): string {
  return `SELECT id, actor_id AS "actorId", action, target_kind AS "targetKind", target_id AS "targetId", target_name AS "targetName", target_version AS "targetVersion", before, after, reason, created_at AS "createdAt" FROM registry_audit_logs`;
}

function registryAuditToDb(event: RegistryAuditLogEntry): Record<string, unknown> {
  return {
    id: event.id,
    actor_id: event.actorId,
    action: event.action,
    target_kind: event.targetKind,
    target_id: event.targetId,
    target_name: event.targetName,
    target_version: event.targetVersion,
    before: event.before,
    after: event.after,
    reason: event.reason,
    created_at: event.createdAt
  };
}

function mapRegistryAudit(row: Row): RegistryAuditLogEntry {
  return {
    id: asString(row, "id"),
    actorId: asString(row, "actorId"),
    action: asString(row, "action") as RegistryAuditLogEntry["action"],
    targetKind: asString(row, "targetKind") as RegistryKind,
    targetId: asString(row, "targetId"),
    targetName: asString(row, "targetName"),
    targetVersion: asString(row, "targetVersion"),
    before: row.before as RegistryAuditLogEntry["before"],
    after: row.after as RegistryAuditLogEntry["after"],
    reason: asOptionalString(row, "reason"),
    createdAt: asDate(row, "createdAt")
  };
}

function registryRevisionSelect(): string {
  return `SELECT id, target_kind AS "targetKind", target_id AS "targetId", target_name AS "targetName", target_version AS "targetVersion", revision_number AS "revisionNumber", snapshot, snapshot_checksum AS "snapshotChecksum", change_reason AS "changeReason", created_by AS "createdBy", created_at AS "createdAt", source_audit_log_id AS "sourceAuditLogId" FROM registry_revisions`;
}

function registryRevisionToDb(revision: RegistryRevision): Record<string, unknown> {
  return {
    id: revision.id,
    target_kind: revision.targetKind,
    target_id: revision.targetId,
    target_name: revision.targetName,
    target_version: revision.targetVersion,
    revision_number: revision.revisionNumber,
    snapshot: revision.snapshot,
    snapshot_checksum: revision.snapshotChecksum,
    change_reason: revision.changeReason,
    created_by: revision.createdBy,
    created_at: revision.createdAt,
    source_audit_log_id: revision.sourceAuditLogId
  };
}

function mapRegistryRevision(row: Row): RegistryRevision {
  return {
    id: asString(row, "id"),
    targetKind: asString(row, "targetKind") as RegistryKind,
    targetId: asString(row, "targetId"),
    targetName: asString(row, "targetName"),
    targetVersion: asString(row, "targetVersion"),
    revisionNumber: asNumber(row, "revisionNumber"),
    snapshot: asRecord(row, "snapshot"),
    snapshotChecksum: asString(row, "snapshotChecksum"),
    changeReason: asOptionalString(row, "changeReason"),
    createdBy: asString(row, "createdBy"),
    createdAt: asDate(row, "createdAt"),
    sourceAuditLogId: asOptionalString(row, "sourceAuditLogId")
  };
}

function registryEvalSelect(): string {
  return `SELECT id, target_kind AS "targetKind", target_id AS "targetId", target_name AS "targetName", target_version AS "targetVersion", eval_name AS "evalName", eval_type AS "evalType", status, score, max_score AS "maxScore", summary, details, attached_by AS "attachedBy", attached_at AS "attachedAt", source, artifact_ref AS "artifactRef" FROM registry_eval_results`;
}

function registryEvalToDb(result: RegistryEvalResult): Record<string, unknown> {
  return {
    id: result.id,
    target_kind: result.targetKind,
    target_id: result.targetId,
    target_name: result.targetName,
    target_version: result.targetVersion,
    eval_name: result.evalName,
    eval_type: result.evalType,
    status: result.status,
    score: result.score,
    max_score: result.maxScore,
    summary: result.summary,
    details: result.details,
    attached_by: result.attachedBy,
    attached_at: result.attachedAt,
    source: result.source,
    artifact_ref: result.artifactRef
  };
}

function mapRegistryEval(row: Row): RegistryEvalResult {
  return {
    id: asString(row, "id"),
    targetKind: asString(row, "targetKind") as RegistryKind,
    targetId: asString(row, "targetId"),
    targetName: asString(row, "targetName"),
    targetVersion: asString(row, "targetVersion"),
    evalName: asString(row, "evalName"),
    evalType: asString(row, "evalType") as RegistryEvalResult["evalType"],
    status: asString(row, "status") as RegistryEvalResult["status"],
    score: asOptionalNumber(row, "score"),
    maxScore: asOptionalNumber(row, "maxScore"),
    summary: asString(row, "summary"),
    details: asOptionalString(row, "details"),
    attachedBy: asString(row, "attachedBy"),
    attachedAt: asDate(row, "attachedAt"),
    source: asString(row, "source") as RegistryEvalResult["source"],
    artifactRef: asOptionalString(row, "artifactRef")
  };
}

function packageManifestSelect(): string {
  return `SELECT id, schema_version AS "schemaVersion", package_kind AS "packageKind", name, version, description, owner, manifest_version AS "manifestVersion", entries, dependencies, checksum, checksum_algorithm AS "checksumAlgorithm", created_at AS "createdAt", created_by AS "createdBy", tags, metadata FROM registry_packages`;
}

function packageManifestToDb(manifest: RegistryPackageManifest): Record<string, unknown> {
  return {
    id: manifest.id,
    schema_version: manifest.schemaVersion,
    package_kind: manifest.packageKind,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    owner: manifest.owner,
    manifest_version: manifest.manifestVersion,
    entries: manifest.entries,
    dependencies: manifest.dependencies,
    checksum: manifest.checksum,
    checksum_algorithm: manifest.checksumAlgorithm,
    created_at: manifest.createdAt,
    created_by: manifest.createdBy,
    tags: manifest.tags,
    metadata: manifest.metadata
  };
}

function mapPackageManifest(row: Row): RegistryPackageManifest {
  return {
    id: asString(row, "id"),
    schemaVersion: asString(row, "schemaVersion"),
    packageKind: asString(row, "packageKind") as RegistryPackageManifest["packageKind"],
    name: asString(row, "name"),
    version: asString(row, "version"),
    description: asString(row, "description"),
    owner: asString(row, "owner"),
    manifestVersion: asString(row, "manifestVersion"),
    entries: asArray(row, "entries"),
    dependencies: asArray(row, "dependencies"),
    checksum: asString(row, "checksum"),
    checksumAlgorithm: asString(row, "checksumAlgorithm") as RegistryPackageManifest["checksumAlgorithm"],
    createdAt: asDate(row, "createdAt"),
    createdBy: asString(row, "createdBy"),
    tags: asArray<string>(row, "tags"),
    metadata: asRecord(row, "metadata")
  };
}
