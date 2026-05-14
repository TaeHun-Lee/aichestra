# Env To Production Secret Backend Migration v0

Status: `v0_implemented`

This is a migration plan only. It does not migrate secrets.

## Current Env Fallback Use Cases

- GitHub token: `AICHESTRA_GITHUB_TOKEN`
- GitHub webhook secret: `AICHESTRA_GITHUB_WEBHOOK_SECRET`
- LLM API key: `AICHESTRA_LLM_API_KEY`
- Generic provider API keys: future env names only if explicitly added

Current preferred refs:

- `AICHESTRA_GITHUB_TOKEN_SECRET_REF`
- `AICHESTRA_GITHUB_WEBHOOK_SECRET_REF`
- `AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF`
- `AICHESTRA_LLM_API_KEY_SECRET_REF`

## Profile Behavior

| Profile | Env fallback behavior |
| --- | --- |
| local | allowed only when explicit and allowlisted |
| integration | allowed with warning and fake/non-production values |
| staging | discouraged or blocked; warning-only only if project policy permits |
| production | must not rely on env fallback as primary secret backend |

## Migration Steps

1. Inventory SecretRefs and env fallback usage without reading values.
2. Add selected Vault-backed provider implementation in v1. Completed as a gated, non-default provider boundary; production rollout remains future.
3. Create backend-backed SecretRefs outside Aichestra using operator process.
4. Store backend reference/version metadata only.
5. Validate no-secret/no-env API/dashboard/health output.
6. Switch integration profile to backend-backed refs with fallback warning.
7. Switch staging to backend-backed refs.
8. Block env fallback for production.

## Credential Migration Notes

| Credential | Migration target | Validation |
| --- | --- | --- |
| GitHub token | Vault-backed SecretRef as interim path | remote Git gates, repo allowlist, policy, no token output |
| GitHub webhook secret | Vault-backed verifier-only SecretRef | signature verification metadata only, no raw payload/secret |
| GitHub App private key | Vault-backed private-key SecretRef metadata for future signing | no private-key read until live signing task |
| LLM API key | Vault-backed SecretRef behind LLM Gateway gates | model allowlist, budget, policy, no raw prompt/key output |
| Provider API key | future Vault-backed provider-scoped SecretRef | provider-specific adapter gates |
| Future MCP tool secret | future short lease only after real MCP governance | high-risk tool review and no tool secret forwarding by default |

## Rollback Plan

- Disable affected provider gates.
- Return integrations to mock/disabled behavior.
- Mark SecretRef disabled or revoked.
- Do not print/export values.
- Do not re-enable env fallback as production primary backend.

## Audit Requirements

Record migration phase, actor/service account, SecretRef id, backend provider, version metadata, policy decision, and validation status only.

## No-secret Exposure Checks

Every migration validation must assert:

- no raw values in API, dashboard, health, audit, logs, tests, or docs;
- no env values exposed;
- no credential cache paths exposed;
- disabled/revoked refs fail closed.

## Timeline Proposal

- v0: decision and implementation scope.
- v1: Vault provider boundary with disabled/mock/gated HTTP clients, mock client contract tests, and skipped live tests. Implemented; not production-ready.
- v2: gated non-production/staging SecretRef migration.
- v3: production env fallback enforcement and operator runbooks.
