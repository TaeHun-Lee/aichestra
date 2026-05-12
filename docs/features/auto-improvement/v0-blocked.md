# Phase 4 Auto-improvement v0 Blocked

## Missing Prerequisite

Phase 4 Auto-improvement v0 cannot start because Phase 4 Preparation is not implemented and repository validation is not passing.

Required Phase 4 Preparation artifacts are missing:

- `FailureSignal`
- `FailureCluster`
- `ImprovementCandidate`
- `ImprovementProposal`
- `EvalRequirement`
- `CanaryRolloutPlan`
- `AutoImprovementSafetyPolicy`
- Phase 4 preparation APIs
- Phase 4 preparation tests
- `docs/features/auto-improvement/preparation.md`

## Evidence

`docs/features/auto-improvement/preparation.md` is absent.

Search for required Phase 4 preparation model and API names:

```bash
rg -n "FailureSignal|FailureCluster|ImprovementCandidate|ImprovementProposal|EvalRequirement|CanaryRolloutPlan|AutoImprovementSafetyPolicy|failure-signals|failure-clusters|improvement/candidates|improvement/proposals|safety-policies" .
```

Result:

- Matches only appear in `AICHESTRA_CODEX_PHASE3_TO_PHASE4_WORK_ORDERS.md`.
- No implementation was found under `apps/`, `packages/`, or `tests/`.

Validation command:

```bash
pnpm test
```

Result:

```text
tests: 68
pass: 67
fail: 1
```

Failing test:

```text
dashboard data exposes conflict manager v1 simulation assumptions
file: tests/dashboard-data.test.ts
actual: undefined
expected: "1.0.0"
assertion: data.registryVersionResolution.selected?.version === "1.0.0"
```

The existing `docs/features/auto-improvement/preparation-blocked.md` also records that Phase 4 Preparation was blocked because Phase 3 Packaging & Versioning v3 validation is not passing.

## Why This Blocks Auto-improvement v0

Auto-improvement v0 depends on Phase 4 Preparation for the safety and traceability layer:

- failure signals to capture observed problems
- failure clusters to group related signals
- improvement candidates to identify possible targets
- proposals to hold reviewable changes
- eval requirements and canary rollout plans to define gates
- a safety policy to keep auto-improvement draft-only and prevent automatic activation

Without those models, repositories, APIs, and tests, Auto-improvement v0 would have no stable foundation for draft proposal generation or no-bypass safety checks.

The current failing test is also a critical blocker because Work Order 4 requires validation passing before implementation.

## Recommended Fix

1. Fix the Phase 3 v3 dashboard fixture/test mismatch.
   - The current dashboard fixture marks `auth-debugging` approval as `pending`.
   - The same fixture expects version resolution for `auth-debugging@^1.0.0` to select `1.0.0`.
   - The resolver correctly excludes pending-approval entries.
   - Recommended narrow fix: resolve a selectable active skill in dashboard package-version fixture data, or update the test to expect the gated resolver behavior.

2. Rerun validation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

3. Execute Work Order 3: Phase 4 Preparation.

4. After Phase 4 Preparation exists and validation passes, rerun Work Order 4: Phase 4 Auto-improvement v0.

## Application Code Changes

No Phase 4 Auto-improvement v0 application code changes were made.

No automatic registry mutations were introduced.

No real LLM, embedding, external API, MCP, Vault, Kubernetes, Temporal, artifact registry, GitHub, GitLab, or Bitbucket integration was added.
