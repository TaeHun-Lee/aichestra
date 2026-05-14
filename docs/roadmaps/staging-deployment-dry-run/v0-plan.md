# Staging Deployment Dry-run Profile v0 Plan

## Document placement

`docs/README.md` keeps cross-cutting delivery plans under `docs/roadmaps/`, with stable references under `docs/reference/` and implementation surfaces under `docs/features/`. This dry-run profile aggregates multiple staging and production-readiness planning surfaces, so the canonical plan lives at `docs/roadmaps/staging-deployment-dry-run/v0-plan.md`.

## Current status

- Staging Deployment Profile v0 is implemented as a read-only, non-production readiness surface. It exposes staging gates, checks, promotion criteria, rollback criteria, and dashboard/API read models, but it does not deploy anything or mark staging as deployed.
- Staging CI/CD Pipeline Planning v0 is implemented as planning metadata. It models local validation jobs, optional remote integration gates, staging promotion blockers, and rollback planning without creating active workflows or running CI jobs.
- GitHub App integration-test profile v1 is implemented and skipped by default. Live tests require every explicit GitHub App and remote Git gate; missing gates skip rather than fail default validation.
- LLM Gateway integration-test profile v1 is implemented and skipped by default. Live tests require explicit remote LLM gates, model allowlists, budget caps, Auth/RBAC, and Policy checks; missing gates skip rather than fail default validation.
- Persistent DB Production Operations v1 is implemented as read-only planning metadata. It reports migration/index/retention/backup/pooling readiness, but does not connect to production databases, run migrations, or run backups.
- Secret Backend Migration Planning v0 is implemented as read-only planning metadata. Real secret backends remain future work, and no secrets or env values are exposed.
- Production Auth/RBAC v1 Planning is implemented as provider-neutral planning metadata. Real IdP/session/token integration remains out of scope.
- Policy Bundle / OPA-Cedar Planning v0 is implemented as planning metadata. Static policy remains authoritative; no dynamic policy code, OPA, Cedar, or external policy calls are executed.
- Observability / Audit Retention v0 is implemented as mock-first read models and sanitized audit retention metadata. No external observability backend or export is enabled.

No critical validation blocker prevents implementing this dry-run read model. The blockers identified above are readiness blockers for staging or production rollout, not blockers to creating a read-only dry-run report.

## Proposed dry-run model

Staging Deployment Dry-run Profile v0 will add read-only readiness objects:

- `StagingDeploymentDryRunProfile` for the profile metadata, allowed capabilities, blocked capabilities, and required/optional readiness sources.
- `StagingDeploymentDryRunSource` for source-by-source readiness signals across staging, CI/CD, DB operations, GitHub App, GitHub integration tests, LLM Gateway, LLM integration tests, MCP, auth, secrets, SecretRef credentials, policy bundles, observability, dashboard, local agent, runner, and Git.
- `StagingDeploymentDryRunCheck` for deterministic checks by category.
- `StagingDeploymentDryRunBlocker` for blocker severity, blocking level, status, remediation, and source links.
- `StagingDeploymentDryRunReport` for the generated summary, source summaries, checks, blockers, and recommended next actions.

All objects are read-model objects only. They must not deploy, call external services, run integration tests, run migrations, read secrets, expose env values, issue credentials, or mutate state.

## Aggregation strategy

The service will aggregate existing deterministic readiness summaries where practical:

- Staging Deployment Profile summary, gates, checks, promotion criteria, and rollback criteria.
- Staging CI/CD Pipeline summary, jobs, optional integration gates, checks, and risks.
- Persistent DB Production Operations summary.
- GitHub App hardening planning summary and GitHub App integration-test profile summary.
- LLM Gateway integration-test profile summary and safe LLM Gateway planning metadata.
- Secret Backend Migration summary.
- Production Auth/RBAC summary.
- Policy Bundle / OPA-Cedar summary.
- Production Deployment Readiness summary.

For surfaces without a direct deployment-readiness service dependency, the dry-run will use deterministic read-only summaries and document the gap: Observability, MCP Gateway, Real Git Adapter status, LLM Gateway default mode, Dashboard API read model, Local Agent Protocol, and Runner.

## Blocker severity model

Severity levels:

- `critical`: unsafe default behavior, secret/env exposure, destructive remote Git capability, vendor CLI execution, real MCP transport without safety readiness, or validation command failure.
- `high`: staging validation is not meaningful yet, such as missing required staging Postgres or absent non-production secret backend decision.
- `medium`: gated optional integration validation or incomplete planning metadata that should be resolved before rollout.
- `low`: advisory improvements that do not block the dry-run.

Blocking levels:

- `blocks_staging_dry_run`: the dry-run cannot be trusted until fixed.
- `blocks_staging_deployment`: the dry-run can run, but staging deployment validation should not proceed.
- `blocks_production_only`: staging may continue under explicit mock/controlled fallback constraints, but production cannot.
- `advisory`: non-blocking follow-up.

## Dry-run report structure

The report will include:

- Profile metadata and dry-run mode.
- Overall status: `pass`, `pass_with_warnings`, `blocked`, or `not_ready`.
- Source summaries with status, severity, evidence, and remediation.
- Checks with category, status, severity, required flag, evidence, and remediation.
- Blockers grouped by severity and blocking level.
- Integration profile classification: ready, gated, skipped, blocked, or future.
- Promotion guidance and rollback guidance.
- Recommended next actions.
- Safety metadata proving `stagingDeployed = false`, `productionReady = false`, no deployment execution, no external calls, no remote integration-test execution, and no secret/env exposure.

## API and dashboard plan

Add read-only DTO-backed endpoints:

- `GET /readiness/staging-dry-run/profile`
- `GET /readiness/staging-dry-run/sources`
- `GET /readiness/staging-dry-run/checks`
- `GET /readiness/staging-dry-run/blockers`
- `GET /readiness/staging-dry-run/report`
- `GET /readiness/staging-dry-run/summary`

Add safe `/health` metadata for the dry-run status, blocker counts, warning counts, timestamps, `productionReady = false`, and `stagingDeployed = false`.

Add a dashboard panel showing overall status, source summary, required checks, warnings, critical blockers, recommended next actions, skipped integration profiles, no-secret/no-env status, `stagingDeployed = false`, and `productionReady = false`.

## This task implements

- Domain/readiness models and DTOs.
- Deterministic aggregation and blocker rules.
- Read-only service methods.
- Read-only API endpoints and health metadata.
- Dashboard read-model and web panel.
- Deterministic tests for models, aggregation, endpoints, dashboard panel, health metadata, safety, and skipped integration profiles.
- Documentation, report format, blocker taxonomy, roadmap/reference updates, and phase audit updates.

## Out of scope

- Deploying anything.
- Creating active CI workflows.
- Running remote Git, LLM, MCP, auth, cloud, registry, Kubernetes, Temporal, OPA, Cedar, Vault, or vendor CLI calls.
- Running integration tests from the dry-run report.
- Reading secrets or credential caches.
- Exposing env values, tokens, session IDs, credentials, raw prompts, raw provider responses, or raw logs.
- Implementing real production auth, real secret backend migration, real observability export, real policy bundle execution, or production DB operations.
- Marking staging as deployed or production as ready.
