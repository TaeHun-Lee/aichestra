import type { ModelProvider, UsageEvent } from "@aichestra/core";

export type LLMProviderKind = "mock" | "openai_compatible" | "anthropic_compatible" | "local" | "custom";
export type LLMModelStatus = "active" | "disabled" | "deprecated";
export type VirtualModelKeyStatus = "active" | "disabled";
export type LLMCompletionFinishReason = "stop" | "length" | "blocked" | "error";
export type LLMCallResultState = "allowed" | "blocked" | "failed";

export type LLMModel = {
  id: string;
  providerKind: LLMProviderKind;
  displayName: string;
  contextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  inputTokenCostUsd?: number;
  outputTokenCostUsd?: number;
  status: LLMModelStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type LLMCompletionRequest = {
  taskId: string;
  taskRunId: string;
  actorId?: string;
  modelRef?: string;
  providerId?: string;
  virtualKeyId?: string;
  providerKind?: LLMProviderKind;
  prompt: string;
  systemInstructions?: string;
  toolContext?: Record<string, unknown>;
  maxTokens?: number;
  temperature?: number;
  budgetLimitUsd?: number;
  repoId?: string;
  metadata?: Record<string, unknown>;
};

export type LLMCompletionResult = {
  id: string;
  providerKind: LLMProviderKind;
  providerId?: string;
  modelId: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  finishReason: LLMCompletionFinishReason;
  latencyMs?: number;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type LLMUsageAttribution = {
  taskId: string;
  taskRunId: string;
  actorId?: string;
  providerKind: LLMProviderKind;
  providerId?: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  gatewayRequestId: string;
  createdAt: Date;
};

export type LLMAuditEvent = {
  id: string;
  eventType: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  providerKind: LLMProviderKind;
  providerId?: string;
  modelId?: string;
  result: LLMCallResultState;
  reason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type BudgetDecision = {
  allowed: boolean;
  reason: string;
  taskId: string;
  taskRunId: string;
  modelId: string;
  providerKind: LLMProviderKind;
  estimatedCostUsd: number;
  budgetRemainingUsd?: number;
};

export type VirtualModelKey = {
  id: string;
  ownerKind: "user" | "team" | "project" | "system";
  ownerId: string;
  displayName: string;
  allowedProviderKinds: LLMProviderKind[];
  allowedModelIds: string[];
  monthlyBudgetUsd?: number;
  perTaskBudgetUsd?: number;
  rpmLimit?: number;
  tpmLimit?: number;
  status: VirtualModelKeyStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type LLMProviderValidation = {
  ok: boolean;
  providerKind: LLMProviderKind;
  reason?: string;
};

export type LLMProviderCompletionResult = {
  ok: boolean;
  result?: LLMCompletionResult;
  reason?: string;
};

export type LLMProvider = {
  getProviderKind(): LLMProviderKind;
  validateConnection(): Promise<LLMProviderValidation>;
  listModels(): Promise<LLMModel[]>;
  createCompletion(request: LLMCompletionRequest, model: LLMModel): Promise<LLMProviderCompletionResult>;
  estimateUsage?(request: LLMCompletionRequest, model: LLMModel): Promise<Pick<LLMCompletionResult, "inputTokens" | "outputTokens" | "estimatedCostUsd">>;
  close?(): Promise<void>;
};

export type LLMProviderRuntimeConfig = {
  providerKind: LLMProviderKind;
  remoteLlmEnabled: boolean;
  remoteCompletionEnabled: boolean;
  openAICompatibleConfigured: boolean;
  baseUrlConfigured: boolean;
};

export type LLMRouteResult = {
  ok: boolean;
  model?: LLMModel;
  budgetDecision?: BudgetDecision;
  reason?: string;
};

export type LLMCompletionRouteResult = {
  ok: boolean;
  result?: LLMCompletionResult;
  usageEvent?: UsageEvent;
  budgetDecision?: BudgetDecision;
  reason?: string;
};

export type LLMUsageRepository = {
  recordUsage(input: Omit<UsageEvent, "id" | "createdAt">): UsageEvent;
  listUsageEvents(): UsageEvent[];
};

export function providerKindToModelProvider(providerKind: LLMProviderKind): ModelProvider {
  if (providerKind === "mock") return "mock";
  if (providerKind === "local") return "local";
  return "mock";
}
