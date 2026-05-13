# Observability / Audit Retention v0 Plan

## Chosen Docs Path

`docs/README.md` keeps timeless cross-cutting architecture under `docs/foundations/` and production-readiness plans under `docs/roadmaps/production-deployment-readiness/`. Observability / Audit Retention v0 defines shared audit, retention, redaction, metric, trace, and dashboard read-model foundations, so the canonical implementation plan lives at:

```text
docs/foundations/observability-audit-retention/v0-plan.md
```

Production-readiness roadmap documents will be updated to reference this foundation. No critical validation blockers were found, so implementation can proceed.

## Current Audit Sources By Module

| Module | Current audit source | Current storage | Notes |
|---|---|---|---|
| Core workflow/store | `AuditLog` | `InMemoryAichestraStore.auditLogs` | Generic task/Git-style audit log. |
| Auth/RBAC | `AuthAuditEvent` | `InMemoryAuthRepository` | Mock auth and authorization decisions. |
| Policy | `PolicyDecisionAuditEntry` | `PolicyService` in-memory audit repository | Static policy decisions. |
| SecretRef/Credentials and Secrets/Sandbox | `SecurityAuditEvent` | `SecurityControlService` in-memory repositories | Credential, secret, sandbox, network, and redaction events. |
| Git | generic Git `AuditLog` | `InMemoryAichestraStore.auditLogs` | `GitIntegrationService` stores `git.*` actions. |
| GitHub webhook | `GitWebhookAuditEvent` plus mirrored generic Git audit | `InMemoryAichestraStore.gitWebhookAuditEvents` and generic audit | Webhook payloads are hashed/sanitized, not stored raw. |
| LLM Gateway | `LLMAuditEvent` | `LLMGatewayService` in-memory audit repository | Mock and gated OpenAI-compatible path audit. |
| MCP Gateway | `MCPToolAuditEvent` | `InMemoryMCPToolAuditRepository` | Mock-first tool audit with redacted metadata. |
| Runner | `AgentRunAuditEvent` | `InMemoryAgentRunAuditRepository` | Mock/local runner lifecycle and command gate audit. |
| Registry | `RegistryAuditLogEntry` | registry audit repository | Registry mutations and local package imports. |
| Improvement Governance | `ImprovementGovernanceAuditEvent` | improvement governance in-memory repository | Proposal decisions, eval metadata, canary/apply gates. |
| Local Agent Protocol | `LocalAgentProtocolAuditEvent` | local-agent protocol in-memory repository | Mock channel, consent, invocation, stream, redaction, cache-denial events. |
| Enterprise provider abstraction | `ProviderAuditEvent` | provider audit repository | Provider catalog/blocked invocation/local-agent-required metadata. |
| Deployment readiness | readiness checks and production risks | seeded read-only service | Not an audit stream; useful for observability blockers and dashboard context. |

## Current Logging, Health, And Readiness Surfaces

- `GET /health` reports storage, Git, LLM, runner, policy, auth, provider abstraction, Local Agent, MCP, deployment readiness, and security status using booleans/counts only.
- Module-specific audit endpoints exist: `/auth/audit`, `/policy/audit`, `/security/*/audit`, `/git/audit`, `/git/github/webhooks/audit`, `/llm/audit`, `/mcp/audit`, `/agents/runs/:id/audit`, `/registry/audit`, `/improvements/governance-audit`, `/local-agents/audit`, and `/providers/audit`.
- `GET /audit-logs` exposes the legacy generic store audit log.
- `GET /readiness/deployment/*` exposes static planning models only; no live infrastructure checks run.
- There is no production logging pipeline, metrics backend, tracing backend, audit export, alert delivery, or retention deletion job.

## Current Dashboard Read Model Behavior

Dashboard API-backed Read Model v0 builds read-only sections from existing service/repository state. It does not run workflows, call providers, request secret leases, invoke MCP tools, execute runner commands, create Local Agent fixture invocations, or read credential caches.

Current `/dashboard/audit` groups module-specific audit lists but does not normalize them into a common taxonomy. Existing dashboard sanitization masks token-like strings, env dumps, and credential cache paths.

## Production Readiness Blockers

Production Deployment Readiness Planning v0 identifies these observability and audit blockers:

- no structured log schema, metric names, trace spans, correlation propagation standard, operational dashboards, alerting backend, or SLOs;
- audit events are spread across module repositories with no common envelope;
- no retention classes, export controls, partitioning, legal hold, data residency, or deletion workflows;
- many audit stores remain in-memory;
- no production audit export or observability backend exists.

This v0 reduces schema/read-model gaps but does not remove production blockers.

## Proposed Common Audit Taxonomy

`AuditEventEnvelope` will normalize module-specific events with:

- category: `auth`, `policy`, `credential`, `git`, `git_webhook`, `llm`, `mcp`, `runner`, `registry`, `improvement`, `local_agent`, `security`, `dashboard`, `system`;
- severity: `debug`, `info`, `warning`, `error`, `critical`;
- outcome: `success`, `denied`, `blocked`, `failed`, `skipped`, `unknown`;
- correlation dimensions: actor, principal, auth mode, request id, correlation id, task id, task run id, agent run id, repo id, provider id/kind, model id, tool id, secret ref id, policy decision id;
- source module, retention class, redaction class, sanitized summary, and sanitized metadata.

Module-specific audit stores will be adapted into envelopes rather than physically migrated in v0.

## Proposed Retention Class Model

`AuditRetentionClass` names:

- `short_debug`: short-lived debug/demo metadata;
- `operational`: medium-lived operational audit and status records;
- `security`: long-lived security-relevant events;
- `compliance`: long-lived compliance/governance records;
- `ephemeral`: derived metrics/traces that can be rebuilt.

`AuditRetentionPolicy` will describe expected TTL/export/deletion posture. v0 models retention only and will not delete data.

## Proposed Redaction Class Model

`AuditRedactionClass` names:

- `public_metadata`
- `internal_metadata`
- `sensitive_metadata`
- `secret_adjacent`
- `contains_user_content_redacted`
- `never_store_raw`

The audit sanitizer must run before envelope creation and must mask API keys, GitHub tokens, webhook secrets, bearer tokens, JWT-like strings, env dumps, credential cache paths, password/session/JWT secret fields, raw prompts/tool input, and large metadata.

## Proposed Metric And Trace Skeleton

Metric v0 will define in-memory/read-only skeletons:

- total audit events;
- denied/blocked/failed counts by category;
- security-relevant recent events;
- source coverage counts;
- retention policy counts;
- external exporter enabled status, always `0` in v0.

Trace v0 will define `TraceSpan` and `CorrelationContext` read models only. Spans may be derived from normalized audit events with request, correlation, task, run, or provider ids. No OpenTelemetry backend or exporter will be added.

## Proposed API And Dashboard Additions

Read-only API endpoints:

- `GET /observability/audit/events`
- `GET /observability/audit/summary`
- `GET /observability/audit/retention-classes`
- `GET /observability/audit/redaction-classes`
- `GET /observability/audit/sources`
- `GET /observability/metrics`
- `GET /observability/metrics/snapshot`
- `GET /observability/traces`
- `GET /observability/config`

Dashboard additions:

- `/dashboard/observability`
- audit summary by category/outcome/severity;
- recent denied/blocked/security events;
- retention and redaction summaries;
- metric snapshot and trace summary;
- audit source coverage;
- production readiness blockers related to observability;
- explicit no-secret status.

## No-Secret / No-Token Requirements

- No raw secrets, tokens, webhook secrets, provider API keys, credential cache contents, raw payloads, unredacted prompts, or unredacted outputs may be stored in the envelope or dashboard read model.
- `sanitizedMetadata` must be sanitized and size-limited before storage/return.
- Credential cache references such as `~/.codex/auth.json`, `~/.claude`, Google credential cache paths, and application-default-credential paths must be masked.
- Secret-like env names may appear as names only when useful, never with values.

## What This Task Implements

- `@aichestra/observability` provider-neutral models, sanitizer, seed classes/policies, adapter functions, read-only service, DTOs, metrics, traces, and source coverage.
- Read-only `/observability/*` API endpoints.
- Dashboard API/demo read models and rendering for an Observability panel.
- Audit source inventory and v0 documentation.
- Updates to production readiness, roadmap, runtime inventory, environment gate matrix, phase audit, README, docs README, and AGENTS guidance.
- Deterministic tests for envelopes, normalization, sanitizer, retention policies, APIs, dashboard, metrics/traces, and no-secret guarantees.

## Out Of Scope

- No Datadog, Grafana, Prometheus, Loki, CloudWatch, OpenTelemetry Collector, Jaeger, Honeycomb, Sentry, Splunk, SIEM, or external observability integration.
- No external audit export.
- No real alert delivery.
- No production log pipeline.
- No retention deletion jobs.
- No production data deletion, partitioning, legal hold, tenant scoping, or export workflow.
- No weakening of Auth/RBAC, Policy, SecretRef, Git, LLM, MCP, Local Agent, Runner, Dashboard, or Secrets/Sandbox gates.
