# Production Auth/RBAC Implementation Plan v1

Status: `implementation_plan_recorded`
Scope: Phase 5 production Auth/RBAC implementation planning only
Production auth implemented: no
External IdP calls enabled: no
Sessions or tokens issued: no

## Purpose

This plan defines the implementation path for production Auth/RBAC after the existing v1 readiness planning milestone.

It does not implement real auth, call identity providers, validate live OIDC/SAML/SCIM payloads, issue sessions, JWTs, cookies, passwords, API keys, or service-account credentials, read credential caches, expose secrets, expose env values, or weaken Policy-as-code, SecretRef, sandbox, Git, LLM, MCP, Runner, Registry, Local Agent, Dashboard, Observability, or deployment safety gates.

## Current Boundary Inventory

| Boundary | Current state | Implementation implication |
| --- | --- | --- |
| `packages/auth` | Provider-neutral principals, actors, teams, roles, permissions, scopes, role bindings, service accounts, identity providers, `MockAuthProvider`, `AuthorizationService`, and `RequestContextResolver`. | Keep as the core auth boundary. Add real providers behind `AuthProvider`, not in API handlers. |
| `packages/policy` | `PolicySubject` carries actor, principal, roles, teams, auth mode, service account id, mock marker, and metadata. Static policy remains authoritative. | Add tenant/workspace/project/repo context before production enablement. Auth allow must not override policy deny. |
| `packages/security` | SecretRef credential resolution can require Auth/RBAC and Policy before internal env or Vault-backed credential resolution. | Production auth credentials must be SecretRef-backed. No raw IdP client secrets or tokens in auth models. |
| `packages/registry` | Registry mutation authorization exists through `RegistryMutationAuthorizer`, mock roles, and policy-backed decisions. | Map production roles to registry permissions without bypassing registry approval/eval/checksum gates. |
| `packages/git-adapter` | Git service still uses configured actor strings in places, with policy gates around remote operations and GitHub App token handles. | Replace broad service actor strings with scoped request or service-account contexts before production Git use. |
| `packages/llm-gateway` | LLM Gateway can accept `AuthContext`, otherwise falls back to mock/default actors for some flows. Policy, budget, and credential gates exist. | Require trustworthy actor, tenant, model, budget, and service-account attribution before broader provider routing. |
| `packages/mcp-gateway` | MCP list/invoke paths use `AuthorizationService` and `AuthContext`; real transport remains disabled. | Preserve Auth/RBAC plus Policy before any real MCP transport or high-risk tool path. |
| Local Agent Protocol | Uses policy gates and actor ids, but not full production identity or tenant/device trust. | Bind user, host, consent, channel, and invocation to tenant-scoped identities before real daemon work. |
| Observability | Normalizes auth, policy, credential, Git, LLM, MCP, Local Agent, registry, and security audit sources with sanitization. | Add production auth audit events and tenant-scoped audit filters before export or production traffic. |
| API/dashboard | `/auth/*` and `/readiness/auth/*` are mock/read-only planning surfaces. | Real auth middleware must resolve context before protected service calls; dashboard must stay tenant-scoped and sanitized. |

## Production Provider Selection

The implementation path should use provider-neutral adapters with this default selection:

1. OIDC for interactive SSO when the deployment's enterprise IdP supports stable claims and JWKS rotation.
2. SAML as a first-class alternative for enterprises that require SAML.
3. SCIM or equivalent directory lifecycle sync for users, teams, deprovisioning, and group-to-role mapping.
4. Internal service-account principals for worker, Git webhook/provider, LLM Gateway, MCP Gateway, Local Agent Protocol, deployment, and observability export.

No vendor is selected in this plan. Microsoft Entra ID, Okta, Auth0, Google Workspace, GitHub Enterprise identity mapping, and custom IdPs remain future configuration choices behind the provider-neutral interfaces.

See:

- `docs/roadmaps/auth-rbac-production/provider-selection-v1.md`
- `docs/roadmaps/auth-rbac-production/idp-options-v1.md`

## Required Implementation Documents

| Document | Purpose |
| --- | --- |
| `provider-selection-v1.md` | Records the production provider selection model, adapter order, and selection criteria. |
| `tenant-scope-model-v1.md` | Defines tenant/workspace/project/team/repo scope requirements. |
| `service-account-system-actor-v1.md` | Defines scoped service-account and system actor categories. |
| `session-token-boundary-v1.md` | Defines future session, token validation, cookie, JWT, and API-key boundaries without issuing credentials. |
| `request-context-propagation-v1.md` | Defines request, correlation, actor, principal, and scope propagation. |
| `mock-actor-deprecation-v1.md` | Defines when mock actors must be blocked outside local/test profiles. |
| `security-audit-requirements-v1.md` | Defines no-secret/no-token, audit, redaction, and observability requirements. |
| `implementation-phases-v1.md` | Defines the safe implementation order and stop gates. |
| `blockers-risks-v1.md` | Tracks current blockers, risks, and required mitigations. |

## Implementation Principles

- Real provider behavior must stay behind `AuthProvider` and provider-specific adapter boundaries.
- API handlers must not parse raw IdP credentials directly.
- Session, cookie, token, assertion, SCIM, and service-account credential values must never be stored in source, audit, readiness, dashboard, health, or logs.
- Request context must be resolved before protected operations and carried into downstream service calls.
- Policy-as-code remains authoritative after RBAC allow.
- SecretRef credential resolution remains the only path for IdP client credentials and future signing keys.
- Tenant/workspace/project/repo scope must be part of authorization, repository filtering, audit queries, dashboard read models, SecretRefs, provider allowlists, and Local Agent consent.
- Mock actor behavior remains local/test only and must fail closed for production profile before production auth is considered ready.

## Out Of Scope

- Real OIDC/SAML/SCIM adapter implementation.
- Login/logout/callback endpoints.
- Session persistence.
- JWT issuance or validation.
- Password auth.
- API key issuance.
- Service-account credential issuance.
- External IdP calls.
- Reading vendor or OS credential caches.
- Tenant isolation enforcement in repositories.
- Break-glass execution.
- Production auth enablement.

## Acceptance Criteria For A Future Implementation PR

A future implementation PR may start only after this plan is accepted and must prove:

- no real IdP call runs by default;
- all live provider behavior is behind explicit gates and adapters;
- request context contains actor, principal, source, request id, correlation id, and future scope metadata;
- policy denial remains authoritative;
- no secret, env value, token, cookie, session id, password, raw assertion, provider credential, or credential-cache path is exposed;
- mock actors remain available for local/test but are rejected for production profile;
- deterministic tests cover allow, deny, missing context, scope mismatch, redaction, and audit behavior.

## Current Recommendation

Next task: run a Production Auth/RBAC Boundary Inventory Audit v1 against API, worker, Git, LLM, MCP, Registry, Security, Local Agent, Dashboard, and Observability service boundaries, then use `implementation-phases-v1.md` to select the first implementation slice.
