import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  AuthorizationService,
  DisabledAuth0Provider,
  DisabledCustomAuthProvider,
  DisabledGoogleWorkspaceAuthProvider,
  DisabledGithubEnterpriseAuthProvider,
  DisabledMicrosoftEntraAuthProvider,
  DisabledOidcAuthProvider,
  DisabledOktaAuthProvider,
  DisabledSamlAuthProvider,
  DisabledScimDirectoryProvider,
  ProductionAuthProviderRegistry
} from "@aichestra/auth";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

function hasUnsafeAuthMaterial(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /Bearer\s+real-token|session=real-session|raw-cookie-value|raw-oidc-issuer-value|raw-oidc-audience-value|raw-jwks-value|raw-saml-metadata-value|raw-scim-endpoint-value|SESSION_SECRET=|JWT_SECRET=|OIDC_ID_TOKEN=|SAML_ASSERTION=|SCIM_TOKEN=|AUTH0_CLIENT_SECRET=|OKTA_TOKEN=|ENTRA_CLIENT_SECRET=|GOOGLE_WORKSPACE_TOKEN=|~\/\.codex|~\/\.claude|auth\.json/i.test(text);
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

function postJson(port: number, path: string): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: "127.0.0.1",
      port,
      path,
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "2" }
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

test("production auth provider registry defaults to MockAuthProvider and blocks future providers", () => {
  const registry = new ProductionAuthProviderRegistry();
  const summary = registry.getSummary();
  const configs = registry.listProviderConfigs();
  const readiness = registry.listProviderReadiness();
  const runtimeProvider = registry.createRuntimeProvider();

  assert.equal(runtimeProvider.getProviderKind(), "mock");
  assert.equal(summary.activeProviderKind, "mock");
  assert.equal(summary.selectedProviderKind, "mock");
  assert.equal(summary.productionAuthEnabled, false);
  assert.equal(summary.tokenValidationEnabled, false);
  assert.equal(summary.sessionBoundaryEnabled, false);
  assert.equal(summary.noTokensExposed, true);
  assert.equal(configs.some((config) => config.providerKind === "oidc_future" && config.tokenValidationEnabled === false), true);
  assert.equal(configs.some((config) => config.providerKind === "saml_future" && config.externalCallsEnabled === false), true);
  assert.equal(configs.some((config) => config.providerKind === "scim_future" && config.productionReady === false), true);
  assert.equal(readiness.some((check) => check.providerKind === "mock" && check.status === "ready_mock"), true);
  assert.equal(hasUnsafeAuthMaterial({ summary, configs, readiness }), false);
});

test("disabled future production auth providers cannot authenticate or validate real tokens", () => {
  const providers = [
    new DisabledOidcAuthProvider(),
    new DisabledSamlAuthProvider(),
    new DisabledScimDirectoryProvider(),
    new DisabledMicrosoftEntraAuthProvider(),
    new DisabledOktaAuthProvider(),
    new DisabledAuth0Provider(),
    new DisabledGoogleWorkspaceAuthProvider(),
    new DisabledGithubEnterpriseAuthProvider(),
    new DisabledCustomAuthProvider()
  ];

  for (const provider of providers) {
    assert.throws(() => provider.resolveAuthContext(), /disabled and not implemented/);
    assert.equal(provider.getStatus(), "disabled");
    assert.equal(provider.validateActor({ status: "active" } as Parameters<typeof provider.validateActor>[0]).ok, false);
    const readiness = provider.validateConfig({
      AICHESTRA_AUTH_OIDC_ISSUER: "raw-oidc-issuer-value",
      AICHESTRA_AUTH_OIDC_AUDIENCE: "raw-oidc-audience-value",
      AICHESTRA_AUTH_OIDC_JWKS_URI: "raw-jwks-value",
      AICHESTRA_AUTH_SAML_METADATA_URL: "raw-saml-metadata-value",
      AICHESTRA_AUTH_SCIM_ENDPOINT: "raw-scim-endpoint-value"
    });
    assert.equal(readiness.metadata.noTokensAccepted, true);
    assert.equal(readiness.metadata.noExternalIdentityProviderCalls, true);
    assert.equal(hasUnsafeAuthMaterial(readiness), false);
  }
});

test("production auth provider readiness models report future selection as blocked without exposing env values", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_AUTH_PROVIDER: "oidc_future",
      AICHESTRA_ENABLE_PRODUCTION_AUTH: "true",
      AICHESTRA_REQUIRE_AUTH_FOR_API: "true",
      AICHESTRA_AUTH_OIDC_ISSUER: "raw-oidc-issuer-value",
      AICHESTRA_AUTH_OIDC_AUDIENCE: "raw-oidc-audience-value",
      AICHESTRA_AUTH_OIDC_JWKS_URI: "raw-jwks-value",
      SESSION_SECRET: "SESSION_SECRET=raw-session-secret",
      JWT_SECRET: "JWT_SECRET=raw-jwt-secret"
    },
    now: () => new Date("2026-05-17T00:00:00.000Z")
  });
  const summary = service.getProductionAuthProviderSkeletonSummary();
  const configs = service.listProductionAuthProviderConfigs();
  const readiness = service.listProductionAuthProviderReadiness();
  const sessionBoundary = service.listSessionTokenBoundaryPlans();
  const identityMapping = service.listIdentityMappingPlans();
  const selected = configs.find((config) => config.providerKind === "oidc_future");

  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.selectedProviderKind, "oidc_future");
  assert.equal(summary.activeProviderKind, "mock");
  assert.equal(summary.productionAuthEnabled, false);
  assert.equal(summary.requireAuthForApi, false);
  assert.equal(summary.futureProviderSelected, true);
  assert.equal(summary.futureProviderBlocked, true);
  assert.equal(summary.tokenValidationEnabled, false);
  assert.equal(summary.externalIdpCallsEnabled, false);
  assert.equal(summary.noTokensExposed, true);
  assert.equal(selected?.status, "disabled");
  assert.equal(selected?.issuerConfigured, true);
  assert.equal(selected?.productionReady, false);
  assert.equal(readiness.some((check) => check.providerKind === "oidc_future" && check.status === "blocked"), true);
  assert.equal(sessionBoundary.every((plan) => plan.tokenIssued === false && plan.validationEnabled === false), true);
  assert.equal(identityMapping.some((plan) => plan.mappingKind === "tenant_claim_to_tenant_scope" && plan.status === "future"), true);
  assert.equal(hasUnsafeAuthMaterial({ summary, configs, readiness, sessionBoundary, identityMapping }), false);
});

test("auth provider readiness APIs, health, auth config, and middleware stay read-only and token-free", async () => {
  await withApiServer(async (port) => {
    const config = await getJson(port, "/readiness/auth-providers/config");
    const options = await getJson(port, "/readiness/auth-providers/options");
    const sessionBoundary = await getJson(port, "/readiness/auth-providers/session-boundary");
    const identityMapping = await getJson(port, "/readiness/auth-providers/identity-mapping");
    const summary = await getJson(port, "/readiness/auth-providers/summary");
    const health = await getJson(port, "/health");
    const authConfig = await getJson(port, "/auth/config");
    const authMe = await getJson(port, "/auth/me", {
      authorization: "Bearer real-token",
      cookie: "session=real-session; raw-cookie-value=true"
    });
    const writeAttempt = await postJson(port, "/readiness/auth-providers/summary");

    assert.equal(config.statusCode, 200);
    assert.equal(options.statusCode, 200);
    assert.equal(sessionBoundary.statusCode, 200);
    assert.equal(identityMapping.statusCode, 200);
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).selectedProviderKind, "saml_future");
    assert.equal((summary.body.summary as Record<string, unknown>).activeProviderKind, "mock");
    assert.equal((summary.body.summary as Record<string, unknown>).productionAuthEnabled, false);
    assert.equal((summary.body.summary as Record<string, unknown>).tokenValidationEnabled, false);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.authProviderSkeleton as Record<string, unknown>).selectedProviderKind, "saml_future");
    assert.equal((health.body.authProviderSkeleton as Record<string, unknown>).productionAuthEnabled, false);
    assert.equal((health.body.authProviderSkeleton as Record<string, unknown>).cookiesStored, false);
    assert.equal(authConfig.statusCode, 200);
    assert.equal(authConfig.body.productionAuthEnabled, false);
    assert.equal(authConfig.body.selectedProviderKind, "saml_future");
    assert.equal(authConfig.body.tokenValidationEnabled, false);
    assert.equal(authMe.statusCode, 200);
    assert.equal((authMe.body.requestContext as Record<string, unknown>).authProviderKind, "mock");
    assert.equal((authMe.body.requestContext as Record<string, unknown>).productionAuthEnabled, false);
    assert.equal((authMe.body.requestContext as Record<string, unknown>).tokenValidationEnabled, false);
    assert.equal(JSON.stringify(authMe.body).includes("Bearer real-token"), false);
    assert.equal(JSON.stringify(authMe.body).includes("raw-cookie-value"), false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasUnsafeAuthMaterial({ config, options, sessionBoundary, identityMapping, summary, health, authConfig, authMe }), false);
  }, {
    AICHESTRA_AUTH_PROVIDER: "saml_future",
    AICHESTRA_ENABLE_PRODUCTION_AUTH: "true",
    AICHESTRA_AUTH_SAML_METADATA_URL: "raw-saml-metadata-value",
    SAML_ASSERTION: "SAML_ASSERTION=raw-assertion-secret",
    SESSION_SECRET: "SESSION_SECRET=raw-session-secret",
    JWT_SECRET: "JWT_SECRET=raw-jwt-secret"
  });
});

test("auth provider dashboard panel renders disabled skeleton status without token or session material", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/auth-providers");
    const panel = dashboard.body.authProviders as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).activeProviderKind, "mock");
    assert.equal((panel.summary as Record<string, unknown>).productionAuthEnabled, false);
    assert.equal((panel.summary as Record<string, unknown>).tokenValidationEnabled, false);
    assert.equal((panel.noTokenStatus as Record<string, unknown>).authorizationHeadersStored, false);
    assert.equal((panel.noTokenStatus as Record<string, unknown>).cookiesStored, false);
    assert.equal(Array.isArray(panel.configs), true);
    assert.equal(Array.isArray(panel.sessionBoundary), true);
    assert.equal(Array.isArray(panel.identityMapping), true);
    assert.equal(hasUnsafeAuthMaterial(dashboard), false);
  }, {
    AICHESTRA_AUTH_PROVIDER: "okta_future",
    OKTA_TOKEN: "OKTA_TOKEN=raw-okta-token",
    AUTH0_CLIENT_SECRET: "AUTH0_CLIENT_SECRET=raw-auth0-secret"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Production Auth Provider Skeleton"), true);
  assert.equal(html.includes("Future providers"), true);
  assert.equal(html.includes("Session boundary"), true);
  assert.equal(html.includes("Identity mapping"), true);
  assert.equal(html.includes("No-token/no-session status"), true);
  assert.equal(hasUnsafeAuthMaterial(html), false);
});

test("future provider selection cannot bypass policy decisions", () => {
  const registry = new ProductionAuthProviderRegistry({
    env: {
      AICHESTRA_AUTH_PROVIDER: "oidc_future",
      AICHESTRA_ENABLE_PRODUCTION_AUTH: "true"
    }
  });
  const service = new AuthorizationService({ productionAuthProviderRegistry: registry });
  const context = service.getAuthContext({ actorId: "mock-admin", source: "test" });
  const decision = service.hasPermission(context, "secret.read", {
    resourceKind: "secret_scope",
    resourceId: "secretref_demo",
    metadata: { readOnly: true }
  });
  const subject = service.toPolicySubject(context);

  assert.equal(service.getConfig().selectedAuthProviderKind, "oidc_future");
  assert.equal(service.getConfig().productionAuthEnabled, false);
  assert.equal(subject.metadata?.productionAuthEnabled, false);
  assert.equal(subject.metadata?.authProviderKind, "mock");
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /policy_denied|permission_denied|permission_not_registered/);
});
