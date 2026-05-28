# Acceptance Scenarios

These scenarios are executable proof points for the Aichestra Local MVP claim. They focus on the user-visible workflow rather than isolated unit behavior.

## Parallel tmp.md Sessions

This scenario proves that two LLM sessions can modify the same target file from the same starting main commit without sharing a working directory, and that Aichestra validates each candidate sequentially against the latest configured main before applying it.

Target file:

```text
tmp.md
```

Starting content:

```text
title: acceptance

alpha section
alpha: base
alpha note: stable

middle: unchanged

beta section
beta: base
beta note: stable
```

Session changes:

- Session 1 changes `alpha: base` to `alpha: session one`.
- Session 2 changes `beta: base` to `beta: session two`.
- Both sessions target `tmp.md`, but each runs in its own branch and worktree.

Acceptance criteria:

- `aich session start` creates two distinct session ids, branches, and worktree paths.
- Both sessions start from the same configured main commit.
- Dogfood note A: this scenario has been run with a real Codex worker session.
- The session worktrees diverge independently: session 1 sees only its `alpha` change, while session 2 sees only its `beta` change.
- `aich session complete` enqueues both candidates and records `tmp.md` in each Change Manifest.
- `aich preflight <session-2>` refuses before session 1 is handled because session 2 is not queue head.
- Session 1 completes `preflight -> review -> approve -> apply`.
- Session 2 preflight then records `main_before_commit` equal to the commit produced by applying session 1.
- Session 2's integration sandbox contains both `alpha: session one` and `beta: session two`.
- Session 2 completes `review -> approve -> apply`.
- Final main `tmp.md` contains both session changes.
- The queue is empty and the main worktree is clean.

Reproducible test:

```bash
cargo test -p aich-cli command_adapter_cli_e2e_parallel_tmp_md_sessions_are_sequentially_verified
```

On Windows, the same scenario can be run through:

```powershell
.\scripts\acceptance-tmp-md.ps1
```

On Unix-like shells:

```bash
./scripts/acceptance-tmp-md.sh
```

The test creates a temporary Git repository, writes `tmp.md`, configures test provider/reviewer/check commands, runs the full CLI workflow, and asserts the verified-tree rule through the second sandbox and ledger state.
