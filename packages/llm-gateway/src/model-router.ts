import type { AgentKind, ModelSelection, SkillPackage, Task } from "@aichestra/core";

export type ModelSelectionInput = {
  task: Task;
  agent: AgentKind;
  skills: SkillPackage[];
  preferredModel?: string;
};

export type ModelRouter = {
  selectModel(input: ModelSelectionInput): Promise<ModelSelection>;
};

export class MockModelRouter implements ModelRouter {
  async selectModel(input: ModelSelectionInput): Promise<ModelSelection> {
    return {
      provider: "mock",
      model: input.preferredModel ?? input.task.selectedModel ?? "mock-model",
      reason: `Selected deterministic mock model for ${input.agent} with ${input.skills.length} skill package(s).`
    };
  }
}
