# Production Auth/RBAC Blockers And Risks v1

Status: `recorded`
Scope: implementation blocker and risk register only
Production auth implemented: no

## Critical Blockers

| Blocker | Impact | Required remediation | Status |
| --- | --- | --- | --- |
| No real AuthProvider | Production users cannot authenticate. | Implement gated OIDC or SAML adapter in a future task. | open |
| No SCIM or directory lifecycle | Deprovisioning and group sync are not production-grade. | Add SCIM or equivalent sync after provider selection. | open |
| Mock actors accepted in local flows | Mock actor use would be unsafe in production. | Reject mock actors in production profile after real provider exists. | open |
| No tenant-scoped repositories | Cross-tenant reads/writes cannot be ruled out. | Add tenant/workspace/project/repo filters and indexes. | open |
| Partial request context propagation | Some services use actor strings or service defaults. | Propagate `RequestContext` or `AuthContext` through protected boundaries. | open |
| No durable auth repository design | Auth metadata cannot survive production restart or audit. | Design and migrate durable auth schema. | open |
| No session/token boundary implementation | Interactive auth cannot persist safely. | Implement session/token boundary after provider adapter review. | open |
| No service-account credential issuance | Worker/provider service identities are metadata only. | Add scoped service-account credential path after real secret backend. | open |
| No break-glass workflow | Incident access is not governed. | Design time-bound break-glass with audit and approvals. | open |

## High Risks

| Risk | Scenario | Mitigation |
| --- | --- | --- |
| Token/assertion leakage | Raw IdP payload enters audit, errors, dashboard, or logs. | Adapter-local validation, DTO redaction, no-token tests, audit sanitizer checks. |
| Policy bypass | RBAC allow is treated as final allow. | Keep Policy-as-code authoritative after RBAC allow. |
| Scope drift | IdP groups map too broadly to platform roles. | Explicit group-to-role review and deny high-risk defaults. |
| Deprovisioning lag | Removed user keeps active local role binding. | SCIM lifecycle, short session expiry, sync audit, disabled principal fail-closed. |
| Service-account overreach | Worker or provider service account gets broad admin role. | Narrow service-account roles, purpose scope, rotation, policy checks. |
| Dashboard overexposure | Tenant or auth metadata leaks through dashboard/readiness. | Tenant filters, sanitized DTOs, no-token/no-env assertions. |
| Credential fallback misuse | Legacy env credentials become production path. | Prefer SecretRef, block env fallback for production profile. |
| Break-glass misuse | Emergency role becomes standing admin. | Future-only, time-bound, dual approval, audited, no raw secret access. |

## Boundary-Specific Risks

| Boundary | Risk | Required control |
| --- | --- | --- |
| Git | Branch/PR operations attributed to broad service actor. | Scoped user/service account context and repo allowlists. |
| LLM | Usage and budget not tenant-attributed. | Tenant-aware budgets, actor context, policy and SecretRef checks. |
| MCP | Tool invocation lacks production-grade actor and tenant context. | Auth/RBAC plus Policy before any real transport. |
| Registry | Mutation approval uses mock actors. | Map production roles into registry authorizer and audit reviewer identity. |
| Security | Credential resolution not tied to production service account scope. | Auth/RBAC and Policy before SecretRef resolution, tenant-scoped refs. |
| Local Agent | Consent not linked to production user/device trust. | Tenant/user/host identity binding and consent audit. |
| Observability | Audit queries lack tenant filters. | Tenant-scoped audit query and export plan. |

## Current Decision

Production Auth/RBAC remains `not_ready`.

Implementation can proceed only after Phase 0 Boundary Inventory Audit confirms the first safe implementation slice and this risk register is updated with any newly discovered blockers.
