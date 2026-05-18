# Branch Cleanup / Orphan Lease Recovery v1 Plan

Status: v1_planned

## Chosen Docs Path

Per `docs/README.md`, feature-scoped work belongs under `docs/features/<slug>/`. Branch Cleanup / Orphan Lease Recovery v1 sits across Branch Lease, Workspace Lifecycle, Worktree Allocation, Branch Orchestrator, Merge Queue Policy, and Real Git Adapter v2; it is itself a feature implementation rather than a cross-cutting rollout, so the canonical path is `docs/features/branch-cleanup-orphan-lease-recovery/`.

## Current Behavior

### BranchLease

`BranchLease` (in `packages/core/src/domain/models.ts`) carries `id`, `taskId`, `taskRunId`, `repoId`, `branchId`, `branchName`, `baseBranch`, `files`, `symbols`, `tests`, `status` (`active | released | expired`), optional `expiresAt`/`releasedAt`, and timestamps. The in-memory repository (`packages/db/src/repository.ts`) exposes `getBranchLease`, `listBranchLeases(repoId?, status?)`, `releaseBranchLease`, and `expireBranchLease` helpers, but it never deletes leases.

### Agent Workspace Lifecycle v2

`AgentWorkspaceLease` (in `packages/runner/src/workspace-lifecycle.ts`) carries `id`, `taskId`, optional `taskRunId`, `agentRunId`, `repoId`, optional `branchLeaseId`, `branchName`, `baseBranch`, `workspaceKind`, `workspacePath`, `status` (`requested | allocated | active | frozen | ready_for_merge | merged | abandoned | cleanup_pending | cleaned | failed`), `isolationStatus`, timestamps, optional `expiresAt`, `ownerActorId`, optional `ownerServiceAccountId`, and metadata. The lifecycle service produces `AgentWorkspaceCleanupDecision`s (`keep | cleanup_allowed | cleanup_blocked_dirty | cleanup_blocked_uncommitted | cleanup_blocked_unmerged | cleanup_blocked_policy | future_manual_review`) and emits `AgentWorkspaceLifecycleEvent`s, but it never deletes workspace files.

### Multi-user / Multi-session Branch Orchestrator v2

`BranchOwnershipRecord` (in `packages/git-adapter/src/branch-orchestrator.ts`) records branch ownership with status `active | frozen | ready_for_review | ready_for_merge | merged | abandoned | expired`, `BranchLease` linkage, optional `workspaceLeaseId`, optional `expiresAt`, and metadata. `BaseBranchDriftStatus` may record drift severity. The repository exposes `listOwnership(query)`, `updateOwnership(id, patch)`, and helpers like `markAbandoned`, `markReadyForMerge`, `markMerged`. It never executes real Git mutation.

### Agent Worktree Allocation v1

Worktree allocation produces fixture-only allocation metadata; real `git worktree add/remove` remains disabled.

### Multi-session Agent Run Coordination v1

`AgentSession` records session metadata with `branchLeaseId`/`workspaceLeaseId` linkage. Sessions may be `active | ready_for_review | ready_for_merge | completed | abandoned | expired`.

### Merge Queue Policy v2

`MergeQueueEntry` carries `status: ready | blocked` plus `branchLeaseId` linkage. `MergeQueuePolicyService` produces readiness decisions and holds without executing merges. Stale or abandoned entries are not currently distinguished from active ones.

### Real Git Adapter v2 + GitHub App Controlled v1

Default runtime is `MockGitProvider`. Real provider paths are gated and never auto-merge, force-push, or delete branches. GitHub App Controlled v1 adds a mock installation-token boundary.

## Orphan / Stale State Problem

Agent runs, branch leases, workspace leases, multi-user branch ownership records, agent sessions, merge queue entries, and (future) PR ownership handoffs can become orphaned when:

- a TaskRun fails, the workspace lifecycle status never reaches `merged`/`cleaned`, and the lease remains `active`,
- a user abandons a session before marking it complete or ready, leaving sessions/workspace/branch records in active state,
- a branch lease passes `expiresAt` but the workspace and merge queue entry are still active,
- a branch is marked `merged` in the orchestrator but the workspace is still `active`,
- two active ownership records reference the same workspace lease (data inconsistency),
- a merge queue entry references a branch lease that is `released` or `expired`,
- the workspace lifecycle records `cleanup_blocked_dirty`/`cleanup_blocked_uncommitted` and never resolves,
- a (future) PR ownership handoff handoff window expires without acknowledgement.

The data is never automatically removed because Aichestra's default-safe behavior forbids destructive operations. Without an explicit cleanup/recovery model, operators must hand-correlate the records and there is no scoped policy/auth/audit boundary for the cleanup flow.

## Cleanup Decision Strategy

Branch Cleanup / Orphan Lease Recovery v1 introduces three coordinated record types:

1. `OrphanLeaseRecord` — a deterministic finding from scanning the existing data sources. It identifies the affected `leaseKind` (`branch | workspace | worktree | merge_queue | pr_ownership | agent_session`), the related id, repo, optional branch/workspace/worktree references, and the `detectedReason` (`expired | missing_owner | task_completed | task_failed | merge_completed | branch_missing_future | workspace_missing_future | stale_queue_entry | abandoned_session | inconsistent_state`). Severity is bucketed into `low | medium | high | critical`. Records are produced by `BranchCleanupRecoveryService.scanForOrphans` and never auto-act.

2. `CleanupRecommendation` — produced from each `OrphanLeaseRecord`. Possible recommendations are `keep`, `mark_abandoned`, `release_metadata_lease`, `mark_cleanup_pending`, `require_manual_review`, `delete_branch_future`, `remove_worktree_future`, `close_pr_future`, `archive_record_future`. The `destructive` flag is one of `false | true_future`. The `requiredApproval` is one of `none | owner | platform_owner | release_manager | security_reviewer | future_policy`. Recommendations include safety checks and reason.

3. `CleanupDecision` — recorded when a reviewer accepts or rejects a recommendation. Decision values are `approved_metadata_only | rejected | held | future_destructive_review | blocked_policy | executed_metadata_only`. Only metadata-only decisions can be executed in v1; destructive recommendations remain `future_destructive_review` and never execute Git/Filesystem operations.

`RecoveryAction` records explicit recovery (re-link, refresh status, recreate metadata, mark failed, mark abandoned, manual reconciliation) and is also metadata-only. Status is `proposed | executed_metadata_only | blocked | future`.

## Recovery Strategy

The service offers `proposeRecovery(recordId, context)` to convert an orphan record into one or more recovery actions:

- Expired branch lease with stale workspace lease → `relink_workspace_lease` recovery candidate (review-only).
- Merge queue entry referencing released lease → `refresh_status` recovery candidate.
- Workspace `ready_for_merge` with no merge queue entry → `recreate_metadata_record` recovery candidate (queue entry must still be created by the merge queue service).
- Abandoned session → `mark_abandoned` recovery candidate.
- Inconsistent shared worktree → `manual_reconciliation` recovery action (requires manual review).
- Otherwise → `mark_failed` if the parent task failed.

`executeMetadataOnlyCleanup(decisionId, context)` is the single safe mutation entrypoint. It updates the metadata-only records (branch lease status, workspace lifecycle status, branch ownership status, merge queue entry metadata, recovery action status) without calling the Git provider or the filesystem. It refuses to act on `true_future` destructive recommendations.

## Manual Review Strategy

Any recommendation flagged `destructive: true_future` requires `requiredApproval: platform_owner | release_manager | security_reviewer` and routes to `future_destructive_review`. v1 records the metadata but never executes; the `branch.delete_future`, `worktree.remove_future`, `pr.close_future` policy actions are denied by default.

## Safety Constraints

- No real branch deletion (`git branch -D`, `git push --delete origin`).
- No real worktree removal (`git worktree remove`, `rm -rf`).
- No real PR closure (no provider PR-close API call).
- No filesystem deletion outside controlled test fixtures.
- No `git fetch`/`push`/`merge`/`rebase`/force-push.
- No remote provider calls.
- No LLM calls.
- No vendor CLI execution.
- No credential cache reads.
- No secrets/env values returned anywhere.
- Workspace paths and remote URLs continue to be sanitized via existing redaction utilities.
- Policy deny wins; `branch.delete_future` / `worktree.remove_future` / `pr.close_future` / `cleanup.destructive_execute_future` denied by default.
- Tenant Scope / RequestContext / Service Account metadata is recorded on every audit event.

## Implemented in This Task

- Models: `OrphanLeaseRecord`, `CleanupRecommendation`, `CleanupDecision`, `RecoveryAction`, plus summary type.
- Service: `BranchCleanupRecoveryService` with deterministic mock-first detection rules, in-memory repository, recommendation derivation, decision recording, metadata-only execution, and recovery proposal.
- New policy actions: `cleanup.scan`, `cleanup.recommend`, `cleanup.decide`, `cleanup.metadata_execute`, `cleanup.destructive_execute_future`, `branch.delete_future`, `worktree.remove_future`, `pr.close_future`. A new `cleanup` resource kind. Default rules allow scan/recommend/decide/metadata_execute under mock-first context and deny the destructive/future actions by default.
- Read-only API endpoints under `/git/cleanup/*`.
- Dashboard panel under `/dashboard/git-cleanup` with the same model.
- `/health` metadata `branchCleanup` (status, scan counts, destructive-future status).
- Deterministic tests covering every detection rule, recommendation/decision pathway, no-destructive guarantee, API, dashboard, and policy deny.
- Documentation (this plan + `v1.md`) and cross-references from related feature docs.

## Out of Scope

- Real branch deletion.
- Real worktree removal.
- Real PR closure (no provider PR-close API call).
- Filesystem deletion outside test fixtures.
- Real fetch/push/merge/rebase/force-push.
- LLM calls.
- Vendor CLI execution.
- Production tenant enforcement of cleanup scope (Tenant Scope Enforcement remains partial).
- PR Ownership Handoff Model v1 itself (cleanup hooks into the future model only).
- Durable cleanup record storage (records remain in-memory in v1).

## Recommended Next Task

Branch Cleanup Live Integration-Test Profile v1, or PR Ownership Live Integration-Test Profile v1.
