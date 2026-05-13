import type {
  MCPGatewayConfig,
  MCPServerCatalogEntry,
  MCPToolAuditEvent,
  MCPToolDefinition,
  MCPToolInvocationResult
} from "./types.ts";

function date(value: Date): string {
  return value.toISOString();
}

function sanitizeValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value
      .replaceAll(/\b[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*[^\s"',}]+/gi, "[redacted-env]")
      .replaceAll(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
      .replaceAll(/sk-[A-Za-z0-9_-]{6,}/g, "[redacted]")
      .replaceAll(/ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+/g, "[redacted]")
      .replaceAll(/~\/\.codex\/auth\.json|~\/\.claude[^\s"']*|Google credential cache/gi, "[redacted-credential-cache]");
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      output[key] = /token|secret|password|cookie|credential|apiKey|api_key|authorization/i.test(key)
        ? "[redacted]"
        : sanitizeValue(child);
    }
    return output;
  }
  return String(value);
}

function sanitizeRecord(value: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(value) as Record<string, unknown>;
}

export function mcpGatewayConfigToDto(config: MCPGatewayConfig): Record<string, unknown> {
  return { ...config, secretsExposed: false, tokensExposed: false };
}

export function mcpServerCatalogEntryToDto(server: MCPServerCatalogEntry): Record<string, unknown> {
  return {
    ...server,
    requiredSecretRefs: server.requiredSecretRefs.map((secretRefId) => ({ secretRefId, valueExposed: false })),
    metadata: sanitizeRecord(server.metadata),
    createdAt: date(server.createdAt),
    updatedAt: date(server.updatedAt)
  };
}

export function mcpToolDefinitionToDto(tool: MCPToolDefinition): Record<string, unknown> {
  return {
    ...tool,
    requiredSecretRefs: tool.requiredSecretRefs.map((secretRefId) => ({ secretRefId, valueExposed: false })),
    metadata: sanitizeRecord(tool.metadata),
    createdAt: date(tool.createdAt),
    updatedAt: date(tool.updatedAt)
  };
}

export function mcpToolInvocationResultToDto(result: MCPToolInvocationResult): Record<string, unknown> {
  return {
    ...result,
    output: result.output ? sanitizeRecord(result.output) : undefined,
    outputPreview: result.outputPreview,
    secretLeaseIds: result.secretLeaseIds,
    metadata: sanitizeRecord(result.metadata),
    createdAt: date(result.createdAt),
    completedAt: result.completedAt ? date(result.completedAt) : undefined,
    secretsExposed: false,
    tokensExposed: false
  };
}

export function mcpToolAuditEventToDto(event: MCPToolAuditEvent): Record<string, unknown> {
  return {
    ...event,
    sanitizedMetadata: sanitizeRecord(event.sanitizedMetadata),
    createdAt: date(event.createdAt),
    secretsExposed: false,
    tokensExposed: false
  };
}
