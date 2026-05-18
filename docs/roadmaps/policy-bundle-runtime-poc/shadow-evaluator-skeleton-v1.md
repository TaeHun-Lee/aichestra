# Policy Runtime Shadow Evaluator Skeleton v1

Status: v1_implemented
Production-ready: no
Runtime policy engine: `StaticPolicyEngine`
Default evaluator: `DisabledPolicyShadowEvaluator`
Enforcement changed: false

Policy Runtime Shadow Evaluator Skeleton v1 adds a disabled/mock comparison boundary for future policy runtime work. It can represent how a future candidate decision shape would be compared with `StaticPolicyEngine`, but it does not execute any real candidate runtime and never changes enforcement.

## What v1 Implements

- `PolicyShadowEvaluator` interface in `packages/policy`.
- `DisabledPolicyShadowEvaluator` as the default evaluator.
- `MockPolicyShadowEvaluator` for deterministic local tests and fixture reports.
- Shadow input, result, comparison, mismatch, status, summary, and golden fixture report models.
- Static fixture/golden-case mock report support over the existing Golden Test Harness v1 cases.
- Read-only evaluator metadata at:
  - `GET /readiness/policy-shadow/evaluator/status`
  - `GET /readiness/policy-shadow/evaluator/summary`
  - `GET /readiness/policy-shadow/evaluator/mismatch-types`
  - `GET /readiness/policy-shadow/evaluator/mock-report`
- Dashboard metadata for disabled evaluator status, mock comparison readiness, golden case coverage, and mismatch taxonomy.
- Planned/mock-only audit event names:
  - `policy_shadow_evaluator_status_checked`
  - `policy_shadow_evaluation_skipped`
  - `policy_shadow_mock_comparison_recorded`
  - `policy_shadow_mismatch_recorded_mock`

## What v1 Does Not Implement

- Real OPA/Rego runtime.
- Real Cedar runtime.
- Signed bundle verification runtime.
- Signed JSON/YAML bundle evaluator.
- External policy service calls.
- Dynamic policy execution, `eval()`, `new Function`, WASM policy execution, remote policy loading, hot reload, or policy-code upload.
- Production Auth/RBAC, sessions, JWTs, API keys, service-account credentials, tenant provisioning, or row-level security.
- Live shadow streams, live candidate runtime execution, or production enforcement.
- Any change to `StaticPolicyEngine` decisions.

## Evaluator Interface

`PolicyShadowEvaluator` exposes:

- `getStatus()`
- `evaluateShadow(input)`
- `compareDecisions(staticDecision, candidateDecision, context)`
- `summarizeResults(results)`

Every result keeps:

- `sourceOfTruthRuntime: StaticPolicyEngine`
- `enforcementChanged: false`
- `candidateRuntimeImplemented: false`
- `noDynamicPolicyExecution: true`
- `noSecretsExposed: true`
- `envValuesExposed: false`

## Disabled Evaluator

`DisabledPolicyShadowEvaluator` is the default boundary. It evaluates the static decision only so a read-only result can point at the authoritative decision. It does not supply or execute any candidate result. Returned shadow evaluations have status `disabled`, candidate runtime kind `disabled`, and comparison summary `candidate_runtime_not_executed`.

## Mock Evaluator

`MockPolicyShadowEvaluator` accepts a deterministic candidate decision object supplied by tests or fixture helpers. It compares that shape with the static decision and records mismatches only. The mock evaluator is not a production runtime and reports `candidateRuntimeImplemented: false`.

## Comparison Model

`PolicyShadowComparison` records whether these dimensions match:

- effect
- reason
- rule id set
- obligations
- redaction requirements
- required audit metadata

Mismatch records use only `record_only` or `block_rollout_future` as default actions. There is no `enforce_now` action.

## Golden Harness Relationship

The skeleton consumes Golden Test Harness v1 fixture metadata through helper functions. The static golden cases remain unchanged and still use `StaticPolicyEngine` as the source of truth. The mock report maps expected golden decisions into deterministic candidate shapes for comparison coverage; it does not run a real runtime.

The read-only report includes:

- `goldenCaseCount`
- `domainsCovered`
- `mockComparisonSupported`
- `shadowEvaluatorEnabled: false`
- `enforcementChanged: false`

## API And Dashboard Surfaces

The readiness and dashboard surfaces are read-only and sanitized. They show disabled evaluator status, candidate runtime implementation false, mock comparison readiness, golden fixture coverage, mismatch taxonomy, no dynamic execution, and no-secret/no-env guarantees.

They must not imply that live shadow evaluation, OPA/Cedar execution, signed bundle verification, or production policy enforcement is active.

## Known Limitations

- There is no candidate runtime adapter.
- Mismatch persistence is not durable.
- Audit events are planned/mock metadata only.
- Reports are fixture-based and local.
- Production Auth/RBAC and production tenant isolation are still future work.

## Recommended Next Task

Policy Runtime Shadow Evaluator Implementation Planning v1, or Signed JSON/YAML Bundle Schema v1.
