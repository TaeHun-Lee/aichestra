# Production Auth/RBAC v1 Planning Plan

Path choice: `docs/README.md` lists Auth/RBAC as a foundation topic through `docs/foundations/auth-rbac/`, so the pre-implementation plan belongs beside the canonical v0 foundation document. Cross-cutting production runbooks for IdP, tenant scope, service accounts, request context, and mock actor deprecation will live under `docs/roadmaps/auth-rbac-production/`, matching the existing production readiness roadmap organization.

No `design_docs/` directory is present.

## Current Auth/RBAC v0 Behavior

Production Auth/RBAC Planning v0 defines provider-neutral principals, actors, teams, roles, permissions, resource scopes, role bindings, service accounts, identity providers, auth contexts, request contexts, and auth audit events in `packages/auth`.

`MockAuthProvider` is the default provider. Future OIDC, SAML, SCIM, and service-account providers are disabled placeholders. `AuthorizationService` maps `AuthContext` into `PolicySubject`, checks RBAC, calls Policy-as-code when the action/resource is policy-mappable, and keeps policy denial authoritative.

v0 has no login, logout, session, token, password, OIDC, SAML, SCIM, SSO, production service-account credential issuance, external IdP call, or tenant isolation.

## Current Mock Actor Behavior

The default API and dashboard paths still resolve deterministic mock actors such as `mock-admin`, `user_demo_developer`, `user_demo_viewer`, `user_demo_reviewer`, `user_security_admin`, and `svc_runner`.

API request headers may provide `x-aichestra-actor-id` for local/test visibility. This is explicitly mock-only and not production authentication.

## Current Service-Specific Actor String Usage

Several modules still record actor strings directly for audit or metadata:

- Git and GitHub webhook services use service actors such as `github-webhook-receiver` and `github-sync-service`.
- LLM, Runner, Security, MCP, Local Agent Protocol, Registry, and Improvement paths still accept or synthesize service-specific actor ids for local/mock flows.
- Registry and governance mutation metadata still commonly carries explicit actor ids or mock defaults.
- Dashboard read models aggregate these records without production tenant filtering.

v1 planning should document these as propagation gaps, not refactor all service boundaries in one step.

## Current RequestContext/AuthContext Propagation Gaps

`RequestContextResolver` creates API, system, and test contexts, but most service methods do not yet require `RequestContext`. Many existing APIs pass actor ids, policy subjects, or system strings into service calls instead of carrying a full request context with request id, correlation id, principal id, teams, roles, scope, and auth mode.

Worker/background jobs, webhook processing, Local Agent Protocol dispatch, dashboard read models, and credential-resolution service paths need a production propagation contract before real auth can be implemented.

## Current PolicySubject Mapping

`AuthorizationService.toPolicySubject` maps actor id, principal id, actor kind, roles, teams, auth mode, service account id, mock actor marker, source, and authenticated state into `PolicySubject`.

Production v1 planning must add tenant/org/project/repo scoping expectations and preserve the rule that Auth/RBAC never bypasses Policy-as-code, SecretRef, sandbox, Git, LLM, runner, registry, MCP, Local Agent, Observability, or Dashboard safety gates.

## Current SecretRef Credential Resolution Actor Requirements

SecretRef-backed Provider Credentials v1 already requires Auth/RBAC plus Policy before internal credential resolution when `AuthorizationService` is available. Credential resolution audit is metadata-only and must not expose raw values.

Production v1 planning must define who can create SecretRefs, who can approve leases, which service accounts can resolve credentials, how production env fallback is denied, and how credential audit metadata remains scoped.

## Current Git/LLM/MCP/Local Agent Actor Attribution Requirements

- Real Git Adapter v2 needs trustworthy actors before broader GitHub App, webhook, branch, PR, and changed-file operations can be production-safe.
- LLM Gateway v2 needs trustworthy actor, tenant, team, model, and budget attribution before broader provider routing.
- MCP Gateway v0 needs user/service actor attribution before real tools or high-risk tools are enabled.
- Local Agent Protocol v1 needs user, device/host, consent, and system actor attribution before a real daemon or local CLI transport exists.

## Production Identity Provider Options

v1 planning will compare OIDC, SAML, SCIM, Microsoft Entra ID, Okta, Auth0, Google Workspace, GitHub Enterprise identity mapping, custom enterprise IdPs, and MockAuthProvider as local-only fallback.

The preferred baseline is expected to be OIDC for interactive SSO plus SCIM for directory/team lifecycle when the customer environment supports it. SAML remains necessary for some enterprise environments. MockAuthProvider is not production auth.

## Tenant/Team/Repo/Project Scope Requirements

Production authorization must include tenant/workspace/project/team/repo scope in:

- policy subjects and resources;
- repository queries;
- SecretRef scopes and lease purposes;
- Git provider/repo allowlists;
- LLM provider/model/virtual-key/budget scopes;
- MCP server/tool scopes;
- Local Agent user/host scopes;
- dashboard and audit query filters.

v1 planning models these requirements only. Multi-tenancy is not implemented.

## Service Account Requirements

Service accounts must be first-class principals with narrow role bindings, allowed scopes, forbidden actions, credential strategy, rotation strategy, and audit requirements. v1 planning covers worker, Git webhook, Git provider, LLM gateway, MCP gateway, Local Agent Protocol, deployment, and observability export service-account categories.

v1 does not issue service-account credentials, API keys, JWTs, sessions, or cloud tokens.

## Audit Attribution Requirements

Production audit records must preserve request id, correlation id, actor id, principal id, service account id, auth mode, teams, source, tenant/scope metadata where available, policy decision id, and result. Audit metadata must never include tokens, cookies, passwords, session ids, raw SSO/OIDC/SAML assertions, provider credentials, or credential-cache contents.

## What This Task Implements

- Production Auth/RBAC v1 planning/readiness models in the existing deployment-readiness package.
- Deterministic provider option, migration phase, readiness check, production risk, tenant boundary, service-account, and summary read models.
- Read-only `/readiness/auth/*` endpoints.
- Safe `/health` auth readiness metadata.
- Dashboard Auth/RBAC Production Readiness panel.
- Production IdP options, RBAC permission matrix, tenant/scope, service-account/system actor, request context propagation, mock actor deprecation, and v1 roadmap docs.
- Cross-document updates for production readiness, policy, SecretRef, observability, runtime inventory, environment gates, repository inventory, README, AGENTS, and phase audit.
- Deterministic tests for models, APIs, dashboard, health, and no-token/no-session exposure.

## Out Of Scope

- Real OIDC, SAML, SCIM, SSO, login/logout, password login, sessions, JWT issuance, API-key issuance, provider credential issuance, IdP calls, directory sync, external auth SDKs, cloud identity exchange, or token validation.
- Reading credential caches or raw identity assertions.
- Implementing multi-tenancy, production auth middleware, durable auth repositories, production service-account credentials, or break-glass operations.
- Weakening Policy-as-code, SecretRef, Git, LLM, MCP, Runner, Registry, Local Agent, Observability, Dashboard, or Secrets/Sandbox gates.
