# Dashboard Read Model Plan

Status update: Dashboard API-backed Read Model v0 is now implemented in `docs/features/dashboard/v0.md`. This earlier plan remains as the historical migration sketch.

## Current Dashboard Data Flow

The dashboard currently uses deterministic demo data:

- `apps/web/lib/mock-data.ts` creates a seeded in-memory store.
- It runs the mock workflow to populate task, run, PR, lease, queue, usage, registry, and improvement data.
- `apps/web/lib/improvement-demo.ts` creates Phase 4 demo data.
- `apps/web/src/render.ts` renders the data without requiring a running API server.

This is useful for local scaffolding and tests, but it should not become the production dashboard data path.

## What Is Mock or Demo Data

- Seeded tasks and task runs.
- Seeded registry entries.
- Demo registry package manifests and diffs.
- Demo failure signals, clusters, proposals, governance decisions, eval runs, readiness, and apply gates.
- Local in-memory merge queue and simulation state.

## What Should Become API-Backed Read Models

Recommended read models:

- Task overview and latest TaskRun.
- Usage/cost summary by task and run.
- Conflict manager overview by repo.
- Merge queue status by repo.
- Registry overview and approval queue.
- Registry package overview.
- Improvement proposal review queue.
- Governance audit timeline.

## Recommended Read Model Endpoints

- `GET /dashboard/overview`
- `GET /dashboard/tasks`
- `GET /dashboard/tasks/:id`
- `GET /dashboard/repos/:repoId/conflicts`
- `GET /dashboard/registry`
- `GET /dashboard/registry/packages`
- `GET /dashboard/improvement`
- `GET /dashboard/governance`

These endpoints should aggregate existing service data without running workflows or mutating state.

## Gradual Migration

1. Keep deterministic demo data for tests and offline preview.
2. Add an API client boundary in `apps/web`.
3. Add read-only dashboard endpoints in `apps/api`.
4. Replace direct workflow/store calls with API read models.
5. Keep fixture mode available for screenshots and contract tests.

## What Should Remain Demo-Only

- Artificial fixture tasks.
- Synthetic failure signals.
- Generated demo package diffs.
- Mock governance decisions created solely for display.

## Risks of Dashboard Running Workflow Logic Directly

- It can accidentally mutate data while rendering.
- It duplicates API/service behavior.
- It hides latency and failure modes from the real dashboard.
- It makes future auth and tenant scoping harder.
- It can diverge from production API response shapes.

The dashboard should become a read-model consumer before real provider integrations.
