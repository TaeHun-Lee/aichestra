# Conflict Resolution Assistant v1 Plan

## Status

Planned for this task. This path follows the current `docs/README.md` feature layout: new feature documents live under `docs/features/<feature-name>/`.

## Current Conflict Risk Behavior

Conflict Manager v1 models `BranchLease`, `ConflictRisk`, `MergeQueueEntry`, and `MergeSimulationResult` as separate local/mock-first concepts. Conflict risk scoring is deterministic: same-file overlap, lock/package files, critical paths, tests, docs, same top-level directory activity, and dry-run merge simulation status contribute to a risk score and recommendation.

Conflict risk metadata does not mutate source files, create branches, fetch, push, merge, rebase, update remote pull requests, or call providers.

## Current Dry-run Merge Simulation Behavior

Dry-run merge simulation records `MergeSimulationResult` metadata with status, conflicting files, changed files, summary, mode, and risk contribution.

Default simulation is `MockMergeSimulator`. `LocalGitDryRunMergeSimulator` is explicitly allowlisted and local-only for supplied fixture/local repository paths. It must not fetch, push, call hosted Git providers, or mutate the user's working branch.

## Current Merge Queue Policy Behavior

Merge Queue Policy v2 is implemented in `packages/core` as a metadata-only readiness layer. It consumes branch leases, conflict risk, latest dry-run simulation, workspace snapshots, coordination/edit-intent overlap snapshots, validation/approval metadata, and policy decisions.

It produces `MergeReadinessDecision`, deterministic priority ranking, and `MergeQueueHold` metadata. It never executes merges, releases holds automatically, updates remote PRs, mutates workspaces, calls LLMs, or bypasses Policy/Auth/RBAC/Tenant/Secret/Safety gates.

## Current Branch, Workspace, and Session Metadata Behavior

Multi-user / Multi-session Branch Orchestrator v2 records branch allocation, ownership, naming policy, and base-branch drift metadata only. It never creates, switches, fetches, pushes, merges, rebases, force-pushes, or deletes branches.

Agent Workspace Lifecycle v2 records one active workspace lease per agent run, isolation status, and cleanup decisions. It remains fixture/mock-first and does not create real worktrees or delete user directories.

Multi-session Agent Run Coordination v1 records session/group/overlap/concurrency metadata. Cross-session File Lease / Edit Intent Graph v1 records file lease, edit intent, graph, and overlap assessment metadata. These systems detect same-file, same-directory, same-branch, same-workspace, broad unknown, rename_future, and delete_future style risks where available, but they do not lock files, mutate source, call providers, execute agents, or read credential caches.

## Current LLM Gateway Behavior

LLM Gateway v2 is mock-first. Remote OpenAI-compatible completion is gated and disabled by default. Default tests use mock providers and must not call OpenAI, Anthropic, GitHub, vendor CLIs, credential caches, or external providers.

Conflict Resolution Assistant v1 can document a future LLM-assisted profile, but this task must use deterministic local logic only.

## Proposed Conflict Assistant Model

Conflict Resolution Assistant v1 adds core metadata models:

- `ConflictResolutionRequest`
- `ConflictSummary`
- `ConflictResolutionPlan`
- `ConflictResolutionRecommendation`

The assistant will consume ids and snapshots for dry-run simulation, merge queue entry, conflict risk, branch leases, workspace leases, and edit overlaps when available. It will store in-memory review metadata in the default runtime and expose safe API/dashboard summaries.

## Conflict Classification Strategy

Classification is deterministic and evidence-weighted:

- dry-run text conflicts and same-file edit overlaps classify as `same_file_edit`.
- same-directory or broad refactor overlap metadata classifies as `same_directory_refactor`.
- edit-intent future rename/delete metadata classifies as `rename_modify_future` or `delete_modify_future`.
- lock/package files classify as `dependency_lockfile`.
- generated/build output paths classify as `generated_file`.
- missing or ambiguous evidence classifies as `unknown`.

Severity derives from the strongest available evidence: dry-run text conflict, conflict risk score/level, edit overlap severity, lock/critical file classes, and workspace/session blockers.

## Resolution Plan Strategy

Plans are review-only. The service will generate deterministic steps such as review conflicting files, compare intended branches, preserve both behavior paths when safe, split broad refactors, request human review for high/critical evidence, and rerun dry-run simulation after a human-authored resolution.

`applyAllowed` is always `false` in v1. Plan status may move from `draft` to `review_required`, `blocked`, or `future_apply` metadata after review, but v1 never applies patches or performs merges.

## Test Impact Suggestion Strategy

Suggested validation is derived from affected paths and existing project conventions:

- package/lockfile conflicts suggest dependency validation plus `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- source conflicts suggest `pnpm test` and `pnpm typecheck`.
- test-file conflicts suggest `pnpm test`.
- docs-only conflicts suggest `pnpm lint` and targeted review.
- generated files suggest regenerating through existing project scripts only if a reviewer confirms the generator.

Suggestions are strings only. The assistant does not execute commands.

## Safety Constraints

- no source file mutation
- no patch application
- no real merge/rebase/fetch/push/force-push/checkout/switch/branch deletion
- no remote Git provider call
- no real LLM provider call by default
- no vendor CLI execution
- no credential cache reads
- no secrets/env values in API/dashboard/audit metadata
- no automatic merge queue hold release
- policy deny still wins

## What This Task Implements

- core conflict assistant models and deterministic service
- in-memory default storage in the service
- metadata-only API endpoints under `/git/conflicts/assistant/*`
- dashboard conflict panel visibility
- merge queue hold linkage metadata and recommendations
- future LLM hook metadata with `realLlmUsed: false`
- documentation, deterministic tests, and compliance scan

## Out of Scope

- automatic conflict resolution
- patch generation or patch application
- merge execution
- real Git provider merge/rebase/fetch/push operations
- GitHub PR updates
- real LLM completion
- durable production storage
- production tenant enforcement changes
- source code inspection for resolution content beyond supplied metadata
- executing suggested validation commands from the assistant service
