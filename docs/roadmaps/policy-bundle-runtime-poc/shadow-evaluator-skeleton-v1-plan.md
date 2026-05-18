# Policy Runtime Shadow Evaluator Skeleton v1 Plan

Status: planned for implementation
Canonical path: `docs/roadmaps/policy-bundle-runtime-poc/`

This path follows `docs/README.md`: policy runtime PoC and shadow evaluation work lives under `docs/roadmaps/policy-bundle-runtime-poc/`, reusable inventories live under `docs/reference/`, and the static policy foundation lives under `docs/features/policy-as-code/`.

## Current StaticPolicyEngine Behavior

`StaticPolicyEngine` is the only runtime policy engine. It evaluates static TypeScript rules, returns deterministic policy decisions, and denies by default when no rule matches. It does not execute dynamic policy code, load local or remote policy bundles, verify signed bundles, call external policy services, or change behavior based on a candidate runtime.

`StaticPolicyEngine` remains authoritative for Git, GitHub App, LLM, MCP, Runner, Registry, Governance, SecretRef, Secrets/Sandbox, Provider, Local Agent, Auth/RBAC, Dashboard, Observability, Deployment Readiness, Tenant Scope, and related safety gates.

## Current Golden Test Harness v1 Behavior

Policy Runtime PoC Golden Test Harness v1 stores deterministic fixtures in `packages/policy/src/golden-cases.ts` and compares them against `StaticPolicyEngine` through `packages/policy/src/golden-harness.ts`.

The golden harness is offline and StaticPolicyEngine-only. It does not call OPA, Cedar, signed JSON/YAML runtimes, custom policy services, external providers, dynamic policy code, remote policy bundles, or shadow enforcement. Golden cases are the source-of-truth compatibility baseline for future candidate runtime comparisons.

## Current Shadow Evaluation Planning v1 Behavior

Policy Runtime Shadow Evaluation Planning v1 defines future architecture, candidate runtime interface expectations, comparison rules, mismatch taxonomy, reporting, rollout/rollback, readiness endpoints, and dashboard metadata. It is read-only planning metadata. It does not implement or run a shadow evaluator, candidate runtime, OPA/Rego, Cedar, signed bundle verification runtime, external policy service, or enforcement change.

## Proposed Shadow Evaluator Skeleton Design

Add a disabled/mock skeleton in `packages/policy`:

- `PolicyShadowEvaluator` interface with `getStatus`, `evaluateShadow`, `compareDecisions`, and `summarizeResults`.
- `DisabledPolicyShadowEvaluator` as the default implementation.
- `MockPolicyShadowEvaluator` for deterministic tests only.
- Candidate result shape for future normalized runtime output.
- Shadow evaluation input/result/comparison/mismatch/summary models.
- Static fixture/golden-case report helper that reports available golden cases and mock comparison readiness without executing a candidate runtime.

The skeleton compares already-provided candidate result shapes only. It does not execute candidate policy code, parse bundles, verify signatures, call external services, or alter enforcement.

## Disabled Evaluator Behavior

The disabled evaluator:

- returns `enabled: false`, `running: false`, `candidateRuntimeImplemented: false`, and `enforcementChanged: false`;
- returns `disabled` or `skipped` results for evaluations;
- records `sourceOfTruthRuntime: "StaticPolicyEngine"`;
- keeps candidate decisions absent unless explicitly provided by a test-only caller;
- reports no dynamic execution, no external calls, no OPA/Cedar/signed runtime execution, and no secret/env exposure.

## Mock Evaluator Behavior For Tests

The mock evaluator:

- accepts a deterministic mock candidate decision shape supplied by tests;
- compares it with a static decision from `StaticPolicyEngine` or an explicit static decision passed to `compareDecisions`;
- produces deterministic mismatch records for effect, reason, rule id, obligation, redaction, and audit metadata differences;
- can generate a static fixture/golden-case mock report;
- never executes policy code or calls a candidate runtime.

## Comparison Result Model

`PolicyShadowComparison` records:

- `effectMatches`
- `reasonMatches`
- `ruleIdMatches`
- `obligationsMatch`
- `redactionMatches`
- `auditMetadataMatches`
- `summary`

Effect and redaction mismatches are rollout-blocking future signals when they could weaken static behavior. They still remain record-only in v1.

## Mismatch Model

`PolicyShadowMismatchRecord` records:

- `mismatchKind`
- `severity`
- `domain`
- `action`
- `staticEffect`
- `candidateEffect`
- `reason`
- `defaultAction`
- sanitized metadata

`defaultAction` may be `record_only` or `block_rollout_future`. There is no `enforce_now` action.

## Read-only API and Dashboard Plan

Extend the existing policy shadow readiness surface:

- `GET /readiness/policy-shadow/evaluator/status`
- `GET /readiness/policy-shadow/evaluator/summary`
- `GET /readiness/policy-shadow/evaluator/mismatch-types`
- `GET /readiness/policy-shadow/evaluator/mock-report`

Extend `/dashboard/policy-shadow` with:

- evaluator enabled false;
- running false;
- candidate runtime implemented false;
- enforcement changed false;
- source of truth `StaticPolicyEngine`;
- golden cases available;
- mock comparison readiness;
- mismatch taxonomy;
- no dynamic execution;
- no-secret/no-env status.

## Safety Constraints

- No real OPA/Rego runtime.
- No real Cedar runtime.
- No signed bundle verification runtime.
- No replacement of `StaticPolicyEngine`.
- No enforcement decision changes.
- No dynamic policy code, `eval`, `Function`, WASM policy execution, remote policy loading, or hot reload.
- No external policy service calls.
- No GitHub, OpenAI, Anthropic, Gemini, Bedrock, LiteLLM, MCP, Vault, Kubernetes, Temporal, artifact registry, cloud service, or external auth calls.
- No production Auth/RBAC, sessions, JWTs, API keys, or service-account credentials.
- No secret or env value exposure.
- No weakening of existing Auth/RBAC, Policy, SecretRef, Git, LLM, MCP, Local Agent, Runner, Dashboard, Observability, Registry, Governance, Staging, CI/CD, Tenant Scope, or Secrets/Sandbox gates.

## What This Task Implements

- Shadow evaluator models in `packages/policy`.
- `PolicyShadowEvaluator` interface.
- Default disabled evaluator.
- Test-only deterministic mock evaluator.
- Static fixture/golden-case based skeleton report helper.
- Read-only readiness/API endpoints for evaluator metadata.
- Dashboard read-model additions for evaluator status and mock comparison readiness.
- Documentation, inventory references, tests, and checklist update.

## Out Of Scope

- Candidate runtime implementation or execution.
- OPA/Rego runtime.
- Cedar runtime.
- Signed JSON/YAML bundle runtime or verification.
- Dynamic policy execution.
- Remote or hot-loaded policy bundles.
- External policy services.
- Runtime enforcement changes.
- Production policy activation.
- Production Auth/RBAC.
- Durable shadow report storage.
- External observability export.

## Blocker Assessment

No critical validation blockers were found. The repository has a consistent split: `packages/policy` owns StaticPolicyEngine and the golden harness, while `packages/deployment-readiness`, API, and dashboard own read-only readiness metadata. The skeleton can be added without changing enforcement or introducing dynamic execution.
