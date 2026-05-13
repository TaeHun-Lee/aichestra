# Staging Deployment Profile v0 Plan

## Canonical Path

`docs/README.md` places cross-cutting rollout, integration, and operational planning under `docs/roadmaps/`, with reference matrices under `docs/reference/`. Staging Deployment Profile v0 therefore lives under `docs/roadmaps/staging-deployment-profile/`, with the staging-specific environment matrix in `docs/reference/staging-environment-gate-matrix.md`.

## Current Deployment Readiness Status

Production Deployment Readiness Planning v0 is implemented as read-only planning metadata. It defines local, integration, staging, and production profile concepts, runtime component inventory, environment gates, production blockers, API endpoints, and dashboard readiness panels. It does not deploy anything or enable production traffic.

Current staging is only a planned profile in the general deployment readiness model. It is not a first-class profile contract with its own gates, readiness checks, promotion criteria, rollback criteria, API surface, or dashboard panel.

## Current Local / Integration / Profile Assumptions

- `local`: in-memory storage, mock providers, mock Auth/RBAC, metadata-only SecretRefs, static policy, local/in-memory audit and dashboard read models.
- `integration`: optional Postgres tests and explicitly gated GitHub/OpenAI-compatible paths; still mock auth and no production traffic.
- `staging`: currently described as a future non-production rehearsal profile requiring Postgres, migrations, real auth/secret backend planning, audit retention, API-backed dashboard, and destructive Git/provider actions disabled.
- `production`: blocked until production Auth/RBAC, real secret backend, policy bundles, observability/export/retention, DB operations, tenancy, backup/restore, and deployment controls are implemented.

## Current Env Gate Matrix

`docs/reference/environment-gate-matrix.md` documents env names, booleans/counts allowed in health/dashboard, and production safety posture. It already covers storage, GitHub legacy token mode, GitHub App controlled mode, webhooks, LLM, env SecretRef provider, Local Agent Runner, dashboard source, future auth, future secret backend, future MCP, future policy bundle, and future observability gates.

Staging needs its own environment-gate contract because it is stricter than integration but still not production.

## Current GitHub App Readiness

GitHub App / Production Webhook Hardening Planning v0 defines permissions, webhook allowlists, replay/dead-letter, credential, endpoint, and risks. GitHub App Controlled Implementation v1 adds config-derived runtime/read models and a mock token-handle boundary. It does not implement live GitHub App installation discovery, private-key signing, JWT issuance, installation-token exchange, or production webhook rollout.

In staging v0, GitHub App is allowed only as a gated/mock/status boundary or future integration-test profile. Merge, rebase, force-push, branch deletion, workflow/admin/secrets/deployment permissions, and webhook-triggered agent execution remain forbidden.

## Current LLM Gateway Readiness

LLM Gateway v2 supports mock-first routing, bounded fallback read models, and one gated OpenAI-compatible HTTP path. Remote completion requires explicit gates, model allowlists, SecretRef/credential checks, budget checks, Auth/RBAC, and Policy-as-code. It is not production-ready and does not implement broad provider calls, BYOK, OAuth/WIF/IAM, streaming, or Local CLI execution.

In staging v0, remote LLM is gated and optional for controlled validation only through LLM Gateway integration-test profile v1; mock-only remains the safe default.

## Current MCP Gateway Readiness

MCP Gateway v0 is mock-first. Real MCP transport is disabled, high/critical tools are denied, secret forwarding is unavailable, and mock invocations are deterministic read-only operations behind Auth/RBAC, Policy-as-code, redaction, and audit boundaries.

In staging v0, remote/real MCP transport remains blocked.

## Current Auth/RBAC Readiness

Production Auth/RBAC v1 Planning is implemented as read-only planning metadata with IdP options, role/permission matrix, tenant/scope plans, service-account plans, request-context propagation, mock actor deprecation, health metadata, and dashboard visibility. It does not implement real OIDC, SAML, SCIM, SSO, sessions, JWTs, service-account credentials, or tenant enforcement.

In staging v0, mock actor warning must stay visible. Real auth is a production and future-staging blocker, not implemented here.

## Current Secret Backend Readiness

Secret Backend Migration Planning v0 defines backend options, SecretRef migration, credential-kind migration, lease/rotation, env fallback deprecation, readiness checks, health metadata, and dashboard visibility. It does not integrate Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, custom backends, rotation jobs, credential issuance, or actual secret migration.

In staging v0, env fallback is discouraged or blocked except controlled integration tests, and real secret backend remains a blocker.

## Current DB Operations Readiness

Persistent DB Production Operations v1 defines DB profiles, migration metadata, index review, retention/audit growth, webhook persistence, backup/restore, pooling, health metadata, and dashboard visibility. It does not provision or connect to production DBs, execute migrations automatically, run backups/restores, delete data, or enable live partitioning.

In staging v0, Postgres is required or strongly recommended; migration status must be visible; backup/restore and pooling remain blockers until implemented.

## Proposed Staging Profile Goals

- Define staging as a non-production controlled validation environment.
- Make staging stricter than integration but not production.
- Require API-backed dashboard/readiness visibility.
- Model allowed, gated, blocked, and future integrations.
- Expose staging readiness, promotion criteria, rollback criteria, and blockers through read-only APIs and dashboard data.
- Preserve mock-first defaults and all existing safety boundaries.
- Avoid deployment, infrastructure code, live probes, provider calls, secret reads, and mutation side effects.

## Staging Allowed Features

- API, web dashboard, worker, migration-runner metadata, and background-job planning.
- Postgres readiness as a required or strongly recommended staging storage mode.
- GitHub App controlled boundary in mock/status or explicitly gated validation profile.
- GitHub webhook verification/read-model behavior only when signature verification and allowlists are configured.
- Remote Git branch/PR/read behavior only behind existing Real Git Adapter and GitHub App gates.
- Remote LLM completion only behind LLM Gateway v2 gates, budget, SecretRef, Auth/RBAC, Policy-as-code, and model allowlists.
- Dashboard API-backed read models with demo fallback disabled in a real staging deployment profile.
- Observability/audit read models with no external export.

## Staging Blocked Features

- Deployment execution and production traffic.
- Kubernetes, Terraform, Pulumi, Helm, cloud infrastructure, Temporal, artifact registry, Vault/cloud secret backend integration, and vendor CLIs.
- Real production auth, OIDC/SAML/SCIM/SSO/login/session/JWT behavior.
- Real secret backend calls, rotation jobs, credential issuance, credential cache reads, and raw secret exposure.
- Remote merge, rebase push, force push, branch deletion, workflow/admin/secrets/deployment GitHub permissions.
- Real MCP transport, high/critical MCP tools, write/deploy tools, and secret forwarding.
- Local command execution outside fixture boundaries and vendor CLI execution.
- OPA/Cedar runtime, dynamic policy execution, remote policy loading, signed bundle verification, rollout/rollback, and break-glass execution.
- External observability exporters, alert delivery, audit export, and retention deletion jobs.

## Staging Required Controls

- No secrets, tokens, env values, DB URLs, private keys, webhook secrets, raw prompts, raw payloads, or credential-cache paths in API, health, dashboard, audit, docs examples, or test output.
- Read-only staging readiness APIs.
- Explicit env gate matrix with allowed/required/forbidden staging posture.
- Mock actor warning and env fallback warning visible.
- Remote merge, real MCP transport, and vendor CLI execution explicitly forbidden.
- Production-ready flags remain false.

## Staging Readiness Model

Staging Deployment Profile v0 will add read-only models for:

- `StagingDeploymentProfile`
- `StagingIntegrationGate`
- `StagingReadinessCheck`
- `StagingPromotionCriterion`
- `StagingRollbackCriterion`
- `StagingDeploymentSummary`

These models are deterministic seed/read models in `packages/deployment-readiness`.

## Dashboard / API Plan

Add read-only endpoints:

- `GET /readiness/staging/profile`
- `GET /readiness/staging/gates`
- `GET /readiness/staging/checks`
- `GET /readiness/staging/promotion-criteria`
- `GET /readiness/staging/rollback-criteria`
- `GET /readiness/staging/summary`

Add `/dashboard/staging` and a dashboard Staging Deployment Profile panel showing status, gates, checks, promotion criteria, rollback criteria, blockers, warnings, mock actor warning, env fallback warning, and no-secret/no-env status.

Update `/health` with safe staging metadata only: status, current profile, required component count, blocker count, production-ready false, and no secrets/env values.

## What This Task Implements

- Staging-specific planning docs and profile contract.
- Staging environment gate matrix reference.
- Staging integration-test policy and risk register docs.
- Read-only staging readiness models, service methods, DTOs, API endpoints, health metadata, and dashboard read model.
- Deterministic tests for models, APIs, dashboard, health, forbidden staging gates, warnings, and no-secret/no-env exposure.
- Updates to roadmaps, inventories, dashboard docs, phase audit, README, docs README, and AGENTS.

## Out Of Scope

- Any deployment, infrastructure code, cloud/Kubernetes/Temporal/artifact registry integration, or production traffic.
- Live provider checks or calls.
- Real production Auth/RBAC.
- Real secret backend integration or secret migration.
- Remote Git operations in tests unless explicitly gated by existing integration profiles.
- Real LLM or MCP provider calls.
- OPA/Cedar runtime or dynamic policy execution.
- External observability/export/alerting.
- Destructive operations, retention deletion, branch deletion, force push, rebase push, or auto-merge.

## Validation Strategy

- Run deterministic staging tests plus existing regression tests.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `git diff --check`.
- Skip optional Postgres, remote Git, LLM Gateway integration-test, remote MCP, and external auth tests unless their explicit env gates are configured.
- Run the safe integration scan and classify findings.
