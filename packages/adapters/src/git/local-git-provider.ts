import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { createConflictRisk, createId } from "@aichestra/core";
import type {
  BranchLease,
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
  GitProvider,
  GitProviderAuditEvent,
  GitProviderKind,
  GitProviderOperation,
  GitProviderResult,
  MergeSimulationResult,
  PullRequestRef,
  RepoRef
} from "../interfaces.ts";

const execFileAsync = promisify(execFile);

export type LocalGitProviderOptions = {
  allowLocalBranchCreate?: boolean;
};

function event(
  operation: GitProviderOperation,
  result: GitProviderAuditEvent["result"],
  patch: Partial<GitProviderAuditEvent> = {}
): GitProviderAuditEvent {
  return {
    providerKind: "local",
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
    providerKind: "local",
    operation,
    data,
    blocked: patch.blocked,
    reason: patch.reason,
    auditEvent: event(operation, patch.ok === false ? (patch.blocked ? "blocked" : "failed") : "succeeded", patch)
  };
}

function normalizePath(input: string | undefined): string | undefined {
  if (!input) return undefined;
  return path.resolve(input);
}

function isUnsafePath(resolved: string): boolean {
  const parsed = path.parse(resolved);
  return resolved === parsed.root;
}

async function git(repoPath: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const command = await execFileAsync("git", ["-C", repoPath, ...args], {
      encoding: "utf8",
      windowsHide: true
    });
    return {
      stdout: command.stdout,
      stderr: command.stderr,
      exitCode: 0
    };
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: execError.stdout ?? "",
      stderr: execError.stderr ?? "",
      exitCode: typeof execError.code === "number" ? execError.code : 1
    };
  }
}

function parseChangedFiles(stdout: string): GitChangedFile[] {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): GitChangedFile => {
      const [rawStatus, firstPath, secondPath] = line.split(/\t/);
      const code = rawStatus?.[0] ?? "?";
      if (code === "A") return { path: firstPath ?? "", status: "added" };
      if (code === "M") return { path: firstPath ?? "", status: "modified" };
      if (code === "D") return { path: firstPath ?? "", status: "deleted" };
      if (code === "R") return { path: secondPath ?? firstPath ?? "", previousPath: firstPath, status: "renamed" };
      if (code === "C") return { path: secondPath ?? firstPath ?? "", previousPath: firstPath, status: "copied" };
      return { path: firstPath ?? "", status: "unknown" };
    })
    .filter((file) => file.path.length > 0);
}

export class LocalGitProvider implements GitProvider {
  private readonly allowLocalBranchCreate: boolean;
  private readonly pullRequests: PullRequest[] = [];

  constructor(options: LocalGitProviderOptions = {}) {
    this.allowLocalBranchCreate = options.allowLocalBranchCreate ?? false;
  }

  getProviderKind(): GitProviderKind {
    return "local";
  }

  async validateConnection(): Promise<GitProviderResult<{ providerKind: GitProviderKind; remote: boolean; configured: boolean; message: string }>> {
    return result("validate_connection", {
      providerKind: "local",
      remote: false,
      configured: true,
      message: "Local Git provider is available when requests include a safe local repo path."
    });
  }

  async getRepository(input: RepoRef): Promise<GitProviderResult<RepoRef>> {
    const safe = await this.validateRepo(input);
    if (!safe.ok) return safe;
    return result("get_repository", { ...input, localPath: safe.data?.localPath }, { repoId: input.repoId });
  }

  async createBranch(input: CreateBranchInput & { repoRef?: RepoRef }): Promise<{ branchName: string }> {
    const validation = await this.validateRepo(input.repoRef);
    if (!validation.ok || !validation.data?.localPath) {
      throw new Error(validation.reason ?? "Local repo path is required.");
    }
    if (!this.allowLocalBranchCreate) {
      throw new Error("Local branch creation is disabled by default.");
    }

    const branch = await git(validation.data.localPath, ["branch", input.branchName, input.baseBranch]);
    if (branch.exitCode !== 0) {
      throw new Error("Local branch creation failed.");
    }
    return { branchName: input.branchName };
  }

  async getBranch(input: BranchRef & { repoRef?: RepoRef }): Promise<GitProviderResult<BranchRef>> {
    const validation = await this.validateRepo(input.repoRef);
    if (!validation.ok || !validation.data?.localPath) {
      return result("get_branch", { ...input, exists: false }, { ok: false, blocked: true, reason: validation.reason, repoId: input.repoId });
    }
    const branch = await git(validation.data.localPath, ["rev-parse", "--verify", `refs/heads/${input.branchName}`]);
    return result("get_branch", { ...input, exists: branch.exitCode === 0 }, { repoId: input.repoId });
  }

  async listBranches(input: RepoRef): Promise<GitProviderResult<BranchRef[]>> {
    const validation = await this.validateRepo(input);
    if (!validation.ok || !validation.data?.localPath) {
      return result("list_branches", [], { ok: false, blocked: true, reason: validation.reason, repoId: input.repoId });
    }

    const branches = await git(validation.data.localPath, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]);
    if (branches.exitCode !== 0) {
      return result("list_branches", [], { ok: false, reason: "Unable to list local branches.", repoId: input.repoId });
    }

    return result(
      "list_branches",
      branches.stdout
        .split(/\r?\n/)
        .map((branchName) => branchName.trim())
        .filter(Boolean)
        .sort()
        .map((branchName) => ({ repoId: input.repoId, branchName, exists: true })),
      { repoId: input.repoId }
    );
  }

  async createDraftPullRequest(input: CreatePullRequestInput): Promise<PullRequest> {
    const pullRequest: PullRequest = {
      id: createId("pr"),
      taskId: input.taskId,
      repoId: input.repoId,
      provider: "local",
      externalId: `local-${input.branchName}`,
      url: `local://pull-requests/${input.repoId}/${encodeURIComponent(input.branchName)}`,
      status: "draft",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.pullRequests.push(pullRequest);
    return pullRequest;
  }

  async createPullRequest(input: CreatePullRequestRequest): Promise<GitProviderResult<PullRequest>> {
    const pullRequest = await this.createDraftPullRequest(input);
    return result("create_pull_request", pullRequest, {
      repoId: input.repoId,
      taskId: input.taskId,
      taskRunId: input.taskRunId
    });
  }

  async getPullRequest(input: PullRequestRef): Promise<GitProviderResult<PullRequest | undefined>> {
    return result(
      "get_pull_request",
      this.pullRequests.find(
        (candidate) =>
          candidate.repoId === input.repoId &&
          (candidate.id === input.pullRequestId || candidate.externalId === input.externalId || candidate.url === input.url)
      ),
      { repoId: input.repoId }
    );
  }

  async listPullRequests(input: RepoRef): Promise<GitProviderResult<PullRequest[]>> {
    return result(
      "list_pull_requests",
      this.pullRequests.filter((pullRequest) => pullRequest.repoId === input.repoId),
      { repoId: input.repoId }
    );
  }

  async getPullRequestDiff(input: PullRequestRef): Promise<GitProviderResult<string>> {
    return result("get_pull_request_diff", "", {
      repoId: input.repoId,
      reason: "Local provider does not have hosted pull request diffs."
    });
  }

  async getChangedFiles(input: BranchRef & { repoRef?: RepoRef; compareRef?: string }): Promise<GitProviderResult<GitChangedFile[]>> {
    const validation = await this.validateRepo(input.repoRef);
    if (!validation.ok || !validation.data?.localPath) {
      return result("get_changed_files", [], { ok: false, blocked: true, reason: validation.reason, repoId: input.repoId });
    }

    const compareRef = input.compareRef ?? input.baseBranch ?? "main";
    const diff = await git(validation.data.localPath, ["diff", "--name-status", compareRef, input.branchName]);
    if (diff.exitCode !== 0) {
      return result("get_changed_files", [], {
        ok: false,
        reason: "Unable to inspect local changed files.",
        repoId: input.repoId
      });
    }

    return result("get_changed_files", parseChangedFiles(diff.stdout), { repoId: input.repoId });
  }

  async recordMergeSimulationResult(input: DomainMergeSimulationResult): Promise<GitProviderResult<DomainMergeSimulationResult>> {
    return result("record_merge_simulation_result", input, {
      repoId: input.repoId,
      taskRunId: input.taskRunId,
      metadata: { status: input.status }
    });
  }

  async simulateMerge(input: CreateBranchInput): Promise<MergeSimulationResult> {
    return {
      conflict: input.branchName.includes("conflict"),
      reason: input.branchName.includes("conflict") ? "Local branch name requested a mock conflict." : undefined
    };
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

  private async validateRepo(input: RepoRef | undefined): Promise<GitProviderResult<RepoRef>> {
    const localPath = normalizePath(input?.localPath);
    if (!input || !localPath) {
      return result<RepoRef>("get_repository", undefined, {
        ok: false,
        blocked: true,
        reason: "Local Git provider requires repoRef.localPath.",
        repoId: input?.repoId
      });
    }
    if (isUnsafePath(localPath) || !existsSync(localPath)) {
      return result<RepoRef>("get_repository", undefined, {
        ok: false,
        blocked: true,
        reason: "Local repo path is missing or unsafe.",
        repoId: input.repoId
      });
    }

    const inside = await git(localPath, ["rev-parse", "--is-inside-work-tree"]);
    if (inside.exitCode !== 0 || inside.stdout.trim() !== "true") {
      return result<RepoRef>("get_repository", undefined, {
        ok: false,
        blocked: true,
        reason: "Local path is not a git work tree.",
        repoId: input.repoId
      });
    }

    return result("get_repository", { ...input, localPath }, { repoId: input.repoId });
  }
}

export function createMockBranchLease(
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
