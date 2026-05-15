import { randomUUID } from "node:crypto";
import { createPolicySubject } from "@aichestra/policy";
import type { PolicyResourceScope, PolicySubject } from "@aichestra/policy";
import {
  listServiceAccountActorCatalog,
  requireActiveServiceAccountActorCatalogEntry,
  requireServiceAccountActorCatalogEntry
} from "./service-account-catalog.ts";
import type { ServiceAccountActorCatalogEntry } from "./service-account-catalog.ts";
import type {
  AuthContext,
  AuthMode,
  AuthorizationServiceInterface,
  RequestContext,
  RequestSource
} from "./types.ts";
import { ScopeContextFactory } from "./scope-context.ts";

export type ServiceAccountContextFactoryInput = {
  authorizationService: AuthorizationServiceInterface;
  idFactory?: (prefix: string) => string;
};

export type ServiceAccountContextOptions = {
  requestId?: string;
  correlationId?: string;
  source?: RequestSource;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  resourceScopes?: PolicyResourceScope[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

export class ServiceAccountContextFactory {
  private readonly authorizationService: AuthorizationServiceInterface;
  private readonly idFactory: (prefix: string) => string;
  private readonly scopeContextFactory = new ScopeContextFactory();

  constructor(input: ServiceAccountContextFactoryInput) {
    this.authorizationService = input.authorizationService;
    this.idFactory = input.idFactory ?? createRequestId;
  }

  listServiceAccounts(): ServiceAccountActorCatalogEntry[] {
    return listServiceAccountActorCatalog();
  }

  getServiceAccount(serviceAccountId: string): ServiceAccountActorCatalogEntry | undefined {
    try {
      return requireServiceAccountActorCatalogEntry(serviceAccountId);
    } catch {
      return undefined;
    }
  }

  requireServiceAccount(serviceAccountId: string): ServiceAccountActorCatalogEntry {
    return requireActiveServiceAccountActorCatalogEntry(serviceAccountId);
  }

  createServiceAccountAuthContext(serviceAccountId: string, options: ServiceAccountContextOptions = {}): AuthContext {
    const serviceAccount = this.requireServiceAccount(serviceAccountId);
    const requestId = options.requestId ?? this.idFactory("svcreq");
    const correlationId = options.correlationId ?? requestId;
    const source = options.source ?? serviceAccount.defaultSource;
    const scopeContext = this.scopeContextFactory.createTenantScopeContext({
      tenantId: options.tenantId,
      teamId: options.teamId,
      projectId: options.projectId,
      resourceScopes: options.resourceScopes
    });
    const metadata = serviceAccountMetadata(serviceAccount, {
      ...(options.metadata ?? {}),
      requestId,
      correlationId,
      source,
      tenantId: scopeContext.metadata.tenantId,
      teamId: scopeContext.metadata.teamId,
      projectId: scopeContext.metadata.projectId,
      resourceScopes: scopeContext.resourceScopes,
      serviceAccountContextFactory: "v1"
    });
    const baseContext = this.authorizationService.getAuthContext({
      requestId,
      actorId: serviceAccount.actorId,
      correlationId,
      source,
      tenantScopes: scopeContext.tenantScopes,
      teamScopes: scopeContext.teamScopes,
      projectScopes: scopeContext.projectScopes,
      resourceScopes: scopeContext.resourceScopes,
      metadata
    });
    if (!baseContext.authenticated || baseContext.actor.actorKind !== "service_account") {
      throw new Error(`service_account_actor_unavailable:${serviceAccount.id}`);
    }
    const context: AuthContext = {
      ...baseContext,
      authMode: "mock_service_account" as AuthMode,
      source,
      tenantScopes: scopeContext.tenantScopes,
      teamScopes: scopeContext.teamScopes,
      projectScopes: scopeContext.projectScopes,
      resourceScopes: scopeContext.resourceScopes,
      createdAt: options.createdAt ?? baseContext.createdAt,
      metadata: {
        ...safeMetadata(baseContext.metadata),
        ...metadata,
        authMode: "mock_service_account",
        isMockActor: true,
        tenantId: scopeContext.metadata.tenantId,
        teamId: scopeContext.metadata.teamId,
        projectId: scopeContext.metadata.projectId,
        resourceScopes: scopeContext.resourceScopes,
        productionAuthEnabled: false,
        productionServiceAccountIssuanceEnabled: false
      }
    };
    this.authorizationService.recordAuthorizationAudit({
      eventType: "service_account_used",
      actorId: context.actor.id,
      principalId: context.principal.id,
      serviceAccountId: serviceAccount.id,
      result: "resolved",
      reason: "mock_service_account_context_resolved",
      requestId,
      correlationId,
      source,
      metadata: {
        serviceAccountId: serviceAccount.id,
        serviceAccountKind: serviceAccount.serviceAccountKind,
        actorKind: "service_account",
        authMode: "mock_service_account",
        source,
        correlationId,
        tenantId: scopeContext.metadata.tenantId,
        teamId: scopeContext.metadata.teamId,
        projectId: scopeContext.metadata.projectId,
        resourceScopes: scopeContext.resourceScopes,
        productionAuthEnabled: false,
        productionServiceAccountIssuanceEnabled: false
      }
    });
    return context;
  }

  createServiceAccountRequestContext(
    serviceAccountId: string,
    source: RequestSource,
    options: Omit<ServiceAccountContextOptions, "source"> = {}
  ): RequestContext {
    const authContext = this.createServiceAccountAuthContext(serviceAccountId, {
      ...options,
      source
    });
    const correlationId = options.correlationId ?? stringMetadata(authContext.metadata.correlationId) ?? authContext.requestId;
    return {
      requestId: authContext.requestId,
      correlationId,
      authContext,
      source,
      tenantId: options.tenantId ?? authContext.tenantScopes?.[0]?.tenantId,
      teamId: options.teamId ?? authContext.teamScopes?.[0]?.teamId,
      projectId: options.projectId ?? authContext.projectScopes?.[0]?.projectId,
      resourceScopes: authContext.resourceScopes,
      createdAt: options.createdAt ?? new Date(),
      metadata: {
        ...safeMetadata(options.metadata ?? {}),
        ...serviceAccountMetadata(this.requireServiceAccount(serviceAccountId), {
          requestId: authContext.requestId,
          correlationId,
          source
        }),
        authMode: authContext.authMode,
        actorId: authContext.actor.id,
        principalId: authContext.principal.id,
        tenantId: options.tenantId ?? authContext.tenantScopes?.[0]?.tenantId,
        teamId: options.teamId ?? authContext.teamScopes?.[0]?.teamId,
        projectId: options.projectId ?? authContext.projectScopes?.[0]?.projectId,
        resourceScopes: authContext.resourceScopes,
        productionAuthEnabled: false
      }
    };
  }

  toPolicySubject(authContext: AuthContext, requestContext?: RequestContext): PolicySubject {
    const base = this.authorizationService.toPolicySubject(authContext);
    const serviceAccountId = stringMetadata(authContext.metadata.serviceAccountId) ?? base.serviceAccountId;
    return createPolicySubject({
      ...base,
      actorKind: "service_account",
      serviceAccountId,
      isMockActor: true,
      requestId: requestContext?.requestId ?? base.requestId ?? authContext.requestId,
      correlationId: requestContext?.correlationId ?? base.correlationId ?? stringMetadata(authContext.metadata.correlationId),
      source: requestContext?.source ?? base.source ?? authContext.source,
      tenantIds: base.tenantIds,
      teamIds: base.teamIds,
      projectIds: base.projectIds,
      resourceScopes: requestContext?.resourceScopes ?? base.resourceScopes,
      metadata: safeMetadata({
        ...(base.metadata ?? {}),
        serviceAccountId,
        actorKind: "service_account",
        authMode: authContext.authMode,
        requestId: requestContext?.requestId ?? authContext.requestId,
        correlationId: requestContext?.correlationId ?? stringMetadata(authContext.metadata.correlationId),
        source: requestContext?.source ?? authContext.source,
        tenantIds: base.tenantIds,
        teamIds: base.teamIds,
        projectIds: base.projectIds,
        resourceScopes: requestContext?.resourceScopes ?? base.resourceScopes,
        productionAuthEnabled: false,
        productionServiceAccountIssuanceEnabled: false
      })
    });
  }
}

export function createServiceAccountPolicySubject(
  serviceAccountId: string,
  options: {
    requestId?: string;
    correlationId?: string;
    source?: RequestSource;
    metadata?: Record<string, unknown>;
  } = {}
): PolicySubject {
  const serviceAccount = requireActiveServiceAccountActorCatalogEntry(serviceAccountId);
  return createPolicySubject({
    actorId: serviceAccount.actorId,
    principalId: serviceAccount.principalId,
    actorKind: "service_account",
    roles: [serviceAccount.roleName],
    teams: serviceAccount.ownerTeamId ? [serviceAccount.ownerTeamId] : [],
    authMode: "mock_service_account",
    serviceAccountId: serviceAccount.id,
    isMockActor: true,
    requestId: options.requestId,
    correlationId: options.correlationId,
    source: options.source,
    metadata: serviceAccountMetadata(serviceAccount, options.metadata ?? {})
  });
}

export function serviceAccountAuditMetadata(
  serviceAccountId: string,
  metadata: Record<string, unknown> = {}
): Record<string, unknown> {
  const serviceAccount = requireActiveServiceAccountActorCatalogEntry(serviceAccountId);
  return serviceAccountMetadata(serviceAccount, metadata);
}

function serviceAccountMetadata(serviceAccount: ServiceAccountActorCatalogEntry, metadata: Record<string, unknown>): Record<string, unknown> {
  return safeMetadata({
    ...metadata,
    serviceAccountId: serviceAccount.id,
    serviceAccountKind: serviceAccount.serviceAccountKind,
    actorKind: "service_account",
    serviceAccountStatus: serviceAccount.status,
    riskLevel: serviceAccount.riskLevel,
    authMode: "mock_service_account",
    localRuntimeOnly: true,
    productionAuthEnabled: false,
    productionServiceAccountIssuanceEnabled: false
  });
}

function createRequestId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
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

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
