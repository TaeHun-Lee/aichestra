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
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject
} from "@aichestra/policy";
import type { PolicyAction, PolicyDecision } from "@aichestra/policy";

export type GitIntegrationServiceInput = {
  store: InMemoryAichestraStore;
  provider: GitProvider;
  config: GitProviderRuntimeConfig;
  actorId?: string;
  policyService?: PolicyService;
};

export type CreateGitBranchInput = {
  branchName: string;
  baseBranch?: string;
  taskId?: string;
  taskRunId?: string;
  branchLeaseId?: string;
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
  private readonly policyService: PolicyService;

  constructor(input: GitIntegrationServiceInput) {
    this.store = input.store;
    this.provider = input.provider;
    this.config = input.config;
    this.actorId = input.actorId ?? "mock-git-actor";
    this.policyService = input.policyService ?? new PolicyService();
  }

  getConfig(): GitProviderConfigView & { localBranchCreateEnabled: boolean } {
    return {
      providerKind: this.provider.getProviderKind(),
      remoteGitEnabled: this.config.remoteGitEnabled,
      remoteBranchCreateEnabled: this.config.remoteBranchCreateEnabled,
      remotePullRequestCreateEnabled: this.config.remotePullRequestCreateEnabled,
      remoteMergeEnabled: false,
      githubConfigured: this.config.githubConfigured,
      githubOwnerConfigured: Boolean(this.config.githubOwner),
      githubRepoConfigured: Boolean(this.config.githubRepo),
      githubAllowedRepoCount: this.githubAllowedRepos().length,
      githubAllowedBranchPrefix: this.githubAllowedBranchPrefix(),
      githubIntegrationTestsEnabled: this.config.githubIntegrationTestsEnabled ?? false,
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
    if (this.provider.getProviderKind() === "github") {
      const repo = this.store.listRepos().find((candidate) => candidate.provider === "github");
      this.recordAudit("remote_git_config_validated", repo?.id ?? "github", {
        providerKind: "github",
        operation: "validate_connection",
        result: this.config.remoteGitEnabled ? "allowed" : "blocked",
        githubConfigured: this.config.githubConfigured,
        githubOwnerConfigured: Boolean(this.config.githubOwner),
        githubRepoConfigured: Boolean(this.config.githubRepo),
        allowedRepoCount: this.githubAllowedRepos().length,
        remoteGitEnabled: this.config.remoteGitEnabled,
        remoteBranchCreateEnabled: this.config.remoteBranchCreateEnabled,
        remotePullRequestCreateEnabled: this.config.remotePullRequestCreateEnabled,
        remoteMergeEnabled: false
      });
    }
    const result = await this.provider.validateConnection();
    this.recordProviderAudit("git_connection_validated", result.auditEvent);
    if (this.provider.getProviderKind() === "github") {
      this.recordProviderAudit(result.ok ? "github_connection_validated" : "github_connection_blocked", result.auditEvent);
    }
    return result;
  }

  async validateGitHubConnection() {
    if (this.provider.getProviderKind() !== "github") {
      const event = this.recordAudit("github_connection_blocked", "github", {
        providerKind: this.provider.getProviderKind(),
        operation: "validate_connection",
        result: "blocked",
        reason: "remote_git_disabled"
      });
      return {
        ok: false,
        reason: "remote_git_disabled",
        auditEvent: event
      };
    }
    return this.validateConnection();
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
    if (this.provider.getProviderKind() === "github") {
      this.recordAudit("github_branch_create_requested", repoId, {
        providerKind: "github",
        repoId,
        repoRef: repoSlug(repo),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchName: input.branchName,
        operation: "create_branch"
      });
    }
    const remotePolicy = this.evaluateRemotePolicy("git.branch.create", repoId, input);
    const remoteGate = this.validateGitHubGate(repo, "branch_create", input.branchName);
    if (remoteGate) {
      this.recordGitHubConfigGate(repo, "create_branch", remoteGate, input);
      if (!remoteGate.ok) {
        this.recordAudit("github_branch_create_blocked", repoId, {
          providerKind: "github",
          repoId,
          repoRef: repoSlug(repo),
          taskId: input.taskId,
          taskRunId: input.taskRunId,
          branchName: input.branchName,
          operation: "create_branch",
          result: "blocked",
          reason: remoteGate.reason,
          policyDecisionId: remotePolicy.id
        });
        return { ok: false, reason: remoteGate.reason };
      }
    }
    if (!remotePolicy.allowed) {
      this.recordAudit("remote_git_operation_blocked", repoId, {
        providerKind: this.provider.getProviderKind(),
        repoId,
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchName: input.branchName,
        reason: remotePolicy.reason,
        policyDecisionId: remotePolicy.id
      });
      if (this.provider.getProviderKind() === "github") {
        this.recordAudit("github_branch_create_blocked", repoId, {
          providerKind: "github",
          repoId,
          repoRef: repoSlug(repo),
          taskId: input.taskId,
          taskRunId: input.taskRunId,
          branchName: input.branchName,
          operation: "create_branch",
          result: "blocked",
          reason: "policy_denied",
          policyDecisionId: remotePolicy.id
        });
        return { ok: false, reason: "policy_denied" };
      }
      return { ok: false, reason: remotePolicy.reason };
    }
    const branchPolicy = this.evaluatePolicy("git.branch.create", "branch", repoId, {
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      branchName: input.branchName,
      providerKind: this.provider.getProviderKind(),
      environment: {
        localFixture: this.provider.getProviderKind() === "local" && Boolean(input.localPath),
        readOnly: this.provider.getProviderKind() === "local",
        remoteGitEnabled: this.config.remoteGitEnabled,
        remoteBranchCreateEnabled: this.config.remoteBranchCreateEnabled,
        repoAllowlisted: this.repoAllowlisted(repo),
        branchPrefixAllowed: this.branchPrefixAllowed(input.branchName),
        credentialsConfigured: this.config.githubConfigured
      }
    });
    if (!branchPolicy.allowed) {
      this.recordAudit(this.provider.getProviderKind() === "github" ? "github_branch_create_blocked" : "branch_create_blocked", repoId, {
        providerKind: this.provider.getProviderKind(),
        repoId,
        repoRef: repoSlug(repo),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchName: input.branchName,
        operation: "create_branch",
        result: "blocked",
        reason: this.provider.getProviderKind() === "github" ? "policy_denied" : branchPolicy.reason,
        policyDecisionId: branchPolicy.id
      });
      return { ok: false, reason: this.provider.getProviderKind() === "github" ? "policy_denied" : branchPolicy.reason };
    }

    try {
      await this.provider.createBranch({
        repoId,
        branchName: input.branchName,
        baseBranch: input.baseBranch ?? repo.defaultBranch,
        repoRef: this.repoRef(repo, input.localPath),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchLeaseId: input.branchLeaseId,
        actorId: this.actorId
      });

      const branch: BranchRef = {
        repoId,
        branchName: input.branchName,
        baseBranch: input.baseBranch ?? repo.defaultBranch,
        exists: true
      };
      const branchLease = input.branchLeaseId
        ? this.store.getBranchLease(input.branchLeaseId)
        : input.taskId && input.taskRunId
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
        repoRef: repoSlug(repo),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchName: input.branchName,
        branchLeaseId: branchLease?.id
      });
      if (this.provider.getProviderKind() === "github") {
        this.recordAudit("github_branch_created", repoId, {
          providerKind: "github",
          repoId,
          repoRef: repoSlug(repo),
          taskId: input.taskId,
          taskRunId: input.taskRunId,
          branchName: input.branchName,
          branchLeaseId: branchLease?.id,
          operation: "create_branch",
          result: "succeeded"
        });
      }

      return { ok: true, branch, branchLease };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "branch_create_failed";
      this.recordAudit(this.provider.getProviderKind() === "github" ? "github_branch_create_blocked" : reason.includes("disabled") ? "branch_create_blocked" : "remote_git_operation_blocked", repoId, {
        providerKind: this.provider.getProviderKind(),
        repoId,
        repoRef: repoSlug(repo),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchName: input.branchName,
        operation: "create_branch",
        result: "blocked",
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
    if (this.provider.getProviderKind() === "github") {
      this.recordAudit("github_pr_create_requested", repoId, {
        providerKind: "github",
        repoId,
        repoRef: repoSlug(repo),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchLeaseId: input.branchLeaseId,
        branchName: input.branchName,
        operation: "create_pull_request"
      });
    }
    const remotePolicy = this.evaluateRemotePolicy("git.pull_request.create", repoId, input);
    const remoteGate = this.validateGitHubGate(repo, "pull_request_create", input.branchName);
    if (remoteGate) {
      this.recordGitHubConfigGate(repo, "create_pull_request", remoteGate, input);
      if (!remoteGate.ok) {
        this.recordAudit("github_pr_create_blocked", repoId, {
          providerKind: "github",
          repoId,
          repoRef: repoSlug(repo),
          taskId: input.taskId,
          taskRunId: input.taskRunId,
          branchLeaseId: input.branchLeaseId,
          branchName: input.branchName,
          operation: "create_pull_request",
          result: "blocked",
          reason: remoteGate.reason,
          policyDecisionId: remotePolicy.id
        });
        return { ok: false, reason: remoteGate.reason };
      }
    }
    if (!remotePolicy.allowed) {
      this.recordAudit("remote_git_operation_blocked", repoId, {
        providerKind: this.provider.getProviderKind(),
        repoId,
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchName: input.branchName,
        reason: remotePolicy.reason,
        policyDecisionId: remotePolicy.id
      });
      if (this.provider.getProviderKind() === "github") {
        this.recordAudit("github_pr_create_blocked", repoId, {
          providerKind: "github",
          repoId,
          repoRef: repoSlug(repo),
          taskId: input.taskId,
          taskRunId: input.taskRunId,
          branchLeaseId: input.branchLeaseId,
          branchName: input.branchName,
          operation: "create_pull_request",
          result: "blocked",
          reason: "policy_denied",
          policyDecisionId: remotePolicy.id
        });
        return { ok: false, reason: "policy_denied" };
      }
      return { ok: false, reason: remotePolicy.reason };
    }
    const pullRequestPolicy = this.evaluatePolicy("git.pull_request.create", "pull_request", repoId, {
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      branchName: input.branchName,
      providerKind: this.provider.getProviderKind(),
      environment: {
        remoteGitEnabled: this.config.remoteGitEnabled,
        remotePullRequestCreateEnabled: this.config.remotePullRequestCreateEnabled,
        repoAllowlisted: this.repoAllowlisted(repo),
        branchPrefixAllowed: this.branchPrefixAllowed(input.branchName),
        credentialsConfigured: this.config.githubConfigured
      }
    });
    if (!pullRequestPolicy.allowed) {
      this.recordAudit(this.provider.getProviderKind() === "github" ? "github_pr_create_blocked" : "pull_request_create_blocked", repoId, {
        providerKind: this.provider.getProviderKind(),
        repoId,
        repoRef: repoSlug(repo),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchName: input.branchName,
        operation: "create_pull_request",
        result: "blocked",
        reason: this.provider.getProviderKind() === "github" ? "policy_denied" : pullRequestPolicy.reason,
        policyDecisionId: pullRequestPolicy.id
      });
      return { ok: false, reason: this.provider.getProviderKind() === "github" ? "policy_denied" : pullRequestPolicy.reason };
    }

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
    if (this.provider.getProviderKind() === "github") {
      this.recordProviderAudit(result.ok ? "github_pr_created" : "github_pr_create_blocked", result.auditEvent);
    }

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

  async getPullRequestChangedFiles(repoId: string, input: { pullRequestNumber: number; taskId?: string; taskRunId?: string }): Promise<GitChangedFilesResult> {
    const repo = this.store.getRepo(repoId);
    if (!repo) return { ok: false, changedFiles: [], reason: `Repo not found: ${repoId}` };

    this.recordAudit("github_changed_files_requested", repoId, {
      providerKind: this.provider.getProviderKind(),
      repoId,
      repoRef: repoSlug(repo),
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      pullRequestNumber: input.pullRequestNumber,
      operation: "get_changed_files"
    });

    const remoteGate = this.validateGitHubGate(repo, "changed_files");
    if (remoteGate) {
      this.recordGitHubConfigGate(repo, "get_changed_files", remoteGate, input);
      if (!remoteGate.ok) {
        this.recordAudit("github_changed_files_blocked", repoId, {
          providerKind: "github",
          repoId,
          repoRef: repoSlug(repo),
          taskId: input.taskId,
          taskRunId: input.taskRunId,
          pullRequestNumber: input.pullRequestNumber,
          operation: "get_changed_files",
          result: "blocked",
          reason: remoteGate.reason
        });
        return { ok: false, changedFiles: [], reason: remoteGate.reason };
      }
    } else {
      this.recordAudit("github_changed_files_blocked", repoId, {
        providerKind: this.provider.getProviderKind(),
        repoId,
        repoRef: repoSlug(repo),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        pullRequestNumber: input.pullRequestNumber,
        operation: "get_changed_files",
        result: "blocked",
        reason: "remote_git_disabled"
      });
      return { ok: false, changedFiles: [], reason: "remote_git_disabled" };
    }

    const remotePolicy = this.evaluatePolicy("git.remote_operation", "git_operation", repoId, {
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      providerKind: this.provider.getProviderKind(),
      environment: {
        remoteGitEnabled: this.config.remoteGitEnabled,
        remoteOperationAllowed: true,
        repoAllowlisted: this.repoAllowlisted(repo),
        credentialsConfigured: this.config.githubConfigured
      },
      metadata: {
        requestedAction: "git.changed_files.read"
      }
    });
    if (!remotePolicy.allowed) {
      this.recordAudit("github_changed_files_blocked", repoId, {
        providerKind: "github",
        repoId,
        repoRef: repoSlug(repo),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        pullRequestNumber: input.pullRequestNumber,
        operation: "get_changed_files",
        result: "blocked",
        reason: "policy_denied",
        policyDecisionId: remotePolicy.id
      });
      return { ok: false, changedFiles: [], reason: "policy_denied" };
    }

    const result = await this.provider.getChangedFiles({
      repoId,
      branchName: `pr-${input.pullRequestNumber}`,
      baseBranch: repo.defaultBranch,
      pullRequestNumber: input.pullRequestNumber,
      repoRef: this.repoRef(repo)
    });
    this.recordProviderAudit(result.ok ? "github_changed_files_read" : "github_changed_files_blocked", result.auditEvent);
    return {
      ok: result.ok,
      changedFiles: result.data ?? [],
      reason: result.reason
    };
  }

  async createRemoteBranch(repoId: string, input: CreateGitBranchInput): Promise<GitBranchOperationResult> {
    const repo = this.store.getRepo(repoId);
    if (!repo) return { ok: false, reason: `Repo not found: ${repoId}` };
    if (this.provider.getProviderKind() !== "github") {
      this.recordAudit("github_branch_create_blocked", repoId, {
        providerKind: this.provider.getProviderKind(),
        repoId,
        repoRef: repoSlug(repo),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchName: input.branchName,
        operation: "create_branch",
        result: "blocked",
        reason: "remote_git_disabled"
      });
      return { ok: false, reason: "remote_git_disabled" };
    }
    return this.createBranch(repoId, input);
  }

  async createRemotePullRequest(repoId: string, input: CreateGitPullRequestInput): Promise<GitPullRequestOperationResult> {
    const repo = this.store.getRepo(repoId);
    if (!repo) return { ok: false, reason: `Repo not found: ${repoId}` };
    if (this.provider.getProviderKind() !== "github") {
      this.recordAudit("github_pr_create_blocked", repoId, {
        providerKind: this.provider.getProviderKind(),
        repoId,
        repoRef: repoSlug(repo),
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        branchName: input.branchName,
        operation: "create_pull_request",
        result: "blocked",
        reason: "remote_git_disabled"
      });
      return { ok: false, reason: "remote_git_disabled" };
    }
    return this.createPullRequest(repoId, input);
  }

  blockUnsupportedRemoteOperation(operation: "merge" | "rebase", input: { repoId?: string; taskId?: string; taskRunId?: string; branchName?: string } = {}) {
    const action = operation === "merge" ? "git.merge" : "git.rebase";
    const policy = this.evaluatePolicy(action, "git_operation", input.repoId ?? "github", {
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      branchName: input.branchName,
      providerKind: this.provider.getProviderKind(),
      environment: {
        remoteGitEnabled: this.config.remoteGitEnabled,
        remoteMergeEnabled: false
      }
    });
    const reason = operation === "merge" ? "remote_merge_unsupported" : "remote_rebase_unsupported";
    this.recordAudit(operation === "merge" ? "github_merge_attempt_blocked" : "github_rebase_attempt_blocked", input.repoId ?? "github", {
      providerKind: this.provider.getProviderKind(),
      repoId: input.repoId,
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      branchName: input.branchName,
      operation,
      result: "blocked",
      reason,
      policyDecisionId: policy.id
    });
    return { ok: false, reason, policyDecisionId: policy.id };
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

  private recordAudit(action: string, targetId: string, metadata: Record<string, unknown>): AuditLog {
    return this.store.recordAudit({
      action: `git.${action}`,
      targetType: "git",
      targetId,
      actorUserId: this.actorId,
      taskId: typeof metadata.taskId === "string" ? metadata.taskId : undefined,
      repoId: typeof metadata.repoId === "string" ? metadata.repoId : undefined,
      metadata: sanitizeMetadata(metadata)
    });
  }

  private evaluateRemotePolicy(action: PolicyAction, repoId: string, input: { taskId?: string; taskRunId?: string; branchName?: string }): PolicyDecision {
    if (this.provider.getProviderKind() !== "github" && !this.config.remoteGitEnabled) {
      return {
        id: "policy_skip_local_git",
        allowed: true,
        decision: "allow",
        reason: "local_or_mock_git_operation",
        matchedRuleIds: [],
        subject: createPolicySubject({ actorId: this.actorId, actorKind: "service", roles: ["system"] }),
        resource: createPolicyResource({ resourceKind: "git_operation", resourceId: repoId }),
        action,
        context: createPolicyContext({ taskId: input.taskId, taskRunId: input.taskRunId, repoId, branchName: input.branchName }),
        createdAt: new Date()
      };
    }
    return this.evaluatePolicy("git.remote_operation", "git_operation", repoId, {
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      branchName: input.branchName,
      providerKind: this.provider.getProviderKind(),
      environment: {
        remoteGitEnabled: this.config.remoteGitEnabled,
        remoteOperationAllowed: this.remoteOperationAllowed(action),
        remoteBranchCreateEnabled: this.config.remoteBranchCreateEnabled,
        remotePullRequestCreateEnabled: this.config.remotePullRequestCreateEnabled,
        repoAllowlisted: this.repoAllowlisted(this.store.getRepo(repoId)),
        branchPrefixAllowed: input.branchName ? this.branchPrefixAllowed(input.branchName) : true,
        credentialsConfigured: this.config.githubConfigured
      },
      metadata: { requestedAction: action }
    });
  }

  private remoteOperationAllowed(action: PolicyAction): boolean {
    if (action === "git.branch.create") return this.config.remoteBranchCreateEnabled;
    if (action === "git.pull_request.create") return this.config.remotePullRequestCreateEnabled;
    return false;
  }

  private validateGitHubGate(repo: Repo, operation: "branch_create" | "pull_request_create" | "changed_files", branchName?: string): { ok: true } | { ok: false; reason: string } | undefined {
    if (this.provider.getProviderKind() !== "github") return undefined;
    if (!this.config.remoteGitEnabled) return { ok: false, reason: "remote_git_disabled" };
    if (operation === "branch_create" && !this.config.remoteBranchCreateEnabled) return { ok: false, reason: "remote_branch_create_disabled" };
    if (operation === "pull_request_create" && !this.config.remotePullRequestCreateEnabled) return { ok: false, reason: "remote_pr_create_disabled" };
    if (!this.config.githubConfigured) return { ok: false, reason: "github_credentials_missing" };
    if (!this.repoAllowlisted(repo)) return { ok: false, reason: "repo_not_allowlisted" };
    if (branchName && !this.branchPrefixAllowed(branchName)) return { ok: false, reason: "branch_prefix_not_allowed" };
    return { ok: true };
  }

  private recordGitHubConfigGate(
    repo: Repo,
    operation: string,
    gate: { ok: true } | { ok: false; reason: string },
    input: { taskId?: string; taskRunId?: string; branchName?: string; pullRequestNumber?: number }
  ): void {
    this.recordAudit("remote_git_config_validated", repo.id, {
      providerKind: "github",
      repoId: repo.id,
      repoRef: repoSlug(repo),
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      branchName: input.branchName,
      pullRequestNumber: input.pullRequestNumber,
      operation,
      result: gate.ok ? "allowed" : "blocked",
      reason: gate.ok ? undefined : gate.reason,
      remoteGitEnabled: this.config.remoteGitEnabled,
      remoteBranchCreateEnabled: this.config.remoteBranchCreateEnabled,
      remotePullRequestCreateEnabled: this.config.remotePullRequestCreateEnabled,
      remoteMergeEnabled: false,
      githubConfigured: this.config.githubConfigured,
      allowedRepoCount: this.githubAllowedRepos().length,
      allowedBranchPrefix: this.githubAllowedBranchPrefix()
    });
  }

  private repoAllowlisted(repo: Repo | undefined): boolean {
    if (!repo) return false;
    return this.githubAllowedRepos().includes(repoSlug(repo));
  }

  private branchPrefixAllowed(branchName: string): boolean {
    return branchName.startsWith(this.githubAllowedBranchPrefix());
  }

  private githubAllowedRepos(): string[] {
    return (this.config.githubAllowedRepos ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean);
  }

  private githubAllowedBranchPrefix(): string {
    return this.config.githubAllowedBranchPrefix ?? "ai/";
  }

  private evaluatePolicy(action: PolicyAction, resourceKind: "branch" | "pull_request" | "git_operation", resourceId: string, input: {
    taskId?: string;
    taskRunId?: string;
    branchName?: string;
    providerKind?: string;
    environment?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): PolicyDecision {
    return this.policyService.evaluate({
      subject: createPolicySubject({ actorId: this.actorId, actorKind: "service", roles: ["system"] }),
      action,
      resource: createPolicyResource({
        resourceKind,
        resourceId,
        metadata: {
          providerKind: input.providerKind ?? this.provider.getProviderKind(),
          ...input.metadata
        }
      }),
      context: createPolicyContext({
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        repoId: resourceId,
        branchName: input.branchName,
        providerKind: input.providerKind ?? this.provider.getProviderKind(),
        environment: input.environment ?? {},
        metadata: input.metadata ?? {}
      })
    });
  }
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(metadata) as Record<string, unknown>;
}

function sanitizeValue(value: unknown, key = ""): unknown {
  if (/token|secret|credential|authorization|api[_-]?key/i.test(key)) {
    return "[redacted]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, entryKey)
    ]));
  }
  if (typeof value === "string") {
    return value
      .replace(/ghp_[A-Za-z0-9_]+/g, "[redacted]")
      .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]");
  }
  return value;
}

function repoSlug(repo: Repo): string {
  return `${repo.owner}/${repo.name}`.toLowerCase();
}
