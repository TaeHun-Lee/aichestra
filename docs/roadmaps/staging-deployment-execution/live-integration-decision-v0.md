# Staging Deployment Live Integration Decision Policy v0

Status: `v0_implemented`
Scope: planning/readiness only

Optional live integrations must be decided before future staging deployment execution. This document records decision criteria only; it does not run integration tests.

| Profile | Current support | Required before staging? | Default decision | Production impact |
|---|---|---:|---|---|
| Optional Postgres tests | supported when `AICHESTRA_TEST_DATABASE_URL` is configured | recommended, not always required | skipped unless explicitly requested | production DB readiness still blocked until production operations exist |
| Remote Git / GitHub App | GitHub App integration-test profile v1 | no, unless staging requires live Git | skipped unless all gates configured | production GitHub readiness still requires live validation |
| GitHub webhook | fixture/readiness support, live profile gated | no, unless staging requires live webhook | skipped/future unless approved | production webhook readiness still blocked |
| LLM Gateway | LLM Gateway integration-test profile v1 | no, unless staging requires live provider calls | skipped unless all gates configured | production LLM readiness still requires live validation |
| Vault | Vault Integration-Test Profile v1 | no, unless staging mandates real secret backend validation | skipped unless all gates configured | production secret backend not ready |
| MCP | real transport future/blocked | no | not applicable/future | production MCP readiness blocked |
| External auth | production auth future/blocked | no | not applicable/future | production auth readiness blocked |
| Vendor CLI | future/blocked | no | forbidden | production/local CLI readiness blocked |

Cleanup expectations:

- No broad path listing, write, delete, rotate, migration, auto-merge, force-push, branch deletion, or vendor CLI execution.
- Live tests must use non-production resources and explicit gates.
- Skipped status is acceptable for staging execution v0 when documented and production readiness remains false.
