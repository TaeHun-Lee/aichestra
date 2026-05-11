import type {
  BudgetDecision,
  LLMAuditEvent,
  LLMCompletionResult,
  LLMModel,
  LLMProviderRuntimeConfig,
  VirtualModelKey
} from "./types.ts";

export function llmModelToDto(model: LLMModel) {
  return {
    ...model,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString()
  };
}

export function virtualModelKeyToDto(key: VirtualModelKey) {
  return {
    ...key,
    storesProviderSecret: false,
    createdAt: key.createdAt.toISOString(),
    updatedAt: key.updatedAt.toISOString()
  };
}

export function llmAuditEventToDto(event: LLMAuditEvent) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString()
  };
}

export function llmCompletionResultToDto(result: LLMCompletionResult) {
  return {
    ...result,
    createdAt: result.createdAt.toISOString()
  };
}

export function budgetDecisionToDto(decision: BudgetDecision) {
  return { ...decision };
}

export function llmConfigToDto(config: LLMProviderRuntimeConfig) {
  return { ...config };
}
