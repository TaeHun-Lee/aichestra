# Env Fallback Deprecation v0

Status: planning/readiness only. Runtime production enforcement remains future work.

## Where env fallback exists today

Env fallback exists at the SecretRef-backed credential boundary and legacy provider gates:

- `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER`
- `AICHESTRA_ALLOWED_SECRET_ENV_KEYS`
- `AICHESTRA_GITHUB_TOKEN`
- `AICHESTRA_GITHUB_WEBHOOK_SECRET`
- `AICHESTRA_LLM_API_KEY`
- future provider secret env vars, if introduced, must follow the same deprecation policy.

## Profile policy

| Profile | Env fallback policy | Required warning/status |
|---|---|---|
| local | allowed when explicit | local-only warning |
| integration | allowed with warning | not production warning |
| staging | discouraged or disabled | blocked unless explicit future break-glass design exists |
| production | disabled | fail readiness and deny use |

## Required warnings

- `env_fallback_allowed_for_local_only`
- `env_fallback_allowed_with_warning_for_integration_profile`
- `env_fallback_blocked_for_staging_profile`
- `env_fallback_blocked_for_production_profile`
- `legacy_env_credential_present_redacted_warning`

## Health/readiness flags

Health and readiness may expose:

- env fallback allowed for current profile: boolean;
- env provider enabled: boolean;
- allowlisted env key count: number;
- real backend configured: boolean/future;
- active/disabled/revoked SecretRef counts;
- no secret values exposed: boolean;
- no env values exposed: boolean.

They must not expose env values or raw secret names considered sensitive.

## Dashboard warnings

Dashboard may show:

- current profile;
- env fallback warning;
- legacy env fallback production readiness false;
- backend selection blockers;
- no-secret/no-env status.

Dashboard must not show env values, provider tokens, webhook secrets, API keys, private keys, or credential cache paths.

## Migration steps

1. Keep local env fallback explicit.
2. Warn in integration and count allowlisted keys only.
3. Migrate staging SecretRefs to selected real backend.
4. Fail staging if env fallback is still used.
5. Fail production if env fallback is configured or requested.
6. Remove legacy fallback paths only after controlled provider alternatives exist.

## Tests

Tests should inject fake secret-looking env values and verify:

- API/readiness/health/dashboard outputs do not contain values;
- production profile marks env fallback blocked/not ready;
- read-only endpoints reject writes;
- no external backend calls are made.

## Timeline proposal

- v0: planning models, API/dashboard status, docs, tests.
- v1: backend adapter design and fake backend contract tests.
- v2: staging backend integration behind explicit gates.
- v3: production profile enforcement and rollback runbooks.
