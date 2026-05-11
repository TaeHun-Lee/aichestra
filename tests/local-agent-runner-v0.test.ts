import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDefaultLlmGatewayService } from "@aichestra/llm-gateway";
import { runAgentTaskWorkflow } from "@aichestra/worker";
import {
  AgentRunnerService,
  LocalAgentRunner,
  MockAgentRunner,
  assembleRunnerInstructions,
  createAgentRunnerConfigFromEnv,
  createRunnerHarnessPolicy,
  evaluateRunnerHarnessPolicy
} from "@aichestra/runner";
import type { AgentRunRequest } from "@aichestra/runner";

function getJson(port: number, requestPath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, requestPath: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: requestPath,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized)
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(serialized);
  });
}

function requestFixture(patch: Partial<AgentRunRequest> = {}): AgentRunRequest {
  return {
    taskId: "task_agent_v0",
    taskRunId: "run_agent_v0",
    actorId: "user_demo_admin",
    repoRef: { repoId: "repo_demo_backend", provider: "mock" },
    branchRef: { repoId: "repo_demo_backend", branchName: "codex/agent-v0", baseBranch: "main" },
    selectedModelRef: "mock-coder@1.0",
    selectedSkillRefs: [{ kind: "skill", name: "auth-debugging", version: "1.0.0", id: "skill_auth_debugging" }],
    selectedHarnessRef: { kind: "harness", name: "backend-node20", version: "1.0.0", id: "harness_backend_node20" },
    selectedInstructionRefs: [{ kind: "instruction", name: "org-secure-coding-baseline", version: "1.0.0", id: "instruction_org_secure_coding_baseline" }],
    prompt: "Fix login session timeout",
    allowedCommands: [],
    testCommands: ["pnpm test"],
    maxRuntimeMs: 60_000,
    metadata: {},
    ...patch
  };
}

test("MockAgentRunner implements v0 interface and records LLM Gateway usage through service", async () => {
  const store = createSeededStore();
  const llmGateway = createDefaultLlmGatewayService({ usageRepository: store });
  const service = new AgentRunnerService({
    runner: new MockAgentRunner(llmGateway),
    config: createAgentRunnerConfigFromEnv({})
  });

  const validation = await new MockAgentRunner(llmGateway).validateEnvironment();
  const run = await service.runAgent(requestFixture());

  assert.equal(validation.ok, true);
  assert.equal(run.runnerKind, "mock");
  assert.equal(run.status, "completed");
  assert.equal(run.changedFiles.includes("src/auth/session.ts"), true);
  assert.equal(run.testResults[0]?.status, "passed");
  assert.equal(run.llmGatewayRequestIds.length, 1);
  assert.equal(run.usageLedgerEntryIds.length, 1);
  assert.equal(store.listUsageEvents().some((event) => event.taskRunId === "run_agent_v0" && event.metadata?.source === "llm_gateway"), true);
  assert.equal(service.listAuditEvents({ taskRunId: "run_agent_v0" }).some((event) => event.eventType === "agent_run_completed"), true);
  assert.equal(service.listInstructionAssemblies({ taskRunId: "run_agent_v0" })[0]?.instructionSetHash.startsWith("sha256:"), true);
});

test("LocalAgentRunner is disabled by default, rejects unsafe paths, and blocks command execution by default", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "aichestra-agent-runner-v0-"));
  try {
    const disabled = new LocalAgentRunner();
    const disabledValidation = await disabled.validateEnvironment(requestFixture({ repoRef: { repoId: "repo_local", localPath: root } }));
    assert.equal(disabledValidation.ok, false);
    assert.equal(disabledValidation.reason, "local_runner_disabled");

    const enabled = new LocalAgentRunner({ enabled: true, workspaceRoot: root, allowCommandExecution: false });
    const unsafe = await enabled.validateEnvironment(requestFixture({ repoRef: { repoId: "repo_local", localPath: path.parse(root).root } }));
    assert.equal(unsafe.ok, false);
    assert.equal(unsafe.reason, "local_runner_workspace_unsafe");

    const blocked = await enabled.executeRun(requestFixture({
      repoRef: { repoId: "repo_local", localPath: root },
      allowedCommands: ["pnpm test"]
    }));
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.metadata.reason, "local_command_execution_disabled");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("LocalAgentRunner flows through the task workflow without remote calls or registry bypass", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "aichestra-local-workflow-v0-"));
  try {
    const store = createSeededStore();
    const task = store.createTask({
      title: "Local runner login timeout",
      description: "Fix login session timeout using the local runner simulation.",
      repoId: "repo_demo_backend",
      baseBranch: "main",
      selectedAgent: "codex",
      selectedModel: "mock-model",
      selectedSkillIds: ["skill_auth_debugging"],
      selectedHarnessId: "harness_backend_node20",
      budgetLimitUsd: 20
    });

    const result = await runAgentTaskWorkflow(task.id, {
      store,
      agentRunner: new LocalAgentRunner({
        enabled: true,
        workspaceRoot: root,
        allowCommandExecution: false
      })
    });
    const taskRun = store.listTaskRuns(task.id).at(-1);
    const usage = store.listUsageEvents().find((event) => event.id === result.usageEventIds[0]);
    const lease = taskRun ? store.listBranchLeases(task.repoId, "active").find((candidate) => candidate.taskRunId === taskRun.id) : undefined;
    const queueEntry = taskRun ? store.listMergeQueueEntries(task.repoId).find((entry) => entry.taskRunId === taskRun.id) : undefined;

    assert.equal(result.status, "completed");
    assert.equal(taskRun?.status, "succeeded");
    assert.equal(taskRun?.selectedSkillRefs?.[0]?.name, "auth-debugging");
    assert.equal(taskRun?.selectedHarnessRef?.name, "backend-node20");
    assert.equal(result.changedFiles?.includes("src/auth/session.ts"), true);
    assert.equal(usage?.taskId, task.id);
    assert.equal(usage?.taskRunId, taskRun?.id);
    assert.equal(usage?.provider, "local");
    assert.equal(usage?.eventType, "runner_runtime");
    assert.equal(usage?.metadata?.source, "local_agent_runner");
    assert.notEqual(usage?.metadata?.source, "llm_gateway");
    assert.equal(lease?.files.includes("src/auth/session.ts"), true);
    assert.equal(queueEntry?.taskRunId, taskRun?.id);
    assert.equal(queueEntry?.simulationStatus, "clean");
    assert.equal(queueEntry?.recommendation, "safe_to_queue");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("harness policy blocks denied commands and keeps network and remote git disabled", () => {
  const policy = createRunnerHarnessPolicy({
    allowedCommands: ["pnpm test"],
    maxRuntimeMs: 60_000
  });
  const allowed = evaluateRunnerHarnessPolicy(policy, ["pnpm test"]);
  const denied = evaluateRunnerHarnessPolicy(policy, ["git push origin main"]);
  const network = evaluateRunnerHarnessPolicy(policy, ["curl http://example.invalid"]);

  assert.equal(allowed.allowed, true);
  assert.equal(denied.allowed, false);
  assert.equal(denied.reason, "runner_command_denied_by_harness_policy");
  assert.equal(network.allowed, false);
  assert.equal(policy.allowNetwork, false);
  assert.equal(policy.allowGitRemote, false);
});

test("instruction assembly includes selected refs and deterministic hash", () => {
  const first = assembleRunnerInstructions(requestFixture());
  const second = assembleRunnerInstructions(requestFixture());

  assert.equal(first.selectedInstructionRefs.length, 1);
  assert.equal(first.selectedSkillRefs.length, 1);
  assert.equal(first.selectedHarnessRef.name, "backend-node20");
  assert.equal(first.instructionSetHash, second.instructionSetHash);
});

test("Agent Runner API exposes config, runs, audit, instructions, and task run-agent endpoint", async () => {
  const store = createSeededStore();
  const task = store.createTask({
    title: "Agent runner API login task",
    description: "Fix login session timeout",
    repoId: "repo_demo_backend",
    baseBranch: "main",
    selectedModel: "mock-coder@1.0"
  });
  const taskRun = store.createTaskRun({
    taskId: task.id,
    attempt: 1,
    status: "succeeded",
    agent: "codex",
    model: "mock-coder@1.0"
  });
  const server = createApiServer(store);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health");
    assert.equal((health.agentRunner as { runnerKind: string }).runnerKind, "mock");
    assert.equal((health.agentRunner as { localRunnerEnabled: boolean }).localRunnerEnabled, false);

    const config = await getJson(address.port, "/agents/config") as { config: { runnerKind: string; localRunnerEnabled: boolean } };
    assert.equal(config.config.runnerKind, "mock");
    assert.equal(config.config.localRunnerEnabled, false);

    const created = await postJson(address.port, "/agents/runs", {
      taskId: task.id,
      taskRunId: taskRun.id,
      prompt: "Fix login session timeout",
      selectedModelRef: "mock-coder@1.0",
      repoId: task.repoId,
      selectedSkillRefs: requestFixture().selectedSkillRefs,
      selectedHarnessRef: requestFixture().selectedHarnessRef,
      selectedInstructionRefs: requestFixture().selectedInstructionRefs
    });
    assert.equal(created.statusCode, 201);
    const agentRun = created.body.agentRun as { id: string; status: string; usageLedgerEntryIds: string[] };
    assert.equal(agentRun.status, "completed");
    assert.equal(agentRun.usageLedgerEntryIds.length, 1);

    const audit = await getJson(address.port, `/agents/runs/${agentRun.id}/audit`) as { auditEvents: { eventType: string }[] };
    assert.equal(audit.auditEvents.some((event) => event.eventType === "agent_run_completed"), true);

    const instructions = await getJson(address.port, `/agents/runs/${agentRun.id}/instructions`) as { instructionAssembly: { instructionSetHash: string } };
    assert.equal(instructions.instructionAssembly.instructionSetHash.startsWith("sha256:"), true);

    const taskAgent = await postJson(address.port, `/tasks/${task.id}/run-agent`);
    assert.equal(taskAgent.statusCode, 201);
    assert.equal((taskAgent.body.agentRun as { status: string }).status, "completed");

    const taskAgentRuns = await getJson(address.port, `/tasks/${task.id}/agent-runs`) as { agentRuns: { taskId: string }[] };
    assert.equal(taskAgentRuns.agentRuns.length >= 2, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
