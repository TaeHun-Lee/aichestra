import { createSeededStore } from "@aichestra/db";
import { createRegistryService } from "@aichestra/registry";
import { runAgentTaskWorkflow } from "@aichestra/worker";

export async function getDashboardData() {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Fix login timeout bug",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedAgent: "codex",
    selectedModel: "mock-model",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20",
    budgetLimitUsd: 20
  });
  const overlappingTask = store.createTask({
    title: "Update auth session refresh",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedAgent: "codex",
    selectedModel: "mock-model",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20",
    budgetLimitUsd: 20
  });
  await runAgentTaskWorkflow(task.id, { store });
  await runAgentTaskWorkflow(overlappingTask.id, { store });
  const registryService = createRegistryService({
    skillRepository: store,
    harnessRepository: store,
    instructionRepository: store,
    auditRepository: {
      appendAuditLog: (input) => store.appendAuditLog(input),
      listAuditLogs: () => store.listRegistryAuditLogs(),
      listAuditLogsForTarget: (targetKind, targetId) => store.listAuditLogsForTarget(targetKind, targetId)
    },
    historyRepository: store,
    evalResultRepository: store,
    packageRepository: store
  });
  registryService.updateSkillApproval("skill_auth_debugging", { approvalStatus: "pending", reason: "dashboard review queue fixture" });
  registryService.attachEvalResult("harness", "harness_backend_node20", {
    evalName: "mock harness smoke",
    evalType: "mock",
    status: "passed",
    summary: "Mock harness smoke eval passed.",
    source: "mock",
    updateEvalStatus: true
  });
  const skillManifest = registryService.exportPackageManifest({ packageKind: "skill", targetId: "skill_auth_debugging" });
  const bundleManifest = registryService.exportPackageManifest({
    packageKind: "bundle",
    name: "dashboard-registry-bundle",
    version: "1.0.0"
  });

  return {
    totalTasks: store.listTasks().length,
    runningTasks: store.listTasks().filter((item) => item.status === "running").length,
    conflictTasks: store.listTasks().filter((item) => item.status === "conflict_detected" || item.status === "review_required").length,
    mockCostUsd: store.listUsageEvents().reduce((total, event) => total + (event.costUsd ?? 0), 0),
    registryOverview: {
      activeSkills: store.listSkills().filter((skill) => skill.status === "active").length,
      activeHarnesses: store.listHarnesses().filter((harness) => harness.status === "active").length,
      activeInstructions: store.listInstructions().filter((instruction) => instruction.status === "active").length
    },
    tasks: store.listTasks(),
    taskRuns: store.listTaskRuns(),
    activeLeases: store.listBranchLeases("repo_demo_backend", "active"),
    conflictRisks: store.computeRepoConflictRisks("repo_demo_backend"),
    mergeQueue: store.listMergeQueueEntries("repo_demo_backend"),
    mergeSimulations: store.listMergeSimulations({ repoId: "repo_demo_backend" }),
    skills: store.listSkills(),
    harnesses: store.listHarnesses(),
    instructions: store.listInstructions(),
    registryAuditLogs: store.listRegistryAuditLogs(),
    registryRevisions: store.listRevisionsForTarget("skill", "skill_auth_debugging"),
    registryApprovalQueue: registryService.listApprovalQueue(),
    registryEvalResults: store.listEvalResultsForTarget("harness", "harness_backend_node20"),
    registryPackages: registryService.listPackageManifests(),
    registryPackageDiff: registryService.diffPackageManifests(skillManifest, bundleManifest),
    registryVersionResolution: registryService.resolveVersion("skill", "auth-debugging", "^1.0.0")
  };
}
