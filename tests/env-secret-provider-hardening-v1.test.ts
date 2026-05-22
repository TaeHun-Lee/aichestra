import test from "node:test";
import assert from "node:assert/strict";
import { EnvSecretProvider } from "@aichestra/security";
import type { SecretRef } from "@aichestra/security";

// Hardening guarantees for the pilot's only active secret path (env-backed
// SecretRefs). The provider must expose key names/counts for readiness surfaces
// but never the secret value, must fail closed without an allowlist, and must
// only return a value through resolve() for an enabled, allowlisted key.

const SECRET = "sk-pilot-real-llm-key-DO-NOT-LEAK";

function llmKeyRef(): SecretRef {
  return {
    id: "secretref_env_hardening",
    name: "Pilot LLM API key",
    provider: "env",
    secretKind: "llm_api_key",
    envKey: "AICHESTRA_LLM_API_KEY",
    scope: "scope_env_hardening",
    status: "active",
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

test("getConfig exposes key names and counts but never the secret value", () => {
  const provider = new EnvSecretProvider({
    enabled: true,
    allowedEnvKeys: ["AICHESTRA_LLM_API_KEY"],
    env: { AICHESTRA_LLM_API_KEY: SECRET }
  });
  const config = provider.getConfig();
  assert.equal(config.enabled, true);
  assert.deepEqual(config.allowedEnvKeys, ["AICHESTRA_LLM_API_KEY"]);
  assert.equal(config.allowedEnvKeyCount, 1);
  assert.equal(JSON.stringify(config).includes(SECRET), false);
});

test("provider fails closed when enabled without an allowlist", () => {
  const result = new EnvSecretProvider({
    enabled: true,
    allowedEnvKeys: [],
    env: { AICHESTRA_LLM_API_KEY: SECRET }
  }).resolve(llmKeyRef());
  assert.equal(result.ok, false);
  assert.equal(result.status, "denied");
  assert.equal(result.reason, "env_allowlist_empty");
  assert.equal(result.value, undefined);
});

test("value is returned only for an enabled, allowlisted key and never otherwise", () => {
  const env = { AICHESTRA_LLM_API_KEY: SECRET };
  const ref = llmKeyRef();

  const disabled = new EnvSecretProvider({ env }).resolve(ref);
  assert.equal(disabled.ok, false);
  assert.equal(disabled.value, undefined);

  const wrongKey = new EnvSecretProvider({ enabled: true, allowedEnvKeys: ["AICHESTRA_GITHUB_TOKEN"], env }).resolve(ref);
  assert.equal(wrongKey.ok, false);
  assert.equal(wrongKey.reason, "env_key_not_allowlisted");
  assert.equal(wrongKey.value, undefined);

  const ok = new EnvSecretProvider({ enabled: true, allowedEnvKeys: ["AICHESTRA_LLM_API_KEY"], env }).resolve(ref);
  assert.equal(ok.ok, true);
  assert.equal(ok.status, "resolved");
  assert.equal(ok.value, SECRET);
});
