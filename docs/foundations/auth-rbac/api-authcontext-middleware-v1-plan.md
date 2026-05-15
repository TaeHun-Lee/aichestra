# API AuthContext Middleware Skeleton v1 Plan

Path choice: `docs/README.md` places Auth/RBAC foundation documents under `docs/foundations/auth-rbac/`. This pre-implementation plan lives beside `request-context-propagation-v1.md`. No `design_docs/` directory is present.

## Current RequestContext Propagation v1 Behavior

RequestContext Propagation v1 is implemented as a mock-first attribution and correlation layer. `packages/auth` owns `RequestContext`, `CorrelationContext`, `RequestContextResolver`, `AuthContext`, and `AuthorizationService`.

Current behavior:

- API contexts can be resolved with `RequestContextResolver.resolveFromApiRequest`.
- System, test, webhook, dashboard, and readiness contexts have explicit resolver helpers.
- `AuthContext` maps to `PolicySubject` with actor id, principal id, actor kind, roles, teams, auth mode, mock actor marker, request id, correlation id, source, and sanitized metadata.
- Representative Git, LLM, MCP, Security, Local Agent, task run-agent, dashboard/readiness, and observability paths already accept or record selected request/correlation metadata.
- Production Auth/RBAC remains planning/mock-first only.

## Current API Context Resolution Behavior

`apps/api/src/main.ts` currently resolves request context route-by-route. Some route groups call the resolver directly, some read-only route groups create dashboard/readiness contexts only for attribution, and some legacy routes still rely on body actor ids or service defaults.

Current high-value routed context use:

- `/auth/*` resolves API context for read and authorization-check paths.
- `/policy/evaluate*` resolves API context for default `PolicySubject` mapping.
- `/security/credentials/*` and Vault resolve checks pass `RequestContext` into `SecurityControlService`.
- `/git/*` resolves context for selected branch, PR, changed-file, and GitHub App token-check paths.
- `/llm/route` and `/llm/completions` pass context into the LLM gateway.
- `/mcp/*` resolves context for list, invoke, and audit gates.
- `/local-agents/invocations` and provider invocation paths pass selected actor/correlation metadata.
- `/dashboard/*`, `/readiness/*`, and `/observability/*` are read-only but use context inconsistently.

There is not yet a single API ingress helper that resolves one context per request and offers safe summaries to handlers.

## Current Manual Context Construction Patterns

Patterns found in `apps/api/src/main.ts`:

- direct `context.requestContextResolver.resolveFromApiRequest(request)` in route groups;
- direct `createDashboardContext` or `createReadinessContext` calls for read-only boundaries;
- body actor fallback fields such as `actorId`, `userId`, `approvedBy`, and `requestedBy` in older registry, governance, runner, Local Agent, and security paths;
- service-specific fallback actors such as `mock-admin`, `mock-git-actor`, and service actors in GitHub App/webhook internals;
- auth check target contexts created from explicit body fields for `/auth/authorize/check`.

Fixtures and deterministic mock actor references are valid test or local-mode behavior and should not be blindly removed.

## Proposed Middleware Design

Add an API-local helper, `ApiRequestContextMiddleware`, that wraps `RequestContextResolver` without adding production authentication.

The helper should:

- resolve one `RequestContext` per `IncomingMessage` and cache it with a `WeakMap`;
- choose source mode by route metadata: dashboard routes use `dashboard`, readiness routes use `readiness`, system contexts require explicit reason, and other routes use `api`;
- accept only safe request/correlation id headers and safe mock actor override headers;
- generate request id and correlation id when absent or unsafe;
- never parse sessions, validate JWTs, read cookies as auth, store raw headers, or store Authorization headers;
- expose `resolveApiContext`, `requireApiContext`, `createSystemContext`, `withRequestContext`, and `getSafeRequestContextSummary`;
- keep `MockAuthProvider` as the default and mark `productionAuthEnabled=false`.

This middleware is a skeleton ingress boundary. It is not an auth-enforcing production middleware.

## Route Integration Strategy

Resolve a context at the start of `handleRequest` after URL and method parsing. Route handlers should then call `requireApiContext(request)` or use the already-resolved context instead of constructing another context.

Initial route targets:

- `/auth/*`;
- `/policy/*`;
- `/security/credentials/*` and `/security/secrets/*`;
- `/git/*`;
- `/llm/*`;
- `/mcp/*`;
- `/local-agents/*`;
- `/dashboard/*`;
- `/readiness/*`;
- `/observability/*`;
- representative task/agent/provider boundaries where context already exists.

Read-only route behavior must stay read-only. Existing policy and Auth/RBAC checks must remain authoritative.

## Safety Constraints

This task must not:

- implement OIDC, SAML, SCIM, SSO, login, logout, sessions, JWTs, API keys, or service-account credential issuance;
- call external identity providers or external provider systems;
- treat cookies, Authorization headers, bearer tokens, sessions, or API keys as authenticated identity;
- persist raw headers, cookies, tokens, session ids, secret values, raw env values, raw prompts, raw provider responses, or credential-cache paths;
- weaken Policy-as-code, SecretRef, Vault, Git, LLM, MCP, Local Agent, Runner, Dashboard, Observability, Staging, CI/CD, or Secrets/Sandbox gates;
- claim production auth is implemented or enabled.

## Migration Strategy

1. Add the API helper with safe header extraction, per-request caching, source-mode selection, and safe summary output.
2. Instantiate it next to `RequestContextResolver` in API server composition.
3. Resolve the context once at API ingress.
4. Replace direct resolver calls in representative route groups with `requireApiContext`.
5. Pass the resolved context to services already capable of accepting it.
6. Add deterministic tests for middleware helpers, route coverage, policy/audit metadata, and no-secret behavior.
7. Document remaining unmigrated routes and service actor gaps in an API middleware inventory.

## What Remains Out Of Scope

- Real production authentication.
- Real IdP, login, session, JWT, cookie, API-key, or service-account credential handling.
- Tenant/workspace/project/repo enforcement.
- Durable auth repositories.
- Full registry/governance/runner/service-account actor migration.
- Production dashboard/readiness/audit query scoping.
- Any live provider, GitHub, LLM, MCP, Vault, Kubernetes, Temporal, OPA, Cedar, artifact registry, cloud, or vendor CLI integration.
