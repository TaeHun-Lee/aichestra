import { createId } from "@aichestra/core";
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject
} from "@aichestra/policy";
import type { PolicyDecision } from "@aichestra/policy";
import { createServiceAccountPolicySubject, serviceAccountAuditMetadata } from "@aichestra/auth";
import type { SecurityControlService } from "@aichestra/security";
import { BlockedCommandExecutor } from "./command-executor.ts";
import type {
  AgentRunExecutionResult,
  AgentRunRequest,
  AgentRunner,
  AgentWorkspace,
  CommandExecutionResult
} from "./agent-runner.ts";
import type { AgentRunnerRuntimeConfig } from "./config.ts";
import { createAgentRunnerConfigFromEnv } from "./config.ts";
import { assembleRunnerInstructions } from "./instruction-assembly.ts";
import { createRunnerHarnessPolicy, evaluateRunnerHarnessPolicy } from "./harness-policy.ts";
import {
  createInMemoryAgentRunnerRepositories,
  type AgentRunAuditRepository,
  type AgentRunRepository,
  type AgentWorkspaceRepository,
  type CommandExecutionResultRepository,
  type InstructionAssemblyRepository
} from "./repository.ts";
import {
  AgentWorkspaceLifecycleService,
  type AgentWorkspaceCleanupDecision,
  type AgentWorkspaceLifecycleContext,
  type AgentWorkspaceLifecycleEvent,
  type AgentWorkspaceLifecycleQuery,
  type AgentWorkspaceLease,
  workspaceLeaseIdFromMetadata
} from "./workspace-lifecycle.ts";

export type AgentRunnerServiceInput = {
  runner: AgentRunner;
  config?: AgentRunnerRuntimeConfig;
  runRepository?: AgentRunRepository;
  auditRepository?: AgentRunAuditRepository;
  instructionAssemblyRepository?: InstructionAssemblyRepository;
  commandExecutionResultRepository?: CommandExecutionResultRepository;
  workspaceRepository?: AgentWorkspaceRepository;
  workspaceLifecycleService?: AgentWorkspaceLifecycleService;
  policyService?: PolicyService;
  securityService?: SecurityControlService;
};

type CommandCapableRunner = AgentRunner & {
  executeCommandForRun(input: {
    run: AgentRunExecutionResult;
    workspacePath?: string;
    command: string;
    args: string[];
    allowedCommands: string[];
    deniedCommands?: string[];
    timeoutMs?: number;
  }): Promise<CommandExecutionResult>;
  listCommandResults(filter?: { taskId?: string; taskRunId?: string; agentRunId?: string }): CommandExecutionResult[];
  listWorkspaces(filter?: { taskId?: string; taskRunId?: string }): AgentWorkspace[];
  getWorkspace(workspaceId: string): AgentWorkspace | undefined;
};

export class AgentRunnerService {
  private readonly runner: AgentRunner;
  private readonly config: AgentRunnerRuntimeConfig;
  private readonly runRepository: AgentRunRepository;
  private readonly auditRepository: AgentRunAuditRepository;
  private readonly instructionAssemblyRepository: InstructionAssemblyRepository;
  private readonly commandExecutionResultRepository: CommandExecutionResultRepository;
  private readonly workspaceRepository: AgentWorkspaceRepository;
  private readonly workspaceLifecycleService: AgentWorkspaceLifecycleService;
  private readonly policyService: PolicyService;
  private readonly securityService?: SecurityControlService;

  constructor(input: AgentRunnerServiceInput) {
    const repositories = createInMemoryAgentRunnerRepositories();
    this.runner = input.runner;
    this.config = input.config ?? createAgentRunnerConfigFromEnv({});
    this.runRepository = input.runRepository ?? repositories.runRepository;
    this.auditRepository = input.auditRepository ?? repositories.auditRepository;
    this.instructionAssemblyRepository = input.instructionAssemblyRepository ?? repositories.instructionAssemblyRepository;
    this.commandExecutionResultRepository = input.commandExecutionResultRepository ?? repositories.commandExecutionResultRepository;
    this.workspaceRepository = input.workspaceRepository ?? repositories.workspaceRepository;
    this.workspaceLifecycleService = input.workspaceLifecycleService ?? new AgentWorkspaceLifecycleService();
    this.policyService = input.policyService ?? new PolicyService();
    this.securityService = input.securityService;
  }

  listRunners() {
    return [
      { runnerKind: "mock", default: this.runner.getRunnerKind() === "mock", enabled: true, local: false },
      { runnerKind: "local", default: this.runner.getRunnerKind() === "local", enabled: this.config.localRunnerEnabled, local: true },
      { runnerKind: "codex_cli_future", default: false, enabled: false, local: true },
      { runnerKind: "claude_code_future", default: false, enabled: false, local: true },
      { runnerKind: "aider_future", default: false, enabled: false, local: true },
      { runnerKind: "custom_future", default: false, enabled: false, local: true }
    ];
  }

  listExecutors() {
    return [
      {
        executorKind: "blocked",
        default: !this.config.localCommandExecutionEnabled,
        enabled: true,
        commandExecution: false
      },
      {
        executorKind: "fixture_local",
        default: this.config.localCommandExecutionEnabled && this.runner.getRunnerKind() === "local",
        enabled: this.config.localRunnerEnabled && this.config.localCommandExecutionEnabled,
        commandExecution: true
      }
    ];
  }

  getConfig(): AgentRunnerRuntimeConfig {
    return {
      ...this.config,
      runnerKind: this.runner.getRunnerKind() === "local" ? "local" : "mock"
    };
  }

  async validateEnvironment(request?: Partial<AgentRunRequest>) {
    const validation = await this.runner.validateEnvironment(request);
    this.recordAudit({
      taskId: request?.taskId ?? "task_unknown",
      taskRunId: request?.taskRunId ?? "run_unknown",
      eventType: "agent_runner_environment_validated",
      result: validation.ok ? "allowed" : "blocked",
      reason: validation.reason,
      metadata: validation.metadata
    });
    return validation;
  }

  async runAgent(request: AgentRunRequest): Promise<AgentRunExecutionResult> {
    const runnerPolicy = this.evaluatePolicy("runner.execute", "runner", request, {
      runnerKind: this.runner.getRunnerKind()
    });
    if (!runnerPolicy.allowed) {
      const audit = this.recordAudit({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        eventType: "agent_run_blocked",
        result: "blocked",
        reason: runnerPolicy.reason,
        metadata: {
          policyDecisionId: runnerPolicy.id,
          matchedRuleIds: runnerPolicy.matchedRuleIds
        }
      });
      return this.runRepository.createRun({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        runnerKind: this.runner.getRunnerKind(),
        status: "blocked",
        diffSummary: "0 files changed, 0 insertions, 0 deletions",
        changedFiles: [],
        testResults: [{ command: "runner policy", status: "blocked", output: runnerPolicy.reason }],
        llmGatewayRequestIds: [],
        usageLedgerEntryIds: [],
        auditEventIds: [audit.id],
        commandExecutionResultIds: [],
        completedAt: new Date(),
        metadata: {
          reason: runnerPolicy.reason,
          policyDecisionId: runnerPolicy.id
        }
      });
    }
    const policy = createRunnerHarnessPolicy({
      allowedCommands: request.allowedCommands,
      maxRuntimeMs: request.maxRuntimeMs
    });
    const decision = evaluateRunnerHarnessPolicy(policy, [...request.allowedCommands, ...request.testCommands]);
    const assembly = this.instructionAssemblyRepository.saveAssembly(assembleRunnerInstructions(request));

    if (!decision.allowed) {
      const blockedAudit = this.recordAudit({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        eventType: "agent_run_blocked",
        result: "blocked",
        reason: decision.reason,
        metadata: {
          blockedCommands: decision.blockedCommands,
          instructionAssemblyId: assembly.id
        }
      });
      return this.runRepository.createRun({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        runnerKind: this.runner.getRunnerKind(),
        status: "blocked",
        diffSummary: "0 files changed, 0 insertions, 0 deletions",
        changedFiles: [],
        testResults: decision.blockedCommands.map((command) => ({
          command,
          status: "blocked",
          output: decision.reason
        })),
        llmGatewayRequestIds: [],
        usageLedgerEntryIds: [],
        auditEventIds: [blockedAudit.id],
        commandExecutionResultIds: [],
        completedAt: new Date(),
        metadata: {
          reason: decision.reason,
          instructionAssemblyId: assembly.id
        }
      });
    }
    if (this.config.localCommandExecutionEnabled && request.testCommands.length > 0) {
      const commandPolicy = this.evaluatePolicy("runner.command.execute", "command", request, {
        command: [...request.allowedCommands, ...request.testCommands].join(" && "),
        environment: {
          localCommandExecutionEnabled: this.config.localCommandExecutionEnabled,
          harnessAllowed: decision.allowed,
          workspaceSafe: Boolean(request.repoRef?.localPath)
        }
      });
      if (!commandPolicy.allowed) {
        const blockedAudit = this.recordAudit({
          taskId: request.taskId,
          taskRunId: request.taskRunId,
          eventType: "agent_run_blocked",
          result: "blocked",
          reason: commandPolicy.reason,
          metadata: {
            policyDecisionId: commandPolicy.id,
            matchedRuleIds: commandPolicy.matchedRuleIds
          }
        });
        return this.runRepository.createRun({
          taskId: request.taskId,
          taskRunId: request.taskRunId,
          runnerKind: this.runner.getRunnerKind(),
          status: "blocked",
          diffSummary: "0 files changed, 0 insertions, 0 deletions",
          changedFiles: [],
          testResults: request.testCommands.map((command) => ({
            command,
            status: "blocked",
            output: commandPolicy.reason
          })),
          llmGatewayRequestIds: [],
          usageLedgerEntryIds: [],
          auditEventIds: [blockedAudit.id],
          commandExecutionResultIds: [],
          completedAt: new Date(),
          metadata: {
            reason: commandPolicy.reason,
            policyDecisionId: commandPolicy.id
          }
        });
      }
    }

    const sandbox = this.securityService && this.config.localCommandExecutionEnabled && request.repoRef?.localPath
      ? this.securityService.createSandboxSession({
        profileId: "sandbox_local_temp_fixture",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId,
        runnerKind: this.runner.getRunnerKind(),
        metadata: {
          source: "agent_runner_service",
          localCommandExecutionEnabled: this.config.localCommandExecutionEnabled
        }
      })
      : undefined;
    if (sandbox && !sandbox.decision.allowed) {
      const blockedAudit = this.recordAudit({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        eventType: "agent_run_blocked",
        result: "blocked",
        reason: sandbox.decision.reason,
        metadata: {
          sandboxDecisionId: sandbox.decision.id
        }
      });
      return this.runRepository.createRun({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        runnerKind: this.runner.getRunnerKind(),
        status: "blocked",
        diffSummary: "0 files changed, 0 insertions, 0 deletions",
        changedFiles: [],
        testResults: [{ command: "sandbox policy", status: "blocked", output: sandbox.decision.reason }],
        llmGatewayRequestIds: [],
        usageLedgerEntryIds: [],
        auditEventIds: [blockedAudit.id],
        commandExecutionResultIds: [],
        completedAt: new Date(),
        metadata: {
          reason: sandbox.decision.reason,
          sandboxDecisionId: sandbox.decision.id
        }
      });
    }

    const prepared = await this.runner.prepareRun(request);
    const preparedAudit = this.recordAudit({
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      eventType: "agent_run_prepared",
      result: prepared.status === "prepared" ? "allowed" : "blocked",
      reason: prepared.reason,
      metadata: {
        preparedRunId: prepared.id,
        instructionAssemblyId: assembly.id
      }
    });

    if (prepared.status === "blocked") {
      return this.runRepository.createRun({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        runnerKind: this.runner.getRunnerKind(),
        status: "blocked",
        diffSummary: "0 files changed, 0 insertions, 0 deletions",
        changedFiles: [],
        testResults: [{ command: "runner prepare", status: "blocked", output: prepared.reason ?? "runner_prepare_blocked" }],
        llmGatewayRequestIds: [],
        usageLedgerEntryIds: [],
        auditEventIds: [preparedAudit.id],
        commandExecutionResultIds: [],
        completedAt: new Date(),
        metadata: {
          reason: prepared.reason,
          instructionAssemblyId: assembly.id
        }
      });
    }

    try {
      const execution = await this.runner.executeRun(request);
      const workspaceLease = await this.ensureWorkspaceLeaseForExecution(request, execution, {
        actorId: request.actorId,
        serviceAccountId: stringMetadata(request.metadata.serviceAccountId),
        requestId: stringMetadata(request.metadata.requestId),
        correlationId: stringMetadata(request.metadata.correlationId),
        metadata: { source: "agent_runner_service" }
      });
      const completeAudit = this.recordAudit({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        eventType: execution.status === "completed" ? "agent_run_completed" : execution.status === "blocked" ? "agent_run_blocked" : "agent_run_failed",
        result: execution.status === "completed" ? "succeeded" : execution.status === "blocked" ? "blocked" : "failed",
        reason: typeof execution.metadata.reason === "string" ? execution.metadata.reason : undefined,
        metadata: {
          runId: execution.id,
          changedFiles: execution.changedFiles,
          instructionAssemblyId: assembly.id,
          llmGatewayRequestIds: execution.llmGatewayRequestIds,
          usageLedgerEntryIds: execution.usageLedgerEntryIds,
          commandExecutionResultIds: execution.commandExecutionResultIds,
          workspaceId: execution.workspaceId,
          workspaceLeaseId: workspaceLease?.id
        }
      });
      if (sandbox?.session) {
        this.securityService?.completeSandboxSession(sandbox.session.id);
      }
      const saved = this.runRepository.createRun({
        ...execution,
        workspaceLeaseId: workspaceLease?.id,
        auditEventIds: [...execution.auditEventIds, preparedAudit.id, completeAudit.id],
        metadata: {
          ...execution.metadata,
          workspaceLeaseId: workspaceLease?.id,
          instructionAssemblyId: assembly.id,
          instructionSetHash: assembly.instructionSetHash,
          sandboxSessionId: sandbox?.session?.id,
          sandboxDecisionId: sandbox?.decision.id,
          safety: {
            externalCalls: false,
            remoteGit: false,
            activeRegistryMutation: false
          }
        }
      });
      return saved;
    } catch (error) {
      const failedAudit = this.recordAudit({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        eventType: "agent_run_failed",
        result: "failed",
        reason: error instanceof Error ? error.message : "agent_run_failed",
        metadata: {
          instructionAssemblyId: assembly.id
        }
      });
      return this.runRepository.createRun({
        id: createId("agentrun"),
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        runnerKind: this.runner.getRunnerKind(),
        status: "failed",
        diffSummary: "0 files changed, 0 insertions, 0 deletions",
        changedFiles: [],
        testResults: [{ command: "agent runner", status: "failed", output: error instanceof Error ? error.message : "agent_run_failed" }],
        llmGatewayRequestIds: [],
        usageLedgerEntryIds: [],
        auditEventIds: [preparedAudit.id, failedAudit.id],
        commandExecutionResultIds: [],
        completedAt: new Date(),
        metadata: {
          instructionAssemblyId: assembly.id
        }
      });
    }
  }

  listRuns(filter: { taskId?: string; taskRunId?: string } = {}): AgentRunExecutionResult[] {
    return this.runRepository.listRuns(filter);
  }

  getRun(id: string): AgentRunExecutionResult | undefined {
    return this.runRepository.getRun(id);
  }

  listAuditEvents(filter: { taskId?: string; taskRunId?: string; runId?: string } = {}) {
    return this.auditRepository.listAuditEvents(filter);
  }

  listInstructionAssemblies(filter: { taskId?: string; taskRunId?: string } = {}) {
    return this.instructionAssemblyRepository.listAssemblies(filter);
  }

  getInstructionAssemblyForTaskRun(taskRunId: string) {
    return this.instructionAssemblyRepository.getAssemblyForTaskRun(taskRunId);
  }

  listCommandResults(filter: { taskId?: string; taskRunId?: string; agentRunId?: string } = {}): CommandExecutionResult[] {
    if (isCommandCapableRunner(this.runner)) return this.runner.listCommandResults(filter);
    return this.commandExecutionResultRepository.listCommandResults(filter);
  }

  listWorkspaces(filter: { taskId?: string; taskRunId?: string } = {}): AgentWorkspace[] {
    if (isCommandCapableRunner(this.runner)) return this.runner.listWorkspaces(filter);
    return this.workspaceRepository.listWorkspaces(filter);
  }

  getWorkspace(id: string): AgentWorkspace | undefined {
    if (isCommandCapableRunner(this.runner)) return this.runner.getWorkspace(id);
    return this.workspaceRepository.getWorkspace(id);
  }

  getWorkspaceForRun(runId: string): AgentWorkspace | undefined {
    const run = this.getRun(runId);
    if (!run?.workspaceId) return undefined;
    return this.getWorkspace(run.workspaceId);
  }

  listWorkspaceLeases(query: AgentWorkspaceLifecycleQuery = {}): AgentWorkspaceLease[] {
    return this.workspaceLifecycleService.listWorkspaces(query);
  }

  getWorkspaceLease(workspaceLeaseId: string): AgentWorkspaceLease | undefined {
    return this.workspaceLifecycleService.getWorkspace(workspaceLeaseId);
  }

  listWorkspaceLifecycleEvents(workspaceLeaseId?: string): AgentWorkspaceLifecycleEvent[] {
    return this.workspaceLifecycleService.listEvents(workspaceLeaseId);
  }

  listWorkspaceCleanupDecisions(workspaceLeaseId?: string): AgentWorkspaceCleanupDecision[] {
    return this.workspaceLifecycleService.listCleanupDecisions(workspaceLeaseId);
  }

  requestWorkspaceLease(input: Parameters<AgentWorkspaceLifecycleService["requestWorkspace"]>[0], context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.workspaceLifecycleService.requestWorkspace(input, context);
  }

  allocateFixtureWorkspaceLease(input: Parameters<AgentWorkspaceLifecycleService["allocateFixtureWorkspace"]>[0], context: AgentWorkspaceLifecycleContext = {}): Promise<AgentWorkspaceLease> {
    return this.workspaceLifecycleService.allocateFixtureWorkspace(input, context);
  }

  markWorkspaceLeaseActive(workspaceLeaseId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.workspaceLifecycleService.markActive(workspaceLeaseId, context);
  }

  freezeWorkspaceLease(workspaceLeaseId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.workspaceLifecycleService.freezeWorkspace(workspaceLeaseId, context);
  }

  markWorkspaceLeaseReadyForMerge(workspaceLeaseId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.workspaceLifecycleService.markReadyForMerge(workspaceLeaseId, context);
  }

  recordWorkspaceLeaseMergeCompleted(workspaceLeaseId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.workspaceLifecycleService.recordMergeCompleted(workspaceLeaseId, context);
  }

  requestWorkspaceLeaseCleanup(workspaceLeaseId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.workspaceLifecycleService.requestCleanup(workspaceLeaseId, context);
  }

  evaluateWorkspaceLeaseCleanup(
    workspaceLeaseId: string,
    input: Parameters<AgentWorkspaceLifecycleService["evaluateCleanup"]>[1] = {},
    context: AgentWorkspaceLifecycleContext = {}
  ): AgentWorkspaceCleanupDecision {
    return this.workspaceLifecycleService.evaluateCleanup(workspaceLeaseId, input, context);
  }

  recordWorkspaceLeaseCleanupCompleted(workspaceLeaseId: string, context: AgentWorkspaceLifecycleContext = {}): AgentWorkspaceLease {
    return this.workspaceLifecycleService.recordCleanupCompleted(workspaceLeaseId, context);
  }

  async executeCommandForRun(runId: string, input: {
    workspacePath?: string;
    command: string;
    args?: string[];
    allowedCommands?: string[];
    deniedCommands?: string[];
    timeoutMs?: number;
  }): Promise<CommandExecutionResult> {
    const run = this.getRun(runId);
    if (!run) {
      throw new Error(`Agent run not found: ${runId}`);
    }
    const allowedCommands = input.allowedCommands ?? [];
    const deniedCommands = input.deniedCommands ?? createRunnerHarnessPolicy().deniedCommands;
    const policyDecision = this.evaluatePolicy("runner.command.execute", "command", run, {
      command: [input.command, ...(input.args ?? [])].join(" "),
      environment: {
        localCommandExecutionEnabled: this.config.localCommandExecutionEnabled,
        harnessAllowed: allowedCommands.length > 0,
        workspaceSafe: Boolean(input.workspacePath ?? run.workspaceId)
      }
    });
    if (!policyDecision.allowed) {
      const blocked = await new BlockedCommandExecutor().executeCommand({
        taskId: run.taskId,
        taskRunId: run.taskRunId,
        agentRunId: run.id,
        workspacePath: input.workspacePath ?? process.cwd(),
        command: input.command,
        args: input.args ?? [],
        timeoutMs: input.timeoutMs ?? this.config.maxRuntimeMs,
        allowedCommands,
        deniedCommands,
        envPolicy: { allowInheritedEnv: false, allowedEnvKeys: [] },
        metadata: { source: "agent_runner_service", policyDecisionId: policyDecision.id }
      });
      const saved = this.commandExecutionResultRepository.saveCommandResult({
        ...blocked,
        blockedReason: policyDecision.reason
      });
      this.recordAudit({
        taskId: run.taskId,
        taskRunId: run.taskRunId,
        eventType: "agent_command_blocked",
        result: "blocked",
        reason: policyDecision.reason,
        metadata: {
          runId: run.id,
          commandResultId: saved.id,
          policyDecisionId: policyDecision.id,
          matchedRuleIds: policyDecision.matchedRuleIds
        }
      });
      return saved;
    }
    const result = this.config.localCommandExecutionEnabled && isCommandCapableRunner(this.runner)
      ? await this.runner.executeCommandForRun({
        run,
        workspacePath: input.workspacePath,
        command: input.command,
        args: input.args ?? [],
        allowedCommands,
        deniedCommands,
        timeoutMs: input.timeoutMs ?? this.config.maxRuntimeMs
      })
      : await new BlockedCommandExecutor().executeCommand({
        taskId: run.taskId,
        taskRunId: run.taskRunId,
        agentRunId: run.id,
        workspacePath: input.workspacePath ?? process.cwd(),
        command: input.command,
        args: input.args ?? [],
        timeoutMs: input.timeoutMs ?? this.config.maxRuntimeMs,
        allowedCommands,
        deniedCommands,
        envPolicy: { allowInheritedEnv: false, allowedEnvKeys: [] },
        metadata: { source: "agent_runner_service" }
      });
    const saved = this.config.localCommandExecutionEnabled && isCommandCapableRunner(this.runner)
      ? result
      : this.commandExecutionResultRepository.saveCommandResult(result);
    this.recordAudit({
      taskId: run.taskId,
      taskRunId: run.taskRunId,
      eventType: saved.status === "completed" ? "agent_command_completed" : "agent_command_blocked",
      result: saved.status === "completed" ? "succeeded" : "blocked",
      reason: saved.blockedReason,
      metadata: {
        runId: run.id,
        commandResultId: saved.id,
        command: saved.command,
        args: saved.args,
        executorKind: saved.executorKind,
        status: saved.status
      }
    });
    return saved;
  }

  private recordAudit(input: {
    taskId: string;
    taskRunId: string;
    eventType: string;
    result: "allowed" | "blocked" | "succeeded" | "failed";
    reason?: string;
    metadata: Record<string, unknown>;
  }) {
    const metadata = sanitizeMetadata(input.metadata);
    return this.auditRepository.appendAuditEvent({
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      runnerKind: this.runner.getRunnerKind(),
      eventType: input.eventType,
      result: input.result,
      reason: input.reason,
      actorId: stringMetadata(metadata.actorId),
      principalId: stringMetadata(metadata.principalId),
      serviceAccountId: stringMetadata(metadata.serviceAccountId),
      requestId: stringMetadata(metadata.requestId),
      correlationId: stringMetadata(metadata.correlationId),
      source: stringMetadata(metadata.source),
      metadata
    });
  }

  private async ensureWorkspaceLeaseForExecution(
    request: AgentRunRequest,
    execution: AgentRunExecutionResult,
    context: AgentWorkspaceLifecycleContext
  ): Promise<AgentWorkspaceLease | undefined> {
    const existingLeaseId = execution.workspaceLeaseId ?? workspaceLeaseIdFromMetadata(execution.metadata) ?? workspaceLeaseIdFromMetadata(request.metadata);
    if (existingLeaseId) {
      const existing = this.workspaceLifecycleService.getWorkspace(existingLeaseId);
      if (existing) return existing;
    }

    const branchName = request.branchRef?.branchName ?? "mock-agent-run";
    const baseBranch = request.branchRef?.baseBranch ?? request.repoRef?.defaultBranch ?? "main";
    const branchLeaseId = stringMetadata(request.metadata.branchLeaseId);
    const ownerServiceAccountId = stringMetadata(request.metadata.serviceAccountId);
    const linkedWorkspace = execution.workspaceId ? this.getWorkspace(execution.workspaceId) : undefined;
    const workspacePath = linkedWorkspace?.rootPath ?? request.repoRef?.localPath;

    if (workspacePath) {
      const lease = await this.workspaceLifecycleService.allocateFixtureWorkspace({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        agentRunId: execution.id,
        repoId: request.repoRef?.repoId ?? request.branchRef?.repoId ?? "repo_unknown",
        branchLeaseId,
        branchName,
        baseBranch,
        workspacePath,
        ownerActorId: request.actorId,
        ownerServiceAccountId,
        metadata: {
          source: "agent_runner_service",
          agentWorkspaceId: execution.workspaceId,
          runnerKind: execution.runnerKind,
          branchLeaseId
        }
      }, context);
      if (lease.status === "allocated") {
        return this.workspaceLifecycleService.markActive(lease.id, context);
      }
      return lease;
    }

    return this.workspaceLifecycleService.requestWorkspace({
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      agentRunId: execution.id,
      repoId: request.repoRef?.repoId ?? request.branchRef?.repoId ?? "repo_unknown",
      branchLeaseId,
      branchName,
      baseBranch,
      workspaceKind: "git_worktree_future",
      ownerActorId: request.actorId,
      ownerServiceAccountId,
      metadata: {
        source: "agent_runner_service",
        runnerKind: execution.runnerKind,
        futureWorktreeModeledOnly: true,
        realGitWorktreeExecuted: false,
        branchLeaseId
      }
    }, context);
  }

  private evaluatePolicy(action: "runner.execute" | "runner.command.execute", resourceKind: "runner" | "command", input: Pick<AgentRunRequest, "taskId" | "taskRunId" | "actorId" | "repoRef" | "selectedModelRef" | "selectedSkillRefs" | "selectedHarnessRef" | "selectedInstructionRefs"> | AgentRunExecutionResult, options: {
    runnerKind?: string;
    command?: string;
    environment?: Record<string, unknown>;
  }): PolicyDecision {
    return this.policyService.evaluate({
      subject: "actorId" in input && input.actorId
        ? createPolicySubject({
          actorId: input.actorId,
          actorKind: "service",
          roles: ["system"]
        })
        : createServiceAccountPolicySubject("runner_service", {
          source: "worker",
          metadata: { boundary: "agent_runner_service" }
        }),
      action,
      resource: createPolicyResource({
        resourceKind,
        resourceId: resourceKind === "runner" ? this.runner.getRunnerKind() : options.command,
        metadata: {
          runnerKind: options.runnerKind ?? this.runner.getRunnerKind(),
          command: options.command
        }
      }),
      context: createPolicyContext({
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        repoId: "repoRef" in input ? input.repoRef?.repoId : undefined,
        modelId: "selectedModelRef" in input ? input.selectedModelRef : undefined,
        runnerKind: options.runnerKind ?? this.runner.getRunnerKind(),
        command: options.command,
        skillRefs: "selectedSkillRefs" in input ? input.selectedSkillRefs : undefined,
        harnessRef: "selectedHarnessRef" in input ? input.selectedHarnessRef : undefined,
        instructionRefs: "selectedInstructionRefs" in input ? input.selectedInstructionRefs : undefined,
        environment: options.environment ?? {},
        metadata: {
          source: "agent_runner_service",
          ...(!("actorId" in input) || !input.actorId ? serviceAccountAuditMetadata("runner_service", { boundary: "agent_runner_service" }) : {})
        }
      })
    });
  }
}

function isCommandCapableRunner(runner: AgentRunner): runner is CommandCapableRunner {
  return typeof (runner as Partial<CommandCapableRunner>).executeCommandForRun === "function";
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(metadata);
  for (const key of Object.keys(clone)) {
    if (key.toLowerCase().includes("token") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("key")) {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
