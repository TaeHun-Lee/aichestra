# Persistent DB v1 Plan

## Current Storage Provider Design

`packages/db/src/storage.ts` defines:

- `StorageProvider`
- `StorageProviderKind`
- `StorageHealth`
- `RepositoryFactory`
- `InMemoryRepositoryFactory`
- `createInMemoryStorageProvider`
- `createPersistentStorageProviderPlaceholder`

The current API bootstrap uses the storage provider boundary to construct registry and improvement services while keeping the in-memory store as the default.

## Current Repository Factory Design

The repository factory exposes:

- Task repositories.
- TaskRun repositories.
- Usage ledger repositories.
- Conflict repositories.
- Registry repositories.
- Improvement repositories.

Current repository contracts are synchronous. Persistent DB v1 preserves that contract to avoid broad service rewrites.

## Current Migration Skeleton

`infra/migrations/0001_initial_aichestra_schema.sql` defines a Postgres-oriented v0 schema covering:

- Core task/run/usage state.
- Conflict Manager leases, merge simulations, and merge queue entries.
- Registry entities, audit logs, revisions, packages, and eval results.
- Improvement and governance tables.

## Current Repository Contract Tests

`tests/repository-contracts.test.ts` exercises the in-memory storage provider through repository factory interfaces. Persistent DB v1 will extend this suite so the same contract can run against Postgres when `AICHESTRA_TEST_DATABASE_URL` is configured.

## Repositories Implemented in Postgres for v1

Persistent DB v1 implements Postgres-backed repositories for:

- `TaskRepository`
- `TaskRunRepository`
- `UsageLedgerRepository`
- `BranchLeaseRepository`
- `MergeSimulationResultRepository`
- `MergeQueueRepository`
- `SkillRegistryRepository`
- `HarnessRegistryRepository`
- `InstructionRegistryRepository`
- `RegistryAuditRepository`
- `RegistryHistoryRepository`
- `RegistryPackageRepository`
- `RegistryEvalResultRepository`

## Repositories Remaining In-Memory for v1

Phase 4 repositories remain in-memory:

- Failure signals and clusters.
- Improvement candidates and proposals.
- Draft registry changes.
- Proposal readiness.
- Governance decisions.
- Proposal eval runs.
- Canary readiness.
- Apply gates.
- Improvement governance audit events.

These will be moved to Postgres in a later persistent DB task after the core durable integration path is stable.

## Why v1 Scope Is Limited

The current app and services expect synchronous repository calls. A full async database rewrite would touch API, worker, registry, improvement, and tests at once. Persistent DB v1 keeps the service contracts stable and adds an opt-in Postgres storage implementation for the core durable state only.

## Configuration Strategy

- `AICHESTRA_STORAGE_PROVIDER=in_memory | postgres`
- `AICHESTRA_DATABASE_URL=<postgres connection string>`
- `AICHESTRA_PSQL_BIN=psql`, optional override

Default runtime remains `in_memory`. Postgres startup fails clearly when selected without a database URL or when the database health check fails.

## Testing Strategy

- Default test run uses in-memory repositories and requires no database.
- Optional Postgres contract tests run only when `AICHESTRA_TEST_DATABASE_URL` is set.
- Postgres tests use the same contract suite and migrate schema before running.

## Rollback Strategy

- In-memory remains the default provider.
- Disabling Postgres means removing `AICHESTRA_STORAGE_PROVIDER=postgres`.
- The migration is additive and can be dropped in local test databases.
- No provider integration depends on Postgres yet.

## Out of Scope

- Real Git adapter.
- Real LLM gateway.
- Real auth/RBAC.
- Phase 4 persistent repositories.
- Live production deployment.
- Automatic migrations during app startup.
- Async repository contract rewrite.
