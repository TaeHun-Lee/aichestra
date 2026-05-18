import type {
  AuthContext,
  RequestContext,
  TenantScopeEnforcementDecision,
  TenantScopeEnforcementDecisionMode
} from "@aichestra/auth";
import { TenantScopeEnforcementService, createTenantScopeEnforcementService } from "@aichestra/auth";
import type {
  HarnessPackage,
  InstructionArtifact,
  RegistryApprovalQueueItem,
  RegistryKind,
  RegistryPackageKind,
  RegistryPackageManifest,
  RegistryResolution,
  RegistryVersionRef,
  SkillPackage
} from "@aichestra/core";
import type { PolicyResource, PolicyResourceScope, PolicySubject } from "@aichestra/policy";

export type RegistryScopeResourceKind =
  | "skill"
  | "harness"
  | "instruction"
  | "package"
  | "eval_result"
  | "approval_queue"
  | "history"
  | "audit";

export type RegistryScopeDecisionValue =
  | "in_scope"
  | "out_of_scope_warning"
  | "out_of_scope_denied"
  | "missing_scope_warning"
  | "missing_scope_denied"
  | "not_applicable";

export type RegistryScopeEnforcementMode =
  | "metadata_only"
  | "warning"
  | "deny_sensitive"
  | "future_production";

export type RegistryScopeDecision = {
  id: string;
  registryResourceKind: RegistryScopeResourceKind;
  resourceId: string;
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  repoId?: string;
  providerId?: string;
  decision: RegistryScopeDecisionValue;
  enforcementMode: RegistryScopeEnforcementMode;
  reason: string;
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  serviceAccountId?: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type RegistryScopeEnforcementSummary = {
  totalResources: number;
  inScope: number;
  warnings: number;
  denied: number;
  missingScope: number;
  enforcementMode: RegistryScopeEnforcementMode;
  productionEnforcement: false;
  metadata: Record<string, unknown>;
};

export type RegistryScopeServiceContext = {
  requestContext?: RequestContext;
  authContext?: AuthContext;
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  roles?: string[];
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  repoId?: string;
  providerId?: string;
  resourceScopes?: PolicyResourceScope[];
  metadata?: Record<string, unknown>;
};

export type RegistryScopeEvaluationInput = {
  registryResourceKind: RegistryScopeResourceKind;
  resourceId: string;
  packageKind?: RegistryPackageKind | "unknown";
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  repoId?: string;
  providerId?: string;
  enforcementMode?: RegistryScopeEnforcementMode;
  requiredScopes?: string[];
  sensitive?: boolean;
  metadata?: Record<string, unknown>;
};

export type RegistryScopePolicyAction =
  | "registry.scope.read"
  | "registry.scope.evaluate"
  | "registry.scope.enforce_future"
  | "registry.mutation.scope_check";

export type RegistryScopePolicyDecisionSnapshot = {
  decision: "allow" | "deny" | "require_approval" | "not_applicable";
  matchedRuleIds: string[];
  reason: string;
};

export type RegistryScopePolicyEvaluationInput = {
  action: RegistryScopePolicyAction;
  context: RegistryScopeServiceContext;
  resourceKind?: RegistryScopeResourceKind;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

export type RegistryTenantScopeEnforcementServiceInput = {
  tenantScopeEnforcementService?: TenantScopeEnforcementService;
  policyEvaluator?: (input: RegistryScopePolicyEvaluationInput) => RegistryScopePolicyDecisionSnapshot;
  now?: () => Date;
};

export class RegistryTenantScopeEnforcementService {
  private readonly tenantScopeEnforcementService: TenantScopeEnforcementService;
  private readonly policyEvaluator?: (input: RegistryScopePolicyEvaluationInput) => RegistryScopePolicyDecisionSnapshot;
  private readonly now: () => Date;
  private readonly decisions = new Map<string, RegistryScopeDecision>();

  constructor(input: RegistryTenantScopeEnforcementServiceInput = {}) {
    this.tenantScopeEnforcementService = input.tenantScopeEnforcementService ?? createTenantScopeEnforcementService();
    this.policyEvaluator = input.policyEvaluator;
    this.now = input.now ?? (() => new Date());
  }

  evaluateRegistryResource(input: RegistryScopeEvaluationInput, context: RegistryScopeServiceContext = {}): RegistryScopeDecision {
    const policyDecision = this.policyEvaluator?.({
      action: "registry.scope.evaluate",
      context,
      resourceKind: input.registryResourceKind,
      resourceId: input.resourceId,
      metadata: input.metadata
    });
    if (policyDecision?.decision === "deny") {
      return this.recordDecision(this.deniedByPolicy(input, context, policyDecision));
    }

    const resource = this.policyResourceFor(input);
    const tenantDecision = this.evaluateTenantDecision(input, context, resource);
    return this.recordDecision(this.fromTenantDecision(input, context, tenantDecision));
  }

  evaluateResolverCandidate(candidate: RegistryVersionRef, context: RegistryScopeServiceContext = {}): RegistryScopeDecision {
    return this.evaluateRegistryResource({
      registryResourceKind: candidate.kind,
      resourceId: candidate.id ?? `${candidate.kind}:${candidate.name}@${candidate.version}`,
      packageKind: candidate.kind,
      enforcementMode: "warning",
      metadata: {
        candidateName: candidate.name,
        candidateVersion: candidate.version,
        resolverCandidate: true
      }
    }, context);
  }

  attachResolverScopeMetadata(
    resolution: RegistryResolution,
    context: RegistryScopeServiceContext = {}
  ): RegistryResolution {
    const candidates = [
      ...resolution.selectedSkills,
      resolution.selectedHarness,
      ...resolution.selectedInstructions
    ];
    const decisions = candidates.map((candidate) => this.evaluateResolverCandidate(candidate, context));
    return {
      ...resolution,
      scopeDecisions: decisions.map(decisionToJson),
      scopeSummary: summaryToJson(this.summarizeDecisions(decisions))
    };
  }

  evaluateApprovalQueueItem(item: RegistryApprovalQueueItem, context: RegistryScopeServiceContext = {}): RegistryScopeDecision {
    return this.evaluateRegistryResource({
      registryResourceKind: "approval_queue",
      resourceId: `${item.targetKind}:${item.targetId}`,
      packageKind: item.targetKind,
      enforcementMode: "warning",
      metadata: {
        targetKind: item.targetKind,
        targetName: item.targetName,
        approvalStatus: item.approvalStatus,
        currentStatus: item.currentStatus,
        approvalQueueMetadataOnly: true
      }
    }, context);
  }

  evaluateRegistryAuditQuery(input: Partial<RegistryScopeEvaluationInput> = {}, context: RegistryScopeServiceContext = {}): RegistryScopeDecision {
    return this.evaluateRegistryResource({
      registryResourceKind: "audit",
      resourceId: input.resourceId ?? "registry_audit_query",
      tenantId: input.tenantId,
      teamId: input.teamId,
      projectId: input.projectId,
      repoId: input.repoId,
      providerId: input.providerId,
      enforcementMode: input.enforcementMode ?? "warning",
      requiredScopes: input.requiredScopes ?? ["tenant", "audit_query"],
      metadata: {
        ...(input.metadata ?? {}),
        readOnly: true,
        auditQueryScope: true
      }
    }, context);
  }

  evaluateMutationScope(input: RegistryScopeEvaluationInput, context: RegistryScopeServiceContext = {}): RegistryScopeDecision {
    const policyDecision = this.policyEvaluator?.({
      action: "registry.mutation.scope_check",
      context,
      resourceKind: input.registryResourceKind,
      resourceId: input.resourceId,
      metadata: input.metadata
    });
    if (policyDecision?.decision === "deny") {
      return this.recordDecision(this.deniedByPolicy(input, context, policyDecision));
    }
    return this.evaluateRegistryResource({
      ...input,
      enforcementMode: input.enforcementMode ?? "warning",
      metadata: {
        ...(input.metadata ?? {}),
        mutationScopeCheck: true,
        activeRegistryMutationThroughAutoImprovement: false,
        registryResolverGatesPreserved: true
      }
    }, context);
  }

  evaluateRegistryResources(
    resources: RegistryScopeEvaluationInput[],
    context: RegistryScopeServiceContext = {}
  ): RegistryScopeDecision[] {
    return resources.map((resource) => this.evaluateRegistryResource(resource, context));
  }

  listDecisions(query: {
    registryResourceKind?: RegistryScopeResourceKind;
    decision?: RegistryScopeDecisionValue;
  } = {}): RegistryScopeDecision[] {
    return Array.from(this.decisions.values())
      .filter((decision) => !query.registryResourceKind || decision.registryResourceKind === query.registryResourceKind)
      .filter((decision) => !query.decision || decision.decision === query.decision)
      .map(cloneDecision);
  }

  summarizeDecisions(decisions: RegistryScopeDecision[] = this.listDecisions()): RegistryScopeEnforcementSummary {
    const warnings = decisions.filter((decision) => decision.decision.endsWith("_warning")).length;
    const denied = decisions.filter((decision) => decision.decision.endsWith("_denied")).length;
    return {
      totalResources: decisions.length,
      inScope: decisions.filter((decision) => decision.decision === "in_scope").length,
      warnings,
      denied,
      missingScope: decisions.filter((decision) => decision.decision.startsWith("missing_scope")).length,
      enforcementMode: dominantMode(decisions),
      productionEnforcement: false,
      metadata: sanitizeMetadata({
        status: "v1_implemented_partial",
        representativeEnforcementOnly: true,
        resolverGatesPreserved: true,
        mutationScopeCheckEnabled: true,
        productionTenantIsolation: false,
        rowLevelSecurityImplemented: false,
        productionAuthImplemented: false,
        activeRegistryMutationThroughAutoImprovement: false,
        noExternalCalls: true,
        noSecretsExposed: true,
        envValuesExposed: false
      })
    };
  }

  getSummary(): RegistryScopeEnforcementSummary {
    return this.summarizeDecisions();
  }

  private evaluateTenantDecision(
    input: RegistryScopeEvaluationInput,
    context: RegistryScopeServiceContext,
    resource: PolicyResource
  ): TenantScopeEnforcementDecision {
    return this.tenantScopeEnforcementService.evaluateScopeAccess(subjectFromContext(context), resource, {
      requiredScopes: requiredScopesFor(input),
      enforcementMode: tenantModeFor(input),
      sensitivity: input.sensitive ? "secret_adjacent" : sensitivityFor(input),
      source: `registry_scope:${input.registryResourceKind}:${input.resourceId}`,
      createdAt: this.now(),
      metadata: sanitizeMetadata({
        ...(input.metadata ?? {}),
        registryResourceKind: input.registryResourceKind,
        packageKind: input.packageKind,
        productionEnforcement: false
      })
    });
  }

  private policyResourceFor(input: RegistryScopeEvaluationInput): PolicyResource {
    const tenantId = stringValue(input.tenantId);
    const teamId = stringValue(input.teamId);
    const projectId = stringValue(input.projectId);
    const resourceScopes = resourceScopesFor(input, tenantId, teamId, projectId);
    return {
      resourceKind: "registry_item",
      resourceId: input.resourceId,
      scopeKind: "registry_package",
      scopeId: registryPackageScopeId(input),
      tenantId,
      teamId,
      projectId,
      resourceScopes,
      metadata: sanitizeMetadata({
        ...(input.metadata ?? {}),
        registryResourceKind: input.registryResourceKind,
        packageKind: input.packageKind,
        repoId: input.repoId,
        providerId: input.providerId,
        productionEnforcement: false
      })
    };
  }

  private fromTenantDecision(
    input: RegistryScopeEvaluationInput,
    context: RegistryScopeServiceContext,
    tenantDecision: TenantScopeEnforcementDecision
  ): RegistryScopeDecision {
    const missing = tenantDecision.missingScopes.length > 0 || tenantDecision.mismatchedScopes.some((entry) => entry.mismatchKind.startsWith("missing_"));
    const decision = registryDecisionValue(tenantDecision, missing, input.enforcementMode);
    return {
      id: decisionId(input, context, decision),
      registryResourceKind: input.registryResourceKind,
      resourceId: input.resourceId,
      tenantId: stringValue(input.tenantId),
      teamId: stringValue(input.teamId),
      projectId: stringValue(input.projectId),
      repoId: stringValue(input.repoId),
      providerId: stringValue(input.providerId),
      decision,
      enforcementMode: input.enforcementMode ?? (input.sensitive ? "deny_sensitive" : "warning"),
      reason: tenantDecision.reason,
      requestId: context.requestId ?? context.requestContext?.requestId ?? tenantDecision.requestId,
      correlationId: context.correlationId ?? context.requestContext?.correlationId ?? tenantDecision.correlationId,
      actorId: context.actorId ?? context.authContext?.actor.id ?? context.requestContext?.authContext.actor.id ?? tenantDecision.actorId,
      serviceAccountId: context.serviceAccountId ?? stringValue(context.authContext?.metadata.serviceAccountId) ?? stringValue(context.requestContext?.authContext.metadata.serviceAccountId) ?? tenantDecision.serviceAccountId,
      createdAt: this.now(),
      metadata: sanitizeMetadata({
        ...(input.metadata ?? {}),
        tenantScopeDecision: this.tenantScopeEnforcementService.summarizeDecision(tenantDecision),
        productionEnforcement: false,
        policyDenyStillWins: true,
        resolverGatesPreserved: true,
        noSecretsExposed: true,
        envValuesExposed: false
      })
    };
  }

  private deniedByPolicy(
    input: RegistryScopeEvaluationInput,
    context: RegistryScopeServiceContext,
    policyDecision: RegistryScopePolicyDecisionSnapshot
  ): RegistryScopeDecision {
    return {
      id: decisionId(input, context, "out_of_scope_denied"),
      registryResourceKind: input.registryResourceKind,
      resourceId: input.resourceId,
      tenantId: stringValue(input.tenantId),
      teamId: stringValue(input.teamId),
      projectId: stringValue(input.projectId),
      repoId: stringValue(input.repoId),
      providerId: stringValue(input.providerId),
      decision: "out_of_scope_denied",
      enforcementMode: input.enforcementMode ?? "warning",
      reason: `policy_denied:${policyDecision.reason}`,
      requestId: context.requestId ?? context.requestContext?.requestId,
      correlationId: context.correlationId ?? context.requestContext?.correlationId,
      actorId: context.actorId ?? context.authContext?.actor.id ?? context.requestContext?.authContext.actor.id,
      serviceAccountId: context.serviceAccountId ?? stringValue(context.authContext?.metadata.serviceAccountId) ?? stringValue(context.requestContext?.authContext.metadata.serviceAccountId),
      createdAt: this.now(),
      metadata: sanitizeMetadata({
        policyDecision,
        policyDenyStillWins: true,
        productionEnforcement: false,
        noSecretsExposed: true,
        envValuesExposed: false
      })
    };
  }

  private recordDecision(decision: RegistryScopeDecision): RegistryScopeDecision {
    this.decisions.set(decision.id, cloneDecision(decision));
    return cloneDecision(decision);
  }
}

export function registryScopeDecisionToDto(decision: RegistryScopeDecision): Record<string, unknown> {
  return decisionToJson(decision);
}

export function registryScopeEnforcementSummaryToDto(summary: RegistryScopeEnforcementSummary): Record<string, unknown> {
  return summaryToJson(summary);
}

export function registryResourceInputFromSkill(skill: SkillPackage): RegistryScopeEvaluationInput {
  return {
    registryResourceKind: "skill",
    resourceId: skill.id,
    packageKind: "skill",
    metadata: {
      name: skill.name,
      version: skill.version,
      status: skill.status,
      approvalStatus: skill.approvalStatus,
      evalStatus: skill.evalStatus,
      owner: skill.owner
    }
  };
}

export function registryResourceInputFromHarness(harness: HarnessPackage): RegistryScopeEvaluationInput {
  return {
    registryResourceKind: "harness",
    resourceId: harness.id,
    packageKind: "harness",
    metadata: {
      name: harness.name,
      version: harness.version,
      status: harness.status,
      approvalStatus: harness.approvalStatus,
      evalStatus: harness.evalStatus,
      owner: harness.owner
    }
  };
}

export function registryResourceInputFromInstruction(instruction: InstructionArtifact): RegistryScopeEvaluationInput {
  return {
    registryResourceKind: "instruction",
    resourceId: instruction.id,
    packageKind: "instruction",
    metadata: {
      name: instruction.name,
      version: instruction.version,
      status: instruction.status,
      approvalStatus: instruction.approvalStatus,
      evalStatus: instruction.evalStatus,
      checksumStatus: instruction.checksumStatus,
      owner: instruction.owner
    }
  };
}

export function registryResourceInputFromPackageManifest(manifest: RegistryPackageManifest): RegistryScopeEvaluationInput {
  return {
    registryResourceKind: "package",
    resourceId: manifest.id,
    packageKind: manifest.packageKind,
    tenantId: stringValue(manifest.metadata.tenantId),
    teamId: stringValue(manifest.metadata.teamId),
    projectId: stringValue(manifest.metadata.projectId),
    repoId: stringValue(manifest.metadata.repoId),
    providerId: stringValue(manifest.metadata.providerId),
    metadata: {
      name: manifest.name,
      version: manifest.version,
      packageKind: manifest.packageKind,
      entries: manifest.entries.length
    }
  };
}

export function createRegistryTenantScopeEnforcementService(
  input: RegistryTenantScopeEnforcementServiceInput = {}
): RegistryTenantScopeEnforcementService {
  return new RegistryTenantScopeEnforcementService(input);
}

function subjectFromContext(context: RegistryScopeServiceContext): RequestContext | AuthContext | PolicySubject | undefined {
  if (context.requestContext) return context.requestContext;
  if (context.authContext) return context.authContext;
  if (
    !context.actorId &&
    !context.principalId &&
    !context.serviceAccountId &&
    !context.tenantId &&
    !context.teamId &&
    !context.projectId &&
    !context.resourceScopes
  ) {
    return undefined;
  }
  return {
    actorId: context.actorId ?? "registry_scope_mock_actor",
    principalId: context.principalId,
    actorKind: context.serviceAccountId ? "service_account" : "user",
    roles: context.roles ?? ["viewer"],
    tenantIds: compactStrings([context.tenantId]),
    teamIds: compactStrings([context.teamId]),
    projectIds: compactStrings([context.projectId]),
    resourceScopes: context.resourceScopes,
    serviceAccountId: context.serviceAccountId,
    requestId: context.requestId,
    correlationId: context.correlationId,
    source: context.source,
    isMockActor: true,
    metadata: sanitizeMetadata(context.metadata ?? {})
  };
}

function requiredScopesFor(input: RegistryScopeEvaluationInput): string[] {
  if (input.requiredScopes) return [...new Set(input.requiredScopes)];
  const scopes = ["tenant", "registry_package"];
  if (input.teamId) scopes.push("team");
  if (input.projectId) scopes.push("project");
  if (input.repoId) scopes.push("repo");
  if (input.providerId) scopes.push("provider");
  if (input.registryResourceKind === "audit") scopes.push("audit_query");
  return [...new Set(scopes)];
}

function tenantModeFor(input: RegistryScopeEvaluationInput): TenantScopeEnforcementDecisionMode {
  if (input.sensitive || input.enforcementMode === "deny_sensitive") return "deny_for_sensitive";
  if (input.enforcementMode === "future_production") return "future_production";
  if (input.enforcementMode === "metadata_only") return "metadata_only";
  return "warning";
}

function registryDecisionValue(
  tenantDecision: TenantScopeEnforcementDecision,
  missing: boolean,
  requestedMode: RegistryScopeEnforcementMode | undefined
): RegistryScopeDecisionValue {
  if (tenantDecision.decision === "not_applicable") return "not_applicable";
  if (tenantDecision.decision === "allow") return "in_scope";
  if (tenantDecision.decision === "deny") return missing ? "missing_scope_denied" : "out_of_scope_denied";
  if (requestedMode === "deny_sensitive") return missing ? "missing_scope_denied" : "out_of_scope_denied";
  return missing ? "missing_scope_warning" : "out_of_scope_warning";
}

function resourceScopesFor(
  input: RegistryScopeEvaluationInput,
  tenantId: string | undefined,
  teamId: string | undefined,
  projectId: string | undefined
): PolicyResourceScope[] {
  const scopes: PolicyResourceScope[] = [
    scope("registry_package", registryPackageScopeId(input), {
      tenantId,
      teamId,
      projectId,
      registryResourceKind: input.registryResourceKind,
      packageKind: input.packageKind
    })
  ];
  if (input.repoId) scopes.push(scope("repo", input.repoId, { tenantId, teamId, projectId }));
  if (input.providerId) scopes.push(scope("provider", input.providerId, { tenantId, teamId, projectId }));
  if (input.registryResourceKind === "audit") scopes.push(scope("audit_query", `registry_audit:${tenantId ?? "unknown"}`, { tenantId, teamId, projectId }));
  return scopes;
}

function scope(scopeKind: PolicyResourceScope["scopeKind"], scopeId: string, metadata: Record<string, unknown>): PolicyResourceScope {
  return {
    scopeKind,
    scopeId,
    metadata: sanitizeMetadata(metadata)
  };
}

function registryPackageScopeId(input: RegistryScopeEvaluationInput): string {
  const kind = input.packageKind ?? (input.registryResourceKind === "package" ? "bundle" : input.registryResourceKind);
  return `${kind}:${input.resourceId}`;
}

function decisionId(input: RegistryScopeEvaluationInput, context: RegistryScopeServiceContext, decision: RegistryScopeDecisionValue): string {
  return [
    "registry_scope",
    sanitizeId(input.registryResourceKind),
    sanitizeId(input.resourceId),
    sanitizeId(decision),
    sanitizeId(context.requestId ?? context.requestContext?.requestId ?? "local")
  ].join("_");
}

function dominantMode(decisions: RegistryScopeDecision[]): RegistryScopeEnforcementMode {
  if (decisions.some((decision) => decision.enforcementMode === "deny_sensitive")) return "deny_sensitive";
  if (decisions.some((decision) => decision.enforcementMode === "future_production")) return "future_production";
  if (decisions.some((decision) => decision.enforcementMode === "warning")) return "warning";
  return "metadata_only";
}

function sensitivityFor(input: RegistryScopeEvaluationInput): string {
  if (input.registryResourceKind === "audit" || input.registryResourceKind === "history" || input.registryResourceKind === "eval_result") return "sensitive_metadata";
  return "internal_metadata";
}

function cloneDecision(decision: RegistryScopeDecision): RegistryScopeDecision {
  return structuredClone(decision);
}

function decisionToJson(decision: RegistryScopeDecision): Record<string, unknown> {
  return {
    ...decision,
    createdAt: decision.createdAt.toISOString(),
    metadata: sanitizeMetadata(decision.metadata)
  };
}

function summaryToJson(summary: RegistryScopeEnforcementSummary): Record<string, unknown> {
  return {
    ...summary,
    metadata: sanitizeMetadata(summary.metadata)
  };
}

function compactStrings(values: Array<string | undefined>): string[] | undefined {
  const compacted = values.filter((value): value is string => typeof value === "string" && value.length > 0);
  return compacted.length > 0 ? compacted : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function sanitizeMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (isSafeStatusKey(key)) {
      output[key] = value;
    } else if (/token|secret|password|cookie|credential|session|apiKey|api_key|authorization|privateKey|private_key|envValue|databaseUrl|database_url|vault/i.test(key)) {
      output[key] = "[redacted]";
    } else if (value instanceof Date) {
      output[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      output[key] = value.map((entry) => entry && typeof entry === "object" ? sanitizeMetadata(entry as Record<string, unknown>) : entry);
    } else if (value && typeof value === "object") {
      output[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function isSafeStatusKey(key: string): boolean {
  return key === "noSecretsExposed" ||
    key === "noSecretValuesExposed" ||
    key === "envValuesExposed" ||
    key === "noEnvValuesExposed";
}
