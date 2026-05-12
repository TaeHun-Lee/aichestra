# Task State Machine

Task statuses are defined in `packages/core/src/domain/status.ts`.

Primary happy path:

```text
draft -> planned -> queued -> branch_created -> running -> testing -> pr_draft_ready -> completed
```

PR/CI merge path:

```text
pr_draft_ready -> pr_opened -> ci_pending -> merge_ready -> merged -> completed
```

Failure and review branches:

```text
planned -> policy_blocked
testing -> failed
testing -> conflict_detected
testing -> review_required
ci_pending -> ci_failed
pr_opened -> conflict_detected
conflict_detected -> conflict_fixing
conflict_fixing -> review_required
review_required -> merge_ready
```

The MVP uses `assertTaskStatusTransition` to prevent invalid workflow jumps.
