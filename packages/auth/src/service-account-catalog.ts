import type { RequestSource, ResourceScopeKind } from "./types.ts";

export type ServiceAccountActorStatus = "active_mock" | "disabled" | "future";
export type ServiceAccountActorRiskLevel = "low" | "medium" | "high" | "critical";
export type ServiceAccountActorKind =
  | "git_webhook"
  | "git_sync"
  | "github_app_token"
  | "git_provider"
  | "llm_gateway"
  | "llm_router"
  | "mcp_gateway"
  | "vault_credential_resolver"
  | "secretref_credential"
  | "runner"
  | "local_agent_protocol"
  | "registry_governance"
  | "improvement_governance"
  | "observability_read"
  | "dashboard_read"
  | "readiness_read"
  | "migration_future"
  | "deployment_future";

export type ServiceAccountAllowedScope = {
  scopeKind: ResourceScopeKind;
  scopeId?: string;
  description: string;
};

export type ServiceAccountActorCatalogEntry = {
  id: string;
  actorId: string;
  principalId: string;
  displayName: string;
  serviceAccountKind: ServiceAccountActorKind;
  ownerTeamId?: string;
  roleName: string;
  allowedActions: string[];
  forbiddenActions: string[];
  allowedResourceScopes: ServiceAccountAllowedScope[];
  status: ServiceAccountActorStatus;
  riskLevel: ServiceAccountActorRiskLevel;
  defaultSource: RequestSource;
  auditRequirements: string[];
  metadata: Record<string, unknown>;
};

const commonForbiddenActions = [
  "secret.read",
  "credential.cache.read",
  "credential.cache.upload",
  "runner.secret.inject",
  "local_agent.secret.forward",
  "git.merge",
  "git.rebase",
  "git.branch.delete"
];

function scope(scopeKind: ResourceScopeKind, description: string, scopeId?: string): ServiceAccountAllowedScope {
  return { scopeKind, scopeId, description };
}

export const serviceAccountActorCatalog: ServiceAccountActorCatalogEntry[] = [
  {
    id: "git_webhook_service",
    actorId: "git_webhook_service",
    principalId: "principal_git_webhook_service",
    displayName: "Git Webhook Service",
    serviceAccountKind: "git_webhook",
    ownerTeamId: "team_platform",
    roleName: "service_account_git_webhook",
    allowedActions: ["git.webhook.receive", "git.webhook.verify", "git.webhook.process", "git.repo.read"],
    forbiddenActions: commonForbiddenActions,
    allowedResourceScopes: [scope("repo", "Allowlisted repository webhook metadata."), scope("global", "Local mock webhook runtime metadata.")],
    status: "active_mock",
    riskLevel: "high",
    defaultSource: "webhook",
    auditRequirements: ["delivery_id", "repo_ref", "policy_decision_id", "service_account_id"],
    metadata: { localRuntimeOnly: true, productionIssuanceEnabled: false }
  },
  {
    id: "git_sync_service",
    actorId: "git_sync_service",
    principalId: "principal_git_sync_service",
    displayName: "Git Sync Service",
    serviceAccountKind: "git_sync",
    ownerTeamId: "team_platform",
    roleName: "service_account_git_sync",
    allowedActions: ["git.pull_request.sync", "git.branch.sync", "git.changed_files.read", "git.repo.read"],
    forbiddenActions: commonForbiddenActions,
    allowedResourceScopes: [scope("repo", "Repository PR and branch read-model metadata.")],
    status: "active_mock",
    riskLevel: "high",
    defaultSource: "worker",
    auditRequirements: ["repo_ref", "sync_state_id", "policy_decision_id", "service_account_id"],
    metadata: { localRuntimeOnly: true, productionIssuanceEnabled: false }
  },
  {
    id: "github_app_token_service",
    actorId: "github_app_token_service",
    principalId: "principal_github_app_token_service",
    displayName: "GitHub App Token Service",
    serviceAccountKind: "github_app_token",
    ownerTeamId: "team_security",
    roleName: "service_account_github_app_token",
    allowedActions: ["github_app.configure", "github_app.installation.use", "github_app.repo_grant.use", "github_app.installation_token.issue"],
    forbiddenActions: [...commonForbiddenActions, "provider.credential.resolve"],
    allowedResourceScopes: [scope("provider", "GitHub App installation metadata only."), scope("repo", "Allowlisted GitHub App repository grants.")],
    status: "active_mock",
    riskLevel: "critical",
    defaultSource: "system",
    auditRequirements: ["installation_id", "repo_ref", "token_handle_id", "policy_decision_id", "service_account_id"],
    metadata: { tokenHandlesOnly: true, productionIssuanceEnabled: false }
  },
  {
    id: "git_provider_service",
    actorId: "git_provider_service",
    principalId: "principal_git_provider_service",
    displayName: "Git Provider Service",
    serviceAccountKind: "git_provider",
    ownerTeamId: "team_platform",
    roleName: "service_account_git_provider",
    allowedActions: ["git.repo.read", "git.branch.create", "git.pull_request.create", "git.changed_files.read", "git.remote_operation", "git.credential.resolve"],
    forbiddenActions: commonForbiddenActions,
    allowedResourceScopes: [scope("repo", "Mock or explicitly gated provider repository operations.")],
    status: "active_mock",
    riskLevel: "high",
    defaultSource: "system",
    auditRequirements: ["repo_id", "operation", "policy_decision_id", "service_account_id"],
    metadata: { remoteGatesStillRequired: true, productionIssuanceEnabled: false }
  },
  {
    id: "llm_gateway_service",
    actorId: "llm_gateway_service",
    principalId: "principal_llm_gateway_service",
    displayName: "LLM Gateway Service",
    serviceAccountKind: "llm_gateway",
    ownerTeamId: "team_platform",
    roleName: "service_account_llm_gateway",
    allowedActions: ["llm.completion", "llm.remote_completion", "llm.model.use", "llm.route.select", "llm.credential.resolve", "provider.credential.resolve"],
    forbiddenActions: [...commonForbiddenActions, "provider.local_cli.invoke", "provider.pty.invoke"],
    allowedResourceScopes: [scope("provider", "LLM provider and model metadata."), scope("task", "Task and task run attribution.")],
    status: "active_mock",
    riskLevel: "high",
    defaultSource: "system",
    auditRequirements: ["task_id", "task_run_id", "provider_id", "model_id", "service_account_id"],
    metadata: { providerGatesStillRequired: true, productionIssuanceEnabled: false }
  },
  {
    id: "llm_router_service",
    actorId: "llm_router_service",
    principalId: "principal_llm_router_service",
    displayName: "LLM Router Service",
    serviceAccountKind: "llm_router",
    ownerTeamId: "team_platform",
    roleName: "service_account_llm_router",
    allowedActions: ["llm.route.select", "llm.fallback", "llm.model.use"],
    forbiddenActions: [...commonForbiddenActions, "llm.remote_completion", "provider.credential.resolve"],
    allowedResourceScopes: [scope("provider", "Route and fallback policy metadata."), scope("task", "Task and task run attribution.")],
    status: "active_mock",
    riskLevel: "medium",
    defaultSource: "system",
    auditRequirements: ["route_id", "fallback_policy_id", "policy_decision_id", "service_account_id"],
    metadata: { boundedFallbackRequired: true, productionIssuanceEnabled: false }
  },
  {
    id: "mcp_gateway_service",
    actorId: "mcp_gateway_service",
    principalId: "principal_mcp_gateway_service",
    displayName: "MCP Gateway Service",
    serviceAccountKind: "mcp_gateway",
    ownerTeamId: "team_platform",
    roleName: "service_account_mcp_gateway",
    allowedActions: ["mcp.server.list", "mcp.tool.list", "mcp.tool.invoke.low_risk"],
    forbiddenActions: [...commonForbiddenActions, "mcp.tool.secret.resolve", "mcp.tool.network_access", "mcp.tool.write", "mcp.tool.deploy"],
    allowedResourceScopes: [scope("provider", "Mock MCP gateway metadata."), scope("task", "Task scoped low-risk invocation metadata.")],
    status: "active_mock",
    riskLevel: "critical",
    defaultSource: "system",
    auditRequirements: ["server_id", "tool_id", "risk_level", "policy_decision_id", "service_account_id"],
    metadata: { realTransportEnabled: false, productionIssuanceEnabled: false }
  },
  {
    id: "vault_credential_resolver_service",
    actorId: "vault_credential_resolver_service",
    principalId: "principal_vault_credential_resolver_service",
    displayName: "Vault Credential Resolver Service",
    serviceAccountKind: "vault_credential_resolver",
    ownerTeamId: "team_security",
    roleName: "service_account_vault_credential_resolver",
    allowedActions: ["provider.credential.resolve", "git.credential.resolve", "llm.credential.resolve", "secret.lease.request", "secret.lease.issue"],
    forbiddenActions: [...commonForbiddenActions, "secret.lease.revoke"],
    allowedResourceScopes: [scope("provider", "Gated provider credential handles."), scope("global", "Local mock credential resolution metadata.")],
    status: "active_mock",
    riskLevel: "critical",
    defaultSource: "system",
    auditRequirements: ["secret_ref_id", "lease_id", "policy_decision_id", "service_account_id"],
    metadata: { vaultDefaultEnabled: false, productionIssuanceEnabled: false }
  },
  {
    id: "secretref_credential_service",
    actorId: "secretref_credential_service",
    principalId: "principal_secretref_credential_service",
    displayName: "SecretRef Credential Service",
    serviceAccountKind: "secretref_credential",
    ownerTeamId: "team_security",
    roleName: "service_account_secretref_credential",
    allowedActions: ["provider.credential.resolve", "git.credential.resolve", "llm.credential.resolve", "secret.lease.request", "secret.lease.issue"],
    forbiddenActions: [...commonForbiddenActions, "secret.lease.revoke"],
    allowedResourceScopes: [scope("provider", "Gated provider credential handles."), scope("global", "Local mock credential resolution metadata.")],
    status: "active_mock",
    riskLevel: "critical",
    defaultSource: "system",
    auditRequirements: ["secret_ref_id", "purpose", "policy_decision_id", "service_account_id"],
    metadata: { valuesReturnedToApi: false, productionIssuanceEnabled: false }
  },
  {
    id: "runner_service",
    actorId: "runner_service",
    principalId: "principal_runner_service_boundary",
    displayName: "Runner Service",
    serviceAccountKind: "runner",
    ownerTeamId: "team_development",
    roleName: "service_account_runner_boundary",
    allowedActions: ["task.run", "runner.execute", "runner.command.execute", "llm.completion", "git.branch.create", "git.pull_request.create"],
    forbiddenActions: [...commonForbiddenActions, "network.egress"],
    allowedResourceScopes: [scope("task", "Task and task run execution metadata."), scope("project", "Future project workspace metadata.")],
    status: "active_mock",
    riskLevel: "high",
    defaultSource: "worker",
    auditRequirements: ["task_id", "task_run_id", "runner_kind", "policy_decision_id", "service_account_id"],
    metadata: { commandPolicyStillAuthoritative: true, productionIssuanceEnabled: false }
  },
  {
    id: "local_agent_protocol_service",
    actorId: "local_agent_protocol_service",
    principalId: "principal_local_agent_protocol_service",
    displayName: "Local Agent Protocol Service",
    serviceAccountKind: "local_agent_protocol",
    ownerTeamId: "team_platform",
    roleName: "service_account_local_agent_protocol",
    allowedActions: ["local_agent.register", "local_agent.channel.create", "local_agent.handshake.verify", "local_agent.capability.advertise", "local_agent.compatibility.check", "local_agent.event.receive", "local_agent.stream.receive", "local_agent.cancel"],
    forbiddenActions: [...commonForbiddenActions, "local_cli.invoke", "local_cli.shell_execution", "local_cli.network_access", "local_cli.danger_full_access"],
    allowedResourceScopes: [scope("local_agent", "Local Agent metadata and consent coordination.")],
    status: "active_mock",
    riskLevel: "high",
    defaultSource: "local_agent",
    auditRequirements: ["agent_id", "consent_id", "invocation_id", "policy_decision_id", "service_account_id"],
    metadata: { realDaemonEnabled: false, productionIssuanceEnabled: false }
  },
  {
    id: "registry_governance_service",
    actorId: "registry_governance_service",
    principalId: "principal_registry_governance_service",
    displayName: "Registry Governance Service",
    serviceAccountKind: "registry_governance",
    ownerTeamId: "team_platform",
    roleName: "service_account_registry_governance",
    allowedActions: [
      "registry.read",
      "registry.create",
      "registry.update",
      "registry.approve",
      "registry.rollback",
      "registry.eval.attach",
      "registry.package.create",
      "registry.package.update",
      "registry.resolve"
    ],
    forbiddenActions: [...commonForbiddenActions, "improvement.apply"],
    allowedResourceScopes: [scope("registry", "Registry mutation and approval metadata.")],
    status: "active_mock",
    riskLevel: "high",
    defaultSource: "system",
    auditRequirements: ["registry_item_id", "revision_id", "policy_decision_id", "service_account_id"],
    metadata: { activeMutationMigrationPartial: true, productionIssuanceEnabled: false }
  },
  {
    id: "improvement_governance_service",
    actorId: "improvement_governance_service",
    principalId: "principal_improvement_governance_service",
    displayName: "Improvement Governance Service",
    serviceAccountKind: "improvement_governance",
    ownerTeamId: "team_platform",
    roleName: "service_account_improvement_governance",
    allowedActions: [
      "improvement.proposal.create",
      "improvement.proposal.approve",
      "improvement.eval.attach",
      "improvement.canary.readiness",
      "improvement.apply_gate.check",
      "improvement.draft_change.prepare"
    ],
    forbiddenActions: [...commonForbiddenActions, "improvement.apply"],
    allowedResourceScopes: [scope("registry", "Draft proposal and governance metadata.")],
    status: "active_mock",
    riskLevel: "high",
    defaultSource: "system",
    auditRequirements: ["proposal_id", "draft_change_id", "policy_decision_id", "service_account_id"],
    metadata: { applyGateStillDenied: true, productionIssuanceEnabled: false }
  },
  {
    id: "observability_read_service",
    actorId: "observability_read_service",
    principalId: "principal_observability_read_service",
    displayName: "Observability Read Service",
    serviceAccountKind: "observability_read",
    ownerTeamId: "team_security",
    roleName: "service_account_observability_read",
    allowedActions: ["dashboard.read", "auth.read", "policy.audit.read", "security.audit.read", "git.audit.read", "llm.audit.read", "mcp.audit.read", "observability.audit.read"],
    forbiddenActions: [...commonForbiddenActions, "audit.secret.view"],
    allowedResourceScopes: [scope("global", "Sanitized read-only audit aggregation.")],
    status: "active_mock",
    riskLevel: "medium",
    defaultSource: "system",
    auditRequirements: ["retention_class", "redaction_class", "service_account_id"],
    metadata: { externalExportEnabled: false, productionIssuanceEnabled: false }
  },
  {
    id: "dashboard_read_service",
    actorId: "dashboard_read_service",
    principalId: "principal_dashboard_read_service",
    displayName: "Dashboard Read Service",
    serviceAccountKind: "dashboard_read",
    ownerTeamId: "team_platform",
    roleName: "service_account_dashboard_read",
    allowedActions: ["dashboard.read", "auth.read"],
    forbiddenActions: commonForbiddenActions,
    allowedResourceScopes: [scope("global", "Mock read-only dashboard composition.")],
    status: "active_mock",
    riskLevel: "low",
    defaultSource: "dashboard",
    auditRequirements: ["read_model", "service_account_id"],
    metadata: { readOnly: true, productionIssuanceEnabled: false }
  },
  {
    id: "readiness_read_service",
    actorId: "readiness_read_service",
    principalId: "principal_readiness_read_service",
    displayName: "Readiness Read Service",
    serviceAccountKind: "readiness_read",
    ownerTeamId: "team_platform",
    roleName: "service_account_readiness_read",
    allowedActions: ["dashboard.read", "auth.read", "readiness.read"],
    forbiddenActions: commonForbiddenActions,
    allowedResourceScopes: [scope("global", "Planning-only readiness metadata.")],
    status: "active_mock",
    riskLevel: "low",
    defaultSource: "readiness",
    auditRequirements: ["readiness_surface", "service_account_id"],
    metadata: { readOnly: true, planningOnly: true, productionIssuanceEnabled: false }
  },
  {
    id: "migration_service_future",
    actorId: "migration_service_future",
    principalId: "principal_migration_service_future",
    displayName: "Migration Service Future",
    serviceAccountKind: "migration_future",
    ownerTeamId: "team_platform",
    roleName: "service_account_migration_future",
    allowedActions: [],
    forbiddenActions: [...commonForbiddenActions, "database.migration.execute"],
    allowedResourceScopes: [scope("global", "Future explicit migration execution metadata.")],
    status: "future",
    riskLevel: "critical",
    defaultSource: "system",
    auditRequirements: ["migration_id", "operator_actor_id", "service_account_id"],
    metadata: { futureOnly: true, productionIssuanceEnabled: false }
  },
  {
    id: "deployment_service_future",
    actorId: "deployment_service_future",
    principalId: "principal_deployment_service_future",
    displayName: "Deployment Service Future",
    serviceAccountKind: "deployment_future",
    ownerTeamId: "team_platform",
    roleName: "service_account_deployment_future",
    allowedActions: [],
    forbiddenActions: [...commonForbiddenActions, "deployment.execute"],
    allowedResourceScopes: [scope("global", "Future deployment execution metadata.")],
    status: "future",
    riskLevel: "critical",
    defaultSource: "system",
    auditRequirements: ["deployment_plan_id", "approval_id", "service_account_id"],
    metadata: { futureOnly: true, productionIssuanceEnabled: false }
  }
];

export function listServiceAccountActorCatalog(): ServiceAccountActorCatalogEntry[] {
  return structuredClone(serviceAccountActorCatalog);
}

export function getServiceAccountActorCatalogEntry(id: string): ServiceAccountActorCatalogEntry | undefined {
  return structuredClone(serviceAccountActorCatalog.find((entry) => entry.id === id || entry.actorId === id));
}

export function requireServiceAccountActorCatalogEntry(id: string): ServiceAccountActorCatalogEntry {
  const entry = getServiceAccountActorCatalogEntry(id);
  if (!entry) throw new Error(`service_account_unknown:${id}`);
  return entry;
}

export function requireActiveServiceAccountActorCatalogEntry(id: string): ServiceAccountActorCatalogEntry {
  const entry = requireServiceAccountActorCatalogEntry(id);
  if (entry.status !== "active_mock") throw new Error(`service_account_not_active:${entry.id}:${entry.status}`);
  return entry;
}
