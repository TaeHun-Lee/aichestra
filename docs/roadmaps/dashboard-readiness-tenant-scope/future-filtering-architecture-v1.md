# Future Filtering Architecture v1

Status: Dashboard/Readiness Tenant Scope Planning `v1_implemented`.

This architecture is a future implementation plan. Dashboard/Readiness Tenant Scope Planning v1 does not enforce filtering.

## Request Context Scope Extraction

Future dashboard/readiness requests should resolve one request context through API AuthContext Middleware. The resolved context should include request id, correlation id, actor, roles, teams, source, auth mode, tenant scope, team scope, project scope, repo scope, provider/model scope, secret scope, MCP tool scope, registry package scope, local-agent host scope, and audit query scope when applicable.

The extraction path must not parse Authorization headers or cookies as production auth until production Auth/RBAC exists. It must not issue sessions, JWTs, API keys, or service-account credentials.

## AuthContext Scope Fields

`AuthContext` should remain the source of authenticated actor and scope claims after production auth exists. Scope fields should be explicit and typed. Missing or ambiguous scope must produce a warning in local/staging and a denial or aggregate-only response in production.

## PolicySubject Scope Fields

`PolicySubject` scope metadata should continue to enrich policy decisions without weakening deny-by-default rules. Roles must not bypass Policy-as-code, SecretRef, Git, LLM, MCP, Runner, Registry, Governance, Local Agent, or staging gates.

## Dashboard Read Model Filtering

Dashboard filtering should be applied in `apps/api/src/dashboard-read-model.ts` before read-model DTOs are returned:

- filter task, registry, Git, conflict, LLM, MCP, runner, staging, and audit arrays by target scope dimensions;
- aggregate or hide counts that could leak cross-tenant state;
- mark applied scope in each section;
- preserve deterministic demo fallback warnings;
- keep `/dashboard/tenant-scope` as the planning/control panel for coverage.

## Readiness Endpoint Filtering

Readiness route groups should add endpoint-level guards:

- validate role and required scopes;
- return aggregate-only metadata for lower roles where safe;
- return explicit missing-scope responses for details;
- keep all readiness endpoints read-only;
- never execute migrations, provider checks, live tests, deployments, or external calls by default.

## Audit Query Filtering

Audit and observability queries need an explicit audit query scope before production:

- tenant/team/project filters at query construction;
- sanitized event envelopes only;
- no raw payload storage or return path;
- no credential/cache path exposure;
- count aggregation redaction for lower roles.

## Repository / Query Layer Filtering

Future durable repositories should accept typed scope filters instead of ad hoc string filters. Query-layer filtering should be centralized for tenant, team, project, repo, provider/model, secret, MCP tool, registry package, local-agent host, and audit query dimensions.

Row-level security remains out of scope until a later explicit task. If RLS is later introduced, it must be additive to application-layer policy checks.

## Cache Implications

Dashboard and readiness caches must be partitioned by:

- tenant id;
- role set;
- applied project/repo/provider/model/tool/package/host/audit scopes;
- redaction level;
- source mode: local, staging, production.

Cross-tenant cache keys must be impossible. Production must not reuse demo/global planning cache entries for scoped requests.

## UI Indication of Applied Scope

The web dashboard should show:

- applied tenant/team/project/repo/provider/model scope;
- missing-scope warnings in local/staging;
- production blocker count;
- redaction state for secret-adjacent and audit panels;
- aggregate-only state when details are hidden;
- tenant filtering implemented status.

## Error and Empty States

Future filtering should distinguish:

- `missing_scope`: request lacks required scope;
- `insufficient_role`: role cannot view the panel/endpoint;
- `redacted`: visible but details hidden;
- `empty_scope`: scope is valid but no rows match;
- `production_blocked`: production use is blocked until filtering is implemented.

## Test Strategy

Add deterministic tests for:

- scoped dashboard read-model filtering per panel;
- scoped readiness endpoint filtering per group;
- lower-role count/detail redaction;
- missing-scope fallback responses;
- audit query filtering;
- secret/env redaction;
- cache partition keys;
- regression that default runtime makes no external calls and does not claim production auth or tenant enforcement.

## Rollout Phases

1. Planning inventory and read-only API/dashboard surfaces: implemented in Dashboard/Readiness Tenant Scope Planning v1.
2. Request scope extraction hardening and staging warnings.
3. Dashboard read-model filters and UI applied-scope indicators.
4. Readiness endpoint filters and role redaction.
5. Repository/query filters and cache partitioning.
6. Production Auth/RBAC integration, durable scopes, and production rollout review.

## Non-goals

This architecture does not implement real Auth/RBAC, real identity-provider integration, tenant provisioning, RLS, provider calls, live integration tests, active deployment, Git merge/rebase/push, LLM completion, MCP invocation, Vault reads, or production-ready enforcement.
