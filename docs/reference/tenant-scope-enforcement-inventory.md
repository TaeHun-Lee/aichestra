# Tenant Scope Enforcement Inventory

Status:

- Tenant Scope Enforcement: `v1_implemented_partial`
- Production tenant enforcement: not implemented
- Production Auth/RBAC: not implemented

This inventory maps the limited v1 enforcement scaffolding. It records representative metadata boundaries only. It does not document production isolation, row-level security, durable tenant provisioning, or active dashboard/readiness filtering.

| Boundary | Source Files | Enforcement Mode | Current Behavior | Future Production Behavior | Missing Gaps | Production Impact |
|---|---|---|---|---|---|---|
| Domain decision model | `packages/auth/src/tenant-scope-enforcement.ts` | metadata_only, warning, deny_for_sensitive, future_production | Builds `TenantScopeEnforcementDecision`, `TenantScopeEnforcementMode`, and `TenantScopeMismatch` records with sanitized metadata. | Replace warnings with tenant-aware authorization/filtering after production auth and durable grants. | Trusted auth claims, durable scope repository, security review. | Foundation for future tenant isolation, not isolation itself. |
| Generic scope access helper | `TenantScopeEnforcementService.evaluateScopeAccess` | metadata_only by default | Compares subject and resource metadata for required dimensions and returns allow/warn/deny/not-applicable. | Enforce missing/mismatched dimensions at service and repository boundaries. | Request-derived subject scopes, resource grant store, filterable repositories. | Prevents future cross-tenant reads only after production enforcement is added. |
| Dashboard panel helper | `evaluateDashboardPanelAccess`, `apps/api/src/dashboard-read-model.ts` | warning | Adds scope-decision summaries to dashboard panel metadata without hiding panels. | Hide, redact, or return empty scoped panels by role and tenant. | Dashboard read-model filters, UI empty states, role grants. | Dashboard remains unfiltered today. |
| Readiness endpoint helper | `evaluateReadinessEndpointAccess`, `apps/api/src/main.ts` | warning | Adds `enforcementMode` and `scopeDecisionSummary` to representative readiness responses. | Require tenant/project scope before detailed readiness rows. | Endpoint filters, lower-role detail hiding, production auth. | Readiness remains global planning metadata today. |
| Audit query helper | `evaluateAuditQueryAccess` | warning | Missing audit-query scope produces `audit_scope_missing` and production warning. | Deny or filter audit details without explicit audit query scope. | Audit query repository filters, export controls, legal-hold scope model. | Audit detail scoping remains future. |
| Secret-adjacent helper | `evaluateSecretAdjacentAccess` | deny_for_sensitive | Explicit helper calls deny missing/mismatched tenant or secret scope; dashboards still show redacted metadata. | Deny secret-adjacent detail views without explicit tenant/secret/admin scope. | SecretRef tenant grants, Vault path/key redaction policy, production auth. | Secret values remain inaccessible; helper denial is representative. |
| Policy metadata relation | `attachDecisionToPolicySubject`, `attachDecisionToPolicyResource`, `policyRelation` | metadata_only | Attaches safe summaries and records that policy deny remains authoritative. | Feed scope decisions into policy shadow/evaluation workflows. | Policy runtime shadow evaluation, production auth claims. | Does not weaken `StaticPolicyEngine`. |
| Tenant enforcement readiness API | `apps/api/src/main.ts` | read-only metadata | Exposes `/readiness/tenant-enforcement/modes`, `/mismatches`, and `/summary`. | Become operator readiness and rollout evidence after production auth. | Authenticated access, role filtering, durable evidence storage. | Safe local/staging metadata only. |
| Dashboard tenant enforcement panel | `apps/api/src/dashboard-read-model.ts`, `apps/web/src/render.ts` | warning | Shows partial enforcement status, warnings, false filtering flags, and no-secret/no-env status. | Show applied tenant/role filters and scoped empty states. | Real request scopes, UI role controls, production wording review. | Must not imply production isolation. |
| `/dashboard/scopes` | `apps/api/src/dashboard-read-model.ts` | warning | Adds partial enforcement summary to scope catalog/readiness metadata. | Tenant-filter catalog and hide cross-tenant scopes. | Durable scope catalog, user grants, cache partitioning. | Mock catalog remains visible locally. |
| `/dashboard/observability` and `/dashboard/audit` | `apps/api/src/dashboard-read-model.ts` | warning | Scope metadata can identify audit-query warnings; no raw audit payloads are exposed. | Require audit scope before detail queries or exports. | Audit query filters and role-based redaction. | Audit scoping remains future. |
| `/dashboard/vault-secret-backend` and security panels | `apps/api/src/dashboard-read-model.ts` | warning plus secret-adjacent labels | Redacted SecretRef/Vault metadata remains visible with scope warnings. | Deny or redact detail rows without secret/admin scope. | Production secret grants and Vault rollout. | No Vault token/path/key/secret values are exposed. |
| `/readiness/scopes/*` | `apps/api/src/main.ts` | warning | Mock catalog responses include scope-decision metadata on summary envelopes. | Tenant-filter catalog responses before production. | Durable grants and request scope extraction. | Planning-safe only. |
| `/readiness/tenant-scope/*` | `apps/api/src/main.ts` | warning | Planning inventory responses include enforcement summaries. | Drive production filter rollout evidence. | Filter implementation and security review. | Does not enforce access. |
| `/readiness/secrets/*` and `/readiness/secrets/vault/*` | `apps/api/src/main.ts` | warning metadata; explicit helper can deny | Summary endpoints include warnings and redaction metadata; no secret values are displayed. | Require secret/admin scope before details. | Secret grants, production auth, redaction review. | Secret-adjacent surfaces remain redacted. |
| `/readiness/auth/*` | `apps/api/src/main.ts` | warning | Production Auth/RBAC planning summaries carry scope warnings. | Scope by tenant/auth admin role after real provider skeleton. | Real auth provider, role mapping, trusted claims. | Production auth remains not implemented. |
| `/readiness/staging-rc/*` and `/readiness/staging-execution/*` | `apps/api/src/main.ts` | warning | Release/signoff planning summaries carry missing-scope metadata. | Require target/evidence/execution/governance scope before staging/prod actions. | Scoped signoff store, release target grants. | No deployment or release execution. |

## Safety Notes

- No external providers are called.
- No tenant provisioning is performed.
- No row-level security is implemented.
- No database tenant partitioning is implemented.
- No raw secrets, env values, provider credentials, Vault tokens, Vault paths/keys/values, sessions, JWTs, API keys, or credential-cache paths are exposed.
- `StaticPolicyEngine` deny decisions remain authoritative.
- Production tenant enforcement remains false.
