# PR Ownership / Handoff Model v1 Plan

## Docs Placement

`docs/README.md` defines `docs/features/<slug>/` as the canonical location for feature-scoped plan and implementation history. This task follows the requested and canonical path:

- `docs/features/pr-ownership-handoff/v1-plan.md`
- `docs/features/pr-ownership-handoff/v1.md`

No `design_docs/` directory is present in the current repository.

## Current PR / Branch / Merge Queue Ownership Behavior

Real Git Adapter v2 records mock/local PRs, gated PR read models, GitHub webhook PR sync state, and branch sync state. It does not assign reviewers, mutate remote PRs, merge PRs, close PRs, delete branches, or call GitHub in default runtime/tests.

Multi-user / Multi-session Branch Orchestrator v2 owns branch allocation and branch ownership metadata. `BranchOwnershipRecord` links a branch to user/actor/task/task-run/agent-run/session, `BranchLease`, and optional `WorkspaceLease`. That ownership is branch-scoped and does not yet represent PR reviewer responsibility or handoff state.

Merge Queue Policy v2 consumes branch lease, workspace, coordination/edit-intent, conflict risk, dry-run, validation, approval, and policy evidence. It records readiness decisions and holds only. It does not currently require a first-class PR owner before readiness, and it never executes merges or updates remote PRs.

## Current BranchLease Behavior

`BranchLease` remains a Conflict Manager / Git scope record. It links task, task run, repo, branch name, base branch, touched files, tests, symbols, and lease status. Branch leases are used by conflict risk scoring, dry-run simulation linkage, merge queue entries, branch orchestration, workspace lifecycle, worktree allocation, and conflict resolution. Lease release remains separate from PR ownership transfer.

## Current AgentRun / TaskRun Attribution Behavior

Task and TaskRun records live in the core data store. Agent Runner metadata now links agent runs to `workspaceLeaseId`, branch names, task ids, and task run ids. Agent Workspace Lifecycle v2 records workspace owner attribution and branch lease linkage. Multi-session coordination records session/task/agent branch and workspace metadata. None of these surfaces currently model PR review owner transfer.

## Current RequestContext / AuthContext Behavior

RequestContext Propagation v1 is implemented as mock-first attribution. API AuthContext Middleware Skeleton v1 resolves one safe mock/request context per request, with request id, correlation id, actor/principal metadata, auth mode, source, roles, teams, and optional scope metadata. It does not implement production auth, cookies, Authorization-header auth, sessions, JWTs, or external IdP calls.

## Current Service Account Actor Boundary Behavior

Service Account Actor Boundary v1 provides static mock service-account contexts for system/service attribution. Existing Git, GitHub webhook, Git sync, GitHub App token-handle, LLM, MCP, Security, Runner, Local Agent, Registry/Governance, dashboard, and readiness service accounts are attribution metadata only. Service accounts do not bypass Policy-as-code, Auth/RBAC, SecretRef, tenant scope, or Git safety gates.

## Current GitHub App / Git Adapter Behavior

GitHub App Controlled Implementation v1 is a disabled/mock token-handle boundary by default. GitHub App integration-test profile v1 is skipped by default. Real Git Adapter v2 gates branch creation, PR creation, changed-file refresh, webhook processing, and GitHub App token checks behind explicit configuration and policy. Merge, rebase, force-push, branch deletion, reviewer assignment, remote PR update, and auto-merge remain out of scope.

## Ownership / Handoff Problem Statement

Aichestra can create or observe PR/branch metadata without a first-class record of who owns follow-up review. This creates ambiguity when:

- an agent-generated PR must be reviewed by a human;
- one human delegates a branch or PR to another human/team;
- a failed agent run needs human or future-agent takeover;
- conflict resolution requires an owner/reviewer;
- merge queue readiness needs a responsible owner before proceeding.

## Proposed Ownership Model

`PrOwnershipRecord` will model the responsible owner for a PR/branch/task/agent-run scope:

- repo, branch, optional PR id/number;
- optional `BranchLease`, `WorkspaceLease`, `MergeQueueEntry`, and Conflict Resolution Plan ids;
- task, task run, and agent run ids;
- owner actor/principal/kind/team metadata;
- reviewer actor/team metadata;
- status and sanitized metadata;
- request/correlation metadata through audit events.

The model is metadata-only and does not update GitHub assignees, reviewers, labels, PR state, branch refs, or merge queue execution state.

## Proposed Handoff State Machine

`PrHandoffRequest.status`:

```text
requested -> accepted
requested -> rejected
requested -> expired
requested -> cancelled
requested -> blocked_policy
requested -> blocked_missing_context
```

`PrHandoffDecision.decision`:

```text
accept | reject | hold | request_more_info | expired | blocked
```

Accepted handoffs transfer owner metadata locally and emit `ownership_transferred`. Rejected, expired, blocked, or cancelled handoffs preserve the existing owner. Human-to-agent handoff remains future metadata and is blocked unless a later task adds explicit agent acceptance gates.

## Merge Queue Interaction

The service will expose merge queue ownership readiness metadata. A queue entry with no active/handed-off/review-requested owner can be surfaced as `missing_owner`. This is evidence for reviewers and future merge queue policy integration only; v1 does not automatically hold, release, merge, or mutate queue entries.

## Conflict Resolution Interaction

Ownership records can link to Conflict Resolution Assistant plan ids. The service can surface owner/reviewer metadata for a plan so conflict review can identify the responsible actor/team. It does not mark plans reviewed, apply conflict resolutions, release holds, or execute validation commands.

## Safety Constraints

- metadata only;
- no real remote Git operation;
- no GitHub API call;
- no remote PR update;
- no real reviewer assignment;
- no PR merge, close, or branch deletion;
- no auto-merge;
- no LLM/provider/vendor CLI call;
- no workspace mutation;
- no credential cache read;
- no secrets/env values in output;
- policy deny wins;
- service accounts cannot bypass human handoff requirements;
- no production auth claim.

## What This Task Implements

- Core PR ownership, handoff request, handoff decision, audit event, readiness/link models.
- Deterministic in-memory/mock `PrOwnershipService`.
- Policy action/resource coverage for local metadata ownership/handoff and denied future remote PR updates/reviewer assignment.
- API endpoints under `/git/pr-ownership` and `/git/pr-handoffs`.
- Readiness/health/dashboard visibility.
- Dashboard Git panel integration and safe demo data.
- Documentation, tests, and checklist updates.

## Out of Scope

- GitHub assignee/reviewer mutation.
- Remote PR state update, merge, close, or label updates.
- Branch deletion or cleanup.
- Production distributed ownership locks.
- Durable PR ownership persistence beyond current in-memory runtime.
- Production Auth/RBAC enforcement or tenant-isolated ownership stores.
- Human notification delivery.
- Agent-to-human or human-to-agent execution orchestration beyond metadata.
- Automatic merge queue hold/release.
