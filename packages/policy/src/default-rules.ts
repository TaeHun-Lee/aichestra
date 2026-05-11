import type { PolicyRule } from "./types.ts";

export function createDefaultPolicyRules(): PolicyRule[] {
  return [
    {
      id: "policy_git_remote_operation_deny",
      name: "Deny remote Git operations",
      description: "Remote Git operations are disabled in the mock-first milestone.",
      effect: "deny",
      action: "git.remote_operation",
      resourceKind: "git_operation",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_git_merge_deny",
      name: "Deny Git merge",
      description: "Provider merge is not implemented in Real Git Adapter v0.",
      effect: "deny",
      action: "git.merge",
      resourceKind: "git_operation",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_git_rebase_deny",
      name: "Deny Git rebase",
      description: "Provider rebase is not implemented in Real Git Adapter v0.",
      effect: "deny",
      action: "git.rebase",
      resourceKind: "git_operation",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_git_branch_delete_deny",
      name: "Deny branch deletion",
      description: "Destructive branch deletion is unsupported in v0.",
      effect: "deny",
      action: "git.branch.delete",
      resourceKind: "branch",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_git_mock_branch_allow",
      name: "Allow mock branch creation",
      description: "Mock branch creation is allowed for the scaffold.",
      effect: "allow",
      action: "git.branch.create",
      resourceKind: "branch",
      conditions: { providerKinds: ["mock"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_git_mock_pr_allow",
      name: "Allow mock pull request creation",
      description: "Mock PR creation is allowed for the scaffold.",
      effect: "allow",
      action: "git.pull_request.create",
      resourceKind: "pull_request",
      conditions: { providerKinds: ["mock"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_git_local_read_only_allow",
      name: "Allow local fixture Git operation",
      description: "Safe local fixture Git operations are allowed when marked read-only and workspace-safe.",
      effect: "allow",
      action: "git.branch.create",
      resourceKind: "branch",
      conditions: {
        providerKinds: ["local"],
        environmentEquals: {
          localFixture: true,
          readOnly: true
        }
      },
      priority: 150,
      enabled: true
    },
    {
      id: "policy_llm_remote_completion_deny",
      name: "Deny remote LLM completion",
      description: "Remote model completions are disabled by default.",
      effect: "deny",
      action: "llm.remote_completion",
      resourceKind: "llm_provider",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_llm_disabled_model_deny",
      name: "Deny disabled or deprecated model usage",
      description: "Disabled and deprecated models cannot be selected.",
      effect: "deny",
      action: "llm.model.use",
      resourceKind: "llm_model",
      conditions: { resourceStatuses: ["disabled", "deprecated"] },
      priority: 900,
      enabled: true
    },
    {
      id: "policy_llm_mock_completion_allow",
      name: "Allow mock LLM completion",
      description: "Mock completions are allowed when budget checks have passed.",
      effect: "allow",
      action: "llm.completion",
      resourceKind: "llm_provider",
      conditions: {
        providerKinds: ["mock"],
        environmentEquals: {
          budgetAllowed: true
        }
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_llm_active_model_allow",
      name: "Allow active model use",
      description: "Active models may be used when other checks pass.",
      effect: "allow",
      action: "llm.model.use",
      resourceKind: "llm_model",
      conditions: { resourceStatuses: ["active"] },
      priority: 100,
      enabled: true
    },
    {
      id: "policy_runner_command_default_deny",
      name: "Deny runner command execution by default",
      description: "Command execution requires explicit local execution, harness, and workspace gates.",
      effect: "deny",
      action: "runner.command.execute",
      resourceKind: "command",
      conditions: {
        environmentEquals: {
          localCommandExecutionEnabled: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_runner_network_command_deny",
      name: "Deny runner network commands",
      description: "Network commands are blocked in Local Agent Runner v1.",
      effect: "deny",
      action: "runner.command.execute",
      resourceKind: "command",
      conditions: { commandIncludesAny: ["curl", "wget", "fetch"] },
      priority: 950,
      enabled: true
    },
    {
      id: "policy_runner_remote_git_command_deny",
      name: "Deny runner remote Git commands",
      description: "Runner may not run git fetch, push, merge, or rebase.",
      effect: "deny",
      action: "runner.command.execute",
      resourceKind: "command",
      conditions: { commandIncludesAny: ["git fetch", "git push", "git merge", "git rebase"] },
      priority: 950,
      enabled: true
    },
    {
      id: "policy_runner_fixture_command_allow",
      name: "Allow fixture-local runner command",
      description: "Fixture-local command execution is allowed only when all local gates pass.",
      effect: "allow",
      action: "runner.command.execute",
      resourceKind: "command",
      conditions: {
        environmentEquals: {
          localCommandExecutionEnabled: true,
          harnessAllowed: true,
          workspaceSafe: true
        }
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_runner_execute_allow",
      name: "Allow runner execution",
      description: "Runner service execution is allowed for mock/local runner boundaries.",
      effect: "allow",
      action: "runner.execute",
      resourceKind: "runner",
      conditions: { runnerKinds: ["mock", "local"] },
      priority: 100,
      enabled: true
    },
    {
      id: "policy_registry_create_allow_editor",
      name: "Allow registry create for editor/admin",
      description: "Registry create requires editor, admin, or system role.",
      effect: "allow",
      action: "registry.create",
      resourceKind: "registry_item",
      conditions: { subjectRolesAny: ["registry_editor", "registry_admin", "system"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_registry_update_allow_editor",
      name: "Allow registry update for editor/admin",
      description: "Registry update requires editor, admin, reviewer, or system role depending on mutation type.",
      effect: "allow",
      action: "registry.update",
      resourceKind: "registry_item",
      conditions: { subjectRolesAny: ["registry_editor", "registry_admin", "registry_reviewer", "system"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_registry_approve_allow_reviewer",
      name: "Allow registry approval for reviewer/admin",
      description: "Registry approval requires reviewer, admin, or system role.",
      effect: "allow",
      action: "registry.approve",
      resourceKind: "registry_item",
      conditions: { subjectRolesAny: ["registry_reviewer", "registry_admin", "system"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_registry_rollback_allow_admin",
      name: "Allow registry rollback for admin",
      description: "Registry rollback requires admin or system role.",
      effect: "allow",
      action: "registry.rollback",
      resourceKind: "registry_item",
      conditions: { subjectRolesAny: ["registry_admin", "system"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_improvement_apply_deny",
      name: "Deny improvement apply",
      description: "Auto-improvement apply remains unavailable.",
      effect: "deny",
      action: "improvement.apply",
      resourceKind: "draft_registry_change",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_improvement_proposal_create_allow_system",
      name: "Allow draft proposal creation",
      description: "Draft proposal creation is allowed for system/admin mock actors.",
      effect: "allow",
      action: "improvement.proposal.create",
      resourceKind: "improvement_proposal",
      conditions: { subjectRolesAny: ["system", "registry_admin", "improvement_editor"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_improvement_proposal_approval_requires_reviewer",
      name: "Allow proposal approval for reviewer/admin",
      description: "Proposal approval requires a reviewer/admin/system role.",
      effect: "allow",
      action: "improvement.proposal.approve",
      resourceKind: "improvement_proposal",
      conditions: { subjectRolesAny: ["system", "registry_admin", "registry_reviewer", "improvement_reviewer"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_improvement_draft_change_prepare_allow",
      name: "Allow draft registry change preparation",
      description: "Preparing draft registry changes is allowed because it does not mutate active registry entries.",
      effect: "allow",
      action: "improvement.draft_change.prepare",
      resourceKind: "draft_registry_change",
      conditions: { subjectRolesAny: ["system", "registry_admin", "improvement_editor"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_provider_cloud_api_invoke_deny",
      name: "Deny cloud API provider invocation",
      description: "Enterprise provider cloud API invocation is disabled in v0.",
      effect: "deny",
      action: "provider.cloud_api.invoke",
      resourceKind: "llm_provider",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_provider_credential_resolve_deny",
      name: "Deny provider credential resolution",
      description: "Real credential resolution is not implemented in v0.",
      effect: "deny",
      action: "provider.credential.resolve",
      resourceKind: "provider_credential",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_provider_pty_invoke_deny",
      name: "Deny PTY provider invocation",
      description: "Interactive PTY fallback is disabled by default.",
      effect: "deny",
      action: "provider.pty.invoke",
      resourceKind: "llm_provider",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_credential_cache_read_deny",
      name: "Deny credential cache reads",
      description: "Provider-owned credential caches must not be read.",
      effect: "deny",
      action: "credential.cache.read",
      resourceKind: "provider_credential",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_credential_cache_upload_deny",
      name: "Deny credential cache upload",
      description: "Provider-owned credential caches must not be uploaded to Aichestra Cloud.",
      effect: "deny",
      action: "credential.cache.upload",
      resourceKind: "provider_credential",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_local_cli_shell_execution_deny",
      name: "Deny local CLI shell execution",
      description: "Local CLI shell execution is denied until a future Local Agent policy explicitly enables it.",
      effect: "deny",
      action: "local_cli.shell_execution",
      resourceKind: "local_cli",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_local_cli_file_write_deny",
      name: "Deny local CLI file write",
      description: "Local CLI file write is denied until sandbox and consent controls exist.",
      effect: "deny",
      action: "local_cli.file_write",
      resourceKind: "local_cli",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_local_cli_network_access_deny",
      name: "Deny local CLI network access",
      description: "Local CLI network access is denied until Local Agent network policy exists.",
      effect: "deny",
      action: "local_cli.network_access",
      resourceKind: "local_cli",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_local_agent_invoke_requires_consent",
      name: "Require consent for Local Agent invocation",
      description: "Aichestra Local Agent invocation requires explicit future user consent.",
      effect: "require_approval",
      action: "local_agent.invoke",
      resourceKind: "local_agent",
      conditions: {},
      priority: 700,
      enabled: true
    },
    {
      id: "policy_provider_local_cli_invoke_allow_boundary",
      name: "Allow local CLI provider boundary",
      description: "Local CLI provider requests may reach the Local Agent boundary, which remains unavailable in v0.",
      effect: "allow",
      action: "provider.local_cli.invoke",
      resourceKind: "llm_provider",
      conditions: { providerKinds: ["local_cli"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_provider_mock_invoke_allow",
      name: "Allow mock provider invocation",
      description: "Mock provider invocation remains allowed for the scaffold.",
      effect: "allow",
      action: "provider.invoke",
      resourceKind: "llm_provider",
      conditions: { providerKinds: ["mock"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_secret_metadata_read_allow_mock",
      name: "Allow mock secret metadata reads",
      description: "Mock secret metadata can be listed because it contains no secret material.",
      effect: "allow",
      action: "secret.metadata.read",
      resourceKind: "secret_ref",
      conditions: {
        environmentEquals: {
          secretMaterialAvailable: false
        }
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_secret_lease_request_requires_approval",
      name: "Require approval for secret lease requests",
      description: "Secret leases cannot be issued automatically in v0.",
      effect: "require_approval",
      action: "secret.lease.request",
      resourceKind: "secret_lease",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_secret_lease_issue_requires_approval",
      name: "Require approval for secret lease issue",
      description: "Future secret lease issue requires explicit approval and real secret backend integration.",
      effect: "require_approval",
      action: "secret.lease.issue",
      resourceKind: "secret_lease",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_secret_lease_revoke_allow_system",
      name: "Allow system secret lease revoke",
      description: "Revoking a mock lease is allowed and does not expose secret material.",
      effect: "allow",
      action: "secret.lease.revoke",
      resourceKind: "secret_lease",
      conditions: { subjectRolesAny: ["system", "security_admin"] },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_runner_secret_inject_deny",
      name: "Deny runner secret injection",
      description: "Secrets are not injected into runner processes in v0.",
      effect: "deny",
      action: "runner.secret.inject",
      resourceKind: "runner",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_network_egress_deny",
      name: "Deny network egress",
      description: "External network egress is denied by default in the mock-first scaffold.",
      effect: "deny",
      action: "network.egress",
      resourceKind: "network_egress_policy",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_local_agent_secret_forward_deny",
      name: "Deny Local Agent secret forwarding",
      description: "Local Agent secret forwarding is out of scope for v0.",
      effect: "deny",
      action: "local_agent.secret.forward",
      resourceKind: "local_agent",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_audit_secret_view_deny",
      name: "Deny secret audit view by default",
      description: "Secret audit viewing requires future production authorization.",
      effect: "deny",
      action: "audit.secret.view",
      resourceKind: "secret_scope",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_sandbox_safe_local_profile_allow",
      name: "Allow safe local sandbox profile",
      description: "Safe local temp workspace profiles may be used when network, secrets, and remote Git are disabled.",
      effect: "allow",
      action: "sandbox.profile.use",
      resourceKind: "sandbox_profile",
      conditions: {
        environmentEquals: {
          sandboxKind: "local_temp_workspace",
          networkAllowed: false,
          secretsAllowed: false,
          remoteGitAllowed: false,
          profileStatus: "active"
        }
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_sandbox_safe_local_session_allow",
      name: "Allow safe local sandbox session",
      description: "Safe local temp workspace sessions may be created when network, secrets, and remote Git are disabled.",
      effect: "allow",
      action: "sandbox.session.create",
      resourceKind: "sandbox_session",
      conditions: {
        environmentEquals: {
          sandboxKind: "local_temp_workspace",
          networkAllowed: false,
          secretsAllowed: false,
          remoteGitAllowed: false,
          profileStatus: "active"
        }
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_mcp_tool_call_deny",
      name: "Deny MCP tool calls",
      description: "MCP tool calls are disabled in the mock-first scaffold.",
      effect: "deny",
      action: "mcp.tool.call",
      resourceKind: "mcp_tool",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_secret_read_deny",
      name: "Deny secret reads",
      description: "Production secrets are not available to the scaffold.",
      effect: "deny",
      action: "secret.read",
      resourceKind: "secret_scope",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_task_high_risk_requires_approval",
      name: "Require approval for high-risk task execution",
      description: "High-risk task execution demonstrates require_approval decisions.",
      effect: "require_approval",
      action: "task.run",
      resourceKind: "task",
      conditions: { riskScoreAtLeast: 80 },
      priority: 500,
      enabled: true
    },
    {
      id: "policy_task_run_allow_default",
      name: "Allow normal task execution",
      description: "Normal task execution is allowed when no high-risk rule matches.",
      effect: "allow",
      action: "task.run",
      resourceKind: "task",
      conditions: {},
      priority: 50,
      enabled: true
    },
    {
      id: "policy_task_create_allow_default",
      name: "Allow task creation",
      description: "Task creation remains allowed in the mock scaffold.",
      effect: "allow",
      action: "task.create",
      resourceKind: "task",
      conditions: {},
      priority: 50,
      enabled: true
    }
  ];
}
