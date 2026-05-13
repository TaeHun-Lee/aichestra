# Retention And Audit Growth v1

Status: planning/readiness only. v1 deletes no data and runs no retention job.

## Scope

This plan aligns Persistent DB operations with Observability / Audit Retention v0. It describes expected table growth, retention classes, future partitioning candidates, and risks. It does not implement deletion, archive, export, legal hold, or partitioning.

## Expected High-Growth Tables

- `usage_ledger_entries`
- `audit_events`
- `git_webhook_events`
- `git_webhook_audit_events`
- `llm_audit_events`
- future `llm_routing_decisions`
- future `mcp_invocations`
- future `mcp_audit_events`
- `policy_decision_audit_entries`
- `security_audit_events`
- `registry_audit_logs`
- `improvement_governance_audit_events`
- `local_agent_stream_events`
- `local_agent_protocol_audit_events`
- future `observability_audit_events`
- future `github_webhook_delivery_records`
- future `github_webhook_dead_letter_records`

## Audit Categories

The durable table plan should preserve the common audit categories from Observability / Audit Retention v0:

- auth
- policy
- credential
- git
- git_webhook
- llm
- mcp
- runner
- registry
- improvement
- local_agent
- security
- dashboard
- system

## Retention Classes

- `short_debug`: short-lived debug/demo and redacted preview metadata.
- `operational`: medium-lived operational events such as webhook delivery metadata, sync status, route decisions, and metric snapshots.
- `security`: long-lived security, denied, blocked, replay-rejected, credential, sandbox, and webhook verification events.
- `compliance`: long-lived registry, governance, auth, policy, and system audit evidence.
- `ephemeral`: derived read models that can be rebuilt.

## Partitioning Candidates

Future partitioning should be considered for:

- `audit_events`
- future `observability_audit_events`
- `git_webhook_events`
- `git_webhook_audit_events`
- `llm_audit_events`
- future `mcp_invocations`
- future `local_agent_stream_events`
- future `github_webhook_delivery_records`

v1 does not create partitions or live partition maintenance jobs.

## Archive / Export Future Plan

Future archive/export must wait for:

- production Auth/RBAC and tenant scoping;
- real secret backend for export credentials;
- common audit envelope persistence;
- legal hold and redaction controls;
- explicit export approvals;
- audit export checkpoints;
- no raw payload, token, credential cache, or unredacted prompt/output storage.

No SIEM, object storage, or external export integration exists in v1.

## Legal Hold Future Plan

Legal hold should become a first-class control before retention deletion:

- hold records scoped by tenant/org/repo/category/time range;
- retention class override;
- reviewer and audit trail;
- export/download restrictions;
- visible readiness/dashboard status.

No legal hold implementation exists in v1.

## No Deletion In v1

v1 explicitly does not:

- delete audit data;
- prune webhook delivery records;
- remove usage ledger rows;
- drop partitions;
- archive rows externally;
- run scheduled cleanup jobs.

Retention classes remain policy/readiness metadata only.

## Alignment With Observability / Audit Retention v0

Observability v0 defines taxonomy, retention classes, redaction classes, retention policies, metric skeletons, and trace skeletons. Persistent DB Production Operations v1 adds DB planning for making those records durable later, but does not create durable common audit envelope storage.

## Operational Risks

- Audit/event tables grow without partitions or retention enforcement.
- Dashboard/API reads can become expensive without query limits and time filters.
- Webhook replay/dead-letter records need retention that preserves security evidence without retaining raw payloads.
- Usage ledger retention must preserve task/run/provider attribution.
- Legal hold must exist before any production deletion workflow.
