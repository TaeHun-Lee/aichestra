import { LocalAgentRunner } from "./local-agent-runner.ts";
import type { LocalAgentRunnerDependencies } from "./local-agent-runner.ts";
import { MockAgentRunner } from "./mock-agent-runner.ts";
import type { AgentRunner, AgentRunnerKind, CommandExecutorKind } from "./agent-runner.ts";

export type AgentRunnerRuntimeConfig = {
  runnerKind: Extract<AgentRunnerKind, "mock" | "local">;
  localRunnerEnabled: boolean;
  localCommandExecutionEnabled: boolean;
  workspaceRootConfigured: boolean;
  workspaceRoot?: string;
  maxRuntimeMs: number;
  commandExecutorKind: CommandExecutorKind;
  maxStdoutBytes: number;
  maxStderrBytes: number;
};

function flag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function runnerKindFromEnv(value: string | undefined): AgentRunnerRuntimeConfig["runnerKind"] {
  return value === "local" ? "local" : "mock";
}

export function createAgentRunnerConfigFromEnv(env: Record<string, string | undefined> = process.env): AgentRunnerRuntimeConfig {
  const workspaceRoot = env.AICHESTRA_AGENT_WORKSPACE_ROOT;
  return {
    runnerKind: runnerKindFromEnv(env.AICHESTRA_AGENT_RUNNER),
    localRunnerEnabled: flag(env.AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER),
    localCommandExecutionEnabled: flag(env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION),
    workspaceRootConfigured: typeof workspaceRoot === "string" && workspaceRoot.length > 0,
    workspaceRoot,
    maxRuntimeMs: Number(env.AICHESTRA_AGENT_MAX_RUNTIME_MS ?? 60_000),
    commandExecutorKind: flag(env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION) ? "fixture_local" : "blocked",
    maxStdoutBytes: Number(env.AICHESTRA_AGENT_MAX_STDOUT_BYTES ?? 4_096),
    maxStderrBytes: Number(env.AICHESTRA_AGENT_MAX_STDERR_BYTES ?? 4_096)
  };
}

export function createAgentRunnerFromConfig(config: AgentRunnerRuntimeConfig, dependencies: LocalAgentRunnerDependencies = {}): AgentRunner {
  if (config.runnerKind === "local") {
    return new LocalAgentRunner({
      enabled: config.localRunnerEnabled,
      allowCommandExecution: config.localCommandExecutionEnabled,
      workspaceRoot: config.workspaceRoot,
      maxRuntimeMs: config.maxRuntimeMs,
      maxStdoutBytes: config.maxStdoutBytes,
      maxStderrBytes: config.maxStderrBytes
    }, dependencies);
  }
  return new MockAgentRunner();
}

export function createAgentRunnerFromEnv(env: Record<string, string | undefined> = process.env): {
  runner: AgentRunner;
  config: AgentRunnerRuntimeConfig;
} {
  const config = createAgentRunnerConfigFromEnv(env);
  return {
    runner: createAgentRunnerFromConfig(config),
    config
  };
}
