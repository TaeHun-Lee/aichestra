import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createAuditQueryScopeEnforcementService } from "@aichestra/observability";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardReadModels } from "../apps/web/src/render.ts";

function hasUnsafeAuditMaterial(value: unknown): boolean {
  return /raw_payload_secret|raw-secret|Authorization:\s*Bearer|Bearer\s+(?!\[redacted\])|SESSION_SECRET=|JWT_SECRET=|OPENAI_API_KEY=|ANTHROPIC_API_KEY=|GITHUB_TOKEN=|VAULT_TOKEN=|DATABASE_URL=|sk-[A-Za-z0-9_-]+|ghp_[A-Za-z0-9_]+|auth\.json|~\/\.codex|~\/\.claude/i.test(JSON.stringify(value));
}

function getJson(port: number, path: string, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path, headers }, (response) => {
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

function postJson(port: number, path: string, body: Record<string, unknown>, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(payload)),
        ...headers
      }
    }, (response) => {
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
    request.end(payload);
  });
}

async function withApiServer(run: (port: number) => Promise<void>): Promise<void> {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("Audit Query Scope Enforcement v1 limits viewer access to summary", () => {
  const service = createAuditQueryScopeEnforcementService();
  const summary = service.evaluateAuditQuery({ roles: ["viewer"], requestedDetailLevel: "summary" });
  const detail = service.evaluateAuditQuery({ roles: ["viewer"], requestedDetailLevel: "detail" });

  assert.equal(summary.decision, "allow_summary");
  assert.equal(summary.allowedDetailLevel, "summary");
  assert.equal(detail.decision, "deny_detail");
  assert.equal(detail.allowedDetailLevel, "summary");
  assert.equal(service.summarizeAuditQueryDecision(detail).rawPayloadAllowed, false);
  assert.equal(hasUnsafeAuditMaterial({ summary, detail }), false);
});

test("Audit Query Scope Enforcement v1 requires developer project, repo, or provider scope for metadata", () => {
  const service = createAuditQueryScopeEnforcementService();
  const missing = service.evaluateAuditQuery({ roles: ["developer"], requestedDetailLevel: "metadata" });
  const scoped = service.evaluateAuditQuery({
    roles: ["developer"],
    requestedDetailLevel: "metadata",
    projectIds: ["project_demo"],
    repoIds: ["repo_demo_backend"]
  });

  assert.equal(missing.decision, "warning_missing_scope");
  assert.equal(missing.missingScopes.includes("project_or_repo_or_provider"), true);
  assert.equal(scoped.decision, "allow_metadata");
  assert.equal(scoped.allowedDetailLevel, "metadata");
});

test("Audit Query Scope Enforcement v1 lets security admins see redacted detail but never raw payload", () => {
  const service = createAuditQueryScopeEnforcementService();
  const decision = service.evaluateAuditQuery({ roles: ["security_admin"], requestedDetailLevel: "detail" });
  const result = service.redactAuditResult({
    events: [{
      id: "audit_raw_payload_fixture",
      eventType: "provider_call",
      rawPayload: "raw_payload_secret",
      Authorization: "Bearer raw-secret",
      sanitizedMetadata: { nestedToken: "sk-audit-scope-secret", safe: "ok" }
    }],
    total: 1,
    truncated: false,
    querySummary: {}
  }, decision);

  assert.equal(decision.decision, "redact_detail");
  assert.equal(decision.allowedDetailLevel, "detail");
  assert.equal(hasUnsafeAuditMaterial(result), false);
  assert.equal(JSON.stringify(result).includes("[redacted]"), true);
});

test("Audit Query Scope Enforcement v1 requires audit query scope for audit_reader metadata/detail", () => {
  const service = createAuditQueryScopeEnforcementService();
  const missing = service.evaluateAuditQuery({ roles: ["audit_reader"], requestedDetailLevel: "detail" });
  const scoped = service.evaluateAuditQuery({
    roles: ["audit_reader"],
    requestedDetailLevel: "metadata",
    tenantIds: ["tenant_demo"],
    resourceKinds: ["policy"],
    auditSources: ["policy"]
  });

  assert.equal(missing.decision, "deny_detail");
  assert.equal(missing.missingScopes.includes("audit_query"), true);
  assert.equal(scoped.decision, "allow_metadata");
  assert.equal(scoped.matchedScopes.includes("audit_query"), true);
});

test("Audit Query Scope Enforcement v1 forbids raw payload query level", () => {
  const service = createAuditQueryScopeEnforcementService();
  const decision = service.evaluateAuditQuery({ roles: ["security_admin"], requestedDetailLevel: "raw_payload_forbidden" });
  const result = service.redactAuditResult({ events: [{ rawPayload: "raw_payload_secret" }], total: 1 }, decision);

  assert.equal(decision.decision, "deny_query");
  assert.equal(decision.allowedDetailLevel, "none");
  assert.equal((result as Record<string, unknown>).total, 0);
  assert.equal(hasUnsafeAuditMaterial({ decision, result }), false);
});

test("Audit Query Scope Enforcement v1 API endpoints are check-only and safe", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/audit-scope/summary");
    const plans = await getJson(port, "/readiness/audit-scope/redaction-plans");
    const check = await postJson(port, "/observability/audit/query-scope/check", {
      roles: ["audit_reader"],
      requestedDetailLevel: "detail"
    });
    const viewerEvents = await getJson(port, "/observability/audit/events?detailLevel=detail", {
      "x-aichestra-actor-id": "user_demo_viewer"
    });

    assert.equal(summary.statusCode, 200);
    assert.equal(((summary.body.summary as Record<string, unknown>).status), "v1_implemented_partial");
    assert.equal(((summary.body.noSecretStatus as Record<string, unknown>).rawPayloadAllowed), false);
    assert.equal(plans.statusCode, 200);
    assert.equal(Array.isArray(plans.body.redactionPlans), true);
    assert.equal(check.statusCode, 200);
    assert.equal(((check.body.summary as Record<string, unknown>).allowedDetailLevel), "summary");
    assert.equal(viewerEvents.statusCode, 200);
    assert.equal(((viewerEvents.body.scopeDecisionSummary as Record<string, unknown>).decision), "deny_detail");
    assert.equal(hasUnsafeAuditMaterial({ summary, plans, check, viewerEvents }), false);
  });
});

test("Audit Query Scope Enforcement v1 dashboard observability panel shows scope and redaction status", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/observability");
    const observability = dashboard.body.observability as Record<string, unknown>;
    const auditScopeStatus = observability.auditScopeStatus as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal(((observability.auditScopeSummary as Record<string, unknown>).status), "v1_implemented_partial");
    assert.equal(auditScopeStatus.rawPayloadForbidden, true);
    assert.equal(auditScopeStatus.productionStorageEnforcement, false);
    assert.equal(hasUnsafeAuditMaterial(dashboard), false);
  });

  const models = await new DemoDashboardDataProvider().getReadModels();
  const html = renderDashboardReadModels(models);
  assert.equal(html.includes("Audit query scope"), true);
  assert.equal(html.includes("raw payload forbidden true"), true);
  assert.equal(html.includes("production storage enforcement false"), true);
  assert.equal(hasUnsafeAuditMaterial({ models, html }), false);
});

test("Audit Query Scope Enforcement v1 docs record partial status and production gaps", async () => {
  const files = await Promise.all([
    readFile("docs/features/audit-query-scope-enforcement/v1-plan.md", "utf8"),
    readFile("docs/foundations/observability-audit-retention/v0.md", "utf8"),
    readFile("docs/foundations/auth-rbac/tenant-scope-enforcement-v1.md", "utf8")
  ]);
  const combined = files.join("\n");

  assert.equal(combined.includes("Audit Query Scope Enforcement"), true);
  assert.equal(combined.includes("AuditQueryScopeDecision"), true);
  assert.equal(combined.includes("raw payload"), true);
  assert.equal(combined.includes("production audit query filtering") || combined.includes("production audit query security"), true);
});
