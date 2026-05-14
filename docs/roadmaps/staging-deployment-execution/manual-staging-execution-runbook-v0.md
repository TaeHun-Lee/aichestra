# Manual Staging Deployment Execution Runbook v0

Status: `prepared_pending_deployment_command`
Scope: manual staging execution runbook only
Approved deployment candidate: `fee65632c8c8380dae78baf8e69e8486ab4c9cdd`
Production ready: no
Staging deployed: no

## Purpose

This runbook defines the manual staging deployment execution process after approval audit and pre-execution verification have passed for the approved deployment candidate.

This document does not deploy, create a release, create a Git tag, create a GitHub release, run remote Git operations, call external providers, call real LLM/MCP/Vault/auth services, execute vendor CLIs, read credential caches, expose secrets, expose env values, mark staging deployed, or mark production ready.

## Current Execution Decision

Decision: `not_executable_until_deployment_command_is_supplied`

The approved candidate has passed signoff, approval audit, and pre-execution validation, but this repository does not currently define an actual staging deployment command or infrastructure deployment target.

Manual staging execution must remain blocked until a responsible operator supplies and approves the exact deployment mechanism for the non-production staging environment.

## Approved Evidence

| Evidence | Result |
| --- | --- |
| Approved candidate commit | `fee65632c8c8380dae78baf8e69e8486ab4c9cdd` |
| Candidate scope method | `commit_sha` |
| Approval audit report | `docs/audits/2026-05-15-staging-deployment-approval-audit-v0-rerun.md` |
| Approval audit decision | `approval_audit_pass_with_warnings` |
| Required signoff roles approved | 6 of 6 |
| Scope review status | `matched` |
| Pre-execution verification | pass in a clean temporary worktree for the candidate commit |
| Staging deployed | false |
| Production ready | false |

## Deployment Command Discovery

Current identifiable commands:

| Command or script | Classification | Use in staging execution |
| --- | --- | --- |
| `pnpm lint` | validation | required before execution |
| `pnpm typecheck` | validation | required before execution |
| `pnpm test` | validation | required before execution |
| `pnpm build` | validation | required before execution |
| `git diff --check` | validation | required before execution |
| `pnpm --filter @aichestra/api dev` | local development server | not a deployment command |
| `pnpm --filter @aichestra/web dev` | local development server | not a deployment command |
| `pnpm --filter @aichestra/worker dev` | local development server | not a deployment command |
| `pnpm db:migrate` | explicit database migration command | not part of execution unless a separate staging DB migration decision approves it |
| `docker-compose.yml` Postgres service | local database helper | not an approved staging deployment target |

Actual staging deployment command identifiable: `false`.

No Kubernetes, Terraform, Pulumi, Helm, cloud deploy, artifact registry publish, release, tag, GitHub release, or staging deploy script is present in the current repository.

## Required Operator Inputs

Before execution can proceed, the responsible operator must provide:

- operator name and contact path;
- staging environment identifier;
- exact deployable artifact or commit, expected to be `fee65632c8c8380dae78baf8e69e8486ab4c9cdd`;
- exact deployment command or platform action;
- execution window;
- staging base URL or health endpoint;
- configuration source confirmation without exposing values;
- secret source confirmation without exposing values;
- database migration decision;
- rollback owner;
- rollback command or platform action, if any;
- post-execution evidence location.

If any input is missing, manual staging execution remains blocked.

## Pre-execution Confirmation

Immediately before execution, confirm:

- current deployment candidate is `fee65632c8c8380dae78baf8e69e8486ab4c9cdd`;
- candidate worktree or artifact source is clean and reproducible;
- no unreviewed code, config, dependency, migration, safety gate, signoff, release-note, rollback, or deployment-relevant documentation change is included;
- approval audit evidence is still within the 7-day validity window;
- all six required roles remain approved for the exact `commit_sha` scope;
- `pnpm lint` passes;
- `pnpm typecheck` passes;
- `pnpm test` passes;
- `pnpm build` passes;
- `git diff --check` passes;
- no-secret/no-env exposure remains pass;
- optional live integrations remain skipped unless explicitly approved as a separate gated validation task;
- staging state is not already deployed;
- production ready remains false;
- rollback evidence is present;
- responsible operator explicitly confirms the execution command.

## Execution Rules

- Do not execute any deployment command until it is explicitly supplied and reviewed.
- Do not infer a deployment command from local development server scripts.
- Do not treat `pnpm build` as deployment.
- Do not run `pnpm db:migrate` unless the staging DB migration decision explicitly requires it and the operator confirms the target without exposing values.
- Do not create a release, Git tag, or GitHub release.
- Do not run remote Git operations.
- Do not call external providers unless a separate explicit task approves the exact provider, gate set, and safety evidence.
- Do not read credential caches.
- Do not print or store secret values, env values, database URLs, tokens, private keys, webhook secrets, raw provider responses, raw prompts, or raw logs.
- Keep production ready false.

## Execution Placeholder

No command is approved here.

When a future operator supplies the exact staging deployment command, record it in a separate execution request before running it:

| Field | Required value |
| --- | --- |
| Execution request id |  |
| Operator |  |
| Candidate commit | `fee65632c8c8380dae78baf8e69e8486ab4c9cdd` |
| Deployment target |  |
| Deployment command or platform action |  |
| Config source confirmation |  |
| Secret source confirmation |  |
| Rollback command or platform action |  |
| Expected smoke base URL |  |

## Smoke Checks

After a future explicit execution, record sanitized results for:

- `GET /health`
- `/dashboard/overview`
- `/dashboard/staging`
- `/dashboard/staging-dry-run`
- `/dashboard/staging-rc`
- `/dashboard/staging-execution`
- `/dashboard/observability`
- `/readiness/deployment/summary`
- `/readiness/staging-dry-run/summary`
- `/readiness/staging-rc/summary`
- `/readiness/staging-execution/summary`
- `/observability/audit/summary`
- no-secret/no-env dashboard and health checks

Smoke evidence must be summarized. Do not store raw logs, env dumps, tokens, database URLs, private keys, webhook secrets, provider credentials, raw prompts, raw provider responses, or credential-cache paths.

## Rollback Plan

Rollback remains manual until the actual deployment mechanism is supplied.

Required rollback confirmations:

- rollback owner is named;
- rollback trigger criteria are confirmed;
- rollback command or platform action is supplied before execution;
- rollback evidence path is identified;
- no destructive Git operation is part of rollback;
- no provider-side mutation runs without explicit approval;
- no secret or env value is exposed in rollback evidence.

Rollback triggers:

- health check failure;
- dashboard/readiness failure;
- secret/env exposure;
- unexpected external provider call;
- unexpected release, tag, GitHub release, or remote Git side effect;
- failed or unsafe migration;
- staging overclaim or production-ready overclaim;
- audit/observability evidence gap.

## Post-execution Evidence Requirements

If a future explicit execution occurs, record:

- execution timestamp;
- operator;
- deployed artifact or commit;
- environment;
- exact commands or platform actions executed;
- validation command results;
- smoke check results;
- health/readiness results;
- dashboard verification;
- audit/observability verification;
- rollback not needed or rollback triggered;
- incidents;
- follow-ups;
- confirmation that production ready remains false unless a separate future production readiness audit changes it.

## Abort Conditions

Abort before execution if any of the following is true:

- deployment command is not explicitly supplied;
- current candidate scope differs from `fee65632c8c8380dae78baf8e69e8486ab4c9cdd`;
- worktree or artifact source is dirty or unreproducible;
- any required signoff is missing, stale, rejected, held, expired, or conditionally approved with unresolved blocking conditions;
- validation fails;
- no-secret/no-env exposure check fails;
- rollback owner or rollback command/action is missing;
- staging target or expected smoke base URL is not identified;
- a remote Git operation, release, tag, GitHub release, external provider call, Vault call, real MCP call, real LLM call, external auth call, vendor CLI execution, or credential-cache read would occur without separate explicit approval;
- `productionReady` is true or claimed true;
- staging state is overclaimed.

## Final Recommendation

Recommendation: `blocked_pending_explicit_deployment_command`

The candidate commit is approved and pre-execution verification has passed, but actual manual staging execution is not yet actionable because the repository does not define an approved staging deployment command or target.

Next required step: responsible operator supplies the exact staging deployment command, target, rollback action, and smoke base URL in a separate explicit execution request.
