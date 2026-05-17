import { StaticPolicyEngine } from "./engine.ts";
import { policyRuntimeGoldenCases, type PolicyRuntimeGoldenCase, type PolicyRuntimeGoldenEffect } from "./golden-cases.ts";
import type { PolicyDecision, PolicyEngine, PolicyEvaluationRequest } from "./types.ts";

export type PolicyRuntimeGoldenCaseResult = {
  id: string;
  domain: string;
  action: string;
  passed: boolean;
  expectedEffect: PolicyRuntimeGoldenEffect;
  actualEffect: PolicyRuntimeGoldenEffect;
  expectedReason: string;
  actualReason: string;
  expectedRuleId?: string;
  actualRuleId?: string;
  mismatches: string[];
};

export type PolicyRuntimeGoldenHarnessSummary = {
  status: "pass" | "fail";
  sourceOfTruth: "StaticPolicyEngine";
  totalCases: number;
  passedCases: number;
  failedCases: number;
  domainCount: number;
  domainsCovered: string[];
  expectedAllowCases: number;
  expectedDenyCases: number;
  expectedBlockCases: number;
  expectedWarnCases: number;
  staticPolicyEngineOnly: true;
  dynamicPolicyExecutionEnabled: false;
  opaRuntimeExecuted: false;
  cedarRuntimeExecuted: false;
  signedBundleRuntimeExecuted: false;
  externalPolicyServiceCallsEnabled: false;
  remotePolicyLoadingEnabled: false;
  hotReloadEnabled: false;
  secretsInFixtures: false;
  envValuesExposed: false;
};

export type PolicyRuntimeGoldenHarnessReport = {
  summary: PolicyRuntimeGoldenHarnessSummary;
  results: PolicyRuntimeGoldenCaseResult[];
};

export function policyDecisionToGoldenEffect(decision: PolicyDecision): PolicyRuntimeGoldenEffect {
  if (decision.decision === "allow") return "allow";
  if (decision.decision === "require_approval") return "block";
  if (decision.decision === "not_applicable") return "warn";
  return "deny";
}

export function normalizePolicyRuntimeGoldenCase(goldenCase: PolicyRuntimeGoldenCase): PolicyEvaluationRequest {
  return {
    subject: structuredClone(goldenCase.subject),
    action: goldenCase.action,
    resource: structuredClone(goldenCase.resource),
    context: {
      taskId: goldenCase.context.taskId,
      taskRunId: goldenCase.context.taskRunId,
      repoId: goldenCase.context.repoId,
      branchName: goldenCase.context.branchName,
      modelId: goldenCase.context.modelId,
      providerKind: goldenCase.context.providerKind,
      runnerKind: goldenCase.context.runnerKind,
      command: goldenCase.context.command,
      riskScore: goldenCase.context.riskScore,
      environment: structuredClone(goldenCase.environment),
      metadata: structuredClone(goldenCase.context.metadata)
    }
  };
}

function compareCase(goldenCase: PolicyRuntimeGoldenCase, decision: PolicyDecision): PolicyRuntimeGoldenCaseResult {
  const actualEffect = policyDecisionToGoldenEffect(decision);
  const actualRuleId = decision.matchedRuleIds[0];
  const mismatches: string[] = [];

  if (actualEffect !== goldenCase.expectedDecision.effect) {
    mismatches.push(`effect expected ${goldenCase.expectedDecision.effect} but received ${actualEffect}`);
  }
  if (decision.reason !== goldenCase.expectedDecision.reason) {
    mismatches.push(`reason expected ${JSON.stringify(goldenCase.expectedDecision.reason)} but received ${JSON.stringify(decision.reason)}`);
  }
  if (goldenCase.expectedDecision.ruleId !== undefined && actualRuleId !== goldenCase.expectedDecision.ruleId) {
    mismatches.push(`ruleId expected ${goldenCase.expectedDecision.ruleId} but received ${actualRuleId ?? "none"}`);
  }

  return {
    id: goldenCase.id,
    domain: goldenCase.domain,
    action: goldenCase.action,
    passed: mismatches.length === 0,
    expectedEffect: goldenCase.expectedDecision.effect,
    actualEffect,
    expectedReason: goldenCase.expectedDecision.reason,
    actualReason: decision.reason,
    expectedRuleId: goldenCase.expectedDecision.ruleId,
    actualRuleId,
    mismatches
  };
}

export function runPolicyRuntimeGoldenHarness(input: {
  cases?: PolicyRuntimeGoldenCase[];
  engine?: PolicyEngine;
} = {}): PolicyRuntimeGoldenHarnessReport {
  const cases = input.cases ?? policyRuntimeGoldenCases;
  const engine = input.engine ?? new StaticPolicyEngine();
  const results = cases.map((goldenCase) => compareCase(goldenCase, engine.evaluate(normalizePolicyRuntimeGoldenCase(goldenCase))));
  const failedCases = results.filter((result) => !result.passed).length;
  const domainsCovered = Array.from(new Set(cases.map((goldenCase) => goldenCase.domain))).sort();
  const countByEffect = (effect: PolicyRuntimeGoldenEffect) => cases.filter((goldenCase) => goldenCase.expectedDecision.effect === effect).length;

  return {
    summary: {
      status: failedCases === 0 ? "pass" : "fail",
      sourceOfTruth: "StaticPolicyEngine",
      totalCases: cases.length,
      passedCases: results.length - failedCases,
      failedCases,
      domainCount: domainsCovered.length,
      domainsCovered,
      expectedAllowCases: countByEffect("allow"),
      expectedDenyCases: countByEffect("deny"),
      expectedBlockCases: countByEffect("block"),
      expectedWarnCases: countByEffect("warn"),
      staticPolicyEngineOnly: true,
      dynamicPolicyExecutionEnabled: false,
      opaRuntimeExecuted: false,
      cedarRuntimeExecuted: false,
      signedBundleRuntimeExecuted: false,
      externalPolicyServiceCallsEnabled: false,
      remotePolicyLoadingEnabled: false,
      hotReloadEnabled: false,
      secretsInFixtures: false,
      envValuesExposed: false
    },
    results
  };
}

export function validatePolicyRuntimeGoldenCases(cases: PolicyRuntimeGoldenCase[] = policyRuntimeGoldenCases): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const goldenCase of cases) {
    if (!goldenCase.id) errors.push("golden case id is required");
    if (ids.has(goldenCase.id)) errors.push(`duplicate golden case id: ${goldenCase.id}`);
    ids.add(goldenCase.id);
    if (!goldenCase.description) errors.push(`description is required for ${goldenCase.id}`);
    if (!goldenCase.domain) errors.push(`domain is required for ${goldenCase.id}`);
    if (!goldenCase.action) errors.push(`action is required for ${goldenCase.id}`);
    if (!goldenCase.subject.actorId) errors.push(`subject.actorId is required for ${goldenCase.id}`);
    if (!goldenCase.subject.actorKind) errors.push(`subject.actorKind is required for ${goldenCase.id}`);
    if (!Array.isArray(goldenCase.subject.roles) || goldenCase.subject.roles.length === 0) errors.push(`subject.roles is required for ${goldenCase.id}`);
    if (!goldenCase.resource.resourceKind) errors.push(`resource.resourceKind is required for ${goldenCase.id}`);
    if (!goldenCase.expectedDecision.effect) errors.push(`expectedDecision.effect is required for ${goldenCase.id}`);
    if (!goldenCase.expectedDecision.reason) errors.push(`expectedDecision.reason is required for ${goldenCase.id}`);
    if (!goldenCase.riskLevel) errors.push(`riskLevel is required for ${goldenCase.id}`);
  }
  return { ok: errors.length === 0, errors };
}
