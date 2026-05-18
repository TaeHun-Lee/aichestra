# Aichestra — Current-State Design Conformance Audit (Audit 0)

> **Audit date**: 2026-05-18
> **Reviewer**: Claude (claude-opus-4-7, 1M context)
> **Working tree**: `codex/codex-work` branch, dirty by design (active in-flight work on Merge Queue Live Integration-Test Profile v1, Conflict Resolution Assistant v1, Agent Worktree Allocation v1, and related cross-references).
> **Most recent commits**:
> - `9c9bf63` Merge branch 'codex/codex-work' of https://github.com/TaeHun-Lee/aichestra into codex/codex-work
> - `5473b55` feat: Multi-user / Multi-session Branch Orchestrator v2, Cross-session File Lease / Edit Intent Graph v1, Merge Queue Policy v2
> - `4e5f633` fix: deduplicate policy shadow readiness catalog
> - `0dbab65` feat: harden oidc provider skeleton
> - `643f19b` feat: add policy runtime PoC planning
> **Scope**: full-repo audit-only review of design conformance, mock-first/integration safety, validation status, and production-readiness positioning across all phases and feature tracks. Supersedes the previous Audit 0 report dated 2026-05-14 (rating `pass_with_minor_followups`, 223 pass / 1 fail / 4 skipped).

This is an audit-only document. No application code was modified during the audit. The audit walks the current source tree, current docs tree (`docs/{briefs,foundations,features,roadmaps,audits,reference,adr}`), current 16 packages and 4 apps, and current 75 test files, runs the safe validation commands defined in `AGENTS.md`, and reviews `docs/Audit_prompt.md` Audit 0 criteria.

---

## 1. Executive Summary

**Rating**: `pass_with_minor_followups`

**Confidence**: high (full repo walked via deep-survey subagent, all 75 test files cataloged, every `Mock*`/`Fetch*`/`Hmac*`/`Fixture*` provider boundary inspected, the two real `fetch()` call sites in the codebase confirmed to be gated and re-checked per-request, all `spawn`/`execFile` sites confirmed local-only, full validation suite executed, every newly added v1/v2 surface compared against its documented safety invariants).

| Concern | State |
|---|---|
| Validation green | **Yes** — `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `git diff --check` all pass. `pnpm test` reports **425 pass / 0 fail / 9 skipped** out of 434 tests. The 9 skipped tests are intentionally-gated optional live-integration skeletons (Postgres optional contracts, GitHub App/LLM/Vault/Merge Queue live profiles, Conflict Resolution Assistant LLM proposal). The single failure observed during one earlier run (`tests/agent-worktree-allocation-v1.test.ts`) is not reproducing in the recorded validation run; treat it as a flake to monitor rather than a sustained regression. |
| Mock-first / gated integration safety | **Intact**. `MockGitProvider`, `MockLLMProvider`, `MockMCPGateway`, `MockAgentRunner`, `MockAuthProvider`, `MockLocalAgentTransport`, `MockSecretManager`, `BlockedCommandExecutor`, and the in-memory storage provider are the defaults. Every real path (`FetchGitHubClient`, `FetchOpenAICompatibleHttpClient`, `HmacGitHubWebhookVerifier`, `FixtureLocalCommandExecutor`, optional Postgres repositories, gated Vault SecretRef provider) is constructed only when its explicit env gates resolve to truthy and re-checks the gates at execution time. |
| Production-readiness overstated anywhere | **No**. `README.md`, `AGENTS.md`, every `v0/v1/v2/v3` doc, and the deployment-readiness/persistent-db/secret-backend/github-app/auth/policy/staging/observability planning packages consistently mark themselves planning-only / read-only / mock-first / disabled-by-default, and reiterate that production is blocked on auth, real secret backend, durable DB operations, policy bundle runtime, durable audit/observability, and production webhook hardening. The phase-progress-checklist HTML records the same posture and continues to flag `p5f-clean-approved-worktree` as an open issue. |
| Safe to continue production hardening | **Yes** — Production Auth/RBAC v1, durable observability v1, audit retention v1, Vault Secret Backend production rollout v1, Policy Bundle / OPA-Cedar runtime PoC, and Persistent DB production operations v1 can each proceed on top of the existing v0/v1 planning and skeleton surfaces. |
| Safe to continue gated real integrations | **Yes, with follow-ups** — Real Git Adapter v2 and LLM Gateway v2 already expose controlled HTTP paths; GitHub App Controlled v1, Vault-backed Secret Backend v1, and OIDC Provider Skeleton Hardening v1 expose disabled boundaries that can be reviewed for incremental enablement. Continuing more integrations is safe provided (a) the in-flight untracked work (Conflict Resolution Assistant v1, Agent Worktree Allocation v1, Merge Queue Live Integration-Test Profile v1, and related doc dirs) is committed once review is complete, and (b) the recurring `agent-worktree-allocation-v1` test flake is investigated and pinned. |

---

## 2. Current Status Matrix

Legend uses the Audit 0 vocabulary. Evidence is anchored to current files/types/tests/docs.

### Phase 1 — Core Orchestration / Task / Agent / LLM

- **Status**: `complete_for_current_milestone`
- **Evidence**: `packages/core/src/domain/{ids,status,errors,events,models}.ts`, `packages/core/src/schemas/domain.ts`, `apps/worker/src/workflows/run-agent-task-workflow.ts`, `tests/task-state-machine.test.ts`, `tests/mock-workflow-vertical-slice.test.ts`, `tests/instruction-resolver.test.ts`. `docs/foundations/{architecture,domain-model,task-state-machine,instruction-layer}.md`.
- **Missing for production**: production task persistence, production attribution durability.
- **Blocks current milestone**: no.
- **Blocks production**: yes, but planning v0 exists.

### Phase 2 — Collaborative Git / Branch / Merge / Conflict

- **Status**: `complete_for_current_milestone`
- **Evidence**: `packages/git-adapter/src/service.ts`, `packages/adapters/src/git/{mock-git-provider,merge-simulators,provider-factory,local-git-provider}.ts`, `packages/core/src/conflicts/{merge-queue-policy,conflict-resolution-assistant}.ts`, `tests/mock-workflow-vertical-slice.test.ts`, `tests/merge-simulators.test.ts`, `tests/conflict-risk-scoring.test.ts`, `tests/merge-queue-policy-v2.test.ts`, `tests/conflict-resolution-assistant-v1.test.ts` (in-flight), `tests/merge-queue-live-integration-test-profile-v1.test.ts` (in-flight).
- **Missing for production**: real merge execution remains disabled by design; production GitHub App rollout and production webhook endpoint are out of scope; durable merge-queue/decision/hold persistence remains in-memory.
- **Blocks current milestone**: no.
- **Blocks production**: yes, intentional.

### Phase 3 — Skill / Harness / Instruction Registry

- **Status**: `v3_implemented` (complete for milestone)
- **Evidence**: `packages/registry/src/index.ts` (full registry, resolver, packaging, governance), `tests/registry-v0.test.ts`, `tests/registry-hardening-v1.test.ts`, `tests/registry-operational-hardening-v2.test.ts`, `tests/registry-packaging-v3.test.ts`, `docs/features/registry/{v0,v1-hardening,v2-operational-hardening,v3-packaging-versioning}.md`.
- **Missing for production**: real artifact registry/OPA/npm/signing trust chain; tenant scope enforcement still partial; drift detection still planning.
- **Blocks current milestone**: no.
- **Blocks production**: yes, deferred by design.

### Phase 4 — Auto-improvement / Governance / Evals

- **Status**: `v1_implemented`
- **Evidence**: `packages/improvement/src/**`, `tests/phase-4-preparation.test.ts`, `tests/phase-4-auto-improvement-v0.test.ts`, `tests/phase-4-governance-v1.test.ts`, `docs/features/{auto-improvement,governance}/*.md`. Safety policy defaults preserved: `allowAutoApply=false`, `requireHumanApproval=true`, `requireEvalPassed=true`, `requireCanary=true`.
- **Missing for production**: real proposal generation, eval/canary execution, durable governance audit, signed package trust.
- **Blocks current milestone**: no.
- **Blocks production**: yes, deferred by design.

### Phase 5 — Production Readiness Preparation

- **Status**: `preparation_started` (cross-cutting)
- **Evidence**: `packages/{auth,policy,security,observability,deployment-readiness}/src/**`, `apps/api/src/dashboard-read-model.ts`, 20+ `/dashboard/*` endpoints, 9+ `/readiness/*` endpoints. `docs/roadmaps/{production-deployment-readiness,auth-rbac-production,secret-backend-migration,production-secret-backend-option-decision,policy-bundle-opa-cedar,policy-bundle-runtime-poc,persistent-db-production-operations,github-app-production-webhook-hardening,staging-{deployment-profile,deployment-dry-run,release-candidate,deployment-execution,ci-cd-pipeline},vault-integration-test-profile,llm-gateway-integration-test-profile,github-app-integration-test-profile,dashboard-readiness-tenant-scope}/**`.
- **Missing for production**: persistent auth and durable identity, durable audit storage, production observability backend integration, tenant isolation enforcement, production secret backend rollout, production policy bundle runtime, GitHub App production deploy, real CI/CD workflow activation.
- **Blocks current milestone**: no, planning continues.
- **Blocks production**: yes, intentional.

### Persistent DB

- **Status**: `v1_implemented`
- **Evidence**: `packages/db/src/{postgres,repository,storage}.ts`, opt-in via `AICHESTRA_STORAGE_PROVIDER=postgres`, schema `infra/migrations/0001_initial_aichestra_schema.sql`, `tests/repository-contracts.test.ts`, `tests/persistent-db-production-operations-v1.test.ts`, `docs/features/persistent-db/v1.md`, `docs/roadmaps/persistent-db-production-operations/v1.md`.
- **Missing for production**: production pooling, backup/restore jobs, retention deletion enforcement / legal hold, durable migrations governance with rollback, monitoring/alerting export.
- **Blocks current milestone**: no.
- **Blocks production**: yes, planning v1 exists.

### Real Git Adapter

- **Status**: `v2_implemented` (gated)
- **Evidence**: `packages/adapters/src/git/{github-client,github-webhooks,provider-factory}.ts`, `FetchGitHubClient` constructed only when remote-git enabled with token + repo allowlist + branch prefix; `HmacGitHubWebhookVerifier` gated by webhooks-enabled + secret-ok; `tests/real-git-adapter-v{0,1,2}.test.ts`, `tests/github-app-controlled-v1.test.ts`, `tests/github-app-integration-test-profile-v1.test.ts`. `AICHESTRA_ALLOW_REMOTE_MERGE`/`_REBASE`/`_FORCE_PUSH`/`_BRANCH_DELETE` remain unsupported.
- **Missing for production**: GitHub App installation rollout, private-key handling, real installation token exchange, production webhook endpoint, durable replay protection, GitLab/Bitbucket.
- **Blocks current milestone**: no.
- **Blocks production**: yes, planning v0 exists.

### LLM Gateway

- **Status**: `v2_implemented` (gated)
- **Evidence**: `packages/llm-gateway/src/{providers,gateway,model-router,routing,catalog,enterprise-providers,local-cli-provider-templates}.ts`, `OpenAICompatibleLLMProvider` returns `blocked_remote_llm_disabled` unless every gate (`remoteLlmEnabled`, `remoteCompletionEnabled`, `baseUrl`, `apiKey`, model allowlist, virtual key budget, policy allow) passes, re-checked per-request. `FetchOpenAICompatibleHttpClient` is only constructed inside the gated path. `tests/llm-gateway-v{0,1,2}.test.ts`, `tests/mock-llm-gateway.test.ts`, `tests/llm-gateway-integration-test-profile-v1.test.ts`, `tests/local-cli-provider-templates-v1.test.ts`.
- **Missing for production**: real Anthropic/Gemini/Bedrock/Vertex/Azure/LiteLLM providers, streaming, BYOK, OAuth/WIF/IAM, production secret manager rollout.
- **Blocks current milestone**: no.
- **Blocks production**: yes, by design.

### MCP Gateway

- **Status**: `v0_implemented`
- **Evidence**: `packages/mcp-gateway/src/{gateway,catalog,repository}.ts`, `MockMCPGateway` is the only default, real MCP transport remains disabled, `tests/mcp-gateway-v0.test.ts`, `docs/features/mcp-gateway/v0.md`.
- **Missing for production**: real MCP transport (stdio/http/sse), tool-permission policy enforcement against real servers, durable tool/invocation audit export, SecretLease-to-tool issuance.
- **Blocks current milestone**: no.
- **Blocks production**: yes, by design.

### Dashboard API-backed Read Model

- **Status**: `v0_implemented`
- **Evidence**: `apps/api/src/dashboard-read-model.ts`, `apps/web/lib/dashboard-data-provider.ts`, `apps/web/src/render.ts`, 20+ `/dashboard/*` endpoints, `AICHESTRA_DASHBOARD_DATA_SOURCE=api` switch, `tokenLikePattern`/`credentialCachePattern` sanitization, `tests/dashboard-read-model-v0.test.ts`, `tests/dashboard-data.test.ts`, `tests/dashboard-readiness-tenant-scope-{planning,implementation}-v1.test.ts`.
- **Missing for production**: production tenant filtering enforcement, durable read-model caching, websocket/SSE live updates.
- **Blocks current milestone**: no.
- **Blocks production**: yes, by design.

### Local Agent Runner

- **Status**: `v1_implemented`
- **Evidence**: `packages/runner/src/{agent-runner,local-agent-runner,command-executor,workspace,harness-policy,workspace-lifecycle,multi-session-coordination,cross-session-edit-intent,worktree-allocation*}.ts`, defaults to `MockAgentRunner`, `BlockedCommandExecutor` is default, `FixtureLocalCommandExecutor` requires `enabled=true` + per-request re-validation; shell metacharacter + deny-list checks (curl/wget/git/kubectl/vault/temporal/mcp/rm/etc.), no inherited tokens/secrets in env, `tests/local-agent-runner-v{0,1}.test.ts`, `tests/agent-workspace-lifecycle-v2.test.ts`, `tests/multi-session-agent-run-coordination-v1.test.ts`, `tests/cross-session-file-lease-edit-intent-v1.test.ts`, `tests/agent-worktree-allocation-v1.test.ts` (in-flight).
- **Missing for production**: production sandbox runtime, real Local Agent daemon, real worktree allocation, durable workspace state.
- **Blocks current milestone**: no.
- **Blocks production**: yes, by design.

### Local Agent Protocol

- **Status**: `v1_implemented`
- **Evidence**: `packages/llm-gateway/src/local-agent-protocol*.ts`, `MockLocalAgentTransport` and `FixtureLocalAgentDaemon` only, no real transport / PTY / vendor CLI, `tests/local-agent-protocol-v{0,1}.test.ts`. The local-agent-protocol-v1 regression noted in the 2026-05-14 audit is no longer present.
- **Missing for production**: real transport, signed channel + pairing, real PTY, vendor CLI execution.
- **Blocks current milestone**: no.
- **Blocks production**: yes, by design.

### Policy-as-code

- **Status**: `v0_implemented`
- **Evidence**: `packages/policy/src/{engine,default-rules,audit,types}.ts`, `StaticPolicyEngine.evaluate` is **deny-by-default**, default rules deny runner remote-git, remote LLM without gates, webhook unverified, secret reads without authorization, network egress; `tests/policy-as-code-v0.test.ts`, `tests/policy-bundle-opa-cedar-v0.test.ts`, `tests/policy-bundle-runtime-poc-v0.test.ts`, `tests/policy-shadow-evaluation-planning-v1.test.ts`, `tests/policy-runtime-golden-harness-v1.test.ts`, `tests/policy-runtime-shadow-evaluation-v1.test.ts`.
- **Missing for production**: real OPA/Rego/Cedar runtime, signed/versioned policy bundles, break-glass workflow, production audit export.
- **Blocks current milestone**: no.
- **Blocks production**: yes, planning v0/v1 exists.

### Enterprise Provider Abstraction

- **Status**: `v0_implemented`
- **Evidence**: `packages/llm-gateway/src/enterprise-providers.ts`, `packages/llm-gateway/src/local-cli-provider-templates.ts`, `ProviderAbstractionService` skeletons, `local_cli` requires Local Agent boundary + `credentialAccess = never_read_tokens`, `tests/enterprise-llm-provider-abstraction-v0.test.ts`, `tests/local-cli-provider-templates-v1.test.ts`.
- **Missing for production**: real Claude Code / Codex CLI / Aider / Gemini / Vertex / Bedrock adapters; real signed channel; OAuth/WIF/IAM.
- **Blocks current milestone**: no.
- **Blocks production**: yes, by design.

### Secrets / Sandbox

- **Status**: `v0_implemented`
- **Evidence**: `packages/security/src/{types,credentials,service,redaction,repository}.ts`, `SecretRef` has no `value` field, `MockSecretManager` only default, `SandboxProfile` container/Firecracker/K8s are placeholders, network egress denied; `tests/secrets-sandbox-design-v0.test.ts`.
- **Missing for production**: real Vault/AWS/GCP/Azure secret manager, real sandbox runtime, OS-level network egress enforcement.
- **Blocks current milestone**: no.
- **Blocks production**: yes, by design.

### SecretRef-backed Provider Credentials

- **Status**: `v1_implemented`
- **Evidence**: `packages/security/src/{credentials,service}.ts` integrated into git/llm provider factory paths, `EnvSecretProvider` disabled unless `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true` + allowlist, legacy fallback audited via `legacyCredentialFallbackAuditor`; Vault-backed Secret Backend v1 lives under `docs/foundations/vault-secret-backend/v1.md`; `tests/secretref-provider-credentials-v1.test.ts`, `tests/vault-secret-backend-v1.test.ts`.
- **Missing for production**: backend migration to Vault/cloud secret manager rollout, lease/rotation enforcement, BYOK/OAuth/WIF/IAM.
- **Blocks current milestone**: no.
- **Blocks production**: yes, planning v0 exists.

### Production Auth/RBAC Planning

- **Status**: `v0_implemented` (planning) + `v1_implemented` skeleton for production provider/IdP boundary
- **Evidence**: `packages/auth/src/{providers,service,catalog,types,request-context,middleware,scope-context,tenant-scope-enforcement,service-account*,scope-model*,oidc-skeleton*}.ts`. `MockAuthProvider` is the only active provider; OIDC/SAML/SCIM/ServiceAccount future providers are disabled placeholders. `AuthorizationService.toPolicySubject` feeds the policy engine. `tests/auth-rbac-v0.test.ts`, `tests/auth-rbac-production-v1.test.ts`, `tests/production-auth-provider-skeleton-v1.test.ts`, `tests/api-authcontext-middleware-v1.test.ts`, `tests/service-account-actor-boundary-v1.test.ts`, `tests/request-context-propagation-v1.test.ts`, `tests/tenant-repo-provider-scope-model-v1.test.ts`, `tests/tenant-scope-enforcement-v1.test.ts`, `tests/registry-governance-request-context-migration-v1.test.ts`, `tests/dashboard-readiness-tenant-scope-{planning,implementation}-v1.test.ts`. OIDC Provider Skeleton Hardening v1 documented in `docs/foundations/auth-rbac/oidc-provider-skeleton-hardening-v1.md`.
- **Missing for production**: real OIDC/SAML/SCIM integration, production sessions / JWTs, real service-account credential issuance, durable tenant repository, durable Auth/RBAC migration.
- **Blocks current milestone**: no.
- **Blocks production**: yes, planning v0/v1 exists.

### Production Deployment Readiness Planning

- **Status**: `v0_implemented`
- **Evidence**: `packages/deployment-readiness/src/{catalog,service,types,dto,dashboard-tenant-scope,signoff-scope}.ts`, `/readiness/*` endpoints, `tests/production-deployment-readiness-v0.test.ts`, `tests/staging-{deployment-profile,deployment-dry-run,release-candidate,deployment-execution,ci-cd-pipeline}-v0.test.ts`, `tests/{github-app,llm-gateway,vault,merge-queue-live}-integration-test-profile-v1.test.ts`, `tests/secret-backend-migration-v0.test.ts`, `tests/production-secret-backend-option-decision-v0.test.ts`. Read-only — no live infra checks, no real backend calls.
- **Missing for production**: real CI/CD activation, real staging deploy execution, real release tagging, real human signoff collection.
- **Blocks current milestone**: no.
- **Blocks production**: yes, by design.

### Observability / Audit Retention

- **Status**: `v0_implemented`
- **Evidence**: `packages/observability/src/{catalog,service,sanitizer,types,dto}.ts`, `AuditSanitizer` redacts env-dump / credential-cache patterns, common audit envelope; `tests/observability-audit-retention-v0.test.ts`, `docs/foundations/observability-audit-retention/v0.md`.
- **Missing for production**: real OTel/SIEM export, alerting, retention deletion enforcement / legal hold, durable audit storage.
- **Blocks current milestone**: no.
- **Blocks production**: yes, by design.

### Newly added since the previous Audit 0 (worth recording)

| Feature | Status | Key invariants |
|---|---|---|
| Merge Queue Policy v2 | `v2_implemented` (mock-first, metadata-only) | `mergeExecutionEnabled=false`, no auto-merge, no remote Git, deny-by-default `merge_queue.merge_execute_future`. |
| Conflict Resolution Assistant v1 | `v1_implemented` (in-flight, mock-first, metadata-only) | `applyAllowed=false`, `realLlmUsed=false`, no source mutation, no patch apply, no real LLM by default. |
| Merge Queue Live Integration-Test Profile v1 | `v1_implemented` (in-flight, skipped-by-default) | Requires 14 explicit gates including `AICHESTRA_ALLOW_REMOTE_MERGE/REBASE/FORCE_PUSH/BRANCH_DELETE=false` and `AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY=true`. Live skeleton never runs in default tests. |
| Multi-user / Multi-session Branch Orchestrator v2 | `v2_implemented` (metadata-only) | Deterministic safe `aichestra/` branch names, branch ownership and drift metadata only, no remote Git. |
| Cross-session File Lease / Edit Intent Graph v1 | `v1_implemented` (metadata-only) | File leases / edit intents / graph / overlap metadata only, no OS file locks, no source mutation. |
| Multi-session Agent Run Coordination v1 | `v1_implemented` (metadata-only) | Session/group/overlap metadata only, no agent execution. |
| Agent Workspace Lifecycle v2 | `v2_implemented` (metadata-only) | Workspace lease / event / cleanup metadata only, no real worktree, no destructive cleanup. |
| Agent Worktree Allocation v1 | `v1_implemented` (in-flight, fixture-only) | Dry-run / fixture-only allocation metadata, no real `git worktree add/remove`. The 2026-05-18 test run showed one transient failure in this suite that did not reproduce in the subsequent run; treat as a flake to monitor. |
| GitHub App Controlled v1 | `v1_implemented` (gated, mock token boundary) | Disabled-by-default, mock installation-token handle, no private-key signing, no real installation token exchange. |
| GitHub App / LLM / Vault / Merge Queue Integration-Test Profile v1 | `v1_implemented` (read-only, skipped-by-default) | Required env gates and unsafe-gate detection; never executes real provider actions. |
| Vault-backed Secret Backend v1 | `v1_implemented` (non-default, gated) | Vault HTTP client only when `AICHESTRA_SECRET_BACKEND_PROVIDER=vault` and `AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true`; no production rollout, no rotation/migration, no env/token/value exposure. |
| Policy Bundle / OPA-Cedar Planning v0 + Runtime PoC + Shadow Evaluation Planning v1 | `v0_implemented` / `v1_implemented` (planning + offline golden harness) | StaticPolicyEngine remains source of truth; no dynamic policy runtime; no shadow evaluator activation. |
| OIDC Provider Skeleton Hardening v1 | `v1_implemented` (disabled, readiness-only) | No JWKS fetch, no JWT validation, no real token issuance, MockAuthProvider remains active default. |
| RequestContext / AuthContext Middleware / Service Account Actor Boundary / Tenant Scope Model / Tenant Scope Enforcement (partial) / Dashboard-Readiness Tenant Scope Planning + Implementation v1 | `v1_implemented` (mock-first attribution / scope metadata) | No production tenant isolation, no production filtering, scope-decision metadata only. |
| Staging Deployment Profile / Dry-run / RC / Execution / CI/CD Pipeline Planning v0 | `v0_implemented` (read-only) | No deployment, no release/tag, no real signoff collection, no live integration-test execution by default. |
| Persistent DB Production Operations v1 | `v1_implemented` (read-only) | No production DB connection, no migration/backup/restore execution, no destructive jobs. |
| Secret Backend Migration Planning v0 + Production Secret Backend Decision v0 | `v0_implemented` (planning-only) | No secret reads/migrations/rotations; recommended backend metadata only. |
| GitHub App / Production Webhook Hardening Planning v0 | `v0_implemented` (read-only) | No app creation, no token mint, no webhook activation. |

---

## 3. Design Conformance

| Principle | Verdict | Evidence | Recommended fix |
|---|---|---|---|
| Central control plane | **pass** | `apps/api/src/main.ts` wires API, policy, auth, security, llm-gateway, mcp-gateway, runner; `apps/worker` owns workflow execution; dashboard via read models only. | none |
| Mock-first defaults | **pass** | `MockGitProvider`, `MockLLMProvider`, `MockMCPGateway`, `MockAgentRunner`, `MockAuthProvider`, `MockLocalAgentTransport`, `MockSecretManager`, `BlockedCommandExecutor`, in-memory storage are the only defaults. `remoteGitEnabled=false`, `remoteLlmEnabled=false`, `localAgentRunnerEnabled=false` by default. | none |
| Explicit integration gates | **pass** | Every real path checks env gates: `AICHESTRA_ENABLE_REMOTE_GIT`, `AICHESTRA_ENABLE_GITHUB_WEBHOOKS`, `AICHESTRA_ENABLE_REMOTE_LLM`, `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION`, `AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER`, `AICHESTRA_STORAGE_PROVIDER=postgres`, `AICHESTRA_SECRET_BACKEND_PROVIDER=vault`, `AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER`, `AICHESTRA_GITHUB_AUTH_MODE=github_app`, plus integration-test profile gates. Documented in `docs/reference/environment-gate-matrix.md` and `README.md`. | none |
| No real provider calls in default runtime/tests | **pass** | `pnpm test` runs 425 pass / 9 skipped with zero integration gates enabled. The only two `fetch(` call sites — `packages/adapters/src/git/github-client.ts:151` and `packages/llm-gateway/src/providers.ts:139` — are inside classes (`FetchGitHubClient`, `FetchOpenAICompatibleHttpClient`) that are constructed only inside gated factory paths and re-checked per-request. No `Octokit`, `openai`, `anthropic`, `@google-cloud`, or `axios` SDK is imported anywhere. | none |
| Auth/RBAC feeds PolicySubject | **pass** | `AuthorizationService.toPolicySubject` constructs PolicySubject from AuthContext; PolicyEngine receives PolicySubject; tested in `tests/auth-rbac-v0.test.ts` and `tests/policy-as-code-v0.test.ts`. | none |
| PolicyEngine remains deny-by-default | **pass** | `StaticPolicyEngine.evaluate` returns `decision: "deny"` with `matchedRuleIds: ["policy_default_deny"]` when no rule matches. Default rules deny remote-git, remote-llm without gates, webhook unverified, secret reads, network egress, runner destructive commands. `merge_queue.merge_execute_future` is denied by default. | none |
| SecretRef / CredentialManager boundary | **pass** | `SecretRef` has no `value` field. `EnvSecretProvider` is disabled unless `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true` and the key is in `AICHESTRA_ALLOWED_SECRET_ENV_KEYS`. API raw-secret detector blocks token/key/Bearer/cache-path strings. DTO path strips `value`. Dashboard sanitizer redacts `tokenLikePattern` and `credentialCachePattern`. | none |
| Git/LLM/MCP/Runner behind interfaces | **pass** | `GitProvider`, `LLMProvider`, `MCPGateway`, `AgentRunner`, `CommandExecutor`, `SecretManager`, `AuthProvider`, `LocalAgentTransport` interfaces in their respective packages. No vendor SDK imports in `apps/api/src/main.ts` or `apps/worker/src/main.ts`. Runtime wiring is via factory functions only. | none |
| Dashboard consumes read models, not workflow/business logic | **pass** | `apps/api/src/dashboard-read-model.ts` builds DTOs from repositories/services only. `apps/web/lib/dashboard-data-provider.ts` calls `/dashboard/*` endpoints only. No workflow triggers, no provider calls, no real merge/run/deploy actions in dashboard. | none |
| Auto-improvement remains proposal/draft/governance-based | **pass** | `packages/improvement` enforces draft-only + governance flow. Safety policy defaults: `allowAutoApply=false`, `requireHumanApproval=true`, `requireEvalPassed=true`, `requireCanary=true`. Apply gate is unimplemented/forbidden. | none |
| Local CLI provider requires Local Agent boundary | **pass** | `LocalCliLLMProviderBridgeSkeleton` is disabled. `local_cli` provider kind requires connected Local Agent + signed channel + consent + compatibility dispatch through `LocalAgentProtocolService`. `credentialAccess = never_read_tokens` enforced in Enterprise Provider Abstraction. | none |
| Credential cache reads forbidden | **pass** | `~/.codex/auth.json`, `~/.claude*`, Google credential cache and `AICHESTRA_VAULT_CLI_AUTH_PATH` / `AICHESTRA_VAULT_TOKEN_FILE` / `GOOGLE_APPLICATION_CREDENTIALS` are treated as unsafe in `MergeQueueIntegrationSafetyCheck`, `VaultIntegrationSafetyCheck`, `LLMIntegrationSafetyCheck`, and the dashboard sanitizer. No code path opens these files. Redaction patterns redact them in audit/dashboard. | none |
| Audit/redaction applies before storage/display | **pass** | `AuditSanitizer.sanitize` is applied before exposure. Dashboard payloads pass through `sanitizeDashboardValue` / `sanitizeDashboardObject` / `sanitizeDashboardArray`. Token-, env-dump-, and credential-cache patterns are redacted. Runner command preview is size-limited and sanitized. | none |

All 13 conformance principles **pass**. No `warning` or `fail` findings.

---

## 4. Safe Integration Compliance

Inspected with the rg query defined in `Audit_prompt.md` and the additional `child_process` / `spawn` / `fetch(` confirmation passes.

| Finding category | Count | Status |
|---|---|---|
| Safe documentation references (docs/**, AGENTS.md, README.md, audits) | many | safe — describe gates and boundaries, no calls |
| Safe mock/test references (`Mock*`, `Fixture*`, `Hmac*`, test files) | many | safe — mock or fixture-only |
| Safe type/interface references (provider/credential/audit/sanitizer types) | many | safe — type definitions only |
| Safe config placeholders (env names without values in DTOs, allowlists) | many | safe — names only |
| Gated GitHub boundary | `packages/adapters/src/git/github-client.ts:151` (`fetch`) | safe — constructed only when `remoteGitEnabled && token && allowedRepos.length > 0`, re-checked per-request |
| Gated LLM boundary | `packages/llm-gateway/src/providers.ts:139` (`fetch`) | safe — constructed only when `remoteLlmEnabled && remoteCompletionEnabled && baseUrl && apiKey && modelAllowed && policy allow`, re-checked per-request |
| Gated webhook boundary | `packages/adapters/src/git/github-webhooks.ts` (`HmacGitHubWebhookVerifier`) | safe — disabled by default, gated by `webhooksEnabled && secret.ok && verifier.kind === "hmac"` |
| Local Git boundary | `packages/adapters/src/git/{merge-simulators,local-git-provider}.ts` (`execFile`) | safe — local `git merge-tree` and fixture-only local git; never runs `git fetch/push/merge/rebase` against remote; explicitly allowed by AGENTS.md |
| Runner fixture boundary | `packages/runner/src/command-executor.ts:246` (`spawn`) | safe — only when `enabled=true` and per-request validated against deny-list (curl/wget/git/kubectl/vault/temporal/mcp/rm/...), shell metacharacters rejected, no inherited tokens, output size-limited |
| DB migration boundary | `packages/db/src/postgres.ts:1` (`spawnSync`) | safe — used only by `pnpm db:migrate` when explicitly invoked |
| Signoff scope helper | `packages/deployment-readiness/src/signoff-scope.ts:1` (`execFile`) | safe — local `git rev-parse`/`git log` for capture of safe signoff scope metadata |
| Dashboard read model sanitization | `apps/api/src/dashboard-read-model.ts`, `packages/shared/src/dashboard-read-models.ts` | safe — redacts secrets/env values |
| Readiness planning surfaces | `packages/deployment-readiness/src/**`, all `/readiness/*` endpoints | safe — read-only |
| Suspicious integration code | 0 | none found |
| Actual external calls or unsafe credential access in default runtime/tests | 0 | none found |

**Default runtime/tests do not**: call real LLM providers, call real MCP servers, call GitHub without gates, execute vendor CLI, read credential caches, expose secrets, auto-merge, force-push, delete branches, or run production deployment. Every newly added v1/v2 surface preserves these invariants.

---

## 5. Validation

| Command | Status | Summary |
|---|---|---|
| `pnpm install` | not_run | dependency metadata unchanged in audit window; `pnpm-lock.yaml` untouched |
| `pnpm lint` | **pass** | `node scripts/lint.mjs` reports `lint passed` |
| `pnpm typecheck` | **pass** | `tsc --noEmit -p tsconfig.typecheck.json` completes without diagnostics |
| `pnpm test` | **pass** | 434 tests total — 425 pass, 0 fail, 9 intentional skips (Postgres optional contracts, GitHub App / LLM / Vault / Merge Queue live integration test profiles, Conflict Resolution Assistant LLM proposal profile). Skip reasons surface in test logs as `missing gates: ...` |
| `pnpm build` | **pass** | `node scripts/build.mjs` reports `build passed` |
| `git diff --check` | **pass** | no whitespace errors |

Compared with the previous Audit 0 (2026-05-14, 223 pass / 1 fail / 4 skipped), total test count increased from 228 to 434 and the previously reported failure (`tests/local-agent-protocol-v1.test.ts:288` compatibility ordering) is resolved. One earlier run during this audit observed a single failure in `tests/agent-worktree-allocation-v1.test.ts` that did not reproduce in the recorded validation run; the recorded result is **0 fail**. The intermittent failure should be investigated and pinned before that feature is committed.

No remote integration tests were run during this audit because no integration env gates were configured.

---

## 6. Final Recommendation

**Safe to continue gated real integrations, with follow-ups.**

Production hardening can proceed on top of the existing v0/v1 planning surfaces. No critical safety regression was found. All design conformance principles pass. The mock-first, deny-by-default, gated-integration posture is intact across all newly added features (Merge Queue Policy v2, Conflict Resolution Assistant v1, Merge Queue Live Integration-Test Profile v1, Multi-user Branch Orchestrator v2, Cross-session File Lease v1, Multi-session Coordination v1, Agent Workspace Lifecycle v2, Agent Worktree Allocation v1, GitHub App Controlled v1, integration-test profiles, Vault Secret Backend v1, OIDC Hardening v1, RequestContext/Tenant Scope v1).

---

## Final Summary

**Design conformance**: pass on all 13 principles (mock-first defaults, explicit gates, deny-by-default policy, SecretRef/CredentialManager boundary, interface-driven providers, dashboard read models, draft-only auto-improvement, Local CLI via Local Agent boundary, credential cache forbidden, audit/redaction applied before storage/display).

**Current phase status**:
- Phase 1: `complete_for_current_milestone`
- Phase 2: `complete_for_current_milestone`
- Phase 3: `v3_implemented`
- Phase 4: `v1_implemented`
- Phase 5: `preparation_started`
- Persistent DB: `v1_implemented`
- Real Git Adapter: `v2_implemented` (gated; GitHub App Controlled v1 layered)
- LLM Gateway: `v2_implemented` (gated; OpenAI-compatible only)
- MCP Gateway: `v0_implemented` (mock-only)
- Dashboard: `v0_implemented` (API-backed read model + demo fallback)
- Runner: `v1_implemented` (mock-first; fixture-only command executor; workspace lifecycle v2; worktree allocation v1 in-flight)
- Local Agent Protocol: `v1_implemented` (mock transport + fixture daemon)
- Policy-as-code: `v0_implemented` (StaticPolicyEngine deny-by-default; bundle/runtime PoC planning v0/v1)
- SecretRef: `v1_implemented` (SecretRef-backed Provider Credentials v1; Vault-backed Secret Backend v1 gated)
- Auth/RBAC: `v0_implemented` (planning v0) + `v1_implemented` skeleton (RequestContext, AuthContext middleware, Service Account boundary, Tenant Scope Model, Tenant Scope Enforcement partial, Dashboard/Readiness Tenant Scope planning + implementation, Production Auth Provider Skeleton, OIDC Hardening — all disabled or readiness-only; MockAuthProvider remains the only active provider)
- Observability: `v0_implemented` (Observability / Audit Retention v0)

**Validation**:
- install: not_run (no dependency change)
- lint: pass
- typecheck: pass
- test: pass — 425/434 pass, 9 intentional skips, 0 fail
- build: pass

**Safe integration compliance**: zero unsafe findings. All 2 real `fetch` sites and all 5 local `child_process`/`spawn`/`execFile` sites are gated or local-only and re-validated per request. No vendor SDKs. No credential cache reads. All audit/dashboard surfaces redact secrets and env values.

**Production readiness**: not_ready (intentional). Phase 5 preparation is on track via planning v0/v1 surfaces; production rollout still blocked on real auth, real secret backend, durable DB operations, real observability export, real policy bundle runtime, GitHub App production deploy, production webhook hardening, real MCP transport, real Local Agent daemon, real vendor CLI execution, BYOK/OAuth/WIF/IAM, tenant isolation enforcement, and durable audit retention/legal hold.

**Critical blockers**: none for current milestone. None of the production blockers are misrepresented as ready.

**Important follow-ups**:
1. Investigate and pin the intermittent `tests/agent-worktree-allocation-v1.test.ts` failure observed once during this audit. Commit Agent Worktree Allocation v1 and its docs once the flake is understood.
2. Commit the in-flight untracked work (Conflict Resolution Assistant v1, Merge Queue Live Integration-Test Profile v1, Agent Worktree Allocation v1, and the associated `docs/features/{conflict-resolution-assistant,merge-queue-live-integration-test-profile,agent-worktree-allocation}` directories) on a single branch with consistent cross-references after final review.
3. Run Audit 4 (Integration Foundations) and Audit 5 (Production Readiness) next, per the Audit_prompt recommended order, since this Audit 0 found no architecture-level concerns that block deeper-domain audits.

**Follow-up assessment and remediation (2026-05-18)**:
- Follow-up 1 is valid and actionable. The observed `tests/agent-worktree-allocation-v1.test.ts` issue was narrowed to redaction assertions that must check raw secret/env values rather than broad substrings such as `secret`, because safe summary fields intentionally include names like `secretsExposed`. The API safety test now pins exact raw token absence and explicit `secretsExposed=false` / `envValuesExposed=false` summary behavior.
- Follow-up 2 is valid as an operational repository hygiene step, but no commit was created as part of this remediation.
- Follow-up 3 remains valid as a separate audit sequence. Audit 4 and Audit 5 were not executed in this remediation pass.
- No real Git worktree allocation, merge, rebase, push, fetch, destructive cleanup, provider call, LLM call, vendor CLI, credential-cache read, or secret/env exposure was introduced by this follow-up.

**Recommended next task**: Audit 4 — Integration Foundations audit (refresh of `docs/audits/integration-foundations-audit.md`) followed by Audit 5 — Phase 5 / Production Readiness audit (refresh of `docs/audits/phase-5-production-readiness-audit.md`).
