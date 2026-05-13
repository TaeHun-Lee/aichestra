# Production Webhook Endpoint v0

Status: planning-only. No production endpoint is deployed or enabled.

## Endpoint Path

Target path: `/git/github/webhooks`

The existing route remains disabled by default through `AICHESTRA_ENABLE_GITHUB_WEBHOOKS=false`.

## TLS And Ingress

- TLS is required at the public ingress boundary.
- Reverse proxy and load balancer configuration must preserve request body bytes for signature verification.
- Proxy headers must be reviewed before being trusted for audit metadata.

## Raw Body Preservation

- Signature verification must use the exact raw body bytes.
- JSON parsing must happen after signature verification.
- Raw payloads must not be stored after verification and hashing.

## Limits And Rate Controls

- Planned payload size limit: 1 MiB.
- Apply reverse proxy and application rate limits.
- Reject missing delivery id, event name, or signature headers.
- Reject repo refs not covered by installation grants and Aichestra allowlists.

## Idempotency And Queueing

- Delivery id and payload hash are required.
- Production processing should hand off verified deliveries to a durable queue.
- Queue consumers must be idempotent.
- Read-model updates are safe to retry.
- Destructive operations remain forbidden.

## Observability And Alerting

Planned metrics:

- deliveries received, verified, rejected
- duplicate and replay-rejected deliveries
- dead-letter count
- processing latency
- PR/branch sync success and failure

Alerting is future work and no real alert delivery exists in v0.

## Failure Modes

- invalid signature
- missing headers
- payload too large
- repo not allowlisted
- duplicate delivery
- replay rejected
- queue unavailable
- downstream read-model update failure
- dead-lettered processing

## Rollout Plan

1. Deploy endpoint behind TLS with webhooks disabled.
2. Verify raw-body preservation with non-production fixtures.
3. Configure SecretRef-backed webhook secret in a real secret backend.
4. Enable durable delivery id storage and queue-backed processing.
5. Monitor duplicate/dead-letter metrics.
6. Enable production webhooks only after readiness checks pass.
