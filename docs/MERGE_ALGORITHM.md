# Merge Algorithm — Verified Candidate Rule

## Core rule

A candidate may be applied to main only if the exact candidate tree/commit was verified in preflight.

Never test one result and apply another.

## Terminology

- **Session branch**: branch created for one LLM work session, for example `aich/session-123/fix-login`.
- **Session worktree**: worktree checked out to the session branch.
- **Main worktree**: developer's main checkout. LLM sessions do not work here.
- **Integration sandbox**: temporary worktree created from latest main for preflight.
- **Candidate**: the patch or commit set produced by a session.
- **Verified candidate**: candidate result after mechanical merge, semantic review, checks, and approval.

## Recommended MVP strategy

Use one consistent strategy for both preflight and apply. The simplest MVP strategy is:

1. Convert session changes to a candidate branch commit or patch.
2. In an integration sandbox at latest main, apply/merge the candidate.
3. Run checks.
4. Commit the sandbox result as the verified candidate commit.
5. Apply that exact verified commit/tree to main.

## High-level sequence

```text
lock queue
read current main commit as main_before
create/reset sandbox at main_before
apply candidate using chosen strategy
if conflict: block
run semantic merge review
if semantic blocker: block or create resolver candidate
run checks in sandbox
if checks fail: block
create/store verified candidate commit/tree
request human approval
before apply, verify main is still main_before
apply verified candidate to main
unlock queue
```

## Important consistency requirement

Bad:

```text
preflight: rebase candidate on latest main, tests pass
apply: merge original branch into main with merge commit
```

Good:

```text
preflight: create merge result M in sandbox, tests pass
apply: update main to the verified result M
```

Also good:

```text
preflight: rebase candidate branch R on latest main, tests pass
apply: fast-forward main to R
```

Choose one strategy and keep it consistent.

## Candidate creation

`aich session complete <session-id>` is the candidate creation boundary. It inspects the session worktree, commits any dirty tracked or unignored untracked changes on the session branch, records the patch set and generated Change Manifest, and marks sessions with real diffs as `enqueued`. If the session branch has no diff from its recorded base commit, the session is marked `noop` and does not enter the merge queue.

## Conflict detection

MVP may use normal Git operations in a temporary sandbox because this is easiest to reason about:

```bash
# Pseudocode only; implementation must handle errors and cleanup.
git worktree add <sandbox-path> main
cd <sandbox-path>
git reset --hard <main_before>
git merge --no-commit --no-ff <session-branch>
```

If the merge fails, record conflict files and block.

`git merge-tree --write-tree` can be added later for working-tree-free simulation, but it must use semantics equivalent to the apply path.

## Preflight implementation

`aich preflight <session-id>` creates a merge attempt for an `enqueued` session and uses `merge_no_ff_commit` as the apply strategy for the verified candidate. The command:

1. Reads current main as `main_before_commit`.
2. Creates a detached sandbox worktree under `.aichestra/sandboxes/<merge-attempt-id>`.
3. Runs `git merge --no-ff --no-commit <candidate_commit>` in the sandbox.
4. Commits the merged sandbox result as the verified candidate commit.
5. Runs configured checks from `.aichestra/config.yaml` inside the sandbox.
6. Stores check stdout/stderr artifacts and the resulting merge attempt status.

If the mechanical merge conflicts or any check fails, the merge attempt is marked `blocked`. If all configured checks pass, the merge attempt stores `verified_tree_id` and `verified_commit_id` and is marked `verified`.

## Applying to main

Before apply:

- ensure the queue lock is still held
- ensure main has not moved since `main_before`
- ensure human approval refers to the verified candidate id
- ensure the verified tree/commit id matches the preflight record

If main moved, do not apply. Re-run preflight on the new main.

## Semantic review position

Semantic review runs after the mechanical merge result is available and before checks/approval are considered complete.

The Semantic Merge LLM may produce a proposed patch. If accepted, that patch creates a new candidate result that must go through checks again.

## Failure modes

Block the candidate when:

- mechanical merge conflict occurs
- manifest validation fails critically
- semantic review reports `blocked`
- checks fail
- user rejects approval
- main moved between preflight and apply
- verified tree id does not match the approved tree id

## Recovery

A blocked candidate should remain in the ledger with its artifacts. The developer can:

- ask a worker LLM to revise the session branch
- create a conflict-resolution session
- manually edit the session branch
- abandon the candidate

Every retry creates a new MergeAttempt.
