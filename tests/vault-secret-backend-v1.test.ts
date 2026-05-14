import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { AuthorizationService, InMemoryAuthRepository, MockAuthProvider } from "@aichestra/auth";
import { PolicyService } from "@aichestra/policy";
import {
  DisabledVaultClient,
  GatedHttpVaultClient,
  MockVaultClient,
  VaultSecretProvider,
  createVaultSecretProviderConfigFromEnv,
  credentialResolutionResultToDto,
  secretRefToDto,
  vaultClientHealthToDto,
  vaultSecretProviderConfigToDto,
  type SecretKind,
  type SecretRef
} from "@aichestra/security";
import { SecurityControlService } from "@aichestra/security";

function vaultEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    AICHESTRA_SECRET_BACKEND_PROVIDER: "vault",
    AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER: "true",
    AICHESTRA_VAULT_ADDR: "http://127.0.0.1:8200",
    AICHESTRA_VAULT_AUTH_METHOD: "token",
    AICHESTRA_VAULT_TOKEN: "hvs.vaultsecretbackendtest",
    AICHESTRA_VAULT_KV_MOUNT: "secret",
    AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES: "aichestra",
    ...overrides
  };
}

function createVaultSecurity(input: { path?: string; key?: string; status?: SecretRef["status"]; secretKind?: SecretKind; client?: MockVaultClient; policyService?: PolicyService; authorizationService?: AuthorizationService } = {}) {
  const config = createVaultSecretProviderConfigFromEnv(vaultEnv());
  const client = input.client ?? new MockVaultClient([
    {
      mount: "secret",
      path: input.path ?? "aichestra/github",
      data: {
        [input.key ?? "token"]: "ghp_vaultsecretbackendfixture"
      },
      version: 3
    }
  ], config);
  const security = new SecurityControlService({
    policyService: input.policyService,
    authorizationService: input.authorizationService,
    vaultSecretProvider: new VaultSecretProvider({ config, client })
  });
  const secretRef = security.createSecretRef({
    id: "secretref_vault_test",
    name: "Vault fixture",
    provider: "vault",
    secretKind: input.secretKind ?? "github_token",
    scope: "scope_env_provider_credentials",
    status: input.status ?? "active",
    metadata: {
      vaultMount: "secret",
      vaultPath: input.path ?? "aichestra/github",
      vaultKey: input.key ?? "token",
      vaultVersion: 3,
      dataShape: "single_key"
    }
  });
  return { security, client, secretRef };
}

function createAuthorizationService(policyService = new PolicyService()): AuthorizationService {
  const repository = new InMemoryAuthRepository();
  return new AuthorizationService({
    repository,
    provider: new MockAuthProvider({ repository }),
    policyService
  });
}

function noVaultSecretValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return !text.includes("ghp_vaultsecretbackendfixture") &&
    !text.includes("hvs.vaultsecretbackendtest") &&
    !text.includes("AICHESTRA_VAULT_TOKEN=hvs.");
}

async function requestJson(port: number, method: string, path: string, body?: unknown): Promise<{ statusCode: number; body: unknown }> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : undefined
    }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: text ? JSON.parse(text) : {}
        });
      });
    });
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

test("Vault config is disabled by default and DTOs hide token/address values", () => {
  const config = createVaultSecretProviderConfigFromEnv({
    AICHESTRA_VAULT_ADDR: "http://vault.internal:8200",
    AICHESTRA_VAULT_TOKEN: "hvs.vaultsecretbackendtest"
  });
  assert.equal(config.selectedProvider, "mock");
  assert.equal(config.vaultProviderEnabled, false);
  assert.equal(config.liveUsageReady, false);

  const configDto = vaultSecretProviderConfigToDto(config);
  const healthDto = vaultClientHealthToDto(new DisabledVaultClient(config).validateConnection());
  assert.equal(configDto.vaultAddressConfigured, true);
  assert.equal(configDto.vaultTokenConfigured, true);
  assert.equal(JSON.stringify(configDto).includes("vault.internal"), false);
  assert.equal(noVaultSecretValue({ configDto, healthDto }), true);
});

test("Vault SecretRef metadata validates required mount/path/key without storing raw values", () => {
  const { security, secretRef } = createVaultSecurity();
  const dto = secretRefToDto(secretRef);
  assert.equal(dto.provider, "vault");
  assert.equal(JSON.stringify(dto).includes("ghp_vaultsecretbackendfixture"), false);
  assert.equal(JSON.stringify(dto).includes("hvs.vaultsecretbackendtest"), false);

  assert.throws(() => security.createSecretRef({
    id: "secretref_vault_missing_key",
    name: "Vault missing key",
    provider: "vault",
    secretKind: "llm_api_key",
    scope: "scope_env_provider_credentials",
    status: "active",
    metadata: {
      vaultMount: "secret",
      vaultPath: "aichestra/llm"
    }
  }), /vault SecretRef requires metadata.vaultKey/);

  assert.throws(() => security.createSecretRef({
    id: "secretref_vault_raw_material",
    name: "Vault raw material",
    provider: "vault",
    secretKind: "llm_api_key",
    scope: "scope_env_provider_credentials",
    status: "active",
    metadata: {
      vaultMount: "secret",
      vaultPath: "aichestra/llm",
      vaultKey: "api_key",
      note: "AICHESTRA_VAULT_TOKEN=hvs.vaultsecretbackendtest"
    }
  }), /raw secret material/);
});

test("CredentialManager resolves a Vault-backed GitHub token through mock Vault without public exposure", () => {
  const { security, client } = createVaultSecurity();
  const resolved = security.resolveCredentialForInternalUse({
    secretRefId: "secretref_vault_test",
    purpose: "github_api_call",
    providerId: "github",
    policyContext: {
      providerKind: "github",
      credentialsConfigured: true
    }
  });
  assert.equal(resolved.allowed, true);
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.value, "ghp_vaultsecretbackendfixture");
  assert.equal(client.getReadCount(), 1);
  assert.equal(security.listSecretLeases({ status: "issued" }).length, 1);
  assert.equal(security.listAuditEvents({ eventType: "vault_secret_resolution_allowed" }).length, 1);

  const dto = credentialResolutionResultToDto(security.resolveCredential({
    secretRefId: "secretref_vault_test",
    purpose: "github_api_call",
    providerId: "github",
    policyContext: {
      providerKind: "github",
      credentialsConfigured: true
    }
  }));
  assert.equal(noVaultSecretValue({ dto, audits: security.listAuditEvents(), config: security.getConfig(), dashboard: security.getVaultSummary() }), true);
});

test("Vault resolution blocks disabled, revoked, path-denied, Auth/RBAC denied, and policy-denied refs before client read", () => {
  const disabled = createVaultSecurity({ status: "disabled" });
  assert.equal(disabled.security.resolveCredential({
    secretRefId: "secretref_vault_test",
    purpose: "github_api_call",
    providerId: "github",
    policyContext: { providerKind: "github", credentialsConfigured: true }
  }).blockedReason, "secret_ref_disabled");
  assert.equal(disabled.client.getReadCount(), 0);

  const revoked = createVaultSecurity({ status: "revoked" });
  assert.equal(revoked.security.resolveCredential({
    secretRefId: "secretref_vault_test",
    purpose: "github_api_call",
    providerId: "github",
    policyContext: { providerKind: "github", credentialsConfigured: true }
  }).blockedReason, "secret_ref_revoked");
  assert.equal(revoked.client.getReadCount(), 0);

  const pathDenied = createVaultSecurity({ path: "outside/team/github" });
  assert.equal(pathDenied.security.resolveCredential({
    secretRefId: "secretref_vault_test",
    purpose: "github_api_call",
    providerId: "github",
    policyContext: { providerKind: "github", credentialsConfigured: true }
  }).blockedReason, "vault_path_not_allowlisted");
  assert.equal(pathDenied.client.getReadCount(), 0);

  const policyService = new PolicyService();
  const authorizationService = createAuthorizationService(policyService);
  const authDenied = createVaultSecurity({ policyService, authorizationService });
  const viewer = authorizationService.getAuthContext({ actorId: "user_demo_viewer", source: "test" });
  assert.match(authDenied.security.resolveCredential({
    secretRefId: "secretref_vault_test",
    purpose: "github_api_call",
    actorId: viewer.actor.id,
    principalId: viewer.principal.id,
    authContext: viewer,
    providerId: "github",
    policyContext: { providerKind: "github", credentialsConfigured: true }
  }).blockedReason ?? "", /authorization_denied/);
  assert.equal(authDenied.client.getReadCount(), 0);
  assert.equal(authDenied.security.listAuditEvents({ eventType: "vault_secret_resolution_auth_denied" }).length, 1);

  const policyDenied = createVaultSecurity();
  assert.match(policyDenied.security.resolveCredential({
    secretRefId: "secretref_vault_test",
    purpose: "github_api_call",
    providerId: "github",
    policyContext: { providerKind: "custom", credentialsConfigured: true }
  }).blockedReason ?? "", /No policy rule allowed/);
  assert.equal(policyDenied.client.getReadCount(), 0);
  assert.equal(policyDenied.security.listAuditEvents({ eventType: "vault_secret_resolution_policy_denied" }).length, 1);
  assert.equal(noVaultSecretValue({
    disabled: disabled.security.listAuditEvents(),
    revoked: revoked.security.listAuditEvents(),
    pathDenied: pathDenied.security.listAuditEvents(),
    authDenied: authDenied.security.listAuditEvents(),
    policyDenied: policyDenied.security.listAuditEvents()
  }), true);
});

test("Vault-backed LLM and provider API SecretRefs resolve through the same gated mock boundary", () => {
  const llm = createVaultSecurity({ secretKind: "llm_api_key", path: "aichestra/llm", key: "apiKey" });
  assert.equal(llm.security.resolveCredentialForInternalUse({
    secretRefId: "secretref_vault_test",
    purpose: "llm_api_call",
    providerId: "openai_compatible",
    policyContext: {
      providerKind: "openai_compatible",
      credentialsConfigured: true,
      remoteLlmEnabled: true,
      remoteCompletionEnabled: true
    }
  }).status, "resolved");

  const provider = createVaultSecurity({ secretKind: "provider_api_key", path: "aichestra/provider", key: "apiKey" });
  assert.equal(provider.security.resolveCredentialForInternalUse({
    secretRefId: "secretref_vault_test",
    purpose: "provider_api_call",
    providerId: "custom",
    policyContext: {
      providerKind: "custom",
      credentialsConfigured: true
    }
  }).status, "resolved");
  assert.equal(noVaultSecretValue({ llmAudit: llm.security.listAuditEvents(), providerAudit: provider.security.listAuditEvents() }), true);
});

test("Vault API, health, readiness, and dashboard endpoints are status-only and metadata-safe", async () => {
  const server = createApiServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    const createRef = await requestJson(port, "POST", "/security/credentials/refs", {
      id: "secretref_api_vault",
      name: "API Vault ref",
      provider: "vault",
      secretKind: "github_token",
      scope: "scope_env_provider_credentials",
      metadata: {
        vaultMount: "secret",
        vaultPath: "aichestra/github",
        vaultKey: "token"
      }
    });
    assert.equal(createRef.statusCode, 201);

    const config = await requestJson(port, "GET", "/security/secrets/vault/config");
    const health = await requestJson(port, "GET", "/security/secrets/vault/health");
    const check = await requestJson(port, "POST", "/security/secrets/vault/resolve/check", {
      secretRefId: "secretref_api_vault",
      purpose: "github_api_call",
      providerId: "github",
      policyContext: {
        providerKind: "github",
        credentialsConfigured: true
      }
    });
    const audit = await requestJson(port, "GET", "/security/secrets/vault/audit");
    const readinessConfig = await requestJson(port, "GET", "/readiness/secrets/vault/config");
    const readinessChecks = await requestJson(port, "GET", "/readiness/secrets/vault/checks");
    const readinessSummary = await requestJson(port, "GET", "/readiness/secrets/vault/summary");
    const dashboard = await requestJson(port, "GET", "/dashboard/vault-secret-backend");
    const healthRoot = await requestJson(port, "GET", "/health");

    assert.equal(config.statusCode, 200);
    assert.equal(health.statusCode, 200);
    assert.equal(check.statusCode, 200);
    assert.equal(audit.statusCode, 200);
    assert.equal(readinessConfig.statusCode, 200);
    assert.equal(readinessChecks.statusCode, 200);
    assert.equal(readinessSummary.statusCode, 200);
    assert.equal(dashboard.statusCode, 200);
    assert.equal(healthRoot.statusCode, 200);
    assert.equal(noVaultSecretValue({ createRef, config, health, check, audit, readinessConfig, readinessChecks, readinessSummary, dashboard, healthRoot }), true);
    assert.equal(JSON.stringify(healthRoot.body).includes("productionSecretBackendImplemented\":true"), false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

const liveVaultGatesPresent = [
  process.env.AICHESTRA_VAULT_INTEGRATION_TESTS === "true",
  process.env.AICHESTRA_SECRET_BACKEND_PROVIDER === "vault",
  process.env.AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER === "true",
  Boolean(process.env.AICHESTRA_VAULT_ADDR),
  process.env.AICHESTRA_VAULT_AUTH_METHOD === "token",
  Boolean(process.env.AICHESTRA_VAULT_TOKEN),
  Boolean(process.env.AICHESTRA_VAULT_KV_MOUNT),
  Boolean(process.env.AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES),
  Boolean(process.env.AICHESTRA_TEST_VAULT_SECRET_PATH),
  Boolean(process.env.AICHESTRA_TEST_VAULT_SECRET_KEY)
].every(Boolean);

test("optional live Vault KV v2 read is skipped unless every explicit gate is configured", { skip: liveVaultGatesPresent ? false : "Vault integration gates are not fully configured." }, async () => {
  const config = createVaultSecretProviderConfigFromEnv(process.env);
  const client = new GatedHttpVaultClient({
    config,
    address: process.env.AICHESTRA_VAULT_ADDR ?? "",
    token: process.env.AICHESTRA_VAULT_TOKEN ?? ""
  });
  const provider = new VaultSecretProvider({ config, client });
  const result = await provider.resolveSecretAsync({
    id: "secretref_live_vault_test",
    name: "Live Vault test SecretRef",
    provider: "vault",
    secretKind: "provider_api_key",
    scope: "scope_provider_credentials",
    status: "active",
    metadata: {
      vaultMount: process.env.AICHESTRA_VAULT_KV_MOUNT ?? "",
      vaultPath: process.env.AICHESTRA_TEST_VAULT_SECRET_PATH ?? "",
      vaultKey: process.env.AICHESTRA_TEST_VAULT_SECRET_KEY ?? "",
      vaultNamespace: process.env.AICHESTRA_VAULT_NAMESPACE,
      dataShape: "single_key"
    },
    createdAt: new Date(),
    updatedAt: new Date()
  });
  assert.ok(["resolved", "missing", "denied", "unavailable", "blocked"].includes(result.status));
  assert.equal(noVaultSecretValue({ status: result.status, metadata: result.metadata, reason: result.reason }), true);
});
