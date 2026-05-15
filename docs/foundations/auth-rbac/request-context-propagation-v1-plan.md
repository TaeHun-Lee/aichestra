# RequestContext Propagation v1 Plan

Path choice: `docs/README.md` lists Auth/RBAC as a foundation topic under `docs/foundations/auth-rbac/`, so this pre-implementation plan lives beside the canonical Auth/RBAC foundation documents. No `design_docs/` directory is present.

## Current Auth/RBAC v1 Planning Status

Production Auth/RBAC v1 Planning is implemented as planning/readiness scaffolding. The current status is:

- Production Auth/RBAC Planning v0: `v0_implemented`
- Production Auth/RBAC v1 Planning: `v1_implemented`
- Phase 5: `preparation_started`

The latest boundary audit, `docs/audits/2026-05-15-production-auth-rbac-boundary-inventory-audit-v1.md`, found no critical blocker for a mock-first RequestContext propagation slice. It still blocks production auth enablement because real IdP selection, tenant scoping, session/token boundaries, durable auth repositories, service-account credential lifecycle, and dashboard/audit query scoping remain incomplete.

## Current RequestContext/AuthContext Models

`packages/auth` already owns `AuthContext`, `RequestContext`, `RequestSource`, `MockAuthProvider`, and `RequestContextResolver`.

Current `AuthContext` carries request id, actor, principal, teams, roles, permissions, role bindings, auth mode, authenticated flag, source, timestamp, and sanitized metadata.

Current `RequestContext` carries request id, optional correlation id, source, auth context, timestamp, and metadata. Existing resolver behavior creates API, system, and test contexts. API contexts can use `x-aichestra-actor-id`, `x-aichestra-request-id`, and `x-aichestra-correlation-id` as mock/local metadata only. This is not production authentication.

## Current AuthorizationService Behavior

`AuthorizationService` resolves an `AuthContext` through `MockAuthProvider`, checks active RBAC role bindings, maps `AuthContext` into `PolicySubject`, evaluates Policy-as-code when the action/resource is policy-mappable, and records sanitized auth audit events.

Policy denial remains authoritative. Admin-like mock roles do not bypass deny-by-default rules for remote Git, unverified webhooks, merge/rebase/force-push/delete, remote LLM completion without gates, unsafe MCP paths, runner commands, broad secret reads, credential cache reads, Local Agent secret forwarding, or improvement apply.

## Known Service-Specific Actor String Usage

Known runtime actor strings and ad hoc actor paths include:

- API route defaults in `apps/api/src/main.ts`, including `mock-admin`, `mock-git-actor`, and `mock-agent-actor`.
- Git service actor defaults in `packages/git-adapter/src/service.ts`, including `mock-git-actor`.
- GitHub App runtime and token provider actor defaults in `packages/git-adapter/src/github-app.ts`.
- Git webhook receiver/sync actor defaults in `packages/git-adapter/src/webhooks.ts`, including `github-webhook-receiver` and `github-sync-service`.
- LLM gateway fallback actor defaults in `packages/llm-gateway/src/gateway.ts`, including `mock-llm-actor`.
- Runner service actor/request fields in `packages/runner/src/service.ts`.
- Local Agent Protocol and enterprise provider actor request fields in `packages/llm-gateway/src/local-agent-protocol.ts` and `packages/llm-gateway/src/enterprise-providers.ts`.
- Registry and governance mutation paths that accept explicit actor ids or default to mock actors.
- Dashboard and readiness read models that currently use safe mock/global read-only context without tenant filtering.

Test fixtures and documentation references should remain deterministic and should not be blindly removed.

## Proposed Propagation Strategy

This v1 slice should add a consistent propagation layer without broad rewrites:

1. Consolidate `RequestContext`, `CorrelationContext`, and resolver helpers in `packages/auth`.
2. Add explicit context sources for API, worker, dashboard, readiness, system, test, webhook, and Local Agent boundaries.
3. Add safe helpers for deriving actor, principal, request, correlation, source, and auth mode metadata from a request context.
4. Enrich `PolicySubject` with optional request id, correlation id, and source fields while preserving metadata compatibility.
5. Pass `RequestContext` to high-value API routes and service calls where non-breaking optional parameters are practical.
6. Add correlation metadata to audit paths where the service already records sanitized audit events.
7. Document boundaries that remain partial instead of performing risky signature rewrites across the whole repo.

## API Boundary Strategy

API handlers should resolve one `RequestContext` per protected route group using `RequestContextResolver.resolveFromApiRequest`.

High-value v1 targets:

- `/auth/*`
- `/security/*` credential and Vault checks
- `/git/*` branch, PR, GitHub App token-check, changed-file, and webhook read-model operations where practical
- `/llm/route` and `/llm/completions`
- `/mcp/*`
- `/local-agents/*`
- `/agents/*`
- `/policy/*`
- `/dashboard/*`
- `/readiness/*`
- `/observability/*`
- task run/agent endpoints
- registry/governance mutation endpoints where practical

Read-only dashboard/readiness/observability endpoints remain read-only. v1 may attach safe context metadata internally, but it must not expose tokens, cookies, session ids, secrets, raw env values, raw prompts, raw provider responses, or credential cache paths.

## Worker/System Context Strategy

Worker and system flows should use explicit reason-tagged system contexts. v1 should not invent production service-account credentials. System contexts remain mock/system metadata only and must be marked with source, reason, `authMode`, and `productionAuthEnabled=false`.

Webhook contexts should be explicit and provider-tagged. Delivery ids should be correlation metadata only. Webhook receiver behavior remains gated and disabled by default.

## Test Context Strategy

Test helpers should use `createTestContext` with deterministic injectable ids where possible. Generated ids can remain UUID-based for runtime but tests should be able to provide request id and correlation id.

Tests should confirm contexts contain no raw tokens, cookies, session secrets, API keys, raw headers, provider credentials, or credential-cache contents.

## PolicySubject Mapping Strategy

`AuthorizationService.toPolicySubject` should remain the central AuthContext-to-PolicySubject bridge and add:

- actor id
- principal id
- actor kind
- roles
- teams
- auth mode
- service account id when available
- mock actor marker
- request id
- correlation id
- source
- sanitized metadata

Missing auth should be explicit anonymous/disabled mock behavior through `MockAuthProvider`, not silent allow. `createPolicySubject` can keep its default for test compatibility, but migrated runtime paths should prefer AuthContext-derived subjects.

## Audit/Observability Strategy

Audit metadata should include safe correlation fields where practical:

- request id
- correlation id
- actor id
- principal id
- auth mode
- source

This applies first to Auth/RBAC, Policy decisions, Security credential resolution, Git audit, LLM audit/routing decisions, MCP audit/invocations, Local Agent audit, Runner audit, Registry/Governance audit, and Observability envelope normalization where the source events already expose those dimensions.

No audit event may store raw headers, cookies, tokens, raw identity assertions, provider credentials, secret values, env values, raw webhook payloads, raw prompts, or credential-cache paths.

## Risky Areas To Avoid

- Do not implement OIDC, SAML, SCIM, SSO, login, logout, sessions, JWTs, API keys, or service-account credential issuance.
- Do not call external IdPs, GitHub, LLM providers, MCP servers, Vault, Kubernetes, Temporal, OPA, Cedar, cloud services, artifact registries, or external auth systems.
- Do not run remote Git operations or vendor CLIs.
- Do not read credential caches.
- Do not change dashboard/readiness endpoints into operational surfaces.
- Do not make tenant isolation or production auth readiness claims.
- Do not refactor every registry, governance, Local Agent, and runner method in one risky change; use optional context parameters and document remaining gaps.

## What This Task Implements

- RequestContext and CorrelationContext model consolidation.
- RequestContextResolver helpers for API, system, test, webhook, dashboard, and readiness contexts.
- PolicySubject request/correlation/source enrichment.
- High-value API route propagation to Git, LLM, MCP, Security, Local Agent, Runner, Dashboard, Readiness, Observability, task-run, registry, and governance paths where practical.
- Service-boundary optional RequestContext support in selected Git, LLM, MCP, Security, Runner, Local Agent, Registry/Governance, and Observability paths where low risk.
- Audit/correlation metadata enrichment in migrated paths.
- Request-context propagation inventory under `docs/reference/`.
- Deterministic tests for model/resolver behavior, PolicySubject mapping, representative API/service propagation, hardcoded actor regression classification, and no-secret exposure.

## What Remains Out Of Scope

- Real production authentication.
- Real IdP/provider integrations.
- Tenant/workspace/project/repo enforcement.
- Durable auth repositories.
- Session/token/JWT/cookie/API-key handling.
- Production service-account credential issuance.
- Break-glass workflow.
- Full replacement of every mock actor string.
- Production dashboard/readiness/audit query scoping.
- Any external provider call or default live integration test.

