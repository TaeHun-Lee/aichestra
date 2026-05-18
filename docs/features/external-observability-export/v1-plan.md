# External Observability Export v1 Plan

## Chosen Docs Path

`docs/README.md` keeps feature-specific versioned work under `docs/features/<slug>/`. External Observability Export v1 is a new observability feature layered on the existing Observability / Audit Retention v0 foundation, so the canonical plan lives at:

```text
docs/features/external-observability-export/v1-plan.md
```

No critical validation blockers were found. The current codebase already has safe in-memory observability read models, audit query scope checks, redaction helpers, and dashboard/API conventions that can host a disabled exporter skeleton without sending data externally.

## Current Observability / Audit Retention v0 Behavior

Observability / Audit Retention v0 is implemented as a mock-first, read-only foundation in `packages/observability`. It normalizes current module audit sources into common `AuditEventEnvelope` read models, exposes deterministic metric snapshots and trace skeletons, and feeds read-only `/observability/*` and `/dashboard/observability` surfaces.

Runtime behavior is in-memory/derived. There is no production observability backend, alert delivery, audit export checkpoint, retention deletion job, or OpenTelemetry exporter. Existing metrics include `observability.external_exporter.enabled = 0`.

## Current Audit Envelope Behavior

The common audit envelope stores sanitized metadata only:

- category, severity, outcome, source module, event type, and timestamps;
- actor, principal, service account, request, correlation, task, run, repo, provider, model, tool, SecretRef, policy decision, and scope metadata when source events carry it;
- retention and redaction classes;
- sanitized summary and sanitized metadata.

The envelope does not include raw payloads, raw prompts, raw provider responses, provider tokens, webhook secrets, credential cache contents, cookies, sessions, database URLs, or raw credential material.

## Current Redaction And Retention Behavior

Retention classes are metadata only: `short_debug`, `operational`, `security`, `compliance`, and `ephemeral`. Current retention policies use `deletionMode = none`; no deletion or legal-hold workflow runs.

Redaction classes are enforced by sanitizers before read-model output. Existing sanitizers mask API-key-like strings, bearer tokens, GitHub tokens, webhook secrets, JWT-like strings, env dumps, credential cache paths, password/session/JWT secret fields, raw prompts, and raw tool input. Metadata and strings are size-limited.

## Current Tenant And Audit Scope Behavior

Tenant/Repo/Provider Scope Model v1 provides safe tenant/team/project/repo/provider/model/SecretRef/MCP/registry/local-agent/audit-query metadata. Tenant Scope Enforcement v1 is partial representative scaffolding only and does not implement production tenant filtering.

Audit Query Scope Enforcement v1 is check/redaction-only. It can allow summary/metadata/detail with redaction or deny raw-payload requests, but it does not implement production audit query storage security, row-level filtering, external SIEM export, sessions, JWTs, API keys, service-account credentials, or production Auth/RBAC.

## Proposed External Exporter Skeleton

External Observability Export v1 will add a disabled-by-default exporter planning and boundary layer:

- exporter provider options and configuration metadata;
- safe export envelope schema over audit, metric, trace, readiness, and future policy-shadow records;
- safety checks for disabled defaults, no raw payload, no secret fields, no env values, redaction, tenant scope, retention class, endpoint hiding, and auth hiding;
- `ObservabilityExporter` interface;
- `DisabledObservabilityExporter`;
- deterministic `MockObservabilityExporter` for tests only;
- future exporter config rows for production backends, all `future` or `not_configured`;
- read-only/check-only API and dashboard visibility.

## Candidate Backends

Candidate future backend kinds are metadata only in v1:

- OpenTelemetry future;
- Datadog future;
- Grafana Cloud future;
- CloudWatch future;
- OpenSearch future;
- Splunk future;
- SIEM future;
- S3 future;
- custom future.

V1 will not implement real OpenTelemetry, Datadog, Grafana Cloud, CloudWatch, OpenSearch, Elasticsearch, Splunk, SIEM, S3, GCS, Azure Monitor, Honeycomb, Prometheus Pushgateway, or any other external observability backend.

## Export Safety Constraints

All v1 paths must preserve these constraints:

- external export disabled by default;
- external calls disabled by default;
- endpoint values not exposed;
- auth values not exposed;
- raw payload export forbidden;
- secret export forbidden;
- env value export forbidden;
- redaction class required;
- retention class required;
- tenant scope required as readiness metadata for future production export;
- no weakening of Auth/RBAC, Policy, SecretRef, tenant scope, dashboard, retention, redaction, audit, or safety gates.

## No-Raw-Payload Policy

`ObservabilityExportEnvelope.rawPayloadIncluded` must stay false. The export envelope may carry only a bounded `payloadSummary` and sanitized metadata. Raw prompts, raw provider responses, webhook payloads, logs, traces, metric payloads, credential material, tokens, cookies, sessions, API keys, Vault secrets, GitHub tokens, webhook secrets, database URLs, and env values must be redacted or rejected by safety checks.

## Readiness, API, And Dashboard Plan

V1 will expose:

- `GET /observability/export/config`
- `GET /observability/export/backends`
- `GET /observability/export/safety-checks`
- `GET /observability/export/summary`
- `POST /observability/export/mock-envelope/check`
- External Observability Export metadata inside `/dashboard/observability`
- health metadata under `/health.observabilityExport` style fields in `/health`

These routes are read-only or check-only. The POST route builds and validates a safe envelope; it does not export anything.

## What This Task Implements

- Exporter provider option and config models.
- Export envelope model.
- Export safety check and readiness summary models.
- Disabled and mock exporter boundary implementations.
- `ExternalObservabilityExportReadinessService`.
- DTO helpers.
- API routes and dashboard/readiness metadata.
- Documentation, reference inventory, environment gate matrix, roadmap, README, and AGENTS updates.
- Deterministic tests for default-disabled behavior, mock metadata-only recording, future backend status, envelope redaction, safety checks, API/dashboard safety, and no-external-call guarantees.

## Out Of Scope

- Real OpenTelemetry exporter.
- External log, metric, trace, or audit event delivery.
- Alerting backend or alert delivery.
- Durable audit export checkpoints.
- Production observability backend.
- Retention deletion or legal hold enforcement.
- Production tenant-scoped export authorization.
- Reading env values or secret values.
- Exporting raw payloads, raw prompts, raw provider responses, logs, traces, credential material, tokens, cookies, session IDs, API keys, Vault secrets, GitHub tokens, webhook secrets, or database URLs.
- Any external call to Datadog, Grafana Cloud, CloudWatch, OpenSearch, Elasticsearch, Splunk, SIEM, S3, GCS, Azure Monitor, Honeycomb, Prometheus Pushgateway, or similar backends.
