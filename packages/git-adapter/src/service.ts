import type {
  AuditLog,
  BranchLease,
  MergeQueueEntry,
  MergeSimulationResult,
  PullRequest,
  Repo
} from "@aichestra/core";
import type { InMemoryAichestraStore } from "@aichestra/db";
import type {
  BranchRef,
  CreatePullRequestRequest,
  GitChangedFile,
  GitProvider,
  GitProviderAuditEvent,
  GitProviderConfigView,
  GitProviderRuntimeConfig,
  RepoRef
} from "@aichestra/adapters";

export type GitIntegrationServiceInput = {
  store: InMemoryAichestraStore;
  provider: GitProvider;
  config: GitProviderRuntimeConfig;
  actorId?: string;
};

export type CreateGitBranchInput = {
  branchName: string;
  baseBranch?: string;
  taskId?: string;
  taskRunId?: string;
  files?: string[];
  symbols?: string[];
  tests?: string[];
  localPath?: string;
};

export type CreateGitPullRequestInput = {
  taskId: string;
  taskRunId?: string;
  branchLeaseId?: string;
  branchName: string;
  baseBranch?: string;
  title: string;
  body?: string;
  localPath?: string;
};

export type GitBranchOperationResult = {
  ok: boolean;
  branch?: BranchRef;
  branchLease?: BranchLease;
  reason?: string;
};

export type GitPullRequestOperationResult = {
  ok: boolean;
  pullRequest?: PullRequest;
  mergeQueueEntry?: MergeQueueEntry;
  reason?: string;
};

export type GitChangedFilesResult = {
  ok: boolean;
  changedFiles: GitChangedFile[];
  reason?: string;
};

export class GitIntegrationService {
  private readonly store: InMemoryAichestraStore;
  private readonly provider: GitProvider;
  private readonly config: GitProviderRuntimeConfig;
  private readonly actorId: string;

  constructor(input: GitIntegrationServiceInput) {
    this.store = input.store;
    this.provider = input.provider;
    this.config = input.config;
    this.actorId = input.actorId ?? "mock-git-actor";
  }

  getConfig(): GitProviderConfigView & { localBranchCreateEnabled: boolean } {
    return {
      providerKind: this.provider.getProviderKind(),
      remoteGitEnabled: this.config.remoteGitEnabled,
      remoteBranchCreateEnabled: this.config.remoteBranchCreateEnabled,
      remotePullRequestCreateEnabled: this.config.remotePullRequestCreateEnabled,
      remoteMergeEnabled: false,
      githubConfigured: this.config.githubConfigured,
      localBranchCreateEnabled: this.config.localBranchCreateEnabled
    };
  }

  listProviders(): Array<{ providerKind: string; default: boolean; remote: boolean; enabled: boolean }> {
    return [
      { providerKind: "mock", default: this.provider.getProviderKind() === "mock", remote: false, enabled: true },
      { providerKind: "local", default: this.provider.getProviderKind() === "local", remote: false, enabled: this.provider.getProviderKind() === "local" },
      { providerKind: "github", default: this.provider.getProviderKind() === "github", remote: true, enabled: this.config.remoteGitEnabled }
    ];
  }

  async validateConnection() {
    const result = await this.provider.validateConnection();
    this.recordProviderAudit("git_connection_validated", result.auditEvent);
    return result;
  }

  createRepo(input: unknown): Repo {
    const repo = this.store.createRepo(input);
    this.recordAudit("git_repo_created", repo.id, {
      providerKind: this.provider.getProviderKind(),
      repoId: repo.id,
      provider: repo.provider,
      owner: repo.owner,
      name: repo.name
    });
    return repo;
  }

  listRepos(): Repo[] {
    return this.store.listRepos();
  }

  getRepo(id: string): Repo | undefined {
    return this.store.getRepo(id);
  }

  async createBranch(repoId: string, input: CreateGitBranchInput): Promise<GitBranchOperationResult> {
    const repo = this.store.getRepo(repoId);
    if (!repo) {
      return { ok: false, reason: `Repo not found: ${repoId}` };
    }

    this.recordAudit("branch_create_requested", repoId, {
      providerKind: this.provider.getProviderKind(),
      repoId,
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      branchName: input.branchName
    });

    try {
      await this.provider.createBranch({
        repoId,
        branchName: input.branchName,
        baseBranch: input.baseBranch ?? repo.defaultBranch,
        repoRef: this.repoRef(repo, input.localPath),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        actorId: this.actorId
      });

      const branch: BranchRef = {
        repoId,
        branchName: input.branchName,
        baseBranch: input.baseBranch ?? repo.defaultBranch,
        exists: true
      };
      const branchLease = input.taskId && input.taskRunId
        ? this.store.createBranchLease({
          taskId: input.taskId,
          taskRunId: input.taskRunId,
          repoId,
          branchId: `branch_${input.taskRunId}`,
          branchName: input.branchName,
          baseBranch: input.baseBranch ?? repo.defaultBranch,
          files: input.files ?? [],
          symbols: input.symbols ?? [],
          tests: input.tests ?? [],
          status: "active"
        })
        : undefined;

      this.recordAudit("branch_created", repoId, {
        providerKind: this.provider.getProviderKind(),
        repoId,
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchName: input.branchName,
        branchLeaseId: branchLease?.id
      });

      return { ok: true, branch, branchLease };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "branch_create_failed";
      this.recordAudit(reason.includes("disabled") ? "branch_create_blocked" : "remote_git_operation_blocked", repoId, {
        providerKind: this.provider.getProviderKind(),
        repoId,
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchName: input.branchName,
        reason
      });
      return { ok: false, reason };
    }
  }

  async listBranches(repoId: string, localPath?: string): Promise<BranchRef[]> {
    const repo = this.store.getRepo(repoId);
    if (!repo) return [];
    const result = await this.provider.listBranches(this.repoRef(repo, localPath));
    this.recordProviderAudit("changed_files_read", result.auditEvent);
    return result.data ?? [];
  }

  async createPullRequest(repoId: string, input: CreateGitPullRequestInput): Promise<GitPullRequestOperationResult> {
    const repo = this.store.getRepo(repoId);
    if (!repo) {
      return { ok: false, reason: `Repo not found: ${repoId}` };
    }

    this.recordAudit("pull_request_create_requested", repoId, {
      providerKind: this.provider.getProviderKind(),
      repoId,
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      branchLeaseId: input.branchLeaseId,
      branchName: input.branchName
    });

    const request: CreatePullRequestRequest = {
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      branchLeaseId: input.branchLeaseId,
      repoId,
      provider: repo.provider,
      branchName: input.branchName,
      baseBranch: input.baseBranch ?? repo.defaultBranch,
      title: input.title,
      body: input.body,
      actorId: this.actorId,
      repoRef: this.repoRef(repo, input.localPath)
    };
    const result = await this.provider.createPullRequest(request);
    this.recordProviderAudit(result.ok ? "pull_request_created" : "pull_request_create_blocked", result.auditEvent);

    if (!result.ok || !result.data) {
      return { ok: false, reason: result.reason };
    }

    const saved = this.store.createPullRequest({
      taskId: result.data.taskId,
      repoId: result.data.repoId,
      provider: result.data.provider,
      externalId: result.data.externalId,
      url: result.data.url,
      status: result.data.status
    });
    let mergeQueueEntry: MergeQueueEntry | undefined;
    if (input.taskRunId && input.branchLeaseId) {
      const queueFields = this.store.mergeQueueFieldsForLease(input.branchLeaseId);
      mergeQueueEntry = this.store.createMergeQueueEntry({
        repoId,
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchLeaseId: input.branchLeaseId,
        pullRequestId: saved.id,
        pullRequestUrl: saved.url ?? "",
        branchName: input.branchName,
        priority: 100,
        riskScore: queueFields.riskScore,
        conflictRiskScore: queueFields.conflictRiskScore,
        reasons: queueFields.reasons,
        blockingReasons: queueFields.blockingReasons,
        recommendation: queueFields.recommendation,
        simulationStatus: queueFields.simulationStatus,
        lastSimulationAt: queueFields.lastSimulationAt
      });
    }

    return { ok: true, pullRequest: saved, mergeQueueEntry };
  }

  listPullRequests(repoId?: string): PullRequest[] {
    return this.store.listPullRequests().filter((pullRequest) => repoId === undefined || pullRequest.repoId === repoId);
  }

  getPullRequest(id: string): PullRequest | undefined {
    return this.store.listPullRequests().find((pullRequest) => pullRequest.id === id || pullRequest.externalId === id);
  }

  async getChangedFiles(repoId: string, input: { branchName: string; baseBranch?: string; localPath?: string }): Promise<GitChangedFilesResult> {
    const repo = this.store.getRepo(repoId);
    if (!repo) return { ok: false, changedFiles: [], reason: `Repo not found: ${repoId}` };

    const result = await this.provider.getChangedFiles({
      repoId,
      branchName: input.branchName,
      baseBranch: input.baseBranch ?? repo.defaultBranch,
      repoRef: this.repoRef(repo, input.localPath)
    });
    this.recordProviderAudit("changed_files_read", result.auditEvent);
    return {
      ok: result.ok,
      changedFiles: result.data ?? [],
      reason: result.reason
    };
  }

  async recordMergeSimulationResult(input: MergeSimulationResult): Promise<MergeSimulationResult> {
    const result = await this.provider.recordMergeSimulationResult(input);
    this.store.recordMergeSimulation(input);
    this.recordProviderAudit("merge_simulation_recorded", result.auditEvent);
    return input;
  }

  listGitAuditEvents(): AuditLog[] {
    return this.store.listAuditLogs().filter((event) => event.action.startsWith("git."));
  }

  private repoRef(repo: Repo, localPath?: string): RepoRef {
    return {
      repoId: repo.id,
      provider: repo.provider,
      owner: repo.owner,
      name: repo.name,
      defaultBranch: repo.defaultBranch,
      localPath
    };
  }

  private recordProviderAudit(action: string, event: GitProviderAuditEvent): void {
    this.recordAudit(action, event.repoId ?? "git", {
      providerKind: event.providerKind,
      operation: event.operation,
      result: event.result,
      taskId: event.taskId,
      taskRunId: event.taskRunId,
      actorId: event.actorId,
      ...event.metadata
    });
  }

  private recordAudit(action: string, targetId: string, metadata: Record<string, unknown>): void {
    this.store.recordAudit({
      action: `git.${action}`,
      targetType: "git",
      targetId,
      actorUserId: this.actorId,
      taskId: typeof metadata.taskId === "string" ? metadata.taskId : undefined,
      repoId: typeof metadata.repoId === "string" ? metadata.repoId : undefined,
      metadata: sanitizeMetadata(metadata)
    });
  }
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(metadata);
  for (const key of Object.keys(clone)) {
    if (key.toLowerCase().includes("token") || key.toLowerCase().includes("secret")) {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}
