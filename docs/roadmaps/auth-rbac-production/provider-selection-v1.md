# Production Auth Provider Selection v1

Status: `selection_model_recorded`
Scope: provider selection planning only
Production auth implemented: no
External IdP calls enabled: no

## Purpose

This document records the production auth provider selection model for a future implementation task.

It does not configure an IdP, call OIDC/SAML/SCIM providers, exchange codes, validate assertions, read client secrets, expose env values, issue sessions, issue JWTs, or issue service-account credentials.

## Recommended Provider Stack

Default production stack:

1. `oidc_interactive_sso`
   - Preferred for interactive users when the enterprise IdP supports stable issuer metadata, JWKS rotation, and required claims.
2. `saml_interactive_sso`
   - Supported as an equal production path when SAML is the enterprise requirement.
3. `scim_directory_lifecycle`
   - Required for enterprise-grade user, team, group, and deprovisioning lifecycle when available.
4. `internal_service_account_principals`
   - Required for worker, webhook, provider, LLM, MCP, Local Agent, deployment, and observability service identities.

No single vendor is selected. Vendor-specific adapters must remain optional and gated.

## Selection Criteria

| Criterion | OIDC | SAML | SCIM | Service accounts |
| --- | --- | --- | --- | --- |
| Interactive sign-in | yes | yes | no | no |
| Directory lifecycle | no | no | yes | no |
| Group/team mapping | claim-based or directory-backed | assertion-based or directory-backed | authoritative sync | scoped role binding |
| Deprovisioning | session expiry plus directory signal | session expiry plus directory signal | primary | revoke credential/role binding |
| Credential storage | SecretRef client credentials | SecretRef cert/client metadata | SecretRef bearer/client credentials | SecretRef-backed future credential |
| Runtime default | disabled | disabled | disabled | metadata only |
| Production readiness dependency | high | high | high | high |

## Provider Adapter Contract

Future provider adapters must expose only sanitized metadata outside the adapter:

- provider id and kind;
- configured booleans;
- issuer or metadata status, not secret values;
- claim mapping status;
- key/cert rotation status;
- SCIM sync status;
- error codes without raw assertions or tokens;
- audit event ids.

Adapters must not expose:

- client secrets;
- authorization codes;
- access tokens;
- refresh tokens;
- ID tokens;
- SAML assertions;
- SCIM bearer tokens;
- cookies;
- passwords;
- private keys;
- raw user profile payloads beyond sanitized mapped claims.

## Claim And Group Mapping

Required mapped fields:

- stable external subject id;
- display name;
- email or enterprise username when available and allowed;
- group/team identifiers;
- auth provider id;
- tenant or organization hint when available;
- assurance or auth method metadata only when sanitized.

Group-to-role mapping must be explicit and reviewed. No IdP group should grant platform admin, security admin, or break-glass rights by default.

## Selection Decision Record

| Field | Current value |
| --- | --- |
| Primary interactive provider path | `oidc_or_saml_required_by_environment` |
| Directory lifecycle path | `scim_or_equivalent_required_for_enterprise_deprovisioning` |
| Service account path | `internal_scoped_principals_metadata_only_until_credential_task` |
| Mock provider production status | `local_test_only` |
| External calls enabled | false |
| Credentials issued | false |
| Production ready | false |

## Future Gate Requirements

Before any real adapter is enabled:

- explicit provider kind selected;
- tenant allowlist or deployment tenant configured;
- SecretRef-backed client credentials or cert metadata configured;
- redirect/callback or assertion consumer endpoint reviewed;
- token/assertion redaction tests pass;
- request context propagation tests pass;
- tenant scope tests pass;
- policy denial tests pass;
- audit no-secret/no-token tests pass.
