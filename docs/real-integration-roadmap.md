# Real Integration Roadmap

## Recommended Order

1. Persistent DB implementation v1 - implemented
2. Real Git Adapter v0 - implemented
3. LLM Gateway v0 - implemented
4. Local Agent Runner v0
5. Secrets and sandbox design
6. Policy-as-code skeleton
7. MCP Gateway planning
8. Phase 5 enterprise planning

## 1. Persistent DB Implementation v1

Implemented with `docs/persistent-db-v1.md`, `packages/db/src/postgres.ts`, `scripts/db/migrate.mjs`, `infra/migrations/0001_initial_aichestra_schema.sql`, and optional Postgres repository contract tests.

Goals:

- Postgres-backed repositories exist behind existing interfaces for the core durable slice.
- Deterministic in-memory repositories remain the default for tests and mock-first runtime.
- Services stay dependent on repository contracts.
- Migration execution is explicit through `pnpm db:migrate`.
- Phase 4 governance repositories remain in-memory follow-up work.

## 2. Real Git Adapter v0

Implemented with `docs/real-git-adapter-v0.md`, `packages/adapters/src/git/provider-factory.ts`, `packages/adapters/src/git/local-git-provider.ts`, `packages/adapters/src/git/github-git-provider.ts`, `packages/git-adapter/src/service.ts`, API routes, dashboard visibility, and tests.

Goals:

- Add a provider-neutral `GitProvider` boundary.
- Preserve deterministic `MockGitProvider` behavior.
- Add local-only fixture-safe Git inspection.
- Add a gated GitHub provider skeleton without network calls.
- Store repo/PR records and Git audit events through service/repository boundaries.
- Preserve mock/local-only default behavior.
- No automatic merge or rebase.

Recommended next step: LLM Gateway v0, or Real Git Adapter v1 if controlled GitHub branch/PR creation is the next priority.

## 3. LLM Gateway v0

Implemented with `docs/llm-gateway-v0.md`, provider-neutral interfaces, `MockLLMProvider`, an OpenAI-compatible skeleton, model catalog, virtual model keys, budget checks, usage ledger integration, audit events, API routes, dashboard visibility, and tests.

Goals:

- Keep real provider calls disabled by default.
- Preserve mock-first model completion behavior.
- Route mock completions through a central gateway.
- Record usage ledger entries for successful gateway calls.
- Keep virtual keys as internal policy objects, not provider API secrets.

Recommended next step: Local Agent Runner v0, or Real Git Adapter v1 if controlled GitHub branch/PR creation is the next priority.

## 4. Local Agent Runner v0

Goals:

- Execute local commands in a constrained harness.
- Record runner metadata and test output.
- Keep sandbox/secrets boundaries explicit.

## 5. Secrets and Sandbox Design

Goals:

- Define secret scope model.
- Define harness network policy enforcement.
- Define audit requirements for secret reads and tool calls.

## 6. Policy-as-Code Skeleton

Goals:

- Move hard-coded mock policy rules behind a policy engine interface.
- Add deterministic policy tests.
- Keep production policy execution out of scope until auth and persistence are ready.

## 7. MCP Gateway Planning

Goals:

- Define MCP gateway boundary.
- Keep MCP calls disabled by default.
- Define audit, auth, and permission model.

## 8. Phase 5 Enterprise Planning

Goals:

- SSO and SCIM.
- Audit export.
- Data residency.
- Signed artifacts.
- Real artifact registry.
- Production RBAC.
- Deployment and operational controls.
