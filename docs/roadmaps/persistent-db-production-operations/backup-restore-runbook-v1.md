# Backup And Restore Runbook v1

Status: planning/runbook only. v1 does not create, schedule, or run backups and does not execute restores.

## Backup Objectives

Future production backups must protect:

- tasks, task runs, usage ledger, branch leases, merge simulations, merge queue, repos, and pull requests;
- registry objects, audit logs, revisions, packages, and eval results;
- webhook verification, delivery metadata, sync states, and audit;
- auth, policy, security, MCP, LLM, Local Agent, and observability tables once they become durable.

## Restore Objectives

Restore must recover application state into an isolated environment first, validate schema compatibility, and verify that sanitized audit/read-model data remains readable. Production cutover from restore requires separate incident review.

## RPO / RTO Placeholders

Initial placeholders for future review:

- local: no RPO/RTO commitment;
- integration: resettable test data, no production RPO/RTO;
- staging: restore drill target, RPO 24 hours placeholder, RTO 4 hours placeholder;
- production: values must be set by business/security review before production launch.

## Profile Differences

- local: in-memory default; no backup.
- integration: optional test Postgres; disposable or manually backed up.
- staging: production-like backups and restore drills required.
- production: managed backups, point-in-time recovery where available, encrypted storage, access control, and audit evidence required.

## Recommended Backup Cadence

Future production recommendation:

- continuous WAL/PITR when managed Postgres supports it;
- daily full backup snapshots;
- pre-migration backup gate;
- retention based on data classification and legal requirements;
- periodic backup integrity checks.

This is not implemented by v1.

## Restore Test Checklist

1. Restore backup into isolated non-production database.
2. Confirm schema version and migration checksum.
3. Run repository contract tests against restored test database where safe.
4. Verify task/run/registry/usage reads.
5. Verify webhook metadata reads without raw payloads.
6. Verify audit table reads without secret exposure.
7. Verify no `DATABASE_URL`, provider token, webhook secret, or credential cache path appears in dashboard/API outputs.
8. Record evidence in deployment readiness artifacts.

## Migration Rollback Considerations

- Prefer forward fixes.
- Keep backups before migration.
- Validate app version compatibility with pre- and post-migration schemas.
- Do not run destructive rollback automatically.
- Manual rollback SQL must be reviewed and tested in staging.

## Audit Data Restore Considerations

- Audit tables are append-only.
- Restored audit data must preserve actor/request/task/run/provider correlation ids where available.
- Retention and legal hold controls must be reviewed before any future deletion.
- Raw prompts, raw payloads, tokens, secrets, private keys, and credential cache contents must never be restored because they should never have been stored.

## Secret Data Handling

The database should store SecretRef metadata and credential handles only, not secret values. Backups must still be treated as sensitive because metadata can reveal topology, repo names, actor ids, and operational history.

## Out Of Scope

- live backup job;
- restore automation;
- cloud backup configuration;
- object storage lifecycle rules;
- PITR setup;
- restore cutover tooling;
- deletion of retained data.
