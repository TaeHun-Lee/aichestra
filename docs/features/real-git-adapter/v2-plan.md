# Real Git Adapter v2 Plan

Status: implementation completed after this plan found no critical validation blockers. This file is retained as the pre-implementation plan record.

Canonical docs path: `docs/features/real-git-adapter/`. The repository already uses feature-scoped docs under `docs/features/<feature>/`, so the v2 plan belongs beside `v0.md`, `v1.md`, and their plans rather than in an older flat docs path.

## Current Real Git Adapter v1 Behavior

- `MockGitProvider` remains the default runtime provider.
- `LocalGitProvider` is fixture/local-only and does not fetch, push, merge provider branches, rebase, or delete branches.
- `GitHubGitProvider` supports controlled GitHub branch creation, PR creation, and changed-file reads only when every explicit runtime gate, repo allowlist, branch prefix, credential, and policy decision passes.
- `GitIntegrationService` owns provider calls, repo records, pull request records, branch leases, merge queue linkage, policy checks, and sanitized Git audit records.
- Merge, rebase, force push, branch deletion, remote push, GitHub App installation, GitLab, and Bitbucket remain out of scope.

## Current GitHubClient Boundary

GitHub HTTP behavior is isolated in `packages/adapters/src/git/github-client.ts`.

`FetchGitHubClient` is created only from gated configuration. API handlers and dashboard read models do not call `fetch`, GitHub SDKs, Octokit, or hosted provider APIs directly. Default tests use `NoopGitHubClient` or deterministic fixture clients and must not call GitHub.

v2 must reuse this boundary for optional PR metadata and changed-file refresh. Webhook payload processing itself must not become a new broad GitHub API client.

## Current Persistence

Persistent DB v1 stores:

- `repos`
- `pull_requests`
- `branch_leases`
- `merge_queue_entries`
- `merge_simulation_results`
- common `audit_events`

`PullRequest.externalId` stores GitHub PR numbers for v1 GitHub PRs. `BranchLease` stores branch intent and changed-file inputs. `MergeQueueEntry` stores queue status and non-destructive recommendations. `ConflictRisk` is currently recomputed from active branch leases and simulation evidence.

v2 should add durable webhook/sync read models while preserving in-memory default behavior and opt-in Postgres wiring.

## Current Dashboard Read Model State

Dashboard API-backed Read Model v0 builds `/dashboard/git` from `GitIntegrationService`, current repositories, branch leases, pull requests, merge queue entries, and Git audit events. The dashboard is read-only and must not call GitHub, run workflows, request secrets, or mutate state.

v2 should extend this Git read model with webhook config, recent webhook events, webhook audit, PR sync states, branch sync states, changed-file refresh status, and explicit merge/rebase disabled signals.

## Proposed Webhook Event Scope

Required v2 support:

- `ping`
- `pull_request` actions: `opened`, `synchronize`, `reopened`, `closed`

Optional read-only support if payload fields are present and safe:

- `pull_request_review`
- `check_suite`
- `check_run`
- `status`
- `push` for branch metadata sync only

Unsupported events are ignored with audit. No webhook event may directly trigger workflow execution, agent runs, merge, rebase, force push, or branch deletion.

## Webhook Signature Verification

Add a `GitHubWebhookVerifier` interface with:

- `getVerifierKind()`
- `verify(request)`

Implementations:

- `NoopGitHubWebhookVerifier`: safe default when webhooks are disabled.
- `MockGitHubWebhookVerifier`: deterministic test verifier.
- `HmacGitHubWebhookVerifier`: verifies GitHub `sha256=` HMAC signatures using a configured secret.

HMAC verification must:

- require `AICHESTRA_ENABLE_GITHUB_WEBHOOKS=true`;
- require a SecretRef-backed webhook secret or legacy env webhook secret;
- use constant-time comparison;
- use the raw request body only for verification;
- never store or expose the secret.

Raw webhook payloads should not be persisted. Store payload hashes and sanitized metadata only.

## Sync Read Model Design

Add provider-specific v2 read models:

- `GitWebhookEvent`
- `GitWebhookVerificationResult`
- `GitPullRequestSyncState`
- `GitBranchSyncState`
- `GitWebhookAuditEvent`

`GitPullRequestSyncState` stores repo ref, PR number, provider PR id, state, head/base branch, latest SHA, changed-file paths, labels, mergeable state, sync timestamp, source webhook event id, and sanitized metadata.

`GitBranchSyncState` stores repo ref, branch name, latest SHA, existence status, optional protected flag, sync timestamp, source webhook event id, and sanitized metadata.

Mapping behavior:

- If a webhook PR maps to an existing durable `PullRequest`, update or create a sync state linked by repo and PR number.
- If mapping to an existing task, task run, branch lease, or merge queue entry fails, keep an unmapped external PR sync record instead of failing webhook processing.
- Changed files may update the associated branch lease file list and refresh merge queue risk non-destructively when architecture supports it.

## Environment Gates

Add explicit config:

```bash
AICHESTRA_ENABLE_GITHUB_WEBHOOKS=false
AICHESTRA_GITHUB_WEBHOOK_SECRET=
AICHESTRA_GITHUB_WEBHOOK_SECRET_REF=
AICHESTRA_GITHUB_WEBHOOK_ALLOWED_REPOS=
AICHESTRA_GITHUB_WEBHOOK_INTEGRATION_TESTS=false
AICHESTRA_GITHUB_WEBHOOK_ACCEPT_UNVERIFIED=false
```

Rules:

- Webhook handling is disabled unless `AICHESTRA_ENABLE_GITHUB_WEBHOOKS=true`.
- Signature verification is required for real processing.
- Missing webhook secret blocks real webhook processing.
- SecretRef-backed webhook secret resolution is preferred when configured.
- Legacy env webhook secret is a gated compatibility path.
- `AICHESTRA_GITHUB_WEBHOOK_ACCEPT_UNVERIFIED` remains false by default and must not be used by default runtime/tests.

## Policy Integration

Add policy actions:

- `git.webhook.receive`
- `git.webhook.verify`
- `git.webhook.process`
- `git.pull_request.sync`
- `git.branch.sync`
- `git.changed_files.read`

Existing destructive actions remain:

- `git.merge`: denied
- `git.rebase`: denied

Policy checks should run before processing and before changed-file refresh. Denied policy decisions are audited. Config gates remain authoritative and cannot be weakened by policy.

## Secrets and Sandbox Integration

Webhook secrets should use `SecretRef` with `secretKind=github_webhook_secret` or `webhook_secret` when configured. The env SecretRef provider is still explicit and allowlist-based. Legacy `AICHESTRA_GITHUB_WEBHOOK_SECRET` is allowed only as a gated fallback.

Webhook handling must not:

- log the webhook secret;
- return it through API, health, dashboard, audit, or errors;
- request runner secret injection;
- forward secrets to Local Agent;
- read credential caches.

SecretRef-backed webhook secrets should be the future hardening path for production deployments.

## Audit Requirements

Record sanitized audit events:

- `github_webhook_received`
- `github_webhook_disabled`
- `github_webhook_signature_verified`
- `github_webhook_signature_rejected`
- `github_webhook_unsupported_event`
- `github_webhook_payload_rejected`
- `github_webhook_processed`
- `github_pr_sync_started`
- `github_pr_sync_completed`
- `github_pr_sync_failed`
- `github_branch_sync_started`
- `github_branch_sync_completed`
- `github_branch_sync_failed`
- `github_changed_files_refresh_started`
- `github_changed_files_refresh_blocked`
- `github_changed_files_refresh_completed`
- `github_merge_attempt_blocked`
- `github_rebase_attempt_blocked`

Audit metadata may include delivery id, event type, action, repo ref, PR number, branch name, sync ids, policy decision ids, and sanitized reasons. It must not contain raw payloads, GitHub tokens, webhook secrets, raw credentials, or unredacted logs.

## API and Dashboard

Add DTO-based endpoints:

- `POST /git/github/webhooks`
- `GET /git/github/webhooks/config`
- `GET /git/github/webhooks/events`
- `GET /git/github/webhooks/events/:id`
- `GET /git/github/webhooks/audit`
- `GET /git/repos/:id/pr-sync`
- `GET /git/repos/:id/pr-sync/:number`
- `GET /git/repos/:id/branch-sync`
- `GET /git/repos/:id/branch-sync/:branchName`
- `POST /git/repos/:id/pull-requests/:number/sync`
- `POST /git/repos/:id/pull-requests/:number/refresh-changed-files`

Manual sync and changed-file refresh are non-destructive and gated. No merge endpoint is added.

`GET /health` should include provider kind, remote Git enabled, webhook enabled, webhook secret configured boolean, `webhookAcceptUnverified=false`, supported event count, and no secret values.

## Integration Test Strategy

Default tests:

- use mock verifier and fixture payloads;
- never call GitHub;
- never expose webhook secrets;
- verify disabled, missing-secret, rejected, ignored, processed, PR sync, branch sync, policy denial, dashboard, health, and API behavior.

Optional real GitHub webhook/integration tests:

- skip unless `AICHESTRA_GITHUB_WEBHOOK_INTEGRATION_TESTS=true` and all required webhook, remote Git, repo allowlist, credential, and secret gates are configured;
- must report skipped status clearly.

## Out of Scope

- Automatic merge.
- Rebase push.
- Force push.
- Branch deletion.
- Remote push.
- GitHub App full installation flow.
- GitLab or Bitbucket.
- LLM Gateway v2.
- Real LLM provider calls.
- Vendor CLI execution.
- Credential cache reads.
- Workflow or agent execution triggered directly from webhook.
- Production auth/RBAC for webhook sender identity.
