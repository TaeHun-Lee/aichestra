# Aichestra — Current-State Design Conformance Audit

> **Audit date**: 2026-05-14
> **Reviewer**: Claude (claude-opus-4-7, 1M context)
> **Working tree**: clean at `main` @ `61a4036 feat: Secret Backend Migration Planning v0`
> **Scope**: full-repo audit-only review of design conformance, mock-first/integration safety, validation status, and production-readiness positioning across all phases and feature tracks.

---

## 1. Executive Summary

**Rating**: `pass_with_minor_followups`

**Confidence**: high (full repo walked, all docs/feature index resolved, every safe integration boundary inspected, full validation executed).

| Concern | State |
|---|---|
| Validation green | **Partial** — `lint`, `typecheck`, `build` pass; `pnpm test` reports **223 pass / 1 fail / 4 skipped** out of 228 tests. The single failure (`tests/local-agent-protocol-v1.test.ts:288`, Enterprise Provider local_cli compatibility ordering) is a regression in a mock-only path, not an integration boundary. |
| Mock-first / gated integration safety | **Intact**. `MockGitProvider`, `MockLLMProvider`, `MockMCPGateway`, `MockAgentRunner`, `MockAuthProvider`, `MockLocalAgentTransport`, in-memory storage, and `BlockedCommandExecutor` are the defaults. Every real provider path (`OpenAICompatibleLLMProvider`, `GitHubGitProvider`, `HmacGitHubWebhookVerifier`, `FixtureLocalCommandExecutor`) is constructed only when explicit env gates resolve to truthy, and re-checks the gates at execution time. |
| Production-readiness overstated anywhere | **No**. `README.md`, `AGENTS.md`, every `v0/v1` doc, and the deployment-readiness/persistent-db/secret-backend/github-app planning packages consistently mark themselves planning-only / read-only and reiterate that production is blocked. |
| Safe to continue production hardening | **Yes** — Production Auth/RBAC v1, durable observability, audit retention v1, secret backend implementation, and GitHub App hardening v1 can proceed on top of the existing v0/v1 planning surfaces. |
| Safe to continue gated real integrations | **Yes, with follow-ups** — Real Git Adapter v2 and LLM Gateway v2 already expose controlled HTTP paths. Continuing more integrations is safe provided (a) the local-agent-protocol-v1 regression is fixed (or the test/code reconciled) and (b) legacy env-credential fallbacks remain auditable while a SecretRef-first migration progresses. |

---

## 2. Current Status Matrix

Legend uses the requested vocabulary. Evidence is anchored to current files/types/tests/docs (not historical paths).

### Phase 1 — Skeleton & Domain
- **Status**: `complete_for_current_milestone`
- **Evidence**: `packages/core/src/domain/{ids,status,errors,events,models}.ts`, `packages/core/src/schemas/{domain,schema}.ts`, `packages/core/src/registries/seed-data.ts`, `packages/core/src/conflicts/{interfaces,scoring}.ts`. State machine tests at `tests/task-state-machine.test.ts`, `tests/mock-workflow-vertical-slice.test.ts`. `docs/foundations/{architecture,domain-model,task-state-machine,mvp,mvp-scope}.md`.
- **Missing**: none for the phase.
- **Blocks current milestone**: no.
- **Blocks production**: no.

### Phase 2 — Conflict Manager & First Vertical Slice
- **Status**: `complete_for_current_milestone`
- **Evidence**: `packages/git-adapter/src/service.ts`, `packages/adapters/src/git/{mock-git-provider,merge-simulators,provider-factory}.ts`, `apps/worker/src/workflows/run-agent-task-workflow.ts`. Tests: `tests/mock-workflow-vertical-slice.test.ts`, `tests/merge-simulators.test.ts`, `tests/conflict-risk-scoring.test.ts`, `tests/mock-git-conflict-risk.test.ts`. Docs: `docs/features/conflict-manager/{v0,v1}.md`.
- **Missing**: none.
- **Blocks current milestone**: no.
- **Blocks production**: no (Conflict Manager v1 remains mock/local-only per AGENTS.md rule).

### Phase 3 — Registry (Skill / Harness / Instruction)
- **Status**: `v3_implemented` (treated as `complete_for_current_milestone` for the registry track).
- **Evidence**: `packages/registry/src/index.ts` (3,042 LOC: registries, resolver, audit log, history, rollback, approval queue, eval result attachment, package manifests, import/export, semver-range v0). Tests: `tests/registry-v0.test.ts`, `tests/registry-hardening-v1.test.ts`, `tests/registry-operational-hardening-v2.test.ts`, `tests/registry-packaging-v3.test.ts`. Docs: `docs/features/registry/{v0,v1-hardening,v2-operational-hardening,v3-packaging-versioning,*-plan}.md`.
- **Missing**: real artifact registry / OCI / npm / signing remain explicitly out of scope.
- **Blocks current milestone**: no.
- **Blocks production**: production artifact distribution and signing not yet planned; not blocking for current milestone.

### Phase 4 — Preparation, Auto-Improvement v0, Governance v1
- **Status**: `v1_implemented` (per-track) / `complete_for_current_milestone` for v1 scope.
- **Evidence**: `packages/improvement/src/index.ts` (2,037 LOC). Tests: `tests/phase-4-preparation.test.ts`, `tests/phase-4-auto-improvement-v0.test.ts`, `tests/phase-4-governance-v1.test.ts`. Docs: `docs/features/{auto-improvement,governance}/*.md`. Safety policy defaults preserved (`allowAutoApply=false`, `requireHumanApproval=true`, `requireEvalPassed=true`, `requireCanary=true`).
- **Missing**: real proposal generation, real eval/canary execution remain explicitly deferred.
- **Blocks current milestone**: no.
- **Blocks production**: not in scope for v1.

### Phase 5 — Cross-cutting hardening (Auth/RBAC, Policy, Security, Observability, Dashboard, Deployment-Readiness)
- **Status**: `v0_implemented` cross-cutting; `complete_for_current_milestone` per individual v0 track.
- **Evidence**: see the per-track entries below. Web dashboard (`apps/web/{src,app,lib,components}`) consumes API read models with explicit demo fallback; API exposes 19+ `/dashboard/*` read endpoints and 9 `/readiness/*` planning endpoints (see README.md lines 178–270, 304–334).
- **Missing**: persistent auth, durable audit storage, production observability backends, tenant isolation.
- **Blocks current milestone**: no.
- **Blocks production**: yes for production-grade auth, audit retention enforcement, and SIEM/OTel export — all already flagged in planning docs.

### Persistent DB
- **Status**: `v1_implemented` (Persistent DB v1 + Persistent DB Production Operations Planning v1).
- **Evidence**: `packages/db/src/{postgres,repository,storage}.ts`, opt-in via `AICHESTRA_STORAGE_PROVIDER=postgres` (`apps/api/src/main.ts:4299–4304`). Schema `infra/migrations/0001_initial_aichestra_schema.sql` (1,264 lines, 25+ tables). Tests: `tests/repository-contracts.test.ts` (in-memory + optional Postgres contract via `AICHESTRA_TEST_DATABASE_URL`), `tests/persistent-db-production-operations-v1.test.ts`. Docs: `docs/features/persistent-db/v1*.md`, `docs/roadmaps/persistent-db-production-operations/*`. Postgres opt-in not auto-run during build/test.
- **Missing**: real pooling, backup/restore jobs, retention deletion/legal hold, partition maintenance, async repository refactors. These are documented as deferred and exposed only through read-only planning APIs (`/readiness/database/*`).
- **Blocks current milestone**: no.
- **Blocks production**: yes for production cutover.

### Real Git Adapter
- **Status**: `v2_implemented` (gated).
- **Evidence**: `packages/adapters/src/git/{mock-git-provider,local-git-provider,github-git-provider,github-client,github-webhooks,provider-factory}.ts`, `packages/git-adapter/src/{service,webhooks}.ts`. Real HTTP only via `FetchGitHubClient` constructed in `provider-factory.ts:111–113` and only when `config.remoteGitEnabled && token && allowedRepos.length > 0`. Webhook verification via HMAC-SHA256 only when `webhooksEnabled && secret.ok && secret.value` (`github-webhooks.ts:135–141`). Tests: `tests/real-git-adapter-v{0,1,2}.test.ts`, `tests/github-app-production-webhook-hardening-v0.test.ts`. Docs: `docs/features/real-git-adapter/{v0,v1,v2,*-plan}.md`.
- **Missing**: GitHub App (private-key, installation tokens), GitLab/Bitbucket, merge/rebase/force-push/branch-delete. All explicitly deferred and modeled only as read-only planning under `packages/deployment-readiness` + `/readiness/github-app/*`.
- **Blocks current milestone**: no.
- **Blocks production**: yes for production webhook traffic and merge automation.

### LLM Gateway
- **Status**: `v2_implemented` (gated).
- **Evidence**: `packages/llm-gateway/src/{providers,gateway,model-router,routing,virtual-keys,catalog,enterprise-providers,local-agent-protocol,types,dto}.ts`. `OpenAICompatibleLLMProvider` (`providers.ts:161–222`) returns `blocked_remote_llm_disabled` unless `remoteLlmEnabled && remoteCompletionEnabled && baseUrl && apiKey` (re-checked at every request). `FetchOpenAICompatibleHttpClient` only invoked from inside that gated path. All other provider kinds are disabled `DisabledSkeletonLLMProvider` subclasses. Tests: `tests/llm-gateway-v{0,1,2}.test.ts`, `tests/mock-llm-gateway.test.ts`, `tests/enterprise-llm-provider-abstraction-v0.test.ts`. Docs: `docs/features/llm-gateway/v{0,1,2}*.md`.
- **Missing**: real Anthropic/Gemini/Bedrock/Vertex/Azure/LiteLLM, streaming, BYOK, OAuth/WIF/IAM. Explicitly deferred.
- **Blocks current milestone**: no.
- **Blocks production**: yes for multi-provider production routing.

### MCP Gateway
- **Status**: `v0_implemented`
- **Evidence**: `packages/mcp-gateway/src/{gateway,catalog,repository,types,dto}.ts`. `MockMCPGateway` is the only gateway constructed (`createDefaultMCPGateway` in `apps/api/src/main.ts:4225–4229`). Disabled real transport skeleton present. Tests: `tests/mcp-gateway-v0.test.ts` (currently passing per Section 5). Docs: `docs/features/mcp-gateway/v0*.md`.
- **Missing**: real MCP transport (stdio/http/sse), write/deploy tools, SecretLease issuance to tools, Local Agent MCP forwarding — explicitly deferred.
- **Blocks current milestone**: no.
- **Blocks production**: yes for any production MCP integration.

### Dashboard API-backed Read Model
- **Status**: `v0_implemented`
- **Evidence**: `apps/api/src/dashboard-read-model.ts` (910 LOC), `apps/web/lib/dashboard-data-provider.ts`, `apps/web/lib/mock-data.ts`, `apps/web/src/render.ts`, `packages/shared/src/dashboard-read-models.ts` (with `tokenLikePattern` / `credentialCachePattern` sanitization). 19 `/dashboard/*` endpoints; `AICHESTRA_DASHBOARD_DATA_SOURCE=api` switches the web app off the demo fallback. Tests: `tests/dashboard-read-model-v0.test.ts`, `tests/dashboard-data.test.ts`. Docs: `docs/features/dashboard/{read-model-plan,v0-plan,v0}.md`, `docs/reference/dashboard-read-model-inventory.md`.
- **Missing**: persistent dashboard caches, websocket updates — not required for v0.
- **Blocks current milestone**: no.
- **Blocks production**: no for the read-model boundary; production observability backend is a separate track.

### Local Agent Runner
- **Status**: `v1_implemented`
- **Evidence**: `packages/runner/src/{agent-runner,mock-agent-runner,local-agent-runner,command-executor,workspace,harness-policy,instruction-assembly,service,repository,config,test-runner}.ts`. Defaults to `MockAgentRunner` (`apps/api/src/main.ts:4231–4242`). `BlockedCommandExecutor` is the default; `FixtureLocalCommandExecutor` requires `enabled=true` and re-validates against shell metacharacters, deny lists (`curl/wget/git/kubectl/vault/temporal/mcp/rm/...`), harness deny/allow lists, no inherited tokens/secrets in env. Tests: `tests/local-agent-runner-v{0,1}.test.ts`. Docs: `docs/features/local-agent-runner/v{0,1}*.md`.
- **Missing**: real provider runner integration; explicitly deferred.
- **Blocks current milestone**: no.
- **Blocks production**: yes for real agent execution.

### Local Agent Protocol
- **Status**: `v1_implemented` with **a single failing test (regression)**.
- **Evidence**: `packages/llm-gateway/src/local-agent-protocol.ts` (~2,700 LOC), `enterprise-providers.ts` integration. `MockLocalAgentTransport` + `FixtureLocalAgentDaemon` only. No real transport, no PTY, no vendor CLI execution. Tests: `tests/local-agent-protocol-v{0,1}.test.ts`. Docs: `docs/features/local-agent-protocol/v{0,1}*.md`.
- **Missing**: in `enterprise-providers.ts`, the compatibility check at `:874–902` no longer returns `provider_template_incompatible` when an advertised capability set excludes the provider template prior to consent — `tests/local-agent-protocol-v1.test.ts:288` currently observes `awaiting_consent` instead of the expected `provider_template_incompatible`. This is a behavioral ordering regression in the mock-only path; it does not relax any safety gate (consent and direct execution are still blocked thereafter), but it weakens the early-fail compatibility signal.
- **Blocks current milestone**: minor follow-up — test/CI signal is broken; either the code's check ordering must be restored or the test's expectation must be reconciled with the intended UX.
- **Blocks production**: no.

### Policy-as-code (Skeleton v0)
- **Status**: `v0_implemented`
- **Evidence**: `packages/policy/src/{engine,default-rules,audit,types,dto}.ts`. `StaticPolicyEngine.evaluate` (`engine.ts:90–127`) is **deny-by-default** — no matched rule ⇒ `decision: "deny"` with `matchedRuleIds: ["policy_default_deny"]`. Default rules in `default-rules.ts` enforce: deny runner `git fetch/push/merge/rebase`, deny remote LLM unless gates set, deny webhook unverified, deny secret reads, deny network egress, etc. Tests: `tests/policy-as-code-v0.test.ts`. Docs: `docs/features/policy-as-code/v0*.md`.
- **Missing**: real OPA/Rego/Cedar, dynamic policy upload — explicitly deferred.
- **Blocks current milestone**: no.
- **Blocks production**: yes for production policy bundle management.

### Enterprise Provider Abstraction
- **Status**: `v0_implemented`
- **Evidence**: `packages/llm-gateway/src/enterprise-providers.ts`. `ProviderAbstractionService` exposes catalog/auth/credential/token/adapter skeletons. All `local_cli` providers use `external_cli_session` with `credentialAccess = never_read_tokens` (validated in `tests/enterprise-llm-provider-abstraction-v0.test.ts` and `tests/secretref-provider-credentials-v1.test.ts`). No vendor SDK is imported (only fetch from gated paths). Docs: `docs/features/enterprise-llm-provider/v0*.md`.
- **Missing**: real Claude/Codex/Gemini/Vertex/Bedrock/Foundry — explicitly deferred.
- **Blocks current milestone**: no.
- **Blocks production**: yes for real enterprise provider rollout.

### Secrets / Sandbox
- **Status**: `v0_implemented`
- **Evidence**: `packages/security/src/{types,credentials,service,redaction,repository,dto}.ts`. `SecretRef` has no `value` field; raw-secret rejection in `apps/api/src/main.ts` (`containsRawSecretField`, `:541–548`). `MockSecretManager` only. `SandboxProfile` container/Firecracker/K8s kinds are future placeholders. Network egress denied by default. Tests: `tests/secrets-sandbox-design-v0.test.ts`. Docs: `docs/features/secrets-sandbox/v0*.md`.
- **Missing**: Vault / AWS / GCP / Azure secret manager, real sandbox runtime, OS-level network egress — explicitly deferred.
- **Blocks current milestone**: no.
- **Blocks production**: yes for production secret backend and sandbox runtime.

### SecretRef-backed Provider Credentials
- **Status**: `v1_implemented`
- **Evidence**: `packages/security/src/{credentials,service}.ts`, integration in `packages/adapters/src/git/{provider-factory,github-webhooks}.ts` and `packages/llm-gateway/src/providers.ts`. SecretRef-first; legacy env fallback recorded via `legacyCredentialFallbackAuditor`/`legacySecretFallbackAuditor` and `securityService.recordSecretAudit` (`apps/api/src/main.ts:4159–4177`). `EnvSecretProvider` disabled unless `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true` and key is in `AICHESTRA_ALLOWED_SECRET_ENV_KEYS`. Tests: `tests/secretref-provider-credentials-v1.test.ts`. Docs: `docs/foundations/secretref-provider-credentials/v1*.md`. Prior audit `docs/audits/2026-05-13-secretref-provider-credentials-v1-completion-review.claude.md`.
- **Missing**: backend migration to Vault/cloud secret managers; lease/rotation actual enforcement. Covered by Secret Backend Migration Planning v0 (planning-only).
- **Blocks current milestone**: no.
- **Blocks production**: yes for production credential issuance.

### Production Auth/RBAC Planning
- **Status**: `v0_implemented` (planning + MockAuthProvider).
- **Evidence**: `packages/auth/src/{providers,service,repository,catalog,request-context,types,dto}.ts`. `MockAuthProvider` only; `OIDC/SAML/SCIM/ServiceAccount` providers are disabled placeholders. `AuthorizationService.toPolicySubject` (`service.ts:94–110`) feeds the policy engine — so Auth feeds PolicySubject as designed. Tests: `tests/auth-rbac-v0.test.ts`. Docs: `docs/foundations/auth-rbac/{v0-plan,v0}.md` and `docs/foundations/auth-rbac-readiness.md`.
- **Missing**: real OIDC/SAML/SCIM, tenant scoping, durable session/service-account/audit repositories.
- **Blocks current milestone**: no.
- **Blocks production**: yes — explicitly noted as the next planning track.

### Production Deployment Readiness Planning
- **Status**: `preparation_started` / `v0_implemented` for the planning surface.
- **Evidence**: `packages/deployment-readiness/src/{catalog,service,types,dto}.ts` (2,317 LOC of seed catalogs). `/readiness/*` endpoints in `apps/api/src/main.ts`. Tests: `tests/production-deployment-readiness-v0.test.ts`. Docs: `docs/roadmaps/production-deployment-readiness/*`.
- **Missing**: real K8s/cloud deploy, real secret backend wiring, durable audit, retention enforcement, production traffic enablement. All gated by planning-only constraints in AGENTS.md.
- **Blocks current milestone**: no.
- **Blocks production**: yes — planning is the prerequisite, not the cutover.

### Observability / Audit Retention
- **Status**: `v0_implemented`
- **Evidence**: `packages/observability/src/{catalog,service,sanitizer,types,dto}.ts`. `AuditSanitizer` redacts the env-dump and credential-cache patterns at `sanitizer.ts:17–18,77`. Common audit envelope sourced from per-domain audit lists (`apps/api/src/main.ts:4254–4272`). Tests: `tests/observability-audit-retention-v0.test.ts`. Docs: `docs/foundations/observability-audit-retention/{v0-plan,v0}.md`, `docs/reference/audit-source-inventory.md`.
- **Missing**: real OTel/SIEM export, alerting, audit export checkpoints, retention deletion/legal hold — explicitly deferred.
- **Blocks current milestone**: no.
- **Blocks production**: yes for SIEM/Otel rollout.

---

## 3. Design Conformance

Anchored to the bootstrap brief, AGENTS.md rules, and the docs catalog.

| Principle | Verdict | Evidence | Recommended fix |
|---|---|---|---|
| Central control plane (API + worker + dashboard, with policy/auth in front) | **pass** | `apps/api/src/main.ts:4136–4296` constructs the full control plane and wires `policyService`, `authorizationService`, `securityService`, `localAgentProtocolService`, `providerAbstractionService`, `mcpGatewayService` together. Workflow logic stays in `apps/worker/src/workflows`; dashboard consumes via `apps/web/lib/dashboard-data-provider.ts`. | None. |
| Mock-first defaults | **pass** | `MockGitProvider` (default in `provider-factory.ts:128`), `MockLLMProvider` (`providers.ts:449`), `MockMCPGateway`, `MockAgentRunner` (`apps/api/src/main.ts:4233–4234`), `MockAuthProvider`, `MockLocalAgentTransport`, `BlockedCommandExecutor`, in-memory storage (`main.ts:4299–4304`). | None. |
| Explicit integration gates | **pass** | All real paths gated by env: `AICHESTRA_ENABLE_REMOTE_GIT`/`_ALLOW_REMOTE_BRANCH_CREATE`/`_ALLOW_REMOTE_PR_CREATE`/`_ALLOW_REMOTE_MERGE=false` (unsupported); `AICHESTRA_ENABLE_GITHUB_WEBHOOKS`; `AICHESTRA_ENABLE_REMOTE_LLM`/`_ALLOW_REMOTE_LLM_COMPLETION`; `AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER`/`_ALLOW_LOCAL_COMMAND_EXECUTION`; `AICHESTRA_STORAGE_PROVIDER=postgres`. See README.md lines 65–121, 337–351. | None. |
| No real provider calls in default runtime/tests | **pass** | `lint` enforces `fetch("https://...")` ban (`scripts/lint.mjs:37–39`). Only two `fetch()` call sites exist: `packages/adapters/src/git/github-client.ts:151` and `packages/llm-gateway/src/providers.ts:139`. Both require gates and credential resolution; both pass URL via `new URL(...)`, dodging the lint regex correctly. No vendor SDK (`openai`, `anthropic-sdk`, `@octokit/*`) is imported anywhere. | None. |
| Auth/RBAC feeds PolicySubject | **pass** | `AuthorizationService.toPolicySubject` (`packages/auth/src/service.ts:94–110`) constructs the `PolicySubject` used by the engine. `authorizationService.checkAuthorization` calls into the same path inside the service (`service.ts:170`). | None. |
| PolicyEngine remains deny-by-default | **pass** | `StaticPolicyEngine.evaluate` returns deny when no rule matches (`engine.ts:99–112`), with `matchedRuleIds: ["policy_default_deny"]`. Default rules (`default-rules.ts:652+`) deny runner remote-git commands, remote LLM completions without gates, webhook unverified processing, secret reads, network egress, runner secret injection, MCP tool calls, local-agent secret forwarding, and improvement apply. | None. |
| SecretRef / CredentialManager boundary | **pass** | `SecretRef` has no `value` field (`packages/security/src/types.ts`). `EnvSecretProvider` requires `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true` and allowlist match (`packages/security/src/credentials.ts:21–63`). `CredentialManager` only returns transient values via `resolveCredentialForInternalUse` (`packages/security/src/service.ts:641–952`); DTO path strips the value. API raw-secret detector at `apps/api/src/main.ts:541–548` blocks token/key/Bearer/cache-path inputs. | None. |
| Git/LLM/MCP/Runner behind interfaces | **pass** | `GitProvider`, `LLMProvider`, `MCPGateway`, `AgentRunner`, `CommandExecutor` interfaces; `apps/api/src/main.ts` never imports a vendor SDK; runtime wiring goes through `createGitProviderFromEnv`, `createDefaultLlmGatewayService`, `createDefaultMCPGateway`, `createAgentRunnerFromConfig`. | None. |
| Dashboard consumes read models, not workflow/business logic | **pass** | `apps/api/src/dashboard-read-model.ts` builds DTOs from existing repositories; `apps/web/lib/dashboard-data-provider.ts` only calls `/dashboard/*` endpoints; `apps/web/src/render.ts` is pure rendering. No workflow triggers, no provider calls in dashboard paths. | None. |
| Auto-improvement remains proposal/draft/governance-based | **pass** | `packages/improvement` enforces draft-only + governance flow; safety policy defaults (`allowAutoApply=false`, `requireHumanApproval=true`, etc.) preserved (verified via `tests/phase-4-governance-v1.test.ts`). | None. |
| Local CLI provider requires Local Agent boundary | **pass** | `LocalCliLLMProviderBridgeSkeleton` is a disabled skeleton (`packages/llm-gateway/src/providers.ts:385–389`). `ProviderAbstractionService.invoke` for `local_cli` requires connected Local Agent + channel + consent + compatibility + dispatch through `LocalAgentProtocolService` (`enterprise-providers.ts:850–1000`). | The current test failure shows the compatibility-vs-consent ordering has drifted (see Section 2 → Local Agent Protocol). Reconcile the gate ordering to fail fast on incompatibility before issuing consent prompts, OR adjust the test if the new ordering is intentional. |
| Credential cache reads forbidden | **pass** | `~/.codex/auth.json`, `~/.claude*`, `application_default_credentials.json` are blocked: rejected as input (`apps/api/src/main.ts:546`), redacted in audit (`packages/observability/src/sanitizer.ts:18`, `packages/security/src/redaction.ts:40–41`, `packages/shared/src/dashboard-read-models.ts:335`), and explicitly denied in security service (`packages/security/src/service.ts:1227–1228`). No code path opens these files. | None. |
| Audit/redaction applies before storage/display | **pass** | `AuditSanitizer.sanitize` is applied in `packages/observability/src/service.ts` before exposure; `packages/shared/src/dashboard-read-models.ts:334–335` sanitizes dashboard payloads; `packages/security/src/redaction.ts` covers token-, env-dump-, and credential-cache patterns; runner command preview sanitization in `packages/runner/src/command-executor.ts:76–80`. | None. |

**Cross-cutting warnings (non-blocking)**:

- The Local Agent Protocol v1 compatibility-ordering regression (test failure at `tests/local-agent-protocol-v1.test.ts:288`) is the only conformance signal currently red. It is mock-only and does not relax any safety gate — but a green test suite is itself a design-conformance signal.
- Legacy `AICHESTRA_GITHUB_TOKEN` / `AICHESTRA_GITHUB_WEBHOOK_SECRET` / `AICHESTRA_LLM_API_KEY` env fallbacks remain supported alongside `*_SECRET_REF`. They are audited (`recordLegacyCredentialFallback`, `main.ts:4159–4177`) and gate-locked, but a v2 follow-up should add an explicit deprecation flag and a negative-path test asserting that a `disabled`/`revoked` SecretRef does not silently fall back to legacy env.
- `scripts/lint.mjs:37–39` only catches `fetch("http..."` and `https.request(`. `fetch(new URL(...))` is not matched. The current two real fetch sites already pass gates, but the lint rule would not catch a regression introducing `fetch(\`https://...\`)` either. Consider tightening the regex to cover template-literal URLs as a defense-in-depth measure.
- The web dashboard's `mock-data.ts` exercises `OpenAICompatibleLLMProvider` (`apps/web/lib/mock-data.ts:167–172`), but only to capture the *blocked* result for the demo fallback (the provider is constructed with no gates ⇒ returns `blocked_remote_llm_disabled`). This is safe but worth tagging in code so future readers don't misinterpret the call site.

---

## 4. Safe Integration Compliance

Result of the requested grep (`rg -n "fetch\(|axios|Octokit|openai|anthropic|claude|gemini|codex|gitlab|bitbucket|bedrock|OPENAI_API_KEY|..."`). Classifications below cover every hit category.

### Safe documentation references
- `docs/reference/Aichestra_Closed_Enterprise_LLM_Provider_Design_LLM_Readable/*` (json/jsonl/txt/yaml/llms.txt) — vendor names in the closed-enterprise design corpus, no executable code.
- README.md / AGENTS.md / docs/features/**/*.md / docs/roadmaps/**/*.md — vendor names and env-var names appear as gate/permission/risk documentation only.

### Safe mock references
- `packages/core/src/registries/seed-data.ts` — `compatibleAgents: ["codex","claude-code","aider"]` is metadata in the registry seed (no execution).
- `apps/runner/src/main.ts`, `apps/worker/src/main.ts` — `selectedAgent: "codex"` is a mock task fixture; no agent is launched.
- `apps/web/lib/mock-data.ts` — produces deterministic demo payloads (e.g. `text: "Bearer dashboard-token OPENAI_API_KEY=sk-dashboard-secret ~/.codex/auth.json"` is fed to the redaction tester to verify sanitization).

### Safe type / interface references
- `packages/core/src/domain/models.ts` — `AgentKind` and `ProviderKind` unions.
- `packages/llm-gateway/src/types.ts`, `packages/llm-gateway/src/enterprise-providers.ts` — provider catalog types.

### Safe config placeholders
- `.env.example` — only documents non-secret env keys (`AICHESTRA_ENV`, `DATABASE_URL=postgresql://aichestra:aichestra@localhost:5432/aichestra` is a placeholder).
- `infra/docker-compose.yml`, `docker-compose.yml` (the root mirror) — local-only compose definitions, no production credentials.

### Gated GitHub / LLM / MCP boundaries
- `packages/adapters/src/git/github-client.ts:151` — single `fetch(url, {...})` to GitHub REST. Reached only via `GitHubGitProvider`, which itself is constructed only when `provider-factory.ts:111–113` sees `remoteGitEnabled && token && allowedRepos.length > 0`.
- `packages/adapters/src/git/github-webhooks.ts:236–273` — `HmacGitHubWebhookVerifier` only used when `webhooksEnabled && secret.ok && secret.value` (`github-webhooks.ts:135–141`).
- `packages/llm-gateway/src/providers.ts:139` — `FetchOpenAICompatibleHttpClient.postJson` only invoked from `OpenAICompatibleLLMProvider.createCompletion` after `remoteLlmEnabled`, `remoteCompletionEnabled`, `baseUrl`, `apiKey`, model allowlist, virtual-key, and policy gates pass.
- `packages/mcp-gateway/src/gateway.ts` — `MockMCPGateway`; references to `mcp` are catalog/tool names; no transport.

### Dashboard API read-only
- `apps/api/src/dashboard-read-model.ts` (910 LOC) + `apps/web/lib/dashboard-data-provider.ts` — pure read-model aggregation; no workflow triggers, no provider calls.

### Readiness planning only
- `packages/deployment-readiness/src/*.ts` — only reads env *presence booleans* (`Boolean(env.AICHESTRA_*)`) for status display; never reads or returns the env value. `service.ts:563–581` and `dto.ts` (with `secretLikePattern`).
- `docs/roadmaps/{production-deployment-readiness,github-app-production-webhook-hardening,persistent-db-production-operations,secret-backend-migration}/*` — planning docs only.

### Suspicious integration code
- **None observed.** Every `fetch`, `spawn`, `exec`, `child_process` import is either:
  - a redaction pattern (`security/src/redaction.ts`, `observability/src/sanitizer.ts`),
  - a deny/audit reference (`packages/policy/src/default-rules.ts:656`, `runner/src/harness-policy.ts:25–28`, `runner/src/command-executor.ts:13–46`),
  - a local-only execution path with explicit safety boundaries (`adapters/src/git/local-git-provider.ts` — `git -C <repoPath>` against caller-supplied path; `adapters/src/git/merge-simulators.ts` — `git merge-tree --write-tree` against fixture/local path; `runner/src/command-executor.ts:246` — `spawn(...)` with `shell:false`, deny-listed executables, harness allow-list, no token env, fixture-only workspace, hard byte/time caps),
  - a Postgres CLI shell-out in `packages/db/src/postgres.ts:1` (`spawnSync`) used only by `scripts/db/migrate.mjs` when the operator explicitly runs `pnpm db:migrate`.

### Actual external calls or unsafe credential access in default runtime/tests
- **None.** Default `pnpm test` runs without any `AICHESTRA_ENABLE_*` integration env vars; the gated paths short-circuit to `blocked_remote_llm_disabled` / `blocked` / `github_webhooks_disabled` results, all verified by tests. Integration tests are explicitly skipped unless `AICHESTRA_GITHUB_INTEGRATION_TESTS=true`, `AICHESTRA_GITHUB_WEBHOOK_INTEGRATION_TESTS=true`, `AICHESTRA_LLM_INTEGRATION_TESTS=true`, or `AICHESTRA_TEST_DATABASE_URL` is set (see README.md lines 56–119, 564 and `tests/repository-contracts.test.ts`).

Default runtime/tests:
- do **not** call real LLM providers
- do **not** call real MCP servers
- do **not** call GitHub (the GitHub provider is even constructed only when gates resolve)
- do **not** execute vendor CLI
- do **not** read credential cache files
- do **not** expose secrets (raw-secret detector in API + redaction patterns in `security`/`observability`/`shared` packages)
- do **not** auto-merge (`AICHESTRA_ALLOW_REMOTE_MERGE` is structurally unsupported — `provider-factory.ts:75` hard-codes `remoteMergeEnabled: false`)
- do **not** force-push, delete branches, or run production deployment

---

## 5. Validation

All commands executed at repo root on a clean working tree.

| Command | Pass/Fail | Summary |
|---|---|---|
| `pnpm install` | **pass** (re-run, dependency metadata changed; workspace lacked link for `@aichestra/observability`) | Workspace re-linked; `+ @aichestra/observability 0.1.0 <- packages/observability`. Lockfile unchanged ("Lockfile is up to date, resolution step is skipped"). 21 workspace projects. |
| `pnpm lint` | **pass** | `scripts/lint.mjs` walked the tree: no trailing whitespace, no `fetch("http..."` / `https.request(` matches, all JSON parses. |
| `pnpm typecheck` | **pass** (after install) | `tsc --noEmit -p tsconfig.typecheck.json` succeeded with no diagnostics. Note: in a freshly cloned tree without `pnpm install`, typecheck initially failed with 18 errors all rooted in the missing `@aichestra/observability` workspace link (`TS2307`). This is a workflow note, not a code defect. |
| `pnpm test` | **fail** | `node --test` over 39 `.test.ts` files. **228 tests total**: pass 223, **fail 1**, cancelled 0, skipped 4, todo 0, duration 2.56 s. Skipped tests are the optional Postgres repository contract tests (require `AICHESTRA_TEST_DATABASE_URL`) and three integration tests that require explicit env gates. No remote integration tests were attempted (env vars not set). |
| `pnpm build` | **pass** | `scripts/build.mjs` verified all 36 required design-doc / migration / source paths exist, all required root scripts are defined, and `node --check` parses `apps/api/src/main.ts`, `apps/worker/src/main.ts`, `apps/web/src/main.ts`. |
| `git diff --check` | **pass** | Clean working tree, no whitespace errors. |

### Failing test detail

```
✖ tests/local-agent-protocol-v1.test.ts:288:1
  Enterprise Provider local_cli observes v1 channel, consent, compatibility, and fixture completion states
  AssertionError [ERR_ASSERTION]:
  + actual:   'awaiting_consent'
  - expected: 'provider_template_incompatible'
  at TestContext.<anonymous> (tests/local-agent-protocol-v1.test.ts:315:10)
```

- **Setup**: fixture local agent advertises `supportedProviderTemplates: ["gemini-cli-json"]`; channel connected; `ProviderAbstractionService.invoke({ providerId: "codex-cli-local", ... })` is called.
- **Expected**: the provider should reject early with `provider_template_incompatible` from the compatibility check in `packages/llm-gateway/src/enterprise-providers.ts:874–902`.
- **Observed**: the call proceeds past the compatibility check and is parked at `awaiting_consent` from `dispatchInvocation` (`enterprise-providers.ts:964–977`).
- **Likely cause**: the compatibility branch at `enterprise-providers.ts:876–886` is conditioned on `fixtureAgent`, but the gate logic now appears to favour the consent flow before evaluating capability advertisement vs. provider template. Either the advertisement is being treated as missing (in which case `checkCompatibility` should not flag incompatibility), or the compatibility check is being bypassed.
- **Risk classification**: low — this is in the mock-only `ProviderAbstractionService` path; real CLI execution remains blocked regardless. Production safety gates are unaffected. But the test failure should be resolved before tagging Local Agent Protocol v1 as `complete_for_current_milestone`.

### Audit-prompt commands not run

- Remote integration tests (`*_INTEGRATION_TESTS=true`) — not run; env vars are not configured (intentional per audit instructions).
- `pnpm db:migrate` — not run; would only execute against an explicit `AICHESTRA_DATABASE_URL` (intentional).

---

## 6. Final Recommendation

**Safe to continue gated real integrations, with follow-ups.**

Production hardening tracks (Auth/RBAC v1, Audit Retention v1, Secret Backend v1) are also safe to begin, since their v0 planning surfaces are read-only and mock-first by construction. Before tagging Local Agent Protocol v1 as completion-reviewed, resolve the single failing test.

---

## Final Summary

**Design conformance**:
All 13 audited design principles **pass**, with a single warning around Local Agent Protocol v1 compatibility-vs-consent ordering and a recommendation to tighten the lint regex / add an explicit legacy-fallback negative test as defense-in-depth.

**Current phase status**:
- Phase 1: complete_for_current_milestone
- Phase 2: complete_for_current_milestone
- Phase 3: v3_implemented (complete for the milestone)
- Phase 4: v1_implemented (complete for v1)
- Phase 5: v0_implemented cross-cutting (complete for v0)
- Persistent DB: v1_implemented (v1 + production-operations planning v1)
- Real Git Adapter: v2_implemented (gated)
- LLM Gateway: v2_implemented (gated, OpenAI-compatible only)
- MCP Gateway: v0_implemented (mock-only, real transport disabled)
- Dashboard: v0_implemented (API-backed read model with demo fallback)
- Runner: v1_implemented (mock default, blocked executor default)
- Local Agent Protocol: v1_implemented (with regression in compatibility-ordering test — minor follow-up)
- Policy-as-code: v0_implemented (deny-by-default)
- SecretRef: v1_implemented (with audited legacy env fallback)
- Auth/RBAC: v0_implemented (planning + MockAuthProvider)
- Observability: v0_implemented (read-only, no external export)

**Validation**:
- install: pass (re-link for `@aichestra/observability` required on a fresh tree)
- lint: pass
- typecheck: pass
- test: **fail (223 pass / 1 fail / 4 skipped of 228)** — single regression in `tests/local-agent-protocol-v1.test.ts:288`
- build: pass

**Safe integration compliance**:
No suspicious integration code. The two real `fetch` sites (`packages/adapters/src/git/github-client.ts:151`, `packages/llm-gateway/src/providers.ts:139`) are both gate-checked at construction and re-checked at request time; all other `child_process` / `spawn` / `exec` usages are local-only with hard allow/deny lists and no inherited token env. Default runtime and `pnpm test` make zero external calls.

**Production readiness**:
Not production-ready, and the repo is consistent and explicit about this (README "Next Steps", AGENTS.md implementation rules, every v0/v1 doc, every `/readiness/*` endpoint). Production cutover is blocked on Auth/RBAC v1 with real IdP, durable audit/retention, secret backend implementation, GitHub App private-key handling, durable storage operations (pooling/backup/restore/retention deletion), production observability backend, sandbox/network egress runtime, and tenant isolation. All of these are tracked in `docs/roadmaps/*` and `docs/foundations/*-readiness.md`.

**Critical blockers**:
None. There are no design-conformance failures or unsafe-integration findings that would warrant `architecture_refactor_required` or `blocked`.

**Important follow-ups**:
1. Fix or reconcile `tests/local-agent-protocol-v1.test.ts:288` — restore the compatibility-before-consent ordering in `packages/llm-gateway/src/enterprise-providers.ts:874–977`, or update the test to reflect the new intended ordering. (Highest priority — currently the only red signal.)
2. Add a negative-path test asserting that `disabled`/`revoked` `SecretRef` does **not** silently fall back to a configured legacy env (`AICHESTRA_GITHUB_TOKEN`, `AICHESTRA_GITHUB_WEBHOOK_SECRET`, `AICHESTRA_LLM_API_KEY`). The current behavior is correct (`provider-factory.ts:169–187`, `providers.ts:709–756`) but lacks a direct assertion in `tests/secretref-provider-credentials-v1.test.ts`.
3. Tighten `scripts/lint.mjs:37–39` to also catch `fetch(\`https://...\`)` and `fetch(new URL("https://..."))` template-literal/URL cases (defense-in-depth; current grep relies on the two known sites staying behind gates).
4. Document the fresh-clone workflow note: `pnpm install` must run before `pnpm typecheck` whenever a new workspace package is added (today, `@aichestra/observability` was the trigger). Consider running `pnpm install --frozen-lockfile` in a CI pre-check step.
5. Add a small comment on `apps/web/lib/mock-data.ts:167–172` clarifying that `OpenAICompatibleLLMProvider` is intentionally instantiated without gates in order to capture the blocked-state demo payload — future readers may otherwise flag this as a regression.

**Recommended next task**:
Resolve the Local Agent Protocol v1 compatibility-ordering regression (Item 1 above). After that lands and the test suite goes fully green, the next valuable milestone is Production Auth/RBAC v1 planning (per `README.md` "Next Steps" §1 and `docs/foundations/auth-rbac-readiness.md`), which unblocks every downstream production-hardening track without changing any mock-first default.
