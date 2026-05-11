# Phase Progress Audit

## Scope

This audit reflects the current repository state after Phase 3 Packaging & Versioning v3.

Guidance and evidence reviewed:

- `AGENTS.md`
- `README.md`
- `AICHESTRA_BOOTSTRAP.md`
- `AICHESTRA_CODEX_NEXT_STEPS.md`
- `AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md`
- `docs/bootstrap-gap-report.md`
- `docs/phase-2-completion-gap.md`
- `docs/conflict-manager-v0.md`
- `docs/conflict-manager-v1.md`
- `docs/phase-3-registry-v0.md`
- `docs/phase-3-registry-hardening-v1.md`
- `docs/phase-3-operational-hardening-v2.md`
- `docs/phase-3-packaging-versioning-v3.md`
- `docs/phase-3-completion-gap.md`
- implementation under `apps/`, `packages/`, `tests/`, `scripts/`, and `docs/`

## 1. Phase Mapping

| Phase | Status | Rationale |
|---|---|---|
| Phase 1: LLM and cost management foundation, task orchestration, mock or real Git workflow, usage ledger, API, worker, dashboard | `complete_for_current_milestone` | The mock MVP vertical slice is implemented, validated, tested, and still mock-only. Task orchestration exists in `apps/worker/src/workflows/run-agent-task-workflow.ts`; API task creation/run endpoints exist in `apps/api/src/main.ts`; mock LLM/model routing, mock Git PR/branch behavior, usage ledger, worker, and web dashboard are implemented. This is not production-ready. |
| Phase 2: Branch conflict manager, active branch or lease graph, conflict risk scoring, merge queue, conflict visibility | `complete_for_current_milestone` | v0 concepts exist (`BranchLease`, `ConflictRisk`, `MergeQueueEntry`) and v1 adds `MergeSimulationResult`, `MergeSimulator`, `MockMergeSimulator`, `LocalGitDryRunMergeSimulator`, simulation-aware risk and queue fields, API visibility, dashboard visibility, and tests. This is not full Phase 2 completion because semantic/symbol/test impact signals, rebase-needed detection, resolver handoff, human escalation workflow, and provider-backed merge automation remain future work. |
| Phase 3: Skill Registry, Harness Registry, Instruction Registry, version pinning, separation of Skill / Harness / InstructionArtifact | `v3_implemented` | Separate domain concepts, seed registries, exact and simple semver range refs, repository interfaces, in-memory and file-backed repositories, stable DTOs, registry APIs, registry-backed workflow selection, TaskRun-selected refs, audit logs, approval/eval gates, local checksum verification, append-only history, rollback, approval queue read models, local eval result attachment, mock mutation RBAC, local package manifests, local import/export, package diffs, dashboard visibility, and tests exist. Signed artifacts, full approval workflow, eval execution, full package management, real auth/RBAC, and real artifact registry integration remain future work. |
| Phase 4: Auto-improvement loop, trace clustering, LLM-based Skill or Harness patch proposals, eval, canary rollout | `planned_only` | Roadmap and metadata references exist, such as `evalStatus` and docs mentioning canary rollout, but no auto-improvement loop, trace clustering, proposal generation, eval execution, or canary rollout code exists. |
| Phase 5: Enterprise features such as SCIM, audit export, policy-as-code, private deployment, data residency, advanced security | `planned_only` | Security and roadmap docs mention enterprise concerns, but there is no SCIM, audit export, policy-as-code engine, private deployment workflow, data residency control, or advanced enterprise security implementation. |

## 2. MVP Vertical Slice Validation

| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Task creation | yes | `InMemoryAichestraStore.createTask` in `packages/db/src/repository.ts`; `POST /tasks` in `apps/api/src/main.ts` | In-memory only. |
| Task run trigger | yes | `POST /tasks/:id/run` delegates to `runAgentTaskWorkflow` in `apps/api/src/main.ts` | Synchronous trigger only; no queue/process separation yet. |
| Mock policy check | yes | `MockPolicyEngine` in `packages/adapters/src/policy/mock-policy-engine.ts`; used by workflow via `policyEngine.evaluateTask` | Policy model is intentionally simple. |
| Mock model selection | yes | `MockModelRouter` in `packages/llm-gateway/src/model-router.ts`; workflow calls `modelRouter.selectModel` | No budget-aware routing beyond mock behavior. |
| Mock skill selection | yes | Workflow calls `resolveRegistryContextForTask` and stores `selectedSkillRefs` on `TaskRun`; resolver supports exact and simple semver range requests | Semver support is intentionally v0, not a full package manager. |
| Mock harness selection | yes | Workflow calls `resolveRegistryContextForTask` and stores `selectedHarnessRef` on `TaskRun` | No harness YAML parser or runtime execution. |
| Mock instruction set selection | yes | Registry resolver selects instruction refs; `assembleInstructionSet` assembles selected artifacts | Checksums are recorded but not enforced against file content. |
| Mock branch creation | yes | `GitProvider.createBranch` interface and `MockGitProvider.createBranch`; workflow calls `gitProvider.createBranch` | No real worktree/branch creation by design. |
| Mock agent execution | yes | `MockAgentRunner.run` in `packages/runner/src/mock-agent-runner.ts`; workflow calls `agentRunner.run` | Deterministic but prompt-keyword based. |
| Deterministic diff summary | yes | `MockAgentRunner` returns fixed changed files and diff summary based on prompt keywords | Limited file pattern coverage. |
| Mock test pass | yes | `MockTestRunner.run` in `packages/runner/src/test-runner.ts` | Simulated tests only. |
| Mock/local dry-run merge simulation | yes | `MergeSimulator` in `packages/core/src/conflicts/interfaces.ts`; `MockMergeSimulator` and `LocalGitDryRunMergeSimulator` in `packages/adapters/src/git/merge-simulators.ts`; workflow records simulation through `store.recordMergeSimulation` | Local simulator is dry-run only and does not fetch, push, or mutate the working branch. |
| Mock PR creation | yes | `MockGitProvider.createDraftPullRequest`; workflow stores pull request | Uses `mock://` URL, safe. |
| Usage ledger entry | yes | `MockUsageLedger.record`; `MockLlmGateway.complete` includes `taskId`, `taskRunId`, provider/model, token/cost metadata | Good attribution for MVP. |
| Completed task state | yes | Workflow transitions through `pr_draft_ready` to `completed` when not blocked | High-risk conflict paths can end in `review_required`, which is expected. |
| Dashboard visibility | yes | `apps/web/src/render.ts` shows task status, mock PR, cost, changed files, diff, active leases, risks, dry-run simulations, and merge queue recommendations | Warning: dashboard builds its own seeded data and runs workflows instead of consuming API data. |

## 3. Architecture Boundary Audit

| Item | Result | Evidence | Recommended Fix |
|---|---|---|---|
| API handlers should not contain excessive orchestration logic | pass | `apps/api/src/main.ts` routes `POST /tasks/:id/run` to `runAgentTaskWorkflow` rather than directly running policy/model/Git/agent logic | Keep API as trigger/read layer when adding async queues. |
| Worker or workflow layer should own execution flow | pass | `runAgentTaskWorkflow` owns policy, model/skill/harness/instruction selection, branch, agent, tests, PR, usage, leases, and merge queue flow | Later split into smaller workflow activities if complexity grows. |
| Core domain models should stay provider-agnostic | pass | Core types include provider enums, but no SDK or runtime provider calls; no framework imports in core domain | Keep concrete providers in adapters only. |
| Mock adapters should sit behind interfaces | pass | Interfaces in `packages/adapters/src/interfaces.ts`; mocks implement LLM, Git, policy, MCP, secrets, runner, usage ledger | `packages/adapters` is still an aggregate package; split ownership can be tightened later. |
| Git provider behavior should be abstracted | pass | `GitProvider` interface and `MockGitProvider` exist; merge simulation uses `MergeSimulator` with mock/local implementations behind interfaces | Add real provider only behind explicit interfaces and environment gates. |
| LLM provider behavior should be abstracted | pass | `LlmGateway` interface and `MockLlmGateway`; `ModelRouter` abstraction exists | Budget-aware routing can be added in the gateway/router layer. |
| Usage ledger should be attributed to taskId and taskRunId | pass | `MockLlmGateway.complete` fills `taskId` and `taskRunId`; tests assert attribution in `tests/mock-workflow-vertical-slice.test.ts` | None for MVP. |
| Skill, Harness, and InstructionArtifact should remain separate concepts | pass | Separate domain types, separate registry APIs, separate seed arrays, service methods, DTOs, and registry tests in `tests/registry-v0.test.ts` and `tests/registry-hardening-v1.test.ts` | Keep future artifact packaging separate for each concept. |
| Dashboard should consume API data rather than duplicating domain logic | warning | `apps/web/lib/mock-data.ts` and `apps/web/src/render.ts` create a local store and run workflows directly | Introduce an API client/read model for dashboard data; keep deterministic fixtures only for tests or demos. |
| Tests should verify behavior, not only snapshots | pass | Tests cover API behavior, workflow outcomes, conflict scoring, merge simulation, usage attribution, state transitions, dashboard assumptions, and merge queue release behavior | Add richer API DTO tests when read models are introduced. |

## 4. State Machine Audit

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

Findings:

- Task transitions are explicit in `taskTransitions` and enforced by `assertTaskStatusTransition`.
- Illegal Task transitions are prevented through `InMemoryAichestraStore.transitionTask`.
- TaskRun states are typed, but TaskRun transitions are not enforced by a dedicated transition function. Updates are currently ad hoc through `updateTaskRun`.
- Repeated `POST /tasks/:id/run` behavior is defined and documented.
- Active duplicate runs are prevented by `findActiveTaskRun`, which blocks `queued` or `running` runs with `ConflictError`; API maps this to `409 Conflict`.
- Completed and failed tasks may return to `queued` to create a new TaskRun attempt.
- `failed`, `policy_blocked`, and `completed` are distinct Task states.

Recommended policy:

- Keep current repeated-run policy.
- Add explicit TaskRun transition validation before introducing async workers or retries.

## 5. Mock-Only Compliance

Search command run:

```bash
rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|github|gitlab|bedrock|gemini|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN" .
```

Additional targeted searches:

```bash
rg -n "fetch" .
rg -n "axios|Octokit|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN" .
rg -n "new Anthropic|OpenAI\\(|https\\.request|http\\.request\\(" apps packages tests scripts
```

Classification:

- Safe documentation references: `AICHESTRA_BOOTSTRAP.md`, `AICHESTRA_CODEX_NEXT_STEPS.md`, `AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md`, `README.md`, `docs/security-model.md`, `docs/bootstrap-gap-report.md`.
- Safe mock references: `packages/adapters/src/policy/mock-policy-engine.ts` uses `.github/workflows/` as a risk path; `packages/core/src/conflicts/scoring.ts` classifies CI workflow paths.
- Safe type/interface references: `ProviderKind`, `RepoProvider`, `AgentKind`, `InstructionArtifact` names in `packages/core/src/domain/models.ts`; seed data references `claude-code` and `github_pr_write` as metadata.
- Safe local process usage: `LocalGitDryRunMergeSimulator` runs local `git -C <repoPath> diff`, `git rev-parse`, and `git merge-tree --write-tree` only. It does not fetch, push, call remotes, or mutate the current branch.
- Suspicious real integration code: none found.
- Actual external calls: none found. `scripts/lint.mjs` contains a regex that detects direct external HTTP calls. `tests/api-health.test.ts` uses `http.request` only against local test servers.

Conclusion: the repository complies with the mock-only MVP rule.

## 6. Validation Commands

| Command | Result | Output Summary |
|---|---|---|
| `pnpm install` | pass | Workspace already up to date; no packages downloaded. |
| `pnpm lint` | pass | `node scripts/lint.mjs`; output: `lint passed`. |
| `pnpm typecheck` | pass | `tsc --noEmit -p tsconfig.typecheck.json`; no errors. |
| `pnpm test` | pass | `node scripts/run-tests.mjs`; 68 tests passed, 0 failed. |
| `pnpm build` | pass | `node scripts/build.mjs`; output: `build passed`. |

## 7. Test Coverage Audit

| Area | Covered | Evidence | Recommendation |
|---|---|---|---|
| API run endpoint | yes | `tests/api-health.test.ts` covers `/tasks/:id/run` success and `409` active-run conflict | Keep adding API tests as endpoints move to async behavior. |
| Mock workflow success | yes | `tests/mock-workflow-vertical-slice.test.ts` verifies completed task, TaskRun, changed files, PR, lease, queue entry | None. |
| Policy denial | yes | `mock workflow blocks policy-denied tasks before provider behavior` | None. |
| Usage ledger attribution | yes | `usage ledger attributes model, skill, harness, task, and run` | Add aggregate cost tests later. |
| Skill / Harness / Instruction separation | yes | `Skill, Harness, and Instruction records stay separate`; `tests/registry-v0.test.ts` | None for v0. |
| Task state transitions | yes | `tests/task-state-machine.test.ts` | Add TaskRun transition tests after introducing TaskRun transition enforcement. |
| Repeated task run behavior | yes | Workflow tests for completed/failed rerun and active-run rejection; API `409` test | None. |
| Dashboard data assumptions | yes | `tests/dashboard-data.test.ts` asserts active leases, conflict risks, merge queue entries, merge simulations, and rendered dry-run text | Move dashboard demo data behind an API client/read model later. |

## 8. Current Blockers

### Critical Blockers

None found.

### Important Follow-Ups

- Dashboard currently creates its own seeded store and runs workflows directly instead of consuming API/read-model data.
- TaskRun transitions are typed but not enforced by an explicit state transition function.
- Persistence remains in-memory; Prisma schema is a draft and migrations are placeholders.
- Phase 3 registries now have repository boundaries and local file-backed persistence, but production database persistence remains future work.
- Approval/eval status gates are implemented, but full approval workflow and eval suite execution remain future work.
- Signed artifacts, full dependency solving, real mutation auth/RBAC, and policy-as-code enforcement remain future work.
- `packages/adapters` remains a compatibility aggregate while split packages re-export behavior; ownership can be tightened before real integrations.
- Phase 2 still lacks rebase-needed detection, semantic/symbol/test impact signals, resolver handoff, and human escalation workflow.

### Nice-To-Have Improvements

- Add OpenAPI or route documentation for conflict endpoints.
- Add dashboard render tests.
- Add branch lease expiration behavior tests.
- Add explicit audit events for merge queue mark-merged/cancel.
- Add stable API response DTOs instead of returning in-memory domain objects directly.

## 9. Recommendation

Recommendation: safe to merge the current MVP vertical slice, Conflict Manager v1 baseline, and Phase 3 Packaging & Versioning v3.

The repository has moved beyond the v0 baseline. Conflict Manager v1 is implemented with mock/local-only merge simulation, and it should not be interpreted as full Phase 2 completion.

Exact next task:

```text
Work Order 3: Phase 4 Preparation.

The next task should prepare trace and eval foundations for future auto-improvement while keeping provider network calls, real artifact registry integration, and automatic registry mutation out of scope.
```

## Final Summary

Current phase status:

- Phase 1: `complete_for_current_milestone`
- Phase 2: `complete_for_current_milestone`
- Phase 3: `v3_implemented`
- Phase 4: `planned_only`
- Phase 5: `planned_only`

Validation:

- install: pass
- lint: pass
- typecheck: pass
- test: pass
- build: pass

Merge recommendation:

Safe to merge the current MVP vertical slice, Conflict Manager v1 baseline, and Phase 3 Packaging & Versioning v3. No critical blockers were found.

Next recommended Codex task:

Work Order 3: Phase 4 Preparation. Prepare trace/eval foundations and auto-improvement guardrails, with no real provider calls and no automatic registry mutation.
