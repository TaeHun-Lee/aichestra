# Merge Queue Policy v2 Plan

## Document Placement

This plan follows the current documentation layout described in `docs/README.md`: feature plans live under `docs/features/<feature>/vN-plan.md`. No `design_docs/` directory is present in the current repository, so the canonical feature path is `docs/features/merge-queue-policy/v2-plan.md`.

## Current Behavior

### Merge Queue Skeleton

The current merge queue is part of the Conflict Manager scaffold. `MergeQueueEntry` records a branch lease, pull request reference, risk score, queue status, reasons, blocking reasons, and a recommendation. Queue status is derived from conflict risk and the latest dry-run simulation using `mergeQueueDecision`. Existing behavior can mark an entry `ready` or `blocked`, but it does not yet produce a policy-backed readiness decision, hold object, explicit ranking explanation, or human-review routing.

The existing API exposes basic `/merge-queue` reads and local status transitions. Those transitions update local metadata only; they do not execute provider merges.

### Dry-run Merge Simulation

Dry-run simulation is represented by `MergeSimulationResult` with modes `mock` and `local_git_merge_tree`. The mock simulator is the safe default. The local merge-tree simulator is allowed only for explicitly supplied local repository paths that pass the allowlist check. It records status, changed files, conflicting files, summary, and bounded command metadata. It does not fetch, push, switch branches, mutate the user branch, or call hosted Git providers.

### Conflict Risk

Conflict risk is deterministic and local. Active branch leases are compared by file overlap, critical/package/source/test/docs classification, same top-level directory heuristics, and optional dry-run contribution. Results produce `ConflictRisk` with risk level, score, reasons, recommendation, and dry-run metadata. High or critical risk currently influences queue status, but queue policy does not yet hold or rank entries with a first-class decision model.

### Branch Lease

`BranchLease` tracks task/run ownership, repo, branch, base branch, touched files, tests, symbols, status, and timestamps. Active leases feed risk scoring. Released or expired leases stop participating in active risk scoring. The current queue skeleton does not explicitly classify expired leases as policy blockers.

### Workspace Lifecycle

Agent Workspace Lifecycle v2 exists in `packages/runner`. It is mock-first and metadata-only. One agent run maps to one workspace lease, fixture allocation validates paths under the configured root, shared active workspace paths are forbidden/flagged, and future worktree/clone/remote workspace kinds are modeled only. Cleanup decisions do not delete non-fixture user directories. API/dashboard DTOs redact full local paths. The merge queue does not yet consume workspace status when deciding readiness.

### Edit Intent and Coordination

Multi-session Agent Run Coordination v1 exists in `packages/runner`. It records sessions, groups, overlaps, concurrency policy metadata, and audit events. It can detect same workspace, same branch, same file, same directory, unknown target files, and base branch drift. It is metadata-only and does not execute agents or Git operations. No separate Cross-session File Lease / Edit Intent Graph feature document is present; the current coordination surface provides the available edit-overlap input.

## Proposed Merge Policy Model

Merge Queue Policy v2 adds a policy-driven decision layer without changing the existing no-merge runtime posture.

The model adds:

- `MergeQueuePolicy`: active mock policy definition, required checks, blocking conditions, warning conditions, priority rules, retry rules, and safe metadata.
- `MergeReadinessDecision`: per-entry readiness output with decision, reasons, blockers, warnings, required actions, priority, request/correlation/actor/service-account attribution, timestamp, and metadata.
- `MergeQueuePriorityRule`: deterministic ordering rules for lower conflict first, older first, smaller diff first, dependency order, human priority, and release blockers.
- `MergeQueueHold`: hold records for conflict risk, dry-run failure, validation missing, approval missing, workspace not ready, expired branch lease, edit overlap, policy denial, and human review.

All model metadata must stay sanitized. It must not store secrets, env values, raw credentials, or full local workspace paths.

## Readiness Decision Model

The policy service evaluates each queue entry using the evidence currently available:

- branch lease status
- workspace lifecycle status, when linked
- conflict risk score and reasons
- latest dry-run merge result
- coordination/edit overlap severity
- validation status metadata
- approval status metadata
- policy decision metadata
- tenant/repo/request attribution metadata
- human priority metadata

Default behavior is conservative:

- policy deny blocks.
- expired branch lease blocks.
- dry-run text conflict or failed dry-run requires human review or blocks.
- high or critical conflict risk creates a hold.
- same-file or same-workspace overlap creates a hold.
- workspace not ready creates a hold.
- missing validation or missing approval creates a hold.
- ready is returned only when required safe metadata is present and all blockers are absent.
- actual merge execution remains disabled and marked as future/manual.

## Ordering and Priority Strategy

Ranking is deterministic. The service sorts by:

- policy decision class: ready before warning, warning before hold, hold before human review, blocked last for execution readiness.
- release blocker and human priority metadata.
- lower conflict score.
- smaller changed-file footprint.
- older queue entry.
- stable queue entry id tie-breaker.

The ranking result is metadata only. It never starts a merge, creates a branch, rebases, fetches, pushes, or updates a remote PR.

## Hold and Retry Strategy

Holds are created for blocking evidence and may be released when the evidence changes. Releasing a hold does not mark an entry ready by itself; the service re-evaluates the entry and can recreate a hold if the underlying blocker still exists. Retry rules are metadata-only and describe when re-evaluation is appropriate, such as after validation passes, approval is recorded, workspace reaches `ready_for_merge`, or conflicts are resolved.

## What This Task Implements

This task implements:

- core merge queue policy models and mock-first service.
- deterministic readiness, hold, and ranking behavior.
- Policy-as-code actions for merge queue read/evaluate/hold/release and future merge execution denial.
- API metadata endpoints under `/git/merge-queue/*`.
- dashboard/readiness visibility for policy decisions, holds, blockers, warnings, priority order, conflict/dry-run/workspace/coordination inputs, and disabled merge execution.
- documentation and deterministic tests.

## Out of Scope

This task does not implement:

- real Git merge execution.
- auto-merge.
- remote Git fetch, push, rebase, branch deletion, force-push, provider merge, or remote PR mutation.
- Git worktree creation/removal or branch switching.
- external provider calls.
- LLM calls.
- vendor CLI execution.
- production tenant enforcement or production auth changes.
- secret/env value access or exposure.
- automatic conflict resolution.

Recommended follow-up after successful implementation: Conflict Resolution Assistant v1, or Merge Queue Live Integration-Test Profile v1.
