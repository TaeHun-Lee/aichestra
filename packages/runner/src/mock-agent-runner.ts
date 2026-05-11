import { MockLlmGateway } from "@aichestra/llm-gateway";
import type { LlmGateway } from "@aichestra/llm-gateway";
import type { AgentRunInput, AgentRunResult, AgentRunner } from "./agent-runner.ts";

export class MockAgentRunner implements AgentRunner {
  private llmGateway: LlmGateway;

  constructor(llmGateway: LlmGateway = new MockLlmGateway()) {
    this.llmGateway = llmGateway;
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const completion = await this.llmGateway.complete({
      ...input,
      instructionSetHash: input.instructionSet.assembledHash
    });
    const lowerPrompt = input.prompt.toLowerCase();
    let changedFiles = ["src/app.ts"];
    if (lowerPrompt.includes("login") || lowerPrompt.includes("auth") || lowerPrompt.includes("session")) {
      changedFiles = ["src/auth/session.ts", "tests/auth/session.test.ts"];
    } else if (lowerPrompt.includes("payment")) {
      changedFiles = ["src/payments/service.ts", "tests/payments/service.test.ts"];
    } else if (lowerPrompt.includes("infra")) {
      changedFiles = ["infra/app.tf"];
    }

    const shouldFail = /\b(mock-fail|force-fail|fail-task)\b/.test(lowerPrompt);

    return {
      summary: `Mock agent generated a patch plan for ${input.prompt}.`,
      changedFiles,
      diffSummary: `${changedFiles.length} files changed, 18 insertions, 4 deletions`,
      usage: completion.usage,
      testsPassed: !shouldFail
    };
  }
}
