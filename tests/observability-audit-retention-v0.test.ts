import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  ObservabilityService,
  containsUnsafeAuditMaterial,
  sanitizeAuditMetadata
} from "@aichestra/observability";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-13T00:00:00.000Z");

function sampleService(): ObservabilityService {
  return new ObservabilityService({
    now: () => fixedNow,
    sourceProvider: () => ({
      authAuditEvents: [
        {
          id: "auth_audit_1",
          eventType: "authorization_denied",
          actorId: "actor_demo",
          principalId: "principal_demo",
          action: "git.merge",
          resourceKind: "git_operation",
          result: "denied",
          reason: "policy denied",
          requestId: "req_demo",
          metadata: { correlationId: "corr_demo", authMode: "mock" },
          createdAt: fixedNow
        }
      ],
      policyAuditEntries: [
        {
          id: "policy_audit_1",
          policyDecisionId: "policy_decision_1",
          action: "llm.remote_completion",
          resourceKind: "llm_provider",
          resourceId: "openai_compatible",
          actorId: "actor_demo",
          allowed: false,
          decision: "deny",
          reason: "remote LLM disabled",
          matchedRuleIds: ["deny_remote_llm_by_default"],
          taskId: "task_demo",
          taskRunId: "run_demo",
          metadata: { requestId: "req_demo", correlationId: "corr_demo" },
          createdAt: fixedNow
        }
      ],
      securityAuditEvents: [
        {
          id: "security_audit_1",
          eventType: "credential_resolution_allowed",
          actorId: "actor_demo",
          principalId: "principal_demo",
          taskId: "task_demo",
          taskRunId: "run_demo",
          targetId: "secretref_llm",
          targetKind: "secret",
          result: "allowed",
          metadata: {
            secretRefId: "secretref_llm",
            providerId: "openai_compatible",
            envDump: "AICHESTRA_LLM_API_KEY=sk-observability-secret"
          },
          createdAt: fixedNow
        },
        {
          id: "security_audit_2",
          eventType: "network_egress_blocked",
          actorId: "actor_demo",
          targetKind: "network",
          result: "blocked",
          reason: "network default deny",
          metadata: { url: "https://example.invalid", token: "ghp_observabilitysecret" },
          createdAt: fixedNow
        }
      ],
      gitAuditEvents: [
        {
          id: "audit_git_1",
          action: "git.branch_create_requested",
          targetType: "git",
          targetId: "repo_demo",
          actorUserId: "actor_demo",
          taskId: "task_demo",
          repoId: "repo_demo",
          metadata: { result: "allowed", requestId: "req_demo", correlationId: "corr_demo" },
          createdAt: fixedNow
        }
      ],
      gitWebhookAuditEvents: [
        {
          id: "git_webhook_audit_1",
          eventType: "github_webhook_payload_rejected",
          deliveryId: "delivery_1",
          repoRef: "aichestra/demo",
          result: "rejected",
          reason: "signature verification failed",
          sanitizedMetadata: {
            payloadHash: "sha256-demo",
            rawPayload: "webhook-secret-value"
          },
          createdAt: fixedNow
        }
      ],
      llmAuditEvents: [
        {
          id: "llm_audit_1",
          eventType: "llm_completion_succeeded",
          taskId: "task_demo",
          taskRunId: "run_demo",
          actorId: "actor_demo",
          providerKind: "mock",
          providerId: "mock",
          modelId: "mock-coder",
          result: "succeeded",
          metadata: { prompt: "raw prompt with sk-observability-secret" },
          createdAt: fixedNow
        }
      ],
      mcpAuditEvents: [
        {
          id: "mcp_audit_1",
          eventType: "mcp_tool_policy_denied",
          serverId: "mock-docs",
          toolId: "docs.search",
          requestId: "req_demo",
          actorId: "actor_demo",
          taskId: "task_demo",
          taskRunId: "run_demo",
          result: "denied",
          reason: "policy denied",
          sanitizedMetadata: { toolInput: "Bearer observability-token" },
          createdAt: fixedNow
        }
      ],
      agentRunAuditEvents: [
        {
          id: "runner_audit_1",
          taskId: "task_demo",
          taskRunId: "run_demo",
          runnerKind: "mock",
          eventType: "agent_run_completed",
          result: "succeeded",
          metadata: { stdoutPreview: "SESSION_SECRET=secret-session" },
          createdAt: fixedNow
        }
      ],
      registryAuditLogs: [
        {
          id: "registry_audit_1",
          actorId: "actor_demo",
          action: "create",
          targetKind: "skill",
          targetId: "skill_demo",
          targetName: "demo",
          targetVersion: "1.0.0",
          after: { note: "JWT_SECRET=secret-jwt" },
          createdAt: fixedNow
        }
      ],
      improvementGovernanceAuditEvents: [
        {
          id: "governance_audit_1",
          action: "proposal_apply_blocked",
          proposalId: "proposal_demo",
          actorId: "actor_demo",
          message: "apply blocked",
          metadata: { reason: "human approval required" },
          createdAt: fixedNow
        }
      ],
      localAgentAuditEvents: [
        {
          id: "local_agent_audit_1",
          eventType: "credential_cache_access_denied",
          actorId: "actor_demo",
          agentId: "agent_demo",
          providerId: "claude-code-local",
          taskId: "task_demo",
          taskRunId: "run_demo",
          result: "blocked",
          metadata: { cachePath: "~/.codex/auth.json", otherPath: "~/.claude/session" },
          createdAt: fixedNow
        }
      ],
      providerAuditEvents: [
        {
          id: "provider_audit_1",
          eventType: "local_agent_required",
          actorId: "actor_demo",
          taskId: "task_demo",
          taskRunId: "run_demo",
          providerId: "claude-code-local",
          providerKind: "local_cli",
          authType: "external_cli_session",
          operation: "provider.invoke",
          result: "blocked",
          metadata: { credentialAccess: "never_read_tokens" },
          createdAt: fixedNow
        }
      ],
      deploymentReadinessChecks: [
        {
          id: "production_observability_required",
          category: "observability",
          name: "Observability stack required",
          status: "fail",
          severity: "high",
          metadata: { productionBlocker: true },
          createdAt: fixedNow
        }
      ],
      deploymentRisks: [
        {
          id: "risk_no_observability_stack",
          category: "observability",
          title: "No production observability backend",
          status: "open",
          severity: "high",
          metadata: { blocksProduction: true },
          createdAt: fixedNow
        }
      ]
    })
  });
}

function hasUnsafeSecret(value: unknown): boolean {
  const text = JSON.stringify(value);
  return text.includes("sk-observability-secret") ||
    text.includes("ghp_observabilitysecret") ||
    text.includes("webhook-secret-value") ||
    text.includes("Bearer observability-token") ||
    text.includes("SESSION_SECRET=secret-session") ||
    text.includes("JWT_SECRET=secret-jwt") ||
    text.includes("auth.json") ||
    text.includes("~/.claude");
}

function getJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

async function withApiServer(run: (port: number) => Promise<void>): Promise<void> {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    await run(address.port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("AuditEventEnvelope normalizes dimensions, retention, redaction, and secret-safe metadata", () => {
  const service = sampleService();
  const result = service.listAuditEvents({ categories: ["policy"], limit: 10 });
  const event = result.events.find((item) => item.eventType === "llm.remote_completion");

  assert.equal(event?.category, "policy");
  assert.equal(event?.outcome, "denied");
  assert.equal(event?.severity, "warning");
  assert.equal(event?.actorId, "actor_demo");
  assert.equal(event?.requestId, "req_demo");
  assert.equal(event?.correlationId, "corr_demo");
  assert.equal(event?.taskId, "task_demo");
  assert.equal(event?.taskRunId, "run_demo");
  assert.equal(event?.retentionClass, "security");
  assert.equal(event?.redactionClass, "sensitive_metadata");
  assert.equal(hasUnsafeSecret(event), false);
});

test("audit source normalization maps major module audit records into the common envelope", () => {
  const service = sampleService();
  const events = service.listAuditEvents({ limit: 100 }).events;
  const categoryFor = (eventType: string) => events.find((event) => event.eventType === eventType)?.category;

  assert.equal(categoryFor("authorization_denied"), "auth");
  assert.equal(categoryFor("llm.remote_completion"), "policy");
  assert.equal(categoryFor("credential_resolution_allowed"), "credential");
  assert.equal(categoryFor("git.branch_create_requested"), "git");
  assert.equal(categoryFor("llm_completion_succeeded"), "llm");
  assert.equal(categoryFor("mcp_tool_policy_denied"), "mcp");
  assert.equal(categoryFor("credential_cache_access_denied"), "local_agent");
  assert.equal(categoryFor("create"), "registry");
  assert.equal(categoryFor("proposal_apply_blocked"), "improvement");
  assert.equal(categoryFor("github_webhook_payload_rejected"), "git_webhook");
  assert.equal(hasUnsafeSecret(events), false);

  const sources = service.listAuditSources();
  assert.equal(sources.some((source) => source.moduleName === "Auth/RBAC" && source.normalized === "yes"), true);
  assert.equal(sources.some((source) => source.moduleName === "Deployment Readiness" && source.normalized === "partial"), true);
});

test("audit sanitizer masks secrets, tokens, env dumps, credential cache paths, and size-limits metadata", () => {
  const original = {
    apiKey: "sk-observability-secret",
    github: "ghp_observabilitysecret",
    webhook: "AICHESTRA_GITHUB_WEBHOOK_SECRET=webhook-secret-value",
    bearer: "Bearer observability-token",
    jwt: "eyJheaderxxxx.eyJpayloadxxxx.signaturxxxx",
    env: "SESSION_SECRET=secret-session JWT_SECRET=secret-jwt",
    cache: "~/.codex/auth.json ~/.claude/session application_default_credentials.json",
    large: "x".repeat(6000)
  };
  const sanitized = sanitizeAuditMetadata(original, { maxStringBytes: 128, maxMetadataBytes: 512 });
  const truncatedMetadata = sanitizeAuditMetadata({ large: "x".repeat(6000), more: "y".repeat(6000) }, {
    maxStringBytes: 6000,
    maxMetadataBytes: 512
  });

  assert.equal(hasUnsafeSecret(sanitized), false);
  assert.equal(containsUnsafeAuditMaterial(sanitized), false);
  assert.equal(original.apiKey, "sk-observability-secret");
  assert.equal(String(sanitized.large).includes("[truncated]"), true);
  assert.equal(truncatedMetadata.truncated, true);
});

test("retention policy model lists classes without enabling deletion jobs", () => {
  const service = sampleService();
  const classes = service.listRetentionClasses();
  const policies = service.listRetentionPolicies();

  assert.equal(classes.find((item) => item.id === "security")?.deleteEligible, false);
  assert.equal((classes.find((item) => item.id === "security")?.defaultTtlDays ?? 0) >= 365, true);
  assert.equal((classes.find((item) => item.id === "operational")?.defaultTtlDays ?? 0) >= 30, true);
  assert.equal((classes.find((item) => item.id === "short_debug")?.defaultTtlDays ?? 0) <= 14, true);
  assert.equal(policies.every((policy) => policy.deletionMode === "none"), true);
  assert.equal(service.getConfig().retentionDeletionJobsEnabled, false);
});

test("metric and trace skeletons return deterministic in-memory values without exporters", () => {
  const service = sampleService();
  const definitions = service.listMetricDefinitions();
  const snapshot = service.getMetricSnapshot();
  const spans = service.listTraceSpans({ taskId: "task_demo", limit: 5 });

  assert.equal(definitions.some((definition) => definition.name === "audit.events.total"), true);
  assert.equal(snapshot.externalExporterEnabled, false);
  assert.equal(snapshot.points.some((point) => point.metricName === "observability.external_exporter.enabled" && point.value === 0), true);
  assert.equal(spans.length > 0, true);
  assert.equal(spans.every((span) => span.metadata.externalExporter === false), true);
  assert.equal(hasUnsafeSecret({ snapshot, spans }), false);
});

test("observability API exposes read-only safe audit, retention, metrics, trace, source, and config endpoints", async () => {
  await withApiServer(async (port) => {
    const events = await getJson(port, "/observability/audit/events?limit=2");
    const summary = await getJson(port, "/observability/audit/summary");
    const retention = await getJson(port, "/observability/audit/retention-classes");
    const redaction = await getJson(port, "/observability/audit/redaction-classes");
    const sources = await getJson(port, "/observability/audit/sources");
    const metrics = await getJson(port, "/observability/metrics");
    const snapshot = await getJson(port, "/observability/metrics/snapshot");
    const traces = await getJson(port, "/observability/traces?limit=3");
    const config = await getJson(port, "/observability/config");

    assert.equal(events.statusCode, 200);
    assert.equal(summary.statusCode, 200);
    assert.equal(retention.statusCode, 200);
    assert.equal(redaction.statusCode, 200);
    assert.equal(sources.statusCode, 200);
    assert.equal(metrics.statusCode, 200);
    assert.equal(snapshot.statusCode, 200);
    assert.equal(traces.statusCode, 200);
    assert.equal(config.statusCode, 200);

    assert.equal(((events.body as { events: unknown[] }).events).length <= 2, true);
    assert.equal((events.body as { total: number }).total >= ((events.body as { events: unknown[] }).events).length, true);
    assert.equal(((summary.body.summary as Record<string, unknown>).noSecretsExposed), true);
    assert.equal(Array.isArray(retention.body.retentionClasses), true);
    assert.equal(Array.isArray(redaction.body.redactionClasses), true);
    assert.equal((sources.body.sources as Array<Record<string, unknown>>).some((source) => source.moduleName === "Deployment Readiness"), true);
    assert.equal((metrics.body.metrics as Array<Record<string, unknown>>).some((metric) => metric.name === "audit.events.total"), true);
    assert.equal(((snapshot.body.snapshot as Record<string, unknown>).externalExporterEnabled), false);
    assert.equal(Array.isArray(traces.body.traceSpans), true);
    assert.equal(((config.body.config as Record<string, unknown>).externalExportEnabled), false);
    assert.equal(hasUnsafeSecret({ events, summary, retention, redaction, sources, metrics, snapshot, traces, config }), false);
  });
});

test("dashboard observability panel renders normalized audit and no-secret status", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/observability");
    const observability = dashboard.body.observability as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((observability.config as Record<string, unknown>).externalBackendEnabled, false);
    assert.equal((observability.noSecretStatus as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((observability.exportReadinessSummary as Record<string, unknown>).exporterEnabled, false);
    assert.equal((observability.exportReadinessSummary as Record<string, unknown>).externalCallsEnabled, false);
    assert.equal((observability.exportReadinessSummary as Record<string, unknown>).rawPayloadExportAllowed, false);
    assert.equal((observability.exportReadinessSummary as Record<string, unknown>).secretExportAllowed, false);
    assert.equal(Array.isArray(observability.sourceCoverage), true);
    assert.equal(Array.isArray(observability.retentionClasses), true);
    assert.equal(Array.isArray(observability.exportSafetyChecks), true);
    assert.equal(hasUnsafeSecret(dashboard), false);
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Observability"), true);
  assert.equal(html.includes("External Observability Export"), true);
  assert.equal(html.includes("external exporter disabled"), true);
  assert.equal(html.includes("sk-observability-secret"), false);
  assert.equal(html.includes("auth.json"), false);
});
