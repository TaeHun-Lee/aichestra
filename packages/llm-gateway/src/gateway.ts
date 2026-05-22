import { createId } from "@aichestra/core";
import {
  ServiceAccountContextFactory,
  ScopeContextFactory,
  createServiceAccountPolicySubject,
  serviceAccountAuditMetadata
} from "@aichestra/auth";
import type { AuthContext, AuthorizationDecision, AuthorizationServiceInterface } from "@aichestra/auth";
import type { LlmCallInput, LlmCallResult, LlmGateway as LegacyLlmGateway } from "@aichestra/adapters";
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject
} from "@aichestra/policy";
import { sanitizeSecurityMetadata } from "@aichestra/security";
import type { PolicyDecision, PolicyResourceScope } from "@aichestra/policy";
import { ModelCatalogService, type ModelCatalogRepository } from "./catalog.ts";
import { ProviderCatalogService } from "./enterprise-providers.ts";
import {
  AnthropicCompatibleLLMProviderSkeleton,
  AzureCompatibleLLMProviderSkeleton,
  BedrockCompatibleLLMProviderSkeleton,
  GeminiCompatibleLLMProviderSkeleton,
  LiteLLMCompatibleLLMProviderSkeleton,
  LocalCliLLMProviderBridgeSkeleton,
  MockLLMProvider,
  OpenAICompatibleLLMProvider,
  VertexCompatibleLLMProviderSkeleton,
  createLlmProviderFromEnv,
  type LlmCredentialResolver,
  type LlmLegacyCredentialFallbackAuditEvent
} from "./providers.ts";
import {
  InMemoryLLMFallbackPolicyRepository,
  InMemoryLLMRouteRepository,
  InMemoryLLMRoutingDecisionRepository,
  type LLMFallbackPolicyRepository,
  type LLMRouteRepository,
  type LLMRoutingDecisionRepository
} from "./routing.ts";
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
  LLMFallbackPolicy,
  LLMModel,
  LLMProvider,
  LLMProviderHealth,
  LLMProviderKind,
  LLMProviderRuntimeConfig,
  LLMRoute,
  LLMRouteResult,
  LLMRoutingDecision,
  LLMRoutingRequest,
  LLMUsageRepository,
  VirtualModelKey
} from "./types.ts";
import { evaluateRealLlmEnablement, type RealLlmEnablementReadiness } from "./real-llm-enablement.ts";

/**
 * Virtual key used for attribution and budget enforcement when a request does
 * not specify one. Kept in one place so usage recording and budget aggregation
 * resolve to the same key id.
 */
const DEFAULT_SYSTEM_VIRTUAL_KEY_ID = "vmk_system_mock";

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
  authorizationService?: AuthorizationServiceInterface;
  enterpriseProviderCatalog?: ProviderCatalogService;
  credentialResolver?: LlmCredentialResolver;
  routeRepository?: LLMRouteRepository;
  fallbackPolicyRepository?: LLMFallbackPolicyRepository;
  routingDecisionRepository?: LLMRoutingDecisionRepository;
  legacyCredentialFallbackAuditor?: (event: LlmLegacyCredentialFallbackAuditEvent) => void;
  /**
   * When true, the gateway refuses to issue real (non-mock) completions unless
   * the consolidated real-LLM enablement preflight is ready (fail-closed).
   * Defaults to false to preserve the granular routing gates. Production /
   * pilot runtimes should enable this.
   */
  enforceRealLlmEnablement?: boolean;
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
  private readonly authorizationService?: AuthorizationServiceInterface;
  private readonly serviceAccountContextFactory?: ServiceAccountContextFactory;
  private readonly enterpriseProviderCatalog: ProviderCatalogService;
  private readonly routeRepository: LLMRouteRepository;
  private readonly fallbackPolicyRepository: LLMFallbackPolicyRepository;
  private readonly routingDecisionRepository: LLMRoutingDecisionRepository;
  private readonly enforceRealLlmEnablement: boolean;
  private readonly scopeContextFactory = new ScopeContextFactory();

  constructor(input: LLMGatewayServiceInput = {}) {
    const providerConfig = input.config ?? createLlmProviderFromEnv({}).config;
    this.provider = input.provider ?? new MockLLMProvider();
    this.config = providerConfig;
    this.modelCatalog = new ModelCatalogService(input.modelCatalogRepository);
    this.virtualKeys = new VirtualModelKeyService(input.virtualKeyRepository);
    this.auditRepository = input.auditRepository ?? new InMemoryLLMAuditRepository();
    this.usageRepository = input.usageRepository;
    this.actorId = input.actorId ?? "llm_gateway_service";
    this.recordLegacyUsage = input.recordLegacyUsage ?? false;
    this.policyService = input.policyService ?? new PolicyService();
    this.authorizationService = input.authorizationService;
    this.serviceAccountContextFactory = input.authorizationService
      ? new ServiceAccountContextFactory({ authorizationService: input.authorizationService })
      : undefined;
    this.enterpriseProviderCatalog = input.enterpriseProviderCatalog ?? new ProviderCatalogService();
    this.routeRepository = input.routeRepository ?? new InMemoryLLMRouteRepository();
    this.fallbackPolicyRepository = input.fallbackPolicyRepository ?? new InMemoryLLMFallbackPolicyRepository();
    this.routingDecisionRepository = input.routingDecisionRepository ?? new InMemoryLLMRoutingDecisionRepository();
    this.enforceRealLlmEnablement = input.enforceRealLlmEnablement ?? false;
  }

  /**
   * Consolidated, fail-closed readiness for the real OpenAI-compatible LLM
   * path. Returns metadata only (no secret values). Use this as the single
   * "is it safe to issue real LLM calls?" check for ops / dashboards.
   */
  getRealLlmEnablementReadiness(): RealLlmEnablementReadiness {
    const key = this.virtualKeys.getVirtualKey(DEFAULT_SYSTEM_VIRTUAL_KEY_ID);
    return evaluateRealLlmEnablement({
      config: this.getConfig(),
      budgetVirtualKey: key ?? undefined
    });
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
      },
      {
        providerKind: "anthropic_compatible",
        default: false,
        remote: true,
        enabled: false,
        skeleton: true,
        reason: "provider_not_implemented"
      },
      {
        providerKind: "gemini_compatible",
        default: false,
        remote: true,
        enabled: false,
        skeleton: true,
        reason: "provider_not_implemented"
      },
      {
        providerKind: "bedrock_compatible",
        default: false,
        remote: true,
        enabled: false,
        skeleton: true,
        reason: "provider_not_implemented"
      },
      {
        providerKind: "vertex_compatible",
        default: false,
        remote: true,
        enabled: false,
        skeleton: true,
        reason: "provider_not_implemented"
      },
      {
        providerKind: "azure_compatible",
        default: false,
        remote: true,
        enabled: false,
        skeleton: true,
        reason: "provider_not_implemented"
      },
      {
        providerKind: "litellm_compatible",
        default: false,
        remote: true,
        enabled: false,
        skeleton: true,
        reason: "provider_not_implemented"
      },
      {
        providerKind: "local_cli",
        default: false,
        remote: false,
        enabled: false,
        skeleton: true,
        localAgentRequired: true,
        reason: "local_agent_required"
      }
    ];
  }

  getRoutingConfig() {
    return {
      routingMode: this.config.routingMode,
      fallbackEnabled: this.config.fallbackEnabled,
      maxFallbackAttempts: this.config.maxFallbackAttempts,
      allowedProviderKinds: this.config.allowedProviderKinds,
      allowedProviderIds: this.config.allowedProviderIds,
      deniedProviderIds: this.config.deniedProviderIds,
      allowedModels: this.config.allowedModels,
      deniedModels: this.config.deniedModels,
      defaultRouteProviderKind: "mock",
      remoteLlmEnabled: this.config.remoteLlmEnabled,
      remoteCompletionEnabled: this.config.remoteCompletionEnabled,
      secretsExposed: false
    };
  }

  listRoutes(): LLMRoute[] {
    return this.routeRepository.listRoutes();
  }

  createRoute(input: Omit<LLMRoute, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): LLMRoute {
    const route = this.routeRepository.createRoute(input);
    this.recordAuditEvent({
      eventType: "llm_route_created",
      providerKind: route.providerKind,
      providerId: route.providerId,
      modelId: route.modelId,
      result: "allowed",
      metadata: {
        route_id: route.id,
        enabled: route.enabled,
        requires_remote: route.requiresRemote,
        requires_secret_ref: route.requiresSecretRef
      }
    });
    return route;
  }

  updateRouteStatus(id: string, enabled: boolean): LLMRoute {
    const route = this.routeRepository.updateRouteStatus(id, enabled);
    this.recordAuditEvent({
      eventType: enabled ? "llm_route_enabled" : "llm_route_disabled",
      providerKind: route.providerKind,
      providerId: route.providerId,
      modelId: route.modelId,
      result: "allowed",
      metadata: { route_id: route.id, enabled }
    });
    return route;
  }

  listFallbackPolicies(): LLMFallbackPolicy[] {
    return this.fallbackPolicyRepository.listPolicies();
  }

  createFallbackPolicy(input: Omit<LLMFallbackPolicy, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): LLMFallbackPolicy {
    const policy = this.fallbackPolicyRepository.createPolicy(input);
    this.recordAuditEvent({
      eventType: "llm_fallback_policy_created",
      providerKind: policy.allowedProviderKinds[0] ?? "mock",
      result: "allowed",
      metadata: {
        fallback_policy_id: policy.id,
        enabled: policy.enabled,
        max_attempts: policy.maxAttempts
      }
    });
    return policy;
  }

  listRoutingDecisions(): LLMRoutingDecision[] {
    return this.routingDecisionRepository.listDecisions();
  }

  listProviderHealth(): LLMProviderHealth[] {
    const now = new Date();
    const providerKinds = new Set<LLMProviderKind>(this.listRoutes().map((route) => route.providerKind));
    providerKinds.add("mock");
    providerKinds.add("openai_compatible");
    return [...providerKinds].sort().map((providerKind) => this.providerHealthFor(providerKind, now));
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
    if (!route.ok || !route.model || !route.budgetDecision?.allowed || !route.route) {
      const eventType = route.budgetDecision && !route.budgetDecision.allowed
        ? "llm_budget_blocked"
        : route.routingDecision?.decision === "policy_blocked" && (route.routingDecision.selectedProviderKind ?? request.providerKind) !== "mock"
          ? "llm_policy_blocked"
          : "llm_completion_blocked";
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
        budgetDecision: route.budgetDecision,
        routingDecision: route.routingDecision
      };
    }
    const selectedRoutingDecision = route.routingDecision;
    if (!selectedRoutingDecision) {
      return { ok: false, reason: "routing_decision_missing", budgetDecision: route.budgetDecision };
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
      return { ok: false, reason: policyDecision.reason, budgetDecision: route.budgetDecision, routingDecision: route.routingDecision };
    }

    if (route.model.providerKind !== "mock") {
      if (this.enforceRealLlmEnablement) {
        const readiness = this.getRealLlmEnablementReadiness();
        if (!readiness.ready) {
          this.recordAuditEvent({
            eventType: "llm_remote_completion_blocked",
            taskId: request.taskId,
            taskRunId: request.taskRunId,
            actorId: request.actorId ?? this.actorId,
            providerKind: route.model.providerKind,
            providerId: request.providerId,
            modelId: route.model.id,
            result: "blocked",
            reason: "real_llm_enablement_not_ready",
            metadata: { source: "llm_gateway", blockers: readiness.blockers }
          });
          return {
            ok: false,
            reason: "real_llm_enablement_not_ready",
            budgetDecision: route.budgetDecision,
            routingDecision: route.routingDecision
          };
        }
      }
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

    const provider = this.providerForRoute(route.route);
    const providerIdForCall = route.route.providerKind === "mock" ? request.providerId ?? route.route.providerId : route.route.providerId;
    const providerResult = await provider.createCompletion({
      ...request,
      providerId: providerIdForCall,
      providerKind: route.route.providerKind
    }, route.model);
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
      const fallback = await this.tryFallback(request, route.route, route.budgetDecision, providerResult.reason);
      if (fallback?.ok) return fallback;
      return {
        ok: false,
        reason: fallback?.reason ?? providerResult.reason,
        budgetDecision: route.budgetDecision,
        routingDecision: route.routingDecision,
        fallbackAttempts: fallback?.fallbackAttempts
      };
    }

    const usageEvent = this.recordUsage(providerResult.result, {
      ...request,
      providerId: providerIdForCall,
      metadata: {
        ...(request.metadata ?? {}),
        routeId: route.route.id,
        routingDecisionId: selectedRoutingDecision.id,
        fallbackAttempt: 0
      }
    });
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
        route_id: route.route.id,
        routing_decision_id: selectedRoutingDecision.id,
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
      budgetDecision: route.budgetDecision,
      routingDecision: selectedRoutingDecision
    };
  }

  routeRequest(request: LLMCompletionRequest): LLMRouteResult {
    const selection = this.selectRouteForRequest(request);
    return {
      ok: selection.routingDecision.decision === "selected",
      model: selection.model,
      route: selection.route,
      budgetDecision: selection.budgetDecision,
      routingDecision: selection.routingDecision,
      reason: selection.routingDecision.decision === "selected" ? undefined : selection.routingDecision.reason
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
    const key = this.virtualKeys.getVirtualKey(request.virtualKeyId ?? DEFAULT_SYSTEM_VIRTUAL_KEY_ID);
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
    const perTaskLimit = Math.min(...[request.budgetLimitUsd, key.perTaskBudgetUsd].filter((value): value is number => typeof value === "number"));
    if (Number.isFinite(perTaskLimit) && estimatedCostUsd > perTaskLimit) {
      return this.budgetDecision(request, model, estimatedCostUsd, false, "budget_exceeded", perTaskLimit - estimatedCostUsd);
    }

    // Cumulative monthly enforcement. The per-task limit above only inspects
    // the cost of the current request, so without this a key could blow past
    // its monthlyBudgetUsd across many small calls. Aggregate prior spend for
    // the key (durable whenever the usage repository is Postgres-backed) and
    // enforce the monthly cap so it survives process restarts.
    let monthlyRemaining: number | undefined;
    if (typeof key.monthlyBudgetUsd === "number" && Number.isFinite(key.monthlyBudgetUsd)) {
      const spentThisMonth = this.cumulativeMonthlySpendForKey(key.id);
      monthlyRemaining = Number((key.monthlyBudgetUsd - spentThisMonth).toFixed(6));
      if (estimatedCostUsd > monthlyRemaining) {
        return this.budgetDecision(request, model, estimatedCostUsd, false, "monthly_budget_exceeded", Math.max(0, monthlyRemaining));
      }
    }

    const remainingAfterCall = [
      Number.isFinite(perTaskLimit) ? perTaskLimit - estimatedCostUsd : undefined,
      monthlyRemaining !== undefined ? monthlyRemaining - estimatedCostUsd : undefined
    ].filter((value): value is number => typeof value === "number");
    const budgetRemainingUsd = remainingAfterCall.length > 0
      ? Number(Math.min(...remainingAfterCall).toFixed(6))
      : undefined;
    return this.budgetDecision(request, model, estimatedCostUsd, true, "allowed", budgetRemainingUsd);
  }

  /**
   * Sum the LLM-gateway spend already attributed to a virtual key within the
   * current UTC calendar month. Returns 0 when no usage repository is wired
   * (cumulative tracking is unavailable) so the per-task limit still applies.
   */
  private cumulativeMonthlySpendForKey(virtualKeyId: string): number {
    if (!this.usageRepository) return 0;
    const now = new Date();
    const monthStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    let total = 0;
    for (const event of this.usageRepository.listUsageEvents()) {
      if (event.metadata?.source !== "llm_gateway") continue;
      if (event.metadata?.virtual_key_id !== virtualKeyId) continue;
      if (event.createdAt.getTime() < monthStartMs) continue;
      total += event.costUsd ?? 0;
    }
    return Number(total.toFixed(6));
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
    const metadata = sanitizeMetadata(input.metadata);
    return this.auditRepository.appendAuditEvent({
      ...input,
      requestId: input.requestId ?? stringMetadata(metadata.requestId) ?? stringMetadata(metadata.request_id),
      correlationId: input.correlationId ?? stringMetadata(metadata.correlationId) ?? stringMetadata(metadata.correlation_id),
      source: input.source ?? stringMetadata(metadata.source),
      serviceAccountId: input.serviceAccountId ?? stringMetadata(metadata.serviceAccountId),
      metadata
    });
  }

  listAuditEvents(): LLMAuditEvent[] {
    return this.auditRepository.listAuditEvents();
  }

  listUsageEvents() {
    return this.usageRepository?.listUsageEvents().filter((event) => event.metadata?.source === "llm_gateway") ?? [];
  }

  private selectRouteForRequest(
    request: LLMCompletionRequest,
    options: { excludedRouteIds?: string[]; fallbackAttempt?: number } = {}
  ): { route?: LLMRoute; model?: LLMModel; budgetDecision?: BudgetDecision; routingDecision: LLMRoutingDecision } {
    const routingRequest = this.toRoutingRequest(request);
    this.recordAuditEvent({
      eventType: options.fallbackAttempt ? "llm_fallback_started" : "llm_routing_requested",
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: this.actorIdForRequest(request),
      principalId: this.principalIdForRequest(request),
      requestId: request.requestContext?.requestId ?? request.authContext?.requestId,
      correlationId: request.requestContext?.correlationId ?? stringMetadata(request.authContext?.metadata.correlationId),
      source: request.requestContext?.source ?? request.authContext?.source,
      providerKind: request.providerKind ?? "mock",
      providerId: request.providerId,
      modelId: request.modelRef,
      result: "allowed",
      metadata: {
        source: "llm_gateway",
        routing_request_id: routingRequest.id,
        prompt_class: routingRequest.promptClass,
        requested_capabilities: routingRequest.requestedCapabilities,
        ...this.requestContextMetadata(request),
        fallback_attempt: options.fallbackAttempt ?? 0
      }
    });

    const excluded = new Set(options.excludedRouteIds ?? []);
    if (request.modelRef) {
      const requestedModel = this.getModel(request.modelRef);
      if (requestedModel && requestedModel.status !== "active") {
        return {
          model: requestedModel,
          routingDecision: this.recordRoutingDecision({
            request,
            routingRequest,
            model: requestedModel,
            decision: "no_route",
            reason: `No selectable model satisfies ${requestedModel.id}.`,
            fallbackChain: [...excluded],
            metadata: {
              model_status: requestedModel.status,
              fallback_attempt: options.fallbackAttempt ?? 0
            }
          })
        };
      }
    }
    const candidates = this.listRoutes()
      .filter((route) => !excluded.has(route.id))
      .filter((route) => this.routeMatchesRequest(route, request, routingRequest));

    if (candidates.length === 0) {
      return {
        routingDecision: this.recordRoutingDecision({
          request,
          routingRequest,
          decision: "no_route",
          reason: this.noRouteReason(request),
          fallbackChain: [...excluded],
          metadata: { fallback_attempt: options.fallbackAttempt ?? 0 }
        })
      };
    }

    for (const route of candidates) {
      const model = this.getModel(route.modelId);
      if (!model) continue;
      if (route.requiresSecretRef && this.config.credentialStatus !== "resolved") {
        return {
          route,
          model,
          routingDecision: this.recordRoutingDecision({
            request,
            routingRequest,
            route,
            model,
            decision: "credentials_blocked",
            reason: this.config.credentialReason ?? this.config.credentialStatus,
            credentialResolutionId: typeof request.metadata?.credentialResolutionId === "string" ? request.metadata.credentialResolutionId : undefined,
            fallbackChain: [...excluded, route.id],
            metadata: {
              credential_status: this.config.credentialStatus,
              credential_source: this.config.credentialSource,
              fallback_attempt: options.fallbackAttempt ?? 0
            }
          })
        };
      }
      if (route.providerKind === "local_cli") {
        const health = this.providerHealthFor(route.providerKind);
        return {
          route,
          model,
          routingDecision: this.recordRoutingDecision({
            request,
            routingRequest,
            route,
            model,
            decision: "provider_unavailable",
            reason: health.reason ?? "provider_unavailable",
            fallbackChain: [...excluded, route.id],
            metadata: {
              provider_health_status: health.status,
              fallback_attempt: options.fallbackAttempt ?? 0
            }
          })
        };
      }

      const budgetDecision = this.checkBudget({
        ...request,
        providerId: route.providerId,
        providerKind: route.providerKind
      }, model);
      if (!budgetDecision.allowed) {
        return {
          route,
          model,
          budgetDecision,
          routingDecision: this.recordRoutingDecision({
            request,
            routingRequest,
            route,
            model,
            budgetDecision,
            decision: "budget_blocked",
            reason: budgetDecision.reason,
            fallbackChain: [...excluded, route.id],
            metadata: { fallback_attempt: options.fallbackAttempt ?? 0 }
          })
        };
      }

      const authorization = this.evaluateRouteAuthorization(request, route, model, budgetDecision);
      if (authorization && !authorization.allowed) {
        return {
          route,
          model,
          budgetDecision,
          routingDecision: this.recordRoutingDecision({
            request,
            routingRequest,
            route,
            model,
            budgetDecision,
            authorizationDecision: authorization,
            decision: "policy_blocked",
            reason: authorization.reason,
            fallbackChain: [...excluded, route.id],
            metadata: { source: "authorization_service", fallback_attempt: options.fallbackAttempt ?? 0 }
          })
        };
      }

      const policyDecision = this.evaluateRouteSelectPolicy(request, route, model, budgetDecision);
      if (!policyDecision.allowed) {
        return {
          route,
          model,
          budgetDecision,
          routingDecision: this.recordRoutingDecision({
            request,
            routingRequest,
            route,
            model,
            budgetDecision,
            policyDecision,
            decision: "policy_blocked",
            reason: policyDecision.reason,
            fallbackChain: [...excluded, route.id],
            metadata: { fallback_attempt: options.fallbackAttempt ?? 0 }
          })
        };
      }

      if (route.requiresSecretRef && this.config.credentialStatus !== "resolved") {
        return {
          route,
          model,
          budgetDecision,
          routingDecision: this.recordRoutingDecision({
            request,
            routingRequest,
            route,
            model,
            budgetDecision,
            decision: "credentials_blocked",
            reason: this.config.credentialReason ?? this.config.credentialStatus,
            credentialResolutionId: typeof request.metadata?.credentialResolutionId === "string" ? request.metadata.credentialResolutionId : undefined,
            fallbackChain: [...excluded, route.id],
            metadata: {
              credential_status: this.config.credentialStatus,
              credential_source: this.config.credentialSource,
              fallback_attempt: options.fallbackAttempt ?? 0
            }
          })
        };
      }

      const health = this.providerHealthFor(route.providerKind);
      if (health.status !== "healthy") {
        return {
          route,
          model,
          budgetDecision,
          routingDecision: this.recordRoutingDecision({
            request,
            routingRequest,
            route,
            model,
            budgetDecision,
            decision: "provider_unavailable",
            reason: health.reason ?? "provider_unavailable",
            fallbackChain: [...excluded, route.id],
            metadata: {
              provider_health_status: health.status,
              fallback_attempt: options.fallbackAttempt ?? 0
            }
          })
        };
      }

      return {
        route,
        model,
        budgetDecision,
        routingDecision: this.recordRoutingDecision({
          request,
          routingRequest,
          route,
          model,
          budgetDecision,
          policyDecision,
          authorizationDecision: authorization,
          decision: "selected",
          reason: "route_selected",
          fallbackChain: [...excluded, route.id],
          metadata: { fallback_attempt: options.fallbackAttempt ?? 0 }
        })
      };
    }

    return {
      routingDecision: this.recordRoutingDecision({
        request,
        routingRequest,
        decision: "no_route",
        reason: "no_selectable_route",
        fallbackChain: [...excluded],
        metadata: { fallback_attempt: options.fallbackAttempt ?? 0 }
      })
    };
  }

  private toRoutingRequest(request: LLMCompletionRequest): LLMRoutingRequest {
    return {
      id: createId("llmroute_req"),
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: this.actorIdForRequest(request),
      principalId: this.principalIdForRequest(request),
      requestedModelId: request.modelRef,
      requestedCapabilities: request.requestedCapabilities ?? capabilitiesForPromptClass(request.promptClass ?? inferPromptClass(request.prompt)),
      promptClass: request.promptClass ?? inferPromptClass(request.prompt),
      priority: "normal",
      maxFallbackAttempts: Math.max(0, Math.min(request.maxFallbackAttempts ?? this.config.maxFallbackAttempts, this.config.maxFallbackAttempts)),
      budgetLimitUsd: request.budgetLimitUsd,
      metadata: sanitizeMetadata({
        ...(request.metadata ?? {}),
        ...this.requestContextMetadata(request)
      })
    };
  }

  private routeMatchesRequest(route: LLMRoute, request: LLMCompletionRequest, routingRequest: LLMRoutingRequest): boolean {
    if (!route.enabled) return false;
    if (this.config.routingMode === "mock_only" && route.providerKind !== "mock") return false;
    if (this.config.routingMode === "single_provider" && route.providerKind !== "mock" && route.providerKind !== this.config.providerKind) return false;
    if (request.providerKind && route.providerKind !== request.providerKind) return false;
    if (request.providerId && route.providerId !== request.providerId && route.providerKind !== request.providerId && route.providerKind !== "mock") return false;
    if (request.modelRef && route.modelId !== request.modelRef) return false;
    if (this.config.allowedProviderKinds.length > 0 && !this.config.allowedProviderKinds.includes(route.providerKind)) return false;
    if (this.config.allowedProviderIds.length > 0 && !this.config.allowedProviderIds.includes(route.providerId)) return false;
    if (this.config.deniedProviderIds.includes(route.providerId)) return false;
    if (this.config.deniedModels.includes(route.modelId)) return false;
    if (route.providerKind !== "mock" && this.config.allowedModels.length > 0 && !this.isRouteModelAllowlisted(route)) return false;
    const model = this.getModel(route.modelId);
    if (!model || model.status !== "active") return false;
    if (!request.modelRef && !route.promptClasses.includes(routingRequest.promptClass) && !route.promptClasses.includes("unknown")) return false;
    return request.modelRef !== undefined || routingRequest.requestedCapabilities.every((capability) => route.capabilities.includes(capability));
  }

  private noRouteReason(request: LLMCompletionRequest): string {
    if (this.config.routingMode === "mock_only" && request.providerKind && request.providerKind !== "mock") return "routing_mode_mock_only";
    if (request.modelRef && this.config.deniedModels.includes(request.modelRef)) return "model_denied_by_config";
    if (request.providerId && this.config.deniedProviderIds.includes(request.providerId)) return "provider_denied_by_config";
    return "no_route_found";
  }

  private providerHealthFor(providerKind: LLMProviderKind, checkedAt = new Date()): LLMProviderHealth {
    if (providerKind === "mock") {
      return { providerId: "mock", providerKind, status: "healthy", remoteEnabled: false, lastCheckedAt: checkedAt, metadata: {} };
    }
    if (providerKind === "openai_compatible") {
      const configured = this.config.remoteLlmEnabled &&
        this.config.remoteCompletionEnabled &&
        this.config.baseUrlConfigured &&
        this.config.credentialStatus === "resolved";
      return {
        providerId: "openai-api-key",
        providerKind,
        status: configured ? "healthy" : "disabled",
        remoteEnabled: this.config.remoteLlmEnabled,
        lastCheckedAt: checkedAt,
        reason: configured ? undefined : "openai_compatible_gates_not_configured",
        metadata: {
          baseUrlConfigured: this.config.baseUrlConfigured,
          credentialStatus: this.config.credentialStatus,
          skeleton: false
        }
      };
    }
    if (providerKind === "local_cli") {
      return {
        providerId: "local_cli",
        providerKind,
        status: "unavailable",
        remoteEnabled: false,
        lastCheckedAt: checkedAt,
        reason: "local_agent_required",
        metadata: { directInvocation: false, credentialCacheAccessAllowed: false }
      };
    }
    return {
      providerId: providerKind,
      providerKind,
      status: "disabled",
      remoteEnabled: false,
      lastCheckedAt: checkedAt,
      reason: "provider_not_implemented",
      metadata: { skeleton: true, noNetworkCalls: true }
    };
  }

  private evaluateRouteAuthorization(
    request: LLMCompletionRequest,
    route: LLMRoute,
    model: LLMModel,
    budgetDecision: BudgetDecision
  ): AuthorizationDecision | undefined {
    if (!this.authorizationService) return undefined;
    const authContext = this.resolveAuthContext(request);
    return this.authorizationService.check({
      authContext,
      action: "llm.route.select",
      resource: {
        resourceKind: "llm_route",
        resourceId: route.id,
        metadata: {
          providerKind: route.providerKind,
          providerId: route.providerId,
          modelId: model.id
        }
      },
      policyContext: {
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        repoId: request.repoId,
        modelId: model.id,
        providerKind: route.providerKind,
        environment: this.policyEnvironmentFor(model, budgetDecision),
        metadata: { source: "llm_gateway", routeId: route.id, ...this.requestContextMetadata(request) }
      }
    });
  }

  private resolveAuthContext(request: LLMCompletionRequest): AuthContext {
    if (request.requestContext) return request.requestContext.authContext;
    if (request.authContext) return request.authContext;
    if (!this.authorizationService) throw new Error("authorization_service_unavailable");
    return this.serviceAccountContextFactory?.createServiceAccountAuthContext("llm_gateway_service", {
      source: "system",
      metadata: { source: "llm_gateway", mockGatewayDefault: true, requestedActorId: request.actorId }
    }) ?? this.authorizationService.getAuthContext({
      actorId: "llm_gateway_service",
      source: "system",
      metadata: { source: "llm_gateway", mockGatewayDefault: true, requestedActorId: request.actorId }
    });
  }

  private evaluateRouteSelectPolicy(request: LLMCompletionRequest, route: LLMRoute, model: LLMModel, budgetDecision: BudgetDecision): PolicyDecision {
    const authContext = request.requestContext?.authContext ?? request.authContext;
    const subject = authContext && this.authorizationService
      ? this.authorizationService.toPolicySubject(authContext)
      : createPolicySubject({
        actorId: request.actorId ?? this.actorId,
        actorKind: request.actorId ? "user" : "service_account",
        roles: request.actorId ? ["system"] : ["service_account_llm_router"],
        authMode: request.actorId ? undefined : "mock_service_account",
        serviceAccountId: request.actorId ? undefined : "llm_router_service",
        isMockActor: request.actorId ? undefined : true,
        metadata: request.actorId ? undefined : serviceAccountAuditMetadata("llm_router_service", { boundary: "llm_route_select_policy" })
      });
    return this.policyService.evaluate({
      subject,
      action: "llm.route.select",
      resource: createPolicyResource({
        resourceKind: "llm_route",
        resourceId: route.id,
        metadata: {
          providerKind: route.providerKind,
          providerId: route.providerId,
          modelId: model.id,
          status: model.status
        }
      }),
      context: createPolicyContext({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        repoId: request.repoId,
        modelId: model.id,
        providerKind: route.providerKind,
        environment: this.policyEnvironmentFor(model, budgetDecision),
        metadata: { source: "llm_gateway", routeId: route.id, ...this.requestContextMetadata(request) }
      })
    });
  }

  private recordRoutingDecision(input: {
    request: LLMCompletionRequest;
    routingRequest: LLMRoutingRequest;
    route?: LLMRoute;
    model?: LLMModel;
    budgetDecision?: BudgetDecision;
    policyDecision?: PolicyDecision;
    authorizationDecision?: AuthorizationDecision;
    credentialResolutionId?: string;
    decision: LLMRoutingDecision["decision"];
    reason: string;
    fallbackChain: string[];
    metadata: Record<string, unknown>;
  }): LLMRoutingDecision {
    const decision = this.routingDecisionRepository.recordDecision({
      requestId: input.routingRequest.id,
      selectedProviderId: input.route?.providerId,
      selectedProviderKind: input.route?.providerKind,
      selectedModelId: input.model?.id,
      selectedRouteId: input.route?.id,
      fallbackChain: input.fallbackChain,
      decision: input.decision,
      reason: input.reason,
      policyDecisionId: input.policyDecision?.id,
      budgetDecisionId: input.budgetDecision?.budgetDecisionId ?? input.budgetDecision?.reason,
      credentialResolutionId: input.credentialResolutionId,
      authorizationDecisionId: input.authorizationDecision?.auditEvent?.id,
      metadata: sanitizeMetadata({
        ...input.metadata,
        ...this.llmScopeMetadata(input.request, input.route, input.model),
        task_id: input.request.taskId,
        task_run_id: input.request.taskRunId,
        actor_id: this.actorIdForRequest(input.request),
        principal_id: this.principalIdForRequest(input.request),
        ...this.requestContextMetadata(input.request),
        prompt_class: input.routingRequest.promptClass
      })
    });
    this.recordAuditEvent({
      eventType: input.decision === "selected" ? "llm_route_selected" : input.decision === "no_route" ? "llm_no_route_found" : "llm_route_blocked",
      taskId: input.request.taskId,
      taskRunId: input.request.taskRunId,
      actorId: this.actorIdForRequest(input.request),
      principalId: this.principalIdForRequest(input.request),
      requestId: input.request.requestContext?.requestId ?? input.request.authContext?.requestId,
      correlationId: input.request.requestContext?.correlationId ?? stringMetadata(input.request.authContext?.metadata.correlationId),
      source: input.request.requestContext?.source ?? input.request.authContext?.source,
      providerKind: input.route?.providerKind ?? input.request.providerKind ?? "mock",
      providerId: input.route?.providerId ?? input.request.providerId,
      modelId: input.model?.id ?? input.request.modelRef,
      result: input.decision === "selected" ? "allowed" : "blocked",
      reason: input.reason,
      metadata: {
        routing_decision_id: decision.id,
        route_id: input.route?.id,
        policy_decision_id: input.policyDecision?.id,
        authorization_decision_id: input.authorizationDecision?.auditEvent?.id,
        budget_decision_id: input.budgetDecision?.budgetDecisionId ?? input.budgetDecision?.reason,
        ...this.requestContextMetadata(input.request),
        ...this.llmScopeMetadata(input.request, input.route, input.model),
        decision: input.decision
      }
    });
    return decision;
  }

  private actorIdForRequest(request: LLMCompletionRequest): string {
    return request.requestContext?.authContext.actor.id ?? request.authContext?.actor.id ?? request.actorId ?? this.actorId;
  }

  private principalIdForRequest(request: LLMCompletionRequest): string | undefined {
    return request.requestContext?.authContext.principal.id ?? request.authContext?.principal.id ?? request.principalId;
  }

  private requestContextMetadata(request: LLMCompletionRequest): Record<string, unknown> {
    const authContext = request.requestContext?.authContext ?? request.authContext;
    const metadata: Record<string, unknown> = {};
    const requestId = request.requestContext?.requestId ?? authContext?.requestId;
    const correlationId = request.requestContext?.correlationId ?? stringMetadata(authContext?.metadata.correlationId);
    const source = request.requestContext?.source ?? authContext?.source;
    const actorId = authContext?.actor.id ?? request.actorId;
    const principalId = authContext?.principal.id ?? request.principalId;
    if (requestId) metadata.requestId = requestId;
    if (correlationId) metadata.correlationId = correlationId;
    if (source) metadata.requestSource = source;
    if (actorId) metadata.actorId = actorId;
    if (principalId) metadata.principalId = principalId;
    if (authContext?.authMode) metadata.authMode = authContext.authMode;
    const tenantId = request.requestContext?.tenantId ?? authContext?.tenantScopes?.[0]?.tenantId;
    const teamId = request.requestContext?.teamId ?? authContext?.teamScopes?.[0]?.teamId;
    const projectId = request.requestContext?.projectId ?? authContext?.projectScopes?.[0]?.projectId;
    const resourceScopes = request.requestContext?.resourceScopes ?? authContext?.resourceScopes;
    if (tenantId) metadata.tenantId = tenantId;
    if (teamId) metadata.teamId = teamId;
    if (projectId) metadata.projectId = projectId;
    if (resourceScopes) metadata.resourceScopes = resourceScopes;
    const serviceAccountId = stringMetadata(authContext?.metadata.serviceAccountId);
    if (serviceAccountId) metadata.serviceAccountId = serviceAccountId;
    if (!authContext && !request.actorId && this.actorId === "llm_gateway_service") {
      Object.assign(metadata, serviceAccountAuditMetadata("llm_gateway_service", { boundary: "llm_gateway_service" }));
    }
    return metadata;
  }

  private llmScopeMetadata(request: LLMCompletionRequest, route?: LLMRoute, model?: LLMModel): Record<string, unknown> {
    const providerId = route?.providerId ?? request.providerId ?? model?.providerKind ?? request.providerKind ?? this.provider.getProviderKind();
    const providerKind = route?.providerKind ?? model?.providerKind ?? request.providerKind ?? this.provider.getProviderKind();
    const tenantId = request.requestContext?.tenantId;
    const teamId = request.requestContext?.teamId;
    const projectId = request.requestContext?.projectId;
    const providerScope = this.scopeContextFactory.createProviderScope({
      tenantId,
      teamId,
      projectId,
      providerId,
      providerKind,
      metadata: { remoteLlmEnabled: this.config.remoteLlmEnabled, completionEnabled: this.config.remoteCompletionEnabled }
    });
    const modelScope = model ? this.scopeContextFactory.createModelScope({
      tenantId,
      teamId,
      projectId,
      providerId,
      modelId: model.id,
      modelKind: model.providerKind,
      metadata: { status: model.status }
    }) : undefined;
    const policyScopes: PolicyResourceScope[] = this.scopeContextFactory.mergeScopes(
      this.scopeContextFactory.toPolicyResourceScope(providerScope),
      modelScope ? this.scopeContextFactory.toPolicyResourceScope(modelScope) : undefined,
      ...(request.requestContext?.resourceScopes ?? [])
    );
    return {
      providerScope,
      modelScope,
      resourceScopes: policyScopes
    };
  }

  private providerForRoute(route: LLMRoute): LLMProvider {
    if (route.providerKind === this.provider.getProviderKind()) return this.provider;
    if (route.providerKind === "mock") return new MockLLMProvider();
    if (route.providerKind === "openai_compatible") {
      return this.provider.getProviderKind() === "openai_compatible"
        ? this.provider
        : new OpenAICompatibleLLMProvider();
    }
    if (route.providerKind === "anthropic_compatible") return new AnthropicCompatibleLLMProviderSkeleton();
    if (route.providerKind === "gemini_compatible") return new GeminiCompatibleLLMProviderSkeleton();
    if (route.providerKind === "bedrock_compatible") return new BedrockCompatibleLLMProviderSkeleton();
    if (route.providerKind === "vertex_compatible") return new VertexCompatibleLLMProviderSkeleton();
    if (route.providerKind === "azure_compatible") return new AzureCompatibleLLMProviderSkeleton();
    if (route.providerKind === "litellm_compatible") return new LiteLLMCompatibleLLMProviderSkeleton();
    if (route.providerKind === "local_cli") return new LocalCliLLMProviderBridgeSkeleton();
    return new MockLLMProvider({ unavailable: true });
  }

  private async tryFallback(
    request: LLMCompletionRequest,
    failedRoute: LLMRoute,
    originalBudgetDecision: BudgetDecision,
    reason?: string
  ): Promise<LLMCompletionRouteResult | undefined> {
    const maxAttempts = Math.max(0, Math.min(request.maxFallbackAttempts ?? this.config.maxFallbackAttempts, this.config.maxFallbackAttempts));
    if (!this.config.fallbackEnabled || maxAttempts === 0 || !failedRoute.fallbackAllowed) return undefined;
    const fallbackPolicy = this.fallbackPolicyRepository.getPolicy("fallback_default_bounded");
    const failedModel = this.getModel(failedRoute.modelId);
    if (!failedModel) return undefined;
    if (!fallbackPolicy?.enabled && !this.config.fallbackEnabled) return undefined;
    const policyDecision = this.policyService.evaluate({
      subject: request.actorId || request.authContext || request.requestContext
        ? createPolicySubject({
          actorId: request.actorId ?? request.requestContext?.authContext.actor.id ?? request.authContext?.actor.id ?? this.actorId,
          principalId: request.requestContext?.authContext.principal.id ?? request.authContext?.principal.id,
          actorKind: request.requestContext?.authContext.actor.actorKind ?? request.authContext?.actor.actorKind ?? "user",
          roles: request.requestContext?.authContext.roles.map((role) => role.name) ?? request.authContext?.roles.map((role) => role.name) ?? ["system"],
          authMode: request.requestContext?.authContext.authMode ?? request.authContext?.authMode,
          serviceAccountId: stringMetadata((request.requestContext?.authContext ?? request.authContext)?.metadata.serviceAccountId),
          isMockActor: (request.requestContext?.authContext ?? request.authContext)?.metadata.isMockActor === true
        })
        : createServiceAccountPolicySubject("llm_router_service", {
          source: "system",
          metadata: { boundary: "llm_fallback_policy" }
        }),
      action: "llm.fallback",
      resource: createPolicyResource({
        resourceKind: "llm_fallback_policy",
        resourceId: fallbackPolicy?.id ?? "fallback_default_bounded",
        metadata: { failedRouteId: failedRoute.id }
      }),
      context: createPolicyContext({
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        repoId: request.repoId,
        modelId: failedRoute.modelId,
        providerKind: failedRoute.providerKind,
        environment: {
          ...this.policyEnvironmentFor({ ...failedModel, providerKind: failedRoute.providerKind }, originalBudgetDecision),
          fallbackEnabled: this.config.fallbackEnabled,
          fallbackWithinLimit: maxAttempts > 0,
          budgetAllowed: originalBudgetDecision.allowed
        },
        metadata: { source: "llm_gateway", failedRouteId: failedRoute.id, reason }
      })
    });
    if (!policyDecision.allowed) {
      const blocked = this.recordRoutingDecision({
        request,
        routingRequest: this.toRoutingRequest(request),
        route: failedRoute,
        model: this.getModel(failedRoute.modelId),
        budgetDecision: originalBudgetDecision,
        policyDecision,
        decision: "policy_blocked",
        reason: policyDecision.reason,
        fallbackChain: [failedRoute.id],
        metadata: { fallback_attempt_blocked: true }
      });
      this.recordAuditEvent({
        eventType: "llm_fallback_attempt_blocked",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? request.authContext?.actor.id ?? this.actorId,
        providerKind: failedRoute.providerKind,
        providerId: failedRoute.providerId,
        modelId: failedRoute.modelId,
        result: "blocked",
        reason: policyDecision.reason,
        metadata: { routing_decision_id: blocked.id, policy_decision_id: policyDecision.id }
      });
      return { ok: false, reason: policyDecision.reason, budgetDecision: originalBudgetDecision, routingDecision: blocked, fallbackAttempts: [blocked] };
    }

    const fallbackSelection = this.selectRouteForRequest(request, { excludedRouteIds: [failedRoute.id], fallbackAttempt: 1 });
    if (fallbackSelection.routingDecision.decision !== "selected" || !fallbackSelection.route || !fallbackSelection.model || !fallbackSelection.budgetDecision) {
      this.recordAuditEvent({
        eventType: "llm_fallback_attempt_blocked",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? request.authContext?.actor.id ?? this.actorId,
        providerKind: fallbackSelection.route?.providerKind ?? failedRoute.providerKind,
        providerId: fallbackSelection.route?.providerId ?? failedRoute.providerId,
        modelId: fallbackSelection.model?.id ?? failedRoute.modelId,
        result: "blocked",
        reason: fallbackSelection.routingDecision.reason,
        metadata: { routing_decision_id: fallbackSelection.routingDecision.id }
      });
      return { ok: false, reason: fallbackSelection.routingDecision.reason, budgetDecision: fallbackSelection.budgetDecision, routingDecision: fallbackSelection.routingDecision, fallbackAttempts: [fallbackSelection.routingDecision] };
    }
    const provider = this.providerForRoute(fallbackSelection.route);
    const providerResult = await provider.createCompletion({
      ...request,
      providerId: fallbackSelection.route.providerId,
      providerKind: fallbackSelection.route.providerKind,
      metadata: { ...(request.metadata ?? {}), fallbackAttempt: 1 }
    }, fallbackSelection.model);
    if (!providerResult.ok || !providerResult.result) {
      this.recordAuditEvent({
        eventType: "llm_fallback_attempt_failed",
        taskId: request.taskId,
        taskRunId: request.taskRunId,
        actorId: request.actorId ?? request.authContext?.actor.id ?? this.actorId,
        providerKind: fallbackSelection.route.providerKind,
        providerId: fallbackSelection.route.providerId,
        modelId: fallbackSelection.model.id,
        result: "failed",
        reason: providerResult.reason,
        metadata: { routing_decision_id: fallbackSelection.routingDecision.id }
      });
      return { ok: false, reason: providerResult.reason, budgetDecision: fallbackSelection.budgetDecision, routingDecision: fallbackSelection.routingDecision, fallbackAttempts: [fallbackSelection.routingDecision] };
    }
    const usageEvent = this.recordUsage(providerResult.result, {
      ...request,
      providerId: fallbackSelection.route.providerId,
      metadata: {
        ...(request.metadata ?? {}),
        routeId: fallbackSelection.route.id,
        routingDecisionId: fallbackSelection.routingDecision.id,
        fallbackAttempt: 1
      }
    });
    this.recordAuditEvent({
      eventType: "llm_fallback_attempt_succeeded",
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      actorId: request.actorId ?? request.authContext?.actor.id ?? this.actorId,
      providerKind: fallbackSelection.route.providerKind,
      providerId: fallbackSelection.route.providerId,
      modelId: fallbackSelection.model.id,
      result: "allowed",
      metadata: {
        routing_decision_id: fallbackSelection.routingDecision.id,
        route_id: fallbackSelection.route.id,
        usage_event_id: usageEvent?.id
      }
    });
    return {
      ok: true,
      result: providerResult.result,
      usageEvent,
      budgetDecision: fallbackSelection.budgetDecision,
      routingDecision: fallbackSelection.routingDecision,
      fallbackAttempts: [fallbackSelection.routingDecision]
    };
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
          metadata: { source: "llm_gateway", ...this.requestContextMetadata(request), legacy_runner_call: request.metadata?.legacy_runner_call === true }
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
        metadata: { source: "llm_gateway", ...this.requestContextMetadata(request), legacy_runner_call: request.metadata?.legacy_runner_call === true }
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
          ...this.requestContextMetadata(request),
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
        metadata: { source: "llm_gateway", ...this.requestContextMetadata(request) }
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
        ...this.requestContextMetadata(request),
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
      userId: this.actorIdForRequest(request),
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
        virtual_key_id: request.virtualKeyId ?? DEFAULT_SYSTEM_VIRTUAL_KEY_ID,
        provider_id: result.providerId ?? request.providerId,
        billing_mode: this.providerMetadataForRequest(request).billingMode,
        provider_kind: result.providerKind,
        model_id: result.modelId,
        ...this.requestContextMetadata(request),
        route_id: typeof request.metadata?.routeId === "string" ? request.metadata.routeId : undefined,
        routing_decision_id: typeof request.metadata?.routingDecisionId === "string" ? request.metadata.routingDecisionId : undefined,
        fallback_attempt: typeof request.metadata?.fallbackAttempt === "number" ? request.metadata.fallbackAttempt : 0
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
      budgetRemainingUsd,
      budgetDecisionId: createId("llmbudget")
    };
  }

  private evaluateCompletionPolicy(request: LLMCompletionRequest, model: LLMModel, budgetDecision: BudgetDecision): PolicyDecision {
    const authContext = request.requestContext?.authContext ?? request.authContext;
    const subject = authContext && this.authorizationService
      ? this.authorizationService.toPolicySubject(authContext)
      : request.actorId
        ? createPolicySubject({
        actorId: request.actorId ?? this.actorId,
        actorKind: "user",
        roles: ["system"]
        })
        : createServiceAccountPolicySubject("llm_gateway_service", {
          source: "system",
          metadata: { boundary: "llm_completion_policy" }
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
        metadata: { source: "llm_gateway", ...this.requestContextMetadata(request) }
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
          metadata: { source: "llm_gateway", ...this.requestContextMetadata(request) }
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
          metadata: { source: "llm_gateway", ...this.requestContextMetadata(request) }
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
          metadata: { source: "llm_gateway", ...this.requestContextMetadata(request) }
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
        metadata: { source: "llm_gateway", ...this.requestContextMetadata(request) }
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

  private isRouteModelAllowlisted(route: LLMRoute): boolean {
    if (this.config.allowedModels.length === 0) return true;
    const model = this.getModel(route.modelId);
    const remoteModelId = typeof model?.metadata.remoteModelId === "string" ? model.metadata.remoteModelId : undefined;
    return this.config.allowedModels.includes(route.modelId) ||
      (remoteModelId !== undefined && this.config.allowedModels.includes(remoteModelId)) ||
      (this.config.defaultModel !== undefined && this.config.allowedModels.includes(this.config.defaultModel));
  }
}

function inferPromptClass(prompt: string | undefined): LLMRoutingRequest["promptClass"] {
  const text = (prompt ?? "").toLowerCase();
  if (text.includes("conflict") || text.includes("merge")) return "conflict_resolution";
  if (text.includes("registry") || text.includes("skill") || text.includes("harness")) return "registry_review";
  if (text.includes("review")) return "code_review";
  if (text.includes("summarize") || text.includes("summary")) return "summarization";
  if (text.includes("code") || text.includes("fix") || text.includes("bug") || text.includes("implement")) return "code_generation";
  return text.length > 0 ? "general" : "unknown";
}

function capabilitiesForPromptClass(promptClass: LLMRoutingRequest["promptClass"]): string[] {
  if (promptClass === "code_generation") return ["completion", "code_generation"];
  if (promptClass === "code_review") return ["completion", "code_review"];
  if (promptClass === "conflict_resolution") return ["completion", "conflict_resolution"];
  if (promptClass === "registry_review") return ["completion", "registry_review"];
  if (promptClass === "summarization") return ["completion", "summarization"];
  return ["completion"];
}

export function createDefaultLlmGatewayService(input: Omit<LLMGatewayServiceInput, "provider" | "config"> = {}): LLMGatewayService {
  const runtime = createLlmProviderFromEnv(process.env, {
    credentialResolver: input.credentialResolver,
    legacyCredentialFallbackAuditor: input.legacyCredentialFallbackAuditor
  });
  return new LLMGatewayService({
    ...input,
    provider: runtime.provider,
    config: runtime.config
  });
}

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return sanitizeSecurityMetadata(metadata) as Record<string, unknown>;
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
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
