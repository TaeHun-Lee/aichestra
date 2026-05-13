# Real Integration Roadmap

## Recommended Order

1. Persistent DB implementation v1 - implemented
2. Real Git Adapter v0 - implemented
3. LLM Gateway v0 - implemented
4. Local Agent Runner v0 - implemented
5. Local Agent Runner v1 - implemented
6. Policy-as-code skeleton - implemented
7. Enterprise LLM Provider Abstraction v0 - implemented
8. Secrets and sandbox design - implemented
9. Aichestra Local Agent Protocol v1 - implemented
10. Real Git Adapter v1 - implemented
11. Dashboard API-backed Read Model v0 - implemented
12. LLM Gateway v1 - implemented
13. SecretRef-backed Provider Credentials v1 - implemented
14. Real Git Adapter v2 - implemented
15. Production Auth/RBAC Planning v0 - implemented
16. LLM Gateway v2 - implemented
17. MCP Gateway v0 - implemented
18. Production Deployment Readiness Planning v0 - implemented
19. Observability / Audit Retention v0 - implemented
20. GitHub App / Production Webhook Hardening Planning v0 - implemented
21. Persistent DB Production Operations v1 - implemented
22. Secret Backend Migration Planning v0 - implemented
23. Phase 5 enterprise planning

## 1. Persistent DB Implementation v1

Implemented with `docs/features/persistent-db/v1.md`, `packages/db/src/postgres.ts`, `scripts/db/migrate.mjs`, `infra/migrations/0001_initial_aichestra_schema.sql`, and optional Postgres repository contract tests.

Goals:

- Postgres-backed repositories exist behind existing interfaces for the core durable slice.
- Deterministic in-memory repositories remain the default for tests and mock-first runtime.
- Services stay dependent on repository contracts.
- Migration execution is explicit through `pnpm db:migrate`.
- Phase 4 governance repositories remain in-memory follow-up work.

## 2. Real Git Adapter v0

Implemented with `docs/features/real-git-adapter/v0.md`, `packages/adapters/src/git/provider-factory.ts`, `packages/adapters/src/git/local-git-provider.ts`, `packages/adapters/src/git/github-git-provider.ts`, `packages/git-adapter/src/service.ts`, API routes, dashboard visibility, and tests.

Goals:

- Add a provider-neutral `GitProvider` boundary.
- Preserve deterministic `MockGitProvider` behavior.
- Add local-only fixture-safe Git inspection.
- Add a gated GitHub provider skeleton without network calls.
- Store repo/PR records and Git audit events through service/repository boundaries.
- Preserve mock/local-only default behavior.
- No automatic merge or rebase.

Follow-up: Real Git Adapter v1 now implements controlled GitHub branch/PR creation behind explicit gates. Merge/rebase remain out of scope.

## 3. LLM Gateway v0

Implemented with `docs/features/llm-gateway/v0.md`, provider-neutral interfaces, `MockLLMProvider`, an OpenAI-compatible skeleton, model catalog, virtual model keys, budget checks, usage ledger integration, audit events, API routes, dashboard visibility, and tests.

Goals:

- Keep real provider calls disabled by default.
- Preserve mock-first model completion behavior.
- Route mock completions through a central gateway.
- Record usage ledger entries for successful gateway calls.
- Keep virtual keys as internal policy objects, not provider API secrets.

Follow-up: Local Agent Runner v0, Real Git Adapter v1, Dashboard API-backed Read Model v0, LLM Gateway v1/v2, SecretRef-backed Provider Credentials v1, Real Git Adapter v2, and Production Auth/RBAC Planning v0 have been completed. Continue with MCP Gateway v0, or GitHub App / production webhook hardening planning.

## 4. Local Agent Runner v0

Implemented with `docs/features/local-agent-runner/v0.md`, provider-neutral runner interfaces, deterministic `MockAgentRunner`, disabled-by-default `LocalAgentRunner`, harness policy gates, instruction assembly, in-memory runner repositories, API routes, health metadata, dashboard visibility, and tests.

Goals:

- Keep the default runtime mock-first.
- Record runner metadata, changed files, diff summary, test output, instruction assembly, usage linkage, and audit events.
- Keep local execution disabled by default and scoped to safe fixture or controlled workspaces.
- Preserve LLM Gateway and GitProvider boundaries without real provider calls.

Recommended next step: Local Agent Runner v1, Real Git Adapter v1, Dashboard API-backed Read Model v0, and LLM Gateway v1 have since been completed.

## 5. Local Agent Runner v1

Implemented with `docs/features/local-agent-runner/v1.md`, `CommandExecutor`, `BlockedCommandExecutor`, `FixtureLocalCommandExecutor`, `LocalAgentWorkspaceManager`, command result/workspace repositories, API routes, dashboard visibility, schema skeleton updates, and tests.

Goals:

- Keep mock runner as the default.
- Keep local runner and local command execution disabled by default.
- Allow only controlled fixture command execution in explicit workspace roots.
- Enforce harness command, network, remote Git, output, file write, and secret gates.
- Capture bounded command results and workspace status.
- Preserve LLM Gateway and GitProvider boundaries.

Follow-up: Policy-as-code Skeleton v0, Secrets and Sandbox v0, Real Git Adapter v1, Dashboard API-backed Read Model v0, and LLM Gateway v1 have been completed.

## 6. Policy-as-Code Skeleton

Implemented with `docs/features/policy-as-code/v0.md`, central provider-neutral policy models, `StaticPolicyEngine`, default restrictive policy rules, policy decision audit, API routes, health metadata, dashboard visibility, and deterministic tests.

Goals:

- Centralize allow/deny/require-approval decisions for Git, LLM, Runner, Registry, and Auto-improvement boundaries.
- Keep mock Git/LLM operations allowed while denying remote provider calls by default.
- Deny runner command execution, secret reads, MCP tool calls, and improvement apply by default.
- Preserve existing budget, harness, resolver, mock RBAC, and governance gates.
- Prepare for future OPA/Rego or Cedar adapters without adding those integrations yet.

Follow-up: Secrets and Sandbox Design v0, Real Git Adapter v1, Dashboard API-backed Read Model v0, and LLM Gateway v1 have been completed.

## 7. Enterprise LLM Provider Abstraction v0

Implemented with `docs/features/enterprise-llm-provider/v0.md`, enterprise ProviderKind/Auth models, provider catalog skeletons, CredentialManager/TokenResolver interfaces, blocked ProviderAdapter skeletons, Local CLI provider templates, Aichestra Local Agent boundary models, parser/redaction utilities, policy hooks, API routes, health metadata, dashboard visibility, schema skeleton updates, and tests.

Goals:

- Classify enterprise providers as cloud API, OAuth, workload identity, cloud IAM, local CLI, or PTY fallback.
- Keep all real provider calls disabled.
- Prevent credential cache reads and raw token storage.
- Make Local CLI providers require Local Agent Protocol coordination.
- Add redaction, parser, audit, and policy hook readiness before any real provider integration.

Recommended next step: Secrets and Sandbox Design v0 and Local Agent Protocol v1 were completed after this milestone; no real daemon, provider secret, or vendor CLI work is enabled.

## 8. Secrets and Sandbox Design

Implemented with `docs/features/secrets-sandbox/v0.md`, `packages/security`, security API routes, dashboard visibility, policy action/rule updates, runner sandbox-session integration, and tests.

Goals:

- Define metadata-only secret refs, scopes, leases, and access decisions.
- Define sandbox profiles, sessions, and sandbox decisions.
- Define network egress policy and redaction policy models.
- Keep default policies deny-by-default for real secrets, network, credential resolution, and runner secret injection.
- Add security audit events, API/dashboard visibility, and deterministic tests without real secret or sandbox runtime integration.

Follow-up: Local Agent Protocol v1, Real Git Adapter v1, Dashboard API-backed Read Model v0, and LLM Gateway v1 were completed after this milestone.

## 9. Aichestra Local Agent Protocol v1

Implemented with `docs/features/local-agent-protocol/v0.md`, `docs/features/local-agent-protocol/v1.md`, `packages/llm-gateway/src/local-agent-protocol.ts`, Local Agent API routes, dashboard visibility, policy/security/provider integration, schema skeleton updates, and tests.

Goals:

- Define the user-machine Local Agent protocol boundary for future local CLI providers.
- Keep vendor CLI execution disabled until explicit consent, sandbox, redaction, network, and secret gates exist.
- Reuse `ProviderKind`, `ProviderAuth`, `SecretRef`, `SandboxProfile`, `NetworkEgressPolicy`, and policy decisions.
- Do not read or upload vendor credential caches.

Implemented constraints:

- registration, heartbeat, revocation, capabilities, sessions, mock signed channels/handshakes, capability advertisements, compatibility checks, fixture daemon simulation, invocation envelopes, consent requests/decisions, lifecycle states, normalized stdout/stderr streams/events, and protocol audit are modeled;
- `MockLocalAgentTransport` is in-memory and does not use network or execute processes;
- Enterprise local CLI provider invocation must go through protocol gates and returns `local_agent_required`, `local_agent_unavailable`, `channel_required`, `awaiting_consent`, `consent_denied`, `provider_template_incompatible`, or deterministic `mock_completed`;
- direct cloud-side `local_cli` execution, credential cache read/upload, danger-full-access, shell execution, network access, and secret forwarding remain denied by default;
- no real Local Agent daemon, WebSocket/gRPC/HTTP tunnel, PTY automation, vendor CLI execution, OAuth/device-code/WIF/IAM exchange, or provider call is implemented.

Recommended next step: Real Git Adapter v2, Production Auth/RBAC Planning v0, and LLM Gateway v2 have since been implemented. Continue with MCP Gateway v0, or GitHub App / production webhook hardening planning.

## 10. Real Git Adapter v1

Implemented with `docs/features/real-git-adapter/v1.md`, `docs/features/real-git-adapter/v1-plan.md`, `packages/adapters/src/git/github-client.ts`, gated updates to `GitHubGitProvider`, `GitIntegrationService`, API routes, policy rules, dashboard visibility, and tests.

Goals:

- Keep `MockGitProvider` as the default.
- Add controlled GitHub branch creation, PR creation, and PR changed-file reads behind explicit env gates.
- Require repo allowlists and an allowed branch prefix.
- Keep GitHub calls inside a `GitHubClient` boundary.
- Audit config validation, blocked attempts, successful branch/PR creation, changed-file reads, and blocked merge/rebase attempts.
- Keep merge, rebase, force push, branch deletion, webhooks, GitHub App installation, GitLab, and Bitbucket out of scope.

Recommended next step: LLM Gateway v1/v2, SecretRef-backed Provider Credentials v1, Real Git Adapter v2, and Production Auth/RBAC Planning v0 have been completed. Continue with MCP Gateway v0, or GitHub App / production webhook hardening planning.

## 11. Dashboard API-backed Read Model v0

Implemented with `docs/features/dashboard/v0.md`, `docs/features/dashboard/v0-plan.md`, shared read-model DTOs in `packages/shared`, `apps/api/src/dashboard-read-model.ts`, `/dashboard/*` API routes, `ApiDashboardDataProvider`, `DemoDashboardDataProvider`, dashboard rendering updates, inventory docs, and tests.

Goals:

- Move dashboard runtime data consumption toward API-backed read models.
- Keep deterministic demo fallback for static tests/offline rendering.
- Expose Task, Git, Conflict Manager, Registry, LLM, Agent Runner, Policy, Enterprise Provider, Security, Local Agent, and Audit sections through read-only API DTOs.
- Avoid workflow execution, provider calls, GitHub calls, LLM calls, runner commands, secret leases, and credential-cache reads from dashboard read endpoints.
- Sanitize read-model output and avoid exposing secrets or raw tokens.

Recommended next step: LLM Gateway v1/v2, SecretRef-backed Provider Credentials v1, Real Git Adapter v2, and Production Auth/RBAC Planning v0 have been completed. Continue with MCP Gateway v0, or GitHub App / production webhook hardening planning.

## 12. LLM Gateway v1

Implemented with `docs/features/llm-gateway/v1.md`, `docs/features/llm-gateway/v1-plan.md`, gated updates to `OpenAICompatibleLLMProvider`, policy rules, health/dashboard read models, API behavior, and tests.

Goals:

- Keep `MockLLMProvider` as the default.
- Add one controlled OpenAI-compatible HTTP chat-completion path.
- Require explicit remote LLM gates, API key presence, base URL presence, model allowlists when configured, budget checks, virtual model key allowance, and policy allow decisions.
- Keep HTTP code isolated inside the provider boundary.
- Record remote usage ledger entries only on success.
- Record sanitized remote LLM audit events for request, block, completion, failure, provider error, budget block, policy block, and output redaction.
- Keep BYOK, OAuth/device-code/WIF/IAM, Local CLI execution, broad multi-provider routing, streaming, and production secret manager integration out of scope.

Recommended next step: Real Git Adapter v2, Production Auth/RBAC Planning v0, and LLM Gateway v2 have been completed. Continue with MCP Gateway v0, or GitHub App / production webhook hardening planning.

## 13. SecretRef-backed Provider Credentials v1

Implemented with `docs/foundations/secretref-provider-credentials/v1.md`, `docs/foundations/secretref-provider-credentials/v1-plan.md`, `packages/security/src/credentials.ts`, updates to `SecurityControlService`, Git and LLM provider factories, API routes, health/dashboard read models, policy rules, redaction, and tests.

Goals:

- Keep all provider credentials metadata-only outside adapter boundaries.
- Add active `SecretRef` metadata for GitHub tokens, LLM API keys, provider API keys, and future credential kinds.
- Add an explicit env-only `EnvSecretProvider` that reads only requested allowlisted env keys.
- Evaluate `provider.credential.resolve`, metadata `secret.lease.request`, and metadata `secret.lease.issue` before any env read.
- Evaluate `git.credential.resolve` and `llm.credential.resolve` for purpose-specific credential checks.
- Use Production Auth/RBAC v0 `AuthorizationService` where available so unauthorized actors are denied before env reads.
- Route GitHub and OpenAI-compatible credentials through `SecurityControlService` when `*_SECRET_REF` config is present.
- Route GitHub webhook secrets through `SecurityControlService` when `AICHESTRA_GITHUB_WEBHOOK_SECRET_REF` is present.
- Keep legacy env fallback for compatibility when no SecretRef is configured.
- Expose credential refs, resolve checks, audit, health, and dashboard status without returning values.
- Keep Vault/cloud secret managers, BYOK, OAuth/device-code/WIF/IAM, credential cache reads, vendor CLIs, runner secret injection, and Local Agent secret forwarding out of scope.

Recommended next step: Real Git Adapter v2, Production Auth/RBAC Planning v0, and LLM Gateway v2 have been completed. Continue with MCP Gateway v0, or GitHub App / production webhook hardening planning.

## 14. Real Git Adapter v2

Implemented with `docs/features/real-git-adapter/v2.md`, `docs/features/real-git-adapter/v2-plan.md`, `packages/adapters/src/git/github-webhooks.ts`, `packages/git-adapter/src/webhooks.ts`, persistent webhook/sync repositories, API routes, policy rules, health/dashboard visibility, and tests.

Goals:

- Keep webhook handling disabled by default.
- Verify GitHub webhook signatures through a safe interface before processing.
- Process `ping`, selected `pull_request` actions, and safe branch metadata from `push`.
- Store webhook event metadata, verification results, PR sync states, branch sync states, and webhook audit events durably.
- Refresh changed files only through the existing gated `GitHubClient` boundary.
- Update merge queue risk inputs non-destructively where branch lease mappings exist.
- Keep automatic merge, rebase push, force push, branch deletion, GitHub App installation, GitLab, and Bitbucket out of scope.

Recommended next step: Production Auth/RBAC Planning v0 and LLM Gateway v2 have been completed. Continue with MCP Gateway v0, or GitHub App / production webhook hardening planning.

## 15. Production Auth/RBAC Planning v0

Implemented with `docs/foundations/auth-rbac/v0.md`, `docs/foundations/auth-rbac/v0-plan.md`, `packages/auth`, policy subject updates, API routes, health/dashboard visibility, and deterministic tests.

Goals:

- Define provider-neutral principal, actor, team, role, permission, resource scope, role binding, service account, identity provider, auth context, request context, and auth audit models.
- Keep `MockAuthProvider` as the default and mark it clearly as non-production auth.
- Add disabled future OIDC, SAML, SCIM, and service-account provider placeholders without network calls.
- Add `AuthorizationService` to bridge RBAC and Policy-as-code.
- Map auth context into richer `PolicySubject` metadata.
- Add `/auth/*` read-model endpoints and a gated authorization check endpoint.
- Expose auth mode/current actor through health and dashboard without secrets or tokens.
- Keep real SSO, OAuth login, SAML, OIDC, SCIM, production sessions, password login, and API-key issuance out of scope.

Recommended next step: LLM Gateway v2 multi-provider routing has been completed. Continue with MCP Gateway v0, or GitHub App / production webhook hardening planning.

## 16. LLM Gateway v2

Implemented with `docs/features/llm-gateway/v2.md`, `docs/features/llm-gateway/v2-plan.md`, route/fallback/routing-decision repositories in `packages/llm-gateway/src/routing.ts`, provider skeletons, router integration in `LLMGatewayService`, policy/auth updates, API routes, health/dashboard visibility, and tests.

Goals:

- Keep `MockLLMProvider` as the default.
- Add provider-aware route selection with capability and prompt-class matching.
- Add bounded fallback policy that is disabled by default.
- Preserve the v1 OpenAI-compatible remote path behind all explicit gates.
- Add disabled skeleton routes for Anthropic, Gemini, Bedrock, Vertex, Azure, LiteLLM, and Local CLI provider kinds.
- Keep local CLI routes as `local_agent_required`, not direct execution.
- Record routing decisions and fallback attempts with sanitized audit and usage attribution.
- Enforce Auth/RBAC, Policy-as-code, SecretRef, model allowlist, provider allowlist, and budget gates before provider calls.

Recommended next step: MCP Gateway v0, or GitHub App / production webhook hardening planning.

## 17. MCP Gateway v0

Implemented with `docs/features/mcp-gateway/v0.md`, `docs/features/mcp-gateway/v0-plan.md`, `packages/mcp-gateway`, policy/auth updates, API routes, health/dashboard visibility, schema skeleton updates, and tests.

Goals:

- Define MCP server and tool catalog models.
- Keep `MockMCPGateway` as the default.
- Add disabled real MCP transport skeletons only.
- Allow deterministic low-risk read-only mock tool invocation when Auth/RBAC and Policy permit.
- Deny high-risk, critical, secret, network, write, deploy, real transport, and unknown tool paths by default.
- Apply redaction to input/output/audit previews.
- Expose `/mcp/*`, `/health`, and `/dashboard/mcp` visibility without secrets or raw output.

Recommended next step: Production deployment readiness, observability/audit, GitHub App hardening planning, Persistent DB Production Operations v1, and Secret Backend Migration Planning v0 have been completed. Continue with Production Auth/RBAC v1 planning, or GitHub App controlled implementation v1.

## 18. Production Deployment Readiness Planning v0

Implemented with `docs/roadmaps/production-deployment-readiness/`, `docs/reference/runtime-component-inventory.md`, `docs/reference/environment-gate-matrix.md`, `packages/deployment-readiness`, read-only `/readiness/deployment/*` API endpoints, `/dashboard/readiness`, and deterministic tests.

Goals:

- Document production deployment topology options for local, integration, staging, and production profiles.
- Inventory runtime components, environment gates, production blockers, operational gaps, and critical risks.
- Add read-only deployment profile, readiness check, and production risk models.
- Expose planning-only readiness API/dashboard read models without external calls or secrets.
- Keep production deployment, infrastructure manifests, real auth, real secret backends, real MCP transport, real provider calls, and vendor CLI execution out of scope.

Recommended next step: Observability / Audit Retention v0, GitHub App / production webhook hardening planning, Persistent DB Production Operations v1, and Secret Backend Migration Planning v0 have been completed. Continue with Production Auth/RBAC v1 planning, or GitHub App controlled implementation v1.

## 19. Observability / Audit Retention v0

Implemented with `docs/foundations/observability-audit-retention/v0.md`, `docs/foundations/observability-audit-retention/v0-plan.md`, `docs/reference/audit-source-inventory.md`, `packages/observability`, read-only `/observability/*` API endpoints, `/dashboard/observability`, and deterministic tests.

Goals:

- Define a provider-neutral common audit taxonomy and `AuditEventEnvelope`.
- Normalize existing module audit sources into a shared read model where practical.
- Add retention and redaction class models plus read-only retention policies.
- Add audit sanitizer coverage for API keys, GitHub tokens, webhook secrets, bearer tokens, JWT-like strings, env dumps, credential cache paths, raw prompts/tool input, and large metadata.
- Add metric and trace skeleton read models without external exporters.
- Surface observability/audit state in API health and dashboard read models.
- Keep external observability backends, alert delivery, audit export, and retention deletion jobs out of scope.

Recommended next step: GitHub App / production webhook hardening planning, Persistent DB Production Operations v1, and Secret Backend Migration Planning v0 have been completed. Continue with Production Auth/RBAC v1 planning, or GitHub App controlled implementation v1.

## 20. GitHub App / Production Webhook Hardening Planning v0

Implemented with `docs/roadmaps/github-app-production-webhook-hardening/v0.md`, `docs/reference/github-app-permission-matrix.md`, `docs/reference/github-webhook-event-allowlist.md`, deterministic planning/readiness models in `packages/deployment-readiness`, read-only `/readiness/github-app/*` API endpoints, `/dashboard/github-app`, dashboard rendering, planned GitHub webhook metric definitions, and tests.

Goals:

- Define the future GitHub App target architecture without implementing live GitHub App behavior.
- Document least-privilege permissions, denying workflows, administration, secrets, and deployments by default.
- Document webhook event allowlist behavior and read-model-only side effects.
- Model replay classification, retry/dead-letter readiness, credential readiness, production endpoint readiness, blockers, and production risks.
- Keep default runtime mock-first with no GitHub calls, no private key reads, no JWT signing, no installation token exchange, no production webhooks, and no destructive Git operations.

Recommended next step: Persistent DB Production Operations v1 and Secret Backend Migration Planning v0 are implemented. Continue with Production Auth/RBAC v1 planning, or GitHub App controlled implementation v1 if secret backend planning is sufficiently mature.

## 21. Persistent DB Production Operations v1

Implemented with `docs/roadmaps/persistent-db-production-operations/v1.md`, supporting runbooks, deterministic database operations readiness models in `packages/deployment-readiness`, read-only `/readiness/database/*` API endpoints, `/dashboard/database`, safe `/health` database operations metadata, and tests.

Goals:

- Define production DB operations without provisioning or connecting to production databases.
- Surface migration file metadata and checksums without executing migrations.
- Plan connection pooling, migration governance, backup/restore, index review, retention/audit growth, and webhook replay/dead-letter persistence.
- Keep DB operations non-destructive: no deletion jobs, no backup/restore jobs, no live partition jobs, no automatic migrations, and no DB URL exposure.
- Keep default runtime in-memory/mock-first and optional Postgres tests gated by `AICHESTRA_TEST_DATABASE_URL`.

Recommended next step: Secret Backend Migration Planning v0 is implemented. Continue with Production Auth/RBAC v1 planning, or GitHub App controlled implementation v1 if secret backend planning is sufficiently mature.

## 22. Secret Backend Migration Planning v0

Implemented with `docs/roadmaps/secret-backend-migration/v0.md`, backend option comparison, SecretRef provider migration, credential kind migration, lease/rotation strategy, env fallback deprecation plan, deterministic secret backend readiness models in `packages/deployment-readiness`, read-only `/readiness/secrets/*` API endpoints, `/dashboard/secret-backend`, safe `/health` secret backend metadata, and tests.

Goals:

- Compare Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, custom future backends, env legacy fallback, and mock behavior.
- Define SecretRef migration from env fallback to a selected real backend without moving actual secret values.
- Plan credential migration for GitHub, webhook, LLM, provider API, MCP, Local Agent, OAuth/cloud identity, service account signing, and future BYOK credentials.
- Model lease TTL, rotation, revocation, env fallback deprecation, readiness checks, and production risks.
- Keep runtime read-only and mock-first: no real secret backend calls, no rotation jobs, no credential issuance, no cache reads, and no env value exposure.

Recommended next step: Production Auth/RBAC v1 planning, or GitHub App controlled implementation v1 if secret backend planning is sufficiently mature.

## 23. Phase 5 Enterprise Planning

Goals:

- SSO and SCIM.
- Audit export.
- Data residency.
- Signed artifacts.
- Real artifact registry.
- Production RBAC.
- Deployment and operational controls.
