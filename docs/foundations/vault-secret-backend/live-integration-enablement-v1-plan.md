# Vault Live Integration Enablement v1 Plan

Status: implementation_started.

This plan follows the current docs organization in `docs/README.md`. Vault-backed Secret Backend v1 is a foundational security boundary under `docs/foundations/vault-secret-backend/`, and Vault Integration-Test Profile v1 remains the operational readiness profile under `docs/roadmaps/vault-integration-test-profile/`. This task adds a clearer live enablement/readiness layer without changing those ownership boundaries.

## Current Vault-backed Secret Backend v1 Behavior

Vault-backed Secret Backend v1 implements `provider: vault` as a gated, non-default SecretRef provider boundary in `packages/security`. Default runtime and default tests use disabled or mock clients. The isolated `GatedHttpVaultClient` is available only behind explicit Vault gates and the Vault client interface.

Vault v1 validates SecretRef metadata, selected backend/provider gates, KV v2 mount/path/key metadata, Auth/RBAC and Policy-as-code checks, and path allowlists before a backend read. Public API, health, dashboard, readiness, and audit surfaces expose booleans, counts, statuses, ids, and sanitized metadata only. They must not expose Vault token values, Vault address values, env values, secret values, private keys, webhook secrets, provider API keys, or credential cache paths.

Production Vault rollout remains false. v1 does not implement Vault HA, unseal, storage backend operations, Vault Agent, Vault CSI, sidecars, Terraform, Helm, Kubernetes, AppRole production auth, cloud identity, BYOK, rotation, secret migration, or production credential issuance.

## Current Vault Integration-Test Profile v1 Behavior

Vault Integration-Test Profile v1 lives in `packages/deployment-readiness` as read-only readiness metadata. It exposes:

- profile, test-case, safety-check, and summary read models;
- `/readiness/vault-integration/*` endpoints;
- `/dashboard/vault-integration`;
- safe `/health.vaultIntegrationTests` metadata;
- deterministic tests and a skipped-by-default live skeleton.

Missing gates skip live tests. Unsafe gates block readiness. Default runtime and default tests do not call Vault.

## Current Env Gates

Current required gates are:

- `AICHESTRA_VAULT_INTEGRATION_TESTS=true`
- `AICHESTRA_SECRET_BACKEND_PROVIDER=vault`
- `AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true`
- `AICHESTRA_VAULT_ADDR`
- `AICHESTRA_VAULT_AUTH_METHOD=token`
- `AICHESTRA_VAULT_TOKEN`
- `AICHESTRA_VAULT_KV_MOUNT`
- `AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES`
- `AICHESTRA_TEST_VAULT_SECRET_PATH`
- `AICHESTRA_TEST_VAULT_SECRET_KEY`

Optional gates are:

- `AICHESTRA_VAULT_NAMESPACE`
- `AICHESTRA_VAULT_REQUEST_TIMEOUT_MS`

Public surfaces must expose only configured booleans/counts/status, never raw env values.

## Current Live Test Skeletons

The existing skeletons cover:

- skipped-by-default readiness in `tests/vault-integration-test-profile-v1.test.ts`;
- gated backend read skeleton in `tests/vault-secret-backend-v1.test.ts`;
- one exact KV v2 test path/key when all gates pass;
- status/metadata assertions only;
- no write, delete, rotate, broad list, secret output, env output, or token output.

## Proposed Live Enablement Checklist

Vault Live Integration Enablement v1 adds an operator-facing checklist over the existing profile:

1. Confirm live tests are explicitly enabled.
2. Confirm Vault is selected as the SecretRef backend and provider.
3. Confirm Vault address and token are configured without exposing values.
4. Confirm token auth is the only supported v1 live auth method.
5. Confirm KV mount, path allowlist, test path, and test key are configured.
6. Confirm the test path is allowlisted by exact prefix or child path.
7. Confirm the test path contains a test/dev/sandbox marker.
8. Confirm the test path does not look production-like.
9. Confirm the test key is a non-sensitive marker where possible.
10. Confirm write/delete/rotate/broad-list behavior is disabled.
11. Confirm no secret/env/token/path/key value is exposed in readiness, health, dashboard, tests, or audit.
12. Confirm production Vault rollout remains false.

## Test-only Path Strategy

`AICHESTRA_TEST_VAULT_SECRET_PATH` must be under `AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES` and must include a non-production marker such as `test`, `tests`, `dev`, `development`, `integration`, `sandbox`, `nonprod`, `non-production`, or `ci`.

The path must not include production-like markers such as `prod`, `production`, `customer`, `tenant`, `live`, `real`, `payment`, `billing`, `private`, or `root`. Public read models may expose booleans like `testPathAllowlisted` and `testPathLooksSafe`; they must not return the raw path.

## No-write / No-delete / No-rotate Policy

The live enablement path remains read-only. It may validate config, validate SecretRef metadata, check a path allowlist, and permit one explicitly gated KV v2 read status check in the existing live skeleton. It must not write, delete, rotate, migrate, broadly list, or clean up Vault secrets.

If any write/delete/rotate/broad-list env flag is configured, readiness must become `blocked_unsafe` and `canRunLiveValidation()` must return false.

## Audit and Redaction Strategy

Readiness output may include:

- gate names and counts;
- configured booleans;
- missing gate names;
- unsafe gate identifiers;
- test path configured/allowlisted/safe booleans;
- operation-policy booleans;
- no-secret/no-env/no-token booleans.

Readiness output must not include:

- Vault token values;
- Vault address values;
- Vault namespace values;
- raw test path values;
- raw test key values;
- secret values;
- env values;
- credential cache paths;
- raw Vault errors;
- broad path listings.

## Safety Constraints

- Do not enable Vault by default.
- Do not call Vault in default runtime/tests.
- Do not read, write, delete, rotate, migrate, list broadly, or expose secrets.
- Do not run vendor CLIs or remote Git operations.
- Do not call GitHub, OpenAI, Anthropic, Gemini, Bedrock, LiteLLM, MCP, Kubernetes, Temporal, OPA, Cedar, artifact registries, cloud services, or external auth systems.
- Keep production Vault readiness false.
- Keep Auth/RBAC, Policy, SecretRef, Vault, Dashboard, Observability, Tenant Scope, and Secrets/Sandbox gates authoritative.

## What This Task Implements

- `VaultLiveIntegrationReadiness`, `VaultLiveValidationCheck`, and `VaultLiveValidationRunRecord` metadata models.
- A `VaultLiveIntegrationReadinessService` surface on the existing deployment-readiness service.
- Stronger gate validation for test-only path, allowlist, production-looking path, non-sensitive key marker, and forbidden operation flags.
- Read-only `/readiness/secrets/vault/live-*` endpoints.
- Dashboard/readiness status for the live enablement checklist.
- Skipped-by-default live validation skeleton coverage if missing.
- Safe live validation runbook metadata.
- Documentation and phase checklist updates.
- Tests for skipped default behavior, safe configured readiness, unsafe path blocking, outside-allowlist blocking, no write/delete/rotate/list, API/dashboard safety, no token/env/secret exposure, and skipped live skeleton behavior.

## Out of Scope

- Production Vault rollout.
- Vault HA, unseal, storage backend, Vault Agent, Vault CSI, sidecar, Terraform, Helm, Kubernetes, cloud infrastructure, or operational bootstrap.
- AppRole/Kubernetes production auth flow.
- BYOK, secret migration, rotation jobs, production credential issuance, production credential validation, or credential cache reads.
- Any default-runtime Vault call.
- Any write/delete/rotate/broad-list Vault operation.
- Any external provider, GitHub, LLM, MCP, Kubernetes, Temporal, OPA, Cedar, artifact registry, cloud, or external auth call.
