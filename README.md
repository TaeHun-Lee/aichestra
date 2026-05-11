# Aichestra

Aichestra is an AgentOps control plane for coordinating LLM usage, AI coding agents, Git branches, PRs, skills, harnesses, instruction artifacts, usage ledgers, and audit logs.

This repository is an MVP scaffold. It is intentionally mock-first: no runtime code calls real LLM providers, Git hosting APIs, MCP gateways, secret stores, or production databases.

Design and work-order source documents live under `design_docs/`; the canonical bootstrap document is `design_docs/AICHESTRA_BOOTSTRAP.md`.

## Architecture

- `packages/core`: domain models, status transitions, validation schemas, seed data, instruction resolution, Conflict Manager scoring, and merge simulation interfaces.
- `packages/git-adapter`: Git provider behavior, mock branch/PR creation, conflict risk, and local-only dry-run merge simulation.
- `packages/improvement`: Phase 4 Preparation, Auto-improvement v0, and Governance v1 models, repository interfaces, in-memory repositories, DTOs, deterministic clustering, candidates, draft proposals, draft registry changes, readiness checks, proposal review queues, governance decisions, proposal eval run metadata, canary readiness, apply gates, governance audit events, eval requirements, canary rollout plan metadata, and auto-improvement safety policies.
- `packages/llm-gateway`: provider-neutral LLM interfaces, mock model provider behavior, OpenAI-compatible skeleton, model catalog, virtual model key policy objects, budget checks, usage ledger integration, and LLM audit events.
- `packages/policy`: policy decisions for budget and high-risk work.
- `packages/registry`: Skill, Harness, and Instruction registry interfaces, repository boundaries, DTO mappers, audit logs, history, rollback, approval queue read models, local eval result attachment, checksum verification, mock RBAC, local package manifests, import/export, semver range resolution v0, package diffs, validation helpers, and deterministic resolver.
- `packages/runner`: agent runner and mock test runner contracts.
- `packages/adapters`: compatibility aggregate for shared adapter contracts and mocks.
- `packages/db`: Postgres-oriented schema, storage provider abstraction, repository factory, in-memory repositories for mock-first runtime/tests, and opt-in Postgres repositories for the core durable slice.
- `apps/api`: REST API skeleton using Node's local HTTP server.
- `apps/worker`: task workflow skeleton with mock branch, runner, usage, audit, and PR behavior.
- `apps/web`: dashboard skeleton with Next-style folders and a dependency-free local dev server.

## Install

```bash
pnpm install
```

The scaffold avoids third-party runtime dependencies so installation can complete without contacting provider APIs.

## Run

```bash
pnpm --filter @aichestra/api dev
pnpm --filter @aichestra/worker dev
pnpm --filter @aichestra/web dev
```

API health:

```bash
curl http://localhost:3000/health
```

Default storage is in-memory. Persistent DB v1 is opt-in:

```bash
AICHESTRA_STORAGE_PROVIDER=postgres AICHESTRA_DATABASE_URL=postgres://... pnpm --filter @aichestra/api dev
```

Run the schema migration only when explicitly configuring a local/test Postgres database:

```bash
AICHESTRA_DATABASE_URL=postgres://... pnpm db:migrate
```

Git integration remains mock-first by default. Real Git Adapter v0 supports mock provider behavior, local-only fixture inspection, and a gated GitHub provider skeleton with remote calls disabled by default:

```bash
AICHESTRA_GIT_PROVIDER=mock pnpm --filter @aichestra/api dev
```

Remote Git flags exist for future gated integration work, but v0 does not implement remote branch/PR creation and does not support merge/rebase:

```bash
AICHESTRA_GIT_PROVIDER=github
AICHESTRA_ENABLE_REMOTE_GIT=false
AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE=false
AICHESTRA_ALLOW_REMOTE_PR_CREATE=false
```

LLM Gateway v0 remains mock-first. Remote LLM calls are blocked by default:

```bash
AICHESTRA_LLM_PROVIDER=mock pnpm --filter @aichestra/api dev
```

OpenAI-compatible settings are placeholders for future gated work and do not enable real provider calls in v0:

```bash
AICHESTRA_LLM_PROVIDER=openai_compatible
AICHESTRA_ENABLE_REMOTE_LLM=false
AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=false
```

Create a task:

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix login timeout bug",
    "description": "Investigate and fix intermittent login timeout failures.",
    "repoId": "repo_demo_backend",
    "requestedBy": "user_demo_admin",
    "preferredAgent": "mock-codex",
    "targetBranch": "main",
    "selectedModel": "mock-model",
    "selectedSkillIds": ["skill_auth_debugging"],
    "selectedHarnessId": "harness_backend_node20",
    "budgetLimitUsd": 20
  }'
```

Run the mock vertical slice for a task:

```bash
curl -X POST http://localhost:3000/tasks/<task_id>/run
```

Repeated run behavior:

- If the task already has an active TaskRun in `queued` or `running`, the API returns `409 Conflict`.
- After the latest run reaches `completed` or `failed`, another `POST /tasks/<task_id>/run` creates a new TaskRun attempt.

Inspect task-specific runs and usage:

```bash
curl http://localhost:3000/tasks/<task_id>/runs
curl "http://localhost:3000/usage?taskId=<task_id>"
```

Inspect Conflict Manager v1 state:

```bash
curl "http://localhost:3000/branches/leases?repoId=repo_demo_backend&status=active"
curl "http://localhost:3000/conflicts/risks?repoId=repo_demo_backend"
curl "http://localhost:3000/merge-queue?repoId=repo_demo_backend"
curl "http://localhost:3000/merge-simulations?repoId=repo_demo_backend"
curl -X POST http://localhost:3000/merge-simulations \
  -H "Content-Type: application/json" \
  -d '{
    "branchLeaseId": "<branch_lease_id>",
    "mode": "mock",
    "status": "clean"
  }'
curl -X POST http://localhost:3000/merge-queue/<entry_id>/mark-merged
```

Inspect Registry v3 state:

```bash
curl http://localhost:3000/registry/skills
curl http://localhost:3000/registry/harnesses
curl http://localhost:3000/registry/instructions
curl -X POST http://localhost:3000/registry/resolve \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "<task_id>" }'
curl -X PATCH http://localhost:3000/registry/skills/<skill_id>/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "deprecated" }'
curl -X PATCH http://localhost:3000/registry/skills/<skill_id>/approval \
  -H "Content-Type: application/json" \
  -d '{ "approvalStatus": "approved" }'
curl -X PATCH http://localhost:3000/registry/skills/<skill_id>/eval \
  -H "Content-Type: application/json" \
  -d '{ "evalStatus": "passed" }'
curl -X POST http://localhost:3000/registry/instructions/<instruction_id>/verify-checksum
curl "http://localhost:3000/registry/audit?targetKind=skill&targetId=<skill_id>"
curl "http://localhost:3000/registry/approval-queue"
curl "http://localhost:3000/registry/skills/<skill_id>/history"
curl -X POST http://localhost:3000/registry/skills/<skill_id>/rollback \
  -H "Content-Type: application/json" \
  -d '{ "revisionNumber": 1, "reason": "restore known-good registry revision" }'
curl -X POST http://localhost:3000/registry/skills/<skill_id>/eval-results \
  -H "Content-Type: application/json" \
  -d '{
    "evalName": "manual smoke",
    "evalType": "manual",
    "status": "passed",
    "summary": "Manual registry review passed.",
    "source": "manual",
    "updateEvalStatus": true
  }'
curl http://localhost:3000/registry/skills/<skill_id>/manifest
curl http://localhost:3000/registry/bundle/manifest
curl -X POST http://localhost:3000/registry/packages/export \
  -H "Content-Type: application/json" \
  -d '{ "packageKind": "skill", "targetId": "<skill_id>" }'
curl -X POST http://localhost:3000/registry/packages/import/dry-run \
  -H "Content-Type: application/json" \
  -d @local-package-import.json
curl -X POST http://localhost:3000/registry/packages/diff \
  -H "Content-Type: application/json" \
  -d @local-package-diff.json
```

`local-package-import.json` should wrap an exported manifest as `{ "manifest": <exported manifest JSON> }`.
`local-package-diff.json` should provide `{ "fromManifest": <manifest JSON>, "toManifest": <manifest JSON> }`.

Inspect Real Git Adapter v0 state:

```bash
curl http://localhost:3000/git/providers
curl http://localhost:3000/git/config
curl http://localhost:3000/git/repos
curl -X POST http://localhost:3000/git/repos \
  -H "Content-Type: application/json" \
  -d '{ "provider": "mock", "owner": "aichestra", "name": "demo-backend", "defaultBranch": "main" }'
curl -X POST http://localhost:3000/git/repos/<repo_id>/branches \
  -H "Content-Type: application/json" \
  -d '{ "branchName": "codex/fix-login-timeout", "baseBranch": "main" }'
curl -X POST http://localhost:3000/git/repos/<repo_id>/pull-requests \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "<task_id>", "branchName": "codex/fix-login-timeout", "title": "Fix login timeout bug" }'
curl http://localhost:3000/git/repos/<repo_id>/pull-requests
curl "http://localhost:3000/git/pull-requests/<pr_id>/changed-files?branchName=codex/fix-login-timeout"
curl http://localhost:3000/git/audit
```

Inspect LLM Gateway v0 state:

```bash
curl http://localhost:3000/llm/providers
curl http://localhost:3000/llm/config
curl http://localhost:3000/llm/models
curl http://localhost:3000/llm/virtual-keys
curl -X POST http://localhost:3000/llm/route \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "<task_id>", "taskRunId": "<task_run_id>", "modelRef": "mock-coder@1.0", "prompt": "Fix login bug", "budgetLimitUsd": 1 }'
curl -X POST http://localhost:3000/llm/completions \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "<task_id>", "taskRunId": "<task_run_id>", "modelRef": "mock-coder@1.0", "prompt": "Fix login bug", "budgetLimitUsd": 1 }'
curl http://localhost:3000/llm/usage
curl http://localhost:3000/llm/audit
```

## Test

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Optional Postgres repository contract tests are skipped unless `AICHESTRA_TEST_DATABASE_URL` is set.

Validation covers lint, TypeScript checking, tests, and a scaffold build smoke check. Tests cover task status transitions, repeated run conflict behavior, instruction precedence, mock LLM usage metadata, LLM Gateway v0 provider/catalog/virtual-key/budget/usage/API behavior, mock Git conflict risk, Conflict Manager scoring, merge simulation, API health, API task execution, registry APIs, registry DTOs, repository boundaries, mutation audit logs, approval/eval gates, checksum verification, registry history, rollback, approval queue read models, local eval result attachment, mock RBAC, registry package manifests, local import/export, dry-run import, semver range resolution v0, dependency warnings/errors, package diffs, registry resolver behavior, Phase 4 Preparation signals/clusters/candidates/proposals/eval requirements/canary plans/safety policy APIs, Phase 4 Auto-improvement v0 analyses/draft changes/readiness checks, Phase 4 Governance v1 review queues/decisions/eval runs/canary readiness/apply gates/audit events, storage provider repository contracts, optional Postgres repository contracts, Real Git Adapter v0 provider/service/API behavior, mock workflow success, policy denial, usage attribution, dashboard assumptions, and Skill/Harness/Instruction separation.

## First Vertical Slice

The first working slice is implemented with mock adapters only:

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
-> merge queue entry is created from active lease conflict risk and simulation status
-> usage ledger records mock tokens/cost
-> task reaches completed
-> web dashboard shows status, mock PR, diff summary, dry-run status, and mock cost
```

## MVP Scope

Included:

- Task creation and state tracking.
- Mock Git branch/PR management.
- Conflict Manager v1 active leases, file-overlap risk scoring, local/mock dry-run merge simulation, and mock merge queue.
- Mock LLM usage tracking.
- Skill, Harness, and Instruction Registry Packaging & Versioning v3 with exact refs, semver range resolution v0, package manifests, local import/export, package diffs, repository boundaries, in-memory and file-backed local storage, stable DTOs, audit logs, append-only history, rollback, approval/eval gates, approval queue read models, local eval result attachment, mock mutation RBAC, local checksum verification, APIs, resolver-backed task selection, TaskRun registry refs, and dashboard visibility.
- Phase 4 Preparation foundations, Auto-improvement v0, and Governance v1 for failure signals, deterministic clusters, improvement candidates, draft proposal metadata, draft registry changes, readiness blockers, proposal review queues, governance decisions, proposal eval run metadata, canary readiness, apply gates, governance audit events, eval requirements, canary rollout plan metadata, safety policy guardrails, APIs, tests, and dashboard visibility.
- Usage ledger and audit log.
- Minimal web dashboard.
- Persistent DB v1 opt-in Postgres storage for Task, TaskRun, UsageLedger, BranchLease, MergeSimulationResult, MergeQueueEntry, Skill, Harness, Instruction, registry audit/history, registry packages, and registry eval results.
- Real Integration Foundation v0 storage provider abstraction, repository inventory, Postgres schema design, migration skeleton, auth/RBAC readiness, Real Git Adapter readiness, dashboard read model plan, and repository contract tests.
- Real Git Adapter v0 provider boundary, deterministic MockGitProvider default, LocalGitProvider fixture-safe changed-file inspection, gated GitHubGitProvider skeleton, GitIntegrationService, `/git/*` API visibility, health metadata, Git audit events, and dashboard visibility.
- LLM Gateway v0 provider boundary, deterministic MockLLMProvider default, OpenAI-compatible skeleton with blocked remote calls, model catalog, virtual model keys, budget checks, usage ledger integration, `/llm/*` API visibility, health metadata, LLM audit events, and dashboard visibility.

Deferred:

- Phase 4 governance repositories remain in-memory for v1.
- Production database operations, backups, migrations governance, pooling, and async repository refactors.
- Real LLM provider calls.
- BYOK, provider API key storage, real streaming, real billing, and remote LLM completions.
- Real GitHub/GitLab/Bitbucket writes.
- Remote git fetch, push, provider merge, provider rebase, or hosted PR automation.
- Real Kubernetes, Temporal, MCP gateway, SSO, SCIM, and billing.
- Production-grade RBAC and secret storage.
- Signed artifacts, full package signing, artifact provenance/SBOM, and real artifact registry integration.
- Production auto-improvement, real proposal generation, draft registry change apply workflow, real eval execution, real canary execution, and automatic registry mutation.

## Security Notes

- Do not commit secrets.
- Real providers are disabled by default.
- External integrations must stay behind adapter interfaces.
- Git writes, MCP calls, and LLM calls must be auditable.
- Instructions guide agent behavior but do not enforce security; policy, sandbox, MCP, and Git adapters must enforce it.

## Next Steps

1. Plan or implement Local Agent Runner v0.
2. Implement Real Git Adapter v1 only if controlled GitHub branch/PR creation is needed in an integration-test environment.
3. Harden LLM Gateway v0 with persistent model catalog/audit repositories before real provider calls.
4. Harden Conflict Manager v1 with rebase-needed detection, stable risk DTOs, queue status history, and richer conflict evidence.
5. Add production DB operational controls such as pooling, backups, restore drills, and migration governance.
