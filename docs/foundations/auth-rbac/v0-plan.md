# Production Auth/RBAC Planning v0 Plan

Path choice: `docs/README.md` lists auth/RBAC as a foundation topic through `docs/foundations/auth-rbac-readiness.md`, so this plan uses `docs/foundations/auth-rbac/` instead of a feature folder. No `design_docs/` directory is present.

## Current Mock Actor Behavior

Aichestra currently uses deterministic mock or system actor ids:

- Registry mutation defaults to `mock-admin` through `RegistryService` and `RegistryMutationAuthorizer`.
- Governance decisions and eval attachments default to mock actors when no actor is supplied.
- Git, LLM, Runner, Provider, Secrets/Sandbox, Local Agent Protocol, and webhook services record actor ids as string metadata.
- API routes accept optional actor ids in request bodies or query parameters, but there is no request authentication.
- Dashboard read models expose audit/read-model data without actor-scoped filtering.

This is acceptable for the mock-first scaffold, but it is not production authentication or authorization.

## Current Policy Subject Handling

Policy-as-code v0 already evaluates `PolicySubject`, `PolicyAction`, `PolicyResource`, and `PolicyContext`. `PolicySubject` currently contains actor id, actor kind, roles, and optional teams. Service boundaries construct policy subjects locally with ad hoc defaults such as `mock-git-actor`, `mock-llm-actor`, `mock-runner-actor`, `mock-security-actor`, and `mock-local-agent-protocol`.

Production Auth/RBAC v0 should enrich that subject shape with principal id, auth mode, service-account metadata, and explicit mock actor markers while preserving existing deny-by-default policy behavior.

## Current Registry Mutation Auth Behavior

Registry v3 has a provider-neutral `RegistryMutationAuthorizer` with deterministic mock roles:

- `registry_viewer`
- `registry_editor`
- `registry_reviewer`
- `registry_admin`
- `system`

`PolicyBackedRegistryMutationAuthorizer` wraps the mock authorizer and then evaluates policy. This remains the right shape. Production Auth/RBAC v0 should map the resolved `AuthContext` to the existing registry actor shape when practical, not replace registry gates.

## Operations Needing Actor Attribution

Actor context is needed before broader real integrations for:

- Task creation and task run triggering.
- Real Git branch/PR creation, changed-file refresh, webhook processing, and future GitHub App operations.
- LLM completion routing, virtual-key usage, and provider credential resolution.
- Runner execution, command execution decisions, workspace creation, and sandbox decisions.
- Registry creation, update, approval, eval metadata, checksum verification, rollback, import/export.
- Improvement proposal creation, governance decisions, eval metadata attachment, canary readiness, and apply-gate checks.
- Secrets/Sandbox metadata reads, credential resolution checks, lease requests, sandbox sessions, network egress decisions, and redaction audit.
- Enterprise provider invocation, Local Agent protocol consent/invocation, and blocked credential-cache/direct-local-CLI events.
- Dashboard/API reads before tenant and team scoping exists.

## Why This Is Needed Before Broader Real Integrations

Real Git Adapter v2 and LLM Gateway v1 now have controlled real-provider boundaries. Before adding broader GitHub App flows, multi-provider LLM routing, production webhook hardening, or enterprise operations, Aichestra needs a stable way to answer:

- who initiated the request;
- what principal and teams the actor belongs to;
- what roles and permissions apply at a scope;
- how that maps to `PolicySubject`;
- how authorization and policy decisions are audited;
- which future SSO/SCIM/OIDC/SAML providers can plug in without weakening current gates.

## Proposed Auth/RBAC Domain Model

Production Auth/RBAC Planning v0 will define provider-neutral metadata-only models:

- `Principal`: user, service account, system, local agent, or external integration identity.
- `Actor`: request-time actor derived from a principal, with roles and teams.
- `Team`: team metadata.
- `Role`: named permission bundle.
- `Permission`: action/resource-kind authorization primitive with risk level.
- `ResourceScope`: global, org, team, repo, project, task, registry, provider, or Local Agent scope.
- `RoleBinding`: principal/team to role at scope.
- `ServiceAccount`: scoped non-human actor metadata.
- `IdentityProvider`: mock and future provider placeholders.
- `AuthContext`: resolved request identity and permission catalog.
- `RequestContext`: request id, correlation id, source, and auth context.
- `AuthAuditEvent`: append-only sanitized auth/authorization audit.

The models must not contain password fields, OAuth tokens, session secrets, API key raw values, SSO tokens, or provider credentials.

## Proposed Roles And Permissions

Default roles:

- `system_admin`
- `platform_admin`
- `developer`
- `reviewer`
- `security_admin`
- `service_account_runner`
- `viewer`

Default permissions include task, Git, LLM, runner, registry, improvement, provider, secret, security, policy, Local Agent, and dashboard read operations. Destructive or high-risk operations such as merge, rebase, force push, direct secret reads, credential cache reads, Local Agent secret forwarding, and improvement apply remain denied by policy even if an actor has an admin-like role.

## Request Context Propagation

v0 will add request context helpers:

- resolve API requests into deterministic mock `AuthContext`;
- create explicit system contexts for startup/internal operations;
- create explicit test contexts;
- keep request and correlation ids available for audit and policy metadata.

API handlers should use the resolver for `/auth/*`, health/dashboard visibility, and new authorization checks. Existing service-specific actor strings can be gradually replaced by `RequestContext` in follow-up work.

## PolicyEngine Integration

`AuthorizationService` will bridge Auth/RBAC and Policy-as-code:

- resolve `AuthContext`;
- check RBAC permissions;
- map `AuthContext` into `PolicySubject`;
- call `PolicyService` for policy decisions;
- audit both RBAC allow/deny and policy-deny outcomes.

PolicyEngine remains authoritative for safety gates. Auth roles do not bypass policy denials.

## Future SSO / SCIM / OIDC / SAML Plan

v0 adds disabled placeholders only:

- OIDC provider placeholder.
- SAML provider placeholder.
- SCIM directory placeholder.
- Service-account provider placeholder.
- Future GitHub/Google/Microsoft/custom provider identity references.

Future implementations must add provider-specific token validation, directory sync, session management, and production secret handling behind explicit provider boundaries. v0 does not call identity providers, validate external tokens, issue sessions, or create API keys.

## This Task Implements

- Auth/RBAC domain models and seed catalog.
- `AuthProvider` interface with `MockAuthProvider` default and disabled future placeholders.
- `AuthorizationService`.
- In-memory repositories for auth/RBAC models and audit events.
- Request context helpers.
- `AuthContext` to `PolicySubject` mapping.
- API endpoints for auth config, current actor, catalog/read models, authorization checks, and audit.
- Health and dashboard auth visibility.
- Documentation and deterministic tests.

## Out Of Scope

- Real SSO, OAuth login, SAML, OIDC, SCIM, password login, production sessions, API key issuance, production service-account credentials, or identity provider integrations.
- External calls to identity, Git, LLM, secret, artifact, Kubernetes, Temporal, MCP, or provider services.
- Persistent Postgres auth repositories. v0 may document schema skeletons only.
- Tenant isolation, production RBAC administration workflows, and production auth middleware.
- Any weakening of policy, secret, sandbox, Git, LLM, runner, provider, registry, or Local Agent gates.
