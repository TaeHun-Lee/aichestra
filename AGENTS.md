# AGENTS.md

## Project

Aichestra is an LLM/agent orchestration control plane for collaborative AI-assisted software development.

## Core principle

Do not implement real external API calls in the MVP scaffold. Use explicit interfaces and mock adapters first.

## Setup

- Install dependencies: `pnpm install`
- Run lint: `pnpm lint`
- Run typecheck: `pnpm typecheck`
- Run tests: `pnpm test`
- Run build: `pnpm build`

## Architecture boundaries

- `packages/core` owns domain models and pure business logic.
- Conflict Manager concepts (`BranchLease`, `ConflictRisk`, `MergeQueueEntry`, `MergeSimulationResult`) stay as separate domain concepts.
- `apps/api` exposes HTTP APIs and does not contain orchestration logic.
- `apps/worker` owns workflow execution.
- `packages/git-adapter` abstracts Git provider behavior.
- `packages/llm-gateway` abstracts model providers.
- `packages/registry` owns Skill, Harness, and Instruction registries, exact and simple semver version refs, repository boundaries, DTO mappers, registry audit logs, append-only history, rollback, approval queues, local eval result attachment, checksum verification, mock mutation authorization, local package manifests, import/export, package diffs, and deterministic registry resolution.
- `packages/policy` owns policy decisions.
- `packages/runner` owns agent runner contracts and mock runner behavior.
- `packages/db` owns schema, repository contracts, seed data, and persistence adapters.
- `apps/web` owns the dashboard skeleton.

## Implementation rules

- Keep provider integrations behind interfaces.
- Prefer deterministic tests.
- Avoid hidden global state.
- Do not store secrets in source code.
- Do not call OpenAI, Anthropic, GitHub, or other external APIs in tests.
- All generated code must pass lint, typecheck, test, and build.
- `POST /tasks/:id/run` must reject active queued/running TaskRuns with `409 Conflict`; completed or failed tasks may create a new TaskRun attempt.
- Conflict Manager v1 must remain mock/local-only: deterministic file-overlap scoring, active lease tracking, mock merge queue status, and local dry-run simulation behind `MergeSimulator`.
- Local dry-run simulation may use `git merge-tree` only against explicitly supplied local repositories or test fixtures. It must not fetch, push, call hosted Git providers, or mutate the user's working branch.
- Do not perform real provider merge/rebase operations.
- Skill, Harness, and InstructionArtifact must remain separate concepts with separate domain types, APIs, and tests.
- Registry v3 supports exact version pinning and simple semver ranges only. Do not add a full package manager.
- Registry API responses must go through stable DTO mappers instead of returning internal domain entities directly.
- Registry resolver selection must enforce lifecycle, approval, eval, and instruction checksum gates.
- Registry mutation APIs must append registry audit logs and registry revisions with the mock actor until real auth/RBAC exists.
- Registry rollback must restore previous snapshots by creating new revisions, not by deleting history.
- Registry mutation authorization must stay behind `RegistryMutationAuthorizer`; mock RBAC is not production auth.
- Registry package manifests must remain local-only JSON references to registry objects. Do not add real artifact registry, package signing, OCI, npm, GitHub release, or remote package integration yet.
- Registry imports must validate manifests, support dry-run behavior, and avoid overwriting non-draft active approved entries by default.

## MVP focus

The first working vertical slice is:

User creates a task
-> system selects mock model and registry-backed mock skill, harness, and instruction refs
-> worker creates mock branch
-> mock agent run produces a diff summary
-> mock or local-only dry-run merge simulation records conflict evidence
-> mock PR is created
-> mock merge queue records conflict risk and simulation status
-> usage ledger records cost
-> web dashboard shows task status.
