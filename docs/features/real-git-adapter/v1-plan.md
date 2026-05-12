# Real Git Adapter v1 Plan

Status: implemented in Real Git Adapter v1.

Canonical docs path: `docs/features/real-git-adapter/`. The repository now organizes feature documents in per-feature directories, so this plan uses `docs/features/real-git-adapter/v1-plan.md` instead of the older flat-path convention.

## Current v0 Behavior

- `MockGitProvider` remains the default provider and supports deterministic branch, pull request, changed-file, merge-simulation, and audit fixtures.
- `LocalGitProvider` supports local fixture repositories only. It uses local Git inspection and must not fetch, push, merge provider branches, or mutate remote state.
- `GitHubGitProvider` exists as a gated skeleton. By default it returns deterministic blocked results and does not make network calls.
- `GitIntegrationService` owns provider calls, repo/PR records, branch leases, merge queue linkage, policy checks, and git audit records.
- API handlers expose DTO-like JSON through service boundaries and do not instantiate provider-specific clients directly.

## Current Persistent DB State

Persistent DB v1 already has durable state for the v1 operation surface:

- `repos`: provider, owner, name, default branch, remote URL, and status.
- `pull_requests`: task/repo/provider linkage, provider external id, URL, and status.
- `branch_leases`: task/taskRun/repo branch metadata, changed file intent, symbols, tests, and lease status.
- `merge_queue_entries`: PR, branch lease, risk score, conflict-risk, simulation, and recommendation linkage.
- `audit_logs`: generic audit records with sanitized metadata for Git integration events.

No new Postgres implementation is required for v1. Remote operation metadata can be represented with the existing repo, branch lease, pull request, merge queue, and audit records. Future versions may split remote Git audit into a dedicated table if volume or query requirements justify it.

## Proposed GitHub v1 Operation Set

v1 adds controlled GitHub operations behind explicit gates:

- Validate configured GitHub connection for one allowlisted repository.
- Create a remote branch from an allowlisted repo/base branch.
- Create a pull request from an allowed branch prefix to a base branch.
- Read changed files for a pull request.

All operations flow through a `GitHubClient` interface owned by the adapter package. Services must not use `fetch`, SDKs, Octokit, or raw HTTP directly.

## Required Environment Gates

- `AICHESTRA_GIT_PROVIDER=github`
- `AICHESTRA_ENABLE_REMOTE_GIT=true`
- `AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE=true` for branch creation.
- `AICHESTRA_ALLOW_REMOTE_PR_CREATE=true` for PR creation.
- `AICHESTRA_ALLOW_REMOTE_MERGE=false`; merge remains unsupported regardless of env.
- `AICHESTRA_GITHUB_TOKEN` must be present for real GitHub calls.
- `AICHESTRA_GITHUB_OWNER` and `AICHESTRA_GITHUB_REPO` identify the default target repo for validation.
- `AICHESTRA_GITHUB_ALLOWED_REPOS` must include the target `owner/repo`.
- `AICHESTRA_GITHUB_ALLOWED_BRANCH_PREFIX` defaults to `ai/`.
- `AICHESTRA_GITHUB_INTEGRATION_TESTS=false` by default.

## Required Allowlists

- Remote operations require the target repo to match `AICHESTRA_GITHUB_ALLOWED_REPOS`.
- Branch and PR head names must start with `AICHESTRA_GITHUB_ALLOWED_BRANCH_PREFIX`.
- Missing or empty allowlists block remote write operations with `repo_not_allowlisted`.

## Safety Rules

- Default runtime and default tests must not call GitHub.
- GitHub token material is read only from env/config for the gated integration and is never stored, returned, logged, or exposed in health/dashboard output.
- No automatic merge, rebase, force push, branch deletion, remote push, webhook processing, reviewer request, GitHub App installation flow, GitLab, or Bitbucket implementation is added.
- Branch and PR title/body values are sanitized before provider calls.
- Changed-file metadata is sanitized before audit storage.
- Merge remains blocked even if `AICHESTRA_ALLOW_REMOTE_MERGE=true`.

## Policy Integration

The policy engine will evaluate:

- `git.remote_operation`
- `git.branch.create`
- `git.pull_request.create`
- `git.merge`
- `git.rebase`

Remote branch/PR operations require both config gates and an allow policy. Merge/rebase stay denied. Blocked policy decisions are audited and cannot be bypassed by API endpoints.

## Secrets and Sandbox Integration

Secrets/Sandbox v0 remains metadata-only. GitHub token handling stays inside gated config/client construction and is not routed through runner, Local Agent, or audit metadata. v1 documents the future migration path to `SecretRef`/SecretManager without issuing secret leases or injecting secrets into local processes.

## Audit Requirements

v1 will record sanitized audit events for:

- `git.remote_git_config_validated`
- `git.github_connection_validated`
- `git.github_connection_blocked`
- `git.github_branch_create_requested`
- `git.github_branch_create_blocked`
- `git.github_branch_created`
- `git.github_pr_create_requested`
- `git.github_pr_create_blocked`
- `git.github_pr_created`
- `git.github_changed_files_requested`
- `git.github_changed_files_blocked`
- `git.github_changed_files_read`
- `git.github_merge_attempt_blocked`
- `git.github_rebase_attempt_blocked`

Audit metadata may include actor id, task id, task run id, repo ref, branch name, PR number, provider kind, operation, result, policy decision id, and sanitized provider metadata. It must not include tokens or raw credentials.

## Integration Test Strategy

- Default tests use `MockGitProvider`, `NoopGitHubClient`, and deterministic mock GitHub clients only.
- Real GitHub integration tests must skip unless all required env vars are explicitly configured:
  - `AICHESTRA_GITHUB_INTEGRATION_TESTS=true`
  - `AICHESTRA_ENABLE_REMOTE_GIT=true`
  - `AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE=true`
  - `AICHESTRA_ALLOW_REMOTE_PR_CREATE=true`
  - `AICHESTRA_GITHUB_TOKEN`
  - `AICHESTRA_GITHUB_ALLOWED_REPOS`
- Skipped integration tests must report clearly.

## Out of Scope

- LLM Gateway v1.
- Real LLM provider calls.
- GitHub App installation flow.
- GitLab or Bitbucket.
- Automatic merge, provider rebase, force push, branch deletion, remote push, and webhook processing.
- Production-grade secret management for GitHub credentials.
- Dedicated remote Git audit database tables.
