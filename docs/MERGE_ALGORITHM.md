# Merge Algorithm — Verified Candidate Rule

## Core rule

A candidate may be applied to main only if the exact candidate tree/commit was verified in preflight.

Never test one result and apply another.

## Terminology

- **Session branch**: branch created for one LLM work session, for example `aich/session-123/fix-login`.
- **Session worktree**: worktree checked out to the session branch.
- **Main worktree**: developer's main checkout. LLM sessions do not work here.
- **Configured main branch/ref**: `.aichestra/config.yaml` `git.main_branch` names the local branch that represents main. Commands resolve it as `refs/heads/<branch>` instead of assuming the current `HEAD`.
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
read configured main ref commit as main_before
create/reset sandbox at main_before
apply candidate using chosen strategy
if conflict: block
run semantic merge review
if semantic blocker: block or create resolver candidate
run checks in sandbox
if checks fail: block
create/store verified candidate commit/tree
request human approval
before apply, verify configured main ref is still main_before
apply verified candidate to the configured main branch worktree
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

`aich session complete <session-id>` is the candidate creation boundary. It inspects the session worktree, commits any dirty tracked or unignored untracked changes on the session branch, records the patch set and generated Change Manifest, and marks sessions with real diffs as `enqueued`. Changed symbols are captured with MVP diff heuristics from hunk headers and changed declaration lines, then stored as `changed_files.symbols_json` and rendered into the generated manifest. If the session branch has no diff from its recorded base commit, the session is marked `noop` and does not enter the merge queue.

## Queue display

`aich queue` is a read-only view of candidates that still need merge-queue attention. It combines session status, the latest merge attempt, semantic review evidence, and approval records into human-facing states:

- `enqueued`: session completion produced a candidate, but preflight has not produced a merge attempt yet
- `preflight_running`: the latest merge attempt is currently in preflight
- `applying`: apply started and may still be running, or a prior apply was interrupted and should be retried/finalized with `aich apply <session-id>`
- `verified`: preflight checks passed and a verified tree/commit exists, but approval has not been recorded
- `approved`: a human approval exists for the verified tree/commit and the next step is apply
- `blocked`: the latest merge attempt is blocked by conflict, failed checks, blocking semantic review, rework, or human rejection

Applied candidates are omitted from the queue view because they no longer require merge-queue action.

The pure state classification for these labels lives in `aich-merge`; `aich-cli` renders the labels and recovery guidance.
Pure blocked-reason inference from merge evidence, such as blocker semantic review, failed required checks, or missing verified commit/tree, also lives in `aich-merge`; `aich-cli` still prefers explicit event-log reasons when they exist.

When a verified or approved candidate was created under an older check policy, `aich queue` keeps the candidate visible but reports `preflight_stale` and points the next action back to `aich preflight <session-id>`. This prevents an approval or apply from using a tree that never passed the current required-check policy.

When the latest semantic review was produced under an older review policy, `aich queue` reports `review_stale` and points the next action back to `aich review <session-id>`. This covers adapter settings, reviewer/provider/model/profile/command, timeout, risk block levels, prompt path, and prompt file content.

## Queue lock

`aich preflight <session-id>` and `aich apply <session-id>` acquire the durable local `merge-queue` lock before reading or mutating merge-queue state. The lock is stored in SQLite under `queue_locks` with the holder id, operation, optional session id, and acquisition timestamp.

If another preflight or apply command already holds the lock, the command refuses to run and points the user to `aich queue`. The queue view reports whether the lock is free or held, how old the lock is, and whether it is stale by the MVP age heuristic. Normal command completion and ordinary error paths release the lock automatically.

Preflight is queue-head constrained for new candidates. A new `aich preflight <session-id>` may run only for the earliest `enqueued` queue entry, and it refuses to preflight a different session while another candidate is already `preflight_running`, `verified`, or `approved`. This prevents creating multiple verified candidates from the same main commit and then discovering at apply time that only the first one was still based on the latest main. Re-running preflight for the same blocked, verified, or approved session remains allowed as a local recovery path when the existing attempt must be refreshed. After a verified or approved candidate is applied, the next enqueued candidate must be preflighted against the new main commit.

If a process crash leaves a stale lock behind, the user can run:

```bash
aich queue unlock --force --reason "stale preflight process"
```

Unlocking is explicit and evented as `merge.queue_unlocked`. The command requires `--force` because the MVP cannot prove from age alone that a lock is safe to release.

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

1. Reads `.aichestra/config.yaml` `git.main_branch` and resolves `refs/heads/<branch>` as `main_before_commit`.
2. Creates a detached sandbox worktree under `.aichestra/sandboxes/<merge-attempt-id>`.
3. Runs `git merge --no-ff --no-commit <candidate_commit>` in the sandbox.
4. Commits the merged sandbox result as the verified candidate commit.
5. Runs configured checks from `.aichestra/config.yaml` inside the sandbox through the `aich-check` runner. Each check supports `required`, `timeout_seconds` or `timeout_ms`, and `env`.
6. Stores the normalized check policy fingerprint, check stdout/stderr artifacts, and the resulting merge attempt status.

If the mechanical merge conflicts, or any required check fails or times out, the merge attempt is marked `blocked`. Optional checks are still recorded as evidence, but their failure does not mark the candidate blocked. If all required checks pass, the merge attempt stores `verified_tree_id`, `verified_commit_id`, and the check policy fingerprint, then is marked `verified`. Ledger updates that belong to one transition, such as preflight start, preflight finish, review result, approval, and apply finalization, are grouped in SQLite transaction boundaries.

The check policy fingerprint covers the configured check order, name, command program/args, `required`, timeout, and explicit `env` values after config normalization. If this fingerprint differs from the current `.aichestra/config.yaml`, the verified candidate is stale. `aich review`, `aich approve`, and `aich apply` refuse it and point back to `aich preflight <session-id>`. `aich queue` reports this as `preflight_stale: yes (check_policy_changed)` or `legacy_check_policy_evidence` for attempts created before the fingerprint existed.

Legacy stale reasons mean the candidate or review was recorded by an older Aichestra version before that fingerprint was stored. They are treated as stale on purpose; rerunning the command shown by `aich queue` or `aich doctor` refreshes the missing evidence.

## Review implementation

`aich review <session-id>` runs after a verified preflight attempt exists and before approval. The MVP command selects the latest verified merge attempt for the session, loads the Change Manifest, changed-file evidence, patch summary, bounded patch hunk context from the recorded diff patch artifact, verified tree/commit ids, and sandbox check results, then writes a semantic review report artifact under `.aichestra/artifacts/merge-attempts/<merge-attempt-id>/`.

Each semantic review row stores fingerprints for the evidence the reviewer saw: Change Manifest id/hash, verified candidate fields, changed-file evidence, sandbox check evidence, and an aggregate review-evidence fingerprint. It also stores a semantic review policy fingerprint covering adapter settings, reviewer identity/provider/model/profile/command, timeout, risk block levels, prompt path, and prompt file content hash. If any evidence or review policy changes after review, the existing review is stale. Approval refuses until `aich review <session-id>` is rerun against the current evidence and policy.

Review also requires the preflight check policy to still match the current config. If the gate policy changed, semantic review is not run against old check evidence; the candidate must be preflighted again first.

The default local MVP reviewer is deterministic and conservative. It records `llm_executed: false`, flags missing or drifted manifest evidence as `blocked`, flags shared API/config/schema/dependency surfaces as `high`, and otherwise keeps generated-from-diff manifests at least `medium` risk because semantic intent is incomplete.

`semantic_review.adapter: command` delegates review to a configured command that reads the rendered review input from stdin and returns `semantic_review:` YAML on stdout. `semantic_review.adapter: llm` uses the same contract for LLM providers; the built-in `codex` provider runs `codex exec` non-interactively in read-only mode, while custom providers can supply an explicit command. If a command or LLM adapter fails, exits non-zero, times out via `timeout_ms` or `timeout_seconds`, or returns an invalid report, the review result is recorded as `blocked`.

If the configured `semantic_review.risk_block_levels` contains the produced risk level, the merge attempt is marked `blocked`. By default only `blocked` risk blocks the attempt. Non-blocking risks remain advisory evidence for the later human approval gate.

If the review includes `proposed_patch.available: true`, Aichestra writes a fix-plan artifact and, when inline patch text is present, a proposed patch artifact. The artifacts do not change the verified tree. Approval refuses by default until the operator either runs `aich session rework <session-id> --review <semantic-review-id>` or explicitly approves the current verified tree with `aich approve <session-id> --accept-current`.

## Approval implementation

`aich approve <session-id>` records human approval for the latest merge attempt only. The command refuses approval unless:

- the latest merge attempt is `verified`
- sandbox checks passed
- verified tree and commit ids are present
- the check policy used by preflight still matches the current `.aichestra/config.yaml`
- semantic review has been recorded
- semantic review policy still matches the current `.aichestra/config.yaml` and prompt file
- semantic review was run against the current Change Manifest id/hash, verified candidate, changed files, and sandbox check evidence
- semantic review did not block the attempt
- current main still matches the preflight `main_before_commit`
- no unresolved proposed patch exists, unless the operator passed `--accept-current`

The approval row stores the operator id, merge attempt id, `approved_verified_tree_id`, and `approved_verified_commit_id`. This intentionally approves the verified candidate result, not the original session branch. Re-running preflight creates a new merge attempt and therefore requires a new review/approval path.

The pure review/approval readiness checks live in `aich-merge`; `aich-cli` still handles ledger reads, main-ref verification, approval event recording, and user-facing errors.

The approval output repeats the verified candidate summary before pointing to `aich apply <session-id>`. This is deliberately redundant with review output: the operator should see the main-before commit, candidate commit, verified commit/tree, check summary, changed files, semantic review id/risk, and proposed-patch status at the moment the approval is recorded.

`aich session rework <session-id> --review <semantic-review-id>` runs the configured provider command in the existing session worktree with the reviewer fix-plan and patch artifacts as input. Starting rework marks the old verified attempt `blocked` so it cannot be approved accidentally. After the provider finishes, the session is `running`; the user must run `aich session complete`, then `preflight`, `review`, `approve`, and `apply` again for the new candidate.

`aich reject <session-id> --reason TEXT` is the negative human decision for a verified candidate. It records a `rejected` approval decision with the verified tree/commit ids, appends `approval.rejected`, marks the merge attempt `blocked`, and records `merge.blocked` with reason `rejected`. A rejected attempt cannot be approved or applied.

`aich session reopen <session-id>` is the recovery path for rejected or otherwise blocked candidates. It requires a blocked latest merge attempt, refuses abandoned/completed sessions and already approved attempts, verifies that the session worktree still exists and is not the main worktree, then sets the session back to `running`. Reopen does not change main and does not reuse the old verified tree. The user must revise the session worktree, run `aich session complete <session-id>`, then run `preflight`, `review`, `approve`, and `apply` again. The next preflight creates a new MergeAttempt.

## Applying to main

Before apply:

- ensure main has not moved since `main_before`
- ensure human approval refers to the verified merge attempt
- ensure the approved tree/commit ids match the preflight record
- ensure the check policy used by preflight still matches the current `.aichestra/config.yaml`
- ensure the semantic review policy still matches the current `.aichestra/config.yaml` and prompt file
- ensure semantic review was run against the current Change Manifest id/hash, verified candidate, changed files, and sandbox check evidence
- ensure the main worktree is checked out to configured `git.main_branch`
- ensure the main worktree is clean

If main moved, do not apply. Re-run preflight on the new main.

`aich apply <session-id>` currently applies the approved candidate by fast-forwarding the main worktree to the verified commit:

```bash
git merge --ff-only <approved_verified_commit_id>
```

Before running the Git update, the command records the merge attempt as `applying`. After success it records the merge attempt as `applied`, marks the session `completed`, and appends `merge.applied`. The applied commit id and tree id must still match the approved verified commit/tree, or the attempt is blocked.

The apply output reports the approved commit/tree next to the applied commit/tree and explicitly states that the applied result matched the approved verified candidate.

Apply is intentionally retryable around crash points:

- If a crash leaves the merge attempt as `applying` and main is still at `main_before`, re-running `aich apply <session-id>` resets the attempt to `verified` and retries the same approved verified commit.
- If a crash leaves the merge attempt as `applying` and main already equals the approved verified commit, re-running `aich apply <session-id>` does not run Git again. It marks the attempt `applied`, marks the session `completed`, and records `merge.applied` with `recovered: true`.
- If a crash happens after the attempt was marked `applied` but before the session/event bookkeeping finished, re-running `aich apply <session-id>` finalizes the missing ledger state only when main is exactly the approved verified commit.
- If main is neither `main_before` nor the approved verified commit, apply recovery refuses to proceed because the command cannot prove the tested tree is the applied tree.

If the interrupted process left a stale queue lock, run `aich queue unlock --force --reason "stale apply recovery"` first, then retry `aich apply <session-id>`.

## Session abandon

`aich session abandon <session-id>` withdraws a session that should not continue through the merge queue. It marks the session `abandoned`, records `session.abandoned`, and removes the candidate from `aich queue` output without applying anything to main.

Abandon refuses to run while the merge queue lock is held, and refuses sessions whose latest merge attempt is `applying` or `applied`. Review, approval, and apply commands refuse abandoned sessions.

## Session cleanup

`aich session cleanup <session-id>` removes local execution resources for sessions that no longer need merge-queue action. It allows:

- `completed` sessions whose latest merge attempt is `applied`
- `noop` sessions with no merge attempt
- failed-start `blocked` sessions that have no candidate head and no merge attempt
- `abandoned` sessions

It refuses cleanup for active sessions, enqueued candidates, and blocked candidates with merge state because those may still need recovery. Cleanup removes the registered session worktree, deletes the session branch, removes related sandbox worktrees, and records `session.cleaned`. Abandoned sessions use forced branch deletion after the registered worktree is verified clean, because abandoning is the explicit signal to discard that candidate branch.

`aich status` shows `cleanup: cleaned` for sessions that already have a `session.cleaned` event. A direct repeated cleanup refuses to run again, while prune skips already-cleaned sessions.

`aich session prune --applied` runs cleanup across applied sessions. `aich session prune --inactive` runs cleanup across no-op, failed-start, and abandoned sessions. The flags can be combined. Cleanup refuses dirty registered worktrees rather than discarding local files.

## Semantic review position

Semantic review runs after the mechanical merge result is available and before approval. In the current CLI flow, `aich preflight` also runs the configured sandbox checks first, so `aich review` can include check evidence in the semantic report.

The Semantic Merge LLM may produce a proposed patch. It is stored as advisory evidence only. If the operator chooses to rework from it, the resulting session changes create a new candidate result that must go through checks again.

## Failure modes

Block the candidate when:

- mechanical merge conflict occurs
- manifest validation fails critically
- semantic review reports `blocked`
- checks fail
- user rejects approval
- main moved between preflight and apply
- main worktree is detached or checked out to a branch other than configured `git.main_branch`
- verified tree id does not match the approved tree id

## Recovery

A blocked candidate should remain in the ledger with its artifacts. The developer can:

- inspect `aich queue` for `blocked_reason`, recovery guidance, and artifact paths
- inspect `aich doctor` for stale preflight/review evidence, stale queue locks, and `applying` attempts that can be retried with `aich apply <session-id>`
- inspect failed check stderr/stdout, semantic review reports, merge stderr/stdout, or `conflicts.txt`
- follow preflight/apply error hints for the exact next command, such as switching to the configured main branch or re-running preflight/review/approval after main moved
- ask a worker LLM to revise the session branch
- create a conflict-resolution session
- manually edit the session branch
- run `aich session reopen <session-id>` when the latest blocked attempt should be revised in the existing session worktree
- run `aich session abandon <session-id>` to withdraw the candidate from the queue

After revising the candidate, run `aich session complete <session-id>` to record the new candidate head and then run `aich preflight <session-id>` again. Every retry creates a new MergeAttempt.
