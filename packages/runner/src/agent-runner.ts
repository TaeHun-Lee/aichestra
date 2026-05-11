import type { AgentKind, InstructionSet, UsageEvent } from "@aichestra/core";

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
};

export type AgentRunner = {
  run(input: AgentRunInput): Promise<AgentRunResult>;
};
