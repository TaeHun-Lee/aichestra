# SecretRef Provider Migration Strategy v0

Status: planning/readiness only. No actual secret migration is performed.

## Current SecretRef provider values

Current SecretRef metadata supports provider values used by the mock and env-backed boundaries. The active production-safe contract is the application-facing `SecretRef` id, not the underlying secret value.

The env-backed provider is explicit and gated:

- `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER`
- `AICHESTRA_ALLOWED_SECRET_ENV_KEYS`

It reads only a requested allowlisted key and must not enumerate or return env values.

## Provider values

Current provider values include:

- `mock`;
- `env`;
- `vault`, implemented by Vault-backed Secret Backend v1 as a gated, non-default provider boundary.

Future production provider values should include backend-specific references such as:

- `vault_future` as a planning alias retained for older docs;
- `aws_secrets_manager_future`;
- `gcp_secret_manager_future`;
- `azure_key_vault_future`;
- `custom_future`

The cloud/custom values above remain planning-only until explicit backend adapter tasks implement them.

Production Secret Backend Implementation Option Decision v0 selected Vault first and `aws_secrets_manager_future` second for AWS-first deployments. Vault v1 now supports `provider: vault`, but it does not migrate secret values, make Vault the default, or mark production secrets ready.

## Migration from env to real backend

1. Keep existing SecretRef ids stable.
2. Add backend provider metadata that points to backend reference ids or versions, not values.
3. Validate read-only dashboard/API output for no secret names, env values, raw values, or credential cache paths.
4. Switch staging to backend-backed SecretRefs.
5. Deny legacy env fallback in staging/production once the live backend rollout policy is accepted.
6. Keep local profile mock-first and integration profile warning-only until production gates are implemented.

## Legacy GitHub token migration

Legacy fallback:

- `AICHESTRA_GITHUB_TOKEN`

Preferred current ref:

- `AICHESTRA_GITHUB_TOKEN_SECRET_REF`

Target:

- backend-backed `SecretRef` for GitHub token only as an interim path;
- future GitHub App installation tokens after GitHub App controlled implementation.

## Legacy GitHub webhook secret migration

Legacy fallback:

- `AICHESTRA_GITHUB_WEBHOOK_SECRET`

Preferred current ref:

- `AICHESTRA_GITHUB_WEBHOOK_SECRET_REF`

Target:

- backend-backed webhook secret SecretRef used only inside signature verification.
- No raw webhook secret, raw webhook payload, or payload body is stored in audit/dashboard read models.

## Legacy LLM API key migration

Legacy fallback:

- `AICHESTRA_LLM_API_KEY`

Preferred current ref:

- `AICHESTRA_LLM_API_KEY_SECRET_REF`

Target:

- backend-backed LLM API key SecretRef behind LLM Gateway v2 gates, model allowlists, budget checks, and Policy-as-code.
- BYOK, OAuth, WIF/IAM, and non-OpenAI provider credentials remain future.

## Stable SecretRef ids

SecretRef ids should remain the durable application reference across provider migration. The backend reference can change through metadata/version fields while API consumers continue to use the same SecretRef id.

## Secret versions

Future backend-backed SecretRefs should store version metadata only:

- current backend version id;
- previous version id only if needed for rollback metadata;
- active/disabled/revoked status;
- last validated timestamp;
- no value, token, private key, webhook secret, or credential payload.

## Disabled and revoked refs

- `disabled`: not usable for new leases; may remain visible as metadata.
- `revoked`: denied for resolution and highlighted in audit/readiness.
- Resolution attempts against disabled/revoked refs must fail closed and audit metadata only.

## Rollback

Rollback should disable live provider gates and return to mock providers. Production rollback must not re-enable legacy env fallback. Integration rollback may temporarily use env fallback with explicit warnings and no value exposure.

## No-secret validation

Validation must assert that API, dashboard, health, audit, and logs do not expose:

- raw secrets or tokens;
- env var values;
- credential cache contents or paths;
- provider private keys;
- raw webhook secrets;
- raw prompt/output payloads.

## Env fallback phaseout

Production profile must treat env fallback as blocked. Integration may allow it with warnings. Local may allow it for developer setup only.

## Related decision

Canonical provider mapping for the selected v1 backend is documented in `docs/roadmaps/production-secret-backend-option-decision/secretref-provider-mapping-v0.md`. Vault Integration-Test Profile v1 documents the optional test-only SecretRef pattern for allowlisted KV v2 smoke validation without changing production migration status.
