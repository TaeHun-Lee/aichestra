import { createHash } from "node:crypto";
import { createId } from "@aichestra/core";
import type { RegistryVersionRef } from "@aichestra/core";
import type { AgentRunRequest, InstructionAssemblyResult } from "./agent-runner.ts";

function refLabel(ref: RegistryVersionRef): string {
  return `${ref.kind}:${ref.name}@${ref.version}:${ref.id ?? "unresolved"}:${ref.checksum ?? "no-checksum"}`;
}

export function computeInstructionSetHash(input: {
  selectedInstructionRefs: RegistryVersionRef[];
  selectedSkillRefs: RegistryVersionRef[];
  selectedHarnessRef: RegistryVersionRef;
  prompt: string;
}): string {
  const payload = JSON.stringify({
    instructions: input.selectedInstructionRefs.map(refLabel).sort(),
    skills: input.selectedSkillRefs.map(refLabel).sort(),
    harness: refLabel(input.selectedHarnessRef),
    prompt: input.prompt
  });
  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

export function assembleRunnerInstructions(request: AgentRunRequest): InstructionAssemblyResult {
  const warnings: string[] = [];
  if (request.selectedInstructionRefs.length === 0) {
    warnings.push("No instruction artifacts were selected for this agent run.");
  }
  if (request.selectedSkillRefs.length === 0) {
    warnings.push("No skill refs were selected for this agent run.");
  }

  return {
    id: createId("runner_instr"),
    taskId: request.taskId,
    taskRunId: request.taskRunId,
    selectedInstructionRefs: request.selectedInstructionRefs,
    selectedSkillRefs: request.selectedSkillRefs,
    selectedHarnessRef: request.selectedHarnessRef,
    instructionSetHash: computeInstructionSetHash({
      selectedInstructionRefs: request.selectedInstructionRefs,
      selectedSkillRefs: request.selectedSkillRefs,
      selectedHarnessRef: request.selectedHarnessRef,
      prompt: request.prompt
    }),
    warnings,
    createdAt: new Date()
  };
}
