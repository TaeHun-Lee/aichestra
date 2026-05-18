# Real Merge Execution Policy v1 Plan

## Docs Placement

`docs/README.md` defines `docs/features/<slug>/` as the canonical home for feature-scoped plans and implementation notes. This task follows that organization:

- `docs/features/real-merge-execution-policy/v1-plan.md`
- `docs/features/real-merge-execution-policy/v1.md`

No `design_docs/` directory is present in the current repository.

## Current Real Git Adapter Behavior

Real Git Adapter v2 exposes controlled local Git metadata, dry-run merge simulation, GitHub webhook/read-model sync, GitHub App token-handle boundaries, branch orchestration metadata, and cleanup metadata. Real branch creation, PR creation, changed-file refresh, webhook processing, and GitHub App token-handle behavior are gated. Real merge, rebase, force-push, branch deletion, auto-merge, remote PR update, and reviewer assignment remain disabled or unsupported.

Local dry-run simulation may use `git merge-tree` only for explicitly supplied local repositories or fixtures. It must not fetch, push, switch branches, mutate the current working branch, or contact hosted providers.

## Current Merge Queue Behavior

Merge Queue Policy v2 is metadata-only. It evaluates queue entries against branch lease, dry-run, conflict risk, workspace, edit-overlap, validation, approval, and policy evidence. It can rank entries, record holds, and recommend manual review. It explicitly denies `merge_queue.merge_execute_future` and never performs merges, releases holds automatically, updates remote PRs, or mutates branches.

PR Ownership / Handoff v1 can expose whether a queue entry has an active owner, but queue readiness still remains a read model and does not imply merge execution.

## Current Dry-Run Merge Simulation Behavior

Dry-run merge simulation records `MergeSimulationResult` metadata with clean, text-conflict, failed, or unavailable status. It tracks changed/conflicting files and risk contribution. This is evidence for policy decisions only; it is not a command to merge.

## Current Branch Lease Behavior

`BranchLease` links a task/task-run/repo/branch/base branch/files/tests/symbols to an active, released, or expired lease. Conflict risk scoring, dry-run simulation linkage, merge queue policy, branch orchestration, workspace lifecycle, worktree allocation, conflict resolution, and PR ownership use branch lease metadata. A valid active lease is necessary future evidence for merge execution, but does not authorize merge execution by itself.

## Current Worktree / Workspace Behavior

Agent Workspace Lifecycle v2 maps one active agent run to one active workspace lease, forbids or flags shared active workspace paths, supports fixture allocation, and records cleanup decisions without deleting user directories. Agent Worktree Allocation v1 validates fixture/dry-run worktree allocation metadata, blocks shared paths, and keeps production `git worktree` allocation disabled. These surfaces provide readiness evidence only.

## Current Conflict Resolution Assistant Behavior

Conflict Resolution Assistant v1 consumes dry-run merge, conflict risk, branch lease, workspace, edit-overlap, and merge queue metadata. It produces summaries, review-only plans, and recommendations. `applyAllowed` remains false, no patches are applied, no merges are run, and real LLM calls remain out of scope.

## Current PR Ownership / Handoff Behavior

PR Ownership / Handoff v1 records local owner/reviewer/handoff metadata for PRs, branches, merge queue entries, tasks, task runs, agent runs, branch leases, workspace leases, and conflict plans. It does not assign remote reviewers, update GitHub PRs, close PRs, delete branches, or merge.

## Current Auth/RBAC and Policy Behavior

RequestContext Propagation v1 and API AuthContext Middleware Skeleton v1 provide safe mock-first attribution. Service Account Actor Boundary v1 provides static local service-account attribution. Tenant Scope Enforcement v1 is partial representative scaffolding. Policy-as-code v0 has static policy rules for Git, merge queue, PR ownership, cleanup, LLM, runner, registry, MCP, auth, and security boundaries. Deny decisions must win.

## Proposed Real Merge Execution Policy

Real Merge Execution Policy v1 will define a read-only policy boundary for future merge execution. It will model:

- a disabled policy with `mergeExecutionEnabled: false`, `autoMergeEnabled: false`, and `remotePushEnabled: false`;
- execution requests that carry branch, queue, workspace, conflict, PR ownership, dry-run, actor, request, correlation, and tenant metadata;
- decisions that explain blockers and future manual readiness while always recording `mergeExecutionPerformed: false`, `autoMergePerformed: false`, and `remotePushPerformed: false`;
- required preconditions as explicit pass/warning/fail/missing/future metadata;
- forbidden operations for auto-merge, remote push, force-push, rebase, branch deletion, worktree deletion, policy bypass, approval bypass, and dry-run bypass;
- post-execution evidence templates for a later implementation, without collecting real post-merge evidence in v1.

## Required Preconditions

A future real merge should require all of the following evidence before any later execution implementation can be considered:

- active and scope-matching `BranchLease`;
- unique source branch linked to task/session/owner metadata;
- workspace/worktree ready when present or explicitly not required;
- merge queue entry ready;
- clean dry-run merge result;
- low conflict risk or explicitly accepted risk;
- no unresolved high/critical edit-intent overlap;
- no unresolved conflict resolution plan;
- active PR ownership and required reviewer/owner metadata;
- human approval/signoff evidence;
- validation green or explicitly not required;
- Policy-as-code allows a future request while execution remains denied;
- tenant/repo scope matches;
- rollback/revert plan metadata is present;
- observability/audit correlation metadata is present.

For v1 these are represented as metadata precondition statuses only. They do not trigger merge execution.

## Forbidden Operations

The v1 boundary forbids or blocks:

- auto-merge;
- remote push;
- force-push;
- rebase;
- branch deletion;
- worktree deletion;
- policy bypass;
- approval bypass;
- dry-run bypass.

Default runtime and tests must not run real Git merge, fetch, push, rebase, checkout/switch, branch deletion, vendor CLI, provider calls, LLM calls, or workspace mutation.

## Future Execution Boundary

`ready_for_manual_future` is only a metadata decision that all modeled prerequisites appear satisfied. It is not an execution grant. `future_execution_allowed` remains unavailable in v1 because merge execution, auto-merge, and remote push are disabled by policy and runtime defaults.

A later task must add explicit approval profiles, environment gates, audited command boundaries, dry-run/live-test profiles, rollback evidence, and production Auth/RBAC/tenant enforcement before considering any real merge path.

## Safety Constraints

- metadata/readiness only;
- no real merge;
- no auto-merge;
- no remote Git operation;
- no GitHub API call or remote PR update;
- no force-push, rebase, branch deletion, or worktree deletion;
- no workspace mutation;
- no LLM/provider/vendor CLI call;
- no credential cache read;
- no secrets/env values in API, dashboard, docs, health, or tests;
- policy deny wins;
- service accounts cannot bypass approval or human review requirements;
- no production auth or tenant isolation claim.

## What This Task Implements

- Core Real Merge Execution Policy models.
- Deterministic in-memory/mock `RealMergeExecutionPolicyService`.
- Policy actions/resources for read/evaluate/request and denied future execution/override/post-evidence actions.
- Read-only API endpoints under `/git/merge-execution/*`.
- Readiness/health/dashboard visibility.
- Documentation, tests, and checklist updates.

## Out of Scope

- Actual merge execution.
- Any `git merge`, provider merge, remote push, fetch, rebase, force-push, checkout/switch, or branch deletion.
- Remote PR updates, GitHub API calls, reviewer assignment, PR close, or auto-merge.
- Production approval implementation.
- Durable merge execution audit persistence beyond current in-memory metadata.
- Rollback/revert execution.
- Production Auth/RBAC or tenant isolation enforcement.
- Live integration tests.
