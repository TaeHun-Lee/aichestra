import type { LocalAgentCapabilityKind } from "./local-agent-protocol.ts";
import type { ProviderBillingMode } from "./enterprise-providers.ts";

export type LocalCliProviderTemplateVendor =
  | "claude_code"
  | "openai_codex"
  | "gemini_cli"
  | "aider"
  | "cursor_cli_future"
  | "continue_cli_future"
  | "custom";

export type LocalCliProviderTemplateStatus = "template_only" | "disabled" | "future";

export type LocalCliInvocationMode =
  | "local_agent_required"
  | "direct_execution_forbidden"
  | "pty_future"
  | "unsupported";

export type LocalCliSupportedInputMode = "prompt" | "patch" | "diff" | "file_context" | "repo_context";

export type LocalCliSupportedOutputMode = "text" | "patch" | "diff_summary" | "json_future" | "stream_future";

export type LocalCliCompatibilityStatus = "supported_mock" | "unsupported" | "future" | "blocked";

export type LocalCliSecurityConstraintKind =
  | "no_credential_cache_read"
  | "no_secret_forwarding"
  | "no_direct_execution"
  | "no_network_by_default"
  | "no_remote_git"
  | "no_pty"
  | "no_shell_escape"
  | "output_redaction_required";

export type LocalCliSecurityConstraintSeverity = "critical" | "high" | "medium";

export type LocalCliSecurityConstraintStatus = "enforced" | "blocked" | "future";

export type LocalCliCredentialPolicy = {
  credentialAccess: "never_read_tokens";
  credentialCacheReadAllowed: false;
  secretForwardingAllowed: false;
  envSecretExposureAllowed: false;
  safeEnvironmentKind: "empty";
  notes: string[];
};

export type LocalCliSandboxPolicy = {
  localAgentRequired: true;
  directExecutionAllowed: false;
  ptyAllowed: false;
  networkDefault: "deny";
  remoteGitAllowed: false;
  shellEscapeAllowed: false;
  fileWriteAllowed: false;
  outputRedactionRequired: true;
  maxOutputBytes: number;
};

export type LocalCliProviderTemplate = {
  id: string;
  providerId: string;
  displayName: string;
  vendor: LocalCliProviderTemplateVendor;
  status: LocalCliProviderTemplateStatus;
  invocationMode: LocalCliInvocationMode;
  supportedInputModes: LocalCliSupportedInputMode[];
  supportedOutputModes: LocalCliSupportedOutputMode[];
  requiredCapabilities: LocalAgentCapabilityKind[];
  forbiddenCapabilities: string[];
  credentialPolicy: LocalCliCredentialPolicy;
  sandboxPolicy: LocalCliSandboxPolicy;
  parserProfile: string;
  compatibilityStatus: LocalCliCompatibilityStatus;
  billingMode: ProviderBillingMode;
  policyRequirements: string[];
  readinessStatus: "metadata_ready_execution_disabled";
  metadata: Record<string, unknown>;
};

export type LocalCliCompatibilityRule = {
  id: string;
  providerId: string;
  capability: string;
  status: LocalCliCompatibilityStatus;
  reason: string;
  policyRequirement: string;
  metadata: Record<string, unknown>;
};

export type LocalCliParserProfile = {
  id: string;
  providerId: string;
  expectedOutputShape: "plain_text" | "json_object_future" | "jsonl_events_future" | "diff_or_patch" | "mixed_text_patch";
  patchDetectionStrategy: "unified_diff_markers" | "fenced_patch_blocks" | "text_summary_only" | "future_vendor_json";
  diffSummaryStrategy: "deterministic_text_scan" | "future_structured_summary";
  errorDetectionStrategy: "stderr_preview_and_exit_metadata" | "future_vendor_error_json";
  redactionRules: string[];
  maxOutputBytes: number;
  metadata: Record<string, unknown>;
};

export type LocalCliSecurityConstraint = {
  id: string;
  providerId: string;
  constraint: LocalCliSecurityConstraintKind;
  severity: LocalCliSecurityConstraintSeverity;
  status: LocalCliSecurityConstraintStatus;
  metadata: Record<string, unknown>;
};

export type LocalCliProviderTemplateReadiness = {
  status: "v1_implemented";
  templateCount: number;
  templateOnly: true;
  disabledByDefault: true;
  localAgentRequired: true;
  directExecutionEnabled: false;
  vendorCliExecutionImplemented: false;
  realDaemonImplemented: false;
  ptySupported: false;
  credentialCacheReadAllowed: false;
  secretForwardingAllowed: false;
  envValuesExposed: false;
  secretsExposed: false;
  parserProfileCount: number;
  compatibilityRuleCount: number;
  securityConstraintCount: number;
  providerIds: string[];
  policyActions: string[];
  apiEndpoints: string[];
  recommendedNextTask: "Local CLI Provider Integration-Test Profile v1";
  metadata: Record<string, unknown>;
};

type TemplateSeed = {
  id: string;
  providerId: string;
  displayName: string;
  vendor: LocalCliProviderTemplateVendor;
  parserProfile: string;
  supportedOutputModes: LocalCliSupportedOutputMode[];
  billingMode: ProviderBillingMode;
};

const templateSeeds: TemplateSeed[] = [
  {
    id: "claude-code-template-v1",
    providerId: "claude-code-local",
    displayName: "Claude Code",
    vendor: "claude_code",
    parserProfile: "parser_claude_code_v1",
    supportedOutputModes: ["text", "patch", "diff_summary", "json_future", "stream_future"],
    billingMode: "user_subscription_future"
  },
  {
    id: "codex-cli-template-v1",
    providerId: "codex-cli-local",
    displayName: "OpenAI Codex CLI",
    vendor: "openai_codex",
    parserProfile: "parser_codex_cli_v1",
    supportedOutputModes: ["text", "patch", "diff_summary", "json_future", "stream_future"],
    billingMode: "user_subscription_future"
  },
  {
    id: "gemini-cli-template-v1",
    providerId: "gemini-cli-local",
    displayName: "Gemini CLI",
    vendor: "gemini_cli",
    parserProfile: "parser_gemini_cli_v1",
    supportedOutputModes: ["text", "patch", "diff_summary", "json_future"],
    billingMode: "user_subscription_future"
  },
  {
    id: "aider-template-v1",
    providerId: "aider-local",
    displayName: "Aider",
    vendor: "aider",
    parserProfile: "parser_aider_v1",
    supportedOutputModes: ["text", "patch", "diff_summary"],
    billingMode: "local_cli_future"
  },
  {
    id: "custom-local-cli-template-v1",
    providerId: "custom-local-cli",
    displayName: "Custom local CLI provider",
    vendor: "custom",
    parserProfile: "parser_custom_local_cli_v1",
    supportedOutputModes: ["text", "diff_summary"],
    billingMode: "not_metered_mock"
  }
];

const commonRequiredCapabilities: LocalAgentCapabilityKind[] = [
  "local_cli",
  "workspace_read",
  "stdout_streaming",
  "stderr_streaming",
  "sandbox"
];

const commonForbiddenCapabilities = [
  "workspace_write",
  "shell_execution",
  "network_access",
  "secret_access",
  "pty",
  "credential_cache_read",
  "secret_forwarding",
  "remote_git"
];

const commonPolicyRequirements = [
  "local_cli.template.read",
  "local_cli.invoke",
  "local_agent.invoke",
  "provider.invoke",
  "local_cli.execute_denied",
  "local_cli.credential_cache.read_denied",
  "local_cli.secret.forward_denied"
];

export function seedLocalCliProviderTemplates(): LocalCliProviderTemplate[] {
  return templateSeeds.map((seed) => ({
    id: seed.id,
    providerId: seed.providerId,
    displayName: seed.displayName,
    vendor: seed.vendor,
    status: "template_only",
    invocationMode: "local_agent_required",
    supportedInputModes: ["prompt", "patch", "diff", "file_context", "repo_context"],
    supportedOutputModes: seed.supportedOutputModes,
    requiredCapabilities: [...commonRequiredCapabilities],
    forbiddenCapabilities: [...commonForbiddenCapabilities],
    credentialPolicy: {
      credentialAccess: "never_read_tokens",
      credentialCacheReadAllowed: false,
      secretForwardingAllowed: false,
      envSecretExposureAllowed: false,
      safeEnvironmentKind: "empty",
      notes: [
        "Credential caches are never read.",
        "Secrets are never forwarded to vendor CLI processes.",
        "Safe environment metadata is empty."
      ]
    },
    sandboxPolicy: {
      localAgentRequired: true,
      directExecutionAllowed: false,
      ptyAllowed: false,
      networkDefault: "deny",
      remoteGitAllowed: false,
      shellEscapeAllowed: false,
      fileWriteAllowed: false,
      outputRedactionRequired: true,
      maxOutputBytes: 20000
    },
    parserProfile: seed.parserProfile,
    compatibilityStatus: "supported_mock",
    billingMode: seed.billingMode,
    policyRequirements: [...commonPolicyRequirements],
    readinessStatus: "metadata_ready_execution_disabled",
    metadata: {
      localCliProviderTemplatesVersion: "v1",
      localAgentProtocolRequired: true,
      consentRequired: true,
      fixtureDaemonOnly: true,
      mockCompletedOnly: true,
      commandExecutableExposed: false,
      vendorCliExecutionImplemented: false,
      credentialCachePathExposed: false,
      secretOrEnvValuesExposed: false,
      productionReady: false
    }
  }));
}

export function getLocalCliProviderTemplate(id: string): LocalCliProviderTemplate | undefined {
  return seedLocalCliProviderTemplates().find((template) => template.id === id || template.providerId === id);
}

export function seedLocalCliCompatibilityRules(): LocalCliCompatibilityRule[] {
  const rules = seedLocalCliProviderTemplates().flatMap((template) => {
    const base = (capability: string, status: LocalCliCompatibilityStatus, reason: string, policyRequirement: string, metadata: Record<string, unknown> = {}): LocalCliCompatibilityRule => ({
      id: `rule_${template.providerId.replace(/-/g, "_")}_${capability.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
      providerId: template.providerId,
      capability,
      status,
      reason,
      policyRequirement,
      metadata: {
        templateId: template.id,
        vendor: template.vendor,
        ...metadata
      }
    });
    return [
      base("local_agent_channel", "supported_mock", "Local CLI templates require the Local Agent protocol boundary.", "local_agent.invoke"),
      base("mock_fixture_completion", "supported_mock", "Fixture daemon may return deterministic mock_completed results only.", "local_cli.invoke"),
      base("parser_profile", "supported_mock", "Parser expectations are metadata-only and deterministic.", "local_cli.template.read", { parserProfile: template.parserProfile }),
      base("direct_execution", "blocked", "Aichestra must not spawn vendor CLI processes directly.", "local_cli.execute"),
      base("pty", "unsupported", "PTY automation is out of scope for v1.", "local_cli.execute"),
      base("credential_cache_read", "blocked", "Vendor credential caches must not be read or validated.", "local_cli.credential_cache.read"),
      base("secret_forwarding", "blocked", "Secrets must not be forwarded into CLI processes.", "local_cli.secret.forward"),
      base("network_access", "blocked", "Network access is denied by default for local CLI templates.", "local_cli.invoke"),
      base("remote_git", "blocked", "Remote Git operations are forbidden for local CLI templates.", "provider.invoke"),
      base("shell_escape", "blocked", "Shell escape and shell string execution are forbidden.", "local_cli.execute"),
      base("real_local_agent_daemon", "future", "Production Local Agent daemon implementation remains a future task.", "local_agent.invoke")
    ];
  });
  return rules;
}

export function seedLocalCliParserProfiles(): LocalCliParserProfile[] {
  const profile = (
    id: string,
    providerId: string,
    expectedOutputShape: LocalCliParserProfile["expectedOutputShape"],
    patchDetectionStrategy: LocalCliParserProfile["patchDetectionStrategy"]
  ): LocalCliParserProfile => ({
    id,
    providerId,
    expectedOutputShape,
    patchDetectionStrategy,
    diffSummaryStrategy: "deterministic_text_scan",
    errorDetectionStrategy: "stderr_preview_and_exit_metadata",
    redactionRules: [
      "redact_api_key_like_values",
      "redact_token_like_values",
      "redact_private_key_blocks",
      "redact_known_credential_cache_paths",
      "redact_env_value_shapes"
    ],
    maxOutputBytes: 20000,
    metadata: {
      parserExecutionMode: "metadata_only",
      realVendorOutputParsing: false,
      streamingParserImplemented: false,
      credentialBearingConfigParsing: false
    }
  });
  return [
    profile("parser_claude_code_v1", "claude-code-local", "jsonl_events_future", "fenced_patch_blocks"),
    profile("parser_codex_cli_v1", "codex-cli-local", "jsonl_events_future", "unified_diff_markers"),
    profile("parser_gemini_cli_v1", "gemini-cli-local", "json_object_future", "fenced_patch_blocks"),
    profile("parser_aider_v1", "aider-local", "mixed_text_patch", "unified_diff_markers"),
    profile("parser_custom_local_cli_v1", "custom-local-cli", "plain_text", "text_summary_only")
  ];
}

export function seedLocalCliSecurityConstraints(): LocalCliSecurityConstraint[] {
  return seedLocalCliProviderTemplates().flatMap((template) => {
    const constraint = (
      kind: LocalCliSecurityConstraintKind,
      severity: LocalCliSecurityConstraintSeverity,
      status: LocalCliSecurityConstraintStatus
    ): LocalCliSecurityConstraint => ({
      id: `constraint_${template.providerId.replace(/-/g, "_")}_${kind}`,
      providerId: template.providerId,
      constraint: kind,
      severity,
      status,
      metadata: {
        templateId: template.id,
        enforcedByDefault: status !== "future",
        productionReady: false,
        exposesSecretOrEnvValues: false
      }
    });
    return [
      constraint("no_credential_cache_read", "critical", "enforced"),
      constraint("no_secret_forwarding", "critical", "enforced"),
      constraint("no_direct_execution", "critical", "enforced"),
      constraint("no_network_by_default", "high", "enforced"),
      constraint("no_remote_git", "high", "enforced"),
      constraint("no_pty", "high", "enforced"),
      constraint("no_shell_escape", "high", "enforced"),
      constraint("output_redaction_required", "medium", "enforced")
    ];
  });
}

export function buildLocalCliProviderTemplateReadiness(): LocalCliProviderTemplateReadiness {
  const templates = seedLocalCliProviderTemplates();
  const rules = seedLocalCliCompatibilityRules();
  const parserProfiles = seedLocalCliParserProfiles();
  const securityConstraints = seedLocalCliSecurityConstraints();
  return {
    status: "v1_implemented",
    templateCount: templates.length,
    templateOnly: true,
    disabledByDefault: true,
    localAgentRequired: true,
    directExecutionEnabled: false,
    vendorCliExecutionImplemented: false,
    realDaemonImplemented: false,
    ptySupported: false,
    credentialCacheReadAllowed: false,
    secretForwardingAllowed: false,
    envValuesExposed: false,
    secretsExposed: false,
    parserProfileCount: parserProfiles.length,
    compatibilityRuleCount: rules.length,
    securityConstraintCount: securityConstraints.length,
    providerIds: templates.map((template) => template.providerId),
    policyActions: [
      "local_cli.template.read",
      "local_cli.invoke",
      "local_cli.execute",
      "local_cli.credential_cache.read",
      "local_cli.secret.forward",
      "local_agent.invoke",
      "provider.invoke"
    ],
    apiEndpoints: [
      "GET /providers/local-cli/templates",
      "GET /providers/local-cli/templates/:id",
      "GET /providers/local-cli/compatibility",
      "GET /providers/local-cli/security-constraints",
      "GET /providers/local-cli/readiness"
    ],
    recommendedNextTask: "Local CLI Provider Integration-Test Profile v1",
    metadata: {
      localCliIntegrationProductionReady: false,
      noVendorCliExecution: true,
      noCredentialCacheRead: true,
      noSecretForwarding: true,
      noExternalProviderCalls: true
    }
  };
}
