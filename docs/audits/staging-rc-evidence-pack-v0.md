# Staging RC Evidence Pack v0

Status: `evidence_pack_v0_recorded`

This evidence pack records documentation and validation evidence for a future Staging Release Candidate Audit. It is not an audit decision, release, tag, GitHub release, deployment, or remote integration run.

## Audit Source

- Source audit: `docs/audits/2026-05-14-staging-release-candidate-audit-v0.md`
- Current decision from source audit: `staging_rc_not_ready`
- Source audit reason: validation was green, no critical blockers were found, signoffs were pending, actual release notes were not filled, and validation evidence was not recorded into the RC checklist/report.

## Remediation Target

- Target decision: `staging_rc_pass_with_warnings`
- Reason: validation and safety evidence are recorded, release notes are drafted, rollback evidence is present, skipped optional tests are documented, and signoffs are planning-ready but not real human approvals.
- `staging_rc_pass` remains inappropriate unless required signoff evidence is explicitly accepted by project rules or real signoffs are provided.
- If a future audit treats pending/planning-ready signoffs as blocking rather than warnable, the expected decision remains `staging_rc_not_ready`.

## Validation Evidence

| Gate | Evidence | Status |
| --- | --- | --- |
| `pnpm install` | Not run because dependency metadata was unchanged | not_run |
| `pnpm lint` | Completed successfully in Staging Release Candidate Audit v0 and revalidated by Evidence Pack v0 | pass |
| `pnpm typecheck` | Completed successfully in Staging Release Candidate Audit v0 and revalidated by Evidence Pack v0 | pass |
| `pnpm test` | Revalidated by Evidence Pack v0: 275 total / 269 passed / 6 skipped / 0 failed | pass |
| `pnpm build` | Completed successfully in Staging Release Candidate Audit v0 and revalidated by Evidence Pack v0 | pass |
| `git diff --check` | Completed with no whitespace errors | pass |
| Trailing whitespace scan | Evidence Pack v0 docs trailing whitespace scan passed | pass |

Validation commands do not deploy, create releases, create tags, run remote integration tests, call providers, or expose secrets/env values.

## Safety Evidence

| Safety item | Evidence status |
| --- | --- |
| No release | pass; no release was created |
| No Git tag | pass; no Git tag was created |
| No GitHub release | pass; no GitHub release was created |
| No deployment | pass; no staging or production deployment was executed |
| No external provider call | pass; default runtime/tests remain mock-first and gated |
| No real LLM call | pass; remote LLM profiles were skipped by default |
| No real MCP call | pass; real MCP transport remains future/disabled |
| No external auth call | pass; production auth remains planning/mock-first |
| No remote Git operation | pass; no remote fetch/push/merge/rebase/force-push/delete was run |
| No vendor CLI execution | pass; vendor CLI execution remains forbidden/future |
| No credential-cache read | pass; credential caches were not read |
| No secret exposure | pass; no raw secret values were exposed |
| No env value exposure | pass; no raw env values were exposed |
| Staging deployed claim | pass; staging remains not deployed |
| Production ready claim | pass; production remains not ready |

Safe integration scan result: pass. The broad scan matched documentation, mock/test references, safe config placeholders, gated GitHub/LLM/MCP boundaries, and readiness planning references. Targeted code scans found only gated GitHub and LLM `fetch` boundaries, safe build/test/migration scripts, local-only Git fixture behavior, and denied-command tests. No suspicious default runtime or test behavior was found.

## Skipped Optional Tests

Skipped optional profiles are acceptable for Staging RC v0 only when explicitly documented, not required by current RC criteria, and still gated. They block production readiness until executed under explicit non-production gates.

| Optional profile | Why skipped | Missing or unavailable gates | Acceptable for staging RC | Production readiness impact |
| --- | --- | --- | --- | --- |
| Optional Postgres | Optional repository contract tests require an explicit test database | `AICHESTRA_TEST_DATABASE_URL` | yes; optional for current RC criteria | Blocks production DB confidence until run against a non-production Postgres target |
| Remote Git | Optional live GitHub tests require every remote Git gate | `AICHESTRA_GITHUB_INTEGRATION_TESTS`, `AICHESTRA_ENABLE_REMOTE_GIT`, branch/PR create gates, GitHub credential metadata, allowed repos | yes; remote Git remains gated | Blocks production/live Git provider confidence |
| GitHub App live | GitHub App live profile is skipped by default | `AICHESTRA_GITHUB_APP_INTEGRATION_TESTS`, `AICHESTRA_ENABLE_REMOTE_GIT`, `AICHESTRA_GITHUB_AUTH_MODE=github_app`, `AICHESTRA_ENABLE_GITHUB_APP`, app id metadata, private-key SecretRef metadata, installation/repo allowlists, branch/PR gates, no remote merge | yes; profile is optional and documented | Blocks production GitHub App confidence |
| GitHub webhook | Live webhook validation requires explicit webhook gates | `AICHESTRA_GITHUB_WEBHOOK_INTEGRATION_TESTS`, `AICHESTRA_ENABLE_GITHUB_WEBHOOKS`, webhook SecretRef or gated legacy secret metadata, allowed repos | yes; webhooks remain disabled by default | Blocks production webhook readiness |
| Remote LLM | LLM integration profile is skipped by default | `AICHESTRA_LLM_INTEGRATION_TESTS`, OpenAI-compatible provider mode, `AICHESTRA_ENABLE_REMOTE_LLM`, `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION`, base URL metadata, SecretRef credential metadata, allowed/default model, routing, fallback disabled, budget cap, prompt class | yes; remote LLM remains gated | Blocks production LLM confidence |
| Remote MCP | Real MCP transport is future/disabled | real MCP transport gate and associated policy/secret/sandbox readiness are not implemented for current staging RC | yes; real MCP is out of scope | Blocks production MCP readiness |
| External auth | Production auth integration is planning-only | real OIDC/SAML/SCIM/SSO/session/service-account gates do not exist yet | yes; mock auth is accepted for current staging RC criteria | Blocks production auth readiness |
| Vendor CLI | Vendor CLI execution is forbidden/future | vendor CLI execution gates are intentionally absent and must remain disabled | yes; vendor CLI must not run | Blocks any future vendor CLI integration until explicitly designed |

## Release Notes Evidence

- Draft release notes: `docs/roadmaps/staging-release-candidate/release-notes-draft-v0.md`
- Template source: `docs/roadmaps/staging-release-candidate/release-notes-template-v0.md`
- Status: present as draft evidence.
- Limitation: the draft is not a release artifact and does not create or publish a release.

## Rollback Evidence

- Rollback evidence: `docs/roadmaps/staging-release-candidate/rollback-evidence-v0.md`
- Checklist source: `docs/roadmaps/staging-release-candidate/rollback-checklist-v0.md`
- Status: present as planning/checklist evidence.
- Limitation: no rollback command was run because no release or deployment happened.

## Signoff Readiness Evidence

- Signoff readiness: `docs/roadmaps/staging-release-candidate/signoff-readiness-v0.md`
- Status: planning-ready, pending real signoffs.
- Real human approval was not faked.
- Pending real signoffs block `staging_rc_pass`.
- Planning-ready signoff evidence can support `staging_rc_pass_with_warnings` only if accepted by the future audit criteria for v0.
- Real human signoff remains required before actual staging deployment.

## No-overclaim Statement

This evidence pack does not claim:

- staging is deployed,
- production is ready,
- a release was created,
- a Git tag was created,
- a GitHub release was created,
- remote integration tests passed,
- real signoffs were provided,
- external providers were called.

## Expected Future Audit Outcome

Expected future audit target: `staging_rc_pass_with_warnings`.

The expected warning set is:

- signoffs are planning-ready/pending real approval,
- optional live integration tests remain skipped,
- production auth is planning/mock-first,
- real secret backend is missing,
- durable observability/export is missing,
- staging deployment has not occurred,
- production readiness remains false.

If the next audit requires real human signoffs before any RC designation, the correct outcome remains `staging_rc_not_ready` until those signoffs are recorded.
