import { InMemoryImprovementRepository, createImprovementServices } from "@aichestra/improvement";

export function createImprovementDemoData() {
  const improvementRepository = new InMemoryImprovementRepository();
  const improvementServices = createImprovementServices(improvementRepository);

  improvementServices.signals.createSignal({
    sourceType: "registry_resolver",
    sourceId: "resolver_dashboard_fixture",
    taskId: "task_dashboard_registry_warning",
    taskRunId: "run_dashboard_registry_warning",
    targetKind: "instruction",
    targetRef: "repo-agents-md@1.0.0",
    severity: "medium",
    category: "registry_resolution_warning",
    summary: "Instruction resolution produced a checksum warning in a mock dashboard fixture.",
    details: "Phase 4 Preparation captures this as an observable signal only.",
    metadata: { mockOnly: true }
  });

  improvementServices.signals.createSignal({
    sourceType: "test_result",
    sourceId: "test_dashboard_fixture",
    targetKind: "instruction",
    targetRef: "repo-agents-md@1.0.0",
    severity: "low",
    category: "registry_resolution_warning",
    summary: "A second deterministic signal keeps clustering visible.",
    metadata: { mockOnly: true }
  });

  const clusters = improvementServices.clustering.recomputeClusters();
  const cluster = clusters[0];
  const analysis = cluster ? improvementServices.autoImprovement.analyzeFailureCluster(cluster.id) : undefined;
  const candidate = cluster ? improvementServices.autoImprovement.generateImprovementCandidate(cluster.id) : undefined;
  const proposal = candidate ? improvementServices.autoImprovement.generateImprovementProposal(candidate.id) : undefined;
  const evalRequirement = improvementServices.evalRequirements.createRequirement({
    targetKind: "instruction",
    targetId: proposal?.targetId ?? "instruction_repo-agents-md",
    requirementName: "manual instruction review",
    requirementType: "manual_review",
    requiredStatus: "approved",
    description: "A reviewer must approve any future instruction change.",
    blocking: true
  });
  const draftRegistryChange = proposal ? improvementServices.autoImprovement.prepareDraftRegistryChange(proposal.id) : undefined;
  const governanceDecision = proposal ? improvementServices.governance.recordDecision({
    proposalId: proposal.id,
    decision: "mark_eval_required",
    reason: "Dashboard fixture keeps the proposal gated behind local/mock eval metadata."
  }) : undefined;
  const evalRun = proposal ? improvementServices.proposalEvalRuns.attachEvalRun({
    proposalId: proposal.id,
    evalRequirementId: evalRequirement.id,
    status: "pending",
    summary: "Mock eval metadata is attached but no eval suite has executed."
  }) : undefined;
  if (proposal) {
    improvementServices.canaryPlans.createPlan({
      proposalId: proposal.id,
      targetKind: proposal.targetKind,
      targetId: proposal.targetId,
      stages: [
        {
          name: "mock canary",
          percentage: 10,
          scope: "mock task fixtures",
          successCriteria: ["No resolver warnings increase"],
          rollbackCriteria: ["Any critical failure signal appears"]
        }
      ]
    });
  }
  const readiness = proposal ? improvementServices.autoImprovement.evaluateProposalReadiness(proposal.id) : undefined;
  const canaryReadiness = proposal ? improvementServices.canaryReadiness.evaluate(proposal.id) : undefined;
  const applyGate = proposal ? improvementServices.applyGate.evaluate(proposal.id) : undefined;

  return {
    failureSignals: improvementServices.signals.listSignals(),
    failureClusters: improvementServices.clustering.listClusters(),
    improvementCandidates: improvementServices.candidates.listCandidates(),
    improvementProposals: improvementServices.proposals.listProposals(),
    evalRequirements: improvementServices.evalRequirements.listRequirements(),
    canaryRolloutPlans: improvementServices.canaryPlans.listPlans(),
    safetyPolicies: improvementServices.safetyPolicies.listPolicies(),
    autoImprovementAnalyses: analysis ? [analysis] : [],
    draftRegistryChanges: draftRegistryChange ? [draftRegistryChange] : [],
    proposalReadiness: readiness ? [readiness] : [],
    proposalReviewQueue: improvementServices.governance.listReviewQueue(),
    governanceDecisions: governanceDecision ? [governanceDecision] : [],
    proposalEvalRuns: evalRun ? [evalRun] : [],
    canaryReadiness: canaryReadiness ? [canaryReadiness] : [],
    proposalApplyGates: applyGate ? [applyGate] : [],
    governanceAuditEvents: improvementServices.governance.listAuditEvents()
  };
}
