import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { createDefaultLlmGatewayService } from "@aichestra/llm-gateway";
import {
  BlockedCommandExecutor,
  FixtureLocalCommandExecutor,
  InMemoryAgentWorkspaceRepository,
  InMemoryCommandExecutionResultRepository,
  LocalAgentRunner,
  LocalAgentWorkspaceManager,
  createRunnerHarnessPolicy,
  evaluateRunnerHarnessPolicy
} from "@aichestra/runner";
import type { AgentRunRequest, CommandExecutionRequest } from "@aichestra/runner";

const fixtureRoot = path.resolve("tests", "fixtures");
const fixtureWorkspace = path.resolve(fixtureRoot, "agent-runner");

function commandRequest(patch: Partial<CommandExecutionRequest> = {}): CommandExecutionRequest {
  return {
    taskId: "task_agent_v1",
    taskRunId: "run_agent_v1",
    agentRunId: "agentrun_agent_v1",
    workspacePath: fixtureWorkspace,
    command: "node",
    args: ["--version"],
    timeoutMs: 2_000,
    allowedCommands: ["node --version"],
    deniedCommands: createRunnerHarnessPolicy().deniedCommands,
    envPolicy: {
      allowInheritedEnv: false,
      allowedEnvKeys: ["PATH", "Path", "PATHEXT", "SystemRoot", "COMSPEC", "HOME", "USERPROFILE"]
    },
    metadata: {},
    ...patch
  };
}

function requestFixture(patch: Partial<AgentRunRequest> = {}): AgentRunRequest {
  return {
    taskId: "task_agent_v1",
    taskRunId: "run_agent_v1",
    actorId: "user_demo_admin",
    repoRef: { repoId: "repo_local_fixture", provider: "local", localPath: fixtureWorkspace },
    branchRef: { repoId: "repo_local_fixture", branchName: "local/agent-v1", baseBranch: "main" },
    selectedModelRef: "mock-coder@1.0",
    selectedSkillRefs: [{ kind: "skill", name: "auth-debugging", version: "1.0.0", id: "skill_auth_debugging" }],
    selectedHarnessRef: { kind: "harness", name: "backend-node20", version: "1.0.0", id: "harness_backend_node20" },
    selectedInstructionRefs: [{ kind: "instruction", name: "org-secure-coding-baseline", version: "1.0.0", id: "instruction_org_secure_coding_baseline" }],
    prompt: "Fix login session timeout",
    allowedCommands: ["node fixture-command.mjs"],
    testCommands: ["node fixture-command.mjs"],
    maxRuntimeMs: 2_000,
    metadata: {},
    ...patch
  };
}

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

test("CommandExecutor blocks by default and fixture executor enforces allowed, denied, shell, timeout, and preview rules", async () => {
  const blocked = await new BlockedCommandExecutor().executeCommand(commandRequest());
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.blockedReason, "local_command_execution_disabled");

  const fixture = new FixtureLocalCommandExecutor({ enabled: true, maxStdoutBytes: 12, maxStderrBytes: 12 });
  const allowed = await fixture.executeCommand(commandRequest());
  assert.equal(allowed.status, "completed");
  assert.match(allowed.stdoutPreview, /^v/);

  const denied = await fixture.executeCommand(commandRequest({
    command: "git",
    args: ["push", "origin", "main"],
    allowedCommands: ["git push origin main"]
  }));
  assert.equal(denied.status, "blocked");
  assert.equal(denied.blockedReason, "unsafe_command_blocked");

  const shell = await fixture.executeCommand(commandRequest({
    args: ["--version", "|", "cat"],
    allowedCommands: ["node --version | cat"]
  }));
  assert.equal(shell.status, "blocked");
  assert.equal(shell.blockedReason, "shell_execution_not_allowed");

  const timedOut = await fixture.executeCommand(commandRequest({
    args: ["slow-command.mjs"],
    timeoutMs: 10,
    allowedCommands: ["node slow-command.mjs"]
  }));
  assert.equal(timedOut.status, "timed_out");

  const largeOutput = await fixture.executeCommand(commandRequest({
    args: ["large-output.mjs"],
    allowedCommands: ["node large-output.mjs"]
  }));
  assert.equal(largeOutput.status, "completed");
  assert.equal(Buffer.byteLength(largeOutput.stdoutPreview) <= 12, true);
  assert.equal(largeOutput.metadata.shellExecution, false);
});

test("workspace manager creates safe temp workspaces and rejects unsafe paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "aichestra-agent-workspaces-v1-"));
  try {
    const workspaceRepository = new InMemoryAgentWorkspaceRepository();
    const manager = new LocalAgentWorkspaceManager({ workspaceRoot: root, workspaceRepository });
    const workspace = await manager.createWorkspace({
      taskId: "task_workspace_v1",
      taskRunId: "run_workspace_v1",
      mode: "temp",
      cleanupPolicy: "delete_temp_workspace",
      metadata: {}
    });
    assert.equal(workspace.status, "ready");
    assert.equal(workspace.rootPath.startsWith(root), true);

    const unsafe = await manager.validateWorkspace(path.parse(root).root);
    assert.equal(unsafe.ok, false);

    const repoRootManager = new LocalAgentWorkspaceManager({ workspaceRoot: process.cwd() });
    const repoRoot = await repoRootManager.validateWorkspace(process.cwd());
    assert.equal(repoRoot.ok, false);
    assert.equal(repoRoot.reason, "repository_root_workspace_rejected");

    const cleaned = await manager.cleanupWorkspace(workspace.id);
    assert.equal(cleaned.status, "cleaned");
    await assert.rejects(() => stat(workspace.rootPath));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("harness policy v1 keeps denied, network, remote git, file write, and secrets gates authoritative", () => {
  const policy = createRunnerHarnessPolicy({
    allowedCommands: ["node fixture-command.mjs"],
    deniedCommands: ["node fixture-command.mjs"],
    allowFileWrite: false,
    allowSecrets: false,
    maxStdoutBytes: 64,
    maxStderrBytes: 64
  });
  const decision = evaluateRunnerHarnessPolicy(policy, ["node fixture-command.mjs"]);
  assert.equal(decision.allowed, false);
  assert.equal(policy.allowNetwork, false);
  assert.equal(policy.allowGitRemote, false);
  assert.equal(policy.allowFileWrite, false);
  assert.equal(policy.allowSecrets, false);
  assert.equal(policy.maxStdoutBytes, 64);
});

test("LocalAgentRunner executes controlled fixture commands only when explicitly enabled and records LLM usage", async () => {
  const store = createSeededStore();
  const llmGateway = createDefaultLlmGatewayService({ usageRepository: store });
  const commandRepository = new InMemoryCommandExecutionResultRepository();
  const runner = new LocalAgentRunner({
    enabled: true,
    allowCommandExecution: true,
    workspaceRoot: fixtureRoot,
    maxRuntimeMs: 2_000
  }, {
    llmGateway,
    commandResultRepository: commandRepository,
    workspaceManager: new LocalAgentWorkspaceManager({ workspaceRoot: fixtureRoot })
  });

  const run = await runner.executeRun(requestFixture());
  assert.equal(run.status, "completed");
  assert.equal(run.commandExecutionResultIds.length, 1);
  assert.equal(run.testResults[0]?.status, "passed");
  assert.equal(commandRepository.listCommandResults({ agentRunId: run.id })[0]?.status, "completed");
  assert.equal(run.usageLedgerEntryIds.length, 1);
  assert.equal(store.listUsageEvents().some((event) => event.taskRunId === "run_agent_v1" && event.metadata?.source === "llm_gateway"), true);

  const blockedCommand = await runner.executeCommandForRun({
    run,
    workspacePath: fixtureWorkspace,
    command: "git",
    args: ["fetch"],
    allowedCommands: ["git fetch"]
  });
  assert.equal(blockedCommand.status, "blocked");
  assert.equal(blockedCommand.blockedReason, "unsafe_command_blocked");
});

test("runner repositories keep command results and workspaces queryable for persistence contracts", async () => {
  const commandRepository = new InMemoryCommandExecutionResultRepository();
  const workspaceRepository = new InMemoryAgentWorkspaceRepository();
  const manager = new LocalAgentWorkspaceManager({ workspaceRoot: fixtureRoot, workspaceRepository });
  const workspace = await manager.createWorkspace({
    taskId: "task_contract_v1",
    taskRunId: "run_contract_v1",
    mode: "fixture",
    requestedPath: fixtureWorkspace,
    cleanupPolicy: "none",
    metadata: {}
  });
  const command = commandRepository.saveCommandResult({
    id: "cmd_contract_v1",
    taskId: "task_contract_v1",
    taskRunId: "run_contract_v1",
    agentRunId: "agentrun_contract_v1",
    executorKind: "blocked",
    status: "blocked",
    command: "git",
    args: ["push"],
    stdoutPreview: "",
    stderrPreview: "",
    stdoutBytes: 0,
    stderrBytes: 0,
    durationMs: 0,
    blockedReason: "unsafe_command_blocked",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    metadata: {}
  });

  assert.equal(workspaceRepository.getWorkspace(workspace.id)?.status, "ready");
  assert.equal(commandRepository.getCommandResult(command.id)?.blockedReason, "unsafe_command_blocked");
  assert.equal(commandRepository.listCommandResults({ taskRunId: "run_contract_v1" }).length, 1);
});

test("Agent Runner API execute-command endpoint is blocked by default", async () => {
  const previousEnv = {
    runner: process.env.AICHESTRA_AGENT_RUNNER,
    local: process.env.AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER,
    commands: process.env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION,
    root: process.env.AICHESTRA_AGENT_WORKSPACE_ROOT
  };
  delete process.env.AICHESTRA_AGENT_RUNNER;
  delete process.env.AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER;
  delete process.env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION;
  delete process.env.AICHESTRA_AGENT_WORKSPACE_ROOT;
  const store = createSeededStore();
  const task = store.createTask({
    title: "Default runner blocks direct command execution",
    description: "Command execution should remain disabled.",
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
    const created = await postJson(address.port, "/agents/runs", {
      taskId: task.id,
      taskRunId: taskRun.id,
      prompt: "Fix login session timeout",
      selectedModelRef: "mock-coder@1.0"
    });
    const agentRun = created.body.agentRun as { id: string };
    const command = await postJson(address.port, `/agents/runs/${agentRun.id}/execute-command`, {
      command: "node",
      args: ["--version"],
      allowedCommands: ["node --version"]
    });
    assert.equal(command.statusCode, 409);
    assert.equal(
      (command.body.commandResult as { blockedReason: string }).blockedReason,
      "Command execution requires explicit local execution, harness, and workspace gates."
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousEnv.runner === undefined) delete process.env.AICHESTRA_AGENT_RUNNER; else process.env.AICHESTRA_AGENT_RUNNER = previousEnv.runner;
    if (previousEnv.local === undefined) delete process.env.AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER; else process.env.AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER = previousEnv.local;
    if (previousEnv.commands === undefined) delete process.env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION; else process.env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION = previousEnv.commands;
    if (previousEnv.root === undefined) delete process.env.AICHESTRA_AGENT_WORKSPACE_ROOT; else process.env.AICHESTRA_AGENT_WORKSPACE_ROOT = previousEnv.root;
  }
});

test("Agent Runner API exposes v1 executor, workspace, command result, and blocked-by-default command behavior", async () => {
  const previousEnv = {
    runner: process.env.AICHESTRA_AGENT_RUNNER,
    local: process.env.AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER,
    commands: process.env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION,
    root: process.env.AICHESTRA_AGENT_WORKSPACE_ROOT
  };
  process.env.AICHESTRA_AGENT_RUNNER = "local";
  process.env.AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER = "true";
  process.env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION = "true";
  process.env.AICHESTRA_AGENT_WORKSPACE_ROOT = fixtureRoot;

  const store = createSeededStore();
  const task = store.createTask({
    title: "Local runner v1 API",
    description: "Run fixture command.",
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
    assert.equal((health.agentRunner as { runnerKind: string }).runnerKind, "local");
    assert.equal((health.agentRunner as { commandExecutorKind: string }).commandExecutorKind, "fixture_local");

    const executors = await getJson(address.port, "/agents/executors") as { executors: { executorKind: string; enabled: boolean }[] };
    assert.equal(executors.executors.some((executor) => executor.executorKind === "fixture_local" && executor.enabled), true);

    const created = await postJson(address.port, "/agents/runs", {
      taskId: task.id,
      taskRunId: taskRun.id,
      prompt: "Fix login session timeout",
      selectedModelRef: "mock-coder@1.0",
      repoId: "repo_demo_backend",
      localPath: fixtureWorkspace,
      allowedCommands: ["node fixture-command.mjs"],
      testCommands: ["node fixture-command.mjs"]
    });
    assert.equal(created.statusCode, 201);
    const agentRun = created.body.agentRun as { id: string; status: string; commandExecutionResultIds: string[]; workspaceId: string };
    assert.equal(agentRun.status, "completed");
    assert.equal(agentRun.commandExecutionResultIds.length, 1);

    const commands = await getJson(address.port, `/agents/runs/${agentRun.id}/commands`) as { commandResults: { status: string }[] };
    assert.equal(commands.commandResults[0]?.status, "completed");

    const workspace = await getJson(address.port, `/agents/runs/${agentRun.id}/workspace`) as { workspace: { status: string } };
    assert.equal(workspace.workspace.status, "ready");

    const directCommand = await postJson(address.port, `/agents/runs/${agentRun.id}/execute-command`, {
      command: "node",
      args: ["--version"],
      workspacePath: fixtureWorkspace,
      allowedCommands: ["node --version"]
    });
    assert.equal(directCommand.statusCode, 200);
    assert.equal((directCommand.body.commandResult as { status: string }).status, "completed");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousEnv.runner === undefined) delete process.env.AICHESTRA_AGENT_RUNNER; else process.env.AICHESTRA_AGENT_RUNNER = previousEnv.runner;
    if (previousEnv.local === undefined) delete process.env.AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER; else process.env.AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER = previousEnv.local;
    if (previousEnv.commands === undefined) delete process.env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION; else process.env.AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION = previousEnv.commands;
    if (previousEnv.root === undefined) delete process.env.AICHESTRA_AGENT_WORKSPACE_ROOT; else process.env.AICHESTRA_AGENT_WORKSPACE_ROOT = previousEnv.root;
  }
});
