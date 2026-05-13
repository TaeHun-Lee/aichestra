# Aichestra — Phase 5 Production Readiness Audit

> **Audit date**: 2026-05-14
> **Reviewer**: Claude (claude-opus-4-7, 1M context)
> **Working tree**: clean at `main` @ `61a4036 feat: Secret Backend Migration Planning v0`
> **Scope**: audit-only review of production readiness across all 10 production-gating tracks. Companion to:
> - `docs/audits/current-state-design-conformance-audit.md`
> - `docs/audits/phase-1-2-core-conflict-audit.md`
> - `docs/audits/integration-foundations-audit.md`

---

## 1. Production Readiness Status

| Profile | Status | Rationale |
|---|---|---|
| **Internal prototype** | **ready** | Mock-first defaults, deterministic seed data, 19 `/dashboard/*` read-model endpoints, 9 `/readiness/*` planning endpoints, no external calls. Validates with `pnpm lint/typecheck/test/build` and `git diff --check`. Suitable for internal demos and design reviews. |
| **Internal MVP** | **ready** | First vertical slice (task → policy → registry → branch → agent → diff → test → PR → usage → merge queue) implemented mock-first and tested. `POST /tasks/:id/run` honors 409 on active runs. Conflict Manager v1 with mock + local-only `git merge-tree` dry-run. |
| **Gated integration** | **mostly_ready** | Real Git Adapter v2, LLM Gateway v2 (OpenAI-compatible only), Persistent DB v1 (opt-in Postgres), SecretRef v1 are all wired with explicit env gates and re-checked at request time. Optional integration tests skip cleanly without env vars. **Caveat**: the `local-agent-protocol-v1` test-isolation flake (`tests/local-agent-protocol-v1.test.ts:288`) reproduces ~22% in full-suite runs — a CI/release-quality issue, not a runtime safety issue. |
| **Staging** | **not_ready** | All four staging prerequisites in `docs/roadmaps/production-deployment-readiness/v0.md:69–70` are missing in implementation: Postgres connection pooling, real auth, real secret backend, audit retention. The `staging` deployment profile exists as a *planning model* only (`packages/deployment-readiness/src/catalog.ts:88–110`). |
| **Production** | **not_ready** | 10 blocking tracks are all `missing` or `partial` — see Section 2. The codebase is explicit and consistent about this status from README "Next Steps" through every v0/v1 doc through every `/readiness/*` endpoint. |

---

## 2. Production Blockers

### Identity / Auth

| Blocker | Status | Severity | Production impact | Recommended next task |
|---|---|---|---|---|
| Real OIDC | **missing** | critical | No production login. `FutureOidcAuthProviderPlaceholder` throws on every `resolveAuthContext` (`packages/auth/src/providers.ts:204–208`). | Implement OIDC provider per `docs/roadmaps/production-deployment-readiness/auth-rbac-production-v0.md:11–14`: issuer, client id/secret SecretRef, JWKS validation, callback/session strategy, group/claim mapping. |
| Real SAML | **missing** | high | Required for some enterprise IdPs. `FutureSamlAuthProviderPlaceholder` throws. | Add after OIDC. Metadata exchange, assertion validation, signing cert rotation, group mapping. |
| Real SCIM | **missing** | medium | Directory provisioning. `FutureScimDirectoryPlaceholder` throws. | Add after OIDC; idempotent sync, deprovisioning, audit. |
| Production sessions | **missing** | critical | No session store, no refresh-token rotation, no logout. | Define session model (cookie or token), durable session repository, revocation. |
| Service accounts (real) | **partial** | high | `Actor.actorKind === "service_account"` is modeled and audited (`providers.ts:140–150`), but no real issuance/rotation. `FutureServiceAccountAuthProviderPlaceholder` throws. | Service-account credential issuance + rotation via SecretRef or token service per `auth-rbac-production-v0.md:35–39`. |
| Tenant / team scoping | **missing** | critical | Repositories, policy subjects, APIs, and dashboard read models do not filter by tenant. `tenantId` not on `Principal`. | Add tenant filter through all repositories, policy resources, SecretRef scopes, dashboard reads (`auth-rbac-production-v0.md:74–84`). |
| Mock actor removal in production | **missing** | critical | `MockAuthProvider` is the only working provider; no production profile validator rejects it. README §644–650 lists this as the next planning track. | Add production profile validator that rejects `MockAuthProvider` + header actor override; tests proving production fails closed (`auth-rbac-production-v0.md:85–91`). |

**Track aggregate**: `not_ready`. This is the single biggest production blocker — every downstream production track (secrets, MCP, runner, observability, dashboard) ultimately needs real `Principal`/`tenantId` to be useful in production.

### Secrets

| Blocker | Status | Severity | Production impact | Recommended next task |
|---|---|---|---|---|
| Real secret backend | **missing** | critical | Vault / AWS Secrets Manager / GCP Secret Manager / Azure Key Vault are **future placeholders** (`packages/security/src/types.ts` `SecretProviderKind` enum; all v0 implementations return blocked). Only `MockSecretManager` and `EnvSecretProvider` exist. | Implement Vault adapter first per `docs/roadmaps/secret-backend-migration/backend-options-v0.md`; respect SecretRef policy + lease/rotation contract. |
| SecretRef migration | **partial** | high | SecretRef v1 is implemented (`v1_implemented`); migration phases / readiness checks / risk register exist as planning data (`docs/roadmaps/secret-backend-migration/secretref-provider-migration-v0.md`). The migration **execution** is not wired. | Implement `Phase 1: dual-write to Vault + env`, then `Phase 2: read from Vault primary`, then `Phase 3: env fallback rejected` per the migration plan. |
| Rotation | **missing** | high | Documented as planning metadata only (`secret-backend-migration/lease-ttl-rotation-v0.md`). No rotation job exists. | Add rotation worker that respects `SecretLease.expiresAt` once a real backend is integrated. |
| Leases | **partial** | high | `SecretLease` data model + audit + `secret.lease.request`/`secret.lease.issue` policy actions are in place. Backend-level enforcement (TTL → forced revocation) is **missing**. | Wire lease TTL enforcement in the real-backend adapter once integrated. |
| No env fallback in production | **partial** | high | `EnvSecretProvider` defaults disabled; `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=false` is the safe default. Legacy `AICHESTRA_GITHUB_TOKEN` / `AICHESTRA_GITHUB_WEBHOOK_SECRET` / `AICHESTRA_LLM_API_KEY` paths are audited via `legacyCredentialFallbackAuditor`. But **the production profile does not yet reject legacy env fallback at deploy time**. | Add production-profile validator that rejects any legacy `*_TOKEN` / `*_API_KEY` / `*_SECRET` env without a corresponding `*_SECRET_REF` (and add a negative test). |

**Track aggregate**: `not_ready`. Real secret backend is the gating piece; without it Auth/RBAC v1, GitHub App private-key handling, and durable provider-credential rotation cannot ship.

### Database

| Blocker | Status | Severity | Production impact | Recommended next task |
|---|---|---|---|---|
| Production Postgres | **partial** | high | Opt-in via `AICHESTRA_STORAGE_PROVIDER=postgres` + `AICHESTRA_DATABASE_URL`. Core slice (Task, TaskRun, UsageEvent, BranchLease, MergeSimulationResult, MergeQueueEntry, Skill/Harness/Instruction registries, registry audit/history/eval/packages) has Postgres repositories (`packages/db/src/postgres.ts`, 1,947 LOC). **Many domains** (auth, security, observability, MCP, Local Agent, deployment-readiness, governance) remain in-memory. | Extend Postgres repository coverage to auth/security/observability/MCP/Local-Agent/improvement-governance per `docs/roadmaps/persistent-db-production-operations/v1.md`. |
| Connection pooling | **missing** | critical | `PsqlCliDatabaseClient` uses `spawnSync("psql", ...)` per query (`postgres.ts:76–100`). Not a production driver. No pool. | Replace with a production pg driver (`pg` or `postgres.js`) behind the `DatabaseClient` interface, with pool config and metrics. |
| Migrations | **partial** | medium | `scripts/db/migrate.mjs` runs sorted `.sql` files via `psql -X -v ON_ERROR_STOP=1 -f`. Operator-invoked only — never automatic. No migration lock, no pre/post checks, no rollback runbook. | Add migration governance per `docs/roadmaps/persistent-db-production-operations/v1.md` and `production-deployment-readiness/database-operations-v0.md`: lock, checksum verification, pre/post probes, documented rollback. |
| Backup / restore | **missing** | critical | Backup/restore plan exists in `persistent-db-production-operations/backup-restore-runbook-v1.md`. No actual job. | Implement scheduled backup job and tested restore drill before any production cutover. |
| Index review | **partial** | medium | Read-only review at `/readiness/database/index-review`. No actual index management. | Apply indexes per `index-review-v1.md` during the Postgres-coverage expansion task. |
| Retention | **partial** | high | Retention classes / policies modeled in observability v0 (`packages/observability/src/catalog.ts`) and persistent-db v1 (`retention-and-audit-growth-v1.md`). **No deletion / legal-hold workflow is enforced**. | Implement retention deletion + legal-hold per `auth-rbac-production-v0.md` and `database-operations-v0.md` after tenant scoping. |

**Track aggregate**: `not_ready`. Connection pooling and backup/restore are the immediate critical gaps; tenant scoping is the long-tail gap.

### GitHub

| Blocker | Status | Severity | Production impact | Recommended next task |
|---|---|---|---|---|
| GitHub App installation | **missing** | critical | Planning models only (`docs/roadmaps/github-app-production-webhook-hardening/v0.md`, `packages/deployment-readiness/src/catalog.ts:586+`). `AICHESTRA_ENABLE_GITHUB_APP_INTEGRATION` is reserved but never read. | Implement GitHub App installation flow per `github-app-production-webhook-hardening/v0.md` after a real secret backend exists. |
| App private key handling | **missing** | critical | `AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF` is a placeholder env name. No JWT signing exists. | Cannot ship safely without a real secret backend (see Secrets track). |
| Installation token exchange | **missing** | critical | Not implemented. Currently only PAT/PAT-secret-ref auth via `FetchGitHubClient` (`packages/adapters/src/git/github-client.ts:151`). | Add JWT → installation-token exchange once private-key handling lands. |
| Webhook replay protection | **partial** | high | Planning surface exists (`GitHubWebhookReplayStatus` enum, seed catalog at `packages/deployment-readiness/src/catalog.ts:885–955`). **Runtime receiver re-records duplicates** (`packages/db/src/repository.ts:398–406` just appends). | **HIGHEST-priority Git track follow-up.** Implement `deliveryId`-keyed idempotency + `replay_rejected` audit at the runtime layer. Two tests: duplicate-ignored, replay-rejected. |
| Webhook dead-letter / retry | **missing** | high | Dead-letter status + retry plan modeled in `deployment-readiness/src/catalog.ts:946+`. No worker. | Add background worker that re-queues failed deliveries and routes terminal failures to dead-letter status. |
| Production webhook endpoint | **missing** | high | Verifier + sync read models are implemented (`packages/git-adapter/src/webhooks.ts`), but `webhookAcceptUnverified` is configurable and rate-limit handling is absent. | Production endpoint hardening per `github-app-production-webhook-hardening/v0.md:69+`: rate-limit, retry-after, alerts, dead-letter routing. |
| No auto-merge | **implemented** (structurally) | n/a | `remoteMergeEnabled = false` hard-coded across `provider-factory.ts:75`, `github-git-provider.ts:131`, `service.ts:100,140,700,834`. `AICHESTRA_ALLOW_REMOTE_MERGE` is never read. | None. |

**Track aggregate**: `not_ready` for App / private-key / production-endpoint, **but** auto-merge is structurally impossible — which is the safety property that matters most.

### LLM

| Blocker | Status | Severity | Production impact | Recommended next task |
|---|---|---|---|---|
| Provider allowlist | **implemented** | n/a | `AICHESTRA_LLM_ALLOWED_MODELS`, `AICHESTRA_ALLOWED_LLM_PROVIDER_KINDS`, `AICHESTRA_ALLOWED_LLM_PROVIDER_IDS`, `AICHESTRA_DENIED_LLM_PROVIDER_IDS`, `AICHESTRA_DENIED_LLM_MODELS` (`packages/llm-gateway/src/providers.ts:391–428`). | None. |
| Real provider policy | **partial** | medium | OpenAI-compatible only is real (`OpenAICompatibleLLMProvider`, `providers.ts:161–222`). Anthropic / Gemini / Bedrock / Vertex / Azure / LiteLLM are all `DisabledSkeletonLLMProvider` subclasses (`providers.ts:308–389`). | Add Anthropic-compatible as the next real provider once SecretRef migration phase 2 lands. |
| Budget | **implemented** | n/a | `VirtualModelKey` with `monthlyBudgetUsd`, `perTaskBudgetUsd`, `rpmLimit`, `tpmLimit` (`virtual-keys.ts:83–100`); `budgetDecision.allowed` required before any provider call (`gateway.ts:392`). | None. |
| Usage ledger | **partial** | medium | In-memory + Postgres core slice. `usageLedger.record` writes `taskId`/`taskRunId`. **Durable per-tenant usage rollups** for billing/budget aren't aggregated. | After Postgres expansion, add aggregated usage rollup table + retention. |
| Prompt / output retention | **partial** | high | Observability retention classes / redaction classes exist but **no enforcement**. Raw prompts/outputs are not stored by default in audit (audit envelope sanitizer in `packages/observability/src/sanitizer.ts:17–18,77`), but durable retention deletion is not wired. | Implement retention enforcement (deletion + legal hold) after durable audit storage exists. |
| Redaction | **implemented** | n/a | Three layers: API raw-secret rejection (`apps/api/src/main.ts:541–548`), security redaction (`packages/security/src/redaction.ts:17–46`), observability sanitizer (`packages/observability/src/sanitizer.ts:17–18,77`), dashboard sanitizer (`packages/shared/src/dashboard-read-models.ts:334–335`). | None. |
| Fallback safety | **implemented** | n/a | Default fallback policy: `enabled: false`, `maxAttempts: 0`, `allowedProviderKinds: ["mock"]`, `disallowedProviderKinds: ["local_cli"]`, all stop-on-* true (`routing.ts:122–141`). Policy evaluated before any fallback (`gateway.ts:1168–1235`). | None. |

**Track aggregate**: `mostly_ready` for the v2 scope; broader multi-provider rollout is staged behind SecretRef + provider implementation work.

### MCP

| Blocker | Status | Severity | Production impact | Recommended next task |
|---|---|---|---|---|
| Real MCP transport | **missing** | high | `realTransportEnabled = false` (`mcp-gateway/src/gateway.ts:112`). Any non-mock `serverKind` returns `unavailable` with `real_mcp_transport_disabled` (`gateway.ts:217–219`). | Stage real MCP transport in a separate dedicated milestone per AGENTS.md rule 112; require server allowlist + tool allowlist + secret/network controls before enabling. |
| Server allowlist | **implemented** (mock) | n/a | Seed catalog defines explicit `servers` + `allowedTools` per server (`packages/mcp-gateway/src/catalog.ts`). | None for v0. Carry forward for real-transport milestone. |
| Tool permissions | **implemented** (mock) | n/a | Risk-level policy actions: `mcp.tool.invoke.low_risk` / `.high_risk` / `.critical`, plus generic `mcp.tool.invoke` (`gateway.ts:29–33, 251–268`). `writeOperation` / `deployOperation` / `networkRequired` / `localExecutionRequired` / `requiredSecretRefs` all hard-deny at v0. | None for v0. |
| Audit | **implemented** | n/a | `sanitizeMCPRecord` + `sanitizeMCPValue` strip env-dumps, Bearer tokens, sk-/ghp_/github_pat_, credential cache paths (`gateway.ts:51–77`). | None. |
| Secret / network control | **implemented** (mock) | n/a | Tools with `requiredSecretRefs.length > 0` → `secret_denied` with `mcp_tool_secret_resolution_disabled_v0`; `metadata.networkRequired === true` → `securityService.evaluateNetworkEgress` + denied with `mcp_network_access_not_implemented_v0`. | None. |

**Track aggregate**: `mostly_ready` for v0 scope; production-ready MCP requires a future milestone.

### Runner / Local Agent

| Blocker | Status | Severity | Production impact | Recommended next task |
|---|---|---|---|---|
| Production sandbox | **missing** | critical | `SandboxProfile` kinds `container` / `firecracker` / `kubernetes` are **future placeholders only** (per AGENTS.md rule 107). Only `local_fixture` and `mock_metadata` exist. | Pick a sandbox strategy (gVisor / Firecracker / K8s pod) and integrate behind `SandboxSessionService`. |
| Command policy | **implemented** | n/a | `FixtureLocalCommandExecutor` rejects shell metacharacters, hard-deny list (`curl/wget/git/kubectl/vault/temporal/mcp/rm/...`), restricts to `node/pnpm`, harness allow/deny lists, env strips any key matching `/token|secret|key/i`, byte/time caps (`packages/runner/src/command-executor.ts:13–46, 161–343`). | None. |
| Local Agent daemon | **missing** | high | `LocalAgentProtocolService` is **mock-only** (~2,815 LOC at `packages/llm-gateway/src/local-agent-protocol.ts`). No real daemon, no WebSocket/gRPC/HTTP tunnel, no PTY (per AGENTS.md rule 99–101). | Separate product/security design milestone; do not start until production Auth/RBAC + tenant scoping land. |
| Update / revocation | **missing** | high | `revokeAgent` and channel disconnect exist in the protocol but apply to mock state. No production daemon-update path. | Defer to Local Agent daemon milestone. |
| Consent UX | **partial** | medium | Consent envelope + `recordConsentDecision` are modeled in `local-agent-protocol.ts`. No UI flow exists. | Build consent-prompt UX in the dashboard after web auth lands. |
| No credential cache reads | **implemented** | n/a | `~/.codex/auth.json`, `~/.claude*`, `application_default_credentials.json` blocked at input (`apps/api/src/main.ts:546`), redacted at audit (`packages/security/src/redaction.ts:40–41`, `packages/observability/src/sanitizer.ts:18`, `packages/shared/src/dashboard-read-models.ts:335`), denied in security service (`packages/security/src/service.ts:1227–1228`). | None. |

**Track aggregate**: `not_ready` for production runner; the mock-first runner is correct for the current scope and the Local Agent daemon should remain a future product/security design milestone.

### Policy

| Blocker | Status | Severity | Production impact | Recommended next task |
|---|---|---|---|---|
| Static TypeScript policies vs OPA/Rego/Cedar | **partial** | medium | `StaticPolicyEngine` with default-deny + restrictive default rules (`packages/policy/src/engine.ts:90–127, default-rules.ts`). No external policy bundle source. Per AGENTS.md rule 102, real OPA/Cedar is explicitly out of scope for v0. | After production Auth/RBAC v1, evaluate whether OPA/Rego or Cedar fits per `docs/roadmaps/production-deployment-readiness/policy-bundle-v0.md`. |
| Policy bundle signing / versioning | **missing** | high | No bundle source, no signature, no version pinning. | Cover in `policy-bundle-v0.md`-driven follow-up. |
| Break-glass | **missing** | medium | No documented break-glass override. | Define in production policy plan. |
| Audit | **implemented** | n/a | `policyDecisionAuditEntryToDto`, `PolicyService.listAuditEntries()` consumed by observability and `/policy/audit` endpoint. Audit metadata stripped of secrets per AGENTS.md rule 104. | None for v0. |

**Track aggregate**: `partial`. The deny-by-default semantics are intact and feed every gate; bundle management is the production-ready piece.

### Observability

| Blocker | Status | Severity | Production impact | Recommended next task |
|---|---|---|---|---|
| External backend | **missing** | critical | `observability.external_exporter.enabled = 0, exporter: "none"` (`packages/observability/src/service.ts:669`). No OTel collector. | Implement OpenTelemetry exporter + structured logs after durable audit storage exists. |
| Metrics | **partial** | high | `defaultMetricDefinitions` + `metricSnapshot()` (`packages/observability/src/catalog.ts`, `service.ts:600+`). Read-only skeleton, no backend. | Wire to OTel collector. |
| Tracing | **partial** | high | `TraceSpan` types + `getTraces()` return skeleton. No real OTel tracer. | Wire OTel tracer after backend selected. |
| Audit export | **missing** | critical | Common audit envelope exists in-memory (`apps/api/src/main.ts:4254–4272`). No export checkpoint, no SIEM hook. | After durable common-audit table, add export checkpoint per `observability-audit-v0.md`. |
| Alerting | **missing** | high | No alert delivery. | Define alerts on top of OTel backend + audit export. |
| Retention enforcement | **missing** | high | Retention classes/policies modeled (`catalog.ts`), **not enforced** (per AGENTS.md rule 111 — "retention policies must not delete data"). | Implement retention deletion + legal hold (separate workflow) after tenant scoping. |
| Legal hold | **missing** | medium | No legal-hold metadata or workflow. | Cover during retention enforcement work. |

**Track aggregate**: `not_ready`. Observability is the most cross-cutting production gap after Auth/RBAC.

### Deployment

| Blocker | Status | Severity | Production impact | Recommended next task |
|---|---|---|---|---|
| Topology | **partial** | high | Defined as planning data (`docs/roadmaps/production-deployment-readiness/deployment-topology-v0.md`) with `local`/`integration`/`staging`/`production` profiles in `packages/deployment-readiness/src/catalog.ts:68–110`. No infra manifests, no Kubernetes/Helm/Terraform/Pulumi/Compose-prod. | Pick orchestration platform; produce minimal manifests for staging. |
| CI/CD | **partial** | high | Validation commands defined (`production-deployment-readiness/ci-cd-release-v0.md:9–14`). No actual CI pipeline files in repo. | Add CI workflow (`.github/workflows/*.yml`) for lint/typecheck/test/build + the optional integration profiles per the v0 plan. |
| Release / rollback | **missing** | high | No release model, no rollback runbook (except for migrations). | Documented in `ci-cd-release-v0.md` — implement after CI lands. |
| Environment gates | **implemented** (documentation) | n/a | `docs/reference/environment-gate-matrix.md` is comprehensive: 38+ env vars with production-safety status, secret-value flag, health/dashboard visibility, redaction requirement, related tests. | None — keep updated as new gates are added. |
| Rate limit / quota | **missing** | high | No rate limit on `/git/*`, `/llm/*`, `/agents/*`, webhook receiver, etc. | Add rate-limit middleware tier in `apps/api/src/main.ts`; per-tenant quota requires tenant scoping first. |
| Tenant isolation | **missing** | critical | See Auth/RBAC track. Repositories, policy resources, dashboard reads, SecretRef scopes all single-tenant. | Tenant scoping is the foundational production work for Auth/RBAC + Database + Observability + Dashboard. |

**Track aggregate**: `not_ready`. The planning surface is comprehensive; nothing is wired.

---

## 3. Docs Consistency

| Check | Result | Detail |
|---|---|---|
| **No production-ready overclaim** | **pass** | Searched repo-wide for `production[- ]ready` / `production_ready` / `prod[- ]ready`. Every hit is correctly **negated** (`not production-ready`) or contextual (e.g., `production-ready within current scope` in the inventory's status legend). README §644–650 explicitly lists next planning tracks. AGENTS.md rules 79–80, 86–87, 113 all reiterate "not production". Every `v0.md` / `v1.md` has a "Known Limitations" or equivalent section. |
| **Phase statuses current** | **pass with one note** | Statuses across `docs/audits/2026-05-13-secretref-provider-credentials-v1-completion-review.claude.md`, `docs/audits/current-state-design-conformance-audit.md` (today), `docs/audits/phase-1-2-core-conflict-audit.md` (today), `docs/audits/integration-foundations-audit.md` (today), and `docs/foundations/repository-inventory.md` all align: Phase 1/2 `complete_for_current_milestone`, Phase 3 `v3_implemented`, Phase 4 `v1_implemented`, Phase 5 cross-cutting `v0_implemented`, real adapters `v2_implemented` (Git+LLM), MCP/Observability/Auth `v0_implemented`, SecretRef `v1_implemented`. **Note**: the older `docs/audits/2026-05-12-final-completion-audit.codex.md` predates the planning v0 work and reads as more pessimistic — that's expected (it's a frozen snapshot, not a current-state claim). |
| **Node / Volta consistency** | **pass with minor follow-up** | `package.json` engines `node >=24.0.0`; `volta.node` `24.15.0`; `.nvmrc` `24`. `docs/roadmaps/production-deployment-readiness/ci-cd-release-v0.md:19–26` documents Node 24.x. **Minor follow-up**: README.md doesn't mention the Node 24 requirement explicitly under "Install". One-line addition would help newcomers. |
| **Environment gates documented** | **pass** | `docs/reference/environment-gate-matrix.md` covers 38+ env vars with the eleven safety dimensions (purpose / default / allowed values / used by / production safe / secret value / health visibility / dashboard visibility / redaction / related tests). Every gate referenced in code (verified by grep across `provider-factory.ts`, `github-webhooks.ts`, `providers.ts`, `config.ts`, `service.ts`) is documented. |
| **Known limitations explicit** | **pass** | Every v0/v1 doc has a "Known Limitations" / "Out of scope" / "Deferred" section. AGENTS.md implementation rules are exhaustive. README.md "Deferred" §617–634 lists 18 explicit non-goals. |

---

## 4. Validation

| Command | Result | Detail |
|---|---|---|
| `pnpm lint` | **pass** | `scripts/lint.mjs` walked the tree — no trailing whitespace, no `fetch("http..."` matches, all JSON parses. |
| `pnpm typecheck` | **pass** | `tsc --noEmit -p tsconfig.typecheck.json` clean. |
| `pnpm build` | **pass** | All required design-doc / migration / source paths exist; `node --check` parses `apps/api/src/main.ts`, `apps/worker/src/main.ts`, `apps/web/src/main.ts`. |
| `git diff --check` | **pass** | Clean working tree, no whitespace errors. |
| `pnpm test` | **pass (this run)** | 228 / 224 pass / 0 fail / 4 skipped. Still observe the `local-agent-protocol-v1.test.ts:288` test-isolation flake across the four audits today: 2 of 10 full-suite runs failed on that test; 8 of 10 passed. Skipped tests = optional Postgres + GitHub/LLM integration tests requiring explicit env gates. |

---

## 5. Final Recommendation

**Safe for internal gated integration demo.**

The implementation matches the documented scope (mock-first MVP + gated real Git Adapter v2 + gated LLM Gateway v2 + opt-in Postgres + read-only planning surfaces for production tracks). It is **not safe for staging deployment** because real auth, real secret backend, durable observability, production webhook hardening, production sandbox, rate limit, and tenant scoping are all `missing` or `partial`. It is **not production-ready** by the repo's own definition and is consistently presented as such.

Continuing forward, the highest-leverage move is to stop the test-flake bleeding (so CI signal is trustworthy), then unblock the longest dependency chain in the production roadmap: Production Auth/RBAC v1 planning + GitHub App webhook dedupe/replay-rejection (both blocked on real secret backend planning), since every downstream production track (durable audit storage, tenant scoping, secret rotation, MCP transport governance) depends on having real `Principal`/`tenantId` and a real secret backend.

### Recommended next three tasks (in order)

1. **Fix the `tests/local-agent-protocol-v1.test.ts:288` test-isolation flake.** Observed 2 failures in 10 full-suite runs across today's four audits; 0 failures in isolation. Likely cross-test contamination of `LocalAgentProtocolService` repositories (capability advertisements + invocation envelopes). Suggested approach: trace which prior test sets stable agent IDs that collide, move state to per-test via `beforeEach`, then run `node --test --shuffle --concurrency=1` to surface contamination deterministically. This unblocks reliable CI signal for every subsequent change.

2. **Implement webhook delivery dedupe + replay-rejection at the runtime layer** in `packages/git-adapter/src/webhooks.ts` and `packages/db/src/repository.ts:398–406`. Currently planning-only in `packages/deployment-readiness/src/{types,catalog,service}.ts`. Add idempotent insertion keyed by `deliveryId`; `same-deliveryId-different-payloadHash` → `replay_rejected` + audit; dead-letter status on processing failure. Two tests: `duplicate first-seen → 202 ignored` and `replay_rejected → 409`. This moves the GitHub App / Production Webhook Hardening track from `planning_only` to `v1_implemented`.

3. **Production Auth/RBAC v1 planning** per `docs/roadmaps/production-deployment-readiness/auth-rbac-production-v0.md`. Pick OIDC as the first real provider; specify `Principal.tenantId`, session model, service-account rotation, mock-actor rejection in production profile. Add **production profile validator** that rejects `MockAuthProvider`, `EnvSecretProvider`, and legacy env credentials when the deployment profile is `staging` or `production`. This unlocks tenant scoping, durable audit/retention work, real secret backend rollout, and production webhook traffic — the long-tail of the production roadmap.

---

## Final Summary

**Phase 5 status**: `v0_implemented` (planning + read-model surfaces) for every cross-cutting track. No track in Phase 5 is at staging-ready, and the repo is explicit and consistent about this.

**Production readiness**:
- internal prototype: **ready**
- internal MVP: **ready**
- gated integration: **mostly_ready** (the only red signal is the test-isolation flake; runtime safety is intact)
- staging: **not_ready**
- production: **not_ready**

**Critical blockers** (must land before any staging consideration):
1. Real OIDC + session model + mock-actor production rejection
2. Real secret backend (Vault preferred) + SecretRef migration execution
3. Production Postgres driver with connection pooling + backup/restore + tenant scoping
4. GitHub App private-key handling + installation-token exchange
5. Durable observability backend + audit export + retention enforcement
6. Tenant isolation across repositories / policy / dashboard / SecretRef scopes
7. Webhook runtime dedupe + replay-rejection + dead-letter worker
8. Production sandbox strategy for the runner (gVisor / Firecracker / K8s pod)
9. CI/CD pipeline + release/rollback runbook

**Important follow-ups** (not blocking the next demo, but worth scheduling):
1. Fix the `local-agent-protocol-v1.test.ts:288` test-isolation flake
2. Implement webhook runtime dedupe + replay-rejection (planning is ahead of runtime)
3. Add SecretRef-vs-legacy-env negative-path test
4. Consolidate the worker on `StaticPolicyEngine` (the legacy `MockPolicyEngine` is still wired in `apps/worker/src/workflows/run-agent-task-workflow.ts:137–155`)
5. Tighten `scripts/lint.mjs` to also catch `fetch(\`https://...\`)` and `fetch(new URL("..."))`
6. Document Node 24 requirement in `README.md` under "Install"
7. Annotate `apps/web/lib/mock-data.ts:167–172` so the intentionally-ungated `OpenAICompatibleLLMProvider` instantiation (used only to capture the blocked-state demo payload) isn't misread as a regression
8. Add `.github/workflows/*.yml` CI files matching `ci-cd-release-v0.md` (lint/typecheck/test/build + optional integration profiles)
9. Extend Postgres repository coverage to auth/security/observability/MCP/Local-Agent/improvement-governance per `persistent-db-production-operations/v1.md`

**Recommended next tasks**:

1. **Fix `tests/local-agent-protocol-v1.test.ts:288` test-isolation flake** — it is the only red CI signal observed across all four audits I have performed today; stabilizing it gives a trustworthy gate for every subsequent change.

2. **Implement runtime webhook delivery dedupe + replay-rejection** (`packages/git-adapter/src/webhooks.ts` + `packages/db/src/repository.ts:398–406`) — moves GitHub App / Production Webhook Hardening from `planning_only` to `v1_implemented` without touching any other phase, and is a prerequisite to production webhook traffic.

3. **Production Auth/RBAC v1 planning + production profile validator** — unblocks tenant scoping, durable audit/retention, real secret backend rollout, and production webhook traffic. The longest dependency chain in the production roadmap, so starting it early has the highest leverage. The corresponding planning doc (`docs/roadmaps/production-deployment-readiness/auth-rbac-production-v0.md`) already specifies the scope.
