# Mock Actor Deprecation Plan v1

Mock actors stay available for local development and deterministic tests. They must be disabled for production traffic before production auth can be enabled.

## Where Mock Actors Exist Today

- `MockAuthProvider` is the default AuthProvider.
- `RequestContextResolver` accepts mock header actor overrides for local/API tests.
- Services use system/mock actor strings for internal tasks, Git, webhook, runner, registry, improvement, dashboard, and readiness paths.
- Dashboard and health intentionally surface mock auth warnings.

## Profile Policy

| Profile | Mock actor policy | Expected signal |
|---|---|---|
| local | allowed | informational warning |
| integration | allowed with warning | integration warning |
| staging | disabled after production AuthProvider exists | failing readiness until implemented |
| production | disabled | critical blocker until real auth and tenant scoping exist |

## Required Warnings

- `/health` must state production auth is disabled.
- `/health` must expose mock actor enabled as a boolean only.
- `/dashboard/auth-production` must show mock actor warning and no-token/no-session status.
- `/readiness/auth/summary` must mark production ready false.

## Migration Path

1. Keep mock actors for local/test.
2. Add production readiness warning for mock actor use.
3. Implement real AuthProvider and tenant scoping in a future task.
4. Reject mock header actor override in staging/production.
5. Replace broad system actor strings with scoped service accounts.

## Remaining Blockers

- No real OIDC/SAML/SCIM provider.
- No production session or token validation.
- No tenant-scoped repositories.
- No production service-account credential issuance.
- No break-glass workflow.
