# Vault-backed Secret Backend v1 Plan

Status: implementation_started.

This plan follows the current docs organization in `docs/README.md`. Vault is a foundational security capability because it extends the existing `SecretRef` and credential boundary in `packages/security`, so the canonical implementation docs live under `docs/foundations/vault-secret-backend/`.

## Current SecretRef-backed Provider Credentials v1 Behavior

SecretRef-backed Provider Credentials v1 provides metadata-only `SecretRef` records, explicit `EnvSecretProvider` resolution, `CredentialManager` status/handle objects, metadata-only `SecretLease` records, Auth/RBAC checks, Policy-as-code checks, sanitized audit events, and DTO redaction. Public APIs and dashboard read models return handles, statuses, booleans, and counts only. `resolveCredentialForInternalUse` is the only path that may carry a transient value to an adapter boundary.

## Current EnvSecretProvider Behavior

`EnvSecretProvider` is disabled by default and only reads one requested env key when `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true` and the key is allowlisted by `AICHESTRA_ALLOWED_SECRET_ENV_KEYS`. It does not enumerate env vars and it is not production-sufficient. Legacy direct env fallback remains a controlled compatibility path when no `*_SECRET_REF` is configured.

## Current Secret Backend Migration Planning v0 Behavior

Secret Backend Migration Planning v0 is read-only planning metadata. It compares Vault, cloud secret managers, custom backends, env fallback, and mock providers; models credential-kind migration, lease/rotation expectations, and env fallback deprecation; and exposes readiness API/dashboard/health data without contacting any backend, reading secrets, rotating credentials, or marking production secret management ready.

## Production Secret Backend Option Decision v0 Result

Production Secret Backend Implementation Option Decision v0 selected Vault as the first backend to implement and AWS Secrets Manager as the second choice for AWS-first deployments. The decision chose Vault because the target cloud is not selected, Vault best exercises SecretRef lease/version/rotation semantics, and Vault is compatible with self-hosted and enterprise-controlled deployments. That decision was planning-only and did not implement Vault.

## Vault Provider Design

Vault-backed Secret Backend v1 will add:

- `provider: vault` as the concrete runtime SecretRef provider value.
- A Vault config parser that is disabled by default.
- A `VaultClient` boundary with disabled, mock, and gated HTTP implementations.
- A `VaultSecretProvider` that validates Vault SecretRef metadata and calls `VaultClient` only after SecretRef status, Auth/RBAC, Policy, lease policy, and path allowlist checks pass.
- Metadata-only health/readiness/dashboard/API status.

`vault_future` remains a planning placeholder for docs and old readiness records.

## Vault KV v2 Path Mapping

Vault SecretRefs use metadata:

- `vaultMount`
- `vaultPath`
- `vaultKey`
- `vaultVersion`, optional
- `vaultNamespace`, optional
- `dataShape: single_key | full_object`

For KV v2, the gated HTTP client reads `/{mount}/data/{path}` and uses `?version=` when a version is configured. `vaultPath` and `vaultKey` are references, not values. Public DTOs may show configured booleans and sanitized metadata, but never return Vault values or tokens.

## Vault Auth Strategy for v1

Token auth is the only concrete v1 live-client auth mode, and it is gated for explicit Vault usage or optional live tests:

- `AICHESTRA_SECRET_BACKEND_PROVIDER=vault`
- `AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true`
- `AICHESTRA_VAULT_ADDR`
- `AICHESTRA_VAULT_AUTH_METHOD=token`
- `AICHESTRA_VAULT_TOKEN`

AppRole is documented as `approle_future` only. v1 does not implement OAuth, device-code, WIF, IAM, Vault Agent, Vault CSI, Vault sidecars, production rollout, HA, unseal, bootstrap, or cloud identity exchange.

## CredentialManager and TokenResolver Integration

The existing credential sequence remains authoritative:

1. Look up active SecretRef metadata.
2. Reject disabled, revoked, missing, invalid, or unsafe metadata.
3. Check Auth/RBAC when available.
4. Check purpose policy such as `git.credential.resolve` or `llm.credential.resolve`.
5. Check `provider.credential.resolve`.
6. Check `secret.lease.request` and `secret.lease.issue`.
7. Check Vault provider gates and allowed path prefixes.
8. Read Vault through `VaultClient` only after every gate passes.
9. Return a metadata-only `CredentialHandle` and `SecretLease`; keep any value internal/transient.

Git and LLM TokenResolver paths continue to receive only transient values through the existing credential resolver callback. Runner secret injection and Local Agent secret forwarding remain denied.

## Auth/RBAC and Policy Integration

Auth/RBAC denial blocks before any Vault client read. Policy denial blocks before any Vault client read. New static policy rules will allow Vault-backed provider credential resolution only when the Vault provider is selected, enabled, address/auth config is present, the SecretRef is active, the path allowlist passes, no credential cache access is allowed, and no credential material is stored.

`secret.read`, `runner.secret.inject`, and `local_agent.secret.forward` remain denied.

## SecretLease Behavior

Vault v1 issues metadata-only `SecretLease` records for successful credential resolution, using the SecretScope max TTL capped by the current credential manager behavior. Vault does not store secret material in the lease. Backend-native dynamic secret leases, renewal, revocation jobs, and rotation workflows remain future work.

## Audit and Redaction Requirements

Vault v1 will add metadata-only audit events for provider selection, config validation, allowlist checks, resolution requested/allowed/denied/missing/forbidden/unavailable, value redaction, and optional integration-test readiness. Audit metadata must include actor/principal/purpose/SecretRef/policy identifiers where available and must never include Vault tokens, Vault values, GitHub tokens, webhook secrets, LLM API keys, GitHub App private keys, env values, or credential cache paths.

Redaction must cover Vault token-like env dumps in API/dashboard/health/audit/test surfaces.

## Health, Dashboard, and API Changes

Safe runtime surfaces will expose only:

- selected secret backend provider;
- Vault provider enabled/disabled;
- Vault address configured boolean;
- Vault namespace configured boolean;
- Vault auth method;
- allowed path prefix count;
- integration-test gate status;
- client kind/status;
- production backend implemented false;
- env fallback production allowed false.

No address value, token, secret value, env value, raw private key, API key, or broad Vault path listing will be returned.

## Optional Live Test Strategy

Default tests use `DisabledVaultClient` and `MockVaultClient` only. Optional live tests are skipped unless all explicit Vault test gates are configured:

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

Live tests must read a non-production allowlisted test path only, verify status/metadata only, and never print the secret.

## What This Task Implements

- Concrete `vault` SecretRef provider support behind explicit gates.
- Vault config parsing and safe config/status DTOs.
- Disabled, mock, and gated HTTP Vault client boundary.
- Vault SecretRef validation, path allowlist enforcement, mock resolution, and redacted audit.
- CredentialManager integration for GitHub token, webhook secret, GitHub App private-key metadata, LLM API key, and provider API-key SecretRefs.
- Safe health/API/dashboard metadata.
- Deterministic tests and skipped-by-default live test skeleton.
- Docs updates without production-ready claims.

## Out of Scope

- Production Vault rollout, HA, unseal, storage backend, bootstrap, Vault Agent, Vault CSI, sidecars, Terraform, Helm, Kubernetes, or cloud infra.
- Production rotation jobs, destructive migration, BYOK, OAuth, device-code, WIF, IAM, cloud identity exchange, AppRole implementation, service-account issuance, or credential-cache reads.
- AWS/GCP/Azure/custom secret backends.
- Making Vault the default runtime backend.
- Running live Vault tests in default validation.
