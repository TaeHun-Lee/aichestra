# Persistent DB Production Operations v1 Plan

## Canonical Location

`docs/README.md` keeps feature implementation history under `docs/features/` and cross-cutting production work under `docs/roadmaps/`. Persistent DB v1 implementation remains documented in `docs/features/persistent-db/v1.md`; this production operations plan lives under `docs/roadmaps/persistent-db-production-operations/` because it spans runtime profiles, migrations, backups, retention, observability, webhook persistence, and deployment readiness.

## Current Persistent DB v1 Behavior

- Default runtime and default tests use in-memory repositories.
- Postgres is opt-in through `AICHESTRA_STORAGE_PROVIDER=postgres` plus `AICHESTRA_DATABASE_URL`.
- `packages/db/src/postgres.ts` provides a `PostgresStorageProvider` behind the existing `StorageProvider` and `RepositoryFactory` boundaries.
- Postgres-backed repositories cover the core durable slice: tasks, task runs, usage ledger, branch leases, merge simulations, merge queue, repos, pull requests, Git webhook metadata, Git PR/branch sync state, Git webhook audit, and registry core repositories.
- Phase 4 improvement/governance repositories, auth, policy, security, LLM route/audit, MCP, Local Agent Protocol, and observability common audit storage remain in-memory or schema-skeleton only.

## Current Storage Provider Behavior

- `createInMemoryStorageProvider()` is the safe default.
- `createApiStorageProviderFromEnv()` selects Postgres only when `AICHESTRA_STORAGE_PROVIDER=postgres`.
- API and worker code consume repositories through the provider/factory boundary.
- `/health` reports storage provider kind and health without returning connection strings.
- Postgres startup performs a health check when the Postgres provider is selected; it does not run migrations.

## Current Migration Runner Behavior

- `scripts/db/migrate.mjs` discovers SQL files under `infra/migrations/`.
- It requires `AICHESTRA_DATABASE_URL` or `DATABASE_URL` when explicitly invoked.
- It shells out to `psql` with `ON_ERROR_STOP=1`.
- Build, tests, and app startup do not run migrations automatically.
- No production migration lock, migration history table, release approval workflow, or rollback workflow exists.

## Current Postgres Schema Skeleton Status

- `infra/migrations/0001_initial_aichestra_schema.sql` contains the current schema skeleton.
- It includes core task/run/usage/registry/conflict tables and many future skeleton tables.
- It includes Git webhook event, verification, audit, PR sync, and branch sync tables.
- It does not include production-grade migration history, partitioning, retention jobs, backup metadata, durable common audit envelopes, or GitHub App replay/dead-letter tables.

## Current Repository Contract Test Behavior

- `tests/repository-contracts.test.ts` always runs the in-memory repository contract suite.
- The Postgres suite is skipped unless `AICHESTRA_TEST_DATABASE_URL` is configured.
- Optional Postgres tests are for local/test databases only and must not connect to production.

## Current Production DB Blockers

- No pooled Node Postgres client exists; the current v1 client invokes `psql` per query.
- No production backup/restore process exists.
- No restore drill has been tested.
- No migration governance, lock, audit, rollback, or pre/post migration checklist exists.
- No index review has been completed for all high-growth tables.
- No retention enforcement, legal hold, archive/export, or partitioning implementation exists.
- Common observability audit envelopes are read-only/in-memory and not backed by a durable common audit store.
- GitHub webhook replay/dedupe/dead-letter persistence is only planned; durable shared storage remains missing.
- Tenant scoping and production Auth/RBAC are not implemented.

## Proposed DB Operations Scope for v1

Persistent DB Production Operations v1 will add a non-destructive, read-only operations foundation:

- production DB operations runbook;
- deployment profile/readiness/risk models for DB operations;
- deterministic `DatabaseOperationsReadinessService` behavior;
- migration file inventory with safe checksum metadata;
- DB readiness API endpoints;
- safe DB metadata in `/health`;
- dashboard DB operations panel;
- index review plan;
- retention and audit growth plan;
- webhook persistence plan aligned with GitHub App hardening;
- backup/restore runbook;
- connection pooling plan;
- docs updates across production readiness, runtime inventories, environment gates, repository/schema references, README, and AGENTS.

## Documentation-Only Items

- backup jobs;
- restore execution;
- production migration runner operations;
- production rollback SQL;
- partitioning jobs;
- retention deletion jobs;
- legal hold enforcement;
- durable webhook replay/dead-letter workers;
- pooled DB client implementation;
- production DB monitoring/export integration.

## Code And Readiness Endpoints To Add

Read-only models and service methods will be added to `@aichestra/deployment-readiness`, because that package already owns production readiness planning metadata and GitHub App/webhook hardening read models.

Planned endpoints:

- `GET /readiness/database/summary`
- `GET /readiness/database/profiles`
- `GET /readiness/database/checks`
- `GET /readiness/database/risks`
- `GET /readiness/database/migrations`
- `GET /readiness/database/index-review`
- `GET /readiness/database/retention`
- `GET /readiness/database/audit-growth`
- `GET /readiness/database/webhook-persistence`
- `GET /readiness/database/schema`

Dashboard addition:

- `GET /dashboard/database`

Health addition:

- safe `databaseOperations` metadata with provider kind, database URL configured boolean only, test URL configured boolean only, migration runner availability, migration file count, pooling status, backup status, and no-secret/no-DB-url exposure flags.

## Out Of Scope

- provisioning production Postgres;
- connecting to production Postgres;
- adding Terraform, Pulumi, Helm, Kubernetes, or cloud deployment code;
- automatic migrations;
- backup or restore execution;
- destructive retention deletion;
- live partitioning jobs;
- production webhook processing;
- external DB monitoring/export;
- real secret backends;
- real external provider calls;
- weakening Auth/RBAC, Policy, SecretRef, Git, LLM, MCP, Local Agent, Runner, Observability, Dashboard, or Secrets/Sandbox gates.

## Validation Plan

- Add deterministic unit/API/dashboard tests for the DB operations read models.
- Verify API/dashboard outputs do not expose `AICHESTRA_DATABASE_URL`, `AICHESTRA_TEST_DATABASE_URL`, `DATABASE_URL`, or connection string values.
- Run the required safe-integration scan and classify findings.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `git diff --check`.
- Optional Postgres tests run only if `AICHESTRA_TEST_DATABASE_URL` is configured.
