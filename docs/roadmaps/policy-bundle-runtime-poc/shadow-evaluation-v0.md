# Policy Runtime PoC Shadow Evaluation v0

Status: planning/readiness only
Runtime impact: none

## Source Of Truth

`StaticPolicyEngine` remains the source of truth. A future PoC runtime may run only in shadow mode until explicit follow-up work implements and validates it.

Policy Runtime Shadow Evaluation Planning v1 now refines this v0 outline with future architecture, candidate runtime interface expectations, comparison rules, mismatch taxonomy, reporting, rollout/rollback, and read-only readiness/dashboard metadata. It still does not implement a shadow evaluator.

## Shadow Mode Rules

- Static decision is enforced.
- PoC runtime decision is recorded only.
- Mismatches are not enforced.
- PoC runtime errors deny nothing and allow nothing.
- A PoC output must not control Git, LLM, MCP, Runner, SecretRef, Vault, Local Agent, Registry, Governance, Dashboard, Observability, CI/CD, or staging behavior.

## Mismatch Severity Model

- `critical`: PoC allows something static denies, or output omits required redaction/secret obligations.
- `high`: PoC denies something static allows in a critical workflow, or drops required tenant/resource scope.
- `medium`: reason/rule id differs but decision and obligations match.
- `low`: audit metadata formatting differs without changing decision, scope, or redaction.

## Future Audit Event Design

Planned event type: `policy_runtime_poc_shadow_mismatch_future`

Fields:

- requestId
- correlationId
- actorId
- principalId
- serviceAccountId
- source
- action
- resourceKind
- resourceId
- tenantId
- staticDecision
- pocDecision
- mismatchSeverity
- staticRuleId
- pocRuleId
- policyBundleId
- policyVersion
- redactionRequirements

No event may include raw secrets, env values, provider tokens, credential cache paths, raw prompts, raw provider responses, or raw webhook payloads.

## Dashboard/Readiness Visibility

The read-only dashboard and readiness surfaces expose:

- current runtime: `StaticPolicyEngine`
- recommended PoC path
- option count
- domain mapping count
- golden case count
- golden harness pass/fail count
- readiness status
- risks
- runtime enforcement: `false`
- shadow evaluation implemented: `false`
- no-secret/no-env status

## Rollout Phases

1. Docs only.
2. Offline golden tests.
3. Shadow evaluator.
4. Selected non-critical enforcement.
5. Production enforcement future.

Current phase: offline golden tests implemented plus shadow evaluation planning v1. The shadow evaluator remains future-only.

## Rollback Strategy

Future rollback must disable any shadow evaluator or runtime selector and keep `StaticPolicyEngine` as the source of truth. A future runtime must never delete policy history or mismatch evidence. Rollback must preserve audit entries and prior bundle ids.

No shadow evaluator is implemented in v0 or v1 planning.
