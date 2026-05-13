# Connection Pooling v1

Status: planning/readiness only. v1 does not implement a production pool.

## Current DB Client Behavior

Persistent DB v1 uses `PsqlCliDatabaseClient` in `packages/db/src/postgres.ts`. It shells out to `psql` per query to preserve the current synchronous repository contracts. This is acceptable for an opt-in development/test scaffold, but it is not production-grade.

## Production Pooling Requirement

Production needs a pooled Node Postgres client behind the existing `StorageProvider`, `RepositoryFactory`, and repository interfaces. The pool must support:

- connection limits per process;
- query timeout;
- idle timeout;
- health checks;
- graceful shutdown;
- backpressure when API/worker concurrency exceeds DB capacity;
- separate migration runner behavior.

## Pool Size Considerations

Pool size must be chosen from:

- database max connections;
- number of API replicas;
- number of worker replicas;
- worker concurrency;
- background webhook/audit/export jobs;
- migration job exclusivity;
- DB pooler availability.

The default should be conservative and explicit.

## API vs Worker Connections

- API: short read/write requests, dashboard/readiness reads, auth/policy checks, Git/LLM/MCP metadata writes.
- Worker: task/run lifecycle writes, usage ledger writes, branch/merge state writes, registry reads, future queue consumers.

Worker concurrency should be backpressured independently of API request concurrency.

## Migration Runner Connections

Migrations should use a dedicated job and should not share the normal API/worker pool. Future migration tooling should acquire a migration lock and run pre/post checks.

## Serverless vs Long-Running Processes

- Long-running API/worker: in-process pool can be acceptable with bounded size.
- Serverless: use managed pooler or external pool service; avoid opening new direct DB connections per invocation.

Aichestra does not choose a deployment model in v1.

## Failure Modes

- pool exhaustion;
- stuck long-running queries;
- DB failover;
- transaction lock contention;
- slow dashboard queries;
- migration lock conflict;
- connection string rotation;
- network partition between API/worker and DB.

## Health Check Behavior

Future health should expose:

- storage provider kind;
- pool configured boolean;
- pool healthy boolean;
- migration runner available boolean;
- migration file count;
- database URL configured boolean only;
- no connection string value.

v1 exposes safe booleans/counts only and does not probe production DBs.

## Future Implementation Plan

1. Add async repository boundary or adapt service calls to async.
2. Introduce a pooled Postgres client behind `StorageProvider`.
3. Keep `PsqlCliDatabaseClient` local/test-only or remove after migration.
4. Add pool config validation with no secret exposure.
5. Add integration tests gated by `AICHESTRA_TEST_DATABASE_URL`.
6. Add dashboard/readiness pool status.
7. Add production profile rejection for unpooled Postgres.

No step above is implemented by v1.
