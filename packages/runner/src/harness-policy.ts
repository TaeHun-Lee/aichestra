import type { HarnessPackage } from "@aichestra/core";

export type RunnerHarnessPolicy = {
  allowedCommands: string[];
  deniedCommands: string[];
  testCommands: string[];
  maxRuntimeMs: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
  allowNetwork: boolean;
  allowFileWrite: boolean;
  allowGitRemote: boolean;
  allowSecrets: boolean;
  secretScopes: string[];
  cleanupPolicy: "none" | "delete_temp_workspace";
};

export type RunnerHarnessPolicyDecision = {
  allowed: boolean;
  reason: string;
  blockedCommands: string[];
};

const defaultDeniedCommands = [
  "git fetch",
  "git push",
  "git merge",
  "git rebase",
  "rm -rf",
  "rmdir",
  "del ",
  "remove-item",
  "curl ",
  "wget ",
  "kubectl",
  "vault",
  "temporal",
  "mcp"
];

export function createRunnerHarnessPolicy(input: {
  harness?: Pick<HarnessPackage, "allowedTools" | "testCommands" | "networkPolicy" | "secretScopes">;
  allowedCommands?: string[];
  deniedCommands?: string[];
  maxRuntimeMs?: number;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
  allowFileWrite?: boolean;
  allowSecrets?: boolean;
  cleanupPolicy?: RunnerHarnessPolicy["cleanupPolicy"];
} = {}): RunnerHarnessPolicy {
  const allowedTools = input.harness?.allowedTools ?? [];
  const testCommands = input.harness?.testCommands ?? [];
  return {
    allowedCommands: input.allowedCommands ?? [...allowedTools, ...testCommands],
    deniedCommands: input.deniedCommands ?? defaultDeniedCommands,
    testCommands,
    maxRuntimeMs: input.maxRuntimeMs ?? 60_000,
    maxStdoutBytes: input.maxStdoutBytes ?? 4_096,
    maxStderrBytes: input.maxStderrBytes ?? 4_096,
    allowNetwork: input.harness?.networkPolicy.mode === "unrestricted",
    allowFileWrite: input.allowFileWrite ?? false,
    allowGitRemote: false,
    allowSecrets: input.allowSecrets ?? false,
    secretScopes: input.harness?.secretScopes ?? [],
    cleanupPolicy: input.cleanupPolicy ?? "none"
  };
}

export function evaluateRunnerHarnessPolicy(
  policy: RunnerHarnessPolicy,
  requestedCommands: string[]
): RunnerHarnessPolicyDecision {
  const normalizedDenied = policy.deniedCommands.map((command) => command.toLowerCase());
  const blockedCommands = requestedCommands.filter((command) => {
    const normalized = command.toLowerCase();
    return normalizedDenied.some((denied) => normalized.includes(denied));
  });

  if (blockedCommands.length > 0) {
    return {
      allowed: false,
      reason: "runner_command_denied_by_harness_policy",
      blockedCommands
    };
  }

  if (!policy.allowNetwork && requestedCommands.some((command) => /\b(curl|wget|fetch)\b/i.test(command))) {
    return {
      allowed: false,
      reason: "runner_network_disabled_by_harness_policy",
      blockedCommands: requestedCommands.filter((command) => /\b(curl|wget|fetch)\b/i.test(command))
    };
  }

  if (!policy.allowGitRemote && requestedCommands.some((command) => /\bgit\s+(fetch|push|merge|rebase)\b/i.test(command))) {
    return {
      allowed: false,
      reason: "runner_remote_git_disabled_by_harness_policy",
      blockedCommands: requestedCommands.filter((command) => /\bgit\s+(fetch|push|merge|rebase)\b/i.test(command))
    };
  }

  return {
    allowed: true,
    reason: "runner_harness_policy_allowed",
    blockedCommands: []
  };
}
