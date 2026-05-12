# Conflict Manager v1

## Summary

Conflict Manager v1 adds local dry-run merge simulation behind a provider-agnostic `MergeSimulator` interface. It keeps the v0 file-overlap risk model and augments it with simulation evidence for conflict risk, merge queue status, API responses, and dashboard visibility.

Phase 2 `v0_implemented` did not mean Phase 2 was fully complete. v0 proved the lease graph, path scoring, and queue skeleton. v1 closes the most important next gap by distinguishing clean local merges from text conflicts without introducing real remote provider behavior.

## v0 Baseline

Phase 2 v0 already provided:

- `BranchLease` domain model and active lease tracking.
- `ConflictRisk` domain model with deterministic file-overlap scoring.
- `MergeQueueEntry` domain model and mock queue behavior.
- API endpoints for active leases, conflict risks, and merge queue entries.
- Dashboard visibility for leases, risks, and queue state.
- Tests for scoring, workflow queue behavior, and API inspection.

## v1 Additions

v1 adds:

- `MergeSimulationResult` domain model.
- `MergeSimulator` interface in `packages/core/src/conflicts/interfaces.ts`.
- `MockMergeSimulator` for deterministic mock outcomes.
- `LocalGitDryRunMergeSimulator` for local-only Git dry-run simulation.
- Simulation-aware `ConflictRisk` calculation.
- Simulation-aware `MergeQueueEntry` fields:
  - `simulationStatus`
  - `lastSimulationAt`
  - `conflictRiskScore`
  - `blockingReasons`
  - `recommendation`
- API endpoints for listing and running merge simulations.
- Dashboard visibility for dry-run status, conflicting files, and queue recommendation.
- Tests for mock simulation, local clean merge, local text conflict, non-mutation, risk combination, queue reflection, API visibility, and dashboard assumptions.

## MergeSimulator Interface

The interface accepts provider-agnostic input:

- `repoId`
- optional `repoPath`
- `baseRef`
- `sourceRef`
- optional `targetRef`
- optional `taskRunId`
- optional `branchLeaseId`
- `mode`
- optional mock `requestedStatus`

It returns:

- `status`: `clean`, `text_conflict`, `failed`, or `unavailable`
- `conflictingFiles`
- `changedFiles`
- `summary`
- sanitized command metadata
- `riskContribution`
- `createdAt`

The interface does not mention GitHub, GitLab, Bitbucket, PR providers, hosted remotes, credentials, or provider SDKs.

## Mock Simulator

`MockMergeSimulator` is the default MVP simulator. It can deterministically return:

- `clean`
- `text_conflict`
- `failed`
- `unavailable`

It is used by the worker vertical slice and API mock mode. It never touches the filesystem or network.

## Local Dry-Run Simulator

`LocalGitDryRunMergeSimulator` runs only against a local Git repository path supplied in the request.

Safety constraints:

- Does not fetch from remotes.
- Does not push.
- Does not call provider APIs.
- Does not merge into the user's current branch.
- Uses `git merge-tree --write-tree <targetRef> <sourceRef>`.
- Uses `git diff --name-only` only to collect changed-file evidence.
- Returns `unavailable` or `failed` when simulation cannot safely run.
- Sanitizes stdout and stderr before storing command metadata.

The test suite creates temporary fixture repositories and verifies that the simulator does not change the current branch or working tree status.

## Risk Combination

File-overlap scoring remains the primary deterministic signal:

- no overlap: `0.0`
- test-only overlap: `0.3`
- same top-level directory activity: `0.35`
- source overlap: `0.6`
- package overlap: `0.75`
- critical path overlap: `0.9`

Dry-run simulation augments that score:

- clean simulation: contributes `0.1`
- text conflict: contributes `0.8`
- failed or unavailable simulation: contributes `0.35`

The final risk score is the maximum of the file-overlap score and simulation contribution. A text conflict blocks the queue with `conflict_detected`. A failed or unavailable simulation is treated as warning evidence, not an automatic critical conflict.

## API Surface

Existing v0 endpoints:

- `GET /branches/leases?repoId=<repoId>&status=active`
- `GET /conflicts/risks?repoId=<repoId>`
- `GET /conflicts/risks?taskRunId=<taskRunId>`
- `GET /merge-queue?repoId=<repoId>`
- `POST /merge-queue/:id/mark-merged`
- `POST /merge-queue/:id/cancel`

New v1 endpoints:

- `GET /merge-simulations?repoId=<repoId>`
- `GET /merge-simulations?taskRunId=<taskRunId>`
- `GET /merge-simulations?branchLeaseId=<branchLeaseId>`
- `POST /merge-simulations`

`POST /merge-simulations` can run mock mode by branch lease, or local Git mode when a local `repoPath` is supplied. It does not fetch, push, or perform remote Git provider behavior.

## Dashboard Visibility

The web dashboard now shows:

- active branch leases
- file-overlap conflict risks
- dry-run merge simulation status
- conflicting files
- merge queue simulation status
- merge queue recommendation

The dashboard still uses deterministic seeded data for the MVP. It does not yet consume a live API read model.

## Test Strategy

Covered tests include:

- `MockMergeSimulator` clean result.
- `MockMergeSimulator` conflict, failed, and unavailable results.
- `LocalGitDryRunMergeSimulator` clean merge using a temporary repository.
- `LocalGitDryRunMergeSimulator` text conflict using a temporary repository.
- Local simulator non-mutation of branch and working tree status.
- Conflict risk combining file overlap and dry-run simulation.
- Merge queue recommendation/status from simulation.
- API endpoint for running/listing simulations.
- Dashboard assumptions for simulation visibility.

Tests do not require network access and do not call real provider services.

## Remaining Phase 2 Gaps

Still missing from fuller Phase 2:

- rebase-needed detection
- semantic conflict hints
- AST symbol overlap
- richer test impact overlap
- dependency or module overlap risk
- conflict resolver agent handoff
- human escalation workflow
- provider-backed GitHub/GitLab/Bitbucket adapters
- actual PR merge/rebase automation

Provider-backed integrations and actual merge/rebase automation remain out of scope until explicit approval and environment gates exist.

## Next Recommended Task

Add Phase 2 v1 hardening:

- rebase-needed detection using local-only ancestry checks
- stable API DTOs for simulation and risk details
- merge queue status history
- dashboard detail view for conflict evidence
- tests for failed/unavailable local simulation paths with existing queue entries
