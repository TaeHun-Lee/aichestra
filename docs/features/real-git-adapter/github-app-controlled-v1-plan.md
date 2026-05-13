# GitHub App Controlled Implementation v1 Plan

Status: pre-implementation plan for a controlled, gated runtime boundary. Canonical location follows `docs/README.md`: feature implementation docs for the Git provider live under `docs/features/real-git-adapter/`.

## Current Real Git Adapter v2 Behavior

- `MockGitProvider` remains the default provider.
- `GitHubGitProvider` supports branch creation, PR creation, connection validation, and PR changed-file reads only through `GitHubClient`.
- Remote Git requires explicit gates: `AICHESTRA_GIT_PROVIDER=github`, `AICHESTRA_ENABLE_REMOTE_GIT=true`, operation-specific branch/PR gates, repo allowlist, allowed branch prefix, credential availability, and policy allow decisions.
- GitHub webhook handling is disabled by default and requires signature verification plus webhook secret configuration.
- Merge, rebase, force push, branch deletion, workflow/admin/secrets/deployment permissions, GitLab, and Bitbucket are not implemented.

## Current Token / Env GitHub Credential Behavior

- Legacy token mode uses `AICHESTRA_GITHUB_TOKEN_SECRET_REF` where configured.
- If no GitHub token SecretRef exists, `AICHESTRA_GITHUB_TOKEN` can act as a gated legacy fallback.
- SecretRef-backed resolution happens through `SecurityControlService` before adapter use.
- Legacy env fallback is audited as metadata only.
- API, health, dashboard, Git audit, and policy audit do not expose token values.

## Current SecretRef Credential Behavior

- `SecretRef` is metadata-only and supports active/disabled/revoked states.
- `EnvSecretProvider` is explicit and allowlisted; it never enumerates environment variables.
- Credential resolution flows through Auth/RBAC, purpose-specific Policy-as-code, provider credential policy, metadata lease policy, env provider lookup, and sanitized audit.
- GitHub token, GitHub webhook secret, and LLM API key SecretRefs exist today.
- GitHub App private-key SecretRef is planned but not yet a runtime kind.

## Current GitHub App Planning Docs

- `docs/roadmaps/github-app-production-webhook-hardening/v0.md` defines target GitHub App and webhook hardening architecture.
- `docs/reference/github-app-permission-matrix.md` defines least-privilege permissions and denies workflow/admin/secrets/deployments by default.
- `docs/reference/github-webhook-event-allowlist.md` defines read-model-only webhook events.
- `docs/roadmaps/github-app-production-webhook-hardening/github-app-credentials-v0.md` requires GitHub App private keys and webhook secrets to be SecretRef-backed and never exposed.

## Proposed Runtime Model

v1 adds runtime/read-model objects without production rollout:

- `GitHubAppRuntimeConfig`: auth mode, app id/slug metadata, private-key SecretRef id, webhook SecretRef id, allowlisted installations/repos, branch prefix, permission/event metadata, and safe status booleans.
- `GitHubAppInstallationState`: deterministic installation state derived from allowlisted installation ids.
- `GitHubAppRepositoryGrantState`: deterministic repository grant state derived from allowlisted repos.
- `GitHubInstallationTokenRequest`: metadata-only request for an operation-scoped installation token boundary.
- `GitHubInstallationTokenResult`: status and token handle metadata only; no raw token.

## Proposed Installation Token Flow

1. Git operation remains blocked unless existing remote Git gates pass.
2. In `AICHESTRA_GITHUB_AUTH_MODE=github_app`, the Git service asks the GitHub App token provider for an operation-scoped token handle.
3. The token provider validates app config, enable gates, installation allowlist, repo grant allowlist, and active private-key SecretRef metadata.
4. Auth/RBAC and Policy-as-code must allow token issuance before the token handle is issued.
5. The mock provider returns a token handle id and expiry metadata only.
6. No private key is read for signing and no GitHub installation token exchange is performed in default runtime/tests.

## Required Environment Gates

- `AICHESTRA_GITHUB_AUTH_MODE=legacy_token | github_app` with `legacy_token` as default.
- `AICHESTRA_ENABLE_GITHUB_APP=true` for GitHub App mode.
- `AICHESTRA_GITHUB_APP_ID` for app metadata.
- `AICHESTRA_GITHUB_APP_SLUG` optional app metadata.
- `AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF` for private-key SecretRef metadata.
- `AICHESTRA_GITHUB_APP_WEBHOOK_SECRET_REF` as preferred App webhook secret ref when configured.
- `AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS` for allowed installation ids.
- `AICHESTRA_GITHUB_APP_ALLOWED_REPOS` for App repo grants.
- `AICHESTRA_GITHUB_APP_INTEGRATION_TESTS=false` by default; no live token exchange is added in v1.

Raw private-key env values are unsupported in v1.

## Required SecretRef Gates

- Add `github_app_private_key` as a metadata-only SecretRef kind.
- Add a purpose for GitHub App private-key signing metadata checks.
- Token handle issuance checks active SecretRef metadata and blocks missing/disabled/revoked refs.
- v1 mock token issuance does not expose or persist private key material.

## Required Policy / Auth Checks

Auth/RBAC adds metadata permissions for:

- `github_app.configure`
- `github_app.installation.use`
- `github_app.repo_grant.use`
- `github_app.installation_token.issue`
- `git.changed_files.read`

Policy-as-code adds deny-by-default GitHub App rules:

- deny token issuance unless GitHub App mode and enable gates are configured;
- deny missing private-key SecretRef;
- deny unallowlisted installation;
- deny unallowlisted repo grant;
- allow mock token handles only when every gate passes.

Existing Git branch/PR/changed-file rules remain authoritative.

## Audit And Redaction Requirements

Add sanitized audit events for:

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

Audit metadata may include app id configured booleans, installation id, repo ref, actor id, policy decision id, authorization decision id, and token handle id. It must not include private keys, JWTs, installation tokens, webhook secrets, PATs, credential cache contents, or raw provider credentials.

## Integration Test Strategy

- Default tests use the mock token provider and fixture GitHub client only.
- Live GitHub App token exchange remains out of scope.
- Real Git/GitHub App tests are skipped unless future explicit integration gates are configured.
- Tests cover config gates, SecretRef metadata states, Auth/RBAC denial before SecretRef validation, Policy denial before handle issuance, API/dashboard/health no-secret behavior, and branch/PR/changed-file use of the mock token handle.

## What This Task Implements

- Runtime/read-model GitHub App config, installation, repo grant, token request/result models.
- Disabled and mock GitHub App token provider boundary.
- GitHub App auth-mode config gates.
- SecretRef metadata support for `github_app_private_key`.
- Auth/RBAC and Policy-as-code action catalog/rule updates.
- Git service integration for branch create, PR create, and changed-file read in GitHub App mode.
- Read-only/status-only API endpoints under `/git/github-app/*`.
- Safe `/health` and dashboard GitHub App runtime metadata.
- Documentation and deterministic tests.

## Out Of Scope

- No production GitHub App rollout.
- No GitHub App creation/installation flow.
- No private-key parsing/signing.
- No JWT issuance.
- No installation token exchange with GitHub.
- No real GitHub App HTTP calls.
- No automatic merge, rebase push, force push, branch deletion, workflow/admin/secrets/deployments permissions, GitLab, or Bitbucket.
- No LLM, MCP, Vault/cloud secret backend, Kubernetes, Temporal, artifact registry, or vendor CLI integration.
- No credential cache reads and no secret exposure.
