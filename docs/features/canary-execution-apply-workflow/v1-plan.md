# Canary Execution Harness + Apply Workflow v1 — Pre-implementation Plan

Status: planning (no implementation in this document)

## Current Behavior Baseline

- **Governance / apply gate.** `packages/improvement/src/index.ts` already defines `ProposalReadiness`, `ProposalApplyGate`, `ProposalApplyGateService`, `CanaryReadiness`, `CanaryReadinessService`, `DraftRegistryChange`, and `DraftRegistryChangeService`. The apply gate is metadata only and `auto-apply` is disabled. `ProposalApplyGateService.evaluate` records whether eval/canary/approval prerequisites are present but never applies anything.
- **Proposal readiness.** `ProposalReadinessService` exposes `requireCanary`, `canaryReady`, `requiredCanary`, `requiredCanaryReady`, but the harness that actually exercises a canary plan is missing.
- **Eval metadata.** Eval result metadata is captured via `EvalResult` in the registry domain. A dedicated *Eval Suite Execution Harness v1* is **not** present in this repository (no `packages/registry/src/eval*harness*` and no `tests/eval-suite*`). Eval references must therefore stay forward-compatible but cannot assume execution APIs exist.
- **Canary readiness.** `CanaryReadiness` records whether a `CanaryRolloutPlan` is ready, but there is no service that *runs* a deterministic mock canary, records `RegistryCanaryRun`, `RegistryCanaryResult`, or `RegistryCanaryVerdict` artifacts.
- **Auto-improvement safety.** Auto-Improvement v0 keeps `applyAllowed: false` on all proposal outputs. `DraftRegistryChange` transitions are draft-only. `improvement.apply` is gated behind policy and the runtime never mutates active Skill/Harness/Instruction records.
- **Drift detection v1.** The recently-shipped Drift Detection v1 (`packages/registry/src/drift-detection.ts`) demonstrates the wiring pattern for a new registry-level metadata service: policy evaluator with metadata flags, deterministic mock data, read-only API, dashboard read model, `/health` block, tenant-scope plan entries, and `policy_*_create_candidate_future_deny_v1` style deny-by-default rules.

## Proposed Canary Execution Model

Introduce a `CanaryExecutionService` exposing:

- `RegistryCanaryPlan` (`canaryKind ∈ {mock_deterministic | fixture_subset | task_subset_future | tenant_subset_future | provider_subset_future | external_future}`, status `planned | ready | blocked | future`, optional `proposalId`/`draftRegistryChangeId`, `targetKind ∈ {skill | harness | instruction | registry_package}`, `requiredEvalRunIds`, `requiredApprovalIds`, `sampleStrategy`, `rollbackPlanId`).
- `RegistryCanaryRun` with status `requested | running_mock | passed | failed | warning | skipped | blocked_policy | blocked_missing_eval | blocked_missing_approval | future_external`. Carries `requestId`, `correlationId`, actor metadata.
- `RegistryCanaryResult` with `metricKind ∈ {pass_rate | failure_rate | token_cost | runtime | policy_denial_rate | rollback_signal | user_feedback_future}`, `verdict ∈ {pass | fail | warning | skipped}`.
- `RegistryCanaryVerdict` with `overallVerdict ∈ {passed | failed | warning | skipped | blocked}` and `applyGateImpact ∈ {no_change | improves_readiness | blocks_apply | future_manual_review}`.

Execution is **deterministic mock only**: the service computes results from seeded fixture inputs and a stable scoring function. No external provider, no real task run, no real eval suite execution, no remote Git, no vendor CLI.

## Proposed Apply Workflow Model

Introduce an `ApplyWorkflowService` exposing:

- `RegistryApplyWorkflow` linking `proposalId` + `draftRegistryChangeId` with status `draft | eval_required | canary_required | approval_required | ready_for_manual_apply_future | blocked | applied_metadata_only | applied_future`. `applyMode ∈ {metadata_only | manual_future | automatic_forbidden}`. `autoApplyEnabled: false`, `activeRegistryMutationAllowed: false` are literal constants.
- `RegistryApplyGateDecision` with `decision ∈ {blocked_missing_eval | blocked_failed_eval | blocked_missing_canary | blocked_failed_canary | blocked_missing_approval | blocked_policy_denied | blocked_auto_apply_disabled | ready_for_manual_future | metadata_only_recorded}`. `applyPerformed: false`, `activeRegistryMutated: false` always.
- `RegistryRollbackPlan` with `rollbackKind ∈ {metadata_only | registry_history_revert_future | package_version_revert_future | manual_review}`, status `planned | missing | blocked | future`.

The workflow is **metadata-only**: `recordMetadataOnlyApplyDecision` writes an audit-style record but never mutates active Skill/Harness/Instruction registries, never calls registry mutation APIs, and never flips `automatic_forbidden`.

## Manual Approval Requirements

- Apply gate decisions must require at least one `requiredApprovalIds` entry sourced from existing Governance / `ProposalReadiness` approvals. The service does not generate approvals — it records expectations.
- `ready_for_manual_apply_future` is reachable only when (a) all required eval runs report `pass` (forward-compatible: if no eval harness is configured, the workflow stays `eval_required` rather than auto-passing), (b) all required canary runs report `passed`, (c) all required approval IDs are recorded, and (d) policy allows `registry.apply.metadata_record`. Even at that point, `applyPerformed` stays `false`.
- Default policy: `registry.apply.execute_future` and `registry.apply.auto_apply_future` deny by default.

## Rollback Requirements

- Every `RegistryApplyWorkflow` must reference a `RegistryRollbackPlan` whose `requiredEvidence` includes references to the originating draft change, governance approval, and prior registry history checkpoint.
- v1 `rollbackKind` is always `metadata_only` or `manual_review`. `registry_history_revert_future` and `package_version_revert_future` remain future-only.
- Missing or `blocked` rollback plan ⇒ apply gate returns `blocked_failed_canary` or `blocked_missing_approval` (whichever fires first), never `metadata_only_recorded`.

## Safety Constraints (Verbatim)

- No real LLM calls.
- No real external canaries.
- No automatic mutation of active registry entries.
- No auto-apply of registry changes.
- No bypass of governance approval.
- No bypass of eval requirements.
- No bypass of canary requirements.
- No weakening of apply gates.
- No external provider calls.
- No remote Git operations.
- No vendor CLI execution.
- No credential cache reads.
- No secret or env value exposure.
- No weakening of Registry, Governance, Policy, Auth/RBAC, Tenant Scope, SecretRef, Dashboard, Observability, Staging, CI/CD, or Safety gates.
- Default runtime stays mock-first.

## What v1 Implements

1. Models in `packages/registry/src/canary-apply.ts` for canary plans/runs/results/verdicts and apply workflows/gate decisions/rollback plans.
2. `CanaryExecutionService` (deterministic mock harness) and `ApplyWorkflowService` (metadata-only apply gate, no execution).
3. New `PolicyResourceKind` values `registry_canary` and `registry_apply_workflow`, plus the eight policy actions listed in the brief. Default rules: `plan` / `run_mock` / `apply_workflow.create` / `apply_gate.evaluate` / `apply.metadata_record` allowed in mock-only context; `run_external_future` / `apply.execute_future` / `apply.auto_apply_future` deny by default.
4. Read-only / evaluation-only API endpoints under `/registry/canary/*` and `/registry/apply-workflows/*`, plus `/readiness/registry/canary/summary` and `/readiness/registry/apply-workflows/summary`, plus a `/health.registryCanaryApply` payload.
5. `/dashboard/registry-canary-apply` read model and HTML panel showing canary plans, runs, verdicts, workflows, gate decisions, rollback plans, and the safety flags (`autoApplyEnabled: false`, `activeRegistryMutationAllowed: false`, `applyPerformed: false`).
6. Tenant-scope plan entries.
7. Deterministic tests under `tests/canary-execution-apply-workflow-v1.test.ts`.
8. Documentation: this plan, `v1.md`, cross-links to Compatibility Matrix v1, Drift Detection v1, Dashboard v0, README, AGENTS, runtime-component-inventory, real-integration-roadmap, and the phase-progress-checklist HTML.

## What v1 Does Not Implement

- No Eval Suite Execution Harness v1 (separate future task). Eval references stay optional and never auto-pass.
- No real canary execution. `task_subset_future`, `tenant_subset_future`, `provider_subset_future`, `external_future` plan kinds always block.
- No active registry mutation. `recordMetadataOnlyApplyDecision` records an audit row only.
- No real rollback execution. `registry_history_revert_future` and `package_version_revert_future` remain blocked.
- No real auth, no production tenant enforcement (existing partial enforcement is preserved, not extended).
- No external provider, MCP, LLM, vendor CLI, or remote Git calls.

## Validation Plan

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `git diff --check`.
- Safe-integration scan (`rg -n "fetch\(|axios|child_process|spawn\(|exec\(|git push|git fetch|kubectl|vault|temporal|new Function" packages/registry/src/canary-apply.ts tests/canary-execution-apply-workflow-v1.test.ts`).
- New tests cover the 17+ deterministic cases listed in the brief plus regressions (Drift Detection v1, Compatibility v1, Governance, Improvement, Policy, Dashboard).

## Scope Notes

- Service belongs in `packages/registry` (sibling of `compatibility.ts` and `drift-detection.ts`).
- API routes live next to the drift detection block in `apps/api/src/main.ts` to keep registry-level governance metadata co-located.
- Dashboard panel sits between Drift Detection and Staging Deployment Profile to keep registry-level metadata grouped.
