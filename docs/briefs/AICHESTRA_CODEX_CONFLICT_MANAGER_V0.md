# AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md

This document is the next Codex work order for Aichestra after the first MVP vertical slice has been implemented.

The goal of this task is to verify the current mock-only vertical slice, then implement **Conflict Manager v0** using mock adapters only.

Do not add real GitHub, GitLab, OpenAI, Anthropic, MCP, Vault, Temporal, Kubernetes, or external network integrations in this task.

---

## 0. Current project context

Aichestra is an LLM/agent orchestration control plane for collaborative AI-assisted software development.

The current scaffold reportedly already supports this first MVP vertical slice:

```text
Task creation
→ API run trigger
→ mock policy check
→ mock model / skill / harness / instruction selection
→ mock branch creation
→ deterministic mock agent diff summary
→ mock test pass
→ mock PR creation
→ mock usage ledger entry
→ task completed
→ web dashboard shows task status, mock PR, cost, and diff summary
```

The next product differentiator is branch/lease/conflict/merge-queue management for multiple AI tasks working on the same repository.

---

## 1. Read first

Before making changes, read these files if they exist:

```text
AGENTS.md
README.md
AICHESTRA_BOOTSTRAP.md
aichestra_codex_bootstrap.md
AICHESTRA_CODEX_NEXT_STEPS.md
docs/audits/2026-05-11-bootstrap-gap-report.md
```

If both `AICHESTRA_BOOTSTRAP.md` and `aichestra_codex_bootstrap.md` exist, treat `AICHESTRA_BOOTSTRAP.md` as canonical.

If only `aichestra_codex_bootstrap.md` exists, do not fail the task. Record that in the review document.

---

## 2. High-level goal

Implement **Conflict Manager v0** with these capabilities:

```text
1. Track active branch leases for AI task runs.
2. Compute file-overlap conflict risk between active leases.
3. Create a mock merge queue entry after mock PR creation.
4. Mark merge queue entries as ready or blocked based on conflict risk.
5. Expose conflict risk and merge queue data through API endpoints.
6. Show conflict risk and merge queue status in the web dashboard.
7. Add deterministic tests for conflict scoring, lease behavior, merge queue behavior, and API behavior.
```

This must remain mock-only and deterministic.

---

## 3. Non-goals

Do **not** implement these in this task:

```text
- Real git merge, rebase, or merge-tree execution.
- Real GitHub/GitLab/Bitbucket API calls.
- Real PR merge operations.
- Real LLM calls.
- Real MCP tool calls.
- Real secrets management.
- Real Kubernetes, Temporal, or Firecracker execution.
- AST-level symbol overlap analysis.
- Semantic conflict detection.
- Auto conflict resolution agent.
- Human approval workflow beyond simple flags/statuses.
```

The v0 implementation should be intentionally simple and extensible.

---

## 4. Phase 1 — Review current vertical slice before coding

Create or update:

```text
docs/audits/2026-05-11-vertical-slice-review.md
```

The review must check:

```text
- Whether API handlers contain orchestration logic that should live in worker/services.
- Whether mock adapters are behind interfaces.
- Whether Task state transitions are explicit and tested.
- Whether UsageLedger entries are attributed to taskId and taskRunId.
- Whether Skill, Harness, and InstructionArtifact remain separate concepts.
- Whether any real external network/API calls exist.
- Whether POST /tasks/:id/run is idempotent or has a documented repeated-run behavior.
- Whether the bootstrap filename mismatch is resolved or documented.
```

If critical blockers are found, fix only the blockers required to safely add Conflict Manager v0.

Do not perform broad refactors unrelated to this task.

---

## 5. Phase 2 — Add Conflict Manager domain models

Add domain models in the appropriate core package. Exact file names may vary, but the concepts must remain separate.

### 5.1 BranchLease

A `BranchLease` represents the files and optional code areas that an AI task run is expected to affect.

Suggested shape:

```ts
export type BranchLeaseStatus = "active" | "released" | "expired";

export interface BranchLease {
  id: string;
  repoId: string;
  taskId: string;
  taskRunId: string;
  branchId: string;
  branchName: string;
  baseBranch: string;
  files: string[];
  symbols?: string[];
  tests?: string[];
  status: BranchLeaseStatus;
  createdAt: string;
  updatedAt: string;
  releasedAt?: string;
}
```

Rules:

```text
- A lease is created or updated after the mock agent produces changed files.
- A lease remains active after task completion because the PR branch still exists.
- A lease is released only when the mock merge queue entry is marked merged, cancelled, or explicitly released.
- Lease data must be deterministic and testable.
```

### 5.2 ConflictRisk

A `ConflictRisk` is the pairwise risk between two active leases.

Suggested shape:

```ts
export type ConflictRiskLevel = "none" | "low" | "medium" | "high" | "critical";

export interface ConflictRisk {
  id: string;
  repoId: string;
  sourceLeaseId: string;
  targetLeaseId: string;
  sourceTaskRunId: string;
  targetTaskRunId: string;
  overlapFiles: string[];
  riskScore: number;
  riskLevel: ConflictRiskLevel;
  reasons: string[];
  recommendation: "safe" | "monitor" | "serialize" | "block" | "human_review";
  computedAt: string;
}
```

Rules:

```text
- riskScore must be between 0 and 1.
- Pair order should not affect the risk result.
- Same taskRunId should not be compared against itself.
- Only active leases should affect active conflict risk.
```

### 5.3 MergeQueueEntry

A `MergeQueueEntry` represents a mock PR waiting to be merged.

Suggested shape:

```ts
export type MergeQueueStatus = "queued" | "ready" | "blocked" | "merged" | "cancelled";

export interface MergeQueueEntry {
  id: string;
  repoId: string;
  taskId: string;
  taskRunId: string;
  branchLeaseId: string;
  pullRequestId: string;
  pullRequestUrl: string;
  branchName: string;
  priority: number;
  riskScore: number;
  status: MergeQueueStatus;
  reasons: string[];
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
}
```

Rules:

```text
- Create a merge queue entry after mock PR creation.
- Set status to ready when risk is low enough.
- Set status to blocked when risk is high or critical.
- Marking an entry as merged must release its associated branch lease.
```

---

## 6. Phase 3 — Add services/interfaces

Add interfaces so real providers can be added later.

Suggested interfaces:

```ts
export interface BranchLeaseStore {
  createLease(input: CreateBranchLeaseInput): Promise<BranchLease>;
  updateLease(id: string, input: UpdateBranchLeaseInput): Promise<BranchLease>;
  releaseLease(id: string, reason?: string): Promise<BranchLease>;
  listActiveLeases(repoId: string): Promise<BranchLease[]>;
  listLeasesByTaskRun(taskRunId: string): Promise<BranchLease[]>;
}

export interface ConflictRiskService {
  computePairRisk(source: BranchLease, target: BranchLease): ConflictRisk;
  computeRepoRiskGraph(repoId: string): Promise<ConflictRisk[]>;
  computeRiskForLease(leaseId: string): Promise<ConflictRisk[]>;
}

export interface MergeQueueService {
  enqueue(input: EnqueueMergeInput): Promise<MergeQueueEntry>;
  listQueue(repoId: string): Promise<MergeQueueEntry[]>;
  refreshEntryRisk(entryId: string): Promise<MergeQueueEntry>;
  markMerged(entryId: string): Promise<MergeQueueEntry>;
  cancel(entryId: string, reason?: string): Promise<MergeQueueEntry>;
}
```

These interfaces can be implemented with in-memory/mock stores for now.

Do not introduce database migrations unless the project already has a lightweight DB pattern and the change is small. If persistence currently uses in-memory/mock stores, keep this task in-memory/mock as well.

---

## 7. Phase 4 — Implement deterministic file-overlap risk scoring

Implement a simple deterministic scoring algorithm.

### 7.1 File classification

Classify files into broad categories:

```text
critical:
  - .github/workflows/**
  - infra/**
  - infrastructure/**
  - terraform/**
  - migrations/**
  - db/migrations/**
  - prisma/schema.prisma
  - schema/**
  - auth/**
  - security/**
  - **/auth/**
  - **/security/**
  - package.json
  - pnpm-lock.yaml
  - yarn.lock
  - package-lock.json

test:
  - **/*.test.*
  - **/*.spec.*
  - **/__tests__/**
  - tests/**
  - test/**

docs:
  - docs/**
  - **/*.md

source:
  - everything else
```

The exact implementation can be simple string/path matching. Do not add a heavy glob dependency unless the project already uses one.

### 7.2 Pairwise risk scoring

Suggested scoring:

```text
No overlap:
  riskScore = 0.0
  level = none
  recommendation = safe

Only docs overlap:
  riskScore = 0.1
  level = low
  recommendation = safe

Only test overlap:
  riskScore = 0.3
  level = low
  recommendation = monitor

Source file overlap:
  riskScore = 0.6
  level = medium
  recommendation = serialize

Package manifest or lockfile overlap:
  riskScore = 0.75
  level = high
  recommendation = block

Critical path overlap:
  riskScore = 0.9
  level = critical
  recommendation = human_review
```

If multiple conditions apply, use the highest score.

Also add a small same-directory heuristic:

```text
If there is no exact file overlap but two active leases modify 3 or more files under the same top-level directory, assign riskScore at least 0.35 with recommendation monitor.
```

### 7.3 Risk levels

Use these thresholds:

```text
0.00          -> none
0.01 - 0.34   -> low
0.35 - 0.64   -> medium
0.65 - 0.84   -> high
0.85 - 1.00   -> critical
```

### 7.4 Merge queue status mapping

Use this mapping:

```text
riskScore < 0.50:
  status = ready

0.50 <= riskScore < 0.85:
  status = blocked
  reason includes "serialize_with_overlapping_branch"

riskScore >= 0.85:
  status = blocked
  reason includes "human_review_required_for_critical_overlap"
```

---

## 8. Phase 5 — Integrate with the existing mock workflow

Update the existing mock workflow so that after the mock agent produces a deterministic diff summary and changed files:

```text
1. Create or update a BranchLease for the task run.
2. Compute conflict risks against other active leases in the same repo.
3. Create the mock PR as before.
4. Create a MergeQueueEntry for the mock PR.
5. Set merge queue status based on the highest active risk score for that lease.
6. Store risk summary on the task run or expose it through conflict APIs.
7. Keep the existing usage ledger behavior intact.
```

Do not break the existing first vertical slice tests.

If the current mock agent does not produce changed files consistently, update it so each task can produce deterministic `changedFiles` based on input.

Suggested deterministic behavior:

```text
- If task input includes explicit changedFiles, use those.
- Else if the task title or description contains "auth", use ["src/auth/session.ts", "tests/auth/session.test.ts"].
- Else if it contains "payment", use ["src/payments/service.ts", "tests/payments/service.test.ts"].
- Else if it contains "infra", use ["infra/app.tf"].
- Else use ["src/app.ts"].
```

---

## 9. Phase 6 — Add or update API endpoints

Add endpoints consistent with the existing API style. Exact naming can vary, but these capabilities must exist.

Recommended endpoints:

```text
GET /branches/leases?repoId=<repoId>&status=active
GET /conflicts/risks?repoId=<repoId>
GET /conflicts/risks?taskRunId=<taskRunId>
GET /merge-queue?repoId=<repoId>
POST /merge-queue/:id/mark-merged
POST /merge-queue/:id/cancel
```

Endpoint expectations:

```text
- List active branch leases for a repo.
- List pairwise conflict risks for active leases.
- List risks involving a specific task run.
- List merge queue entries for a repo.
- Marking a queue entry merged must release its lease.
- Cancelling a queue entry must release its lease or mark it non-active.
```

Return plain JSON.

No auth implementation is required beyond the current mock policy system.

---

## 10. Phase 7 — Update web dashboard

Update the dashboard to show Conflict Manager v0 information.

Minimum UI:

```text
1. Task detail or task list shows:
   - branch name
   - changed files
   - highest conflict risk score
   - risk level
   - merge queue status

2. Add a simple merge queue section/table showing:
   - repoId
   - taskRunId
   - branch name
   - PR URL
   - risk score
   - status
   - reasons

3. Add a simple active leases/conflict risk section/table showing:
   - source task run
   - target task run
   - overlap files
   - risk score
   - recommendation
```

Do not overbuild the UI. This can be simple tables with deterministic mock data.

---

## 11. Phase 8 — Tests

Add deterministic tests. Prefer unit tests for scoring and service behavior, plus a small integration/API test if the project already has API tests.

Required tests:

```text
1. Conflict scoring: no overlap -> risk 0, recommendation safe.
2. Conflict scoring: docs-only overlap -> low risk.
3. Conflict scoring: test-only overlap -> low/monitor.
4. Conflict scoring: source overlap -> medium/serialize.
5. Conflict scoring: package or lockfile overlap -> high/block.
6. Conflict scoring: critical path overlap -> critical/human_review.
7. Same-directory heuristic creates medium-ish risk without exact overlap.
8. Workflow creates branch lease and merge queue entry after mock PR creation.
9. High-risk overlap blocks merge queue entry.
10. Marking merge queue entry as merged releases associated lease.
11. API returns active leases, conflict risks, and merge queue entries.
12. Existing first vertical slice tests still pass.
```

Keep tests deterministic. Do not depend on wall-clock timing except for simple ISO timestamp existence checks.

---

## 12. Phase 9 — Documentation updates

Update or create docs:

```text
docs/features/conflict-manager/v0.md
```

The doc must explain:

```text
- What BranchLease is.
- What ConflictRisk is.
- What MergeQueueEntry is.
- How v0 file-overlap scoring works.
- Why v0 does not perform real git merge/rebase.
- How this will later evolve into dry-run merge, AST/symbol overlap, semantic conflict detection, and conflict resolver agents.
```

Also update README and AGENTS.md if commands, architecture, or package boundaries changed.

---

## 13. Acceptance criteria

The task is complete only if all of the following are true:

```text
[ ] docs/audits/2026-05-11-vertical-slice-review.md exists and includes the requested checks.
[ ] docs/features/conflict-manager/v0.md exists.
[ ] BranchLease, ConflictRisk, and MergeQueueEntry are separate domain concepts.
[ ] Conflict scoring is deterministic and tested.
[ ] Active leases can be listed by repo.
[ ] Conflict risks can be listed by repo and/or taskRunId.
[ ] Merge queue entries are created after mock PR creation.
[ ] Merge queue status is ready or blocked based on risk score.
[ ] Marking a mock merge queue entry as merged releases its lease.
[ ] Web dashboard shows conflict/lease/merge queue information.
[ ] Existing vertical slice still works.
[ ] No real external APIs are called.
[ ] No real git merge/rebase is performed.
[ ] pnpm lint passes.
[ ] pnpm typecheck passes.
[ ] pnpm test passes.
[ ] pnpm build passes.
```

---

## 14. Guardrails

Follow these guardrails strictly:

```text
- Keep provider integrations behind interfaces.
- Keep Conflict Manager v0 mock-only.
- Do not add unnecessary dependencies.
- Do not make broad architectural rewrites.
- Do not collapse Skill, Harness, and InstructionArtifact into one concept.
- Do not store secrets in source code.
- Do not call external services in tests.
- Do not hide failing validation commands.
- If a command fails, fix the code or document the blocker clearly.
```

---

## 15. Suggested implementation order

Use this order:

```text
1. Create docs/audits/2026-05-11-vertical-slice-review.md.
2. Fix critical blockers only if required.
3. Add core domain models and types.
4. Add in-memory stores/services for leases, risk, and merge queue.
5. Add deterministic risk scoring tests.
6. Integrate lease/risk/merge queue into mock workflow.
7. Add API endpoints and API tests.
8. Update web dashboard.
9. Add docs/features/conflict-manager/v0.md.
10. Run full validation.
11. Produce a final summary.
```

---

## 16. Final report required from Codex

At the end, report:

```text
- What was implemented.
- Files changed.
- New domain models.
- New API endpoints.
- New tests.
- Validation results for:
  - pnpm install
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm build
- Confirmation that no real external API calls were added.
- Known limitations of Conflict Manager v0.
- Recommended next task.
```

The recommended next task should probably be one of:

```text
- Conflict Manager v1: dry-run merge simulation using local git only.
- Registry v0: Skill/Harness/Instruction registry persistence and version pinning.
- LLM Gateway v0: provider interface, mock budget policy, usage attribution improvements.
```

---

# Codex command: full execution

Use this command when you want Codex to perform the review and implementation in one task.

```text
Read AGENTS.md, README.md, the bootstrap document, AICHESTRA_CODEX_NEXT_STEPS.md, and AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md.

Execute the work order in AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md.

Start by creating docs/audits/2026-05-11-vertical-slice-review.md. If the review finds critical blockers, fix only those blockers first. Then implement Conflict Manager v0 using mock adapters only.

The implementation must add BranchLease, ConflictRisk, and MergeQueueEntry as separate domain concepts; deterministic file-overlap risk scoring; active lease tracking; merge queue skeleton; API endpoints for leases/risks/merge queue; web dashboard visibility; and tests.

Do not add real GitHub, GitLab, OpenAI, Anthropic, MCP, Vault, Temporal, Kubernetes, or external network integrations.
Do not perform real git merge or rebase operations.
Keep all provider behavior behind interfaces.
Ensure pnpm lint, pnpm typecheck, pnpm test, and pnpm build pass.
Update README, AGENTS.md, and docs/features/conflict-manager/v0.md as needed.

At the end, report completed work, changed files, validation results, known limitations, and the recommended next task.
```

---

# Codex command: review only

Use this command if you want a review before implementation.

```text
Read AGENTS.md, README.md, the bootstrap document, AICHESTRA_CODEX_NEXT_STEPS.md, and AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md.

Do not change code yet.

Create docs/audits/2026-05-11-vertical-slice-review.md according to AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md.

The review must check API/worker boundaries, adapter interfaces, Task state transitions, UsageLedger attribution, Skill/Harness/Instruction separation, external API calls, repeated-run behavior for POST /tasks/:id/run, and bootstrap filename consistency.

At the end, report whether Conflict Manager v0 can proceed safely or whether blockers must be fixed first.
```

---

# Codex command: implementation after review

Use this command if `docs/audits/2026-05-11-vertical-slice-review.md` already exists and has no critical blockers.

```text
Read AGENTS.md, README.md, docs/audits/2026-05-11-vertical-slice-review.md, and AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md.

Implement Conflict Manager v0 exactly within the scope of AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md.

Add separate BranchLease, ConflictRisk, and MergeQueueEntry concepts; deterministic file-overlap risk scoring; active lease tracking; mock merge queue; API endpoints; dashboard updates; tests; and docs/features/conflict-manager/v0.md.

Use mock adapters only.
Do not call external APIs.
Do not perform real git merge or rebase.
Keep provider behavior behind interfaces.
Ensure pnpm lint, pnpm typecheck, pnpm test, and pnpm build pass.

At the end, report completed work, changed files, validation results, limitations, and the recommended next task.
```
