# OIDC Provider Skeleton Hardening v1 Plan

Status: v1_planned

## Current Production Auth Provider Skeleton v1 behavior

- `MockAuthProvider` remains the only active runtime provider.
- Future providers, including `oidc_future`, are exposed as disabled/readiness-only metadata.
- Selecting a future provider via `AICHESTRA_AUTH_PROVIDER` changes safe metadata but does not enable production auth.
- `AICHESTRA_ENABLE_PRODUCTION_AUTH` and `AICHESTRA_REQUIRE_AUTH_FOR_API` are treated as requested booleans only; runtime values remain false.
- No raw env values, credentials, tokens, Authorization headers, cookies, session IDs, JWTs, or service-account credentials are returned.

## Current MockAuthProvider behavior

- Resolves deterministic mock actors from the in-memory auth repository.
- Provides mock roles, teams, permissions, tenant scopes, and policy subject metadata.
- Does not validate real external identity tokens.
- Remains the default runtime provider for API, dashboard, readiness, and policy checks.

## Current API AuthContext Middleware behavior

- Builds `AuthContext` and `RequestContext` with mock auth defaults.
- Stores only safe request metadata such as request ID, correlation ID, source, selected future provider status, and disabled production-auth flags.
- Does not store raw Authorization headers, cookies, tokens, session IDs, or credential material.

## Current RequestContext/AuthContext/PolicySubject metadata

- Contains mock actor and scope attribution.
- Contains production-auth metadata as status booleans: selected provider, active provider, production auth false, token validation false, session boundary false.
- Policy subjects remain generated from mock-safe actor/scope data and do not include real token claims.

## Proposed OIDC config shape

`OidcProviderConfig` will expose booleans/status only:

- `providerKind: oidc_future`
- `status: disabled | not_configured | future | blocked`
- issuer/audience/client ID/JWKS/discovery/scopes/claims/tenant/group configured booleans
- `clientSecretConfigured:false`
- `tokenValidationEnabled:false`
- `externalCallsEnabled:false`
- `productionReady:false`
- metadata with redaction and safety guarantees only

## Proposed disabled verifier boundary

`OidcTokenVerifier` will define:

- `getProviderKind()`
- `getStatus()`
- `validateIdToken(input)`
- `validateAccessToken(input)`
- `getReadiness()`
- `listRequiredConfig()`

`DisabledOidcTokenVerifier` will fail closed, never echo input, never fetch discovery/JWKS, never perform JWT validation, and never issue sessions/JWTs/API keys.

## Proposed claims mapping plan

Claims mapping is metadata-only and planned/future:

- subject: `sub`
- email: `email`
- display name: `name`
- groups: configured boolean only or future `groups`
- roles: `roles`
- tenant/team/project/repo/provider scopes: configured boolean only/future claims
- service account: future `client_id`/`service_account_id`

No real claims are parsed in v1.

## Proposed session/token boundary interaction

OIDC v1 does not create sessions or validate tokens. Existing session/token boundary plans remain future-only with `tokenIssued:false` and `validationEnabled:false`. OIDC readiness explicitly reports no token, no session, no cookie, no JWT, and no API key issuance.

## Proposed health/readiness/dashboard metadata

Add read-only OIDC readiness surfaces:

- `/readiness/auth-providers/oidc/config`
- `/readiness/auth-providers/oidc/discovery`
- `/readiness/auth-providers/oidc/jwks`
- `/readiness/auth-providers/oidc/claims-mapping`
- `/readiness/auth-providers/oidc/token-boundary`
- `/readiness/auth-providers/oidc/summary`

`/auth/config`, `/health`, dashboard auth-provider data, and dashboard HTML will show safe OIDC status booleans only.

## Safety constraints

- No real OIDC login, callback, authorization code flow, PKCE, discovery fetch, JWKS fetch, JWT validation, access-token validation, ID-token validation, session cookie parsing, JWT issuance, session issuance, API-key issuance, service-account credential issuance, external IdP calls, external service calls, vendor CLI, credential cache reads, raw env values, raw headers, raw cookies, or raw tokens.
- MockAuthProvider remains default.
- Selecting OIDC without implementation fails closed.

## What this task implements

- OIDC config/readiness DTOs.
- Disabled verifier boundary.
- Read-only readiness APIs.
- Safe health/auth-config/dashboard/read-model metadata.
- Documentation and deterministic tests.
- Safe integration scan classification.

## Out of scope

- Real OIDC/OAuth login.
- Real callbacks or PKCE.
- Discovery/JWKS network fetches.
- Cryptographic JWT validation.
- Session/JWT/API-key issuance.
- External identity-provider calls.

## Chosen docs path

The current docs organization keeps Auth/RBAC foundations under `docs/foundations/auth-rbac/`, so this plan is placed at `docs/foundations/auth-rbac/oidc-provider-skeleton-hardening-v1-plan.md`.
