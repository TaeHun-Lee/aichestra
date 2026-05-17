import type {
  Actor,
  AuthContext,
  AuthProvider,
  AuthProviderKind,
  AuthProviderResolveRequest,
  IdentityMappingPlan,
  Permission,
  ProductionAuthProviderConfig,
  ProductionAuthProviderKind,
  ProductionAuthProviderReadiness,
  ProductionAuthProviderSkeletonSummary,
  ProductionAuthProviderStatus,
  Role,
  SessionTokenBoundaryPlan
} from "./types.ts";
import { MockAuthProvider } from "./providers.ts";
import type { AuthRepository } from "./repository.ts";

type ProviderDefinition = {
  providerKind: ProductionAuthProviderKind;
  displayName: string;
  requiredConfig: string[];
  protocolFamily: "mock" | "oidc" | "saml" | "scim" | "custom";
};

const providerDefinitions: ProviderDefinition[] = [
  { providerKind: "mock", displayName: "MockAuthProvider", requiredConfig: [], protocolFamily: "mock" },
  {
    providerKind: "oidc_future",
    displayName: "Disabled OIDC provider",
    requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE", "AICHESTRA_AUTH_OIDC_JWKS_URI"],
    protocolFamily: "oidc"
  },
  {
    providerKind: "saml_future",
    displayName: "Disabled SAML provider",
    requiredConfig: ["AICHESTRA_AUTH_SAML_METADATA_URL"],
    protocolFamily: "saml"
  },
  {
    providerKind: "scim_future",
    displayName: "Disabled SCIM directory provider",
    requiredConfig: ["AICHESTRA_AUTH_SCIM_ENDPOINT"],
    protocolFamily: "scim"
  },
  {
    providerKind: "microsoft_entra_future",
    displayName: "Disabled Microsoft Entra provider",
    requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE", "AICHESTRA_AUTH_OIDC_JWKS_URI", "AICHESTRA_AUTH_SCIM_ENDPOINT"],
    protocolFamily: "oidc"
  },
  {
    providerKind: "okta_future",
    displayName: "Disabled Okta provider",
    requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE", "AICHESTRA_AUTH_OIDC_JWKS_URI", "AICHESTRA_AUTH_SCIM_ENDPOINT"],
    protocolFamily: "oidc"
  },
  {
    providerKind: "auth0_future",
    displayName: "Disabled Auth0 provider",
    requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE", "AICHESTRA_AUTH_OIDC_JWKS_URI"],
    protocolFamily: "oidc"
  },
  {
    providerKind: "google_workspace_future",
    displayName: "Disabled Google Workspace provider",
    requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE", "AICHESTRA_AUTH_OIDC_JWKS_URI", "AICHESTRA_AUTH_SCIM_ENDPOINT"],
    protocolFamily: "oidc"
  },
  {
    providerKind: "github_enterprise_future",
    displayName: "Disabled GitHub Enterprise identity provider",
    requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE"],
    protocolFamily: "oidc"
  },
  {
    providerKind: "custom_future",
    displayName: "Disabled custom production auth provider",
    requiredConfig: [],
    protocolFamily: "custom"
  }
];

const providerByKind = new Map(providerDefinitions.map((definition) => [definition.providerKind, definition]));

export type ProductionAuthProviderRegistryInput = {
  env?: Record<string, string | undefined>;
  repository?: AuthRepository;
};

export class DisabledProductionAuthProvider implements AuthProvider {
  protected readonly definition: ProviderDefinition;

  constructor(providerKind: Exclude<ProductionAuthProviderKind, "mock">) {
    const definition = providerByKind.get(providerKind);
    if (!definition || definition.providerKind === "mock") {
      throw new Error(`invalid_disabled_production_auth_provider:${providerKind}`);
    }
    this.definition = definition;
  }

  getProviderKind(): AuthProviderKind {
    return this.definition.providerKind;
  }

  getProductionProviderKind(): ProductionAuthProviderKind {
    return this.definition.providerKind;
  }

  getStatus(): ProductionAuthProviderStatus {
    return "disabled";
  }

  resolveAuthContext(_request?: AuthProviderResolveRequest): AuthContext {
    throw new Error(`${this.definition.providerKind} production auth provider is disabled and not implemented.`);
  }

  validateActor(_actor: Actor) {
    return { ok: false, reason: `${this.definition.providerKind}_disabled_not_implemented` };
  }

  validateConfig(env: Record<string, string | undefined> = {}): ProductionAuthProviderReadiness {
    const missingConfig = missingRequiredConfig(this.definition, env);
    return {
      id: `readiness_${this.definition.providerKind}`,
      providerKind: this.definition.providerKind,
      status: missingConfig.length > 0 ? "missing_config" : "blocked",
      requiredConfig: [...this.definition.requiredConfig],
      missingConfig,
      warnings: [
        "provider_disabled_by_default",
        "token_validation_enabled:false",
        "external_calls_enabled:false"
      ],
      blockers: ["provider_not_implemented", "production_auth_enabled:false"],
      metadata: {
        providerSkeleton: "v1",
        protocolFamily: this.definition.protocolFamily,
        rawConfigValuesReturned: false,
        noTokensAccepted: true,
        noSessionIssued: true,
        noExternalIdentityProviderCalls: true
      }
    };
  }

  listRequiredConfig(): string[] {
    return [...this.definition.requiredConfig];
  }

  listRoles(): Role[] {
    return [];
  }

  listPermissions(): Permission[] {
    return [];
  }

  close(): void {
    return;
  }
}

export class DisabledOidcAuthProvider extends DisabledProductionAuthProvider {
  constructor() {
    super("oidc_future");
  }
}

export class DisabledSamlAuthProvider extends DisabledProductionAuthProvider {
  constructor() {
    super("saml_future");
  }
}

export class DisabledScimDirectoryProvider extends DisabledProductionAuthProvider {
  constructor() {
    super("scim_future");
  }
}

export class DisabledMicrosoftEntraAuthProvider extends DisabledProductionAuthProvider {
  constructor() {
    super("microsoft_entra_future");
  }
}

export class DisabledOktaAuthProvider extends DisabledProductionAuthProvider {
  constructor() {
    super("okta_future");
  }
}

export class DisabledAuth0Provider extends DisabledProductionAuthProvider {
  constructor() {
    super("auth0_future");
  }
}

export class DisabledGoogleWorkspaceAuthProvider extends DisabledProductionAuthProvider {
  constructor() {
    super("google_workspace_future");
  }
}

export class DisabledGithubEnterpriseAuthProvider extends DisabledProductionAuthProvider {
  constructor() {
    super("github_enterprise_future");
  }
}

export class DisabledCustomAuthProvider extends DisabledProductionAuthProvider {
  constructor() {
    super("custom_future");
  }
}

export class ProductionAuthProviderRegistry {
  private readonly env: Record<string, string | undefined>;
  private readonly repository?: AuthRepository;

  constructor(input: ProductionAuthProviderRegistryInput = {}) {
    this.env = input.env ?? {};
    this.repository = input.repository;
  }

  getSelectedProviderKind(): ProductionAuthProviderKind {
    return normalizeProductionAuthProviderKind(this.env.AICHESTRA_AUTH_PROVIDER);
  }

  createRuntimeProvider(): AuthProvider {
    return new MockAuthProvider({ repository: this.repository });
  }

  createDisabledProvider(providerKind: Exclude<ProductionAuthProviderKind, "mock">): DisabledProductionAuthProvider {
    return createDisabledProductionAuthProvider(providerKind);
  }

  getSelectedProviderConfig(): ProductionAuthProviderConfig {
    return this.buildProviderConfig(providerByKind.get(this.getSelectedProviderKind()) ?? providerDefinitions[0]);
  }

  listProviderConfigs(): ProductionAuthProviderConfig[] {
    return providerDefinitions.map((definition) => this.buildProviderConfig(definition));
  }

  listProviderReadiness(): ProductionAuthProviderReadiness[] {
    const selected = this.getSelectedProviderKind();
    return providerDefinitions.map((definition) => this.buildReadiness(definition, selected));
  }

  listSessionTokenBoundaryPlans(): SessionTokenBoundaryPlan[] {
    return [
      sessionBoundaryPlan("cookie_session_future", "HttpOnly server session with CSRF protection, tenant scope binding, and server-side revocation metadata."),
      sessionBoundaryPlan("bearer_jwt_future", "JWT validation boundary only; signing, issuance, and trust configuration remain future work."),
      sessionBoundaryPlan("api_key_future", "API key metadata boundary for future service-to-service access; no key material is issued."),
      sessionBoundaryPlan("service_account_token_future", "Service-account credential lifecycle boundary; no JWTs, client secrets, or installation tokens are minted."),
      sessionBoundaryPlan("local_agent_pairing_future", "Local Agent pairing token boundary; pairing remains consent metadata only.")
    ];
  }

  listIdentityMappingPlans(): IdentityMappingPlan[] {
    return [
      identityMappingPlan("subject_to_principal", ["sub", "iss"], "Principal", ["claim_stability_required", "duplicate_subject_collision"]),
      identityMappingPlan("group_to_team", ["groups"], "Team", ["group_overbreadth", "deprovisioning_delay"]),
      identityMappingPlan("role_claim_to_role", ["roles"], "RoleBinding", ["claim_spoofing_if_unvalidated", "role_drift"]),
      identityMappingPlan("tenant_claim_to_tenant_scope", ["tenant", "org"], "TenantScope", ["cross_tenant_claim_confusion"]),
      identityMappingPlan("repo_claim_to_repo_scope", ["repo", "repository"], "RepoScope", ["repo_rename_drift"]),
      identityMappingPlan("service_account_mapping", ["client_id", "service_account_id"], "ServiceAccount", ["credential_lifecycle_required"])
    ];
  }

  getSummary(): ProductionAuthProviderSkeletonSummary {
    const selected = this.getSelectedProviderKind();
    const readiness = this.listProviderReadiness();
    const selectedReadiness = readiness.find((item) => item.providerKind === selected);
    const selectedConfig = this.getSelectedProviderConfig();
    const blockers = selectedReadiness?.blockers ?? [];
    const missingConfig = selectedReadiness?.missingConfig ?? [];
    return {
      id: "production_auth_provider_skeleton_v1",
      status: "v1_implemented",
      activeProviderKind: "mock",
      selectedProviderKind: selected,
      selectedProviderStatus: selectedConfig.status,
      productionAuthEnabled: false,
      requireAuthForApi: false,
      futureProviderSelected: selected !== "mock",
      futureProviderBlocked: selected !== "mock",
      tokenValidationEnabled: false,
      sessionBoundaryEnabled: false,
      sessionBoundaryStatus: selected === "mock" ? "disabled" : "future",
      identityMappingStatus: selected === "mock" ? "not_configured" : "future",
      externalCallsEnabled: false,
      missingConfigCount: missingConfig.length,
      blockerCount: blockers.length,
      providerOptionCount: providerDefinitions.length,
      readinessCheckCount: readiness.length,
      sessionBoundaryPlanCount: this.listSessionTokenBoundaryPlans().length,
      identityMappingPlanCount: this.listIdentityMappingPlans().length,
      noTokensExposed: true,
      authorizationHeadersStored: false,
      cookiesStored: false,
      sessionIdsExposed: false,
      envValuesExposed: false,
      secretsExposed: false,
      productionReady: false,
      metadata: {
        docs: "docs/foundations/auth-rbac/production-auth-provider-skeleton-v1.md",
        planDocs: "docs/foundations/auth-rbac/production-auth-provider-skeleton-v1-plan.md",
        mockProviderDefault: true,
        enableProductionAuthRequested: flag(this.env.AICHESTRA_ENABLE_PRODUCTION_AUTH),
        requireAuthForApiRequested: flag(this.env.AICHESTRA_REQUIRE_AUTH_FOR_API),
        productionAuthProviderSkeleton: "v1",
        futureProviderSelectionIsBlocked: selected !== "mock",
        rawEnvValuesReturned: false,
        rawHeadersStored: false,
        cookiesStored: false,
        sessionsIssued: false,
        jwtIssued: false,
        apiKeysIssued: false,
        serviceAccountCredentialsIssued: false,
        externalIdentityProviderCallsEnabled: false
      }
    };
  }

  private buildProviderConfig(definition: ProviderDefinition): ProductionAuthProviderConfig {
    const selected = this.getSelectedProviderKind() === definition.providerKind;
    const missingConfig = missingRequiredConfig(definition, this.env);
    const status: ProductionAuthProviderStatus = definition.providerKind === "mock"
      ? "active_mock"
      : selected && missingConfig.length > 0
        ? "not_configured"
        : selected
          ? "disabled"
          : "future";
    return {
      id: `production_auth_provider_${definition.providerKind}`,
      providerKind: definition.providerKind,
      status,
      displayName: definition.displayName,
      issuerConfigured: configured(this.env.AICHESTRA_AUTH_OIDC_ISSUER),
      audienceConfigured: configured(this.env.AICHESTRA_AUTH_OIDC_AUDIENCE),
      jwksConfigured: configured(this.env.AICHESTRA_AUTH_OIDC_JWKS_URI),
      metadataUrlConfigured: configured(this.env.AICHESTRA_AUTH_SAML_METADATA_URL),
      scimEndpointConfigured: configured(this.env.AICHESTRA_AUTH_SCIM_ENDPOINT),
      groupMappingConfigured: configured(this.env.AICHESTRA_AUTH_GROUP_MAPPING),
      tenantMappingConfigured: configured(this.env.AICHESTRA_AUTH_TENANT_MAPPING),
      sessionBoundaryConfigured: false,
      tokenValidationEnabled: false,
      externalCallsEnabled: false,
      productionReady: false,
      metadata: {
        protocolFamily: definition.protocolFamily,
        selected,
        requiredConfig: [...definition.requiredConfig],
        missingConfig,
        providerImplemented: definition.providerKind === "mock",
        futureProviderImplemented: false,
        rawEnvValuesReturned: false,
        noTokenValidation: true,
        noSessionIssuance: true,
        noExternalCalls: true
      }
    };
  }

  private buildReadiness(definition: ProviderDefinition, selected: ProductionAuthProviderKind): ProductionAuthProviderReadiness {
    const missingConfig = missingRequiredConfig(definition, this.env);
    if (definition.providerKind === "mock") {
      return {
        id: "readiness_mock_auth_provider",
        providerKind: "mock",
        status: "ready_mock",
        requiredConfig: [],
        missingConfig: [],
        warnings: ["mock_provider_is_not_production_authentication"],
        blockers: ["production_auth_provider_not_implemented"],
        metadata: {
          activeRuntimeProvider: true,
          productionReady: false,
          rawEnvValuesReturned: false
        }
      };
    }
    const selectedFuture = selected === definition.providerKind;
    return {
      id: `readiness_${definition.providerKind}`,
      providerKind: definition.providerKind,
      status: selectedFuture && missingConfig.length > 0 ? "missing_config" : selectedFuture ? "blocked" : "future",
      requiredConfig: [...definition.requiredConfig],
      missingConfig: selectedFuture ? missingConfig : [],
      warnings: [
        "future_provider_disabled",
        "token_validation_enabled:false",
        "external_calls_enabled:false"
      ],
      blockers: selectedFuture ? ["provider_not_implemented", "production_auth_enabled:false"] : [],
      metadata: {
        selected: selectedFuture,
        protocolFamily: definition.protocolFamily,
        futureProviderImplemented: false,
        rawEnvValuesReturned: false,
        noTokenValidation: true,
        noSessionIssuance: true,
        noExternalCalls: true
      }
    };
  }
}

export function createProductionAuthProviderRegistryFromEnv(env: Record<string, string | undefined>): ProductionAuthProviderRegistry {
  return new ProductionAuthProviderRegistry({ env });
}

export function createDisabledProductionAuthProvider(providerKind: Exclude<ProductionAuthProviderKind, "mock">): DisabledProductionAuthProvider {
  switch (providerKind) {
    case "oidc_future":
      return new DisabledOidcAuthProvider();
    case "saml_future":
      return new DisabledSamlAuthProvider();
    case "scim_future":
      return new DisabledScimDirectoryProvider();
    case "microsoft_entra_future":
      return new DisabledMicrosoftEntraAuthProvider();
    case "okta_future":
      return new DisabledOktaAuthProvider();
    case "auth0_future":
      return new DisabledAuth0Provider();
    case "google_workspace_future":
      return new DisabledGoogleWorkspaceAuthProvider();
    case "github_enterprise_future":
      return new DisabledGithubEnterpriseAuthProvider();
    case "custom_future":
      return new DisabledCustomAuthProvider();
  }
}

export function normalizeProductionAuthProviderKind(value: string | undefined): ProductionAuthProviderKind {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "mock") return "mock";
  if (normalized === "oidc" || normalized === "oidc_future" || normalized === "future_oidc") return "oidc_future";
  if (normalized === "saml" || normalized === "saml_future" || normalized === "future_saml") return "saml_future";
  if (normalized === "scim" || normalized === "scim_future") return "scim_future";
  if (normalized === "microsoft_entra" || normalized === "microsoft_entra_future" || normalized === "microsoft_future" || normalized === "entra") return "microsoft_entra_future";
  if (normalized === "okta" || normalized === "okta_future") return "okta_future";
  if (normalized === "auth0" || normalized === "auth0_future") return "auth0_future";
  if (normalized === "google_workspace" || normalized === "google_workspace_future" || normalized === "google_future") return "google_workspace_future";
  if (normalized === "github_enterprise" || normalized === "github_enterprise_future" || normalized === "github_future") return "github_enterprise_future";
  if (normalized === "custom" || normalized === "custom_future") return "custom_future";
  return "mock";
}

function missingRequiredConfig(definition: ProviderDefinition, env: Record<string, string | undefined>): string[] {
  return definition.requiredConfig.filter((key) => !configured(env[key]));
}

function configured(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function flag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function sessionBoundaryPlan(boundaryKind: SessionTokenBoundaryPlan["boundaryKind"], storageStrategy: string): SessionTokenBoundaryPlan {
  return {
    id: `session_token_boundary_${boundaryKind}`,
    boundaryKind,
    status: "future",
    tokenIssued: false,
    validationEnabled: false,
    storageStrategy,
    rotationStrategy: "future_rotation_design_required_before_any_token_material_exists",
    revocationStrategy: "future_revocation_design_required_before_any_session_or_token_is_issued",
    auditRequirements: [
      "auth_token_validation_attempt_future",
      "auth_session_created_future",
      "auth_session_revoked_future"
    ],
    metadata: {
      noTokenMaterialStored: true,
      noSessionCookieStored: true,
      noCredentialIssued: true,
      productionReady: false
    }
  };
}

function identityMappingPlan(mappingKind: IdentityMappingPlan["mappingKind"], requiredClaims: string[], targetModel: string, risks: string[]): IdentityMappingPlan {
  return {
    id: `identity_mapping_${mappingKind}`,
    mappingKind,
    status: "future",
    requiredClaims,
    targetModel,
    risks,
    metadata: {
      externalClaimsParsed: false,
      tokenValidationRequiredFirst: true,
      productionReady: false
    }
  };
}
