# Request Context Propagation Plan v1

Production Auth/RBAC v1 planning defines how request identity should move through the control plane. It does not refactor every service boundary or implement production authentication middleware.

## Current Behavior

- `RequestContextResolver` creates API, system, and test contexts.
- `AuthContext` maps to `PolicySubject` for actor, principal, roles, teams, auth mode, service account id, and mock actor marker.
- `/auth/*` paths use the Auth/RBAC boundary.
- SecretRef credential resolution can use `AuthorizationService` before env reads.

## Current Gaps

- Some API handlers still pass ad hoc actor ids.
- Worker/background-style paths synthesize system actors.
- Git, webhook, LLM, MCP, runner, registry, improvement, and Local Agent flows do not consistently receive a full `AuthContext`.
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
| API | resolve request context before service calls | partial |
| worker | carry initiating actor and scoped service account | future |
| Git provider | use user or service account context for branch/PR/webhook actions | partial |
| LLM Gateway | use actor/service account for route, budget, credential, and completion decisions | partial |
| MCP Gateway | use actor context for server/tool list and invocation decisions | partial |
| Runner | preserve requester and worker service account attribution | future |
| Registry/Improvement | preserve reviewer/admin actor on mutations and decisions | partial |
| Local Agent | bind user, host, consent, and invocation to tenant-scoped identity | future |
| Dashboard/readiness | read-only now; tenant filters future | partial |

## Migration Strategy

1. Inventory service methods that accept plain actor strings.
2. Add non-breaking helper overloads that accept `RequestContext` or `AuthContext`.
3. Propagate request and correlation ids into audit events.
4. Add tenant/workspace/project/repo fields once the tenant model is approved.
5. Fail production profile if a protected boundary lacks actor and scope attribution.

## Test Strategy

- Unit tests for request-context helper creation.
- API tests proving `/readiness/auth/*` and `/dashboard/auth-production` expose planning metadata only.
- Future integration tests proving Git, LLM, MCP, runner, Local Agent, SecretRef, and audit paths carry actor/principal/scope.
