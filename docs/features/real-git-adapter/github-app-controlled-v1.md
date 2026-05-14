# GitHub App Controlled Implementation v1

Status: `v1_implemented`.

Production-ready: no. This milestone adds a controlled GitHub App credential boundary and mock installation-token handle flow. It does not implement live GitHub App rollout, private-key signing, JWT issuance, or installation-token exchange with GitHub.

## What v1 Implements

- GitHub App runtime/read models for config, installations, repository grants, token requests, and token results.
- `AICHESTRA_GITHUB_AUTH_MODE=legacy_token | github_app` with `legacy_token` as the default.
- Disabled and mock `GitHubAppTokenProvider` boundaries.
- Metadata-only `github_app_private_key` SecretRef kind support.
- Auth/RBAC permissions for GitHub App configure/use/token-issue actions.
- Static Policy-as-code rules for GitHub App config, installation use, repo-grant use, and token-handle issuance.
- Git service integration so branch create, PR create, and changed-file read can request a mock GitHub App token handle when all gates pass.
- Status-only API endpoints under `/git/github-app/*`.
- Safe `/health` and dashboard GitHub App runtime metadata.
- Sanitized GitHub App audit events.
- Deterministic tests for config gates, SecretRef states, Auth/RBAC and Policy denial order, API/dashboard/health redaction, and Git operation integration.

## What v1 Does Not Implement

- No production GitHub App rollout.
- No GitHub App creation or installation flow.
- No private-key parsing, loading, signing, or storage.
- No JWT generation.
- No real GitHub installation-token request.
- No real GitHub App HTTP call in default runtime or tests.
- No automatic merge, rebase push, force push, branch deletion, workflow/admin/secrets/deployment permission, GitLab, or Bitbucket.
- No LLM Gateway, MCP real transport, Vault/cloud secret backend, Kubernetes, Temporal, artifact registry, vendor CLI, or credential cache integration.

## GitHub App Auth Mode

Default auth remains legacy-token/mock behavior. GitHub App mode is selected only when:

```bash
AICHESTRA_GITHUB_AUTH_MODE=github_app
AICHESTRA_ENABLE_GITHUB_APP=true
AICHESTRA_GITHUB_APP_ID=12345
AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF=secretref_github_app_private_key
AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS=123456
AICHESTRA_GITHUB_APP_ALLOWED_REPOS=aichestra/demo
```

`AICHESTRA_GITHUB_APP_SLUG`, `AICHESTRA_GITHUB_APP_WEBHOOK_SECRET_REF`, and `AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX` are optional metadata/gate inputs. `AICHESTRA_GITHUB_APP_INTEGRATION_TESTS=false` remains the default.

Raw private-key environment values such as `GITHUB_APP_PRIVATE_KEY` or `AICHESTRA_GITHUB_APP_PRIVATE_KEY` are unsupported. The runtime reports that condition as blocked configuration metadata and never reads a private key value.

## SecretRef Private-Key Model

GitHub App private-key support is metadata-only in v1:

- `SecretKind` includes `github_app_private_key`.
- Token-handle issuance requires an active SecretRef with that kind.
- Disabled, revoked, missing, or wrong-kind SecretRefs block issuance.
- The mock token provider never resolves a raw private key value.
- API, health, dashboard, audit, and DTOs expose only configured booleans, ids, counts, and status.

Real private-key signing requires future secret backend migration and a separately reviewed live GitHub App implementation profile. GitHub App integration-test profile v1 now supplies the skipped-by-default readiness surface for future live tests, but it still does not sign keys or exchange installation tokens in default runtime/tests.

## Installation State And Repository Grants

`GitHubAppInstallationState` is derived from allowlisted installation ids. `GitHubAppRepositoryGrantState` is derived from allowlisted repo refs. These records are runtime/read models, not live GitHub installation discovery.

The grant model stores permission metadata and status only. It does not grant merge, rebase, force-push, branch-delete, workflow, administration, secrets, or deployment access.

## Installation Token Provider Boundary

The provider interface is:

- `getProviderKind()`
- `validateAppConfig(config)`
- `createInstallationToken(request)`
- `revokeOrExpireToken(handle)` optional future boundary

Implemented providers:

- `DisabledGitHubAppTokenProvider`: blocks GitHub App token issuance.
- `MockGitHubAppTokenProvider`: issues metadata-only token handles for deterministic tests and gated mock runtime checks.

The token result contains status, token handle id, expiry metadata, policy decision id, authorization decision id, audit event id, and sanitized metadata. It never contains a raw token.

## Legacy Token Fallback

`AICHESTRA_GITHUB_AUTH_MODE=legacy_token` preserves the existing SecretRef-backed GitHub token path and legacy env fallback behavior. A configured GitHub App does not silently fall back to a PAT inside `github_app` mode.

Legacy `AICHESTRA_GITHUB_TOKEN` remains local/integration compatibility only and is not production-ready.

## Git Operation Integration

GitHub App mode is considered only after existing Git gates are satisfied:

- `AICHESTRA_GIT_PROVIDER=github`
- `AICHESTRA_ENABLE_REMOTE_GIT=true`
- operation-specific branch/PR/read gate
- repo allowlist
- allowed branch prefix
- Auth/RBAC allow
- Policy allow
- GitHub App token-handle result allow

Branch create, PR create, and changed-files read record sanitized audit when a GitHub App token handle is used. Merge, rebase, force push, and branch deletion remain denied.

## Webhook Secret Integration

Webhook config prefers the existing `AICHESTRA_GITHUB_WEBHOOK_SECRET_REF` path and can also recognize `AICHESTRA_GITHUB_APP_WEBHOOK_SECRET_REF` as GitHub App metadata. Signature verification remains required. v1 does not add a production webhook endpoint or webhook-triggered agent execution.

## Auth/RBAC Integration

The auth catalog adds:

- `github_app.configure`
- `github_app.installation.use`
- `github_app.repo_grant.use`
- `github_app.installation_token.issue`
- `git.changed_files.read`

Auth denial blocks before SecretRef metadata checks. Developer/viewer roles do not directly issue GitHub App token handles. Service-account and platform-admin paths remain scoped and still require policy allow decisions.

## Policy Integration

Static Policy-as-code adds GitHub App rules that:

- deny token issuance outside GitHub App auth mode;
- deny when enable gates or app id are missing;
- deny missing private-key SecretRef metadata;
- deny unallowlisted installations and repos;
- allow only mock token-handle issuance for non-destructive purposes when every gate passes.

Policy remains static TypeScript. v1 does not add OPA, Cedar, external policy services, dynamic policy execution, signed bundles, or break-glass execution.

## Audit And Redaction

GitHub App audit events include:

- `github_app_config_loaded`
- `github_app_config_blocked`
- `github_app_installation_selected`
- `github_app_installation_denied`
- `github_app_repo_grant_checked`
- `github_app_repo_grant_denied`
- `github_app_token_requested`
- `github_app_token_issued_mock`
- `github_app_token_blocked`
- `github_app_private_key_resolution_requested`
- `github_app_private_key_resolution_denied`
- `github_app_private_key_redacted`
- `github_app_operation_used_for_branch_create`
- `github_app_operation_used_for_pr_create`
- `github_app_operation_used_for_changed_files`

Audit metadata may include app id configured booleans, installation id, repo ref, actor id, policy decision id, authorization decision id, and token handle id. It must not include private keys, JWTs, installation tokens, webhook secrets, PATs, raw credentials, raw payloads, or credential cache contents.

## API Endpoints

- `GET /git/github-app/config`
- `GET /git/github-app/installations`
- `GET /git/github-app/repository-grants`
- `POST /git/github-app/validate`
- `POST /git/github-app/installations/:id/token/check`
- `GET /git/github-app/audit`

The endpoints are read/status-only. `token/check` returns status and handle metadata only. No endpoint creates a live GitHub App, reads private-key values, returns tokens, or calls GitHub in default runtime/tests.

## Health And Dashboard

`GET /health` reports GitHub App booleans and counts:

- auth mode;
- app enabled/configured status;
- app id configured boolean;
- private-key SecretRef configured boolean;
- webhook SecretRef configured boolean;
- allowed installation count;
- allowed repo count;
- token provider kind;
- legacy token fallback status.

The dashboard GitHub App section shows runtime config, installations, repository grants, token readiness, recent sanitized GitHub App audit events, legacy fallback warning, and production blockers.

## Integration Test Setup

Default tests use `MockGitHubAppTokenProvider` and fixture GitHub clients. GitHub App integration-test profile v1 adds a read-only profile under `/readiness/github-app-integration/*` and `/dashboard/github-app-integration` so CI/staging can see whether live tests could run safely.

Live GitHub App tests still skip unless every required gate is configured, including `AICHESTRA_GITHUB_APP_INTEGRATION_TESTS=true`, GitHub App auth mode, app id metadata, private-key SecretRef metadata, installation and repo allowlists, `AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX=ai/`, branch/PR gates, and `AICHESTRA_ALLOW_REMOTE_MERGE=false`. No default test calls GitHub, signs a JWT, reads a private key value, auto-merges, force-pushes, or deletes branches.

## Known Limitations

- GitHub App installation discovery is not implemented.
- Installation-token exchange is not implemented.
- Token handles are mock metadata, not usable provider credentials.
- Private keys require a future real secret backend and signing boundary.
- Repository grants are derived from env allowlists, not live GitHub App permission state.
- Production webhooks still require durable replay storage, queue/dead-letter workers, rate limits, alerting, tenant scoping, and production endpoint rollout.
- Production Auth/RBAC, secret backend, policy bundle runtime, audit export, and production DB operations remain blockers.

## Recommended Next Task

Vault Integration-Test Profile v1 is implemented as a skipped-by-default readiness surface. Next recommended task: Staging Deployment Execution Plan v0, or Staging Release Candidate Audit rerun if Vault integration profile readiness should be included in RC evidence.
