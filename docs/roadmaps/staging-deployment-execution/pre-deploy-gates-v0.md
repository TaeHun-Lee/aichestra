# Staging Deployment Pre-deploy Gates v0

Status: `v0_implemented`
Scope: planning/readiness only

Required pre-deployment gates:

- `pnpm lint` pass.
- `pnpm typecheck` pass.
- `pnpm test` pass.
- `pnpm build` pass.
- `git diff --check` pass.
- Safe integration scan pass.
- No-secret/no-env exposure pass.
- Staging RC decision is `staging_rc_pass` or an accepted `staging_rc_pass_with_warnings`.
- Human signoffs collected from all required roles using `human-signoff-pack-v0.md`, `signoff-evidence-checklist-v0.md`, and `signoff-decision-policy-v0.md`.
- Release notes present.
- Rollback plan present.
- Optional integration skips accepted and documented.
- Staging environment gate matrix reviewed.
- `productionReady=false` acknowledged.
- `stagingDeployed=false` before execution acknowledged.

Critical blockers:

- Validation failure.
- Secret/env exposure failure.
- Release/tag/deployment side effect.
- External provider call outside explicit future task.
- Remote merge, force push, or branch deletion enabled.
- Real MCP transport enabled.
- Production-ready or staging-deployed overclaim.

The v0 API exposes these gates as read-only status. It does not run commands or deploy.
