import type { McpGateway } from "../interfaces.ts";

export class MockMcpGateway implements McpGateway {
  async callTool(input: { toolName: string; arguments: Record<string, unknown>; taskId?: string }): Promise<{ result: Record<string, unknown> }> {
    return {
      result: {
        provider: "mock-mcp",
        toolName: input.toolName,
        taskId: input.taskId,
        arguments: input.arguments
      }
    };
  }
}
