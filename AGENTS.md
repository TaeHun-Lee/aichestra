# AGENTS.md

## Project

Aichestra is an LLM/agent orchestration control plane for collaborative AI-assisted software development.

Design and work-order source documents live under `docs/briefs/`. The canonical bootstrap document is `docs/briefs/AICHESTRA_BOOTSTRAP.md`. See `docs/README.md` for the full layout.

## Core principle

Do not implement real external API calls in the default MVP scaffold. Use explicit interfaces and mock adapters first. Real Git Adapter v2 and LLM Gateway v2 are controlled exceptions only when every explicit integration gate and allowlist is configured.

## Setup

- Install dependencies: `pnpm install`
- Run lint: `pnpm lint`
- Run typecheck: `pnpm typecheck`
- Run tests: `pnpm test`
- Run build: `pnpm build`
- Optional Postgres migration: `AICHESTRA_DATABASE_URL=postgres://... pnpm db:migrate`
- Optional Postgres repository contracts: set `AICHESTRA_TEST_DATABASE_URL` before `pnpm test`

## Architecture boundaries

- `packages/core` owns domain models and pure business logic.
- Conflict Manager concepts (`BranchLease`, `ConflictRisk`, `MergeQueueEntry`, `MergeSimulationResult`) stay as separate domain concepts.
- `apps/api` exposes HTTP APIs and does not contain orchestration logic.
- `apps/worker` owns workflow execution.
- `packages/git-adapter` abstracts Git provider behavior, safe GitHub webhook verification/receive, and PR/branch sync read models.
- `packages/improvement` owns Phase 4 Preparation, Auto-improvement v0, and Governance v1 failure signals, deterministic clusters, improvement candidates, draft proposal metadata, draft registry changes, proposal readiness checks, proposal review queues, governance decisions, proposal eval run metadata, canary readiness checks, apply gates, governance audit events, eval requirement metadata, canary rollout plan metadata, safety policies, repository interfaces, DTO mappers, mock engine behavior, and in-memory services.
- `packages/llm-gateway` abstracts model providers, owns LLM Gateway v2 provider-neutral interfaces, mock provider behavior, gated OpenAI-compatible HTTP provider behavior, route/fallback/routing-decision read models, provider health read models, disabled provider skeletons, model catalog, virtual model key policy objects, budget checks, usage ledger integration, LLM audit events, Enterprise LLM Provider Abstraction v0 provider catalog/auth/credential/token/adapter/local-agent boundary skeletons, and Aichestra Local Agent Protocol v1 registration/session/invocation/consent/event/audit models, mock signed channels, fixture daemon simulation, compatibility matrix, mock transport, DTOs, and in-memory repositories.
- `packages/mcp-gateway` owns MCP Gateway v0 server/tool catalog models, deterministic `MockMCPGateway`, disabled real MCP transport skeletons, MCP invocation/audit models, DTOs, and in-memory repositories. It integrates with Auth/RBAC, Policy-as-code, Secrets/Sandbox redaction/network-deny controls, and dashboard/API read models without real MCP transport.
- `packages/auth` owns Production Auth/RBAC Planning v0 provider-neutral principal, actor, team, role, permission, resource scope, role binding, service account, identity provider, auth context, request context, AuthProvider, AuthorizationService, mock provider behavior, disabled future auth provider placeholders, DTOs, and in-memory auth audit repositories.
- `packages/registry` owns Skill, Harness, and Instruction registries, exact and simple semver version refs, repository boundaries, DTO mappers, registry audit logs, append-only history, rollback, approval queues, local eval result attachment, checksum verification, mock mutation authorization, local package manifests, import/export, package diffs, and deterministic registry resolution.
- `packages/policy` owns Policy-as-code Skeleton v0 provider-neutral policy models, static/default policy rules, policy decision audit, DTOs, and policy service boundaries for Git, LLM, Runner, Registry, and Auto-improvement operations.
- `packages/runner` owns agent runner contracts, deterministic `MockAgentRunner`, disabled-by-default `LocalAgentRunner`, controlled fixture command execution boundaries, workspace validation, harness execution policy, instruction assembly, in-memory runner repositories, command result capture, and runner DTOs/services.
- `packages/security` owns Secrets and Sandbox Design v0 metadata-only secret refs/scopes/leases, SecretRef-backed Provider Credentials v1 env provider/credential manager/credential handle/resolution audit with Auth/RBAC and Policy checks, secret access decisions, mock secret manager, sandbox profiles/sessions/decisions, network egress policy, redaction policy, security audit events, DTOs, and in-memory repositories.
- `packages/db` owns schema, repository contracts, storage provider abstractions, repository factories, seed data, and persistence adapters.
- `apps/web` owns the dashboard skeleton, API-backed dashboard read-model provider, explicit demo fallback, and read-model rendering.

## Implementation rules

- Keep provider integrations behind interfaces.
- Prefer deterministic tests.
- Avoid hidden global state.
- Do not store secrets in source code.
- Do not call OpenAI, Anthropic, GitHub, or other external APIs in default tests. Optional real GitHub integration tests may run only when every explicit Real Git Adapter v1/v2 gate is configured. Optional real remote LLM tests may run only when every explicit LLM Gateway v1/v2 gate is configured.
- All generated code must pass lint, typecheck, test, and build.
- `POST /tasks/:id/run` must reject active queued/running TaskRuns with `409 Conflict`; completed or failed tasks may create a new TaskRun attempt.
- Conflict Manager v1 must remain mock/local-only: deterministic file-overlap scoring, active lease tracking, mock merge queue status, and local dry-run simulation behind `MergeSimulator`.
- Local dry-run simulation may use `git merge-tree` only against explicitly supplied local repositories or test fixtures. It must not fetch, push, call hosted Git providers, or mutate the user's working branch.
- Do not perform real provider merge/rebase operations.
- Do not implement real Codex CLI, Claude Code, or Aider runner integration in the MVP scaffold.
- Local Agent Runner v1 must stay mock-first: `MockAgentRunner` is the default, `LocalAgentRunner` is disabled by default, command execution is disabled by default, no secrets are injected, and no remote Git or direct provider calls are allowed. Any controlled remote LLM use must flow only through LLM Gateway v2 gates.
- Local Agent Runner v1 command execution must go through `CommandExecutor`, use command+args arrays, avoid shell string execution, reject network/remote Git/destructive commands, size-limit stdout/stderr previews, and run only inside explicit fixture/temp workspaces.
- Harness execution policy is authoritative; task prompts, skill instructions, and instruction artifacts must not override denied commands, network-disabled, remote-Git-disabled, file-write, timeout, output-size, or secret-scope boundaries.
- Skill, Harness, and InstructionArtifact must remain separate concepts with separate domain types, APIs, and tests.
- Registry v3 supports exact version pinning and simple semver ranges only. Do not add a full package manager.
- Registry API responses must go through stable DTO mappers instead of returning internal domain entities directly.
- Registry resolver selection must enforce lifecycle, approval, eval, and instruction checksum gates.
- Registry mutation APIs must append registry audit logs and registry revisions with explicit actors; mock actors remain local-only until production auth/RBAC and request propagation are implemented.
- Registry rollback must restore previous snapshots by creating new revisions, not by deleting history.
- Registry mutation authorization must stay behind `RegistryMutationAuthorizer`; mock RBAC is not production auth.
- Registry package manifests must remain local-only JSON references to registry objects. Do not add real artifact registry, package signing, OCI, npm, GitHub release, or remote package integration yet.
- Registry imports must validate manifests, support dry-run behavior, and avoid overwriting non-draft active approved entries by default.
- In-memory storage remains the default. Postgres storage is opt-in via `AICHESTRA_STORAGE_PROVIDER=postgres` and `AICHESTRA_DATABASE_URL`.
- Postgres repositories must stay behind `StorageProvider`, `RepositoryFactory`, and repository interfaces. API handlers and workers must not instantiate Postgres repositories directly.
- Postgres migrations must run only when explicitly invoked. Do not make tests, build, or app startup run migrations automatically.
- Optional Postgres contract tests must be skipped unless `AICHESTRA_TEST_DATABASE_URL` is configured.
- Phase 4 Preparation must remain metadata-only: do not call LLMs, do not use embeddings, do not execute evals, do not execute canary rollout, and do not mutate active registry entries from candidates or proposals.
- Auto-improvement safety policy defaults must keep `allowAutoApply = false`, `requireHumanApproval = true`, `requireEvalPassed = true`, and `requireCanary = true`.
- Auto-improvement v0 must remain deterministic, mock-only, and draft-only. It may create analyses, candidates, draft proposals, draft registry changes, and readiness records, but it must not apply changes, activate registry entries, approve proposals, execute evals, execute canaries, or call external services.
- Governance v1 may record proposal decisions, proposal eval run metadata, canary readiness, apply gates, and governance audit events. It must not apply draft registry changes, mutate active registry entries, execute evals, execute canaries, or add real auth/provider integrations.
- Real Integration Foundation v0 may add repository abstractions, schema designs, migration skeletons, and contract tests. It must not wire live databases or real provider services until an explicit follow-up task.
- Production Auth/RBAC Planning v0 must remain mock-first and provider-neutral: `MockAuthProvider` is the default, future OIDC/SAML/SCIM/service-account providers are disabled placeholders, no real login/session/token/password/API-key issuance exists, and auth roles must not bypass Policy-as-code, SecretRef, sandbox, Git, LLM, runner, registry, or Local Agent gates.
- Auth/RBAC v0 models and audit events must not store tokens, cookies, passwords, API keys, session secrets, SSO tokens, provider credentials, or credential-cache contents. `/auth/*`, `/health`, dashboard, and audit responses must clearly mark mock auth as non-production and must not expose secrets.
- Real Git Adapter v2 keeps `MockGitProvider` as the default, supports `LocalGitProvider` only for explicit local fixture paths, allows GitHub branch/PR/changed-file operations only through `GitHubClient` behind explicit gates, and allows GitHub webhook receive/sync only through disabled-by-default verifier and receiver boundaries.
- Remote Git operations must require explicit configuration: `AICHESTRA_GIT_PROVIDER=github`, `AICHESTRA_ENABLE_REMOTE_GIT=true`, operation-specific flags such as `AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE=true` or `AICHESTRA_ALLOW_REMOTE_PR_CREATE=true`, a SecretRef-backed GitHub token or legacy `AICHESTRA_GITHUB_TOKEN`, `AICHESTRA_GITHUB_ALLOWED_REPOS`, and the allowed branch prefix.
- Real Git Adapter v2 must not implement automatic merge, provider rebase, force-push, branch deletion, remote push, GitHub App installation flow, GitLab, or Bitbucket. `AICHESTRA_ALLOW_REMOTE_MERGE` remains unsupported.
- GitHub webhook handling must remain disabled unless `AICHESTRA_ENABLE_GITHUB_WEBHOOKS=true`. Verified webhook processing requires a SecretRef-backed webhook secret or gated legacy env secret, signature verification, optional webhook repo allowlist checks, policy allow decisions, and sanitized audit. Raw webhook payloads, webhook secrets, GitHub tokens, and credential cache contents must not be stored or exposed.
- GitHub webhook sync may update webhook event metadata, verification results, PR sync states, branch sync states, changed-file refresh status, and merge queue risk/read-model fields non-destructively. It must not trigger workflows, execute agents, merge, rebase, push, force-push, delete branches, request reviewers, or mutate active registry entries.
- Git provider selection and Git operations must flow through provider/service boundaries, not direct API handler instantiation. Git audit events must not expose tokens or secrets.
- LLM Gateway v2 keeps `MockLLMProvider` as the default, adds provider-aware route selection and bounded fallback read models, and supports one controlled OpenAI-compatible HTTP completion path behind explicit gates.
- Remote LLM operations must require explicit configuration such as `AICHESTRA_LLM_PROVIDER=openai_compatible`, `AICHESTRA_ENABLE_REMOTE_LLM=true`, `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=true`, `AICHESTRA_LLM_BASE_URL`, a SecretRef-backed LLM API key or legacy `AICHESTRA_LLM_API_KEY`, and model allowlist/default-model metadata. Remote completion must also pass virtual-key budget policy and Policy-as-code checks before any HTTP call.
- LLM routing defaults to `AICHESTRA_LLM_ROUTING_MODE=mock_only`. Multi-provider mode and fallback require explicit routing/fallback configuration. Fallback must be bounded and must not bypass Auth/RBAC, Policy-as-code, SecretRef, provider/model allowlists, or budget gates.
- Virtual model keys are internal policy objects only. Do not store OpenAI, Anthropic, Gemini, Bedrock, LiteLLM, or other provider API keys in source, model catalog records, virtual keys, audit events, or usage metadata.
- LLM Gateway calls must record successful usage with `taskId` and `taskRunId`; blocked calls must create audit events and must not call external providers.
- LLM Gateway v2 must not implement BYOK, OAuth/device-code/WIF/IAM, real Anthropic/Gemini/Bedrock/Vertex/Azure/LiteLLM calls, streaming, Local CLI provider execution, provider credential cache reads, or production secret manager integration. SecretRef-backed env credential resolution is the only credential manager path allowed in this milestone.
- Enterprise LLM Provider Abstraction v0 must remain skeleton-only: do not call Claude, Codex, Gemini, Vertex, Bedrock, Foundry, or any provider API/CLI.
- Provider auth config must not contain raw provider tokens. `local_cli` providers must use `external_cli_session` with `credentialAccess = never_read_tokens`.
- Do not read or upload provider-owned credential caches such as `~/.codex/auth.json`, `~/.claude`, Google credential caches, OS keychains, or vendor CLI session files.
- Aichestra Local Agent is a future user-machine daemon boundary and is not the same as Local Agent Runner. Do not implement a real Local Agent daemon, real network transport, or vendor CLI execution until an explicit future task.
- Aichestra Local Agent Protocol v1 is mock-first metadata coordination only: no real daemon, no WebSocket/gRPC/HTTP tunnel, no vendor CLI execution, no credential cache reads, no PTY automation, no direct local CLI execution from Cloud, and no secret forwarding.
- Local Agent Protocol v1 dispatch must go through `LocalAgentProtocolService`, `LocalAgentTransport`, static policy decisions, mock channel/handshake state, compatibility checks, consent records, sandbox/network/redaction references, and Local Agent protocol audit events.
- `MockLocalAgentTransport` and `FixtureLocalAgentDaemon` must remain in-memory and must not run commands, read credential caches, or use network transport.
- PTY interactive fallback, danger/full-access local CLI modes, local CLI shell execution, local CLI file write, and local CLI network access are denied by default.
- Policy-as-code v0 must remain static/mock-first: do not add real OPA/Rego, Cedar, external policy services, dynamic policy code upload, `eval()`, or user-provided policy execution.
- Policy decisions must not weaken existing safety gates. Budget checks, harness policy, registry approval/eval/checksum gates, mock RBAC, governance apply gates, and provider-disabled defaults remain authoritative.
- Policy decision audit must not store secrets, tokens, provider API keys, or raw prompts. Default policy rules must deny remote Git operations unless explicit Real Git Adapter v1/v2 gates and allowlists pass, deny unverified GitHub webhook processing, and must deny remote LLM completion, runner command execution by default, MCP tool calls, secret reads, runner secret injection, network egress, broad provider credential resolution, Local Agent secret forwarding, and improvement apply.
- Secrets and Sandbox Design v0 must remain metadata-only and model-only. `SecretRef`, `SecretLease`, API responses, audit events, and test fixtures must not contain raw secret values, OAuth tokens, provider API keys, vendor credential cache content, or real credential file paths except redaction test strings.
- `SecretManager` implementations for Vault, AWS Secrets Manager, GCP Secret Manager, and Azure Key Vault must remain future placeholders until an explicit future task. The env-backed SecretRef provider is explicit, allowlisted, and must not enumerate environment variables or expose values.
- `SandboxProfile` container, Firecracker, and Kubernetes kinds are future placeholders. Do not add Docker, Kubernetes, Firecracker, VM, or production sandbox runtime integration in the MVP scaffold.
- Network egress is denied by default and modeled through `NetworkEgressPolicy`; do not add real external network calls or make runner/provider paths more permissive.
- Runner and provider output must be redacted and preview-limited before security audit storage where Secrets and Sandbox v0 controls the path.
- Dashboard API-backed Read Model v0 routes must remain read-only. They may aggregate current repository/service/config/audit state, but must not run workflows, call GitHub, call LLM providers, execute runner commands, create Local Agent fixture invocations, request secret leases, read credential caches, or expose raw secrets/tokens/unredacted logs.
- MCP Gateway v0 must stay mock-first. `MockMCPGateway` is the default; real MCP transport, stdio/http/sse MCP calls, real GitHub/Jira/Slack/DB/search integrations, network access, vendor CLI execution, credential cache reads, SecretLease issuance to tools, write/deploy tools, model-generated automatic tool execution, and Local Agent MCP forwarding are disabled or unimplemented by default. Low-risk read-only mock tools may run only through Auth/RBAC, Policy-as-code, redaction, and MCP audit boundaries.

## MVP focus

The first working vertical slice is:

User creates a task
-> system selects mock model and registry-backed mock skill, harness, and instruction refs
-> worker creates mock branch
-> mock agent run produces a diff summary
-> mock or local-only dry-run merge simulation records conflict evidence
-> mock PR is created
-> mock merge queue records conflict risk and simulation status
-> usage ledger records cost
-> web dashboard consumes read models and shows task status.
