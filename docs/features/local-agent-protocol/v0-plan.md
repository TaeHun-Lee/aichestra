# Local Agent Protocol v0 Plan

## Current Enterprise Provider Abstraction Status

Enterprise LLM Provider Abstraction v0 is implemented in `packages/llm-gateway/src/enterprise-providers.ts`.
It provides provider kind/auth/catalog models, disabled provider adapters, local CLI metadata templates, provider audit events, output parsing, redaction helpers, API visibility, dashboard visibility, and tests.

`local_cli` provider entries are metadata/templates only. They use `external_cli_session` with `credentialAccess = never_read_tokens`; Aichestra does not read or upload provider credential caches. Current local CLI invocation returns `local_agent_required` or `local_agent_protocol_not_implemented` and never executes a vendor CLI.

## Current Local Agent Boundary Status

Local Agent Runner v1 is implemented as Aichestra's mock/local task-runner boundary. It is not the Aichestra Local Agent daemon. `MockAgentRunner` remains the default, `LocalAgentRunner` is disabled by default, command execution is disabled by default, and fixture-local command execution is only possible behind explicit local test gates.

Enterprise Provider Abstraction v0 defines simple Local Agent boundary metadata (`LocalAgentDescriptor`, `LocalAgentInvocationRequest`, `LocalAgentInvocationResult`, `LocalAgentConsentLevel`), but there is no protocol service, consent lifecycle, mock transport, invocation event store, or API surface dedicated to Local Agent coordination.

## Current Secrets and Sandbox Status

Secrets and Sandbox Design v0 is implemented in `packages/security`. It provides metadata-only `SecretRef`, `SecretScope`, `SecretLease`, `SandboxProfile`, `SandboxSession`, `NetworkEgressPolicy`, `RedactionPolicy`, decisions, audit events, in-memory repositories, API visibility, dashboard visibility, and tests.

It does not retrieve real secrets, inject secrets into processes, run a production sandbox, enforce OS/container network policy, or forward secrets to a Local Agent. Network egress is denied by default, secret leases are not issued by default, and redaction is available for bounded output previews.

## Current Policy-as-code Status

Policy-as-code Skeleton v0 is implemented in `packages/policy`. It uses static deterministic rules and in-memory audit. Defaults deny real provider credential resolution, credential cache reads/uploads, PTY invocation, local CLI shell/file/network access, runner command execution by default, network egress, Local Agent secret forwarding, MCP calls, and improvement apply.

`local_agent.invoke` currently requires approval, while `provider.local_cli.invoke` allows requests to reach the fail-closed Local Agent boundary.

## Why Local Agent Protocol v0 Is Needed

Local CLI providers cannot be run by Aichestra Cloud directly. The user-machine Local Agent boundary needs a safe coordination contract before any future daemon or vendor CLI execution exists.

Local Agent Protocol v0 supplies that contract in mock-first form:

- registration/status/capability metadata;
- invocation envelopes with mock signature status;
- consent request and decision lifecycle;
- deterministic policy, sandbox, network, secret, and redaction decisions;
- normalized stdout/stderr/system event storage;
- in-memory mock transport for tests;
- API/dashboard/audit visibility.

This is intentionally before vendor CLI execution so later work can implement a real transport without changing the safety model or bypassing policy/consent/audit gates.

## Trust Boundaries

- Aichestra Cloud to Local Agent: modeled only; no socket, WebSocket, gRPC, HTTP tunnel, or daemon exists in v0.
- Local Agent to vendor CLI process: future only; no Claude Code, Codex CLI, Gemini CLI, Aider, or other vendor CLI is executed.
- Local Agent to provider credential cache: forbidden; no credential files are read or uploaded.
- Invocation output to Aichestra storage/audit/dashboard: redaction and preview limits apply before storage.
- Secret/sandbox/network policy to invocation: metadata decisions are recorded, but no real secret lease, sandbox runtime, or network enforcement is enabled.

## Protocol Lifecycle

1. Register a Local Agent with status and capabilities.
2. Heartbeat updates `lastSeenAt` and connected state.
3. Create an invocation envelope for a provider, workspace, consent level, sandbox profile, network policy, redaction policy, and secret scopes.
4. Create an invocation in `requested` state.
5. Evaluate policy, consent, sandbox, network, secret, and redaction gates.
6. Move to `awaiting_consent`, `policy_blocked`, `local_agent_unavailable`, or `dispatched`.
7. Mock transport dispatch records deterministic redacted events and can move to `running`.
8. Events are received as normalized stdout/stderr/system records.
9. Completion records redacted output only and moves to `completed` or `failed`.
10. Cancellation is allowed for `dispatched` or `running` invocations only.

## Consent Model

Consent levels:

- `read_only`
- `workspace_write`
- `shell_execution`
- `network_or_secret_access`
- `danger_full_access`

Defaults:

- `read_only` is the only default-allowable level when policy, connected-agent, sandbox, network, secret, and redaction gates are satisfied.
- `workspace_write` requires explicit consent and future policy.
- `shell_execution` is denied by default unless future policy and explicit consent allow it.
- `network_or_secret_access` is denied by default.
- `danger_full_access` is denied by default and cannot be approved in v0.

Consent requests and decisions store metadata only. They do not store raw prompts, secrets, tokens, credential caches, or provider-owned session material.

## Audit Model

Local Agent Protocol v0 records append-only in-memory audit events for registration, heartbeat, revocation, invocation request, policy blocks, awaiting consent, consent requested/approved/denied, dispatch, unavailable agent, received events, completion, cancellation, output redaction, credential cache denial, and direct local CLI execution blocks.

Audit metadata is sanitized and must not include raw secrets, API keys, bearer tokens, OAuth tokens, provider credential cache contents, or raw prompts.

## Mock Transport Strategy

`MockLocalAgentTransport` has no network and executes no commands. It accepts only envelopes that have reached the dispatch boundary and returns deterministic mock stdout/stderr/system events.

If there is no connected mock agent, dispatch returns `local_agent_unavailable`. If consent is required but missing, the invocation remains `awaiting_consent`. If policy denies, it becomes `policy_blocked`.

## What This Task Implements

- Provider-neutral Local Agent protocol models.
- In-memory repositories for registrations, sessions, invocations, consent requests, consent decisions, normalized events, and protocol audit.
- `LocalAgentProtocolService` lifecycle and validation rules.
- `MockLocalAgentTransport`.
- DTO mappers.
- Policy action/rule extensions for Local Agent protocol actions.
- Security integration for sandbox profile, network default deny, secret forwarding denial, and redaction.
- Enterprise Provider Abstraction local CLI integration through protocol decisions.
- API endpoints, health metadata, dashboard visibility, and tests.
- Future Postgres schema skeleton updates only; no Postgres implementation.

## Out of Scope

- Real Local Agent daemon.
- Real WebSocket, gRPC, HTTP tunnel, or network transport.
- Real Claude Code, Codex CLI, Gemini CLI, Aider, or vendor CLI execution.
- PTY terminal automation.
- Remote Git operations.
- Real provider API calls.
- Reading or uploading `~/.codex/auth.json`, `~/.claude`, Google credential caches, OS keychains, or vendor session files.
- Real OAuth, device-code, WIF, IAM, cloud credential exchange, or provider token resolution.
- Real secret injection or Local Agent secret forwarding.
- Production sandbox runtime or OS/container network enforcement.
- `danger-full-access`, yolo, auto-approve-all, or equivalent behavior.

## Future Real Local Agent Plan

1. Add a controlled fixture daemon simulation with loopback-only test transport and no vendor CLI execution.
2. Add signed handshake verification, short-lived task tokens, and device/session revocation.
3. Add compatibility probing that reports CLI availability without reading credentials.
4. Add real transport only behind explicit development gates and integration fixtures.
5. Add user-facing consent UX and organization policy approval workflow.
6. Add production sandbox/egress controls before any real CLI execution.
7. Add vendor CLI execution only after legal/security review and explicit follow-up work.
