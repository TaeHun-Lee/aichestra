# Agent Workspace Lifecycle v2 Plan

Status: implementation completed in v2; this pre-implementation plan was created after current repository and docs inspection found no critical validation blockers.

Canonical docs path: `docs/features/agent-workspace-lifecycle/`. The repository organizes feature history under `docs/features/<feature>/`, so this v2 plan lives beside the v2 implementation document rather than an older flat docs path.

## Current Local Agent Runner Workspace Behavior

Local Agent Runner v1 is implemented in `packages/runner` with `MockAgentRunner` as the default and `LocalAgentRunner` disabled by default. `LocalAgentWorkspaceManager` validates fixture/temp workspaces under `AICHESTRA_AGENT_WORKSPACE_ROOT`, rejects filesystem roots, rejects the repository root unless an explicit fixture exception is provided, and can delete only temp workspaces configured with `delete_temp_workspace`.

The current `AgentWorkspace` record is runner-local status metadata. It tracks a task/task run, path, temp-or-fixture mode, cleanup policy, and simple status, but it does not model one workspace lease per `AgentRun`, branch lease linkage, future Git worktree allocation, lifecycle transitions, merge readiness, or cleanup eligibility decisions.

## Current BranchLease Behavior

`BranchLease` is a Conflict Manager concept owned by core/db/git boundaries. It tracks task, task run, repo, branch, base branch, intended files/symbols/tests, status, and timestamps. It feeds conflict risk, merge simulation, and merge queue read models. Branch leases do not allocate filesystem workspaces and must remain separate from workspace leases.

## Current Git Adapter Behavior

Real Git Adapter v2 keeps `MockGitProvider` as the default, allows `LocalGitProvider` only for fixture-safe local inspection, and gates GitHub branch/PR/changed-file operations behind explicit config, allowlists, credentials, Auth/RBAC, and Policy. Webhooks and sync read models are metadata-only by default. Merge, rebase, force push, branch deletion, remote push, and production worktree operations remain unsupported.

## Problem Statement

A single physical repo working directory is unsafe for concurrent LLM sessions. If one session switches branches in that shared directory, every other session using the same directory sees the branch change. Aichestra needs an explicit per-agent-run workspace lifecycle model so Task/AgentRun execution can be represented as:

```text
Task / AgentRun
  -> BranchLease
  -> WorkspaceLease
  -> isolated worktree path
  -> lifecycle state
  -> cleanup eligibility
```

## Proposed WorkspaceLease Model

`AgentWorkspaceLease` should link workspace state to:

- `taskId`
- optional `taskRunId`
- `agentRunId`
- `repoId`
- optional `branchLeaseId`
- `branchName`
- `baseBranch`
- workspace kind
- sanitized workspace path metadata
- lifecycle status
- isolation status
- owner actor/service-account attribution
- request/correlation metadata

The lease is separate from `BranchLease`. The branch lease models Git intent and conflict scope; the workspace lease models per-agent-run filesystem isolation and lifecycle.

## Proposed Lifecycle States

Workspace lifecycle status values:

- `requested`
- `allocated`
- `active`
- `frozen`
- `ready_for_merge`
- `merged`
- `abandoned`
- `cleanup_pending`
- `cleaned`
- `failed`

Lifecycle event values:

- `requested`
- `allocated`
- `activated`
- `frozen`
- `ready_for_merge`
- `merge_completed`
- `abandoned`
- `cleanup_requested`
- `cleanup_completed`
- `cleanup_blocked`
- `failed`

## Proposed Cleanup States

Cleanup decisions:

- `keep`
- `cleanup_allowed`
- `cleanup_blocked_dirty`
- `cleanup_blocked_uncommitted`
- `cleanup_blocked_unmerged`
- `cleanup_blocked_policy`
- `future_manual_review`

Cleanup evaluation records changed-file, uncommitted, merge status, policy decision id, and metadata. It is decision-only unless a test explicitly owns a fixture/temp directory.

## Fixture-Only Safety Constraints

- Do not delete non-fixture user directories.
- Do not run destructive cleanup by default.
- Do not run `git worktree add` or `git worktree remove` in default runtime.
- Do not use repository root as a safe shared workspace.
- Fixture allocation must stay under an allowlisted workspace root and reject path traversal.
- Workspace paths returned to API/dashboard must be safe metadata and avoid secrets/env values.
- Cleanup decisions may mark eligibility but must not remove user workspaces.

## Future Git Worktree Strategy

Future worktree allocation should require:

- `repoId`
- `baseBranch`
- `branchName`
- workspace root allowlist
- active branch lease
- policy allow
- no path traversal
- no shared root
- cleanup policy

Future allocation should use a dedicated boundary that can later run `git worktree add/remove` only after explicit gates are added. This v2 task models `git_worktree_future`, `clone_future`, and `remote_workspace_future` as non-executing workspace kinds.

## This Task Implements

- `AgentWorkspaceLease`, `AgentWorkspaceLifecycleEvent`, and `AgentWorkspaceCleanupDecision` models.
- In-memory lifecycle repository and service in the runner package.
- Fixture-only allocation through existing workspace path validation.
- One active workspace lease per AgentRun by default.
- Shared workspace path detection and `shared_forbidden` isolation status.
- Branch lease id linkage when supplied.
- Runner metadata and audit enrichment with `workspaceLeaseId`.
- Safe lifecycle APIs under `/agents/workspaces/*`.
- Dashboard/readiness visibility for workspace lifecycle status, cleanup decisions, branch lease linkage, and no-destructive-cleanup status.
- Deterministic tests and documentation.

## Out of Scope

- Real production workspace cleanup.
- Real `git worktree add/remove`.
- Real branch checkout/switch/merge/rebase.
- Remote Git operations.
- Vendor CLI execution.
- LLM provider calls.
- Secret/env exposure.
- Production deployment or production tenant enforcement.
- Persistent Postgres repository implementation for workspace lifecycle.
