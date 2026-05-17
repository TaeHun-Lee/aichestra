import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDashboardReadinessTenantScopePlanningService } from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardReadModels } from "../apps/web/src/render.ts";

function hasSecretOrEnvValue(value: unknown): boolean {
  return /sk-[A-Za-z0-9_-]+|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._~+/=-]+|OPENAI_API_KEY=|ANTHROPIC_API_KEY=|GITHUB_TOKEN=|GITHUB_APP_PRIVATE_KEY=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|AICHESTRA_LLM_API_KEY=|LLM_API_KEY=|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|VAULT_TOKEN=|AICHESTRA_VAULT_TOKEN=|SESSION_SECRET=|JWT_SECRET=|PASSWORD=|SAML_ASSERTION=|OIDC_ID_TOKEN=|SCIM_TOKEN=|auth\.json|~\/\.codex|~\/\.claude|postgres:\/\//i.test(JSON.stringify(value));
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

function requestJson(port: number, method: string, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        "content-type": "application/json",
        "content-length": "2"
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
    request.end("{}");
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

function objectArray(value: unknown): Record<string, unknown>[] {
  assert.equal(Array.isArray(value), true);
  return value as Record<string, unknown>[];
}

test("Dashboard/Readiness Tenant Scope Planning v1 service exposes deterministic read-only models", () => {
  const service = createDashboardReadinessTenantScopePlanningService();
  const dashboardPlans = service.listDashboardPlans();
  const readinessPlans = service.listReadinessPlans();
  const roleVisibility = service.getRoleVisibilityMatrix();
  const fallbackBehavior = service.getFallbackBehavior();
  const summary = service.getSummary();

  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.tenantFilteringImplemented, false);
  assert.equal(summary.productionTenantEnforcement, false);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(summary.dashboardPanelCount, dashboardPlans.length);
  assert.equal(summary.readinessEndpointCount, readinessPlans.length);
  assert.equal(dashboardPlans.some((plan) => plan.panelName === "Dashboard Overview"), true);
  assert.equal(dashboardPlans.some((plan) => plan.panelName === "SecretRef / Security" && plan.redactionClass === "secret_adjacent"), true);
  assert.equal(dashboardPlans.some((plan) => plan.panelName === "Dashboard Tenant Scope Planning"), true);
  assert.equal(readinessPlans.some((plan) => plan.endpointPattern === "/readiness/deployment/*"), true);
  assert.equal(readinessPlans.some((plan) => plan.endpointPattern === "/readiness/tenant-scope/*"), true);
  assert.equal(roleVisibility.some((entry) => entry.role === "viewer" && entry.hiddenPanels.includes("security")), true);
  assert.equal(roleVisibility.some((entry) => entry.role === "service_account_runner" && entry.visiblePanels.length === 0), true);
  assert.equal(fallbackBehavior.some((entry) => entry.missingScope === "tenant"), true);
  assert.equal(fallbackBehavior.some((entry) => entry.missingScope === "secret"), true);
  assert.equal(fallbackBehavior.some((entry) => entry.missingScope === "audit_query"), true);
  assert.equal(hasSecretOrEnvValue({ dashboardPlans, readinessPlans, roleVisibility, fallbackBehavior, summary }), false);
});

test("Dashboard/Readiness Tenant Scope Planning v1 API endpoints are read-only and safe", async () => {
  await withApiServer(async (port) => {
    const dashboardPlans = await getJson(port, "/readiness/tenant-scope/dashboard-plans");
    const readinessPlans = await getJson(port, "/readiness/tenant-scope/readiness-plans");
    const roleVisibility = await getJson(port, "/readiness/tenant-scope/role-visibility");
    const fallbackBehavior = await getJson(port, "/readiness/tenant-scope/fallback-behavior");
    const summary = await getJson(port, "/readiness/tenant-scope/summary");
    const dashboard = await getJson(port, "/dashboard/tenant-scope");
    const health = await getJson(port, "/health");
    const writeAttempt = await requestJson(port, "POST", "/readiness/tenant-scope/summary");

    assert.equal(dashboardPlans.statusCode, 200);
    assert.equal(objectArray(dashboardPlans.body.dashboardPlans).length > 0, true);
    assert.equal(readinessPlans.statusCode, 200);
    assert.equal(objectArray(readinessPlans.body.readinessPlans).some((plan) => plan.endpointPattern === "/readiness/scopes/*"), true);
    assert.equal(roleVisibility.statusCode, 200);
    assert.equal(objectArray(roleVisibility.body.roleVisibility).some((entry) => entry.role === "security_admin"), true);
    assert.equal(fallbackBehavior.statusCode, 200);
    assert.equal(objectArray(fallbackBehavior.body.fallbackBehavior).some((entry) => entry.missingScope === "local_agent_host"), true);
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).status, "v1_implemented");
    assert.equal((summary.body.summary as Record<string, unknown>).tenantFilteringImplemented, false);
    assert.equal((summary.body.summary as Record<string, unknown>).productionTenantEnforcement, false);
    assert.equal((summary.body.summary as Record<string, unknown>).productionReady, false);
    assert.equal(dashboard.statusCode, 200);
    assert.equal(((dashboard.body.tenantScopePlanning as Record<string, unknown>).summary as Record<string, unknown>).status, "v1_implemented");
    assert.equal(((health.body.dashboardTenantScopePlanning as Record<string, unknown>).tenantFilteringImplemented), false);
    assert.equal(((health.body.dashboardTenantScopePlanning as Record<string, unknown>).productionTenantEnforcement), false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(writeAttempt.body.error, "method_not_allowed");
    assert.equal(hasSecretOrEnvValue({ dashboardPlans, readinessPlans, roleVisibility, fallbackBehavior, summary, dashboard, health }), false);
  });
});

test("Dashboard/Readiness Tenant Scope Planning v1 dashboard panel renders planning-only status", async () => {
  const models = await new DemoDashboardDataProvider().getReadModels();
  const html = renderDashboardReadModels(models);
  const summary = models.tenantScopePlanning.summary as Record<string, unknown>;

  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.tenantFilteringImplemented, false);
  assert.equal(summary.productionTenantEnforcement, false);
  assert.equal(summary.productionReady, false);
  assert.equal(Number(summary.secretAdjacentSurfaces) > 0, true);
  assert.equal(Number(summary.auditScopedSurfaces) > 0, true);
  assert.equal(html.includes("Dashboard Tenant Scope Planning"), true);
  assert.equal(html.includes("tenant filtering implemented false"), true);
  assert.equal(html.includes("production enforcement disabled"), true);
  assert.equal(html.includes("secret-adjacent surfaces"), true);
  assert.equal(hasSecretOrEnvValue({ models, html }), false);
});

test("Dashboard/Readiness Tenant Scope Planning v1 documentation inventories and matrices exist", async () => {
  const files = await Promise.all([
    readFile("docs/roadmaps/dashboard-readiness-tenant-scope/v1-plan.md", "utf8"),
    readFile("docs/roadmaps/dashboard-readiness-tenant-scope/v1.md", "utf8"),
    readFile("docs/reference/dashboard-tenant-scope-inventory.md", "utf8"),
    readFile("docs/reference/readiness-tenant-scope-inventory.md", "utf8"),
    readFile("docs/reference/dashboard-role-visibility-matrix.md", "utf8"),
    readFile("docs/reference/readiness-role-visibility-matrix.md", "utf8"),
    readFile("docs/roadmaps/dashboard-readiness-tenant-scope/scope-fallback-behavior-v1.md", "utf8"),
    readFile("docs/roadmaps/dashboard-readiness-tenant-scope/future-filtering-architecture-v1.md", "utf8")
  ]);
  const combined = files.join("\n");

  assert.equal(combined.includes("Dashboard Overview"), true);
  assert.equal(combined.includes("SecretRef / Security"), true);
  assert.equal(combined.includes("Policy Bundle / OPA-Cedar Planning"), true);
  assert.equal(combined.includes("/readiness/deployment/*"), true);
  assert.equal(combined.includes("/readiness/tenant-scope/*"), true);
  assert.equal(combined.includes("viewer"), true);
  assert.equal(combined.includes("security_admin"), true);
  assert.equal(combined.includes("service_account_runner"), true);
  assert.equal(combined.includes("tenantFilteringImplemented: false"), true);
  assert.equal(combined.includes("productionTenantEnforcement: false"), true);
  assert.equal(combined.includes("production tenant enforcement"), true);
});
