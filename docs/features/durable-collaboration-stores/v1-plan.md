# Durable Collaboration Stores v1 Plan

## Current Storage Provider Architecture

Aichestra defaults to in-memory repositories. Persistent DB v1 adds an opt-in Postgres storage provider behind `AICHESTRA_STORAGE_PROVIDER=postgres` and `AICHESTRA_DATABASE_URL`. The repository factory currently exposes task, task-run, usage ledger, conflict-manager, registry, and improvement repositories. Optional Postgres contract tests run only when `AICHESTRA_TEST_DATABASE_URL` is configured.

The Durable Collaboration Stores v1 path follows the same pattern:

- default runtime remains in-memory
- Postgres remains opt-in through the existing storage provider gate
- no database URL, credential, token, env value, or raw payload is returned through API, health, dashboard, or tests
- repository contracts stay deterministic and mock-first

## Current In-Memory vs Postgres Behavior

Persistent DB v1 already persists core records such as tasks, task runs, usage ledger entries, branch leases, merge simulations, merge queue entries, registry records, and registry audit/history/package/eval records when Postgres is explicitly selected. Collaboration-control feature records remain mostly in-memory service state or metadata-only read models.

Current collaboration feature storage is intentionally safe:

- Branch orchestration records use an in-memory repository in `packages/git-adapter`.
- Agent workspace lifecycle records use an in-memory repository in `packages/runner`.
- Multi-session coordination records use an in-memory repository in `packages/runner`.
- File leases/edit intents use an in-memory repository in `packages/runner`.
- Agent worktree allocation keeps request/result metadata in the service instance.
- Merge queue policy decisions/holds are service-local metadata in `packages/core`.
- Conflict Resolution Assistant request/summary/plan/recommendation records are service-local metadata in `packages/core`.
- PR ownership/handoff records are service-local metadata in `packages/core`.
- Branch cleanup/orphan recovery records use an in-memory repository in `packages/git-adapter`.

## Current Collaboration Records

The durable inventory covers these required durable records:

- `BranchOrchestrationRequest`
- `BranchOrchestrationDecision`
- `BranchOwnershipRecord`
- `AgentSession`
- `AgentRunCoordinationGroup`
- `AgentSessionOverlap`
- `AgentWorkspaceLease`
- `AgentWorkspaceLifecycleEvent`
- `AgentWorkspaceCleanupDecision`
- `AgentWorktreeAllocationRequest`
- `AgentWorktreeAllocationResult`
- `FileLease`
- `EditIntent`
- `EditOverlapAssessment`
- `MergeQueuePolicy`
- `MergeReadinessDecision`
- `MergeQueueHold`
- `ConflictResolutionRequest`
- `ConflictSummary`
- `ConflictResolutionPlan`
- `ConflictResolutionRecommendation`
- `PrOwnershipRecord`
- `PrHandoffRequest`
- `PrHandoffDecision`
- `OrphanLeaseRecord`
- `CleanupRecommendation`
- `CleanupDecision`
- `RecoveryAction`

Recommended durable records are dashboard/readiness summaries derived from those records, audit correlation snapshots, base branch drift status, and workspace safety checks. Ephemeral/recomputable data includes visual graph layout, dashboard display grouping, and derived counts.

## Repository Boundary Plan

Durable Collaboration Stores v1 adds a provider-neutral repository boundary in `packages/db` with repository groups for:

- branch orchestration
- agent session coordination
- agent workspace lifecycle
- agent worktree allocation
- edit intent/file lease graph records
- merge queue policy records
- conflict resolution assistant records
- PR ownership/handoff records
- cleanup/orphan recovery records

Each repository group supports deterministic safe operations:

- `create`
- `getById`
- `list`
- `updateStatus`
- `updateMetadata`
- `appendEvent`
- `listEvents`
- `summarize`

Metadata is sanitized before storage and before return. Secret-like keys, database URLs, credential values, bearer tokens, raw payload fields, env-like values, and sensitive local-path values are redacted.

## Migration Plan

The existing migration convention uses `infra/migrations/0001_initial_aichestra_schema.sql`, so v1 extends that schema skeleton instead of introducing a new migration series. The schema adds safe metadata tables for the required durable records and a generic durable collaboration event table. Tables use safe columns only:

- `id`
- `repo_id`
- `task_id`
- `task_run_id`
- `agent_run_id`
- `branch_name`
- `branch_lease_id`
- `workspace_lease_id`
- `status`
- `decision`
- `severity`
- `request_id`
- `correlation_id`
- `actor_id`
- `service_account_id`
- `metadata_json`
- `created_at`
- `updated_at`

No credential columns, env-value columns, database URL columns, endpoint columns, or raw payload columns are added.

## Contract Test Plan

Deterministic tests cover:

- in-memory repository create/get/list/update/event/summary behavior for each repository group
- repository factory durable collaboration repository exposure
- optional Postgres test skip behavior when `AICHESTRA_TEST_DATABASE_URL` is absent
- migration table coverage
- health/readiness/dashboard metadata safety
- no secret/env/DB URL exposure

Optional Postgres execution remains skipped unless the existing explicit test database gate is configured.

## Safety Constraints

Durable Collaboration Stores v1 must not:

- require Postgres by default
- expose database URLs, env values, tokens, credentials, authorization headers, cookies, or credential-cache contents
- run remote Git operations
- mutate user repositories or user workspaces
- delete branches, worktrees, files, or directories
- execute real LLM calls
- execute vendor CLIs
- call external providers
- weaken Auth/RBAC, Policy, Git, Runner, Local Agent, Tenant Scope, Dashboard, Observability, Registry, Governance, or Safety gates

## What This Task Implements

This task implements:

- durable collaboration store inventory
- provider-neutral repository models and interfaces
- in-memory durable collaboration repositories
- optional Postgres repository skeleton/implementation behind the existing storage gate
- migration schema coverage for required durable collaboration record tables
- repository factory wiring
- safe health/readiness/API/dashboard metadata
- deterministic tests
- docs and roadmap/checklist updates

## Out of Scope

This task does not implement:

- production-ready database operations
- automatic migration execution
- service-by-service production tenant isolation
- row-level security
- external provider calls
- remote Git operations
- workspace mutation or cleanup execution
- real conflict resolution or merge execution
- real LLM, MCP, or vendor CLI execution
- credential storage or secret retrieval
- production concurrency enforcement
