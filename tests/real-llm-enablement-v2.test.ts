import test from "node:test";
import assert from "node:assert/strict";
import { createSeededStore } from "@aichestra/db";
import {
  InMemoryVirtualModelKeyRepository,
  LLMGatewayService,
  OpenAICompatibleLLMProvider,
  createLlmProviderConfigFromEnv,
  evaluateRealLlmEnablement,
  type LLMProviderRuntimeConfig,
  type VirtualModelKey
} from "@aichestra/llm-gateway";

// Phase 2: a consolidated fail-closed preflight for issuing real (non-mock)
// LLM completions, plus opt-in enforcement before the provider is ever called.

function readyRemoteConfig(overrides: Partial<LLMProviderRuntimeConfig> = {}): LLMProviderRuntimeConfig {
  return {
    ...createLlmProviderConfigFromEnv({}),
    providerKind: "openai_compatible",
    routingMode: "single_provider",
    fallbackEnabled: false,
    remoteLlmEnabled: true,
    remoteCompletionEnabled: true,
    openAICompatibleConfigured: true,
    baseUrlConfigured: true,
    apiKeyConfigured: true,
    credentialSource: "secret_ref",
    credentialStatus: "resolved",
    allowedModels: ["gpt-test"],
    allowedModelCount: 1,
    defaultModel: "gpt-test",
    defaultModelConfigured: true,
    ...overrides
  } as LLMProviderRuntimeConfig;
}

const budgetKey = { id: "vmk_system_mock", monthlyBudgetUsd: 100, perTaskBudgetUsd: 5 };

function remoteVirtualKey(): VirtualModelKey {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "vmk_remote_openai_fixture_v2",
    ownerKind: "system",
    ownerId: "system",
    displayName: "Remote OpenAI fixture",
    allowedProviderKinds: ["openai_compatible"],
    allowedModelIds: ["openai-compatible/default"],
    perTaskBudgetUsd: 10,
    monthlyBudgetUsd: 100,
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

function okHttpClient() {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      async postJson(request: unknown) {
        calls.push(request);
        return {
          ok: true,
          status: 200,
          body: {
            id: "chatcmpl_enablement",
            choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 }
          }
        };
      }
    }
  };
}

test("evaluateRealLlmEnablement: mock provider is never a real path", () => {
  const readiness = evaluateRealLlmEnablement({ config: createLlmProviderConfigFromEnv({}) });
  assert.equal(readiness.remotePathApplicable, false);
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.blockers, ["provider_is_mock"]);
});

test("evaluateRealLlmEnablement: a fully configured remote path with a budget cap is ready", () => {
  const readiness = evaluateRealLlmEnablement({ config: readyRemoteConfig(), budgetVirtualKey: budgetKey });
  assert.equal(readiness.remotePathApplicable, true);
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.blockers, []);
  assert.equal(readiness.metadata.containsSecretMaterial, false);
});

test("evaluateRealLlmEnablement: each missing safety gate becomes a blocker", () => {
  const noBudget = evaluateRealLlmEnablement({ config: readyRemoteConfig() });
  assert.equal(noBudget.ready, false);
  assert.ok(noBudget.blockers.includes("budget_cap_configured"));

  const noCredential = evaluateRealLlmEnablement({ config: readyRemoteConfig({ credentialStatus: "missing" }), budgetVirtualKey: budgetKey });
  assert.equal(noCredential.ready, false);
  assert.ok(noCredential.blockers.includes("credential_resolved"));

  const fallbackOn = evaluateRealLlmEnablement({ config: readyRemoteConfig({ fallbackEnabled: true }), budgetVirtualKey: budgetKey });
  assert.equal(fallbackOn.ready, false);
  assert.ok(fallbackOn.blockers.includes("fallback_disabled"));

  const noModels = evaluateRealLlmEnablement({ config: readyRemoteConfig({ allowedModelCount: 0, allowedModels: [] }), budgetVirtualKey: budgetKey });
  assert.equal(noModels.ready, false);
  assert.ok(noModels.blockers.includes("model_allowlist_present"));
});

test("evaluateRealLlmEnablement: legacy env credential is a warning, not a blocker", () => {
  const readiness = evaluateRealLlmEnablement({ config: readyRemoteConfig({ credentialSource: "legacy_env" }), budgetVirtualKey: budgetKey });
  assert.equal(readiness.ready, true);
  assert.ok(readiness.warnings.includes("credential_via_secret_ref"));
});

test("gateway reports ready for a fully configured remote gateway with a system budget key", () => {
  const service = new LLMGatewayService({
    config: readyRemoteConfig(),
    provider: new OpenAICompatibleLLMProvider({
      remoteLlmEnabled: true,
      remoteCompletionEnabled: true,
      baseUrl: "https://llm.example/v1",
      apiKey: "test-api-key",
      allowedModels: ["gpt-test"],
      defaultModel: "gpt-test",
      httpClient: okHttpClient().client
    })
  });
  const readiness = service.getRealLlmEnablementReadiness();
  assert.equal(readiness.providerKind, "openai_compatible");
  assert.equal(readiness.ready, true);
  assert.equal(JSON.stringify(readiness).includes("test-api-key"), false);
});

test("enforcement blocks the real provider call when the preflight is not ready", async () => {
  const { client, calls } = okHttpClient();
  const provider = new OpenAICompatibleLLMProvider({
    remoteLlmEnabled: true,
    remoteCompletionEnabled: true,
    baseUrl: "https://llm.example/v1",
    apiKey: "test-api-key",
    allowedModels: ["gpt-test"],
    defaultModel: "gpt-test",
    httpClient: client
  });
  // The custom key repository lacks the system budget key, so the preflight is
  // not ready (no budget cap anchor) even though the request itself is valid.
  const blocked = await new LLMGatewayService({
    config: readyRemoteConfig(),
    provider,
    virtualKeyRepository: new InMemoryVirtualModelKeyRepository([remoteVirtualKey()]),
    usageRepository: createSeededStore(),
    enforceRealLlmEnablement: true
  }).routeCompletion({
    taskId: "task_block",
    taskRunId: "run_block",
    providerKind: "openai_compatible",
    modelRef: "openai-compatible/default",
    virtualKeyId: "vmk_remote_openai_fixture_v2",
    prompt: "Remote request",
    budgetLimitUsd: 1
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "real_llm_enablement_not_ready");
  assert.equal(calls.length, 0, "provider must not be called when enablement is not ready");
});

test("enforcement disabled (default) preserves the existing remote completion path", async () => {
  const { client, calls } = okHttpClient();
  const ok = await new LLMGatewayService({
    config: readyRemoteConfig(),
    provider: new OpenAICompatibleLLMProvider({
      remoteLlmEnabled: true,
      remoteCompletionEnabled: true,
      baseUrl: "https://llm.example/v1",
      apiKey: "test-api-key",
      allowedModels: ["gpt-test"],
      defaultModel: "gpt-test",
      httpClient: client
    }),
    virtualKeyRepository: new InMemoryVirtualModelKeyRepository([remoteVirtualKey()]),
    usageRepository: createSeededStore()
  }).routeCompletion({
    taskId: "task_ok",
    taskRunId: "run_ok",
    providerKind: "openai_compatible",
    modelRef: "openai-compatible/default",
    virtualKeyId: "vmk_remote_openai_fixture_v2",
    prompt: "Remote request",
    budgetLimitUsd: 1
  });
  assert.equal(ok.ok, true);
  assert.equal(calls.length, 1);
});
