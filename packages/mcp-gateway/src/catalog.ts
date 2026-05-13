import type { MCPServerCatalogEntry, MCPToolDefinition } from "./types.ts";

const createdAt = new Date("2026-05-13T00:00:00.000Z");

function schema(properties: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "object",
    properties,
    additionalProperties: false
  };
}

function server(input: Omit<MCPServerCatalogEntry, "createdAt" | "updatedAt">): MCPServerCatalogEntry {
  return { ...input, createdAt, updatedAt: createdAt };
}

function tool(input: Omit<MCPToolDefinition, "createdAt" | "updatedAt">): MCPToolDefinition {
  return { ...input, createdAt, updatedAt: createdAt };
}

export const defaultMCPServers: MCPServerCatalogEntry[] = [
  server({
    id: "mock-github-mcp",
    name: "mock-github-mcp",
    displayName: "Mock GitHub MCP",
    description: "Deterministic read-only GitHub-like MCP fixture.",
    serverKind: "mock",
    status: "active",
    ownerTeamId: "team_development",
    allowedTools: ["github.get_issue", "github.list_pull_requests", "github.get_private_issue", "github.create_issue"],
    requiredSecretRefs: [],
    metadata: { realIntegration: false, externalCalls: false }
  }),
  server({
    id: "mock-docs-search-mcp",
    name: "mock-docs-search-mcp",
    displayName: "Mock Docs Search MCP",
    description: "Deterministic documentation search fixture.",
    serverKind: "mock",
    status: "active",
    ownerTeamId: "team_platform",
    allowedTools: ["docs.search"],
    requiredSecretRefs: [],
    metadata: { realIntegration: false, externalCalls: false }
  }),
  server({
    id: "mock-jira-mcp",
    name: "mock-jira-mcp",
    displayName: "Mock Jira MCP",
    description: "Deterministic Jira-like ticket fixture.",
    serverKind: "mock",
    status: "active",
    ownerTeamId: "team_development",
    allowedTools: ["jira.get_ticket", "jira.transition_ticket"],
    requiredSecretRefs: [],
    metadata: { realIntegration: false, externalCalls: false }
  }),
  server({
    id: "mock-db-schema-mcp",
    name: "mock-db-schema-mcp",
    displayName: "Mock DB Schema MCP",
    description: "Deterministic database schema metadata fixture.",
    serverKind: "mock",
    status: "active",
    ownerTeamId: "team_platform",
    allowedTools: ["db.get_schema", "db.run_write_query"],
    requiredSecretRefs: [],
    metadata: { realIntegration: false, externalCalls: false }
  }),
  server({
    id: "mock-ci-mcp",
    name: "mock-ci-mcp",
    displayName: "Mock CI MCP",
    description: "Deterministic CI status fixture.",
    serverKind: "mock",
    status: "active",
    ownerTeamId: "team_development",
    allowedTools: ["ci.get_latest_status", "ci.deploy"],
    requiredSecretRefs: [],
    metadata: { realIntegration: false, externalCalls: false }
  }),
  server({
    id: "future-http-mcp",
    name: "future-http-mcp",
    displayName: "Future HTTP MCP Transport",
    description: "Disabled real MCP transport placeholder.",
    serverKind: "http_future",
    status: "disabled",
    ownerTeamId: "team_platform",
    allowedTools: ["future.real_tool"],
    requiredSecretRefs: [],
    metadata: { notImplemented: true, realTransport: false }
  })
];

export const defaultMCPTools: MCPToolDefinition[] = [
  tool({
    id: "github.get_issue",
    serverId: "mock-github-mcp",
    name: "github.get_issue",
    displayName: "Get Mock Issue",
    description: "Read deterministic mock issue metadata.",
    inputSchema: schema({ issueNumber: { type: "number" } }),
    outputSchema: schema({ issue: { type: "object" } }),
    riskLevel: "low",
    requiredPermissions: ["mcp.tool.invoke.low_risk"],
    requiredSecretRefs: [],
    allowedResourceScopes: ["repo"],
    status: "active",
    metadata: { readOnly: true, networkRequired: false, writeOperation: false, deployOperation: false, localExecutionRequired: false }
  }),
  tool({
    id: "github.list_pull_requests",
    serverId: "mock-github-mcp",
    name: "github.list_pull_requests",
    displayName: "List Mock Pull Requests",
    description: "Read deterministic mock pull request metadata.",
    inputSchema: schema({ state: { type: "string" } }),
    outputSchema: schema({ pullRequests: { type: "array" } }),
    riskLevel: "low",
    requiredPermissions: ["mcp.tool.invoke.low_risk"],
    requiredSecretRefs: [],
    allowedResourceScopes: ["repo"],
    status: "active",
    metadata: { readOnly: true, networkRequired: false, writeOperation: false, deployOperation: false, localExecutionRequired: false }
  }),
  tool({
    id: "github.get_private_issue",
    serverId: "mock-github-mcp",
    name: "github.get_private_issue",
    displayName: "Get Private Mock Issue",
    description: "Secret-requiring read fixture that remains blocked in v0.",
    inputSchema: schema({ issueNumber: { type: "number" } }),
    riskLevel: "low",
    requiredPermissions: ["mcp.tool.invoke.low_risk", "mcp.tool.secret.resolve"],
    requiredSecretRefs: ["secretref_future_github_mcp"],
    allowedResourceScopes: ["repo"],
    status: "active",
    metadata: { readOnly: true, networkRequired: false, writeOperation: false, deployOperation: false, localExecutionRequired: false }
  }),
  tool({
    id: "github.create_issue",
    serverId: "mock-github-mcp",
    name: "github.create_issue",
    displayName: "Create Mock Issue",
    description: "Write-like fixture disabled by default.",
    inputSchema: schema({ title: { type: "string" }, body: { type: "string" } }),
    riskLevel: "high",
    requiredPermissions: ["mcp.tool.invoke.high_risk", "mcp.tool.write"],
    requiredSecretRefs: ["secretref_future_github_mcp"],
    allowedResourceScopes: ["repo"],
    status: "disabled",
    metadata: { readOnly: false, networkRequired: false, writeOperation: true, deployOperation: false, localExecutionRequired: false }
  }),
  tool({
    id: "docs.search",
    serverId: "mock-docs-search-mcp",
    name: "docs.search",
    displayName: "Search Mock Docs",
    description: "Search deterministic local documentation metadata.",
    inputSchema: schema({ query: { type: "string" } }),
    outputSchema: schema({ results: { type: "array" } }),
    riskLevel: "low",
    requiredPermissions: ["mcp.tool.invoke.low_risk"],
    requiredSecretRefs: [],
    allowedResourceScopes: ["global"],
    status: "active",
    metadata: { readOnly: true, networkRequired: false, writeOperation: false, deployOperation: false, localExecutionRequired: false }
  }),
  tool({
    id: "jira.get_ticket",
    serverId: "mock-jira-mcp",
    name: "jira.get_ticket",
    displayName: "Get Mock Ticket",
    description: "Read deterministic Jira-like ticket metadata.",
    inputSchema: schema({ ticketKey: { type: "string" } }),
    outputSchema: schema({ ticket: { type: "object" } }),
    riskLevel: "low",
    requiredPermissions: ["mcp.tool.invoke.low_risk"],
    requiredSecretRefs: [],
    allowedResourceScopes: ["project"],
    status: "active",
    metadata: { readOnly: true, networkRequired: false, writeOperation: false, deployOperation: false, localExecutionRequired: false }
  }),
  tool({
    id: "jira.transition_ticket",
    serverId: "mock-jira-mcp",
    name: "jira.transition_ticket",
    displayName: "Transition Mock Ticket",
    description: "Write-like fixture disabled by default.",
    inputSchema: schema({ ticketKey: { type: "string" }, transition: { type: "string" } }),
    riskLevel: "high",
    requiredPermissions: ["mcp.tool.invoke.high_risk", "mcp.tool.write"],
    requiredSecretRefs: ["secretref_future_jira_mcp"],
    allowedResourceScopes: ["project"],
    status: "disabled",
    metadata: { readOnly: false, networkRequired: false, writeOperation: true, deployOperation: false, localExecutionRequired: false }
  }),
  tool({
    id: "db.get_schema",
    serverId: "mock-db-schema-mcp",
    name: "db.get_schema",
    displayName: "Get Mock DB Schema",
    description: "Read deterministic database schema metadata.",
    inputSchema: schema({ schemaName: { type: "string" } }),
    outputSchema: schema({ tables: { type: "array" } }),
    riskLevel: "low",
    requiredPermissions: ["mcp.tool.invoke.low_risk"],
    requiredSecretRefs: [],
    allowedResourceScopes: ["project"],
    status: "active",
    metadata: { readOnly: true, networkRequired: false, writeOperation: false, deployOperation: false, localExecutionRequired: false }
  }),
  tool({
    id: "db.run_write_query",
    serverId: "mock-db-schema-mcp",
    name: "db.run_write_query",
    displayName: "Run Mock Write Query",
    description: "Critical database write fixture disabled by default.",
    inputSchema: schema({ sql: { type: "string" } }),
    riskLevel: "critical",
    requiredPermissions: ["mcp.tool.invoke.critical", "mcp.tool.write"],
    requiredSecretRefs: ["secretref_future_db_mcp"],
    allowedResourceScopes: ["project"],
    status: "disabled",
    metadata: { readOnly: false, networkRequired: false, writeOperation: true, deployOperation: false, localExecutionRequired: false }
  }),
  tool({
    id: "ci.get_latest_status",
    serverId: "mock-ci-mcp",
    name: "ci.get_latest_status",
    displayName: "Get Latest Mock CI Status",
    description: "Read deterministic CI status metadata.",
    inputSchema: schema({ branch: { type: "string" } }),
    outputSchema: schema({ status: { type: "string" } }),
    riskLevel: "low",
    requiredPermissions: ["mcp.tool.invoke.low_risk"],
    requiredSecretRefs: [],
    allowedResourceScopes: ["repo"],
    status: "active",
    metadata: { readOnly: true, networkRequired: false, writeOperation: false, deployOperation: false, localExecutionRequired: false }
  }),
  tool({
    id: "ci.deploy",
    serverId: "mock-ci-mcp",
    name: "ci.deploy",
    displayName: "Deploy Mock CI",
    description: "Critical deployment fixture disabled by default.",
    inputSchema: schema({ environment: { type: "string" } }),
    riskLevel: "critical",
    requiredPermissions: ["mcp.tool.invoke.critical", "mcp.tool.deploy"],
    requiredSecretRefs: ["secretref_future_ci_mcp"],
    allowedResourceScopes: ["project"],
    status: "disabled",
    metadata: { readOnly: false, networkRequired: false, writeOperation: false, deployOperation: true, localExecutionRequired: false }
  }),
  tool({
    id: "future.real_tool",
    serverId: "future-http-mcp",
    name: "future.real_tool",
    displayName: "Future Real MCP Tool",
    description: "Disabled real transport placeholder.",
    inputSchema: schema(),
    riskLevel: "critical",
    requiredPermissions: ["mcp.tool.invoke.critical"],
    requiredSecretRefs: [],
    allowedResourceScopes: [],
    status: "disabled",
    metadata: { notImplemented: true, realTransport: false, networkRequired: true }
  })
];
