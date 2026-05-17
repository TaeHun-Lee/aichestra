# Policy Test Strategy v0

Status: planning only

## Test Categories

- Unit policy tests for each domain rule.
- Golden decision tests matching current `StaticPolicyEngine` behavior.
- Integration decision tests at Git, LLM, MCP, Runner, SecretRef, Local Agent, Registry, and Auth boundaries.
- Deny-by-default regression tests for unknown actions and missing inputs.
- Secret exposure tests for tokens, env values, credential caches, raw prompts, raw payloads, and provider credentials.
- Tenant isolation tests for future tenant/workspace/project/repo scopes.
- Provider-specific tests for GitHub, OpenAI-compatible LLM, MCP, local agent, and provider abstraction gates.
- Break-glass tests that prove break-glass remains disabled until a future implementation.

## Fixture Strategy

Fixtures should be metadata-only and deterministic:

- no raw secrets
- no real provider calls
- no external policy services
- no remote bundles
- no dynamic policy code
- no production DB dependency

## CI Requirements

Future bundle CI must run:

- schema validation
- lint/static checks
- golden decision suite
- deny-by-default suite
- no-secret suite
- shadow decision comparison, once a future evaluator is implemented

## Coverage Expectations

Every production policy bundle must include at least one allow case, one deny case, one missing-input case, one tenant mismatch case, and one redaction/no-secret case for each target domain.

Policy Runtime Shadow Evaluation Planning v1 now defines how golden cases feed future shadow comparison, but no candidate runtime is executed and v0 does not implement a bundle test runner.
