import { createId } from "@aichestra/core";
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
import { redactWithPolicy } from "./redaction.ts";
import type {
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
};

export class SecurityControlService implements SecretManager {
  private readonly repositories: SecurityRepositories;
  private readonly policyService: PolicyService;

  constructor(input: SecurityControlServiceInput = {}) {
    this.repositories = input.repositories ?? createInMemorySecurityRepositories();
    this.policyService = input.policyService ?? new PolicyService();
  }

  getManagerKind(): SecretManagerKind {
    return "mock";
  }

  getConfig() {
    const defaultSandbox = this.getDefaultSandboxProfile();
    const networkPolicy = this.repositories.networkEgressPolicies.listNetworkEgressPolicies().find((item) => item.status === "active");
    return {
      secretManagerKind: this.getManagerKind(),
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
    if (hasRawSecretMaterial(secretRef.metadata)) errors.push("secret ref metadata must not contain raw secret material");
    if (looksLikeCredentialCachePath(secretRef.name) || looksLikeCredentialCachePath(secretRef.scope)) {
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
        status: secretRef.status
      }
    });
    return { ok: errors.length === 0, errors };
  }

  getSecretMetadata(secretRefId: string): SecretRef | undefined {
    return this.repositories.secretRefs.getSecretRef(secretRefId);
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
    runnerKind?: string;
    environment?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): PolicyDecision {
    return this.policyService.evaluate({
      subject: createPolicySubject({
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

function looksLikeRawSecret(value: string): boolean {
  return /\bsk-[A-Za-z0-9_-]{8,}\b/.test(value) || /Bearer\s+[A-Za-z0-9._~+/=-]+/i.test(value);
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
