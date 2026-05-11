# Phase 3 Operational Hardening v2

## What v2 Adds Over v1

Phase 3 Registry v1 added repository boundaries, stable DTOs, mutation audit logs, approval/eval gates, and local checksum verification.

Operational Hardening v2 adds:

- Append-only registry history through `RegistryRevision`.
- Rollback for Skill, Harness, and InstructionArtifact records.
- Approval queue read models.
- Local/manual/mock eval result attachment.
- Provider-agnostic mutation authorization with mock RBAC enforcement.
- Stable DTOs for revisions, rollback results, approval queue items, eval results, actors, and authorization decisions.
- API endpoints and dashboard visibility for these operational controls.

This remains mock-first and local-only. It does not add signed artifacts, real artifact registry integration, real SSO/SCIM/RBAC, eval suite execution, or Phase 4 auto-improvement.

## Registry History Model

`RegistryRevision` records an append-only snapshot for a registry target:

- target kind, id, name, and version
- monotonically increasing revision number
- full target snapshot
- snapshot checksum
- change reason
- actor id
- source audit log id when available

Create operations write revision 1. Mutations create new revisions. Existing seed records get an initial revision before their first mutation.

## Rollback Model

Rollback restores a previous revision by writing a new current record state and appending:

- a `rollback` audit log
- a new `RegistryRevision`

Rollback does not delete old history and does not bypass resolver gates. If a rollback restores a draft, pending approval, failed eval, or checksum mismatch state, normal resolver exclusion rules still apply.

## Approval Queue Read Model

`RegistryApprovalQueueItem` exposes pending or rejected registry items without adding a workflow engine dependency.

The default queue shows pending approvals and excludes archived records. Optional filters support target kind, approval status, owner, and archived inclusion.

## Local Eval Result Attachment

`RegistryEvalResult` records manually supplied local/manual/mock eval metadata:

- eval name and type
- status
- score fields when supplied
- summary and details
- attachment actor and source

Attaching an eval result appends an audit log. When `updateEvalStatus` is true, it updates the registry entry's `evalStatus`; resolver selection still uses only `evalStatus`, not raw eval result details.

## Mutation Auth/RBAC Design

`RegistryMutationAuthorizer` is a provider-agnostic interface:

```text
authorize(actor, permission, target) -> decision
```

`MockRegistryMutationAuthorizer` implements deterministic role permissions:

- `registry_viewer`: read, audit read, history read
- `registry_editor`: create, update, status change, checksum verify
- `registry_reviewer`: approval change and eval change
- `registry_admin`: all registry permissions, including rollback
- `system`: all registry permissions for setup paths

The API still uses the deterministic `mock-admin` actor because real authentication is not implemented. Service-level tests cover denied mutation paths.

## API Endpoints

v2 adds:

- `GET /registry/approval-queue`
- `GET /registry/skills/:id/history`
- `POST /registry/skills/:id/rollback`
- `GET /registry/skills/:id/eval-results`
- `POST /registry/skills/:id/eval-results`
- `GET /registry/harnesses/:id/history`
- `POST /registry/harnesses/:id/rollback`
- `GET /registry/harnesses/:id/eval-results`
- `POST /registry/harnesses/:id/eval-results`
- `GET /registry/instructions/:id/history`
- `POST /registry/instructions/:id/rollback`
- `GET /registry/instructions/:id/eval-results`
- `POST /registry/instructions/:id/eval-results`

Existing Registry v0/v1 endpoints remain intact.

## Dashboard Changes

The dashboard now exposes:

- registry history counts
- rollback availability indicator
- approval queue entries
- latest eval result summary
- registry audit events
- resolver warnings on task details

The dashboard remains a deterministic MVP/demo surface and still does not implement real multi-user approval UI.

## Tests

Tests cover:

- revision creation on create/status/approval/eval/checksum changes
- append-only history behavior
- rollback for skills, harnesses, and instructions
- rollback audit logs and resolver gate behavior
- approval queue filtering and DTO mapping
- eval result attachment and query behavior
- mock RBAC allow/deny behavior
- API history, rollback, approval queue, and eval result endpoints
- dashboard assumptions for v2 visibility
- Phase 1/2/3 regression behavior

## Known Limitations

- No signed artifacts.
- No real artifact registry.
- No real SSO, SCIM, OAuth, or production RBAC.
- No full approval workflow.
- No eval suite execution.
- No semver range resolution.
- No import/export workflow.
- No policy-as-code enforcement.
- Dashboard still uses seeded demo data instead of a production API client/read model.

## Next Recommended Task

Stay in Phase 3 and implement Registry Packaging v3:

- local registry import/export
- stable registry package manifest
- semver range resolution v0
- rollback API refinements
- mutation auth error DTOs
- no signed artifacts or real artifact registry yet
