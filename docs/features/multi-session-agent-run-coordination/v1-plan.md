# Multi-session Agent Run Coordination v1 Plan

Status: pre-implementation plan. No critical validation blockers were found during the repository and documentation inspection.

Canonical docs path: `docs/features/multi-session-agent-run-coordination/`. `docs/README.md` defines feature work as `docs/features/<slug>/vN-plan.md` followed by `vN.md`, so this feature belongs under `docs/features/` rather than an older flat docs path. Agent Workspace Lifecycle v2 is present under `docs/features/agent-workspace-lifecycle/v2-plan.md`, and coordination v1 should integrate with its `AgentWorkspaceLease` metadata when available.

## Current Task / TaskRun / AgentRun Behavior

- `Task` is the user-requested unit of work and records requester, repo, base branch, selected agent/model, selected registry refs, budget, and status.
- `TaskRun` is one execution attempt for a task. A task may have multiple attempts after completed or failed runs.
- `POST /tasks/:id/run` rejects an active queued or running `TaskRun` with `409 Conflict`; completed or failed tasks may create a new attempt.
- Local Agent Runner v1 records `AgentRun` metadata in `packages/runner` through `AgentRunnerService` and in-memory repositories.
- `MockAgentRunner` remains the default. `LocalAgentRunner` is disabled by default and can only run controlled fixture commands when every explicit local runner gate is enabled.
- Agent runs are currently recorded per task/task run, but there is no first-class session coordination object for multiple concurrent LLM sessions aimed at the same repo, task, branch, workspace, or file set.

## Current BranchLease Behavior

- Conflict Manager v1 keeps `BranchLease` as the active branch ownership/intention record for a task run.
- A branch lease records `taskId`, `taskRunId`, `repoId`, `branchName`, `baseBranch`, target files, symbols, tests, status, and timestamps.
- Conflict risk is computed from active branch leases in the same repo and intentionally remains deterministic and local/mock-first.
- Merge queue entries reference branch leases and refresh risk metadata without performing real provider merges or rebases.
- Real Git Adapter v2 may update changed-file metadata through gated GitHub changed-file reads only when explicit gates pass; default runtime remains mock-first.

## Current WorkspaceLease Behavior

- Agent Workspace Lifecycle v2 introduces `AgentWorkspaceLease`, `AgentWorkspaceLifecycleEvent`, and `AgentWorkspaceCleanupDecision` in `packages/runner/src/workspace-lifecycle.ts`.
- `AgentWorkspaceLease` links `taskId`, optional `taskRunId`, `agentRunId`, `repoId`, optional `branchLeaseId`, branch/base branch, workspace kind, sanitized workspace path metadata, lifecycle status, isolation status, owner attribution, and request/correlation metadata.
- `AgentWorkspaceLifecycleService` is in-memory/mock-first, supports fixture-only allocation through `LocalAgentWorkspaceManager`, models future worktree/clone/remote workspace kinds without executing them, and detects shared fixture workspace paths as `shared_forbidden`.
- Workspace lifecycle v2 remains metadata-first: it does not run `git worktree`, switch branches, delete non-fixture user directories, call providers, execute vendor CLIs, or expose secrets/env values.
- Multi-session coordination v1 should use `AgentWorkspaceLease.id` as `workspaceLeaseId` when available and flag missing or shared workspace lease metadata before future execution.

## Current Conflict Risk Behavior

- Conflict Manager v1 computes pairwise `ConflictRisk` from active branch leases using deterministic file and path scoring.
- Same-file and sensitive-path overlap increase risk; dry-run merge simulation evidence can raise queue risk.
- `MergeSimulationResult` supports mock and local-only `git merge-tree` simulation against explicitly supplied local repositories. It does not fetch, push, merge into the user branch, or call hosted providers.
- Existing conflict risk is branch-lease centric, not agent-session centric. It does not detect same workspace, same branch, missing target files, or multiple sessions from the same user before a branch lease exists.

## Problem Statement

One user can run LLM session A, B, and C against the same source repository at the same time. Multiple users can also run sessions against the same repo. If sessions share a working directory, branch switches and edits can interfere. If sessions reuse a branch or target the same file, later merge/review work becomes harder even when each individual run appears valid.

Aichestra needs a mock-first coordination layer at the AgentRun/session level so future agent runs can be assigned distinct branches and workspaces, and conflict risk can be detected before real runner, Git, or workspace mutation happens.

## Proposed Coordination Model

Add runner-owned metadata models:

- `AgentSession`: one requested/assigned/running/review/merge session tied to an `agentRunId`, user/actor, repo, base branch, optional task/task run, branch lease, workspace lease, target files, and source scope.
- `AgentRunCoordinationGroup`: active sessions grouped by repo, base branch, optional task, and optional user with coordination mode and group status.
- `AgentSessionOverlap`: pairwise overlap evidence between sessions, including same file, same directory, same branch, same workspace, missing target files, and base branch drift.
- `AgentConcurrencyPolicy`: deterministic policy metadata for repo/task/user/branch/workspace/file scopes.

Runtime repositories stay in memory for v1. Future persistent tables should be documented but not implemented as a production store in this milestone.

## Concurrency Policy

Default policy:

- require isolated workspace metadata for active sessions where possible;
- require unique branch names for active sessions where possible;
- warn on missing target files;
- warn or serialize on same-file overlap;
- block same-workspace overlap;
- warn/block same-branch overlap depending on group severity;
- keep symbol-aware policy as future metadata only.

Policy does not authorize runner command execution, Git provider calls, workspace mutation, remote LLM calls, or secret access.

## Overlap Detection Strategy

Deterministic v1 detection uses only session metadata:

- same exact file: high severity, serialize or split files;
- same directory: medium severity, warn or split files;
- same branch: high severity, serialize or require review;
- same workspace: critical severity, block;
- no target files: medium severity warning because the session scope is unknown;
- base branch drift: low/medium warning when active sessions in a repo use different base branches;
- different files/directories: no blocker, allow parallel with warnings only when group policy permits.

Future work:

- symbol-aware overlap;
- semantic conflict prediction;
- test-impact graph;
- edit intent graph and file lease reservations.

## Merge Queue Interaction

v1 does not change merge queue execution. It adds coordination metadata that can inform future merge queue policy:

- sessions marked `ready_for_review` or `ready_for_merge` can be listed alongside existing branch lease and merge queue state;
- same-file/same-branch/same-workspace overlap should create recommendations before queue entry creation;
- coordination status must not perform provider merge, rebase, force push, branch deletion, or branch cleanup;
- existing `BranchLease`, `ConflictRisk`, `MergeSimulationResult`, and `MergeQueueEntry` remain separate domain concepts.

## What This Task Implements

- In-memory/mock coordination models, repository, service, and DTOs in the runner boundary.
- `AgentRunCoordinationService` methods for registering sessions, assigning branch/workspace lease ids, updating target files, evaluating overlap, listing groups/overlaps, recommending actions, and marking review/merge readiness.
- Integration with Agent Workspace Lifecycle v2 `AgentWorkspaceLease` metadata and BranchLease metadata where available.
- API endpoints for metadata-only session registration, target-file updates, readiness transitions, coordination groups, overlaps, and summary.
- Dashboard/readiness visibility for active sessions, groups, branch/workspace assignment, overlap warnings, blockers, recommendations, merge readiness, and no-destructive-action status.
- Documentation updates across feature docs, roadmap, inventory, README, and AGENTS.
- Deterministic tests for session registration, grouping, overlap detection, recommendations, API safety, dashboard rendering, and no-secret/no-provider/no-execution behavior.

## Out of Scope

- Real agent execution.
- Real LLM calls.
- Vendor CLI execution.
- Remote Git operations.
- Branch creation, worktree creation, branch switching, merge, rebase, force push, branch deletion, or workspace deletion.
- Reading credential caches.
- Real workspace mutation beyond existing fixture-safe Local Agent Runner v1 behavior.
- Production tenant enforcement, production Auth/RBAC, durable coordination storage, distributed locks, and queue workers.
- Weakening Auth/RBAC, Policy-as-code, Git, LLM, Runner, Local Agent, Registry, Governance, Dashboard, Observability, Tenant Scope, or Secrets/Sandbox gates.
