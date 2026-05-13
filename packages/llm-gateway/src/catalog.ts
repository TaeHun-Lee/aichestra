import type { Task } from "@aichestra/core";
import type { LLMModel, LLMModelStatus, LLMProviderKind } from "./types.ts";
import { seedLlmModels } from "./providers.ts";

export type ModelCatalogRepository = {
  listModels(): LLMModel[];
  getModel(id: string): LLMModel | undefined;
  registerModel(input: Omit<LLMModel, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): LLMModel;
  updateModelStatus(id: string, status: LLMModelStatus): LLMModel;
};

export class InMemoryModelCatalogRepository implements ModelCatalogRepository {
  private readonly models = new Map<string, LLMModel>();

  constructor(seed: LLMModel[] = seedLlmModels()) {
    for (const model of seed) {
      this.models.set(model.id, structuredClone(model));
    }
  }

  listModels(): LLMModel[] {
    return [...this.models.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  getModel(id: string): LLMModel | undefined {
    return this.models.get(id);
  }

  registerModel(input: Omit<LLMModel, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): LLMModel {
    if (this.models.has(input.id)) {
      throw new Error(`LLM model already exists: ${input.id}`);
    }
    const now = new Date();
    const model: LLMModel = {
      ...input,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    };
    this.models.set(model.id, model);
    return model;
  }

  updateModelStatus(id: string, status: LLMModelStatus): LLMModel {
    const model = this.getModel(id);
    if (!model) {
      throw new Error(`LLM model not found: ${id}`);
    }
    const updated = {
      ...model,
      status,
      updatedAt: new Date()
    };
    this.models.set(id, updated);
    return updated;
  }
}

export class ModelCatalogService {
  private readonly repository: ModelCatalogRepository;

  constructor(repository: ModelCatalogRepository = new InMemoryModelCatalogRepository()) {
    this.repository = repository;
  }

  listModels(): LLMModel[] {
    return this.repository.listModels();
  }

  getModel(id: string): LLMModel | undefined {
    return this.repository.getModel(id);
  }

  registerModel(input: Omit<LLMModel, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): LLMModel {
    validateModel(input);
    return this.repository.registerModel(input);
  }

  updateModelStatus(id: string, status: LLMModelStatus): LLMModel {
    if (!isLlmModelStatus(status)) {
      throw new Error(`Invalid LLM model status: ${status}`);
    }
    return this.repository.updateModelStatus(id, status);
  }

  resolveModelForTask(input: { task?: Task; prompt?: string; requestedModelId?: string; providerKind?: LLMProviderKind }): { model?: LLMModel; warnings: string[]; errors: string[] } {
    const warnings: string[] = [];
    const errors: string[] = [];
    if (input.requestedModelId) {
      const requested = this.repository.getModel(input.requestedModelId);
      if (!requested) {
        errors.push(`Model ${input.requestedModelId} is not registered.`);
        return { warnings, errors };
      }
      if (input.providerKind && requested.providerKind !== input.providerKind) {
        errors.push(`Model ${requested.id} does not match provider ${input.providerKind}.`);
        return { warnings, errors };
      }
      if (!isSelectableModel(requested)) {
        warnings.push(`Model ${requested.id} excluded: status is ${requested.status}.`);
        errors.push(`No selectable model satisfies ${requested.id}.`);
        return { warnings, errors };
      }
      return { model: requested, warnings, errors };
    }

    const text = `${input.task?.title ?? ""} ${input.task?.description ?? ""} ${input.prompt ?? ""}`.toLowerCase();
    const preferredId = input.task?.selectedModel;
    const candidates = [
      preferredId,
      text.includes("conflict") ? "mock-conflict-resolver@1.0" : undefined,
      text.includes("registry") ? "mock-registry-reviewer@1.0" : undefined,
      text.includes("code") || text.includes("fix") || text.includes("bug") ? "mock-coder@1.0" : undefined,
      input.providerKind === "openai_compatible" ? "openai-compatible/default" : undefined,
      "mock-model",
      "mock-small@1.0"
    ].filter((id): id is string => typeof id === "string");

    for (const id of candidates) {
      const model = this.repository.getModel(id);
      if (!model) continue;
      if (input.providerKind && model.providerKind !== input.providerKind) continue;
      if (isSelectableModel(model)) {
        return { model, warnings, errors };
      }
      warnings.push(`Model ${model.id} excluded: status is ${model.status}.`);
    }

    errors.push("No selectable model is available.");
    return { warnings, errors };
  }
}

export function isSelectableModel(model: LLMModel): boolean {
  return model.status === "active";
}

export function isLlmModelStatus(value: unknown): value is LLMModelStatus {
  return value === "active" || value === "disabled" || value === "deprecated";
}

export function isLlmProviderKind(value: unknown): value is LLMProviderKind {
  return value === "mock" ||
    value === "openai_compatible" ||
    value === "anthropic_compatible" ||
    value === "gemini_compatible" ||
    value === "bedrock_compatible" ||
    value === "vertex_compatible" ||
    value === "azure_compatible" ||
    value === "litellm_compatible" ||
    value === "local_cli" ||
    value === "local" ||
    value === "custom";
}

function validateModel(input: Omit<LLMModel, "createdAt" | "updatedAt">): void {
  if (!input.id || !input.displayName || !isLlmProviderKind(input.providerKind) || !isLlmModelStatus(input.status)) {
    throw new Error("LLM model requires id, displayName, providerKind, and status.");
  }
}
