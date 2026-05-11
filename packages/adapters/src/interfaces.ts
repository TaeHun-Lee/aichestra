import type { AgentKind, BranchLease, ConflictRiskLevel, InstructionSet, PullRequest, RepoProvider, UsageEvent } from "@aichestra/core";

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

export type GitProvider = {
  createBranch(input: CreateBranchInput): Promise<{ branchName: string }>;
  createDraftPullRequest(input: CreatePullRequestInput): Promise<PullRequest>;
  simulateMerge(input: CreateBranchInput): Promise<MergeSimulationResult>;
  computeConflictRisk(input: ConflictRiskInput): ConflictRiskResult;
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
