import { createId } from "@aichestra/core";
import type { CredentialResolutionRequest, InternalCredentialResolutionResult } from "@aichestra/security";
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
        providerId: request.providerId,
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
          provider_id: request.providerId,
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
  allowedModels?: string[];
  defaultModel?: string;
  timeoutMs?: number;
  httpClient?: OpenAICompatibleHttpClient;
};

export type LlmCredentialResolver = (request: CredentialResolutionRequest) => InternalCredentialResolutionResult;

export type LlmLegacyCredentialFallbackAuditEvent = {
  providerId: "openai_compatible";
  purpose: "llm_api_call";
  envKey: "AICHESTRA_LLM_API_KEY";
  reason: "legacy_env_api_key_configured";
  metadata: Record<string, unknown>;
};

export type LlmProviderFactoryOptions = {
  credentialResolver?: LlmCredentialResolver;
  resolvedCredentialValue?: string;
  httpClient?: OpenAICompatibleHttpClient;
  legacyCredentialFallbackAuditor?: (event: LlmLegacyCredentialFallbackAuditEvent) => void;
};

export type OpenAICompatibleHttpRequest = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  timeoutMs: number;
};

export type OpenAICompatibleHttpResponse = {
  ok: boolean;
  status: number;
  body: unknown;
};

export type OpenAICompatibleHttpClient = {
  postJson(request: OpenAICompatibleHttpRequest): Promise<OpenAICompatibleHttpResponse>;
};

export class FetchOpenAICompatibleHttpClient implements OpenAICompatibleHttpClient {
  async postJson(request: OpenAICompatibleHttpRequest): Promise<OpenAICompatibleHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), request.timeoutMs);
    try {
      const response = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body),
        signal: controller.signal
      });
      const text = await response.text();
      let body: unknown = {};
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = { error: { message: text.slice(0, 500) } };
        }
      }
      return { ok: response.ok, status: response.status, body };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class OpenAICompatibleLLMProvider implements LLMProvider {
  private readonly remoteLlmEnabled: boolean;
  private readonly remoteCompletionEnabled: boolean;
  private readonly baseUrl?: string;
  private readonly apiKey?: string;
  private readonly allowedModels: string[];
  private readonly defaultModel?: string;
  private readonly timeoutMs: number;
  private readonly httpClient: OpenAICompatibleHttpClient;

  constructor(input: OpenAICompatibleProviderInput = {}) {
    this.remoteLlmEnabled = input.remoteLlmEnabled ?? false;
    this.remoteCompletionEnabled = input.remoteCompletionEnabled ?? false;
    this.baseUrl = input.baseUrl;
    this.apiKey = input.apiKey;
    this.allowedModels = input.allowedModels ?? [];
    this.defaultModel = input.defaultModel;
    this.timeoutMs = input.timeoutMs ?? 30000;
    this.httpClient = input.httpClient ?? new FetchOpenAICompatibleHttpClient();
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
    return { ok: true, providerKind: "openai_compatible" };
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

  async createCompletion(request: LLMCompletionRequest, model: LLMModel): Promise<LLMProviderCompletionResult> {
    if (!this.remoteLlmEnabled) {
      return { ok: false, reason: "blocked_remote_llm_disabled" };
    }
    if (!this.remoteCompletionEnabled) {
      return { ok: false, reason: "remote_llm_completion_disabled" };
    }
    if (!this.baseUrl || !this.apiKey) {
      return { ok: false, reason: "openai_compatible_config_missing" };
    }
    const remoteModel = this.remoteModelFor(model, request);
    if (!this.isModelAllowed(model.id, remoteModel)) {
      return { ok: false, reason: "model_not_allowlisted" };
    }

    const usageEstimate = await this.estimateUsage(request, model);
    const startedAt = Date.now();
    try {
      const response = await this.httpClient.postJson({
        url: chatCompletionsUrl(this.baseUrl),
        timeoutMs: this.timeoutMs,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`
        },
        body: {
          model: remoteModel,
          messages: [
            ...(request.systemInstructions ? [{ role: "system", content: request.systemInstructions }] : []),
            { role: "user", content: request.prompt }
          ],
          max_tokens: request.maxTokens ?? 96,
          temperature: request.temperature ?? 0.2
        }
      });

      if (!response.ok) {
        return { ok: false, reason: normalizeOpenAICompatibleError(response.body, response.status) };
      }

      const normalized = normalizeOpenAICompatibleCompletion(response.body, usageEstimate);
      if (!normalized.content) {
        return { ok: false, reason: "openai_compatible_empty_response" };
      }
      const redactedContent = redactLlmText(normalized.content);
      const inputTokens = normalized.inputTokens ?? usageEstimate.inputTokens;
      const outputTokens = normalized.outputTokens ?? usageEstimate.outputTokens;
      return {
        ok: true,
        result: {
          id: createId("llmreq"),
          providerKind: "openai_compatible",
          providerId: request.providerId,
          modelId: model.id,
          content: redactedContent,
          inputTokens,
          outputTokens,
          estimatedCostUsd: estimateCompletionCost(model, inputTokens, outputTokens),
          finishReason: normalized.finishReason,
          latencyMs: Date.now() - startedAt,
          createdAt: new Date(),
          metadata: {
            source: "llm_gateway",
            remote_provider: "openai_compatible",
            remote_model: remoteModel,
            provider_id: request.providerId,
            response_id: normalized.responseId,
            redaction_applied: redactedContent !== normalized.content,
            direct_provider_api_key_exposed: false
          }
        }
      };
    } catch (error) {
      return {
        ok: false,
        reason: normalizeThrownProviderError(error)
      };
    }
  }

  private remoteModelFor(model: LLMModel, request: LLMCompletionRequest): string {
    const metadataModel = typeof model.metadata.remoteModelId === "string" ? model.metadata.remoteModelId : undefined;
    const requestModel = typeof request.metadata?.remoteModelId === "string" ? request.metadata.remoteModelId : undefined;
    return requestModel ?? metadataModel ?? this.defaultModel ?? model.id;
  }

  private isModelAllowed(modelId: string, remoteModel: string): boolean {
    if (this.allowedModels.length === 0) return true;
    return this.allowedModels.includes(modelId) || this.allowedModels.includes(remoteModel);
  }
}

type SkeletonProviderInput = {
  providerKind: LLMProviderKind;
  reason?: string;
  localAgentRequired?: boolean;
};

class DisabledSkeletonLLMProvider implements LLMProvider {
  private readonly providerKind: LLMProviderKind;
  private readonly reason: string;
  private readonly localAgentRequired: boolean;

  constructor(input: SkeletonProviderInput) {
    this.providerKind = input.providerKind;
    this.reason = input.reason ?? "provider_not_implemented";
    this.localAgentRequired = input.localAgentRequired ?? false;
  }

  getProviderKind(): LLMProviderKind {
    return this.providerKind;
  }

  async validateConnection(): Promise<LLMProviderValidation> {
    return { ok: false, providerKind: this.providerKind, reason: this.reason };
  }

  async listModels(): Promise<LLMModel[]> {
    return seedLlmModels().filter((model) => model.providerKind === this.providerKind);
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

  async createCompletion(_request: LLMCompletionRequest, _model: LLMModel): Promise<LLMProviderCompletionResult> {
    return {
      ok: false,
      reason: this.localAgentRequired ? "local_agent_required" : this.reason
    };
  }
}

export class AnthropicCompatibleLLMProviderSkeleton extends DisabledSkeletonLLMProvider {
  constructor() {
    super({ providerKind: "anthropic_compatible", reason: "anthropic_compatible_provider_not_implemented" });
  }
}

export class GeminiCompatibleLLMProviderSkeleton extends DisabledSkeletonLLMProvider {
  constructor() {
    super({ providerKind: "gemini_compatible", reason: "gemini_compatible_provider_not_implemented" });
  }
}

export class BedrockCompatibleLLMProviderSkeleton extends DisabledSkeletonLLMProvider {
  constructor() {
    super({ providerKind: "bedrock_compatible", reason: "bedrock_compatible_provider_not_implemented" });
  }
}

export class VertexCompatibleLLMProviderSkeleton extends DisabledSkeletonLLMProvider {
  constructor() {
    super({ providerKind: "vertex_compatible", reason: "vertex_compatible_provider_not_implemented" });
  }
}

export class AzureCompatibleLLMProviderSkeleton extends DisabledSkeletonLLMProvider {
  constructor() {
    super({ providerKind: "azure_compatible", reason: "azure_compatible_provider_not_implemented" });
  }
}

export class LiteLLMCompatibleLLMProviderSkeleton extends DisabledSkeletonLLMProvider {
  constructor() {
    super({ providerKind: "litellm_compatible", reason: "litellm_compatible_provider_not_implemented" });
  }
}

export class LocalCliLLMProviderBridgeSkeleton extends DisabledSkeletonLLMProvider {
  constructor() {
    super({ providerKind: "local_cli", reason: "local_agent_required", localAgentRequired: true });
  }
}

export function createLlmProviderConfigFromEnv(env: Record<string, string | undefined> = process.env): LLMProviderRuntimeConfig {
  const providerKind = env.AICHESTRA_LLM_PROVIDER === "openai_compatible" ? "openai_compatible" : "mock";
  const allowedModels = parseCsv(env.AICHESTRA_LLM_ALLOWED_MODELS);
  const routingMode = isRoutingMode(env.AICHESTRA_LLM_ROUTING_MODE)
    ? env.AICHESTRA_LLM_ROUTING_MODE
    : providerKind === "openai_compatible"
      ? "single_provider"
      : "mock_only";
  const allowedProviderKinds = parseCsv(env.AICHESTRA_ALLOWED_LLM_PROVIDER_KINDS).filter(isSupportedProviderKind);
  const apiKeySecretRef = env.AICHESTRA_LLM_API_KEY_SECRET_REF;
  const apiKeyConfigured = Boolean(env.AICHESTRA_LLM_API_KEY || apiKeySecretRef);
  return {
    providerKind,
    routingMode,
    fallbackEnabled: env.AICHESTRA_ENABLE_LLM_FALLBACK === "true",
    maxFallbackAttempts: parseNonNegativeInt(env.AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS),
    allowedProviderKinds,
    allowedProviderIds: parseCsv(env.AICHESTRA_ALLOWED_LLM_PROVIDER_IDS),
    deniedProviderIds: parseCsv(env.AICHESTRA_DENIED_LLM_PROVIDER_IDS),
    deniedModels: parseCsv(env.AICHESTRA_DENIED_LLM_MODELS),
    remoteLlmEnabled: env.AICHESTRA_ENABLE_REMOTE_LLM === "true",
    remoteCompletionEnabled: env.AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION === "true",
    openAICompatibleConfigured: apiKeyConfigured,
    baseUrlConfigured: Boolean(env.AICHESTRA_LLM_BASE_URL),
    apiKeyConfigured,
    apiKeySecretRef,
    credentialSource: apiKeySecretRef ? "secret_ref" : env.AICHESTRA_LLM_API_KEY ? "legacy_env" : "none",
    credentialStatus: apiKeyConfigured ? "resolved" : "missing",
    credentialReason: apiKeySecretRef ? undefined : env.AICHESTRA_LLM_API_KEY ? "legacy_env_api_key_configured" : "llm_api_key_missing",
    envSecretProviderEnabled: env.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER === "true",
    allowedSecretEnvKeyCount: parseCsv(env.AICHESTRA_ALLOWED_SECRET_ENV_KEYS).length,
    allowedModels,
    allowedModelCount: allowedModels.length,
    defaultModel: env.AICHESTRA_LLM_DEFAULT_MODEL,
    defaultModelConfigured: Boolean(env.AICHESTRA_LLM_DEFAULT_MODEL),
    integrationTestsEnabled: env.AICHESTRA_LLM_INTEGRATION_TESTS === "true"
  };
}

export function createLlmProviderFromConfig(
  config: LLMProviderRuntimeConfig,
  env: Record<string, string | undefined> = process.env,
  options: LlmProviderFactoryOptions = {}
): LLMProvider {
  if (config.providerKind === "openai_compatible") {
    const credential = options.resolvedCredentialValue
      ? { allowed: true, status: "resolved" as const, value: options.resolvedCredentialValue }
      : resolveLlmCredential(config, env, options);
    return new OpenAICompatibleLLMProvider({
      remoteLlmEnabled: config.remoteLlmEnabled,
      remoteCompletionEnabled: config.remoteCompletionEnabled,
      baseUrl: env.AICHESTRA_LLM_BASE_URL,
      apiKey: credential.value,
      allowedModels: config.allowedModels,
      defaultModel: env.AICHESTRA_LLM_DEFAULT_MODEL,
      httpClient: options.httpClient
    });
  }
  return new MockLLMProvider();
}

export function createLlmProviderFromEnv(env: Record<string, string | undefined> = process.env, options: LlmProviderFactoryOptions = {}) {
  const config = createLlmProviderConfigFromEnv(env);
  const credential = resolveLlmCredential(config, env, options);
  const resolvedConfig: LLMProviderRuntimeConfig = {
    ...config,
    apiKeyConfigured: credential.allowed,
    openAICompatibleConfigured: credential.allowed,
    credentialStatus: credential.status,
    credentialReason: credential.blockedReason,
    credentialSource: config.apiKeySecretRef ? "secret_ref" : credential.allowed ? "legacy_env" : "none"
  };
  return {
    config: resolvedConfig,
    provider: createLlmProviderFromConfig(resolvedConfig, env, {
      resolvedCredentialValue: credential.value,
      httpClient: options.httpClient
    })
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
      status: "active",
      metadata: { remoteProvider: "openai_compatible", remoteModelFromConfig: true },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "anthropic-compatible/skeleton",
      providerKind: "anthropic_compatible",
      displayName: "Anthropic-compatible Skeleton",
      contextWindow: 200000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0.000004,
      outputTokenCostUsd: 0.000012,
      status: "disabled",
      metadata: { skeleton: true, providerId: "anthropic-api-key", capabilities: ["completion", "code_generation", "code_review"] },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "gemini-compatible/skeleton",
      providerKind: "gemini_compatible",
      displayName: "Gemini-compatible Skeleton",
      contextWindow: 1000000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0.000002,
      outputTokenCostUsd: 0.000006,
      status: "disabled",
      metadata: { skeleton: true, providerId: "gemini-api-key", capabilities: ["completion", "summarization", "json_output"] },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "bedrock-compatible/skeleton",
      providerKind: "bedrock_compatible",
      displayName: "Bedrock-compatible Skeleton",
      contextWindow: 200000,
      supportsTools: false,
      supportsStreaming: false,
      inputTokenCostUsd: 0.000004,
      outputTokenCostUsd: 0.000012,
      status: "disabled",
      metadata: { skeleton: true, providerId: "bedrock-anthropic-cloud", capabilities: ["completion", "cloud_iam"] },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "vertex-compatible/skeleton",
      providerKind: "vertex_compatible",
      displayName: "Vertex-compatible Skeleton",
      contextWindow: 1000000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0.000002,
      outputTokenCostUsd: 0.000006,
      status: "disabled",
      metadata: { skeleton: true, providerId: "vertex-gemini-cloud", capabilities: ["completion", "cloud_iam"] },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "azure-compatible/skeleton",
      providerKind: "azure_compatible",
      displayName: "Azure-compatible Skeleton",
      contextWindow: 128000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0.000003,
      outputTokenCostUsd: 0.000006,
      status: "disabled",
      metadata: { skeleton: true, providerId: "azure-foundry-cloud", capabilities: ["completion", "cloud_iam"] },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "litellm-compatible/skeleton",
      providerKind: "litellm_compatible",
      displayName: "LiteLLM-compatible Skeleton",
      contextWindow: 128000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0.000003,
      outputTokenCostUsd: 0.000006,
      status: "disabled",
      metadata: { skeleton: true, providerId: "litellm-compatible-skeleton", capabilities: ["completion"] },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "claude-code/local",
      providerKind: "local_cli",
      displayName: "Claude Code Local CLI",
      contextWindow: 200000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0,
      outputTokenCostUsd: 0,
      status: "active",
      metadata: { localAgentRequired: true, providerId: "claude-code-local", localCliTemplateV1Id: "claude-code-template-v1", templateOnly: true, vendorCliExecutionImplemented: false, capabilities: ["local_cli", "code_generation"] },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "codex-cli/local",
      providerKind: "local_cli",
      displayName: "Codex CLI Local",
      contextWindow: 128000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0,
      outputTokenCostUsd: 0,
      status: "active",
      metadata: { localAgentRequired: true, providerId: "codex-cli-local", localCliTemplateV1Id: "codex-cli-template-v1", templateOnly: true, vendorCliExecutionImplemented: false, capabilities: ["local_cli", "code_generation"] },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "gemini-cli/local",
      providerKind: "local_cli",
      displayName: "Gemini CLI Local",
      contextWindow: 1000000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0,
      outputTokenCostUsd: 0,
      status: "active",
      metadata: { localAgentRequired: true, providerId: "gemini-cli-local", localCliTemplateV1Id: "gemini-cli-template-v1", templateOnly: true, vendorCliExecutionImplemented: false, capabilities: ["local_cli", "summarization"] },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "aider/local",
      providerKind: "local_cli",
      displayName: "Aider Local CLI",
      contextWindow: 128000,
      supportsTools: true,
      supportsStreaming: false,
      inputTokenCostUsd: 0,
      outputTokenCostUsd: 0,
      status: "disabled",
      metadata: { localAgentRequired: true, providerId: "aider-local", localCliTemplateV1Id: "aider-template-v1", templateOnly: true, vendorCliExecutionImplemented: false, capabilities: ["local_cli", "patch"] },
      createdAt: now,
      updatedAt: now
    },
    {
      id: "custom-local-cli/local",
      providerKind: "local_cli",
      displayName: "Custom Local CLI Provider",
      contextWindow: 128000,
      supportsTools: false,
      supportsStreaming: false,
      inputTokenCostUsd: 0,
      outputTokenCostUsd: 0,
      status: "disabled",
      metadata: { localAgentRequired: true, providerId: "custom-local-cli", localCliTemplateV1Id: "custom-local-cli-template-v1", templateOnly: true, vendorCliExecutionImplemented: false, capabilities: ["local_cli"] },
      createdAt: now,
      updatedAt: now
    }
  ];
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNonNegativeInt(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function isRoutingMode(value: unknown): value is LLMProviderRuntimeConfig["routingMode"] {
  return value === "mock_only" || value === "single_provider" || value === "multi_provider";
}

function isSupportedProviderKind(value: string): value is LLMProviderKind {
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

function resolveLlmCredential(
  config: LLMProviderRuntimeConfig,
  env: Record<string, string | undefined>,
  options: LlmProviderFactoryOptions
): InternalCredentialResolutionResult {
  if (config.apiKeySecretRef) {
    if (!options.credentialResolver) {
      return {
        id: createId("credres"),
        allowed: false,
        status: "blocked",
        blockedReason: "credential_resolver_unavailable",
        createdAt: new Date()
      };
    }
    return options.credentialResolver({
      secretRefId: config.apiKeySecretRef,
      purpose: "llm_api_call",
      providerId: "openai_compatible",
      policyContext: {
        providerKind: "openai_compatible",
        remoteLlmEnabled: config.remoteLlmEnabled,
        remoteCompletionEnabled: config.remoteCompletionEnabled,
        baseUrlConfigured: config.baseUrlConfigured,
        modelAllowlisted: config.allowedModels.length > 0 || Boolean(config.defaultModel),
        credentialsConfigured: true,
        envSecretProviderEnabled: config.envSecretProviderEnabled
      }
    });
  }
  const value = env.AICHESTRA_LLM_API_KEY;
  if (value) {
    options.legacyCredentialFallbackAuditor?.({
      providerId: "openai_compatible",
      purpose: "llm_api_call",
      envKey: "AICHESTRA_LLM_API_KEY",
      reason: "legacy_env_api_key_configured",
      metadata: {
        providerKind: "openai_compatible",
        source: "legacy_env",
        refConfigured: false,
        remoteLlmEnabled: config.remoteLlmEnabled,
        remoteCompletionEnabled: config.remoteCompletionEnabled,
        baseUrlConfigured: config.baseUrlConfigured,
        modelAllowlisted: config.allowedModels.length > 0 || Boolean(config.defaultModel),
        envProviderEnabled: config.envSecretProviderEnabled
      }
    });
    return {
      id: createId("credres"),
      allowed: true,
      status: "resolved",
      value,
      createdAt: new Date()
    };
  }
  return {
    id: createId("credres"),
    allowed: false,
    status: "missing",
    blockedReason: "llm_api_key_missing",
    createdAt: new Date()
  };
}

function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

function normalizeOpenAICompatibleCompletion(
  body: unknown,
  fallbackUsage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number }
): {
  responseId?: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  finishReason: "stop" | "length" | "error";
} {
  const record = isRecord(body) ? body : {};
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const firstChoice = isRecord(choices[0]) ? choices[0] : {};
  const message = isRecord(firstChoice.message) ? firstChoice.message : {};
  const content = typeof message.content === "string"
    ? message.content
    : typeof firstChoice.text === "string"
      ? firstChoice.text
      : "";
  const usage = isRecord(record.usage) ? record.usage : {};
  const finish = typeof firstChoice.finish_reason === "string" ? firstChoice.finish_reason : "stop";
  return {
    responseId: typeof record.id === "string" ? record.id : undefined,
    content,
    inputTokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : fallbackUsage.inputTokens,
    outputTokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : fallbackUsage.outputTokens,
    finishReason: finish === "length" ? "length" : finish === "stop" ? "stop" : "error"
  };
}

function normalizeOpenAICompatibleError(body: unknown, status: number): string {
  const record = isRecord(body) ? body : {};
  const error = isRecord(record.error) ? record.error : {};
  const message = typeof error.message === "string" ? redactLlmText(error.message) : undefined;
  if (message) return `openai_compatible_http_${status}:${message.slice(0, 160)}`;
  return `openai_compatible_http_${status}`;
}

function normalizeThrownProviderError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return "openai_compatible_timeout";
  const message = error instanceof Error ? redactLlmText(error.message) : "unknown_provider_error";
  if (/abort|timeout/i.test(message)) return "openai_compatible_timeout";
  return `openai_compatible_provider_error:${message.slice(0, 160)}`;
}

function redactLlmText(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, "[redacted-api-key]")
    .replace(/\b(AIza[0-9A-Za-z_-]{8,})\b/g, "[redacted-api-key]")
    .replace(/\b((?:OPENAI|ANTHROPIC|AICHESTRA_LLM|LLM|GITHUB|GOOGLE_APPLICATION)_API_KEY)\s*=\s*[^\s]+/gi, "$1=[redacted]")
    .replace(/\b((?:OPENAI|ANTHROPIC|AICHESTRA_LLM|LLM|GITHUB|GOOGLE_APPLICATION)_TOKEN)\s*=\s*[^\s]+/gi, "$1=[redacted]")
    .replace(/\b(AICHESTRA_GITHUB_WEBHOOK_SECRET)\s*=\s*[^\s]+/gi, "$1=[redacted]")
    .replace(/\b([A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD))\s*=\s*[^\s]+/gi, "$1=[redacted]")
    .replace(/GOOGLE_APPLICATION_CREDENTIALS\s*=\s*[^\s]+/gi, "GOOGLE_APPLICATION_CREDENTIALS=[redacted]")
    .replace(/~[\\/]\.codex[\\/]auth\.json/gi, "[redacted-credential-cache]")
    .replace(/~[\\/]\.claude[^\s]*/gi, "[redacted-credential-cache]")
    .replace(/application_default_credentials\.json/gi, "[redacted-credential-cache]")
    .replace(/gcloud[\\/]application_default_credentials/gi, "[redacted-credential-cache]");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
