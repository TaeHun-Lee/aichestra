# Webhook Persistence v1

Status: planning/readiness only. No production webhook processing, queue worker, replay worker, or dead-letter worker is implemented.

## Current State

Real Git Adapter v2 stores safe webhook metadata in:

- `git_webhook_verification_results`
- `git_webhook_events`
- `git_pull_request_sync_states`
- `git_branch_sync_states`
- `git_webhook_audit_events`

These records avoid raw webhook payload storage and never store webhook secrets, GitHub tokens, private keys, or credential-cache contents.

GitHub App / Production Webhook Hardening Planning v0 defines replay and dead-letter models, but they are planning/read-model data only.

## Future Delivery Record Persistence

Future production persistence should add a dedicated delivery table, currently modeled as `github_webhook_delivery_records_future`, with:

- delivery id;
- event type;
- repo ref;
- action;
- received time;
- signature verified boolean;
- replay status;
- processing status;
- payload hash;
- attempt count;
- last attempt time;
- sanitized metadata.

Raw payloads must not be stored.

## Delivery ID Uniqueness

Production replay protection needs a durable uniqueness constraint on delivery id. The future implementation should choose one of:

- make `git_webhook_events.delivery_id` unique when it becomes the authoritative delivery store;
- add a dedicated `github_webhook_delivery_records.delivery_id` unique constraint and leave `git_webhook_events` as event/read-model metadata.

The dedicated table is preferred for retry/dead-letter state because it separates idempotency from sync read models.

## Payload Hash

Store a SHA-256 payload hash only. Use it to classify:

- first delivery: delivery id not seen;
- duplicate: same delivery id and same payload hash;
- replay rejected: same delivery id and different payload hash.

The hash is metadata, not a payload substitute, and does not justify raw payload retention.

## Duplicate Detection

Duplicates should be idempotently ignored after audit. Read-model upserts must be keyed by stable repo/PR/branch identifiers and should remain non-destructive.

## Replay Rejection

Replay mismatch must be rejected and audited with:

- delivery id;
- event type;
- repo ref when available;
- replay status;
- payload hash comparison metadata;
- reason code.

No agent execution, merge, push, rebase, branch deletion, workflow dispatch, or registry mutation may be triggered by webhook processing.

## Dead-Letter Records

Future `github_webhook_dead_letter_records` should store:

- delivery id;
- event type;
- repo ref;
- reason;
- sanitized payload preview if available and already redacted;
- retryable flag;
- created time;
- metadata.

Dead-letter records must not contain raw payloads, secrets, tokens, signatures, installation tokens, private keys, or credential cache paths.

## Retry Counters And Backoff

Future delivery records should track:

- attempt count;
- last attempt time;
- next eligible retry time;
- retryable vs non-retryable reason;
- final dead-letter reason.

Backoff should be exponential with jitter. v1 does not implement a background retry worker.

## Manual Replay Future Plan

Manual replay must require operator review of sanitized metadata, policy approval, and no raw payload access unless a future secure payload retention design is explicitly approved. Replay remains future work.

## Index Requirements

- `delivery_id` unique.
- `(event_type, received_at DESC)`.
- `(repo_ref, received_at DESC)`.
- `(processing_status, received_at DESC)`.
- `(replay_status, received_at DESC)`.
- Dead-letter `(retryable, created_at DESC)`.

## Retention Requirements

- Delivery metadata: operational retention.
- Replay rejected and dead-letter audit: security retention.
- No raw payload retention.
- Future deletion requires legal hold and retention enforcement controls.

## Observability Metrics

Planned metrics:

- `github.webhook.deliveries.received`
- `github.webhook.deliveries.verified`
- `github.webhook.deliveries.rejected`
- `github.webhook.duplicate_deliveries`
- `github.webhook.dead_letters`
- `github.webhook.processing_latency_ms`

No metrics exporter or alert delivery exists in v1.

## Known Limitations

- No durable replay store implementation.
- No production queue.
- No background retry worker.
- No manual replay workflow.
- No production webhook endpoint rollout.
- No real GitHub App credential flow.
