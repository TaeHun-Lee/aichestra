# Phase Progress Audit

## Scope

This audit reflects the current repository state after Dashboard API-backed Read Model v0.

Guidance and evidence reviewed:

- `AGENTS.md`
- `README.md`
- `docs/briefs/AICHESTRA_BOOTSTRAP.md`
- `AICHESTRA_CODEX_PHASE3_TO_PHASE4_WORK_ORDERS.md`
- `docs/audits/2026-05-11-bootstrap-gap-report.md`
- `docs/audits/2026-05-11-phase-2-completion-gap.md`
- `docs/features/conflict-manager/v0.md`
- `docs/features/conflict-manager/v1.md`
- `docs/features/registry/v0.md`
- `docs/features/registry/v1-hardening.md`
- `docs/features/registry/v2-operational-hardening.md`
- `docs/features/registry/v3-packaging-versioning.md`
- `docs/audits/2026-05-11-phase-3-completion-gap.md`
- `docs/features/auto-improvement/preparation-plan.md`
- `docs/features/auto-improvement/preparation.md`
- `docs/features/auto-improvement/v0-plan.md`
- `docs/features/auto-improvement/v0.md`
- `docs/features/governance/v1-plan.md`
- `docs/features/governance/v1.md`
- `docs/roadmaps/real-integration-foundation-v0-plan.md`
- `docs/foundations/repository-inventory.md`
- `docs/foundations/persistent-storage-schema-v0.md`
- `docs/features/persistent-db/v1-plan.md`
- `docs/features/persistent-db/v1.md`
- `docs/features/real-git-adapter/v0-plan.md`
- `docs/features/real-git-adapter/v0.md`
- `docs/features/real-git-adapter/v1-plan.md`
- `docs/features/real-git-adapter/v1.md`
- `docs/features/llm-gateway/v0-plan.md`
- `docs/features/llm-gateway/v0.md`
- `docs/features/local-agent-runner/v0-plan.md`
- `docs/features/local-agent-runner/v0.md`
- `docs/features/local-agent-runner/v1-plan.md`
- `docs/features/local-agent-runner/v1.md`
- `docs/features/policy-as-code/v0-plan.md`
- `docs/features/policy-as-code/v0.md`
- `docs/features/enterprise-llm-provider/v0-plan.md`
- `docs/features/enterprise-llm-provider/v0.md`
- `docs/features/secrets-sandbox/v0-plan.md`
- `docs/features/secrets-sandbox/v0.md`
- `docs/features/local-agent-protocol/v0-plan.md`
- `docs/features/local-agent-protocol/v0.md`
- `docs/features/local-agent-protocol/v1-plan.md`
- `docs/features/local-agent-protocol/v1.md`
- `docs/foundations/auth-rbac-readiness.md`
- `docs/features/real-git-adapter/audits/v0-readiness.md`
- `docs/features/dashboard/read-model-plan.md`
- `docs/features/dashboard/v0-plan.md`
- `docs/features/dashboard/v0.md`
- `docs/reference/dashboard-read-model-inventory.md`
- `docs/roadmaps/real-integration-roadmap.md`
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

Real Git Adapter: `v1_implemented`. `GitProvider` now exposes provider-neutral branch, PR, changed-file, validation, and merge simulation recording operations. `MockGitProvider` remains the default; `LocalGitProvider` supports fixture-safe local Git inspection without fetch, push, or working-tree mutation; `GitHubGitProvider` now supports controlled branch creation, PR creation, and PR changed-file reads through a `GitHubClient` boundary only when explicit remote Git gates, operation gates, repo allowlists, branch prefix, credentials, and policy checks pass. `GitIntegrationService`, `/git/*` API routes, health metadata, dashboard visibility, and deterministic tests are implemented. This is not production Git integration because automatic merge/rebase, force push, branch deletion, webhooks, GitHub App installation, GitLab, and Bitbucket remain out of scope.

LLM Gateway: `v0_implemented`. `LLMProvider` and `LLMGatewayService` now provide provider-neutral model routing, deterministic mock completions, model catalog, virtual model key policy objects, per-task budget checks, usage ledger integration, LLM audit events, API endpoints, health metadata, dashboard visibility, and tests. `OpenAICompatibleLLMProvider` is a gated skeleton that blocks remote completion by default and performs no network calls. This is not production LLM integration because real provider calls, streaming, BYOK, OAuth/delegated auth, and production secret management remain out of scope.

Local Agent Runner: `v1_implemented`. `AgentRunner` now exposes provider-neutral runner lifecycle methods, `MockAgentRunner` remains deterministic and default, `LocalAgentRunner` is disabled by default, `CommandExecutor` adds blocked and fixture-local command execution boundaries, `LocalAgentWorkspaceManager` validates fixture/temp workspaces, `RunnerHarnessPolicy` blocks unsafe commands/network/remote Git/file writes/secrets, instruction assembly records selected refs and a deterministic hash, in-memory runner repositories record AgentRun, AgentRunAudit, InstructionAssembly, AgentWorkspace, and CommandExecutionResult data, `/agents/*` and `/tasks/:id/run-agent` API routes expose runner behavior, health/dashboard visibility is implemented, and tests cover mock/local safety behavior. This is not production agent execution because real Codex CLI, Claude Code, Aider, production sandboxing, arbitrary command execution, and secrets injection remain out of scope.

Policy-as-code: `v0_implemented`. `packages/policy` now defines provider-neutral `PolicySubject`, `PolicyResource`, `PolicyAction`, `PolicyContext`, `PolicyRule`, `PolicyDecision`, and `PolicyDecisionAuditEntry` models, a deterministic `StaticPolicyEngine`, a restrictive default rule set, in-memory policy decision audit, DTOs, API endpoints, health/dashboard visibility, and tests. Policy checks are integrated into Git, LLM, Runner, and Registry mutation authorization boundaries where practical. This is not production policy enforcement: no OPA/Rego, Cedar, production auth/RBAC, external policy service, dynamic policy code, persistent policy store, or secrets integration exists.

Enterprise Provider Abstraction: `v0_implemented`. `packages/llm-gateway/src/enterprise-providers.ts` defines provider kind/auth/catalog models, credential/token resolver skeletons, blocked provider adapters, Local CLI provider templates, Local Agent boundary models, parser/redaction utilities, provider audit events, API/dashboard visibility, and tests. It does not call provider APIs, execute vendor CLIs, read credential caches, or perform token exchange.

Secrets and Sandbox: `v0_implemented`. `packages/security` defines metadata-only `SecretRef`, `SecretScope`, `SecretLease`, `SecretAccessDecision`, `SandboxProfile`, `SandboxSession`, `SandboxDecision`, `NetworkEgressPolicy`, `RedactionPolicy`, in-memory repositories, a mock `SecretManager`/`SecurityControlService`, security audit events, DTOs, API/dashboard visibility, and tests. Policy-as-code includes secret, sandbox, network, runner secret injection, provider credential, and Local Agent secret-forwarding actions. This is not production secret management or sandboxing: no real secret backend, production secret injection, container/VM sandbox, network enforcement, or credential cache access exists.

Local Agent Protocol: `v1_implemented`. `packages/llm-gateway/src/local-agent-protocol.ts` defines Local Agent registration/status/capability/session models, mock signed channel and handshake metadata, fixture daemon simulation, capability advertisements, CLI compatibility matrix/results, invocation envelope metadata, consent request/decision records, deterministic lifecycle states, normalized stdout/stderr/system events, invocation streams, in-memory repositories, `MockLocalAgentTransport`, redaction/audit behavior, and policy/security/provider integration. `/local-agents/*` API routes, health metadata, dashboard visibility, docs, schema skeletons, and tests are implemented. This is not a production Local Agent: no real daemon, WebSocket/gRPC/HTTP tunnel, PTY automation, vendor CLI execution, credential cache read/upload, OAuth/device-code/WIF/IAM exchange, cloud provider call, or secret forwarding exists.

Dashboard API-backed Read Model: `v0_implemented`. `packages/shared/src/dashboard-read-models.ts` defines stable dashboard read-model DTOs and sanitization helpers. `apps/api/src/dashboard-read-model.ts` aggregates current service/repository/config/audit state for `/dashboard/*` routes without running workflows, calling providers, executing runner commands, creating Local Agent fixture invocations, requesting secret leases, or reading credential caches. `apps/web/lib/dashboard-data-provider.ts` adds API and demo providers, and `apps/web/src/render.ts` consumes read models. This is not a production dashboard: auth/RBAC scoping, production analytics, and tenant isolation remain future work.

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
| Dashboard visibility | yes | `apps/web/src/render.ts` consumes `DashboardReadModels`; `/dashboard/*` routes expose Task, Git, Conflict, Registry, LLM, Runner, Policy, Provider, Security, Local Agent, and Audit sections | Demo fallback remains only for deterministic static/offline rendering. |

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
| Dashboard should consume API data rather than duplicating domain logic | pass | `ApiDashboardDataProvider` fetches `/dashboard/*`; `DemoDashboardDataProvider` is explicit fallback for static/offline rendering | Add auth/tenant scoping before production use. |
| Tests should verify behavior, not only snapshots | pass | Tests cover API behavior, workflow outcomes, conflict scoring, merge simulation, usage attribution, state transitions, dashboard read models, provider fallback, and merge queue release behavior | Add API contract docs later. |

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
rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|gemini|codex|gitlab|bitbucket|bedrock|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|GOOGLE_APPLICATION_CREDENTIALS|AICHESTRA_LLM_API_KEY|LLM_API_KEY|~/.codex|auth.json|~/.claude|credential cache|git fetch|git push|git merge|git rebase|kubectl|vault|temporal|mcp|child_process|exec\\(|spawn\\(|eval\\(" .
```

Additional targeted searches:

```bash
rg -n "fetch" .
rg -n "axios|Octokit|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN" .
rg -n "new Anthropic|OpenAI\\(|https\\.request|http\\.request\\(" apps packages tests scripts
```

Classification:

- Safe documentation references: `design_docs/`, `README.md`, roadmap/audit docs, and provider design docs that describe future integrations and blocked behavior.
- Safe mock references: dashboard/test seed strings, provider catalog templates, mock MCP naming, mock branch names, and blocked local CLI/provider examples.
- Safe type/interface references: provider/agent enum strings, disabled future runner kinds, provider template metadata, and policy action names.
- Safe config placeholders: `AICHESTRA_LLM_API_KEY`, `AICHESTRA_GITHUB_TOKEN`, and provider env key names are read only as gated configuration metadata and are not emitted into audit/output.
- Gated GitHub client boundary: `FetchGitHubClient` is instantiated only from explicit GitHub remote config and is not used by default tests/runtime. Service/API layers do not call `fetch` directly.
- Safe local-only git usage: `LocalGitProvider` and `LocalGitDryRunMergeSimulator` use local fixture-safe Git inspection and `git merge-tree` without fetch, push, provider merge/rebase, or working-branch mutation.
- Gated runner boundary: `FixtureLocalCommandExecutor` uses `spawn` only behind explicit local runner/workspace/harness gates; default command executor is blocked.
- Mock local agent protocol: `MockLocalAgentTransport` is in-memory and does not spawn processes or use network transport.
- Mock fixture daemon: `FixtureLocalAgentDaemon` simulates connected/disconnected fixture agents, mock channels, compatibility, consent, and stream events without network, process spawn, vendor CLI execution, or credential reads.
- Safe redaction test strings: credential cache and provider key strings appear in tests/dashboard data to prove redaction and denial.
- Suspicious real integration code: none found.
- Actual external calls in default runtime/tests: none found. `scripts/lint.mjs` contains a regex that detects direct external HTTP calls. `tests/api-health.test.ts` uses `http.request` only against local test servers. Optional GitHub integration tests are skipped unless all explicit remote Git env gates are set.

Conclusion: the repository complies with the mock-only MVP rule.

## 6. Validation Commands

| Command | Result | Output Summary |
|---|---|---|
| `pnpm install` | pass | Workspace already up to date; no packages downloaded. |
| `pnpm lint` | pass | `node scripts/lint.mjs`; output: `lint passed`. |
| `pnpm typecheck` | pass | `tsc --noEmit -p tsconfig.typecheck.json`; no errors. |
| `pnpm test` | pass | `node scripts/run-tests.mjs`; 156 total, 154 passed, 2 optional tests skipped (Postgres contract and real GitHub integration), 0 failed. |
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
| Dashboard data assumptions | yes | `tests/dashboard-data.test.ts` asserts deterministic demo fallback; `tests/dashboard-read-model-v0.test.ts` asserts `/dashboard/*`, provider mapping, fallback, no-secret exposure, and read-only behavior | Keep demo fallback out of production API mode. |

## 8. Current Blockers

### Critical Blockers

None found.

### Important Follow-Ups

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
- Add dashboard API contract/OpenAPI docs.
- Add branch lease expiration behavior tests.
- Add explicit audit events for merge queue mark-merged/cancel.
- Add stable API response DTOs instead of returning in-memory domain objects directly.

## 9. Recommendation

Recommendation: safe to merge the current MVP vertical slice, Conflict Manager v1 baseline, Phase 3 Packaging & Versioning v3, Phase 4 Governance v1, Persistent DB v1, Real Git Adapter v1, LLM Gateway v0, Local Agent Runner v1, Policy-as-code Skeleton v0, Enterprise LLM Provider Abstraction v0, Secrets and Sandbox v0, Local Agent Protocol v1, and Dashboard API-backed Read Model v0.

The repository has moved beyond the v0 baseline. Conflict Manager v1 is implemented with mock/local-only merge simulation, and it should not be interpreted as full Phase 2 completion.

Persistent DB v1, Real Git Adapter v1, LLM Gateway v0, Local Agent Runner v1, Policy-as-code Skeleton v0, Enterprise LLM Provider Abstraction v0, Secrets and Sandbox Design v0, Local Agent Protocol v1, and Dashboard API-backed Read Model v0 are implemented behind explicit storage/provider/runner/policy/security/read-model boundaries. Real provider secret access, Local Agent production daemon/transport work, vendor CLI execution, and production sandboxing remain future work.

Exact next task:

```text
LLM Gateway v1 for controlled real provider calls, or Real Git Adapter v2/webhook planning if Git integration should continue first.
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
- Real Git Adapter: `v1_implemented`
- LLM Gateway: `v0_implemented`
- Local Agent Runner: `v1_implemented`
- Policy-as-code: `v0_implemented`
- Enterprise Provider Abstraction: `v0_implemented`
- Secrets and Sandbox: `v0_implemented`
- Local Agent Protocol: `v1_implemented`
- Dashboard API-backed Read Model: `v0_implemented`

Validation:

- install: pass
- lint: pass
- typecheck: pass
- test: pass after Dashboard API-backed Read Model v0 validation; 156 total, 154 passed, optional Postgres contract and real GitHub integration tests skipped when env vars are not configured
- build: pass

Merge recommendation:

Safe to merge the current MVP vertical slice, Conflict Manager v1 baseline, Phase 3 Packaging & Versioning v3, Phase 4 Governance v1, Persistent DB v1, Real Git Adapter v1, LLM Gateway v0, Local Agent Runner v1, Policy-as-code Skeleton v0, Enterprise LLM Provider Abstraction v0, Secrets and Sandbox v0, Local Agent Protocol v1, and Dashboard API-backed Read Model v0. No critical blockers were found.

Next recommended Codex task:

LLM Gateway v1 for controlled real provider calls, or Real Git Adapter v2/webhook planning if Git integration should continue first.
