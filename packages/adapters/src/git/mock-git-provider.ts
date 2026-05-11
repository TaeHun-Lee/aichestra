import { createConflictRisk, createId } from "@aichestra/core";
import type { BranchLease, ConflictRiskLevel, PullRequest, RepoProvider } from "@aichestra/core";
import type {
  ConflictRiskInput,
  ConflictRiskResult,
  CreateBranchInput,
  CreatePullRequestInput,
  GitProvider,
  MergeSimulationResult
} from "../interfaces.ts";

export class MockGitProvider implements GitProvider {
  async createBranch(input: CreateBranchInput): Promise<{ branchName: string }> {
    return { branchName: input.branchName };
  }

  async createDraftPullRequest(input: CreatePullRequestInput): Promise<PullRequest> {
    const now = new Date();
    const provider: RepoProvider = input.provider;

    const id = createId("pr");
    const externalId = `mock-${id}`;

    return {
      id,
      taskId: input.taskId,
      repoId: input.repoId,
      provider,
      externalId,
      url: `mock://pull-requests/${externalId}`,
      status: "draft",
      createdAt: now,
      updatedAt: now
    };
  }

  async simulateMerge(input: CreateBranchInput): Promise<MergeSimulationResult> {
    if (input.branchName.includes("conflict")) {
      return {
        conflict: true,
        reason: "Mock branch name requested a conflict"
      };
    }

    return { conflict: false };
  }

  computeConflictRisk(input: ConflictRiskInput): ConflictRiskResult {
    let score = 0;
    let riskLevel: ConflictRiskLevel = "none";
    const reasons: string[] = [];

    for (const lease of input.activeLeases.filter((lease) => lease.id !== input.currentLease.id && lease.taskRunId !== input.currentLease.taskRunId)) {
      const risk = createConflictRisk(input.currentLease, lease);
      if (risk.riskScore > score) {
        score = risk.riskScore;
        riskLevel = risk.riskLevel;
      }
      reasons.push(...risk.reasons.map((reason) => `${reason}:${lease.taskRunId}`));
    }

    return {
      score,
      riskLevel,
      reasons
    };
  }
}

export function createMockLease(
  input: Omit<BranchLease, "id" | "createdAt" | "updatedAt" | "taskRunId" | "branchId" | "status"> & Partial<Pick<BranchLease, "taskRunId" | "branchId" | "status">>
): BranchLease {
  const now = new Date();
  const id = createId("lease");
  return {
    ...input,
    id,
    taskRunId: input.taskRunId ?? `run_${input.taskId}`,
    branchId: input.branchId ?? `branch_${input.taskId}`,
    status: input.status ?? "active",
    createdAt: now,
    updatedAt: now
  };
}
