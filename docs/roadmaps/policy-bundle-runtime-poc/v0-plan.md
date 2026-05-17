# Policy Bundle Runtime PoC Planning v0 Plan

Status: v0_implemented
Canonical path: `docs/roadmaps/policy-bundle-runtime-poc/`

This path follows `docs/README.md`: cross-cutting integration and readiness planning packages live under `docs/roadmaps/`, while reusable inventories stay under `docs/reference/`. The older flat docs layout is not used.

## Current StaticPolicyEngine Behavior

`StaticPolicyEngine` remains the only runtime policy engine. It is deterministic, in-process, code-defined, deny-by-default, and integrated with Git, GitHub App token-handle checks, GitHub webhook processing, LLM routing/completion/fallback, MCP, Runner, Registry/Governance, SecretRef/Vault credential resolution, Local Agent, Auth/RBAC, Dashboard/Readiness, and Observability read paths.

Current behavior must remain unchanged:

- no OPA/Rego runtime
- no Cedar runtime
- no JSON/YAML bundle evaluator
- no external policy decision service
- no dynamic policy code execution
- no remote policy bundle loading
- no hot reload
- no production policy runtime activation

## Current Policy Bundle / OPA-Cedar Planning v0 Status

Policy Bundle / OPA-Cedar Planning v0 is already implemented as read-only readiness metadata under `docs/roadmaps/policy-bundle-opa-cedar/`, `packages/deployment-readiness`, `/readiness/policy-bundles/*`, `/dashboard/policy-bundles`, and `/health`.

That milestone compares engines, outlines bundle schema, maps policy domains, documents review, tests, rollout/rollback, and break-glass. It does not define the specific runtime proof-of-concept evaluation plan. This package fills that gap.

## Current RequestContext/AuthContext/ServiceAccount/Scope Metadata Status

RequestContext Propagation v1, API AuthContext Middleware Skeleton v1, Service Account Actor Boundary v1, Registry/Governance RequestContext Migration v1, and Tenant/Repo/Provider Scope Model v1 are implemented as mock-first metadata and attribution layers.

Current metadata can carry actor, principal, service account, roles, teams, request id, correlation id, source, tenant/team/project ids, and resource scope metadata. This is enough to define a future normalized policy input contract, but it is not production authentication or production tenant isolation.

## Current Policy Domain Coverage

The current static policy domains include:

- Git remote operation
- GitHub App token-handle issuance
- GitHub webhook processing
- LLM remote completion
- LLM fallback
- MCP tool invocation
- SecretRef and Vault credential resolution
- Runner command execution and secret injection
- Local Agent invocation
- Registry mutation and resolver gates
- Governance apply gates
- Dashboard/readiness access
- Observability audit query access

Detailed mappings live in `docs/roadmaps/policy-bundle-runtime-poc/domain-poc-mapping-v0.md`.

## Why A Runtime PoC Is Needed

Static TypeScript rules are appropriate for the MVP scaffold, but they are not enough for production policy governance. A future runtime PoC is needed to evaluate whether bundle-like policy artifacts can reproduce current decisions, include stable AuthContext/RequestContext/ServiceAccount/Scope inputs, emit auditable outputs, run in shadow mode, and support rollout/rollback planning without weakening existing gates.

## Candidate Runtime Options

The PoC compares:

- `StaticPolicyEngine` baseline
- OPA/Rego local library future
- OPA/Rego server or sidecar future
- Cedar local evaluator future
- signed JSON/YAML bundle evaluator future
- custom policy decision service future

Recommended PoC direction: signed JSON/YAML bundle evaluator first, using offline golden decision tests and later shadow evaluation against `StaticPolicyEngine`.

## PoC Boundaries

This task implements planning/readiness only:

- documentation package
- deterministic read-only readiness models
- read-only `/readiness/policy-runtime-poc/*` endpoints
- dashboard panel
- tests for no runtime execution and no secret/env exposure

## Safety Constraints

- `StaticPolicyEngine` remains source of truth.
- No runtime policy evaluator is implemented.
- No OPA/Rego, Cedar, WASM, eval, `new Function`, remote loading, hot reload, or external policy service is used.
- No GitHub, LLM, MCP, Vault, Kubernetes, Temporal, auth provider, artifact registry, or cloud call is added.
- No sessions, JWTs, API keys, service-account credentials, or production auth behavior is added.
- No secrets or env values are exposed.
- Existing Auth/RBAC, Policy, SecretRef, Git, LLM, MCP, Local Agent, Runner, Dashboard, Observability, Registry, Governance, Staging, CI/CD, and Secrets/Sandbox gates remain authoritative.

## What This Task Implements

- `docs/roadmaps/policy-bundle-runtime-poc/v0-plan.md`
- `runtime-options-v0.md`
- `policy-io-contract-v0.md`
- `domain-poc-mapping-v0.md`
- `shadow-evaluation-v0.md`
- `golden-decision-tests-v0.md`
- `v0.md`
- read-only readiness types, deterministic catalog data, service methods, DTOs, API endpoints, health metadata, dashboard read model, dashboard rendering, demo data, and tests

## Out Of Scope

- production policy runtime
- OPA/Rego execution
- Cedar execution
- signed bundle parsing or verification
- JSON/YAML evaluator implementation
- shadow evaluator implementation
- dynamic policy upload
- policy bundle loading from remote sources
- runtime policy enforcement
- production Auth/RBAC
- production tenant enforcement
- break-glass execution
- any external provider call

## Blocker Assessment

No critical validation blockers were found. The existing deployment-readiness package already supports read-only planning surfaces for similar milestones, so the PoC planning surface was added there. Runtime implementation remains blocked until a future explicit task.
