# Phase 4 Auto-Improvement v0 Plan

## Current Phase 4 Preparation Capabilities

Phase 4 Preparation already provides:

- `FailureSignal`
- `FailureCluster`
- `ImprovementCandidate`
- `ImprovementProposal`
- `EvalRequirement`
- `CanaryRolloutPlan`
- `AutoImprovementSafetyPolicy`
- in-memory repository interfaces and services
- `/improvement/*` API visibility
- dashboard visibility
- tests proving preparation metadata does not mutate active registry entries

## Why Auto-Improvement v0 Is Safe To Start

The registry has lifecycle, approval, eval, checksum, audit, history, rollback, package, and mock authorization guardrails. Phase 4 Preparation added observation and proposal metadata without applying anything. That gives the project enough structure to add a deterministic mock engine that creates draft-only analysis/proposal artifacts while keeping active registries untouched.

## Why This Task Must Remain Mock-Only

This task validates architecture and safety boundaries before any provider integration exists. It must not call LLMs, use embeddings, call external services, run evals, execute canaries, approve proposals, or mutate active Skill, Harness, or InstructionArtifact records.

## What The Mock Engine Will Do

- Analyze a `FailureCluster`.
- Generate or reuse a deterministic `ImprovementCandidate`.
- Generate or reuse a draft `ImprovementProposal`.
- Prepare or reuse a `DraftRegistryChange`.
- Evaluate `ProposalReadiness`.
- Explain why auto-apply is blocked by default safety policy.

## What The Mock Engine Will Not Do

- No real LLM calls.
- No embeddings.
- No external network calls.
- No active registry mutation.
- No proposal auto-approval.
- No eval execution.
- No canary execution.
- No artifact registry, Git provider, MCP, Vault, Kubernetes, or Temporal integration.

## Draft Registry Change Safety

`DraftRegistryChange` is stored in `packages/improvement`, not in the registry package. It contains `draftPayload` metadata and `activeRegistryMutation = false`. There is no apply endpoint in v0. Status can move only through draft review states:

```text
draft -> awaiting_review | rejected | superseded
awaiting_review -> rejected | superseded
```

No transition activates or applies a change.

## Readiness Safety

`ProposalReadiness` reads the current `AutoImprovementSafetyPolicy`, eval requirements, and proposal status. The default policy blocks auto-apply with:

- `human_approval_required`
- `eval_pass_required`
- `canary_required`
- `auto_apply_disabled`

## Future Work

- Real provider integrations.
- Real proposal generation.
- Draft change review and apply workflow.
- Eval suite execution.
- Canary rollout execution.
- Production approval/RBAC.
- Persistent storage for Phase 4 artifacts.
