# Local Agent Protocol v1 Plan

## Current v0 Behavior

Local Agent Protocol v0 is implemented in `packages/llm-gateway/src/local-agent-protocol.ts`.

Current behavior:

- Local Agent registration, heartbeat, revocation, sessions, capabilities, invocation envelopes, consent requests/decisions, normalized stdout/stderr/system events, in-memory repositories, mock transport, audit events, API endpoints, health metadata, dashboard visibility, provider integration, policy checks, and security/redaction references exist.
- `MockLocalAgentTransport` is in-memory and does not use network or execute processes.
- Enterprise `local_cli` providers flow through `local_agent_required`, `local_agent_unavailable`, `awaiting_consent`, or deterministic `mock_completed`.
- Policy-as-code denies direct local CLI execution, credential cache read/upload, PTY, shell execution, network access, secret forwarding, and danger/full-access by default.
- Secrets/Sandbox v0 provides metadata-only sandbox, network, redaction, and secret-scope boundaries.

v0 does not implement a real Local Agent daemon, WebSocket/gRPC/HTTP tunnel, PTY automation, vendor CLI execution, credential-cache access, credential exchange, real secret injection, production sandboxing, or real provider calls.

## Why v1 Is Needed Before Real Vendor CLI Execution

Before any future local CLI execution can be considered, Aichestra needs a stronger protocol read model for:

- channel establishment and revocation;
- deterministic session expiry;
- capability advertisement and compatibility checks;
- consent queue/history semantics;
- streaming event ordering;
- timeout, cancellation, disconnect, and revoke outcomes;
- audit evidence proving that Cloud did not execute vendor CLIs or read provider-owned credentials.

v1 supplies these controls with deterministic fixture behavior only. It is still not a production Local Agent.

## Trust Boundaries

- Aichestra Cloud may store sanitized protocol metadata, consent records, compatibility results, stream event previews, and audit events.
- Aichestra Cloud must not execute local CLI providers directly.
- The fixture daemon simulation is a local in-memory service object, not a real daemon.
- Local Agent capability advertisements are not permissions. Capability, policy, consent, sandbox, redaction, and compatibility gates must all pass.
- Provider credential cache contents remain outside the Aichestra boundary.
- Secret references and scopes remain metadata only; no secret lease is issued for Local Agent protocol v1.

## Mock Signed Channel Design

v1 adds `LocalAgentChannel` and `LocalAgentHandshake`.

Rules:

- Channel kind is `mock_in_memory` in v1.
- Future `future_websocket`, `future_grpc`, and `future_http_tunnel` kinds are model values only and denied by default.
- Handshake challenge/response is deterministic mock metadata.
- `mock_verified` is not production crypto.
- Expired, revoked, pending, failed, or disconnected channels cannot dispatch invocations.
- Channel and handshake records are sanitized and audited.

## Fixture Daemon Simulation Design

`FixtureLocalAgentDaemon` simulates a user-machine Local Agent in memory.

It can:

- start a fixture agent;
- stop, disconnect, and reconnect the fixture agent;
- establish a mock channel;
- advertise deterministic capabilities;
- receive invocation envelopes;
- emit fixture stdout/stderr/system events;
- simulate normal completion, timeout, parser error, cancellation, disconnect, and policy/consent blocks.

It must not:

- open network sockets;
- spawn processes;
- execute Claude Code, Codex CLI, Gemini CLI, or any vendor CLI;
- read credential caches;
- inject secrets;
- use shell execution.

## Consent Lifecycle Design

v1 extends consent with exact request metadata:

- requested capability set;
- provider id;
- workspace ref;
- consent level;
- timeout;
- safety notes.

Decision values become:

- `approved_once`
- `approved_for_session`
- `denied`
- `expired`

The legacy `approved` value remains accepted as a v0 alias for `approved_once`.

Session approvals expire with the Local Agent session or consent TTL. `danger_full_access` and `network_or_secret_access` are denied regardless of user approval in v1. `shell_execution` remains denied unless a future explicit policy is added. `read_only` is the only default fixture approval path.

## Capability Negotiation Design

v1 adds `LocalAgentCapabilityAdvertisement`.

Advertisements include:

- agent version and platform;
- capability list;
- supported provider template ids;
- supported parser modes;
- supported consent levels;
- supported sandbox kinds;
- max timeout;
- streaming and cancellation support.

Provider invocation checks the latest advertisement. Unsupported parser modes or provider templates block invocation deterministically.

## CLI Compatibility Matrix Design

v1 adds local CLI compatibility metadata:

- `LocalCliCompatibilityEntry`
- `LocalCliCompatibilityResult`

Seed fixture entries:

- Claude headless JSON;
- Claude stream JSON;
- Codex headless;
- Codex JSONL;
- Gemini JSON.

All entries are metadata only. v1 does not run CLI version detection. PTY is recorded as future/unstable and unsupported.

## Streaming Event Lifecycle

v1 adds:

- `LocalAgentInvocationStream`
- `LocalAgentStreamEvent`

Rules:

- Sequences are deterministic and monotonic per stream.
- stdout and stderr remain separate.
- stderr progress does not imply failure.
- Stream completion depends on final event and exit code metadata.
- Payload previews are redacted and size-limited before storage.
- Raw unredacted output is not stored.

## Disconnect, Revoke, Timeout, and Cancel Behavior

Required deterministic outcomes:

- disconnected agent before dispatch -> `local_agent_unavailable`;
- disconnected agent during running -> `failed` with `local_agent_disconnected`;
- timeout -> `timed_out`;
- cancel before dispatch or during streaming -> `cancelled`;
- completed invocation cannot be cancelled;
- revoked agent cannot emit events;
- expired session or channel cannot dispatch.

Each outcome records a Local Agent protocol audit event.

## Safety Rules

- No real Local Agent daemon.
- No WebSocket, gRPC, HTTP tunnel, public network transport, or PTY automation.
- No vendor CLI execution.
- No OpenAI, Anthropic, Gemini, Bedrock, LiteLLM, MCP, Vault, Kubernetes, Temporal, GitHub, GitLab, Bitbucket, or artifact registry calls.
- No provider credential file reads.
- No credential cache upload.
- No OAuth/device-code/WIF/IAM/cloud credential exchange.
- No real secret injection.
- No remote Git operation.
- No danger-full-access, yolo, auto-approve-all, or equivalent behavior.

## What v1 Implements

- Mock signed channel and handshake models.
- Fixture local agent daemon simulation.
- Capability advertisement and negotiation.
- Local CLI compatibility matrix and deterministic compatibility checks.
- Extended consent decision/read-model behavior.
- Invocation stream and stream events.
- Timeout, cancellation, disconnect, revoke, channel, and session expiry outcomes.
- API, dashboard, health, policy, security, provider, audit, DTO, docs, and schema skeleton updates.

## Out of Scope

- Real daemon process.
- Real transport or public network protocol.
- Production cryptography.
- Real vendor CLI execution.
- Real provider calls.
- Real CLI version detection.
- PTY terminal automation.
- Credential cache reads/uploads.
- Real secrets, secret forwarding, or secret leases for Local Agent.
- Production auth/RBAC.
- Persistent Postgres implementation for protocol v1 repositories.

