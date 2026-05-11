# AGENTS.md

## Project

Aichestra is an LLM/agent orchestration control plane for collaborative AI-assisted software development.

Design and work-order source documents live under `design_docs/`. The canonical bootstrap document is `design_docs/AICHESTRA_BOOTSTRAP.md`.

## Core principle

Do not implement real external API calls in the MVP scaffold. Use explicit interfaces and mock adapters first.

## Setup

- Install dependencies: `pnpm install`
- Run lint: `pnpm lint`
- Run typecheck: `pnpm typecheck`
- Run tests: `pnpm test`
- Run build: `pnpm build`
- Optional Postgres migration: `AICHESTRA_DATABASE_URL=postgres://... pnpm db:migrate`
- Optional Postgres repository contracts: set `AICHESTRA_TEST_DATABASE_URL` before `pnpm test`

## Architecture boundaries

- `packages/core` owns domain models and pure business logic.
- Conflict Manager concepts (`BranchLease`, `ConflictRisk`, `MergeQueueEntry`, `MergeSimulationResult`) stay as separate domain concepts.
- `apps/api` exposes HTTP APIs and does not contain orchestration logic.
- `apps/worker` owns workflow execution.
- `packages/git-adapter` abstracts Git provider behavior.
- `packages/improvement` owns Phase 4 Preparation, Auto-improvement v0, and Governance v1 failure signals, deterministic clusters, improvement candidates, draft proposal metadata, draft registry changes, proposal readiness checks, proposal review queues, governance decisions, proposal eval run metadata, canary readiness checks, apply gates, governance audit events, eval requirement metadata, canary rollout plan metadata, safety policies, repository interfaces, DTO mappers, mock engine behavior, and in-memory services.
- `packages/llm-gateway` abstracts model providers, owns LLM Gateway v0 provider-neutral interfaces, mock provider behavior, OpenAI-compatible skeleton behavior, model catalog, virtual model key policy objects, budget checks, usage ledger integration, and LLM audit events.
- `packages/registry` owns Skill, Harness, and Instruction registries, exact and simple semver version refs, repository boundaries, DTO mappers, registry audit logs, append-only history, rollback, approval queues, local eval result attachment, checksum verification, mock mutation authorization, local package manifests, import/export, package diffs, and deterministic registry resolution.
- `packages/policy` owns policy decisions.
- `packages/runner` owns agent runner contracts and mock runner behavior.
- `packages/db` owns schema, repository contracts, storage provider abstractions, repository factories, seed data, and persistence adapters.
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
- In-memory storage remains the default. Postgres storage is opt-in via `AICHESTRA_STORAGE_PROVIDER=postgres` and `AICHESTRA_DATABASE_URL`.
- Postgres repositories must stay behind `StorageProvider`, `RepositoryFactory`, and repository interfaces. API handlers and workers must not instantiate Postgres repositories directly.
- Postgres migrations must run only when explicitly invoked. Do not make tests, build, or app startup run migrations automatically.
- Optional Postgres contract tests must be skipped unless `AICHESTRA_TEST_DATABASE_URL` is configured.
- Phase 4 Preparation must remain metadata-only: do not call LLMs, do not use embeddings, do not execute evals, do not execute canary rollout, and do not mutate active registry entries from candidates or proposals.
- Auto-improvement safety policy defaults must keep `allowAutoApply = false`, `requireHumanApproval = true`, `requireEvalPassed = true`, and `requireCanary = true`.
- Auto-improvement v0 must remain deterministic, mock-only, and draft-only. It may create analyses, candidates, draft proposals, draft registry changes, and readiness records, but it must not apply changes, activate registry entries, approve proposals, execute evals, execute canaries, or call external services.
- Governance v1 may record proposal decisions, proposal eval run metadata, canary readiness, apply gates, and governance audit events. It must not apply draft registry changes, mutate active registry entries, execute evals, execute canaries, or add real auth/provider integrations.
- Real Integration Foundation v0 may add repository abstractions, schema designs, migration skeletons, and contract tests. It must not wire live databases or real provider services until an explicit follow-up task.
- Real Git Adapter v0 keeps `MockGitProvider` as the default, supports `LocalGitProvider` only for explicit local fixture paths, and keeps `GitHubGitProvider` as a gated skeleton with no default network calls.
- Remote Git operations must require explicit configuration: `AICHESTRA_GIT_PROVIDER=github`, `AICHESTRA_ENABLE_REMOTE_GIT=true`, and operation-specific flags such as `AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE=true` or `AICHESTRA_ALLOW_REMOTE_PR_CREATE=true`.
- Real Git Adapter v0 must not implement automatic merge, provider rebase, force-push, branch deletion, or remote push. `AICHESTRA_ALLOW_REMOTE_MERGE` is unsupported in v0.
- Git provider selection and Git operations must flow through provider/service boundaries, not direct API handler instantiation. Git audit events must not expose tokens or secrets.
- LLM Gateway v0 keeps `MockLLMProvider` as the default and keeps `OpenAICompatibleLLMProvider` as a gated skeleton with no default network calls.
- Remote LLM operations must require explicit configuration such as `AICHESTRA_LLM_PROVIDER=openai_compatible`, `AICHESTRA_ENABLE_REMOTE_LLM=true`, and `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=true`. Even then, v0 must remain skeleton-only unless a future task explicitly implements real calls.
- Virtual model keys are internal policy objects only. Do not store OpenAI, Anthropic, Gemini, Bedrock, LiteLLM, or other provider API keys in source, model catalog records, virtual keys, audit events, or usage metadata.
- LLM Gateway calls must record successful usage with `taskId` and `taskRunId`; blocked calls must create audit events and must not call external providers.

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
