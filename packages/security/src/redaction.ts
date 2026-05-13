import type { RedactionPolicy, RedactionResult } from "./types.ts";

export function redactWithPolicy(input: string, policy: RedactionPolicy): RedactionResult {
  const redactedText = applySecurityRedaction(input, policy);
  const preview = limitBytes(redactedText, policy.maxPreviewBytes);
  return {
    policyId: policy.id,
    redactedText,
    preview,
    redactionApplied: redactedText !== input,
    truncated: Buffer.byteLength(redactedText) > Buffer.byteLength(preview),
    originalBytes: Buffer.byteLength(input),
    previewBytes: Buffer.byteLength(preview)
  };
}

export function applySecurityRedaction(input: string, policy: Pick<RedactionPolicy, "maskBearerTokens" | "maskApiKeys" | "maskCredentialPaths" | "maskEnvDumps" | "maskProviderTokens">): string {
  let output = input;
  if (policy.maskBearerTokens) {
    output = output.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
  }
  if (policy.maskApiKeys || policy.maskProviderTokens) {
    output = output
      .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, "[redacted-api-key]")
      .replace(/\b(ghp_[A-Za-z0-9_]{8,})\b/g, "[redacted-api-key]")
      .replace(/\b(github_pat_[A-Za-z0-9_]{8,})\b/g, "[redacted-api-key]")
      .replace(/\b(AIza[0-9A-Za-z_-]{8,})\b/g, "[redacted-api-key]");
  }
  if (policy.maskEnvDumps) {
    output = output
      .replace(/\b((?:OPENAI|ANTHROPIC|AICHESTRA_LLM|AICHESTRA_GITHUB|LLM|GITHUB|GOOGLE_APPLICATION)_API_KEY)\s*=\s*[^\s]+/gi, "$1=[redacted]")
      .replace(/\b((?:OPENAI|ANTHROPIC|AICHESTRA_LLM|AICHESTRA_GITHUB|LLM|GITHUB|GOOGLE_APPLICATION)_TOKEN)\s*=\s*[^\s]+/gi, "$1=[redacted]")
      .replace(/\b(AICHESTRA_GITHUB_TOKEN)\s*=\s*[^\s]+/gi, "$1=[redacted]")
      .replace(/\b(AICHESTRA_GITHUB_WEBHOOK_SECRET)\s*=\s*[^\s]+/gi, "$1=[redacted]")
      .replace(/\b([A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD))\s*=\s*[^\s]+/gi, "$1=[redacted]")
      .replace(/GOOGLE_APPLICATION_CREDENTIALS\s*=\s*[^\s]+/gi, "GOOGLE_APPLICATION_CREDENTIALS=[redacted]");
  }
  if (policy.maskCredentialPaths) {
    output = output
      .replace(/~[\\/]\.codex[\\/]auth\.json/gi, "[redacted-credential-cache]")
      .replace(/~[\\/]\.claude[^\s]*/gi, "[redacted-credential-cache]")
      .replace(/application_default_credentials\.json/gi, "[redacted-credential-cache]")
      .replace(/gcloud[\\/]application_default_credentials/gi, "[redacted-credential-cache]");
  }
  return output;
}

const defaultRedactionPolicy = {
  maskBearerTokens: true,
  maskApiKeys: true,
  maskCredentialPaths: true,
  maskEnvDumps: true,
  maskProviderTokens: true
} satisfies Pick<RedactionPolicy, "maskBearerTokens" | "maskApiKeys" | "maskCredentialPaths" | "maskEnvDumps" | "maskProviderTokens">;

const sensitiveMetadataKeyPattern = /token|secret|key|credential|authorization|password|prompt/i;

export function sanitizeSecurityMetadata<T = unknown>(input: T): T {
  return sanitizeSecurityValue(input) as T;
}

function sanitizeSecurityValue(value: unknown, key = ""): unknown {
  if (sensitiveMetadataKeyPattern.test(key)) return "[redacted]";
  if (value === undefined || value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return applySecurityRedaction(value, defaultRedactionPolicy);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => sanitizeSecurityValue(item));
  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      sanitized[childKey] = sanitizeSecurityValue(childValue, childKey);
    }
    return sanitized;
  }
  return String(value);
}

export function limitBytes(input: string, maxBytes: number): string {
  const buffer = Buffer.from(input);
  if (buffer.byteLength <= maxBytes) return input;
  return buffer.subarray(0, maxBytes).toString("utf8");
}
