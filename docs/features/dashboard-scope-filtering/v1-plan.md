# Dashboard Scope Filtering v1 — Pre-implementation Plan

Status: planning (no implementation in this document)

## Current Behavior Baseline

- **Dashboard read model.** `apps/api/src/dashboard-read-model.ts` already attaches `ScopedReadModelMetadata` to every dashboard panel via `withScopeMetadata` and `dashboardScopeMetadata(context, panelId)`. Today the metadata is *display only*: `scopeStatus`, `appliedScopes`, `requiredScopes`, `missingScopes`, `sensitivity`, `roleVisibility`, `redactionStatus`, `tenantFilteringImplemented: false`, `productionEnforcementImplemented: false`, `enforcementMode`, `scopeDecisionSummary`, `warnings`. No panel is *hidden* or *redacted* — every panel is fully rendered for every actor.
- **Scope metadata source.** `DashboardReadinessTenantScopePlanningService` in `packages/deployment-readiness/src/dashboard-tenant-scope.ts` owns the inventory: each `DashboardTenantScopePlan` carries `requiredScopes`, `allowedRoles`, `redactionClass`, `enforcementStatus`, and `fallbackBehavior`. `getRoleVisibilityMatrix` returns 9 mock roles (`viewer | developer | reviewer | security_admin | platform_admin | service_account_runner | audit_reader | release_manager | system_admin_future`).
- **Role visibility matrix.** `docs/reference/dashboard-role-visibility-matrix.md` declares the same 9 roles and what each role *should* see, but the declared visibility is metadata-only today.
- **Tenant Scope Enforcement v1.** `TenantScopeEnforcementService` in `packages/auth/src/tenant-scope-enforcement.ts` already produces `TenantScopeEnforcementDecision` and `TenantScopeEnforcementDecisionSummary` snapshots (allow / warn / deny_for_sensitive / future_production) used as metadata only. `productionTenantEnforcement` and `tenantFilteringImplemented` stay `false`.
- **Auth context.** `apps/api/src/main.ts` extracts `actor.id` and `roles` from `requestContext.authContext` but does not yet plumb a *demo* role into dashboard route handlers — every actor sees the unrestricted admin view.
- **Renderer.** `apps/web/src/render.ts` already extracts `panelScopeSummaries`, `scopeWarningSummaries`, and `roleVisibilityHints` for the "Scope / Visibility / Redaction" panel, but nothing actually hides or redacts a panel's body.

## Proposed Filter Context Model

Introduce a `DashboardScopeFilterContext`:

```
{
  actorId: string,
  principalId?: string,
  roles: TenantScopePlanningRole[],   // safe role tags — never raw identity material
  tenantIds: string[],
  teamIds: string[],
  projectIds: string[],
  resourceScopes: string[],
  source: "demo" | "api" | "mock_actor",
  authMode: "mock_actor" | "demo_request_header" | "service_account_mock",
  metadata: Record<string, unknown>
}
```

The context is built from the existing `AuthContext`/`RequestContext` (mock-actor by default) and optionally enriched by safe-only demo request headers (`x-aichestra-demo-role`, `x-aichestra-demo-tenant-id`, `x-aichestra-demo-team-id`, `x-aichestra-demo-project-id`, comma-separated). Demo headers are **not auth**: they exist only to exercise the filter; the service marks `authMode: "demo_request_header"` and refuses any role outside the existing 9-role catalog. Authorization, session, cookie, JWT, and API-key handling are unchanged.

## Proposed Panel Decision Model

```
DashboardPanelFilterDecision
  panelId
  decision: "visible" | "redacted" | "hidden" | "warning_only" | "not_applicable"
  reason
  requiredRoles[]
  matchedRoles[]
  requiredScopes[]
  missingScopes[]
  sensitivity
  redactedFields[]
  redactionClass
  productionFiltering: false
  metadata
```

Rule sketch (deterministic, mock-first):

1. If panel is `overview`, `tenantScopePlanning`, or `tenantScopeEnforcement`, always `visible` — they are the safety meta-views.
2. If `allowedRoles ∩ context.roles` is empty:
   - `redactionClass ∈ { secret_adjacent, never_store_raw }` → `hidden`,
   - else → `warning_only` (panel body redacted to summary fields).
3. Else if any `requiredScopes` are missing from `context`:
   - `redactionClass ∈ { secret_adjacent, never_store_raw }` → `redacted`,
   - else → `warning_only`.
4. Else if `redactionClass ∈ { secret_adjacent, never_store_raw }` and the role is *not* `security_admin | platform_admin | audit_reader`:
   - `redacted` — body fields whitelisted to safety/no-secret summary only.
5. Else `visible`.
6. Service account actors (`service_account_runner`) always get `warning_only` for human-facing panels — they're attribution surfaces.

## Proposed `DashboardScopeFilteringService`

Lives in `packages/deployment-readiness/src/dashboard-scope-filtering.ts` (sibling of `dashboard-tenant-scope.ts`). Methods:

- `buildFilterContext(input): DashboardScopeFilterContext`
- `evaluatePanel(panelId, summary, context): DashboardPanelFilterDecision`
- `evaluatePanels(summaries, context): DashboardPanelFilterDecision[]`
- `filterReadModels(models, context): DashboardReadModels` — applies the decisions
- `redactPanel(panel, decision): DashboardJsonObject` — replaces sensitive fields with `"[redacted]"` placeholders and adds `filterDecision` metadata
- `summarizeDecisions(decisions): DashboardScopeFilterSummary`
- `getSummary(decisions): DashboardScopeFilterSummary` (count helper)

Service is stateless; demo header parsing is exposed as a separate `parseDashboardFilterHeaders(request)` helper used only by the API layer.

## Selected Panels for Filtering / Redaction

Initial v1 set (per task brief):

- `security` (SecretRef / Security)
- `vaultSecretBackend` (Vault Secret Backend)
- `observability` (Observability / Audit) — narrower for `audit_reader`
- `audit` (Audit Summary)
- `githubApp` (GitHub App)
- `llmIntegration` (LLM integration)
- `mcp` (MCP Gateway)
- `registry` + `policy` (Registry / Governance)
- `tenantScopePlanning` + `tenantScopeEnforcement` (Tenant Scope) — always visible
- `staging`, `stagingRC` (= `stagingReleaseCandidate`), `stagingExecution` (Staging)

`overview`, `tasks`, `git`, `conflicts`, `agents`, and other operational panels stay visible by default for non-admin roles but pass through the redaction rules above.

## Fallback Behavior

When the filter context is missing (no demo header, no resolvable role), the service defaults to `roles: ["platform_admin"]` for compatibility with existing demo flows. This keeps mock/admin visibility the same as today.

## Safety Constraints (Verbatim)

- No production Auth/RBAC.
- No real tenant provisioning.
- No row-level security.
- No production tenant isolation.
- No real OIDC/SAML/SCIM/session/JWT/API key.
- No external identity provider calls.
- No GitHub, OpenAI, Anthropic, Gemini, Bedrock, LiteLLM, MCP, Vault, Kubernetes, Temporal, OPA, Cedar, artifact registry, cloud service, or external auth system calls.
- No remote Git, no real LLM/MCP calls.
- No secret/env exposure.
- No weakening of Auth/RBAC, Policy, Tenant Scope, Dashboard, Readiness, Observability, SecretRef, Git, LLM, MCP, Registry, Governance, Staging, CI/CD, or Safety gates.
- Default runtime stays mock-first.

## What v1 Implements

1. Models + service in `packages/deployment-readiness/src/dashboard-scope-filtering.ts`.
2. API wiring in `apps/api/src/main.ts` so dashboard responses optionally include `filterSummary` and `filterDecisions` arrays based on demo-only headers.
3. New `RegistryDashboardFilterReadModel` (no — keep within `DashboardReadModels`) — the `tenantScopeEnforcement` read model gains a `filterSummary` field.
4. HTML panel update: redaction badges + filter summary block.
5. Tests: 14+ deterministic cases covering viewer/developer/security_admin/audit_reader/platform_admin/service_account_runner role behavior, missing-scope warning/redaction, secret-adjacent redaction, `productionFiltering: false`, no-secret/no-env exposure.
6. Docs: this plan, `v1.md`, cross-links to role visibility matrix, tenant-scope inventory, tenant scope enforcement, dashboard v0, real-integration roadmap, AGENTS.md, README.md, and the phase-progress checklist HTML.

## What v1 Does Not Implement

- No production tenant isolation. Filtering is representative metadata-only.
- No real auth. Demo headers are explicitly not authorization; they're test-helper inputs only.
- No row-level security in any storage layer.
- No durable per-tenant filter storage.
- No filtering of `/readiness/*` endpoints (separate `Readiness Endpoint Scope Filtering v1` task).
- No audit-query scope enforcement beyond the existing partial decision (`Audit Query Scope Enforcement v1` is a separate task).
- No GraphQL or downstream-product filtering integrations.
- No client-side enforcement; redaction happens at the read-model assembly boundary.

## Validation Plan

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `git diff --check`.
- Safe-integration scan with `rg -n "Authorization|cookie|SESSION_SECRET|JWT_SECRET|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|VAULT_TOKEN|DATABASE_URL|fetch\(|axios|Octokit|openai|anthropic|git fetch|git push|git merge|kubectl|vault|temporal|child_process|spawn\(|exec\(|eval\(|new Function"` against the new source/test/doc files.
- Regression: tenant scope planning tests, tenant scope enforcement tests, dashboard read-model tests, dashboard tests, registry compatibility, drift detection, canary apply tests all continue to pass.

## Scope Notes

- The service lives in `packages/deployment-readiness` because it consumes the existing planning inventory; it depends on `packages/auth`'s enforcement service for `TenantScopeEnforcementDecisionSummary` shape only.
- `DashboardScopeFilteringService.filterReadModels` clones each read model before redacting to avoid mutating shared state.
- The dashboard panel order is preserved; hidden panels are simply omitted from the rendered HTML while their decision is reported in the filter summary.
