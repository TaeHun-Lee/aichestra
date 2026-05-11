import type { TaskRunStatus, TaskStatus } from "./status.ts";

export type AgentKind = "codex" | "claude-code" | "aider" | "copilot" | "cursor" | "custom";

export type ProviderKind = "openai" | "anthropic" | "google" | "aws_bedrock" | "azure_openai" | "local";
export type ModelProvider = ProviderKind | "mock";
export type RepoProvider = "github" | "gitlab" | "bitbucket" | "local" | "mock";
export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";
export type EvalStatus = "not_required" | "pending" | "passed" | "failed";
export type RegistryStatus = "draft" | "active" | "deprecated" | "archived";
export type RegistryKind = "skill" | "harness" | "instruction";
export type RegistryPackageKind = RegistryKind | "bundle";
export type RegistryAuditAction =
  | "create"
  | "update"
  | "status_change"
  | "approve"
  | "reject"
  | "mark_eval_passed"
  | "mark_eval_failed"
  | "archive"
  | "restore"
  | "checksum_verified"
  | "checksum_failed"
  | "rollback"
  | "attach_eval_result";
export type ChecksumAlgorithm = "sha256";
export type ChecksumStatus = "unverified" | "verified" | "mismatch" | "unavailable";
export type RegistryEvalResultStatus = "passed" | "failed" | "pending" | "skipped";
export type RegistryEvalResultType = "local" | "manual" | "mock";
export type RegistryEvalResultSource = "local_fixture" | "manual" | "mock";
export type RegistryRole = "registry_viewer" | "registry_editor" | "registry_reviewer" | "registry_admin" | "system";
export type RegistryPermission =
  | "registry.read"
  | "registry.create"
  | "registry.update"
  | "registry.status.change"
  | "registry.approval.change"
  | "registry.eval.change"
  | "registry.checksum.verify"
  | "registry.rollback"
  | "registry.audit.read"
  | "registry.history.read";
export type RiskLevel = "low" | "medium" | "high";
export type BranchLeaseStatus = "active" | "released" | "expired";
export type ConflictRiskLevel = "none" | "low" | "medium" | "high" | "critical";
export type ConflictRecommendation = "safe" | "monitor" | "serialize" | "block" | "human_review";
export type MergeQueueStatus = "queued" | "ready" | "blocked" | "merged" | "cancelled";
export type MergeSimulationStatus = "clean" | "text_conflict" | "failed" | "unavailable";
export type MergeSimulationMode = "mock" | "local_git_merge_tree";
export type MergeQueueRecommendation =
  | "ready_for_review"
  | "safe_to_queue"
  | "requires_rebase"
  | "conflict_detected"
  | "manual_review_required"
  | "simulation_unavailable";
export type HarnessRuntimeType = "docker" | "kubernetes" | "firecracker" | "local";
export type NetworkPolicyMode = "disabled" | "allowlist" | "unrestricted";
export type InstructionArtifactType =
  | "agents_md"
  | "claude_md"
  | "agent_md"
  | "cursor_rules"
  | "org_policy"
  | "team_policy"
  | "repo_policy"
  | "directory_policy"
  | "user_preference"
  | "custom";
export type InstructionArtifactScope = "org" | "team" | "repo" | "directory" | "user" | "task";

export type RegistryVersionRef = {
  kind: RegistryKind;
  name: string;
  version: string;
  versionRange?: string;
  id?: string;
  checksum?: string;
};

export type RegistryDependency = {
  kind: RegistryKind;
  name: string;
  versionRange: string;
  required: boolean;
  reason?: string;
};

export type RegistryResolution = {
  selectedSkills: RegistryVersionRef[];
  selectedHarness: RegistryVersionRef;
  selectedInstructions: RegistryVersionRef[];
  warnings: string[];
  errors: string[];
  resolvedAt: Date;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  requesterUserId: string;
  repoId: string;
  baseBranch: string;
  branchName?: string;
  selectedAgent?: AgentKind;
  selectedModel?: string;
  selectedSkillIds: string[];
  selectedHarnessId?: string;
  instructionSetId?: string;
  budgetLimitUsd?: number;
  conflictRiskScore?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TaskRun = {
  id: string;
  taskId: string;
  attempt: number;
  status: TaskRunStatus;
  agent: AgentKind;
  model: string;
  modelProvider?: ModelProvider;
  selectedSkillId?: string;
  skillVersion?: string;
  selectedHarnessId?: string;
  harnessVersion?: string;
  selectedSkillRefs?: RegistryVersionRef[];
  selectedHarnessRef?: RegistryVersionRef;
  selectedInstructionRefs?: RegistryVersionRef[];
  registryResolutionWarnings?: string[];
  registryResolutionErrors?: string[];
  instructionSetId?: string;
  startedAt?: Date;
  finishedAt?: Date;
  resultSummary?: string;
  changedFiles?: string[];
  diffSummary?: string;
  pullRequestUrl?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ModelSelection = {
  provider: ModelProvider;
  model: string;
  reason: string;
};

export type Branch = {
  repoId: string;
  branchName: string;
  baseBranch: string;
};

export type ConflictRisk = {
  id: string;
  repoId: string;
  sourceLeaseId: string;
  targetLeaseId: string;
  sourceTaskRunId: string;
  targetTaskRunId: string;
  overlapFiles: string[];
  riskScore: number;
  riskLevel: ConflictRiskLevel;
  reasons: string[];
  recommendation: ConflictRecommendation;
  simulationStatus?: MergeSimulationStatus;
  simulationRiskContribution?: number;
  simulationSummary?: string;
  computedAt: Date;
};

export type PolicyDecision = {
  allowed: boolean;
  reason?: string;
  reviewRequired?: boolean;
};

export type ProviderAccount = {
  id: string;
  ownerType: "user" | "team" | "organization";
  ownerId: string;
  provider: ProviderKind;
  authMode: "org_api_key" | "user_byok" | "delegated_oauth" | "local_session";
  displayName: string;
  status: "active" | "disabled" | "expired";
};

export type VirtualKey = {
  id: string;
  providerAccountId: string;
  ownerUserId?: string;
  ownerTeamId?: string;
  allowedModels: string[];
  monthlyBudgetUsd?: number;
  perTaskBudgetUsd?: number;
  rpmLimit?: number;
  tpmLimit?: number;
  status: "active" | "revoked";
};

export type Repo = {
  id: string;
  provider: RepoProvider;
  owner: string;
  name: string;
  defaultBranch: string;
  remoteUrl?: string;
  status: "active" | "disabled";
  createdAt: Date;
  updatedAt: Date;
};

export type BranchLease = {
  id: string;
  taskId: string;
  taskRunId: string;
  repoId: string;
  branchId: string;
  branchName: string;
  baseBranch: string;
  files: string[];
  symbols: string[];
  tests: string[];
  status: BranchLeaseStatus;
  expiresAt?: Date;
  releasedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type PullRequest = {
  id: string;
  taskId: string;
  repoId: string;
  provider: RepoProvider;
  externalId?: string;
  url?: string;
  status: "draft" | "open" | "merged" | "closed";
  createdAt: Date;
  updatedAt: Date;
};

export type MergeQueueEntry = {
  id: string;
  repoId: string;
  taskId: string;
  taskRunId: string;
  branchLeaseId: string;
  pullRequestId: string;
  pullRequestUrl: string;
  branchName: string;
  priority: number;
  riskScore: number;
  conflictRiskScore: number;
  status: MergeQueueStatus;
  reasons: string[];
  blockingReasons: string[];
  recommendation: MergeQueueRecommendation;
  simulationStatus?: MergeSimulationStatus;
  lastSimulationAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  mergedAt?: Date;
  cancelledAt?: Date;
};

export type MergeSimulationResult = {
  id: string;
  repoId: string;
  repoPath?: string;
  baseRef: string;
  sourceRef: string;
  targetRef?: string;
  taskRunId?: string;
  branchLeaseId?: string;
  mode: MergeSimulationMode;
  status: MergeSimulationStatus;
  conflictingFiles: string[];
  changedFiles: string[];
  summary: string;
  rawCommandMetadata?: {
    command: string;
    exitCode?: number;
    stdout?: string;
    stderr?: string;
  };
  riskContribution: number;
  createdAt: Date;
};

export type SkillPackage = {
  id: string;
  name: string;
  version: string;
  description: string;
  status: RegistryStatus;
  approvalStatus: ApprovalStatus;
  evalStatus: EvalStatus;
  owner: string;
  compatibleAgents: AgentKind[];
  compatibleModels?: string[];
  requiredTools: string[];
  requiredHarnesses: string[];
  invocationRules: string[];
  instructionRef?: RegistryVersionRef;
  instructionBody?: string;
  evalRefs: string[];
  dependencies?: RegistryDependency[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type HarnessDefinition = {
  id: string;
  name: string;
  version: string;
  description: string;
  status: RegistryStatus;
  approvalStatus: ApprovalStatus;
  evalStatus: EvalStatus;
  owner: string;
  runtimeType: HarnessRuntimeType;
  runtimeImage?: string;
  allowedTools: string[];
  allowedMcpServers: string[];
  secretScopes: string[];
  networkPolicy: {
    mode: NetworkPolicyMode;
    allow?: string[];
  };
  testCommands: string[];
  dependencies?: RegistryDependency[];
  compatibleAgents: AgentKind[];
  instructionLoadingPolicy: {
    enabled: boolean;
    scopes: InstructionArtifactScope[];
    maxContextBytes: number;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type HarnessPackage = HarnessDefinition;

export type InstructionArtifact = {
  id: string;
  name: string;
  version: string;
  description: string;
  status: RegistryStatus;
  approvalStatus: ApprovalStatus;
  evalStatus: EvalStatus;
  owner: string;
  type: InstructionArtifactType;
  scope: InstructionArtifactScope;
  path?: string;
  body?: string;
  checksum: string;
  checksumAlgorithm: ChecksumAlgorithm;
  checksumStatus: ChecksumStatus;
  checksumVerifiedAt?: Date;
  precedence: number;
  appliesToAgents: AgentKind[];
  appliesToRepos: string[];
  appliesToDirectories: string[];
  dependencies?: RegistryDependency[];
  maxContextBytes: number;
  createdAt: Date;
  updatedAt: Date;
};

export type RegistryAuditLogEntry = {
  id: string;
  actorId: string;
  action: RegistryAuditAction;
  targetKind: RegistryKind;
  targetId: string;
  targetName: string;
  targetVersion: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  createdAt: Date;
};

export type RegistryRevision = {
  id: string;
  targetKind: RegistryKind;
  targetId: string;
  targetName: string;
  targetVersion: string;
  revisionNumber: number;
  snapshot: Record<string, unknown>;
  snapshotChecksum: string;
  changeReason?: string;
  createdBy: string;
  createdAt: Date;
  sourceAuditLogId?: string;
};

export type RegistryRollbackRequest = {
  targetKind: RegistryKind;
  targetId: string;
  targetRevisionId?: string;
  revisionNumber?: number;
  actorId: string;
  reason: string;
};

export type RegistryRollbackResult = {
  targetKind: RegistryKind;
  targetId: string;
  rolledBackFromRevision: RegistryRevision;
  rolledBackToRevision: RegistryRevision;
  newRevision: RegistryRevision;
  auditLogId: string;
  createdAt: Date;
};

export type RegistryApprovalQueueItem = {
  id: string;
  targetKind: RegistryKind;
  targetId: string;
  targetName: string;
  targetVersion: string;
  approvalStatus: ApprovalStatus;
  requestedBy: string;
  requestedAt: Date;
  reason?: string;
  currentStatus: RegistryStatus;
  evalStatus: EvalStatus;
  checksumStatus?: ChecksumStatus;
  blockingReasons: string[];
  recommendedAction: string;
};

export type RegistryEvalResult = {
  id: string;
  targetKind: RegistryKind;
  targetId: string;
  targetName: string;
  targetVersion: string;
  evalName: string;
  evalType: RegistryEvalResultType;
  status: RegistryEvalResultStatus;
  score?: number;
  maxScore?: number;
  summary: string;
  details?: string;
  attachedBy: string;
  attachedAt: Date;
  source: RegistryEvalResultSource;
  artifactRef?: string;
};

export type RegistryActor = {
  id: string;
  displayName: string;
  roles: RegistryRole[];
  teams?: string[];
};

export type MutationAuthorizationDecision = {
  allowed: boolean;
  reason: string;
  requiredPermission: RegistryPermission;
  actorId: string;
  targetKind?: RegistryKind;
  targetId?: string;
};

export type RegistryPackageEntry = {
  kind: RegistryKind;
  id: string;
  name: string;
  version: string;
  checksum?: string;
  required: boolean;
};

export type RegistryPackageDependency = {
  kind: RegistryPackageKind;
  name: string;
  versionRange: string;
  optional: boolean;
};

export type RegistryPackageManifest = {
  id: string;
  schemaVersion: string;
  packageKind: RegistryPackageKind;
  name: string;
  version: string;
  description: string;
  owner: string;
  manifestVersion: string;
  entries: RegistryPackageEntry[];
  dependencies: RegistryPackageDependency[];
  checksum: string;
  checksumAlgorithm: ChecksumAlgorithm;
  createdAt: Date;
  createdBy: string;
  tags: string[];
  metadata: Record<string, unknown>;
};

export type RegistryPackageDiffEntry = {
  path: string;
  from?: unknown;
  to?: unknown;
};

export type RegistryPackageDiff = {
  fromRef: string;
  toRef: string;
  addedEntries: RegistryPackageDiffEntry[];
  removedEntries: RegistryPackageDiffEntry[];
  changedEntries: RegistryPackageDiffEntry[];
  unchangedEntries: string[];
  riskLevel: RiskLevel;
  summary: string;
};

export type InstructionSet = {
  id: string;
  taskRunId: string;
  artifacts: {
    artifactId: string;
    version: string;
    contentHash: string;
    source: string;
  }[];
  assembledHash: string;
  maxContextBytes: number;
  createdAt: Date;
};

export type UsageEvent = {
  id: string;
  taskId?: string;
  taskRunId?: string;
  userId: string;
  repoId?: string;
  provider: string;
  model?: string;
  eventType: "llm_call" | "mcp_tool_call" | "runner_runtime" | "ci_runtime";
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  latencyMs?: number;
  skillVersion?: string;
  harnessVersion?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
};

export type AuditLog = {
  id: string;
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId: string;
  taskId?: string;
  repoId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type User = {
  id: string;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Team = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};
