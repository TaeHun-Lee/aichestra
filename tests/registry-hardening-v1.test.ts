import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { InMemoryAichestraStore, createSeededStore } from "@aichestra/db";
import { runAgentTaskWorkflow } from "@aichestra/worker";
import {
  FileBackedRegistryRepository,
  InMemoryRegistryRepository,
  createDefaultRegistry,
  createRegistryService,
  harnessToDto,
  instructionToDto,
  registryAuditLogToDto,
  registryResolutionToDto,
  resolveRegistryContextForTask,
  sha256Checksum,
  skillToDto
} from "@aichestra/registry";
import type { HarnessPackage, InstructionArtifact, SkillPackage, Task } from "@aichestra/core";

const now = new Date("2026-01-01T00:00:00.000Z");

function task(title: string): Task {
  return {
    id: `task_${title.replaceAll(" ", "_").toLowerCase()}`,
    title,
    status: "draft",
    requesterUserId: "user_demo_admin",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: [],
    createdAt: now,
    updatedAt: now
  };
}

function serviceFor(repository: InMemoryRegistryRepository | FileBackedRegistryRepository) {
  return createRegistryService({
    skillRepository: repository,
    harnessRepository: repository,
    instructionRepository: repository,
    auditRepository: repository,
    repoRoot: process.cwd()
  });
}

function skillPatch(id: string, patch: Partial<SkillPackage>): SkillPackage[] {
  return createDefaultRegistry().skills.map((skill) => skill.id === id ? { ...skill, ...patch } : skill);
}

function harnessPatch(id: string, patch: Partial<HarnessPackage>): HarnessPackage[] {
  return createDefaultRegistry().harnesses.map((harness) => harness.id === id ? { ...harness, ...patch } : harness);
}

function instructionPatch(id: string, patch: Partial<InstructionArtifact>): InstructionArtifact[] {
  return createDefaultRegistry().instructions.map((instruction) => instruction.id === id ? { ...instruction, ...patch } : instruction);
}

test("registry repositories expose in-memory and file-backed persistence behind the same boundary", () => {
  const memory = new InMemoryRegistryRepository();
  assert.equal(memory.getSkillByNameVersion("auth-debugging", "1.0.0")?.id, "skill_auth_debugging");

  const dir = mkdtempSync(path.join(tmpdir(), "aichestra-registry-"));
  const filePath = path.join(dir, "registry.json");
  const first = new FileBackedRegistryRepository(filePath);
  first.updateSkill("skill_auth_debugging", { approvalStatus: "pending" });

  const second = new FileBackedRegistryRepository(filePath);
  assert.equal(second.getSkillById("skill_auth_debugging")?.approvalStatus, "pending");
});

test("registry DTO mappers expose stable API shapes", () => {
  const snapshot = createDefaultRegistry();
  const skillDto = skillToDto(snapshot.skills[0]);
  const harnessDto = harnessToDto(snapshot.harnesses[0]);
  const instructionDto = instructionToDto(snapshot.instructions[0]);
  const resolutionDto = registryResolutionToDto(resolveRegistryContextForTask({
    task: task("Fix backend login timeout"),
    agent: "codex",
    skills: snapshot.skills,
    harnesses: snapshot.harnesses,
    instructions: snapshot.instructions
  }));
  const logDto = registryAuditLogToDto({
    id: "regaudit_1",
    actorId: "mock-admin",
    action: "create",
    targetKind: "skill",
    targetId: skillDto.id,
    targetName: skillDto.name,
    targetVersion: skillDto.version,
    createdAt: now
  });

  assert.equal(skillDto.approvalStatus, "approved");
  assert.equal(harnessDto.evalStatus, "passed");
  assert.equal(instructionDto.checksumStatus, "unverified");
  assert.equal(typeof resolutionDto.resolvedAt, "string");
  assert.equal(logDto.action, "create");
});

test("registry service writes audit logs for create, status, approval, eval, and checksum changes", () => {
  const repository = new InMemoryRegistryRepository();
  const service = serviceFor(repository);
  const created = service.createSkill({
    name: "docs-polisher",
    version: "1.0.0",
    description: "Improve short documentation changes.",
    status: "draft",
    owner: "platform",
    compatibleAgents: ["codex"],
    requiredTools: ["git"],
    requiredHarnesses: ["backend-node20"],
    invocationRules: ["Select for documentation tasks."],
    evalRefs: [],
    tags: ["docs"]
  });

  service.updateSkillStatus(created.id, { status: "active", reason: "ready for review" });
  service.updateSkillApproval(created.id, { approvalStatus: "approved" });
  service.updateSkillEval(created.id, { evalStatus: "passed" });
  const instruction = service.createInstruction({
    name: "body-checksum",
    version: "1.0.0",
    description: "Checksum test instruction.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    type: "custom",
    scope: "repo",
    body: "stable body",
    checksum: sha256Checksum("stable body"),
    precedence: 90,
    appliesToAgents: ["codex"],
    appliesToRepos: ["repo_demo_backend"],
    appliesToDirectories: [],
    maxContextBytes: 2048
  });
  service.verifyInstructionChecksum(instruction.id);

  const actions = service.listAuditLogs().map((log) => log.action);
  assert.equal(actions.includes("create"), true);
  assert.equal(actions.includes("status_change"), true);
  assert.equal(actions.includes("approve"), true);
  assert.equal(actions.includes("mark_eval_passed"), true);
  assert.equal(actions.includes("checksum_verified"), true);
});

test("resolver enforces lifecycle, approval, eval, and checksum gates with warnings", () => {
  const snapshot = createDefaultRegistry();
  const pendingApproval = resolveRegistryContextForTask({
    task: task("Fix auth login timeout"),
    agent: "codex",
    skills: skillPatch("skill_auth_debugging", { approvalStatus: "pending" }),
    harnesses: snapshot.harnesses,
    instructions: snapshot.instructions
  });
  const failedEval = resolveRegistryContextForTask({
    task: task("Fix auth login timeout"),
    agent: "codex",
    skills: skillPatch("skill_auth_debugging", { evalStatus: "failed" }),
    harnesses: snapshot.harnesses,
    instructions: snapshot.instructions
  });
  const rejectedHarness = resolveRegistryContextForTask({
    task: task("Fix backend login timeout"),
    agent: "codex",
    skills: snapshot.skills,
    harnesses: harnessPatch("harness_backend_node20", { approvalStatus: "rejected" }),
    instructions: snapshot.instructions
  });
  const checksumMismatch = resolveRegistryContextForTask({
    task: task("Fix backend login timeout"),
    agent: "codex",
    skills: snapshot.skills,
    harnesses: snapshot.harnesses,
    instructions: instructionPatch("instr_org_secure_coding_baseline", { checksumStatus: "mismatch" })
  });
  const notRequiredStatuses = resolveRegistryContextForTask({
    task: task("Fix auth login timeout"),
    agent: "codex",
    skills: skillPatch("skill_auth_debugging", { approvalStatus: "not_required", evalStatus: "not_required" }),
    harnesses: snapshot.harnesses,
    instructions: snapshot.instructions
  });

  assert.equal(pendingApproval.selectedSkills.some((skill) => skill.name === "auth-debugging"), false);
  assert.equal(pendingApproval.warnings.some((warning) => warning.includes("approvalStatus is pending")), true);
  assert.equal(failedEval.selectedSkills.some((skill) => skill.name === "auth-debugging"), false);
  assert.equal(failedEval.warnings.some((warning) => warning.includes("evalStatus is failed")), true);
  assert.notEqual(rejectedHarness.selectedHarness.name, "backend-node20");
  assert.equal(rejectedHarness.warnings.some((warning) => warning.includes("approvalStatus is rejected")), true);
  assert.equal(checksumMismatch.selectedInstructions.some((instruction) => instruction.name === "org-secure-coding-baseline"), false);
  assert.equal(checksumMismatch.warnings.some((warning) => warning.includes("checksumStatus is mismatch")), true);
  assert.equal(notRequiredStatuses.selectedSkills.some((skill) => skill.name === "auth-debugging"), true);
});

test("checksum verification supports body, local safe path, mismatch, and unsafe paths", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "aichestra-checksum-"));
  const repository = new InMemoryRegistryRepository();
  const service = createRegistryService({
    skillRepository: repository,
    harnessRepository: repository,
    instructionRepository: repository,
    auditRepository: repository,
    repoRoot: dir
  });
  writeFileSync(path.join(dir, "safe-instruction.md"), "safe file", "utf8");
  const bodyInstruction = service.createInstruction({
    name: "body-checksum-ok",
    version: "1.0.0",
    description: "Body checksum instruction.",
    status: "active",
    approvalStatus: "approved",
    evalStatus: "passed",
    owner: "platform",
    type: "custom",
    scope: "repo",
    body: "stable body",
    checksum: sha256Checksum("stable body"),
    precedence: 90,
    appliesToAgents: ["codex"],
    appliesToRepos: ["repo_demo_backend"],
    appliesToDirectories: [],
    maxContextBytes: 2048
  });
  const mismatchInstruction = service.createInstruction({
    ...bodyInstruction,
    id: undefined,
    name: "body-checksum-bad",
    checksum: sha256Checksum("different body")
  });
  const fileInstruction = service.createInstruction({
    ...bodyInstruction,
    id: undefined,
    name: "file-checksum-ok",
    body: undefined,
    path: "safe-instruction.md",
    checksum: sha256Checksum("safe file")
  });
  const unsafeInstruction = service.createInstruction({
    ...bodyInstruction,
    id: undefined,
    name: "unsafe-path",
    body: undefined,
    path: "../outside.md",
    checksum: sha256Checksum("outside")
  });

  assert.equal(service.verifyInstructionChecksum(bodyInstruction.id).checksumStatus, "verified");
  assert.equal(service.verifyInstructionChecksum(mismatchInstruction.id).checksumStatus, "mismatch");
  assert.equal(service.verifyInstructionChecksum(fileInstruction.id).checksumStatus, "verified");
  assert.equal(service.verifyInstructionChecksum(unsafeInstruction.id).checksumStatus, "unavailable");
});

test("task workflow records hardened registry warnings and preserves usage attribution", async () => {
  const snapshot = createDefaultRegistry();
  const store = new InMemoryAichestraStore({
    skills: skillPatch("skill_auth_debugging", { approvalStatus: "pending" }),
    harnesses: snapshot.harnesses,
    instructions: snapshot.instructions
  });
  const workflowTask = store.createTask({
    title: "Fix auth login timeout",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: ["skill_auth_debugging"]
  });

  const result = await runAgentTaskWorkflow(workflowTask.id, { store });
  const taskRun = store.listTaskRuns(workflowTask.id).at(-1);
  const usage = store.listUsageEvents().find((event) => event.id === result.usageEventIds[0]);

  assert.equal(taskRun?.registryResolutionWarnings?.some((warning) => warning.includes("approvalStatus is pending")), true);
  assert.equal(taskRun?.selectedSkillRefs?.some((ref) => ref.name === "auth-debugging"), false);
  assert.equal(usage?.taskId, workflowTask.id);
  assert.equal(usage?.taskRunId, taskRun?.id);
});
