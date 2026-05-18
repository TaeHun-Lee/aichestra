# Eval Suite Execution Harness v1 Plan

## Chosen Docs Path

This repository groups feature history under `docs/features/<feature>/`. `docs/README.md` lists feature folders with `vN-plan.md` and `vN.md` files, so this plan uses `docs/features/eval-suite-execution-harness/v1-plan.md`.

## Current Registry Eval Metadata Behavior

Registry v2/v3 already supports local eval result attachment through `RegistryEvalResult` and `RegistryService.attachEvalResult`. Attached eval results can update a Skill, Harness, or Instruction `evalStatus` to `passed` or `failed`. This is metadata attachment only; no eval suite is executed by the registry service today. Resolver gates remain authoritative: non-active lifecycle, pending/rejected approval, failed/pending eval, checksum mismatch, unsupported semver, dependency errors, and policy deny keep registry entries from becoming selectable.

## Current Proposal Readiness Behavior

Auto-improvement v0 creates deterministic proposals and draft registry changes. Governance v1 evaluates `ProposalReadiness` using safety policy, governance decisions, required eval ids, attached proposal eval run metadata, canary readiness metadata, and draft-change status. Eval evidence is currently attached manually or by mock metadata; no eval harness executes suites.

## Current Governance / Apply Gate Behavior

Governance v1 records decisions, proposal eval runs, canary readiness, apply gates, and governance audit events. Apply remains unavailable: `ProposalApplyGate.canApply` stays false and includes `active_apply_not_implemented`. Auto-improvement safety defaults keep auto-apply disabled, human approval required, eval passed required, and canary required. Canary readiness is checked but no rollout executes.

## Current Compatibility Matrix Behavior

Skill / Harness Compatibility Matrix v1 is advisory metadata only. It evaluates task/repo/provider/runner/MCP/scope fit, reports registry gate failures as `blocked_by_registry_gate`, and never overrides resolver decisions. It does not run evals or canaries.

## Current Drift Detection Behavior

Skill / Harness Drift Detection v1 is advisory metadata only. It uses deterministic seed signals and can recommend `require_eval` or `require_canary`, but it does not execute eval suites, execute canaries, create active registry changes, or auto-apply proposals.

## Proposed Eval Suite Model

Eval Suite Execution Harness v1 will add a registry-owned deterministic eval harness with:

- `RegistryEvalSuite` for suite metadata and safety constraints.
- `RegistryEvalCase` for deterministic cases.
- `RegistryEvalRun` for requested/running/completed/blocked run metadata.
- `RegistryEvalCaseResult` for case-level verdicts.
- `RegistryEvalVerdict` for aggregate pass/fail/warning/skipped counts and apply/canary requirement flags.

Target kinds include Skill, Harness, Instruction, RegistryPackage, and DraftRegistryChange. Future live provider or external suites are modeled but blocked.

## Proposed Deterministic Mock Execution Strategy

Only `mock_deterministic`, `fixture_static`, `compatibility`, `drift_followup`, and local artifact-trust style suites may run in v1. `provider_live_future`, `external_future`, and `policy_golden_future` suites return blocked/future metadata. Execution is pure in-memory logic over existing registry package, compatibility, artifact trust, and drift metadata; it must not call LLMs, MCP tools, GitHub, vendor CLIs, policy runtimes, artifact registries, Vault, cloud services, or external auth systems.

Seed suites:

- `skill-required-metadata-suite`
- `harness-safety-suite`
- `instruction-compatibility-suite`
- `registry-package-artifact-trust-suite`
- `compatibility-matrix-suite`
- `drift-followup-suite`

## Proposed Result Attachment Strategy

The harness can attach an executed verdict to a registry Skill, Harness, or Instruction by calling the existing registry eval result attachment boundary with `evalType=mock`, `source=mock`, and metadata linking the eval run/verdict. This may update `evalStatus` when explicitly requested by the caller. For RegistryPackage and DraftRegistryChange targets, v1 records attachment metadata in the harness run only and does not mutate active registry entries or draft change payloads.

## Proposed Governance Readiness Integration

Eval runs can link to `proposalId` and `draftRegistryChangeId`. A passed verdict can be attached as proposal eval run metadata through the existing Governance v1 `ProposalEvalRunService`, preserving request/correlation attribution. Proposal readiness can then observe the attached eval metadata through existing Governance v1 behavior. Failed or warning verdicts remain visible and keep canary/apply readiness blocked by existing policy and apply gate behavior.

## Safety Constraints

- No real external eval suite execution.
- No real LLM, MCP, GitHub, Vault, Kubernetes, Temporal, OPA, Cedar, artifact registry, cloud, or external auth calls.
- No vendor CLI execution.
- No remote Git operations.
- No active registry mutation through auto-improvement.
- No auto-apply or canary execution.
- No registry lifecycle, approval, eval, checksum, semver, artifact trust, compatibility, tenant scope, policy, governance, or apply gate weakening.
- No secrets, env values, raw provider output, prompts, tokens, credential cache paths, or raw local paths in API/dashboard/readiness output.

## What This Task Implements

- Deterministic eval suite/case/run/result/verdict models and service.
- In-memory mock execution for safe local suites.
- Metadata-only registry eval result attachment for Skill/Harness/Instruction targets.
- Optional proposal eval metadata attachment for Governance v1 readiness.
- Policy actions for read, mock run, attach, and denied future external/override paths.
- API, readiness, health, dashboard visibility.
- Deterministic tests for successful, failing, warning, skipped/future, policy-denied, missing-target, attachment, governance readiness, apply/canary blocking, and no-secret/no-external-call behavior.

## Out Of Scope

- Real eval runners, real test process execution, external eval suites, hosted LLM calls, MCP/tool calls, vendor CLI execution, remote Git, dynamic policy runtime execution, real canary rollout, auto-apply, production tenant isolation, durable eval result storage, and production eval scheduling.
