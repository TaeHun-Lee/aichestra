import { MockLlmGateway } from "@aichestra/adapters";
import type { LlmGateway } from "@aichestra/adapters";
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

    return {
      summary: completion.text,
      testsPassed: !input.prompt.toLowerCase().includes("fail")
    };
  }
}
