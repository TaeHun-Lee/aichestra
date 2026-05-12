# Local Agent Runner v1 Plan

## Current Local Agent Runner v0 Behavior

Local Agent Runner v0 is implemented as a mock-first runner layer:

- `packages/runner/src/agent-runner.ts` defines provider-neutral `AgentRunner` contracts.
- `MockAgentRunner` is deterministic and remains the default runner.
- `LocalAgentRunner` is disabled by default and simulation-first.
- Local command execution is disabled by default through `AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION=false`.
- Harness policy blocks network, remote Git, and known unsafe commands.
- Instruction assembly records selected Skill, Harness, and Instruction refs with a deterministic hash.
- `AgentRunnerService` owns runner orchestration for `/agents/*` APIs and dashboard visibility.
- Runner repositories are currently in-memory.
- Postgres runner tables are schema/planning only.

## Why v1 Is Needed Before Real Integrations

Real Git and real LLM integrations will need a runner boundary that can safely execute limited local checks without letting prompts, skills, or harness text bypass safety. v1 adds the missing local execution seams while keeping the default runtime safe:

- command execution is behind a `CommandExecutor` interface;
- the default executor blocks all commands;
- fixture-local command execution is opt-in and constrained to explicit workspaces;
- stdout/stderr capture is bounded and sanitized;
- workspace creation and cleanup are explicit;
- audit and result records are queryable without requiring Postgres.

## Command Execution Safety Rules

v1 command execution follows these rules:

- no shell string execution by default;
- commands are represented as `command` plus `args`;
- denied commands always win over allowed commands;
- network commands remain denied;
- `git fetch`, `git push`, `git merge`, and `git rebase` remain denied;
- destructive filesystem commands remain denied;
- command execution is disabled unless `AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION=true`;
- command output previews are size-limited;
- command execution results are auditable and linked to an agent run.

## Workspace Safety Rules

v1 adds a fixture workspace manager:

- temp and fixture workspaces must live under an explicit workspace root;
- repository root is rejected unless it is an explicit test fixture;
- workspace paths are normalized before use;
- cleanup marks workspaces as cleaned and deletes only temp workspaces configured for cleanup;
- no runner path may escape the configured workspace root.

## Harness Policy Rules

Harness policy remains authoritative:

- task prompts cannot weaken the harness policy;
- Skill instructions cannot weaken the harness policy;
- InstructionArtifacts cannot weaken the harness policy;
- network is disabled by default;
- remote Git is disabled;
- secrets are disabled;
- file writes are denied unless running in a temp workspace that explicitly allows them;
- stdout/stderr capture limits are enforced by policy.

## Timeout and Cleanup Strategy

Fixture-local command execution will use deterministic timeouts. Timed-out commands return a `timed_out` result and are not retried automatically. Temp workspace cleanup is explicit and recorded through workspace status; fixture workspaces are not deleted.

## Audit Requirements

v1 records or exposes:

- command validation results;
- command execution results;
- blocked command reasons;
- workspace creation and cleanup state;
- runner audit events for command execution and blocked local execution;
- no secrets in audit metadata.

## Persistence Strategy

Runtime runner repositories remain in-memory for this milestone. v1 will add repository boundaries and schema/migration skeleton coverage for:

- `agent_workspaces`;
- `command_execution_results`.

Postgres runner repositories remain future work so default tests and local mock runtime do not require a database.

## This Task Implements

- `CommandExecutor` interface and blocked/fixture-local implementations;
- `AgentWorkspaceManager` and in-memory workspace repository support;
- stronger harness policy fields and command validation;
- LocalAgentRunner fixture command execution when explicitly enabled;
- command/workspace API and dashboard visibility;
- repository contract tests for in-memory runner repositories;
- documentation and schema updates for runner persistence readiness.

## Out of Scope

- real Codex CLI integration;
- real Claude Code integration;
- real Aider integration;
- production sandboxing;
- secrets injection;
- remote Git operations;
- real LLM calls;
- arbitrary shell execution;
- repository root mutation;
- Postgres runner repository implementation;
- automatic registry mutation through auto-improvement.
