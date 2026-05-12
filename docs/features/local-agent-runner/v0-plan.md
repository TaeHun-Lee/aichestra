# Local Agent Runner v0 Plan

## Current State

Phase 1 task execution currently runs through `runAgentTaskWorkflow` in `apps/worker/src/workflows/run-agent-task-workflow.ts`.

The existing flow already:

- resolves registry-backed Skill, Harness, and Instruction refs
- selects a mock model through the LLM Gateway model router
- creates a mock branch through the Git provider abstraction
- calls `MockAgentRunner`
- records usage in the usage ledger
- records branch lease, merge simulation, pull request, and merge queue state

LLM Gateway v0 is implemented with `LLMGatewayService`, deterministic `MockLLMProvider`, an OpenAI-compatible skeleton that blocks remote calls, budget checks, usage ledger attribution, and audit events.

Real Git Adapter v0 is implemented with `GitProvider`, deterministic `MockGitProvider`, fixture-safe `LocalGitProvider`, a gated `GitHubGitProvider` skeleton, Git audit events, and `/git/*` API visibility.

Registry v3 is implemented with separate Skill, Harness, and Instruction concepts, resolver gates, stable DTOs, audit/history/rollback, local eval results, package manifests, import/export, package diffs, and semver range resolution v0.

## Proposed AgentRunner Interface

Local Agent Runner v0 will extend `packages/runner` with provider-neutral runner contracts:

- `getRunnerKind`
- `validateEnvironment`
- `prepareRun`
- `executeRun`
- `collectRunResult`
- `cleanupRun`, optional

Supported runner kinds:

- `mock`
- `local`
- `codex_cli_future`
- `claude_code_future`
- `aider_future`
- `custom_future`

The v0 implementation keeps the existing legacy `run()` method for the current worker path so Phase 1 orchestration does not regress.

## Safety Constraints

Default runtime remains mock-first:

- `AICHESTRA_AGENT_RUNNER=mock`
- `AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER=false`
- `AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION=false`

Local runner rules:

- no network
- no `git fetch`
- no `git push`
- no remote PR creation
- no destructive commands
- no arbitrary shell execution by default
- no secret injection
- no mutation of the user's current working tree
- only explicit fixture or controlled local workspaces are accepted

Harness policy is authoritative. Skill instructions and task prompts cannot override harness safety.

## v0 Supported Operations

Local Agent Runner v0 will implement:

- deterministic `MockAgentRunner` execution
- disabled-by-default `LocalAgentRunner` simulation behavior
- harness execution policy validation
- deterministic instruction assembly refs and hash
- in-memory AgentRun, AgentRunAudit, and InstructionAssembly repositories
- `AgentRunnerService` for API/dashboard usage
- LLM Gateway integration for mock completions and usage ledger attribution
- Git provider config/read linkage without remote operations
- API and health visibility
- dashboard visibility
- deterministic tests

## Unsupported Operations

v0 does not implement:

- real Codex CLI integration
- real Claude Code integration
- real Aider integration
- arbitrary shell execution by default
- production sandboxing
- real secrets injection
- remote Git operations
- real LLM provider calls
- real eval execution
- real canary execution
- active registry mutation through auto-improvement

## Audit Requirements

Runner audit events will be append-only in-memory records for v0:

- environment validation
- run prepared
- run completed
- run blocked
- run failed
- cleanup skipped or completed

The events include `taskId`, `taskRunId`, runner kind, result, reason, sanitized metadata, and timestamp.

## Test Strategy

Tests will cover:

- runner interface methods
- deterministic mock runner output
- disabled local runner behavior
- unsafe path rejection
- command execution blocked by default
- harness policy command/network/remote Git gates
- deterministic instruction assembly
- LLM Gateway usage attribution
- Git provider default mock linkage
- API endpoints
- health metadata
- dashboard assumptions
- regression for existing phases

## Out of Scope

Persistent Postgres runner repositories are out of scope for v0. The migration and schema docs will include a planned table design, while runtime uses in-memory runner repositories.

Production sandboxing, provider CLI integration, secrets management, and local command execution are future work.
