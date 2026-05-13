# Production Readiness Checklist v0

This checklist is not a deployment approval. It defines the minimum work needed before Aichestra can be considered production-capable.

## Identity And Access

- Production OIDC or SAML provider selected and implemented.
- SCIM/team sync strategy defined where enterprise directory sync is required.
- RBAC roles reviewed for least privilege.
- Service accounts have scoped identity, rotation, and audit.
- Mock actor and header actor override disabled in production.
- Tenant/team/repo scoping enforced in repositories, policy subjects, APIs, and dashboard read models.
- Audit actor attribution includes request id, actor id, principal id, team ids, and service account id where applicable.

## Secrets

- SecretRef source migrated from env provider to Vault or cloud secret manager.
- Secret rotation workflow defined.
- Lease TTL strategy defined and tested.
- Legacy env fallback rejected in production profile.
- No raw secret exposure in health, dashboard, logs, audit, errors, or readiness output.
- Credential cache reads remain denied.

## Database

- Production Postgres required.
- Connection pooling selected.
- Migrations run through release-controlled migration job.
- Backup schedule and restore test process defined.
- Retention classes defined.
- Index review completed for task, audit, webhook, registry, LLM, MCP, Local Agent, and policy tables.
- Migration rollback plan documented and tested.

## Git Integration

- GitHub App vs token strategy selected.
- Repo allowlist and branch prefix enforced.
- Webhook signature verification required.
- Webhook delivery replay/idempotency implemented.
- Auto-merge remains disabled until explicit future approval.
- Production webhook endpoint hardened.
- Rate limit and retry behavior defined.

## LLM Integration

- Provider allowlist reviewed.
- Model allowlist reviewed.
- Budget limits enforced.
- Usage ledger durable.
- Fallback bounded and audited.
- Prompt/output redaction policy reviewed.
- No uncontrolled provider calls.
- Provider data-retention terms reviewed.

## MCP

- MCP server allowlist defined.
- Tool allowlist defined.
- Tool-level permissions mapped to RBAC and policy.
- High/critical tools denied by default.
- Secret forwarding denied by default.
- All invocations audited with redacted previews.
- Real MCP transport remains disabled until a dedicated future milestone.

## Runner And Local Agent

- Production sandbox strategy selected.
- Workspace isolation enforced.
- Command allowlist reviewed.
- Output limits and redaction enforced.
- Local Agent update strategy defined.
- Consent UX and revocation model implemented.
- Vendor CLI credential cache reads remain denied.

## Policy

- Policy bundle source selected.
- Rule review and approval required.
- Policy tests required.
- Deny-by-default rules preserved.
- Break-glass process defined and audited.
- Policy rollout and rollback defined.

## Observability

- Structured logs defined.
- Metrics defined.
- Tracing defined.
- Audit exports defined.
- Alerts and SLOs defined.
- Operational dashboards defined.
- Correlation ids propagated.

## CI/CD

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `git diff --check` required.
- Node/Volta version aligned with `package.json` engines.
- Optional Postgres test profile added to CI.
- Optional GitHub/LLM/MCP integration profiles remain gated.
- Secret scanning required.
- Dependency scanning required.
- Container build and artifact provenance planned.
- Release and rollback processes documented.

## Security

- Threat model completed.
- Data classification completed.
- Network egress strategy implemented.
- SSRF prevention controls defined.
- Prompt injection mitigations defined for LLM/MCP/runner paths.
- Dependency vulnerability handling defined.
- Incident response and audit export workflow defined.
