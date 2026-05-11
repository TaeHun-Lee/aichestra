import { assembleInstructionSet } from "@aichestra/core";
import type { AgentKind, InstructionArtifact } from "@aichestra/core";

export function loadInstructionSet(input: {
  taskRunId: string;
  agent: AgentKind;
  artifacts: InstructionArtifact[];
}) {
  return assembleInstructionSet({
    taskRunId: input.taskRunId,
    agent: input.agent,
    artifacts: input.artifacts
  });
}
