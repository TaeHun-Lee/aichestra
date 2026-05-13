import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  AuthorizationService,
  InMemoryAuthRepository,
  MockAuthProvider
} from "@aichestra/auth";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  DisabledRealMCPTransportGateway,
  MockMCPGateway,
  createDefaultMCPGateway,
  createInMemoryMCPGatewayRepositories,
  defaultMCPServers,
  defaultMCPTools,
  type MCPToolDefinition
} from "@aichestra/mcp-gateway";
import { PolicyService, createPolicyContext, createPolicyResource, createPolicySubject, isPolicyAction } from "@aichestra/policy";
import { SecurityControlService } from "@aichestra/security";

function hasSecret(value: unknown): boolean {
  return /sk-[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._~+/=-]+|ghp_|github_pat_|AICHESTRA_LLM_API_KEY=|AICHESTRA_GITHUB_TOKEN=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|auth\.json|~\/\.claude/.test(JSON.stringify(value));
}

function authServices() {
  const policyService = new PolicyService();
  const repository = new InMemoryAuthRepository();
  const authorizationService = new AuthorizationService({
    repository,
    provider: new MockAuthProvider({ repository }),
    policyService
  });
  const securityService = new SecurityControlService({ policyService, authorizationService });
  return { policyService, authorizationService, securityService };
}

function requestFor(gateway: MockMCPGateway, toolId: string, input: Record<string, unknown> = {}, actorId = "user_demo_developer", taskId?: string) {
  const tool = gateway.getToolById(toolId);
  return {
    id: `req_${toolId.replaceAll(".", "_")}`,
    serverId: tool?.serverId ?? "missing-server",
    toolId,
    toolName: tool?.name ?? toolId,
    actorId,
    taskId,
    taskRunId: taskId ? `run_${taskId}` : undefined,
    input,
    purpose: "test_mcp_gateway_v0",
    metadata: { test: true },
    createdAt: new Date("2026-05-13T00:00:00.000Z")
  };
}

function getJson(port: number, path: string, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, path: string, body: Record<string, unknown> = {}, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized),
        ...headers
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(serialized);
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

test("MCP domain repositories create server and tool catalog entries without secrets", () => {
  const repositories = createInMemoryMCPGatewayRepositories({ servers: [], tools: [] });
  const now = new Date("2026-05-13T00:00:00.000Z");
  const server = repositories.servers.upsertServer({
    id: "mock-custom-mcp",
    name: "mock-custom-mcp",
    displayName: "Mock Custom MCP",
    description: "Test server",
    serverKind: "mock",
    status: "active",
    allowedTools: ["custom.read"],
    requiredSecretRefs: [],
    metadata: {},
    createdAt: now,
    updatedAt: now
  });
  const tool = repositories.tools.upsertTool({
    id: "custom.read",
    serverId: server.id,
    name: "custom.read",
    displayName: "Custom Read",
    description: "Read-only test tool",
    inputSchema: { type: "object" },
    riskLevel: "low",
    requiredPermissions: ["mcp.tool.invoke.low_risk"],
    requiredSecretRefs: [],
    allowedResourceScopes: ["global"],
    status: "active",
    metadata: { readOnly: true },
    createdAt: now,
    updatedAt: now
  });

  assert.equal(server.serverKind, "mock");
  assert.equal(tool.riskLevel, "low");
  assert.equal(hasSecret({ server, tool }), false);
});

test("MockMCPGateway lists active mock catalog and invokes deterministic low-risk tools", async () => {
  const { policyService, authorizationService, securityService } = authServices();
  const gateway = createDefaultMCPGateway({ policyService, authorizationService, securityService });
  const developer = authorizationService.getAuthContext({ actorId: "user_demo_developer", source: "test" });
  const servers = gateway.listServers({ authContext: developer });
  const tools = gateway.listTools("mock-docs-search-mcp", { authContext: developer });
  const result = await gateway.invokeTool(requestFor(gateway, "docs.search", {
    query: "MCP Gateway Bearer should-redact AICHESTRA_LLM_API_KEY=sk-hidden"
  }));

  assert.equal(servers.allowed, true);
  assert.equal(servers.items.some((server) => server.id === "mock-docs-search-mcp"), true);
  assert.equal(tools.allowed, true);
  assert.equal(result.status, "completed");
  assert.equal((result.output as { provider: string }).provider, "mock-mcp");
  assert.equal(hasSecret(result), false);
  assert.equal(hasSecret(gateway.listAuditEvents()), false);
});

test("MCP Gateway blocks unknown, disabled, high-risk, critical, secret, and real transport paths", async () => {
  const { policyService, authorizationService, securityService } = authServices();
  const highRiskTool: MCPToolDefinition = {
    ...defaultMCPTools[0],
    id: "github.high_risk_read",
    name: "github.high_risk_read",
    displayName: "High Risk Read",
    riskLevel: "high",
    status: "active",
    requiredSecretRefs: [],
    requiredPermissions: ["mcp.tool.invoke.high_risk"],
    metadata: { readOnly: true, networkRequired: false, writeOperation: false, deployOperation: false, localExecutionRequired: false }
  };
  const criticalTool: MCPToolDefinition = {
    ...highRiskTool,
    id: "github.critical_read",
    name: "github.critical_read",
    displayName: "Critical Read",
    riskLevel: "critical",
    requiredPermissions: ["mcp.tool.invoke.critical"]
  };
  const server = {
    ...defaultMCPServers[0],
    allowedTools: [...defaultMCPServers[0].allowedTools, highRiskTool.id, criticalTool.id]
  };
  const repositories = createInMemoryMCPGatewayRepositories({
    servers: [server, ...defaultMCPServers.slice(1)],
    tools: [...defaultMCPTools, highRiskTool, criticalTool]
  });
  const gateway = new MockMCPGateway({ repositories, policyService, authorizationService, securityService });

  const unknown = await gateway.invokeTool({
    id: "req_unknown",
    serverId: "missing",
    toolId: "missing.tool",
    toolName: "missing.tool",
    actorId: "user_demo_developer",
    input: {},
    purpose: "test",
    metadata: {},
    createdAt: new Date()
  });
  const disabled = await gateway.invokeTool(requestFor(gateway, "github.create_issue", { title: "blocked" }, "mock-admin"));
  const high = await gateway.invokeTool(requestFor(gateway, "github.high_risk_read", {}, "mock-admin"));
  const critical = await gateway.invokeTool(requestFor(gateway, "github.critical_read", {}, "mock-admin"));
  const secret = await gateway.invokeTool(requestFor(gateway, "github.get_private_issue", { issueNumber: 42 }, "user_demo_developer"));
  const realTransport = await new DisabledRealMCPTransportGateway({ policyService, authorizationService, securityService })
    .invokeTool(requestFor(gateway, "docs.search", { query: "noop" }));

  assert.equal(unknown.status, "blocked");
  assert.equal(disabled.status, "blocked");
  assert.equal(high.status, "policy_denied");
  assert.equal(critical.status, "policy_denied");
  assert.equal(secret.status, "secret_denied");
  assert.equal(secret.secretLeaseIds.length, 0);
  assert.equal(realTransport.status, "unavailable");
});

test("MCP policy and Auth/RBAC allow listing but deny unsafe invocation defaults", async () => {
  const { policyService, authorizationService, securityService } = authServices();
  const gateway = createDefaultMCPGateway({ policyService, authorizationService, securityService });
  const viewer = authorizationService.getAuthContext({ actorId: "user_demo_viewer", source: "test" });
  const developer = authorizationService.getAuthContext({ actorId: "user_demo_developer", source: "test" });
  const serviceAccount = authorizationService.getAuthContext({ actorId: "svc_runner", source: "test" });

  const viewerList = gateway.listTools("mock-docs-search-mcp", { authContext: viewer });
  const viewerInvoke = await gateway.invokeTool(requestFor(gateway, "docs.search", {}, "user_demo_viewer"));
  const developerInvoke = await gateway.invokeTool(requestFor(gateway, "docs.search", {}, "user_demo_developer"));
  const scopedServiceInvoke = await gateway.invokeTool(requestFor(gateway, "docs.search", {}, "svc_runner", "task_demo_backend"));
  const unscopedServiceInvoke = await gateway.invokeTool(requestFor(gateway, "docs.search", {}, "svc_runner", "task_other"));
  const policy = policyService.evaluate({
    subject: createPolicySubject({ actorId: "mcp-policy", actorKind: "system", roles: ["platform_admin"] }),
    action: "mcp.tool.invoke.high_risk",
    resource: createPolicyResource({ resourceKind: "mcp_tool", resourceId: "high" }),
    context: createPolicyContext()
  });

  assert.equal(isPolicyAction("mcp.tool.invoke.low_risk"), true);
  assert.equal(viewerList.allowed, true);
  assert.equal(viewerInvoke.status, "auth_denied");
  assert.equal(developerInvoke.status, "completed");
  assert.equal(scopedServiceInvoke.status, "completed");
  assert.equal(unscopedServiceInvoke.status, "auth_denied");
  assert.equal(policy.allowed, false);
});

test("MCP API, health, and dashboard expose governed metadata without secrets", async () => {
  await withApiServer(async (port) => {
    const health = await getJson(port, "/health");
    const config = await getJson(port, "/mcp/config", { "x-aichestra-actor-id": "user_demo_developer" });
    const servers = await getJson(port, "/mcp/servers", { "x-aichestra-actor-id": "user_demo_viewer" });
    const tools = await getJson(port, "/mcp/servers/mock-docs-search-mcp/tools", { "x-aichestra-actor-id": "user_demo_developer" });
    const tool = await getJson(port, "/mcp/tools/docs.search", { "x-aichestra-actor-id": "user_demo_developer" });
    const invoke = await postJson(port, "/mcp/tools/docs.search/invoke", {
      input: { query: "policy AICHESTRA_GITHUB_TOKEN=ghp_hidden" },
      purpose: "api_test"
    }, { "x-aichestra-actor-id": "user_demo_developer" });
    const blocked = await postJson(port, "/mcp/tools/github.create_issue/invoke", {
      input: { title: "blocked" }
    }, { "x-aichestra-actor-id": "mock-admin" });
    const invocations = await getJson(port, "/mcp/invocations", { "x-aichestra-actor-id": "user_demo_developer" });
    const audit = await getJson(port, "/mcp/audit", { "x-aichestra-actor-id": "user_security_admin" });
    const dashboard = await getJson(port, "/dashboard/mcp");

    assert.equal((health.body.mcp as { gatewayKind: string; realMcpTransportEnabled: boolean }).gatewayKind, "mock");
    assert.equal((health.body.mcp as { gatewayKind: string; realMcpTransportEnabled: boolean }).realMcpTransportEnabled, false);
    assert.equal(config.statusCode, 200);
    assert.equal(servers.statusCode, 200);
    assert.equal(tools.statusCode, 200);
    assert.equal(tool.statusCode, 200);
    assert.equal(invoke.statusCode, 200);
    assert.equal((invoke.body.result as { status: string }).status, "completed");
    assert.equal(blocked.statusCode, 403);
    assert.equal((blocked.body.result as { status: string }).status, "blocked");
    assert.equal(Array.isArray(invocations.body.invocations), true);
    assert.equal(Array.isArray(audit.body.auditEvents), true);
    assert.equal(dashboard.statusCode, 200);
    assert.equal(((dashboard.body.mcp as { integration: { llmAutoToolExecution: boolean; runnerDirectToolExecution: boolean } }).integration).llmAutoToolExecution, false);
    assert.equal(((dashboard.body.mcp as { integration: { llmAutoToolExecution: boolean; runnerDirectToolExecution: boolean } }).integration).runnerDirectToolExecution, false);
    assert.equal(hasSecret({ health, config, servers, tools, tool, invoke, blocked, invocations, audit, dashboard }), false);
  });
});
