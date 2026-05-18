# Skill / Harness Drift Detection v1 Plan

Status: v1_planned

## Chosen Docs Path

Per `docs/README.md`, feature-scoped work lives under `docs/features/<slug>/`. Drift detection cross-cuts the Registry, Compatibility Matrix, Auto-improvement v0, Governance v1, eval/canary metadata, and Observability/Usage Ledger, but it is itself a feature implementation rather than a cross-cutting rollout. The canonical path is `docs/features/skill-harness-drift-detection/`.

## Current Behavior

### Skill / Harness / Instruction Registry

`packages/registry/src/index.ts` provides `RegistryService`/`RegistryResolver` with lifecycle, approval, eval, checksum, semver, and policy gates. Seed data lives in `packages/core/src/registries/seed-data.ts`. The resolver continues to enforce its existing gates and never auto-applies changes.

### Skill / Harness Compatibility Matrix v1

`packages/registry/src/compatibility.ts` adds advisory metadata. It exposes Skill/Harness/Instruction compatibility profiles, deterministic rules, and `RegistryCompatibilityDecision`s. It preserves all resolver gates as authoritative and never mutates registry entries.

### Auto-improvement v0 + Governance v1

`packages/improvement` defines `FailureSignal`, `FailureCluster`, `ImprovementCandidate`, `ImprovementProposal`, `EvalRequirement`, `CanaryRolloutPlan`, and `AutoImprovementSafetyPolicy`. Defaults preserve `allowAutoApply=false`, `requireHumanApproval=true`, `requireEvalPassed=true`, `requireCanary=true`. The apply gate is blocked. Improvement proposals are draft-only metadata.

### Eval / Canary Metadata

`packages/registry/src/index.ts` exposes eval metadata attachment (`RegistryEvalResult`); `packages/improvement` exposes `EvalRequirement` and `CanaryRolloutPlan` metadata. No real eval or canary is executed in default runtime/tests.

### Observability / Usage Ledger

`packages/observability/src/**` aggregates audit events, retention/redaction classes, and source coverage metadata. The usage ledger captures mock LLM usage with `taskId`/`taskRunId` attribution. Default runtime never calls real providers.

### Gap

The system already tracks failure signals (manual or test-detected), eval status, registry history, governance decisions, and compatibility decisions. It does not yet compose these signals into a per-Skill/Harness/Instruction drift score, classify drift severity, or recommend governance follow-ups (review, eval, canary) in a deterministic, advisory-only metadata layer.

## Proposed Drift Signals

`RegistryDriftSignal` carries `targetKind ∈ {skill, harness, instruction, registry_package, compatibility_profile}`, `targetId`, `signalKind`, `value`, `baselineValue`, `delta`, `window`, `severity`, `source`, and metadata. Signal kinds:

- `failure_rate_increase`
- `token_cost_increase`
- `runtime_increase`
- `eval_status_decline`
- `compatibility_warning_increase`
- `manual_override_increase`
- `rollback_involvement`
- `conflict_involvement`
- `stale_instruction`
- `policy_denial_increase`
- `provider_model_mismatch`
- `unknown`

Sources are tagged with the documented `source` taxonomy (`mock_seed`, `usage_ledger`, `eval_metadata`, `governance_audit`, `compatibility_matrix`, `observability`, `future_external`).

## Proposed Drift Scoring Strategy

`RegistryDriftAssessment.driftScore` is a deterministic integer in `[0..100]`. Score buckets map to severity:

- `info`: 0–20
- `low`: 21–40
- `medium`: 41–60
- `high`: 61–80
- `critical`: 81–100

Per-signal weights (additive, clamped to `[0,100]`):

| Signal kind | Weight |
|---|---|
| `failure_rate_increase` | 35 |
| `eval_status_decline` | 35 |
| `rollback_involvement` | 20 |
| `policy_denial_increase` | 25 |
| `compatibility_warning_increase` | 15 |
| `token_cost_increase` | 12 |
| `runtime_increase` | 10 |
| `stale_instruction` | 8 |
| `manual_override_increase` | 12 |
| `conflict_involvement` | 12 |
| `provider_model_mismatch` | 10 |
| `unknown` | 5 |

Severity multipliers (applied per signal): `info` x0.5, `low` x0.8, `medium` x1.0, `high` x1.3, `critical` x1.6. Score is clamped and rounded.

Assessment status thresholds:

- `no_drift`: score ≤ 20 and no critical signal
- `watch`: 21–40
- `degraded`: 41–80
- `critical`: > 80 OR any signal classified `critical`
- `insufficient_data`: no signals collected within window

Score is deterministic. Same input ⇒ same score.

## Proposed Governance Integration

Drift assessments surface advisory governance follow-ups via `RegistryDriftRecommendation` (`monitor`, `create_improvement_candidate`, `require_eval`, `require_canary`, `review_instruction`, `review_harness`, `review_provider_compatibility`, `deprecate_future`, `rollback_review`). Every recommendation has `applyAllowed: false`. Linking to Auto-improvement v0 returns a draft-only `improvementCandidateId` reference when the existing improvement service supports it; the apply gate remains blocked. No active registry mutation is performed.

## Safety Constraints

- No real eval/canary execution.
- No registry mutation.
- No auto-apply of recommendations.
- No external provider/MCP/LLM/vendor CLI calls.
- No remote Git operations.
- No credential cache reads.
- No secret/env exposure.
- Resolver/lifecycle/approval/eval/checksum/semver/policy gates remain authoritative.
- Default tenant scope mismatch remains advisory only.

## What v1 Implements

- Models: `RegistryDriftSignal`, `RegistryDriftBaseline`, `RegistryDriftAssessment`, `RegistryDriftRecommendation`, `RegistryDriftSummary`.
- Service: `RegistryDriftDetectionService` with deterministic mock signal collection, baseline build, assessment, recommendations, summary, and optional draft-only improvement candidate linkage.
- Default seed signals/baselines covering the seeded skills/harnesses/instructions plus a degraded skill, a stale instruction, and a high-cost harness example.
- Policy actions: `registry.drift.read`, `registry.drift.assess`, `registry.drift.recommend`, `registry.drift.create_candidate_future`, `registry.drift.auto_apply_future`. Default rules allow read/assess/recommend under metadata-only context; deny `create_candidate_future` and `auto_apply_future` by default.
- `registry_drift` `PolicyResourceKind`.
- Read-only API endpoints under `/registry/drift/*` and `/readiness/registry/drift/summary`.
- Dashboard read model `RegistryDriftReadModel` + `/dashboard/registry-drift` route + rendered panel + demo data provider entry + Dashboard/Readiness Tenant Scope plans.
- `/health.registryDrift` metadata.
- Deterministic tests in `tests/skill-harness-drift-detection-v1.test.ts`.
- Documentation: this plan + `v1.md` + cross-links.

## Out of Scope

- Real eval/canary execution.
- Real provider/MCP/LLM/vendor CLI calls.
- Production tenant enforcement.
- Persistent storage for signals/baselines/assessments.
- Live observability backend integration.
- Automatic improvement candidate generation that mutates registry state.

## Recommended Next Task

Eval Suite Execution Harness v1, or Canary Execution Harness v1.
