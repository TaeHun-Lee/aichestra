# Staging Promotion Criteria v0

Status: v0_implemented
Scope: planning only

## Required Baseline

Before promotion from local/integration to staging:

- `pnpm lint` passes.
- `pnpm typecheck` passes.
- `pnpm test` passes.
- `pnpm build` passes.
- `git diff --check` passes.
- safe integration scan is classified.
- secret exposure scan has no unredacted findings.

## Integration Profile Requirements

Optional remote tests are not required for every staging promotion. If configured, they must pass under explicit gates. If skipped, the skip reason must be recorded.

## Staging Readiness Checks

Promotion requires:

- staging readiness summary available
- dashboard/API no-secret checks pass
- mock actor warning visible
- env fallback warning visible
- destructive operations disabled
- remote MCP disabled
- vendor CLI execution disabled
- production traffic disabled

## Optional Tests

Allowed skipped tests:

- optional Postgres when no non-production DB URL is configured
- optional remote Git when Real Git gates are absent
- optional GitHub App when integration-test profile is absent
- optional LLM Gateway integration-test profile v1 when remote LLM gates, model allowlist, budget cap, safe prompt class, and SecretRef/credential gate are absent
- remote MCP, external auth, and vendor CLI tests because they are future/blocked

## Approval Requirements

Staging promotion should require platform and security review once a real CI workflow is added. v0 records this only as readiness metadata.

## Rollback Conditions

Rollback is required on:

- secret/env value exposure
- external call outside explicit gates
- destructive Git operation enabled
- deployment workflow unexpectedly created
- production traffic enabled
- policy/Auth/RBAC/SecretRef/sandbox bypass

## Documentation Requirements

Any promotion-related change must update:

- staging profile docs
- environment gate matrix
- CI/CD job matrix
- integration gate policy
- phase audit

Promotion does not imply production deployment.
