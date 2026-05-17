# Dashboard/Readiness Tenant Scope Implementation v1

Status:

- Dashboard/Readiness Tenant Scope Implementation: `v1_implemented`
- Dashboard/Readiness Tenant Scope Planning: `v1_implemented`
- Tenant/Repo/Provider Scope Model: `v1_implemented`
- Tenant Scope Enforcement: `v1_implemented_partial`

Plain status: Dashboard/Readiness Tenant Scope Implementation: v1_implemented.

Dashboard/Readiness Tenant Scope Implementation v1 adds safe scope-aware metadata, warnings, role visibility hints, and redaction labels to dashboard and readiness read models. It prepares the dashboard/readiness layer for future filtering without enforcing tenant isolation.

This milestone keeps the rule explicit: production tenant enforcement remains future. Tenant Scope Enforcement v1 now adds partial representative enforcement metadata, but production tenant enforcement remains false. It does not implement tenant provisioning, row-level security, production Auth/RBAC, real IdP calls, real sessions/JWTs/API keys, real provider calls, or production-ready tenant filtering.

## What v1 Implements

- Shared DTOs:
  - `ScopedReadModelMetadata`
  - `DashboardPanelScopeSummary`
  - `ReadinessEndpointScopeSummary`
- Deterministic scope summaries derived from the Dashboard/Readiness Tenant Scope Planning v1 inventories.
- Optional `scopeMetadata` on major dashboard read-model sections.
- Dashboard tenant-scope planning read-model fields for panel and readiness endpoint scope summaries.
- Read-only readiness scope metadata on `/readiness/tenant-scope/*`, `/readiness/scopes/*`, and representative readiness summary endpoint groups.
- Dashboard UI section `Scope / Visibility / Redaction`.
- Safe `/health` metadata for implementation status.
- Partial representative Tenant Scope Enforcement v1 metadata on dashboard/readiness scope summaries, including `enforcementMode` and `scopeDecisionSummary`.

## What v1 Does Not Implement

v1 does not hide panels, enforce tenant filtering, enforce role checks, implement production tenant isolation, provision real tenants, add row-level security, add durable scope repositories, implement production auth, call identity providers, call GitHub, call LLM providers, call MCP, call Vault, call cloud services, execute vendor CLIs, run remote Git operations, run live integration tests, or expose secrets/env values.

## Read Model Additions

`ScopedReadModelMetadata` records:

- `scopeStatus`
- `appliedScopes`
- `requiredScopes`
- `missingScopes`
- `sensitivity`
- `roleVisibility`
- `redactionStatus`
- `tenantFilteringImplemented: false`
- `productionEnforcementImplemented: false`
- `warnings`
- safe metadata

Tenant Scope Enforcement v1 extends this metadata with optional `tenantScopeEnforcementImplemented`, `enforcementMode`, and `scopeDecisionSummary` fields. These are representative v1 hints only and do not hide panels or filter endpoint data.

`DashboardPanelScopeSummary` records the target scopes, available mock/readiness scopes, missing scopes, allowed roles, redaction class, enforcement status, fallback behavior, and warnings for each dashboard panel.

`ReadinessEndpointScopeSummary` records the same planning metadata for readiness endpoint groups.

## Dashboard UI Scope Metadata

The dashboard renders a `Scope / Visibility / Redaction` section showing:

- scope status badges;
- applied scope dimensions;
- missing scope warnings;
- role visibility hints;
- redaction labels;
- `tenant filtering implemented: false`;
- `production tenant enforcement: false`;
- no-secret/no-env status.
- partial Tenant Scope Enforcement v1 status and representative-only warnings for missing, audit-query, and secret-adjacent scopes.

The UI remains descriptive only. It does not hide or filter dashboard sections.

## Readiness Scope Metadata

Readiness metadata is exposed through:

- `GET /readiness/tenant-scope/dashboard-plans`
- `GET /readiness/tenant-scope/dashboard-scope-summaries`
- `GET /readiness/tenant-scope/readiness-plans`
- `GET /readiness/tenant-scope/readiness-scope-summaries`
- `GET /readiness/tenant-scope/role-visibility`
- `GET /readiness/tenant-scope/fallback-behavior`
- `GET /readiness/tenant-scope/summary`
- `GET /readiness/scopes/*`
- representative `/readiness/*/summary` endpoint groups.

The metadata is read-only and uses deterministic planning data. It does not perform external lookups or enforce filters.

Tenant Scope Enforcement v1 adds read-only endpoint metadata through:

- `GET /readiness/tenant-enforcement/modes`
- `GET /readiness/tenant-enforcement/mismatches`
- `GET /readiness/tenant-enforcement/summary`
- representative `scopeDecisionSummary` fields on readiness summary envelopes.

## Fallback Behavior

Fallback behavior is implemented as metadata:

- local/mock runtime allows metadata-only display with warning;
- staging planning allows display with production blocker warning;
- production future behavior should deny or require explicit tenant/global admin scope;
- secret-adjacent views remain redacted;
- audit views require explicit audit query scope before production.

Tenant Scope Enforcement v1 implements this as metadata and helper decisions. General dashboard/readiness behavior remains warning-only; explicit secret-adjacent helper decisions can deny when required metadata is missing or mismatched, but this is not production secret authorization.

## Role Visibility Hints

Role visibility hints come from the planning matrices and are not authorization decisions. They guide future implementation for:

- viewer;
- developer;
- reviewer;
- security_admin;
- platform_admin;
- audit_reader;
- release_manager;
- service_account_runner;
- system_admin_future.

Service account runners remain hidden from the human dashboard by default.

## No-secret / No-env Rules

Implementation v1 must not expose raw secret values, env values, provider API keys, GitHub tokens, webhook secrets, private keys, Vault tokens, Vault secret values, raw Vault paths/keys, database URLs, session data, JWTs, cookies, SAML/OIDC/SCIM payloads, credential-cache paths, raw prompts, or raw provider responses.

New metadata is sanitized and uses dimension names, counts, booleans, role names, and status strings only.

## Production Enforcement Gaps

The following remain future work:

- production Auth/RBAC and role-derived scope claims;
- durable tenant/team/project/repo/provider/model/SecretRef/MCP/package/host/audit-query repositories;
- dashboard read-model filtering;
- readiness endpoint filtering;
- audit query filtering;
- cache partitioning by tenant/role/scope/redaction class;
- repository/query-layer tenant filters;
- production empty/error states for missing scope;
- enforcement tests and security review.
- production-grade Tenant Scope Enforcement rollout after trusted AuthContext/RequestContext scope claims are available.

## Test Strategy

Implementation v1 adds deterministic tests for:

- scope metadata model derivation;
- dashboard panel scope summaries;
- readiness endpoint scope summaries;
- missing-scope warnings;
- `tenantFilteringImplemented: false`;
- `productionEnforcementImplemented: false`;
- secret-adjacent redaction metadata;
- dashboard API scope metadata;
- readiness API scope metadata;
- dashboard rendering of visibility/redaction hints;
- no-secret/no-env exposure checks.

## Known Limitations

- Available scopes are deterministic mock/readiness dimensions, not real user grants.
- Missing-scope warnings are readiness hints, not authorization failures.
- Role visibility hints are not active RBAC.
- Dashboard and readiness responses are still unfiltered.
- Audit query scoping is not enforced.
- Tenant Scope Enforcement v1 is partial and representative only.
- Production readiness remains false.

## Recommended Next Task

OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.
