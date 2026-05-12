# Phase 1 and Phase 2 Completion Audit

## Scope

This audit inspected whether Phase 1 and Phase 2 are complete enough to proceed to Phase 3 Registry v0.

No application code was changed. No integrations were added. No real external APIs were called.

Evidence reviewed:

- `AGENTS.md`
- `README.md`
- `AICHESTRA_BOOTSTRAP.md`
- `AICHESTRA_CODEX_NEXT_STEPS.md`
- `AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md`
- `docs/audits/2026-05-11-bootstrap-gap-report.md`
- `docs/audits/2026-05-11-phase-progress-audit.md`
- `docs/audits/2026-05-11-phase-2-completion-gap.md`
- `docs/features/conflict-manager/v0.md`
- `docs/features/conflict-manager/v1.md`
- implementation under `apps/`, `packages/`, `tests/`, and `scripts/`

## 1. Phase Interpretation

Status vocabulary used in this audit:

- `not_started`
- `planned_only`
- `scaffolded`
- `v0_implemented`
- `v1_implemented`
- `partially_implemented`
- `complete_for_current_milestone`
- `production_ready`

Phase definitions:

- Phase 1: LLM and cost management foundation, task orchestration, mock or real Git workflow, usage ledger, API, worker, dashboard.
- Phase 2: Branch conflict manager, branch lease graph, conflict risk scoring, merge queue, dry-run merge simulation, conflict visibility.
- Phase 3: Skill Registry, Harness Registry, Instruction Registry, version pinning, registry APIs, registry dashboard, registry-backed task selection.
- Phase 4: Auto-improvement loop, trace clustering, LLM-based Skill or Harness patch proposals, eval, canary rollout.
- Phase 5: Enterprise features such as SCIM, audit export, policy-as-code, private deployment, data residency, advanced security.

Current interpretation:

| Phase | Status | Reason |
|---|---|---|
| Phase 1 | `complete_for_current_milestone` | The mock MVP vertical slice exists end to end, is validated, is tested, keeps provider behavior mocked, and has no critical architecture blockers. It is not production-ready. |
| Phase 2 | `complete_for_current_milestone` | The v0 conflict manager and v1 local-only dry-run simulation are implemented, validated, tested, and visible through API/dashboard surfaces. It is not full Phase 2 or production-ready. |
| Phase 3 | `partially_implemented` | Separate Skill, Harness, and Instruction concepts plus seed/helper registries exist, but CRUD, version pinning workflows, registry APIs, registry dashboard, and registry-backed task selection are not complete. |
| Phase 4 | `planned_only` | Some model fields and roadmap references exist, but no auto-improvement loop implementation exists. |
| Phase 5 | `planned_only` | Security and enterprise topics are documented, but enterprise features are not implemented. |

## 2. Phase 1 Completion Audit

| Required capability | Status | Evidence | Concerns |
|---|---|---|---|
| Task domain model | implemented | `Task` in `packages/core/src/domain/models.ts`; `Task` schema construction via `taskFromInput` in `packages/core/src/schemas/domain.ts` | In-memory persistence only. |
| TaskRun domain model | implemented | `TaskRun` in `packages/core/src/domain/models.ts`; `createTaskRun` in `packages/db/src/repository.ts` | TaskRun transitions are typed but not enforced by a transition function. |
| Task creation API | implemented | `POST /tasks` route in `apps/api/src/main.ts`; `InMemoryAichestraStore.createTask` | Returns domain-shaped object directly; stable DTOs can come later. |
| Task run trigger API | implemented | `POST /tasks/:id/run` route in `apps/api/src/main.ts`; delegates to `runAgentTaskWorkflow` | Synchronous MVP trigger only. |
| Worker or workflow execution path | implemented | `runAgentTaskWorkflow` in `apps/worker/src/workflows/run-agent-task-workflow.ts` | Workflow is monolithic but correctly outside API handler. |
| Mock policy check | implemented | `MockPolicyEngine.evaluateTask` in `packages/adapters/src/policy/mock-policy-engine.ts`; workflow calls `policyEngine.evaluateTask` | Policy is intentionally simple. |
| Mock model selection | implemented | `MockModelRouter.selectModel` in `packages/llm-gateway/src/model-router.ts` | No budget-aware routing yet. |
| Mock skill selection | implemented | Workflow selects from `store.listSkills()`; seed skill in `packages/core/src/registries/seed-data.ts` | Full registry/version pinning deferred to Phase 3. |
| Mock harness selection | implemented | Workflow selects from `store.listHarnesses()`; seed harness in `packages/core/src/registries/seed-data.ts` | Full harness CRUD/YAML validation deferred to Phase 3. |
| Mock instruction set selection | implemented | `assembleInstructionSet` in `packages/core/src/instructions/resolver.ts`; workflow saves `InstructionSet` | No registry management UI/API yet. |
| Mock branch creation | implemented | `GitProvider.createBranch` in `packages/adapters/src/interfaces.ts`; `MockGitProvider.createBranch`; workflow calls `gitProvider.createBranch` | No real branch creation by design. |
| Mock agent execution | implemented | `MockAgentRunner.run` in `packages/runner/src/mock-agent-runner.ts` | Deterministic prompt-keyword behavior only. |
| Deterministic diff summary | implemented | `MockAgentRunner.run` returns fixed changed files and diff summary | File patterns are intentionally limited. |
| Mock test result | implemented | `MockTestRunner.run` in `packages/runner/src/test-runner.ts` | Simulated tests only. |
| Mock PR creation | implemented | `MockGitProvider.createDraftPullRequest` returns `mock://pull-requests/...`; workflow stores via `store.createPullRequest` | Safe mock URL. |
| Usage ledger entry | implemented | `MockUsageLedger.record` in `packages/db/src/usage-ledger.ts`; workflow records `agentRun.usage` | In-memory only. |
| Usage ledger attribution to `taskId` and `taskRunId` | implemented | `MockLlmGateway.complete` fills `taskId` and `taskRunId`; tested in `usage ledger attributes model, skill, harness, task, and run` | None for current milestone. |
| Dashboard visibility for task state | implemented | `apps/web/src/render.ts` and `apps/web/app/page.tsx` render task status | Dashboard uses seeded mock data, not API data. |
| Dashboard visibility for selected model, skill, harness, instruction, mock PR, cost, and diff summary | partially_implemented | `apps/web/src/render.ts` shows selected agent/model, mock PR, cost, changed files, and diff summary; registry side panel lists skills, harnesses, and instructions | Selected skill, selected harness, and assembled instruction set are not shown per task/run in the dashboard. This should be improved in Phase 3. |
| Tests for task workflow success | implemented | `mock workflow completes the first MVP vertical slice` in `tests/mock-workflow-vertical-slice.test.ts`; API vertical slice test in `tests/api-health.test.ts` | None. |
| Tests for policy denial | implemented | `mock workflow blocks policy-denied tasks before provider behavior` in `tests/mock-workflow-vertical-slice.test.ts` | None. |
| Tests for usage ledger attribution | implemented | `usage ledger attributes model, skill, harness, task, and run` in `tests/mock-workflow-vertical-slice.test.ts` | None. |
| No real external provider calls | implemented | Mock-only search found no real provider SDK or external network calls; runtime providers are mocks | Local test HTTP server use is safe. |

Phase 1 classification: `complete_for_current_milestone`.

Rationale: the mock MVP vertical slice is implemented, validation passes, behavior tests cover the main flow and risk branches, and no critical architecture blockers were found. Phase 1 is not production-ready because persistence, auth/security hardening, deployment, real providers, and operational controls are intentionally deferred.

## 3. Phase 2 Completion Audit

### Phase 2 v0 Capabilities

| Required v0 capability | Status | Evidence | Concerns |
|---|---|---|---|
| BranchLease domain model | implemented | `BranchLease` in `packages/core/src/domain/models.ts` | Transitions are ad hoc through store methods. |
| ConflictRisk domain model | implemented | `ConflictRisk` in `packages/core/src/domain/models.ts` | Derived object, not persisted. This is acceptable for MVP. |
| MergeQueueEntry domain model | implemented | `MergeQueueEntry` in `packages/core/src/domain/models.ts` | Queue history is not modeled yet. |
| Active branch or lease tracking | implemented | `createBranchLease`, `listActiveBranchLeases`, `listBranchLeasesByTaskRun` in `packages/db/src/repository.ts`; workflow creates leases | Lease expiration is not implemented. |
| File overlap risk scoring | implemented | `computePairRiskScore` in `packages/core/src/conflicts/scoring.ts` | Path-based only. |
| Deterministic risk score calculation | implemented | `classifyConflictFile`, `conflictRiskLevel`, `createConflictRisk` in `packages/core/src/conflicts/scoring.ts`; pair-order test exists | None for current milestone. |
| Mock merge queue skeleton | implemented | `createMergeQueueEntry`, `refreshMergeQueueEntryRisk`, `markMergeQueueEntryMerged`, `cancelMergeQueueEntry` in `packages/db/src/repository.ts` | No status history/audit event for queue changes yet. |
| Conflict risk API visibility | implemented | `GET /conflicts/risks` in `apps/api/src/main.ts` | Returns domain object directly. |
| Merge queue API visibility | implemented | `GET /merge-queue`, `POST /merge-queue/:id/mark-merged`, `POST /merge-queue/:id/cancel` in `apps/api/src/main.ts` | Stable response DTOs deferred. |
| Dashboard visibility for branch lease, conflict risk, and merge queue state | implemented | `apps/web/src/render.ts` sections `Active Leases`, `Conflict Risks`, and `Merge Queue`; `apps/web/app/page.tsx` conflict manager summary | Dashboard uses seeded data rather than API. |
| Tests for conflict risk scoring | implemented | `tests/conflict-risk-scoring.test.ts` | None. |
| Tests for merge queue behavior | implemented | `mock workflow blocks merge queue entry for high-risk active overlap` and `marking merge queue entry as merged releases the branch lease` in `tests/mock-workflow-vertical-slice.test.ts` | Add queue history tests when history exists. |
| Documentation for Conflict Manager v0 | implemented | `docs/features/conflict-manager/v0.md` | None. |

### Phase 2 v1 Capabilities

| Required v1 capability | Status | Evidence | Concerns |
|---|---|---|---|
| MergeSimulator interface | implemented | `MergeSimulator` in `packages/core/src/conflicts/interfaces.ts` | None. |
| MockMergeSimulator | implemented | `MockMergeSimulator` in `packages/adapters/src/git/merge-simulators.ts` | Default deterministic behavior is simple. |
| LocalGitDryRunMergeSimulator or equivalent | implemented | `LocalGitDryRunMergeSimulator` in `packages/adapters/src/git/merge-simulators.ts` | Depends on local `git` binary. |
| Local-only git dry-run merge simulation | implemented | `LocalGitDryRunMergeSimulator.simulate` uses `git -C <repoPath> merge-tree --write-tree` | No fetch/push/remote operations found. |
| Clean merge vs text conflict vs failed vs unavailable result | implemented | `MergeSimulationStatus` in `packages/core/src/domain/models.ts`; status handling in `LocalGitDryRunMergeSimulator.simulate` and `MockMergeSimulator.simulate` | Local failed path is covered by code, but not deeply tested beyond unavailable. |
| Conflicting file extraction, where possible | implemented | `parseConflictFiles` in `packages/adapters/src/git/merge-simulators.ts`; text conflict test asserts `src/auth/session.ts` | Extraction is dependent on `git merge-tree` output shape. |
| Simulation result connected to ConflictRisk | implemented | `createConflictRisk(..., simulation)` in `packages/core/src/conflicts/scoring.ts`; store passes latest simulation in `computeRepoConflictRisks` and `computeConflictRisksForLease` | Pairwise simulation association uses latest simulation for either lease, which is adequate for v1 but may need richer modeling later. |
| Simulation result connected to MergeQueueEntry | implemented | `mergeQueueFieldsForLease`, `recordMergeSimulation`, and `refreshMergeQueueEntriesForLease` in `packages/db/src/repository.ts` | No queue status history yet. |
| Merge queue recommendation based on risk and simulation result | implemented | `mergeQueueDecision` in `packages/core/src/conflicts/scoring.ts`; queue fields include `recommendation` and `blockingReasons` | Rebase-needed is a future signal, not yet implemented. |
| API endpoint or API visibility for merge simulation results | implemented | `GET /merge-simulations` and `POST /merge-simulations` in `apps/api/src/main.ts` | Endpoint runs command synchronously; acceptable for MVP. |
| Dashboard visibility for dry-run simulation status | implemented | `Dry-run Merge Simulations` section in `apps/web/src/render.ts`; `Dry-run simulations` summary in `apps/web/app/page.tsx` | Dashboard uses seeded local data. |
| Tests for clean local simulation | implemented | `LocalGitDryRunMergeSimulator returns clean for a non-conflicting temp repo merge` in `tests/merge-simulators.test.ts` | None. |
| Tests for text conflict local simulation | implemented | `LocalGitDryRunMergeSimulator returns text_conflict without mutating the temp repo` in `tests/merge-simulators.test.ts` | None. |
| Tests proving the local simulator does not mutate the original working tree | implemented | Same local clean/text conflict tests compare branch and `git status --short` before/after | None. |
| No remote fetch | implemented | Search found no `git fetch` or `["fetch"` command construction | None. |
| No remote push | implemented | Search found no `git push` or `["push"` command construction | None. |
| No real GitHub, GitLab, or Bitbucket API calls | implemented | Search found provider names only in docs/types/seed metadata/mock path rules | None. |

Phase 2 classification: `complete_for_current_milestone`.

Rationale: Phase 2 v0 is implemented; Phase 2 v1 local-only dry-run simulation is implemented and tested; validation passes; no critical architecture blockers remain. Phase 2 is not production-ready because real provider-backed PR workflows, safe real merge/rebase automation, human escalation workflow, and advanced semantic/symbol/test impact conflict signals are not implemented.

## 4. Architecture Boundary Audit

| Boundary | Result | Evidence | Recommended fix |
|---|---|---|---|
| API handlers do not contain excessive orchestration logic | pass | `POST /tasks/:id/run` in `apps/api/src/main.ts` delegates to `runAgentTaskWorkflow`; API mostly performs request parsing and response formatting | Keep future long-running operations out of route handlers. |
| Worker or workflow layer owns execution flow | pass | `runAgentTaskWorkflow` owns policy, model, skill, harness, instruction, branch, agent run, tests, simulation, PR, usage, lease, and queue flow | Split workflow into smaller activities only when complexity requires it. |
| Core domain models are provider-agnostic | pass | `packages/core/src/domain/models.ts` has enums and pure domain types only; no provider SDK imports | Keep concrete provider code out of `packages/core`. |
| Git behavior is abstracted behind interfaces | pass | `GitProvider` in `packages/adapters/src/interfaces.ts`; `MockGitProvider` in `packages/adapters/src/git/mock-git-provider.ts` | Legacy `GitProvider.simulateMerge` remains but workflow uses `MergeSimulator`; remove legacy method when no longer needed. |
| LLM provider behavior is abstracted behind interfaces | pass | `LlmGateway` in `packages/adapters/src/interfaces.ts`; `MockLlmGateway` in `packages/adapters/src/llm/mock-llm-gateway.ts`; `MockModelRouter` in `packages/llm-gateway/src/model-router.ts` | Add real providers only behind explicit environment gates. |
| Merge simulation behavior is abstracted behind interfaces | pass | `MergeSimulator` in `packages/core/src/conflicts/interfaces.ts`; mock/local implementations in adapter package | Keep local simulator local-only. |
| Mock adapters are the default for MVP | pass | Workflow defaults to `MockGitProvider`, `MockLlmGateway`, `MockModelRouter`, `MockPolicyEngine`, `MockAgentRunner`, `MockTestRunner`, `MockUsageLedger`, `MockMergeSimulator` | None. |
| Usage ledger is attributed to `taskId` and `taskRunId` | pass | `MockLlmGateway.complete` sets both fields; workflow records usage; tests assert attribution | None. |
| Skill, Harness, and InstructionArtifact remain separate concepts | pass | Separate types in `packages/core/src/domain/models.ts`; separate seed arrays; separation test exists | Phase 3 should preserve this split when adding CRUD/APIs. |
| Dashboard consumes API data rather than duplicating domain logic | warning | `apps/web/lib/mock-data.ts` and `apps/web/src/render.ts` create a seeded store and run workflows directly | Introduce API client/read-model use in Phase 3 dashboard work. |
| Tests verify behavior, not only snapshots | pass | Tests assert workflow outcomes, API responses, state transitions, risk scores, simulator safety, queue behavior, usage attribution, and dashboard assumptions | Add registry behavior tests in Phase 3. |
| No real external network calls are required for tests | pass | Tests use local `127.0.0.1` HTTP servers and temporary local Git repos only | None. |

## 5. State Machine Audit

Current Task states from `packages/core/src/domain/status.ts`:

```text
draft
planned
policy_blocked
queued
branch_created
running
testing
pr_draft_ready
pr_opened
ci_pending
ci_failed
conflict_detected
conflict_fixing
review_required
merge_ready
merged
completed
failed
cancelled
```

Current TaskRun states:

```text
queued
running
succeeded
failed
cancelled
```

Current BranchLease states:

```text
active
released
expired
```

Current MergeQueueEntry states:

```text
queued
ready
blocked
merged
cancelled
```

Findings:

- Task transitions are explicit through `taskTransitions`, `canTransitionTaskStatus`, and `assertTaskStatusTransition` in `packages/core/src/domain/status.ts`.
- Illegal Task transitions are prevented by `InMemoryAichestraStore.transitionTask`.
- TaskRun transitions are ad hoc through `updateTaskRun`; they are typed but not state-machine-enforced.
- BranchLease transitions are ad hoc through `updateBranchLease` and `releaseBranchLease`; `expired` exists but no expiration workflow is implemented.
- ConflictRisk has no mutable lifecycle; it is derived deterministically by `createConflictRisk`.
- MergeQueueEntry state changes are controlled through store methods for creation, refresh, mark merged, and cancel, but there is no explicit transition table.
- Repeated `POST /tasks/:id/run` behavior is defined: `findActiveTaskRun` blocks `queued` or `running` TaskRuns with `ConflictError`, and the API returns `409 Conflict`.
- Completed and failed tasks can transition back to `queued`, allowing a new TaskRun attempt.
- Duplicate active runs are prevented by workflow logic and covered by API/workflow tests.
- Completed, failed, policy-blocked, blocked/review, and conflict states are distinct:
  - `completed`
  - `failed`
  - `policy_blocked`
  - merge queue `blocked` plus Task `review_required`
  - `conflict_detected`
- Merge queue recommendation is deterministic through `mergeQueueDecision` in `packages/core/src/conflicts/scoring.ts`.

Recommended policy:

- Keep the current repeated-run policy.
- Add explicit TaskRun, BranchLease, and MergeQueueEntry transition helpers before introducing async workers, retries, or real provider integrations.

## 6. Mock-Only and Local-Only Compliance

Searches run:

```bash
rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|github|gitlab|bedrock|gemini|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|git fetch|git push" .
rg -n "execFile|spawn\\(|merge-tree|git fetch|git push|https\\.request|http\\.request|Octokit|OpenAI\\(|Anthropic\\(" apps packages tests scripts docs
rg -n "fetch\\(" apps packages tests scripts docs
rg -n -F '["fetch"' apps packages tests scripts
rg -n -F '["push"' apps packages tests scripts
```

Classification:

- Safe documentation references: provider names and future integration examples in `AICHESTRA_BOOTSTRAP.md`, `AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md`, `README.md`, `docs/foundations/security-model.md`, `docs/audits/2026-05-11-phase-progress-audit.md`, `docs/audits/2026-05-11-phase-2-completion-gap.md`, `docs/features/conflict-manager/v1.md`.
- Safe mock references: `.github/workflows/` risk-path strings in `packages/adapters/src/policy/mock-policy-engine.ts` and `packages/core/src/conflicts/scoring.ts`.
- Safe type/interface references: `ProviderKind`, `RepoProvider`, `AgentKind`, `InstructionArtifact` in `packages/core/src/domain/models.ts`; seed metadata such as `claude-code` and `github_pr_write` in `packages/core/src/registries/seed-data.ts`.
- Safe local-only git usage: `LocalGitDryRunMergeSimulator` uses local `git -C <repoPath> rev-parse`, `diff`, and `merge-tree --write-tree`; tests create temporary local repositories with `git init`, `checkout`, `add`, and `commit`.
- Suspicious real integration code: none found.
- Actual external calls: none found.

Compliance result:

- Mock-first MVP rule: pass.
- No real LLM provider calls: pass.
- No real remote Git provider calls: pass.
- No real GitHub/GitLab/Bitbucket API calls: pass.
- No real MCP calls: pass.
- No real Vault/Kubernetes/Temporal integration: pass.
- No remote `git fetch` or `git push`: pass.

## 7. Validation Commands

Package manager detected: `pnpm`, documented in `README.md`, `AGENTS.md`, and `package.json`.

| Command | Result | Relevant output summary | Failures / likely causes |
|---|---|---|---|
| `pnpm install` | pass | Lockfile was up to date; all 15 workspace projects already up to date; completed with pnpm v10.33.0 | None. |
| `pnpm lint` | pass | `node scripts/lint.mjs`; output `lint passed` | None. |
| `pnpm typecheck` | pass | `tsc --noEmit -p tsconfig.typecheck.json`; no errors | None. |
| `pnpm test` | pass | `node scripts/run-tests.mjs`; 40 tests passed, 0 failed | None. |
| `pnpm build` | pass | `node scripts/build.mjs`; output `build passed` | None. |

## 8. Test Coverage Audit

### Phase 1 Tests

| Area | Covered | Evidence | Missing / recommendation |
|---|---|---|---|
| Task creation | yes | `API creates and runs a task through the mock vertical slice` in `tests/api-health.test.ts` | Add schema error tests later. |
| Task run endpoint | yes | Same API test covers `POST /tasks/:id/run`; active-run `409` test covers repeated-run conflict | None. |
| Mock workflow success | yes | `mock workflow completes the first MVP vertical slice` in `tests/mock-workflow-vertical-slice.test.ts` | None. |
| Policy denial | yes | `mock workflow blocks policy-denied tasks before provider behavior` | None. |
| Usage ledger attribution | yes | `usage ledger attributes model, skill, harness, task, and run` | None. |
| Skill / Harness / Instruction separation | yes | `Skill, Harness, and Instruction records stay separate` | Expand in Phase 3 CRUD/version pinning tests. |
| Task state transitions | yes | `tests/task-state-machine.test.ts` | Add TaskRun transition tests if TaskRun transition helpers are added. |
| Repeated task run behavior | yes | Workflow tests allow completed/failed rerun and reject active run; API test returns `409` | None. |

### Phase 2 Tests

| Area | Covered | Evidence | Missing / recommendation |
|---|---|---|---|
| BranchLease creation or tracking | yes | Workflow test asserts active lease; API test lists active leases | Add expiration tests when expiration exists. |
| File overlap risk scoring | yes | `tests/conflict-risk-scoring.test.ts` covers no/docs/test/source/package/critical/same-directory cases | None. |
| ConflictRisk calculation | yes | `createConflictRisk` tests include pair-order stability and simulation combination | None. |
| MergeQueueEntry behavior | yes | Workflow tests assert ready/blocked entries and merge releases lease | Add queue status history tests later. |
| Mock merge queue behavior | yes | High-risk overlap and mark-merged tests | None. |
| MergeSimulator interface | yes | `MergeSimulator interface supports deterministic mock clean result` | None. |
| MockMergeSimulator clean result | yes | `MockMergeSimulator` clean test | None. |
| MockMergeSimulator conflict result | yes | Conflict/failed/unavailable mock simulator test | None. |
| LocalGitDryRunMergeSimulator clean merge | yes | Temp repo clean merge test | None. |
| LocalGitDryRunMergeSimulator text conflict | yes | Temp repo text conflict test | None. |
| Original working tree not mutated by local simulation | yes | Local simulator tests compare branch and `git status --short` before/after | None. |
| API visibility for conflict risk | yes | API test calls `/conflicts/risks`, `/merge-queue`, and `/merge-simulations` | None. |
| Dashboard assumptions for conflict state | yes | `tests/dashboard-data.test.ts` checks leases, risks, queue, simulations, and rendered text | Later replace seeded dashboard data with API-backed read model tests. |

## 9. Blockers Before Phase 3

### Critical Blockers

None.

The following critical-blocker checks passed:

- Validation commands pass.
- No real external API calls are present.
- Usage ledger entries include `taskRunId`.
- Skill, Harness, and InstructionArtifact are separate concepts.
- API layer does not own the main orchestration workflow.
- Phase 1 vertical slice tests exist.
- Phase 2 conflict risk tests exist.
- Phase 2 is implemented in code, not only documented.
- Local dry-run merge simulation tests prove no original working tree mutation.
- No remote git operations were introduced.

### Important Follow-Ups

- Dashboard still creates seeded demo data and runs workflows directly instead of consuming API/read-model data.
- Dashboard does not yet show selected skill, selected harness, and assembled instruction set per task/run with the same clarity as model, PR, cost, and diff summary.
- TaskRun, BranchLease, and MergeQueueEntry transitions are not enforced by explicit transition tables.
- Phase 3 registry behavior is only seed/helper-level; CRUD, version pinning, registry APIs, and registry dashboard are missing.
- Persistence remains in-memory; Prisma schema is a draft and migrations are placeholders.
- API responses currently return domain-shaped objects rather than stable DTOs.
- `GitProvider.simulateMerge` remains as a legacy mock method even though workflow now uses `MergeSimulator`.

### Nice-To-Have Improvements

- Add OpenAPI or route documentation for task/conflict/simulation endpoints.
- Add branch lease expiration behavior.
- Add audit events for merge queue mark-merged/cancel operations.
- Add queue status history.
- Add local failed-simulation tests involving existing queue entries.

## 10. Recommendation

Recommendation: Safe to proceed to Phase 3 Registry v0.

Reasoning:

- Phase 1 is complete enough for the current milestone: the mock MVP vertical slice is implemented, validated, tested, and mock-only.
- Phase 2 is complete enough for the current milestone: v0 conflict manager and v1 local dry-run simulation are implemented, validated, tested, and mock/local-only.
- The remaining issues are important follow-ups, not blockers to beginning Phase 3.

Exact next task:

```text
Phase 3 Registry v0:
- Skill Registry
- Harness Registry
- Instruction Registry
- version pinning
- registry APIs
- registry-backed task selection
- registry dashboard
- tests
- no real artifact registry
- no real external integrations
```

## Final Summary

Current phase status:
- Phase 1: complete_for_current_milestone
- Phase 2: complete_for_current_milestone
- Phase 3: partially_implemented
- Phase 4: planned_only
- Phase 5: planned_only

Phase 1 readiness for Phase 3:
- ready
- reason: The mock MVP vertical slice is implemented, validated, tested, and has no critical architecture blockers.

Phase 2 readiness for Phase 3:
- ready
- reason: Conflict Manager v0 and v1 local-only dry-run simulation are implemented, validated, tested, and no remote provider or git operations were introduced.

Validation:
- install: pass
- lint: pass
- typecheck: pass
- test: pass
- build: pass

Blockers:
- critical: none
- important: dashboard should move to API/read-model data; per-task registry selection visibility should improve; TaskRun/BranchLease/MergeQueueEntry transitions should become explicit; persistence and stable DTOs remain deferred
- nice_to_have: OpenAPI docs, branch lease expiration, merge queue audit events, queue status history, additional failed-simulation queue tests

Recommendation:
Safe to proceed to Phase 3 Registry v0.

Next recommended Codex task:
Phase 3 Registry v0: implement Skill, Harness, and Instruction registries with version pinning, registry APIs, registry-backed task selection, registry dashboard visibility, and tests, with no real artifact registry or external integrations.
