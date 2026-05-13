# Observability And Audit Plan v0

## Status

Observability / Audit Retention v0 foundation is implemented in `docs/foundations/observability-audit-retention/v0.md` and `packages/observability`.

This roadmap document remains a production-readiness plan. The v0 implementation reduces schema, taxonomy, redaction, retention, API, and dashboard gaps, but production observability is still not implemented.

## Implemented Foundation

- Common `AuditEventEnvelope` taxonomy.
- Retention classes and read-only retention policies.
- Redaction classes and audit sanitizer.
- In-memory `ObservabilityService` aggregation over existing audit sources.
- Audit source coverage inventory.
- Metric definitions and deterministic metric snapshots.
- Trace-span and correlation-context skeleton models.
- Read-only `/observability/*` endpoints.
- Dashboard Observability panel.
- No-secret/no-token/no-raw-payload tests.

## Log Categories

Future structured logs should cover:

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

v0 normalizes these categories:

- Auth/RBAC decisions.
- Policy decisions.
- Credential resolution and SecretRef decisions.
- Git operations and webhook processing.
- LLM route/completion/budget/credential events.
- MCP catalog/invocation/block events.
- Sandbox/network/redaction decisions.
- Runner and Local Agent lifecycle/consent events.
- Registry and governance mutations.
- Deployment readiness blocker context.

## Metrics

Implemented v0 metrics are deterministic read models, not backend time series:

- total audit events;
- denied/blocked/failed counts;
- security-relevant event counts;
- audit source coverage;
- retention policy count;
- external exporter enabled flag, always `0`.

Future production metrics should add API request count/error/latency, worker queue depth, run duration, retry count, policy/auth denial counts, secret resolution allow/deny counts, Git webhook verification counts, LLM cost/provider error counts, MCP invocation counts, runner command blocked/timeout counts, Local Agent connection/consent counts, audit export lag, and retention partition size.

## Traces

v0 defines `TraceSpan` and `CorrelationContext` read models only. Future distributed traces should propagate:

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

There is no OpenTelemetry backend or collector in v0.

## Retention Classes

Implemented classes:

- `short_debug`
- `operational`
- `security`
- `compliance`
- `ephemeral`

v0 only models TTL and export/delete posture. It does not delete audit data, partition storage, apply legal holds, or export records.

## Redaction Strategy

v0 redacts bearer tokens, API-key-like strings, GitHub tokens, webhook secrets, env dumps, provider tokens, credential cache paths, password-like fields, raw prompts, and raw tool input. Output and prompt-related sources use redacted preview classes.

Tests verify no raw secrets in the envelope, observability API, and dashboard read models.

## Operational Dashboards

The current dashboard adds an Observability panel for audit summary, source coverage, retention/redaction summaries, metric snapshot, trace skeleton summary, observability readiness blockers, and no-secret status.

Future production dashboards still need API health/error rates, workflow throughput/failures, webhook delivery status, LLM cost/provider errors, MCP risk and block rates, secret resolution and policy denial rates, Local Agent connection/consent, audit export lag, and retention health.

## Alerts

No real alert delivery is implemented.

Future alerting should cover API error rate/latency, worker backlog, migration failures, Postgres health, secret backend failures, auth provider failures, policy bundle failures, webhook verification spikes, LLM provider error/cost spikes, MCP high/critical invocation attempts, and audit export lag.

## Audit Export Requirements

No audit export is implemented in v0.

Future export must:

- export sanitized append-only audit records;
- preserve actor/principal/team/request correlation;
- support retention class tagging;
- support tenant/org filtering once tenant isolation exists;
- support replay-safe export checkpoints;
- avoid raw secrets, raw prompts, raw payloads, and credential cache content.

## Future OpenTelemetry Plan

Adopt OpenTelemetry-compatible logs, metrics, and traces only after production profile boundaries exist. Initial future work should use local exporters and tests without sending data to external backends by default.

Production remains blocked until structured logs, durable metrics/traces, alerting, audit export, retention enforcement, tenant scoping, and secure backend credentials are implemented.
