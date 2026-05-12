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
import type {
  LocalAgentConsentDecision,
  LocalAgentConsentRequest,
  LocalAgentCapabilityAdvertisement,
  LocalAgentChannel,
  LocalAgentHandshake,
  LocalAgentInvocation,
  LocalAgentInvocationEnvelope,
  LocalAgentInvocationStream,
  LocalAgentNormalizedEvent,
  LocalAgentProtocolAuditEvent,
  LocalAgentRegistration,
  LocalAgentSession,
  LocalAgentStreamEvent,
  LocalCliCompatibilityEntry,
  LocalCliCompatibilityResult
} from "./local-agent-protocol.ts";

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

export function localAgentRegistrationToDto(registration: LocalAgentRegistration) {
  return {
    ...registration,
    registeredAt: registration.registeredAt.toISOString(),
    lastSeenAt: registration.lastSeenAt?.toISOString(),
    containsSecretMaterial: false,
    credentialCacheAccessAllowed: false
  };
}

export function localAgentSessionToDto(session: LocalAgentSession) {
  return {
    ...session,
    issuedAt: session.issuedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString()
  };
}

export function localAgentChannelToDto(channel: LocalAgentChannel) {
  return {
    ...channel,
    createdAt: channel.createdAt.toISOString(),
    establishedAt: channel.establishedAt?.toISOString(),
    expiresAt: channel.expiresAt?.toISOString(),
    revokedAt: channel.revokedAt?.toISOString(),
    productionCrypto: false,
    realTransport: false
  };
}

export function localAgentHandshakeToDto(handshake: LocalAgentHandshake) {
  return {
    ...handshake,
    issuedAt: handshake.issuedAt.toISOString(),
    completedAt: handshake.completedAt?.toISOString(),
    expiresAt: handshake.expiresAt.toISOString(),
    productionCrypto: false
  };
}

export function localAgentCapabilityAdvertisementToDto(advertisement: LocalAgentCapabilityAdvertisement) {
  return {
    ...advertisement,
    advertisedAt: advertisement.advertisedAt.toISOString()
  };
}

export function localCliCompatibilityEntryToDto(entry: LocalCliCompatibilityEntry) {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString()
  };
}

export function localCliCompatibilityResultToDto(result: LocalCliCompatibilityResult) {
  return {
    ...result,
    checkedAt: result.checkedAt.toISOString()
  };
}

export function localAgentInvocationEnvelopeToDto(envelope: LocalAgentInvocationEnvelope) {
  return {
    ...envelope,
    createdAt: envelope.createdAt.toISOString(),
    containsSecretMaterial: false
  };
}

export function localAgentNormalizedEventToDto(event: LocalAgentNormalizedEvent) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString()
  };
}

export function localAgentInvocationToDto(invocation: LocalAgentInvocation) {
  return {
    ...invocation,
    startedAt: invocation.startedAt?.toISOString(),
    completedAt: invocation.completedAt?.toISOString(),
    normalizedEvents: invocation.normalizedEvents.map(localAgentNormalizedEventToDto)
  };
}

export function localAgentInvocationStreamToDto(stream: LocalAgentInvocationStream) {
  return {
    ...stream,
    startedAt: stream.startedAt.toISOString(),
    completedAt: stream.completedAt?.toISOString()
  };
}

export function localAgentStreamEventToDto(event: LocalAgentStreamEvent) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString()
  };
}

export function localAgentConsentRequestToDto(consentRequest: LocalAgentConsentRequest) {
  return {
    ...consentRequest,
    requestedAt: consentRequest.requestedAt.toISOString(),
    expiresAt: consentRequest.expiresAt?.toISOString()
  };
}

export function localAgentConsentDecisionToDto(decision: LocalAgentConsentDecision) {
  return {
    ...decision,
    decidedAt: decision.decidedAt.toISOString()
  };
}

export function localAgentProtocolAuditEventToDto(event: LocalAgentProtocolAuditEvent) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString()
  };
}
