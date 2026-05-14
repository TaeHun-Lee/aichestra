# Staging Release Candidate Rollback Checklist v0

Status: `v0_implemented`

This checklist defines rollback planning expectations for a staging release candidate. It is read-only guidance. It does not execute rollback, revert code, mutate Git branches, run migrations, call providers, rotate secrets, deploy infrastructure, or change traffic.

Evidence Pack v0 fills rollback evidence at [rollback-evidence-v0.md](rollback-evidence-v0.md). The evidence remains planning/checklist-only because no release or deployment happened.

## Code Rollback

- Identify the candidate branch, commit range, or PR to revert if RC designation is rejected.
- Prefer a normal reviewable revert over history rewrite.
- Do not force-push or delete remote branches from this checklist.

## Config Rollback

- List config gates added or changed.
- Keep env values out of notes and API/dashboard output.
- Revert only metadata/config changes in a future explicit task.
- Do not issue tokens, sessions, or production credentials.

## DB/Migration Consideration

- Record whether dependency metadata, schema contracts, migrations, or repository behavior changed.
- Do not run migrations, backup jobs, restore jobs, partition jobs, or production DB checks from this checklist.
- If DB behavior changed, require a separate migration review before staging validation.

## Feature Flags

- List any new flags or runtime gates.
- Confirm default runtime stays mock-first and safe.
- Confirm production traffic remains disabled.

## GitHub Integration Rollback

- Confirm remote merge, rebase, force-push, and branch deletion remain disabled.
- Confirm GitHub App live tests remain skipped unless a separate gated validation task is requested.
- Do not mint installation tokens or call GitHub APIs.

## LLM Integration Rollback

- Confirm LLM Gateway defaults remain mock-only.
- Confirm remote LLM completion remains gated and not called by this checklist.
- Confirm no raw prompts, provider responses, or API keys are returned.

## SecretRef/Env Gate Rollback

- Confirm no secret values or env values were exposed.
- Confirm no credential caches were read.
- If exposure is ever detected, block RC designation and handle revocation out of band.
- Do not rotate, migrate, read, print, issue, or export secrets from this checklist.

## Dashboard/Readiness Rollback

- Confirm `/readiness/staging-rc/*`, `/dashboard/staging-rc`, and `/health` are read-only.
- Confirm non-GET methods do not mutate state.
- Confirm dashboard output has `productionReady=false`, `stagingDeployed=false`, `releaseCreated=false`, and `deploymentExecuted=false`.

## Audit/Observability Review

- Review sanitized audit/readiness metadata only.
- Do not export audit logs, deliver alerts, or call external observability backends.
- Confirm no raw webhook payloads, raw prompts, provider output, tokens, or secrets are returned.

## Manual Verification

- Run required local validation before RC designation.
- Record skipped optional integration tests and why their gates were absent.
- Confirm signoffs and release notes are complete.
- Confirm known limitations are accepted and visible.
- Confirm the next step remains a checklist/audit or implementation decision, not deployment.
