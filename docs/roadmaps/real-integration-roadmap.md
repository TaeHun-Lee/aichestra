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
23. Production Auth/RBAC v1 Planning - implemented
24. Policy Bundle / OPA-Cedar Planning v0 - implemented
25. GitHub App Controlled Implementation v1 - implemented
26. Staging Deployment Profile v0 - implemented
27. Staging CI/CD Pipeline Planning v0 - implemented
28. GitHub App integration-test profile v1 - implemented
29. LLM Gateway integration-test profile v1 - implemented
30. Staging Deployment Dry-run Profile v0 - implemented
31. Staging Release Candidate Checklist v0 - implemented
32. Production Secret Backend Implementation Option Decision v0 - implemented
33. Vault-backed Secret Backend v1 - implemented
34. Vault Integration-Test Profile v1 - implemented
35. Staging Deployment Execution Plan v0 - implemented
36. Staging Human Signoff Pack v0 - implemented
37. RequestContext Propagation v1 - implemented
38. API AuthContext Middleware Skeleton v1 - implemented
39. Service Account Actor Boundary v1 - implemented
40. Registry/Governance RequestContext Migration v1 - implemented
41. Tenant/Repo/Provider Scope Model v1 - implemented
42. Dashboard/Readiness Tenant Scope Planning v1 - implemented
43. Dashboard/Readiness Tenant Scope Implementation v1 - implemented
44. Tenant Scope Enforcement v1 - implemented
45. Policy Runtime Shadow Evaluation Planning v1 - implemented
46. Production Auth Provider Skeleton v1 - implemented
47. Phase 5 enterprise planning
42. Policy Bundle Runtime PoC Planning v0 - implemented
43. Policy Runtime PoC Golden Test Harness v1 - implemented
44. Policy Runtime Shadow Evaluation Planning v1 - implemented
45. Phase 5 enterprise planning

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

Follow-up: RequestContext Propagation v1 is now implemented as a mock-first attribution/correlation layer. It does not implement real auth, sessions, JWTs, API keys, service-account credentials, tenant enforcement, or production auth enablement.

## 18. Production Deployment Readiness Planning v0

Implemented with `docs/roadmaps/production-deployment-readiness/`, `docs/reference/runtime-component-inventory.md`, `docs/reference/environment-gate-matrix.md`, `packages/deployment-readiness`, read-only `/readiness/deployment/*` API endpoints, `/dashboard/readiness`, and deterministic tests.

Goals:

- Document production deployment topology options for local, integration, staging, and production profiles.
- Inventory runtime components, environment gates, production blockers, operational gaps, and critical risks.
- Add read-only deployment profile, readiness check, and production risk models.
- Expose planning-only readiness API/dashboard read models without external calls or secrets.
- Keep production deployment, infrastructure manifests, real auth, real secret backends, real MCP transport, real provider calls, and vendor CLI execution out of scope.

Follow-up: RequestContext Propagation v1 is now implemented as a mock-first attribution/correlation layer. It does not implement real auth, sessions, JWTs, API keys, service-account credentials, tenant enforcement, or production auth enablement.

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

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 20. GitHub App / Production Webhook Hardening Planning v0

Implemented with `docs/roadmaps/github-app-production-webhook-hardening/v0.md`, `docs/reference/github-app-permission-matrix.md`, `docs/reference/github-webhook-event-allowlist.md`, deterministic planning/readiness models in `packages/deployment-readiness`, read-only `/readiness/github-app/*` API endpoints, `/dashboard/github-app`, dashboard rendering, planned GitHub webhook metric definitions, and tests.

Goals:

- Define the future GitHub App target architecture without implementing live GitHub App behavior.
- Document least-privilege permissions, denying workflows, administration, secrets, and deployments by default.
- Document webhook event allowlist behavior and read-model-only side effects.
- Model replay classification, retry/dead-letter readiness, credential readiness, production endpoint readiness, blockers, and production risks.
- Keep default runtime mock-first with no GitHub calls, no private key reads, no JWT signing, no installation token exchange, no production webhooks, and no destructive Git operations.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 21. Persistent DB Production Operations v1

Implemented with `docs/roadmaps/persistent-db-production-operations/v1.md`, supporting runbooks, deterministic database operations readiness models in `packages/deployment-readiness`, read-only `/readiness/database/*` API endpoints, `/dashboard/database`, safe `/health` database operations metadata, and tests.

Goals:

- Define production DB operations without provisioning or connecting to production databases.
- Surface migration file metadata and checksums without executing migrations.
- Plan connection pooling, migration governance, backup/restore, index review, retention/audit growth, and webhook replay/dead-letter persistence.
- Keep DB operations non-destructive: no deletion jobs, no backup/restore jobs, no live partition jobs, no automatic migrations, and no DB URL exposure.
- Keep default runtime in-memory/mock-first and optional Postgres tests gated by `AICHESTRA_TEST_DATABASE_URL`.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 22. Secret Backend Migration Planning v0

Implemented with `docs/roadmaps/secret-backend-migration/v0.md`, backend option comparison, SecretRef provider migration, credential kind migration, lease/rotation strategy, env fallback deprecation plan, deterministic secret backend readiness models in `packages/deployment-readiness`, read-only `/readiness/secrets/*` API endpoints, `/dashboard/secret-backend`, safe `/health` secret backend metadata, and tests.

Goals:

- Compare Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, custom future backends, env legacy fallback, and mock behavior.
- Define SecretRef migration from env fallback to a selected real backend without moving actual secret values.
- Plan credential migration for GitHub, webhook, LLM, provider API, MCP, Local Agent, OAuth/cloud identity, service account signing, and future BYOK credentials.
- Model lease TTL, rotation, revocation, env fallback deprecation, readiness checks, and production risks.
- Keep runtime read-only and mock-first: no real secret backend calls, no rotation jobs, no credential issuance, no cache reads, and no env value exposure.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 23. Production Auth/RBAC v1 Planning

Implemented with `docs/foundations/auth-rbac/v1-plan.md`, `docs/roadmaps/auth-rbac-production/v1.md`, `docs/reference/production-rbac-permission-matrix.md`, deterministic auth production readiness models in `packages/deployment-readiness`, read-only `/readiness/auth/*` API endpoints, `/dashboard/auth-production`, safe `/health` auth readiness metadata, dashboard rendering, and tests.

Goals:

- Compare OIDC, SAML, SCIM, Microsoft Entra ID, Okta, Auth0, Google Workspace, GitHub Enterprise identity mapping, custom enterprise IdP, and mock provider options without calling IdPs.
- Define production roles, permissions, allowed actions, denied actions, scopes, audit requirements, and future work.
- Plan tenant/workspace/project/team/repo scoping across repositories, policy subjects, provider access, SecretRefs, audit queries, and dashboard read models.
- Plan scoped service accounts and system actors for worker, Git webhook/provider, LLM Gateway, MCP Gateway, Local Agent Protocol, deployment, and observability export.
- Plan request context propagation and mock actor deprecation.
- Keep runtime read-only and mock-first: no real OIDC/SAML/SCIM/SSO, no login/logout/session/JWT/password behavior, no external IdP calls, no service-account credential issuance, no tenant isolation enforcement, and no token/cookie/session/assertion exposure.

Follow-up: RequestContext Propagation v1 is now implemented as a mock-first attribution/correlation layer. It does not implement real auth, sessions, JWTs, API keys, service-account credentials, tenant enforcement, or production auth enablement.

## 24. Policy Bundle / OPA-Cedar Planning v0

Implemented with `docs/roadmaps/policy-bundle-opa-cedar/v0.md`, engine option comparison, policy bundle schema plan, `docs/reference/policy-domain-mapping.md`, review workflow, test strategy, rollout/rollback strategy, break-glass plan, deterministic policy bundle readiness models in `packages/deployment-readiness`, read-only `/readiness/policy-bundles/*` API endpoints, `/dashboard/policy-bundles`, safe `/health` policy bundle metadata, dashboard rendering, and tests.

Goals:

- Compare current static TypeScript rules, OPA/Rego, Cedar, signed JSON/YAML bundles, and custom future policy services.
- Define future policy bundle models, versioning, review, tests, rollout/rollback, and break-glass planning.
- Map current Git, Git webhook, LLM, MCP, Runner, Registry, Improvement, SecretRef, Secrets/Sandbox, Provider, Local Agent, Auth, Dashboard, and Deployment Readiness policy domains.
- Keep `StaticPolicyEngine` as the only runtime.
- Keep runtime read-only and mock-first: no OPA/Cedar execution, no external policy decision service, no dynamic policy code, no remote bundle loading, no hot reload, no signed bundle verification, no production rollout, and no break-glass execution.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 25. GitHub App Controlled Implementation v1

Implemented with `docs/features/real-git-adapter/github-app-controlled-v1.md`, `docs/features/real-git-adapter/github-app-controlled-v1-plan.md`, `packages/adapters/src/git/github-app.ts`, `packages/git-adapter/src/github-app.ts`, Git provider factory updates, Git service integration, API routes, health/dashboard visibility, Auth/RBAC catalog updates, Policy-as-code rules, SecretRef metadata support, and tests.

Goals:

- Keep legacy token mode as the default and preserve existing SecretRef-backed token behavior.
- Add controlled GitHub App auth mode behind explicit gates.
- Model app runtime config, installation state, repository grants, token requests, and token results without live GitHub discovery.
- Add disabled and mock GitHub App token providers.
- Require Auth/RBAC, Policy-as-code, active private-key SecretRef metadata, installation allowlist, repo allowlist, branch prefix, and existing remote Git gates before issuing a mock token handle.
- Return token handle metadata only; never expose private keys, installation tokens, webhook secrets, legacy PATs, raw credentials, or credential cache contents.
- Integrate branch creation, PR creation, and changed-file reads with the token provider boundary while keeping merge, rebase, force push, branch deletion, workflow/admin/secrets/deployments permissions, GitLab, and Bitbucket out of scope.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 26. Staging Deployment Profile v0

Implemented with `docs/roadmaps/staging-deployment-profile/v0.md`, `docs/roadmaps/staging-deployment-profile/v0-plan.md`, `docs/reference/staging-environment-gate-matrix.md`, deterministic staging readiness models in `packages/deployment-readiness`, read-only `/readiness/staging/*` API endpoints, `/dashboard/staging`, safe `/health` staging metadata, dashboard rendering, and tests.

Goals:

- Define a non-production staging profile without deploying anything.
- Document required and forbidden staging env gates.
- Classify staging integrations as gated, blocked, or future.
- Surface staging readiness checks, promotion criteria, rollback criteria, blockers, warnings, mock actor warning, env fallback warning, and no-secret/no-env status.
- Keep runtime read-only and mock-first: no deployment, no infrastructure manifests, no production traffic, no external provider calls by default, no remote MCP, no vendor CLI execution, no secrets, and no env values.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 27. Staging CI/CD Pipeline Planning v0

Implemented with `docs/roadmaps/staging-ci-cd-pipeline/v0.md`, `docs/roadmaps/staging-ci-cd-pipeline/v0-plan.md`, job matrix, integration-test gate policy, secret/env safety policy, artifact/report policy, staging promotion criteria, cleanup/rollback policy, deterministic CI/CD readiness models in `packages/deployment-readiness`, read-only `/readiness/ci-cd/*` API endpoints, `/dashboard/ci-cd`, safe `/health` CI/CD metadata, dashboard rendering, and tests.

Goals:

- Define local, pull request, integration, staging, and future release-candidate CI/CD profiles without creating active workflows.
- Document required validation jobs, optional integration-test gates, secret/env safety, artifact/report handling, staging promotion, and cleanup/rollback expectations.
- Keep runtime read-only and mock-first: no deployment, no active CI workflow, no external provider calls by default, no remote Git/LLM/MCP/auth/vendor tests by default, no secrets, and no env values.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 28. GitHub App integration-test profile v1

Implemented with `docs/roadmaps/github-app-integration-test-profile/v1.md`, `docs/roadmaps/github-app-integration-test-profile/v1-plan.md`, deterministic GitHub App integration-test profile, test-case, safety-check, and summary models in `packages/deployment-readiness`, read-only `/readiness/github-app-integration/*` API endpoints, `/dashboard/github-app-integration`, safe `/health` metadata, dashboard rendering, and tests.

Goals:

- Define a controlled optional live-test profile for GitHub App config, installation-token, branch, PR, changed-file, webhook fixture, and cleanup checks.
- Keep live GitHub tests skipped unless every explicit gate, installation allowlist, repo allowlist, branch prefix, SecretRef metadata, and no-merge safety condition is configured.
- Report missing and unsafe gates as booleans, counts, statuses, and env var names only.
- Keep runtime read-only and mock-first: no GitHub calls in default tests, no installation token generation, no private-key read, no env value exposure, no auto-merge, no force-push, and no branch deletion.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 29. LLM Gateway integration-test profile v1

Implemented with `docs/roadmaps/llm-gateway-integration-test-profile/v1.md`, `docs/roadmaps/llm-gateway-integration-test-profile/v1-plan.md`, deterministic LLM integration-test profile, test-case, safety-check, and summary models in `packages/deployment-readiness`, read-only `/readiness/llm-integration/*` API endpoints, `/dashboard/llm-integration`, safe `/health` metadata, dashboard rendering, and tests.

Goals:

- Define a controlled optional live-test profile for OpenAI-compatible config, credential readiness, model allowlist, budget guard, mock completion, gated remote completion, usage ledger, audit redaction, and fallback-disabled checks.
- Keep live LLM tests skipped unless every explicit gate, model allowlist/default model, budget cap, safe prompt class, SecretRef or controlled test-only credential gate, Auth/RBAC, and Policy-as-code condition is configured.
- Report missing and unsafe gates as booleans, counts, statuses, and env var names only.
- Keep runtime read-only and mock-first: no LLM calls in default tests, no API key/env value exposure, no raw provider response exposure, no streaming, no tool calls, no vendor CLI, no credential cache reads, and no unbounded fallback.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 30. Staging Deployment Dry-run Profile v0

Implemented with `docs/roadmaps/staging-deployment-dry-run/v0.md`, `docs/roadmaps/staging-deployment-dry-run/v0-plan.md`, report format, blocker taxonomy, deterministic dry-run profile/source/check/blocker/report/summary models in `packages/deployment-readiness`, read-only `/readiness/staging-dry-run/*` API endpoints, `/dashboard/staging-dry-run`, safe `/health` metadata, dashboard rendering, and tests.

Goals:

- Aggregate staging, CI/CD, DB operations, GitHub App integration-test, LLM integration-test, Secret Backend Migration, Auth/RBAC, Policy Bundle, Observability, MCP, Git, LLM, Local Agent, Runner, and Dashboard readiness.
- Classify blockers by severity and blocking level.
- Classify integration profiles as ready, gated, skipped, blocked, or future without executing them.
- Return promotion and rollback guidance while keeping the dry-run read-only.
- Keep runtime safe: no deployment, no CI job execution, no remote integration-test execution, no provider calls, no resource mutation, no secrets, no env values, no staging-deployed claim, and no production-ready claim.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 31. Staging Release Candidate Checklist v0

Implemented with `docs/roadmaps/staging-release-candidate/v0.md`, `docs/roadmaps/staging-release-candidate/v0-plan.md`, report format, release-notes template, rollback checklist, Evidence Pack v0 plan, release-notes draft, rollback evidence, signoff readiness, deterministic checklist/gate/blocker/signoff/release-note/rollback/report/summary models in `packages/deployment-readiness`, read-only `/readiness/staging-rc/*` API endpoints, `/dashboard/staging-rc`, safe `/health` metadata, dashboard rendering, and tests.

Goals:

- Define criteria for calling a commit or branch a staging release candidate without creating a release.
- Require local validation evidence for lint, typecheck, test, build, `git diff --check`, and safe integration scan.
- Classify blockers by severity and blocking level.
- Allow skipped optional Postgres/GitHub/LLM/MCP/auth profiles only when documented.
- Model signoff expectations, release-note requirements, rollback checklist items, known limitations, and recommended next actions.
- Record evidence-pack documentation for validation, skipped optional tests, release notes, rollback planning, and planning-ready signoff status without faking real approval.
- Keep runtime safe: no release creation, no Git tag creation, no GitHub release creation, no deployment, no CI job execution, no remote integration-test execution, no provider calls, no resource mutation, no secrets, no env values, no staging-deployed claim, and no production-ready claim.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 32. Production Secret Backend Implementation Option Decision v0

Implemented with `docs/roadmaps/production-secret-backend-option-decision/v0.md`, `v0-plan.md`, decision criteria, backend evaluation, recommendation, SecretRef provider mapping, v1 implementation scope, env-to-production migration plan, test strategy, risk register, deterministic decision/readiness models in `packages/deployment-readiness`, read-only `/readiness/secret-backend-decision/*` API endpoints, `/dashboard/secret-backend-decision`, safe `/health` metadata, dashboard rendering, and tests.

Goals:

- Select the first production-grade secret backend implementation path without calling or deploying the backend in the decision milestone.
- Recommend Vault first because the deployment cloud is undecided and Vault best exercises lease, TTL, revocation, namespace, audit, and self-hosted SecretRef requirements.
- Keep AWS Secrets Manager as the second choice if the first production deployment is AWS-first.
- Defer GCP Secret Manager, Azure Key Vault, and custom enterprise backends until their deployment context is selected.
- Keep EnvSecretProvider local/integration only and mock provider test-only.
- Define v1 scope, config names, Auth/RBAC and Policy checks, redaction rules, API/dashboard/health expectations, tests, migration strategy, and operational risks.
- Keep the decision runtime safe: no Vault/cloud/custom secret backend calls from the decision surface, no secret reads, no secret migration, no rotation, no production credential issuance, no env value exposure, no credential cache reads, no BYOK/OAuth/WIF/IAM, and no production-ready claim.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 33. Vault-backed Secret Backend v1

Implemented with `docs/foundations/vault-secret-backend/v1.md`, `docs/foundations/vault-secret-backend/v1-plan.md`, `packages/security` Vault config/client/provider boundaries, policy allow rules for gated Vault-backed credential resolution, read-only Vault readiness/security API endpoints, health metadata, dashboard read model rendering, and deterministic tests.

Goals:

- Add `provider: vault` SecretRef support without making Vault the default.
- Add `DisabledVaultClient`, `MockVaultClient`, and isolated `GatedHttpVaultClient`.
- Map Vault KV v2 mount/path/key/version/namespace metadata without storing secret values.
- Require Auth/RBAC, purpose Policy, provider credential Policy, lease Policy, active SecretRef status, and path allowlists before any Vault client read.
- Issue metadata-only SecretLease and CredentialHandle records for successful internal resolutions.
- Support GitHub token, GitHub webhook secret, GitHub App private-key metadata, LLM API key, and provider API key SecretRefs through the same credential boundary.
- Expose `/readiness/secrets/vault/*`, `/security/secrets/vault/*`, `/dashboard/vault-secret-backend`, and safe `/health` metadata without Vault tokens, Vault address values, secret values, env values, or credential cache paths.
- Keep live Vault tests skipped unless every explicit gate is configured.
- Keep production Vault rollout, HA, unseal, storage backend, Terraform/Helm/Kubernetes, rotation, destructive migration, AppRole/workload identity rollout, BYOK/OAuth/WIF/IAM, and production readiness out of scope.

Recommended next step: Staging Deployment Execution Plan v0 is implemented. Continue with Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 34. Vault Integration-Test Profile v1

Implemented with `docs/roadmaps/vault-integration-test-profile/v1.md`, `docs/roadmaps/vault-integration-test-profile/v1-plan.md`, deterministic Vault integration-test profile/test-case/safety-check/summary models in `packages/deployment-readiness`, read-only `/readiness/vault-integration/*` API endpoints, `/dashboard/vault-integration`, safe `/health` metadata, dashboard rendering, and deterministic tests.

Goals:

- Define the required gates for optional live Vault KV v2 validation without making Vault default.
- Require a test-only SecretRef pattern, a non-production allowlisted path, and token-auth test gate.
- Classify missing gates as skipped and unsafe gates as blocked.
- Expose booleans, counts, statuses, and safety checks only; never expose Vault token/address/path/key/secret/env values.
- Preserve no-write, no-delete, no-rotate, no-broad-list, no credential-cache-read, and no-default-Vault-call guarantees.
- Keep production Vault rollout, rotation jobs, destructive migration, cloud identity exchange, and production-ready secret backend status out of scope.

Recommended next step: Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.

## 35. Staging Deployment Execution Plan v0

Implemented with `docs/roadmaps/staging-deployment-execution/v0.md`, `docs/roadmaps/staging-deployment-execution/v0-plan.md`, execution sequence, pre-deploy gates, live integration decision policy, post-deployment smoke plan, rollback plan, deterministic plan/step/gate/go-no-go/rollback/summary models in `packages/deployment-readiness`, read-only `/readiness/staging-execution/*` API endpoints, `/dashboard/staging-execution`, safe `/health` metadata, dashboard rendering, and tests.

Goals:

- Define a controlled future staging deployment sequence after human signoff without performing deployment.
- Require validation, no-secret/no-env, no side effect, release-note, rollback, and signoff gates.
- Classify optional Postgres, GitHub App, LLM, Vault, MCP, external auth, and vendor CLI decisions before execution.
- Expose go/no-go and rollback readiness while keeping pending real signoffs as `not_ready`.
- Keep runtime safe: no release creation, no Git tag creation, no GitHub release, no deployment, no CI job execution, no remote integration-test execution, no provider calls, no resource mutation, no secrets, no env values, no staging-deployed claim, and no production-ready claim.

Recommended next step: Collect real human signoffs using Staging Human Signoff Pack v0, then run Staging Deployment Approval Audit v0 before any staging deployment execution.

## 36. Staging Human Signoff Pack v0

Implemented with `docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md`, `docs/roadmaps/staging-deployment-execution/signoff-evidence-checklist-v0.md`, and `docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md`.

Goals:

- Provide a documentation/readiness surface for collecting real human signoffs before actual staging deployment execution.
- Keep all required roles pending by default: `engineering_owner`, `platform_owner`, `security_reviewer`, `product_owner`, `qa_reviewer`, and `release_manager`.
- Require review of the Staging Go/No-Go Audit, Staging RC Audit rerun, Staging RC Evidence Pack, release notes draft, rollback evidence, staging execution plan, safe integration summary, no-secret/no-env result, validation results, skipped optional test rationale, known limitations, and production blockers.
- Define conditional approval, rejection/hold, expiry, reviewed scope, and revalidation rules without implementing identity, durable approval storage, deployment execution, releases, tags, GitHub releases, or provider calls.
- Keep actual staging deployment blocked until real signoffs are recorded and a future Staging Deployment Approval Audit accepts the evidence.

Recommended next step: Collect real human signoffs using the signoff pack, then run Staging Deployment Approval Audit v0 before any staging deployment execution.

## 37. RequestContext Propagation v1

Implemented with `docs/foundations/auth-rbac/request-context-propagation-v1-plan.md`, `docs/foundations/auth-rbac/request-context-propagation-v1.md`, `docs/reference/request-context-propagation-inventory.md`, `packages/auth`, policy subject updates, selected API/service propagation, audit metadata enrichment, and deterministic tests.

Goals:

- Consolidate RequestContext and CorrelationContext metadata without adding production authentication.
- Resolve deterministic mock/system/test/webhook/dashboard/readiness contexts.
- Enrich AuthContext-to-PolicySubject mapping with request id, correlation id, source, actor/principal metadata, roles, teams, and auth mode.
- Propagate context through selected API, Git, LLM, MCP, Security, dashboard/readiness, and observability paths.
- Preserve deny-by-default Policy-as-code behavior and existing SecretRef/Git/LLM/MCP/Runner safety gates.
- Keep runtime safe: no OIDC, SAML, SCIM, SSO, login/logout/session handling, JWTs, API keys, service-account credentials, external IdP calls, credential-cache reads, secret/env exposure, or production-auth ready claim.

Recommended next step: Tenant Scope Enforcement v1 is implemented as partial representative metadata. Continue with OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.

## 38. API AuthContext Middleware Skeleton v1

Implemented with `docs/foundations/auth-rbac/api-authcontext-middleware-v1-plan.md`, `docs/foundations/auth-rbac/api-authcontext-middleware-v1.md`, `docs/reference/api-authcontext-middleware-inventory.md`, `apps/api/src/request-context-middleware.ts`, API route integration, safe `/health` and `/auth/me` context summaries, and deterministic tests.

Goals:

- Resolve one cached mock-first `RequestContext` at API ingress where practical.
- Reuse existing `RequestContextResolver`, `MockAuthProvider`, `AuthContext`, and `AuthorizationService` boundaries.
- Support API, dashboard, readiness, webhook metadata, and reason-tagged system source modes.
- Pass cached context through representative Auth, Policy, Security, Git, LLM, MCP, Local Agent, Runner, Registry, Governance, Dashboard, Readiness, Observability, provider, and task run-agent routes where service signatures already support it.
- Preserve deny-by-default Policy-as-code behavior and existing SecretRef/Git/LLM/MCP/Runner/Dashboard/Observability safety gates.
- Keep runtime safe: no OIDC, SAML, SCIM, SSO, login/logout/session handling, JWTs, API keys, service-account credentials, external IdP calls, Authorization-header auth, cookie auth, credential-cache reads, secret/env exposure, or production-auth ready claim.

Recommended next step: Tenant Scope Enforcement v1 is implemented as partial representative metadata. Continue with OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.

## 39. Service Account Actor Boundary v1

Implemented with `docs/foundations/auth-rbac/service-account-actor-boundary-v1-plan.md`, `docs/foundations/auth-rbac/service-account-actor-boundary-v1.md`, `docs/reference/service-account-actor-boundary-inventory.md`, `packages/auth`, selected Git/LLM/MCP/Security/Runner/Local Agent service fallbacks, serviceAccountId audit metadata, and deterministic tests.

Goals:

- Define a static mock service-account catalog without issuing credentials.
- Provide `ServiceAccountContextFactory` for `mock_service_account` AuthContext and RequestContext creation.
- Enrich PolicySubject and audit metadata with `actorKind=service_account` and `serviceAccountId`.
- Replace high-value runtime service actor fallbacks in Git, GitHub App token-handle checks, LLM, MCP, Security, Runner, and Local Agent policy paths.
- Preserve deny-by-default policy behavior, no-secret/no-env behavior, and mock-first runtime defaults.
- Keep runtime safe: no service-account credentials, JWTs, API keys, sessions, credential rotation, external IdP/provider calls, credential-cache reads, or production-auth ready claim.

Recommended next step: Tenant Scope Enforcement v1 is implemented as partial representative metadata. Continue with OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.

## 40. Registry/Governance RequestContext Migration v1

Implemented with `docs/foundations/auth-rbac/registry-governance-request-context-migration-v1-plan.md`, `docs/foundations/auth-rbac/registry-governance-request-context-migration-v1.md`, `docs/reference/registry-governance-request-context-inventory.md`, `packages/registry`, `packages/improvement`, representative API route propagation, registry/governance audit metadata enrichment, and deterministic tests.

Goals:

- Propagate `RequestContext`/`AuthContext` through high-value registry mutation and governance decision paths.
- Use `registry_governance_service` and `improvement_governance_service` service-account attribution where system/service context is appropriate.
- Enrich registry/governance audit records with request id, correlation id, source, auth mode, principal id, actor kind, and service account id.
- Preserve registry lifecycle, approval, eval, checksum, package, resolver, and rollback gates.
- Keep auto-improvement draft/proposal/governance-only; apply remains blocked and active registry entries are not mutated by draft changes.
- Keep runtime safe: no production auth, real service-account credentials, real eval/canary execution, artifact registry integration, external provider calls, secret/env exposure, or production-governance ready claim.

Recommended next step: Tenant Scope Enforcement v1 is implemented as partial representative metadata. Continue with OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.

## 41. Tenant/Repo/Provider Scope Model v1

Implemented with `docs/foundations/auth-rbac/tenant-repo-provider-scope-model-v1-plan.md`, `docs/foundations/auth-rbac/tenant-repo-provider-scope-model-v1.md`, `docs/reference/tenant-repo-provider-scope-inventory.md`, `packages/auth` scope models/catalog/helpers, `packages/policy` policy resource scope helpers, selected Git/LLM/MCP/Security/Registry/Governance/Observability metadata, `/readiness/scopes/*`, `/dashboard/scopes`, dashboard rendering, and deterministic tests.

Goals:

- Define common tenant, team, project, repo, provider, model, SecretRef, MCP tool, registry package, Local Agent host, audit query, and policy resource scope metadata.
- Keep all scope data mock/readiness metadata only.
- Add optional scope fields to AuthContext, RequestContext, PolicySubject, policy resources, and audit envelopes.
- Expose safe read-only scope readiness and dashboard summaries.
- Preserve deny-by-default policy behavior and all provider/secret/runner/registry/governance gates.
- Keep runtime safe: no production tenant provisioning, tenant isolation enforcement, row-level security, production dashboard filtering, real Auth/RBAC, provider calls, credential issuance, secret/env exposure, or production tenancy claim.

Recommended next step: Tenant Scope Enforcement v1 is implemented as partial representative metadata. Continue with OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.

## 42. Dashboard/Readiness Tenant Scope Planning v1

Implemented with `docs/roadmaps/dashboard-readiness-tenant-scope/v1.md`, dashboard and readiness tenant-scope inventories, role visibility matrices, fallback behavior, future filtering architecture, deterministic read-only planning models, `/readiness/tenant-scope/*`, `/dashboard/tenant-scope`, health metadata, dashboard rendering, and tests.

Goals:

- Inventory dashboard panels and readiness endpoint groups.
- Define target tenant/team/project/repo/provider/model/secret/MCP/registry/local-agent/audit scope dimensions.
- Define role visibility and fallback behavior.
- Expose read-only planning metadata for future implementation.
- Preserve mock-first runtime, no-secret/no-env behavior, and production tenant enforcement false status.

Recommended next step: Tenant Scope Enforcement v1 is implemented as partial representative metadata. Continue with OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.

## 43. Dashboard/Readiness Tenant Scope Implementation v1

Implemented with `docs/roadmaps/dashboard-readiness-tenant-scope/implementation-v1-plan.md`, `docs/roadmaps/dashboard-readiness-tenant-scope/implementation-v1.md`, scope-aware shared DTOs, deterministic planning service scope metadata derivation, dashboard/readiness API metadata, dashboard UI scope/visibility/redaction rendering, health metadata, and tests.

Goals:

- Add `ScopedReadModelMetadata`, `DashboardPanelScopeSummary`, and `ReadinessEndpointScopeSummary`.
- Attach safe scope metadata to major dashboard read-model sections.
- Expose readiness endpoint scope summaries and representative readiness summary metadata.
- Render missing-scope warnings, role visibility hints, redaction labels, tenant filtering false, production enforcement false, and no-secret/no-env status.
- Preserve current behavior without hiding panels, filtering data, enforcing tenant isolation, implementing production Auth/RBAC, calling providers, or exposing secrets/env values.

Recommended next step: Tenant Scope Enforcement v1 is implemented as partial representative metadata. Continue with OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.

## 44. Tenant Scope Enforcement v1

Implemented with `docs/foundations/auth-rbac/tenant-scope-enforcement-v1-plan.md`, `docs/foundations/auth-rbac/tenant-scope-enforcement-v1.md`, `docs/reference/tenant-scope-enforcement-inventory.md`, `packages/auth/src/tenant-scope-enforcement.ts`, representative dashboard/readiness metadata, `/readiness/tenant-enforcement/*`, `/dashboard/tenant-enforcement`, dashboard rendering, and deterministic tests.

Goals:

- Define reusable tenant scope enforcement decision, mode, and mismatch models.
- Compare subject and resource scope metadata deterministically.
- Surface representative dashboard/readiness enforcement metadata, missing-scope warnings, audit-query warnings, and secret-adjacent warnings.
- Preserve `tenantFilteringImplemented: false`, `productionTenantEnforcement: false`, and no-secret/no-env guarantees.
- Keep `StaticPolicyEngine` authoritative; policy deny remains authoritative and scope allow cannot override policy deny.
- Keep runtime safe: no production tenant provisioning, production Auth/RBAC, row-level security, DB tenant partitioning, external IdP/provider calls, remote Git, real LLM/MCP calls, credential-cache reads, or secret/env exposure.

Recommended next step: Policy Runtime Shadow Evaluation Planning v1 is implemented as planning/readiness metadata. Continue with OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.

## 45. Policy Runtime Shadow Evaluation Planning v1

Implemented with `docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v1-plan.md`, `docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v1.md`, candidate runtime interface planning, mismatch taxonomy, reporting plan, rollout/rollback plan, read-only deployment-readiness models, `/readiness/policy-shadow/*`, `/dashboard/policy-shadow`, health metadata, dashboard rendering, and deterministic tests.

Goals:

- Define future shadow evaluator architecture without implementing the evaluator.
- Keep `StaticPolicyEngine` as source of truth and `enforcementChanged: false`.
- Define candidate runtime interface expectations for future signed JSON/YAML, OPA/Rego, Cedar, and custom candidates.
- Define static-vs-candidate comparison rules, mismatch severity taxonomy, audit/reporting metadata, dashboard/readiness behavior, and rollout/rollback stages.
- Preserve runtime safety: no candidate runtime execution, no OPA/Rego or Cedar runtime, no signed bundle verification runtime, no dynamic policy execution, no remote bundle loading, no external policy service calls, no production Auth/RBAC, no credential issuance, and no secret/env exposure.

Recommended next step: Policy Runtime Shadow Evaluator Skeleton v1, or OIDC Provider Skeleton Hardening v1.

## 46. Production Auth Provider Skeleton v1

Implemented with `docs/foundations/auth-rbac/production-auth-provider-skeleton-v1-plan.md`, `docs/foundations/auth-rbac/production-auth-provider-skeleton-v1.md`, disabled future provider skeletons and provider registry in `packages/auth`, read-only deployment-readiness models, `/readiness/auth-providers/*`, `/dashboard/auth-providers`, `/auth/config`, `/health` auth-provider metadata, dashboard rendering, and deterministic tests.

Goals:

- Keep `MockAuthProvider` as the only active default provider.
- Define disabled future OIDC, SAML, SCIM, Microsoft Entra, Okta, Auth0, Google Workspace, GitHub Enterprise, and custom provider boundaries.
- Add provider-selection/readiness metadata, session/token boundary plans, and identity-mapping plans.
- Add safe RequestContext/AuthContext/PolicySubject metadata for provider kind/status without trusting real tokens.
- Preserve runtime safety: no real OIDC/SAML/SCIM/SSO/login/logout/session handling, no JWT or token validation, no cookie parsing as auth, no API-key/session/JWT/service-account credential issuance, no SCIM sync, no external IdP calls, no credential-cache reads, no env value exposure, and no production-auth enabled claim.

Recommended next step: OIDC Provider Skeleton Hardening v1, or Policy Runtime Shadow Evaluator Skeleton v1.

## 47. Phase 5 Enterprise Planning
## 42. Policy Bundle Runtime PoC Planning v0

Implemented with `docs/roadmaps/policy-bundle-runtime-poc/v0.md`, `v0-plan.md`, runtime option comparison, normalized policy input/output contract, PoC domain mapping, shadow evaluation plan, golden decision test plan, deterministic runtime PoC readiness models in `packages/deployment-readiness`, read-only `/readiness/policy-runtime-poc/*` API endpoints, `/dashboard/policy-runtime-poc`, safe `/health` metadata, dashboard rendering, and tests.

Goals:

- Define how a future policy runtime proof-of-concept should be evaluated without implementing runtime execution.
- Compare `StaticPolicyEngine`, OPA/Rego local/server futures, Cedar local evaluator future, signed JSON/YAML bundle evaluator future, and custom policy service future.
- Define future normalized input/output using AuthContext, RequestContext, service-account, and Tenant/Repo/Provider Scope metadata.
- Map Git, GitHub App token issuance, webhook processing, LLM, MCP, SecretRef/Vault, Runner, Local Agent, Registry, Governance, Dashboard/readiness, and Observability domains to PoC fixtures.
- Define shadow evaluation, mismatch severity, golden decision cases, rollout/rollback, safety constraints, and success/failure criteria.
- Keep runtime safe: no OPA/Rego, Cedar, signed JSON/YAML evaluator, custom policy service, shadow evaluator, dynamic policy execution, remote policy loading, hot reload, external calls, production Auth/RBAC, tenant enforcement, secrets, or env values.

Recommended next step: Policy Runtime Shadow Evaluator Skeleton v1, or Tenant Scope Enforcement v1.

## 43. Policy Runtime PoC Golden Test Harness v1

Implemented with `docs/roadmaps/policy-bundle-runtime-poc/golden-test-harness-v1-plan.md`, `docs/roadmaps/policy-bundle-runtime-poc/golden-test-harness-v1.md`, typed fixtures in `packages/policy/src/golden-cases.ts`, the offline harness in `packages/policy/src/golden-harness.ts`, read-only `/readiness/policy-runtime-poc/golden-summary`, `/dashboard/policy-runtime-poc` golden harness summary fields, and deterministic tests.

Goals:

- Define reviewable normalized golden policy input fixtures for critical domains.
- Use `StaticPolicyEngine` as the source of truth and compare effect, reason, and first matched rule id.
- Cover destructive Git, GitHub App token-handle gating, LLM completion/fallback, MCP risk gates, SecretRef/Vault credential resolution, Runner/Local Agent denials, Registry/Governance, Dashboard/readiness, and tenant/scope metadata cases.
- Preserve deny-by-default behavior and record deterministic pass/fail counts for future runtime comparisons.
- Keep runtime safe: no OPA/Rego, Cedar, signed JSON/YAML evaluator, signed bundle verification, custom policy service, shadow evaluator, dynamic policy execution, remote bundle loading, hot reload, external calls, production Auth/RBAC, tenant enforcement, secrets, or env values.

Recommended next step: Policy Runtime Shadow Evaluator Skeleton v1, or Tenant Scope Enforcement v1.

## 44. Policy Runtime Shadow Evaluation Planning v1

Implemented with `docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v1-plan.md`, `docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v1.md`, candidate runtime interface planning, mismatch taxonomy, reporting, rollout/rollback docs, deterministic shadow planning models in `packages/deployment-readiness`, read-only `/readiness/policy-shadow/*` API endpoints, `/dashboard/policy-runtime-poc` shadow planning fields, and deterministic tests.

Goals:

- Define future shadow evaluator architecture without implementing it.
- Define candidate runtime interface expectations for future signed JSON/YAML, OPA/Rego, Cedar, or custom candidates.
- Define static-vs-candidate comparison rules, mismatch severity taxonomy, audit/reporting model, rollout, and rollback.
- Connect Golden Harness v1 as the future static baseline for candidate runtime comparisons.
- Keep runtime safe: no candidate runtime, no shadow evaluator, no OPA/Rego, no Cedar, no signed JSON/YAML evaluator, no signed verification runtime, no external policy service calls, no dynamic policy execution, no remote policy loading, no enforcement change, no production Auth/RBAC, no tenant enforcement, no secrets, and no env values.

Recommended next step: Policy Runtime Shadow Evaluator Skeleton v1, or Tenant Scope Enforcement v1.

## 45. Phase 5 Enterprise Planning

Goals:

- SSO and SCIM.
- Audit export.
- Data residency.
- Signed artifacts.
- Real artifact registry.
- Production RBAC.
- Deployment and operational controls.

## OIDC provider integration status

OIDC Provider Skeleton Hardening is `v1_implemented` as readiness-only hardening. Real OIDC integration remains a future task and must start with an integration-test profile before any production login, callback, JWKS fetch, JWT validation, or session issuance work.
