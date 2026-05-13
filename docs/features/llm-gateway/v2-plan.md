# LLM Gateway v2 Multi-provider Routing Plan

## Current LLM Gateway v1 Behavior

LLM Gateway v1 is mock-first. `MockLLMProvider` remains the default provider and default tests do not call real LLM providers.

v1 adds one controlled remote provider path: `openai_compatible` chat completion through the `OpenAICompatibleLLMProvider` boundary. Remote calls require explicit runtime gates, model allowlist/default model metadata, virtual-key budget allow, Policy-as-code allow decisions, and SecretRef-backed or legacy env credential configuration. Blocked and failed calls are audited and do not create successful usage entries.

## Current Provider Catalog Behavior

Enterprise Provider Abstraction v0 defines provider catalog entries, provider auth metadata, credential/token resolver skeletons, local CLI provider templates, Local Agent Protocol boundaries, parser utilities, redaction, provider audit, API visibility, and dashboard visibility.

The provider catalog is skeleton-only for non-OpenAI-compatible providers. Cloud provider adapters return blocked/unavailable results. `local_cli` entries require Local Agent Protocol coordination and must not be invoked directly by Aichestra Cloud.

## Current SecretRef Credential Flow

SecretRef-backed Provider Credentials v1 routes GitHub tokens, GitHub webhook secrets, OpenAI-compatible LLM API keys, and API-key style provider metadata through `SecurityControlService`.

The safe flow is:

```text
provider operation
  -> Auth/RBAC context
  -> Policy-as-code
  -> active SecretRef
  -> metadata SecretLease policy checks
  -> explicit env provider single-key lookup
  -> transient adapter-bound value only
  -> sanitized audit/redaction
```

No credential value is returned through API, health, dashboard, audit, or DTOs.

## Current Auth/RBAC And Policy Flow

Production Auth/RBAC Planning v0 provides mock-first `AuthContext`, `RequestContext`, `AuthorizationService`, default roles/permissions, service-account metadata, and policy subject enrichment.

Policy-as-code v0 already covers `llm.completion`, `llm.remote_completion`, `llm.model.use`, `provider.invoke`, `provider.credential.resolve`, and `llm.credential.resolve`. v2 will add routing-specific actions for route selection and fallback so routing cannot bypass the existing policy layer.

## Current Usage Ledger And Audit Flow

Successful completions create usage ledger records with task/run attribution, provider/model metadata, token counts, estimated cost, latency, and gateway request id.

LLM audit events are append-only and sanitized. v1 records completion, remote request/completion/failure, budget block, policy block, provider error, and output redaction events.

## Proposed Multi-provider Routing Architecture

v2 adds a routing control plane inside `LLMGatewayService`:

- `LLMRoute` records provider/model/capability/prompt-class route candidates.
- `LLMRoutingRequest` normalizes route inputs for route-only and completion requests.
- `LLMRoutingDecision` records every route selection, block, no-route result, fallback block, credential block, budget block, policy block, or provider-unavailable result.
- `LLMFallbackPolicy` bounds fallback attempts and defines stop conditions.
- `LLMProviderHealth` reports provider availability without making network calls.

Runtime persistence remains in-memory for v2. The schema and repository inventory document the future durable table candidates, but v2 does not wire a new database implementation.

## Provider Routing Rule Design

Routes are filtered deterministically by:

1. enabled status;
2. requested model id, when present;
3. provider allowlist/denylist config;
4. model allowlist/denylist config;
5. model status and provider status;
6. requested capabilities;
7. prompt class;
8. routing mode (`mock_only`, `single_provider`, `multi_provider`);
9. Auth/RBAC;
10. Policy-as-code;
11. SecretRef credential resolution for remote routes;
12. budget checks;
13. provider health.

Mock routes are first-class routes and remain the default.

## Fallback Strategy

Fallback is disabled by default:

```bash
AICHESTRA_ENABLE_LLM_FALLBACK=false
AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS=0
```

When enabled, fallback is bounded by request and config. It never bypasses Auth/RBAC, Policy, budget, model allowlists, provider allowlists/denylists, SecretRef credential gates, or provider health. Policy, credential, and budget denials stop fallback by default.

## Budget Guardrails

Route selection uses the existing virtual model key and per-task budget checks. Route estimated cost is derived from model token-cost metadata. Fallback attempts require remaining budget and are audited individually. Successful calls create a single usage entry for the selected final route.

## Model Capability Matching Strategy

Model metadata and route metadata advertise provider-neutral capabilities such as `completion`, `code_generation`, `code_review`, `conflict_resolution`, `registry_review`, `summarization`, `json_output`, `tool_use`, and `local_cli`.

Prompt classes map to route eligibility. Disabled or deprecated models are excluded from executable routes. Local CLI routes are represented as `local_agent_required`, not directly invoked.

## Provider Status Model

Provider health is read-model only in v2:

- `mock`: healthy.
- `openai_compatible`: healthy only when the v1 remote gates are configured; otherwise disabled/unavailable.
- Anthropic/Gemini/Bedrock/Vertex/Azure/LiteLLM skeletons: disabled/unavailable.
- `local_cli`: disabled with `local_agent_required`.

Health checks do not call external services.

## Remote Provider Safety Gates

The only remote-capable implementation remains `openai_compatible` from v1. Non-OpenAI-compatible providers are skeletons that return deterministic disabled/not-implemented/unavailable results and never read env credentials or make network calls.

OpenAI-compatible remote execution still requires all v1 gates plus v2 routing gates:

- `AICHESTRA_LLM_ROUTING_MODE=single_provider` or `multi_provider`;
- remote LLM and completion gates;
- base URL;
- SecretRef-backed credential or legacy env fallback;
- Auth/RBAC allow;
- Policy allow;
- model allowlist;
- virtual-key and request budget allow.

## Integration Test Strategy

Default tests use mock providers, skeleton providers, and mocked OpenAI-compatible HTTP clients only. Real remote LLM tests remain skipped unless the existing explicit v1 integration env gates are configured. v2 does not add real Anthropic, Gemini, Bedrock, Vertex, Azure, LiteLLM, Local CLI, MCP, Kubernetes, Temporal, or artifact registry integration tests.

## What v2 Implements

- Provider-aware route records and fallback policies.
- Deterministic route selection and route decision recording.
- Mock default routing.
- OpenAI-compatible v1 route preservation.
- Disabled/skeleton provider routes for Anthropic, Gemini, Bedrock, Vertex, Azure, LiteLLM, and Local CLI.
- Auth/RBAC, Policy, budget, SecretRef, audit, usage, API, health, and dashboard integration.

## Out Of Scope

- BYOK.
- OAuth, device-code, WIF, or IAM token exchange.
- Real Anthropic/Gemini/Bedrock/Vertex/Azure/LiteLLM calls.
- Local CLI execution.
- Vendor CLI invocation.
- Provider credential cache reads or uploads.
- Streaming.
- Tool calling.
- MCP, Kubernetes, Temporal, or artifact registry integration.
- Production auth/session management.
- Production LLM readiness claims.
