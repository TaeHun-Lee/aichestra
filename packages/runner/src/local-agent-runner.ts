import path from "node:path";
import { createId } from "@aichestra/core";
import { MockLlmGateway } from "@aichestra/llm-gateway";
import type { LlmGateway } from "@aichestra/llm-gateway";
import { BlockedCommandExecutor, FixtureLocalCommandExecutor } from "./command-executor.ts";
import { createRunnerHarnessPolicy } from "./harness-policy.ts";
import { InMemoryCommandExecutionResultRepository, type CommandExecutionResultRepository } from "./repository.ts";
import { LocalAgentWorkspaceManager } from "./workspace.ts";
import type {
  AgentWorkspace,
  AgentWorkspaceManager,
  AgentPreparedRun,
  AgentRunExecutionResult,
  AgentRunInput,
  AgentRunRequest,
  AgentRunResult,
  AgentRunner,
  AgentRunnerEnvironmentValidation,
  AgentRunnerKind,
  CommandExecutionResult,
  CommandExecutor
} from "./agent-runner.ts";

export type LocalAgentRunnerConfig = {
  enabled: boolean;
  allowCommandExecution: boolean;
  workspaceRoot?: string;
  maxRuntimeMs: number;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
};

type RouteCapableGateway = LlmGateway & {
  routeCompletion(input: {
    taskId: string;
    taskRunId: string;
    actorId?: string;
    modelRef?: string;
    prompt: string;
    systemInstructions?: string;
    maxTokens?: number;
    budgetLimitUsd?: number;
    repoId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    ok: boolean;
    reason?: string;
    result?: { id: string; providerKind: string; modelId: string };
    usageEvent?: { id: string };
  }>;
};

export type LocalAgentRunnerDependencies = {
  commandExecutor?: CommandExecutor;
  workspaceManager?: AgentWorkspaceManager;
  commandResultRepository?: CommandExecutionResultRepository;
  llmGateway?: LlmGateway;
};

function resolveSafePath(input: string | undefined): string | undefined {
  if (!input) return undefined;
  return path.resolve(input);
}

function isWithinRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function localChangedFiles(prompt: string): string[] {
  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes("auth") || lowerPrompt.includes("login")) {
    return ["src/auth/session.ts", "tests/auth/session.test.ts"];
  }
  return ["src/app.ts"];
}

function hasRouteCompletion(gateway: LlmGateway): gateway is RouteCapableGateway {
  return typeof (gateway as Partial<RouteCapableGateway>).routeCompletion === "function";
}

function parseCommandSpec(commandSpec: string): { command: string; args: string[] } {
  const parts = commandSpec.trim().split(/\s+/).filter(Boolean);
  return {
    command: parts[0] ?? "",
    args: parts.slice(1)
  };
}

export class LocalAgentRunner implements AgentRunner {
  private readonly config: LocalAgentRunnerConfig;
  private readonly commandExecutor: CommandExecutor;
  private readonly workspaceManager: AgentWorkspaceManager;
  private readonly commandResultRepository: CommandExecutionResultRepository;
  private readonly llmGateway: LlmGateway;

  constructor(config: Partial<LocalAgentRunnerConfig> = {}, dependencies: LocalAgentRunnerDependencies = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      allowCommandExecution: config.allowCommandExecution ?? false,
      workspaceRoot: config.workspaceRoot,
      maxRuntimeMs: config.maxRuntimeMs ?? 60_000,
      maxStdoutBytes: config.maxStdoutBytes ?? 4_096,
      maxStderrBytes: config.maxStderrBytes ?? 4_096
    };
    this.commandExecutor = dependencies.commandExecutor ?? (this.config.allowCommandExecution
      ? new FixtureLocalCommandExecutor({
        enabled: true,
        maxStdoutBytes: this.config.maxStdoutBytes,
        maxStderrBytes: this.config.maxStderrBytes
      })
      : new BlockedCommandExecutor());
    this.commandResultRepository = dependencies.commandResultRepository ?? new InMemoryCommandExecutionResultRepository();
    this.workspaceManager = dependencies.workspaceManager ?? new LocalAgentWorkspaceManager({
      workspaceRoot: this.config.workspaceRoot,
      workspaceRepository: undefined
    });
    this.llmGateway = dependencies.llmGateway ?? new MockLlmGateway();
  }

  getRunnerKind(): AgentRunnerKind {
    return "local";
  }

  async validateEnvironment(request: Partial<AgentRunRequest> = {}): Promise<AgentRunnerEnvironmentValidation> {
    if (!this.config.enabled) {
      return {
        ok: false,
        runnerKind: "local",
        reason: "local_runner_disabled",
        metadata: {
          commandExecutionEnabled: this.config.allowCommandExecution,
          workspaceRootConfigured: Boolean(this.config.workspaceRoot)
        }
      };
    }

    const root = resolveSafePath(this.config.workspaceRoot);
    const localPath = resolveSafePath(request.repoRef?.localPath);
    if (!root || !localPath || !isWithinRoot(localPath, root)) {
      return {
        ok: false,
        runnerKind: "local",
        reason: "local_runner_workspace_unsafe",
        metadata: {
          workspaceRootConfigured: Boolean(root),
          localPathConfigured: Boolean(localPath)
        }
      };
    }

    return {
      ok: true,
      runnerKind: "local",
      metadata: {
        commandExecutionEnabled: this.config.allowCommandExecution,
        workspaceRootConfigured: true,
        simulationMode: !this.config.allowCommandExecution
      }
    };
  }

  async prepareRun(request: AgentRunRequest): Promise<AgentPreparedRun> {
    const validation = await this.validateEnvironment(request);
    return {
      id: createId("agentprep"),
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      runnerKind: "local",
      status: validation.ok ? "prepared" : "blocked",
      reason: validation.reason,
      createdAt: new Date()
    };
  }

  async executeRun(request: AgentRunRequest): Promise<AgentRunExecutionResult> {
    const now = new Date();
    const runId = createId("agentrun");
    const validation = await this.validateEnvironment(request);
    if (!validation.ok) {
      return this.blockedResult(request, validation.reason ?? "local_runner_blocked", now, runId);
    }
    if (!this.config.allowCommandExecution && request.allowedCommands.length > 0) {
      return this.blockedResult(request, "local_command_execution_disabled", now, runId);
    }

    const route = hasRouteCompletion(this.llmGateway)
      ? await this.llmGateway.routeCompletion({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId,
        modelRef: request.selectedModelRef,
        prompt: request.prompt,
        systemInstructions: `Local agent runner ${request.selectedHarnessRef.name}@${request.selectedHarnessRef.version}`,
        repoId: request.repoRef?.repoId,
        budgetLimitUsd: typeof request.metadata.budgetLimitUsd === "number" ? request.metadata.budgetLimitUsd : undefined,
        metadata: {
          source: "local_agent_runner",
          runnerKind: "local"
        }
      })
      : undefined;

    if (route && !route.ok) {
      return this.blockedResult(request, route.reason ?? "llm_gateway_blocked", now, runId);
    }

    const workspace = this.config.allowCommandExecution
      ? await this.prepareWorkspace(request)
      : undefined;
    if (workspace?.status === "rejected") {
      return this.blockedResult(request, String(workspace.metadata.reason ?? "workspace_rejected"), now, runId, workspace.id);
    }

    const commandResults = this.config.allowCommandExecution && request.testCommands.length > 0 && workspace
      ? await this.executeTestCommands(request, runId, workspace)
      : [];

    const changedFiles = localChangedFiles(request.prompt);
    const commandBlocked = commandResults.some((result) => result.status === "blocked");
    const commandFailed = commandResults.some((result) => result.status === "failed" || result.status === "timed_out");
    const status = commandBlocked ? "blocked" : commandFailed ? "failed" : "completed";
    if (workspace?.cleanupPolicy === "delete_temp_workspace") {
      await this.workspaceManager.cleanupWorkspace(workspace.id);
    }
    return {
      id: runId,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      runnerKind: "local",
      status,
      diffSummary: `${changedFiles.length} files changed, 6 insertions, 1 deletion`,
      changedFiles,
      testResults: commandResults.length > 0 ? commandResults.map((result) => ({
        command: [path.basename(result.command), ...result.args].join(" ").trim(),
        status: result.status === "completed" ? "passed" : result.status === "blocked" ? "blocked" : "failed",
        output: result.blockedReason ?? result.stdoutPreview ?? result.stderrPreview
      })) : [{
        command: request.testCommands[0] ?? "local simulation",
        status: "skipped",
        output: "LocalAgentRunner ran in simulation mode; no commands were executed."
      }],
      llmGatewayRequestIds: route?.result?.id ? [route.result.id] : [],
      usageLedgerEntryIds: route?.usageEvent?.id ? [route.usageEvent.id] : [],
      auditEventIds: [],
      commandExecutionResultIds: commandResults.map((result) => result.id),
      workspaceId: workspace?.id,
      createdAt: now,
      completedAt: new Date(),
      metadata: {
        simulationMode: !this.config.allowCommandExecution,
        commandExecution: this.config.allowCommandExecution,
        commandExecutorKind: this.commandExecutor.getExecutorKind(),
        commandResultStatuses: commandResults.map((result) => result.status),
        workspaceId: workspace?.id,
        filesystemMutation: false,
        remoteGit: false,
        network: false,
        completionProviderKind: route?.result?.providerKind,
        completionModelId: route?.result?.modelId
      }
    };
  }

  async collectRunResult(request: AgentRunRequest): Promise<AgentRunExecutionResult | undefined> {
    return this.executeRun(request);
  }

  async cleanupRun(): Promise<void> {
    return undefined;
  }

  listCommandResults(filter: { taskId?: string; taskRunId?: string; agentRunId?: string } = {}): CommandExecutionResult[] {
    return this.commandResultRepository.listCommandResults(filter);
  }

  listWorkspaces(filter: { taskId?: string; taskRunId?: string } = {}): AgentWorkspace[] {
    return this.workspaceManager.listWorkspaces(filter);
  }

  getWorkspace(workspaceId: string): AgentWorkspace | undefined {
    return this.workspaceManager.getWorkspace(workspaceId);
  }

  async executeCommandForRun(input: {
    run: AgentRunExecutionResult;
    workspacePath?: string;
    command: string;
    args: string[];
    allowedCommands: string[];
    deniedCommands?: string[];
    timeoutMs?: number;
  }): Promise<CommandExecutionResult> {
    const workspacePath = input.workspacePath ?? this.workspaceManager.getWorkspace(input.run.workspaceId ?? "")?.rootPath;
    if (!workspacePath) {
      const result = await new BlockedCommandExecutor().executeCommand({
        taskId: input.run.taskId,
        taskRunId: input.run.taskRunId,
        agentRunId: input.run.id,
        workspacePath: this.config.workspaceRoot ?? process.cwd(),
        command: input.command,
        args: input.args,
        timeoutMs: input.timeoutMs ?? this.config.maxRuntimeMs,
        allowedCommands: input.allowedCommands,
        deniedCommands: input.deniedCommands ?? createRunnerHarnessPolicy().deniedCommands,
        envPolicy: { allowInheritedEnv: false, allowedEnvKeys: [] },
        metadata: { reason: "agent_run_workspace_missing" }
      });
      return this.commandResultRepository.saveCommandResult(result);
    }
    const workspaceValidation = await this.workspaceManager.validateWorkspace(workspacePath);
    if (!workspaceValidation.ok) {
      const result = await new BlockedCommandExecutor().executeCommand({
        taskId: input.run.taskId,
        taskRunId: input.run.taskRunId,
        agentRunId: input.run.id,
        workspacePath,
        command: input.command,
        args: input.args,
        timeoutMs: input.timeoutMs ?? this.config.maxRuntimeMs,
        allowedCommands: input.allowedCommands,
        deniedCommands: input.deniedCommands ?? createRunnerHarnessPolicy().deniedCommands,
        envPolicy: { allowInheritedEnv: false, allowedEnvKeys: [] },
        metadata: { reason: workspaceValidation.reason ?? "workspace_rejected" }
      });
      return this.commandResultRepository.saveCommandResult({
        ...result,
        blockedReason: workspaceValidation.reason ?? result.blockedReason
      });
    }
    const result = await this.commandExecutor.executeCommand({
      taskId: input.run.taskId,
      taskRunId: input.run.taskRunId,
      agentRunId: input.run.id,
      workspacePath: workspaceValidation.resolvedPath ?? workspacePath,
      command: input.command,
      args: input.args,
      timeoutMs: input.timeoutMs ?? this.config.maxRuntimeMs,
      allowedCommands: input.allowedCommands,
      deniedCommands: input.deniedCommands ?? createRunnerHarnessPolicy().deniedCommands,
      envPolicy: {
        allowInheritedEnv: false,
        allowedEnvKeys: ["PATH", "Path", "PATHEXT", "SystemRoot", "COMSPEC", "HOME", "USERPROFILE"]
      },
      metadata: { source: "execute_command_api" }
    });
    return this.commandResultRepository.saveCommandResult(result);
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const request: AgentRunRequest = {
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      actorId: input.userId,
      repoRef: {
        repoId: input.repoId,
        localPath: this.config.workspaceRoot
      },
      branchRef: {
        repoId: input.repoId,
        branchName: input.branch
      },
      selectedModelRef: input.model,
      selectedSkillRefs: input.skillVersions.map((version) => ({ kind: "skill", name: version.split("@")[0] ?? version, version: version.split("@")[1] ?? "unknown" })),
      selectedHarnessRef: { kind: "harness", name: input.harnessVersion.split("@")[0] ?? input.harnessVersion, version: input.harnessVersion.split("@")[1] ?? "unknown" },
      selectedInstructionRefs: [],
      prompt: input.prompt,
      allowedCommands: [],
      testCommands: [],
      maxRuntimeMs: this.config.maxRuntimeMs,
      metadata: {}
    };
    const result = await this.executeRun(request);
    return {
      summary: result.status === "completed" ? `Local runner simulated a patch plan for ${input.prompt}.` : `Local runner blocked: ${result.metadata.reason ?? result.status}.`,
      changedFiles: result.changedFiles,
      diffSummary: result.diffSummary,
      usage: {
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        userId: input.userId,
        repoId: input.repoId,
        provider: "local",
        model: input.model,
        eventType: "runner_runtime",
        costUsd: 0,
        skillVersion: input.skillVersions.join(","),
        harnessVersion: input.harnessVersion,
        metadata: {
          source: "local_agent_runner",
          simulationMode: !this.config.allowCommandExecution,
          filesystemMutation: false,
          remoteGit: false,
          network: false,
          reason: result.metadata.reason
        }
      },
      testsPassed: result.status === "completed",
      id: result.id,
      runnerKind: result.runnerKind,
      status: result.status,
      testResults: result.testResults,
      llmGatewayRequestIds: result.llmGatewayRequestIds,
      usageLedgerEntryIds: result.usageLedgerEntryIds,
      auditEventIds: result.auditEventIds
    };
  }

  private async prepareWorkspace(request: AgentRunRequest): Promise<AgentWorkspace> {
    return this.workspaceManager.createWorkspace({
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      mode: request.repoRef?.localPath ? "fixture" : "temp",
      requestedPath: request.repoRef?.localPath,
      cleanupPolicy: request.repoRef?.localPath ? "none" : "delete_temp_workspace",
      allowRepositoryRootFixture: false,
      metadata: {
        runnerKind: "local",
        commandExecution: true
      }
    });
  }

  private async executeTestCommands(request: AgentRunRequest, runId: string, workspace: AgentWorkspace): Promise<CommandExecutionResult[]> {
    const policy = createRunnerHarnessPolicy({
      allowedCommands: request.allowedCommands,
      maxRuntimeMs: request.maxRuntimeMs,
      maxStdoutBytes: this.config.maxStdoutBytes,
      maxStderrBytes: this.config.maxStderrBytes,
      cleanupPolicy: workspace.cleanupPolicy
    });
    const results: CommandExecutionResult[] = [];
    for (const commandSpec of request.testCommands) {
      const parsed = parseCommandSpec(commandSpec);
      const result = await this.commandExecutor.executeCommand({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        agentRunId: runId,
        workspacePath: workspace.rootPath,
        command: parsed.command,
        args: parsed.args,
        timeoutMs: Math.min(request.maxRuntimeMs, policy.maxRuntimeMs),
        allowedCommands: policy.allowedCommands,
        deniedCommands: policy.deniedCommands,
        envPolicy: {
          allowInheritedEnv: false,
          allowedEnvKeys: ["PATH", "Path", "PATHEXT", "SystemRoot", "COMSPEC", "HOME", "USERPROFILE"]
        },
        metadata: {
          workspaceId: workspace.id,
          source: "local_agent_runner"
        }
      });
      results.push(this.commandResultRepository.saveCommandResult(result));
    }
    return results;
  }

  private blockedResult(request: AgentRunRequest, reason: string, now: Date, runId: string, workspaceId?: string): AgentRunExecutionResult {
    return {
      id: runId,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      runnerKind: "local",
      status: "blocked",
      diffSummary: "0 files changed, 0 insertions, 0 deletions",
      changedFiles: [],
      testResults: [{
        command: "local runner",
        status: "blocked",
        output: reason
      }],
      llmGatewayRequestIds: [],
      usageLedgerEntryIds: [],
      auditEventIds: [],
      commandExecutionResultIds: [],
      workspaceId,
      createdAt: now,
      completedAt: now,
      metadata: {
        reason,
        workspaceId,
        filesystemMutation: false,
        remoteGit: false,
        network: false
      }
    };
  }
}
