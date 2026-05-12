# Phase 3 Operational Hardening v2 Plan

## Current Phase 3 v1 Capabilities

Phase 3 Registry Hardening v1 is implemented in code, not only documented:

- Separate `SkillPackage`, `HarnessDefinition`, and `InstructionArtifact` domain models exist in `packages/core/src/domain/models.ts`.
- Registry repository interfaces, in-memory storage, and file-backed local storage exist in `packages/registry/src/index.ts`.
- `RegistryService` owns registry mutations and resolution.
- Stable DTO mappers exist for skills, harnesses, instructions, registry resolution, and registry audit logs.
- Registry mutation audit logs are appended for creates, status changes, approval/eval changes, and checksum verification.
- Approval, eval, lifecycle, and instruction checksum gates are enforced by the registry resolver.
- Task execution records selected skill, harness, and instruction refs on `TaskRun`.
- API and dashboard surfaces expose Registry v1 data.

## Current Registry Repository Boundary

The current boundary is centered in `packages/registry/src/index.ts`:

- `SkillRegistryRepository`
- `HarnessRegistryRepository`
- `InstructionRegistryRepository`
- `RegistryAuditRepository`

`InMemoryRegistryRepository`, `FileBackedRegistryRepository`, and `InMemoryAichestraStore` implement the current repository shape. `RegistryService` depends on these interfaces rather than concrete storage.

## Current DTO Boundary

Registry API responses are mapped through DTO functions:

- `skillToDto`
- `harnessToDto`
- `instructionToDto`
- `registryResolutionToDto`
- `registryAuditLogToDto`

API handlers call these mappers and do not intentionally expose raw registry domain records from `/registry/*` endpoints.

## Current Audit Log Behavior

`RegistryAuditLogEntry` exists and records:

- create
- update/status changes
- approval and rejection
- eval passed/failed markers
- archive/restore
- checksum verification success/failure

The current mock actor defaults to `mock-admin`.

## Current Approval, Eval, And Checksum Behavior

Registry records include:

- `approvalStatus`
- `evalStatus`
- lifecycle `status`

Instruction records also include:

- `checksum`
- `checksumAlgorithm`
- `checksumStatus`
- `checksumVerifiedAt`

Resolver selection only includes active entries with allowed approval/eval states and excludes checksum mismatches.

## Existing Gaps

| Capability | Current State |
|---|---|
| Registry history | missing |
| Rollback | missing |
| Approval queue read model | missing |
| Eval result attachment | missing |
| Mutation auth/RBAC | missing beyond a mock actor id |
| Signed artifacts | missing and out of scope |
| Real artifact registry | missing and out of scope |
| Full approval workflow | missing and out of scope |
| Eval suite execution | missing and out of scope |

## v2 Implementation Scope

This task will add:

- Append-only `RegistryRevision` history.
- Rollback support that restores a previous snapshot by creating a new revision.
- Approval queue read models for pending/rejected registry entries.
- Local/manual/mock `RegistryEvalResult` attachment without running eval suites.
- Provider-agnostic `RegistryMutationAuthorizer` with mock role enforcement.
- Stable DTOs for revisions, rollback, approval queue items, eval results, actors, and authorization decisions.
- API visibility for history, rollback, approval queue, and eval results.
- Dashboard visibility for history counts, approval queue, latest eval result, audit events, and resolver warnings.
- Deterministic tests for history, rollback, eval attachments, approval queue, and mock RBAC.

## Out Of Scope

- Real authentication, SSO, SCIM, or enterprise RBAC integration.
- Signed artifact verification.
- Real artifact registry integration.
- Eval suite execution.
- Automatic Skill, Harness, or Instruction improvement.
- Policy-as-code enforcement.
- Phase 4 auto-improvement loops.
