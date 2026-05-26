# AGENTS.md — Aichestra Local MVP

## Project identity

Aichestra Local MVP is a local-first tool for a single developer running multiple AI coding sessions against one repository or even one source file in parallel. The product is best understood as a **local merge queue for parallel LLM coding sessions**, with extra semantic review based on each session's recorded change intent.

The MVP must prove this core claim:

> A developer can run multiple LLM coding sessions in parallel, each in its own Git worktree and branch, and Aichestra will prevent structural breakage by validating each result against the latest main in a sandbox before it can be applied.

Do not overstate the guarantee. The MVP does **not** prove that every change is logically correct. It prevents workspace overwrite, stale-base merge mistakes, untested candidate merges, and unreviewed main updates. Semantic conflicts are reduced through manifest-based LLM review, tests, type checks, and human approval.

## Non-negotiable invariants

1. **Never run an LLM coding session in the main worktree.**
   - Every LLM session must get a dedicated branch and dedicated worktree.
   - The process `cwd` for an LLM session must be the session worktree.

2. **Never let two sessions share one working directory.**
   - Same target file is allowed.
   - Same physical file path is not allowed.

3. **The merge queue is sequential.**
   - Only one candidate may be validated against main at a time.
   - After one candidate is applied, the next candidate must be validated against the new main.

4. **The tested tree must be the applied tree.**
   - Do not test a rebased result and then apply a different merge result.
   - Do not test a merge commit and then apply the original branch with a different strategy.
   - The exact candidate tree that passed preflight is the only tree that may be applied to main.

5. **Tests run in the integration sandbox, not merely in the session worktree.**
   - Session-local tests are useful feedback.
   - The gate is the test/typecheck/lint result on `latest main + candidate changes`.

6. **Change intent is recorded before merge review.**
   - Each completed session must produce a Change Manifest.
   - The manifest is compared against the actual diff and used by the Semantic Merge Reviewer.

7. **The merge LLM is advisory, not authoritative.**
   - It identifies semantic risks, proposes fixes, and produces a review report.
   - It does not bypass tests or human approval.

8. **Human approval is required before applying a verified candidate to main.**

## MVP scope

Build a local single-user tool first. No central server is required.

In scope:

- Local CLI-first workflow
- Optional local web UI later
- Git worktree-per-session
- Session registry in SQLite
- Local artifact storage
- Change Manifest generation and validation
- Local merge queue
- Integration sandbox
- Mechanical conflict detection
- Semantic merge review using a dedicated LLM session or prompt
- Test/typecheck/lint gate
- Human review and approval
- Apply verified candidate tree to main

Out of scope for MVP:

- Multi-user presence
- Enterprise permission model
- Remote control plane
- MCP gateway
- Skill registry
- Secret broker
- Graph database
- Full semantic static analysis
- Automatic production deployment

## Recommended implementation stack

Prefer Rust for the MVP core unless the repository has already chosen another stack.

Suggested crates and tools:

- CLI: `clap`
- Async/process: `tokio`
- SQLite: `sqlx` or `rusqlite`
- Git: shell out to `git` first; wrap commands carefully
- File watching: `notify`
- Serialization: `serde`, `serde_yaml`, `serde_json`
- Hashing: `sha2`
- Temp dirs: `tempfile`
- Diff parsing: start simple with `git diff --name-status`, `git diff --stat`, and patch files

Prefer native `git` commands in MVP because behavior is easier to audit and reproduce. Add `gitoxide` later only after the command-level merge semantics are locked.

## Expected repository layout

When creating the project, prefer this shape:

```text
repo-root/
├── AGENTS.md
├── README.md
├── Cargo.toml
├── crates/
│   ├── aich-cli/          # CLI commands and user interaction
│   ├── aich-core/         # domain model, orchestration, events
│   ├── aich-git/          # git command wrapper and worktree manager
│   ├── aich-ledger/       # SQLite schema and artifact store
│   ├── aich-llm/          # LLM adapter wrapper and prompts
│   ├── aich-merge/        # queue, preflight, semantic review pipeline
│   └── aich-check/        # local check runner
├── docs/
│   ├── ARCHITECTURE.md
│   ├── MERGE_ALGORITHM.md
│   └── SEMANTIC_MERGE.md
├── .aichestra/
│   ├── config.yaml
│   ├── schemas/change-manifest.schema.yaml
│   ├── templates/change-manifest.yaml
│   └── prompts/
│       ├── change-manifest.md
│       └── semantic-merge-review.md
└── tests/
    └── fixtures/
```

For a very small first commit, a single Rust crate is acceptable. Keep module boundaries matching the future crate names.

## Core commands to implement

Target CLI command set:

```bash
aich init

aich session start \
  --goal "Describe the task" \
  --provider codex \
  --target src/auth.ts

aich status

aich session complete <session-id>

aich queue

aich preflight <session-id>

aich review <session-id>

aich approve <session-id>

aich apply <session-id>
```

Optional later:

```bash
aich semantic-review <session-id>
aich resolve <session-id>
aich manifest edit <session-id>
aich doctor
```

## State model

Use SQLite for local state. Store large artifacts as files under `.aichestra/artifacts/` or an external Aichestra home directory.

Important entities:

- Session
- PatchSet
- ChangedFile
- ContextSnapshot
- ChangeManifest
- MergeAttempt
- SemanticReview
- CheckResult
- Approval
- EventLog

Persist event names even in MVP. They become future server sync events.

Suggested events:

- `repo.initialized`
- `session.created`
- `worktree.created`
- `session.started`
- `context.snapshot.created`
- `files.changed`
- `patchset.created`
- `manifest.created`
- `manifest.validated`
- `merge.preflight.started`
- `merge.mechanical.completed`
- `merge.semantic_review.completed`
- `check.completed`
- `approval.requested`
- `approval.approved`
- `approval.rejected`
- `merge.applied`
- `merge.blocked`

## Change Manifest rules

Every completed LLM work session must produce a structured Change Manifest. The manifest records what changed, why it changed, and what assumptions the change makes.

The manifest must include:

- session id
- task goal
- base commit
- head commit or patch id
- summary of intent
- changed files
- changed symbols if known
- newly created files
- deleted or renamed files
- breaking changes
- migration notes
- compatibility assumptions
- tests added
- tests run
- risks and uncertainty

Do not trust the manifest alone. Validate it against actual Git diff data.

If the manifest claims no breaking changes but the diff changes exported function signatures, public API files, config files, migrations, or shared types, flag the manifest as suspicious and require review.

## Semantic merge reviewer

The Semantic Merge Reviewer is a dedicated LLM review step that runs after mechanical merge simulation and before approval.

Inputs:

- Candidate session Change Manifest
- Already-applied or queued session manifests when relevant
- Actual diff summary
- Changed file list
- Changed symbol summary if available
- Mechanical merge result
- Test results if any
- Project rules from this AGENTS.md and `.aichestra/config.yaml`

Outputs:

- semantic risk level: low / medium / high / blocked
- suspected semantic conflicts
- assumptions that may have changed
- call sites or tests that should be checked
- proposed fix plan, if needed
- optional patch suggestion, but never auto-apply without preflight
- reviewer summary for the human

The reviewer must say when it is uncertain. It must not claim safety merely because Git had no text conflict.

## Merge algorithm: verified tree rule

The implementation must follow this rule:

> A candidate may be applied to main only if the exact candidate tree was created from latest main, passed checks in the integration sandbox, passed semantic review or had risks accepted, and received human approval.

Recommended MVP strategy:

1. Lock the local merge queue.
2. Read current `main` commit as `main_before`.
3. Create or reset a temporary integration sandbox worktree at `main_before`.
4. Apply the candidate using one chosen strategy.
5. If conflicts occur, block.
6. If semantic review finds blocker risks, block or request a resolver patch.
7. Run checks in the sandbox.
8. If checks fail, block.
9. Create the verified commit/tree in the sandbox.
10. Store the verified tree id and commit id.
11. Ask the user for approval.
12. Before applying, verify main is still at `main_before`.
13. Apply the verified commit/tree to main using the same result that was tested.
14. Unlock queue.

Do not mix rebase-tested results with merge-commit application. Do not use a different merge strategy in apply than in preflight.

## Integration sandbox

Use an integration sandbox as a temporary verification worktree. It is not necessarily a long-lived integration branch.

Preferred MVP meaning:

```text
integration sandbox = temporary worktree used to create and test the candidate tree
```

Avoid introducing a persistent `aich/integration/local` branch unless the product explicitly supports staging multiple verified changes before promotion.

## Git safety guidance

Primary safety is architectural:

- LLM sessions receive only their own worktree path.
- The main worktree is not handed to coding agents.
- The merge queue controls updates to main.

Secondary safety is advisory/enforcement where practical:

- Warn if main worktree becomes dirty.
- Refuse to apply if main moved since preflight.
- Refuse `git push --force` features in MVP.
- Use hooks/wrappers as helpful guardrails, but do not depend on them for security.

This is a single-user, non-adversarial MVP. Do not pretend it is a hardened sandbox.

## Completion policy

Prefer explicit human completion:

```bash
aich session complete <session-id>
```

Do not depend on an LLM's own "done" message as the only trigger. The complete command should:

- inspect worktree dirty state
- create a commit or patch set according to config
- collect diff summary
- request or generate Change Manifest
- capture context snapshot hash
- enqueue merge candidate

Dirty tree policy must be explicit. Recommended MVP policy:

- If there are changes, create a candidate commit on the session branch.
- If there are untracked files, include only files under the repo root unless ignored.
- If there are no changes, mark session as completed with no-op and do not enqueue.

## Test gate policy

Project checks are configured in `.aichestra/config.yaml`.

The gate checks must run inside the integration sandbox after candidate application.

Session worktree checks are useful but insufficient.

For Rust project development, run:

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --all
```

For the target repo being managed by Aichestra, run the commands configured by the target repo's `.aichestra/config.yaml`.

## Human review expectations

Review output should show:

- task goal
- branch/worktree
- base commit and candidate commit/tree
- changed files
- diff summary
- Change Manifest summary
- semantic review result
- mechanical conflict result
- test/typecheck/lint result
- exact command that will apply the verified tree

The user approves the verified candidate, not just the original session branch.

## Coding conventions

- Keep functions small and testable.
- Wrap all shell command execution in a typed command layer.
- Never build Git commands by string concatenation; pass args as arrays.
- Record stdout/stderr artifacts for failed commands.
- Prefer explicit errors with actionable messages.
- Make merge state transitions durable in SQLite before running destructive operations.
- Any function that changes Git state should be idempotent or have a recovery path.

## Definition of done

A change is done only when:

- code compiles
- relevant unit/integration tests pass
- `cargo fmt` and `cargo clippy` pass for Aichestra code
- merge algorithm invariants are not weakened
- docs are updated if behavior changed
- tests cover the core path or a regression scenario

For changes to merge logic, also update `docs/MERGE_ALGORITHM.md`.

For changes to semantic review, also update `docs/SEMANTIC_MERGE.md` and `.aichestra/prompts/semantic-merge-review.md`.

## When working as Codex

Before modifying code:

1. Read this file.
2. Inspect `docs/ARCHITECTURE.md`.
3. Inspect `docs/MERGE_ALGORITHM.md` before touching merge, git, queue, or apply logic.
4. Inspect `docs/SEMANTIC_MERGE.md` before touching Change Manifest or semantic review logic.
5. Summarize the invariant affected by your change.

When implementing:

- Prefer minimal, high-confidence changes.
- Add or update tests with the behavior change.
- Do not weaken the verified-tree rule.
- Do not add a server dependency to MVP paths.
- Do not make automatic LLM conflict resolution bypass human approval.

When reporting back:

- State what changed.
- State what tests/checks were run.
- State any semantic risks or unresolved uncertainties.
