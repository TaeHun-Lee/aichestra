import type { PolicyAction, PolicyDecision, PolicyResourceKind, PolicySubject } from "@aichestra/policy";

export type PrincipalKind = "user" | "service_account" | "system" | "local_agent" | "external_integration";
export type PrincipalStatus = "active" | "disabled" | "suspended" | "deleted";
export type ActorKind = "human_user" | "service_account" | "system" | "local_agent" | "anonymous_mock";
export type ActorStatus = "active" | "disabled";
export type TeamStatus = "active" | "disabled";
export type RoleStatus = "active" | "disabled";
export type PermissionRiskLevel = "low" | "medium" | "high" | "critical";
export type ResourceScopeKind = "global" | "org" | "team" | "repo" | "project" | "task" | "registry" | "provider" | "local_agent";
export type RoleBindingStatus = "active" | "disabled";
export type ServiceAccountStatus = "active" | "disabled" | "revoked";
export type IdentityProviderKind =
  | "mock"
  | "oidc_future"
  | "saml_future"
  | "scim_future"
  | "github_future"
  | "google_future"
  | "microsoft_future"
  | "custom_future";
export type IdentityProviderStatus = "active" | "disabled";
export type AuthMode = "mock" | "future_oidc" | "future_saml" | "future_service_account" | "system";
export type AuthProviderKind = AuthMode | "scim_future";
export type RequestSource = "api" | "worker" | "dashboard" | "test" | "system";
export type AuthAuditResult = "allowed" | "denied" | "resolved" | "missing" | "blocked" | "disabled";

export type Principal = {
  id: string;
  principalKind: PrincipalKind;
  displayName: string;
  email?: string;
  status: PrincipalStatus;
  identityProviderId?: string;
  externalSubject?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type Actor = {
  id: string;
  principalId: string;
  actorKind: ActorKind;
  displayName: string;
  roles: string[];
  teams: string[];
  status: ActorStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type Team = {
  id: string;
  name: string;
  displayName: string;
  status: TeamStatus;
  metadata: Record<string, unknown>;
};

export type Permission = {
  id: string;
  action: string;
  resourceKind: string;
  description: string;
  riskLevel: PermissionRiskLevel;
};

export type Role = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  status: RoleStatus;
  metadata: Record<string, unknown>;
};

export type ResourceScope = {
  id: string;
  scopeKind: ResourceScopeKind;
  scopeId?: string;
  description: string;
  metadata: Record<string, unknown>;
};

export type RoleBinding = {
  id: string;
  principalId?: string;
  teamId?: string;
  roleId: string;
  scope: ResourceScope;
  status: RoleBindingStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type ServiceAccount = {
  id: string;
  principalId: string;
  name: string;
  ownerTeamId?: string;
  allowedScopes: ResourceScope[];
  status: ServiceAccountStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type IdentityProvider = {
  id: string;
  providerKind: IdentityProviderKind;
  displayName: string;
  status: IdentityProviderStatus;
  metadata: Record<string, unknown>;
};

export type AuthContext = {
  requestId: string;
  actor: Actor;
  principal: Principal;
  teams: Team[];
  roles: Role[];
  permissions: Permission[];
  roleBindings: RoleBinding[];
  authMode: AuthMode;
  authenticated: boolean;
  source: RequestSource;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type RequestContext = {
  requestId: string;
  authContext: AuthContext;
  correlationId?: string;
  source: RequestSource;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type AuthAuditEvent = {
  id: string;
  eventType:
    | "auth_context_resolved"
    | "auth_context_missing"
    | "mock_actor_used"
    | "authorization_allowed"
    | "authorization_denied"
    | "role_binding_evaluated"
    | "service_account_used"
    | "production_auth_not_configured"
    | "future_provider_disabled";
  actorId?: string;
  principalId?: string;
  action?: string;
  resourceKind?: string;
  resourceId?: string;
  result: AuthAuditResult;
  reason?: string;
  requestId?: string;
  policyDecisionId?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type AuthProviderResolveRequest = {
  requestId?: string;
  actorId?: string;
  correlationId?: string;
  source?: RequestSource;
  metadata?: Record<string, unknown>;
};

export type AuthActorValidationResult = {
  ok: boolean;
  reason?: string;
};

export type AuthProvider = {
  getProviderKind(): AuthProviderKind;
  resolveAuthContext(request?: AuthProviderResolveRequest): AuthContext;
  validateActor(actor: Actor): AuthActorValidationResult;
  listRoles(): Role[];
  listPermissions(): Permission[];
  close?(): void;
};

export type AuthorizationResource = {
  resourceKind: string;
  resourceId?: string;
  scope?: ResourceScope;
  metadata?: Record<string, unknown>;
};

export type AuthorizationCheckRequest = {
  authContext: AuthContext;
  action: string;
  resource: AuthorizationResource;
  policyContext?: {
    taskId?: string;
    taskRunId?: string;
    repoId?: string;
    branchName?: string;
    modelId?: string;
    providerKind?: string;
    runnerKind?: string;
    command?: string;
    riskScore?: number;
    environment?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
};

export type AuthorizationDecision = {
  allowed: boolean;
  reason: string;
  action: string;
  resourceKind: string;
  resourceId?: string;
  actorId: string;
  principalId?: string;
  requiredPermission?: string;
  policyDecision?: PolicyDecision;
  auditEvent?: AuthAuditEvent;
};

export type AuthorizationServiceInterface = {
  getAuthContext(request?: AuthProviderResolveRequest): AuthContext;
  hasPermission(authContext: AuthContext, action: string, resource: AuthorizationResource): AuthorizationDecision;
  check(request: AuthorizationCheckRequest): AuthorizationDecision;
  requirePermission(authContext: AuthContext, action: string, resource: AuthorizationResource): AuthorizationDecision;
  toPolicySubject(authContext: AuthContext): PolicySubject;
  recordAuthorizationAudit(event: Omit<AuthAuditEvent, "id" | "createdAt"> & { id?: string; createdAt?: Date }): AuthAuditEvent;
};

export type PolicyMappableAuthorization = {
  action: PolicyAction;
  resourceKind: PolicyResourceKind;
};
