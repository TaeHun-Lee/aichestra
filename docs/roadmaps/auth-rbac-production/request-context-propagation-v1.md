# Request Context Propagation v1

Status: `v1_implemented` as a mock-first attribution/correlation layer. API AuthContext Middleware Skeleton, Service Account Actor Boundary, and Registry/Governance RequestContext Migration are also `v1_implemented`. This document remains the production roadmap; the implemented foundations are documented in `docs/foundations/auth-rbac/request-context-propagation-v1.md`, `docs/foundations/auth-rbac/api-authcontext-middleware-v1.md`, `docs/foundations/auth-rbac/service-account-actor-boundary-v1.md`, and `docs/foundations/auth-rbac/registry-governance-request-context-migration-v1.md`.

Production Auth/RBAC v1 planning defines how request identity should move through the control plane. RequestContext Propagation v1 implements the first non-production slice and does not implement production authentication middleware.

## Current Behavior

- `RequestContextResolver` creates API, system, test, webhook, dashboard, and readiness contexts.
- `ApiRequestContextMiddleware` resolves one cached API ingress context per HTTP request where practical and exposes safe request-context summaries.
- `ServiceAccountContextFactory` creates explicit mock service-account contexts for selected service/system fallbacks.
- Registry/Governance RequestContext Migration v1 propagates request/auth context into selected registry mutation and governance/apply-gate paths.
- `AuthContext` maps to `PolicySubject` for actor, principal, roles, teams, auth mode, service account id, and mock actor marker.
- `CorrelationContext` carries request/correlation/source/task/run dimensions for audit and observability paths.
- `/auth/*` paths use the Auth/RBAC boundary.
- SecretRef credential resolution can use `AuthorizationService` before env reads.

## Current Gaps

- Some API handlers and services still pass ad hoc actor ids after ingress context is available.
- Worker/background-style paths still need persisted scoped actor snapshots.
- Git, webhook, LLM, MCP, runner, Local Agent, registry, and improvement flows have partial service-account/request-context attribution.
- Dashboard/readiness paths are read-only and safe, but not tenant scoped.
- Correlation/request ids are not uniformly propagated into every audit record.

## Target Contract

Every protected operation should receive:

- request id;
- correlation id;
- actor id;
- principal id;
- auth mode;
- service account id when applicable;
- tenant/workspace/project/repo scope when available;
- source boundary such as API, worker, webhook, Local Agent, or system.

## Boundary Requirements

| Boundary | Requirement | Status |
|---|---|---|
| API | resolve request context before service calls | implemented skeleton / partial service migration |
| worker | carry initiating actor and scoped service account | future |
| Git provider | use user or service account context for branch/PR/webhook actions | partial / service-account fallback implemented |
| LLM Gateway | use actor/service account for route, budget, credential, and completion decisions | partial / service-account fallback implemented |
| MCP Gateway | use actor context for server/tool list and invocation decisions | partial / service-account fallback implemented |
| Runner | preserve requester and worker service account attribution | partial |
| Registry/Improvement | preserve reviewer/admin actor on mutations and decisions | partial / high-value migration implemented |
| Local Agent | bind user, host, consent, and invocation to tenant-scoped identity | future |
| Dashboard/readiness | read-only now; tenant filters future | partial |

Detailed coverage is tracked in `docs/reference/request-context-propagation-inventory.md`.

## Migration Strategy

1. Inventory service methods that accept plain actor strings.
2. Add non-breaking helper overloads that accept `RequestContext` or `AuthContext`.
3. Route handlers should reuse cached API context instead of constructing route-local context.
4. Propagate request and correlation ids into audit events.
5. Add tenant/workspace/project/repo fields once the tenant model is approved.
6. Fail production profile if a protected boundary lacks actor and scope attribution.

## Test Strategy

- Unit tests for request-context helper creation.
- API tests proving `/readiness/auth/*` and `/dashboard/auth-production` expose planning metadata only.
- Future integration tests proving Git, LLM, MCP, runner, Local Agent, SecretRef, registry/governance, and audit paths carry actor/principal/scope.
