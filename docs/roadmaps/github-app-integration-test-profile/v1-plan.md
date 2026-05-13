# GitHub App Integration-Test Profile v1 Plan

Status: v1_implemented

Canonical path: `docs/roadmaps/github-app-integration-test-profile/`. This follows the current docs layout in `docs/README.md`: cross-cutting rollout and integration profiles live under `docs/roadmaps/`, while feature implementation notes remain under `docs/features/real-git-adapter/`.

## Current Behavior

Real Git Adapter v2 keeps `MockGitProvider` as the default. Remote GitHub branch creation, PR creation, changed-file reads, and webhook read-model sync only run behind explicit gates, allowlists, SecretRef or controlled legacy credential paths, Auth/RBAC checks, and Policy-as-code decisions.

GitHub App Controlled Implementation v1 adds a runtime boundary with disabled and mock token providers, app runtime config, installation and repository grant read models, status-only token checks, redacted audit, and dashboard/health metadata. It does not add production rollout, private-key signing by default, or live installation-token exchange in default runtime/tests.

Staging CI/CD Pipeline Planning v0 defines optional integration gates, but before this task there was no first-class read-only profile that answered whether a GitHub App live test profile could run safely.

## Current Limitations

- Live GitHub App tests are skipped by default.
- There is no production webhook endpoint.
- Private key SecretRef is metadata-only; no raw key may be returned.
- Installation-token results may expose handles only, never token values.
- Cleanup is manual close/mark-only; branch deletion remains forbidden.

## Required Integration-Test Gates

All of these gates are required before any future live GitHub App integration test can run:

- `AICHESTRA_GITHUB_APP_INTEGRATION_TESTS=true`
- `AICHESTRA_ENABLE_REMOTE_GIT=true`
- `AICHESTRA_GITHUB_AUTH_MODE=github_app`
- `AICHESTRA_ENABLE_GITHUB_APP=true`
- `AICHESTRA_GITHUB_APP_ID`
- `AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF`
- `AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS`
- `AICHESTRA_GITHUB_APP_ALLOWED_REPOS`
- `AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX=ai/`
- `AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE=true`
- `AICHESTRA_ALLOW_REMOTE_PR_CREATE=true`
- `AICHESTRA_ALLOW_REMOTE_MERGE=false`

Webhook tests additionally require:

- `AICHESTRA_GITHUB_WEBHOOK_SECRET_REF`
- `AICHESTRA_ENABLE_GITHUB_WEBHOOKS=true`
- `AICHESTRA_GITHUB_WEBHOOK_ACCEPT_UNVERIFIED=false`

Missing gates cause optional live tests to skip. Unsafe gates, such as merge enabled, unverified webhook acceptance, raw private key env fallback, force-push, branch deletion, or a non-`ai/` branch prefix, are reported as unsafe.

## Test Repository Requirements

The repository must be explicitly allowlisted through `AICHESTRA_GITHUB_APP_ALLOWED_REPOS`. The allowlist must point to a non-production repository owned for integration testing. Dashboard, health, and readiness APIs report allowlist counts only, not configured env values.

## Branch Naming and Prefix

Live branch and PR tests must use the `ai/` prefix. The profile exposes `allowedBranchPrefix=ai/`, whether a prefix is configured, and whether it matches. It does not return arbitrary configured env values.

## Cleanup Policy

Cleanup is manual close/mark-only in v1. Closing or marking test PRs may be a future explicitly gated cleanup task. Branch deletion remains forbidden.

## No-Auto-Merge Policy

No test may merge, rebase, force-push, delete branches, change protected settings, or trigger destructive Git operations. `AICHESTRA_ALLOW_REMOTE_MERGE=true` is an unsafe gate and prevents live test readiness.

## Webhook Fixture vs Live Webhook Split

Signed webhook fixture tests are allowed in default test runs because they do not call GitHub and do not need a public endpoint. Live webhook delivery tests remain future until a non-production endpoint and operations process exist.

## SecretRef Requirements

GitHub App private key and webhook secret material must be represented by SecretRef IDs only. Raw private key env values are unsupported and treated as unsafe. The readiness APIs do not resolve secrets and do not return SecretRef values beyond safe metadata/counts.

## Audit and Observability Expectations

Expected audit events include GitHub App token request status, branch/PR/changed-files operation metadata, webhook fixture verification metadata, and skip reasons when gates are missing. Audit and dashboard data must never include private key material, installation tokens, webhook secrets, legacy GitHub tokens, raw webhook payloads, or credential-cache paths.

Planned metrics include configured gate counts, missing gate counts, unsafe gate counts, skipped live test count, fixture test count, and future live test outcomes. No external observability export is added.

## Implemented in This Task

- Read-only GitHub App integration-test profile models.
- Deterministic test-case and safety-check seed data.
- Readiness service methods and `canRunLiveTests()` summary logic.
- Read-only API endpoints under `/readiness/github-app-integration/*`.
- Safe `/health` metadata with counts and booleans only.
- Dashboard API/read-model section for the profile.
- Default skipped live test skeleton.
- Deterministic tests for models, API, dashboard, health, skip behavior, unsafe gates, no-secret/no-env exposure, branch prefix, and repo allowlist requirements.
- Documentation under this roadmap.

## Out of Scope

- Production GitHub App rollout.
- Live installation-token exchange in default runtime/tests.
- Real GitHub calls in default tests.
- Production webhook endpoint.
- Auto-merge, rebase, force-push, branch deletion, or destructive cleanup.
- GitLab or Bitbucket.
- LLM, MCP, secret backend, cloud deployment, Terraform, Helm, Kubernetes, Temporal, or artifact registry integration.
