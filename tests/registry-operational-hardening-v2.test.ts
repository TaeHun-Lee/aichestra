import test from "node:test";
import assert from "node:assert/strict";
import {
  InMemoryRegistryRepository,
  MockRegistryMutationAuthorizer,
  createRegistryService,
  registryApprovalQueueItemToDto,
  registryEvalResultToDto,
  registryRevisionToDto,
  registryRollbackResultToDto
} from "@aichestra/registry";
import type { RegistryActor, SkillPackage } from "@aichestra/core";

const viewer: RegistryActor = { id: "viewer", displayName: "Viewer", roles: ["registry_viewer"] };
const editor: RegistryActor = { id: "editor", displayName: "Editor", roles: ["registry_editor"] };
const reviewer: RegistryActor = { id: "reviewer", displayName: "Reviewer", roles: ["registry_reviewer"] };
const admin: RegistryActor = { id: "admin", displayName: "Admin", roles: ["registry_admin"] };

function serviceFor(repository = new InMemoryRegistryRepository()) {
  return createRegistryService({
    skillRepository: repository,
    harnessRepository: repository,
    instructionRepository: repository,
    auditRepository: repository,
    historyRepository: repository,
    evalResultRepository: repository,
    authorizer: new MockRegistryMutationAuthorizer(),
    defaultActor: admin
  });
}

function skillInput(name = "reviewable-skill") {
  return {
    name,
    version: "1.0.0",
    description: "A reviewable test skill.",
    status: "draft" as const,
    approvalStatus: "pending" as const,
    evalStatus: "pending" as const,
    owner: "platform",
    compatibleAgents: ["codex" as const],
    requiredTools: ["git"],
    requiredHarnesses: ["backend-node20"],
    invocationRules: ["Use in registry hardening tests."],
    evalRefs: [],
    tags: ["test"]
  };
}

test("registry history is append-only for create, status, approval, eval, and checksum changes", () => {
  const service = serviceFor();
  const created = service.createSkill(skillInput(), admin);
  service.updateSkillStatus(created.id, { status: "active", actor: editor, reason: "activate" });
  service.updateSkillApproval(created.id, { approvalStatus: "approved", actor: reviewer, reason: "reviewed" });
  service.updateSkillEval(created.id, { evalStatus: "passed", actor: reviewer, reason: "eval passed" });

  const revisions = service.listRevisionsForTarget("skill", created.id, viewer);
  const firstSnapshot = revisions[0]?.snapshot as Partial<SkillPackage>;
  service.updateSkillStatus(created.id, { status: "deprecated", actor: editor, reason: "superseded" });
  const firstSnapshotAfterFurtherMutation = service.listRevisionsForTarget("skill", created.id, viewer)[0]?.snapshot as Partial<SkillPackage>;

  assert.deepEqual(revisions.map((revision) => revision.revisionNumber), [1, 2, 3, 4]);
  assert.equal(firstSnapshot.status, "draft");
  assert.equal(firstSnapshotAfterFurtherMutation.status, "draft");
  assert.equal(registryRevisionToDto(revisions[0]).createdBy, "admin");
});

test("instruction checksum verification creates revision when checksum metadata changes", () => {
  const service = serviceFor();
  const instruction = service.createInstruction({
    name: "checksum-history",
    version: "1.0.0",
    description: "Checksum history fixture.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    type: "custom",
    scope: "repo",
    body: "checksum body",
    checksum: "sha256:not-the-body",
    precedence: 99,
    appliesToAgents: ["codex"],
    appliesToRepos: ["repo_demo_backend"],
    appliesToDirectories: [],
    maxContextBytes: 2048
  }, admin);

  service.verifyInstructionChecksum(instruction.id, { actor: editor, reason: "local verification" });
  const revisions = service.listRevisionsForTarget("instruction", instruction.id, viewer);

  assert.equal(revisions.length, 2);
  assert.equal((revisions.at(-1)?.snapshot as { checksumStatus?: string }).checksumStatus, "mismatch");
});

test("rollback restores previous skill, harness, and instruction revisions without deleting history", () => {
  const service = serviceFor();
  service.updateSkillApproval("skill_auth_debugging", { approvalStatus: "pending", actor: reviewer, reason: "needs review" });
  const skillRollback = service.rollback({ targetKind: "skill", targetId: "skill_auth_debugging", revisionNumber: 1, actor: admin, reason: "restore approved skill" });

  service.updateHarnessStatus("harness_backend_node20", { status: "deprecated", actor: editor, reason: "bad rollout" });
  const harnessRollback = service.rollback({ targetKind: "harness", targetId: "harness_backend_node20", revisionNumber: 1, actor: admin, reason: "restore harness" });

  service.updateInstructionApproval("instr_org_secure_coding_baseline", { approvalStatus: "pending", actor: reviewer, reason: "review" });
  const instructionRollback = service.rollback({ targetKind: "instruction", targetId: "instr_org_secure_coding_baseline", revisionNumber: 1, actor: admin, reason: "restore instruction" });

  assert.equal(service.getSkill("skill_auth_debugging")?.approvalStatus, "approved");
  assert.equal(service.getHarness("harness_backend_node20")?.status, "active");
  assert.equal(service.getInstruction("instr_org_secure_coding_baseline")?.approvalStatus, "approved");
  assert.equal(service.listRevisionsForTarget("skill", "skill_auth_debugging", viewer).length, 3);
  assert.equal(service.listAuditLogs({ targetKind: "skill", targetId: "skill_auth_debugging", actor: viewer }).some((log) => log.action === "rollback"), true);
  assert.equal(registryRollbackResultToDto(skillRollback).newRevision.revisionNumber, 3);
  assert.equal(harnessRollback.newRevision.revisionNumber, 3);
  assert.equal(instructionRollback.newRevision.revisionNumber, 3);
  assert.throws(() => service.rollback({ targetKind: "skill", targetId: "missing", revisionNumber: 1, actor: admin, reason: "missing" }), /Skill not found/);
});

test("rollback respects resolver gates after restored state", () => {
  const service = serviceFor();
  service.updateSkillApproval("skill_auth_debugging", { approvalStatus: "pending", actor: reviewer, reason: "needs review" });
  service.updateSkillStatus("skill_auth_debugging", { status: "active", actor: editor, reason: "keeps active but pending" });
  const resolutionBeforeRollback = service.resolveRegistryContextForTask({
    task: {
      id: "task_auth",
      title: "Fix auth login timeout",
      status: "draft",
      requesterUserId: "user_demo_admin",
      repoId: "repo_demo_backend",
      baseBranch: "main",
      selectedSkillIds: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    agent: "codex"
  });
  service.rollback({ targetKind: "skill", targetId: "skill_auth_debugging", revisionNumber: 1, actor: admin, reason: "restore selection" });
  const resolutionAfterRollback = service.resolveRegistryContextForTask({
    task: {
      id: "task_auth",
      title: "Fix auth login timeout",
      status: "draft",
      requesterUserId: "user_demo_admin",
      repoId: "repo_demo_backend",
      baseBranch: "main",
      selectedSkillIds: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    agent: "codex"
  });

  assert.equal(resolutionBeforeRollback.selectedSkills.some((skill) => skill.name === "auth-debugging"), false);
  assert.equal(resolutionAfterRollback.selectedSkills.some((skill) => skill.name === "auth-debugging"), true);
});

test("approval queue read model is deterministic and exposes DTOs", () => {
  const service = serviceFor();
  service.updateSkillApproval("skill_auth_debugging", { approvalStatus: "pending", actor: reviewer, reason: "review skill" });
  service.updateHarnessApproval("harness_backend_node20", { approvalStatus: "rejected", actor: reviewer, reason: "reject harness" });
  service.updateInstructionApproval("instr_org_secure_coding_baseline", { approvalStatus: "pending", actor: reviewer, reason: "review instruction" });
  service.updateInstructionStatus("instr_org_secure_coding_baseline", { status: "archived", actor: editor, reason: "archive instruction" });

  const pending = service.listApprovalQueue({}, viewer);
  const rejected = service.listApprovalQueue({ approvalStatus: "rejected" }, viewer);
  const includeArchived = service.listApprovalQueue({ includeArchived: true }, viewer);

  assert.deepEqual(pending.map((item) => item.targetName), ["auth-debugging"]);
  assert.equal(rejected[0]?.targetName, "backend-node20");
  assert.equal(includeArchived.some((item) => item.targetName === "org-secure-coding-baseline"), true);
  assert.equal(registryApprovalQueueItemToDto(pending[0]).requestedBy, "reviewer");
});

test("local eval result attachment is queryable and only affects selection through evalStatus", () => {
  const service = serviceFor();
  const skillEval = service.attachEvalResult("skill", "skill_auth_debugging", {
    evalName: "manual smoke",
    evalType: "manual",
    status: "failed",
    summary: "Manual smoke failed.",
    source: "manual",
    updateEvalStatus: true,
    actor: reviewer
  });
  const harnessEval = service.attachEvalResult("harness", "harness_backend_node20", {
    evalName: "local harness smoke",
    evalType: "local",
    status: "passed",
    score: 1,
    maxScore: 1,
    summary: "Local fixture passed.",
    source: "local_fixture",
    updateEvalStatus: true,
    actor: reviewer
  });
  const instructionEval = service.attachEvalResult("instruction", "instr_org_secure_coding_baseline", {
    evalName: "instruction note",
    evalType: "mock",
    status: "skipped",
    summary: "Skipped; no status change requested.",
    source: "mock",
    actor: reviewer
  });

  const resolution = service.resolveRegistryContextForTask({
    task: {
      id: "task_auth",
      title: "Fix auth login timeout",
      status: "draft",
      requesterUserId: "user_demo_admin",
      repoId: "repo_demo_backend",
      baseBranch: "main",
      selectedSkillIds: [],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    agent: "codex"
  });

  assert.equal(service.getSkill("skill_auth_debugging")?.evalStatus, "failed");
  assert.equal(service.getHarness("harness_backend_node20")?.evalStatus, "passed");
  assert.equal(service.listEvalResultsForTarget("skill", "skill_auth_debugging", viewer).length, 1);
  assert.equal(registryEvalResultToDto(skillEval).status, "failed");
  assert.equal(harnessEval.status, "passed");
  assert.equal(instructionEval.status, "skipped");
  assert.equal(resolution.selectedSkills.some((skill) => skill.name === "auth-debugging"), false);
  assert.equal(service.listAuditLogs({ targetKind: "skill", targetId: "skill_auth_debugging", actor: viewer }).some((log) => log.action === "attach_eval_result"), true);
});

test("mock mutation authorization enforces viewer, editor, reviewer, and admin roles", () => {
  const service = serviceFor();
  assert.equal(service.listSkills(viewer).length > 0, true);
  assert.throws(() => service.createSkill(skillInput("viewer-denied"), viewer), /missing permission registry.create/);

  const created = service.createSkill(skillInput("editor-created"), editor);
  service.updateSkillStatus(created.id, { status: "active", actor: editor });
  assert.throws(() => service.updateSkillApproval(created.id, { approvalStatus: "approved", actor: editor }), /missing permission registry.approval.change/);

  service.updateSkillApproval(created.id, { approvalStatus: "approved", actor: reviewer });
  service.attachEvalResult("skill", created.id, {
    evalName: "reviewer eval",
    evalType: "mock",
    status: "passed",
    summary: "Reviewer can attach evals.",
    source: "mock",
    updateEvalStatus: true,
    actor: reviewer
  });
  assert.throws(() => service.rollback({ targetKind: "skill", targetId: created.id, revisionNumber: 1, actor: reviewer, reason: "reviewer rollback" }), /missing permission registry.rollback/);

  const beforeDenied = service.getSkill(created.id)?.approvalStatus;
  assert.throws(() => service.updateSkillApproval(created.id, { approvalStatus: "rejected", actor: viewer }), /missing permission registry.approval.change/);
  assert.equal(service.getSkill(created.id)?.approvalStatus, beforeDenied);

  const rollback = service.rollback({ targetKind: "skill", targetId: created.id, revisionNumber: 1, actor: admin, reason: "admin rollback" });
  assert.equal(rollback.newRevision.revisionNumber > 1, true);
});
