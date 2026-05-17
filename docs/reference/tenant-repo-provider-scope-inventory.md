# Tenant/Repo/Provider Scope Inventory

Status: Tenant/Repo/Provider Scope Model `v1_implemented`; Dashboard/Readiness Tenant Scope Planning `v1_implemented`; Dashboard/Readiness Tenant Scope Implementation `v1_implemented`; Tenant Scope Enforcement `v1_implemented_partial`.

This inventory tracks the shared scope metadata model after v1 and the partial Tenant Scope Enforcement v1 helper layer. It is not a production tenant-isolation, row-level security, production Auth/RBAC, or dashboard filtering readiness claim.

| Scope Kind | Model / Type | Seed Examples | Integrated Boundaries | Policy Resource Mapping | Audit Mapping | Dashboard / Readiness Mapping | Enforcement Status | Remaining Gap | Production Impact |
|---|---|---|---|---|---|---|---|---|---|
| tenant | `TenantScope` | `mock-tenant` | AuthContext, RequestContext, dashboard/readiness summaries, Tenant Scope Enforcement decisions | `scopeKind=tenant` | tenant ids preserved when source events carry them | `/readiness/scopes/tenants`, `/readiness/scopes/summary`, `/dashboard/scopes`, `/readiness/tenant-enforcement/*` | partial metadata enforcement | durable tenant repository and provisioning | no production isolation |
| team | `TeamScope` | `platform-team` | AuthContext, RequestContext, dashboard/readiness summaries | `scopeKind=team` | team ids preserved when source events carry them | `/readiness/scopes/teams`, dashboard scope panel | metadata only | real directory/team mapping | no production team enforcement |
| project | `ProjectScope` | `aichestra-core` | AuthContext, RequestContext, dashboard/readiness summaries | `scopeKind=project` | project ids preserved when source events carry them | `/readiness/scopes/projects`, dashboard scope panel | metadata only | durable project membership and indexes | no project isolation |
| repo | `RepoScope` | mock repo, local fixture repo, GitHub fixture repo | Git service policy resources and Git audit metadata | Git repo/branch/PR resource helpers | repo scope metadata on migrated Git audits | `/readiness/scopes/repos`, dashboard scope panel | metadata only | repo grants and tenant allowlists | remote Git gates unchanged |
| provider | `ProviderScope` | mock LLM, OpenAI-compatible metadata, local-cli metadata | LLM routing/audit metadata | LLM provider helper | provider scope metadata on migrated LLM audits | `/readiness/scopes/providers`, dashboard scope panel | metadata only | tenant budgets/provider grants | no provider access expansion |
| model | `ModelScope` | `mock-small`, `mock-coder`, OpenAI-compatible default metadata | LLM route decisions and audit metadata | LLM model helper | model scope metadata on migrated LLM audits | `/readiness/scopes/models`, dashboard scope panel | metadata only | tenant model allowlists and budgets | remote LLM gates unchanged |
| secret | `SecretScopeBinding` | GitHub token, webhook secret, GitHub App private key, LLM API key, Vault test secret future | CredentialManager resolution metadata, secret-adjacent enforcement helper | SecretRef helper | sanitized secret scope id/kind/provider only | `/readiness/scopes/secrets`, dashboard scope panel, `/readiness/tenant-enforcement/*` | partial stricter helper | backend tenant isolation and lease scoping | no secret values exposed |
| mcp_tool | `MCPToolScope` | mock docs search, mock GitHub read-only, disabled high-risk tool | MCP invocation/result/audit metadata | MCP tool helper | tool scope metadata on migrated MCP audits | `/readiness/scopes/mcp-tools`, dashboard scope panel | metadata only | real MCP transport grants and tenant tool allowlists | real MCP disabled |
| registry_package | `RegistryPackageScope` | sample skill, harness, instruction packages | Registry/Governance policy/audit metadata | registry package helper | registry package scope in migrated mutation/governance audit metadata | `/readiness/scopes/registry-packages`, dashboard scope panel | metadata only | tenant package catalogs and artifact registry | resolver gates unchanged |
| local_agent_host | `LocalAgentHostScope` | fixture Local Agent host | dashboard/readiness summaries; Local Agent metadata future | local-agent host scope through generic helper | source events can carry host scope metadata in future | `/readiness/scopes/local-agents`, dashboard scope panel | metadata only | device trust, tenant enrollment, consent UX | no real daemon/CLI |
| audit_query | `AuditQueryScope` | dashboard/readiness read-only query scope | Observability normalized envelope, dashboard/readiness summaries, audit-query enforcement helper | audit query helper | scope fields normalized when source events carry them | `/readiness/scopes/audit-queries`, dashboard scope panel, `/readiness/tenant-enforcement/*` | partial warning helper | tenant audit filters and durable audit indexes | read-only, no export |

## Notes

- Scope data is deterministic mock/readiness metadata only.
- `ScopeContextFactory` validates and normalizes scope shapes, but does not authorize access.
- `PolicyResourceScope` enriches policy/audit input without weakening existing deny rules.
- `TenantScopeEnforcementService` compares subject/resource scope metadata and emits warnings or helper decisions without replacing `StaticPolicyEngine`; policy deny remains authoritative.
- Readiness and dashboard surfaces expose safe summaries and Implementation v1 scope metadata only; no secrets, env values, raw headers, cookies, tokens, session ids, or credential values are exposed.
- Readiness and dashboard surfaces expose safe summaries only; no secrets, env values, raw headers, cookies, tokens, session ids, or credential values are exposed.
- Policy Bundle Runtime PoC Planning v0 consumes these scope shapes in the future normalized policy input contract and golden decision mappings. Policy Runtime PoC Golden Test Harness v1 now includes missing-tenant, future tenant-mismatch, and service-account non-bypass cases as static fixtures. Policy Runtime Shadow Evaluation Planning v1 preserves tenant/scope fields as comparison metadata for future candidate runtimes. None of these milestones enforce production tenant scope or execute a policy runtime.
- Production tenant enforcement, production dashboard filtering, row-level security, tenant provisioning, and durable scope repositories remain future work.

## Dashboard/Readiness Tenant Scope Cross-reference

Dashboard/Readiness Tenant Scope Planning and Implementation v1 extend this scope inventory with panel and endpoint-level planning plus safe read-model metadata:

- Dashboard panel inventory: `docs/reference/dashboard-tenant-scope-inventory.md`
- Readiness endpoint inventory: `docs/reference/readiness-tenant-scope-inventory.md`
- Dashboard role visibility matrix: `docs/reference/dashboard-role-visibility-matrix.md`
- Readiness role visibility matrix: `docs/reference/readiness-role-visibility-matrix.md`
- Roadmap: `docs/roadmaps/dashboard-readiness-tenant-scope/v1.md`
- Implementation: `docs/roadmaps/dashboard-readiness-tenant-scope/implementation-v1.md`
- Enforcement: `docs/foundations/auth-rbac/tenant-scope-enforcement-v1.md`
- Enforcement inventory: `docs/reference/tenant-scope-enforcement-inventory.md`

These documents and DTOs define target scope dimensions, metadata warnings, redaction labels, partial representative enforcement summaries, and future filtering requirements only. They do not implement production tenant filtering, production tenant isolation, production Auth/RBAC, or row-level security.
