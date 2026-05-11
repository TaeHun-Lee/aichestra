import { seedInstructions } from "@aichestra/core";
import { MockAgentRunner } from "./agents/mock-agent-runner.ts";
import { loadInstructionSet } from "./instructions/load-instructions.ts";

const instructionSet = loadInstructionSet({
  taskRunId: "run_demo",
  agent: "codex",
  artifacts: seedInstructions
});

const runner = new MockAgentRunner();
const result = await runner.run({
  taskId: "task_demo",
  taskRunId: "run_demo",
  userId: "user_demo_admin",
  repoId: "repo_demo_backend",
  branch: "ai/task_demo/codex/demo",
  agent: "codex",
  model: "mock-model",
  prompt: "Demo task",
  skillVersions: ["auth-debugging@1.0.0"],
  harnessVersion: "backend-node20@1.0.0",
  instructionSet
});

console.log(JSON.stringify(result, null, 2));
