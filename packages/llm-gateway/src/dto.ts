import type {
  BudgetDecision,
  LLMAuditEvent,
  LLMCompletionResult,
  LLMModel,
  LLMProviderRuntimeConfig,
  VirtualModelKey
} from "./types.ts";
import type {
  CredentialReferenceResult,
  LocalAgentDescriptor,
  LocalCliProviderConfig,
  ProviderAuditEvent,
  ProviderAuth,
  ProviderCatalogEntry,
  ProviderInvocationResult,
  ProviderOutputParseResult,
  ProviderValidationResult,
  TokenResolutionResult
} from "./enterprise-providers.ts";

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

export function providerAuthToDto(auth: ProviderAuth) {
  if (auth.type === "api_key") {
    return {
      type: auth.type,
      envKeyConfigured: Boolean(auth.envKey),
      secretRefConfigured: Boolean(auth.secretRef)
    };
  }
  if (auth.type === "external_cli_session") {
    return {
      type: auth.type,
      credentialAccess: auth.credentialAccess,
      ownerUserIdConfigured: Boolean(auth.ownerUserId),
      sharedAcrossUsers: auth.sharedAcrossUsers === true
    };
  }
  return {
    ...auth
  };
}

export function providerCatalogEntryToDto(entry: ProviderCatalogEntry) {
  return {
    ...entry,
    auth: providerAuthToDto(entry.auth),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

export function providerValidationResultToDto(result: ProviderValidationResult) {
  return { ...result };
}

export function credentialReferenceResultToDto(result: CredentialReferenceResult) {
  return {
    ...result,
    credentialRef: result.credentialRef
      ? {
        kind: result.credentialRef.kind,
        configured: Boolean(result.credentialRef.ref)
      }
      : undefined
  };
}

export function tokenResolutionResultToDto(result: TokenResolutionResult) {
  return {
    ok: result.ok,
    providerId: result.providerId,
    headerKeys: result.headers ? Object.keys(result.headers) : [],
    envKeys: result.env ? Object.keys(result.env) : [],
    reason: result.reason
  };
}

export function providerInvocationResultToDto(result: ProviderInvocationResult) {
  return {
    ...result,
    normalizedEvents: result.normalizedEvents.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString()
    })),
    createdAt: result.createdAt.toISOString(),
    completedAt: result.completedAt?.toISOString()
  };
}

export function providerAuditEventToDto(event: ProviderAuditEvent) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString()
  };
}

export function localCliProviderConfigToDto(config: LocalCliProviderConfig) {
  return {
    ...config,
    auth: providerAuthToDto(config.auth)
  };
}

export function localAgentDescriptorToDto(agent: LocalAgentDescriptor) {
  return {
    ...agent,
    lastSeenAt: agent.lastSeenAt?.toISOString()
  };
}

export function providerOutputParseResultToDto(result: ProviderOutputParseResult) {
  return {
    ...result,
    normalizedEvents: result.normalizedEvents.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString()
    }))
  };
}
