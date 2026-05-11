import test from "node:test";
import assert from "node:assert/strict";
import { resolveInstructionArtifacts } from "@aichestra/core";
import type { InstructionArtifact } from "@aichestra/core";

function artifact(input: Partial<InstructionArtifact> & Pick<InstructionArtifact, "id" | "scope" | "precedence">): InstructionArtifact {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: input.id,
    name: input.id,
    type: input.type ?? "custom",
    scope: input.scope,
    checksum: `sha256:${input.id}`,
    version: "1.0.0",
    description: `${input.id} instruction`,
    status: input.status ?? "active",
    approvalStatus: input.approvalStatus ?? "approved",
    evalStatus: input.evalStatus ?? "passed",
    owner: "test",
    appliesToAgents: input.appliesToAgents ?? ["codex"],
    appliesToRepos: input.appliesToRepos ?? [],
    appliesToDirectories: input.appliesToDirectories ?? [],
    maxContextBytes: input.maxContextBytes ?? 1024,
    checksumAlgorithm: input.checksumAlgorithm ?? "sha256",
    checksumStatus: input.checksumStatus ?? "unverified",
    precedence: input.precedence,
    body: input.body,
    createdAt: now,
    updatedAt: now
  };
}

test("instruction resolver applies status, agent filtering, precedence, and scope order", () => {
  const resolved = resolveInstructionArtifacts({
    taskRunId: "run_1",
    agent: "codex",
    artifacts: [
      artifact({ id: "task", scope: "task", precedence: 50 }),
      artifact({ id: "repo", scope: "repo", precedence: 30 }),
      artifact({ id: "draft", scope: "org", precedence: 5, status: "draft" }),
      artifact({ id: "other-agent", scope: "team", precedence: 20, appliesToAgents: ["aider"] }),
      artifact({ id: "org", scope: "org", precedence: 10 }),
      artifact({ id: "team", scope: "team", precedence: 10 })
    ]
  });

  assert.deepEqual(resolved.map((item) => item.id), ["org", "team", "repo", "task"]);
});
