# Policy Bundle Plan v0

Planning only. No OPA, Cedar, external policy service, or dynamic policy runtime is implemented.

## Current State

Policy-as-code v0 uses static TypeScript rules in-process. The default rules are deny-by-default for unsafe Git, LLM, MCP, runner, Local Agent, secret, network, credential-cache, and improvement apply paths.

## Target Options

### OPA/Rego

- Mature policy runtime and bundle model.
- Good for complex contextual policies.
- Requires Rego review/testing and runtime integration.

### Cedar

- Strong authorization policy language.
- Good fit for principal/action/resource relationships.
- Requires entity model mapping and policy store management.

### Signed JSON/YAML Bundles

- Simple migration from current static rules.
- Easier to audit and diff.
- Requires schema validation, signing, promotion, and rollback.

## Rule Review Process

- Every policy change has owner, reviewer, test evidence, risk classification, and rollback plan.
- Deny rules for critical operations require security review.
- Break-glass policies require time-bound approval and audit.

## Versioning

- Policy bundle id and version.
- Source checksum.
- Signature metadata.
- Effective time.
- Target environment/profile.
- Rollback pointer.

## Policy Testing

- Unit tests for each rule.
- Golden decisions for Git, LLM, MCP, secrets, runner, Local Agent, registry, and auth.
- Production profile tests prove unsafe defaults are denied.
- No policy test may call external services.

## Break-glass

- Disabled by default.
- Requires named actor, ticket/reason, approval, expiry, scope, and audit.
- Must not expose raw secrets or bypass credential-cache denials.

## Rollout And Rollback

- Load new bundle in staging.
- Compare decisions against expected fixtures.
- Promote after approval.
- Keep previous bundle ready for rollback.
- Audit every bundle activation.

## Audit

Policy decisions must include policy decision id, bundle id/version once available, action, resource, actor/principal, decision, reason, matched rule ids, and sanitized metadata.
