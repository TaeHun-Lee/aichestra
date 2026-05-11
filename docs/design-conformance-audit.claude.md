# Aichestra Design Conformance Audit (Claude)

Auditor: Claude (independent re-audit, no Codex assumptions trusted)
Date: 2026-05-12
Mode: audit-only. No application code, registries, or integrations were modified.

CLAUDE.md is not present; AGENTS.md was read directly. README.md, all `docs/*`, and `design_docs/*` were inspected. Validation was run end-to-end. Source was sampled deeply enough to verify each major area without trusting prior summaries.

---

## 1. Executive assessment

- Rating: **pass_with_minor_followups**
- Confidence: **high**
- Follows original design direction: **yes**. The current shape (Aichestra Control Plane → Task Orchestrator → LLM Gateway → Registry Resolver → Conflict Manager → Auto-improvement → Persistent DB / Real Git Adapter foundations) matches the blueprint in `design_docs/AICHESTRA_TECH_STACK_BLUEPRINT.md` and AGENTS.md. The system is broader than at the last audit (Phase 4 v0/v1, LLM Gateway v0, Real Git Adapter v0, Persistent DB v1).
- Phase progress coherent: **yes**. Phases are layered (1 → 2 → 3 → 4 prep → 4 v0 → 4 v1, and integration foundations) and the docs explain what each step added.
- Validation green: **yes**. `install`, `lint`, `typecheck`, `test` (95 pass, 1 skipped — the optional Postgres contract suite), `build` all pass.
- Mock-first safety intact: **yes**. No runtime call paths to real OpenAI/Anthropic/Gemini/Bedrock, GitHub/GitLab/Bitbucket, MCP, Vault, K8s, Temporal, or artifact registries. `OpenAICompatibleLLMProvider` and `GitHubGitProvider` are skeletons with no `fetch`/`axios`/SDK imports. Local git access is bounded to a caller-supplied `repoPath` and reads only.
- Safe to proceed to the next planned task: **yes** (Local Agent Runner v0 or Dashboard read-model migration are the most leveraged next steps; see Section 12).
- Safe to begin production hardening: **no**, by design. No real auth/RBAC, no SSO/SCIM, no real secrets, no sandbox, no policy-as-code, no production deployment, no signed artifacts. The project explicitly says so.
- Any docs overstate production readiness: **no critical overstatement found**. README and phase docs are explicit about mock-first / not-production-ready and clearly enumerate "Deferred" items.

Strict note: the LLM Gateway and Git Adapter v0 modules are very capable — provider-neutral interfaces, model catalog, virtual keys, budget checks, audit, DTOs — but they are still **provider-skeleton-only**. A reader can be tempted to read these as production gateways. The docs are correct, but the surface area is large enough that a reviewer must read AGENTS.md rules 67–75 to understand the gates.

---

## 2. Current phase status

### Phase 1 — Task orchestration / mock vertical slice
- Status: **complete_for_current_milestone**
- Evidence: `apps/worker/src/workflows/run-agent-task-workflow.ts:1-348`, `apps/api/src/main.ts` `POST /tasks` + `POST /tasks/:id/run`, `packages/db/src/repository.ts` `InMemoryAichestraStore`, `packages/db/src/usage-ledger.ts`, `packages/adapters/src/policy/mock-policy-engine.ts`, `packages/runner/src/mock-agent-runner.ts`, `packages/adapters/src/git/mock-git-provider.ts`. The workflow now defaults to `createDefaultLlmGatewayService` instead of the legacy `MockLlmGateway` shim (workflow.ts:3, 56).
- Implemented: Task/TaskRun lifecycle, mock policy, mock model selection through `CatalogModelRouter`, registry-resolved skill/harness/instruction refs, mock branch + agent + tests + PR + usage ledger + audit.
- Missing: async worker queue (still synchronous over HTTP); durable runtime persistence wired by default; auth on API endpoints; dashboard data via API instead of in-process workflow.
- Blocks current milestone: **no**.
- Blocks production: **yes** (auth, queue, persistence, deployment).

### Phase 2 — Conflict Manager v1
- Status: **complete_for_current_milestone**
- Evidence: `BranchLease`, `ConflictRisk`, `MergeQueueEntry`, `MergeSimulationResult`, `MergeSimulator` in `packages/core/src/domain/models.ts` and `packages/core/src/conflicts/`. `MockMergeSimulator` and `LocalGitDryRunMergeSimulator` in `packages/adapters/src/git/merge-simulators.ts` (193 LOC) — only `git -C <repoPath> rev-parse|diff|merge-tree --write-tree`, no `fetch`/`push`. API routes `/branches/leases`, `/conflicts/risks`, `/merge-simulations`, `/merge-queue`.
- Implemented: deterministic risk scoring, risk-combined queue decision, dashboard surface.
- Missing: rebase-needed detection, symbol/test impact analysis, semantic hints, queue history, resolver-agent handoff, real-provider merge.
- Blocks current milestone: **no**.
- Blocks production: yes for full Phase 2 but not for v1 milestone.

### Phase 3 — Registry through Packaging & Versioning v3
- Status: **v3_implemented**
- Evidence: `packages/registry/src/index.ts` (~2970 LOC) implements separate Skill/Harness/Instruction repositories + DTOs + `RegistryService` with status/approval/eval/checksum gates, append-only history, rollback, approval queue, eval result attachment, mock RBAC, package manifest export/import (`create_only`, `replace_draft_only`, dry-run), semver range v0 (exact, `^`, `~`, `N.x`, `latest`), package diff. Workflow wires `selectedSkillRefs`/`selectedHarnessRef`/`selectedInstructionRefs` into `TaskRun`. API surfaces all of this under `/registry/*`.
- Implemented: matches AGENTS.md rules 50–58 verbatim.
- Missing: real DB-backed registry (Persistent DB v1 now covers this opt-in), signed artifacts, real multi-actor approval workflow, real eval execution, full semver, real artifact registry, real SSO/SCIM.
- Blocks current milestone: **no**.
- Blocks production: yes.

### Phase 4 — Preparation, Auto-improvement v0, Governance v1
- Status: **v1_implemented**
- Evidence: `packages/improvement/src/index.ts` (1957 LOC) defines `FailureSignal`, `FailureCluster`, `ImprovementCandidate`, `ImprovementProposal`, `EvalRequirement`, `CanaryRolloutPlan`, `AutoImprovementSafetyPolicy`, `AutoImprovementAnalysis`, `DraftRegistryChange`, `ProposalReadiness`, `ProposalReviewQueueItem`, `ProposalGovernanceDecision`, `ProposalEvalRun`, `CanaryReadiness`, `ProposalApplyGate`, `ImprovementGovernanceAuditEvent`, plus repository interfaces, in-memory repository, services, DTO mappers, and `MockAutoImprovementEngine`. `createImprovementServices` wires 14 services together. The default safety policy hard-codes `allowAutoApply=false`, `requireHumanApproval=true`, `requireEvalPassed=true`, `requireCanary=true` (`createDefaultSafetyPolicy`, registry/index.ts:620-635). API routes under `/improvement/*` (failure-signals, failure-clusters, clusters/:id/analyze|generate-candidate, analyses, candidates, proposal-review-queue, proposals, proposals/:id/{prepare-draft-change,decisions,eval-runs,canary-readiness,apply-gate,apply}, governance-audit). Apply endpoint returns forbidden/not-implemented.
- Implemented: Phase 4 Preparation models, Auto-improvement v0 (deterministic cluster → analysis → candidate → proposal → draft change → readiness), Governance v1 (review queue, decisions, eval run attachment metadata, canary readiness, apply gate, governance audit). Tests under `tests/phase-4-preparation.test.ts` (323 LOC), `tests/phase-4-auto-improvement-v0.test.ts` (264), `tests/phase-4-governance-v1.test.ts` (241).
- Missing: real eval execution, real canary execution, apply-behavior implementation, durable storage for Phase 4 entities (in-memory only; Persistent DB v1 explicitly excludes them).
- Blocks current milestone: **no**.
- Blocks production: yes — and intentionally so. Mock-only, draft-only is a deliberate non-goal in v1.

### Persistent DB v1
- Status: **v1_implemented** (opt-in only)
- Evidence: `packages/db/src/storage.ts` defines `StorageProvider`, `RepositoryFactory`, `TaskRepository`, `TaskRunRepository`, `UsageLedgerRepository`, `ConflictRepositories`. `packages/db/src/postgres.ts` (1634 LOC) provides `PostgresStorageProvider`, `PostgresAichestraStore`, `PsqlCliDatabaseClient` (uses `psql` via `spawnSync` per query — synchronous boundary). `infra/migrations/0001_initial_aichestra_schema.sql` (585 LOC) and `scripts/db/migrate.mjs` provide the migration runner. `/health` reports `storage.kind` and health. Postgres is selected only if `AICHESTRA_STORAGE_PROVIDER=postgres` with `AICHESTRA_DATABASE_URL`. Optional contract tests `tests/repository-contracts.test.ts` skip when `AICHESTRA_TEST_DATABASE_URL` is unset (verified: pnpm test shows the postgres suite as skipped).
- Implemented: in-memory default, Postgres opt-in provider, repository factory, migration skeleton, contract tests for in-memory, optional Postgres tests, health endpoint. Postgres-backed repositories cover Task/TaskRun/UsageLedger/BranchLease/MergeSimulation/MergeQueue and the entire Registry surface (audit, history, eval results, packages).
- Missing: Phase 4 governance Postgres repositories (intentionally deferred). Production migration governance, pooling, backups, async repository contract refactor. No node-postgres driver (relies on local `psql`).
- Blocks current milestone: **no**.
- Blocks production: yes (pooling, async client, backups, ops).

### Real Git Adapter v0
- Status: **v0_implemented** (gated)
- Evidence: `packages/adapters/src/interfaces.ts` extends the `GitProvider` interface with provider-neutral methods. `MockGitProvider` (220 LOC), `LocalGitProvider` (344 LOC, no fetch/push/branch mutation, requires `repoRef.localPath`, validates work tree before any read, blocks unsafe paths), `GitHubGitProvider` (203 LOC, skeleton-only, every remote method returns `blocked(..., "github_provider_network_calls_not_implemented_in_v0")` and no SDK is imported). `provider-factory.ts` chooses provider from env. `GitIntegrationService` (356 LOC) wires provider calls to durable repo/PR records, branch leases, merge queue entries, and audit events. API routes under `/git/*` (providers, config, repos, branches, pull-requests, changed-files, audit). Tests `tests/real-git-adapter-v0.test.ts` (273 LOC) cover all three providers including a real-temp-repo path for LocalGitProvider that asserts the working tree is not mutated.
- Implemented: provider boundary, mock default, local-only fixture inspection, gated GitHub skeleton, `/git/*` API, audit events, health metadata. Token redaction in audit metadata (`sanitizeMetadata` for LLM and similar in Git audit).
- Missing: real GitHub branch/PR creation, automatic merge/rebase/force-push/delete-branch (explicitly out of v0). `AICHESTRA_ALLOW_REMOTE_MERGE` is unsupported.
- Blocks current milestone: **no**.
- Blocks production: yes — there is no real Git write path yet.

### LLM Gateway v0
- Status: **v0_implemented** (gated)
- Evidence: `packages/llm-gateway/src/` has `types.ts` (interfaces, `LLMProvider`, `LLMModel`, `VirtualModelKey`, `BudgetDecision`, `LLMAuditEvent`), `providers.ts` (`MockLLMProvider`, `OpenAICompatibleLLMProvider` skeleton — no `fetch`, no SDK, all methods return blocked reasons), `catalog.ts` (`ModelCatalogService`, in-memory repository with deterministic seed models, deprecated/disabled exclusion), `virtual-keys.ts` (`VirtualModelKey` as policy object only — no provider secret fields), `gateway.ts` (`LLMGatewayService` with `routeCompletion`, `routeRequest`, `checkBudget`, `complete`, legacy `LlmGateway` compatibility, usage ledger integration, audit events, sanitization of token/key/secret-like metadata). Worker now uses `createDefaultLlmGatewayService` by default. API routes under `/llm/*` (providers, config, models, virtual-keys, route, completions, usage, audit).
- Implemented: provider-neutral interface, mock default, gated OpenAI-compatible skeleton, model catalog, virtual keys, budget policy, usage ledger integration, audit events, API, dashboard, safety gates. Tests in `tests/llm-gateway-v0.test.ts` (218 LOC) cover provider behavior, model catalog, virtual key policy, budget allow/block, completions, audit, and remote-blocked behavior.
- Missing: real LLM provider calls, streaming, BYOK, OAuth/delegated auth, production secret manager, persistent model catalog/audit/request repositories, real billing/rate limiter.
- Blocks current milestone: **no**.
- Blocks production: yes (real provider integration not implemented).

### Phase 5 — Enterprise / production
- Status: **planned_only**
- Evidence: `docs/security-model.md`, `docs/auth-rbac-readiness.md`. No real SSO/SCIM, signed artifacts, policy-as-code engine, sandbox, secrets manager, deployment IaC, data residency, audit export.
- Blocks production: yes by definition.

---

## 3. Design conformance matrix

| # | Design element | Intended role | Current implementation | Evidence | Conformance | Notes |
|---|---|---|---|---|---|---|
| 1 | Aichestra Control Plane | API + Worker + Registry + Conflict + Improvement + Storage | All present | `apps/api/src/main.ts`, `apps/worker`, `packages/registry`, `packages/improvement`, `packages/db` | **pass** | API single Node http server; worker still in-process. |
| 2 | Task Orchestrator | TaskRun lifecycle, status machine, policy/registry/branch/agent/tests/PR | Implemented end-to-end | `apps/worker/src/workflows/run-agent-task-workflow.ts` | **pass** | Sync invocation from API; no queue. |
| 3 | LLM Gateway | Provider-neutral routing, budget, audit, usage | v0 implemented | `packages/llm-gateway/*` | **pass** | OpenAI-compatible is skeleton-only. |
| 4 | Model/Subscription Broker | Model catalog + virtual model keys + budget | Implemented | `catalog.ts`, `virtual-keys.ts`, `gateway.ts` `checkBudget` | **pass** | No real provider integration. |
| 5 | Usage Ledger | taskId/taskRunId attribution, cost/tokens | Implemented | `packages/db/src/usage-ledger.ts`, `LLMGatewayService.recordUsage` | **pass** | In-memory or Postgres-opt-in. |
| 6 | Virtual Model Keys | Internal policy object; **never** stores real secrets | Implemented per design | `packages/llm-gateway/src/virtual-keys.ts` (`VirtualModelKey` has only `allowedProviderKinds`, `allowedModelIds`, budgets, status — no `apiKey` field) | **pass** | AGENTS.md rule 74 enforced by absence. |
| 7 | Budget Policy | Per-task and per-key budget enforcement, deterministic | Implemented | `LLMGatewayService.checkBudget` | **pass** | Estimated cost only; no real metering. |
| 8 | Git Branch/PR Manager | Mock + local + future provider; safe by default | v0 implemented | `packages/git-adapter/src/service.ts`, `packages/adapters/src/git/*` | **pass** | GitHub provider is skeleton only. |
| 9 | Conflict Manager | Lease graph, file-overlap, dry-run simulation, queue recommendation | v1 implemented | `packages/core/src/conflicts/*`, `packages/adapters/src/git/merge-simulators.ts` | **pass** | No rebase-needed/AST/symbol overlap. |
| 10 | Merge Queue | Ready/blocked/merged status with simulation evidence | Implemented | `mergeQueueDecision`, `InMemoryAichestraStore.createMergeQueueEntry` | **pass** | No queue history persistence. |
| 11 | Skill Registry | CRUD, status, approval, eval gates, semver refs | Implemented | `packages/registry/src/index.ts` | **pass** | – |
| 12 | Harness Registry | Runtime/network/tool policy, instruction loading policy | Implemented | same | **pass** | No runtime execution. |
| 13 | Instruction Registry | Scope, precedence, checksum, body or repo-relative path | Implemented | same | **pass** | Checksum verify is local-safe. |
| 14 | Registry Governance | Audit log, append-only revisions, rollback, approval queue, eval results, mock RBAC, package manifests | Implemented | `RegistryService`, `MockRegistryMutationAuthorizer`, DTO mappers | **pass** | Mock RBAC ≠ production auth (explicit). |
| 15 | Auto-improvement | Failure signals → clusters → analyses → candidates → proposals → draft changes → readiness | v0 implemented | `packages/improvement/src/index.ts` (MockAutoImprovementEngine) | **pass** | Deterministic, mock-only. |
| 16 | Proposal/eval/canary/approval gates | Governance v1: review queue, decisions, eval run metadata, canary readiness, apply gate, governance audit | Implemented | `ProposalGovernanceService`, `ProposalEvalRunService`, `CanaryReadinessService`, `ProposalApplyGateService` | **pass** | Apply always blocked: `active_apply_not_implemented`. |
| 17 | Persistent DB | Storage provider, repository factory, in-memory default, opt-in Postgres, migrations | v1 implemented | `packages/db/src/storage.ts`, `packages/db/src/postgres.ts`, `infra/migrations/0001_initial_aichestra_schema.sql`, `scripts/db/migrate.mjs` | **pass** | Postgres uses `psql` CLI per query — works for v1, not for production load. |
| 18 | Git Adapter | Mock default, local-only safe, gated GitHub skeleton, no remote ops by default | v0 implemented | `packages/adapters/src/git/*`, `packages/git-adapter/src/service.ts` | **pass** | Audit metadata is redacted. |
| 19 | Dashboard | Status, PR, registries, conflicts, improvement, integrations | Implemented but **architecturally separated only partially** | `apps/web/src/render.ts`, `apps/web/lib/mock-data.ts`, `apps/web/lib/improvement-demo.ts` | **partial** | Dashboard still constructs its own seeded store and runs workflows at render time; the read-model migration is planned in `docs/dashboard-read-model-plan.md` but not done. |
| 20 | Audit Logs | Registry audit, generic audit, LLM audit, Git audit, improvement governance audit | Implemented | `RegistryAuditRepository`, `AuditLog`, `LLMAuditEvent`, `GitProviderAuditEvent`, `ImprovementGovernanceAuditEvent` | **pass** | Five separate audit streams — intentional separation. |
| 21 | Policy Engine | Budget, critical-path, review-required | Mock implemented | `packages/policy/src/index.ts`, `packages/adapters/src/policy/mock-policy-engine.ts` | **pass** | Simple by design. |
| 22 | Secrets / Sandbox | Mock only | Mock implemented | `packages/adapters/src/secrets/mock-secrets-broker.ts` | **not_applicable** for v0 | Real secrets/sandbox is Phase 5 work. |
| 23 | MCP Gateway | Mock only | Mock implemented | `packages/adapters/src/mcp/mock-mcp-gateway.ts` | **not_applicable** for v0 | Real MCP planning not started. |
| 24 | Production Auth/RBAC | Real SSO/SCIM, request auth, actor resolution | **Not implemented** | `docs/auth-rbac-readiness.md` enumerates proposed actor/role/permission model; no implementation | **fail-by-design** | Documented Phase 5 plan. |
| 25 | Observability / Trace | Failure signals, usage events, multiple audit streams, `/health` reporting | Partially implemented | `packages/improvement` failure signals, usage ledger, all audit repositories, `/health` | **partial** | No external metrics/log shipping, no trace ids beyond gateway request ids, no eval/canary run executor. |

Intentional non-goals: real SSO/SCIM, real provider calls, real secrets, real sandbox, real artifact registry, signed artifacts, MCP Gateway integration, K8s/Temporal deployment. All flagged "Deferred" in README and AGENTS.md.

---

## 4. End-to-end flow verification

### Flow A — Task orchestration
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Task created | yes | `POST /tasks` → `InMemoryAichestraStore.createTask` | In-memory by default. |
| TaskRun triggered | yes | `POST /tasks/:id/run` → `runAgentTaskWorkflow` | Synchronous in API process. |
| Policy checked | yes | `MockPolicyEngine.evaluateTask` (workflow.ts ~111-130) | Mock-only. |
| Model selected | yes | `CatalogModelRouter.selectModel` (LLM Gateway integration) | Backed by model catalog. |
| Skill selected | yes | `registryService.resolveRegistryContextForTask` | Gates enforced. |
| Harness selected | yes | same | Resolver warning surface on TaskRun. |
| Instruction selected | yes | `assembleInstructionSet` (`packages/core/src/instructions/resolver.ts`) | Checksum recorded only. |
| Branch created | yes | `gitProvider.createBranch` | Mock by default. |
| Agent run simulated | yes | `MockAgentRunner.run` | Deterministic. |
| Diff summary | yes | Recorded on TaskRun (workflow.ts ~319-327) | Static templates. |
| Mock tests pass | yes | `MockTestRunner.run` | – |
| Mock PR created | yes | `gitProvider.createDraftPullRequest` | `mock://` URL. |
| Usage ledger recorded | yes | `MockUsageLedger.record` with registry refs in metadata | Good attribution. |
| Task completed | yes | Status machine through `pr_draft_ready` → `completed` | – |
| Dashboard displays result | yes-with-warning | `apps/web/src/render.ts`, `apps/web/app/page.tsx` | Dashboard reruns workflows at render time; planned to migrate to API read-model. |

### Flow B — Conflict management
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Lease created | yes | `store.createBranchLease` (workflow) | – |
| Changed files tracked | yes | `agentRun.changedFiles → BranchLease.files` | – |
| Conflict risk calculated | yes | `computeRepoConflictRisks` + `createConflictRisk` | Pairwise risk. |
| Merge simulation performed | yes | `MockMergeSimulator` default; `LocalGitDryRunMergeSimulator` available via API | Local only; tested with a real temp repo. |
| Merge queue entry updated | yes | `mergeQueueFieldsForLease`, `refreshMergeQueueEntriesForLease` | – |
| Recommendation generated | yes | `mergeQueueDecision` | Covers clean/text_conflict/failed/unavailable. |
| Dashboard/API displays risk | yes | `/conflicts/risks`, `/merge-queue`, dashboard sections | – |

### Flow C — Registry selection and governance
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Task run requests registry context | yes | `registryService.resolveRegistryContextForTask` | – |
| RegistryResolver chooses S/H/I | yes | `resolveRegistryContextForTask` | – |
| Gates applied | yes | `selectableRegistryEntry` (lifecycle, approval, eval, checksum) | – |
| Refs recorded on TaskRun | yes | `createTaskRun` patch in workflow | – |
| Warnings/errors recorded | yes | `registryResolutionWarnings/Errors` on TaskRun + usage metadata | – |
| Audit/history on mutations | yes | `RegistryService.*` appends audit + revision per mutation | – |
| Rollback creates new revision | yes | `RegistryService.rollback` writes new revision and audit log; previous revisions retained | – |
| Dashboard/API displays registry refs | yes | `/registry/*`, dashboard panels | – |

### Flow D — Phase 4 auto-improvement and governance
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Failure signals created | yes | `FailureSignalService.createSignal`, API `POST /improvement/failure-signals` | – |
| Clustered deterministically | yes | `FailureClusteringService.recomputeClusters` (deterministic cluster ids); test "failure clustering is deterministic and recompute does not duplicate clusters" | – |
| Improvement candidate generated | yes | `MockAutoImprovementEngine.generateImprovementCandidate` | – |
| Improvement proposal generated | yes | `MockAutoImprovementEngine.generateImprovementProposal` | – |
| Draft registry change created | yes | `MockAutoImprovementEngine.prepareDraftRegistryChange` (`draftPayload.activeRegistryMutation = false`) | – |
| Readiness checked | yes | `evaluateProposalReadiness` (`blockingReasons` from safety policy + decision + eval + canary + draft change) | – |
| Governance decision recorded | yes | `ProposalGovernanceService.recordDecision` + audit event | – |
| Eval run metadata attached | yes | `ProposalEvalRunService.attachEvalRun` | Metadata only; **no execution**. |
| Canary readiness checked | yes | `CanaryReadinessService.evaluate` | No rollout. |
| Apply gate checked | yes | `ProposalApplyGateService.evaluate` | `canApply` is always false in v1 (`active_apply_not_implemented`). |
| Active registry not mutated automatically | yes | `tests/phase-4-governance-v1.test.ts` "governance decisions update proposal status, create audit events, and do not mutate registry entries" asserts before/after `getSkill` equality. | – |

### Flow E — Persistent storage
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Storage provider selected | yes | `createApiStorageProviderFromEnv` chooses by `AICHESTRA_STORAGE_PROVIDER` | – |
| Repository factory creates repositories | yes | `InMemoryRepositoryFactory` / `PostgresRepositoryFactory` | – |
| In-memory default works | yes | All 95 default tests pass with in-memory | – |
| Postgres provider opt-in | yes | `createPostgresStorageProviderFromEnv` requires `AICHESTRA_DATABASE_URL` | – |
| Migration runner exists | yes | `scripts/db/migrate.mjs` invoked only via `pnpm db:migrate`, never automatically | – |
| Contract tests cover in-memory | yes | `tests/repository-contracts.test.ts` (224 LOC) | – |
| Optional Postgres tests skip/run correctly | yes | Test result shows: "postgres storage provider satisfies repository contracts when a test database URL is configured" reported as **skipped** with: "Set AICHESTRA_TEST_DATABASE_URL to run optional Postgres repository contract tests." | – |
| API health reports storage state | yes | `/health` includes `storage.kind/healthy/message/checkedAt` | – |

### Flow F — Real Git Adapter v0
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Git provider selected | yes | `createGitProviderFromEnv` (mock by default) | – |
| Mock provider default works | yes | `MockGitProvider` returns `mock://` URLs | – |
| Local provider is local-only and safe | yes | `LocalGitProvider.validateRepo` rejects missing/unsafe paths; only `rev-parse|diff|merge-tree|for-each-ref|branch` reads | No fetch/push. Branch create requires explicit `AICHESTRA_ALLOW_LOCAL_BRANCH_CREATE=true`. |
| GitHub provider is gated/skeleton | yes | `GitHubGitProvider`'s every remote method returns a `blocked` audit event with reason `github_provider_network_calls_not_implemented_in_v0`; no SDK imported, no `fetch` call | – |
| Branch/PR records link to TaskRun/BranchLease/MergeQueue | yes | `GitIntegrationService.createBranch` creates `BranchLease`; `createPullRequest` builds a merge-queue entry from the lease's queue fields | – |
| Remote operations blocked by default | yes | Even with `AICHESTRA_GIT_PROVIDER=github`, `remote_git_disabled` returned until `AICHESTRA_ENABLE_REMOTE_GIT=true`, then `github_provider_network_calls_not_implemented_in_v0` | – |
| Audit events recorded | yes | `GitIntegrationService.recordAudit`, `recordProviderAudit` | Token/key/secret keys redacted. |
| Dashboard/API shows Git state | yes | `/git/providers`, `/git/config`, `/git/audit`, dashboard panel | – |

### Flow G — LLM Gateway v0
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Gateway selected | yes | `createDefaultLlmGatewayService` | – |
| Model catalog resolves model | yes | `ModelCatalogService.resolveModelForTask` (deterministic for prompt keywords; deprecated/disabled excluded) | – |
| Virtual key/budget policy checked | yes | `LLMGatewayService.checkBudget` (virtual key status, allowed providers, allowed models, per-task budget, per-key budget) | – |
| Mock provider returns deterministic completion | yes | `MockLLMProvider.createCompletion` returns deterministic content with `mock://`-style metadata | – |
| Usage ledger records provider/model/tokens/cost/taskRunId | yes | `LLMGatewayService.recordUsage` writes `taskId`, `taskRunId`, `provider`, `model`, `inputTokens`, `outputTokens`, `costUsd`, `latencyMs`, `metadata.source=llm_gateway` | – |
| Audit event recorded | yes | `LLMAuditEvent` for `llm_connection_validated`, `llm_model_registered`, `llm_model_status_changed`, `llm_virtual_key_created`, `llm_virtual_key_status_changed`, `llm_completion_blocked`, `llm_completion_succeeded` | `sanitizeMetadata` redacts keys named `*key*`, `*token*`, `*secret*` |
| Remote LLM call blocked by default | yes | `OpenAICompatibleLLMProvider.createCompletion` returns `blocked_remote_llm_disabled` or `openai_compatible_not_implemented`; `validateConnection` likewise | – |
| API/dashboard display provider/model/usage/audit | yes | `/llm/providers|config|models|virtual-keys|route|completions|usage|audit`; dashboard panel | – |

---

## 5. Architecture boundary audit

| Item | Result | Evidence | Recommended fix |
|---|---|---|---|
| API handlers delegate to services/workers | **pass** | `POST /tasks/:id/run` → `runAgentTaskWorkflow`; `/improvement/*` → `improvementServices`; `/registry/*` → `registryService`; `/git/*` → `gitIntegrationService`; `/llm/*` → `llmGatewayService`. | Keep API thin as it grows; introduce OpenAPI/router. |
| Worker/service layer owns execution flow | **warning** | `runAgentTaskWorkflow` is invoked synchronously in the API request. There is no queue. | Extract to a real worker process / queue (BullMQ-like or Temporal stub) before production. |
| Core domain models are provider-agnostic | **pass** | `packages/core/src/domain/models.ts` imports nothing from `adapters` / `llm-gateway` / `git-adapter`. | – |
| Git behavior behind interfaces | **pass** | `GitProvider` interface; mock/local/github implementations behind a factory. | – |
| LLM behavior behind interfaces | **pass** | `LLMProvider` interface; `MockLLMProvider` / `OpenAICompatibleLLMProvider`. | – |
| Merge simulation behind interface | **pass** | `MergeSimulator` interface with mock + local-git implementations. | – |
| Registry storage behind repository interfaces | **pass** | Six separate repository interfaces (`SkillRegistryRepository`, `HarnessRegistryRepository`, `InstructionRegistryRepository`, `RegistryAuditRepository`, `RegistryHistoryRepository`, `RegistryEvalResultRepository`, `RegistryPackageRepository`). | – |
| API DTOs separated from internal domain models | **pass** | DTO mappers everywhere: `skillToDto`, `harnessToDto`, `instructionToDto`, `registryResolutionToDto`, `registryAuditLogToDto`, `registryRevisionToDto`, `registryRollbackResultToDto`, `registryApprovalQueueItemToDto`, `registryEvalResultToDto`, `registryPackageManifestToDto`, `registryImportResultToDto`, `failureSignalToDto`, …, `llmModelToDto`, `virtualModelKeyToDto`, `llmConfigToDto`, `llmCompletionResultToDto`, `llmAuditEventToDto`, `budgetDecisionToDto`. | Apply same DTO discipline to task/queue/conflict APIs for consistency. |
| Persistent DB access behind storage provider/repository factory | **pass** | `StorageProvider`, `RepositoryFactory`, `InMemoryRepositoryFactory`, `PostgresRepositoryFactory`. API does not instantiate Postgres repositories directly; chooses through `createApiStorageProviderFromEnv`. | – |
| Mock adapters remain default | **pass** | `createGitProviderFromEnv` defaults to `MockGitProvider`; `createLlmProviderFromEnv` defaults to `MockLLMProvider`; `createApiStorageProviderFromEnv` defaults to in-memory. | – |
| GitHub provider does not run network calls by default | **pass** | No SDK / `fetch` / `axios` imports in `github-git-provider.ts`. Every remote method returns a `blocked` audit event. | – |
| LLM provider does not run network calls by default | **pass** | No SDK / `fetch` / `axios` imports in `providers.ts`. `OpenAICompatibleLLMProvider` returns `blocked_remote_llm_disabled` / `openai_compatible_not_implemented`. | – |
| Skill/Harness/InstructionArtifact remain separate | **pass** | Different shapes (e.g. `networkPolicy` only on harness, `checksum` only on instruction, `requiredHarnesses` only on skill); separate factories, repositories, services, DTOs, tests. | – |
| Draft registry changes do not mutate active registry | **pass** | `MockAutoImprovementEngine.prepareDraftRegistryChange` writes `DraftRegistryChange.draftPayload.activeRegistryMutation = false`; `tests/phase-4-governance-v1.test.ts` asserts active `Skill` unchanged after a governance decision. | – |
| Proposal governance does not bypass eval/canary/approval gates | **pass** | `evaluateReadinessSnapshot` adds blocking reasons until policy.requireHumanApproval, requireEvalPassed, requireCanary, allowAutoApply, and draftChangeStatus are all satisfied; `ProposalApplyGate.canApply` always includes `active_apply_not_implemented`. | – |
| Dashboard does not contain business logic that should be in services | **warning** | `apps/web/lib/mock-data.ts` and `apps/web/src/render.ts` create their own seeded `createSeededStore()`, run `runAgentTaskWorkflow`, then call into improvement/registry services for fixture data. Also `apps/web/lib/improvement-demo.ts` wires the Phase 4 fixture chain. Tests now use the same fixture so the regression that previously caused a failing dashboard test is fixed. | Move to API/read-model migration (planned). |
| Tests verify behavior, not just snapshots | **pass** | 95 tests across 14 files exercise behavior: state transitions, repeated runs, scoring, simulator local-temp-repo behavior, registry gating, rollback, package import paths, Phase 4 deterministic chains, governance audit, LLM provider blocking, Git provider blocking, storage contract. | – |

---

## 6. Safety and non-goals audit

Search executed: `rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|github|gitlab|bitbucket|bedrock|gemini|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|AICHESTRA_LLM_API_KEY|LLM_API_KEY|git fetch|git push|git rebase|git merge[^_-]|kubectl|vault|temporal|mcp" .` plus targeted searches for `execFile`/`spawn` and `node:child_process`.

Findings (classified):

- **safe types / interfaces**: `ProviderKind`, `LLMProviderKind`, `RepoProvider`, `AgentKind` enums in `packages/core/src/domain/models.ts` and `packages/llm-gateway/src/types.ts`. String literals only.
- **safe documentation references**: README, AGENTS.md, all `docs/*` and `design_docs/*` mention provider names. No code-level imports.
- **safe mocks**: `MockGitProvider` returns `mock://pull-requests/...`; `MockLLMProvider` returns `Mock LLM Gateway completion for ...`; `MockMcpGateway` returns `provider: "mock-mcp"`.
- **safe config placeholders**: `AICHESTRA_LLM_API_KEY`, `AICHESTRA_LLM_BASE_URL`, `AICHESTRA_GITHUB_TOKEN` read in env factories. None are stored in source, none are written to audit metadata (verified via `sanitizeMetadata`).
- **safe local-only git usage**: `LocalGitProvider` and `LocalGitDryRunMergeSimulator` both shell out to `git -C <repoPath>` with read-only commands (`rev-parse`, `diff --name-status`, `diff --name-only`, `for-each-ref`, `merge-tree --write-tree`, `branch <newName> <baseBranch>` only when `AICHESTRA_ALLOW_LOCAL_BRANCH_CREATE=true`). No `fetch`, `push`, `pull`, `remote`, `merge` (non-tree), `rebase`, `reset`, `commit`, `checkout`, or `clean`. `validateRepo` rejects filesystem root and missing paths.
- **gated provider boundary**: `OpenAICompatibleLLMProvider` and `GitHubGitProvider` are skeletons returning blocked reasons; no SDK/`fetch`/`axios` imports anywhere in `packages/llm-gateway/src/` or `packages/adapters/src/git/`.
- **suspicious integration code**: none.
- **actual external calls in default runtime/test**: none.

Postgres CLI safety: `PsqlCliDatabaseClient` shells out to `psql` only when `AICHESTRA_STORAGE_PROVIDER=postgres` is explicitly set; default tests never go down this path (the optional contract suite is *skipped* unless `AICHESTRA_TEST_DATABASE_URL` is configured). `scripts/db/migrate.mjs` is invoked only by the user via `pnpm db:migrate` — never automatically by build/test/app start.

Non-goal compliance status: **clean**. The static lint guard `scripts/lint.mjs` rejects `fetch("https?://...")` and `https.request(` patterns and currently passes.

---

## 7. Validation

Commands run in `/home/einzlth/Projects/aichestra` against the current `main`:

| Command | Result | Output summary |
|---|---|---|
| `pnpm install` | pass | "Already up to date"; `@aichestra/improvement` and other workspace packages linked. |
| `pnpm lint` | pass | `node scripts/lint.mjs` → "lint passed". |
| `pnpm typecheck` | pass | `tsc --noEmit -p tsconfig.typecheck.json` → 0 diagnostics. |
| `pnpm test` | pass | 96 tests, **95 pass, 0 fail, 1 skipped** (the optional Postgres repository-contract test). |
| `pnpm build` | pass | `node scripts/build.mjs` validates 27 required paths (now includes `design_docs/AICHESTRA_BOOTSTRAP.md`, all Phase 4 / real-integration / Postgres / LLM Gateway docs, and `infra/migrations/0001_initial_aichestra_schema.sql`), then `node --check` on the three app entry files. |

Optional-test gating verified:
- **Optional Postgres tests** correctly skipped when `AICHESTRA_TEST_DATABASE_URL` is unset (the test runner emits the skip with a message that names the env var).
- **Remote Git tests**: there is no test that hits a real remote. The GitHub-provider tests assert blocking behavior in the skeleton.
- **Remote LLM tests**: same — the OpenAI-compatible provider tests assert blocked reasons and absence of network calls.

---

## 8. Test coverage audit

### Phase 1
Covered: task creation, run endpoint, mock workflow, policy denial, usage attribution, Skill/Harness/Instruction separation, state machine, repeated-run 409 behavior, instruction precedence, mock LLM usage metadata, registry-driven workflow selection.
Missing: real auth-aware API tests (no auth yet).
Classification: not blocking.

### Phase 2
Covered: file overlap scoring, deterministic risk score, mock workflow blocks high-risk, mark-merged releases lease, mock and local merge simulation (clean + text-conflict + unavailable + tmp-repo isolation), API health, dashboard panel.
Missing: `LocalGitDryRunMergeSimulator` failed branch test; queue-cancellation history.
Classification: nice-to-have.

### Phase 3
Covered: registry domain validation, in-memory and file-backed repositories, DTO shapes, audit log + revision append, approval/eval/checksum gates, history listing, rollback-respects-gates, approval queue read model, eval result attachment, mock RBAC viewer/editor/reviewer/admin, package manifest export, import create-only / replace-draft-only / dry-run, semver range v0, dependency cycles, package diff risk classification.
Missing: file-backed reload across processes; concurrent mutation ordering.
Classification: nice-to-have.

### Phase 4
Covered: failure signal validation, deterministic clustering (recompute idempotent), candidate/proposal generation, draft change creation with `activeRegistryMutation=false`, eval requirement creation, safety policy defaults, proposal review queue inclusion/exclusion, governance decisions, audit events, eval run attachment, canary readiness check, apply gate always blocked, registry-not-mutated regression.
Missing: stronger negative tests for proposal apply (apply endpoint coverage), tests asserting proposal cannot transition to `applied` ever.
Classification: important.

### Persistent DB
Covered: repository contract suite for in-memory, optional Postgres contract suite (skip-or-run by env), health endpoint.
Missing: round-trip test where rows survive a `PsqlCliDatabaseClient` close and reopen; backup/restore behavior (out of v1 scope).
Classification: not blocking.

### Real Git Adapter v0
Covered: provider kind / connection validation; mock branch, PR, changed-file, audit behavior; local fixture changed-file inspection without fetch/push/working-tree mutation; GitHub skeleton remote blocking; service linkage to TaskRun/BranchLease/MergeQueue; API config / repos / branches / PRs / changed-files / audit.
Missing: explicit test for token redaction in audit metadata; explicit test that `AICHESTRA_ALLOW_LOCAL_BRANCH_CREATE=true` actually permits `git branch` without mutating any other branch.
Classification: important.

### LLM Gateway v0
Covered: mock provider deterministic completion + estimate-usage; provider unavailable / model disabled simulation; OpenAI-compatible skeleton blocked-remote validation + completion; model catalog active/deprecated/disabled selection; virtual key policy behavior; budget allow/block; usage ledger integration; API endpoints; audit events.
Missing: explicit test that `sanitizeMetadata` redacts a payload containing a `*_key`/`*_token` field; explicit test of `routeCompletion` against a disabled `virtual_key_disabled` path end-to-end through the API.
Classification: important.

### Strict invariants
- Usage ledger attribution: covered (multiple).
- Local git simulation safety: covered (real-temp-repo isolation test).
- Rollback safety: covered.
- Resolver gates: covered.
- No active registry mutation from drafts: **covered** explicitly in governance v1 test.
- No auto-apply: covered (apply gate always blocked).
- Mock-only compliance: covered by lint guard + behavior tests.

### Top tests to add next
1. End-to-end API regression for the apply endpoint: `POST /improvement/proposals/:id/apply` must return forbidden / not-implemented.
2. Negative test for `LLMAuditEvent` metadata containing `apiKey`/`bearerToken` keys — verify `sanitizeMetadata` emits `[redacted]`.
3. Negative test for `GitProviderAuditEvent` with token-shaped metadata — verify redaction.
4. Negative test for `POST /merge-simulations` with `repoPath` outside the project root.
5. Concurrency test: interleaved registry mutations preserve monotonic `revisionNumber`.

---

## 9. Documentation consistency audit

Accurate docs:
- `README.md` matches code. Lists every endpoint, the LLM Gateway, the Real Git Adapter, Postgres opt-in, and the safety gates.
- `AGENTS.md` rules 59–75 are all enforced in code; spot-checks confirmed.
- `docs/phase-progress-audit.md` reflects the current Phase 4 v1 + LLM Gateway v0 + Real Git Adapter v0 + Persistent DB v1 + Real Integration Foundation v0 state.
- `docs/persistent-db-v1.md`, `docs/real-git-adapter-v0.md`, `docs/llm-gateway-v0.md`, `docs/phase-4-preparation.md`, `docs/phase-4-auto-improvement-v0.md`, `docs/phase-4-governance-v1.md` are all consistent with implementation.
- `docs/final-audit-synthesis.md`, `docs/validation-baseline-repair.md` correctly describe the post-blocker fix (failing dashboard test + build script path).
- `docs/auth-rbac-readiness.md`, `docs/real-git-adapter-v0-readiness.md`, `docs/dashboard-read-model-plan.md`, `docs/real-integration-roadmap.md` are forward-looking design notes; they do not claim implementation.

Stale docs:
- `docs/phase-4-preparation-blocked.md` and `docs/phase-4-v0-blocked.md` describe the pre-fix state. They are accurate as history but should be archived or annotated as "resolved" so a new contributor doesn't think Phase 4 is still blocked.
- `docs/phase-1-2-completion-audit.md` says "phase 4 planned_only" — out of date now that Phase 4 v1 exists. Worth refreshing or stamping as a historical snapshot.

Overclaims production readiness: **none found**. Every relevant doc says "mock-only", "skeleton only", "not production", or "deferred".

Understates limitations: **none found**.

Missing docs:
- No dedicated `docs/local-agent-runner-v0-plan.md` or similar for the recommended next task.
- No OpenAPI / route documentation for the API.
- No dedicated `docs/architecture.md` overview tying all packages together (a `design_docs/AICHESTRA_TECH_STACK_BLUEPRINT.md` exists; a one-page `docs/architecture.md` already exists but is short — it could be refreshed).

Mismatches between phase status and docs: none material.

---

## 10. Production readiness gap

| Capability | Status | Impact | Recommended phase |
|---|---|---|---|
| Real auth/RBAC | missing | API has no authentication. Cannot use beyond a single trusted developer/team. | Phase 5 (planning doc exists in `docs/auth-rbac-readiness.md`). |
| SSO/SCIM | missing | – | Phase 5. |
| Secrets management | missing (mock broker only) | Cannot store provider API keys safely. | Before LLM v1 or Real Git v1. |
| API key storage policy | partial | Explicitly: virtual model keys are not real provider keys. Code does not store real API keys. README and AGENTS.md document this. | Confirm policy when introducing real LLM/Git. |
| Provider credential handling | missing | `AICHESTRA_LLM_API_KEY`, `AICHESTRA_GITHUB_TOKEN` are env-only placeholders. | Before LLM v1 / Real Git v1. |
| Sandboxing | missing | No agent execution sandbox. | Before Local Agent Runner v0 enables real execution. |
| Network egress controls | missing | Egress is governed by env flags + skeleton blocking, not network policy. | Phase 5. |
| Policy-as-code | missing | Policy engine is a simple `MockPolicyEngine`. | Phase 5 / between Real Git v1 and Real LLM v1. |
| Real provider observability | partial | LLM/Git audit events exist; no external sink. | Phase 5. |
| Audit export | missing | Audit lives in repository tables only. | Phase 5. |
| Backup/restore | missing | Postgres provider has no backup story. | Before any production deployment. |
| DB pooling/operations | missing | `PsqlCliDatabaseClient` spawns `psql` per query — not production-grade. | Before any production deployment. |
| Migrations in production | partial | Manual `pnpm db:migrate` only. No environment-aware migration governance. | Before any production deployment. |
| Signed artifacts | missing | Registry packages are unsigned local JSON. | Phase 5. |
| Artifact provenance/SBOM | missing | – | Phase 5. |
| Real artifact registry | missing | Local JSON manifests only. | Phase 5. |
| Dashboard API-backed read models | missing | Dashboard renders by running workflows. | Important next step (plan exists). |
| Async worker / queue engine | missing | `runAgentTaskWorkflow` runs synchronously in API process. | Before any moderate concurrency. |
| CI/CD / deployment | missing | No deployment IaC. | Phase 5. |
| Real eval execution | missing | Phase 4 Governance v1 only attaches eval metadata. | Phase 4 v2+. |
| Canary rollout execution | missing | Phase 4 Governance v1 only checks readiness. | Phase 4 v2+. |
| Human approval workflow | partial | Decision records exist; no workflow integration. | Phase 4 v2 / Phase 5. |
| MCP Gateway governance | missing | Mock only. | Phase 5. |
| Prompt/tool-call redaction | partial | `LLMAuditEvent` metadata redacted; no transcript redaction layer. | Before real LLM. |

---

## 11. Readiness ratings

### Internal prototype readiness — **ready**
The mock-first vertical slice is fully implemented and tested, validation is green, the dashboard renders, and integration foundations (Persistent DB, Real Git Adapter, LLM Gateway) all exist as gated skeletons with deterministic tests. A small team can demo and develop on it today.

### Internal MVP readiness — **mostly_ready**
For a small internal team using the system with shared state, several gaps remain:
- Synchronous worker still runs inside the API process.
- Dashboard does not consume API/read-model data.
- No API auth (anyone with network access can hit `/registry/*`, `/git/*`, `/llm/*`, `/improvement/*`).
- Persistent DB is opt-in; default in-memory means state is lost on restart.
- `PsqlCliDatabaseClient` is functional but not production-grade.

None of these are design defects — they are simply next-step work documented in the roadmap.

### Real integration readiness — **ready_for_gated_implementation**
LLM Gateway v0 and Real Git Adapter v0 have clean provider boundaries and skeleton implementations. Persistent DB v1 has a working storage abstraction. The next concrete real-integration tasks (Real Git Adapter v1, Real LLM Gateway v1, Local Agent Runner v0) can each be done behind explicit env gates without disturbing the mock-first baseline.

Conditions before opening any real network call:
- Add a request-auth layer in `apps/api` and bind audit events to real actor ids.
- Decide on a real secrets store (or at least a single env-secret loader with auditing).
- Confirm production-DB plan (async driver, pooling) is at least sketched.

### Production readiness — **not_ready**
By design. See Section 10. No real auth, no secrets manager, no sandbox, no policy-as-code, no real provider calls, no signed artifacts, no deployment IaC, no audit export, no backup/restore, no async worker/queue, no production-grade DB pooling, no Phase 4 eval/canary executor, no MCP integration.

---

## 12. Final blockers and recommendations

### Critical blockers
None. Validation is green; the architecture is coherent; no safety regression was found.

### Important follow-ups (before opening any real network call)
1. **API authentication + actor resolution.** Today, every mutating endpoint accepts unauthenticated requests with a `mock-admin` actor. Wire a thin middleware that resolves an `Actor`, plumb it through `RegistryService`, `GitIntegrationService`, `LLMGatewayService`, and `ImprovementServices`, and bind it into audit events.
2. **Dashboard read-model migration.** Move `apps/web/lib/mock-data.ts` + `improvement-demo.ts` from in-process workflow execution to consuming the API (or a server-side read model). Plan in `docs/dashboard-read-model-plan.md`.
3. **Async worker boundary.** Split `runAgentTaskWorkflow` from the API request lifecycle.
4. **Postgres async driver path.** Replace `PsqlCliDatabaseClient` with a pooled Node Postgres client (or document the boundary so adopters know not to use `psql` in production).
5. **Refresh historical docs.** Mark `docs/phase-4-preparation-blocked.md`, `docs/phase-4-v0-blocked.md`, and `docs/phase-1-2-completion-audit.md` as historical snapshots so they don't mislead.
6. **Add the test gaps in Section 8** (apply endpoint negative test, audit redaction test, virtual-key-disabled E2E, repoPath escape test).

### Nice-to-have
- OpenAPI spec for `/tasks`, `/conflicts`, `/merge-queue`, `/merge-simulations`, `/registry/*`, `/improvement/*`, `/git/*`, `/llm/*`.
- Stable DTO mappers for task/queue/conflict APIs to match registry/improvement/git/llm DTO discipline.
- Branch-lease expiration and queue history.
- `LocalGitDryRunMergeSimulator` `failed` branch coverage.
- Pre-commit lint guard installation.

### Next recommended task

**Local Agent Runner v0** is the recommended next task.

Rationale:
- Phase 1–4 v1 and the three integration foundations (Persistent DB, Real Git Adapter, LLM Gateway) are in place and tested.
- The current `MockAgentRunner` is the loudest remaining mock for a developer trying to use the system "for real" — it returns static `src/auth/session.ts` patches. Replacing it with a local sandboxed runner (with explicit gates) yields the largest jump in perceived usefulness.
- The roadmap (`docs/real-integration-roadmap.md`, README "Next Steps" #1) already lists this as the next step.
- The runner only needs `LLMGatewayService` (already mock-safe), `LocalGitProvider` (already safe), and a sandbox decision — no new auth or secrets work is strictly required for v0.

Sequence after Local Agent Runner v0:
- Real Git Adapter v1 (controlled GitHub branch/PR creation behind explicit env gates) **only if** an integration-test environment justifies it.
- Dashboard read-model migration.
- API auth/RBAC.

---

Final Summary

Design conformance:
The current implementation **follows the original design**. All major design elements (Aichestra Control Plane, Task Orchestrator, LLM Gateway, Conflict Manager, Skill/Harness/Instruction Registries, Auto-improvement with proposal/eval/canary/approval gates, Persistent DB, Real Git Adapter, Audit, Policy) are present at gated v0/v1 stages and respect the mock-first, draft-only, gated-real-integration discipline encoded in AGENTS.md. Twenty-five design elements were inspected; 23 pass, 1 partial (dashboard separation), 1 explicit fail-by-design (production auth/RBAC, planned). No undeclared real network calls were found.

Current phase status:
- Phase 1: complete_for_current_milestone
- Phase 2: complete_for_current_milestone (v1 surface in place)
- Phase 3: v3_implemented
- Phase 4: v1_implemented (Preparation + Auto-improvement v0 + Governance v1)
- Phase 5: planned_only
- Persistent DB: v1_implemented (opt-in)
- Real Git Adapter: v0_implemented (gated skeleton)
- LLM Gateway: v0_implemented (gated skeleton)

Validation:
- install: pass
- lint: pass
- typecheck: pass
- test: pass (95 pass, 1 skipped — optional Postgres contract suite)
- build: pass

Safety compliance:
Clean. No real LLM, GitHub/GitLab/Bitbucket, MCP, Vault, K8s, Temporal, or artifact-registry calls in default runtime/test. `OpenAICompatibleLLMProvider` and `GitHubGitProvider` are skeletons with no SDK imports. `LocalGitProvider` and `LocalGitDryRunMergeSimulator` use `git -C <caller-supplied path>` with read-only commands and explicit safe-path validation. `PsqlCliDatabaseClient` only activates when `AICHESTRA_STORAGE_PROVIDER=postgres`. Optional Postgres tests skip when the env var is unset. Virtual model keys carry no provider secrets. `sanitizeMetadata` redacts token/key/secret-shaped audit fields. Auto-improvement is draft-only with `allowAutoApply=false` and an apply gate that always blocks.

Internal prototype readiness:
ready — vertical slice and integration scaffolds are testable end to end.

Internal MVP readiness:
mostly_ready — needs API auth, dashboard read-model, async worker, and a confirmed persistent-DB plan before a small internal team can rely on it.

Real integration readiness:
ready_for_gated_implementation — provider boundaries are clean and skeletons are deterministic. Open real network calls only after API auth, secrets handling, and observability are wired.

Production readiness:
not_ready — by design. Real auth/RBAC, real secrets, sandbox, policy-as-code, signed artifacts, real provider integrations, async worker/queue, production DB driver, audit export, backup/restore, deployment IaC, MCP, eval/canary executor, and Phase 5 enterprise features are all explicitly future work.

Critical blockers:
None.

Important follow-ups:
1. API authentication + actor resolution wiring across registry/improvement/git/llm services.
2. Dashboard read-model migration off in-process workflow execution.
3. Async worker boundary for `runAgentTaskWorkflow`.
4. Postgres async/pooled driver before any production deployment.
5. Archive or annotate historical blocked/phase-1-2 audit docs.
6. Add the specific Section 8 test gaps (apply endpoint, audit-metadata redaction, virtual-key-disabled E2E, repoPath escape).

Recommendation:
The architecture and phase progress are coherent and mock-first safety is intact. Continue with the next planned task; do not pause for refactors.

Next recommended task:
**Local Agent Runner v0** — implement a deterministic local agent runner behind a `LocalAgentRunner` interface, wire it into the existing workflow via `agentRunner`, keep `MockAgentRunner` as the default, and add behavior tests proving (a) usage ledger still records per task/run, (b) no real LLM calls happen by default, and (c) generated diff/changed-file output flows into the existing Conflict Manager and Merge Queue pipeline without bypassing registry gates.
