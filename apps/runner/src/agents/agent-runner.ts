import type { AgentKind, InstructionSet } from "@aichestra/core";

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
  testsPassed: boolean;
};

export type AgentRunner = {
  run(input: AgentRunInput): Promise<AgentRunResult>;
};
