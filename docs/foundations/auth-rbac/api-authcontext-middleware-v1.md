# API AuthContext Middleware Skeleton v1

Status: `v1_implemented`. Service Account Actor Boundary v1, Tenant/Repo/Provider Scope Model v1, and Production Auth Provider Skeleton v1 are also `v1_implemented`.

API AuthContext Middleware Skeleton v1 adds a single mock-first API ingress boundary for resolving `RequestContext` and `AuthContext` consistently across HTTP routes. It builds on RequestContext Propagation v1 and does not implement production authentication.

## What v1 Implements

- `ApiRequestContextMiddleware` in `apps/api/src/request-context-middleware.ts`.
- One cached `RequestContext` per API `IncomingMessage` where practical.
- Safe request id and correlation id resolution with generated fallbacks.
- Mock actor override support through the existing `x-aichestra-actor-id` mock/local header only.
- Dashboard and readiness source modes that use read-only viewer contexts.
- Explicit reason-tagged system context helper.
- Safe request context summaries for `/health` and `/auth/me`.
- Safe production auth provider skeleton metadata in request summaries: provider kind/status, `productionAuthEnabled=false`, `tokenValidationEnabled=false`, session boundary status, and identity mapping status.
- Optional tenant/team/project/resource scope metadata carried through API `RequestContext` values when supplied by mock/readiness helpers.
- API route integration in `apps/api/src/main.ts` for representative Auth, Policy, Security, Git, LLM, MCP, Local Agent, Dashboard, Readiness, Observability, provider, task run-agent, agent, Registry, and Governance routes where context is already practical.
- Deterministic tests in `tests/api-authcontext-middleware-v1.test.ts`.

## What v1 Does Not Implement

v1 does not implement OIDC, SAML, SCIM, SSO, login, logout, production sessions, JWT validation or issuance, API-key issuance, service-account credential issuance, password auth, external IdP calls, tenant isolation, or durable auth repositories.

It does not treat cookies, Authorization headers, bearer tokens, session ids, API keys, or provider credentials as authenticated identity. Production auth remains disabled.

## Middleware Design

`ApiRequestContextMiddleware` wraps `RequestContextResolver` instead of replacing it.

Core methods:

- `resolveApiContext(req, routeMetadata)` resolves and caches a context.
- `requireApiContext(req)` retrieves the cached context for route handlers.
- `resolveDashboardContext(req, routeMetadata)` and `resolveReadinessContext(req, routeMetadata)` force read-only source modes.
- `resolveSystemContext(req, reason, routeMetadata)` and `createSystemContext(reason, options)` require a non-empty reason.
- `withRequestContext(handler)` is a lightweight wrapper for future route extraction.
- `getSafeRequestContextSummary(context)` returns safe metadata only.

Source selection:

- `/dashboard/*` -> `dashboard`;
- `/readiness/*` -> `readiness`;
- `POST /git/github/webhooks` -> `webhook` metadata context;
- all other API routes -> `api`.

## Mock Auth Behavior

Default API requests use `MockAuthProvider` through `RequestContextResolver`. Safe mock actor headers are local/test convenience only and are not production authentication. Unsafe id-like headers are ignored and generated ids are used instead.

Dashboard and readiness routes use the read-only demo viewer context. They do not adopt mock actor override headers.

System contexts are explicit and reason-tagged. They remain mock/system metadata only and do not issue service-account credentials. System/service-initiated fallbacks that need service attribution can now use Service Account Actor Boundary v1 helpers instead of API middleware identities.

## Future Real Auth Integration Point

The middleware is the intended place for a future production `AuthProvider` and route permission matrix to attach after a separately reviewed auth implementation. Production Auth Provider Skeleton v1 only reports disabled provider selection metadata; it does not parse tokens, cookies, sessions, or IdP assertions. Future work must keep session/token parsing, IdP calls, cookie handling, and service-account credential handling behind explicit gates and SecretRef/policy boundaries.

## Policy Integration

The middleware does not weaken policy. Existing route handlers continue to use `AuthorizationService` and `PolicyService` where already wired. `AuthContext -> PolicySubject` mapping still carries request id, correlation id, source, roles, teams, auth mode, actor/principal metadata, mock actor markers, and optional scope metadata when present.

Policy denial remains authoritative for admin-like mock roles.

## Audit And Correlation Metadata

Because the context is resolved at API ingress, Auth/RBAC audit receives request/correlation/source metadata for every route where the handler reaches the ingress. Migrated route groups pass the cached context into service calls, so selected Policy, Security, Git, LLM, MCP, Local Agent, Runner, Registry, Governance, and Observability records continue to carry request id and correlation id.

Audit and summary metadata must not include raw headers, cookies, tokens, session ids, secret values, raw env values, raw prompts, raw provider responses, or credential-cache paths.

## Safe Metadata Rules

Safe summaries may expose:

- auth mode;
- auth mode category (`mock`, `system`, or `future`);
- actor kind;
- mock actor marker;
- source;
- request id/correlation id only where useful and not noisy;
- `productionAuthEnabled=false`.
- `authProviderKind` and `authProviderStatus`;
- `tokenValidationEnabled=false`;
- disabled/future session boundary and identity mapping status.

Safe summaries must never expose Authorization headers, cookies, bearer tokens, session ids, JWTs, API keys, secret values, SecretRef values, provider credentials, raw env values, or credential-cache paths.

## Route Integration

The API server resolves a context once near the start of `handleRequest`. Representative route groups now use `requireApiContext(request)` instead of constructing a fresh route-local context.

Covered or partially covered:

- `/auth/*`;
- `/policy/*`;
- `/security/credentials/*`;
- `/security/secrets/*`;
- `/git/*`;
- `/llm/*`;
- `/mcp/*`;
- `/local-agents/*`;
- `/providers/invoke`;
- `/agents/runs`;
- `/tasks/:id/run-agent`;
- `/registry/*` representative mutation/audit/package/resolver paths;
- `/improvement/*` representative proposal/governance/eval/canary/apply-gate paths;
- `/dashboard/*`;
- `/readiness/*`;
- `/observability/*`;
- `/health`.

## Remaining Gaps

- Registry and governance mutations now receive RequestContext on high-value paths, but compatibility actor fields and defaults remain for local callers and fixtures.
- Runner command execution and several read paths still use existing service/request fields rather than a typed `RequestContext`.
- GitHub webhook receiver/sync and GitHub App token-handle checks now use explicit mock service-account attribution, but production webhook/installation-token behavior remains out of scope.
- Dashboard, readiness, and observability are not tenant scoped.
- Production route permission enforcement is still future work.

Dashboard/Readiness Tenant Scope Planning v1 records the current dashboard/readiness route inventory and target scope/role requirements. It does not change API AuthContext Middleware behavior, does not treat Authorization headers or cookies as production auth, and does not enforce tenant filtering.

## Test Strategy

`tests/api-authcontext-middleware-v1.test.ts` covers:

- API, dashboard, readiness, and system context creation;
- cached context retrieval;
- generated request id/correlation id behavior;
- unsafe id header rejection;
- mock/system/future auth mode categorization;
- no token/cookie/secret storage;
- representative route propagation through Auth, Policy, Security, Git, LLM, MCP, Dashboard, Readiness, and Health;
- policy denial remaining authoritative.

Regression coverage remains in RequestContext Propagation v1, Auth/RBAC, Policy, SecretRef/Vault, Git, LLM, MCP, Dashboard, Observability, and staging/readiness tests.

`tests/production-auth-provider-skeleton-v1.test.ts` adds regression coverage that `Authorization` headers and cookies are not stored and future provider selection does not change the mock-first request context.

## Known Limitations

- Middleware is a skeleton, not an auth enforcement layer.
- Mock actor header overrides are still present for local/test compatibility.
- No tenant/workspace/project/repo scope is enforced.
- Request ids are correlation metadata, not security credentials.
- API responses expose only selected safe summaries; most route handlers use context internally.

## Recommended Next Task

Recommended next task: OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.
