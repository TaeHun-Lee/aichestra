# Tenant/Repo/Provider Scope Model v1

Tenant/Repo/Provider Scope Model v1 is implemented as a provider-neutral metadata scaffold. It gives Auth/RBAC, Policy, service accounts, Git, LLM, MCP, SecretRef, Registry/Governance, Observability, Dashboard, and Readiness a shared vocabulary for future tenant, repo, provider, model, secret, tool, package, local-agent, and audit-query scoping.

Status:

- Tenant/Repo/Provider Scope Model: `v1_implemented`
- RequestContext Propagation: `v1_implemented`
- API AuthContext Middleware Skeleton: `v1_implemented`
- Service Account Actor Boundary: `v1_implemented`
- Registry/Governance RequestContext Migration: `v1_implemented`
- Production tenant enforcement: not implemented
- Production Auth/RBAC: not implemented

## What v1 Implements

- Common metadata models for tenant, team, project, repo, provider, model, SecretRef binding, MCP tool, registry package, Local Agent host, audit query, and policy resource scopes.
- A deterministic mock scope catalog in `packages/auth`.
- `ScopeContextFactory` helpers for creating, validating, merging, and mapping scope metadata.
- Optional scope fields on `AuthContext`, `RequestContext`, and `PolicySubject`.
- Policy resource helpers for Git repos, LLM providers/models, SecretRefs, MCP tools, registry packages, and audit queries.
- Representative scope metadata propagation through Git, LLM, MCP, Security/SecretRef, Registry/Governance, Policy audit, Observability, Dashboard, and Readiness paths.
- Read-only `/readiness/scopes/*` endpoints and a `/dashboard/scopes` read model.
- Dashboard rendering for a Scope Model / Tenant Readiness panel.

## What v1 Does Not Implement

v1 does not implement production tenant provisioning, tenant isolation enforcement, row-level security, production dashboard filtering, durable tenant repositories, production Auth/RBAC, real OIDC/SAML/SCIM/SSO, login/logout/session handling, JWTs, API keys, service-account credentials, external identity-provider calls, provider calls, artifact registry integration, or active registry mutation through auto-improvement.

## Scope Model

The canonical v1 metadata types live in `packages/auth/src/types.ts`:

- `TenantScope`
- `TeamScope`
- `ProjectScope`
- `RepoScope`
- `ProviderScope`
- `ModelScope`
- `SecretScopeBinding`
- `MCPToolScope`
- `RegistryPackageScope`
- `LocalAgentHostScope`
- `AuditQueryScope`
- `PolicyResourceScope`

All scope records are safe metadata only. Mock/local entries use `active_mock`; disabled or future entries remain non-enforcing planning metadata.

## Mock Scope Catalog

`mockScopeCatalog` seeds deterministic local/readiness examples:

- tenant `mock-tenant`
- team `platform-team`
- project `aichestra-core`
- mock/local/GitHub fixture repo scopes
- mock, OpenAI-compatible, and local-cli provider metadata
- mock and OpenAI-compatible model scopes
- GitHub, LLM, and Vault test SecretRef bindings
- low-risk and disabled MCP tool scopes
- sample skill/harness/instruction registry package scopes
- fixture Local Agent host scope
- dashboard/readiness audit query scope

The catalog contains no secret values, env values, API keys, JWTs, sessions, client secrets, or service-account credentials.

## ScopeContextFactory

`ScopeContextFactory` provides deterministic helpers:

- `createTenantScopeContext`
- `createRepoScope`
- `createProviderScope`
- `createModelScope`
- `createSecretScope`
- `createMcpToolScope`
- `createRegistryPackageScope`
- `createAuditQueryScope`
- `toPolicyResourceScope`
- `toPolicyResource`
- `mergeScopes`
- `validateScopeShape`

The factory normalizes metadata and policy resource inputs. It does not authorize access, call external systems, read credentials, or enforce tenant isolation by itself.

## Auth And Policy Integration

`AuthContext` can now carry optional `tenantScopes`, `teamScopes`, `projectScopes`, and `resourceScopes`.

`RequestContext` can now carry optional `tenantId`, `teamId`, `projectId`, and `resourceScopes`.

`PolicySubject` can now carry optional `tenantIds`, `teamIds`, `projectIds`, and `resourceScopes`.

These fields are additive only. Missing scope metadata must not grant broader access, and existing deny-by-default policy behavior remains authoritative.

## PolicyResourceScope Mapping

Policy helpers in `packages/policy/src/resource-scope.ts` construct scoped policy resources for:

- Git repo and branch/PR contexts
- LLM provider and model contexts
- SecretRef and Vault credential-resolution contexts
- MCP server/tool contexts
- Registry package, skill, harness, and instruction contexts
- Observability audit query contexts

Scope metadata enriches policy input and audit output, but it does not weaken or bypass existing policy decisions.

## Representative Integrations

- Git audit and policy resources include repo scope metadata where migrated.
- LLM routing decisions and audit metadata include provider/model scope metadata where migrated.
- MCP invocation audit and results include tool scope metadata where migrated.
- Security credential resolution includes SecretRef scope binding metadata where migrated.
- Registry/Governance mutation and apply-gate audit metadata can include registry package scope metadata.
- Observability normalized envelopes preserve scope metadata from source events.
- Dashboard and readiness expose safe scope summaries without filtering production data.

## Dashboard And Readiness

Read-only endpoints:

- `GET /readiness/scopes/summary`
- `GET /readiness/scopes/tenants`
- `GET /readiness/scopes/teams`
- `GET /readiness/scopes/projects`
- `GET /readiness/scopes/repos`
- `GET /readiness/scopes/providers`
- `GET /readiness/scopes/models`
- `GET /readiness/scopes/secrets`
- `GET /readiness/scopes/mcp-tools`
- `GET /readiness/scopes/registry-packages`
- `GET /readiness/scopes/local-agents`
- `GET /readiness/scopes/audit-queries`
- `GET /dashboard/scopes`

These surfaces are read-only, use deterministic mock/readiness metadata, and expose no secret values or env values. Tenant filtering is explicitly future work.

## Remaining Gaps

- No production tenant provisioning or isolation.
- No row-level security.
- No tenant-aware durable repository indexes.
- No production dashboard/readiness/audit filtering.
- No production provider/model budget enforcement by tenant.
- No production SecretRef tenant isolation.
- No artifact registry package scope enforcement or signing.
- No real service-account credential issuance.

## Test Strategy

Coverage lives in `tests/tenant-repo-provider-scope-model-v1.test.ts` and checks scope models, helpers, policy resource mapping, auth/request/policy subject propagation, policy-deny preservation, representative Git/LLM/MCP/SecretRef/Registry/Observability metadata, readiness APIs, dashboard rendering, and no-secret/no-env behavior.

Recommended next task: Dashboard/Readiness Tenant Scope Planning v1, or Tenant Scope Enforcement v1.
