export type TenantScopePlanningRole =
  | "viewer"
  | "developer"
  | "reviewer"
  | "security_admin"
  | "platform_admin"
  | "service_account_runner"
  | "audit_reader"
  | "release_manager"
  | "system_admin_future";

export type TenantScopePlanningScopeDimension =
  | "tenant"
  | "team"
  | "project"
  | "repo"
  | "provider"
  | "model"
  | "secret"
  | "mcp_server_tool"
  | "registry_package"
  | "local_agent_host"
  | "audit_query";

export type TenantScopePlanningRedactionClass =
  | "public_metadata"
  | "internal_metadata"
  | "sensitive_metadata"
  | "secret_adjacent"
  | "never_store_raw";

export type TenantScopePlanningEnforcementStatus =
  | "none"
  | "metadata_only"
  | "planned"
  | "future_enforcement";

export type TenantScopePlanningVisibility =
  | "global_read_only"
  | "mock_metadata_read_only"
  | "scope_filtered_read_only"
  | "role_redacted_read_only"
  | "hidden_by_default"
  | "future_global_admin_only";

export type DashboardTenantScopePlan = {
  id: string;
  panelId: string;
  panelName: string;
  currentVisibility: TenantScopePlanningVisibility;
  targetVisibility: TenantScopePlanningVisibility;
  requiredScopes: TenantScopePlanningScopeDimension[];
  allowedRoles: TenantScopePlanningRole[];
  redactionClass: TenantScopePlanningRedactionClass;
  enforcementStatus: TenantScopePlanningEnforcementStatus;
  fallbackBehavior: string;
  metadata: Record<string, unknown>;
};

export type ReadinessTenantScopePlan = {
  id: string;
  endpointGroup: string;
  endpointPattern: string;
  currentVisibility: TenantScopePlanningVisibility;
  targetVisibility: TenantScopePlanningVisibility;
  requiredScopes: TenantScopePlanningScopeDimension[];
  allowedRoles: TenantScopePlanningRole[];
  redactionClass: TenantScopePlanningRedactionClass;
  enforcementStatus: TenantScopePlanningEnforcementStatus;
  fallbackBehavior: string;
  metadata: Record<string, unknown>;
};

export type TenantScopeRoleVisibility = {
  role: TenantScopePlanningRole;
  visiblePanels: string[];
  hiddenPanels: string[];
  redactedPanels: string[];
  tenantScopedPanels: string[];
  teamScopedPanels: string[];
  projectScopedPanels: string[];
  globalPanels: string[];
  productionRestrictions: string[];
  stagingRestrictions: string[];
  metadata: Record<string, unknown>;
};

export type TenantScopeFallbackBehavior = {
  id: string;
  missingScope: TenantScopePlanningScopeDimension;
  localMockBehavior: string;
  stagingBehavior: string;
  productionBehavior: string;
  auditBehavior: string;
  secretAdjacentBehavior: string;
  metadata: Record<string, unknown>;
};

export type TenantScopePlanningSummary = {
  id: string;
  status: "v1_implemented";
  implementationStatus: "v1_implemented";
  scopeMetadataStatus: "v1_implemented";
  planningOnly: true;
  dashboardPanelCount: number;
  readinessEndpointCount: number;
  dashboardPanelScopeSummaryCount: number;
  readinessEndpointScopeSummaryCount: number;
  panelsRequiringTenantScope: number;
  endpointsRequiringTenantScope: number;
  secretAdjacentSurfaces: number;
  auditScopedSurfaces: number;
  productionBlockerCount: number;
  tenantFilteringImplemented: false;
  productionTenantEnforcement: false;
  productionReady: false;
  noSecretsExposed: true;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type ScopedReadModelScopeStatus =
  | "metadata_only"
  | "missing_scope_warning"
  | "scoped_future"
  | "enforcement_future";

export type ScopedReadModelMetadata = {
  scopeStatus: ScopedReadModelScopeStatus;
  appliedScopes: TenantScopePlanningScopeDimension[];
  requiredScopes: TenantScopePlanningScopeDimension[];
  missingScopes: TenantScopePlanningScopeDimension[];
  sensitivity: TenantScopePlanningRedactionClass;
  roleVisibility: Record<string, unknown>;
  redactionStatus: string;
  tenantFilteringImplemented: false;
  productionEnforcementImplemented: false;
  warnings: string[];
  metadata: Record<string, unknown>;
};

export type DashboardPanelScopeSummary = {
  panelId: string;
  panelName: string;
  requiredScopes: TenantScopePlanningScopeDimension[];
  availableScopes: TenantScopePlanningScopeDimension[];
  missingScopes: TenantScopePlanningScopeDimension[];
  allowedRoles: TenantScopePlanningRole[];
  redactionClass: TenantScopePlanningRedactionClass;
  enforcementStatus: TenantScopePlanningEnforcementStatus;
  fallbackBehavior: string;
  warnings: string[];
};

export type ReadinessEndpointScopeSummary = {
  endpointGroup: string;
  endpointPattern: string;
  requiredScopes: TenantScopePlanningScopeDimension[];
  availableScopes: TenantScopePlanningScopeDimension[];
  missingScopes: TenantScopePlanningScopeDimension[];
  allowedRoles: TenantScopePlanningRole[];
  redactionClass: TenantScopePlanningRedactionClass;
  enforcementStatus: TenantScopePlanningEnforcementStatus;
  fallbackBehavior: string;
  warnings: string[];
};

type DashboardPlanInput = {
  id: string;
  name: string;
  source: string;
  scopes: TenantScopePlanningScopeDimension[];
  roles: TenantScopePlanningRole[];
  redaction: TenantScopePlanningRedactionClass;
  tenantFilteringRequiredBeforeProduction?: boolean;
  tenantFilteringRequiredBeforeStaging?: boolean;
  fallback?: string;
  currentVisibility?: TenantScopePlanningVisibility;
  targetVisibility?: TenantScopePlanningVisibility;
  enforcementStatus?: TenantScopePlanningEnforcementStatus;
  productionImpact: string;
};

type ReadinessPlanInput = {
  id: string;
  group: string;
  pattern: string;
  source: string;
  scopes: TenantScopePlanningScopeDimension[];
  roles: TenantScopePlanningRole[];
  redaction: TenantScopePlanningRedactionClass;
  hideDetailsForLowerRoles?: boolean;
  tenantFilteringRequiredBeforeProduction?: boolean;
  tenantFilteringRequiredBeforeStaging?: boolean;
  fallback?: string;
  currentVisibility?: TenantScopePlanningVisibility;
  targetVisibility?: TenantScopePlanningVisibility;
  enforcementStatus?: TenantScopePlanningEnforcementStatus;
  productionImpact: string;
};

const viewerRoles: TenantScopePlanningRole[] = ["viewer", "developer", "reviewer", "platform_admin"];
const operatorRoles: TenantScopePlanningRole[] = ["developer", "reviewer", "platform_admin", "release_manager"];
const securityRoles: TenantScopePlanningRole[] = ["security_admin", "platform_admin", "audit_reader"];
const adminRoles: TenantScopePlanningRole[] = ["platform_admin", "security_admin"];
const releaseRoles: TenantScopePlanningRole[] = ["reviewer", "release_manager", "platform_admin"];
const defaultAvailableScopeDimensions: TenantScopePlanningScopeDimension[] = ["tenant", "team", "project"];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function dashboardPlan(input: DashboardPlanInput): DashboardTenantScopePlan {
  return {
    id: `dashboard_scope_plan_${input.id}`,
    panelId: input.id,
    panelName: input.name,
    currentVisibility: input.currentVisibility ?? "mock_metadata_read_only",
    targetVisibility: input.targetVisibility ?? "scope_filtered_read_only",
    requiredScopes: input.scopes,
    allowedRoles: input.roles,
    redactionClass: input.redaction,
    enforcementStatus: input.enforcementStatus ?? "planned",
    fallbackBehavior: input.fallback ?? "local_metadata_with_warning_staging_blocker_production_deny_without_scope",
    metadata: {
      currentSource: input.source,
      tenantFilteringRequiredBeforeStaging: input.tenantFilteringRequiredBeforeStaging ?? false,
      tenantFilteringRequiredBeforeProduction: input.tenantFilteringRequiredBeforeProduction ?? input.scopes.includes("tenant"),
      noSecretsOrEnvValues: true,
      productionImpact: input.productionImpact,
      planningOnly: true
    }
  };
}

function readinessPlan(input: ReadinessPlanInput): ReadinessTenantScopePlan {
  return {
    id: `readiness_scope_plan_${input.id}`,
    endpointGroup: input.group,
    endpointPattern: input.pattern,
    currentVisibility: input.currentVisibility ?? "mock_metadata_read_only",
    targetVisibility: input.targetVisibility ?? "scope_filtered_read_only",
    requiredScopes: input.scopes,
    allowedRoles: input.roles,
    redactionClass: input.redaction,
    enforcementStatus: input.enforcementStatus ?? "planned",
    fallbackBehavior: input.fallback ?? "local_metadata_with_warning_staging_blocker_production_deny_without_scope",
    metadata: {
      currentSource: input.source,
      tenantFilteringRequiredBeforeStaging: input.tenantFilteringRequiredBeforeStaging ?? false,
      tenantFilteringRequiredBeforeProduction: input.tenantFilteringRequiredBeforeProduction ?? input.scopes.includes("tenant"),
      hideCountsOrDetailsForLowerRoles: input.hideDetailsForLowerRoles ?? false,
      noSecretsOrEnvValues: true,
      productionImpact: input.productionImpact,
      planningOnly: true
    }
  };
}

function normalizeAvailableScopes(availableScopes?: TenantScopePlanningScopeDimension[]): TenantScopePlanningScopeDimension[] {
  return [...new Set(availableScopes ?? defaultAvailableScopeDimensions)];
}

function missingScopesFor(requiredScopes: TenantScopePlanningScopeDimension[], availableScopes?: TenantScopePlanningScopeDimension[]): TenantScopePlanningScopeDimension[] {
  const available = new Set(normalizeAvailableScopes(availableScopes));
  return requiredScopes.filter((scope) => !available.has(scope));
}

function scopeStatusFor(plan: Pick<DashboardTenantScopePlan | ReadinessTenantScopePlan, "enforcementStatus" | "requiredScopes">, missingScopes: TenantScopePlanningScopeDimension[]): ScopedReadModelScopeStatus {
  if (missingScopes.length > 0) return "missing_scope_warning";
  if (plan.enforcementStatus === "future_enforcement") return "enforcement_future";
  if (plan.requiredScopes.length > 0) return "scoped_future";
  return "metadata_only";
}

function redactionStatusFor(redactionClass: TenantScopePlanningRedactionClass): string {
  if (redactionClass === "never_store_raw") return "never_store_raw";
  if (redactionClass === "secret_adjacent") return "redacted_secret_adjacent_metadata_only";
  if (redactionClass === "sensitive_metadata") return "sensitive_metadata_redacted_for_lower_roles";
  return "metadata_only";
}

function warningsForPlan(plan: Pick<DashboardTenantScopePlan | ReadinessTenantScopePlan, "requiredScopes" | "redactionClass" | "fallbackBehavior">, missingScopes: TenantScopePlanningScopeDimension[]): string[] {
  const warnings = [
    ...missingScopes.map((scope) => `missing_scope:${scope}`),
    "tenant_filtering_implemented:false",
    "production_tenant_enforcement:false"
  ];
  if (plan.requiredScopes.includes("audit_query")) {
    warnings.push("audit_query_scope_required_before_production");
  }
  if (plan.redactionClass === "secret_adjacent" || plan.redactionClass === "never_store_raw") {
    warnings.push("secret_adjacent_metadata_redacted");
  }
  warnings.push(`fallback:${plan.fallbackBehavior}`);
  return [...new Set(warnings)];
}

function scopedMetadataForPlan(
  plan: DashboardTenantScopePlan | ReadinessTenantScopePlan,
  surfaceKind: "dashboard_panel" | "readiness_endpoint",
  availableScopes?: TenantScopePlanningScopeDimension[]
): ScopedReadModelMetadata {
  const available = normalizeAvailableScopes(availableScopes);
  const appliedScopes = plan.requiredScopes.filter((scope) => available.includes(scope));
  const missingScopes = missingScopesFor(plan.requiredScopes, available);
  const warnings = warningsForPlan(plan, missingScopes);

  return {
    scopeStatus: scopeStatusFor(plan, missingScopes),
    appliedScopes,
    requiredScopes: [...plan.requiredScopes],
    missingScopes,
    sensitivity: plan.redactionClass,
    roleVisibility: {
      allowedRoles: [...plan.allowedRoles],
      hiddenForServiceAccountRunner: !plan.allowedRoles.includes("service_account_runner"),
      humanDashboardDefault: !plan.allowedRoles.includes("service_account_runner"),
      lowerRoleDetailsRedacted: plan.redactionClass === "secret_adjacent" || plan.redactionClass === "sensitive_metadata" || plan.redactionClass === "never_store_raw"
    },
    redactionStatus: redactionStatusFor(plan.redactionClass),
    tenantFilteringImplemented: false,
    productionEnforcementImplemented: false,
    warnings,
    metadata: {
      surfaceKind,
      source: "dashboard_readiness_tenant_scope_planning_v1",
      currentVisibility: plan.currentVisibility,
      targetVisibility: plan.targetVisibility,
      enforcementStatus: plan.enforcementStatus,
      fallbackBehavior: plan.fallbackBehavior,
      planningOnly: true,
      noSecretsOrEnvValues: true,
      tenantFilteringStatus: "future",
      productionReady: false
    }
  };
}

function dashboardPanelScopeSummary(plan: DashboardTenantScopePlan, availableScopes?: TenantScopePlanningScopeDimension[]): DashboardPanelScopeSummary {
  const available = normalizeAvailableScopes(availableScopes);
  const missingScopes = missingScopesFor(plan.requiredScopes, available);
  return {
    panelId: plan.panelId,
    panelName: plan.panelName,
    requiredScopes: [...plan.requiredScopes],
    availableScopes: available,
    missingScopes,
    allowedRoles: [...plan.allowedRoles],
    redactionClass: plan.redactionClass,
    enforcementStatus: plan.enforcementStatus,
    fallbackBehavior: plan.fallbackBehavior,
    warnings: warningsForPlan(plan, missingScopes)
  };
}

function readinessEndpointScopeSummary(plan: ReadinessTenantScopePlan, availableScopes?: TenantScopePlanningScopeDimension[]): ReadinessEndpointScopeSummary {
  const available = normalizeAvailableScopes(availableScopes);
  const missingScopes = missingScopesFor(plan.requiredScopes, available);
  return {
    endpointGroup: plan.endpointGroup,
    endpointPattern: plan.endpointPattern,
    requiredScopes: [...plan.requiredScopes],
    availableScopes: available,
    missingScopes,
    allowedRoles: [...plan.allowedRoles],
    redactionClass: plan.redactionClass,
    enforcementStatus: plan.enforcementStatus,
    fallbackBehavior: plan.fallbackBehavior,
    warnings: warningsForPlan(plan, missingScopes)
  };
}

const dashboardTenantScopePlans: DashboardTenantScopePlan[] = [
  dashboardPlan({ id: "overview", name: "Dashboard Overview", source: "GET /dashboard/overview", scopes: ["tenant", "team", "project"], roles: viewerRoles, redaction: "internal_metadata", productionImpact: "Overview metrics must be tenant-scoped before production." }),
  dashboardPlan({ id: "tasks", name: "Tasks / Task Runs", source: "GET /dashboard/tasks", scopes: ["tenant", "team", "project", "repo", "provider", "model"], roles: operatorRoles, redaction: "internal_metadata", productionImpact: "Task and run summaries can leak cross-project activity without tenant/project filters." }),
  dashboardPlan({ id: "recent_tasks", name: "Recent Tasks", source: "GET /dashboard/tasks recentTasks", scopes: ["tenant", "team", "project", "repo"], roles: viewerRoles, redaction: "internal_metadata", productionImpact: "Recent activity must be scoped before production dashboard use." }),
  dashboardPlan({ id: "task_detail", name: "Task Detail", source: "GET /dashboard/tasks plus task detail page", scopes: ["tenant", "team", "project", "repo", "provider", "model", "registry_package"], roles: operatorRoles, redaction: "sensitive_metadata", productionImpact: "Task details need tenant, repo, registry, and provider scoping before production." }),
  dashboardPlan({ id: "registry", name: "Registry", source: "GET /dashboard/registry", scopes: ["tenant", "team", "project", "registry_package"], roles: ["developer", "reviewer", "platform_admin"], redaction: "internal_metadata", productionImpact: "Registry catalogs need tenant package visibility before production." }),
  dashboardPlan({ id: "registry_governance", name: "Registry Approval / Governance", source: "GET /dashboard/registry governance fields", scopes: ["tenant", "team", "project", "registry_package", "audit_query"], roles: ["reviewer", "platform_admin", "audit_reader"], redaction: "sensitive_metadata", productionImpact: "Governance queues must hide unrelated tenant proposals before production." }),
  dashboardPlan({ id: "git", name: "Git / Real Git Adapter", source: "GET /dashboard/git", scopes: ["tenant", "team", "project", "repo"], roles: operatorRoles, redaction: "internal_metadata", productionImpact: "Git read models require repo grants and tenant allowlists before production." }),
  dashboardPlan({ id: "github_app", name: "GitHub App", source: "GET /dashboard/github-app", scopes: ["tenant", "team", "project", "repo", "secret"], roles: adminRoles, redaction: "secret_adjacent", productionImpact: "GitHub App metadata must be restricted to platform/security roles and repo scopes." }),
  dashboardPlan({ id: "github_app_integration", name: "GitHub App integration-test readiness", source: "GET /dashboard/github-app-integration", scopes: ["tenant", "team", "project", "repo", "secret"], roles: adminRoles, redaction: "secret_adjacent", productionImpact: "Integration-test gate metadata is secret-adjacent and must be scoped before live test use." }),
  dashboardPlan({ id: "conflict_risks", name: "Conflict Risks", source: "GET /dashboard/conflicts risks", scopes: ["tenant", "team", "project", "repo"], roles: operatorRoles, redaction: "internal_metadata", productionImpact: "Conflict risk summaries should not reveal files from unrelated repos." }),
  dashboardPlan({ id: "merge_queue", name: "Merge Queue", source: "GET /dashboard/conflicts mergeQueue", scopes: ["tenant", "team", "project", "repo"], roles: operatorRoles, redaction: "internal_metadata", productionImpact: "Merge queue status needs repo and project filters before production." }),
  dashboardPlan({ id: "llm_gateway", name: "LLM Gateway", source: "GET /dashboard/llm", scopes: ["tenant", "team", "project", "provider", "model"], roles: ["developer", "platform_admin", "security_admin"], redaction: "sensitive_metadata", productionImpact: "Provider and usage summaries must be tenant/provider scoped before production." }),
  dashboardPlan({ id: "llm_routing", name: "LLM routing", source: "GET /dashboard/llm routes and routing decisions", scopes: ["tenant", "team", "project", "provider", "model", "audit_query"], roles: ["developer", "platform_admin", "audit_reader"], redaction: "sensitive_metadata", productionImpact: "Routing decisions can expose provider/model posture and need scope filters." }),
  dashboardPlan({ id: "llm_integration", name: "LLM integration-test readiness", source: "GET /dashboard/llm-integration", scopes: ["tenant", "team", "project", "provider", "model", "secret"], roles: adminRoles, redaction: "secret_adjacent", productionImpact: "Live-test readiness is secret-adjacent and must be tenant/provider scoped." }),
  dashboardPlan({ id: "mcp_gateway", name: "MCP Gateway", source: "GET /dashboard/mcp", scopes: ["tenant", "team", "project", "mcp_server_tool", "secret", "audit_query"], roles: ["developer", "security_admin", "platform_admin"], redaction: "sensitive_metadata", productionImpact: "MCP catalog and invocation summaries require tool grants and tenant filters." }),
  dashboardPlan({ id: "security", name: "SecretRef / Security", source: "GET /dashboard/security", scopes: ["tenant", "team", "project", "secret", "audit_query"], roles: securityRoles, redaction: "secret_adjacent", productionImpact: "Security and SecretRef metadata must be scoped and redacted before production." }),
  dashboardPlan({ id: "vault_secret_backend", name: "Vault Secret Backend", source: "GET /dashboard/vault-secret-backend", scopes: ["tenant", "team", "project", "secret", "audit_query"], roles: securityRoles, redaction: "secret_adjacent", productionImpact: "Vault status metadata is secret-adjacent and must not reveal tenant paths." }),
  dashboardPlan({ id: "vault_integration", name: "Vault integration-test readiness", source: "GET /dashboard/vault-integration", scopes: ["tenant", "team", "project", "secret"], roles: securityRoles, redaction: "secret_adjacent", productionImpact: "Vault live-test gate metadata requires strict tenant and secret scoping." }),
  dashboardPlan({ id: "auth", name: "Auth/RBAC", source: "GET /dashboard/auth", scopes: ["tenant", "team", "project"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Mock auth visibility must be replaced with scoped production auth before production." }),
  dashboardPlan({ id: "auth_production", name: "Auth/RBAC Production Readiness", source: "GET /dashboard/auth-production", scopes: ["tenant", "team", "project", "audit_query"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Production auth readiness should be visible only to authorized admins." }),
  dashboardPlan({ id: "auth_provider_skeleton", name: "Production Auth Provider Skeleton", source: "GET /dashboard/auth-providers", scopes: ["tenant", "team", "project", "audit_query"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Future provider selection metadata must be admin-only and scoped before any production auth implementation." }),
  dashboardPlan({ id: "policy", name: "Policy", source: "GET /dashboard/policy", scopes: ["tenant", "team", "project", "provider", "model", "secret", "mcp_server_tool", "registry_package", "audit_query"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Policy rules and decisions must use tenant-aware policy subjects before production." }),
  dashboardPlan({ id: "service_account_actor_boundary", name: "Service Account Actor Boundary", source: "GET /dashboard/auth-production service account plans", scopes: ["tenant", "team", "project", "provider", "secret", "mcp_server_tool", "local_agent_host"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Service account visibility needs tenant and service scope boundaries before production." }),
  dashboardPlan({ id: "request_context", name: "RequestContext propagation", source: "GET /health requestContext and docs inventories", scopes: ["tenant", "team", "project", "audit_query"], roles: adminRoles, redaction: "internal_metadata", productionImpact: "Request attribution should display applied scope before production." }),
  dashboardPlan({ id: "scope_model", name: "Tenant/Repo/Provider Scope Model", source: "GET /dashboard/scopes", scopes: ["tenant", "team", "project", "repo", "provider", "model", "secret", "mcp_server_tool", "registry_package", "local_agent_host", "audit_query"], roles: viewerRoles, redaction: "internal_metadata", productionImpact: "Mock scope catalog may be shown locally but requires tenant filtering before production." }),
  dashboardPlan({ id: "observability", name: "Observability / Audit Retention", source: "GET /dashboard/observability", scopes: ["tenant", "team", "project", "repo", "provider", "model", "secret", "mcp_server_tool", "registry_package", "local_agent_host", "audit_query"], roles: securityRoles, redaction: "sensitive_metadata", productionImpact: "Audit and observability summaries must be scoped before production export or dashboard use." }),
  dashboardPlan({ id: "audit", name: "Audit Summary", source: "GET /dashboard/audit", scopes: ["tenant", "team", "project", "repo", "provider", "model", "secret", "mcp_server_tool", "registry_package", "local_agent_host", "audit_query"], roles: ["security_admin", "audit_reader", "platform_admin"], redaction: "sensitive_metadata", productionImpact: "Audit summaries require explicit audit-query scopes before production." }),
  dashboardPlan({ id: "local_agent_protocol", name: "Local Agent Protocol", source: "GET /dashboard/local-agents", scopes: ["tenant", "team", "project", "local_agent_host", "provider", "secret"], roles: ["developer", "security_admin", "platform_admin"], redaction: "sensitive_metadata", productionImpact: "Local Agent host and consent metadata must be tenant and host scoped." }),
  dashboardPlan({ id: "local_agent_runner", name: "Local Agent Runner", source: "GET /dashboard/agents", scopes: ["tenant", "team", "project", "repo", "provider", "model", "secret"], roles: operatorRoles, redaction: "sensitive_metadata", productionImpact: "Runner run/workspace summaries need project and repo filters before production." }),
  dashboardPlan({ id: "providers", name: "Enterprise Providers", source: "GET /dashboard/providers", scopes: ["tenant", "team", "project", "provider", "model", "local_agent_host"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Provider catalog visibility must reflect tenant provider grants before production." }),
  dashboardPlan({ id: "staging", name: "Staging Deployment Profile", source: "GET /dashboard/staging", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "audit_query"], roles: releaseRoles, redaction: "internal_metadata", productionImpact: "Staging readiness needs project and repo scope before shared staging use." }),
  dashboardPlan({ id: "ci_cd", name: "Staging CI/CD", source: "GET /dashboard/ci-cd", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "audit_query"], roles: releaseRoles, redaction: "sensitive_metadata", productionImpact: "CI/CD plans are read-only but must hide secret-adjacent integration gates by role." }),
  dashboardPlan({ id: "staging_dry_run", name: "Staging Dry-run", source: "GET /dashboard/staging-dry-run", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "mcp_server_tool", "audit_query"], roles: releaseRoles, redaction: "sensitive_metadata", productionImpact: "Dry-run aggregate sources need tenant and project scoping before staging evidence sharing." }),
  dashboardPlan({ id: "staging_rc", name: "Staging RC", source: "GET /dashboard/staging-rc", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "audit_query"], roles: releaseRoles, redaction: "sensitive_metadata", productionImpact: "RC checklist and signoff metadata must be scope-aware before release governance." }),
  dashboardPlan({ id: "staging_execution", name: "Staging Execution", source: "GET /dashboard/staging-execution", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "audit_query"], roles: releaseRoles, redaction: "sensitive_metadata", productionImpact: "Execution plans need tenant/project scoping before live staging execution." }),
  dashboardPlan({ id: "human_signoff", name: "Human Signoff / Approval", source: "GET /staging/signoffs and /dashboard/staging-execution", scopes: ["tenant", "team", "project", "repo", "audit_query"], roles: releaseRoles, redaction: "sensitive_metadata", productionImpact: "Human approval views need reviewed target/evidence/governance scope separation." }),
  dashboardPlan({ id: "production_readiness", name: "Production Deployment Readiness", source: "GET /dashboard/readiness", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "audit_query"], roles: ["platform_admin", "security_admin", "release_manager"], redaction: "sensitive_metadata", productionImpact: "Production readiness must remain blocked until tenant filtering and production auth exist." }),
  dashboardPlan({ id: "database", name: "Persistent DB Operations", source: "GET /dashboard/database", scopes: ["tenant", "team", "project", "audit_query"], roles: ["platform_admin", "security_admin"], redaction: "secret_adjacent", productionImpact: "DB operations metadata must never expose URLs and needs tenant-aware operational views." }),
  dashboardPlan({ id: "secret_backend", name: "Secret Backend Migration", source: "GET /dashboard/secret-backend", scopes: ["tenant", "team", "project", "secret", "audit_query"], roles: securityRoles, redaction: "secret_adjacent", productionImpact: "Secret backend migration planning is secret-adjacent and must be role/scoped." }),
  dashboardPlan({ id: "secret_backend_decision", name: "Production Secret Backend Decision", source: "GET /dashboard/secret-backend-decision", scopes: ["tenant", "team", "project", "secret", "audit_query"], roles: securityRoles, redaction: "secret_adjacent", productionImpact: "Secret backend decision metadata remains planning-only and must be scoped before production." }),
  dashboardPlan({ id: "policy_bundles", name: "Policy Bundle / OPA-Cedar Planning", source: "GET /dashboard/policy-bundles", scopes: ["tenant", "team", "project", "provider", "model", "secret", "mcp_server_tool", "registry_package", "audit_query"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Policy bundle planning must map tenant scopes before any runtime policy bundle use." }),
  dashboardPlan({ id: "policy_shadow", name: "Policy Runtime Shadow Evaluation Planning", source: "GET /dashboard/policy-shadow", scopes: ["tenant", "team", "project", "provider", "model", "secret", "mcp_server_tool", "registry_package", "audit_query"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Shadow policy comparisons must be scoped before any future live shadow evaluator runs." }),
  dashboardPlan({ id: "tenant_scope_planning", name: "Dashboard Tenant Scope Planning", source: "GET /dashboard/tenant-scope", scopes: ["tenant", "team", "project", "audit_query"], roles: ["platform_admin", "security_admin", "audit_reader"], redaction: "internal_metadata", tenantFilteringRequiredBeforeProduction: false, productionImpact: "This panel inventories future filters and must not claim enforcement is active." })
];

const readinessTenantScopePlans: ReadinessTenantScopePlan[] = [
  readinessPlan({ id: "deployment", group: "Production Deployment Readiness", pattern: "/readiness/deployment/*", source: "DeploymentReadinessService profiles/checks/risks/summary", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "audit_query"], roles: ["platform_admin", "security_admin", "release_manager"], redaction: "sensitive_metadata", productionImpact: "Must be tenant and project scoped before production readiness can be shared." }),
  readinessPlan({ id: "database", group: "Persistent DB Operations", pattern: "/readiness/database/*", source: "DeploymentReadinessService DB operations planning", scopes: ["tenant", "team", "project", "audit_query"], roles: ["platform_admin", "security_admin"], redaction: "secret_adjacent", hideDetailsForLowerRoles: true, productionImpact: "Must hide DB URL details and tenant-scope operational status before production." }),
  readinessPlan({ id: "secrets", group: "Secret Backend Migration", pattern: "/readiness/secrets/*", source: "DeploymentReadinessService secret backend planning", scopes: ["tenant", "team", "project", "secret", "audit_query"], roles: securityRoles, redaction: "secret_adjacent", hideDetailsForLowerRoles: true, productionImpact: "SecretRef counts and migration state must be scoped and redacted." }),
  readinessPlan({ id: "vault_secret_backend", group: "Vault Secret Backend", pattern: "/readiness/secrets/vault/*", source: "SecurityControlService Vault config/checks/summary", scopes: ["tenant", "team", "project", "secret", "audit_query"], roles: securityRoles, redaction: "secret_adjacent", hideDetailsForLowerRoles: true, productionImpact: "Vault token/path/key/value exposure stays forbidden; tenant path scoping is required before production." }),
  readinessPlan({ id: "auth", group: "Production Auth/RBAC", pattern: "/readiness/auth/*", source: "DeploymentReadinessService Auth/RBAC planning", scopes: ["tenant", "team", "project", "audit_query"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Production auth readiness remains planning-only until real scoped auth exists." }),
  readinessPlan({ id: "auth_providers", group: "Production Auth Provider Skeleton", pattern: "/readiness/auth-providers/*", source: "DeploymentReadinessService production auth provider skeleton", scopes: ["tenant", "team", "project", "audit_query"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Future provider readiness must stay metadata-only until production auth and tenant filtering are implemented." }),
  readinessPlan({ id: "policy_bundles", group: "Policy Bundle / OPA-Cedar Planning", pattern: "/readiness/policy-bundles/*", source: "DeploymentReadinessService policy bundle planning", scopes: ["tenant", "team", "project", "provider", "model", "secret", "mcp_server_tool", "registry_package", "audit_query"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Policy readiness must include tenant-aware policy subject mapping before production." }),
  readinessPlan({ id: "policy_shadow", group: "Policy Runtime Shadow Evaluation Planning", pattern: "/readiness/policy-shadow/*", source: "DeploymentReadinessService policy shadow planning", scopes: ["tenant", "team", "project", "provider", "model", "secret", "mcp_server_tool", "registry_package", "audit_query"], roles: adminRoles, redaction: "sensitive_metadata", productionImpact: "Shadow mismatch reports must include tenant-aware policy subject mapping before live evaluation." }),
  readinessPlan({ id: "github_app", group: "GitHub App / Webhook Hardening", pattern: "/readiness/github-app/*", source: "DeploymentReadinessService GitHub App planning", scopes: ["tenant", "team", "project", "repo", "secret", "audit_query"], roles: adminRoles, redaction: "secret_adjacent", hideDetailsForLowerRoles: true, productionImpact: "GitHub App readiness must be repo allowlist and tenant scoped before production webhooks." }),
  readinessPlan({ id: "github_app_integration", group: "GitHub App Integration Tests", pattern: "/readiness/github-app-integration/*", source: "DeploymentReadinessService GitHub App integration-test profile", scopes: ["tenant", "team", "project", "repo", "secret"], roles: adminRoles, redaction: "secret_adjacent", hideDetailsForLowerRoles: true, productionImpact: "Optional live-test readiness is secret-adjacent and requires strict scopes." }),
  readinessPlan({ id: "llm_integration", group: "LLM Gateway Integration Tests", pattern: "/readiness/llm-integration/*", source: "DeploymentReadinessService LLM integration-test profile", scopes: ["tenant", "team", "project", "provider", "model", "secret"], roles: adminRoles, redaction: "secret_adjacent", hideDetailsForLowerRoles: true, productionImpact: "Remote LLM live-test readiness must be provider/model/tenant scoped." }),
  readinessPlan({ id: "vault_integration", group: "Vault Integration Tests", pattern: "/readiness/vault-integration/*", source: "DeploymentReadinessService Vault integration-test profile", scopes: ["tenant", "team", "project", "secret"], roles: securityRoles, redaction: "secret_adjacent", hideDetailsForLowerRoles: true, productionImpact: "Vault live-test gate metadata must remain scoped and token/path redacted." }),
  readinessPlan({ id: "staging", group: "Staging Deployment Profile", pattern: "/readiness/staging/*", source: "DeploymentReadinessService staging profile planning", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "audit_query"], roles: releaseRoles, redaction: "sensitive_metadata", productionImpact: "Staging readiness should be project/repo scoped before multi-team staging." }),
  readinessPlan({ id: "staging_dry_run", group: "Staging Dry-run", pattern: "/readiness/staging-dry-run/*", source: "DeploymentReadinessService dry-run aggregation", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "mcp_server_tool", "audit_query"], roles: releaseRoles, redaction: "sensitive_metadata", productionImpact: "Dry-run aggregates multiple domains and must be tenant/project scoped." }),
  readinessPlan({ id: "staging_rc", group: "Staging Release Candidate", pattern: "/readiness/staging-rc/*", source: "DeploymentReadinessService RC checklist", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "audit_query"], roles: releaseRoles, redaction: "sensitive_metadata", productionImpact: "RC and signoff metadata must be scoped before release governance." }),
  readinessPlan({ id: "staging_execution", group: "Staging Execution", pattern: "/readiness/staging-execution/*", source: "DeploymentReadinessService execution plan", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "audit_query"], roles: releaseRoles, redaction: "sensitive_metadata", productionImpact: "Execution planning must be scoped before any live staging execution." }),
  readinessPlan({ id: "ci_cd", group: "Staging CI/CD", pattern: "/readiness/ci-cd/*", source: "DeploymentReadinessService CI/CD planning", scopes: ["tenant", "team", "project", "repo", "provider", "secret", "audit_query"], roles: releaseRoles, redaction: "sensitive_metadata", productionImpact: "CI/CD planning must be tenant/project scoped before active workflow implementation." }),
  readinessPlan({ id: "scopes", group: "Tenant/Repo/Provider Scope Model", pattern: "/readiness/scopes/*", source: "Auth mock scope catalog", scopes: ["tenant", "team", "project", "repo", "provider", "model", "secret", "mcp_server_tool", "registry_package", "local_agent_host", "audit_query"], roles: viewerRoles, redaction: "internal_metadata", productionImpact: "Mock catalog display is local/staging planning only and needs tenant filters before production." }),
  readinessPlan({ id: "secret_backend_decision", group: "Secret Backend Decision", pattern: "/readiness/secret-backend-decision/*", source: "DeploymentReadinessService secret backend option decision", scopes: ["tenant", "team", "project", "secret", "audit_query"], roles: securityRoles, redaction: "secret_adjacent", hideDetailsForLowerRoles: true, productionImpact: "Backend decision data is planning-only and secret-adjacent." }),
  readinessPlan({ id: "tenant_scope", group: "Dashboard/Readiness Tenant Scope Planning", pattern: "/readiness/tenant-scope/*", source: "DashboardReadinessTenantScopePlanningService", scopes: ["tenant", "team", "project", "repo", "provider", "model", "secret", "mcp_server_tool", "registry_package", "local_agent_host", "audit_query"], roles: viewerRoles, redaction: "internal_metadata", productionImpact: "This planning surface inventories future filters but does not enforce them." })
];

const roleVisibilityMatrix: TenantScopeRoleVisibility[] = [
  {
    role: "viewer",
    visiblePanels: ["overview", "recent_tasks", "scope_model", "production_readiness"],
    hiddenPanels: ["security", "vault_secret_backend", "github_app", "llm_integration", "vault_integration", "audit"],
    redactedPanels: ["tasks", "registry", "staging", "database"],
    tenantScopedPanels: ["overview", "scope_model"],
    teamScopedPanels: ["recent_tasks"],
    projectScopedPanels: ["tasks", "registry", "staging"],
    globalPanels: ["production_readiness"],
    productionRestrictions: ["No secret-adjacent details", "No cross-tenant counts", "No audit payloads"],
    stagingRestrictions: ["May view planning summaries with missing-scope warnings"],
    metadata: { humanDashboardDefault: true }
  },
  {
    role: "developer",
    visiblePanels: ["overview", "tasks", "task_detail", "git", "conflict_risks", "merge_queue", "llm_gateway", "llm_routing", "mcp_gateway", "local_agent_runner", "registry", "scope_model"],
    hiddenPanels: ["security", "vault_secret_backend", "database", "audit"],
    redactedPanels: ["github_app", "llm_integration", "secret_backend", "policy"],
    tenantScopedPanels: ["overview", "tasks", "git", "llm_gateway", "mcp_gateway"],
    teamScopedPanels: ["registry", "conflict_risks"],
    projectScopedPanels: ["task_detail", "local_agent_runner"],
    globalPanels: [],
    productionRestrictions: ["Scope to allowed project/repo/provider/model only"],
    stagingRestrictions: ["May see skipped integration status, not secret-adjacent gate details"],
    metadata: { humanDashboardDefault: true }
  },
  {
    role: "reviewer",
    visiblePanels: ["overview", "registry_governance", "git", "conflict_risks", "merge_queue", "staging_rc", "staging_execution", "human_signoff"],
    hiddenPanels: ["vault_secret_backend", "security"],
    redactedPanels: ["llm_gateway", "mcp_gateway", "policy", "database"],
    tenantScopedPanels: ["registry_governance", "git", "staging_rc"],
    teamScopedPanels: ["human_signoff"],
    projectScopedPanels: ["staging_execution"],
    globalPanels: [],
    productionRestrictions: ["Cannot bypass policy or approval gates"],
    stagingRestrictions: ["Can review evidence only for assigned scope"],
    metadata: { reviewQueueRole: true }
  },
  {
    role: "security_admin",
    visiblePanels: ["security", "vault_secret_backend", "vault_integration", "secret_backend", "secret_backend_decision", "policy", "policy_bundles", "auth_production", "auth_provider_skeleton", "observability", "audit", "github_app", "llm_integration"],
    hiddenPanels: [],
    redactedPanels: ["tasks", "task_detail", "registry"],
    tenantScopedPanels: ["security", "secret_backend", "auth_production", "auth_provider_skeleton"],
    teamScopedPanels: ["policy", "policy_bundles"],
    projectScopedPanels: ["vault_integration", "github_app", "llm_integration"],
    globalPanels: ["production_readiness"],
    productionRestrictions: ["Never raw secrets, env values, token values, session ids, or raw identity assertions"],
    stagingRestrictions: ["May inspect secret-adjacent gate metadata after redaction"],
    metadata: { secretAdjacentRole: true }
  },
  {
    role: "platform_admin",
    visiblePanels: dashboardTenantScopePlans.map((plan) => plan.panelId),
    hiddenPanels: [],
    redactedPanels: ["security", "vault_secret_backend", "llm_integration", "github_app_integration"],
    tenantScopedPanels: ["overview", "tasks", "git", "database", "staging", "ci_cd"],
    teamScopedPanels: ["registry", "policy", "auth_production", "auth_provider_skeleton"],
    projectScopedPanels: ["staging_dry_run", "staging_execution"],
    globalPanels: ["production_readiness", "policy_bundles"],
    productionRestrictions: ["Cannot bypass policy, SecretRef, runner, Git, LLM, MCP, or governance gates"],
    stagingRestrictions: ["Can see operational readiness, still planning-only"],
    metadata: { platformOperationsRole: true }
  },
  {
    role: "audit_reader",
    visiblePanels: ["observability", "audit", "registry_governance", "policy", "auth_production", "scope_model"],
    hiddenPanels: ["security", "vault_secret_backend", "local_agent_protocol"],
    redactedPanels: ["tasks", "git", "llm_routing", "mcp_gateway"],
    tenantScopedPanels: ["observability", "audit"],
    teamScopedPanels: ["registry_governance"],
    projectScopedPanels: ["policy"],
    globalPanels: [],
    productionRestrictions: ["Audit query scope required; raw payloads remain hidden"],
    stagingRestrictions: ["Can view scoped summaries and sanitized evidence references"],
    metadata: { auditSummaryOnly: true }
  },
  {
    role: "release_manager",
    visiblePanels: ["staging", "ci_cd", "staging_dry_run", "staging_rc", "staging_execution", "human_signoff", "production_readiness", "database"],
    hiddenPanels: ["security", "vault_secret_backend", "llm_integration", "github_app_integration"],
    redactedPanels: ["secret_backend", "policy", "audit"],
    tenantScopedPanels: ["staging", "staging_dry_run", "staging_rc"],
    teamScopedPanels: ["human_signoff"],
    projectScopedPanels: ["ci_cd", "staging_execution"],
    globalPanels: ["production_readiness"],
    productionRestrictions: ["Cannot mark production ready without tenant filtering and production auth"],
    stagingRestrictions: ["Can coordinate signoff evidence only inside approved scope"],
    metadata: { releaseWorkflowRole: true }
  },
  {
    role: "service_account_runner",
    visiblePanels: [],
    hiddenPanels: dashboardTenantScopePlans.map((plan) => plan.panelId),
    redactedPanels: [],
    tenantScopedPanels: [],
    teamScopedPanels: [],
    projectScopedPanels: [],
    globalPanels: [],
    productionRestrictions: ["No human dashboard by default", "Service account metadata is for API/audit attribution only"],
    stagingRestrictions: ["No interactive dashboard access"],
    metadata: { humanDashboardDefault: false }
  },
  {
    role: "system_admin_future",
    visiblePanels: [],
    hiddenPanels: dashboardTenantScopePlans.map((plan) => plan.panelId),
    redactedPanels: [],
    tenantScopedPanels: [],
    teamScopedPanels: [],
    projectScopedPanels: [],
    globalPanels: [],
    productionRestrictions: ["Future only; requires separate production auth and break-glass design"],
    stagingRestrictions: ["Not active in current runtime"],
    metadata: { futureOnly: true }
  }
];

const fallbackBehavior: TenantScopeFallbackBehavior[] = [
  {
    id: "missing_tenant",
    missingScope: "tenant",
    localMockBehavior: "Allow metadata-only display with explicit planning warning.",
    stagingBehavior: "Allow planning display, mark production blocker until tenant scope is present.",
    productionBehavior: "Deny tenant-scoped dashboard/readiness views unless explicit tenant or reviewed global admin scope exists.",
    auditBehavior: "Audit views require explicit audit query scope before production.",
    secretAdjacentBehavior: "Always redact secret-adjacent metadata and hide lower-role details.",
    metadata: { blockerBeforeProduction: true }
  },
  {
    id: "missing_team",
    missingScope: "team",
    localMockBehavior: "Allow display using tenant/project fallback where present.",
    stagingBehavior: "Warn and require team mapping before shared staging dashboards.",
    productionBehavior: "Require team scope or explicit tenant admin scope for team views.",
    auditBehavior: "Record missing team scope as query metadata only.",
    secretAdjacentBehavior: "Do not expand SecretRef visibility from tenant fallback alone.",
    metadata: { blockerBeforeProduction: true }
  },
  {
    id: "missing_project",
    missingScope: "project",
    localMockBehavior: "Allow metadata-only display with project missing warning.",
    stagingBehavior: "Block release/staging evidence views from being considered complete.",
    productionBehavior: "Require project scope for task, repo, runner, registry, staging, and CI/CD views.",
    auditBehavior: "Require explicit project or audit query scope.",
    secretAdjacentBehavior: "Hide provider/model/secret details until project scope exists.",
    metadata: { blockerBeforeProduction: true }
  },
  {
    id: "missing_repo",
    missingScope: "repo",
    localMockBehavior: "Allow non-actionable aggregate counts only.",
    stagingBehavior: "Warn for Git/conflict/merge/staging panels and block production readiness.",
    productionBehavior: "Require repo grant for Git, conflict, merge queue, task detail, and staging evidence.",
    auditBehavior: "Audit query must include repo or approved project-wide scope.",
    secretAdjacentBehavior: "Hide webhook/GitHub App details without repo scope.",
    metadata: { blockerBeforeProduction: true }
  },
  {
    id: "missing_provider_model",
    missingScope: "provider",
    localMockBehavior: "Allow mock provider/model summaries only.",
    stagingBehavior: "Warn for LLM/provider/MCP/local-agent surfaces.",
    productionBehavior: "Require provider/model allowlist scope before provider, route, and usage displays.",
    auditBehavior: "Provider/model audit summaries require explicit query scope.",
    secretAdjacentBehavior: "Hide credential and live-test gate detail.",
    metadata: { relatedScope: "model", blockerBeforeProduction: true }
  },
  {
    id: "missing_model",
    missingScope: "model",
    localMockBehavior: "Allow mock model catalog metadata only.",
    stagingBehavior: "Warn for LLM route, model allowlist, and provider integration surfaces.",
    productionBehavior: "Require provider/model scope before model route, usage, budget, or live-test readiness detail.",
    auditBehavior: "Model audit summaries require explicit model or provider query scope.",
    secretAdjacentBehavior: "Hide credential and provider live-test gate detail.",
    metadata: { relatedScope: "provider", blockerBeforeProduction: true }
  },
  {
    id: "missing_secret",
    missingScope: "secret",
    localMockBehavior: "Display SecretRef ids/counts only, never values.",
    stagingBehavior: "Display redacted gate status, mark production blocker.",
    productionBehavior: "Require SecretRef scope and security role; raw values are never displayed.",
    auditBehavior: "Secret audit summaries require explicit audit query and secret scope.",
    secretAdjacentBehavior: "Always redact and hide lower-role details.",
    metadata: { blockerBeforeProduction: true, neverStoreRaw: true }
  },
  {
    id: "missing_mcp_tool",
    missingScope: "mcp_server_tool",
    localMockBehavior: "Allow mock catalog metadata only.",
    stagingBehavior: "Warn for MCP catalog/invocation surfaces.",
    productionBehavior: "Require MCP server/tool grant before catalog, invocation, or audit visibility.",
    auditBehavior: "Tool audit queries require explicit tool or project scope.",
    secretAdjacentBehavior: "Hide SecretRef or tool-input-adjacent metadata.",
    metadata: { blockerBeforeProduction: true }
  },
  {
    id: "missing_registry_package",
    missingScope: "registry_package",
    localMockBehavior: "Allow registry package counts and lifecycle summaries only.",
    stagingBehavior: "Warn for registry/governance queues and mark package-scope blocker.",
    productionBehavior: "Require registry package scope before package detail, approval queue, or governance decision visibility.",
    auditBehavior: "Governance audit queries require package or project scope.",
    secretAdjacentBehavior: "Do not expand package visibility from secret/admin roles.",
    metadata: { blockerBeforeProduction: true }
  },
  {
    id: "missing_local_agent_host",
    missingScope: "local_agent_host",
    localMockBehavior: "Allow fixture host and local-agent summary metadata only.",
    stagingBehavior: "Warn for local-agent protocol, runner, and host ownership views.",
    productionBehavior: "Require local-agent host scope before host, session, channel, or consent detail visibility.",
    auditBehavior: "Local-agent audit queries require host or project scope.",
    secretAdjacentBehavior: "Hide host credential, consent, or provider-adjacent metadata from lower roles.",
    metadata: { blockerBeforeProduction: true }
  },
  {
    id: "missing_audit_query",
    missingScope: "audit_query",
    localMockBehavior: "Allow sanitized summary with warning.",
    stagingBehavior: "Allow evidence-only summary, mark production blocker.",
    productionBehavior: "Require explicit audit query scope before audit/observability/readiness drilldowns.",
    auditBehavior: "Deny or require tenant/global admin scope before production.",
    secretAdjacentBehavior: "Never show raw payloads, prompts, provider responses, headers, tokens, or env values.",
    metadata: { blockerBeforeProduction: true, neverStoreRaw: true }
  }
];

export class DashboardReadinessTenantScopePlanningService {
  listDashboardPlans(): DashboardTenantScopePlan[] {
    return clone(dashboardTenantScopePlans);
  }

  listReadinessPlans(): ReadinessTenantScopePlan[] {
    return clone(readinessTenantScopePlans);
  }

  listDashboardPanelScopeSummaries(availableScopes?: TenantScopePlanningScopeDimension[]): DashboardPanelScopeSummary[] {
    return this.listDashboardPlans().map((plan) => dashboardPanelScopeSummary(plan, availableScopes));
  }

  listReadinessEndpointScopeSummaries(availableScopes?: TenantScopePlanningScopeDimension[]): ReadinessEndpointScopeSummary[] {
    return this.listReadinessPlans().map((plan) => readinessEndpointScopeSummary(plan, availableScopes));
  }

  getDashboardPanelScopeSummary(panelId: string, availableScopes?: TenantScopePlanningScopeDimension[]): DashboardPanelScopeSummary | undefined {
    const plan = this.listDashboardPlans().find((candidate) => candidate.panelId === panelId);
    return plan ? dashboardPanelScopeSummary(plan, availableScopes) : undefined;
  }

  getReadinessEndpointScopeSummary(endpointKey: string, availableScopes?: TenantScopePlanningScopeDimension[]): ReadinessEndpointScopeSummary | undefined {
    const plan = this.listReadinessPlans().find((candidate) =>
      candidate.endpointPattern === endpointKey ||
      candidate.endpointGroup === endpointKey ||
      candidate.id === `readiness_scope_plan_${endpointKey}` ||
      candidate.id === endpointKey
    );
    return plan ? readinessEndpointScopeSummary(plan, availableScopes) : undefined;
  }

  getDashboardPanelScopeMetadata(panelId: string, availableScopes?: TenantScopePlanningScopeDimension[]): ScopedReadModelMetadata | undefined {
    const plan = this.listDashboardPlans().find((candidate) => candidate.panelId === panelId);
    return plan ? scopedMetadataForPlan(plan, "dashboard_panel", availableScopes) : undefined;
  }

  getReadinessEndpointScopeMetadata(endpointKey: string, availableScopes?: TenantScopePlanningScopeDimension[]): ScopedReadModelMetadata | undefined {
    const plan = this.listReadinessPlans().find((candidate) =>
      candidate.endpointPattern === endpointKey ||
      candidate.endpointGroup === endpointKey ||
      candidate.id === `readiness_scope_plan_${endpointKey}` ||
      candidate.id === endpointKey
    );
    return plan ? scopedMetadataForPlan(plan, "readiness_endpoint", availableScopes) : undefined;
  }

  getRoleVisibilityMatrix(): TenantScopeRoleVisibility[] {
    return clone(roleVisibilityMatrix);
  }

  getFallbackBehavior(): TenantScopeFallbackBehavior[] {
    return clone(fallbackBehavior);
  }

  getSummary(): TenantScopePlanningSummary {
    const dashboardPlans = this.listDashboardPlans();
    const readinessPlans = this.listReadinessPlans();
    const allPlans = [...dashboardPlans, ...readinessPlans];
    const secretAdjacentSurfaces = allPlans.filter((plan) => plan.redactionClass === "secret_adjacent" || plan.redactionClass === "never_store_raw").length;
    const auditScopedSurfaces = allPlans.filter((plan) => plan.requiredScopes.includes("audit_query")).length;
    const productionBlockerCount = allPlans.filter((plan) => plan.metadata.tenantFilteringRequiredBeforeProduction === true).length;

    return {
      id: "dashboard_readiness_tenant_scope_planning_v1",
      status: "v1_implemented",
      implementationStatus: "v1_implemented",
      scopeMetadataStatus: "v1_implemented",
      planningOnly: true,
      dashboardPanelCount: dashboardPlans.length,
      readinessEndpointCount: readinessPlans.length,
      dashboardPanelScopeSummaryCount: dashboardPlans.length,
      readinessEndpointScopeSummaryCount: readinessPlans.length,
      panelsRequiringTenantScope: dashboardPlans.filter((plan) => plan.requiredScopes.includes("tenant")).length,
      endpointsRequiringTenantScope: readinessPlans.filter((plan) => plan.requiredScopes.includes("tenant")).length,
      secretAdjacentSurfaces,
      auditScopedSurfaces,
      productionBlockerCount,
      tenantFilteringImplemented: false,
      productionTenantEnforcement: false,
      productionReady: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      metadata: {
        docs: "docs/roadmaps/dashboard-readiness-tenant-scope/v1.md",
        dashboardInventory: "docs/reference/dashboard-tenant-scope-inventory.md",
        readinessInventory: "docs/reference/readiness-tenant-scope-inventory.md",
        roleVisibilityMatrix: "docs/reference/dashboard-role-visibility-matrix.md",
        implementationDocs: "docs/roadmaps/dashboard-readiness-tenant-scope/implementation-v1.md",
        planningOnly: true,
        externalCallsEnabled: false,
        rowLevelSecurityImplemented: false,
        productionAuthImplemented: false,
        dashboardScopeMetadataImplemented: true,
        readinessScopeMetadataImplemented: true
      }
    };
  }
}

export function createDashboardReadinessTenantScopePlanningService(): DashboardReadinessTenantScopePlanningService {
  return new DashboardReadinessTenantScopePlanningService();
}

export function dashboardTenantScopePlanToDto(plan: DashboardTenantScopePlan): DashboardTenantScopePlan {
  return clone(plan);
}

export function readinessTenantScopePlanToDto(plan: ReadinessTenantScopePlan): ReadinessTenantScopePlan {
  return clone(plan);
}

export function tenantScopeRoleVisibilityToDto(entry: TenantScopeRoleVisibility): TenantScopeRoleVisibility {
  return clone(entry);
}

export function tenantScopeFallbackBehaviorToDto(entry: TenantScopeFallbackBehavior): TenantScopeFallbackBehavior {
  return clone(entry);
}

export function tenantScopePlanningSummaryToDto(summary: TenantScopePlanningSummary): TenantScopePlanningSummary {
  return clone(summary);
}

export function dashboardPanelScopeSummaryToDto(summary: DashboardPanelScopeSummary): DashboardPanelScopeSummary {
  return clone(summary);
}

export function readinessEndpointScopeSummaryToDto(summary: ReadinessEndpointScopeSummary): ReadinessEndpointScopeSummary {
  return clone(summary);
}

export function scopedReadModelMetadataToDto(metadata: ScopedReadModelMetadata): ScopedReadModelMetadata {
  return clone(metadata);
}
