import { createId } from "@aichestra/core";
import type { LlmCallInput, LlmCallResult, LlmGateway as LegacyLlmGateway } from "@aichestra/adapters";
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject
} from "@aichestra/policy";
import { sanitizeSecurityMetadata } from "@aichestra/security";
import type { PolicyDecision } from "@aichestra/policy";
import { ModelCatalogService, type ModelCatalogRepository } from "./catalog.ts";
import { ProviderCatalogService } from "./enterprise-providers.ts";
import { MockLLMProvider, createLlmProviderFromEnv, type LlmCredentialResolver } from "./providers.ts";
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
  policyService?: PolicyService;
  enterpriseProviderCatalog?: ProviderCatalogService;
  credentialResolver?: LlmCredentialResolver;
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
  private readonly policyService: PolicyService;
  private readonly enterpriseProviderCatalog: ProviderCatalogService;

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
    this.policyService = input.policyService ?? new PolicyService();
    this.enterpriseProviderCatalog = input.enterpriseProviderCatalog ?? new ProviderCatalogService();
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
      {
        providerKind: "openai_compatible",
        default: this.provider.getProviderKind() === "openai_compatible",
        remote: true,
        enabled: this.config.remoteLlmEnabled,
        completionEnabled: this.config.remoteCompletionEnabled,
        baseUrlConfigured: this.config.baseUrlConfigured,
        apiKeyConfigured: this.config.apiKeyConfigured,
        allowedModelCount: this.config.allowedModelCount,
        credentialSource: this.config.credentialSource,
        credentialStatus: this.config.credentialStatus,
        envSecretProviderEnabled: this.config.envSecretProviderEnabled
      }
    ];
  }

  listEnterpriseProviders() {
    return this.enterpriseProviderCatalog.listProviders();
  }

  getEnterpriseProvider(id: string) {
    return this.enterpriseProviderCatalog.getProvider(id);
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
      const eventType = route.budgetDecision && !route.budgetDecision.allowed ? "llm_budget_blocked" : "llm_completion_blocked";
      this.recordAuditEvent({
        eventType,
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model?.providerKind ?? request.providerKind ?? this.provider.getProviderKind(),
        modelId: route.model?.id ?? request.modelRef,
        result: "blocked",
        reason: route.reason ?? route.budgetDecision?.reason,
        metadata: { source: "llm_gateway" }
      });
      if (eventType === "llm_budget_blocked") {
        this.recordAuditEvent({
          eventType: "llm_completion_blocked",
          taskId: request.taskId,
          taskRunId: request.taskRunId,
          actorId: request.actorId ?? this.actorId,
          providerKind: route.model?.providerKind ?? request.providerKind ?? this.provider.getProviderKind(),
          modelId: route.model?.id ?? request.modelRef,
          result: "blocked",
          reason: route.reason ?? route.budgetDecision?.reason,
          metadata: { source: "llm_gateway", budget_decision_id: route.budgetDecision?.reason }
        });
      }
      return {
        ok: false,
        reason: route.reason ?? route.budgetDecision?.reason ?? "llm_route_blocked",
        budgetDecision: route.budgetDecision
      };
    }

    if (route.model.providerKind !== this.provider.getProviderKind()) {
      const reason = "provider_model_mismatch";
      this.recordAuditEvent({
        eventType: "llm_completion_blocked",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model.providerKind,
        providerId: request.providerId,
        modelId: route.model.id,
        result: "blocked",
        reason,
        metadata: {
          source: "llm_gateway",
          provider_runtime_kind: this.provider.getProviderKind()
        }
      });
      return { ok: false, reason, budgetDecision: route.budgetDecision };
    }

    const policyDecision = this.evaluateCompletionPolicy(request, route.model, route.budgetDecision);
    if (!policyDecision.allowed) {
      this.recordAuditEvent({
        eventType: route.model.providerKind === "mock" ? "llm_completion_blocked" : "llm_policy_blocked",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model.providerKind,
        providerId: request.providerId,
        modelId: route.model.id,
        result: "blocked",
        reason: policyDecision.reason,
        metadata: {
          source: "llm_gateway",
          provider_id: request.providerId,
          policy_decision_id: policyDecision.id,
          matched_rule_ids: policyDecision.matchedRuleIds
        }
      });
      return { ok: false, reason: policyDecision.reason, budgetDecision: route.budgetDecision };
    }

    if (route.model.providerKind !== "mock") {
      this.recordAuditEvent({
        eventType: "llm_remote_completion_requested",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model.providerKind,
        providerId: request.providerId,
        modelId: route.model.id,
        result: "allowed",
        metadata: {
          source: "llm_gateway",
          base_url_configured: this.config.baseUrlConfigured,
          api_key_configured: this.config.apiKeyConfigured,
          allowed_model_count: this.config.allowedModelCount,
          default_model_configured: this.config.defaultModelConfigured
        }
      });
    }

    const providerResult = await this.provider.createCompletion(request, route.model);
    if (!providerResult.ok || !providerResult.result) {
      this.recordAuditEvent({
        eventType: route.model.providerKind === "mock" ? "llm_completion_blocked" : eventTypeForRemoteProviderFailure(providerResult.reason),
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model.providerKind,
        providerId: request.providerId,
        modelId: route.model.id,
        result: route.model.providerKind === "mock" ? "blocked" : "failed",
        reason: providerResult.reason,
        metadata: { source: "llm_gateway" }
      });
      return { ok: false, reason: providerResult.reason, budgetDecision: route.budgetDecision };
    }

    const usageEvent = this.recordUsage(providerResult.result, request);
    this.recordAuditEvent({
      eventType: providerResult.result.providerKind === "mock" ? "llm_completion_succeeded" : "llm_remote_completion_completed",
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId ?? this.actorId,
      providerKind: providerResult.result.providerKind,
      providerId: providerResult.result.providerId ?? request.providerId,
      modelId: providerResult.result.modelId,
      result: "allowed",
      metadata: {
        source: "llm_gateway",
        gateway_request_id: providerResult.result.id,
        provider_id: providerResult.result.providerId ?? request.providerId,
        billing_mode: this.providerMetadataForRequest(request).billingMode,
        usage_event_id: usageEvent?.id,
        estimated_cost_usd: providerResult.result.estimatedCostUsd
      }
    });
    if (providerResult.result.metadata.redaction_applied === true) {
      this.recordAuditEvent({
        eventType: "llm_output_redacted",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: providerResult.result.providerKind,
        providerId: providerResult.result.providerId ?? request.providerId,
        modelId: providerResult.result.modelId,
        result: "allowed",
        metadata: {
          source: "llm_gateway",
          gateway_request_id: providerResult.result.id
        }
      });
    }

    return {
      ok: true,
      result: providerResult.result,
      usageEvent,
      budgetDecision: route.budgetDecision
    };
  }

  routeRequest(request: LLMCompletionRequest): LLMRouteResult {
    const providerKind = request.providerKind ?? this.provider.getProviderKind();
    const resolution = this.modelCatalog.resolveModelForTask({
      requestedModelId: request.modelRef,
      prompt: request.prompt,
      providerKind
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
      const eventType = route.budgetDecision && !route.budgetDecision.allowed ? "llm_budget_blocked" : "llm_completion_blocked";
      this.recordAuditEvent({
        eventType,
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model?.providerKind ?? request.providerKind ?? this.provider.getProviderKind(),
        modelId: route.model?.id ?? request.modelRef,
        result: "blocked",
        reason: route.reason ?? route.budgetDecision?.reason,
        metadata: { source: "llm_gateway", legacy_runner_call: request.metadata?.legacy_runner_call === true }
      });
      if (eventType === "llm_budget_blocked") {
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
      }
      return { ok: false, reason: route.reason ?? route.budgetDecision?.reason, budgetDecision: route.budgetDecision };
    }
    if (route.model.providerKind !== this.provider.getProviderKind()) {
      const reason = "provider_model_mismatch";
      this.recordAuditEvent({
        eventType: "llm_completion_blocked",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model.providerKind,
        providerId: request.providerId,
        modelId: route.model.id,
        result: "blocked",
        reason,
        metadata: { source: "llm_gateway", legacy_runner_call: request.metadata?.legacy_runner_call === true }
      });
      return { ok: false, reason, budgetDecision: route.budgetDecision };
    }
    const policyDecision = this.evaluateCompletionPolicy(request, route.model, route.budgetDecision);
    if (!policyDecision.allowed) {
      this.recordAuditEvent({
        eventType: route.model.providerKind === "mock" ? "llm_completion_blocked" : "llm_policy_blocked",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model.providerKind,
        providerId: request.providerId,
        modelId: route.model.id,
        result: "blocked",
        reason: policyDecision.reason,
        metadata: {
          source: "llm_gateway",
          policy_decision_id: policyDecision.id,
          matched_rule_ids: policyDecision.matchedRuleIds,
          provider_id: request.providerId,
          legacy_runner_call: request.metadata?.legacy_runner_call === true
        }
      });
      return { ok: false, reason: policyDecision.reason, budgetDecision: route.budgetDecision };
    }
    const providerResult = await this.provider.createCompletion(request, route.model);
    if (!providerResult.ok || !providerResult.result) {
      this.recordAuditEvent({
        eventType: route.model.providerKind === "mock" ? "llm_completion_blocked" : eventTypeForRemoteProviderFailure(providerResult.reason),
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? this.actorId,
        providerKind: route.model.providerKind,
        providerId: request.providerId,
        modelId: route.model.id,
        result: route.model.providerKind === "mock" ? "blocked" : "failed",
        reason: providerResult.reason,
        metadata: { source: "llm_gateway" }
      });
      return { ok: false, reason: providerResult.reason, budgetDecision: route.budgetDecision };
    }
    this.recordAuditEvent({
      eventType: providerResult.result.providerKind === "mock" ? "llm_completion_succeeded" : "llm_remote_completion_completed",
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId ?? this.actorId,
      providerKind: providerResult.result.providerKind,
      providerId: providerResult.result.providerId ?? request.providerId,
      modelId: providerResult.result.modelId,
      result: "allowed",
      metadata: {
        source: "llm_gateway",
        gateway_request_id: providerResult.result.id,
        provider_id: providerResult.result.providerId ?? request.providerId,
        billing_mode: this.providerMetadataForRequest(request).billingMode,
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
        provider_id: result.providerId ?? request.providerId,
        billing_mode: this.providerMetadataForRequest(request).billingMode,
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

  private evaluateCompletionPolicy(request: LLMCompletionRequest, model: LLMModel, budgetDecision: BudgetDecision): PolicyDecision {
    const subject = createPolicySubject({
      actorId: request.actorId ?? this.actorId,
      actorKind: request.actorId ? "user" : "service",
      roles: ["system"]
    });
    const environment = this.policyEnvironmentFor(model, budgetDecision);
    const modelUse = this.policyService.evaluate({
      subject,
      action: "llm.model.use",
      resource: createPolicyResource({
        resourceKind: "llm_model",
        resourceId: model.id,
        metadata: {
          providerKind: model.providerKind,
          status: model.status
        }
      }),
      context: createPolicyContext({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        repoId: request.repoId,
        modelId: model.id,
        providerKind: model.providerKind,
        environment,
        metadata: {
          source: "llm_gateway"
        }
      })
    });
    if (!modelUse.allowed) return modelUse;
    if (model.providerKind !== "mock") {
      const credential = this.policyService.evaluate({
        subject,
        action: "provider.credential.resolve",
        resource: createPolicyResource({
          resourceKind: "provider_credential",
          resourceId: request.providerId ?? model.providerKind,
          metadata: {
            providerKind: model.providerKind,
            credentialSource: this.config.credentialSource
          }
        }),
        context: createPolicyContext({
          taskId: request.taskId,
          taskRunId: request.taskRunId,
          repoId: request.repoId,
          modelId: model.id,
          providerKind: model.providerKind,
          environment,
          metadata: {
            source: "llm_gateway"
          }
        })
      });
      if (!credential.allowed) return credential;
      const providerInvoke = this.policyService.evaluate({
        subject,
        action: "provider.invoke",
        resource: createPolicyResource({
          resourceKind: "llm_provider",
          resourceId: request.providerId ?? model.providerKind,
          metadata: {
            providerKind: model.providerKind
          }
        }),
        context: createPolicyContext({
          taskId: request.taskId,
          taskRunId: request.taskRunId,
          repoId: request.repoId,
          modelId: model.id,
          providerKind: model.providerKind,
          environment,
          metadata: {
            source: "llm_gateway"
          }
        })
      });
      if (!providerInvoke.allowed) return providerInvoke;
      const remote = this.policyService.evaluate({
        subject,
        action: "llm.remote_completion",
        resource: createPolicyResource({
          resourceKind: "llm_provider",
          resourceId: model.providerKind,
          metadata: {
            providerKind: model.providerKind
          }
        }),
        context: createPolicyContext({
          taskId: request.taskId,
          taskRunId: request.taskRunId,
          repoId: request.repoId,
          modelId: model.id,
          providerKind: model.providerKind,
          environment,
          metadata: {
            source: "llm_gateway"
          }
        })
      });
      if (!remote.allowed) return remote;
    }
    return this.policyService.evaluate({
      subject,
      action: "llm.completion",
      resource: createPolicyResource({
        resourceKind: "llm_provider",
        resourceId: model.providerKind,
        metadata: {
          providerKind: model.providerKind
        }
      }),
      context: createPolicyContext({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        repoId: request.repoId,
        modelId: model.id,
        providerKind: model.providerKind,
        environment,
        metadata: {
          source: "llm_gateway"
        }
      })
    });
  }

  private providerMetadataForRequest(request: LLMCompletionRequest): { providerId?: string; billingMode?: string } {
    const metadata = request.metadata ?? {};
    const providerId = request.providerId ?? (typeof metadata.providerId === "string" ? metadata.providerId : undefined);
    const provider = providerId ? this.enterpriseProviderCatalog.getProvider(providerId) : undefined;
    return {
      providerId,
      billingMode: provider?.billingMode ?? (typeof metadata.billingMode === "string" ? metadata.billingMode : undefined)
    };
  }

  private policyEnvironmentFor(model: LLMModel, budgetDecision: BudgetDecision): Record<string, unknown> {
    return {
      budgetAllowed: budgetDecision.allowed,
      remoteLlmEnabled: this.config.remoteLlmEnabled,
      remoteCompletionEnabled: this.config.remoteCompletionEnabled,
      baseUrlConfigured: this.config.baseUrlConfigured,
      credentialsConfigured: this.config.apiKeyConfigured || this.config.openAICompatibleConfigured,
      credentialSource: this.config.credentialSource,
      credentialStatus: this.config.credentialStatus,
      envSecretProviderEnabled: this.config.envSecretProviderEnabled,
      modelAllowlisted: model.providerKind === "mock" || this.isModelAllowlisted(model),
      credentialCacheAccessAllowed: false,
      credentialMaterialStored: false
    };
  }

  private isModelAllowlisted(model: LLMModel): boolean {
    if (this.config.allowedModels.length === 0) return true;
    const remoteModelId = typeof model.metadata.remoteModelId === "string" ? model.metadata.remoteModelId : undefined;
    return this.config.allowedModels.includes(model.id) ||
      (remoteModelId !== undefined && this.config.allowedModels.includes(remoteModelId)) ||
      (this.config.defaultModel !== undefined && this.config.allowedModels.includes(this.config.defaultModel));
  }
}

export function createDefaultLlmGatewayService(input: Omit<LLMGatewayServiceInput, "provider" | "config"> = {}): LLMGatewayService {
  const runtime = createLlmProviderFromEnv(process.env, { credentialResolver: input.credentialResolver });
  return new LLMGatewayService({
    ...input,
    provider: runtime.provider,
    config: runtime.config
  });
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return sanitizeSecurityMetadata(metadata) as Record<string, unknown>;
}

function eventTypeForRemoteProviderFailure(reason: string | undefined): string {
  if (!reason) return "llm_remote_completion_failed";
  if (reason.includes("disabled") || reason.includes("missing") || reason.includes("allowlist")) {
    return "llm_remote_completion_blocked";
  }
  if (reason.includes("http") || reason.includes("provider_error") || reason.includes("timeout")) {
    return "llm_provider_error";
  }
  return "llm_remote_completion_failed";
}
