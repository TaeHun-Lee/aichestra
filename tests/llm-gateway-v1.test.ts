import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServerWithStorage } from "@aichestra/api";
import { createInMemoryStorageProvider, createSeededStore } from "@aichestra/db";
import { createDeploymentReadinessService } from "@aichestra/deployment-readiness";
import {
  InMemoryVirtualModelKeyRepository,
  LLMGatewayService,
  OpenAICompatibleLLMProvider,
  type OpenAICompatibleHttpClient,
  createDefaultLlmGatewayService
} from "@aichestra/llm-gateway";
import type { LLMProviderRuntimeConfig, VirtualModelKey } from "@aichestra/llm-gateway";

function remoteConfig(input: Partial<LLMProviderRuntimeConfig> = {}): LLMProviderRuntimeConfig {
  return {
    providerKind: "openai_compatible",
    routingMode: "single_provider",
    fallbackEnabled: false,
    maxFallbackAttempts: 0,
    allowedProviderKinds: [],
    allowedProviderIds: [],
    deniedProviderIds: [],
    deniedModels: [],
    remoteLlmEnabled: true,
    remoteCompletionEnabled: true,
    openAICompatibleConfigured: true,
    baseUrlConfigured: true,
    apiKeyConfigured: true,
    allowedModels: ["gpt-test"],
    allowedModelCount: 1,
    defaultModel: "gpt-test",
    defaultModelConfigured: true,
    apiKeySecretRef: undefined,
    credentialSource: "legacy_env",
    credentialStatus: "resolved",
    credentialReason: "test_fixture_api_key_configured",
    envSecretProviderEnabled: false,
    allowedSecretEnvKeyCount: 0,
    integrationTestsEnabled: false,
    ...input
  } as LLMProviderRuntimeConfig;
}

function remoteVirtualKey(): VirtualModelKey {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "vmk_remote_openai_fixture",
    ownerKind: "system",
    ownerId: "system",
    displayName: "Remote OpenAI-compatible Fixture Key",
    allowedProviderKinds: ["openai_compatible"],
    allowedModelIds: ["openai-compatible/default"],
    perTaskBudgetUsd: 10,
    monthlyBudgetUsd: 100,
    rpmLimit: 60,
    tpmLimit: 100000,
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

function createMockHttpClient(input: { ok?: boolean; throwTimeout?: boolean } = {}) {
  const calls: unknown[] = [];
  const client: OpenAICompatibleHttpClient = {
    async postJson(request) {
      calls.push(request);
      if (input.throwTimeout) {
        const error = new Error("timeout");
        error.name = "AbortError";
        throw error;
      }
      if (input.ok === false) {
        return {
          ok: false,
          status: 401,
          body: { error: { message: "bad token sk-should-redact" } }
        };
      }
      return {
        ok: true,
        status: 200,
        body: {
          id: "chatcmpl_fixture",
          choices: [{ message: { content: "remote answer OPENAI_API_KEY=sk-remote-secret" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 11, completion_tokens: 7 }
        }
      };
    }
  };
  return { client, calls };
}

function createRemoteGateway(httpClient: OpenAICompatibleHttpClient, config: LLMProviderRuntimeConfig = remoteConfig(), usageRepository?: ReturnType<typeof createSeededStore>) {
  return new LLMGatewayService({
    config,
    provider: new OpenAICompatibleLLMProvider({
      remoteLlmEnabled: true,
      remoteCompletionEnabled: true,
      baseUrl: "https://llm.example/v1",
      apiKey: "test-api-key",
      allowedModels: config.allowedModels,
      defaultModel: config.defaultModel,
      httpClient
    }),
    virtualKeyRepository: new InMemoryVirtualModelKeyRepository([remoteVirtualKey()]),
    usageRepository
  });
}

function getJson(port: number, requestPath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, requestPath: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: requestPath,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized)
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(serialized);
  });
}

function hasUnsafeSecret(value: unknown): boolean {
  const text = JSON.stringify(value);
  return text.includes("test-api-key") || text.includes("sk-remote-secret") || text.includes("sk-should-redact");
}

test("LLM Gateway v1 config gates block remote calls before HTTP by default", async () => {
  const { client, calls } = createMockHttpClient();
  const provider = new OpenAICompatibleLLMProvider({ httpClient: client });
  const completion = await provider.createCompletion({
    taskId: "task_remote_default",
    taskRunId: "run_remote_default",
    prompt: "blocked"
  }, {
    id: "openai-compatible/default",
    providerKind: "openai_compatible",
    displayName: "OpenAI-compatible Default",
    contextWindow: 128000,
    supportsTools: true,
    supportsStreaming: false,
    status: "active",
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  });

  assert.equal(completion.ok, false);
  assert.equal(completion.reason, "blocked_remote_llm_disabled");
  assert.equal(calls.length, 0);
});

test("OpenAI-compatible provider normalizes completion, usage, errors, timeout, and allowlist blocks", async () => {
  const { client, calls } = createMockHttpClient();
  const provider = new OpenAICompatibleLLMProvider({
    remoteLlmEnabled: true,
    remoteCompletionEnabled: true,
    baseUrl: "https://llm.example/v1",
    apiKey: "test-api-key",
    allowedModels: ["gpt-test"],
    defaultModel: "gpt-test",
    httpClient: client
  });
  const model = {
    id: "openai-compatible/default",
    providerKind: "openai_compatible" as const,
    displayName: "OpenAI-compatible Default",
    contextWindow: 128000,
    supportsTools: true,
    supportsStreaming: false,
    inputTokenCostUsd: 0.000003,
    outputTokenCostUsd: 0.000006,
    status: "active" as const,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const completion = await provider.createCompletion({ taskId: "task_remote", taskRunId: "run_remote", prompt: "hello", maxTokens: 16 }, model);
  assert.equal(completion.ok, true);
  assert.equal(completion.result?.providerKind, "openai_compatible");
  assert.equal(completion.result?.inputTokens, 11);
  assert.equal(completion.result?.outputTokens, 7);
  assert.equal(completion.result?.content.includes("sk-remote-secret"), false);
  assert.equal(calls.length, 1);

  const missingKey = await new OpenAICompatibleLLMProvider({
    remoteLlmEnabled: true,
    remoteCompletionEnabled: true,
    baseUrl: "https://llm.example/v1",
    httpClient: client
  }).createCompletion({ taskId: "task_remote", taskRunId: "run_remote", prompt: "hello" }, model);
  assert.equal(missingKey.reason, "openai_compatible_config_missing");

  const allowlistBlocked = await new OpenAICompatibleLLMProvider({
    remoteLlmEnabled: true,
    remoteCompletionEnabled: true,
    baseUrl: "https://llm.example/v1",
    apiKey: "test-api-key",
    allowedModels: ["not-gpt-test"],
    defaultModel: "gpt-test",
    httpClient: client
  }).createCompletion({ taskId: "task_remote", taskRunId: "run_remote", prompt: "hello" }, model);
  assert.equal(allowlistBlocked.reason, "model_not_allowlisted");

  const error = await new OpenAICompatibleLLMProvider({
    remoteLlmEnabled: true,
    remoteCompletionEnabled: true,
    baseUrl: "https://llm.example/v1",
    apiKey: "test-api-key",
    allowedModels: ["gpt-test"],
    defaultModel: "gpt-test",
    httpClient: createMockHttpClient({ ok: false }).client
  }).createCompletion({ taskId: "task_remote", taskRunId: "run_remote", prompt: "hello" }, model);
  assert.equal(error.ok, false);
  assert.equal(error.reason?.includes("openai_compatible_http_401"), true);
  assert.equal(error.reason?.includes("sk-should-redact"), false);

  const timeout = await new OpenAICompatibleLLMProvider({
    remoteLlmEnabled: true,
    remoteCompletionEnabled: true,
    baseUrl: "https://llm.example/v1",
    apiKey: "test-api-key",
    allowedModels: ["gpt-test"],
    defaultModel: "gpt-test",
    httpClient: createMockHttpClient({ throwTimeout: true }).client
  }).createCompletion({ taskId: "task_remote", taskRunId: "run_remote", prompt: "hello" }, model);
  assert.equal(timeout.reason, "openai_compatible_timeout");
});

test("LLM Gateway v1 records remote usage and sanitized audit through mocked HTTP client", async () => {
  const store = createSeededStore();
  const task = store.createTask({ title: "Remote LLM task", repoId: "repo_demo_backend", baseBranch: "main" });
  const taskRun = store.createTaskRun({ taskId: task.id, attempt: 1, status: "running", agent: "codex", model: "openai-compatible/default" });
  const { client, calls } = createMockHttpClient();
  const service = new LLMGatewayService({
    config: remoteConfig(),
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
    usageRepository: store
  });

  const completion = await service.routeCompletion({
    taskId: task.id,
    taskRunId: taskRun.id,
    actorId: task.requesterUserId,
    modelRef: "openai-compatible/default",
    virtualKeyId: "vmk_remote_openai_fixture",
    providerId: "openai-api-key",
    prompt: "Please answer. Bearer hidden-token",
    budgetLimitUsd: 1
  });

  assert.equal(completion.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(completion.result?.content.includes("sk-remote-secret"), false);
  assert.equal(completion.usageEvent?.taskId, task.id);
  assert.equal(completion.usageEvent?.taskRunId, taskRun.id);
  assert.equal(completion.usageEvent?.provider, "openai_compatible");
  assert.equal(completion.usageEvent?.model, "openai-compatible/default");
  assert.equal(completion.usageEvent?.metadata?.provider_id, "openai-api-key");
  assert.equal(service.listAuditEvents().some((event) => event.eventType === "llm_remote_completion_requested"), true);
  assert.equal(service.listAuditEvents().some((event) => event.eventType === "llm_remote_completion_completed"), true);
  assert.equal(service.listAuditEvents().some((event) => event.eventType === "llm_output_redacted"), true);
  assert.equal(hasUnsafeSecret(service.listAuditEvents()), false);
});

test("policy and budget blocks occur before mocked HTTP client is called", async () => {
  const { client, calls } = createMockHttpClient();
  const service = createRemoteGateway(client, remoteConfig({ remoteCompletionEnabled: false }));

  const policyBlocked = await service.routeCompletion({
    taskId: "task_policy_block",
    taskRunId: "run_policy_block",
    modelRef: "openai-compatible/default",
    virtualKeyId: "vmk_remote_openai_fixture",
    prompt: "remote denied",
    budgetLimitUsd: 1
  });
  assert.equal(policyBlocked.ok, false);
  assert.equal(calls.length, 0);
  assert.equal(service.listAuditEvents().some((event) => event.eventType === "llm_policy_blocked"), true);

  const budgetBlocked = await createRemoteGateway(client).routeCompletion({
    taskId: "task_budget_block",
    taskRunId: "run_budget_block",
    modelRef: "openai-compatible/default",
    virtualKeyId: "vmk_remote_openai_fixture",
    prompt: "remote denied by budget",
    budgetLimitUsd: 0
  });
  assert.equal(budgetBlocked.ok, false);
  assert.equal(calls.length, 0);
});

test("LLM API and dashboard expose remote flags and mocked remote completion without secrets", async () => {
  const store = createSeededStore();
  const storage = createInMemoryStorageProvider({ store, repoRoot: process.cwd() });
  const { client } = createMockHttpClient();
  const llmGatewayService = createRemoteGateway(client, remoteConfig(), store);
  const server = createApiServerWithStorage(storage, { llmGatewayService });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health") as { llm: Record<string, unknown> };
    assert.equal(health.llm.providerKind, "openai_compatible");
    assert.equal(health.llm.remoteLlmEnabled, true);
    assert.equal(health.llm.remoteCompletionEnabled, true);
    assert.equal(health.llm.apiKeyConfigured, true);
    assert.equal(hasUnsafeSecret(health), false);

    const config = await getJson(address.port, "/llm/config");
    assert.equal(hasUnsafeSecret(config), false);

    const completion = await postJson(address.port, "/llm/completions", {
      taskId: "task_api_remote",
      taskRunId: "run_api_remote",
      modelRef: "openai-compatible/default",
      virtualKeyId: "vmk_remote_openai_fixture",
      providerId: "openai-api-key",
      prompt: "remote via API",
      budgetLimitUsd: 1
    });
    assert.equal(completion.statusCode, 201);
    assert.equal((completion.body.result as { providerKind: string }).providerKind, "openai_compatible");
    assert.equal(hasUnsafeSecret(completion.body), false);

    const dashboard = await getJson(address.port, "/dashboard/llm") as { llm: { config: Record<string, unknown>; usageEvents: unknown[]; auditEvents: unknown[]; budget: Record<string, unknown> } };
    assert.equal(dashboard.llm.config.remoteLlmEnabled, true);
    assert.equal(dashboard.llm.config.apiKeyConfigured, true);
    assert.equal(dashboard.llm.usageEvents.length > 0, true);
    assert.equal(dashboard.llm.auditEvents.length > 0, true);
    assert.equal(dashboard.llm.budget.apiKeyExposed, false);
    assert.equal(hasUnsafeSecret(dashboard), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

const llmIntegrationReadiness = createDeploymentReadinessService({ env: process.env }).getLLMIntegrationTestReadinessSummary();
const canRunLegacyRemoteLLMTest = llmIntegrationReadiness.canRunLiveTests &&
  typeof process.env.AICHESTRA_LLM_API_KEY === "string" &&
  process.env.AICHESTRA_LLM_API_KEY.trim().length > 0;

test("optional real remote LLM integration is skipped unless every explicit gate is set", {
  skip: canRunLegacyRemoteLLMTest
    ? false
    : `remote LLM integration env vars are not fully configured for this legacy raw-key test: ${llmIntegrationReadiness.missingRequiredEnvVars.join(",") || "unsafe gates present or raw test key absent"}`
}, async () => {
  const store = createSeededStore();
  const task = store.createTask({ title: "Remote LLM integration", repoId: "repo_demo_backend", baseBranch: "main" });
  const taskRun = store.createTaskRun({ taskId: task.id, attempt: 1, status: "running", agent: "codex", model: "openai-compatible/default" });
  const service = createDefaultLlmGatewayService({ usageRepository: store });
  service.createVirtualKey(remoteVirtualKey());
  const completion = await service.routeCompletion({
    taskId: task.id,
    taskRunId: taskRun.id,
    modelRef: "openai-compatible/default",
    virtualKeyId: "vmk_remote_openai_fixture",
    prompt: "Return the word ok.",
    budgetLimitUsd: 1
  });
  assert.equal(completion.ok, true);
});
