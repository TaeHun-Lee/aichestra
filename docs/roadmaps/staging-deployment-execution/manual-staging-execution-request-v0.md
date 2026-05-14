# Manual Staging Deployment Execution Request v0

Status: `blocked_pending_operator_confirmation`
Scope: execution request template and required confirmation surface only
Approved deployment candidate: `fee65632c8c8380dae78baf8e69e8486ab4c9cdd`
Production ready: no
Staging deployed: no

## Purpose

This document captures the exact operator confirmations required before a future manual staging deployment execution can proceed.

It does not deploy, create a release, create a Git tag, create a GitHub release, run remote Git operations, call external providers, call real LLM/MCP/Vault/auth services, execute vendor CLIs, read credential caches, expose secrets, expose env values, mark staging deployed, or mark production ready.

## Current Decision

Decision: `blocked_pending_operator_confirmation`

The approved candidate has passed signoff, approval audit, and validation, but actual staging execution remains blocked until a responsible operator supplies the exact staging target, deployment action, rollback action, smoke target, and migration decision.

## Approved Candidate Scope

| Field | Value |
| --- | --- |
| Approved candidate commit | `fee65632c8c8380dae78baf8e69e8486ab4c9cdd` |
| Scope method | `commit_sha` |
| Approval audit decision | `approval_audit_pass_with_warnings` |
| Scope review status | `matched` |
| Required human signoffs | 6 of 6 approved for this commit scope |
| Staging deployed | false |
| Production ready | false |

## Scope Classification

This request follows `docs/roadmaps/staging-deployment-execution/scope-separation-policy-v0.md`.

| Scope | Current classification |
| --- | --- |
| Reviewed target scope | Approved candidate commit `fee65632c8c8380dae78baf8e69e8486ab4c9cdd`. |
| Evidence scope | Approval audit, runbook, this execution request, validation summaries, and future post-execution evidence. |
| Execution scope | Missing until operator supplies staging target, deployment action, rollback action, smoke target, migration decision, and execution window. |
| Governance/policy scope | Existing signoff decision policy, scope separation policy, role requirements, validity window, hold rules, and no-secret/no-env rules. |

This execution request is evidence/execution-request scope by default. It does not change the approved deployment-candidate commit unless its contents are explicitly promoted to a new reviewed target or it changes the required execution action, governance rule, safety gate, or accepted condition.

## Required Operator Confirmations

| Confirmation | Required | Current value | Status |
| --- | --- | --- | --- |
| Responsible operator name | yes | `TBD` | missing |
| Operator contact path | yes | `TBD` | missing |
| Staging environment identifier | yes | `TBD` | missing |
| Deployment target or platform | yes | `TBD` | missing |
| Deployable artifact or commit | yes | `fee65632c8c8380dae78baf8e69e8486ab4c9cdd` | proposed |
| Exact deployment command or platform action | yes | `TBD` | missing |
| Rollback owner | yes | `TBD` | missing |
| Rollback command or platform action | yes | `TBD` | missing |
| Smoke base URL or health endpoint | yes | `TBD` | missing |
| Database migration decision | yes | `TBD` | missing |
| Config source confirmation | yes | `TBD; no values recorded` | missing |
| Secret source confirmation | yes | `TBD; no values recorded` | missing |
| Execution window | yes | `TBD` | missing |
| Post-execution evidence path | yes | `TBD` | missing |

## Deployment Action Requirements

The deployment action must be explicit and must not be inferred from local development commands.

Acceptable action description examples:

- a named platform action operated outside this repository;
- a documented manual action in a staging console;
- a project-approved command that targets staging only.

Not accepted as deployment action in this repository:

- `pnpm build`;
- local development server commands;
- local Postgres helper startup;
- release creation;
- Git tag creation;
- GitHub release creation;
- remote Git push/fetch/merge as a deployment substitute;
- vendor CLI or external provider calls without a separate explicit approval task.

## Pre-execution Validation Requirement

Before any future execution, rerun the validation set against the approved candidate scope or an explicitly accepted artifact derived from it:

| Command | Required result | Latest request status |
| --- | --- | --- |
| `git rev-parse HEAD` or artifact identity check | matches approved candidate | required |
| `git status --porcelain` or artifact clean-source check | clean / reproducible | required |
| `pnpm lint` | pass | required |
| `pnpm typecheck` | pass | required |
| `pnpm test` | pass | required |
| `pnpm build` | pass | required |
| `git diff --check` | pass | required |

## Safety Checks

Before execution, confirm:

- no secret values or env values are printed or recorded;
- credential caches are not read;
- no external provider is called unless separately approved;
- optional live integration tests remain skipped unless separately approved;
- release, Git tag, and GitHub release creation remain out of scope;
- production ready remains false;
- staging deployed remains false until actual execution evidence exists.

## Execution Request Record

Fill this section only when a responsible operator is ready to request actual staging execution.

| Field | Value |
| --- | --- |
| Execution request id | `TBD` |
| Operator | `TBD` |
| Operator contact | `TBD` |
| Candidate commit or artifact | `fee65632c8c8380dae78baf8e69e8486ab4c9cdd` |
| Staging environment | `TBD` |
| Deployment target or platform | `TBD` |
| Deployment command or platform action | `TBD` |
| Rollback owner | `TBD` |
| Rollback command or platform action | `TBD` |
| Smoke base URL or health endpoint | `TBD` |
| Database migration decision | `TBD` |
| Config source confirmation | `TBD; do not record values` |
| Secret source confirmation | `TBD; do not record values` |
| Execution window | `TBD` |
| Expected post-execution evidence path | `TBD` |

## Hold Rules

Actual staging deployment remains blocked if any of the following is true:

- any required operator confirmation remains `TBD`;
- the deployment action is not explicit;
- the action targets a commit or artifact other than the approved candidate without reapproval;
- the rollback action is missing;
- the smoke base URL or health endpoint is missing;
- validation is not green;
- signoff validity expires;
- scope changes after approval;
- the requested action would expose secrets or env values;
- the requested action would create a release, tag, GitHub release, or production-ready claim.

## Current Recommendation

Recommendation: `blocked_pending_operator_confirmation`

Next required action: a responsible operator must provide the missing confirmations in this request before any future staging deployment execution can be reviewed or performed.
