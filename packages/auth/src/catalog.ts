import type {
  Actor,
  IdentityProvider,
  Permission,
  Principal,
  ResourceScope,
  Role,
  RoleBinding,
  ServiceAccount,
  Team
} from "./types.ts";

const createdAt = new Date("2026-05-12T00:00:00.000Z");

export type AuthCatalog = {
  principals: Principal[];
  actors: Actor[];
  teams: Team[];
  roles: Role[];
  permissions: Permission[];
  roleBindings: RoleBinding[];
  serviceAccounts: ServiceAccount[];
  identityProviders: IdentityProvider[];
};

function globalScope(id = "scope_global"): ResourceScope {
  return {
    id,
    scopeKind: "global",
    description: "Global mock runtime scope.",
    metadata: { production: false }
  };
}

function taskScope(taskId: string): ResourceScope {
  return {
    id: `scope_task_${taskId}`,
    scopeKind: "task",
    scopeId: taskId,
    description: `Task scope ${taskId}.`,
    metadata: { production: false }
  };
}

export const defaultAuthPermissions: Permission[] = [
  { id: "perm_task_create", action: "task.create", resourceKind: "task", description: "Create tasks.", riskLevel: "low" },
  { id: "perm_task_run", action: "task.run", resourceKind: "task", description: "Run tasks.", riskLevel: "medium" },
  { id: "perm_task_read", action: "task.read", resourceKind: "task", description: "Read tasks.", riskLevel: "low" },
  { id: "perm_git_repo_read", action: "git.repo.read", resourceKind: "repo", description: "Read repository metadata.", riskLevel: "low" },
  { id: "perm_git_branch_create", action: "git.branch.create", resourceKind: "branch", description: "Create branches through gated providers.", riskLevel: "medium" },
  { id: "perm_git_pull_request_create", action: "git.pull_request.create", resourceKind: "pull_request", description: "Create pull requests through gated providers.", riskLevel: "medium" },
  { id: "perm_git_remote_operation", action: "git.remote_operation", resourceKind: "git_operation", description: "Use remote Git operation boundary.", riskLevel: "high" },
  { id: "perm_git_credential_resolve", action: "git.credential.resolve", resourceKind: "provider_credential", description: "Resolve Git provider credentials through the security boundary.", riskLevel: "critical" },
  { id: "perm_git_webhook_process", action: "git.webhook.process", resourceKind: "git_operation", description: "Process verified webhook metadata.", riskLevel: "medium" },
  { id: "perm_git_audit_read", action: "git.audit.read", resourceKind: "git_operation", description: "Read Git audit events.", riskLevel: "low" },
  { id: "perm_git_merge", action: "git.merge", resourceKind: "git_operation", description: "Future provider merge boundary; policy denied by default.", riskLevel: "critical" },
  { id: "perm_git_rebase", action: "git.rebase", resourceKind: "git_operation", description: "Future provider rebase boundary; policy denied by default.", riskLevel: "critical" },
  { id: "perm_llm_completion", action: "llm.completion", resourceKind: "llm_provider", description: "Run model completions through gateway.", riskLevel: "medium" },
  { id: "perm_llm_remote_completion", action: "llm.remote_completion", resourceKind: "llm_provider", description: "Use remote LLM completion boundary.", riskLevel: "high" },
  { id: "perm_llm_model_use", action: "llm.model.use", resourceKind: "llm_model", description: "Use catalog models.", riskLevel: "medium" },
  { id: "perm_llm_route_select", action: "llm.route.select", resourceKind: "llm_route", description: "Select LLM routes through the gateway.", riskLevel: "medium" },
  { id: "perm_llm_fallback", action: "llm.fallback", resourceKind: "llm_fallback_policy", description: "Use bounded LLM fallback policy.", riskLevel: "high" },
  { id: "perm_llm_credential_resolve", action: "llm.credential.resolve", resourceKind: "provider_credential", description: "Resolve LLM provider credentials through the security boundary.", riskLevel: "critical" },
  { id: "perm_llm_audit_read", action: "llm.audit.read", resourceKind: "llm_provider", description: "Read LLM audit events.", riskLevel: "low" },
  { id: "perm_runner_execute", action: "runner.execute", resourceKind: "runner", description: "Run agent runner boundary.", riskLevel: "medium" },
  { id: "perm_runner_command_execute", action: "runner.command.execute", resourceKind: "command", description: "Execute controlled fixture commands.", riskLevel: "high" },
  { id: "perm_registry_read", action: "registry.read", resourceKind: "registry_item", description: "Read registry entries.", riskLevel: "low" },
  { id: "perm_registry_create", action: "registry.create", resourceKind: "registry_item", description: "Create registry entries.", riskLevel: "medium" },
  { id: "perm_registry_update", action: "registry.update", resourceKind: "registry_item", description: "Update registry entries.", riskLevel: "medium" },
  { id: "perm_registry_approve", action: "registry.approve", resourceKind: "registry_item", description: "Approve registry entries.", riskLevel: "high" },
  { id: "perm_registry_rollback", action: "registry.rollback", resourceKind: "registry_item", description: "Rollback registry entries.", riskLevel: "high" },
  { id: "perm_improvement_proposal_create", action: "improvement.proposal.create", resourceKind: "improvement_proposal", description: "Create improvement proposals.", riskLevel: "medium" },
  { id: "perm_improvement_proposal_approve", action: "improvement.proposal.approve", resourceKind: "improvement_proposal", description: "Approve proposal intent.", riskLevel: "high" },
  { id: "perm_improvement_eval_attach", action: "improvement.eval.attach", resourceKind: "improvement_proposal", description: "Attach eval metadata.", riskLevel: "medium" },
  { id: "perm_improvement_apply", action: "improvement.apply", resourceKind: "draft_registry_change", description: "Future apply boundary; policy denied by default.", riskLevel: "critical" },
  { id: "perm_provider_invoke", action: "provider.invoke", resourceKind: "provider", description: "Invoke provider boundary.", riskLevel: "high" },
  { id: "perm_provider_credential_resolve", action: "provider.credential.resolve", resourceKind: "provider_credential", description: "Resolve credential metadata through security boundary.", riskLevel: "critical" },
  { id: "perm_secret_ref_create", action: "secret.ref.create", resourceKind: "secret_ref", description: "Create SecretRef metadata without raw values.", riskLevel: "high" },
  { id: "perm_secret_ref_update", action: "secret.ref.update", resourceKind: "secret_ref", description: "Update SecretRef metadata without raw values.", riskLevel: "high" },
  { id: "perm_secret_ref_disable", action: "secret.ref.disable", resourceKind: "secret_ref", description: "Disable SecretRef metadata.", riskLevel: "high" },
  { id: "perm_secret_ref_revoke", action: "secret.ref.revoke", resourceKind: "secret_ref", description: "Revoke SecretRef metadata.", riskLevel: "critical" },
  { id: "perm_secret_read", action: "secret.read", resourceKind: "secret_scope", description: "Future direct secret read; policy denied by default.", riskLevel: "critical" },
  { id: "perm_secret_lease_request", action: "secret.lease.request", resourceKind: "secret_lease", description: "Request secret lease metadata.", riskLevel: "high" },
  { id: "perm_secret_lease_issue", action: "secret.lease.issue", resourceKind: "secret_lease", description: "Issue secret lease metadata.", riskLevel: "critical" },
  { id: "perm_secret_audit_read", action: "secret.audit.read", resourceKind: "secret_scope", description: "Read credential and secret audit metadata.", riskLevel: "medium" },
  { id: "perm_security_audit_read", action: "security.audit.read", resourceKind: "secret_scope", description: "Read security audit.", riskLevel: "medium" },
  { id: "perm_policy_evaluate", action: "policy.evaluate", resourceKind: "policy", description: "Evaluate policy.", riskLevel: "medium" },
  { id: "perm_policy_audit_read", action: "policy.audit.read", resourceKind: "policy", description: "Read policy audit.", riskLevel: "medium" },
  { id: "perm_local_agent_invoke", action: "local_agent.invoke", resourceKind: "local_agent", description: "Invoke Local Agent protocol boundary.", riskLevel: "high" },
  { id: "perm_local_agent_consent_approve", action: "local_agent.consent.approve", resourceKind: "local_agent", description: "Approve Local Agent consent metadata.", riskLevel: "high" },
  { id: "perm_dashboard_read", action: "dashboard.read", resourceKind: "dashboard", description: "Read dashboard read models.", riskLevel: "low" },
  { id: "perm_mcp_server_list", action: "mcp.server.list", resourceKind: "mcp_server", description: "List MCP server catalog metadata.", riskLevel: "low" },
  { id: "perm_mcp_tool_list", action: "mcp.tool.list", resourceKind: "mcp_tool", description: "List MCP tool catalog metadata.", riskLevel: "low" },
  { id: "perm_mcp_tool_invoke_low_risk", action: "mcp.tool.invoke.low_risk", resourceKind: "mcp_tool", description: "Invoke low-risk read-only mock MCP tools.", riskLevel: "medium" },
  { id: "perm_mcp_tool_invoke_high_risk", action: "mcp.tool.invoke.high_risk", resourceKind: "mcp_tool", description: "Future high-risk MCP invocation boundary.", riskLevel: "high" },
  { id: "perm_mcp_tool_invoke_critical", action: "mcp.tool.invoke.critical", resourceKind: "mcp_tool", description: "Future critical MCP invocation boundary.", riskLevel: "critical" },
  { id: "perm_mcp_audit_read", action: "mcp.audit.read", resourceKind: "mcp_tool", description: "Read MCP audit metadata.", riskLevel: "medium" },
  { id: "perm_auth_read", action: "auth.read", resourceKind: "auth", description: "Read auth/RBAC metadata.", riskLevel: "low" },
  { id: "perm_auth_authorize_check", action: "auth.authorize.check", resourceKind: "auth", description: "Check authorization decisions.", riskLevel: "medium" },
  { id: "perm_auth_admin", action: "auth.admin", resourceKind: "auth", description: "Future auth administration boundary.", riskLevel: "critical" }
];

function permissions(...actions: string[]): string[] {
  return defaultAuthPermissions.filter((permission) => actions.includes(permission.action)).map((permission) => permission.id);
}

const allPermissionIds = defaultAuthPermissions.map((permission) => permission.id);

export const defaultAuthRoles: Role[] = [
  {
    id: "role_system_admin",
    name: "system_admin",
    description: "Local mock system administrator. Not production auth.",
    permissions: allPermissionIds,
    status: "active",
    metadata: { productionOnlyFuture: true }
  },
  {
    id: "role_platform_admin",
    name: "platform_admin",
    description: "Manage platform configuration while still obeying policy gates.",
    permissions: permissions(
      "dashboard.read",
      "auth.read",
      "auth.authorize.check",
      "auth.admin",
      "registry.read",
      "registry.create",
      "registry.update",
      "registry.approve",
      "registry.rollback",
      "policy.evaluate",
      "policy.audit.read",
      "provider.invoke",
      "provider.credential.resolve",
      "git.credential.resolve",
      "llm.credential.resolve",
      "secret.ref.create",
      "secret.ref.update",
      "secret.ref.disable",
      "secret.ref.revoke",
      "git.repo.read",
      "git.branch.create",
      "git.pull_request.create",
      "git.remote_operation",
      "git.webhook.process",
      "git.audit.read",
      "git.merge",
      "git.rebase",
      "llm.completion",
      "llm.remote_completion",
      "llm.model.use",
      "llm.route.select",
      "llm.fallback",
      "llm.audit.read",
      "runner.execute",
      "runner.command.execute",
      "secret.audit.read",
      "security.audit.read",
      "mcp.server.list",
      "mcp.tool.list",
      "mcp.tool.invoke.low_risk",
      "mcp.tool.invoke.high_risk",
      "mcp.tool.invoke.critical",
      "mcp.audit.read"
    ),
    status: "active",
    metadata: {}
  },
  {
    id: "role_developer",
    name: "developer",
    description: "Run mock/local-safe development workflows.",
    permissions: permissions("dashboard.read", "task.read", "task.create", "task.run", "git.repo.read", "git.branch.create", "git.pull_request.create", "runner.execute", "llm.completion", "llm.model.use", "llm.route.select", "registry.read", "mcp.server.list", "mcp.tool.list", "mcp.tool.invoke.low_risk"),
    status: "active",
    metadata: {}
  },
  {
    id: "role_reviewer",
    name: "reviewer",
    description: "Review registry and improvement governance metadata.",
    permissions: permissions("dashboard.read", "task.read", "registry.read", "registry.approve", "improvement.proposal.approve", "improvement.eval.attach", "git.repo.read", "mcp.server.list", "mcp.tool.list", "mcp.audit.read"),
    status: "active",
    metadata: {}
  },
  {
    id: "role_security_admin",
    name: "security_admin",
    description: "Inspect security and policy audit state without direct secret reads.",
    permissions: permissions("dashboard.read", "auth.read", "auth.authorize.check", "secret.lease.request", "secret.audit.read", "security.audit.read", "policy.audit.read", "provider.credential.resolve", "git.credential.resolve", "llm.credential.resolve", "mcp.server.list", "mcp.tool.list", "mcp.audit.read"),
    status: "active",
    metadata: {}
  },
  {
    id: "role_service_account_runner",
    name: "service_account_runner",
    description: "Scoped service account role for runner automation.",
    permissions: permissions("task.run", "runner.execute", "llm.completion", "llm.model.use", "llm.route.select", "git.branch.create", "mcp.tool.invoke.low_risk"),
    status: "active",
    metadata: { requiresScope: true }
  },
  {
    id: "role_viewer",
    name: "viewer",
    description: "Read-only dashboard access.",
    permissions: permissions("dashboard.read", "mcp.server.list", "mcp.tool.list"),
    status: "active",
    metadata: {}
  }
];

export function createDefaultAuthCatalog(): AuthCatalog {
  const principals: Principal[] = [
    { id: "principal_mock_admin", principalKind: "system", displayName: "Mock Admin Principal", status: "active", identityProviderId: "idp_mock", externalSubject: "mock-admin", createdAt, updatedAt: createdAt, metadata: { mock: true } },
    { id: "principal_demo_developer", principalKind: "user", displayName: "Demo Developer", email: "developer@example.com", status: "active", identityProviderId: "idp_mock", externalSubject: "user_demo_developer", createdAt, updatedAt: createdAt, metadata: { mock: true } },
    { id: "principal_demo_viewer", principalKind: "user", displayName: "Demo Viewer", email: "viewer@example.com", status: "active", identityProviderId: "idp_mock", externalSubject: "user_demo_viewer", createdAt, updatedAt: createdAt, metadata: { mock: true } },
    { id: "principal_demo_reviewer", principalKind: "user", displayName: "Demo Reviewer", email: "reviewer@example.com", status: "active", identityProviderId: "idp_mock", externalSubject: "user_demo_reviewer", createdAt, updatedAt: createdAt, metadata: { mock: true } },
    { id: "principal_security_admin", principalKind: "user", displayName: "Demo Security Admin", email: "security@example.com", status: "active", identityProviderId: "idp_mock", externalSubject: "user_security_admin", createdAt, updatedAt: createdAt, metadata: { mock: true } },
    { id: "principal_runner_service", principalKind: "service_account", displayName: "Runner Service Account", status: "active", identityProviderId: "idp_mock", externalSubject: "svc_runner", createdAt, updatedAt: createdAt, metadata: { mock: true } },
    { id: "principal_anonymous_mock", principalKind: "system", displayName: "Anonymous Mock Principal", status: "disabled", identityProviderId: "idp_mock", externalSubject: "anonymous", createdAt, updatedAt: createdAt, metadata: { mock: true, authenticated: false } }
  ];
  const teams: Team[] = [
    { id: "team_platform", name: "platform", displayName: "Platform", status: "active", metadata: {} },
    { id: "team_security", name: "security", displayName: "Security", status: "active", metadata: {} },
    { id: "team_development", name: "development", displayName: "Development", status: "active", metadata: {} }
  ];
  const actors: Actor[] = [
    { id: "mock-admin", principalId: "principal_mock_admin", actorKind: "anonymous_mock", displayName: "Mock Admin", roles: ["system_admin", "platform_admin"], teams: ["team_platform"], status: "active", createdAt, updatedAt: createdAt, metadata: { mock: true, productionAuth: false } },
    { id: "user_demo_developer", principalId: "principal_demo_developer", actorKind: "human_user", displayName: "Demo Developer", roles: ["developer"], teams: ["team_development"], status: "active", createdAt, updatedAt: createdAt, metadata: { mock: true } },
    { id: "user_demo_viewer", principalId: "principal_demo_viewer", actorKind: "human_user", displayName: "Demo Viewer", roles: ["viewer"], teams: [], status: "active", createdAt, updatedAt: createdAt, metadata: { mock: true } },
    { id: "user_demo_reviewer", principalId: "principal_demo_reviewer", actorKind: "human_user", displayName: "Demo Reviewer", roles: ["reviewer"], teams: ["team_development"], status: "active", createdAt, updatedAt: createdAt, metadata: { mock: true } },
    { id: "user_security_admin", principalId: "principal_security_admin", actorKind: "human_user", displayName: "Demo Security Admin", roles: ["security_admin"], teams: ["team_security"], status: "active", createdAt, updatedAt: createdAt, metadata: { mock: true } },
    { id: "svc_runner", principalId: "principal_runner_service", actorKind: "service_account", displayName: "Runner Service", roles: ["service_account_runner"], teams: ["team_development"], status: "active", createdAt, updatedAt: createdAt, metadata: { mock: true } },
    { id: "anonymous-mock", principalId: "principal_anonymous_mock", actorKind: "anonymous_mock", displayName: "Anonymous Mock", roles: [], teams: [], status: "disabled", createdAt, updatedAt: createdAt, metadata: { mock: true, authenticated: false } }
  ];
  const roleBindings: RoleBinding[] = [
    { id: "binding_mock_admin_system_admin", principalId: "principal_mock_admin", roleId: "role_system_admin", scope: globalScope(), status: "active", createdAt, updatedAt: createdAt },
    { id: "binding_mock_admin_platform_admin", principalId: "principal_mock_admin", roleId: "role_platform_admin", scope: globalScope(), status: "active", createdAt, updatedAt: createdAt },
    { id: "binding_developer", principalId: "principal_demo_developer", roleId: "role_developer", scope: globalScope(), status: "active", createdAt, updatedAt: createdAt },
    { id: "binding_viewer", principalId: "principal_demo_viewer", roleId: "role_viewer", scope: globalScope(), status: "active", createdAt, updatedAt: createdAt },
    { id: "binding_reviewer", principalId: "principal_demo_reviewer", roleId: "role_reviewer", scope: globalScope(), status: "active", createdAt, updatedAt: createdAt },
    { id: "binding_security_admin", principalId: "principal_security_admin", roleId: "role_security_admin", scope: globalScope(), status: "active", createdAt, updatedAt: createdAt },
    { id: "binding_runner_task_demo", principalId: "principal_runner_service", roleId: "role_service_account_runner", scope: taskScope("task_demo_backend"), status: "active", createdAt, updatedAt: createdAt }
  ];
  return {
    principals,
    actors,
    teams,
    roles: defaultAuthRoles,
    permissions: defaultAuthPermissions,
    roleBindings,
    serviceAccounts: [
      {
        id: "svcacct_runner",
        principalId: "principal_runner_service",
        name: "runner-service",
        ownerTeamId: "team_development",
        allowedScopes: [taskScope("task_demo_backend")],
        status: "active",
        createdAt,
        updatedAt: createdAt,
        metadata: { mock: true, rawCredentialStored: false }
      }
    ],
    identityProviders: [
      { id: "idp_mock", providerKind: "mock", displayName: "Mock Auth Provider", status: "active", metadata: { productionAuth: false } },
      { id: "idp_oidc_future", providerKind: "oidc_future", displayName: "Future OIDC Provider", status: "disabled", metadata: { notImplemented: true } },
      { id: "idp_saml_future", providerKind: "saml_future", displayName: "Future SAML Provider", status: "disabled", metadata: { notImplemented: true } },
      { id: "idp_scim_future", providerKind: "scim_future", displayName: "Future SCIM Directory", status: "disabled", metadata: { notImplemented: true } },
      { id: "idp_github_future", providerKind: "github_future", displayName: "Future GitHub Identity Provider", status: "disabled", metadata: { notImplemented: true } },
      { id: "idp_google_future", providerKind: "google_future", displayName: "Future Google Identity Provider", status: "disabled", metadata: { notImplemented: true } },
      { id: "idp_microsoft_future", providerKind: "microsoft_future", displayName: "Future Microsoft Identity Provider", status: "disabled", metadata: { notImplemented: true } },
      { id: "idp_custom_future", providerKind: "custom_future", displayName: "Future Custom Identity Provider", status: "disabled", metadata: { notImplemented: true } }
    ]
  };
}
