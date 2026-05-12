import type {
  AgentPreparedRun,
  AgentRunAuditEvent,
  AgentRunExecutionResult,
  AgentRunnerEnvironmentValidation,
  AgentWorkspace,
  CommandExecutionResult,
  InstructionAssemblyResult
} from "./agent-runner.ts";
import type { AgentRunnerRuntimeConfig } from "./config.ts";

export function agentRunnerConfigToDto(config: AgentRunnerRuntimeConfig) {
  return {
    runnerKind: config.runnerKind,
    localRunnerEnabled: config.localRunnerEnabled,
    localCommandExecutionEnabled: config.localCommandExecutionEnabled,
    workspaceRootConfigured: config.workspaceRootConfigured,
    maxRuntimeMs: config.maxRuntimeMs,
    commandExecutorKind: config.commandExecutorKind,
    maxStdoutBytes: config.maxStdoutBytes,
    maxStderrBytes: config.maxStderrBytes
  };
}

export function agentRunnerValidationToDto(validation: AgentRunnerEnvironmentValidation) {
  return {
    ok: validation.ok,
    runnerKind: validation.runnerKind,
    reason: validation.reason,
    metadata: validation.metadata
  };
}

export function preparedRunToDto(prepared: AgentPreparedRun) {
  return {
    ...prepared,
    createdAt: prepared.createdAt.toISOString()
  };
}

export function agentRunToDto(run: AgentRunExecutionResult) {
  return {
    ...run,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString()
  };
}

export function agentRunAuditEventToDto(event: AgentRunAuditEvent) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString()
  };
}

export function instructionAssemblyToDto(assembly: InstructionAssemblyResult) {
  return {
    ...assembly,
    createdAt: assembly.createdAt.toISOString()
  };
}

export function commandExecutionResultToDto(result: CommandExecutionResult) {
  return {
    ...result,
    createdAt: result.createdAt.toISOString()
  };
}

export function agentWorkspaceToDto(workspace: AgentWorkspace) {
  return {
    ...workspace,
    createdAt: workspace.createdAt.toISOString()
  };
}
