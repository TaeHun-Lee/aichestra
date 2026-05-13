import type { AuthContext, AuthorizationDecision } from "@aichestra/auth";
import type { PolicyDecision } from "@aichestra/policy";

export type MCPServerKind = "mock" | "stdio_future" | "http_future" | "sse_future" | "local_agent_future" | "custom_future";
export type MCPEntryStatus = "active" | "disabled" | "deprecated";
export type MCPRiskLevel = "low" | "medium" | "high" | "critical";
export type MCPGatewayKind = "mock" | "disabled_real_transport";

export type MCPServerCatalogEntry = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  serverKind: MCPServerKind;
  status: MCPEntryStatus;
  ownerTeamId?: string;
  allowedTools: string[];
  requiredSecretRefs: string[];
  sandboxProfileId?: string;
  networkPolicyId?: string;
  redactionPolicyId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type MCPToolDefinition = {
  id: string;
  serverId: string;
  name: string;
  displayName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  riskLevel: MCPRiskLevel;
  requiredPermissions: string[];
  requiredSecretRefs: string[];
  allowedResourceScopes: string[];
  status: MCPEntryStatus;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type MCPToolInvocationRequest = {
  id: string;
  serverId: string;
  toolId: string;
  toolName: string;
  actorId?: string;
  principalId?: string;
  taskId?: string;
  taskRunId?: string;
  agentRunId?: string;
  authContext?: AuthContext;
  input: Record<string, unknown>;
  purpose: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type MCPToolInvocationStatus =
  | "completed"
  | "blocked"
  | "failed"
  | "unavailable"
  | "policy_denied"
  | "auth_denied"
  | "secret_denied";

export type MCPToolInvocationResult = {
  id: string;
  requestId: string;
  serverId: string;
  toolId: string;
  status: MCPToolInvocationStatus;
  output?: Record<string, unknown>;
  outputPreview?: string;
  error?: string;
  policyDecisionId?: string;
  authorizationDecisionId?: string;
  secretLeaseIds: string[];
  redactionApplied: boolean;
  createdAt: Date;
  completedAt?: Date;
  metadata: Record<string, unknown>;
};

export type MCPToolAuditEventType =
  | "mcp_server_listed"
  | "mcp_tool_listed"
  | "mcp_tool_invocation_requested"
  | "mcp_tool_invocation_completed"
  | "mcp_tool_invocation_blocked"
  | "mcp_tool_auth_denied"
  | "mcp_tool_policy_denied"
  | "mcp_tool_secret_denied"
  | "mcp_tool_network_denied"
  | "mcp_tool_unavailable"
  | "mcp_real_transport_disabled"
  | "mcp_output_redacted";

export type MCPToolAuditResult = "allowed" | "blocked" | "completed" | "failed" | "denied" | "unavailable" | "redacted";

export type MCPToolAuditEvent = {
  id: string;
  eventType: MCPToolAuditEventType;
  serverId?: string;
  toolId?: string;
  requestId?: string;
  actorId?: string;
  principalId?: string;
  taskId?: string;
  taskRunId?: string;
  result: MCPToolAuditResult;
  reason?: string;
  sanitizedMetadata: Record<string, unknown>;
  createdAt: Date;
};

export type MCPGatewayConfig = {
  gatewayKind: MCPGatewayKind;
  mockGatewayEnabled: boolean;
  realTransportEnabled: false;
  serverCount: number;
  activeToolCount: number;
  highCriticalEnabledToolCount: number;
  externalCallsEnabled: false;
  secretForwardingEnabled: false;
  networkAccessEnabled: false;
};

export type MCPGatewayListResult<T> = {
  allowed: boolean;
  items: T[];
  reason?: string;
  authorizationDecision?: AuthorizationDecision;
};

export type MCPInvocationValidationResult = {
  ok: boolean;
  status: MCPToolInvocationStatus;
  reason: string;
  server?: MCPServerCatalogEntry;
  tool?: MCPToolDefinition;
  authorizationDecision?: AuthorizationDecision;
  policyDecision?: PolicyDecision;
  redactionApplied: boolean;
};

export type MCPGateway = {
  getGatewayKind(): MCPGatewayKind;
  getConfig(): MCPGatewayConfig;
  listServers(input?: { authContext?: AuthContext }): MCPGatewayListResult<MCPServerCatalogEntry>;
  listTools(serverId: string, input?: { authContext?: AuthContext }): MCPGatewayListResult<MCPToolDefinition>;
  getServer(serverId: string): MCPServerCatalogEntry | undefined;
  getTool(serverId: string, toolId: string): MCPToolDefinition | undefined;
  getToolById(toolId: string): MCPToolDefinition | undefined;
  validateInvocation(request: MCPToolInvocationRequest): MCPInvocationValidationResult;
  invokeTool(request: MCPToolInvocationRequest): Promise<MCPToolInvocationResult>;
  listInvocations(filter?: { serverId?: string; toolId?: string; status?: MCPToolInvocationStatus }): MCPToolInvocationResult[];
  getInvocation(id: string): MCPToolInvocationResult | undefined;
  listAuditEvents(filter?: { serverId?: string; toolId?: string; eventType?: MCPToolAuditEventType; actorId?: string }): MCPToolAuditEvent[];
  recordAudit(event: Omit<MCPToolAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): MCPToolAuditEvent;
};
