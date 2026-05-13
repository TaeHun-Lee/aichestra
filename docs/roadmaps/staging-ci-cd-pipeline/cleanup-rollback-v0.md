# CI/CD Cleanup And Rollback Policy v0

Status: v0_implemented
Scope: planning only

## Remote Git Cleanup

Future remote Git tests require:

- disposable branch prefix
- non-production repo allowlist
- PR close policy
- branch cleanup plan
- no auto-merge
- no force push
- no branch deletion by default runtime

v0 does not implement cleanup jobs that call GitHub.

## Test Database Cleanup

Postgres contract tests must use a non-production database. Cleanup must avoid destructive production data deletion and must not expose DB URL values.

## Generated Artifacts

Temporary workspaces, generated summaries, and dashboard/health smoke artifacts must be redacted before upload. Raw logs containing secrets must not be uploaded.

## Local Agent Fixture Sessions

Fixture sessions remain in-memory. Future local-agent cleanup must not execute vendor CLIs or read credential caches.

## Migration Rollback

Migration rollback is planning-only. Current CI must not execute production migrations or destructive rollback jobs automatically.

## Retry Policy

Retries may be allowed for flaky local validation jobs. Remote integration retries require explicit profile rules and must not create duplicate side effects.

## Failure Triage

Failures should be classified as:

- baseline validation failure
- optional integration gate missing
- optional integration failure
- secret/env exposure
- unexpected external call
- deployment/production-ready overclaim

## Manual Cleanup Checklist

- preserve audit evidence
- disable affected gates
- rotate exposed non-production credentials if needed
- close or mark test PRs
- remove temporary workspaces
- verify dashboard and health surfaces remain no-secret
