# Staging Release Candidate Audit v0

Date: 2026-05-14

This report uses `docs/audits/2026-05-14-staging-release-candidate-audit-v0.md` because `docs/README.md` defines audit documents with the `YYYY-MM-DD-<topic>.md` naming convention. The requested non-date path would not match the current docs organization.

## 1. Executive Summary

Rating: `not_ready`

The repository is validation-clean and the staging release-candidate readiness surfaces are implemented, but the current repository should not yet be treated as a staging release candidate. The Staging Release Candidate Checklist v0 read model defaults to `not_ready` because required signoffs are pending, release note sections are not filled, and validation evidence is not persisted into the checklist report by default.

Confidence: `high`

Validation is green: lint, typecheck, test, build, and `git diff --check` passed. Optional live integration tests are skipped for acceptable and documented reasons because the explicit Postgres, remote Git, GitHub App, webhook, remote LLM, MCP, external auth, and vendor CLI gates are absent or future-only. Production-only blockers, including missing production auth and a real secret backend, are documented as production blockers rather than staging RC blockers. The audit found no evidence that staging deployment has been executed, no release or Git tag has been created, and no production readiness is claimed.

No critical blockers were found. The decision is `staging_rc_not_ready`, not `staging_rc_blocked`, because the remaining gaps are RC completion requirements rather than unsafe runtime behavior.

## 2. Phase And Component Status

| Component | Status | Evidence | Gaps | Staging RC impact | Production impact |
| --- | --- | --- | --- | --- | --- |
| Phase 1 | `complete_for_current_milestone` | `README.md`, `docs/audits/2026-05-11-phase-progress-audit.md` | None for current milestone | Does not block | Does not prove production readiness |
| Phase 2 | `complete_for_current_milestone` | `README.md`, phase audit | None for current milestone | Does not block | Does not prove production readiness |
| Phase 3 | `v3_implemented` | `README.md`, phase audit, registry package docs/tests | Production registry distribution remains out of scope | Does not block | Blocks production package/release maturity |
| Phase 4 | `v1_implemented` | `README.md`, phase audit, `packages/improvement` boundaries | Auto-improvement remains draft/mock-only | Does not block | Production auto-apply remains blocked |
| Phase 5 | `preparation_started` | `README.md`, phase audit, deployment readiness roadmaps | Staging not deployed; production not ready | Does not block v0 audit | Production readiness blocked |
| Persistent DB | `v1_implemented` | `packages/db`, `infra/migrations/0001_initial_aichestra_schema.sql`, optional Postgres tests | Postgres is opt-in; migrations are not run automatically | Optional live DB validation can be skipped | Production DB operations need real validation |
| Persistent DB Production Operations | `v1_implemented` | `packages/deployment-readiness` production DB operations models and tests | Read-only planning; no backup/restore/live DB ops | Does not block staging RC when documented | Blocks production operations readiness |
| Real Git Adapter | `v2_implemented` | `packages/adapters/src/git`, gated GitHub client, tests | Remote merge/rebase/force-push/delete remain unsupported | Does not block; unsafe ops are critical blockers if enabled | Live provider validation still required |
| GitHub App Controlled Implementation | `v1_implemented` | `packages/adapters/src/git`, deployment-readiness GitHub App docs/tests | No JWT signing or token minting; gated mock token handles only | Does not block | Production GitHub App rollout blocked |
| GitHub App integration-test profile | `v1_implemented` | `docs/roadmaps/github-app-integration-test-profile/v1.md`, tests | Live tests skipped by default | Acceptable skipped optional profile | Blocks production live confidence |
| LLM Gateway | `v2_implemented` | `packages/llm-gateway`, provider gateway docs/tests | Remote completion gated; mock-only by default | Does not block | Production LLM validation still required |
| LLM Gateway integration-test profile | `v1_implemented` | `docs/roadmaps/llm-gateway-integration-test-profile/v1.md`, tests | Live tests skipped by default | Acceptable skipped optional profile | Blocks production live confidence |
| MCP Gateway | `v0_implemented` | `packages/mcp-gateway`, MCP docs/tests | Real MCP transport disabled/future | Does not block | Production MCP transport blocked |
| Dashboard API-backed Read Model | `v0_implemented` | `apps/api/src/dashboard-read-model.ts`, `apps/web/src/render.ts`, dashboard tests | UI is read-model oriented; no release execution | Does not block | Production UX and auth hardening remain |
| Local Agent Runner | `v1_implemented` | `packages/runner`, command executor safety tests | Local command execution disabled by default | Does not block | Production runner hardening remains |
| Local Agent Protocol | `v1_implemented` | `packages/llm-gateway` local-agent protocol models/tests | No daemon or real transport | Does not block | Production local-agent integration blocked |
| Policy-as-code | `v0_implemented` | `packages/policy`, default deny rules/tests | Static/mock-first; no OPA/Rego/Cedar runtime | Does not block | Production policy bundle runtime blocked |
| Policy Bundle / OPA-Cedar Planning | `v0_implemented` | `packages/deployment-readiness`, policy bundle roadmap/tests | Planning-only | Does not block | Production policy rollout blocked |
| Enterprise Provider Abstraction | `v0_implemented` | `packages/llm-gateway` enterprise provider models/tests | Skeleton-only; no vendor CLI/API calls | Does not block | Production provider integration blocked |
| Secrets/Sandbox | `v0_implemented` | `packages/security`, redaction/sandbox tests | Metadata-only; no real backend | Does not block when limitation accepted | Production secret backend blocked |
| Production Auth/RBAC Planning | `v1_implemented` | `packages/auth`, deployment-readiness auth planning models/tests | Mock/planning-only; no real IdP/session/JWT | Staging warning when documented | Production auth blocked |
| SecretRef-backed Provider Credentials | `v1_implemented` | `packages/security`, LLM/Git credential gate tests | Env fallback remains controlled and explicit | Does not block when documented | Production secret backend still required |
| Secret Backend Migration Planning | `v0_implemented` | `packages/deployment-readiness` secret backend models/tests | Planning-only; no Vault/cloud backend | Staging warning | Production blocker |
| Production Deployment Readiness Planning | `v0_implemented` | `docs/roadmaps/production-deployment-readiness/checklist-v0.md`, readiness APIs/tests | Read-only planning; production blocked | Does not block staging RC | Production deployment blocked |
| Observability / Audit Retention | `v0_implemented` | `packages/observability`, observability docs/tests | No external export/alerts; retention is read-model only | Does not block | Production observability blocked |
| GitHub App / Production Webhook Hardening Planning | `v0_implemented` | deployment-readiness GitHub App/webhook models/tests | Planning-only; webhooks disabled unless gated | Does not block | Production webhook rollout blocked |
| Staging Deployment Profile | `v0_implemented` | `docs/roadmaps/staging-deployment-profile/v0.md`, APIs/tests | No staging deployment execution | Does not block RC checklist v0 | Does not prove production readiness |
| Staging CI/CD Pipeline Planning | `v0_implemented` | `docs/roadmaps/staging-ci-cd-pipeline/v0.md`, APIs/tests | No active deployment workflow | Does not block | Production CI/CD still future |
| Staging Deployment Dry-run Profile | `v0_implemented` | `docs/roadmaps/staging-deployment-dry-run/v0.md`, APIs/tests | Dry-run may remain warning/not-ready based on production-only gaps | Does not block when warnings accepted | Production blockers remain |
| Staging Release Candidate Checklist | `v0_implemented` | `docs/roadmaps/staging-release-candidate/v0.md`, `packages/deployment-readiness`, APIs/tests | Pending signoffs and missing filled release notes | Blocks treating current repo as RC | Does not change production readiness |

## 3. Release Candidate Checklist Audit

| Area | Result | Evidence | Concerns |
| --- | --- | --- | --- |
| Checklist model | implemented | `StagingReleaseCandidateChecklist` in `packages/deployment-readiness/src/types.ts` | Default status is `not_ready` until evidence/signoffs/release notes are supplied |
| Gate model | implemented | `StagingReleaseCandidateGate` and gate category/status types | Validation gates can be `not_checked` without supplied evidence |
| Blocker model | implemented | `StagingReleaseCandidateBlocker` and blocking levels | Production-only blockers are correctly modeled as accepted limitations |
| Signoff model | implemented | `StagingReleaseCandidateSignoff` with six roles | All default signoffs are pending |
| Release note requirement model | implemented | `StagingReleaseNoteRequirement` with required sections | Template exists, but actual release notes are not filled |
| Rollback checklist model | implemented | `StagingRollbackChecklistItem` | Items are planned, which is acceptable for v0 |
| Report model | implemented | `StagingReleaseCandidateReport` and summary models | Report correctly remains `not_ready` by default |
| API endpoints | implemented | `/readiness/staging-rc/*` in `apps/api/src/main.ts` | Read-only only; no mutation found |
| Dashboard panel | implemented | `/dashboard/staging-rc`, `buildStagingReleaseCandidate`, web renderer | Displays read-model status; no secrets or raw logs found |
| Health metadata | implemented | `/health` includes staging RC metadata | Metadata keeps `productionReady` and `stagingDeployed` false |
| Deterministic tests | implemented | `tests/staging-release-candidate-v0.test.ts`, dashboard tests | Tests cover critical blockers and no-secret/no-env behavior |

## 4. Required Validation Gates

| Command | Result | Summary | Test count | Skipped count | Warnings | Staging RC impact |
| --- | --- | --- | --- | --- | --- | --- |
| `pnpm install` | not_run | Dependency metadata was unchanged, so install was not required | n/a | n/a | n/a | Does not block |
| `pnpm lint` | pass | Lint completed successfully | n/a | n/a | pnpm printed an engine warning even though direct Node checks show Node 24 selected | Does not block |
| `pnpm typecheck` | pass | TypeScript checks completed successfully | n/a | n/a | Same pnpm engine warning | Does not block |
| `pnpm test` | pass | Test suite passed | 275 total, 269 passed, 0 failed | 6 skipped | Skips were optional integration gates | Does not block |
| `pnpm build` | pass | Build completed successfully | n/a | n/a | Same pnpm engine warning | Does not block |
| `git diff --check` | pass | No whitespace errors reported | n/a | n/a | none | Does not block |

Tooling context: `node -v` reported Node 24.15.0 and `pnpm exec node -v` reported Node 24.14.0. The pnpm engine warning reported Node 20.11.1 during script startup; this should be investigated as a tooling environment warning, but it did not cause validation failure.

## 5. Optional Integration Test Audit

| Profile | Expected skip condition | Actual status | Acceptable for staging RC | Production impact |
| --- | --- | --- | --- | --- |
| Optional Postgres tests | `AICHESTRA_TEST_DATABASE_URL` absent | skipped | yes, documented optional contract | Blocks production DB confidence |
| Remote Git tests | Remote Git and provider gates absent | skipped | yes, remote Git remains gated | Blocks live provider confidence |
| GitHub App live tests | GitHub App integration gates absent | skipped | yes, profile is skipped by default | Blocks production GitHub App confidence |
| GitHub webhook tests | Webhook gates absent | skipped | yes, webhooks remain disabled by default | Blocks production webhook readiness |
| Remote LLM tests | Remote LLM gates absent | skipped | yes, mock-first default is required | Blocks production LLM confidence |
| Remote MCP tests | Real MCP transport is future/disabled | not run | yes, real MCP is out of scope | Blocks production MCP readiness |
| External auth tests | Production auth integration is future/planning-only | not run | yes, mock auth is accepted for v0 staging | Blocks production auth readiness |
| Vendor CLI tests | Vendor CLI execution is forbidden by this milestone | not run | yes, vendor CLI must remain disabled | Vendor CLI integration remains future/out of scope |

The skipped tests are acceptable for this audit because they are documented, not required by Staging Release Candidate Checklist v0, and the related features remain gated. They do not permit a production-ready claim.

## 6. Safe Integration Compliance Audit

The required broad scan matched 2802 lines across docs, code, and tests. Findings were narrowed by category:

| Category | Classification |
| --- | --- |
| Safe documentation references | pass; many matches are roadmap, audit, and environment-gate documentation |
| Safe mock/test references | pass; test fixtures intentionally include fake secret-like strings to verify redaction |
| Safe type/interface references | pass; provider, auth, MCP, LLM, Git, policy, and deployment readiness models are interfaces/read models |
| Safe config placeholders | pass; env var names are documented without values |
| Gated GitHub/LLM/MCP boundaries | pass; runtime `fetch` paths are limited to gated GitHub and OpenAI-compatible clients, not default paths |
| Readiness planning only | pass; deployment, auth, secret backend, policy bundle, webhook, and production operations surfaces are read-only |
| Dashboard API read-only | pass; dashboard endpoints aggregate read models only |
| Suspicious integration code | none found |
| Actual external calls or unsafe runtime/test behavior | none found in default runtime/tests |

Default runtime/tests did not create releases or tags, deploy resources, call external providers, expose secrets or env values, run live integration tests without gates, auto-merge, force-push, delete branches, execute vendor CLI, or read credential caches.

## 7. No-secret / No-env Exposure Audit

Result: `pass`

Inspected surfaces include health metadata, dashboard read models, readiness APIs, auth planning/readiness, SecretRef APIs, GitHub App readiness, LLM readiness, MCP readiness, observability DTOs, audit DTOs, and test fixtures.

No API key values, GitHub token values, GitHub App private key values, webhook secret values, database URL values, session/JWT secret values, raw env dumps, or credential cache contents were found in API/readiness/dashboard outputs. Secret-like fixture strings appear in tests only to assert sanitizer behavior. Redaction and sanitizer coverage exists in deployment readiness, security, observability, shared dashboard, GitHub App, LLM, MCP, and staging RC tests.

Any future raw secret or env value exposure must be treated as a critical blocker.

## 8. Documentation Consistency Audit

| Area | Result | Evidence | Stale-doc classification |
| --- | --- | --- | --- |
| Production-ready overclaim | pass | README, AGENTS, roadmaps, phase audits, readiness docs keep production readiness false or blocked | none |
| Staging deployed overclaim | pass | Staging docs and RC docs state no deployment execution | none |
| Known limitations | pass | Staging RC, dry-run, CI/CD, production readiness, auth, secret backend, policy, observability docs | none |
| Skipped tests documented | pass | Integration-test profile docs, RC checklist docs, CI/CD docs, tests | none |
| Node/Volta requirements | pass_with_warnings | README, package engines, Volta, `.nvmrc` consistently use Node 24 | nice_to_have: investigate pnpm engine warning |
| Environment gates | pass | `docs/reference/environment-gate-matrix.md`, roadmap docs, tests | none |
| Release note template | pass | `docs/roadmaps/staging-release-candidate/release-notes-template-v0.md` | none |
| Rollback checklist | pass | `docs/roadmaps/staging-release-candidate/rollback-checklist-v0.md` | none |
| Signoff requirements | pass | Staging RC docs and read model | important: signoffs are pending |
| Recommended next task | pass | RC docs point to this audit or production secret backend option decision | none |

No critical stale documentation was found.

## 9. Blocker Evaluation

### Critical Blockers

None.

No validation failure, no-secret failure, unsafe default external call, production-ready overclaim, deployment/release execution, tag creation, auto-merge, force-push, branch deletion, vendor CLI execution, real MCP call, or missing core checklist component was found.

### Important Follow-ups

| Follow-up | Severity | Evidence | Staging RC impact | Production impact | Recommended fix |
| --- | --- | --- | --- | --- | --- |
| Pending signoffs | high | Staging RC service defaults all six roles to `pending` | Blocks treating current repo as RC | Production approval model still future | Record approvals or explicit waivers |
| Missing filled release notes | high | Template exists; checklist requirements default to `missing` | Blocks treating current repo as RC | Production release management incomplete | Complete release notes using template |
| Validation evidence not persisted into checklist | medium | Validation commands passed in this audit, but checklist default gates can remain `not_checked` | Blocks automated RC pass status | Production CI evidence integration incomplete | Feed validation evidence into RC report or CI artifact |
| Missing live integration validation | medium | Optional profiles skipped by gate absence | Accepted staging limitation | Blocks production confidence | Run live profiles only after explicit gates are configured |
| Missing real secret backend | medium | Secret backend migration is planning-only | Accepted staging limitation | Production blocker | Decide and implement production secret backend option |
| Missing production auth | medium | Auth/RBAC planning is mock/read-only | Accepted staging limitation | Production blocker | Implement production IdP/session plan in future |
| Incomplete production request-context propagation | medium | Production auth remains planning-only | Does not block v0 audit | Blocks production tenant/security guarantees | Track in production auth/RBAC follow-up |

### Nice-to-have

| Item | Severity | Evidence | Recommended fix |
| --- | --- | --- | --- |
| pnpm engine warning mismatch | low | Validation scripts print Node 20 warning while direct checks show Node 24 | Align shell/pnpm Node resolution |
| Dashboard polish | low | Dashboard panel is read-model complete but utilitarian | Improve UX after RC semantics settle |
| Additional API contract docs | low | Endpoints are documented in roadmaps and tests | Add OpenAPI or endpoint reference later |

## 10. Release Note Requirement Audit

| Section | Requirement present | Current content status | Blocks staging RC |
| --- | --- | --- | --- |
| Summary | present | missing actual RC content | yes |
| Changed areas | present | missing actual RC content | yes |
| Validation | present | missing persisted validation summary | yes |
| Skipped tests | present | missing actual RC content | yes |
| Safety gates | present | missing actual RC content | yes |
| Known limitations | present | missing actual RC content | yes |
| Migration notes | present | missing actual RC content | yes |
| Dashboard/readiness notes | present | missing actual RC content | yes |
| Rollback notes | present | missing actual RC content | yes |
| Follow-ups | present | missing actual RC content | yes |

The release note template is complete, but the current repository lacks filled release notes for a concrete staging RC candidate. This is an important RC readiness blocker, not a code safety blocker.

## 11. Rollback Checklist Audit

| Item | Present | Current status | Blocks staging RC |
| --- | --- | --- | --- |
| Code rollback | yes | planned | no |
| Config rollback | yes | planned | no |
| DB/migration rollback consideration | yes | planned | no |
| GitHub integration rollback consideration | yes | planned | no |
| LLM integration rollback consideration | yes | planned | no |
| SecretRef/env gate rollback | yes | planned | no |
| Dashboard/readiness rollback | yes | planned | no |
| Audit/observability review | yes | planned | no |
| Manual verification | yes | planned | no |

Rollback coverage is adequate for RC checklist v0. Because no release or deployment has been executed, rollback is planning-only.

## 12. Signoff Readiness Audit

| Role | Required | Current status | Blocks staging RC | Mock signoff acceptable for v0 |
| --- | --- | --- | --- | --- |
| engineering_owner | yes | pending | yes | yes, if explicitly recorded or waived |
| platform_owner | yes | pending | yes | yes, if explicitly recorded or waived |
| security_reviewer | yes | pending | yes | yes, if explicitly recorded or waived |
| product_owner | yes | pending | yes | yes, if explicitly recorded or waived |
| qa_reviewer | yes | pending | yes | yes, if explicitly recorded or waived |
| release_manager | yes | pending | yes | yes, if explicitly recorded or waived |

Mock signoff is acceptable for v0 only as an explicit readiness artifact. It is not a substitute for production Auth/RBAC or a durable approval workflow.

## 13. Final Staging RC Decision

Decision: `staging_rc_not_ready`

Reason: the codebase passed required validation and no critical safety, secret, deployment, release, or documentation overclaim blocker was found. However, the current repository is not yet a staging release candidate because required signoffs remain pending, concrete release notes are missing, and validation evidence has not been recorded into the RC checklist/readiness report.

Critical blockers: none.

Warnings and accepted limitations:

- No staging deployment has been executed.
- No release, Git tag, or GitHub release has been created.
- Optional live integration tests are skipped by default.
- Production auth remains planning/mock-first.
- Real secret backend remains unimplemented.
- Production observability/export and durable retention remain unimplemented.
- Production readiness remains false.

Required next actions:

- Fill the staging RC release notes from the template.
- Record required signoffs or explicit waivers.
- Attach the green validation evidence to the checklist/report.
- Keep production-only blockers visible and unresolved until future production work.

Final Summary

Staging RC decision:
staging_rc_not_ready

Confidence:
high

Validation:
- install: not_run; dependency metadata unchanged
- lint: pass
- typecheck: pass
- test: pass, 275 total, 269 passed, 6 skipped, 0 failed
- build: pass
- git diff --check: pass

Skipped optional tests:
acceptable for staging RC v0 when documented; Postgres, remote Git/GitHub App/webhook, remote LLM, remote MCP, external auth, and vendor CLI profiles did not run because explicit gates were absent or future/forbidden.

Safe integration compliance:
pass; no unsafe default external calls, release creation, tag creation, deployment, destructive Git, vendor CLI, real MCP, or credential-cache behavior found.

No-secret/no-env exposure:
pass; no raw secret or env value exposure found in health, readiness, dashboard, audit DTO, or RC surfaces.

Docs consistency:
pass_with_warnings; docs do not overclaim staging deployed or production-ready, but pnpm reported a Node engine warning despite Node 24 being selected by direct checks.

Critical blockers:
none

Important follow-ups:
record validation evidence in the checklist/release notes, complete actual release notes, record required signoffs or waivers, keep production auth/secret backend/live integration validation visible as production blockers.

Accepted staging limitations:
no staging deployment execution, no release/tag/GitHub release, optional live integrations skipped by default, production auth planning-only, real secret backend missing, durable observability/export missing, production readiness false.

Production blockers:
real Auth/RBAC, real secret backend, production DB operations, durable observability/export/retention, policy bundle runtime, tenant isolation, live GitHub App/webhook/LLM validation, real MCP transport, production deployment controls.

Recommended next task:
Complete staging RC release notes and signoff record, then rerun Staging Release Candidate Audit v0; or decide the production secret backend implementation option.
