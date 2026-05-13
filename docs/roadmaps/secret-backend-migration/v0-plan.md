# Secret Backend Migration Planning v0 Plan

Status: planned for implementation in this task.

Canonical location: `docs/roadmaps/secret-backend-migration/`. `docs/README.md` keeps cross-cutting production readiness and future integration work under `docs/roadmaps/`, while the existing production readiness stub remains at `docs/roadmaps/production-deployment-readiness/secret-backend-migration-v0.md`.

## Current SecretRef-backed Provider Credentials v1 behavior

- `SecretRef` records are metadata-only references. They include provider, kind, scope, status, owner, and provider metadata, but never raw values.
- `SecretScope`, `SecretLease`, `CredentialHandle`, `CredentialManager`, `TokenResolver`, provider credential policies, and credential audit records exist under the `packages/security` boundary.
- GitHub token, GitHub webhook secret, LLM API key, and generic provider API key credentials can be represented by SecretRefs.
- SecretRef-backed credentials are preferred over legacy env values where Real Git Adapter v2 and LLM Gateway v2 support them.
- SecretRef-backed Provider Credentials v1 does not include Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, BYOK, OAuth, WIF/IAM, cloud identity exchange, credential issuance, or production rotation.

## Current EnvSecretProvider behavior

- `EnvSecretProvider` is disabled by default and requires `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true`.
- It reads only explicitly requested env keys that are listed in `AICHESTRA_ALLOWED_SECRET_ENV_KEYS`.
- It does not enumerate environment variables and does not return values through DTOs, dashboard read models, health responses, or audit responses.
- It exists for local and controlled integration usage only. It is not sufficient for production because it lacks backend-native audit, rotation, leasing, versioning, revocation, and high-availability controls.

## Current CredentialManager / TokenResolver behavior

- Credential resolution is metadata-first and guarded by Auth/RBAC planning checks and Policy-as-code decisions.
- Resolution audit records status, purpose, actor, scope, provider, credential kind, and denied/allowed outcomes without exposing secret values.
- Token and credential handles must remain preview-limited and secret-free. Provider cache paths, token values, webhook secrets, API keys, and raw credential payloads must not be stored.
- Legacy env fallbacks remain compatibility paths for gated GitHub and LLM integrations, but production plans must deprecate those fallbacks.

## Current Auth/RBAC and Policy integration

- Auth/RBAC is Production Auth/RBAC Planning v0: mock-first, provider-neutral, and not production identity.
- Roles, permissions, service accounts, request contexts, and audit events are modeled, but there is no real OIDC, SAML, SCIM, session, API key, password, or token issuance.
- Policy-as-code v0 is static TypeScript rules. It denies secret reads and broad provider credential resolution by default unless explicit local/mock gates are satisfied.
- Future secret backend migration must not bypass policy, mock RBAC boundaries, sandbox controls, Git gates, LLM gates, MCP gates, Local Agent gates, runner gates, dashboard read-only behavior, or observability redaction.

## Current Secrets/Sandbox status

- Secrets/Sandbox Design v0 is metadata-only.
- Future secret manager placeholders exist for Vault, AWS Secrets Manager, GCP Secret Manager, and Azure Key Vault, but they throw or remain unimplemented and do not connect.
- Sandbox and network egress controls are modeled only; no production sandbox runtime or secret injection into runner, MCP, Local Agent, or provider processes is implemented.
- Redaction and audit rules already require no raw secrets, no provider tokens, no credential cache contents, and no raw prompt/output leakage.

## Current GitHub / webhook / LLM credential usage

- Real Git Adapter v2 can use SecretRef-backed GitHub token and webhook secret resolution behind explicit gates and allowlists.
- Legacy `AICHESTRA_GITHUB_TOKEN` and `AICHESTRA_GITHUB_WEBHOOK_SECRET` remain gated fallback paths, not production-ready defaults.
- GitHub App / Production Webhook Hardening Planning v0 documents future GitHub App private key and webhook secret SecretRefs, but does not implement signing or installation token exchange.
- LLM Gateway v2 can use `AICHESTRA_LLM_API_KEY_SECRET_REF` or gated legacy `AICHESTRA_LLM_API_KEY` for a controlled OpenAI-compatible path. It does not implement BYOK, OAuth, WIF/IAM, provider credential cache reads, or other provider-specific live credentials.
- MCP Gateway v0 and Local Agent Protocol v1 are mock-first and must not receive real secret leases in this planning task.

## Current production blockers

- No real secret backend is selected or integrated.
- No production lease TTL policy is enforced by a backend.
- No production rotation, revocation, emergency rotation, or stale credential detection workflow exists.
- No backend-native audit export exists.
- No production identity service account model exists for backend access.
- Production env fallback rejection is documented but not enforced as a production runtime control.
- GitHub App credentials, webhook secrets, LLM provider API keys, future MCP credentials, future Local Agent pairing secrets, future OAuth tokens, future cloud identity, and future BYOK remain planning-only.

## Proposed target secret backend options

- Vault: strong lease and dynamic secret model, operationally complex, recommended for teams already operating Vault or requiring dynamic credentials.
- AWS Secrets Manager: strong AWS-native operational fit and rotation hooks, recommended for AWS-centric deployments.
- GCP Secret Manager: strong GCP-native operational fit with IAM and versioning, recommended for GCP-centric deployments.
- Azure Key Vault: strong Azure-native operational fit with managed identity, recommended for Azure-centric deployments.
- Custom enterprise secret backend: future option behind the same SecretManager/CredentialManager contracts.
- Env provider: legacy fallback for local and tightly controlled integration only; not recommended for staging or production.
- Mock provider: deterministic tests and local demos only.

The default production recommendation remains environment-dependent until the target deployment platform, identity provider, and operations ownership are selected.

## Proposed migration phases

1. Inventory current SecretRefs, legacy env fallbacks, credential kinds, call sites, and audit coverage.
2. Select backend per deployment profile and define provider identifiers, SecretRef metadata, backend access identity, and policy requirements.
3. Migrate GitHub token, GitHub webhook secret, and LLM API key references from legacy env fallback to backend-backed SecretRefs.
4. Add rotation, revocation, stale credential detection, and emergency runbook controls before production traffic.
5. Migrate future GitHub App private key, provider API keys, MCP tool secrets, Local Agent pairing secrets, service account signing keys, OAuth/cloud identity, and BYOK only after explicit future implementation tasks.
6. Disable env fallback in staging and production profiles after parity validation, rollback planning, and audit coverage are complete.

## Proposed readiness models

- `SecretBackendOption`: compares future backend kinds and production suitability.
- `SecretBackendMigrationPhase`: records phased migration scope, preconditions, validation checks, rollback plan, and status.
- `SecretBackendReadinessCheck`: records readiness by backend selection, SecretRef schema, lease TTL, rotation, audit, auth/policy, env fallback, provider integration, dashboard, observability, and incident response.
- `SecretBackendRisk`: records migration and operations risks.
- `SecretRotationPlan`: records rotation mode, interval target, validation checks, rollback plan, and audit requirements for each secret kind.
- `SecretLeasePolicy`: records TTL, renewability, approval, actor, and purpose expectations for each secret kind.

These are planning/read-model objects only.

## What this task implements

- Secret Backend Migration Planning v0 roadmap and supporting documents.
- Read-only deterministic planning models and seed data in the deployment readiness package.
- Read-only DTO mappers and API endpoints under `/readiness/secrets/*`.
- Safe `/health` metadata that reports booleans/counts/status only and never env values.
- Dashboard API-backed Secret Backend Migration panel and demo fallback data.
- Observability, Auth/RBAC, Policy, Git, LLM, MCP, dashboard, environment gate, inventory, and phase audit documentation alignment.
- Deterministic tests for models, service, endpoints, dashboard, health metadata, no-secret/no-env exposure, and production env fallback blocking.

## What remains out of scope

- Real Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, or custom backend integration.
- BYOK, OAuth, device-code, WIF, IAM, or cloud identity token exchange.
- Production secret rotation jobs, credential issuance, migration of actual secret values, or backend writes.
- Reading provider credential caches, `~/.codex/auth.json`, `~/.claude`, Google credential caches, OS keychains, or vendor CLI sessions.
- Secret injection into runner, MCP, Local Agent, Git, LLM, or provider processes.
- External audit export, SIEM integration, alert delivery, or external observability calls.
- Enforcing production secret backend requirements as a live production gate.

## Validation and blocker check

No critical validation blocker was found during planning review. The repository has existing planning/readiness patterns in `packages/deployment-readiness`, `apps/api`, `apps/web`, and `packages/shared` that can support this task without live backend integration.
