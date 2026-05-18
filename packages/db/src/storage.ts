import type {
  BranchLease,
  ConflictRisk,
  MergeQueueEntry,
  MergeSimulationResult,
  Task,
  TaskRun,
  UsageEvent
} from "@aichestra/core";
import { InMemoryImprovementRepository } from "@aichestra/improvement";
import type { ImprovementRepository } from "@aichestra/improvement";
import type { RegistryServiceInput } from "@aichestra/registry";
import {
  createInMemoryDurableCollaborationRepositories,
  type DurableCollaborationRepositories
} from "./durable-collaboration.ts";
import { InMemoryAichestraStore, createSeededStore } from "./repository.ts";
import { MockUsageLedger } from "./usage-ledger.ts";
import type { UsageLedger } from "./usage-ledger.ts";

export type StorageProviderKind = "in_memory" | "persistent" | "postgres";

export type StorageHealth = {
  kind: StorageProviderKind;
  healthy: boolean;
  message: string;
  checkedAt: Date;
};

export type UnitOfWork = {
  commit(): Promise<void>;
  rollback(): Promise<void>;
};

export type TaskRepository = {
  createTask(input: unknown): Task;
  listTasks(): Task[];
  getTask(id: string): Task | undefined;
  updateTask(id: string, patch: Partial<Task>): Task;
  transitionTask(id: string, status: Task["status"]): Task;
};

export type TaskRunRepository = {
  createTaskRun(input: Omit<TaskRun, "id" | "createdAt" | "updatedAt">): TaskRun;
  updateTaskRun(id: string, patch: Partial<TaskRun>): TaskRun;
  listTaskRuns(taskId?: string): TaskRun[];
};

export type UsageLedgerRepository = {
  recordUsage(input: Omit<UsageEvent, "id" | "createdAt">): UsageEvent;
  listUsageEvents(): UsageEvent[];
};

export type ConflictRepositories = {
  createBranchLease(input: Omit<BranchLease, "id" | "createdAt" | "updatedAt">): BranchLease;
  getBranchLease(id: string): BranchLease | undefined;
  listBranchLeases(repoId?: string, status?: BranchLease["status"]): BranchLease[];
  recordMergeSimulation(input: MergeSimulationResult): MergeSimulationResult;
  listMergeSimulations(filter?: { repoId?: string; taskRunId?: string; branchLeaseId?: string }): MergeSimulationResult[];
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
    > & Partial<Pick<MergeQueueEntry, "status" | "reasons" | "blockingReasons" | "recommendation" | "conflictRiskScore" | "simulationStatus" | "lastSimulationAt">>
  ): MergeQueueEntry;
  listMergeQueueEntries(repoId?: string): MergeQueueEntry[];
  computeRepoConflictRisks(repoId: string): ConflictRisk[];
};

export type RepositoryFactory = {
  createDataStore(): InMemoryAichestraStore;
  createTaskRepository(): TaskRepository;
  createTaskRunRepository(): TaskRunRepository;
  createUsageLedgerRepository(): UsageLedgerRepository;
  createUsageLedger(): UsageLedger;
  createConflictRepositories(): ConflictRepositories;
  createDurableCollaborationRepositories(): DurableCollaborationRepositories;
  createRegistryRepositories(): RegistryServiceInput;
  createImprovementRepositories(): ImprovementRepository;
};

export type StorageProvider = {
  kind: StorageProviderKind;
  repositoryFactory: RepositoryFactory;
  createUnitOfWork?(): Promise<UnitOfWork>;
  healthCheck(): Promise<StorageHealth>;
  close?(): Promise<void>;
};

export type InMemoryStorageProviderInput = {
  store?: InMemoryAichestraStore;
  improvementRepository?: ImprovementRepository;
  repoRoot?: string;
};

export class InMemoryRepositoryFactory implements RepositoryFactory {
  private readonly store: InMemoryAichestraStore;
  private readonly improvementRepository: ImprovementRepository;
  private readonly durableCollaborationRepositories: DurableCollaborationRepositories;
  private readonly repoRoot?: string;

  constructor(input: InMemoryStorageProviderInput = {}) {
    this.store = input.store ?? createSeededStore();
    this.improvementRepository = input.improvementRepository ?? new InMemoryImprovementRepository();
    this.durableCollaborationRepositories = createInMemoryDurableCollaborationRepositories("in_memory");
    this.repoRoot = input.repoRoot;
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
    return new MockUsageLedger(this.store);
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
      packageRepository: this.store,
      repoRoot: this.repoRoot
    };
  }

  createImprovementRepositories(): ImprovementRepository {
    return this.improvementRepository;
  }
}

export function createInMemoryStorageProvider(input: InMemoryStorageProviderInput = {}): StorageProvider {
  return {
    kind: "in_memory",
    repositoryFactory: new InMemoryRepositoryFactory(input),
    async createUnitOfWork() {
      return {
        async commit() {
          return undefined;
        },
        async rollback() {
          return undefined;
        }
      };
    },
    async healthCheck() {
      return {
        kind: "in_memory",
        healthy: true,
        message: "In-memory storage provider is available for tests and mock-first MVP runtime.",
        checkedAt: new Date()
      };
    },
    async close() {
      return undefined;
    }
  };
}

export class PersistentRepositoryFactoryPlaceholder implements RepositoryFactory {
  private notImplemented(): never {
    throw new Error("Persistent repository factory is not implemented. Use createInMemoryStorageProvider for the MVP or implement Persistent DB v1.");
  }

  createDataStore(): InMemoryAichestraStore {
    return this.notImplemented();
  }

  createTaskRepository(): TaskRepository {
    return this.notImplemented();
  }

  createTaskRunRepository(): TaskRunRepository {
    return this.notImplemented();
  }

  createUsageLedgerRepository(): UsageLedgerRepository {
    return this.notImplemented();
  }

  createUsageLedger(): UsageLedger {
    return this.notImplemented();
  }

  createConflictRepositories(): ConflictRepositories {
    return this.notImplemented();
  }

  createDurableCollaborationRepositories(): DurableCollaborationRepositories {
    return this.notImplemented();
  }

  createRegistryRepositories(): RegistryServiceInput {
    return this.notImplemented();
  }

  createImprovementRepositories(): ImprovementRepository {
    return this.notImplemented();
  }
}

export function createPersistentStorageProviderPlaceholder(): StorageProvider {
  return {
    kind: "persistent",
    repositoryFactory: new PersistentRepositoryFactoryPlaceholder(),
    async healthCheck() {
      return {
        kind: "persistent",
        healthy: false,
        message: "Persistent storage is planned but not wired in Real Integration Foundation v0.",
        checkedAt: new Date()
      };
    }
  };
}
