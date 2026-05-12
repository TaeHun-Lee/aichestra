import { createId } from "@aichestra/core";
import type {
  AgentWorkspace,
  AgentWorkspaceStatus,
  AgentRunAuditEvent,
  AgentRunExecutionResult,
  AgentRunRequest,
  CommandExecutionResult,
  InstructionAssemblyResult
} from "./agent-runner.ts";

export type AgentRunRepository = {
  createRun(input: Omit<AgentRunExecutionResult, "id" | "createdAt"> & { id?: string; createdAt?: Date }): AgentRunExecutionResult;
  listRuns(filter?: { taskId?: string; taskRunId?: string }): AgentRunExecutionResult[];
  getRun(id: string): AgentRunExecutionResult | undefined;
  getRunByTaskRunId(taskRunId: string): AgentRunExecutionResult | undefined;
  updateRunStatus(id: string, status: AgentRunExecutionResult["status"], metadata?: Record<string, unknown>): AgentRunExecutionResult;
};

export type AgentRunAuditRepository = {
  appendAuditEvent(input: Omit<AgentRunAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): AgentRunAuditEvent;
  listAuditEvents(filter?: { taskId?: string; taskRunId?: string; runId?: string }): AgentRunAuditEvent[];
};

export type InstructionAssemblyRepository = {
  saveAssembly(input: InstructionAssemblyResult): InstructionAssemblyResult;
  listAssemblies(filter?: { taskId?: string; taskRunId?: string }): InstructionAssemblyResult[];
  getAssemblyForTaskRun(taskRunId: string): InstructionAssemblyResult | undefined;
};

export type CommandExecutionResultRepository = {
  saveCommandResult(input: CommandExecutionResult): CommandExecutionResult;
  listCommandResults(filter?: { taskId?: string; taskRunId?: string; agentRunId?: string }): CommandExecutionResult[];
  getCommandResult(id: string): CommandExecutionResult | undefined;
};

export type AgentWorkspaceRepository = {
  saveWorkspace(input: AgentWorkspace): AgentWorkspace;
  listWorkspaces(filter?: { taskId?: string; taskRunId?: string; status?: AgentWorkspaceStatus }): AgentWorkspace[];
  getWorkspace(id: string): AgentWorkspace | undefined;
  updateWorkspaceStatus(id: string, status: AgentWorkspaceStatus, metadata?: Record<string, unknown>): AgentWorkspace;
};

export type AgentRunnerRepositoryBundle = {
  runRepository: AgentRunRepository;
  auditRepository: AgentRunAuditRepository;
  instructionAssemblyRepository: InstructionAssemblyRepository;
  commandExecutionResultRepository: CommandExecutionResultRepository;
  workspaceRepository: AgentWorkspaceRepository;
};

export class InMemoryAgentRunRepository implements AgentRunRepository {
  private readonly runs: AgentRunExecutionResult[] = [];

  createRun(input: Omit<AgentRunExecutionResult, "id" | "createdAt"> & { id?: string; createdAt?: Date }): AgentRunExecutionResult {
    const run = {
      ...input,
      id: input.id ?? createId("agentrun"),
      createdAt: input.createdAt ?? new Date()
    };
    this.runs.push(structuredClone(run));
    return structuredClone(run);
  }

  listRuns(filter: { taskId?: string; taskRunId?: string } = {}): AgentRunExecutionResult[] {
    return this.runs
      .filter((run) => (filter.taskId === undefined || run.taskId === filter.taskId) && (filter.taskRunId === undefined || run.taskRunId === filter.taskRunId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((run) => structuredClone(run));
  }

  getRun(id: string): AgentRunExecutionResult | undefined {
    const run = this.runs.find((candidate) => candidate.id === id);
    return run ? structuredClone(run) : undefined;
  }

  getRunByTaskRunId(taskRunId: string): AgentRunExecutionResult | undefined {
    const run = this.runs.find((candidate) => candidate.taskRunId === taskRunId);
    return run ? structuredClone(run) : undefined;
  }

  updateRunStatus(id: string, status: AgentRunExecutionResult["status"], metadata: Record<string, unknown> = {}): AgentRunExecutionResult {
    const run = this.runs.find((candidate) => candidate.id === id);
    if (!run) {
      throw new Error(`Agent run not found: ${id}`);
    }
    run.status = status;
    run.metadata = { ...run.metadata, ...metadata };
    if (status === "completed" || status === "failed" || status === "blocked" || status === "cancelled") {
      run.completedAt = new Date();
    }
    return structuredClone(run);
  }
}

export class InMemoryAgentRunAuditRepository implements AgentRunAuditRepository {
  private readonly events: AgentRunAuditEvent[] = [];

  appendAuditEvent(input: Omit<AgentRunAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): AgentRunAuditEvent {
    const event = {
      ...input,
      id: input.id ?? createId("agentaudit"),
      createdAt: input.createdAt ?? new Date()
    };
    this.events.push(structuredClone(event));
    return structuredClone(event);
  }

  listAuditEvents(filter: { taskId?: string; taskRunId?: string; runId?: string } = {}): AgentRunAuditEvent[] {
    return this.events
      .filter((event) => {
        const runId = typeof event.metadata.runId === "string" ? event.metadata.runId : undefined;
        return (filter.taskId === undefined || event.taskId === filter.taskId) &&
          (filter.taskRunId === undefined || event.taskRunId === filter.taskRunId) &&
          (filter.runId === undefined || runId === filter.runId);
      })
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((event) => structuredClone(event));
  }
}

export class InMemoryInstructionAssemblyRepository implements InstructionAssemblyRepository {
  private readonly assemblies: InstructionAssemblyResult[] = [];

  saveAssembly(input: InstructionAssemblyResult): InstructionAssemblyResult {
    this.assemblies.push(structuredClone(input));
    return structuredClone(input);
  }

  listAssemblies(filter: { taskId?: string; taskRunId?: string } = {}): InstructionAssemblyResult[] {
    return this.assemblies
      .filter((assembly) => (filter.taskId === undefined || assembly.taskId === filter.taskId) && (filter.taskRunId === undefined || assembly.taskRunId === filter.taskRunId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((assembly) => structuredClone(assembly));
  }

  getAssemblyForTaskRun(taskRunId: string): InstructionAssemblyResult | undefined {
    const assembly = this.assemblies.find((candidate) => candidate.taskRunId === taskRunId);
    return assembly ? structuredClone(assembly) : undefined;
  }
}

export class InMemoryCommandExecutionResultRepository implements CommandExecutionResultRepository {
  private readonly results: CommandExecutionResult[] = [];

  saveCommandResult(input: CommandExecutionResult): CommandExecutionResult {
    this.results.push(structuredClone(input));
    return structuredClone(input);
  }

  listCommandResults(filter: { taskId?: string; taskRunId?: string; agentRunId?: string } = {}): CommandExecutionResult[] {
    return this.results
      .filter((result) => (filter.taskId === undefined || result.taskId === filter.taskId) &&
        (filter.taskRunId === undefined || result.taskRunId === filter.taskRunId) &&
        (filter.agentRunId === undefined || result.agentRunId === filter.agentRunId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((result) => structuredClone(result));
  }

  getCommandResult(id: string): CommandExecutionResult | undefined {
    const result = this.results.find((candidate) => candidate.id === id);
    return result ? structuredClone(result) : undefined;
  }
}

export class InMemoryAgentWorkspaceRepository implements AgentWorkspaceRepository {
  private readonly workspaces: AgentWorkspace[] = [];

  saveWorkspace(input: AgentWorkspace): AgentWorkspace {
    this.workspaces.push(structuredClone(input));
    return structuredClone(input);
  }

  listWorkspaces(filter: { taskId?: string; taskRunId?: string; status?: AgentWorkspaceStatus } = {}): AgentWorkspace[] {
    return this.workspaces
      .filter((workspace) => (filter.taskId === undefined || workspace.taskId === filter.taskId) &&
        (filter.taskRunId === undefined || workspace.taskRunId === filter.taskRunId) &&
        (filter.status === undefined || workspace.status === filter.status))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((workspace) => structuredClone(workspace));
  }

  getWorkspace(id: string): AgentWorkspace | undefined {
    const workspace = this.workspaces.find((candidate) => candidate.id === id);
    return workspace ? structuredClone(workspace) : undefined;
  }

  updateWorkspaceStatus(id: string, status: AgentWorkspaceStatus, metadata: Record<string, unknown> = {}): AgentWorkspace {
    const workspace = this.workspaces.find((candidate) => candidate.id === id);
    if (!workspace) {
      throw new Error(`Agent workspace not found: ${id}`);
    }
    workspace.status = status;
    workspace.metadata = { ...workspace.metadata, ...metadata };
    return structuredClone(workspace);
  }
}

export function createInMemoryAgentRunnerRepositories(): AgentRunnerRepositoryBundle {
  return {
    runRepository: new InMemoryAgentRunRepository(),
    auditRepository: new InMemoryAgentRunAuditRepository(),
    instructionAssemblyRepository: new InMemoryInstructionAssemblyRepository(),
    commandExecutionResultRepository: new InMemoryCommandExecutionResultRepository(),
    workspaceRepository: new InMemoryAgentWorkspaceRepository()
  };
}

export function requestIdentity(request: Pick<AgentRunRequest, "taskId" | "taskRunId">): string {
  return `${request.taskId}:${request.taskRunId}`;
}
