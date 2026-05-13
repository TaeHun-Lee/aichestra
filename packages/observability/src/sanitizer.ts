export type AuditSanitizerOptions = {
  maxStringBytes?: number;
  maxMetadataBytes?: number;
  maxArrayItems?: number;
};

const defaultOptions: Required<AuditSanitizerOptions> = {
  maxStringBytes: 1024,
  maxMetadataBytes: 4096,
  maxArrayItems: 50
};

const sensitiveKeyPattern = /(?:^|_|\b)(token|secret|password|authorization|api[_-]?key|raw[_-]?payload|payload[_-]?raw|prompt|tool[_-]?input|session[_-]?secret|jwt[_-]?secret|credential[_-]?value|credential[_-]?cache|cache[_-]?path|private[_-]?key)(?:$|_|\b)/i;
const bearerPattern = /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi;
const apiKeyPattern = /\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|AIza[0-9A-Za-z_-]{8,}|xox[baprs]-[A-Za-z0-9-]{8,})\b/g;
const jwtPattern = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const envDumpPattern = /\b((?:OPENAI_API_KEY|ANTHROPIC_API_KEY|AICHESTRA_LLM_API_KEY|AICHESTRA_GITHUB_TOKEN|AICHESTRA_GITHUB_WEBHOOK_SECRET|GITHUB_TOKEN|GOOGLE_APPLICATION_CREDENTIALS|SESSION_SECRET|JWT_SECRET|LLM_API_KEY|[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD))\s*=\s*)[^\s"',}]+/gi;
const credentialCachePattern = /(~[\\/]\.codex[\\/]auth\.json|~[\\/]\.claude[^\s"',}]*|(?:Google credential cache)|(?:application_default_credentials\.json)|(?:gcloud[\\/]application_default_credentials)|(?:%USERPROFILE%[\\/]\.codex[\\/]auth\.json))/gi;

function limitBytes(input: string, maxBytes: number): string {
  const buffer = Buffer.from(input);
  if (buffer.byteLength <= maxBytes) return input;
  return `${buffer.subarray(0, maxBytes).toString("utf8")}[truncated]`;
}

export function redactAuditString(input: string, options: AuditSanitizerOptions = {}): string {
  const resolved = { ...defaultOptions, ...options };
  const redacted = input
    .replaceAll(bearerPattern, "$1[redacted]")
    .replaceAll(apiKeyPattern, "[redacted-api-key]")
    .replaceAll(jwtPattern, "[redacted-jwt]")
    .replaceAll(envDumpPattern, "$1[redacted]")
    .replaceAll(credentialCachePattern, "[redacted-credential-cache]");
  return limitBytes(redacted, resolved.maxStringBytes);
}

function sanitizeValue(value: unknown, key = "", options: Required<AuditSanitizerOptions>): unknown {
  if (sensitiveKeyPattern.test(key)) return "[redacted]";
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null || typeof value === "number" || typeof value === "boolean") {
    return value ?? null;
  }
  if (typeof value === "string") return redactAuditString(value, options);
  if (Array.isArray(value)) {
    const items = value.slice(0, options.maxArrayItems).map((item) => sanitizeValue(item, "", options));
    if (value.length > options.maxArrayItems) {
      items.push(`[truncated ${value.length - options.maxArrayItems} item(s)]`);
    }
    return items;
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      output[childKey] = sanitizeValue(childValue, childKey, options);
    }
    return output;
  }
  return String(value);
}

export function sanitizeAuditMetadata(input: unknown, options: AuditSanitizerOptions = {}): Record<string, unknown> {
  const resolved = { ...defaultOptions, ...options };
  const base = input && typeof input === "object" && !Array.isArray(input) ? input : { value: input };
  const sanitized = sanitizeValue(base, "", resolved) as Record<string, unknown>;
  const serialized = JSON.stringify(sanitized);
  const byteLength = Buffer.byteLength(serialized);
  if (byteLength <= resolved.maxMetadataBytes) {
    return sanitized;
  }
  return {
    truncated: true,
    originalBytes: byteLength,
    preview: limitBytes(serialized, resolved.maxMetadataBytes)
  };
}

const unsafeSecretPattern = /sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|Bearer\s+(?!\[redacted\])[A-Za-z0-9._~+/=-]+|(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|AICHESTRA_LLM_API_KEY|AICHESTRA_GITHUB_TOKEN|AICHESTRA_GITHUB_WEBHOOK_SECRET|GITHUB_TOKEN|SESSION_SECRET|JWT_SECRET)\s*=\s*(?!\[redacted\])[^\s"',}]+|auth\.json|~[\\/]\.claude/i;

export function containsUnsafeAuditMaterial(input: unknown): boolean {
  return unsafeSecretPattern.test(JSON.stringify(input));
}
