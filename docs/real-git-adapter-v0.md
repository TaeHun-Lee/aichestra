# Real Git Adapter v0

## What v0 Implements

Real Git Adapter v0 adds a provider-neutral Git boundary while keeping the default runtime mock-first and safe:

- `GitProvider` now covers provider kind, connection validation, repository lookup, branch listing, branch creation, pull request creation/listing, changed-file inspection, and merge simulation result recording.
- `MockGitProvider` remains the default and produces deterministic branch, PR, changed-file, and audit behavior without external calls.
- `LocalGitProvider` supports local-only repository validation, branch inspection, and changed-file inspection for explicit fixture paths.
- `GitHubGitProvider` is a gated skeleton. It validates config shape and blocks remote operations by default without a GitHub SDK or network calls.
- `GitIntegrationService` wires provider calls to durable repo/PR records, branch leases, merge queue entries, and audit events.
- The API exposes provider config, repo, branch, PR, changed-file, and audit visibility.
- The dashboard shows Git provider safety state, branch/PR records, changed files, merge queue linkage, Git audit events, and a blocked remote operation example.

This is not production Git integration. It intentionally avoids automatic merge, rebase, force-push, delete branch, and default remote calls.

## GitProvider Interface

The provider boundary lives in `packages/adapters/src/interfaces.ts`.

Core methods:

- `getProviderKind`
- `validateConnection`
- `getRepository`
- `createBranch`
- `getBranch`
- `listBranches`
- `createPullRequest`
- `getPullRequest`
- `listPullRequests`
- `getPullRequestDiff`
- `getChangedFiles`
- `recordMergeSimulationResult`
- `close`, optional

Provider-neutral models include `RepoRef`, `BranchRef`, `PullRequestRef`, `CreateBranchRequest`, `CreatePullRequestRequest`, `GitChangedFile`, `GitProviderResult`, `GitConnectionValidation`, and `GitProviderAuditEvent`.

No merge, rebase, force-push, or delete-branch operation exists in v0.

## MockGitProvider

`packages/adapters/src/git/mock-git-provider.ts` implements deterministic mock behavior:

- Creates mock branch refs.
- Creates mock PR refs with `mock://pull-requests/...` URLs.
- Lists in-memory mock branches and PRs.
- Returns deterministic changed files.
- Emits provider audit metadata.
- Performs no external calls.

It remains the default provider through `createGitProviderFromEnv`.

## LocalGitProvider

`packages/adapters/src/git/local-git-provider.ts` supports safe local fixture behavior:

- Requires an explicit local repo path.
- Validates the path with local `git rev-parse`.
- Lists local branches.
- Reads changed files with local `git diff`.
- Does not fetch.
- Does not push.
- Does not mutate the current working tree.
- Rejects unsafe or missing paths.

Local branch creation is disabled by default and only uses `git branch` when `AICHESTRA_ALLOW_LOCAL_BRANCH_CREATE=true`.

## GitHub Provider Boundary

`packages/adapters/src/git/github-git-provider.ts` is a skeleton only:

- No GitHub SDK dependency.
- No `fetch` or HTTP client.
- No default network calls.
- Remote operations return blocked or not implemented results unless future tasks intentionally wire a real provider.

Remote Git is disabled unless all relevant config is explicitly set:

- `AICHESTRA_GIT_PROVIDER=github`
- `AICHESTRA_ENABLE_REMOTE_GIT=true`
- `AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE=true`, for branch creation
- `AICHESTRA_ALLOW_REMOTE_PR_CREATE=true`, for PR creation
- `AICHESTRA_GITHUB_TOKEN`, only for future gated implementations

`AICHESTRA_ALLOW_REMOTE_MERGE` is not supported in v0. Automatic merge is intentionally absent.

## API Endpoints

Implemented in `apps/api/src/main.ts`:

- `GET /git/providers`
- `GET /git/config`
- `GET /git/repos`
- `POST /git/repos`
- `GET /git/repos/:id`
- `GET /git/repos/:id/branches`
- `POST /git/repos/:id/branches`
- `GET /git/repos/:id/pull-requests`
- `POST /git/repos/:id/pull-requests`
- `GET /git/pull-requests/:id`
- `GET /git/pull-requests/:id/changed-files`
- `GET /git/audit`

The health response now reports storage kind, Git provider kind, remote Git enabled state, branch/PR remote operation flags, and merge disabled state without exposing tokens or secrets.

## Audit Events

`GitIntegrationService` records audit events for:

- `git.git_repo_created`
- `git.branch_create_requested`
- `git.branch_created`
- `git.branch_create_blocked`
- `git.pull_request_create_requested`
- `git.pull_request_created`
- `git.pull_request_create_blocked`
- `git.changed_files_read`
- `git.merge_simulation_recorded`
- `git.remote_git_operation_blocked`
- `git.git_connection_validated`

Metadata is sanitized before storage. Token and secret-like keys are redacted.

## Tests

Coverage in `tests/real-git-adapter-v0.test.ts` verifies:

- provider kind and connection validation
- mock branch, PR, changed-file, and audit behavior
- local fixture changed-file inspection without fetch, push, or working-tree mutation
- GitHub skeleton remote operation blocking without network calls
- service linkage to TaskRun, BranchLease, MergeQueue, and audit records
- API endpoints for config, repos, branches, PRs, changed files, and audit

Dashboard assumptions are covered in `tests/dashboard-data.test.ts`.

## Known Limitations

- GitHub provider is a gated skeleton and does not call GitHub.
- No remote branch creation or PR creation is implemented.
- No automatic merge, rebase, force-push, or delete branch exists.
- Local provider is intended for fixture/local demos and does not mutate the current working branch.
- Git audit uses the existing audit log store; a dedicated durable Git audit table may be useful later.
- Real auth/RBAC and secret scope enforcement remain future work.

## Next Recommended Task

Choose one:

- LLM Gateway v0 planning/implementation if model provider integration is the next priority.
- Real Git Adapter v1 if controlled GitHub branch/PR creation should be enabled in an explicit integration-test environment.
