# CI/CD Secret And Env Safety v0

Status: v0_implemented
Scope: planning only

## Secret-Bearing Env Vars

These values must never be printed, returned, uploaded, or stored in CI artifacts:

- `AICHESTRA_GITHUB_TOKEN`
- `AICHESTRA_GITHUB_WEBHOOK_SECRET`
- `AICHESTRA_LLM_API_KEY`
- `GITHUB_TOKEN`
- `GITHUB_APP_PRIVATE_KEY`
- `SESSION_SECRET`
- `JWT_SECRET`
- `DATABASE_URL`
- `AICHESTRA_DATABASE_URL`
- `AICHESTRA_TEST_DATABASE_URL`
- `GOOGLE_APPLICATION_CREDENTIALS`

## Safe Booleans And Counts

Readiness surfaces may expose booleans/counts such as:

- token configured: true/false
- DB URL configured: true/false
- optional profile count
- required job count
- integration gate count
- remote tests enabled by default: false

They must not expose values.

## Profile Gates

Profile gate names may be documented and returned:

- `AICHESTRA_GITHUB_INTEGRATION_TESTS`
- `AICHESTRA_GITHUB_APP_INTEGRATION_TESTS`
- `AICHESTRA_GITHUB_WEBHOOK_INTEGRATION_TESTS`
- `AICHESTRA_LLM_INTEGRATION_TESTS`
- `AICHESTRA_LLM_TEST_BUDGET_USD`
- `AICHESTRA_LLM_TEST_PROMPT_CLASS`
- `AICHESTRA_ENABLE_REMOTE_GIT`
- `AICHESTRA_ENABLE_REMOTE_LLM`
- `AICHESTRA_LLM_ALLOWED_MODELS`
- `AICHESTRA_LLM_DEFAULT_MODEL`
- `AICHESTRA_ENABLE_GITHUB_APP`
- `AICHESTRA_ENABLE_GITHUB_WEBHOOKS`

## CI Masking Requirements

CI must mask secret-bearing variables and must avoid commands that print full env dumps. Test failures should report only sanitized summaries.

## SecretRef Preference

SecretRef-backed credentials are preferred for GitHub, webhook, LLM, and future provider credentials. Env fallback is acceptable only for local/integration compatibility and controlled optional tests.

## Env Fallback By Profile

- local: allowed with warning
- pull_request: disabled
- integration: allowed only for controlled tests
- staging: discouraged/blocked except approved integration tests
- production: disabled/future

## Scanning Expectations

CI should run:

- secret exposure scan
- safe integration scan
- dashboard no-secret smoke
- health no-secret smoke
- artifact redaction check before upload

Findings must be classified before promotion.
