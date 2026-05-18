# Aichestra


Aichestra is an AgentOps control plane for coordinating LLM usage, AI coding agents, Git branches, PRs, skills, harnesses, instruction artifacts, usage ledgers, and audit logs.

This repository is an MVP scaffold. It is intentionally mock-first: default runtime code does not call real LLM providers, Git hosting APIs, MCP gateways, secret stores, or production databases. Real Git Adapter v2 and LLM Gateway v2 are controlled exceptions that remain disabled unless every explicit integration gate is configured.

RequestContext Propagation v1 is implemented as a mock-first attribution and correlation layer. It propagates deterministic mock/system AuthContext, request ids, correlation ids, actor/principal metadata, roles, teams, auth mode, and source through selected API/service/audit paths, but it does not implement production authentication, sessions, JWTs, API keys, SSO, or external identity-provider calls.

API AuthContext Middleware Skeleton v1 is implemented as a mock-first API ingress helper. It resolves one cached `RequestContext` per API request where practical, preserves dashboard/readiness read-only source modes, and exposes safe summaries without reading cookies or Authorization headers as real auth.

Service Account Actor Boundary v1 is implemented as a mock-first system/service attribution layer. It adds a static service-account catalog and context factory, migrates high-value service fallbacks to `actorKind=service_account` and `serviceAccountId` audit/policy metadata, and does not issue real service-account credentials, JWTs, API keys, sessions, or provider tokens.

Registry/Governance RequestContext Migration v1 is implemented as a mock-first registry/governance attribution slice. It propagates RequestContext/AuthContext through representative registry mutation and governance decision/apply-gate paths, adds request/correlation/service-account audit metadata, keeps apply blocked, and does not enable production governance or auto-apply.

Tenant/Repo/Provider Scope Model v1 is implemented as a mock/readiness metadata scaffold. It adds shared tenant/team/project/repo/provider/model/SecretRef/MCP/registry/local-agent/audit-query scope shapes, safe readiness/dashboard summaries, and policy/audit metadata enrichment, but it does not enforce production tenant isolation or dashboard filtering.

Dashboard/Readiness Tenant Scope Planning v1 is implemented as a read-only planning surface. It inventories dashboard panels and readiness endpoints, defines target scope dimensions, role visibility, fallback behavior, and future filtering phases, and exposes `/readiness/tenant-scope/*` plus `/dashboard/tenant-scope`; it does not implement production tenant enforcement, tenant provisioning, row-level security, or production Auth/RBAC.

Dashboard/Readiness Tenant Scope Implementation v1 is implemented as safe read-model metadata. It adds `ScopedReadModelMetadata`, `DashboardPanelScopeSummary`, and `ReadinessEndpointScopeSummary`, exposes missing-scope warnings, role visibility hints, redaction labels, and explicit false tenant-filtering/production-enforcement flags, but it does not hide panels, filter data, enforce tenant isolation, or enable production Auth/RBAC.

Tenant Scope Enforcement v1 is implemented as partial representative scaffolding. It adds deterministic scope decision/mode/mismatch models, safe dashboard/readiness enforcement summaries, audit-query warnings, and stricter secret-adjacent helper decisions, but it does not implement production tenant isolation, row-level security, production Auth/RBAC, durable tenant grants, or dashboard/readiness filtering.

Audit Query Scope Enforcement v1 is implemented as partial representative observability scoping. It adds deterministic `AuditQueryScopeRequest`, `AuditQueryScopeDecision`, and redaction-plan metadata for audit summary/metadata/detail requests; exposes `/readiness/audit-scope/*`, `/observability/audit/query-scope/check`, `/observability/audit/events` scope summaries, dashboard, and health metadata; and keeps raw payload access forbidden. It does not implement production audit query security, durable audit storage filtering, row-level security, external SIEM/export, production Auth/RBAC, sessions, JWTs, API keys, or service-account credentials.

Registry Tenant Scope Enforcement v1 is implemented as partial representative registry scoping. It adds deterministic `RegistryScopeDecision` metadata for skills, harnesses, instructions, packages, resolver results, approval queues, audit/readiness, and mutation scope checks; exposes `/registry/scope/*`, `/readiness/registry/scope/summary`, dashboard, and health metadata; and preserves resolver lifecycle, approval, eval, checksum, semver, policy, and governance gates. It does not implement production registry tenant isolation, row-level security, durable tenant grants, production Auth/RBAC, or production filtering.

Registry Signed Package / Artifact Trust v1 is implemented as a mock-first registry trust layer. It adds digest, mock signature, provenance, trust policy, and trust decision metadata for registry packages and resolver results; exposes `/registry/artifact-trust/*`, `/readiness/registry/artifact-trust/summary`, dashboard, and health metadata; and preserves checksum, lifecycle, approval, eval, semver, policy, governance, tenant scope, and resolver gates. It does not implement real signing, real signature verification, signing keys, Sigstore/Cosign/GPG/KMS/Vault transit, external artifact registries, artifact upload/download, or production artifact trust enforcement.

Eval Suite Execution Harness v1 is implemented as a deterministic mock eval boundary. It adds eval suite/case/run/result/verdict models, executes metadata-only mock/local checks for registry candidates, attaches reviewable registry/proposal eval evidence, exposes `/registry/eval-suites`, `/registry/eval-runs`, `/readiness/registry/evals/summary`, dashboard, and health metadata, and keeps external eval, real provider calls, canary execution, auto-apply, and active registry mutation disabled.

Policy Runtime Shadow Evaluation Planning v1 is implemented as planning/readiness metadata. It defines future candidate-runtime comparison against `StaticPolicyEngine`, mismatch taxonomy, reporting, rollout/rollback, `/readiness/policy-shadow/*`, and `/dashboard/policy-shadow`, but it does not implement a shadow evaluator, candidate runtime, OPA/Rego, Cedar, signed bundle verification, dynamic policy execution, external policy service calls, or enforcement changes.

Production Auth Provider Skeleton v1 is implemented as disabled/readiness-only provider boundary metadata. It keeps `MockAuthProvider` as the active default, adds disabled future OIDC/SAML/SCIM/vendor/custom provider skeletons, provider selection status, future session/token and identity-mapping plans, `/readiness/auth-providers/*`, `/dashboard/auth-providers`, and safe `/health` metadata. It does not validate tokens, parse cookies or Authorization headers as auth, issue sessions/JWTs/API keys/service-account credentials, sync SCIM users, call external identity providers, or expose secrets/env values.

Agent Workspace Lifecycle v2 is implemented as mock-first per-agent-run workspace metadata. It adds workspace leases, lifecycle events, cleanup decisions, branch lease linkage, API/dashboard visibility, path redaction, and explicit future Git worktree modeling. It does not run `git worktree`, switch branches, delete user workspaces, perform remote Git operations, execute vendor CLIs, call LLM providers, or implement production workspace cleanup.

Agent Worktree Allocation v1 is implemented as a mock-first, fixture-only allocation boundary. It validates workspace root allowlists, requested paths, branch lease linkage, safe branch names, and shared path collisions; exposes API/dashboard/readiness/health metadata; and keeps production worktree allocation disabled. It does not run `git worktree add/remove`, mutate real repositories, delete workspaces, call providers, call LLMs, or expose secrets/env values.

Multi-user / Multi-session Branch Orchestrator v2 is implemented as mock-first branch allocation and ownership metadata. It adds deterministic safe `aichestra/` branch names, branch ownership records, BranchLease and optional WorkspaceLease linkage, branch collision detection, base branch drift metadata, API/dashboard visibility, and no-destructive-Git status. It does not create real branches, switch branches, mutate workspaces, run fetch/push/merge/rebase, call providers, execute agents, or expose secrets/env values.

Cross-session File Lease / Edit Intent Graph v1 is implemented as metadata-only concurrency modeling. It adds file leases, edit intents, graph nodes/edges, overlap assessments, API/dashboard visibility, path/secret redaction, and explicit no-file-lock/no-source-mutation status. Merge Queue Policy v2 consumes edit overlap summaries as readiness evidence. Cross-session File Lease / Edit Intent Graph v1 does not lock real files, modify source files, create branches or worktrees, run Git, execute vendor CLIs, call LLM providers, or execute merge policy.

Merge Queue Policy v2 is implemented as a mock-first readiness layer. It evaluates merge queue entries using branch lease, workspace lifecycle, coordination/edit-intent overlap, conflict risk, dry-run, validation, approval, and Policy-as-code evidence; records readiness decisions and holds; ranks queue entries; and exposes API/dashboard visibility. It does not execute merges, auto-merge, fetch, push, rebase, force-push, delete branches, update remote PRs, call providers, call LLMs, run vendor CLIs, mutate user workspaces, or expose secrets/env values.

Conflict Resolution Assistant v1 is implemented as a mock-first, metadata-only conflict explanation and review planning layer. It consumes dry-run simulation, conflict risk, merge queue, branch/workspace/session, and edit-overlap metadata; produces conflict summaries, classifications, review-only plans, recommendations, suggested validation/tests, API/dashboard/health visibility, and merge queue hold linkage metadata. It does not inspect source contents, apply patches, mutate source files, execute merges, call real LLM providers by default, call Git providers, release holds automatically, run vendor CLIs, execute validation commands, read credential caches, or expose secrets/env values. `applyAllowed` is always false in v1.

PR Ownership / Handoff Model v1 is implemented as a mock-first, metadata-only ownership layer for PRs, branches, tasks, agent runs, merge queue entries, and conflict resolution plans. It records local owner/reviewer metadata, handoff requests, handoff decisions, audit/correlation metadata, merge queue owner readiness, API/dashboard/readiness/health visibility, and policy-gated future-deny actions. It does not call GitHub APIs, assign remote reviewers, update remote PRs, push branches, merge/close PRs, delete branches, auto-merge, execute agents or LLMs, mutate workspaces, read credential caches, or expose secrets/env values.

Real Merge Execution Policy v1 is implemented as a mock-first policy/readiness boundary for future real merge execution. It defines disabled merge/auto-merge/remote-push flags, explicit preconditions, forbidden operations, decision metadata, post-execution evidence templates, API/dashboard/readiness/health visibility, and Policy-as-code gates. It does not execute real merges, run `git merge`, push, fetch, rebase, force-push, delete branches, update remote PRs, auto-merge, mutate workspaces, call GitHub/LLM/provider/vendor APIs, read credential caches, or expose secrets/env values.

Design and work-order source documents live under `docs/briefs/`; the canonical bootstrap document is `docs/briefs/AICHESTRA_BOOTSTRAP.md`. See `docs/README.md` for the full documentation layout.

## Architecture

- `packages/core`: domain models, status transitions, validation schemas, seed data, instruction resolution, Conflict Manager scoring, merge simulation interfaces, Merge Queue Policy v2 decision/hold/ranking service, Conflict Resolution Assistant v1 request/summary/plan/recommendation service, PR Ownership / Handoff v1 ownership/handoff/audit/readiness service, and Real Merge Execution Policy v1 precondition/decision/forbidden-operation service.
- `packages/git-adapter`: Git provider behavior, mock branch/PR creation, conflict risk, local-only dry-run merge simulation, gated GitHub operations, disabled-by-default webhook receive, PR/branch sync read models, GitHub App Controlled Implementation v1 runtime/status boundaries, and Multi-user / Multi-session Branch Orchestrator v2 metadata-only branch allocation and ownership services.
- `packages/improvement`: Phase 4 Preparation, Auto-improvement v0, and Governance v1 models, repository interfaces, in-memory repositories, DTOs, deterministic clustering, candidates, draft proposals, draft registry changes, readiness checks, proposal review queues, governance decisions, proposal eval run metadata, canary readiness, apply gates, governance audit events, eval requirements, canary rollout plan metadata, and auto-improvement safety policies.
- `packages/llm-gateway`: provider-neutral LLM interfaces, mock model provider behavior, gated OpenAI-compatible HTTP provider path, LLM Gateway v2 route/fallback/routing-decision read models, disabled provider skeletons, model catalog, virtual model key policy objects, budget checks, usage ledger integration, LLM audit events, Enterprise LLM Provider Abstraction v0 catalog/auth/credential/token/adapter/local-agent boundary skeletons, and Local Agent Protocol v1 mock channels/fixture daemon/compatibility/streaming models.
- `packages/mcp-gateway`: MCP Gateway v0 server/tool catalog models, deterministic `MockMCPGateway`, disabled real MCP transport skeleton, invocation/audit repositories, DTOs, and Auth/RBAC, Policy, Security redaction, and Secrets/Sandbox integration.
- `packages/deployment-readiness`: Production Deployment Readiness Planning v0 read-only deployment profiles, readiness checks, production risks, GitHub App / Production Webhook Hardening Planning v0 models, Persistent DB Production Operations v1 readiness models, Secret Backend Migration Planning v0 readiness models, Production Secret Backend Implementation Option Decision v0 readiness/decision models, Production Auth/RBAC v1 planning readiness models, Production Auth Provider Skeleton v1 provider/readiness/session-token/identity-mapping summary models, Policy Bundle / OPA-Cedar Planning v0 readiness models, Policy Runtime Shadow Evaluation Planning v1 readiness models, Staging Deployment Profile v0 readiness models, Staging Deployment Dry-run Profile v0 readiness aggregation models, Staging Release Candidate Checklist v0 readiness models, Staging Deployment Execution Plan v0 and Human Signoff Pack v0 readiness models, Staging CI/CD Pipeline Planning v0 readiness models, GitHub App integration-test profile v1 readiness models, LLM Gateway integration-test profile v1 readiness models, Vault Integration-Test Profile v1 readiness models, Dashboard/Readiness Tenant Scope Planning v1 and Implementation v1 models, DTOs, scope summaries, and seeded planning summary models.
- `packages/policy`: provider-neutral Policy-as-code Skeleton v0 models, static/mock policy engine, default restrictive rules, merge queue read/evaluate/hold/release/future-execution gates, Real Merge Execution Policy v1 read/evaluate/request gates plus denied future execute/override/post-evidence actions, PR ownership/handoff metadata gates and future remote PR update/reviewer assignment denies, registry scope read/evaluate/mutation-check gates plus denied future enforcement, registry artifact trust read/evaluate/mock-metadata gates plus denied future sign/verify/trusted-import actions, registry eval suite read/run_mock/attach gates plus denied future external/override actions, RequestContext-enriched policy subjects, `PolicyResourceScope` helpers, decision audit, DTOs, and policy service boundaries.
- `packages/auth`: Production Auth/RBAC Planning v0 provider-neutral identity/RBAC models, deterministic MockAuthProvider, Production Auth Provider Skeleton v1 disabled future provider classes and provider registry, AuthorizationService, RequestContext Propagation v1 request/correlation helpers, Service Account Actor Boundary v1 mock catalog/context factory, Tenant/Repo/Provider Scope Model v1 mock scope catalog and `ScopeContextFactory`, Tenant Scope Enforcement v1 decision/mode/mismatch models and helper service, and sanitized auth audit events.
- `packages/deployment-readiness`: Production Deployment Readiness Planning v0 read-only deployment profiles, readiness checks, production risks, GitHub App / Production Webhook Hardening Planning v0 models, Persistent DB Production Operations v1 readiness models, Secret Backend Migration Planning v0 readiness models, Production Secret Backend Implementation Option Decision v0 readiness/decision models, Production Auth/RBAC v1 planning readiness models, Policy Bundle / OPA-Cedar Planning v0 readiness models, Policy Bundle Runtime PoC Planning v0 readiness models, Policy Runtime Shadow Evaluation Planning v1 readiness models, Staging Deployment Profile v0 readiness models, Staging Deployment Dry-run Profile v0 readiness aggregation models, Staging Release Candidate Checklist v0 readiness models, Staging Deployment Execution Plan v0 and Human Signoff Pack v0 readiness models, Staging CI/CD Pipeline Planning v0 readiness models, GitHub App integration-test profile v1 readiness models, LLM Gateway integration-test profile v1 readiness models, Vault Integration-Test Profile v1 readiness models, DTOs, and seeded planning summary models.
- `packages/policy`: provider-neutral Policy-as-code Skeleton v0 models, static/mock policy engine, default restrictive rules, RequestContext-enriched policy subjects, `PolicyResourceScope` helpers, Policy Runtime PoC Golden Test Harness v1 fixtures/harness, decision audit, DTOs, and policy service boundaries. Policy Runtime Shadow Evaluation Planning v1 remains in deployment-readiness/read-model metadata only; no shadow evaluator or candidate runtime is implemented.
- `packages/auth`: Production Auth/RBAC Planning v0 provider-neutral identity/RBAC models, deterministic MockAuthProvider, disabled future auth provider placeholders, AuthorizationService, RequestContext Propagation v1 request/correlation helpers, Service Account Actor Boundary v1 mock catalog/context factory, Tenant/Repo/Provider Scope Model v1 mock scope catalog and `ScopeContextFactory`, and sanitized auth audit events.
- `packages/registry`: Skill, Harness, and Instruction registry interfaces, repository boundaries, DTO mappers, audit logs, history, rollback, approval queue read models, local eval result attachment, checksum verification, mock RBAC, local package manifests, import/export, semver range resolution v0, package diffs, validation helpers, deterministic resolver, Skill/Harness Compatibility Matrix v1, Registry Tenant Scope Enforcement v1 partial metadata decisions, Registry Signed Package / Artifact Trust v1 digest/signature/provenance/trust decision metadata, and Eval Suite Execution Harness v1 deterministic mock eval suite/run/verdict metadata.
- `packages/runner`: provider-neutral agent runner contracts, deterministic MockAgentRunner, disabled-by-default LocalAgentRunner, harness execution policy, instruction assembly, in-memory runner repositories, Agent Workspace Lifecycle v2 workspace leases/events/cleanup decisions, Agent Worktree Allocation v1 dry-run/fixture-only allocation metadata, Multi-session Agent Run Coordination v1 session/group/overlap/concurrency policy metadata, Cross-session File Lease / Edit Intent Graph v1 file leases/edit intents/graph/overlap metadata, runner DTOs/services, and mock test runner contracts.
- `packages/security`: Secrets and Sandbox Design v0 metadata-only secret refs/scopes/leases, SecretRef-backed Provider Credentials v1 env provider, Vault-backed Secret Backend v1 gated provider/client boundary, credential manager/handles/resolution audit, mock secret manager, sandbox profiles/sessions, network egress policy, redaction policy, security audit events, DTOs, and in-memory repositories.
- `packages/observability`: Observability / Audit Retention v0 common audit envelope, retention/redaction classes, audit sanitizer, source normalization, read-only retention policies, metric snapshots, trace skeletons, no-external-export observability read models, and Audit Query Scope Enforcement v1 partial decision/redaction metadata.
- `packages/adapters`: compatibility aggregate for shared adapter contracts and mocks.
- `packages/db`: Postgres-oriented schema, storage provider abstraction, repository factory, in-memory repositories for mock-first runtime/tests, and opt-in Postgres repositories for the core durable slice.
- `apps/api`: REST API skeleton using Node's local HTTP server, including API AuthContext Middleware Skeleton v1 for mock-first request context ingress.
- `apps/worker`: task workflow skeleton with mock branch, runner, usage, audit, and PR behavior.
- `apps/web`: dashboard skeleton with Next-style folders, API-backed dashboard read-model provider, explicit demo fallback, and a dependency-free local dev server.

## Install

Use Node 24.x. The repo pins Node 24 through Volta and `.nvmrc`.

```bash
pnpm install
```

The scaffold avoids third-party runtime dependencies so installation can complete without contacting provider APIs.

## Run

```bash
pnpm --filter @aichestra/api dev
pnpm --filter @aichestra/worker dev
pnpm --filter @aichestra/web dev
```

API health:

```bash
curl http://localhost:3000/health
```

Default storage is in-memory. Persistent DB v1 is opt-in:

```bash
AICHESTRA_STORAGE_PROVIDER=postgres AICHESTRA_DATABASE_URL=postgres://... pnpm --filter @aichestra/api dev
```

Run the schema migration only when explicitly configuring a local/test Postgres database:***@aichestra/api dev
```

Remote Git remains disabled by default. GitHub branch/PR creation requires explicit env gates, a SecretRef-backed token or legacy env token, repo allowlist, and the allowed branch prefix. Merge/rebase remain unsupported:

```bash
AICHESTRA_GIT_PROVIDER=github
AICHESTRA_ENABLE_REMOTE_GIT=false
AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE=false
AICHESTRA_ALLOW_REMOTE_PR_CREATE=false
AICHESTRA_ALLOW_REMOTE_MERGE=false
AICHESTRA_GITHUB_TOKEN_SECRET_REF=
AICHESTRA_GITHUB_TOKEN=
AICHESTRA_GITHUB_OWNER=
AICHESTRA_GITHUB_REPO=
AICHESTRA_GITHUB_ALLOWED_REPOS=
AICHESTRA_GITHUB_ALLOWED_BRANCH_PREFIX=ai/
AICHESTRA_GITHUB_INTEGRATION_TESTS=false
AICHESTRA_ENABLE_GITHUB_WEBHOOKS=false
AICHESTRA_GITHUB_WEBHOOK_SECRET_REF=
AICHESTRA_GITHUB_WEBHOOK_SECRET=
AICHESTRA_GITHUB_WEBHOOK_ALLOWED_REPOS=
AICHESTRA_GITHUB_WEBHOOK_ACCEPT_UNVERIFIED=false
AICHESTRA_GITHUB_WEBHOOK_INTEGRATION_TESTS=false
```

The preferred GitHub credential path is `AICHESTRA_GITHUB_TOKEN_SECRET_REF` with `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true` and `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` containing the referenced env key. `AICHESTRA_GITHUB_TOKEN` remains a legacy fallback when no SecretRef is configured.

The preferred webhook secret path is `AICHESTRA_GITHUB_WEBHOOK_SECRET_REF` through the same SecretRef-backed credential boundary. `AICHESTRA_GITHUB_WEBHOOK_SECRET` remains a gated legacy fallback. Webhook secrets are used only inside the verifier boundary and are never returned by `/health`, `/git/github/webhooks/config`, webhook audit, Git audit, or dashboard read models.

GitHub App Controlled Implementation v1 adds an optional GitHub App auth mode with a disabled/mock token provider boundary. It is metadata-only by default: no private key is read, no JWT is signed, no installation token is exchanged with GitHub, and no default test calls GitHub.

```bash
AICHESTRA_GITHUB_AUTH_MODE=legacy_token
AICHESTRA_ENABLE_GITHUB_APP=false
AICHESTRA_GITHUB_APP_ID=
AICHESTRA_GITHUB_APP_SLUG=
AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF=
AICHESTRA_GITHUB_APP_WEBHOOK_SECRET_REF=
AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS=
AICHESTRA_GITHUB_APP_ALLOWED_REPOS=
AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX=ai/
AICHESTRA_GITHUB_APP_INTEGRATION_TESTS=false
```

When `AICHESTRA_GITHUB_AUTH_MODE=github_app`, branch creation, PR creation, and changed-file reads still require the existing remote Git gates, repo allowlists, branch prefix, Auth/RBAC allow, Policy allow, and a successful GitHub App token-handle check. Token handles are metadata only and never expose an installation token.

GitHub App integration-test profile v1 adds a read-only optional live-test readiness surface. Default tests still skip live GitHub behavior. Future live tests require every explicit gate, a non-production repo allowlist, `AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX=ai/`, `AICHESTRA_ALLOW_REMOTE_MERGE=false`, and SecretRef metadata for private key/webhook secrets. Health, readiness, and dashboard expose counts/booleans only:

```bash
curl http://localhost:3000/readiness/github-app-integration/summary
curl http://localhost:3000/dashboard/github-app-integration
```

LLM Gateway integration-test profile v1 adds a read-only optional live-test readiness surface for the OpenAI-compatible remote path. Default tests still skip live provider behavior. Future live tests require every explicit gate, an explicit model allowlist/default model, a small budget cap, safe prompt class, fallback disabled, and SecretRef-preferred credential metadata. Health, readiness, and dashboard expose counts/booleans only:

```bash
curl http://localhost:3000/readiness/llm-integration/summary
curl http://localhost:3000/dashboard/llm-integration
```

LLM Gateway v2 remains mock-first by default. Route selection uses mock routes unless explicit routing and remote provider gates are enabled:

```bash
AICHESTRA_LLM_PROVIDER=mock pnpm --filter @aichestra/api dev
```

OpenAI-compatible settings enable the only controlled real provider path in v2 when all gates, routing rules, model allowlists, virtual-key budget policy, SecretRef credential checks, and policy checks pass:

```bash
AICHESTRA_LLM_PROVIDER=openai_compatible
AICHESTRA_LLM_ROUTING_MODE=mock_only
AICHESTRA_ENABLE_LLM_FALLBACK=false
AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS=0
AICHESTRA_ENABLE_REMOTE_LLM=false
AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=false
AICHESTRA_LLM_BASE_URL=
AICHESTRA_LLM_API_KEY_SECRET_REF=
AICHESTRA_LLM_API_KEY=
AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=false
AICHESTRA_ALLOWED_SECRET_ENV_KEYS=
AICHESTRA_LLM_ALLOWED_MODELS=
AICHESTRA_LLM_DEFAULT_MODEL=
AICHESTRA_LLM_INTEGRATION_TESTS=false
```

The preferred OpenAI-compatible credential path is `AICHESTRA_LLM_API_KEY_SECRET_REF` with the explicit env SecretRef provider enabled and allowlisted. `AICHESTRA_LLM_API_KEY` remains a legacy fallback when no SecretRef is configured. The API key is read only inside the gated provider boundary and is never returned by `/health`, `/llm/config`, `/llm/routing/decisions`, `/llm/audit`, usage metadata, or dashboard read models. BYOK, OAuth/device-code/WIF/IAM, real non-OpenAI provider calls, streaming, and Local CLI provider execution remain out of scope.

Enterprise LLM Provider Abstraction v0 adds provider catalog and credential boundary visibility only. It does not execute provider APIs or local vendor CLIs:

```bash
curl http://localhost:3000/providers
curl http://localhost:3000/providers/claude-code-local
curl http://localhost:3000/providers/auth-types
curl http://localhost:3000/providers/local-cli/templates
curl http://localhost:3000/providers/local-cli/templates/codex-cli-template-v1
curl http://localhost:3000/providers/local-cli/compatibility
curl http://localhost:3000/providers/local-cli/security-constraints
curl http://localhost:3000/providers/local-cli/readiness
curl -X POST http://localhost:3000/providers/validate \
  -H "Content-Type: application/json" \
  -d '{ "providerId": "claude-code-local" }'
curl -X POST http://localhost:3000/providers/invoke \
  -H "Content-Type: application/json" \
  -d '{ "providerId": "claude-code-local", "prompt": "blocked local CLI provider example" }'
curl http://localhost:3000/providers/audit
```

Local CLI provider entries require Local Agent Protocol coordination and use `external_cli_session` with `credentialAccess = never_read_tokens`. Aichestra does not read or upload vendor credential caches such as `~/.codex/auth.json`, `~/.claude`, or Google credential caches.

Local CLI Provider Templates v1 is implemented as metadata only. It adds template/readiness coverage for Claude Code, OpenAI Codex CLI, Gemini CLI, Aider, and a custom local CLI provider, plus compatibility rules, parser profiles, security constraints, and dashboard visibility. All templates remain `template_only`, Local Agent required, direct execution disabled, PTY unsupported, credential-cache reads denied, and secret forwarding denied. This does not implement vendor CLI execution or a production Local Agent daemon.

Local Agent Protocol v1 adds mock-first coordination for future user-machine Local Agents. It registers agent metadata, models mock signed channels, fixture daemon simulation, capability advertisements, compatibility checks, consent and invocation envelopes, records normalized redacted stream events, and uses only in-memory mock transport:

```bash
curl http://localhost:3000/local-agents
curl -X POST http://localhost:3000/local-agents/fixture/start \
  -H "Content-Type: application/json" \
  -d '{ "userId": "user_demo_admin", "hostId": "host_demo", "displayName": "Demo Fixture Agent", "agentVersion": "0.1.0-fixture", "platform": "linux-x64" }'
curl -X POST http://localhost:3000/local-agents/register \
  -H "Content-Type: application/json" \
  -d '{ "userId": "user_demo_admin", "hostId": "host_demo", "displayName": "Demo Local Agent", "agentVersion": "0.0.0-mock", "platform": "linux-x64" }'
curl http://localhost:3000/local-agents/compatibility
curl http://localhost:3000/local-agents/consent-requests
curl http://localhost:3000/local-agents/consent-queue
curl http://localhost:3000/local-agents/invocations
curl http://localhost:3000/local-agents/audit
```

Local Agent Protocol v1 does not implement a real production daemon, WebSocket/gRPC/HTTP tunnel, PTY automation, vendor CLI execution, credential-cache reads, real secret forwarding, production crypto, or production sandboxing. Direct `local_cli` execution from Aichestra Cloud remains blocked.

MCP Gateway v0 adds mock-first tool governance. It exposes deterministic mock server/tool metadata and low-risk read-only mock invocation only when Auth/RBAC and Policy permit:

```bash
curl http://localhost:3000/mcp/config
curl http://localhost:3000/mcp/servers
curl http://localhost:3000/mcp/servers/mock-docs-search-mcp/tools
curl http://localhost:3000/mcp/tools/docs.search
curl -X POST http://localhost:3000/mcp/tools/docs.search/invoke \
  -H "Content-Type: application/json" \
  -H "x-aichestra-actor-id: user_demo_developer" \
  -d '{ "input": { "query": "mcp gateway" }, "purpose": "local_mock_demo" }'
curl http://localhost:3000/mcp/invocations
curl http://localhost:3000/mcp/audit
```

Real MCP transport, stdio/http/sse MCP calls, external MCP servers, network access, write/deploy tools, SecretLease issuance to tools, model-generated automatic tool execution, and Local Agent MCP forwarding remain disabled or unimplemented.

Production Deployment Readiness Planning v0 adds planning-only deployment profiles, readiness checks, production risks, and read-only API/dashboard visibility. It does not deploy infrastructure or enable production traffic:

```bash
curl http://localhost:3000/readiness/deployment/profiles
curl http://localhost:3000/readiness/deployment/profiles/production
curl http://localhost:3000/readiness/deployment/checks
curl http://localhost:3000/readiness/deployment/risks
curl http://localhost:3000/readiness/deployment/summary
curl http://localhost:3000/dashboard/readiness
```

Production remains blocked until real auth, real secret backend, required Postgres operations, policy bundle management, durable observability backend, audit export/retention enforcement, backup/restore, tenant isolation, and production deployment controls are implemented. Readiness endpoints are read-only, local/seeded, and do not call external services or expose secrets.

Staging Deployment Profile v0 adds a non-production staging profile contract, staging environment gate matrix, integration-test policy, risk register, read-only staging readiness APIs, safe `/health` staging metadata, and a dashboard panel. It does not deploy anything, add infrastructure manifests, enable production traffic, call providers, or mark staging as production-ready:

```bash
curl http://localhost:3000/readiness/staging/profile
curl http://localhost:3000/readiness/staging/gates
curl http://localhost:3000/readiness/staging/checks
curl http://localhost:3000/readiness/staging/promotion-criteria
curl http://localhost:3000/readiness/staging/rollback-criteria
curl http://localhost:3000/readiness/staging/summary
curl http://localhost:3000/dashboard/staging
```

Staging readiness responses expose booleans, counts, statuses, blockers, and warnings only. Remote merge, remote MCP, vendor CLI execution, production auth, real secret backend integration, policy bundle runtime, external observability export, and production traffic remain blocked.

Staging Deployment Dry-run Profile v0 adds a read-only dry-run readiness aggregation surface that summarizes staging, CI/CD, DB operations, GitHub App integration tests, LLM integration tests, Secret Backend Migration, Auth/RBAC, Policy Bundle planning, Observability, MCP, Git, LLM, Local Agent, Runner, and Dashboard readiness. It does not deploy anything, run CI jobs, run remote integration tests, call providers, mutate resources, expose secrets/env values, or mark staging/production ready:

```bash
curl http://localhost:3000/readiness/staging-dry-run/profile
curl http://localhost:3000/readiness/staging-dry-run/sources
curl http://localhost:3000/readiness/staging-dry-run/checks
curl http://localhost:3000/readiness/staging-dry-run/blockers
curl http://localhost:3000/readiness/staging-dry-run/report
curl http://localhost:3000/readiness/staging-dry-run/summary
curl http://localhost:3000/dashboard/staging-dry-run
```

The dry-run report classifies blockers by severity and blocking level, classifies integration profiles as ready/gated/skipped/blocked/future, and returns promotion and rollback guidance. Current default status remains blocked/not ready because staging still lacks required rollout controls such as real secret backend readiness, production auth, durable observability, and default Postgres staging configuration.

Staging Release Candidate Checklist v0 adds a read-only release-candidate readiness surface that defines staging RC criteria, required validation gates, allowed skipped optional integrations, blocker policy, signoff expectations, release-note requirements, rollback checklist, and recommended next actions. It aggregates existing staging dry-run and readiness surfaces without creating a release, Git tag, GitHub release, deployment, active workflow, remote integration run, external provider call, or secret/env exposure:

```bash
curl http://localhost:3000/readiness/staging-rc/checklist
curl http://localhost:3000/readiness/staging-rc/gates
curl http://localhost:3000/readiness/staging-rc/blockers
curl http://localhost:3000/readiness/staging-rc/signoffs
curl http://localhost:3000/readiness/staging-rc/release-notes
curl http://localhost:3000/readiness/staging-rc/rollback
curl http://localhost:3000/readiness/staging-rc/report
curl http://localhost:3000/readiness/staging-rc/summary
curl http://localhost:3000/dashboard/staging-rc
```

The RC checklist records required validation status and skipped optional test policy only. It does not execute validation commands itself. Current default status is not ready until validation evidence, signoffs, release notes, and accepted limitation documentation are complete. Staging remains not deployed and production remains not ready.

Staging RC Evidence Pack v0 records the follow-up documentation from the Staging Release Candidate Audit v0: validation evidence, skipped optional test evidence, release-note draft, rollback evidence, and signoff readiness. It targets a future `staging_rc_pass_with_warnings` audit result only if planning-ready signoff evidence is accepted as a warning. It does not create a release, Git tag, GitHub release, deployment, remote integration run, provider call, real signoff, or production-ready claim.

Staging Deployment Execution Plan v0 adds a read-only sequence for how Aichestra would prepare a controlled staging deployment after human signoff. It defines pre-deployment gates, optional live integration decisions, go/no-go metadata, rollback criteria, future smoke placeholders, safe `/health` metadata, and a dashboard panel. Staging Human Signoff Pack v0 adds the documentation surface for collecting real human signoffs before any actual staging deployment execution. It does not deploy anything, create a release, create a Git tag, run deployment commands, run remote integration tests, call providers, or expose secrets/env values:

```bash
curl http://localhost:3000/readiness/staging-execution/plan
curl http://localhost:3000/readiness/staging-execution/steps
curl http://localhost:3000/readiness/staging-execution/gates
curl http://localhost:3000/readiness/staging-execution/go-no-go
curl http://localhost:3000/readiness/staging-execution/rollback
curl http://localhost:3000/readiness/staging-execution/summary
curl http://localhost:3000/dashboard/staging-execution
```

The signoff pack documents are under `docs/roadmaps/staging-deployment-execution/`: `human-signoff-pack-v0.md`, `signoff-evidence-checklist-v0.md`, `signoff-decision-policy-v0.md`, and `scope-separation-policy-v0.md`. The scope separation policy distinguishes reviewed target scope from audit/readiness/request evidence so later evidence-only documents do not automatically change an approved deployment candidate, while still allowing evidence findings to hold execution.

The default go/no-go status remains `not_ready` because real human signoffs are still pending before actual staging deployment. The signoff pack status is pending, approved real signoff count is zero, actual deployment remains blocked, staging remains not deployed, and production remains not ready.

Staging CI/CD Pipeline Planning v0 adds planning-only pipeline profiles, job matrix metadata, optional integration-test gates, secret/env safety rules, artifact/report policy, staging promotion criteria, cleanup/rollback policy, read-only CI/CD readiness APIs, safe `/health` metadata, and a dashboard panel. It does not create active workflows, deploy anything, call providers, run remote integrations by default, or expose secrets/env values:

```bash
curl http://localhost:3000/readiness/ci-cd/profiles
curl http://localhost:3000/readiness/ci-cd/jobs
curl http://localhost:3000/readiness/ci-cd/integration-gates
curl http://localhost:3000/readiness/ci-cd/checks
curl http://localhost:3000/readiness/ci-cd/risks
curl http://localhost:3000/readiness/ci-cd/summary
curl http://localhost:3000/dashboard/ci-cd
```

CI/CD readiness responses expose job/gate names, booleans, counts, statuses, blockers, and warnings only. Optional Postgres, remote Git/GitHub App/webhook, remote LLM, remote MCP, and external auth profiles are disabled by default and require explicit future gates before any live run.

Observability / Audit Retention v0 adds a read-only common audit envelope, retention/redaction metadata, metric snapshot, trace skeleton, source coverage, and dashboard visibility. It does not export audit logs, call external observability services, deliver alerts, or delete retained data:

```bash
curl http://localhost:3000/observability/config
curl http://localhost:3000/observability/audit/events
curl http://localhost:3000/observability/audit/summary
curl http://localhost:3000/observability/audit/retention-classes
curl http://localhost:3000/observability/audit/redaction-classes
curl http://localhost:3000/observability/audit/sources
curl -X POST http://localhost:3000/observability/audit/query-scope/check \
  -H "Content-Type: application/json" \
  -d '{ "roles": ["audit_reader"], "requestedDetailLevel": "metadata", "tenantIds": ["tenant_demo"], "resourceKinds": ["policy"], "auditSources": ["policy"] }'
curl http://localhost:3000/readiness/audit-scope/summary
curl http://localhost:3000/readiness/audit-scope/redaction-plans
curl http://localhost:3000/observability/metrics
curl http://localhost:3000/observability/metrics/snapshot
curl http://localhost:3000/observability/traces
curl http://localhost:3000/dashboard/observability
```

Audit Query Scope Enforcement v1 is check/redaction-only. Raw payload access is always forbidden, production audit storage enforcement remains false, and no external SIEM/export or provider call is made.

GitHub App / Production Webhook Hardening Planning v0 adds planning-only permission, event allowlist, replay protection, dead-letter, credential, endpoint, risk, API, and dashboard read models. It does not create a GitHub App, read private keys, mint installation tokens, call GitHub, enable production webhooks, merge, rebase, force push, or delete branches:

```bash
curl http://localhost:3000/readiness/github-app/summary
curl http://localhost:3000/readiness/github-app/permissions
curl http://localhost:3000/readiness/github-app/webhook-events
curl http://localhost:3000/readiness/github-app/replay-protection
curl http://localhost:3000/readiness/github-app/dead-letter
curl http://localhost:3000/readiness/github-app/credentials
curl http://localhost:3000/readiness/github-app/endpoint
curl http://localhost:3000/readiness/github-app/risks
curl http://localhost:3000/dashboard/github-app
```

GitHub App Controlled Implementation v1 adds runtime/status-only endpoints for the gated GitHub App boundary:

```bash
curl http://localhost:3000/git/github-app/config
curl http://localhost:3000/git/github-app/installations
curl http://localhost:3000/git/github-app/repository-grants
curl -X POST http://localhost:3000/git/github-app/validate
curl -X POST http://localhost:3000/git/github-app/installations/<installation_id>/token/check \
  -H "Content-Type: application/json" \
  -d '{ "repoRef": "aichestra/demo", "purpose": "branch_create" }'
curl http://localhost:3000/git/github-app/audit
```

These endpoints do not create a live GitHub App, read private keys, return installation tokens, expose webhook secrets, or call GitHub in default runtime/tests.

GitHub App integration-test profile v1 adds a skipped-by-default optional live-test profile with read-only readiness APIs and dashboard visibility:

```bash
curl http://localhost:3000/readiness/github-app-integration/profile
curl http://localhost:3000/readiness/github-app-integration/test-cases
curl http://localhost:3000/readiness/github-app-integration/safety-checks
curl http://localhost:3000/readiness/github-app-integration/summary
curl http://localhost:3000/dashboard/github-app-integration
```

The profile reports missing gates, unsafe gates, repo allowlist count, required branch prefix, test cases, safety checks, cleanup policy, and no-secret/no-env status only. It does not call GitHub, generate a live installation token, expose private keys/tokens/webhook secrets, auto-merge, force-push, or delete branches in default tests.

LLM Gateway integration-test profile v1 adds skipped-by-default optional live-test readiness APIs and dashboard visibility:

```bash
curl http://localhost:3000/readiness/llm-integration/profile
curl http://localhost:3000/readiness/llm-integration/test-cases
curl http://localhost:3000/readiness/llm-integration/safety-checks
curl http://localhost:3000/readiness/llm-integration/summary
curl http://localhost:3000/dashboard/llm-integration
```

The profile reports missing gates, unsafe gates, provider readiness, model allowlist count, budget status, test cases, safety checks, and no-secret/no-env/no-raw-response status only. It does not call a live LLM provider, expose API keys/env values, enable streaming/tool calls, use vendor CLI, read credential caches, or run unbounded fallback in default tests.

Persistent DB Production Operations v1 adds a non-destructive DB operations runbook, migration file readiness, index review, retention/audit growth plan, webhook persistence plan, backup/restore and pooling plans, read-only readiness APIs, safe `/health` DB operations metadata, and a dashboard panel. It does not provision or connect to production databases, run migrations automatically, run backups/restores, delete data, or expose database URLs:

```bash
curl http://localhost:3000/readiness/database/summary
curl http://localhost:3000/readiness/database/profiles
curl http://localhost:3000/readiness/database/checks
curl http://localhost:3000/readiness/database/risks
curl http://localhost:3000/readiness/database/migrations
curl http://localhost:3000/readiness/database/schema
curl http://localhost:3000/readiness/database/index-review
curl http://localhost:3000/readiness/database/retention
curl http://localhost:3000/readiness/database/audit-growth
curl http://localhost:3000/readiness/database/webhook-persistence
curl http://localhost:3000/dashboard/database
```

Secret Backend Migration Planning v0 adds planning-only backend option, SecretRef migration, credential kind migration, lease/rotation, env fallback deprecation, readiness, risk, API, health, and dashboard read models. It does not connect to Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, or custom secret backends; migrate, read, print, rotate, or issue real secrets; implement BYOK/OAuth/WIF/IAM; read credential caches; or expose env values:

```bash
curl http://localhost:3000/readiness/secrets/backends
curl http://localhost:3000/readiness/secrets/migration-phases
curl http://localhost:3000/readiness/secrets/checks
curl http://localhost:3000/readiness/secrets/risks
curl http://localhost:3000/readiness/secrets/rotation-plans
curl http://localhost:3000/readiness/secrets/lease-policies
curl http://localhost:3000/readiness/secrets/summary
curl http://localhost:3000/dashboard/secret-backend
```

Production Secret Backend Implementation Option Decision v0 selected `vault_future` as the first production-grade backend implementation path and `aws_secrets_manager_future` as the second choice for AWS-first deployments. That decision surface remains read-only metadata: it does not call Vault/cloud/custom backends, read or migrate secrets, or mark production secret backend readiness true:

```bash
curl http://localhost:3000/readiness/secret-backend-decision/decision
curl http://localhost:3000/readiness/secret-backend-decision/criteria
curl http://localhost:3000/readiness/secret-backend-decision/scores
curl http://localhost:3000/readiness/secret-backend-decision/implementation-scope
curl http://localhost:3000/readiness/secret-backend-decision/provider-mapping
curl http://localhost:3000/readiness/secret-backend-decision/risks
curl http://localhost:3000/readiness/secret-backend-decision/summary
curl http://localhost:3000/dashboard/secret-backend-decision
```

Vault-backed Secret Backend v1 implements the selected `vault` SecretRef provider as a gated, non-default backend boundary. Default runtime/tests still do not connect to Vault. Vault health/readiness/API/dashboard surfaces expose booleans, counts, status, client kind, and sanitized audit only; they never expose Vault tokens, Vault address values, secret values, env values, or credential cache paths. Production Vault rollout, HA/unseal/storage operations, AppRole/workload identity, rotation, migration, and production readiness remain out of scope:

```bash
AICHESTRA_SECRET_BACKEND_PROVIDER=mock
AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=false
AICHESTRA_VAULT_INTEGRATION_TESTS=false

curl http://localhost:3000/readiness/secrets/vault/config
curl http://localhost:3000/readiness/secrets/vault/checks
curl http://localhost:3000/readiness/secrets/vault/summary
curl http://localhost:3000/security/secrets/vault/config
curl http://localhost:3000/security/secrets/vault/health
curl http://localhost:3000/security/secrets/vault/audit
curl http://localhost:3000/dashboard/vault-secret-backend
```

Vault Integration-Test Profile v1 adds a first-class skipped-by-default readiness surface for optional live Vault KV v2 smoke validation. Missing gates skip live tests; unsafe gates block readiness. The profile never writes, deletes, rotates, broadly lists, or mutates Vault secrets, and default runtime/tests do not call Vault:

```bash
AICHESTRA_VAULT_INTEGRATION_TESTS=false

curl http://localhost:3000/readiness/vault-integration/profile
curl http://localhost:3000/readiness/vault-integration/test-cases
curl http://localhost:3000/readiness/vault-integration/safety-checks
curl http://localhost:3000/readiness/vault-integration/summary
curl http://localhost:3000/dashboard/vault-integration
```

Dashboard API-backed Read Model v0 exposes read-only dashboard DTOs without running workflows or provider calls:

```bash
curl http://localhost:3000/dashboard/overview
curl http://localhost:3000/dashboard/tasks
curl http://localhost:3000/dashboard/git
curl http://localhost:3000/dashboard/github-app
curl http://localhost:3000/dashboard/conflicts
curl http://localhost:3000/dashboard/registry
curl http://localhost:3000/dashboard/llm
curl http://localhost:3000/dashboard/agents
curl http://localhost:3000/dashboard/policy
curl http://localhost:3000/dashboard/auth
curl http://localhost:3000/dashboard/auth-production
curl http://localhost:3000/dashboard/providers
curl http://localhost:3000/dashboard/security
curl http://localhost:3000/dashboard/local-agents
curl http://localhost:3000/dashboard/mcp
curl http://localhost:3000/dashboard/readiness
curl http://localhost:3000/dashboard/database
curl http://localhost:3000/dashboard/secret-backend
curl http://localhost:3000/dashboard/secret-backend-decision
curl http://localhost:3000/dashboard/vault-secret-backend
curl http://localhost:3000/dashboard/vault-integration
curl http://localhost:3000/dashboard/staging
curl http://localhost:3000/dashboard/staging-dry-run
curl http://localhost:3000/dashboard/staging-rc
curl http://localhost:3000/dashboard/staging-execution
curl http://localhost:3000/dashboard/ci-cd
curl http://localhost:3000/dashboard/observability
curl http://localhost:3000/dashboard/audit
```

The web dashboard uses deterministic demo fallback by default for static/offline rendering. To prefer API-backed read models:

```bash
AICHESTRA_DASHBOARD_DATA_SOURCE=api
AICHESTRA_DASHBOARD_API_BASE_URL=http://127.0.0.1:3000
AICHESTRA_DASHBOARD_DISABLE_DEMO_FALLBACK=false
```

Dashboard read endpoints are read-only and do not call GitHub, LLM providers, vendor CLIs, runner commands, secret stores, Local Agent transports, or workflow execution paths. Responses are sanitized and do not expose provider tokens, API keys, raw secrets, credential cache contents, or unredacted logs.

Production Auth/RBAC Planning v0 is mock-first and is not production authentication. It exposes provider-neutral auth/RBAC metadata, a deterministic mock actor, role/permission catalogs, service-account metadata, a policy-backed authorization check, and auth audit events:

```bash
curl http://localhost:3000/auth/config
curl http://localhost:3000/auth/me
curl http://localhost:3000/auth/roles
curl http://localhost:3000/auth/permissions
curl http://localhost:3000/auth/teams
curl http://localhost:3000/auth/actors
curl http://localhost:3000/auth/service-accounts
curl http://localhost:3000/auth/role-bindings
curl -X POST http://localhost:3000/auth/authorize/check \
  -H "Content-Type: application/json" \
  -d '{ "actorId": "user_demo_developer", "action": "task.run", "resourceKind": "task" }'
curl http://localhost:3000/auth/audit
```

There is no login, logout, password, token, session, SSO, OAuth, OIDC, SAML, or SCIM endpoint. Future providers are disabled placeholders and do not call external identity systems.

API AuthContext Middleware Skeleton v1 resolves one cached mock-first context at API ingress where practical. `/auth/me` exposes a safe context summary with request id, correlation id, source, actor kind, mock marker, auth mode, and `productionAuthEnabled=false`; `/health` exposes the same safe shape without noisy ids. Cookies, Authorization headers, bearer tokens, JWTs, session ids, API keys, secret values, and env values are not stored in request context or exposed as auth metadata.

Production Auth Provider Skeleton v1 makes the future provider boundary explicit without authenticating real users. `MockAuthProvider` remains the only active default provider; future OIDC/SAML/SCIM/Microsoft Entra/Okta/Auth0/Google Workspace/GitHub Enterprise/custom providers are disabled and fail closed if selected without a future implementation. Read-only status surfaces expose only booleans, statuses, counts, provider kinds, missing config names, and blockers:

```bash
curl http://localhost:3000/readiness/auth-providers/config
curl http://localhost:3000/readiness/auth-providers/options
curl http://localhost:3000/readiness/auth-providers/session-boundary
curl http://localhost:3000/readiness/auth-providers/identity-mapping
curl http://localhost:3000/readiness/auth-providers/summary
curl http://localhost:3000/dashboard/auth-providers
```

The skeleton does not validate JWTs or identity tokens, parse real session cookies, store Authorization headers, issue sessions/API keys/JWTs/service-account credentials, run SCIM sync, call external IdPs, expose env values, or mark production auth enabled.

Service Account Actor Boundary v1 adds a mock-only service-account catalog and `ServiceAccountContextFactory` for system/service-initiated attribution. Git provider/webhook/sync, GitHub App token-handle checks, LLM gateway/router, MCP fallback invocation, Security credential resolution, Runner policy fallback, Local Agent protocol policy fallback, and Registry/Governance service paths now use service-account-shaped policy/audit metadata where practical. Production service-account credential issuance and rotation remain out of scope.

Registry/Governance RequestContext Migration v1 passes API ingress context into representative `/registry/*` and `/improvement/*` mutation/gate paths. Registry audit logs, revisions, eval metadata, governance decisions, proposal eval runs, canary readiness, apply gates, and governance audit events can carry request id, correlation id, source, auth mode, principal id, actor kind, and service account id. Explicit actor ids remain a local compatibility fallback; auto-improvement still cannot mutate active registry entries and apply remains forbidden.

Tenant/Repo/Provider Scope Model v1 adds shared scope metadata for tenants, teams, projects, repos, providers, models, SecretRefs, MCP tools, registry packages, Local Agent hosts, audit queries, and policy resources. Scope readiness APIs and dashboard panels are read-only and expose mock/readiness metadata only:

```bash
curl http://localhost:3000/readiness/scopes/summary
curl http://localhost:3000/readiness/scopes/repos
curl http://localhost:3000/readiness/scopes/providers
curl http://localhost:3000/readiness/scopes/models
curl http://localhost:3000/readiness/scopes/secrets
curl http://localhost:3000/readiness/scopes/mcp-tools
curl http://localhost:3000/readiness/scopes/registry-packages
curl http://localhost:3000/dashboard/scopes
```

Scope Model v1 does not implement production tenant provisioning, production tenant isolation, row-level security, production dashboard filtering, real Auth/RBAC, provider calls, service-account credential issuance, or secret/env exposure.

Dashboard/Readiness Tenant Scope Planning and Implementation v1 expose scope metadata for dashboard/readiness surfaces without filtering data:

```bash
curl http://localhost:3000/readiness/tenant-scope/summary
curl http://localhost:3000/readiness/tenant-scope/dashboard-scope-summaries
curl http://localhost:3000/readiness/tenant-scope/readiness-scope-summaries
curl http://localhost:3000/readiness/staging-dry-run/summary
curl http://localhost:3000/dashboard/tenant-scope
```

The scope metadata is descriptive only. It reports required dimensions, available mock/readiness dimensions, missing-scope warnings, role visibility hints, redaction labels, `tenantFilteringImplemented: false`, and `productionEnforcementImplemented: false`. Production tenant enforcement remains future.

Tenant Scope Enforcement v1 exposes partial representative metadata and helper decisions:

```bash
curl http://localhost:3000/readiness/tenant-enforcement/summary
curl http://localhost:3000/readiness/tenant-enforcement/modes
curl http://localhost:3000/readiness/tenant-enforcement/mismatches
curl http://localhost:3000/dashboard/tenant-enforcement
```

This surface reports enforcement modes, mismatch kinds, missing-scope warnings, audit-query warnings, secret-adjacent warnings, `tenantFilteringImplemented: false`, and `productionTenantEnforcement: false`. Policy deny remains authoritative; scope allow metadata does not grant access.

Production Auth/RBAC v1 Planning adds production identity/readiness planning only. It defines IdP options, the production RBAC permission matrix, tenant/scope plan, service-account/system actor plan, request context propagation plan, mock actor deprecation plan, `/readiness/auth/*`, `/dashboard/auth-production`, and safe `/health` auth readiness metadata. It does not implement real OIDC, SAML, SCIM, SSO, login/logout, sessions, JWT issuance, password auth, external IdP calls, or service-account credential issuance:

```bash
curl http://localhost:3000/readiness/auth/providers
curl http://localhost:3000/readiness/auth/migration-phases
curl http://localhost:3000/readiness/auth/checks
curl http://localhost:3000/readiness/auth/risks
curl http://localhost:3000/readiness/auth/tenant-boundaries
curl http://localhost:3000/readiness/auth/service-accounts
curl http://localhost:3000/readiness/auth/permission-matrix
curl http://localhost:3000/readiness/auth/summary
curl http://localhost:3000/dashboard/auth-production
```

Auth readiness responses are read-only and expose no tokens, cookies, session ids, passwords, raw identity assertions, IdP client secrets, or provider credentials. They mark production auth as disabled and production readiness as false.

Production Auth/RBAC Implementation Plan v1 is recorded under `docs/roadmaps/auth-rbac-production/`. It adds provider selection, session/token boundary, security/audit requirements, implementation phases, and blocker/risk planning for future Phase 5 work. It remains planning only and does not enable real auth or issue credentials.

SecretRef-backed Provider Credentials v1 adds metadata-only provider credential resolution for controlled GitHub, GitHub webhook, and OpenAI-compatible paths. The env provider is disabled by default and reads only the requested allowlisted env key referenced by an active `SecretRef` after Auth/RBAC and Policy checks:

```bash
AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=false
AICHESTRA_ALLOWED_SECRET_ENV_KEYS=
curl http://localhost:3000/security/credentials/refs
curl -X POST http://localhost:3000/security/credentials/refs \
  -H "Content-Type: application/json" \
  -d '{ "id": "secretref_llm_api_key", "name": "LLM API key", "provider": "env", "secretKind": "llm_api_key", "envKey": "AICHESTRA_LLM_API_KEY", "scope": "scope_env_provider_credentials" }'
curl -X POST http://localhost:3000/security/credentials/resolve/check \
  -H "Content-Type: application/json" \
  -d '{ "secretRefId": "secretref_llm_api_key", "purpose": "llm_api_call", "providerId": "openai_compatible" }'
curl http://localhost:3000/security/credentials/audit
```

Credential APIs return status, handles, and audit ids only. They reject raw secret fields and credential cache paths, and never return env var values.

Secrets and Sandbox Design v0 adds metadata-only security boundaries. It does not retrieve real secrets, inject secrets, run production sandboxes, or enforce network egress at the OS/container layer:

```bash
curl http://localhost:3000/security/secrets/refs
curl http://localhost:3000/security/secrets/scopes
curl -X POST http://localhost:3000/security/secrets/leases/request \
  -H "Content-Type: application/json" \
  -d '{ "secretRefId": "secretref_mock_provider_metadata", "scopeId": "scope_mock_provider_metadata" }'
curl http://localhost:3000/security/sandbox/profiles
curl -X POST http://localhost:3000/security/sandbox/sessions \
  -H "Content-Type: application/json" \
  -d '{ "profileId": "sandbox_local_temp_fixture", "runnerKind": "local" }'
curl http://localhost:3000/security/network/policies
curl http://localhost:3000/security/redaction/policies
curl -X POST http://localhost:3000/security/redaction/test \
  -H "Content-Type: application/json" \
  -d '{ "text": "Bearer demo-token OPENAI_API_KEY=demo" }'
```

Local Agent Runner v1 remains mock-first. The mock runner is the default, local runner is disabled by default, and local command execution is disabled by default:

```bash
AICHESTRA_AGENT_RUNNER=mock pnpm --filter @aichestra/api dev
```

Local runner settings are for controlled fixture/demo execution only:

```bash
AICHESTRA_AGENT_RUNNER=local
AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER=false
AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION=false
AICHESTRA_AGENT_WORKSPACE_ROOT=./fixtures/agent-workspaces
AICHESTRA_AGENT_MAX_STDOUT_BYTES=4096
AICHESTRA_AGENT_MAX_STDERR_BYTES=4096
```

Agent Worktree Allocation v1 remains disabled for production worktrees. Dry-run and fixture-only metadata can validate allowlisted roots without running `git worktree`:

```bash
AICHESTRA_ENABLE_AGENT_WORKTREE_ALLOCATION=false
AICHESTRA_AGENT_WORKTREE_INTEGRATION_TESTS=false
AICHESTRA_WORKSPACE_ROOT_ALLOWLIST=
```

Multi-session Agent Run Coordination v1 is metadata-only and mock-first. It coordinates concurrent agent sessions by repo/base branch/task/user/source scope, detects same workspace, same branch, same file, same directory, missing target-file, and base-branch drift overlap, and reports safe recommendations without executing agents, creating branches/worktrees, switching branches, calling providers, or reading secrets:

Cross-session File Lease / Edit Intent Graph v1 adds metadata-only file leases and edit intents for earlier concurrency visibility:

```bash
curl http://localhost:3000/agents/edit-intent-summary
curl http://localhost:3000/agents/edit-intent-graph?repoId=repo_demo_backend
curl http://localhost:3000/agents/edit-overlaps?repoId=repo_demo_backend
curl http://localhost:3000/agents/file-leases?repoId=repo_demo_backend
```

The endpoints never lock files, mutate source files, run Git, call providers, or expose secrets/env values.

```bash
curl -X POST http://localhost:3000/agents/sessions \
  -H "Content-Type: application/json" \
  -d '{ "userId": "user_demo_admin", "agentRunId": "agentrun_demo_a", "repoId": "repo_demo_backend", "baseBranch": "main", "branchName": "codex/demo-a", "targetFiles": ["src/auth/session.ts"] }'
curl http://localhost:3000/agents/sessions
curl -X POST http://localhost:3000/agents/sessions/<session_id>/target-files \
  -H "Content-Type: application/json" \
  -d '{ "files": ["src/auth/session.ts"] }'
curl -X POST http://localhost:3000/agents/sessions/<session_id>/ready-for-review
curl -X POST http://localhost:3000/agents/sessions/<session_id>/ready-for-merge
curl http://localhost:3000/agents/coordination/groups
curl http://localhost:3000/agents/coordination/overlaps
curl http://localhost:3000/agents/coordination/summary
curl http://localhost:3000/agents/coordination/policies
```

Multi-user / Multi-session Branch Orchestrator v2 allocates safe branch ownership metadata for concurrent users/sessions. It requires safe branch prefixes, blocks active branch collisions and shared workspace leases, links `BranchLease` and optional `WorkspaceLease` metadata, models base branch drift, and never creates real Git branches or mutates workspaces:

```bash
curl -X POST http://localhost:3000/git/branches/orchestrate \
  -H "Content-Type: application/json" \
  -d '{ "userId": "user_demo_admin", "agentRunId": "agentrun_demo_a", "taskId": "task_demo", "taskRunId": "taskrun_demo", "sessionId": "session_demo_a", "repoId": "repo_demo_backend", "baseBranch": "main", "targetFiles": ["src/auth/session.ts"] }'
curl http://localhost:3000/git/branches/orchestration
curl http://localhost:3000/git/branches/orchestration/summary
curl http://localhost:3000/git/branches/orchestration/policies
curl http://localhost:3000/git/branches/ownership
curl http://localhost:3000/git/branches/drift
```

Create a task:

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix login timeout bug",
    "description": "Investigate and fix intermittent login timeout failures.",
    "repoId": "repo_demo_backend",
    "requestedBy": "user_demo_admin",
    "preferredAgent": "mock-codex",
    "targetBranch": "main",
    "selectedModel": "mock-model",
    "selectedSkillIds": ["skill_auth_debugging"],
    "selectedHarnessId": "harness_backend_node20",
    "budgetLimitUsd": 20
  }'
```

Run the mock vertical slice for a task:

```bash
curl -X POST http://localhost:3000/tasks/<task_id>/run
```

Repeated run behavior:

- If the task already has an active TaskRun in `queued` or `running`, the API returns `409 Conflict`.
- After the latest run reaches `completed` or `failed`, another `POST /tasks/<task_id>/run` creates a new TaskRun attempt.

Inspect task-specific runs and usage:

```bash
curl http://localhost:3000/tasks/<task_id>/runs
curl "http://localhost:3000/usage?taskId=<task_id>"
```

Inspect Conflict Manager v1 state:

```bash
curl "http://localhost:3000/branches/leases?repoId=repo_demo_backend&status=active"
curl "http://localhost:3000/conflicts/risks?repoId=repo_demo_backend"
curl "http://localhost:3000/merge-queue?repoId=repo_demo_backend"
curl "http://localhost:3000/merge-simulations?repoId=repo_demo_backend"
curl -X POST http://localhost:3000/merge-simulations \
  -H "Content-Type: application/json" \
  -d '{
    "branchLeaseId": "<branch_lease_id>",
    "mode": "mock",
    "status": "clean"
  }'
curl -X POST http://localhost:3000/merge-queue/<entry_id>/mark-merged
```

`mark-merged` updates mock queue state only. It does not run Git merge, update a provider PR, push, rebase, or delete branches.

Inspect Merge Queue Policy v2 readiness metadata:

```bash
curl http://localhost:3000/git/merge-queue/policy
curl http://localhost:3000/git/merge-queue/summary
curl http://localhost:3000/git/merge-queue/decisions
curl http://localhost:3000/git/merge-queue/holds
curl -X POST http://localhost:3000/git/merge-queue/<entry_id>/evaluate \
  -H "Content-Type: application/json" \
  -d '{ "validationStatus": "passed", "approvalStatus": "approved" }'
curl -X POST http://localhost:3000/git/merge-queue/<entry_id>/hold \
  -H "Content-Type: application/json" \
  -d '{ "holdKind": "human_review_required", "severity": "warning", "reason": "Reviewer requested release sequencing check." }'
```

These policy routes are metadata-only. They record decisions, holds, warnings, required actions, and priority order while keeping merge execution and auto-merge disabled.

Inspect Registry v3 state:

```bash
curl http://localhost:3000/registry/skills
curl http://localhost:3000/registry/harnesses
curl http://localhost:3000/registry/instructions
curl -X POST http://localhost:3000/registry/resolve \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "<task_id>" }'
curl -X PATCH http://localhost:3000/registry/skills/<skill_id>/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "deprecated" }'
curl -X PATCH http://localhost:3000/registry/skills/<skill_id>/approval \
  -H "Content-Type: application/json" \
  -d '{ "approvalStatus": "approved" }'
curl -X PATCH http://localhost:3000/registry/skills/<skill_id>/eval \
  -H "Content-Type: application/json" \
  -d '{ "evalStatus": "passed" }'
curl -X POST http://localhost:3000/registry/instructions/<instruction_id>/verify-checksum
curl "http://localhost:3000/registry/audit?targetKind=skill&targetId=<skill_id>"
curl "http://localhost:3000/registry/approval-queue"
curl "http://localhost:3000/registry/skills/<skill_id>/history"
curl -X POST http://localhost:3000/registry/skills/<skill_id>/rollback \
  -H "Content-Type: application/json" \
  -d '{ "revisionNumber": 1, "reason": "restore known-good registry revision" }'
curl -X POST http://localhost:3000/registry/skills/<skill_id>/eval-results \
  -H "Content-Type: application/json" \
  -d '{
    "evalName": "manual smoke",
    "evalType": "manual",
    "status": "passed",
    "summary": "Manual registry review passed.",
    "source": "manual",
    "updateEvalStatus": true
  }'
curl http://localhost:3000/registry/skills/<skill_id>/manifest
curl http://localhost:3000/registry/bundle/manifest
curl -X POST http://localhost:3000/registry/packages/export \
  -H "Content-Type: application/json" \
  -d '{ "packageKind": "skill", "targetId": "<skill_id>" }'
curl -X POST http://localhost:3000/registry/packages/import/dry-run \
  -H "Content-Type: application/json" \
  -d @local-package-import.json
curl -X POST http://localhost:3000/registry/packages/diff \
  -H "Content-Type: application/json" \
  -d @local-package-diff.json
```

`local-package-import.json` should wrap an exported manifest as `{ "manifest": <exported manifest JSON> }`.
`local-package-diff.json` should provide `{ "fromManifest": <manifest JSON>, "toManifest": <manifest JSON> }`.

Inspect Real Git Adapter v2 state:

```bash
curl http://localhost:3000/git/providers
curl http://localhost:3000/git/config
curl http://localhost:3000/git/repos
curl -X POST http://localhost:3000/git/repos \
  -H "Content-Type: application/json" \
  -d '{ "provider": "mock", "owner": "aichestra", "name": "demo-backend", "defaultBranch": "main" }'
curl -X POST http://localhost:3000/git/repos/<repo_id>/branches \
  -H "Content-Type: application/json" \
  -d '{ "branchName": "codex/fix-login-timeout", "baseBranch": "main" }'
curl -X POST http://localhost:3000/git/repos/<repo_id>/pull-requests \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "<task_id>", "branchName": "codex/fix-login-timeout", "title": "Fix login timeout bug" }'
curl http://localhost:3000/git/repos/<repo_id>/pull-requests
curl "http://localhost:3000/git/pull-requests/<pr_id>/changed-files?branchName=codex/fix-login-timeout"
curl -X POST http://localhost:3000/git/github/validate
curl -X POST http://localhost:3000/git/repos/<repo_id>/branches/remote \
  -H "Content-Type: application/json" \
  -d '{ "branchName": "ai/controlled-branch", "baseBranch": "main" }'
curl -X POST http://localhost:3000/git/repos/<repo_id>/pull-requests/remote \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "<task_id>", "branchName": "ai/controlled-branch", "title": "Controlled GitHub PR" }'
curl http://localhost:3000/git/repos/<repo_id>/pull-requests/42/changed-files
curl http://localhost:3000/git/github/webhooks/config
curl http://localhost:3000/git/github/webhooks/events
curl http://localhost:3000/git/github/webhooks/audit
curl http://localhost:3000/git/repos/<repo_id>/pr-sync
curl http://localhost:3000/git/repos/<repo_id>/branch-sync
curl -X POST http://localhost:3000/git/repos/<repo_id>/pull-requests/42/sync
curl -X POST http://localhost:3000/git/repos/<repo_id>/pull-requests/42/refresh-changed-files
curl http://localhost:3000/git/audit
curl http://localhost:3000/git/remote/audit
```

Inspect LLM Gateway v2 state:

```bash
curl http://localhost:3000/llm/providers
curl http://localhost:3000/llm/config
curl http://localhost:3000/llm/routing/config
curl http://localhost:3000/llm/models
curl http://localhost:3000/llm/routes
curl http://localhost:3000/llm/fallback-policies
curl http://localhost:3000/llm/providers/health
curl http://localhost:3000/llm/virtual-keys
curl -X POST http://localhost:3000/llm/route \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "<task_id>", "taskRunId": "<task_run_id>", "modelRef": "mock-coder@1.0", "prompt": "Fix login bug", "budgetLimitUsd": 1 }'
curl -X POST http://localhost:3000/llm/completions \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "<task_id>", "taskRunId": "<task_run_id>", "modelRef": "mock-coder@1.0", "prompt": "Fix login bug", "budgetLimitUsd": 1 }'
curl http://localhost:3000/llm/routing/decisions
curl http://localhost:3000/llm/usage
curl http://localhost:3000/llm/audit
```

Inspect Local Agent Runner v1 state:

```bash
curl http://localhost:3000/agents/runners
curl http://localhost:3000/agents/config
curl http://localhost:3000/agents/executors
curl http://localhost:3000/agents/workspaces
curl -X POST http://localhost:3000/agents/runs \
  -H "Content-Type: application/json" \
  -d '{ "taskId": "<task_id>", "taskRunId": "<task_run_id>", "selectedModelRef": "mock-coder@1.0", "prompt": "Fix login bug" }'
curl http://localhost:3000/agents/runs
curl http://localhost:3000/agents/runs/<agent_run_id>/audit
curl http://localhost:3000/agents/runs/<agent_run_id>/instructions
curl http://localhost:3000/agents/runs/<agent_run_id>/commands
curl http://localhost:3000/agents/runs/<agent_run_id>/workspace
curl -X POST http://localhost:3000/tasks/<task_id>/run-agent
curl http://localhost:3000/tasks/<task_id>/agent-runs
```

Inspect Policy-as-code Skeleton v0 state:

```bash
curl http://localhost:3000/policy/config
curl http://localhost:3000/policy/rules
curl -X POST http://localhost:3000/policy/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "subject": { "actorId": "user_demo_admin", "actorKind": "user", "roles": ["system"] },
    "action": "llm.completion",
    "resource": { "resourceKind": "llm_provider", "resourceId": "mock", "metadata": { "providerKind": "mock" } },
    "context": { "providerKind": "mock", "environment": { "budgetAllowed": true } }
  }'
curl -X POST http://localhost:3000/policy/evaluate-many \
  -H "Content-Type: application/json" \
  -d '{ "requests": [] }'
curl http://localhost:3000/policy/audit
```

Policy Bundle / OPA-Cedar Planning v0 adds planning-only engine options, bundle plans, policy domain mapping, readiness checks, risks, migration phases, `/readiness/policy-bundles/*`, `/dashboard/policy-bundles`, and safe `/health` policy bundle metadata. It does not implement OPA/Rego, Cedar, external policy decision services, dynamic policy execution, remote bundle loading, hot reload, signed bundle verification, rollout, rollback, or break-glass execution:

```bash
curl http://localhost:3000/readiness/policy-bundles/engines
curl http://localhost:3000/readiness/policy-bundles/plans
curl http://localhost:3000/readiness/policy-bundles/domain-mapping
curl http://localhost:3000/readiness/policy-bundles/checks
curl http://localhost:3000/readiness/policy-bundles/risks
curl http://localhost:3000/readiness/policy-bundles/migration-phases
curl http://localhost:3000/readiness/policy-bundles/summary
curl http://localhost:3000/dashboard/policy-bundles
```

Policy Runtime Shadow Evaluation Planning v1 adds read-only plan, comparison rule, mismatch taxonomy, report, readiness check, summary, dashboard, and safe `/health` metadata for a future static-vs-candidate comparison path. It keeps `StaticPolicyEngine` as source of truth and does not run a shadow evaluator or candidate runtime:

```bash
curl http://localhost:3000/readiness/policy-shadow/plan
curl http://localhost:3000/readiness/policy-shadow/comparison-rules
curl http://localhost:3000/readiness/policy-shadow/mismatches
curl http://localhost:3000/readiness/policy-shadow/reports
curl http://localhost:3000/readiness/policy-shadow/checks
curl http://localhost:3000/readiness/policy-shadow/summary
curl http://localhost:3000/dashboard/policy-shadow
```

Policy Bundle Runtime PoC Planning v0 adds planning-only runtime PoC options, a normalized policy input/output contract, PoC domain mappings, golden decision cases, readiness checks, risks, `/readiness/policy-runtime-poc/*`, `/dashboard/policy-runtime-poc`, and safe `/health` metadata. Policy Runtime Shadow Evaluation Planning v1 adds read-only shadow plan, comparison-rule, mismatch-taxonomy, readiness, and summary metadata at `/readiness/policy-shadow/*`, and extends the Policy Runtime PoC dashboard panel. Neither milestone implements OPA/Rego, Cedar, signed JSON/YAML evaluation, a custom policy service, shadow evaluation, dynamic policy execution, remote policy loading, hot reload, or runtime enforcement. `StaticPolicyEngine` remains the source of truth:

```bash
curl http://localhost:3000/readiness/policy-runtime-poc/options
curl http://localhost:3000/readiness/policy-runtime-poc/input-contract
curl http://localhost:3000/readiness/policy-runtime-poc/domain-mappings
curl http://localhost:3000/readiness/policy-runtime-poc/golden-cases
curl http://localhost:3000/readiness/policy-runtime-poc/golden-summary
curl http://localhost:3000/readiness/policy-runtime-poc/checks
curl http://localhost:3000/readiness/policy-runtime-poc/risks
curl http://localhost:3000/readiness/policy-runtime-poc/summary
curl http://localhost:3000/readiness/policy-shadow/plan
curl http://localhost:3000/readiness/policy-shadow/comparison-rules
curl http://localhost:3000/readiness/policy-shadow/mismatches
curl http://localhost:3000/readiness/policy-shadow/checks
curl http://localhost:3000/readiness/policy-shadow/summary
curl http://localhost:3000/dashboard/policy-runtime-poc
```

Policy Runtime PoC Golden Test Harness v1 adds offline typed fixtures and StaticPolicyEngine-only comparison in `packages/policy/src/golden-cases.ts` and `packages/policy/src/golden-harness.ts`. Policy Runtime Shadow Evaluation Planning v1 defines how a future candidate runtime would be compared against that static baseline, but does not run a candidate runtime or change enforcement.

## Test

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Optional Postgres repository contract tests are skipped unless `AICHESTRA_TEST_DATABASE_URL` is set.

Validation covers lint, TypeScript checking, tests, and a scaffold build smoke check. Tests cover task status transitions, repeated run conflict behavior, instruction precedence, mock LLM usage metadata, LLM Gateway v1/v2 provider/catalog/routing/fallback/virtual-key/budget/usage/API/OpenAI-compatible mocked HTTP behavior, MCP Gateway v0 catalog/invocation/policy/auth/API/health/dashboard/no-secret behavior, Local Agent Protocol v0 and v1 registration/consent/invocation/mock transport/channel/fixture daemon/compatibility/stream/API/provider integration behavior, mock Git conflict risk, Conflict Manager scoring, merge simulation, Merge Queue Policy v2 readiness/hold/ranking/API/dashboard/no-merge-execution behavior, API health, API task execution, API AuthContext Middleware Skeleton v1 ingress/source-mode/safe-summary/no-token behavior, Service Account Actor Boundary v1 catalog/context-factory/policy/audit/no-credential behavior, Registry/Governance RequestContext Migration v1 registry/governance API/service/audit/apply-gate/no-secret behavior, Local Agent Runner v1 mock/local safety behavior, Agent Workspace Lifecycle v2 lease/cleanup metadata, Multi-session Agent Run Coordination v1 session registration/grouping/overlap detection/API/dashboard/no-execution behavior, Multi-user / Multi-session Branch Orchestrator v2 branch naming/ownership/collision/drift/API/dashboard/no-destructive-Git behavior, Cross-session File Lease / Edit Intent Graph v1 intent/lease/graph/overlap/API/dashboard/no-lock/no-source-mutation behavior, command executor blocking and fixture execution, workspace validation/cleanup, harness policy, instruction assembly, runner API behavior, Policy-as-code v0 static rules/audit/API/service integrations, Policy Bundle / OPA-Cedar Planning v0 readiness models/API/health/dashboard/no-dynamic-execution/no-secret behavior, Policy Runtime Shadow Evaluation Planning v1 models/API/health/dashboard/no-candidate-runtime/no-enforcement-change/no-dynamic-execution/no-secret/no-env behavior, Production Auth/RBAC Planning v0 domain/provider/authorization/API/health/dashboard/no-secret behavior, Production Auth/RBAC v1 Planning readiness models/API/health/dashboard/no-token/no-session behavior, Production Auth Provider Skeleton v1 provider registry/disabled-provider/API/health/dashboard/no-token/no-session/no-cookie/no-env behavior, Secrets and Sandbox v0 secret/sandbox/network/redaction/API/dashboard behavior, Vault-backed Secret Backend v1 config/SecretRef validation/mock client/provider/CredentialManager/API/health/dashboard/no-token/skipped-live-test behavior, Production Secret Backend Implementation Option Decision v0 decision/criteria/score/scope/provider-mapping/risk/API/health/dashboard/no-backend-call/no-secret/no-env behavior, Observability / Audit Retention v0 envelope/sanitizer/source-normalization/retention/API/dashboard/metric/trace/no-secret behavior, Audit Query Scope Enforcement v1 role/scope/redaction/API/dashboard/no-raw-payload/no-secret behavior, GitHub App / Production Webhook Hardening Planning v0 permission/event/replay/dead-letter/API/dashboard/no-secret behavior, GitHub App Controlled Implementation v1 config/token-provider/SecretRef/Auth/RBAC/Policy/API/health/dashboard/no-secret behavior, GitHub App integration-test profile v1 readiness models/API/health/dashboard/skipped-live-test/no-secret/no-env/no-destructive-git behavior, Persistent DB Production Operations v1 migration/index/retention/webhook/API/health/dashboard/no-DB-url behavior, Staging Deployment Profile v0 profile/gates/checks/promotion/rollback/API/health/dashboard/no-secret/no-env behavior, Staging Deployment Dry-run Profile v0 models/aggregation/API/health/dashboard/no-deployment/no-external-call/no-secret/no-env behavior, Staging Release Candidate Checklist v0 checklist/gate/blocker/signoff/release-note/rollback/report/API/health/dashboard/no-release/no-deployment/no-external-call/no-secret/no-env behavior, Staging Deployment Execution Plan v0 and Human Signoff Pack v0 plan/step/gate/go-no-go/rollback/signoff-pack/API/health/dashboard/no-release/no-deployment/no-external-call/no-secret/no-env behavior, Staging CI/CD Pipeline Planning v0 profiles/jobs/integration-gates/checks/risks/API/health/dashboard/no-secret/no-env behavior, Dashboard API-backed Read Model v0 endpoints/provider/fallback/no-secret behavior, registry APIs, registry DTOs, repository boundaries, mutation audit logs, approval/eval gates, checksum verification, registry history, rollback, approval queue read models, local eval result attachment, mock RBAC, registry package manifests, local import/export, dry-run import, semver range resolution v0, dependency warnings/errors, package diffs, registry resolver behavior, Phase 4 Preparation signals/clusters/candidates/proposals/eval requirements/canary plans/safety policy APIs, Phase 4 Auto-improvement v0 analyses/draft changes/readiness checks, Phase 4 Governance v1 review queues/decisions/eval runs/canary readiness/apply gates/audit events, storage provider repository contracts, optional Postgres repository contracts, Real Git Adapter v0/v1/v2 provider/service/API/webhook/sync behavior, mock workflow success, policy denial, usage attribution, dashboard assumptions, and Skill/Harness/Instruction separation.

Conflict Resolution Assistant v1 adds deterministic tests for request creation, same-file and same-directory summaries, manual-review plans, suggested validation, merge queue hold linkage, no real LLM calls, no source mutation, API safety, dashboard rendering, and secret redaction.

PR Ownership / Handoff Model v1 adds deterministic tests for ownership creation, BranchLease/PR/merge queue linkage, handoff request/accept/reject/expiry, policy denial, local reviewer metadata, future human-to-agent handoff blocking, merge queue ownership readiness, conflict resolution plan owner links, no source-store mutation, API safety, dashboard rendering, no remote PR update, no GitHub API calls, no auto-merge, and secret redaction.

Validation also covers Policy Bundle Runtime PoC Planning v0, Policy Runtime PoC Golden Test Harness v1, and OIDC Provider Skeleton Hardening v1 as readiness-only/offline safety surfaces without dynamic policy runtime execution or real identity-provider calls.

## First Vertical Slice

The first working slice is implemented with mock adapters only:

```text
User creates a task
-> API triggers worker run
-> policy is checked
-> registry resolver selects mock model context, skill refs, harness ref, and instruction refs
-> mock branch is prepared
-> mock agent generates changed files and diff summary
-> Local Agent Runner v1 can separately record mock runner metadata, instruction assembly, controlled fixture command results, workspace status, and LLM usage linkage
-> Multi-session Agent Run Coordination v1 can separately record session/branch/workspace/file overlap metadata before future execution
-> Multi-user / Multi-session Branch Orchestrator v2 can separately allocate safe branch ownership metadata before future Git execution
-> Cross-session File Lease / Edit Intent Graph v1 can separately record file lease/edit intent graph metadata before future execution
-> mock tests pass
-> mock dry-run merge simulation records clean/conflict evidence
-> mock PR is created
-> merge queue entry is created from active lease conflict risk and simulation status
-> Merge Queue Policy v2 records readiness decision, holds, ranking metadata, and disabled merge execution status
-> Conflict Resolution Assistant v1 records review-only conflict summaries, resolution plans, recommendations, and hold linkage metadata
-> PR Ownership / Handoff Model v1 records local owner/reviewer metadata, handoff workflow state, and merge queue owner readiness without remote PR updates
-> usage ledger records mock tokens/cost
-> task reaches completed
-> web dashboard consumes read models and shows status, mock PR, diff summary, dry-run status, and mock cost
```

## MVP Scope

Included:

- Task creation and state tracking.
- Mock Git branch/PR management.
- Conflict Manager v1 active leases, file-overlap risk scoring, local/mock dry-run merge simulation, and mock merge queue.
- Merge Queue Policy v2 metadata-only policy models, readiness decisions, holds, deterministic ranking, API/dashboard visibility, Policy-as-code gates, and explicit disabled merge execution/auto-merge status.
- Conflict Resolution Assistant v1 metadata-only request, summary, classification, review-only resolution plan, recommendation, suggested validation/test, merge queue hold linkage, API/dashboard/health visibility, and explicit no-auto-apply/no-source-mutation status.
- PR Ownership / Handoff Model v1 metadata-only PR/branch/task/agent ownership records, handoff requests/decisions/audit, local reviewer metadata, merge queue owner readiness, conflict resolution owner links, API/dashboard/readiness/health visibility, and explicit no-remote-PR-update/no-auto-merge status.
- Mock LLM usage tracking.
- Skill, Harness, and Instruction Registry Packaging & Versioning v3 with exact refs, semver range resolution v0, package manifests, local import/export, package diffs, repository boundaries, in-memory and file-backed local storage, stable DTOs, audit logs, append-only history, rollback, approval/eval gates, approval queue read models, local eval result attachment, mock mutation RBAC, local checksum verification, Registry Signed Package / Artifact Trust v1 metadata, APIs, resolver-backed task selection, TaskRun registry refs, and dashboard visibility.
- Phase 4 Preparation foundations, Auto-improvement v0, and Governance v1 for failure signals, deterministic clusters, improvement candidates, draft proposal metadata, draft registry changes, readiness blockers, proposal review queues, governance decisions, proposal eval run metadata, canary readiness, apply gates, governance audit events, eval requirements, canary rollout plan metadata, safety policy guardrails, APIs, tests, and dashboard visibility.
- Usage ledger and audit log.
- Dashboard API-backed Read Model v0 shared DTOs, `/dashboard/*` read-only endpoints, API/demo data providers, explicit static fallback, no-secret sanitization, and read-model rendering, including the Auth/RBAC Production Readiness panel, Production Auth Provider Skeleton panel, Dashboard/Readiness Tenant Scope Implementation v1 metadata hints, Tenant Scope Enforcement v1 partial metadata, Audit Query Scope Enforcement v1 observability metadata, and the Registry Artifact Trust panel.
- Observability / Audit Retention v0 common audit envelope, audit taxonomy, retention classes, redaction classes, no-secret audit sanitizer, source normalization, retention policy read models, metric snapshot, trace skeleton, Audit Query Scope Enforcement v1 check/redaction metadata, `/observability/*`, `/dashboard/observability`, dashboard rendering, and tests without external observability backends or exporters.
- GitHub App / Production Webhook Hardening Planning v0 permission matrix, webhook event allowlist, replay classification model, retry/dead-letter and credential/endpoint plans, `/readiness/github-app/*`, `/dashboard/github-app`, and tests without GitHub calls, private key reads, token exchange, or production webhook enablement.
- GitHub App Controlled Implementation v1 runtime config, installation/repo grant read models, disabled/mock token provider boundary, metadata-only private-key SecretRef checks, Auth/RBAC and Policy integration, `/git/github-app/*`, health/dashboard metadata, and tests without private-key signing, real installation token exchange, GitHub calls, or token exposure.
- GitHub App integration-test profile v1 read-only profile/test-case/safety-check/summary models, `/readiness/github-app-integration/*`, `/dashboard/github-app-integration`, safe health metadata, skipped live-test skeleton, and tests without default GitHub calls, secret/env exposure, auto-merge, force-push, or branch deletion.
- LLM Gateway integration-test profile v1 read-only profile/test-case/safety-check/summary models, `/readiness/llm-integration/*`, `/dashboard/llm-integration`, safe health metadata, skipped live-test skeleton, and tests without default LLM calls, API key/env exposure, raw provider response exposure, streaming, tool calling, vendor CLI, or credential cache access.
- Persistent DB Production Operations v1 DB operations runbook, migration readiness, index review, retention/audit growth plan, webhook persistence plan, backup/restore and pooling plans, `/readiness/database/*`, `/dashboard/database`, health metadata, and tests without production DB connections, automatic migrations, backup/restore jobs, destructive retention jobs, or DB URL exposure.
- Production Auth/RBAC Planning v0 provider-neutral auth/RBAC models, deterministic MockAuthProvider, disabled future OIDC/SAML/SCIM/service-account provider placeholders, AuthorizationService, RequestContext helpers, PolicySubject mapping, `/auth/*` API visibility, health/dashboard auth mode visibility, sanitized auth audit, and tests.
- Production Auth/RBAC v1 Planning IdP options, production RBAC permission matrix, tenant/scope model, service account/system actor plan, request context propagation plan, mock actor deprecation plan, `/readiness/auth/*`, `/dashboard/auth-production`, safe health metadata, and tests without real auth, sessions, tokens, cookies, or IdP calls.
- Production Auth Provider Skeleton v1 disabled future OIDC/SAML/SCIM/vendor/custom provider classes, provider registry and selection metadata, session/token boundary plans, identity mapping plans, `/readiness/auth-providers/*`, `/dashboard/auth-providers`, `/auth/config`, safe health metadata, and tests without token validation, session issuance, cookie parsing, Authorization-header storage, SCIM sync, external IdP calls, env value exposure, or production-auth claims.
- API AuthContext Middleware Skeleton v1 API ingress helper, cached mock-first RequestContext resolution, dashboard/readiness source modes, safe `/health` and `/auth/me` summaries, representative route propagation, and tests without real auth, sessions, tokens, cookies, or Authorization-header auth.
- Service Account Actor Boundary v1 static mock service-account catalog, `ServiceAccountContextFactory`, `mock_service_account` AuthContext/PolicySubject mapping, serviceAccountId audit/observability metadata, Git/LLM/MCP/Security/Runner/Local Agent fallback attribution, and tests without real service-account credentials, JWTs, API keys, sessions, provider tokens, credential rotation, or production auth enablement.
- Registry/Governance RequestContext Migration v1 high-value registry/governance RequestContext propagation, service-account attribution, audit/correlation metadata, API route migration, and tests without real auth, real service-account credentials, auto-apply, active registry mutation from auto-improvement, or production governance enablement.
- Tenant/Repo/Provider Scope Model v1 common scope models, deterministic mock scope catalog, `ScopeContextFactory`, `PolicyResourceScope` helpers, optional AuthContext/RequestContext/PolicySubject scope fields, representative Git/LLM/MCP/Security/Registry/Governance/Observability metadata, `/readiness/scopes/*`, `/dashboard/scopes`, Dashboard/Readiness Tenant Scope Planning and Implementation v1 metadata surfaces, Tenant Scope Enforcement v1 partial decision/helper metadata, and tests without production tenant enforcement, row-level security, provider calls, secret/env exposure, or production auth enablement.
- Persistent DB v1 opt-in Postgres storage for Task, TaskRun, UsageLedger, BranchLease, MergeSimulationResult, MergeQueueEntry, Skill, Harness, Instruction, registry audit/history, registry packages, and registry eval results.
- Real Integration Foundation v0 storage provider abstraction, repository inventory, Postgres schema design, migration skeleton, auth/RBAC readiness, Real Git Adapter readiness, dashboard read model plan, and repository contract tests.
- Real Git Adapter v2 provider boundary, deterministic MockGitProvider default, LocalGitProvider fixture-safe changed-file inspection, gated GitHubGitProvider, GitHubClient boundary, controlled GitHub branch/PR/changed-file operations, disabled-by-default GitHub webhook receiver, verifier interface, PR/branch sync read models, GitIntegrationService, `/git/*` API visibility, health metadata, Git/webhook audit events, and dashboard visibility.
- Multi-user / Multi-session Branch Orchestrator v2 metadata-only branch allocation and ownership models, deterministic safe `aichestra/` branch naming policy, branch collision detection, same-workspace blockers, BranchLease and optional WorkspaceLease linkage, base drift metadata, `/git/branches/orchestrate`, `/git/branches/orchestration*`, `/git/branches/ownership`, `/git/branches/drift`, dashboard visibility, and tests without real branch creation, Git mutation, provider calls, or secret/env exposure.
- LLM Gateway v2 provider boundary, deterministic MockLLMProvider default, gated OpenAI-compatible HTTP provider path, route/fallback/routing-decision repositories, provider health read models, disabled provider skeletons, model catalog, virtual model keys, budget checks, usage ledger integration, `/llm/*` API visibility, health metadata, LLM audit events, and dashboard visibility.
- SecretRef-backed Provider Credentials v1 metadata-only SecretRef credential model, explicit env secret provider, Auth/RBAC and Policy-backed credential manager/handle/resolution results, GitHub token/webhook and LLM credential integration, `/security/credentials/*` API visibility, health/dashboard status, credential audit, and redaction tests.
- Vault-backed Secret Backend v1 gated `provider: vault` SecretRef support, disabled/mock/gated HTTP Vault client boundary, KV v2 metadata mapping, Auth/RBAC and Policy checks before Vault reads, path allowlist checks, metadata-only leases/handles/audit, `/readiness/secrets/vault/*`, `/security/secrets/vault/*`, `/dashboard/vault-secret-backend`, safe health metadata, deterministic mock tests, and skipped-by-default live Vault test skeleton without making Vault default or production-ready.
- Local Agent Runner v1 provider boundary, deterministic MockAgentRunner default, disabled-by-default LocalAgentRunner, controlled fixture command execution boundary, workspace validation, Agent Workspace Lifecycle v2 lease/cleanup metadata, Multi-session Agent Run Coordination v1 session/group/overlap/concurrency policy metadata, Cross-session File Lease / Edit Intent Graph v1 file lease/edit intent graph metadata, harness policy gates, instruction assembly, `/agents/*` API visibility, health metadata, command result/workspace/coordination/edit-intent read models, runner audit events, and dashboard visibility.
- Policy-as-code Skeleton v0 static policy engine, provider-neutral policy models, restrictive default rules, policy audit read model, `/policy/*` API visibility, health metadata, dashboard visibility, and Git/LLM/Runner/Registry service-boundary checks.
- Policy Bundle / OPA-Cedar Planning v0 engine comparison, bundle schema, policy domain mapping, review workflow, test strategy, rollout/rollback, break-glass plan, `/readiness/policy-bundles/*`, `/dashboard/policy-bundles`, safe health metadata, and tests without OPA/Cedar/runtime bundle execution, external policy service calls, dynamic policy execution, or secrets.
- Policy Runtime Shadow Evaluation Planning v1 architecture, candidate-runtime interface expectations, comparison rules, mismatch taxonomy, planning reports, readiness checks, rollout/rollback plan, `/readiness/policy-shadow/*`, `/dashboard/policy-shadow`, safe health metadata, and tests without shadow evaluator execution, candidate runtime execution, OPA/Cedar runtime, signed bundle verification runtime, external policy service calls, dynamic policy execution, enforcement changes, secrets, or env values.
- Policy Bundle Runtime PoC Planning v0 runtime PoC option comparison, normalized policy input/output contract, domain PoC mapping, shadow evaluation plan, golden decision tests, read-only `/readiness/policy-runtime-poc/*`, `/dashboard/policy-runtime-poc`, safe health metadata, and tests without OPA/Cedar/signed JSON-YAML runtime execution, shadow enforcement, external policy service calls, dynamic policy execution, or secrets.
- Policy Runtime PoC Golden Test Harness v1 typed golden fixtures, StaticPolicyEngine-only comparison, deterministic pass/fail summary, read-only `/readiness/policy-runtime-poc/golden-summary`, dashboard golden harness metadata, and tests without OPA/Cedar/signed JSON-YAML runtime execution, shadow enforcement, external policy service calls, dynamic policy execution, or secrets.
- Policy Runtime Shadow Evaluation Planning v1 future shadow architecture, candidate runtime interface expectations, comparison rules, mismatch taxonomy, reporting, rollout/rollback, read-only `/readiness/policy-shadow/*`, dashboard shadow planning metadata, and tests without candidate runtime execution, enforcement changes, external policy service calls, dynamic policy execution, or secrets.
- Production Secret Backend Implementation Option Decision v0 decision criteria, backend evaluation, recommendation, SecretRef provider mapping, v1 implementation scope, env migration plan, test strategy, risk register, read-only `/readiness/secret-backend-decision/*`, `/dashboard/secret-backend-decision`, safe health metadata, and tests without Vault/cloud/custom backend calls, secret reads, secret migration, rotation, production credential issuance, env value exposure, credential cache reads, BYOK, OAuth, WIF, IAM, or production-ready claims.
- Staging Deployment Profile v0 non-production profile contract, staging environment gate matrix, integration-test policy, risk register, read-only `/readiness/staging/*`, `/dashboard/staging`, safe health metadata, and tests without deployment, external provider calls, secrets, env values, remote MCP, vendor CLI execution, or production traffic.
- Staging Deployment Dry-run Profile v0 read-only readiness aggregation, source/check/blocker/report/summary models, blocker taxonomy, report format, `/readiness/staging-dry-run/*`, `/dashboard/staging-dry-run`, safe health metadata, and tests without deployment, external provider calls, remote integration-test execution, secrets, env values, destructive Git, real MCP transport, vendor CLI execution, staging-deployed claims, or production-ready claims.
- Staging Release Candidate Checklist v0 read-only RC criteria, validation gate, optional skipped integration, blocker, signoff, release-note, rollback, report, and summary models, `/readiness/staging-rc/*`, `/dashboard/staging-rc`, safe health metadata, and tests without release creation, Git tag creation, GitHub release creation, deployment, external provider calls, remote integration-test execution, secrets, env values, destructive Git, real MCP transport, vendor CLI execution, staging-deployed claims, or production-ready claims.
- Staging Deployment Execution Plan v0 and Human Signoff Pack v0 read-only staging execution sequence, pre-deploy gate, optional integration decision, go/no-go, rollback, signoff pack, and summary models, `/readiness/staging-execution/*`, `/dashboard/staging-execution`, safe health metadata, and tests without release creation, Git tag creation, deployment, external provider calls, remote integration-test execution, secrets, env values, destructive Git, real MCP transport, vendor CLI execution, fake approval claims, staging-deployed claims, or production-ready claims.
- Staging CI/CD Pipeline Planning v0 job matrix, optional integration-test gate policy, secret/env safety, artifact/report policy, staging promotion criteria, cleanup/rollback planning, read-only `/readiness/ci-cd/*`, `/dashboard/ci-cd`, safe health metadata, and tests without active workflows, deployment, default remote integrations, secrets, or env values.
- Enterprise LLM Provider Abstraction v0 provider kind/auth models, provider catalog skeletons, CredentialManager/TokenResolver interfaces, blocked ProviderAdapter skeletons, Local CLI provider contract, Aichestra Local Agent boundary models, parser/redaction utilities, `/providers/*` API visibility, health metadata, provider audit events, dashboard visibility, and policy hooks.
- Local CLI Provider Templates v1 metadata-only templates for Claude Code, OpenAI Codex CLI, Gemini CLI, Aider, and custom local CLI providers, with compatibility rules, parser profiles, security constraints, read-only API/dashboard readiness, and no vendor CLI execution.
- Secrets and Sandbox Design v0 metadata-only secret refs/scopes/leases, mock secret manager, sandbox profiles/sessions, network egress policy, redaction policy, security audit events, `/security/*` API visibility, health metadata, dashboard visibility, and runner sandbox-session policy hooks.
- Aichestra Local Agent Protocol v1 registration/session/capability models, mock signed channel and handshake models, fixture daemon simulation, capability advertisements, CLI compatibility matrix, invocation envelopes, consent lifecycle, normalized stream event records, in-memory mock transport, `/local-agents/*` API visibility, health metadata, dashboard visibility, provider integration, protocol audit events, and redaction/policy/security gates.
- MCP Gateway v0 mock server/tool catalog, deterministic `MockMCPGateway`, disabled real transport skeleton, `/mcp/*` API visibility, `/dashboard/mcp`, health metadata, MCP audit events, and Auth/RBAC, Policy, redaction, and no-secret gates.

Deferred:

- Phase 4 governance repositories remain in-memory for v1.
- Production database operations remain not production-ready: v1 documents and exposes readiness metadata, but real pooling, backup/restore jobs, migration governance enforcement, retention deletion/legal hold, partitioning jobs, and async repository refactors are still deferred.
- Real LLM provider calls by default. LLM Gateway v2 supports one controlled OpenAI-compatible path only when explicit integration, routing, credential, policy, and budget gates are configured; other provider kinds are skeleton/read-model only.
- Real Codex CLI, Claude Code, Aider, or production runner integration.
- Local command execution outside controlled fixture/temp workspace mode.
- BYOK, production provider API key storage, production credential issuance, real streaming, real billing, real non-OpenAI-compatible provider calls, and default remote LLM completions.
- Real GitHub writes outside explicit gates, and all GitLab/Bitbucket writes.
- Remote git fetch, push, provider merge, provider rebase, force push, branch deletion, public webhook exposure by default, production GitHub App rollout, GitHub App private key signing, real installation token exchange in default tests/runtime, reviewer automation, distributed branch ownership locks, real branch orchestrator Git execution, or real merge queue execution.
- Automatic conflict resolution, patch application, source-file mutation, conflict assistant LLM completion, merge queue hold release, and conflict assistant merge execution.
- Real Kubernetes, Temporal, MCP gateway, SSO, OAuth/OIDC/SAML login, SCIM, and billing.
- Production-grade auth/RBAC implementation, real production auth providers, token validation, production sessions, API-key issuance, tenant isolation, and cloud secret storage.
- Production OPA/Rego or Cedar integration, runtime policy bundle management, signed bundle verification runtime, shadow evaluator runtime, candidate runtime execution, policy rollout/rollback execution, production auth-backed policy subjects, and persistent policy audit repositories.
- Production observability backend, OpenTelemetry collector/exporters, SIEM export, alert delivery, audit export checkpoints, and retention deletion jobs.
- Real staging deployment, staging infrastructure manifests, staging CI/CD pipeline execution, or production traffic.
- Active CI workflow creation, live deployment jobs, default remote integration tests, unredacted CI artifact uploads, and automated remote cleanup jobs.
- Real enterprise LLM provider API calls, OAuth/device-code/WIF/IAM token exchange, vendor credential cache access, Aichestra Local Agent daemon or real transport, vendor CLI execution, and PTY terminal automation.
- Production Vault rollout, Vault HA/unseal/storage operations, production secret rotation jobs, destructive secret migration, cloud secret manager integration, production secret injection, container/VM sandboxing, OS-level network egress enforcement, and Local Agent secret forwarding.
- Real signed artifact verification, full package signing, SBOM generation, and real artifact registry integration.
- Production auto-improvement, real proposal generation, draft registry change apply workflow, real eval execution, real canary execution, and automatic registry mutation.

## Security Notes

- Do not commit secrets.
- Real providers are disabled by default.
- External integrations must stay behind adapter interfaces.
- Git writes, MCP calls, and LLM calls must be auditable.
- Instructions guide agent behavior but do not enforce security; policy, sandbox, MCP, and Git adapters must enforce it.

## Next Steps

1. Collect real human signoffs using Staging Human Signoff Pack v0, then run Staging Deployment Approval Audit v0 before any staging deployment execution.
2. Production Auth Provider Skeleton v1, Tenant Scope Enforcement v1, Dashboard Scope Filtering v1, and Audit Query Scope Enforcement v1 are implemented as disabled/readiness-only or partial representative metadata; implement Readiness Endpoint Scope Filtering v1, Tenant Scope Enforcement v2, or Audit Query Scope Enforcement v2 before any production tenant filtering expansion.
3. Harden production auth/RBAC with real IdP adapters, tenant scoping, durable auth repositories, and session/service-account design only after a separate approved production-auth task; do not enable production login from the current mock/readiness surfaces.
4. Harden audit retention/export with durable common audit storage, legal hold, tenant scoping, and secure export checkpoints before any production SIEM integration.
5. Harden Local Agent Protocol persistence and consent UX before any real daemon or local CLI work.
6. Harden LLM Gateway v2 with persistent route/model catalog/audit repositories and production secret backend planning before broader provider calls.
7. Conflict Resolution Assistant v1 and PR Ownership / Handoff Model v1 are implemented as metadata-only review planning/ownership layers with `applyAllowed=false`, no remote PR update, and no auto-merge. Merge Queue Live Integration-Test Profile v1 is implemented as a skipped-by-default read-only readiness profile that consumes Merge Queue Policy v2 evidence and never enables real merge, remote rebase, force-push, branch deletion, or auto-merge; see [docs/features/merge-queue-live-integration-test-profile/v1.md](docs/features/merge-queue-live-integration-test-profile/v1.md). Branch Cleanup / Orphan Lease Recovery v1 is implemented as a metadata-only read-only readiness layer over Branch Lease, Workspace Lifecycle, Worktree Allocation, Branch Orchestrator, Multi-session Coordination, Merge Queue, and the future PR Ownership Handoff Model. It detects orphan/stale records and proposes review-only recommendations only; destructive cleanup remains future and policy denies branch deletion, worktree removal, PR closure, and destructive cleanup execution by default. See [docs/features/branch-cleanup-orphan-lease-recovery/v1.md](docs/features/branch-cleanup-orphan-lease-recovery/v1.md). Skill / Harness Compatibility Matrix v1, Registry Signed Package / Artifact Trust v1, and Eval Suite Execution Harness v1 are implemented as registry metadata layers that preserve lifecycle/approval/eval/checksum/semver/policy/tenant-scope resolver gates and never mutate registry entries or call external artifact/signing/eval providers; see [docs/features/registry-compatibility-matrix/v1.md](docs/features/registry-compatibility-matrix/v1.md), [docs/features/registry-artifact-trust/v1.md](docs/features/registry-artifact-trust/v1.md), and [docs/features/eval-suite-execution-harness/v1.md](docs/features/eval-suite-execution-harness/v1.md). Next, implement Branch Cleanup Live Integration-Test Profile v1, PR Ownership Live Integration-Test Profile v1, Eval Suite Live Integration-Test Profile v1, Registry Signed Bundle Verification Planning v1, or Conflict Resolution Assistant LLM Proposal Profile v1 before any real PR/merge/cleanup/eval/signing execution work.

## OIDC Provider Skeleton Hardening

Status: `v1_implemented`. OIDC remains `oidc_future`, disabled by default, readiness-only, and fail-closed. MockAuthProvider remains the default runtime provider. The skeleton exposes boolean-only config/discovery/JWKS/claims/token-boundary metadata with no tokens, cookies, sessions, env values, secrets, external IdP calls, JWKS fetches, or JWT validation. See `docs/foundations/auth-rbac/oidc-provider-skeleton-hardening-v1.md`.
