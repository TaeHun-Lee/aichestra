# Real LLM Enablement (Phase 2)

How to safely turn on the real (non-mock) OpenAI-compatible LLM path for the
single-tenant pilot. Builds on the Phase 1 durable budget enforcement and the
[env secret handling runbook](./secret-handling-pilot-runbook.md).

Code: `packages/llm-gateway/src/real-llm-enablement.ts`, `gateway.ts`.

## Preflight readiness

`evaluateRealLlmEnablement()` consolidates the safety gates the gateway already
applies during routing into one authoritative, fail-closed answer. The gateway
exposes it via `getRealLlmEnablementReadiness()` (metadata only — no secret
values). It anchors the budget-cap check on the system virtual key
(`vmk_system_mock`).

Blockers (all must pass for `ready: true` on a non-mock provider):

| Check | Requirement |
| --- | --- |
| `remote_llm_enabled` | `AICHESTRA_ENABLE_REMOTE_LLM=true` |
| `remote_completion_allowed` | `AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=true` |
| `provider_configured` | OpenAI-compatible provider configured (api key present) |
| `base_url_configured` | `AICHESTRA_LLM_BASE_URL` set |
| `credential_resolved` | credential status resolved (SecretRef or legacy env) |
| `model_allowlist_present` | `AICHESTRA_LLM_ALLOWED_MODELS` non-empty |
| `default_model_configured` | `AICHESTRA_LLM_DEFAULT_MODEL` set |
| `fallback_disabled` | `AICHESTRA_ENABLE_LLM_FALLBACK=false` (controlled single path) |
| `budget_cap_configured` | system virtual key has a monthly or per-task budget cap |

Warnings (recommended, non-blocking): `credential_via_secret_ref` (prefer a
SecretRef over a legacy env key) and `routing_mode_controlled`
(`single_provider` or `mock_only`).

## Enforcement (fail-closed)

Construct the gateway with `enforceRealLlmEnablement: true`. When set, the
gateway refuses to call a real provider unless the preflight is `ready`,
returning `real_llm_enablement_not_ready` and recording an
`llm_remote_completion_blocked` audit event with the blocker list — **before**
any provider request is made.

The flag defaults to `false` so the existing granular routing gates and tests
are unchanged; production / pilot runtimes should enable it.

## Pilot enablement checklist

```bash
AICHESTRA_LLM_PROVIDER=openai_compatible
AICHESTRA_LLM_ROUTING_MODE=single_provider
AICHESTRA_ENABLE_REMOTE_LLM=true
AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION=true
AICHESTRA_ENABLE_LLM_FALLBACK=false
AICHESTRA_LLM_BASE_URL=https://<provider>/v1
AICHESTRA_LLM_ALLOWED_MODELS=<model-id>
AICHESTRA_LLM_DEFAULT_MODEL=<model-id>
# Credential via the env secret provider (see secret-handling runbook):
AICHESTRA_LLM_API_KEY_SECRET_REF=<secret-ref-id>
AICHESTRA_ENABLE_ENV_SECRET_PROVIDER=true
AICHESTRA_ALLOWED_SECRET_ENV_KEYS=AICHESTRA_LLM_API_KEY
AICHESTRA_LLM_API_KEY=<provider api key>
```

1. Confirm `getRealLlmEnablementReadiness()` reports `ready: true` with no
   blockers (resolve any warnings you care about first).
2. Keep `monthlyBudgetUsd` on `vmk_system_mock` small for the first runs;
   cumulative spend is enforced and durable under Postgres (Phase 1).
3. Run the LLM Gateway integration-test profile against the real endpoint with a
   tiny budget cap before widening usage.
4. Enable `enforceRealLlmEnablement` so misconfiguration fails closed.
