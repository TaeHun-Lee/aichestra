# Local Agent Runner v1

## What v1 Adds Over v0

Local Agent Runner v1 keeps the mock-first runner architecture and adds controlled fixture command execution:

- `CommandExecutor` interface with blocked and fixture-local implementations.
- Fixture workspace manager for explicit temp or fixture workspaces.
- Stronger `RunnerHarnessPolicy` command, output, network, remote Git, file write, and secret gates.
- `LocalAgentRunner` can execute allowed fixture commands only when explicitly enabled.
- Command result and workspace read models are exposed through APIs and dashboard data.
- Runner persistence readiness is extended with schema skeleton tables for command results and workspaces.

`MockAgentRunner` remains the default. `LocalAgentRunner` remains disabled by default.

## CommandExecutor Interface

Defined in `packages/runner/src/agent-runner.ts` and implemented in `packages/runner/src/command-executor.ts`.

Methods:

- `getExecutorKind`
- `validateCommand`
- `executeCommand`
- `close`, optional

Executor kinds:

- `blocked`: default; returns blocked results for every command.
- `fixture_local`: opt-in local fixture executor for a narrow command set.

The fixture executor uses `command` plus `args`; it does not use shell string execution.

## Fixture Workspace Manager

`LocalAgentWorkspaceManager` manages temp and fixture workspaces:

- validates paths under `AICHESTRA_AGENT_WORKSPACE_ROOT`;
- rejects filesystem roots;
- rejects repository root unless a future explicit fixture exception is used;
- creates temp workspaces only under the configured root;
- deletes only temp workspaces configured for cleanup;
- records workspace status in memory for v1.

## Harness Execution Policy

`RunnerHarnessPolicy` now includes:

- `allowedCommands`
- `deniedCommands`
- `testCommands`
- `maxRuntimeMs`
- `maxStdoutBytes`
- `maxStderrBytes`
- `allowNetwork`
- `allowGitRemote`
- `allowFileWrite`
- `allowSecrets`
- `cleanupPolicy`

Denied commands win over allowed commands. Network, remote Git, secrets, and file writes outside explicit temp workspace policy remain blocked by default.

## Controlled Fixture Command Execution

Command execution is disabled unless:

- `AICHESTRA_AGENT_RUNNER=local`
- `AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER=true`
- `AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION=true`
- `AICHESTRA_AGENT_WORKSPACE_ROOT` points at an explicit fixture/temp root

Allowed v1 fixture commands are intentionally small, such as `node --version` and fixture scripts under `tests/fixtures/agent-runner`.

Blocked by default:

- shell syntax and pipelines;
- arbitrary shell execution;
- network commands;
- `git fetch`, `git push`, `git merge`, `git rebase`;
- destructive filesystem commands;
- unsupported executables;
- commands outside harness allow lists.

## LocalAgentRunner Integration

When explicitly enabled, `LocalAgentRunner` can:

- validate the local fixture workspace;
- assemble instruction refs through the service layer;
- route mock model output through the LLM Gateway when a gateway service is provided;
- execute allowed fixture test commands;
- capture bounded stdout/stderr previews;
- create deterministic diff summaries and changed files;
- record command result ids and workspace ids on the AgentRun;
- keep remote Git, network, secrets, and active registry mutation disabled.

Default runtime remains simulation-only and command-blocked.

## LLM Gateway Integration

`LocalAgentRunner` accepts an optional LLM Gateway dependency. API bootstrap passes the mock-first gateway when local runner is selected. Usage attribution remains `taskId` and `taskRunId` based. No direct provider call is made by the runner.

## GitProvider Boundary

v1 does not run Git commands. Remote Git commands remain denied by policy and by the fixture executor. GitProvider integration remains through the existing Real Git Adapter boundary.

## Runner Persistence Readiness

Runtime repositories remain in-memory:

- `AgentRunRepository`
- `AgentRunAuditRepository`
- `InstructionAssemblyRepository`
- `AgentWorkspaceRepository`
- `CommandExecutionResultRepository`

The Postgres schema skeleton now includes:

- `agent_workspaces`
- `command_execution_results`

Postgres runner repository implementations remain future work.

## API Endpoints

v1 adds or extends:

- `GET /agents/executors`
- `GET /agents/workspaces`
- `GET /agents/workspaces/:id`
- `GET /agents/runs/:id/commands`
- `GET /agents/runs/:id/workspace`
- `POST /agents/runs/:id/execute-command`

`POST /agents/runs/:id/execute-command` returns a blocked result unless local command execution is explicitly enabled.

## Dashboard Changes

The dashboard now shows:

- command executor kind;
- max runtime;
- recent command result summaries;
- workspace status;
- blocked command examples;
- existing runner audit, test result, instruction assembly, LLM linkage, and Git linkage.

## Safety Gates

Default safety state:

- runner: `mock`;
- local runner: disabled;
- command executor: `blocked`;
- local command execution: disabled;
- network: disabled;
- remote Git: disabled;
- secrets: disabled;
- active registry mutation: disabled.

## Config Variables

- `AICHESTRA_AGENT_RUNNER=mock | local`
- `AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER=false`
- `AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION=false`
- `AICHESTRA_AGENT_WORKSPACE_ROOT`
- `AICHESTRA_AGENT_MAX_RUNTIME_MS`
- `AICHESTRA_AGENT_MAX_STDOUT_BYTES`
- `AICHESTRA_AGENT_MAX_STDERR_BYTES`

## Tests

v1 tests cover:

- blocked command executor behavior;
- fixture-local allowed command execution;
- denied commands;
- shell syntax blocking;
- timeout handling;
- stdout/stderr preview limits;
- workspace creation, validation, rejection, and cleanup;
- harness policy gates;
- LocalAgentRunner fixture execution;
- LLM Gateway usage attribution;
- command result/workspace repository contracts;
- API executor/workspace/command endpoints;
- dashboard visibility assumptions.

## Known Limitations

- No production sandboxing.
- No real Codex CLI integration.
- No real Claude Code integration.
- No real Aider integration.
- No arbitrary shell execution.
- No remote Git operations.
- No real LLM provider calls.
- No secrets injection.
- Runtime runner repositories remain in-memory.
- Postgres runner repository implementations are still future work.

## Aichestra Local Agent Distinction

Local Agent Runner v1 is Aichestra's mock/local task-runner layer.

Aichestra Local Agent is a future user-machine daemon boundary for brokering vendor local CLI providers. Enterprise LLM Provider Abstraction v0 defines Local Agent descriptors and invocation request/result models, but does not implement the daemon, vendor CLI execution, credential cache reads, or PTY automation.

## Next Recommended Task

Secrets and Sandbox Design v0 now provides `SandboxProfile`, `SandboxSession`, `NetworkEgressPolicy`, `RedactionPolicy`, and metadata-only secret lease boundaries. Local Agent Runner v1 can record safe local sandbox-session metadata through `SecurityControlService`, but command execution remains disabled by default and no secrets, network, remote Git, or production sandbox runtime is enabled.

Next recommended task: Aichestra Local Agent Protocol v0, or Real Git Adapter v1 if controlled remote Git branch/PR creation should be enabled next.
