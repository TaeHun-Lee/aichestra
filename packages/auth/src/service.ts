import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject,
  isPolicyAction,
  isPolicyResourceKind
} from "@aichestra/policy";
import type { PolicyAction, PolicyResourceKind, PolicySubject } from "@aichestra/policy";
import type { AuthRepository } from "./repository.ts";
import { InMemoryAuthRepository } from "./repository.ts";
import { MockAuthProvider } from "./providers.ts";
import type {
  AuthAuditEvent,
  AuthContext,
  AuthProvider,
  AuthProviderResolveRequest,
  AuthorizationCheckRequest,
  AuthorizationDecision,
  AuthorizationResource,
  Permission,
  ResourceScope,
  Role,
  RoleBinding
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
};

export class AuthorizationService {
  private readonly repository: AuthRepository;
  private readonly provider: AuthProvider;
  private readonly policyService: PolicyService;

  constructor(input: AuthorizationServiceInput = {}) {
    this.repository = input.repository ?? new InMemoryAuthRepository();
    this.provider = input.provider ?? new MockAuthProvider({ repository: this.repository });
    this.policyService = input.policyService ?? new PolicyService();
  }

  getConfig() {
    return {
      providerKind: this.provider.getProviderKind(),
      authMode: this.provider.getProviderKind() === "mock" ? "mock" : "future_provider_disabled",
      productionAuthEnabled: false,
      mockActorEnabled: this.provider.getProviderKind() === "mock",
      defaultMockActorId: "mock-admin",
      roleCatalogCount: this.repository.listRoles().length,
      permissionCatalogCount: this.repository.listPermissions().length,
      teamCount: this.repository.listTeams().length,
      serviceAccountCount: this.repository.listServiceAccounts().length,
      identityProviderCount: this.repository.listIdentityProviders().length,
      futureProvidersDisabled: true,
      secretsExposed: false,
      tokensExposed: false
    };
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
    return createPolicySubject({
      actorId: authContext.actor.id,
      principalId: authContext.principal.id,
      actorKind: authContext.actor.actorKind,
      roles: authContext.roles.map((role) => role.name),
      teams: authContext.teams.map((team) => team.id),
      authMode: authContext.authMode,
      serviceAccountId: serviceAccount?.id,
      isMockActor: authContext.metadata.isMockActor === true,
      metadata: {
        source: authContext.source,
        authenticated: authContext.authenticated,
        productionAuthEnabled: false
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
          metadata: resource.metadata
        }),
        context: createPolicyContext({
          ...request.policyContext,
          environment: {
            ...(request.policyContext?.environment ?? {}),
            authMode: authContext.authMode,
            authenticated: authContext.authenticated,
            productionAuthEnabled: false
          },
          metadata: {
            ...(request.policyContext?.metadata ?? {}),
            requestId: authContext.requestId
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
      action: request.action,
      resourceKind: resource.resourceKind,
      resourceId: resource.resourceId,
      result: "allowed",
      reason: "rbac_and_policy_allowed",
      requestId: authContext.requestId,
      policyDecisionId: policyDecision?.id,
      metadata: {
        authMode: authContext.authMode,
        roles: authContext.roles.map((role) => role.name),
        teams: authContext.teams.map((team) => team.id)
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
      action: request.action,
      resourceKind: request.resource.resourceKind,
      resourceId: request.resource.resourceId,
      result: "denied",
      reason,
      requestId: authContext.requestId,
      policyDecisionId: policyDecision?.id,
      metadata: {
        authMode: authContext.authMode,
        authenticated: authContext.authenticated,
        roles: authContext.roles.map((role) => role.name)
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
        action: permission.action,
        resourceKind: resource.resourceKind,
        resourceId: resource.resourceId,
        result: scopeMatches(binding.scope, resource.scope, resource.resourceKind, resource.resourceId) ? "allowed" : "denied",
        reason: `role_binding:${binding.id}`,
        requestId: authContext.requestId,
        metadata: {
          bindingScopeKind: binding.scope.scopeKind,
          bindingScopeId: binding.scope.scopeId,
          role: role.name
        }
      });
      return scopeMatches(binding.scope, resource.scope, resource.resourceKind, resource.resourceId);
    });
  }
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
