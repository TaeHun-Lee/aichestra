# LLM Gateway Integration-Test Profile v1 Plan

Canonical path: `docs/roadmaps/llm-gateway-integration-test-profile/`. This follows `docs/README.md`: cross-cutting rollout and integration-test profiles live under `docs/roadmaps/`, while feature implementation notes remain under `docs/features/llm-gateway/`.

## Current LLM Gateway v2 behavior

- `MockLLMProvider` remains the default runtime provider.
- `OpenAICompatibleLLMProvider` is the only remote-capable boundary and is selected only by explicit gates.
- Disabled provider skeletons exist for non-OpenAI families; they are not live integrations.
- LLM Gateway v2 tracks provider catalog, routing decisions, fallback policy, usage ledger metadata, audit events, budget checks, model allowlists, virtual model key policy objects, and dashboard read models.
- Streaming, tool calling, Local CLI provider execution, BYOK, OAuth/device-code/WIF/IAM, cloud identity exchange, and credential cache reads remain out of scope.

## Current OpenAI-Compatible Remote Path

Remote completion requires all of:

- `AICHESTRA_LLM_PROVIDER=openai_compatible`
- `AICHESTRA_ENABLE_REMOTE_LLM=true`
- `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=true`
- `AICHESTRA_LLM_BASE_URL`
- `AICHESTRA_LLM_API_KEY_SECRET_REF` preferred, or controlled test-only `AICHESTRA_LLM_API_KEY`
- `AICHESTRA_LLM_ALLOWED_MODELS`
- `AICHESTRA_LLM_DEFAULT_MODEL`
- virtual-key, budget, Auth/RBAC, and Policy-as-code decisions

Default tests do not call the provider. Existing optional remote tests skip when gates are absent.

## Current SecretRef Credential Behavior

SecretRef-backed Provider Credentials v1 supports metadata-only SecretRefs, credential handles, and env-backed resolution behind explicit gates. The env provider must be enabled and allowlisted before an env-backed SecretRef can resolve. API responses, health metadata, dashboard data, and audit must not expose raw API keys or env values.

## Current Auth/RBAC and Policy Behavior

Production Auth/RBAC v1 remains planning/mock-first. Request context and actor attribution are modeled but not production identity. Policy-as-code v0 remains static TypeScript and deny-by-default; remote LLM completion must pass policy after env/provider/model/budget gates and before any HTTP call.

## Current Budget, Usage, and Audit Behavior

LLM Gateway v2 records usage ledger metadata for successful completions and LLM audit events for blocked, routed, completed, and failed requests. Prompt/output data must be redacted or preview-limited. The integration profile adds readiness checks for a small live-test budget cap and audit/redaction verification, but does not implement an exporter or retention job.

## Current Staging CI/CD Integration Gate Behavior

Staging CI/CD Pipeline Planning v0 marks remote LLM tests optional and skipped by default. The current CI planning requires explicit remote LLM gates, model allowlists, SecretRef credentials, budget caps, and no uncontrolled fallback. This v1 profile turns that policy into first-class readiness data.

## Required Integration-Test Gates

- `AICHESTRA_LLM_INTEGRATION_TESTS=true`
- `AICHESTRA_LLM_PROVIDER=openai_compatible`
- `AICHESTRA_ENABLE_REMOTE_LLM=true`
- `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=true`
- `AICHESTRA_LLM_BASE_URL`
- `AICHESTRA_LLM_API_KEY_SECRET_REF` or controlled test-only `AICHESTRA_LLM_API_KEY`
- `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true`, only when env SecretRef provider is used
- `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` includes the referenced key when env SecretRef provider is used
- `AICHESTRA_LLM_ALLOWED_MODELS`
- `AICHESTRA_LLM_DEFAULT_MODEL`
- `AICHESTRA_LLM_ROUTING_MODE=single_provider` or `multi_provider`
- `AICHESTRA_ENABLE_LLM_FALLBACK=false`
- `AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS=0`
- `AICHESTRA_LLM_TEST_BUDGET_USD`
- `AICHESTRA_LLM_TEST_PROMPT_CLASS`

Missing gates skip optional live tests. Unsafe gates block live tests.

## Test Provider Requirements

The v1 profile covers only OpenAI-compatible or LiteLLM-compatible HTTP endpoints through the existing OpenAI-compatible boundary. It does not add broad live provider support. Provider base URL values are never returned through readiness APIs, health, or dashboard.

## Model Allowlist Requirements

Live tests require a small, explicit model allowlist and a default model contained in that allowlist. Readiness surfaces return counts and allowlist status only, not configured model names.

## Budget Cap Requirements

Live tests require a positive `AICHESTRA_LLM_TEST_BUDGET_USD` at or below the profile limit. v1 treats missing budget as a skip condition unless live tests are enabled, and treats invalid or excessive budgets as unsafe.

## Prompt and Output Redaction Requirements

Live test prompts must be harmless, non-sensitive smoke prompts. Outputs must be preview-limited and redacted before usage/audit/dashboard exposure. API keys, raw env values, raw provider responses, credential cache paths, and raw prompts must not be stored or returned.

## Cleanup and Retention Expectations

The profile has no remote cleanup side effects. Usage and audit records remain local/read-only in v1. Retention deletion jobs and external audit export remain out of scope.

## What This Task Implements

- LLM integration-test profile, test-case, safety-check, and summary read models.
- Read-only readiness service methods and DTOs.
- Read-only API endpoints under `/readiness/llm-integration/*`.
- Safe `/health` metadata under `llmIntegrationTests`.
- Dashboard read model and web panel under `/dashboard/llm-integration`.
- Deterministic tests, including skipped-by-default live test skeleton.
- Documentation updates for staging CI/CD, staging profile, LLM Gateway, SecretRef, environment gates, roadmap, README, AGENTS, and phase audit.

## Out Of Scope

- Real live-provider execution in default tests.
- Broad multi-provider live integration.
- BYOK, OAuth, device-code, WIF, IAM, or cloud identity exchange.
- Streaming and tool calling.
- Vendor CLI or Local CLI provider execution.
- Credential cache reads.
- MCP real transport, secret backend integration, deployment infrastructure, or production readiness.
