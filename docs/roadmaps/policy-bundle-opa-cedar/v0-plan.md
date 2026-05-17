# Policy Bundle / OPA-Cedar Planning v0 Plan

Status: planned for implementation in this task
Canonical path: `docs/roadmaps/policy-bundle-opa-cedar/`

This path follows the current `docs/README.md` organization: production-oriented follow-up plans live under `docs/roadmaps/`, while reusable inventories live under `docs/reference/`. The existing `docs/roadmaps/production-deployment-readiness/policy-bundle-v0.md` remains the production readiness blocker summary; this directory is the detailed planning package for the policy bundle milestone.

## Current Policy-as-code v0 Behavior

Policy-as-code v0 is implemented in `packages/policy` as provider-neutral domain models, deterministic static TypeScript rules, a deny-by-default `StaticPolicyEngine`, policy decision audit entries, DTOs, API visibility, health metadata, and dashboard read models.

The default runtime remains static and mock-first. It does not load policy bundles, execute Rego, execute Cedar, call a policy decision service, evaluate dynamic code, hot reload policy, or verify signed bundles.

## Current Static Rule Catalog

The current rule catalog is code-defined in `packages/policy` through `createDefaultPolicyRules` and surfaced through `PolicyService.listRules()`. It covers:

- remote Git operation gates and destructive Git denials
- GitHub webhook verification and allowlist checks
- remote LLM completion, model/provider allowlists, budget gates, and fallback boundaries
- runner command execution and workspace policy
- registry mutation and improvement governance apply gates
- SecretRef credential resolution and raw secret denial
- sandbox/network egress denial
- MCP server/tool invocation risk controls
- Local Agent invocation, consent, PTY, vendor CLI, and credential-cache denial
- provider/local CLI boundaries

## Current Auth/RBAC Integration

Production Auth/RBAC v1 Planning exists as read-only readiness data. Runtime auth remains `MockAuthProvider` by default. `AuthorizationService` enriches policy subjects where practical, but production OIDC/SAML/SCIM, tenant enforcement, service-account credential issuance, and real session handling are not implemented.

Policy bundle planning must assume Auth/RBAC subjects are not production trustworthy yet. Future bundles must require principal, actor, role, service-account, tenant/workspace/project/repo, request id, and correlation context once production auth lands.

## Current SecretRef/Git/LLM/MCP/Runner/Local Agent Policy Domains

Current integrations call the static policy boundary before sensitive actions:

- SecretRef and CredentialManager block broad credential resolution before env provider access.
- Real Git Adapter v2 gates GitHub branch/PR operations and webhook processing behind policy and env allowlists.
- LLM Gateway v2 gates remote completion, provider/model use, virtual keys, budgets, and fallback.
- MCP Gateway v0 gates server/tool listing and invocation through Auth/RBAC, Policy, and redaction.
- Runner gates command execution, workspace access, and secret injection.
- Local Agent Protocol v1 gates invocation, consent, capability, PTY, vendor CLI, and credential-cache boundaries.

These domains are suitable for mapping into future bundles, but the current runtime remains static TypeScript.

## Current Production Blockers

Production readiness still requires:

- reviewed, versioned, rollback-capable policy bundles
- production Auth/RBAC and tenant-aware subjects
- durable policy audit and policy decision evidence
- separation of duties for policy authors/reviewers/approvers
- deny-by-default regression tests by domain
- break-glass governance that remains time-bound and audited
- externalized policy rollout/rollback controls
- production observability for policy deny rates and shadow evaluation mismatches

## Why Policy Bundle Management Is Needed

Static TypeScript rules are appropriate for the current mock/gated milestone because they are deterministic and easy to test. They are insufficient for production governance because policy changes are tied to code releases, cannot be independently reviewed or promoted as bundles, cannot support staged rollout/shadow evaluation, and do not provide a policy-specific rollback artifact.

## Engine Evaluation Scope

OPA/Rego:
- Strong for general policy-as-code, partial evaluation, broad ecosystem, and bundle distribution.
- Higher operational complexity and needs careful input schema control.
- Out of scope for v0 runtime execution.

Cedar:
- Strong for authorization-style policies, resource hierarchies, and human review.
- Less suitable for every operational gate without careful schema design.
- Out of scope for v0 runtime execution.

Signed JSON/YAML policy bundle:
- Good near-term bridge from static TypeScript to reviewable bundle artifacts.
- Easier to keep deterministic and mock-first while designing schemas and tests.
- Signing verification remains future work in v0.

## What This Task Implements

- Planning/readiness domain models in `packages/deployment-readiness`.
- Deterministic seed data for engine options, bundle plans, domain mappings, checks, risks, migration phases, and summary.
- Read-only `/readiness/policy-bundles/*` API endpoints.
- Safe `/health` policy bundle metadata.
- Dashboard policy bundle readiness panel.
- Documentation for engine options, bundle schema, domain mapping, review workflow, tests, rollout/rollback, break-glass, and v0 roadmap.
- Deterministic tests for models, API, dashboard, health, no dynamic execution, and no secret exposure.

## Follow-up Runtime PoC Planning

Policy Bundle Runtime PoC Planning v0, Policy Runtime PoC Golden Test Harness v1, and Policy Runtime Shadow Evaluation Planning v1 now live in `docs/roadmaps/policy-bundle-runtime-poc/`. They define how a future runtime proof-of-concept should be evaluated through normalized inputs, domain fixtures, golden decisions, future shadow comparison rules, mismatch taxonomy, and reporting, while still implementing no runtime evaluator or shadow evaluator.

## Out Of Scope

- Real OPA/Rego runtime integration.
- Real Cedar runtime integration.
- External policy decision service.
- Dynamic policy execution, `eval()`, `Function()`, WASM policy execution, or user-provided policy code.
- Remote policy loading or hot reload.
- Signed bundle verification.
- Production policy rollout, rollback, or break-glass execution.
- Any change to the current `StaticPolicyEngine` runtime behavior.

## Blocker Assessment

No critical validation blockers were found during repository inspection. The existing docs and code already have a consistent read-only Phase 5 readiness pattern, so implementation can proceed as a planning/readiness-only milestone.
