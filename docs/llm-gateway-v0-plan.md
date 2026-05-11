# LLM Gateway v0 Plan

## Current Model Selection Behavior

- `MockModelRouter` selects `task.selectedModel`, the preferred model, or `mock-model`.
- `MockAgentRunner` calls `LlmGateway.complete`.
- `MockLlmGateway` returns deterministic text and usage metadata.
- The worker records usage through `MockUsageLedger`, which writes to the shared store.

## Current Usage Ledger Behavior

- Usage entries are recorded as `UsageEvent`.
- Existing workflow usage includes `taskId`, `taskRunId`, `repoId`, provider, model, token counts, cost, latency, skill version, harness version, and metadata.
- Persistent DB v1 supports durable usage ledger entries when Postgres is explicitly configured.

## Current TaskRun Model Fields

- `TaskRun.model` stores the selected model id.
- `TaskRun.modelProvider` stores the selected provider.
- Registry refs and instruction refs are already recorded on TaskRun.

## Proposed LLM Gateway Architecture

- Add provider-neutral `LLMProvider` and `LLMGatewayService` interfaces in `packages/llm-gateway`.
- Preserve a deterministic `MockLLMProvider` as the default.
- Add an `OpenAICompatibleLLMProvider` skeleton that validates config shape and blocks remote calls by default.
- Add an in-memory model catalog with deterministic seed models.
- Add virtual model keys as internal policy objects, not provider credentials.
- Add budget checks before completion.
- Record successful gateway calls into the usage ledger.
- Record blocked/allowed calls into LLM audit events.

## Safety Gates

Default behavior:

- `AICHESTRA_LLM_PROVIDER=mock`
- `AICHESTRA_ENABLE_REMOTE_LLM=false`
- `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=false`

Remote completion must remain blocked unless future tasks explicitly implement and enable a provider. No secrets are stored or returned.

## Supported v0 Operations

- List providers and config.
- List/register/update model catalog entries.
- Create/list/disable virtual model keys.
- Route deterministic model selection.
- Run mock completions.
- Estimate cost and enforce per-task/virtual-key budget limits.
- Record usage ledger entries for successful mock completions.
- Record audit events for allowed and blocked calls.

## Unsupported Operations

- Real OpenAI/Anthropic/Gemini/Bedrock/LiteLLM calls.
- BYOK or provider API key storage.
- OAuth/delegated provider auth.
- Production secrets management.
- Streaming completions.
- Real billing.
- Automatic registry mutation through auto-improvement.

## Audit Requirements

Audit events must record:

- provider kind
- model id
- taskId and taskRunId when available
- actor id when available
- result and reason
- sanitized metadata

Audit events must never expose provider API keys or secrets.

## Usage Ledger Integration

Successful `routeCompletion` calls record a usage ledger entry with:

- `taskId`
- `taskRunId`
- provider/model
- token counts
- estimated cost
- source metadata identifying `llm_gateway`

Blocked calls record audit events but do not create usage ledger entries.

## Test Strategy

- Unit tests for providers, model catalog, virtual keys, budget decisions, usage, and audit.
- API tests for provider/config/model/key/route/completion/usage/audit endpoints.
- Dashboard assumptions for model catalog, usage, audit, and blocked remote examples.
- Regression tests for existing workflow usage attribution.
- No tests should require remote provider credentials.

## Out of Scope

- Real provider network calls.
- Remote LLM integration tests.
- Secret storage.
- BYOK.
- Streaming.
- Production billing.
- Persistent LLM catalog repositories.
