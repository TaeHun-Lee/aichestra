import type { LLMProviderKind, LLMProviderRuntimeConfig, VirtualModelKey } from "./types.ts";

/**
 * Consolidated, fail-closed readiness for issuing real (non-mock) LLM
 * completions through the controlled OpenAI-compatible path. The gateway
 * already applies these gates piecemeal during routing; this surface gives
 * operators one authoritative "is it safe to turn on real LLM?" answer and a
 * single enforcement point. It returns metadata only — never secret values.
 */

export type RealLlmEnablementSeverity = "blocker" | "warning";

export type RealLlmEnablementCheck = {
  id: string;
  ok: boolean;
  severity: RealLlmEnablementSeverity;
  detail?: string;
};

export type RealLlmEnablementReadiness = {
  providerKind: LLMProviderKind;
  /** false when the configured provider is mock (no real path exists). */
  remotePathApplicable: boolean;
  /** true only when every blocker check passes. */
  ready: boolean;
  blockers: string[];
  warnings: string[];
  checks: RealLlmEnablementCheck[];
  metadata: Record<string, unknown>;
};

export type RealLlmEnablementInput = {
  config: LLMProviderRuntimeConfig;
  /** The virtual key whose budget cap gates spend (typically the system key). */
  budgetVirtualKey?: Pick<VirtualModelKey, "id" | "monthlyBudgetUsd" | "perTaskBudgetUsd">;
};

function hasFiniteBudgetCap(key: RealLlmEnablementInput["budgetVirtualKey"]): boolean {
  if (!key) return false;
  const monthly = key.monthlyBudgetUsd;
  const perTask = key.perTaskBudgetUsd;
  return (typeof monthly === "number" && Number.isFinite(monthly)) ||
    (typeof perTask === "number" && Number.isFinite(perTask));
}

export function evaluateRealLlmEnablement(input: RealLlmEnablementInput): RealLlmEnablementReadiness {
  const { config } = input;

  if (config.providerKind === "mock") {
    return {
      providerKind: config.providerKind,
      remotePathApplicable: false,
      ready: false,
      blockers: ["provider_is_mock"],
      warnings: [],
      checks: [{ id: "provider_is_mock", ok: false, severity: "blocker", detail: "providerKind is mock; no real LLM path is configured" }],
      metadata: { providerKind: config.providerKind, mockProvider: true, containsSecretMaterial: false }
    };
  }

  const budgetCapConfigured = hasFiniteBudgetCap(input.budgetVirtualKey);
  const checks: RealLlmEnablementCheck[] = [
    { id: "remote_llm_enabled", ok: config.remoteLlmEnabled, severity: "blocker" },
    { id: "remote_completion_allowed", ok: config.remoteCompletionEnabled, severity: "blocker" },
    { id: "provider_configured", ok: config.openAICompatibleConfigured, severity: "blocker" },
    { id: "base_url_configured", ok: config.baseUrlConfigured, severity: "blocker" },
    { id: "credential_resolved", ok: config.credentialStatus === "resolved", severity: "blocker", detail: `credential_status=${config.credentialStatus}` },
    { id: "model_allowlist_present", ok: config.allowedModelCount > 0, severity: "blocker" },
    { id: "default_model_configured", ok: config.defaultModelConfigured, severity: "blocker" },
    {
      id: "fallback_disabled",
      ok: !config.fallbackEnabled,
      severity: "blocker",
      detail: config.fallbackEnabled ? "set AICHESTRA_ENABLE_LLM_FALLBACK=false for the controlled single path" : undefined
    },
    {
      id: "budget_cap_configured",
      ok: budgetCapConfigured,
      severity: "blocker",
      detail: budgetCapConfigured ? undefined : "no monthly or per-task budget cap on the system virtual key"
    },
    {
      id: "credential_via_secret_ref",
      ok: config.credentialSource === "secret_ref",
      severity: "warning",
      detail: config.credentialSource === "secret_ref" ? undefined : `credential_source=${config.credentialSource}; SecretRef is preferred over legacy env`
    },
    {
      id: "routing_mode_controlled",
      ok: config.routingMode === "single_provider" || config.routingMode === "mock_only",
      severity: "warning",
      detail: `routing_mode=${config.routingMode}`
    }
  ];

  const blockers = checks.filter((check) => check.severity === "blocker" && !check.ok).map((check) => check.id);
  const warnings = checks.filter((check) => check.severity === "warning" && !check.ok).map((check) => check.id);

  return {
    providerKind: config.providerKind,
    remotePathApplicable: true,
    ready: blockers.length === 0,
    blockers,
    warnings,
    checks,
    metadata: {
      providerKind: config.providerKind,
      routingMode: config.routingMode,
      credentialSource: config.credentialSource,
      allowedModelCount: config.allowedModelCount,
      defaultModelConfigured: config.defaultModelConfigured,
      fallbackEnabled: config.fallbackEnabled,
      budgetCapConfigured,
      containsSecretMaterial: false
    }
  };
}
