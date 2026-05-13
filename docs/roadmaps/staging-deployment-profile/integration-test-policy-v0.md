# Staging Integration Test Policy v0

Staging CI/CD Pipeline Planning v0 is the canonical CI-facing surface for this policy. See `docs/roadmaps/staging-ci-cd-pipeline/integration-test-gates-v0.md` for job-level gates and `docs/roadmaps/staging-ci-cd-pipeline/job-matrix-v0.md` for baseline and optional CI jobs.

Status: v0_implemented
Scope: optional gated tests; skipped by default

## General Rule

Default tests must not call external services. Any remote test requires explicit environment gates, non-production credentials, scoped allowlists, and no-secret assertions.

## Optional Postgres Tests

Allowed in staging when `AICHESTRA_TEST_DATABASE_URL` is configured for a non-production database. Tests must not expose the URL value and must not run migrations automatically unless the test explicitly invokes a migration fixture.

## Remote Git Tests

Allowed only under Real Git Adapter gates and non-production repositories:

- Remote Git enabled.
- Operation-specific branch/PR gates enabled.
- Repo allowlist and branch prefix configured.
- SecretRef-backed credential preferred.
- Auth/RBAC and Policy allow decisions present.

Remote merge, rebase push, force push, and branch deletion are forbidden.

## GitHub App Tests

Mock GitHub App token-handle tests are allowed. GitHub App integration-test profile v1 is the dedicated skipped-by-default readiness profile for future live branch/PR/changed-file and webhook fixture validation. Live installation-token exchange may run only when every explicit gate and allowlist is configured, and private key values must never be in env vars, DTOs, health, dashboard, audit, or fixtures.

## Webhook Tests

Webhook tests must use signed fixture payloads and no raw payload storage. Production webhook endpoints are not deployed. Webhooks must update read models only and must not trigger agent execution.

## Remote LLM Tests

Remote LLM tests are skipped unless every LLM Gateway integration-test profile v1 gate is configured. Tests require `openai_compatible` provider mode, remote LLM/completion gates, base URL configured status, SecretRef-backed credentials preferred, model allowlists/default model, budget cap, safe prompt class, fallback disabled, Auth/RBAC, and Policy. No BYOK/OAuth/WIF/IAM, streaming, tool calls, vendor CLI providers, credential cache reads, raw provider response storage, API-key exposure, or env-value exposure is allowed.

## MCP Tests

Real MCP transport tests are blocked in staging v0. Mock MCP Gateway tests remain allowed. High/critical tools, write/deploy tools, secret forwarding, and network access remain denied.

## External Auth Tests

Real OIDC/SAML/SCIM/SSO tests are blocked in v0 because production auth is planning-only.

## Vendor CLI Tests

Vendor CLI execution is forbidden. Tests must not read `~/.codex/auth.json`, `~/.claude`, Google credential caches, OS keychains, or vendor session files.

## Cleanup Expectations

Any future live integration profile must use disposable non-production data, deterministic cleanup, audit evidence, and rollback criteria. v0 does not implement cleanup workers or deployment jobs.
