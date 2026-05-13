# Auth and RBAC Readiness

Status update: Production Auth/RBAC Planning v0 is implemented in `docs/foundations/auth-rbac/v0.md` and `packages/auth`. Production Auth/RBAC v1 Planning is implemented in `docs/foundations/auth-rbac/v1-plan.md`, `docs/roadmaps/auth-rbac-production/v1.md`, `docs/reference/production-rbac-permission-matrix.md`, and read-only readiness models in `packages/deployment-readiness`. This readiness note remains the earlier foundation snapshot; the canonical designs are now the versioned auth/RBAC foundation and roadmap documents.

## Current Mock Actor Behavior

The current MVP uses deterministic mock actors:

- Registry mutation defaults use `mock-admin` or service-supplied actor ids.
- Registry mutation authorization is behind `RegistryMutationAuthorizer`.
- Governance decisions and eval attachments use mock actor ids when no actor is supplied.
- API routes do not authenticate callers.

## Where Actor IDs Are Recorded

- `RegistryAuditLogEntry.actorId`
- `RegistryRevision.createdBy`
- `RegistryEvalResult.attachedBy`
- `ProposalGovernanceDecision.actorId`
- `ProposalEvalRun.attachedBy`
- `ImprovementGovernanceAuditEvent.actorId`
- Generic `AuditLog.actorUserId`
- `UsageEvent.userId`

## Mutations That Require Real Authorization Before Production

- Task creation and task run triggering.
- Registry create/update/status/approval/eval/checksum/rollback/import.
- Package import and future signed package verification.
- Proposal decisions.
- Proposal eval run attachment.
- Canary plan changes.
- Future proposal apply behavior.
- Future real Git writes and PR creation.
- Future real LLM usage through virtual keys.

## Implemented v0 Actor Model

Auth/RBAC v0 defines provider-neutral `Principal`, `Actor`, `Team`, `Role`, `Permission`, `ResourceScope`, `RoleBinding`, `ServiceAccount`, `IdentityProvider`, `AuthContext`, `RequestContext`, and `AuthAuditEvent` models. `MockAuthProvider` is the default and marks all resolved contexts as mock, not production auth.

No password fields, OAuth tokens, SSO tokens, session secrets, API-key raw values, provider credentials, or credential-cache paths are stored in auth models.

## Earlier Proposed Actor Model

```ts
type Actor = {
  id: string;
  displayName: string;
  email?: string;
  roles: string[];
  teams?: string[];
  authProvider?: "mock" | "sso" | "service_account";
};
```

## Proposed Roles

- `viewer`
- `task_operator`
- `registry_editor`
- `registry_reviewer`
- `governance_reviewer`
- `integration_operator`
- `admin`
- `system`

## Proposed Permissions

- `task.read`
- `task.create`
- `task.run`
- `usage.read`
- `conflict.read`
- `merge_queue.manage`
- `registry.read`
- `registry.create`
- `registry.update`
- `registry.status.change`
- `registry.approval.change`
- `registry.eval.change`
- `registry.checksum.verify`
- `registry.rollback`
- `registry.package.import`
- `registry.audit.read`
- `improvement.read`
- `improvement.proposal.decide`
- `improvement.eval.attach`
- `improvement.canary.plan`
- `improvement.apply.evaluate`
- `git.pr.create`
- `llm.invoke`

## SSO and SCIM Plug-In Point

Future Phase 5 work should introduce:

- Identity provider connector for SSO.
- SCIM sync for users, teams, and role assignments.
- Request authentication middleware in `apps/api`.
- Actor resolution before service calls.
- Durable authorization decisions and audit events.

Production Auth/RBAC v1 Planning refines this into IdP option comparison, tenant/scope modeling, service-account/system actor planning, request context propagation, and mock actor deprecation. It does not implement real SSO, SCIM, sessions, token validation, or tenant enforcement.

## Why Real Auth Is Out of Scope Here

Real Integration Foundation v0 only prepared storage and boundaries. Production Auth/RBAC Planning v0 now adds mock-first auth/RBAC scaffolding, but real auth remains out of scope because it requires provider configuration, secrets, session management, token validation, policy review, tenant scoping, and enterprise controls that belong in a later task.
