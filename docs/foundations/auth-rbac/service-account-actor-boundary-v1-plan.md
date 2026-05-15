# Service Account Actor Boundary v1 Plan

## Path

This plan lives at `docs/foundations/auth-rbac/service-account-actor-boundary-v1-plan.md`.

The path follows the current `docs/README.md` organization: auth/RBAC implementation foundations live under `docs/foundations/auth-rbac/`, while cross-boundary inventories live under `docs/reference/`.

## Current Status

RequestContext Propagation v1 is implemented as a mock-first attribution and correlation layer. `RequestContext`, `CorrelationContext`, and `RequestContextResolver` exist in `packages/auth`, and selected API/service/audit paths carry request id, correlation id, actor/principal metadata, auth mode, and source.

API AuthContext Middleware Skeleton v1 is implemented in `apps/api/src/request-context-middleware.ts`. It resolves one cached mock-first `RequestContext` per API request where practical, keeps dashboard/readiness read-only source modes, ignores Authorization headers and cookies as auth, and exposes safe summaries only.

Production Auth/RBAC v1 Planning is implemented as readiness/planning metadata. It documents service-account/system actor needs but does not issue credentials, create sessions, validate tokens, call identity providers, or enforce production tenant isolation.

## Current Models

`packages/auth` already owns provider-neutral `Principal`, `Actor`, `ServiceAccount`, `AuthContext`, `RequestContext`, `AuthorizationService`, and in-memory repository models. `MockAuthProvider` can resolve seeded service-account actors such as `svc_runner`. `AuthorizationService.toPolicySubject` already maps `serviceAccountId` when a matching `ServiceAccount` exists.

Current gaps:

- service-account metadata is sparse and not organized as a runtime actor catalog;
- many service paths still use service-specific strings as actor ids;
- service-account attribution is not consistently present in policy audit, module audit, or observability envelopes;
- service-account contexts are not a first-class helper separate from human mock API contexts.

## Current Service-Specific Actor Usage

Runtime actor strings that need wrapping or migration include:

- `mock-git-actor` in `packages/git-adapter/src/service.ts`;
- `github-webhook-receiver` and `github-sync-service` in `packages/git-adapter/src/webhooks.ts`;
- `github-app-token-provider` and `github-app-runtime` in `packages/git-adapter/src/github-app.ts`;
- `mock-llm-actor` and selected fallback policy paths in `packages/llm-gateway/src/gateway.ts`;
- `mock-security-actor` fallback in `packages/security/src/service.ts`;
- `mock-runner-actor` fallback in `packages/runner/src/service.ts`;
- registry/governance explicit actor fields and `mock-admin` fallbacks, which remain higher-risk for this slice.

## Proposed Service Account Actor Catalog

Add a static mock service-account catalog in `packages/auth` with entries for:

- `git_webhook_service`
- `git_sync_service`
- `github_app_token_service`
- `git_provider_service`
- `llm_gateway_service`
- `llm_router_service`
- `mcp_gateway_service`
- `vault_credential_resolver_service`
- `secretref_credential_service`
- `runner_service`
- `local_agent_protocol_service`
- `registry_governance_service`
- `improvement_governance_service`
- `observability_read_service`
- `dashboard_read_service`
- `readiness_read_service`
- `migration_service_future`
- `deployment_service_future`

Each entry records id, display name, service-account kind, optional owner team, allowed actions, forbidden actions, allowed resource scopes, status, risk level, audit requirements, mock roles, and metadata. Active entries are local/mock metadata only. Future entries remain disabled/future and cannot create active contexts.

## Proposed Context Helper

Add `ServiceAccountContextFactory` in `packages/auth`.

Methods:

- `listServiceAccounts()`
- `getServiceAccount(id)`
- `requireServiceAccount(id)`
- `createServiceAccountAuthContext(serviceAccountId, options)`
- `createServiceAccountRequestContext(serviceAccountId, source, options)`
- `toPolicySubject(authContext, requestContext)`

Behavior:

- active mock entries produce `actorKind=service_account`;
- auth mode is `mock_service_account`;
- `serviceAccountId`, request id, correlation id, source, roles, teams, and mock marker are included;
- unknown, disabled, and future service accounts fail deterministically;
- no credentials, tokens, cookies, raw headers, env values, JWTs, API keys, or service-account secrets are generated or stored.

## Target Boundaries For v1

Migrate or wrap high-value boundaries where signatures are already compatible:

- Git provider fallback subject and audit metadata use `git_provider_service`.
- GitHub webhook receiver uses `git_webhook_service`; sync service uses `git_sync_service`.
- GitHub App runtime/token handle boundary uses `github_app_token_service` for token-handle checks and audit.
- LLM gateway fallback/routing service attribution uses `llm_gateway_service` and `llm_router_service` where practical.
- Security credential fallback uses `secretref_credential_service`; Vault-specific audit metadata preserves the same service account attribution.
- Runner policy fallback uses `runner_service`.
- Policy audit and observability normalization carry `serviceAccountId`.

MCP already receives `RequestContext/AuthContext` on representative API paths. v1 preserves request-derived actors for API invocation and adds `mcp_gateway_service` only for internal fallback calls without an actor/auth context.

## Boundaries Left For Future

- Registry/Governance mutation signatures remain actor-id based.
- Local Agent Protocol service-account migration remains partial because consent and user/host ownership need a separate scope pass; v1 may add a policy fallback only.
- Dashboard/readiness tenant/team scoping remains future; API middleware already creates read-only contexts.
- Worker persisted requester/service-account snapshots remain future.
- Production service-account credential issuance, rotation, and durable service-account lifecycle are out of scope.

## PolicySubject Strategy

Continue to centralize `AuthContext -> PolicySubject` through `AuthorizationService.toPolicySubject`. Extend metadata and audit fields so service-account contexts carry:

- `actorKind=service_account`
- `serviceAccountId`
- `authMode=mock_service_account`
- request id
- correlation id
- source
- `isMockActor=true`

Service accounts do not bypass policy. `secret.read`, credential cache read/upload, runner secret injection, destructive Git actions, high-risk MCP, Local Agent secret forwarding, and improvement apply remain denied by default.

## Audit And Correlation Strategy

Where migrated, audit records should include sanitized metadata:

- `serviceAccountId`
- `actorKind=service_account`
- request id
- correlation id
- source
- auth mode
- policy/authorization decision ids where already available

Observability normalization should surface `serviceAccountId` when source events include it.

## Safety Constraints

This task must not implement real OIDC, SAML, SCIM, SSO, login/logout, session handling, JWT issuance, API-key issuance, real service-account credential issuance, credential rotation, external IdP calls, GitHub/OpenAI/Vault/MCP/provider calls, remote Git operations, real LLM/MCP calls, vendor CLI execution, credential-cache reads, secret/env exposure, or production-auth/service-account enablement.

The default runtime remains mock-first. Existing Auth/RBAC, Policy, SecretRef, Git, LLM, MCP, Local Agent, Runner, Dashboard, Observability, Staging, CI/CD, and Secrets/Sandbox safety gates remain authoritative.

## What This Task Implements

- Static mock service-account actor catalog.
- `ServiceAccountContextFactory` and service-account policy subject helpers.
- Auth/Policy/Observability metadata support for `serviceAccountId`.
- High-value actor fallback migration in Git, GitHub webhook/sync, GitHub App token-handle checks, LLM fallback attribution, MCP fallback attribution, Security credential fallback, Runner policy fallback, and Local Agent policy fallback.
- Deterministic tests and inventory/docs updates.

## Out Of Scope

- Real service-account credentials.
- Credential rotation.
- Durable service-account management UI/API.
- Production IdP integration.
- Production tenant/team/project/repo enforcement.
- Registry/Governance full mutation migration.
- Dashboard/readiness tenant scoping.
- Worker background context persistence.
