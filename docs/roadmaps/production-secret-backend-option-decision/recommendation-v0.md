# Production Secret Backend Recommendation v0

Status: `v0_implemented`

## Recommended First Backend

Implement Vault first.

Target SecretRef provider value for v1: `vault`.

Target implementation path: backend interface refinements plus one concrete Vault-backed provider behind existing `packages/security` boundaries. Vault-backed Secret Backend v1 now implements this gated provider boundary without making Vault default or production-ready.

## Second Choice

AWS Secrets Manager is the second-choice backend if the first production deployment is explicitly AWS-first.

## Deferred Backends

- GCP Secret Manager: defer until GCP-first deployment is selected.
- Azure Key Vault: defer until Azure/Entra-first deployment is selected.
- Custom enterprise secret backend: defer until an enterprise platform and support owner are identified.

## Rejected Options

- EnvSecretProvider as production default: rejected.
- Mock secret provider as production backend: rejected.

## Rationale

Aichestra is not currently tied to one cloud. Vault provides the best first proof of the production SecretRef model because it supports leases, revocation, namespaces, policy, audit, self-hosting, and dynamic-secret futures. It is operationally heavier than cloud-native secret managers, but that complexity is visible and can be handled explicitly in the v1 scope.

## Assumptions

- Aichestra keeps stable SecretRef ids as application references.
- Backend reference/path/version metadata is safe only after sanitization review.
- Production Auth/RBAC remains a separate blocker.
- Policy-as-code remains authoritative and deny-by-default.
- Env fallback is local/integration only.

## Environment Constraints

Vault v1 should not assume production traffic. It should support:

- local mock default;
- integration mock client contract tests;
- optional skipped-by-default live Vault tests;
- future staging namespace or dev Vault instance;
- production only after Auth/RBAC, policy bundle, observability, and operator runbooks are ready.

## Risk Acceptance

Accepted for v1 planning:

- Vault operational complexity.
- No automatic migration in v1.
- Manual rotation first.
- Optional live tests skipped by default.

Not accepted:

- raw secret exposure;
- env fallback as production default;
- credential cache reads;
- Local Agent secret forwarding;
- BYOK/OAuth/WIF/IAM in v1;
- production readiness claim from v1 alone.

## Expected Implementation Effort

Medium to high. Most work should be in `packages/security`, with API/dashboard/readiness metadata updates and deterministic tests. No production deployment code is required.

## Expected Migration Path

1. Add Vault-backed provider class behind `SecurityControlService`.
2. Keep mock/env default behavior unchanged.
3. Add metadata-only SecretRef backend reference fields or reuse metadata safely.
4. Validate GitHub token, GitHub webhook secret, GitHub App private key metadata, and LLM API key flows with mock Vault client.
5. Add optional skipped live tests.
6. Use staging only after non-production Vault namespace and policy are available.
7. Block env fallback for production profile.

## Expected Testing Strategy

- Unit tests for config and provider behavior.
- Contract tests with fake/mock Vault client.
- Permission/policy denied tests before backend access.
- Missing/disabled/revoked SecretRef tests.
- No-secret/no-env health/API/dashboard tests.
- Skipped-by-default live tests behind explicit gates.

## Expected Rollback Path

Disable Vault provider gates and return provider integrations to mock/disabled behavior. Production rollback must not re-enable env fallback as the primary backend.
