import type {
  CredentialHandle,
  CredentialResolutionResult,
  NetworkEgressDecision,
  NetworkEgressPolicy,
  RedactionPolicy,
  RedactionResult,
  SandboxDecision,
  SandboxProfile,
  SandboxSession,
  SecretAccessDecision,
  SecretLease,
  SecretRef,
  SecretScope,
  SecurityAuditEvent,
  VaultClientHealth,
  VaultSecretProviderConfig
} from "./types.ts";

export function secretRefToDto(secretRef: SecretRef) {
  return {
    id: secretRef.id,
    provider: secretRef.provider,
    secretKind: secretRef.secretKind,
    name: secretRef.name,
    envKey: secretRef.envKey,
    envKeyConfigured: Boolean(secretRef.envKey),
    scope: secretRef.scope,
    description: secretRef.description,
    status: secretRef.status,
    metadata: sanitizeDtoMetadata(secretRef.metadata),
    createdAt: secretRef.createdAt.toISOString(),
    updatedAt: secretRef.updatedAt.toISOString(),
    containsSecretMaterial: false
  };
}

export function credentialHandleToDto(handle: CredentialHandle) {
  return {
    ...handle,
    expiresAt: handle.expiresAt?.toISOString(),
    metadata: sanitizeDtoMetadata(handle.metadata),
    containsSecretMaterial: false
  };
}

export function credentialResolutionResultToDto(result: CredentialResolutionResult) {
  return {
    id: result.id,
    allowed: result.allowed,
    status: result.status,
    credentialHandle: result.credentialHandle ? credentialHandleToDto(result.credentialHandle) : undefined,
    blockedReason: result.blockedReason,
    policyDecisionId: result.policyDecisionId,
    authorizationDecisionId: result.authorizationDecisionId,
    auditEventId: result.auditEventId,
    createdAt: result.createdAt.toISOString(),
    containsSecretMaterial: false
  };
}

export function secretScopeToDto(scope: SecretScope) {
  return structuredClone(scope);
}

export function secretLeaseToDto(lease: SecretLease) {
  return {
    ...lease,
    issuedAt: lease.issuedAt?.toISOString(),
    expiresAt: lease.expiresAt?.toISOString(),
    revokedAt: lease.revokedAt?.toISOString(),
    containsSecretMaterial: false
  };
}

export function secretAccessDecisionToDto(decision: SecretAccessDecision) {
  return {
    ...decision,
    createdAt: decision.createdAt.toISOString()
  };
}

export function sandboxProfileToDto(profile: SandboxProfile) {
  return structuredClone(profile);
}

export function sandboxSessionToDto(session: SandboxSession) {
  return {
    ...session,
    createdAt: session.createdAt.toISOString(),
    completedAt: session.completedAt?.toISOString(),
    cleanupAt: session.cleanupAt?.toISOString()
  };
}

export function sandboxDecisionToDto(decision: SandboxDecision) {
  return {
    ...decision,
    createdAt: decision.createdAt.toISOString()
  };
}

export function networkEgressPolicyToDto(policy: NetworkEgressPolicy) {
  return structuredClone(policy);
}

export function networkEgressDecisionToDto(decision: NetworkEgressDecision) {
  return {
    ...decision,
    createdAt: decision.createdAt.toISOString()
  };
}

export function redactionPolicyToDto(policy: RedactionPolicy) {
  return structuredClone(policy);
}

export function redactionResultToDto(result: RedactionResult) {
  return structuredClone(result);
}

export function securityAuditEventToDto(event: SecurityAuditEvent) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString(),
    metadata: sanitizeDtoMetadata(event.metadata)
  };
}

export function vaultSecretProviderConfigToDto(config: VaultSecretProviderConfig) {
  return {
    selectedProvider: config.selectedProvider,
    vaultProviderEnabled: config.vaultProviderEnabled,
    vaultAddressConfigured: config.vaultAddressConfigured,
    vaultNamespaceConfigured: config.vaultNamespaceConfigured,
    vaultKvMountConfigured: Boolean(config.vaultKvMount),
    vaultAuthMethod: config.vaultAuthMethod,
    vaultTokenConfigured: config.vaultTokenConfigured,
    vaultTokenSecretRefConfigured: config.vaultTokenSecretRefConfigured,
    vaultAllowedPathPrefixCount: config.vaultAllowedPathPrefixCount,
    vaultIntegrationTestsEnabled: config.vaultIntegrationTestsEnabled,
    requestTimeoutMs: config.requestTimeoutMs,
    liveUsageReady: config.liveUsageReady,
    configStatus: config.configStatus,
    missingConfigCount: config.missingConfig.length,
    productionSecretBackendImplemented: config.productionSecretBackendImplemented,
    envFallbackProductionAllowed: config.envFallbackProductionAllowed,
    containsSecretMaterial: false
  };
}

export function vaultClientHealthToDto(health: VaultClientHealth) {
  return {
    clientKind: health.clientKind,
    status: health.status,
    configStatus: health.configStatus,
    vaultProviderEnabled: health.vaultProviderEnabled,
    vaultAddressConfigured: health.vaultAddressConfigured,
    vaultNamespaceConfigured: health.vaultNamespaceConfigured,
    vaultAuthMethod: health.vaultAuthMethod,
    allowedPathPrefixCount: health.allowedPathPrefixCount,
    integrationTestsEnabled: health.integrationTestsEnabled,
    liveCallAttempted: health.liveCallAttempted,
    containsSecretMaterial: false,
    sanitizedError: health.sanitizedError
  };
}

function sanitizeDtoMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(metadata);
  for (const key of Object.keys(clone)) {
    if (/token|secret|key|credential|prompt/i.test(key)) {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}
