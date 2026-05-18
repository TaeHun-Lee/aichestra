# Policy Runtime Shadow Evaluation Planning v1

Status: v1_implemented
Production-ready: no
Runtime policy engine: `StaticPolicyEngine`
Enforcement mode: `shadow_only`

Policy Runtime Shadow Evaluation Planning v1 defines how a future candidate policy runtime will be compared against `StaticPolicyEngine` without changing enforcement.

Update: Policy Runtime Shadow Evaluator Skeleton v1 is implemented as a disabled/mock boundary in `packages/policy`. The default evaluator is disabled, the mock evaluator is deterministic test-only, and no candidate runtime is implemented or executed.

## What v1 Implements

- Shadow evaluation planning architecture.
- Candidate runtime interface expectations in documentation.
- Read-only planning models for:
  - `PolicyShadowEvaluationPlan`
  - `PolicyShadowComparisonRule`
  - `PolicyShadowMismatch`
  - `PolicyShadowEvaluationReport`
  - `PolicyShadowReadinessCheck`
  - `PolicyShadowEvaluationSummary`
- Mismatch severity taxonomy and rollout actions.
- Audit and observability event/metric plans.
- Dashboard/readiness reporting plan.
- Rollout and rollback stage plan.
- Sanitized read-only `/readiness/policy-shadow/*` endpoints.
- Disabled/mock evaluator skeleton metadata through `/readiness/policy-shadow/evaluator/*`.
- Read-only `/dashboard/policy-shadow` panel.
- Deterministic tests for model/API/dashboard/no-secret/no-env/no-execution behavior.

## What v1 Does Not Implement

- Live/running shadow evaluator.
- Candidate runtime implementation.
- Candidate runtime execution.
- OPA/Rego runtime.
- Cedar runtime.
- Signed bundle verification runtime.
- Dynamic policy execution, `eval`, `Function`, WASM policy execution, remote policy loading, or hot reload.
- External policy service calls.
- Production Auth/RBAC, sessions, JWTs, API keys, or service-account credentials.
- Production policy enforcement.
- Any change to `StaticPolicyEngine` behavior.

## Source Of Truth

`StaticPolicyEngine` remains the only runtime policy engine and the source of truth for enforcement. Candidate output is future evidence only. `enforcementChanged` is always false in v1 metadata and reports.

## Candidate Runtime Interface

Future candidate runtimes must support:

- `getRuntimeKind()`
- `getPolicyBundleVersion()`
- `evaluate(policyInput)`
- `validateBundle(bundle)`
- `listSupportedDomains()`
- `close()`

Candidate runtimes must run in shadow mode first and must never receive raw secrets, env values, tokens, private keys, webhook secrets, credential caches, raw prompts, raw provider responses, or unredacted logs.

## Comparison Rules

The comparison model covers:

- effect match
- reason match
- rule id match
- obligation match
- redaction match
- audit metadata match

Effect and redaction mismatches are critical when they could weaken static behavior. Candidate allow where static denies or blocks is rollout-blocking future behavior.

## Mismatch Taxonomy

v1 defines ten mismatch kinds:

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

## Reporting Plan

Reports include case, match, mismatch, and critical mismatch counts by domain and candidate runtime kind. The planning report remains zero executed cases because no candidate runtime exists. Skeleton v1 also exposes a static fixture mock report derived from Golden Test Harness v1 cases; it is local, deterministic, and never changes enforcement.

Dashboard and readiness surfaces show source of truth, counts, critical examples, rollout stage, no-enforcement guarantee, and no-secret/no-env status.

## Rollout and Rollback

Stages:

1. docs/planning
2. golden harness only
3. offline candidate runtime evaluation
4. live shadow evaluation, record-only
5. alerting on critical mismatch
6. selected non-critical enforcement future
7. production enforcement future

Rollback disables the future shadow evaluator, falls back to `StaticPolicyEngine`, invalidates the candidate bundle, records an audit event, and keeps enforcement unchanged.

## Dashboard and Readiness Behavior

Readiness endpoints:

- `GET /readiness/policy-shadow/plan`
- `GET /readiness/policy-shadow/comparison-rules`
- `GET /readiness/policy-shadow/mismatches`
- `GET /readiness/policy-shadow/reports`
- `GET /readiness/policy-shadow/checks`
- `GET /readiness/policy-shadow/summary`
- `GET /readiness/policy-shadow/evaluator/status`
- `GET /readiness/policy-shadow/evaluator/summary`
- `GET /readiness/policy-shadow/evaluator/mismatch-types`
- `GET /readiness/policy-shadow/evaluator/mock-report`

Dashboard endpoint:

- `GET /dashboard/policy-shadow`

These surfaces are read-only, sanitized, and must not claim shadow evaluation is running.

## Observability and Audit Planning

Planned events:

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

## Known Limitations

- No candidate runtime exists.
- A disabled/mock skeleton exists, but no live shadow evaluator or candidate runtime exists.
- Golden cases are the only current compatibility baseline.
- Reports are planning/readiness metadata only.
- Production Auth/RBAC and tenant-scoped enforcement are not implemented.
- Signed bundle verification and runtime policy activation remain future work.

## Recommended Next Task

Policy Runtime Shadow Evaluator Implementation Planning v1, or Signed JSON/YAML Bundle Schema v1.
