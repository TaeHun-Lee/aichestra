import {
  createPolicyResourceScope,
  createScopedPolicyResource
} from "@aichestra/policy";
import type {
  PolicyResource,
  PolicyResourceScope,
  PolicyResourceScopeKind
} from "@aichestra/policy";
import type {
  AuditQueryScope,
  LocalAgentHostScope,
  MCPToolScope,
  ModelScope,
  ProjectScope,
  ProviderScope,
  RegistryPackageScope,
  RepoScope,
  ScopeCatalog,
  SecretScopeBinding,
  TeamScope,
  TenantScope
} from "./types.ts";

export type TenantScopeContext = {
  tenantScopes: TenantScope[];
  teamScopes: TeamScope[];
  projectScopes: ProjectScope[];
  resourceScopes: PolicyResourceScope[];
  metadata: Record<string, unknown>;
};

export type ScopeShapeValidationResult = {
  ok: boolean;
  errors: string[];
};

const defaultTenantId = "mock-tenant";
const defaultTeamId = "platform-team";
const defaultProjectId = "aichestra-core";

function safeMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (/token|secret|password|cookie|credential|session|apiKey|api_key|authorization|envValue/i.test(key)) {
      output[key] = "[redacted]";
    } else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      output[key] = safeMetadata(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function commonMetadata(metadata: Record<string, unknown> = {}): Record<string, unknown> {
  return safeMetadata({
    ...metadata,
    mockScope: true,
    productionTenantEnforcement: false,
    productionAuthEnabled: false
  });
}

export const mockScopeCatalog: ScopeCatalog = {
  tenants: [
    {
      tenantId: defaultTenantId,
      tenantKind: "workspace",
      displayName: "Mock Tenant",
      status: "active_mock",
      metadata: commonMetadata({ localRuntimeOnly: true })
    }
  ],
  teams: [
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      displayName: "Platform Team",
      status: "active_mock",
      metadata: commonMetadata()
    }
  ],
  projects: [
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      displayName: "Aichestra Core",
      status: "active_mock",
      metadata: commonMetadata()
    }
  ],
  repos: [
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      repoId: "repo_demo_backend",
      repoProvider: "mock",
      repoOwner: "aichestra",
      repoName: "demo-backend",
      allowedBranchPrefix: "ai/",
      metadata: commonMetadata({ fixtureRepo: true })
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      repoId: "repo_local_fixture",
      repoProvider: "local",
      repoOwner: "local",
      repoName: "fixture",
      allowedBranchPrefix: "ai/",
      metadata: commonMetadata({ localOnly: true })
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      repoId: "repo_github_fixture",
      repoProvider: "github",
      repoOwner: "aichestra",
      repoName: "demo-backend",
      allowedBranchPrefix: "ai/",
      metadata: commonMetadata({ remoteGitGated: true, liveCallsEnabled: false })
    }
  ],
  providers: [
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      providerId: "mock-llm-provider",
      providerKind: "mock",
      billingMode: "none",
      allowedModelIds: ["mock-small", "mock-coder"],
      metadata: commonMetadata({ remote: false })
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      providerId: "openai-compatible",
      providerKind: "openai_compatible",
      billingMode: "metered_future",
      allowedModelIds: ["openai-compatible-default"],
      metadata: commonMetadata({ remoteGated: true, liveCallsEnabled: false })
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      providerId: "local-cli-provider",
      providerKind: "local_cli",
      billingMode: "external_future",
      allowedModelIds: [],
      metadata: commonMetadata({ credentialCacheAccessAllowed: false, directInvocationEnabled: false })
    }
  ],
  models: [
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      providerId: "mock-llm-provider",
      modelId: "mock-small",
      modelKind: "mock",
      capabilities: ["summarization", "general"],
      metadata: commonMetadata()
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      providerId: "mock-llm-provider",
      modelId: "mock-coder",
      modelKind: "mock",
      capabilities: ["code_generation", "code_review"],
      metadata: commonMetadata()
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      providerId: "openai-compatible",
      modelId: "openai-compatible-default",
      modelKind: "openai_compatible",
      capabilities: ["code_generation", "summarization"],
      metadata: commonMetadata({ remoteGated: true })
    }
  ],
  secrets: [
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      secretRefId: "secretref_mock_provider_metadata",
      secretKind: "mock_metadata",
      provider: "mock",
      allowedPurposes: ["llm_api_call", "provider_invoke"],
      metadata: commonMetadata({ containsSecretMaterial: false })
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      secretRefId: "github_token",
      secretKind: "github_token",
      provider: "env_or_vault_gated",
      allowedPurposes: ["git_remote_operation"],
      metadata: commonMetadata({ containsSecretMaterial: false, configuredByReferenceOnly: true })
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      secretRefId: "llm_api_key",
      secretKind: "llm_api_key",
      provider: "env_or_vault_gated",
      allowedPurposes: ["llm_api_call"],
      metadata: commonMetadata({ containsSecretMaterial: false, configuredByReferenceOnly: true })
    }
  ],
  mcpTools: [
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      mcpServerId: "mock-github-mcp",
      mcpToolId: "github.get_issue",
      riskLevel: "low",
      allowedResourceScopes: ["repo"],
      metadata: commonMetadata({ readOnly: true })
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      mcpServerId: "mock-docs-search-mcp",
      mcpToolId: "docs.search",
      riskLevel: "low",
      allowedResourceScopes: ["global", "project"],
      metadata: commonMetadata({ readOnly: true })
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      mcpServerId: "mock-ci-mcp",
      mcpToolId: "ci.deploy",
      riskLevel: "critical",
      allowedResourceScopes: [],
      metadata: commonMetadata({ disabled: true, writeOrDeploy: true })
    }
  ],
  registryPackages: [
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      packageId: "skill:code-reviewer",
      packageKind: "skill",
      metadata: commonMetadata()
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      packageId: "harness:unit-test",
      packageKind: "harness",
      metadata: commonMetadata()
    },
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      packageId: "instruction:default-coding",
      packageKind: "instruction",
      metadata: commonMetadata()
    }
  ],
  localAgentHosts: [
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      userId: "user_demo_developer",
      hostId: "host_demo",
      agentId: "local-agent-fixture",
      metadata: commonMetadata({ fixtureOnly: true, realTransportEnabled: false })
    }
  ],
  auditQueries: [
    {
      tenantId: defaultTenantId,
      teamId: defaultTeamId,
      projectId: defaultProjectId,
      resourceKinds: ["auth", "policy", "registry", "llm", "mcp"],
      metadata: commonMetadata({ readOnly: true, dashboardReadOnly: true })
    }
  ]
};

export function listMockScopeCatalog(): ScopeCatalog {
  return structuredClone(mockScopeCatalog);
}

export class ScopeContextFactory {
  private readonly catalog: ScopeCatalog;

  constructor(catalog: ScopeCatalog = mockScopeCatalog) {
    this.catalog = structuredClone(catalog);
  }

  listCatalog(): ScopeCatalog {
    return structuredClone(this.catalog);
  }

  createTenantScopeContext(options: {
    tenantId?: string;
    teamId?: string;
    projectId?: string;
    resourceScopes?: PolicyResourceScope[];
    metadata?: Record<string, unknown>;
  } = {}): TenantScopeContext {
    const tenantId = options.tenantId ?? defaultTenantId;
    const teamId = options.teamId ?? defaultTeamId;
    const projectId = options.projectId ?? defaultProjectId;
    const tenantScopes = this.catalog.tenants.filter((scope) => scope.tenantId === tenantId);
    const teamScopes = this.catalog.teams.filter((scope) => scope.tenantId === tenantId && scope.teamId === teamId);
    const projectScopes = this.catalog.projects.filter((scope) => scope.tenantId === tenantId && scope.projectId === projectId);
    const resourceScopes = this.mergeScopes(
      ...tenantScopes.map((scope) => this.toPolicyResourceScope(scope)),
      ...teamScopes.map((scope) => this.toPolicyResourceScope(scope)),
      ...projectScopes.map((scope) => this.toPolicyResourceScope(scope)),
      ...(options.resourceScopes ?? [])
    );
    return {
      tenantScopes,
      teamScopes,
      projectScopes,
      resourceScopes,
      metadata: commonMetadata({
        ...(options.metadata ?? {}),
        tenantId,
        teamId,
        projectId,
        scopeModelVersion: "v1",
        enforcementStatus: "planning_model_only"
      })
    };
  }

  createRepoScope(repo: Partial<RepoScope> & { repoId: string }): RepoScope {
    return {
      tenantId: repo.tenantId ?? defaultTenantId,
      teamId: repo.teamId ?? defaultTeamId,
      projectId: repo.projectId ?? defaultProjectId,
      repoId: repo.repoId,
      repoProvider: repo.repoProvider ?? "mock",
      repoOwner: repo.repoOwner,
      repoName: repo.repoName,
      allowedBranchPrefix: repo.allowedBranchPrefix,
      metadata: commonMetadata(repo.metadata)
    };
  }

  createProviderScope(provider: Partial<ProviderScope> & { providerId: string; providerKind: string }): ProviderScope {
    return {
      tenantId: provider.tenantId ?? defaultTenantId,
      teamId: provider.teamId ?? defaultTeamId,
      projectId: provider.projectId ?? defaultProjectId,
      providerId: provider.providerId,
      providerKind: provider.providerKind,
      billingMode: provider.billingMode,
      allowedModelIds: provider.allowedModelIds ? [...provider.allowedModelIds] : undefined,
      metadata: commonMetadata(provider.metadata)
    };
  }

  createModelScope(model: Partial<ModelScope> & { providerId: string; modelId: string }): ModelScope {
    return {
      tenantId: model.tenantId ?? defaultTenantId,
      teamId: model.teamId ?? defaultTeamId,
      projectId: model.projectId ?? defaultProjectId,
      providerId: model.providerId,
      modelId: model.modelId,
      modelKind: model.modelKind,
      capabilities: model.capabilities ? [...model.capabilities] : undefined,
      metadata: commonMetadata(model.metadata)
    };
  }

  createSecretScope(secretRef: Partial<SecretScopeBinding> & { secretRefId: string; secretKind: string; provider: string }): SecretScopeBinding {
    return {
      tenantId: secretRef.tenantId ?? defaultTenantId,
      teamId: secretRef.teamId ?? defaultTeamId,
      projectId: secretRef.projectId ?? defaultProjectId,
      secretRefId: secretRef.secretRefId,
      secretKind: secretRef.secretKind,
      provider: secretRef.provider,
      allowedPurposes: secretRef.allowedPurposes ? [...secretRef.allowedPurposes] : [],
      metadata: commonMetadata(secretRef.metadata)
    };
  }

  createMcpToolScope(tool: Partial<MCPToolScope> & { mcpServerId: string; mcpToolId: string }): MCPToolScope {
    return {
      tenantId: tool.tenantId ?? defaultTenantId,
      teamId: tool.teamId ?? defaultTeamId,
      projectId: tool.projectId ?? defaultProjectId,
      mcpServerId: tool.mcpServerId,
      mcpToolId: tool.mcpToolId,
      riskLevel: tool.riskLevel ?? "low",
      allowedResourceScopes: tool.allowedResourceScopes ? [...tool.allowedResourceScopes] : [],
      metadata: commonMetadata(tool.metadata)
    };
  }

  createRegistryPackageScope(pkg: Partial<RegistryPackageScope> & { packageId: string }): RegistryPackageScope {
    return {
      tenantId: pkg.tenantId ?? defaultTenantId,
      teamId: pkg.teamId ?? defaultTeamId,
      projectId: pkg.projectId ?? defaultProjectId,
      packageId: pkg.packageId,
      packageKind: pkg.packageKind ?? "unknown",
      metadata: commonMetadata(pkg.metadata)
    };
  }

  createAuditQueryScope(query: Partial<AuditQueryScope> = {}): AuditQueryScope {
    return {
      tenantId: query.tenantId ?? defaultTenantId,
      teamId: query.teamId ?? defaultTeamId,
      projectId: query.projectId ?? defaultProjectId,
      actorId: query.actorId,
      resourceKinds: query.resourceKinds ? [...query.resourceKinds] : undefined,
      metadata: commonMetadata({ ...(query.metadata ?? {}), readOnly: true })
    };
  }

  toPolicyResourceScope(scope: unknown): PolicyResourceScope {
    const record = scope as Record<string, unknown>;
    if (typeof record.tenantId === "string" && typeof record.tenantKind === "string") {
      return policyScope("tenant", record.tenantId, scopeMetadata(record), undefined, undefined, undefined);
    }
    if (typeof record.repoId === "string") {
      return policyScope("repo", record.repoId, scopeMetadata(record), stringValue(record.tenantId), stringValue(record.teamId), stringValue(record.projectId));
    }
    if (typeof record.providerId === "string" && !("modelId" in record)) {
      return policyScope("provider", record.providerId, scopeMetadata(record), stringValue(record.tenantId), stringValue(record.teamId), stringValue(record.projectId));
    }
    if (typeof record.modelId === "string") {
      return policyScope("model", record.modelId, scopeMetadata(record), stringValue(record.tenantId), stringValue(record.teamId), stringValue(record.projectId), [{ scopeKind: "provider", scopeId: stringValue(record.providerId) ?? "unknown-provider" }]);
    }
    if (typeof record.secretRefId === "string") {
      return policyScope("secret", record.secretRefId, scopeMetadata(record), stringValue(record.tenantId), stringValue(record.teamId), stringValue(record.projectId));
    }
    if (typeof record.mcpServerId === "string" && typeof record.mcpToolId === "string") {
      return policyScope("mcp_tool", `${record.mcpServerId}:${record.mcpToolId}`, scopeMetadata(record), stringValue(record.tenantId), stringValue(record.teamId), stringValue(record.projectId));
    }
    if (typeof record.packageId === "string") {
      return policyScope("registry_package", record.packageId, scopeMetadata(record), stringValue(record.tenantId), stringValue(record.teamId), stringValue(record.projectId));
    }
    if (typeof record.hostId === "string") {
      return policyScope("local_agent_host", record.hostId, scopeMetadata(record), stringValue(record.tenantId), stringValue(record.teamId), undefined);
    }
    if (Array.isArray(record.resourceKinds) || "actorId" in record) {
      return policyScope("audit_query", `audit_query:${stringValue(record.tenantId) ?? defaultTenantId}:${stringValue(record.projectId) ?? "global"}`, scopeMetadata(record), stringValue(record.tenantId), stringValue(record.teamId), stringValue(record.projectId));
    }
    if (typeof record.projectId === "string") {
      return policyScope("project", record.projectId, scopeMetadata(record), stringValue(record.tenantId), stringValue(record.teamId), undefined);
    }
    if (typeof record.teamId === "string") {
      return policyScope("team", record.teamId, scopeMetadata(record), stringValue(record.tenantId), undefined, undefined);
    }
    throw new Error("unsupported_scope_shape");
  }

  toPolicyResource(resource: {
    resourceKind: PolicyResource["resourceKind"];
    resourceId?: string;
    scope: unknown;
    metadata?: Record<string, unknown>;
  }): PolicyResource {
    const scope = this.toPolicyResourceScope(resource.scope);
    return createScopedPolicyResource({
      resourceKind: resource.resourceKind,
      resourceId: resource.resourceId ?? scope.scopeId,
      scopeKind: scope.scopeKind,
      scopeId: scope.scopeId,
      tenantId: stringMetadata(scope.metadata.tenantId),
      teamId: stringMetadata(scope.metadata.teamId),
      projectId: stringMetadata(scope.metadata.projectId),
      parentScopes: scope.parentScopes,
      metadata: {
        ...(resource.metadata ?? {}),
        resourceScopes: [scope]
      }
    });
  }

  mergeScopes(...scopes: Array<PolicyResourceScope | undefined>): PolicyResourceScope[] {
    const byKey = new Map<string, PolicyResourceScope>();
    for (const scope of scopes) {
      if (!scope) continue;
      byKey.set(`${scope.scopeKind}:${scope.scopeId}`, structuredClone(scope));
    }
    return [...byKey.values()];
  }

  validateScopeShape(scope: unknown): ScopeShapeValidationResult {
    try {
      const policyScope = this.toPolicyResourceScope(scope);
      if (!policyScope.scopeId.trim()) return { ok: false, errors: ["scopeId_required"] };
      return { ok: true, errors: [] };
    } catch (error) {
      return { ok: false, errors: [error instanceof Error ? error.message : "invalid_scope_shape"] };
    }
  }
}

export function scopeSummary(catalog: ScopeCatalog = mockScopeCatalog): Record<string, unknown> {
  return safeMetadata({
    status: "v1_implemented",
    enforcementStatus: "planning_model_only",
    tenantFilteringStatus: "future",
    productionTenantEnforcement: false,
    noSecretsExposed: true,
    tenants: catalog.tenants.length,
    teams: catalog.teams.length,
    projects: catalog.projects.length,
    repos: catalog.repos.length,
    providers: catalog.providers.length,
    models: catalog.models.length,
    secrets: catalog.secrets.length,
    mcpTools: catalog.mcpTools.length,
    registryPackages: catalog.registryPackages.length,
    localAgentHosts: catalog.localAgentHosts.length,
    auditQueries: catalog.auditQueries.length
  });
}

function policyScope(
  scopeKind: PolicyResourceScopeKind,
  scopeId: string,
  metadata: Record<string, unknown>,
  tenantId?: string,
  teamId?: string,
  projectId?: string,
  parentScopes?: Array<{ scopeKind: PolicyResourceScopeKind; scopeId: string }>
): PolicyResourceScope {
  return createPolicyResourceScope({
    scopeKind,
    scopeId,
    tenantId,
    teamId,
    projectId,
    parentScopes,
    metadata
  });
}

function scopeMetadata(record: Record<string, unknown>): Record<string, unknown> {
  const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
    ? record.metadata as Record<string, unknown>
    : {};
  return commonMetadata({
    ...metadata,
    tenantId: stringValue(record.tenantId),
    teamId: stringValue(record.teamId),
    projectId: stringValue(record.projectId),
    repoProvider: stringValue(record.repoProvider),
    providerKind: stringValue(record.providerKind),
    modelKind: stringValue(record.modelKind),
    secretKind: stringValue(record.secretKind),
    provider: stringValue(record.provider),
    packageKind: stringValue(record.packageKind),
    riskLevel: stringValue(record.riskLevel)
  });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
