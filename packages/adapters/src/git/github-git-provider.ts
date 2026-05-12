import { createConflictRisk, createId } from "@aichestra/core";
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
  GitChangedFilesInput,
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
import { NoopGitHubClient, sanitizeChangedFile } from "./github-client.ts";
import type { GitHubClient, GitHubPullRequest } from "./github-client.ts";

export type GitHubGitProviderOptions = {
  remoteGitEnabled?: boolean;
  remoteBranchCreateEnabled?: boolean;
  remotePullRequestCreateEnabled?: boolean;
  token?: string;
  owner?: string;
  repo?: string;
  allowedRepos?: string[];
  allowedBranchPrefix?: string;
  integrationTestsEnabled?: boolean;
  client?: GitHubClient;
};

type RepoTarget = {
  owner: string;
  repo: string;
  slug: string;
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

function result<T>(
  operation: GitProviderOperation,
  data: T | undefined,
  patch: Partial<GitProviderResult<T>> & Partial<GitProviderAuditEvent> = {}
): GitProviderResult<T> {
  return {
    ok: patch.ok ?? true,
    providerKind: "github",
    operation,
    data,
    blocked: patch.blocked,
    reason: patch.reason,
    auditEvent: auditEvent(operation, patch.ok === false ? (patch.blocked ? "blocked" : "failed") : "succeeded", patch)
  };
}

function blocked<T>(
  operation: GitProviderOperation,
  reason: string,
  patch: Partial<GitProviderAuditEvent> = {}
): GitProviderResult<T> {
  return result<T>(operation, undefined, {
    ok: false,
    blocked: true,
    reason,
    ...patch
  });
}

export class GitHubGitProvider implements GitProvider {
  private readonly remoteGitEnabled: boolean;
  private readonly remoteBranchCreateEnabled: boolean;
  private readonly remotePullRequestCreateEnabled: boolean;
  private readonly configured: boolean;
  private readonly owner?: string;
  private readonly repo?: string;
  private readonly allowedRepos: string[];
  private readonly allowedBranchPrefix: string;
  private readonly integrationTestsEnabled: boolean;
  private readonly client: GitHubClient;

  constructor(options: GitHubGitProviderOptions = {}) {
    this.remoteGitEnabled = options.remoteGitEnabled ?? false;
    this.remoteBranchCreateEnabled = options.remoteBranchCreateEnabled ?? false;
    this.remotePullRequestCreateEnabled = options.remotePullRequestCreateEnabled ?? false;
    this.configured = typeof options.token === "string" && options.token.length > 0;
    this.owner = optionalNonEmpty(options.owner);
    this.repo = optionalNonEmpty(options.repo);
    this.allowedRepos = normalizeAllowedRepos(options.allowedRepos ?? []);
    this.allowedBranchPrefix = options.allowedBranchPrefix ?? "ai/";
    this.integrationTestsEnabled = options.integrationTestsEnabled ?? false;
    this.client = options.client ?? new NoopGitHubClient();
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
      githubConfigured: this.configured,
      githubOwnerConfigured: Boolean(this.owner),
      githubRepoConfigured: Boolean(this.repo),
      githubAllowedRepoCount: this.allowedRepos.length,
      githubAllowedBranchPrefix: this.allowedBranchPrefix,
      githubIntegrationTestsEnabled: this.integrationTestsEnabled
    };
  }

  async validateConnection(): Promise<GitProviderResult<GitConnectionValidation>> {
    const guard = this.validateRead("validate_connection", undefined);
    if (!guard.ok) return blocked("validate_connection", guard.reason, { metadata: guard.metadata });

    try {
      const connection = await this.client.validateConnection();
      await this.client.getRepository(guard.target.owner, guard.target.repo);
      return result("validate_connection", {
        providerKind: "github",
        remote: true,
        configured: true,
        message: connection.message
      }, { metadata: { repoRef: guard.target.slug } });
    } catch (error) {
      return blocked("validate_connection", "github_connection_failed", {
        metadata: {
          repoRef: guard.target.slug,
          error: error instanceof Error ? error.message : "unknown"
        }
      });
    }
  }

  async getRepository(input: RepoRef): Promise<GitProviderResult<RepoRef>> {
    const guard = this.validateRead("get_repository", input);
    if (!guard.ok) return blocked("get_repository", guard.reason, { repoId: input.repoId, metadata: guard.metadata });
    try {
      const repository = await this.client.getRepository(guard.target.owner, guard.target.repo);
      return result("get_repository", {
        ...input,
        owner: repository.owner,
        name: repository.name,
        defaultBranch: repository.defaultBranch
      }, { repoId: input.repoId, metadata: { repoRef: guard.target.slug } });
    } catch (error) {
      return blocked("get_repository", "github_repository_read_failed", {
        repoId: input.repoId,
        metadata: { repoRef: guard.target.slug, error: safeError(error) }
      });
    }
  }

  async createBranch(input: CreateBranchInput): Promise<{ branchName: string }> {
    const guard = this.validateWrite("create_branch", input.repoRef, input.branchName);
    if (!guard.ok) throw new Error(guard.reason);

    try {
      await this.client.createBranch(guard.target.owner, guard.target.repo, input.baseBranch, input.branchName);
      return { branchName: input.branchName };
    } catch (error) {
      throw new Error(`github_branch_create_failed:${safeError(error)}`);
    }
  }

  async getBranch(input: BranchRef & { repoRef?: RepoRef }): Promise<GitProviderResult<BranchRef>> {
    const guard = this.validateRead("get_branch", input.repoRef);
    if (!guard.ok) return blocked("get_branch", guard.reason, { repoId: input.repoId, metadata: guard.metadata });
    try {
      await this.client.getBranch(guard.target.owner, guard.target.repo, input.branchName);
      return result("get_branch", { ...input, exists: true }, { repoId: input.repoId, metadata: { repoRef: guard.target.slug } });
    } catch (error) {
      return result("get_branch", { ...input, exists: false }, {
        ok: false,
        reason: `github_branch_read_failed:${safeError(error)}`,
        repoId: input.repoId,
        metadata: { repoRef: guard.target.slug }
      });
    }
  }

  async listBranches(input: RepoRef): Promise<GitProviderResult<BranchRef[]>> {
    return blocked("list_branches", "github_list_branches_not_implemented_in_v1", { repoId: input.repoId });
  }

  async createDraftPullRequest(input: CreatePullRequestInput): Promise<PullRequest> {
    const result = await this.createPullRequest(input);
    if (!result.ok || !result.data) {
      throw new Error(result.reason ?? "github_pull_request_create_blocked");
    }
    return result.data;
  }

  async createPullRequest(input: CreatePullRequestRequest): Promise<GitProviderResult<PullRequest>> {
    const guard = this.validatePullRequest(input);
    if (!guard.ok) {
      return blocked("create_pull_request", guard.reason, {
        repoId: input.repoId,
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        metadata: guard.metadata
      });
    }

    try {
      const created = await this.client.createPullRequest(
        guard.target.owner,
        guard.target.repo,
        sanitizeText(input.title, 240),
        input.branchName,
        input.baseBranch,
        sanitizeText(input.body ?? "", 4000)
      );
      return result("create_pull_request", pullRequestFromGitHub(input, created), {
        repoId: input.repoId,
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        metadata: {
          repoRef: guard.target.slug,
          pullRequestNumber: created.number,
          head: created.head,
          base: created.base
        }
      });
    } catch (error) {
      return blocked("create_pull_request", `github_pull_request_create_failed:${safeError(error)}`, {
        repoId: input.repoId,
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        metadata: { repoRef: guard.target.slug }
      });
    }
  }

  async getPullRequest(input: PullRequestRef & { repoRef?: RepoRef }): Promise<GitProviderResult<PullRequest | undefined>> {
    const guard = this.validateRead("get_pull_request", input.repoRef);
    if (!guard.ok) return blocked("get_pull_request", guard.reason, { repoId: input.repoId, metadata: guard.metadata });
    const pullRequestNumber = pullRequestNumberFromRef(input);
    if (pullRequestNumber === undefined) {
      return blocked("get_pull_request", "github_pull_request_number_required", { repoId: input.repoId, metadata: { repoRef: guard.target.slug } });
    }
    try {
      const pr = await this.client.getPullRequest(guard.target.owner, guard.target.repo, pullRequestNumber);
      return result("get_pull_request", pullRequestFromGitHub({
        taskId: "unknown",
        repoId: input.repoId,
        provider: "github"
      }, pr), { repoId: input.repoId, metadata: { repoRef: guard.target.slug, pullRequestNumber } });
    } catch (error) {
      return blocked("get_pull_request", `github_pull_request_read_failed:${safeError(error)}`, {
        repoId: input.repoId,
        metadata: { repoRef: guard.target.slug, pullRequestNumber }
      });
    }
  }

  async listPullRequests(input: RepoRef): Promise<GitProviderResult<PullRequest[]>> {
    const guard = this.validateRead("list_pull_requests", input);
    if (!guard.ok) return blocked("list_pull_requests", guard.reason, { repoId: input.repoId, metadata: guard.metadata });
    try {
      const prs = await this.client.listPullRequests(guard.target.owner, guard.target.repo);
      return result(
        "list_pull_requests",
        prs.map((pr) => pullRequestFromGitHub({
          taskId: "unknown",
          repoId: input.repoId,
          provider: "github"
        }, pr)),
        { repoId: input.repoId, metadata: { repoRef: guard.target.slug } }
      );
    } catch (error) {
      return blocked("list_pull_requests", `github_pull_request_list_failed:${safeError(error)}`, {
        repoId: input.repoId,
        metadata: { repoRef: guard.target.slug }
      });
    }
  }

  async getPullRequestDiff(input: PullRequestRef): Promise<GitProviderResult<string>> {
    return blocked("get_pull_request_diff", "github_pull_request_diff_not_implemented_in_v1", { repoId: input.repoId });
  }

  async getChangedFiles(input: GitChangedFilesInput): Promise<GitProviderResult<GitChangedFile[]>> {
    const guard = this.validateRead("get_changed_files", input.repoRef);
    if (!guard.ok) return blocked("get_changed_files", guard.reason, { repoId: input.repoId, metadata: guard.metadata });
    if (input.pullRequestNumber === undefined || !Number.isInteger(input.pullRequestNumber) || input.pullRequestNumber < 1) {
      return blocked("get_changed_files", "github_pull_request_number_required", {
        repoId: input.repoId,
        metadata: { repoRef: guard.target.slug }
      });
    }

    try {
      const files = await this.client.getPullRequestChangedFiles(guard.target.owner, guard.target.repo, input.pullRequestNumber);
      return result("get_changed_files", files.map(sanitizeChangedFile), {
        repoId: input.repoId,
        metadata: {
          repoRef: guard.target.slug,
          pullRequestNumber: input.pullRequestNumber,
          changedFileCount: files.length
        }
      });
    } catch (error) {
      return blocked("get_changed_files", `github_changed_files_read_failed:${safeError(error)}`, {
        repoId: input.repoId,
        metadata: { repoRef: guard.target.slug, pullRequestNumber: input.pullRequestNumber }
      });
    }
  }

  async recordMergeSimulationResult(input: DomainMergeSimulationResult): Promise<GitProviderResult<DomainMergeSimulationResult>> {
    return blocked("record_merge_simulation_result", "github_merge_simulation_recording_not_implemented_in_v1", {
      repoId: input.repoId,
      taskRunId: input.taskRunId
    });
  }

  async simulateMerge(): Promise<MergeSimulationResult> {
    return { conflict: false, reason: "GitHub merge simulation is not implemented in v1." };
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

  private validateRead(operation: GitProviderOperation, repoRef: RepoRef | undefined): { ok: true; target: RepoTarget } | { ok: false; reason: string; metadata: Record<string, unknown> } {
    if (!this.remoteGitEnabled) return { ok: false, reason: "remote_git_disabled", metadata: { operation } };
    if (!this.configured) return { ok: false, reason: "github_credentials_missing", metadata: { operation } };
    const target = this.resolveTarget(repoRef);
    if (!target) return { ok: false, reason: "github_repository_missing", metadata: { operation } };
    if (!this.repoAllowed(target.slug)) return { ok: false, reason: "repo_not_allowlisted", metadata: { operation, repoRef: target.slug } };
    return { ok: true, target };
  }

  private validateWrite(operation: GitProviderOperation, repoRef: RepoRef | undefined, branchName: string): { ok: true; target: RepoTarget } | { ok: false; reason: string; metadata: Record<string, unknown> } {
    if (!this.remoteGitEnabled) return { ok: false, reason: "remote_git_disabled", metadata: { operation } };
    if (operation === "create_branch" && !this.remoteBranchCreateEnabled) {
      return { ok: false, reason: "remote_branch_create_disabled", metadata: { operation } };
    }
    if (!this.configured) return { ok: false, reason: "github_credentials_missing", metadata: { operation } };
    const target = this.resolveTarget(repoRef);
    if (!target) return { ok: false, reason: "github_repository_missing", metadata: { operation } };
    if (!this.repoAllowed(target.slug)) {
      return { ok: false, reason: "repo_not_allowlisted", metadata: { operation, repoRef: target.slug } };
    }
    if (!branchName.startsWith(this.allowedBranchPrefix)) {
      return { ok: false, reason: "branch_prefix_not_allowed", metadata: { operation, repoRef: target.slug, branchPrefix: this.allowedBranchPrefix } };
    }
    return { ok: true, target };
  }

  private validatePullRequest(input: CreatePullRequestRequest): { ok: true; target: RepoTarget } | { ok: false; reason: string; metadata: Record<string, unknown> } {
    if (!this.remoteGitEnabled) return { ok: false, reason: "remote_git_disabled", metadata: { operation: "create_pull_request" } };
    if (!this.remotePullRequestCreateEnabled) {
      return { ok: false, reason: "remote_pr_create_disabled", metadata: { operation: "create_pull_request" } };
    }
    if (!this.configured) return { ok: false, reason: "github_credentials_missing", metadata: { operation: "create_pull_request" } };
    const target = this.resolveTarget(input.repoRef);
    if (!target) return { ok: false, reason: "github_repository_missing", metadata: { operation: "create_pull_request" } };
    if (!this.repoAllowed(target.slug)) {
      return { ok: false, reason: "repo_not_allowlisted", metadata: { operation: "create_pull_request", repoRef: target.slug } };
    }
    if (!input.branchName.startsWith(this.allowedBranchPrefix)) {
      return { ok: false, reason: "branch_prefix_not_allowed", metadata: { operation: "create_pull_request", repoRef: target.slug, branchPrefix: this.allowedBranchPrefix } };
    }
    return { ok: true, target };
  }

  private resolveTarget(repoRef: RepoRef | undefined): RepoTarget | undefined {
    const owner = optionalNonEmpty(repoRef?.owner) ?? this.owner;
    const repo = optionalNonEmpty(repoRef?.name) ?? this.repo;
    if (!owner || !repo) return undefined;
    return { owner, repo, slug: normalizeRepoSlug(owner, repo) };
  }

  private repoAllowed(slug: string): boolean {
    return this.allowedRepos.includes(slug);
  }
}

function pullRequestFromGitHub(input: Pick<CreatePullRequestRequest, "taskId" | "repoId" | "provider">, pr: GitHubPullRequest): PullRequest {
  const now = new Date();
  return {
    id: createId("pr"),
    taskId: input.taskId,
    repoId: input.repoId,
    provider: "github",
    externalId: String(pr.number),
    url: pr.htmlUrl,
    status: pr.state === "merged" ? "merged" : pr.state === "closed" ? "closed" : "open",
    createdAt: now,
    updatedAt: now
  };
}

function pullRequestNumberFromRef(input: PullRequestRef): number | undefined {
  if (typeof input.pullRequestNumber === "number" && Number.isInteger(input.pullRequestNumber) && input.pullRequestNumber > 0) {
    return input.pullRequestNumber;
  }
  if (input.externalId && /^\d+$/.test(input.externalId)) {
    return Number(input.externalId);
  }
  if (input.pullRequestId && /^\d+$/.test(input.pullRequestId)) {
    return Number(input.pullRequestId);
  }
  return undefined;
}

function normalizeAllowedRepos(values: string[]): string[] {
  return values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => /^[^/\s]+\/[^/\s]+$/.test(value));
}

function normalizeRepoSlug(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

function optionalNonEmpty(value: string | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function safeError(error: unknown): string {
  return error instanceof Error ? sanitizeText(error.message, 240) : "unknown";
}

function sanitizeText(value: string, maxLength: number): string {
  return value
    .replace(/ghp_[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
