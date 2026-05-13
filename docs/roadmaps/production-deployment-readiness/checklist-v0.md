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

- Secret Backend Migration Planning v0 read-only models, docs, APIs, health metadata, and dashboard panel implemented.
- SecretRef source migration from env provider to Vault or cloud secret manager remains future.
- Secret rotation workflow planned; production jobs are not implemented.
- Lease TTL strategy defined as planning metadata; backend enforcement remains future.
- Legacy env fallback modeled as rejected in production profile; live production enforcement remains future.
- No raw secret exposure in health, dashboard, logs, audit, errors, or readiness output.
- Credential cache reads remain denied.

## Database

- Production Postgres required.
- Persistent DB Production Operations v1 read-only planning implemented; production DB operations are not production-ready.
- Connection pooling selected and implemented behind the storage provider boundary.
- Migrations run through release-controlled migration job with migration lock, checksum review, and pre/post checks.
- Backup schedule and restore test process defined and tested.
- Retention classes defined and durable table strategy aligned with Observability / Audit Retention v0.
- Index review completed for task, audit, webhook, registry, LLM, MCP, Local Agent, auth, security, and policy tables.
- Migration rollback plan documented and tested.
- Webhook replay/dedupe/dead-letter persistence implemented before production webhooks.
- Health, readiness, and dashboard expose only booleans/counts/status, never DB URL values.

## Git Integration

- GitHub App vs token strategy selected for planning: GitHub App / Production Webhook Hardening Planning v0 is implemented, but no live GitHub App integration exists.
- GitHub App permission matrix reviewed; workflows, administration, secrets, and deployments denied by default.
- GitHub App private key and webhook secret SecretRef plan documented; production requires a real secret backend before use.
- Repo allowlist and branch prefix enforced.
- Webhook signature verification required.
- Webhook event allowlist documented.
- Webhook delivery replay/idempotency planned; durable shared storage remains unimplemented.
- Auto-merge remains disabled until explicit future approval.
- Production webhook endpoint hardening planned; endpoint is not production-ready.
- Rate limit, retry, and dead-letter behavior planned; no background retry worker exists.

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

- Common audit taxonomy implemented for v0 read models.
- Retention classes and redaction classes implemented for v0 read models.
- Audit source inventory maintained.
- Structured logs defined for production.
- Metrics defined; v0 metric skeleton implemented without external exporter.
- GitHub webhook hardening metric definitions added for deliveries, verification, rejection, duplicate, dead-letter, sync success/failure, rate-limit warnings, and latency.
- Tracing defined; v0 trace skeleton implemented without OpenTelemetry backend.
- Audit exports defined.
- Alerts and SLOs defined.
- Operational dashboards defined; v0 Observability dashboard panel implemented.
- Correlation ids propagated where available and surfaced by common audit envelope.
- Production retention jobs, legal hold, and external audit export remain unimplemented.

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
