# Secret Handling — Pilot Runbook

Operational guidance for the single-tenant pilot, where the **env-backed
SecretRef provider** is the only active secret path. Vault and other backends
remain disabled (see [configuration.md](./configuration.md)).

Code: `packages/security/src/credentials.ts` (`EnvSecretProvider`).

## Model

- A `SecretRef` with `provider: "env"` names an env key (`envKey`); it never
  stores the value.
- `EnvSecretProvider.resolve()` returns the value **only** when the provider is
  enabled, the key is on the allowlist, and the env var is set. The value is
  used internally (e.g. the LLM gateway credential resolution) and is never
  serialized into config, health, dashboard, audit, or DTO surfaces.
- `getConfig()` exposes only `enabled`, `allowedEnvKeys` (key **names**), and
  `allowedEnvKeyCount` — never values.

## Enabling for the pilot (real LLM)

```bash
AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true
AICHESTRA_ALLOWED_SECRET_ENV_KEYS=AICHESTRA_LLM_API_KEY
AICHESTRA_LLM_API_KEY=<provider api key>
```

- **Fail-closed allowlist:** an enabled provider with an empty
  `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` denies every resolution
  (`env_allowlist_empty`). Always scope the allowlist to the exact keys the
  pilot needs — never leave it empty to "allow all".
- Allowlist only the keys actually required. Adding a key to the allowlist is
  what makes it readable via a SecretRef; unlisted keys return
  `env_key_not_allowlisted`.

## Rotation procedure

The provider reads the env var on each `resolve()`, so rotation is a restart, not
a code change:

1. Issue a new credential with the provider (keep the old one valid).
2. Update the secret store / deployment env for `AICHESTRA_LLM_API_KEY` (or the
   relevant key) to the new value.
3. Restart the API/worker processes so the new value is picked up. In-flight
   requests drain on the old value; new requests resolve the new value.
4. Confirm `/health` and the security dashboard still report
   `containsSecretMaterial: false` and the expected `allowedEnvKeyCount`.
5. Revoke the old credential at the provider.

Rotate on a fixed cadence and immediately on suspected exposure. Because the
value never lands in logs/audit/DTOs, rotation does not require scrubbing stored
data — but still rotate if a value could have been exposed at the process or
deployment layer.

## Guarantees locked by tests

- `tests/env-secret-provider-hardening-v1.test.ts` — `getConfig()` never
  contains the value, fail-closed on empty allowlist, value returned only for an
  enabled + allowlisted key.
- `tests/secretref-provider-credentials-v1.test.ts` — credential resolution does
  not expose values via DTO, audit, health, or dashboard.

## Out of scope for the pilot

Vault / cloud secret managers, automatic rotation jobs, BYOK, and credential
caches. Track these under the secret-backend planning docs before any
production-secret work.
