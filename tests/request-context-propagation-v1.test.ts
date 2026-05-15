import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import {
  AuthorizationService,
  InMemoryAuthRepository,
  MockAuthProvider,
  RequestContextResolver
} from "@aichestra/auth";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { GitIntegrationService, MockGitProvider } from "@aichestra/git-adapter";
import { LLMGatewayService } from "@aichestra/llm-gateway";
import { createDefaultMCPGateway } from "@aichestra/mcp-gateway";
import { PolicyService } from "@aichestra/policy";
import { SecurityControlService } from "@aichestra/security";

function hasSecretMaterial(value: unknown): boolean {
  return /sk-[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._~+/=-]+|ghp_|github_pat_|SESSION_SECRET=|JWT_SECRET=|PASSWORD=|auth\.json|~\/\.claude/.test(JSON.stringify(value));
}

function createServices() {
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

function postJson(port: number, path: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
        ...headers
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
        });
      });
    });
    request.on("error", reject);
    request.end(payload);
  });
}

function getJson(port: number, path: string, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
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

test("RequestContextResolver v1 creates API, system, test, webhook, dashboard, readiness, and correlation contexts without secrets", () => {
  const { resolver } = createServices();
  const apiRequest = {
    headers: {
      "x-aichestra-request-id": "req_api_context_v1",
      "x-aichestra-correlation-id": "corr_api_context_v1",
      "x-aichestra-actor-id": "user_demo_developer",
      authorization: "Bearer should-not-be-persisted",
      cookie: "session=should-not-be-persisted"
    }
  } as unknown as IncomingMessage;

  const api = resolver.fromApiRequest(apiRequest, { metadata: { apiKey: "sk-hidden", safe: "kept" } });
  const system = resolver.createSystemContext("unit-test-system", { requestId: "req_system_v1", correlationId: "corr_system_v1" });
  const fixture = resolver.createTestContext("user_demo_viewer", { requestId: "req_test_v1", correlationId: "corr_test_v1", metadata: { fixture: true } });
  const webhook = resolver.createWebhookContext("github", "delivery-123", { requestId: "req_webhook_v1" });
  const dashboard = resolver.createDashboardContext({ requestId: "req_dashboard_v1" });
  const readiness = resolver.createReadinessContext({ requestId: "req_readiness_v1" });
  const correlation = resolver.toCorrelationContext(api, { taskId: "task_ctx", taskRunId: "run_ctx" });

  assert.equal(api.requestId, "req_api_context_v1");
  assert.equal(api.correlationId, "corr_api_context_v1");
  assert.equal(api.source, "api");
  assert.equal(api.authContext.actor.id, "user_demo_developer");
  assert.equal(api.metadata.apiKey, "[redacted]");
  assert.equal(system.source, "system");
  assert.equal(system.authContext.metadata.mockSystemContext, true);
  assert.equal(fixture.source, "test");
  assert.equal(webhook.source, "webhook");
  assert.equal(webhook.correlationId, "delivery-123");
  assert.equal(dashboard.source, "dashboard");
  assert.equal(readiness.source, "readiness");
  assert.equal(correlation.requestId, api.requestId);
  assert.equal(correlation.correlationId, "corr_api_context_v1");
  assert.equal(correlation.actorId, "user_demo_developer");
  assert.throws(() => resolver.createSystemContext(""), /system_request_context_reason_required/);
  assert.equal(hasSecretMaterial({ api, system, fixture, webhook, dashboard, readiness, correlation }), false);
});

test("AuthContext to PolicySubject mapping includes request metadata while deny-by-default still wins", () => {
  const { authorizationService, resolver } = createServices();
  const requestContext = resolver.createTestContext("mock-admin", {
    requestId: "req_policy_subject_v1",
    correlationId: "corr_policy_subject_v1"
  });
  const subject = authorizationService.toPolicySubject(requestContext.authContext);
  const denied = authorizationService.hasPermission(requestContext.authContext, "secret.read", { resourceKind: "secret_scope" });

  assert.equal(subject.actorId, "mock-admin");
  assert.equal(subject.principalId, "principal_mock_admin");
  assert.equal(subject.requestId, "req_policy_subject_v1");
  assert.equal(subject.correlationId, "corr_policy_subject_v1");
  assert.equal(subject.source, "test");
  assert.equal(subject.authMode, "mock");
  assert.equal(subject.isMockActor, true);
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /policy_denied|permission_denied/);
  assert.equal(denied.auditEvent?.correlationId, "corr_policy_subject_v1");
});

test("Git, LLM, MCP, and Security services preserve actor and correlation metadata from RequestContext", async () => {
  const { policyService, authorizationService, resolver } = createServices();
  const requestContext = resolver.createTestContext("user_demo_developer", {
    requestId: "req_service_context_v1",
    correlationId: "corr_service_context_v1"
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
  const branch = await gitService.createBranch("repo_demo_backend", {
    branchName: "codex/request-context-service",
    baseBranch: "main",
    requestContext
  });
  assert.equal(branch.ok, true);
  const gitAudit = gitService.listGitAuditEvents().find((event) => event.action === "git.branch_create_requested");
  assert.equal(gitAudit?.actorUserId, "user_demo_developer");
  assert.equal((gitAudit?.metadata as Record<string, unknown>).requestId, "req_service_context_v1");
  assert.equal((gitAudit?.metadata as Record<string, unknown>).correlationId, "corr_service_context_v1");

  const llm = new LLMGatewayService({ usageRepository: store, policyService, authorizationService });
  const llmResult = await llm.routeCompletion({
    taskId: "task_service_ctx",
    taskRunId: "run_service_ctx",
    requestContext,
    prompt: "Fix request context propagation",
    budgetLimitUsd: 1
  });
  assert.equal(llmResult.ok, true);
  assert.equal(llmResult.routingDecision?.metadata.requestId, "req_service_context_v1");
  assert.equal(llm.listAuditEvents().some((event) => event.requestId === "req_service_context_v1" && event.correlationId === "corr_service_context_v1"), true);

  const security = new SecurityControlService({ policyService, authorizationService });
  security.resolveCredential({
    secretRefId: "secretref_mock_provider_metadata",
    purpose: "llm_api_call",
    providerId: "mock",
    requestContext,
    policyContext: { providerKind: "mock" }
  });
  assert.equal(security.listAuditEvents().some((event) => event.requestId === "req_service_context_v1" && event.correlationId === "corr_service_context_v1"), true);

  const mcp = createDefaultMCPGateway({ policyService, authorizationService, securityService: security });
  const tool = mcp.getToolById("docs.search");
  assert.ok(tool);
  const mcpResult = await mcp.invokeTool({
    id: "req_mcp_service_ctx",
    serverId: tool.serverId,
    toolId: tool.id,
    toolName: tool.name,
    requestContext,
    input: { query: "request context" },
    purpose: "service_context_test",
    metadata: {},
    createdAt: new Date("2026-05-15T00:00:00.000Z")
  });
  assert.equal(mcpResult.status, "completed");
  assert.equal(mcpResult.metadata.requestId, "req_service_context_v1");
  assert.equal(mcp.listAuditEvents().some((event) => event.correlationId === "corr_service_context_v1"), true);
  assert.equal(hasSecretMaterial({ gitAudit, llm: llm.listAuditEvents(), security: security.listAuditEvents(), mcp: mcp.listAuditEvents() }), false);
});

test("API routes propagate RequestContext to representative Git, LLM, MCP, Security, dashboard, readiness, and observability paths", async () => {
  await withApiServer(async (port) => {
    const headers = {
      "x-aichestra-actor-id": "user_demo_developer",
      "x-aichestra-request-id": "req_api_propagation_v1",
      "x-aichestra-correlation-id": "corr_api_propagation_v1"
    };

    const git = await postJson(port, "/git/repos/repo_demo_backend/branches", {
      branchName: "codex/request-context-api",
      baseBranch: "main"
    }, headers);
    const gitAudit = await getJson(port, "/git/audit", headers);
    const llm = await postJson(port, "/llm/route", {
      taskId: "task_api_ctx",
      taskRunId: "run_api_ctx",
      prompt: "Fix context propagation",
      budgetLimitUsd: 1
    }, headers);
    const llmDecisions = await getJson(port, "/llm/routing/decisions", headers);
    const mcp = await postJson(port, "/mcp/tools/docs.search/invoke", {
      input: { query: "request context AICHESTRA_LLM_API_KEY=sk-hidden" },
      purpose: "api_context_test"
    }, headers);
    const security = await postJson(port, "/security/credentials/resolve/check", {
      secretRefId: "secretref_mock_provider_metadata",
      purpose: "llm_api_call",
      providerId: "mock"
    }, headers);
    const securityAudit = await getJson(port, "/security/credentials/audit", headers);
    const dashboard = await getJson(port, "/dashboard/overview", headers);
    const readiness = await getJson(port, "/readiness/deployment/summary", headers);
    const observability = await getJson(port, "/observability/audit/events", headers);

    assert.equal(git.statusCode, 201);
    assert.equal(llm.statusCode, 200);
    assert.equal(mcp.statusCode, 200);
    assert.equal((mcp.body.result as { status: string }).status, "completed");
    assert.equal(security.statusCode, 200);
    assert.equal(dashboard.statusCode, 200);
    assert.equal(readiness.statusCode, 200);
    assert.equal(observability.statusCode, 200);

    const gitEvents = gitAudit.body.auditEvents as Array<{ metadata: Record<string, unknown>; actorUserId: string }>;
    assert.equal(gitEvents.some((event) => event.actorUserId === "user_demo_developer" && event.metadata.requestId === "req_api_propagation_v1" && event.metadata.correlationId === "corr_api_propagation_v1"), true);
    const decisions = llmDecisions.body.decisions as Array<{ metadata: Record<string, unknown> }>;
    assert.equal(decisions.some((decision) => decision.metadata.requestId === "req_api_propagation_v1" && decision.metadata.correlationId === "corr_api_propagation_v1"), true);
    assert.equal(((mcp.body.result as { metadata: Record<string, unknown> }).metadata).requestId, "req_api_propagation_v1");
    const securityEvents = securityAudit.body.auditEvents as Array<{ requestId?: string; correlationId?: string }>;
    assert.equal(securityEvents.some((event) => event.requestId === "req_api_propagation_v1" && event.correlationId === "corr_api_propagation_v1"), true);
    assert.equal(hasSecretMaterial({ git, gitAudit, llm, llmDecisions, mcp, security, securityAudit, dashboard, readiness, observability }), false);
  });
});
