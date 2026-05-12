import { spawn } from "node:child_process";
import path from "node:path";
import { createId } from "@aichestra/core";
import type {
  CommandExecutionRequest,
  CommandExecutionResult,
  CommandExecutor,
  CommandExecutorKind,
  CommandValidationResult
} from "./agent-runner.ts";

const defaultPreviewLimitBytes = 4_096;
const shellMetacharacters = /[|;&<>`$]/;
const blockedExecutableNames = new Set([
  "curl",
  "curl.exe",
  "wget",
  "wget.exe",
  "git",
  "git.exe",
  "kubectl",
  "kubectl.exe",
  "vault",
  "vault.exe",
  "temporal",
  "temporal.exe",
  "mcp",
  "mcp.exe",
  "rm",
  "rm.exe",
  "rmdir",
  "rmdir.exe",
  "del",
  "remove-item",
  "powershell",
  "powershell.exe",
  "pwsh",
  "pwsh.exe",
  "cmd",
  "cmd.exe",
  "bash",
  "bash.exe",
  "sh",
  "sh.exe"
]);
const allowedFixtureExecutables = new Set(["node", "node.exe", "pnpm", "pnpm.cmd"]);

function executableName(command: string): string {
  return path.basename(command).toLowerCase();
}

function commandSignature(command: string, args: string[]): string {
  return [executableName(command), ...args].join(" ").trim();
}

function fullCommandText(command: string, args: string[]): string {
  return [command, ...args].join(" ").trim();
}

function isDeniedByHarness(text: string, deniedCommands: string[]): boolean {
  const lower = text.toLowerCase();
  return deniedCommands.some((denied) => lower.includes(denied.toLowerCase()));
}

function isAllowedByHarness(command: string, args: string[], allowedCommands: string[]): boolean {
  if (allowedCommands.length === 0) return false;
  const signature = commandSignature(command, args).toLowerCase();
  const full = fullCommandText(command, args).toLowerCase();
  const base = executableName(command);
  return allowedCommands.some((allowed) => {
    const normalized = allowed.toLowerCase().trim();
    return normalized === signature || normalized === full || normalized === base;
  });
}

function sanitizePreview(input: string): string {
  return input
    .replace(/([A-Z0-9_]*(?:TOKEN|SECRET|KEY)[A-Z0-9_]*=)[^\s]+/gi, "$1[redacted]")
    .replace(/\r\n/g, "\n");
}

function preview(buffer: Buffer, limitBytes: number): string {
  return sanitizePreview(buffer.subarray(0, Math.max(0, limitBytes)).toString("utf8"));
}

function envForRequest(request: CommandExecutionRequest): NodeJS.ProcessEnv {
  if (request.envPolicy.allowInheritedEnv) {
    const clone: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (/token|secret|key/i.test(key)) continue;
      clone[key] = value;
    }
    return clone;
  }

  const env: NodeJS.ProcessEnv = {};
  for (const key of request.envPolicy.allowedEnvKeys) {
    if (/token|secret|key/i.test(key)) continue;
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return env;
}

function resultFromValidation(
  request: CommandExecutionRequest,
  executorKind: CommandExecutorKind,
  validation: CommandValidationResult,
  startedAt: number
): CommandExecutionResult {
  return {
    id: createId("cmd"),
    taskId: request.taskId,
    taskRunId: request.taskRunId,
    agentRunId: request.agentRunId,
    executorKind,
    status: "blocked",
    command: request.command,
    args: [...request.args],
    stdoutPreview: "",
    stderrPreview: "",
    stdoutBytes: 0,
    stderrBytes: 0,
    durationMs: Date.now() - startedAt,
    blockedReason: validation.blockedReason ?? validation.reason,
    createdAt: new Date(),
    metadata: {
      validationReason: validation.reason,
      externalCalls: false,
      shellExecution: false
    }
  };
}

export class BlockedCommandExecutor implements CommandExecutor {
  getExecutorKind(): CommandExecutorKind {
    return "blocked";
  }

  async validateCommand(request: CommandExecutionRequest): Promise<CommandValidationResult> {
    return {
      allowed: false,
      reason: "command_executor_blocked",
      normalizedCommand: commandSignature(request.command, request.args),
      blockedReason: "local_command_execution_disabled"
    };
  }

  async executeCommand(request: CommandExecutionRequest): Promise<CommandExecutionResult> {
    const startedAt = Date.now();
    return resultFromValidation(request, "blocked", await this.validateCommand(request), startedAt);
  }
}

export type FixtureLocalCommandExecutorConfig = {
  enabled: boolean;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
};

export class FixtureLocalCommandExecutor implements CommandExecutor {
  private readonly enabled: boolean;
  private readonly maxStdoutBytes: number;
  private readonly maxStderrBytes: number;

  constructor(config: FixtureLocalCommandExecutorConfig = { enabled: false }) {
    this.enabled = config.enabled;
    this.maxStdoutBytes = config.maxStdoutBytes ?? defaultPreviewLimitBytes;
    this.maxStderrBytes = config.maxStderrBytes ?? defaultPreviewLimitBytes;
  }

  getExecutorKind(): CommandExecutorKind {
    return "fixture_local";
  }

  async validateCommand(request: CommandExecutionRequest): Promise<CommandValidationResult> {
    const normalizedCommand = commandSignature(request.command, request.args);
    const fullText = fullCommandText(request.command, request.args);
    if (!this.enabled) {
      return {
        allowed: false,
        reason: "fixture_local_executor_disabled",
        normalizedCommand,
        blockedReason: "local_command_execution_disabled"
      };
    }
    if (shellMetacharacters.test(request.command) || request.args.some((arg) => shellMetacharacters.test(arg))) {
      return {
        allowed: false,
        reason: "shell_syntax_not_allowed",
        normalizedCommand,
        blockedReason: "shell_execution_not_allowed"
      };
    }
    if (blockedExecutableNames.has(executableName(request.command))) {
      return {
        allowed: false,
        reason: "unsafe_executable_blocked",
        normalizedCommand,
        blockedReason: "unsafe_command_blocked"
      };
    }
    if (!allowedFixtureExecutables.has(executableName(request.command)) && path.resolve(request.command) !== process.execPath) {
      return {
        allowed: false,
        reason: "fixture_executor_command_not_supported",
        normalizedCommand,
        blockedReason: "unsupported_fixture_command"
      };
    }
    if (isDeniedByHarness(fullText, request.deniedCommands) || isDeniedByHarness(normalizedCommand, request.deniedCommands)) {
      return {
        allowed: false,
        reason: "command_denied_by_harness_policy",
        normalizedCommand,
        blockedReason: "denied_command"
      };
    }
    if (!isAllowedByHarness(request.command, request.args, request.allowedCommands)) {
      return {
        allowed: false,
        reason: "command_not_allowed_by_harness_policy",
        normalizedCommand,
        blockedReason: "command_not_allowed"
      };
    }
    return {
      allowed: true,
      reason: "command_allowed",
      normalizedCommand
    };
  }

  async executeCommand(request: CommandExecutionRequest): Promise<CommandExecutionResult> {
    const startedAt = Date.now();
    const validation = await this.validateCommand(request);
    if (!validation.allowed) {
      return resultFromValidation(request, "fixture_local", validation, startedAt);
    }

    return new Promise<CommandExecutionResult>((resolve) => {
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let settled = false;
      const timeoutMs = Math.max(1, request.timeoutMs);
      const child = spawn(request.command, request.args, {
        cwd: request.workspacePath,
        env: envForRequest(request),
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"]
      });

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill();
        const stdout = Buffer.concat(stdoutChunks);
        const stderr = Buffer.concat(stderrChunks);
        resolve({
          id: createId("cmd"),
          taskId: request.taskId,
          taskRunId: request.taskRunId,
          agentRunId: request.agentRunId,
          executorKind: "fixture_local",
          status: "timed_out",
          command: request.command,
          args: [...request.args],
          stdoutPreview: preview(stdout, this.maxStdoutBytes),
          stderrPreview: preview(stderr, this.maxStderrBytes),
          stdoutBytes: stdout.byteLength,
          stderrBytes: stderr.byteLength,
          durationMs: Date.now() - startedAt,
          blockedReason: "command_timed_out",
          createdAt: new Date(),
          metadata: {
            normalizedCommand: validation.normalizedCommand,
            externalCalls: false,
            shellExecution: false
          }
        });
      }, timeoutMs);

      child.stdout?.on("data", (chunk) => stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      child.stderr?.on("data", (chunk) => stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve({
          id: createId("cmd"),
          taskId: request.taskId,
          taskRunId: request.taskRunId,
          agentRunId: request.agentRunId,
          executorKind: "fixture_local",
          status: "failed",
          command: request.command,
          args: [...request.args],
          stdoutPreview: "",
          stderrPreview: sanitizePreview(error.message),
          stdoutBytes: 0,
          stderrBytes: Buffer.byteLength(error.message),
          durationMs: Date.now() - startedAt,
          createdAt: new Date(),
          metadata: {
            normalizedCommand: validation.normalizedCommand,
            externalCalls: false,
            shellExecution: false
          }
        });
      });
      child.on("close", (exitCode) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        const stdout = Buffer.concat(stdoutChunks);
        const stderr = Buffer.concat(stderrChunks);
        resolve({
          id: createId("cmd"),
          taskId: request.taskId,
          taskRunId: request.taskRunId,
          agentRunId: request.agentRunId,
          executorKind: "fixture_local",
          status: exitCode === 0 ? "completed" : "failed",
          command: request.command,
          args: [...request.args],
          exitCode: exitCode ?? undefined,
          stdoutPreview: preview(stdout, this.maxStdoutBytes),
          stderrPreview: preview(stderr, this.maxStderrBytes),
          stdoutBytes: stdout.byteLength,
          stderrBytes: stderr.byteLength,
          durationMs: Date.now() - startedAt,
          createdAt: new Date(),
          metadata: {
            normalizedCommand: validation.normalizedCommand,
            externalCalls: false,
            shellExecution: false
          }
        });
      });
    });
  }
}
