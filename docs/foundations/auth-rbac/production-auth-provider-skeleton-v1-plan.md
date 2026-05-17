# Production Auth Provider Skeleton v1 Plan

## Status

Planning/readiness task for `Production Auth Provider Skeleton: v1_implemented`.

This plan follows the current docs organization under `docs/foundations/auth-rbac/` because the implementation is an Auth/RBAC foundation boundary. The related production roadmap remains under `docs/roadmaps/auth-rbac-production/`.

## Current State

- Production Auth/RBAC v1 Planning is implemented as read-only readiness metadata. It compares IdP options, role/permission plans, service-account plans, tenant boundaries, session/token boundaries, risks, and blockers.
- `MockAuthProvider` is the default runtime provider and remains the only provider used by default API requests and tests.
- API AuthContext Middleware Skeleton v1 resolves one cached mock-first `RequestContext` per API request, accepts only safe request/correlation/mock actor headers, and does not treat `Authorization` or cookies as authentication.
- RequestContext Propagation v1 carries request id, correlation id, source, mock actor, service-account metadata, and safe tenant/repo/provider scope metadata through selected API/service/audit boundaries.
- Service Account Actor Boundary v1 provides static mock service-account attribution and does not issue credentials, JWTs, API keys, sessions, or tokens.
- Tenant/Repo/Provider Scope Model v1 and Tenant Scope Enforcement v1 are metadata/readiness-only. Tenant enforcement remains partial and representative, not production isolation.

## Proposed Design

Production Auth Provider Skeleton v1 adds an explicit disabled provider boundary without authenticating real users.

Core pieces:

- `ProductionAuthProviderConfig`, `ProductionAuthProviderReadiness`, `SessionTokenBoundaryPlan`, and `IdentityMappingPlan` read-only models.
- Disabled provider skeletons for OIDC, SAML, SCIM, Microsoft Entra, Okta, Auth0, Google Workspace, GitHub Enterprise, and custom providers.
- `ProductionAuthProviderRegistry` for provider selection/readiness metadata while `MockAuthProvider` remains the active runtime provider.
- Safe metadata on `AuthContext`, `RequestContext`, `PolicySubject`, `/auth/config`, `/auth/me`, `/health`, readiness APIs, and dashboard panels.

## Provider Selection Strategy

Supported future provider selection names:

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

Config gates are names/status only:

- `AICHESTRA_AUTH_PROVIDER`
- `AICHESTRA_ENABLE_PRODUCTION_AUTH`
- `AICHESTRA_REQUIRE_AUTH_FOR_API`
- `AICHESTRA_AUTH_OIDC_ISSUER`
- `AICHESTRA_AUTH_OIDC_AUDIENCE`
- `AICHESTRA_AUTH_OIDC_JWKS_URI`
- `AICHESTRA_AUTH_SAML_METADATA_URL`
- `AICHESTRA_AUTH_SCIM_ENDPOINT`

Future providers selected through env metadata are reported as disabled, missing config, or blocked. They do not authenticate and do not become active.

## OIDC/SAML/SCIM Boundaries

Disabled future providers expose:

- `getProviderKind()`
- `getStatus()`
- `resolveAuthContext()` closed behavior
- `validateConfig()`
- `listRequiredConfig()`

They never validate tokens, parse assertions, issue sessions, call IdPs, sync SCIM directories, provision users, or store raw headers/cookies/tokens.

## Session/Token Boundary Planning

Session and token boundary models remain future metadata:

- cookie sessions
- bearer JWT validation
- API keys
- service-account tokens
- Local Agent pairing tokens

All have `tokenIssued: false` and `validationEnabled: false`.

## Health, Dashboard, And Readiness

Add read-only surfaces:

- `GET /readiness/auth-providers/config`
- `GET /readiness/auth-providers/options`
- `GET /readiness/auth-providers/session-boundary`
- `GET /readiness/auth-providers/identity-mapping`
- `GET /readiness/auth-providers/summary`
- `/dashboard/auth-providers`
- `/health` auth provider skeleton metadata

Responses expose booleans, counts, statuses, and env var names only. They never expose env values, tokens, cookies, session ids, raw assertions, client secrets, or provider credentials.

## Safety Constraints

- No real OIDC, SAML, SCIM, SSO, login/logout, sessions, JWTs, API keys, or service-account credentials.
- No real token validation or session cookie parsing.
- No external identity-provider calls.
- No credential-cache reads.
- No production auth enablement.
- No policy, SecretRef, Git, LLM, MCP, runner, Local Agent, Registry, Governance, Dashboard, Observability, tenant scope, staging, CI/CD, or sandbox gate weakening.

## This Task Implements

- Disabled production auth provider skeletons.
- Provider selection/readiness boundary.
- Future session/token and identity mapping metadata.
- Safe RequestContext/AuthContext/PolicySubject metadata.
- Read-only readiness APIs and dashboard panel.
- Health and `/auth/config` metadata.
- Deterministic tests.
- Docs and status updates.

## Out Of Scope

- Real authentication.
- OIDC/SAML/SCIM protocol implementation.
- JWT/session/API-key/service-account credential issuance.
- Production tenant isolation.
- Durable production auth repositories.
- External IdP calls or provisioning.
- Production-ready auth claims.
