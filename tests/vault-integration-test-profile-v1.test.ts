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

function hasVaultSecretOrEnvValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /hvs\.vaultintegrationtest|AICHESTRA_VAULT_TOKEN=|VAULT_TOKEN=|https:\/\/vault-it\.example\.invalid|aichestra\/test\/vault-it|test-only-api-key-value|provider-secret-value|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
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

test("Vault integration-test readiness models are disabled by default and expose no Vault values", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_VAULT_ADDR: "https://vault-it.example.invalid",
      AICHESTRA_VAULT_TOKEN: "hvs.vaultintegrationtest"
    },
    now: () => fixedNow
  });

  const profile = service.getVaultIntegrationTestProfile();
  const testCases = service.listVaultIntegrationTestCases();
  const safetyChecks = service.listVaultIntegrationTestSafetyChecks();
  const pathChecks = service.listVaultIntegrationTestSafetyChecks({ category: "path_allowlist" });
  const summary = service.getVaultIntegrationTestReadinessSummary();

  assert.equal(profile.status, "disabled");
  assert.equal(profile.backendKind, "vault");
  assert.equal(profile.forbiddenOperations.includes("vault_write"), true);
  assert.equal(profile.forbiddenOperations.includes("vault_delete"), true);
  assert.equal(profile.forbiddenOperations.includes("vault_rotate"), true);
  assert.equal(profile.forbiddenOperations.includes("vault_broad_list"), true);
  assert.equal(testCases.some((testCase) => testCase.category === "config_validation" && testCase.enabledByDefault), true);
  assert.equal(testCases.some((testCase) => testCase.category === "kv_v2_read" && testCase.requiresLiveVault), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_write" && check.status === "pass"), true);
  assert.equal(pathChecks.every((check) => check.category === "path_allowlist"), true);
  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.liveTestsEnabled, false);
  assert.equal(summary.canRunLiveTests, false);
  assert.equal(summary.defaultLiveTestsSkipped, true);
  assert.equal(summary.vaultBackendSelected, false);
  assert.equal(summary.vaultProviderEnabled, false);
  assert.equal(summary.vaultAddressConfigured, true);
  assert.equal(summary.vaultTokenConfigured, true);
  assert.equal(summary.testSecretPathConfigured, false);
  assert.equal(summary.testSecretKeyConfigured, false);
  assert.equal(summary.noWrite, true);
  assert.equal(summary.noDelete, true);
  assert.equal(summary.noRotate, true);
  assert.equal(summary.noBroadList, true);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(summary.vaultTokenExposed, false);
  assert.equal(summary.vaultAddressExposed, false);
  assert.equal(summary.vaultSecretValueExposed, false);
  assert.equal(summary.vaultCallsInDefaultTests, false);
  assert.equal(hasVaultSecretOrEnvValue({ profile, testCases, safetyChecks, summary }), false);
});

test("Vault integration-test profile can become runnable only when all explicit gates are configured safely", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_VAULT_INTEGRATION_TESTS: "true",
      AICHESTRA_SECRET_BACKEND_PROVIDER: "vault",
      AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER: "true",
      AICHESTRA_VAULT_ADDR: "https://vault-it.example.invalid",
      AICHESTRA_VAULT_AUTH_METHOD: "token",
      AICHESTRA_VAULT_TOKEN: "hvs.vaultintegrationtest",
      AICHESTRA_VAULT_KV_MOUNT: "secret",
      AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES: "aichestra/test",
      AICHESTRA_TEST_VAULT_SECRET_PATH: "aichestra/test/vault-it",
      AICHESTRA_TEST_VAULT_SECRET_KEY: "test-only-api-key-value",
      AICHESTRA_VAULT_NAMESPACE: "sandbox"
    },
    now: () => fixedNow
  });

  const summary = service.getVaultIntegrationTestReadinessSummary();
  const profile = service.getVaultIntegrationTestProfile();
  const safetyChecks = service.listVaultIntegrationTestSafetyChecks();

  assert.equal(summary.liveTestsEnabled, true);
  assert.equal(summary.canRunLiveTests, true);
  assert.equal(summary.missingGateCount, 0);
  assert.equal(summary.unsafeGateCount, 0);
  assert.equal(summary.vaultBackendSelected, true);
  assert.equal(summary.vaultProviderEnabled, true);
  assert.equal(summary.vaultAddressConfigured, true);
  assert.equal(summary.vaultNamespaceConfigured, true);
  assert.equal(summary.vaultTokenConfigured, true);
  assert.equal(summary.vaultKvMountConfigured, true);
  assert.equal(summary.pathAllowlistConfigured, true);
  assert.equal(summary.pathAllowlistPrefixCount, 1);
  assert.equal(summary.testSecretPathAllowlisted, true);
  assert.equal(summary.testSecretPathLooksTestOnly, true);
  assert.equal(summary.credentialSource, "vault_secretref");
  assert.equal(summary.envFallbackUsed, false);
  assert.equal(profile.status, "ready_if_configured");
  assert.deepEqual(profile.requiredPathAllowlist, ["configured_path_allowlist_redacted"]);
  assert.equal(safetyChecks.every((check) => check.status === "pass"), true);
  assert.equal(hasVaultSecretOrEnvValue({ summary, profile, safetyChecks }), false);
});

test("Vault live integration enablement is skipped by default and keeps forbidden operations disabled", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_VAULT_ADDR: "https://vault-it.example.invalid",
      AICHESTRA_VAULT_TOKEN: "hvs.vaultintegrationtest"
    },
    now: () => fixedNow
  });

  const readiness = service.getVaultLiveIntegrationReadiness();
  const checks = service.listVaultLiveValidationChecks();
  const summary = service.getVaultLiveIntegrationSummary();
  const runRecord = service.getVaultLiveValidationRunRecord();
  const runbook = service.getVaultLiveIntegrationRunbook();

  assert.equal(readiness.status, "skipped");
  assert.equal(readiness.missingGates.includes("AICHESTRA_VAULT_INTEGRATION_TESTS"), true);
  assert.equal(readiness.writeOperationsAllowed, false);
  assert.equal(readiness.deleteOperationsAllowed, false);
  assert.equal(readiness.rotationAllowed, false);
  assert.equal(readiness.broadListAllowed, false);
  assert.equal(service.canRunVaultLiveValidation(), false);
  assert.equal(summary.readinessStatus, "skipped");
  assert.equal(summary.canRunLiveValidation, false);
  assert.equal(summary.productionVaultRolloutImplemented, false);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(runRecord.status, "skipped");
  assert.equal(runRecord.secretValueExposed, false);
  assert.equal(runRecord.writeAttempted, false);
  assert.equal(runRecord.deleteAttempted, false);
  assert.equal(runRecord.broadListAttempted, false);
  assert.equal(runbook.requiredEnvVars.includes("AICHESTRA_VAULT_TOKEN"), true);
  assert.equal(checks.some((check) => check.checkKind === "env_gates" && check.status === "skipped"), true);
  assert.equal(checks.some((check) => check.checkKind === "no_write" && check.status === "pass"), true);
  assert.equal(hasVaultSecretOrEnvValue({ readiness, checks, summary, runRecord, runbook }), false);
});

test("Vault live integration enablement becomes ready for manual live test only with safe gates", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_VAULT_INTEGRATION_TESTS: "true",
      AICHESTRA_SECRET_BACKEND_PROVIDER: "vault",
      AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER: "true",
      AICHESTRA_VAULT_ADDR: "https://vault-it.example.invalid",
      AICHESTRA_VAULT_AUTH_METHOD: "token",
      AICHESTRA_VAULT_TOKEN: "hvs.vaultintegrationtest",
      AICHESTRA_VAULT_KV_MOUNT: "secret",
      AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES: "aichestra/test",
      AICHESTRA_TEST_VAULT_SECRET_PATH: "aichestra/test/vault-it",
      AICHESTRA_TEST_VAULT_SECRET_KEY: "test-only-api-key-value",
      AICHESTRA_VAULT_NAMESPACE: "sandbox"
    },
    now: () => fixedNow
  });

  const readiness = service.getVaultLiveIntegrationReadiness();
  const checks = service.listVaultLiveValidationChecks();
  const summary = service.getVaultLiveIntegrationSummary();
  const runRecord = service.getVaultLiveValidationRunRecord();

  assert.equal(readiness.status, "ready_for_manual_live_test");
  assert.equal(readiness.configuredGateCount, readiness.requiredGateCount);
  assert.deepEqual(readiness.missingGates, []);
  assert.deepEqual(readiness.unsafeGates, []);
  assert.equal(readiness.testPathAllowlisted, true);
  assert.equal(readiness.testPathLooksSafe, true);
  assert.equal(service.canRunVaultLiveValidation(), true);
  assert.equal(summary.canRunLiveValidation, true);
  assert.equal(runRecord.status, "ready");
  assert.equal(checks.every((check) => check.status === "pass"), true);
  assert.equal(hasVaultSecretOrEnvValue({ readiness, checks, summary, runRecord }), false);
});

test("Vault integration-test readiness blocks unsafe paths, auth methods, broad listing, writes, deletes, rotates, and credential caches", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_VAULT_INTEGRATION_TESTS: "true",
      AICHESTRA_SECRET_BACKEND_PROVIDER: "vault",
      AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER: "true",
      AICHESTRA_VAULT_ADDR: "https://vault-it.example.invalid",
      AICHESTRA_VAULT_AUTH_METHOD: "approle",
      AICHESTRA_VAULT_TOKEN: "hvs.vaultintegrationtest",
      AICHESTRA_VAULT_KV_MOUNT: "secret",
      AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES: "aichestra/test",
      AICHESTRA_TEST_VAULT_SECRET_PATH: "aichestra/prod/customer-secret",
      AICHESTRA_TEST_VAULT_SECRET_KEY: "test-only-api-key-value",
      AICHESTRA_VAULT_ALLOW_WRITE: "true",
      AICHESTRA_VAULT_ALLOW_DELETE: "true",
      AICHESTRA_VAULT_ALLOW_ROTATE: "true",
      AICHESTRA_VAULT_ALLOW_BROAD_LIST: "true",
      AICHESTRA_VAULT_CREDENTIAL_CACHE_PATH: "~/.codex/auth.json"
    },
    now: () => fixedNow
  });

  const summary = service.getVaultIntegrationTestReadinessSummary();
  const safetyChecks = service.listVaultIntegrationTestSafetyChecks();

  assert.equal(summary.canRunLiveTests, false);
  assert.equal(summary.profileStatus, "blocked");
  assert.equal(summary.unsafeGateWarnings.includes("vault_auth_method_not_token"), true);
  assert.equal(summary.unsafeGateWarnings.includes("test_secret_path_not_allowlisted"), true);
  assert.equal(summary.unsafeGateWarnings.includes("test_secret_path_not_test_only"), true);
  assert.equal(summary.unsafeGateWarnings.includes("production_like_test_path_configured"), true);
  assert.equal(summary.unsafeGateWarnings.includes("vault_write_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("vault_delete_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("vault_rotate_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("vault_broad_list_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("credential_cache_reference_configured"), true);
  assert.equal(safetyChecks.some((check) => check.category === "auth_method" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "path_allowlist" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "test_secret_path" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_write" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_delete" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_rotate" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_broad_list" && check.status === "fail"), true);
  assert.equal(hasVaultSecretOrEnvValue({ summary, safetyChecks }), false);
});

test("Vault live integration enablement blocks paths outside the allowlist", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_VAULT_INTEGRATION_TESTS: "true",
      AICHESTRA_SECRET_BACKEND_PROVIDER: "vault",
      AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER: "true",
      AICHESTRA_VAULT_ADDR: "https://vault-it.example.invalid",
      AICHESTRA_VAULT_AUTH_METHOD: "token",
      AICHESTRA_VAULT_TOKEN: "hvs.vaultintegrationtest",
      AICHESTRA_VAULT_KV_MOUNT: "secret",
      AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES: "aichestra/test",
      AICHESTRA_TEST_VAULT_SECRET_PATH: "aichestra/dev/vault-it",
      AICHESTRA_TEST_VAULT_SECRET_KEY: "test-only-api-key-value"
    },
    now: () => fixedNow
  });

  const readiness = service.getVaultLiveIntegrationReadiness();
  const checks = service.listVaultLiveValidationChecks();

  assert.equal(readiness.status, "blocked_unsafe");
  assert.equal(readiness.unsafeGates.includes("test_secret_path_not_allowlisted"), true);
  assert.equal(readiness.testPathAllowlisted, false);
  assert.equal(checks.some((check) => check.checkKind === "path_allowlist" && check.status === "fail"), true);
  assert.equal(hasVaultSecretOrEnvValue({ readiness, checks }), false);
});

test("Vault live integration enablement blocks production-looking paths and sensitive unmarked keys", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_VAULT_INTEGRATION_TESTS: "true",
      AICHESTRA_SECRET_BACKEND_PROVIDER: "vault",
      AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER: "true",
      AICHESTRA_VAULT_ADDR: "https://vault-it.example.invalid",
      AICHESTRA_VAULT_AUTH_METHOD: "token",
      AICHESTRA_VAULT_TOKEN: "hvs.vaultintegrationtest",
      AICHESTRA_VAULT_KV_MOUNT: "secret",
      AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES: "aichestra/test",
      AICHESTRA_TEST_VAULT_SECRET_PATH: "aichestra/test/prod/customer-secret",
      AICHESTRA_TEST_VAULT_SECRET_KEY: "api_key"
    },
    now: () => fixedNow
  });

  const readiness = service.getVaultLiveIntegrationReadiness();
  const checks = service.listVaultLiveValidationChecks();

  assert.equal(readiness.status, "blocked_unsafe");
  assert.equal(readiness.unsafeGates.includes("production_like_test_path_configured"), true);
  assert.equal(readiness.unsafeGates.includes("test_secret_key_not_test_marker"), true);
  assert.equal(readiness.testPathLooksSafe, false);
  assert.equal(checks.some((check) => check.checkKind === "test_path_safe" && check.status === "fail"), true);
  assert.equal(hasVaultSecretOrEnvValue({ readiness, checks }), false);
});

test("Vault integration-test readiness APIs and health metadata are read-only and sanitized", async () => {
  await withApiServer(async (port) => {
    const profile = await getJson(port, "/readiness/vault-integration/profile");
    const testCases = await getJson(port, "/readiness/vault-integration/test-cases");
    const safetyChecks = await getJson(port, "/readiness/vault-integration/safety-checks?category=no_write");
    const summary = await getJson(port, "/readiness/vault-integration/summary");
    const liveReadiness = await getJson(port, "/readiness/secrets/vault/live-readiness");
    const liveChecks = await getJson(port, "/readiness/secrets/vault/live-checks");
    const liveRunbook = await getJson(port, "/readiness/secrets/vault/live-runbook");
    const liveSummary = await getJson(port, "/readiness/secrets/vault/live-summary");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/vault-integration/summary");
    const liveWriteAttempt = await postJson(port, "/readiness/secrets/vault/live-summary");

    assert.equal(profile.statusCode, 200);
    assert.equal((profile.body.profile as Record<string, unknown>).backendKind, "vault");
    assert.equal(testCases.statusCode, 200);
    assert.equal((testCases.body.testCases as unknown[]).length > 0, true);
    assert.equal(safetyChecks.statusCode, 200);
    assert.equal((safetyChecks.body.safetyChecks as Array<Record<string, unknown>>).every((check) => check.category === "no_write"), true);
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).productionReady, false);
    assert.equal((summary.body.summary as Record<string, unknown>).canRunLiveTests, false);
    assert.equal((summary.body.summary as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((summary.body.summary as Record<string, unknown>).envValuesExposed, false);
    assert.equal(liveReadiness.statusCode, 200);
    assert.equal((liveReadiness.body.readiness as Record<string, unknown>).status, "blocked_unsafe");
    assert.equal(liveChecks.statusCode, 200);
    assert.equal((liveChecks.body.checks as Array<Record<string, unknown>>).some((check) => check.checkKind === "test_path_safe" && check.status === "fail"), true);
    assert.equal(liveRunbook.statusCode, 200);
    assert.equal((liveRunbook.body.runbook as Record<string, unknown>).status, "metadata_only");
    assert.equal(liveSummary.statusCode, 200);
    assert.equal((liveSummary.body.summary as Record<string, unknown>).readinessStatus, "blocked_unsafe");
    assert.equal((liveSummary.body.runRecord as Record<string, unknown>).status, "blocked");
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).enabled, true);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).liveEnablementStatus, "blocked_unsafe");
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).canRunLiveValidation, false);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).productionVaultRolloutImplemented, false);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).canRunLiveTests, false);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).vaultAddressConfigured, true);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).vaultTokenConfigured, true);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).envValuesExposed, false);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).vaultTokenExposed, false);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).vaultAddressExposed, false);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).vaultSecretValueExposed, false);
    assert.equal((health.body.vaultIntegrationTests as Record<string, unknown>).vaultCallsInDefaultTests, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(liveWriteAttempt.statusCode, 405);
    assert.equal(hasVaultSecretOrEnvValue({ profile, testCases, safetyChecks, summary, liveReadiness, liveChecks, liveRunbook, liveSummary, health }), false);
  }, {
    AICHESTRA_VAULT_INTEGRATION_TESTS: "true",
    AICHESTRA_SECRET_BACKEND_PROVIDER: "vault",
    AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER: "true",
    AICHESTRA_VAULT_ADDR: "https://vault-it.example.invalid",
    AICHESTRA_VAULT_AUTH_METHOD: "token",
    AICHESTRA_VAULT_TOKEN: "hvs.vaultintegrationtest",
    AICHESTRA_VAULT_KV_MOUNT: "secret",
    AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES: "aichestra/prod",
    AICHESTRA_TEST_VAULT_SECRET_PATH: "aichestra/prod/customer-secret",
    AICHESTRA_TEST_VAULT_SECRET_KEY: "test-only-api-key-value"
  });
});

test("Vault integration-test dashboard panel renders gate, safety, path, and no-secret status", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/vault-integration");
    const panel = dashboard.body.vaultIntegration as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).defaultLiveTestsSkipped, true);
    assert.equal((panel.summary as Record<string, unknown>).vaultCallsInDefaultTests, false);
    assert.equal((panel.liveSummary as Record<string, unknown>).readinessStatus, "skipped");
    assert.equal((panel.liveSummary as Record<string, unknown>).productionVaultRolloutImplemented, false);
    assert.equal((panel.liveRunRecord as Record<string, unknown>).status, "skipped");
    assert.equal(Array.isArray(panel.liveChecks), true);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).envValuesExposed, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).vaultTokenExposed, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).vaultSecretValueExposed, false);
    assert.equal((panel.operationPolicy as Record<string, unknown>).noWrite, true);
    assert.equal((panel.operationPolicy as Record<string, unknown>).noDelete, true);
    assert.equal((panel.operationPolicy as Record<string, unknown>).noRotate, true);
    assert.equal((panel.operationPolicy as Record<string, unknown>).noBroadList, true);
    assert.equal((panel.gateStatus as Record<string, unknown>).vaultAddressConfigured, true);
    assert.equal((panel.gateStatus as Record<string, unknown>).vaultTokenConfigured, true);
    assert.equal((panel.gateStatus as Record<string, unknown>).rawPathReturned, false);
    assert.equal(Array.isArray(panel.testCases), true);
    assert.equal(Array.isArray(panel.gatedLiveTestCases), true);
    assert.equal(Array.isArray(panel.safetyChecks), true);
    assert.equal(hasVaultSecretOrEnvValue(dashboard), false);
  }, {
    AICHESTRA_VAULT_ADDR: "https://vault-it.example.invalid",
    AICHESTRA_VAULT_TOKEN: "hvs.vaultintegrationtest"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("Vault Integration Tests"), true);
  assert.equal(html.includes("Live enablement"), true);
  assert.equal(html.includes("Live checks"), true);
  assert.equal(html.includes("Forbidden behavior"), true);
  assert.equal(html.includes("broad list"), true);
  assert.equal(hasVaultSecretOrEnvValue(html), false);
});

const liveGateSummary = createDeploymentReadinessService({ env: process.env, now: () => fixedNow }).getVaultIntegrationTestReadinessSummary();

test("optional live Vault integration-test profile skeleton is skipped in default runs", {
  skip: liveGateSummary.canRunLiveTests
    ? "live Vault KV v2 execution is covered by the gated Vault backend v1 test"
    : `missing gates: ${liveGateSummary.missingRequiredEnvVars.join(",") || "unsafe gates present"}`
}, () => {
  assert.fail("Live Vault integration skeleton must never run in default tests.");
});

const liveEnablementSummary = createDeploymentReadinessService({ env: process.env, now: () => fixedNow }).getVaultLiveIntegrationSummary();

test("optional Vault live enablement validation skeleton is skipped in default runs", {
  skip: liveEnablementSummary.canRunLiveValidation
    ? "manual live validation is enabled only for an explicitly requested gated run"
    : `live readiness status: ${liveEnablementSummary.readinessStatus}`
}, () => {
  assert.fail("Vault live enablement skeleton must never run in default tests.");
});
