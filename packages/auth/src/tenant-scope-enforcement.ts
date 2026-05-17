import type {
  PolicyResource,
  PolicyResourceScope,
  PolicyResourceScopeKind,
  PolicySubject
} from "@aichestra/policy";
import type { AuthContext, RequestContext } from "./types.ts";

export type TenantScopeEnforcementDecisionValue = "allow" | "deny" | "warn" | "not_applicable";
export type TenantScopeEnforcementDecisionMode = "metadata_only" | "warning" | "deny_for_sensitive" | "future_production";
export type TenantScopeEnforcementModeName =
  | "metadata_only"
  | "warning"
  | "deny_secret_adjacent"
  | "deny_audit_query"
  | "future_full_enforcement";
export type TenantScopeEnforcementProfile = "local" | "integration" | "staging" | "production_future";
export type TenantScopeMismatchSeverity = "low" | "medium" | "high" | "critical";
export type TenantScopeMismatchDefaultAction = "allow_with_warning" | "deny" | "future_deny";
export type TenantScopeMismatchKind =
  | "missing_tenant"
  | "missing_team"
  | "missing_project"
  | "missing_repo"
  | "tenant_mismatch"
  | "team_mismatch"
  | "project_mismatch"
  | "repo_mismatch"
  | "provider_mismatch"
  | "model_mismatch"
  | "secret_scope_mismatch"
  | "mcp_tool_mismatch"
  | "registry_package_mismatch"
  | "local_agent_host_mismatch"
  | "audit_scope_missing";

export type TenantScopeEnforcementScopeKind =
  | PolicyResourceScopeKind
  | "mcp_server_tool";

export type TenantScopeMismatch = {
  id: string;
  mismatchKind: TenantScopeMismatchKind;
  severity: TenantScopeMismatchSeverity;
  defaultAction: TenantScopeMismatchDefaultAction;
  metadata: Record<string, unknown>;
};

export type TenantScopeEnforcementMode = {
  id: string;
  mode: TenantScopeEnforcementModeName;
  description: string;
  enabled: boolean;
  defaultForProfile: TenantScopeEnforcementProfile;
  metadata: Record<string, unknown>;
};

export type TenantScopeSnapshot = {
  tenantIds: string[];
  teamIds: string[];
  projectIds: string[];
  scopeIds: Record<string, string[]>;
  metadata: Record<string, unknown>;
};

export type TenantScopeEnforcementDecision = {
  id: string;
  decision: TenantScopeEnforcementDecisionValue;
  reason: string;
  subjectScope: TenantScopeSnapshot;
  resourceScope: TenantScopeSnapshot;
  requiredScopes: TenantScopeEnforcementScopeKind[];
  missingScopes: TenantScopeEnforcementScopeKind[];
  matchedScopes: TenantScopeEnforcementScopeKind[];
  mismatchedScopes: TenantScopeMismatch[];
  enforcementMode: TenantScopeEnforcementDecisionMode;
  source: string;
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  serviceAccountId?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type TenantScopeEnforcementDecisionSummary = {
  id: string;
  decision: TenantScopeEnforcementDecisionValue;
  reason: string;
  enforcementMode: TenantScopeEnforcementDecisionMode;
  source: string;
  requiredScopes: TenantScopeEnforcementScopeKind[];
  missingScopes: TenantScopeEnforcementScopeKind[];
  matchedScopes: TenantScopeEnforcementScopeKind[];
  mismatchedScopes: Array<Pick<TenantScopeMismatch, "mismatchKind" | "severity" | "defaultAction">>;
  warnings: string[];
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  serviceAccountId?: string;
  tenantFilteringImplemented: false;
  productionTenantEnforcement: false;
  productionReady: false;
  noSecretsExposed: true;
  metadata: Record<string, unknown>;
};

export type TenantScopeEnforcementSummary = {
  id: string;
  status: "v1_implemented_partial";
  enforcementModes: number;
  mismatchKinds: number;
  defaultMode: TenantScopeEnforcementDecisionMode;
  dashboardReadinessMetadataEnabled: true;
  representativeEnforcementOnly: true;
  tenantFilteringImplemented: false;
  productionTenantEnforcement: false;
  productionAuthImplemented: false;
  rowLevelSecurityImplemented: false;
  noSecretsExposed: true;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type TenantScopeSurfaceScope = {
  id?: string;
  panelId?: string;
  endpointGroup?: string;
  endpointPattern?: string;
  requiredScopes?: string[];
  availableScopes?: string[];
  missingScopes?: string[];
  redactionClass?: string;
  sensitivity?: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  resourceScopes?: PolicyResourceScope[];
  metadata?: Record<string, unknown>;
};

export type TenantScopeEvaluationOptions = {
  requiredScopes?: string[];
  enforcementMode?: TenantScopeEnforcementDecisionMode;
  source?: string;
  sensitivity?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
};

export type TenantScopePolicyRelation = {
  scopeDecision: TenantScopeEnforcementDecisionSummary;
  policyDecisionStillAuthoritative: true;
  scopeAllowOverridesPolicyDeny: false;
  metadata: Record<string, unknown>;
};

type TenantScopeEvaluationSubject = PolicySubject | AuthContext | RequestContext | undefined;
type TenantScopeEvaluationResource = PolicyResource | TenantScopeSurfaceScope | undefined;

const scopeKinds: TenantScopeEnforcementScopeKind[] = [
  "tenant",
  "team",
  "project",
  "repo",
  "provider",
  "model",
  "secret",
  "mcp_tool",
  "registry_package",
  "local_agent_host",
  "audit_query"
];

const emptyScopeIds = Object.fromEntries(scopeKinds.map((kind) => [kind, []])) as Record<string, string[]>;

const modeCatalog: TenantScopeEnforcementMode[] = [
  {
    id: "tenant_scope_mode_metadata_only",
    mode: "metadata_only",
    description: "Record scope comparison metadata without changing access.",
    enabled: true,
    defaultForProfile: "local",
    metadata: { productionTenantEnforcement: false }
  },
  {
    id: "tenant_scope_mode_warning",
    mode: "warning",
    description: "Return warnings for missing or mismatched scope while preserving current read-only behavior.",
    enabled: true,
    defaultForProfile: "staging",
    metadata: { representativeOnly: true }
  },
  {
    id: "tenant_scope_mode_deny_secret_adjacent",
    mode: "deny_secret_adjacent",
    description: "Deny explicit helper decisions for secret-adjacent scope gaps; dashboard/readiness still uses metadata summaries only.",
    enabled: true,
    defaultForProfile: "integration",
    metadata: { rawSecretsDisplayed: false }
  },
  {
    id: "tenant_scope_mode_deny_audit_query",
    mode: "deny_audit_query",
    description: "Deny explicit helper decisions for missing audit query scope in future production paths.",
    enabled: false,
    defaultForProfile: "production_future",
    metadata: { futureOnly: true }
  },
  {
    id: "tenant_scope_mode_future_full_enforcement",
    mode: "future_full_enforcement",
    description: "Future production tenant isolation mode after production auth, durable scopes, repository filters, and review.",
    enabled: false,
    defaultForProfile: "production_future",
    metadata: { rowLevelSecurityImplemented: false, productionAuthImplemented: false }
  }
];

const mismatchCatalog: TenantScopeMismatch[] = [
  mismatch("missing_tenant", "high", "allow_with_warning", { remediation: "Attach explicit tenant scope before production." }),
  mismatch("missing_team", "medium", "allow_with_warning", { remediation: "Attach team scope for team-scoped views." }),
  mismatch("missing_project", "medium", "allow_with_warning", { remediation: "Attach project scope for project detail views." }),
  mismatch("missing_repo", "high", "allow_with_warning", { remediation: "Attach repo scope before Git, staging, or conflict detail enforcement." }),
  mismatch("tenant_mismatch", "critical", "future_deny", { remediation: "Deny in future production filtering." }),
  mismatch("team_mismatch", "high", "future_deny", { remediation: "Deny or redact in future production filtering." }),
  mismatch("project_mismatch", "high", "future_deny", { remediation: "Deny or return empty scoped view in production." }),
  mismatch("repo_mismatch", "high", "future_deny", { remediation: "Deny repo details outside grant scope." }),
  mismatch("provider_mismatch", "high", "future_deny", { remediation: "Require provider/model grant." }),
  mismatch("model_mismatch", "medium", "future_deny", { remediation: "Require model allowlist scope." }),
  mismatch("secret_scope_mismatch", "critical", "deny", { remediation: "Require SecretRef scope and never expose values." }),
  mismatch("mcp_tool_mismatch", "high", "future_deny", { remediation: "Require MCP tool grant before real transport." }),
  mismatch("registry_package_mismatch", "medium", "future_deny", { remediation: "Require package scope for registry details." }),
  mismatch("local_agent_host_mismatch", "high", "future_deny", { remediation: "Require Local Agent host/device scope." }),
  mismatch("audit_scope_missing", "critical", "allow_with_warning", { remediation: "Require audit query scope before production audit details." })
];

export class TenantScopeEnforcementService {
  evaluateScopeAccess(
    subject: TenantScopeEvaluationSubject,
    resource: TenantScopeEvaluationResource,
    options: TenantScopeEvaluationOptions = {}
  ): TenantScopeEnforcementDecision {
    const subjectScope = snapshotFromSubject(subject);
    const resourceScope = snapshotFromResource(resource);
    const requiredScopes = normalizeRequiredScopes(options.requiredScopes ?? requiredScopesFromResource(resource));
    const enforcementMode = options.enforcementMode ?? defaultDecisionMode(options.sensitivity);
    const source = options.source ?? sourceFromResource(resource);
    const matchedScopes: TenantScopeEnforcementScopeKind[] = [];
    const missingScopes: TenantScopeEnforcementScopeKind[] = [];
    const mismatchedScopes: TenantScopeMismatch[] = [];

    for (const requiredScope of requiredScopes) {
      const normalized = normalizeScopeKind(requiredScope);
      const subjectValues = valuesForScope(subjectScope, normalized);
      const resourceValues = valuesForScope(resourceScope, normalized);
      if (subjectValues.length === 0 || resourceValues.length === 0) {
        missingScopes.push(requiredScope);
        mismatchedScopes.push(mismatchForMissing(normalized, source, subjectValues.length === 0, resourceValues.length === 0));
        continue;
      }
      if (subjectValues.some((value) => resourceValues.includes(value))) {
        matchedScopes.push(requiredScope);
        continue;
      }
      mismatchedScopes.push(mismatchForDifferentValue(normalized, source));
    }

    const decision = decisionValueFor(requiredScopes, missingScopes, mismatchedScopes, enforcementMode);
    return {
      id: decisionId(source, subjectScope, resourceScope, requiredScopes),
      decision,
      reason: reasonForDecision(decision, missingScopes, mismatchedScopes, enforcementMode),
      subjectScope,
      resourceScope,
      requiredScopes,
      missingScopes: uniqueScopes(missingScopes),
      matchedScopes: uniqueScopes(matchedScopes),
      mismatchedScopes: uniqueMismatches(mismatchedScopes),
      enforcementMode,
      source,
      requestId: subjectScope.metadata.requestId as string | undefined,
      correlationId: subjectScope.metadata.correlationId as string | undefined,
      actorId: subjectScope.metadata.actorId as string | undefined,
      serviceAccountId: subjectScope.metadata.serviceAccountId as string | undefined,
      createdAt: options.createdAt ?? new Date(),
      metadata: sanitizeMetadata({
        ...(options.metadata ?? {}),
        sensitivity: options.sensitivity,
        tenantFilteringImplemented: false,
        productionTenantEnforcement: false,
        productionReady: false,
        policyDecisionStillAuthoritative: true
      })
    };
  }

  evaluateDashboardPanelAccess(
    context: TenantScopeEvaluationSubject,
    panelScope: TenantScopeSurfaceScope,
    options: TenantScopeEvaluationOptions = {}
  ): TenantScopeEnforcementDecision {
    return this.evaluateScopeAccess(context, panelScope, {
      ...options,
      enforcementMode: options.enforcementMode ?? "warning",
      sensitivity: options.sensitivity ?? panelScope.redactionClass ?? panelScope.sensitivity,
      source: options.source ?? `dashboard:${panelScope.panelId ?? panelScope.id ?? "unknown"}`
    });
  }

  evaluateReadinessEndpointAccess(
    context: TenantScopeEvaluationSubject,
    endpointScope: TenantScopeSurfaceScope,
    options: TenantScopeEvaluationOptions = {}
  ): TenantScopeEnforcementDecision {
    return this.evaluateScopeAccess(context, endpointScope, {
      ...options,
      enforcementMode: options.enforcementMode ?? "warning",
      sensitivity: options.sensitivity ?? endpointScope.redactionClass ?? endpointScope.sensitivity,
      source: options.source ?? `readiness:${endpointScope.endpointPattern ?? endpointScope.endpointGroup ?? endpointScope.id ?? "unknown"}`
    });
  }

  evaluateAuditQueryAccess(
    context: TenantScopeEvaluationSubject,
    auditScope: TenantScopeEvaluationResource,
    options: TenantScopeEvaluationOptions = {}
  ): TenantScopeEnforcementDecision {
    return this.evaluateScopeAccess(context, auditScope, {
      ...options,
      requiredScopes: options.requiredScopes ?? ["tenant", "audit_query"],
      enforcementMode: options.enforcementMode ?? "warning",
      sensitivity: options.sensitivity ?? "sensitive_metadata",
      source: options.source ?? "audit_query"
    });
  }

  evaluateSecretAdjacentAccess(
    context: TenantScopeEvaluationSubject,
    secretScope: TenantScopeEvaluationResource,
    options: TenantScopeEvaluationOptions = {}
  ): TenantScopeEnforcementDecision {
    return this.evaluateScopeAccess(context, secretScope, {
      ...options,
      requiredScopes: options.requiredScopes ?? ["tenant", "secret"],
      enforcementMode: options.enforcementMode ?? "deny_for_sensitive",
      sensitivity: options.sensitivity ?? "secret_adjacent",
      source: options.source ?? "secret_adjacent"
    });
  }

  summarizeDecision(decision: TenantScopeEnforcementDecision): TenantScopeEnforcementDecisionSummary {
    const warnings = [
      ...decision.missingScopes.map((scope) => `missing_scope:${scope}`),
      ...decision.mismatchedScopes.map((entry) => `${entry.mismatchKind}:${entry.severity}`),
      `enforcement_mode:${decision.enforcementMode}`,
      "tenant_filtering_implemented:false",
      "production_tenant_enforcement:false"
    ];
    if (decision.requiredScopes.includes("audit_query")) {
      warnings.push("audit_query_scope_required_before_production");
    }
    if (decision.enforcementMode === "deny_for_sensitive") {
      warnings.push("secret_adjacent_scope_enforcement_strict");
    }
    return {
      id: decision.id,
      decision: decision.decision,
      reason: decision.reason,
      enforcementMode: decision.enforcementMode,
      source: decision.source,
      requiredScopes: [...decision.requiredScopes],
      missingScopes: [...decision.missingScopes],
      matchedScopes: [...decision.matchedScopes],
      mismatchedScopes: decision.mismatchedScopes.map((entry) => ({
        mismatchKind: entry.mismatchKind,
        severity: entry.severity,
        defaultAction: entry.defaultAction
      })),
      warnings: uniqueStrings(warnings),
      requestId: decision.requestId,
      correlationId: decision.correlationId,
      actorId: decision.actorId,
      serviceAccountId: decision.serviceAccountId,
      tenantFilteringImplemented: false,
      productionTenantEnforcement: false,
      productionReady: false,
      noSecretsExposed: true,
      metadata: sanitizeMetadata({
        representativeOnly: true,
        policyDecisionStillAuthoritative: true,
        scopeAllowOverridesPolicyDeny: false,
        source: decision.source
      })
    };
  }

  attachDecisionToPolicySubject(subject: PolicySubject, decision: TenantScopeEnforcementDecision): PolicySubject {
    return {
      ...subject,
      metadata: sanitizeMetadata({
        ...(subject.metadata ?? {}),
        tenantScopeEnforcement: this.summarizeDecision(decision)
      })
    };
  }

  attachDecisionToPolicyResource(resource: PolicyResource, decision: TenantScopeEnforcementDecision): PolicyResource {
    return {
      ...resource,
      metadata: sanitizeMetadata({
        ...resource.metadata,
        tenantScopeEnforcement: this.summarizeDecision(decision)
      })
    };
  }

  policyRelation(decision: TenantScopeEnforcementDecision): TenantScopePolicyRelation {
    return {
      scopeDecision: this.summarizeDecision(decision),
      policyDecisionStillAuthoritative: true,
      scopeAllowOverridesPolicyDeny: false,
      metadata: {
        staticPolicyEngineUnchanged: true,
        scopeAllowDoesNotGrantPolicyAccess: true
      }
    };
  }

  listModes(): TenantScopeEnforcementMode[] {
    return clone(modeCatalog);
  }

  listMismatches(): TenantScopeMismatch[] {
    return clone(mismatchCatalog);
  }

  getSummary(): TenantScopeEnforcementSummary {
    return {
      id: "tenant_scope_enforcement_v1",
      status: "v1_implemented_partial",
      enforcementModes: modeCatalog.length,
      mismatchKinds: mismatchCatalog.length,
      defaultMode: "warning",
      dashboardReadinessMetadataEnabled: true,
      representativeEnforcementOnly: true,
      tenantFilteringImplemented: false,
      productionTenantEnforcement: false,
      productionAuthImplemented: false,
      rowLevelSecurityImplemented: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      metadata: {
        docs: "docs/foundations/auth-rbac/tenant-scope-enforcement-v1.md",
        inventory: "docs/reference/tenant-scope-enforcement-inventory.md",
        productionReady: false,
        noExternalCalls: true,
        noTenantProvisioning: true
      }
    };
  }
}

export function createTenantScopeEnforcementService(): TenantScopeEnforcementService {
  return new TenantScopeEnforcementService();
}

export function tenantScopeEnforcementDecisionToDto(decision: TenantScopeEnforcementDecision): TenantScopeEnforcementDecision {
  return clone(decision);
}

export function tenantScopeEnforcementDecisionSummaryToDto(summary: TenantScopeEnforcementDecisionSummary): TenantScopeEnforcementDecisionSummary {
  return clone(summary);
}

export function tenantScopeEnforcementModeToDto(mode: TenantScopeEnforcementMode): TenantScopeEnforcementMode {
  return clone(mode);
}

export function tenantScopeMismatchToDto(mismatch: TenantScopeMismatch): TenantScopeMismatch {
  return clone(mismatch);
}

export function tenantScopeEnforcementSummaryToDto(summary: TenantScopeEnforcementSummary): TenantScopeEnforcementSummary {
  return clone(summary);
}

function mismatch(
  mismatchKind: TenantScopeMismatchKind,
  severity: TenantScopeMismatchSeverity,
  defaultAction: TenantScopeMismatchDefaultAction,
  metadata: Record<string, unknown>
): TenantScopeMismatch {
  return {
    id: `tenant_scope_${mismatchKind}`,
    mismatchKind,
    severity,
    defaultAction,
    metadata: sanitizeMetadata(metadata)
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sanitizeMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (/token|secret|password|cookie|credential|session|apiKey|api_key|authorization|privateKey|private_key|databaseUrl|database_url|connectionString|vaultToken|envValue/i.test(key)) {
      output[key] = "[redacted]";
    } else if (value instanceof Date) {
      output[key] = value.toISOString();
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function snapshotFromSubject(subject: TenantScopeEvaluationSubject): TenantScopeSnapshot {
  if (!subject) return emptySnapshot({ subjectMissing: true });
  if (isRequestContext(subject)) {
    const authSnapshot = snapshotFromSubject(subject.authContext);
    return mergeSnapshots(authSnapshot, {
      tenantIds: compactStrings([subject.tenantId]),
      teamIds: compactStrings([subject.teamId]),
      projectIds: compactStrings([subject.projectId]),
      resourceScopes: subject.resourceScopes,
      metadata: {
        requestId: subject.requestId,
        correlationId: subject.correlationId,
        actorId: subject.authContext.actor.id,
        serviceAccountId: stringMetadata(subject.authContext.metadata.serviceAccountId),
        source: subject.source
      }
    });
  }
  if (isAuthContext(subject)) {
    return mergeSnapshots(emptySnapshot({
      requestId: subject.requestId,
      actorId: subject.actor.id,
      serviceAccountId: stringMetadata(subject.metadata.serviceAccountId),
      correlationId: stringMetadata(subject.metadata.correlationId),
      source: subject.source
    }), {
      tenantIds: subject.tenantScopes?.map((scope) => scope.tenantId),
      teamIds: [
        ...subject.teams.map((team) => team.id),
        ...(subject.teamScopes?.map((scope) => scope.teamId) ?? [])
      ],
      projectIds: subject.projectScopes?.map((scope) => scope.projectId),
      resourceScopes: subject.resourceScopes,
      metadata: {}
    });
  }
  return mergeSnapshots(emptySnapshot({
    requestId: subject.requestId,
    correlationId: subject.correlationId,
    actorId: subject.actorId,
    serviceAccountId: subject.serviceAccountId,
    source: subject.source
  }), {
    tenantIds: subject.tenantIds,
    teamIds: subject.teamIds ?? subject.teams,
    projectIds: subject.projectIds,
    resourceScopes: subject.resourceScopes,
    metadata: {}
  });
}

function snapshotFromResource(resource: TenantScopeEvaluationResource): TenantScopeSnapshot {
  if (!resource) return emptySnapshot({ resourceMissing: true });
  if (isPolicyResource(resource)) {
    return mergeSnapshots(emptySnapshot({ resourceKind: resource.resourceKind, resourceId: resource.resourceId }), {
      tenantIds: compactStrings([resource.tenantId, stringMetadata(resource.metadata.tenantId)]),
      teamIds: compactStrings([resource.teamId, stringMetadata(resource.metadata.teamId)]),
      projectIds: compactStrings([resource.projectId, stringMetadata(resource.metadata.projectId)]),
      resourceScopes: [
        ...(resource.resourceScopes ?? []),
        ...(resource.scopeKind && resource.scopeId ? [{
          scopeKind: normalizeScopeKind(resource.scopeKind) as PolicyResourceScopeKind,
          scopeId: resource.scopeId,
          metadata: {
            tenantId: resource.tenantId,
            teamId: resource.teamId,
            projectId: resource.projectId
          }
        } satisfies PolicyResourceScope] : [])
      ],
      metadata: {}
    });
  }
  return mergeSnapshots(emptySnapshot({
    surfaceId: resource.id ?? resource.panelId ?? resource.endpointPattern ?? resource.endpointGroup,
    redactionClass: resource.redactionClass ?? resource.sensitivity
  }), {
    tenantIds: compactStrings([resource.tenantId]),
    teamIds: compactStrings([resource.teamId]),
    projectIds: compactStrings([resource.projectId]),
    resourceScopes: resource.resourceScopes,
    metadata: sanitizeMetadata(resource.metadata ?? {})
  });
}

function emptySnapshot(metadata: Record<string, unknown> = {}): TenantScopeSnapshot {
  return {
    tenantIds: [],
    teamIds: [],
    projectIds: [],
    scopeIds: clone(emptyScopeIds),
    metadata: sanitizeMetadata(metadata)
  };
}

function mergeSnapshots(base: TenantScopeSnapshot, input: {
  tenantIds?: string[];
  teamIds?: string[];
  projectIds?: string[];
  resourceScopes?: PolicyResourceScope[];
  metadata?: Record<string, unknown>;
}): TenantScopeSnapshot {
  const scopeIds = clone(base.scopeIds);
  for (const tenantId of compactStrings(input.tenantIds)) addScopeId(scopeIds, "tenant", tenantId);
  for (const teamId of compactStrings(input.teamIds)) addScopeId(scopeIds, "team", teamId);
  for (const projectId of compactStrings(input.projectIds)) addScopeId(scopeIds, "project", projectId);
  for (const scope of input.resourceScopes ?? []) {
    addScopeId(scopeIds, normalizeScopeKind(scope.scopeKind), scope.scopeId);
    for (const parent of scope.parentScopes ?? []) {
      addScopeId(scopeIds, normalizeScopeKind(parent.scopeKind), parent.scopeId);
    }
    addScopeMetadataIds(scopeIds, scope.metadata);
  }
  return {
    tenantIds: uniqueStrings([...base.tenantIds, ...compactStrings(input.tenantIds), ...scopeIds.tenant]),
    teamIds: uniqueStrings([...base.teamIds, ...compactStrings(input.teamIds), ...scopeIds.team]),
    projectIds: uniqueStrings([...base.projectIds, ...compactStrings(input.projectIds), ...scopeIds.project]),
    scopeIds,
    metadata: sanitizeMetadata({ ...base.metadata, ...(input.metadata ?? {}) })
  };
}

function addScopeMetadataIds(scopeIds: Record<string, string[]>, metadata: Record<string, unknown>): void {
  const tenantId = stringMetadata(metadata.tenantId);
  const teamId = stringMetadata(metadata.teamId);
  const projectId = stringMetadata(metadata.projectId);
  if (tenantId) addScopeId(scopeIds, "tenant", tenantId);
  if (teamId) addScopeId(scopeIds, "team", teamId);
  if (projectId) addScopeId(scopeIds, "project", projectId);
}

function addScopeId(scopeIds: Record<string, string[]>, scopeKind: TenantScopeEnforcementScopeKind, scopeId: string | undefined): void {
  if (!scopeId) return;
  const normalized = normalizeScopeKind(scopeKind);
  scopeIds[normalized] = uniqueStrings([...(scopeIds[normalized] ?? []), scopeId]);
}

function valuesForScope(snapshot: TenantScopeSnapshot, scopeKind: TenantScopeEnforcementScopeKind): string[] {
  const normalized = normalizeScopeKind(scopeKind);
  if (normalized === "tenant") return snapshot.tenantIds;
  if (normalized === "team") return snapshot.teamIds;
  if (normalized === "project") return snapshot.projectIds;
  return snapshot.scopeIds[normalized] ?? [];
}

function normalizeRequiredScopes(scopes: string[]): TenantScopeEnforcementScopeKind[] {
  return uniqueScopes(scopes.map((scope) => normalizeScopeKind(scope)).filter((scope): scope is TenantScopeEnforcementScopeKind => scopeKinds.includes(scope)));
}

function normalizeScopeKind(scope: string): TenantScopeEnforcementScopeKind {
  if (scope === "mcp_server_tool") return "mcp_tool";
  return scope as TenantScopeEnforcementScopeKind;
}

function requiredScopesFromResource(resource: TenantScopeEvaluationResource): string[] {
  if (!resource) return [];
  if (isPolicyResource(resource)) {
    const scopes = [
      resource.scopeKind,
      resource.tenantId ? "tenant" : undefined,
      resource.teamId ? "team" : undefined,
      resource.projectId ? "project" : undefined,
      ...(resource.resourceScopes?.map((scope) => scope.scopeKind) ?? [])
    ];
    return compactStrings(scopes);
  }
  return resource.requiredScopes ?? [];
}

function sourceFromResource(resource: TenantScopeEvaluationResource): string {
  if (!resource) return "tenant_scope_enforcement";
  if (isPolicyResource(resource)) return `policy_resource:${resource.resourceKind}:${resource.resourceId ?? "unknown"}`;
  return resource.endpointPattern ?? resource.endpointGroup ?? resource.panelId ?? resource.id ?? "tenant_scope_surface";
}

function defaultDecisionMode(sensitivity: string | undefined): TenantScopeEnforcementDecisionMode {
  if (sensitivity === "secret_adjacent" || sensitivity === "never_store_raw") return "warning";
  return "metadata_only";
}

function decisionValueFor(
  requiredScopes: TenantScopeEnforcementScopeKind[],
  missingScopes: TenantScopeEnforcementScopeKind[],
  mismatchedScopes: TenantScopeMismatch[],
  mode: TenantScopeEnforcementDecisionMode
): TenantScopeEnforcementDecisionValue {
  if (requiredScopes.length === 0) return "not_applicable";
  if (missingScopes.length === 0 && mismatchedScopes.length === 0) return "allow";
  if (mode === "deny_for_sensitive") return "deny";
  if (mode === "future_production") return "warn";
  return "warn";
}

function reasonForDecision(
  decision: TenantScopeEnforcementDecisionValue,
  missingScopes: TenantScopeEnforcementScopeKind[],
  mismatchedScopes: TenantScopeMismatch[],
  mode: TenantScopeEnforcementDecisionMode
): string {
  if (decision === "not_applicable") return "no_required_scope_dimensions";
  if (decision === "allow") return "subject_and_resource_scopes_match";
  if (decision === "deny") return `scope_missing_or_mismatch_denied_for_${mode}`;
  if (missingScopes.length > 0) return `missing_scope_warning:${uniqueScopes(missingScopes).join(",")}`;
  return `scope_mismatch_warning:${uniqueStrings(mismatchedScopes.map((entry) => entry.mismatchKind)).join(",")}`;
}

function mismatchForMissing(
  scopeKind: TenantScopeEnforcementScopeKind,
  source: string,
  subjectMissing: boolean,
  resourceMissing: boolean
): TenantScopeMismatch {
  const mismatchKind = missingKindFor(scopeKind);
  const template = mismatchCatalog.find((entry) => entry.mismatchKind === mismatchKind) ?? mismatchCatalog[0];
  return {
    ...template,
    metadata: sanitizeMetadata({
      ...template.metadata,
      source,
      subjectMissing,
      resourceMissing
    })
  };
}

function mismatchForDifferentValue(scopeKind: TenantScopeEnforcementScopeKind, source: string): TenantScopeMismatch {
  const mismatchKind = mismatchKindFor(scopeKind);
  const template = mismatchCatalog.find((entry) => entry.mismatchKind === mismatchKind) ?? mismatchCatalog[0];
  return {
    ...template,
    metadata: sanitizeMetadata({
      ...template.metadata,
      source
    })
  };
}

function missingKindFor(scopeKind: TenantScopeEnforcementScopeKind): TenantScopeMismatchKind {
  const normalized = normalizeScopeKind(scopeKind);
  if (normalized === "tenant") return "missing_tenant";
  if (normalized === "team") return "missing_team";
  if (normalized === "project") return "missing_project";
  if (normalized === "repo") return "missing_repo";
  if (normalized === "secret") return "secret_scope_mismatch";
  if (normalized === "audit_query") return "audit_scope_missing";
  return mismatchKindFor(normalized);
}

function mismatchKindFor(scopeKind: TenantScopeEnforcementScopeKind): TenantScopeMismatchKind {
  const normalized = normalizeScopeKind(scopeKind);
  if (normalized === "tenant") return "tenant_mismatch";
  if (normalized === "team") return "team_mismatch";
  if (normalized === "project") return "project_mismatch";
  if (normalized === "repo") return "repo_mismatch";
  if (normalized === "provider") return "provider_mismatch";
  if (normalized === "model") return "model_mismatch";
  if (normalized === "secret") return "secret_scope_mismatch";
  if (normalized === "mcp_tool") return "mcp_tool_mismatch";
  if (normalized === "registry_package") return "registry_package_mismatch";
  if (normalized === "local_agent_host") return "local_agent_host_mismatch";
  if (normalized === "audit_query") return "audit_scope_missing";
  return "tenant_mismatch";
}

function decisionId(
  source: string,
  subjectScope: TenantScopeSnapshot,
  resourceScope: TenantScopeSnapshot,
  requiredScopes: TenantScopeEnforcementScopeKind[]
): string {
  const raw = [
    source,
    subjectScope.metadata.actorId ?? "anonymous",
    subjectScope.tenantIds.join(".") || "no_subject_tenant",
    resourceScope.tenantIds.join(".") || "no_resource_tenant",
    requiredScopes.join(".") || "no_required_scope"
  ].join(":");
  const safe = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
  return `tenant_scope_decision_${safe || "metadata"}`;
}

function uniqueScopes<T extends string>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(compactStrings(values))];
}

function uniqueMismatches(values: TenantScopeMismatch[]): TenantScopeMismatch[] {
  const byKind = new Map<string, TenantScopeMismatch>();
  for (const value of values) byKind.set(value.mismatchKind, value);
  return [...byKind.values()];
}

function compactStrings(values: Array<string | undefined> | undefined): string[] {
  return (values ?? []).filter((value): value is string => typeof value === "string" && value.length > 0);
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRequestContext(value: TenantScopeEvaluationSubject): value is RequestContext {
  return typeof value === "object" && value !== null && "authContext" in value && "source" in value;
}

function isAuthContext(value: TenantScopeEvaluationSubject): value is AuthContext {
  return typeof value === "object" && value !== null && "actor" in value && "principal" in value && "authMode" in value;
}

function isPolicyResource(value: TenantScopeEvaluationResource): value is PolicyResource {
  return typeof value === "object" && value !== null && "resourceKind" in value;
}
