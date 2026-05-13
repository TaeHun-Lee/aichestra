# Secret Backend Migration Planning v0

Status: v0_implemented as planning/readiness only.

Canonical roadmap package: `docs/roadmaps/secret-backend-migration/`.

## Current State

SecretRef-backed Provider Credentials v1 defines metadata-only `SecretRef` records and an explicit env provider. The env provider is disabled by default, reads only the requested allowlisted env key, and never returns values through API, dashboard, health, or audit DTOs.

Secret Backend Migration Planning v0 adds deterministic read-only backend option, migration phase, readiness check, risk, lease policy, rotation plan, and summary models in `packages/deployment-readiness`.

## API and dashboard surfaces

- `GET /readiness/secrets/backends`
- `GET /readiness/secrets/migration-phases`
- `GET /readiness/secrets/checks`
- `GET /readiness/secrets/risks`
- `GET /readiness/secrets/rotation-plans`
- `GET /readiness/secrets/lease-policies`
- `GET /readiness/secrets/summary`
- `GET /dashboard/secret-backend`
- `/health` secret backend migration metadata

These surfaces expose booleans, counts, statuses, and planning metadata only.

## Production blocker status

Production remains blocked because no real backend is selected or integrated, no production identity/service account access exists, no rotation or revocation workflow is implemented, and env fallback must be disabled before production traffic.

## Target Backend Options

- Vault
- AWS Secrets Manager
- GCP Secret Manager
- Azure Key Vault
- custom enterprise secret backend
- env provider as legacy local/integration fallback only

## Migration Strategy

1. Keep `SecretRef` as the stable app-facing reference.
2. Add provider-specific SecretManager implementation behind the existing interface in a future task.
3. Store backend reference ids and version metadata, not values.
4. Require production profile to reject env provider and legacy env fallback.
5. Migrate GitHub token, GitHub webhook secret, and LLM API key refs first.
6. Add rotation and revocation audit events.
7. Add integration tests behind explicit local/test backend gates.

## Audit Requirements

- SecretRef lifecycle.
- Credential resolution request/allow/deny/missing/revoked.
- Backend access decision.
- Lease issue/revoke/expire.
- Rotation events.
- No raw secret, token, key, env value, or credential-cache content.

## Credential Cache Policy

Aichestra must not read provider-owned credential caches such as `~/.codex/auth.json`, `~/.claude`, Google credential caches, OS keychains, or vendor CLI session files. Local CLI providers remain `external_cli_session` with `credentialAccess=never_read_tokens`.

## Not implemented in v0

- Real Vault/cloud/custom backend integration.
- BYOK, OAuth, WIF/IAM, device-code, or cloud identity exchange.
- Actual secret migration or rotation.
- Production credential issuance.
- Secret injection into runner, MCP, Local Agent, Git, LLM, or provider processes.
