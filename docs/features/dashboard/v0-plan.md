# Dashboard API-backed Read Model Migration v0 Plan

Path choice: `docs/README.md` already defines Dashboard as `docs/features/dashboard/`, so this plan lives at `docs/features/dashboard/v0-plan.md` instead of creating a second `dashboard-api-read-model` feature folder.

## Current Dashboard Data Flow

The dashboard currently has two demo-only paths:

- `apps/web/lib/mock-data.ts` creates a seeded in-memory store, runs mock workflows, creates mock Git/LLM/runner/security/local-agent examples, and returns a large dashboard object.
- `apps/web/src/render.ts` duplicates much of that setup and renders HTML directly from locally created services.

This keeps static rendering deterministic, but it means dashboard rendering can create tasks, run workflows, record policy/security/provider audit events, and diverge from API response shapes.

## Seeded or Demo-only Sections

- Task and task-run summaries are created from seeded store data plus mock workflow execution.
- Conflict manager state comes from local branch leases, computed risk, merge queue, and mock simulations created during render.
- Registry and package data starts from seed data, with demo approval/eval/package changes applied during render.
- Git, LLM, Agent Runner, Policy, Provider, Security, and Local Agent sections are currently populated by locally instantiated services.
- Phase 4 improvement/governance panels use `apps/web/lib/improvement-demo.ts` synthetic data.

## Existing API Endpoints

The API already exposes read endpoints for:

- tasks, task runs, usage, and audit logs;
- branch leases, conflict risks, merge queue, and merge simulations;
- registry skills, harnesses, instructions, packages, approval queue, eval results, revisions, and registry audit;
- Git provider config, repos, stored PRs, Git audit, and gated remote Git operations;
- LLM config, providers, models, virtual keys, usage, and audit;
- agent runner config, runs, command results, workspaces, and audit;
- policy config, rules, evaluation, and audit;
- enterprise providers, local CLI templates, credential references, and provider audit;
- security secret/sandbox/network/redaction metadata and audit;
- Local Agent Protocol registration, channels, compatibility, consent, streams, events, and audit.

## Missing Read-model Endpoints

The API lacks dashboard-composed read-model endpoints that aggregate existing read-only service data without requiring the web app to know every feature route.

v0 adds:

- `GET /dashboard/overview`
- `GET /dashboard/tasks`
- `GET /dashboard/git`
- `GET /dashboard/conflicts`
- `GET /dashboard/registry`
- `GET /dashboard/llm`
- `GET /dashboard/agents`
- `GET /dashboard/policy`
- `GET /dashboard/providers`
- `GET /dashboard/security`
- `GET /dashboard/local-agents`
- `GET /dashboard/audit`

## Migration Strategy

1. Define shared dashboard read-model DTO types.
2. Add an API read-model assembler that reads current service/repository state only.
3. Add `/dashboard/*` routes that return sanitized read models and never trigger workflow/provider execution.
4. Add a web `DashboardDataProvider` abstraction:
   - `ApiDashboardDataProvider` fetches dashboard read models from the API.
   - `DemoDashboardDataProvider` keeps the existing deterministic fixture path for static tests/offline rendering.
5. Refactor web rendering and Next-style pages to consume dashboard read models rather than constructing services directly.

## Fallback Strategy

The runtime can use API-backed data by setting `AICHESTRA_DASHBOARD_DATA_SOURCE=api` or `AICHESTRA_DASHBOARD_API_BASE_URL`.

Static tests and offline local rendering use the explicit demo provider by default. If API mode is configured and the API read fails, the provider can fall back to demo data unless `AICHESTRA_DASHBOARD_DISABLE_DEMO_FALLBACK=true`.

## Safety Rules

- Dashboard endpoints are read-only.
- Dashboard endpoints must not call GitHub, LLM providers, vendor CLIs, MCP, secret stores, Kubernetes, Temporal, Vault, or artifact registries.
- Dashboard endpoints must not run workflows, create tasks, run agent runners, execute commands, request secret leases, evaluate network egress, or create Local Agent fixture invocations.
- Returned read models must not expose tokens, raw provider credentials, raw secret values, credential cache contents, or unredacted logs.
- Real Git Adapter v1 gates remain unchanged.

## Risks

- Aggregated read models can drift from underlying feature DTOs if they copy too much detail.
- Demo fallback can hide API-state issues if used accidentally in integration environments.
- Some dashboard sections may be empty until workflows or API actions create state; this is expected for read-only v0.

## Out of Scope

- Production auth/RBAC and tenant filtering.
- Live workflow execution from dashboard views.
- LLM Gateway v1 or real provider calls.
- Production GitHub webhooks, merge, rebase, force push, or branch deletion.
- Replacing in-memory stores with production persistence beyond existing Persistent DB v1.
- Full UI redesign or a production analytics dashboard.
