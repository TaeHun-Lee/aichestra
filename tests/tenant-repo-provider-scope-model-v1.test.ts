import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  AuthorizationService,
  InMemoryAuthRepository,
  MockAuthProvider,
  RequestContextResolver,
  ScopeContextFactory,
  listMockScopeCatalog
} from "@aichestra/auth";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { GitIntegrationService, MockGitProvider } from "@aichestra/git-adapter";
import { LLMGatewayService } from "@aichestra/llm-gateway";
import { createDefaultMCPGateway } from "@aichestra/mcp-gateway";
import { ObservabilityService } from "@aichestra/observability";
import {
  PolicyService,
  createAuditQueryPolicyResource,
  createGitRepoPolicyResource,
  createLlmModelPolicyResource,
  createMcpToolPolicyResource,
  createPolicyContext,
  createPolicySubject,
  createSecretRefPolicyResource
} from "@aichestra/policy";
import { SecurityControlService } from "@aichestra/security";
import { renderDashboardReadModels } from "../apps/web/src/render.ts";

function hasSecretMaterial(value: unknown): boolean {
  return /sk-[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._~+/=-]+|ghp_|github_pat_|SESSION_SECRET=|JWT_SECRET=|PASSWORD=|TOKEN=|authorization:\s*Bearer|cookie:\s*session|auth\.json|~\/\.claude|postgres:\/\//i.test(JSON.stringify(value));
}

function createAuthServices() {
  const policyService = new PolicyService();
  const repository = new InMemoryAuthRepository();
  const authorizationService = new AuthorizationService({
    repository,
    provider: new MockAuthProvider({ repository }),
    policyService
  });
  const resolver = new RequestContextResolver(authorizationService);
  return { policyService, authorizationService, resolver };
}

function getJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
        });
      });
    });
    request.on("error", reject);
  });
}

async function withApiServer(run: (port: number) => Promise<void>): Promise<void> {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("Tenant/Repo/Provider Scope Model v1 creates deterministic mock scope models and policy mappings", () => {
  const factory = new ScopeContextFactory();
  const catalog = listMockScopeCatalog();
  const tenantContext = factory.createTenantScopeContext({ tenantId: "mock-tenant", teamId: "platform-team", projectId: "aichestra-core" });
  const repo = factory.createRepoScope({ repoId: "repo_scope_test", repoProvider: "mock", repoOwner: "aichestra", repoName: "scope-test" });
  const provider = factory.createProviderScope({ providerId: "mock-llm-provider", providerKind: "mock" });
  const model = factory.createModelScope({ providerId: "mock-llm-provider", modelId: "mock-coder", modelKind: "mock" });
  const secret = factory.createSecretScope({ secretRefId: "llm_api_key", secretKind: "llm_api_key", provider: "env_or_vault_gated", allowedPurposes: ["llm_api_call"] });
  const mcpTool = factory.createMcpToolScope({ mcpServerId: "mock-docs-search-mcp", mcpToolId: "docs.search", riskLevel: "low" });
  const registryPackage = factory.createRegistryPackageScope({ packageId: "skill:code-reviewer", packageKind: "skill" });
  const auditQuery = factory.createAuditQueryScope({ actorId: "mock-admin", resourceKinds: ["policy", "auth"] });
  const merged = factory.mergeScopes(factory.toPolicyResourceScope(repo), factory.toPolicyResourceScope(repo), factory.toPolicyResourceScope(model));

  assert.equal(catalog.tenants.some((scope) => scope.tenantId === "mock-tenant"), true);
  assert.equal(tenantContext.resourceScopes.some((scope) => scope.scopeKind === "tenant" && scope.scopeId === "mock-tenant"), true);
  assert.equal(factory.toPolicyResourceScope(repo).scopeKind, "repo");
  assert.equal(factory.toPolicyResourceScope(provider).scopeKind, "provider");
  assert.equal(factory.toPolicyResourceScope(model).parentScopes?.some((scope) => scope.scopeKind === "provider"), true);
  assert.equal(factory.toPolicyResourceScope(secret).scopeKind, "secret");
  assert.equal(factory.toPolicyResourceScope(mcpTool).scopeKind, "mcp_tool");
  assert.equal(factory.toPolicyResourceScope(registryPackage).scopeKind, "registry_package");
  assert.equal(factory.toPolicyResourceScope(auditQuery).scopeKind, "audit_query");
  assert.equal(merged.length, 2);
  assert.equal(factory.validateScopeShape({ nope: true }).ok, false);
  assert.equal(createGitRepoPolicyResource({ repoId: "repo_scope_test" }).scopeKind, "repo");
  assert.equal(createLlmModelPolicyResource({ providerId: "mock-llm-provider", modelId: "mock-coder" }).scopeKind, "model");
  assert.equal(createSecretRefPolicyResource({ secretRefId: "llm_api_key" }).scopeKind, "secret");
  assert.equal(createMcpToolPolicyResource({ serverId: "mock-docs-search-mcp", toolId: "docs.search" }).scopeKind, "mcp_tool");
  assert.equal(createAuditQueryPolicyResource({ actorId: "mock-admin" }).scopeKind, "audit_query");
  assert.equal(hasSecretMaterial({ catalog, tenantContext, repo, provider, model, secret, mcpTool, registryPackage, auditQuery }), false);
});

test("AuthContext, RequestContext, and PolicySubject carry optional scope metadata without granting denied access", () => {
  const { authorizationService, resolver } = createAuthServices();
  const requestContext = resolver.createTestContext("mock-admin", {
    requestId: "req_scope_auth_v1",
    correlationId: "corr_scope_auth_v1",
    tenantId: "mock-tenant",
    teamId: "platform-team",
    projectId: "aichestra-core"
  });
  const subject = authorizationService.toPolicySubject(requestContext.authContext);
  const denied = authorizationService.hasPermission(requestContext.authContext, "secret.read", { resourceKind: "secret_scope" });

  assert.equal(requestContext.tenantId, "mock-tenant");
  assert.equal(requestContext.resourceScopes?.some((scope) => scope.scopeKind === "project" && scope.scopeId === "aichestra-core"), true);
  assert.deepEqual(subject.tenantIds, ["mock-tenant"]);
  assert.equal(subject.projectIds?.includes("aichestra-core"), true);
  assert.equal(subject.resourceScopes?.some((scope) => scope.scopeKind === "tenant"), true);
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /policy_denied|permission_denied/);
});

test("representative Git, LLM, MCP, SecretRef, and Observability boundaries include safe scope metadata", async () => {
  const { policyService, authorizationService, resolver } = createAuthServices();
  const requestContext = resolver.createTestContext("mock-admin", {
    requestId: "req_scope_boundary_v1",
    correlationId: "corr_scope_boundary_v1",
    tenantId: "mock-tenant",
    teamId: "platform-team",
    projectId: "aichestra-core"
  });
  const store = createSeededStore();
  const gitService = new GitIntegrationService({
    store,
    provider: new MockGitProvider(),
    config: {
      providerKind: "mock",
      remoteGitEnabled: false,
      remoteBranchCreateEnabled: false,
      remotePullRequestCreateEnabled: false,
      remoteMergeEnabled: false,
      githubConfigured: false,
      localBranchCreateEnabled: false
    },
    policyService
  });
  const branch = await gitService.createBranch("repo_demo_backend", { branchName: "ai/scope-model-v1", requestContext });
  const gitAudit = gitService.listGitAuditEvents().find((event) => event.action === "git.branch_create_requested");
  assert.equal(branch.ok, true);
  assert.equal(Array.isArray((gitAudit?.metadata as Record<string, unknown>).resourceScopes), true);
  assert.equal(typeof (gitAudit?.metadata as Record<string, unknown>).repoScope, "object");

  const llm = new LLMGatewayService({ usageRepository: store, policyService, authorizationService });
  const llmResult = await llm.routeCompletion({
    taskId: "task_scope_boundary",
    taskRunId: "run_scope_boundary",
    requestContext,
    promptClass: "general",
    requestedCapabilities: ["completion", "general"],
    prompt: "Summarize scope model",
    budgetLimitUsd: 1
  });
  assert.equal(llmResult.ok, true);
  assert.equal(typeof llmResult.routingDecision?.metadata.providerScope, "object");
  assert.equal(typeof llmResult.routingDecision?.metadata.modelScope, "object");

  const security = new SecurityControlService({ policyService, authorizationService });
  security.resolveCredential({
    secretRefId: "secretref_mock_provider_metadata",
    purpose: "llm_api_call",
    providerId: "mock",
    requestContext,
    policyContext: { providerKind: "mock" }
  });
  assert.equal(security.listAuditEvents().some((event) => typeof event.metadata.scopeBinding === "object" && Array.isArray(event.metadata.resourceScopes)), true);

  const mcp = createDefaultMCPGateway({ policyService, authorizationService, securityService: security });
  const tool = mcp.getToolById("docs.search");
  assert.ok(tool);
  const mcpResult = await mcp.invokeTool({
    id: "req_scope_mcp_v1",
    serverId: tool.serverId,
    toolId: tool.id,
    toolName: tool.name,
    requestContext,
    input: { query: "scope model" },
    purpose: "scope_model_test",
    metadata: {},
    createdAt: new Date("2026-05-15T00:00:00.000Z")
  });
  assert.equal(mcpResult.status, "completed");
  assert.equal(typeof mcpResult.metadata.mcpToolScope, "object");
  assert.equal(Array.isArray(mcpResult.metadata.resourceScopes), true);

  const resource = createGitRepoPolicyResource({ repoId: "repo_demo_backend", tenantId: "mock-tenant", projectId: "aichestra-core" });
  policyService.evaluate({
    subject: createPolicySubject({
      actorId: "mock-admin",
      roles: ["admin"],
      tenantIds: ["mock-tenant"],
      projectIds: ["aichestra-core"],
      resourceScopes: resource.resourceScopes
    }),
    action: "git.branch.create",
    resource,
    context: createPolicyContext({ metadata: { requestId: "req_scope_policy_v1" } })
  });
  const observability = new ObservabilityService({
    sourceProvider: () => ({ policyAuditEntries: policyService.listAuditEntries() })
  });
  const policyEnvelope = observability.listAuditEvents({ categories: ["policy"] }).events.find((event) => event.requestId === "req_scope_policy_v1");
  assert.equal(policyEnvelope?.tenantIds?.includes("mock-tenant"), true);
  assert.equal(policyEnvelope?.resourceScopes?.some((scope) => scope.scopeKind === "repo"), true);
  assert.equal(hasSecretMaterial({ gitAudit, llmResult, mcpResult, policyEnvelope, security: security.listAuditEvents() }), false);
});

test("scope readiness APIs and dashboard panel are read-only and secret-safe", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/scopes/summary");
    const tenants = await getJson(port, "/readiness/scopes/tenants");
    const providers = await getJson(port, "/readiness/scopes/providers");
    const dashboard = await getJson(port, "/dashboard/scopes");
    const allDashboard = await getJson(port, "/dashboard/overview");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).status, "v1_implemented");
    assert.equal(summary.body.productionTenantEnforcement, false);
    assert.equal(Array.isArray(tenants.body.tenants), true);
    assert.equal(Array.isArray(providers.body.providers), true);
    assert.equal(dashboard.statusCode, 200);
    assert.equal(((dashboard.body.scopes as Record<string, unknown>).summary as Record<string, unknown>).enforcementStatus, "planning_model_only");
    assert.equal(((allDashboard.body.overview as Record<string, unknown>).sections as Record<string, unknown>).scopes !== undefined, true);
    assert.equal(hasSecretMaterial({ summary, tenants, providers, dashboard, allDashboard }), false);
  });
});

test("dashboard scope panel renders with explicit future enforcement status", async () => {
  await withApiServer(async (port) => {
    const provider = {
      async getReadModels() {
        const { ApiDashboardDataProvider } = await import("../apps/web/lib/dashboard-data-provider.ts");
        return new ApiDashboardDataProvider({ baseUrl: `http://127.0.0.1:${port}` }).getReadModels();
      }
    };
    const html = renderDashboardReadModels(await provider.getReadModels());
    assert.equal(html.includes("Scope Model / Tenant Readiness"), true);
    assert.equal(html.includes("planning_model_only"), true);
    assert.equal(html.includes("production tenant enforcement disabled"), true);
    assert.equal(hasSecretMaterial(html), false);
  });
});
