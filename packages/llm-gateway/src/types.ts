import type { AuthContext, RequestContext } from "@aichestra/auth";
import type { ModelProvider, UsageEvent } from "@aichestra/core";
import type { ProviderBillingMode, ProviderKind } from "./enterprise-providers.ts";

export type LLMProviderKind =
  | "mock"
  | "openai_compatible"
  | "anthropic_compatible"
  | "gemini_compatible"
  | "bedrock_compatible"
  | "vertex_compatible"
  | "azure_compatible"
  | "litellm_compatible"
  | "local_cli"
  | "local"
  | "custom";
export type LLMModelStatus = "active" | "disabled" | "deprecated";
export type VirtualModelKeyStatus = "active" | "disabled";
export type LLMCompletionFinishReason = "stop" | "length" | "blocked" | "error";
export type LLMCallResultState = "allowed" | "blocked" | "failed";
export type LLMRoutingMode = "mock_only" | "single_provider" | "multi_provider";
export type LLMPromptClass =
  | "code_generation"
  | "code_review"
  | "conflict_resolution"
  | "registry_review"
  | "summarization"
  | "general"
  | "unknown";
export type LLMRouteDecision =
  | "selected"
  | "blocked"
  | "no_route"
  | "budget_blocked"
  | "policy_blocked"
  | "credentials_blocked"
  | "provider_unavailable";
export type LLMProviderHealthStatus = "healthy" | "disabled" | "degraded" | "unavailable" | "unknown";

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
  principalId?: string;
  authContext?: AuthContext;
  requestContext?: RequestContext;
  modelRef?: string;
  providerId?: string;
  virtualKeyId?: string;
  providerKind?: LLMProviderKind;
  promptClass?: LLMPromptClass;
  requestedCapabilities?: string[];
  maxFallbackAttempts?: number;
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
  routeId?: string;
  routingDecisionId?: string;
  fallbackAttempt?: number;
  billingMode?: ProviderBillingMode;
  createdAt: Date;
};

export type LLMAuditEvent = {
  id: string;
  eventType: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
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
  budgetDecisionId?: string;
};

export type LLMRoutingRequest = {
  id: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  principalId?: string;
  requestedModelId?: string;
  requestedCapabilities: string[];
  promptClass: LLMPromptClass;
  priority: "low" | "normal" | "high";
  maxFallbackAttempts: number;
  budgetLimitUsd?: number;
  metadata: Record<string, unknown>;
};

export type LLMRoutingDecision = {
  id: string;
  requestId: string;
  selectedProviderId?: string;
  selectedProviderKind?: LLMProviderKind;
  selectedModelId?: string;
  selectedRouteId?: string;
  fallbackChain: string[];
  decision: LLMRouteDecision;
  reason: string;
  policyDecisionId?: string;
  budgetDecisionId?: string;
  credentialResolutionId?: string;
  authorizationDecisionId?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type LLMRoute = {
  id: string;
  name: string;
  description: string;
  providerId: string;
  providerKind: LLMProviderKind;
  providerTransportKind?: ProviderKind;
  modelId: string;
  priority: number;
  enabled: boolean;
  capabilities: string[];
  promptClasses: LLMPromptClass[];
  maxInputTokens?: number;
  maxOutputTokens?: number;
  estimatedInputTokenCostUsd?: number;
  estimatedOutputTokenCostUsd?: number;
  requiresRemote: boolean;
  requiresSecretRef: boolean;
  fallbackAllowed: boolean;
  billingMode?: ProviderBillingMode;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type LLMFallbackPolicy = {
  id: string;
  name: string;
  enabled: boolean;
  maxAttempts: number;
  allowedProviderKinds: LLMProviderKind[];
  disallowedProviderKinds: LLMProviderKind[];
  requireSameDataClass: boolean;
  requireBudgetRemaining: boolean;
  requirePolicyAllow: boolean;
  stopOnPolicyDeny: boolean;
  stopOnCredentialDeny: boolean;
  stopOnBudgetDeny: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type LLMProviderHealth = {
  providerId: string;
  providerKind: LLMProviderKind;
  status: LLMProviderHealthStatus;
  remoteEnabled: boolean;
  lastCheckedAt?: Date;
  reason?: string;
  metadata: Record<string, unknown>;
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
  routingMode: LLMRoutingMode;
  fallbackEnabled: boolean;
  maxFallbackAttempts: number;
  allowedProviderKinds: LLMProviderKind[];
  allowedProviderIds: string[];
  deniedProviderIds: string[];
  deniedModels: string[];
  remoteLlmEnabled: boolean;
  remoteCompletionEnabled: boolean;
  openAICompatibleConfigured: boolean;
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  apiKeySecretRef?: string;
  credentialSource: "none" | "legacy_env" | "secret_ref";
  credentialStatus: "resolved" | "blocked" | "missing" | "denied" | "unavailable";
  credentialReason?: string;
  envSecretProviderEnabled: boolean;
  allowedSecretEnvKeyCount: number;
  allowedModels: string[];
  allowedModelCount: number;
  defaultModel?: string;
  defaultModelConfigured: boolean;
  integrationTestsEnabled: boolean;
};

export type LLMRouteResult = {
  ok: boolean;
  model?: LLMModel;
  budgetDecision?: BudgetDecision;
  routingDecision?: LLMRoutingDecision;
  route?: LLMRoute;
  reason?: string;
};

export type LLMCompletionRouteResult = {
  ok: boolean;
  result?: LLMCompletionResult;
  usageEvent?: UsageEvent;
  budgetDecision?: BudgetDecision;
  routingDecision?: LLMRoutingDecision;
  fallbackAttempts?: LLMRoutingDecision[];
  reason?: string;
};

export type LLMUsageRepository = {
  recordUsage(input: Omit<UsageEvent, "id" | "createdAt">): UsageEvent;
  listUsageEvents(): UsageEvent[];
};

export function providerKindToModelProvider(providerKind: LLMProviderKind): ModelProvider {
  if (providerKind === "mock") return "mock";
  if (providerKind === "local" || providerKind === "local_cli") return "local";
  return "mock";
}
