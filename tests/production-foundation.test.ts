import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  createApiServerWithStorage,
  createApiStorageProviderFromEnv,
  evaluateProductionFoundation,
  runtimeProfileFromEnv
} from "@aichestra/api";
import { createInMemoryStorageProvider, createSeededStore } from "@aichestra/db";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hasSecretMaterial(value: unknown): boolean {
  return /production-test-token|Bearer\s+[A-Za-z0-9._~+/=-]+|AICHESTRA_AUTH_BEARER_TOKEN|AICHESTRA_VAULT_TOKEN/i.test(JSON.stringify(value));
}

function getJson(port: number, path: string, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8"))
        });
      });
    });
    request.on("error", reject);
  });
}

function runNodeScript(script: string, env: Record<string, string>): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...env
      }
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    child.on("error", reject);
    child.on("exit", (status) => {
      resolve({
        status,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
}

test("production foundation evaluation blocks mock defaults in production and is ready when phase 1-3 gates are configured", () => {
  const blocked = evaluateProductionFoundation({
    env: { AICHESTRA_RUNTIME_PROFILE: "production" },
    storageKind: "in_memory",
    storageHealth: {
      kind: "in_memory",
      healthy: true,
      message: "ok",
      checkedAt: new Date("2026-01-01T00:00:00.000Z")
    },
    authConfig: {
      providerKind: "mock",
      productionAuthEnabled: false,
      tokenValidationEnabled: false
    },
    securityConfig: {
      secretBackendProviderSelected: "mock",
      vaultSecretProviderEnabled: false,
      vaultLiveUsageReady: false,
      envFallbackProductionAllowed: false
    }
  });

  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.blockers.includes("phase1_auth:production_auth_disabled"), true);
  assert.equal(blocked.blockers.includes("phase2_secrets:vault_backend_required"), true);
  assert.equal(blocked.blockers.includes("phase3_storage:postgres_required"), true);

  const ready = evaluateProductionFoundation({
    env: {
      AICHESTRA_RUNTIME_PROFILE: "production",
      AICHESTRA_AUTH_STATIC_ACTOR_ID: "mock-admin",
      AICHESTRA_AUTH_STATIC_ALLOWED_ACTORS: "mock-admin",
      AICHESTRA_AUTH_OIDC_MIGRATION_PLAN_ACK: "true",
      AICHESTRA_DATABASE_MIGRATIONS_APPLIED: "true",
      AICHESTRA_DATABASE_BACKUP_RESTORE_RUNBOOK_ACK: "true",
      AICHESTRA_AUDIT_DURABLE_STORAGE: "postgres",
      AICHESTRA_AUDIT_RETENTION_POLICY_ACK: "true"
    },
    storageKind: "postgres",
    storageHealth: {
      kind: "postgres",
      healthy: true,
      message: "ok",
      checkedAt: new Date("2026-01-01T00:00:00.000Z")
    },
    authConfig: {
      providerKind: "static_bearer",
      productionAuthEnabled: true,
      tokenValidationEnabled: true
    },
    securityConfig: {
      secretBackendProviderSelected: "vault",
      vaultSecretProviderEnabled: true,
      vaultLiveUsageReady: true,
      vaultAllowedPathPrefixCount: 1,
      activeVaultSecretRefCount: 1,
      envFallbackProductionAllowed: false
    }
  });

  assert.equal(ready.status, "ready");
  assert.equal(ready.operationalStatus, "ready");
  assert.deepEqual(ready.blockers, []);
});

test("static bearer auth resolves API request contexts without exposing bearer tokens", async () => {
  const token = "production-test-token";
  const storage = createInMemoryStorageProvider({ store: createSeededStore(), repoRoot: process.cwd() });
  const server = createApiServerWithStorage(storage, {
    env: {
      AICHESTRA_RUNTIME_PROFILE: "test",
      AICHESTRA_AUTH_PROVIDER: "static_bearer",
      AICHESTRA_AUTH_BEARER_TOKEN_SHA256: sha256(token),
      AICHESTRA_AUTH_STATIC_ACTOR_ID: "mock-admin",
      AICHESTRA_AUTH_STATIC_ALLOWED_ACTORS: "mock-admin"
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const headers = {
      authorization: `Bearer ${token}`,
      "x-aichestra-request-id": "req_static_bearer_auth_v1",
      "x-aichestra-correlation-id": "corr_static_bearer_auth_v1"
    };
    const me = await getJson(port, "/auth/me", headers);
    const config = await getJson(port, "/auth/config", headers);
    const readiness = await getJson(port, "/readiness/production-foundation", headers);
    const denied = await getJson(port, "/auth/me");

    assert.equal(me.statusCode, 200);
    assert.equal(((me.body.authContext as Record<string, unknown>).authMode), "static_bearer");
    assert.equal(((me.body.authContext as Record<string, unknown>).authenticated), true);
    assert.equal(((me.body.requestContext as Record<string, unknown>).productionAuthEnabled), true);
    assert.equal(((me.body.requestContext as Record<string, unknown>).tokenValidationEnabled), true);
    assert.equal(config.body.productionAuthEnabled, true);
    assert.equal(config.body.tokenValidationEnabled, true);
    assert.equal(((readiness.body.summary as Record<string, unknown>).status), "not_required");
    assert.equal(denied.statusCode, 403);
    assert.equal(hasSecretMaterial({ me, config, readiness, denied }), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("production foundation smoke script checks health, readiness, and auth without printing tokens", async () => {
  const token = "production-test-token";
  const storage = createInMemoryStorageProvider({ store: createSeededStore(), repoRoot: process.cwd() });
  const server = createApiServerWithStorage(storage, {
    env: {
      AICHESTRA_RUNTIME_PROFILE: "test",
      AICHESTRA_AUTH_PROVIDER: "static_bearer",
      AICHESTRA_AUTH_BEARER_TOKEN_SHA256: sha256(token),
      AICHESTRA_AUTH_STATIC_ACTOR_ID: "mock-admin",
      AICHESTRA_AUTH_STATIC_ALLOWED_ACTORS: "mock-admin"
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const result = await runNodeScript("scripts/production-foundation-smoke.mjs", {
      AICHESTRA_API_BASE_URL: `http://127.0.0.1:${port}`,
      AICHESTRA_AUTH_BEARER_TOKEN: token
    });

    assert.equal(result.status, 0);
    assert.equal(result.stdout.includes("production_foundation"), true);
    assert.equal(hasSecretMaterial({ stdout: result.stdout, stderr: result.stderr }), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("production runtime rejects unsafe storage and incomplete phase gates before serving", () => {
  assert.equal(runtimeProfileFromEnv({ APP_RUNTIME_PROFILE: "prod" }), "production");
  assert.throws(
    () => createApiStorageProviderFromEnv({ AICHESTRA_RUNTIME_PROFILE: "production" }),
    /AICHESTRA_STORAGE_PROVIDER=postgres/
  );

  const storage = createInMemoryStorageProvider({ store: createSeededStore(), repoRoot: process.cwd() });
  assert.throws(
    () => createApiServerWithStorage(storage, {
      env: {
        AICHESTRA_RUNTIME_PROFILE: "production",
        AICHESTRA_AUTH_PROVIDER: "static_bearer",
        AICHESTRA_AUTH_BEARER_TOKEN_SHA256: sha256("production-test-token"),
        AICHESTRA_AUTH_STATIC_ACTOR_ID: "mock-admin",
        AICHESTRA_AUTH_STATIC_ALLOWED_ACTORS: "mock-admin",
        AICHESTRA_SECRET_BACKEND_PROVIDER: "vault",
        AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER: "true",
        AICHESTRA_VAULT_ADDR: "http://127.0.0.1:8200",
        AICHESTRA_VAULT_TOKEN: "configured-but-not-exposed",
        AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES: "secret/data/aichestra/"
      }
    }),
    /production_foundation_blocked:.*phase3_storage:postgres_required/
  );
});
