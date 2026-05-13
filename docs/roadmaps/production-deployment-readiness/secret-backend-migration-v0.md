# Secret Backend Migration Plan v0

Planning only. No real secret backend is implemented.

## Current State

SecretRef-backed Provider Credentials v1 defines metadata-only `SecretRef` records and an explicit env provider. The env provider is disabled by default, reads only the requested allowlisted env key, and never returns values through API, dashboard, health, or audit DTOs.

## Why Env Provider Is Not Production Sufficient

- Rotation is not centrally managed.
- Revocation depends on process/env rollout.
- Lease TTL cannot be enforced by the backend.
- Audit evidence is limited to Aichestra metadata.
- Secret distribution and reload semantics are environment-specific.

## Target Backend Options

### Vault

- Strong lease and audit model.
- Good fit for dynamic credentials and revocation.
- Requires operational Vault expertise.

### AWS Secrets Manager

- Good fit for AWS deployments.
- Native rotation and IAM integration.
- Requires careful IAM and audit design.

### GCP Secret Manager

- Good fit for GCP deployments.
- IAM and audit integration.
- Requires workload identity design.

### Azure Key Vault

- Good fit for Azure deployments.
- Managed identity and audit support.
- Requires tenant/app registration planning.

## Migration Strategy

1. Keep `SecretRef` as the stable app-facing reference.
2. Add provider-specific SecretManager implementation behind the existing interface.
3. Store backend reference ids, not values.
4. Require production profile to reject env provider and legacy env fallback.
5. Migrate GitHub token, GitHub webhook secret, and LLM API key refs first.
6. Add rotation and revocation audit events.
7. Add integration tests behind explicit local/test backend gates.

## Lease TTL Strategy

- Short TTL for provider API credentials.
- Separate TTL for webhook verification secret access where applicable.
- No SecretLease issued to MCP tools in current v0.
- No runner/Local Agent secret injection until future production sandbox and consent model.

## Rotation Requirements

- Rotation owner and cadence.
- Dual-read or overlap strategy where required.
- Audit of rotation start/success/failure.
- Emergency revoke path.
- Rollback strategy without exposing previous values.

## Audit Requirements

- SecretRef lifecycle.
- Credential resolution request/allow/deny/missing/revoked.
- Backend access decision.
- Lease issue/revoke/expire.
- Rotation events.
- No raw secret, token, key, env value, or credential-cache content.

## Credential Cache Policy

Aichestra must not read provider-owned credential caches such as `~/.codex/auth.json`, `~/.claude`, Google credential caches, OS keychains, or vendor CLI session files. Local CLI providers remain `external_cli_session` with `credentialAccess=never_read_tokens`.

## Rollout Plan

1. Add backend interface implementation with tests using fake backend.
2. Add production profile validation rejecting env fallback.
3. Migrate non-production staging refs.
4. Run rotation drills.
5. Enable production read-only provider credentials.
6. Expand to scoped runner/Local Agent secret use only after sandbox and consent milestones.
