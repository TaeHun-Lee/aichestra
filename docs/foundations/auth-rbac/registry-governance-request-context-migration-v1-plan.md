# Registry/Governance RequestContext Migration v1 Plan

## Status Before Implementation

RequestContext Propagation v1, API AuthContext Middleware Skeleton v1, and Service Account Actor Boundary v1 are implemented as mock-first attribution layers. Production Auth/RBAC remains planning-only: no real OIDC, SAML, SCIM, SSO, login/logout, session handling, JWTs, API keys, service-account credentials, external IdP calls, or production tenant enforcement exists.

## Current RequestContext Behavior

`packages/auth` owns `RequestContext`, `CorrelationContext`, `RequestContextResolver`, and `ApiRequestContextMiddleware` integration through `apps/api/src/request-context-middleware.ts`. API routes resolve one cached request context at ingress where practical. AuthContext-to-PolicySubject mapping already includes request id, correlation id, source, actor id, principal id, actor kind, roles, teams, auth mode, mock marker, and service account id when available.

## Current Service Account Behavior

Service Account Actor Boundary v1 added a static mock catalog and `ServiceAccountContextFactory`. `registry_governance_service` and `improvement_governance_service` exist as active mock catalog entries, but prior to this task their runtime use is documented only. They do not issue credentials, tokens, JWTs, API keys, sessions, or client secrets.

## Current Registry Actor Model

`packages/registry` uses `RegistryActor` with registry-specific roles: `registry_viewer`, `registry_editor`, `registry_reviewer`, `registry_admin`, and `system`. `RegistryService` mutation methods accept explicit `actor`, `actorId`, or default to `mock-admin`. Registry audit logs and revisions currently store actor id and mutation details, but do not consistently carry request id, correlation id, auth mode, principal id, actor kind, service account id, or source.

## Current Governance Actor Model

`packages/improvement` governance services accept explicit actor ids or deterministic mock defaults such as `mock-admin` and `mock-auto-improvement`. Governance decisions, eval run attachment, canary readiness checks, apply gate checks, and governance audit events remain in-memory and mock-only. Apply is always blocked and active registry records are not mutated by auto-improvement.

## Current Registry Mutation Authorization

Registry mutations are protected by `RegistryMutationAuthorizer`; the default is deterministic mock RBAC and the API composition wraps it with `PolicyBackedRegistryMutationAuthorizer`. Policy-as-code remains deny-by-default for risky actions, and registry resolver gates still enforce lifecycle, approval, eval, and checksum status.

## Current Improvement/Governance Apply Gates

Auto-improvement remains draft-only. `allowAutoApply=false`, human approval, eval pass, and canary requirements remain enabled by default. Governance v1 records decisions and gate checks, but does not execute evals, run canaries, apply draft changes, or mutate active registry entries.

## Current Audit Behavior

Registry audit logs and improvement governance audit events are normalized by Observability v0. They are sanitized but currently lack consistent request-context dimensions in registry/governance mutation paths.

## Proposed Migration Strategy

- Add optional `RequestContext`/`AuthContext` inputs to high-value registry mutation and governance methods without breaking existing actor-id callers.
- Map request-derived AuthContext into `RegistryActor` roles conservatively: platform/system admin -> registry admin, developer -> registry editor, reviewer -> registry reviewer, other read roles -> registry viewer.
- Preserve explicit `actor`/`actorId` as compatibility fallback and mark fallback metadata in audit records.
- Enrich registry audit logs, registry revisions, registry eval results, governance decisions, proposal eval runs, canary readiness, apply gates, draft changes, and governance audit events with safe request/correlation/source/auth metadata where available.
- Use `registry_governance_service` and `improvement_governance_service` metadata for service/system-originated fallback paths where practical.
- Keep PolicyBackedRegistryMutationAuthorizer as the registry mutation gate, now with request-context-enriched policy subjects.
- Pass API ingress `RequestContext` into representative `/registry/*` and `/improvement/*` mutation paths.

## Risky Areas To Avoid

- Do not change resolver lifecycle/approval/eval/checksum behavior.
- Do not allow service accounts to bypass policy, approval, eval, checksum, rollback, or apply gates.
- Do not mutate active registry entries from auto-improvement or draft registry changes.
- Do not implement real production authentication or service-account credential issuance.
- Do not introduce external provider calls, artifact registry integration, eval execution, canary rollout execution, or auto-apply.
- Do not remove legacy actor fields used by tests or older local callers.

## What This Task Implements

- Registry/Governance request-context inventory.
- Optional request/auth context attribution in RegistryService and governance services.
- Audit/correlation enrichment for migrated registry and governance paths.
- Service-account metadata use for registry/governance service-originated fallback paths.
- Representative API route migration for registry and improvement/governance mutations.
- Deterministic tests for registry context, governance context, policy denial, service account fallback, API propagation, no-secret behavior, and apply gate blocking.

## Out Of Scope

- Production auth, tenant isolation, session/token handling, IdP integration, durable auth repositories, real service-account credentials, credential rotation, artifact registry, signed artifacts, real eval execution, canary rollout execution, automatic apply, active registry mutation from auto-improvement, and production governance enablement.

