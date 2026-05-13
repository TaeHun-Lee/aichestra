# Tenant And Scope Model Plan v1

Production Auth/RBAC v1 planning defines scope requirements only. It does not implement multi-tenancy, tenant-filtered repositories, session handling, or production dashboard filtering.

## Current Limitations

- Auth/RBAC v0 has principals, actors, teams, roles, permissions, role bindings, resource scopes, and request context helpers.
- Many service boundaries still use service-specific actor strings or system/mock actors.
- Policy subjects carry actor, principal, role, team, service account, and auth mode metadata, but tenant/workspace/project enforcement is not consistent.
- Dashboard, audit, task, registry, provider, and credential read models are not production tenant-filtered.

## Hierarchy Options

| Boundary | Use | Requirements | Status |
|---|---|---|---|
| organization | top-level customer or deployment tenant | all data and provider access must be isolated | not_ready |
| workspace | operating unit containing repos, tasks, models, and packages | budgets, dashboard, audit, and provider allowlists filter by workspace | future |
| project | task, registry, and Local Agent consent grouping | project membership drives task and registry visibility | future |
| team | group/SCIM-backed approval and ownership boundary | group sync maps IdP groups to teams or role bindings | planned |
| repo_scope | Git and webhook access boundary | repo grants, webhook delivery records, branch/PR sync, and Git credentials are repo-scoped | planned |

## Scope Requirements

- Repositories must accept tenant/workspace/project/repo filters before production traffic.
- Policy resources must include tenant and repo scope where applicable.
- SecretRef scopes must bind to tenant/workspace/project/repo/provider purpose.
- LLM providers, model routes, virtual model keys, and budgets need tenant-aware controls.
- MCP server/tool allowlists need tenant and risk scope.
- Local Agent registration, consent, host trust, and invocation must bind to user, host, and tenant.
- Audit queries and dashboard read models must enforce the same scope filters.

## Migration Phases

1. Inventory request and service boundaries that lack tenant/workspace/project/repo fields.
2. Extend `RequestContext` and `AuthContext` with stable scope metadata.
3. Add scope fields to `PolicySubject`, `PolicyResource`, audit envelope dimensions, and DTO filters.
4. Add repository filters and indexes for scoped read/write paths.
5. Disable production profile until missing scope filters fail closed.

## Production Blockers

- No durable tenant model.
- No tenant-filtered auth, task, registry, audit, or dashboard repositories.
- No tenant-scoped service account issuance.
- No tenant-aware SecretRef enforcement beyond metadata planning.
