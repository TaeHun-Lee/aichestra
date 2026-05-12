# Phase 2 Completion Gap

## Summary

Phase 2 v0 is implemented as a mock-only Conflict Manager baseline. It provides separate branch lease, conflict risk, and merge queue concepts with deterministic file-overlap scoring and API/dashboard visibility.

Phase 2 is not fully complete. The most important next gap is local dry-run merge simulation behind provider-agnostic interfaces, without remote Git provider integration.

## 1. Phase 2 v0 Implemented Capabilities

| Capability | Status | Evidence |
|---|---|---|
| BranchLease domain model | implemented | `BranchLease` in `packages/core/src/domain/models.ts`; store methods `createBranchLease`, `listBranchLeases`, `releaseBranchLease` in `packages/db/src/repository.ts`. |
| ConflictRisk domain model | implemented | `ConflictRisk` in `packages/core/src/domain/models.ts`; `createConflictRisk` in `packages/core/src/conflicts/scoring.ts`. |
| MergeQueueEntry domain model | implemented | `MergeQueueEntry` in `packages/core/src/domain/models.ts`; queue methods in `packages/db/src/repository.ts`. |
| Active lease tracking | implemented | Workflow creates active leases in `apps/worker/src/workflows/run-agent-task-workflow.ts`; store filters active leases in `listActiveBranchLeases`. |
| File overlap risk scoring | implemented | Deterministic scoring in `packages/core/src/conflicts/scoring.ts`; tests in `tests/conflict-risk-scoring.test.ts`. |
| Mock merge queue skeleton | implemented | `createMergeQueueEntry`, `refreshMergeQueueEntryRisk`, `markMergeQueueEntryMerged`, and `cancelMergeQueueEntry` in `packages/db/src/repository.ts`. |
| API endpoints for leases, risks, or merge queue | implemented | `GET /branches/leases`, `GET /conflicts/risks`, `GET /merge-queue`, `POST /merge-queue/:id/mark-merged`, and `POST /merge-queue/:id/cancel` in `apps/api/src/main.ts`. |
| Dashboard visibility for conflict status | implemented | Active leases, conflict risks, and merge queue sections in `apps/web/src/render.ts`; summary data in `apps/web/lib/mock-data.ts`. |
| Tests for conflict risk and queue behavior | implemented | Conflict scoring tests in `tests/conflict-risk-scoring.test.ts`; workflow/queue tests in `tests/mock-workflow-vertical-slice.test.ts`; API tests in `tests/api-health.test.ts`. |
| Documentation for Conflict Manager v0 | implemented | `docs/features/conflict-manager/v0.md`. |

## 2. Phase 2 Full Completion Gaps

- Local dry-run merge simulation.
- Clean merge versus text conflict detection.
- Conflicting file extraction from simulation output.
- Merge queue status updates based on simulation results.
- Rebase-needed detection.
- Semantic conflict hints.
- AST symbol overlap.
- Test overlap risk beyond path-based file classification.
- Dependency or module overlap risk.
- Conflict resolver agent handoff.
- Human escalation workflow beyond status flags.
- Actual GitHub/GitLab provider integration.
- Actual PR merge/rebase automation.

## 3. v1 Scope Decision

| Missing Item | Decision | Reason |
|---|---|---|
| MergeSimulator interface | in_scope_for_v1 | Required provider-agnostic seam for simulation. |
| MockMergeSimulator | in_scope_for_v1 | Keeps default MVP behavior deterministic. |
| LocalGitDryRunMergeSimulator | in_scope_for_v1 | Closes the primary Phase 2 gap using local-only Git. |
| Local-only git dry-run merge simulation | in_scope_for_v1 | Required, with no fetch, push, or permanent working tree mutation. |
| Simulation result connected to ConflictRisk | in_scope_for_v1 | Required so risk combines file overlap and dry-run evidence. |
| Simulation result connected to MergeQueueEntry | in_scope_for_v1 | Required so queue entries expose simulation status and recommendations. |
| API visibility | in_scope_for_v1 | Required for triggering/listing simulation results. |
| Dashboard visibility | in_scope_for_v1 | Required for user-visible Conflict Manager v1 state. |
| Tests | in_scope_for_v1 | Required for simulator safety and deterministic behavior. |
| Documentation | in_scope_for_v1 | Required for phase interpretation and constraints. |
| Clean merge vs text conflict detection | in_scope_for_v1 | Local simulator should distinguish these. |
| Conflicting file extraction | in_scope_for_v1 | Extract from local simulation output where available. |
| Merge queue status updates from simulation | in_scope_for_v1 | Queue recommendation/status should include simulation evidence. |
| Rebase-needed detection | future_phase_2_work | Needs broader branch ancestry and policy rules. |
| Semantic conflict hints | future_phase_2_work | Needs language-aware analysis. |
| AST symbol overlap | future_phase_2_work | Needs parsers or language servers. |
| Test overlap risk | future_phase_2_work | v0 has path-based test overlap; richer impact analysis is later. |
| Dependency/module overlap risk | future_phase_2_work | Needs module graph or package metadata analysis. |
| Conflict resolver agent handoff | future_phase_2_work | Requires agent orchestration and approval rules. |
| Human escalation workflow | future_phase_2_work | v0/v1 status flags are not a full workflow. |
| Actual GitHub/GitLab provider integration | out_of_scope_for_now | Violates mock/local-only constraint for this task. |
| Actual PR merge/rebase automation | out_of_scope_for_now | Explicitly prohibited for this task. |

## 4. V0 Gap Handling

No v0 blockers were found.

The repository already has:

- `BranchLease`
- `ConflictRisk`
- `MergeQueueEntry`
- deterministic file-overlap risk scoring
- mock merge queue behavior
- conflict risk tests
- API and dashboard inspection paths

Proceed to Conflict Manager v1.

## 5. V1 Implementation Result

Conflict Manager v1 is now implemented for the required local-only scope.

Implemented v1 capabilities:

- `MergeSimulator` interface in `packages/core/src/conflicts/interfaces.ts`.
- `MergeSimulationResult` domain model in `packages/core/src/domain/models.ts`.
- `MockMergeSimulator` and `LocalGitDryRunMergeSimulator` in `packages/adapters/src/git/merge-simulators.ts`.
- Local dry-run merge simulation through `git merge-tree --write-tree`, with no fetch, push, remote provider calls, or permanent working tree mutation.
- Simulation results persisted in the in-memory store through `recordMergeSimulation` and `listMergeSimulations`.
- Conflict risk augmented with simulation status, summary, and risk contribution.
- Merge queue entries augmented with simulation status, last simulation time, conflict risk score, blocking reasons, and recommendation.
- API visibility through `GET /merge-simulations` and `POST /merge-simulations`.
- Dashboard visibility for dry-run status, conflicting files, and queue recommendations.
- Tests for mock simulator statuses, local clean merge, local text conflict, local non-mutation, risk combination, queue reflection, API visibility, and dashboard assumptions.

Phase 2 should be described as `v1_implemented`, not fully complete. Remaining Phase 2 work still includes rebase-needed detection, semantic conflict hints, AST symbol overlap, richer test/dependency impact signals, resolver handoff, human escalation workflow, and real provider-backed merge automation behind explicit interfaces.
