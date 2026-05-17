# Dashboard/Readiness Tenant Scope Implementation v1 Plan

Status: completed_for_v1_implementation

This plan follows the current docs organization in `docs/README.md`: roadmap material lives under `docs/roadmaps/`, and dashboard/readiness inventories and matrices live under `docs/reference/`. The canonical planning documents for this work are under `docs/roadmaps/dashboard-readiness-tenant-scope/`.

## Current planning v1 behavior

Dashboard/Readiness Tenant Scope Planning v1 is implemented as a read-only, deterministic planning surface. It inventories dashboard panels, readiness endpoint groups, role visibility, fallback behavior, and future filtering architecture through `DashboardReadinessTenantScopePlanningService` and `/readiness/tenant-scope/*`.

Planning v1 does not enforce tenant filtering, provision tenants, add row-level security, implement production Auth/RBAC, call external services, or expose secrets/env values. Its summary explicitly keeps `tenantFilteringImplemented`, `productionTenantEnforcement`, and `productionReady` false.

## Current scope model behavior

Tenant/Repo/Provider Scope Model v1 provides common scope dimensions and safe metadata for tenant, team, project, repo, provider, model, SecretRef, MCP server/tool, registry package, Local Agent host, and audit query scopes. It uses deterministic mock/readiness catalogs and optional scope metadata on AuthContext, RequestContext, PolicySubject, policy resources, audit envelopes, readiness, and dashboard read models.

The model is metadata-only. It does not grant access, enforce isolation, apply row-level filters, provision production tenants, or enable production auth.

## Current dashboard/readiness read model structure

`packages/shared/src/dashboard-read-models.ts` owns shared dashboard read-model DTOs and dashboard sanitizers. `apps/api/src/dashboard-read-model.ts` composes API-backed read models from in-memory services and deterministic readiness services. `apps/api/src/main.ts` exposes `/dashboard/*`, `/readiness/*`, and `/health` JSON routes. `apps/web/src/render.ts` renders the dashboard read model into static HTML.

Current read models already include safety flags, no-secret/no-env booleans, and the planning v1 tenant-scope panel, but most section DTOs do not yet expose uniform scope metadata, role visibility hints, missing-scope warnings, or redaction labels.

## Proposed read model additions

Add safe shared DTOs:

- `ScopedReadModelMetadata`
- `DashboardPanelScopeSummary`
- `ReadinessEndpointScopeSummary`

Attach optional `scopeMetadata` to dashboard section read models and add panel/endpoint scope summaries to the tenant-scope planning read model. The metadata will include required scopes, currently available mock/readiness scopes, missing scopes, sensitivity, role visibility, redaction status, warnings, and explicit false values for tenant filtering and production enforcement.

Readiness endpoints will include scope metadata through the existing tenant-scope planning surface and representative readiness endpoints. The metadata is read-only and derived from the planning inventory.

## Proposed UI behavior

Add a dashboard section titled `Scope / Visibility / Redaction` that shows:

- scope status badges
- inventory counts
- required and missing scope dimensions
- role visibility hints
- redaction/sensitivity labels
- `tenant filtering implemented: false`
- `production tenant enforcement: false`
- no-secret/no-env status

The UI must not hide panels, imply production isolation, or claim enforcement is active.

## No-secret/no-env constraints

Implementation v1 must not return:

- raw secret values
- env values
- provider API keys
- GitHub tokens, webhook secrets, or private keys
- Vault tokens, addresses, raw paths, keys, or secret values
- database URLs
- session, cookie, JWT, SAML, OIDC, SCIM, or IdP credential data
- raw prompts, raw provider responses, or credential-cache paths

All new metadata must remain deterministic and safe for local API/dashboard use.

## What this task implements

- Shared scope-aware read-model DTOs.
- Deterministic scope metadata builders derived from the planning inventory.
- Dashboard read-model scope metadata for major sections.
- Readiness scope summaries through read-only readiness responses.
- Dashboard UI rendering for scope, visibility, redaction, missing-scope, and no-secret/no-env status.
- Documentation updates recording Implementation v1 as metadata/readiness only.
- Deterministic tests for models, API/readiness metadata, UI rendering, and no-secret/no-env safety.

## Out of scope

- Production tenant enforcement.
- Production Auth/RBAC.
- Real tenant provisioning.
- Row-level security.
- Real OIDC, SAML, SCIM, SSO, login/logout, sessions, JWTs, API keys, service-account credentials, or IdP calls.
- Tenant-filtered queries, audit enforcement, durable scope repositories, cache isolation, or policy enforcement changes.
- External GitHub, LLM, MCP, Vault, cloud, Kubernetes, Temporal, OPA, Cedar, artifact registry, or vendor CLI calls.
- Reading credential caches or exposing secrets/env values.
