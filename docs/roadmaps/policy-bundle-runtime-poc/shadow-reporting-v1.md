# Policy Shadow Reporting v1

Status: v1_implemented as planning metadata
Runtime impact: none

Shadow reporting v1 defines future report and observability shapes for comparing a candidate runtime against `StaticPolicyEngine`. It does not run comparisons and does not export telemetry.

## Report Format

Future `PolicyShadowEvaluationReport` records:

- `id`
- `generatedAt`
- `domain`
- `caseCount`
- `matchCount`
- `mismatchCount`
- `criticalMismatchCount`
- `enforcementChanged: false`
- `sourceOfTruth: StaticPolicyEngine`
- `candidateRuntimeKind`
- sanitized metadata

Per-case reports should include case id, domain, action, static decision, normalized candidate decision, comparison rule results, mismatch kinds, severity, and remediation pointers. Raw secrets, env values, raw prompts, raw provider responses, private keys, tokens, webhook secrets, credential caches, and unredacted logs must not appear.

## Dashboard Summary

`GET /dashboard/policy-shadow` shows:

- shadow status
- source of truth
- enforcement changed false
- candidate runtime implemented false
- shadow evaluator implemented false
- comparison rule count
- mismatch taxonomy count
- critical mismatch examples
- rollout stage
- no dynamic execution status
- no-secret/no-env status

The dashboard must not imply shadow evaluation is currently running.

## Readiness Endpoints

- `GET /readiness/policy-shadow/plan`
- `GET /readiness/policy-shadow/comparison-rules`
- `GET /readiness/policy-shadow/mismatches`
- `GET /readiness/policy-shadow/checks`
- `GET /readiness/policy-shadow/reports`
- `GET /readiness/policy-shadow/summary`

All endpoints are read-only and sanitized.

## Audit Events

Planned future audit events:

- `policy_shadow_evaluation_planned`
- `policy_shadow_case_compared_future`
- `policy_shadow_mismatch_detected_future`
- `policy_shadow_critical_mismatch_future`
- `policy_shadow_disabled_future`
- `policy_shadow_rollout_blocked_future`

v1 does not emit runtime shadow events.

## Metrics

Planned metrics:

- `policy_shadow.case_count`
- `policy_shadow.match_count`
- `policy_shadow.mismatch_count`
- `policy_shadow.critical_mismatch_count`
- `policy_shadow.mismatch_by_domain`
- `policy_shadow.mismatch_by_action`
- `policy_shadow.candidate_runtime_error_count`

No external observability export is implemented. Future metric snapshots must remain sanitized and tenant-aware before production use.

## Golden Case Linkage

Golden cases feed shadow evaluation first. A candidate runtime must pass offline golden comparison before live shadow is considered. Golden case ids should appear in reports, but case inputs must be redacted and normalized.

## Storage and Retention

v1 stores deterministic planning metadata only. Future report storage should use durable audit/read-model repositories with retention classes from Observability / Audit Retention v0. Reports must be scoped by domain, tenant/project/repo/provider/model where applicable, and redacted before dashboard exposure.

## No-Enforcement Guarantee

Every report must record `enforcementChanged: false`. Candidate decisions are evidence only and cannot allow, deny, block, require approval, mutate resources, or change active policy behavior.
