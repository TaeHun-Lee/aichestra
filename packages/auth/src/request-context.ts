import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { AuthorizationService } from "./service.ts";
import type { AuthContext, RequestContext, RequestSource } from "./types.ts";

function createRequestId(prefix = "req"): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function headerValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export class RequestContextResolver {
  private readonly authorizationService: AuthorizationService;

  constructor(authorizationService: AuthorizationService) {
    this.authorizationService = authorizationService;
  }

  resolveFromApiRequest(request: IncomingMessage): RequestContext {
    const requestId = headerValue(request, "x-aichestra-request-id") ?? createRequestId();
    const actorId = headerValue(request, "x-aichestra-actor-id");
    return this.fromAuthContext(this.authorizationService.getAuthContext({
      requestId,
      actorId,
      correlationId: headerValue(request, "x-aichestra-correlation-id"),
      source: "api",
      metadata: { mockHeaderActorOverride: actorId !== undefined }
    }), "api", headerValue(request, "x-aichestra-correlation-id"));
  }

  createSystemContext(reason: string): RequestContext {
    return this.fromAuthContext(this.authorizationService.getAuthContext({
      requestId: createRequestId("sysreq"),
      actorId: "mock-admin",
      source: "system",
      metadata: { reason }
    }), "system");
  }

  createTestContext(actorId: string, metadata: Record<string, unknown> = {}): RequestContext {
    return this.fromAuthContext(this.authorizationService.getAuthContext({
      requestId: createRequestId("testreq"),
      actorId,
      source: "test",
      metadata
    }), "test");
  }

  private fromAuthContext(authContext: AuthContext, source: RequestSource, correlationId?: string): RequestContext {
    return {
      requestId: authContext.requestId,
      authContext,
      correlationId,
      source,
      createdAt: new Date(),
      metadata: {
        authMode: authContext.authMode,
        productionAuthEnabled: false
      }
    };
  }
}
