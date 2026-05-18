import type {
  DashboardPanelScopeSummary,
  TenantScopePlanningRedactionClass,
  TenantScopePlanningRole,
  TenantScopePlanningScopeDimension
} from "./dashboard-tenant-scope.ts";

export type DashboardScopeFilterAuthMode = "mock_actor" | "demo_request_header" | "service_account_mock";

export type DashboardScopeFilterSource = "demo" | "api" | "mock_actor" | "test_fixture";

export type DashboardScopeFilterContext = {
  actorId: string;
  principalId?: string;
  roles: TenantScopePlanningRole[];
  tenantIds: string[];
  teamIds: string[];
  projectIds: string[];
  resourceScopes: string[];
  source: DashboardScopeFilterSource;
  authMode: DashboardScopeFilterAuthMode;
  metadata: Record<string, unknown>;
};

export type DashboardScopeFilterContextInput = {
  actorId?: string;
  principalId?: string;
  roles?: string[];
  tenantIds?: string[];
  teamIds?: string[];
  projectIds?: string[];
  resourceScopes?: string[];
  source?: DashboardScopeFilterSource;
  authMode?: DashboardScopeFilterAuthMode;
  metadata?: Record<string, unknown>;
};

export type DashboardScopeFilterDecisionKind =
  | "visible"
  | "redacted"
  | "hidden"
  | "warning_only"
  | "not_applicable";

export type DashboardPanelFilterDecision = {
  panelId: string;
  panelName: string;
  decision: DashboardScopeFilterDecisionKind;
  reason: string;
  requiredRoles: TenantScopePlanningRole[];
  matchedRoles: TenantScopePlanningRole[];
  requiredScopes: TenantScopePlanningScopeDimension[];
  missingScopes: TenantScopePlanningScopeDimension[];
  sensitivity: TenantScopePlanningRedactionClass;
  redactedFields: string[];
  redactionClass: TenantScopePlanningRedactionClass;
  productionFiltering: false;
  metadata: Record<string, unknown>;
};

export type DashboardScopeFilterSummary = {
  status: "v1_implemented_partial";
  totalPanels: number;
  visiblePanels: number;
  redactedPanels: number;
  hiddenPanels: number;
  warningPanels: number;
  notApplicablePanels: number;
  secretAdjacentPanels: number;
  roleApplied: TenantScopePlanningRole;
  rolesApplied: TenantScopePlanningRole[];
  tenantScopeFiltersApplied: boolean;
  productionFiltering: false;
  productionAuthImplemented: false;
  productionTenantEnforcement: false;
  noSecretsExposed: true;
  envValuesExposed: false;
  externalIdentityProviderCalled: false;
  metadata: Record<string, unknown>;
};

const ALWAYS_VISIBLE_PANELS = new Set<string>([
  "overview",
  "tenant_scope_planning",
  "tenant_scope_enforcement",
  "scope_model",
  "request_context"
]);

const PANEL_ALIAS_TO_READ_MODEL_KEY: Record<string, string> = {
  overview: "overview",
  tasks: "tasks",
  git: "git",
  github_app: "githubApp",
  github_app_integration: "githubAppIntegration",
  conflict_risks: "conflicts",
  registry: "registry",
  llm_gateway: "llm",
  llm_integration: "llmIntegration",
  local_agent_runner: "agents",
  policy: "policy",
  policy_bundles: "policyBundles",
  policy_shadow: "policyShadow",
  policy_runtime_poc: "policyRuntimePoc",
  auth: "auth",
  auth_production: "authProduction",
  auth_provider_skeleton: "authProviders",
  providers: "providers",
  security: "security",
  local_agent_protocol: "localAgents",
  mcp_gateway: "mcp",
  scope_model: "scopes",
  tenant_scope_planning: "tenantScopePlanning",
  tenant_scope_enforcement: "tenantScopeEnforcement",
  production_readiness: "readiness",
  database: "database",
  secret_backend: "secretBackend",
  secret_backend_decision: "secretBackendDecision",
  vault_secret_backend: "vaultSecretBackend",
  vault_integration: "vaultIntegration",
  merge_queue_integration: "mergeQueueIntegration",
  branch_cleanup: "branchCleanup",
  registry_compatibility: "registryCompatibility",
  registry_drift: "registryDrift",
  registry_canary_apply: "registryCanaryApply",
  staging: "staging",
  staging_dry_run: "stagingDryRun",
  staging_rc: "stagingReleaseCandidate",
  staging_execution: "stagingExecution",
  ci_cd: "cicd",
  observability: "observability",
  audit: "audit"
};

const SECRET_LIKE_FIELD_NAMES = new Set<string>([
  "apiKey",
  "secret",
  "secretValue",
  "tokenValue",
  "rawSecret",
  "rawValue",
  "envValue",
  "envValues",
  "secretRefValue",
  "vaultToken",
  "credential",
  "credentials",
  "authorization"
]);

const REDACTED_PLACEHOLDER = "[redacted]";

const KNOWN_ROLES = new Set<TenantScopePlanningRole>([
  "viewer",
  "developer",
  "reviewer",
  "security_admin",
  "platform_admin",
  "service_account_runner",
  "audit_reader",
  "release_manager",
  "system_admin_future"
]);

function normalizeRoles(roles: string[] | undefined): TenantScopePlanningRole[] {
  if (!roles || roles.length === 0) return ["platform_admin"];
  const normalized: TenantScopePlanningRole[] = [];
  for (const role of roles) {
    const trimmed = role.trim().toLowerCase().replace(/-/g, "_");
    if (KNOWN_ROLES.has(trimmed as TenantScopePlanningRole)) {
      normalized.push(trimmed as TenantScopePlanningRole);
    }
  }
  return normalized.length > 0 ? Array.from(new Set(normalized)) : ["platform_admin"];
}

function normalizeScopeList(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return [];
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)));
}

export function buildDashboardScopeFilterContext(input: DashboardScopeFilterContextInput = {}): DashboardScopeFilterContext {
  const roles = normalizeRoles(input.roles);
  const tenantIds = normalizeScopeList(input.tenantIds);
  const teamIds = normalizeScopeList(input.teamIds);
  const projectIds = normalizeScopeList(input.projectIds);
  const resourceScopes = normalizeScopeList(input.resourceScopes);
  const source: DashboardScopeFilterSource = input.source ?? "mock_actor";
  const authMode: DashboardScopeFilterAuthMode = input.authMode ?? "mock_actor";
  return {
    actorId: input.actorId ?? "mock-actor",
    principalId: input.principalId,
    roles,
    tenantIds,
    teamIds,
    projectIds,
    resourceScopes,
    source,
    authMode,
    metadata: {
      ...(input.metadata ?? {}),
      productionAuthImplemented: false,
      productionTenantEnforcement: false,
      externalIdentityProviderCalled: false,
      describesMock: true
    }
  };
}

function intersectRoles(allowed: TenantScopePlanningRole[], actorRoles: TenantScopePlanningRole[]): TenantScopePlanningRole[] {
  const allowedSet = new Set(allowed);
  return actorRoles.filter((role) => allowedSet.has(role));
}

function missingScopeDimensions(
  required: TenantScopePlanningScopeDimension[],
  context: DashboardScopeFilterContext
): TenantScopePlanningScopeDimension[] {
  const missing: TenantScopePlanningScopeDimension[] = [];
  for (const dimension of required) {
    switch (dimension) {
      case "tenant":
        if (context.tenantIds.length === 0) missing.push(dimension);
        break;
      case "team":
        if (context.teamIds.length === 0) missing.push(dimension);
        break;
      case "project":
        if (context.projectIds.length === 0) missing.push(dimension);
        break;
      default:
        if (context.resourceScopes.length === 0) missing.push(dimension);
        break;
    }
  }
  return missing;
}

function decideForServiceAccount(panelId: string): DashboardScopeFilterDecisionKind {
  if (panelId === "overview" || panelId === "tasks") return "warning_only";
  return "hidden";
}

export type DashboardScopeFilteringServiceInput = {
  now?: () => Date;
};

export class DashboardScopeFilteringService {
  private readonly now: () => Date;

  constructor(input: DashboardScopeFilteringServiceInput = {}) {
    this.now = input.now ?? (() => new Date());
  }

  buildFilterContext(input: DashboardScopeFilterContextInput = {}): DashboardScopeFilterContext {
    return buildDashboardScopeFilterContext(input);
  }

  evaluatePanel(panel: DashboardPanelScopeSummary, context: DashboardScopeFilterContext): DashboardPanelFilterDecision {
    const matchedRoles = intersectRoles(panel.allowedRoles, context.roles);
    const missingScopes = missingScopeDimensions(panel.requiredScopes, context);
    const sensitive = panel.redactionClass === "secret_adjacent" || panel.redactionClass === "never_store_raw";
    const alwaysVisible = ALWAYS_VISIBLE_PANELS.has(panel.panelId);
    const isServiceAccount = context.roles.includes("service_account_runner") && !context.roles.some((role) => role !== "service_account_runner");
    const isDefaultMockAdminFallback = context.authMode === "mock_actor"
      && context.roles.length === 1
      && context.roles[0] === "platform_admin"
      && context.tenantIds.length === 0
      && context.teamIds.length === 0
      && context.projectIds.length === 0;

    let decision: DashboardScopeFilterDecisionKind;
    let reason: string;

    if (alwaysVisible) {
      decision = "visible";
      reason = "always_visible_safety_meta_panel";
    } else if (isDefaultMockAdminFallback) {
      decision = "visible";
      reason = "default_mock_admin_fallback_visible";
    } else if (isServiceAccount) {
      decision = decideForServiceAccount(panel.panelId);
      reason = decision === "warning_only" ? "service_account_attribution_only" : "service_account_human_panel_hidden";
    } else if (matchedRoles.length === 0) {
      if (sensitive) {
        decision = "hidden";
        reason = "role_not_allowed_secret_adjacent_hidden";
      } else {
        decision = "warning_only";
        reason = "role_not_allowed_summary_only";
      }
    } else if (missingScopes.length > 0) {
      if (sensitive) {
        decision = "redacted";
        reason = "missing_scope_secret_adjacent_redacted";
      } else {
        decision = "warning_only";
        reason = "missing_scope_summary_only";
      }
    } else if (sensitive && !matchedRoles.some((role) => role === "security_admin" || role === "platform_admin" || role === "audit_reader" || role === "system_admin_future")) {
      decision = "redacted";
      reason = "secret_adjacent_role_summary_only";
    } else {
      decision = "visible";
      reason = "role_and_scope_match";
    }

    return {
      panelId: panel.panelId,
      panelName: panel.panelName,
      decision,
      reason,
      requiredRoles: [...panel.allowedRoles],
      matchedRoles,
      requiredScopes: [...panel.requiredScopes],
      missingScopes,
      sensitivity: panel.redactionClass,
      redactionClass: panel.redactionClass,
      redactedFields: decision === "redacted" || decision === "warning_only" ? this.redactedFieldHintsFor(panel.redactionClass) : [],
      productionFiltering: false,
      metadata: {
        describesMock: true,
        productionAuthImplemented: false,
        productionTenantEnforcement: false,
        externalIdentityProviderCalled: false,
        decidedAt: this.now().toISOString()
      }
    };
  }

  evaluatePanels(panels: DashboardPanelScopeSummary[], context: DashboardScopeFilterContext): DashboardPanelFilterDecision[] {
    return panels.map((panel) => this.evaluatePanel(panel, context));
  }

  summarizeDecisions(decisions: DashboardPanelFilterDecision[], context: DashboardScopeFilterContext): DashboardScopeFilterSummary {
    const total = decisions.length;
    const visible = decisions.filter((entry) => entry.decision === "visible").length;
    const redacted = decisions.filter((entry) => entry.decision === "redacted").length;
    const hidden = decisions.filter((entry) => entry.decision === "hidden").length;
    const warning = decisions.filter((entry) => entry.decision === "warning_only").length;
    const notApplicable = decisions.filter((entry) => entry.decision === "not_applicable").length;
    const secretAdjacent = decisions.filter((entry) => entry.redactionClass === "secret_adjacent" || entry.redactionClass === "never_store_raw").length;
    const tenantScopeFiltersApplied = context.tenantIds.length > 0 || context.teamIds.length > 0 || context.projectIds.length > 0;
    return {
      status: "v1_implemented_partial",
      totalPanels: total,
      visiblePanels: visible,
      redactedPanels: redacted,
      hiddenPanels: hidden,
      warningPanels: warning,
      notApplicablePanels: notApplicable,
      secretAdjacentPanels: secretAdjacent,
      roleApplied: context.roles[0],
      rolesApplied: [...context.roles],
      tenantScopeFiltersApplied,
      productionFiltering: false,
      productionAuthImplemented: false,
      productionTenantEnforcement: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      externalIdentityProviderCalled: false,
      metadata: {
        authMode: context.authMode,
        source: context.source,
        describesMock: true,
        generatedAt: this.now().toISOString()
      }
    };
  }

  panelKeyForReadModel(panelId: string): string | undefined {
    return PANEL_ALIAS_TO_READ_MODEL_KEY[panelId];
  }

  redactedFieldHintsFor(redactionClass: TenantScopePlanningRedactionClass): string[] {
    switch (redactionClass) {
      case "never_store_raw":
        return ["secrets", "envValues", "credentials", "authorization", "vaultToken"];
      case "secret_adjacent":
        return ["secretRefs", "credentialPaths", "envValueNames", "apiKey", "tokenHandle"];
      case "sensitive_metadata":
        return ["actorEmail", "session", "principalDetails"];
      case "internal_metadata":
        return ["internalIds"];
      case "public_metadata":
        return [];
    }
  }

  redactPanelBody<T extends Record<string, unknown>>(panelBody: T, decision: DashboardPanelFilterDecision): T {
    const cloned = structuredClone(panelBody) as Record<string, unknown>;
    const redactedFieldSet = new Set<string>(decision.redactedFields);
    const removeFromObject = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(removeFromObject);
      if (value && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>);
        const result: Record<string, unknown> = {};
        for (const [key, entry] of entries) {
          if (SECRET_LIKE_FIELD_NAMES.has(key) || redactedFieldSet.has(key)) {
            result[key] = REDACTED_PLACEHOLDER;
            continue;
          }
          result[key] = removeFromObject(entry);
        }
        return result;
      }
      return value;
    };
    const result = removeFromObject(cloned) as Record<string, unknown>;
    result.filterDecision = {
      panelId: decision.panelId,
      decision: decision.decision,
      reason: decision.reason,
      redactedFields: decision.redactedFields,
      productionFiltering: false
    };
    return result as T;
  }

  filterPanelBody<T extends Record<string, unknown>>(panelBody: T, decision: DashboardPanelFilterDecision): T | { filterDecision: Record<string, unknown> } {
    if (decision.decision === "hidden") {
      return {
        filterDecision: {
          panelId: decision.panelId,
          decision: "hidden",
          reason: decision.reason,
          requiredRoles: decision.requiredRoles,
          requiredScopes: decision.requiredScopes,
          productionFiltering: false
        }
      };
    }
    if (decision.decision === "visible" || decision.decision === "not_applicable") {
      return panelBody;
    }
    return this.redactPanelBody(panelBody, decision);
  }
}

export function createDashboardScopeFilteringService(input: DashboardScopeFilteringServiceInput = {}): DashboardScopeFilteringService {
  return new DashboardScopeFilteringService(input);
}

export const SAFE_DEMO_HEADER_NAMES = {
  role: "x-aichestra-demo-role",
  tenantId: "x-aichestra-demo-tenant-id",
  teamId: "x-aichestra-demo-team-id",
  projectId: "x-aichestra-demo-project-id",
  resourceScope: "x-aichestra-demo-resource-scope"
} as const;

export type DemoFilterHeaders = Partial<Record<keyof typeof SAFE_DEMO_HEADER_NAMES, string>>;

export function parseDashboardFilterHeaders(headers: Record<string, string | string[] | undefined>): DashboardScopeFilterContextInput {
  const getList = (raw: string | string[] | undefined): string[] => {
    if (raw === undefined) return [];
    if (Array.isArray(raw)) return raw.flatMap((value) => value.split(",")).map((value) => value.trim()).filter((value) => value.length > 0);
    return raw.split(",").map((value) => value.trim()).filter((value) => value.length > 0);
  };
  const role = headers[SAFE_DEMO_HEADER_NAMES.role];
  const tenantIds = getList(headers[SAFE_DEMO_HEADER_NAMES.tenantId]);
  const teamIds = getList(headers[SAFE_DEMO_HEADER_NAMES.teamId]);
  const projectIds = getList(headers[SAFE_DEMO_HEADER_NAMES.projectId]);
  const resourceScopes = getList(headers[SAFE_DEMO_HEADER_NAMES.resourceScope]);
  const hasAny = role !== undefined || tenantIds.length > 0 || teamIds.length > 0 || projectIds.length > 0 || resourceScopes.length > 0;
  if (!hasAny) return {};
  return {
    roles: typeof role === "string" ? getList(role) : Array.isArray(role) ? getList(role) : undefined,
    tenantIds,
    teamIds,
    projectIds,
    resourceScopes,
    source: "demo",
    authMode: "demo_request_header"
  };
}
