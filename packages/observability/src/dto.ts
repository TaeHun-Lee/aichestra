import { redactAuditString } from "./sanitizer.ts";
import type {
  AuditEventEnvelope,
  AuditQueryResult,
  AuditRedactionClass,
  AuditRetentionClass,
  AuditRetentionPolicy,
  AuditSourceCoverage,
  AuditSummary,
  MetricDefinition,
  MetricPoint,
  MetricSnapshot,
  ObservabilityConfig,
  ObservabilityDashboardReadModel,
  ObservabilityExportEnvelope,
  ObservabilityExporterConfig,
  ObservabilityExportReadinessSummary,
  ObservabilityExportSafetyCheck,
  TraceSpan
} from "./types.ts";

function toJson(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null || typeof value === "number" || typeof value === "boolean") return value ?? null;
  if (typeof value === "string") return redactAuditString(value);
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      output[key] = toJson(child);
    }
    return output;
  }
  return String(value);
}

export function auditEventEnvelopeToDto(event: AuditEventEnvelope) {
  return toJson(event);
}

export function auditQueryResultToDto(result: AuditQueryResult) {
  return toJson(result);
}

export function auditSummaryToDto(summary: AuditSummary) {
  return toJson(summary);
}

export function auditRetentionClassToDto(retentionClass: AuditRetentionClass) {
  return toJson(retentionClass);
}

export function auditRedactionClassToDto(redactionClass: AuditRedactionClass) {
  return toJson(redactionClass);
}

export function auditRetentionPolicyToDto(policy: AuditRetentionPolicy) {
  return toJson(policy);
}

export function auditSourceCoverageToDto(source: AuditSourceCoverage) {
  return toJson(source);
}

export function metricDefinitionToDto(definition: MetricDefinition) {
  return toJson(definition);
}

export function metricPointToDto(point: MetricPoint) {
  return toJson(point);
}

export function metricSnapshotToDto(snapshot: MetricSnapshot) {
  return toJson(snapshot);
}

export function traceSpanToDto(span: TraceSpan) {
  return toJson(span);
}

export function observabilityConfigToDto(config: ObservabilityConfig) {
  return toJson(config);
}

export function observabilityExporterConfigToDto(config: ObservabilityExporterConfig) {
  return toJson(config);
}

export function observabilityExportEnvelopeToDto(envelope: ObservabilityExportEnvelope) {
  return toJson(envelope);
}

export function observabilityExportSafetyCheckToDto(check: ObservabilityExportSafetyCheck) {
  return toJson(check);
}

export function observabilityExportReadinessSummaryToDto(summary: ObservabilityExportReadinessSummary) {
  return toJson(summary);
}

export function observabilityDashboardReadModelToDto(model: ObservabilityDashboardReadModel) {
  return toJson(model);
}
