import type { PolicyDecision } from "@aichestra/policy";

export type SecretProviderKind =
  | "mock"
  | "env"
  | "vault_future"
  | "aws_secrets_manager_future"
  | "gcp_secret_manager_future"
  | "azure_key_vault_future"
  | "env_future";

export type SecretRefStatus = "active" | "disabled" | "revoked";

export type SecretKind =
  | "mock_metadata"
  | "github_token"
  | "llm_api_key"
  | "provider_api_key"
  | "webhook_secret"
  | "future_oauth_token"
  | "future_cloud_identity";

export type SecretRef = {
  id: string;
  provider: SecretProviderKind;
  secretKind: SecretKind;
  name: string;
  envKey?: string;
  scope: string;
  description?: string;
  status: SecretRefStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type SecretScope = {
  id: string;
  name: string;
  allowedResourceKinds: string[];
  allowedActions: string[];
  allowedProviderIds: string[];
  allowedRepoIds?: string[];
  allowedRunnerKinds?: string[];
  maxTtlSeconds: number;
  requiresApproval: boolean;
  metadata: Record<string, unknown>;
};

export type SecretLeaseStatus = "requested" | "approved" | "denied" | "issued" | "expired" | "revoked";

export type SecretLease = {
  id: string;
  secretRefId: string;
  scopeId: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  status: SecretLeaseStatus;
  issuedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  reason?: string;
};

export type SecretAccessDecisionValue = "allow" | "deny" | "require_approval";

export type SecretAccessDecision = {
  id: string;
  allowed: boolean;
  decision: SecretAccessDecisionValue;
  reason: string;
  secretRefId?: string;
  scopeId?: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  policyDecisionId?: string;
  createdAt: Date;
};

export type SecretLeaseRequest = {
  secretRefId: string;
  scopeId: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  ttlSeconds?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type SafeEnvironmentResult = {
  ok: boolean;
  leaseId: string;
  env: Record<string, string>;
  reason?: string;
};

export type SecretRefValidationResult = {
  ok: boolean;
  errors: string[];
};

export type SecretAuditEventType =
  | "secret_ref_validated"
  | "credential_secret_ref_created"
  | "credential_secret_ref_disabled"
  | "credential_secret_ref_revoked"
  | "secret_lease_requested"
  | "secret_lease_denied"
  | "secret_lease_issued_mock"
  | "secret_lease_revoked"
  | "secret_access_blocked"
  | "credential_resolution_requested"
  | "credential_resolution_allowed"
  | "credential_resolution_denied"
  | "credential_resolution_missing"
  | "credential_resolution_revoked"
  | "credential_env_provider_disabled"
  | "credential_env_key_not_allowlisted"
  | "credential_cache_access_denied"
  | "credential_value_redacted";

export type CredentialPurpose =
  | "github_api_call"
  | "llm_api_call"
  | "provider_api_call"
  | "webhook_verification_future";

export type CredentialHandleStatus = "resolved" | "blocked" | "missing" | "expired" | "revoked" | "unavailable";

export type CredentialHandle = {
  id: string;
  secretRefId: string;
  secretKind: SecretKind;
  provider: SecretProviderKind;
  status: CredentialHandleStatus;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
};

export type CredentialResolutionStatus = "resolved" | "blocked" | "missing" | "denied" | "unavailable";

export type CredentialResolutionRequest = {
  secretRefId: string;
  purpose: CredentialPurpose;
  actorId?: string;
  taskId?: string;
  taskRunId?: string;
  providerId?: string;
  policyContext?: Record<string, unknown>;
};

export type CredentialResolutionResult = {
  id: string;
  allowed: boolean;
  status: CredentialResolutionStatus;
  credentialHandle?: CredentialHandle;
  blockedReason?: string;
  policyDecisionId?: string;
  auditEventId?: string;
  createdAt: Date;
};

export type InternalCredentialResolutionResult = CredentialResolutionResult & {
  value?: string;
};

export type EnvSecretProviderConfig = {
  enabled: boolean;
  allowedEnvKeys: string[];
  allowedEnvKeyCount: number;
};

export type SandboxKind = "none" | "local_temp_workspace" | "container_future" | "firecracker_future" | "kubernetes_future";

export type SandboxProfileStatus = "active" | "disabled";

export type SandboxProfile = {
  id: string;
  name: string;
  kind: SandboxKind;
  allowNetwork: boolean;
  allowFileWrite: boolean;
  allowShellExecution: boolean;
  allowGitRemote: boolean;
  allowSecrets: boolean;
  allowedCommands: string[];
  deniedCommands: string[];
  allowedPaths: string[];
  deniedPaths: string[];
  networkPolicyRef?: string;
  maxRuntimeMs: number;
  maxOutputBytes: number;
  cleanupPolicy: "none" | "delete_temp_workspace";
  status: SandboxProfileStatus;
  metadata: Record<string, unknown>;
};

export type SandboxSessionStatus = "requested" | "active" | "completed" | "failed" | "cleaned_up";

export type SandboxSession = {
  id: string;
  profileId: string;
  taskId?: string;
  taskRunId?: string;
  runnerKind?: string;
  workspaceId?: string;
  status: SandboxSessionStatus;
  createdAt: Date;
  completedAt?: Date;
  cleanupAt?: Date;
  metadata: Record<string, unknown>;
};

export type SandboxDecision = {
  id: string;
  allowed: boolean;
  decision: SecretAccessDecisionValue;
  reason: string;
  profileId: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  policyDecisionId?: string;
  createdAt: Date;
};

export type SandboxSessionRequest = {
  profileId: string;
  taskId?: string;
  taskRunId?: string;
  runnerKind?: string;
  workspaceId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
};

export type SandboxAuditEventType =
  | "sandbox_profile_selected"
  | "sandbox_session_requested"
  | "sandbox_session_created"
  | "sandbox_session_completed"
  | "sandbox_session_cleaned_up";

export type NetworkDefaultAction = "deny" | "allow";

export type NetworkEgressPolicy = {
  id: string;
  name: string;
  defaultAction: NetworkDefaultAction;
  allowedHosts: string[];
  deniedHosts: string[];
  allowedPorts: number[];
  deniedPorts: number[];
  allowLocalhost: boolean;
  allowPrivateNetwork: boolean;
  status: "active" | "disabled";
  metadata: Record<string, unknown>;
};

export type NetworkEgressDecision = {
  id: string;
  allowed: boolean;
  reason: string;
  policyId: string;
  host?: string;
  port?: number;
  policyDecisionId?: string;
  createdAt: Date;
};

export type RedactionPolicy = {
  id: string;
  name: string;
  maskBearerTokens: boolean;
  maskApiKeys: boolean;
  maskCredentialPaths: boolean;
  maskEnvDumps: boolean;
  maskProviderTokens: boolean;
  maxPreviewBytes: number;
  retentionClass: "metadata_only" | "short_preview";
  status: "active" | "disabled";
};

export type RedactionResult = {
  policyId: string;
  redactedText: string;
  preview: string;
  redactionApplied: boolean;
  truncated: boolean;
  originalBytes: number;
  previewBytes: number;
};

export type NetworkAuditEventType = "network_egress_blocked";

export type RedactionAuditEventType = "redaction_applied" | "unsafe_output_truncated";

export type SecurityAuditEventType =
  | SecretAuditEventType
  | SandboxAuditEventType
  | NetworkAuditEventType
  | RedactionAuditEventType;

export type SecurityAuditEvent = {
  id: string;
  eventType: SecurityAuditEventType;
  actorId?: string;
  taskId?: string;
  taskRunId?: string;
  targetId?: string;
  targetKind: "secret" | "sandbox" | "network" | "redaction";
  result: "allowed" | "blocked" | "created" | "updated" | "redacted";
  reason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type SecretManagerKind = "mock" | "mock_with_env_secret_provider";

export type SecretManager = {
  getManagerKind(): SecretManagerKind;
  validateSecretRef(secretRef: SecretRef): SecretRefValidationResult;
  createSecretRef(input: Omit<SecretRef, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): SecretRef;
  updateSecretRefStatus(secretRefId: string, status: SecretRefStatus, actorId?: string): SecretRef;
  resolveCredential(request: CredentialResolutionRequest): CredentialResolutionResult;
  resolveCredentialForInternalUse(request: CredentialResolutionRequest): InternalCredentialResolutionResult;
  requestLease(request: SecretLeaseRequest): SecretLease;
  revokeLease(leaseId: string): SecretLease;
  getSafeEnvironment(leaseId: string): SafeEnvironmentResult;
  getSecretMetadata(secretRefId: string): SecretRef | undefined;
  recordSecretAudit(event: Omit<SecurityAuditEvent, "id" | "createdAt" | "targetKind">): SecurityAuditEvent;
};

export type SecurityPolicyEvaluation = {
  policyDecision: PolicyDecision;
  accessDecision?: SecretAccessDecision;
  sandboxDecision?: SandboxDecision;
};
