import type { DeploymentProfile, DeploymentReadinessSummary, ProductionRisk, ReadinessCheck } from "./types.ts";

const sensitiveKeyPattern = /token|secret|password|authorization|credential|apiKey|api_key|session|cookie/i;
const secretLikePattern = /(Bearer\s+)[A-Za-z0-9._~+/=-]+|sk-[A-Za-z0-9_-]{6,}|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|((?:OPENAI_API_KEY|ANTHROPIC_API_KEY|AICHESTRA_LLM_API_KEY|LLM_API_KEY|GITHUB_TOKEN|AICHESTRA_GITHUB_TOKEN|AICHESTRA_GITHUB_WEBHOOK_SECRET|[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD))=)[^\s"']+/g;

function sanitize(value: unknown, key = ""): unknown {
  if (sensitiveKeyPattern.test(key)) return "[redacted]";
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null || typeof value === "number" || typeof value === "boolean") return value ?? null;
  if (typeof value === "string") {
    return value.replaceAll(secretLikePattern, (match, bearerPrefix, envPrefix) => {
      if (bearerPrefix) return `${bearerPrefix}[redacted]`;
      if (envPrefix) return `${envPrefix}[redacted]`;
      return "[redacted]";
    });
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      output[childKey] = sanitize(childValue, childKey);
    }
    return output;
  }
  return String(value);
}

export function deploymentProfileToDto(profile: DeploymentProfile) {
  return sanitize(profile);
}

export function readinessCheckToDto(check: ReadinessCheck) {
  return sanitize(check);
}

export function productionRiskToDto(risk: ProductionRisk) {
  return sanitize(risk);
}

export function deploymentReadinessSummaryToDto(summary: DeploymentReadinessSummary) {
  return sanitize(summary);
}
