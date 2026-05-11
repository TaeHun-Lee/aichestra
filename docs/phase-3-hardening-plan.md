# Phase 3 Registry Hardening Plan

## Current Phase 3 v0 State

Phase 3 Registry v0 currently implements:

- Separate `SkillPackage`, `HarnessDefinition`, and `InstructionArtifact` domain concepts.
- Exact `RegistryVersionRef` pinning.
- In-memory seed data for skills, harnesses, and instructions.
- A deterministic registry resolver in `packages/registry/src/index.ts`.
- Registry-backed task selection in `apps/worker/src/workflows/run-agent-task-workflow.ts`.
- Registry API visibility in `apps/api/src/main.ts`.
- Dashboard visibility for registry counts, registry lists, and selected task-run refs.
- Tests for registry domain separation, resolver defaults, API visibility, and task integration.

## Current Storage Implementation

Registry storage is currently in-memory:

- `InMemoryAichestraStore` owns arrays for `skills`, `harnesses`, and `instructions`.
- `packages/registry/src/index.ts` also exposes in-memory registry classes backed by a `RegistrySnapshot`.
- There is a Prisma schema draft, but no persistent registry repository implementation is used by tests or apps.

## Current API Boundary

Registry API handlers currently expose internal domain objects directly:

- `GET /registry/skills` returns `SkillPackage[]`.
- `GET /registry/harnesses` returns `HarnessPackage[]`.
- `GET /registry/instructions` returns `InstructionArtifact[]`.
- `POST /registry/resolve` returns `RegistryResolution`.

There are no stable DTO mappers yet.

## Current Audit Behavior

General application audit logs exist through `InMemoryAichestraStore.recordAudit`, but registry mutations do not append registry-specific audit log entries.

Current registry mutation endpoints:

- `POST /registry/skills`
- `PATCH /registry/skills/:id/status`
- `POST /registry/harnesses`
- `PATCH /registry/harnesses/:id/status`
- `POST /registry/instructions`
- `PATCH /registry/instructions/:id/status`

These mutate the in-memory store without a dedicated registry audit trail.

## Current Approval And Eval Statuses

`SkillPackage`, `HarnessDefinition`, and `InstructionArtifact` currently have lifecycle `status` only:

- `draft`
- `active`
- `deprecated`
- `archived`

They do not yet have `approvalStatus` or `evalStatus` fields.

## Current Resolver Enforcement

The resolver currently selects entries only by:

- lifecycle `status = active`
- task text heuristics
- requested skill/harness ids
- agent applicability for instructions
- repo applicability for instructions

Approval and eval statuses do not exist and therefore do not affect selection. Instruction checksum status also does not affect selection.

## Current Instruction Checksum State

`InstructionArtifact` has a `checksum` field, but there is no:

- checksum algorithm field
- checksum verification status
- checksum verification timestamp
- checksum calculation for body or local file content
- resolver exclusion for checksum mismatch

## v1 Implementation Scope

This hardening pass will implement:

- Repository interfaces for skill, harness, instruction, and registry audit persistence.
- In-memory repository implementations for deterministic tests.
- A file-backed local registry repository for simple local persistence behind the same interfaces.
- Registry services that depend on repository interfaces rather than concrete storage.
- Stable DTOs and mapping functions for registry API responses.
- Registry audit log domain model and audit repository behavior.
- Audit logs for create, status changes, approval changes, eval changes, and checksum verification.
- `approvalStatus` and `evalStatus` fields on skills, harnesses, and instructions.
- Resolver gates for lifecycle, approval, eval, and instruction checksum status.
- Local checksum verification for instruction body and safe repo-relative file paths.
- API endpoints for audit query, approval update, eval update, and instruction checksum verification.
- Dashboard visibility for approval, eval, checksum, audit, and registry resolution warnings.
- Deterministic tests for repository boundaries, DTOs, audit logs, approval/eval gates, checksum verification, API behavior, and task integration.

## Out Of Scope

This task will not implement:

- Real artifact registry integration.
- Signed artifact verification.
- Real GitHub, GitLab, Bitbucket, LLM, MCP, Vault, Kubernetes, or Temporal integration.
- Real remote git fetch, push, merge, or rebase.
- Automatic Skill or Harness improvement.
- Full multi-user approval workflow.
- Eval suite execution.
- Semver range resolution.
- Rollback.
- Registry import/export.
- Production auth/RBAC for registry mutation.
- Policy-as-code enforcement.
