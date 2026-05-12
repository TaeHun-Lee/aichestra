# Dashboard Read Model Inventory

| Section | Current Source | Target Source | Required Endpoint | DTO / Shape | Fallback Behavior | Migration Status |
|---|---|---|---|---|---|---|
| Overview | seeded store plus render-time service setup | API read model | `GET /dashboard/overview` | `DashboardOverviewReadModel` with metrics, section statuses, and safety flags | `DemoDashboardDataProvider` builds the same shape from deterministic fixtures | implemented in v0 |
| Tasks | `apps/web/lib/mock-data.ts` runs mock workflows | API read model from task/task-run/usage repositories | `GET /dashboard/tasks` | `TaskRunSummaryReadModel` with tasks, latest runs, PR and usage summaries | demo fixture tasks and mock runs remain available | implemented in v0 |
| Conflict Manager | local seeded leases, computed risks, merge queue, simulations | API read model from existing conflict/merge repositories | `GET /dashboard/conflicts` | `ConflictManagerReadModel` with leases, risks, queue, simulations | demo workflow creates deterministic leases/risks | implemented in v0 |
| Registry | seeded registry plus render-time approval/eval/package mutations | API read model from registry service | `GET /dashboard/registry` | `RegistryReadModel` with counts, entries, approval queue, packages, audit, revisions, eval results | demo applies fixture approval/eval/package examples | implemented in v0 |
| Git Integration | render-time `GitIntegrationService` and mock remote-block examples | API read model from Git service/store/audit only | `GET /dashboard/git` | `GitIntegrationReadModel` with config, providers, repos, stored branches/PRs, gate status, audit, blocked examples | demo creates mock branch/PR and blocked remote examples | implemented in v0 |
| LLM Gateway | render-time mock completion and blocked skeleton provider example | API read model from LLM gateway config/catalog/usage/audit | `GET /dashboard/llm` | `LLMGatewayReadModel` with config, providers, models, virtual keys, usage, audit, blocked examples | demo performs deterministic mock completion | implemented in v0 |
| Agent Runner | render-time mock agent run and blocked command example | API read model from runner repositories/config | `GET /dashboard/agents` | `AgentRunnerReadModel` with config, runners, runs, commands, workspaces, audit, blocked examples | demo runs deterministic mock runner | implemented in v0 |
| Policy | render-time policy evaluations | API read model from policy config/rules/audit only | `GET /dashboard/policy` | `PolicyReadModel` with config, rules, audit, static blocked examples | demo includes evaluated decisions for visual examples | implemented in v0 |
| Enterprise Providers | render-time validation/invocation examples | API read model from provider catalog/audit/local-agent descriptors | `GET /dashboard/providers` | `EnterpriseProviderReadModel` with catalog, auth types, local CLI templates, local agents, audit, safety notes | demo invokes blocked local CLI flow | implemented in v0 |
| Security | render-time denied lease, sandbox session, network decision, redaction test | API read model from security metadata/audit only | `GET /dashboard/security` | `SecurityReadModel` with configs, refs, scopes, leases, profiles, sessions, policies, audit, blocked examples | demo creates denied/redacted fixture examples | implemented in v0 |
| Local Agent Protocol | render-time fixture agent, channel, consent, stream, and blocked examples | API read model from Local Agent Protocol repositories/config | `GET /dashboard/local-agents` | `LocalAgentReadModel` with agents, sessions, channels, handshakes, capabilities, compatibility, consent, invocations, streams, audit | demo fixture agent remains available | implemented in v0 |
| Audit Summary | mixed local service audit lists | API read model from existing audit repositories | `GET /dashboard/audit` | `AuditSummaryReadModel` with sanitized recent audit groups | demo returns synthetic audit groups | implemented in v0 |
| Next task detail page | `getDashboardData()` fixture lookup | dashboard read model provider | same provider as dashboard | task summary plus latest run/queue detail | demo provider by default in tests | implemented in v0 |
| Static HTML render | direct service construction in `apps/web/src/render.ts` | `DashboardDataProvider` | provider-selected; API when configured | `DashboardReadModels` | explicit demo fallback | implemented in v0 |

## Notes

- API-backed dashboard endpoints must not execute provider adapters, GitHub calls, LLM calls, runner commands, Local Agent fixture invocations, or workflow runs.
- Demo fallback is intentionally allowed for offline/static tests, but it must remain explicit and documented.
- All read models are sanitized before API/web exposure.
