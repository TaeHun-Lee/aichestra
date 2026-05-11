import { createConflictRisk } from "@aichestra/core";
import type {
  ConflictRiskLevel,
  MergeSimulationResult as DomainMergeSimulationResult,
  PullRequest
} from "@aichestra/core";
import type {
  BranchRef,
  ConflictRiskInput,
  ConflictRiskResult,
  CreateBranchInput,
  CreatePullRequestInput,
  CreatePullRequestRequest,
  GitChangedFile,
  GitConnectionValidation,
  GitProvider,
  GitProviderAuditEvent,
  GitProviderConfigView,
  GitProviderKind,
  GitProviderOperation,
  GitProviderResult,
  MergeSimulationResult,
  PullRequestRef,
  RepoRef
} from "../interfaces.ts";

export type GitHubGitProviderOptions = {
  remoteGitEnabled?: boolean;
  remoteBranchCreateEnabled?: boolean;
  remotePullRequestCreateEnabled?: boolean;
  token?: string;
};

function auditEvent(
  operation: GitProviderOperation,
  result: GitProviderAuditEvent["result"],
  patch: Partial<GitProviderAuditEvent> = {}
): GitProviderAuditEvent {
  return {
    providerKind: "github",
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

function blocked<T>(
  operation: GitProviderOperation,
  reason: string,
  patch: Partial<GitProviderAuditEvent> = {}
): GitProviderResult<T> {
  return {
    ok: false,
    providerKind: "github",
    operation,
    blocked: true,
    reason,
    auditEvent: auditEvent(operation, "blocked", patch)
  };
}

export class GitHubGitProvider implements GitProvider {
  private readonly remoteGitEnabled: boolean;
  private readonly remoteBranchCreateEnabled: boolean;
  private readonly remotePullRequestCreateEnabled: boolean;
  private readonly configured: boolean;

  constructor(options: GitHubGitProviderOptions = {}) {
    this.remoteGitEnabled = options.remoteGitEnabled ?? false;
    this.remoteBranchCreateEnabled = options.remoteBranchCreateEnabled ?? false;
    this.remotePullRequestCreateEnabled = options.remotePullRequestCreateEnabled ?? false;
    this.configured = typeof options.token === "string" && options.token.length > 0;
  }

  getProviderKind(): GitProviderKind {
    return "github";
  }

  getConfig(): GitProviderConfigView {
    return {
      providerKind: "github",
      remoteGitEnabled: this.remoteGitEnabled,
      remoteBranchCreateEnabled: this.remoteBranchCreateEnabled,
      remotePullRequestCreateEnabled: this.remotePullRequestCreateEnabled,
      remoteMergeEnabled: false,
      githubConfigured: this.configured
    };
  }

  async validateConnection(): Promise<GitProviderResult<GitConnectionValidation>> {
    if (!this.remoteGitEnabled) {
      return blocked("validate_connection", "remote_git_disabled");
    }
    if (!this.configured) {
      return blocked("validate_connection", "github_credentials_missing");
    }
    return blocked("validate_connection", "github_provider_network_calls_not_implemented_in_v0");
  }

  async getRepository(input: RepoRef): Promise<GitProviderResult<RepoRef>> {
    return blocked("get_repository", "github_provider_network_calls_not_implemented_in_v0", { repoId: input.repoId });
  }

  async createBranch(input: CreateBranchInput): Promise<{ branchName: string }> {
    if (!this.remoteGitEnabled) throw new Error("remote_git_disabled");
    if (!this.remoteBranchCreateEnabled) throw new Error("remote_branch_create_disabled");
    throw new Error("github_branch_create_not_implemented_in_v0");
  }

  async getBranch(input: BranchRef): Promise<GitProviderResult<BranchRef>> {
    return blocked("get_branch", "github_provider_network_calls_not_implemented_in_v0", { repoId: input.repoId });
  }

  async listBranches(input: RepoRef): Promise<GitProviderResult<BranchRef[]>> {
    return blocked("list_branches", "github_provider_network_calls_not_implemented_in_v0", { repoId: input.repoId });
  }

  async createDraftPullRequest(input: CreatePullRequestInput): Promise<PullRequest> {
    const result = await this.createPullRequest(input);
    if (!result.ok || !result.data) {
      throw new Error(result.reason ?? "github_pull_request_create_blocked");
    }
    return result.data;
  }

  async createPullRequest(input: CreatePullRequestRequest): Promise<GitProviderResult<PullRequest>> {
    if (!this.remoteGitEnabled) {
      return blocked("create_pull_request", "remote_git_disabled", {
        repoId: input.repoId,
        taskId: input.taskId,
        taskRunId: input.taskRunId
      });
    }
    if (!this.remotePullRequestCreateEnabled) {
      return blocked("create_pull_request", "remote_pull_request_create_disabled", {
        repoId: input.repoId,
        taskId: input.taskId,
        taskRunId: input.taskRunId
      });
    }
    if (!this.configured) {
      return blocked("create_pull_request", "github_credentials_missing", {
        repoId: input.repoId,
        taskId: input.taskId,
        taskRunId: input.taskRunId
      });
    }
    return blocked("create_pull_request", "github_provider_network_calls_not_implemented_in_v0", {
      repoId: input.repoId,
      taskId: input.taskId,
      taskRunId: input.taskRunId
    });
  }

  async getPullRequest(input: PullRequestRef): Promise<GitProviderResult<PullRequest | undefined>> {
    return blocked("get_pull_request", "github_provider_network_calls_not_implemented_in_v0", { repoId: input.repoId });
  }

  async listPullRequests(input: RepoRef): Promise<GitProviderResult<PullRequest[]>> {
    return blocked("list_pull_requests", "github_provider_network_calls_not_implemented_in_v0", { repoId: input.repoId });
  }

  async getPullRequestDiff(input: PullRequestRef): Promise<GitProviderResult<string>> {
    return blocked("get_pull_request_diff", "github_provider_network_calls_not_implemented_in_v0", { repoId: input.repoId });
  }

  async getChangedFiles(input: BranchRef): Promise<GitProviderResult<GitChangedFile[]>> {
    return blocked("get_changed_files", "github_provider_network_calls_not_implemented_in_v0", { repoId: input.repoId });
  }

  async recordMergeSimulationResult(input: DomainMergeSimulationResult): Promise<GitProviderResult<DomainMergeSimulationResult>> {
    return blocked("record_merge_simulation_result", "github_provider_network_calls_not_implemented_in_v0", {
      repoId: input.repoId,
      taskRunId: input.taskRunId
    });
  }

  async simulateMerge(): Promise<MergeSimulationResult> {
    return { conflict: false, reason: "GitHub merge simulation is not implemented in v0." };
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

    return { score, riskLevel, reasons };
  }
}
