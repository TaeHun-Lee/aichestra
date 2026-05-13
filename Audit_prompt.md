아래 기준은 **지금까지 사용자가 받은 완료 보고 기준**입니다. 실제 저장소 diff를 제가 직접 본 것은 아니므로, 최종 판정은 Audit 프롬프트로 다시 검수하는 것이 좋습니다.

# 1. 현재까지 완료된 지점

현재 Aichestra는 **mock-first / gated real-integration control plane**으로는 상당히 깊게 구현된 상태입니다.

```text
Phase 1: complete_for_current_milestone
Phase 2: complete_for_current_milestone
Phase 3: v3_implemented
Phase 4: v1_implemented
Phase 5: preparation_started

Persistent DB: v1_implemented
Real Git Adapter: v2_implemented
LLM Gateway: v2_implemented
MCP Gateway: v0_implemented
Dashboard API-backed Read Model: v0_implemented
Local Agent Runner: v1_implemented
Local Agent Protocol: v1_implemented
Policy-as-code: v0_implemented
Enterprise Provider Abstraction: v0_implemented
Secrets/Sandbox: v0_implemented
SecretRef-backed Provider Credentials: v1_implemented
Production Auth/RBAC Planning: v0_implemented
Production Deployment Readiness Planning: v0_implemented
Observability / Audit Retention: v0_implemented
```

현재까지 가장 최근 검증 기준은 다음과 같습니다.

```text
pnpm install: pass
pnpm lint: pass
pnpm typecheck: pass
pnpm test: pass, 215 total / 211 passed / 4 skipped
pnpm build: pass
git diff --check: pass
```

즉, 지금은 **내부 기술 프로토타입 / gated integration MVP**로는 꽤 성숙했습니다. 다만 production-ready는 아닙니다.

아직 남은 큰 production gap은 다음입니다.

```text
실제 production auth/SSO/SCIM 없음
실제 Vault/cloud secret manager 없음
정책 bundle/OPA/Rego/Cedar 없음
production DB 운영/backup/restore/connection pooling 미구현
실제 observability backend/export/alerting 없음
GitHub App installation flow 없음
production webhook hardening 일부 계획 전/미완료
real MCP transport 없음
Local Agent production daemon 없음
real vendor CLI 실행 없음
BYOK/OAuth/WIF/IAM 없음
tenant isolation/rate limit/quota 미구현
```

# 2. Audit 추천 방식

감사는 한 번에 전체를 보는 것보다 아래처럼 나눠서 하는 것을 추천합니다.

```text
Audit 0: 전체 설계 정합성 / 최종 종합 Audit
Audit 1: Phase 1~2 Core Orchestration + Conflict Manager
Audit 2: Phase 3 Registry / Instruction / Governance
Audit 3: Phase 4 Auto-improvement / Governance
Audit 4: Integration Foundation
Audit 5: Production Readiness / Phase 5 준비도
```

아래 프롬프트들은 **Codex 또는 Claude에 그대로 넣을 수 있는 Audit-only 프롬프트**입니다.

---

# Audit 0. 전체 설계 정합성 Audit

```text
You are auditing the current Aichestra repository.

This is an audit-only task.

Do not implement features.
Do not refactor code.
Do not modify application code.
Do not add integrations.
Do not call real external APIs.
Do not run destructive commands.
Only inspect files, run safe validation commands, and write an audit report.

Before auditing, inspect:
- AGENTS.md
- README.md
- docs/README.md, if present
- all docs under docs/** recursively
- design_docs/**, if present
- package.json
- pnpm-workspace.yaml
- apps/**
- packages/**
- tests/**
- infra/migrations/**

Do not assume older flat docs paths still exist.
Find canonical documents by title/content if docs were moved.

Create or update:

docs/audits/current-state-design-conformance-audit.md

If you cannot write files, output the full report.

## 1. Executive summary

Assess whether Aichestra has progressed according to the original design.

Use one rating:
- pass
- pass_with_minor_followups
- pass_with_important_followups
- blocked
- architecture_refactor_required

Include:
- confidence: high / medium / low
- whether validation is green
- whether mock-first / gated integration safety is intact
- whether production-readiness is overstated anywhere
- whether it is safe to continue to production hardening
- whether it is safe to continue to more real integrations

## 2. Current status matrix

Evaluate:

- Phase 1
- Phase 2
- Phase 3
- Phase 4
- Phase 5
- Persistent DB
- Real Git Adapter
- LLM Gateway
- MCP Gateway
- Dashboard API-backed Read Model
- Local Agent Runner
- Local Agent Protocol
- Policy-as-code
- Enterprise Provider Abstraction
- Secrets/Sandbox
- SecretRef-backed Provider Credentials
- Production Auth/RBAC Planning
- Production Deployment Readiness Planning
- Observability / Audit Retention

Use statuses:
- not_started
- planned_only
- scaffolded
- v0_implemented
- v1_implemented
- v2_implemented
- v3_implemented
- complete_for_current_milestone
- preparation_started
- production_ready

For each item include:
- status
- evidence from files/types/tests/docs
- missing capabilities
- whether missing capabilities block current milestone
- whether missing capabilities block production readiness

## 3. Design conformance

Check whether the implementation still follows these design principles:

- central control plane
- mock-first defaults
- explicit integration gates
- no real provider calls in default runtime/tests
- Auth/RBAC feeds PolicySubject
- PolicyEngine remains deny-by-default
- SecretRef/CredentialManager boundary is respected
- Git/LLM/MCP/Runner operations are behind interfaces
- Dashboard consumes read models, not workflow/business logic
- Auto-improvement remains proposal/draft/governance based
- Local CLI provider requires Local Agent boundary
- credential cache reads are forbidden
- audit/redaction applies before storage/display

For each:
- pass / warning / fail
- evidence
- recommended fix

## 4. Safe integration compliance

Run or inspect:

rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|gemini|codex|gitlab|bitbucket|bedrock|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|AICHESTRA_GITHUB_WEBHOOK_SECRET|GOOGLE_APPLICATION_CREDENTIALS|AICHESTRA_LLM_API_KEY|LLM_API_KEY|SESSION_SECRET|JWT_SECRET|PASSWORD|SAML|OIDC|SCIM|~/.codex|auth.json|~/.claude|credential cache|git fetch|git push|git merge|git rebase|kubectl|vault|temporal|mcp|child_process|exec\\(|spawn\\(|eval\\(" .

Classify findings as:
- safe documentation references
- safe mock references
- safe type/interface references
- safe config placeholders
- gated GitHub/LLM/MCP boundaries
- dashboard API read only
- readiness planning only
- suspicious integration code
- actual external calls or unsafe credential access in default runtime/tests

Default runtime/tests must not:
- call real LLM providers
- call real MCP servers
- call GitHub unless explicit integration env gates are configured
- execute vendor CLI
- read credential cache
- expose secrets
- auto-merge
- force-push
- delete branches
- run production deployment

## 5. Validation

Run:

pnpm install, if dependency metadata changed
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check

Report:
- command
- pass/fail/not_run
- summary
- number of tests
- skipped tests
- warnings
- likely cause of failures if any

Do not run remote integration tests unless explicit env vars are configured.

## 6. Final recommendation

Conclude with one of:

- Safe to continue production hardening.
- Safe to continue gated real integrations, with follow-ups.
- Fix blockers before continuing.
- Architecture refactor required.

End with:

Final Summary

Design conformance:
...

Current phase status:
- Phase 1:
- Phase 2:
- Phase 3:
- Phase 4:
- Phase 5:
- Persistent DB:
- Real Git Adapter:
- LLM Gateway:
- MCP Gateway:
- Dashboard:
- Runner:
- Local Agent Protocol:
- Policy-as-code:
- SecretRef:
- Auth/RBAC:
- Observability:

Validation:
- install:
- lint:
- typecheck:
- test:
- build:

Safe integration compliance:
...

Production readiness:
...

Critical blockers:
...

Important follow-ups:
...

Recommended next task:
...
```

---

# Audit 1. Phase 1~2 Core Orchestration / Conflict Manager Audit

```text
You are auditing Aichestra Phase 1 and Phase 2 only.

This is an audit-only task.
Do not modify code.
Do not implement features.

Inspect:
- apps/api/**
- apps/web/**
- packages/core/**
- packages/git-adapter/**
- packages/db/**
- packages/runner/**
- tests/*task*
- tests/*workflow*
- tests/*conflict*
- tests/*git*
- docs/features/real-git-adapter/**
- docs/audits/**
- docs/reference/**

Create or update:

docs/audits/phase-1-2-core-conflict-audit.md

## 1. Phase 1 audit

Verify:
- Task domain model
- TaskRun domain model
- task creation API
- task run trigger API
- worker/service execution path
- mock policy check
- model/skill/harness/instruction selection
- branch creation
- mock agent execution
- diff summary
- mock test result
- PR creation
- usage ledger entry
- taskRunId/taskId attribution
- dashboard/API visibility
- tests

For each:
- implemented / partial / missing
- evidence
- concerns

## 2. Phase 2 audit

Verify:
- BranchLease
- ConflictRisk
- MergeQueueEntry
- MergeSimulationResult
- file overlap scoring
- LocalGitDryRunMergeSimulator
- clean/text_conflict/failed/unavailable statuses
- merge queue recommendation
- changed files linkage
- PR/branch sync read models
- no automatic merge
- no rebase/force-push/delete
- tests

For each:
- implemented / partial / missing
- evidence
- concerns

## 3. Real Git Adapter v1/v2 audit

Verify:
- MockGitProvider default
- LocalGitProvider local-only
- GitHubGitProvider gated
- GitHubClient boundary
- branch creation gates
- PR creation gates
- webhook gates
- webhook signature verification boundary
- replay/dedupe/dead-letter planning or implementation status
- PR/branch sync read model
- policy integration
- SecretRef integration
- audit/redaction
- no secret exposure
- default tests do not call GitHub

## 4. Safety audit

Check:
- no auto-merge
- no force-push
- no branch deletion
- no remote call without explicit env gates
- token not returned in health/API/dashboard/audit
- branch prefix/allowlist enforced
- policy denial wins

## 5. Validation

Run:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- git diff --check

## 6. Final status

Return:

Phase 1 status:
Phase 2 status:
Real Git Adapter status:
Critical blockers:
Important follow-ups:
Recommended next task:
```

---

# Audit 2. Phase 3 Registry / Instruction / Credential Audit

```text
You are auditing Aichestra Phase 3 and credential-related foundations.

This is an audit-only task.
Do not modify code.

Inspect:
- packages/registry/**
- packages/security/**
- packages/llm-gateway/** enterprise provider and credential files
- packages/auth/**
- packages/policy/**
- apps/api/src/main.ts
- apps/api/src/dashboard-read-model.ts
- docs/foundations/**
- docs/features/llm-gateway/**
- docs/reference/**
- tests/*registry*
- tests/*secret*
- tests/*credential*
- tests/*enterprise*

Create or update:

docs/audits/phase-3-registry-credential-audit.md

## 1. Registry audit

Verify:
- Skill Registry
- Harness Registry
- Instruction Registry
- RegistryResolver
- exact version pinning
- semver v0
- package manifest
- import/export
- package diff
- registry audit
- registry history/revisions
- rollback
- approval queue
- local eval result attachment
- mutation auth/RBAC mock enforcement
- dashboard/API visibility
- tests

## 2. Instruction layer audit

Verify:
- Skill, Harness, InstructionArtifact remain separate
- instruction checksum verification
- checksum mismatch blocks selection
- task run records selected refs
- instruction set hash where applicable
- no prompt/instruction bypasses policy/harness safety

## 3. SecretRef-backed credential audit

Verify:
- SecretRef model does not store raw secret
- EnvSecretProvider disabled by default
- allowlist enforced
- Auth/RBAC checked before env read
- Policy checked before env read
- CredentialManager / TokenResolver boundary
- GitHub token SecretRef
- GitHub webhook secret SecretRef
- LLM API key SecretRef
- legacy env fallback documented and gated
- no secret in API/health/dashboard/audit
- credential cache paths rejected
- redaction tests

## 4. Enterprise provider abstraction audit

Verify:
- ProviderKind
- ProviderAuth
- ProviderCatalog
- CredentialManager/TokenResolver skeletons
- ProviderAdapter skeletons
- local_cli requires external_cli_session never_read_tokens
- Local Agent boundary
- parser/redaction
- credential cache read denial
- provider audit
- policy hooks

## 5. Validation

Run:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- git diff --check

## 6. Final status

Return:

Phase 3 status:
SecretRef status:
Enterprise Provider status:
Critical blockers:
Important follow-ups:
Recommended next task:
```

---

# Audit 3. Phase 4 Auto-improvement / Governance Audit

```text
You are auditing Aichestra Phase 4.

This is an audit-only task.
Do not modify code.

Inspect:
- packages/improvement/**
- packages/registry/**
- packages/policy/**
- packages/auth/**
- apps/api/src/main.ts
- apps/web/**
- docs/features or docs/foundations related to phase 4
- docs/audits/phase-progress-audit.md
- tests/*improvement*
- tests/*governance*
- tests/*apply*
- tests/*phase-4*

Create or update:

docs/audits/phase-4-auto-improvement-governance-audit.md

## 1. Phase 4 preparation audit

Verify:
- FailureSignal
- FailureCluster
- ImprovementCandidate
- ImprovementProposal
- EvalRequirement
- CanaryRolloutPlan
- AutoImprovementSafetyPolicy
- repositories/services
- APIs
- dashboard visibility
- tests

## 2. Auto-improvement v0 audit

Verify:
- AutoImprovementEngine
- MockAutoImprovementEngine
- deterministic mapping
- draft proposal creation
- DraftRegistryChange
- ProposalReadiness
- no active registry mutation
- no auto-apply
- no real LLM calls
- no eval execution
- no canary execution

## 3. Governance v1 audit

Verify:
- proposal review queue
- governance decisions
- eval run attachment
- canary readiness
- apply gate
- apply remains unimplemented/forbidden
- audit events
- dashboard/API visibility
- tests

## 4. Safety audit

Check:
- draft changes cannot mutate active Skill/Harness/Instruction
- readiness blocks auto-apply
- human approval/eval/canary requirements enforced
- policy denial wins
- no real provider calls
- no secret exposure

## 5. Validation

Run:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- git diff --check

## 6. Final status

Return:

Phase 4 status:
Auto-improvement status:
Governance status:
Critical blockers:
Important follow-ups:
Recommended next task:
```

---

# Audit 4. Integration Foundations Audit

```text
You are auditing Aichestra integration foundations.

This is an audit-only task.
Do not modify code.

Scope:
- Persistent DB
- Real Git Adapter
- LLM Gateway
- MCP Gateway
- Local Agent Runner
- Local Agent Protocol
- Policy-as-code
- Auth/RBAC
- Secrets/Sandbox
- Observability/Audit Retention
- Dashboard API-backed Read Model

Inspect:
- packages/db/**
- packages/git-adapter/**
- packages/llm-gateway/**
- packages/mcp-gateway/**
- packages/runner/**
- packages/policy/**
- packages/auth/**
- packages/security/**
- packages/observability/**
- packages/deployment-readiness/**
- apps/api/**
- apps/web/**
- tests/**
- docs/**

Create or update:

docs/audits/integration-foundations-audit.md

## 1. Persistent DB audit

Verify:
- storage provider abstraction
- repository factory
- Postgres opt-in
- migration runner
- schema skeleton
- repository contract tests
- default tests do not require DB
- optional Postgres tests skip correctly

## 2. Real Git Adapter audit

Verify:
- v2 status
- GitHub gated branch/PR
- webhook receiver/verifier
- PR/branch sync read model
- no destructive ops
- policy/auth/SecretRef/audit integration

## 3. LLM Gateway audit

Verify:
- v2 status
- multi-provider routing
- fallback safety
- model catalog
- provider skeletons
- OpenAI-compatible gated real path
- SecretRef/Auth/Policy/Budget/Usage/Audit integration
- no real calls by default

## 4. MCP Gateway audit

Verify:
- v0 status
- mock-only gateway
- server/tool catalog
- risk levels
- Auth/Policy/Secret/Sandbox integration
- no auto tool execution
- no real MCP transport
- no output/input secret leakage

## 5. Runner and Local Agent audit

Verify:
- Local Agent Runner v1
- command execution disabled by default
- fixture command boundary
- workspace manager
- harness policy
- no shell/remote git/secrets by default
- Local Agent Protocol v1
- fixture daemon
- mock signed channel
- consent/streaming/capability/compatibility
- no real vendor CLI

## 6. Auth/Policy/Secrets audit

Verify:
- Auth/RBAC v0
- Policy-as-code v0
- Secrets/Sandbox v0
- SecretRef v1
- deny-by-default
- no production auth claims
- no raw secret exposure

## 7. Observability audit

Verify:
- common audit envelope
- retention/redaction classes
- audit source normalization
- metrics/trace skeleton
- observability API/dashboard
- no external exporter
- no retention deletion job

## 8. Dashboard audit

Verify:
- API-backed read model
- demo fallback explicit
- no workflow execution
- no provider calls
- no secrets
- sections cover Git/LLM/MCP/Auth/Policy/Security/Observability/Deployment

## 9. Validation

Run:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- git diff --check

## 10. Final status

Return component statuses and blockers.
```

---

# Audit 5. Phase 5 / Production Readiness Audit

```text
You are auditing Aichestra production readiness.

This is an audit-only task.
Do not modify code.
Do not implement production features.

Inspect:
- docs/roadmaps/production-deployment-readiness/**
- docs/reference/runtime-component-inventory.md
- docs/reference/environment-gate-matrix.md
- docs/foundations/**
- docs/features/**
- docs/audits/**
- packages/deployment-readiness/**
- packages/observability/**
- packages/auth/**
- packages/security/**
- apps/api/**
- apps/web/**
- README.md
- AGENTS.md

Create or update:

docs/audits/phase-5-production-readiness-audit.md

## 1. Production readiness status

Assess:
- internal prototype readiness
- internal MVP readiness
- gated integration readiness
- staging readiness
- production readiness

Use:
- ready
- mostly_ready
- not_ready

## 2. Production blockers

Evaluate blockers:

Identity/Auth:
- real OIDC/SAML/SCIM
- production sessions
- service accounts
- tenant/team scoping
- mock actor removal

Secrets:
- real secret backend
- SecretRef migration
- rotation
- leases
- no env fallback in production

Database:
- production Postgres
- pooling
- migrations
- backup/restore
- index review
- retention

GitHub:
- GitHub App installation
- app private key handling
- installation token exchange
- webhook replay protection
- webhook dead-letter/retry
- production webhook endpoint
- no auto-merge

LLM:
- provider allowlist
- real provider policy
- budget
- usage ledger
- prompt/output retention
- redaction
- fallback safety

MCP:
- real MCP transport
- server allowlist
- tool permissions
- audit
- secret/network control

Runner/Local Agent:
- production sandbox
- command policy
- Local Agent daemon
- update/revocation
- consent UX
- no credential cache reads

Policy:
- static TypeScript policies vs OPA/Rego/Cedar
- policy bundle signing/versioning
- break-glass
- audit

Observability:
- external backend
- metrics
- tracing
- audit export
- alerting
- retention enforcement
- legal hold

Deployment:
- topology
- CI/CD
- release/rollback
- environment gates
- rate limit/quota
- tenant isolation

For each:
- status: missing / partial / implemented
- severity
- production impact
- recommended next task

## 3. Docs consistency

Check:
- README
- AGENTS
- docs/README
- roadmap docs
- feature docs
- readiness docs
- audit docs

Ensure:
- no production-ready overclaim
- phase statuses are current
- Node/Volta requirements consistent
- environment gates documented
- known limitations explicit

## 4. Validation

Run:
- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- git diff --check

## 5. Final recommendation

Conclude with one of:

- Safe for internal gated integration demo.
- Safe for staging planning, but not staging deployment.
- Not safe for staging; fix blockers first.
- Production deployment not ready.

Recommend next three tasks in order.

End with:

Phase 5 status:
Production readiness:
Critical blockers:
Important follow-ups:
Recommended next tasks:
1.
2.
3.
```

---

# 추천 실행 순서

감사는 아래 순서대로 진행하는 것이 가장 좋습니다.

```text
1. Audit 0: 전체 설계 정합성
2. Audit 4: Integration Foundations
3. Audit 5: Production Readiness
4. Audit 1~3: 필요 시 세부 Phase별 Audit
```

가장 먼저 전체 Audit을 돌리고, 그 결과에서 특정 영역이 의심되면 해당 세부 Audit을 추가로 돌리면 됩니다.
