import type {
  Actor,
  AuthAuditEvent,
  AuthContext,
  AuthorizationDecision,
  IdentityProvider,
  Permission,
  Principal,
  Role,
  RoleBinding,
  ServiceAccount,
  Team
} from "./types.ts";

function sanitize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = /token|secret|password|cookie|credential|session|apiKey|api_key/i.test(key) ? "[redacted]" : sanitize(child);
    }
    return output;
  }
  return value;
}

export function principalToDto(principal: Principal) {
  return sanitize(principal);
}

export function actorToDto(actor: Actor) {
  return sanitize(actor);
}

export function teamToDto(team: Team) {
  return sanitize(team);
}

export function roleToDto(role: Role) {
  return sanitize(role);
}

export function permissionToDto(permission: Permission) {
  return sanitize(permission);
}

export function roleBindingToDto(binding: RoleBinding) {
  return sanitize(binding);
}

export function serviceAccountToDto(serviceAccount: ServiceAccount) {
  return sanitize(serviceAccount);
}

export function identityProviderToDto(provider: IdentityProvider) {
  return sanitize(provider);
}

export function authContextToDto(context: AuthContext) {
  return sanitize({
    requestId: context.requestId,
    actor: context.actor,
    principal: context.principal,
    teams: context.teams,
    roles: context.roles,
    permissions: context.permissions,
    authMode: context.authMode,
    authenticated: context.authenticated,
    source: context.source,
    createdAt: context.createdAt,
    metadata: context.metadata,
    productionAuthEnabled: false,
    mockAuthWarning: context.authMode === "mock" || context.authMode === "mock_service_account" ? "Mock auth is not production authentication." : undefined
  });
}

export function authAuditEventToDto(event: AuthAuditEvent) {
  return sanitize(event);
}

export function authorizationDecisionToDto(decision: AuthorizationDecision) {
  return sanitize({
    allowed: decision.allowed,
    reason: decision.reason,
    action: decision.action,
    resourceKind: decision.resourceKind,
    resourceId: decision.resourceId,
    actorId: decision.actorId,
    principalId: decision.principalId,
    requiredPermission: decision.requiredPermission,
    policyDecisionId: decision.policyDecision?.id,
    policyDecision: decision.policyDecision ? {
      allowed: decision.policyDecision.allowed,
      decision: decision.policyDecision.decision,
      reason: decision.policyDecision.reason,
      matchedRuleIds: decision.policyDecision.matchedRuleIds
    } : undefined,
    auditEventId: decision.auditEvent?.id
  });
}
