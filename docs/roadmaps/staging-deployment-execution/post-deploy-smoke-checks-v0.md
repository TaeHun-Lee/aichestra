# Staging Deployment Post-deploy Smoke Checks v0

Status: `v0_implemented`
Scope: planned smoke checks only

No staging deployment exists and no smoke check is run by v0. These checks are placeholders for a future explicit deployment execution task:

- `GET /health`
- `GET /dashboard/overview`
- `GET /dashboard/staging`
- `GET /dashboard/staging-dry-run`
- `GET /dashboard/staging-rc`
- `GET /dashboard/staging-execution`
- `GET /dashboard/observability`
- `GET /readiness/deployment/summary`
- `GET /readiness/staging-dry-run/summary`
- `GET /readiness/staging-rc/summary`
- `GET /readiness/staging-execution/summary`
- `GET /observability/audit/summary`
- no-secret health/dashboard check
- no external provider calls unless explicitly enabled by a separate approved validation task

Smoke output must not include secrets, env values, database URLs, Vault addresses/tokens, GitHub tokens, webhook secrets, private keys, LLM API keys, raw prompts, raw provider responses, raw logs, or credential cache paths.
