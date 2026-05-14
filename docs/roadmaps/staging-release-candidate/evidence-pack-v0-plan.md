# Staging RC Evidence Pack v0 Plan

## Document Placement

`docs/README.md` keeps staging release-candidate roadmap material under `docs/roadmaps/staging-release-candidate/`. This plan lives beside the existing RC checklist, report format, release-note template, and rollback checklist because it defines the evidence artifacts needed by a future Staging Release Candidate Audit.

The evidence pack itself is created at `docs/audits/staging-rc-evidence-pack-v0.md` because the task requested that stable evidence path. It is evidence documentation only, not a new audit decision.

## Audit Result Summary

Source audit: `docs/audits/2026-05-14-staging-release-candidate-audit-v0.md`.

Current decision: `staging_rc_not_ready`.

Reason:

- Required validation was green.
- No critical blockers were found.
- Optional live integration tests were skipped for documented and acceptable reasons.
- Signoffs were pending.
- Actual release notes were not filled.
- Validation evidence was not recorded into the RC checklist/report.

## Missing Evidence Items

- A single evidence pack linking the audit result, validation evidence, safety evidence, skipped test policy, and production blockers.
- Filled release notes based on `docs/roadmaps/staging-release-candidate/release-notes-template-v0.md`.
- Rollback evidence showing rollback is planning/checklist evidence only because no release or deployment occurred.
- Signoff readiness evidence that does not fake real approval.
- Updated RC docs pointing future auditors to the evidence pack, release notes draft, rollback evidence, and signoff readiness document.

## Required Validation Evidence

The evidence pack records:

- `pnpm install`: not run because dependency metadata was unchanged.
- `pnpm lint`: pass.
- `pnpm typecheck`: pass.
- `pnpm test`: pass, 275 total / 269 passed / 6 skipped.
- `pnpm build`: pass.
- `git diff --check`: pass.
- Trailing whitespace scan: pass.

This task does not change dependency metadata. If dependency metadata changes in a future task, `pnpm install` must be run before RC designation.

## Required Release Note Sections

The draft release notes must include:

- Summary
- Changed areas
- Validation
- Skipped tests
- Safety gates
- Known limitations
- Migration notes
- Dashboard/readiness notes
- Rollback notes
- Follow-ups

The notes must explicitly state that this is not a production release, staging is not deployed, production is not ready, skipped integration tests are acceptable only for current staging RC criteria, and live GitHub/LLM/MCP/auth integrations remain gated.

## Signoff Handling Strategy

This task must not fake real human approval.

Signoff evidence records each required role as `planning_ready_pending_real_signoff` unless a real signoff is separately provided. Pending real signoffs block `staging_rc_pass`. They may allow a future audit to return `staging_rc_pass_with_warnings` only if the project explicitly accepts planning-ready signoff evidence for Staging RC Evidence Pack v0 and no other RC blockers remain.

Real human signoff remains required before any actual staging deployment attempt.

## Rollback Checklist Evidence Strategy

Rollback evidence records:

- code rollback plan,
- config rollback plan,
- DB/migration rollback considerations,
- GitHub integration rollback considerations,
- LLM integration rollback considerations,
- SecretRef/env gate rollback,
- dashboard/readiness rollback,
- audit/observability review,
- manual verification checklist.

No destructive rollback command is run. Because no release or deployment happened, rollback remains planning/checklist evidence only.

## Skipped Test Evidence Strategy

Each optional skipped profile records:

- why it was skipped,
- which gates were missing or future/forbidden,
- whether the skip is acceptable for staging RC criteria,
- whether the skip blocks production readiness.

Skipped profiles must not be treated as passed.

## This Task Updates

- `docs/roadmaps/staging-release-candidate/evidence-pack-v0-plan.md`
- `docs/audits/staging-rc-evidence-pack-v0.md`
- `docs/roadmaps/staging-release-candidate/release-notes-draft-v0.md`
- `docs/roadmaps/staging-release-candidate/rollback-evidence-v0.md`
- `docs/roadmaps/staging-release-candidate/signoff-readiness-v0.md`
- Existing RC, README, AGENTS, docs index, and phase-progress references to point at the evidence pack.

## Out Of Scope

- Creating a release, Git tag, GitHub release, artifact, or changelog publication.
- Deploying to staging or production.
- Running deployment commands, active CI jobs, or remote integration tests.
- Calling GitHub, LLM providers, MCP servers, external auth providers, Vault/cloud secret backends, artifact registries, Kubernetes, Temporal, OPA/Cedar, or vendor CLIs.
- Reading credential caches.
- Reading, printing, issuing, or exposing secrets, env values, tokens, sessions, JWTs, or production credentials.
- Implementing production auth, production secret backend, production deployment, staging deployment, infrastructure manifests, or artifact registry integration.
- Marking staging as deployed or production as ready.
