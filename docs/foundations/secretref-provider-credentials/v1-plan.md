# SecretRef-backed Provider Credentials v1 Plan

## Current Git Credential Handling

Real Git Adapter v1 keeps `MockGitProvider` as the default. GitHub branch, pull request, and changed-file operations can run only when `AICHESTRA_GIT_PROVIDER=github`, remote Git gates, repo allowlist, branch prefix, token presence, and policy checks pass. The current GitHub token path is environment/config based through `AICHESTRA_GITHUB_TOKEN`; tokens are not stored or returned, but the credential is not yet modeled as a `SecretRef`/`SecretLease` resolution flow.

## Current LLM Credential Handling

LLM Gateway v1 keeps `MockLLMProvider` as the default. The only real provider path is OpenAI-compatible chat completion behind explicit gates, model allowlist/default model, budget, and policy checks. The current API key path is environment/config based through `AICHESTRA_LLM_API_KEY`; the key is not returned in health, API, audit, usage, or dashboard data, but the credential is not yet routed through `SecretRef`.

## Current Secrets/Sandbox Models

Secrets/Sandbox v0 in `packages/security` already defines metadata-only `SecretRef`, `SecretScope`, `SecretLease`, `SecretAccessDecision`, security audit events, redaction policies, and `SecurityControlService`. v0 deliberately does not retrieve secret values. Default policies deny `secret.read`, runner secret injection, credential cache access, and Local Agent secret forwarding.

## Current Enterprise Provider Credential Models

Enterprise Provider Abstraction v0 defines `ProviderAuth` with API-key auth by env key or `secretRef`, plus `external_cli_session` for local CLI providers. `StaticCredentialManager` returns references only and never reads credential caches. Local CLI providers must continue to use `external_cli_session` with `credentialAccess=never_read_tokens`.

## Gaps

- GitHub and OpenAI-compatible credentials are still env/config values at integration boundaries.
- `SecretRef` can identify future provider credentials but lacks provider credential kind/env-key fields.
- There is no controlled env-backed secret provider for explicit local integration environments.
- Credential resolution does not yet produce a sanitized `CredentialHandle` and auditable `CredentialResolutionResult`.
- Dashboard/health can show gate booleans, but not unified credential manager status.

## Proposed v1 Flow

For v1, provider credential resolution becomes:

```text
Git / LLM / Enterprise Provider
  -> SecurityControlService credential manager
  -> active SecretRef metadata
  -> metadata SecretLease
  -> PolicyDecision
  -> EnvSecretProvider, only when explicitly enabled
  -> transient credential value inside adapter boundary only
  -> audit/redaction
```

`CredentialResolutionResult` and API DTOs never include raw secret values. A separate internal-only value result is used only by GitHub and OpenAI-compatible provider factories when a real integration gate is already configured.

## Env Secret Provider Design

`EnvSecretProvider` is disabled by default and requires:

- `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true`
- active `SecretRef` with `provider=env`
- `envKey` on the SecretRef
- optional `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` allowlist containing the referenced key

It reads exactly the requested env key, never enumerates the environment, and never writes values to audit/API/dashboard/health. Missing env keys, disabled provider, disabled/revoked refs, and non-allowlisted keys return deterministic statuses.

Legacy `AICHESTRA_GITHUB_TOKEN` and `AICHESTRA_LLM_API_KEY` remain supported when no `*_SECRET_REF` is configured, but are documented as legacy env fallback. The preferred path is `AICHESTRA_GITHUB_TOKEN_SECRET_REF` and `AICHESTRA_LLM_API_KEY_SECRET_REF`.

## Policy Integration

Credential resolution evaluates `provider.credential.resolve` before any env read. v1 adds allow rules for env-backed SecretRef provider credentials when:

- the actor is system/service controlled;
- the SecretRef is active;
- env secret provider is enabled;
- no credential cache access or stored credential material is involved.

Metadata-only `secret.lease.request` and `secret.lease.issue` are allowed for provider credential resolution under the same explicit env-provider constraints. `secret.read` remains denied. Existing Git remote, LLM remote, model allowlist, and budget gates remain authoritative.

## Audit and Redaction

Security audit records:

- `credential_secret_ref_created`
- `credential_secret_ref_disabled`
- `credential_secret_ref_revoked`
- `credential_resolution_requested`
- `credential_resolution_allowed`
- `credential_resolution_denied`
- `credential_resolution_missing`
- `credential_resolution_revoked`
- `credential_env_provider_disabled`
- `credential_env_key_not_allowlisted`
- `credential_cache_access_denied`
- `credential_value_redacted`

Audit metadata is sanitized and includes only ids, provider kind, secret kind, env key references, policy ids, status, and safe config booleans. It never includes token values, API keys, bearer tokens, env var values, raw prompts, or credential cache contents.

## API, Health, and Dashboard

Add credential endpoints under the existing security convention:

- `GET /security/credentials/refs`
- `POST /security/credentials/refs`
- `PATCH /security/credentials/refs/:id/status`
- `POST /security/credentials/resolve/check`
- `GET /security/credentials/audit`

Health and dashboard expose credential manager kind, env secret provider enabled state, active SecretRef counts, GitHub credential status, LLM credential status, recent credential audit events, and blocked credential-cache examples. No values or env var contents are exposed.

## Out of Scope

- Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, or any cloud secret backend.
- BYOK.
- OAuth, device-code, WIF, or IAM token exchange.
- Credential cache reads or uploads.
- Vendor CLI calls.
- Runner/Local Agent secret injection.
- MCP, Kubernetes, Temporal, or artifact registry integration.
- Production auth/RBAC or production-ready secret management.
