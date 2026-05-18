# Aichestra Docs

이 디렉터리는 Aichestra의 모든 설계/구현/감사 문서를 보관합니다. 정리 원칙:

- **briefs/** — 변하지 않는 원본 브리프(부트스트랩, 기술 블루프린트, 코덱스 작업지시서). 변경 빈도 거의 0.
- **foundations/** — 도메인 모델, MVP 정의, 보안 모델, 상태 머신 등 시스템 전반의 시간 불변(time-invariant) 개념.
- **features/** — feature별로 v0/v1/plan/audit을 한 폴더에 묶음. 한 feature의 모든 히스토리를 한곳에서.
- **roadmaps/** — 통합 로드맵 / 단계 계획서.
- **audits/** — 시점이 중요한 감사 보고서. 파일명 앞에 `YYYY-MM-DD-` 접두사로 시계열화.
- **reference/** — 외부 참조 자료(폐쇄 엔터프라이즈 LLM 프로바이더 설계 등).
- **adr/** — Architecture Decision Records.

---

## briefs/

원본 디자인 브리프. 신호로 사용 — 변경 거의 없음.

- [AICHESTRA_BOOTSTRAP.md](briefs/AICHESTRA_BOOTSTRAP.md)
- [AICHESTRA_TECH_STACK_BLUEPRINT.md](briefs/AICHESTRA_TECH_STACK_BLUEPRINT.md) (+ `.pdf`)
- [AICHESTRA_CODEX_NEXT_STEPS.md](briefs/AICHESTRA_CODEX_NEXT_STEPS.md)
- [AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md](briefs/AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md)
- [AICHESTRA_CODEX_PHASE3_TO_PHASE4_WORK_ORDERS.md](briefs/AICHESTRA_CODEX_PHASE3_TO_PHASE4_WORK_ORDERS.md)

## foundations/

시스템 전반의 개념 모델 (timeless).

- [architecture.md](foundations/architecture.md)
- [mvp.md](foundations/mvp.md) · [mvp-scope.md](foundations/mvp-scope.md)
- [domain-model.md](foundations/domain-model.md)
- [task-state-machine.md](foundations/task-state-machine.md)
- [instruction-layer.md](foundations/instruction-layer.md)
- [security-model.md](foundations/security-model.md)
- [auth-rbac-readiness.md](foundations/auth-rbac-readiness.md)
- [auth-rbac/v0-plan.md](foundations/auth-rbac/v0-plan.md)
- [auth-rbac/v0.md](foundations/auth-rbac/v0.md)
- [auth-rbac/v1-plan.md](foundations/auth-rbac/v1-plan.md)
- [auth-rbac/request-context-propagation-v1-plan.md](foundations/auth-rbac/request-context-propagation-v1-plan.md)
- [auth-rbac/request-context-propagation-v1.md](foundations/auth-rbac/request-context-propagation-v1.md)
- [auth-rbac/api-authcontext-middleware-v1-plan.md](foundations/auth-rbac/api-authcontext-middleware-v1-plan.md)
- [auth-rbac/api-authcontext-middleware-v1.md](foundations/auth-rbac/api-authcontext-middleware-v1.md)
- [auth-rbac/service-account-actor-boundary-v1-plan.md](foundations/auth-rbac/service-account-actor-boundary-v1-plan.md)
- [auth-rbac/service-account-actor-boundary-v1.md](foundations/auth-rbac/service-account-actor-boundary-v1.md)
- [auth-rbac/registry-governance-request-context-migration-v1-plan.md](foundations/auth-rbac/registry-governance-request-context-migration-v1-plan.md)
- [auth-rbac/registry-governance-request-context-migration-v1.md](foundations/auth-rbac/registry-governance-request-context-migration-v1.md)
- [auth-rbac/tenant-repo-provider-scope-model-v1-plan.md](foundations/auth-rbac/tenant-repo-provider-scope-model-v1-plan.md)
- [auth-rbac/tenant-repo-provider-scope-model-v1.md](foundations/auth-rbac/tenant-repo-provider-scope-model-v1.md)
- [auth-rbac/tenant-scope-enforcement-v1-plan.md](foundations/auth-rbac/tenant-scope-enforcement-v1-plan.md)
- [auth-rbac/tenant-scope-enforcement-v1.md](foundations/auth-rbac/tenant-scope-enforcement-v1.md)
- [auth-rbac/production-auth-provider-skeleton-v1-plan.md](foundations/auth-rbac/production-auth-provider-skeleton-v1-plan.md)
- [auth-rbac/production-auth-provider-skeleton-v1.md](foundations/auth-rbac/production-auth-provider-skeleton-v1.md)
- [secretref-provider-credentials/v1.md](foundations/secretref-provider-credentials/v1.md) (+ plan; Auth/RBAC + Policy-backed credential checks)
- [vault-secret-backend/v1.md](foundations/vault-secret-backend/v1.md) (+ plan; gated non-default Vault SecretRef provider boundary)
- [observability-audit-retention/v0.md](foundations/observability-audit-retention/v0.md) (+ plan; common audit envelope, retention/redaction classes, metric/trace skeletons)
- [persistent-storage-schema-v0.md](foundations/persistent-storage-schema-v0.md)
- [repository-inventory.md](foundations/repository-inventory.md)

## features/

feature별 폴더. 각 폴더는 `v0.md`, `v0-plan.md`, ... 형식. 일부는 `audits/` 하위폴더로 feature 단위 감사 보고서를 가짐.

| Feature | 위치 | 보유 버전 |
|---|---|---|
| Conflict Manager | [features/conflict-manager/](features/conflict-manager/) | v0, v1 |
| Merge Queue Policy | [features/merge-queue-policy/](features/merge-queue-policy/) | v2 (+ plan) |
| Persistent DB | [features/persistent-db/](features/persistent-db/) | v1 (+ plan) |
| Real Git Adapter | [features/real-git-adapter/](features/real-git-adapter/) | v0, v1, v2, github-app-controlled-v1 (+ plans, audits/v0-readiness) |
| LLM Gateway | [features/llm-gateway/](features/llm-gateway/) | v0, v1, v2 (+ plans) |
| MCP Gateway | [features/mcp-gateway/](features/mcp-gateway/) | v0 (+ plan) |
| Local Agent Runner | [features/local-agent-runner/](features/local-agent-runner/) | v0, v1 (+ plans) |
| Agent Workspace Lifecycle | [features/agent-workspace-lifecycle/](features/agent-workspace-lifecycle/) | v2 (+ plan) |
| Multi-session Agent Run Coordination | [features/multi-session-agent-run-coordination/](features/multi-session-agent-run-coordination/) | v1 (+ plan) |
| Multi-user / Multi-session Branch Orchestrator | [features/multi-user-branch-orchestrator/](features/multi-user-branch-orchestrator/) | v2 (+ plan) |
| Cross-session File Lease / Edit Intent Graph | [features/cross-session-file-lease-edit-intent/](features/cross-session-file-lease-edit-intent/) | v1 (+ plan) |
| Local Agent Protocol | [features/local-agent-protocol/](features/local-agent-protocol/) | v0, v1 (+ plans) |
| Local CLI Provider Templates | [features/local-cli-provider-templates/](features/local-cli-provider-templates/) | v1 (+ plan) |
| Enterprise LLM Provider | [features/enterprise-llm-provider/](features/enterprise-llm-provider/) | v0 (+ plan) |
| Secrets / Sandbox | [features/secrets-sandbox/](features/secrets-sandbox/) | v0 (+ plan) |
| Policy-as-Code | [features/policy-as-code/](features/policy-as-code/) | v0 (+ plan) |
| Governance (Phase 4) | [features/governance/](features/governance/) | v1 (+ plan) |
| Auto-Improvement (Phase 4) | [features/auto-improvement/](features/auto-improvement/) | v0 (+ plan, preparation\*, v0-blocked) |
| Registry (Phase 3) | [features/registry/](features/registry/) | v0, v1-hardening, v2-operational-hardening, v3-packaging-versioning, + concept (skill/harness-design) |
| Dashboard | [features/dashboard/](features/dashboard/) | read-model-plan, v0-plan, v0 |

## roadmaps/

- [real-integration-roadmap.md](roadmaps/real-integration-roadmap.md) — Real Integration 항목별 v0~vN 추진 로드맵.
- [real-integration-foundation-v0-plan.md](roadmaps/real-integration-foundation-v0-plan.md) — Foundation v0 통합 계획.
- [production-deployment-readiness/](roadmaps/production-deployment-readiness/) — Production Deployment Readiness Planning v0: topology, checklist, DB/secret/auth/policy/observability/CI plans.
- [github-app-production-webhook-hardening/](roadmaps/github-app-production-webhook-hardening/) — GitHub App / Production Webhook Hardening Planning v0: permission matrix, webhook allowlist, replay protection, dead-letter, credentials, and production endpoint planning.

- [persistent-db-production-operations/](roadmaps/persistent-db-production-operations/) - Persistent DB Production Operations v1: DB operations runbook, migration readiness, index review, retention/audit growth, webhook persistence, backup/restore, and pooling planning.
- [secret-backend-migration/](roadmaps/secret-backend-migration/) - Secret Backend Migration Planning v0: backend options, SecretRef provider migration, credential kind migration, lease/rotation, env fallback deprecation, readiness APIs, health, and dashboard planning.
- [production-secret-backend-option-decision/](roadmaps/production-secret-backend-option-decision/) - Production Secret Backend Implementation Option Decision v0: decision criteria, backend evaluation, Vault-first recommendation, SecretRef provider mapping, v1 implementation scope, env migration plan, test strategy, risk register, readiness APIs, health, and dashboard planning. Vault-backed Secret Backend v1 now implements the selected gated `vault` provider boundary under foundations.
- [auth-rbac-production/](roadmaps/auth-rbac-production/) - Production Auth/RBAC v1 Planning, Implementation Plan v1, and Production Auth Provider Skeleton v1: IdP options, disabled future provider skeletons, provider selection, role/permission matrix, tenant/scope model, service accounts/system actors, session/token boundary, request context propagation, API AuthContext middleware skeleton, service-account actor boundary, registry/governance request-context migration, tenant/repo/provider scope model, mock actor deprecation, security/audit requirements, implementation phases, blockers/risks, readiness APIs, health, and dashboard planning.
- [policy-bundle-opa-cedar/](roadmaps/policy-bundle-opa-cedar/) - Policy Bundle / OPA-Cedar Planning v0: engine comparison, bundle schema, domain mapping, review workflow, tests, rollout/rollback, break-glass, readiness APIs, health, and dashboard planning.
- [policy-bundle-runtime-poc/](roadmaps/policy-bundle-runtime-poc/) - Policy Bundle Runtime PoC and Policy Runtime Shadow Evaluation Planning v1: StaticPolicyEngine source-of-truth planning, golden harness linkage, candidate runtime interface expectations, comparison rules, mismatch taxonomy, reporting, rollout/rollback, readiness APIs, health, and dashboard planning without a shadow evaluator or candidate runtime execution.
- [policy-bundle-runtime-poc/](roadmaps/policy-bundle-runtime-poc/) - Policy Bundle Runtime PoC Planning v0 plus Policy Runtime PoC Golden Test Harness v1 and Policy Runtime Shadow Evaluation Planning v1: runtime PoC goals, OPA/Rego/Cedar/signed JSON-YAML/custom option comparison, normalized policy input/output contract, PoC domain mapping, golden decision tests, offline StaticPolicyEngine golden harness, future shadow architecture, candidate runtime interface expectations, comparison rules, mismatch taxonomy, reporting, rollout/rollback, readiness APIs, health, and dashboard planning. `StaticPolicyEngine` remains the only runtime.
- [staging-deployment-profile/](roadmaps/staging-deployment-profile/) - Staging Deployment Profile v0: non-production profile contract, staging gate matrix, integration-test policy, promotion/rollback criteria, risk register, readiness APIs, health, and dashboard planning.
- [staging-deployment-dry-run/](roadmaps/staging-deployment-dry-run/) - Staging Deployment Dry-run Profile v0: read-only readiness aggregation, blocker taxonomy, report format, staging dry-run APIs, health metadata, and dashboard planning.
- [staging-release-candidate/](roadmaps/staging-release-candidate/) - Staging Release Candidate Checklist v0 and Evidence Pack v0: read-only RC criteria, validation gates, optional skipped integration policy, signoff/release-note/rollback models, evidence pack plan, release-note draft, rollback evidence, signoff readiness, staging RC APIs, health metadata, and dashboard planning.
- [staging-deployment-execution/](roadmaps/staging-deployment-execution/) - Staging Deployment Execution Plan v0 and Staging Human Signoff Pack v0: read-only execution sequence, pre-deploy gates, optional live integration decisions, post-deployment smoke placeholders, rollback plan, go/no-go model, human signoff collection pack, evidence checklist, decision policy, scope separation policy, staging execution APIs, health metadata, and dashboard planning.
- [staging-ci-cd-pipeline/](roadmaps/staging-ci-cd-pipeline/) - Staging CI/CD Pipeline Planning v0: CI job matrix, optional integration-test gates, secret/env safety, artifacts/reports, staging promotion, cleanup/rollback, readiness APIs, health, and dashboard planning.
- [github-app-integration-test-profile/](roadmaps/github-app-integration-test-profile/) - GitHub App integration-test profile v1: skipped-by-default live-test profile, required gates, safety checks, cleanup policy, readiness APIs, health, and dashboard planning.
- [llm-gateway-integration-test-profile/](roadmaps/llm-gateway-integration-test-profile/) - LLM Gateway integration-test profile v1: skipped-by-default OpenAI-compatible live-test profile, model allowlist, budget cap, SecretRef preference, readiness APIs, health, and dashboard planning.
- [vault-integration-test-profile/](roadmaps/vault-integration-test-profile/) - Vault Integration-Test Profile v1: skipped-by-default Vault KV v2 test profile, required gates, test-only path and allowlist policy, safety checks, readiness APIs, health, and dashboard planning.
- [dashboard-readiness-tenant-scope/](roadmaps/dashboard-readiness-tenant-scope/) - Dashboard/Readiness Tenant Scope Planning and Implementation v1: dashboard/readiness inventories, role visibility matrices, fallback behavior, future filtering architecture, safe scope metadata, missing-scope warnings, redaction labels, read-only planning APIs, health metadata, and dashboard panel. Tenant Scope Enforcement v1 is documented under foundations as partial representative helper metadata. It does not implement production tenant enforcement.

## audits/

시점이 중요한 감사 보고서. 파일명 앞 `YYYY-MM-DD-` 접두사로 시계열화. 가장 최신부터 보면 됨.

- Evidence Pack v0 — [staging-rc-evidence-pack-v0.md](audits/staging-rc-evidence-pack-v0.md) — Staging RC validation, skipped-test, release-note, rollback, and signoff readiness evidence for a future audit; this is not a release, tag, deployment, or production-ready claim.
- 2026-05-14 — [staging-go-no-go-audit-v0.md](audits/2026-05-14-staging-go-no-go-audit-v0.md) — Staging Go/No-Go Audit v0; decision `go_with_warnings`, validation green, no critical blockers, staging not deployed, production not ready, and real human signoffs pending. Follow-up signoff collection docs live under [staging-deployment-execution/](roadmaps/staging-deployment-execution/).
- 2026-05-14 — [staging-release-candidate-audit-v0.md](audits/2026-05-14-staging-release-candidate-audit-v0.md) — Staging Release Candidate Audit v0; decision `staging_rc_not_ready` because signoffs, release notes, and validation evidence needed follow-up evidence.
- 2026-05-12 — [secretref-provider-credentials-v1-audit.claude.md](audits/2026-05-12-secretref-provider-credentials-v1-audit.claude.md) — SecretRef Credentials v1 보안 감사 (이슈 #SR1~#SR8)
- 2026-05-12 — [ai-behavior-audit.claude.md](audits/2026-05-12-ai-behavior-audit.claude.md) — AI 동작/지침 일관성 관점 감사 (신규 이슈 #N1~#N7)
- 2026-05-12 — [audit_claude_01.html](audits/2026-05-12-audit_claude_01.html) — 5개 영역 통합 감사 (이슈 24건)
- 2026-05-12 — [audit-remediation.codex.md](audits/2026-05-12-audit-remediation.codex.md) — 위 감사 항목 현재성 판단 및 적용 내역.
- 2026-05-12 — [design-conformance-audit.claude.md](audits/2026-05-12-design-conformance-audit.claude.md)
- 2026-05-12 — [final-audit-synthesis.md](audits/2026-05-12-final-audit-synthesis.md)
- 2026-05-12 — [final-completion-audit.codex.md](audits/2026-05-12-final-completion-audit.codex.md)
- 2026-05-12 — [validation-baseline-repair.md](audits/2026-05-12-validation-baseline-repair.md)
- 2026-05-11 — [final-completion-audit.claude.md](audits/2026-05-11-final-completion-audit.claude.md)
- 2026-05-11 — [phase-progress-audit.md](audits/2026-05-11-phase-progress-audit.md)
- 2026-05-11 — [phase-1-2-completion-audit.md](audits/2026-05-11-phase-1-2-completion-audit.md)
- 2026-05-11 — [phase-2-completion-gap.md](audits/2026-05-11-phase-2-completion-gap.md)
- 2026-05-11 — [phase-3-completion-gap.md](audits/2026-05-11-phase-3-completion-gap.md)
- 2026-05-11 — [vertical-slice-review.md](audits/2026-05-11-vertical-slice-review.md)
- 2026-05-11 — [bootstrap-gap-report.md](audits/2026-05-11-bootstrap-gap-report.md)

## reference/

- [dashboard-read-model-inventory.md](reference/dashboard-read-model-inventory.md)
- [audit-source-inventory.md](reference/audit-source-inventory.md)
- [request-context-propagation-inventory.md](reference/request-context-propagation-inventory.md)
- [api-authcontext-middleware-inventory.md](reference/api-authcontext-middleware-inventory.md)
- [service-account-actor-boundary-inventory.md](reference/service-account-actor-boundary-inventory.md)
- [registry-governance-request-context-inventory.md](reference/registry-governance-request-context-inventory.md)
- [tenant-repo-provider-scope-inventory.md](reference/tenant-repo-provider-scope-inventory.md)
- [tenant-scope-enforcement-inventory.md](reference/tenant-scope-enforcement-inventory.md)
- [dashboard-tenant-scope-inventory.md](reference/dashboard-tenant-scope-inventory.md)
- [readiness-tenant-scope-inventory.md](reference/readiness-tenant-scope-inventory.md)
- [dashboard-role-visibility-matrix.md](reference/dashboard-role-visibility-matrix.md)
- [readiness-role-visibility-matrix.md](reference/readiness-role-visibility-matrix.md)
- [github-app-permission-matrix.md](reference/github-app-permission-matrix.md)
- [github-webhook-event-allowlist.md](reference/github-webhook-event-allowlist.md)
- [production-rbac-permission-matrix.md](reference/production-rbac-permission-matrix.md)
- [staging-environment-gate-matrix.md](reference/staging-environment-gate-matrix.md)
- [runtime-component-inventory.md](reference/runtime-component-inventory.md)
- [environment-gate-matrix.md](reference/environment-gate-matrix.md)
- [Aichestra_Closed_Enterprise_LLM_Provider_Design](reference/) — `.docx`, `.pdf`, `_LLM_Readable/` (json/md/txt 변환본).

## adr/

Architecture Decision Records.

---

## Conventions

- **파일명 규칙**
  - feature 폴더 안: `v0.md`, `v0-plan.md`, `v1.md`, `v1-plan.md`. 특별한 파생 문서는 `<modifier>.md` (예: `preparation.md`, `v1-hardening.md`).
  - audits/: `YYYY-MM-DD-<slug>.md`. 작성자 표기는 `.claude.md` / `.codex.md` 접미.
  - briefs/: 원본 그대로 유지(대문자 + 밑줄). 변경 거의 없으므로 정규화하지 않음.
- **cross-reference**: 다른 문서 참조 시 풀 경로(`docs/features/.../v0.md`)로 작성. 코드 내 import는 영향 없음(이 reorg는 docs/만 변경).
- **새 feature 추가**: `docs/features/<slug>/` 폴더 생성, `v0-plan.md`로 시작, 구현 완료 후 `v0.md`로 마무리. feature 단위 audit은 `<slug>/audits/`로.
- **새 audit 작성**: `docs/audits/YYYY-MM-DD-<topic>.md` 형식. cross-cutting이면 audits/, 단일 feature면 features/<feature>/audits/.

- `foundations/auth-rbac/oidc-provider-skeleton-hardening-v1.md` — OIDC future-provider hardening status `v1_implemented`; disabled verifier, config/discovery/JWKS/claims/token-boundary readiness, safe readiness APIs, and no-token/no-session/no-secret guarantees.
- `foundations/auth-rbac/oidc-provider-skeleton-hardening-v1-plan.md` — pre-implementation plan for the OIDC skeleton hardening task.
