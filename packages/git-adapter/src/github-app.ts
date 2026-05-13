import type { AuditLog } from "@aichestra/core";
import type { InMemoryAichestraStore } from "@aichestra/db";
import {
  buildGitHubAppInstallationStates,
  buildGitHubAppRepositoryGrantStates,
  createGitHubInstallationTokenRequest,
  createGitHubInstallationTokenResult,
  gitHubAppInstallationStateToDto,
  gitHubAppRepositoryGrantStateToDto,
  gitHubAppRuntimeConfigToDto,
  gitHubInstallationTokenResultToDto,
  sanitizeGitHubAppMetadata,
  validateGitHubAppRuntimeConfig
} from "@aichestra/adapters";
import type {
  GitHubAppInstallationState,
  GitHubAppRepositoryGrantState,
  GitHubAppRuntimeConfig,
  GitHubInstallationTokenPurpose,
  GitHubInstallationTokenRequest,
  GitHubInstallationTokenResult
} from "@aichestra/adapters";
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject
} from "@aichestra/policy";
import type { PolicyDecision } from "@aichestra/policy";

export type GitHubAppSecretRefMetadata = {
  id: string;
  secretKind: string;
  status: "active" | "disabled" | "revoked";
};

export type GitHubAppAuthorizationRequest = {
  action: "github_app.configure" | "github_app.installation.use" | "github_app.repo_grant.use" | "github_app.installation_token.issue";
  actorId?: string;
  principalId?: string;
  resourceKind: "github_app" | "github_app_installation" | "github_app_repo_grant";
  resourceId?: string;
  policyContext: Record<string, unknown>;
};

export type GitHubAppAuthorizationResult = {
  allowed: boolean;
  reason: string;
  actorId?: string;
  principalId?: string;
  policyDecisionId?: string;
  authorizationDecisionId?: string;
};

export type GitHubAppTokenProvider = {
  getProviderKind(): "disabled" | "mock" | "gated_future";
  validateAppConfig(config: GitHubAppRuntimeConfig): { ok: boolean; reasons: string[] };
  createInstallationToken(request: GitHubInstallationTokenRequest): GitHubInstallationTokenResult;
  revokeOrExpireToken?(handleId: string): GitHubInstallationTokenResult;
};

export type GitHubAppRuntimeServiceInput = {
  store: InMemoryAichestraStore;
  config: GitHubAppRuntimeConfig;
  policyService?: PolicyService;
  actorId?: string;
  tokenProvider?: GitHubAppTokenProvider;
  authorizationChecker?: (request: GitHubAppAuthorizationRequest) => GitHubAppAuthorizationResult;
  secretRefMetadataResolver?: (secretRefId: string) => GitHubAppSecretRefMetadata | undefined;
};

export type GitHubAppTokenCheckInput = {
  installationId?: string;
  repoRef?: string;
  purpose?: GitHubInstallationTokenPurpose;
  actorId?: string;
  principalId?: string;
  policyContext?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export class DisabledGitHubAppTokenProvider implements GitHubAppTokenProvider {
  getProviderKind() {
    return "disabled" as const;
  }

  validateAppConfig(config: GitHubAppRuntimeConfig): { ok: boolean; reasons: string[] } {
    const validation = validateGitHubAppRuntimeConfig(config);
    return validation.ok ? { ok: false, reasons: ["github_app_token_provider_disabled"] } : validation;
  }

  createInstallationToken(request: GitHubInstallationTokenRequest): GitHubInstallationTokenResult {
    return createGitHubInstallationTokenResult({
      requestId: request.id,
      status: "blocked",
      metadata: {
        reason: "github_app_token_provider_disabled",
        installationId: request.installationId,
        repoRef: request.repoRef,
        purpose: request.purpose
      }
    });
  }
}

export class MockGitHubAppTokenProvider implements GitHubAppTokenProvider {
  private readonly config: GitHubAppRuntimeConfig;
  private readonly policyService: PolicyService;
  private readonly authorizationChecker?: (request: GitHubAppAuthorizationRequest) => GitHubAppAuthorizationResult;
  private readonly secretRefMetadataResolver?: (secretRefId: string) => GitHubAppSecretRefMetadata | undefined;

  constructor(input: {
    config: GitHubAppRuntimeConfig;
    policyService?: PolicyService;
    authorizationChecker?: (request: GitHubAppAuthorizationRequest) => GitHubAppAuthorizationResult;
    secretRefMetadataResolver?: (secretRefId: string) => GitHubAppSecretRefMetadata | undefined;
  }) {
    this.config = input.config;
    this.policyService = input.policyService ?? new PolicyService();
    this.authorizationChecker = input.authorizationChecker;
    this.secretRefMetadataResolver = input.secretRefMetadataResolver;
  }

  getProviderKind() {
    return "mock" as const;
  }

  validateAppConfig(config: GitHubAppRuntimeConfig): { ok: boolean; reasons: string[] } {
    const validation = validateGitHubAppRuntimeConfig(config);
    return validation.ok ? { ok: true, reasons: [] } : validation;
  }

  createInstallationToken(request: GitHubInstallationTokenRequest): GitHubInstallationTokenResult {
    const validation = validateGitHubAppRuntimeConfig(this.config);
    if (!validation.ok) {
      return this.result(request, "blocked", { reason: validation.reasons[0] ?? "github_app_not_configured", blockedReasons: validation.reasons });
    }

    const installationAllowlisted = this.config.allowedInstallationIds.includes(request.installationId);
    const repoAllowlisted = request.repoRef ? this.config.allowedRepos.includes(request.repoRef.toLowerCase()) : true;
    const environment = {
      ...request.policyContext,
      githubAppEnabled: this.config.enabled,
      githubAppAuthMode: this.config.authMode === "github_app",
      appIdConfigured: this.config.appIdConfigured,
      privateKeySecretRefConfigured: this.config.privateKeySecretRefConfigured,
      installationAllowlisted,
      repoAllowlisted,
      privateKeyMaterialExposed: false,
      installationTokenExchangeEnabled: false,
      mockTokenProvider: true,
      destructiveOperation: false,
      purpose: request.purpose
    };

    const authorization = this.authorizationChecker?.({
      action: "github_app.installation_token.issue",
      actorId: request.actorId,
      principalId: request.principalId,
      resourceKind: "github_app_installation",
      resourceId: request.installationId,
      policyContext: environment
    });
    if (authorization && !authorization.allowed) {
      return this.result(request, "denied", {
        reason: `authorization_denied:${authorization.reason}`,
        authorizationDecisionId: authorization.authorizationDecisionId,
        policyDecisionId: authorization.policyDecisionId
      });
    }

    const secretRef = this.config.privateKeySecretRefId
      ? this.secretRefMetadataResolver?.(this.config.privateKeySecretRefId)
      : undefined;
    if (!this.config.privateKeySecretRefId || !secretRef) {
      return this.result(request, "missing_secret", { reason: "github_app_private_key_secret_ref_missing" });
    }
    if (secretRef.status !== "active") {
      return this.result(request, "denied", { reason: `github_app_private_key_secret_ref_${secretRef.status}` });
    }
    if (secretRef.secretKind !== "github_app_private_key") {
      return this.result(request, "denied", { reason: "github_app_private_key_secret_kind_invalid", secretKind: secretRef.secretKind });
    }

    const policy = this.evaluateTokenPolicy(request, {
      ...environment,
      secretRefActive: true
    });
    if (!policy.allowed) {
      return this.result(request, "denied", { reason: "policy_denied", policyDecisionId: policy.id, policyReason: policy.reason });
    }

    return this.result(request, "issued_mock", {
      tokenHandleId: `ghapp_token_handle_${request.installationId}_${request.purpose}_${request.id.slice(-8)}`,
      expiresAt: new Date(request.createdAt.getTime() + 60 * 60 * 1000),
      policyDecisionId: policy.id,
      reason: "mock_installation_token_handle_issued"
    });
  }

  private evaluateTokenPolicy(request: GitHubInstallationTokenRequest, environment: Record<string, unknown>): PolicyDecision {
    return this.policyService.evaluate({
      subject: createPolicySubject({
        actorId: request.actorId ?? "github-app-token-provider",
        principalId: request.principalId,
        actorKind: "service",
        roles: ["system"]
      }),
      action: "github_app.installation_token.issue",
      resource: createPolicyResource({
        resourceKind: "github_app_installation",
        resourceId: request.installationId,
        metadata: {
          providerKind: "github",
          repoRef: request.repoRef,
          purpose: request.purpose
        }
      }),
      context: createPolicyContext({
        providerKind: "github",
        repoId: request.repoRef,
        environment,
        metadata: {
          purpose: request.purpose,
          appConfigId: request.appConfigId
        }
      })
    });
  }

  private result(
    request: GitHubInstallationTokenRequest,
    status: GitHubInstallationTokenResult["status"],
    metadata: Record<string, unknown>
  ): GitHubInstallationTokenResult {
    return createGitHubInstallationTokenResult({
      requestId: request.id,
      status,
      tokenHandleId: typeof metadata.tokenHandleId === "string" ? metadata.tokenHandleId : undefined,
      expiresAt: metadata.expiresAt instanceof Date ? metadata.expiresAt : undefined,
      policyDecisionId: typeof metadata.policyDecisionId === "string" ? metadata.policyDecisionId : undefined,
      authorizationDecisionId: typeof metadata.authorizationDecisionId === "string" ? metadata.authorizationDecisionId : undefined,
      metadata: {
        installationId: request.installationId,
        repoRef: request.repoRef,
        purpose: request.purpose,
        ...metadata
      }
    });
  }
}

export class GitHubAppRuntimeService {
  private readonly store: InMemoryAichestraStore;
  private readonly config: GitHubAppRuntimeConfig;
  private readonly actorId: string;
  private readonly tokenProvider: GitHubAppTokenProvider;

  constructor(input: GitHubAppRuntimeServiceInput) {
    this.store = input.store;
    this.config = input.config;
    this.actorId = input.actorId ?? "github-app-runtime";
    this.tokenProvider = input.tokenProvider ?? (input.config.enabled && input.config.authMode === "github_app"
      ? new MockGitHubAppTokenProvider({
        config: input.config,
        policyService: input.policyService,
        authorizationChecker: input.authorizationChecker,
        secretRefMetadataResolver: input.secretRefMetadataResolver
      })
      : new DisabledGitHubAppTokenProvider());
    this.recordAudit(input.config.configured ? "github_app_config_loaded" : "github_app_config_blocked", {
      result: input.config.configured ? "allowed" : "blocked",
      authMode: input.config.authMode,
      enabled: input.config.enabled,
      configured: input.config.configured,
      blockedReasons: input.config.blockedReasons,
      tokenProviderKind: this.tokenProvider.getProviderKind()
    });
  }

  getConfig(): GitHubAppRuntimeConfig {
    return structuredClone(this.config);
  }

  getConfigDto(): Record<string, unknown> {
    return gitHubAppRuntimeConfigToDto(this.config);
  }

  listInstallations(): GitHubAppInstallationState[] {
    return buildGitHubAppInstallationStates(this.config);
  }

  listInstallationsDto(): Record<string, unknown>[] {
    return this.listInstallations().map(gitHubAppInstallationStateToDto);
  }

  listRepositoryGrants(): GitHubAppRepositoryGrantState[] {
    return buildGitHubAppRepositoryGrantStates(this.config);
  }

  listRepositoryGrantsDto(): Record<string, unknown>[] {
    return this.listRepositoryGrants().map(gitHubAppRepositoryGrantStateToDto);
  }

  validate() {
    const validation = this.tokenProvider.validateAppConfig(this.config);
    const event = this.recordAudit(validation.ok ? "github_app_config_loaded" : "github_app_config_blocked", {
      result: validation.ok ? "allowed" : "blocked",
      ok: validation.ok,
      reasons: validation.reasons,
      tokenProviderKind: this.tokenProvider.getProviderKind()
    });
    return {
      ok: validation.ok,
      status: validation.ok ? "configured_mock" : "blocked",
      reasons: validation.reasons,
      config: this.getConfigDto(),
      auditEventId: event.id
    };
  }

  createInstallationToken(input: GitHubAppTokenCheckInput): GitHubInstallationTokenResult {
    const installationId = input.installationId ?? this.config.allowedInstallationIds[0] ?? "";
    const purpose = input.purpose ?? "branch_create";
    const request = createGitHubInstallationTokenRequest({
      appConfigId: this.config.id,
      installationId,
      repoRef: input.repoRef?.toLowerCase(),
      purpose,
      actorId: input.actorId ?? this.actorId,
      principalId: input.principalId,
      policyContext: {
        authMode: this.config.authMode,
        ...input.policyContext
      },
      metadata: input.metadata
    });
    this.recordAudit("github_app_token_requested", {
      result: "requested",
      requestId: request.id,
      installationId,
      repoRef: request.repoRef,
      purpose
    });
    const result = this.tokenProvider.createInstallationToken(request);
    const auditEvent = this.recordAudit(result.status === "issued_mock" || result.status === "issued_gated" ? `github_app_token_${result.status}` : "github_app_token_blocked", {
      result: result.status === "issued_mock" || result.status === "issued_gated" ? "allowed" : "blocked",
      requestId: request.id,
      installationId,
      repoRef: request.repoRef,
      purpose,
      status: result.status,
      tokenHandleId: result.tokenHandleId,
      policyDecisionId: result.policyDecisionId,
      authorizationDecisionId: result.authorizationDecisionId,
      ...result.metadata
    });
    return {
      ...result,
      auditEventId: auditEvent.id
    };
  }

  checkInstallationToken(input: GitHubAppTokenCheckInput = {}): Record<string, unknown> {
    return gitHubInstallationTokenResultToDto(this.createInstallationToken(input));
  }

  listAuditEvents(): AuditLog[] {
    return this.store.listAuditLogs()
      .filter((event) => event.action.startsWith("git.github_app_"))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  listAuditEventsDto(): Record<string, unknown>[] {
    return this.listAuditEvents().map((event) => sanitizeGitHubAppMetadata(event) as Record<string, unknown>);
  }

  private recordAudit(action: string, metadata: Record<string, unknown>): AuditLog {
    return this.store.recordAudit({
      action: `git.${action}`,
      targetType: "git",
      targetId: "github_app",
      actorUserId: this.actorId,
      metadata: sanitizeGitHubAppMetadata(metadata) as Record<string, unknown>
    });
  }
}

