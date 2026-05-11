import type { AgentKind, ModelSelection, SkillPackage, Task } from "@aichestra/core";
import { ModelCatalogService } from "./catalog.ts";
import { providerKindToModelProvider } from "./types.ts";

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

export class CatalogModelRouter implements ModelRouter {
  private readonly modelCatalog: ModelCatalogService;

  constructor(modelCatalog = new ModelCatalogService()) {
    this.modelCatalog = modelCatalog;
  }

  async selectModel(input: ModelSelectionInput): Promise<ModelSelection> {
    const resolution = this.modelCatalog.resolveModelForTask({
      task: input.task,
      requestedModelId: input.preferredModel
    });
    const model = resolution.model;
    if (!model) {
      return {
        provider: "mock",
        model: input.preferredModel ?? input.task.selectedModel ?? "mock-model",
        reason: resolution.errors.join(" ") || "Fell back to deterministic mock model."
      };
    }
    return {
      provider: providerKindToModelProvider(model.providerKind),
      model: model.id,
      reason: `Selected ${model.id} from the deterministic LLM model catalog for ${input.agent}.`
    };
  }
}
