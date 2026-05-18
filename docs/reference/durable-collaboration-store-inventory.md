# Durable Collaboration Store Inventory

Durable Collaboration Stores v1 inventories collaboration-control records that need a durable persistence boundary before production concurrency control. Default runtime remains in-memory. Optional Postgres support is selected only through the existing storage provider gates.

## Required Durable Records

| Model | Package/source path | Current storage | Target storage | Repository needed | Postgres table needed | Migration status | Production impact |
|---|---|---|---|---|---|---|---|
| `BranchOrchestrationRequest` | `packages/git-adapter/src/branch-orchestrator.ts` | In-memory branch orchestrator repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to replay branch allocation intent safely. |
| `BranchOrchestrationDecision` | `packages/git-adapter/src/branch-orchestrator.ts` | In-memory branch orchestrator repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve branch allocation decisions. |
| `BranchOwnershipRecord` | `packages/git-adapter/src/branch-orchestrator.ts` | In-memory branch orchestrator repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed for durable ownership and handoff coordination. |
| `AgentSession` | `packages/runner/src/coordination.ts` | In-memory coordination repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to coordinate overlapping agent runs across restarts. |
| `AgentRunCoordinationGroup` | `packages/runner/src/coordination.ts` | Derived from in-memory sessions | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve run grouping evidence. |
| `AgentSessionOverlap` | `packages/runner/src/coordination.ts` | In-memory coordination repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed for durable overlap/blocker evidence. |
| `AgentWorkspaceLease` | `packages/runner/src/workspace-lifecycle.ts` | In-memory workspace lifecycle repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed before production workspace lifecycle coordination. |
| `AgentWorkspaceLifecycleEvent` | `packages/runner/src/workspace-lifecycle.ts` | In-memory workspace lifecycle repository | Durable collaboration event/table boundary | Yes | Yes | v1 schema skeleton | Needed for audit and cleanup reconstruction. |
| `AgentWorkspaceCleanupDecision` | `packages/runner/src/workspace-lifecycle.ts` | In-memory workspace lifecycle repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve non-destructive cleanup decisions. |
| `AgentWorktreeAllocationRequest` | `packages/runner/src/worktree-allocation.ts` | Service-local array | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed for allocation replay and safety review. |
| `AgentWorktreeAllocationResult` | `packages/runner/src/worktree-allocation.ts` | Service-local array | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed for durable fixture/worktree allocation evidence. |
| `FileLease` | `packages/runner/src/edit-intent.ts` | In-memory edit intent repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed for file-level collaboration coordination. |
| `EditIntent` | `packages/runner/src/edit-intent.ts` | In-memory edit intent repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve intended edits across restarts. |
| `EditOverlapAssessment` | `packages/runner/src/edit-intent.ts` | In-memory edit intent repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve overlap warnings and blockers. |
| `MergeQueuePolicy` | `packages/core/src/conflicts/merge-queue-policy.ts` | Static/in-memory policy metadata | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed before persistent queue policy tuning. |
| `MergeReadinessDecision` | `packages/core/src/conflicts/merge-queue-policy.ts` | Service-local array | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve readiness decisions and evidence. |
| `MergeQueueHold` | `packages/core/src/conflicts/merge-queue-policy.ts` | Service-local array | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve holds across service restarts. |
| `ConflictResolutionRequest` | `packages/core/src/conflicts/conflict-resolution-assistant.ts` | Service-local array | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to retain conflict assistant request evidence. |
| `ConflictSummary` | `packages/core/src/conflicts/conflict-resolution-assistant.ts` | Service-local array | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to retain deterministic summaries. |
| `ConflictResolutionPlan` | `packages/core/src/conflicts/conflict-resolution-assistant.ts` | Service-local array | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to retain review-only plan evidence. |
| `ConflictResolutionRecommendation` | `packages/core/src/conflicts/conflict-resolution-assistant.ts` | Service-local array | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve recommendation metadata. |
| `PrOwnershipRecord` | `packages/core/src/conflicts/pr-ownership-handoff.ts` | Service-local array | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve PR ownership and reviewer metadata. |
| `PrHandoffRequest` | `packages/core/src/conflicts/pr-ownership-handoff.ts` | Service-local array | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve handoff request evidence. |
| `PrHandoffDecision` | `packages/core/src/conflicts/pr-ownership-handoff.ts` | Service-local array | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve handoff decisions. |
| `OrphanLeaseRecord` | `packages/git-adapter/src/branch-cleanup.ts` | In-memory cleanup repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve orphan detection evidence. |
| `CleanupRecommendation` | `packages/git-adapter/src/branch-cleanup.ts` | In-memory cleanup repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve advisory cleanup recommendations. |
| `CleanupDecision` | `packages/git-adapter/src/branch-cleanup.ts` | In-memory cleanup repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve non-destructive cleanup decisions. |
| `RecoveryAction` | `packages/git-adapter/src/branch-cleanup.ts` | In-memory cleanup repository | Durable collaboration repository group plus optional Postgres table | Yes | Yes | v1 schema skeleton | Needed to preserve recovery action metadata. |

## Recommended Durable Records

| Model | Package/source path | Current storage | Target storage | Repository needed | Postgres table needed | Migration status | Production impact |
|---|---|---|---|---|---|---|---|
| Dashboard/readiness summaries | `apps/api/src/dashboard-read-model.ts`, readiness routes | Derived read models | Recompute from durable records; optional snapshot later | No in v1 | No in v1 | Future | Useful for fast reads, not required for correctness. |
| Audit correlation snapshots | Multiple packages with `requestId`/`correlationId` metadata | Embedded metadata and audit logs | Keep as metadata in durable record/event rows | No dedicated repo in v1 | No dedicated table in v1 | v1 metadata columns | Useful to reconstruct decisions without exposing secrets. |
| Base branch drift status | `packages/git-adapter/src/branch-orchestrator.ts` | In-memory branch orchestrator repository | Durable branch orchestration metadata/table extension later | No dedicated repo in v1 | No dedicated table in v1 | Future | Useful for production merge readiness correlation. |
| Workspace safety checks | `packages/runner/src/worktree-allocation.ts` and workspace lifecycle services | Service-local/derived metadata | Durable worktree/workspace metadata later | No dedicated repo in v1 | No dedicated table in v1 | Future | Useful before enabling real worktree allocation. |

## Ephemeral Or Recomputable Records

| Model | Package/source path | Current storage | Target storage | Repository needed | Postgres table needed | Migration status | Production impact |
|---|---|---|---|---|---|---|---|
| Visual graph layout | `apps/web/src/render.ts` | Browser/UI computation | Recompute in UI | No | No | Not applicable | No durable correctness impact. |
| Dashboard display grouping | `apps/api/src/dashboard-read-model.ts`, `apps/web/src/render.ts` | Derived read model/UI grouping | Recompute from durable records | No | No | Not applicable | No durable correctness impact. |
| Derived counts | Dashboard/readiness summaries | Derived from records | Recompute on read | No | No | Not applicable | No durable correctness impact. |

## v1 Repository Coverage

Durable Collaboration Stores v1 adds a repository boundary for all required durable record groups. The boundary stores sanitized metadata only and exposes safe summaries. Existing feature services remain mock-first and in-memory by default; production-grade service migration to durable repositories is a follow-up after contract coverage and tenant enforcement are expanded.

## v1 Postgres Coverage

The v1 migration adds safe table skeletons for each required durable record plus a durable collaboration event table. Optional Postgres repository support is behind `AICHESTRA_STORAGE_PROVIDER=postgres`; optional repository tests remain skipped unless `AICHESTRA_TEST_DATABASE_URL` is configured. No default runtime requires Postgres.

## Safety Status

- No remote Git operations.
- No provider calls.
- No real LLM calls.
- No vendor CLI execution.
- No destructive workspace or branch operations.
- No DB URL exposure.
- No secret, token, credential, cookie, authorization header, raw payload, or env value exposure.
