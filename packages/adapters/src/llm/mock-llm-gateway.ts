import type { LlmCallInput, LlmCallResult, LlmGateway } from "../interfaces.ts";

export class MockLlmGateway implements LlmGateway {
  async complete(input: LlmCallInput): Promise<LlmCallResult> {
    const inputTokens = Math.ceil(input.prompt.length / 4);
    const outputTokens = 64;

    return {
      text: `Mock completion for ${input.taskId} using ${input.model}.`,
      usage: {
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        userId: input.userId,
        repoId: input.repoId,
        provider: "mock",
        model: input.model,
        eventType: "llm_call",
        inputTokens,
        outputTokens,
        costUsd: 0.001,
        latencyMs: 12,
        skillVersion: input.skillVersions.join(","),
        harnessVersion: input.harnessVersion,
        metadata: {
          task_id: input.taskId,
          task_run_id: input.taskRunId,
          repo_id: input.repoId,
          branch: input.branch,
          agent: input.agent,
          model: input.model,
          skill_versions: input.skillVersions.join(","),
          harness_version: input.harnessVersion,
          instruction_set_hash: input.instructionSetHash
        }
      }
    };
  }
}
