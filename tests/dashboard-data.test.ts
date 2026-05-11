import test from "node:test";
import assert from "node:assert/strict";
import { getDashboardData } from "../apps/web/lib/mock-data.ts";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

test("dashboard data exposes conflict manager v1 simulation and registry package assumptions", async () => {
  const data = await getDashboardData();

  assert.equal(data.activeLeases.length, 2);
  assert.equal(data.conflictRisks.length, 1);
  assert.equal(data.mergeQueue.length, 2);
  assert.equal(data.mergeSimulations.length, 2);
  assert.equal(data.registryOverview.activeSkills, 3);
  assert.equal(data.registryOverview.activeHarnesses, 3);
  assert.equal(data.registryOverview.activeInstructions, 3);
  assert.equal(Array.isArray(data.registryAuditLogs), true);
  assert.equal(data.registryApprovalQueue.some((item) => item.targetName === "auth-debugging"), true);
  assert.equal(data.registryRevisions.length >= 2, true);
  assert.equal(data.registryEvalResults.some((result) => result.evalName === "mock harness smoke"), true);
  assert.equal(data.registryPackages.some((manifest) => manifest.packageKind === "bundle"), true);
  assert.equal(data.registryVersionResolution.name, "jest-test-fixer");
  assert.equal(data.registryVersionResolution.selected?.version, "1.0.0");
  assert.equal(data.registryPackageDiff.summary.includes("changed"), true);
  assert.equal(data.mergeQueue.every((entry) => entry.simulationStatus === "clean"), true);
  assert.equal(data.mergeQueue.some((entry) => entry.recommendation === "manual_review_required"), true);
  assert.equal(data.taskRuns.every((run) => (run.selectedSkillRefs?.length ?? 0) > 0), true);
  assert.equal(data.taskRuns.every((run) => run.selectedHarnessRef !== undefined), true);
  assert.equal(data.improvementFailureSignals.length, 2);
  assert.equal(data.improvementFailureClusters.length, 1);
  assert.equal(data.improvementCandidates.some((candidate) => candidate.status === "proposal_created"), true);
  assert.equal(data.improvementProposals.some((proposal) => proposal.status === "eval_required"), true);
  assert.equal(data.evalRequirements.some((requirement) => requirement.blocking), true);
  assert.equal(data.canaryRolloutPlans.some((plan) => plan.status === "draft"), true);
  assert.equal(data.autoImprovementSafetyPolicies[0]?.allowAutoApply, false);
  assert.equal(data.autoImprovementAnalyses.some((analysis) => analysis.recommendedCandidateType === "update_instruction"), true);
  assert.equal(data.draftRegistryChanges.some((change) => change.status === "draft" && change.draftPayload.activeRegistryMutation === false), true);
  assert.equal(data.proposalReadiness[0]?.blockingReasons.includes("auto_apply_disabled"), true);
  assert.equal(data.proposalReviewQueue.length, 1);
  assert.equal(data.governanceDecisions.some((decision) => decision.decision === "mark_eval_required"), true);
  assert.equal(data.proposalEvalRuns.some((run) => run.status === "pending"), true);
  assert.equal(data.canaryReadiness[0]?.blockingReasons.includes("canary_required"), true);
  assert.equal(data.proposalApplyGates[0]?.blockingReasons.includes("active_apply_not_implemented"), true);
  assert.equal(data.governanceAuditEvents.some((event) => event.action === "proposal_apply_blocked"), true);
  assert.equal(data.gitProviderConfig.providerKind, "mock");
  assert.equal(data.gitProviderConfig.remoteGitEnabled, false);
  assert.equal(data.gitProviders.some((provider) => provider.providerKind === "github" && provider.remote === true && provider.enabled === false), true);
  assert.equal(data.gitBranches.some((branch) => branch.branchName === "codex/fix-login-timeout"), true);
  assert.equal(data.gitPullRequests.some((pullRequest) => pullRequest.url?.startsWith("mock://pull-requests/")), true);
  assert.equal(data.gitChangedFiles.some((file) => file.path === "src/auth/session.ts"), true);
  assert.equal(data.gitMergeQueueLinkage.some((link) => link.recommendation === "manual_review_required"), true);
  assert.equal(data.gitAuditEvents.some((event) => event.action === "git.branch_create_requested"), true);
  assert.equal(data.remoteBlockedOperation.ok, false);
  assert.equal(data.remoteBlockedOperation.reason, "remote_git_disabled");
  assert.equal(data.llmProviderConfig.providerKind, "mock");
  assert.equal(data.llmProviderConfig.remoteLlmEnabled, false);
  assert.equal(data.llmModels.some((model) => model.id === "mock-registry-reviewer@1.0"), true);
  assert.equal(data.virtualModelKeys.some((key) => key.id === "vmk_system_mock"), true);
  assert.equal(data.llmCompletion?.ok, true);
  assert.equal(data.llmUsageEvents.some((event) => event.metadata?.source === "llm_gateway"), true);
  assert.equal(data.llmAuditEvents.some((event) => event.eventType === "llm_completion_succeeded"), true);
  assert.equal(data.remoteLlmBlockedOperation.ok, false);
  assert.equal(data.remoteLlmBlockedOperation.reason, "blocked_remote_llm_disabled");
});

test("dashboard data preserves pending approval exclusion during registry version resolution", async () => {
  const data = await getDashboardData();

  assert.equal(data.pendingApprovalVersionResolution.name, "auth-debugging");
  assert.equal(data.pendingApprovalVersionResolution.selected, undefined);
  assert.equal(
    data.pendingApprovalVersionResolution.warnings.includes("skill auth-debugging@1.0.0 excluded: approvalStatus is pending."),
    true
  );
  assert.equal(
    data.pendingApprovalVersionResolution.errors.includes("No selectable skill version satisfies auth-debugging@^1.0.0."),
    true
  );
});

test("rendered dashboard shows dry-run merge simulation status, queue recommendation, and registry data", async () => {
  const html = await renderDashboardHtml();

  assert.equal(html.includes("Dry-run Merge Simulations"), true);
  assert.equal(html.includes("safe_to_queue"), true);
  assert.equal(html.includes("manual_review_required"), true);
  assert.equal(html.includes("clean"), true);
  assert.equal(html.includes("Registry selection"), true);
  assert.equal(html.includes("auth-debugging"), true);
  assert.equal(html.includes("backend-node20"), true);
  assert.equal(html.includes("org-secure-coding-baseline"), true);
  assert.equal(html.includes("approval approved"), true);
  assert.equal(html.includes("checksum unverified"), true);
  assert.equal(html.includes("Registry Audit"), true);
  assert.equal(html.includes("Approval Queue"), true);
  assert.equal(html.includes("rollback is available through the API"), true);
  assert.equal(html.includes("Mock harness smoke eval passed."), true);
  assert.equal(html.includes("Registry Packages"), true);
  assert.equal(html.includes("Version resolution"), true);
  assert.equal(html.includes("Package diff"), true);
  assert.equal(html.includes("Phase 4 Preparation"), true);
  assert.equal(html.includes("Failure signals"), true);
  assert.equal(html.includes("Improvement proposals"), true);
  assert.equal(html.includes("no auto-apply path exists"), true);
  assert.equal(html.includes("Auto-improvement analyses"), true);
  assert.equal(html.includes("Draft registry changes"), true);
  assert.equal(html.includes("auto_apply_disabled"), true);
  assert.equal(html.includes("Safety policy"), true);
  assert.equal(html.includes("Phase 4 Governance"), true);
  assert.equal(html.includes("Review queue"), true);
  assert.equal(html.includes("Apply gate"), true);
  assert.equal(html.includes("apply is not implemented"), true);
  assert.equal(html.includes("Git Adapter"), true);
  assert.equal(html.includes("remote Git disabled"), true);
  assert.equal(html.includes("codex/fix-login-timeout"), true);
  assert.equal(html.includes("src/auth/session.ts:modified"), true);
  assert.equal(html.includes("git.branch_create_requested"), true);
  assert.equal(html.includes("remote_git_disabled"), true);
  assert.equal(html.includes("LLM Gateway"), true);
  assert.equal(html.includes("remote LLM disabled"), true);
  assert.equal(html.includes("mock-registry-reviewer@1.0"), true);
  assert.equal(html.includes("vmk_system_mock"), true);
  assert.equal(html.includes("llm_completion_succeeded"), true);
  assert.equal(html.includes("blocked_remote_llm_disabled"), true);
});
