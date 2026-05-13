# Environment Gate Matrix

This matrix documents important runtime gates. It intentionally lists env variable names, not values. Secret values must not appear in health, dashboard, logs, audit, or readiness output.

| Env var | Purpose | Default | Allowed values | Used by | Production safe | Secret value | Health | Dashboard | Redact | Related tests |
|---|---|---|---|---|---|---|---|---|---|---|
| `AICHESTRA_STORAGE_PROVIDER` | Select storage provider | memory/in-memory | unset, `postgres` | API/storage | yes when `postgres` | no | yes | yes | no | persistent DB, API health |
| `AICHESTRA_DATABASE_URL` | Postgres connection URL | unset | Postgres URL | DB provider/migrations | yes only through secret/config management | yes | no value, boolean only | no value, boolean only | yes | persistent DB optional |
| `AICHESTRA_TEST_DATABASE_URL` | Optional Postgres contract tests | unset | Postgres URL | tests | test only | yes | no | no | yes | storage provider test |
| `AICHESTRA_PSQL_BIN` | Optional local psql binary path for migration/client scaffold | `psql` | local path or command name | DB provider/migrations | no production commitment in v1 | no | status/path not required | status/path not required | path as needed | persistent DB |
| `AICHESTRA_GIT_PROVIDER` | Git provider selection | `mock` | `mock`, `local`, `github` | Git adapter | future/gated | no | yes | yes | no | real Git adapter |
| `AICHESTRA_ENABLE_REMOTE_GIT` | Enable remote Git boundary | false | true/false/1 | Git adapter/policy | integration only until production hardening | no | yes | yes | no | real Git adapter |
| `AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE` | Allow remote branch create | false | true/false/1 | Git adapter/policy | gated only | no | yes | yes | no | real Git adapter |
| `AICHESTRA_ALLOW_REMOTE_PR_CREATE` | Allow remote PR create | false | true/false/1 | Git adapter/policy | gated only | no | yes | yes | no | real Git adapter |
| `AICHESTRA_ALLOW_REMOTE_MERGE` | Merge gate placeholder | false/unsupported | false | Git adapter/policy | no | no | yes | yes | no | real Git adapter |
| `AICHESTRA_GITHUB_TOKEN_SECRET_REF` | Preferred GitHub token ref | unset | SecretRef id | Git/security | future with real secret backend | no | source/status only | source/status only | no | secretref credentials |
| `AICHESTRA_GITHUB_TOKEN` | Legacy GitHub token fallback | unset | token value | Git adapter boundary | no for production | yes | no value | no value | yes | secretref credentials |
| `AICHESTRA_GITHUB_WEBHOOK_SECRET_REF` | Preferred webhook secret ref | unset | SecretRef id | Git webhook/security | future with real secret backend | no | source/status only | source/status only | no | real Git v2, secretref |
| `AICHESTRA_GITHUB_WEBHOOK_SECRET` | Legacy webhook secret fallback | unset | secret value | Webhook verifier boundary | no for production | yes | no value | no value | yes | real Git v2 |
| `AICHESTRA_ENABLE_GITHUB_WEBHOOKS` | Enable webhook receiver | false | true/false/1 | Git webhook | staging/prod only after hardening | no | yes | yes | no | real Git v2 |
| `AICHESTRA_GITHUB_INTEGRATION_TESTS` | Enable optional real Git tests | false | true/false/1 | tests | test only | no | yes | yes | no | real Git optional |
| `AICHESTRA_GITHUB_APP_ID` | Future GitHub App id metadata | unset | numeric id | future GitHub App boundary | future only | no | status only | status only | no | github app planning |
| `AICHESTRA_GITHUB_APP_SLUG` | Future GitHub App slug metadata | unset | slug | future GitHub App boundary | future only | no | status only | status only | no | github app planning |
| `AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF` | Future GitHub App private key ref | unset | SecretRef id | future GitHub App credential boundary/security | future only with real secret backend | no value; ref only | source/status only | source/status only | no value | github app planning |
| `AICHESTRA_GITHUB_APP_INSTALLATION_ID` | Future installation id metadata | unset | numeric id | future GitHub App boundary | future only | no | status only | status only | no | github app planning |
| `AICHESTRA_ENABLE_GITHUB_APP_INTEGRATION` | Future live GitHub App gate | false | true/false/1 | future GitHub App boundary | no until implemented and reviewed | no | yes | yes | no | github app planning |
| `AICHESTRA_ENABLE_GITHUB_WEBHOOK_REPLAY_STORE` | Future durable webhook replay store gate | false | true/false/1 | future webhook hardening | no until durable storage exists | no | yes | yes | no | github app planning |
| `AICHESTRA_LLM_PROVIDER` | LLM provider selection | `mock` | `mock`, `openai_compatible`, future skeletons | LLM Gateway | gated only | no | yes | yes | no | LLM Gateway |
| `AICHESTRA_ENABLE_REMOTE_LLM` | Enable remote LLM boundary | false | true/false/1 | LLM Gateway/policy | gated only | no | yes | yes | no | LLM Gateway |
| `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION` | Allow remote completion | false | true/false/1 | LLM Gateway/policy | gated only | no | yes | yes | no | LLM Gateway |
| `AICHESTRA_LLM_API_KEY_SECRET_REF` | Preferred LLM API key ref | unset | SecretRef id | LLM/security | future with real secret backend | no | source/status only | source/status only | no | secretref credentials |
| `AICHESTRA_LLM_API_KEY` | Legacy LLM key fallback | unset | API key value | LLM provider boundary | no for production | yes | no value | no value | yes | LLM Gateway, secretref |
| `AICHESTRA_LLM_BASE_URL` | OpenAI-compatible base URL | unset | URL | LLM provider | gated only | no | boolean only | boolean only | no | LLM Gateway |
| `AICHESTRA_LLM_ALLOWED_MODELS` | Model allowlist | unset | CSV | LLM Gateway | yes when reviewed | no | count only | yes/count | no | LLM Gateway |
| `AICHESTRA_LLM_ROUTING_MODE` | Route mode | `mock_only` | `mock_only`, future gated modes | LLM Gateway | production only after validation | no | yes | yes | no | LLM v2 |
| `AICHESTRA_ENABLE_LLM_FALLBACK` | Enable fallback | false | true/false/1 | LLM Gateway | no until bounded policy reviewed | no | yes | yes | no | LLM v2 |
| `AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS` | Fallback cap | 0 | integer | LLM Gateway | yes when bounded | no | yes | yes | no | LLM v2 |
| `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER` | Enable explicit env SecretRef provider | false | true/false/1 | security | no for production | no | yes | yes | no | secretref credentials |
| `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` | Env-key allowlist | unset | CSV of env names | security | no for production secret backend | names only | count only | count only | no values | secretref credentials |
| `AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER` | Enable LocalAgentRunner | false | true/false/1 | runner | no until sandboxed | no | yes | yes | no | local runner |
| `AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION` | Enable fixture command executor | false | true/false/1 | runner | no for production | no | yes | yes | no | local runner |
| `AICHESTRA_AGENT_WORKSPACE_ROOT` | Fixture workspace root | unset | safe local path | runner | future only | no | boolean/path status only | status only | path as needed | local runner |
| `AICHESTRA_DASHBOARD_DATA_SOURCE` | Dashboard data source | `api` | `api`, `demo` | web | `api` only in production | no | n/a | yes | no | dashboard |
| Observability v0 env vars | Common audit read model, metrics snapshot, trace skeleton, retention/redaction metadata | none | n/a | observability/API/dashboard | local/integration read-only | no | yes | yes | no values | observability audit retention |
| Future auth env vars | OIDC/SAML/SCIM provider config | unset | future | auth | future | client secrets yes | status only | status only | yes | future |
| `AICHESTRA_SECRET_BACKEND_PROVIDER` | Future real secret backend selection | unset | future `vault`, `aws_secrets_manager`, `gcp_secret_manager`, `azure_key_vault`, `custom` | security/readiness | future required | no | status only | status only | no values | secret backend migration planning |
| Future Vault env vars | Vault address/auth config | unset | future | security | future gated | possible | boolean/status only | boolean/status only | yes | secret backend migration planning |
| Future cloud secret manager env vars | AWS/GCP/Azure backend identity/config | unset | future | security | future gated | possible | boolean/status only | boolean/status only | yes | secret backend migration planning |
| Future secret backend env vars | Vault/cloud secret backend selection and credentials | unset | future | security | future required | yes for backend credentials | status only | status only | yes | future |
| Future MCP env vars | Real MCP transport/profile gates | unset | future | MCP Gateway | future only | possible | status only | status only | yes | future |
| Future observability env vars | Log/metric/trace exporters, audit export, alert delivery | unset | future | ops | future required | possible | status only | status only | yes | future |

## Production Rules

- `AICHESTRA_STORAGE_PROVIDER=postgres` is required.
- `AICHESTRA_DASHBOARD_DATA_SOURCE=api` is required.
- Persistent DB Production Operations v1 readiness may expose database URL configured booleans and migration file counts/checksums, never DB URL values.
- Secret Backend Migration Planning v0 readiness may expose backend options, migration phases, readiness checks, risks, lease/rotation expectations, SecretRef counts, and env fallback booleans/counts/status only; it must never expose env values or secret values.
- Production pooling, backup/restore, migration governance, retention/legal hold, durable webhook replay/dead-letter persistence, and tenant scoping remain required before production.
- Mock auth, legacy env credentials, env secret fallback, real MCP transport without allowlists, unbounded LLM fallback, local command execution, and vendor CLI credential cache reads must be rejected.
- Health and dashboard may expose booleans, counts, ids, and statuses only.
