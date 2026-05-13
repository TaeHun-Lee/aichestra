# Policy Engine Options v0

Status: v0 planning
Runtime impact: none. `StaticPolicyEngine` remains the only runtime.

## Current Static TypeScript Rules

Strengths:
- Deterministic, testable, and safe for the current mock/gated milestone.
- No external service, no dynamic policy code, and no remote policy loading.
- Easy to integrate with existing Git, LLM, MCP, Runner, SecretRef, Registry, Improvement, Auth/RBAC, Local Agent, and Provider boundaries.

Weaknesses:
- Policy changes require application code changes and releases.
- Rules are not independently versioned, signed, promoted, or rolled back.
- Review experience is code-centric rather than policy-bundle-centric.
- Tenant and production Auth/RBAC subject contracts are not yet enforceable.

Production suitability: acceptable for the current scaffold only; not sufficient for production policy governance.

## OPA/Rego

Strengths:
- Mature policy-as-code ecosystem.
- Supports bundles, tests, decision logs, and partial evaluation.
- Good fit for cross-domain operational policy when input schemas are precise.

Weaknesses:
- Rego review is specialized.
- Production operation requires bundle distribution, version pinning, runtime ownership, and performance review.
- Poorly constrained inputs can create policy ambiguity.

Operational requirements:
- Stable policy input schemas.
- Signed or trusted bundle distribution.
- Golden decision tests and deny-by-default regression suites.
- Observability for decision latency, denials, and shadow mismatches.

Production suitability: strong candidate after schema, review, signing, and rollout controls exist.

## Cedar

Strengths:
- Human-readable authorization policy model.
- Good fit for principals, actions, resources, hierarchy, and scoped authorization.
- Aligns with Auth/RBAC and tenant/resource modeling.

Weaknesses:
- Less directly suited to every operational gate, such as runner command constraints or provider routing budgets, without careful modeling.
- Requires entity and schema design before safe evaluation.

Production suitability: candidate for authorization-heavy domains such as Auth/RBAC, dashboard access, registry access, SecretRef authorization, and Local Agent ownership.

## Signed JSON/YAML Policy Bundle

Strengths:
- Good near-term bridge from TypeScript rules to reviewable policy artifacts.
- Easier for domain owners to review if schema is narrow.
- Can be tested through deterministic golden decisions before any external engine is introduced.

Weaknesses:
- Needs a deliberately limited schema to avoid recreating an unsafe policy language.
- Signing and compatibility enforcement are future work.
- May eventually need OPA or Cedar for more expressive policies.

Production suitability: recommended near-term migration path before a full policy runtime is selected.

## Custom Future Policy Service

Strengths:
- Could be tailored to Aichestra-specific domains.

Weaknesses:
- Highest operational complexity.
- Creates a bespoke service boundary, availability concern, review model, and audit system.
- Should be avoided unless OPA, Cedar, and schema-driven bundles cannot satisfy production needs.

Production suitability: not recommended for the near term.

## Recommendation

Use a staged approach:

1. Keep static TypeScript rules as the runtime.
2. Define a signed JSON/YAML policy bundle schema and golden test fixtures.
3. Add non-executing bundle dry-run/readiness surfaces.
4. Evaluate OPA/Rego and Cedar against real domain fixtures.
5. Only later add controlled shadow evaluation and runtime activation behind explicit gates.

Static TypeScript policy remains acceptable for the current mock/gated milestone, but it is not production policy governance.
