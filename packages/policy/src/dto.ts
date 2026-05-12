import type { PolicyDecision, PolicyDecisionAuditEntry, PolicyRule } from "./types.ts";

export function policyDecisionToDto(decision: PolicyDecision) {
  return {
    ...decision,
    createdAt: decision.createdAt.toISOString()
  };
}

export function policyRuleToDto(rule: PolicyRule) {
  return structuredClone(rule);
}

export function policyDecisionAuditEntryToDto(entry: PolicyDecisionAuditEntry) {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString()
  };
}
