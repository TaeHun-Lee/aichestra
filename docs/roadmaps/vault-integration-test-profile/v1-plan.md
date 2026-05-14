# Vault Integration-Test Profile v1 Plan

Status: v1_implemented.

This plan follows the current docs organization in `docs/README.md`. Vault-backed Secret Backend v1 is a foundation document under `docs/foundations/vault-secret-backend/`; this integration-test profile is an operational readiness roadmap under `docs/roadmaps/vault-integration-test-profile/`, matching the GitHub App and LLM integration-test profile layout.

## Current Vault-backed Secret Backend v1 Behavior

Vault-backed Secret Backend v1 implements `provider: vault` as a gated, non-default SecretRef provider boundary. Default runtime and default tests use `DisabledVaultClient` or deterministic `MockVaultClient`; the isolated `GatedHttpVaultClient` is constructed only when every explicit Vault gate is configured. Vault v1 exposes metadata-only config, health, readiness, resolve-check, audit, and dashboard data.

Vault v1 does not make Vault the default backend, does not deploy Vault, does not implement production Vault HA/unseal/storage/bootstrap, and does not mark secrets production-ready.

## Current Vault Config Gates

Live Vault usage is gated by:

- `AICHESTRA_SECRET_BACKEND_PROVIDER=vault`
- `AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true`
- `AICHESTRA_VAULT_ADDR`
- `AICHESTRA_VAULT_AUTH_METHOD=token`
- `AICHESTRA_VAULT_TOKEN`
- `AICHESTRA_VAULT_KV_MOUNT`
- `AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES`

`AICHESTRA_VAULT_NAMESPACE` and `AICHESTRA_VAULT_REQUEST_TIMEOUT_MS` are optional metadata/config fields. Public surfaces expose booleans, counts, status, and auth method only; they do not expose Vault address values, Vault tokens, env values, or secret values.

## Current Vault Client and Provider Boundary

The existing boundary is:

- `DisabledVaultClient`: default, no backend calls.
- `MockVaultClient`: deterministic tests only.
- `GatedHttpVaultClient`: isolated HTTP boundary for explicit live Vault validation.
- `VaultSecretProvider`: validates SecretRef metadata, status, provider gates, path allowlist, and maps SecretRef metadata to KV v2 read requests.

CredentialManager integration resolves Vault-backed SecretRefs through the existing Auth/RBAC, Policy, lease, and audit flow. Runner secret injection, Local Agent secret forwarding, broad `secret.read`, local CLI credential access, and credential cache reads remain denied.

## Current SecretRef / CredentialManager / TokenResolver Behavior

Vault-backed SecretRefs use metadata only:

- `vaultMount`
- `vaultPath`
- `vaultKey`
- optional `vaultVersion`
- optional `vaultNamespace`
- optional `dataShape`

CredentialManager returns metadata-only `CredentialHandle` and `SecretLease` records. The raw value is transient and internal to the immediate adapter boundary only. TokenResolver-compatible paths must not expose values through DTOs, health, dashboard, audit, tests, or errors.

## Current Auth/RBAC and Policy Behavior

Auth/RBAC denial blocks before a Vault client read. Policy denial blocks before a Vault client read. Static policy allows provider credential resolution only for scoped service/system operations that satisfy the configured provider gates and SecretRef status checks. `secret.read`, runner secret injection, Local Agent secret forwarding, credential cache access, remote Git destructive operations, remote LLM unsafe paths, and MCP secret forwarding remain denied.

## Current No-Secret / No-Env Guarantees

Existing Vault v1 tests cover:

- Vault config status uses booleans/counts only.
- Vault token values are redacted.
- Vault secret values are not returned in public DTOs.
- Env values are not exposed.
- Vault path metadata is not treated as a secret value, but broad path listing is not implemented.
- Audit events are sanitized.
- Default tests do not call Vault.

## Required Live Vault Integration-Test Environment Gates

The profile requires all of:

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

Optional:

- `AICHESTRA_VAULT_NAMESPACE`
- `AICHESTRA_VAULT_REQUEST_TIMEOUT_MS`

Missing required gates skip live tests. Unsafe gates fail readiness.

## Test-only Vault Path Requirements

`AICHESTRA_TEST_VAULT_SECRET_PATH` must be:

- explicitly under one configured `AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES` prefix;
- clearly test-only, for example containing `test`, `tests`, `integration`, `sandbox`, `nonprod`, or `ci`;
- not a production namespace/path;
- read-only for this profile.

The profile must not list broad paths, write values, delete values, rotate values, or mutate Vault state.

## SecretRef Test Pattern

The live test skeleton creates an in-memory test SecretRef shape:

```json
{
  "provider": "vault",
  "secretKind": "provider_api_key",
  "metadata": {
    "vaultMount": "<configured mount>",
    "vaultPath": "<configured test path>",
    "vaultKey": "<configured test key>",
    "dataShape": "single_key"
  }
}
```

The test path/key are references only. The secret value must never be printed, snapshotted, returned, or stored.

## Skipped-by-default Strategy

Default runtime and default tests must not call Vault. Readiness APIs and dashboard panels compute gate status only. The optional live skeleton skips unless `VaultIntegrationTestReadinessService.canRunLiveTests()` returns true. Missing gates are skip reasons, not failures.

## Audit and Redaction Strategy

Readiness output may include:

- gate counts;
- configured booleans;
- missing gate names;
- unsafe gate warning identifiers;
- path allowlist count;
- test path configured and allowlisted booleans;
- safety-check status.

Readiness output must not include Vault token values, Vault address values, namespace values, secret path values, key values, env values, secret values, raw errors, broad path lists, or credential cache paths.

## What This Task Implements

- Vault integration-test profile/readiness models.
- Deterministic seed data and summary logic.
- Read-only `/readiness/vault-integration/*` endpoints.
- Safe `/health` metadata for the profile.
- Dashboard read model and panel for Vault integration-test readiness.
- Skipped-by-default live Vault test skeletons.
- Docs updates across Vault, staging, CI/CD, environment gates, dashboard, README, AGENTS, and phase audit.

## Out of Scope

- Making Vault the default runtime backend.
- Requiring Vault for default tests.
- Calling Vault in default runtime/tests.
- Production Vault rollout, HA, unseal, storage backend, cluster bootstrap, Vault Agent, Vault CSI, sidecars, Kubernetes auth, AppRole production rollout, Terraform, Helm, Kubernetes manifests, or cloud infrastructure.
- Secret rotation jobs.
- Destructive secret migration.
- Vault writes, deletes, rotations, broad path listing, or secret mutation.
- BYOK, OAuth, device-code, WIF, IAM, cloud identity token exchange, or credential cache reads.
- Marking Vault or production secret management as production-ready.
