# Lease TTL and Rotation Strategy v0

Status: planning/readiness only. No scheduled rotation jobs or backend writes are implemented.

## Recommended TTL by secret kind

| Secret kind | Max TTL | Renewable | Approval | Notes |
|---|---:|---|---|---|
| `github_token` | 3600 seconds | no | yes | Interim only; future GitHub App installation token path preferred. |
| `github_webhook_secret` | 300 seconds | no | service account only | Used only for signature verification. |
| `llm_api_key` | 1800 seconds | no | yes | Requires budget, provider/model allowlist, Auth/RBAC, and Policy checks. |
| `provider_api_key` | 1800 seconds | no | yes | Future provider adapters only. |
| `future_mcp_tool_secret` | 900 seconds | no | yes | Requires real MCP transport and high-risk tool review. |
| `future_local_agent_pairing_secret` | 600 seconds | no | yes | Requires real Local Agent daemon and consent. |
| `future_service_account_signing_key` | 300 seconds | no | yes | Requires production auth/token issuance design. |

## Rotation triggers

- Scheduled interval reached.
- Credential suspected leaked.
- Provider access scope changes.
- Actor/service account ownership changes.
- Backend policy or tenant boundary changes.
- Provider reports revocation or compromise.

## Revocation triggers

- SecretRef disabled/revoked by security admin.
- Provider integration disabled.
- Policy denies the purpose.
- Backend audit anomaly.
- Incident response requires emergency stop.

## Emergency rotation procedure

1. Disable affected provider gate or route traffic to mock-only mode.
2. Mark SecretRef `disabled` or `revoked`.
3. Rotate value in the backend outside Aichestra.
4. Update SecretRef backend metadata/version only.
5. Run validation checks without printing values.
6. Re-enable only the minimum required gate.
7. Record metadata-only audit events.

## Audit events

Planned future events:

- `secret_rotation_requested_future`
- `secret_rotation_completed_future`
- `secret_backend_unavailable_future`
- `env_fallback_used_warning`
- `env_fallback_denied_in_production`
- `secret_ref_migrated_future`

No event may contain a secret value, token, private key, credential cache content, env value, or raw payload.

## Stale credential detection

Future readiness should flag:

- active SecretRefs with stale backend version metadata;
- rotation target interval exceeded;
- disabled/revoked refs still referenced by provider gates;
- env fallback used in integration;
- any env fallback attempted in production.

## Dependency impact analysis

Each rotation plan must identify:

- provider adapter and operation gates affected;
- Auth/RBAC roles and service accounts involved;
- Policy rules required;
- audit and dashboard fields expected;
- rollback path to disabled/mock behavior.

## Rollout and rollback

Rollout is staged by profile: local, integration, staging, production. Production rollback disables provider operations rather than returning to env fallback.

## Validation checks

- No secret or env values exposed.
- No credential cache reads.
- Disabled/revoked refs fail closed.
- Dashboard and `/health` expose booleans/counts/status only.
- Audit metadata has request/correlation/task/provider context where available.
