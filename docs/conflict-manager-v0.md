# Conflict Manager v0

## Scope

Conflict Manager v0 tracks mock AI branch activity and computes deterministic conflict risk without performing real git merge, rebase, merge-tree, or provider API operations.

## Domain Concepts

### BranchLease

A `BranchLease` records the files a task run is expected to affect on a mock branch. Leases remain `active` after task completion because the mock PR branch still exists. A lease becomes `released` when its merge queue entry is marked `merged` or `cancelled`.

### ConflictRisk

A `ConflictRisk` is a pairwise risk result between two active leases in the same repo. It stores source and target lease/run identifiers, exact overlapping files, a score from `0.0` to `1.0`, a risk level, reasons, and a recommendation.

### MergeQueueEntry

A `MergeQueueEntry` represents a mock PR waiting for merge. The entry is `ready` when conflict risk is low and `blocked` when the branch should be serialized or reviewed first.

## File-Overlap Scoring

Risk scoring is deterministic and path-based:

- no overlap: `0.0`, `none`, `safe`
- docs-only overlap: `0.1`, `low`, `safe`
- test-only overlap: `0.3`, `low`, `monitor`
- same top-level directory activity without exact overlap: `0.35`, `medium`, `monitor`
- source file overlap: `0.6`, `medium`, `serialize`
- package or lockfile overlap: `0.75`, `high`, `block`
- critical path overlap: `0.9`, `critical`, `human_review`

Critical paths include CI workflows, infra, Terraform, migrations, Prisma schema, schema directories, auth paths, and security paths.

## Merge Queue Mapping

- `riskScore < 0.50`: `ready`
- `0.50 <= riskScore < 0.85`: `blocked` with `serialize_with_overlapping_branch`
- `riskScore >= 0.85`: `blocked` with `human_review_required_for_critical_overlap`

## API Surface

- `GET /branches/leases?repoId=<repoId>&status=active`
- `GET /conflicts/risks?repoId=<repoId>`
- `GET /conflicts/risks?taskRunId=<taskRunId>`
- `GET /merge-queue?repoId=<repoId>`
- `POST /merge-queue/:id/mark-merged`
- `POST /merge-queue/:id/cancel`

## Non-Goals

v0 does not execute real git operations, call GitHub/GitLab/Bitbucket, run semantic conflict analysis, inspect AST symbols, invoke resolver agents, or perform human approval workflow beyond simple queue statuses.

## Evolution

Conflict Manager v1 adds local dry-run merge simulation behind `MergeSimulator`; see `docs/conflict-manager-v1.md`.

Later versions can add rebase-needed detection, AST or language-server symbol overlap, semantic conflict detection, CI signal integration, conflict resolver agents, and provider-backed merge queues behind the existing interfaces.
