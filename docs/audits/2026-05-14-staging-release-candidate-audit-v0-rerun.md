# Staging Release Candidate Audit v0 Rerun

Date: 2026-05-14

Requested report path: `docs/audits/2026-05-14-staging-release-candidate-audit-v0-rerun.md`.
This path matches the `docs/README.md` audit naming convention for dated audit reports.

Scope: audit-only. This rerun inspected repository docs, source, tests, migrations, validation output, optional integration gates, safety scans, and the new Staging RC Evidence Pack v0. It did not implement features, modify application code, create a release, create a tag, deploy anything, run remote Git operations, call LLM/MCP/auth providers, execute vendor CLIs, read credential caches, expose secrets, or mutate active registry entries.

## 1. Executive Summary

Rating: `staging_rc_pass_with_warnings`

Confidence: `high`

The current repository can be treated as a Staging Release Candidate for Staging Release Candidate Checklist v0 audit purposes, with warnings. It must not be treated as deployed staging, production-ready, released, tagged, or approved for an actual staging deployment.

Validation is green: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `git diff --check` passed. `pnpm install` was not run because dependency metadata was unchanged.

Skipped optional integrations are acceptable for this v0 RC because they are documented, gated, not required by the current checklist, and production readiness is not claimed.

The Evidence Pack v0 resolves the previous documentation gaps for release notes, rollback evidence, skipped-test evidence, safety evidence, and validation evidence. Signoff evidence is planning-ready only: real human signoffs do not exist in the inspected docs, and they remain required before any actual staging deployment. This audit accepts planning-ready signoff evidence as a warning for v0 RC classification, consistent with the task's decision guidance and the Evidence Pack target. If the project later decides real human signoff is mandatory before any RC designation, the correct decision would be `staging_rc_not_ready`.

Production blockers are properly classified as production-only or future work. Staging deployment remains unexecuted. Production readiness is still not claimed.

## 2. Previous Blocker Remediation Audit

| Previous issue | Current status | Evidence | Rerun conclusion |
| --- | --- | --- | --- |
| Signoffs pending | Partially remediated as planning-ready evidence only | `docs/roadmaps/staging-release-candidate/signoff-readiness-v0.md`, `docs/audits/staging-rc-evidence-pack-v0.md` | Real signoffs are still pending. This blocks `staging_rc_pass` and any actual staging deployment, but is accepted as a warning for `staging_rc_pass_with_warnings` in this v0 rerun. |
| Release notes not filled | Remediated | `docs/roadmaps/staging-release-candidate/release-notes-draft-v0.md` | Required sections are present and explicitly state no release, no tag, no deployment, staging not deployed, and production not ready. |
| Validation evidence not recorded | Remediated at documentation/evidence level | `docs/audits/staging-rc-evidence-pack-v0.md` | Validation, safety, skipped optional tests, and no-overclaim evidence are recorded. Runtime read models remain read-only and are not mutated by the evidence pack. |

## 3. Required Validation Gates

`pnpm install` was not run. `git status --short package.json pnpm-lock.yaml pnpm-workspace.yaml apps/*/package.json packages/*/package.json` produced no dependency-metadata changes, and the docs did not require install.

| Command | Status | Summary | Test count | Skipped count | Warnings | Staging RC impact |
| --- | --- | --- | --- | --- | --- | --- |
| `pnpm install` | not_run | Dependency metadata unchanged | n/a | n/a | none | Does not block |
| `pnpm lint` | pass | `lint passed` | n/a | n/a | pnpm reported Node engine warning | Does not block |
| `pnpm typecheck` | pass | `tsc --noEmit -p tsconfig.typecheck.json` completed | n/a | n/a | pnpm reported Node engine warning | Does not block |
| `pnpm test` | pass | Node test runner completed | 275 total, 269 passed, 0 failed | 6 | none in final summary | Does not block |
| `pnpm build` | pass | `build passed` | n/a | n/a | pnpm reported Node engine warning | Does not block |
| `git diff --check` | pass | No whitespace or patch-format errors | n/a | n/a | none | Does not block |

The pnpm engine warning reported `current: {"node":"v20.11.1","pnpm":"10.33.0"}` even though direct tool checks during audit showed Node 24 selected in this shell. This is a warning to clean up toolchain consistency, not a staging RC blocker because all validation commands passed.

## 4. Optional Integration Test Audit

All inspected explicit integration gates were `not_configured` in the audit shell, including Postgres, remote Git, GitHub App live tests, webhook tests, remote LLM, real MCP transport, external auth, and local command execution gates.

| Optional test | Expected skip condition | Actual status | Acceptable for staging RC | Production readiness impact |
| --- | --- | --- | --- | --- |
| Optional Postgres tests | `AICHESTRA_TEST_DATABASE_URL` absent | skipped | yes | Blocks production DB confidence |
| Remote Git tests | Remote Git provider, enablement, auth mode, credentials, allowlists, and operation gates absent | skipped | yes | Blocks production Git provider confidence |
| GitHub App live tests | GitHub App integration gates, app id metadata, SecretRef metadata, installation/repo allowlists, branch prefix, branch/PR gates absent | skipped | yes | Blocks production GitHub App rollout confidence |
| GitHub webhook tests | Webhook enablement, secret reference, allowlist, and live delivery gates absent | skipped | yes | Blocks production webhook readiness |
| Remote LLM tests | Remote LLM provider, completion gate, base URL, credentials, model allowlist, routing, fallback, and budget gates absent | skipped | yes | Blocks production LLM confidence |
| Remote MCP tests | Real MCP transport is disabled/future | skipped/future | yes | Blocks production MCP readiness |
| External auth tests | Production IdP/session/service-account integration is not implemented | skipped/future | yes | Blocks production Auth/RBAC readiness |
| Vendor CLI tests | Vendor CLI execution is forbidden/future | skipped/future | yes | Remains out of scope and production blocked |

Skipped optional integration tests are acceptable for this RC because they are documented in the RC evidence pack and release-note draft, not required by the current staging RC checklist, gated by default, and not represented as passed live integrations.

## 5. Safe Integration Compliance Audit

The required broad scan returned 2,816 matches. Findings were classified as safe documentation references, safe mock/test references, safe type/interface references, safe config placeholders, gated GitHub/LLM/MCP boundaries, readiness planning only, and dashboard/API read-only surfaces.

Targeted inspection found:

| Category | Evidence | Classification |
| --- | --- | --- |
| HTTP/network calls | `packages/adapters/src/git/github-client.ts` has one `fetch` inside the gated GitHub client; `packages/llm-gateway/src/providers.ts` has one `fetch` inside the OpenAI-compatible HTTP client boundary | Gated provider boundaries, not default runtime/test external calls |
| Process execution | `scripts/run-tests.mjs`, `scripts/build.mjs`, `scripts/db/migrate.mjs`, local Git fixture tests, local merge simulator, and `packages/runner/src/command-executor.ts` | Safe validation/test/local fixture use; runner command executor blocks network, remote Git, vendor CLIs, shells, and destructive commands by default |
| Remote/destructive Git strings | Policy, runner harness, tests, docs, and local-only `git merge-tree` simulator | Denial rules or local dry-run fixture behavior; no remote merge/rebase/force-push/delete enabled |
| Release/deployment true flags | Only `tests/staging-release-candidate-v0.test.ts` sets release/deployment flags true to verify they become critical blockers | Safe negative test |
| Docker Compose password | `docker-compose.yml` contains local Postgres placeholder `POSTGRES_PASSWORD: aichestra` | Safe local dev config placeholder; not exposed by API/dashboard/readiness surfaces and not a production secret |
| Vendor CLI, credential cache, cloud, Vault, OPA/Cedar, Kubernetes, Temporal references | Docs, denied-command lists, future placeholders, tests, and planning models | Safe documentation/planning/deny-list references |

No suspicious integration code or actual unsafe default runtime/test behavior was found. Default runtime/tests did not create a release, create a tag, deploy, call providers, expose secrets/env values, run live integration tests, claim staging deployed, claim production ready, auto-merge, force-push, delete branches, execute vendor CLIs, or read credential caches.

## 6. No-secret / No-env Exposure Audit

Classification: `pass`

Inspected health metadata, dashboard read models, readiness APIs, auth surfaces, SecretRef surfaces, GitHub App and webhook surfaces, LLM surfaces, MCP surfaces, observability DTOs, audit sanitizer paths, and test fixtures.

Evidence:

- Staging RC tests assert API, dashboard, health, report, summary, and HTML output do not expose secret or env values.
- Security, observability, Git, LLM, MCP, policy, runner, and dashboard code include sanitization/redaction paths for API keys, tokens, webhook secrets, credential cache paths, env dumps, DB URLs, session/JWT secrets, private keys, and bearer strings.
- Secret-like strings in tests are redaction fixtures or negative cases asserting that values are not returned.
- Docs mention credential names and placeholders, but no raw credential value was found in readiness/API/dashboard behavior.

No API key value, GitHub token, GitHub App private key, webhook secret, database URL value, session/JWT secret, credential cache contents, raw env dump, or unredacted runtime secret exposure was found.

## 7. Documentation Consistency Audit

Classification: `pass_with_warnings`

Docs are consistent with the current RC posture:

- No production-ready overclaim found.
- No staging-deployed overclaim found. The Evidence Pack's "staging is deployed" hit is explicitly under "This evidence pack does not claim".
- Known limitations are explicit in the release-note draft, evidence pack, RC docs, deployment readiness docs, staging docs, and real integration roadmap.
- Skipped tests are documented and classified as acceptable for current staging RC criteria only.
- Environment gates are documented in staging, CI/CD, GitHub App, LLM, and reference docs.
- Release-note draft exists.
- Rollback evidence exists.
- Signoff readiness exists and does not fake human approval.
- Recommended next task is coherent: re-run this audit, collect real signoffs before deployment, or proceed to production secret backend implementation option decision.

Warnings:

- The runtime RC read model remains `not_ready` unless validation/signoff/release-note evidence is supplied through service options; the Evidence Pack is audit documentation, not runtime state mutation.
- pnpm emits a Node engine warning in scripts despite direct audit shell Node checks selecting Node 24.

## 8. Release Note Requirement Audit

| Section | Status | Evidence | Blocks staging RC |
| --- | --- | --- | --- |
| Summary | present | `release-notes-draft-v0.md` | no |
| Changed areas | present | `release-notes-draft-v0.md` | no |
| Validation | present | `release-notes-draft-v0.md` | no |
| Skipped tests | present | `release-notes-draft-v0.md` | no |
| Safety gates | present | `release-notes-draft-v0.md` | no |
| Known limitations | present | `release-notes-draft-v0.md` | no |
| Migration notes | present | `release-notes-draft-v0.md` | no |
| Dashboard/readiness notes | present | `release-notes-draft-v0.md` | no |
| Rollback notes | present | `release-notes-draft-v0.md` | no |
| Follow-ups | present | `release-notes-draft-v0.md` | no |

The release-note gap from the prior audit is resolved.

## 9. Rollback Evidence Audit

| Item | Status | Evidence | Blocks staging RC |
| --- | --- | --- | --- |
| Code rollback | present | `rollback-evidence-v0.md` | no |
| Config rollback | present | `rollback-evidence-v0.md` | no |
| DB/migration rollback consideration | present | `rollback-evidence-v0.md` | no |
| GitHub integration rollback consideration | present | `rollback-evidence-v0.md` | no |
| LLM integration rollback consideration | present | `rollback-evidence-v0.md` | no |
| SecretRef/env gate rollback | present | `rollback-evidence-v0.md` | no |
| Dashboard/readiness rollback | present | `rollback-evidence-v0.md` | no |
| Audit/observability review | present | `rollback-evidence-v0.md` | no |
| Manual verification | present | `rollback-evidence-v0.md` | no |

Rollback evidence is planning/checklist evidence only. No deployment happened, and no destructive rollback command was run.

## 10. Signoff Readiness Audit

| Role | Required | Current status | Evidence source | Mock/planning acceptable for v0 RC | Real signoff before staging deployment |
| --- | --- | --- | --- | --- | --- |
| engineering_owner | required | planning_ready_pending_real_signoff | `signoff-readiness-v0.md`, Evidence Pack | yes, warning only | required |
| platform_owner | required | planning_ready_pending_real_signoff | `signoff-readiness-v0.md`, Evidence Pack | yes, warning only | required |
| security_reviewer | required | planning_ready_pending_real_signoff | `signoff-readiness-v0.md`, Evidence Pack | yes, warning only | required |
| product_owner | required | planning_ready_pending_real_signoff | `signoff-readiness-v0.md`, Evidence Pack | yes, warning only | required |
| qa_reviewer | required | planning_ready_pending_real_signoff | `signoff-readiness-v0.md`, Evidence Pack | yes, warning only | required |
| release_manager | required | planning_ready_pending_real_signoff | `signoff-readiness-v0.md`, Evidence Pack | yes, warning only | required |

No real human signoff was found or claimed. Pending signoffs block `staging_rc_pass` and any actual staging deployment. They do not block `staging_rc_pass_with_warnings` in this rerun because the evidence pack explicitly targets that decision if planning-ready signoff evidence is accepted as a v0 warning.

## 11. Final Staging RC Decision

Decision: `staging_rc_pass_with_warnings`

Reason: Required validation is green, no critical blockers were found, release-note and rollback evidence now exist, skipped optional integrations are documented and acceptable for current staging RC v0 criteria, no secret/env exposure was found, and docs do not overclaim staging deployment or production readiness. The only RC-completion gap that remains is real human signoff, which this rerun accepts as a warning for v0 audit classification while preserving the guardrail that real signoff is required before actual staging deployment.

Critical blockers: none.

Warnings:

- Required signoffs are planning-ready only; no real human approval was inspected.
- Optional live integrations remain skipped.
- The runtime RC read model still defaults to `not_ready` unless supplied with validation/signoff/release-note evidence; this audit decision is evidence-document based.
- pnpm engine warning should be cleaned up.

Accepted limitations:

- No staging deployment.
- No release, Git tag, or GitHub release.
- No remote/live integrations by default.
- Mock/planning auth and planning-only production Auth/RBAC.
- No real secret backend.
- No durable observability export or production retention execution.
- No production deployment readiness claim.

Required next actions:

- Collect and record real human signoffs before any staging deployment validation.
- Keep optional live integrations gated until explicitly configured for non-production validation.
- Optionally wire evidence-pack status into a CI/readiness evidence ingestion path without weakening gates.
- Decide production secret backend implementation option.

Production readiness remains false.

Final Summary

Staging RC decision:
staging_rc_pass_with_warnings

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
acceptable for staging RC v0; Optional Postgres, remote Git, GitHub App live, GitHub webhook, remote LLM, remote MCP, external auth, and vendor CLI tests were skipped because explicit gates are absent, future, or forbidden; these skips block production readiness only.

Evidence remediation:
previous release-note, rollback, skipped-test, safety, and validation-evidence gaps are resolved by Evidence Pack v0; signoffs are planning-ready only and accepted as a warning for this v0 rerun.

Safe integration compliance:
pass; no unsafe default external calls, release/tag/deployment behavior, destructive Git behavior, vendor CLI execution, real MCP transport, or credential-cache behavior found.

No-secret/no-env exposure:
pass; no raw secret or env value exposure found.

Docs consistency:
pass_with_warnings; docs do not overclaim staging deployed or production-ready; pnpm reports a Node engine warning; runtime RC read model remains not_ready unless supplied evidence/options.

Critical blockers:
none

Important follow-ups:
collect real human signoffs before staging deployment; optionally wire evidence pack into CI/readiness read model; run optional live integrations only under explicit non-production gates; resolve pnpm engine warning; choose production secret backend.

Accepted staging limitations:
no staging deployment, no release/tag/GitHub release, no remote/live integrations by default, planning-ready signoffs only, mock/planning auth, no real secret backend, no durable observability/export, production readiness false.

Production blockers:
real Auth/RBAC, real secret backend, production DB operations, durable observability/export/retention, policy bundle runtime, tenant isolation, live GitHub App/webhook/LLM validation, real MCP transport, and production deployment controls.

Recommended next task:
Production secret backend implementation option decision, or collect real staging signoffs before any staging deployment validation.
