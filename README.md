# Aichestra

Aichestra is an AgentOps control plane for coordinating LLM usage, AI coding agents, Git branches, PRs, skills, harnesses, instruction artifacts, usage ledgers, and audit logs.

This repository is an MVP scaffold. It is intentionally mock-first: default runtime code does not call real LLM providers, Git hosting APIs, MCP gateways, secret stores, or production databases. Real Git Adapter v2 and LLM Gateway v2 are controlled exceptions that remain disabled unless every explicit integration gate is configured.

Design and work-order source documents live under `docs/briefs/`; the canonical bootstrap document is `docs/briefs/AICHESTRA_BOOTSTRAP.md`. See `docs/README.md` for the full documentation layout.

## Architecture

- `packages/core`: domain models, status transitions, validation schemas, seed data, instruction resolution, Conflict Manager scoring, and merge simulation interfaces.
- `packages/git-adapter`: Git provider behavior, mock branch/PR creation, conflict risk, local-only dry-run merge simulation, gated GitHub operations, disabled-by-default webhook receive, PR/branch sync read models, and GitHub App Controlled Implementation v1 runtime/status boundaries.
- `packages/improvement`: Phase 4 Preparation, Auto-improvement v0, and Governance v1 models, repository interfaces, in-memory repositories, DTOs, deterministic clustering, candidates, draft proposals, draft registry changes, readiness checks, proposal review queues, governance decisions, proposal eval run metadata, canary readiness, apply gates, governance audit events, eval requirements, canary rollout plan metadata, and auto-improvement safety policies.
- `packages/llm-gateway`: provider-neutral LLM interfaces, mock model provider behavior, gated OpenAI-compatible HTTP provider path, LLM Gateway v2 route/fallback/routing-decision read models, disabled provider skeletons, model catalog, virtual model key policy objects, budget checks, usage ledger integration, LLM audit events, Enterprise LLM Provider Abstraction v0 catalog/auth/credential/token/adapter/local-agent boundary skeletons, and Local Agent Protocol v1 mock channels/fixture daemon/compatibility/streaming models.
- `packages/mcp-gateway`: MCP Gateway v0 server/tool catalog models, deterministic `MockMCPGateway`, disabled real MCP transport skeleton, invocation/audit repositories, DTOs, and Auth/RBAC, Policy, Security redaction, and Secrets/Sandbox integration.
- `packages/deployment-readiness`: Production Deployment Readiness Planning v0 read-only deployment profiles, readiness checks, production risks, GitHub App / Production Webhook Hardening Planning v0 models, Persistent DB Production Operations v1 readiness models, Secret Backend Migration Planning v0 readiness models, Production Auth/RBAC v1 planning readiness models, Policy Bundle / OPA-Cedar Planning v0 readiness models, Staging Deployment Profile v0 readiness models, Staging CI/CD Pipeline Planning v0 readiness models, GitHub App integration-test profile v1 readiness models, DTOs, and seeded planning summary models.
- `packages/policy`: provider-neutral Policy-as-code Skeleton v0 models, static/mock policy engine, default restrictive rules, policy decision audit, DTOs, and policy service boundaries.
- `packages/auth`: Production Auth/RBAC Planning v0 provider-neutral identity/RBAC models, deterministic MockAuthProvider, disabled future auth provider placeholders, AuthorizationService, request context helpers, and sanitized auth audit events.
- `packages/registry`: Skill, Harness, and Instruction registry interfaces, repository boundaries, DTO mappers, audit logs, history, rollback, approval queue read models, local eval result attachment, checksum verification, mock RBAC, local package manifests, import/export, semver range resolution v0, package diffs, validation helpers, and deterministic resolver.
- `packages/runner`: provider-neutral agent runner contracts, deterministic MockAgentRunner, disabled-by-default LocalAgentRunner, harness execution policy, instruction assembly, in-memory runner repositories, runner DTOs/services, and mock test runner contracts.
- `packages/security`: Secrets and Sandbox Design v0 metadata-only secret refs/scopes/leases, SecretRef-backed Provider Credentials v1 env provider, credential manager/handles/resolution audit, mock secret manager, sandbox profiles/sessions, network egress policy, redaction policy, security audit events, DTOs, and in-memory repositories.
- `packages/observability`: Observability / Audit Retention v0 common audit envelope, retention/redaction classes, audit sanitizer, source normalization, read-only retention policies, metric snapshots, trace skeletons, and no-external-export observability read models.
- `packages/adapters`: compatibility aggregate for shared adapter contracts and mocks.
- `packages/db`: Postgres-oriented schema, storage provider abstraction, repository factory, in-memory repositories for mock-first runtime/tests, and opt-in Postgres repositories for the core durable slice.
- `apps/api`: REST API skeleton using Node's local HTTP server.
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

Run the schema migration only when explicitly configuring a local/test Postgres database:

```bash
AICHESTRA_DATABASE_URL=postgres://... pnpm db:migrate
```

Git integration remains mock-first by default. Real Git Adapter v2 supports mock provider behavior, local-only fixture inspection, controlled GitHub branch/PR creation, gated changed-file reads, and disabled-by-default webhook/sync read models only when every explicit gate and allowlist is configured:

```bash
AICHESTRA_GIT_PROVIDER=mock pnpm --filter @aichestra/api dev
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
curl -X POST http://localhost:3000/providers/validate \
  -H "Content-Type: application/json" \
  -d '{ "providerId": "claude-code-local" }'
curl -X POST http://localhost:3000/providers/invoke \
  -H "Content-Type: application/json" \
  -d '{ "providerId": "claude-code-local", "prompt": "blocked local CLI provider example" }'
curl http://localhost:3000/providers/audit
```

Local CLI provider entries require Local Agent Protocol coordination and use `external_cli_session` with `credentialAccess = never_read_tokens`. Aichestra does not read or upload vendor credential caches such as `~/.codex/auth.json`, `~/.claude`, or Google credential caches.

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
curl http://localhost:3000/observability/metrics
curl http://localhost:3000/observability/metrics/snapshot
curl http://localhost:3000/observability/traces
curl http://localhost:3000/dashboard/observability
```

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
curl http://localhost:3000/dashboard/staging
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

## Test

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Optional Postgres repository contract tests are skipped unless `AICHESTRA_TEST_DATABASE_URL` is set.

Validation covers lint, TypeScript checking, tests, and a scaffold build smoke check. Tests cover task status transitions, repeated run conflict behavior, instruction precedence, mock LLM usage metadata, LLM Gateway v1/v2 provider/catalog/routing/fallback/virtual-key/budget/usage/API/OpenAI-compatible mocked HTTP behavior, MCP Gateway v0 catalog/invocation/policy/auth/API/health/dashboard/no-secret behavior, Local Agent Protocol v0 and v1 registration/consent/invocation/mock transport/channel/fixture daemon/compatibility/stream/API/provider integration behavior, mock Git conflict risk, Conflict Manager scoring, merge simulation, API health, API task execution, Local Agent Runner v1 mock/local safety behavior, command executor blocking and fixture execution, workspace validation/cleanup, harness policy, instruction assembly, runner API behavior, Policy-as-code v0 static rules/audit/API/service integrations, Policy Bundle / OPA-Cedar Planning v0 readiness models/API/health/dashboard/no-dynamic-execution/no-secret behavior, Production Auth/RBAC Planning v0 domain/provider/authorization/API/health/dashboard/no-secret behavior, Production Auth/RBAC v1 Planning readiness models/API/health/dashboard/no-token/no-session behavior, Secrets and Sandbox v0 secret/sandbox/network/redaction/API/dashboard behavior, Observability / Audit Retention v0 envelope/sanitizer/source-normalization/retention/API/dashboard/metric/trace/no-secret behavior, GitHub App / Production Webhook Hardening Planning v0 permission/event/replay/dead-letter/API/dashboard/no-secret behavior, GitHub App Controlled Implementation v1 config/token-provider/SecretRef/Auth/RBAC/Policy/API/health/dashboard/no-secret behavior, GitHub App integration-test profile v1 readiness models/API/health/dashboard/skipped-live-test/no-secret/no-env/no-destructive-git behavior, Persistent DB Production Operations v1 migration/index/retention/webhook/API/health/dashboard/no-DB-url behavior, Staging Deployment Profile v0 profile/gates/checks/promotion/rollback/API/health/dashboard/no-secret/no-env behavior, Staging CI/CD Pipeline Planning v0 profiles/jobs/integration-gates/checks/risks/API/health/dashboard/no-secret/no-env behavior, Dashboard API-backed Read Model v0 endpoints/provider/fallback/no-secret behavior, registry APIs, registry DTOs, repository boundaries, mutation audit logs, approval/eval gates, checksum verification, registry history, rollback, approval queue read models, local eval result attachment, mock RBAC, registry package manifests, local import/export, dry-run import, semver range resolution v0, dependency warnings/errors, package diffs, registry resolver behavior, Phase 4 Preparation signals/clusters/candidates/proposals/eval requirements/canary plans/safety policy APIs, Phase 4 Auto-improvement v0 analyses/draft changes/readiness checks, Phase 4 Governance v1 review queues/decisions/eval runs/canary readiness/apply gates/audit events, storage provider repository contracts, optional Postgres repository contracts, Real Git Adapter v0/v1/v2 provider/service/API/webhook/sync behavior, mock workflow success, policy denial, usage attribution, dashboard assumptions, and Skill/Harness/Instruction separation.

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
-> mock tests pass
-> mock dry-run merge simulation records clean/conflict evidence
-> mock PR is created
-> merge queue entry is created from active lease conflict risk and simulation status
-> usage ledger records mock tokens/cost
-> task reaches completed
-> web dashboard consumes read models and shows status, mock PR, diff summary, dry-run status, and mock cost
```

## MVP Scope

Included:

- Task creation and state tracking.
- Mock Git branch/PR management.
- Conflict Manager v1 active leases, file-overlap risk scoring, local/mock dry-run merge simulation, and mock merge queue.
- Mock LLM usage tracking.
- Skill, Harness, and Instruction Registry Packaging & Versioning v3 with exact refs, semver range resolution v0, package manifests, local import/export, package diffs, repository boundaries, in-memory and file-backed local storage, stable DTOs, audit logs, append-only history, rollback, approval/eval gates, approval queue read models, local eval result attachment, mock mutation RBAC, local checksum verification, APIs, resolver-backed task selection, TaskRun registry refs, and dashboard visibility.
- Phase 4 Preparation foundations, Auto-improvement v0, and Governance v1 for failure signals, deterministic clusters, improvement candidates, draft proposal metadata, draft registry changes, readiness blockers, proposal review queues, governance decisions, proposal eval run metadata, canary readiness, apply gates, governance audit events, eval requirements, canary rollout plan metadata, safety policy guardrails, APIs, tests, and dashboard visibility.
- Usage ledger and audit log.
- Dashboard API-backed Read Model v0 shared DTOs, `/dashboard/*` read-only endpoints, API/demo data providers, explicit static fallback, no-secret sanitization, and read-model rendering, including the Auth/RBAC Production Readiness panel.
- Observability / Audit Retention v0 common audit envelope, audit taxonomy, retention classes, redaction classes, no-secret audit sanitizer, source normalization, retention policy read models, metric snapshot, trace skeleton, `/observability/*`, `/dashboard/observability`, dashboard rendering, and tests without external observability backends or exporters.
- GitHub App / Production Webhook Hardening Planning v0 permission matrix, webhook event allowlist, replay classification model, retry/dead-letter and credential/endpoint plans, `/readiness/github-app/*`, `/dashboard/github-app`, and tests without GitHub calls, private key reads, token exchange, or production webhook enablement.
- GitHub App Controlled Implementation v1 runtime config, installation/repo grant read models, disabled/mock token provider boundary, metadata-only private-key SecretRef checks, Auth/RBAC and Policy integration, `/git/github-app/*`, health/dashboard metadata, and tests without private-key signing, real installation token exchange, GitHub calls, or token exposure.
- GitHub App integration-test profile v1 read-only profile/test-case/safety-check/summary models, `/readiness/github-app-integration/*`, `/dashboard/github-app-integration`, safe health metadata, skipped live-test skeleton, and tests without default GitHub calls, secret/env exposure, auto-merge, force-push, or branch deletion.
- LLM Gateway integration-test profile v1 read-only profile/test-case/safety-check/summary models, `/readiness/llm-integration/*`, `/dashboard/llm-integration`, safe health metadata, skipped live-test skeleton, and tests without default LLM calls, API key/env exposure, raw provider response exposure, streaming, tool calling, vendor CLI, or credential cache access.
- Persistent DB Production Operations v1 DB operations runbook, migration readiness, index review, retention/audit growth plan, webhook persistence plan, backup/restore and pooling plans, `/readiness/database/*`, `/dashboard/database`, health metadata, and tests without production DB connections, automatic migrations, backup/restore jobs, destructive retention jobs, or DB URL exposure.
- Production Auth/RBAC Planning v0 provider-neutral auth/RBAC models, deterministic MockAuthProvider, disabled future OIDC/SAML/SCIM/service-account provider placeholders, AuthorizationService, RequestContext helpers, PolicySubject mapping, `/auth/*` API visibility, health/dashboard auth mode visibility, sanitized auth audit, and tests.
- Production Auth/RBAC v1 Planning IdP options, production RBAC permission matrix, tenant/scope model, service account/system actor plan, request context propagation plan, mock actor deprecation plan, `/readiness/auth/*`, `/dashboard/auth-production`, safe health metadata, and tests without real auth, sessions, tokens, cookies, or IdP calls.
- Persistent DB v1 opt-in Postgres storage for Task, TaskRun, UsageLedger, BranchLease, MergeSimulationResult, MergeQueueEntry, Skill, Harness, Instruction, registry audit/history, registry packages, and registry eval results.
- Real Integration Foundation v0 storage provider abstraction, repository inventory, Postgres schema design, migration skeleton, auth/RBAC readiness, Real Git Adapter readiness, dashboard read model plan, and repository contract tests.
- Real Git Adapter v2 provider boundary, deterministic MockGitProvider default, LocalGitProvider fixture-safe changed-file inspection, gated GitHubGitProvider, GitHubClient boundary, controlled GitHub branch/PR/changed-file operations, disabled-by-default GitHub webhook receiver, verifier interface, PR/branch sync read models, GitIntegrationService, `/git/*` API visibility, health metadata, Git/webhook audit events, and dashboard visibility.
- LLM Gateway v2 provider boundary, deterministic MockLLMProvider default, gated OpenAI-compatible HTTP provider path, route/fallback/routing-decision repositories, provider health read models, disabled provider skeletons, model catalog, virtual model keys, budget checks, usage ledger integration, `/llm/*` API visibility, health metadata, LLM audit events, and dashboard visibility.
- SecretRef-backed Provider Credentials v1 metadata-only SecretRef credential model, explicit env secret provider, Auth/RBAC and Policy-backed credential manager/handle/resolution results, GitHub token/webhook and LLM credential integration, `/security/credentials/*` API visibility, health/dashboard status, credential audit, and redaction tests.
- Local Agent Runner v1 provider boundary, deterministic MockAgentRunner default, disabled-by-default LocalAgentRunner, controlled fixture command execution boundary, workspace validation, harness policy gates, instruction assembly, `/agents/*` API visibility, health metadata, command result/workspace read models, runner audit events, and dashboard visibility.
- Policy-as-code Skeleton v0 static policy engine, provider-neutral policy models, restrictive default rules, policy audit read model, `/policy/*` API visibility, health metadata, dashboard visibility, and Git/LLM/Runner/Registry service-boundary checks.
- Policy Bundle / OPA-Cedar Planning v0 engine comparison, bundle schema, policy domain mapping, review workflow, test strategy, rollout/rollback, break-glass plan, `/readiness/policy-bundles/*`, `/dashboard/policy-bundles`, safe health metadata, and tests without OPA/Cedar/runtime bundle execution, external policy service calls, dynamic policy execution, or secrets.
- Staging Deployment Profile v0 non-production profile contract, staging environment gate matrix, integration-test policy, risk register, read-only `/readiness/staging/*`, `/dashboard/staging`, safe health metadata, and tests without deployment, external provider calls, secrets, env values, remote MCP, vendor CLI execution, or production traffic.
- Staging CI/CD Pipeline Planning v0 job matrix, optional integration-test gate policy, secret/env safety, artifact/report policy, staging promotion criteria, cleanup/rollback planning, read-only `/readiness/ci-cd/*`, `/dashboard/ci-cd`, safe health metadata, and tests without active workflows, deployment, default remote integrations, secrets, or env values.
- Enterprise LLM Provider Abstraction v0 provider kind/auth models, provider catalog skeletons, CredentialManager/TokenResolver interfaces, blocked ProviderAdapter skeletons, Local CLI provider contract, Aichestra Local Agent boundary models, parser/redaction utilities, `/providers/*` API visibility, health metadata, provider audit events, dashboard visibility, and policy hooks.
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
- Remote git fetch, push, provider merge, provider rebase, force push, branch deletion, public webhook exposure by default, production GitHub App rollout, GitHub App private key signing, real installation token exchange in default tests/runtime, or reviewer automation.
- Real Kubernetes, Temporal, MCP gateway, SSO, OAuth/OIDC/SAML login, SCIM, and billing.
- Production-grade auth/RBAC implementation, production sessions, API-key issuance, tenant isolation, and cloud secret storage.
- Production OPA/Rego or Cedar integration, runtime policy bundle management, signed bundle verification, shadow evaluation, policy rollout/rollback execution, production auth-backed policy subjects, and persistent policy audit repositories.
- Production observability backend, OpenTelemetry collector/exporters, SIEM export, alert delivery, audit export checkpoints, and retention deletion jobs.
- Real staging deployment, staging infrastructure manifests, staging CI/CD pipeline execution, or production traffic.
- Active CI workflow creation, live deployment jobs, default remote integration tests, unredacted CI artifact uploads, and automated remote cleanup jobs.
- Real enterprise LLM provider API calls, OAuth/device-code/WIF/IAM token exchange, vendor credential cache access, Aichestra Local Agent daemon or real transport, vendor CLI execution, and PTY terminal automation.
- Real Vault/cloud secret manager integration, production secret rotation jobs, production secret injection, container/VM sandboxing, OS-level network egress enforcement, and Local Agent secret forwarding.
- Signed artifacts, full package signing, artifact provenance/SBOM, and real artifact registry integration.
- Production auto-improvement, real proposal generation, draft registry change apply workflow, real eval execution, real canary execution, and automatic registry mutation.

## Security Notes

- Do not commit secrets.
- Real providers are disabled by default.
- External integrations must stay behind adapter interfaces.
- Git writes, MCP calls, and LLM calls must be auditable.
- Instructions guide agent behavior but do not enforce security; policy, sandbox, MCP, and Git adapters must enforce it.

## Next Steps

1. Staging Deployment Dry-run Profile v0, or production secret backend implementation option decision.
2. Harden production auth/RBAC implementation with real IdP adapters, tenant scoping, durable auth repositories, and session/service-account design before any production login work.
3. Harden audit retention/export with durable common audit storage, legal hold, tenant scoping, and secure export checkpoints before any production SIEM integration.
4. Harden Local Agent Protocol persistence and consent UX before any real daemon or local CLI work.
5. Harden LLM Gateway v2 with persistent route/model catalog/audit repositories and production secret backend planning before broader provider calls.
