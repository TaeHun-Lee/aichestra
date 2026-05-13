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

function hasSecretOrEnvValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /sk-llm-it|AICHESTRA_LLM_API_KEY=|LLM_API_KEY=|OPENAI_API_KEY=|https:\/\/llm-it\.example\.invalid|Bearer\s+llm-it|raw-provider-response|prompt-secret|postgres:\/\/|DATABASE_URL=|AICHESTRA_DATABASE_URL=|AICHESTRA_TEST_DATABASE_URL=|SESSION_SECRET=|JWT_SECRET=|~\/\.codex|~\/\.claude|auth\.json|Google credential cache/i.test(text);
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

test("LLM integration-test readiness models are disabled by default and expose no secrets", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_LLM_API_KEY: "sk-llm-it-secret",
      AICHESTRA_LLM_BASE_URL: "https://llm-it.example.invalid/v1",
      SESSION_SECRET: "sk-llm-it-session"
    },
    now: () => fixedNow
  });

  const profile = service.getLLMIntegrationTestProfile();
  const testCases = service.listLLMIntegrationTestCases();
  const safetyChecks = service.listLLMIntegrationTestSafetyChecks();
  const modelChecks = service.listLLMIntegrationTestSafetyChecks({ category: "model_allowlist" });
  const summary = service.getLLMIntegrationTestReadinessSummary();

  assert.equal(profile.status, "disabled");
  assert.equal(profile.providerKind, "openai_compatible");
  assert.equal(profile.forbiddenOperations.includes("streaming"), true);
  assert.equal(profile.forbiddenOperations.includes("tool_calls"), true);
  assert.equal(profile.forbiddenOperations.includes("local_cli_provider_execution"), true);
  assert.equal(testCases.some((testCase) => testCase.category === "mock_completion" && testCase.enabledByDefault), true);
  assert.equal(testCases.some((testCase) => testCase.category === "remote_completion" && testCase.requiresRemoteLLM), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_streaming" && check.status === "pass"), true);
  assert.equal(modelChecks.every((check) => check.category === "model_allowlist"), true);
  assert.equal(summary.status, "v1_implemented");
  assert.equal(summary.planningOnly, true);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.liveTestsEnabled, false);
  assert.equal(summary.canRunLiveTests, false);
  assert.equal(summary.defaultLiveTestsSkipped, true);
  assert.equal(summary.secretRefConfigured, false);
  assert.equal(summary.rawEnvApiKeyConfigured, true);
  assert.equal(summary.credentialSource, "test_env");
  assert.equal(summary.baseUrlConfigured, true);
  assert.equal(summary.noStreaming, true);
  assert.equal(summary.noToolCalls, true);
  assert.equal(summary.noVendorCli, true);
  assert.equal(summary.noCredentialCacheRead, true);
  assert.equal(summary.noSecretsExposed, true);
  assert.equal(summary.envValuesExposed, false);
  assert.equal(summary.apiKeyExposed, false);
  assert.equal(summary.rawProviderResponseExposed, false);
  assert.equal(summary.remoteLlmCallsInDefaultTests, false);
  assert.equal(hasSecretOrEnvValue({ profile, testCases, safetyChecks, summary }), false);
});

test("LLM integration-test profile can become runnable only when all explicit gates are configured", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_LLM_INTEGRATION_TESTS: "true",
      AICHESTRA_LLM_PROVIDER: "openai_compatible",
      AICHESTRA_ENABLE_REMOTE_LLM: "true",
      AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION: "true",
      AICHESTRA_LLM_BASE_URL: "https://llm-it.example.invalid/v1",
      AICHESTRA_LLM_API_KEY_SECRET_REF: "secretref:llm-it",
      AICHESTRA_ENABLE_ENV_SECRET_PROVIDER: "true",
      AICHESTRA_ALLOWED_SECRET_ENV_KEYS: "AICHESTRA_LLM_API_KEY",
      AICHESTRA_LLM_ALLOWED_MODELS: "gpt-test-mini",
      AICHESTRA_LLM_DEFAULT_MODEL: "gpt-test-mini",
      AICHESTRA_LLM_ROUTING_MODE: "single_provider",
      AICHESTRA_ENABLE_LLM_FALLBACK: "false",
      AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS: "0",
      AICHESTRA_LLM_TEST_BUDGET_USD: "0.05",
      AICHESTRA_LLM_TEST_PROMPT_CLASS: "integration_smoke",
      AICHESTRA_LLM_API_KEY: undefined
    },
    now: () => fixedNow
  });

  const summary = service.getLLMIntegrationTestReadinessSummary();
  const profile = service.getLLMIntegrationTestProfile();
  const safetyChecks = service.listLLMIntegrationTestSafetyChecks();

  assert.equal(summary.liveTestsEnabled, true);
  assert.equal(summary.canRunLiveTests, true);
  assert.equal(summary.missingGateCount, 0);
  assert.equal(summary.unsafeGateCount, 0);
  assert.equal(summary.secretRefConfigured, true);
  assert.equal(summary.rawEnvApiKeyConfigured, false);
  assert.equal(summary.allowedSecretEnvKeyConfigured, true);
  assert.equal(summary.allowedModelCount, 1);
  assert.equal(summary.defaultModelAllowlisted, true);
  assert.equal(summary.budgetConfigured, true);
  assert.equal(summary.fallbackSafe, true);
  assert.equal(profile.status, "ready_if_configured");
  assert.deepEqual(profile.allowedModels, ["configured_model_allowlist_redacted"]);
  assert.equal(safetyChecks.every((check) => check.status === "pass"), true);
  assert.equal(hasSecretOrEnvValue({ summary, profile, safetyChecks }), false);
});

test("LLM integration-test readiness blocks unsafe provider, model, budget, fallback, streaming, and tool-call gates", () => {
  const service = createDeploymentReadinessService({
    env: {
      AICHESTRA_LLM_INTEGRATION_TESTS: "true",
      AICHESTRA_LLM_PROVIDER: "local_cli",
      AICHESTRA_ENABLE_REMOTE_LLM: "true",
      AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION: "true",
      AICHESTRA_LLM_BASE_URL: "https://llm-it.example.invalid/v1",
      AICHESTRA_LLM_API_KEY_SECRET_REF: "secretref:llm-it",
      AICHESTRA_LLM_ALLOWED_MODELS: "gpt-test-mini",
      AICHESTRA_LLM_DEFAULT_MODEL: "not-allowlisted",
      AICHESTRA_LLM_ROUTING_MODE: "single_provider",
      AICHESTRA_ENABLE_LLM_FALLBACK: "true",
      AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS: "2",
      AICHESTRA_LLM_TEST_BUDGET_USD: "25",
      AICHESTRA_LLM_TEST_PROMPT_CLASS: "integration_smoke",
      AICHESTRA_ENABLE_LLM_STREAMING: "true",
      AICHESTRA_ENABLE_LLM_TOOL_CALLS: "true",
      AICHESTRA_LLM_CREDENTIAL_CACHE_PATH: "~/.codex/auth.json"
    },
    now: () => fixedNow
  });

  const summary = service.getLLMIntegrationTestReadinessSummary();
  const safetyChecks = service.listLLMIntegrationTestSafetyChecks();

  assert.equal(summary.canRunLiveTests, false);
  assert.equal(summary.unsafeGateWarnings.includes("provider_kind_not_openai_compatible"), true);
  assert.equal(summary.unsafeGateWarnings.includes("default_model_not_allowlisted"), true);
  assert.equal(summary.unsafeGateWarnings.includes("budget_cap_exceeds_profile_limit"), true);
  assert.equal(summary.unsafeGateWarnings.includes("fallback_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("fallback_attempts_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("streaming_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("tool_calls_enabled"), true);
  assert.equal(summary.unsafeGateWarnings.includes("credential_cache_reference_configured"), true);
  assert.equal(safetyChecks.some((check) => check.category === "model_allowlist" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "budget" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_streaming" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_tool_calls" && check.status === "fail"), true);
  assert.equal(safetyChecks.some((check) => check.category === "no_unbounded_fallback" && check.status === "fail"), true);
  assert.equal(hasSecretOrEnvValue({ summary, safetyChecks }), false);
});

test("LLM integration-test readiness APIs and health metadata are read-only and sanitized", async () => {
  await withApiServer(async (port) => {
    const profile = await getJson(port, "/readiness/llm-integration/profile");
    const testCases = await getJson(port, "/readiness/llm-integration/test-cases");
    const safetyChecks = await getJson(port, "/readiness/llm-integration/safety-checks?category=no_streaming");
    const summary = await getJson(port, "/readiness/llm-integration/summary");
    const health = await getJson(port, "/health");
    const writeAttempt = await postJson(port, "/readiness/llm-integration/summary");

    assert.equal(profile.statusCode, 200);
    assert.equal((profile.body.profile as Record<string, unknown>).providerKind, "openai_compatible");
    assert.equal(testCases.statusCode, 200);
    assert.equal((testCases.body.testCases as unknown[]).length > 0, true);
    assert.equal(safetyChecks.statusCode, 200);
    assert.equal((safetyChecks.body.safetyChecks as Array<Record<string, unknown>>).every((check) => check.category === "no_streaming"), true);
    assert.equal(summary.statusCode, 200);
    assert.equal((summary.body.summary as Record<string, unknown>).productionReady, false);
    assert.equal((summary.body.summary as Record<string, unknown>).canRunLiveTests, false);
    assert.equal((summary.body.summary as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((summary.body.summary as Record<string, unknown>).envValuesExposed, false);
    assert.equal(health.statusCode, 200);
    assert.equal((health.body.llmIntegrationTests as Record<string, unknown>).enabled, true);
    assert.equal((health.body.llmIntegrationTests as Record<string, unknown>).canRunLiveTests, false);
    assert.equal((health.body.llmIntegrationTests as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((health.body.llmIntegrationTests as Record<string, unknown>).envValuesExposed, false);
    assert.equal((health.body.llmIntegrationTests as Record<string, unknown>).apiKeyExposed, false);
    assert.equal((health.body.llmIntegrationTests as Record<string, unknown>).rawProviderResponseExposed, false);
    assert.equal(writeAttempt.statusCode, 405);
    assert.equal(hasSecretOrEnvValue({ profile, testCases, safetyChecks, summary, health }), false);
  }, {
    AICHESTRA_LLM_INTEGRATION_TESTS: "true",
    AICHESTRA_ENABLE_LLM_STREAMING: "true",
    AICHESTRA_LLM_API_KEY: "sk-llm-it-secret",
    AICHESTRA_LLM_BASE_URL: "https://llm-it.example.invalid/v1",
    SESSION_SECRET: "sk-llm-it-session"
  });
});

test("LLM integration-test dashboard panel renders skip, safety, model, budget, and no-secret status", async () => {
  await withApiServer(async (port) => {
    const dashboard = await getJson(port, "/dashboard/llm-integration");
    const panel = dashboard.body.llmIntegration as Record<string, unknown>;

    assert.equal(dashboard.statusCode, 200);
    assert.equal((panel.summary as Record<string, unknown>).productionReady, false);
    assert.equal((panel.summary as Record<string, unknown>).defaultLiveTestsSkipped, true);
    assert.equal((panel.summary as Record<string, unknown>).remoteLlmCallsInDefaultTests, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).noSecretsExposed, true);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).envValuesExposed, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).apiKeyExposed, false);
    assert.equal((panel.noSecretStatus as Record<string, unknown>).rawProviderResponseExposed, false);
    assert.equal((panel.gateStatus as Record<string, unknown>).providerKind, "openai_compatible");
    assert.equal(Array.isArray(panel.testCases), true);
    assert.equal(Array.isArray(panel.gatedLiveTestCases), true);
    assert.equal(Array.isArray(panel.safetyChecks), true);
    assert.equal(hasSecretOrEnvValue(dashboard), false);
  }, {
    AICHESTRA_LLM_API_KEY: "sk-llm-it-secret",
    AICHESTRA_LLM_BASE_URL: "https://llm-it.example.invalid/v1"
  });

  const html = await renderDashboardHtml(new DemoDashboardDataProvider());
  assert.equal(html.includes("LLM Integration Tests"), true);
  assert.equal(html.includes("Forbidden behavior"), true);
  assert.equal(html.includes("openai_compatible"), true);
  assert.equal(hasSecretOrEnvValue(html), false);
});

const liveGateSummary = createDeploymentReadinessService({ env: process.env, now: () => fixedNow }).getLLMIntegrationTestReadinessSummary();

test("optional live LLM integration test skeleton is skipped in default runs", {
  skip: liveGateSummary.canRunLiveTests
    ? "live LLM provider execution is intentionally not implemented in this profile skeleton"
    : `missing gates: ${liveGateSummary.missingRequiredEnvVars.join(",") || "unsafe gates present"}`
}, () => {
  assert.fail("Live LLM integration skeleton must never run in default tests.");
});
