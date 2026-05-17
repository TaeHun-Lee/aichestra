# Multi-user / Multi-session Branch Orchestrator v2 Plan

Chosen path: `docs/features/multi-user-branch-orchestrator/v2-plan.md`. `docs/README.md` defines feature work as `docs/features/<slug>/vN-plan.md` followed by `vN.md`, and no older flat branch-orchestrator path exists.

## Current BranchLease Behavior

`BranchLease` is the Conflict Manager Git-intent lease. It is stored through `InMemoryAichestraStore` by default and opt-in Postgres for the core slice. A lease links `taskId`, `taskRunId`, `repoId`, `branchName`, `baseBranch`, target files, symbols, tests, status, timestamps, and optional expiry. Conflict risk, dry-run merge simulation, and merge queue entries consume branch leases. Branch leases do not allocate filesystem workspaces, create branches, switch branches, merge, rebase, push, or delete refs by themselves.

## Current Git Adapter Behavior

Real Git Adapter v2 keeps `MockGitProvider` as the default. `LocalGitProvider` is fixture-safe and gated by local path allowlists. GitHub branch, PR, and changed-file operations are available only through the provider and `GitHubClient` boundary when every explicit remote Git gate, allowlist, SecretRef/legacy credential gate, Auth/RBAC check, and Policy-as-code decision allows the operation. Merge, rebase, force-push, branch deletion, remote push, and automatic merge remain unsupported.

GitHub App Controlled Implementation v1 adds mock/status-only token-handle checks and metadata visibility. It does not sign private keys, mint live installation tokens, or change the destructive Git boundary.

## Current Multi-session Agent Coordination Behavior

Multi-session Agent Run Coordination v1 is implemented in `packages/runner/src/coordination.ts`. It records `AgentSession`, `AgentRunCoordinationGroup`, overlaps, policies, and audit metadata. It can link sessions to `branchLeaseId` and `workspaceLeaseId`, detects same branch, same workspace, same file, same directory, missing target files, and base branch drift, and recommends allow/warn/split/serialize/review/block. Merge Queue Policy v2 now consumes this metadata for readiness decisions and holds. Coordination itself does not allocate branches, create worktrees, execute agents, mutate workspaces, call providers, or execute merge policy.

## Current Agent Workspace Lifecycle Behavior

Agent Workspace Lifecycle v2 is implemented in `packages/runner/src/workspace-lifecycle.ts`. It records `AgentWorkspaceLease`, lifecycle events, and cleanup decisions. One `AgentRun` maps to one active workspace lease by default. Fixture allocation validates under the configured workspace root; future Git worktree, clone, and remote workspace kinds are metadata-only. Cleanup decisions do not delete non-fixture user directories, and DTOs redact full local paths and secret-like metadata.

## Current Merge Queue / Conflict Risk Behavior

Conflict Manager v1 derives conflict risk from active branch leases and optional merge simulation evidence. Merge queue entries link to branch leases and pull requests. Local dry-run merge simulation can use `git merge-tree` only against explicitly supplied local repositories or fixtures; it does not fetch, push, mutate the user branch, or call hosted providers. Existing queue readiness is policy-dependent and does not perform provider merge/rebase.

## Branch Collision Problem Statement

A single human user can run LLM A, LLM B, and LLM C against the same repository simultaneously. Multiple users can also target the same repository. Branch-only separation is not sufficient if sessions share one working directory, because one branch switch can affect all active sessions. Aichestra needs a metadata-first orchestrator that assigns safe unique branch names and ties those names to task, session, branch lease, workspace lease, and merge queue metadata before future real execution exists.

## Branch Naming Strategy

Default branch names will be deterministic:

```text
aichestra/{repoSlug}/{taskId}/{agentRunId}
```

If `repoSlug` is unavailable, the fallback is:

```text
aichestra/{repoId}/{taskId}/{agentRunId}
```

The policy sanitizes unsafe characters, lowercases path segments, collapses separators, enforces the `aichestra/` prefix, rejects empty names, rejects path traversal-like segments, rejects reserved long-lived branches such as `main`, `master`, `develop`, and `release`, and caps length. Timestamp inclusion is modeled in policy but disabled by default to keep tests deterministic.

## Branch Ownership Strategy

The orchestrator records `BranchOwnershipRecord` metadata for each allocated branch. Ownership links repo, base branch, user, actor, task, task run, agent run, optional session id, branch lease id, optional workspace lease id, status, timestamps, expiry, and sanitized metadata. Active ownership records are the source of truth for branch collision detection. They do not imply that a real Git branch exists.

## Lease Expiration Strategy

`BranchOwnershipRecord.expiresAt` is optional. v2 models expiry and can mark ownership expired, but it does not delete branches or worktrees. Future durable orchestration should use expiry only as a review/cleanup signal and require a separate explicit cleanup policy before any filesystem or provider mutation is allowed.

## Base Branch Drift Strategy

Base branch drift is modeled as `BaseBranchDriftStatus`. In v2 the status is deterministic metadata:

- same supplied and current base branch: `current`;
- explicit drift marker or different known base: `behind_base` or `base_changed`;
- missing comparison evidence: `unknown`;
- future live ancestry check needed: `future_check_required`.

The orchestrator recommends continue, refresh, future rebase/merge-base evaluation, or manual review. It never runs Git ancestry commands or fixes drift.

## Merge Queue Interaction

The orchestrator can link an ownership record to existing merge queue metadata through branch lease id, task run id, branch name, and repo id. It can surface merge readiness metadata and blockers such as collision, same branch, same workspace, or drift. It does not enqueue, merge, rebase, mark merged, cancel queue entries, or call provider APIs.

## What This Task Implements

- Branch orchestration models in the Git adapter boundary.
- In-memory `BranchOrchestratorService`.
- Safe deterministic branch naming and validation policy.
- Collision and same-active-branch detection.
- Optional branch lease creation/linkage where task and task run ids are provided.
- Optional workspace lease and multi-session coordination linkage through metadata lookups.
- Base branch drift metadata.
- Merge queue/conflict-risk summary metadata.
- Metadata-only API endpoints under `/git/branches/*`.
- Dashboard/readiness visibility in the Git panel.
- Deterministic tests covering service, API, dashboard, and safety behavior.

## Out Of Scope

- Real Git branch creation, checkout, switch, merge, rebase, fetch, push, force-push, or deletion.
- Real worktree or clone allocation.
- Destructive cleanup of user workspaces.
- Real LLM calls, vendor CLI execution, credential-cache reads, external provider calls, or secret/env exposure.
- Distributed locks, durable orchestration tables, queue-worker enforcement, production tenant isolation, and production-ready remote branch orchestration.
- Merge queue policy enforcement beyond metadata recommendations.
