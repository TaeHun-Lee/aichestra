import { createId } from "@aichestra/core";
import type {
  AuthContext,
  AuthorizationDecision,
  AuthorizationServiceInterface
} from "@aichestra/auth";
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
import { EnvSecretProvider, createEnvSecretProviderFromEnv } from "./credentials.ts";
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
  SecurityAuditEvent
} from "./types.ts";

export type SecurityControlServiceInput = {
  repositories?: SecurityRepositories;
  policyService?: PolicyService;
  authorizationService?: AuthorizationServiceInterface;
  envSecretProvider?: EnvSecretProvider;
  env?: Record<string, string | undefined>;
};

export class SecurityControlService implements SecretManager {
  private readonly repositories: SecurityRepositories;
  private readonly policyService: PolicyService;
  private readonly authorizationService?: AuthorizationServiceInterface;
  private readonly envSecretProvider: EnvSecretProvider;

  constructor(input: SecurityControlServiceInput = {}) {
    this.repositories = input.repositories ?? createInMemorySecurityRepositories();
    this.policyService = input.policyService ?? new PolicyService();
    this.authorizationService = input.authorizationService;
    this.envSecretProvider = input.envSecretProvider ?? createEnvSecretProviderFromEnv(input.env);
  }

  getManagerKind(): SecretManagerKind {
    return this.envSecretProvider.getConfig().enabled ? "mock_with_env_secret_provider" : "mock";
  }

  getConfig() {
    const defaultSandbox = this.getDefaultSandboxProfile();
    const networkPolicy = this.repositories.networkEgressPolicies.listNetworkEgressPolicies().find((item) => item.status === "active");
    const envSecretProvider = this.envSecretProvider.getConfig();
    const activeSecretRefs = this.repositories.secretRefs.listSecretRefs().filter((item) => item.status === "active");
    return {
      secretManagerKind: this.getManagerKind(),
      credentialManagerKind: "secretref_env_v1",
      envSecretProviderEnabled: envSecretProvider.enabled,
      allowedSecretEnvKeyCount: envSecretProvider.allowedEnvKeyCount,
      activeSecretRefCount: activeSecretRefs.length,
      githubCredentialConfigured: this.credentialConfiguredFor("github_token"),
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
      reason: "env_secret_provider_credential_handle_issued"
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
        envKeyConfigured: Boolean(secretRef.envKey),
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
      value: includeValue ? envResult.value : undefined
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
        envKeyConfigured: Boolean(secretRef?.envKey)
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
        : createPolicySubject({
          actorId: input.actorId ?? "mock-security-actor",
          actorKind: "service",
          roles: ["system"]
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
          source: "security_control_service"
        }
      })
    });
  }

  private resolveCredentialAuthContext(request: CredentialResolutionRequest): AuthContext | undefined {
    if (!this.authorizationService) return request.authContext;
    if (request.authContext) return request.authContext;
    return this.authorizationService.getAuthContext({
      actorId: request.actorId ?? "mock-admin",
      source: request.actorId ? "api" : "system",
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
          purpose: request.purpose
        }
      }
    });
  }

  private credentialPolicyEnvironment(request: CredentialResolutionRequest, secretRef: SecretRef): Record<string, unknown> {
    return {
      ...sanitizeMetadata(request.policyContext ?? {}),
      credentialsConfigured: secretRef.status === "active" && Boolean(secretRef.envKey),
      secretRefActive: secretRef.status === "active",
      envSecretProviderEnabled: this.envSecretProvider.getConfig().enabled,
      envKeyAllowlistConfigured: this.envSecretProvider.getConfig().allowedEnvKeyCount > 0,
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
      .some((secretRef) => secretRef.secretKind === secretKind && secretRef.status === "active" && Boolean(secretRef.envKey));
  }

  private recordAudit(input: Omit<SecurityAuditEvent, "id" | "createdAt">): SecurityAuditEvent {
    return this.repositories.audit.appendSecurityAuditEvent({
      id: createId("secaudit"),
      createdAt: new Date(),
      ...input,
      metadata: sanitizeMetadata(input.metadata)
    });
  }
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
    if (lowerKey === "value" || lowerKey.includes("token") || lowerKey.includes("secret") || lowerKey.includes("api_key")) {
      return typeof value === "string" && value.length > 0 && value !== "[redacted]";
    }
    return typeof value === "string" && (looksLikeRawSecret(value) || looksLikeCredentialCachePath(value));
  });
}

function isSecretProviderKind(value: unknown): value is SecretRef["provider"] {
  return value === "mock" ||
    value === "env" ||
    value === "vault_future" ||
    value === "aws_secrets_manager_future" ||
    value === "gcp_secret_manager_future" ||
    value === "azure_key_vault_future" ||
    value === "env_future";
}

function isSecretKind(value: unknown): value is SecretRef["secretKind"] {
  return value === "mock_metadata" ||
    value === "github_token" ||
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
  if (request.purpose === "github_webhook_verification" || request.purpose === "webhook_verification_future") return "github";
  if (request.purpose === "llm_api_call") return "openai_compatible";
  return request.providerId ?? "provider";
}

function credentialPolicyActionForPurpose(request: CredentialResolutionRequest): PolicyAction | undefined {
  if (request.purpose === "github_api_call" || request.purpose === "github_webhook_verification" || request.purpose === "webhook_verification_future") {
    return "git.credential.resolve";
  }
  if (request.purpose === "llm_api_call") return "llm.credential.resolve";
  return undefined;
}

function looksLikeRawSecret(value: string): boolean {
  return /\bsk-[A-Za-z0-9_-]{8,}\b/.test(value) ||
    /\bghp_[A-Za-z0-9_]{8,}\b/.test(value) ||
    /\bgithub_pat_[A-Za-z0-9_]{8,}\b/.test(value) ||
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
