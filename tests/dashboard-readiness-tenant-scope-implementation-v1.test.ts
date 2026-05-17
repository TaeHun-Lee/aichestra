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
  return /sk-[A-Za-z0-9_-]+|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._~+/=-]+|OPENAI_API_KEY=|ANTHROPIC_API_KEY=|GITHUB_TOKEN=|GITHUB_APP_PRIVATE_KEY=|AICHESTRA_GITHUB_WEBHOOK_SECRET=|AICHESTRA_LLM_API_KEY=|LLM_API_KEY=|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|VAULT_ADDR=|VAULT_TOKEN=|AICHESTRA_VAULT_TOKEN=|SESSION_SECRET=|JWT_SECRET=|PASSWORD=|SAML_ASSERTION=|OIDC_ID_TOKEN=|SCIM_TOKEN=|auth\.json|~\/\.codex|~\/\.claude|postgres:\/\//i.test(JSON.stringify(value));
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
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function objectArray(value: unknown): Record<string, unknown>[] {
  assert.equal(Array.isArray(value), true);
  return value as Record<string, unknown>[];
}

test("Dashboard/Readiness Tenant Scope Implementation v1 service derives scope metadata and warnings", () => {
  const service = createDashboardReadinessTenantScopePlanningService();
  const dashboardSummaries = service.listDashboardPanelScopeSummaries();
  const readinessSummaries = service.listReadinessEndpointScopeSummaries();
  const summary = service.getSummary();
  const gitMetadata = service.getDashboardPanelScopeMetadata("git");
  const securityMetadata = service.getDashboardPanelScopeMetadata("security");
  const readinessMetadata = service.getReadinessEndpointScopeMetadata("staging_dry_run");

  assert.equal(summary.implementationStatus, "v1_implemented");
  assert.equal(summary.scopeMetadataStatus, "v1_implemented");
  assert.equal(summary.tenantFilteringImplemented, false);
  assert.equal(summary.productionTenantEnforcement, false);
  assert.equal(summary.dashboardPanelScopeSummaryCount, dashboardSummaries.length);
  assert.equal(summary.readinessEndpointScopeSummaryCount, readinessSummaries.length);
  assert.equal(dashboardSummaries.some((entry) => entry.panelId === "llm_gateway" && entry.missingScopes.includes("provider")), true);
  assert.equal(readinessSummaries.some((entry) => entry.endpointPattern === "/readiness/scopes/*" && entry.missingScopes.includes("audit_query")), true);
  assert.equal(gitMetadata?.scopeStatus, "missing_scope_warning");
  assert.equal(gitMetadata?.tenantFilteringImplemented, false);
  assert.equal(gitMetadata?.productionEnforcementImplemented, false);
  assert.equal(gitMetadata?.missingScopes.includes("repo"), true);
  assert.equal(securityMetadata?.redactionStatus, "redacted_secret_adjacent_metadata_only");
  assert.equal(securityMetadata?.warnings.includes("secret_adjacent_metadata_redacted"), true);
  assert.equal(readinessMetadata?.warnings.includes("production_tenant_enforcement:false"), true);
  assert.equal(hasSecretOrEnvValue({ dashboardSummaries, readinessSummaries, gitMetadata, securityMetadata, readinessMetadata }), false);
});

test("Dashboard/Readiness Tenant Scope Implementation v1 API surfaces scope metadata without enforcement", async () => {
  await withApiServer(async (port) => {
    const gitDashboard = await getJson(port, "/dashboard/git");
    const tenantScopeSummary = await getJson(port, "/readiness/tenant-scope/summary");
    const scopeReadiness = await getJson(port, "/readiness/scopes/summary");
    const stagingReadiness = await getJson(port, "/readiness/staging-dry-run/summary");
    const health = await getJson(port, "/health");

    assert.equal(gitDashboard.statusCode, 200);
    const gitMetadata = ((gitDashboard.body.git as Record<string, unknown>).scopeMetadata as Record<string, unknown>);
    assert.equal(gitMetadata.scopeStatus, "missing_scope_warning");
    assert.equal(gitMetadata.tenantFilteringImplemented, false);
    assert.equal(gitMetadata.productionEnforcementImplemented, false);
    assert.equal(objectArray(gitMetadata.missingScopes).length > 0 || Array.isArray(gitMetadata.missingScopes), true);

    assert.equal(tenantScopeSummary.statusCode, 200);
    assert.equal((tenantScopeSummary.body.scopeMetadata as Record<string, unknown>).tenantFilteringImplemented, false);
    assert.equal(((tenantScopeSummary.body.summary as Record<string, unknown>).scopeMetadataStatus), "v1_implemented");

    assert.equal(scopeReadiness.statusCode, 200);
    assert.equal((scopeReadiness.body.scopeMetadata as Record<string, unknown>).productionEnforcementImplemented, false);
    assert.equal((scopeReadiness.body.endpointScopeSummary as Record<string, unknown>).endpointPattern, "/readiness/scopes/*");

    assert.equal(stagingReadiness.statusCode, 200);
    assert.equal((stagingReadiness.body.scopeMetadata as Record<string, unknown>).scopeStatus, "missing_scope_warning");
    assert.equal((stagingReadiness.body.endpointScopeSummary as Record<string, unknown>).endpointPattern, "/readiness/staging-dry-run/*");

    assert.equal(((health.body.dashboardTenantScopePlanning as Record<string, unknown>).scopeMetadataStatus), "v1_implemented");
    assert.equal(((health.body.dashboardTenantScopePlanning as Record<string, unknown>).productionEnforcementImplemented), false);
    assert.equal(hasSecretOrEnvValue({ gitDashboard, tenantScopeSummary, scopeReadiness, stagingReadiness, health }), false);
  });
});

test("Dashboard/Readiness Tenant Scope Implementation v1 dashboard render shows scope visibility and redaction hints", async () => {
  const models = await new DemoDashboardDataProvider().getReadModels();
  const html = renderDashboardReadModels(models);

  assert.equal(models.git.scopeMetadata?.missingScopes.includes("repo"), true);
  assert.equal(models.security.scopeMetadata?.redactionStatus, "redacted_secret_adjacent_metadata_only");
  assert.equal(models.tenantScopePlanning.panelScopeSummaries.length > 0, true);
  assert.equal(models.tenantScopePlanning.readinessScopeSummaries.length > 0, true);
  assert.equal(html.includes("Scope / Visibility / Redaction"), true);
  assert.equal(html.includes("Scope status badges"), true);
  assert.equal(html.includes("Missing scope warnings"), true);
  assert.equal(html.includes("Role visibility hints"), true);
  assert.equal(html.includes("Redaction labels"), true);
  assert.equal(html.includes("tenant filtering implemented: false"), true);
  assert.equal(html.includes("production tenant enforcement: false"), true);
  assert.equal(html.includes("No-secret/no-env status"), true);
  assert.equal(hasSecretOrEnvValue({ models, html }), false);
});

test("Dashboard/Readiness Tenant Scope Implementation v1 docs record metadata-only implementation", async () => {
  const files = await Promise.all([
    readFile("docs/roadmaps/dashboard-readiness-tenant-scope/implementation-v1-plan.md", "utf8"),
    readFile("docs/roadmaps/dashboard-readiness-tenant-scope/implementation-v1.md", "utf8"),
    readFile("docs/roadmaps/dashboard-readiness-tenant-scope/v1.md", "utf8"),
    readFile("docs/reference/dashboard-tenant-scope-inventory.md", "utf8"),
    readFile("docs/reference/readiness-tenant-scope-inventory.md", "utf8"),
    readFile("docs/reference/dashboard-role-visibility-matrix.md", "utf8"),
    readFile("docs/reference/readiness-role-visibility-matrix.md", "utf8")
  ]);
  const combined = files.join("\n");

  assert.equal(combined.includes("Dashboard/Readiness Tenant Scope Implementation: v1_implemented"), true);
  assert.equal(combined.includes("ScopedReadModelMetadata"), true);
  assert.equal(combined.includes("DashboardPanelScopeSummary"), true);
  assert.equal(combined.includes("ReadinessEndpointScopeSummary"), true);
  assert.equal(combined.includes("tenantFilteringImplemented: false"), true);
  assert.equal(combined.includes("productionEnforcementImplemented: false"), true);
  assert.equal(combined.includes("production tenant enforcement remains future"), true);
});
