# Observability And Audit Plan v0

Planning only. No observability backend is implemented.

## Log Categories

- API request logs: method, path template, status, request id, actor id, principal id, latency.
- Workflow logs: task id, task run id, transition, runner kind, retry metadata.
- Provider boundary logs: provider id/kind, operation, status, policy decision id, credential source status.
- Git webhook logs: delivery id, event type, repo ref, verification status, processing result.
- LLM routing logs: route id, provider kind, model id, budget decision id, fallback attempt.
- MCP logs: server id, tool id, risk level, status, policy/auth decision ids.
- Local Agent logs: agent id, channel id, invocation id, consent status, stream status.
- Security logs: SecretRef id, credential resolution status, sandbox/network/redaction status.

No log category may include raw secrets, tokens, provider API keys, raw prompts, unredacted outputs, credential cache content, or raw webhook payloads.

## Audit Event Categories

- Auth/RBAC decisions.
- Policy decisions.
- Git operations and webhook processing.
- LLM route/completion/budget/credential events.
- MCP catalog/invocation/block events.
- SecretRef lifecycle and credential resolution.
- Sandbox/network/redaction decisions.
- Runner and Local Agent lifecycle/consent events.
- Registry and governance mutations.
- Deployment readiness profile/check/risk read events may remain access logs only in v0.

## Metrics

- API request count/error/latency by route and status.
- Worker queue depth, run duration, retry count, failure count.
- TaskRun status counts.
- Policy allow/deny counts by action.
- Auth denial counts by actor kind.
- Secret resolution allow/deny/missing/revoked counts.
- Git webhook verification/process counts.
- LLM usage, cost, route selection, fallback, provider error counts.
- MCP invocation completed/blocked counts by risk level.
- Runner command blocked/timeout counts.
- Local Agent connected/disconnected/consent counts.
- Audit export lag and retention partition size.

## Traces

Future traces should propagate:

- request id
- correlation id
- task id
- task run id
- repo id
- provider id
- model id
- MCP server/tool id
- policy decision id
- authorization decision id
- credential resolution id

## Retention Classes

- Operational logs: short retention.
- Debug traces: short retention.
- Provider request metadata: bounded retention, sanitized.
- Audit events: long-lived compliance retention.
- Security audit events: long-lived compliance retention.
- Redacted runner/provider output previews: bounded by redaction policy.

## Redaction Strategy

- Redact bearer tokens, API-key-like strings, env dumps, provider tokens, credential cache paths, and raw secrets.
- Store only previews where output retention is required.
- Keep raw prompts and raw provider output out of audit by default.
- Validate no-secret exposure in tests.

## Operational Dashboards

- API health and error rates.
- Task workflow throughput and failures.
- Git webhook delivery status and replay backlog.
- LLM cost and provider error dashboards.
- MCP tool risk and block dashboards.
- Secret resolution and policy denial dashboards.
- Local Agent connection/consent dashboard.
- Audit export and retention dashboard.

## Alerts

- API error rate and latency.
- Worker queue backlog.
- Migration failure.
- Postgres connectivity/replication/storage.
- Secret backend failure.
- Auth provider failure.
- Policy bundle load failure.
- GitHub webhook verification failures spike.
- LLM provider error/cost spike.
- MCP high/critical invocation attempt.
- Audit export lag.

## Audit Export Requirements

- Export sanitized append-only audit records.
- Preserve actor/principal/team/request correlation.
- Support retention class tagging.
- Support tenant/org filtering once tenant isolation exists.
- Support replay-safe export checkpoints.

## Future OpenTelemetry Plan

Adopt OpenTelemetry for logs, metrics, and traces after production profile boundaries exist. The first implementation should instrument local exporters and tests without sending data to external backends by default.
