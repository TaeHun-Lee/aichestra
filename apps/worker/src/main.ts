import { createSeededStore } from "@aichestra/db";
import { runAgentTaskWorkflow } from "./workflows/run-agent-task-workflow.ts";

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

const result = await runAgentTaskWorkflow(task.id, { store });
console.log(JSON.stringify(result, null, 2));
