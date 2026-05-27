# Aichestra Local MVP

Aichestra Local MVP is a local-first CLI for coordinating parallel LLM coding sessions through dedicated Git worktrees, a local SQLite ledger, a sequential merge queue, sandbox preflight, semantic review, and human approval.

The key invariant is unchanged:

```text
the exact tree tested in preflight must be the tree applied to main
```

## Current Slice

This repository now contains a CLI-first local MVP slice:

- `aich init`
- `aich auth whoami`
- `aich auth operator add/list`
- `aich status`
- `aich queue`
- `aich session start --goal ...`
- `aich session complete <session-id>`
- `aich preflight <session-id>`
- `aich review <session-id>`
- `aich approve <session-id>`
- `aich apply <session-id>`
- SQLite schema initialization
- session domain model
- worktree manager and native Git adapter
- append-only event ledger
- generated Change Manifest artifacts
- sandbox preflight checks
- local semantic review report artifacts
- verified-tree approval and apply guards

## Layout

```text
crates/
  aich-cli/      # CLI entrypoint and init command
  aich-core/     # session, event, merge invariant domain models
  aich-git/      # worktree manager interface and native git adapter shell
  aich-ledger/   # SQLite schema and repository helpers
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

## Run

Install Rust, then:

```bash
cargo run -p aich-cli -- init
cargo run -p aich-cli -- session start --goal "Describe the task" --provider codex --target src/auth.rs
cargo run -p aich-cli -- queue
```

Checks:

```bash
cargo fmt --all -- --check
cargo test --all
cargo clippy --all-targets -- -D warnings
```
