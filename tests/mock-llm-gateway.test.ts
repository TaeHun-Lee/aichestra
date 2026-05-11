import test from "node:test";
import assert from "node:assert/strict";
import { MockLlmGateway } from "@aichestra/adapters";

test("mock LLM gateway records required usage metadata without external calls", async () => {
  const gateway = new MockLlmGateway();
  const result = await gateway.complete({
    taskId: "task_123",
    taskRunId: "run_456",
    userId: "user_demo_admin",
    repoId: "repo_demo_backend",
    branch: "ai/task_123/codex/fix-login-timeout",
    agent: "codex",
    model: "mock-model",
    prompt: "Fix login timeout bug",
    skillVersions: ["auth-debugging@1.0.0"],
    harnessVersion: "backend-node20@1.0.0",
    instructionSetHash: "sha256:demo"
  });

  assert.equal(result.usage.provider, "mock");
  assert.equal(result.usage.eventType, "llm_call");
  assert.equal(result.usage.metadata?.task_id, "task_123");
  assert.equal(result.usage.metadata?.repo_id, "repo_demo_backend");
  assert.equal(result.usage.metadata?.instruction_set_hash, "sha256:demo");
  assert.equal(result.text.includes("mock-model"), true);
});
