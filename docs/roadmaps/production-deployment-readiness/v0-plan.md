# Production Deployment Readiness Planning v0 Plan

## Chosen Docs Path

`docs/README.md` defines `docs/roadmaps/` as the location for integration roadmaps and phase plans. Production deployment readiness is cross-cutting across API, web, worker, storage, auth, policy, security, Git, LLM, MCP, runner, and dashboard, so the canonical path for this milestone is:

```text
docs/roadmaps/production-deployment-readiness/
```

No critical validation blockers were found. This plan proceeds with planning documents, read-only readiness models, seeded readiness checks, read-only API endpoints, and dashboard read-model visibility. It does not implement production deployment.

## Current System Status

- Phase 1: `complete_for_current_milestone`
- Phase 2: `complete_for_current_milestone`
- Phase 3: `v3_implemented`
- Phase 4: `v1_implemented`
- Phase 5: `planned_only`
- Persistent DB: `v1_implemented`
- Real Git Adapter: `v2_implemented`
- LLM Gateway: `v2_implemented`
- MCP Gateway: `v0_implemented`
- Dashboard API-backed Read Model: `v0_implemented`
- Local Agent Runner: `v1_implemented`
- Policy-as-code: `v0_implemented`
- Enterprise Provider Abstraction: `v0_implemented`
- Secrets/Sandbox: `v0_implemented`
- Local Agent Protocol: `v1_implemented`
- Production Auth/RBAC Planning: `v0_implemented`
- SecretRef-backed Provider Credentials: `v1_implemented`

The repository is broad and useful for controlled local/integration work, but it is not production-ready.

## Current Production Blockers

- No production auth provider, request authentication middleware, session model, or IdP integration.
- No real secret backend; SecretRef-backed credentials currently use metadata plus explicit env lookup.
- In-memory runtime remains the default and many production-relevant repositories remain in-memory.
- Postgres exists as opt-in v1 storage but lacks production migration governance, pooling, backups, restore tests, and full repository coverage.
- Policy rules are static TypeScript defaults, not signed/versioned/reviewed bundles.
- No observability stack, audit export, retention automation, alerting, SLOs, or tracing backend.
- No tenant/org isolation across repositories, policy subjects, dashboard read models, and API filters.
- Real Git, LLM, and MCP capabilities remain gated or mock-first and should not be promoted without profile validation.

## Runtime Components Inventory

This task creates `docs/reference/runtime-component-inventory.md` and a read-only deployment readiness model covering:

- `apps/api`
- `apps/web`
- worker/task orchestration path
- Postgres and migration runner
- Git adapter and webhook boundary
- LLM Gateway
- MCP Gateway
- Local Agent Protocol service
- Local Agent Runner
- Registry, Policy, Auth/RBAC, SecretRef, Secrets/Sandbox
- Dashboard read-model composer
- future Local Agent daemon, queue, observability collector, and deployment jobs

## Deployment Topology Options

This task documents four profiles:

- local/dev: in-memory, mock providers, no external calls, demo/API dashboard.
- integration: optional Postgres, gated GitHub/OpenAI-compatible tests, mock auth, no production traffic.
- staging: Postgres and migrations required, real auth/secret backend planned, audit retention configured, no auto-merge.
- production: Postgres, production auth, real secret backend, policy bundle governance, observability, audit retention, backup/restore, rate limits, tenancy, and mock actor rejection required.

## Environment Profile Strategy

The new read-only model defines `DeploymentProfile` records for `local`, `integration`, `staging`, and `production`. The model is planning data only. It does not enforce profile boot behavior yet.

Future production work should add a startup validator that rejects unsafe combinations such as:

- production profile with mock auth;
- production profile with in-memory storage;
- production profile with legacy env credentials;
- production profile with real transport but no allowlists;
- production profile with no audit retention or backup plan.

## Database Readiness Gaps

- Postgres runtime remains opt-in.
- Some repository families remain in-memory.
- No production migration release process exists.
- No connection pooling, backup, restore test, partitioning, retention, or index review workflow exists.

## Secret Backend Readiness Gaps

- EnvSecretProvider is local/integration-only.
- No Vault, AWS Secrets Manager, GCP Secret Manager, or Azure Key Vault integration exists.
- No production rotation workflow, lease TTL policy enforcement, break-glass handling, or secret backend audit export exists.

## Auth/RBAC Readiness Gaps

- MockAuthProvider remains the default.
- Future OIDC/SAML/SCIM providers are disabled placeholders.
- Header actor override is mock-only.
- No production sessions, token validation, service account credential issuance, tenant scoping, or IdP group sync exists.

## Policy-as-code Readiness Gaps

- Policy is static TypeScript rules.
- No OPA/Rego, Cedar, signed JSON/YAML bundles, bundle promotion, rollback, external policy service, or policy admin workflow exists.
- Policy audit is in-memory unless future persistence is added.

## Observability Readiness Gaps

- No structured log schema, metric names, trace spans, correlation propagation standard, dashboard, or alerting backend is implemented.
- Existing audit/read models are useful for local inspection but not production operations.

## Audit Retention Gaps

- Audit events exist across Git, LLM, policy, auth, security, MCP, Local Agent, registry, and governance.
- Production retention classes, exports, partitioning, legal hold, data residency, and deletion workflows are not implemented.

## Backup/Restore Gaps

- No backup schedule, restore drill, RPO/RTO, migration rollback, or disaster recovery process exists.

## Tenant Isolation Gaps

- Tenant/org scope is modeled indirectly through auth/team/policy metadata but not enforced across repositories, DTO filters, dashboard read models, or audit queries.

## CI/CD Readiness Gaps

- Validation commands exist locally.
- No production release pipeline, artifact build, container provenance, environment promotion, deployment gate, migration gate, rollback automation, or required secret/dependency scanning profile exists.

## What This Task Implements

- `docs/roadmaps/production-deployment-readiness/*` planning documents.
- `docs/reference/runtime-component-inventory.md`.
- `docs/reference/environment-gate-matrix.md`.
- `@aichestra/deployment-readiness` read-only seed models.
- Read-only API endpoints under `/readiness/deployment/*`.
- Dashboard read model section `/dashboard/readiness`.
- Deterministic tests for profiles, checks, risks, API, dashboard, and no-secret exposure.

## Out Of Scope

- No production deployment.
- No Kubernetes, Helm, Terraform, Pulumi, or cloud infra code.
- No real secret backend.
- No real OIDC/SAML/SCIM/SSO/session/password login.
- No real MCP transport.
- No real Git/LLM/auth/vendor CLI calls.
- No production traffic enablement.
- No weakening of existing safety gates.
