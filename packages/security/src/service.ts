import { createId } from "@aichestra/core";
import type {
  AuthContext,
  AuthorizationDecision,
  AuthorizationServiceInterface,
  RequestContext
} from "@aichestra/auth";
import { ScopeContextFactory, ServiceAccountContextFactory, createServiceAccountPolicySubject, serviceAccountAuditMetadata } from "@aichestra/auth";
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject
} from "@aichestra/policy";
import type { PolicyAction, PolicyDecision, PolicyResourceKind } from "@aichestra/policy";
import {
  createInMemorySecurityRepositories,
  type SecurityRepositories
} from "./repository.ts";
import { EnvSecretProvider, VaultSecretProvider, createEnvSecretProviderFromEnv, createVaultSecretProviderFromEnv, vaultMetadataFromSecretRef } from "./credentials.ts";
import { redactWithPolicy } from "./redaction.ts";
import type {
  CredentialHandle,
  CredentialResolutionRequest,
  CredentialResolutionResult,
  CredentialResolutionStatus,
  EnvSecretProviderConfig,
  InternalCredentialResolutionResult,
  NetworkEgressDecision,
  RedactionResult,
  SafeEnvironmentResult,
  SandboxDecision,
  SandboxProfile,
  SandboxSession,
  SandboxSessionRequest,
  SecretAccessDecision,
  SecretLease,
  SecretLeaseRequest,
  SecretManager,
  SecretManagerKind,
  SecretRef,
  SecretRefValidationResult,
  SecurityAuditEvent,
  VaultClientHealth,
  VaultSecretProviderConfig
} from "./types.ts";

export type SecurityControlServiceInput = {
  repositories?: SecurityRepositories;
  policyService?: PolicyService;
  authorizationService?: AuthorizationServiceInterface;
  envSecretProvider?: EnvSecretProvider;
  vaultSecretProvider?: VaultSecretProvider;
  serviceAccountContextFactory?: ServiceAccountContextFactory;
  env?: Record<string, string | undefined>;
};

export class SecurityControlService implements SecretManager {
  private readonly repositories: SecurityRepositories;
  private readonly policyService: PolicyService;
  private readonly authorizationService?: AuthorizationServiceInterface;
  private readonly serviceAccountContextFactory?: ServiceAccountContextFactory;
  private readonly envSecretProvider: EnvSecretProvider;
  private readonly vaultSecretProvider: VaultSecretProvider;
  private readonly scopeContextFactory = new ScopeContextFactory();

  constructor(input: SecurityControlServiceInput = {}) {
    this.repositories = input.repositories ?? createInMemorySecurityRepositories();
    this.policyService = input.policyService ?? new PolicyService();
    this.authorizationService = input.authorizationService;
    this.serviceAccountContextFactory = input.serviceAccountContextFactory ?? (input.authorizationService
      ? new ServiceAccountContextFactory({ authorizationService: input.authorizationService })
      : undefined);
    this.envSecretProvider = input.envSecretProvider ?? createEnvSecretProviderFromEnv(input.env);
    this.vaultSecretProvider = input.vaultSecretProvider ?? createVaultSecretProviderFromEnv(input.env);
  }

  getManagerKind(): SecretManagerKind {
    const envEnabled = this.envSecretProvider.getConfig().enabled;
    const vaultEnabled = this.vaultSecretProvider.getConfig().vaultProviderEnabled;
    if (envEnabled && vaultEnabled) return "mock_with_env_and_vault_secret_provider";
    if (vaultEnabled) return "mock_with_vault_secret_provider";
    return envEnabled ? "mock_with_env_secret_provider" : "mock";
  }

  getConfig() {
    const defaultSandbox = this.getDefaultSandboxProfile();
    const networkPolicy = this.repositories.networkEgressPolicies.listNetworkEgressPolicies().find((item) => item.status === "active");
    const envSecretProvider = this.envSecretProvider.getConfig();
    const vaultSecretProvider = this.vaultSecretProvider.getConfig();
    const activeSecretRefs = this.repositories.secretRefs.listSecretRefs().filter((item) => item.status === "active");
    const activeVaultSecretRefs = activeSecretRefs.filter((item) => item.provider === "vault");
    const activeEnvSecretRefs = activeSecretRefs.filter((item) => item.provider === "env");
    return {
      secretManagerKind: this.getManagerKind(),
      credentialManagerKind: vaultSecretProvider.selectedProvider === "vault" && vaultSecretProvider.vaultProviderEnabled ? "secretref_vault_v1" : "secretref_env_v1",
      secretBackendProviderSelected: vaultSecretProvider.selectedProvider,
      envSecretProviderEnabled: envSecretProvider.enabled,
      allowedSecretEnvKeyCount: envSecretProvider.allowedEnvKeyCount,
      vaultSecretProviderEnabled: vaultSecretProvider.vaultProviderEnabled,
      vaultAddressConfigured: vaultSecretProvider.vaultAddressConfigured,
      vaultNamespaceConfigured: vaultSecretProvider.vaultNamespaceConfigured,
      vaultAuthMethod: vaultSecretProvider.vaultAuthMethod,
      vaultAllowedPathPrefixCount: vaultSecretProvider.vaultAllowedPathPrefixCount,
      vaultIntegrationTestsEnabled: vaultSecretProvider.vaultIntegrationTestsEnabled,
      vaultClientKind: this.vaultSecretProvider.getClientKind(),
      vaultConfigStatus: vaultSecretProvider.configStatus,
      vaultLiveUsageReady: vaultSecretProvider.liveUsageReady,
      vaultTokenConfigured: vaultSecretProvider.vaultTokenConfigured,
      productionSecretBackendImplemented: false,
      envFallbackProductionAllowed: false,
      activeSecretRefCount: activeSecretRefs.length,
      activeVaultSecretRefCount: activeVaultSecretRefs.length,
      activeEnvSecretRefCount: activeEnvSecretRefs.length,
      githubCredentialConfigured: this.credentialConfiguredFor("github_token"),
      githubAppPrivateKeyConfigured: this.credentialConfiguredFor("github_app_private_key"),
      githubWebhookSecretConfigured: this.credentialConfiguredFor("github_webhook_secret") || this.credentialConfiguredFor("webhook_secret"),
      llmCredentialConfigured: this.credentialConfiguredFor("llm_api_key"),
      sandboxSupportStatus: "model_only",
      defaultSandboxProfile: defaultSandbox?.id ?? "none",
      networkDefaultAction: networkPolicy?.defaultAction ?? "deny",
      redactionEnabled: this.repositories.redactionPolicies.listRedactionPolicies().some((item) => item.status === "active"),
      productionSecretInjection: false,
      productionSandboxRuntime: false
    };
  }

  getVaultConfig(): VaultSecretProviderConfig {
    return this.vaultSecretProvider.getConfig();
  }

  getVaultHealth(): VaultClientHealth {
    return this.vaultSecretProvider.healthCheck();
  }

  listVaultReadinessChecks() {
    const config = this.getVaultConfig();
    return [
      {
        id: "vault_provider_non_default",
        category: "config",
        status: config.selectedProvider === "vault" ? "warning" : "pass",
        severity: "low",
        summary: "Vault is not the default backend unless explicitly selected.",
        metadata: {
          selectedProvider: config.selectedProvider,
          containsSecretMaterial: false
        }
      },
      {
        id: "vault_enable_gate",
        category: "config",
        status: config.vaultProviderEnabled ? "pass" : "skipped",
        severity: "medium",
        summary: "Vault reads require AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true.",
        metadata: {
          enabled: config.vaultProviderEnabled,
          containsSecretMaterial: false
        }
      },
      {
        id: "vault_address_configured",
        category: "config",
        status: config.vaultAddressConfigured ? "pass" : config.selectedProvider === "vault" ? "fail" : "skipped",
        severity: "high",
        summary: "Live Vault usage requires a configured address, but the address value is never returned.",
        metadata: {
          configured: config.vaultAddressConfigured,
          containsSecretMaterial: false
        }
      },
      {
        id: "vault_auth_configured",
        category: "auth",
        status: config.vaultAuthMethod === "token" && config.vaultTokenConfigured ? "pass" : config.selectedProvider === "vault" ? "fail" : "skipped",
        severity: "high",
        summary: "Vault v1 supports gated token auth only; token values are hidden.",
        metadata: {
          authMethod: config.vaultAuthMethod,
          tokenConfigured: config.vaultTokenConfigured,
          containsSecretMaterial: false
        }
      },
      {
        id: "vault_path_allowlist",
        category: "policy",
        status: config.vaultAllowedPathPrefixCount > 0 ? "pass" : "warning",
        severity: "medium",
        summary: "Allowed path prefixes constrain Vault SecretRefs when configured.",
        metadata: {
          allowedPathPrefixCount: config.vaultAllowedPathPrefixCount,
          containsSecretMaterial: false
        }
      },
      {
        id: "vault_default_tests_skip_live",
        category: "tests",
        status: config.vaultIntegrationTestsEnabled ? "warning" : "pass",
        severity: "medium",
        summary: "Live Vault integration tests are skipped unless every explicit gate is configured.",
        metadata: {
          integrationTestsEnabled: config.vaultIntegrationTestsEnabled,
          containsSecretMaterial: false
        }
      }
    ];
  }

  getVaultSummary() {
    const config = this.getVaultConfig();
    const checks = this.listVaultReadinessChecks();
    const failing = checks.filter((check) => check.status === "fail");
    return {
      status: config.configStatus,
      provider: "vault",
      selectedProvider: config.selectedProvider,
      vaultProviderEnabled: config.vaultProviderEnabled,
      vaultAddressConfigured: config.vaultAddressConfigured,
      vaultNamespaceConfigured: config.vaultNamespaceConfigured,
      vaultAuthMethod: config.vaultAuthMethod,
      vaultAllowedPathPrefixCount: config.vaultAllowedPathPrefixCount,
      vaultIntegrationTestsEnabled: config.vaultIntegrationTestsEnabled,
      vaultClientKind: this.vaultSecretProvider.getClientKind(),
      liveUsageReady: config.liveUsageReady,
      checkCount: checks.length,
      failingCheckCount: failing.length,
      productionSecretBackendImplemented: false,
      envFallbackProductionAllowed: false,
      noSecretsExposed: true,
      noEnvValuesExposed: true,
      containsSecretMaterial: false
    };
  }

  listSecretRefs(): SecretRef[] {
    return this.repositories.secretRefs.listSecretRefs();
  }

  listSecretScopes() {
    return this.repositories.secretScopes.listSecretScopes();
  }

  listSecretLeases(filter: { taskId?: string; taskRunId?: string; status?: SecretLease["status"] } = {}) {
    return this.repositories.secretLeases.listSecretLeases(filter);
  }

  listSecretAccessDecisions(filter: { taskId?: string; taskRunId?: string; actorId?: string } = {}) {
    return this.repositories.secretAccessDecisions.listSecretAccessDecisions(filter);
  }

  listSandboxProfiles(): SandboxProfile[] {
    return this.repositories.sandboxProfiles.listSandboxProfiles();
  }

  getDefaultSandboxProfile(): SandboxProfile | undefined {
    return this.repositories.sandboxProfiles.getSandboxProfile("sandbox_default_deny");
  }

  getSafeLocalSandboxProfile(): SandboxProfile | undefined {
    return this.repositories.sandboxProfiles.getSandboxProfile("sandbox_local_temp_fixture");
  }

  listSandboxSessions(filter: { taskId?: string; taskRunId?: string; status?: SandboxSession["status"] } = {}) {
    return this.repositories.sandboxSessions.listSandboxSessions(filter);
  }

  listSandboxDecisions(filter: { taskId?: string; taskRunId?: string; actorId?: string } = {}) {
    return this.repositories.sandboxDecisions.listSandboxDecisions(filter);
  }

  listNetworkEgressPolicies() {
    return this.repositories.networkEgressPolicies.listNetworkEgressPolicies();
  }

  listRedactionPolicies() {
    return this.repositories.redactionPolicies.listRedactionPolicies();
  }

  listAuditEvents(filter: { targetKind?: SecurityAuditEvent["targetKind"]; eventType?: string; taskId?: string; taskRunId?: string; actorId?: string } = {}) {
    return this.repositories.audit.listSecurityAuditEvents(filter);
  }

  validateSecretRef(secretRef: SecretRef): SecretRefValidationResult {
    const errors: string[] = [];
    if (!secretRef.id) errors.push("secret ref id is required");
    if (!secretRef.name) errors.push("secret ref name is required");
    if (!isSecretProviderKind(secretRef.provider)) errors.push("secret ref provider is invalid");
    if (!isSecretKind(secretRef.secretKind)) errors.push("secret ref secretKind is invalid");
    if (!isSecretRefStatus(secretRef.status)) errors.push("secret ref status is invalid");
    if (secretRef.provider === "env" && !secretRef.envKey) errors.push("env secret ref requires envKey");
    if (secretRef.provider === "vault") {
      errors.push(...this.vaultSecretProvider.validateSecretRef(secretRef).errors);
    }
    if (secretRef.envKey && !isSafeEnvKeyReference(secretRef.envKey)) errors.push("secret envKey must be a safe env var reference");
    if (hasRawSecretMaterial(secretRef.metadata)) errors.push("secret ref metadata must not contain raw secret material");
    if (looksLikeCredentialCachePath(secretRef.name) || looksLikeCredentialCachePath(secretRef.scope) || (secretRef.envKey !== undefined && looksLikeCredentialCachePath(secretRef.envKey))) {
      errors.push("credential cache paths are not valid secret references");
    }
    this.recordAudit({
      targetKind: "secret",
      targetId: secretRef.id,
      eventType: "secret_ref_validated",
      result: errors.length === 0 ? "allowed" : "blocked",
      reason: errors.length === 0 ? undefined : errors.join("; "),
      metadata: {
        provider: secretRef.provider,
        secretKind: secretRef.secretKind,
        envKeyConfigured: Boolean(secretRef.envKey),
        status: secretRef.status
      }
    });
    return { ok: errors.length === 0, errors };
  }

  createSecretRef(input: Omit<SecretRef, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): SecretRef {
    if (this.repositories.secretRefs.getSecretRef(input.id)) {
      throw new Error(`Secret ref already exists: ${input.id}`);
    }
    const now = new Date();
    const secretRefForValidation: SecretRef = {
      ...input,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      metadata: input.metadata ?? {}
    };
    const validation = this.validateSecretRef(secretRefForValidation);
    if (!validation.ok) {
      throw new Error(validation.errors.join("; "));
    }
    const secretRef: SecretRef = {
      ...secretRefForValidation,
      metadata: sanitizeMetadata(secretRefForValidation.metadata)
    };
    const saved = this.repositories.secretRefs.saveSecretRef(secretRef);
    this.recordAudit({
      targetKind: "secret",
      targetId: saved.id,
      eventType: "credential_secret_ref_created",
      result: "created",
      metadata: {
        provider: saved.provider,
        secretKind: saved.secretKind,
        envKeyConfigured: Boolean(saved.envKey),
        status: saved.status
      }
    });
    return saved;
  }

  updateSecretRefStatus(secretRefId: string, status: SecretRef["status"], actorId?: string): SecretRef {
    if (!isSecretRefStatus(status)) {
      throw new Error(`Invalid secret ref status: ${status}`);
    }
    const secretRef = this.repositories.secretRefs.getSecretRef(secretRefId);
    if (!secretRef) {
      throw new Error(`Secret ref not found: ${secretRefId}`);
    }
    const updated = this.repositories.secretRefs.saveSecretRef({
      ...secretRef,
      status,
      updatedAt: new Date()
    });
    this.recordAudit({
      targetKind: "secret",
      targetId: secretRefId,
      eventType: status === "revoked" ? "credential_secret_ref_revoked" : status === "disabled" ? "credential_secret_ref_disabled" : "credential_secret_ref_created",
      result: "updated",
      actorId,
      metadata: {
        provider: updated.provider,
        secretKind: updated.secretKind,
        status
      }
    });
    return updated;
  }

  getSecretMetadata(secretRefId: string): SecretRef | undefined {
    return this.repositories.secretRefs.getSecretRef(secretRefId);
  }

  resolveCredential(request: CredentialResolutionRequest): CredentialResolutionResult {
    const result = this.resolveCredentialInternal(request, false);
    const { value: _value, ...dto } = result;
    return dto;
  }

  resolveCredentialForInternalUse(request: CredentialResolutionRequest): InternalCredentialResolutionResult {
    return this.resolveCredentialInternal(request, true);
  }

  requestLease(request: SecretLeaseRequest): SecretLease {
    const secretRef = this.repositories.secretRefs.getSecretRef(request.secretRefId);
    const scope = this.repositories.secretScopes.getSecretScope(request.scopeId);
    const policyDecision = this.evaluatePolicy({
      action: "secret.lease.request",
      resourceKind: "secret_lease",
      resourceId: request.secretRefId,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      environment: {
        secretRefExists: Boolean(secretRef),
        scopeExists: Boolean(scope),
        requiresApproval: scope?.requiresApproval ?? true,
        provider: secretRef?.provider ?? "unknown"
      },
      metadata: {
        scopeId: request.scopeId
      }
    });
    const decision = this.saveSecretAccessDecision({
      allowed: policyDecision.allowed,
      decision: policyDecision.decision === "allow" ? "allow" : policyDecision.decision === "require_approval" ? "require_approval" : "deny",
      reason: policyDecision.reason,
      secretRefId: request.secretRefId,
      scopeId: request.scopeId,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      policyDecisionId: policyDecision.id
    });
    const now = new Date();
    const status: SecretLease["status"] = decision.allowed ? "issued" : "denied";
    const lease = this.repositories.secretLeases.saveSecretLease({
      id: createId("secretlease"),
      secretRefId: request.secretRefId,
      scopeId: request.scopeId,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      status,
      issuedAt: status === "issued" ? now : undefined,
      expiresAt: status === "issued" ? new Date(now.getTime() + Math.min(request.ttlSeconds ?? scope?.maxTtlSeconds ?? 60, scope?.maxTtlSeconds ?? 60) * 1000) : undefined,
      reason: status === "issued" ? "mock lease issued without secret material" : policyDecision.reason
    });
    this.recordAudit({
      targetKind: "secret",
      targetId: request.secretRefId,
      eventType: "secret_lease_requested",
      result: "blocked",
      reason: request.reason,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      metadata: {
        leaseId: lease.id,
        scopeId: request.scopeId,
        policyDecisionId: policyDecision.id
      }
    });
    this.recordAudit({
      targetKind: "secret",
      targetId: lease.id,
      eventType: status === "issued" ? "secret_lease_issued_mock" : "secret_lease_denied",
      result: status === "issued" ? "created" : "blocked",
      reason: lease.reason,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      metadata: {
        secretRefId: request.secretRefId,
        scopeId: request.scopeId,
        decisionId: decision.id
      }
    });
    return lease;
  }

  revokeLease(leaseId: string): SecretLease {
    const lease = this.repositories.secretLeases.getSecretLease(leaseId);
    if (!lease) {
      throw new Error(`Secret lease not found: ${leaseId}`);
    }
    const policyDecision = this.evaluatePolicy({
      action: "secret.lease.revoke",
      resourceKind: "secret_lease",
      resourceId: leaseId,
      taskId: lease.taskId,
      taskRunId: lease.taskRunId,
      actorId: lease.actorId,
      metadata: {
        secretRefId: lease.secretRefId,
        scopeId: lease.scopeId
      }
    });
    if (!policyDecision.allowed) {
      throw new Error(policyDecision.reason);
    }
    const revoked = this.repositories.secretLeases.saveSecretLease({
      ...lease,
      status: "revoked",
      revokedAt: new Date(),
      reason: "lease_revoked"
    });
    this.recordAudit({
      targetKind: "secret",
      targetId: leaseId,
      eventType: "secret_lease_revoked",
      result: "updated",
      taskId: lease.taskId,
      taskRunId: lease.taskRunId,
      actorId: lease.actorId,
      metadata: {
        secretRefId: lease.secretRefId,
        scopeId: lease.scopeId
      }
    });
    return revoked;
  }

  getSafeEnvironment(leaseId: string): SafeEnvironmentResult {
    const lease = this.repositories.secretLeases.getSecretLease(leaseId);
    if (!lease || lease.status !== "issued") {
      return { ok: false, leaseId, env: {}, reason: "secret_lease_not_issued" };
    }
    return {
      ok: true,
      leaseId,
      env: {
        AICHESTRA_SECRET_PLACEHOLDER: "mock-secret-not-materialized"
      },
      reason: "mock_placeholder_only"
    };
  }

  createSandboxSession(request: SandboxSessionRequest): { session?: SandboxSession; decision: SandboxDecision } {
    const profile = this.repositories.sandboxProfiles.getSandboxProfile(request.profileId);
    const policyDecision = this.evaluatePolicy({
      action: "sandbox.profile.use",
      resourceKind: "sandbox_profile",
      resourceId: request.profileId,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      runnerKind: request.runnerKind,
      environment: {
        sandboxKind: profile?.kind ?? "unknown",
        profileStatus: profile?.status ?? "missing",
        networkAllowed: profile?.allowNetwork ?? true,
        secretsAllowed: profile?.allowSecrets ?? true,
        remoteGitAllowed: profile?.allowGitRemote ?? true,
        shellExecutionAllowed: profile?.allowShellExecution ?? false
      },
      metadata: {
        workspaceId: request.workspaceId
      }
    });
    const sessionPolicyDecision = this.evaluatePolicy({
      action: "sandbox.session.create",
      resourceKind: "sandbox_session",
      resourceId: request.profileId,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      runnerKind: request.runnerKind,
      environment: {
        sandboxKind: profile?.kind ?? "unknown",
        profileStatus: profile?.status ?? "missing",
        networkAllowed: profile?.allowNetwork ?? true,
        secretsAllowed: profile?.allowSecrets ?? true,
        remoteGitAllowed: profile?.allowGitRemote ?? true,
        shellExecutionAllowed: profile?.allowShellExecution ?? false
      },
      metadata: {
        workspaceId: request.workspaceId
      }
    });
    const allowedByPolicy = policyDecision.allowed && sessionPolicyDecision.allowed;
    const decision = this.repositories.sandboxDecisions.saveSandboxDecision({
      id: createId("sandboxdecision"),
      allowed: allowedByPolicy && profile !== undefined && profile.status === "active",
      decision: allowedByPolicy && profile !== undefined && profile.status === "active" ? "allow" : policyDecision.decision === "require_approval" || sessionPolicyDecision.decision === "require_approval" ? "require_approval" : "deny",
      reason: profile === undefined ? "sandbox_profile_not_found" : profile.status !== "active" ? "sandbox_profile_disabled" : policyDecision.allowed ? sessionPolicyDecision.reason : policyDecision.reason,
      profileId: request.profileId,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      policyDecisionId: policyDecision.allowed ? sessionPolicyDecision.id : policyDecision.id,
      createdAt: new Date()
    });
    this.recordAudit({
      targetKind: "sandbox",
      targetId: request.profileId,
      eventType: "sandbox_profile_selected",
      result: decision.allowed ? "allowed" : "blocked",
      reason: decision.reason,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      metadata: {
        policyDecisionId: policyDecision.id,
        workspaceId: request.workspaceId
      }
    });
    this.recordAudit({
      targetKind: "sandbox",
      targetId: request.profileId,
      eventType: "sandbox_session_requested",
      result: decision.allowed ? "allowed" : "blocked",
      reason: decision.reason,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      metadata: {
        workspaceId: request.workspaceId
      }
    });
    if (!decision.allowed) {
      return { decision };
    }
    const session = this.repositories.sandboxSessions.saveSandboxSession({
      id: createId("sandboxsession"),
      profileId: request.profileId,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      runnerKind: request.runnerKind,
      workspaceId: request.workspaceId,
      status: "active",
      createdAt: new Date(),
      metadata: sanitizeMetadata(request.metadata ?? {})
    });
    this.recordAudit({
      targetKind: "sandbox",
      targetId: session.id,
      eventType: "sandbox_session_created",
      result: "created",
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      metadata: {
        profileId: request.profileId,
        workspaceId: request.workspaceId
      }
    });
    return { session, decision };
  }

  completeSandboxSession(sessionId: string): SandboxSession {
    const session = this.repositories.sandboxSessions.getSandboxSession(sessionId);
    if (!session) throw new Error(`Sandbox session not found: ${sessionId}`);
    const completed = this.repositories.sandboxSessions.saveSandboxSession({
      ...session,
      status: "completed",
      completedAt: new Date()
    });
    this.recordAudit({
      targetKind: "sandbox",
      targetId: sessionId,
      eventType: "sandbox_session_completed",
      result: "updated",
      taskId: session.taskId,
      taskRunId: session.taskRunId,
      metadata: { profileId: session.profileId }
    });
    return completed;
  }

  cleanupSandboxSession(sessionId: string): SandboxSession {
    const session = this.repositories.sandboxSessions.getSandboxSession(sessionId);
    if (!session) throw new Error(`Sandbox session not found: ${sessionId}`);
    const cleaned = this.repositories.sandboxSessions.saveSandboxSession({
      ...session,
      status: "cleaned_up",
      cleanupAt: new Date()
    });
    this.recordAudit({
      targetKind: "sandbox",
      targetId: sessionId,
      eventType: "sandbox_session_cleaned_up",
      result: "updated",
      taskId: session.taskId,
      taskRunId: session.taskRunId,
      metadata: { profileId: session.profileId }
    });
    return cleaned;
  }

  evaluateNetworkEgress(input: { policyId?: string; host?: string; port?: number; taskId?: string; taskRunId?: string; actorId?: string; metadata?: Record<string, unknown> } = {}): NetworkEgressDecision {
    const policy = input.policyId
      ? this.repositories.networkEgressPolicies.getNetworkEgressPolicy(input.policyId)
      : this.repositories.networkEgressPolicies.listNetworkEgressPolicies().find((item) => item.status === "active");
    const policyDecision = this.evaluatePolicy({
      action: "network.egress",
      resourceKind: "network_egress_policy",
      resourceId: policy?.id ?? "network_default_deny",
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      actorId: input.actorId,
      environment: {
        defaultAction: policy?.defaultAction ?? "deny",
        allowLocalhost: policy?.allowLocalhost ?? false,
        allowPrivateNetwork: policy?.allowPrivateNetwork ?? false
      },
      metadata: {
        host: input.host,
        port: input.port,
        ...input.metadata
      }
    });
    const blockedByModel = policy === undefined || policy.status !== "active" || policy.defaultAction === "deny" || (input.host !== undefined && policy.deniedHosts.includes(input.host));
    const decision = {
      id: createId("networkdecision"),
      allowed: policyDecision.allowed && !blockedByModel,
      reason: policyDecision.allowed && !blockedByModel ? "network_egress_allowed_by_model" : "network_egress_blocked",
      policyId: policy?.id ?? "network_default_deny",
      host: input.host,
      port: input.port,
      policyDecisionId: policyDecision.id,
      createdAt: new Date()
    };
    if (!decision.allowed) {
      this.recordAudit({
        targetKind: "network",
        targetId: decision.policyId,
        eventType: "network_egress_blocked",
        result: "blocked",
        reason: decision.reason,
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        actorId: input.actorId,
        metadata: {
          host: input.host,
          port: input.port,
          policyDecisionId: policyDecision.id
        }
      });
    }
    return decision;
  }

  redactText(input: { text: string; policyId?: string; taskId?: string; taskRunId?: string; actorId?: string; metadata?: Record<string, unknown> }): RedactionResult {
    const policy = input.policyId
      ? this.repositories.redactionPolicies.getRedactionPolicy(input.policyId)
      : this.repositories.redactionPolicies.listRedactionPolicies().find((item) => item.status === "active");
    if (!policy) {
      return {
        policyId: input.policyId ?? "none",
        redactedText: "",
        preview: "",
        redactionApplied: true,
        truncated: true,
        originalBytes: Buffer.byteLength(input.text),
        previewBytes: 0
      };
    }
    const result = redactWithPolicy(input.text, policy);
    if (result.redactionApplied || result.truncated) {
      this.recordAudit({
        targetKind: "redaction",
        targetId: policy.id,
        eventType: result.redactionApplied ? "redaction_applied" : "unsafe_output_truncated",
        result: "redacted",
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        actorId: input.actorId,
        metadata: {
          originalBytes: result.originalBytes,
          previewBytes: result.previewBytes,
          truncated: result.truncated,
          ...sanitizeMetadata(input.metadata ?? {})
        }
      });
      if (result.redactionApplied && result.truncated) {
        this.recordAudit({
          targetKind: "redaction",
          targetId: policy.id,
          eventType: "unsafe_output_truncated",
          result: "redacted",
          taskId: input.taskId,
          taskRunId: input.taskRunId,
          actorId: input.actorId,
          metadata: {
            originalBytes: result.originalBytes,
            previewBytes: result.previewBytes
          }
        });
      }
    }
    return result;
  }

  recordSecretAudit(event: Omit<SecurityAuditEvent, "id" | "createdAt" | "targetKind">): SecurityAuditEvent {
    return this.recordAudit({ ...event, targetKind: "secret" });
  }

  private resolveCredentialInternal(request: CredentialResolutionRequest, includeValue: boolean): InternalCredentialResolutionResult {
    const createdAt = new Date();
    const resolutionId = createId("credres");
    const providerKind = providerKindForCredentialRequest(request);
    const authContext = this.resolveCredentialAuthContext(request);
    const actorId = authContext?.actor.id ?? request.actorId;
    const principalId = authContext?.principal.id ?? request.principalId;
    const requestMetadata = this.requestContextMetadata(request, authContext);
    const secretRef = this.repositories.secretRefs.getSecretRef(request.secretRefId);
    this.recordAudit({
      targetKind: "secret",
      targetId: request.secretRefId,
      eventType: "credential_resolution_requested",
      result: "allowed",
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId,
      principalId,
      metadata: {
        resolutionId,
        purpose: request.purpose,
        providerId: request.providerId,
        providerKind,
        authMode: authContext?.authMode,
        ...requestMetadata,
        secretRefExists: Boolean(secretRef)
      }
    });

    if (!secretRef) {
      return this.finishCredentialResolution(request, {
        id: resolutionId,
        allowed: false,
        status: "missing",
        blockedReason: "secret_ref_missing",
        createdAt
      }, "credential_resolution_missing", undefined, authContext);
    }

    if (secretRef.status === "disabled") {
      return this.finishCredentialResolution(request, {
        id: resolutionId,
        allowed: false,
        status: "denied",
        blockedReason: "secret_ref_disabled",
        createdAt
      }, "credential_resolution_denied", secretRef, authContext);
    }

    if (secretRef.status === "revoked") {
      return this.finishCredentialResolution(request, {
        id: resolutionId,
        allowed: false,
        status: "denied",
        blockedReason: "secret_ref_revoked",
        createdAt
      }, "credential_resolution_revoked", secretRef, authContext);
    }

    const validation = this.validateSecretRef(secretRef);
    if (!validation.ok) {
      return this.finishCredentialResolution(request, {
        id: resolutionId,
        allowed: false,
        status: "denied",
        blockedReason: validation.errors[0] ?? "secret_ref_invalid",
        createdAt
      }, "credential_resolution_denied", secretRef, authContext);
    }

    const environment = this.credentialPolicyEnvironment(request, secretRef);
    const authorizationDecision = this.evaluateCredentialAuthorization(request, authContext, secretRef, providerKind, environment);
    if (authorizationDecision && !authorizationDecision.allowed) {
      return this.finishCredentialResolution(request, {
        id: resolutionId,
        allowed: false,
        status: "denied",
        blockedReason: `authorization_denied:${authorizationDecision.reason}`,
        policyDecisionId: authorizationDecision.policyDecision?.id,
        authorizationDecisionId: authorizationDecision.auditEvent?.id,
        createdAt
      }, authorizationDecision.reason.startsWith("policy_denied:") ? "credential_resolution_policy_denied" : "credential_resolution_authorization_denied", secretRef, authContext);
    }

    const purposePolicyAction = credentialPolicyActionForPurpose(request);
    const purposePolicy = purposePolicyAction
      ? this.evaluatePolicy({
        action: purposePolicyAction,
        resourceKind: "provider_credential",
        resourceId: secretRef.id,
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId,
        authContext,
        environment,
        metadata: {
          purpose: request.purpose,
          providerId: request.providerId,
          providerKind,
          credentialSource: "secret_ref",
          secretKind: secretRef.secretKind
        }
      })
      : undefined;
    if (purposePolicy && !purposePolicy.allowed) {
      return this.finishCredentialResolution(request, {
        id: resolutionId,
        allowed: false,
        status: "denied",
        blockedReason: purposePolicy.reason,
        policyDecisionId: purposePolicy.id,
        authorizationDecisionId: authorizationDecision?.auditEvent?.id,
        createdAt
      }, "credential_resolution_policy_denied", secretRef, authContext);
    }

    const credentialPolicy = this.evaluatePolicy({
      action: "provider.credential.resolve",
      resourceKind: "provider_credential",
      resourceId: secretRef.id,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId,
      authContext,
      environment,
      metadata: {
        purpose: request.purpose,
        providerId: request.providerId,
        providerKind,
        credentialSource: "secret_ref",
        secretKind: secretRef.secretKind
      }
    });
    if (!credentialPolicy.allowed) {
      return this.finishCredentialResolution(request, {
        id: resolutionId,
        allowed: false,
        status: "denied",
        blockedReason: credentialPolicy.reason,
        policyDecisionId: credentialPolicy.id,
        authorizationDecisionId: authorizationDecision?.auditEvent?.id,
        createdAt
      }, "credential_resolution_policy_denied", secretRef, authContext);
    }

    const leaseRequestPolicy = this.evaluatePolicy({
      action: "secret.lease.request",
      resourceKind: "secret_lease",
      resourceId: secretRef.id,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId,
      authContext,
      environment,
      metadata: {
        purpose: request.purpose,
        providerId: request.providerId,
        providerKind,
        secretKind: secretRef.secretKind
      }
    });
    if (!leaseRequestPolicy.allowed) {
      return this.finishCredentialResolution(request, {
        id: resolutionId,
        allowed: false,
        status: "denied",
        blockedReason: leaseRequestPolicy.reason,
        policyDecisionId: leaseRequestPolicy.id,
        authorizationDecisionId: authorizationDecision?.auditEvent?.id,
        createdAt
      }, "credential_resolution_policy_denied", secretRef, authContext);
    }

    const leaseIssuePolicy = this.evaluatePolicy({
      action: "secret.lease.issue",
      resourceKind: "secret_lease",
      resourceId: secretRef.id,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId,
      authContext,
      environment,
      metadata: {
        purpose: request.purpose,
        providerId: request.providerId,
        providerKind,
        secretKind: secretRef.secretKind
      }
    });
    if (!leaseIssuePolicy.allowed) {
      return this.finishCredentialResolution(request, {
        id: resolutionId,
        allowed: false,
        status: "denied",
        blockedReason: leaseIssuePolicy.reason,
        policyDecisionId: leaseIssuePolicy.id,
        authorizationDecisionId: authorizationDecision?.auditEvent?.id,
        createdAt
      }, "credential_resolution_policy_denied", secretRef, authContext);
    }

    let credentialValue: string | undefined;
    let providerMetadata: Record<string, unknown> = {};
    let leaseReason = "secret_provider_credential_handle_issued";
    if (secretRef.provider === "env") {
      const envResult = this.envSecretProvider.resolve(secretRef);
      if (!envResult.ok || !envResult.value) {
        const eventType = envResult.reason === "env_secret_provider_disabled"
          ? "credential_env_provider_disabled"
          : envResult.reason === "env_key_not_allowlisted"
            ? "credential_env_key_not_allowlisted"
            : envResult.status === "missing"
              ? "credential_resolution_missing"
              : "credential_resolution_denied";
        return this.finishCredentialResolution(request, {
          id: resolutionId,
          allowed: false,
          status: envResult.status,
          blockedReason: envResult.reason ?? "credential_resolution_failed",
          policyDecisionId: leaseIssuePolicy.id,
          authorizationDecisionId: authorizationDecision?.auditEvent?.id,
          createdAt
        }, eventType, secretRef, authContext);
      }
      credentialValue = envResult.value;
      providerMetadata = {
        envKeyConfigured: Boolean(secretRef.envKey),
        credentialProvider: "env"
      };
      leaseReason = "env_secret_provider_credential_handle_issued";
    } else if (secretRef.provider === "vault") {
      const vaultMetadata = vaultMetadataFromSecretRef(secretRef);
      this.recordAudit({
        targetKind: "secret",
        targetId: secretRef.id,
        eventType: "vault_secret_provider_selected",
        result: "allowed",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId,
        principalId,
        metadata: {
          resolutionId,
          purpose: request.purpose,
          providerId: request.providerId,
          providerKind,
          clientKind: this.vaultSecretProvider.getClientKind(),
          selectedProvider: this.vaultSecretProvider.getConfig().selectedProvider,
          ...requestMetadata,
          containsSecretMaterial: false
        }
      });
      const pathAllowed = this.vaultSecretProvider.isSecretRefPathAllowed(secretRef);
      this.recordAudit({
        targetKind: "secret",
        targetId: secretRef.id,
        eventType: "vault_path_allowlist_checked",
        result: pathAllowed ? "allowed" : "blocked",
        reason: pathAllowed ? "vault_path_allowlisted" : "vault_path_not_allowlisted",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId,
        principalId,
        metadata: {
          resolutionId,
          allowedPathPrefixCount: this.vaultSecretProvider.getConfig().vaultAllowedPathPrefixCount,
          vaultMountConfigured: Boolean(vaultMetadata.vaultMount),
          vaultPathConfigured: Boolean(vaultMetadata.vaultPath),
          vaultKeyConfigured: Boolean(vaultMetadata.vaultKey),
          ...requestMetadata,
          containsSecretMaterial: false
        }
      });
      if (!pathAllowed) {
        return this.finishCredentialResolution(request, {
          id: resolutionId,
          allowed: false,
          status: "denied",
          blockedReason: "vault_path_not_allowlisted",
          policyDecisionId: leaseIssuePolicy.id,
          authorizationDecisionId: authorizationDecision?.auditEvent?.id,
          createdAt
        }, "vault_path_not_allowlisted", secretRef, authContext);
      }
      this.recordAudit({
        targetKind: "secret",
        targetId: secretRef.id,
        eventType: "vault_secret_resolution_requested",
        result: "allowed",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId,
        principalId,
        metadata: {
          resolutionId,
          purpose: request.purpose,
          providerId: request.providerId,
          providerKind,
          secretKind: secretRef.secretKind,
          clientKind: this.vaultSecretProvider.getClientKind(),
          ...requestMetadata,
          containsSecretMaterial: false
        }
      });
      const vaultResult = this.vaultSecretProvider.resolveSecret(secretRef);
      if (!vaultResult.ok || !vaultResult.value) {
        const eventType: SecurityAuditEvent["eventType"] = vaultResult.status === "missing"
          ? "vault_secret_resolution_missing"
          : vaultResult.status === "unavailable"
            ? "vault_secret_resolution_unavailable"
            : "vault_secret_resolution_forbidden";
        return this.finishCredentialResolution(request, {
          id: resolutionId,
          allowed: false,
          status: vaultResult.status,
          blockedReason: vaultResult.reason ?? "vault_secret_resolution_failed",
          policyDecisionId: leaseIssuePolicy.id,
          authorizationDecisionId: authorizationDecision?.auditEvent?.id,
          createdAt
        }, eventType, secretRef, authContext);
      }
      credentialValue = vaultResult.value;
      providerMetadata = {
        ...vaultResult.metadata,
        credentialProvider: "vault",
        vaultMountConfigured: Boolean(vaultMetadata.vaultMount),
        vaultPathConfigured: Boolean(vaultMetadata.vaultPath),
        vaultKeyConfigured: Boolean(vaultMetadata.vaultKey),
        vaultVersionConfigured: vaultMetadata.vaultVersion !== undefined,
        containsSecretMaterial: false
      };
      leaseReason = "vault_secret_provider_credential_handle_issued";
      this.recordAudit({
        targetKind: "secret",
        targetId: secretRef.id,
        eventType: "vault_secret_resolution_allowed",
        result: "allowed",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId,
        principalId,
        metadata: {
          resolutionId,
          purpose: request.purpose,
          providerId: request.providerId,
          providerKind,
          secretKind: secretRef.secretKind,
          clientKind: this.vaultSecretProvider.getClientKind(),
          ...requestMetadata,
          containsSecretMaterial: false
        }
      });
      this.recordAudit({
        targetKind: "secret",
        targetId: secretRef.id,
        eventType: "vault_secret_value_redacted",
        result: "redacted",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId,
        principalId,
        metadata: {
          resolutionId,
          containsSecretMaterial: false
        }
      });
    } else {
      return this.finishCredentialResolution(request, {
        id: resolutionId,
        allowed: false,
        status: "unavailable",
        blockedReason: "secret_provider_not_implemented",
        policyDecisionId: leaseIssuePolicy.id,
        authorizationDecisionId: authorizationDecision?.auditEvent?.id,
        createdAt
      }, "credential_resolution_denied", secretRef, authContext);
    }

    const scope = this.repositories.secretScopes.getSecretScope(secretRef.scope);
    const ttlSeconds = Math.min(scope?.maxTtlSeconds ?? 300, 300);
    const lease = this.repositories.secretLeases.saveSecretLease({
      id: createId("secretlease"),
      secretRefId: secretRef.id,
      scopeId: secretRef.scope,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId,
      status: "issued",
      issuedAt: createdAt,
      expiresAt: new Date(createdAt.getTime() + ttlSeconds * 1000),
      reason: leaseReason
    });
    this.saveSecretAccessDecision({
      allowed: true,
      decision: "allow",
      reason: credentialPolicy.reason,
      secretRefId: secretRef.id,
      scopeId: secretRef.scope,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId,
      policyDecisionId: credentialPolicy.id
    });

    const handle: CredentialHandle = {
      id: createId("credhandle"),
      secretRefId: secretRef.id,
      secretKind: secretRef.secretKind,
      provider: secretRef.provider,
      status: "resolved",
      expiresAt: lease.expiresAt,
      metadata: {
        purpose: request.purpose,
        providerId: request.providerId,
        providerKind,
        leaseId: lease.id,
        ...providerMetadata,
        containsSecretMaterial: false
      }
    };
    const audit = this.recordAudit({
      targetKind: "secret",
      targetId: secretRef.id,
      eventType: "credential_resolution_allowed",
      result: "allowed",
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId,
      principalId,
      metadata: {
        resolutionId,
        handleId: handle.id,
        leaseId: lease.id,
        purpose: request.purpose,
        providerId: request.providerId,
        providerKind,
        secretKind: secretRef.secretKind,
        authMode: authContext?.authMode,
        authorizationDecisionId: authorizationDecision?.auditEvent?.id,
        policyDecisionId: credentialPolicy.id,
        purposePolicyDecisionId: purposePolicy?.id,
        ...requestMetadata,
        leasePolicyDecisionId: leaseIssuePolicy.id
      }
    });
    this.recordAudit({
      targetKind: "secret",
      targetId: secretRef.id,
      eventType: "credential_value_redacted",
      result: "redacted",
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId,
      principalId,
      metadata: {
        resolutionId,
        handleId: handle.id,
        ...requestMetadata,
        containsSecretMaterial: false
      }
    });
    return {
      id: resolutionId,
      allowed: true,
      status: "resolved",
      credentialHandle: handle,
      policyDecisionId: credentialPolicy.id,
      authorizationDecisionId: authorizationDecision?.auditEvent?.id,
      auditEventId: audit.id,
      createdAt,
      value: includeValue ? credentialValue : undefined
    };
  }

  private finishCredentialResolution(
    request: CredentialResolutionRequest,
    result: InternalCredentialResolutionResult,
    eventType: SecurityAuditEvent["eventType"],
    secretRef?: SecretRef,
    authContext?: AuthContext
  ): InternalCredentialResolutionResult {
    const actorId = authContext?.actor.id ?? request.actorId;
    const principalId = authContext?.principal.id ?? request.principalId;
    const requestMetadata = this.requestContextMetadata(request, authContext);
    if (secretRef?.provider === "vault" && eventType === "credential_resolution_authorization_denied") {
      this.recordAudit({
        targetKind: "secret",
        targetId: secretRef.id,
        eventType: "vault_secret_resolution_auth_denied",
        result: "blocked",
        reason: result.blockedReason,
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId,
        principalId,
        metadata: {
          resolutionId: result.id,
          purpose: request.purpose,
          providerId: request.providerId,
          providerKind: providerKindForCredentialRequest(request),
          authorizationDecisionId: result.authorizationDecisionId,
          ...requestMetadata,
          containsSecretMaterial: false
        }
      });
    }
    if (secretRef?.provider === "vault" && eventType === "credential_resolution_policy_denied") {
      this.recordAudit({
        targetKind: "secret",
        targetId: secretRef.id,
        eventType: "vault_secret_resolution_policy_denied",
        result: "blocked",
        reason: result.blockedReason,
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId,
        principalId,
        metadata: {
          resolutionId: result.id,
          purpose: request.purpose,
          providerId: request.providerId,
          providerKind: providerKindForCredentialRequest(request),
          policyDecisionId: result.policyDecisionId,
          ...requestMetadata,
          containsSecretMaterial: false
        }
      });
    }
    const audit = this.recordAudit({
      targetKind: "secret",
      targetId: secretRef?.id ?? request.secretRefId,
      eventType,
      result: result.status === "missing" ? "blocked" : "blocked",
      reason: result.blockedReason,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId,
      principalId,
      metadata: {
        resolutionId: result.id,
        purpose: request.purpose,
        providerId: request.providerId,
        providerKind: providerKindForCredentialRequest(request),
        secretKind: secretRef?.secretKind,
        authMode: authContext?.authMode,
        policyDecisionId: result.policyDecisionId,
        authorizationDecisionId: result.authorizationDecisionId,
        ...requestMetadata,
        envKeyConfigured: Boolean(secretRef?.envKey),
        vaultMountConfigured: secretRef?.provider === "vault" ? Boolean(vaultMetadataFromSecretRef(secretRef).vaultMount) : undefined,
        vaultPathConfigured: secretRef?.provider === "vault" ? Boolean(vaultMetadataFromSecretRef(secretRef).vaultPath) : undefined,
        vaultKeyConfigured: secretRef?.provider === "vault" ? Boolean(vaultMetadataFromSecretRef(secretRef).vaultKey) : undefined
      }
    });
    return {
      ...result,
      auditEventId: audit.id
    };
  }

  private saveSecretAccessDecision(input: Omit<SecretAccessDecision, "id" | "createdAt">): SecretAccessDecision {
    return this.repositories.secretAccessDecisions.saveSecretAccessDecision({
      id: createId("secretdecision"),
      createdAt: new Date(),
      ...input
    });
  }

  private evaluatePolicy(input: {
    action: PolicyAction;
    resourceKind: PolicyResourceKind;
    resourceId?: string;
    taskId?: string;
    taskRunId?: string;
    actorId?: string;
    authContext?: AuthContext;
    runnerKind?: string;
    environment?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): PolicyDecision {
    return this.policyService.evaluate({
      subject: input.authContext && this.authorizationService
        ? this.authorizationService.toPolicySubject(input.authContext)
        : input.actorId
          ? createPolicySubject({
          actorId: input.actorId ?? "mock-security-actor",
          actorKind: "service",
          roles: ["system"]
          })
          : createServiceAccountPolicySubject("secretref_credential_service", {
            source: "system",
            metadata: { boundary: "security_control_service" }
          }),
      action: input.action,
      resource: createPolicyResource({
        resourceKind: input.resourceKind,
        resourceId: input.resourceId,
        metadata: sanitizeMetadata(input.metadata ?? {})
      }),
      context: createPolicyContext({
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        runnerKind: input.runnerKind,
        environment: input.environment ?? {},
        metadata: {
          source: "security_control_service",
          requestId: input.authContext?.requestId,
          correlationId: stringMetadata(input.authContext?.metadata.correlationId),
          authSource: input.authContext?.source
        }
      })
    });
  }

  private resolveCredentialAuthContext(request: CredentialResolutionRequest): AuthContext | undefined {
    if (!this.authorizationService) return request.authContext;
    if (request.requestContext) return request.requestContext.authContext;
    if (request.authContext) return request.authContext;
    if (!request.actorId) {
      const serviceAccountId = this.repositories.secretRefs.getSecretRef(request.secretRefId)?.provider === "vault"
        ? "vault_credential_resolver_service"
        : "secretref_credential_service";
      return this.serviceAccountContextFactory?.createServiceAccountAuthContext(serviceAccountId, {
        source: "system",
        metadata: {
          credentialResolution: true,
          purpose: request.purpose,
          providerId: request.providerId,
          principalId: request.principalId
        }
      }) ?? this.authorizationService.getAuthContext({
        actorId: serviceAccountId,
        source: "system",
        metadata: {
          credentialResolution: true,
          purpose: request.purpose,
          providerId: request.providerId,
          principalId: request.principalId
        }
      });
    }
    return this.authorizationService.getAuthContext({
      actorId: request.actorId,
      source: "api",
      metadata: {
        credentialResolution: true,
        purpose: request.purpose,
        providerId: request.providerId,
        principalId: request.principalId
      }
    });
  }

  private evaluateCredentialAuthorization(
    request: CredentialResolutionRequest,
    authContext: AuthContext | undefined,
    secretRef: SecretRef,
    providerKind: string,
    environment: Record<string, unknown>
  ): AuthorizationDecision | undefined {
    if (!this.authorizationService || !authContext) return undefined;
    return this.authorizationService.check({
      authContext,
      action: "provider.credential.resolve",
      resource: {
        resourceKind: "provider_credential",
        resourceId: secretRef.id,
        metadata: {
          purpose: request.purpose,
          providerId: request.providerId,
          providerKind,
          secretKind: secretRef.secretKind,
          envKeyConfigured: Boolean(secretRef.envKey)
        }
      },
      policyContext: {
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        providerKind,
        environment,
        metadata: {
          source: "security_control_service",
          credentialResolution: true,
          purpose: request.purpose,
          requestId: authContext.requestId,
          correlationId: stringMetadata(authContext.metadata.correlationId),
          authSource: authContext.source
        }
      }
    });
  }

  private requestContextMetadata(request: { requestContext?: RequestContext; authContext?: AuthContext }, authContext?: AuthContext): Record<string, unknown> {
    const context = request.requestContext;
    const resolvedAuth = context?.authContext ?? authContext ?? request.authContext;
    const secretRefId = stringMetadata((request as { secretRefId?: unknown }).secretRefId);
    const secretRef = secretRefId ? this.repositories.secretRefs.getSecretRef(secretRefId) : undefined;
    return {
      requestId: context?.requestId ?? resolvedAuth?.requestId,
      correlationId: context?.correlationId ?? stringMetadata(resolvedAuth?.metadata.correlationId),
      source: context?.source ?? resolvedAuth?.source,
      actorId: resolvedAuth?.actor.id,
      principalId: resolvedAuth?.principal.id,
      serviceAccountId: stringMetadata(resolvedAuth?.metadata.serviceAccountId),
      authMode: resolvedAuth?.authMode,
      tenantId: context?.tenantId ?? resolvedAuth?.tenantScopes?.[0]?.tenantId,
      teamId: context?.teamId ?? resolvedAuth?.teamScopes?.[0]?.teamId,
      projectId: context?.projectId ?? resolvedAuth?.projectScopes?.[0]?.projectId,
      ...(secretRef ? this.secretScopeMetadata(secretRef, request, resolvedAuth) : { resourceScopes: context?.resourceScopes ?? resolvedAuth?.resourceScopes }),
      ...(!resolvedAuth && !request.authContext && !request.requestContext ? serviceAccountAuditMetadata("secretref_credential_service", { boundary: "security_control_service" }) : {})
    };
  }

  private secretScopeMetadata(
    secretRef: SecretRef,
    request: { requestContext?: RequestContext; authContext?: AuthContext; purpose?: string; providerId?: string },
    authContext?: AuthContext
  ): Record<string, unknown> {
    const tenantId = request.requestContext?.tenantId ?? authContext?.tenantScopes?.[0]?.tenantId;
    const teamId = request.requestContext?.teamId ?? authContext?.teamScopes?.[0]?.teamId;
    const projectId = request.requestContext?.projectId ?? authContext?.projectScopes?.[0]?.projectId;
    const secretScopeBinding = this.scopeContextFactory.createSecretScope({
      tenantId,
      teamId,
      projectId,
      secretRefId: secretRef.id,
      secretKind: secretRef.secretKind,
      provider: secretRef.provider,
      allowedPurposes: request.purpose ? [request.purpose] : [],
      metadata: {
        providerId: request.providerId,
        scopeId: secretRef.scope,
        containsSecretMaterial: false
      }
    });
    const resourceScopes = this.scopeContextFactory.mergeScopes(
      this.scopeContextFactory.toPolicyResourceScope(secretScopeBinding),
      ...(request.requestContext?.resourceScopes ?? authContext?.resourceScopes ?? [])
    );
    return {
      scopeBinding: secretScopeBinding,
      resourceScopes
    };
  }

  private credentialPolicyEnvironment(request: CredentialResolutionRequest, secretRef: SecretRef): Record<string, unknown> {
    const vaultConfig = this.vaultSecretProvider.getConfig();
    const vaultValidation = secretRef.provider === "vault" ? this.vaultSecretProvider.validateSecretRef(secretRef) : undefined;
    const vaultPathAllowed = secretRef.provider === "vault" ? this.vaultSecretProvider.isSecretRefPathAllowed(secretRef) : false;
    return {
      ...sanitizeMetadata(request.policyContext ?? {}),
      credentialsConfigured: secretRef.status === "active" && (secretRef.provider === "env" ? Boolean(secretRef.envKey) : secretRef.provider === "vault" ? vaultValidation?.ok === true : false),
      secretRefActive: secretRef.status === "active",
      envSecretProviderEnabled: this.envSecretProvider.getConfig().enabled,
      envKeyAllowlistConfigured: this.envSecretProvider.getConfig().allowedEnvKeyCount > 0,
      vaultSecretBackendSelected: vaultConfig.selectedProvider === "vault",
      vaultSecretProviderEnabled: vaultConfig.vaultProviderEnabled,
      vaultAddressConfigured: vaultConfig.vaultAddressConfigured,
      vaultAuthConfigured: vaultConfig.vaultAuthMethod === "token" && vaultConfig.vaultTokenConfigured,
      vaultPathAllowed,
      vaultClientKind: this.vaultSecretProvider.getClientKind(),
      provider: secretRef.provider,
      secretKind: secretRef.secretKind,
      credentialCacheAccessAllowed: false,
      credentialMaterialStored: false,
      secretMaterialStored: false,
      purpose: request.purpose
    };
  }

  private credentialConfiguredFor(secretKind: SecretRef["secretKind"]): boolean {
    return this.repositories.secretRefs
      .listSecretRefs()
      .some((secretRef) => secretRef.secretKind === secretKind && secretRef.status === "active" && (Boolean(secretRef.envKey) || (secretRef.provider === "vault" && this.vaultSecretProvider.validateSecretRef(secretRef).ok)));
  }

  private recordAudit(input: Omit<SecurityAuditEvent, "id" | "createdAt">): SecurityAuditEvent {
    const metadata = sanitizeMetadata(input.metadata);
    return this.repositories.audit.appendSecurityAuditEvent({
      id: createId("secaudit"),
      createdAt: new Date(),
      ...input,
      requestId: input.requestId ?? stringMetadata(metadata.requestId),
      correlationId: input.correlationId ?? stringMetadata(metadata.correlationId),
      source: input.source ?? stringMetadata(metadata.source),
      serviceAccountId: input.serviceAccountId ?? stringMetadata(metadata.serviceAccountId),
      metadata
    });
  }
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export class MockSecretManager extends SecurityControlService {}

export class VaultSecretManagerFuture {
  getManagerKind() {
    return "vault_future" as const;
  }

  validateSecretRef(): never {
    throw new Error("vault_secret_manager_not_implemented");
  }
}

export class AwsSecretsManagerFuture {
  getManagerKind() {
    return "aws_secrets_manager_future" as const;
  }

  validateSecretRef(): never {
    throw new Error("aws_secrets_manager_not_implemented");
  }
}

export class GcpSecretManagerFuture {
  getManagerKind() {
    return "gcp_secret_manager_future" as const;
  }

  validateSecretRef(): never {
    throw new Error("gcp_secret_manager_not_implemented");
  }
}

export class AzureKeyVaultFuture {
  getManagerKind() {
    return "azure_key_vault_future" as const;
  }

  validateSecretRef(): never {
    throw new Error("azure_key_vault_not_implemented");
  }
}

function hasRawSecretMaterial(metadata: Record<string, unknown>): boolean {
  return Object.entries(metadata).some(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (["vaultmount", "vaultpath", "vaultkey", "vaultversion", "vaultnamespace", "vaulttransitwrapped", "datashape", "description"].includes(lowerKey)) {
      return typeof value === "string" && looksLikeRawSecret(value);
    }
    if (lowerKey === "value" || lowerKey.includes("token") || lowerKey.includes("secret") || lowerKey.includes("api_key")) {
      return typeof value === "string" && value.length > 0 && value !== "[redacted]";
    }
    return typeof value === "string" && (looksLikeRawSecret(value) || looksLikeCredentialCachePath(value));
  });
}

function isSecretProviderKind(value: unknown): value is SecretRef["provider"] {
  return value === "mock" ||
    value === "env" ||
    value === "vault" ||
    value === "vault_future" ||
    value === "aws_secrets_manager_future" ||
    value === "gcp_secret_manager_future" ||
    value === "azure_key_vault_future" ||
    value === "env_future";
}

function isSecretKind(value: unknown): value is SecretRef["secretKind"] {
  return value === "mock_metadata" ||
    value === "github_token" ||
    value === "github_app_private_key" ||
    value === "github_webhook_secret" ||
    value === "llm_api_key" ||
    value === "provider_api_key" ||
    value === "webhook_secret" ||
    value === "future_oauth_token" ||
    value === "future_cloud_identity";
}

function isSecretRefStatus(value: unknown): value is SecretRef["status"] {
  return value === "active" || value === "disabled" || value === "revoked";
}

function isSafeEnvKeyReference(value: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(value) && !looksLikeRawSecret(value) && !looksLikeCredentialCachePath(value);
}

function providerKindForCredentialRequest(request: CredentialResolutionRequest): string {
  const explicit = typeof request.policyContext?.providerKind === "string" ? request.policyContext.providerKind : undefined;
  if (explicit) return explicit;
  if (request.purpose === "github_api_call") return "github";
  if (request.purpose === "github_app_private_key_signing") return "github";
  if (request.purpose === "github_webhook_verification" || request.purpose === "webhook_verification_future") return "github";
  if (request.purpose === "llm_api_call") return "openai_compatible";
  return request.providerId ?? "provider";
}

function credentialPolicyActionForPurpose(request: CredentialResolutionRequest): PolicyAction | undefined {
  if (request.purpose === "github_api_call" || request.purpose === "github_app_private_key_signing" || request.purpose === "github_webhook_verification" || request.purpose === "webhook_verification_future") {
    return "git.credential.resolve";
  }
  if (request.purpose === "llm_api_call") return "llm.credential.resolve";
  return undefined;
}

function looksLikeRawSecret(value: string): boolean {
  return /\bsk-[A-Za-z0-9_-]{8,}\b/.test(value) ||
    /\bghp_[A-Za-z0-9_]{8,}\b/.test(value) ||
    /\bgithub_pat_[A-Za-z0-9_]{8,}\b/.test(value) ||
    /\bhv[bs]\.[A-Za-z0-9_-]{8,}\b/.test(value) ||
    /\b[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*[^\s]+/i.test(value) ||
    /Bearer\s+[A-Za-z0-9._~+/=-]+/i.test(value);
}

function looksLikeCredentialCachePath(value: string): boolean {
  return /~[\\/]\.codex[\\/]auth\.json/i.test(value) ||
    /~[\\/]\.claude/i.test(value) ||
    /application_default_credentials\.json/i.test(value) ||
    /gcloud[\\/]application_default_credentials/i.test(value);
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(metadata);
  for (const [key, value] of Object.entries(clone)) {
    const lowerKey = key.toLowerCase();
    if (["vaultmount", "vaultpath", "vaultkey", "vaultversion", "vaultnamespace", "vaulttransitwrapped", "datashape"].includes(lowerKey)) {
      if (typeof value === "string" && (looksLikeRawSecret(value) || looksLikeCredentialCachePath(value))) {
        clone[key] = "[redacted]";
      }
      continue;
    }
    if (/token|secret|key|credential|prompt/i.test(key)) {
      clone[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string") {
      if (looksLikeRawSecret(value) || looksLikeCredentialCachePath(value)) {
        clone[key] = "[redacted]";
      }
    }
  }
  return clone;
}
