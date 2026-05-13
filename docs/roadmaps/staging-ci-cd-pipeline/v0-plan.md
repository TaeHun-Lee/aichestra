# Staging CI/CD Pipeline Planning v0 Plan

Status: planned_for_implementation
Scope: planning and read-only readiness model only
Canonical path: `docs/roadmaps/staging-ci-cd-pipeline/`

This path follows `docs/README.md`: cross-cutting readiness work lives under `docs/roadmaps/`, while environment matrices live under `docs/reference/`.

## Current Validation Commands

The current repository validation baseline is:

- `pnpm install` when dependency metadata changes.
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `git diff --check`

Default validation must not call external providers, run remote Git operations, execute vendor CLIs, deploy infrastructure, or read credential caches.

## Current Node / Volta / pnpm Baseline

- `package.json` requires Node `>=24.0.0`.
- Volta pins Node `24.15.0`.
- `.nvmrc` records `24`.
- pnpm is the package manager used by all scripts.

CI should run Node 24.x and should warn, not leak secrets, when runtime Node metadata is surfaced through readiness APIs.

## Current Staging Profile Behavior

Staging Deployment Profile v0 is implemented as a non-production, read-only readiness surface:

- `/readiness/staging/*` exposes profile, gates, checks, promotion criteria, rollback criteria, and summary.
- `/dashboard/staging` renders sanitized staging readiness data.
- `/health` exposes staging booleans/counts only.
- Staging is not deployed and production traffic is not enabled.
- Remote MCP, vendor CLI execution, remote merge, force push, rebase, and branch deletion are blocked.

## Current Optional Integration Test Gates

Optional tests are skipped by default and require explicit gates:

- Postgres: `AICHESTRA_TEST_DATABASE_URL`.
- Remote Git: Real Git Adapter gates, repo allowlist, branch prefix, credentials, Auth/RBAC, and Policy.
- GitHub webhook: webhook enablement, secret configuration, signature verification, and replay controls.
- GitHub App: GitHub App gates, private-key SecretRef metadata, installation/repo allowlists, and no token exposure.
- Remote LLM: LLM Gateway gates, model allowlist, budget, credentials, Auth/RBAC, and Policy.
- Remote MCP, external auth, and vendor CLI tests remain future/blocked in v0.

## Current Docs / Readiness Surfaces

Relevant current surfaces:

- `docs/roadmaps/staging-deployment-profile/v0.md`
- `docs/roadmaps/staging-deployment-profile/integration-test-policy-v0.md`
- `docs/reference/staging-environment-gate-matrix.md`
- `docs/roadmaps/production-deployment-readiness/ci-cd-release-v0.md`
- `docs/roadmaps/production-deployment-readiness/checklist-v0.md`
- `docs/reference/environment-gate-matrix.md`
- `docs/features/dashboard/v0.md`

## Proposed CI Job Matrix

Required baseline jobs:

- install
- lint
- typecheck
- test
- build
- diff check

Safety jobs:

- safe integration scan
- secret exposure scan
- docs path consistency check
- no production-ready overclaim check
- Node/Volta version check
- dependency lockfile check
- dashboard no-secret smoke check
- health no-secret smoke check

Optional jobs:

- optional Postgres repository contracts
- optional remote Git/GitHub tests
- optional GitHub App tests
- optional webhook tests
- optional LLM Gateway integration-test profile v1 live tests
- optional remote MCP tests, future only
- optional external auth tests, future only
- optional vendor CLI tests, future only

## Proposed Safe Integration Test Profiles

- `local_validation`: required baseline only; no external calls and no secrets.
- `pull_request`: baseline plus safety scans; no remote integrations.
- `integration`: baseline plus optional local/test Postgres profile when explicitly configured.
- `staging`: baseline plus staging readiness checks and explicitly gated optional integration tests.
- `release_candidate`: future profile; requires approvals and must still not deploy in v0.

## Proposed Secret / Env Safety Rules

- CI must never print secret values or env values.
- Readiness APIs return booleans, counts, statuses, and documentation references only.
- SecretRef-backed credentials are preferred over env fallback.
- Env fallback is local/integration compatibility only and is not staging-ready except tightly controlled tests.
- CI logs, reports, and artifacts must redact tokens, keys, DB URLs, raw prompts, raw provider outputs, webhook payloads, and credential-cache paths.

## Proposed Artifact / Report Policy

Allowed artifacts:

- test result summaries
- lint/typecheck/build logs after redaction
- readiness summaries
- future coverage summaries
- future dashboard or health smoke summaries with secret checks

Forbidden artifacts:

- raw secrets, tokens, private keys, webhook secrets, DB URLs
- raw provider prompts/outputs
- raw webhook payloads
- credential cache contents or paths
- unredacted env dumps

## Proposed Failure / Rollback Policy

CI/CD v0 defines failure handling only:

- baseline job failures block staging promotion.
- secret exposure fails hard and requires incident review.
- external call outside explicit gates fails hard.
- optional integration test failure blocks only the profile that enabled it.
- remote cleanup and rollback are future/manual plans; no cleanup worker is implemented.

## What This Task Implements

- CI/CD planning docs under `docs/roadmaps/staging-ci-cd-pipeline/`.
- Planning/readiness models in `packages/deployment-readiness`.
- Read-only `/readiness/ci-cd/*` endpoints.
- Safe `/health` CI/CD metadata.
- Dashboard CI/CD readiness panel.
- Deterministic tests for models, APIs, dashboard, health, no-secret/no-env behavior, and default disabled optional integrations.
- Documentation and phase audit updates.

## Out Of Scope

- Live deployment.
- Active production GitHub Actions workflows that run remote integrations by default.
- Terraform, Pulumi, Helm, Kubernetes, cloud infra, or production deployment code.
- Real secret backend integration.
- Real OIDC/SAML/SCIM/SSO.
- Remote Git/LLM/MCP/auth calls in default runtime/tests.
- Vendor CLI execution.
- Credential-cache reads.
- Artifact registry publishing.
- Production-ready claims.
