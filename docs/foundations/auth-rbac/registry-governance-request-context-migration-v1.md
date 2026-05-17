# Registry/Governance RequestContext Migration v1

## Status

Registry/Governance RequestContext Migration v1 is implemented as a mock-first attribution migration.

Status:

- Registry/Governance RequestContext Migration: `v1_implemented`
- RequestContext Propagation: `v1_implemented`
- API AuthContext Middleware Skeleton: `v1_implemented`
- Service Account Actor Boundary: `v1_implemented`
- Tenant/Repo/Provider Scope Model: `v1_implemented`
- Production Auth/RBAC Planning: `v1_implemented`
- Phase 5: `preparation_started`

This is not production auth or production governance.

## What v1 Implements

- Optional `RequestContext` / `AuthContext` inputs on high-value `RegistryService` mutation and read/query helpers.
- Request-derived registry actor mapping for registry mutation authorization and policy subjects.
- Context metadata on registry audit logs, registry revisions, registry eval results, and package import mutation audit entries.
- Optional `RequestContext` / `AuthContext` inputs on governance decisions, proposal eval runs, canary readiness checks, apply gate checks, draft registry change transitions, and mock auto-improvement proposal/draft generation.
- Context metadata on governance decisions, draft registry changes, eval runs, canary readiness, apply gates, and governance audit events.
- API ingress `RequestContext` propagation into representative `/registry/*` and `/improvement/*` mutation paths.
- Mock service-account attribution for `registry_governance_service` and `improvement_governance_service` where service/system context is used.
- Registry package scope metadata on migrated registry/governance policy resources and audit metadata where low risk.
- Deterministic tests in `tests/registry-governance-request-context-migration-v1.test.ts`.

## What v1 Does Not Implement

v1 does not implement OIDC, SAML, SCIM, SSO, login/logout, sessions, JWTs, API keys, service-account credentials, credential rotation, external IdP calls, real eval execution, canary rollout execution, artifact registry integration, real provider calls, automatic apply, or production tenant isolation enforcement.

Auto-improvement remains draft/proposal/governance metadata only. Active Skill, Harness, and Instruction records are not mutated by auto-improvement draft changes.

## Migrated Registry Boundaries

- Skill create/status/approval/eval/eval-result/rollback API and service paths.
- Harness create/status/approval/eval/eval-result/rollback API and service paths.
- Instruction create/status/approval/eval/eval-result/checksum/rollback API and service paths.
- Registry package export/import mutation paths.
- Registry approval queue and audit reads with optional request context.
- Registry resolver task context reads with optional request context.

Compatibility actor ids remain supported for local callers and tests. When an explicit actor id is used without RequestContext/AuthContext, audit metadata marks `compatibilityActorFallback=true`.

## Migrated Governance Boundaries

- Auto-improvement cluster analysis, candidate generation, proposal generation, draft registry change preparation, and readiness checks accept optional context.
- Governance decision recording accepts RequestContext/AuthContext and records context metadata.
- Proposal eval run attachment records context metadata.
- Canary readiness and apply gate checks record context metadata.
- Apply attempts still return a blocked/forbidden result and do not mutate active registry entries.
- Draft registry change status transitions can carry context metadata.

## Service Account Usage

`registry_governance_service` and `improvement_governance_service` remain static mock service-account catalog entries. They can create mock-first service-account RequestContext values through `ServiceAccountContextFactory`.

Service accounts do not bypass policy. `improvement.apply` remains denied by policy and by governance apply gate behavior.

## Policy Integration

Registry mutation authorization continues to flow through `RegistryMutationAuthorizer`; API composition uses `PolicyBackedRegistryMutationAuthorizer`. Policy subjects now include request id, correlation id, auth mode, source, principal id, actor kind, service account id, teams, roles, and sanitized metadata where available.

Policy deny still wins. Admin or service-account attribution does not bypass deny-by-default rules, approval/eval/checksum/lifecycle gates, or apply gates.

## Audit And Correlation

Migrated audit records may include:

- `requestId`
- `correlationId`
- `actorId`
- `principalId`
- `actorKind`
- `serviceAccountId`
- `authMode`
- `source`
- `policyDecisionId`
- `authorizationDecisionId` where available
- sanitized `metadata`

No raw headers, cookies, tokens, session ids, API keys, secret values, env values, or provider credentials are stored.

## Compatibility Fallbacks

Remaining compatibility fallbacks are intentional:

- Legacy registry service callers can still pass `actor` or `actorId`.
- Seed/test fixtures still use deterministic mock actors.
- Core data models retain legacy `createdBy`, `requestedBy`, `approvedBy`, and `createdByActorId` style fields where those fields are part of the persisted/read model contract.
- Some read-only dashboard/readiness registry/governance panels aggregate existing read models without full tenant/team scoping.

These fallbacks are documented in `docs/reference/registry-governance-request-context-inventory.md`.

## Test Strategy

Coverage includes:

- Registry mutation with RequestContext and audit/correlation metadata.
- Registry policy deny for viewer context.
- Deterministic compatibility actor fallback metadata.
- Registry resolver gates unchanged for pending approval entries.
- Registry governance service-account context attribution.
- Governance decision/eval/canary/apply gate RequestContext metadata.
- Improvement governance service-account apply gate attribution while apply remains blocked.
- Representative API registry and governance route propagation.
- No-secret/no-env regression checks.

## Known Limitations

- Production auth, tenant isolation, and durable scoped authorization are future work.
- Registry read/resolve paths carry optional metadata but do not enforce production tenant/team scoping.
- Registry/Governance still expose legacy actor fields for compatibility.
- Dashboard/readiness registry/governance scoping remains future planning.
- Apply remains blocked; real eval/canary execution remains out of scope.

Dashboard/Readiness Tenant Scope Planning v1 inventories registry and governance dashboard/readiness panels as target tenant/team/project/registry-package/audit-query scoped surfaces. It does not mutate active registry entries, approve proposals, execute evals/canaries, or enforce package-level tenant filtering.

## Recommended Next Task

Recommended next task: OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.
