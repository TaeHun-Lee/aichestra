# CI/CD And Release Plan v0

Planning only. No production deployment pipeline is implemented.

## Required Validation Commands

Current local validation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Run `pnpm install` when dependency metadata changes.

## Node/Volta Alignment

`package.json` requires:

- engines: `node >=24.0.0`
- Volta: `node 24.15.0`

CI should use Node 24.x to avoid the current local warning seen under Node 20.x.

## Optional Test Profiles

- Postgres contract tests: set `AICHESTRA_TEST_DATABASE_URL`.
- GitHub integration tests: enable every explicit Git provider/integration env gate.
- GitHub webhook integration tests: enable every explicit webhook env gate.
- LLM integration tests: enable every explicit remote LLM env gate.
- MCP integration tests: future only; no real MCP transport exists in v0.
- External auth tests: future only; no real auth provider exists.

Default CI must not call external providers.

## Security Checks

- Secret scanning for source and generated artifacts.
- Dependency vulnerability scanning.
- License policy scan if required.
- Static search for direct external HTTP calls outside provider boundaries.
- Policy/no-secret regression tests.

## Container Build Future

Future containerization should produce separate artifacts:

- API image
- web image
- worker image
- migration job image
- future local-agent artifact

No image build or registry push is implemented in this task.

## Deployment Artifact Future

Artifacts should include:

- build provenance
- commit SHA
- dependency lockfile
- migration version
- policy bundle version
- config/profile manifest without secret values

## Release Gates

- All validation commands pass.
- Optional profile tests pass when their env is configured.
- Migration plan approved.
- Backup confirmed.
- Policy bundle approved.
- Auth/secret/backend readiness checks pass.
- Observability/audit export checks pass.
- Rollback plan reviewed.

## Rollback Plan

- Application artifact rollback.
- Policy bundle rollback.
- Migration forward-fix or restore plan.
- Provider gate disable procedure.
- Local Agent revocation procedure.
- Audit preservation during rollback.
