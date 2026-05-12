# LLM Gateway v1 Plan

## Current v0 Behavior

LLM Gateway v0 provides provider-neutral interfaces, deterministic `MockLLMProvider`, model catalog, virtual model keys, budget checks, usage ledger integration, LLM audit events, API endpoints, health metadata, and dashboard read-model visibility. `OpenAICompatibleLLMProvider` exists as a skeleton and blocks remote calls by default without network activity.

The default runtime remains mock-first. Existing worker and dashboard paths use `LLMGatewayService` through interfaces and must not call external providers directly.

## Selected Provider Path

v1 selects the OpenAI-compatible HTTP surface. This also covers LiteLLM-compatible deployments that expose the same `/chat/completions` shape.

The provider path is intentionally narrow:

- one provider kind: `openai_compatible`;
- one operation: chat completion;
- no broad multi-provider routing;
- no BYOK;
- no OAuth, device-code, WIF, IAM, or provider credential cache reads.

## Environment Gates

Remote LLM calls remain disabled unless every required gate is configured:

- `AICHESTRA_LLM_PROVIDER=openai_compatible`
- `AICHESTRA_ENABLE_REMOTE_LLM=true`
- `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=true`
- `AICHESTRA_LLM_BASE_URL`
- `AICHESTRA_LLM_API_KEY`
- `AICHESTRA_LLM_ALLOWED_MODELS` when an allowlist is desired
- `AICHESTRA_LLM_DEFAULT_MODEL` when the gateway should map `openai-compatible/default` to a provider model
- `AICHESTRA_LLM_INTEGRATION_TESTS=true` only for optional real integration tests

Missing gates fail deterministically before any HTTP call.

## Secret Handling Rules

The API key is read only from process environment/config in the gated provider boundary. It is not stored in source, model catalog records, virtual model keys, usage ledger metadata, LLM audit events, dashboard read models, health responses, or API responses.

Credential caches such as `~/.codex/auth.json`, `~/.claude`, and Google credential caches are never read. Provider credential `SecretRef` integration remains future work.

## Usage Ledger Flow

Before completion, the gateway resolves a model, estimates tokens and cost, and checks task/virtual-key budgets. Budget denial blocks before provider invocation.

After successful remote completion, the gateway records a usage ledger entry with task/run attribution, provider kind, provider id, model id, token counts, estimated cost, latency, and gateway request id.

Blocked or failed calls create LLM audit events but do not create successful usage entries.

## Budget Policy Flow

The existing virtual model key and per-task budget checks remain authoritative. A remote model can proceed only when:

- model catalog status is active;
- the virtual model key allows `openai_compatible`;
- the virtual model key allows the selected model id;
- estimated cost is within the request/key budget.

## Audit and Redaction Flow

Audit events are append-only and sanitized. v1 adds remote-specific events:

- `llm_remote_completion_requested`
- `llm_remote_completion_blocked`
- `llm_remote_completion_completed`
- `llm_remote_completion_failed`
- `llm_budget_blocked`
- `llm_policy_blocked`
- `llm_provider_error`
- `llm_output_redacted`

Prompts and provider output previews are redacted before audit metadata stores them. API keys, bearer tokens, raw credentials, and credential cache paths must never appear in audit/dashboard/health/API responses.

## Integration Test Strategy

Default tests use mock providers and mocked HTTP clients only. Optional real remote LLM tests are skipped unless all explicit integration env vars are set:

- `AICHESTRA_LLM_INTEGRATION_TESTS=true`
- `AICHESTRA_ENABLE_REMOTE_LLM=true`
- `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=true`
- `AICHESTRA_LLM_API_KEY`
- `AICHESTRA_LLM_BASE_URL`
- `AICHESTRA_LLM_ALLOWED_MODELS` or `AICHESTRA_LLM_DEFAULT_MODEL`

## Fallback Behavior

`MockLLMProvider` remains the default. If remote configuration is incomplete, the OpenAI-compatible provider returns deterministic blocked results and performs no HTTP call. Dashboard read models continue to show safe gate state and blocked examples without triggering provider calls.

## Out of Scope

- Broad multi-provider support.
- BYOK.
- OAuth, device-code, WIF, IAM, or cloud credential exchange.
- Local CLI provider execution.
- Provider credential cache reads.
- Streaming.
- Tool calls.
- Production secret manager integration.
- Persistent LLM request repositories beyond existing schema skeletons.
- Production auth/RBAC.
