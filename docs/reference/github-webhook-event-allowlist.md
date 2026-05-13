# GitHub Webhook Event Allowlist

Status: GitHub App / Production Webhook Hardening Planning v0.

Webhook handling remains disabled by default. Current and planned behavior is read-model/audit only. Unsupported events are ignored or denied with audit and must not trigger destructive actions.

| Event | Support status | Actions handled | Signature required | Idempotency key | Side effects | Audit events | Read-model updates | Risk notes |
|---|---|---|---|---|---|---|---|---|
| `ping` | supported_now | all | yes | delivery id | record webhook event and audit | `github_webhook_received`, `github_webhook_processed` | delivery metadata | safe connectivity event only |
| `pull_request` | supported_now | `opened`, `synchronize`, `reopened`, `closed` | yes | delivery id | upsert PR/branch sync metadata | `github_pr_sync_started`, `github_pr_sync_completed`, `github_pr_sync_failed` | PR sync, branch sync, merge-queue risk read model when mapped | no merge, rebase, reviewer request, workflow dispatch, or branch cleanup |
| `push` | supported_now | branch metadata | yes | delivery id | upsert branch sync metadata | `github_branch_sync_started`, `github_branch_sync_completed`, `github_branch_sync_failed` | branch sync state | deleted refs are metadata only; no branch deletion |
| `check_run` | supported_now | read-model metadata only | yes | delivery id | record event and audit | `github_webhook_processed` | future check run status | no workflow action |
| `check_suite` | supported_now | read-model metadata only | yes | delivery id | record event and audit | `github_webhook_processed` | future check suite status | no workflow action |
| `status` | supported_now | read-model metadata only | yes | delivery id | record event and audit | `github_webhook_processed` | future commit status | read-only |
| `pull_request_review` | supported_now | read-model metadata only | yes | delivery id | record event and audit | `github_webhook_processed` | future review status | no reviewer automation |
| `installation` | planned | `created`, `deleted`, `suspend`, `unsuspend` | yes | delivery id | future installation read-model upsert | `github_app_installation_created_future`, `github_app_installation_suspended` | app installation read model | future only; must not issue tokens from webhook processing |
| `installation_repositories` | planned | `added`, `removed` | yes | delivery id | future repo grant read-model update | `github_app_repo_grant_changed` | repository grant read model | future only; still requires Aichestra allowlist and policy |
| `repository` | planned | `created`, `deleted`, `archived`, `renamed`, `transferred` | yes | delivery id | future repo metadata update | `github_webhook_processed` | repository metadata read model | must not delete Aichestra records automatically |
| `workflow_run` | ignored | none | yes | delivery id | record unsupported event audit | `github_webhook_unsupported_event` | none | ignored until explicitly needed; no workflow automation |
| `deployment` | denied | none | yes | delivery id | record denied event audit | `github_webhook_unsupported_event` | none | deployment operations are out of scope |

Rules:

- Signature verification is required for every event before processing.
- Raw payloads and webhook secrets must never be stored or returned.
- Destructive actions must not be triggered from webhook delivery.
- Processing should update read models only in the current design.
- Production requires durable delivery id and payload hash tracking before enabling webhooks.
