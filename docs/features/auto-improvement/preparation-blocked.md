# Phase 4 Preparation Blocked

## Blocker

Phase 4 Preparation cannot start because the Phase 3 Packaging & Versioning v3 validation gate is not currently passing.

The repository has the expected Phase 3 v3 implementation surfaces:

- `RegistryPackageManifest`, `RegistryPackageEntry`, and `RegistryPackageDependency` in `packages/core/src/domain/models.ts`
- local package export/import and dry-run import in `packages/registry/src/index.ts`
- package repository support in `packages/db/src/repository.ts`
- semver range resolution v0 through `RegistryService.resolveVersion`
- package diff support through `RegistryService.diffPackageManifests`
- package API endpoints in `apps/api/src/main.ts`
- package dashboard visibility in `apps/web/lib/mock-data.ts`, `apps/web/src/render.ts`, and `apps/web/app/page.tsx`
- v3 test coverage in `tests/registry-packaging-v3.test.ts` and dashboard assertions in `tests/dashboard-data.test.ts`

However, Phase 3 v3 is not stable enough to proceed because the full test suite fails.

## Evidence

Command run:

```bash
pnpm test
```

Result:

```text
fail: dashboard data exposes conflict manager v1 simulation assumptions
actual: undefined
expected: "1.0.0"
file: tests/dashboard-data.test.ts
assertion: data.registryVersionResolution.selected?.version === "1.0.0"
```

Observed likely cause:

- `apps/web/lib/mock-data.ts` marks `skill_auth_debugging` approval as `pending` for the approval queue fixture.
- The same fixture then resolves `auth-debugging@^1.0.0`.
- The Phase 3 v3 resolver correctly excludes pending-approval registry entries, so `registryVersionResolution.selected` is `undefined`.
- The dashboard test still expects a selected version of `1.0.0`.

This is a validation failure, not a real external integration issue.

## Why This Blocks Phase 4 Preparation

Work Order 3 requires Phase 3 v3 to be complete or sufficiently complete before adding Phase 4 preparation models and APIs.

Phase 4 preparation would add failure signals, clusters, candidates, proposals, eval requirements, canary plans, and safety policies. Those concepts depend on the Phase 3 registry and package resolver contracts being stable.

Starting Phase 4 preparation while Phase 3 v3 tests fail would mix a prerequisite stabilization issue with new Phase 4 scaffolding and make the next validation result harder to interpret.

## Recommended Fix

Fix the Phase 3 v3 dashboard fixture/test mismatch first.

Recommended narrow fix:

- Keep the approval queue fixture that marks `auth-debugging` as `pending`.
- Change dashboard version-resolution fixture data to resolve a selectable active skill, such as `jest-test-fixer@^1.0.0`, or change the test to expect the current gated resolver behavior for pending entries.
- Rerun:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

After validation passes, rerun Work Order 3.

## Application Code Changes

No Phase 4 application code changes were made for this Work Order 3 attempt.

No real external APIs were called.
