# Staging Profile Contract v0

Status: v0_implemented
Scope: non-production readiness contract

## Contract

Staging is a non-production, isolated validation profile. It may validate control-plane readiness, sanitized read models, migration visibility, and explicitly gated integration-test behavior. It must not carry production traffic or production credentials.

## Before Using Staging

The following must be true:

- API, web, worker, migration job boundary, and future background job boundary are represented.
- Dashboard uses API-backed read models.
- Postgres readiness is visible without exposing database URL values.
- Mock actor and env fallback warnings are visible.
- No raw secrets, tokens, DB URL values, credential-cache paths, raw webhook payloads, or raw prompts/outputs are exposed.
- Remote merge, rebase push, force push, branch deletion, remote MCP, and vendor CLI execution remain disabled.

## Must Remain Disabled

- Production auth and real IdP flows.
- Real secret backend calls.
- Production GitHub App rollout and live token exchange by default.
- Remote MCP transport.
- Vendor CLI execution.
- External observability export and alert delivery.
- Retention deletion jobs.
- Kubernetes, Terraform, Pulumi, Helm, or cloud deployment code.

## Allowed Integration Tests

Only tests with explicit gates may run:

- Optional Postgres contract tests with `AICHESTRA_TEST_DATABASE_URL`.
- Remote Git/GitHub App tests only under dedicated integration gates and non-production repos.
- Remote LLM tests only under LLM Gateway integration-test profile v1 gates, model allowlists/default model, budget cap, safe prompt class, SecretRef-preferred credential gate, Auth/RBAC, and Policy.

All such tests must be skipped by default.

## Promotion Criteria

Promotion from local/integration to staging requires:

- Lint, typecheck, tests, build, and diff checks pass.
- Postgres profile is configured for non-production validation.
- DB migrations are visible and not auto-run.
- Secret backend risk is accepted or a real backend exists in a future task.
- Mock actor warning remains visible until production Auth/RBAC exists.
- Destructive operations remain forbidden.
- Dashboard/API no-secret checks pass.

## Rollback Criteria

Rollback from staging is required on:

- Secret, token, DB URL value, webhook secret, private key, credential-cache path, raw payload, or raw prompt/output exposure.
- External calls outside explicit gates.
- Destructive Git operations becoming enabled.
- DB schema drift or migration-readiness failure.
- Policy/Auth/RBAC/SecretRef/sandbox bypass.

## Risk Acceptance

Any staging use before real Auth/RBAC and real secret backend implementation must be treated as non-production validation only. Risk acceptance must be documented and must not be reused as production approval.

## Owner Responsibilities

Platform owns staging gates and CI validation. Security owns no-secret/no-token checks, Auth/RBAC blockers, and secret backend blockers. Integrations own GitHub/LLM/MCP gate behavior. Operations owns DB readiness, backup/restore evidence, and rollback drills.

## Difference From Integration And Production

Integration can remain local/mock-heavy with optional provider tests. Staging expects more production-like topology and Postgres readiness, but still blocks production auth, real secret backend, remote MCP, destructive Git, and production traffic. Production requires real operations, auth, secrets, policy governance, audit/export, and deployment controls not implemented here.
