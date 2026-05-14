# SecretRef Provider Mapping v0

Status: `v0_implemented`

Vault-backed Secret Backend v1 promotes the selected runtime provider value to `vault`. The provider is implemented as a gated, non-default backend boundary; it is not production-ready and is not used by default runtime/tests.

| Provider value | Current status | Production status | Required config | Allowed profiles | Forbidden profiles | Test strategy |
| --- | --- | --- | --- | --- | --- | --- |
| `mock` | implemented metadata/mock | test-only | none | local, integration | staging, production | deterministic unit tests |
| `env` | implemented explicit allowlisted EnvSecretProvider | local/integration only | `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER`, `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` | local, integration; staging warning only if policy permits | production | fake env values and no-output assertions |
| `vault` | implemented gated Vault SecretRef provider boundary | production-oriented but not production-ready | `AICHESTRA_SECRET_BACKEND_PROVIDER=vault`, `AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true`, Vault config/status gates, path allowlist | local/integration with mock client; staging only as explicitly accepted warning/gated validation; production blocked until rollout controls exist | default runtime/tests; production until Auth/RBAC, policy bundle, operations, rotation, and rollout controls exist | deterministic mock client/provider tests and skipped-by-default live Vault test skeleton |
| `vault_future` | planning alias retained for older docs | replaced by `vault` for v1 runtime | n/a | docs only | runtime provider selection | n/a |
| `aws_secrets_manager_future` | future placeholder | deferred | future AWS region/IAM status config | integration, staging, production after AWS-first decision | none by kind | future mock AWS client tests |
| `gcp_secret_manager_future` | future placeholder | deferred | future GCP project/WIF status config | integration, staging, production after GCP-first decision | none by kind | future mock GCP client tests |
| `azure_key_vault_future` | future placeholder | deferred | future Azure vault/managed identity status config | integration, staging, production after Azure-first decision | none by kind | future mock Azure client tests |
| `custom_future` | not in runtime security provider enum yet; roadmap mapping only | future | future adapter id/status config | integration, staging, production after explicit adapter decision | none by kind | future adapter contract tests |

## Target Provider Value For Selected v1 Backend

Use `vault` as the selected v1 runtime provider value. Retain `vault_future` only as a planning alias in older readiness documents.

## Required Auth/RBAC

- `security_admin` or platform security owner approves backend setup.
- Service accounts resolve backend-backed credentials for narrow purposes only.
- Ordinary users cannot view raw secrets.
- Tenant/team/project scope checks are required before production.

## Required Policy

- Deny `secret.read` by default.
- Deny disabled/revoked SecretRefs.
- Deny broad provider credential resolution.
- Deny env fallback in production.
- Deny credential cache reads.
- Deny Local Agent secret forwarding.

## Audit Requirements

- Record actor, request id, service account, provider id, SecretRef id, purpose, policy decision id, and backend audit reference metadata.
- Never record raw secret values, env values, private keys, tokens, webhook secrets, provider keys, or credential cache paths.

## Health and Dashboard Exposure Rules

Expose provider value, decision status, configured booleans, counts, implementation status, readiness status, and no-secret/no-env flags only. Do not expose backend paths if they are considered sensitive in the deployment.
