import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { RequestContextResolver } from "@aichestra/auth";
import type { RequestContext, RequestSource } from "@aichestra/auth";

export type ApiRequestContextRouteMetadata = {
  route?: string;
  method?: string;
  source?: Extract<RequestSource, "api" | "dashboard" | "readiness" | "system" | "webhook">;
  systemReason?: string;
  webhookProvider?: string;
  metadata?: Record<string, unknown>;
};

export type SafeRequestContextSummary = {
  requestId?: string;
  correlationId?: string;
  source: RequestSource;
  authMode: string;
  authModeCategory: "mock" | "system" | "future";
  actorKind: string;
  isMockActor: boolean;
  productionAuthEnabled: boolean;
  authProviderKind: string;
  authProviderStatus: string;
  tokenValidationEnabled: boolean;
  sessionBoundaryStatus: string;
  identityMappingStatus: string;
};

export type ApiRequestContextMiddlewareInput = {
  resolver: RequestContextResolver;
  idFactory?: (prefix: string) => string;
};

type SafeHeaders = {
  requestId: string;
  correlationId: string;
  actorId?: string;
  deliveryId?: string;
  bearerTokenSha256?: string;
  requestIdHeaderAccepted: boolean;
  correlationIdHeaderAccepted: boolean;
  actorHeaderAccepted: boolean;
  actorHeaderIgnored: boolean;
  deliveryIdHeaderAccepted: boolean;
  authorizationBearerPresented: boolean;
};

export class ApiRequestContextMiddleware {
  private readonly resolver: RequestContextResolver;
  private readonly idFactory: (prefix: string) => string;
  private readonly contexts = new WeakMap<IncomingMessage, RequestContext>();

  constructor(input: ApiRequestContextMiddlewareInput) {
    this.resolver = input.resolver;
    this.idFactory = input.idFactory ?? createRequestId;
  }

  resolveApiContext(request: IncomingMessage, routeMetadata: ApiRequestContextRouteMetadata = {}): RequestContext {
    const cached = this.contexts.get(request);
    if (cached) return cached;

    const source = routeMetadata.source ?? sourceForRoute(routeMetadata.route, routeMetadata.method);
    const headers = safeHeadersFromRequest(request, this.idFactory);
    const metadata = safeMetadata({
      ...(routeMetadata.metadata ?? {}),
      route: routeMetadata.route,
      method: routeMetadata.method,
      apiAuthContextMiddleware: "v1",
      productionAuthEnabled: false,
      authProviderKind: "mock",
      authProviderStatus: "active_mock",
      tokenValidationEnabled: false,
      sessionBoundaryStatus: "disabled",
      identityMappingStatus: "not_configured",
      requestIdHeaderAccepted: headers.requestIdHeaderAccepted,
      correlationIdHeaderAccepted: headers.correlationIdHeaderAccepted,
      mockActorHeaderAccepted: headers.actorHeaderAccepted,
      mockActorHeaderIgnored: headers.actorHeaderIgnored,
      deliveryIdHeaderAccepted: headers.deliveryIdHeaderAccepted,
      authorizationBearerPresented: headers.authorizationBearerPresented,
      authorizationHeaderStored: false
    });

    const context = this.createContextForSource(request, source, headers, routeMetadata, metadata);
    this.contexts.set(request, context);
    return context;
  }

  resolveDashboardContext(request: IncomingMessage, routeMetadata: Omit<ApiRequestContextRouteMetadata, "source"> = {}): RequestContext {
    return this.resolveApiContext(request, { ...routeMetadata, source: "dashboard" });
  }

  resolveReadinessContext(request: IncomingMessage, routeMetadata: Omit<ApiRequestContextRouteMetadata, "source"> = {}): RequestContext {
    return this.resolveApiContext(request, { ...routeMetadata, source: "readiness" });
  }

  resolveSystemContext(request: IncomingMessage, reason: string, routeMetadata: Omit<ApiRequestContextRouteMetadata, "source" | "systemReason"> = {}): RequestContext {
    return this.resolveApiContext(request, { ...routeMetadata, source: "system", systemReason: reason });
  }

  createSystemContext(reason: string, options: { requestId?: string; correlationId?: string; metadata?: Record<string, unknown> } = {}): RequestContext {
    return this.resolver.createSystemContext(reason, {
      requestId: options.requestId,
      correlationId: options.correlationId,
      metadata: safeMetadata({
        ...(options.metadata ?? {}),
        apiAuthContextMiddleware: "v1",
        productionAuthEnabled: false,
        authProviderKind: "mock",
        authProviderStatus: "active_mock",
        tokenValidationEnabled: false,
        sessionBoundaryStatus: "disabled",
        identityMappingStatus: "not_configured"
      })
    });
  }

  requireApiContext(request: IncomingMessage): RequestContext {
    const context = this.contexts.get(request);
    if (!context) throw new Error("api_request_context_missing");
    return context;
  }

  withRequestContext(
    handler: (request: IncomingMessage, response: ServerResponse, requestContext: RequestContext) => void | Promise<void>,
    routeMetadata: ApiRequestContextRouteMetadata | ((request: IncomingMessage) => ApiRequestContextRouteMetadata) = {}
  ): (request: IncomingMessage, response: ServerResponse) => void | Promise<void> {
    return (request, response) => {
      const metadata = typeof routeMetadata === "function" ? routeMetadata(request) : routeMetadata;
      const requestContext = this.resolveApiContext(request, metadata);
      return handler(request, response, requestContext);
    };
  }

  getSafeRequestContextSummary(context: RequestContext, options: { includeIds?: boolean } = {}): SafeRequestContextSummary {
    const includeIds = options.includeIds !== false;
    return {
      requestId: includeIds ? context.requestId : undefined,
      correlationId: includeIds ? context.correlationId : undefined,
      source: context.source,
      authMode: context.authContext.authMode,
      authModeCategory: authModeCategory(context),
      actorKind: context.authContext.actor.actorKind,
      isMockActor: context.authContext.metadata.isMockActor === true || context.metadata.mockContext === true,
      productionAuthEnabled: context.metadata.productionAuthEnabled === true || context.authContext.metadata.productionAuthEnabled === true,
      authProviderKind: stringMetadata(context.metadata.authProviderKind) ?? stringMetadata(context.authContext.metadata.authProviderKind) ?? "mock",
      authProviderStatus: stringMetadata(context.metadata.authProviderStatus) ?? stringMetadata(context.authContext.metadata.authProviderStatus) ?? "active_mock",
      tokenValidationEnabled: context.metadata.tokenValidationEnabled === true || context.authContext.metadata.tokenValidationEnabled === true,
      sessionBoundaryStatus: stringMetadata(context.metadata.sessionBoundaryStatus) ?? stringMetadata(context.authContext.metadata.sessionBoundaryStatus) ?? "disabled",
      identityMappingStatus: stringMetadata(context.metadata.identityMappingStatus) ?? stringMetadata(context.authContext.metadata.identityMappingStatus) ?? "not_configured"
    };
  }

  private createContextForSource(
    request: IncomingMessage,
    source: ApiRequestContextRouteMetadata["source"],
    headers: SafeHeaders,
    routeMetadata: ApiRequestContextRouteMetadata,
    metadata: Record<string, unknown>
  ): RequestContext {
    if (source === "dashboard") {
      return this.resolver.createDashboardContext({
        requestId: headers.requestId,
        correlationId: headers.correlationId,
        metadata: { ...metadata, readOnly: true }
      });
    }
    if (source === "readiness") {
      return this.resolver.createReadinessContext({
        requestId: headers.requestId,
        correlationId: headers.correlationId,
        metadata: { ...metadata, readOnly: true, planningOnly: true }
      });
    }
    if (source === "system") {
      return this.resolver.createSystemContext(routeMetadata.systemReason ?? "", {
        requestId: headers.requestId,
        correlationId: headers.correlationId,
        metadata: { ...metadata, mockSystemContext: true }
      });
    }
    if (source === "webhook") {
      return this.resolver.createWebhookContext(routeMetadata.webhookProvider ?? "unknown", headers.deliveryId, {
        requestId: headers.requestId,
        correlationId: headers.correlationId,
        metadata: { ...metadata, webhookContext: true }
      });
    }
    return this.resolver.resolveFromApiRequest(request, {
      requestId: headers.requestId,
      correlationId: headers.correlationId,
      actorId: headers.actorId ?? (headers.actorHeaderIgnored ? "mock-admin" : undefined),
      bearerTokenSha256: headers.bearerTokenSha256,
      metadata
    });
  }
}

function createRequestId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function sourceForRoute(route: string | undefined, method: string | undefined): Extract<RequestSource, "api" | "dashboard" | "readiness" | "webhook"> {
  if (route === "/git/github/webhooks" && method === "POST") return "webhook";
  if (route === "/dashboard" || route?.startsWith("/dashboard/")) return "dashboard";
  if (route === "/readiness" || route?.startsWith("/readiness/")) return "readiness";
  return "api";
}

function safeHeadersFromRequest(request: IncomingMessage, idFactory: (prefix: string) => string): SafeHeaders {
  const requestIdHeader = safeHeaderId(request, "x-aichestra-request-id");
  const correlationIdHeader = safeHeaderId(request, "x-aichestra-correlation-id");
  const actorHeader = safeHeaderId(request, "x-aichestra-actor-id");
  const rawActorHeader = rawStringHeader(request, "x-aichestra-actor-id");
  const deliveryIdHeader = safeHeaderId(request, "x-github-delivery");
  const bearerToken = bearerTokenFromAuthorizationHeader(request);
  const requestId = requestIdHeader ?? idFactory("req");
  return {
    requestId,
    correlationId: correlationIdHeader ?? deliveryIdHeader ?? requestId,
    actorId: actorHeader,
    deliveryId: deliveryIdHeader,
    bearerTokenSha256: bearerToken ? sha256Hex(bearerToken) : undefined,
    requestIdHeaderAccepted: requestIdHeader !== undefined,
    correlationIdHeaderAccepted: correlationIdHeader !== undefined,
    actorHeaderAccepted: actorHeader !== undefined,
    actorHeaderIgnored: rawActorHeader !== undefined && actorHeader === undefined,
    deliveryIdHeaderAccepted: deliveryIdHeader !== undefined,
    authorizationBearerPresented: bearerToken !== undefined
  };
}

function rawStringHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function safeHeaderId(request: IncomingMessage, name: string): string | undefined {
  const value = rawStringHeader(request, name)?.trim();
  if (!value || value.length > 128) return undefined;
  if (/bearer|token|secret|cookie|session|password|api.?key/i.test(value)) return undefined;
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value) ? value : undefined;
}

function bearerTokenFromAuthorizationHeader(request: IncomingMessage): string | undefined {
  const value = rawStringHeader(request, "authorization")?.trim();
  if (!value) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  const token = match?.[1]?.trim();
  if (!token || token.length > 4096) return undefined;
  return token;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function authModeCategory(context: RequestContext): SafeRequestContextSummary["authModeCategory"] {
  if (context.source === "system" || context.authContext.authMode === "system") return "system";
  if (context.authContext.authMode === "mock" || context.authContext.authMode === "mock_service_account") return "mock";
  return "future";
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function safeMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (/token|secret|password|cookie|credential|session|apiKey|api_key|authorization/i.test(key)) {
      output[key] = "[redacted]";
    } else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      output[key] = safeMetadata(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}
