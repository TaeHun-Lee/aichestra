import { randomUUID } from "node:crypto";
import type { AuthRepository } from "./repository.ts";
import { InMemoryAuthRepository } from "./repository.ts";
import type {
  Actor,
  AuthContext,
  AuthMode,
  AuthProvider,
  AuthProviderKind,
  AuthProviderResolveRequest,
  Permission,
  Principal,
  Role,
  RoleBinding,
  Team
} from "./types.ts";

function createRequestId(): string {
  return `req_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const id = key(item);
    if (!seen.has(id)) {
      seen.add(id);
      output.push(item);
    }
  }
  return output;
}

function disabledPrincipal(id: string): Principal {
  const now = new Date();
  return {
    id: `principal_unknown_${id.replace(/[^a-zA-Z0-9_]/g, "_")}`,
    principalKind: "system",
    displayName: `Unknown actor ${id}`,
    status: "disabled",
    createdAt: now,
    updatedAt: now,
    metadata: { authenticated: false, mock: true }
  };
}

function disabledActor(id: string, principalId: string): Actor {
  const now = new Date();
  return {
    id,
    principalId,
    actorKind: "anonymous_mock",
    displayName: `Unknown actor ${id}`,
    roles: [],
    teams: [],
    status: "disabled",
    createdAt: now,
    updatedAt: now,
    metadata: { authenticated: false, mock: true }
  };
}

export class MockAuthProvider implements AuthProvider {
  private readonly repository: AuthRepository;
  private readonly defaultActorId: string;

  constructor(input: { repository?: AuthRepository; defaultActorId?: string } = {}) {
    this.repository = input.repository ?? new InMemoryAuthRepository();
    this.defaultActorId = input.defaultActorId ?? "mock-admin";
  }

  getProviderKind(): AuthProviderKind {
    return "mock";
  }

  resolveAuthContext(request: AuthProviderResolveRequest = {}): AuthContext {
    const requestId = request.requestId ?? createRequestId();
    const actorId = request.actorId ?? this.defaultActorId;
    const actor = this.repository.getActor(actorId);
    const missing = actor === undefined;
    const resolvedActor = actor ?? disabledActor(actorId, `principal_unknown_${actorId.replace(/[^a-zA-Z0-9_]/g, "_")}`);
    const principal = this.repository.getPrincipal(resolvedActor.principalId) ?? disabledPrincipal(actorId);
    const teams = resolvedActor.teams.map((teamId) => this.repository.getTeam(teamId)).filter((team): team is Team => Boolean(team));
    const principalBindings = this.repository.listRoleBindings({ principalId: principal.id });
    const teamBindings = teams.flatMap((team) => this.repository.listRoleBindings({ teamId: team.id }));
    const roleBindings = uniqueBy([...principalBindings, ...teamBindings], (binding) => binding.id).filter((binding) => binding.status === "active");
    const actorRoles = resolvedActor.roles.map((name) => this.repository.getRole(name)).filter((role): role is Role => Boolean(role));
    const boundRoles = roleBindings.map((binding) => this.repository.getRole(binding.roleId)).filter((role): role is Role => Boolean(role));
    const roles = uniqueBy([...actorRoles, ...boundRoles], (role) => role.id).filter((role) => role.status === "active");
    const permissions = uniqueBy(
      roles.flatMap((role) => role.permissions.map((permissionId) => this.repository.getPermission(permissionId)).filter((permission): permission is Permission => Boolean(permission))),
      (permission) => permission.id
    );
    const authenticated = !missing && resolvedActor.status === "active" && principal.status === "active";
    const context: AuthContext = {
      requestId,
      actor: resolvedActor,
      principal,
      teams,
      roles,
      permissions,
      roleBindings,
      tenantScopes: request.tenantScopes ? structuredClone(request.tenantScopes) : undefined,
      teamScopes: request.teamScopes ? structuredClone(request.teamScopes) : undefined,
      projectScopes: request.projectScopes ? structuredClone(request.projectScopes) : undefined,
      resourceScopes: request.resourceScopes ? structuredClone(request.resourceScopes) : undefined,
      authMode: "mock",
      authenticated,
      source: request.source ?? "api",
      createdAt: new Date(),
      metadata: {
        ...request.metadata,
        isMockActor: true,
        authProviderKind: "mock",
        authProviderStatus: "active_mock",
        productionAuthEnabled: false,
        tokenValidationEnabled: false,
        sessionBoundaryStatus: "disabled",
        identityMappingStatus: "not_configured",
        correlationId: request.correlationId
      }
    };

    this.repository.recordAuthAuditEvent({
      eventType: missing ? "auth_context_missing" : "auth_context_resolved",
      actorId: resolvedActor.id,
      principalId: principal.id,
      result: missing ? "missing" : "resolved",
      reason: missing ? "actor_not_found" : "mock_auth_context_resolved",
      requestId,
      correlationId: request.correlationId,
      source: context.source,
      metadata: {
        authMode: "mock",
        source: context.source,
        correlationId: request.correlationId,
        authenticated,
        authProviderKind: "mock",
        authProviderStatus: "active_mock",
        productionAuthEnabled: false,
        tokenValidationEnabled: false,
        sessionBoundaryStatus: "disabled",
        identityMappingStatus: "not_configured"
      }
    });
    if (!missing) {
      this.repository.recordAuthAuditEvent({
        eventType: "mock_actor_used",
        actorId: resolvedActor.id,
        principalId: principal.id,
        result: "resolved",
        reason: "MockAuthProvider is default and is not production auth.",
        requestId,
        correlationId: request.correlationId,
        source: context.source,
        metadata: { authMode: "mock", source: context.source, correlationId: request.correlationId, productionAuthEnabled: false }
      });
      this.repository.recordAuthAuditEvent({
        eventType: "mock_auth_provider_used",
        actorId: resolvedActor.id,
        principalId: principal.id,
        result: "resolved",
        reason: "MockAuthProvider remains the default runtime provider.",
        requestId,
        correlationId: request.correlationId,
        source: context.source,
        metadata: {
          authMode: "mock",
          source: context.source,
          correlationId: request.correlationId,
          authProviderKind: "mock",
          authProviderStatus: "active_mock",
          productionAuthEnabled: false,
          tokenValidationEnabled: false,
          sessionBoundaryStatus: "disabled",
          identityMappingStatus: "not_configured"
        }
      });
    }
    if (resolvedActor.actorKind === "service_account") {
      const serviceAccount = this.repository.getServiceAccount(principal.id);
      this.repository.recordAuthAuditEvent({
        eventType: "service_account_used",
        actorId: resolvedActor.id,
        principalId: principal.id,
        serviceAccountId: serviceAccount?.id,
        result: authenticated ? "resolved" : "denied",
        reason: authenticated ? "service_account_context_resolved" : "service_account_disabled_or_missing",
        requestId,
        correlationId: request.correlationId,
        source: context.source,
        metadata: { authMode: "mock", source: context.source, correlationId: request.correlationId, serviceAccountId: serviceAccount?.id }
      });
    }
    return context;
  }

  validateActor(actor: Actor) {
    if (actor.status !== "active") return { ok: false, reason: "actor_disabled" };
    const principal = this.repository.getPrincipal(actor.principalId);
    if (!principal || principal.status !== "active") return { ok: false, reason: "principal_inactive_or_missing" };
    return { ok: true };
  }

  listRoles(): Role[] {
    return this.repository.listRoles();
  }

  listPermissions(): Permission[] {
    return this.repository.listPermissions();
  }
}

export class StaticBearerAuthProvider implements AuthProvider {
  private readonly repository: AuthRepository;
  private readonly expectedTokenSha256: string;
  private readonly actorId: string;

  constructor(input: { repository?: AuthRepository; expectedTokenSha256: string; actorId: string }) {
    this.repository = input.repository ?? new InMemoryAuthRepository();
    this.expectedTokenSha256 = input.expectedTokenSha256;
    this.actorId = input.actorId;
  }

  getProviderKind(): AuthProviderKind {
    return "static_bearer";
  }

  resolveAuthContext(request: AuthProviderResolveRequest = {}): AuthContext {
    const requestId = request.requestId ?? createRequestId();
    const tokenMatches = Boolean(request.bearerTokenSha256) && request.bearerTokenSha256 === this.expectedTokenSha256;
    const actorId = tokenMatches ? this.actorId : "anonymous-mock";
    const actor = this.repository.getActor(actorId);
    const missing = actor === undefined;
    const resolvedActor = actor ?? disabledActor(actorId, `principal_unknown_${actorId.replace(/[^a-zA-Z0-9_]/g, "_")}`);
    const principal = this.repository.getPrincipal(resolvedActor.principalId) ?? disabledPrincipal(actorId);
    const teams = resolvedActor.teams.map((teamId) => this.repository.getTeam(teamId)).filter((team): team is Team => Boolean(team));
    const principalBindings = this.repository.listRoleBindings({ principalId: principal.id });
    const teamBindings = teams.flatMap((team) => this.repository.listRoleBindings({ teamId: team.id }));
    const roleBindings = uniqueBy([...principalBindings, ...teamBindings], (binding) => binding.id).filter((binding) => binding.status === "active");
    const actorRoles = resolvedActor.roles.map((name) => this.repository.getRole(name)).filter((role): role is Role => Boolean(role));
    const boundRoles = roleBindings.map((binding) => this.repository.getRole(binding.roleId)).filter((role): role is Role => Boolean(role));
    const roles = uniqueBy([...actorRoles, ...boundRoles], (role) => role.id).filter((role) => role.status === "active");
    const permissions = uniqueBy(
      roles.flatMap((role) => role.permissions.map((permissionId) => this.repository.getPermission(permissionId)).filter((permission): permission is Permission => Boolean(permission))),
      (permission) => permission.id
    );
    const authenticated = tokenMatches && !missing && resolvedActor.status === "active" && principal.status === "active";
    const context: AuthContext = {
      requestId,
      actor: resolvedActor,
      principal,
      teams,
      roles,
      permissions,
      roleBindings,
      tenantScopes: request.tenantScopes ? structuredClone(request.tenantScopes) : undefined,
      teamScopes: request.teamScopes ? structuredClone(request.teamScopes) : undefined,
      projectScopes: request.projectScopes ? structuredClone(request.projectScopes) : undefined,
      resourceScopes: request.resourceScopes ? structuredClone(request.resourceScopes) : undefined,
      authMode: "static_bearer",
      authenticated,
      source: request.source ?? "api",
      createdAt: new Date(),
      metadata: {
        ...request.metadata,
        isMockActor: false,
        authProviderKind: "static_bearer",
        authProviderStatus: "active",
        productionAuthEnabled: true,
        tokenValidationEnabled: true,
        tokenStored: false,
        tokenEchoed: false,
        tokenHashMatched: tokenMatches,
        sessionBoundaryStatus: "bearer_token_hash",
        identityMappingStatus: "static_actor_mapping",
        correlationId: request.correlationId
      }
    };

    this.repository.recordAuthAuditEvent({
      eventType: tokenMatches && authenticated ? "auth_context_resolved" : "auth_context_missing",
      actorId: resolvedActor.id,
      principalId: principal.id,
      result: tokenMatches && authenticated ? "resolved" : "denied",
      reason: tokenMatches && authenticated ? "static_bearer_auth_context_resolved" : "static_bearer_token_missing_or_invalid",
      requestId,
      correlationId: request.correlationId,
      source: context.source,
      metadata: {
        authMode: "static_bearer",
        source: context.source,
        correlationId: request.correlationId,
        authenticated,
        authProviderKind: "static_bearer",
        authProviderStatus: "active",
        productionAuthEnabled: true,
        tokenValidationEnabled: true,
        tokenStored: false,
        tokenEchoed: false,
        actorMapping: this.actorId
      }
    });
    return context;
  }

  validateActor(actor: Actor) {
    if (actor.status !== "active") return { ok: false, reason: "actor_disabled" };
    const principal = this.repository.getPrincipal(actor.principalId);
    if (!principal || principal.status !== "active") return { ok: false, reason: "principal_inactive_or_missing" };
    return { ok: true };
  }

  listRoles(): Role[] {
    return this.repository.listRoles();
  }

  listPermissions(): Permission[] {
    return this.repository.listPermissions();
  }
}

export class FutureAuthProviderPlaceholder implements AuthProvider {
  private readonly kind: Exclude<AuthProviderKind, "mock">;
  private readonly mode: AuthMode;

  constructor(kind: Exclude<AuthProviderKind, "mock">, mode: AuthMode = "future_oidc") {
    this.kind = kind;
    this.mode = mode;
  }

  getProviderKind(): AuthProviderKind {
    return this.kind;
  }

  resolveAuthContext(): AuthContext {
    throw new Error(`${this.kind} is disabled and not implemented in Production Auth/RBAC Planning v0.`);
  }

  validateActor() {
    return { ok: false, reason: `${this.kind}_disabled` };
  }

  listRoles(): Role[] {
    return [];
  }

  listPermissions(): Permission[] {
    return [];
  }

  getAuthMode(): AuthMode {
    return this.mode;
  }
}

export class FutureOidcAuthProviderPlaceholder extends FutureAuthProviderPlaceholder {
  constructor() {
    super("future_oidc", "future_oidc");
  }
}

export class FutureSamlAuthProviderPlaceholder extends FutureAuthProviderPlaceholder {
  constructor() {
    super("future_saml", "future_saml");
  }
}

export class FutureScimDirectoryPlaceholder extends FutureAuthProviderPlaceholder {
  constructor() {
    super("scim_future", "future_oidc");
  }
}

export class FutureServiceAccountAuthProviderPlaceholder extends FutureAuthProviderPlaceholder {
  constructor() {
    super("future_service_account", "future_service_account");
  }
}
