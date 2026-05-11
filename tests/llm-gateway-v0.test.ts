import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  InMemoryModelCatalogRepository,
  LLMGatewayService,
  MockLLMProvider,
  OpenAICompatibleLLMProvider,
  VirtualModelKeyService,
  createDefaultLlmGatewayService,
  seedLlmModels,
  virtualModelKeyToDto
} from "@aichestra/llm-gateway";

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

test("MockLLMProvider returns deterministic completions, estimates usage, and can simulate blocked states", async () => {
  const provider = new MockLLMProvider();
  const model = seedLlmModels().find((item) => item.id === "mock-coder@1.0");
  assert.ok(model);

  const validation = await provider.validateConnection();
  const completion = await provider.createCompletion({
    taskId: "task_llm",
    taskRunId: "run_llm",
    prompt: "Fix login bug"
  }, model);
  const disabled = await provider.createCompletion({
    taskId: "task_llm",
    taskRunId: "run_llm",
    prompt: "Fix login bug",
    metadata: { simulateModelDisabled: true }
  }, model);
  const unavailable = await new MockLLMProvider({ unavailable: true }).validateConnection();

  assert.equal(provider.getProviderKind(), "mock");
  assert.equal(validation.ok, true);
  assert.equal(completion.ok, true);
  assert.equal(completion.result?.content.includes("mock-coder@1.0"), true);
  assert.equal(completion.result?.estimatedCostUsd !== undefined, true);
  assert.equal(disabled.ok, false);
  assert.equal(disabled.reason, "model_disabled");
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.reason, "mock_provider_unavailable");
});

test("OpenAI-compatible LLM provider skeleton blocks remote completion by default without network calls", async () => {
  const provider = new OpenAICompatibleLLMProvider();
  const model = seedLlmModels().find((item) => item.id === "openai-compatible/default");
  assert.ok(model);

  const validation = await provider.validateConnection();
  const completion = await provider.createCompletion({
    taskId: "task_remote_llm",
    taskRunId: "run_remote_llm",
    prompt: "Remote call must be blocked"
  }, model);

  assert.equal(provider.getProviderKind(), "openai_compatible");
  assert.equal(validation.ok, false);
  assert.equal(validation.reason, "blocked_remote_llm_disabled");
  assert.equal(completion.ok, false);
  assert.equal(completion.reason, "blocked_remote_llm_disabled");
});

test("model catalog resolves deterministic active models and excludes disabled or deprecated models", () => {
  const catalog = new InMemoryModelCatalogRepository();
  const service = new LLMGatewayService({ modelCatalogRepository: catalog });

  assert.equal(service.listModels().some((model) => model.id === "mock-small@1.0"), true);
  assert.equal(service.selectModel({ prompt: "Fix a conflict risk regression" }).model?.id, "mock-conflict-resolver@1.0");

  service.updateModelStatus("mock-conflict-resolver@1.0", "deprecated");
  const fallback = service.selectModel({ prompt: "Fix a conflict risk regression" });
  assert.equal(fallback.model?.id, "mock-coder@1.0");

  service.updateModelStatus("mock-coder@1.0", "disabled");
  const disabled = service.routeRequest({
    taskId: "task_llm",
    taskRunId: "run_llm",
    modelRef: "mock-coder@1.0",
    prompt: "Fix bug"
  });
  assert.equal(disabled.ok, false);
  assert.equal(disabled.reason, "No selectable model satisfies mock-coder@1.0.");
});

test("virtual model keys are policy objects and budget gates route completion", async () => {
  const store = createSeededStore();
  const task = store.createTask({ title: "LLM gateway task", repoId: "repo_demo_backend", baseBranch: "main" });
  const taskRun = store.createTaskRun({ taskId: task.id, attempt: 1, status: "running", agent: "codex", model: "mock-model" });
  const service = createDefaultLlmGatewayService({ usageRepository: store });
  const keys = new VirtualModelKeyService();
  const dto = virtualModelKeyToDto(keys.getVirtualKey("vmk_system_mock")!);

  assert.equal(dto.storesProviderSecret, false);

  const allowed = await service.routeCompletion({
    taskId: task.id,
    taskRunId: taskRun.id,
    actorId: task.requesterUserId,
    modelRef: "mock-coder@1.0",
    prompt: "Fix login bug",
    budgetLimitUsd: 1
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.usageEvent?.taskRunId, taskRun.id);
  assert.equal(allowed.usageEvent?.metadata?.source, "llm_gateway");

  const blocked = await service.routeCompletion({
    taskId: task.id,
    taskRunId: taskRun.id,
    actorId: task.requesterUserId,
    modelRef: "mock-coder@1.0",
    prompt: "Fix login bug",
    budgetLimitUsd: 0
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "budget_exceeded");
  assert.equal(service.listAuditEvents().some((event) => event.eventType === "llm_completion_blocked"), true);
});

test("LLM API exposes providers, models, virtual keys, route, completion, usage, and audit", async () => {
  const store = createSeededStore();
  const task = store.createTask({ title: "LLM API task", repoId: "repo_demo_backend", baseBranch: "main" });
  const taskRun = store.createTaskRun({ taskId: task.id, attempt: 1, status: "running", agent: "codex", model: "mock-model" });
  const server = createApiServer(store);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health");
    assert.equal((health.llm as { providerKind: string }).providerKind, "mock");
    assert.equal((health.llm as { remoteLlmEnabled: boolean }).remoteLlmEnabled, false);

    const providers = await getJson(address.port, "/llm/providers") as { providers: { providerKind: string }[] };
    assert.equal(providers.providers.some((provider) => provider.providerKind === "mock"), true);

    const models = await getJson(address.port, "/llm/models") as { models: { id: string }[] };
    assert.equal(models.models.some((model) => model.id === "mock-registry-reviewer@1.0"), true);

    const virtualKeys = await getJson(address.port, "/llm/virtual-keys") as { virtualKeys: { storesProviderSecret: boolean }[] };
    assert.equal(virtualKeys.virtualKeys[0]?.storesProviderSecret, false);

    const route = await postJson(address.port, "/llm/route", {
      taskId: task.id,
      taskRunId: taskRun.id,
      modelRef: "mock-coder@1.0",
      prompt: "Fix login bug",
      budgetLimitUsd: 1
    });
    assert.equal(route.statusCode, 200);
    assert.equal((route.body.budgetDecision as { allowed: boolean }).allowed, true);

    const completion = await postJson(address.port, "/llm/completions", {
      taskId: task.id,
      taskRunId: taskRun.id,
      modelRef: "mock-coder@1.0",
      prompt: "Fix login bug",
      budgetLimitUsd: 1
    });
    assert.equal(completion.statusCode, 201);
    assert.equal((completion.body.result as { modelId: string }).modelId, "mock-coder@1.0");

    const usage = await getJson(address.port, "/llm/usage") as { usageEvents: { taskRunId: string }[] };
    assert.equal(usage.usageEvents.some((event) => event.taskRunId === taskRun.id), true);

    const audit = await getJson(address.port, "/llm/audit") as { auditEvents: { eventType: string }[] };
    assert.equal(audit.auditEvents.some((event) => event.eventType === "llm_completion_succeeded"), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
