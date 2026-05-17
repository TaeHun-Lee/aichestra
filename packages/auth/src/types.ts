import type { PolicyAction, PolicyDecision, PolicyResourceKind, PolicyResourceScope, PolicySubject } from "@aichestra/policy";

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
  | "microsoft_entra_future"
  | "okta_future"
  | "auth0_future"
  | "google_workspace_future"
  | "github_enterprise_future"
  | "custom_future";
export type IdentityProviderStatus = "active" | "disabled";
export type AuthMode = "mock" | "mock_service_account" | "future_oidc" | "future_saml" | "future_service_account" | "system";
export type ProductionAuthProviderKind =
  | "mock"
  | "oidc_future"
  | "saml_future"
  | "scim_future"
  | "microsoft_entra_future"
  | "okta_future"
  | "auth0_future"
  | "google_workspace_future"
  | "github_enterprise_future"
  | "custom_future";
export type AuthProviderKind = AuthMode | Exclude<ProductionAuthProviderKind, "mock">;
export type ProductionAuthProviderStatus = "active_mock" | "disabled" | "not_configured" | "future";
export type ProductionAuthProviderReadinessStatus = "ready_mock" | "disabled" | "missing_config" | "blocked" | "future";
export type OidcProviderStatus = "disabled" | "not_configured" | "future" | "blocked";
export type OidcTokenBoundaryStatus = "disabled" | "future" | "not_configured";
export type OidcClaimsMappingStatus = "planned" | "not_configured" | "future";
export type OidcValidationResultStatus = "disabled" | "future" | "not_configured" | "blocked";
export type SessionTokenBoundaryKind =
  | "cookie_session_future"
  | "bearer_jwt_future"
  | "api_key_future"
  | "service_account_token_future"
  | "local_agent_pairing_future";
export type SessionTokenBoundaryStatus = "planned" | "disabled" | "future";
export type IdentityMappingKind =
  | "subject_to_principal"
  | "group_to_team"
  | "role_claim_to_role"
  | "tenant_claim_to_tenant_scope"
  | "repo_claim_to_repo_scope"
  | "service_account_mapping";
export type IdentityMappingStatus = "planned" | "future" | "not_configured";
export type RequestSource = "api" | "worker" | "dashboard" | "readiness" | "test" | "system" | "webhook" | "local_agent";
export type AuthAuditResult = "allowed" | "denied" | "resolved" | "missing" | "blocked" | "disabled";
export type ScopeModelStatus = "active_mock" | "disabled" | "future";
export type TenantKind = "organization" | "workspace" | "enterprise" | "personal" | "unknown";
export type RepoScopeProvider = "mock" | "local" | "github" | "gitlab_future" | "bitbucket_future";
export type RegistryPackageScopeKind = "skill" | "harness" | "instruction" | "bundle" | "unknown";
export type ScopeRiskLevel = "low" | "medium" | "high" | "critical";

export type TenantScope = {
  tenantId: string;
  tenantKind: TenantKind;
  displayName?: string;
  status: ScopeModelStatus;
  metadata: Record<string, unknown>;
};

export type TeamScope = {
  tenantId: string;
  teamId: string;
  displayName?: string;
  status: ScopeModelStatus;
  metadata: Record<string, unknown>;
};

export type ProjectScope = {
  tenantId: string;
  teamId?: string;
  projectId: string;
  displayName?: string;
  status: ScopeModelStatus;
  metadata: Record<string, unknown>;
};

export type RepoScope = {
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  repoId: string;
  repoProvider: RepoScopeProvider;
  repoOwner?: string;
  repoName?: string;
  allowedBranchPrefix?: string;
  metadata: Record<string, unknown>;
};

export type ProviderScope = {
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  providerId: string;
  providerKind: string;
  billingMode?: string;
  allowedModelIds?: string[];
  metadata: Record<string, unknown>;
};

export type ModelScope = {
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  providerId: string;
  modelId: string;
  modelKind?: string;
  capabilities?: string[];
  metadata: Record<string, unknown>;
};

export type SecretScopeBinding = {
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  secretRefId: string;
  secretKind: string;
  provider: string;
  allowedPurposes: string[];
  metadata: Record<string, unknown>;
};

export type MCPToolScope = {
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  mcpServerId: string;
  mcpToolId: string;
  riskLevel: ScopeRiskLevel;
  allowedResourceScopes: string[];
  metadata: Record<string, unknown>;
};

export type RegistryPackageScope = {
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  packageId: string;
  packageKind: RegistryPackageScopeKind;
  metadata: Record<string, unknown>;
};

export type LocalAgentHostScope = {
  tenantId?: string;
  teamId?: string;
  userId?: string;
  hostId: string;
  agentId?: string;
  metadata: Record<string, unknown>;
};

export type AuditQueryScope = {
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  actorId?: string;
  resourceKinds?: string[];
  metadata: Record<string, unknown>;
};

export type ScopeCatalog = {
  tenants: TenantScope[];
  teams: TeamScope[];
  projects: ProjectScope[];
  repos: RepoScope[];
  providers: ProviderScope[];
  models: ModelScope[];
  secrets: SecretScopeBinding[];
  mcpTools: MCPToolScope[];
  registryPackages: RegistryPackageScope[];
  localAgentHosts: LocalAgentHostScope[];
  auditQueries: AuditQueryScope[];
};

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

export type ProductionAuthProviderConfig = {
  id: string;
  providerKind: ProductionAuthProviderKind;
  status: ProductionAuthProviderStatus;
  displayName: string;
  issuerConfigured: boolean;
  audienceConfigured: boolean;
  jwksConfigured: boolean;
  metadataUrlConfigured: boolean;
  scimEndpointConfigured: boolean;
  groupMappingConfigured: boolean;
  tenantMappingConfigured: boolean;
  sessionBoundaryConfigured: boolean;
  tokenValidationEnabled: false;
  externalCallsEnabled: false;
  productionReady: false;
  metadata: Record<string, unknown>;
};

export type OidcProviderConfig = {
  id: string;
  providerKind: "oidc_future";
  status: OidcProviderStatus;
  issuerConfigured: boolean;
  audienceConfigured: boolean;
  clientIdConfigured: boolean;
  clientSecretConfigured: false;
  jwksUriConfigured: boolean;
  discoveryUrlConfigured: boolean;
  scopesConfigured: boolean;
  claimsMappingConfigured: boolean;
  tenantMappingConfigured: boolean;
  groupMappingConfigured: boolean;
  tokenValidationEnabled: false;
  externalCallsEnabled: false;
  productionReady: false;
  metadata: Record<string, unknown>;
};

export type OidcDiscoveryReadiness = {
  id: string;
  issuerMetadataConfigured: boolean;
  authorizationEndpointConfigured: boolean;
  tokenEndpointConfigured: boolean;
  jwksUriConfigured: boolean;
  userInfoEndpointConfigured: boolean;
  discoveryFetchEnabled: false;
  discoveryFetched: false;
  metadata: Record<string, unknown>;
};

export type OidcJwksReadiness = {
  id: string;
  jwksUriConfigured: boolean;
  jwksFetchEnabled: false;
  jwksFetched: false;
  keyRotationPlanStatus: "planned" | "future" | "not_configured";
  metadata: Record<string, unknown>;
};

export type OidcTokenValidationBoundary = {
  id: string;
  status: OidcTokenBoundaryStatus;
  idTokenValidationEnabled: false;
  accessTokenValidationEnabled: false;
  signatureValidationEnabled: false;
  issuerValidationEnabled: false;
  audienceValidationEnabled: false;
  expiryValidationEnabled: false;
  nonceValidationEnabled: false;
  metadata: Record<string, unknown>;
};

export type OidcClaimsMappingPlan = {
  id: string;
  subjectClaim: string;
  emailClaim: string;
  displayNameClaim: string;
  groupsClaim: string;
  rolesClaim: string;
  tenantClaim: string;
  teamClaim: string;
  projectClaim: string;
  repoScopeClaim: string;
  providerScopeClaim: string;
  serviceAccountClaim: string;
  mappingStatus: OidcClaimsMappingStatus;
  risks: string[];
  metadata: Record<string, unknown>;
};

export type OidcTokenValidationResult = {
  ok: false;
  status: OidcValidationResultStatus;
  reason: string;
  tokenValidationEnabled: false;
  tokenStored: false;
  tokenEchoed: false;
  sessionIssued: false;
  jwtIssued: false;
  externalCallsEnabled: false;
  metadata: Record<string, unknown>;
};

export type OidcProviderSkeletonSummary = {
  id: string;
  status: "v1_implemented";
  providerKind: "oidc_future";
  selected: boolean;
  providerStatus: OidcProviderStatus;
  productionAuthEnabled: false;
  tokenValidationEnabled: false;
  externalCallsEnabled: false;
  discoveryFetchEnabled: false;
  jwksFetchEnabled: false;
  claimsMappingStatus: OidcClaimsMappingStatus;
  tenantMappingStatus: OidcClaimsMappingStatus;
  noTokensStored: true;
  noSessionsIssued: true;
  noCookiesStored: true;
  noSecretsExposed: true;
  productionReady: false;
  blockerCount: number;
  metadata: Record<string, unknown>;
};

export type OidcVerifierReadiness = {
  config: OidcProviderConfig;
  discovery: OidcDiscoveryReadiness;
  jwks: OidcJwksReadiness;
  tokenBoundary: OidcTokenValidationBoundary;
  claimsMapping: OidcClaimsMappingPlan;
  summary: OidcProviderSkeletonSummary;
};

export type OidcTokenVerifier = {
  getProviderKind(): "oidc_future";
  getStatus(): OidcProviderStatus;
  validateIdToken(input: Record<string, unknown>): OidcTokenValidationResult;
  validateAccessToken(input: Record<string, unknown>): OidcTokenValidationResult;
  getReadiness(): OidcVerifierReadiness;
  listRequiredConfig(): string[];
};

export type ProductionAuthProviderReadiness = {
  id: string;
  providerKind: ProductionAuthProviderKind;
  status: ProductionAuthProviderReadinessStatus;
  requiredConfig: string[];
  missingConfig: string[];
  warnings: string[];
  blockers: string[];
  metadata: Record<string, unknown>;
};

export type SessionTokenBoundaryPlan = {
  id: string;
  boundaryKind: SessionTokenBoundaryKind;
  status: SessionTokenBoundaryStatus;
  tokenIssued: false;
  validationEnabled: false;
  storageStrategy: string;
  rotationStrategy: string;
  revocationStrategy: string;
  auditRequirements: string[];
  metadata: Record<string, unknown>;
};

export type IdentityMappingPlan = {
  id: string;
  mappingKind: IdentityMappingKind;
  status: IdentityMappingStatus;
  requiredClaims: string[];
  targetModel: string;
  risks: string[];
  metadata: Record<string, unknown>;
};

export type ProductionAuthProviderSkeletonSummary = {
  id: string;
  status: "v1_implemented";
  activeProviderKind: "mock";
  selectedProviderKind: ProductionAuthProviderKind;
  selectedProviderStatus: ProductionAuthProviderStatus;
  productionAuthEnabled: false;
  requireAuthForApi: false;
  futureProviderSelected: boolean;
  futureProviderBlocked: boolean;
  tokenValidationEnabled: false;
  sessionBoundaryEnabled: false;
  sessionBoundaryStatus: "disabled" | "future";
  identityMappingStatus: "not_configured" | "future";
  externalCallsEnabled: false;
  missingConfigCount: number;
  blockerCount: number;
  providerOptionCount: number;
  readinessCheckCount: number;
  sessionBoundaryPlanCount: number;
  identityMappingPlanCount: number;
  noTokensExposed: true;
  authorizationHeadersStored: false;
  cookiesStored: false;
  sessionIdsExposed: false;
  envValuesExposed: false;
  secretsExposed: false;
  productionReady: false;
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
  tenantScopes?: TenantScope[];
  teamScopes?: TeamScope[];
  projectScopes?: ProjectScope[];
  resourceScopes?: PolicyResourceScope[];
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
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  resourceScopes?: PolicyResourceScope[];
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type CorrelationContext = {
  requestId: string;
  correlationId: string;
  traceId?: string;
  taskId?: string;
  taskRunId?: string;
  actorId?: string;
  source: RequestSource;
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
    | "future_provider_disabled"
    | "production_auth_provider_config_checked"
    | "production_auth_provider_blocked"
    | "mock_auth_provider_used";
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  action?: string;
  resourceKind?: string;
  resourceId?: string;
  result: AuthAuditResult;
  reason?: string;
  requestId?: string;
  correlationId?: string;
  source?: RequestSource;
  policyDecisionId?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type AuthProviderResolveRequest = {
  requestId?: string;
  actorId?: string;
  correlationId?: string;
  source?: RequestSource;
  tenantScopes?: TenantScope[];
  teamScopes?: TeamScope[];
  projectScopes?: ProjectScope[];
  resourceScopes?: PolicyResourceScope[];
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
