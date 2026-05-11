import test from "node:test";
import assert from "node:assert/strict";
import { createId } from "@aichestra/core";
import { createInMemoryStorageProvider, createPostgresStorageProvider } from "@aichestra/db";
import type { StorageProvider } from "@aichestra/db";
import { createImprovementServices } from "@aichestra/improvement";
import { createRegistryService, createSkillPackage } from "@aichestra/registry";

async function runRepositoryContracts(name: string, createProvider: () => StorageProvider): Promise<void> {
  const suffix = createId("contract");
  const provider = createProvider();
  const health = await provider.healthCheck();
  assert.equal(health.healthy, true);

  const taskRepository = provider.repositoryFactory.createTaskRepository();
  const taskRunRepository = provider.repositoryFactory.createTaskRunRepository();
  const usageRepository = provider.repositoryFactory.createUsageLedgerRepository();
  const conflictRepositories = provider.repositoryFactory.createConflictRepositories();
  const registryRepositories = provider.repositoryFactory.createRegistryRepositories();
  const improvementRepository = provider.repositoryFactory.createImprovementRepositories();

  const task = taskRepository.createTask({
    title: `${name} repository contract task`,
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: ["skill_auth_debugging"],
    selectedHarnessId: "harness_backend_node20"
  });
  assert.equal(taskRepository.getTask(task.id)?.id, task.id);

  const taskRun = taskRunRepository.createTaskRun({
    taskId: task.id,
    attempt: 1,
    status: "running",
    agent: "codex",
    model: "mock-model"
  });
  assert.equal(taskRunRepository.listTaskRuns(task.id)[0]?.id, taskRun.id);

  const usage = usageRepository.recordUsage({
    taskId: task.id,
    taskRunId: taskRun.id,
    userId: task.requesterUserId,
    repoId: task.repoId,
    provider: "mock",
    model: "mock-model",
    eventType: "llm_call",
    inputTokens: 12,
    outputTokens: 6,
    costUsd: 0.001,
    metadata: { contract: true }
  });
  assert.equal(usageRepository.listUsageEvents().some((entry) => entry.id === usage.id && entry.taskRunId === taskRun.id), true);

  const lease = conflictRepositories.createBranchLease({
    taskId: task.id,
    taskRunId: taskRun.id,
    repoId: task.repoId,
    branchId: `contract-branch-a-${suffix}`,
    branchName: `codex/contract-a-${suffix}`,
    baseBranch: "main",
    files: ["src/auth/session.ts"],
    symbols: [],
    tests: [],
    status: "active"
  });
  const secondLease = conflictRepositories.createBranchLease({
    taskId: createId("task"),
    taskRunId: createId("run"),
    repoId: task.repoId,
    branchId: `contract-branch-b-${suffix}`,
    branchName: `codex/contract-b-${suffix}`,
    baseBranch: "main",
    files: ["src/auth/session.ts"],
    symbols: [],
    tests: [],
    status: "active"
  });
  const risks = conflictRepositories.computeRepoConflictRisks(task.repoId);
  assert.equal(risks.some((risk) => risk.sourceLeaseId === lease.id || risk.targetLeaseId === lease.id), true);
  assert.equal(risks.some((risk) => risk.sourceLeaseId === secondLease.id || risk.targetLeaseId === secondLease.id), true);

  const simulation = conflictRepositories.recordMergeSimulation({
    id: createId("merge_sim"),
    repoId: task.repoId,
    baseRef: "main",
    sourceRef: lease.branchName,
    targetRef: "main",
    taskRunId: taskRun.id,
    branchLeaseId: lease.id,
    mode: "mock",
    status: "clean",
    conflictingFiles: [],
    changedFiles: ["src/auth/session.ts"],
    summary: "Mock contract simulation is clean.",
    rawCommandMetadata: { command: "mock merge-tree", exitCode: 0 },
    riskContribution: 0,
    createdAt: new Date()
  });
  assert.equal(conflictRepositories.listMergeSimulations({ taskRunId: taskRun.id })[0]?.id, simulation.id);

  const queue = conflictRepositories.createMergeQueueEntry({
    repoId: task.repoId,
    taskId: task.id,
    taskRunId: taskRun.id,
    branchLeaseId: lease.id,
    pullRequestId: `pr_contract_${suffix}`,
    pullRequestUrl: `mock://pull-requests/pr_contract_${suffix}`,
    branchName: lease.branchName,
    priority: 1,
    riskScore: 0
  });
  assert.equal(conflictRepositories.listMergeQueueEntries(task.repoId).some((entry) => entry.id === queue.id), true);

  const skill = registryRepositories.skillRepository.createSkill(createSkillPackage({
    id: `skill_contract_docs_polisher_${suffix}`,
    name: `contract-docs-polisher-${suffix}`,
    version: "1.0.0",
    description: "Repository contract skill.",
    status: "draft",
    approvalStatus: "not_required",
    evalStatus: "not_required",
    owner: "platform",
    compatibleAgents: ["codex"],
    compatibleModels: ["mock-model"],
    requiredTools: ["git"],
    requiredHarnesses: ["backend-node20"],
    invocationRules: ["Use in repository contract tests."],
    evalRefs: [],
    tags: ["contract"],
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  assert.equal(registryRepositories.skillRepository.getSkillById(skill.id)?.name, `contract-docs-polisher-${suffix}`);

  const audit = registryRepositories.auditRepository.appendAuditLog({
    actorId: "contract-test",
    action: "create",
    targetKind: "skill",
    targetId: skill.id,
    targetName: skill.name,
    targetVersion: skill.version,
    after: { id: skill.id },
    reason: "repository contract"
  });
  assert.equal(registryRepositories.auditRepository.listAuditLogsForTarget("skill", skill.id)[0]?.id, audit.id);

  const revision = registryRepositories.historyRepository?.appendRevision({
    targetKind: "skill",
    targetId: skill.id,
    targetName: skill.name,
    targetVersion: skill.version,
    revisionNumber: 1,
    snapshot: { id: skill.id, name: skill.name },
    snapshotChecksum: "sha256:contract",
    changeReason: "repository contract",
    createdBy: "contract-test",
    sourceAuditLogId: audit.id
  });
  assert.equal(registryRepositories.historyRepository?.getRevision(revision?.id ?? "")?.targetId, skill.id);

  const registryService = createRegistryService(registryRepositories);
  const manifest = registryService.exportPackageManifest({ packageKind: "skill", targetId: skill.id });
  assert.equal(registryRepositories.packageRepository?.getPackageManifestById(manifest.id)?.id, manifest.id);

  const improvementServices = createImprovementServices(improvementRepository);
  improvementServices.signals.createSignal({
    sourceType: "manual",
    sourceId: `repository_contract_signal_${suffix}`,
    targetKind: "instruction",
    targetRef: "repo-agents-md@1.0.0",
    severity: "medium",
    category: "registry_resolution_warning",
    summary: "Repository contract warning."
  });
  const cluster = improvementServices.clustering.recomputeClusters()[0];
  assert.ok(cluster);
  const candidate = improvementServices.autoImprovement.generateImprovementCandidate(cluster.id);
  const proposal = improvementServices.autoImprovement.generateImprovementProposal(candidate.id);
  const draftChange = improvementServices.autoImprovement.prepareDraftRegistryChange(proposal.id);
  const decision = improvementServices.governance.recordDecision({
    proposalId: proposal.id,
    decision: "mark_eval_required",
    reason: "repository contract decision"
  });
  const requirement = improvementServices.evalRequirements.createRequirement({
    targetKind: proposal.targetKind,
    targetId: proposal.targetId,
    requirementName: "repository contract eval",
    requirementType: "mock_eval",
    requiredStatus: "passed",
    description: "Repository contract eval metadata.",
    blocking: true
  });
  const evalRun = improvementServices.proposalEvalRuns.attachEvalRun({
    proposalId: proposal.id,
    evalRequirementId: requirement.id,
    status: "passed",
    summary: "Repository contract eval passed."
  });

  assert.equal(improvementRepository.getImprovementProposal(proposal.id)?.id, proposal.id);
  assert.equal(improvementRepository.getDraftRegistryChange(draftChange.id)?.id, draftChange.id);
  assert.equal(improvementRepository.listProposalGovernanceDecisions(proposal.id)[0]?.id, decision.id);
  assert.equal(improvementRepository.listProposalEvalRuns(proposal.id)[0]?.id, evalRun.id);
}

test("in-memory storage provider satisfies repository contracts for future persistent implementations", async () => {
  await runRepositoryContracts("in-memory", createInMemoryStorageProvider);
});

test(
  "postgres storage provider satisfies repository contracts when a test database URL is configured",
  {
    skip: process.env.AICHESTRA_TEST_DATABASE_URL
      ? false
      : "Set AICHESTRA_TEST_DATABASE_URL to run optional Postgres repository contract tests."
  },
  async () => {
    await runRepositoryContracts("postgres", () =>
      createPostgresStorageProvider({ databaseUrl: process.env.AICHESTRA_TEST_DATABASE_URL ?? "" })
    );
  }
);
