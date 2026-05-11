import { createId } from "@aichestra/core";
import type { LlmCallInput, LlmCallResult, LlmGateway as LegacyLlmGateway } from "@aichestra/adapters";
import { ModelCatalogService, type ModelCatalogRepository } from "./catalog.ts";
import { MockLLMProvider, createLlmProviderFromEnv } from "./providers.ts";
import {
  allowsProvider,
  VirtualModelKeyService,
  type VirtualModelKeyRepository
} from "./virtual-keys.ts";
import type {
  BudgetDecision,
  LLMAuditEvent,
  LLMCompletionRequest,
  LLMCompletionRouteResult,
  LLMModel,
  LLMProvider,
  LLMProviderRuntimeConfig,
  LLMRouteResult,
  LLMUsageRepository,
  VirtualModelKey
} from "./types.ts";

export type LLMAuditRepository = {
  appendAuditEvent(input: Omit<LLMAuditEvent, "id" | "createdAt">): LLMAuditEvent;
  listAuditEvents(): LLMAuditEvent[];
};

export class InMemoryLLMAuditRepository implements LLMAuditRepository {
  private readonly events: LLMAuditEvent[] = [];

  appendAuditEvent(input: Omit<LLMAuditEvent, "id" | "createdAt">): LLMAuditEvent {
    const event = {
      ...input,
      id: createId("llmaudit"),
      createdAt: new Date()
    };
    this.events.push(event);
    return event;
  }

  listAuditEvents(): LLMAuditEvent[] {
    return [...this.events];
  }
}

export type LLMGatewayServiceInput = {
  provider?: LLMProvider;
  config?: LLMProviderRuntimeConfig;
  modelCatalogRepository?: ModelCatalogRepository;
  virtualKeyRepository?: VirtualModelKeyRepository;
  usageRepository?: LLMUsageRepository;
  auditRepository?: LLMAuditRepository;
  actorId?: string;
  recordLegacyUsage?: boolean;
};

export class LLMGatewayService implements LegacyLlmGateway {
  private readonly provider: LLMProvider;
  private readonly config: LLMProviderRuntimeConfig;
  private readonly modelCatalog: ModelCatalogService;
  private readonly virtualKeys: VirtualModelKeyService;
  private readonly auditRepository: LLMAuditRepository;
  private readonly usageRepository?: LLMUsageRepository;
  private readonly actorId: string;
  private readonly recordLegacyUsage: boolean;

  constructor(input: LLMGatewayServiceInput = {}) {
    const providerConfig = input.config ?? createLlmProviderFromEnv({}).config;
    this.provider = input.provider ?? new MockLLMProvider();
    this.config = providerConfig;
    this.modelCatalog = new ModelCatalogService(input.modelCatalogRepository);
    this.virtualKeys = new VirtualModelKeyService(input.virtualKeyRepository);
    this.auditRepository = input.auditRepository ?? new InMemoryLLMAuditRepository();
    this.usageRepository = input.usageRepository;
    this.actorId = input.actorId ?? "mock-llm-actor";
    this.recordLegacyUsage = input.recordLegacyUsage ?? false;
  }

  getConfig(): LLMProviderRuntimeConfig {
    return {
      ...this.config,
      providerKind: this.provider.getProviderKind()
    };
  }

  listProviders() {
    return [
      { providerKind: "mock", default: this.provider.getProviderKind() === "mock", remote: false, enabled: true },
      { providerKind: "openai_compatible", default: this.provider.getProviderKind() === "openai_compatible", remote: true, enabled: this.config.remoteLlmEnabled }
    ];
  }

  async validateConnection() {
    const validation = await this.provider.validateConnection();
    this.recordAuditEvent({
      eventType: "llm_connection_validated",
      providerKind: validation.providerKind,
      result: validation.ok ? "allowed" : "blocked",
      reason: validation.reason,
      metadata: {}
    });
    return validation;
  }

  listModels(): LLMModel[] {
    return this.modelCatalog.listModels();
  }

  getModel(id: string): LLMModel | undefined {
    return this.modelCatalog.getModel(id);
  }

  registerModel(input: Omit<LLMModel, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): LLMModel {
    const model = this.modelCatalog.registerModel(input);
    this.recordAuditEvent({
      eventType: "llm_model_registered",
      providerKind: model.providerKind,
      modelId: model.id,
      result: "allowed",
      metadata: { status: model.status }
    });
    return model;
  }

  updateModelStatus(id: string, status: LLMModel["status"]): LLMModel {
    const model = this.modelCatalog.updateModelStatus(id, status);
    this.recordAuditEvent({
      eventType: "llm_model_status_changed",
      providerKind: model.providerKind,
      modelId: model.id,
      result: "allowed",
      metadata: { status: model.status }
    });
    return model;
  }

  listVirtualKeys(): VirtualModelKey[] {
    return this.virtualKeys.listVirtualKeys();
  }

  createVirtualKey(input: Omit<VirtualModelKey, "id" | "createdAt" | "updatedAt"> & { id?: string }): VirtualModelKey {
    const key = this.virtualKeys.createVirtualKey(input);
    this.recordAuditEvent({
      eventType: "llm_virtual_key_created",
      providerKind: key.allowedProviderKinds[0] ?? "mock",
      result: "allowed",
      actorId: this.actorId,
      metadata: {
        virtual_key_id: key.id,
        owner_kind: key.ownerKind,
        stores_provider_secret: false
      }
    });
    return key;
  }

  updateVirtualKeyStatus(id: string, status: VirtualModelKey["status"]): VirtualModelKey {
    const key = this.virtualKeys.updateVirtualKeyStatus(id, status);
    this.recordAuditEvent({
      eventType: "llm_virtual_key_status_changed",
      providerKind: key.allowedProviderKinds[0] ?? "mock",
      result: "allowed",
      actorId: this.actorId,
      metadata: { virtual_key_id: key.id, status: key.status }
    });
    return key;
  }

  async routeCompletion(request: LLMCompletionRequest): Promise<LLMCompletionRouteResult> {
    return this.completeRoute(request);
  }

  async completeRoute(request: LLMCompletionRequest): Promise<LLMCompletionRouteResult> {
    const route = this.routeRequest(request);
    if (!route.ok || !route.model || !route.budgetDecision?.allowed) {
      this.recordAuditEvent({
        eventType: "llm_completion_blocked",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model?.providerKind ?? request.providerKind ?? this.provider.getProviderKind(),
        modelId: route.model?.id ?? request.modelRef,
        result: "blocked",
        reason: route.reason ?? route.budgetDecision?.reason,
        metadata: { source: "llm_gateway" }
      });
      return {
        ok: false,
        reason: route.reason ?? route.budgetDecision?.reason ?? "llm_route_blocked",
        budgetDecision: route.budgetDecision
      };
    }

    const providerResult = await this.provider.createCompletion(request, route.model);
    if (!providerResult.ok || !providerResult.result) {
      this.recordAuditEvent({
        eventType: "llm_completion_blocked",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model.providerKind,
        modelId: route.model.id,
        result: "blocked",
        reason: providerResult.reason,
        metadata: { source: "llm_gateway" }
      });
      return { ok: false, reason: providerResult.reason, budgetDecision: route.budgetDecision };
    }

    const usageEvent = this.recordUsage(providerResult.result, request);
    this.recordAuditEvent({
      eventType: "llm_completion_succeeded",
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId ?? this.actorId,
      providerKind: providerResult.result.providerKind,
      modelId: providerResult.result.modelId,
      result: "allowed",
      metadata: {
        source: "llm_gateway",
        gateway_request_id: providerResult.result.id,
        usage_event_id: usageEvent?.id,
        estimated_cost_usd: providerResult.result.estimatedCostUsd
      }
    });

    return {
      ok: true,
      result: providerResult.result,
      usageEvent,
      budgetDecision: route.budgetDecision
    };
  }

  routeRequest(request: LLMCompletionRequest): LLMRouteResult {
    const resolution = this.modelCatalog.resolveModelForTask({
      requestedModelId: request.modelRef,
      prompt: request.prompt,
      providerKind: request.providerKind
    });
    if (!resolution.model) {
      return { ok: false, reason: resolution.errors[0] ?? "model_not_found" };
    }
    const decision = this.checkBudget(request, resolution.model);
    return {
      ok: decision.allowed,
      model: resolution.model,
      budgetDecision: decision,
      reason: decision.allowed ? undefined : decision.reason
    };
  }

  selectModel(request: { prompt?: string; modelRef?: string; providerKind?: LLMCompletionRequest["providerKind"] }) {
    return this.modelCatalog.resolveModelForTask({
      requestedModelId: request.modelRef,
      prompt: request.prompt,
      providerKind: request.providerKind
    });
  }

  checkBudget(request: LLMCompletionRequest, model: LLMModel): BudgetDecision {
    const inputTokens = Math.max(1, Math.ceil(`${request.systemInstructions ?? ""}\n${request.prompt}`.length / 4));
    const outputTokens = Math.min(request.maxTokens ?? 96, 96);
    const estimatedCostUsd = Number(((model.inputTokenCostUsd ?? 0.000001) * inputTokens + (model.outputTokenCostUsd ?? 0.000002) * outputTokens).toFixed(6));
    const key = request.virtualKeyId ? this.virtualKeys.getVirtualKey(request.virtualKeyId) : this.virtualKeys.getVirtualKey("vmk_system_mock");
    if (!key) {
      return this.budgetDecision(request, model, estimatedCostUsd, false, "virtual_key_not_found");
    }
    if (key.status !== "active") {
      return this.budgetDecision(request, model, estimatedCostUsd, false, "virtual_key_disabled");
    }
    if (!allowsProvider(key, model.providerKind)) {
      return this.budgetDecision(request, model, estimatedCostUsd, false, "provider_not_allowed");
    }
    if (!key.allowedModelIds.includes(model.id)) {
      return this.budgetDecision(request, model, estimatedCostUsd, false, "model_not_allowed");
    }
    const limit = Math.min(...[request.budgetLimitUsd, key.perTaskBudgetUsd].filter((value): value is number => typeof value === "number"));
    if (Number.isFinite(limit) && estimatedCostUsd > limit) {
      return this.budgetDecision(request, model, estimatedCostUsd, false, "budget_exceeded", limit - estimatedCostUsd);
    }
    return this.budgetDecision(request, model, estimatedCostUsd, true, "allowed", Number.isFinite(limit) ? limit - estimatedCostUsd : undefined);
  }

  async complete(input: LlmCallInput): Promise<LlmCallResult> {
    const request: LLMCompletionRequest = {
      taskId: input.taskId,
      taskRunId: input.taskRunId,
      actorId: input.userId,
      modelRef: input.model,
      prompt: input.prompt,
      repoId: input.repoId,
      metadata: {
        branch: input.branch,
        agent: input.agent,
        skill_versions: input.skillVersions,
        harness_version: input.harnessVersion,
        instruction_set_hash: input.instructionSetHash,
        legacy_runner_call: true
      }
    };
    const route = await this.completeRouteWithoutPersistingUsage(request);
    const result = route.result;
    if (!result) {
      throw new Error(route.reason ?? "LLM Gateway completion failed");
    }
    if (this.recordLegacyUsage && this.usageRepository) {
      this.recordUsage(result, request);
    }
    return {
      text: result.content,
      usage: {
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        userId: input.userId,
        repoId: input.repoId,
        provider: result.providerKind,
        model: result.modelId,
        eventType: "llm_call",
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.estimatedCostUsd,
        latencyMs: result.latencyMs,
        skillVersion: input.skillVersions.join(","),
        harnessVersion: input.harnessVersion,
        metadata: {
          task_id: input.taskId,
          task_run_id: input.taskRunId,
          repo_id: input.repoId,
          branch: input.branch,
          agent: input.agent,
          model: result.modelId,
          skill_versions: input.skillVersions.join(","),
          harness_version: input.harnessVersion,
          instruction_set_hash: input.instructionSetHash,
          gateway_request_id: result.id,
          source: "llm_gateway"
        }
      }
    };
  }

  recordAuditEvent(input: Omit<LLMAuditEvent, "id" | "createdAt">): LLMAuditEvent {
    return this.auditRepository.appendAuditEvent({
      ...input,
      metadata: sanitizeMetadata(input.metadata)
    });
  }

  listAuditEvents(): LLMAuditEvent[] {
    return this.auditRepository.listAuditEvents();
  }

  listUsageEvents() {
    return this.usageRepository?.listUsageEvents().filter((event) => event.metadata?.source === "llm_gateway") ?? [];
  }

  private async completeRouteWithoutPersistingUsage(request: LLMCompletionRequest): Promise<LLMCompletionRouteResult> {
    const route = this.routeRequest(request);
    if (!route.ok || !route.model || !route.budgetDecision?.allowed) {
      this.recordAuditEvent({
        eventType: "llm_completion_blocked",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model?.providerKind ?? request.providerKind ?? this.provider.getProviderKind(),
        modelId: route.model?.id ?? request.modelRef,
        result: "blocked",
        reason: route.reason ?? route.budgetDecision?.reason,
        metadata: { source: "llm_gateway", legacy_runner_call: request.metadata?.legacy_runner_call === true }
      });
      return { ok: false, reason: route.reason ?? route.budgetDecision?.reason, budgetDecision: route.budgetDecision };
    }
    const providerResult = await this.provider.createCompletion(request, route.model);
    if (!providerResult.ok || !providerResult.result) {
      this.recordAuditEvent({
        eventType: "llm_completion_blocked",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model.providerKind,
        modelId: route.model.id,
        result: "blocked",
        reason: providerResult.reason,
        metadata: { source: "llm_gateway" }
      });
      return { ok: false, reason: providerResult.reason, budgetDecision: route.budgetDecision };
    }
    this.recordAuditEvent({
      eventType: "llm_completion_succeeded",
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId ?? this.actorId,
      providerKind: providerResult.result.providerKind,
      modelId: providerResult.result.modelId,
      result: "allowed",
      metadata: {
        source: "llm_gateway",
        gateway_request_id: providerResult.result.id,
        persisted_usage: false
      }
    });
    return { ok: true, result: providerResult.result, budgetDecision: route.budgetDecision };
  }

  private recordUsage(result: NonNullable<LLMCompletionRouteResult["result"]>, request: LLMCompletionRequest) {
    if (!this.usageRepository) return undefined;
    return this.usageRepository.recordUsage({
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      userId: request.actorId ?? this.actorId,
      repoId: request.repoId,
      provider: result.providerKind,
      model: result.modelId,
      eventType: "llm_call",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.estimatedCostUsd,
      latencyMs: result.latencyMs,
      metadata: {
        source: "llm_gateway",
        gateway_request_id: result.id,
        virtual_key_id: request.virtualKeyId,
        provider_kind: result.providerKind,
        model_id: result.modelId
      }
    });
  }

  private budgetDecision(
    request: LLMCompletionRequest,
    model: LLMModel,
    estimatedCostUsd: number,
    allowed: boolean,
    reason: string,
    budgetRemainingUsd?: number
  ): BudgetDecision {
    return {
      allowed,
      reason,
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      modelId: model.id,
      providerKind: model.providerKind,
      estimatedCostUsd,
      budgetRemainingUsd
    };
  }
}

export function createDefaultLlmGatewayService(input: Omit<LLMGatewayServiceInput, "provider" | "config"> = {}): LLMGatewayService {
  const runtime = createLlmProviderFromEnv();
  return new LLMGatewayService({
    ...input,
    provider: runtime.provider,
    config: runtime.config
  });
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(metadata);
  for (const key of Object.keys(clone)) {
    if (key.toLowerCase().includes("key") || key.toLowerCase().includes("token") || key.toLowerCase().includes("secret")) {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}
