# Real Git Adapter v0 Plan

## Current behavior

- `GitProvider` currently exists in `packages/adapters/src/interfaces.ts`.
- `MockGitProvider` is the default provider used by the worker workflow.
- `LocalGitDryRunMergeSimulator` already supports local-only merge simulation through `git merge-tree` without fetch, push, or working-branch mutation.
- The worker records `TaskRun`, `BranchLease`, `PullRequest`, `MergeSimulationResult`, `MergeQueueEntry`, usage, and audit state through the store.
- Persistent DB v1 provides opt-in Postgres durability for the core Git-related state while keeping in-memory storage as the default.

## Available durable state

Persistent DB v1 can store:

- `Repo`
- `Task`
- `TaskRun`
- `BranchLease`
- `PullRequest`
- `MergeSimulationResult`
- `MergeQueueEntry`
- `AuditLog`

Phase 4 improvement/governance state remains in-memory and is not part of this Git adapter task.

## GitProvider interface design

Real Git Adapter v0 will extend the provider-neutral Git boundary with:

- provider kind and connection validation
- repository, branch, and pull request refs
- branch create/list/get
- pull request create/list/get
- changed-file inspection
- pull request diff inspection
- merge simulation result recording hook
- provider audit metadata

The interface will not define merge, force-push, branch delete, or rebase-and-push methods in v0.

## Safety gates

Default behavior remains mock-first.

Remote Git operations require all of:

- `AICHESTRA_GIT_PROVIDER=github`
- `AICHESTRA_ENABLE_REMOTE_GIT=true`
- operation-specific flag enabled, such as `AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE=true` or `AICHESTRA_ALLOW_REMOTE_PR_CREATE=true`
- valid provider configuration

Even when enabled, the GitHub provider boundary remains a skeleton in v0 and does not perform network calls.

Local Git operations:

- require an explicit local repository path
- must not run `git fetch`
- must not run `git push`
- must not delete branches
- must not merge, rebase, or mutate the current working tree
- may inspect branch state and changed files
- may create a local branch ref only when explicitly requested through the local provider

## Supported v0 operations

- Mock branch creation and mock PR creation.
- Local repository validation.
- Local branch listing and branch existence checks.
- Local changed-file inspection through `git diff --name-status`.
- GitHub provider configuration validation and blocked operation results.
- Durable audit events for Git provider selection, blocked operations, branch requests, PR requests, changed-file reads, and merge simulation recording.
- API visibility for Git provider config, repos, branches, PRs, changed files, and Git audit events.

## Unsupported operations

- Real GitHub/GitLab/Bitbucket API calls.
- Remote branch creation.
- Remote PR creation.
- Fetch, push, merge, rebase, force-push, branch deletion, or hosted provider merge.
- GitHub App installation flow.
- Production auth/RBAC.
- Automatic merge queue execution.

## Remote operation rules

The GitHub boundary returns deterministic blocked or not-implemented results. It must not import a GitHub SDK, `fetch`, `axios`, or `Octokit`. Tokens must never be returned from API or health endpoints.

## Audit requirements

Git audit events are recorded through the existing generic audit log as `git.*` actions with sanitized metadata:

- provider kind
- operation
- result
- repo id or repo ref
- task id and task run id when available
- actor id when available
- no tokens or secrets

## Test strategy

- Preserve existing mock workflow tests.
- Add provider unit tests for mock, local, and GitHub skeleton providers.
- Add service integration tests for branch/PR/audit/merge queue linkage.
- Add API tests for config, repo, branch, PR, changed files, and blocked remote operations.
- Add dashboard assumptions for Git provider status and audit visibility.
- Keep remote Git tests skipped unless a future explicit integration environment is configured.

## Out of scope

- Real provider network calls.
- GitHub App setup.
- Real auth/RBAC.
- Production secrets.
- Automatic merge/rebase/push.
- LLM Gateway work.
