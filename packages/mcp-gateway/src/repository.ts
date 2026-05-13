import { randomUUID } from "node:crypto";
import { defaultMCPServers, defaultMCPTools } from "./catalog.ts";
import type {
  MCPEntryStatus,
  MCPServerCatalogEntry,
  MCPToolAuditEvent,
  MCPToolAuditEventType,
  MCPToolDefinition,
  MCPToolInvocationResult,
  MCPToolInvocationStatus
} from "./types.ts";

function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sanitizeMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (/token|secret|password|cookie|credential|apiKey|api_key|authorization/i.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string") {
      output[key] = value
        .replaceAll(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
        .replaceAll(/sk-[A-Za-z0-9_-]{6,}/g, "[redacted]")
        .replaceAll(/ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+/g, "[redacted]")
        .replaceAll(/~\/\.codex\/auth\.json|~\/\.claude[^\s"']*|Google credential cache/gi, "[redacted-credential-cache]");
      continue;
    }
    output[key] = typeof value === "object" && value !== null && !Array.isArray(value)
      ? sanitizeMetadata(value as Record<string, unknown>)
      : clone(value);
  }
  return output;
}

export type MCPServerCatalogRepository = {
  listServers(filter?: { status?: MCPEntryStatus }): MCPServerCatalogEntry[];
  getServer(id: string): MCPServerCatalogEntry | undefined;
  upsertServer(input: MCPServerCatalogEntry): MCPServerCatalogEntry;
};

export type MCPToolDefinitionRepository = {
  listTools(filter?: { serverId?: string; status?: MCPEntryStatus }): MCPToolDefinition[];
  getTool(id: string): MCPToolDefinition | undefined;
  upsertTool(input: MCPToolDefinition): MCPToolDefinition;
};

export type MCPToolInvocationRepository = {
  recordInvocation(input: MCPToolInvocationResult): MCPToolInvocationResult;
  getInvocation(id: string): MCPToolInvocationResult | undefined;
  listInvocations(filter?: { serverId?: string; toolId?: string; status?: MCPToolInvocationStatus }): MCPToolInvocationResult[];
};

export type MCPToolAuditRepository = {
  recordAuditEvent(input: Omit<MCPToolAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): MCPToolAuditEvent;
  listAuditEvents(filter?: { serverId?: string; toolId?: string; eventType?: MCPToolAuditEventType; actorId?: string }): MCPToolAuditEvent[];
};

export type MCPGatewayRepositories = {
  servers: MCPServerCatalogRepository;
  tools: MCPToolDefinitionRepository;
  invocations: MCPToolInvocationRepository;
  audit: MCPToolAuditRepository;
};

export class InMemoryMCPServerCatalogRepository implements MCPServerCatalogRepository {
  private readonly servers: MCPServerCatalogEntry[];

  constructor(seed: MCPServerCatalogEntry[] = defaultMCPServers) {
    this.servers = clone(seed);
  }

  listServers(filter: { status?: MCPEntryStatus } = {}): MCPServerCatalogEntry[] {
    return clone(this.servers.filter((server) => filter.status === undefined || server.status === filter.status));
  }

  getServer(id: string): MCPServerCatalogEntry | undefined {
    return clone(this.servers.find((server) => server.id === id || server.name === id));
  }

  upsertServer(input: MCPServerCatalogEntry): MCPServerCatalogEntry {
    return this.upsert(this.servers, input);
  }

  private upsert<T extends { id: string }>(items: T[], input: T): T {
    const index = items.findIndex((item) => item.id === input.id);
    if (index >= 0) {
      items[index] = clone(input);
      return clone(items[index]);
    }
    items.push(clone(input));
    return clone(input);
  }
}

export class InMemoryMCPToolDefinitionRepository implements MCPToolDefinitionRepository {
  private readonly tools: MCPToolDefinition[];

  constructor(seed: MCPToolDefinition[] = defaultMCPTools) {
    this.tools = clone(seed);
  }

  listTools(filter: { serverId?: string; status?: MCPEntryStatus } = {}): MCPToolDefinition[] {
    return clone(this.tools.filter((tool) =>
      (filter.serverId === undefined || tool.serverId === filter.serverId) &&
      (filter.status === undefined || tool.status === filter.status)
    ));
  }

  getTool(id: string): MCPToolDefinition | undefined {
    return clone(this.tools.find((tool) => tool.id === id || tool.name === id));
  }

  upsertTool(input: MCPToolDefinition): MCPToolDefinition {
    const index = this.tools.findIndex((tool) => tool.id === input.id);
    if (index >= 0) {
      this.tools[index] = clone(input);
      return clone(this.tools[index]);
    }
    this.tools.push(clone(input));
    return clone(input);
  }
}

export class InMemoryMCPToolInvocationRepository implements MCPToolInvocationRepository {
  private readonly invocations: MCPToolInvocationResult[] = [];

  recordInvocation(input: MCPToolInvocationResult): MCPToolInvocationResult {
    this.invocations.push(clone(input));
    return clone(input);
  }

  getInvocation(id: string): MCPToolInvocationResult | undefined {
    return clone(this.invocations.find((invocation) => invocation.id === id || invocation.requestId === id));
  }

  listInvocations(filter: { serverId?: string; toolId?: string; status?: MCPToolInvocationStatus } = {}): MCPToolInvocationResult[] {
    return clone(this.invocations
      .filter((invocation) =>
        (filter.serverId === undefined || invocation.serverId === filter.serverId) &&
        (filter.toolId === undefined || invocation.toolId === filter.toolId) &&
        (filter.status === undefined || invocation.status === filter.status))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id)));
  }
}

export class InMemoryMCPToolAuditRepository implements MCPToolAuditRepository {
  private readonly auditEvents: MCPToolAuditEvent[] = [];

  recordAuditEvent(input: Omit<MCPToolAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): MCPToolAuditEvent {
    const event: MCPToolAuditEvent = {
      ...input,
      id: input.id ?? createId("mcpaudit"),
      createdAt: input.createdAt ?? new Date(),
      sanitizedMetadata: sanitizeMetadata(input.sanitizedMetadata)
    };
    this.auditEvents.push(clone(event));
    return clone(event);
  }

  listAuditEvents(filter: { serverId?: string; toolId?: string; eventType?: MCPToolAuditEventType; actorId?: string } = {}): MCPToolAuditEvent[] {
    return clone(this.auditEvents
      .filter((event) =>
        (filter.serverId === undefined || event.serverId === filter.serverId) &&
        (filter.toolId === undefined || event.toolId === filter.toolId) &&
        (filter.eventType === undefined || event.eventType === filter.eventType) &&
        (filter.actorId === undefined || event.actorId === filter.actorId))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id)));
  }
}

export function createInMemoryMCPGatewayRepositories(seed: {
  servers?: MCPServerCatalogEntry[];
  tools?: MCPToolDefinition[];
} = {}): MCPGatewayRepositories {
  return {
    servers: new InMemoryMCPServerCatalogRepository(seed.servers),
    tools: new InMemoryMCPToolDefinitionRepository(seed.tools),
    invocations: new InMemoryMCPToolInvocationRepository(),
    audit: new InMemoryMCPToolAuditRepository()
  };
}
