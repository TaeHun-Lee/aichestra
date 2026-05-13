import { createId } from "@aichestra/core";
import type {
  LLMFallbackPolicy,
  LLMProviderKind,
  LLMPromptClass,
  LLMRoute,
  LLMRoutingDecision
} from "./types.ts";

export type LLMRouteRepository = {
  listRoutes(): LLMRoute[];
  getRoute(id: string): LLMRoute | undefined;
  createRoute(input: Omit<LLMRoute, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): LLMRoute;
  updateRouteStatus(id: string, enabled: boolean): LLMRoute;
};

export type LLMFallbackPolicyRepository = {
  listPolicies(): LLMFallbackPolicy[];
  getPolicy(id: string): LLMFallbackPolicy | undefined;
  createPolicy(input: Omit<LLMFallbackPolicy, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): LLMFallbackPolicy;
};

export type LLMRoutingDecisionRepository = {
  recordDecision(input: Omit<LLMRoutingDecision, "id" | "createdAt"> & { id?: string; createdAt?: Date }): LLMRoutingDecision;
  listDecisions(): LLMRoutingDecision[];
};

export class InMemoryLLMRouteRepository implements LLMRouteRepository {
  private readonly routes = new Map<string, LLMRoute>();

  constructor(seed: LLMRoute[] = seedLlmRoutes()) {
    for (const route of seed) {
      this.routes.set(route.id, structuredClone(route));
    }
  }

  listRoutes(): LLMRoute[] {
    return [...this.routes.values()].sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
  }

  getRoute(id: string): LLMRoute | undefined {
    return this.routes.get(id);
  }

  createRoute(input: Omit<LLMRoute, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): LLMRoute {
    validateRoute(input);
    if (this.routes.has(input.id)) {
      throw new Error(`LLM route already exists: ${input.id}`);
    }
    const now = new Date();
    const route: LLMRoute = {
      ...input,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    };
    this.routes.set(route.id, route);
    return route;
  }

  updateRouteStatus(id: string, enabled: boolean): LLMRoute {
    const route = this.getRoute(id);
    if (!route) {
      throw new Error(`LLM route not found: ${id}`);
    }
    const updated = { ...route, enabled, updatedAt: new Date() };
    this.routes.set(id, updated);
    return updated;
  }
}

export class InMemoryLLMFallbackPolicyRepository implements LLMFallbackPolicyRepository {
  private readonly policies = new Map<string, LLMFallbackPolicy>();

  constructor(seed: LLMFallbackPolicy[] = [createDefaultFallbackPolicy()]) {
    for (const policy of seed) {
      this.policies.set(policy.id, structuredClone(policy));
    }
  }

  listPolicies(): LLMFallbackPolicy[] {
    return [...this.policies.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  getPolicy(id: string): LLMFallbackPolicy | undefined {
    return this.policies.get(id);
  }

  createPolicy(input: Omit<LLMFallbackPolicy, "createdAt" | "updatedAt"> & { createdAt?: Date; updatedAt?: Date }): LLMFallbackPolicy {
    validateFallbackPolicy(input);
    if (this.policies.has(input.id)) {
      throw new Error(`LLM fallback policy already exists: ${input.id}`);
    }
    const now = new Date();
    const policy: LLMFallbackPolicy = {
      ...input,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    };
    this.policies.set(policy.id, policy);
    return policy;
  }
}

export class InMemoryLLMRoutingDecisionRepository implements LLMRoutingDecisionRepository {
  private readonly decisions: LLMRoutingDecision[] = [];

  recordDecision(input: Omit<LLMRoutingDecision, "id" | "createdAt"> & { id?: string; createdAt?: Date }): LLMRoutingDecision {
    const decision: LLMRoutingDecision = {
      ...input,
      id: input.id ?? createId("llmroute"),
      createdAt: input.createdAt ?? new Date()
    };
    this.decisions.push(decision);
    return decision;
  }

  listDecisions(): LLMRoutingDecision[] {
    return [...this.decisions];
  }
}

export function createDefaultFallbackPolicy(): LLMFallbackPolicy {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "fallback_default_bounded",
    name: "Default bounded fallback",
    enabled: false,
    maxAttempts: 0,
    allowedProviderKinds: ["mock"],
    disallowedProviderKinds: ["local_cli"],
    requireSameDataClass: true,
    requireBudgetRemaining: true,
    requirePolicyAllow: true,
    stopOnPolicyDeny: true,
    stopOnCredentialDeny: true,
    stopOnBudgetDeny: true,
    metadata: { defaultRuntime: "fallback_disabled" },
    createdAt: now,
    updatedAt: now
  };
}

export function seedLlmRoutes(): LLMRoute[] {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const base = (input: Omit<LLMRoute, "createdAt" | "updatedAt">): LLMRoute => ({
    ...input,
    createdAt: now,
    updatedAt: now
  });
  return [
    base({
      id: "route_mock_general",
      name: "Mock general",
      description: "Default deterministic mock route.",
      providerId: "mock",
      providerKind: "mock",
      modelId: "mock-model",
      priority: 100,
      enabled: true,
      capabilities: ["completion", "general"],
      promptClasses: ["general", "unknown", "summarization"],
      requiresRemote: false,
      requiresSecretRef: false,
      fallbackAllowed: true,
      billingMode: "aichestra_owned",
      metadata: { dataClass: "mock" }
    }),
    base({
      id: "route_mock_coder",
      name: "Mock coder",
      description: "Deterministic mock route for code generation and review.",
      providerId: "mock",
      providerKind: "mock",
      modelId: "mock-coder@1.0",
      priority: 110,
      enabled: true,
      capabilities: ["completion", "code_generation", "code_review"],
      promptClasses: ["code_generation", "code_review", "general", "unknown"],
      requiresRemote: false,
      requiresSecretRef: false,
      fallbackAllowed: true,
      billingMode: "aichestra_owned",
      metadata: { dataClass: "mock" }
    }),
    base({
      id: "route_mock_conflict",
      name: "Mock conflict resolver",
      description: "Deterministic mock route for conflict-resolution prompts.",
      providerId: "mock",
      providerKind: "mock",
      modelId: "mock-conflict-resolver@1.0",
      priority: 105,
      enabled: true,
      capabilities: ["completion", "conflict_resolution", "code_review"],
      promptClasses: ["conflict_resolution"],
      requiresRemote: false,
      requiresSecretRef: false,
      fallbackAllowed: true,
      billingMode: "aichestra_owned",
      metadata: { dataClass: "mock" }
    }),
    base({
      id: "route_mock_registry",
      name: "Mock registry reviewer",
      description: "Deterministic mock route for registry review prompts.",
      providerId: "mock",
      providerKind: "mock",
      modelId: "mock-registry-reviewer@1.0",
      priority: 106,
      enabled: true,
      capabilities: ["completion", "registry_review", "code_review"],
      promptClasses: ["registry_review"],
      requiresRemote: false,
      requiresSecretRef: false,
      fallbackAllowed: true,
      billingMode: "aichestra_owned",
      metadata: { dataClass: "mock" }
    }),
    base({
      id: "route_openai_compatible_default",
      name: "OpenAI-compatible default",
      description: "Controlled v1 OpenAI-compatible route behind explicit gates.",
      providerId: "openai-api-key",
      providerKind: "openai_compatible",
      providerTransportKind: "cloud_api",
      modelId: "openai-compatible/default",
      priority: 300,
      enabled: true,
      capabilities: ["completion", "code_generation", "code_review", "summarization", "tool_use"],
      promptClasses: ["code_generation", "code_review", "summarization", "general", "unknown"],
      maxInputTokens: 128000,
      requiresRemote: true,
      requiresSecretRef: true,
      fallbackAllowed: false,
      billingMode: "provider_workspace",
      metadata: { dataClass: "remote_provider", onlyRemoteImplementationInV2: true }
    }),
    skeletonRoute("route_anthropic_compatible_skeleton", "Anthropic-compatible skeleton", "anthropic-api-key", "anthropic_compatible", "anthropic-compatible/skeleton", 500),
    skeletonRoute("route_gemini_compatible_skeleton", "Gemini-compatible skeleton", "gemini-api-key", "gemini_compatible", "gemini-compatible/skeleton", 510),
    skeletonRoute("route_bedrock_compatible_skeleton", "Bedrock-compatible skeleton", "bedrock-anthropic-cloud", "bedrock_compatible", "bedrock-compatible/skeleton", 520),
    skeletonRoute("route_vertex_compatible_skeleton", "Vertex-compatible skeleton", "vertex-gemini-cloud", "vertex_compatible", "vertex-compatible/skeleton", 530),
    skeletonRoute("route_azure_compatible_skeleton", "Azure-compatible skeleton", "azure-foundry-cloud", "azure_compatible", "azure-compatible/skeleton", 540),
    skeletonRoute("route_litellm_compatible_skeleton", "LiteLLM-compatible skeleton", "litellm-compatible-skeleton", "litellm_compatible", "litellm-compatible/skeleton", 550),
    base({
      id: "route_local_cli_claude_code",
      name: "Claude Code local CLI bridge",
      description: "Local CLI route represented as Local Agent required; not directly executable.",
      providerId: "claude-code-local",
      providerKind: "local_cli",
      providerTransportKind: "local_cli",
      modelId: "claude-code/local",
      priority: 900,
      enabled: true,
      capabilities: ["local_cli", "code_generation", "code_review"],
      promptClasses: ["code_generation", "code_review", "general", "unknown"],
      requiresRemote: false,
      requiresSecretRef: false,
      fallbackAllowed: false,
      billingMode: "local_user_session",
      metadata: { localAgentRequired: true, directInvocation: false }
    })
  ];
}

function skeletonRoute(
  id: string,
  name: string,
  providerId: string,
  providerKind: LLMProviderKind,
  modelId: string,
  priority: number
): LLMRoute {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id,
    name,
    description: "Disabled v2 provider skeleton. No network calls.",
    providerId,
    providerKind,
    providerTransportKind: providerKind === "bedrock_compatible" || providerKind === "vertex_compatible" || providerKind === "azure_compatible" ? "cloud_iam" : "cloud_api",
    modelId,
    priority,
    enabled: true,
    capabilities: ["completion"],
    promptClasses: ["code_generation", "code_review", "summarization", "general", "unknown"],
    requiresRemote: true,
    requiresSecretRef: true,
    fallbackAllowed: false,
    billingMode: providerKind === "bedrock_compatible" || providerKind === "vertex_compatible" || providerKind === "azure_compatible" ? "cloud_project" : "provider_workspace",
    metadata: { skeleton: true, implemented: false, noNetworkCalls: true },
    createdAt: now,
    updatedAt: now
  };
}

function validateRoute(input: Omit<LLMRoute, "createdAt" | "updatedAt">): void {
  if (!input.id || !input.name || !input.providerId || !input.providerKind || !input.modelId) {
    throw new Error("LLM route requires id, name, providerId, providerKind, and modelId.");
  }
  if (!Array.isArray(input.capabilities) || input.capabilities.length === 0) {
    throw new Error("LLM route requires at least one capability.");
  }
  if (!Array.isArray(input.promptClasses) || input.promptClasses.length === 0 || input.promptClasses.some((value) => !isPromptClass(value))) {
    throw new Error("LLM route requires at least one valid prompt class.");
  }
}

function validateFallbackPolicy(input: Omit<LLMFallbackPolicy, "createdAt" | "updatedAt">): void {
  if (!input.id || !input.name || input.maxAttempts < 0) {
    throw new Error("LLM fallback policy requires id, name, and non-negative maxAttempts.");
  }
}

function isPromptClass(value: unknown): value is LLMPromptClass {
  return value === "code_generation" ||
    value === "code_review" ||
    value === "conflict_resolution" ||
    value === "registry_review" ||
    value === "summarization" ||
    value === "general" ||
    value === "unknown";
}
