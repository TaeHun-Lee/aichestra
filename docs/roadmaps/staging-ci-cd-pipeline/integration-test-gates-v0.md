# CI/CD Integration Test Gates v0

Status: v0_implemented
Scope: planning only

## General Gate Rule

Optional integration tests are disabled by default. A profile may run them only when every required env gate, allowlist, SecretRef/credential rule, approval, and cleanup expectation is satisfied.

## Postgres

- `AICHESTRA_TEST_DATABASE_URL` is required.
- The URL must point to a non-production database.
- The DB URL value must never be printed or returned by APIs.
- Migrations must be non-destructive and must not run automatically unless a test explicitly invokes a migration fixture.
- Cleanup strategy is required for test data.

## Remote Git

Required:

- `AICHESTRA_GITHUB_INTEGRATION_TESTS=true`
- `AICHESTRA_ENABLE_REMOTE_GIT=true`
- operation-specific branch/PR gates
- repo allowlist
- branch prefix
- SecretRef-backed credential preferred
- Auth/RBAC and Policy allow decisions

Forbidden:

- auto-merge
- force push
- branch deletion
- rebase push
- unallowlisted repositories

Cleanup/close PR policy is required before live tests.

## GitHub App

Required:

- `AICHESTRA_GITHUB_APP_INTEGRATION_TESTS=true`
- `AICHESTRA_ENABLE_REMOTE_GIT=true`
- `AICHESTRA_GITHUB_AUTH_MODE=github_app`
- `AICHESTRA_ENABLE_GITHUB_APP=true`
- GitHub App metadata gates, including app id
- private key SecretRef metadata, not raw private key env
- installation allowlist
- repository grant
- `AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX=ai/`
- branch/PR operation gates
- `AICHESTRA_ALLOW_REMOTE_MERGE=false`
- no token/private-key exposure

GitHub App integration-test profile v1 reports these as read-only readiness data under `/readiness/github-app-integration/*` and skips live tests until all required gates are configured. Live production organizations must not be used unless explicitly reviewed in a future task.

## Webhook

- Webhook secret must be configured through SecretRef where possible.
- Signature verification is required.
- Unverified payloads are denied.
- Replay test fixtures are allowed.
- No public endpoint is required by default CI.
- Webhook processing must update read models only.

## Remote LLM

Required:

- `AICHESTRA_LLM_INTEGRATION_TESTS=true`
- `AICHESTRA_LLM_PROVIDER=openai_compatible`
- `AICHESTRA_ENABLE_REMOTE_LLM=true`
- `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=true`
- `AICHESTRA_LLM_BASE_URL`
- `AICHESTRA_LLM_ALLOWED_MODELS`
- `AICHESTRA_LLM_DEFAULT_MODEL`
- `AICHESTRA_LLM_ROUTING_MODE=single_provider` or `multi_provider`
- `AICHESTRA_ENABLE_LLM_FALLBACK=false`
- `AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS=0`
- `AICHESTRA_LLM_TEST_BUDGET_USD`
- `AICHESTRA_LLM_TEST_PROMPT_CLASS`
- SecretRef-backed API key preferred; controlled test-only raw env key allowed only for reviewed integration jobs
- Auth/RBAC and Policy allow decisions
- prompt/output redaction checks

LLM Gateway integration-test profile v1 reports these as read-only readiness data under `/readiness/llm-integration/*` and skips live tests until all required gates are configured. Uncontrolled fallback, streaming, tool calling, BYOK, OAuth/device-code, WIF/IAM, Local CLI, vendor CLI providers, credential cache reads, raw prompt storage, raw provider response storage, and API-key/env-value exposure are not allowed.

## Remote MCP

Remote MCP is disabled/future by default.

Future requirements:

- server allowlist
- tool risk policy
- no high/critical tools by default
- no secret forwarding
- no write/deploy tools

## External Auth

External auth tests are future only. Current CI must not call real OIDC, SAML, SCIM, SSO, Okta, Auth0, Microsoft Entra, Google Workspace, or custom IdP services.

## Vendor CLI

Vendor CLI tests are future only. Current CI must not execute Claude, Codex, Gemini, or other vendor CLIs and must not read `~/.codex/auth.json`, `~/.claude`, Google credential caches, OS keychains, or vendor session files.
