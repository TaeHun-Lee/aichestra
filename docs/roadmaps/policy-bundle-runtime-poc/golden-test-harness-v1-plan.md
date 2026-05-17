# Policy Runtime PoC Golden Test Harness v1 Plan

Status: v1_implemented
Canonical path: `docs/roadmaps/policy-bundle-runtime-poc/`

This path follows `docs/README.md`: policy runtime PoC planning and follow-up readiness work live under `docs/roadmaps/`, while reusable inventories remain under `docs/reference/`. No older flat docs path is used.

## Current StaticPolicyEngine Behavior

`StaticPolicyEngine` is the only runtime policy engine. It evaluates static TypeScript rules in-process, denies by default, records matched rule ids, and never loads policy bundles, runs OPA/Rego, runs Cedar, calls a policy decision service, executes dynamic policy code, or hot reloads policy.

Current protected domains include Git, GitHub App token handles, GitHub webhook processing, LLM completion/routing/fallback, MCP tools, SecretRef/Vault credential resolution, Runner command execution, Local Agent invocation, Registry/Governance, Dashboard/readiness reads, and audit-related secret views.

## Current Policy Runtime PoC Planning v0 Behavior

Policy Bundle Runtime PoC Planning v0 documents runtime options, the normalized policy input/output contract, domain mappings, shadow evaluation planning, and golden decision requirements. It also exposes read-only readiness/dashboard metadata, but it does not implement an offline harness, shadow evaluator, runtime evaluator, or enforcement path.

## Target Harness Design

The v1 harness is an offline deterministic comparison tool:

- use `StaticPolicyEngine` as source of truth
- store reviewable typed golden fixtures
- normalize fixture input into `PolicyEvaluationRequest`
- map static decisions to PoC effects: `allow`, `deny`, or `block` for `require_approval`
- compare effect, reason, and first matched rule id
- summarize pass/fail counts and domain coverage
- fail tests on mismatches, missing required fields, or secret-like fixture values

The harness is not a runtime selector and does not affect application policy enforcement.

## Fixture Format

Fixtures live in `packages/policy/src/golden-cases.ts` because the repository currently keeps policy models and deterministic policy seed behavior in TypeScript package files rather than JSON imports. Each fixture includes:

- id
- description
- domain
- action
- subject
- resource
- environment
- context metadata
- expected decision effect, reason, and rule id
- risk level
- notes

Fixtures use the normalized contract from `policy-io-contract-v0.md` where current policy types support it. They contain ids, booleans, statuses, and safe metadata only.

## Decision Comparison Strategy

The harness compares:

- expected effect against mapped static effect
- expected reason against the deterministic static rule description or default-deny reason
- expected rule id against the first matched static rule id

The harness ignores generated decision ids and timestamps because those are intentionally runtime-generated.

## Domains Covered

The v1 fixtures cover:

- Git remote operation and destructive Git
- GitHub App token-handle issuance
- LLM remote completion, provider invocation, fallback, and disabled models/providers
- MCP critical/high-risk/secret/network/write/deploy and low-risk mock read-only cases
- SecretRef/Vault credential resolution, raw secret reads, credential caches, runner secret injection, and Local Agent secret forwarding
- Runner command execution and risky commands
- Local Agent consent and vendor CLI denial
- Registry mutation, pending approval, checksum mismatch metadata, governance apply, and auto-apply denial
- Dashboard/readiness safe read and raw secret-adjacent denial
- Tenant/scope metadata cases, including missing tenant and future mismatch metadata
- Service account non-bypass behavior

## No Dynamic Execution Guarantee

The harness does not:

- run OPA/Rego
- run Cedar
- parse or execute signed JSON/YAML bundles
- verify signed bundles
- use `eval`, `new Function`, or WebAssembly policy execution
- load local or remote policy bundles
- call external policy services
- call GitHub, LLM providers, MCP transports, Vault, Kubernetes, Temporal, cloud services, artifact registries, or external auth systems
- issue sessions, JWTs, API keys, service-account credentials, or provider tokens
- expose secrets or env values

## Future Bundle Runtime Usage

A future signed JSON/YAML bundle evaluator, OPA/Rego evaluator, Cedar evaluator, or shadow service can reuse the fixture shape by producing the same output contract for each case. Any future runtime must run after the static harness and must compare against the static source-of-truth decisions before shadow mode.

## What This Task Implements

- `golden-test-harness-v1-plan.md`
- `golden-test-harness-v1.md`
- typed golden fixtures in `packages/policy/src/golden-cases.ts`
- an offline deterministic harness in `packages/policy/src/golden-harness.ts`
- a read-only golden summary API endpoint
- dashboard metadata in the Policy Runtime PoC panel
- deterministic tests for fixture safety, harness results, API/dashboard summary, no dynamic execution, and no secret/env exposure
- docs and inventory updates

## Out Of Scope

- production policy runtime
- OPA/Rego runtime
- Cedar runtime
- signed JSON/YAML evaluator or signature verification
- shadow evaluator
- runtime enforcement
- production Auth/RBAC
- production tenant enforcement
- real provider calls
- dynamic policy execution
- remote policy loading
- hot reload
- mutation of policy bundles or active registry entries

## Blocker Assessment

No critical validation blockers were found. A few required cases are represented as current static metadata gates rather than full production enforcement because production tenant isolation and production registry governance remain future work. Those limitations are explicit in the fixture notes and do not block the offline harness.
