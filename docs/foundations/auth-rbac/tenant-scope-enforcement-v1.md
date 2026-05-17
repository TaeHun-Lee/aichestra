# Tenant Scope Enforcement v1

Status:

- Tenant Scope Enforcement: `v1_implemented_partial`
- Tenant/Repo/Provider Scope Model: `v1_implemented`
- Dashboard/Readiness Tenant Scope Planning: `v1_implemented`
- Dashboard/Readiness Tenant Scope Implementation: `v1_implemented`
- Production Auth Provider Skeleton: `v1_implemented`
- Production tenant enforcement: not implemented
- Production Auth/RBAC: not implemented

Plain status: Tenant Scope Enforcement: v1_implemented_partial.

Tenant Scope Enforcement v1 adds a reusable, deterministic scope-decision helper for comparing subject scope metadata to resource, dashboard, readiness, audit, and secret-adjacent scope metadata. It is limited enforcement scaffolding. It surfaces warnings, representative deny decisions for explicit secret-adjacent helpers, and dashboard/readiness metadata, but production tenant enforcement remains false.

## What v1 Implements

- `TenantScopeEnforcementDecision` for allow, deny, warn, and not-applicable results.
- `TenantScopeEnforcementMode` records for `metadata_only`, `warning`, `deny_secret_adjacent`, `deny_audit_query`, and `future_full_enforcement`.
- `TenantScopeMismatch` records for missing and mismatched tenant, team, project, repo, provider, model, secret, MCP, registry, local-agent, and audit-query scopes.
- `TenantScopeEnforcementService` helpers:
  - `evaluateScopeAccess`
  - `evaluateDashboardPanelAccess`
  - `evaluateReadinessEndpointAccess`
  - `evaluateAuditQueryAccess`
  - `evaluateSecretAdjacentAccess`
  - `summarizeDecision`
  - `attachDecisionToPolicySubject`
  - `attachDecisionToPolicyResource`
  - `policyRelation`
- Read-only `/readiness/tenant-enforcement/*` endpoints.
- `/dashboard/tenant-enforcement` and representative dashboard/readiness scope-decision metadata.
- Dashboard UI rows for enforcement mode, missing-scope warnings, audit-query scope warnings, secret-adjacent warnings, and explicit false production enforcement flags.

## What v1 Does Not Implement

v1 does not implement production tenant provisioning, production tenant isolation, row-level security, production DB tenant partitioning, production Auth/RBAC, real OIDC/SAML/SCIM/SSO, login/logout, sessions, JWTs, API keys, service-account credentials, token validation, session cookies, external IdP calls, external provider calls, durable tenant repositories, dashboard filtering, readiness filtering, audit query filtering, or production-ready tenant enforcement.

It also does not bypass Policy-as-code. A scope allow is metadata only and policy deny remains authoritative.

## Enforcement Modes

| Mode | Enabled | Default Profile | Current Behavior | Future Production Meaning |
|---|---:|---|---|---|
| `metadata_only` | yes | local | Records comparison metadata without changing access. | Useful for local inventories only. |
| `warning` | yes | staging | Returns warnings for missing or mismatched scopes while preserving current read-only behavior. | Becomes candidate behavior for staging previews. |
| `deny_secret_adjacent` | yes | integration | Explicit secret-adjacent helper calls can deny when required scope is missing or mismatched. | Future secret surfaces should deny or redact before detail display. |
| `deny_audit_query` | no | production_future | Future-only catalog mode; not enabled by default. | Audit detail queries should require explicit audit query scope. |
| `future_full_enforcement` | no | production_future | Planning marker only. | Requires production auth, durable scopes, repository filters, cache partitioning, and security review. |

## Decision Model

`TenantScopeEnforcementDecision` records:

- `decision`
- `reason`
- `subjectScope`
- `resourceScope`
- `requiredScopes`
- `missingScopes`
- `matchedScopes`
- `mismatchedScopes`
- `enforcementMode`
- `source`
- optional request, correlation, actor, and service-account ids
- sanitized metadata with `tenantFilteringImplemented: false`, `productionTenantEnforcement: false`, and `policyDecisionStillAuthoritative: true`

Decision summaries are safe for APIs and dashboards. They contain no secret values, env values, provider credentials, tokens, sessions, cookies, raw Vault paths/keys/values, database URLs, or credential-cache paths.

## Dashboard And Readiness Metadata

Representative dashboard/readiness surfaces now include `enforcementMode` and `scopeDecisionSummary` through their scope metadata. Current behavior is descriptive:

- missing tenant/team/project/repo/provider/model/secret/MCP/audit-query scope produces warnings;
- dashboard/readiness panels are not hidden;
- endpoint rows are not filtered;
- `tenantFilteringImplemented` remains `false`;
- `productionTenantEnforcement` remains `false`;
- `tenantScopeEnforcementImplemented` is `partial`.

Read-only APIs:

- `GET /readiness/tenant-enforcement/modes`
- `GET /readiness/tenant-enforcement/mismatches`
- `GET /readiness/tenant-enforcement/summary`
- `GET /dashboard/tenant-enforcement`

## Audit Query Scope Handling

`evaluateAuditQueryAccess` requires tenant and audit-query scope metadata and returns warnings in v1. Missing audit-query scope is marked with `audit_scope_missing` and the warning `audit_query_scope_required_before_production`.

v1 does not implement production audit query filtering, raw audit payload access, export controls, or tenant-scoped audit repositories.

## Secret-adjacent Scope Handling

`evaluateSecretAdjacentAccess` uses stricter v1 behavior. Missing or mismatched tenant/secret scope returns `deny` for the helper decision and includes `secret_adjacent_scope_enforcement_strict`.

This does not unlock secret reads. SecretRef, Vault, and credential-resolution paths remain redacted and policy-controlled. `secret.read`, credential cache reads, secret injection, and provider credential resolution remain denied unless existing explicit gates and policy allow.

## Relationship To PolicyEngine

Tenant Scope Enforcement v1 is a companion metadata service, not a replacement policy engine:

- `StaticPolicyEngine` remains the runtime Policy-as-code engine.
- policy deny remains authoritative.
- scope warnings do not override policy denies.
- scope allow does not grant policy access.
- service accounts cannot bypass missing or mismatched scope metadata.
- scope decisions may be attached to `PolicySubject` and policy resource metadata for audit/readiness context.

## Relationship To Future Production Auth

Future production auth must provide trusted tenant/team/project/repo/provider/model/secret/MCP/registry/local-agent/audit-query claims before this scaffold can become active tenant filtering. Until then, mock AuthContext and RequestContext scope metadata are readiness signals only.

## Remaining Gaps

- No production Auth/RBAC provider.
- No durable tenant/team/project/repo/provider/model/secret/MCP/package/host/audit-query grants.
- No dashboard/readiness filtering.
- No audit query filtering.
- No repository/query-layer tenant enforcement.
- No cache partitioning by tenant/role/scope.
- row-level security is not implemented.
- No production tenant isolation claim.

## Known Limitations

- Decisions are deterministic comparisons over metadata, not proof of production authorization.
- Dashboard/readiness integrations are representative and partial.
- Secret-adjacent helper denial is not a production secret authorization system.
- Audit query warnings do not filter audit storage or query results.
- Production readiness remains false.

## Recommended Next Task

OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.

## OIDC tenant mapping boundary

OIDC tenant/team/project/repo/provider mapping remains planned metadata only. Tenant Scope Enforcement must continue to rely on existing mock/request-context boundaries and must not trust OIDC claims until a future implementation explicitly validates tokens and mapping rules.
