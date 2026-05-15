import type {
  PolicyResource,
  PolicyResourceKind,
  PolicyResourceScope,
  PolicyResourceScopeKind,
  PolicyResourceScopeParent
} from "./types.ts";
import { createPolicyResource } from "./types.ts";

type ScopeInput = {
  scopeKind: PolicyResourceScopeKind;
  scopeId: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  parentScopes?: PolicyResourceScopeParent[];
  metadata?: Record<string, unknown>;
};

type PolicyResourceContextInput = ScopeInput & {
  resourceKind: PolicyResourceKind;
  resourceId?: string;
};

function sanitizeMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (/token|secret|password|cookie|credential|session|apiKey|api_key|authorization/i.test(key)) {
      output[key] = "[redacted]";
    } else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      output[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function parentScopes(input: Pick<ScopeInput, "tenantId" | "teamId" | "projectId" | "parentScopes">): PolicyResourceScopeParent[] {
  const parents = [...(input.parentScopes ?? [])];
  if (input.tenantId && !parents.some((scope) => scope.scopeKind === "tenant" && scope.scopeId === input.tenantId)) {
    parents.push({ scopeKind: "tenant", scopeId: input.tenantId });
  }
  if (input.teamId && !parents.some((scope) => scope.scopeKind === "team" && scope.scopeId === input.teamId)) {
    parents.push({ scopeKind: "team", scopeId: input.teamId });
  }
  if (input.projectId && !parents.some((scope) => scope.scopeKind === "project" && scope.scopeId === input.projectId)) {
    parents.push({ scopeKind: "project", scopeId: input.projectId });
  }
  return parents;
}

export function createPolicyResourceScope(input: ScopeInput): PolicyResourceScope {
  return {
    scopeKind: input.scopeKind,
    scopeId: input.scopeId,
    parentScopes: parentScopes(input),
    metadata: sanitizeMetadata({
      ...(input.metadata ?? {}),
      tenantId: input.tenantId,
      teamId: input.teamId,
      projectId: input.projectId,
      productionTenantEnforcement: false
    })
  };
}

export function createScopedPolicyResource(input: PolicyResourceContextInput): PolicyResource {
  const resourceScope = createPolicyResourceScope(input);
  return createPolicyResource({
    resourceKind: input.resourceKind,
    resourceId: input.resourceId ?? input.scopeId,
    scopeKind: input.scopeKind,
    scopeId: input.scopeId,
    tenantId: input.tenantId,
    teamId: input.teamId,
    projectId: input.projectId,
    resourceScopes: [resourceScope],
    metadata: sanitizeMetadata({
      ...(input.metadata ?? {}),
      scopeKind: input.scopeKind,
      scopeId: input.scopeId,
      tenantId: input.tenantId,
      teamId: input.teamId,
      projectId: input.projectId,
      resourceScopes: [resourceScope],
      productionTenantEnforcement: false
    })
  });
}

export function createGitRepoPolicyResource(input: {
  repoId: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  repoProvider?: string;
  repoOwner?: string;
  repoName?: string;
  branchName?: string;
  metadata?: Record<string, unknown>;
}): PolicyResource {
  return createScopedPolicyResource({
    resourceKind: "repo",
    resourceId: input.repoId,
    scopeKind: "repo",
    scopeId: input.repoId,
    tenantId: input.tenantId,
    teamId: input.teamId,
    projectId: input.projectId,
    metadata: {
      ...input.metadata,
      repoProvider: input.repoProvider,
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      branchName: input.branchName
    }
  });
}

export function createLlmProviderPolicyResource(input: {
  providerId: string;
  providerKind?: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}): PolicyResource {
  return createScopedPolicyResource({
    resourceKind: "llm_provider",
    resourceId: input.providerId,
    scopeKind: "provider",
    scopeId: input.providerId,
    tenantId: input.tenantId,
    teamId: input.teamId,
    projectId: input.projectId,
    metadata: { ...input.metadata, providerKind: input.providerKind }
  });
}

export function createLlmModelPolicyResource(input: {
  modelId: string;
  providerId?: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}): PolicyResource {
  return createScopedPolicyResource({
    resourceKind: "llm_model",
    resourceId: input.modelId,
    scopeKind: "model",
    scopeId: input.modelId,
    tenantId: input.tenantId,
    teamId: input.teamId,
    projectId: input.projectId,
    parentScopes: input.providerId ? [{ scopeKind: "provider", scopeId: input.providerId }] : undefined,
    metadata: { ...input.metadata, providerId: input.providerId }
  });
}

export function createSecretRefPolicyResource(input: {
  secretRefId: string;
  secretKind?: string;
  provider?: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}): PolicyResource {
  return createScopedPolicyResource({
    resourceKind: "secret_ref",
    resourceId: input.secretRefId,
    scopeKind: "secret",
    scopeId: input.secretRefId,
    tenantId: input.tenantId,
    teamId: input.teamId,
    projectId: input.projectId,
    metadata: { ...input.metadata, secretKind: input.secretKind, provider: input.provider }
  });
}

export function createMcpToolPolicyResource(input: {
  serverId: string;
  toolId: string;
  riskLevel?: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}): PolicyResource {
  return createScopedPolicyResource({
    resourceKind: "mcp_tool",
    resourceId: input.toolId,
    scopeKind: "mcp_tool",
    scopeId: `${input.serverId}:${input.toolId}`,
    tenantId: input.tenantId,
    teamId: input.teamId,
    projectId: input.projectId,
    metadata: { ...input.metadata, serverId: input.serverId, toolId: input.toolId, riskLevel: input.riskLevel }
  });
}

export function createRegistryPackagePolicyResource(input: {
  packageId: string;
  packageKind?: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}): PolicyResource {
  return createScopedPolicyResource({
    resourceKind: "registry_item",
    resourceId: input.packageId,
    scopeKind: "registry_package",
    scopeId: input.packageId,
    tenantId: input.tenantId,
    teamId: input.teamId,
    projectId: input.projectId,
    metadata: { ...input.metadata, packageKind: input.packageKind }
  });
}

export function createAuditQueryPolicyResource(input: {
  queryId?: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  actorId?: string;
  resourceKinds?: string[];
  metadata?: Record<string, unknown>;
}): PolicyResource {
  const scopeId = input.queryId ?? `audit_query:${input.tenantId ?? "mock-tenant"}:${input.projectId ?? "global"}`;
  return createScopedPolicyResource({
    resourceKind: "auth",
    resourceId: scopeId,
    scopeKind: "audit_query",
    scopeId,
    tenantId: input.tenantId,
    teamId: input.teamId,
    projectId: input.projectId,
    metadata: { ...input.metadata, actorId: input.actorId, resourceKinds: input.resourceKinds }
  });
}
