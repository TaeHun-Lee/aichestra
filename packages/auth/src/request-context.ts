import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { PolicyResourceScope } from "@aichestra/policy";
import type { AuthorizationService } from "./service.ts";
import type { AuthContext, AuthProviderResolveRequest, CorrelationContext, RequestContext, RequestSource } from "./types.ts";
import { ScopeContextFactory } from "./scope-context.ts";

function createRequestId(prefix = "req"): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function headerValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

type RequestContextResolverOptions = {
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  bearerTokenSha256?: string;
  roles?: string[];
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  resourceScopes?: PolicyResourceScope[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

function metadataWithoutSecretLikeValues(input: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (/token|secret|password|cookie|credential|session|apiKey|api_key/i.test(key)) {
      output[key] = "[redacted]";
    } else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      output[key] = metadataWithoutSecretLikeValues(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}

export class RequestContextResolver {
  private readonly authorizationService: AuthorizationService;
  private readonly scopeContextFactory = new ScopeContextFactory();

  constructor(authorizationService: AuthorizationService) {
    this.authorizationService = authorizationService;
  }

  fromApiRequest(request: IncomingMessage, options: RequestContextResolverOptions = {}): RequestContext {
    return this.resolveFromApiRequest(request, options);
  }

  resolveFromApiRequest(request: IncomingMessage, options: RequestContextResolverOptions = {}): RequestContext {
    const requestId = options.requestId ?? headerValue(request, "x-aichestra-request-id") ?? createRequestId();
    const correlationId = options.correlationId ?? headerValue(request, "x-aichestra-correlation-id") ?? requestId;
    const actorId = options.actorId ?? headerValue(request, "x-aichestra-actor-id");
    return this.fromAuthContext(this.authorizationService.getAuthContext({
      requestId,
      actorId,
      bearerTokenSha256: options.bearerTokenSha256,
      correlationId,
      source: "api",
      ...this.authScopeOptions(options),
      metadata: {
        ...metadataWithoutSecretLikeValues(options.metadata),
        mockHeaderActorOverride: actorId !== undefined,
        requestContextResolver: "api",
        traceId: options.traceId
      }
    }), "api", {
      ...options,
      requestId,
      correlationId,
      actorId
    });
  }

  createSystemContext(reason: string, options: RequestContextResolverOptions = {}): RequestContext {
    if (!reason.trim()) throw new Error("system_request_context_reason_required");
    const requestId = options.requestId ?? createRequestId("sysreq");
    const correlationId = options.correlationId ?? requestId;
    return this.fromAuthContext(this.authorizationService.getAuthContext({
      requestId,
      actorId: options.actorId ?? "mock-admin",
      correlationId,
      source: "system",
      ...this.authScopeOptions(options),
      metadata: {
        ...metadataWithoutSecretLikeValues(options.metadata),
        reason,
        requestContextResolver: "system",
        mockSystemContext: true,
        traceId: options.traceId
      }
    }), "system", {
      ...options,
      requestId,
      correlationId,
      actorId: options.actorId ?? "mock-admin",
      metadata: { ...options.metadata, reason, mockSystemContext: true }
    });
  }

  createTestContext(actorId: string, metadataOrOptions: Record<string, unknown> | RequestContextResolverOptions = {}): RequestContext {
    const options = isResolverOptions(metadataOrOptions) ? metadataOrOptions : { metadata: metadataOrOptions };
    const requestId = options.requestId ?? createRequestId("testreq");
    const correlationId = options.correlationId ?? requestId;
    return this.fromAuthContext(this.authorizationService.getAuthContext({
      requestId,
      actorId,
      correlationId,
      source: "test",
      ...this.authScopeOptions(options),
      metadata: {
        ...metadataWithoutSecretLikeValues(options.metadata),
        requestContextResolver: "test",
        testContext: true,
        roles: options.roles,
        traceId: options.traceId
      }
    }), "test", {
      ...options,
      requestId,
      correlationId,
      actorId,
      metadata: { ...options.metadata, testContext: true }
    });
  }

  createWebhookContext(provider: string, deliveryId: string | undefined, options: RequestContextResolverOptions = {}): RequestContext {
    const requestId = options.requestId ?? createRequestId("webhookreq");
    const correlationId = options.correlationId ?? deliveryId ?? requestId;
    return this.fromAuthContext(this.authorizationService.getAuthContext({
      requestId,
      actorId: options.actorId ?? "mock-admin",
      correlationId,
      source: "webhook",
      ...this.authScopeOptions(options),
      metadata: {
        ...metadataWithoutSecretLikeValues(options.metadata),
        provider,
        deliveryId,
        requestContextResolver: "webhook",
        mockWebhookContext: true,
        traceId: options.traceId
      }
    }), "webhook", {
      ...options,
      requestId,
      correlationId,
      actorId: options.actorId ?? "mock-admin",
      metadata: { ...options.metadata, provider, deliveryId, mockWebhookContext: true }
    });
  }

  createDashboardContext(options: RequestContextResolverOptions = {}): RequestContext {
    const requestId = options.requestId ?? createRequestId("dashreq");
    const correlationId = options.correlationId ?? requestId;
    return this.fromAuthContext(this.authorizationService.getAuthContext({
      requestId,
      actorId: options.actorId ?? "user_demo_viewer",
      correlationId,
      source: "dashboard",
      ...this.authScopeOptions(options),
      metadata: {
        ...metadataWithoutSecretLikeValues(options.metadata),
        requestContextResolver: "dashboard",
        readOnly: true,
        productionAuthEnabled: false,
        traceId: options.traceId
      }
    }), "dashboard", {
      ...options,
      requestId,
      correlationId,
      actorId: options.actorId ?? "user_demo_viewer",
      metadata: { ...options.metadata, readOnly: true }
    });
  }

  createReadinessContext(options: RequestContextResolverOptions = {}): RequestContext {
    const requestId = options.requestId ?? createRequestId("readyreq");
    const correlationId = options.correlationId ?? requestId;
    return this.fromAuthContext(this.authorizationService.getAuthContext({
      requestId,
      actorId: options.actorId ?? "user_demo_viewer",
      correlationId,
      source: "readiness",
      ...this.authScopeOptions(options),
      metadata: {
        ...metadataWithoutSecretLikeValues(options.metadata),
        requestContextResolver: "readiness",
        readOnly: true,
        planningOnly: true,
        productionAuthEnabled: false,
        traceId: options.traceId
      }
    }), "readiness", {
      ...options,
      requestId,
      correlationId,
      actorId: options.actorId ?? "user_demo_viewer",
      metadata: { ...options.metadata, readOnly: true, planningOnly: true }
    });
  }

  toCorrelationContext(context: RequestContext, options: Pick<RequestContextResolverOptions, "traceId" | "taskId" | "taskRunId" | "metadata"> = {}): CorrelationContext {
    return {
      requestId: context.requestId,
      correlationId: context.correlationId ?? context.requestId,
      traceId: options.traceId,
      taskId: options.taskId,
      taskRunId: options.taskRunId,
      actorId: context.authContext.actor.id,
      source: context.source,
      metadata: metadataWithoutSecretLikeValues({
        ...context.metadata,
        ...(options.metadata ?? {}),
        principalId: context.authContext.principal.id,
        authMode: context.authContext.authMode
      })
    };
  }

  private fromAuthContext(authContext: AuthContext, source: RequestSource, options: RequestContextResolverOptions = {}): RequestContext {
    const correlationId = options.correlationId ?? stringMetadata(authContext.metadata.correlationId) ?? authContext.requestId;
    const tenantId = options.tenantId ?? authContext.tenantScopes?.[0]?.tenantId;
    const teamId = options.teamId ?? authContext.teamScopes?.[0]?.teamId;
    const projectId = options.projectId ?? authContext.projectScopes?.[0]?.projectId;
    const resourceScopes = this.scopeContextFactory.mergeScopes(
      ...(authContext.resourceScopes ?? []),
      ...(options.resourceScopes ?? [])
    );
    return {
      requestId: authContext.requestId,
      authContext,
      correlationId,
      source,
      tenantId,
      teamId,
      projectId,
      resourceScopes: resourceScopes.length > 0 ? resourceScopes : undefined,
      createdAt: options.createdAt ?? new Date(),
      metadata: {
        ...metadataWithoutSecretLikeValues(options.metadata),
        authMode: authContext.authMode,
        actorId: authContext.actor.id,
        principalId: authContext.principal.id,
        serviceAccountId: stringMetadata(authContext.metadata.serviceAccountId),
        actorKind: authContext.actor.actorKind,
        tenantId,
        teamId,
        projectId,
        resourceScopes,
        source,
        correlationId,
        authProviderKind: stringMetadata(authContext.metadata.authProviderKind) ?? "mock",
        authProviderStatus: stringMetadata(authContext.metadata.authProviderStatus) ?? "active_mock",
        productionAuthEnabled: authContext.metadata.productionAuthEnabled === true,
        tokenValidationEnabled: authContext.metadata.tokenValidationEnabled === true,
        sessionBoundaryStatus: stringMetadata(authContext.metadata.sessionBoundaryStatus) ?? "disabled",
        identityMappingStatus: stringMetadata(authContext.metadata.identityMappingStatus) ?? "not_configured",
        mockContext: authContext.authMode === "mock" || authContext.authMode === "mock_service_account" || source === "system"
      }
    };
  }

  private authScopeOptions(options: RequestContextResolverOptions): Pick<AuthProviderResolveRequest, "tenantScopes" | "teamScopes" | "projectScopes" | "resourceScopes"> {
    if (!options.tenantId && !options.teamId && !options.projectId && !options.resourceScopes) return {};
    const context = this.scopeContextFactory.createTenantScopeContext({
      tenantId: options.tenantId,
      teamId: options.teamId,
      projectId: options.projectId,
      resourceScopes: options.resourceScopes
    });
    return {
      tenantScopes: context.tenantScopes,
      teamScopes: context.teamScopes,
      projectScopes: context.projectScopes,
      resourceScopes: context.resourceScopes
    };
  }
}

function isResolverOptions(value: Record<string, unknown> | RequestContextResolverOptions): value is RequestContextResolverOptions {
  return "requestId" in value || "correlationId" in value || "traceId" in value || "actorId" in value || "createdAt" in value || "roles" in value || "tenantId" in value || "teamId" in value || "projectId" in value || "resourceScopes" in value;
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
