import { randomUUID } from "node:crypto";
import type { AuthContext, AuthorizationDecision } from "@aichestra/auth";
import { AuthorizationService } from "@aichestra/auth";
import { PolicyService, createPolicyContext, createPolicyResource } from "@aichestra/policy";
import type { PolicyAction, PolicyDecision } from "@aichestra/policy";
import { SecurityControlService } from "@aichestra/security";
import { createInMemoryMCPGatewayRepositories } from "./repository.ts";
import type { MCPGatewayRepositories } from "./repository.ts";
import type {
  MCPGateway,
  MCPGatewayConfig,
  MCPGatewayKind,
  MCPGatewayListResult,
  MCPInvocationValidationResult,
  MCPRiskLevel,
  MCPServerCatalogEntry,
  MCPToolAuditEvent,
  MCPToolAuditEventType,
  MCPToolDefinition,
  MCPToolInvocationRequest,
  MCPToolInvocationResult,
  MCPToolInvocationStatus
} from "./types.ts";

function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function riskAction(riskLevel: MCPRiskLevel): PolicyAction {
  if (riskLevel === "critical") return "mcp.tool.invoke.critical";
  if (riskLevel === "high" || riskLevel === "medium") return "mcp.tool.invoke.high_risk";
  return "mcp.tool.invoke.low_risk";
}

function resultStatusForReason(reason: string): MCPToolInvocationStatus {
  if (reason.includes("authorization")) return "auth_denied";
  if (reason.includes("policy")) return "policy_denied";
  if (reason.includes("secret")) return "secret_denied";
  if (reason.includes("unavailable") || reason.includes("not_implemented")) return "unavailable";
  return "blocked";
}

function toJsonPreview(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function booleanMetadata(value: unknown): boolean {
  return value === true;
}

type MCPGatewayInput = {
  repositories?: MCPGatewayRepositories;
  policyService?: PolicyService;
  authorizationService?: AuthorizationService;
  securityService?: SecurityControlService;
};

export class MockMCPGateway implements MCPGateway {
  private readonly repositories: MCPGatewayRepositories;
  private readonly policyService: PolicyService;
  private readonly authorizationService: AuthorizationService;
  private readonly securityService: SecurityControlService;

  constructor(input: MCPGatewayInput = {}) {
    this.repositories = input.repositories ?? createInMemoryMCPGatewayRepositories();
    this.policyService = input.policyService ?? new PolicyService();
    this.authorizationService = input.authorizationService ?? new AuthorizationService({ policyService: this.policyService });
    this.securityService = input.securityService ?? new SecurityControlService({
      policyService: this.policyService,
      authorizationService: this.authorizationService
    });
  }

  getGatewayKind(): MCPGatewayKind {
    return "mock";
  }

  getConfig(): MCPGatewayConfig {
    const servers = this.repositories.servers.listServers();
    const tools = this.repositories.tools.listTools();
    return {
      gatewayKind: "mock",
      mockGatewayEnabled: true,
      realTransportEnabled: false,
      serverCount: servers.length,
      activeToolCount: tools.filter((tool) => tool.status === "active").length,
      highCriticalEnabledToolCount: tools.filter((tool) => tool.status === "active" && (tool.riskLevel === "high" || tool.riskLevel === "critical")).length,
      externalCallsEnabled: false,
      secretForwardingEnabled: false,
      networkAccessEnabled: false
    };
  }

  listServers(input: { authContext?: AuthContext } = {}): MCPGatewayListResult<MCPServerCatalogEntry> {
    const authContext = input.authContext ?? this.authorizationService.getAuthContext({ source: "api", metadata: { mcpGateway: true } });
    const authorizationDecision = this.authorize(authContext, "mcp.server.list", "mcp_server", "mcp_servers", {
      readOnly: true,
      serverKind: "mock",
      serverStatus: "active",
      realTransportEnabled: false
    });
    if (!authorizationDecision.allowed) {
      this.recordAudit({
        eventType: "mcp_tool_auth_denied",
        actorId: authContext.actor.id,
        principalId: authContext.principal.id,
        result: "denied",
        reason: authorizationDecision.reason,
        sanitizedMetadata: { action: "mcp.server.list", authorizationDecisionId: authorizationDecision.auditEvent?.id }
      });
      return { allowed: false, items: [], reason: authorizationDecision.reason, authorizationDecision };
    }
    const items = this.repositories.servers.listServers();
    this.recordAudit({
      eventType: "mcp_server_listed",
      actorId: authContext.actor.id,
      principalId: authContext.principal.id,
      result: "allowed",
      reason: "mcp_server_catalog_listed",
      sanitizedMetadata: { count: items.length }
    });
    return { allowed: true, items, authorizationDecision };
  }

  listTools(serverId: string, input: { authContext?: AuthContext } = {}): MCPGatewayListResult<MCPToolDefinition> {
    const authContext = input.authContext ?? this.authorizationService.getAuthContext({ source: "api", metadata: { mcpGateway: true } });
    const server = this.repositories.servers.getServer(serverId);
    if (!server || server.status !== "active") {
      return { allowed: false, items: [], reason: server ? `server_${server.status}` : "server_not_found" };
    }
    const authorizationDecision = this.authorize(authContext, "mcp.tool.list", "mcp_tool", serverId, {
      readOnly: true,
      serverKind: server.serverKind,
      serverStatus: server.status,
      realTransportEnabled: false
    });
    if (!authorizationDecision.allowed) {
      this.recordAudit({
        eventType: "mcp_tool_auth_denied",
        serverId,
        actorId: authContext.actor.id,
        principalId: authContext.principal.id,
        result: "denied",
        reason: authorizationDecision.reason,
        sanitizedMetadata: { action: "mcp.tool.list", authorizationDecisionId: authorizationDecision.auditEvent?.id }
      });
      return { allowed: false, items: [], reason: authorizationDecision.reason, authorizationDecision };
    }
    const items = this.repositories.tools.listTools({ serverId });
    this.recordAudit({
      eventType: "mcp_tool_listed",
      serverId,
      actorId: authContext.actor.id,
      principalId: authContext.principal.id,
      result: "allowed",
      reason: "mcp_tool_catalog_listed",
      sanitizedMetadata: { count: items.length }
    });
    return { allowed: true, items, authorizationDecision };
  }

  getServer(serverId: string): MCPServerCatalogEntry | undefined {
    return this.repositories.servers.getServer(serverId);
  }

  getTool(serverId: string, toolId: string): MCPToolDefinition | undefined {
    const tool = this.repositories.tools.getTool(toolId);
    return tool?.serverId === serverId ? tool : undefined;
  }

  getToolById(toolId: string): MCPToolDefinition | undefined {
    return this.repositories.tools.getTool(toolId);
  }

  validateInvocation(request: MCPToolInvocationRequest): MCPInvocationValidationResult {
    const server = this.repositories.servers.getServer(request.serverId);
    const tool = this.repositories.tools.getTool(request.toolId);
    const authContext = this.authContextForRequest(request);
    if (!server) return { ok: false, status: "blocked", reason: "server_not_found", redactionApplied: false };
    if (!tool || tool.serverId !== server.id || tool.name !== request.toolName) {
      return { ok: false, status: "blocked", reason: "tool_not_found", server, redactionApplied: false };
    }
    if (server.status !== "active") {
      return { ok: false, status: "blocked", reason: `server_${server.status}`, server, tool, redactionApplied: false };
    }
    if (tool.status !== "active") {
      return { ok: false, status: "blocked", reason: `tool_${tool.status}`, server, tool, redactionApplied: false };
    }
    if (server.serverKind !== "mock") {
      return { ok: false, status: "unavailable", reason: "real_mcp_transport_disabled", server, tool, redactionApplied: false };
    }
    if (!server.allowedTools.includes(tool.id)) {
      return { ok: false, status: "blocked", reason: "tool_not_allowed_for_server", server, tool, redactionApplied: false };
    }

    const environment = this.policyEnvironment(server, tool);
    const authorizationDecision = this.authorize(authContext, riskAction(tool.riskLevel), "mcp_tool", tool.id, environment, request);
    if (!authorizationDecision.allowed) {
      if (authorizationDecision.policyDecision && (tool.requiredSecretRefs.length > 0 || server.requiredSecretRefs.length > 0)) {
        return {
          ok: false,
          status: "secret_denied",
          reason: "mcp_tool_secret_resolution_disabled_v0",
          server,
          tool,
          authorizationDecision,
          policyDecision: authorizationDecision.policyDecision,
          redactionApplied: false
        };
      }
      return {
        ok: false,
        status: authorizationDecision.policyDecision ? "policy_denied" : "auth_denied",
        reason: authorizationDecision.reason,
        server,
        tool,
        authorizationDecision,
        policyDecision: authorizationDecision.policyDecision,
        redactionApplied: false
      };
    }

    const genericPolicy = this.policyService.evaluate({
      subject: this.authorizationService.toPolicySubject(authContext),
      action: "mcp.tool.invoke",
      resource: createPolicyResource({
        resourceKind: "mcp_tool",
        resourceId: tool.id,
        metadata: { status: tool.status, riskLevel: tool.riskLevel, serverKind: server.serverKind }
      }),
      context: createPolicyContext({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        environment,
        metadata: {
          requestId: request.id,
          purpose: request.purpose
        }
      })
    });
    if (!genericPolicy.allowed) {
      return {
        ok: false,
        status: "policy_denied",
        reason: `policy_denied:${genericPolicy.reason}`,
        server,
        tool,
        authorizationDecision,
        policyDecision: genericPolicy,
        redactionApplied: false
      };
    }

    if (tool.requiredSecretRefs.length > 0 || server.requiredSecretRefs.length > 0) {
      return {
        ok: false,
        status: "secret_denied",
        reason: "mcp_tool_secret_resolution_disabled_v0",
        server,
        tool,
        authorizationDecision,
        policyDecision: authorizationDecision.policyDecision ?? genericPolicy,
        redactionApplied: false
      };
    }

    if (booleanMetadata(tool.metadata.networkRequired)) {
      const networkDecision = this.securityService.evaluateNetworkEgress({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: authContext.actor.id,
        metadata: { serverId: server.id, toolId: tool.id }
      });
      return {
        ok: false,
        status: "policy_denied",
        reason: networkDecision.allowed ? "mcp_network_access_not_implemented_v0" : "mcp_network_access_denied",
        server,
        tool,
        authorizationDecision,
        policyDecision: authorizationDecision.policyDecision ?? genericPolicy,
        redactionApplied: false
      };
    }

    if (booleanMetadata(tool.metadata.writeOperation)) {
      return {
        ok: false,
        status: "policy_denied",
        reason: "mcp_write_tool_denied_v0",
        server,
        tool,
        authorizationDecision,
        policyDecision: authorizationDecision.policyDecision ?? genericPolicy,
        redactionApplied: false
      };
    }

    if (booleanMetadata(tool.metadata.deployOperation)) {
      return {
        ok: false,
        status: "policy_denied",
        reason: "mcp_deploy_tool_denied_v0",
        server,
        tool,
        authorizationDecision,
        policyDecision: authorizationDecision.policyDecision ?? genericPolicy,
        redactionApplied: false
      };
    }

    if (booleanMetadata(tool.metadata.localExecutionRequired)) {
      return {
        ok: false,
        status: "unavailable",
        reason: "local_agent_transport_required_not_implemented_v0",
        server,
        tool,
        authorizationDecision,
        policyDecision: authorizationDecision.policyDecision ?? genericPolicy,
        redactionApplied: false
      };
    }

    return {
      ok: true,
      status: "completed",
      reason: "mcp_mock_tool_allowed",
      server,
      tool,
      authorizationDecision,
      policyDecision: authorizationDecision.policyDecision ?? genericPolicy,
      redactionApplied: false
    };
  }

  async invokeTool(request: MCPToolInvocationRequest): Promise<MCPToolInvocationResult> {
    const authContext = this.authContextForRequest(request);
    this.recordAudit({
      eventType: "mcp_tool_invocation_requested",
      serverId: request.serverId,
      toolId: request.toolId,
      requestId: request.id,
      actorId: authContext.actor.id,
      principalId: authContext.principal.id,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      result: "allowed",
      reason: "mcp_invocation_received",
      sanitizedMetadata: this.redactedMetadata(request, "input")
    });
    const validation = this.validateInvocation(request);
    if (!validation.ok) {
      const status = validation.status || resultStatusForReason(validation.reason);
      const result = this.recordResult(request, {
        status,
        error: validation.reason,
        policyDecisionId: validation.policyDecision?.id,
        authorizationDecisionId: validation.authorizationDecision?.auditEvent?.id,
        output: undefined,
        outputPreview: undefined,
        redactionApplied: validation.redactionApplied,
        metadata: {
          reason: validation.reason,
          serverStatus: validation.server?.status,
          toolStatus: validation.tool?.status,
          riskLevel: validation.tool?.riskLevel
        }
      });
      this.recordAudit({
        eventType: status === "auth_denied"
          ? "mcp_tool_auth_denied"
          : status === "policy_denied"
            ? "mcp_tool_policy_denied"
            : status === "secret_denied"
              ? "mcp_tool_secret_denied"
              : status === "unavailable"
                ? "mcp_tool_unavailable"
                : "mcp_tool_invocation_blocked",
        serverId: request.serverId,
        toolId: request.toolId,
        requestId: request.id,
        actorId: authContext.actor.id,
        principalId: authContext.principal.id,
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        result: status === "unavailable" ? "unavailable" : "blocked",
        reason: validation.reason,
        sanitizedMetadata: {
          policyDecisionId: validation.policyDecision?.id,
          authorizationDecisionId: validation.authorizationDecision?.auditEvent?.id
        }
      });
      return result;
    }

    const output = this.mockOutput(validation.tool, request.input);
    const redacted = this.securityService.redactText({
      text: toJsonPreview(output),
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: authContext.actor.id,
      metadata: { serverId: request.serverId, toolId: request.toolId }
    });
    if (redacted.redactionApplied || redacted.truncated) {
      this.recordAudit({
        eventType: "mcp_output_redacted",
        serverId: request.serverId,
        toolId: request.toolId,
        requestId: request.id,
        actorId: authContext.actor.id,
        principalId: authContext.principal.id,
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        result: "redacted",
        reason: redacted.redactionApplied ? "redaction_applied" : "output_preview_truncated",
        sanitizedMetadata: { previewBytes: redacted.previewBytes, originalBytes: redacted.originalBytes }
      });
    }
    const result = this.recordResult(request, {
      status: "completed",
      output,
      outputPreview: redacted.preview,
      policyDecisionId: validation.policyDecision?.id,
      authorizationDecisionId: validation.authorizationDecision?.auditEvent?.id,
      redactionApplied: redacted.redactionApplied || redacted.truncated,
      metadata: {
        gatewayKind: "mock",
        deterministic: true,
        readOnly: validation.tool?.metadata.readOnly === true,
        policyDecisionId: validation.policyDecision?.id
      }
    });
    this.recordAudit({
      eventType: "mcp_tool_invocation_completed",
      serverId: request.serverId,
      toolId: request.toolId,
      requestId: request.id,
      actorId: authContext.actor.id,
      principalId: authContext.principal.id,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      result: "completed",
      reason: "mock_mcp_tool_completed",
      sanitizedMetadata: {
        outputPreview: redacted.preview,
        policyDecisionId: validation.policyDecision?.id,
        authorizationDecisionId: validation.authorizationDecision?.auditEvent?.id
      }
    });
    return result;
  }

  listInvocations(filter: { serverId?: string; toolId?: string; status?: MCPToolInvocationStatus } = {}): MCPToolInvocationResult[] {
    return this.repositories.invocations.listInvocations(filter);
  }

  getInvocation(id: string): MCPToolInvocationResult | undefined {
    return this.repositories.invocations.getInvocation(id);
  }

  listAuditEvents(filter: { serverId?: string; toolId?: string; eventType?: MCPToolAuditEventType; actorId?: string } = {}): MCPToolAuditEvent[] {
    return this.repositories.audit.listAuditEvents(filter);
  }

  recordAudit(event: Omit<MCPToolAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): MCPToolAuditEvent {
    return this.repositories.audit.recordAuditEvent(event);
  }

  protected authContextForRequest(request: MCPToolInvocationRequest): AuthContext {
    return request.authContext ?? this.authorizationService.getAuthContext({
      actorId: request.actorId,
      source: "api",
      metadata: {
        mcpGateway: true,
        requestId: request.id,
        taskId: request.taskId,
        taskRunId: request.taskRunId
      }
    });
  }

  private authorize(
    authContext: AuthContext,
    action: string,
    resourceKind: string,
    resourceId: string,
    environment: Record<string, unknown>,
    request?: MCPToolInvocationRequest
  ): AuthorizationDecision {
    return this.authorizationService.check({
      authContext,
      action,
      resource: {
        resourceKind,
        resourceId,
        scope: request?.taskId
          ? {
            id: `scope_task_${request.taskId}`,
            scopeKind: "task",
            scopeId: request.taskId,
            description: "MCP invocation task scope",
            metadata: { mcpGateway: true }
          }
          : undefined,
        metadata: {
          ...environment,
          mcpGateway: true
        }
      },
      policyContext: {
        taskId: request?.taskId,
        taskRunId: request?.taskRunId,
        environment,
        metadata: {
          requestId: request?.id,
          purpose: request?.purpose
        }
      }
    });
  }

  private policyEnvironment(server: MCPServerCatalogEntry, tool: MCPToolDefinition): Record<string, unknown> {
    return {
      serverKind: server.serverKind,
      serverStatus: server.status,
      toolStatus: tool.status,
      riskLevel: tool.riskLevel,
      readOnly: tool.metadata.readOnly === true,
      requiresSecrets: tool.requiredSecretRefs.length > 0 || server.requiredSecretRefs.length > 0,
      networkRequired: tool.metadata.networkRequired === true,
      writeOperation: tool.metadata.writeOperation === true,
      deployOperation: tool.metadata.deployOperation === true,
      realTransportEnabled: false,
      localExecutionRequired: tool.metadata.localExecutionRequired === true
    };
  }

  private recordResult(
    request: MCPToolInvocationRequest,
    input: {
      status: MCPToolInvocationStatus;
      output?: Record<string, unknown>;
      outputPreview?: string;
      error?: string;
      policyDecisionId?: string;
      authorizationDecisionId?: string;
      redactionApplied: boolean;
      metadata: Record<string, unknown>;
    }
  ): MCPToolInvocationResult {
    return this.repositories.invocations.recordInvocation({
      id: createId("mcpinv"),
      requestId: request.id,
      serverId: request.serverId,
      toolId: request.toolId,
      status: input.status,
      output: input.output,
      outputPreview: input.outputPreview,
      error: input.error,
      policyDecisionId: input.policyDecisionId,
      authorizationDecisionId: input.authorizationDecisionId,
      secretLeaseIds: [],
      redactionApplied: input.redactionApplied,
      createdAt: new Date(),
      completedAt: new Date(),
      metadata: input.metadata
    });
  }

  private redactedMetadata(request: MCPToolInvocationRequest, label: string): Record<string, unknown> {
    const redacted = this.securityService.redactText({
      text: toJsonPreview(request.input),
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId,
      metadata: { serverId: request.serverId, toolId: request.toolId, label }
    });
    return {
      purpose: request.purpose,
      inputPreview: redacted.preview,
      redactionApplied: redacted.redactionApplied || redacted.truncated
    };
  }

  private mockOutput(tool: MCPToolDefinition | undefined, input: Record<string, unknown>): Record<string, unknown> {
    switch (tool?.id) {
      case "github.get_issue":
        return {
          provider: "mock-mcp",
          toolName: tool.name,
          issue: {
            number: typeof input.issueNumber === "number" ? input.issueNumber : 101,
            title: "Mock issue for deterministic MCP Gateway v0",
            state: "open",
            labels: ["mock", "read-only"]
          }
        };
      case "github.list_pull_requests":
        return {
          provider: "mock-mcp",
          toolName: tool.name,
          pullRequests: [
            { number: 12, title: "Mock PR sync read model", state: "open" },
            { number: 13, title: "Mock docs update", state: "closed" }
          ]
        };
      case "docs.search":
        return {
          provider: "mock-mcp",
          toolName: tool.name,
          query: typeof input.query === "string" ? input.query : "",
          results: [
            { title: "Aichestra Bootstrap", path: "docs/briefs/AICHESTRA_BOOTSTRAP.md", score: 0.97 },
            { title: "MCP Gateway v0", path: "docs/features/mcp-gateway/v0.md", score: 0.91 }
          ]
        };
      case "jira.get_ticket":
        return {
          provider: "mock-mcp",
          toolName: tool.name,
          ticket: {
            key: typeof input.ticketKey === "string" ? input.ticketKey : "AIC-101",
            status: "In Review",
            summary: "Mock ticket for deterministic tool governance"
          }
        };
      case "db.get_schema":
        return {
          provider: "mock-mcp",
          toolName: tool.name,
          schemaName: typeof input.schemaName === "string" ? input.schemaName : "public",
          tables: [
            { name: "tasks", columns: ["id", "title", "status"] },
            { name: "task_runs", columns: ["id", "task_id", "status"] }
          ]
        };
      case "ci.get_latest_status":
        return {
          provider: "mock-mcp",
          toolName: tool.name,
          branch: typeof input.branch === "string" ? input.branch : "main",
          status: "passed",
          checkedAt: "2026-05-13T00:00:00.000Z"
        };
      default:
        return {
          provider: "mock-mcp",
          toolName: tool?.name ?? "unknown",
          result: "deterministic_mock_output"
        };
    }
  }
}

export class DisabledRealMCPTransportGateway extends MockMCPGateway {
  getGatewayKind(): MCPGatewayKind {
    return "disabled_real_transport";
  }

  getConfig(): MCPGatewayConfig {
    const base = super.getConfig();
    return {
      ...base,
      gatewayKind: "disabled_real_transport",
      mockGatewayEnabled: false,
      realTransportEnabled: false,
      externalCallsEnabled: false,
      secretForwardingEnabled: false,
      networkAccessEnabled: false
    };
  }

  override async invokeTool(request: MCPToolInvocationRequest): Promise<MCPToolInvocationResult> {
    const authContext = this.authContextForRequest(request);
    this.recordAudit({
      eventType: "mcp_real_transport_disabled",
      serverId: request.serverId,
      toolId: request.toolId,
      requestId: request.id,
      actorId: authContext.actor.id,
      principalId: authContext.principal.id,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      result: "unavailable",
      reason: "real_mcp_transport_disabled",
      sanitizedMetadata: { networkAccess: false, processSpawn: false, secretForwarding: false }
    });
    return {
      id: createId("mcpinv"),
      requestId: request.id,
      serverId: request.serverId,
      toolId: request.toolId,
      status: "unavailable",
      error: "real_mcp_transport_disabled",
      secretLeaseIds: [],
      redactionApplied: false,
      createdAt: new Date(),
      completedAt: new Date(),
      metadata: { gatewayKind: "disabled_real_transport", notImplemented: true }
    };
  }
}

export function createDefaultMCPGateway(input: MCPGatewayInput = {}): MockMCPGateway {
  return new MockMCPGateway(input);
}
