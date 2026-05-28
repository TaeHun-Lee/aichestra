# Aichestra Local MVP

Aichestra Local MVP is a local-first CLI for coordinating parallel LLM coding sessions through dedicated Git worktrees, a local SQLite ledger, a sequential merge queue, sandbox preflight, semantic review, and human approval.

The key invariant is unchanged:

```text
the exact tree tested in preflight must be the tree applied to main
```

## What It Does

Aichestra lets one developer run multiple AI coding sessions against one repo without letting those sessions share a working directory or update main directly.

The current MVP provides:

- `aich init`
- `aich auth whoami`
- `aich auth operator add/list`
- `aich status`
- `aich doctor`
- `aich queue`
- `aich queue unlock --force`
- `aich session start --goal ...`
- `aich session run <session-id>`
- `aich session complete <session-id>`
- `aich session reopen <session-id>`
- `aich session abandon <session-id>`
- `aich session cleanup <session-id>`
- `aich session prune --applied`
- `aich session prune --inactive`
- `aich preflight <session-id>`
- `aich review <session-id>`
- `aich manifest show <session-id>`
- `aich manifest edit <session-id>`
- `aich approve <session-id>`
- `aich reject <session-id> --reason ...`
- `aich apply <session-id>`

Core behavior:

- one branch and worktree per session
- configured provider command execution from the session worktree
- generated Change Manifest artifacts validated against actual diff evidence
- Change Manifest review/edit UX before semantic review
- queue-head preflight with a durable SQLite queue lock
- integration sandbox checks before approval
- preflight check policy fingerprints that force re-preflight when required check settings change
- semantic review policy fingerprints that force re-review when reviewer settings or prompts change
- semantic review through `local`, `command`, or `llm` adapters
- review, approval, and apply summaries that show the exact verified commit/tree, checks, changed files, and next command
- human approval for the exact verified tree/commit
- human rejection and reopen recovery for candidates that need another pass
- apply guards for configured main branch/ref, clean main worktree, and main-not-moved checks
- apply crash recovery for interrupted `applying` transitions

## Layout

```text
crates/
  aich-cli/      # CLI commands and user interaction
  aich-core/     # session, event, merge invariant domain models
  aich-git/      # worktree manager interface and native git adapter
  aich-ledger/   # SQLite schema and repository helpers
  aich-llm/      # semantic review report contract, parser, and input models
  aich-merge/    # merge queue status and review/approval readiness rules
docs/
  ARCHITECTURE.md
  MERGE_ALGORITHM.md
  SEMANTIC_MERGE.md
.aichestra/
  config.yaml
  prompts/
  schemas/
  templates/
```

## Quick Start

Install Rust, then:

```bash
cargo run -p aich-cli -- init
cargo run -p aich-cli -- doctor
```

Start and run a session:

```bash
cargo run -p aich-cli -- session start --goal "Describe the task" --provider codex --target src/auth.rs
cargo run -p aich-cli -- session run <session-id>
cargo run -p aich-cli -- session complete <session-id>
```

Validate and apply through the queue:

```bash
cargo run -p aich-cli -- queue
cargo run -p aich-cli -- preflight <session-id>
cargo run -p aich-cli -- manifest show <session-id>
cargo run -p aich-cli -- manifest edit <session-id> --set-intent-summary "What changed and why"
cargo run -p aich-cli -- review <session-id>
cargo run -p aich-cli -- approve <session-id>
cargo run -p aich-cli -- apply <session-id>
```

`aich manifest show` reports the latest Change Manifest artifact, ledger hash status, YAML parse status, changed files, manifest-vs-diff evidence, intent summary, and risk level. `aich manifest edit` updates the YAML artifact through structured fields such as `--set-intent-summary`, `--set-risk-level`, `--add-risk`, and `--add-test`, then records the new artifact hash and `manifest.updated` event. Editing the manifest does not change the candidate patch or verified tree; rerun `aich review <session-id>` before approval.

Semantic review records the evidence fingerprint it reviewed, including the manifest id/hash, verified candidate identity, changed files, and sandbox check evidence. If any of that evidence changes after review, `aich approve` refuses until review is rerun, and `aich queue` shows `aich review <session-id>` as the next action.

Preflight also records the check policy fingerprint from `.aichestra/config.yaml`. If check commands, `required`, timeout, or explicit environment settings change after preflight, `aich review`, `aich approve`, and `aich apply` refuse the stale candidate and `aich queue` points back to `aich preflight <session-id>`.

Semantic review also records the reviewer policy fingerprint. If the semantic review adapter, reviewer/provider/model/profile/command, timeout, block levels, prompt path, or prompt file content changes after review, `aich approve` and `aich apply` refuse until `aich review <session-id>` is rerun.

Reject and revise a verified candidate instead of applying it:

```bash
cargo run -p aich-cli -- reject <session-id> --reason "Needs another pass"
cargo run -p aich-cli -- session reopen <session-id>
cargo run -p aich-cli -- session complete <session-id>
```

Clean up applied or inactive session resources:

```bash
cargo run -p aich-cli -- session cleanup <session-id>
cargo run -p aich-cli -- session prune --applied
cargo run -p aich-cli -- session prune --inactive
```

Withdraw a candidate without applying it:

```bash
cargo run -p aich-cli -- session abandon <session-id>
```

## Configuration

`.aichestra/config.yaml` controls local workflow behavior.

Important settings:

```yaml
sessions:
  branch_prefix: aich/session

providers:
  codex:
    command: codex --ask-for-approval never exec --sandbox workspace-write --skip-git-repo-check --ephemeral --color never -

git:
  main_branch: main

semantic_review:
  adapter: local
  timeout_seconds: 600
  risk_block_levels:
    - blocked
```

`git.main_branch` is resolved as `refs/heads/<branch>`. `aich apply` expects the main worktree to be on that configured branch.

`providers.<name>.command` is executed with the session worktree as `cwd`; the session task input is sent on stdin and stdout/stderr are stored as artifacts.

`checks.commands[]` is parsed as structured YAML. `required: true` checks form the sandbox gate; failures or timeouts block preflight. `required: false` checks are recorded for review but do not block verification. Use `timeout_seconds` or `timeout_ms` for time limits, and `env` to pass explicit environment variables to the sandbox check process. These fields are part of the preflight check policy fingerprint, so changing them requires a fresh preflight before review, approval, or apply can proceed.

`semantic_review.adapter` supports:

- `local`: deterministic MVP reviewer
- `command`: external command that returns a `semantic_review:` YAML document on stdout
- `llm`: provider wrapper path; the built-in `codex` provider uses non-interactive read-only `codex exec`

Use `semantic_review.timeout_seconds` or `semantic_review.timeout_ms` to bound command and LLM reviewer execution. Non-zero exit, timeout, or invalid YAML records a blocked semantic review.

Semantic review settings and the prompt file content are part of the review policy fingerprint. Changing them after a review makes that review stale, so rerun `aich review <session-id>` before approval or apply.

## Recovery

If preflight or apply leaves a stale queue lock:

```bash
cargo run -p aich-cli -- queue
cargo run -p aich-cli -- queue unlock --force --reason "stale process"
```

If apply was interrupted, re-run:

```bash
cargo run -p aich-cli -- apply <session-id>
```

Aichestra will only recover when configured main is still at the preflight `main_before` commit or already at the approved verified commit.

## Checks

```bash
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test --workspace --no-fail-fast
```
