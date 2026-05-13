import { createId } from "@aichestra/core";
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject
} from "@aichestra/policy";
import { sanitizeSecurityMetadata } from "@aichestra/security";
import type { PolicyAction } from "@aichestra/policy";
import type { LocalAgentConsentLevel, LocalAgentInvocation, LocalAgentProtocolService } from "./local-agent-protocol.ts";

export type ProviderKind =
  | "cloud_api"
  | "oauth_api"
  | "workload_identity_api"
  | "cloud_iam"
  | "local_cli"
  | "pty_interactive_fallback";

export type ProviderVendor = "anthropic" | "openai" | "google" | "aws" | "azure" | "custom";

export type ProviderAuth =
  | { type: "api_key"; envKey?: string; secretRef?: string }
  | { type: "oauth_user"; provider: string; scopes?: string[] }
  | { type: "device_code"; provider: string }
  | { type: "workload_identity"; provider: string; ruleId?: string; serviceAccount?: string }
  | { type: "cloud_iam"; provider: string; project?: string; region?: string }
  | { type: "external_cli_session"; credentialAccess: "never_read_tokens"; ownerUserId?: string; sharedAcrossUsers?: boolean };

export type ProviderBillingMode =
  | "aichestra_owned"
  | "provider_workspace"
  | "cloud_project"
  | "user_subscription"
  | "local_user_session"
  | "unknown";

export type ProviderCapability =
  | "completion"
  | "streaming"
  | "tool_use"
  | "local_cli"
  | "json_output"
  | "jsonl_output"
  | "file_read"
  | "file_write"
  | "shell_execution"
  | "cloud_iam"
  | "workload_identity";

export type ProviderCatalogEntryStatus = "active" | "disabled" | "deprecated";

export type ProviderCatalogEntry = {
  id: string;
  displayName: string;
  vendor: ProviderVendor;
  kind: ProviderKind;
  auth: ProviderAuth;
  supportedModels: string[];
  billingMode: ProviderBillingMode;
  capabilities: ProviderCapability[];
  defaultEnabled: boolean;
  status: ProviderCatalogEntryStatus;
  policyNotes: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ProviderValidationResult = {
  ok: boolean;
  providerId?: string;
  reason?: string;
  errors: string[];
};

export type CredentialReferenceResult = {
  ok: boolean;
  providerId: string;
  authType?: ProviderAuth["type"];
  credentialRef?: {
    kind: "env" | "secret_ref" | "none";
    ref?: string;
  };
  reason?: string;
};

export type CredentialAccessAuditEvent = {
  actorId?: string;
  providerId: string;
  operation: string;
  result: "allowed" | "blocked";
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type CredentialManager = {
  getCredentialReference(providerId: string): CredentialReferenceResult;
  validateCredentialAccess(providerId: string, input?: { actorId?: string; requestedPath?: string; operation?: string }): CredentialReferenceResult;
  recordCredentialAccessAudit(event: CredentialAccessAuditEvent): ProviderAuditEvent;
  resolveSecretRef(providerId: string): CredentialReferenceResult;
};

export type TokenResolutionResult = {
  ok: boolean;
  providerId: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  reason?: string;
};

export type TokenResolver = {
  getAuthHeaders(providerId: string): TokenResolutionResult;
  getSafeEnvironment(providerId: string): TokenResolutionResult;
  refreshIfNeeded(providerId: string): TokenResolutionResult;
};

export type ProviderInvocationRequest = {
  id: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  providerId: string;
  modelId?: string;
  prompt: string;
  context?: Record<string, unknown>;
  instructionSetHash?: string;
  workspaceRef?: string;
  metadata?: Record<string, unknown>;
};

export type NormalizedProviderEvent = {
  id: string;
  source: "stdout" | "stderr" | "api" | "system";
  type: "token" | "message" | "progress" | "warning" | "error" | "final" | "metadata";
  payload: Record<string, unknown>;
  createdAt: Date;
};

export type ProviderInvocationResult = {
  id: string;
  providerId: string;
  providerKind: ProviderKind;
  status: "completed" | "failed" | "blocked" | "unavailable" | "awaiting_consent";
  output: string;
  normalizedEvents: NormalizedProviderEvent[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd?: number;
    billingMode?: ProviderBillingMode;
  };
  error?: {
    code: string;
    message: string;
  };
  createdAt: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
};

export type ProviderAdapter = {
  getProviderId(): string;
  getProviderKind(): ProviderKind;
  validateProvider(): ProviderValidationResult;
  invoke(request: ProviderInvocationRequest): Promise<ProviderInvocationResult>;
  stream?(request: ProviderInvocationRequest): AsyncIterable<NormalizedProviderEvent>;
  mapError(error: unknown): { code: string; message: string };
  normalizeResult(result: ProviderInvocationResult): ProviderInvocationResult;
};

export type LocalCliProviderConfig = {
  id: string;
  vendor: ProviderVendor;
  command: string;
  commandPath?: string;
  auth: Extract<ProviderAuth, { type: "external_cli_session" }>;
  cwdPolicy: "workspace_only" | "readonly_workspace" | "none";
  invocation: {
    argsTemplate: string[];
    stdinMode: "none" | "prompt" | "context" | "prompt_and_context";
    stdoutParser: ProviderOutputParserMode;
    stderrPolicy: "progress_log" | "error_only" | "error_and_progress";
  };
  safety: {
    requireUserConsent: boolean;
    allowShellExecution: boolean;
    allowFileWrite: boolean;
    allowNetwork: boolean;
    timeoutMs: number;
  };
  parser: {
    mode: ProviderOutputParserMode;
    unstablePtyFallback: boolean;
  };
  consentPolicy: {
    requiredConsentLevel: LocalAgentConsentLevel;
    denyDangerFullAccess: boolean;
  };
};

export type LocalAgentDescriptor = {
  id: string;
  userId: string;
  hostId: string;
  version: string;
  status: "connected" | "disconnected" | "unknown";
  capabilities: string[];
  lastSeenAt?: Date;
};

export type LocalAgentInvocationRequest = {
  id: string;
  taskId: string;
  taskRunId: string;
  providerId: string;
  workspaceRef: string;
  promptRef?: string;
  prompt?: string;
  requiredConsentLevel: LocalAgentConsentLevel;
  timeoutMs: number;
  metadata: Record<string, unknown>;
};

export type LocalAgentInvocationResult = {
  id: string;
  status: "completed" | "failed" | "blocked" | "unavailable";
  normalizedEvents: NormalizedProviderEvent[];
  stdoutPreview: string;
  stderrPreview: string;
  exitCode?: number;
  redactionApplied: boolean;
  createdAt: Date;
  completedAt?: Date;
};

export type ProviderOutputParserMode = "raw" | "json" | "jsonl" | "ndjson";

export type ProviderOutputParseResult = {
  ok: boolean;
  status: "completed" | "failed";
  output: string;
  normalizedEvents: NormalizedProviderEvent[];
  stdoutPreview: string;
  stderrPreview: string;
  stdoutBytes: number;
  stderrBytes: number;
  error?: string;
  redactionApplied: boolean;
};

export type ProviderAuditEvent = {
  id: string;
  eventType:
    | "provider_catalog_entry_created"
    | "provider_validation_requested"
    | "provider_invocation_requested"
    | "provider_invocation_blocked"
    | "credential_resolution_requested"
    | "credential_resolution_blocked"
    | "local_agent_required"
    | "local_agent_unavailable"
    | "channel_required"
    | "awaiting_consent"
    | "consent_denied"
    | "provider_template_incompatible"
    | "mock_completed"
    | "local_cli_invocation_requested"
    | "local_cli_invocation_blocked"
    | "credential_cache_access_denied"
    | "provider_output_redacted"
    | "parser_error";
  actorId?: string;
  taskId?: string;
  taskRunId?: string;
  providerId: string;
  providerKind: ProviderKind;
  authType: ProviderAuth["type"];
  operation: string;
  result: "allowed" | "blocked" | "failed";
  reason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type ProviderCatalogRepository = {
  listProviders(): ProviderCatalogEntry[];
  getProvider(id: string): ProviderCatalogEntry | undefined;
  registerProvider(input: ProviderCatalogEntry): ProviderCatalogEntry;
};

export type ProviderAuditRepository = {
  appendAuditEvent(input: Omit<ProviderAuditEvent, "id" | "createdAt">): ProviderAuditEvent;
  listAuditEvents(filter?: { providerId?: string; eventType?: string; actorId?: string }): ProviderAuditEvent[];
};

export class InMemoryProviderCatalogRepository implements ProviderCatalogRepository {
  private readonly providers = new Map<string, ProviderCatalogEntry>();

  constructor(seed: ProviderCatalogEntry[] = seedProviderCatalogEntries()) {
    for (const provider of seed) {
      this.providers.set(provider.id, structuredClone(provider));
    }
  }

  listProviders(): ProviderCatalogEntry[] {
    return [...this.providers.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((provider) => structuredClone(provider));
  }

  getProvider(id: string): ProviderCatalogEntry | undefined {
    const provider = this.providers.get(id);
    return provider ? structuredClone(provider) : undefined;
  }

  registerProvider(input: ProviderCatalogEntry): ProviderCatalogEntry {
    const validation = validateProviderCatalogEntry(input);
    if (!validation.ok) {
      throw new Error(`Invalid provider catalog entry: ${validation.errors.join("; ")}`);
    }
    if (this.providers.has(input.id)) {
      throw new Error(`Provider catalog entry already exists: ${input.id}`);
    }
    this.providers.set(input.id, structuredClone(input));
    return structuredClone(input);
  }
}

export class InMemoryProviderAuditRepository implements ProviderAuditRepository {
  private readonly events: ProviderAuditEvent[] = [];

  appendAuditEvent(input: Omit<ProviderAuditEvent, "id" | "createdAt">): ProviderAuditEvent {
    const event = {
      ...input,
      id: createId("provideraudit"),
      metadata: sanitizeProviderMetadata(input.metadata),
      createdAt: new Date()
    };
    this.events.push(structuredClone(event));
    return structuredClone(event);
  }

  listAuditEvents(filter: { providerId?: string; eventType?: string; actorId?: string } = {}): ProviderAuditEvent[] {
    return this.events
      .filter((event) => (filter.providerId === undefined || event.providerId === filter.providerId) &&
        (filter.eventType === undefined || event.eventType === filter.eventType) &&
        (filter.actorId === undefined || event.actorId === filter.actorId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((event) => structuredClone(event));
  }
}

export class ProviderCatalogService {
  private readonly repository: ProviderCatalogRepository;
  private readonly auditRepository: ProviderAuditRepository;

  constructor(repository: ProviderCatalogRepository = new InMemoryProviderCatalogRepository(), auditRepository: ProviderAuditRepository = new InMemoryProviderAuditRepository()) {
    this.repository = repository;
    this.auditRepository = auditRepository;
  }

  listProviders(): ProviderCatalogEntry[] {
    return this.repository.listProviders();
  }

  getProvider(id: string): ProviderCatalogEntry | undefined {
    return this.repository.getProvider(id);
  }

  registerProvider(input: ProviderCatalogEntry): ProviderCatalogEntry {
    const provider = this.repository.registerProvider(input);
    this.auditRepository.appendAuditEvent({
      eventType: "provider_catalog_entry_created",
      providerId: provider.id,
      providerKind: provider.kind,
      authType: provider.auth.type,
      operation: "catalog.register",
      result: "allowed",
      metadata: { status: provider.status, default_enabled: provider.defaultEnabled }
    });
    return provider;
  }

  validateProvider(id: string): ProviderValidationResult {
    const provider = this.repository.getProvider(id);
    if (!provider) {
      return { ok: false, providerId: id, reason: "provider_not_found", errors: [`Provider ${id} not found.`] };
    }
    return validateProviderCatalogEntry(provider);
  }
}

export class StaticCredentialManager implements CredentialManager {
  private readonly catalog: ProviderCatalogService;
  private readonly auditRepository: ProviderAuditRepository;

  constructor(input: { catalog?: ProviderCatalogService; auditRepository?: ProviderAuditRepository } = {}) {
    this.auditRepository = input.auditRepository ?? new InMemoryProviderAuditRepository();
    this.catalog = input.catalog ?? new ProviderCatalogService(undefined, this.auditRepository);
  }

  getCredentialReference(providerId: string): CredentialReferenceResult {
    this.recordCredentialAccessAudit({ providerId, operation: "credential.reference", result: "allowed" });
    const provider = this.catalog.getProvider(providerId);
    if (!provider) {
      return { ok: false, providerId, reason: "provider_not_found" };
    }
    if (provider.auth.type === "external_cli_session") {
      return {
        ok: true,
        providerId,
        authType: provider.auth.type,
        credentialRef: { kind: "none" },
        reason: "external_cli_session_never_read_tokens"
      };
    }
    if (provider.auth.type === "api_key") {
      if (provider.auth.secretRef) {
        return { ok: true, providerId, authType: provider.auth.type, credentialRef: { kind: "secret_ref", ref: provider.auth.secretRef } };
      }
      if (provider.auth.envKey) {
        return { ok: true, providerId, authType: provider.auth.type, credentialRef: { kind: "env", ref: provider.auth.envKey } };
      }
    }
    return { ok: false, providerId, authType: provider.auth.type, reason: "credential_resolution_not_implemented" };
  }

  validateCredentialAccess(providerId: string, input: { actorId?: string; requestedPath?: string; operation?: string } = {}): CredentialReferenceResult {
    const provider = this.catalog.getProvider(providerId);
    if (!provider) {
      return { ok: false, providerId, reason: "provider_not_found" };
    }
    if (input.requestedPath && containsCredentialCacheReference(input.requestedPath)) {
      this.recordCredentialAccessAudit({
        actorId: input.actorId,
        providerId,
        operation: input.operation ?? "credential.cache.read",
        result: "blocked",
        reason: "credential_cache_access_denied",
        metadata: { requestedPath: input.requestedPath }
      });
      return { ok: false, providerId, authType: provider.auth.type, reason: "credential_cache_access_denied" };
    }
    return this.getCredentialReference(providerId);
  }

  recordCredentialAccessAudit(event: CredentialAccessAuditEvent): ProviderAuditEvent {
    const provider = this.catalog.getProvider(event.providerId);
    return this.auditRepository.appendAuditEvent({
      eventType: event.result === "blocked" ? "credential_resolution_blocked" : "credential_resolution_requested",
      actorId: event.actorId,
      providerId: event.providerId,
      providerKind: provider?.kind ?? "cloud_api",
      authType: provider?.auth.type ?? "api_key",
      operation: event.operation,
      result: event.result,
      reason: event.reason,
      metadata: event.metadata ?? {}
    });
  }

  resolveSecretRef(providerId: string): CredentialReferenceResult {
    this.recordCredentialAccessAudit({
      providerId,
      operation: "credential.secret.resolve",
      result: "blocked",
      reason: "secret_resolution_not_implemented"
    });
    return { ok: false, providerId, reason: "secret_resolution_not_implemented" };
  }
}

export class MockTokenResolver implements TokenResolver {
  private readonly catalog: ProviderCatalogService;

  constructor(catalog: ProviderCatalogService = new ProviderCatalogService()) {
    this.catalog = catalog;
  }

  getAuthHeaders(providerId: string): TokenResolutionResult {
    const provider = this.catalog.getProvider(providerId);
    if (!provider) return { ok: false, providerId, reason: "provider_not_found" };
    if (provider.auth.type === "external_cli_session") {
      return { ok: true, providerId, headers: {}, reason: "external_cli_session_never_read_tokens" };
    }
    return { ok: false, providerId, reason: "token_resolution_not_implemented" };
  }

  getSafeEnvironment(providerId: string): TokenResolutionResult {
    const provider = this.catalog.getProvider(providerId);
    if (!provider) return { ok: false, providerId, reason: "provider_not_found" };
    if (provider.auth.type === "external_cli_session") {
      return { ok: true, providerId, env: {}, reason: "external_cli_session_empty_safe_env" };
    }
    return { ok: false, providerId, reason: "safe_environment_not_implemented" };
  }

  refreshIfNeeded(providerId: string): TokenResolutionResult {
    return { ok: false, providerId, reason: "token_refresh_not_implemented" };
  }
}

export class ProviderAbstractionService {
  private readonly catalog: ProviderCatalogService;
  private readonly auditRepository: ProviderAuditRepository;
  private readonly credentialManager: CredentialManager;
  private readonly tokenResolver: TokenResolver;
  private readonly policyService: PolicyService;
  private readonly localAgents: LocalAgentDescriptor[];
  private readonly localAgentProtocolService?: LocalAgentProtocolService;

  constructor(input: {
    catalog?: ProviderCatalogService;
    auditRepository?: ProviderAuditRepository;
    credentialManager?: CredentialManager;
    tokenResolver?: TokenResolver;
    policyService?: PolicyService;
    localAgents?: LocalAgentDescriptor[];
    localAgentProtocolService?: LocalAgentProtocolService;
  } = {}) {
    this.auditRepository = input.auditRepository ?? new InMemoryProviderAuditRepository();
    this.catalog = input.catalog ?? new ProviderCatalogService(undefined, this.auditRepository);
    this.credentialManager = input.credentialManager ?? new StaticCredentialManager({ catalog: this.catalog, auditRepository: this.auditRepository });
    this.tokenResolver = input.tokenResolver ?? new MockTokenResolver(this.catalog);
    this.policyService = input.policyService ?? new PolicyService();
    this.localAgents = input.localAgents ?? [];
    this.localAgentProtocolService = input.localAgentProtocolService;
  }

  getConfig() {
    return {
      status: "available",
      providerCatalogCount: this.catalog.listProviders().length,
      localAgentSupportEnabled: this.localAgentProtocolService !== undefined,
      connectedLocalAgents: this.localAgentProtocolService
        ? this.localAgentProtocolService.getConfig().connectedAgents
        : this.localAgents.filter((agent) => agent.status === "connected").length,
      credentialManagerKind: "static",
      tokenResolverKind: "mock"
    };
  }

  listProviders(): ProviderCatalogEntry[] {
    return this.catalog.listProviders();
  }

  getProvider(id: string): ProviderCatalogEntry | undefined {
    return this.catalog.getProvider(id);
  }

  validateProvider(id: string): ProviderValidationResult {
    const validation = this.catalog.validateProvider(id);
    const provider = this.catalog.getProvider(id);
    if (provider) {
      this.recordAuditEvent({
        eventType: "provider_validation_requested",
        providerId: provider.id,
        providerKind: provider.kind,
        authType: provider.auth.type,
        operation: "provider.validate",
        result: validation.ok ? "allowed" : "blocked",
        reason: validation.reason,
        metadata: { errors: validation.errors }
      });
    }
    return validation;
  }

  listAuthTypes(): ProviderAuth["type"][] {
    return ["api_key", "oauth_user", "device_code", "workload_identity", "cloud_iam", "external_cli_session"];
  }

  listLocalCliTemplates(): LocalCliProviderConfig[] {
    return seedLocalCliProviderConfigs();
  }

  listLocalAgents(): LocalAgentDescriptor[] {
    if (this.localAgentProtocolService) {
      return this.localAgentProtocolService.listAgents().map((agent) => ({
        id: agent.id,
        userId: agent.userId,
        hostId: agent.hostId,
        version: agent.agentVersion,
        status: agent.status === "revoked" || agent.status === "pending" ? "disconnected" : agent.status,
        capabilities: agent.capabilities.filter((capability) => capability.enabled).map((capability) => capability.kind),
        lastSeenAt: agent.lastSeenAt
      }));
    }
    return this.localAgents.map((agent) => structuredClone(agent));
  }

  getCredentialReference(providerId: string): CredentialReferenceResult {
    return this.credentialManager.getCredentialReference(providerId);
  }

  getSafeEnvironment(providerId: string): TokenResolutionResult {
    return this.tokenResolver.getSafeEnvironment(providerId);
  }

  async invoke(input: Omit<ProviderInvocationRequest, "id"> & { id?: string }): Promise<ProviderInvocationResult> {
    const request = {
      ...input,
      id: input.id ?? createId("providerinv")
    };
    const provider = this.catalog.getProvider(request.providerId);
    if (!provider) {
      return createProviderResult({
        providerId: request.providerId,
        providerKind: "cloud_api",
        status: "blocked",
        code: "provider_not_found",
        message: `Provider ${request.providerId} not found.`,
        metadata: {}
      });
    }

    this.recordAuditEvent({
      eventType: "provider_invocation_requested",
      actorId: request.actorId,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      providerId: provider.id,
      providerKind: provider.kind,
      authType: provider.auth.type,
      operation: "provider.invoke",
      result: "allowed",
      metadata: { model_id: request.modelId, billing_mode: provider.billingMode }
    });

    const policyAction = policyActionForProviderKind(provider.kind);
    const decision = this.policyService.evaluate({
      subject: createPolicySubject({
        actorId: request.actorId ?? "provider-abstraction",
        actorKind: request.actorId ? "user" : "service",
        roles: ["system"]
      }),
      action: policyAction,
      resource: createPolicyResource({
        resourceKind: "llm_provider",
        resourceId: provider.id,
        metadata: {
          providerKind: provider.kind,
          providerId: provider.id,
          status: provider.status,
          billingMode: provider.billingMode
        }
      }),
      context: createPolicyContext({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        modelId: request.modelId,
        providerKind: provider.kind,
        environment: {
          localAgentConnected: this.localAgentProtocolService
            ? this.localAgentProtocolService.getConfig().connectedAgents > 0
            : this.localAgents.some((agent) => agent.status === "connected"),
          ptyEnabled: false
        },
        metadata: { source: "provider_abstraction" }
      })
    });
    if (!decision.allowed) {
      const result = createProviderResult({
        providerId: provider.id,
        providerKind: provider.kind,
        status: "blocked",
        code: "provider_policy_denied",
        message: decision.reason,
        metadata: { policy_decision_id: decision.id, matched_rule_ids: decision.matchedRuleIds }
      });
      this.recordAuditEvent({
        eventType: "provider_invocation_blocked",
        actorId: request.actorId,
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        providerId: provider.id,
        providerKind: provider.kind,
        authType: provider.auth.type,
        operation: policyAction,
        result: "blocked",
        reason: decision.reason,
        metadata: { policy_decision_id: decision.id }
      });
      return result;
    }

    const adapter = createProviderAdapter(provider, this.localAgents, this.localAgentProtocolService);
    const result = await adapter.invoke(request);
    if (result.status !== "completed") {
      const eventType = provider.kind === "local_cli"
        ? providerAuditEventTypeForLocalCliResult(result)
        : "provider_invocation_blocked";
      this.recordAuditEvent({
        eventType,
        actorId: request.actorId,
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        providerId: provider.id,
        providerKind: provider.kind,
        authType: provider.auth.type,
        operation: "provider.invoke",
        result: result.status === "failed" ? "failed" : "blocked",
        reason: result.error?.code,
        metadata: result.metadata
      });
    } else if (provider.kind === "local_cli") {
      this.recordAuditEvent({
        eventType: "mock_completed",
        actorId: request.actorId,
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        providerId: provider.id,
        providerKind: provider.kind,
        authType: provider.auth.type,
        operation: "provider.invoke",
        result: "allowed",
        reason: "mock_completed",
        metadata: result.metadata
      });
    }
    return result;
  }

  recordAuditEvent(input: Omit<ProviderAuditEvent, "id" | "createdAt">): ProviderAuditEvent {
    return this.auditRepository.appendAuditEvent(input);
  }

  listAuditEvents(filter: { providerId?: string; eventType?: string; actorId?: string } = {}): ProviderAuditEvent[] {
    return this.auditRepository.listAuditEvents(filter);
  }
}

export class CloudApiProviderAdapter implements ProviderAdapter {
  private readonly provider: ProviderCatalogEntry;

  constructor(provider: ProviderCatalogEntry) {
    this.provider = provider;
  }

  getProviderId(): string {
    return this.provider.id;
  }

  getProviderKind(): ProviderKind {
    return this.provider.kind;
  }

  validateProvider(): ProviderValidationResult {
    return validateProviderCatalogEntry(this.provider);
  }

  async invoke(): Promise<ProviderInvocationResult> {
    return createProviderResult({
      providerId: this.provider.id,
      providerKind: this.provider.kind,
      status: "blocked",
      code: "provider_calls_disabled",
      message: "Real cloud API provider invocation is disabled in Enterprise Provider Abstraction v0.",
      metadata: { billing_mode: this.provider.billingMode }
    });
  }

  mapError(error: unknown) {
    return { code: "provider_error", message: error instanceof Error ? error.message : "Provider error" };
  }

  normalizeResult(result: ProviderInvocationResult): ProviderInvocationResult {
    return structuredClone(result);
  }
}

export class OAuthApiProviderAdapter extends CloudApiProviderAdapter {}
export class WorkloadIdentityProviderAdapter extends CloudApiProviderAdapter {}
export class CloudIamProviderAdapter extends CloudApiProviderAdapter {}

export class LocalCliProviderAdapter implements ProviderAdapter {
  private readonly provider: ProviderCatalogEntry;
  private readonly localAgents: LocalAgentDescriptor[];
  private readonly localAgentProtocolService?: LocalAgentProtocolService;

  constructor(provider: ProviderCatalogEntry, localAgents: LocalAgentDescriptor[] = [], localAgentProtocolService?: LocalAgentProtocolService) {
    this.provider = provider;
    this.localAgents = localAgents;
    this.localAgentProtocolService = localAgentProtocolService;
  }

  getProviderId(): string {
    return this.provider.id;
  }

  getProviderKind(): ProviderKind {
    return "local_cli";
  }

  validateProvider(): ProviderValidationResult {
    return validateProviderCatalogEntry(this.provider);
  }

  async invoke(request: ProviderInvocationRequest): Promise<ProviderInvocationResult> {
    if (this.localAgentProtocolService) {
      return this.invokeThroughProtocol(request);
    }
    const connected = this.localAgents.find((agent) => agent.status === "connected");
    if (!connected) {
      return createProviderResult({
        providerId: this.provider.id,
        providerKind: "local_cli",
        status: "unavailable",
        code: "local_agent_required",
        message: "Local CLI providers require Aichestra Local Agent; v0 does not implement the daemon protocol.",
        metadata: { credential_access: "never_read_tokens" }
      });
    }
    return createProviderResult({
      providerId: this.provider.id,
      providerKind: "local_cli",
      status: "blocked",
      code: "local_agent_protocol_not_implemented",
      message: "Aichestra Local Agent invocation is not implemented in v0.",
      metadata: { local_agent_id: connected.id }
    });
  }

  private async invokeThroughProtocol(request: ProviderInvocationRequest): Promise<ProviderInvocationResult> {
    const requestedAgentId = stringFromRecord(request?.context, "localAgentId") ?? stringFromRecord(request?.metadata, "localAgentId");
    const requestedAgent = requestedAgentId ? this.localAgentProtocolService?.getAgent(requestedAgentId) : undefined;
    const connected = requestedAgent?.status === "connected"
      ? requestedAgent
      : this.localAgentProtocolService?.findConnectedAgent(request?.actorId);
    if (!connected || !this.localAgentProtocolService) {
      const unavailableAgent = requestedAgent && requestedAgent.status !== "connected"
        ? requestedAgent
        : request?.actorId
          ? this.localAgentProtocolService?.listAgents({ userId: request.actorId }).find((agent) => agent.status === "disconnected" || agent.status === "revoked")
          : this.localAgentProtocolService?.listAgents().find((agent) => agent.status === "disconnected" || agent.status === "revoked");
      if (unavailableAgent) {
        return createProviderResult({
          providerId: this.provider.id,
          providerKind: "local_cli",
          status: "unavailable",
          code: "local_agent_unavailable",
          message: `Local Agent is ${unavailableAgent.status}.`,
          metadata: {
            local_agent_id: unavailableAgent.id,
            local_agent_status: unavailableAgent.status,
            credential_access: "never_read_tokens"
          }
        });
      }
      return createProviderResult({
        providerId: this.provider.id,
        providerKind: "local_cli",
        status: "unavailable",
        code: "local_agent_required",
        message: "Local CLI providers require a connected Aichestra Local Agent.",
        metadata: { credential_access: "never_read_tokens" }
      });
    }
    const fixtureAgent = connected.metadata.fixtureDaemon === true;
    const activeChannel = this.localAgentProtocolService.getActiveChannel(connected.id);
    if (fixtureAgent && !activeChannel) {
      return createProviderResult({
        providerId: this.provider.id,
        providerKind: "local_cli",
        status: "unavailable",
        code: "channel_required",
        message: "Fixture Local Agent provider invocation requires an established mock channel.",
        metadata: {
          local_agent_id: connected.id,
          mock_channel_required: true,
          real_transport_enabled: false
        }
      });
    }
    const templateId = providerTemplateIdForCatalogEntry(this.provider);
    const localCliConfig = seedLocalCliProviderConfigs().find((item) => item.id === templateId);
    const compatibility = fixtureAgent
      ? this.localAgentProtocolService.checkCompatibility({
        providerId: this.provider.id,
        agentId: connected.id,
        command: localCliConfig?.command ?? commandForProvider(this.provider),
        providerTemplateId: templateId,
        parserMode: localCliConfig?.parser.mode ?? "raw",
        reportedVersion: stringFromRecord(connected.metadata, "fixtureReportedVersion") ?? connected.agentVersion,
        metadata: { source: "provider_abstraction" }
      })
      : undefined;
    if (compatibility && !compatibility.compatible) {
      return createProviderResult({
        providerId: this.provider.id,
        providerKind: "local_cli",
        status: "blocked",
        code: "provider_template_incompatible",
        message: compatibility.reason,
        metadata: {
          local_agent_id: connected.id,
          compatibility_result_id: compatibility.id,
          provider_template_id: templateId,
          parser_mode: compatibility.parserMode,
          warnings: compatibility.warnings
        }
      });
    }

    const existingInvocationId = stringFromRecord(request?.context, "localAgentInvocationId") ?? stringFromRecord(request?.metadata, "localAgentInvocationId");
    let invocation: LocalAgentInvocation | undefined = existingInvocationId
      ? this.localAgentProtocolService.getInvocation(existingInvocationId)
      : undefined;
    if (existingInvocationId && !invocation) {
      return createProviderResult({
        providerId: this.provider.id,
        providerKind: "local_cli",
        status: "blocked",
        code: "local_agent_invocation_not_found",
        message: `Local Agent invocation not found: ${existingInvocationId}`,
        metadata: { local_agent_invocation_id: existingInvocationId }
      });
    }
    if (invocation?.state === "consent_denied") {
      return createProviderResult({
        providerId: this.provider.id,
        providerKind: "local_cli",
        status: "blocked",
        code: "consent_denied",
        message: invocation.statusReason ?? "Local Agent consent was denied.",
        metadata: {
          local_agent_id: connected.id,
          local_agent_invocation_id: invocation.id
        }
      });
    }
    if (!invocation) {
      invocation = this.localAgentProtocolService.createInvocationEnvelope({
        taskId: request?.taskId,
        taskRunId: request?.taskRunId,
        actorId: request?.actorId,
        providerId: this.provider.id,
        localAgentId: connected.id,
        workspaceRef: request?.workspaceRef ?? "workspace_mock_local_cli",
        instructionSetHash: request?.instructionSetHash,
        promptRef: request?.id,
        requiredConsentLevel: "read_only",
        sandboxProfileId: "sandbox_default_deny",
        networkPolicyId: "network_default_deny",
        redactionPolicyId: "redaction_default",
        secretScopeIds: [],
        timeoutMs: 120000,
        metadata: {
          providerInvocationId: request?.id,
          localCliExecutionEnabled: false,
          credentialAccess: "never_read_tokens",
          requireChannel: fixtureAgent,
          channelId: activeChannel?.id,
          compatibilityRequired: fixtureAgent,
          compatibilityCompatible: compatibility?.compatible,
          compatibilityResultId: compatibility?.id,
          providerTemplateId: templateId,
          parserMode: localCliConfig?.parser.mode ?? "raw",
          fixtureDaemon: fixtureAgent
        }
      }).invocation;
    }

    const dispatched = await this.localAgentProtocolService.dispatchInvocation(invocation.id);
    if (dispatched.state === "awaiting_consent") {
      return createProviderResult({
        providerId: this.provider.id,
        providerKind: "local_cli",
        status: "awaiting_consent",
        code: "awaiting_consent",
        message: "Local Agent invocation is awaiting user consent.",
        metadata: {
          local_agent_id: connected.id,
          local_agent_invocation_id: dispatched.id,
          consent_request_id: this.localAgentProtocolService.listConsentRequests({ invocationId: dispatched.id, pendingOnly: true }).at(-1)?.id
        }
      });
    }
    if (dispatched.state === "policy_blocked" || dispatched.state === "consent_denied") {
      return createProviderResult({
        providerId: this.provider.id,
        providerKind: "local_cli",
        status: "blocked",
        code: dispatched.state === "consent_denied" ? "consent_denied" : dispatched.statusReason ?? dispatched.state,
        message: dispatched.statusReason ?? "Local Agent invocation blocked.",
        metadata: {
          local_agent_id: connected.id,
          local_agent_invocation_id: dispatched.id,
          state: dispatched.state
        }
      });
    }
    if (dispatched.state === "local_agent_unavailable") {
      return createProviderResult({
        providerId: this.provider.id,
        providerKind: "local_cli",
        status: "unavailable",
        code: "local_agent_unavailable",
        message: dispatched.statusReason ?? "Local Agent unavailable.",
        metadata: {
          local_agent_id: connected.id,
          local_agent_invocation_id: dispatched.id
        }
      });
    }
    const completed = this.localAgentProtocolService.completeInvocation({
      invocationId: dispatched.id,
      exitCode: 0,
      statusReason: "mock_completed",
      metadata: { providerId: this.provider.id }
    });
    const normalizedEvents = completed.normalizedEvents.map((event) => ({
      id: event.id,
      source: event.source,
      type: event.type,
      payload: event.payload,
      createdAt: event.createdAt
    }));
    return {
      id: createId("providerresult"),
      providerId: this.provider.id,
      providerKind: "local_cli",
      status: "completed",
      output: outputFromLocalAgentInvocation(completed),
      normalizedEvents,
      createdAt: new Date(),
      completedAt: completed.completedAt ?? new Date(),
      metadata: sanitizeProviderMetadata({
        local_agent_id: connected.id,
        local_agent_invocation_id: completed.id,
        mock_transport: true,
        fixture_daemon: fixtureAgent,
        stream_event_count: this.localAgentProtocolService.listStreamEvents({ invocationId: completed.id }).length,
        provider_template_id: templateId,
        credential_access: "never_read_tokens",
        direct_local_cli_execution: false
      })
    };
  }

  mapError(error: unknown) {
    return { code: "local_cli_error", message: error instanceof Error ? error.message : "Local CLI provider error" };
  }

  normalizeResult(result: ProviderInvocationResult): ProviderInvocationResult {
    return structuredClone(result);
  }
}

export class PtyInteractiveFallbackProviderAdapter implements ProviderAdapter {
  private readonly provider: ProviderCatalogEntry;

  constructor(provider: ProviderCatalogEntry) {
    this.provider = provider;
  }

  getProviderId(): string {
    return this.provider.id;
  }

  getProviderKind(): ProviderKind {
    return "pty_interactive_fallback";
  }

  validateProvider(): ProviderValidationResult {
    return validateProviderCatalogEntry(this.provider);
  }

  async invoke(): Promise<ProviderInvocationResult> {
    return createProviderResult({
      providerId: this.provider.id,
      providerKind: "pty_interactive_fallback",
      status: "blocked",
      code: "disabled_by_policy",
      message: "PTY interactive fallback is disabled by default and is future-only.",
      metadata: { pty_enabled: false }
    });
  }

  mapError(error: unknown) {
    return { code: "pty_error", message: error instanceof Error ? error.message : "PTY provider error" };
  }

  normalizeResult(result: ProviderInvocationResult): ProviderInvocationResult {
    return structuredClone(result);
  }
}

export function createProviderAdapter(provider: ProviderCatalogEntry, localAgents: LocalAgentDescriptor[] = [], localAgentProtocolService?: LocalAgentProtocolService): ProviderAdapter {
  if (provider.kind === "oauth_api") return new OAuthApiProviderAdapter(provider);
  if (provider.kind === "workload_identity_api") return new WorkloadIdentityProviderAdapter(provider);
  if (provider.kind === "cloud_iam") return new CloudIamProviderAdapter(provider);
  if (provider.kind === "local_cli") return new LocalCliProviderAdapter(provider, localAgents, localAgentProtocolService);
  if (provider.kind === "pty_interactive_fallback") return new PtyInteractiveFallbackProviderAdapter(provider);
  return new CloudApiProviderAdapter(provider);
}

export function parseProviderOutput(input: {
  mode: ProviderOutputParserMode;
  stdout: string;
  stderr?: string;
  exitCode?: number;
  maxPreviewBytes?: number;
}): ProviderOutputParseResult {
  const redactedStdout = redactSecretText(input.stdout);
  const redactedStderr = redactSecretText(input.stderr ?? "");
  const maxPreviewBytes = input.maxPreviewBytes ?? 4096;
  const stdoutPreview = limitBytes(redactedStdout, maxPreviewBytes);
  const stderrPreview = limitBytes(redactedStderr, maxPreviewBytes);
  const stdoutBytes = Buffer.byteLength(input.stdout);
  const stderrBytes = Buffer.byteLength(input.stderr ?? "");
  const redactionApplied = redactedStdout !== input.stdout || redactedStderr !== (input.stderr ?? "");

  try {
    const events = eventsForOutputMode(input.mode, redactedStdout);
    const exitFailed = input.exitCode !== undefined && input.exitCode !== 0;
    return {
      ok: !exitFailed,
      status: exitFailed ? "failed" : "completed",
      output: outputForMode(input.mode, redactedStdout),
      normalizedEvents: [
        ...events,
        ...(redactedStderr.length > 0 ? [createNormalizedEvent("stderr", "progress", { text: redactedStderr })] : [])
      ],
      stdoutPreview,
      stderrPreview,
      stdoutBytes,
      stderrBytes,
      error: exitFailed ? `process_exit_${input.exitCode}` : undefined,
      redactionApplied
    };
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      output: "",
      normalizedEvents: [createNormalizedEvent("system", "error", { message: error instanceof Error ? error.message : "parse_error" })],
      stdoutPreview,
      stderrPreview,
      stdoutBytes,
      stderrBytes,
      error: error instanceof Error ? error.message : "parse_error",
      redactionApplied
    };
  }
}

export function redactSecretText(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, "[redacted-api-key]")
    .replace(/\b(ghp_[A-Za-z0-9_]{8,})\b/g, "[redacted-api-key]")
    .replace(/\b(github_pat_[A-Za-z0-9_]{8,})\b/g, "[redacted-api-key]")
    .replace(/\b(AIza[0-9A-Za-z_-]{8,})\b/g, "[redacted-api-key]")
    .replace(/\b((?:OPENAI|ANTHROPIC|AICHESTRA_LLM|AICHESTRA_GITHUB|LLM|GITHUB|GOOGLE_APPLICATION)_API_KEY)\s*=\s*[^\s]+/gi, "$1=[redacted]")
    .replace(/\b(AICHESTRA_GITHUB_TOKEN)\s*=\s*[^\s]+/gi, "$1=[redacted]")
    .replace(/\b(AICHESTRA_GITHUB_WEBHOOK_SECRET)\s*=\s*[^\s]+/gi, "$1=[redacted]")
    .replace(/\b([A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD))\s*=\s*[^\s]+/gi, "$1=[redacted]")
    .replace(/GOOGLE_APPLICATION_CREDENTIALS\s*=\s*[^\s]+/gi, "GOOGLE_APPLICATION_CREDENTIALS=[redacted]")
    .replace(/~\/\.codex\/auth\.json/gi, "[redacted-credential-cache]")
    .replace(/~\/\.claude[^\s]*/gi, "[redacted-credential-cache]")
    .replace(/application_default_credentials\.json/gi, "[redacted-credential-cache]")
    .replace(/gcloud\/application_default_credentials/gi, "[redacted-credential-cache]");
}

export function validateProviderCatalogEntry(entry: ProviderCatalogEntry): ProviderValidationResult {
  const errors: string[] = [];
  if (!entry.id) errors.push("provider id is required");
  if (!entry.displayName) errors.push("provider displayName is required");
  if (!isProviderKind(entry.kind)) errors.push(`invalid provider kind: ${entry.kind}`);
  if (!isProviderAuth(entry.auth)) errors.push("invalid provider auth");
  errors.push(...validateProviderAuthForKind(entry.kind, entry.auth));
  if (entry.kind === "pty_interactive_fallback" && entry.defaultEnabled) {
    errors.push("pty_interactive_fallback must be disabled by default");
  }
  if (entry.defaultEnabled && entry.status !== "active") {
    errors.push("defaultEnabled providers must be active");
  }
  const serialized = JSON.stringify(entry.auth);
  if (containsCredentialCacheReference(serialized)) {
    errors.push("credential cache paths and OS keychain references are forbidden");
  }
  if (containsRawTokenValue(serialized)) {
    errors.push("provider auth must not contain raw token values");
  }
  return {
    ok: errors.length === 0,
    providerId: entry.id,
    reason: errors[0],
    errors
  };
}

export function validateLocalCliProviderConfig(config: LocalCliProviderConfig): ProviderValidationResult {
  const errors: string[] = [];
  if (config.auth.type !== "external_cli_session" || config.auth.credentialAccess !== "never_read_tokens") {
    errors.push("local_cli config must use external_cli_session with credentialAccess=never_read_tokens");
  }
  if (config.safety.allowShellExecution) errors.push("local_cli shell execution is denied by default");
  if (config.safety.allowNetwork) errors.push("local_cli network access is denied by default");
  if (config.consentPolicy.requiredConsentLevel === "danger_full_access" || !config.consentPolicy.denyDangerFullAccess) {
    errors.push("danger_full_access must be denied by default");
  }
  if (config.invocation.argsTemplate.some((arg) => /[|;&<>]/.test(arg))) {
    errors.push("local_cli argsTemplate must be argv-safe and must not include shell metacharacters");
  }
  return { ok: errors.length === 0, providerId: config.id, reason: errors[0], errors };
}

export function seedProviderCatalogEntries(): ProviderCatalogEntry[] {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const base = (input: Omit<ProviderCatalogEntry, "createdAt" | "updatedAt" | "defaultEnabled" | "status">): ProviderCatalogEntry => ({
    ...input,
    defaultEnabled: false,
    status: "disabled",
    createdAt: now,
    updatedAt: now
  });
  return [
    base({
      id: "anthropic-api-key",
      displayName: "Anthropic API Key",
      vendor: "anthropic",
      kind: "cloud_api",
      auth: { type: "api_key", envKey: "ANTHROPIC_API_KEY" },
      supportedModels: ["claude-enterprise/default"],
      billingMode: "provider_workspace",
      capabilities: ["completion", "streaming", "tool_use"],
      policyNotes: ["Cloud API invocation disabled in v0."],
      metadata: { skeleton: true }
    }),
    base({
      id: "anthropic-wif",
      displayName: "Anthropic Workload Identity",
      vendor: "anthropic",
      kind: "workload_identity_api",
      auth: { type: "workload_identity", provider: "anthropic", ruleId: "future-anthropic-wif" },
      supportedModels: ["claude-enterprise/default"],
      billingMode: "provider_workspace",
      capabilities: ["completion", "workload_identity"],
      policyNotes: ["WIF token exchange is future-only."],
      metadata: { skeleton: true }
    }),
    base({
      id: "claude-code-local",
      displayName: "Claude Code Local CLI",
      vendor: "anthropic",
      kind: "local_cli",
      auth: { type: "external_cli_session", credentialAccess: "never_read_tokens" },
      supportedModels: ["claude-code/local"],
      billingMode: "local_user_session",
      capabilities: ["local_cli", "json_output", "jsonl_output", "file_read", "file_write", "shell_execution"],
      policyNotes: ["Requires Aichestra Local Agent; credential caches are never read."],
      metadata: { localAgentRequired: true, templateId: "claude-code-headless-json" }
    }),
    base({
      id: "openai-api-key",
      displayName: "OpenAI API Key",
      vendor: "openai",
      kind: "cloud_api",
      auth: { type: "api_key", envKey: "OPENAI_API_KEY" },
      supportedModels: ["openai-enterprise/default"],
      billingMode: "provider_workspace",
      capabilities: ["completion", "streaming", "tool_use"],
      policyNotes: ["Cloud API invocation disabled in v0."],
      metadata: { skeleton: true }
    }),
    base({
      id: "codex-cli-local",
      displayName: "Codex CLI Local",
      vendor: "openai",
      kind: "local_cli",
      auth: { type: "external_cli_session", credentialAccess: "never_read_tokens" },
      supportedModels: ["codex-cli/local"],
      billingMode: "local_user_session",
      capabilities: ["local_cli", "jsonl_output", "file_read", "file_write", "shell_execution"],
      policyNotes: ["Requires Aichestra Local Agent; ChatGPT local session is not uploaded."],
      metadata: { localAgentRequired: true, templateId: "codex-cli-jsonl" }
    }),
    base({
      id: "gemini-api-key",
      displayName: "Gemini API Key",
      vendor: "google",
      kind: "cloud_api",
      auth: { type: "api_key", envKey: "GEMINI_API_KEY" },
      supportedModels: ["gemini-enterprise/default"],
      billingMode: "provider_workspace",
      capabilities: ["completion", "streaming", "json_output"],
      policyNotes: ["Cloud API invocation disabled in v0."],
      metadata: { skeleton: true }
    }),
    base({
      id: "gemini-cli-local",
      displayName: "Gemini CLI Local",
      vendor: "google",
      kind: "local_cli",
      auth: { type: "external_cli_session", credentialAccess: "never_read_tokens" },
      supportedModels: ["gemini-cli/local"],
      billingMode: "local_user_session",
      capabilities: ["local_cli", "json_output", "file_read", "file_write", "shell_execution"],
      policyNotes: ["Requires Aichestra Local Agent; OAuth cache piggybacking is forbidden."],
      metadata: { localAgentRequired: true, templateId: "gemini-cli-json" }
    }),
    base({
      id: "vertex-gemini-cloud",
      displayName: "Vertex Gemini Cloud IAM",
      vendor: "google",
      kind: "cloud_iam",
      auth: { type: "cloud_iam", provider: "google", project: "future-project", region: "future-region" },
      supportedModels: ["vertex-gemini/default"],
      billingMode: "cloud_project",
      capabilities: ["completion", "cloud_iam"],
      policyNotes: ["Cloud IAM exchange is future-only."],
      metadata: { skeleton: true }
    }),
    base({
      id: "bedrock-anthropic-cloud",
      displayName: "Bedrock Anthropic Cloud IAM",
      vendor: "aws",
      kind: "cloud_iam",
      auth: { type: "cloud_iam", provider: "aws", region: "future-region" },
      supportedModels: ["bedrock-anthropic/default"],
      billingMode: "cloud_project",
      capabilities: ["completion", "cloud_iam"],
      policyNotes: ["AWS IAM/Bedrock calls are future-only."],
      metadata: { skeleton: true }
    }),
    base({
      id: "azure-foundry-cloud",
      displayName: "Azure Foundry Cloud IAM",
      vendor: "azure",
      kind: "cloud_iam",
      auth: { type: "cloud_iam", provider: "azure", region: "future-region" },
      supportedModels: ["azure-foundry/default"],
      billingMode: "cloud_project",
      capabilities: ["completion", "cloud_iam"],
      policyNotes: ["Azure identity/Foundry calls are future-only."],
      metadata: { skeleton: true }
    })
  ];
}

export function seedLocalCliProviderConfigs(): LocalCliProviderConfig[] {
  return [
    localCliTemplate("claude-code-headless-json", "anthropic", "claude", ["-p", "{{prompt}}", "--output-format", "json"], "json"),
    localCliTemplate("claude-code-stream-json", "anthropic", "claude", ["-p", "{{prompt}}", "--output-format", "stream-json", "--verbose", "--include-partial-messages"], "jsonl"),
    localCliTemplate("codex-cli-headless", "openai", "codex", ["exec", "{{prompt}}"], "raw"),
    localCliTemplate("codex-cli-jsonl", "openai", "codex", ["exec", "--json", "{{prompt}}"], "jsonl"),
    localCliTemplate("gemini-cli-json", "google", "gemini", ["-p", "{{prompt}}", "--output-format", "json"], "json")
  ];
}

function localCliTemplate(id: string, vendor: ProviderVendor, command: string, argsTemplate: string[], parser: ProviderOutputParserMode): LocalCliProviderConfig {
  return {
    id,
    vendor,
    command,
    auth: { type: "external_cli_session", credentialAccess: "never_read_tokens" },
    cwdPolicy: "workspace_only",
    invocation: {
      argsTemplate,
      stdinMode: "prompt",
      stdoutParser: parser,
      stderrPolicy: "progress_log"
    },
    safety: {
      requireUserConsent: true,
      allowShellExecution: false,
      allowFileWrite: false,
      allowNetwork: false,
      timeoutMs: 120000
    },
    parser: {
      mode: parser,
      unstablePtyFallback: false
    },
    consentPolicy: {
      requiredConsentLevel: "read_only",
      denyDangerFullAccess: true
    }
  };
}

function createProviderResult(input: {
  providerId: string;
  providerKind: ProviderKind;
  status: ProviderInvocationResult["status"];
  code: string;
  message: string;
  metadata: Record<string, unknown>;
}): ProviderInvocationResult {
  const now = new Date();
  return {
    id: createId("providerresult"),
    providerId: input.providerId,
    providerKind: input.providerKind,
    status: input.status,
    output: "",
    normalizedEvents: [createNormalizedEvent("system", input.status === "failed" ? "error" : "warning", { code: input.code, message: input.message })],
    error: { code: input.code, message: input.message },
    createdAt: now,
    completedAt: now,
    metadata: sanitizeProviderMetadata(input.metadata)
  };
}

function createNormalizedEvent(source: NormalizedProviderEvent["source"], type: NormalizedProviderEvent["type"], payload: Record<string, unknown>): NormalizedProviderEvent {
  return {
    id: createId("providerevent"),
    source,
    type,
    payload: sanitizeProviderMetadata(payload),
    createdAt: new Date()
  };
}

function eventsForOutputMode(mode: ProviderOutputParserMode, stdout: string): NormalizedProviderEvent[] {
  if (mode === "raw") {
    return [createNormalizedEvent("stdout", "final", { text: stdout })];
  }
  if (mode === "json") {
    const parsed = JSON.parse(stdout) as unknown;
    return [createNormalizedEvent("stdout", "final", { json: parsed })];
  }
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.map((line) => createNormalizedEvent("stdout", "message", { json: JSON.parse(line) as unknown }));
}

function outputForMode(mode: ProviderOutputParserMode, stdout: string): string {
  if (mode === "raw") return stdout;
  if (mode === "json") return JSON.stringify(JSON.parse(stdout));
  return JSON.stringify(stdout.split(/\r?\n/).filter((line) => line.trim().length > 0).map((line) => JSON.parse(line) as unknown));
}

function limitBytes(text: string, maxBytes: number): string {
  const bytes = Buffer.from(text);
  if (bytes.length <= maxBytes) return text;
  return bytes.subarray(0, maxBytes).toString("utf8");
}

function isProviderKind(value: unknown): value is ProviderKind {
  return value === "cloud_api" ||
    value === "oauth_api" ||
    value === "workload_identity_api" ||
    value === "cloud_iam" ||
    value === "local_cli" ||
    value === "pty_interactive_fallback";
}

function isProviderAuth(value: unknown): value is ProviderAuth {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as Record<string, unknown>).type;
  return type === "api_key" ||
    type === "oauth_user" ||
    type === "device_code" ||
    type === "workload_identity" ||
    type === "cloud_iam" ||
    type === "external_cli_session";
}

function validateProviderAuthForKind(kind: ProviderKind, auth: ProviderAuth): string[] {
  const errors: string[] = [];
  if (kind === "local_cli" && (auth.type !== "external_cli_session" || auth.credentialAccess !== "never_read_tokens")) {
    errors.push("local_cli providers must use external_cli_session with credentialAccess=never_read_tokens");
  }
  if (auth.type === "external_cli_session") {
    if (auth.credentialAccess !== "never_read_tokens") {
      errors.push("external_cli_session requires credentialAccess=never_read_tokens");
    }
    if (auth.sharedAcrossUsers) {
      errors.push("one user's CLI session must not be shared across multiple users");
    }
  }
  if (kind === "pty_interactive_fallback" && auth.type !== "external_cli_session") {
    errors.push("pty_interactive_fallback must use external_cli_session boundary");
  }
  return errors;
}

function containsCredentialCacheReference(text: string): boolean {
  return /~\/\.codex\/auth\.json|\\\.codex\\auth\.json|~\/\.claude|\\\.claude|application_default_credentials\.json|gcloud\/application_default_credentials|keychain|credential cache/i.test(text);
}

function containsRawTokenValue(text: string): boolean {
  return /Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{8,}|accessToken|refreshToken|apiKey|rawToken/i.test(text);
}

function sanitizeProviderMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return sanitizeSecurityMetadata(metadata) as Record<string, unknown>;
}

function providerAuditEventTypeForLocalCliResult(result: ProviderInvocationResult): ProviderAuditEvent["eventType"] {
  if (result.error?.code === "local_agent_required") return "local_agent_required";
  if (result.error?.code === "local_agent_unavailable") return "local_agent_unavailable";
  if (result.error?.code === "channel_required") return "channel_required";
  if (result.error?.code === "awaiting_consent" || result.status === "awaiting_consent") return "awaiting_consent";
  if (result.error?.code === "consent_denied") return "consent_denied";
  if (result.error?.code === "provider_template_incompatible") return "provider_template_incompatible";
  return "local_cli_invocation_blocked";
}

function stringFromRecord(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function outputFromLocalAgentInvocation(invocation: LocalAgentInvocation): string {
  return invocation.normalizedEvents
    .filter((event) => event.source === "stdout")
    .map((event) => {
      const text = event.payload.text;
      return typeof text === "string" ? text : JSON.stringify(event.payload);
    })
    .join("\n");
}

function providerTemplateIdForCatalogEntry(provider: ProviderCatalogEntry): string {
  const templateId = provider.metadata.templateId;
  return typeof templateId === "string" ? templateId : `${provider.id}-template`;
}

function commandForProvider(provider: ProviderCatalogEntry): string {
  if (provider.vendor === "anthropic") return "claude";
  if (provider.vendor === "openai") return "codex";
  if (provider.vendor === "google") return "gemini";
  return "custom";
}

function policyActionForProviderKind(kind: ProviderKind): PolicyAction {
  if (kind === "local_cli") return "provider.local_cli.invoke";
  if (kind === "pty_interactive_fallback") return "provider.pty.invoke";
  if (kind === "cloud_api") return "provider.cloud_api.invoke";
  return "provider.invoke";
}
