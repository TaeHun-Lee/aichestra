# Phase 4 Governance v1 Plan

## Current Phase 4 v0 capabilities

Phase 4 Auto-improvement v0 provides a deterministic, mock-only improvement path:

- `AutoImprovementAnalysis` captures deterministic analysis for a `FailureCluster`.
- `ImprovementCandidate` identifies a possible Skill, Harness, or Instruction improvement target.
- `ImprovementProposal` records a draft proposal without applying it.
- `DraftRegistryChange` records a proposed registry change without mutating active registry entries.
- `ProposalReadiness` explains why a proposal cannot be auto-applied.
- `AutoImprovementEngine` and `MockAutoImprovementEngine` provide provider-agnostic, deterministic behavior.
- Safety blockers include `human_approval_required`, `eval_pass_required`, `canary_required`, and `auto_apply_disabled`.

## Why Governance v1 is needed before real integrations

Auto-improvement can produce draft proposals, but real provider planning needs an explicit review surface before any generated change is trusted. Governance v1 adds the missing control layer:

- Proposal review queue.
- Recorded governance decisions.
- Local or mock eval run attachments.
- Canary readiness checks without rollout execution.
- Apply gate evaluation without apply behavior.
- Improvement governance audit events.

This keeps future integration work reviewable and traceable while preserving the current mock-first architecture.

## What this task will implement

- `ProposalReviewQueueItem` read model.
- `ProposalGovernanceDecision` model and service behavior.
- `ProposalEvalRun` model and attachment behavior.
- `CanaryReadiness` model and evaluator.
- `ProposalApplyGate` model and evaluator.
- Improvement governance audit events.
- API endpoints for review queue, decisions, eval runs, canary readiness, and apply gate.
- Dashboard visibility for governance state.
- Deterministic tests for governance, safety gates, APIs, and dashboard assumptions.

## What this task will not implement

- No real LLM calls.
- No embeddings.
- No external services.
- No real eval execution.
- No canary rollout execution.
- No apply endpoint that mutates active registry entries.
- No real provider integrations.
- No production authentication, SSO, SCIM, Vault, Kubernetes, Temporal, MCP, or artifact registry integration.

## Safety rules

- Active `SkillPackage`, `HarnessDefinition`, and `InstructionArtifact` records must remain unchanged.
- Governance decisions may update proposal status only.
- Eval runs are manually supplied or mock metadata only.
- Canary readiness checks only inspect existing canary plans.
- Apply gate always reports that active apply is not implemented.
- Draft registry changes remain inactive and cannot become active in v1.

## Active registry mutation remains blocked

Governance v1 does not add an apply operation. If an apply endpoint is exposed for API clarity, it must return a forbidden or not-implemented response and record an audit event. Proposal readiness and apply gate checks are explanatory, not mutating.

## Proposal governance audit

Governance v1 will add improvement-specific audit events for:

- Proposal decisions.
- Proposal approval/rejection/request-changes events.
- Eval run attachment.
- Canary readiness checks.
- Apply gate checks.
- Blocked apply attempts.

These events are separate from registry mutation audit logs because no registry mutation occurs.

## Future work

- Real auth/RBAC integration.
- Real eval execution.
- Canary rollout execution.
- Apply workflow with approval, eval, canary, rollback, and audit guarantees.
- Provider integrations and production operational controls.
