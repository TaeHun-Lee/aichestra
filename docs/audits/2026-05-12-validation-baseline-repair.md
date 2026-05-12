# Validation Baseline Repair

## What Failed

Two validation gates were failing:

- `pnpm test` failed in `tests/dashboard-data.test.ts`.
- `pnpm build` failed because `scripts/build.mjs` required root `AICHESTRA_BOOTSTRAP.md`.

## Root Cause

The dashboard data fixture marked `auth-debugging` as `approvalStatus = pending` so the approval queue panel had visible data. The same fixture then used `auth-debugging@^1.0.0` for registry version resolution and expected it to be selected.

That expectation was stale. Phase 3 registry policy requires selected registry entries to pass resolver gates:

- lifecycle status is `active`
- approval status is `not_required` or `approved`
- eval status is `not_required` or `passed`
- instruction checksum status is not `mismatch`

Because `auth-debugging` was pending approval, the resolver correctly excluded it.

The build failure was a path mismatch. `scripts/build.mjs` expected `AICHESTRA_BOOTSTRAP.md` at the repository root, but the canonical copy had already been moved under `docs/briefs/AICHESTRA_BOOTSTRAP.md`.

## Fix Applied

- Updated `apps/web/lib/mock-data.ts` so the successful version-resolution fixture uses selectable `jest-test-fixer@^1.0.0`.
- Added a separate dashboard data assertion in `tests/dashboard-data.test.ts` proving pending `auth-debugging@^1.0.0` remains excluded with deterministic warnings/errors.
- Updated `scripts/build.mjs` to validate `docs/briefs/AICHESTRA_BOOTSTRAP.md` instead of requiring a duplicate root copy.

## Resolver Gates Preserved

The resolver logic was not changed.

Pending approval entries are still not selected by default. The repaired tests now cover both intended behaviors:

- selectable registry entries can resolve successfully
- pending approval registry entries are excluded deterministically

No lifecycle, approval, eval, or checksum gate was weakened or bypassed.

## Bootstrap Canonical Path

The canonical bootstrap path for validation is:

```text
docs/briefs/AICHESTRA_BOOTSTRAP.md
```

Root `AICHESTRA_BOOTSTRAP.md` is intentionally not required. Design and work-order documents live under `design_docs/` so the repository root stays focused on active project guidance and package/workspace configuration.

## Validation Results After Repair

| Command | Result | Summary |
|---|---|---|
| `pnpm lint` | pass | `lint passed` |
| `pnpm typecheck` | pass | TypeScript check completed with no errors |
| `pnpm test` | pass | 69 tests passed, 0 failed |
| `pnpm build` | pass | `build passed` |

`pnpm install` was not run because dependency metadata did not change.

## Mock-Only Compliance

The mock-only compliance search was rerun:

```bash
rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|github|gitlab|bitbucket|bedrock|gemini|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|git fetch|git push|kubectl|vault|temporal|mcp" .
```

Classified results:

- Safe documentation references in `design_docs/`, `docs/`, and `README.md`.
- Safe mock references such as `packages/adapters/src/mcp/mock-mcp-gateway.ts` and `.github/workflows/` risk path strings.
- Safe type/interface references such as `ProviderKind`, `RepoProvider`, `AgentKind`, and `UsageEvent.eventType`.
- Safe local-only Git references in existing dry-run merge simulation documentation/tests.
- Suspicious real integration code: none found.
- Actual external calls: none found.

No real external API calls or provider integrations were introduced.
