# Auth and RBAC Readiness

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

## Proposed Actor Model

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

## Why Real Auth Is Out of Scope Here

Real Integration Foundation v0 only prepares storage and boundaries. Adding real auth now would require provider configuration, secrets, session management, token validation, policy review, and enterprise controls that belong in a later integration or Phase 5 task.
