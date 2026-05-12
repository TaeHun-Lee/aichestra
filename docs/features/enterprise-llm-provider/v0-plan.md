# Enterprise LLM Provider Abstraction v0 Plan

## Current LLM Gateway v0 Behavior

- `packages/llm-gateway` owns provider-neutral LLM interfaces, `MockLLMProvider`, an OpenAI-compatible skeleton, model catalog, virtual model keys, budget checks, usage ledger writes, and LLM audit events.
- `MockLLMProvider` remains the default.
- `OpenAICompatibleLLMProvider` validates config shape and returns blocked/not-implemented results. It does not make network calls.
- LLM Gateway is already policy-aware through `PolicyService`.

## Current Local Agent Runner v1 Behavior

- `packages/runner` owns Aichestra runner contracts, `MockAgentRunner`, disabled-by-default `LocalAgentRunner`, harness policy, workspace validation, command executor boundaries, instruction assembly, and runner audit.
- Local Agent Runner v1 is Aichestra's local/demo runner layer for task execution and fixture command execution.
- It is not Aichestra Local Agent.

## Why Local Agent Runner Is Not Aichestra Local Agent

- Local Agent Runner runs Aichestra-controlled mock/local task execution inside this app boundary.
- Aichestra Local Agent is a future user-machine daemon/CLI that would broker vendor local CLI providers such as Claude Code, Codex CLI, or Gemini CLI.
- Local Agent Runner must not read vendor credential caches, execute vendor CLIs, or bypass ProviderAdapter and PolicyEngine.

## Current Provider Abstraction Gaps

- LLM Gateway v0 has only model provider kinds such as `mock` and `openai_compatible`.
- There is no enterprise `ProviderKind` classification for API key, OAuth, workload identity, cloud IAM, local CLI, or PTY fallback.
- There is no provider catalog for Claude/Codex/Gemini/Vertex/Bedrock/Foundry skeletons.
- Credential access, token resolution, local CLI templates, Local Agent boundaries, output parsers, and provider-specific audit events are not modeled centrally.

## Required Model Changes

v0 adds:

- `ProviderKind`: `cloud_api`, `oauth_api`, `workload_identity_api`, `cloud_iam`, `local_cli`, `pty_interactive_fallback`.
- `ProviderAuth`: `api_key`, `oauth_user`, `device_code`, `workload_identity`, `cloud_iam`, `external_cli_session`.
- `ProviderCatalogEntry` with vendor, kind, auth, supported models, billing mode, capabilities, policy notes, metadata, and lifecycle status.
- `CredentialManager`, `TokenResolver`, and `ProviderAdapter` interfaces.
- Local CLI provider config, Aichestra Local Agent protocol models, parser/normalizer models, provider audit events, and redaction utilities.

## Credential Handling Rules

- No raw provider token values are allowed in provider auth config.
- `local_cli` providers must use `external_cli_session` with `credentialAccess = never_read_tokens`.
- Credential cache paths such as `~/.codex/auth.json`, `~/.claude`, and Google ADC cache paths are rejected.
- One user's local CLI session must not be shared across multiple users.
- Static/mock credential and token components return references or empty local CLI envs only.

## Local CLI Provider Rules

- Local CLI command definitions are metadata/templates only.
- v0 does not execute Claude Code, Codex CLI, Gemini CLI, or any vendor CLI.
- Local CLI provider invocation returns `local_agent_required` unless a future Aichestra Local Agent exists.
- PTY fallback is disabled by default.
- Danger/yolo/full-access modes are denied by default.

## Policy Integration Requirements

Policy-as-code v0 gains provider actions:

- `provider.invoke`
- `provider.credential.resolve`
- `provider.local_cli.invoke`
- `provider.pty.invoke`
- `provider.cloud_api.invoke`
- `local_agent.invoke`
- `local_cli.file_write`
- `local_cli.shell_execution`
- `local_cli.network_access`
- `credential.cache.read`
- `credential.cache.upload`

Default rules deny credential cache access, PTY invocation, cloud provider invocation, dangerous local CLI capabilities, and credential resolution. Mock provider invocation remains allowed.

## Audit Requirements

Provider audit records:

- provider validation
- provider invocation request/blocking
- credential resolution request/blocking
- local agent required/unavailable
- credential cache access denial
- parser errors
- redaction events where applicable

Audit metadata is sanitized and must not include raw secrets, API keys, bearer tokens, OAuth tokens, credential cache content, or raw prompts.

## This Task Implements

- Enterprise provider domain models and validation.
- Provider catalog skeleton with disabled entries for Anthropic, Claude Code, OpenAI, Codex CLI, Gemini, Gemini CLI, Vertex, Bedrock, and Azure Foundry.
- Static `CredentialManager` and mock `TokenResolver`.
- Provider adapter skeletons that fail closed.
- Local CLI provider contract metadata.
- Aichestra Local Agent protocol models with no daemon implementation.
- Parser and redaction utilities.
- LLM Gateway metadata hooks for provider catalog attribution.
- Policy hook actions and default rules.
- `/providers/*` API endpoints, health metadata, dashboard visibility, schema skeletons, docs, and tests.

## Out of Scope

- Real provider calls.
- Real OAuth/device-code/WIF/IAM token exchange.
- Reading vendor credential files or local credential caches.
- Uploading local credential caches to Aichestra Cloud.
- Real Aichestra Local Agent daemon/protocol.
- Real Claude Code, Codex CLI, or Gemini CLI execution.
- PTY terminal automation.
- Production secrets, auth/RBAC, OPA/Rego/Cedar, sandboxing, or provider governance.
