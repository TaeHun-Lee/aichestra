# Staging Release Candidate Checklist v0 Plan

## Document placement

`docs/README.md` places cross-cutting delivery and readiness plans under `docs/roadmaps/`. Staging Release Candidate Checklist v0 aggregates staging, CI/CD, dry-run, integration-test, production readiness, observability, dashboard, and safety surfaces, so the canonical plan lives at `docs/roadmaps/staging-release-candidate/v0-plan.md`.

## Current status

- Staging Deployment Dry-run Profile v0 is implemented as a read-only aggregation surface. It classifies staging, CI/CD, DB, GitHub App integration, LLM integration, MCP, auth, secrets, policy bundle, observability, dashboard, Local Agent, runner, and Git readiness without deploying, running CI jobs, calling providers, executing remote integration tests, or exposing secrets/env values.
- Staging CI/CD Pipeline Planning v0 is implemented as read-only planning metadata. It defines local validation jobs, optional integration gates, artifact/report policy, staging promotion, and cleanup/rollback expectations without creating active workflows.
- GitHub App integration-test profile v1 is implemented and skipped by default. Live tests require every explicit GitHub App and remote Git gate, non-production allowlists, no remote merge, and SecretRef metadata.
- LLM Gateway integration-test profile v1 is implemented and skipped by default. Live tests require every explicit OpenAI-compatible gate, model allowlist/default model, budget cap, safe prompt class, fallback disabled, SecretRef/credential gate, Auth/RBAC, and Policy-as-code.
- Production Deployment Readiness Planning v0 is implemented as planning metadata. Production remains blocked by real auth, real secret backend, durable observability, production DB operations, tenant isolation, policy bundle runtime, production deployment controls, and live provider rollout work.
- Observability / Audit Retention v0 is implemented as mock-first read models and sanitized audit/metric/trace skeletons. No external observability backend, audit export, alert delivery, or retention deletion exists.

No critical validation blocker prevents implementing this read-only checklist. Existing production and staging blockers remain blockers for calling a branch a staging release candidate, not blockers for creating the checklist model.

## Current known production blockers

- Real OIDC/SAML/SCIM/SSO, sessions, JWT issuance, password auth, service-account credential issuance, and tenant isolation are not implemented.
- Real Vault/cloud/custom secret backend integration, rotation, lease enforcement, and production credential issuance are not implemented.
- Production DB pooling, backup/restore jobs, migration governance enforcement, durable webhook replay/dead-letter storage, retention/legal hold, and tenant-scoped data operations are not implemented.
- Policy bundle runtime, signed bundle verification, dynamic policy execution controls, policy rollout/rollback, and break-glass execution are not implemented.
- External observability backend/export, alerting, production metrics/traces, and audit retention enforcement are not implemented.
- Live GitHub App private-key signing, installation-token exchange, production webhook endpoint rollout, and production LLM integration are not implemented.

## Proposed staging release candidate criteria

A commit or branch qualifies as a staging release candidate only when:

- Required local validation gates pass: dependency install when dependency metadata changed, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `git diff --check`.
- Staging dry-run report has no `blocks_staging_dry_run` blockers and no open critical blockers.
- Secret/env exposure checks pass.
- Destructive or unsafe capabilities stay disabled: remote merge, force push, branch deletion, vendor CLI execution, real MCP transport, production traffic, and deployment execution.
- Required docs are present: staging dry-run docs, staging CI/CD docs, production readiness checklist, RC checklist docs, report format, release notes template, rollback checklist, environment gate matrix, runtime component inventory, dashboard docs, README, and AGENTS.
- Optional live integration profiles are either explicitly gated and passed in a separate validation task or explicitly skipped and documented.
- Missing production auth and missing real secret backend are documented as production blockers and accepted staging limitations for RC checklist v0.
- Sign-off expectations are represented as metadata; v0 does not perform real approval or identity enforcement.
- Release notes and rollback checklist sections are defined.

## Required validation gates

- `pnpm lint`: required.
- `pnpm typecheck`: required.
- `pnpm test`: required.
- `pnpm build`: required.
- `git diff --check`: required; known line-ending warnings may be downgraded to warning if documented.
- Safe integration scan: required as a documented gate.
- No-secret/no-env exposure scan: required.
- Docs update check: required.
- Dashboard/readiness no-secret check: required.

The checklist records validation status provided by the caller/tests or future CI read models. It does not execute commands.

## Optional skipped integration test policy

Skipped optional tests are allowed for staging RC v0 when they are explicitly documented and are not required by the current staging RC criteria:

- Optional Postgres contract tests may skip unless `AICHESTRA_TEST_DATABASE_URL` is configured.
- GitHub, GitHub App, webhook, remote Git, and LLM integration profiles may skip unless all explicit non-production gates are configured and a separate live validation task is requested.
- Remote MCP, external auth, and vendor CLI profiles remain future/blocked and must not run by default.

Skipped optional profiles must appear in the RC report and release notes.

## Blocker severity model

- `critical`: unsafe behavior, validation failure, secret/env exposure, remote merge, force push, branch deletion, vendor CLI execution, real MCP transport without readiness, release creation, tag creation, deployment execution, external calls, or production/staging-ready overclaim.
- `high`: required docs missing, required validation not checked, staging dry-run blocked, required release-note section missing, required rollback item missing, or required signoff pending.
- `medium`: skipped optional integration tests, mock actor warning, env fallback warning, missing production auth/secret backend when documented as production-only or accepted staging limitation.
- `low`: advisory follow-up.

## Sign-off model

The checklist defines expected roles but does not implement real approval workflow:

- engineering owner
- platform owner
- security reviewer
- product owner
- QA reviewer
- release manager

Statuses are metadata-only: `pending`, `approved_mock`, `waived`, or `not_applicable`.

## Release note model

Required sections:

- Summary
- Changed areas
- Validation
- Skipped tests
- Safety gates
- Known limitations
- Migration notes
- Dashboard/readiness notes
- Rollback notes
- Follow-ups

v0 defines requirements and a template; it does not create a release or publish notes.

## Rollback checklist model

Rollback planning covers code revert, DB/migration consideration, config rollback, feature flags, GitHub integration gates, LLM integration gates, SecretRef/env gates, dashboard/readiness rollback, observability/audit review, and manual verification. v0 does not run rollback actions.

## API and dashboard plan

Add read-only DTO-backed endpoints:

- `GET /readiness/staging-rc/checklist`
- `GET /readiness/staging-rc/gates`
- `GET /readiness/staging-rc/blockers`
- `GET /readiness/staging-rc/signoffs`
- `GET /readiness/staging-rc/release-notes`
- `GET /readiness/staging-rc/rollback`
- `GET /readiness/staging-rc/report`
- `GET /readiness/staging-rc/summary`

Add safe `/health` metadata with status, gate counts, blocker counts, signoff counts, `productionReady = false`, `stagingDeployed = false`, no release, no deployment, no external calls, and no secret/env exposure.

Add `/dashboard/staging-rc` showing RC status, required gates, blockers, skipped optional tests, signoff status, release-note status, rollback checklist, recommended actions, and safety flags.

## This task implements

- RC checklist, gate, blocker, signoff, release-note requirement, rollback checklist, report, and summary models.
- Deterministic evaluation rules.
- Read-only service methods.
- Read-only API endpoints, health metadata, dashboard read model, and dashboard panel.
- Deterministic tests for models, evaluation, API, dashboard, health, no-secret/no-env, no-release, no-deployment, and skipped optional profiles.
- Documentation, report format, release notes template, rollback checklist, roadmap/reference updates, README/AGENTS updates, and phase audit updates.

## Out of scope

- Creating a release.
- Creating Git tags.
- Creating GitHub releases.
- Deploying anything.
- Running deployment commands or CI jobs.
- Running remote integration tests from this checklist.
- Calling GitHub, LLM providers, MCP servers, external auth providers, Vault, cloud services, Kubernetes, Temporal, OPA/Cedar, artifact registries, or vendor CLIs.
- Reading credential caches.
- Reading, printing, issuing, or exposing secrets, env values, tokens, sessions, JWTs, or production credentials.
- Implementing production auth, production secret backend, production deployment, staging deployment, infrastructure manifests, artifact registry, or active release workflows.
