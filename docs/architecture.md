# Architecture

Aichestra is organized as a TypeScript monorepo with clear boundaries between domain code, adapter interfaces, API routes, workflow execution, runner behavior, and dashboard rendering.

```text
User/Admin
  -> Web Dashboard
  -> API
      -> Task Orchestrator
      -> Conflict Manager
      -> Registries
      -> Usage Ledger
      -> Audit Log
  -> Worker
      -> Policy Engine
      -> Git Provider
      -> Runner
      -> LLM Gateway
      -> Instruction Resolver
```

MVP runtime integrations are mock implementations. Real providers must be introduced behind the interfaces in `packages/adapters` and enabled only through explicit environment configuration.

## Packages

- `packages/core` owns domain types, state transitions, schemas, seed registry records, and instruction assembly.
- `packages/core` also owns deterministic Conflict Manager v0 scoring.
- `packages/adapters` owns integration contracts and mock adapters.
- `packages/db` owns persistence contracts, Prisma schema, seed data, and the MVP in-memory store.
- `packages/testing` exposes test helpers without coupling tests to implementation paths.

## Apps

- `apps/api` exposes REST routes for health, tasks, repos, branch leases, conflict risks, merge queue, registries, usage, and audit logs.
- `apps/worker` runs `RunAgentTaskWorkflow` using the self-contained MVP state machine.
- `apps/runner` contains the agent runner interface and mock runner.
- `apps/web` provides a dashboard skeleton.
