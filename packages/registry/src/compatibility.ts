import { createId } from "@aichestra/core";
import type {
  AgentKind,
  HarnessPackage,
  InstructionArtifact,
  SkillPackage
} from "@aichestra/core";

export type RegistryCompatibilityRuleKind =
  | "task_kind"
  | "language"
  | "framework"
  | "provider_capability"
  | "model_capability"
  | "runner_capability"
  | "mcp_tool"
  | "security_policy"
  | "tenant_scope"
  | "repo_scope"
  | "eval_status"
  | "lifecycle_status"
  | "approval_status"
  | "checksum_status";

export type RegistryCompatibilitySeverity = "info" | "warning" | "blocking" | "critical";

export type RegistryCompatibilityCandidateKind =
  | "skill"
  | "harness"
  | "instruction"
  | "package"
  | "bundle";

export type RegistryCompatibilityDecisionValue =
  | "compatible"
  | "compatible_with_warnings"
  | "incompatible"
  | "blocked_by_policy"
  | "blocked_by_registry_gate"
  | "future_unknown";

export type RegistryCompatibilityProfileStatus =
  | "active_mock"
  | "planned"
  | "disabled"
  | "future";

export type RegistryCompatibilityRule = {
  id: string;
  ruleKind: RegistryCompatibilityRuleKind;
  severity: RegistryCompatibilitySeverity;
  description: string;
  metadata: Record<string, unknown>;
};

export type RegistryCompatibilityContextInput = {
  id?: string;
  taskKind?: string;
  taskIntent?: string;
  repoId?: string;
  repoKind?: string;
  repoLanguages?: string[];
  frameworks?: string[];
  packageManagers?: string[];
  providerId?: string;
  providerKind?: string;
  modelId?: string;
  modelCapabilities?: string[];
  runnerKind?: string;
  harnessRequirements?: string[];
  mcpServerIds?: string[];
  mcpToolIds?: string[];
  highRiskMcpToolIds?: string[];
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  remoteNetworkEnabled?: boolean;
  remoteGitEnabled?: boolean;
  secretsEnabled?: boolean;
  metadata?: Record<string, unknown>;
};

export type RegistryCompatibilityContext = {
  id: string;
  taskKind: string;
  taskIntent: string;
  repoId?: string;
  repoKind?: string;
  repoLanguages: string[];
  frameworks: string[];
  packageManagers: string[];
  providerId?: string;
  providerKind?: string;
  modelId?: string;
  modelCapabilities: string[];
  runnerKind: string;
  harnessRequirements: string[];
  mcpServerIds: string[];
  mcpToolIds: string[];
  highRiskMcpToolIds: string[];
  tenantId?: string;
  teamId?: string;
  projectId?: string;
  remoteNetworkEnabled: boolean;
  remoteGitEnabled: boolean;
  secretsEnabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type SkillCompatibilityProfile = {
  skillId: string;
  supportedTaskKinds: string[];
  supportedLanguages: string[];
  supportedFrameworks: string[];
  supportedRepoKinds: string[];
  requiredModelCapabilities: string[];
  forbiddenModelCapabilities: string[];
  requiredMcpTools: string[];
  forbiddenMcpTools: string[];
  requiredScopes: string[];
  compatibilityStatus: RegistryCompatibilityProfileStatus;
  metadata: Record<string, unknown>;
};

export type HarnessCompatibilityProfile = {
  harnessId: string;
  supportedRunnerKinds: string[];
  supportedLanguages: string[];
  supportedFrameworks: string[];
  requiredCommands: string[];
  forbiddenCommands: string[];
  networkRequired: boolean;
  fileWriteRequired: boolean;
  remoteGitRequired: boolean;
  secretsRequired: boolean;
  requiredPolicies: string[];
  compatibilityStatus: RegistryCompatibilityProfileStatus;
  metadata: Record<string, unknown>;
};

export type InstructionCompatibilityProfile = {
  instructionId: string;
  supportedTaskKinds: string[];
  supportedSkillIds: string[];
  supportedHarnessIds: string[];
  supportedProviderKinds: string[];
  supportedModelCapabilities: string[];
  requiredScopes: string[];
  compatibilityStatus: RegistryCompatibilityProfileStatus;
  metadata: Record<string, unknown>;
};

export type RegistryCompatibilityDecision = {
  id: string;
  contextId: string;
  candidateKind: RegistryCompatibilityCandidateKind;
  candidateId: string;
  candidateName?: string;
  decision: RegistryCompatibilityDecisionValue;
  reasons: string[];
  warnings: string[];
  blockers: string[];
  score: number;
  requiredActions: string[];
  metadata: Record<string, unknown>;
  evaluatedAt: Date;
};

export type RegistryCompatibilitySummary = {
  status: "v1_implemented";
  planningOnly: true;
  generatedAt: Date;
  totalCandidates: number;
  compatibleCount: number;
  compatibleWithWarningsCount: number;
  incompatibleCount: number;
  blockedByPolicyCount: number;
  blockedByRegistryGateCount: number;
  futureUnknownCount: number;
  ruleCount: number;
  skillProfileCount: number;
  harnessProfileCount: number;
  instructionProfileCount: number;
  resolverGatesPreserved: true;
  autoApplyEnabled: false;
  registryMutationsExecuted: false;
  externalCallsExecuted: false;
  noSecretsExposed: true;
  envValuesExposed: false;
};

export type RegistryCompatibilityServiceContext = {
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type RegistryCompatibilityPolicyDecisionSnapshot = {
  decision: "allow" | "deny" | "require_approval" | "not_applicable";
  matchedRuleIds: string[];
  reason: string;
};

export type RegistryCompatibilityPolicyAction =
  | "registry.compatibility.read"
  | "registry.compatibility.evaluate"
  | "registry.compatibility.matrix.update_future"
  | "registry.compatibility.override_future";

export type RegistryCompatibilityPolicyEvaluationInput = {
  action: RegistryCompatibilityPolicyAction;
  context: RegistryCompatibilityServiceContext;
  candidateKind?: RegistryCompatibilityCandidateKind;
  candidateId?: string;
  metadata?: Record<string, unknown>;
};

export type RegistryCompatibilityServiceInput = {
  skillProfiles?: SkillCompatibilityProfile[];
  harnessProfiles?: HarnessCompatibilityProfile[];
  instructionProfiles?: InstructionCompatibilityProfile[];
  rules?: RegistryCompatibilityRule[];
  registry?: {
    listSkills(): SkillPackage[];
    listHarnesses(): HarnessPackage[];
    listInstructions(): InstructionArtifact[];
  };
  policyEvaluator?: (input: RegistryCompatibilityPolicyEvaluationInput) => RegistryCompatibilityPolicyDecisionSnapshot;
  now?: () => Date;
};

export const defaultRegistryCompatibilityRules: RegistryCompatibilityRule[] = [
  {
    id: "rule_task_kind_match",
    ruleKind: "task_kind",
    severity: "warning",
    description: "Candidate should explicitly support the requested taskKind.",
    metadata: { metadataOnly: true }
  },
  {
    id: "rule_language_match",
    ruleKind: "language",
    severity: "warning",
    description: "Candidate should declare support for repo languages.",
    metadata: { metadataOnly: true }
  },
  {
    id: "rule_framework_match",
    ruleKind: "framework",
    severity: "warning",
    description: "Candidate should declare support for repo frameworks.",
    metadata: { metadataOnly: true }
  },
  {
    id: "rule_model_capability_required",
    ruleKind: "model_capability",
    severity: "blocking",
    description: "Candidate must have all required model capabilities available in context.",
    metadata: { metadataOnly: true }
  },
  {
    id: "rule_model_capability_forbidden",
    ruleKind: "model_capability",
    severity: "blocking",
    description: "Candidate must not depend on forbidden model capabilities.",
    metadata: { metadataOnly: true }
  },
  {
    id: "rule_runner_capability",
    ruleKind: "runner_capability",
    severity: "blocking",
    description: "Harness runnerKind must match candidate supportedRunnerKinds.",
    metadata: { metadataOnly: true }
  },
  {
    id: "rule_mcp_tool_required",
    ruleKind: "mcp_tool",
    severity: "blocking",
    description: "Required MCP tool ids must be present in context.",
    metadata: { metadataOnly: true }
  },
  {
    id: "rule_mcp_tool_high_risk",
    ruleKind: "mcp_tool",
    severity: "critical",
    description: "High-risk MCP tools must not be required by default.",
    metadata: { metadataOnly: true, defaultIncompatible: true }
  },
  {
    id: "rule_security_policy_network",
    ruleKind: "security_policy",
    severity: "blocking",
    description: "Network-required harness must not run when remote network is disabled.",
    metadata: { metadataOnly: true }
  },
  {
    id: "rule_security_policy_remote_git",
    ruleKind: "security_policy",
    severity: "blocking",
    description: "Remote-Git-required harness must not run when remote Git is disabled.",
    metadata: { metadataOnly: true }
  },
  {
    id: "rule_tenant_scope",
    ruleKind: "tenant_scope",
    severity: "warning",
    description: "Tenant scope mismatch is a warning while production enforcement remains future.",
    metadata: { metadataOnly: true, enforcementFuture: true }
  },
  {
    id: "rule_repo_scope",
    ruleKind: "repo_scope",
    severity: "warning",
    description: "Repo scope mismatch is a warning until production enforcement lands.",
    metadata: { metadataOnly: true, enforcementFuture: true }
  },
  {
    id: "rule_eval_status",
    ruleKind: "eval_status",
    severity: "blocking",
    description: "Pending or failed eval excludes candidate via registry resolver gate.",
    metadata: { metadataOnly: true, gatePreserved: true }
  },
  {
    id: "rule_lifecycle_status",
    ruleKind: "lifecycle_status",
    severity: "blocking",
    description: "Non-active lifecycle status excludes candidate via registry resolver gate.",
    metadata: { metadataOnly: true, gatePreserved: true }
  },
  {
    id: "rule_approval_status",
    ruleKind: "approval_status",
    severity: "blocking",
    description: "Pending or rejected approval excludes candidate via registry resolver gate.",
    metadata: { metadataOnly: true, gatePreserved: true }
  },
  {
    id: "rule_checksum_status",
    ruleKind: "checksum_status",
    severity: "blocking",
    description: "Checksum mismatch excludes instruction via registry resolver gate.",
    metadata: { metadataOnly: true, gatePreserved: true }
  }
];

export const defaultSkillCompatibilityProfiles: SkillCompatibilityProfile[] = [
  {
    skillId: "skill_jest_test_fixer",
    supportedTaskKinds: ["test_fix", "code_mod"],
    supportedLanguages: ["typescript", "javascript"],
    supportedFrameworks: ["jest", "vitest"],
    supportedRepoKinds: ["node", "monorepo"],
    requiredModelCapabilities: ["code"],
    forbiddenModelCapabilities: [],
    requiredMcpTools: [],
    forbiddenMcpTools: [],
    requiredScopes: ["repo"],
    compatibilityStatus: "active_mock",
    metadata: { defaultSkill: true }
  },
  {
    skillId: "skill_auth_debugging",
    supportedTaskKinds: ["code_mod", "debug", "auth_debug"],
    supportedLanguages: ["typescript", "javascript"],
    supportedFrameworks: ["express", "nextjs", "fastify"],
    supportedRepoKinds: ["node", "monorepo"],
    requiredModelCapabilities: ["code"],
    forbiddenModelCapabilities: ["browser_use"],
    requiredMcpTools: [],
    forbiddenMcpTools: [],
    requiredScopes: ["repo"],
    compatibilityStatus: "active_mock",
    metadata: { excludeWhenApprovalPending: true }
  },
  {
    skillId: "skill_conflict_risk_reviewer",
    supportedTaskKinds: ["conflict_review", "merge_review"],
    supportedLanguages: ["typescript", "javascript"],
    supportedFrameworks: [],
    supportedRepoKinds: ["node", "monorepo"],
    requiredModelCapabilities: ["code"],
    forbiddenModelCapabilities: [],
    requiredMcpTools: [],
    forbiddenMcpTools: [],
    requiredScopes: ["repo"],
    compatibilityStatus: "active_mock",
    metadata: {}
  }
];

export const defaultHarnessCompatibilityProfiles: HarnessCompatibilityProfile[] = [
  {
    harnessId: "harness_backend_node20",
    supportedRunnerKinds: ["mock", "local"],
    supportedLanguages: ["typescript", "javascript"],
    supportedFrameworks: ["express", "fastify", "node"],
    requiredCommands: ["pnpm lint", "pnpm test"],
    forbiddenCommands: ["rm -rf", "kubectl", "curl", "wget"],
    networkRequired: false,
    fileWriteRequired: true,
    remoteGitRequired: false,
    secretsRequired: false,
    requiredPolicies: ["runner.execute"],
    compatibilityStatus: "active_mock",
    metadata: {}
  },
  {
    harnessId: "harness_frontend_node20",
    supportedRunnerKinds: ["mock", "local"],
    supportedLanguages: ["typescript", "javascript"],
    supportedFrameworks: ["vite", "react"],
    requiredCommands: ["pnpm lint", "pnpm test"],
    forbiddenCommands: ["rm -rf", "kubectl", "curl", "wget"],
    networkRequired: false,
    fileWriteRequired: true,
    remoteGitRequired: false,
    secretsRequired: false,
    requiredPolicies: ["runner.execute"],
    compatibilityStatus: "active_mock",
    metadata: {}
  },
  {
    harnessId: "harness_local_git_dry_run",
    supportedRunnerKinds: ["mock", "local"],
    supportedLanguages: ["typescript", "javascript"],
    supportedFrameworks: [],
    requiredCommands: ["pnpm test"],
    forbiddenCommands: ["git push", "git fetch", "git merge", "git rebase"],
    networkRequired: false,
    fileWriteRequired: false,
    remoteGitRequired: false,
    secretsRequired: false,
    requiredPolicies: ["runner.execute"],
    compatibilityStatus: "active_mock",
    metadata: { localOnly: true }
  }
];

export const defaultInstructionCompatibilityProfiles: InstructionCompatibilityProfile[] = [
  {
    instructionId: "instr_org_secure_coding_baseline",
    supportedTaskKinds: ["code_mod", "test_fix", "debug", "auth_debug"],
    supportedSkillIds: ["skill_jest_test_fixer", "skill_auth_debugging"],
    supportedHarnessIds: ["harness_backend_node20", "harness_frontend_node20"],
    supportedProviderKinds: ["mock", "openai_compatible"],
    supportedModelCapabilities: ["code"],
    requiredScopes: ["repo"],
    compatibilityStatus: "active_mock",
    metadata: {}
  },
  {
    instructionId: "instr_conflict_manager_guidance",
    supportedTaskKinds: ["conflict_review", "merge_review"],
    supportedSkillIds: ["skill_conflict_risk_reviewer"],
    supportedHarnessIds: ["harness_local_git_dry_run"],
    supportedProviderKinds: ["mock"],
    supportedModelCapabilities: ["code"],
    requiredScopes: ["repo"],
    compatibilityStatus: "active_mock",
    metadata: {}
  }
];

const VALID_PROFILE_STATUSES: ReadonlySet<RegistryCompatibilityProfileStatus> = new Set([
  "active_mock",
  "planned",
  "disabled",
  "future"
]);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeStringArray(values: string[] | undefined): string[] {
  return uniq((values ?? []).map((value) => value.trim()).filter(Boolean).map((value) => value.toLowerCase()));
}

function isSelectableLifecycle(entry: { status: string }): boolean {
  return entry.status === "active";
}

function approvalAllows(entry: { approvalStatus: string }): boolean {
  return entry.approvalStatus === "not_required" || entry.approvalStatus === "approved";
}

function evalAllows(entry: { evalStatus: string }): boolean {
  return entry.evalStatus === "not_required" || entry.evalStatus === "passed";
}

function checksumAllows(entry: { checksumStatus?: string }): boolean {
  return entry.checksumStatus === undefined || entry.checksumStatus !== "mismatch";
}

function registryGateBlockers(entry: SkillPackage | HarnessPackage | InstructionArtifact, kind: RegistryCompatibilityCandidateKind): string[] {
  const blockers: string[] = [];
  if (!isSelectableLifecycle(entry)) blockers.push(`${kind}_lifecycle_${entry.status}`);
  if (!approvalAllows(entry)) blockers.push(`${kind}_approval_${entry.approvalStatus}`);
  if (!evalAllows(entry)) blockers.push(`${kind}_eval_${entry.evalStatus}`);
  if ("checksumStatus" in entry && entry.checksumStatus && !checksumAllows(entry)) {
    blockers.push(`${kind}_checksum_${entry.checksumStatus}`);
  }
  return blockers;
}

function requiredActionsFromGateBlockers(blockers: string[]): string[] {
  const actions: string[] = [];
  for (const blocker of blockers) {
    if (blocker.includes("approval_pending")) actions.push("request_approval");
    if (blocker.includes("approval_rejected")) actions.push("re_submit_for_approval");
    if (blocker.includes("eval_pending")) actions.push("attach_eval");
    if (blocker.includes("eval_failed")) actions.push("rerun_eval");
    if (blocker.includes("checksum_mismatch")) actions.push("verify_instruction_checksum");
    if (blocker.includes("lifecycle_draft")) actions.push("publish_active_version");
    if (blocker.includes("lifecycle_deprecated") || blocker.includes("lifecycle_archived")) actions.push("select_active_replacement");
  }
  return uniq(actions);
}

function scoreFor(decision: RegistryCompatibilityDecisionValue, reasons: number, warnings: number, blockers: number): number {
  if (decision === "compatible") return Math.max(60, 100 - warnings * 5);
  if (decision === "compatible_with_warnings") return Math.max(40, 80 - warnings * 5);
  if (decision === "future_unknown") return 30;
  if (decision === "blocked_by_policy" || decision === "blocked_by_registry_gate") return 0;
  return Math.max(0, 20 - blockers * 5 - reasons);
}

export class RegistryCompatibilityService {
  private readonly skillProfiles: SkillCompatibilityProfile[];
  private readonly harnessProfiles: HarnessCompatibilityProfile[];
  private readonly instructionProfiles: InstructionCompatibilityProfile[];
  private readonly rules: RegistryCompatibilityRule[];
  private readonly registry?: RegistryCompatibilityServiceInput["registry"];
  private readonly policyEvaluator?: (input: RegistryCompatibilityPolicyEvaluationInput) => RegistryCompatibilityPolicyDecisionSnapshot;
  private readonly now: () => Date;

  constructor(input: RegistryCompatibilityServiceInput = {}) {
    this.skillProfiles = clone(input.skillProfiles ?? defaultSkillCompatibilityProfiles);
    this.harnessProfiles = clone(input.harnessProfiles ?? defaultHarnessCompatibilityProfiles);
    this.instructionProfiles = clone(input.instructionProfiles ?? defaultInstructionCompatibilityProfiles);
    this.rules = clone(input.rules ?? defaultRegistryCompatibilityRules);
    this.registry = input.registry;
    this.policyEvaluator = input.policyEvaluator;
    this.now = input.now ?? (() => new Date());
    void VALID_PROFILE_STATUSES;
  }

  listRules(): RegistryCompatibilityRule[] {
    return clone(this.rules);
  }

  listSkillProfiles(): SkillCompatibilityProfile[] {
    return clone(this.skillProfiles);
  }

  listHarnessProfiles(): HarnessCompatibilityProfile[] {
    return clone(this.harnessProfiles);
  }

  listInstructionProfiles(): InstructionCompatibilityProfile[] {
    return clone(this.instructionProfiles);
  }

  buildContext(input: RegistryCompatibilityContextInput, _context: RegistryCompatibilityServiceContext = {}): RegistryCompatibilityContext {
    void _context;
    const id = input.id ?? createId("compat_ctx");
    const taskKind = (input.taskKind ?? "general").toLowerCase();
    const taskIntent = (input.taskIntent ?? "").toLowerCase().trim();
    return {
      id,
      taskKind,
      taskIntent,
      repoId: input.repoId,
      repoKind: input.repoKind?.toLowerCase(),
      repoLanguages: normalizeStringArray(input.repoLanguages),
      frameworks: normalizeStringArray(input.frameworks),
      packageManagers: normalizeStringArray(input.packageManagers),
      providerId: input.providerId,
      providerKind: input.providerKind?.toLowerCase(),
      modelId: input.modelId,
      modelCapabilities: normalizeStringArray(input.modelCapabilities),
      runnerKind: (input.runnerKind ?? "mock").toLowerCase(),
      harnessRequirements: normalizeStringArray(input.harnessRequirements),
      mcpServerIds: normalizeStringArray(input.mcpServerIds),
      mcpToolIds: normalizeStringArray(input.mcpToolIds),
      highRiskMcpToolIds: normalizeStringArray(input.highRiskMcpToolIds),
      tenantId: input.tenantId,
      teamId: input.teamId,
      projectId: input.projectId,
      remoteNetworkEnabled: Boolean(input.remoteNetworkEnabled ?? false),
      remoteGitEnabled: Boolean(input.remoteGitEnabled ?? false),
      secretsEnabled: Boolean(input.secretsEnabled ?? false),
      metadata: clone(input.metadata ?? {}),
      createdAt: this.now()
    };
  }

  evaluateSkill(skillId: string, context: RegistryCompatibilityContext, serviceContext: RegistryCompatibilityServiceContext = {}): RegistryCompatibilityDecision {
    const policy = this.requirePolicyAllow("registry.compatibility.evaluate", { candidateKind: "skill", candidateId: skillId }, serviceContext);
    if (policy) return policy;
    const skill = this.registry?.listSkills().find((entry) => entry.id === skillId);
    const profile = this.skillProfiles.find((entry) => entry.skillId === skillId);
    return this.evaluateSkillInternal(context, skill, profile, serviceContext);
  }

  evaluateHarness(harnessId: string, context: RegistryCompatibilityContext, serviceContext: RegistryCompatibilityServiceContext = {}): RegistryCompatibilityDecision {
    const policy = this.requirePolicyAllow("registry.compatibility.evaluate", { candidateKind: "harness", candidateId: harnessId }, serviceContext);
    if (policy) return policy;
    const harness = this.registry?.listHarnesses().find((entry) => entry.id === harnessId);
    const profile = this.harnessProfiles.find((entry) => entry.harnessId === harnessId);
    return this.evaluateHarnessInternal(context, harness, profile, serviceContext);
  }

  evaluateInstruction(instructionId: string, context: RegistryCompatibilityContext, serviceContext: RegistryCompatibilityServiceContext = {}): RegistryCompatibilityDecision {
    const policy = this.requirePolicyAllow("registry.compatibility.evaluate", { candidateKind: "instruction", candidateId: instructionId }, serviceContext);
    if (policy) return policy;
    const instruction = this.registry?.listInstructions().find((entry) => entry.id === instructionId);
    const profile = this.instructionProfiles.find((entry) => entry.instructionId === instructionId);
    return this.evaluateInstructionInternal(context, instruction, profile, serviceContext);
  }

  evaluatePackage(packageId: string, context: RegistryCompatibilityContext, serviceContext: RegistryCompatibilityServiceContext = {}): RegistryCompatibilityDecision {
    const policy = this.requirePolicyAllow("registry.compatibility.evaluate", { candidateKind: "package", candidateId: packageId }, serviceContext);
    if (policy) return policy;
    // Packages aggregate skills/harnesses/instructions but the matrix v1 only emits a future-unknown decision.
    return this.createDecision({
      context,
      candidateKind: "package",
      candidateId: packageId,
      candidateName: packageId,
      decision: "future_unknown",
      reasons: ["package_compatibility_aggregation_future"],
      warnings: [],
      blockers: [],
      requiredActions: ["evaluate_individual_artifacts"],
      metadata: { aggregationFuture: true }
    });
  }

  evaluateCandidates(context: RegistryCompatibilityContext, serviceContext: RegistryCompatibilityServiceContext = {}): RegistryCompatibilityDecision[] {
    const policy = this.requirePolicyAllow("registry.compatibility.evaluate", {}, serviceContext);
    if (policy) return [policy];
    const decisions: RegistryCompatibilityDecision[] = [];
    if (this.registry) {
      for (const skill of this.registry.listSkills()) {
        const profile = this.skillProfiles.find((entry) => entry.skillId === skill.id);
        decisions.push(this.evaluateSkillInternal(context, skill, profile, serviceContext));
      }
      for (const harness of this.registry.listHarnesses()) {
        const profile = this.harnessProfiles.find((entry) => entry.harnessId === harness.id);
        decisions.push(this.evaluateHarnessInternal(context, harness, profile, serviceContext));
      }
      for (const instruction of this.registry.listInstructions()) {
        const profile = this.instructionProfiles.find((entry) => entry.instructionId === instruction.id);
        decisions.push(this.evaluateInstructionInternal(context, instruction, profile, serviceContext));
      }
    } else {
      for (const profile of this.skillProfiles) {
        decisions.push(this.evaluateSkillInternal(context, undefined, profile, serviceContext));
      }
      for (const profile of this.harnessProfiles) {
        decisions.push(this.evaluateHarnessInternal(context, undefined, profile, serviceContext));
      }
      for (const profile of this.instructionProfiles) {
        decisions.push(this.evaluateInstructionInternal(context, undefined, profile, serviceContext));
      }
    }
    return decisions;
  }

  getSummary(serviceContext: RegistryCompatibilityServiceContext = {}): RegistryCompatibilitySummary {
    const policyDenied = this.policyEvaluator?.({ action: "registry.compatibility.read", context: serviceContext });
    void policyDenied;
    return {
      status: "v1_implemented",
      planningOnly: true,
      generatedAt: this.now(),
      totalCandidates: 0,
      compatibleCount: 0,
      compatibleWithWarningsCount: 0,
      incompatibleCount: 0,
      blockedByPolicyCount: 0,
      blockedByRegistryGateCount: 0,
      futureUnknownCount: 0,
      ruleCount: this.rules.length,
      skillProfileCount: this.skillProfiles.length,
      harnessProfileCount: this.harnessProfiles.length,
      instructionProfileCount: this.instructionProfiles.length,
      resolverGatesPreserved: true,
      autoApplyEnabled: false,
      registryMutationsExecuted: false,
      externalCallsExecuted: false,
      noSecretsExposed: true,
      envValuesExposed: false
    };
  }

  summarizeDecisions(decisions: RegistryCompatibilityDecision[], serviceContext: RegistryCompatibilityServiceContext = {}): RegistryCompatibilitySummary {
    const base = this.getSummary(serviceContext);
    return {
      ...base,
      totalCandidates: decisions.length,
      compatibleCount: decisions.filter((decision) => decision.decision === "compatible").length,
      compatibleWithWarningsCount: decisions.filter((decision) => decision.decision === "compatible_with_warnings").length,
      incompatibleCount: decisions.filter((decision) => decision.decision === "incompatible").length,
      blockedByPolicyCount: decisions.filter((decision) => decision.decision === "blocked_by_policy").length,
      blockedByRegistryGateCount: decisions.filter((decision) => decision.decision === "blocked_by_registry_gate").length,
      futureUnknownCount: decisions.filter((decision) => decision.decision === "future_unknown").length
    };
  }

  private evaluateSkillInternal(
    context: RegistryCompatibilityContext,
    skill: SkillPackage | undefined,
    profile: SkillCompatibilityProfile | undefined,
    serviceContext: RegistryCompatibilityServiceContext
  ): RegistryCompatibilityDecision {
    const candidateId = skill?.id ?? profile?.skillId ?? "unknown_skill";
    const candidateName = skill?.name ?? profile?.skillId;
    const blockers: string[] = [];
    const warnings: string[] = [];
    const reasons: string[] = [];
    const requiredActions: string[] = [];

    if (skill) {
      const gateBlockers = registryGateBlockers(skill, "skill");
      blockers.push(...gateBlockers);
      requiredActions.push(...requiredActionsFromGateBlockers(gateBlockers));
    }

    if (!profile) {
      return this.createDecision({
        context,
        candidateKind: "skill",
        candidateId,
        candidateName,
        decision: blockers.length > 0 ? "blocked_by_registry_gate" : "future_unknown",
        reasons: blockers.length === 0 ? ["no_compatibility_profile"] : reasons,
        warnings,
        blockers,
        requiredActions,
        metadata: { profileMissing: profile === undefined }
      });
    }

    if (profile.compatibilityStatus !== "active_mock") {
      return this.createDecision({
        context,
        candidateKind: "skill",
        candidateId,
        candidateName,
        decision: profile.compatibilityStatus === "disabled" ? "incompatible" : "future_unknown",
        reasons: [`profile_status_${profile.compatibilityStatus}`],
        warnings,
        blockers,
        requiredActions,
        metadata: { profileStatus: profile.compatibilityStatus }
      });
    }

    if (profile.supportedTaskKinds.length > 0 && !profile.supportedTaskKinds.includes(context.taskKind)) {
      warnings.push(`task_kind_unsupported_${context.taskKind}`);
    }

    if (context.repoLanguages.length > 0 && profile.supportedLanguages.length > 0) {
      const overlap = profile.supportedLanguages.some((language) => context.repoLanguages.includes(language.toLowerCase()));
      if (!overlap) warnings.push("language_mismatch");
    }

    if (context.frameworks.length > 0 && profile.supportedFrameworks.length > 0) {
      const overlap = profile.supportedFrameworks.some((framework) => context.frameworks.includes(framework.toLowerCase()));
      if (!overlap) warnings.push("framework_mismatch");
    }

    if (context.repoKind && profile.supportedRepoKinds.length > 0 && !profile.supportedRepoKinds.includes(context.repoKind)) {
      warnings.push(`repo_kind_unsupported_${context.repoKind}`);
    }

    for (const capability of profile.requiredModelCapabilities) {
      const normalized = capability.toLowerCase();
      if (!context.modelCapabilities.includes(normalized)) {
        blockers.push(`model_capability_missing_${normalized}`);
        requiredActions.push("select_compatible_model");
      }
    }

    for (const capability of profile.forbiddenModelCapabilities) {
      const normalized = capability.toLowerCase();
      if (context.modelCapabilities.includes(normalized)) {
        blockers.push(`model_capability_forbidden_${normalized}`);
      }
    }

    for (const tool of profile.requiredMcpTools) {
      const normalized = tool.toLowerCase();
      if (!context.mcpToolIds.includes(normalized)) {
        blockers.push(`mcp_tool_missing_${normalized}`);
        requiredActions.push("attach_required_mcp_tool");
      }
    }

    for (const tool of profile.forbiddenMcpTools) {
      const normalized = tool.toLowerCase();
      if (context.mcpToolIds.includes(normalized)) {
        blockers.push(`mcp_tool_forbidden_${normalized}`);
      }
    }

    if (context.highRiskMcpToolIds.length > 0 && profile.requiredMcpTools.some((tool) => context.highRiskMcpToolIds.includes(tool.toLowerCase()))) {
      blockers.push("mcp_tool_high_risk_required");
      requiredActions.push("re_review_mcp_risk");
    }

    if (profile.requiredScopes.includes("repo") && !context.repoId) {
      warnings.push("repo_scope_missing");
    }
    if (profile.requiredScopes.includes("tenant") && !context.tenantId) {
      warnings.push("tenant_scope_missing");
    }

    const decision = this.composeDecision(blockers, warnings);
    return this.createDecision({
      context,
      candidateKind: "skill",
      candidateId,
      candidateName,
      decision,
      reasons,
      warnings,
      blockers,
      requiredActions,
      metadata: {
        profileStatus: profile.compatibilityStatus,
        gatePreserved: true
      }
    });
  }

  private evaluateHarnessInternal(
    context: RegistryCompatibilityContext,
    harness: HarnessPackage | undefined,
    profile: HarnessCompatibilityProfile | undefined,
    serviceContext: RegistryCompatibilityServiceContext
  ): RegistryCompatibilityDecision {
    void serviceContext;
    const candidateId = harness?.id ?? profile?.harnessId ?? "unknown_harness";
    const candidateName = harness?.name ?? profile?.harnessId;
    const blockers: string[] = [];
    const warnings: string[] = [];
    const reasons: string[] = [];
    const requiredActions: string[] = [];

    if (harness) {
      const gateBlockers = registryGateBlockers(harness, "harness");
      blockers.push(...gateBlockers);
      requiredActions.push(...requiredActionsFromGateBlockers(gateBlockers));
    }

    if (!profile) {
      return this.createDecision({
        context,
        candidateKind: "harness",
        candidateId,
        candidateName,
        decision: blockers.length > 0 ? "blocked_by_registry_gate" : "future_unknown",
        reasons: blockers.length === 0 ? ["no_compatibility_profile"] : reasons,
        warnings,
        blockers,
        requiredActions,
        metadata: { profileMissing: profile === undefined }
      });
    }

    if (profile.compatibilityStatus !== "active_mock") {
      return this.createDecision({
        context,
        candidateKind: "harness",
        candidateId,
        candidateName,
        decision: profile.compatibilityStatus === "disabled" ? "incompatible" : "future_unknown",
        reasons: [`profile_status_${profile.compatibilityStatus}`],
        warnings,
        blockers,
        requiredActions,
        metadata: { profileStatus: profile.compatibilityStatus }
      });
    }

    if (!profile.supportedRunnerKinds.includes(context.runnerKind)) {
      blockers.push(`runner_kind_unsupported_${context.runnerKind}`);
      requiredActions.push("select_compatible_runner");
    }

    if (context.repoLanguages.length > 0 && profile.supportedLanguages.length > 0) {
      const overlap = profile.supportedLanguages.some((language) => context.repoLanguages.includes(language.toLowerCase()));
      if (!overlap) warnings.push("language_mismatch");
    }

    if (context.frameworks.length > 0 && profile.supportedFrameworks.length > 0) {
      const overlap = profile.supportedFrameworks.some((framework) => context.frameworks.includes(framework.toLowerCase()));
      if (!overlap) warnings.push("framework_mismatch");
    }

    if (profile.networkRequired && !context.remoteNetworkEnabled) {
      blockers.push("network_required_but_disabled");
      requiredActions.push("enable_or_gate_remote_network");
    }

    if (profile.remoteGitRequired && !context.remoteGitEnabled) {
      blockers.push("remote_git_required_but_disabled");
      requiredActions.push("enable_remote_git_gate");
    }

    if (profile.secretsRequired && !context.secretsEnabled) {
      warnings.push("secrets_required_but_disabled");
      requiredActions.push("attach_required_secretref");
    }

    if (profile.forbiddenCommands.length > 0 && context.harnessRequirements.some((requirement) => profile.forbiddenCommands.includes(requirement))) {
      blockers.push("forbidden_command_required");
    }

    const decision = this.composeDecision(blockers, warnings);
    return this.createDecision({
      context,
      candidateKind: "harness",
      candidateId,
      candidateName,
      decision,
      reasons,
      warnings,
      blockers,
      requiredActions,
      metadata: {
        profileStatus: profile.compatibilityStatus,
        gatePreserved: true,
        networkRequired: profile.networkRequired,
        remoteGitRequired: profile.remoteGitRequired
      }
    });
  }

  private evaluateInstructionInternal(
    context: RegistryCompatibilityContext,
    instruction: InstructionArtifact | undefined,
    profile: InstructionCompatibilityProfile | undefined,
    serviceContext: RegistryCompatibilityServiceContext
  ): RegistryCompatibilityDecision {
    void serviceContext;
    const candidateId = instruction?.id ?? profile?.instructionId ?? "unknown_instruction";
    const candidateName = instruction?.name ?? profile?.instructionId;
    const blockers: string[] = [];
    const warnings: string[] = [];
    const reasons: string[] = [];
    const requiredActions: string[] = [];

    if (instruction) {
      const gateBlockers = registryGateBlockers(instruction, "instruction");
      blockers.push(...gateBlockers);
      requiredActions.push(...requiredActionsFromGateBlockers(gateBlockers));
    }

    if (!profile) {
      return this.createDecision({
        context,
        candidateKind: "instruction",
        candidateId,
        candidateName,
        decision: blockers.length > 0 ? "blocked_by_registry_gate" : "future_unknown",
        reasons: blockers.length === 0 ? ["no_compatibility_profile"] : reasons,
        warnings,
        blockers,
        requiredActions,
        metadata: { profileMissing: profile === undefined }
      });
    }

    if (profile.compatibilityStatus !== "active_mock") {
      return this.createDecision({
        context,
        candidateKind: "instruction",
        candidateId,
        candidateName,
        decision: profile.compatibilityStatus === "disabled" ? "incompatible" : "future_unknown",
        reasons: [`profile_status_${profile.compatibilityStatus}`],
        warnings,
        blockers,
        requiredActions,
        metadata: { profileStatus: profile.compatibilityStatus }
      });
    }

    if (profile.supportedTaskKinds.length > 0 && !profile.supportedTaskKinds.includes(context.taskKind)) {
      warnings.push(`task_kind_unsupported_${context.taskKind}`);
    }

    if (context.providerKind && profile.supportedProviderKinds.length > 0 && !profile.supportedProviderKinds.includes(context.providerKind)) {
      blockers.push(`provider_kind_unsupported_${context.providerKind}`);
      requiredActions.push("select_compatible_provider");
    }

    for (const capability of profile.supportedModelCapabilities) {
      const normalized = capability.toLowerCase();
      if (context.modelCapabilities.length > 0 && !context.modelCapabilities.includes(normalized)) {
        warnings.push(`model_capability_recommended_${normalized}`);
      }
    }

    if (profile.requiredScopes.includes("repo") && !context.repoId) {
      warnings.push("repo_scope_missing");
    }

    const decision = this.composeDecision(blockers, warnings);
    return this.createDecision({
      context,
      candidateKind: "instruction",
      candidateId,
      candidateName,
      decision,
      reasons,
      warnings,
      blockers,
      requiredActions,
      metadata: {
        profileStatus: profile.compatibilityStatus,
        gatePreserved: true
      }
    });
  }

  private composeDecision(blockers: string[], warnings: string[]): RegistryCompatibilityDecisionValue {
    if (blockers.some((blocker) => blocker.includes("approval_") || blocker.includes("eval_") || blocker.includes("lifecycle_") || blocker.includes("checksum_"))) {
      return "blocked_by_registry_gate";
    }
    if (blockers.length > 0) return "incompatible";
    if (warnings.length > 0) return "compatible_with_warnings";
    return "compatible";
  }

  private createDecision(input: {
    context: RegistryCompatibilityContext;
    candidateKind: RegistryCompatibilityCandidateKind;
    candidateId: string;
    candidateName?: string;
    decision: RegistryCompatibilityDecisionValue;
    reasons: string[];
    warnings: string[];
    blockers: string[];
    requiredActions: string[];
    metadata: Record<string, unknown>;
  }): RegistryCompatibilityDecision {
    const score = scoreFor(input.decision, input.reasons.length, input.warnings.length, input.blockers.length);
    return {
      id: createId("compat_decision"),
      contextId: input.context.id,
      candidateKind: input.candidateKind,
      candidateId: input.candidateId,
      candidateName: input.candidateName,
      decision: input.decision,
      reasons: uniq(input.reasons),
      warnings: uniq(input.warnings),
      blockers: uniq(input.blockers),
      score,
      requiredActions: uniq(input.requiredActions),
      metadata: {
        ...input.metadata,
        gatePreserved: true,
        autoApplyEnabled: false,
        registryMutationExecuted: false,
        externalCallExecuted: false,
        noSecretsExposed: true
      },
      evaluatedAt: this.now()
    };
  }

  private requirePolicyAllow(
    action: RegistryCompatibilityPolicyAction,
    extra: { candidateKind?: RegistryCompatibilityCandidateKind; candidateId?: string },
    serviceContext: RegistryCompatibilityServiceContext
  ): RegistryCompatibilityDecision | undefined {
    if (!this.policyEvaluator) return undefined;
    const decision = this.policyEvaluator({
      action,
      context: serviceContext,
      candidateKind: extra.candidateKind,
      candidateId: extra.candidateId
    });
    if (decision.decision === "allow") return undefined;
    return this.createDecision({
      context: {
        id: "policy_blocked_context",
        taskKind: "policy_blocked",
        taskIntent: "",
        repoLanguages: [],
        frameworks: [],
        packageManagers: [],
        modelCapabilities: [],
        runnerKind: "mock",
        harnessRequirements: [],
        mcpServerIds: [],
        mcpToolIds: [],
        highRiskMcpToolIds: [],
        remoteNetworkEnabled: false,
        remoteGitEnabled: false,
        secretsEnabled: false,
        metadata: {},
        createdAt: this.now()
      },
      candidateKind: extra.candidateKind ?? "package",
      candidateId: extra.candidateId ?? "policy_blocked",
      decision: "blocked_by_policy",
      reasons: [decision.reason || `policy_decision_${decision.decision}`],
      warnings: [],
      blockers: [decision.reason || `policy_decision_${decision.decision}`],
      requiredActions: ["request_policy_review"],
      metadata: {
        matchedPolicyRuleIds: decision.matchedRuleIds,
        policyDecision: decision.decision
      }
    });
  }
}

export function createRegistryCompatibilityService(input: RegistryCompatibilityServiceInput = {}): RegistryCompatibilityService {
  return new RegistryCompatibilityService(input);
}
