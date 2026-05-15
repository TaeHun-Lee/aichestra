import { randomUUID } from "node:crypto";
import type {
  PolicyDecision,
  PolicyDecisionAuditEntry,
  PolicyEngine,
  PolicyEvaluationRequest,
  PolicyRule,
  PolicySetValidationResult
} from "./types.ts";
import { StaticPolicyEngine } from "./engine.ts";

function createPolicyId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function sanitizeDecision(decision: PolicyDecision): PolicyDecision {
  const clone = structuredClone(decision);
  clone.subject.metadata = clone.subject.metadata ? sanitizeRecord(clone.subject.metadata) : clone.subject.metadata;
  clone.resource.metadata = sanitizeRecord(clone.resource.metadata);
  clone.context.metadata = sanitizeRecord(clone.context.metadata);
  clone.context.environment = sanitizeRecord(clone.context.environment);
  return clone;
}

function sanitizeRecord(input: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(input);
  for (const key of Object.keys(clone)) {
    if (/token|secret|key|prompt/i.test(key)) {
      clone[key] = "[redacted]";
    }
  }
  return clone;
}

export type PolicyDecisionAuditRepository = {
  appendAuditEntry(input: Omit<PolicyDecisionAuditEntry, "id" | "createdAt"> & { id?: string; createdAt?: Date }): PolicyDecisionAuditEntry;
  listAuditEntries(filter?: { action?: string; actorId?: string; taskId?: string; taskRunId?: string }): PolicyDecisionAuditEntry[];
};

export class InMemoryPolicyDecisionAuditRepository implements PolicyDecisionAuditRepository {
  private readonly entries: PolicyDecisionAuditEntry[] = [];

  appendAuditEntry(input: Omit<PolicyDecisionAuditEntry, "id" | "createdAt"> & { id?: string; createdAt?: Date }): PolicyDecisionAuditEntry {
    const entry = {
      ...input,
      id: input.id ?? createPolicyId("policyaudit"),
      createdAt: input.createdAt ?? new Date()
    };
    this.entries.push(structuredClone(entry));
    return structuredClone(entry);
  }

  listAuditEntries(filter: { action?: string; actorId?: string; taskId?: string; taskRunId?: string } = {}): PolicyDecisionAuditEntry[] {
    return this.entries
      .filter((entry) => (filter.action === undefined || entry.action === filter.action) &&
        (filter.actorId === undefined || entry.actorId === filter.actorId) &&
        (filter.taskId === undefined || entry.taskId === filter.taskId) &&
        (filter.taskRunId === undefined || entry.taskRunId === filter.taskRunId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map((entry) => structuredClone(entry));
  }
}

export type PolicyServiceInput = {
  engine?: PolicyEngine;
  auditRepository?: PolicyDecisionAuditRepository;
  auditEnabled?: boolean;
};

export class PolicyService implements PolicyEngine {
  private readonly engine: PolicyEngine;
  private readonly auditRepository: PolicyDecisionAuditRepository;
  private readonly auditEnabled: boolean;

  constructor(input: PolicyServiceInput = {}) {
    this.engine = input.engine ?? new StaticPolicyEngine();
    this.auditRepository = input.auditRepository ?? new InMemoryPolicyDecisionAuditRepository();
    this.auditEnabled = input.auditEnabled ?? true;
  }

  getEngineKind() {
    return this.engine.getEngineKind();
  }

  evaluate(request: PolicyEvaluationRequest): PolicyDecision {
    const decision = sanitizeDecision(this.engine.evaluate(request));
    if (this.auditEnabled) this.appendDecisionAudit(decision);
    return decision;
  }

  evaluateMany(requests: PolicyEvaluationRequest[]): PolicyDecision[] {
    return requests.map((request) => this.evaluate(request));
  }

  listRules(): PolicyRule[] {
    return this.engine.listRules();
  }

  getRule(id: string): PolicyRule | undefined {
    return this.engine.getRule(id);
  }

  validatePolicySet(policySet: PolicyRule[]): PolicySetValidationResult {
    return this.engine.validatePolicySet(policySet);
  }

  listAuditEntries(filter: { action?: string; actorId?: string; taskId?: string; taskRunId?: string } = {}): PolicyDecisionAuditEntry[] {
    return this.auditRepository.listAuditEntries(filter);
  }

  getConfig() {
    return {
      engineKind: this.getEngineKind(),
      ruleCount: this.listRules().filter((rule) => rule.enabled).length,
      auditEnabled: this.auditEnabled
    };
  }

  private appendDecisionAudit(decision: PolicyDecision): PolicyDecisionAuditEntry {
    return this.auditRepository.appendAuditEntry({
      policyDecisionId: decision.id,
      action: decision.action,
      resourceKind: decision.resource.resourceKind,
      resourceId: decision.resource.resourceId,
      scopeKind: decision.resource.scopeKind,
      scopeId: decision.resource.scopeId,
      tenantIds: decision.subject.tenantIds ?? (decision.resource.tenantId ? [decision.resource.tenantId] : undefined),
      teamIds: decision.subject.teamIds ?? (decision.resource.teamId ? [decision.resource.teamId] : undefined),
      projectIds: decision.subject.projectIds ?? (decision.resource.projectId ? [decision.resource.projectId] : undefined),
      resourceScopes: decision.subject.resourceScopes ?? decision.resource.resourceScopes,
      actorId: decision.subject.actorId,
      principalId: decision.subject.principalId,
      actorKind: decision.subject.actorKind,
      authMode: decision.subject.authMode,
      serviceAccountId: decision.subject.serviceAccountId,
      source: decision.subject.source,
      requestId: decision.subject.requestId ?? stringMetadata(decision.context.metadata.requestId),
      correlationId: decision.subject.correlationId ?? stringMetadata(decision.context.metadata.correlationId),
      allowed: decision.allowed,
      decision: decision.decision,
      reason: decision.reason,
      matchedRuleIds: decision.matchedRuleIds,
      taskId: decision.context.taskId,
      taskRunId: decision.context.taskRunId
    });
  }
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function createDefaultPolicyService(): PolicyService {
  return new PolicyService();
}
