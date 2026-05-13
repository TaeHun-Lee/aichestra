# Credential Kind Migration Plan v0

Status: planning/readiness only. No credential values are migrated.

| Credential kind | Current state | Target backend | SecretRef pattern | Lease strategy | Rotation strategy | Audit requirements | Redaction requirements | Production blocker | Likely owner |
|---|---|---|---|---|---|---|---|---|---|
| `github_token` | SecretRef-backed env provider or legacy env fallback behind Real Git Adapter gates | selected real backend, then future GitHub App installation token path | stable SecretRef id with backend reference metadata | short non-renewable lease, approved purpose | manual first; future GitHub App path preferred | resolution allowed/denied, provider id, repo allowlist, policy decision | no token, no raw auth header, no cache path | real backend and GitHub App path | integrations + security |
| `github_webhook_secret` | SecretRef-backed env provider or legacy env fallback for verifier | selected real backend | verifier-only SecretRef | short verifier access, service account only | manual with overlap window | signature verification metadata and rejection outcomes | no webhook secret, no raw payload | real backend and endpoint hardening | integrations + security |
| `llm_api_key` | SecretRef-backed env provider or legacy env fallback behind LLM Gateway gates | selected real backend | model/provider-scoped SecretRef | short non-renewable lease with budget/policy | manual first | resolution, model/provider, budget decision, policy decision | no API key, no raw prompt/output | real backend and production auth/policy | platform AI + security |
| `provider_api_key` | mostly future skeletons | selected real backend | provider-kind scoped SecretRef | short approved lease | manual or provider-managed future | provider id, purpose, actor, denial metadata | no raw provider credential | adapter-specific future work | provider owner |
| `webhook_secret` | GitHub-specific current path; generic future | selected real backend | endpoint/provider scoped SecretRef | verifier-only lease | manual with overlap | delivery verification metadata | no secret, no raw payload | endpoint-specific future work | integrations |
| `future_oauth_token` | not implemented | selected real backend | subject/provider scoped SecretRef | provider-managed future; no raw token exposure | provider-managed refresh future | token requested/refreshed metadata only | no access/refresh token | OAuth not implemented | auth + provider owner |
| `future_cloud_identity` | not implemented | cloud-native identity/backend | service identity metadata, not reusable raw key | provider-managed future | provider-managed future | identity token requested metadata only | no cloud token or credential file | WIF/IAM not implemented | platform ops |
| `future_mcp_tool_secret` | not issued to MCP tools | selected real backend | tool/server scoped SecretRef | short approved lease, high-risk tool review | manual or provider-managed future | tool id, server id, policy decision | no tool secret or raw tool input | real MCP transport disabled | platform integrations |
| `future_local_agent_pairing_secret` | not implemented | selected real backend | agent/session scoped SecretRef | short pairing lease with consent | manual, revocable | pairing requested/approved/revoked metadata | no pairing secret or vendor cache | real Local Agent daemon absent | local agent team |
| `future_service_account_signing_key` | not implemented | selected real backend or HSM/KMS future | key id metadata only | very short signing access | scheduled future with key rollover | key id, actor, issuance metadata | no private key or signed token values | production auth absent | identity platform |
| `future_byok_key` | not implemented | future backend/KMS design only | tenant-scoped metadata only | future per-tenant policy | future only | key metadata only | no customer key material | BYOK out of scope | security + enterprise |

## Migration order

1. GitHub token, GitHub webhook secret, and LLM API key.
2. Generic provider API keys only after provider adapters require them.
3. MCP and Local Agent secrets only after real transports, consent, and sandbox controls exist.
4. OAuth, cloud identity, service-account signing, and BYOK only after explicit future design tasks.

## Shared requirements

- All credentials use SecretRef ids as application references.
- Secret values never appear in DTOs, dashboard, health, audit, logs, tests, or docs except redaction test strings.
- Disabled/revoked refs fail closed.
- Production env fallback remains blocked.
