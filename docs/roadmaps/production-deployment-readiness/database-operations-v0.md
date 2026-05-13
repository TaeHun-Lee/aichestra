# Database Operations Plan v0

Planning only. This document does not connect to a production database.

## Current State

Persistent DB v1 adds an opt-in Postgres storage provider behind `AICHESTRA_STORAGE_PROVIDER=postgres` and `AICHESTRA_DATABASE_URL`. Default runtime and tests remain in-memory. Migrations run only through `pnpm db:migrate`.

## Production Topology Assumptions

- Managed or self-operated Postgres with backups, monitoring, and restricted network access.
- API and worker connect through a pooler or managed pooling.
- Migration runner is a separate release step.
- Application services never run migrations automatically at startup.

## Migration Process

1. Confirm release artifact and schema migration version.
2. Verify backup completed.
3. Run migration in an explicit migration job.
4. Run smoke checks.
5. Start or roll API/worker after migration success.
6. Record migration audit metadata.

## Rollback Approach

- Prefer forward-fix migrations.
- Keep pre-migration backup.
- Define application rollback compatibility window.
- Document manual rollback SQL only after review.
- Never auto-run destructive rollback.

## Backup Strategy

- Automated backups.
- Point-in-time recovery where available.
- Encrypted backups.
- Restore drill cadence.
- Retention aligned to audit/compliance requirements.

## Restore Test Strategy

- Restore into isolated non-production environment.
- Run schema verification.
- Run repository contract tests.
- Verify audit table readability.
- Verify no secret values appear in restored app metadata.

## Connection Pooling

- Required before production.
- Configure API and worker pool sizes separately.
- Backpressure worker concurrency on pool saturation.
- Observe query latency and connection exhaustion.

## Index Review

Review indexes for:

- tasks and task runs
- usage ledger
- branch leases, merge simulations, merge queue
- registry objects, revisions, audit
- Git webhook events and sync states
- LLM audit/routing decisions
- MCP invocations/audit
- policy/auth/security audit
- Local Agent protocol records

## Data Retention

- Task and registry state: project lifetime or archive policy.
- Usage ledger: billing/audit retention.
- Audit events: compliance retention.
- Redacted output previews: bounded by redaction policy.
- Webhook metadata: operational/debug retention.

## Audit Table Growth

Audit-heavy tables need:

- time-based indexes;
- optional partitioning;
- retention/archive jobs;
- export checkpoints;
- query limits in dashboard/API.

## Local/Integration/Staging/Production Differences

- Local: in-memory default.
- Integration: Postgres optional, contract tests optional.
- Staging: Postgres required, migration job required, restore drill required.
- Production: Postgres required, pooling/backups/restore/retention/monitoring required.

## Current Schema Limitations

- Some tables are skeletons only.
- Many repositories remain in-memory.
- No production migration history table beyond SQL execution convention is defined.
- No partitioning or retention automation exists.

## v1 Follow-Up

Persistent DB Production Operations v1 is implemented in `docs/roadmaps/persistent-db-production-operations/v1.md` with read-only readiness models, migration file checksums, index review, retention/audit growth planning, webhook persistence planning, backup/restore runbook, connection pooling plan, `/readiness/database/*`, `/dashboard/database`, and safe `/health` DB operations metadata.

v1 still does not make the database production-ready. Production remains blocked until pooled DB access, migration governance enforcement, backup/restore jobs, retention/legal hold, durable replay/dead-letter persistence, partitioning strategy, tenant scoping, real auth, and real secret backend work are implemented and tested.
