# Tenant Scope Enforcement v1 Plan

Status: ready for implementation.

Tenant Scope Enforcement v1 is a limited mock-safe enforcement scaffold. It introduces reusable scope comparison decisions and representative dashboard/readiness metadata, but it does not implement production tenant isolation.

## Current Scope Model Behavior

Tenant/Repo/Provider Scope Model v1 is implemented as metadata/readiness scaffolding. It defines tenant, team, project, repo, provider, model, SecretRef, MCP tool, registry package, Local Agent host, audit query, and policy resource scope shapes. It seeds a deterministic mock scope catalog and exposes safe `/readiness/scopes/*` and `/dashboard/scopes` summaries.

`ScopeContextFactory` can create mock tenant/team/project contexts, normalize scope records into `PolicyResourceScope`, and map scoped resources for Policy-as-code. It does not authorize access, provision tenants, add row-level security, filter repositories, or claim production tenant enforcement.

## Current Dashboard/Readiness Scope Behavior

Dashboard/Readiness Tenant Scope Planning v1 inventories dashboard panels and readiness endpoint groups, target scope dimensions, role visibility matrices, fallback behavior, and future filtering architecture.

Dashboard/Readiness Tenant Scope Implementation v1 adds `ScopedReadModelMetadata`, `DashboardPanelScopeSummary`, and `ReadinessEndpointScopeSummary` to dashboard/readiness read models. These records show required scopes, missing-scope warnings, redaction labels, role hints, `tenantFilteringImplemented: false`, and `productionEnforcementImplemented: false`. They do not filter or hide data.

## Current AuthContext / RequestContext / PolicySubject Scope Metadata

`AuthContext` can carry optional tenant, team, project, and resource scopes. `RequestContext` can carry optional tenant id, team id, project id, and resource scopes. `PolicySubject` can carry optional tenant ids, team ids, project ids, resource scopes, request id, correlation id, source, actor id, and service account id.

Default dashboard/readiness ingress still uses mock actors and does not parse cookies or Authorization headers as production auth. Scope metadata is optional, mock-first, and safe to display only after sanitization.

## Current Policy Behavior

`StaticPolicyEngine` remains the runtime policy engine. Policy v0 is deny-by-default for remote Git, real LLM, MCP unsafe invocation, secret reads, credential-cache access, runner command execution, Local Agent dangerous actions, and improvement apply. Scope metadata enriches policy subjects, resources, contexts, and audit entries, but does not override policy decisions.

Tenant Scope Enforcement v1 must not replace `StaticPolicyEngine`; any scope `allow` decision is only a scope-match result and must not bypass policy denial.

## Proposed Enforcement Model

Add safe domain models:

- `TenantScopeEnforcementDecision`
- `TenantScopeEnforcementMode`
- `TenantScopeMismatch`

Add `TenantScopeEnforcementService` helpers:

- `evaluateScopeAccess(subject, resource, options)`
- `evaluateDashboardPanelAccess(context, panelScope, options)`
- `evaluateReadinessEndpointAccess(context, endpointScope, options)`
- `evaluateAuditQueryAccess(context, auditScope, options)`
- `evaluateSecretAdjacentAccess(context, secretScope, options)`
- `summarizeDecision(decision)`

The service compares subject scope metadata and resource/surface scope metadata. It returns deterministic `allow`, `warn`, `deny`, or `not_applicable` decisions with matched, missing, and mismatched scope summaries.

## Representative Enforcement Boundaries

Implement representative metadata-only enforcement summaries for:

- `/dashboard/scopes`
- `/dashboard/tenant-scope`
- `/dashboard/observability`
- `/dashboard/vault-secret-backend`
- `/dashboard/github-app-integration`
- `/dashboard/llm-integration`
- `/readiness/scopes/*`
- `/readiness/tenant-scope/*`
- `/readiness/secrets/*`
- `/readiness/secrets/vault/*`
- `/readiness/auth/*`
- `/readiness/staging-rc/*`
- `/readiness/staging-execution/*`

These summaries should include enforcement mode, scope decision summary, missing-scope warning, secret-adjacent warning where applicable, audit-query scope warning where applicable, `tenantFilteringImplemented: false`, partial representative enforcement status, and `productionTenantEnforcement: false`.

## Explicit Non-goals

- No production tenant provisioning.
- No production tenant isolation claim.
- No row-level security.
- No database tenant partitioning.
- No production Auth/RBAC, OIDC, SAML, SCIM, SSO, login/logout, sessions, JWTs, API keys, or service-account credentials.
- No external IdP or provider calls.
- No GitHub, LLM, MCP, Vault, Kubernetes, Temporal, OPA, Cedar, artifact registry, or cloud calls.
- No remote Git operations.
- No secret/env exposure.
- No dashboard/readiness filtering by tenant yet.
- No audit query filtering yet.
- No policy bypass.

## Safety Constraints

- Default runtime remains mock-first and deterministic.
- Scope missing or mismatch must never grant broader access.
- Secret-adjacent and audit-query surfaces must be stricter than general metadata.
- Secret values, env values, provider tokens, Vault tokens/paths/keys/values, webhook secrets, database URLs, session data, credential caches, raw prompts, and raw provider responses must not be returned.
- Existing Auth/RBAC, Policy, SecretRef, Git, LLM, MCP, Runner, Dashboard, Observability, Registry, Governance, Staging, CI/CD, and Secrets/Sandbox safety gates remain authoritative.

## This Task Implements

- Tenant scope enforcement decision/mode/mismatch models.
- `TenantScopeEnforcementService` with deterministic scope comparison and summary helpers.
- Safe metadata integration into dashboard/readiness scope metadata.
- Read-only `/readiness/tenant-enforcement/*` endpoints.
- Dashboard UI indicators for enforcement mode, missing-scope warnings, audit-query warnings, secret-adjacent warnings, partial representative enforcement, and false production enforcement.
- Documentation, inventory, and tests for the partial v1 enforcement scaffold.

## Out of Scope

- Actual tenant-filtered dashboard/readiness/audit responses.
- Durable tenant grant repositories.
- Production Auth/RBAC-derived scope claims.
- Repository/query-layer filters.
- Cache partitioning by tenant/role/scope.
- Production audit export or SIEM integration.
- Production tenant isolation signoff.

## Validation Plan

Run deterministic tests for decision models, service helpers, policy-deny preservation, representative dashboard/readiness metadata, no-secret/no-env exposure, and regressions. Then run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `git diff --check`.
