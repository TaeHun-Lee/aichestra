import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixedNow = new Date("2026-05-14T00:00:00.000Z");

function hasTokenOrSessionValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /OIDC_ID_TOKEN=|SAML_ASSERTION=|SCIM_TOKEN=|OKTA_TOKEN=|AUTH0_CLIENT_SECRET=|ENTRA_CLIENT_SECRET=|GOOGLE_WORKSPACE_TOKEN=|SESSION_SECRET=|JWT_SECRET=|Cookie:\s*session|Bearer\s+idp|raw-assertion-secret|session-cookie-secret|password-secret|~\/\.codex|~\/\.claude|auth\.json|Google credential cache path/i.test(text);
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

function postJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
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

async function withApiServer(run: (port: number) => Promise<void>, envPatch: Record<string, string | undefined> = {}): Promise<void> {
  const previousEnv = new Map(Object.keys(envPatch).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(envPatch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const [key, value] of previousEnv.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("production auth readiness models expose providers, phases, risks, scopes, services, matrix, and summary without token values", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_DEPLOYMENT_PROFILE: "production",
      OIDC_ID_TOKEN: "Bearer idp-token",
      SAML_ASSERTION: "raw-assertion-secret",
      SCIM_TOKEN: "scim-secret",
      SESSION_SECRET: "session-cookie-secret",
      JWT_SECRET: "jwt-secret",
      AUTH0_CLIENT_SECRET: "auth0-secret",
      OKTA_TOKEN: "okta-secret",
      ENTRA_CLIENT_SECRET: "entra-secret"
    },
    now: () => fixedNow
  });

  const summary = service.getAuthRbacProductionSummary();
  const providers = service.listAuthProviderOptions();
  const phases = service.listAuthRbacMigrationPhases();
  const checks = service.listAuthRbacReadinessChecks();
  const risks = service.listAuthRbacProductionRisks();
  const tenantPlans = service.listTenantBoundaryPlans();
  const serviceAccounts = service.listServiceAccountPlans();
  const permissionMatrix = service.listProductionRbacPermissionMatrix();

  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.productionReady, false);
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.currentProfileId, "production");
  assert.equal(summary.productionAuthEnabled, false);
  assert.equal(summary.authMode, "mock");
  assert.equal(summary.mockActorEnabled, true);
  assert.equal(summary.mockActorWarning, "mock_actor_blocked_for_production_profile");
  assert.equal(summary.futureIdpConfigured, false);
  assert.equal(summary.externalIdpCallsEnabled, false);
  assert.equal(summary.realSessionsImplemented, false);
  assert.equal(summary.realJwtIssuanceImplemented, false);
  assert.equal(summary.passwordLoginImplemented, false);
  assert.equal(summary.serviceAccountCredentialIssuanceImplemented, false);
  assert.equal(summary.requestContextPropagationStatus, "partial_mock_only");
  assert.equal(summary.tenantScopeModelReady, false);
  assert.equal(summary.noTokensExposed, true);
  assert.equal(summary.cookiesExposed, false);
  assert.equal(summary.sessionIdsExposed, false);
  assert.equal(summary.passwordsExposed, false);
  assert.equal(summary.rawIdentityAssertionsExposed, false);
  assert.equal(providers.some((provider) => provider.providerKind === "oidc" && provider.productionRecommended), true);
  assert.equal(providers.some((provider) => provider.providerKind === "mock" && !provider.productionRecommended), true);
  assert.equal(phases.some((phase) => phase.id === "auth_phase_5_mock_actor_deprecation" && phase.status === "blocked"), true);
  assert.equal(checks.some((check) => check.id === "auth_identity_provider_required" && check.status === "fail"), true);
  assert.equal(checks.some((check) => check.id === "auth_role_mapping_matrix_defined" && check.status === "pass"), true);
  assert.equal(risks.some((risk) => risk.id === "auth_risk_mock_actor_production" && risk.severity === "critical"), true);
  assert.equal(tenantPlans.some((plan) => plan.tenantKind === "organization" && plan.status === "not_ready"), true);
  assert.equal(serviceAccounts.some((plan) => plan.serviceAccountKind === "git_webhook" && plan.status === "planned"), true);
  assert.equal(permissionMatrix.some((entry) => entry.roleName === "security_admin" && entry.deniedActions.includes("secret.read")), true);
  assert.equal(permissionMatrix.some((entry) => entry.roleName === "break_glass_admin_future" && entry.productionDefault === "deny"), true);
  assert.equal(hasTokenOrSessionValue({ summary, providers, phases, checks, risks, tenantPlans, serviceAccounts, permissionMatrix }), false);
});

test("production auth readiness APIs and health metadata are read-only and hide tokens, cookies, and sessions", async () => {
  await withApiServer(async (port) => {
    const summary = await getJson(port, "/readiness/auth/summary");
    const providers = await getJson(port, "/readiness/auth/providers");
    const phases = await getJson(port, "/readiness/auth/migration-phases");
    const checks = await getJson(port, "/readiness/auth/checks?category=mock_actor_deprecation");
    const risks = await getJson(port, "/readiness/auth/risks");
    const tenants = await getJson(port, "/readiness/auth/tenant-boundaries");
    const serviceAccounts = await getJson(port, "/readiness/auth/service-accounts");
    const matrix = await getJson(port, "/readiness/auth/permission-matrix");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/auth/summary");

    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).currentProfileId, "production");
    assert.equal((summary.body.summary as Record<string, unknown>).productionAuthEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).futureIdpConfigured, false);
    assert.equal((summary.body.summary as Record<string, unknown>).noTokensExposed, true);
    assert.equal((summary.body.summary as Record<string, unknown>).sessionIdsExposed, false);
    assert.equal(providers.statusCode, 200);
    assert.equal((providers.body.providers as unknown[]).length > 0, true);
    assert.equal(phases.statusCode, 200);
    assert.equal((phases.body.migrationPhases as unknown[]).length > 0, true);
    assert.equal(checks.statusCode, 200);
    assert.equal((checks.body.checks as Array<Record<string, unknown>>).every((check) => check.category === "mock_actor_deprecation"), true);
    assert.equal(risks.statusCode, 200);
    assert.equal(tenants.statusCode, 200);
    assert.equal(serviceAccounts.statusCode, 200);
    assert.equal(matrix.statusCode, 200);
    assert.equal((matrix.body.permissionMatrix as unknown[]).length >= 10, true);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.authReadiness as Record<string, unknown>).productionAuthEnabled, false);
    assert.equal((health.body.authReadiness as Record<string, unknown>).futureIdpConfigured, false);
    assert.equal((health.body.authReadiness as Record<string, unknown>).mockActorWarning, "mock_actor_blocked_for_production_profile");
    assert.equal((health.body.authReadiness as Record<string, unknown>).noTokensExposed, true);
    assert.equal((health.body.authReadiness as Record<string, unknown>).cookiesExposed, false);
    assert.equal((health.body.authReadiness as Record<string, unknown>).sessionIdsExposed, false);
    assert.equal((health.body.authReadiness as Record<string, unknown>).externalIdpCallsEnabled, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasTokenOrSessionValue({ summary, providers, phases, checks, risks, tenants, serviceAccounts, matrix, health }), false);
  }, {
    AICHESTRA_DEPLOYMENT_PROFILE: "production",
    OIDC_ID_TOKEN: "Bearer idp-token",
    SAML_ASSERTION: "raw-assertion-secret",
    SCIM_TOKEN: "scim-secret",
    SESSION_SECRET: "session-cookie-secret",
    JWT_SECRET: "jwt-secret",
    AUTH0_CLIENT_SECRET: "auth0-secret",
    OKTA_TOKEN: "okta-secret"
  });
});

test("production auth dashboard panel renders readiness status without token or session material", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/auth-production");
    const panel = dashboard.body.authProduction as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).productionAuthEnabled, false);
    assert.equal((panel.summary as Record<string, unknown>).futureIdpConfigured, false);
    assert.equal((panel.mockActorStatus as Record<string, unknown>).productionReady, false);
    assert.equal((panel.noTokenStatus as Record<string, unknown>).noTokensExposed, true);
    assert.equal((panel.noTokenStatus as Record<string, unknown>).cookiesExposed, false);
    assert.equal((panel.noTokenStatus as Record<string, unknown>).sessionIdsExposed, false);
    assert.equal(Array.isArray(panel.providerOptions), true);
    assert.equal(Array.isArray(panel.permissionMatrix), true);
    assert.equal(hasTokenOrSessionValue(dashboard), false);
  }, {
    OIDC_ID_TOKEN: "Bearer idp-token",
    SAML_ASSERTION: "raw-assertion-secret",
    SESSION_SECRET: "session-cookie-secret"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Auth/RBAC Production Readiness"), true);
  assert.equal(html.includes("Provider options"), true);
  assert.equal(html.includes("Mock actor warning"), true);
  assert.equal(html.includes("Service accounts"), true);
  assert.equal(html.includes("Tenant and scope"), true);
  assert.equal(html.includes("Role matrix"), true);
  assert.equal(html.includes("No-token/no-session status"), true);
  assert.equal(hasTokenOrSessionValue(html), false);
});

test("production auth planning keeps real identity provider, sessions, and credential issuance disabled", () => {
  const service = createDeploymentReadinessService({ now: () => fixedNow });
  const summary = service.getAuthRbacProductionSummary();
  const providerOptions = service.listAuthProviderOptions();
  const serviceAccounts = service.listServiceAccountPlans();

  assert.equal(summary.productionAuthEnabled, false);
  assert.equal(summary.futureIdpConfigured, false);
  assert.equal(summary.externalIdpCallsEnabled, false);
  assert.equal(summary.realSessionsImplemented, false);
  assert.equal(summary.realJwtIssuanceImplemented, false);
  assert.equal(summary.passwordLoginImplemented, false);
  assert.equal(summary.serviceAccountCredentialIssuanceImplemented, false);
  assert.equal(providerOptions.some((provider) => provider.metadata.realProviderImplemented === false), true);
  assert.equal(serviceAccounts.some((account) => account.metadata.credentialsIssued === false), true);
});
