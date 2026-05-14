# Staging Deployment Dry-run Blocker Taxonomy v0

Status: v0_implemented
Scope: read-only blocker classification

## Categories

Blockers use the dry-run check/source categories:

- validation
- environment
- storage
- secrets
- auth
- policy
- git
- github_app
- webhook
- llm
- mcp
- runner
- local_agent
- observability
- dashboard
- ci_cd
- security
- rollback

## Severity Definitions

`critical`

Unsafe behavior or missing safety evidence that makes the dry-run untrustworthy or blocks production/staging progression. Examples: remote merge, force push, branch deletion, vendor CLI execution, real MCP transport without readiness, secret/env exposure, validation failure, unsafe GitHub/LLM gates.

`high`

Readiness gap that prevents meaningful staging validation but does not necessarily make the read-only dry-run unsafe. Examples: missing Postgres staging configuration, missing observability backend, required live profile gates missing when explicitly required.

`medium`

Gated optional validation or incomplete planning item. Examples: skipped GitHub App live profile, skipped LLM live profile, env fallback warning.

`low`

Advisory or informational gap that does not block dry-run use.

## Blocking Levels

`blocks_staging_dry_run`

The dry-run cannot be trusted. Fix before relying on the report.

Examples:

- remote merge enabled
- force push enabled
- branch deletion enabled
- vendor CLI execution enabled
- real MCP transport enabled without readiness
- secret/env exposure detected
- validation command failure

`blocks_staging_deployment`

The dry-run can run, but a staging deployment validation should not proceed.

Examples:

- missing staging Postgres readiness
- missing real secret backend for provider validation
- missing durable observability for operational staging
- required GitHub/LLM live profile gates missing when the dry-run requires them

`blocks_production_only`

Staging dry-run may continue under explicit mock/controlled fallback constraints, but production is blocked.

Examples:

- production auth missing
- policy bundle runtime missing
- mock actor still enabled

`advisory`

Useful follow-up that does not block the dry-run or staging validation.

## Remediation Guidance

Storage:

- Configure Postgres for staging validation.
- Keep DB URLs out of API, health, dashboard, audit, and logs.
- Keep migrations explicit; do not run them from the dry-run.

Secrets:

- Choose and implement a real secret backend or document a controlled non-production fallback decision.
- Keep SecretRefs metadata-only in read models.
- Never expose env or secret values.

Auth:

- Keep mock auth visible as a warning.
- Implement real Auth/RBAC before production or any staging profile that requires real identity validation.

Git:

- Keep remote merge unsupported.
- Keep force push and branch deletion disabled.
- Keep branch/PR operations behind explicit gates, repo allowlists, branch prefix, Auth/RBAC, and Policy.

LLM:

- Keep remote LLM calls gated.
- Require model allowlist, budget cap, fallback disabled, SecretRef/credential gate, Auth/RBAC, and Policy before live tests.
- Do not store raw prompts, raw outputs, API keys, or provider responses.

MCP:

- Keep real MCP transport disabled until policy, SecretRef, sandbox, redaction, and audit readiness exist.

Runner and Local Agent:

- Keep vendor CLI execution and credential-cache reads disabled.
- Keep Local Agent Protocol mock/fixture-only.

Observability:

- Add durable audit/log/metric/trace and alerting readiness before operational staging validation.

Security:

- Treat any secret/env exposure as critical.
- Return only booleans, counts, statuses, ids, severities, and sanitized docs references.
