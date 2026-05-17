# OIDC Provider Skeleton Hardening v1

Status: v1_implemented

## What v1 implements

OIDC Provider Skeleton Hardening v1 adds a disabled, read-only boundary for a future OIDC provider without implementing authentication. The implemented surface is metadata-only:

- OIDC config readiness shape for configured/not-configured booleans only.
- Disabled OIDC verifier boundary that always fails closed.
- Discovery and JWKS readiness DTOs with `discoveryFetchEnabled:false`, `discoveryFetched:false`, `jwksFetchEnabled:false`, and `jwksFetched:false`.
- Future-only ID/access token validation result DTOs.
- Claims mapping plan for subject, email, display name, groups, roles, tenant, team, project, repo scope, provider scope, and service-account mapping.
- Read-only readiness API metadata for OIDC config, discovery, JWKS, claims mapping, token boundary, and summary.

## What v1 does not implement

- No real OIDC login, callback handling, OAuth authorization code flow, or PKCE.
- No discovery fetch, JWKS fetch, JWT parsing, signature validation, or token validation.
- No session cookies, JWT/session/API-key/service-account credential issuance, or raw token storage.
- No calls to external IdPs or auth systems.
- No production-auth enablement.

## OIDC config shape

`OidcProviderConfig` records only readiness booleans:

- `providerKind: oidc_future`
- `status: disabled | not_configured | future | blocked`
- `issuerConfigured`, `audienceConfigured`, `clientIdConfigured`, `jwksUriConfigured`, `discoveryUrlConfigured`, `scopesConfigured`, `claimsMappingConfigured`, `tenantMappingConfigured`, `groupMappingConfigured`
- `clientSecretConfigured:false`
- `tokenValidationEnabled:false`
- `externalCallsEnabled:false`
- `productionReady:false`

Environment values are never returned. Client-secret support is intentionally absent in v1; any future secret must be modeled as SecretRef metadata only.

## Disabled verifier boundary

`DisabledOidcTokenVerifier` implements the future verifier interface:

- `getProviderKind()` returns `oidc_future`.
- `getStatus()` returns `disabled`.
- `validateIdToken()` and `validateAccessToken()` return sanitized disabled/not-implemented results.
- `getReadiness()` returns config/discovery/JWKS/claims/token-boundary metadata.
- `listRequiredConfig()` lists placeholder variable names, not values.

The verifier does not perform cryptography, parse claims, fetch JWKS, call discovery, create sessions, or echo token input.

## Discovery/JWKS readiness

Discovery and JWKS metadata are readiness-only:

- Discovery endpoint booleans show whether placeholder config exists.
- `discoveryFetchEnabled:false`, `discoveryFetched:false`.
- JWKS readiness shows only whether a JWKS URI placeholder exists.
- `jwksFetchEnabled:false`, `jwksFetched:false`.
- Key rotation is `future`/`not_configured` metadata only.

## Claims mapping plan

The claims plan is future-only and does not parse real claims:

- Subject: `sub`
- Email: `email`
- Display name: `name`
- Groups: configurable group-claim placeholder, default `groups`
- Roles: `roles`
- Tenant/team/project: configurable tenant placeholder plus `team` and `project`
- Repo/provider scope: `repo_scope` and `provider_scope`
- Service account: `service_account`

Risks include issuer+subject stability, group over-granting, tenant mismatch, repo/provider scope drift, and service-account impersonation ambiguity.

## Session/token boundary interaction

OIDC v1 keeps the existing session/token boundary guarantees:

- `tokenValidationEnabled:false`
- no ID-token validation
- no access-token validation
- no signature/issuer/audience/expiry/nonce validation
- no session issuance
- no JWT issuance
- no cookie/session/raw Authorization-header storage

## API middleware integration

AuthContext and RequestContext remain safe summaries. Future OIDC metadata may include provider kind/status and readiness statuses, but must not include raw claims, Authorization headers, cookies, tokens, sessions, or env values. Mock auth remains the default runtime path.

## Health/readiness/dashboard surfaces

Readiness APIs expose safe OIDC metadata at:

- `/readiness/auth-providers/oidc/config`
- `/readiness/auth-providers/oidc/discovery`
- `/readiness/auth-providers/oidc/jwks`
- `/readiness/auth-providers/oidc/claims-mapping`
- `/readiness/auth-providers/oidc/token-boundary`
- `/readiness/auth-providers/oidc/summary`

Health and dashboard/read-model planning continue to show production auth as false, token validation as false, external calls as false, and no-token/no-session/no-secret guarantees.

## No-token/no-session/no-secret guarantees

- No raw token values are stored or returned.
- No Authorization headers are stored or returned.
- No cookies or session IDs are stored or returned.
- No env values or secrets are returned.
- Client secrets are not supported in v1.

## Test strategy

Deterministic tests cover disabled defaults, selected OIDC future fail-closed behavior, boolean-only config readiness, disabled verifier output sanitization, OIDC readiness endpoints, health/auth config safe metadata, dashboard panel safety, and policy regression.

## Known limitations

- OIDC auth is not implemented.
- Discovery/JWKS/token validation are intentionally disabled.
- Claims mapping is a plan, not runtime mapping.
- Production auth remains disabled.

## Recommended next task

OIDC Provider Integration-Test Profile v1, or Policy Runtime Shadow Evaluator Skeleton v1.
