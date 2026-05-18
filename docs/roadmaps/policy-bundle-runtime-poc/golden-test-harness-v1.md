# Policy Runtime PoC Golden Test Harness v1

Status: v1_implemented
Production-ready: no
Runtime policy engine: `StaticPolicyEngine`

Golden Test Harness v1 is the source-of-truth compatibility baseline for future policy runtime work. It uses `StaticPolicyEngine` decisions as canonical expected behavior and does not execute a candidate runtime.

Update: Policy Runtime Shadow Evaluator Skeleton v1 can consume the golden case metadata to build a deterministic mock comparison report. This report maps expected static decisions into a mock candidate result shape for tests only; it does not change golden expected decisions and does not execute a candidate runtime.

## Current Behavior

- Golden cases are deterministic and local.
- `StaticPolicyEngine` remains authoritative for expected decisions.
- Cases cover critical policy domains, including Git, LLM, MCP, Runner, Registry, Improvement, SecretRef, Secrets/Sandbox, Provider, Local Agent, Auth, Dashboard, and Deployment Readiness.
- The harness proves deny-by-default behavior, safety-gate preservation, no-secret behavior, and no dynamic policy execution.
- Runtime enforcement remains unchanged.

## Shadow Evaluation Link

Future shadow evaluation should feed each golden case through:

1. `StaticPolicyEngine` as source of truth.
2. The disabled/default shadow evaluator or deterministic mock evaluator skeleton.
3. A comparison layer that records, but never enforces, mismatches.

Golden cases must include the static decision, reason, matched rule ids, required obligations, redaction expectations, and audit metadata expectations. Candidate output must be normalized to that shape before comparison.

## Required Future Coverage

- Allow, deny, missing-input, and redaction cases per domain.
- Critical deny cases for destructive Git, raw secret reads, credential cache access, governance apply, critical MCP tools, runner command execution, remote LLM calls, and Local Agent dangerous actions.
- Tenant and request-context metadata once production Auth/RBAC and tenant scopes are implemented.
- No raw secrets, env values, tokens, credential caches, raw prompts, or raw provider responses in fixtures or reports.

## Out Of Scope

- Candidate runtime implementation.
- Candidate runtime execution.
- OPA, Cedar, signed bundle runtime, or external policy service calls.
- Runtime enforcement change.
- Production policy activation.

## Skeleton Report

Policy Runtime Shadow Evaluator Skeleton v1 exposes a read-only fixture report with golden case count, domains covered, mock comparison support, disabled evaluator status, and `enforcementChanged: false`. The report is static/local metadata and never makes `MockPolicyShadowEvaluator` a production runtime.
