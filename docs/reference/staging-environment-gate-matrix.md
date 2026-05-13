# Staging Environment Gate Matrix

Status: v0_implemented
Scope: staging profile readiness only

Values must never be exposed through health, readiness, audit, or dashboard surfaces. This matrix records only whether a variable is allowed, required, forbidden, secret-bearing, and redacted.

| Env var | Purpose | Allowed in staging | Required in staging | Forbidden in staging | Secret | Redact | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `AICHESTRA_STORAGE_PROVIDER` | Select storage provider | yes | yes | no | no | no | Expected value is `postgres` for meaningful staging validation. |
| `AICHESTRA_DATABASE_URL` | Postgres connection config | gated | yes | no | yes | yes | Value must not appear in responses or logs. |
| `AICHESTRA_TEST_DATABASE_URL` | Optional contract tests | gated | no | no | yes | yes | Used only for explicit optional tests. |
| `AICHESTRA_GIT_PROVIDER` | Git provider selection | gated | no | no | no | no | GitHub only under Real Git Adapter gates. |
| `AICHESTRA_ENABLE_REMOTE_GIT` | Enable remote Git boundary | gated | no | no | no | no | Requires repo allowlist, branch prefix, Auth/RBAC, Policy, and SecretRef. |
| `AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE` | Allow branch create | gated | no | no | no | no | Must not imply merge, push, rebase, or deletion. |
| `AICHESTRA_ALLOW_REMOTE_PR_CREATE` | Allow PR create | gated | no | no | no | no | Requires allowlisted repo and branch prefix. |
| `AICHESTRA_ALLOW_REMOTE_MERGE` | Remote merge | no | no | yes | no | no | Unsupported and forbidden. |
| `AICHESTRA_GITHUB_AUTH_MODE` | Legacy token or GitHub App mode | gated | no | no | no | no | `github_app` requires all GitHub App gates. |
| `AICHESTRA_ENABLE_GITHUB_APP` | Enable GitHub App boundary | gated | no | no | no | no | Disabled by default. |
| `AICHESTRA_GITHUB_APP_ID` | GitHub App id metadata | gated | no | no | no | no | Boolean/configured status only in health/dashboard. |
| `AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF` | Private key SecretRef id | gated | no | no | yes-adjacent | yes | SecretRef metadata only; never private key material. |
| `AICHESTRA_GITHUB_APP_WEBHOOK_SECRET_REF` | Webhook secret SecretRef id | gated | no | no | yes-adjacent | yes | Prefer this over legacy env secret. |
| `AICHESTRA_ENABLE_GITHUB_WEBHOOKS` | Webhook receiver gate | gated | no | no | no | no | Signature verification remains required. |
| `AICHESTRA_GITHUB_WEBHOOK_SECRET_REF` | Webhook SecretRef id | gated | no | no | yes-adjacent | yes | Required for verified webhook staging tests. |
| `AICHESTRA_GITHUB_WEBHOOK_SECRET` | Legacy webhook secret | no | no | yes | yes | yes | Use SecretRef instead. |
| `AICHESTRA_LLM_PROVIDER` | LLM provider mode | gated | no | no | no | no | Defaults to mock. |
| `AICHESTRA_ENABLE_REMOTE_LLM` | Enable remote LLM boundary | gated | no | no | no | no | Optional integration tests only. |
| `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION` | Allow remote completion | gated | no | no | no | no | Requires budget, model allowlist, SecretRef, Auth/RBAC, Policy. |
| `AICHESTRA_LLM_API_KEY_SECRET_REF` | LLM API key SecretRef id | gated | no | no | yes-adjacent | yes | Metadata only. |
| `AICHESTRA_LLM_API_KEY` | Legacy LLM API key | no | no | yes | yes | yes | Env fallback is not staging-ready. |
| `AICHESTRA_LLM_BASE_URL` | OpenAI-compatible test endpoint | gated | no | no | no | no | Readiness exposes configured boolean only, never value. |
| `AICHESTRA_LLM_ALLOWED_MODELS` | LLM test model allowlist | gated | no | no | no | no | Readiness exposes count only. |
| `AICHESTRA_LLM_DEFAULT_MODEL` | LLM default test model | gated | no | no | no | no | Readiness exposes configured/allowlisted booleans only. |
| `AICHESTRA_LLM_ROUTING_MODE` | LLM routing mode | yes | no | no | no | no | `mock_only` remains default. |
| `AICHESTRA_ENABLE_LLM_FALLBACK` | LLM fallback | gated | no | no | no | no | Must not bypass budget, SecretRef, Auth/RBAC, or Policy. |
| `AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS` | LLM fallback attempt cap | gated | no | no | no | no | Integration-test profile requires `0`. |
| `AICHESTRA_LLM_INTEGRATION_TESTS` | LLM integration-test profile gate | gated | no | no | no | no | Skipped by default. |
| `AICHESTRA_LLM_TEST_BUDGET_USD` | LLM integration-test budget cap | gated | no | no | no | no | Readiness exposes configured boolean only. |
| `AICHESTRA_LLM_TEST_PROMPT_CLASS` | Safe prompt class label | gated | no | no | no | no | Readiness exposes configured boolean only. |
| `AICHESTRA_ENABLE_LLM_STREAMING` | Future streaming gate | no | no | yes | no | no | Streaming is out of scope for staging v0/v1 tests. |
| `AICHESTRA_ENABLE_LLM_TOOL_CALLS` | Future tool-call gate | no | no | yes | no | no | Tool calling is out of scope for staging v0/v1 tests. |
| `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER` | Env SecretRef provider | discouraged | no | gated | no | no | Local/integration only except tightly controlled tests. |
| `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` | Env SecretRef allowlist | discouraged | no | gated | yes-adjacent | yes | Count only; no values. |
| `AICHESTRA_DASHBOARD_DATA_SOURCE` | Dashboard data source | yes | yes | no | no | no | Use `api` for staging. |
| `AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER` | Local runner boundary | gated | no | no | no | no | Command execution remains disabled by default. |
| `AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION` | Local command execution | no | no | yes | no | no | Forbidden in staging v0. |
| future auth provider vars | OIDC/SAML/SCIM config | future | no | no | yes | yes | Not implemented. |
| future secret backend vars | Vault/cloud/custom backend config | future | no | no | yes | yes | Not implemented. |
| future MCP vars | Real MCP transport config | no | no | yes | yes | yes | Remote MCP is blocked in staging v0. |
| future policy bundle vars | Bundle source/signing config | future | no | no | yes | yes | Runtime remains StaticPolicyEngine. |

Staging default rules:

- Postgres is required or strongly recommended.
- Env secret provider is discouraged or blocked except controlled integration tests.
- Real auth is future and remains required before production.
- Remote merge, force push, branch deletion, remote MCP, and vendor CLI execution are forbidden.
- Production secret backend is future and required before production.
- Mock actor and env fallback warnings must remain visible.
