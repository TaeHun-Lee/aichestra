# SecretRef-backed Provider Credentials v1 Plan

## Canonical Path

`docs/README.md` places foundation/security architecture under `docs/foundations/`. The canonical path for this milestone is therefore `docs/foundations/secretref-provider-credentials/`, with this plan next to `v1.md`.

## Current Git Credential Handling

Real Git Adapter v2 keeps `MockGitProvider` as the default. GitHub branch, pull request, changed-file refresh, webhook verification, and PR/branch sync are controlled exceptions behind explicit provider, remote-operation, repo allowlist, branch-prefix, webhook, signature, and policy gates. Preferred GitHub token configuration is `AICHESTRA_GITHUB_TOKEN_SECRET_REF`; legacy `AICHESTRA_GITHUB_TOKEN` remains a compatibility fallback when no SecretRef is configured. Merge, rebase, force push, branch deletion, and GitHub App installation remain out of scope.

## Current LLM Credential Handling

LLM Gateway v1 keeps `MockLLMProvider` as the default. The only real provider path is OpenAI-compatible chat completion behind explicit remote LLM gates, base URL, model allowlist/default model, virtual-key budget, policy, and credential gates. Preferred API-key configuration is `AICHESTRA_LLM_API_KEY_SECRET_REF`; legacy `AICHESTRA_LLM_API_KEY` remains a compatibility fallback when no SecretRef is configured.

## Current Webhook Secret Handling

Real Git Adapter v2 supports GitHub webhook verification through `GitHubWebhookVerifier`. The preferred webhook secret path is `AICHESTRA_GITHUB_WEBHOOK_SECRET_REF` with `secretKind=github_webhook_secret` or `webhook_secret`; legacy `AICHESTRA_GITHUB_WEBHOOK_SECRET` remains a gated fallback. Webhooks are disabled unless `AICHESTRA_ENABLE_GITHUB_WEBHOOKS=true`, and unverified payloads are rejected by default.

## Current Secrets/Sandbox Models

Secrets/Sandbox v0 already defines metadata-only `SecretRef`, `SecretScope`, `SecretLease`, `SecretAccessDecision`, security audit events, redaction policies, and `SecurityControlService`. SecretRef-backed Provider Credentials v1 extends this with env-backed provider credential resolution, metadata-only credential handles, no-secret DTOs, and explicit redaction.

## Current Enterprise Provider Credential Models

Enterprise Provider Abstraction v0 models API-key auth as env key or `secretRef` references only. Local CLI providers use `external_cli_session` with `credentialAccess=never_read_tokens`, and credential-cache reads remain denied. Provider adapter skeletons do not perform real cloud API calls.

## Current Auth/RBAC And Policy Context

Production Auth/RBAC Planning v0 provides `Principal`, `Actor`, `Role`, `Permission`, `RoleBinding`, `ServiceAccount`, `AuthContext`, `RequestContextResolver`, `MockAuthProvider`, and `AuthorizationService`. Credential resolution must carry actor/principal metadata where available, deny unauthorized actors before any env read, then keep Policy-as-code authoritative for provider, Git, LLM, and lease decisions.

## Gaps Addressed In This Pass

- Route credential resolution through `AuthorizationService` when available.
- Pass AuthContext-derived policy subjects to credential policy checks.
- Add purpose-specific policy actions for `git.credential.resolve` and `llm.credential.resolve`.
- Represent GitHub webhook secrets as explicit SecretRef-backed credential metadata.
- Report webhook-secret configured status through health/dashboard security read models.
- Extend redaction for webhook secret env dumps and generic token/secret/password env dumps.

## Proposed Resolution Flow

```text
Git / LLM / Webhook / Provider metadata
  -> explicit AuthContext or mock system context
  -> AuthorizationService provider.credential.resolve check
  -> purpose-specific PolicyEngine check
  -> provider.credential.resolve PolicyEngine check
  -> metadata SecretLease request/issue policy checks
  -> EnvSecretProvider single-key lookup
  -> transient adapter-only raw value
  -> sanitized audit/redaction and metadata-only DTOs
```

`CredentialResolutionResult` never includes raw values. `resolveCredentialForInternalUse` is the only adapter-boundary method that can carry a transient value.

## EnvSecretProvider Design

`EnvSecretProvider` remains disabled by default. It requires:

- `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true`;
- an active `SecretRef` with `provider=env`;
- an `envKey` reference on that SecretRef;
- optional `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` containing that exact key.

It reads only the requested env key, never enumerates environment variables, and returns deterministic blocked/missing/denied results for disabled provider, missing env values, disabled/revoked refs, and non-allowlisted keys.

## AuthorizationService Integration

Credential resolution uses the API/request `AuthContext` when supplied, or an explicit mock system context for internal service operations. Viewers and developers cannot resolve provider credentials directly. Security/platform/system mock actors may pass RBAC only when PolicyEngine also allows the configured SecretRef flow. Authorization denials are audited before env access.

## PolicyEngine Integration

Policy checks cover:

- `provider.credential.resolve`;
- `git.credential.resolve`;
- `llm.credential.resolve`;
- `secret.lease.request`;
- `secret.lease.issue`;
- `secret.read`;
- `git.remote_operation`;
- `git.webhook.verify`;
- `llm.remote_completion`;
- `provider.invoke`;
- credential cache read/upload, runner secret injection, and Local Agent secret forwarding denials.

Policy denial blocks credential resolution before any env read, even if RBAC allows.

## Audit And Redaction Requirements

Audit events record credential ref lifecycle, authorization denial, policy denial, allow/missing/revoked outcomes, env provider disabled/non-allowlisted outcomes, metadata-only lease issue, and redaction. Audit metadata may include actor id, principal id, auth mode, task/run id, provider id, SecretRef id, purpose, policy decision id, authorization decision id, and sanitized status fields.

Audit, API, health, dashboard, and DTOs must never include raw secrets, GitHub tokens, webhook secrets, API keys, bearer tokens, env var values, credential-cache contents, raw prompts, or unredacted provider output.

## API, Health, And Dashboard Changes

Security credential endpoints remain:

- `GET /security/credentials/refs`
- `POST /security/credentials/refs`
- `PATCH /security/credentials/refs/:id/status`
- `POST /security/credentials/resolve/check`
- `GET /security/credentials/audit`

`resolve/check` returns status only and uses the resolved request actor instead of trusting a body actor override. Health/dashboard report credential manager kind, env secret provider enabled, active SecretRef count, GitHub token configured status, GitHub webhook secret configured status, LLM credential configured status, recent credential audit events, and blocked cache examples.

## Out Of Scope

Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, BYOK, OAuth, device-code, WIF, IAM, production rotation, production credential issuance, credential cache reads/uploads, vendor CLIs, runner secret injection, Local Agent secret forwarding, MCP, Kubernetes, Temporal, artifact registries, real SSO, production sessions, and production-ready secret management remain out of scope.
