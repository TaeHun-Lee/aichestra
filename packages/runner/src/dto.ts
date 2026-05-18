import type {
  AgentPreparedRun,
  AgentRunAuditEvent,
  AgentRunExecutionResult,
  AgentRunnerEnvironmentValidation,
  AgentWorkspace,
  CommandExecutionResult,
  InstructionAssemblyResult
} from "./agent-runner.ts";
import type {
  AgentConcurrencyPolicy,
  AgentRunCoordinationAuditEvent,
  AgentRunCoordinationGroup,
  AgentRunCoordinationRecommendation,
  AgentRunCoordinationSummary,
  AgentSession,
  AgentSessionOverlap
} from "./coordination.ts";
import type { AgentRunnerRuntimeConfig } from "./config.ts";
export {
  editIntentGraphEdgeToDto,
  editIntentGraphNodeToDto,
  editIntentGraphToDto,
  editIntentOverlapSummaryToDto,
  editIntentToDto,
  editOverlapAssessmentToDto,
  fileLeaseToDto,
  sanitizeEditIntentFilePathForDto,
  sanitizeEditIntentMetadata
} from "./edit-intent.ts";
export {
  agentWorkspaceCleanupDecisionToDto,
  agentWorkspaceLeaseToDto,
  agentWorkspaceLifecycleEventToDto,
  sanitizeWorkspaceLifecycleMetadata,
  sanitizeWorkspacePathForDto
} from "./workspace-lifecycle.ts";
export {
  agentWorktreeAllocationRequestToDto,
  agentWorktreeAllocationResultToDto,
  agentWorktreeAllocationSummaryToDto,
  agentWorktreeSafetyCheckToDto
} from "./worktree-allocation.ts";
import { sanitizeWorkspaceLifecycleMetadata, sanitizeWorkspacePathForDto } from "./workspace-lifecycle.ts";

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
    rootPath: sanitizeWorkspacePathForDto(workspace.rootPath),
    rootPathRedacted: true,
    createdAt: workspace.createdAt.toISOString(),
    metadata: sanitizeWorkspaceLifecycleMetadata(workspace.metadata)
  };
}

export function agentSessionToDto(session: AgentSession) {
  return {
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  };
}

export function agentRunCoordinationGroupToDto(group: AgentRunCoordinationGroup) {
  return group;
}

export function agentSessionOverlapToDto(overlap: AgentSessionOverlap) {
  return overlap;
}

export function agentConcurrencyPolicyToDto(policy: AgentConcurrencyPolicy) {
  return policy;
}

export function agentRunCoordinationRecommendationToDto(recommendation: AgentRunCoordinationRecommendation) {
  return recommendation;
}

export function agentRunCoordinationSummaryToDto(summary: AgentRunCoordinationSummary) {
  return summary;
}

export function agentRunCoordinationAuditEventToDto(event: AgentRunCoordinationAuditEvent) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString()
  };
}
