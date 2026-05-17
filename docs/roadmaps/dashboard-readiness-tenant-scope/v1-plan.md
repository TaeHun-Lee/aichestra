# Dashboard/Readiness Tenant Scope Planning v1 Plan

Status: Dashboard/Readiness Tenant Scope Planning `v1_implemented`.

This plan follows the current docs organization: cross-cutting roadmap work lives under `docs/roadmaps/`, while long-lived inventories and role matrices live under `docs/reference/`.

## Current Behavior

Dashboard API-backed Read Model v0 exposes sanitized read-only `/dashboard/*` read models assembled by `apps/api/src/dashboard-read-model.ts` and consumed by `apps/web`. The dashboard can use API data or deterministic demo fallback data. Dashboard routes are read-only and do not run workflows, call providers, request secret leases, execute agent commands, or mutate registry/governance state.

Current `/dashboard/*` endpoints include overview, tasks, git, GitHub App, GitHub App integration-test readiness, conflicts, registry, LLM, LLM integration-test readiness, agents, policy, policy bundles, auth, auth production readiness, providers, security, local agents, MCP, scopes, readiness, database, secret backend, production secret backend decision, Vault secret backend, Vault integration-test readiness, staging, staging dry-run, staging RC, staging execution, CI/CD, observability, and audit read models.

Current `/readiness/*` endpoints include deployment, database, secrets, Vault secret backend, auth, policy bundles, GitHub App, GitHub App integration-test profile, LLM integration-test profile, Vault integration-test profile, staging deployment profile, staging dry-run, staging RC, staging execution, CI/CD, and scope model readiness endpoints.

Tenant/Repo/Provider Scope Model v1 provides metadata-only tenant, team, project, repo, provider, model, SecretRef, MCP tool, registry package, local-agent host, and audit-query scope records. It includes a deterministic mock scope catalog, `ScopeContextFactory`, optional scope metadata on `AuthContext`, `RequestContext`, `PolicySubject`, policy resources, and audit envelopes, plus read-only `/readiness/scopes/*` and `/dashboard/scopes` surfaces.

Auth/RBAC and RequestContext are mock-first. RequestContext Propagation v1 and API AuthContext Middleware Skeleton v1 may attach mock/system actor, request id, correlation id, roles, teams, auth mode, source, and safe scope metadata. They do not implement production auth, sessions, OIDC, SAML, SCIM, JWTs, API keys, service-account credentials, or identity-provider calls.

PolicySubject scope metadata is additive. Policy-as-code v0 still uses static/mock-first decisions and existing gates. Scope metadata does not grant access or weaken Git, LLM, MCP, SecretRef, Runner, Registry, Governance, Dashboard, Observability, or deployment-readiness safety gates.

No-secret/no-env guarantees remain unchanged: dashboard and readiness responses must not expose raw secrets, env values, tokens, cookies, session ids, JWTs, provider API keys, Vault token values, Vault secret values, raw Vault paths/keys when sensitive, private keys, webhook secrets, credential cache paths, raw prompts, or raw provider responses.

## Proposed Dashboard Tenant Scoping Strategy

Dashboard panels should eventually be filtered by explicit `RequestContext` scope metadata and role visibility policy:

- Tenant scope is the default production boundary.
- Team and project scopes narrow work views for task, Git, LLM, MCP, registry, and staging surfaces.
- Repo scope is required for Git, GitHub App, conflict, merge queue, and repo-linked task views.
- Provider and model scopes are required for LLM and provider-readiness panels.
- Secret scope is required for SecretRef and Vault-adjacent panels, with permanent value redaction.
- MCP server/tool scope is required for MCP panel details.
- Registry package scope is required for registry/governance details.
- Local Agent host scope is required for Local Agent protocol and runner details.
- Audit query scope is required before audit and observability views can be production tenant-filtered.

The implementation in this task inventories the scope requirements and exposes planning data only. It does not enforce filtering.

## Proposed Readiness Endpoint Scoping Strategy

Readiness endpoint groups should eventually be filtered by the same RequestContext/AuthContext scope fields, with endpoint-specific redaction:

- Local/mock runtime can display metadata-only planning records with warnings when scope is missing.
- Staging planning can display scoped and unscoped metadata with explicit production blockers.
- Production must require tenant scope or explicit future global-admin scope before returning tenant-sensitive readiness details.
- Secret-adjacent readiness groups must always redact raw values.
- Audit/readiness views must require explicit audit query scope before production.

## Role Visibility Matrix

Dashboard and readiness visibility is defined in:

- `docs/reference/dashboard-role-visibility-matrix.md`
- `docs/reference/readiness-role-visibility-matrix.md`

The short form is:

- `viewer`: high-level status only, no secret-adjacent details.
- `developer`: task, Git, LLM, MCP summaries scoped to allowed project/repo/provider.
- `reviewer`: registry/governance/review queues scoped to allowed project/package.
- `security_admin`: security and audit metadata, never raw secrets.
- `platform_admin`: operational readiness metadata, no policy bypass.
- `audit_reader`: audit summaries scoped by tenant/team/project/audit query, no raw payloads.
- `release_manager`: staging, release-candidate, signoff, and deployment-readiness metadata.
- `service_account_runner`: service attribution only; human dashboard hidden by default.
- `system_admin_future`: future explicit global administration role, not implemented.

## Future Enforcement Phases

1. Planning inventory and read-only surfaces: implemented here.
2. Request-scope extraction hardening: require explicit tenant/team/project/repo/provider/audit query metadata on dashboard/readiness requests in staging.
3. Dashboard read-model filtering: filter each section by target scope dimensions and role matrix.
4. Readiness endpoint filtering: add endpoint-group guards, role redaction, and missing-scope responses.
5. Audit/repository query filtering: enforce tenant/audit query scope at storage/query layer.
6. Production rollout: require production Auth/RBAC, durable scope repositories, tenant indexes, cache partitioning, and policy review before enabling tenant filtering.

## This Task Implements

- Pre-implementation plan and canonical v1 documentation.
- Dashboard panel tenant-scope inventory.
- Readiness endpoint tenant-scope inventory.
- Dashboard role visibility matrix.
- Readiness role visibility matrix.
- Scope fallback behavior document.
- Future filtering architecture document.
- Deterministic read-only planning models and service.
- Read-only `/readiness/tenant-scope/*` planning endpoints.
- `/dashboard/tenant-scope` read model and dashboard panel.
- Safe `/health` metadata for planning status.
- Deterministic tests for models, API, dashboard rendering, docs, and no-secret/no-env behavior.

## Out of Scope

- Production tenant enforcement.
- Tenant provisioning.
- Row-level security.
- Durable tenant/scope repositories.
- Tenant-filtered audit storage queries.
- Real Auth/RBAC, OIDC, SAML, SCIM, SSO, login/logout, sessions, JWTs, API keys, or service-account credentials.
- External identity-provider, GitHub, LLM, MCP, Vault, Kubernetes, Temporal, OPA, Cedar, artifact registry, or cloud calls.
- Production-ready tenant filtering claims.
