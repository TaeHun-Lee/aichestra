# Audit Query Scope Enforcement v1 Plan

## Chosen Path

`docs/README.md` places feature-specific work under `docs/features/<feature>/`. Audit Query Scope Enforcement is a feature layered on top of `docs/foundations/observability-audit-retention/v0.md` and the tenant-scope foundations, so the canonical path is:

- `docs/features/audit-query-scope-enforcement/v1-plan.md`
- `docs/features/audit-query-scope-enforcement/v1.md`

No `design_docs/` directory is present in the current repository.

## Current Observability / Audit Retention v0 Behavior

Observability / Audit Retention v0 is implemented in `packages/observability` as an in-memory, read-only aggregation layer. It normalizes existing source-specific audit records into `AuditEventEnvelope`, applies `sanitizeAuditMetadata`, exposes read-only `/observability/*` endpoints, and renders `/dashboard/observability`.

Current guarantees:

- no external observability backend;
- no external export, SIEM, alert delivery, or retention deletion job;
- no raw payload storage;
- sanitized summaries and metadata only;
- no raw provider credentials, tokens, cookies, session ids, raw prompts, raw tool inputs, webhook secrets, credential-cache contents, or env values in envelopes, API, dashboard, or tests.

## Current AuditQueryScope Model

The Tenant/Repo/Provider Scope Model v1 includes `AuditQueryScope` metadata with tenant/team/project/actor/resource-kind dimensions. `PolicyResourceScope` already supports `audit_query`, and `createAuditQueryPolicyResource` can create an audit-query scoped policy resource.

Current behavior is metadata-only. Audit query scope is present as a future enforcement dimension but does not yet drive observability query detail decisions.

## Current Tenant Scope Enforcement Behavior

Tenant Scope Enforcement v1 is `v1_implemented_partial`. It provides deterministic `TenantScopeEnforcementService` helpers, including `evaluateAuditQueryAccess`, but audit query handling currently returns representative warnings. It does not filter audit storage, enforce production tenant isolation, implement row-level security, or provide per-result redaction for audit query detail.

## Current Dashboard Observability Behavior

`/dashboard/observability` shows audit summary, recent events, security events, denied/blocked events, retention/redaction classes, metric snapshots, trace skeletons, source coverage, blockers, and no-secret status. Dashboard Scope Filtering v1 can redact representative observability/audit panels based on safe demo headers, but it is panel-level redaction, not audit-query-specific detail enforcement.

## Proposed Audit Query Scope Decision Model

Add a mock-safe audit query scope layer in `packages/observability`:

- `AuditQueryScopeRequest`
- `AuditQueryScopeDecision`
- `AuditQueryRedactionPlan`
- `AuditQueryScopeEnforcementSummary`
- `AuditQueryScopeEnforcementService`

The service will evaluate actor roles, requested detail level, tenant/team/project/repo/provider/resource/audit-source scopes, and RequestContext attribution. It will return deterministic allow/redact/deny decisions and redaction plans without querying external systems or mutating audit storage.

## Role Behavior

Representative v1 role behavior:

- `viewer`: summary only; metadata/detail/raw payload are redacted or denied.
- `developer`: metadata only when project/repo/provider scope is present; detail denied when scope is missing.
- `security_admin`: broader metadata/detail visibility, still redacted for secret-like/raw fields; raw payload forbidden.
- `audit_reader`: metadata/detail require tenant/team/project audit-query scope; missing scope denies detail.
- `platform_admin`: operational metadata/detail with redaction; raw payload forbidden.
- service accounts: no bypass; missing or mismatched scope still warns or denies detail.

These are mock/readiness decisions, not production authorization.

## Redaction Behavior

Raw payload access is forbidden in v1. Redaction plans will remove or replace raw payloads, Authorization/cookie/session/token fields, credential/cache fields, prompt/tool input/output previews when detail is not allowed, and common secret/env-like field names. Summary-level output remains available where safe.

The implementation will preserve the existing `sanitizeAuditMetadata` and DTO sanitizer behavior and add query-decision metadata to selected audit read models.

## Future Production Storage / Query Plan

Future production audit query enforcement requires:

- trusted production Auth/RBAC claims;
- durable tenant/team/project/repo/provider/audit-query grants;
- durable audit storage with query predicates;
- row- or query-layer filtering;
- cache partitioning by tenant/scope/role/detail level;
- audited export and retention controls;
- security review for detail-level access.

None of that is implemented in v1.

## Safety Constraints

v1 must not:

- implement production Auth/RBAC;
- provision tenants;
- add database row-level security;
- add production audit storage;
- add external SIEM/export;
- call external providers or identity providers;
- issue sessions, JWTs, API keys, or service-account credentials;
- expose secrets, env values, raw payloads, tokens, cookies, sessions, provider credentials, or credential-cache paths;
- weaken Observability, Auth/RBAC, Policy, Tenant Scope, Dashboard, Readiness, SecretRef, Git, LLM, MCP, Registry, Governance, Staging, CI/CD, or safety gates.

## What This Task Implements

- Mock-safe audit query scope models and helper service in `packages/observability`.
- Deterministic scope decisions for summary/metadata/detail/raw-payload requests.
- Redaction plans and redaction helper for audit query results.
- Metadata/check-only API endpoints:
  - `GET /readiness/audit-scope/summary`
  - `GET /readiness/audit-scope/redaction-plans`
  - `POST /observability/audit/query-scope/check`
- Scope decision metadata attached to `/observability/audit/events`.
- Dashboard observability panel metadata for audit query scope status, redaction, and raw-payload-forbidden posture.
- Documentation, checklist update, and deterministic tests.

## What Remains Out Of Scope

- Production audit query security.
- Durable audit storage filtering.
- DB row-level security.
- External observability export/SIEM.
- Raw payload access.
- Production Auth/RBAC integration.
- Real tenant provisioning or durable grants.
- Session/JWT/API-key/service-account credential issuance.
- Any external provider call.
