# Service Account Actor Boundary v1

## Status

Service Account Actor Boundary v1 is implemented as a mock-first attribution boundary.

Status:

- Service Account Actor Boundary: `v1_implemented`
- RequestContext Propagation: `v1_implemented`
- API AuthContext Middleware Skeleton: `v1_implemented`
- Tenant/Repo/Provider Scope Model: `v1_implemented`
- Production Auth/RBAC Planning: `v1_implemented`
- Phase 5: `preparation_started`

This is not production service-account authentication.

## What v1 Implements

- Static mock service-account actor catalog in `packages/auth/src/service-account-catalog.ts`.
- `ServiceAccountContextFactory` in `packages/auth/src/service-account-context.ts`.
- `mock_service_account` auth mode for mock-first internal service attribution.
- Service-account principals, actors, roles, role bindings, and `ServiceAccount` metadata in the default Auth/RBAC catalog.
- `AuthContext -> PolicySubject` mapping with `actorKind=service_account`, `serviceAccountId`, request id, correlation id, source, roles, teams, auth mode, and mock marker.
- Optional tenant/team/project/resource scope metadata on service-account AuthContext, RequestContext, and PolicySubject values when a caller supplies mock/readiness scopes.
- Top-level and metadata-level `serviceAccountId` in Auth, Policy, LLM, MCP, Security, Runner, and Observability audit surfaces where migrated.
- High-value runtime fallback migration for Git provider, GitHub webhook receiver/sync, GitHub App token-handle checks, LLM gateway/router, MCP gateway internal fallback, Security credential resolution, Runner policy fallback, and Local Agent protocol policy fallback.
- Deterministic coverage in `tests/service-account-actor-boundary-v1.test.ts`.

## What v1 Does Not Implement

v1 does not issue real service-account credentials, JWTs, API keys, sessions, cookies, client secrets, installation tokens, or credential rotations. It does not implement OIDC, SAML, SCIM, SSO, login/logout, external IdP calls, artifact registry integration, Vault rollout, GitHub calls, LLM calls, MCP transport, vendor CLI execution, credential-cache reads, or production tenant isolation.

All active service accounts are local/mock metadata only. Future service accounts remain disabled/future.

## Service Account Actor Catalog

The catalog defines scoped service accounts for system/service-initiated operations:

| Service Account | Kind | Status | Primary Boundary |
|---|---|---|---|
| `git_webhook_service` | `git_webhook` | `active_mock` | GitHub webhook receive/verify metadata |
| `git_sync_service` | `git_sync` | `active_mock` | PR/branch/changed-file sync read models |
| `github_app_token_service` | `github_app_token` | `active_mock` | GitHub App token-handle policy checks |
| `git_provider_service` | `git_provider` | `active_mock` | Git provider fallback policy/audit |
| `llm_gateway_service` | `llm_gateway` | `active_mock` | LLM gateway fallback attribution |
| `llm_router_service` | `llm_router` | `active_mock` | LLM route/fallback policy attribution |
| `mcp_gateway_service` | `mcp_gateway` | `active_mock` | MCP low-risk mock invocation fallback |
| `vault_credential_resolver_service` | `vault_credential_resolver` | `active_mock` | Vault SecretRef credential resolution attribution |
| `secretref_credential_service` | `secretref_credential` | `active_mock` | SecretRef credential resolution attribution |
| `runner_service` | `runner` | `active_mock` | Runner policy fallback attribution |
| `local_agent_protocol_service` | `local_agent_protocol` | `active_mock` | Local Agent protocol policy fallback |
| `registry_governance_service` | `registry_governance` | `active_mock` | Registry mutation/request-context attribution |
| `improvement_governance_service` | `improvement_governance` | `active_mock` | Governance/apply-gate request-context attribution |
| `observability_read_service` | `observability_read` | `active_mock` | Future read-service attribution |
| `dashboard_read_service` | `dashboard_read` | `active_mock` | Future dashboard read-service attribution |
| `readiness_read_service` | `readiness_read` | `active_mock` | Future readiness read-service attribution |
| `migration_service_future` | `migration_future` | `future` | disabled future migration boundary |
| `deployment_service_future` | `deployment_future` | `future` | disabled future deployment boundary |

Each catalog entry includes id, display name, kind, optional owner team, allowed actions, forbidden actions, allowed resource scopes, status, risk level, audit requirements, and sanitized metadata. The catalog stores no credential values.

## ServiceAccountContextFactory

`ServiceAccountContextFactory` provides deterministic helper methods:

- `listServiceAccounts()`
- `getServiceAccount(id)`
- `requireServiceAccount(id)`
- `createServiceAccountAuthContext(serviceAccountId, options)`
- `createServiceAccountRequestContext(serviceAccountId, source, options)`
- `toPolicySubject(authContext, requestContext)`

Active mock service accounts create `AuthContext` values with:

- `actorKind=service_account`
- `authMode=mock_service_account`
- `serviceAccountId`
- roles and teams from the catalog
- request id, correlation id, source, and sanitized metadata
- `isMockActor=true`
- `productionAuthEnabled=false`

Unknown, disabled, and future service accounts fail deterministically. No helper emits credentials, tokens, cookies, raw headers, env values, JWTs, API keys, or service-account secrets.

## Request Context Integration

Service-account contexts reuse the RequestContext Propagation v1 model. Internal service paths can create explicit service-account `AuthContext` or `RequestContext` values without pretending that production auth exists.

API-request paths still prefer the request-derived human/mock context from API AuthContext Middleware Skeleton v1. Service-account contexts are for service-initiated fallback work, webhook/sync processing, token-handle checks, internal routing, credential resolution, and worker/system-style policy attribution.

## Policy Subject Integration

`AuthorizationService.toPolicySubject` remains the central mapping for `AuthContext -> PolicySubject`. Service-account subjects include:

- `actorId`
- `principalId`
- `actorKind=service_account`
- `serviceAccountId`
- roles
- teams
- `authMode=mock_service_account`
- request id
- correlation id
- source
- `isMockActor=true`
- sanitized metadata

Policy deny still wins. Service accounts do not bypass deny-by-default rules. Direct `secret.read`, credential-cache read/upload, runner secret injection, destructive Git operations, high-risk/critical MCP actions, Local Agent secret forwarding, and improvement apply remain denied.

Service-account allow rules remain scoped to existing static policy actions. `service_account_mcp_gateway` may use the low-risk mock MCP allow rules, while `service_account_registry_governance` and `service_account_improvement_governance` are limited to registry/governance metadata gates; `improvement.apply` remains denied. MCP rules still require mock server, active tool, low risk, read-only, no secrets, no network, no write/deploy, no real transport, and no local execution.

## Audit And Correlation Behavior

Migrated audit records include safe service-account attribution where available:

- `serviceAccountId`
- `actorKind=service_account`
- request id
- correlation id
- source
- auth mode
- policy decision id
- authorization decision id

Observability normalization now surfaces `serviceAccountId` from top-level fields or source metadata. Audit sanitizers continue to redact token, secret, password, cookie, authorization, API key, session, and credential-like metadata keys.

## Migrated Boundaries

- Git provider fallback now uses `git_provider_service`.
- GitHub webhook receiver now uses `git_webhook_service`.
- GitHub sync service now uses `git_sync_service`.
- GitHub App runtime/token-handle checks now use `github_app_token_service`.
- LLM gateway fallback attribution uses `llm_gateway_service`.
- LLM route/fallback policy attribution uses `llm_router_service`.
- MCP invocation fallback without request/auth actor uses `mcp_gateway_service`.
- Security credential fallback uses `secretref_credential_service` or `vault_credential_resolver_service` based on SecretRef provider metadata.
- Runner policy fallback uses `runner_service`.
- Local Agent protocol policy fallback uses `local_agent_protocol_service`.
- Policy, LLM, MCP, Security, Runner, Auth, and Observability audit types can carry service-account metadata.

## Remaining Gaps

- Registry/Governance mutation methods now accept RequestContext/AuthContext on high-value paths, but explicit actor compatibility fields remain.
- Dashboard/readiness/observability read services are cataloged but not fully migrated to typed service-account read contexts.
- Runner run/audit paths still do not accept a full typed `RequestContext`.
- Local Agent protocol migration is partial; user/host ownership and consent scope need a separate pass.
- Some compatibility actor fields remain for old API/body callers and fixtures.
- Production tenant/team/project/repo scoping remains future work.

## Test Strategy

`tests/service-account-actor-boundary-v1.test.ts` covers:

- catalog entries and disabled/future rejection;
- no credentials in service-account catalog/context metadata;
- service-account AuthContext, RequestContext, and PolicySubject creation;
- serviceAccountId propagation into PolicySubject;
- policy denial for secret read, credential-cache read, runner secret injection, and destructive Git;
- Git provider and webhook service-account audit attribution;
- LLM, MCP, and Security fallback audit attribution;
- no-secret/no-env regression.

Existing RequestContext, API middleware, MCP, Auth/RBAC, Policy, SecretRef/Vault, Git, LLM, Dashboard, and Observability suites remain regression coverage.

## Known Limitations

- This is an attribution boundary, not production service-account authentication.
- Service-account roles are static mock catalog entries.
- There is no credential lifecycle, rotation, revocation workflow, or durable management API.
- Internal service-account fallback is intentionally narrow and non-invasive.
- Future production auth must review tenant scoping, route permission matrix, durable service-account repository behavior, and credential lifecycle separately.

## Recommended Next Task

Recommended next task: Dashboard/Readiness Tenant Scope Planning v1, or Tenant Scope Enforcement v1.
