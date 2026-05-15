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
import { ApiRequestContextMiddleware, createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { PolicyService } from "@aichestra/policy";

function hasSecretMaterial(value: unknown): boolean {
  return /Bearer\s+[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]+|ghp_|github_pat_|SESSION_SECRET=|JWT_SECRET=|PASSWORD=|authorization=|cookie=|auth\.json|~\/\.claude/i.test(JSON.stringify(value));
}

function createServices(idFactory?: (prefix: string) => string) {
  const policyService = new PolicyService();
  const repository = new InMemoryAuthRepository();
  const authorizationService = new AuthorizationService({
    repository,
    provider: new MockAuthProvider({ repository }),
    policyService
  });
  const resolver = new RequestContextResolver(authorizationService);
  const middleware = new ApiRequestContextMiddleware({ resolver, idFactory });
  return { authorizationService, middleware };
}

function fakeRequest(headers: Record<string, string> = {}): IncomingMessage {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return { headers: normalized } as unknown as IncomingMessage;
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

test("ApiRequestContextMiddleware creates cached mock API contexts without token or cookie storage", () => {
  const { authorizationService, middleware } = createServices();
  const request = fakeRequest({
    "x-aichestra-request-id": "req_middleware_api_v1",
    "x-aichestra-correlation-id": "corr_middleware_api_v1",
    "x-aichestra-actor-id": "user_demo_developer",
    authorization: "Bearer should-not-persist",
    cookie: "session=should-not-persist"
  });

  const context = middleware.resolveApiContext(request, {
    route: "/llm/route",
    method: "POST",
    metadata: { authorization: "Bearer should-redact", safe: "kept" }
  });
  const summary = middleware.getSafeRequestContextSummary(context);
  const denied = authorizationService.hasPermission(context.authContext, "secret.read", { resourceKind: "secret_scope" });

  assert.equal(middleware.requireApiContext(request), context);
  assert.equal(context.requestId, "req_middleware_api_v1");
  assert.equal(context.correlationId, "corr_middleware_api_v1");
  assert.equal(context.source, "api");
  assert.equal(context.authContext.actor.id, "user_demo_developer");
  assert.equal(context.authContext.authMode, "mock");
  assert.equal(summary.authModeCategory, "mock");
  assert.equal(summary.productionAuthEnabled, false);
  assert.equal(context.metadata.authorization, "[redacted]");
  assert.equal(context.metadata.safe, "kept");
  assert.equal(denied.allowed, false);
  assert.match(denied.reason, /policy_denied|permission_denied/);
  assert.equal(hasSecretMaterial({ context, summary }), false);
});

test("ApiRequestContextMiddleware creates dashboard, readiness, and reason-tagged system contexts", () => {
  let sequence = 0;
  const { middleware } = createServices((prefix) => `${prefix}_generated_${++sequence}`);

  const dashboard = middleware.resolveApiContext(fakeRequest({
    "x-aichestra-actor-id": "user_demo_developer",
    authorization: "Bearer dashboard-token"
  }), { route: "/dashboard/overview", method: "GET" });
  const readiness = middleware.resolveApiContext(fakeRequest(), { route: "/readiness/deployment/summary", method: "GET" });
  const system = middleware.resolveSystemContext(fakeRequest(), "api-middleware-test", { route: "/internal/test", method: "POST" });
  const explicitSystem = middleware.createSystemContext("explicit-system-test", {
    requestId: "req_system_middleware_v1",
    correlationId: "corr_system_middleware_v1"
  });

  assert.equal(dashboard.source, "dashboard");
  assert.equal(dashboard.authContext.actor.id, "user_demo_viewer");
  assert.equal(dashboard.requestId, "req_generated_1");
  assert.equal(readiness.source, "readiness");
  assert.equal(readiness.metadata.planningOnly, true);
  assert.equal(system.source, "system");
  assert.equal(middleware.getSafeRequestContextSummary(system).authModeCategory, "system");
  assert.equal(explicitSystem.requestId, "req_system_middleware_v1");
  assert.equal(explicitSystem.correlationId, "corr_system_middleware_v1");
  assert.throws(() => middleware.createSystemContext(""), /system_request_context_reason_required/);
  assert.equal(hasSecretMaterial({ dashboard, readiness, system, explicitSystem }), false);
});

test("ApiRequestContextMiddleware ignores unsafe id headers instead of treating them as auth", () => {
  let sequence = 0;
  const { middleware } = createServices((prefix) => `${prefix}_safe_${++sequence}`);
  const context = middleware.resolveApiContext(fakeRequest({
    "x-aichestra-request-id": "Bearer.not-a-request-id",
    "x-aichestra-correlation-id": "corr with spaces and token",
    "x-aichestra-actor-id": "Bearer.not-an-actor",
    authorization: "Bearer should-not-persist",
    cookie: "session=should-not-persist"
  }), { route: "/auth/me", method: "GET" });

  assert.equal(context.requestId, "req_safe_1");
  assert.equal(context.correlationId, "req_safe_1");
  assert.equal(context.authContext.actor.id, "mock-admin");
  assert.equal(context.metadata.mockActorHeaderIgnored, true);
  assert.equal(context.metadata.requestIdHeaderAccepted, false);
  assert.equal(context.metadata.correlationIdHeaderAccepted, false);
  assert.equal(hasSecretMaterial(context), false);
});

test("API AuthContext middleware is visible on representative auth, policy, security, git, llm, mcp, dashboard, and readiness routes", async () => {
  await withApiServer(async (port) => {
    const headers = {
      "x-aichestra-actor-id": "mock-admin",
      "x-aichestra-request-id": "req_api_middleware_routes_v1",
      "x-aichestra-correlation-id": "corr_api_middleware_routes_v1",
      authorization: "Bearer should-not-be-exposed",
      cookie: "session=should-not-be-exposed"
    };

    const me = await getJson(port, "/auth/me", headers);
    const policy = await postJson(port, "/policy/evaluate", {
      action: "llm.completion",
      resource: { resourceKind: "llm_provider", resourceId: "mock", metadata: { providerKind: "mock" } },
      context: { providerKind: "mock", environment: { budgetAllowed: true } }
    }, headers);
    const policyAudit = await getJson(port, "/policy/audit", headers);
    const security = await postJson(port, "/security/credentials/resolve/check", {
      secretRefId: "secretref_mock_provider_metadata",
      purpose: "llm_api_call",
      providerId: "mock"
    }, headers);
    const securityAudit = await getJson(port, "/security/credentials/audit", headers);
    const git = await postJson(port, "/git/repos/repo_demo_backend/branches", {
      branchName: "codex/api-authcontext-middleware",
      baseBranch: "main"
    }, headers);
    const gitAudit = await getJson(port, "/git/audit", headers);
    const llm = await postJson(port, "/llm/route", {
      taskId: "task_api_middleware_v1",
      taskRunId: "run_api_middleware_v1",
      prompt: "Check API AuthContext middleware",
      budgetLimitUsd: 1
    }, headers);
    const llmDecisions = await getJson(port, "/llm/routing/decisions", headers);
    const mcp = await postJson(port, "/mcp/tools/docs.search/invoke", {
      input: { query: "api auth context middleware sk-hidden" },
      purpose: "api_authcontext_middleware_test"
    }, headers);
    const dashboard = await getJson(port, "/dashboard/overview", headers);
    const dashboardPost = await postJson(port, "/dashboard/overview", {}, headers);
    const readiness = await getJson(port, "/readiness/deployment/summary", headers);
    const readinessPost = await postJson(port, "/readiness/deployment/summary", {}, headers);
    const health = await getJson(port, "/health", headers);

    assert.equal(me.statusCode, 200);
    assert.equal(((me.body.requestContext as Record<string, unknown>).requestId), "req_api_middleware_routes_v1");
    assert.equal(((me.body.requestContext as Record<string, unknown>).correlationId), "corr_api_middleware_routes_v1");
    assert.equal(((me.body.requestContext as Record<string, unknown>).source), "api");
    assert.equal(((me.body.requestContext as Record<string, unknown>).productionAuthEnabled), false);

    assert.equal(policy.statusCode, 200);
    const policyEntries = policyAudit.body.auditEntries as Array<Record<string, unknown>>;
    assert.equal(policyEntries.some((entry) =>
      entry.action === "llm.completion" &&
      entry.requestId === "req_api_middleware_routes_v1" &&
      entry.correlationId === "corr_api_middleware_routes_v1" &&
      entry.source === "api"
    ), true);

    assert.equal(security.statusCode, 200);
    const securityEvents = securityAudit.body.auditEvents as Array<Record<string, unknown>>;
    assert.equal(securityEvents.some((event) =>
      event.requestId === "req_api_middleware_routes_v1" &&
      event.correlationId === "corr_api_middleware_routes_v1"
    ), true);

    assert.equal(git.statusCode, 201);
    const gitEvents = gitAudit.body.auditEvents as Array<{ actorUserId?: string; metadata?: Record<string, unknown> }>;
    assert.equal(gitEvents.some((event) =>
      event.actorUserId === "mock-admin" &&
      event.metadata?.requestId === "req_api_middleware_routes_v1" &&
      event.metadata?.correlationId === "corr_api_middleware_routes_v1"
    ), true);

    assert.equal(llm.statusCode, 200);
    const decisions = llmDecisions.body.decisions as Array<{ metadata?: Record<string, unknown> }>;
    assert.equal(decisions.some((decision) =>
      decision.metadata?.requestId === "req_api_middleware_routes_v1" &&
      decision.metadata?.correlationId === "corr_api_middleware_routes_v1"
    ), true);

    assert.equal(mcp.statusCode, 200);
    assert.equal(((mcp.body.result as { metadata: Record<string, unknown> }).metadata).requestId, "req_api_middleware_routes_v1");
    assert.equal(dashboard.statusCode, 200);
    assert.equal(dashboardPost.statusCode, 405);
    assert.equal(readiness.statusCode, 200);
    assert.equal(readinessPost.statusCode, 405);
    assert.equal(health.statusCode, 200);
    assert.equal(((health.body.requestContext as Record<string, unknown>).productionAuthEnabled), false);
    assert.equal("requestId" in (health.body.requestContext as Record<string, unknown>), false);
    assert.equal(hasSecretMaterial({ me, policy, policyAudit, security, securityAudit, git, gitAudit, llm, llmDecisions, mcp, dashboard, readiness, health }), false);
  });
});
