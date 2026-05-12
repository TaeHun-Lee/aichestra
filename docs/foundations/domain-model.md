# Domain Model

The domain model lives in `packages/core/src/domain/models.ts`.

## Task

A task is the user-requested unit of AI work. It tracks requester, repository, branch, selected agent, selected model, skills, harness, budget, and current status.

## TaskRun

A task run is one execution attempt for a task. A task can have multiple runs as workflows are retried or repaired.

Task runs also carry the first vertical slice output: selected model provider, selected registry refs for skills, harness, and instructions, instruction set, changed files, diff summary, result summary, and mock PR URL.

## ModelSelection

Model selection records the chosen provider/model pair and the reason it was selected. The MVP uses `mock` as the provider and never calls real model APIs.

## ProviderAccount and VirtualKey

Provider accounts describe connected LLM provider identities. Virtual keys are internal routing and policy handles. The MVP models them but does not store real secrets or call providers.

## Repo, BranchLease, ConflictRisk, MergeSimulationResult, and MergeQueueEntry

Repositories describe connected source repositories. Branch leases capture active task-run branch ownership for files, symbols, and tests.

Conflict risks are deterministic pairwise risk results between active leases, augmented by dry-run merge simulation when available.

Merge simulation results capture mock or local-only dry-run status, changed files, conflicting files, sanitized command metadata, and a risk contribution. Local simulation is provider-agnostic and must not fetch, push, or mutate the user's current working branch.

Merge queue entries represent mock PRs waiting for merge and are marked `ready`, `blocked`, `merged`, or `cancelled` without performing remote provider merge operations. Queue entries also carry simulation status, blocking reasons, and recommendation.

## SkillPackage

Skills are reusable task workflows or procedures. They are not runtime sandboxes. Registry v1 tracks lifecycle status, approval status, eval status, owner, compatible agents/models, required tools, required harnesses, invocation rules, instruction refs or body, eval refs, tags, and exact version.

## HarnessDefinition / HarnessPackage

Harnesses describe runtime type/image, tools, MCP servers, secret scopes, network policy, test commands, compatible agents, instruction loading policy, lifecycle status, approval status, and eval status.

## InstructionArtifact and InstructionSet

Instruction artifacts represent AGENTS.md, CLAUDE.md, Cursor rules, org policies, team policies, repo policies, directory policies, user preferences, and custom task context. Registry v1 tracks checksum algorithm, checksum status, approval status, and eval status. Instruction sets are assembled snapshots for a task run.

## RegistryVersionRef and RegistryResolution

Registry version refs pin a selected skill, harness, or instruction to an exact name and version, with optional id and checksum. Registry resolution records selected refs, warnings, errors, and resolution time for a TaskRun.

## RegistryAuditLogEntry

Registry audit logs record create, update, status, approval, eval, archive/restore, and checksum verification events for registry records.

## UsageEvent and AuditLog

Usage events record LLM, MCP, runner, and CI cost/latency metadata. Audit logs record security-relevant actions and state changes.
