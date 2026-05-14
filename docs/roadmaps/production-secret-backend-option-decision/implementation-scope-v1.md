# Secret Backend Implementation Scope v1

Status: `v1_implemented`

Selected backend: Vault.

Target provider value: `vault`.

Implementation note: Vault-backed Secret Backend v1 is implemented as a gated, non-default backend boundary in `packages/security`. It adds a concrete `vault` SecretRef provider, disabled/mock/gated HTTP Vault clients, safe API/health/dashboard metadata, and deterministic tests. Vault Integration-Test Profile v1 adds the first-class skipped-by-default readiness profile for optional live KV v2 smoke validation. Neither milestone implements production Vault rollout or marks secrets production-ready.

## Package And Module Boundaries

- `packages/security`: owns `VaultSecretProvider`, Vault config parsing, `DisabledVaultClient`, `MockVaultClient`, `GatedHttpVaultClient`, credential resolution integration, audit, redaction, and DTO safety.
- `packages/deployment-readiness`: owns read-only readiness/decision metadata updates only.
- `apps/api`: exposes health/API read models and SecretRef configuration status only.
- `apps/web`: displays dashboard read models only.
- Provider consumers such as Git, webhook, LLM, MCP, Local Agent, and runner must continue to use `SecurityControlService` and must not instantiate Vault clients directly.

## Provider Class Or Interface To Add

Add a Vault-backed provider behind the existing security service boundary. The preferred v1 shape is:

- `SecretValueProvider` or equivalent narrow internal interface;
- `VaultSecretProvider` using an injected client abstraction;
- `MockVaultClient` for deterministic tests;
- optional live Vault client only behind explicit integration-test gates.

## Config Variables To Add

Names are planned and must expose status only, never values:

- `AICHESTRA_SECRET_BACKEND_PROVIDER=vault`
- `AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true`
- `AICHESTRA_VAULT_ADDR`
- `AICHESTRA_VAULT_NAMESPACE`
- `AICHESTRA_VAULT_AUTH_METHOD`
- `AICHESTRA_VAULT_KV_MOUNT`
- `AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES`
- `AICHESTRA_VAULT_REQUEST_TIMEOUT_MS`
- `AICHESTRA_VAULT_INTEGRATION_TESTS=false`
- `AICHESTRA_VAULT_TOKEN` for gated integration-test token auth only
- `AICHESTRA_VAULT_TOKEN_SECRET_REF` future
- `AICHESTRA_SECRET_BACKEND_INTEGRATION_TESTS=false`
- `AICHESTRA_SECRET_BACKEND_TEST_NAMESPACE`
- `AICHESTRA_SECRET_BACKEND_TEST_SECRET_REF`

Raw Vault token config is not a production path in v1. It is used only by the gated optional live test/client boundary and must never appear in API, health, dashboard, audit, tests, errors, or docs as a value.

## SecretRef Fields

Prefer reusing metadata safely before schema expansion:

- `provider: vault`;
- `metadata.vaultMount`;
- `metadata.vaultPath`;
- `metadata.vaultKey`;
- optional `metadata.vaultVersion`;
- optional `metadata.vaultNamespace`;
- optional `metadata.dataShape`;
- status `active`, `disabled`, or `revoked`.

Do not store raw values.

## CredentialManager Changes

- Resolve active SecretRefs through Vault provider only after Auth/RBAC and Policy allow.
- Fail closed for missing, disabled, revoked, policy-denied, auth-denied, or backend-unavailable refs.
- Return transient values only to internal adapter boundaries.
- Public DTOs return handles/status only.
- Enforce Vault path allowlists before any Vault client read.

## TokenResolver Changes

- Keep token handles metadata-only.
- GitHub App private-key signing remains future unless explicitly included in a later task.
- LLM and Git tokens remain transient internal values only.

## Auth/RBAC Checks

- Required before backend read.
- Service account and actor context must be present for non-local profiles.
- Mock actor remains non-production.

## Policy Checks

Must preserve:

- `provider.credential.resolve`
- `git.credential.resolve`
- `llm.credential.resolve`
- `secret.lease.request`
- `secret.lease.issue`
- `secret.read` denied by default
- credential cache read denied
- Local Agent secret forwarding denied

## Audit Events

Implemented metadata-only events include:

- `vault_secret_provider_selected`;
- `vault_config_validated`;
- `vault_config_missing`;
- `vault_path_allowlist_checked`;
- `vault_path_not_allowlisted`;
- `vault_secret_resolution_requested`;
- `vault_secret_resolution_auth_denied`;
- `vault_secret_resolution_policy_denied`;
- `vault_secret_resolution_allowed`;
- `vault_secret_resolution_missing`;
- `vault_secret_resolution_forbidden`;
- `vault_secret_resolution_unavailable`;
- `vault_secret_value_redacted`;
- `vault_integration_test_skipped`;
- `vault_integration_test_ready`.

No event may contain secret values, env values, tokens, private keys, webhook secrets, provider keys, backend credentials, or credential cache paths.

## Redaction Requirements

Reuse and extend existing redaction for:

- API keys;
- GitHub tokens;
- bearer tokens;
- webhook secrets;
- private keys;
- DB URLs;
- session/JWT secrets;
- Vault token-looking strings;
- AWS/GCP/Azure secret-looking strings;
- credential cache paths.

## Health Changes

Expose:

- selected backend kind;
- configured booleans;
- backend available status if checked through mock/client abstraction;
- env fallback production allowed false;
- no-secret/no-env status.

Do not expose backend URL values if deployment policy treats them as sensitive.

## Dashboard Changes

Show:

- selected backend;
- SecretRef migration status;
- missing config booleans;
- risk summary;
- env fallback warning;
- no-secret/no-env status.

No raw values, backend credentials, env values, raw paths considered sensitive, or tokens.

## Tests

- Provider config validation.
- Mock Vault client contract.
- Auth denied before backend call.
- Policy denied before backend call.
- Missing/disabled/revoked SecretRef fail closed.
- API/dashboard/health no-secret/no-env.
- Secret-like backend error messages are redacted.
- Optional live tests skipped unless all gates are set.

## Dependency Decision

v1 uses the platform `fetch` boundary in an isolated `GatedHttpVaultClient` instead of adding a new dependency. Default runtime and tests construct disabled or mock clients unless explicit Vault gates are configured.

## Out Of Scope

- Real production rollout.
- Automatic secret migration.
- Scheduled rotation jobs.
- BYOK.
- OAuth/device-code/WIF/IAM.
- Local CLI credential reads.
- Credential cache reads.
- Local Agent secret forwarding.
- Production credential issuance.
- GitHub App live private-key signing unless explicitly added by a later task.

## Remaining Limitations

- CredentialManager integration is deterministic through `MockVaultClient`; optional live Vault coverage validates the explicit async `VaultSecretProvider.resolveSecretAsync` provider boundary because the current CredentialManager path remains synchronous.
- Production Vault service identity, AppRole/workload identity, HA, unseal, audit-device ownership, rotation, migration, and break-glass are still future work.
