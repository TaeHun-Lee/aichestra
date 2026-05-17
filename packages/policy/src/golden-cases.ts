import type { PolicyAction, PolicyActorKind, PolicyResource, PolicyResourceKind, PolicySubject } from "./types.ts";

export type PolicyRuntimeGoldenDomain =
  | "git"
  | "github_app"
  | "llm"
  | "mcp"
  | "secrets_vault"
  | "runner"
  | "local_agent"
  | "registry"
  | "governance"
  | "dashboard_readiness"
  | "tenant_scope";

export type PolicyRuntimeGoldenEffect = "allow" | "deny" | "block" | "warn";
export type PolicyRuntimeGoldenRiskLevel = "low" | "medium" | "high" | "critical";

export type PolicyRuntimeGoldenExpectedDecision = {
  effect: PolicyRuntimeGoldenEffect;
  reason: string;
  ruleId?: string;
};

export type PolicyRuntimeGoldenCase = {
  id: string;
  description: string;
  domain: PolicyRuntimeGoldenDomain;
  action: PolicyAction;
  subject: PolicySubject;
  resource: PolicyResource;
  environment: Record<string, unknown>;
  context: {
    taskId?: string;
    taskRunId?: string;
    repoId?: string;
    branchName?: string;
    modelId?: string;
    providerKind?: string;
    runnerKind?: string;
    command?: string;
    riskScore?: number;
    metadata: Record<string, unknown>;
  };
  expectedDecision: PolicyRuntimeGoldenExpectedDecision;
  riskLevel: PolicyRuntimeGoldenRiskLevel;
  notes: string[];
};

function subject(input: {
  actorId: string;
  actorKind?: PolicyActorKind;
  roles: string[];
  principalId?: string;
  serviceAccountId?: string;
  tenantIds?: string[];
  projectIds?: string[];
  authMode?: string;
  isMockActor?: boolean;
}): PolicySubject {
  return {
    actorId: input.actorId,
    principalId: input.principalId,
    actorKind: input.actorKind ?? "human_user",
    roles: input.roles,
    tenantIds: input.tenantIds,
    projectIds: input.projectIds,
    authMode: input.authMode ?? "mock",
    serviceAccountId: input.serviceAccountId,
    isMockActor: input.isMockActor ?? true,
    requestId: `req_${input.actorId}`,
    correlationId: `corr_${input.actorId}`,
    source: "golden_harness"
  };
}

function resource(input: {
  resourceKind: PolicyResourceKind;
  resourceId: string;
  tenantId?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}): PolicyResource {
  return {
    resourceKind: input.resourceKind,
    resourceId: input.resourceId,
    tenantId: input.tenantId,
    projectId: input.projectId,
    metadata: input.metadata ?? {}
  };
}

const viewer = subject({ actorId: "golden_viewer", roles: ["viewer"], principalId: "principal_viewer", tenantIds: ["tenant_demo"] });
const developer = subject({ actorId: "golden_developer", roles: ["developer"], principalId: "principal_developer", tenantIds: ["tenant_demo"], projectIds: ["project_demo"] });
const system = subject({ actorId: "golden_system", actorKind: "system", roles: ["system"], authMode: "mock_system" });
const securityAdmin = subject({ actorId: "golden_security_admin", roles: ["security_admin"], principalId: "principal_security", tenantIds: ["tenant_demo"] });
const serviceAccount = subject({
  actorId: "golden_github_service",
  actorKind: "service_account",
  roles: ["service_account_git_adapter"],
  serviceAccountId: "svc_git_adapter",
  authMode: "mock_service_account",
  tenantIds: ["tenant_demo"]
});

export const policyRuntimeGoldenCases: PolicyRuntimeGoldenCase[] = [
  {
    id: "git_remote_merge_denied",
    description: "Provider merge remains unsupported and denied.",
    domain: "git",
    action: "git.merge",
    subject: system,
    resource: resource({ resourceKind: "git_operation", resourceId: "repo_demo", tenantId: "tenant_demo", metadata: { providerKind: "github" } }),
    environment: { remoteGitEnabled: true, remoteMergeEnabled: false },
    context: { repoId: "repo_demo", providerKind: "github", metadata: { operation: "merge" } },
    expectedDecision: { effect: "deny", reason: "Provider merge is not implemented in Real Git Adapter v0.", ruleId: "policy_git_merge_deny" },
    riskLevel: "critical",
    notes: ["Destructive Git operations deny before any future bundle allow rule."]
  },
  {
    id: "git_force_push_denied",
    description: "Force push is represented as a remote Git operation without an allowed operation gate.",
    domain: "git",
    action: "git.remote_operation",
    subject: system,
    resource: resource({ resourceKind: "git_operation", resourceId: "repo_demo", tenantId: "tenant_demo", metadata: { providerKind: "github" } }),
    environment: { remoteGitEnabled: true, remoteOperationAllowed: false, repoAllowlisted: true, credentialsConfigured: true, destructiveOperation: true },
    context: { repoId: "repo_demo", providerKind: "github", metadata: { operation: "force_push" } },
    expectedDecision: { effect: "deny", reason: "Remote Git operations require an operation-specific branch, PR, or read gate.", ruleId: "policy_git_remote_operation_gate_deny" },
    riskLevel: "critical",
    notes: ["Real Git Adapter v2 does not support force push."]
  },
  {
    id: "git_branch_deletion_denied",
    description: "Remote branch deletion remains unsupported.",
    domain: "git",
    action: "git.branch.delete",
    subject: system,
    resource: resource({ resourceKind: "branch", resourceId: "ai/delete-me", tenantId: "tenant_demo", metadata: { providerKind: "github" } }),
    environment: { remoteGitEnabled: true, destructiveOperation: true },
    context: { repoId: "repo_demo", branchName: "ai/delete-me", providerKind: "github", metadata: { operation: "branch_delete" } },
    expectedDecision: { effect: "deny", reason: "Destructive branch deletion is unsupported in v0.", ruleId: "policy_git_branch_delete_deny" },
    riskLevel: "critical",
    notes: ["Branch deletion remains out of scope for Real Git Adapter v2."]
  },
  {
    id: "git_branch_create_mock_allowed",
    description: "Mock branch creation remains allowed for scaffold workflows.",
    domain: "git",
    action: "git.branch.create",
    subject: system,
    resource: resource({ resourceKind: "branch", resourceId: "mock/task-1", tenantId: "tenant_demo", metadata: { providerKind: "mock" } }),
    environment: { remoteGitEnabled: false },
    context: { repoId: "repo_demo", branchName: "mock/task-1", providerKind: "mock", metadata: { operation: "mock_branch_create" } },
    expectedDecision: { effect: "allow", reason: "Mock branch creation is allowed for the scaffold.", ruleId: "policy_git_mock_branch_allow" },
    riskLevel: "low",
    notes: ["This is mock-only and does not call a hosted Git provider."]
  },
  {
    id: "git_branch_create_gated_github_allowed",
    description: "GitHub branch creation is allowed only when every explicit remote gate is represented as passing.",
    domain: "git",
    action: "git.branch.create",
    subject: system,
    resource: resource({ resourceKind: "branch", resourceId: "ai/task-safe", tenantId: "tenant_demo", metadata: { providerKind: "github" } }),
    environment: { remoteGitEnabled: true, remoteBranchCreateEnabled: true, repoAllowlisted: true, branchPrefixAllowed: true, credentialsConfigured: true },
    context: { repoId: "repo_demo", branchName: "ai/task-safe", providerKind: "github", metadata: { operation: "branch_create" } },
    expectedDecision: { effect: "allow", reason: "GitHub branch creation is allowed only when remote Git, branch creation, repo allowlist, branch prefix, and credential gates pass.", ruleId: "policy_git_github_branch_create_allow_v1" },
    riskLevel: "medium",
    notes: ["The harness only evaluates policy metadata; it does not call GitHub."]
  },
  {
    id: "github_app_token_without_gates_denied",
    description: "GitHub App token handle issuance is denied when the GitHub App gate is disabled.",
    domain: "github_app",
    action: "github_app.installation_token.issue",
    subject: serviceAccount,
    resource: resource({ resourceKind: "github_app_installation", resourceId: "installation_demo", tenantId: "tenant_demo", metadata: { providerKind: "github" } }),
    environment: { githubAppEnabled: false, githubAppAuthMode: true, repoAllowlisted: true },
    context: { providerKind: "github", metadata: { operation: "installation_token_handle" } },
    expectedDecision: { effect: "deny", reason: "GitHub App installation token issuance requires GitHub App auth mode and enable gates.", ruleId: "policy_github_app_token_issue_deny_disabled" },
    riskLevel: "critical",
    notes: ["Service-account attribution does not bypass GitHub App gates."]
  },
  {
    id: "llm_remote_completion_denied_default",
    description: "Remote LLM completion is denied by default.",
    domain: "llm",
    action: "llm.remote_completion",
    subject: developer,
    resource: resource({ resourceKind: "llm_provider", resourceId: "openai_compatible", tenantId: "tenant_demo", metadata: { providerKind: "openai_compatible" } }),
    environment: { remoteLlmEnabled: false, remoteCompletionEnabled: false, budgetAllowed: true },
    context: { taskId: "task_llm_denied", taskRunId: "run_llm_denied", providerKind: "openai_compatible", modelId: "model_demo", metadata: { promptClass: "safe_fixture" } },
    expectedDecision: { effect: "deny", reason: "Remote model completions require explicit v1 runtime gates.", ruleId: "policy_llm_remote_completion_deny" },
    riskLevel: "critical",
    notes: ["No prompt text or provider response is present in the fixture."]
  },
  {
    id: "llm_remote_completion_gated_allowed",
    description: "Remote completion policy allows only when all explicit gates are represented as passing.",
    domain: "llm",
    action: "llm.remote_completion",
    subject: developer,
    resource: resource({ resourceKind: "llm_provider", resourceId: "openai_compatible", tenantId: "tenant_demo", metadata: { providerKind: "openai_compatible" } }),
    environment: { remoteLlmEnabled: true, remoteCompletionEnabled: true, baseUrlConfigured: true, credentialsConfigured: true, modelAllowlisted: true, budgetAllowed: true },
    context: { taskId: "task_llm_allowed", taskRunId: "run_llm_allowed", providerKind: "openai_compatible", modelId: "model_demo", metadata: { promptClass: "safe_fixture" } },
    expectedDecision: { effect: "allow", reason: "OpenAI-compatible remote completion may proceed only after v1 config, credential, model allowlist, and budget gates pass.", ruleId: "policy_llm_remote_completion_allow_openai_v1" },
    riskLevel: "high",
    notes: ["This evaluates static policy only and does not call an LLM provider."]
  },
  {
    id: "llm_fallback_disabled_by_default",
    description: "LLM fallback is denied unless explicitly enabled.",
    domain: "llm",
    action: "llm.fallback",
    subject: developer,
    resource: resource({ resourceKind: "llm_fallback_policy", resourceId: "fallback_default", tenantId: "tenant_demo" }),
    environment: { fallbackEnabled: false, fallbackWithinLimit: false, budgetAllowed: true },
    context: { providerKind: "mock", modelId: "model_demo", metadata: { fallbackAttempt: 0 } },
    expectedDecision: { effect: "deny", reason: "Fallback may not run unless the v2 fallback gate is enabled.", ruleId: "policy_llm_fallback_deny_disabled_v2" },
    riskLevel: "high",
    notes: ["Fallback must not bypass provider, model, or budget gates."]
  },
  {
    id: "llm_fallback_max_attempts_enforced",
    description: "Enabled fallback still denies when the attempt is outside the configured bound.",
    domain: "llm",
    action: "llm.fallback",
    subject: developer,
    resource: resource({ resourceKind: "llm_fallback_policy", resourceId: "fallback_unbounded", tenantId: "tenant_demo" }),
    environment: { fallbackEnabled: true, fallbackWithinLimit: false, budgetAllowed: true },
    context: { providerKind: "mock", modelId: "model_demo", metadata: { fallbackAttempt: 3, maxFallbackAttempts: 1 } },
    expectedDecision: { effect: "deny", reason: "No policy rule allowed llm.fallback on llm_fallback_policy.", ruleId: "policy_default_deny" },
    riskLevel: "high",
    notes: ["Default deny is the expected result when bounded fallback conditions do not match."]
  },
  {
    id: "llm_disabled_model_denied",
    description: "Disabled models cannot be selected.",
    domain: "llm",
    action: "llm.model.use",
    subject: developer,
    resource: resource({ resourceKind: "llm_model", resourceId: "model_disabled", tenantId: "tenant_demo", metadata: { status: "disabled" } }),
    environment: { budgetAllowed: true },
    context: { modelId: "model_disabled", providerKind: "mock", metadata: { modelStatus: "disabled" } },
    expectedDecision: { effect: "deny", reason: "Disabled and deprecated models cannot be selected.", ruleId: "policy_llm_disabled_model_deny" },
    riskLevel: "high",
    notes: ["The fixture uses status metadata only."]
  },
  {
    id: "llm_cloud_api_provider_denied",
    description: "Enterprise cloud API provider invocation remains disabled in this scaffold.",
    domain: "llm",
    action: "provider.cloud_api.invoke",
    subject: developer,
    resource: resource({ resourceKind: "llm_provider", resourceId: "provider_cloud_future", tenantId: "tenant_demo", metadata: { providerKind: "cloud_api" } }),
    environment: { providerEnabled: false },
    context: { providerKind: "cloud_api", metadata: { providerStatus: "disabled" } },
    expectedDecision: { effect: "deny", reason: "Enterprise provider cloud API invocation is disabled in v0.", ruleId: "policy_provider_cloud_api_invoke_deny" },
    riskLevel: "critical",
    notes: ["No external provider call is made."]
  },
  {
    id: "mcp_critical_tool_denied",
    description: "Critical MCP tools deny by default.",
    domain: "mcp",
    action: "mcp.tool.invoke.critical",
    subject: developer,
    resource: resource({ resourceKind: "mcp_tool", resourceId: "tool_critical", tenantId: "tenant_demo" }),
    environment: { serverKind: "mock", riskLevel: "critical", realTransportEnabled: false },
    context: { metadata: { mcpServerId: "mcp_demo", mcpToolId: "tool_critical" } },
    expectedDecision: { effect: "deny", reason: "Critical MCP tools are denied by default in v0.", ruleId: "policy_mcp_tool_invoke_critical_deny_v0" },
    riskLevel: "critical",
    notes: ["Critical tool invocation never reaches a real MCP transport."]
  },
  {
    id: "mcp_high_risk_tool_denied",
    description: "High-risk MCP tools deny by default.",
    domain: "mcp",
    action: "mcp.tool.invoke.high_risk",
    subject: developer,
    resource: resource({ resourceKind: "mcp_tool", resourceId: "tool_high_risk", tenantId: "tenant_demo" }),
    environment: { serverKind: "mock", riskLevel: "high", realTransportEnabled: false },
    context: { metadata: { mcpServerId: "mcp_demo", mcpToolId: "tool_high_risk" } },
    expectedDecision: { effect: "deny", reason: "High-risk MCP tools are denied by default in v0.", ruleId: "policy_mcp_tool_invoke_high_risk_deny_v0" },
    riskLevel: "high",
    notes: ["High-risk tools require future governance before any allow path."]
  },
  {
    id: "mcp_low_risk_mock_readonly_allowed",
    description: "Low-risk read-only mock MCP invocation is allowed when all unsafe capabilities are disabled.",
    domain: "mcp",
    action: "mcp.tool.invoke",
    subject: developer,
    resource: resource({ resourceKind: "mcp_tool", resourceId: "tool_docs_search", tenantId: "tenant_demo" }),
    environment: { serverKind: "mock", serverStatus: "active", toolStatus: "active", riskLevel: "low", readOnly: true, requiresSecrets: false, networkRequired: false, writeOperation: false, deployOperation: false, realTransportEnabled: false, localExecutionRequired: false },
    context: { metadata: { mcpServerId: "mcp_demo", mcpToolId: "tool_docs_search" } },
    expectedDecision: { effect: "allow", reason: "The generic MCP invocation gate allows only low-risk read-only mock tools with all unsafe capabilities disabled.", ruleId: "policy_mcp_tool_invoke_allow_generic_low_risk_mock_v0" },
    riskLevel: "low",
    notes: ["This is deterministic mock metadata only."]
  },
  {
    id: "mcp_secret_access_tool_denied",
    description: "MCP tools cannot resolve secrets.",
    domain: "mcp",
    action: "mcp.tool.secret.resolve",
    subject: developer,
    resource: resource({ resourceKind: "mcp_tool", resourceId: "tool_secret", tenantId: "tenant_demo" }),
    environment: { requiresSecrets: true, realTransportEnabled: false },
    context: { metadata: { mcpServerId: "mcp_demo", mcpToolId: "tool_secret" } },
    expectedDecision: { effect: "deny", reason: "MCP tools do not receive SecretRefs, leases, or raw secret material in v0.", ruleId: "policy_mcp_tool_secret_resolve_deny_v0" },
    riskLevel: "critical",
    notes: ["No SecretLease is issued to MCP tools."]
  },
  {
    id: "mcp_network_tool_denied",
    description: "MCP network access is denied.",
    domain: "mcp",
    action: "mcp.tool.network_access",
    subject: developer,
    resource: resource({ resourceKind: "mcp_tool", resourceId: "tool_network", tenantId: "tenant_demo" }),
    environment: { networkRequired: true, realTransportEnabled: false },
    context: { metadata: { mcpServerId: "mcp_demo", mcpToolId: "tool_network" } },
    expectedDecision: { effect: "deny", reason: "MCP network transport and tool network egress are disabled in v0.", ruleId: "policy_mcp_tool_network_access_deny_v0" },
    riskLevel: "critical",
    notes: ["Network egress remains denied by default."]
  },
  {
    id: "mcp_write_tool_denied",
    description: "MCP write tools are denied.",
    domain: "mcp",
    action: "mcp.tool.write",
    subject: developer,
    resource: resource({ resourceKind: "mcp_tool", resourceId: "tool_write", tenantId: "tenant_demo" }),
    environment: { writeOperation: true, realTransportEnabled: false },
    context: { metadata: { mcpServerId: "mcp_demo", mcpToolId: "tool_write" } },
    expectedDecision: { effect: "deny", reason: "MCP write tools are disabled in v0.", ruleId: "policy_mcp_tool_write_deny_v0" },
    riskLevel: "critical",
    notes: ["Write tools are future-only."]
  },
  {
    id: "mcp_deploy_tool_denied",
    description: "MCP deploy tools are denied.",
    domain: "mcp",
    action: "mcp.tool.deploy",
    subject: developer,
    resource: resource({ resourceKind: "mcp_tool", resourceId: "tool_deploy", tenantId: "tenant_demo" }),
    environment: { deployOperation: true, realTransportEnabled: false },
    context: { metadata: { mcpServerId: "mcp_demo", mcpToolId: "tool_deploy" } },
    expectedDecision: { effect: "deny", reason: "MCP deployment tools are disabled in v0.", ruleId: "policy_mcp_tool_deploy_deny_v0" },
    riskLevel: "critical",
    notes: ["Deployment through MCP is not implemented."]
  },
  {
    id: "secret_read_denied",
    description: "Raw secret reads are denied.",
    domain: "secrets_vault",
    action: "secret.read",
    subject: securityAdmin,
    resource: resource({ resourceKind: "secret_scope", resourceId: "secret_scope_demo", tenantId: "tenant_demo" }),
    environment: { secretMaterialAvailable: false },
    context: { metadata: { secretRefId: "secretref_demo" } },
    expectedDecision: { effect: "deny", reason: "Production secrets are not available to the scaffold.", ruleId: "policy_secret_read_deny" },
    riskLevel: "critical",
    notes: ["Fixtures contain only SecretRef ids, never values."]
  },
  {
    id: "credential_cache_read_denied",
    description: "Provider-owned credential cache reads are denied.",
    domain: "secrets_vault",
    action: "credential.cache.read",
    subject: system,
    resource: resource({ resourceKind: "provider_credential", resourceId: "provider_cli_cache_reference", tenantId: "tenant_demo" }),
    environment: { credentialCacheAccessAllowed: false },
    context: { providerKind: "local_cli", metadata: { credentialSource: "external_cli_session" } },
    expectedDecision: { effect: "deny", reason: "Provider-owned credential caches must not be read.", ruleId: "policy_credential_cache_read_deny" },
    riskLevel: "critical",
    notes: ["No local credential path is present in the fixture."]
  },
  {
    id: "vault_path_not_allowlisted_denied",
    description: "Vault-backed provider credential resolution denies when path allowlist metadata is false.",
    domain: "secrets_vault",
    action: "provider.credential.resolve",
    subject: securityAdmin,
    resource: resource({ resourceKind: "provider_credential", resourceId: "secretref_vault_demo", tenantId: "tenant_demo", metadata: { providerKind: "github" } }),
    environment: { credentialsConfigured: true, secretRefActive: true, vaultSecretBackendSelected: true, vaultSecretProviderEnabled: true, vaultAddressConfigured: true, vaultAuthConfigured: true, vaultPathAllowed: false, credentialCacheAccessAllowed: false, credentialMaterialStored: false },
    context: { providerKind: "github", metadata: { providerId: "github", secretRefId: "secretref_vault_demo", vaultPathAllowed: false } },
    expectedDecision: { effect: "deny", reason: "Vault-backed provider credentials require allowlisted Vault path metadata before any future bundle runtime comparison can allow them.", ruleId: "policy_provider_credential_resolve_vault_path_deny" },
    riskLevel: "critical",
    notes: ["The fixture stores path allowlist status only, not a Vault address, path, key, token, or value."]
  },
  {
    id: "provider_credential_resolve_requires_auth_policy",
    description: "Provider credential resolution denies when configured credential metadata is missing.",
    domain: "secrets_vault",
    action: "provider.credential.resolve",
    subject: viewer,
    resource: resource({ resourceKind: "provider_credential", resourceId: "secretref_missing_demo", tenantId: "tenant_demo", metadata: { providerKind: "github" } }),
    environment: { credentialsConfigured: false, secretRefActive: false, credentialCacheAccessAllowed: false, credentialMaterialStored: false },
    context: { providerKind: "github", metadata: { providerId: "github", secretRefId: "secretref_missing_demo" } },
    expectedDecision: { effect: "deny", reason: "Provider credential resolution requires explicit safe runtime configuration.", ruleId: "policy_provider_credential_resolve_deny" },
    riskLevel: "critical",
    notes: ["Auth/RBAC and Policy must both allow before a real credential boundary can proceed."]
  },
  {
    id: "provider_credential_vault_gated_allowed",
    description: "Vault-backed provider credential policy allows only when explicit safe metadata gates pass.",
    domain: "secrets_vault",
    action: "provider.credential.resolve",
    subject: securityAdmin,
    resource: resource({ resourceKind: "provider_credential", resourceId: "secretref_vault_allowed_demo", tenantId: "tenant_demo", metadata: { providerKind: "github" } }),
    environment: { credentialsConfigured: true, secretRefActive: true, vaultSecretBackendSelected: true, vaultSecretProviderEnabled: true, vaultAddressConfigured: true, vaultAuthConfigured: true, vaultPathAllowed: true, credentialCacheAccessAllowed: false, credentialMaterialStored: false },
    context: { providerKind: "github", metadata: { providerId: "github", secretRefId: "secretref_vault_allowed_demo" } },
    expectedDecision: { effect: "allow", reason: "Provider credentials may be resolved from active Vault-backed SecretRefs only when Vault is explicitly selected, enabled, configured, and path-allowlisted.", ruleId: "policy_provider_credential_resolve_allow_vault_secretref_v1" },
    riskLevel: "critical",
    notes: ["The harness does not call Vault or return credential material."]
  },
  {
    id: "runner_secret_injection_denied",
    description: "Runner secret injection is denied.",
    domain: "secrets_vault",
    action: "runner.secret.inject",
    subject: system,
    resource: resource({ resourceKind: "runner", resourceId: "runner_demo", tenantId: "tenant_demo" }),
    environment: { secretsAllowed: false },
    context: { runnerKind: "mock", metadata: { secretRefId: "secretref_demo" } },
    expectedDecision: { effect: "deny", reason: "Secrets are not injected into runner processes in v0.", ruleId: "policy_runner_secret_inject_deny" },
    riskLevel: "critical",
    notes: ["Secret injection remains denied even for mock runners."]
  },
  {
    id: "local_agent_secret_forward_denied",
    description: "Local Agent secret forwarding is denied.",
    domain: "secrets_vault",
    action: "local_agent.secret.forward",
    subject: system,
    resource: resource({ resourceKind: "local_agent", resourceId: "agent_demo", tenantId: "tenant_demo" }),
    environment: { secretForwardingAllowed: false, mockTransport: true },
    context: { providerKind: "local_cli", metadata: { localAgentHostId: "host_demo" } },
    expectedDecision: { effect: "deny", reason: "Local Agent secret forwarding is out of scope for v0.", ruleId: "policy_local_agent_secret_forward_deny" },
    riskLevel: "critical",
    notes: ["No local daemon or secret forwarding path is implemented."]
  },
  {
    id: "runner_command_execution_denied_default",
    description: "Runner command execution denies by default.",
    domain: "runner",
    action: "runner.command.execute",
    subject: system,
    resource: resource({ resourceKind: "command", resourceId: "command_default", tenantId: "tenant_demo", metadata: { command: "node --version" } }),
    environment: { localCommandExecutionEnabled: false, harnessAllowed: false, workspaceSafe: false },
    context: { runnerKind: "local", command: "node --version", metadata: { workspaceKind: "fixture" } },
    expectedDecision: { effect: "deny", reason: "Command execution requires explicit local execution, harness, and workspace gates.", ruleId: "policy_runner_command_default_deny" },
    riskLevel: "high",
    notes: ["This uses command+metadata only and does not execute a process."]
  },
  {
    id: "runner_risky_remote_git_command_denied",
    description: "Runner remote Git commands are denied.",
    domain: "runner",
    action: "runner.command.execute",
    subject: system,
    resource: resource({ resourceKind: "command", resourceId: "command_remote_git", tenantId: "tenant_demo", metadata: { command: "git push origin main" } }),
    environment: { localCommandExecutionEnabled: true, harnessAllowed: true, workspaceSafe: true },
    context: { runnerKind: "local", command: "git push origin main", metadata: { workspaceKind: "fixture" } },
    expectedDecision: { effect: "deny", reason: "Runner may not run git fetch, push, merge, or rebase.", ruleId: "policy_runner_remote_git_command_deny" },
    riskLevel: "critical",
    notes: ["The command string is fixture metadata only."]
  },
  {
    id: "vendor_cli_execution_denied",
    description: "Direct local vendor CLI execution is denied.",
    domain: "local_agent",
    action: "local_cli.invoke",
    subject: system,
    resource: resource({ resourceKind: "local_cli", resourceId: "local_cli_provider_demo", tenantId: "tenant_demo" }),
    environment: { localCliExecutionAllowed: false },
    context: { providerKind: "local_cli", metadata: { credentialAccess: "never_read_tokens" } },
    expectedDecision: { effect: "deny", reason: "Aichestra Cloud must not execute local CLI providers directly.", ruleId: "policy_local_cli_direct_invoke_deny" },
    riskLevel: "critical",
    notes: ["Local CLI providers must go through future Local Agent consent boundaries."]
  },
  {
    id: "local_agent_consent_required",
    description: "Local Agent invocation blocks until consent is present.",
    domain: "local_agent",
    action: "local_agent.invoke",
    subject: developer,
    resource: resource({ resourceKind: "local_agent", resourceId: "agent_demo", tenantId: "tenant_demo", metadata: { status: "connected" } }),
    environment: { localAgentConnected: true, mockTransport: true },
    context: { providerKind: "local_cli", metadata: { consentLevel: "read_only", consentApproved: false, localAgentHostId: "host_demo" } },
    expectedDecision: { effect: "block", reason: "Aichestra Local Agent invocation requires explicit future user consent.", ruleId: "policy_local_agent_invoke_requires_consent" },
    riskLevel: "high",
    notes: ["Static require_approval maps to the PoC block effect."]
  },
  {
    id: "registry_pending_approval_denied",
    description: "Pending approval registry metadata denies mutation in golden fixtures.",
    domain: "registry",
    action: "registry.update",
    subject: system,
    resource: resource({ resourceKind: "registry_item", resourceId: "registry_pending_demo", tenantId: "tenant_demo" }),
    environment: { registryMutationRequested: true },
    context: { metadata: { registryPackageId: "package_demo", approvalStatus: "pending" } },
    expectedDecision: { effect: "deny", reason: "Pending approval registry entries cannot be treated as active or mutation-ready.", ruleId: "policy_registry_pending_approval_deny" },
    riskLevel: "high",
    notes: ["Resolver lifecycle gates remain authoritative outside this policy fixture."]
  },
  {
    id: "registry_checksum_mismatch_denied",
    description: "Checksum mismatch metadata denies registry mutation.",
    domain: "registry",
    action: "registry.update",
    subject: system,
    resource: resource({ resourceKind: "registry_item", resourceId: "registry_checksum_demo", tenantId: "tenant_demo" }),
    environment: { registryMutationRequested: true },
    context: { metadata: { registryPackageId: "package_demo", checksumValid: false } },
    expectedDecision: { effect: "deny", reason: "Registry mutations cannot bypass checksum mismatch evidence.", ruleId: "policy_registry_checksum_mismatch_deny" },
    riskLevel: "high",
    notes: ["Checksum verification remains a registry resolver gate as well."]
  },
  {
    id: "registry_mutation_without_permission_denied",
    description: "Registry mutation denies when the subject lacks mutation roles.",
    domain: "registry",
    action: "registry.update",
    subject: viewer,
    resource: resource({ resourceKind: "registry_item", resourceId: "registry_no_permission_demo", tenantId: "tenant_demo" }),
    environment: { registryMutationRequested: true },
    context: { metadata: { registryPackageId: "package_demo" } },
    expectedDecision: { effect: "deny", reason: "No policy rule allowed registry.update on registry_item.", ruleId: "policy_default_deny" },
    riskLevel: "high",
    notes: ["Mock RBAC and policy both remain authoritative for mutations."]
  },
  {
    id: "governance_apply_denied",
    description: "Governance apply remains denied.",
    domain: "governance",
    action: "improvement.apply",
    subject: system,
    resource: resource({ resourceKind: "draft_registry_change", resourceId: "draft_change_demo", tenantId: "tenant_demo" }),
    environment: { humanApproval: true, evalPassed: true, canaryReady: true, allowAutoApply: false },
    context: { metadata: { proposalId: "proposal_demo", registryPackageId: "package_demo" } },
    expectedDecision: { effect: "deny", reason: "Auto-improvement apply remains unavailable.", ruleId: "policy_improvement_apply_deny" },
    riskLevel: "critical",
    notes: ["Auto-improvement must not mutate active registry entries."]
  },
  {
    id: "auto_apply_denied",
    description: "Auto-apply remains denied even when fixture metadata asks for it.",
    domain: "governance",
    action: "improvement.apply",
    subject: system,
    resource: resource({ resourceKind: "draft_registry_change", resourceId: "draft_auto_apply_demo", tenantId: "tenant_demo" }),
    environment: { humanApproval: false, evalPassed: false, canaryReady: false, allowAutoApply: true },
    context: { metadata: { proposalId: "proposal_auto_apply_demo", registryPackageId: "package_demo" } },
    expectedDecision: { effect: "deny", reason: "Auto-improvement apply remains unavailable.", ruleId: "policy_improvement_apply_deny" },
    riskLevel: "critical",
    notes: ["The deny rule wins over any fixture metadata."]
  },
  {
    id: "dashboard_viewer_safe_metadata_allowed",
    description: "Viewer can read safe dashboard metadata.",
    domain: "dashboard_readiness",
    action: "dashboard.read",
    subject: viewer,
    resource: resource({ resourceKind: "dashboard", resourceId: "dashboard_policy_runtime_poc", tenantId: "tenant_demo" }),
    environment: { readOnly: true, sanitizedDto: true, secretsExposed: false, envValuesExposed: false },
    context: { metadata: { panel: "policy_runtime_poc", secretAdjacentDetailsRequested: false } },
    expectedDecision: { effect: "allow", reason: "Dashboard read models are read-only and may be viewed by default v0 roles.", ruleId: "policy_dashboard_read_allow_auth_v0" },
    riskLevel: "low",
    notes: ["Dashboard output remains sanitized read-model metadata."]
  },
  {
    id: "dashboard_viewer_secret_adjacent_denied",
    description: "Viewer cannot request raw secret-adjacent audit details.",
    domain: "dashboard_readiness",
    action: "audit.secret.view",
    subject: viewer,
    resource: resource({ resourceKind: "secret_scope", resourceId: "secret_scope_dashboard_demo", tenantId: "tenant_demo" }),
    environment: { readOnly: true, rawSecretViewRequested: true },
    context: { metadata: { panel: "security", secretAdjacentDetailsRequested: true } },
    expectedDecision: { effect: "deny", reason: "Secret audit viewing requires future production authorization.", ruleId: "policy_audit_secret_view_deny" },
    riskLevel: "critical",
    notes: ["Safe summaries are separate from raw secret-adjacent access."]
  },
  {
    id: "audit_query_requires_scope_future_denied",
    description: "Audit query without safe scope is denied through raw secret-view policy.",
    domain: "dashboard_readiness",
    action: "audit.secret.view",
    subject: securityAdmin,
    resource: resource({ resourceKind: "secret_scope", resourceId: "secret_scope_audit_demo", tenantId: "tenant_demo" }),
    environment: { auditQueryScopeConfigured: false, rawSecretViewRequested: true },
    context: { metadata: { auditQueryScope: "missing", retentionClass: "sensitive_metadata" } },
    expectedDecision: { effect: "deny", reason: "Secret audit viewing requires future production authorization.", ruleId: "policy_audit_secret_view_deny" },
    riskLevel: "critical",
    notes: ["Future scoped audit metadata may be readable, but raw secret views remain denied."]
  },
  {
    id: "production_ready_overclaim_denied",
    description: "Dashboard/readiness metadata cannot claim production policy runtime readiness.",
    domain: "dashboard_readiness",
    action: "dashboard.read",
    subject: system,
    resource: resource({ resourceKind: "dashboard", resourceId: "dashboard_policy_runtime_poc", tenantId: "tenant_demo" }),
    environment: { readOnly: true, sanitizedDto: true, productionReady: false },
    context: { metadata: { panel: "policy_runtime_poc", productionReadyOverclaim: true } },
    expectedDecision: { effect: "deny", reason: "Readiness surfaces must not claim production policy runtime readiness.", ruleId: "policy_dashboard_production_ready_overclaim_deny" },
    riskLevel: "critical",
    notes: ["This is a metadata sentinel, not a production readiness controller."]
  },
  {
    id: "missing_tenant_scope_does_not_grant_access",
    description: "Missing tenant scope does not grant remote Git access.",
    domain: "tenant_scope",
    action: "git.remote_operation",
    subject: subject({ actorId: "golden_no_tenant", roles: ["developer"], principalId: "principal_no_tenant" }),
    resource: resource({ resourceKind: "git_operation", resourceId: "repo_cross_tenant_demo", metadata: { providerKind: "github" } }),
    environment: { remoteGitEnabled: false, remoteOperationAllowed: false, repoAllowlisted: false, credentialsConfigured: false },
    context: { repoId: "repo_cross_tenant_demo", providerKind: "github", metadata: { tenantScopePresent: false } },
    expectedDecision: { effect: "deny", reason: "Remote Git operations require explicit v1 runtime gates.", ruleId: "policy_git_remote_operation_disabled_deny" },
    riskLevel: "critical",
    notes: ["Absence of tenant scope cannot create an allow path."]
  },
  {
    id: "tenant_scope_mismatch_future_denied",
    description: "Explicit tenant mismatch sentinel denies dashboard/readiness access in golden fixtures.",
    domain: "tenant_scope",
    action: "dashboard.read",
    subject: viewer,
    resource: resource({ resourceKind: "dashboard", resourceId: "dashboard_cross_tenant_demo", tenantId: "tenant_other" }),
    environment: { readOnly: true, sanitizedDto: true, secretsExposed: false },
    context: { metadata: { panel: "readiness", tenantScopeMismatch: true } },
    expectedDecision: { effect: "deny", reason: "Dashboard/readiness access cannot rely on a tenant scope mismatch sentinel.", ruleId: "policy_dashboard_tenant_scope_mismatch_deny" },
    riskLevel: "critical",
    notes: ["This sentinel documents future tenant enforcement expectations without implementing production tenancy."]
  },
  {
    id: "service_account_cannot_bypass_scope_policy",
    description: "Service account attribution cannot bypass repo allowlist policy.",
    domain: "tenant_scope",
    action: "github_app.installation_token.issue",
    subject: serviceAccount,
    resource: resource({ resourceKind: "github_app_installation", resourceId: "installation_cross_repo_demo", tenantId: "tenant_demo", metadata: { providerKind: "github" } }),
    environment: { githubAppEnabled: true, githubAppAuthMode: true, appIdConfigured: true, privateKeySecretRefConfigured: true, secretRefActive: true, installationAllowlisted: true, repoAllowlisted: false, privateKeyMaterialExposed: false, installationTokenExchangeEnabled: false, mockTokenProvider: true, destructiveOperation: false },
    context: { providerKind: "github", metadata: { repoId: "repo_not_allowlisted", serviceAccountId: "svc_git_adapter" } },
    expectedDecision: { effect: "deny", reason: "Installation token issuance requires the repository grant to match the allowlist.", ruleId: "policy_github_app_token_issue_deny_unallowlisted_repo" },
    riskLevel: "critical",
    notes: ["Service accounts are subject metadata, not a bypass."]
  }
];
