# Phase 3 Packaging & Versioning v3 Plan

## Current Phase 3 v2 Capabilities

Phase 3 Operational Hardening v2 is implemented and validated:

- Registry history exists through `RegistryRevision` and `RegistryHistoryRepository`.
- Rollback exists for Skill, Harness, and InstructionArtifact records.
- Approval queue read models exist through `RegistryApprovalQueueItem`.
- Local/manual/mock eval result attachment exists through `RegistryEvalResult`.
- Registry mutation authorization exists behind `RegistryMutationAuthorizer` with mock RBAC.
- Registry audit logs, lifecycle/approval/eval/checksum resolver gates, and TaskRun registry refs remain in place.

## Current Package And Versioning Gaps

- Registry entries have exact `version` strings, but no package manifest artifact.
- Exact `name@version` selection exists, but no semver range resolution.
- No import/export workflow exists for local registry packages.
- No package diff or revision diff summary exists.
- Dependency metadata is not modeled for package manifests.
- Rollback/history exists and should remain compatible with imported package changes.

## v3 Scope

This task will implement:

- Local-only `RegistryPackageManifest` models for Skill, Harness, Instruction, and bundle packages.
- Deterministic package checksums.
- Local package export/import and dry-run import.
- Persisted package manifest listing.
- Simple semver range resolution for exact, caret, tilde, major wildcard, and latest compatible selection.
- Deterministic dependency resolution and circular dependency detection.
- Local structural package/revision diff summaries.
- API endpoints and dashboard visibility for package manifests, import/dry-run, version selection, dependencies, and diffs.
- Tests for package manifests, import/export, semver, dependency handling, diffs, and regressions.

## Out Of Scope

- Real external artifact registry integration.
- Signed package manifests or cryptographic signing workflows.
- Artifact provenance, SBOM, or trust policy enforcement.
- Complex package dependency solving.
- Production auth/RBAC.
- Phase 4 auto-improvement.

## Risks And Guardrails

- Preserve Skill, Harness, and InstructionArtifact as separate concepts; package manifests reference them but do not replace them.
- Keep all package behavior local-only and mock-first.
- Do not overwrite active approved registry entries by default.
- Dry-run imports must not mutate registry state.
- Imported changes must append audit logs and revisions when they create or replace registry entries.
- Resolver range handling must continue to enforce lifecycle, approval, eval, and instruction checksum gates.
