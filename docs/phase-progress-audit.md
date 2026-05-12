# Phase Progress Audit

## Scope

This audit reflects the current repository state after Secrets and Sandbox Design v0.

Guidance and evidence reviewed:

- `AGENTS.md`
- `README.md`
- `design_docs/AICHESTRA_BOOTSTRAP.md`
- `AICHESTRA_CODEX_PHASE3_TO_PHASE4_WORK_ORDERS.md`
- `docs/bootstrap-gap-report.md`
- `docs/phase-2-completion-gap.md`
- `docs/conflict-manager-v0.md`
- `docs/conflict-manager-v1.md`
- `docs/phase-3-registry-v0.md`
- `docs/phase-3-registry-hardening-v1.md`
- `docs/phase-3-operational-hardening-v2.md`
- `docs/phase-3-packaging-versioning-v3.md`
- `docs/phase-3-completion-gap.md`
- `docs/phase-4-preparation-plan.md`
- `docs/phase-4-preparation.md`
- `docs/phase-4-auto-improvement-v0-plan.md`
- `docs/phase-4-auto-improvement-v0.md`
- `docs/phase-4-governance-v1-plan.md`
- `docs/phase-4-governance-v1.md`
- `docs/real-integration-foundation-v0-plan.md`
- `docs/repository-inventory.md`
- `docs/persistent-storage-schema-v0.md`
- `docs/persistent-db-v1-plan.md`
- `docs/persistent-db-v1.md`
- `docs/real-git-adapter-v0-plan.md`
- `docs/real-git-adapter-v0.md`
- `docs/llm-gateway-v0-plan.md`
- `docs/llm-gateway-v0.md`
- `docs/local-agent-runner-v0-plan.md`
- `docs/local-agent-runner-v0.md`
- `docs/local-agent-runner-v1-plan.md`
- `docs/local-agent-runner-v1.md`
- `docs/policy-as-code-v0-plan.md`
- `docs/policy-as-code-v0.md`
- `docs/enterprise-llm-provider-abstraction-v0-plan.md`
- `docs/enterprise-llm-provider-abstraction-v0.md`
- `docs/secrets-sandbox-design-v0-plan.md`
- `docs/secrets-sandbox-design-v0.md`
- `docs/auth-rbac-readiness.md`
- `docs/real-git-adapter-v0-readiness.md`
- `docs/dashboard-read-model-plan.md`
- `docs/real-integration-roadmap.md`
- implementation under `apps/`, `packages/`, `tests/`, `scripts/`, and `docs/`

## 1. Phase Mapping

| Phase | Status | Rationale |
|---|---|---|
| Phase 1: LLM and cost management foundation, task orchestration, mock or real Git workflow, usage ledger, API, worker, dashboard | `complete_for_current_milestone` | The mock MVP vertical slice is implemented, validated, tested, and still mock-only. Task orchestration exists in `apps/worker/src/workflows/run-agent-task-workflow.ts`; API task creation/run endpoints exist in `apps/api/src/main.ts`; mock LLM/model routing, mock Git PR/branch behavior, usage ledger, worker, and web dashboard are implemented. This is not production-ready. |
| Phase 2: Branch conflict manager, active branch or lease graph, conflict risk scoring, merge queue, conflict visibility | `complete_for_current_milestone` | v0 concepts exist (`BranchLease`, `ConflictRisk`, `MergeQueueEntry`) and v1 adds `MergeSimulationResult`, `MergeSimulator`, `MockMergeSimulator`, `LocalGitDryRunMergeSimulator`, simulation-aware risk and queue fields, API visibility, dashboard visibility, and tests. This is not full Phase 2 completion because semantic/symbol/test impact signals, rebase-needed detection, resolver handoff, human escalation workflow, and provider-backed merge automation remain future work. |
| Phase 3: Skill Registry, Harness Registry, Instruction Registry, version pinning, separation of Skill / Harness / InstructionArtifact | `v3_implemented` | Separate domain concepts, seed registries, exact and simple semver range refs, repository interfaces, in-memory and file-backed repositories, stable DTOs, registry APIs, registry-backed workflow selection, TaskRun-selected refs, audit logs, approval/eval gates, local checksum verification, append-only history, rollback, approval queue read models, local eval result attachment, mock mutation RBAC, local package manifests, local import/export, package diffs, dashboard visibility, and tests exist. Signed artifacts, full approval workflow, eval execution, full package management, real auth/RBAC, and real artifact registry integration remain future work. |
| Phase 4: Auto-improvement loop, trace clustering, LLM-based Skill or Harness patch proposals, eval, canary rollout | `v1_implemented` | Mock-only Auto-improvement v0 exists and Governance v1 now adds `ProposalReviewQueueItem`, `ProposalGovernanceDecision`, `ProposalEvalRun`, `CanaryReadiness`, `ProposalApplyGate`, improvement governance audit events, readiness checks that consider governance/eval/canary/draft status, API/dashboard visibility, and tests. This is not production auto-improvement: no LLM calls, no embeddings, no active registry mutation, no proposal auto-approval, no eval execution, no canary execution, and no apply behavior exists. |
| Phase 5: Enterprise features such as SCIM, audit export, production policy-as-code, private deployment, data residency, advanced security | `planned_only` | Policy-as-code Skeleton v0 now exists as a static mock-first decision layer, but there is no production policy runtime, SCIM, audit export, private deployment workflow, data residency control, or advanced enterprise security implementation. |

Real integration foundation: `v0_scaffolded`. A storage provider and repository factory abstraction exists in `packages/db/src/storage.ts`; the default runtime remains in-memory. Repository inventory, Postgres-oriented schema design, migration skeleton, auth/RBAC readiness, Real Git Adapter readiness, dashboard read model plan, and real integration roadmap are documented.

Persistent DB: `v1_implemented`. `packages/db/src/postgres.ts` adds an opt-in Postgres storage provider, repository factory, small database client boundary, and Postgres-backed repositories for Task, TaskRun, usage ledger, branch leases, merge simulations, merge queue, registry entities, registry audit/history, registry packages, and registry eval results. `scripts/db/migrate.mjs` runs the SQL migration only when explicitly invoked. Optional Postgres repository contract tests run only when `AICHESTRA_TEST_DATABASE_URL` is configured. Phase 4 governance repositories remain in-memory for v1.

Real Git Adapter: `v0_implemented`. `GitProvider` now exposes provider-neutral branch, PR, changed-file, validation, and merge simulation recording operations. `MockGitProvider` remains the default; `LocalGitProvider` supports fixture-safe local Git inspection without fetch, push, or working-tree mutation; `GitHubGitProvider` is a gated skeleton that blocks remote operations by default and performs no network calls. `GitIntegrationService`, `/git/*` API routes, health metadata, dashboard visibility, and deterministic tests are implemented. This is not production Git integration because remote branch/PR creation and automatic merge/rebase remain out of scope.

LLM Gateway: `v0_implemented`. `LLMProvider` and `LLMGatewayService` now provide provider-neutral model routing, deterministic mock completions, model catalog, virtual model key policy objects, per-task budget checks, usage ledger integration, LLM audit events, API endpoints, health metadata, dashboard visibility, and tests. `OpenAICompatibleLLMProvider` is a gated skeleton that blocks remote completion by default and performs no network calls. This is not production LLM integration because real provider calls, streaming, BYOK, OAuth/delegated auth, and production secret management remain out of scope.

Local Agent Runner: `v1_implemented`. `AgentRunner` now exposes provider-neutral runner lifecycle methods, `MockAgentRunner` remains deterministic and default, `LocalAgentRunner` is disabled by default, `CommandExecutor` adds blocked and fixture-local command execution boundaries, `LocalAgentWorkspaceManager` validates fixture/temp workspaces, `RunnerHarnessPolicy` blocks unsafe commands/network/remote Git/file writes/secrets, instruction assembly records selected refs and a deterministic hash, in-memory runner repositories record AgentRun, AgentRunAudit, InstructionAssembly, AgentWorkspace, and CommandExecutionResult data, `/agents/*` and `/tasks/:id/run-agent` API routes expose runner behavior, health/dashboard visibility is implemented, and tests cover mock/local safety behavior. This is not production agent execution because real Codex CLI, Claude Code, Aider, production sandboxing, arbitrary command execution, and secrets injection remain out of scope.

Policy-as-code: `v0_implemented`. `packages/policy` now defines provider-neutral `PolicySubject`, `PolicyResource`, `PolicyAction`, `PolicyContext`, `PolicyRule`, `PolicyDecision`, and `PolicyDecisionAuditEntry` models, a deterministic `StaticPolicyEngine`, a restrictive default rule set, in-memory policy decision audit, DTOs, API endpoints, health/dashboard visibility, and tests. Policy checks are integrated into Git, LLM, Runner, and Registry mutation authorization boundaries where practical. This is not production policy enforcement: no OPA/Rego, Cedar, production auth/RBAC, external policy service, dynamic policy code, persistent policy store, or secrets integration exists.

Enterprise Provider Abstraction: `v0_implemented`. `packages/llm-gateway/src/enterprise-providers.ts` defines provider kind/auth/catalog models, credential/token resolver skeletons, blocked provider adapters, Local CLI provider templates, Local Agent boundary models, parser/redaction utilities, provider audit events, API/dashboard visibility, and tests. It does not call provider APIs, execute vendor CLIs, read credential caches, or perform token exchange.

Secrets and Sandbox: `v0_implemented`. `packages/security` defines metadata-only `SecretRef`, `SecretScope`, `SecretLease`, `SecretAccessDecision`, `SandboxProfile`, `SandboxSession`, `SandboxDecision`, `NetworkEgressPolicy`, `RedactionPolicy`, in-memory repositories, a mock `SecretManager`/`SecurityControlService`, security audit events, DTOs, API/dashboard visibility, and tests. Policy-as-code includes secret, sandbox, network, runner secret injection, provider credential, and Local Agent secret-forwarding actions. This is not production secret management or sandboxing: no real secret backend, production secret injection, container/VM sandbox, network enforcement, Local Agent protocol, or credential cache access exists.

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
| `pnpm test` | pass | `node scripts/run-tests.mjs`; 129 tests passed, 1 optional Postgres contract test skipped, 0 failed. |
| `pnpm build` | pass | `node scripts/build.mjs`; output: `build passed`. |

## 7. Test Coverage Audit

| Area | Covered | Evidence | Recommendation |
|---|---|---|---|
| API run endpoint | yes | `tests/api-health.test.ts` covers `/tasks/:id/run` success and `409` active-run conflict | Keep adding API tests as endpoints move to async behavior. |
| Mock workflow success | yes | `tests/mock-workflow-vertical-slice.test.ts` verifies completed task, TaskRun, changed files, PR, lease, queue entry | None. |
| Policy denial | yes | `mock workflow blocks policy-denied tasks before provider behavior`; `tests/policy-as-code-v0.test.ts` covers static policy decisions and service-boundary denials | None. |
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
- Signed artifacts, full dependency solving, real mutation auth/RBAC, and production policy-as-code enforcement remain future work.
- `packages/adapters` remains a compatibility aggregate while split packages re-export behavior; ownership can be tightened before real integrations.
- Local Agent Runner v1 stores runner records, workspaces, and command results in memory; durable Postgres runner repositories are future work.
- Phase 2 still lacks rebase-needed detection, semantic/symbol/test impact signals, resolver handoff, and human escalation workflow.

### Nice-To-Have Improvements

- Add OpenAPI or route documentation for conflict endpoints.
- Add dashboard render tests.
- Add branch lease expiration behavior tests.
- Add explicit audit events for merge queue mark-merged/cancel.
- Add stable API response DTOs instead of returning in-memory domain objects directly.

## 9. Recommendation

Recommendation: safe to merge the current MVP vertical slice, Conflict Manager v1 baseline, Phase 3 Packaging & Versioning v3, Phase 4 Governance v1, Persistent DB v1, Real Git Adapter v0, LLM Gateway v0, and Local Agent Runner v1.

The repository has moved beyond the v0 baseline. Conflict Manager v1 is implemented with mock/local-only merge simulation, and it should not be interpreted as full Phase 2 completion.

Persistent DB v1, Real Git Adapter v0, LLM Gateway v0, Local Agent Runner v1, Policy-as-code Skeleton v0, Enterprise LLM Provider Abstraction v0, and Secrets and Sandbox Design v0 are implemented behind explicit storage/provider/runner/policy/security boundaries. Real provider secret access, Local Agent protocol work, vendor CLI execution, and production sandboxing remain future work.

Exact next task:

```text
Aichestra Local Agent Protocol v0.
```

## Final Summary

Current phase status:

- Phase 1: `complete_for_current_milestone`
- Phase 2: `complete_for_current_milestone`
- Phase 3: `v3_implemented`
- Phase 4: `v1_implemented`
- Phase 5: `planned_only`
- Real integration foundation: `v0_scaffolded`
- Persistent DB: `v1_implemented`
- Real Git Adapter: `v0_implemented`
- LLM Gateway: `v0_implemented`
- Local Agent Runner: `v1_implemented`
- Policy-as-code: `v0_implemented`
- Enterprise Provider Abstraction: `v0_implemented`
- Secrets and Sandbox: `v0_implemented`

Validation:

- install: pass
- lint: pass
- typecheck: pass
- test: pass after Secrets and Sandbox Design v0 validation; 130 total, 129 passed, one optional Postgres contract test skipped when no test database URL is configured
- build: pass

Merge recommendation:

Safe to merge the current MVP vertical slice, Conflict Manager v1 baseline, Phase 3 Packaging & Versioning v3, Phase 4 Governance v1, Persistent DB v1, Real Git Adapter v0, LLM Gateway v0, Local Agent Runner v1, Policy-as-code Skeleton v0, and Enterprise LLM Provider Abstraction v0. No critical blockers were found.

Next recommended Codex task:

Aichestra Local Agent Protocol v0, or Real Git Adapter v1 if controlled remote Git branch/PR creation should be enabled next.
