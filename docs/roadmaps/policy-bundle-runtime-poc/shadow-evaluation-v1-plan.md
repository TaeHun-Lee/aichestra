# Policy Runtime Shadow Evaluation Planning v1 Plan

Status: v1_implemented
Canonical path: `docs/roadmaps/policy-bundle-runtime-poc/`

This path follows `docs/README.md`: roadmap packages live under `docs/roadmaps/`, reusable inventories under `docs/reference/`, and policy-as-code foundations under `docs/features/policy-as-code/`. The older detailed engine comparison remains in `docs/roadmaps/policy-bundle-opa-cedar/`; this folder owns the runtime PoC shadow evaluation planning package.

## Current StaticPolicyEngine Behavior

`StaticPolicyEngine` is the only runtime policy engine. It evaluates static TypeScript rules, sorts matching rules by priority, returns the first matching effect, and denies by default when no rule matches. It never executes dynamic policy code, loads remote bundles, calls external policy services, or verifies signed bundles.

The static rules currently protect Git, GitHub webhook, LLM, MCP, Runner, Registry, Improvement governance, SecretRef, Secrets/Sandbox, Enterprise Provider, Local Agent, Auth/RBAC, Dashboard, and Deployment Readiness domains. Existing domain gates remain authoritative.

## Current Golden Test Harness v1 Behavior

Golden Test Harness v1 treats `StaticPolicyEngine` as source of truth. Golden cases are deterministic, local, and designed to cover critical allow/deny, missing-input, redaction, and audit expectations. They do not call a candidate runtime and do not change enforcement.

Future shadow evaluation will use golden cases as the first input set before any live shadow path exists.

## Current Policy Runtime PoC Planning v0 Behavior

Policy Runtime PoC Planning v0 documents the future runtime path without implementing it. Policy Bundle / OPA-Cedar Planning v0 compares static TypeScript, signed JSON/YAML bundles, OPA/Rego, Cedar, and custom future services, but keeps `StaticPolicyEngine` as runtime.

The recommended near-term candidate remains a schema-driven signed JSON/YAML evaluator, with OPA/Rego and Cedar only as future candidates.

## Proposed Shadow Evaluation Architecture

1. Static policy decision is evaluated first and remains authoritative.
2. A future candidate runtime may receive a sanitized `policyInput` in shadow mode only.
3. Candidate output is normalized into the same comparison shape as the static decision.
4. A comparison layer evaluates effect, reason, rule id, obligations, redaction, and audit metadata.
5. Mismatches are recorded into read-only reports, audit events, and metric snapshots.
6. Enforcement always follows the static decision. Candidate output cannot allow, deny, block, or require approval.

The v1 implementation adds read-only planning models, readiness endpoints, and dashboard metadata only. It does not implement the evaluator.

## Candidate Runtime Interface Expectations

Future `CandidatePolicyRuntime` implementations must expose:

- `getRuntimeKind()`
- `getPolicyBundleVersion()`
- `evaluate(policyInput)`
- `validateBundle(bundle)`
- `listSupportedDomains()`
- `close()`

Evaluation output must include decision, reason, rule id, obligations, redaction requirements, audit metadata, and runtime metadata. Candidate runtimes must never receive raw secrets, env values, tokens, raw prompts, raw provider responses, webhook secrets, private keys, or credential cache contents.

## Static-vs-Candidate Comparison Rules

Required comparison rules:

- `effect_match`: required, critical on mismatch.
- `reason_match`: optional in v1, medium on mismatch.
- `rule_id_match`: required, high on mismatch.
- `obligation_match`: required, high on mismatch.
- `redaction_match`: required, critical on mismatch.
- `audit_metadata_match`: required, medium on mismatch.

Any static deny or block paired with a candidate allow must block future rollout review. v1 records taxonomy and readiness only.

## Mismatch Taxonomy

Mismatch kinds:

- `static_allow_candidate_deny`
- `static_deny_candidate_allow`
- `static_block_candidate_allow`
- `reason_mismatch`
- `rule_id_mismatch`
- `missing_obligation`
- `extra_obligation`
- `redaction_mismatch`
- `audit_metadata_mismatch`
- `error_in_candidate`

Severity values are `info`, `low`, `medium`, `high`, and `critical`. Default actions are `record_only`, `alert_future`, and `block_rollout_future`.

## Audit and Observability Plan

Planned audit events:

- `policy_shadow_evaluation_planned`
- `policy_shadow_case_compared_future`
- `policy_shadow_mismatch_detected_future`
- `policy_shadow_critical_mismatch_future`
- `policy_shadow_disabled_future`
- `policy_shadow_rollout_blocked_future`

Planned metrics:

- shadow case count
- match count
- mismatch count
- critical mismatch count
- mismatch by domain
- mismatch by action
- candidate runtime error count

No external observability export is implemented.

## Dashboard and Readiness Plan

Read-only readiness endpoints:

- `GET /readiness/policy-shadow/plan`
- `GET /readiness/policy-shadow/comparison-rules`
- `GET /readiness/policy-shadow/mismatches`
- `GET /readiness/policy-shadow/checks`
- `GET /readiness/policy-shadow/summary`
- `GET /readiness/policy-shadow/reports`

Dashboard endpoint:

- `GET /dashboard/policy-shadow`

The dashboard must show `StaticPolicyEngine` as source of truth, `enforcementChanged: false`, `candidateRuntimeImplemented: false`, `shadowEvaluatorImplemented: false`, no dynamic policy execution, no external service calls, and no-secret/no-env status.

## Rollout Stages

1. Docs/planning.
2. Golden harness only.
3. Offline candidate runtime evaluation.
4. Live shadow evaluation, record-only.
5. Alerting on critical mismatch.
6. Selected non-critical enforcement future.
7. Production enforcement future.

## Safety Constraints

- `StaticPolicyEngine` remains source of truth.
- Enforcement mode is `shadow_only`.
- No candidate runtime execution in v1.
- No OPA/Rego or Cedar runtime.
- No signed bundle verification runtime.
- No dynamic policy execution, `eval`, `Function`, WASM, remote policy loading, hot reload, or external policy service call.
- No production Auth/RBAC implementation.
- No sessions, JWTs, API keys, or service-account credentials.
- No secret or env value exposure.
- No weakening of existing Auth/RBAC, Policy, SecretRef, Git, LLM, MCP, Runner, Dashboard, Observability, Registry, Governance, Staging, CI/CD, Tenant Scope, or Secrets/Sandbox gates.

## What This Task Implements

- Read-only planning models for shadow plans, comparison rules, mismatches, reports, readiness checks, and summary.
- Deterministic seeded planning data in `packages/deployment-readiness`.
- Sanitized DTOs.
- Read-only `/readiness/policy-shadow/*` endpoints.
- `/dashboard/policy-shadow` read model and dashboard panel.
- Documentation for candidate interface, taxonomy, reporting, rollout/rollback, and v1 summary.
- Deterministic tests for models, APIs, dashboard, no enforcement change, no dynamic execution, and no secret/env exposure.

## Out Of Scope

- Shadow evaluator implementation.
- Candidate runtime implementation or execution.
- OPA/Rego runtime.
- Cedar runtime.
- Signed bundle verification runtime.
- Production policy enforcement.
- Production Auth/RBAC.
- External calls or external observability export.
- Any change to `StaticPolicyEngine` behavior.

## Blocker Assessment

No critical validation blockers were found. The repository already has a consistent read-only deployment-readiness pattern, so v1 proceeds as planning/readiness metadata only.
