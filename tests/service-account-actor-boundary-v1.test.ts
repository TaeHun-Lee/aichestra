import test from "node:test";
import assert from "node:assert/strict";
import {
  AuthorizationService,
  InMemoryAuthRepository,
  MockAuthProvider,
  ServiceAccountContextFactory,
  createServiceAccountPolicySubject,
  listServiceAccountActorCatalog
} from "@aichestra/auth";
import { createSeededStore } from "@aichestra/db";
import {
  GitIntegrationService,
  GitWebhookReceiverService,
  MockGitProvider,
  NoopGitHubWebhookVerifier,
  supportedGitHubWebhookEvents
} from "@aichestra/git-adapter";
import { LLMGatewayService } from "@aichestra/llm-gateway";
import { createDefaultMCPGateway } from "@aichestra/mcp-gateway";
import { PolicyService } from "@aichestra/policy";
import { SecurityControlService } from "@aichestra/security";

function hasSecretMaterial(value: unknown): boolean {
  return /Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{12,}|ghp_|github_pat_|-----BEGIN PRIVATE KEY-----|SESSION_SECRET=|JWT_SECRET=|PASSWORD=|TOKEN=|auth\.json|~\/\.claude/i.test(JSON.stringify(value));
}

function createAuthServices() {
  const policyService = new PolicyService();
  const repository = new InMemoryAuthRepository();
  const authorizationService = new AuthorizationService({
    repository,
    provider: new MockAuthProvider({ repository }),
    policyService
  });
  const factory = new ServiceAccountContextFactory({
    authorizationService,
    idFactory: (prefix) => `${prefix}_service_account_test`
  });
  return { policyService, authorizationService, factory };
}

function gitRuntimeConfig() {
  return {
    providerKind: "mock" as const,
    remoteGitEnabled: false,
    remoteBranchCreateEnabled: false,
    remotePullRequestCreateEnabled: false,
    remoteMergeEnabled: false as const,
    githubConfigured: false,
    localBranchCreateEnabled: false
  };
}

function webhookRuntimeConfig() {
  return {
    webhooksEnabled: false,
    webhookSecretConfigured: false,
    webhookSecretSource: "none" as const,
    webhookSecretStatus: "missing" as const,
    webhookSecretReason: "github_webhooks_disabled",
    webhookAllowedRepos: ["aichestra/demo-backend"],
    webhookAllowedRepoCount: 1,
    webhookIntegrationTestsEnabled: false,
    webhookAcceptUnverified: false,
    supportedWebhookEvents: [...supportedGitHubWebhookEvents],
    envSecretProviderEnabled: false,
    allowedSecretEnvKeyCount: 0
  };
}

test("Service account actor catalog is mock metadata only and rejects inactive accounts", () => {
  const { factory } = createAuthServices();
  const catalog = listServiceAccountActorCatalog();
  const ids = new Set(catalog.map((entry) => entry.id));

  for (const id of [
    "git_webhook_service",
    "git_sync_service",
    "github_app_token_service",
    "git_provider_service",
    "llm_gateway_service",
    "llm_router_service",
    "mcp_gateway_service",
    "vault_credential_resolver_service",
    "secretref_credential_service",
    "runner_service",
    "local_agent_protocol_service",
    "registry_governance_service",
    "improvement_governance_service",
    "observability_read_service",
    "dashboard_read_service",
    "readiness_read_service",
    "migration_service_future",
    "deployment_service_future"
  ]) {
    assert.equal(ids.has(id), true, `${id} should be in the catalog`);
  }

  assert.equal(catalog.find((entry) => entry.id === "migration_service_future")?.status, "future");
  assert.throws(() => factory.createServiceAccountAuthContext("migration_service_future"), /service_account_not_active/);
  assert.throws(() => factory.createServiceAccountAuthContext("unknown_service_account"), /service_account_unknown/);
  assert.equal(hasSecretMaterial(catalog), false);
});

test("ServiceAccountContextFactory creates mock service-account AuthContext, RequestContext, and PolicySubject", () => {
  const { factory } = createAuthServices();
  const authContext = factory.createServiceAccountAuthContext("git_webhook_service", {
    requestId: "req_service_account_auth_v1",
    correlationId: "corr_service_account_auth_v1",
    source: "webhook",
    metadata: {
      authorization: "Bearer should-not-persist",
      cookie: "session=should-not-persist",
      safe: "kept"
    }
  });
  const requestContext = factory.createServiceAccountRequestContext("git_webhook_service", "webhook", {
    requestId: "req_service_account_request_v1",
    correlationId: "corr_service_account_request_v1",
    metadata: { safe: "request-kept" }
  });
  const subject = factory.toPolicySubject(requestContext.authContext, requestContext);
  const directSubject = createServiceAccountPolicySubject("mcp_gateway_service", {
    requestId: "req_direct_subject_v1",
    correlationId: "corr_direct_subject_v1",
    source: "system"
  });

  assert.equal(authContext.actor.actorKind, "service_account");
  assert.equal(authContext.actor.id, "git_webhook_service");
  assert.equal(authContext.authMode, "mock_service_account");
  assert.equal(authContext.metadata.serviceAccountId, "git_webhook_service");
  assert.equal(authContext.metadata.authorization, "[redacted]");
  assert.equal(requestContext.requestId, "req_service_account_request_v1");
  assert.equal(requestContext.correlationId, "corr_service_account_request_v1");
  assert.equal(requestContext.source, "webhook");
  assert.equal(subject.actorKind, "service_account");
  assert.equal(subject.serviceAccountId, "git_webhook_service");
  assert.equal(subject.requestId, "req_service_account_request_v1");
  assert.equal(subject.correlationId, "corr_service_account_request_v1");
  assert.equal(subject.authMode, "mock_service_account");
  assert.equal(directSubject.serviceAccountId, "mcp_gateway_service");
  assert.equal(directSubject.isMockActor, true);
  assert.equal(hasSecretMaterial({ authContext, requestContext, subject, directSubject }), false);
});

test("Service accounts do not bypass deny-by-default policy or forbidden permissions", () => {
  const { authorizationService, factory } = createAuthServices();
  const gitProvider = factory.createServiceAccountAuthContext("git_provider_service", {
    requestId: "req_service_account_policy_v1",
    correlationId: "corr_service_account_policy_v1",
    source: "system"
  });
  const credentialResolver = factory.createServiceAccountAuthContext("secretref_credential_service", {
    requestId: "req_service_account_credential_policy_v1",
    correlationId: "corr_service_account_credential_policy_v1",
    source: "system"
  });

  const secretRead = authorizationService.hasPermission(credentialResolver, "secret.read", { resourceKind: "secret_scope" });
  const cacheRead = authorizationService.hasPermission(credentialResolver, "credential.cache.read", { resourceKind: "provider_credential" });
  const runnerSecretInject = authorizationService.hasPermission(credentialResolver, "runner.secret.inject", { resourceKind: "runner" });
  const destructiveGit = authorizationService.hasPermission(gitProvider, "git.merge", { resourceKind: "git_operation" });

  assert.equal(secretRead.allowed, false);
  assert.match(secretRead.reason, /policy_denied|permission_denied/);
  assert.equal(cacheRead.allowed, false);
  assert.match(cacheRead.reason, /permission_not_registered|policy_denied|permission_denied/);
  assert.equal(runnerSecretInject.allowed, false);
  assert.match(runnerSecretInject.reason, /permission_not_registered|policy_denied|permission_denied/);
  assert.equal(destructiveGit.allowed, false);
  assert.match(destructiveGit.reason, /policy_denied|permission_denied/);
  assert.equal(secretRead.auditEvent?.serviceAccountId, "secretref_credential_service");
  assert.equal(hasSecretMaterial({ secretRead, cacheRead, runnerSecretInject, destructiveGit }), false);
});

test("Git provider and webhook boundaries use service account actor metadata by default", async () => {
  const { policyService } = createAuthServices();
  const store = createSeededStore();
  const gitService = new GitIntegrationService({
    store,
    provider: new MockGitProvider(),
    config: gitRuntimeConfig(),
    policyService
  });

  const branch = await gitService.createBranch("repo_demo_backend", {
    branchName: "codex/service-account-boundary",
    baseBranch: "main"
  });
  const receiver = new GitWebhookReceiverService({
    store,
    gitIntegrationService: gitService,
    config: webhookRuntimeConfig(),
    verifier: new NoopGitHubWebhookVerifier(),
    policyService
  });
  const webhook = await receiver.receiveGitHubWebhook({
    headers: {
      "x-github-delivery": "delivery_service_account_v1",
      "x-github-event": "pull_request"
    },
    rawBody: JSON.stringify({ action: "opened", repository: { full_name: "aichestra/demo-backend" } })
  });
  const gitAudit = gitService.listGitAuditEvents();
  const branchAudit = gitAudit.find((event) => event.action === "git.branch_create_requested");
  const webhookAudit = receiver.listAuditEvents().find((event) => event.eventType === "github_webhook_disabled");

  assert.equal(branch.ok, true);
  assert.equal(branchAudit?.actorUserId, "git_provider_service");
  assert.equal((branchAudit?.metadata as Record<string, unknown>).serviceAccountId, "git_provider_service");
  assert.equal((branchAudit?.metadata as Record<string, unknown>).actorKind, "service_account");
  assert.equal(webhook.ok, false);
  assert.equal(webhook.status, "disabled");
  assert.equal(webhookAudit?.sanitizedMetadata.serviceAccountId, "git_webhook_service");
  assert.equal(webhookAudit?.sanitizedMetadata.actorKind, "service_account");
  assert.equal(store.listAuditLogs().some((event) => event.actorUserId === "git_webhook_service" && (event.metadata as Record<string, unknown>).serviceAccountId === "git_webhook_service"), true);
  assert.equal(hasSecretMaterial({ gitAudit, webhookAudit }), false);
});

test("LLM, MCP, and Security service fallbacks include service account audit metadata", async () => {
  const { policyService, authorizationService } = createAuthServices();
  const store = createSeededStore();
  const llm = new LLMGatewayService({
    usageRepository: store,
    policyService,
    authorizationService
  });
  const llmResult = await llm.routeCompletion({
    taskId: "task_service_account_llm",
    taskRunId: "run_service_account_llm",
    prompt: "Use a mock service-account boundary",
    budgetLimitUsd: 1
  });

  const security = new SecurityControlService({ policyService, authorizationService });
  const credential = security.resolveCredential({
    secretRefId: "secretref_mock_provider_metadata",
    purpose: "llm_api_call",
    providerId: "mock",
    policyContext: { providerKind: "mock" }
  });

  const mcp = createDefaultMCPGateway({ policyService, authorizationService, securityService: security });
  const tool = mcp.getToolById("docs.search");
  assert.ok(tool);
  const mcpResult = await mcp.invokeTool({
    id: "req_mcp_service_account_v1",
    serverId: tool.serverId,
    toolId: tool.id,
    toolName: tool.name,
    input: { query: "service account boundary" },
    purpose: "service_account_boundary_test",
    metadata: {},
    createdAt: new Date("2026-05-15T00:00:00.000Z")
  });

  assert.equal(llmResult.ok, true);
  assert.equal(llm.listAuditEvents().some((event) => event.serviceAccountId === "llm_gateway_service" && event.actorId === "llm_gateway_service"), true);
  assert.equal(credential.allowed, false);
  assert.match(credential.blockedReason ?? "", /authorization_denied|policy_denied/);
  assert.equal(security.listAuditEvents().some((event) => event.serviceAccountId === "secretref_credential_service" && event.actorId === "secretref_credential_service"), true);
  assert.equal(mcpResult.status, "completed");
  assert.equal(mcp.listAuditEvents().some((event) => event.serviceAccountId === "mcp_gateway_service" && event.actorId === "mcp_gateway_service"), true);
  assert.equal(hasSecretMaterial({ llmResult, credential, mcpResult, llmAudit: llm.listAuditEvents(), securityAudit: security.listAuditEvents(), mcpAudit: mcp.listAuditEvents() }), false);
});
