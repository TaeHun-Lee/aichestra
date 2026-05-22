# Configuration & Integration Gates

> Extracted from the project README "Run" section. Every real integration is disabled by default and stays behind the explicit env gates documented here. See the [README](../../README.md) for the quick-start commands.

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
curl http://localhost:3000/observability/export/config
curl http://localhost:3000/observability/export/backends
curl http://localhost:3000/observability/export/safety-checks
curl http://localhost:3000/observability/export/summary
curl -X POST http://localhost:3000/observability/export/mock-envelope/check \
  -H "Content-Type: application/json" \
  -d '{ "source": "manual_check", "tenantId": "tenant_demo", "payloadSummary": "safe summary only" }'
curl http://localhost:3000/dashboard/observability
```

Audit Query Scope Enforcement v1 is check/redaction-only. Raw payload access is always forbidden, production audit storage enforcement remains false, and no external SIEM/export or provider call is made.

External Observability Export v1 is disabled/check-only. `rawPayloadIncluded` stays false, endpoint/auth values are never returned, and the mock-envelope route validates sanitized metadata without sending anything to OpenTelemetry, Datadog, Grafana Cloud, CloudWatch, OpenSearch, Splunk, SIEM, S3, or any other external backend.

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

Vault Integration-Test Profile v1 adds a first-class skipped-by-default readiness surface for optional live Vault KV v2 smoke validation. Vault Live Integration Enablement v1 adds stricter manual-run readiness, validation checks, runbook metadata, run-record metadata, test-only path enforcement, and no-write/no-delete/no-rotate/no-broad-list status. Missing gates skip live tests; unsafe gates block readiness. The profile never writes, deletes, rotates, broadly lists, or mutates Vault secrets, and default runtime/tests do not call Vault:

```bash
AICHESTRA_VAULT_INTEGRATION_TESTS=false

curl http://localhost:3000/readiness/vault-integration/profile
curl http://localhost:3000/readiness/vault-integration/test-cases
curl http://localhost:3000/readiness/vault-integration/safety-checks
curl http://localhost:3000/readiness/vault-integration/summary
curl http://localhost:3000/readiness/secrets/vault/live-readiness
curl http://localhost:3000/readiness/secrets/vault/live-checks
curl http://localhost:3000/readiness/secrets/vault/live-runbook
curl http://localhost:3000/readiness/secrets/vault/live-summary
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

Policy Runtime Shadow Evaluation Planning v1 adds read-only plan, comparison rule, mismatch taxonomy, report, readiness check, summary, dashboard, and safe `/health` metadata for a future static-vs-candidate comparison path. Policy Runtime Shadow Evaluator Skeleton v1 adds disabled/mock evaluator metadata and fixture reports. It keeps `StaticPolicyEngine` as source of truth and does not run a live shadow evaluator or candidate runtime:

```bash
curl http://localhost:3000/readiness/policy-shadow/plan
curl http://localhost:3000/readiness/policy-shadow/comparison-rules
curl http://localhost:3000/readiness/policy-shadow/mismatches
curl http://localhost:3000/readiness/policy-shadow/reports
curl http://localhost:3000/readiness/policy-shadow/checks
curl http://localhost:3000/readiness/policy-shadow/summary
curl http://localhost:3000/readiness/policy-shadow/evaluator/status
curl http://localhost:3000/readiness/policy-shadow/evaluator/summary
curl http://localhost:3000/readiness/policy-shadow/evaluator/mismatch-types
curl http://localhost:3000/readiness/policy-shadow/evaluator/mock-report
curl http://localhost:3000/dashboard/policy-shadow
```

Policy Bundle Runtime PoC Planning v0 adds planning-only runtime PoC options, a normalized policy input/output contract, PoC domain mappings, golden decision cases, readiness checks, risks, `/readiness/policy-runtime-poc/*`, `/dashboard/policy-runtime-poc`, and safe `/health` metadata. Policy Runtime Shadow Evaluation Planning v1 adds read-only shadow plan, comparison-rule, mismatch-taxonomy, readiness, and summary metadata at `/readiness/policy-shadow/*`, and Shadow Evaluator Skeleton v1 adds disabled/mock evaluator metadata at `/readiness/policy-shadow/evaluator/*`. These milestones do not implement OPA/Rego, Cedar, signed JSON/YAML evaluation, a custom policy service, live shadow evaluation, dynamic policy execution, remote policy loading, hot reload, or runtime enforcement. `StaticPolicyEngine` remains the source of truth:

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
Policy Runtime Shadow Evaluator Skeleton v1 can consume the same golden metadata for deterministic mock reports in tests/readiness only.
