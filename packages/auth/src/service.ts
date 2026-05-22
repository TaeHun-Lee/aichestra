import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject,
  isPolicyAction,
  isPolicyResourceKind
} from "@aichestra/policy";
import type { PolicyAction, PolicyResourceKind, PolicySubject } from "@aichestra/policy";
import type { PolicyResourceScopeKind } from "@aichestra/policy";
import type { AuthRepository } from "./repository.ts";
import { InMemoryAuthRepository } from "./repository.ts";
import { MockAuthProvider } from "./providers.ts";
import { ProductionAuthProviderRegistry } from "./production-provider-skeleton.ts";
import type {
  AuthAuditEvent,
  AuthContext,
  AuthProvider,
  AuthProviderResolveRequest,
  AuthorizationCheckRequest,
  AuthorizationDecision,
  AuthorizationResource,
  IdentityMappingPlan,
  Permission,
  ProductionAuthProviderConfig,
  ProductionAuthProviderReadiness,
  ProductionAuthProviderSkeletonSummary,
  ResourceScope,
  Role,
  RoleBinding,
  SessionTokenBoundaryPlan
} from "./types.ts";

export class AuthorizationError extends Error {
  readonly decision: AuthorizationDecision;

  constructor(decision: AuthorizationDecision) {
    super(decision.reason);
    this.name = "AuthorizationError";
    this.decision = decision;
  }
}

export type AuthorizationServiceInput = {
  provider?: AuthProvider;
  repository?: AuthRepository;
  policyService?: PolicyService;
  productionAuthProviderRegistry?: ProductionAuthProviderRegistry;
};

export class AuthorizationService {
  private readonly repository: AuthRepository;
  private readonly provider: AuthProvider;
  private readonly policyService: PolicyService;
  private readonly productionAuthProviderRegistry: ProductionAuthProviderRegistry;

  constructor(input: AuthorizationServiceInput = {}) {
    this.repository = input.repository ?? new InMemoryAuthRepository();
    this.provider = input.provider ?? new MockAuthProvider({ repository: this.repository });
    this.policyService = input.policyService ?? new PolicyService();
    this.productionAuthProviderRegistry = input.productionAuthProviderRegistry ?? new ProductionAuthProviderRegistry({ repository: this.repository });
  }

  getConfig() {
    const productionAuthProvider = this.productionAuthProviderRegistry.getSummary();
    const providerKind = this.provider.getProviderKind();
    const productionAuthEnabled = providerKind === "static_bearer";
    return {
      providerKind,
      authMode: providerKind === "mock" ? "mock" : providerKind,
      productionAuthEnabled,
      selectedAuthProviderKind: productionAuthEnabled ? providerKind : productionAuthProvider.selectedProviderKind,
      activeAuthProviderKind: providerKind,
      authProviderKind: providerKind,
      authProviderStatus: productionAuthEnabled ? "active" : productionAuthProvider.selectedProviderStatus,
      productionAuthProviderStatus: productionAuthEnabled ? "active" : productionAuthProvider.selectedProviderStatus,
      futureProviderSelected: productionAuthProvider.futureProviderSelected,
      futureProviderBlocked: productionAuthProvider.futureProviderBlocked,
      requireAuthForApi: productionAuthEnabled,
      tokenValidationEnabled: productionAuthEnabled,
      sessionBoundaryStatus: productionAuthEnabled ? "bearer_token_hash" : productionAuthProvider.sessionBoundaryStatus,
      sessionBoundaryEnabled: productionAuthEnabled,
      identityMappingStatus: productionAuthEnabled ? "static_actor_mapping" : productionAuthProvider.identityMappingStatus,
      externalAuthCallsEnabled: false,
      mockActorEnabled: providerKind === "mock",
      defaultMockActorId: "mock-admin",
      roleCatalogCount: this.repository.listRoles().length,
      permissionCatalogCount: this.repository.listPermissions().length,
      teamCount: this.repository.listTeams().length,
      serviceAccountCount: this.repository.listServiceAccounts().length,
      identityProviderCount: this.repository.listIdentityProviders().length,
      productionAuthProviderOptionCount: productionAuthProvider.providerOptionCount,
      productionAuthProviderMissingConfigCount: productionAuthProvider.missingConfigCount,
      productionAuthProviderBlockerCount: productionAuthProvider.blockerCount,
      futureProvidersDisabled: true,
      authorizationHeadersStored: false,
      cookiesStored: false,
      sessionIdsExposed: false,
      secretsExposed: false,
      tokensExposed: false,
      envValuesExposed: false
    };
  }

  getProductionAuthProviderSummary(): ProductionAuthProviderSkeletonSummary {
    return this.productionAuthProviderRegistry.getSummary();
  }

  listProductionAuthProviderConfigs(): ProductionAuthProviderConfig[] {
    return this.productionAuthProviderRegistry.listProviderConfigs();
  }

  listProductionAuthProviderReadiness(): ProductionAuthProviderReadiness[] {
    return this.productionAuthProviderRegistry.listProviderReadiness();
  }

  listSessionTokenBoundaryPlans(): SessionTokenBoundaryPlan[] {
    return this.productionAuthProviderRegistry.listSessionTokenBoundaryPlans();
  }

  listIdentityMappingPlans(): IdentityMappingPlan[] {
    return this.productionAuthProviderRegistry.listIdentityMappingPlans();
  }

  getAuthContext(request?: AuthProviderResolveRequest): AuthContext {
    return this.provider.resolveAuthContext(request);
  }

  hasPermission(authContext: AuthContext, action: string, resource: AuthorizationResource): AuthorizationDecision {
    return this.evaluate({
      authContext,
      action,
      resource
    });
  }

  check(request: AuthorizationCheckRequest): AuthorizationDecision {
    return this.evaluate(request);
  }

  requirePermission(authContext: AuthContext, action: string, resource: AuthorizationResource): AuthorizationDecision {
    const decision = this.hasPermission(authContext, action, resource);
    if (!decision.allowed) throw new AuthorizationError(decision);
    return decision;
  }

  toPolicySubject(authContext: AuthContext): PolicySubject {
    const serviceAccount = this.repository.getServiceAccount(authContext.principal.id);
    const serviceAccountId = stringMetadata(authContext.metadata.serviceAccountId) ?? serviceAccount?.id;
    const tenantIds = uniqueStrings(authContext.tenantScopes?.map((scope) => scope.tenantId));
    const teamIds = uniqueStrings([
      ...(authContext.teams.map((team) => team.id) ?? []),
      ...(authContext.teamScopes?.map((scope) => scope.teamId) ?? [])
    ]);
    const projectIds = uniqueStrings(authContext.projectScopes?.map((scope) => scope.projectId));
    return createPolicySubject({
      actorId: authContext.actor.id,
      principalId: authContext.principal.id,
      actorKind: authContext.actor.actorKind,
      roles: authContext.roles.map((role) => role.name),
      teams: authContext.teams.map((team) => team.id),
      authMode: authContext.authMode,
      serviceAccountId,
      isMockActor: authContext.metadata.isMockActor === true,
      requestId: authContext.requestId,
      correlationId: stringMetadata(authContext.metadata.correlationId),
      source: authContext.source,
      tenantIds,
      teamIds,
      projectIds,
      resourceScopes: authContext.resourceScopes,
      metadata: {
        source: authContext.source,
        requestId: authContext.requestId,
        correlationId: stringMetadata(authContext.metadata.correlationId),
        authenticated: authContext.authenticated,
        actorKind: authContext.actor.actorKind,
        serviceAccountId,
        tenantIds,
        teamIds,
        projectIds,
        resourceScopes: authContext.resourceScopes,
        authProviderKind: stringMetadata(authContext.metadata.authProviderKind) ?? "mock",
        authProviderStatus: stringMetadata(authContext.metadata.authProviderStatus) ?? "active_mock",
        productionAuthEnabled: authContext.metadata.productionAuthEnabled === true,
        tokenValidationEnabled: authContext.metadata.tokenValidationEnabled === true,
        sessionBoundaryStatus: stringMetadata(authContext.metadata.sessionBoundaryStatus) ?? "disabled",
        identityMappingStatus: stringMetadata(authContext.metadata.identityMappingStatus) ?? "not_configured"
      }
    });
  }

  recordAuthorizationAudit(event: Omit<AuthAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): AuthAuditEvent {
    return this.repository.recordAuthAuditEvent(event);
  }

  listPrincipals() {
    return this.repository.listPrincipals();
  }

  listActors() {
    return this.repository.listActors();
  }

  listTeams() {
    return this.repository.listTeams();
  }

  listRoles() {
    return this.repository.listRoles();
  }

  listPermissions() {
    return this.repository.listPermissions();
  }

  listRoleBindings() {
    return this.repository.listRoleBindings();
  }

  listServiceAccounts() {
    return this.repository.listServiceAccounts();
  }

  listIdentityProviders() {
    return this.repository.listIdentityProviders();
  }

  listAuditEvents(filter: { actorId?: string; principalId?: string; eventType?: string; action?: string } = {}) {
    return this.repository.listAuthAuditEvents(filter);
  }

  private evaluate(request: AuthorizationCheckRequest): AuthorizationDecision {
    const authContext = request.authContext;
    const resource = request.resource;
    const permission = this.repository.getPermission(request.action);
    if (!authContext.authenticated || authContext.actor.status !== "active" || authContext.principal.status !== "active") {
      return this.deny(request, "actor_not_authenticated_or_disabled", permission);
    }
    if (!permission) {
      return this.deny(request, `permission_not_registered:${request.action}`);
    }
    if (!this.permissionGrantedByActiveBinding(authContext, permission, resource)) {
      return this.deny(request, `permission_denied:${request.action}`, permission);
    }

    let policyDecision: AuthorizationDecision["policyDecision"];
    if (isPolicyAction(request.action) && isPolicyResourceKind(resource.resourceKind)) {
      policyDecision = this.policyService.evaluate({
        subject: this.toPolicySubject(authContext),
        action: request.action as PolicyAction,
        resource: createPolicyResource({
          resourceKind: resource.resourceKind as PolicyResourceKind,
          resourceId: resource.resourceId,
          scopeKind: toPolicyScopeKind(resource.scope?.scopeKind),
          scopeId: resource.scope?.scopeId,
          tenantId: stringMetadata(resource.scope?.metadata.tenantId),
          teamId: resource.scope?.scopeKind === "team" ? resource.scope.scopeId : stringMetadata(resource.scope?.metadata.teamId),
          projectId: resource.scope?.scopeKind === "project" ? resource.scope.scopeId : stringMetadata(resource.scope?.metadata.projectId),
          resourceScopes: authContext.resourceScopes,
          metadata: resource.metadata
        }),
        context: createPolicyContext({
          ...request.policyContext,
          environment: {
            ...(request.policyContext?.environment ?? {}),
            authMode: authContext.authMode,
            authenticated: authContext.authenticated,
            authProviderKind: stringMetadata(authContext.metadata.authProviderKind) ?? "mock",
            authProviderStatus: stringMetadata(authContext.metadata.authProviderStatus) ?? "active_mock",
            productionAuthEnabled: authContext.metadata.productionAuthEnabled === true,
            tokenValidationEnabled: authContext.metadata.tokenValidationEnabled === true,
            sessionBoundaryStatus: stringMetadata(authContext.metadata.sessionBoundaryStatus) ?? "disabled",
            identityMappingStatus: stringMetadata(authContext.metadata.identityMappingStatus) ?? "not_configured"
          },
          metadata: {
            ...(request.policyContext?.metadata ?? {}),
            requestId: authContext.requestId,
            correlationId: stringMetadata(authContext.metadata.correlationId),
            source: authContext.source,
            tenantIds: authContext.tenantScopes?.map((scope) => scope.tenantId),
            teamIds: authContext.teamScopes?.map((scope) => scope.teamId),
            projectIds: authContext.projectScopes?.map((scope) => scope.projectId),
            resourceScopes: authContext.resourceScopes,
            authProviderKind: stringMetadata(authContext.metadata.authProviderKind) ?? "mock",
            authProviderStatus: stringMetadata(authContext.metadata.authProviderStatus) ?? "active_mock",
            productionAuthEnabled: authContext.metadata.productionAuthEnabled === true
          }
        })
      });
      if (!policyDecision.allowed) {
        return this.deny(request, `policy_denied:${policyDecision.reason}`, permission, policyDecision);
      }
    }

    const auditEvent = this.recordAuthorizationAudit({
      eventType: "authorization_allowed",
      actorId: authContext.actor.id,
      principalId: authContext.principal.id,
      serviceAccountId: stringMetadata(authContext.metadata.serviceAccountId) ?? this.repository.getServiceAccount(authContext.principal.id)?.id,
      action: request.action,
      resourceKind: resource.resourceKind,
      resourceId: resource.resourceId,
      result: "allowed",
      reason: "rbac_and_policy_allowed",
      requestId: authContext.requestId,
      correlationId: stringMetadata(authContext.metadata.correlationId),
      source: authContext.source,
      policyDecisionId: policyDecision?.id,
      metadata: {
        authMode: authContext.authMode,
        source: authContext.source,
        correlationId: stringMetadata(authContext.metadata.correlationId),
        actorKind: authContext.actor.actorKind,
        serviceAccountId: stringMetadata(authContext.metadata.serviceAccountId) ?? this.repository.getServiceAccount(authContext.principal.id)?.id,
        roles: authContext.roles.map((role) => role.name),
        teams: authContext.teams.map((team) => team.id),
        tenantIds: authContext.tenantScopes?.map((scope) => scope.tenantId),
        teamIds: authContext.teamScopes?.map((scope) => scope.teamId),
        projectIds: authContext.projectScopes?.map((scope) => scope.projectId),
        resourceScopes: authContext.resourceScopes
      }
    });
    return {
      allowed: true,
      reason: "allowed",
      action: request.action,
      resourceKind: resource.resourceKind,
      resourceId: resource.resourceId,
      actorId: authContext.actor.id,
      principalId: authContext.principal.id,
      requiredPermission: permission.action,
      policyDecision,
      auditEvent
    };
  }

  private deny(
    request: AuthorizationCheckRequest,
    reason: string,
    permission?: Permission,
    policyDecision?: AuthorizationDecision["policyDecision"]
  ): AuthorizationDecision {
    const authContext = request.authContext;
    const auditEvent = this.recordAuthorizationAudit({
      eventType: "authorization_denied",
      actorId: authContext.actor.id,
      principalId: authContext.principal.id,
      serviceAccountId: stringMetadata(authContext.metadata.serviceAccountId) ?? this.repository.getServiceAccount(authContext.principal.id)?.id,
      action: request.action,
      resourceKind: request.resource.resourceKind,
      resourceId: request.resource.resourceId,
      result: "denied",
      reason,
      requestId: authContext.requestId,
      correlationId: stringMetadata(authContext.metadata.correlationId),
      source: authContext.source,
      policyDecisionId: policyDecision?.id,
      metadata: {
        authMode: authContext.authMode,
        source: authContext.source,
        correlationId: stringMetadata(authContext.metadata.correlationId),
        authenticated: authContext.authenticated,
        actorKind: authContext.actor.actorKind,
        serviceAccountId: stringMetadata(authContext.metadata.serviceAccountId) ?? this.repository.getServiceAccount(authContext.principal.id)?.id,
        roles: authContext.roles.map((role) => role.name),
        tenantIds: authContext.tenantScopes?.map((scope) => scope.tenantId),
        teamIds: authContext.teamScopes?.map((scope) => scope.teamId),
        projectIds: authContext.projectScopes?.map((scope) => scope.projectId),
        resourceScopes: authContext.resourceScopes
      }
    });
    return {
      allowed: false,
      reason,
      action: request.action,
      resourceKind: request.resource.resourceKind,
      resourceId: request.resource.resourceId,
      actorId: authContext.actor.id,
      principalId: authContext.principal.id,
      requiredPermission: permission?.action ?? request.action,
      policyDecision,
      auditEvent
    };
  }

  private permissionGrantedByActiveBinding(authContext: AuthContext, permission: Permission, resource: AuthorizationResource): boolean {
    if (!authContext.permissions.some((candidate) => candidate.id === permission.id)) return false;
    const actorRoles = new Set(authContext.roles.map((role) => role.id));
    return authContext.roleBindings.some((binding) => {
      if (binding.status !== "active" || !actorRoles.has(binding.roleId)) return false;
      const role = this.repository.getRole(binding.roleId);
      if (!role?.permissions.includes(permission.id)) return false;
      this.recordAuthorizationAudit({
        eventType: "role_binding_evaluated",
        actorId: authContext.actor.id,
        principalId: authContext.principal.id,
        serviceAccountId: stringMetadata(authContext.metadata.serviceAccountId) ?? this.repository.getServiceAccount(authContext.principal.id)?.id,
        action: permission.action,
        resourceKind: resource.resourceKind,
        resourceId: resource.resourceId,
        result: scopeMatches(binding.scope, resource.scope, resource.resourceKind, resource.resourceId) ? "allowed" : "denied",
        reason: `role_binding:${binding.id}`,
        requestId: authContext.requestId,
        correlationId: stringMetadata(authContext.metadata.correlationId),
        source: authContext.source,
        metadata: {
          source: authContext.source,
          correlationId: stringMetadata(authContext.metadata.correlationId),
          actorKind: authContext.actor.actorKind,
          serviceAccountId: stringMetadata(authContext.metadata.serviceAccountId) ?? this.repository.getServiceAccount(authContext.principal.id)?.id,
          bindingScopeKind: binding.scope.scopeKind,
          bindingScopeId: binding.scope.scopeId,
          role: role.name,
          tenantIds: authContext.tenantScopes?.map((scope) => scope.tenantId),
          teamIds: authContext.teamScopes?.map((scope) => scope.teamId),
          projectIds: authContext.projectScopes?.map((scope) => scope.projectId),
          resourceScopes: authContext.resourceScopes
        }
      });
      return scopeMatches(binding.scope, resource.scope, resource.resourceKind, resource.resourceId);
    });
  }
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function uniqueStrings(values: Array<string | undefined> | undefined): string[] | undefined {
  if (!values) return undefined;
  const unique = [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
  return unique.length > 0 ? unique : undefined;
}

function toPolicyScopeKind(scopeKind: ResourceScope["scopeKind"] | undefined): PolicyResourceScopeKind | undefined {
  if (!scopeKind) return undefined;
  if (scopeKind === "org") return "tenant";
  if (scopeKind === "registry") return "registry_package";
  if (scopeKind === "local_agent") return "local_agent_host";
  if (scopeKind === "global" || scopeKind === "team" || scopeKind === "repo" || scopeKind === "project" || scopeKind === "provider") {
    return scopeKind;
  }
  return undefined;
}

function scopeMatches(bindingScope: ResourceScope, requestedScope: ResourceScope | undefined, resourceKind: string, resourceId?: string): boolean {
  if (bindingScope.scopeKind === "global") return true;
  if (requestedScope) {
    if (bindingScope.scopeKind !== requestedScope.scopeKind) return false;
    return bindingScope.scopeId === undefined || bindingScope.scopeId === requestedScope.scopeId;
  }
  if (bindingScope.scopeKind === resourceKind) {
    return bindingScope.scopeId === undefined || bindingScope.scopeId === resourceId;
  }
  return false;
}
