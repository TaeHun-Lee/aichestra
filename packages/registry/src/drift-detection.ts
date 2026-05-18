import { createId } from "@aichestra/core";
import type {
  HarnessPackage,
  InstructionArtifact,
  SkillPackage
} from "@aichestra/core";

export type RegistryDriftTargetKind =
  | "skill"
  | "harness"
  | "instruction"
  | "registry_package"
  | "compatibility_profile";

export type RegistryDriftSignalKind =
  | "failure_rate_increase"
  | "token_cost_increase"
  | "runtime_increase"
  | "eval_status_decline"
  | "compatibility_warning_increase"
  | "manual_override_increase"
  | "rollback_involvement"
  | "conflict_involvement"
  | "stale_instruction"
  | "policy_denial_increase"
  | "provider_model_mismatch"
  | "unknown";

export type RegistryDriftSeverity = "info" | "low" | "medium" | "high" | "critical";

export type RegistryDriftSignalSource =
  | "mock_seed"
  | "usage_ledger"
  | "eval_metadata"
  | "governance_audit"
  | "compatibility_matrix"
  | "observability"
  | "future_external";

export type RegistryDriftBaselineStatus = "active_mock" | "missing" | "stale" | "future";

export type RegistryDriftAssessmentStatus =
  | "no_drift"
  | "watch"
  | "degraded"
  | "critical"
  | "insufficient_data";

export type RegistryDriftRecommendationKind =
  | "monitor"
  | "create_improvement_candidate"
  | "require_eval"
  | "require_canary"
  | "review_instruction"
  | "review_harness"
  | "review_provider_compatibility"
  | "deprecate_future"
  | "rollback_review";

export type RegistryDriftWindow = "7d" | "30d" | "90d" | "all_time" | "future";

export type RegistryDriftSignal = {
  id: string;
  targetKind: RegistryDriftTargetKind;
  targetId: string;
  signalKind: RegistryDriftSignalKind;
  value: number;
  baselineValue: number;
  delta: number;
  window: RegistryDriftWindow;
  severity: RegistryDriftSeverity;
  source: RegistryDriftSignalSource;
  observedAt: Date;
  metadata: Record<string, unknown>;
};

export type RegistryDriftBaseline = {
  id: string;
  targetKind: RegistryDriftTargetKind;
  targetId: string;
  window: RegistryDriftWindow;
  metrics: Record<string, number>;
  establishedAt: Date;
  status: RegistryDriftBaselineStatus;
  metadata: Record<string, unknown>;
};

export type RegistryDriftAssessment = {
  id: string;
  targetKind: RegistryDriftTargetKind;
  targetId: string;
  signalIds: string[];
  driftScore: number;
  severity: RegistryDriftSeverity;
  status: RegistryDriftAssessmentStatus;
  recommendedActions: string[];
  governanceFollowUps: string[];
  window: RegistryDriftWindow;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type RegistryDriftRecommendation = {
  id: string;
  assessmentId: string;
  targetKind: RegistryDriftTargetKind;
  targetId: string;
  recommendationKind: RegistryDriftRecommendationKind;
  priority: "low" | "medium" | "high" | "critical";
  reason: string;
  applyAllowed: false;
  improvementCandidateRef?: string;
  metadata: Record<string, unknown>;
};

export type RegistryDriftSummary = {
  status: "v1_implemented";
  planningOnly: true;
  generatedAt: Date;
  signalCount: number;
  baselineCount: number;
  assessmentCount: number;
  recommendationCount: number;
  noDriftCount: number;
  watchCount: number;
  degradedCount: number;
  criticalCount: number;
  insufficientDataCount: number;
  criticalSignalCount: number;
  highSignalCount: number;
  applyAllowed: false;
  registryMutationExecuted: false;
  evalExecuted: false;
  canaryExecuted: false;
  autoImprovementApplied: false;
  externalCallExecuted: false;
  noSecretsExposed: true;
  envValuesExposed: false;
};

export type RegistryDriftQuery = {
  targetKind?: RegistryDriftTargetKind;
  targetId?: string;
  severity?: RegistryDriftSeverity;
};

export type RegistryDriftAssessQuery = {
  targetKind: RegistryDriftTargetKind;
  targetId: string;
};

export type RegistryDriftServiceContext = {
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type RegistryDriftPolicyAction =
  | "registry.drift.read"
  | "registry.drift.assess"
  | "registry.drift.recommend"
  | "registry.drift.create_candidate_future"
  | "registry.drift.auto_apply_future";

export type RegistryDriftPolicyDecisionSnapshot = {
  decision: "allow" | "deny" | "require_approval" | "not_applicable";
  matchedRuleIds: string[];
  reason: string;
};

export type RegistryDriftPolicyEvaluationInput = {
  action: RegistryDriftPolicyAction;
  context: RegistryDriftServiceContext;
  targetKind?: RegistryDriftTargetKind;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export type RegistryDriftImprovementCandidateRequest = {
  assessmentId: string;
  context: RegistryDriftServiceContext;
};

export type RegistryDriftImprovementCandidateResult = {
  assessmentId: string;
  candidateRef: string;
  applyAllowed: false;
  draftOnly: true;
  metadata: Record<string, unknown>;
};

export type RegistryDriftDataSource = {
  listSkills?: () => SkillPackage[];
  listHarnesses?: () => HarnessPackage[];
  listInstructions?: () => InstructionArtifact[];
};

export type RegistryDriftSignalSeed = Omit<RegistryDriftSignal, "id" | "observedAt"> & {
  id?: string;
  observedAt?: Date;
};

export type RegistryDriftBaselineSeed = Omit<RegistryDriftBaseline, "id" | "establishedAt"> & {
  id?: string;
  establishedAt?: Date;
};

export type RegistryDriftDetectionServiceInput = {
  signals?: RegistryDriftSignalSeed[];
  baselines?: RegistryDriftBaselineSeed[];
  dataSource?: RegistryDriftDataSource;
  policyEvaluator?: (input: RegistryDriftPolicyEvaluationInput) => RegistryDriftPolicyDecisionSnapshot;
  candidateLinker?: (request: RegistryDriftImprovementCandidateRequest) => RegistryDriftImprovementCandidateResult | undefined;
  now?: () => Date;
};

const SIGNAL_WEIGHTS: Record<RegistryDriftSignalKind, number> = {
  failure_rate_increase: 35,
  eval_status_decline: 35,
  rollback_involvement: 20,
  policy_denial_increase: 25,
  compatibility_warning_increase: 15,
  token_cost_increase: 12,
  runtime_increase: 10,
  stale_instruction: 8,
  manual_override_increase: 12,
  conflict_involvement: 12,
  provider_model_mismatch: 10,
  unknown: 5
};

const SEVERITY_MULTIPLIERS: Record<RegistryDriftSeverity, number> = {
  info: 0.5,
  low: 0.8,
  medium: 1.0,
  high: 1.3,
  critical: 1.6
};

const FIXED_SEED_TIMESTAMP = new Date("2026-05-18T00:00:00.000Z");

export const defaultRegistryDriftSignals: RegistryDriftSignalSeed[] = [
  {
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    signalKind: "failure_rate_increase",
    value: 0.18,
    baselineValue: 0.04,
    delta: 0.14,
    window: "30d",
    severity: "high",
    source: "mock_seed",
    metadata: { describesMock: true, sampleCount: 120 }
  },
  {
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    signalKind: "token_cost_increase",
    value: 1.45,
    baselineValue: 1.0,
    delta: 0.45,
    window: "30d",
    severity: "medium",
    source: "mock_seed",
    metadata: { describesMock: true, unit: "ratio" }
  },
  {
    targetKind: "skill",
    targetId: "skill_auth_debugging",
    signalKind: "compatibility_warning_increase",
    value: 6,
    baselineValue: 2,
    delta: 4,
    window: "30d",
    severity: "medium",
    source: "mock_seed",
    metadata: { describesMock: true, compatibilityWarnings: ["language_mismatch", "framework_mismatch"] }
  },
  {
    targetKind: "harness",
    targetId: "harness_backend_node20",
    signalKind: "runtime_increase",
    value: 1.32,
    baselineValue: 1.0,
    delta: 0.32,
    window: "30d",
    severity: "low",
    source: "mock_seed",
    metadata: { describesMock: true, unit: "ratio" }
  },
  {
    targetKind: "harness",
    targetId: "harness_local_git_dry_run",
    signalKind: "policy_denial_increase",
    value: 5,
    baselineValue: 1,
    delta: 4,
    window: "30d",
    severity: "high",
    source: "mock_seed",
    metadata: { describesMock: true, policyAction: "git.merge" }
  },
  {
    targetKind: "instruction",
    targetId: "instr_org_secure_coding_baseline",
    signalKind: "stale_instruction",
    value: 90,
    baselineValue: 30,
    delta: 60,
    window: "90d",
    severity: "medium",
    source: "mock_seed",
    metadata: { describesMock: true, daysSinceLastUpdate: 90 }
  },
  {
    targetKind: "instruction",
    targetId: "instr_conflict_manager_guidance",
    signalKind: "conflict_involvement",
    value: 4,
    baselineValue: 1,
    delta: 3,
    window: "30d",
    severity: "medium",
    source: "mock_seed",
    metadata: { describesMock: true, conflictsObserved: 4 }
  }
];

export const defaultRegistryDriftBaselines: RegistryDriftBaselineSeed[] = [
  {
    targetKind: "skill",
    targetId: "skill_jest_test_fixer",
    window: "30d",
    metrics: { failureRate: 0.04, tokenCostRatio: 1.0, runtimeRatio: 1.0 },
    status: "active_mock",
    metadata: { describesMock: true }
  },
  {
    targetKind: "skill",
    targetId: "skill_auth_debugging",
    window: "30d",
    metrics: { failureRate: 0.05, compatibilityWarnings: 2 },
    status: "active_mock",
    metadata: { describesMock: true }
  },
  {
    targetKind: "skill",
    targetId: "skill_conflict_risk_reviewer",
    window: "30d",
    metrics: { failureRate: 0.03 },
    status: "active_mock",
    metadata: { describesMock: true }
  },
  {
    targetKind: "harness",
    targetId: "harness_backend_node20",
    window: "30d",
    metrics: { runtimeRatio: 1.0, failureRate: 0.05 },
    status: "active_mock",
    metadata: { describesMock: true }
  },
  {
    targetKind: "harness",
    targetId: "harness_frontend_node20",
    window: "30d",
    metrics: { runtimeRatio: 1.0, failureRate: 0.06 },
    status: "active_mock",
    metadata: { describesMock: true }
  },
  {
    targetKind: "harness",
    targetId: "harness_local_git_dry_run",
    window: "30d",
    metrics: { failureRate: 0.02, policyDenialCount: 1 },
    status: "active_mock",
    metadata: { describesMock: true }
  },
  {
    targetKind: "instruction",
    targetId: "instr_org_secure_coding_baseline",
    window: "90d",
    metrics: { daysSinceLastUpdate: 30 },
    status: "active_mock",
    metadata: { describesMock: true }
  },
  {
    targetKind: "instruction",
    targetId: "instr_conflict_manager_guidance",
    window: "30d",
    metrics: { conflictsObserved: 1 },
    status: "active_mock",
    metadata: { describesMock: true }
  }
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function severityFromScore(score: number): RegistryDriftSeverity {
  if (score >= 81) return "critical";
  if (score >= 61) return "high";
  if (score >= 41) return "medium";
  if (score >= 21) return "low";
  return "info";
}

function statusFromScore(score: number, severities: RegistryDriftSeverity[]): RegistryDriftAssessmentStatus {
  if (severities.length === 0) return "insufficient_data";
  if (score >= 81 || severities.includes("critical")) return "critical";
  if (score >= 41) return "degraded";
  if (score >= 21) return "watch";
  return "no_drift";
}

function recommendationsForSignals(target: RegistryDriftAssessQuery, signals: RegistryDriftSignal[]): {
  recommendedActions: string[];
  governanceFollowUps: string[];
  recommendationSpecs: { kind: RegistryDriftRecommendationKind; priority: "low" | "medium" | "high" | "critical"; reason: string }[];
} {
  const recommendedActions = new Set<string>();
  const governanceFollowUps = new Set<string>();
  const recommendationSpecs: { kind: RegistryDriftRecommendationKind; priority: "low" | "medium" | "high" | "critical"; reason: string }[] = [];
  if (signals.length === 0) {
    recommendedActions.add("monitor_target");
    governanceFollowUps.add("revisit_after_more_signals");
    recommendationSpecs.push({ kind: "monitor", priority: "low", reason: "no_signals_collected" });
    return {
      recommendedActions: Array.from(recommendedActions),
      governanceFollowUps: Array.from(governanceFollowUps),
      recommendationSpecs
    };
  }
  for (const signal of signals) {
    const priority: "low" | "medium" | "high" | "critical" = signal.severity === "critical" || signal.severity === "high"
      ? signal.severity
      : signal.severity === "medium" ? "medium" : "low";
    switch (signal.signalKind) {
      case "failure_rate_increase":
        recommendedActions.add("review_failure_signals");
        governanceFollowUps.add("attach_eval_requirement");
        recommendationSpecs.push({ kind: "require_eval", priority, reason: "failure_rate_increase" });
        if (target.targetKind === "skill") {
          recommendationSpecs.push({ kind: "create_improvement_candidate", priority, reason: "failure_rate_increase" });
        }
        break;
      case "eval_status_decline":
        recommendedActions.add("rerun_eval");
        governanceFollowUps.add("attach_eval_requirement");
        recommendationSpecs.push({ kind: "require_eval", priority, reason: "eval_status_decline" });
        break;
      case "rollback_involvement":
        recommendedActions.add("review_rollback_history");
        governanceFollowUps.add("request_rollback_review");
        recommendationSpecs.push({ kind: "rollback_review", priority, reason: "rollback_involvement" });
        break;
      case "policy_denial_increase":
        recommendedActions.add("review_policy_denials");
        governanceFollowUps.add("attach_policy_review");
        recommendationSpecs.push({
          kind: target.targetKind === "harness" ? "review_harness" : "review_provider_compatibility",
          priority,
          reason: "policy_denial_increase"
        });
        break;
      case "compatibility_warning_increase":
        recommendedActions.add("review_compatibility_matrix");
        governanceFollowUps.add("attach_compatibility_review");
        recommendationSpecs.push({ kind: "review_provider_compatibility", priority, reason: "compatibility_warning_increase" });
        break;
      case "token_cost_increase":
        recommendedActions.add("review_token_cost_ledger");
        governanceFollowUps.add("attach_cost_review");
        recommendationSpecs.push({ kind: "require_canary", priority, reason: "token_cost_increase" });
        break;
      case "runtime_increase":
        recommendedActions.add("review_runtime_metrics");
        governanceFollowUps.add("attach_runtime_review");
        recommendationSpecs.push({
          kind: target.targetKind === "harness" ? "review_harness" : "require_canary",
          priority,
          reason: "runtime_increase"
        });
        break;
      case "stale_instruction":
        recommendedActions.add("refresh_instruction_metadata");
        governanceFollowUps.add("attach_instruction_review");
        recommendationSpecs.push({ kind: "review_instruction", priority, reason: "stale_instruction" });
        break;
      case "manual_override_increase":
        recommendedActions.add("review_manual_overrides");
        governanceFollowUps.add("attach_governance_review");
        recommendationSpecs.push({ kind: "create_improvement_candidate", priority, reason: "manual_override_increase" });
        break;
      case "conflict_involvement":
        recommendedActions.add("review_conflict_history");
        governanceFollowUps.add("attach_conflict_review");
        recommendationSpecs.push({
          kind: target.targetKind === "instruction" ? "review_instruction" : "create_improvement_candidate",
          priority,
          reason: "conflict_involvement"
        });
        break;
      case "provider_model_mismatch":
        recommendedActions.add("review_provider_model_match");
        governanceFollowUps.add("attach_compatibility_review");
        recommendationSpecs.push({ kind: "review_provider_compatibility", priority, reason: "provider_model_mismatch" });
        break;
      case "unknown":
        recommendedActions.add("monitor_target");
        governanceFollowUps.add("revisit_after_more_signals");
        recommendationSpecs.push({ kind: "monitor", priority: "low", reason: "unknown_signal" });
        break;
    }
    if (signal.severity === "critical" || signal.severity === "high") {
      recommendedActions.add("require_human_review");
      governanceFollowUps.add("require_human_review");
    }
  }
  return {
    recommendedActions: Array.from(recommendedActions),
    governanceFollowUps: Array.from(governanceFollowUps),
    recommendationSpecs
  };
}

export class RegistryDriftDetectionService {
  private readonly signals: RegistryDriftSignal[];
  private readonly baselines: RegistryDriftBaseline[];
  private readonly assessments: RegistryDriftAssessment[] = [];
  private readonly recommendations: RegistryDriftRecommendation[] = [];
  private readonly dataSource: RegistryDriftDataSource;
  private readonly policyEvaluator?: (input: RegistryDriftPolicyEvaluationInput) => RegistryDriftPolicyDecisionSnapshot;
  private readonly candidateLinker?: (request: RegistryDriftImprovementCandidateRequest) => RegistryDriftImprovementCandidateResult | undefined;
  private readonly now: () => Date;

  constructor(input: RegistryDriftDetectionServiceInput = {}) {
    this.now = input.now ?? (() => new Date());
    const fallbackTimestamp = this.now();
    this.signals = clone(input.signals ?? defaultRegistryDriftSignals).map((seed) => ({
      id: seed.id ?? createId("drift_signal"),
      observedAt: seed.observedAt ?? fallbackTimestamp,
      targetKind: seed.targetKind,
      targetId: seed.targetId,
      signalKind: seed.signalKind,
      value: seed.value,
      baselineValue: seed.baselineValue,
      delta: seed.delta,
      window: seed.window,
      severity: seed.severity,
      source: seed.source,
      metadata: { ...(seed.metadata ?? {}) }
    }));
    this.baselines = clone(input.baselines ?? defaultRegistryDriftBaselines).map((seed) => ({
      id: seed.id ?? createId("drift_baseline"),
      establishedAt: seed.establishedAt ?? fallbackTimestamp,
      targetKind: seed.targetKind,
      targetId: seed.targetId,
      window: seed.window,
      metrics: { ...seed.metrics },
      status: seed.status,
      metadata: { ...(seed.metadata ?? {}) }
    }));
    this.dataSource = input.dataSource ?? {};
    this.policyEvaluator = input.policyEvaluator;
    this.candidateLinker = input.candidateLinker;
    void FIXED_SEED_TIMESTAMP;
  }

  listSignals(query: RegistryDriftQuery = {}): RegistryDriftSignal[] {
    return this.signals
      .filter((signal) => query.targetKind === undefined || signal.targetKind === query.targetKind)
      .filter((signal) => query.targetId === undefined || signal.targetId === query.targetId)
      .filter((signal) => query.severity === undefined || signal.severity === query.severity)
      .map(clone);
  }

  listBaselines(query: RegistryDriftQuery = {}): RegistryDriftBaseline[] {
    return this.baselines
      .filter((baseline) => query.targetKind === undefined || baseline.targetKind === query.targetKind)
      .filter((baseline) => query.targetId === undefined || baseline.targetId === query.targetId)
      .map(clone);
  }

  listAssessments(query: RegistryDriftQuery = {}): RegistryDriftAssessment[] {
    return this.assessments
      .filter((assessment) => query.targetKind === undefined || assessment.targetKind === query.targetKind)
      .filter((assessment) => query.targetId === undefined || assessment.targetId === query.targetId)
      .filter((assessment) => query.severity === undefined || assessment.severity === query.severity)
      .map(clone);
  }

  listRecommendations(query: RegistryDriftQuery = {}): RegistryDriftRecommendation[] {
    return this.recommendations
      .filter((recommendation) => query.targetKind === undefined || recommendation.targetKind === query.targetKind)
      .filter((recommendation) => query.targetId === undefined || recommendation.targetId === query.targetId)
      .map(clone);
  }

  collectSignals(query: RegistryDriftQuery = {}, serviceContext: RegistryDriftServiceContext = {}): RegistryDriftSignal[] {
    const policyResult = this.policyEvaluator?.({
      action: "registry.drift.read",
      context: serviceContext,
      targetKind: query.targetKind,
      targetId: query.targetId
    });
    if (policyResult && policyResult.decision !== "allow") return [];
    return this.listSignals(query);
  }

  buildBaseline(target: RegistryDriftAssessQuery, serviceContext: RegistryDriftServiceContext = {}): RegistryDriftBaseline {
    const policyResult = this.policyEvaluator?.({
      action: "registry.drift.read",
      context: serviceContext,
      targetKind: target.targetKind,
      targetId: target.targetId
    });
    if (policyResult && policyResult.decision !== "allow") {
      return {
        id: createId("drift_baseline"),
        targetKind: target.targetKind,
        targetId: target.targetId,
        window: "30d",
        metrics: {},
        establishedAt: this.now(),
        status: "missing",
        metadata: { policyDenied: true, reason: policyResult.reason }
      };
    }
    const existing = this.baselines.find((baseline) => baseline.targetKind === target.targetKind && baseline.targetId === target.targetId);
    if (existing) return clone(existing);
    return {
      id: createId("drift_baseline"),
      targetKind: target.targetKind,
      targetId: target.targetId,
      window: "30d",
      metrics: {},
      establishedAt: this.now(),
      status: "missing",
      metadata: { reason: "no_baseline_seeded" }
    };
  }

  assessTarget(target: RegistryDriftAssessQuery, serviceContext: RegistryDriftServiceContext = {}): RegistryDriftAssessment {
    const policyAssess = this.policyEvaluator?.({
      action: "registry.drift.assess",
      context: serviceContext,
      targetKind: target.targetKind,
      targetId: target.targetId
    });
    if (policyAssess && policyAssess.decision !== "allow") {
      const blockedAssessment: RegistryDriftAssessment = {
        id: createId("drift_assessment"),
        targetKind: target.targetKind,
        targetId: target.targetId,
        signalIds: [],
        driftScore: 0,
        severity: "info",
        status: "insufficient_data",
        recommendedActions: [],
        governanceFollowUps: [],
        window: "30d",
        createdAt: this.now(),
        metadata: { policyDenied: true, reason: policyAssess.reason }
      };
      this.assessments.push(blockedAssessment);
      return clone(blockedAssessment);
    }

    const matched = this.signals.filter((signal) => signal.targetKind === target.targetKind && signal.targetId === target.targetId);
    const score = this.computeScoreForSignals(matched);
    const severities = matched.map((signal) => signal.severity);
    const severity = severityFromScore(score);
    const status = statusFromScore(score, severities);
    const window: RegistryDriftWindow = matched[0]?.window ?? "30d";
    const { recommendedActions, governanceFollowUps, recommendationSpecs } = recommendationsForSignals(target, matched);
    const assessment: RegistryDriftAssessment = {
      id: createId("drift_assessment"),
      targetKind: target.targetKind,
      targetId: target.targetId,
      signalIds: matched.map((signal) => signal.id),
      driftScore: score,
      severity,
      status,
      recommendedActions,
      governanceFollowUps,
      window,
      createdAt: this.now(),
      metadata: {
        signalCount: matched.length,
        gatePreserved: true,
        applyAllowed: false,
        evalExecuted: false,
        canaryExecuted: false,
        registryMutationExecuted: false,
        externalCallExecuted: false
      }
    };
    this.assessments.push(assessment);

    const policyRecommend = this.policyEvaluator?.({
      action: "registry.drift.recommend",
      context: serviceContext,
      targetKind: target.targetKind,
      targetId: target.targetId
    });
    const allowRecommendations = !policyRecommend || policyRecommend.decision === "allow";
    if (allowRecommendations) {
      for (const spec of recommendationSpecs) {
        const recommendation: RegistryDriftRecommendation = {
          id: createId("drift_recommendation"),
          assessmentId: assessment.id,
          targetKind: target.targetKind,
          targetId: target.targetId,
          recommendationKind: spec.kind,
          priority: spec.priority,
          reason: spec.reason,
          applyAllowed: false,
          metadata: {
            gatePreserved: true,
            applyAllowed: false,
            evalExecuted: false,
            canaryExecuted: false,
            externalCallExecuted: false
          }
        };
        this.recommendations.push(recommendation);
      }
    }
    return clone(assessment);
  }

  assessAll(serviceContext: RegistryDriftServiceContext = {}): RegistryDriftAssessment[] {
    const targets = new Map<string, RegistryDriftAssessQuery>();
    for (const signal of this.signals) {
      const key = `${signal.targetKind}::${signal.targetId}`;
      if (!targets.has(key)) targets.set(key, { targetKind: signal.targetKind, targetId: signal.targetId });
    }
    if (this.dataSource.listSkills) {
      for (const skill of this.dataSource.listSkills()) {
        const key = `skill::${skill.id}`;
        if (!targets.has(key)) targets.set(key, { targetKind: "skill", targetId: skill.id });
      }
    }
    if (this.dataSource.listHarnesses) {
      for (const harness of this.dataSource.listHarnesses()) {
        const key = `harness::${harness.id}`;
        if (!targets.has(key)) targets.set(key, { targetKind: "harness", targetId: harness.id });
      }
    }
    if (this.dataSource.listInstructions) {
      for (const instruction of this.dataSource.listInstructions()) {
        const key = `instruction::${instruction.id}`;
        if (!targets.has(key)) targets.set(key, { targetKind: "instruction", targetId: instruction.id });
      }
    }
    const sorted = Array.from(targets.values()).sort((left, right) => `${left.targetKind}::${left.targetId}`.localeCompare(`${right.targetKind}::${right.targetId}`));
    const results: RegistryDriftAssessment[] = [];
    for (const target of sorted) {
      results.push(this.assessTarget(target, serviceContext));
    }
    return results;
  }

  linkToImprovementCandidate(assessmentId: string, serviceContext: RegistryDriftServiceContext = {}): RegistryDriftImprovementCandidateResult {
    const policyResult = this.policyEvaluator?.({
      action: "registry.drift.create_candidate_future",
      context: serviceContext,
      metadata: { assessmentId }
    });
    if (policyResult && policyResult.decision !== "allow") {
      return {
        assessmentId,
        candidateRef: "draft_only_blocked",
        applyAllowed: false,
        draftOnly: true,
        metadata: { policyDenied: true, reason: policyResult.reason, applyAllowed: false }
      };
    }
    if (this.candidateLinker) {
      const linked = this.candidateLinker({ assessmentId, context: serviceContext });
      if (linked) return { ...linked, applyAllowed: false, draftOnly: true };
    }
    return {
      assessmentId,
      candidateRef: `draft_candidate_for_${assessmentId}`,
      applyAllowed: false,
      draftOnly: true,
      metadata: { applyAllowed: false, registryMutationExecuted: false, futureOnly: true }
    };
  }

  getSummary(): RegistryDriftSummary {
    const noDriftCount = this.assessments.filter((a) => a.status === "no_drift").length;
    const watchCount = this.assessments.filter((a) => a.status === "watch").length;
    const degradedCount = this.assessments.filter((a) => a.status === "degraded").length;
    const criticalCount = this.assessments.filter((a) => a.status === "critical").length;
    const insufficientDataCount = this.assessments.filter((a) => a.status === "insufficient_data").length;
    const criticalSignalCount = this.signals.filter((s) => s.severity === "critical").length;
    const highSignalCount = this.signals.filter((s) => s.severity === "high").length;
    return {
      status: "v1_implemented",
      planningOnly: true,
      generatedAt: this.now(),
      signalCount: this.signals.length,
      baselineCount: this.baselines.length,
      assessmentCount: this.assessments.length,
      recommendationCount: this.recommendations.length,
      noDriftCount,
      watchCount,
      degradedCount,
      criticalCount,
      insufficientDataCount,
      criticalSignalCount,
      highSignalCount,
      applyAllowed: false,
      registryMutationExecuted: false,
      evalExecuted: false,
      canaryExecuted: false,
      autoImprovementApplied: false,
      externalCallExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    };
  }

  computeScoreForSignals(signals: RegistryDriftSignal[]): number {
    let raw = 0;
    for (const signal of signals) {
      const weight = SIGNAL_WEIGHTS[signal.signalKind] ?? 5;
      const multiplier = SEVERITY_MULTIPLIERS[signal.severity] ?? 1;
      raw += weight * multiplier;
    }
    return clampScore(raw);
  }
}

export function createRegistryDriftDetectionService(input: RegistryDriftDetectionServiceInput = {}): RegistryDriftDetectionService {
  return new RegistryDriftDetectionService(input);
}
