# Phase 3 Registry Hardening v1

## What v1 Adds Over Registry v0

Registry v0 introduced separate Skill, Harness, and InstructionArtifact concepts, in-memory registries, exact version refs, registry APIs, registry-backed task selection, TaskRun selected refs, and dashboard visibility.

Registry Hardening v1 adds:

- Repository interfaces for registry storage.
- In-memory and file-backed repository implementations behind those interfaces.
- A `RegistryService` boundary for registry mutations and resolution.
- Stable DTOs and mappers for API responses.
- Registry mutation audit logs.
- Approval and eval statuses.
- Resolver enforcement for lifecycle, approval, eval, and instruction checksum status.
- Local instruction checksum verification for body and safe repo-relative files.
- API endpoints for audit, approval, eval, and checksum verification.
- Dashboard visibility for approval, eval, checksum, audit state, and registry warnings.

This remains mock-first and local-only. It does not add real artifact registry integration, signed artifacts, real provider calls, or Phase 4 auto-improvement behavior.

## Repository Boundary Design

Repository interfaces live in `packages/registry/src/index.ts`:

- `SkillRegistryRepository`
- `HarnessRegistryRepository`
- `InstructionRegistryRepository`
- `RegistryAuditRepository`

Required storage methods include list, get by id, get by name/version, create, update, and status update for each registry kind. Audit repositories support append, list, and target-specific list operations.

Implementations:

- `InMemoryRegistryRepository` supports deterministic tests and local demo behavior.
- `FileBackedRegistryRepository` persists a registry snapshot to a local JSON file. It does not require an external database service.
- `InMemoryAichestraStore` implements the same repository shape for the current MVP apps.

`RegistryService` depends on repository interfaces, not concrete storage.

## DTO Boundary Design

Registry API responses now use explicit DTO mappers:

- `SkillDto`
- `HarnessDto`
- `InstructionArtifactDto`
- `RegistryResolutionDto`
- `RegistryAuditLogDto`

Mappers:

- `skillToDto`
- `harnessToDto`
- `instructionToDto`
- `registryResolutionToDto`
- `registryAuditLogToDto`

DTOs include stable public fields such as lifecycle status, approval status, eval status, and instruction checksum status. API handlers no longer return registry domain records directly from `/registry/*` endpoints.

## Audit Log Model

`RegistryAuditLogEntry` is a domain model with:

- `id`
- `actorId`
- `action`
- `targetKind`
- `targetId`
- `targetName`
- `targetVersion`
- optional `before`
- optional `after`
- optional `reason`
- `createdAt`

Supported actions:

- `create`
- `update`
- `status_change`
- `approve`
- `reject`
- `mark_eval_passed`
- `mark_eval_failed`
- `archive`
- `restore`
- `checksum_verified`
- `checksum_failed`

The MVP actor defaults to `mock-admin`.

## Approval And Eval Status Model

Skills, harnesses, and instruction artifacts now include:

```text
approvalStatus: not_required | pending | approved | rejected
evalStatus: not_required | pending | passed | failed
```

Lifecycle status is still separate:

```text
status: draft | active | deprecated | archived
```

## Resolver Enforcement Rules

By default, resolver-selected entries must satisfy:

- `status = active`
- `approvalStatus = not_required | approved`
- `evalStatus = not_required | passed`

Instruction artifacts must also avoid:

- `checksumStatus = mismatch`

Excluded entries produce deterministic warnings, for example:

```text
skill auth-debugging@1.0.0 excluded: approvalStatus is pending.
instruction org-secure-coding-baseline@1.0.0 excluded: checksumStatus is mismatch.
```

TaskRun still records:

- selected skill refs
- selected harness ref
- selected instruction refs
- registry warnings
- registry errors

## Instruction Checksum Verification

Instruction artifacts now include:

- `checksum`
- `checksumAlgorithm`
- `checksumStatus`
- `checksumVerifiedAt`

v1 supports SHA-256 verification for:

- instruction body content
- safe repo-relative file paths

Path verification refuses unsafe paths:

- absolute paths
- paths containing `..`
- paths resolving outside the supplied repo root

Unsafe or unreadable paths return `checksumStatus = unavailable`. Mismatched content returns `checksumStatus = mismatch` and is excluded by the resolver.

## API Endpoints

Existing Registry v0 endpoints remain:

- `GET /registry/skills`
- `GET /registry/skills/:id`
- `POST /registry/skills`
- `PATCH /registry/skills/:id/status`
- `GET /registry/harnesses`
- `GET /registry/harnesses/:id`
- `POST /registry/harnesses`
- `PATCH /registry/harnesses/:id/status`
- `GET /registry/instructions`
- `GET /registry/instructions/:id`
- `POST /registry/instructions`
- `PATCH /registry/instructions/:id/status`
- `POST /registry/resolve`

v1 adds:

- `GET /registry/audit`
- `GET /registry/audit?targetKind=skill&targetId=<id>`
- `PATCH /registry/skills/:id/approval`
- `PATCH /registry/skills/:id/eval`
- `PATCH /registry/harnesses/:id/approval`
- `PATCH /registry/harnesses/:id/eval`
- `PATCH /registry/instructions/:id/approval`
- `PATCH /registry/instructions/:id/eval`
- `POST /registry/instructions/:id/verify-checksum`

## Dashboard Changes

Dashboard views now expose:

- approval status for skills, harnesses, and instructions
- eval status for skills, harnesses, and instructions
- checksum status for instructions
- registry resolution warnings on task run details
- recent registry audit event count/list state

The dashboard remains a simple MVP surface and still uses seeded local demo data.

## Test Strategy

Tests cover:

- in-memory repository behavior
- file-backed repository persistence
- services depending on repository interfaces
- DTO mapping
- audit log creation for registry mutations
- approval and eval update audit actions
- checksum verification audit actions
- resolver exclusion for pending/rejected approval
- resolver exclusion for failed eval
- resolver exclusion for checksum mismatch
- body checksum verification
- safe local fixture file verification
- unsafe path unavailable behavior
- task workflow warnings and usage attribution
- API audit/approval/eval/checksum endpoints
- dashboard hardening visibility

## Known Limitations

- File-backed persistence is local-only and not a production database.
- No signed artifact verification.
- No real artifact registry integration.
- No full multi-user approval workflow.
- No eval suite execution.
- No rollback.
- No semver range resolution.
- No registry import/export.
- No mutation auth/RBAC.
- No policy-as-code enforcement.

## Next Recommended Task

Continue Phase 3 hardening with:

- registry rollback/history
- stable mutation DTOs and error DTOs
- approval queue read models
- local eval result attachment without running LLMs
- registry mutation auth/RBAC design

Do not proceed to Phase 4 until registry rollback, approval/eval operational model, and registry policy boundaries are clearer.
