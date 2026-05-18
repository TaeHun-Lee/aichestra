import { StaticPolicyEngine } from "./engine.ts";
import { policyRuntimeGoldenCases, type PolicyRuntimeGoldenCase } from "./golden-cases.ts";
import { normalizePolicyRuntimeGoldenCase, policyDecisionToGoldenEffect } from "./golden-harness.ts";
import type {
  PolicyAction,
  PolicyContext,
  PolicyDecision,
  PolicyEvaluationRequest,
  PolicyResource,
  PolicySubject
} from "./types.ts";

export type PolicyShadowEvaluationStatus =
  | "disabled"
  | "skipped"
  | "compared_mock"
  | "mismatch_detected"
  | "error";

export type PolicyShadowRuntimeName = "StaticPolicyEngine";
export type PolicyShadowCandidateRuntimeKind =
  | "disabled"
  | "mock"
  | "signed_json_yaml_bundle_future"
  | "opa_rego_future"
  | "cedar_future"
  | "custom_future";

export type PolicyShadowDecisionEffect = "allow" | "deny" | "block" | "warn" | "not_applicable";
export type PolicyShadowMismatchSeverity = "info" | "low" | "medium" | "high" | "critical";
export type PolicyShadowMismatchDefaultAction = "record_only" | "block_rollout_future";
export type PolicyShadowMismatchKind =
  | "static_allow_candidate_deny"
  | "static_deny_candidate_allow"
  | "static_block_candidate_allow"
  | "reason_mismatch"
  | "rule_id_mismatch"
  | "missing_obligation"
  | "extra_obligation"
  | "redaction_mismatch"
  | "audit_metadata_mismatch"
  | "error_in_candidate";

export type PolicyShadowCandidateDecision = {
  effect: PolicyShadowDecisionEffect;
  reason: string;
  ruleIds?: string[];
  obligations?: string[];
  redactionRequirements?: string[];
  auditMetadata?: Record<string, unknown>;
  error?: string;
  metadata?: Record<string, unknown>;
};

export type PolicyShadowEvaluationInput = {
  caseId?: string;
  domain: string;
  action: PolicyAction;
  subject: PolicySubject;
  resource: PolicyResource;
  environment: Record<string, unknown>;
  context: Omit<Partial<PolicyContext>, "environment" | "metadata"> & {
    metadata?: Record<string, unknown>;
  };
  candidateDecision?: PolicyShadowCandidateDecision;
  metadata?: Record<string, unknown>;
};

export type PolicyShadowComparison = {
  effectMatches: boolean;
  reasonMatches: boolean;
  ruleIdMatches: boolean;
  obligationsMatch: boolean;
  redactionMatches: boolean;
  auditMetadataMatches: boolean;
  summary: string;
};

export type PolicyShadowMismatchRecord = {
  mismatchKind: PolicyShadowMismatchKind;
  severity: PolicyShadowMismatchSeverity;
  domain: string;
  action: PolicyAction;
  staticEffect: PolicyShadowDecisionEffect;
  candidateEffect?: PolicyShadowDecisionEffect;
  reason: string;
  defaultAction: PolicyShadowMismatchDefaultAction;
  metadata: Record<string, unknown>;
};

export type PolicyShadowMismatchTypeDescriptor = {
  mismatchKind: PolicyShadowMismatchKind;
  severity: PolicyShadowMismatchSeverity;
  defaultAction: PolicyShadowMismatchDefaultAction;
  description: string;
  metadata: Record<string, unknown>;
};

export type PolicyShadowEvaluationResult = {
  id: string;
  status: PolicyShadowEvaluationStatus;
  sourceOfTruthRuntime: PolicyShadowRuntimeName;
  candidateRuntimeKind: PolicyShadowCandidateRuntimeKind;
  enforcementChanged: false;
  staticDecision: PolicyDecision;
  candidateDecision?: PolicyShadowCandidateDecision;
  comparison: PolicyShadowComparison;
  mismatches: PolicyShadowMismatchRecord[];
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type PolicyShadowEvaluatorStatus = {
  enabled: false;
  running: false;
  candidateRuntimeImplemented: false;
  enforcementChanged: false;
  sourceOfTruth: PolicyShadowRuntimeName;
  metadata: Record<string, unknown>;
};

export type PolicyShadowEvaluationSummary = {
  totalResults: number;
  disabledResults: number;
  skippedResults: number;
  comparedMockResults: number;
  mismatchResults: number;
  errorResults: number;
  mismatchCount: number;
  criticalMismatchCount: number;
  domainsCovered: string[];
  goldenCaseCount: number;
  mockComparisonSupported: boolean;
  shadowEvaluatorEnabled: false;
  running: false;
  candidateRuntimeImplemented: false;
  enforcementChanged: false;
  staticPolicyEngineAuthoritative: true;
  sourceOfTruth: PolicyShadowRuntimeName;
  noDynamicPolicyExecution: true;
  externalPolicyServiceCallsEnabled: false;
  opaRuntimeExecuted: false;
  cedarRuntimeExecuted: false;
  signedBundleRuntimeExecuted: false;
  noSecretsExposed: true;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type PolicyShadowGoldenFixtureReport = {
  id: string;
  goldenCaseCount: number;
  domainsCovered: string[];
  mockComparisonSupported: boolean;
  shadowEvaluatorEnabled: false;
  enforcementChanged: false;
  sourceOfTruth: PolicyShadowRuntimeName;
  candidateRuntimeImplemented: false;
  staticPolicyEngineAuthoritative: true;
  noDynamicPolicyExecution: true;
  auditEvents: string[];
  metadata: Record<string, unknown>;
};

export type PolicyShadowEvaluator = {
  getStatus(): PolicyShadowEvaluatorStatus;
  evaluateShadow(input: PolicyShadowEvaluationInput): PolicyShadowEvaluationResult;
  compareDecisions(
    staticDecision: PolicyDecision,
    candidateDecision: PolicyShadowCandidateDecision | undefined,
    context: { domain: string; action: PolicyAction; metadata?: Record<string, unknown> }
  ): { comparison: PolicyShadowComparison; mismatches: PolicyShadowMismatchRecord[] };
  summarizeResults(results: PolicyShadowEvaluationResult[]): PolicyShadowEvaluationSummary;
};

export type PolicyShadowEvaluatorInput = {
  now?: () => Date;
  engine?: StaticPolicyEngine;
};

export const policyShadowEvaluatorMismatchTypes: PolicyShadowMismatchTypeDescriptor[] = [
  {
    mismatchKind: "static_allow_candidate_deny",
    severity: "medium",
    defaultAction: "record_only",
    description: "StaticPolicyEngine allows an operation but the mock candidate would deny it.",
    metadata: { rolloutImpact: "review_before_rollout", enforcementChanged: false }
  },
  {
    mismatchKind: "static_deny_candidate_allow",
    severity: "critical",
    defaultAction: "block_rollout_future",
    description: "StaticPolicyEngine denies an operation but the mock candidate would allow it.",
    metadata: { rolloutImpact: "block_rollout", enforcementChanged: false }
  },
  {
    mismatchKind: "static_block_candidate_allow",
    severity: "critical",
    defaultAction: "block_rollout_future",
    description: "StaticPolicyEngine requires approval or blocks a future action but the mock candidate would allow it.",
    metadata: { rolloutImpact: "block_rollout", enforcementChanged: false }
  },
  {
    mismatchKind: "reason_mismatch",
    severity: "low",
    defaultAction: "record_only",
    description: "Static and candidate effects match, but the candidate reason differs.",
    metadata: { rolloutImpact: "review_before_alerting", enforcementChanged: false }
  },
  {
    mismatchKind: "rule_id_mismatch",
    severity: "medium",
    defaultAction: "record_only",
    description: "Static and candidate rule identifiers differ.",
    metadata: { rolloutImpact: "audit_review", enforcementChanged: false }
  },
  {
    mismatchKind: "missing_obligation",
    severity: "high",
    defaultAction: "block_rollout_future",
    description: "The mock candidate omitted a static obligation.",
    metadata: { rolloutImpact: "block_rollout", enforcementChanged: false }
  },
  {
    mismatchKind: "extra_obligation",
    severity: "low",
    defaultAction: "record_only",
    description: "The mock candidate added an obligation not present in the static decision.",
    metadata: { rolloutImpact: "review_required", enforcementChanged: false }
  },
  {
    mismatchKind: "redaction_mismatch",
    severity: "critical",
    defaultAction: "block_rollout_future",
    description: "The mock candidate redaction requirements differ from the static decision.",
    metadata: { rolloutImpact: "block_rollout", enforcementChanged: false }
  },
  {
    mismatchKind: "audit_metadata_mismatch",
    severity: "medium",
    defaultAction: "record_only",
    description: "The mock candidate omitted required static audit metadata.",
    metadata: { rolloutImpact: "audit_review", enforcementChanged: false }
  },
  {
    mismatchKind: "error_in_candidate",
    severity: "high",
    defaultAction: "block_rollout_future",
    description: "The mock candidate returned an error shape while the static decision succeeded.",
    metadata: { rolloutImpact: "block_rollout", enforcementChanged: false }
  }
];

function baseStatus(metadata: Record<string, unknown> = {}): PolicyShadowEvaluatorStatus {
  return {
    enabled: false,
    running: false,
    candidateRuntimeImplemented: false,
    enforcementChanged: false,
    sourceOfTruth: "StaticPolicyEngine",
    metadata: sanitizeMetadata({
      ...metadata,
      defaultEvaluator: "disabled",
      dynamicPolicyExecutionEnabled: false,
      externalPolicyServiceCallsEnabled: false,
      policyCodeExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    })
  };
}

export class DisabledPolicyShadowEvaluator implements PolicyShadowEvaluator {
  private readonly now: () => Date;
  private readonly engine: StaticPolicyEngine;

  constructor(input: PolicyShadowEvaluatorInput = {}) {
    this.now = input.now ?? (() => new Date());
    this.engine = input.engine ?? new StaticPolicyEngine();
  }

  getStatus(): PolicyShadowEvaluatorStatus {
    return baseStatus({ evaluatorKind: "disabled" });
  }

  evaluateShadow(input: PolicyShadowEvaluationInput): PolicyShadowEvaluationResult {
    const staticDecision = this.engine.evaluate(toPolicyEvaluationRequest(input));
    const comparison = noCandidateComparison();
    return {
      id: shadowResultId(input.caseId ?? input.domain, input.action, "disabled"),
      status: "disabled",
      sourceOfTruthRuntime: "StaticPolicyEngine",
      candidateRuntimeKind: "disabled",
      enforcementChanged: false,
      staticDecision,
      comparison,
      mismatches: [],
      createdAt: this.now(),
      metadata: sanitizeMetadata({
        ...(input.metadata ?? {}),
        domain: input.domain,
        evaluatorEnabled: false,
        candidateRuntimeImplemented: false,
        candidateRuntimeExecuted: false,
        enforcementChanged: false,
        skippedReason: "policy_shadow_evaluator_disabled",
        noDynamicPolicyExecution: true,
        noExternalPolicyServiceCalls: true
      })
    };
  }

  compareDecisions(
    staticDecision: PolicyDecision,
    candidateDecision: PolicyShadowCandidateDecision | undefined,
    context: { domain: string; action: PolicyAction; metadata?: Record<string, unknown> }
  ): { comparison: PolicyShadowComparison; mismatches: PolicyShadowMismatchRecord[] } {
    if (!candidateDecision) return { comparison: noCandidateComparison(), mismatches: [] };
    return compareShadowDecisions(staticDecision, candidateDecision, context);
  }

  summarizeResults(results: PolicyShadowEvaluationResult[]): PolicyShadowEvaluationSummary {
    return summarizeShadowResults(results);
  }
}

export type MockPolicyShadowEvaluatorInput = PolicyShadowEvaluatorInput & {
  candidateDecisions?: Record<string, PolicyShadowCandidateDecision>;
};

export class MockPolicyShadowEvaluator implements PolicyShadowEvaluator {
  private readonly now: () => Date;
  private readonly engine: StaticPolicyEngine;
  private readonly candidateDecisions: Record<string, PolicyShadowCandidateDecision>;

  constructor(input: MockPolicyShadowEvaluatorInput = {}) {
    this.now = input.now ?? (() => new Date());
    this.engine = input.engine ?? new StaticPolicyEngine();
    this.candidateDecisions = { ...(input.candidateDecisions ?? {}) };
  }

  getStatus(): PolicyShadowEvaluatorStatus {
    return baseStatus({
      evaluatorKind: "mock",
      mockComparisonSupported: true,
      enabledForProduction: false
    });
  }

  evaluateShadow(input: PolicyShadowEvaluationInput): PolicyShadowEvaluationResult {
    const staticDecision = this.engine.evaluate(toPolicyEvaluationRequest(input));
    const candidateDecision = input.candidateDecision ?? (input.caseId ? this.candidateDecisions[input.caseId] : undefined);
    if (!candidateDecision) {
      return {
        id: shadowResultId(input.caseId ?? input.domain, input.action, "skipped"),
        status: "skipped",
        sourceOfTruthRuntime: "StaticPolicyEngine",
        candidateRuntimeKind: "mock",
        enforcementChanged: false,
        staticDecision,
        comparison: noCandidateComparison(),
        mismatches: [],
        createdAt: this.now(),
        metadata: sanitizeMetadata({
          ...(input.metadata ?? {}),
          domain: input.domain,
          mockComparisonSupported: true,
          candidateRuntimeImplemented: false,
          candidateRuntimeExecuted: false,
          skippedReason: "mock_candidate_decision_not_supplied"
        })
      };
    }

    const { comparison, mismatches } = compareShadowDecisions(staticDecision, candidateDecision, {
      domain: input.domain,
      action: input.action,
      metadata: input.metadata
    });
    return {
      id: shadowResultId(input.caseId ?? input.domain, input.action, mismatches.length > 0 ? "mismatch" : "mock"),
      status: candidateDecision.error ? "error" : mismatches.length > 0 ? "mismatch_detected" : "compared_mock",
      sourceOfTruthRuntime: "StaticPolicyEngine",
      candidateRuntimeKind: "mock",
      enforcementChanged: false,
      staticDecision,
      candidateDecision: sanitizeCandidateDecision(candidateDecision),
      comparison,
      mismatches,
      createdAt: this.now(),
      metadata: sanitizeMetadata({
        ...(input.metadata ?? {}),
        domain: input.domain,
        mockComparisonSupported: true,
        candidateRuntimeImplemented: false,
        candidateRuntimeExecuted: false,
        enforcementChanged: false,
        noDynamicPolicyExecution: true
      })
    };
  }

  compareDecisions(
    staticDecision: PolicyDecision,
    candidateDecision: PolicyShadowCandidateDecision | undefined,
    context: { domain: string; action: PolicyAction; metadata?: Record<string, unknown> }
  ): { comparison: PolicyShadowComparison; mismatches: PolicyShadowMismatchRecord[] } {
    if (!candidateDecision) return { comparison: noCandidateComparison(), mismatches: [] };
    return compareShadowDecisions(staticDecision, candidateDecision, context);
  }

  summarizeResults(results: PolicyShadowEvaluationResult[]): PolicyShadowEvaluationSummary {
    return summarizeShadowResults(results);
  }
}

export function createDisabledPolicyShadowEvaluator(input: PolicyShadowEvaluatorInput = {}): DisabledPolicyShadowEvaluator {
  return new DisabledPolicyShadowEvaluator(input);
}

export function createMockPolicyShadowEvaluator(input: MockPolicyShadowEvaluatorInput = {}): MockPolicyShadowEvaluator {
  return new MockPolicyShadowEvaluator(input);
}

export function createPolicyShadowGoldenFixtureReport(cases: PolicyRuntimeGoldenCase[] = policyRuntimeGoldenCases): PolicyShadowGoldenFixtureReport {
  return {
    id: "policy_shadow_evaluator_golden_fixture_report_v1",
    goldenCaseCount: cases.length,
    domainsCovered: sortedUnique(cases.map((goldenCase) => goldenCase.domain)),
    mockComparisonSupported: true,
    shadowEvaluatorEnabled: false,
    enforcementChanged: false,
    sourceOfTruth: "StaticPolicyEngine",
    candidateRuntimeImplemented: false,
    staticPolicyEngineAuthoritative: true,
    noDynamicPolicyExecution: true,
    auditEvents: [
      "policy_shadow_evaluator_status_checked",
      "policy_shadow_evaluation_skipped",
      "policy_shadow_mock_comparison_recorded",
      "policy_shadow_mismatch_recorded_mock"
    ],
    metadata: sanitizeMetadata({
      goldenHarnessSource: "Policy Runtime PoC Golden Test Harness v1",
      candidateRuntimeExecuted: false,
      externalPolicyServiceCallsEnabled: false,
      opaRuntimeExecuted: false,
      cedarRuntimeExecuted: false,
      signedBundleRuntimeExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    })
  };
}

export function policyRuntimeGoldenCaseToShadowInput(goldenCase: PolicyRuntimeGoldenCase): PolicyShadowEvaluationInput {
  return {
    caseId: goldenCase.id,
    domain: goldenCase.domain,
    action: goldenCase.action,
    subject: structuredClone(goldenCase.subject),
    resource: structuredClone(goldenCase.resource),
    environment: structuredClone(goldenCase.environment),
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
      metadata: structuredClone(goldenCase.context.metadata)
    },
    metadata: {
      goldenCase: true,
      expectedEffect: goldenCase.expectedDecision.effect,
      riskLevel: goldenCase.riskLevel
    }
  };
}

export function goldenCaseExpectedDecisionToMockCandidate(goldenCase: PolicyRuntimeGoldenCase): PolicyShadowCandidateDecision {
  return {
    effect: goldenCase.expectedDecision.effect,
    reason: goldenCase.expectedDecision.reason,
    ruleIds: goldenCase.expectedDecision.ruleId ? [goldenCase.expectedDecision.ruleId] : [],
    obligations: [],
    redactionRequirements: [],
    auditMetadata: {
      action: goldenCase.action,
      resourceKind: goldenCase.resource.resourceKind,
      actorId: goldenCase.subject.actorId,
      requestId: goldenCase.subject.requestId,
      correlationId: goldenCase.subject.correlationId,
      serviceAccountId: goldenCase.subject.serviceAccountId,
      caseId: goldenCase.id,
      domain: goldenCase.domain,
      sourceOfTruth: "StaticPolicyEngine"
    },
    metadata: {
      mockCandidateFromGoldenExpectation: true,
      candidateRuntimeImplemented: false
    }
  };
}

function toPolicyEvaluationRequest(input: PolicyShadowEvaluationInput): PolicyEvaluationRequest {
  return {
    subject: structuredClone(input.subject),
    action: input.action,
    resource: structuredClone(input.resource),
    context: {
      taskId: input.context.taskId,
      taskRunId: input.context.taskRunId,
      repoId: input.context.repoId,
      branchName: input.context.branchName,
      modelId: input.context.modelId,
      providerKind: input.context.providerKind,
      runnerKind: input.context.runnerKind,
      command: input.context.command,
      riskScore: input.context.riskScore,
      skillRefs: input.context.skillRefs,
      harnessRef: input.context.harnessRef,
      instructionRefs: input.context.instructionRefs,
      environment: structuredClone(input.environment),
      metadata: structuredClone(input.context.metadata ?? {})
    }
  };
}

function noCandidateComparison(): PolicyShadowComparison {
  return {
    effectMatches: true,
    reasonMatches: true,
    ruleIdMatches: true,
    obligationsMatch: true,
    redactionMatches: true,
    auditMetadataMatches: true,
    summary: "candidate_runtime_not_executed"
  };
}

function compareShadowDecisions(
  staticDecision: PolicyDecision,
  candidateDecision: PolicyShadowCandidateDecision,
  context: { domain: string; action: PolicyAction; metadata?: Record<string, unknown> }
): { comparison: PolicyShadowComparison; mismatches: PolicyShadowMismatchRecord[] } {
  const staticEffect = staticEffectFromDecision(staticDecision);
  const candidateEffect = candidateDecision.effect;
  const staticRuleIds = staticDecision.matchedRuleIds;
  const candidateRuleIds = candidateDecision.ruleIds ?? [];
  const staticObligations = stringArrayFromMetadata(staticDecision.context.metadata.staticObligations);
  const candidateObligations = candidateDecision.obligations ?? [];
  const staticRedactions = stringArrayFromMetadata(staticDecision.context.metadata.redactionRequirements);
  const candidateRedactions = candidateDecision.redactionRequirements ?? [];
  const staticAuditMetadata = auditMetadataFor(staticDecision);
  const candidateAuditMetadata = sanitizeMetadata(candidateDecision.auditMetadata ?? {});

  const comparison: PolicyShadowComparison = {
    effectMatches: staticEffect === candidateEffect,
    reasonMatches: staticDecision.reason === candidateDecision.reason,
    ruleIdMatches: sameStringSet(staticRuleIds, candidateRuleIds),
    obligationsMatch: sameStringSet(staticObligations, candidateObligations),
    redactionMatches: sameStringSet(staticRedactions, candidateRedactions),
    auditMetadataMatches: requiredAuditFieldsMatch(staticAuditMetadata, candidateAuditMetadata),
    summary: "static_policy_engine_compared_to_mock_candidate_shape"
  };

  const mismatches: PolicyShadowMismatchRecord[] = [];
  if (candidateDecision.error) {
    mismatches.push(mismatch("error_in_candidate", "high", "block_rollout_future", context, staticEffect, candidateEffect, `candidate_error:${candidateDecision.error}`, candidateDecision.metadata));
  }
  if (!comparison.effectMatches) {
    mismatches.push(effectMismatch(context, staticEffect, candidateEffect));
  }
  if (!comparison.reasonMatches) {
    mismatches.push(mismatch("reason_mismatch", "low", "record_only", context, staticEffect, candidateEffect, "static_and_candidate_reasons_differ", {
      staticReason: staticDecision.reason,
      candidateReason: candidateDecision.reason
    }));
  }
  if (!comparison.ruleIdMatches) {
    mismatches.push(mismatch("rule_id_mismatch", "medium", "record_only", context, staticEffect, candidateEffect, "static_and_candidate_rule_ids_differ", {
      staticRuleIds,
      candidateRuleIds
    }));
  }
  const missingObligations = staticObligations.filter((entry) => !candidateObligations.includes(entry));
  const extraObligations = candidateObligations.filter((entry) => !staticObligations.includes(entry));
  if (missingObligations.length > 0) {
    mismatches.push(mismatch("missing_obligation", "high", "block_rollout_future", context, staticEffect, candidateEffect, "candidate_missing_static_obligations", { missingObligations }));
  }
  if (extraObligations.length > 0) {
    mismatches.push(mismatch("extra_obligation", "low", "record_only", context, staticEffect, candidateEffect, "candidate_added_extra_obligations", { extraObligations }));
  }
  if (!comparison.redactionMatches) {
    mismatches.push(mismatch("redaction_mismatch", "critical", "block_rollout_future", context, staticEffect, candidateEffect, "candidate_redaction_requirements_differ", {
      staticRedactions,
      candidateRedactions
    }));
  }
  if (!comparison.auditMetadataMatches) {
    mismatches.push(mismatch("audit_metadata_mismatch", "medium", "record_only", context, staticEffect, candidateEffect, "candidate_audit_metadata_missing_required_static_fields", {
      requiredFields: Object.keys(staticAuditMetadata)
    }));
  }

  return {
    comparison: {
      ...comparison,
      summary: mismatches.length === 0 ? "all_mock_comparison_dimensions_match" : "mock_comparison_mismatches_recorded"
    },
    mismatches: uniqueMismatches(mismatches)
  };
}

function effectMismatch(
  context: { domain: string; action: PolicyAction; metadata?: Record<string, unknown> },
  staticEffect: PolicyShadowDecisionEffect,
  candidateEffect: PolicyShadowDecisionEffect
): PolicyShadowMismatchRecord {
  if (staticEffect === "allow" && candidateEffect !== "allow") {
    return mismatch("static_allow_candidate_deny", "medium", "record_only", context, staticEffect, candidateEffect, "candidate_denies_static_allow");
  }
  if (staticEffect === "block" && candidateEffect === "allow") {
    return mismatch("static_block_candidate_allow", "critical", "block_rollout_future", context, staticEffect, candidateEffect, "candidate_allows_static_block");
  }
  if (staticEffect === "deny" && candidateEffect === "allow") {
    return mismatch("static_deny_candidate_allow", "critical", "block_rollout_future", context, staticEffect, candidateEffect, "candidate_allows_static_deny");
  }
  return mismatch("static_deny_candidate_allow", "high", "block_rollout_future", context, staticEffect, candidateEffect, "candidate_effect_differs_from_static");
}

function mismatch(
  mismatchKind: PolicyShadowMismatchKind,
  severity: PolicyShadowMismatchSeverity,
  defaultAction: PolicyShadowMismatchDefaultAction,
  context: { domain: string; action: PolicyAction; metadata?: Record<string, unknown> },
  staticEffect: PolicyShadowDecisionEffect,
  candidateEffect: PolicyShadowDecisionEffect | undefined,
  reason: string,
  metadata: Record<string, unknown> = {}
): PolicyShadowMismatchRecord {
  return {
    mismatchKind,
    severity,
    domain: context.domain,
    action: context.action,
    staticEffect,
    candidateEffect,
    reason,
    defaultAction,
    metadata: sanitizeMetadata({
      ...(context.metadata ?? {}),
      ...metadata,
      enforcementChanged: false
    })
  };
}

function summarizeShadowResults(results: PolicyShadowEvaluationResult[]): PolicyShadowEvaluationSummary {
  const mismatches = results.flatMap((result) => result.mismatches);
  const domainsCovered = sortedUnique(results.map((result) => String(result.metadata.domain ?? result.staticDecision.resource.resourceKind)));
  return {
    totalResults: results.length,
    disabledResults: results.filter((result) => result.status === "disabled").length,
    skippedResults: results.filter((result) => result.status === "skipped").length,
    comparedMockResults: results.filter((result) => result.status === "compared_mock").length,
    mismatchResults: results.filter((result) => result.status === "mismatch_detected").length,
    errorResults: results.filter((result) => result.status === "error").length,
    mismatchCount: mismatches.length,
    criticalMismatchCount: mismatches.filter((entry) => entry.severity === "critical").length,
    domainsCovered,
    goldenCaseCount: policyRuntimeGoldenCases.length,
    mockComparisonSupported: true,
    shadowEvaluatorEnabled: false,
    running: false,
    candidateRuntimeImplemented: false,
    enforcementChanged: false,
    staticPolicyEngineAuthoritative: true,
    sourceOfTruth: "StaticPolicyEngine",
    noDynamicPolicyExecution: true,
    externalPolicyServiceCallsEnabled: false,
    opaRuntimeExecuted: false,
    cedarRuntimeExecuted: false,
    signedBundleRuntimeExecuted: false,
    noSecretsExposed: true,
    envValuesExposed: false,
    metadata: sanitizeMetadata({
      defaultRuntime: "DisabledPolicyShadowEvaluator",
      resultsAreRecordOnly: true,
      policyCodeExecuted: false,
      candidateRuntimeExecuted: false
    })
  };
}

function staticEffectFromDecision(decision: PolicyDecision): PolicyShadowDecisionEffect {
  const goldenEffect = policyDecisionToGoldenEffect(decision);
  if (goldenEffect === "allow" || goldenEffect === "deny" || goldenEffect === "block" || goldenEffect === "warn") return goldenEffect;
  return decision.decision === "not_applicable" ? "not_applicable" : "deny";
}

function auditMetadataFor(decision: PolicyDecision): Record<string, unknown> {
  return sanitizeMetadata({
    action: decision.action,
    resourceKind: decision.resource.resourceKind,
    actorId: decision.subject.actorId,
    requestId: decision.subject.requestId,
    correlationId: decision.subject.correlationId,
    serviceAccountId: decision.subject.serviceAccountId
  });
}

function requiredAuditFieldsMatch(staticAudit: Record<string, unknown>, candidateAudit: Record<string, unknown>): boolean {
  return Object.entries(staticAudit)
    .filter(([, value]) => value !== undefined)
    .every(([key, value]) => candidateAudit[key] === value);
}

function stringArrayFromMetadata(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

function sameStringSet(left: string[], right: string[]): boolean {
  const leftSorted = [...new Set(left)].sort();
  const rightSorted = [...new Set(right)].sort();
  return leftSorted.length === rightSorted.length && leftSorted.every((entry, index) => entry === rightSorted[index]);
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueMismatches(values: PolicyShadowMismatchRecord[]): PolicyShadowMismatchRecord[] {
  const byKind = new Map<string, PolicyShadowMismatchRecord>();
  for (const value of values) byKind.set(value.mismatchKind, value);
  return [...byKind.values()];
}

function sanitizeCandidateDecision(candidateDecision: PolicyShadowCandidateDecision): PolicyShadowCandidateDecision {
  return {
    ...candidateDecision,
    ruleIds: candidateDecision.ruleIds ? [...candidateDecision.ruleIds] : undefined,
    obligations: candidateDecision.obligations ? [...candidateDecision.obligations] : undefined,
    redactionRequirements: candidateDecision.redactionRequirements ? [...candidateDecision.redactionRequirements] : undefined,
    auditMetadata: candidateDecision.auditMetadata ? sanitizeMetadata(candidateDecision.auditMetadata) : undefined,
    metadata: candidateDecision.metadata ? sanitizeMetadata(candidateDecision.metadata) : undefined
  };
}

function sanitizeMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (/token|secret|password|cookie|credential|session|apiKey|api_key|authorization|privateKey|private_key|databaseUrl|database_url|connectionString|vault|envValue|rawPrompt|rawResponse|webhook/i.test(key)) {
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

function shadowResultId(caseOrDomain: string, action: PolicyAction, suffix: string): string {
  return `policy_shadow_${caseOrDomain}_${action}_${suffix}`.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
}

export function runPolicyShadowGoldenMockReport(input: {
  cases?: PolicyRuntimeGoldenCase[];
  evaluator?: MockPolicyShadowEvaluator;
} = {}): { fixtureReport: PolicyShadowGoldenFixtureReport; results: PolicyShadowEvaluationResult[]; summary: PolicyShadowEvaluationSummary } {
  const cases = input.cases ?? policyRuntimeGoldenCases;
  const evaluator = input.evaluator ?? new MockPolicyShadowEvaluator();
  const results = cases.map((goldenCase) => evaluator.evaluateShadow({
    ...policyRuntimeGoldenCaseToShadowInput(goldenCase),
    candidateDecision: goldenCaseExpectedDecisionToMockCandidate(goldenCase)
  }));
  return {
    fixtureReport: createPolicyShadowGoldenFixtureReport(cases),
    results,
    summary: evaluator.summarizeResults(results)
  };
}

export function normalizeGoldenCaseForShadow(goldenCase: PolicyRuntimeGoldenCase): PolicyEvaluationRequest {
  return normalizePolicyRuntimeGoldenCase(goldenCase);
}
