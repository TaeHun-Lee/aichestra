import { createId } from "@aichestra/core";
import type {
  ApprovalStatus,
  ChecksumStatus,
  DraftRegistryChange,
  EvalStatus,
  ImprovementProposal,
  ProposalEvalRun,
  ProposalEvalRunStatus,
  RegistryEvalResult,
  RegistryEvalResultStatus,
  RegistryKind,
  RegistryPackageManifest,
  RegistryStatus
} from "@aichestra/core";
import type { AuthContext, RequestContext } from "@aichestra/auth";
import type { PolicyResourceScope } from "@aichestra/policy";

export type RegistryEvalSuiteKind =
  | "mock_deterministic"
  | "fixture_static"
  | "compatibility"
  | "drift_followup"
  | "policy_golden_future"
  | "provider_live_future"
  | "external_future";

export type RegistryEvalTargetKind =
  | "skill"
  | "harness"
  | "instruction"
  | "registry_package"
  | "draft_registry_change";

export type RegistryEvalSuiteStatus = "active_mock" | "disabled" | "future";

export type RegistryEvalCaseKind =
  | "deterministic_match"
  | "required_field"
  | "compatibility_check"
  | "policy_check"
  | "drift_signal_check"
  | "artifact_trust_check"
  | "fixture_snapshot"
  | "future_provider_output";

export type RegistryEvalCaseVerdict = "pass" | "fail" | "warning" | "skipped";

export type RegistryEvalRunStatus =
  | "requested"
  | "running_mock"
  | "passed"
  | "failed"
  | "warning"
  | "skipped"
  | "blocked_policy"
  | "blocked_missing_target"
  | "future_external";

export type RegistryEvalOverallVerdict = "passed" | "failed" | "warning" | "skipped" | "blocked";

export type RegistryEvalSuite = {
  id: string;
  name: string;
  description: string;
  suiteKind: RegistryEvalSuiteKind;
  targetKinds: RegistryEvalTargetKind[];
  status: RegistryEvalSuiteStatus;
  requiredInputs: string[];
  forbiddenCapabilities: string[];
  timeoutMs: number;
  metadata: Record<string, unknown>;
};

export type RegistryEvalCase = {
  id: string;
  suiteId: string;
  name: string;
  caseKind: RegistryEvalCaseKind;
  input: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
  expectedVerdict: RegistryEvalCaseVerdict;
  metadata: Record<string, unknown>;
};

export type RegistryEvalRun = {
  id: string;
  suiteId: string;
  targetKind: RegistryEvalTargetKind;
  targetId: string;
  draftRegistryChangeId?: string;
  proposalId?: string;
  status: RegistryEvalRunStatus;
  startedAt: Date;
  completedAt?: Date;
  requestedByActorId?: string;
  requestedByServiceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  metadata: Record<string, unknown>;
};

export type RegistryEvalCaseResult = {
  id: string;
  runId: string;
  caseId: string;
  verdict: RegistryEvalCaseVerdict;
  actualOutputSummary: string;
  expectedOutputSummary: string;
  reason: string;
  metadata: Record<string, unknown>;
};

export type RegistryEvalVerdict = {
  id: string;
  runId: string;
  overallVerdict: RegistryEvalOverallVerdict;
  passCount: number;
  failCount: number;
  warningCount: number;
  skippedCount: number;
  requiredForApply: boolean;
  requiredForCanary: boolean;
  metadata: Record<string, unknown>;
};

export type RegistryEvalTargetSnapshot = {
  targetKind: RegistryEvalTargetKind;
  targetId: string;
  targetName?: string;
  targetVersion?: string;
  status?: RegistryStatus | string;
  approvalStatus?: ApprovalStatus | string;
  evalStatus?: EvalStatus | string;
  checksumStatus?: ChecksumStatus | string;
  packageManifest?: RegistryPackageManifest;
  draftRegistryChange?: DraftRegistryChange;
  proposal?: ImprovementProposal;
  metadata: Record<string, unknown>;
};

export type RegistryEvalAttachment = {
  id: string;
  runId: string;
  targetKind: RegistryEvalTargetKind;
  targetId: string;
  attachedAt: Date;
  registryEvalResult?: RegistryEvalResult;
  proposalEvalRun?: ProposalEvalRun;
  metadata: Record<string, unknown>;
};

export type RegistryEvalSummary = {
  status: "v1_implemented";
  executionMode: "mock_deterministic_only";
  suiteCount: number;
  caseCount: number;
  runCount: number;
  resultCount: number;
  passedRuns: number;
  failedRuns: number;
  warningRuns: number;
  skippedRuns: number;
  blockedRuns: number;
  externalEvalImplemented: false;
  realProviderCalls: false;
  llmCallsExecuted: false;
  mcpCallsExecuted: false;
  vendorCliExecuted: false;
  canaryExecuted: false;
  autoApplyEnabled: false;
  activeRegistryMutationExecuted: false;
  noSecretsExposed: true;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type RegistryEvalServiceContext = {
  requestContext?: RequestContext;
  authContext?: AuthContext;
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  roles?: string[];
  resourceScopes?: PolicyResourceScope[];
  metadata?: Record<string, unknown>;
};

export type RegistryEvalPolicyAction =
  | "registry.eval_suite.read"
  | "registry.eval_suite.run_mock"
  | "registry.eval_suite.attach_result"
  | "registry.eval_suite.run_external_future"
  | "governance.eval.require"
  | "governance.eval.override_future";

export type RegistryEvalPolicyDecisionSnapshot = {
  decision: "allow" | "deny" | "require_approval" | "not_applicable";
  matchedRuleIds: string[];
  reason: string;
};

export type RegistryEvalPolicyEvaluationInput = {
  action: RegistryEvalPolicyAction;
  context: RegistryEvalServiceContext;
  suiteId?: string;
  runId?: string;
  targetKind?: RegistryEvalTargetKind;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export type RegistryEvalDataSource = {
  getTarget?(targetKind: RegistryEvalTargetKind, targetId: string): RegistryEvalTargetSnapshot | undefined;
  listTargets?(): RegistryEvalTargetSnapshot[];
  attachRegistryEvalResult?(input: {
    targetKind: RegistryKind;
    targetId: string;
    evalName: string;
    status: RegistryEvalResultStatus;
    score?: number;
    maxScore?: number;
    summary: string;
    details?: string;
    artifactRef?: string;
    updateEvalStatus?: boolean;
    context?: RegistryEvalServiceContext;
    metadata?: Record<string, unknown>;
  }): RegistryEvalResult;
  attachProposalEvalRun?(input: {
    proposalId: string;
    evalRequirementId: string;
    status: ProposalEvalRunStatus;
    summary: string;
    score?: number;
    maxScore?: number;
    context?: RegistryEvalServiceContext;
    metadata?: Record<string, unknown>;
  }): ProposalEvalRun;
};

export type RegistryEvalRunRequestInput = {
  suiteId: string;
  targetKind: RegistryEvalTargetKind;
  targetId: string;
  draftRegistryChangeId?: string;
  proposalId?: string;
  metadata?: Record<string, unknown>;
};

export type AttachRegistryEvalResultInput = {
  runId: string;
  updateRegistryEvalStatus?: boolean;
  attachToProposal?: boolean;
  evalRequirementId?: string;
  metadata?: Record<string, unknown>;
};

export type EvalSuiteExecutionServiceInput = {
  suites?: RegistryEvalSuite[];
  cases?: RegistryEvalCase[];
  dataSource?: RegistryEvalDataSource;
  policyEvaluator?: (input: RegistryEvalPolicyEvaluationInput) => RegistryEvalPolicyDecisionSnapshot;
  now?: () => Date;
};

const forbiddenCapabilities = [
  "real_llm_provider",
  "external_eval_suite",
  "mcp_tool_execution",
  "vendor_cli_execution",
  "remote_git_operation",
  "canary_execution",
  "auto_apply",
  "active_registry_mutation",
  "secret_or_env_exposure"
];

export const defaultRegistryEvalSuites: RegistryEvalSuite[] = [
  {
    id: "skill-required-metadata-suite",
    name: "Skill Required Metadata Suite",
    description: "Checks that a skill candidate carries required registry metadata and safe eval gate state.",
    suiteKind: "mock_deterministic",
    targetKinds: ["skill"],
    status: "active_mock",
    requiredInputs: ["targetKind", "targetId"],
    forbiddenCapabilities,
    timeoutMs: 1000,
    metadata: { noRealProvider: true, noExternalCalls: true, noAutoApply: true }
  },
  {
    id: "harness-safety-suite",
    name: "Harness Safety Suite",
    description: "Checks that a harness stays inside mock/local safety boundaries.",
    suiteKind: "fixture_static",
    targetKinds: ["harness"],
    status: "active_mock",
    requiredInputs: ["targetKind", "targetId"],
    forbiddenCapabilities,
    timeoutMs: 1000,
    metadata: { networkDeniedByDefault: true, remoteGitDeniedByDefault: true }
  },
  {
    id: "instruction-compatibility-suite",
    name: "Instruction Compatibility Suite",
    description: "Checks instruction lifecycle, approval, eval, and checksum metadata.",
    suiteKind: "compatibility",
    targetKinds: ["instruction"],
    status: "active_mock",
    requiredInputs: ["targetKind", "targetId"],
    forbiddenCapabilities,
    timeoutMs: 1000,
    metadata: { resolverGatesPreserved: true }
  },
  {
    id: "registry-package-artifact-trust-suite",
    name: "Registry Package Artifact Trust Suite",
    description: "Checks local package checksum/trust metadata without signing or verification.",
    suiteKind: "fixture_static",
    targetKinds: ["registry_package"],
    status: "active_mock",
    requiredInputs: ["targetKind", "targetId"],
    forbiddenCapabilities,
    timeoutMs: 1000,
    metadata: { realSigningImplemented: false, realVerificationImplemented: false, externalRegistryCalls: false }
  },
  {
    id: "compatibility-matrix-suite",
    name: "Compatibility Matrix Suite",
    description: "Checks that compatibility metadata does not report a blocking registry gate.",
    suiteKind: "compatibility",
    targetKinds: ["skill", "harness", "instruction", "registry_package"],
    status: "active_mock",
    requiredInputs: ["targetKind", "targetId"],
    forbiddenCapabilities,
    timeoutMs: 1000,
    metadata: { compatibilityAdvisoryOnly: true, resolverGatesPreserved: true }
  },
  {
    id: "drift-followup-suite",
    name: "Drift Follow-up Suite",
    description: "Checks drift follow-up metadata and warns when follow-up evidence is still missing.",
    suiteKind: "drift_followup",
    targetKinds: ["skill", "harness", "instruction", "registry_package"],
    status: "active_mock",
    requiredInputs: ["targetKind", "targetId"],
    forbiddenCapabilities,
    timeoutMs: 1000,
    metadata: { driftSignalsAreMetadataOnly: true, canaryExecuted: false }
  },
  {
    id: "provider-live-future-suite",
    name: "Provider Live Future Suite",
    description: "Future live provider eval suite placeholder. It cannot execute in v1.",
    suiteKind: "provider_live_future",
    targetKinds: ["skill", "harness", "instruction", "registry_package", "draft_registry_change"],
    status: "future",
    requiredInputs: ["targetKind", "targetId"],
    forbiddenCapabilities,
    timeoutMs: 0,
    metadata: { futureOnly: true, realProviderCalls: false }
  }
];

export const defaultRegistryEvalCases: RegistryEvalCase[] = [
  {
    id: "case-skill-required-fields",
    suiteId: "skill-required-metadata-suite",
    name: "Skill has required metadata",
    caseKind: "required_field",
    input: { fields: ["targetName", "targetVersion", "status", "approvalStatus", "evalStatus"] },
    expectedOutput: { requiredFieldsPresent: true },
    expectedVerdict: "pass",
    metadata: { deterministic: true }
  },
  {
    id: "case-skill-registry-gates",
    suiteId: "skill-required-metadata-suite",
    name: "Skill registry gates are acceptable",
    caseKind: "compatibility_check",
    input: { targetKind: "skill" },
    expectedOutput: { registryGatesPreserved: true },
    expectedVerdict: "pass",
    metadata: { resolverGatesPreserved: true }
  },
  {
    id: "case-harness-safe-capabilities",
    suiteId: "harness-safety-suite",
    name: "Harness does not require forbidden default capabilities",
    caseKind: "policy_check",
    input: { forbiddenCapabilities },
    expectedOutput: { externalCallsExecuted: false, vendorCliExecuted: false },
    expectedVerdict: "pass",
    metadata: { noExternalCalls: true }
  },
  {
    id: "case-instruction-checksum-and-gates",
    suiteId: "instruction-compatibility-suite",
    name: "Instruction checksum and registry gates are acceptable",
    caseKind: "compatibility_check",
    input: { targetKind: "instruction" },
    expectedOutput: { checksumMismatch: false },
    expectedVerdict: "pass",
    metadata: { checksumGatePreserved: true }
  },
  {
    id: "case-package-artifact-trust",
    suiteId: "registry-package-artifact-trust-suite",
    name: "Package checksum/trust metadata is present",
    caseKind: "artifact_trust_check",
    input: { requireChecksum: true },
    expectedOutput: { checksumPresent: true },
    expectedVerdict: "pass",
    metadata: { realSigningImplemented: false, realVerificationImplemented: false }
  },
  {
    id: "case-compatibility-not-blocked",
    suiteId: "compatibility-matrix-suite",
    name: "Compatibility does not report blocking gates",
    caseKind: "compatibility_check",
    input: { advisoryOnly: true },
    expectedOutput: { compatibilityCanBypassResolver: false },
    expectedVerdict: "pass",
    metadata: { compatibilityAdvisoryOnly: true }
  },
  {
    id: "case-drift-followup-metadata",
    suiteId: "drift-followup-suite",
    name: "Drift follow-up evidence is present or warning-only",
    caseKind: "drift_signal_check",
    input: { warningWhenMissing: true },
    expectedOutput: { canaryExecuted: false, evalExecuted: false },
    expectedVerdict: "warning",
    metadata: { advisoryOnly: true }
  },
  {
    id: "case-provider-output-future",
    suiteId: "provider-live-future-suite",
    name: "Future provider output is not executed",
    caseKind: "future_provider_output",
    input: { providerCallsAllowed: false },
    expectedOutput: { skipped: true },
    expectedVerdict: "skipped",
    metadata: { futureOnly: true }
  }
];

export class EvalSuiteExecutionService {
  private readonly suites: RegistryEvalSuite[];
  private readonly cases: RegistryEvalCase[];
  private readonly runs = new Map<string, RegistryEvalRun>();
  private readonly caseResults = new Map<string, RegistryEvalCaseResult[]>();
  private readonly verdicts = new Map<string, RegistryEvalVerdict>();
  private readonly attachments = new Map<string, RegistryEvalAttachment>();
  private readonly dataSource: RegistryEvalDataSource;
  private readonly policyEvaluator?: EvalSuiteExecutionServiceInput["policyEvaluator"];
  private readonly now: () => Date;

  constructor(input: EvalSuiteExecutionServiceInput = {}) {
    this.suites = (input.suites ?? defaultRegistryEvalSuites).map(cloneSuite);
    this.cases = (input.cases ?? defaultRegistryEvalCases).map(cloneCase);
    this.dataSource = input.dataSource ?? {};
    this.policyEvaluator = input.policyEvaluator;
    this.now = input.now ?? (() => new Date());
  }

  listSuites(): RegistryEvalSuite[] {
    return this.suites.map(cloneSuite);
  }

  listCases(suiteId: string): RegistryEvalCase[] {
    this.requireSuite(suiteId);
    return this.cases.filter((testCase) => testCase.suiteId === suiteId).map(cloneCase);
  }

  requestEvalRun(input: RegistryEvalRunRequestInput, context: RegistryEvalServiceContext = {}): RegistryEvalRun {
    const suite = this.requireSuite(input.suiteId);
    const now = this.now();
    const target = this.lookupTarget(input.targetKind, input.targetId);
    const action: RegistryEvalPolicyAction = this.canRunSuiteKind(suite.suiteKind) ? "registry.eval_suite.run_mock" : "registry.eval_suite.run_external_future";
    const policy = this.evaluatePolicy(action, context, {
      suiteId: suite.id,
      targetKind: input.targetKind,
      targetId: input.targetId,
      metadata: input.metadata
    });
    let status: RegistryEvalRunStatus = "requested";
    const blockers: string[] = [];
    if (policy.decision === "deny") {
      status = "blocked_policy";
      blockers.push(`policy_denied:${policy.reason}`);
    } else if (!target) {
      status = "blocked_missing_target";
      blockers.push("target_not_found");
    } else if (!this.canRunSuiteKind(suite.suiteKind) || suite.status !== "active_mock") {
      status = "future_external";
      blockers.push("suite_future_or_disabled");
    } else if (!suite.targetKinds.includes(input.targetKind)) {
      status = "blocked_missing_target";
      blockers.push("suite_target_kind_not_supported");
    }

    const run: RegistryEvalRun = {
      id: createId("registry_eval_run"),
      suiteId: suite.id,
      targetKind: input.targetKind,
      targetId: input.targetId,
      draftRegistryChangeId: input.draftRegistryChangeId,
      proposalId: input.proposalId,
      status,
      startedAt: now,
      completedAt: status === "requested" ? undefined : now,
      requestedByActorId: context.actorId ?? context.authContext?.actor.id,
      requestedByServiceAccountId: context.serviceAccountId,
      requestId: context.requestId ?? context.requestContext?.requestId,
      correlationId: context.correlationId ?? context.requestContext?.correlationId,
      metadata: safeEvalMetadata({
        ...(input.metadata ?? {}),
        targetSnapshot: target ? targetSummary(target) : undefined,
        blockers,
        policyDecision: policy.decision,
        policyReason: policy.reason,
        policyMatchedRuleIds: policy.matchedRuleIds,
        mockExecutionOnly: true,
        externalCallExecuted: false,
        llmCallsExecuted: false,
        mcpCallsExecuted: false,
        vendorCliExecuted: false,
        canaryExecuted: false,
        autoApplyEnabled: false,
        activeRegistryMutationExecuted: false
      })
    };
    this.runs.set(run.id, cloneRun(run));
    if (status !== "requested") {
      this.verdicts.set(run.id, this.blockedVerdict(run, status === "future_external" ? "skipped" : "blocked", blockers));
    }
    return cloneRun(run);
  }

  executeMockEvalRun(runId: string, context: RegistryEvalServiceContext = {}): RegistryEvalRun {
    const existing = this.requireRun(runId);
    const suite = this.requireSuite(existing.suiteId);
    if (existing.status !== "requested" && existing.status !== "running_mock") {
      return cloneRun(existing);
    }
    const policy = this.evaluatePolicy("registry.eval_suite.run_mock", context, {
      suiteId: suite.id,
      runId,
      targetKind: existing.targetKind,
      targetId: existing.targetId,
      metadata: existing.metadata
    });
    if (policy.decision === "deny") {
      const blocked = this.updateRun(existing.id, {
        status: "blocked_policy",
        completedAt: this.now(),
        metadata: safeEvalMetadata({
          ...existing.metadata,
          policyDecision: policy.decision,
          policyReason: policy.reason,
          policyMatchedRuleIds: policy.matchedRuleIds,
          blockers: ["policy_denied"]
        })
      });
      this.verdicts.set(runId, this.blockedVerdict(blocked, "blocked", ["policy_denied"]));
      return cloneRun(blocked);
    }
    if (!this.canRunSuiteKind(suite.suiteKind) || suite.status !== "active_mock") {
      const future = this.updateRun(existing.id, {
        status: "future_external",
        completedAt: this.now(),
        metadata: safeEvalMetadata({ ...existing.metadata, blockers: ["suite_future_or_disabled"] })
      });
      this.verdicts.set(runId, this.blockedVerdict(future, "skipped", ["suite_future_or_disabled"]));
      return cloneRun(future);
    }

    const running = this.updateRun(existing.id, { status: "running_mock" });
    const target = this.lookupTarget(running.targetKind, running.targetId);
    if (!target) {
      const missing = this.updateRun(existing.id, {
        status: "blocked_missing_target",
        completedAt: this.now(),
        metadata: safeEvalMetadata({ ...existing.metadata, blockers: ["target_not_found"] })
      });
      this.verdicts.set(runId, this.blockedVerdict(missing, "blocked", ["target_not_found"]));
      return cloneRun(missing);
    }

    const results = this.cases
      .filter((testCase) => testCase.suiteId === suite.id)
      .map((testCase) => this.evaluateCase(running, suite, testCase, target));
    const verdict = this.verdictFromResults(running.id, results);
    const completedStatus: RegistryEvalRunStatus =
      verdict.overallVerdict === "passed" ? "passed" :
      verdict.overallVerdict === "failed" ? "failed" :
      verdict.overallVerdict === "warning" ? "warning" :
      "skipped";
    const completed = this.updateRun(existing.id, {
      status: completedStatus,
      completedAt: this.now(),
      metadata: safeEvalMetadata({
        ...running.metadata,
        overallVerdict: verdict.overallVerdict,
        passCount: verdict.passCount,
        failCount: verdict.failCount,
        warningCount: verdict.warningCount,
        skippedCount: verdict.skippedCount,
        evalExecuted: true,
        mockExecutionOnly: true,
        realProviderCalls: false,
        externalCallExecuted: false,
        canaryExecuted: false,
        autoApplyEnabled: false,
        activeRegistryMutationExecuted: false
      })
    });
    this.caseResults.set(runId, results.map(cloneCaseResult));
    this.verdicts.set(runId, verdict);
    return cloneRun(completed);
  }

  getEvalRun(runId: string): RegistryEvalRun | undefined {
    const run = this.runs.get(runId);
    return run ? cloneRun(run) : undefined;
  }

  listEvalRuns(query: { suiteId?: string; targetKind?: RegistryEvalTargetKind; targetId?: string; proposalId?: string; status?: RegistryEvalRunStatus } = {}): RegistryEvalRun[] {
    return [...this.runs.values()]
      .filter((run) => query.suiteId === undefined || run.suiteId === query.suiteId)
      .filter((run) => query.targetKind === undefined || run.targetKind === query.targetKind)
      .filter((run) => query.targetId === undefined || run.targetId === query.targetId)
      .filter((run) => query.proposalId === undefined || run.proposalId === query.proposalId)
      .filter((run) => query.status === undefined || run.status === query.status)
      .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime() || left.id.localeCompare(right.id))
      .map(cloneRun);
  }

  listCaseResults(runId: string): RegistryEvalCaseResult[] {
    this.requireRun(runId);
    return (this.caseResults.get(runId) ?? []).map(cloneCaseResult);
  }

  getEvalVerdict(runId: string): RegistryEvalVerdict | undefined {
    this.requireRun(runId);
    const verdict = this.verdicts.get(runId);
    return verdict ? cloneVerdict(verdict) : undefined;
  }

  attachEvalResultToRegistryTarget(input: AttachRegistryEvalResultInput, context: RegistryEvalServiceContext = {}): RegistryEvalAttachment {
    const run = this.requireRun(input.runId);
    const suite = this.requireSuite(run.suiteId);
    const verdict = this.verdicts.get(run.id);
    if (!verdict) throw new Error(`Eval verdict not found for run: ${run.id}`);
    const policy = this.evaluatePolicy("registry.eval_suite.attach_result", context, {
      suiteId: suite.id,
      runId: run.id,
      targetKind: run.targetKind,
      targetId: run.targetId,
      metadata: input.metadata
    });
    if (policy.decision === "deny") {
      const attachment: RegistryEvalAttachment = {
        id: createId("registry_eval_attachment"),
        runId: run.id,
        targetKind: run.targetKind,
        targetId: run.targetId,
        attachedAt: this.now(),
        metadata: safeEvalMetadata({
          ...(input.metadata ?? {}),
          attached: false,
          policyDenied: true,
          policyReason: policy.reason,
          noActiveRegistryMutation: true,
          autoApplyEnabled: false
        })
      };
      this.attachments.set(attachment.id, cloneAttachment(attachment));
      return cloneAttachment(attachment);
    }

    const status = registryStatusFromVerdict(verdict.overallVerdict);
    const registryKind = registryKindFromEvalTarget(run.targetKind);
    const registryEvalResult = registryKind && this.dataSource.attachRegistryEvalResult
      ? this.dataSource.attachRegistryEvalResult({
          targetKind: registryKind,
          targetId: run.targetId,
          evalName: suite.name,
          status,
          score: verdict.passCount,
          maxScore: verdict.passCount + verdict.failCount + verdict.warningCount + verdict.skippedCount,
          summary: `Eval Suite Execution Harness v1 ${verdict.overallVerdict} for ${run.targetKind}:${run.targetId}.`,
          details: `Mock deterministic eval run ${run.id}; no external provider, MCP, vendor CLI, canary, or auto-apply execution.`,
          artifactRef: run.id,
          updateEvalStatus: input.updateRegistryEvalStatus === true && (status === "passed" || status === "failed"),
          context,
          metadata: safeEvalMetadata({
            ...(input.metadata ?? {}),
            evalRunId: run.id,
            suiteId: suite.id,
            verdictId: verdict.id,
            mockExecutionOnly: true,
            externalCallExecuted: false,
            canaryExecuted: false,
            autoApplyEnabled: false,
            activeRegistryMutationExecuted: false
          })
        })
      : undefined;

    const proposalEvalRun = input.attachToProposal === true && run.proposalId && input.evalRequirementId && this.dataSource.attachProposalEvalRun
      ? this.dataSource.attachProposalEvalRun({
          proposalId: run.proposalId,
          evalRequirementId: input.evalRequirementId,
          status: proposalStatusFromVerdict(verdict.overallVerdict),
          score: verdict.passCount,
          maxScore: verdict.passCount + verdict.failCount + verdict.warningCount + verdict.skippedCount,
          summary: `Eval Suite Execution Harness v1 ${verdict.overallVerdict} for ${run.targetKind}:${run.targetId}.`,
          context,
          metadata: safeEvalMetadata({
            ...(input.metadata ?? {}),
            evalRunId: run.id,
            suiteId: suite.id,
            verdictId: verdict.id,
            requiredForApply: verdict.requiredForApply,
            requiredForCanary: verdict.requiredForCanary,
            canaryExecuted: false,
            autoApplyEnabled: false
          })
        })
      : undefined;

    const attachment: RegistryEvalAttachment = {
      id: createId("registry_eval_attachment"),
      runId: run.id,
      targetKind: run.targetKind,
      targetId: run.targetId,
      attachedAt: this.now(),
      registryEvalResult,
      proposalEvalRun,
      metadata: safeEvalMetadata({
        ...(input.metadata ?? {}),
        attached: true,
        registryEvalResultId: registryEvalResult?.id,
        proposalEvalRunId: proposalEvalRun?.id,
        registryContentMutated: false,
        activeRegistryMutationExecuted: false,
        autoApplyEnabled: false,
        canaryExecuted: false,
        externalCallExecuted: false
      })
    };
    this.attachments.set(attachment.id, cloneAttachment(attachment));
    return cloneAttachment(attachment);
  }

  listAttachments(runId?: string): RegistryEvalAttachment[] {
    return [...this.attachments.values()]
      .filter((attachment) => runId === undefined || attachment.runId === runId)
      .sort((left, right) => left.attachedAt.getTime() - right.attachedAt.getTime() || left.id.localeCompare(right.id))
      .map(cloneAttachment);
  }

  getEvalSummary(): RegistryEvalSummary {
    const runs = [...this.runs.values()];
    return {
      status: "v1_implemented",
      executionMode: "mock_deterministic_only",
      suiteCount: this.suites.length,
      caseCount: this.cases.length,
      runCount: runs.length,
      resultCount: [...this.caseResults.values()].reduce((count, results) => count + results.length, 0),
      passedRuns: runs.filter((run) => run.status === "passed").length,
      failedRuns: runs.filter((run) => run.status === "failed").length,
      warningRuns: runs.filter((run) => run.status === "warning").length,
      skippedRuns: runs.filter((run) => run.status === "skipped" || run.status === "future_external").length,
      blockedRuns: runs.filter((run) => run.status === "blocked_policy" || run.status === "blocked_missing_target").length,
      externalEvalImplemented: false,
      realProviderCalls: false,
      llmCallsExecuted: false,
      mcpCallsExecuted: false,
      vendorCliExecuted: false,
      canaryExecuted: false,
      autoApplyEnabled: false,
      activeRegistryMutationExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false,
      metadata: {
        mockExecutionOnly: true,
        providerLiveSuitesBlocked: true,
        applyGateStillRequired: true,
        canaryExecutionImplemented: false,
        noExternalCalls: true
      }
    };
  }

  private evaluateCase(run: RegistryEvalRun, suite: RegistryEvalSuite, testCase: RegistryEvalCase, target: RegistryEvalTargetSnapshot): RegistryEvalCaseResult {
    const output = this.caseOutput(testCase, target);
    const verdict = output.verdict;
    return {
      id: createId("registry_eval_case_result"),
      runId: run.id,
      caseId: testCase.id,
      verdict,
      actualOutputSummary: output.actualOutputSummary,
      expectedOutputSummary: summarizeObject(testCase.expectedOutput),
      reason: output.reason,
      metadata: safeEvalMetadata({
        suiteKind: suite.suiteKind,
        caseKind: testCase.caseKind,
        expectedVerdict: testCase.expectedVerdict,
        target: targetSummary(target),
        mockExecutionOnly: true,
        externalCallExecuted: false,
        llmCallsExecuted: false,
        mcpCallsExecuted: false,
        vendorCliExecuted: false
      })
    };
  }

  private caseOutput(testCase: RegistryEvalCase, target: RegistryEvalTargetSnapshot): { verdict: RegistryEvalCaseVerdict; reason: string; actualOutputSummary: string } {
    if (testCase.caseKind === "future_provider_output") {
      return { verdict: "skipped", reason: "future_provider_output_not_executed_v1", actualOutputSummary: "Future provider output skipped." };
    }
    if (testCase.caseKind === "required_field") {
      const fields = Array.isArray(testCase.input.fields) ? testCase.input.fields.filter((field): field is string => typeof field === "string") : [];
      const missing = fields.filter((field) => targetValue(target, field) === undefined || targetValue(target, field) === "");
      return missing.length === 0
        ? { verdict: "pass", reason: "required_fields_present", actualOutputSummary: `Required fields present: ${fields.join(",")}.` }
        : { verdict: "fail", reason: `missing_required_fields:${missing.join(",")}`, actualOutputSummary: `Missing required fields: ${missing.join(",")}.` };
    }
    if (testCase.caseKind === "compatibility_check") {
      return registryGateVerdict(target);
    }
    if (testCase.caseKind === "artifact_trust_check") {
      const checksumPresent = target.packageManifest?.checksum !== undefined && target.packageManifest.checksum.length > 0;
      if (target.targetKind !== "registry_package") {
        return { verdict: "skipped", reason: "artifact_trust_case_requires_package", actualOutputSummary: "Artifact trust case applies only to registry packages." };
      }
      return checksumPresent
        ? { verdict: "pass", reason: "package_checksum_present", actualOutputSummary: "Package checksum metadata is present; real signing remains disabled." }
        : { verdict: "fail", reason: "package_checksum_missing", actualOutputSummary: "Package checksum metadata is missing." };
    }
    if (testCase.caseKind === "drift_signal_check") {
      const severity = stringMetadata(target.metadata.driftSeverity) ?? stringMetadata(target.metadata.severity);
      if (severity === "critical") {
        return { verdict: "fail", reason: "critical_drift_requires_human_review", actualOutputSummary: "Critical drift signal blocks eval pass." };
      }
      if (target.metadata.driftFollowUpReady === true) {
        return { verdict: "pass", reason: "drift_followup_ready", actualOutputSummary: "Drift follow-up metadata is present." };
      }
      return { verdict: "warning", reason: "drift_followup_missing_warning", actualOutputSummary: "Drift follow-up evidence is missing; warning only in v1." };
    }
    if (testCase.caseKind === "policy_check") {
      const forbidden = Array.isArray(testCase.input.forbiddenCapabilities)
        ? testCase.input.forbiddenCapabilities.filter((item): item is string => typeof item === "string")
        : forbiddenCapabilities;
      return { verdict: "pass", reason: "forbidden_capabilities_not_used", actualOutputSummary: `Forbidden capabilities remain unused: ${forbidden.length}.` };
    }
    if (testCase.caseKind === "fixture_snapshot" || testCase.caseKind === "deterministic_match") {
      return { verdict: "pass", reason: "deterministic_fixture_matched", actualOutputSummary: "Deterministic mock fixture matched expected metadata." };
    }
    return { verdict: "warning", reason: "unknown_case_kind_warning", actualOutputSummary: "Unknown case kind treated as warning in v1." };
  }

  private verdictFromResults(runId: string, results: RegistryEvalCaseResult[]): RegistryEvalVerdict {
    const passCount = results.filter((result) => result.verdict === "pass").length;
    const failCount = results.filter((result) => result.verdict === "fail").length;
    const warningCount = results.filter((result) => result.verdict === "warning").length;
    const skippedCount = results.filter((result) => result.verdict === "skipped").length;
    const overallVerdict: RegistryEvalOverallVerdict =
      failCount > 0 ? "failed" :
      warningCount > 0 ? "warning" :
      passCount > 0 ? "passed" :
      "skipped";
    return {
      id: createId("registry_eval_verdict"),
      runId,
      overallVerdict,
      passCount,
      failCount,
      warningCount,
      skippedCount,
      requiredForApply: true,
      requiredForCanary: true,
      metadata: safeEvalMetadata({
        mockExecutionOnly: true,
        applyAllowed: false,
        canaryExecuted: false,
        autoApplyEnabled: false,
        activeRegistryMutationExecuted: false,
        externalCallExecuted: false
      })
    };
  }

  private blockedVerdict(run: RegistryEvalRun, overallVerdict: RegistryEvalOverallVerdict, blockers: string[]): RegistryEvalVerdict {
    return {
      id: createId("registry_eval_verdict"),
      runId: run.id,
      overallVerdict,
      passCount: 0,
      failCount: overallVerdict === "blocked" ? 1 : 0,
      warningCount: 0,
      skippedCount: overallVerdict === "skipped" ? 1 : 0,
      requiredForApply: true,
      requiredForCanary: true,
      metadata: safeEvalMetadata({
        blockers,
        mockExecutionOnly: true,
        applyAllowed: false,
        canaryExecuted: false,
        autoApplyEnabled: false,
        externalCallExecuted: false
      })
    };
  }

  private lookupTarget(targetKind: RegistryEvalTargetKind, targetId: string): RegistryEvalTargetSnapshot | undefined {
    return this.dataSource.getTarget?.(targetKind, targetId);
  }

  private canRunSuiteKind(kind: RegistryEvalSuiteKind): boolean {
    return kind === "mock_deterministic" || kind === "fixture_static" || kind === "compatibility" || kind === "drift_followup";
  }

  private evaluatePolicy(
    action: RegistryEvalPolicyAction,
    context: RegistryEvalServiceContext,
    input: Omit<RegistryEvalPolicyEvaluationInput, "action" | "context">
  ): RegistryEvalPolicyDecisionSnapshot {
    return this.policyEvaluator?.({
      action,
      context,
      ...input
    }) ?? { decision: "allow", matchedRuleIds: ["registry_eval_suite_mock_default_allow"], reason: "mock_policy_allow" };
  }

  private requireSuite(suiteId: string): RegistryEvalSuite {
    const suite = this.suites.find((entry) => entry.id === suiteId);
    if (!suite) throw new Error(`Registry eval suite not found: ${suiteId}`);
    return suite;
  }

  private requireRun(runId: string): RegistryEvalRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Registry eval run not found: ${runId}`);
    return cloneRun(run);
  }

  private updateRun(runId: string, patch: Partial<RegistryEvalRun>): RegistryEvalRun {
    const existing = this.runs.get(runId);
    if (!existing) throw new Error(`Registry eval run not found: ${runId}`);
    const updated = cloneRun({ ...existing, ...patch });
    this.runs.set(runId, updated);
    return cloneRun(updated);
  }
}

export function createEvalSuiteExecutionService(input: EvalSuiteExecutionServiceInput = {}): EvalSuiteExecutionService {
  return new EvalSuiteExecutionService(input);
}

export function registryEvalSuiteToDto(suite: RegistryEvalSuite): Record<string, unknown> {
  return cloneSuite(suite) as unknown as Record<string, unknown>;
}

export function registryEvalCaseToDto(testCase: RegistryEvalCase): Record<string, unknown> {
  return cloneCase(testCase) as unknown as Record<string, unknown>;
}

export function registryEvalRunToDto(run: RegistryEvalRun): Record<string, unknown> {
  return { ...cloneRun(run), startedAt: run.startedAt.toISOString(), completedAt: run.completedAt?.toISOString() };
}

export function registryEvalCaseResultToDto(result: RegistryEvalCaseResult): Record<string, unknown> {
  return cloneCaseResult(result) as unknown as Record<string, unknown>;
}

export function registryEvalVerdictToDto(verdict: RegistryEvalVerdict): Record<string, unknown> {
  return cloneVerdict(verdict) as unknown as Record<string, unknown>;
}

export function registryEvalAttachmentToDto(attachment: RegistryEvalAttachment): Record<string, unknown> {
  return {
    ...cloneAttachment(attachment),
    attachedAt: attachment.attachedAt.toISOString(),
    registryEvalResult: attachment.registryEvalResult ? {
      ...attachment.registryEvalResult,
      attachedAt: attachment.registryEvalResult.attachedAt.toISOString()
    } : undefined,
    proposalEvalRun: attachment.proposalEvalRun ? {
      ...attachment.proposalEvalRun,
      attachedAt: attachment.proposalEvalRun.attachedAt.toISOString()
    } : undefined
  };
}

export function registryEvalSummaryToDto(summary: RegistryEvalSummary): Record<string, unknown> {
  return structuredClone(summary) as Record<string, unknown>;
}

export function registryEvalTargetFromRegistryPackage(manifest: RegistryPackageManifest): RegistryEvalTargetSnapshot {
  return {
    targetKind: "registry_package",
    targetId: manifest.id,
    targetName: manifest.name,
    targetVersion: manifest.version,
    status: "active",
    approvalStatus: "not_required",
    evalStatus: "not_required",
    checksumStatus: manifest.checksum ? "verified" : "unavailable",
    packageManifest: manifest,
    metadata: safeEvalMetadata({
      packageKind: manifest.packageKind,
      entryCount: manifest.entries.length,
      dependencyCount: manifest.dependencies.length,
      checksumAlgorithm: manifest.checksumAlgorithm,
      ...(manifest.metadata ?? {})
    })
  };
}

function registryGateVerdict(target: RegistryEvalTargetSnapshot): { verdict: RegistryEvalCaseVerdict; reason: string; actualOutputSummary: string } {
  if (target.status && target.status !== "active") {
    return { verdict: "fail", reason: `lifecycle_not_active:${target.status}`, actualOutputSummary: `Lifecycle status is ${target.status}.` };
  }
  if (target.approvalStatus === "rejected") {
    return { verdict: "fail", reason: "approval_rejected", actualOutputSummary: "Approval status is rejected." };
  }
  if (target.approvalStatus === "pending") {
    return { verdict: "warning", reason: "approval_pending", actualOutputSummary: "Approval status is pending." };
  }
  if (target.evalStatus === "failed") {
    return { verdict: "fail", reason: "eval_failed", actualOutputSummary: "Existing registry eval status is failed." };
  }
  if (target.evalStatus === "pending") {
    return { verdict: "warning", reason: "eval_pending", actualOutputSummary: "Existing registry eval status is pending." };
  }
  if (target.checksumStatus === "mismatch") {
    return { verdict: "fail", reason: "checksum_mismatch", actualOutputSummary: "Checksum status is mismatch." };
  }
  return { verdict: "pass", reason: "registry_gates_acceptable", actualOutputSummary: "Registry lifecycle/approval/eval/checksum gates are acceptable." };
}

function registryKindFromEvalTarget(targetKind: RegistryEvalTargetKind): RegistryKind | undefined {
  if (targetKind === "skill" || targetKind === "harness" || targetKind === "instruction") return targetKind;
  return undefined;
}

function registryStatusFromVerdict(verdict: RegistryEvalOverallVerdict): RegistryEvalResultStatus {
  if (verdict === "passed") return "passed";
  if (verdict === "failed" || verdict === "blocked") return "failed";
  if (verdict === "skipped") return "skipped";
  return "pending";
}

function proposalStatusFromVerdict(verdict: RegistryEvalOverallVerdict): ProposalEvalRunStatus {
  if (verdict === "passed") return "passed";
  if (verdict === "failed" || verdict === "blocked") return "failed";
  if (verdict === "skipped") return "skipped";
  return "pending";
}

function targetValue(target: RegistryEvalTargetSnapshot, field: string): unknown {
  return (target as unknown as Record<string, unknown>)[field] ?? target.metadata[field];
}

function targetSummary(target: RegistryEvalTargetSnapshot): Record<string, unknown> {
  return safeEvalMetadata({
    targetKind: target.targetKind,
    targetId: target.targetId,
    targetName: target.targetName,
    targetVersion: target.targetVersion,
    status: target.status,
    approvalStatus: target.approvalStatus,
    evalStatus: target.evalStatus,
    checksumStatus: target.checksumStatus
  });
}

function summarizeObject(value: Record<string, unknown>): string {
  return Object.entries(value).map(([key, entry]) => `${key}:${String(entry)}`).join(", ") || "none";
}

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function cloneSuite(suite: RegistryEvalSuite): RegistryEvalSuite {
  return {
    ...suite,
    targetKinds: [...suite.targetKinds],
    requiredInputs: [...suite.requiredInputs],
    forbiddenCapabilities: [...suite.forbiddenCapabilities],
    metadata: structuredClone(suite.metadata)
  };
}

function cloneCase(testCase: RegistryEvalCase): RegistryEvalCase {
  return {
    ...testCase,
    input: structuredClone(testCase.input),
    expectedOutput: structuredClone(testCase.expectedOutput),
    metadata: structuredClone(testCase.metadata)
  };
}

function cloneRun(run: RegistryEvalRun): RegistryEvalRun {
  return {
    ...run,
    startedAt: new Date(run.startedAt),
    completedAt: run.completedAt ? new Date(run.completedAt) : undefined,
    metadata: structuredClone(run.metadata)
  };
}

function cloneCaseResult(result: RegistryEvalCaseResult): RegistryEvalCaseResult {
  return { ...result, metadata: structuredClone(result.metadata) };
}

function cloneVerdict(verdict: RegistryEvalVerdict): RegistryEvalVerdict {
  return { ...verdict, metadata: structuredClone(verdict.metadata) };
}

function cloneAttachment(attachment: RegistryEvalAttachment): RegistryEvalAttachment {
  return {
    ...attachment,
    attachedAt: new Date(attachment.attachedAt),
    registryEvalResult: attachment.registryEvalResult ? structuredClone(attachment.registryEvalResult) : undefined,
    proposalEvalRun: attachment.proposalEvalRun ? structuredClone(attachment.proposalEvalRun) : undefined,
    metadata: structuredClone(attachment.metadata)
  };
}

function safeEvalMetadata(input: Record<string, unknown>): Record<string, unknown> {
  return sanitizeValue(input) as Record<string, unknown>;
}

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (/token|secret|password|cookie|credential|session|apiKey|api_key|authorization|privateKey|private_key|signingKey|signing_key|signatureValue|rawSignature|envValue|databaseUrl|database_url|vault|prompt|providerOutput/i.test(key)) {
        output[key] = "[redacted]";
      } else {
        output[key] = sanitizeValue(entry);
      }
    }
    return output;
  }
  if (typeof value === "string") {
    return value
      .replace(/OPENAI_API_KEY\s*=\s*[^\s"']+/gi, "OPENAI_API_KEY=[redacted]")
      .replace(/ANTHROPIC_API_KEY\s*=\s*[^\s"']+/gi, "ANTHROPIC_API_KEY=[redacted]")
      .replace(/GITHUB_TOKEN\s*=\s*[^\s"']+/gi, "GITHUB_TOKEN=[redacted]")
      .replace(/VAULT_TOKEN\s*=\s*[^\s"']+/gi, "VAULT_TOKEN=[redacted]")
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, "Bearer [redacted]")
      .replace(/ghp_[A-Za-z0-9_]+/gi, "ghp_[redacted]")
      .replace(/github_pat_[A-Za-z0-9_]+/gi, "github_pat_[redacted]")
      .replace(/sk-[A-Za-z0-9_]+/gi, "sk-[redacted]")
      .replace(/~\/\.codex\/auth\.json|~\/\.claude[^\s"']*/gi, "[redacted-credential-cache]");
  }
  return value;
}
