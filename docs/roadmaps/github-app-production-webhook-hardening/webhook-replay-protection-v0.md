# Webhook Replay Protection v0

Status: planning plus local runtime skeleton. No production-grade distributed replay cache is implemented in v0.

## Delivery ID Strategy

- `X-GitHub-Delivery` is the primary idempotency key.
- Each delivery record stores delivery id, event type, repo ref, action, received timestamp, signature verification status, payload hash, replay status, processing status, attempt count, and sanitized metadata.
- Production requires durable shared storage so API replicas classify the same delivery consistently.

## Payload Hash Strategy

- Store a SHA-256 hash of the raw body used for signature verification.
- Do not store raw payloads.
- A duplicate delivery id with the same payload hash is `duplicate`.
- A duplicate delivery id with a different payload hash is `replay_rejected`.

## Timestamp Tolerance

- v0 documents a 300-second tolerance where sender timestamp metadata is available.
- GitHub delivery id plus signature verification remain required.
- Production should reject stale signed deliveries only after validating clock behavior in the deployed ingress path.

## Duplicate And Replay Behavior

- First seen: process idempotent read-model update.
- Duplicate same hash: ignore read-model mutation and audit duplicate.
- Duplicate different hash: reject and audit `github_webhook_duplicate_rejected`.
- Missing delivery id: reject before processing.

## Persistence Requirements

- The v2 GitHub webhook receiver now uses the current receiver store to classify duplicate delivery ids before mutating read models.
- Production needs durable delivery records and payload hashes.
- Production queue consumers must be idempotent.
- In-memory/local classification is acceptable only for v0 tests, single-process demos, and dashboard/readiness examples.

## Audit Events

- `github_webhook_processed`
- `github_webhook_duplicate_ignored`
- `github_webhook_duplicate_rejected`
- `github_webhook_payload_rejected`

## Test Strategy

- First delivery becomes `first_seen`.
- Same delivery id and hash becomes `duplicate`.
- Same delivery id and different hash becomes `replay_rejected`.
- Read-model upserts are idempotent by repo/PR/branch keys.
- Raw payloads, tokens, webhook secrets, and private keys are absent from delivery records.

## Production Limitations

Replay protection is not production-ready until shared durable state, queue-backed processing, alerting, and operational review tooling exist.
