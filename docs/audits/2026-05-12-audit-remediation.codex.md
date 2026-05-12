# Audit Remediation Notes

Date: 2026-05-12

Scope:

- `docs/audits/2026-05-12-ai-behavior-audit.claude.md`
- `docs/audits/2026-05-12-audit_claude_01.html`
- Current `docs/audits/*` status reports

This pass re-checked the audit findings against the current repository after Real Git Adapter v1, Dashboard API-backed Read Model v0, LLM Gateway v1, Local Agent Protocol v1, and SecretRef-backed Provider Credentials v1 work.

## Applied

The following findings were still valid, scoped, and safe to apply immediately:

| Audit item | Judgment | Remediation |
|---|---|---|
| HTML #1 / AI #N2 related instruction integrity | Valid | Core instruction resolver now excludes rejected, pending approval, failed eval, and checksum mismatch artifacts. |
| HTML #3 | Valid | Policy-denied reruns from completed/failed tasks now return `policy_blocked` instead of throwing invalid `queued -> planned` transitions. |
| HTML #5 | Valid | `local_git_merge_tree` API mode now requires `repoPath` to be under `AICHESTRA_ALLOWED_REPO_PATHS`. Mock merge simulations are unchanged. |
| HTML #9 / AI #N3 | Valid | LLM Gateway and enterprise provider audit metadata now use recursive security metadata sanitization. |
| HTML #10 | Valid | Workflow usage metadata now includes `instruction_set_id` and `instruction_set_hash`. |
| HTML #17 | Valid | Runner command execution has an unconditional default deny rule, while explicit fixture-local allow remains narrower and lower-risk commands are still blocked by higher-priority network/remote-git denies. |
| HTML #19 | Valid | `LocalCliProviderAdapter.invoke` now requires a `ProviderInvocationRequest`, matching the adapter contract. |
| HTML #20 | Valid | Mock task policy critical-path review prefixes now include `terraform/` and `security/`. |
| HTML #21 | Valid | Registry audit listing with `targetKind` only now filters by target kind instead of returning all audit logs. |
| HTML #24 | Valid | File-backed registry persistence now writes temp file then renames atomically. |
| AI #N1 | Valid | Dashboard provider defaults to API read models unless `AICHESTRA_DASHBOARD_DATA_SOURCE=demo` is explicit; demo fallback is opt-in and emits a warning when used. |
| AI #N2 | Valid as pre-LLM hardening | Workflow wraps task text inside explicit user-input markers and escapes system/developer control-token-like strings before handing it to the runner. |

## Already Resolved Or Obsolete

These findings were valid at the audit's original commit but are no longer current:

| Audit item | Current status |
|---|---|
| HTML #8 | Dashboard API-backed Read Model v0 is implemented. The dashboard can consume `/dashboard/*` read models and no longer needs to run workflows as its main runtime data path. |
| AI #N7 | LLM Gateway v1 plan and implementation now exist. Remote LLM calls remain explicitly gated and mock-first by default. |
| Older final-audit validation blockers | Current validation is green; the older failing dashboard test/build references are stale. |
| Phase 4 missing models in older audits | Phase 4 Preparation, Auto-improvement v0, and Governance v1 are now implemented as mock-only metadata/governance layers. |

## Valid But Deferred

These findings remain directionally valid but require a dedicated design task rather than a narrow audit remediation patch:

| Audit item | Reason for deferral |
|---|---|
| HTML #2 / #4 | Real API auth/RBAC and actor trust boundaries are production-auth work. Current project rules still prohibit production auth/RBAC in these integration tasks. |
| HTML #6 | Registry uniqueness and published-entry immutability need schema, repository, import/export, rollback, and fixture migration design together. |
| HTML #7 | Full TaskRun and MergeQueue transition tables should be handled as a persistence/concurrency hardening task. |
| HTML #11 / #12 / #13 / #14 | Postgres schema/index/default/client-driver cleanup belongs to Persistent DB v2. |
| HTML #15 / #16 | Governance idempotency and direct policy coverage expansion are useful but separate Phase 4 hardening work. |
| HTML #18 / #23 | API/status wording cleanup only; not a safety blocker. |
| AI #N4 / #N5 / #N6 | Agent confidence/evidence fields, progress streaming, and clarification flows should be designed with the first non-mock runner/LLM adapter. |

## Validation

- `pnpm typecheck`: pass
- `pnpm test`: pass, 170 passed / 3 skipped

The skipped tests are optional Postgres, real GitHub integration, and real remote LLM integration suites because their explicit environment gates are not fully configured.
