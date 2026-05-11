import type { BranchLease, ConflictRisk, MergeQueueEntry, MergeSimulationMode, MergeSimulationResult, MergeSimulationStatus } from "../domain/models.ts";

export type CreateBranchLeaseInput = Omit<BranchLease, "id" | "createdAt" | "updatedAt">;
export type UpdateBranchLeaseInput = Partial<Omit<BranchLease, "id" | "createdAt">>;

export type EnqueueMergeInput = Omit<
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
  reasons?: string[];
  blockingReasons?: string[];
};

export type MergeSimulationRequest = {
  repoId: string;
  repoPath?: string;
  baseRef: string;
  sourceRef: string;
  targetRef?: string;
  taskRunId?: string;
  branchLeaseId?: string;
  mode: MergeSimulationMode;
  requestedStatus?: MergeSimulationStatus;
};

export interface BranchLeaseStore {
  createLease(input: CreateBranchLeaseInput): Promise<BranchLease>;
  updateLease(id: string, input: UpdateBranchLeaseInput): Promise<BranchLease>;
  releaseLease(id: string, reason?: string): Promise<BranchLease>;
  listActiveLeases(repoId: string): Promise<BranchLease[]>;
  listLeasesByTaskRun(taskRunId: string): Promise<BranchLease[]>;
}

export interface ConflictRiskService {
  computePairRisk(source: BranchLease, target: BranchLease): ConflictRisk;
  computeRepoRiskGraph(repoId: string): Promise<ConflictRisk[]>;
  computeRiskForLease(leaseId: string): Promise<ConflictRisk[]>;
}

export interface MergeQueueService {
  enqueue(input: EnqueueMergeInput): Promise<MergeQueueEntry>;
  listQueue(repoId: string): Promise<MergeQueueEntry[]>;
  refreshEntryRisk(entryId: string): Promise<MergeQueueEntry>;
  markMerged(entryId: string): Promise<MergeQueueEntry>;
  cancel(entryId: string, reason?: string): Promise<MergeQueueEntry>;
}

export interface MergeSimulator {
  simulate(input: MergeSimulationRequest): Promise<MergeSimulationResult>;
}
