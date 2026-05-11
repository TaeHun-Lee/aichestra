import { createConflictRisk, createId } from "@aichestra/core";
import type {
  BranchLease,
  ConflictRiskLevel,
  MergeSimulationResult as DomainMergeSimulationResult,
  PullRequest,
  RepoProvider
} from "@aichestra/core";
import type {
  BranchRef,
  ConflictRiskInput,
  ConflictRiskResult,
  CreateBranchInput,
  CreatePullRequestInput,
  CreatePullRequestRequest,
  GitProvider,
  GitProviderAuditEvent,
  GitProviderKind,
  GitProviderOperation,
  GitProviderResult,
  GitChangedFile,
  MergeSimulationResult
} from "../interfaces.ts";
import type { PullRequestRef, RepoRef } from "../interfaces.ts";

function auditEvent(
  operation: GitProviderOperation,
  result: GitProviderAuditEvent["result"],
  patch: Partial<GitProviderAuditEvent> = {}
): GitProviderAuditEvent {
  return {
    providerKind: "mock",
    operation,
    result,
    repoId: patch.repoId,
    taskId: patch.taskId,
    taskRunId: patch.taskRunId,
    actorId: patch.actorId,
    metadata: patch.metadata,
    createdAt: patch.createdAt ?? new Date()
  };
}

function ok<T>(operation: GitProviderOperation, data: T, patch: Partial<GitProviderAuditEvent> = {}): GitProviderResult<T> {
  return {
    ok: true,
    providerKind: "mock",
    operation,
    data,
    auditEvent: auditEvent(operation, "succeeded", patch)
  };
}

export class MockGitProvider implements GitProvider {
  private readonly branches = new Map<string, Set<string>>();
  private readonly pullRequests: PullRequest[] = [];

  getProviderKind(): GitProviderKind {
    return "mock";
  }

  async validateConnection(): Promise<GitProviderResult<{ providerKind: GitProviderKind; remote: boolean; configured: boolean; message: string }>> {
    return ok("validate_connection", {
      providerKind: "mock",
      remote: false,
      configured: true,
      message: "Mock Git provider is always available."
    });
  }

  async getRepository(input: RepoRef): Promise<GitProviderResult<RepoRef>> {
    return ok("get_repository", input, { repoId: input.repoId });
  }

  async createBranch(input: CreateBranchInput): Promise<{ branchName: string }> {
    const branches = this.branches.get(input.repoId) ?? new Set<string>();
    branches.add(input.baseBranch);
    branches.add(input.branchName);
    this.branches.set(input.repoId, branches);
    return { branchName: input.branchName };
  }

  async getBranch(input: BranchRef): Promise<GitProviderResult<BranchRef>> {
    const exists = this.branches.get(input.repoId)?.has(input.branchName) ?? false;
    return ok("get_branch", { ...input, exists }, { repoId: input.repoId });
  }

  async listBranches(input: RepoRef): Promise<GitProviderResult<BranchRef[]>> {
    const branches = [...(this.branches.get(input.repoId) ?? new Set([input.defaultBranch ?? "main"]))].sort();
    return ok(
      "list_branches",
      branches.map((branchName) => ({
        repoId: input.repoId,
        branchName,
        baseBranch: input.defaultBranch,
        exists: true
      })),
      { repoId: input.repoId }
    );
  }

  async createDraftPullRequest(input: CreatePullRequestInput): Promise<PullRequest> {
    const now = new Date();
    const provider: RepoProvider = input.provider;

    const id = createId("pr");
    const externalId = `mock-${id}`;

    const pullRequest: PullRequest = {
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
    this.pullRequests.push(pullRequest);
    return pullRequest;
  }

  async createPullRequest(input: CreatePullRequestRequest): Promise<GitProviderResult<PullRequest>> {
    const pullRequest = await this.createDraftPullRequest(input);
    return ok("create_pull_request", pullRequest, {
      repoId: input.repoId,
      taskId: input.taskId,
      taskRunId: input.taskRunId
    });
  }

  async getPullRequest(input: PullRequestRef): Promise<GitProviderResult<PullRequest | undefined>> {
    const pullRequest = this.pullRequests.find(
      (candidate) =>
        candidate.repoId === input.repoId &&
        (candidate.id === input.pullRequestId || candidate.externalId === input.externalId || candidate.url === input.url)
    );
    return ok("get_pull_request", pullRequest, { repoId: input.repoId });
  }

  async listPullRequests(input: RepoRef): Promise<GitProviderResult<PullRequest[]>> {
    return ok(
      "list_pull_requests",
      this.pullRequests.filter((pullRequest) => pullRequest.repoId === input.repoId),
      { repoId: input.repoId }
    );
  }

  async getPullRequestDiff(input: PullRequestRef): Promise<GitProviderResult<string>> {
    return ok("get_pull_request_diff", "2 files changed, 18 insertions, 4 deletions", { repoId: input.repoId });
  }

  async getChangedFiles(input: BranchRef): Promise<GitProviderResult<GitChangedFile[]>> {
    return ok(
      "get_changed_files",
      [
        { path: "src/auth/session.ts", status: "modified" },
        { path: "tests/auth/session.test.ts", status: "modified" }
      ],
      { repoId: input.repoId }
    );
  }

  async recordMergeSimulationResult(input: DomainMergeSimulationResult): Promise<GitProviderResult<DomainMergeSimulationResult>> {
    return ok("record_merge_simulation_result", input, {
      repoId: input.repoId,
      taskRunId: input.taskRunId,
      metadata: { status: input.status }
    });
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
