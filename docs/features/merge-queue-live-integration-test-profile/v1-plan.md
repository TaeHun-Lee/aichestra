# Merge Queue Live Integration-Test Profile v1 Plan

Status: v1_planned

## Chosen Docs Path

`docs/README.md` records the convention that other integration-test profile rollouts (GitHub App, LLM Gateway, Vault) live under `docs/roadmaps/<slug>/`. This task is sufficiently coupled to a single feature (Merge Queue Policy v2, which lives under `docs/features/merge-queue-policy/`) that the work-order asks for the documents under `docs/features/merge-queue-live-integration-test-profile/`. Both forms are valid per `docs/README.md`. This task follows the work-order path. The `docs/README.md` features table will list the new folder so the feature can be located by content and title.

## Current Behavior

### Merge Queue Policy v2

Merge Queue Policy v2 is implemented under `packages/core/src/conflicts/merge-queue-policy.ts` and surfaced via `/git/merge-queue/*` API and the dashboard conflict panel. It evaluates readiness, holds, ranking, and required actions against branch lease, workspace lease, multi-session coordination, edit-intent, conflict risk, dry-run merge, validation, approval, and policy evidence. It does not execute merges, call remote Git providers, run vendor CLIs, call LLMs, mutate workspaces, or expose secrets/env values. Documented in `docs/features/merge-queue-policy/v2.md`.

### Real Git Adapter v2

Real Git Adapter v2 keeps `MockGitProvider` as the default. Remote GitHub branch creation, PR creation, changed-file reads, and webhook read-model sync run only behind explicit gates (`AICHESTRA_ENABLE_REMOTE_GIT`, allowlists, SecretRef-backed credentials, Auth/RBAC, Policy-as-code). It explicitly disables merge, rebase, force-push, branch deletion, and remote PR updates by default. Documented in `docs/features/real-git-adapter/v2.md`.

### GitHub App Integration-Test Profile v1

`docs/roadmaps/github-app-integration-test-profile/v1.md` exposes a read-only profile, test cases, safety checks, and a readiness summary covering controlled branch/PR fixture and webhook validation. It is skipped by default and never returns env values or secret material. Live execution paths remain absent in default tests.

### Gap This Task Fills

No first-class read-only profile currently answers whether the merge queue can be validated live against a non-production Git repository while keeping merge execution disabled. The work-order specifies a controlled, skipped-by-default profile so that:

- merge queue policy decisions can be evaluated against gated test branch metadata,
- the dry-run merge simulation may run against the locally configured fixtures only,
- safety gates (no auto-merge, no force-push, no remote rebase, no branch delete, dry-run only, repo allowlist, branch prefix, env redaction) are enforceable and reviewable, and
- live integration tests remain disabled-by-default.

## Required Integration-Test Gates

All required gates must be configured before any future live merge-queue integration test can run:

- `AICHESTRA_MERGE_QUEUE_INTEGRATION_TESTS=true`
- `AICHESTRA_ENABLE_REMOTE_GIT=true`
- `AICHESTRA_GITHUB_INTEGRATION_TESTS=true` OR `AICHESTRA_GITHUB_APP_INTEGRATION_TESTS=true`
- `AICHESTRA_GIT_PROVIDER=github`
- `AICHESTRA_GIT_ALLOWED_REPOS` (non-empty allowlist of repos)
- `AICHESTRA_GIT_ALLOWED_BRANCH_PREFIX=aichestra/test/`
- `AICHESTRA_ALLOW_REMOTE_MERGE=false`
- `AICHESTRA_ALLOW_REMOTE_REBASE=false`
- `AICHESTRA_ALLOW_REMOTE_FORCE_PUSH=false`
- `AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE=false`
- `AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY=true`
- `AICHESTRA_TEST_MERGE_QUEUE_REPO` (allowlisted repo)
- `AICHESTRA_TEST_MERGE_QUEUE_BASE_BRANCH` (non-default safe branch)
- `AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES` (csv, all under prefix)

Missing gates cause optional live tests to skip; the default test suite still passes. The following unsafe states are reported as `unsafe` and prevent live test readiness:

- `AICHESTRA_ALLOW_REMOTE_MERGE=true`
- `AICHESTRA_ALLOW_REMOTE_REBASE=true`
- `AICHESTRA_ALLOW_REMOTE_FORCE_PUSH=true`
- `AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE=true`
- `AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY=false`
- Configured branch prefix other than `aichestra/test/`
- Configured provider other than `github`
- Test source branch values outside the configured prefix
- Test base branch matches the configured source branches

## Test Repository Requirements

The repository must be explicitly allowlisted through `AICHESTRA_GIT_ALLOWED_REPOS` and pointed to a non-production fixture repository owned for integration testing. The readiness API and dashboard return allowlist counts only, never env values. The configured test repo must appear in the allowlist; if it does not, the profile reports unsafe.

## Branch/PR Fixture Requirements

All live branch and PR fixtures must use the `aichestra/test/` prefix. The base branch must differ from the source branches, and source branches must satisfy the configured prefix. The profile exposes counts and booleans only, never raw branch names from env values.

## No-Auto-Merge Policy

No live integration test may merge, rebase, force-push, delete branches, or update protected remote settings. `AICHESTRA_ALLOW_REMOTE_MERGE=true`, `AICHESTRA_ALLOW_REMOTE_REBASE=true`, `AICHESTRA_ALLOW_REMOTE_FORCE_PUSH=true`, and `AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE=true` are unsafe gates and block live readiness. The default policy decision and dashboard text continue to record `mergeExecutionEnabled: false`.

## Dry-Run-Only Live Validation

Live validation, when gates allow, is restricted to:

- merge queue policy evaluation against test-only branch metadata,
- dry-run merge simulation against the existing safe local/mock dry-run path,
- branch lease check metadata,
- conflict risk check metadata,
- policy decision check metadata,
- cleanup-policy check metadata (no destructive action).

Real fetch, push, merge, rebase, force-push, branch deletion, PR creation/update, or remote merge calls are never performed by this profile.

## Cleanup Policy

Cleanup is manual mark-only in v1. Branch deletion is forbidden. The profile records a cleanup-check that confirms `manual_mark_only` and `branchDeletionAllowed: false`.

## Read-Only Surfaces

The readiness service exposes:

- `getMergeQueueIntegrationTestProfile()`
- `listMergeQueueIntegrationTestCases()`
- `listMergeQueueIntegrationTestSafetyChecks({ category? })`
- `canRunMergeQueueIntegrationLiveTests()`
- `getMergeQueueIntegrationTestReadinessSummary()`

Read-only HTTP endpoints:

- `GET /readiness/merge-queue-integration/profile`
- `GET /readiness/merge-queue-integration/test-cases`
- `GET /readiness/merge-queue-integration/safety-checks?category=...`
- `GET /readiness/merge-queue-integration/summary`

Health metadata key: `mergeQueueIntegrationTests`.

Dashboard endpoint: `/dashboard/merge-queue-integration` returning a `MergeQueueIntegrationTestReadModel` (panel: live tests enabled, missing/unsafe gate counts, allowlist counts, dry-run-only status, no-auto-merge status, cleanup policy, test cases, safety checks, no-secret status).

## Audit and Observability Expectations

Audit events for this profile may record: skip reasons when gates are missing, profile validation metadata, safety-check outcomes, and dashboard read-only events. They must never include env values, repo URLs, branch names from env, or remote merge calls (none are made).

## Implemented in This Task

- Read-only `MergeQueueIntegrationTestProfile`, `MergeQueueIntegrationTestCase`, `MergeQueueIntegrationSafetyCheck`, `MergeQueueIntegrationTestReadinessSummary` models.
- Deterministic catalog seed for profile, test cases, safety checks.
- Readiness service methods, `canRunMergeQueueIntegrationLiveTests`, and a summary.
- Read-only API endpoints under `/readiness/merge-queue-integration/*`.
- Health metadata under `mergeQueueIntegrationTests`.
- Dashboard read model + panel renderer.
- Default-skipped live test skeleton.
- Deterministic tests for models, API, dashboard, gates, no-secret/no-env exposure, branch prefix, repo allowlist, dry-run-only, no-auto-merge, no force-push, no branch-delete.
- Documentation: this plan + `v1.md` + cross-references in `merge-queue-policy/v2.md`, `real-git-adapter/v2.md`, `github-app-integration-test-profile/v1.md`, `roadmaps/real-integration-roadmap.md`, `reference/environment-gate-matrix.md`, `reference/runtime-component-inventory.md`, `dashboard/v0.md`, `docs/README.md`, `README.md`, `AGENTS.md`.

## Out of Scope

- Real merge execution.
- Auto-merge.
- Remote merge/rebase/force-push/branch-delete calls.
- Live remote Git in default tests.
- PR creation or update.
- Vendor CLI execution.
- LLM calls.
- Workspace mutation.
- GitLab or Bitbucket.
- Production rollout.

## Recommended Next Task

Conflict Resolution Assistant v1, or Merge Queue Live Dry-run Execution v1.
