# RequestContext Propagation v1

## Status

RequestContext Propagation v1 is implemented as a mock-first attribution and correlation layer.

Status:

- RequestContext Propagation: `v1_implemented`
- API AuthContext Middleware Skeleton: `v1_implemented`
- Service Account Actor Boundary: `v1_implemented`
- Tenant/Repo/Provider Scope Model: `v1_implemented`
- Production Auth/RBAC Planning: `v1_implemented`
- Production Auth Provider Skeleton: `v1_implemented`
- Phase 5: `preparation_started`

This is not production authentication.

## What v1 Implements

- Consolidated `RequestContext` and `CorrelationContext` models in `packages/auth`.
- `RequestContextResolver` helpers for API, system, test, webhook, dashboard, and readiness contexts.
- Expanded request sources: `api`, `worker`, `dashboard`, `readiness`, `system`, `test`, `webhook`, and `local_agent`.
- AuthContext-to-PolicySubject mapping with request id, correlation id, source, actor, principal, roles, teams, auth mode, service account id, and mock marker.
- Representative API propagation through Git, LLM, MCP, Security credential checks, Policy evaluation, Local Agent invocation creation, provider invocation, agent run creation, dashboard/readiness/observability read boundaries, and task agent-run paths.
- Optional `RequestContext` service parameters for migrated Git, LLM, MCP, and Security credential boundaries.
- Audit/correlation metadata in Auth, Policy, Git, LLM routing/audit, MCP invocation/audit, Security credential audit, and Observability normalization where source events expose those dimensions.
- API AuthContext Middleware Skeleton v1 now resolves one cached request context per API request where practical and exposes safe request-context summaries.
- Service Account Actor Boundary v1 now provides explicit mock service-account contexts for system/service-initiated fallbacks and adds serviceAccountId audit/policy metadata where migrated.
- Registry/Governance RequestContext Migration v1 now propagates RequestContext/AuthContext through representative registry mutation and governance/apply-gate paths.
- Tenant/Repo/Provider Scope Model v1 now adds optional tenant/team/project/resource scope metadata to RequestContext/AuthContext/PolicySubject and selected policy/audit/readiness/dashboard paths.
- Production Auth Provider Skeleton v1 now adds safe provider-selection metadata to AuthContext, RequestContext, and PolicySubject while keeping `MockAuthProvider` as the source of runtime auth.
- Deterministic tests in `tests/request-context-propagation-v1.test.ts`.

## What v1 Does Not Implement

v1 does not implement OIDC, SAML, SCIM, SSO, login/logout, sessions, JWTs, API keys, service-account credential issuance, tenant isolation enforcement, production auth enforcement middleware, external IdP calls, remote Git operations, live LLM calls, real MCP calls, Vault live calls, OPA/Cedar execution, provider CLI execution, or credential-cache reads.

## RequestContext Model

`RequestContext` carries:

- `requestId`
- `correlationId`
- `source`
- `authContext`
- `createdAt`
- sanitized `metadata`

`CorrelationContext` carries request/correlation ids plus optional trace, task, task run, actor, source, and sanitized metadata.

Neither context stores raw headers, Authorization headers, cookies, tokens, session ids, passwords, API keys, provider credentials, secret values, raw IdP claims, or credential-cache paths.

## RequestContextResolver

`RequestContextResolver` supports:

- `fromApiRequest` / `resolveFromApiRequest`
- `createSystemContext`
- `createTestContext`
- `createWebhookContext`
- `createDashboardContext`
- `createReadinessContext`
- `toCorrelationContext`

API contexts still use `MockAuthProvider` by default. Header actor override remains a local/test-only convenience and is not production authentication. System contexts require an explicit reason. Dashboard/readiness contexts use safe read-only mock metadata.

Future provider selection from Production Auth Provider Skeleton v1 is metadata only. Selecting a future provider reports blocked readiness but does not change `RequestContextResolver` authentication behavior from mock-first.

## API Propagation Strategy

The API now resolves request context at ingress through `ApiRequestContextMiddleware`, then route handlers retrieve the cached context with `requireApiContext`. Route handlers forward either `RequestContext` or `AuthContext` to service calls where the current signatures can accept it safely.

Implemented representative route coverage:

- `/auth/*`
- `/policy/evaluate`
- `/security/credentials/resolve/check`
- `/security/secrets/vault/resolve/check`
- `/git/*` branch/PR/changed-file operations
- `/llm/route`
- `/llm/completions`
- `/mcp/*`
- `/providers/invoke`
- `/local-agents/invocations`
- `/agents/runs`
- `/tasks/:id/run-agent`
- `/registry/*` representative mutation, audit, package, approval-queue, and resolver paths
- `/improvement/*` representative proposal, draft-change, decision, eval, canary, and apply-gate paths
- dashboard/readiness/observability read boundaries
- `/health` safe context summary without noisy ids

Read-only endpoints remain read-only.

## Service Propagation Strategy

Migrated services accept optional request context fields to avoid broad breaking refactors:

- Git branch, PR, and changed-file operations use RequestContext-derived actor/policy/audit metadata.
- LLM route/completion decisions and audit events carry request/correlation metadata.
- MCP tool invocation, validation, result, and audit paths carry request/correlation metadata.
- Security credential resolution uses `RequestContext` before falling back to `AuthContext` or actor id and records correlation metadata.
- Registry mutation and governance/apply-gate services accept optional `RequestContext`/`AuthContext` and record correlation metadata on migrated audit/read models.

Existing callers that do not pass request context keep deterministic mock/system behavior. High-value system/service fallbacks now use explicit mock service-account attribution where practical.

## PolicySubject Mapping

`AuthorizationService.toPolicySubject` is the central mapping. It now includes:

- `actorId`
- `principalId`
- `actorKind`
- `roles`
- `teams`
- `authMode`
- `serviceAccountId`
- `isMockActor`
- `requestId`
- `correlationId`
- `source`
- sanitized metadata
- safe production auth provider skeleton metadata (`authProviderKind`, `authProviderStatus`, `productionAuthEnabled=false`, `tokenValidationEnabled=false`, session boundary status, and identity mapping status)

Policy deny still wins. Admin-like mock roles do not bypass deny-by-default rules.

## Audit And Observability

Migrated audit sources include safe attribution fields:

- request id
- correlation id
- actor id
- principal id
- auth mode
- source

Observability v0 already normalizes these fields from top-level event fields or metadata, so the new fields appear in normalized audit envelopes where source events include them.

## Remaining Gaps

Not every actor string is removed. Some remain intentionally as fixtures, mock defaults, or compatibility fallbacks. The current inventory is maintained in `docs/reference/request-context-propagation-inventory.md`.

Known partial areas:

- Git webhook receiver/sync service actor defaults now use `git_webhook_service` and `git_sync_service`, but production webhook replay/dead-letter scoping remains future.
- GitHub App token internals now use `github_app_token_service` for token-handle checks, but no real installation-token issuance exists.
- Registry/governance mutation methods now accept RequestContext/AuthContext on high-value paths, but explicit actor compatibility fields remain.
- Runner command execution metadata is partially propagated through API metadata, not a full typed `RequestContext`.
- Dashboard/readiness do not implement tenant/team query scoping.
- API route permission matrix and production auth enforcement remain future work.
- Future provider hooks are explicit but disabled; no OIDC/SAML/SCIM token/session parsing is implemented.

Dashboard/Readiness Tenant Scope Planning v1 now inventories the dashboard and readiness surfaces that will need RequestContext tenant/team/project/repo/provider/model/secret/tool/package/host/audit scope fields. It exposes planning-only `/readiness/tenant-scope/*` and `/dashboard/tenant-scope` surfaces and keeps tenant filtering implemented false.

## Test Strategy

Coverage includes:

- resolver helper creation and no-secret metadata redaction;
- system context reason requirement;
- PolicySubject request/correlation/source enrichment;
- policy deny behavior;
- Git, LLM, MCP, and Security service propagation;
- representative API propagation;
- dashboard/readiness/observability no-secret regression.
- API AuthContext Middleware Skeleton v1 coverage in `tests/api-authcontext-middleware-v1.test.ts`.
- Service Account Actor Boundary v1 catalog/context/policy/audit coverage in `tests/service-account-actor-boundary-v1.test.ts`.
- Registry/Governance RequestContext Migration v1 coverage in `tests/registry-governance-request-context-migration-v1.test.ts`.
- Production Auth Provider Skeleton v1 metadata/no-token regression coverage in `tests/production-auth-provider-skeleton-v1.test.ts`.

## Recommended Next Task

Recommended next task: OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.

## OIDC readiness metadata

RequestContext propagation may carry only safe OIDC readiness metadata such as provider kind/status and disabled token-validation status. It must not carry token values, raw claims, cookies, Authorization headers, sessions, or env/secret values.
