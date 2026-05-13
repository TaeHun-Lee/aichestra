import { randomUUID } from "node:crypto";
import { createDefaultAuthCatalog, type AuthCatalog } from "./catalog.ts";
import type {
  Actor,
  AuthAuditEvent,
  IdentityProvider,
  Permission,
  Principal,
  Role,
  RoleBinding,
  ServiceAccount,
  Team
} from "./types.ts";

function createAuthId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export type AuthRepository = {
  listPrincipals(): Principal[];
  getPrincipal(id: string): Principal | undefined;
  upsertPrincipal(input: Principal): Principal;
  listActors(): Actor[];
  getActor(id: string): Actor | undefined;
  getActorByPrincipalId(principalId: string): Actor | undefined;
  upsertActor(input: Actor): Actor;
  listTeams(): Team[];
  getTeam(id: string): Team | undefined;
  upsertTeam(input: Team): Team;
  listRoles(): Role[];
  getRole(idOrName: string): Role | undefined;
  upsertRole(input: Role): Role;
  listPermissions(): Permission[];
  getPermission(idOrAction: string): Permission | undefined;
  upsertPermission(input: Permission): Permission;
  listRoleBindings(filter?: { principalId?: string; teamId?: string }): RoleBinding[];
  upsertRoleBinding(input: RoleBinding): RoleBinding;
  listServiceAccounts(): ServiceAccount[];
  getServiceAccount(idOrPrincipalId: string): ServiceAccount | undefined;
  upsertServiceAccount(input: ServiceAccount): ServiceAccount;
  listIdentityProviders(): IdentityProvider[];
  getIdentityProvider(id: string): IdentityProvider | undefined;
  upsertIdentityProvider(input: IdentityProvider): IdentityProvider;
  recordAuthAuditEvent(input: Omit<AuthAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): AuthAuditEvent;
  listAuthAuditEvents(filter?: { actorId?: string; principalId?: string; eventType?: string; action?: string }): AuthAuditEvent[];
};

export class InMemoryAuthRepository implements AuthRepository {
  private readonly principals: Principal[];
  private readonly actors: Actor[];
  private readonly teams: Team[];
  private readonly roles: Role[];
  private readonly permissions: Permission[];
  private readonly roleBindings: RoleBinding[];
  private readonly serviceAccounts: ServiceAccount[];
  private readonly identityProviders: IdentityProvider[];
  private readonly auditEvents: AuthAuditEvent[] = [];

  constructor(seed: Partial<AuthCatalog> = {}) {
    const catalog = createDefaultAuthCatalog();
    this.principals = clone(seed.principals ?? catalog.principals);
    this.actors = clone(seed.actors ?? catalog.actors);
    this.teams = clone(seed.teams ?? catalog.teams);
    this.roles = clone(seed.roles ?? catalog.roles);
    this.permissions = clone(seed.permissions ?? catalog.permissions);
    this.roleBindings = clone(seed.roleBindings ?? catalog.roleBindings);
    this.serviceAccounts = clone(seed.serviceAccounts ?? catalog.serviceAccounts);
    this.identityProviders = clone(seed.identityProviders ?? catalog.identityProviders);
  }

  listPrincipals(): Principal[] {
    return clone(this.principals);
  }

  getPrincipal(id: string): Principal | undefined {
    return clone(this.principals.find((principal) => principal.id === id));
  }

  upsertPrincipal(input: Principal): Principal {
    return this.upsert(this.principals, input);
  }

  listActors(): Actor[] {
    return clone(this.actors);
  }

  getActor(id: string): Actor | undefined {
    return clone(this.actors.find((actor) => actor.id === id));
  }

  getActorByPrincipalId(principalId: string): Actor | undefined {
    return clone(this.actors.find((actor) => actor.principalId === principalId));
  }

  upsertActor(input: Actor): Actor {
    return this.upsert(this.actors, input);
  }

  listTeams(): Team[] {
    return clone(this.teams);
  }

  getTeam(id: string): Team | undefined {
    return clone(this.teams.find((team) => team.id === id || team.name === id));
  }

  upsertTeam(input: Team): Team {
    return this.upsert(this.teams, input);
  }

  listRoles(): Role[] {
    return clone(this.roles);
  }

  getRole(idOrName: string): Role | undefined {
    return clone(this.roles.find((role) => role.id === idOrName || role.name === idOrName));
  }

  upsertRole(input: Role): Role {
    return this.upsert(this.roles, input);
  }

  listPermissions(): Permission[] {
    return clone(this.permissions);
  }

  getPermission(idOrAction: string): Permission | undefined {
    return clone(this.permissions.find((permission) => permission.id === idOrAction || permission.action === idOrAction));
  }

  upsertPermission(input: Permission): Permission {
    return this.upsert(this.permissions, input);
  }

  listRoleBindings(filter: { principalId?: string; teamId?: string } = {}): RoleBinding[] {
    return clone(this.roleBindings.filter((binding) =>
      (filter.principalId === undefined || binding.principalId === filter.principalId) &&
      (filter.teamId === undefined || binding.teamId === filter.teamId)
    ));
  }

  upsertRoleBinding(input: RoleBinding): RoleBinding {
    return this.upsert(this.roleBindings, input);
  }

  listServiceAccounts(): ServiceAccount[] {
    return clone(this.serviceAccounts);
  }

  getServiceAccount(idOrPrincipalId: string): ServiceAccount | undefined {
    return clone(this.serviceAccounts.find((account) => account.id === idOrPrincipalId || account.principalId === idOrPrincipalId));
  }

  upsertServiceAccount(input: ServiceAccount): ServiceAccount {
    return this.upsert(this.serviceAccounts, input);
  }

  listIdentityProviders(): IdentityProvider[] {
    return clone(this.identityProviders);
  }

  getIdentityProvider(id: string): IdentityProvider | undefined {
    return clone(this.identityProviders.find((provider) => provider.id === id));
  }

  upsertIdentityProvider(input: IdentityProvider): IdentityProvider {
    return this.upsert(this.identityProviders, input);
  }

  recordAuthAuditEvent(input: Omit<AuthAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): AuthAuditEvent {
    const event = {
      ...input,
      metadata: sanitizeMetadata(input.metadata),
      id: input.id ?? createAuthId("authaudit"),
      createdAt: input.createdAt ?? new Date()
    };
    this.auditEvents.push(clone(event));
    return clone(event);
  }

  listAuthAuditEvents(filter: { actorId?: string; principalId?: string; eventType?: string; action?: string } = {}): AuthAuditEvent[] {
    return clone(this.auditEvents
      .filter((event) =>
        (filter.actorId === undefined || event.actorId === filter.actorId) &&
        (filter.principalId === undefined || event.principalId === filter.principalId) &&
        (filter.eventType === undefined || event.eventType === filter.eventType) &&
        (filter.action === undefined || event.action === filter.action))
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || left.id.localeCompare(right.id)));
  }

  private upsert<T extends { id: string }>(items: T[], input: T): T {
    const index = items.findIndex((item) => item.id === input.id);
    if (index >= 0) {
      items[index] = clone(input);
      return clone(items[index]);
    }
    items.push(clone(input));
    return clone(input);
  }
}

export function sanitizeMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  const clone = structuredClone(input);
  for (const [key, value] of Object.entries(clone)) {
    if (/token|secret|password|cookie|credential|session|apiKey|api_key/i.test(key)) {
      clone[key] = "[redacted]";
    } else if (typeof value === "string") {
      clone[key] = value
        .replaceAll(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]")
        .replaceAll(/sk-[A-Za-z0-9_-]{6,}/g, "[redacted]")
        .replaceAll(/~\/\.codex\/auth\.json|~\/\.claude[^\s"']*/gi, "[redacted-credential-cache]");
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      clone[key] = sanitizeMetadata(value as Record<string, unknown>);
    }
  }
  return clone;
}
