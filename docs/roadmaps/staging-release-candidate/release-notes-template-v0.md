# Staging Release Candidate Release Notes Template v0

Status: `v0_implemented`

This template defines required release-note sections for staging RC designation. It does not create a release, Git tag, GitHub release, artifact, deployment, or changelog publication.

Evidence Pack v0 fills a draft at [release-notes-draft-v0.md](release-notes-draft-v0.md). The draft is evidence for a future audit only; it is not a published release note.

## Summary

- Candidate branch or commit:
- RC checklist status:
- Staging deployed: `false`
- Production ready: `false`
- Release created: `false`

## Changed Areas

- Apps:
- Packages:
- Tests:
- Docs:
- Dependency metadata changed: `yes/no`

## Validation

- `pnpm lint`:
- `pnpm typecheck`:
- `pnpm test`:
- `pnpm build`:
- `git diff --check`:
- Safe integration scan:
- No-secret/no-env exposure check:

## Skipped Tests

Document every skipped optional profile:

- Optional Postgres contract tests:
- Remote Git live tests:
- GitHub App live integration tests:
- GitHub webhook tests:
- LLM live integration tests:
- MCP live tests:
- External auth tests:
- Vendor CLI tests:

Each skip must include whether the profile is optional for staging RC v0 and which explicit gates were not configured.

## Safety Gates

- No release created:
- No Git tag created:
- No GitHub release created:
- No deployment executed:
- No remote Git merge/rebase/force-push/branch deletion:
- No real LLM call:
- No real MCP call:
- No external auth call:
- No vendor CLI execution:
- No credential cache read:
- No secret/env values exposed:

## Known Limitations

- Production Auth/RBAC:
- Real secret backend:
- Durable observability/export:
- Production DB operations:
- Policy bundle runtime:
- Staging deployment execution:
- Production deployment:
- Optional live provider validation:

## Migration Notes

- DB schema or migrations changed:
- Migrations executed by this task: `false`
- Production DB connection attempted: `false`
- Backup/restore jobs run: `false`
- Dependency install required:

## Dashboard/Readiness Notes

- `/readiness/staging-rc/summary` status:
- `/readiness/staging-rc/report` status:
- `/dashboard/staging-rc` status:
- `/health` staging RC metadata:
- No-secret/no-env result:

## Rollback Notes

- Code revert plan:
- Config/env gate rollback:
- DB/migration rollback consideration:
- GitHub/Git rollback consideration:
- LLM gate rollback consideration:
- SecretRef/env fallback rollback:
- Dashboard/readiness rollback:
- Observability/audit review:

## Follow-ups

- Recommended next task:
- Non-blocking follow-ups:
- Production blockers to keep visible:
