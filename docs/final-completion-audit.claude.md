# Aichestra Final Completion Audit (Claude)

Auditor: Claude (independent re-audit, no Codex assumptions trusted)
Date: 2026-05-11
Mode: audit-only. No application code, registries, or integrations were modified.

CLAUDE.md was not present, so AGENTS.md was read directly. README.md and all referenced docs in `docs/` and `design_docs/` were inspected. The doc named `AICHESTRA_BOOTSTRAP.md` lives at `design_docs/AICHESTRA_BOOTSTRAP.md`, not at the repo root (significant — see Section 9 and 11).

---

## 1. Independent executive assessment

- Judgment: **pass_with_important_followups**
- Confidence: **high**
- Docs vs code: **mostly agree, with one notable mismatch**. The docs (README, `docs/phase-progress-audit.md`, `docs/phase-3-completion-gap.md`) describe Phase 1, Phase 2 v1 Conflict Manager, and Phase 3 v3 Registry capabilities that are in fact implemented in code. However the docs report "validation passing" while validation does not pass today: `pnpm test` fails 1/68 tests (dashboard fixture), and `pnpm build` fails because `scripts/build.mjs` requires `AICHESTRA_BOOTSTRAP.md` at the repo root but the file lives under `design_docs/`.
- Mock-first: **yes**. No runtime calls to real LLM, Git host, MCP, secrets, Kubernetes, Temporal, or artifact registries were found. The only outbound process call is `git -C <repoPath>` from `LocalGitDryRunMergeSimulator`, restricted to caller-supplied local paths, with no fetch/push/branch mutation.
- Production-readiness claims: **none overstated in critical places**. README explicitly says "MVP scaffold... mock-first". `docs/phase-progress-audit.md` correctly states "not production-ready". `Mock RBAC is not production auth` is encoded in `AGENTS.md` rule 51.
- Safe to proceed to real integration planning: **yes, after fixing the two validation regressions** (failing dashboard test + missing-bootstrap build script).

---

## 2. Phase-by-phase verification

### Phase 1 — Task orchestration, registry-backed selection, mock vertical slice
- Status: **complete_for_current_milestone**
- Evidence:
  - `packages/core/src/domain/models.ts` (`Task`, `TaskRun`, `UsageEvent`, etc.)
  - `packages/core/src/domain/status.ts` (status machine + transitions)
  - `apps/worker/src/workflows/run-agent-task-workflow.ts` (end-to-end mock workflow)
  - `apps/api/src/main.ts` `POST /tasks`, `POST /tasks/:id/run`, `GET /tasks/:id`, `GET /usage`, `GET /audit-logs`
  - `packages/adapters/src/llm/mock-llm-gateway.ts`, `packages/llm-gateway/src/model-router.ts`
  - `packages/runner/src/mock-agent-runner.ts`, `test-runner.ts`
  - `packages/db/src/repository.ts`, `usage-ledger.ts`
  - `apps/web/src/render.ts`, `apps/web/app/page.tsx`
  - Tests: `tests/mock-workflow-vertical-slice.test.ts`, `tests/task-state-machine.test.ts`, `tests/api-health.test.ts`, `tests/mock-llm-gateway.test.ts`
- Implemented capabilities: Task/TaskRun lifecycle, mock policy, mock model selection, mock skill/harness/instruction selection (now via registry resolver), mock branch creation, mock agent run, mock diff summary, mock tests, mock PR, usage ledger with `taskId`/`taskRunId` attribution, mock cost, dashboard.
- Missing capabilities: no async queue between API and worker (`POST /tasks/:id/run` is synchronous and runs the workflow in-process); no DB persistence (in-memory store only); no auth on API; no real provider gateway.
- Blocks current milestone: **no**.
- Blocks production: **yes** (persistence, auth, async execution, real providers).

### Phase 2 — Conflict Manager v1 (file overlap + local dry-run merge simulation + queue)
- Status: **v1_implemented** / **complete_for_current_milestone**
- Evidence:
  - `BranchLease`, `ConflictRisk`, `MergeQueueEntry`, `MergeSimulationResult`, `MergeSimulationStatus`, `MergeSimulationMode` in `packages/core/src/domain/models.ts`
  - `MergeSimulator` interface in `packages/core/src/conflicts/interfaces.ts`
  - File-overlap scoring + simulation-aware combine in `packages/core/src/conflicts/scoring.ts` (`computePairRiskScore`, `combineSimulationRisk`, `mergeQueueDecision`)
  - `MockMergeSimulator` and `LocalGitDryRunMergeSimulator` in `packages/adapters/src/git/merge-simulators.ts`. Local simulator only uses `git -C <repoPath> rev-parse|diff|merge-tree --write-tree` and explicitly returns `unavailable` if `repoPath` is absent — no `fetch`/`push`/`branch -m`.
  - Output sanitization: `sanitizeOutput` redacts the absolute repo path and truncates to 2000 chars.
  - `apps/api/src/main.ts` exposes `GET /branches/leases`, `GET /conflicts/risks`, `GET /merge-queue`, `POST /merge-queue/:id/mark-merged`, `POST /merge-queue/:id/cancel`, `GET|POST /merge-simulations`.
  - Tests: `tests/conflict-risk-scoring.test.ts`, `tests/merge-simulators.test.ts` (incl. LocalGitDryRunMergeSimulator real-temp-repo path), `tests/mock-git-conflict-risk.test.ts`, queue-status tests in `tests/mock-workflow-vertical-slice.test.ts`.
- Implemented: deterministic file-overlap risk; risk levels and recommendations; mock + local dry-run merge simulation; queue recommendation derived from risk + simulation; dashboard surface.
- Missing: rebase-needed detection, AST/symbol overlap, semantic conflict hints, test-impact analysis, queue history table, conflict-resolver agent handoff, real-provider merge automation (intentionally deferred).
- Blocks current milestone: **no**.
- Blocks production: **yes** for full Phase 2; not for the v1 milestone advertised.

### Phase 3 — Skill / Harness / Instruction Registry (v3 packaging)
- Status: **v3_implemented**
- Evidence:
  - `packages/core/src/domain/models.ts` keeps `SkillPackage`, `HarnessDefinition`/`HarnessPackage`, `InstructionArtifact`, `RegistryVersionRef`, `RegistryDependency`, `RegistryResolution`, `RegistryAuditLogEntry`, `RegistryRevision`, `RegistryRollbackRequest/Result`, `RegistryApprovalQueueItem`, `RegistryEvalResult`, `RegistryActor`, `MutationAuthorizationDecision`, `RegistryPackageEntry`, `RegistryPackageDependency`, `RegistryPackageManifest`, `RegistryPackageDiff`.
  - `packages/registry/src/index.ts` (2970 LOC): repository interfaces, `InMemoryRegistryRepository`, `FileBackedRegistryRepository`, DTO mappers (`skillToDto`/`harnessToDto`/`instructionToDto`/`registryResolutionToDto`/`registryAuditLogToDto`/`registryRevisionToDto`/`registryRollbackResultToDto`/`registryApprovalQueueItemToDto`/`registryEvalResultToDto`/`registryPackageManifestToDto`/`registryImportResultToDto`), `RegistryService` (CRUD + status/approval/eval gates + checksum verify + rollback + approval queue + eval result attach + package export/import + dry-run import + manifest diff + semver-range resolution), `MockRegistryMutationAuthorizer` with role→permission map, `defaultRegistryActor`.
  - Resolver `resolveRegistryContextForTask` enforces lifecycle (`active`), approval (`approved`/`not_required`), eval (`passed`/`not_required`), checksum (`!= mismatch`) gates and emits deterministic warnings/errors. Dependency resolution detects cycles.
  - Semver range parsing supports exact, `^`, `~`, `N.x`, and `latest`. Stronger ranges/full semver are intentionally not supported (AGENTS.md rule 46).
  - Workflow records `selectedSkillRefs`/`selectedHarnessRef`/`selectedInstructionRefs`/`registryResolutionWarnings`/`registryResolutionErrors` on `TaskRun` and includes them in usage metadata.
  - API surface in `apps/api/src/main.ts`: `/registry/{skills,harnesses,instructions}` CRUD/status/approval/eval/verify-checksum/history/rollback/eval-results/manifest; `/registry/audit`, `/registry/approval-queue`, `/registry/packages` list/export/import/import/dry-run/diff, `/registry/bundle/manifest`, `/registry/resolve`.
  - Mock RBAC is enforced through `RegistryMutationAuthorizer`; `RegistryAuthorizationError` raised on insufficient permission. Default actor is `mock-admin`.
  - Append-only history + rollback: rollback creates a NEW revision rather than deleting; `tests/registry-hardening-v1.test.ts` and `tests/registry-operational-hardening-v2.test.ts` verify this.
  - Local package import respects `create_only` and `replace_draft_only`, refuses to overwrite non-draft active entries.
  - Tests: `registry-v0.test.ts`, `registry-hardening-v1.test.ts`, `registry-operational-hardening-v2.test.ts`, `registry-packaging-v3.test.ts` (13k LOC across these four files).
- Implemented: all v0/v1/v2/v3 capabilities listed in AGENTS.md.
- Missing: real DB-backed persistence, signed artifacts, full multi-user approval workflow, real eval runner, full semver, real SSO/SCIM/auth, real artifact registry.
- Blocks current milestone: **no**.
- Blocks production: **yes**.

### Phase 4 — Auto-improvement
- Status: **not_started** (planned_only; explicitly **blocked** in `docs/phase-4-preparation-blocked.md` and `docs/phase-4-v0-blocked.md`).
- Evidence:
  - `rg -n "FailureSignal|FailureCluster|ImprovementCandidate|ImprovementProposal|EvalRequirement|CanaryRolloutPlan|AutoImprovementSafetyPolicy|DraftRegistryChange|ProposalReadiness|AutoImprovementAnalysis"` over `packages/`, `apps/`, `tests/` returns 0 hits.
  - `docs/phase-4-preparation.md` and `docs/phase-4-auto-improvement-v0.md` are absent. Only the `*-blocked.md` placeholders exist.
- Implemented capabilities: none.
- Missing capabilities: failure signals, clusters, candidates, proposals, eval requirements, canary plans, safety policy, draft-only mutation gate, mock auto-improvement engine, dashboard surface.
- Blocks current milestone: **yes for advancing to Phase 4**, no for the project's current milestone (Phase 3 v3).
- Blocks production: yes.

### Phase 5 — Enterprise / production
- Status: **planned_only**
- Evidence: `docs/security-model.md`, references in `AGENTS.md` (mock RBAC, mock secrets, mock MCP). No real auth, SSO, SCIM, signed artifacts, policy-as-code engine, sandbox, secret broker, deployment IaC.
- Missing: real OAuth/SSO/SCIM, audit export, policy-as-code, secrets/Vault, sandbox runtime, real provider governance, artifact signing, real deployment manifests, data residency.
- Blocks production: **yes** (this is what production-readiness *is*).

---

## 3. End-to-end flow audit

### Flow A: Task orchestration
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Task created | yes | `InMemoryAichestraStore.createTask` (repository.ts:129–142) via `POST /tasks` (main.ts:503–505) | In-memory only. |
| TaskRun triggered | yes | `POST /tasks/:id/run` → `runAgentTaskWorkflow` (main.ts:524–535; workflow.ts:54–) | Synchronous; no queue. |
| Policy checked | yes | `MockPolicyEngine.evaluateTask` (workflow.ts:111–130) | Simple budget+critical-path checks only. |
| Model selected | yes | `MockModelRouter.selectModel` (workflow.ts:104–109) | Deterministic mock. |
| Skill selected | yes | `registryService.resolveRegistryContextForTask` (workflow.ts:88–102) | Through registry resolver. |
| Harness selected | yes | Same resolver call; `selectedHarness` derived from registry. | Resolver may warn if requested item gated out. |
| Instruction selected | yes | `assembleInstructionSet` (workflow.ts:178–186) | Checksum recorded; verification optional. |
| Branch created | yes | `MockGitProvider.createBranch` (workflow.ts:146–155) | Mock only. |
| Agent run simulated | yes | `MockAgentRunner.run` (workflow.ts:189–201) | Deterministic. |
| Diff summary | yes | `agentRun.diffSummary` recorded onto `TaskRun` (workflow.ts:319–327) | Static text. |
| Mock tests pass | yes | `MockTestRunner.run` (workflow.ts:247–252) | Simulated. |
| Mock PR created | yes | `MockGitProvider.createDraftPullRequest` (workflow.ts:276–283) | `mock://` URL. |
| Usage ledger recorded | yes | `usageLedger.record` with full ref metadata (workflow.ts:202–216) | Good attribution. |
| Task completed | yes | Final state transition (workflow.ts:312–331) | Branches to `conflict_detected`/`review_required` as expected. |
| Dashboard displays result | yes | `apps/web/src/render.ts` and `apps/web/app/page.tsx` | **Warning**: dashboard runs its own seeded store/workflow at render time rather than consuming the API; tests fail when the fixture conflicts with resolver gates (see Section 7). |

### Flow B: Conflict management
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Lease created | yes | `store.createBranchLease` (workflow.ts:217–228) | files/symbols/tests populated. |
| Changed files tracked | yes | `agentRun.changedFiles` → `BranchLease.files` | – |
| Conflict risk calculated | yes | `computeRepoConflictRisks` / `computeConflictRisksForLease` (repository.ts:296–323) using `createConflictRisk` | Symmetric, deterministic. |
| Merge simulation performed | yes | `MockMergeSimulator` default; `LocalGitDryRunMergeSimulator` available via API (`POST /merge-simulations`) | Local simulator is bounded to caller `repoPath`; verified clean/text_conflict/unavailable in tests. |
| Merge queue entry updated | yes | `mergeQueueFieldsForLease` + `recordMergeSimulation` refresh queue (repository.ts:257–268, 329–349, 440–444) | – |
| Recommendation generated | yes | `mergeQueueDecision` (scoring.ts:236–291) | Covers text_conflict/unavailable/failed/low/medium/high. |
| Dashboard/API displays risk | yes | `GET /conflicts/risks`, `GET /merge-queue`, dashboard sections | – |

### Flow C: Registry selection
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Task run requests registry context | yes | `registryService.resolveRegistryContextForTask` (workflow.ts:88–92) | – |
| Resolver chooses Skill/Harness/Instruction | yes | `resolveRegistryContextForTask` (registry/index.ts:1264–1296) | Keyword-based defaults. |
| Lifecycle/approval/eval/checksum gates applied | yes | `selectableRegistryEntry` (registry/index.ts:998–1009) | – |
| Selected refs recorded on TaskRun | yes | `store.createTaskRun` patch (workflow.ts:157–174) | – |
| Warnings/errors recorded | yes | `registryResolutionWarnings`/`Errors` on TaskRun + usage metadata | – |
| Dashboard/API displays registry refs | yes | render.ts panel + `/tasks/:id` API response | – |

### Flow D: Registry operations
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Create/update registry item | yes | `RegistryService.createSkill/Harness/Instruction`, `updateXStatus/Approval/Eval` (registry/index.ts:2054–2313) | Mock RBAC enforced before mutation. |
| Audit log created | yes | `this.appendAudit(...)` after every mutation; `RegistryAuditRepository` | – |
| Revision created | yes | `appendRevisionForEntity` and `ensureInitialRevision` (registry/index.ts:2760–2787) | Append-only. |
| Approval/eval/checksum status considered | yes | `selectableRegistryEntry` gating, `approvalQueueBlockingReasons` | – |
| History query works | yes | `GET /registry/skills/:id/history` etc., `listRevisionsForTarget` | – |
| Rollback creates new revision | yes | `RegistryService.rollback` (registry/index.ts:2348–2390) writes a new revision and audit log; old revisions remain. | – |
| Resolver applies normal gates after rollback | yes | Restored entity goes through the same `selectableRegistryEntry` gate; covered by `tests/registry-hardening-v1.test.ts` ("rollback respects resolver gates after restored state"). | – |

### Flow E: Auto-improvement v0
| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Failure signals created | no | No `FailureSignal` type or table | Phase 4 not started. |
| Clustered deterministically | no | No `FailureCluster` | – |
| Improvement candidate generated | no | – | – |
| Improvement proposal generated | no | – | – |
| Draft registry change created | no | – | – |
| Readiness checked | no | – | – |
| Safety policy blocks auto-apply | n/a | No safety policy exists, but no auto-apply path exists either, so the invariant holds vacuously. | – |
| Active registry not mutated | yes (by absence) | No code path that auto-mutates active registry from any signal | – |

---

## 4. Safety and non-goals audit

Search executed:
```
rg -n "fetch\(|axios|Octokit|openai|anthropic|claude|github\.com|gitlab|bitbucket|bedrock|gemini|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|kubectl|vault|temporal|mcp[^_]|git fetch|git push" packages apps
```
Findings (classified):

- **safe types/interfaces** — `ProviderKind = "openai" | "anthropic" | ...`, `AgentKind = "codex" | "claude-code" | ...`, `RepoProvider = "github" | "gitlab" | "bitbucket" | ...` in `packages/core/src/domain/models.ts`. Enum values only.
- **safe seed data** — `compatibleAgents: ["codex", "claude-code", "aider"]` and similar in `packages/core/src/registries/seed-data.ts`. String literals, no SDK imports.
- **safe mocks** — `packages/adapters/src/mcp/mock-mcp-gateway.ts` (`provider: "mock-mcp"`), `mock-llm-gateway.ts` (`provider: "mock"`), `mock-git-provider.ts` (`mock://pull-requests/...`).
- **safe local-only git** — `packages/adapters/src/git/merge-simulators.ts` runs `git -C <repoPath> rev-parse|diff|merge-tree --write-tree`. No `fetch`, `push`, `pull`, `remote add`, `commit`, `branch -m`. `repoPath` is required from the caller, sanitized in command metadata.
- **suspicious** — none.
- **actual external call** — none.

Lint script `scripts/lint.mjs` enforces `!/fetch\(\s*["']https?:\/\//.test(text) && !/https\.request\(/.test(text)` across all `.ts/.tsx/.mjs` files — a static guard against runtime HTTP. `pnpm lint` passes today.

Non-goal compliance: clean. The project does not call real OpenAI/Anthropic/Gemini/Bedrock, real GitHub/GitLab/Bitbucket, MCP servers, Vault, Kubernetes, Temporal, or real artifact registries. It does not auto-apply proposals (there are no proposals).

One nuance worth flagging, not a violation: the `LocalGitDryRunMergeSimulator` shells out to the user's `git` binary. Inputs to `execFile` are passed as a fixed argument list (not via shell), so injection vectors via `repoPath` are limited — but a malicious `repoPath` could still point at arbitrary filesystem locations the process can read. AGENTS.md rule 43 explicitly allows this for "explicitly supplied local repositories or test fixtures". Recommend documenting that the API endpoint `POST /merge-simulations` accepts `repoPath` from the client unauthenticated — fine while there is no production auth, but a path-allowlist gate will be needed before this becomes a service.

---

## 5. Architecture quality audit

| Item | Result | Evidence | Recommended fix |
|---|---|---|---|
| API boundary | pass | `apps/api/src/main.ts` is a thin HTTP front using `node:http`; delegates orchestration to `runAgentTaskWorkflow`. | Add OpenAPI/typed router as it grows. |
| Service/worker boundary | warning | `apps/worker` exists, but `POST /tasks/:id/run` calls `runAgentTaskWorkflow` inline in the API process. There is no queue or worker process. | Add a queue (BullMQ / Temporal stub) so the worker is genuinely separate. |
| Core domain purity | pass | `packages/core` has no provider SDK imports; only `node:crypto`. | – |
| Provider abstraction | pass | `LlmGateway`, `ModelRouter`, `GitProvider`, `MergeSimulator`, `PolicyEngine`, `AgentRunner`, `TestRunner` are interfaces; mocks implement them. | – |
| Registry repository boundary | pass | Separate `Skill/Harness/Instruction/Audit/History/EvalResult/Package` repository interfaces in `packages/registry/src/index.ts`. | – |
| DTO boundary | pass | Stable `*Dto` types and mapper functions on every registry response. | Apply same DTO pattern to task/queue/conflict APIs for consistency. |
| Audit/history consistency | pass | Every mutation appends both an audit log entry and a registry revision; rollback writes a new revision. | – |
| Deterministic testing | pass | `node --test` runner with explicit fixtures; conflict scoring tests assert byte-for-byte order; rollback tests are append-only. | – |
| Dashboard separation | **fail** | `apps/web/lib/mock-data.ts` and `apps/web/src/render.ts` create their own `createSeededStore()` and execute `runAgentTaskWorkflow` at render time rather than consuming the API. The failing test in Section 7 is caused by this design. | Have the dashboard consume `/tasks`/`/registry/*` endpoints (or a thin read model) and keep `mock-data.ts` only for tests. |
| No hidden global state | pass | Each request constructs its own store/service. | – |
| No accidental production behavior | pass | No real provider clients, no real auth, no real deployment hooks. | – |
| Clear naming | pass | `Skill`/`Harness`/`Instruction` consistently distinct; `Mock*` prefix for adapters. | – |
| Skill/Harness/InstructionArtifact separation | pass | Separate domain types, factories, registry interfaces, DTOs, tests. Verified by `registry-v0.test.ts` "Skill, Harness, and Instruction records stay separate". | – |
| Proposal vs applied change separation | n/a | No proposal layer yet. | When added, keep `DraftRegistryChange` in a separate table from active registry. |
| Mock auth vs real auth separation | pass | `MockRegistryMutationAuthorizer`, comment "mock RBAC is not production auth" in `AGENTS.md`; no `req.user` plumbing into the HTTP layer. | Add explicit `requireRealAuth` plug in `apps/api` so the gap is visible. |

Architecture warnings: 1 (dashboard separation). No fail-blockers.

---

## 6. Data model audit

| Model family | Status | Evidence | Coherent? | Tests cover it? |
|---|---|---|---|---|
| Task / TaskRun / UsageLedger | present | `Task`, `TaskRun`, `UsageEvent` in models.ts; `MockUsageLedger` in `packages/db/src/usage-ledger.ts`; Prisma schema in `packages/db/prisma/schema.prisma`. | yes | yes (`mock-workflow-vertical-slice.test.ts`, `task-state-machine.test.ts`, `mock-llm-gateway.test.ts`). |
| BranchLease / ConflictRisk / MergeQueueEntry / MergeSimulationResult | present | All four in models.ts; persistence on `InMemoryAichestraStore`; risk types `ConflictRiskLevel`, `MergeQueueStatus`, `MergeSimulationStatus`. | yes | yes (`conflict-risk-scoring.test.ts`, `merge-simulators.test.ts`, `mock-git-conflict-risk.test.ts`, `mock-workflow-vertical-slice.test.ts`). |
| SkillPackage / HarnessDefinition / InstructionArtifact | present | Separate types in models.ts with disjoint fields (`requiredHarnesses` only on skill; `networkPolicy` only on harness; `checksum` only on instruction). | yes | yes (`registry-v0.test.ts`, `registry-hardening-v1.test.ts`). |
| RegistryResolution / RegistryVersionRef | present | models.ts + resolver in registry/index.ts. | yes | yes (`registry-v0.test.ts`, `registry-hardening-v1.test.ts`, `registry-operational-hardening-v2.test.ts`). |
| RegistryAuditLogEntry / RegistryRevision / RegistryRollbackRequest+Result | present | models.ts; service methods; `/registry/audit`, `/registry/.../history`, `/registry/.../rollback`. | yes | yes (`registry-hardening-v1.test.ts`, `registry-operational-hardening-v2.test.ts`). |
| RegistryPackageManifest / RegistryPackageEntry / RegistryPackageDiff | present | models.ts; `createRegistryPackageManifest`, `diffRegistryStructures`, import/export service methods; API endpoints. | yes | yes (`registry-packaging-v3.test.ts`). |
| FailureSignal / FailureCluster | **missing** | No source occurrences. | n/a | no. |
| ImprovementCandidate / ImprovementProposal | **missing** | No source occurrences. | n/a | no. |
| EvalRequirement / CanaryRolloutPlan | **missing** | No source occurrences. | n/a | no. |
| AutoImprovementSafetyPolicy | **missing** | No source occurrences. | n/a | no. |
| AutoImprovementAnalysis / DraftRegistryChange / ProposalReadiness | **missing** | No source occurrences. | n/a | no. |

Phase 1–3 data model: coherent and well-tested. Phase 4 data model: entirely absent.

---

## 7. Validation

Commands run from `/home/einzlth/Projects/aichestra`:

| Command | Result | Output summary |
|---|---|---|
| `pnpm install` | pass | 3 packages newly added, 11 workspace packages linked. No network for runtime deps; `@types/node@24.12.3` + `typescript@5.9.3` only. |
| `pnpm lint` (`node scripts/lint.mjs`) | pass | "lint passed". Whitespace + JSON syntax + "no `fetch("https?://`" guard. |
| `pnpm typecheck` (`tsc --noEmit -p tsconfig.typecheck.json`) | pass | No diagnostics. |
| `pnpm test` (`node --test` on all `*.test.ts`) | **fail** | 68 tests, 67 pass, 1 fail. Failing test: `tests/dashboard-data.test.ts:6` — `data.registryVersionResolution.selected?.version` is `undefined`, expected `"1.0.0"`. Cause is documented in `docs/phase-4-preparation-blocked.md`: dashboard fixture marks `auth-debugging` approval as `pending`, then resolves `auth-debugging@^1.0.0`; resolver correctly excludes pending entries. |
| `pnpm build` (`node scripts/build.mjs`) | **fail** | `ENOENT: no such file or directory, access '/home/einzlth/Projects/aichestra/AICHESTRA_BOOTSTRAP.md'`. The file lives at `design_docs/AICHESTRA_BOOTSTRAP.md`. `scripts/build.mjs:7` lists `AICHESTRA_BOOTSTRAP.md` as a required root path. |

Net: **install/lint/typecheck pass; test 67/68; build is broken because of a stale path in the validation script**, not because the code itself fails to compile. (`node --check` on the three `apps/**/main.ts` files in the same script also never runs since build aborts first.)

These two failures are the actual blockers to advancing to Phase 4 Preparation, exactly as Codex previously documented in `docs/phase-4-preparation-blocked.md` and `docs/phase-4-v0-blocked.md`.

---

## 8. Test coverage audit

### Phase 1
- Covered: state machine valid/invalid transitions; rerun-from-completed; mock workflow happy path; policy denial; usage ledger attribution by task/run; instruction resolver precedence; mock LLM metadata; API task creation + 409 on duplicate active run.
- Missing: API authn/authz (no auth exists); error paths for invalid `selectedAgent`; pagination/filter behavior on `/tasks`.
- Blocks current milestone: no.

### Phase 2
- Covered: file overlap scoring (categories, same-directory heuristic, ordering invariance); `MockMergeSimulator` clean / text_conflict / failed / unavailable; `LocalGitDryRunMergeSimulator` clean and text_conflict against real temp repos plus unavailable when `repoPath` missing; high-risk overlap → blocked queue with `manual_review_required`; `mark-merged` releases lease.
- Missing: `LocalGitDryRunMergeSimulator` `failed` branch; queue cancellation history; rebase-needed scenarios (intentional future work).
- Blocks current milestone: no.

### Phase 3
- Covered: factory validation per kind; resolver defaults for backend/frontend/conflict/repo tasks; deprecated/approval-pending/eval-failed exclusion with deterministic warnings; CRUD via service; DTO shapes stable; rollback creates new revision and respects gates; approval queue read model deterministic; eval result attachment with `updateEvalStatus`; mock RBAC for viewer/editor/reviewer/admin; package manifest export/import (`create_only`, `replace_draft_only`, dry-run, missing artifact metadata); semver range resolution v0; package diff risk classification; dependency cycles.
- Missing: `FileBackedRegistryRepository` persistence-on-disk reload across processes; multi-actor audit ordering under concurrent mutations.
- Blocks current milestone: no.

### Phase 4
- Covered: none.
- Missing: everything.
- Blocks current milestone: no (Phase 4 not in current milestone).
- Blocks Phase 4 readiness: yes.

### Strict invariants
- Usage ledger attribution: covered (`usage ledger attributes model, skill, harness, task, and run`).
- Local git simulation safety: covered (no `git fetch/push`, `repoPath` required, working tree not mutated; tests verify temp repo isolation).
- Rollback safety: covered (rollback writes new revision; history retained; gates re-applied).
- Resolver gates: covered.
- No active mutation from draft proposals: vacuously covered (no proposals exist).
- No auto-apply: covered (no apply path).
- Mock-only compliance: covered by lint guard + tests.

### Top 5 tests to add next
1. Fix `tests/dashboard-data.test.ts:21` to either use a non-gated fixture skill (e.g. `jest-test-fixer@^1.0.0` which stays `approved`/`not_required`) or assert the gated-resolver `undefined` result. Required to unblock validation.
2. Negative test for `POST /merge-simulations` with `repoPath` outside the project root, verifying that the simulator returns `unavailable` and that audit logs record the rejection. Defensive against future production misuse.
3. Round-trip test for `FileBackedRegistryRepository`: write → reopen → verify snapshot/audit/history/eval/packages persist.
4. Concurrency test on registry mutations: interleaved `updateSkillApproval` and `attachEvalResult` for the same target keeping `revisionNumber` monotonic.
5. Workflow test for the `running → testing → failed` branch when `MockTestRunner` is forced to return `passed=false`, asserting that `TaskRun.status=failed`, no PR is created, and usage ledger still attributes the run.

---

## 9. Documentation consistency

Accurate docs:
- `README.md` — accurate scope, deferred items, security notes.
- `AGENTS.md` — accurate architecture rules; matches code (`packages/core` purity, conflict-manager local-only, registry DTO mappers, mock RBAC).
- `docs/phase-progress-audit.md` — accurate phase status; one stale "AICHESTRA_BOOTSTRAP.md at root" assumption (now under `design_docs/`).
- `docs/phase-3-completion-gap.md` — accurate.
- `docs/phase-3-packaging-versioning-v3.md` — accurate (matches `registry/src/index.ts`).
- `docs/conflict-manager-v0.md`, `docs/conflict-manager-v1.md` — accurate.
- `docs/phase-4-preparation-blocked.md`, `docs/phase-4-v0-blocked.md` — accurate; correctly explain the failing test root cause.

Stale or inconsistent docs:
- `docs/bootstrap-gap-report.md:53` and `docs/vertical-slice-review.md:42` say `AICHESTRA_BOOTSTRAP.md` is at the repository root, but the file is now under `design_docs/`. `scripts/build.mjs:7` shares the same stale expectation.
- `design_docs/AICHESTRA_CODEX_PHASE3_TO_PHASE4_WORK_ORDERS.md` "Current Assumed Project State" header claims `pnpm test: pass, 54 tests`; the repo now has 68 tests and 1 failing — the work-order pretext is out of date.
- README "Next Steps" #1 says "Execute Work Order 3: Phase 4 Preparation"; this remains blocked per `docs/phase-4-preparation-blocked.md`.

Docs that overclaim production readiness: none. README and the phase audit both explicitly state mock-first / not-production-ready.

Docs that understate limitations: none of significance.

Missing docs:
- `docs/phase-4-preparation.md` (work-order target) — not written.
- `docs/phase-4-auto-improvement-v0.md` — not written.
- `docs/conflict-manager-v0.md` exists but no `docs/phase-3-registry-v0.md` *follow-on for hardening* in a single place — already split across v0/v1/v2/v3 files; acceptable.
- No OpenAPI spec; README #4 lists it as a next step.
- No `docs/final-completion-audit.codex.md` parallel for cross-comparison (this audit is the Claude version).

---

## 10. Readiness ratings

### Internal prototype readiness — **ready**
The mock-first vertical slice runs end-to-end deterministically. Registry, Conflict Manager, dashboard, and APIs all work for demo purposes. The single failing test and the broken `scripts/build.mjs` require small, well-scoped fixes; they do not undermine the prototype.

### Internal MVP readiness — **mostly_ready**
For an internal MVP (multi-user, shared dev environment, persisted state), the gaps are: (a) async worker actually running outside the API process; (b) Prisma-backed persistence wired up (schema exists, repository does not yet use it); (c) at least basic auth on the API so the in-memory `mock-admin` actor is replaced; (d) dashboard fed from the API rather than re-executing workflows on render; (e) validation green (fix the 1 failing test, fix the broken build script path).

### Production readiness — **not_ready**
No real auth/RBAC, no SSO/SCIM, no secret broker, no sandbox, no policy-as-code engine, no signed artifacts, no real LLM/Git provider integration behind explicit gates, no deployment story, no Phase 4 safety surface. This is by design — the project is explicitly mock-first — but it must be stated.

---

## 11. Final blockers and recommended next step

### Critical blockers (stop merge / stop continuation)
1. `pnpm test` is failing 1/68: `tests/dashboard-data.test.ts:21` asserts `registryVersionResolution.selected?.version === "1.0.0"`, but the same fixture marks `auth-debugging` approval as `pending`, and the resolver correctly excludes pending entries. Fix per `docs/phase-4-preparation-blocked.md` (either change fixture or change assertion).
2. `pnpm build` is failing because `scripts/build.mjs:7` requires `AICHESTRA_BOOTSTRAP.md` at the repo root, but the file is at `design_docs/AICHESTRA_BOOTSTRAP.md`. Update `requiredPaths` to the new location (and ideally also list `design_docs/AICHESTRA_TECH_STACK_BLUEPRINT.md` and the codex work-order docs explicitly).

### Important follow-ups (before real integrations)
1. Decouple dashboard from in-process workflow execution. Read `tasks/leases/queue/registry` over the API or via an explicit read-model module; keep `mock-data.ts` as a test fixture.
2. Move `runAgentTaskWorkflow` out of the API request handler into a real worker process (even a Node `child_process` queue would express the boundary).
3. Wire `InMemoryAichestraStore` to a Prisma-backed repository behind the same interface, so the in-memory store stays for tests and a real store stays for runtime.
4. Document, in `AGENTS.md` and `README.md`, that `POST /merge-simulations` accepts caller-supplied `repoPath` — and add an allowlist before this endpoint sees production traffic.
5. Update the stale "bootstrap at root" sentences in `docs/bootstrap-gap-report.md` and `docs/vertical-slice-review.md`, and the test-count claim in `design_docs/AICHESTRA_CODEX_PHASE3_TO_PHASE4_WORK_ORDERS.md`.

### Nice-to-have
- OpenAPI spec for `/tasks`, `/conflicts`, `/merge-queue`, `/merge-simulations`, `/registry/*`.
- Stable DTO mappers for task/queue/conflict APIs to match the registry DTO discipline.
- A second failing-test class: the `failed` path of `LocalGitDryRunMergeSimulator` lacks dedicated coverage.
- Pre-commit hook for the lint guard.

### Recommended next step
Pick **two** in sequence:

1. **Stabilize validation** (under one hour of work): fix the dashboard fixture/test mismatch; fix `scripts/build.mjs` to look at the new bootstrap location. This unblocks every subsequent work order.
2. **Phase 4 Preparation skeleton** (next work order): add the `FailureSignal`, `FailureCluster`, `ImprovementCandidate`, `ImprovementProposal`, `EvalRequirement`, `CanaryRolloutPlan`, `AutoImprovementSafetyPolicy`, `AutoImprovementAnalysis`, `DraftRegistryChange`, `ProposalReadiness` types + repositories + read APIs + the `AutoImprovementSafetyPolicy{ allowAutoApply: false }` invariant + tests proving no auto-mutation reaches the active registry.

After both: revisit whether to start a **real Git Adapter v0** (read-only, behind `AICHESTRA_ENABLE_REAL_PROVIDERS`) or **real persistent DB integration** depending on which unblocks the bigger surface. Either is safe; persistence first is the more conservative call because it lets every Phase 1–3 capability survive a restart, which production demos will need.

---

## Final Summary

Current phase status:
- Phase 1: complete_for_current_milestone
- Phase 2: v1_implemented (complete_for_current_milestone for the Conflict Manager v1 milestone)
- Phase 3: v3_implemented
- Phase 4: not_started (planned_only; explicitly blocked by failing validation and missing Preparation models)
- Phase 5: planned_only

Validation:
- install: pass
- lint: pass
- typecheck: pass
- test: fail (67/68; `tests/dashboard-data.test.ts` resolver-fixture mismatch)
- build: fail (`scripts/build.mjs` looks for `AICHESTRA_BOOTSTRAP.md` at repo root; file is under `design_docs/`)

Mock-only compliance:
Clean. No runtime calls to real LLM, Git host, MCP, secrets, K8s, Temporal, or artifact registries. `LocalGitDryRunMergeSimulator` shells out only to a local `git` binary on a caller-supplied `repoPath` with no fetch/push/working-tree mutation. Lint script statically blocks `fetch("https?://...")` and `https.request(`. No auto-apply path exists for proposals because no proposal layer exists.

Internal prototype readiness:
ready — the vertical slice runs end-to-end and is well-tested; the two validation regressions are small fixture/script issues, not design problems.

Internal MVP readiness:
mostly_ready — needs validation green, async worker boundary, Prisma-backed persistence wired up, dashboard fed from API, and a minimal real auth shim before it can serve more than one user.

Production readiness:
not_ready — by design. No real auth, secrets, sandbox, policy-as-code, signed artifacts, real providers, deployment, data residency, or Phase 4 safety surface.

Critical blockers:
1. Failing test `tests/dashboard-data.test.ts:21` — dashboard fixture marks `auth-debugging` approval pending but expects resolver to still pick it for `^1.0.0`.
2. Failing build script — `scripts/build.mjs:7` references a root-level `AICHESTRA_BOOTSTRAP.md` that has moved to `design_docs/`.

Important follow-ups:
- Decouple `apps/web` rendering from `runAgentTaskWorkflow` invocation.
- Split worker from API process for `POST /tasks/:id/run`.
- Replace in-memory store with Prisma-backed repository while preserving the interface.
- Document and gate caller-supplied `repoPath` on `POST /merge-simulations`.
- Update stale docs that say `AICHESTRA_BOOTSTRAP.md` is at the repo root.

Recommendation:
Land a small validation-fix PR first (one fixture change, one path update in the build script). Then take Work Order 3 (Phase 4 Preparation) to add the missing safety-and-traceability models behind `AutoImprovementSafetyPolicy{ allowAutoApply: false }`. Defer real LLM/Git/auth/MCP integrations until Phase 4 Preparation lands.

Next recommended task:
"Stabilize Phase 3 v3 validation, then start Phase 4 Preparation skeleton" — concretely:
- Update `apps/web/lib/mock-data.ts` so the version-resolution fixture targets a selectable active skill (e.g. `jest-test-fixer`) OR adjust `tests/dashboard-data.test.ts:21` to expect the gated `undefined` selection.
- Update `scripts/build.mjs` `requiredPaths` to reference `design_docs/AICHESTRA_BOOTSTRAP.md`.
- Rerun `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Then begin Work Order 3 per `design_docs/AICHESTRA_CODEX_PHASE3_TO_PHASE4_WORK_ORDERS.md`, scoped strictly to mock-first models + APIs + tests with no auto-mutation path.
