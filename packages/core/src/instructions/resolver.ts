import { createHash } from "node:crypto";
import type { AgentKind, InstructionArtifact, InstructionSet } from "../domain/models.ts";
import { createId } from "../domain/ids.ts";

const scopeOrder = new Map([
  ["org", 10],
  ["team", 20],
  ["repo", 30],
  ["directory", 40],
  ["user", 50],
  ["task", 60]
]);

export type ResolveInstructionSetInput = {
  taskRunId: string;
  artifacts: InstructionArtifact[];
  agent: AgentKind;
  maxContextBytes?: number;
};

export function resolveInstructionArtifacts(input: ResolveInstructionSetInput): InstructionArtifact[] {
  return input.artifacts
    .filter((artifact) => artifact.status === "active")
    .filter((artifact) => artifact.approvalStatus === "not_required" || artifact.approvalStatus === "approved")
    .filter((artifact) => artifact.evalStatus === "not_required" || artifact.evalStatus === "passed")
    .filter((artifact) => artifact.checksumStatus !== "mismatch")
    .filter((artifact) => artifact.appliesToAgents.includes(input.agent))
    .sort((left, right) => {
      const precedence = left.precedence - right.precedence;
      if (precedence !== 0) return precedence;

      return (scopeOrder.get(left.scope) ?? 999) - (scopeOrder.get(right.scope) ?? 999);
    });
}

export function assembleInstructionSet(input: ResolveInstructionSetInput): InstructionSet {
  const maxContextBytes = input.maxContextBytes ?? 65536;
  const artifacts = resolveInstructionArtifacts(input);
  const assembled = artifacts
    .map((artifact) => `${artifact.id}@${artifact.version}:${artifact.checksum}:${artifact.body ?? artifact.path ?? ""}`)
    .join("\n---\n");
  const assembledHash = `sha256:${createHash("sha256").update(assembled).digest("hex")}`;

  return {
    id: createId("iset"),
    taskRunId: input.taskRunId,
    artifacts: artifacts.map((artifact) => ({
      artifactId: artifact.id,
      version: artifact.version,
      contentHash: artifact.checksum,
      source: artifact.path ?? artifact.scope
    })),
    assembledHash,
    maxContextBytes,
    createdAt: new Date()
  };
}
