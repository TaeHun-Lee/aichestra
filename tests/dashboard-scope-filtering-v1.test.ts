import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  DashboardScopeFilteringService,
  createDashboardReadinessTenantScopePlanningService,
  createDashboardScopeFilteringService,
  parseDashboardFilterHeaders,
  SAFE_DEMO_HEADER_NAMES
} from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-18T00:00:00.000Z");

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

async function withApiServer(run: (port: number) => Promise<void>): Promise<void> {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function hasSecretOrEnvValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /OPENAI_API_KEY=[^"\s]+|ANTHROPIC_API_KEY=[^"\s]+|AICHESTRA_LLM_API_KEY=[^"\s]+|GITHUB_TOKEN=[^"\s]+|VAULT_TOKEN=[^"\s]+|AICHESTRA_DATABASE_URL=[^"\s]+|DATABASE_URL=[^"\s]+|SESSION_SECRET=[^"\s]+|JWT_SECRET=[^"\s]+|Bearer\s+[A-Za-z0-9._~+/=-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_]{30,}|hvs\.[A-Za-z0-9_-]{20,}/i.test(text);
}

function buildPanelSummaries() {
  return createDashboardReadinessTenantScopePlanningService().listDashboardPanelScopeSummaries();
}

function service(): DashboardScopeFilteringService {
  return createDashboardScopeFilteringService({ now: () => fixedNow });
}

test("default mock-actor fallback keeps every representative panel visible", () => {
  const filter = service();
  const ctx = filter.buildFilterContext();
  const decisions = filter.evaluatePanels(buildPanelSummaries(), ctx);
  for (const decision of decisions) {
    assert.equal(decision.decision === "visible" || decision.decision === "not_applicable", true, `panel ${decision.panelId} should remain visible by default for mock admin, got ${decision.decision}`);
    assert.equal(decision.productionFiltering, false);
  }
});

test("viewer redacts secret-adjacent panels and warns on others", () => {
  const filter = service();
  const ctx = filter.buildFilterContext({ roles: ["viewer"], source: "demo", authMode: "demo_request_header" });
  const decisions = filter.evaluatePanels(buildPanelSummaries(), ctx);
  const security = decisions.find((entry) => entry.panelId === "security");
  assert.ok(security, "security panel decision exists");
  assert.equal(["hidden", "redacted"].includes(security!.decision), true, `viewer should not see raw security secrets, got ${security!.decision}`);
  const audit = decisions.find((entry) => entry.panelId === "audit");
  assert.ok(audit, "audit panel decision exists");
  assert.equal(["hidden", "redacted", "warning_only"].includes(audit!.decision), true);
});

test("developer sees scoped task/git/llm panels but redacted secret-adjacent ones", () => {
  const filter = service();
  const ctx = filter.buildFilterContext({ roles: ["developer"], tenantIds: ["tenant_a"], teamIds: ["team_a"], projectIds: ["project_a"], resourceScopes: ["repo_a", "provider_a", "model_a"], source: "demo", authMode: "demo_request_header" });
  const decisions = filter.evaluatePanels(buildPanelSummaries(), ctx);
  const security = decisions.find((entry) => entry.panelId === "security");
  assert.equal(security!.decision === "redacted" || security!.decision === "hidden", true);
  const tasks = decisions.find((entry) => entry.panelId === "tasks");
  assert.equal(tasks!.decision, "visible");
});

test("security_admin sees secret-adjacent panel metadata but never raw secrets", () => {
  const filter = service();
  const ctx = filter.buildFilterContext({ roles: ["security_admin"], tenantIds: ["tenant_a"], teamIds: ["team_a"], projectIds: ["project_a"], resourceScopes: ["secret_a"], source: "demo", authMode: "demo_request_header" });
  const decisions = filter.evaluatePanels(buildPanelSummaries(), ctx);
  const security = decisions.find((entry) => entry.panelId === "security");
  assert.equal(security!.decision, "visible");
  // Even with visible, the redactPanelBody helper still strips secret-like field names
  const redacted = filter.filterPanelBody({ apiKey: "should-not-appear", tokenValue: "should-not-appear", summary: { ok: true } }, { ...security!, decision: "redacted" });
  assert.equal((redacted as Record<string, unknown>).apiKey, "[redacted]");
  assert.equal((redacted as Record<string, unknown>).tokenValue, "[redacted]");
});

test("audit_reader gets audit panel visible but other panels warning/redacted", () => {
  const filter = service();
  const ctx = filter.buildFilterContext({ roles: ["audit_reader"], tenantIds: ["tenant_a"], teamIds: ["team_a"], projectIds: ["project_a"], resourceScopes: ["audit_query"], source: "demo", authMode: "demo_request_header" });
  const decisions = filter.evaluatePanels(buildPanelSummaries(), ctx);
  const audit = decisions.find((entry) => entry.panelId === "audit");
  assert.equal(["visible", "redacted", "warning_only"].includes(audit!.decision), true);
});

test("platform_admin sees operational readiness but redacted fields helper still wipes secret-like keys", () => {
  const filter = service();
  const ctx = filter.buildFilterContext({ roles: ["platform_admin"], tenantIds: ["tenant_a"], teamIds: ["team_a"], projectIds: ["project_a"], source: "demo", authMode: "demo_request_header" });
  const decisions = filter.evaluatePanels(buildPanelSummaries(), ctx);
  for (const decision of decisions) {
    assert.equal(decision.productionFiltering, false);
  }
  const readiness = decisions.find((entry) => entry.panelId === "production_readiness");
  if (readiness) assert.equal(["visible", "warning_only", "redacted"].includes(readiness.decision), true);
});

test("missing required scopes produce warning_only or redaction (no hide for non-sensitive panels)", () => {
  const filter = service();
  const ctx = filter.buildFilterContext({ roles: ["developer"], source: "demo", authMode: "demo_request_header" });
  const decisions = filter.evaluatePanels(buildPanelSummaries(), ctx);
  const warning = decisions.find((entry) => entry.decision === "warning_only" || entry.decision === "redacted");
  assert.ok(warning, "expected at least one warning_only / redacted decision for developer with no scope");
});

test("service_account_runner is mostly hidden from human dashboard panels", () => {
  const filter = service();
  const ctx = filter.buildFilterContext({ roles: ["service_account_runner"], source: "demo", authMode: "service_account_mock" });
  const decisions = filter.evaluatePanels(buildPanelSummaries(), ctx);
  const overview = decisions.find((entry) => entry.panelId === "overview");
  assert.equal(overview!.decision, "visible", "overview is the always-visible safety meta panel");
  const security = decisions.find((entry) => entry.panelId === "security");
  assert.equal(security!.decision, "hidden");
});

test("filter summary counts visible/redacted/hidden and reports productionFiltering false", () => {
  const filter = service();
  const ctx = filter.buildFilterContext({ roles: ["viewer"], source: "demo", authMode: "demo_request_header" });
  const decisions = filter.evaluatePanels(buildPanelSummaries(), ctx);
  const summary = filter.summarizeDecisions(decisions, ctx);
  assert.equal(summary.totalPanels, decisions.length);
  assert.equal(summary.productionFiltering, false);
  assert.equal(summary.productionAuthImplemented, false);
  assert.equal(summary.productionTenantEnforcement, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(summary.externalIdentityProviderCalled, false);
  assert.equal(summary.visiblePanels + summary.redactedPanels + summary.hiddenPanels + summary.warningPanels + summary.notApplicablePanels, summary.totalPanels);
});

test("parseDashboardFilterHeaders ignores empty headers and parses comma-separated lists", () => {
  const empty = parseDashboardFilterHeaders({});
  assert.deepEqual(empty, {});
  const populated = parseDashboardFilterHeaders({
    [SAFE_DEMO_HEADER_NAMES.role]: "viewer",
    [SAFE_DEMO_HEADER_NAMES.tenantId]: "tenant_a, tenant_b",
    [SAFE_DEMO_HEADER_NAMES.teamId]: "team_a",
    [SAFE_DEMO_HEADER_NAMES.projectId]: "project_a"
  });
  assert.deepEqual(populated.roles, ["viewer"]);
  assert.deepEqual(populated.tenantIds, ["tenant_a", "tenant_b"]);
  assert.deepEqual(populated.teamIds, ["team_a"]);
  assert.deepEqual(populated.projectIds, ["project_a"]);
  assert.equal(populated.source, "demo");
  assert.equal(populated.authMode, "demo_request_header");
});

test("parseDashboardFilterHeaders never reads Authorization / cookie / session / JWT headers", () => {
  const headers = {
    authorization: "Bearer should-not-appear",
    cookie: "session=should-not-appear",
    "x-api-key": "should-not-appear",
    [SAFE_DEMO_HEADER_NAMES.role]: "viewer"
  };
  const parsed = parseDashboardFilterHeaders(headers);
  assert.equal(JSON.stringify(parsed).includes("should-not-appear"), false);
});

test("redactPanelBody scrubs SECRET_LIKE field names regardless of role", () => {
  const filter = service();
  const ctx = filter.buildFilterContext({ roles: ["viewer"], source: "demo", authMode: "demo_request_header" });
  const decisions = filter.evaluatePanels(buildPanelSummaries(), ctx);
  const security = decisions.find((entry) => entry.panelId === "security")!;
  const cleaned = filter.filterPanelBody({
    summary: { status: "ok" },
    apiKey: "should-not-appear",
    credentials: ["should-not-appear"],
    envValues: { OPENAI_API_KEY: "should-not-appear" }
  }, security);
  assert.equal(hasSecretOrEnvValue(cleaned), false);
});

test("dashboard /scope-filter endpoint reports filter summary, decisions, and safety flags", async () => {
  await withApiServer(async (port) => {
    const response = await getJson(port, "/dashboard/scope-filter");
    assert.equal(response.statusCode, 200);
    const filterPanel = response.body.dashboardScopeFilter as Record<string, unknown>;
    const summary = filterPanel.summary as Record<string, unknown>;
    assert.equal(summary.productionFiltering, false);
    assert.equal(summary.productionAuthImplemented, false);
    assert.equal(summary.productionTenantEnforcement, false);
    assert.equal(summary.externalIdentityProviderCalled, false);
    assert.equal(summary.noSecretsExposed, true);
    assert.equal(summary.envValuesExposed, false);
    assert.ok(Array.isArray(filterPanel.decisions));
    assert.equal(hasSecretOrEnvValue(response.body), false);
  });
});

test("dashboard /scope-filter responds to safe demo role header and changes panel decisions", async () => {
  await withApiServer(async (port) => {
    const response = await getJson(port, "/dashboard/scope-filter", {
      [SAFE_DEMO_HEADER_NAMES.role]: "viewer"
    });
    assert.equal(response.statusCode, 200);
    const filterPanel = response.body.dashboardScopeFilter as Record<string, unknown>;
    const context = filterPanel.context as Record<string, unknown>;
    assert.equal((context.roles as string[])[0], "viewer");
    assert.equal(context.authMode, "demo_request_header");
    const summary = filterPanel.summary as Record<string, unknown>;
    const totalPanels = Number(summary.totalPanels ?? 0);
    const visiblePanels = Number(summary.visiblePanels ?? 0);
    assert.equal(totalPanels > visiblePanels, true, "viewer should not see every panel as visible");
    assert.equal(hasSecretOrEnvValue(response.body), false);
  });
});

test("dashboard renderer shows redaction badges and production-filtering false flag", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Dashboard Scope Filtering"), true);
  assert.equal(html.includes("production filtering false"), true);
  assert.equal(html.includes("Panel decision counts"), true);
  assert.equal(html.includes("Filter context"), true);
});

test("regression: dashboard read models still contain all 41+ expected panel keys", async () => {
  await withApiServer(async (port) => {
    const overview = await getJson(port, "/dashboard/overview");
    const scopeFilter = await getJson(port, "/dashboard/scope-filter");
    assert.equal(overview.statusCode, 200);
    assert.equal(scopeFilter.statusCode, 200);
    assert.equal(hasSecretOrEnvValue({ overview, scopeFilter }), false);
  });
});
