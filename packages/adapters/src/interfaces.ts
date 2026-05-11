import type {
  AgentKind,
  BranchLease,
  ConflictRiskLevel,
  InstructionSet,
  MergeSimulationResult as DomainMergeSimulationResult,
  PullRequest,
  RepoProvider,
  UsageEvent
} from "@aichestra/core";

export type LlmCallInput = {
  taskId: string;
  taskRunId: string;
  userId: string;
  repoId: string;
  branch: string;
  agent: AgentKind;
  model: string;
  prompt: string;
  skillVersions: string[];
  harnessVersion: string;
  instructionSetHash: string;
};

export type LlmCallResult = {
  text: string;
  usage: Omit<UsageEvent, "id" | "createdAt">;
};

export type LlmGateway = {
  complete(input: LlmCallInput): Promise<LlmCallResult>;
};

export type CreateBranchInput = {
  repoId: string;
  branchName: string;
  baseBranch: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  repoRef?: RepoRef;
};

export type CreatePullRequestInput = {
  taskId: string;
  repoId: string;
  provider: RepoProvider;
  branchName: string;
  baseBranch: string;
  title: string;
};

export type MergeSimulationResult = {
  conflict: boolean;
  reason?: string;
};

export type ConflictRiskInput = {
  currentLease: BranchLease;
  activeLeases: BranchLease[];
};

export type ConflictRiskResult = {
  score: number;
  riskLevel: ConflictRiskLevel;
  reasons: string[];
};

export type GitProviderKind = "mock" | "local" | "github";

export type GitProviderOperation =
  | "validate_connection"
  | "get_repository"
  | "create_branch"
  | "get_branch"
  | "list_branches"
  | "create_pull_request"
  | "get_pull_request"
  | "list_pull_requests"
  | "get_pull_request_diff"
  | "get_changed_files"
  | "record_merge_simulation_result";

export type RepoRef = {
  repoId: string;
  provider: RepoProvider | GitProviderKind;
  owner?: string;
  name?: string;
  defaultBranch?: string;
  localPath?: string;
};

export type BranchRef = {
  repoId: string;
  branchName: string;
  baseBranch?: string;
  exists?: boolean;
};

export type PullRequestRef = {
  repoId: string;
  pullRequestId?: string;
  externalId?: string;
  url?: string;
};

export type CreateBranchRequest = CreateBranchInput;

export type CreatePullRequestRequest = CreatePullRequestInput & {
  taskRunId?: string;
  branchLeaseId?: string;
  actorId?: string;
  repoRef?: RepoRef;
  body?: string;
};

export type GitChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "unknown";
  previousPath?: string;
};

export type GitProviderAuditEvent = {
  providerKind: GitProviderKind;
  operation: GitProviderOperation;
  result: "allowed" | "blocked" | "succeeded" | "failed";
  repoId?: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

export type GitProviderResult<T> = {
  ok: boolean;
  providerKind: GitProviderKind;
  operation: GitProviderOperation;
  data?: T;
  blocked?: boolean;
  reason?: string;
  auditEvent: GitProviderAuditEvent;
};

export type GitConnectionValidation = {
  providerKind: GitProviderKind;
  remote: boolean;
  configured: boolean;
  message: string;
};

export type GitProviderConfigView = {
  providerKind: GitProviderKind;
  remoteGitEnabled: boolean;
  remoteBranchCreateEnabled: boolean;
  remotePullRequestCreateEnabled: boolean;
  remoteMergeEnabled: false;
  githubConfigured: boolean;
};

export type GitProvider = {
  getProviderKind(): GitProviderKind;
  validateConnection(): Promise<GitProviderResult<GitConnectionValidation>>;
  getRepository(input: RepoRef): Promise<GitProviderResult<RepoRef>>;
  createBranch(input: CreateBranchInput): Promise<{ branchName: string }>;
  getBranch(input: BranchRef & { repoRef?: RepoRef }): Promise<GitProviderResult<BranchRef>>;
  listBranches(input: RepoRef): Promise<GitProviderResult<BranchRef[]>>;
  createDraftPullRequest(input: CreatePullRequestInput): Promise<PullRequest>;
  createPullRequest(input: CreatePullRequestRequest): Promise<GitProviderResult<PullRequest>>;
  getPullRequest(input: PullRequestRef): Promise<GitProviderResult<PullRequest | undefined>>;
  listPullRequests(input: RepoRef): Promise<GitProviderResult<PullRequest[]>>;
  getPullRequestDiff(input: PullRequestRef): Promise<GitProviderResult<string>>;
  getChangedFiles(input: BranchRef & { repoRef?: RepoRef; compareRef?: string }): Promise<GitProviderResult<GitChangedFile[]>>;
  recordMergeSimulationResult(input: DomainMergeSimulationResult): Promise<GitProviderResult<DomainMergeSimulationResult>>;
  simulateMerge(input: CreateBranchInput): Promise<MergeSimulationResult>;
  computeConflictRisk(input: ConflictRiskInput): ConflictRiskResult;
  close?(): Promise<void>;
};

export type PolicyDecision = {
  allowed: boolean;
  reason?: string;
  reviewRequired?: boolean;
};

export type PolicyEngine = {
  evaluateTask(input: { taskId: string; files: string[]; budgetLimitUsd?: number }): PolicyDecision;
};

export type McpGateway = {
  callTool(input: { toolName: string; arguments: Record<string, unknown>; taskId?: string }): Promise<{ result: Record<string, unknown> }>;
};

export type SecretsBroker = {
  getVirtualToken(scope: string): Promise<{ token: string; expiresAt: Date }>;
};
