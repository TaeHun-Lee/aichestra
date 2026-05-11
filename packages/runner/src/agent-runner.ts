import type { AgentKind, InstructionSet, RegistryVersionRef, UsageEvent } from "@aichestra/core";

export type AgentRunnerKind =
  | "mock"
  | "local"
  | "codex_cli_future"
  | "claude_code_future"
  | "aider_future"
  | "custom_future";

export type AgentRunStatus = "completed" | "failed" | "blocked" | "cancelled";

export type AgentRunTestResult = {
  command: string;
  status: "passed" | "failed" | "skipped" | "blocked";
  output: string;
};

export type AgentRunnerEnvironmentValidation = {
  ok: boolean;
  runnerKind: AgentRunnerKind;
  reason?: string;
  metadata: Record<string, unknown>;
};

export type CommandExecutorKind = "blocked" | "fixture_local";

export type CommandExecutionStatus = "completed" | "failed" | "blocked" | "timed_out";

export type CommandEnvPolicy = {
  allowInheritedEnv: boolean;
  allowedEnvKeys: string[];
};

export type CommandExecutionRequest = {
  taskId: string;
  taskRunId: string;
  agentRunId: string;
  workspacePath: string;
  command: string;
  args: string[];
  timeoutMs: number;
  allowedCommands: string[];
  deniedCommands: string[];
  envPolicy: CommandEnvPolicy;
  metadata: Record<string, unknown>;
};

export type CommandValidationResult = {
  allowed: boolean;
  reason: string;
  normalizedCommand: string;
  blockedReason?: string;
};

export type CommandExecutionResult = {
  id: string;
  taskId: string;
  taskRunId: string;
  agentRunId: string;
  executorKind: CommandExecutorKind;
  status: CommandExecutionStatus;
  command: string;
  args: string[];
  exitCode?: number;
  stdoutPreview: string;
  stderrPreview: string;
  stdoutBytes: number;
  stderrBytes: number;
  durationMs: number;
  blockedReason?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type CommandExecutor = {
  getExecutorKind(): CommandExecutorKind;
  validateCommand(request: CommandExecutionRequest): Promise<CommandValidationResult>;
  executeCommand(request: CommandExecutionRequest): Promise<CommandExecutionResult>;
  close?(): Promise<void>;
};

export type AgentWorkspaceMode = "temp" | "fixture";

export type AgentWorkspaceStatus = "created" | "ready" | "cleaned" | "rejected";

export type AgentWorkspace = {
  id: string;
  rootPath: string;
  mode: AgentWorkspaceMode;
  taskId: string;
  taskRunId: string;
  createdAt: Date;
  cleanupPolicy: "none" | "delete_temp_workspace";
  status: AgentWorkspaceStatus;
  metadata: Record<string, unknown>;
};

export type AgentWorkspaceCreateRequest = {
  taskId: string;
  taskRunId: string;
  mode: AgentWorkspaceMode;
  requestedPath?: string;
  cleanupPolicy: AgentWorkspace["cleanupPolicy"];
  allowRepositoryRootFixture?: boolean;
  metadata: Record<string, unknown>;
};

export type AgentWorkspaceManager = {
  createWorkspace(request: AgentWorkspaceCreateRequest): Promise<AgentWorkspace>;
  validateWorkspace(workspacePath: string, options?: { allowRepositoryRootFixture?: boolean }): Promise<{ ok: boolean; reason?: string; resolvedPath?: string }>;
  cleanupWorkspace(workspaceId: string): Promise<AgentWorkspace>;
  getWorkspace(workspaceId: string): AgentWorkspace | undefined;
  listWorkspaces(filter?: { taskId?: string; taskRunId?: string; status?: AgentWorkspaceStatus }): AgentWorkspace[];
};

export type AgentRunRequest = {
  taskId: string;
  taskRunId: string;
  actorId?: string;
  repoRef?: {
    repoId: string;
    provider?: string;
    owner?: string;
    name?: string;
    defaultBranch?: string;
    localPath?: string;
  };
  branchRef?: {
    repoId: string;
    branchName: string;
    baseBranch?: string;
  };
  selectedModelRef: string;
  selectedSkillRefs: RegistryVersionRef[];
  selectedHarnessRef: RegistryVersionRef;
  selectedInstructionRefs: RegistryVersionRef[];
  prompt: string;
  allowedCommands: string[];
  testCommands: string[];
  maxRuntimeMs: number;
  metadata: Record<string, unknown>;
};

export type AgentPreparedRun = {
  id: string;
  taskId: string;
  taskRunId: string;
  runnerKind: AgentRunnerKind;
  status: "prepared" | "blocked";
  reason?: string;
  createdAt: Date;
};

export type AgentRunExecutionResult = {
  id: string;
  taskId: string;
  taskRunId: string;
  runnerKind: AgentRunnerKind;
  status: AgentRunStatus;
  diffSummary: string;
  changedFiles: string[];
  testResults: AgentRunTestResult[];
  llmGatewayRequestIds: string[];
  usageLedgerEntryIds: string[];
  auditEventIds: string[];
  commandExecutionResultIds: string[];
  workspaceId?: string;
  createdAt: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
};

export type AgentRunAuditEvent = {
  id: string;
  taskId: string;
  taskRunId: string;
  runnerKind: AgentRunnerKind;
  eventType: string;
  result: "allowed" | "blocked" | "succeeded" | "failed";
  reason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type InstructionAssemblyResult = {
  id: string;
  taskId: string;
  taskRunId: string;
  selectedInstructionRefs: RegistryVersionRef[];
  selectedSkillRefs: RegistryVersionRef[];
  selectedHarnessRef: RegistryVersionRef;
  instructionSetHash: string;
  warnings: string[];
  createdAt: Date;
};

export type AgentRunInput = {
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
  instructionSet: InstructionSet;
};

export type AgentRunResult = {
  summary: string;
  changedFiles: string[];
  diffSummary: string;
  usage: Omit<UsageEvent, "id" | "createdAt">;
  testsPassed: boolean;
  id?: string;
  runnerKind?: AgentRunnerKind;
  status?: AgentRunStatus;
  testResults?: AgentRunTestResult[];
  llmGatewayRequestIds?: string[];
  usageLedgerEntryIds?: string[];
  auditEventIds?: string[];
};

export type AgentRunner = {
  getRunnerKind(): AgentRunnerKind;
  validateEnvironment(request?: Partial<AgentRunRequest>): Promise<AgentRunnerEnvironmentValidation>;
  prepareRun(request: AgentRunRequest): Promise<AgentPreparedRun>;
  executeRun(request: AgentRunRequest): Promise<AgentRunExecutionResult>;
  collectRunResult(request: AgentRunRequest): Promise<AgentRunExecutionResult | undefined>;
  cleanupRun?(request: AgentRunRequest): Promise<void>;
  run(input: AgentRunInput): Promise<AgentRunResult>;
};
