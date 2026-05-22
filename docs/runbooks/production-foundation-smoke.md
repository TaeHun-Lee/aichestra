# Production Foundation Smoke Runbook

Use this runbook after configuring a production-profile API instance. It verifies only the first foundation gates: static bearer auth, Vault backend readiness metadata, Postgres storage health, and read-only production foundation readiness.

## Required Inputs

Set these locally before running the smoke check:

```bash
export AICHESTRA_API_BASE_URL=http://127.0.0.1:3000
export AICHESTRA_AUTH_BEARER_TOKEN=<raw-token-matching-AICHESTRA_AUTH_BEARER_TOKEN_SHA256>
```

The script sends the bearer token to `/auth/me`, but it does not print the token, the token hash, Vault tokens, database URLs, or secret values.

## Command

```bash
pnpm prod:smoke
```

The script checks:

- `GET /health`
- `GET /readiness/production-foundation`
- `GET /auth/me`

## Expected Result

The command exits with status `0` when all HTTP checks return 2xx. Inspect the JSON summary for:

- `health.summary.productionFoundationStatus = "ready"`
- `production_foundation.summary.status = "ready"`
- `auth_me.summary.authenticated = true`
- `auth_me.summary.authMode = "static_bearer"`

`production_foundation.summary.operationalStatus` may remain `blocked` until the Postgres migration confirmation, backup/restore acknowledgement, Vault SecretRef rollout, auth migration acknowledgement, and audit durability acknowledgement are completed.

## Failure Handling

- `401` or `403` on `/auth/me`: verify the raw token hashes to `AICHESTRA_AUTH_BEARER_TOKEN_SHA256` and the mapped actor is allowlisted by `AICHESTRA_AUTH_STATIC_ALLOWED_ACTORS`.
- `production_foundation.status = "blocked"`: fix startup blockers before treating the instance as usable.
- `operationalStatus = "blocked"`: do not promote beyond foundation smoke. Complete the listed operational blockers first.
