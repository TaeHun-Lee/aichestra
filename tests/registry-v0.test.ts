import test from "node:test";
import assert from "node:assert/strict";
import { createSeededStore } from "@aichestra/db";
import { runAgentTaskWorkflow } from "@aichestra/worker";
import {
  InMemoryHarnessRegistry,
  InMemoryInstructionRegistry,
  InMemorySkillRegistry,
  createDefaultRegistry,
  createHarnessDefinition,
  createInstructionArtifact,
  createSkillPackage,
  registryRefFromSkill,
  resolveRegistryContextForTask
} from "@aichestra/registry";

const now = new Date("2026-01-01T00:00:00.000Z");

function skillInput(name = "docs-polisher") {
  return {
    name,
    version: "1.0.0",
    description: "Improve short documentation changes.",
    status: "draft" as const,
    owner: "platform",
    compatibleAgents: ["codex" as const],
    compatibleModels: ["mock-model"],
    requiredTools: ["git"],
    requiredHarnesses: ["backend-node20"],
    invocationRules: ["Select for documentation-only polish tasks."],
    evalRefs: [],
    tags: ["docs"],
    createdAt: now,
    updatedAt: now
  };
}

function harnessInput(name = "docs-node20") {
  return {
    name,
    version: "1.0.0",
    description: "Node 20 docs harness.",
    status: "draft" as const,
    owner: "platform",
    runtimeType: "docker" as const,
    runtimeImage: "node:20",
    allowedTools: ["git", "node"],
    allowedMcpServers: [],
    secretScopes: [],
    networkPolicy: { mode: "disabled" as const },
    testCommands: ["pnpm test"],
    compatibleAgents: ["codex" as const],
    instructionLoadingPolicy: {
      enabled: true,
      scopes: ["org" as const, "repo" as const],
      maxContextBytes: 8192
    },
    createdAt: now,
    updatedAt: now
  };
}

function instructionInput(name = "docs-guidance") {
  return {
    name,
    version: "1.0.0",
    description: "Documentation guidance.",
    status: "draft" as const,
    owner: "platform",
    type: "custom" as const,
    scope: "repo" as const,
    body: "Keep docs concise and accurate.",
    checksum: "sha256:docs-guidance-v1",
    precedence: 50,
    appliesToAgents: ["codex" as const],
    appliesToRepos: ["repo_demo_backend"],
    appliesToDirectories: [],
    maxContextBytes: 4096,
    createdAt: now,
    updatedAt: now
  };
}

test("registry domain factories validate separate Skill, Harness, and InstructionArtifact concepts", () => {
  const skill = createSkillPackage(skillInput());
  const harness = createHarnessDefinition(harnessInput());
  const instruction = createInstructionArtifact(instructionInput());

  assert.equal(skill.requiredHarnesses.includes("backend-node20"), true);
  assert.equal("networkPolicy" in skill, false);
  assert.equal(harness.networkPolicy.mode, "disabled");
  assert.equal("checksum" in harness, false);
  assert.equal(instruction.checksum.startsWith("sha256:"), true);
  assert.equal(instruction.scope, "repo");
});

test("RegistryVersionRef uses exact version pinning", () => {
  const skill = createSkillPackage({ ...skillInput(), id: "skill_docs_polisher", status: "active" });
  const ref = registryRefFromSkill(skill);

  assert.deepEqual(ref, {
    kind: "skill",
    id: "skill_docs_polisher",
    name: "docs-polisher",
    version: "1.0.0"
  });
});

test("in-memory registries list, get, create, and update statuses", () => {
  const snapshot = createDefaultRegistry();
  const skills = new InMemorySkillRegistry(snapshot);
  const harnesses = new InMemoryHarnessRegistry(snapshot);
  const instructions = new InMemoryInstructionRegistry(snapshot);

  assert.equal(skills.listSkills().length, 3);
  assert.equal(skills.getSkill("skill_auth_debugging")?.name, "auth-debugging");
  const createdSkill = skills.createSkill(skillInput("docs-polisher"));
  assert.equal(skills.updateSkillStatus(createdSkill.id, "active").status, "active");

  assert.equal(harnesses.listHarnesses().length, 3);
  assert.equal(harnesses.getHarness("harness_backend_node20")?.name, "backend-node20");
  const createdHarness = harnesses.createHarness(harnessInput("docs-node20"));
  assert.equal(harnesses.updateHarnessStatus(createdHarness.id, "active").status, "active");

  assert.equal(instructions.listInstructions().length, 3);
  assert.equal(instructions.getInstruction("instr_org_secure_coding_baseline")?.name, "org-secure-coding-baseline");
  const createdInstruction = instructions.createInstruction(instructionInput("docs-guidance"));
  assert.equal(instructions.updateInstructionStatus(createdInstruction.id, "active").status, "active");
});

test("registry resolver selects deterministic defaults for backend, frontend, conflict, and repo tasks", () => {
  const snapshot = createDefaultRegistry();
  const baseTask = {
    id: "task_1",
    title: "Fix backend login timeout",
    status: "draft" as const,
    requesterUserId: "user_demo_admin",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: [],
    createdAt: now,
    updatedAt: now
  };
  const backend = resolveRegistryContextForTask({
    task: baseTask,
    agent: "codex",
    skills: snapshot.skills,
    harnesses: snapshot.harnesses,
    instructions: snapshot.instructions
  });
  const frontend = resolveRegistryContextForTask({
    task: { ...baseTask, title: "Refactor React dashboard component" },
    agent: "codex",
    skills: snapshot.skills,
    harnesses: snapshot.harnesses,
    instructions: snapshot.instructions
  });
  const conflict = resolveRegistryContextForTask({
    task: { ...baseTask, title: "Review conflict risk for branch lease" },
    agent: "codex",
    skills: snapshot.skills,
    harnesses: snapshot.harnesses,
    instructions: snapshot.instructions
  });

  assert.equal(backend.selectedHarness.name, "backend-node20");
  assert.equal(frontend.selectedHarness.name, "frontend-node20");
  assert.equal(conflict.selectedSkills.some((skill) => skill.name === "conflict-risk-reviewer"), true);
  assert.equal(backend.selectedInstructions.some((instruction) => instruction.name === "org-secure-coding-baseline"), true);
  assert.equal(backend.selectedInstructions.some((instruction) => instruction.name === "repo-agents-md"), true);
});

test("registry resolver does not select deprecated entries by default and reports missing requirements", () => {
  const snapshot = createDefaultRegistry();
  const deprecatedAuth = snapshot.skills.map((skill) => skill.id === "skill_auth_debugging" ? { ...skill, status: "deprecated" as const } : skill);
  const task = {
    id: "task_2",
    title: "Fix auth login timeout",
    status: "draft" as const,
    requesterUserId: "user_demo_admin",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedSkillIds: [],
    createdAt: now,
    updatedAt: now
  };
  const resolution = resolveRegistryContextForTask({
    task,
    agent: "codex",
    skills: deprecatedAuth,
    harnesses: snapshot.harnesses,
    instructions: snapshot.instructions
  });
  const missingHarness = resolveRegistryContextForTask({
    task,
    agent: "codex",
    skills: snapshot.skills,
    harnesses: [],
    instructions: snapshot.instructions
  });

  assert.equal(resolution.selectedSkills.some((skill) => skill.name === "auth-debugging"), false);
  assert.equal(missingHarness.errors.some((error) => error.includes("No selectable harnesses")), true);
});

test("task workflow records registry refs and preserves usage attribution", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Refactor React dashboard component",
    repoId: "repo_demo_backend",
    baseBranch: "main"
  });

  const result = await runAgentTaskWorkflow(task.id, { store });
  const taskRun = store.listTaskRuns(task.id).at(-1);
  const usage = store.listUsageEvents().find((event) => event.id === result.usageEventIds[0]);

  assert.equal(taskRun?.selectedHarnessRef?.name, "frontend-node20");
  assert.equal(taskRun?.selectedInstructionRefs?.some((ref) => ref.name === "org-secure-coding-baseline"), true);
  assert.equal(usage?.taskId, task.id);
  assert.equal(usage?.taskRunId, taskRun?.id);
});
