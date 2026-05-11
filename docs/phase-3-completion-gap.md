# Phase 3 Completion Gap

## Phase 3 Implemented Through v3

| Capability | Status | Evidence |
|---|---|---|
| Registry domain models | implemented | `SkillPackage`, `HarnessDefinition`, `InstructionArtifact`, `RegistryVersionRef`, and `RegistryResolution` in `packages/core/src/domain/models.ts` |
| In-memory registries | implemented | `InMemorySkillRegistry`, `InMemoryHarnessRegistry`, and `InMemoryInstructionRegistry` in `packages/registry/src/index.ts` |
| Registry APIs | implemented | `/registry/skills`, `/registry/harnesses`, `/registry/instructions`, and `/registry/resolve` in `apps/api/src/main.ts` |
| Registry resolver | implemented | `resolveRegistryContextForTask` in `packages/registry/src/index.ts` |
| Task integration | implemented | `TaskRun` selected registry refs are recorded in `apps/worker/src/workflows/run-agent-task-workflow.ts` |
| Dashboard visibility | implemented | Registry overview and selected refs in `apps/web/lib/mock-data.ts`, `apps/web/app/page.tsx`, `apps/web/app/tasks/[id]/page.tsx`, and `apps/web/src/render.ts` |
| Repository boundary | implemented | `SkillRegistryRepository`, `HarnessRegistryRepository`, `InstructionRegistryRepository`, and `RegistryAuditRepository` in `packages/registry/src/index.ts` |
| Local file-backed registry repository | implemented | `FileBackedRegistryRepository` in `packages/registry/src/index.ts` |
| Stable registry DTOs | implemented | `SkillDto`, `HarnessDto`, `InstructionArtifactDto`, `RegistryResolutionDto`, and `RegistryAuditLogDto` plus mapping functions |
| Registry mutation audit logs | implemented | `RegistryAuditLogEntry`, `RegistryService`, and `/registry/audit` |
| Basic approval and eval enforcement | implemented | `approvalStatus`, `evalStatus`, resolver gates, and API update endpoints |
| Local instruction checksum verification | implemented | Body and safe repo-relative path verification through `POST /registry/instructions/:id/verify-checksum` |
| Registry history | implemented | `RegistryRevision`, `RegistryHistoryRepository`, service revision appends, and history APIs |
| Registry rollback | implemented | Rollback service/API support restores prior snapshots by creating new revisions and audit logs |
| Approval queue read model | implemented | `RegistryApprovalQueueItem`, `RegistryService.listApprovalQueue`, API visibility, and dashboard visibility |
| Local eval result attachment | implemented | `RegistryEvalResult`, eval result repository, service/API attachment, and dashboard visibility |
| Mock mutation auth/RBAC design | implemented | `RegistryActor`, roles, permissions, `RegistryMutationAuthorizer`, and `MockRegistryMutationAuthorizer` |
| Registry package manifests | implemented | `RegistryPackageManifest`, `RegistryPackageEntry`, and `RegistryPackageDependency` in `packages/core/src/domain/models.ts`; package export/import service behavior in `packages/registry/src/index.ts` |
| Local registry import/export | implemented | `RegistryService.exportPackageManifest`, `RegistryService.importPackageManifest`, package repository methods, and `/registry/packages/*` API endpoints |
| Dry-run package import | implemented | `POST /registry/packages/import/dry-run` and `RegistryPackageImportResult.dryRun` without audit/revision mutations |
| Semver range resolution v0 | implemented | Exact, caret, tilde, wildcard, and `latest` version resolution through `RegistryService.resolveVersion` and registry resolver support for `name@range` requests |
| Registry dependency metadata | implemented | Optional and required registry dependencies on Skill, Harness, and Instruction records with deterministic resolver warnings/errors |
| Package diff summaries | implemented | `RegistryPackageDiff` and `RegistryService.diffPackageManifests` with API and dashboard visibility |
| Tests | implemented | `tests/registry-v0.test.ts`, `tests/registry-hardening-v1.test.ts`, `tests/registry-operational-hardening-v2.test.ts`, registry additions in `tests/api-health.test.ts`, `tests/dashboard-data.test.ts`, and workflow assertions |

## Still Missing From Full Phase 3

| Gap | Classification | Notes |
|---|---|---|
| Production database-backed registry storage | future_phase_3_work | Repository boundaries and local file-backed storage exist; Prisma-backed runtime persistence remains future work. |
| Package signing and trusted artifact verification | future_phase_3_work | Local manifests exist, but no signatures, trust policy, or provenance verification. |
| Signed Skill artifacts | future_phase_3_work | No signing, verification, or trust policy. |
| Signed Harness artifacts | future_phase_3_work | No signed runtime definition workflow. |
| Full approval workflow | future_phase_3_work | Status fields, APIs, audit logs, resolver enforcement, and a read-only approval queue exist; multi-user workflow remains future work. |
| Eval suite execution | phase_4_dependency | Eval status and eval result attachment are implemented, but no eval runner executes suites yet. |
| Full semver and dependency solving | future_phase_3_work | v3 supports simple exact, caret, tilde, wildcard, and latest ranges only. |
| Artifact provenance and SBOM | future_phase_3_work | No provenance chain or software bill of materials exists for registry artifacts. |
| Actual artifact registry integration | out_of_scope_for_now | Real external artifact registry integration is explicitly deferred. |
| Policy enforcement for registry selection | future_phase_3_work | Resolver selection is deterministic but not yet policy-gated. |
| Registry dashboard editing | future_phase_3_work | v0 dashboard visibility is mostly read-only. |
| Auto-improvement proposals for Skills or Harnesses | phase_4_dependency | Requires Phase 4 trace clustering, eval, proposal generation, and canary rollout. |
| Enterprise registry governance | enterprise_phase_work | Includes org-level policy-as-code, audit export, data residency, and advanced security. |
| Real registry mutation auth/RBAC | enterprise_phase_work | v2 has provider-agnostic interfaces and mock enforcement; real SSO/SCIM/OAuth/RBAC integration is deferred. |

## Recommended Next Step

Continue with Work Order 3 before Phase 4 implementation:

- Phase 4 preparation.
- Trace and eval data model review.
- Auto-improvement guardrails.
- Policy hooks for future registry selection and rollout.

Keep real artifact registry and provider integrations out of scope until the mock-first registry contracts are stable.
