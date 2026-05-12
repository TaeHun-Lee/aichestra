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
10. MCP Gateway planning
11. Phase 5 enterprise planning

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

Recommended next step: LLM Gateway v0, or Real Git Adapter v1 if controlled GitHub branch/PR creation is the next priority.

## 3. LLM Gateway v0

Implemented with `docs/features/llm-gateway/v0.md`, provider-neutral interfaces, `MockLLMProvider`, an OpenAI-compatible skeleton, model catalog, virtual model keys, budget checks, usage ledger integration, audit events, API routes, dashboard visibility, and tests.

Goals:

- Keep real provider calls disabled by default.
- Preserve mock-first model completion behavior.
- Route mock completions through a central gateway.
- Record usage ledger entries for successful gateway calls.
- Keep virtual keys as internal policy objects, not provider API secrets.

Recommended next step: Local Agent Runner v0, or Real Git Adapter v1 if controlled GitHub branch/PR creation is the next priority.

## 4. Local Agent Runner v0

Implemented with `docs/features/local-agent-runner/v0.md`, provider-neutral runner interfaces, deterministic `MockAgentRunner`, disabled-by-default `LocalAgentRunner`, harness policy gates, instruction assembly, in-memory runner repositories, API routes, health metadata, dashboard visibility, and tests.

Goals:

- Keep the default runtime mock-first.
- Record runner metadata, changed files, diff summary, test output, instruction assembly, usage linkage, and audit events.
- Keep local execution disabled by default and scoped to safe fixture or controlled workspaces.
- Preserve LLM Gateway and GitProvider boundaries without real provider calls.

Recommended next step: Local Agent Runner v1 with controlled fixture command execution, or Real Git Adapter v1 / LLM Gateway v1 depending on project priorities.

## 5. Local Agent Runner v1

Implemented with `docs/features/local-agent-runner/v1.md`, `CommandExecutor`, `BlockedCommandExecutor`, `FixtureLocalCommandExecutor`, `LocalAgentWorkspaceManager`, command result/workspace repositories, API routes, dashboard visibility, schema skeleton updates, and tests.

Goals:

- Keep mock runner as the default.
- Keep local runner and local command execution disabled by default.
- Allow only controlled fixture command execution in explicit workspace roots.
- Enforce harness command, network, remote Git, output, file write, and secret gates.
- Capture bounded command results and workspace status.
- Preserve LLM Gateway and GitProvider boundaries.

Recommended next step: Policy-as-code Skeleton v0 was completed after this milestone; continue with Secrets and Sandbox Design v0, or Real Git Adapter v1 if controlled GitHub branch/PR creation is the next priority.

## 6. Policy-as-Code Skeleton

Implemented with `docs/features/policy-as-code/v0.md`, central provider-neutral policy models, `StaticPolicyEngine`, default restrictive policy rules, policy decision audit, API routes, health metadata, dashboard visibility, and deterministic tests.

Goals:

- Centralize allow/deny/require-approval decisions for Git, LLM, Runner, Registry, and Auto-improvement boundaries.
- Keep mock Git/LLM operations allowed while denying remote provider calls by default.
- Deny runner command execution, secret reads, MCP tool calls, and improvement apply by default.
- Preserve existing budget, harness, resolver, mock RBAC, and governance gates.
- Prepare for future OPA/Rego or Cedar adapters without adding those integrations yet.

Recommended next step: Secrets and Sandbox Design v0, or Real Git Adapter v1 if controlled GitHub branch/PR creation is the next priority.

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

Recommended next step: Local Agent Protocol v1 was completed after this milestone; continue with Real Git Adapter v1 if controlled remote Git branch/PR creation should be enabled next, or LLM Gateway v1 if controlled real provider calls should be enabled next.

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

Recommended next step: Real Git Adapter v1, if controlled remote Git branch/PR creation should be enabled next, or LLM Gateway v1 if controlled real provider calls should be enabled next.

## 10. MCP Gateway Planning

Goals:

- Define MCP gateway boundary.
- Keep MCP calls disabled by default.
- Define audit, auth, and permission model.

## 11. Phase 5 Enterprise Planning

Goals:

- SSO and SCIM.
- Audit export.
- Data residency.
- Signed artifacts.
- Real artifact registry.
- Production RBAC.
- Deployment and operational controls.
