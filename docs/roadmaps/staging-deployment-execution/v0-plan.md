# Staging Deployment Execution Plan v0 Plan

Status: `implemented_by_this_task`
Scope: planning/readiness only
Production ready: no
Staging deployed: no

This plan follows the current docs layout described in `docs/README.md`: roadmap-level staging readiness work lives under `docs/roadmaps/`, so the canonical path is `docs/roadmaps/staging-deployment-execution/`.

## Current Status

- Staging RC: the rerun audit returned `staging_rc_pass_with_warnings`; validation was green, no critical blockers were found, and real human signoffs remain required before actual staging deployment.
- Staging dry-run: v0 is implemented and aggregates staging, CI/CD, DB, GitHub App, LLM, Vault, MCP, auth, secrets, policy, observability, dashboard, Local Agent, runner, and Git readiness without deploying.
- GitHub App integration-test profile: v1 implemented; live tests are skipped by default and require explicit non-production gates.
- LLM Gateway integration-test profile: v1 implemented; live tests are skipped by default and require explicit provider/model/budget/credential gates.
- Vault Integration-Test Profile: v1 implemented; live Vault KV v2 checks are skipped by default and require explicit test-only path, allowlist, token, and no-write/no-delete/no-rotate gates.
- DB production operations: v1 implemented as read-only planning; production DB operations are not implemented and no migration is run automatically.
- Secret backend readiness: Vault-backed Secret Backend v1 is gated and non-default; no production Vault rollout or production-ready secret backend exists.
- Auth/RBAC readiness: production Auth/RBAC remains planning-only; mock auth must be explicitly accepted for staging or block execution.
- Observability readiness: audit/readiness surfaces exist, but no external observability backend/export is implemented.

## Proposed Execution Sequence

The plan defines a manual sequence for future controlled staging deployment after signoff:

1. Confirm clean worktree or documented diff scope.
2. Confirm Node/Volta baseline.
3. Run required validation.
4. Confirm staging RC decision.
5. Collect human signoffs.
6. Freeze config/environment gates.
7. Decide whether optional live integration tests are required.
8. Confirm Postgres/staging DB decision.
9. Confirm secret backend / Vault decision.
10. Confirm GitHub App integration test decision.
11. Confirm LLM integration test decision.
12. Confirm MCP remains mock/future.
13. Confirm Auth/RBAC remains mock/planning or staging-approved.
14. Confirm dashboard/readiness surfaces.
15. Confirm observability/audit readiness.
16. Confirm rollback plan.
17. Record final go/no-go decision.
18. Leave deployment execution as a future placeholder.
19. Leave post-deployment smoke checks as future placeholders.
20. Leave post-deployment review as a future placeholder.

## Required Signoffs

Required roles are `engineering_owner`, `platform_owner`, `security_reviewer`, `product_owner`, `qa_reviewer`, and `release_manager`. This task does not fake real approval. Pending signoffs keep the execution plan `ready_for_signoff` and go/no-go `not_ready`.

Staging Human Signoff Pack v0 now provides the collection surface, evidence checklist, and decision policy for those roles. It remains pending until real human approval evidence is recorded.

## Pre-deployment Checks

Required gates include `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `git diff --check`, safe integration scan, no-secret/no-env exposure, no release/tag/deployment side effects, no staging/production overclaim, release notes present, rollback plan present, and accepted RC warnings.

## Post-deployment Checks

v0 only documents future smoke checks. It does not run them. Planned checks include `/health`, dashboard routes, deployment/staging/RC readiness summaries, observability audit summary, and no-secret/no-env smoke review.

## Rollback Criteria

Rollback criteria include health failure, dashboard/readiness exposure failure, unexpected external provider call, destructive Git gate enabled, migration/data inconsistency, policy/Auth/RBAC bypass, and audit/observability gap.

## What This Task Implements

- Read-only staging execution plan, step, gate, go/no-go, rollback, and summary models.
- Deterministic service methods, DTOs, API endpoints, health metadata, and dashboard read model/panel.
- Documentation for execution sequence, pre-deploy gates, optional live integration decisions, smoke checks, rollback, and v0 behavior.
- Tests for models, API, health, dashboard, no-secret/no-env exposure, no deployment, no external calls, pending signoff behavior, and safety blockers.

## Out Of Scope

- Actual deployment execution.
- Release creation, Git tags, GitHub releases, or active CI/CD workflow creation.
- Kubernetes, Terraform, Helm, Pulumi, cloud infrastructure, artifact registry, or production deployment code.
- Live GitHub, LLM, MCP, Vault, external auth, cloud, or vendor CLI calls.
- Real human signoff collection/enforcement, production sessions, JWTs, or production credentials.
- Real secret writes, deletes, rotations, migrations, or production Vault rollout.
