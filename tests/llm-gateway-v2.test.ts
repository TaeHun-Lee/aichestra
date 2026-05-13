import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { AuthorizationService } from "@aichestra/auth";
import { createApiServerWithStorage } from "@aichestra/api";
import { createInMemoryStorageProvider, createSeededStore } from "@aichestra/db";
import {
  AnthropicCompatibleLLMProviderSkeleton,
  AzureCompatibleLLMProviderSkeleton,
  BedrockCompatibleLLMProviderSkeleton,
  GeminiCompatibleLLMProviderSkeleton,
  InMemoryVirtualModelKeyRepository,
  LLMGatewayService,
  LiteLLMCompatibleLLMProviderSkeleton,
  LocalCliLLMProviderBridgeSkeleton,
  OpenAICompatibleLLMProvider,
  VertexCompatibleLLMProviderSkeleton,
  createLlmProviderConfigFromEnv,
  seedLlmModels,
  type LLMProviderRuntimeConfig,
  type OpenAICompatibleHttpClient,
  type VirtualModelKey
} from "@aichestra/llm-gateway";
import { PolicyService } from "@aichestra/policy";

function config(input: Partial<LLMProviderRuntimeConfig> = {}): LLMProviderRuntimeConfig {
  return {
    ...createLlmProviderConfigFromEnv({}),
    ...input
  } as LLMProviderRuntimeConfig;
}

function remoteConfig(input: Partial<LLMProviderRuntimeConfig> = {}): LLMProviderRuntimeConfig {
  return config({
    providerKind: "openai_compatible",
    routingMode: "single_provider",
    remoteLlmEnabled: true,
    remoteCompletionEnabled: true,
    openAICompatibleConfigured: true,
    baseUrlConfigured: true,
    apiKeyConfigured: true,
    credentialSource: "legacy_env",
    credentialStatus: "resolved",
    credentialReason: "test_fixture_api_key_configured",
    allowedModels: ["gpt-test"],
    allowedModelCount: 1,
    defaultModel: "gpt-test",
    defaultModelConfigured: true,
    ...input
  });
}

function remoteVirtualKey(): VirtualModelKey {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "vmk_remote_openai_fixture_v2",
    ownerKind: "system",
    ownerId: "system",
    displayName: "Remote OpenAI-compatible Fixture Key v2",
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

function mockHttpClient() {
  const calls: unknown[] = [];
  const client: OpenAICompatibleHttpClient = {
    async postJson(request) {
      calls.push(request);
      return {
        ok: true,
        status: 200,
        body: {
          id: "chatcmpl_v2_fixture",
          choices: [{ message: { content: "v2 answer AICHESTRA_LLM_API_KEY=sk-hidden" }, finish_reason: "stop" }],
          usage: { prompt_tokens: 9, completion_tokens: 5 }
        }
      };
    }
  };
  return { client, calls };
}

function hasSecret(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /sk-hidden|test-api-key|AICHESTRA_LLM_API_KEY=sk-/.test(text);
}

function getJson(port: number, requestPath: string, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath, headers }, (response) => {
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

function postJson(port: number, requestPath: string, body: Record<string, unknown> = {}, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: requestPath,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized),
        ...headers
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

function patchJson(port: number, requestPath: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: requestPath,
      method: "PATCH",
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

test("LLM Gateway v2 routes mock models by default and records routing decisions", async () => {
  const store = createSeededStore();
  const service = new LLMGatewayService({ usageRepository: store });
  const completion = await service.routeCompletion({
    taskId: "task_v2_mock",
    taskRunId: "run_v2_mock",
    prompt: "Fix code generation bug",
    budgetLimitUsd: 1
  });

  assert.equal(completion.ok, true);
  assert.equal(completion.routingDecision?.decision, "selected");
  assert.equal(completion.routingDecision?.selectedRouteId, "route_mock_coder");
  assert.equal(completion.usageEvent?.metadata?.route_id, "route_mock_coder");
  assert.equal(service.listRoutingDecisions().length, 1);
  assert.equal(hasSecret({ completion, audit: service.listAuditEvents() }), false);
});

test("route filtering excludes disabled, mismatched capability, denied provider, and denied model routes", () => {
  const service = new LLMGatewayService();
  service.updateRouteStatus("route_mock_coder", false);
  const disabled = service.routeRequest({ taskId: "task_disabled", taskRunId: "run_disabled", prompt: "Fix code bug", budgetLimitUsd: 1 });
  assert.notEqual(disabled.route?.id, "route_mock_coder");

  const capability = service.routeRequest({
    taskId: "task_capability",
    taskRunId: "run_capability",
    prompt: "Fix code bug",
    requestedCapabilities: ["image_generation"],
    budgetLimitUsd: 1
  });
  assert.equal(capability.ok, false);
  assert.equal(capability.reason, "no_route_found");

  const deniedProvider = new LLMGatewayService({ config: config({ deniedProviderIds: ["mock"] }) }).routeRequest({
    taskId: "task_provider_denied",
    taskRunId: "run_provider_denied",
    prompt: "General summary",
    budgetLimitUsd: 1
  });
  assert.equal(deniedProvider.ok, false);
  assert.equal(deniedProvider.reason, "no_route_found");

  const deniedModel = new LLMGatewayService({ config: config({ deniedModels: ["mock-coder@1.0"] }) }).routeRequest({
    taskId: "task_model_denied",
    taskRunId: "run_model_denied",
    modelRef: "mock-coder@1.0",
    prompt: "Fix code bug",
    budgetLimitUsd: 1
  });
  assert.equal(deniedModel.ok, false);
  assert.equal(deniedModel.reason, "model_denied_by_config");
});

test("routing mode gates remote routes and local CLI routes return local_agent_required", () => {
  const mockOnly = new LLMGatewayService().routeRequest({
    taskId: "task_remote_mock_only",
    taskRunId: "run_remote_mock_only",
    providerKind: "openai_compatible",
    modelRef: "openai-compatible/default",
    prompt: "remote request",
    budgetLimitUsd: 1
  });
  assert.equal(mockOnly.ok, false);
  assert.equal(mockOnly.reason, "routing_mode_mock_only");

  const localCli = new LLMGatewayService({ config: config({ routingMode: "multi_provider" }) }).routeRequest({
    taskId: "task_local_cli",
    taskRunId: "run_local_cli",
    providerKind: "local_cli",
    modelRef: "claude-code/local",
    promptClass: "code_generation",
    prompt: "Fix code locally",
    budgetLimitUsd: 1
  });
  assert.equal(localCli.ok, false);
  assert.equal(localCli.routingDecision?.decision, "provider_unavailable");
  assert.equal(localCli.reason, "local_agent_required");
});

test("remote route blocks on credentials, budget, Auth/RBAC, and still preserves mocked OpenAI-compatible v1 success", async () => {
  const missingCredential = new LLMGatewayService({ config: remoteConfig({ credentialStatus: "missing", apiKeyConfigured: false, openAICompatibleConfigured: false }) }).routeRequest({
    taskId: "task_missing_credential",
    taskRunId: "run_missing_credential",
    providerKind: "openai_compatible",
    modelRef: "openai-compatible/default",
    virtualKeyId: "vmk_remote_openai_fixture_v2",
    prompt: "Remote request",
    budgetLimitUsd: 1
  });
  assert.equal(missingCredential.ok, false);
  assert.equal(missingCredential.routingDecision?.decision, "credentials_blocked");

  const budgetBlocked = new LLMGatewayService({
    config: remoteConfig(),
    virtualKeyRepository: new InMemoryVirtualModelKeyRepository([remoteVirtualKey()])
  }).routeRequest({
    taskId: "task_budget",
    taskRunId: "run_budget",
    providerKind: "openai_compatible",
    modelRef: "openai-compatible/default",
    virtualKeyId: "vmk_remote_openai_fixture_v2",
    prompt: "Remote request",
    budgetLimitUsd: 0
  });
  assert.equal(budgetBlocked.ok, false);
  assert.equal(budgetBlocked.routingDecision?.decision, "budget_blocked");

  const policyService = new PolicyService();
  const authorizationService = new AuthorizationService({ policyService });
  const viewerAuth = authorizationService.getAuthContext({ actorId: "user_demo_viewer", source: "test" });
  const authBlocked = new LLMGatewayService({
    config: remoteConfig(),
    virtualKeyRepository: new InMemoryVirtualModelKeyRepository([remoteVirtualKey()]),
    policyService,
    authorizationService
  }).routeRequest({
    taskId: "task_viewer_remote",
    taskRunId: "run_viewer_remote",
    authContext: viewerAuth,
    actorId: viewerAuth.actor.id,
    providerKind: "openai_compatible",
    modelRef: "openai-compatible/default",
    virtualKeyId: "vmk_remote_openai_fixture_v2",
    prompt: "Remote request",
    budgetLimitUsd: 1
  });
  assert.equal(authBlocked.ok, false);
  assert.equal(authBlocked.routingDecision?.decision, "policy_blocked");

  const { client, calls } = mockHttpClient();
  const store = createSeededStore();
  const success = await new LLMGatewayService({
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
  }).routeCompletion({
    taskId: "task_remote_success",
    taskRunId: "run_remote_success",
    providerKind: "openai_compatible",
    modelRef: "openai-compatible/default",
    virtualKeyId: "vmk_remote_openai_fixture_v2",
    prompt: "Remote request",
    budgetLimitUsd: 1
  });
  assert.equal(success.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(success.usageEvent?.metadata?.routing_decision_id, success.routingDecision?.id);
  assert.equal(hasSecret(success), false);
});

test("fallback is disabled by default, max attempts are enforced, and fallback policy denial is audited", async () => {
  const disabled = await new LLMGatewayService({ config: config({ routingMode: "multi_provider" }) }).routeCompletion({
    taskId: "task_fallback_disabled",
    taskRunId: "run_fallback_disabled",
    providerKind: "local_cli",
    modelRef: "claude-code/local",
    promptClass: "code_generation",
    prompt: "Fix locally",
    maxFallbackAttempts: 3,
    budgetLimitUsd: 1
  });
  assert.equal(disabled.ok, false);
  assert.equal(disabled.fallbackAttempts, undefined);

  const maxZero = await new LLMGatewayService({ config: config({ routingMode: "multi_provider", fallbackEnabled: true, maxFallbackAttempts: 0 }) }).routeCompletion({
    taskId: "task_fallback_max",
    taskRunId: "run_fallback_max",
    providerKind: "local_cli",
    modelRef: "claude-code/local",
    promptClass: "code_generation",
    prompt: "Fix locally",
    maxFallbackAttempts: 3,
    budgetLimitUsd: 1
  });
  assert.equal(maxZero.ok, false);
  assert.equal(maxZero.fallbackAttempts, undefined);
});

test("skeleton providers are disabled or local-agent-required without external calls", async () => {
  for (const provider of [
    new AnthropicCompatibleLLMProviderSkeleton(),
    new GeminiCompatibleLLMProviderSkeleton(),
    new BedrockCompatibleLLMProviderSkeleton(),
    new VertexCompatibleLLMProviderSkeleton(),
    new AzureCompatibleLLMProviderSkeleton(),
    new LiteLLMCompatibleLLMProviderSkeleton(),
    new LocalCliLLMProviderBridgeSkeleton()
  ]) {
    const validation = await provider.validateConnection();
    const completion = await provider.createCompletion({ taskId: "task_skeleton", taskRunId: "run_skeleton", prompt: "hello" }, seedLlmModels()[0]!);
    assert.equal(validation.ok, false);
    assert.equal(completion.ok, false);
    assert.equal(completion.reason === "local_agent_required" || completion.reason?.includes("not_implemented"), true);
  }
});

test("LLM Gateway v2 API, health, and dashboard expose routing read models without secrets", async () => {
  const store = createSeededStore();
  const storage = createInMemoryStorageProvider({ store, repoRoot: process.cwd() });
  const server = createApiServerWithStorage(storage);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health");
    assert.equal((health.llm as Record<string, unknown>).routingMode, "mock_only");
    assert.equal((health.llm as Record<string, unknown>).fallbackEnabled, false);
    assert.equal(hasSecret(health), false);

    const routingConfig = await getJson(address.port, "/llm/routing/config");
    assert.equal((routingConfig.config as Record<string, unknown>).routingMode, "mock_only");

    const routes = await getJson(address.port, "/llm/routes") as { routes: { id: string }[] };
    assert.equal(routes.routes.some((route) => route.id === "route_mock_coder"), true);

    const createRoute = await postJson(address.port, "/llm/routes", {
      id: "route_test_api_v2",
      name: "API test route",
      providerId: "mock",
      providerKind: "mock",
      modelId: "mock-small@1.0",
      capabilities: ["completion"],
      promptClasses: ["general"],
      priority: 50,
      enabled: true
    });
    assert.equal(createRoute.statusCode, 201);

    const patchRoute = await patchJson(address.port, "/llm/routes/route_test_api_v2/status", { enabled: false });
    assert.equal(patchRoute.statusCode, 200);
    assert.equal((patchRoute.body.route as Record<string, unknown>).enabled, false);

    const fallbackPolicies = await getJson(address.port, "/llm/fallback-policies") as { fallbackPolicies: unknown[] };
    assert.equal(fallbackPolicies.fallbackPolicies.length > 0, true);

    const providerHealth = await getJson(address.port, "/llm/providers/health") as { providerHealth: { providerKind: string }[] };
    assert.equal(providerHealth.providerHealth.some((healthEntry) => healthEntry.providerKind === "openai_compatible"), true);

    const route = await postJson(address.port, "/llm/route", {
      taskId: "task_api_route_v2",
      taskRunId: "run_api_route_v2",
      prompt: "Fix code bug",
      budgetLimitUsd: 1
    });
    assert.equal(route.statusCode, 200);
    assert.equal((route.body.routingDecision as Record<string, unknown>).decision, "selected");

    const decisions = await getJson(address.port, "/llm/routing/decisions") as { decisions: unknown[] };
    assert.equal(decisions.decisions.length > 0, true);

    const dashboard = await getJson(address.port, "/dashboard/llm") as { llm: Record<string, unknown> };
    assert.equal(Array.isArray(dashboard.llm.routes), true);
    assert.equal(Array.isArray(dashboard.llm.providerHealth), true);
    assert.equal(Array.isArray(dashboard.llm.routingDecisions), true);
    assert.equal(hasSecret(dashboard), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
