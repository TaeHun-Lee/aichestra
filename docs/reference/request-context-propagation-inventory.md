# RequestContext Propagation Inventory

Status: RequestContext Propagation `v1_implemented`; API AuthContext Middleware Skeleton `v1_implemented`; Service Account Actor Boundary `v1_implemented`; Registry/Governance RequestContext Migration `v1_implemented`; Tenant/Repo/Provider Scope Model `v1_implemented`.

This inventory classifies current propagation after the v1 slice. It is not a production auth readiness claim.

API route-level coverage is tracked in `docs/reference/api-authcontext-middleware-inventory.md`.

| Boundary | Files | Context Propagated | Actor Source Before | Actor Source After | PolicySubject Enriched | Audit Correlation Added | Remaining Gap | Production Impact |
|---|---|---:|---|---|---:|---:|---|---|
| API | `apps/api/src/main.ts`, `apps/api/src/request-context-middleware.ts` | yes/partial | route-specific actor strings and body actor ids | `ApiRequestContextMiddleware` cached ingress context plus `RequestContextResolver` helpers | partial | partial | route permission matrix and legacy actor fields remain | production auth still blocked |
| Auth/RBAC | `packages/auth/src/*` | yes | `MockAuthProvider` actor id | `RequestContext` -> `AuthContext` -> `AuthorizationService` | yes | yes | no real provider/session/token | mock-first only |
| Policy | `packages/policy/src/*` | yes | subject/body/default mock subject | AuthContext-derived subject when propagated | yes | yes | direct policy calls can still pass explicit subjects | deny-by-default preserved |
| Git | `packages/git-adapter/src/service.ts`, `packages/git-adapter/src/webhooks.ts`, `packages/git-adapter/src/github-app.ts`, `apps/api/src/main.ts` | partial | `mock-git-actor`, webhook/sync service strings | optional `RequestContext` on API paths plus `git_provider_service`, `git_webhook_service`, `git_sync_service`, and `github_app_token_service` fallbacks | partial | yes | production webhook replay/dead-letter and worker context persistence future | no remote operation enabled |
| LLM | `packages/llm-gateway/src/gateway.ts`, `apps/api/src/main.ts` | yes for route/completion | `mock-llm-actor` fallback | optional `RequestContext` on route/completion requests plus `llm_gateway_service`/`llm_router_service` fallbacks | yes | yes | some nested fallback metadata remains partial | remote LLM gates unchanged |
| MCP | `packages/mcp-gateway/src/gateway.ts`, `apps/api/src/main.ts` | yes for invocation/list auth | request actor/auth context or implicit mock admin fallback | optional `RequestContext` for invocation plus `mcp_gateway_service` fallback when no actor/auth is supplied | yes | yes | real transport remains disabled; tenant/server grants future | mock-only MCP preserved |
| Security/SecretRef/Vault | `packages/security/src/service.ts`, `apps/api/src/main.ts` | partial | actor id or `mock-admin` fallback | `RequestContext` preferred; `secretref_credential_service`/`vault_credential_resolver_service` service fallback | yes | yes | leases/sandbox/redaction are still partial | no secret/env exposure added |
| Runner | `apps/api/src/main.ts`, `packages/runner/src/service.ts` | partial | body actor or task requester | API metadata and actor id from `RequestContext` on representative run paths | partial | partial | typed runner `RequestContext` not added | command gates unchanged |
| Local Agent | `apps/api/src/main.ts`, `packages/llm-gateway/src/local-agent-protocol.ts` | partial | body actor/user id | API invocation creation uses request actor metadata | partial | partial | protocol service methods still explicit actor/user fields | no real daemon/transport |
| Registry/Governance | `apps/api/src/main.ts`, `packages/registry/src/index.ts`, `packages/improvement/src/index.ts` | partial | explicit actor ids/mock admin/mock auto-improvement | optional `RequestContext`/`AuthContext` on high-value registry/governance mutations plus `registry_governance_service` / `improvement_governance_service` service-account attribution | partial | yes | explicit actor compatibility fields and tenant/team scoping remain | apply gates unchanged; no production governance |
| Dashboard/Readiness | `apps/api/src/main.ts`, `apps/api/src/dashboard-read-model.ts` | partial | read-only mock/global view | API middleware source modes create safe dashboard/readiness contexts at ingress | partial | partial | no tenant/team scoping | read-only only |
| Observability | `packages/observability/src/service.ts`, `apps/api/src/main.ts` | yes when source events carry fields | normalized source metadata | request/correlation fields normalized from migrated audits | n/a | yes | only as complete as source event coverage | external export disabled |
| Tenant/Repo/Provider Scope Model | `packages/auth/src/scope-context.ts`, `packages/policy/src/resource-scope.ts`, `apps/api/src/main.ts`, dashboard read models | yes/partial | ad hoc repo/provider/model/secret/tool ids | optional tenant/team/project/resource scope metadata on AuthContext, RequestContext, PolicySubject, policy resources, audits, readiness, and dashboard | yes | partial | metadata-only; no tenant enforcement/filtering/RLS | production tenancy still blocked |

## Actor String Classification

Runtime actor strings remaining after v1:

- `mock-admin`: safe mock/system compatibility default.
- `mock-git-actor` and `mock-llm-actor`: documentation/planning references only after Service Account Actor Boundary v1; high-value runtime fallbacks now use service accounts.
- `mock-agent-actor`: mostly replaced on representative API run path; older fixtures may remain.
- `github-webhook-receiver` and `github-sync-service`: documentation/planning references only after Service Account Actor Boundary v1; runtime fallbacks now use `git_webhook_service` and `git_sync_service`.
- Registry/governance explicit actor fields: compatibility fallback after Registry/Governance RequestContext Migration v1; production cleanup and tenant/repo scoping remain future work.

Test fixtures and documentation references are not runtime gaps.

## Follow-up

Next implementation slice should add Dashboard/Readiness Tenant Scope Planning v1, or Tenant Scope Enforcement v1.
