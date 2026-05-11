# Bootstrap Gap Report

## Summary

The scaffold is stable and the first MVP vertical slice is implemented with mock adapters only. The repository has root validation commands, root AGENTS.md guidance, split package boundaries for Git, LLM, policy, registry, runner, shared utilities, and mock-only provider behavior.

## Current Repository Structure

Implemented top-level structure:

```text
apps/
  api/
  runner/
  web/
  worker/
packages/
  adapters/
  core/
  db/
  git-adapter/
  llm-gateway/
  policy/
  registry/
  runner/
  shared/
  testing/
docs/
infra/
AGENTS.md
README.md
```

`packages/adapters` remains as a compatibility aggregate for shared adapter contracts and mock implementations. The explicit boundary packages re-export the relevant contracts and mocks for future ownership.

## Implemented Requirements

- Root `AGENTS.md` exists and documents durable implementation rules.
- Root validation commands exist: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- `packages/core` contains Task, TaskRun, provider, repo, BranchLease, ConflictRisk, MergeQueueEntry, Skill, Harness, InstructionArtifact, InstructionSet, UsageEvent, and AuditLog domain types.
- Task status transitions are explicit and tested, including the vertical-slice `completed` state and repeated-run path back to `queued`.
- Mock LLM, model router, Git, policy, MCP, secrets, agent runner, test runner, and usage ledger behavior exists behind interfaces.
- API exposes health, tasks, task run trigger, task runs, repos, registries, usage, and audit logs.
- Worker runs the mock workflow through policy, model selection, skill/harness/instruction selection, branch preparation, agent output, mock tests, mock PR creation, usage recording, and completion.
- Web dashboard shows completed task status, mock PR, mock cost, changed files, and diff summary.
- Prisma schema draft, seed data, and in-memory repository exist.
- Docs and ADRs describe architecture, domain model, MVP scope, security model, instruction layer, and registries.

## Missing Requirements

- Persistence remains in-memory for the MVP.
- Migrations are placeholder-only.
- `design_docs/AICHESTRA_BOOTSTRAP.md` is the canonical bootstrap source.
- Pull request creation still lives under the mock Git provider; a dedicated pull request provider can be split later if that behavior grows.
- API and web are dependency-light Node skeletons rather than production frameworks.

## Architecture Boundary Violations

No critical blocker found.

Minor cleanup candidates:

- `packages/adapters` is still the implementation aggregate; split packages currently re-export from it.
- `apps/runner` remains as an app shell while `packages/runner` owns shared runner contracts.

## Validation Command Results

Latest results:

```text
pnpm install: pass
pnpm lint: pass
pnpm typecheck: pass
pnpm test: pass
pnpm build: pass
```

## Risky Or Premature Implementations

- No real OpenAI, Anthropic, GitHub, MCP, Vault, Temporal, or Kubernetes integrations were added.
- No secrets were added.
- The mock PR URL uses a `mock://` URL and does not perform network I/O.
- TypeScript and Node types are dev-only dependencies for local typechecking.

## Recommended Next Changes

1. Harden Conflict Manager v1 with rebase-needed detection, stable DTOs, queue history, and richer conflict evidence.
2. Expand Registry v0 with CRUD, version pinning, and validation.
3. Add dedicated pull request provider and usage-ledger package boundaries if the mock behavior grows.
4. Replace the in-memory repository with Prisma persistence.
5. Add OpenAPI documentation for the vertical-slice and conflict routes.

## Decision

Conflict Manager v1 is implemented for mock/local-only dry-run simulation. Proceed next to Phase 2 v1 hardening or Registry v0 after validation.
