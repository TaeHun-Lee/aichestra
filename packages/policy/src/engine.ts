import { randomUUID } from "node:crypto";
import { createDefaultPolicyRules } from "./default-rules.ts";
import type {
  PolicyDecision,
  PolicyDecisionValue,
  PolicyEngine,
  PolicyEngineKind,
  PolicyEvaluationRequest,
  PolicyRule,
  PolicyRuleConditions,
  PolicySetValidationResult
} from "./types.ts";
import { isPolicyAction, isPolicyResourceKind } from "./types.ts";

function createPolicyId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function lower(value: unknown): string {
  return String(value ?? "").toLowerCase();
}

function commandText(request: PolicyEvaluationRequest): string {
  return lower(request.context.command ?? request.resource.metadata.command);
}

function scalarEquals(left: unknown, right: string | number | boolean): boolean {
  return left === right;
}

function mapMatches(
  expected: Record<string, string | number | boolean> | undefined,
  actual: Record<string, unknown>
): boolean {
  if (!expected) return true;
  return Object.entries(expected).every(([key, value]) => scalarEquals(actual[key], value));
}

function conditionMatches(conditions: PolicyRuleConditions, request: PolicyEvaluationRequest): boolean {
  if (conditions.subjectRolesAny && !request.subject.roles.some((role) => conditions.subjectRolesAny?.includes(role))) {
    return false;
  }
  if (conditions.providerKinds) {
    const providerKind = String(request.context.providerKind ?? request.resource.metadata.providerKind ?? "");
    if (!conditions.providerKinds.includes(providerKind)) return false;
  }
  if (conditions.runnerKinds) {
    const runnerKind = String(request.context.runnerKind ?? request.resource.metadata.runnerKind ?? "");
    if (!conditions.runnerKinds.includes(runnerKind)) return false;
  }
  if (conditions.resourceStatuses) {
    const status = String(request.resource.metadata.status ?? "");
    if (!conditions.resourceStatuses.includes(status)) return false;
  }
  if (conditions.commandIncludesAny) {
    const command = commandText(request);
    if (!conditions.commandIncludesAny.some((needle) => command.includes(needle.toLowerCase()))) return false;
  }
  if (conditions.commandEqualsAny) {
    const command = commandText(request);
    if (!conditions.commandEqualsAny.some((candidate) => command === candidate.toLowerCase())) return false;
  }
  if (!mapMatches(conditions.environmentEquals, request.context.environment)) return false;
  if (!mapMatches(conditions.metadataEquals, request.context.metadata)) return false;
  if (conditions.riskScoreAtLeast !== undefined && (request.context.riskScore ?? 0) < conditions.riskScoreAtLeast) {
    return false;
  }
  return true;
}

function decisionValueForEffect(effect: PolicyRule["effect"]): PolicyDecisionValue {
  return effect === "allow" ? "allow" : effect === "require_approval" ? "require_approval" : "deny";
}

export class StaticPolicyEngine implements PolicyEngine {
  private readonly rules: PolicyRule[];

  constructor(rules: PolicyRule[] = createDefaultPolicyRules()) {
    const validation = this.validatePolicySet(rules);
    if (!validation.ok) {
      throw new Error(`Invalid policy set: ${validation.errors.join("; ")}`);
    }
    this.rules = rules.map((rule) => structuredClone(rule));
  }

  getEngineKind(): PolicyEngineKind {
    return "static";
  }

  evaluate(request: PolicyEvaluationRequest): PolicyDecision {
    const candidates = this.rules
      .filter((rule) => rule.enabled)
      .filter((rule) => rule.action === request.action)
      .filter((rule) => rule.resourceKind === undefined || rule.resourceKind === request.resource.resourceKind)
      .filter((rule) => conditionMatches(rule.conditions, request))
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));

    const matched = candidates[0];
    if (!matched) {
      return {
        id: createPolicyId("policydec"),
        allowed: false,
        decision: "deny",
        reason: `No policy rule allowed ${request.action} on ${request.resource.resourceKind}.`,
        matchedRuleIds: ["policy_default_deny"],
        subject: structuredClone(request.subject),
        resource: structuredClone(request.resource),
        action: request.action,
        context: structuredClone(request.context),
        createdAt: new Date()
      };
    }

    const decision = decisionValueForEffect(matched.effect);
    return {
      id: createPolicyId("policydec"),
      allowed: decision === "allow",
      decision,
      reason: matched.description,
      matchedRuleIds: [matched.id],
      subject: structuredClone(request.subject),
      resource: structuredClone(request.resource),
      action: request.action,
      context: structuredClone(request.context),
      createdAt: new Date()
    };
  }

  evaluateMany(requests: PolicyEvaluationRequest[]): PolicyDecision[] {
    return requests.map((request) => this.evaluate(request));
  }

  listRules(): PolicyRule[] {
    return this.rules
      .slice()
      .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
      .map((rule) => structuredClone(rule));
  }

  getRule(id: string): PolicyRule | undefined {
    const rule = this.rules.find((candidate) => candidate.id === id);
    return rule ? structuredClone(rule) : undefined;
  }

  validatePolicySet(policySet: PolicyRule[]): PolicySetValidationResult {
    const errors: string[] = [];
    const ids = new Set<string>();
    for (const rule of policySet) {
      if (!rule.id) errors.push("policy rule id is required");
      if (ids.has(rule.id)) errors.push(`duplicate policy rule id: ${rule.id}`);
      ids.add(rule.id);
      if (!isPolicyAction(rule.action)) errors.push(`invalid policy action for rule ${rule.id}`);
      if (rule.resourceKind !== undefined && !isPolicyResourceKind(rule.resourceKind)) errors.push(`invalid resource kind for rule ${rule.id}`);
      if (!["allow", "deny", "require_approval"].includes(rule.effect)) errors.push(`invalid policy effect for rule ${rule.id}`);
    }
    return { ok: errors.length === 0, errors };
  }
}
