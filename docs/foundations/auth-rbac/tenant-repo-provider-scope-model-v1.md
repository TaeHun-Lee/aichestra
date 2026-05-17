# Tenant/Repo/Provider Scope Model v1

Tenant/Repo/Provider Scope Model v1 is implemented as a provider-neutral metadata scaffold. It gives Auth/RBAC, Policy, service accounts, Git, LLM, MCP, SecretRef, Registry/Governance, Observability, Dashboard, and Readiness a shared vocabulary for future tenant, repo, provider, model, secret, tool, package, local-agent, and audit-query scoping.

Status:

- Tenant/Repo/Provider Scope Model: `v1_implemented`
- RequestContext Propagation: `v1_implemented`
- API AuthContext Middleware Skeleton: `v1_implemented`
- Service Account Actor Boundary: `v1_implemented`
- Registry/Governance RequestContext Migration: `v1_implemented`
- Dashboard/Readiness Tenant Scope Planning: `v1_implemented`
- Dashboard/Readiness Tenant Scope Implementation: `v1_implemented`
- Tenant Scope Enforcement: `v1_implemented_partial`
- Production Auth Provider Skeleton: `v1_implemented`
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
- Dashboard/Readiness Tenant Scope Planning v1 inventory and read-only planning surfaces for future dashboard/readiness filtering.
- Dashboard/Readiness Tenant Scope Implementation v1 safe read-model metadata: `ScopedReadModelMetadata`, `DashboardPanelScopeSummary`, `ReadinessEndpointScopeSummary`, missing-scope warnings, role hints, and redaction labels.
- Tenant Scope Enforcement v1 partial helper metadata: `TenantScopeEnforcementDecision`, `TenantScopeEnforcementMode`, `TenantScopeMismatch`, and `TenantScopeEnforcementService` for deterministic scope comparison and representative dashboard/readiness warnings.
- Policy Bundle Runtime PoC Planning v0 input contract and domain mappings consume this scope vocabulary as future policy input metadata only. Policy Runtime Shadow Evaluation Planning v1 keeps those scope fields in the future candidate comparison plan while leaving production tenant enforcement unimplemented.

## What v1 Does Not Implement

v1 does not implement production tenant provisioning, tenant isolation enforcement, row-level security, production dashboard filtering, durable tenant repositories, production Auth/RBAC, real OIDC/SAML/SCIM/SSO, login/logout/session handling, JWTs, API keys, service-account credentials, token validation, session cookies, external identity-provider calls, provider calls, artifact registry integration, or active registry mutation through auto-improvement.

Dashboard/Readiness Tenant Scope Planning v1, Dashboard/Readiness Tenant Scope Implementation v1, and Tenant Scope Enforcement v1 do not change that production boundary. Planning v1 inventories dashboard panels and readiness endpoints. Implementation v1 attaches safe scope summaries, visibility hints, fallback warnings, and redaction labels to dashboard/readiness read models. Tenant Scope Enforcement v1 adds partial representative helper decisions and warning metadata only. They do not implement production tenant filtering or production tenant isolation.

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

Tenant Scope Enforcement v1 can attach safe scope-decision summaries to `PolicySubject` and policy resource metadata. These summaries are audit/readiness context only: policy deny remains authoritative, and a scope allow cannot override a `StaticPolicyEngine` deny.

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
- `GET /readiness/tenant-scope/dashboard-plans`
- `GET /readiness/tenant-scope/dashboard-scope-summaries`
- `GET /readiness/tenant-scope/readiness-plans`
- `GET /readiness/tenant-scope/readiness-scope-summaries`
- `GET /readiness/tenant-scope/role-visibility`
- `GET /readiness/tenant-scope/fallback-behavior`
- `GET /readiness/tenant-scope/summary`
- `GET /dashboard/tenant-scope`
- `GET /readiness/tenant-enforcement/modes`
- `GET /readiness/tenant-enforcement/mismatches`
- `GET /readiness/tenant-enforcement/summary`
- `GET /dashboard/tenant-enforcement`

These surfaces are read-only, use deterministic mock/readiness metadata, and expose no secret values or env values. Tenant filtering is explicitly future work.

Dashboard/Readiness Tenant Scope Planning v1 is documented in:

- `docs/roadmaps/dashboard-readiness-tenant-scope/v1.md`
- `docs/reference/dashboard-tenant-scope-inventory.md`
- `docs/reference/readiness-tenant-scope-inventory.md`
- `docs/reference/dashboard-role-visibility-matrix.md`
- `docs/reference/readiness-role-visibility-matrix.md`
- `docs/foundations/auth-rbac/tenant-scope-enforcement-v1.md`
- `docs/reference/tenant-scope-enforcement-inventory.md`

The planning, implementation, and partial enforcement summaries explicitly report `tenantFilteringImplemented: false`, `productionTenantEnforcement: false`, `productionEnforcementImplemented: false`, and `productionReady: false`.

## Remaining Gaps

- No production tenant provisioning or isolation.
- No row-level security.
- No tenant-aware durable repository indexes.
- No production dashboard/readiness/audit filtering.
- No production provider/model budget enforcement by tenant.
- No production SecretRef tenant isolation.
- No artifact registry package scope enforcement or signing.
- No real service-account credential issuance.
- No production-grade tenant scope enforcement; v1 is partial representative scaffolding only.

## Test Strategy

Coverage lives in `tests/tenant-repo-provider-scope-model-v1.test.ts` and `tests/tenant-scope-enforcement-v1.test.ts`. It checks scope models, helpers, policy resource mapping, auth/request/policy subject propagation, policy-deny preservation, representative Git/LLM/MCP/SecretRef/Registry/Observability metadata, partial enforcement decisions, readiness APIs, dashboard rendering, and no-secret/no-env behavior.

Recommended next task: OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.
Recommended next task: Policy Runtime Shadow Evaluator Skeleton v1, or Tenant Scope Enforcement v1. Production tenant enforcement remains future work.

## OIDC claims mapping plan

OIDC Provider Skeleton Hardening v1 defines future-only mapping placeholders for tenant, team, project, repo scope, provider scope, and service-account claims. These mappings are planning metadata only and do not parse real claims or enforce production tenant scope.
