# Aichestra

Aichestra is an AgentOps control plane for coordinating LLM usage, AI coding agents, Git branches, PRs, skills, harnesses, instruction artifacts, usage ledgers, and audit logs.

This repository is an **MVP scaffold** and is intentionally **mock-first**: default runtime code does not call real LLM providers, Git hosting APIs, MCP gateways, secret stores, or production databases. Real Git Adapter v2 and LLM Gateway v2 are controlled exceptions that remain disabled unless every explicit integration gate is configured.

## Documentation

| Topic | Where |
| --- | --- |
| Per-feature status & mock-first boundaries | [docs/reference/feature-status.md](docs/reference/feature-status.md) |
| Mock / skeleton maturity inventory | [docs/reference/mock-skeleton-inventory.md](docs/reference/mock-skeleton-inventory.md) |
| Env gates & integration configuration | [docs/reference/configuration.md](docs/reference/configuration.md) |
| MVP scope (Included / Deferred) | [docs/reference/mvp-scope.md](docs/reference/mvp-scope.md) |
| Full documentation layout | [docs/README.md](docs/README.md) |
| Canonical bootstrap / work orders | [docs/briefs/AICHESTRA_BOOTSTRAP.md](docs/briefs/AICHESTRA_BOOTSTRAP.md) |
| Real-integration roadmap | [docs/roadmaps/real-integration-roadmap.md](docs/roadmaps/real-integration-roadmap.md) |

## Architecture

A pnpm monorepo (`apps/*` runtimes, `packages/*` domain libraries):

- `packages/core`: domain models, status transitions, validation schemas, seed data, instruction resolution, Conflict Manager scoring, merge simulation interfaces, Merge Queue Policy v2, Conflict Resolution Assistant v1, PR Ownership / Handoff v1, and Real Merge Execution Policy v1 services.
- `packages/git-adapter`: Git provider behavior, mock branch/PR creation, conflict risk, local-only dry-run merge simulation, gated GitHub operations, disabled-by-default webhook receive, PR/branch sync read models, GitHub App Controlled Implementation v1, and Branch Orchestrator v2 metadata-only allocation.
- `packages/improvement`: Phase 4 Preparation, Auto-improvement v0, and Governance v1 models, repositories, deterministic clustering, candidates, draft proposals/registry changes, review queues, governance decisions, eval/canary metadata, apply gates, and safety policies.
- `packages/llm-gateway`: provider-neutral LLM interfaces, mock provider, gated OpenAI-compatible HTTP path, LLM Gateway v2 route/fallback/routing read models, model catalog, virtual model keys, budget checks, usage ledger integration, audit events, Enterprise LLM Provider Abstraction v0, and Local Agent Protocol v1 models.
- `packages/mcp-gateway`: MCP Gateway v0 server/tool catalog models, deterministic `MockMCPGateway`, disabled real transport skeleton, invocation/audit repositories, and Auth/RBAC, Policy, redaction, and Secrets/Sandbox integration.
- `packages/deployment-readiness`: read-only deployment/readiness profiles, checks, and risk models for production deployment, GitHub App/webhook hardening, persistent DB ops, secret backend decisions, auth/RBAC, policy bundles/shadow evaluation, staging profiles, integration-test profiles (GitHub App, LLM, Vault), and tenant-scope planning.
- `packages/policy`: provider-neutral Policy-as-code v0 models, static/mock policy engine, restrictive default rules, Golden Test Harness v1, Shadow Evaluator Skeleton v1, merge-queue / real-merge / PR-ownership / registry-scope / artifact-trust / eval-suite gates, RequestContext-enriched subjects, `PolicyResourceScope` helpers, and decision audit. No live shadow evaluator or candidate runtime is implemented.
- `packages/auth`: Production Auth/RBAC Planning v0 identity/RBAC models, deterministic `MockAuthProvider`, Auth Provider Skeleton v1 disabled future providers + registry, `AuthorizationService`, RequestContext Propagation v1, Service Account Actor Boundary v1, Tenant/Repo/Provider Scope Model v1, Tenant Scope Enforcement v1, and sanitized auth audit events.
- `packages/registry`: Skill/Harness/Instruction registry interfaces, repository boundaries, DTO mappers, audit/history/rollback, approval queues, eval attachment, checksum verification, mock RBAC, package manifests, import/export, semver range resolution v0, diffs, deterministic resolver, Compatibility Matrix v1, Tenant Scope Enforcement v1, Signed Package / Artifact Trust v1, and Eval Suite Execution Harness v1.
- `packages/runner`: provider-neutral runner contracts, deterministic `MockAgentRunner`, disabled-by-default `LocalAgentRunner`, harness policy, instruction assembly, in-memory repositories, Agent Workspace Lifecycle v2, Worktree Allocation v1, Multi-session Coordination v1, and Cross-session File Lease / Edit Intent Graph v1.
- `packages/security`: Secrets and Sandbox Design v0 metadata-only secret refs/scopes/leases, SecretRef-backed Provider Credentials v1, Vault-backed Secret Backend v1 gated boundary, credential manager/handles/audit, mock secret manager, sandbox profiles/sessions, network egress policy, and redaction policy.
- `packages/observability`: Audit Retention v0 common envelope, retention/redaction classes, audit sanitizer, source normalization, retention policies, metric snapshots, trace skeletons, Audit Query Scope Enforcement v1, and External Observability Export v1 disabled/mock/future exporter skeletons.
- `packages/adapters`: compatibility aggregate for shared adapter contracts and mocks.
- `packages/db`: Postgres-oriented schema, storage provider abstraction, repository factory, in-memory repositories (default), opt-in Postgres repositories, and Durable Collaboration Stores v1 boundaries.
- `apps/api`: REST API skeleton on Node's HTTP server, including API AuthContext Middleware Skeleton v1.
- `apps/worker`: task workflow skeleton with mock branch, runner, usage, audit, and PR behavior.
- `apps/web`: dashboard skeleton with Next-style folders, API-backed read-model provider, explicit demo fallback, a dependency-free dev server, and an optional React/Vite dashboard prototype.

## Install

Use Node 24.x (pinned via Volta and `.nvmrc`).

```bash
pnpm install
```

## Run

```bash
pnpm --filter @aichestra/api dev
pnpm --filter @aichestra/worker dev
pnpm --filter @aichestra/web dev
```

Docker runs the API (`:3000`) and web dashboard (`:3001`) together:

```bash
docker compose up --build
docker compose down
```

API health:

```bash
curl http://localhost:3000/health
```

Default storage is in-memory. Persistent Postgres is opt-in and follows the same gates as every other real integration:

```bash
AICHESTRA_STORAGE_PROVIDER=postgres AICHESTRA_DATABASE_URL=postgres://... pnpm --filter @aichestra/api dev
AICHESTRA_DATABASE_URL=postgres://... pnpm db:migrate
```

Production profile startup now fails closed unless Phase 1-3 foundation gates are present: static bearer auth by token hash, Vault-backed secret backend configuration, and Postgres storage. Inspect the result with:

```bash
curl http://localhost:3000/readiness/production-foundation
pnpm prod:smoke
```

Real Git, LLM, MCP, Vault, GitHub App, and observability-export paths are all disabled by default. See [docs/reference/configuration.md](docs/reference/configuration.md) for the full set of env gates and readiness/dashboard endpoints.

## Test

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Validation covers lint, TypeScript checking, the test suite, and a scaffold build smoke check. Optional Postgres repository contract tests run only when `AICHESTRA_TEST_DATABASE_URL` is set; optional live integration tests (GitHub App, LLM, Vault) stay skipped unless every explicit gate is configured. Per-feature test coverage is summarized in [docs/reference/feature-status.md](docs/reference/feature-status.md).

CI runs `lint`, `typecheck`, and `test` on every push to `main` and on pull requests via [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## First Vertical Slice

The first working slice uses mock adapters only:

```text
User creates a task
-> API triggers worker run
-> policy is checked
-> registry resolver selects mock model context, skill refs, harness ref, and instruction refs
-> mock branch is prepared
-> mock agent generates changed files and diff summary
-> mock tests pass
-> mock dry-run merge simulation records clean/conflict evidence
-> mock PR is created
-> merge queue entry is created; Merge Queue Policy v2 records readiness/holds/ranking (no merge execution)
-> Conflict Resolution Assistant v1 and PR Ownership / Handoff v1 record review-only metadata
-> usage ledger records mock tokens/cost
-> task reaches completed
-> web dashboard consumes read models and shows status, mock PR, diff summary, dry-run status, and mock cost
```

Coordination layers (Branch Orchestrator v2, Multi-session Coordination v1, File Lease / Edit Intent Graph v1) record metadata alongside this slice before any future real Git execution.

## Security Notes

- Do not commit secrets.
- Real providers are disabled by default.
- External integrations must stay behind adapter interfaces.
- Git writes, MCP calls, and LLM calls must be auditable.
- Instructions guide agent behavior but do not enforce security; policy, sandbox, MCP, and Git adapters must enforce it.

## Next Steps

See the [real-integration roadmap](docs/roadmaps/real-integration-roadmap.md) for sequencing. In short: collect human signoffs (Staging Human Signoff Pack v0) and run the staging go/no-go audit before any staging execution; harden production auth/RBAC, audit retention/export, Local Agent persistence, and LLM Gateway repositories behind separate approved tasks; and keep every metadata-only review/ownership/cleanup layer (`applyAllowed=false`, no remote PR update, no auto-merge) gated until its dedicated live integration-test profile lands.
