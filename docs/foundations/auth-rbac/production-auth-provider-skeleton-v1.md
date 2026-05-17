# Production Auth Provider Skeleton v1

## Status

Production Auth Provider Skeleton: `v1_implemented`.

Production auth is still not implemented or production-ready. `MockAuthProvider` remains the active runtime provider.

## What v1 Implements

- Disabled-by-default OIDC, SAML, SCIM, Microsoft Entra, Okta, Auth0, Google Workspace, GitHub Enterprise, and custom auth provider skeletons.
- `ProductionAuthProviderRegistry` for deterministic provider selection/readiness metadata.
- Read-only models for provider config, provider readiness, session/token boundaries, and identity mapping plans.
- Safe metadata on AuthContext, RequestContext, PolicySubject, `/auth/config`, `/auth/me`, `/health`, readiness APIs, and dashboard read models.
- Read-only readiness APIs:
  - `GET /readiness/auth-providers/config`
  - `GET /readiness/auth-providers/options`
  - `GET /readiness/auth-providers/session-boundary`
  - `GET /readiness/auth-providers/identity-mapping`
  - `GET /readiness/auth-providers/summary`
- `/dashboard/auth-providers` and dashboard rendering for the skeleton panel.
- Deterministic tests for disabled providers, provider registry behavior, APIs, middleware safety, dashboard output, and policy-deny regression.

## What v1 Does Not Implement

v1 does not implement OIDC, SAML, SCIM, SSO, login, logout, password auth, production sessions, JWT issuance, API keys, service-account credentials, token validation, session cookie parsing, external IdP calls, IdP provisioning, credential-cache reads, or production tenant isolation.

## Provider Options

Supported provider selection metadata:

- `mock`
- `oidc_future`
- `saml_future`
- `scim_future`
- `microsoft_entra_future`
- `okta_future`
- `auth0_future`
- `google_workspace_future`
- `github_enterprise_future`
- `custom_future`

Future providers are disabled/not implemented. Selecting one through `AICHESTRA_AUTH_PROVIDER` reports blocked readiness while runtime authentication still uses `MockAuthProvider`.

## Selection Boundary

Config gates are treated as metadata:

- `AICHESTRA_AUTH_PROVIDER`
- `AICHESTRA_ENABLE_PRODUCTION_AUTH`
- `AICHESTRA_REQUIRE_AUTH_FOR_API`
- `AICHESTRA_AUTH_OIDC_ISSUER`
- `AICHESTRA_AUTH_OIDC_AUDIENCE`
- `AICHESTRA_AUTH_OIDC_JWKS_URI`
- `AICHESTRA_AUTH_SAML_METADATA_URL`
- `AICHESTRA_AUTH_SCIM_ENDPOINT`

Readiness may expose configured booleans and missing config names. It never returns env values.

## Session And Token Boundary

Session/token boundary plans cover cookie sessions, bearer JWT validation, API keys, service-account tokens, and Local Agent pairing tokens.

All v1 plans have:

- `tokenIssued: false`
- `validationEnabled: false`
- production readiness `false`

## Identity Mapping

Identity mapping plans define future mappings from subject claims, groups, role claims, tenant claims, repo claims, and service-account ids into the existing Auth/RBAC and scope models.

No real claims are parsed in v1.

## Middleware And Context Metadata

API middleware remains mock-first and ignores real auth material. Safe metadata can include:

- `authProviderKind`
- `authProviderStatus`
- `productionAuthEnabled: false`
- `tokenValidationEnabled: false`
- `sessionBoundaryStatus`
- `identityMappingStatus`

Authorization headers, cookies, token values, session ids, and raw identity claims are not stored.

## Audit And Observability

Runtime v1 may record safe metadata-only events such as:

- `production_auth_provider_config_checked`
- `production_auth_provider_blocked`
- `mock_auth_provider_used`

Planned future events remain documentation-only:

- `production_auth_provider_selected_future`
- `auth_token_validation_attempt_future`
- `auth_session_created_future`
- `auth_session_revoked_future`
- `scim_sync_started_future`
- `identity_mapping_failed_future`

No event may contain tokens, cookies, session ids, passwords, raw assertions, client secrets, provider credentials, or env values.

## Safety Guarantees

- Mock provider remains active.
- Future providers fail closed.
- Production auth enabled is always `false`.
- Token validation is always `false`.
- Session boundary is disabled/future only.
- External calls are always `false`.
- Policy-as-code remains authoritative.
- No secrets or env values are exposed.

## Known Limitations

- No real production AuthProvider exists.
- No durable production identity store exists.
- No SCIM sync or deprovisioning exists.
- Tenant scope enforcement remains partial representative metadata.
- Dashboard/readiness filtering remains future.
- Break-glass and production session lifecycle remain future work.

## Recommended Next Task

OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.
