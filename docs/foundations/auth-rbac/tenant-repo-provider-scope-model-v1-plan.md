# Tenant/Repo/Provider Scope Model v1 Plan

Path note: `docs/README.md` places cross-cutting Auth/RBAC foundations under `docs/foundations/auth-rbac/`. Tenant/Repo/Provider Scope Model v1 is a shared Auth/RBAC, Policy, provider, registry, observability, dashboard, and readiness scaffold, so this is the canonical plan path.

## Current Status

- Production Auth/RBAC Planning is `v1_implemented` as planning/readiness only. It does not implement production auth, tenant isolation, sessions, JWTs, API keys, service-account credentials, or IdP calls.
- RequestContext Propagation is `v1_implemented` as a mock-first attribution/correlation layer. It propagates request id, correlation id, actor/principal metadata, roles, teams, auth mode, source, and sanitized metadata through representative boundaries.
- API AuthContext Middleware Skeleton is `v1_implemented` and creates one cached mock-first API ingress `RequestContext` where practical.
- Service Account Actor Boundary is `v1_implemented` with a static mock service-account catalog and service-account context factory. It issues no credentials.
- Registry/Governance RequestContext Migration is `v1_implemented`; high-value registry/governance paths accept `RequestContext`/`AuthContext` and record attribution/audit metadata.

## Current Scope Gaps

- Tenant/team/project/repo scoping remains metadata/planning only.
- Dashboard/readiness panels are read-only but not production tenant-filtered.
- Provider/model/secret/repo/MCP/registry/local-agent resources do not share a common scope shape.
- Policy subjects carry actor, principal, role, team, request, correlation, source, auth mode, and service-account metadata, but not normalized tenant/project/resource scope arrays.
- Audit events normalize repo/provider/model/tool/secret ids when present, but not a common scope envelope.

## Proposed Scope Model

v1 introduces provider-neutral metadata models for:

- `TenantScope`
- `TeamScope`
- `ProjectScope`
- `RepoScope`
- `ProviderScope`
- `ModelScope`
- `SecretScopeBinding`
- `MCPToolScope`
- `RegistryPackageScope`
- `LocalAgentHostScope`
- `AuditQueryScope`
- `PolicyResourceScope`

These are mock/readiness metadata only. They do not enforce production multi-tenancy or row-level security.

## Proposed Resource Mappings

- Git repo/branch/PR resources map to `RepoScope`.
- LLM routes map to `ProviderScope` and `ModelScope`.
- SecretRef credential resolution maps to `SecretScopeBinding`.
- MCP invocation maps to `MCPToolScope`.
- Registry manifests and registry items map to `RegistryPackageScope`.
- Local Agent registrations/invocations map to `LocalAgentHostScope`.
- Observability audit queries map to `AuditQueryScope`.
- Dashboard/readiness sections expose safe summaries only and mark filtering as future.

## Proposed PolicySubject Additions

Add optional fields:

- `tenantIds`
- `teamIds`
- `projectIds`
- `resourceScopes`

These fields are additive only. Missing scopes must not grant broader access. Policy deny-by-default remains unchanged.

## Proposed Audit/Observability Additions

Where source events carry scope metadata, audit/read models may include:

- `tenantId`
- `teamId`
- `projectId`
- `scopeKind`
- `scopeId`
- `resourceScopes`

No raw headers, cookies, tokens, env values, provider credential values, secret values, raw prompts, or raw provider outputs may be stored.

## Boundaries Included In v1

- Common scope models and deterministic mock scope catalog in `packages/auth`.
- Scope helper/factory functions for normalizing resource scopes.
- Optional `AuthContext`, `RequestContext`, and `PolicySubject` scope fields.
- Policy resource helper functions for Git, LLM, MCP, SecretRef, Registry, Governance, Local Agent, Runner, Dashboard/Readiness, and Observability resource contexts.
- Representative scope metadata in Git, LLM, MCP, Security, Registry/Governance, Policy audit, Observability, Dashboard, and Readiness surfaces where low risk.
- Read-only `/readiness/scopes/*` endpoints and `/dashboard/scopes`.

## Boundaries Intentionally Left For Future Enforcement

- Production tenant provisioning.
- Durable tenant repositories and row-level security.
- Tenant-filtered dashboard/readiness/audit queries.
- Tenant-aware storage indexes.
- Production route permission matrix enforcement.
- Service-account credential issuance or rotation.
- Production SecretRef backend tenant isolation.
- Artifact registry package scoping and package signing.
- Active registry mutation through auto-improvement.

## Safety Constraints

- No real OIDC, SAML, SCIM, SSO, login/logout, sessions, JWTs, API keys, or service-account credentials.
- No external IdP, GitHub, LLM, MCP, Vault, Kubernetes, Temporal, OPA, Cedar, cloud, artifact registry, or vendor CLI calls.
- No credential-cache reads.
- No secret/env value exposure.
- No production multi-tenant enforcement claim.
- No policy bypass or weakened deny-by-default behavior.

## What This Task Implements

- Shared scope metadata types.
- Deterministic mock scope catalog.
- Scope normalization helpers and policy resource context helpers.
- Optional scope fields on auth/request/policy subjects.
- Safe readiness/dashboard scope summaries.
- Representative low-risk metadata propagation.
- Inventory and docs updates.
- Deterministic tests for models, helpers, policy integration, readiness/API, dashboard, and no-secret behavior.

## What Remains Out Of Scope

- Real tenant enforcement.
- Real tenant provisioning.
- Production Auth/RBAC.
- Production dashboard filtering.
- Row-level security.
- Provider credential changes.
- Auto-apply or active registry mutation through auto-improvement.
- External integrations or live provider calls.
