# Webhook Retry And Dead-Letter v0

Status: planning-only. No background retry worker is implemented in v0.

## Retryable Errors

- transient storage failure
- queue unavailable
- rate-limit read-model refresh
- temporary policy bundle unavailable
- temporary downstream read-model write conflict

## Non-Retryable Errors

- invalid signature
- missing required headers
- repo not allowlisted
- malformed payload
- unsupported event
- policy denied
- replay rejected because delivery id reused with a different payload hash

## Dead-Letter Record

`GitHubWebhookDeadLetterRecord` stores:

- id
- delivery id
- event type
- repo ref, if known
- reason
- sanitized payload preview, optional
- retryable flag
- created timestamp
- metadata

It must not store raw payloads, private keys, webhook secrets, installation tokens, provider tokens, or credential cache paths.

## Retry Policy

- Max retry attempts: 5.
- Planned backoff: exponential backoff with jitter in a future worker.
- Current v0: read-only model and deterministic seed records only.

## Manual Replay Review

Operators should review sanitized dead-letter metadata, delivery id, event type, repo ref, payload hash, retry count, and audit event ids before any future replay. Replays must remain policy-gated and idempotent.

## Audit And Metrics

Audit:

- `github_webhook_dead_lettered`
- `github_webhook_duplicate_rejected`

Planned metrics:

- `github.webhook.dead_letters`
- `github.webhook.retry_attempts`
- `github.webhook.processing_latency_ms`

## Production Notes

Production requires queue storage, retry worker ownership, poison-message handling, dashboard review tooling, and alerting. v0 does not deliver alerts or replay messages.
