# Phase Progress Audit

## Scope

This audit reflects the current repository state after MCP Gateway v0, Production Deployment Readiness Planning v0, Observability / Audit Retention v0, GitHub App / Production Webhook Hardening Planning v0, Persistent DB Production Operations v1, Secret Backend Migration Planning v0, Production Secret Backend Implementation Option Decision v0, Vault-backed Secret Backend v1, Vault Integration-Test Profile v1, Production Auth/RBAC v1 Planning, RequestContext Propagation v1, API AuthContext Middleware Skeleton v1, Service Account Actor Boundary v1, Registry/Governance RequestContext Migration v1, Policy Bundle / OPA-Cedar Planning v0, GitHub App Controlled Implementation v1, Staging Deployment Profile v0, Staging CI/CD Pipeline Planning v0, GitHub App integration-test profile v1, LLM Gateway integration-test profile v1, Staging Deployment Dry-run Profile v0, Staging Release Candidate Checklist v0, Staging RC Evidence Pack v0, the Staging Release Candidate Audit rerun, Staging Deployment Execution Plan v0, Staging Go/No-Go Audit v0, and Staging Human Signoff Pack v0.

Guidance and evidence reviewed:

- `AGENTS.md`
- `README.md`
- `docs/briefs/AICHESTRA_BOOTSTRAP.md`
- `AICHESTRA_CODEX_PHASE3_TO_PHASE4_WORK_ORDERS.md`
- `docs/audits/2026-05-11-bootstrap-gap-report.md`
- `docs/audits/2026-05-11-phase-2-completion-gap.md`
- `docs/features/conflict-manager/v0.md`
- `docs/features/conflict-manager/v1.md`
- `docs/features/registry/v0.md`
- `docs/features/registry/v1-hardening.md`
- `docs/features/registry/v2-operational-hardening.md`
- `docs/features/registry/v3-packaging-versioning.md`
- `docs/audits/2026-05-11-phase-3-completion-gap.md`
- `docs/features/auto-improvement/preparation-plan.md`
- `docs/features/auto-improvement/preparation.md`
- `docs/features/auto-improvement/v0-plan.md`
- `docs/features/auto-improvement/v0.md`
- `docs/features/governance/v1-plan.md`
- `docs/features/governance/v1.md`
- `docs/roadmaps/real-integration-foundation-v0-plan.md`
- `docs/foundations/repository-inventory.md`
- `docs/foundations/persistent-storage-schema-v0.md`
- `docs/features/persistent-db/v1-plan.md`
- `docs/features/persistent-db/v1.md`
- `docs/roadmaps/persistent-db-production-operations/v1-plan.md`
- `docs/roadmaps/persistent-db-production-operations/v1.md`
- `docs/roadmaps/persistent-db-production-operations/index-review-v1.md`
- `docs/roadmaps/persistent-db-production-operations/retention-and-audit-growth-v1.md`
- `docs/roadmaps/persistent-db-production-operations/webhook-persistence-v1.md`
- `docs/roadmaps/persistent-db-production-operations/backup-restore-runbook-v1.md`
- `docs/roadmaps/persistent-db-production-operations/connection-pooling-v1.md`
- `docs/features/real-git-adapter/v0-plan.md`
- `docs/features/real-git-adapter/v0.md`
- `docs/features/real-git-adapter/v1-plan.md`
- `docs/features/real-git-adapter/v1.md`
- `docs/features/real-git-adapter/v2-plan.md`
- `docs/features/real-git-adapter/v2.md`
- `docs/features/llm-gateway/v0-plan.md`
- `docs/features/llm-gateway/v0.md`
- `docs/features/llm-gateway/v1-plan.md`
- `docs/features/llm-gateway/v1.md`
- `docs/features/llm-gateway/v2-plan.md`
- `docs/features/llm-gateway/v2.md`
- `docs/features/mcp-gateway/v0-plan.md`
- `docs/features/mcp-gateway/v0.md`
- `docs/roadmaps/production-deployment-readiness/v0-plan.md`
- `docs/roadmaps/production-deployment-readiness/v0.md`
- `docs/foundations/observability-audit-retention/v0-plan.md`
- `docs/foundations/observability-audit-retention/v0.md`
- `docs/reference/audit-source-inventory.md`
- `docs/reference/runtime-component-inventory.md`
- `docs/reference/environment-gate-matrix.md`
- `docs/foundations/secretref-provider-credentials/v1-plan.md`
- `docs/foundations/secretref-provider-credentials/v1.md`
- `docs/foundations/vault-secret-backend/v1-plan.md`
- `docs/foundations/vault-secret-backend/v1.md`
- `docs/roadmaps/vault-integration-test-profile/v1-plan.md`
- `docs/roadmaps/vault-integration-test-profile/v1.md`
- `docs/features/local-agent-runner/v0-plan.md`
- `docs/features/local-agent-runner/v0.md`
- `docs/features/local-agent-runner/v1-plan.md`
- `docs/features/local-agent-runner/v1.md`
- `docs/features/policy-as-code/v0-plan.md`
- `docs/features/policy-as-code/v0.md`
- `docs/features/enterprise-llm-provider/v0-plan.md`
- `docs/features/enterprise-llm-provider/v0.md`
- `docs/features/secrets-sandbox/v0-plan.md`
- `docs/features/secrets-sandbox/v0.md`
- `docs/features/local-agent-protocol/v0-plan.md`
- `docs/features/local-agent-protocol/v0.md`
- `docs/features/local-agent-protocol/v1-plan.md`
- `docs/features/local-agent-protocol/v1.md`
- `docs/foundations/auth-rbac-readiness.md`
- `docs/foundations/auth-rbac/v0-plan.md`
- `docs/foundations/auth-rbac/v0.md`
- `docs/foundations/auth-rbac/v1-plan.md`
- `docs/roadmaps/auth-rbac-production/v1.md`
- `docs/roadmaps/auth-rbac-production/idp-options-v1.md`
- `docs/roadmaps/auth-rbac-production/tenant-scope-model-v1.md`
- `docs/roadmaps/auth-rbac-production/service-account-system-actor-v1.md`
- `docs/roadmaps/auth-rbac-production/request-context-propagation-v1.md`
- `docs/roadmaps/auth-rbac-production/mock-actor-deprecation-v1.md`
- `docs/reference/production-rbac-permission-matrix.md`
- `docs/features/real-git-adapter/audits/v0-readiness.md`
- `docs/features/dashboard/read-model-plan.md`
- `docs/features/dashboard/v0-plan.md`
- `docs/features/dashboard/v0.md`
- `docs/reference/dashboard-read-model-inventory.md`
- `docs/roadmaps/real-integration-roadmap.md`
- `docs/roadmaps/staging-deployment-dry-run/v0-plan.md`
- `docs/roadmaps/staging-deployment-dry-run/v0.md`
- `docs/roadmaps/staging-deployment-dry-run/report-format-v0.md`
- `docs/roadmaps/staging-deployment-dry-run/blocker-taxonomy-v0.md`
- `docs/roadmaps/staging-release-candidate/v0-plan.md`
- `docs/roadmaps/staging-release-candidate/v0.md`
- `docs/roadmaps/staging-release-candidate/report-format-v0.md`
- `docs/roadmaps/staging-release-candidate/release-notes-template-v0.md`
- `docs/roadmaps/staging-release-candidate/rollback-checklist-v0.md`
- `docs/roadmaps/staging-release-candidate/evidence-pack-v0-plan.md`
- `docs/roadmaps/staging-release-candidate/release-notes-draft-v0.md`
- `docs/roadmaps/staging-release-candidate/rollback-evidence-v0.md`
- `docs/roadmaps/staging-release-candidate/signoff-readiness-v0.md`
- `docs/audits/staging-rc-evidence-pack-v0.md`
- `docs/audits/2026-05-14-staging-release-candidate-audit-v0-rerun.md`
- `docs/audits/2026-05-14-staging-go-no-go-audit-v0.md`
- `docs/roadmaps/staging-deployment-execution/v0.md`
- `docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md`
- `docs/roadmaps/staging-deployment-execution/signoff-evidence-checklist-v0.md`
- `docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md`
- `docs/roadmaps/production-secret-backend-option-decision/v0-plan.md`
- `docs/roadmaps/production-secret-backend-option-decision/v0.md`
- `docs/roadmaps/production-secret-backend-option-decision/decision-criteria-v0.md`
- `docs/roadmaps/production-secret-backend-option-decision/backend-evaluation-v0.md`
- `docs/roadmaps/production-secret-backend-option-decision/recommendation-v0.md`
- `docs/roadmaps/production-secret-backend-option-decision/secretref-provider-mapping-v0.md`
- `docs/roadmaps/production-secret-backend-option-decision/implementation-scope-v1.md`
- `docs/roadmaps/production-secret-backend-option-decision/env-to-production-secret-backend-migration-v0.md`
- `docs/roadmaps/production-secret-backend-option-decision/test-strategy-v1.md`
- `docs/roadmaps/production-secret-backend-option-decision/risk-register-v0.md`
- implementation under `apps/`, `packages/`, `tests/`, `scripts/`, and `docs/`

## 1. Phase Mapping

| Phase | Status | Rationale |
|---|---|---|
| Phase 1: LLM and cost management foundation, task orchestration, mock or real Git workflow, usage ledger, API, worker, dashboard | `complete_for_current_milestone` | The mock MVP vertical slice is implemented, validated, tested, and still mock-only. Task orchestration exists in `apps/worker/src/workflows/run-agent-task-workflow.ts`; API task creation/run endpoints exist in `apps/api/src/main.ts`; mock LLM/model routing, mock Git PR/branch behavior, usage ledger, worker, and web dashboard are implemented. This is not production-ready. |
| Phase 2: Branch conflict manager, active branch or lease graph, conflict risk scoring, merge queue, conflict visibility | `complete_for_current_milestone` | v0 concepts exist (`BranchLease`, `ConflictRisk`, `MergeQueueEntry`) and v1 adds `MergeSimulationResult`, `MergeSimulator`, `MockMergeSimulator`, `LocalGitDryRunMergeSimulator`, simulation-aware risk and queue fields, API visibility, dashboard visibility, and tests. This is not full Phase 2 completion because semantic/symbol/test impact signals, rebase-needed detection, resolver handoff, human escalation workflow, and provider-backed merge automation remain future work. |
| Phase 3: Skill Registry, Harness Registry, Instruction Registry, version pinning, separation of Skill / Harness / InstructionArtifact | `v3_implemented` | Separate domain concepts, seed registries, exact and simple semver range refs, repository interfaces, in-memory and file-backed repositories, stable DTOs, registry APIs, registry-backed workflow selection, TaskRun-selected refs, audit logs, approval/eval gates, local checksum verification, append-only history, rollback, approval queue read models, local eval result attachment, mock mutation RBAC, local package manifests, local import/export, package diffs, dashboard visibility, and tests exist. Signed artifacts, full approval workflow, eval execution, full package management, real auth/RBAC, and real artifact registry integration remain future work. |
| Phase 4: Auto-improvement loop, trace clustering, LLM-based Skill or Harness patch proposals, eval, canary rollout | `v1_implemented` | Mock-only Auto-improvement v0 exists and Governance v1 now adds `ProposalReviewQueueItem`, `ProposalGovernanceDecision`, `ProposalEvalRun`, `CanaryReadiness`, `ProposalApplyGate`, improvement governance audit events, readiness checks that consider governance/eval/canary/draft status, API/dashboard visibility, and tests. This is not production auto-improvement: no LLM calls, no embeddings, no active registry mutation, no proposal auto-approval, no eval execution, no canary execution, and no apply behavior exists. |
| Phase 5: Enterprise features such as SCIM, audit export, production policy-as-code, private deployment, data residency, advanced security | `preparation_started` | Policy-as-code Skeleton v0, Policy Bundle / OPA-Cedar Planning v0, Production Auth/RBAC Planning v0, Production Auth/RBAC v1 Planning, RequestContext Propagation v1, API AuthContext Middleware Skeleton v1, Service Account Actor Boundary v1, Registry/Governance RequestContext Migration v1, Production Deployment Readiness Planning v0, Observability / Audit Retention v0, GitHub App / Production Webhook Hardening Planning v0, GitHub App Controlled Implementation v1, Persistent DB Production Operations v1, Secret Backend Migration Planning v0, Production Secret Backend Implementation Option Decision v0, Vault-backed Secret Backend v1, Vault Integration-Test Profile v1, Staging Deployment Profile v0, Staging CI/CD Pipeline Planning v0, GitHub App integration-test profile v1, LLM Gateway integration-test profile v1, Staging Deployment Dry-run Profile v0, Staging Release Candidate Checklist v0, Staging RC Evidence Pack v0, Staging Deployment Execution Plan v0, Staging Go/No-Go Audit v0, and Staging Human Signoff Pack v0 now exist as static/mock-first scaffolding, planning artifacts, read-only readiness foundations, and controlled mock/status runtime boundaries, but there is no production identity provider, SCIM sync, session management, production service-account credential issuance, production policy runtime, signed policy bundle verification, audit export implementation, private deployment workflow, actual staging deployment workflow, active CI/CD deployment workflow, release creation workflow, data residency control, production observability backend, production DB operations, live GitHub App integration, production LLM integration, production Vault rollout or cloud secret backend integration, production rotation workflow, real human signoff approval storage, or advanced enterprise security implementation. |

Real integration foundation: `v0_scaffolded`. A storage provider and repository factory abstraction exists in `packages/db/src/storage.ts`; the default runtime remains in-memory. Repository inventory, Postgres-oriented schema design, migration skeleton, auth/RBAC readiness, Real Git Adapter readiness, dashboard read model plan, and real integration roadmap are documented.

Persistent DB: `v1_implemented`. `packages/db/src/postgres.ts` adds an opt-in Postgres storage provider, repository factory, small database client boundary, and Postgres-backed repositories for Task, TaskRun, usage ledger, branch leases, merge simulations, merge queue, registry entities, registry audit/history, registry packages, and registry eval results. `scripts/db/migrate.mjs` runs the SQL migration only when explicitly invoked. Optional Postgres repository contract tests run only when `AICHESTRA_TEST_DATABASE_URL` is configured. Phase 4 governance repositories remain in-memory for v1.

Persistent DB Production Operations: `v1_implemented`. `docs/roadmaps/persistent-db-production-operations/` defines the non-destructive DB operations runbook, migration readiness, index review, retention/audit growth plan, webhook persistence plan, backup/restore runbook, and connection pooling plan. `packages/deployment-readiness` adds read-only DB deployment profile, readiness check, migration status, schema inventory, index review, retention/audit growth, webhook persistence, and risk seed models. `/readiness/database/*`, `/dashboard/database`, and `/health` expose booleans, counts, checksums, and planning metadata only; they do not connect to production databases, expose DB URL values, execute migrations, run backup/restore jobs, delete data, or mark DB operations production-ready.

Secret Backend Migration Planning: `v0_implemented`. `docs/roadmaps/secret-backend-migration/` defines backend option comparison, SecretRef provider migration, credential kind migration, lease TTL/rotation strategy, env fallback deprecation, and the v0 roadmap. `packages/deployment-readiness` adds read-only secret backend option, migration phase, readiness check, risk, rotation plan, lease policy, and summary seed models. `/readiness/secrets/*`, `/dashboard/secret-backend`, and `/health` expose booleans, counts, statuses, and planning metadata only; they do not connect to Vault/cloud/custom secret backends, read or migrate actual secrets, rotate secrets, issue credentials, expose env values, or read credential caches.

Production Secret Backend Implementation Option Decision: `v0_implemented`. `docs/roadmaps/production-secret-backend-option-decision/` selects Vault as the first implementation path and AWS Secrets Manager (`aws_secrets_manager_future`) as the second choice for AWS-first deployments. `packages/deployment-readiness` adds read-only decision, criteria, score, provider mapping, implementation scope, risk, and summary seed models. `/readiness/secret-backend-decision/*`, `/dashboard/secret-backend-decision`, and `/health` expose decision/status/count/risk metadata only. This decision surface does not call Vault/cloud/custom backends, read secrets, migrate secrets, rotate secrets, issue credentials, or expose env values.

Vault-backed Secret Backend: `v1_implemented`. `docs/foundations/vault-secret-backend/` defines the gated non-default Vault provider boundary. `packages/security` adds `provider: vault`, Vault config parsing, `DisabledVaultClient`, `MockVaultClient`, isolated `GatedHttpVaultClient`, `VaultSecretProvider`, Auth/RBAC and Policy checks before client reads, path allowlist checks, SecretLease/CredentialHandle metadata, Vault-specific audit events, redaction, `/readiness/secrets/vault/*`, `/security/secrets/vault/*`, `/dashboard/vault-secret-backend`, and `/health` Vault metadata. This is not production secret management: default runtime/tests do not call Vault, Vault is not the default, no production Vault rollout/HA/unseal/storage/bootstrap exists, no destructive migration or rotation exists, no BYOK/OAuth/WIF/IAM exists, and production secret backend readiness remains false.

Vault Integration-Test Profile: `v1_implemented`. `docs/roadmaps/vault-integration-test-profile/` defines the skipped-by-default optional live-test profile for Vault config, provider=vault SecretRef metadata, path allowlist, KV v2 read status, CredentialHandle resolution status, Auth/RBAC and Policy gates, audit redaction, and no-secret exposure checks. `packages/deployment-readiness` adds read-only profile, test-case, safety-check, and summary seed models. `/readiness/vault-integration/*`, `/dashboard/vault-integration`, and `/health` expose gate counts, missing/unsafe gate names, configured booleans, path allowlist counts, test path allowlisted/test-only booleans, test-case status, operation policy, and no-secret/no-env booleans only. Default runtime/tests do not call Vault, expose Vault tokens, address values, raw paths, keys, secret values, env values, write/delete/rotate secrets, broadly list paths, or read credential caches.

Real Git Adapter: `v2_implemented`. `GitProvider` exposes provider-neutral branch, PR, changed-file, validation, and merge simulation recording operations. `MockGitProvider` remains the default; `LocalGitProvider` supports fixture-safe local Git inspection without fetch, push, or working-tree mutation; `GitHubGitProvider` supports controlled branch creation, PR creation, and PR changed-file reads through a `GitHubClient` boundary only when explicit remote Git gates, operation gates, repo allowlists, branch prefix, credentials, and policy checks pass. v2 adds disabled-by-default GitHub webhook receive, HMAC/mock verifier boundaries, webhook event/verification/audit records, PR/branch sync read models, safe changed-file refresh through the existing GitHubClient boundary, API routes, health metadata, dashboard visibility, and deterministic tests. This is not production Git integration because automatic merge/rebase, force push, branch deletion, live GitHub App installation, installation token exchange, GitLab, and Bitbucket remain out of scope.

GitHub App Controlled Implementation: `v1_implemented`. `packages/adapters/src/git/github-app.ts` and `packages/git-adapter/src/github-app.ts` add GitHub App runtime config, installation state, repository grant, installation token request/result models, disabled/mock token provider boundaries, metadata-only token handles, config gates, SecretRef metadata checks, Auth/RBAC checks, Policy-as-code checks, sanitized audit, `/git/github-app/*` status endpoints, `/health` GitHub App metadata, and dashboard visibility. This is not production GitHub App integration because private-key signing, JWT issuance, live installation-token exchange, live installation discovery, production webhook rollout, automatic merge/rebase, force push, branch deletion, GitLab, and Bitbucket remain out of scope.

GitHub App integration-test profile: `v1_implemented`. `docs/roadmaps/github-app-integration-test-profile/` defines a skipped-by-default optional live-test profile for GitHub App config, installation-token, branch, PR, changed-file, webhook fixture, and cleanup checks. `packages/deployment-readiness` adds read-only profile, test-case, safety-check, and summary seed models. `/readiness/github-app-integration/*`, `/dashboard/github-app-integration`, and `/health` expose gate counts, missing/unsafe gate names, test-case status, cleanup policy, and no-secret/no-env booleans only. Default runtime/tests do not call GitHub, mint installation tokens, read private keys, expose env values, auto-merge, force-push, or delete branches.

LLM Gateway: `v2_implemented`. `LLMProvider` and `LLMGatewayService` provide provider-neutral model routing, deterministic mock completions, model catalog, virtual model key policy objects, per-task budget checks, usage ledger integration, LLM audit events, API endpoints, health metadata, dashboard visibility, and tests. `OpenAICompatibleLLMProvider` supports one controlled OpenAI-compatible HTTP chat-completion path behind explicit remote LLM, completion, base URL, credential, model allowlist, virtual-key, budget, route, and policy gates. v2 adds provider-aware routes, bounded fallback policy, routing decisions, provider health read models, disabled skeleton providers for Anthropic/Gemini/Bedrock/Vertex/Azure/LiteLLM, and Local CLI `local_agent_required` behavior. Mock remains the default. This is not production LLM integration because BYOK, OAuth/device-code/WIF/IAM, broad non-OpenAI provider calls, streaming, Local CLI execution, production cloud secret manager integration, and production auth/RBAC remain out of scope.

LLM Gateway integration-test profile: `v1_implemented`. `docs/roadmaps/llm-gateway-integration-test-profile/` defines a skipped-by-default optional live-test profile for OpenAI-compatible config, credential readiness, model allowlist, budget guard, mock completion, gated remote completion, usage ledger, audit redaction, and fallback-disabled checks. `packages/deployment-readiness` adds read-only profile, test-case, safety-check, and summary seed models. `/readiness/llm-integration/*`, `/dashboard/llm-integration`, and `/health` expose gate counts, missing/unsafe gate names, provider readiness, model allowlist count, budget status, test-case status, fallback safety, and no-secret/no-env/no-raw-response booleans only. Default runtime/tests do not call an LLM provider, expose API keys/env values, store raw provider responses, enable streaming/tool calls, execute vendor CLI, read credential caches, or run unbounded fallback.

Production Auth/RBAC Planning: `v0_implemented`. `packages/auth` defines provider-neutral principal, actor, team, role, permission, resource scope, role binding, service account, identity provider, auth context, request context, and auth audit models; `MockAuthProvider` is the default; future OIDC/SAML/SCIM/service-account providers are disabled placeholders; `AuthorizationService` bridges RBAC with Policy-as-code; `/auth/*`, health, and dashboard expose mock auth visibility without secrets or tokens. This is not production auth: no real SSO, OAuth login, OIDC, SAML, SCIM, session management, password login, API-key issuance, external IdP call, or tenant isolation exists.

Production Auth/RBAC v1 Planning: `v1_implemented`. `docs/roadmaps/auth-rbac-production/` defines IdP option comparison, tenant/scope model, service-account/system actor plan, request context propagation plan, mock actor deprecation plan, and the v1 roadmap. `docs/reference/production-rbac-permission-matrix.md` documents production roles, allowed and denied actions, scopes, audit requirements, implementation status, and future work. `packages/deployment-readiness` adds read-only auth provider option, migration phase, readiness check, production risk, tenant boundary, service account, permission matrix, and summary seed models. `/readiness/auth/*`, `/dashboard/auth-production`, and `/health` expose planning-only metadata without IdP calls, login/logout/session/JWT/password behavior, service-account credential issuance, tenant enforcement, tokens, cookies, session ids, passwords, raw identity assertions, or provider credentials. This is not production auth.

RequestContext Propagation: `v1_implemented`. `packages/auth` now provides RequestContext and CorrelationContext helpers for API, system, test, webhook, dashboard, and readiness sources. `AuthorizationService` enriches PolicySubject mapping with request id, correlation id, and source; selected Git, LLM, MCP, Security, dashboard/readiness, and observability paths propagate sanitized actor/correlation metadata. This is not production auth: no session parsing, JWT/API-key issuance, external IdP calls, tenant enforcement, service-account credential issuance, cookie/token storage, or policy bypass exists.

API AuthContext Middleware Skeleton: `v1_implemented`. `apps/api` now resolves one cached mock-first RequestContext at API ingress where practical through `ApiRequestContextMiddleware`, reuses the cached context in representative Auth, Policy, Security, Git, LLM, MCP, Local Agent, Dashboard, Readiness, Observability, provider, runner, and task run-agent routes, and exposes safe `/health` and `/auth/me` summaries. This is not production auth: cookies and Authorization headers are not treated as auth, no sessions/JWTs/API keys/service-account credentials are issued, and no external IdP calls exist.

Service Account Actor Boundary: `v1_implemented`. `packages/auth` now defines a static mock service-account actor catalog, `ServiceAccountContextFactory`, `mock_service_account` AuthContext behavior, service-account Role/Actor/ServiceAccount catalog entries, and serviceAccountId-enriched PolicySubject/audit metadata. Selected Git provider/webhook/sync, GitHub App token-handle, LLM gateway/router, MCP fallback, Security credential, Runner policy, and Local Agent protocol policy paths use service-account attribution where practical. This is not production service-account auth: no service-account credentials, JWTs, API keys, sessions, credential rotation, external IdP/provider calls, credential-cache reads, secret/env exposure, or production service-account enablement exists.

Registry/Governance RequestContext Migration: `v1_implemented`. `packages/registry` and `packages/improvement` now accept RequestContext/AuthContext on high-value registry mutation, package, resolver, governance decision, draft registry change, eval metadata, canary readiness, and apply-gate paths. Migrated registry/governance audit records include request/correlation/auth/source/principal/actor-kind/service-account metadata where available. This is not production governance: apply remains blocked, auto-improvement does not mutate active registry entries, no real eval/canary execution exists, and no production auth or service-account credential issuance is enabled.

Local Agent Runner: `v1_implemented`. `AgentRunner` now exposes provider-neutral runner lifecycle methods, `MockAgentRunner` remains deterministic and default, `LocalAgentRunner` is disabled by default, `CommandExecutor` adds blocked and fixture-local command execution boundaries, `LocalAgentWorkspaceManager` validates fixture/temp workspaces, `RunnerHarnessPolicy` blocks unsafe commands/network/remote Git/file writes/secrets, instruction assembly records selected refs and a deterministic hash, in-memory runner repositories record AgentRun, AgentRunAudit, InstructionAssembly, AgentWorkspace, and CommandExecutionResult data, `/agents/*` and `/tasks/:id/run-agent` API routes expose runner behavior, health/dashboard visibility is implemented, and tests cover mock/local safety behavior. This is not production agent execution because real Codex CLI, Claude Code, Aider, production sandboxing, arbitrary command execution, and secrets injection remain out of scope.

Policy-as-code: `v0_implemented`. `packages/policy` now defines provider-neutral `PolicySubject`, `PolicyResource`, `PolicyAction`, `PolicyContext`, `PolicyRule`, `PolicyDecision`, and `PolicyDecisionAuditEntry` models, a deterministic `StaticPolicyEngine`, a restrictive default rule set, in-memory policy decision audit, DTOs, API endpoints, health/dashboard visibility, and tests. Policy checks are integrated into Git, LLM, Runner, Registry mutation authorization boundaries, and Auth/RBAC v0 where practical. This is not production policy enforcement: no OPA/Rego, Cedar, production identity provider, external policy service, dynamic policy code, or persistent policy store exists.

Policy Bundle / OPA-Cedar Planning: `v0_implemented`. `docs/roadmaps/policy-bundle-opa-cedar/` defines engine option comparison, policy bundle schema plan, policy review workflow, policy test strategy, rollout/rollback strategy, break-glass plan, and the v0 roadmap. `docs/reference/policy-domain-mapping.md` maps current Git, Git webhook, LLM, MCP, Runner, Registry, Improvement, SecretRef, Secrets/Sandbox, Provider, Local Agent, Auth, Dashboard, and Deployment Readiness policy domains to future bundle inputs and outputs. `packages/deployment-readiness` adds read-only policy engine option, bundle plan, domain mapping, readiness check, risk, migration phase, and summary seed models. `/readiness/policy-bundles/*`, `/dashboard/policy-bundles`, and `/health` expose planning-only metadata without replacing `StaticPolicyEngine`, executing OPA/Rego or Cedar, calling external policy services, loading remote bundles, verifying signed bundles, executing break-glass, or exposing secrets. This is not production policy bundle management.

Enterprise Provider Abstraction: `v0_implemented`. `packages/llm-gateway/src/enterprise-providers.ts` defines provider kind/auth/catalog models, credential/token resolver skeletons, blocked provider adapters, Local CLI provider templates, Local Agent boundary models, parser/redaction utilities, provider audit events, API/dashboard visibility, and tests. It does not call provider APIs, execute vendor CLIs, read credential caches, or perform token exchange.

Secrets and Sandbox: `v0_implemented`; SecretRef-backed Provider Credentials: `v1_implemented`. `packages/security` defines metadata-only `SecretRef`, `SecretScope`, `SecretLease`, `SecretAccessDecision`, `CredentialHandle`, `CredentialResolutionResult`, explicit env `EnvSecretProvider`, gated Vault provider boundary, `SandboxProfile`, `SandboxSession`, `SandboxDecision`, `NetworkEgressPolicy`, `RedactionPolicy`, in-memory repositories, a mock `SecretManager`/`SecurityControlService`, security audit events, DTOs, API/dashboard visibility, and tests. Credential resolution now uses Auth/RBAC where available and evaluates provider/Git/LLM/lease policy checks before env or Vault reads. Policy-as-code includes secret, sandbox, network, runner secret injection, provider credential, and Local Agent secret-forwarding actions. This is not production secret management or sandboxing: no production Vault rollout, cloud secret backend, production secret injection, container/VM sandbox, network enforcement, or credential cache access exists.

Local Agent Protocol: `v1_implemented`. `packages/llm-gateway/src/local-agent-protocol.ts` defines Local Agent registration/status/capability/session models, mock signed channel and handshake metadata, fixture daemon simulation, capability advertisements, CLI compatibility matrix/results, invocation envelope metadata, consent request/decision records, deterministic lifecycle states, normalized stdout/stderr/system events, invocation streams, in-memory repositories, `MockLocalAgentTransport`, redaction/audit behavior, and policy/security/provider integration. `/local-agents/*` API routes, health metadata, dashboard visibility, docs, schema skeletons, and tests are implemented. This is not a production Local Agent: no real daemon, WebSocket/gRPC/HTTP tunnel, PTY automation, vendor CLI execution, credential cache read/upload, OAuth/device-code/WIF/IAM exchange, cloud provider call, or secret forwarding exists.

Dashboard API-backed Read Model: `v0_implemented`. `packages/shared/src/dashboard-read-models.ts` defines stable dashboard read-model DTOs and sanitization helpers. `apps/api/src/dashboard-read-model.ts` aggregates current service/repository/config/audit state for `/dashboard/*` routes without running workflows, calling providers, executing runner commands, creating Local Agent fixture invocations, requesting secret leases, invoking MCP tools, connecting to production databases, executing migrations, creating CI workflows, running CI jobs, running remote integration tests, or reading credential caches. `apps/web/lib/dashboard-data-provider.ts` adds API and demo providers, and `apps/web/src/render.ts` consumes read models, including mock Auth/RBAC v0, MCP Gateway v0, GitHub App hardening, GitHub App integration-test readiness, LLM integration-test readiness, observability, DB operations, staging, staging dry-run, staging RC, staging execution planning, and CI/CD readiness visibility. This is not a production dashboard: production auth scoping, tenant isolation, production DB operations, active CI/CD workflow execution, actual staging deployment execution, and analytics remain future work.

MCP Gateway: `v0_implemented`. `packages/mcp-gateway` defines MCP server/tool catalog models, deterministic `MockMCPGateway`, disabled real MCP transport skeletons, invocation/audit repositories, DTOs, Auth/RBAC and Policy-as-code checks, redaction, API routes, health metadata, dashboard visibility, and tests. This is not production MCP integration: no real MCP server transport, stdio/http/sse calls, external integrations, network access, SecretLease forwarding, write/deploy tools, model-generated automatic tool execution, vendor CLI execution, credential-cache reads, or Local Agent MCP forwarding exists.

Production Deployment Readiness Planning: `v0_implemented`. `docs/roadmaps/production-deployment-readiness/` defines topology, checklist, observability/audit, database operations, secret backend migration, auth/RBAC production, policy bundle, staging profile, staging dry-run, staging execution planning, and CI/CD release plans. `docs/reference/runtime-component-inventory.md`, `docs/reference/environment-gate-matrix.md`, and `docs/reference/staging-environment-gate-matrix.md` inventory runtime components and gates. `packages/deployment-readiness` adds read-only deployment profile, readiness check, production risk, GitHub App hardening, GitHub App integration-test readiness, LLM integration-test readiness, database operations, secret backend migration, auth production, policy bundle, staging, staging dry-run, staging execution, and CI/CD seed models. `/readiness/deployment/*`, `/readiness/database/*`, `/readiness/secrets/*`, `/readiness/auth/*`, `/readiness/policy-bundles/*`, `/readiness/staging/*`, `/readiness/staging-dry-run/*`, `/readiness/staging-execution/*`, `/readiness/ci-cd/*`, `/readiness/llm-integration/*`, `/dashboard/readiness`, `/dashboard/database`, `/dashboard/secret-backend`, `/dashboard/auth-production`, `/dashboard/policy-bundles`, `/dashboard/staging`, `/dashboard/staging-dry-run`, `/dashboard/staging-execution`, `/dashboard/ci-cd`, and `/dashboard/llm-integration` expose planning-only metadata without external calls, secrets, env values, DB URL values, migration execution, backup jobs, rotation jobs, active CI workflow creation, CI job execution, remote integration-test execution, deployment, production traffic, or destructive operations. This is not production readiness: production auth, production secret backend rollout, policy bundle runtime, observability backend, production DB pooling/backup/retention, tenant isolation, active CI/CD workflows, actual staging deployment, production LLM integration, and production deployment automation remain blockers.

Staging Deployment Profile: `v0_implemented`. `docs/roadmaps/staging-deployment-profile/` defines the non-production staging profile contract, integration-test policy, risk register, v0 roadmap, and implementation plan. `docs/reference/staging-environment-gate-matrix.md` documents staging-specific required, gated, forbidden, future, secret, and redaction posture for environment variables. `packages/deployment-readiness` adds read-only staging profile, integration gate, readiness check, promotion criterion, rollback criterion, and summary seed models. `/readiness/staging/*`, `/dashboard/staging`, and `/health` expose profile status, gates, checks, promotion criteria, rollback criteria, blockers, warnings, mock actor warning, env fallback warning, and no-secret/no-env status only. This is not a staging deployment: no infrastructure manifests, provider calls, production traffic, remote MCP, vendor CLI execution, secret/env exposure, or production-ready claim exists.

Staging CI/CD Pipeline Planning: `v0_implemented`. `docs/roadmaps/staging-ci-cd-pipeline/` defines the CI/CD planning roadmap, job matrix, integration-test gate policy, secret/env safety policy, artifact/report policy, staging promotion criteria, cleanup/rollback policy, and implementation plan. `packages/deployment-readiness` adds read-only CI/CD pipeline profile, job definition, integration test gate, readiness check, risk, and summary seed models. `/readiness/ci-cd/*`, `/dashboard/ci-cd`, and `/health` expose pipeline profiles, job matrix metadata, optional integration gates, blockers, risks, Node/Volta status, artifact policy, cleanup/rollback status, and no-secret/no-env status only. This is not CI/CD execution: no active workflow, provider call, default remote integration test, deployment job, artifact upload, secret/env exposure, or production-ready claim exists.

Staging Deployment Dry-run Profile: `v0_implemented`. `docs/roadmaps/staging-deployment-dry-run/` defines the dry-run profile plan, v0 behavior, report format, and blocker taxonomy. `packages/deployment-readiness` adds read-only dry-run profile, source, check, blocker, integration profile classification, report, and summary models that aggregate staging, CI/CD, DB operations, GitHub App integration tests, LLM integration tests, Secret Backend Migration, Auth/RBAC, Policy Bundle planning, Observability, MCP, Git, LLM, Local Agent, Runner, and Dashboard readiness. `/readiness/staging-dry-run/*`, `/dashboard/staging-dry-run`, and `/health` expose the dry-run report, source summaries, blockers, recommended next actions, promotion/rollback guidance, skipped integration profiles, and no-secret/no-env status only. This is not a deployment validator that performs work: no deployment, CI job execution, remote integration-test execution, provider call, resource mutation, destructive Git, real MCP transport, vendor CLI execution, secret/env exposure, staging-deployed claim, or production-ready claim exists.

Staging Release Candidate Checklist: `v0_implemented`. `docs/roadmaps/staging-release-candidate/` defines the RC checklist plan, v0 behavior, report format, release-notes template, rollback checklist, Evidence Pack v0 plan, release-notes draft, rollback evidence, and signoff readiness. `docs/audits/staging-rc-evidence-pack-v0.md` records validation, skipped-test, safety, release-note, rollback, and signoff readiness evidence for a future audit. `packages/deployment-readiness` adds read-only checklist, gate, blocker, signoff, release-note requirement, rollback checklist, report, and summary models that aggregate staging dry-run, staging profile, CI/CD planning, optional integration profiles, production readiness, DB operations, auth, secrets, policy bundle, observability, dashboard, Git, LLM, MCP, runner, and Local Agent readiness. `/readiness/staging-rc/*`, `/dashboard/staging-rc`, and `/health` expose RC status, required gates, blockers, signoffs, release-note requirements, rollback checklist, skipped optional tests, recommended next actions, and no-release/no-deployment/no-secret/no-env status only. This is not a release or deployment validator that performs work: no release creation, Git tag creation, GitHub release creation, deployment, CI job execution, remote integration-test execution, provider call, resource mutation, destructive Git, real MCP transport, vendor CLI execution, secret/env exposure, staging-deployed claim, production-ready claim, or fake human approval exists.

Staging Deployment Execution Plan: `v0_implemented`. `docs/roadmaps/staging-deployment-execution/` defines the read-only execution plan, sequence, pre-deploy gates, optional live integration decision policy, post-deployment smoke placeholders, rollback plan, and v0 roadmap. `packages/deployment-readiness` adds deterministic execution plan, step, gate, go/no-go, rollback, and summary models that consume staging RC, dry-run, CI/CD, GitHub App, LLM, Vault, database, secret backend, auth, policy, observability, dashboard, MCP, Git, runner, and Local Agent readiness surfaces. `/readiness/staging-execution/*`, `/dashboard/staging-execution`, and `/health` expose plan status, step sequence, gates, blockers, pending signoffs, optional integration decisions, go/no-go status, rollback readiness, and no-release/no-deployment/no-secret/no-env status only. This is not a staging deployment: no release creation, Git tag creation, deployment command execution, CI job execution, remote integration-test execution, provider call, resource mutation, credential issuance, destructive Git, real MCP transport, vendor CLI execution, secret/env exposure, staging-deployed claim, production-ready claim, or fake human approval exists.

Observability / Audit Retention: `v0_implemented`. `packages/observability` defines the common `AuditEventEnvelope`, audit taxonomy, retention classes, redaction classes, audit sanitizer, source coverage, retention policy read models, metric definitions/snapshots, trace-span skeletons, and an in-memory `ObservabilityService`. `/observability/*`, `/health`, `/dashboard/observability`, and the web dashboard expose normalized audit/read-model data without external observability calls, alert delivery, audit export, retention deletion jobs, raw secrets, raw tokens, raw webhook payloads, unredacted credential cache paths, or raw prompts/outputs. This is not production observability: durable common audit storage, external export, alerting, retention enforcement, tenant scoping, and OpenTelemetry/SIEM integration remain future work.

GitHub App / Production Webhook Hardening Planning: `v0_implemented`. `docs/roadmaps/github-app-production-webhook-hardening/` defines the GitHub App target architecture, permission matrix, webhook event allowlist, replay protection, retry/dead-letter, credential, and production endpoint plans. `packages/deployment-readiness` adds read-only GitHub App descriptor, installation, repository grant, permission, webhook delivery/dead-letter, credential readiness, endpoint readiness, readiness check, risk, and summary seed models. `/readiness/github-app/*` and `/dashboard/github-app` expose planning-only metadata without GitHub calls, private key reads, installation token exchange, production webhook enablement, destructive Git operations, or secrets. This is not production GitHub App integration: live App installation, private-key signing, durable replay store, queue/dead-letter worker, production endpoint rollout, and alerting remain future work.

## 2. MVP Vertical Slice Validation

| Step | Implemented | Evidence | Concerns |
|---|---|---|---|
| Task creation | yes | `InMemoryAichestraStore.createTask` in `packages/db/src/repository.ts`; `POST /tasks` in `apps/api/src/main.ts` | In-memory only. |
| Task run trigger | yes | `POST /tasks/:id/run` delegates to `runAgentTaskWorkflow` in `apps/api/src/main.ts` | Synchronous trigger only; no queue/process separation yet. |
| Mock policy check | yes | `MockPolicyEngine` in `packages/adapters/src/policy/mock-policy-engine.ts`; used by workflow via `policyEngine.evaluateTask` | Policy model is intentionally simple. |
| Mock model selection | yes | `MockModelRouter` in `packages/llm-gateway/src/model-router.ts`; workflow calls `modelRouter.selectModel` | No budget-aware routing beyond mock behavior. |
| Mock skill selection | yes | Workflow calls `resolveRegistryContextForTask` and stores `selectedSkillRefs` on `TaskRun`; resolver supports exact and simple semver range requests | Semver support is intentionally v0, not a full package manager. |
| Mock harness selection | yes | Workflow calls `resolveRegistryContextForTask` and stores `selectedHarnessRef` on `TaskRun` | No harness YAML parser or runtime execution. |
| Mock instruction set selection | yes | Registry resolver selects instruction refs; `assembleInstructionSet` assembles selected artifacts | Checksums are recorded but not enforced against file content. |
| Mock branch creation | yes | `GitProvider.createBranch` interface and `MockGitProvider.createBranch`; workflow calls `gitProvider.createBranch` | No real worktree/branch creation by design. |
| Mock agent execution | yes | `MockAgentRunner.run` in `packages/runner/src/mock-agent-runner.ts`; workflow calls `agentRunner.run` | Deterministic but prompt-keyword based. |
| Deterministic diff summary | yes | `MockAgentRunner` returns fixed changed files and diff summary based on prompt keywords | Limited file pattern coverage. |
| Mock test pass | yes | `MockTestRunner.run` in `packages/runner/src/test-runner.ts` | Simulated tests only. |
| Mock/local dry-run merge simulation | yes | `MergeSimulator` in `packages/core/src/conflicts/interfaces.ts`; `MockMergeSimulator` and `LocalGitDryRunMergeSimulator` in `packages/adapters/src/git/merge-simulators.ts`; workflow records simulation through `store.recordMergeSimulation` | Local simulator is dry-run only and does not fetch, push, or mutate the working branch. |
| Mock PR creation | yes | `MockGitProvider.createDraftPullRequest`; workflow stores pull request | Uses `mock://` URL, safe. |
| Usage ledger entry | yes | `MockUsageLedger.record`; `MockLlmGateway.complete` includes `taskId`, `taskRunId`, provider/model, token/cost metadata | Good attribution for MVP. |
| Completed task state | yes | Workflow transitions through `pr_draft_ready` to `completed` when not blocked | High-risk conflict paths can end in `review_required`, which is expected. |
| Dashboard visibility | yes | `apps/web/src/render.ts` consumes `DashboardReadModels`; `/dashboard/*` routes expose Task, Git, Conflict, Registry, LLM, Runner, Policy, Provider, Security, Local Agent, MCP Gateway, and Audit sections | Demo fallback remains only for deterministic static/offline rendering. |

## 3. Architecture Boundary Audit

| Item | Result | Evidence | Recommended Fix |
|---|---|---|---|
| API handlers should not contain excessive orchestration logic | pass | `apps/api/src/main.ts` routes `POST /tasks/:id/run` to `runAgentTaskWorkflow` rather than directly running policy/model/Git/agent logic | Keep API as trigger/read layer when adding async queues. |
| Worker or workflow layer should own execution flow | pass | `runAgentTaskWorkflow` owns policy, model/skill/harness/instruction selection, branch, agent, tests, PR, usage, leases, and merge queue flow | Later split into smaller workflow activities if complexity grows. |
| Core domain models should stay provider-agnostic | pass | Core types include provider enums, but no SDK or runtime provider calls; no framework imports in core domain | Keep concrete providers in adapters only. |
| Mock adapters should sit behind interfaces | pass | Interfaces in `packages/adapters/src/interfaces.ts`; mocks implement LLM, Git, policy, MCP, secrets, runner, usage ledger | `packages/adapters` is still an aggregate package; split ownership can be tightened later. |
| Git provider behavior should be abstracted | pass | `GitProvider` interface and `MockGitProvider` exist; merge simulation uses `MergeSimulator` with mock/local implementations behind interfaces | Add real provider only behind explicit interfaces and environment gates. |
| LLM provider behavior should be abstracted | pass | `LlmGateway` interface and `MockLlmGateway`; `ModelRouter` abstraction exists | Budget-aware routing can be added in the gateway/router layer. |
| Usage ledger should be attributed to taskId and taskRunId | pass | `MockLlmGateway.complete` fills `taskId` and `taskRunId`; tests assert attribution in `tests/mock-workflow-vertical-slice.test.ts` | None for MVP. |
| Skill, Harness, and InstructionArtifact should remain separate concepts | pass | Separate domain types, separate registry APIs, separate seed arrays, service methods, DTOs, and registry tests in `tests/registry-v0.test.ts` and `tests/registry-hardening-v1.test.ts` | Keep future artifact packaging separate for each concept. |
| Dashboard should consume API data rather than duplicating domain logic | pass | `ApiDashboardDataProvider` fetches `/dashboard/*`; `DemoDashboardDataProvider` is explicit fallback for static/offline rendering | Add auth/tenant scoping before production use. |
| Tests should verify behavior, not only snapshots | pass | Tests cover API behavior, workflow outcomes, conflict scoring, merge simulation, usage attribution, state transitions, dashboard read models, provider fallback, and merge queue release behavior | Add API contract docs later. |

## 4. State Machine Audit

Current Task states from `packages/core/src/domain/status.ts`:

```text
draft
planned
policy_blocked
queued
branch_created
running
testing
pr_draft_ready
pr_opened
ci_pending
ci_failed
conflict_detected
conflict_fixing
review_required
merge_ready
merged
completed
failed
cancelled
```

Current TaskRun states:

```text
queued
running
succeeded
failed
cancelled
```

Findings:

- Task transitions are explicit in `taskTransitions` and enforced by `assertTaskStatusTransition`.
- Illegal Task transitions are prevented through `InMemoryAichestraStore.transitionTask`.
- TaskRun states are typed, but TaskRun transitions are not enforced by a dedicated transition function. Updates are currently ad hoc through `updateTaskRun`.
- Repeated `POST /tasks/:id/run` behavior is defined and documented.
- Active duplicate runs are prevented by `findActiveTaskRun`, which blocks `queued` or `running` runs with `ConflictError`; API maps this to `409 Conflict`.
- Completed and failed tasks may return to `queued` to create a new TaskRun attempt.
- `failed`, `policy_blocked`, and `completed` are distinct Task states.

Recommended policy:

- Keep current repeated-run policy.
- Add explicit TaskRun transition validation before introducing async workers or retries.

## 5. Mock-Only Compliance

Search command run:

```bash
rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|gemini|codex|gitlab|bitbucket|bedrock|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|GITHUB_APP_PRIVATE_KEY|GITHUB_APP_ID|GITHUB_INSTALLATION_ID|AICHESTRA_GITHUB_WEBHOOK_SECRET|GOOGLE_APPLICATION_CREDENTIALS|AICHESTRA_LLM_API_KEY|LLM_API_KEY|DATABASE_URL|AICHESTRA_DATABASE_URL|AICHESTRA_TEST_DATABASE_URL|SESSION_SECRET|JWT_SECRET|PASSWORD|SAML|OIDC|SCIM|OKTA|AUTH0|ENTRA|OPA|REGO|CEDAR|POLICY_BUNDLE|~/.codex|auth.json|~/.claude|credential cache|git fetch|git push|git merge|git rebase|kubectl|vault|temporal|mcp|child_process|exec\\(|spawn\\(|eval\\(|new Function" .
```

Additional targeted searches:

```bash
rg -n --glob '!docs/**' --glob '!README.md' --glob '!AGENTS.md' --glob '!Audit_prompt.md' "fetch\\(|axios|Octokit|openai|anthropic|claude|gemini|codex|gitlab|bitbucket|bedrock|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|GITHUB_APP_PRIVATE_KEY|GITHUB_APP_ID|GITHUB_INSTALLATION_ID|AICHESTRA_GITHUB_WEBHOOK_SECRET|GOOGLE_APPLICATION_CREDENTIALS|AICHESTRA_LLM_API_KEY|LLM_API_KEY|DATABASE_URL|AICHESTRA_DATABASE_URL|AICHESTRA_TEST_DATABASE_URL|SESSION_SECRET|JWT_SECRET|PASSWORD|SAML|OIDC|SCIM|OKTA|AUTH0|ENTRA|OPA|REGO|CEDAR|POLICY_BUNDLE|~/.codex|auth.json|~/.claude|credential cache|git fetch|git push|git merge|git rebase|kubectl|vault|temporal|mcp|child_process|exec\\(|spawn\\(|eval\\(|new Function" .
rg -n --glob '!docs/**' --glob '!README.md' --glob '!AGENTS.md' "fetch\\(|axios|Octokit" apps packages tests scripts
rg -n --glob '!docs/**' --glob '!README.md' --glob '!AGENTS.md' "child_process|exec\\(|spawn\\(" apps packages tests scripts
rg -n --glob '!docs/**' --glob '!README.md' --glob '!AGENTS.md' "git fetch|git push|git merge|git rebase|kubectl|vault|temporal" apps packages tests scripts infra
```

Classification:

- Safe documentation references: `README.md`, `AGENTS.md`, roadmap/audit/reference docs, and provider design docs that describe future integrations and blocked behavior. `design_docs/` is not present in the current repository.
- Safe mock references: dashboard/test seed strings, provider catalog templates, mock MCP naming, mock branch names, and blocked local CLI/provider examples.
- Safe type/interface references: provider/agent enum strings, disabled future runner kinds, provider template metadata, and policy action names.
- Safe config placeholders: `AICHESTRA_LLM_API_KEY`, `AICHESTRA_GITHUB_TOKEN`, `AICHESTRA_GITHUB_WEBHOOK_SECRET`, and provider env key names are read only as gated configuration metadata and are not emitted into audit/output. LLM Gateway v1/v2 uses `AICHESTRA_LLM_API_KEY` only inside the gated OpenAI-compatible provider boundary. Real Git Adapter v2 uses webhook secret values only inside the verifier boundary.
- Staging RC checklist/readiness references: Staging Release Candidate Checklist v0 models, docs, and Evidence Pack v0 are read-only readiness/evidence metadata. They expose no release creation, Git tag, deployment execution, external call, secret, env value, real signoff claim, or production-ready claim.
- Dashboard API read-only references: `/dashboard/staging-rc` and the dashboard read model aggregate DTOs only and do not run validations, release steps, deployments, integration tests, providers, or commands.
- Gated LLM provider boundary: `OpenAICompatibleLLMProvider` owns the only remote LLM `fetch` path. It is not selected by default and can call HTTP only when remote LLM, completion, base URL, API key, model allowlist, route, budget, credential, and policy gates pass.
- Gated GitHub client boundary: `FetchGitHubClient` is instantiated only from explicit GitHub remote config and is not used by default tests/runtime. Service/API layers do not call `fetch` directly.
- Safe local-only git usage: `LocalGitProvider` and `LocalGitDryRunMergeSimulator` use local fixture-safe Git inspection and `git merge-tree` without fetch, push, provider merge/rebase, or working-branch mutation.
- Gated runner boundary: `FixtureLocalCommandExecutor` uses `spawn` only behind explicit local runner/workspace/harness gates; default command executor is blocked.
- Safe migration/admin scripts: `scripts/db/migrate.mjs` and `packages/db/src/postgres.ts` require explicit database configuration and are not invoked by default runtime, tests, build, or Staging RC readiness.
- Mock local agent protocol: `MockLocalAgentTransport` is in-memory and does not spawn processes or use network transport.
- Mock fixture daemon: `FixtureLocalAgentDaemon` simulates connected/disconnected fixture agents, mock channels, compatibility, consent, and stream events without network, process spawn, vendor CLI execution, or credential reads.
- Safe redaction test strings: credential cache and provider key strings appear in tests/dashboard data to prove redaction and denial.
- Suspicious real integration code: none found.
- Actual external calls in default runtime/tests: none found. `scripts/lint.mjs` contains a regex that detects direct external HTTP calls. `tests/api-health.test.ts` uses `http.request` only against local test servers. Optional GitHub and remote LLM integration tests are skipped unless all explicit integration env gates are set.

Conclusion: the repository complies with the mock-only MVP rule.

## 6. Validation Commands

| Command | Result | Output Summary |
|---|---|---|
| `pnpm install` | not run | Dependency metadata was unchanged, so install was not required for this milestone update. |
| `pnpm lint` | pass | `node scripts/lint.mjs`; output: `lint passed`. |
| `pnpm typecheck` | pass | `tsc --noEmit -p tsconfig.typecheck.json`; no errors. |
| `pnpm test` | pass | `node scripts/run-tests.mjs`; 285 total, 278 passed, 7 optional tests skipped (Postgres contract, real GitHub integration, real GitHub webhook integration, real remote LLM integration, live GitHub App integration-test skeleton, live LLM integration-test skeleton, and live Vault KV v2 skeleton), 0 failed. |
| `pnpm build` | pass | `node scripts/build.mjs`; output: `build passed`. |
| `git diff --check` | pass | No whitespace errors. |

## 7. Test Coverage Audit

| Area | Covered | Evidence | Recommendation |
|---|---|---|---|
| API run endpoint | yes | `tests/api-health.test.ts` covers `/tasks/:id/run` success and `409` active-run conflict | Keep adding API tests as endpoints move to async behavior. |
| Mock workflow success | yes | `tests/mock-workflow-vertical-slice.test.ts` verifies completed task, TaskRun, changed files, PR, lease, queue entry | None. |
| Policy denial | yes | `mock workflow blocks policy-denied tasks before provider behavior`; `tests/policy-as-code-v0.test.ts` covers static policy decisions and service-boundary denials | None. |
| Usage ledger attribution | yes | `usage ledger attributes model, skill, harness, task, and run` | Add aggregate cost tests later. |
| Skill / Harness / Instruction separation | yes | `Skill, Harness, and Instruction records stay separate`; `tests/registry-v0.test.ts` | None for v0. |
| Task state transitions | yes | `tests/task-state-machine.test.ts` | Add TaskRun transition tests after introducing TaskRun transition enforcement. |
| Repeated task run behavior | yes | Workflow tests for completed/failed rerun and active-run rejection; API `409` test | None. |
| Dashboard data assumptions | yes | `tests/dashboard-data.test.ts` asserts deterministic demo fallback; `tests/dashboard-read-model-v0.test.ts` asserts `/dashboard/*`, provider mapping, fallback, no-secret exposure, and read-only behavior | Keep demo fallback out of production API mode. |

## 8. Current Blockers

### Critical Blockers

None found.

### Important Follow-Ups

- TaskRun transitions are typed but not enforced by an explicit state transition function.
- Persistence remains in-memory; Prisma schema is a draft and migrations are placeholders.
- Phase 3 registries now have repository boundaries and local file-backed persistence, but production database persistence remains future work.
- Approval/eval status gates are implemented, but full approval workflow and eval suite execution remain future work.
- Signed artifacts, full dependency solving, real mutation auth/RBAC, and production policy-as-code enforcement remain future work.
- `packages/adapters` remains a compatibility aggregate while split packages re-export behavior; ownership can be tightened before real integrations.
- Local Agent Runner v1 stores runner records, workspaces, and command results in memory; durable Postgres runner repositories are future work.
- Phase 2 still lacks rebase-needed detection, semantic/symbol/test impact signals, resolver handoff, and human escalation workflow.

### Nice-To-Have Improvements

- Add OpenAPI or route documentation for conflict endpoints.
- Add dashboard API contract/OpenAPI docs.
- Add branch lease expiration behavior tests.
- Add explicit audit events for merge queue mark-merged/cancel.
- Add stable API response DTOs instead of returning in-memory domain objects directly.

## 9. Recommendation

Recommendation: safe to merge the current MVP vertical slice, Conflict Manager v1 baseline, Phase 3 Packaging & Versioning v3, Phase 4 Governance v1, Persistent DB v1, Persistent DB Production Operations v1, Real Git Adapter v2, GitHub App Controlled Implementation v1, GitHub App integration-test profile v1, LLM Gateway v2, LLM Gateway integration-test profile v1, Vault Integration-Test Profile v1, MCP Gateway v0, Production Deployment Readiness Planning v0, Observability / Audit Retention v0, GitHub App / Production Webhook Hardening Planning v0, Secret Backend Migration Planning v0, Production Secret Backend Implementation Option Decision v0, Vault-backed Secret Backend v1, Production Auth/RBAC v1 Planning, Policy Bundle / OPA-Cedar Planning v0, Staging Deployment Profile v0, Staging Deployment Dry-run Profile v0, Staging Release Candidate Checklist v0, Staging Deployment Execution Plan v0, Staging Human Signoff Pack v0, Staging CI/CD Pipeline Planning v0, Staging RC Evidence Pack v0, SecretRef-backed Provider Credentials v1, Local Agent Runner v1, Policy-as-code Skeleton v0, Enterprise LLM Provider Abstraction v0, Secrets and Sandbox v0, Local Agent Protocol v1, and Dashboard API-backed Read Model v0.

The repository has moved beyond the v0 baseline. Conflict Manager v1 is implemented with mock/local-only merge simulation, and it should not be interpreted as full Phase 2 completion.

Persistent DB v1, Persistent DB Production Operations v1, Real Git Adapter v2, GitHub App Controlled Implementation v1, GitHub App integration-test profile v1, LLM Gateway v2, LLM Gateway integration-test profile v1, Vault Integration-Test Profile v1, MCP Gateway v0, Production Deployment Readiness Planning v0, Observability / Audit Retention v0, GitHub App / Production Webhook Hardening Planning v0, Secret Backend Migration Planning v0, Production Secret Backend Implementation Option Decision v0, Vault-backed Secret Backend v1, Production Auth/RBAC v1 Planning, Policy Bundle / OPA-Cedar Planning v0, Staging Deployment Profile v0, Staging Deployment Dry-run Profile v0, Staging Release Candidate Checklist v0, Staging Deployment Execution Plan v0, Staging Human Signoff Pack v0, Staging CI/CD Pipeline Planning v0, Staging RC Evidence Pack v0, SecretRef-backed Provider Credentials v1, Local Agent Runner v1, Policy-as-code Skeleton v0, Enterprise LLM Provider Abstraction v0, Secrets and Sandbox Design v0, Local Agent Protocol v1, and Dashboard API-backed Read Model v0 are implemented behind explicit storage/provider/runner/policy/security/read-model boundaries. Production deployment, actual staging deployment, active CI/CD workflow execution, release creation workflow, live GitHub App installation-token exchange, live LLM integration-test execution, live Vault integration-test execution, production webhook enablement, production Vault rollout/cloud/custom secret backend implementation, production secret rotation, production credential issuance, production auth implementation, production sessions, tenant enforcement, production policy bundle runtime/signing/rollout, production DB pooling/backup/restore/retention, Local Agent production daemon/transport work, real MCP transport, vendor CLI execution, real human approval storage, and production sandboxing remain future work.

Exact next task:

```text
Collect real human signoffs using Staging Human Signoff Pack v0, then run Staging Deployment Approval Audit v0 before any staging deployment execution.
```

## Final Summary

Current phase status:

- Phase 1: `complete_for_current_milestone`
- Phase 2: `complete_for_current_milestone`
- Phase 3: `v3_implemented`
- Phase 4: `v1_implemented`
- Phase 5: `preparation_started`
- Real integration foundation: `v0_scaffolded`
- Persistent DB: `v1_implemented`
- Persistent DB Production Operations: `v1_implemented`
- Real Git Adapter: `v2_implemented`
- GitHub App Controlled Implementation: `v1_implemented`
- GitHub App integration-test profile: `v1_implemented`
- LLM Gateway: `v2_implemented`
- LLM Gateway integration-test profile: `v1_implemented`
- Local Agent Runner: `v1_implemented`
- Policy-as-code: `v0_implemented`
- Enterprise Provider Abstraction: `v0_implemented`
- Secrets and Sandbox: `v0_implemented`
- SecretRef-backed Provider Credentials: `v1_implemented`
- Local Agent Protocol: `v1_implemented`
- Dashboard API-backed Read Model: `v0_implemented`
- MCP Gateway: `v0_implemented`
- Production Deployment Readiness Planning: `v0_implemented`
- Observability / Audit Retention: `v0_implemented`
- GitHub App / Production Webhook Hardening Planning: `v0_implemented`
- Secret Backend Migration Planning: `v0_implemented`
- Production Secret Backend Implementation Option Decision: `v0_implemented`
- Vault-backed Secret Backend: `v1_implemented`
- Vault Integration-Test Profile: `v1_implemented`
- Production Auth/RBAC v1 Planning: `v1_implemented`
- RequestContext Propagation: `v1_implemented`
- API AuthContext Middleware Skeleton: `v1_implemented`
- Service Account Actor Boundary: `v1_implemented`
- Registry/Governance RequestContext Migration: `v1_implemented`
- Policy Bundle / OPA-Cedar Planning: `v0_implemented`
- Staging Deployment Profile: `v0_implemented`
- Staging Deployment Dry-run Profile: `v0_implemented`
- Staging Release Candidate Checklist: `v0_implemented`
- Staging Deployment Execution Plan: `v0_implemented`
- Staging Human Signoff Pack: `v0_implemented_pending_real_signoff`
- Staging CI/CD Pipeline Planning: `v0_implemented`

Validation:

- install: not run; dependency metadata was unchanged
- lint: pass
- typecheck: pass
- test: pass after Staging Deployment Execution Plan v0 validation; 296 total, 288 passed, 8 skipped. Optional Postgres contract, real GitHub integration, real GitHub webhook integration, real remote LLM integration, live GitHub App integration-test skeleton, live LLM integration-test skeleton, live Vault integration-test profile skeleton, and live Vault KV v2 skeleton skipped when env vars/live provider execution are not configured.
- build: pass
- diff check: pass

Merge recommendation:

Safe to merge the current MVP vertical slice, Conflict Manager v1 baseline, Phase 3 Packaging & Versioning v3, Phase 4 Governance v1, Persistent DB v1, Persistent DB Production Operations v1, Real Git Adapter v2, GitHub App Controlled Implementation v1, GitHub App integration-test profile v1, LLM Gateway v2, LLM Gateway integration-test profile v1, Vault Integration-Test Profile v1, MCP Gateway v0, Production Deployment Readiness Planning v0, Observability / Audit Retention v0, GitHub App / Production Webhook Hardening Planning v0, Secret Backend Migration Planning v0, Production Secret Backend Implementation Option Decision v0, Vault-backed Secret Backend v1, Production Auth/RBAC v1 Planning, Policy Bundle / OPA-Cedar Planning v0, Staging Deployment Profile v0, Staging Deployment Dry-run Profile v0, Staging Release Candidate Checklist v0, Staging Deployment Execution Plan v0, Staging CI/CD Pipeline Planning v0, Staging RC Evidence Pack v0, SecretRef-backed Provider Credentials v1, Local Agent Runner v1, Policy-as-code Skeleton v0, Enterprise LLM Provider Abstraction v0, Secrets and Sandbox v0, Local Agent Protocol v1, and Dashboard API-backed Read Model v0 once validation remains green. No critical blockers were found for this controlled implementation milestone; production remains blocked.

Next recommended Codex task:

Staging Go/No-Go Audit v0, or collect real human signoffs before any staging deployment execution.
