# Production Auth/RBAC Boundary Inventory Audit v1

Date: 2026-05-15

Path chosen: `docs/audits/2026-05-15-production-auth-rbac-boundary-inventory-audit-v1.md`

Path rationale: current audit reports in `docs/audits/` use dated names for time-bound readiness and approval findings. This audit follows that convention while preserving the requested audit title in the filename.

Scope: audit-only boundary inventory for Production Auth/RBAC v1 readiness. This report was prepared by inspecting repository files and running safe local validation commands only. It does not implement auth, issue sessions, issue JWTs, issue API keys, call external providers, run remote Git, run real LLM/MCP/Vault/auth calls, execute vendor CLI, read credential caches, or expose secret/env values.

## 1. Executive Summary

Audit decision: `important_gaps_found`

Confidence: `high`

Auth/RBAC v1 planning consistency: `internally_consistent`

Current implementation safety: `safe_as_mock_planning_only`

Production auth implementation can start: `yes_for_mock_first_foundation_slices`

Critical blocker for next Auth/RBAC implementation slice: `none_for_request_context_and_service_account_boundary_slices`

Critical blocker for production auth enablement: `yes`

Code overclaims production auth: `no`

Summary:
- The repository has a coherent Production Auth/RBAC planning surface across foundations, roadmaps, readiness models, permission matrix docs, dashboard/readiness docs, and safety instructions.
- The current implementation is intentionally mock-first. `MockAuthProvider` remains default, future OIDC/SAML/SCIM/service-account providers are disabled placeholders, production auth is explicitly false in config/readiness surfaces, and no real session/JWT/API-key issuance was found.
- The next implementation work can begin with safe foundation slices: request context propagation, API middleware skeletons, explicit service-account actors, tenant/repo/provider scope models, and audit attribution hardening.
- Production auth cannot be enabled yet. Main blockers are incomplete request-context propagation, missing durable tenant/team/project/repo scoping, no real IdP/session boundary, no service-account credential lifecycle, incomplete dashboard/readiness/audit query scoping, and many service-specific mock/system actor strings.
- No inspected code path was found claiming production auth is enabled. Current code and docs consistently describe auth as mock/planning-only or future-gated.

## 2. Boundary Inventory

Legend:
- `yes`: first-class boundary is present and materially used.
- `partial`: some model or check exists, but propagation/scoping is incomplete.
- `no`: not present at this boundary.

| Boundary | File paths | Current actor source | AuthContext present | RequestContext present | AuthorizationService used | PolicySubject enriched | Tenant/team/repo scope present | Service account model needed | Hardcoded actor strings found | Current risk | Recommended remediation |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| Auth domain models | `packages/auth/src/types.ts`, `packages/auth/src/catalog.ts` | Mock catalog actors, principals, roles, service accounts | yes | yes | yes | partial | partial | yes | `mock-admin`, `svc_runner`, `anonymous-mock` | Models exist, but tenant/workspace/project/repo scope is not durable or consistently propagated. | Add stable tenant, workspace, project, repo, provider, and environment scope fields to RequestContext/AuthContext or an attached scope object. |
| Auth provider and request resolver | `packages/auth/src/providers.ts`, `packages/auth/src/request-context.ts`, `packages/auth/src/service.ts` | `MockAuthProvider`, header-supplied mock actor override, system context | yes | yes | yes | partial | partial | yes | `mock-admin` | Safe for mock mode, not production-authenticating. Header actor override must not become production auth. | Add API middleware boundary that separates trusted production identity from local/mock headers and marks mock contexts non-production. |
| API app composition | `apps/api/src/main.ts` | Service construction defaults plus route body/header actor ids | partial | partial | partial | partial | partial | yes | `mock-admin`, `mock-git-actor`, `mock-agent-actor` | Mixed route-by-route context handling. Some services are auth-aware, others use service defaults. | Introduce request context middleware and pass RequestContext through all route handlers and service calls. |
| `/auth/*` API | `apps/api/src/main.ts` | RequestContextResolver using mock actor headers | yes | yes | yes | yes | partial | yes | `mock-admin` | Good local mock boundary, no real IdP/session/JWT. | Keep as mock introspection until production auth middleware and session/token boundary exist. |
| `/security/*` API | `apps/api/src/main.ts`, `packages/security/src/service.ts` | Request body actor or service fallback | partial | partial | partial | partial | partial | yes | `mock-admin`, `mock-security-actor` | Credential resolution is gated, but metadata and admin-like routes need route-level auth scoping. | Require RequestContext for all security routes; gate reads by viewer/security role and scope SecretRef access by tenant/team/provider. |
| `/git/*` API and Git service | `apps/api/src/main.ts`, `packages/git-adapter/src/service.ts` | `mock-git-actor`, configured service actor | partial | no | partial | partial | partial | yes | `mock-git-actor`, `github-webhook-receiver`, `github-sync-service` | Remote operations are gated, but actor attribution is service-string based and not request-scoped. | Add Git service-account actors plus requester context, repo grants, branch prefix scope, and Auth/RBAC to PolicySubject mapping. |
| GitHub App boundary | `packages/git-adapter/src/github-app.ts`, `apps/api/src/main.ts` | GitHub App runtime actor, token provider service actor | partial | no | partial | partial | partial | yes | `github-app-token-provider`, `mock-admin` | Safe gated skeleton, but no production service-account credential issuance model. | Add explicit GitHub App service account with allowed repo/action scope and non-secret token-handle audit attribution. |
| Git webhook receiver | `packages/git-adapter/src/webhooks.ts` | Webhook receiver/sync service actor | partial | no | partial | partial | partial | yes | `github-webhook-receiver`, `github-sync-service` | Signature/policy gates exist, but future production needs service-account and repo tenant attribution. | Introduce webhook processor service account, replay scope, repo tenant binding, and audit correlation with delivery ids. |
| `/llm/*` API and LLM Gateway | `apps/api/src/main.ts`, `packages/llm-gateway/src/gateway.ts`, `packages/llm-gateway/src/routing.ts` | RequestContext for route/completion; fallback gateway actor | partial | partial | partial | partial | partial | yes | `mock-llm-actor` | Route/completion paths are comparatively strong, but non-API callers and usage ledger still rely on actor ids. | Make AuthContext required for invocation, budget, usage ledger, fallback, and provider credential resolution. Add tenant/provider/model scope. |
| Enterprise/local CLI provider boundary | `packages/llm-gateway/src/enterprise-providers.ts`, `packages/llm-gateway/src/providers.ts` | Request actor or provider abstraction service actor | partial | no | no | partial | partial | yes | provider/service local strings | Credential-cache denial is strong; production user/host consent and tenant scope are incomplete. | Propagate RequestContext into provider abstraction, require Local Agent user/host grants, and keep credential access denied. |
| `/mcp/*` API and MCP Gateway | `apps/api/src/main.ts`, `packages/mcp-gateway/src/gateway.ts` | RequestContextResolver AuthContext | yes | yes | yes | yes | partial | yes | mock MCP provider ids | Strongest cross-boundary AuthContext propagation. Missing tenant/tool/server grants. | Add tenant/team/server/tool scope and explicit service account for gateway catalog/index work. |
| `/local-agents/*` API and Local Agent protocol | `apps/api/src/main.ts`, `packages/llm-gateway/src/local-agent-protocol.ts` | Body userId/actorId or protocol service fallback | partial | no | no | partial | partial | yes | `mock-local-agent-protocol` | Consent/session concepts exist, but not bound to production AuthContext. | Require RequestContext, bind user/host/agent consent to tenant/team/project, and use service account for protocol coordination. |
| Runner API and runner service | `apps/api/src/main.ts`, `packages/runner/src/service.ts` | Body actorId or `mock-agent-actor`/`mock-runner-actor` | no | no | no | partial | partial | yes | `mock-agent-actor`, `mock-runner-actor` | Command execution is gated, but requester and service actor are not first-class AuthContext. | Add requester RequestContext plus runner service account. Include repo/workspace/harness scope in policy subject/context. |
| Worker task flow | `apps/worker/src/**`, `packages/runner/src/**` | Task requester ids, mock policy/service actors | no | no | no | partial | partial | yes | mock/system task actors | Future background execution needs service-account attribution and original requester context. | Persist request context snapshot or actor reference on TaskRun and propagate into worker policy checks. |
| Registry API and service | `apps/api/src/main.ts`, `packages/registry/src/index.ts` | Body actorId or default `mock-admin` | partial | no | partial | partial | partial | yes | `mock-admin` | Registry mutation policy exists, but API often falls back to mock admin and lacks tenant/package scope. | Require RequestContext for mutations, approval, rollback, import, eval attachment; add package namespace/team ownership. |
| Governance and improvement flows | `packages/improvement/src/index.ts`, `apps/api/src/main.ts` | Body actorId or `mock-admin` | no | no | no | partial | partial | yes | `mock-admin`, deterministic mock reviewer strings | Draft/apply gates are safe, but reviewer identity and approval scope are mock-only. | Add reviewer/requester AuthContext, governance service account, proposal tenant scope, and audit attribution hardening. |
| Policy service | `packages/policy/src/types.ts`, `packages/policy/src/engine.ts`, `packages/policy/src/default-rules.ts` | PolicySubject passed by caller, fallback mock/system subjects | partial | no | no | partial | partial | yes | `mock-policy-actor` | Policy deny is strong, but subject lacks tenant/project/repo/provider scope. | Extend PolicySubject/PolicyResource/PolicyContext with tenant, team, project, repo, provider, environment, and request metadata. |
| Secrets and credential manager | `packages/security/src/service.ts`, `packages/security/src/credentials.ts`, `packages/security/src/vault.ts` | Request authContext when provided, fallback security actor | partial | partial | partial | partial | partial | yes | `mock-security-actor` | Credential resolution checks auth/policy, but SecretRef scope model must be tenant/provider-aware. | Make AuthContext mandatory for credential resolution and lease issuance. Scope SecretRefs to tenant/team/provider and deny broad service actors by default. |
| Sandbox/network/redaction | `packages/security/src/service.ts`, `packages/security/src/redaction.ts` | Actor id metadata or service fallback | partial | no | partial | partial | partial | yes | mock/security service actors | Safe default-deny/redaction, but no production subject ownership model. | Propagate RequestContext into sandbox decisions and network egress decisions; audit both requester and enforcing service account. |
| Dashboard read models | `apps/api/src/dashboard-read-model.ts`, `apps/web/lib/**`, `apps/web/src/**` | Demo/mock admin current context | partial | no | partial | partial | partial | yes | `mock-admin` | Read-only and sanitized, but globally visible without future tenant/viewer scoping. | Add dashboard viewer AuthContext, tenant/team filters, read permission checks, and data minimization per viewer role. |
| Readiness APIs | `apps/api/src/main.ts`, `packages/deployment-readiness/src/**` | In-memory read-only service, no requester | no | no | no | no | partial | yes | planning/mock status strings | Safe for mock staging, but production readiness needs viewer and tenant filtering. | Add read-only auth middleware and scoped readiness summaries before production use. |
| Observability APIs and service | `apps/api/src/main.ts`, `packages/observability/src/**` | Query filters and audit event actor ids | partial | no | no | partial | partial | yes | audit/source strings | Sanitization exists, but audit query access is not AuthContext-scoped. | Require audit-reader role, tenant/team filters, retention class permissions, and service-account exporter attribution. |
| Database schema | `infra/migrations/0001_initial_aichestra_schema.sql` | Stored actor/user/requester strings | no | no | no | no | no | yes | actor id columns without durable auth tables | No production auth persistence model. Local-agent sessions are not production auth sessions. | Add durable principal, actor, team, role binding, service account, tenant, scope grant, and audit query index schema in a future migration. |

## 3. Hardcoded Actor And Mock/System Actor Search

Search command used:

```text
rg -n "mock.*actor|mock.*user|system.*actor|actorId|principalId|AuthContext|RequestContext|AuthorizationService|PolicySubject|service_account|service-account|tenant|teamId|ownerTeamId|roles|permissions|createdByActorId|requestedBy|approvedBy|system|anonymous_mock" apps packages tests docs
```

Classification:

| Class | Representative locations | Finding | Risk |
|---|---|---|---|
| Valid Auth/RBAC model usage | `packages/auth/src/types.ts`, `packages/auth/src/service.ts`, `packages/auth/src/catalog.ts` | First-class `AuthContext`, `RequestContext`, `AuthorizationService`, principals, actors, roles, permissions, role bindings, service accounts. | Low in mock mode; needs production scope extension. |
| Safe test fixtures | `tests/**`, package-local test files | Mock actors, mock users, default roles, and fixture system actors are deterministic fixtures. | Low if never reused as production defaults. |
| Safe planning docs | `docs/foundations/auth-rbac/**`, `docs/roadmaps/auth-rbac-production/**`, `docs/reference/**` | Planning docs explicitly state mock-first, disabled real IdP/session/token behavior, and future scope needs. | Low. |
| Service-specific actor string needing migration | `packages/git-adapter/src/service.ts`, `packages/git-adapter/src/webhooks.ts`, `packages/llm-gateway/src/gateway.ts`, `packages/runner/src/service.ts`, `packages/registry/src/index.ts`, `packages/improvement/src/index.ts` | Actor ids such as Git service actors, webhook receiver actors, LLM/runner actors, and registry mock admin defaults are used for attribution and policy subjects. | Medium. Safe today because risky actions are gated, but production needs service-account models and requester context. |
| Hardcoded mock/system actor needing explicit RequestContext | `apps/api/src/main.ts`, `apps/api/src/dashboard-read-model.ts`, `packages/auth/src/request-context.ts` | Route defaults and dashboard current context use `mock-admin` or route-specific mock actors. | Medium. Must not become production auth. |
| Missing tenant/team/repo scope | API routes, Git, Registry, LLM, MCP, Security, Observability, Dashboard | Team roles exist, but tenant/project/repo/provider/environment scope is not consistently first-class in AuthContext or PolicySubject. | High for production auth; acceptable for mock/planning mode. |
| Suspicious production-auth claim | None found | Inspected code/docs do not claim production auth is enabled. | Low. |

## 4. Policy Integration Audit

Overall classification: `partial`

| Check | Status | Evidence | Notes |
|---|---:|---|---|
| AuthContext maps to PolicySubject where available | pass | `AuthorizationService.toPolicySubject` maps actor, principal, actor kind, roles, teams, auth mode, service account id, mock flag, and metadata. | Tenant/project/repo/provider scope is still missing. |
| Roles/teams/authMode included where expected | pass | Auth service policy mapping includes roles, teams, and authMode. | Scope enrichment is incomplete. |
| Policy deny still wins | pass | AuthorizationService combines RBAC and policy checks; policy denial produces denied decisions. Policy engine has default deny. | No admin bypass found in inspected paths. |
| Admin roles do not bypass deny-by-default risky actions | pass | Policy denies remain for remote Git unsafe ops, runner commands by default, credential cache, secret reads, high-risk MCP, local CLI danger/network/shell, and dynamic policy paths. | Some mock allow rules exist for low-risk/local reads. |
| Git operations check policy | partial | Git service, GitHub App, and webhook receiver build policy subjects and evaluate operations. | Actor source is service-string based rather than RequestContext/service account. |
| LLM operations check policy | partial | Route/completion paths use AuthContext when supplied; remote completion/credential resolution are gated. | Non-API or fallback paths can fall back to gateway actor ids. |
| MCP operations check auth/policy | pass | MCP API passes RequestContext/AuthContext; gateway authorizes list/invoke and applies policy/risk/secret checks. | Tenant/tool grants still missing. |
| Secret credential resolution checks auth before env/Vault read | pass | Security service resolves AuthContext and checks authorization/policy before credential resolution; SecretRef/Vault/env boundaries are gated and sanitized. | AuthContext should become mandatory. |
| Runner operations check policy | partial | Runner service evaluates runner command policy and harness policy. | No AuthContext propagation; actor id is a request field or mock fallback. |
| Registry mutations check policy | partial | Policy-backed mutation authorizer exists. | API/service defaults can use `mock-admin`; no tenant/package scope. |
| Local CLI credential cache read remains denied | pass | Policy denies credential cache read/upload; LLM provider/local-agent code sanitizes credential-cache paths and records denials. | Keep this invariant. |
| `secret.read` remains denied | pass | Default policy denies `secret.read`; credential resolution uses provider credential action, not raw secret read. | No raw secret values found in API/dashboard returns. |

High-risk policy gap:
- Policy subjects and resources do not yet carry enough tenant/project/repo/provider/environment scope to enforce production multi-tenant access. This is the central Auth/RBAC v1 boundary gap.

## 5. Tenant/Scope Audit

| Area | Current scope fields | Missing scope | Production impact | Recommended next implementation slice |
|---|---|---|---|---|
| Git repo operations | Repo id/name, allowed repo config, branch prefix config, actor id | Tenant, owning team, project, repo grant, requester, service account | Cannot enforce who may read/create PRs/branches for a repo in production. | Tenant/repo/provider scope model v1 plus Git service-account actor boundary. |
| GitHub App repo grants | Installation/repo allowlists and app metadata | Tenant/team ownership, installation-to-tenant binding, requester context | Installation token decisions cannot be audited against tenant grants. | GitHub App service-account and repo grant model. |
| LLM provider/model access | Provider kind/id, model id, budget policy, actor id | Tenant, team, project, model entitlement, data classification | Provider/model usage cannot be isolated or budgeted per tenant/team. | LLM request context and provider/model scope model. |
| MCP server/tool access | Server id, tool id, risk level, required permissions | Tenant, team, server/tool grant, data classification, environment | Low-risk mock calls are safe, but production MCP requires scoped tool grants. | MCP server/tool access grant model with AuthContext propagation. |
| SecretRef access | SecretRef scope strings, provider/kind metadata, lease metadata | Tenant/team/provider owner, environment, service-account permission, requester | SecretRefs cannot become production-safe until bound to durable owners and policy subjects. | SecretRef scope hardening and credential resolver AuthContext requirement. |
| Registry package access | Registry object ids, lifecycle, approvals, actor id | Namespace owner, team/project ownership, tenant, package grant | Mutations and approvals need scoped authorization. | Registry namespace/team ownership and RequestContext mutation gate. |
| Local Agent user/host access | userId, agent id, host/user metadata, consent records | Tenant/team/project, device owner, requester, service account | Local Agent consent cannot be safely enforced for production tenants. | Local Agent consent scope v1 and protocol service account. |
| Dashboard/readiness data access | Read-only global summaries | Viewer role, tenant/team filter, project/repo filter | Global read models may reveal cross-tenant metadata in production. | Dashboard/readiness auth scoping v1. |
| Audit query access | Source/category filters, actor ids, sanitized events | Tenant/team filter, audit-reader permission, retention class grants | Production audit browsing needs strict authorization and data partitioning. | Observability audit query scoping v1. |
| Policy evaluation access | PolicySubject roles/teams/authMode; PolicyResource ids/kinds | Tenant, project, repo, provider, environment, data classification | Policy cannot express production isolation rules fully. | PolicySubject/PolicyResource scope enrichment v1. |

## 6. Service Account Audit

| Boundary | Current actor source | Required service account | Allowed actions | Forbidden actions | Required SecretRef/Policy/Auth checks | Audit attribution need |
|---|---|---|---|---|---|---|
| Worker/task runner | Task requester strings and runner mock actor | `svc_worker_runner` | Execute approved local/mock task runs, read scoped task metadata | Remote Git, secret injection, network, destructive commands unless explicitly gated | Auth snapshot of requester, runner policy, harness policy, SecretRef denial by default | Attribute both requester and worker service account. |
| Git webhook processor | `github-webhook-receiver`, `github-sync-service` | `svc_git_webhook_processor` | Verify/record allowed webhook metadata, update read models | Trigger workflows, merge/rebase/push/delete branches | Signature, repo allowlist, policy allow, Auth/RBAC service account permission | Attribute delivery id, repo scope, service account, resulting read-model updates. |
| GitHub App token issuer | GitHub App token provider actor | `svc_github_app_token_issuer` | Mint token handles only when gates and repo grants pass | Read private key values in default runtime, expose tokens, auto-merge | SecretRef metadata, policy, app/repo allowlist, Auth/RBAC allow | Attribute installation/repo/token-handle metadata without token values. |
| LLM gateway service | Gateway actor or request actor | `svc_llm_gateway` | Route permitted requests, apply budget, resolve gated provider credentials | Direct provider calls without gates, credential cache reads, raw prompt/response exposure | Requester AuthContext, provider/model grant, budget, policy, SecretRef credential boundary | Attribute requester, service account, virtual model key, budget result. |
| MCP gateway service | RequestContext plus mock gateway internals | `svc_mcp_gateway` | List/invoke permitted mock/approved tools | Secret resolve, network/write/deploy/high-risk tools unless explicitly approved | Requester AuthContext, server/tool grants, policy, redaction, no SecretLease issuance to tools by default | Attribute requester, service account, tool, risk, policy decision. |
| Vault credential resolver | Security service actor fallback | `svc_secret_resolver` | Resolve permitted credential handles behind gates | Read/export/list/rotate/delete secrets outside allowlisted credential boundary | AuthContext, SecretRef owner/scope, policy, Vault gates, sanitized audit | Attribute requester, service account, SecretRef id, lease metadata only. |
| Observability exporter future | Source service strings | `svc_observability_exporter` | Export scoped sanitized metrics/audit summaries when implemented | External export by default, raw secrets/prompts/tokens | Auth/RBAC service account, retention policy, redaction, export allowlist | Attribute export job, tenant scope, retention class, redaction status. |
| Migration runner | Manual `pnpm db:migrate` and DB package boundaries | `svc_migration_runner` | Run explicitly invoked migrations in approved environment | Automatic app-start migrations, destructive migration without approval | Operator AuthContext, environment scope, migration policy, no env value exposure | Attribute operator and service account to migration id. |
| Deployment runner future | Staging/deployment planning only | `svc_deployment_runner` | Future explicit staging execution only after signoff/audit gates | Production deployment, release/tag creation, remote provider calls without gates | Approval audit, scope match, operator AuthContext, deployment policy, no secrets exposed | Attribute operator, service account, scope commit, commands, rollback checkpoint. |
| Local Agent protocol future | Body actor/user ids and protocol actor fallback | `svc_local_agent_protocol` | Coordinate consent/session metadata with user agent | Direct local CLI execution, credential cache reads, secret forwarding | User AuthContext, host/device grant, consent, policy, sandbox/network controls | Attribute requester, device/agent, consent id, service account, denied capabilities. |

## 7. Dashboard/Readiness Auth Audit

Classification: `safe_for_mock_staging`, `needs_auth_before_production`

Findings:
- Dashboard and readiness APIs are read-only in the inspected implementation. They expose summaries, booleans, counts, planning statuses, blockers, health metadata, and sanitized read models.
- No dashboard/readiness route was found deploying resources, issuing credentials, calling external providers, reading credential caches, or exposing raw secret/env values.
- Dashboard auth read model uses a mock admin context to demonstrate `dashboard.read` and policy-denied risky actions. This is safe as a local/mock read model, not production auth.
- Readiness surfaces are not tenant/team/project scoped. They should not be treated as production-safe until viewer role mapping and tenant/team filtering exist.
- Audit/readiness views need production role mapping, likely `viewer`, `security_reviewer`, `release_manager`, `platform_owner`, and audit-specific read roles.

Boundary classification:
- `/dashboard/*`: `safe_for_mock_staging`; `needs_auth_before_production`
- `/readiness/*`: `safe_for_mock_staging`; `needs_auth_before_production`
- `/observability/*`: `safe_for_mock_staging`; `needs_auth_before_production`
- `/dashboard/auth-production`: `safe_for_mock_staging`; `needs_auth_before_production`
- `/staging/*`: `safe_for_mock_staging`; `needs_auth_before_production`

No dashboard/readiness route was classified as `needs_auth_before_staging_execution` for the current mock/local staging readiness phase, provided staging execution remains manual and no production traffic or external providers are enabled.

## 8. Production Blockers

| Blocker | Severity | Dependency | Recommended owner | Suggested next task |
|---|---:|---|---|---|
| Real IdP selection | high | Product/security/platform decision | security_reviewer + platform_owner | Select production auth provider and document OIDC/SAML/SCIM boundaries. |
| Session/JWT boundary | high | IdP decision, web/API middleware design | engineering_owner + security_reviewer | Create session/token boundary skeleton without issuing real tokens. |
| Service account credential issuance | high | Service account model and SecretRef policy | platform_owner + security_reviewer | Implement service-account actor boundary and non-secret credential handle design. |
| Tenant model | high | Product/account model and DB schema | product_owner + engineering_owner | Add tenant/team/project/repo scope model and persistence plan. |
| Request context propagation | high | API middleware and service signatures | engineering_owner | Implement RequestContext propagation v1 across API, worker, services, audit. |
| Dashboard/readiness data scoping | medium | Tenant/viewer roles and read-model filters | product_owner + engineering_owner | Add dashboard/readiness auth scoping v1. |
| Audit query scoping | high | Tenant model, retention classes, audit roles | security_reviewer + observability owner | Add audit-reader roles and tenant-scoped observability queries. |
| Break-glass flow | medium | Policy bundle/governance design | security_reviewer | Plan break-glass approval, expiration, and audit model. |
| Mock actor deprecation | high | RequestContext/service accounts | engineering_owner | Replace route/service mock actor defaults with explicit RequestContext or service account. |
| CI tests for auth scope | medium | Auth scope model and route middleware | qa_reviewer + engineering_owner | Add deterministic tests for missing scope, denied cross-tenant access, and mock fallback prohibition. |
| Policy bundle integration | medium | Policy Bundle / OPA-Cedar future plan | platform_owner + security_reviewer | Keep static policy runtime until explicit policy bundle skeleton task. |

## 9. Recommended Implementation Slices

### 1. RequestContext Propagation v1

Goal: make RequestContext the standard input for API, worker, provider, registry, runner, observability, and security service calls.

Scope:
- `packages/auth/src/request-context.ts`
- `apps/api/src/main.ts`
- service request types in Git, LLM, MCP, Security, Registry, Runner, Improvement, Observability
- worker task-run entry points

Safety constraints:
- Keep `MockAuthProvider` default.
- Do not add real login, sessions, JWTs, API keys, IdP calls, or credential reads.
- Keep mock headers clearly marked non-production.

Tests needed:
- Every protected route creates or receives RequestContext.
- Missing context is denied or explicitly treated as mock-read-only.
- Audit events include request id, actor id, principal id when present, and source.

Expected status after completion: Auth/RBAC propagation becomes consistent but still mock-only.

### 2. API Route AuthContext Middleware Skeleton v1

Goal: centralize route-level auth enforcement and remove ad hoc route defaults.

Scope:
- API middleware/router helpers
- route permission matrix
- dashboard/readiness/observability read gates
- mutation/write route gates

Safety constraints:
- Middleware must not authenticate against external IdP.
- No session/JWT issuance.
- Policy deny must remain authoritative.

Tests needed:
- Mock read routes allowed for permitted mock roles.
- Mutations without required permission denied.
- `mock-admin` fallback cannot silently authorize production-marked requests.

Expected status after completion: API route auth decisions become auditable and deterministic.

### 3. Service Account Actor Boundary v1

Goal: replace service-specific string actors with explicit service-account actors and audit attribution.

Scope:
- Git webhook processor
- GitHub App token handle issuer
- LLM gateway
- MCP gateway
- runner/worker
- Vault/SecretRef credential resolver
- migration and future deployment runners

Safety constraints:
- Do not issue real service-account credentials.
- Service accounts are metadata and policy subjects only.
- SecretRef and policy gates stay mandatory.

Tests needed:
- Service accounts cannot perform forbidden actions.
- Requester and service-account attribution are both retained.
- Credential/cache/secret reads remain denied unless gated credential resolution passes.

Expected status after completion: background and provider operations have explicit non-human actor boundaries.

### 4. Tenant/Repo/Provider Scope Model v1

Goal: add first-class tenant/team/project/repo/provider/environment scope fields to Auth/RBAC and Policy resources.

Scope:
- Auth models
- policy subject/resource/context
- Git repo grants
- LLM provider/model grants
- MCP server/tool grants
- SecretRef ownership
- registry namespace ownership

Safety constraints:
- Scope model only; do not enforce production traffic or external calls.
- No production tenant migration until reviewed separately.

Tests needed:
- Missing scope denies production-marked requests.
- Cross-tenant access denies.
- Mock/local fixtures remain deterministic.

Expected status after completion: production authorization decisions can express isolation boundaries.

### 5. Dashboard/Readiness Auth Scoping v1

Goal: make read-only surfaces tenant/team scoped and role-aware.

Scope:
- `/dashboard/*`
- `/readiness/*`
- `/observability/*`
- web dashboard providers and panels

Safety constraints:
- Keep read-only behavior.
- Do not expose raw secrets/env values.
- Do not run live checks from dashboards.

Tests needed:
- Viewer role sees only scoped summaries.
- Security/release roles see only allowed audit/readiness metadata.
- No raw secret/env/token values appear in dashboard/readiness responses.

Expected status after completion: dashboard/readiness can be production-scoped without becoming operational control surfaces.

### 6. Auth Audit Attribution Hardening v1

Goal: standardize audit envelopes for requester, principal, team, service account, policy decision, and scope.

Scope:
- auth audit events
- policy decision audit
- provider/security/git/runner/mcp/registry audit repositories
- observability normalization

Safety constraints:
- Sanitization must remain before storage/return.
- No raw prompts, provider responses, secrets, tokens, session ids, env values, or credential cache paths.

Tests needed:
- Audit sanitizer redacts sensitive material.
- Required attribution fields exist for controlled operations.
- Audit query scoping denies cross-tenant reads.

Expected status after completion: production auth decisions have durable, sanitized attribution.

### 7. OIDC/SAML/SCIM Adapter Planning-To-Skeleton v1

Goal: add disabled provider skeletons only after local request-context and scope enforcement are stable.

Scope:
- disabled provider interfaces
- provider selection config validation
- mapping docs/tests

Safety constraints:
- No external IdP calls.
- No real sessions/JWTs.
- No credentials, secrets, SSO assertions, or SCIM sync.

Tests needed:
- Providers are disabled by default.
- Missing gates skip/block.
- No token/session material is accepted or returned.

Expected status after completion: provider integration boundaries exist but remain inactive.

## 10. Safe Integration Compliance

Scan command used:

```text
rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|gemini|codex|gitlab|bitbucket|bedrock|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|GITHUB_APP_PRIVATE_KEY|GITHUB_APP_ID|GITHUB_INSTALLATION_ID|AICHESTRA_GITHUB_WEBHOOK_SECRET|GOOGLE_APPLICATION_CREDENTIALS|AICHESTRA_LLM_API_KEY|LLM_API_KEY|DATABASE_URL|AICHESTRA_DATABASE_URL|AICHESTRA_TEST_DATABASE_URL|VAULT_ADDR|VAULT_TOKEN|AICHESTRA_VAULT_TOKEN|SESSION_SECRET|JWT_SECRET|PASSWORD|SAML|OIDC|SCIM|OKTA|AUTH0|ENTRA|OPA|REGO|CEDAR|POLICY_BUNDLE|~/.codex|auth.json|~/.claude|credential cache|git fetch|git push|git merge|git rebase|kubectl|vault|temporal|mcp|child_process|exec\\(|spawn\\(|eval\\(|new Function" .
```

Classification:

| Class | Status | Notes |
|---|---:|---|
| Safe documentation references | pass | Many findings are roadmap, audit, README, AGENTS, and reference docs describing gates, forbidden behavior, or future plans. |
| Safe mock/test references | pass | Test and fixture references cover mock actors, skipped live tests, and redaction behavior. |
| Safe type/interface references | pass | Provider, auth, policy, and readiness interfaces include future provider and credential terms without enabling them. |
| Safe config placeholders | pass_with_warning | Placeholder env/config names are documented. A local compose database password placeholder exists and must remain development-only, not production secret material. |
| Auth/RBAC planning only | pass | OIDC/SAML/SCIM/session/JWT/API-key terms appear as disabled or future planning references, not as implemented production auth. |
| Dashboard API read only | pass | Dashboard/readiness findings are sanitized read models and planning metadata. |
| Gated GitHub/LLM/MCP/Vault boundaries | pass | Real provider paths are behind explicit gates, allowlists, policy checks, and SecretRef boundaries. |
| Suspicious integration code | none_found_for_default_runtime | Gated HTTP/provider clients exist where expected, but default runtime/tests do not enable external provider calls. |
| Unsafe credential/session/auth behavior | none_found | No default runtime path was found issuing real sessions, JWTs, API keys, reading credential caches, or exposing secret/env values. |

Default runtime/test compliance:
- External IdP calls: `not_found`
- Real session issuance: `not_found`
- JWT issuance: `not_found`
- API key issuance: `not_found`
- Raw secret/env exposure in API/dashboard/readiness: `not_found`
- Policy bypass for risky actions: `not_found`
- Production auth enabled claim: `not_found`

## 11. Validation

Validation status: `green`

| Command | Result | Notes |
|---|---:|---|
| `pnpm lint` | pass | `lint passed` |
| `pnpm typecheck` | pass | TypeScript typecheck completed with exit code 0. |
| `pnpm test` | pass | 307 tests: 299 pass, 0 fail, 8 skipped. Skips were optional live integration profiles with missing gates, as expected. |
| `pnpm build` | pass | `build passed` |
| `git diff --check` | pass_with_warnings | Exit code 0. Reported line-ending normalization warnings on existing modified docs only; no whitespace errors. |

## 12. Final Summary

Audit decision:
`important_gaps_found`

Confidence:
`high`

Auth/RBAC readiness:
`mock_planning_ready_not_production_ready`

Boundary inventory status:
`complete_for_v1_inventory`

Major gaps:
- RequestContext propagation is partial and route-specific.
- Many service paths still rely on service-specific mock/system actor strings.
- Tenant/team/project/repo/provider/environment scope is not consistently modeled or propagated.
- Service-account actors exist conceptually but are not yet enforced as production service accounts.
- Dashboard/readiness/observability read models are sanitized and read-only, but not production tenant-scoped.
- Registry, runner, improvement/governance, Git, and Local Agent flows need explicit requester plus service-account attribution.

Critical blockers:
- Real IdP selection and session/token boundary are unresolved.
- Durable tenant/scope model is missing.
- Production service-account credential lifecycle is missing.
- RequestContext and audit attribution are not universal.
- Production dashboard/readiness/audit query scoping is missing.

Important follow-ups:
- Implement mock-first RequestContext propagation v1.
- Add API route AuthContext middleware skeleton v1.
- Add explicit service-account actor boundary v1.
- Add tenant/repo/provider scope model v1.
- Add dashboard/readiness and audit query auth scoping v1.

Recommended implementation slices:
1. RequestContext Propagation v1
2. API Route AuthContext Middleware Skeleton v1
3. Service Account Actor Boundary v1

Validation:
- lint: `pass`
- typecheck: `pass`
- test: `pass`
- build: `pass`
- git diff --check: `pass_with_line_ending_warnings`

Safe integration compliance:
`pass_with_warning_for_development_only_config_placeholder`

Production readiness:
`false`
