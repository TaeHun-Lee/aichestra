# Local Agent Runner v0

## What v0 Implements

Local Agent Runner v0 adds a mock-first runner layer:

- provider-neutral `AgentRunner` interface
- deterministic `MockAgentRunner` as the default
- disabled-by-default `LocalAgentRunner` for safe local/demo simulation
- `RunnerHarnessPolicy` gates for commands, network, remote Git, runtime, and secrets
- deterministic runner instruction assembly refs and hash
- in-memory AgentRun, AgentRunAudit, and InstructionAssembly repositories
- `AgentRunnerService` orchestration for runner API/dashboard usage
- LLM Gateway integration for mock completions and usage attribution
- API, health, dashboard, and tests

This is not real Codex CLI, Claude Code, Aider, or production sandbox integration.

## AgentRunner Interface

Defined in `packages/runner/src/agent-runner.ts`:

- `getRunnerKind`
- `validateEnvironment`
- `prepareRun`
- `executeRun`
- `collectRunResult`
- `cleanupRun`, optional
- legacy `run` for current Phase 1 workflow compatibility

Runner kinds:

- `mock`
- `local`
- `codex_cli_future`
- `claude_code_future`
- `aider_future`
- `custom_future`

## MockAgentRunner

`MockAgentRunner`:

- produces deterministic changed files and diff summaries
- uses the LLM Gateway when available
- records usage through the gateway in service-driven runs
- can simulate failed tests
- can simulate blocked runs
- makes no external calls
- performs no filesystem mutation
- performs no remote Git operations

The existing worker path still uses the legacy `run()` method and keeps one usage ledger entry per TaskRun.

## LocalAgentRunner

`LocalAgentRunner` is disabled by default. It only supports safe simulation in v0.

Default config:

- `AICHESTRA_AGENT_RUNNER=mock`
- `AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER=false`
- `AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION=false`

Optional config placeholders:

- `AICHESTRA_AGENT_RUNNER=local`
- `AICHESTRA_AGENT_WORKSPACE_ROOT`
- `AICHESTRA_AGENT_MAX_RUNTIME_MS`

Rules:

- no network
- no `git fetch`
- no `git push`
- no destructive commands
- no arbitrary shell execution by default
- no secrets injection
- no mutation of the user's current working tree
- local paths must be inside the configured workspace root

## Harness Execution Policy

`RunnerHarnessPolicy` keeps harness safety authoritative:

- `allowedCommands`
- `deniedCommands`
- `testCommands`
- `maxRuntimeMs`
- `allowNetwork`, false by default
- `allowFileWrite`, false by default
- `allowGitRemote`, false
- `secretScopes`, empty or from harness metadata
- `cleanupPolicy`

Task prompts and skill instructions cannot override harness safety.

## Instruction Assembly

`assembleRunnerInstructions` records:

- selected instruction refs
- selected skill refs
- selected harness ref
- deterministic `sha256:` instruction set hash
- deterministic warnings

This is not token optimization or prompt compression.

## LLM Gateway Integration

Service-driven mock runs call `LLMGatewayService.routeCompletion` through `MockAgentRunner` when the gateway is available.

Successful calls record:

- LLM gateway request id
- usage ledger entry id
- taskId/taskRunId attribution
- model/provider metadata

Blocked budget or model checks return a blocked runner result.

## GitProvider Integration

The runner records Git linkage metadata and keeps `MockGitProvider` as the default surrounding provider.

v0 does not:

- run `git fetch`
- run `git push`
- run merge or rebase
- create remote PRs
- mutate the user's current working tree

## TaskRun Lifecycle Integration

The existing `POST /tasks/:id/run` workflow remains unchanged.

`POST /tasks/:id/run-agent` creates a TaskRun and executes the new runner service directly:

- `completed` AgentRun maps to succeeded TaskRun
- `failed` or `blocked` AgentRun maps to failed TaskRun
- active queued/running TaskRuns are rejected with conflict

Runner-specific states are recorded on `AgentRun` rather than expanding TaskRun statuses in v0.

## API Endpoints

- `GET /agents/runners`
- `GET /agents/config`
- `POST /agents/runs`
- `GET /agents/runs`
- `GET /agents/runs/:id`
- `GET /agents/runs/:id/audit`
- `GET /agents/runs/:id/instructions`
- `POST /tasks/:id/run-agent`
- `GET /tasks/:id/agent-runs`

Responses use DTO mappers and do not expose secrets.

## Dashboard Changes

The dashboard shows:

- configured runner kind
- local runner enabled/disabled
- local command execution enabled/disabled
- recent agent run status
- changed files
- diff summary
- test results
- instruction assembly hash and refs
- LLM usage linkage
- Git provider linkage
- local runner blocked example

## Safety Gates

Default runtime:

- mock runner
- local runner disabled
- command execution disabled
- no remote Git
- no real LLM
- no secrets
- no active registry mutation

## Tests

Coverage includes:

- interface methods
- deterministic mock runner output
- disabled local runner
- unsafe path rejection
- command execution blocked by default
- harness policy command/network/remote Git gates
- deterministic instruction assembly hash
- LLM Gateway usage attribution
- API endpoints
- health metadata
- dashboard assumptions
- regression coverage for existing phases

## Known Limitations

- No real Codex CLI integration.
- No real Claude Code integration.
- No real Aider integration.
- No production sandboxing.
- No command execution in default runtime.
- No persistent runner repositories yet.
- No real secrets injection.
- No remote Git operations.
- Local runner is simulation-only unless future controlled fixture execution is added.

## v1 Follow-Up

Local Agent Runner v1 adds controlled fixture command execution behind a disabled-by-default `CommandExecutor` boundary. v0 remains the baseline mock/simulation runner behavior.
