import { createId } from "@aichestra/core";
import type {
  LLMCompletionRequest,
  LLMModel,
  LLMProvider,
  LLMProviderCompletionResult,
  LLMProviderKind,
  LLMProviderRuntimeConfig,
  LLMProviderValidation
} from "./types.ts";

export function estimatePromptTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateCompletionCost(model: LLMModel, inputTokens: number, outputTokens: number): number {
  const inputCost = (model.inputTokenCostUsd ?? 0.000001) * inputTokens;
  const outputCost = (model.outputTokenCostUsd ?? 0.000002) * outputTokens;
  return Number((inputCost + outputCost).toFixed(6));
}

export class MockLLMProvider implements LLMProvider {
  private readonly unavailable: boolean;

  constructor(input: { unavailable?: boolean } = {}) {
    this.unavailable = input.unavailable ?? false;
  }

  getProviderKind(): LLMProviderKind {
    return "mock";
  }

  async validateConnection(): Promise<LLMProviderValidation> {
    return this.unavailable
      ? { ok: false, providerKind: "mock", reason: "mock_provider_unavailable" }
      : { ok: true, providerKind: "mock" };
  }

  async listModels(): Promise<LLMModel[]> {
    return seedLlmModels().filter((model) => model.providerKind === "mock");
  }

  async estimateUsage(request: LLMCompletionRequest, model: LLMModel) {
    const inputTokens = estimatePromptTokens(`${request.systemInstructions ?? ""}\n${request.prompt}`);
    const outputTokens = Math.min(request.maxTokens ?? 96, 96);
    return {
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCompletionCost(model, inputTokens, outputTokens)
    };
  }

  async createCompletion(request: LLMCompletionRequest, model: LLMModel): Promise<LLMProviderCompletionResult> {
    if (this.unavailable || request.metadata?.simulateProviderUnavailable === true) {
      return { ok: false, reason: "mock_provider_unavailable" };
    }
    if (model.status !== "active" || request.metadata?.simulateModelDisabled === true) {
      return { ok: false, reason: "model_disabled" };
    }
    const usage = await this.estimateUsage(request, model);
    return {
      ok: true,
      result: {
        id: createId("llmreq"),
        providerKind: "mock",
        modelId: model.id,
        content: `Mock LLM Gateway completion for ${request.taskId} using ${model.id}.`,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCostUsd: usage.estimatedCostUsd,
        finishReason: "stop",
        latencyMs: 12,
        createdAt: new Date(),
        metadata: {
          source: "llm_gateway",
          task_id: request.taskId,
          task_run_id: request.taskRunId,
          virtual_key_id: request.virtualKeyId,
          provider_kind: "mock"
        }
      }
    };
  }
}

export type OpenAICompatibleProviderInput = {
  remoteLlmEnabled?: boolean;
  remoteCompletionEnabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
};

export class OpenAICompatibleLLMProvider implements LLMProvider {
  private readonly remoteLlmEnabled: boolean;
  private readonly remoteCompletionEnabled: boolean;
  private readonly baseUrl?: string;
  private readonly apiKey?: string;

  constructor(input: OpenAICompatibleProviderInput = {}) {
    this.remoteLlmEnabled = input.remoteLlmEnabled ?? false;
    this.remoteCompletionEnabled = input.remoteCompletionEnabled ?? false;
    this.baseUrl = input.baseUrl;
    this.apiKey = input.apiKey;
  }

  getProviderKind(): LLMProviderKind {
    return "openai_compatible";
  }

  async validateConnection(): Promise<LLMProviderValidation> {
    if (!this.remoteLlmEnabled) {
      return { ok: false, providerKind: "openai_compatible", reason: "blocked_remote_llm_disabled" };
    }
    if (!this.baseUrl || !this.apiKey) {
      return { ok: false, providerKind: "openai_compatible", reason: "openai_compatible_config_missing" };
    }
    return { ok: false, providerKind: "openai_compatible", reason: "openai_compatible_not_implemented" };
  }

  async listModels(): Promise<LLMModel[]> {
    return seedLlmModels().filter((model) => model.providerKind === "openai_compatible");
  }

  async estimateUsage(request: LLMCompletionRequest, model: LLMModel) {
    const inputTokens = estimatePromptTokens(`${request.systemInstructions ?? ""}\n${request.prompt}`);
    const outputTokens = Math.min(request.maxTokens ?? 96, 96);
    return {
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCompletionCost(model, inputTokens, outputTokens)
    };
  }

  async createCompletion(_request?: LLMCompletionRequest, _model?: LLMModel): Promise<LLMProviderCompletionResult> {
    if (!this.remoteLlmEnabled) {
      return { ok: false, reason: "blocked_remote_llm_disabled" };
    }
    if (!this.remoteCompletionEnabled) {
      return { ok: false, reason: "remote_llm_completion_disabled" };
    }
    if (!this.baseUrl || !this.apiKey) {
      return { ok: false, reason: "openai_compatible_config_missing" };
    }
    return { ok: false, reason: "openai_compatible_not_implemented" };
  }
}

export function createLlmProviderConfigFromEnv(env: Record<string, string | undefined> = process.env): LLMProviderRuntimeConfig {
  const providerKind = env.AICHESTRA_LLM_PROVIDER === "openai_compatible" ? "openai_compatible" : "mock";
  return {
    providerKind,
    remoteLlmEnabled: env.AICHESTRA_ENABLE_REMOTE_LLM === "true",
    remoteCompletionEnabled: env.AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION === "true",
    openAICompatibleConfigured: Boolean(env.AICHESTRA_LLM_API_KEY),
    baseUrlConfigured: Boolean(env.AICHESTRA_LLM_BASE_URL)
  };
}

export function createLlmProviderFromConfig(config: LLMProviderRuntimeConfig, env: Record<string, string | undefined> = process.env): LLMProvider {
  if (config.providerKind === "openai_compatible") {
    return new OpenAICompatibleLLMProvider({
      remoteLlmEnabled: config.remoteLlmEnabled,
      remoteCompletionEnabled: config.remoteCompletionEnabled,
      baseUrl: env.AICHESTRA_LLM_BASE_URL,
      apiKey: env.AICHESTRA_LLM_API_KEY
    });
  }
  return new MockLLMProvider();
}

export function createLlmProviderFromEnv(env: Record<string, string | undefined> = process.env) {
  const config = createLlmProviderConfigFromEnv(env);
  return {
    config,
    provider: createLlmProviderFromConfig(config, env)
  };
}

export function seedLlmModels(): LLMModel[] {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return [
    {
      id: "mock-model",
      providerKind: "mock",
      displayName: "Mock Model",
      contextWindow: 16000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0.000001,
      outputTokenCostUsd: 0.000002,
      status: "active",
      metadata: { legacyDefault: true },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "mock-small@1.0",
      providerKind: "mock",
      displayName: "Mock Small",
      contextWindow: 8000,
      supportsTools: false,
      supportsStreaming: false,
      inputTokenCostUsd: 0.0000005,
      outputTokenCostUsd: 0.000001,
      status: "active",
      metadata: { tier: "small" },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "mock-coder@1.0",
      providerKind: "mock",
      displayName: "Mock Coder",
      contextWindow: 32000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0.000001,
      outputTokenCostUsd: 0.000002,
      status: "active",
      metadata: { tier: "coder" },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "mock-conflict-resolver@1.0",
      providerKind: "mock",
      displayName: "Mock Conflict Resolver",
      contextWindow: 32000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0.000001,
      outputTokenCostUsd: 0.000002,
      status: "active",
      metadata: { specialization: "conflict" },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "mock-registry-reviewer@1.0",
      providerKind: "mock",
      displayName: "Mock Registry Reviewer",
      contextWindow: 24000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0.000001,
      outputTokenCostUsd: 0.000002,
      status: "active",
      metadata: { specialization: "registry" },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "openai-compatible/default",
      providerKind: "openai_compatible",
      displayName: "OpenAI-compatible Default",
      contextWindow: 128000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0.000003,
      outputTokenCostUsd: 0.000006,
      status: "disabled",
      metadata: { skeleton: true },
      createdAt: now,
      updatedAt: now
    }
  ];
}
