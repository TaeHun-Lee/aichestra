# GitHub App / Production Webhook Hardening Planning v0 Plan

## Chosen Docs Path

`docs/README.md` places cross-cutting integration plans under `docs/roadmaps/`. GitHub App credential posture, production webhook endpoint hardening, replay/idempotency, retry/dead-letter handling, observability, and deployment readiness cross `packages/git-adapter`, `packages/security`, `packages/policy`, `packages/auth`, `packages/observability`, API, dashboard, and production operations. The canonical planning path for this milestone is therefore:

```text
docs/roadmaps/github-app-production-webhook-hardening/
```

The existing Real Git Adapter implementation docs stay under `docs/features/real-git-adapter/`. This roadmap does not replace those feature docs; it defines the next production-hardening plan. No critical validation blockers were found, so implementation can proceed with documentation, deterministic read-only planning models, API/dashboard visibility, and tests.

## Current Real Git Adapter v2 Behavior

- `MockGitProvider` remains the default.
- `LocalGitProvider` is local fixture-only and does not fetch, push, merge provider branches, rebase, force push, or delete branches.
- `GitHubGitProvider` supports controlled branch creation, pull request creation, and changed-file reads only when every explicit remote Git, operation, repo allowlist, branch prefix, credential, Auth/RBAC, and Policy gate passes.
- `GitHubClient` is the only HTTP boundary for GitHub operations. API routes and dashboard read models do not call GitHub directly.
- Automatic merge, provider rebase, remote push, force push, branch deletion, GitHub App installation flow, GitLab, and Bitbucket remain unsupported.

## Current Webhook Receiver / Verifier Behavior

- GitHub webhook processing is disabled unless `AICHESTRA_ENABLE_GITHUB_WEBHOOKS=true`.
- A webhook secret is required through `AICHESTRA_GITHUB_WEBHOOK_SECRET_REF` or the gated legacy `AICHESTRA_GITHUB_WEBHOOK_SECRET`.
- `GitHubWebhookVerifier` isolates verification with noop, mock, and HMAC SHA-256 implementations.
- Raw request bodies are used only for signature verification and payload hashing.
- Stored webhook records include delivery id, event type, action, repo ref, payload hash, signature verification status, processing status, and sanitized metadata only.
- Supported/recognized event behavior is read-model only. It updates webhook event, PR sync, branch sync, and audit records. It does not trigger workflows, agents, merge, rebase, force push, branch deletion, or reviewer automation.
- v2 does not implement durable distributed replay protection, idempotency/dead-letter operations, background retry workers, or a production endpoint plan.

## Current SecretRef-backed Credential Behavior

- SecretRef-backed Provider Credentials v1 is metadata-only.
- GitHub token and webhook secret SecretRefs are preferred over legacy env credentials.
- If a `*_SECRET_REF` is configured but cannot be resolved, adapters do not silently fall back to legacy env credentials.
- The env SecretRef provider is explicit, allowlist-based, disabled by default, and never enumerates environment variables.
- Resolved credential values are transient and can reach only the adapter/verifier boundary.
- No Vault, cloud secret manager, GitHub App private key signing, installation access token exchange, credential cache read, or credential cache upload exists.

## Current Auth/RBAC And Policy Behavior

- Production Auth/RBAC v0 is mock-first planning. It provides provider-neutral actors, roles, permissions, service accounts, and authorization checks, but no production IdP, sessions, OIDC/SAML/SCIM, or token validation.
- Policy-as-code v0 is static TypeScript rules with in-memory audit.
- Current policy denies unverified webhook processing and destructive Git operations by default.
- Auth/RBAC roles do not bypass Git, webhook, SecretRef, runner, MCP, Local Agent, LLM, dashboard, or observability safety gates.

## Current Observability / Audit Behavior

- Observability / Audit Retention v0 normalizes Git and GitHub webhook audit records into `AuditEventEnvelope`.
- Retention and redaction classes are modeled, but no production audit backend, SIEM export, alerting, retention deletion, legal hold, or distributed tracing backend exists.
- Current metric/trace models are skeleton/read-only.

## Current Production Deployment Readiness Gaps

- Production Deployment Readiness Planning v0 lists GitHub App and webhook hardening as a remaining production blocker.
- Current GitHub integration relies on token/env-compatible gates rather than GitHub App installation tokens.
- Webhook handling lacks production endpoint design, durable idempotency, distributed replay protection, retry/dead-letter operations, rate-limit handling, and production alerting.
- Production auth, tenant isolation, real secret backend, policy bundle governance, durable observability, and production DB operations remain blockers.

## Why GitHub App / Webhook Hardening Is Needed

Token/env-gated GitHub integration is useful for controlled integration tests, but production requires:

- least-privilege app permissions per capability;
- installation-scoped repository grants;
- short-lived installation tokens generated from a private key held in a real secret backend;
- webhook replay/idempotency and delivery tracking;
- queue-backed processing and dead-letter review;
- production observability, alerting, and audit evidence;
- a hardened public endpoint with TLS, raw-body preservation, payload limits, and rate limits.

This v0 produces the plan and read-only skeletons needed to make those future changes explicit without enabling them.

## Proposed GitHub App Model

Planning/read-model entities:

- `GitHubAppDescriptor`: app slug, app id placeholder, status, webhook URL, permissions, subscribed events, timestamps, and metadata.
- `GitHubAppInstallation`: installation account, account type, repository selection, status, timestamps, and metadata.
- `GitHubAppRepositoryGrant`: installation-scoped repository grants, permissions, grant status, and metadata.

Statuses distinguish `planned`, `configured_mock`, `disabled`, and `future_live`; no real installation token is generated in v0.

## Proposed Installation / Repository Permission Model

- Production target uses GitHub App installation tokens, not broad PATs.
- Installation records map app descriptor -> account -> repository selection.
- Repository grants map installation -> `repoOwner/repoName` and explicit permission set.
- Aichestra policy and repo allowlists remain authoritative.
- PR/branch creation permissions do not imply merge, workflow, admin, secrets, deployment, or branch deletion permissions.

## Proposed Webhook Replay Protection Model

- Delivery id is the primary idempotency key.
- Payload hash is stored for mismatch detection and audit.
- Duplicate delivery id with the same payload hash is classified as `duplicate`.
- Duplicate delivery id with a different payload hash is classified as `replay_rejected`.
- Timestamp tolerance is planned where sender timestamp is available; GitHub delivery id and signature verification remain required.
- v0 may model classification deterministically but does not implement a production distributed replay cache.

## Proposed Webhook Idempotency / Dedupe Model

- Processing state is tracked by delivery id and event type.
- Read-model updates should be idempotent upserts keyed by repo/ref/PR number/branch name.
- Unsupported events are ignored with audit.
- Destructive side effects are not allowed from webhooks.
- Future queue consumers must handle at-least-once delivery without mutating state unsafely.

## Proposed Webhook Retry / Dead-Letter Model

- Retryable errors include transient storage/queue failures, provider rate-limit read-model refresh failures, and downstream read-model update conflicts.
- Non-retryable errors include invalid signature, missing headers, repo not allowlisted, malformed payload, unsupported event, and policy denial.
- Dead-letter records store delivery id, event type, repo ref, reason, retryable flag, sanitized preview, and metadata only.
- No real background retry worker is implemented in v0.

## Audit / Observability Requirements

Planned audit events:

- `github_app_installation_created_future`
- `github_app_installation_suspended`
- `github_app_repo_grant_changed`
- `github_webhook_duplicate_rejected`
- `github_webhook_dead_lettered`
- `github_installation_token_requested_future`
- `github_installation_token_issued_future_metadata_only`

Planned metrics:

- webhook deliveries received
- webhook deliveries verified
- webhook deliveries rejected
- duplicate deliveries
- dead-letter count
- PR sync success/failure
- branch sync success/failure
- GitHub API rate-limit warnings
- webhook processing latency

No audit event may include private keys, webhook secrets, tokens, raw payloads, or credential cache paths.

## What This Task Implements

- GitHub App / Production Webhook Hardening v0 planning docs.
- GitHub App permission matrix reference.
- GitHub webhook event allowlist reference.
- Replay protection, retry/dead-letter, credential, and production endpoint plans.
- Deterministic read-only planning models in the existing deployment-readiness boundary.
- Read-only `/readiness/github-app/*` API endpoints.
- Dashboard GitHub App / Webhook Hardening panel.
- Tests for permission matrix, webhook allowlist, replay/dead-letter/credential summaries, API, dashboard, and no-secret exposure.
- Status and inventory updates across README, AGENTS, roadmap, readiness, observability, and Real Git Adapter docs.

## Out Of Scope

- No real GitHub App creation or installation flow.
- No GitHub App private key generation, signing, storage, or reading.
- No installation access token exchange.
- No real GitHub API calls.
- No remote Git operations.
- No production webhook enablement.
- No automatic merge, rebase push, force push, branch deletion, reviewer automation, GitLab, or Bitbucket.
- No LLM Gateway, MCP, Vault, Kubernetes, Temporal, artifact registry, vendor CLI, or credential cache integration.
- No weakening of existing Auth/RBAC, Policy, SecretRef, Git, LLM, MCP, Local Agent, Runner, Dashboard, Observability, or Secrets/Sandbox gates.
