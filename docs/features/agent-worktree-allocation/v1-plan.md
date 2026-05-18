# Agent Worktree Allocation v1 Plan

Status: planned for this task

Chosen path: `docs/README.md` organizes feature work under `docs/features/<feature>/vN-plan.md` and `vN.md`. Agent Worktree Allocation is a new feature surface, so this plan lives under `docs/features/agent-worktree-allocation/`.

## Current Agent Workspace Lifecycle Behavior

Agent Workspace Lifecycle v2 lives in `packages/runner` and models workspace leases, lifecycle events, cleanup decisions, fixture workspace allocation, and future workspace kinds. It already treats `git_worktree_future` as metadata only and records that real worktree execution and destructive cleanup are disabled. Fixture allocation validates local workspace paths through the runner workspace manager, but lifecycle records are still lease metadata and must not become production workspace mutation.

## Current Branch Orchestrator Behavior

Multi-user / Multi-session Branch Orchestrator v2 lives in `packages/git-adapter`. It allocates branch ownership metadata, creates branch leases through the store boundary when allowed, tracks workspace lease linkage, detects branch collisions and same-workspace blockers, and keeps branch creation, checkout, push, merge, rebase, and deletion disabled by default.

## Current Git Adapter Behavior

Real Git Adapter v2 supports safe provider abstractions, webhook/read-model metadata, dry-run merge simulation, and gated local fixture Git operations where explicitly allowed. Default runtime does not execute remote Git, real merges, branch switching, worktree creation, provider calls, or destructive Git commands.

## Why Worktree Allocation Is Needed

Branch separation does not isolate working directories. Multiple agent sessions can share a branch-safe model while still colliding on the same filesystem path. Agent Worktree Allocation v1 introduces an explicit boundary that can validate requested worktree paths, branch lease linkage, and workspace root allowlists before future Git worktree creation is considered.

## Fixture-Only Worktree Allocation Strategy

v1 adds deterministic request/result/safety-check models and a mock-first service. Dry-run allocation validates path and lease metadata without filesystem mutation. Fixture allocation may create only metadata-backed fixture workspace lease records through Agent Workspace Lifecycle; it does not run `git worktree add`, clone repositories, switch branches, or delete directories.

## Future Production Worktree Allocation Gates

Production Git worktree allocation remains disabled. A future implementation must require explicit gates such as `AICHESTRA_ENABLE_AGENT_WORKTREE_ALLOCATION=true`, an allowlisted workspace root, fixture or integration-test mode, policy approval, branch lease validity, workspace lifecycle isolation, runner sandbox checks, tenant scope metadata, audit correlation, and no remote Git side effects. `git_worktree_future` requests in v1 return a blocked/future decision.

## Workspace Root Allowlist Strategy

The service accepts configured workspace roots and treats `AICHESTRA_WORKSPACE_ROOT_ALLOWLIST` as future/readiness metadata. The dashboard and health surfaces expose only whether roots are configured and the count of allowed roots, never the root values. Requested paths must resolve inside an allowlisted root and must not contain traversal, absolute path escapes, or shared active worktree paths.

## Cleanup Strategy

v1 does not delete real directories. Cleanup is modeled through existing Agent Workspace Lifecycle cleanup decisions, where destructive cleanup stays disabled. Allocation results record `destructiveCleanupExecuted: false` and `nonFixtureDeletionAllowed: false`.

## Safety Constraints

- Do not run `git worktree add` or `git worktree remove`.
- Do not run checkout, switch, reset, clean, fetch, push, merge, rebase, force-push, or branch deletion.
- Do not delete user workspaces or mutate real repositories.
- Do not call LLM providers, vendor CLIs, hosted Git providers, or credential caches.
- Do not expose secrets, env values, or sensitive absolute paths.
- Do not bypass Git, Workspace Lifecycle, Branch Orchestrator, Runner, Auth/RBAC, Policy, Tenant Scope, Dashboard, Observability, Registry, Governance, or Safety gates.

## What This Task Implements

- Agent worktree allocation request/result/safety-check models.
- Deterministic in-memory service for validation, dry-run allocation, fixture allocation metadata, listing, safety checks, and summary.
- Workspace root allowlist and path collision checks.
- Branch lease and branch-name validation.
- Optional linkage to Agent Workspace Lifecycle and Branch Orchestrator metadata.
- Safe API, dashboard, readiness, and health visibility.
- Deterministic tests for safe behavior and blocked modes.

## Out Of Scope

- Real `git worktree add/remove`.
- Production worktree cleanup or directory deletion.
- Remote Git operations.
- Real provider, LLM, vendor CLI, or credential-cache access.
- Automatic branch creation or branch switching.
- Production tenant isolation enforcement or production auth.
- Auto-remediation of workspace conflicts.
