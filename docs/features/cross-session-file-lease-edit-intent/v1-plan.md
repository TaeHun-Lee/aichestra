# Cross-session File Lease / Edit Intent Graph v1 Plan

Status: planned for this task.

This document follows the current docs organization described in `docs/README.md`: feature work lives under `docs/features/<feature>/`, with implementation plans named `vN-plan.md` and completed feature docs named `vN.md`.

## Current Conflict Risk Behavior

Conflict Manager v1 keeps `BranchLease`, `ConflictRisk`, `MergeQueueEntry`, and `MergeSimulationResult` as separate concepts. Existing risk scoring is deterministic and mock/local-only:

- exact file overlap drives low/medium/high/critical risk;
- docs/test/source/package/critical paths receive different score bands;
- same top-level directory activity can raise risk even without exact overlap;
- local dry-run merge simulation is available only for explicit local fixtures through `MergeSimulator`;
- default runtime does not fetch, push, merge, rebase, or call hosted Git providers.

This gives merge-time evidence, but it does not model edit intent before work starts.

## Current Branch, Session, And Workspace Metadata

Current related surfaces are:

- `BranchLease`: Git/conflict-scope lease tied to task runs, branch names, and expected changed files.
- `AgentWorkspaceLease`: Agent Workspace Lifecycle v2 per-agent-run workspace lease, lifecycle state, isolation status, cleanup decision, and optional `branchLeaseId`.
- `AgentSession`: Multi-session Agent Run Coordination v1 session metadata with repo/base branch, branch/workspace lease ids, target files, source scope, and same-file/same-directory/same-branch/same-workspace overlap detection.
- Dashboard/readiness: Agent Runner panel already displays workspace lifecycle and session coordination summaries.

These are metadata-only and mock-first. None of them lock OS files or mutate source files.

## Problem Statement

Separate branches and workspaces avoid branch-switch interference, but they do not prevent two sessions from planning to edit the same file, adjacent files in the same directory, or broad unknown scopes. Waiting until merge queue or dry-run simulation time is too late for good coordination. Aichestra needs an explicit edit-intent graph and file lease model so concurrent sessions can warn, serialize, split file ownership, require review, or block unsafe same-workspace use before merge time.

## Proposed File Lease Model

`FileLease` will record metadata for a session's file-level claim:

- repo id and normalized relative file path;
- optional path hash for sanitized correlation;
- lease kind: `read`, `write_intent`, `exclusive_write_future`, or `review`;
- owner session, agent run, task, actor, branch, and optional workspace lease;
- status: `requested`, `active`, `warning_overlap`, `blocked_overlap`, `released`, or `expired`;
- timestamps, optional expiry, and sanitized metadata.

The model is not an OS file lock. `exclusive_write_future` is a future global-enforcement marker only.

## Proposed Edit Intent Graph Model

`EditIntent` will record a session's planned work:

- repo, session, optional agent run/task, branch, and optional workspace lease;
- intent kind: `modify`, `create`, `delete_future`, `rename_future`, `read_only`, `refactor`, `test_update`, or `docs_update`;
- normalized target file paths and directory scopes;
- optional future declared symbols;
- confidence and lifecycle status.

`EditIntentGraphNode` and `EditIntentGraphEdge` will form a deterministic graph across sessions, files, directories, branches, workspaces, and tasks. Edges represent intended edits, file leases, overlaps, same directory, same branch, same workspace, and future symbol overlap.

## Overlap Detection Strategy

The service will evaluate active intents and leases per repo:

- exact same file with write-like intents: high severity, serialize;
- same directory with broad refactor/write-like intents: medium or high severity, split files or require review;
- read-only intent with write intent: low severity, warn;
- same workspace lease: critical severity, block;
- same branch: medium/high severity, serialize;
- missing target files or broad unknown directory scope: medium warning;
- symbol-aware overlap remains future metadata.

All comparisons are deterministic string/path metadata checks. No source file read, write, or lock is required.

## Coordination Action Strategy

Recommendations map to overlap severity:

- `allow`: no meaningful overlap or compatible read-only activity;
- `warn`: low-risk read/write or unknown-target warning;
- `split_files`: same directory but distinct files;
- `serialize`: same file or same branch write contention;
- `require_review`: broad refactor or high directory overlap;
- `block`: same workspace or critical conflict.

The recommendation is advisory metadata. It must not bypass Policy-as-code or other gates.

## What This Task Implements

- `FileLease`, `EditIntent`, graph node/edge, and overlap assessment models in `packages/runner`.
- A deterministic in-memory `EditIntentGraphService`.
- Metadata-only file lease request/release, intent declaration, graph build, overlap evaluation, summary, and recommendation APIs.
- Integration hooks with existing `AgentRunCoordinationService` and workspace/branch metadata by optional ids.
- Agent Runner dashboard/readiness read model visibility.
- Documentation, roadmap/inventory updates, and deterministic tests.

## Out Of Scope

- OS-level file locks.
- Source file mutation or source parsing.
- Real Git operations, branch/worktree creation, checkout/switch, merge, rebase, fetch, push, or branch deletion.
- Vendor CLI execution or LLM provider calls.
- Persistent Postgres repositories.
- Distributed locks.
- Symbol-aware language server integration.
- Merge queue enforcement beyond metadata visibility.
- Production tenant filtering or production auth behavior.
