# Persistent DB Index Review v1

Status: planning/readiness only. No migration is applied by this document.

## Review Rules

- Index changes must be additive and reviewed with query plans before production.
- High-growth tables should prefer time-aware indexes and future partition plans.
- No index recommendation should require raw secrets, raw webhook payloads, raw prompts, or unredacted tool output.
- Existing schema status refers to `infra/migrations/0001_initial_aichestra_schema.sql`.

| Table | Query Pattern | Recommended Index | Uniqueness | Retention / Partitioning Notes | Status |
|---|---|---|---|---|---|
| `tasks` | Dashboard and API lists by repo/status/time. | `(repo_id, status, created_at DESC)` | none | Project lifetime; no partitioning in v1. | recommended |
| `task_runs` | Attempts by task, active runs by status. | `(task_id, attempt)` unique; `(status, created_at DESC)` | `(task_id, attempt)` implemented | Retain with task history. | partial |
| `usage_ledger_entries` | Usage by task/run/user/provider/time. | `(user_id, created_at DESC)`, `(repo_id, created_at DESC)` | id primary key | High-growth billing/audit table; future time partition. | recommended |
| `branch_leases` | Active lease scans by repo/status/expiry. | `(repo_id, status, expires_at)` | future active-branch uniqueness if needed | Retain with task/PR evidence; future expiry status updates must be non-destructive. | recommended |
| `conflict_risks` | Risk history by repo/task pair/score/time. | `(repo_id, created_at DESC)`, `(source_task_run_id, target_task_run_id)` | id primary key | Recomputable snapshots may later use retention policy, not v1 deletion. | future |
| `merge_queue_entries` | Queue scans by repo/status/priority. | `(repo_id, status, priority)` | future active lease queue uniqueness if needed | Retain with PR/task history. | recommended |
| `repos` | Lookup provider/owner/name and active repos. | `(provider, owner, name)` unique future, `(provider, status)` | future provider/owner/name unique | Project lifetime. | partial |
| `pull_requests` | PR lookup by task/repo/provider external id. | `(provider, external_id)`, `(repo_id, status)` | provider/external id should be unique when present | Retain with task/PR history. | partial |
| `git_webhook_events` | Delivery lookup, repo/status lists, event/time lists. | `delivery_id` unique future or dedicated delivery table; `(event_type, received_at DESC)` | production replay needs unique delivery id | High-growth; future time partition. Raw payloads forbidden. | partial |
| `github_webhook_delivery_records` | Future replay store by delivery id/payload hash/status. | `delivery_id` unique, `(processing_status, received_at DESC)`, `(repo_ref, received_at DESC)` | `delivery_id` unique | Future table; metadata/hash only. | future |
| `github_webhook_dead_letter_records` | Dead-letter review by delivery/event/retryable/time. | `(delivery_id)`, `(retryable, created_at DESC)`, `(event_type, created_at DESC)` | id primary key | Future sanitized preview only; no raw payload. | future |
| `git_pull_request_sync_states` | PR sync by repo ref and PR number. | `(repo_ref, pull_request_number)` unique; `(task_id, task_run_id)` | implemented | Retain with PR/task history. | implemented_in_schema |
| `git_branch_sync_states` | Branch sync by repo ref/branch and existence. | `(repo_ref, branch_name)` unique; `(repo_ref, exists)` | implemented | Branch deletion is metadata only; no remote deletion. | implemented_in_schema |
| `skills` | Resolve active/approved/eval-passed packages. | `(status, approval_status, eval_status)`, `(name, version)` unique | implemented | Registry lifetime. | implemented_in_schema |
| `harnesses` | Resolve active/approved/eval-passed harnesses. | `(status, approval_status, eval_status)`, `(name, version)` unique | implemented | Registry lifetime. | implemented_in_schema |
| `instructions` | Resolve by status/checksum/scope. | `(status, approval_status, eval_status, checksum_status)`, `(name, version)` unique | implemented | Registry lifetime. | implemented_in_schema |
| `registry_audit_logs` | Audit by target, actor, action, time. | `(target_kind, target_id)`, `(actor_id)`, `(created_at DESC)` | append-only id | Compliance retention; future partition if volume grows. | partial |
| `registry_revisions` | Revision restore by target/revision. | `(target_kind, target_id, revision_number)` unique | implemented | Append-only registry lifetime. | implemented_in_schema |
| `llm_routing_decisions` | Future route decision audit by request/provider/model/time. | `request_id`, `(selected_provider_id, created_at DESC)`, `(decision, created_at DESC)` | request id unique future | Future sanitized metadata only; no prompts/outputs/secrets. | future |
| `llm_audit_events` | LLM audit by task/run/provider/model/time. | `(task_id, task_run_id)`, `(provider_kind, model_id)`, `(created_at DESC)` | id primary key | High-growth audit; future partition. | partial |
| `mcp_invocations` | Future invocation by server/tool/status/time. | `(tool_id, status, created_at DESC)`, `(server_id, created_at DESC)` | request id unique future if correlated | Future sanitized previews only. | future |
| `mcp_audit_events` | Future audit by event/server/tool/actor/time. | `(event_type, created_at DESC)`, `(tool_id, created_at DESC)`, `(actor_id, created_at DESC)` | id primary key | Compliance retention. | future |
| `policy_decision_audit_entries` | Policy decisions by id/action/actor/task/time. | `policy_decision_id`, `(action, created_at)`, `(actor_id, created_at)`, `(task_id, task_run_id)` | implemented | Append-only compliance retention. | implemented_in_schema |
| `credential_handles` | Future metadata-only credential handle lookup. | `(secret_ref_id, status)`, `(secret_kind, status)`, `expires_at` | id primary key | Short-lived evidence; no raw credential values. | future |
| `secret_access_decisions` | Secret decisions by ref/scope/actor/task/time. | `(secret_ref_id, created_at)`, `(scope_id, created_at)`, `(actor_id, created_at)`, `(task_id, task_run_id)` | implemented | Compliance retention. | implemented_in_schema |
| `auth_audit_events` | Future auth audit by actor/principal/action/request/time. | `(event_type, created_at DESC)`, `(actor_id, created_at DESC)`, `request_id` | id primary key | Long-lived compliance retention; no tokens/cookies/passwords. | future |
| `security_audit_events` | Security audit by event/target/actor/task/time. | `(event_type, created_at)`, `(target_kind, target_id)`, `(actor_id, created_at)`, `(task_id, task_run_id)` | implemented | Long-lived compliance retention. | implemented_in_schema |
| `observability_audit_events` | Future common audit envelope query by category/outcome/severity/correlation/time. | `(category, created_at DESC)`, `(outcome, created_at DESC)`, `(severity, created_at DESC)`, `(task_id, task_run_id)`, `correlation_id` | id primary key | Future high-growth table; partition by created_at and retention class. | future |
| `local_agent_invocations` | Invocation state by envelope/status/time. | `(envelope_id)`, `(state, created_at)` | implemented | Retain with task/run history. | implemented_in_schema |
| `local_agent_stream_events` | Stream event list by stream/invocation/sequence/time. | `(stream_id, sequence)`, `(invocation_id, sequence)` | sequence unique per stream future | High-growth bounded previews only. | partial |
| `deployment_readiness_tables` | Future runtime-admin readiness records if made mutable. | profile/status/severity indexes | id primary key | Current data is deterministic seed/read-only, so no table is required. | future |

## Required Follow-Up Before Production

- Verify every implemented/recommended index against actual dashboard/API query plans.
- Add migration history and migration lock strategy before any production release job.
- Decide whether `git_webhook_events.delivery_id` becomes unique or whether a dedicated `github_webhook_delivery_records` table owns replay uniqueness.
- Add time partition strategy for audit/event tables before high-volume usage.
- Keep all changes additive and non-destructive.
