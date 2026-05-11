# Real Git Adapter v0 Readiness

Status: implemented as a safe v0 boundary in `docs/real-git-adapter-v0.md`, with `MockGitProvider`, `LocalGitProvider`, a gated `GitHubGitProvider` skeleton, `GitIntegrationService`, API routes, dashboard visibility, and deterministic tests.

## Current Mock Git and Branch Behavior

- `GitProvider` abstracts branch and pull request behavior.
- `MockGitProvider` creates mock branches and mock PR URLs.
- `BranchLease` tracks active branch ownership.
- `MergeQueueEntry` records merge queue state and recommendations.
- `MergeSimulator` abstracts dry-run simulation.
- `LocalGitDryRunMergeSimulator` uses local-only `git merge-tree` behavior without fetch, push, or branch mutation.

## Required Persistent State Before Real Git Adapter

- Tasks and TaskRuns.
- Branch leases.
- Pull request records.
- Merge queue entries.
- Merge simulation results.
- Audit events for branch, PR, and queue actions.
- Actor identity and permissions for Git operations.

## GitProvider Interface Requirements

The current provider-agnostic interface supports:

- Provider kind and connection validation.
- Repository lookup.
- Branch create/get/list.
- Pull request create/get/list.
- Pull request diff and changed-file inspection.
- Merge simulation result recording.
- Audit-safe provider metadata.

It intentionally does not include merge, force-push, rebase-and-push, or delete-branch operations.

## GitHub Adapter Boundary

`GitHubGitProvider` currently lives behind the Git adapter boundary as a skeleton and:

- Accept explicit configuration.
- Requires remote Git flags before remote operations can proceed.
- Returns deterministic blocked results when remote Git is disabled.
- Avoids SDK dependencies and external network calls.
- Avoid destructive operations.

Future real GitHub behavior should be added only behind the same interface and explicit integration-test gates.

## Required Secrets and Permissions

Minimum future permissions:

- Read repository metadata.
- Create branch or fork branch where policy allows.
- Create draft pull request.
- Read PR status.

Deferred permissions:

- Push to protected branches.
- Merge PRs.
- Rebase branches.
- Modify workflow files.

## Required Audit Events

- Git adapter configured.
- Branch creation requested/completed/failed.
- PR creation requested/completed/failed.
- Conflict evidence recorded.
- Merge queue action requested/completed/blocked.
- Provider error recorded with sanitized metadata.

## Required Tests

- Adapter stays behind `GitProvider`.
- No remote push without explicit configuration.
- No automatic merge.
- PR creation produces provider-neutral model.
- Provider errors are sanitized.
- Secrets are not logged.
- Branch lease and merge queue state remain durable.

## Safety Rules

- No automatic merge initially.
- No remote push without explicit adapter configuration.
- No destructive operations.
- Dry-run first.
- PR creation must stay behind explicit interface.
- Hosted provider SDKs must never be used in core, worker workflow code, or tests by default.

## Recommended Next Real Git Adapter Milestone

Implement Real Git Adapter v1 only if the team is ready for controlled remote Git integration. The recommended v1 milestone is a read/write-limited GitHub provider that can create a draft PR from an explicitly configured branch source in a test organization or fixture repository. Keep merge/rebase operations out of scope and preserve mock/local-only behavior as the default.
