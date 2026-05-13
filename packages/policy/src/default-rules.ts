import type { PolicyRule } from "./types.ts";

export function createDefaultPolicyRules(): PolicyRule[] {
  return [
    {
      id: "policy_git_remote_operation_disabled_deny",
      name: "Deny disabled remote Git operations",
      description: "Remote Git operations require explicit v1 runtime gates.",
      effect: "deny",
      action: "git.remote_operation",
      resourceKind: "git_operation",
      conditions: {
        environmentEquals: {
          remoteGitEnabled: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_git_remote_operation_gate_deny",
      name: "Deny remote Git operation without operation gate",
      description: "Remote Git operations require an operation-specific branch, PR, or read gate.",
      effect: "deny",
      action: "git.remote_operation",
      resourceKind: "git_operation",
      conditions: {
        environmentEquals: {
          remoteOperationAllowed: false
        }
      },
      priority: 950,
      enabled: true
    },
    {
      id: "policy_git_remote_operation_allow_github_v1",
      name: "Allow gated GitHub remote operation",
      description: "GitHub remote operations may proceed only after v1 config gates and allowlists pass.",
      effect: "allow",
      action: "git.remote_operation",
      resourceKind: "git_operation",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          remoteGitEnabled: true,
          remoteOperationAllowed: true,
          repoAllowlisted: true,
          credentialsConfigured: true
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_git_webhook_receive_disabled_deny",
      name: "Deny disabled GitHub webhook receive",
      description: "GitHub webhook receive requires the explicit v2 webhook enable gate.",
      effect: "deny",
      action: "git.webhook.receive",
      resourceKind: "git_operation",
      conditions: {
        environmentEquals: {
          githubWebhooksEnabled: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_git_webhook_receive_unverified_deny",
      name: "Deny unverified GitHub webhook receive",
      description: "GitHub webhook receive requires signature verification.",
      effect: "deny",
      action: "git.webhook.receive",
      resourceKind: "git_operation",
      conditions: {
        environmentEquals: {
          signatureVerified: false
        }
      },
      priority: 950,
      enabled: true
    },
    {
      id: "policy_git_webhook_receive_allow_v2",
      name: "Allow verified GitHub webhook receive",
      description: "Verified GitHub webhooks may be received after v2 enable, secret, signature, and repo gates pass.",
      effect: "allow",
      action: "git.webhook.receive",
      resourceKind: "git_operation",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          githubWebhooksEnabled: true,
          signatureVerified: true,
          repoAllowlisted: true,
          secretConfigured: true
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_git_webhook_verify_disabled_deny",
      name: "Deny disabled GitHub webhook verification",
      description: "GitHub webhook verification requires the explicit v2 webhook enable gate.",
      effect: "deny",
      action: "git.webhook.verify",
      resourceKind: "git_operation",
      conditions: {
        environmentEquals: {
          githubWebhooksEnabled: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_git_webhook_verify_unverified_deny",
      name: "Deny failed GitHub webhook verification",
      description: "Failed GitHub webhook signatures cannot pass verification policy.",
      effect: "deny",
      action: "git.webhook.verify",
      resourceKind: "git_operation",
      conditions: {
        environmentEquals: {
          signatureVerified: false
        }
      },
      priority: 950,
      enabled: true
    },
    {
      id: "policy_git_webhook_verify_allow_v2",
      name: "Allow verified GitHub webhook verification",
      description: "GitHub webhook verification passes only after the signature has been verified.",
      effect: "allow",
      action: "git.webhook.verify",
      resourceKind: "git_operation",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          githubWebhooksEnabled: true,
          signatureVerified: true,
          secretConfigured: true
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_git_webhook_process_disabled_deny",
      name: "Deny disabled GitHub webhook processing",
      description: "GitHub webhook processing requires the explicit v2 webhook enable gate.",
      effect: "deny",
      action: "git.webhook.process",
      resourceKind: "git_operation",
      conditions: {
        environmentEquals: {
          githubWebhooksEnabled: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_git_webhook_process_unverified_deny",
      name: "Deny unverified GitHub webhook processing",
      description: "GitHub webhook processing requires signature verification.",
      effect: "deny",
      action: "git.webhook.process",
      resourceKind: "git_operation",
      conditions: {
        environmentEquals: {
          signatureVerified: false
        }
      },
      priority: 950,
      enabled: true
    },
    {
      id: "policy_git_webhook_process_allow_v2",
      name: "Allow verified GitHub webhook processing",
      description: "Verified GitHub webhooks may update read models only after v2 gates pass.",
      effect: "allow",
      action: "git.webhook.process",
      resourceKind: "git_operation",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          githubWebhooksEnabled: true,
          signatureVerified: true,
          repoAllowlisted: true,
          secretConfigured: true
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_git_pr_sync_allow_v2",
      name: "Allow non-destructive GitHub PR sync",
      description: "GitHub PR sync may update read models when the repo is known or allowlisted and no destructive operation is requested.",
      effect: "allow",
      action: "git.pull_request.sync",
      resourceKind: "pull_request",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          repoAllowlisted: true,
          destructiveOperation: false
        }
      },
      priority: 250,
      enabled: true
    },
    {
      id: "policy_git_branch_sync_allow_v2",
      name: "Allow non-destructive GitHub branch sync",
      description: "GitHub branch sync may update read models when the repo is allowlisted and no destructive operation is requested.",
      effect: "allow",
      action: "git.branch.sync",
      resourceKind: "branch",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          repoAllowlisted: true,
          destructiveOperation: false
        }
      },
      priority: 250,
      enabled: true
    },
    {
      id: "policy_git_changed_files_read_disabled_deny",
      name: "Deny GitHub changed-files read when remote Git is disabled",
      description: "Changed-file refresh through GitHubClient requires explicit remote Git read gates.",
      effect: "deny",
      action: "git.changed_files.read",
      resourceKind: "git_operation",
      conditions: {
        environmentEquals: {
          remoteGitEnabled: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_git_changed_files_read_allow_v2",
      name: "Allow gated GitHub changed-files read",
      description: "Changed-file refresh may call the GitHubClient only after remote Git, credential, and repo allowlist gates pass.",
      effect: "allow",
      action: "git.changed_files.read",
      resourceKind: "git_operation",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          remoteGitEnabled: true,
          remoteOperationAllowed: true,
          repoAllowlisted: true,
          credentialsConfigured: true,
          destructiveOperation: false
        }
      },
      priority: 250,
      enabled: true
    },
    {
      id: "policy_git_credential_resolve_deny",
      name: "Deny Git credential resolution without configured credentials",
      description: "Git provider credential resolution requires configured SecretRef or legacy credential metadata before any secret provider read.",
      effect: "deny",
      action: "git.credential.resolve",
      resourceKind: "provider_credential",
      conditions: {
        environmentEquals: {
          credentialsConfigured: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_git_credential_resolve_allow_env_secretref_v1",
      name: "Allow Git env-backed SecretRef credential resolution",
      description: "GitHub credentials and webhook secrets may be resolved only from active env-backed SecretRefs behind the explicit env provider gate.",
      effect: "allow",
      action: "git.credential.resolve",
      resourceKind: "provider_credential",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          credentialsConfigured: true,
          secretRefActive: true,
          envSecretProviderEnabled: true,
          credentialCacheAccessAllowed: false,
          credentialMaterialStored: false
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_github_app_configure_deny_without_gate",
      name: "Deny GitHub App configuration without enable gate",
      description: "GitHub App configuration requires the explicit GitHub App enable gate.",
      effect: "deny",
      action: "github_app.configure",
      resourceKind: "github_app",
      conditions: {
        environmentEquals: {
          githubAppEnabled: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_github_app_configure_allow_admin_mock_v1",
      name: "Allow gated GitHub App metadata configuration",
      description: "Platform, security, system, and service actors may validate GitHub App metadata when no private key material is exposed.",
      effect: "allow",
      action: "github_app.configure",
      resourceKind: "github_app",
      conditions: {
        subjectRolesAny: ["platform_admin", "security_admin", "system_admin", "system"],
        environmentEquals: {
          githubAppEnabled: true,
          privateKeyMaterialExposed: false
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_github_app_installation_use_deny_unallowlisted",
      name: "Deny unallowlisted GitHub App installation use",
      description: "GitHub App installations must be explicitly allowlisted before use.",
      effect: "deny",
      action: "github_app.installation.use",
      resourceKind: "github_app_installation",
      conditions: {
        environmentEquals: {
          installationAllowlisted: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_github_app_installation_use_allow_mock_v1",
      name: "Allow allowlisted GitHub App installation metadata use",
      description: "GitHub App installation metadata may be used only when the App mode and installation gates pass.",
      effect: "allow",
      action: "github_app.installation.use",
      resourceKind: "github_app_installation",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          githubAppEnabled: true,
          githubAppAuthMode: true,
          installationAllowlisted: true,
          privateKeyMaterialExposed: false
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_github_app_repo_grant_use_deny_unallowlisted",
      name: "Deny unallowlisted GitHub App repository grant",
      description: "GitHub App repository grants must match the configured repo allowlist.",
      effect: "deny",
      action: "github_app.repo_grant.use",
      resourceKind: "github_app_repo_grant",
      conditions: {
        environmentEquals: {
          repoAllowlisted: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_github_app_repo_grant_use_allow_mock_v1",
      name: "Allow allowlisted GitHub App repository grant",
      description: "Repository grants may be used when the App is gated, the installation is allowlisted, and destructive operations remain disabled.",
      effect: "allow",
      action: "github_app.repo_grant.use",
      resourceKind: "github_app_repo_grant",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          githubAppEnabled: true,
          githubAppAuthMode: true,
          installationAllowlisted: true,
          repoAllowlisted: true,
          destructiveOperation: false
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_github_app_token_issue_deny_disabled",
      name: "Deny GitHub App token issue when disabled",
      description: "GitHub App installation token issuance requires GitHub App auth mode and enable gates.",
      effect: "deny",
      action: "github_app.installation_token.issue",
      resourceKind: "github_app_installation",
      conditions: {
        environmentEquals: {
          githubAppEnabled: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_github_app_token_issue_deny_legacy_mode",
      name: "Deny GitHub App token issue outside App auth mode",
      description: "Installation token issuance cannot run while legacy token auth mode is selected.",
      effect: "deny",
      action: "github_app.installation_token.issue",
      resourceKind: "github_app_installation",
      conditions: {
        environmentEquals: {
          githubAppAuthMode: false
        }
      },
      priority: 990,
      enabled: true
    },
    {
      id: "policy_github_app_token_issue_deny_missing_secretref",
      name: "Deny GitHub App token issue without private-key SecretRef",
      description: "Installation token issuance requires an active private-key SecretRef metadata record.",
      effect: "deny",
      action: "github_app.installation_token.issue",
      resourceKind: "github_app_installation",
      conditions: {
        environmentEquals: {
          privateKeySecretRefConfigured: false
        }
      },
      priority: 980,
      enabled: true
    },
    {
      id: "policy_github_app_token_issue_deny_unallowlisted_installation",
      name: "Deny GitHub App token issue for unallowlisted installation",
      description: "Installation token issuance requires the installation id to be allowlisted.",
      effect: "deny",
      action: "github_app.installation_token.issue",
      resourceKind: "github_app_installation",
      conditions: {
        environmentEquals: {
          installationAllowlisted: false
        }
      },
      priority: 970,
      enabled: true
    },
    {
      id: "policy_github_app_token_issue_deny_unallowlisted_repo",
      name: "Deny GitHub App token issue for unallowlisted repo",
      description: "Installation token issuance requires the repository grant to match the allowlist.",
      effect: "deny",
      action: "github_app.installation_token.issue",
      resourceKind: "github_app_installation",
      conditions: {
        environmentEquals: {
          repoAllowlisted: false
        }
      },
      priority: 960,
      enabled: true
    },
    {
      id: "policy_github_app_token_issue_allow_mock_v1",
      name: "Allow mock GitHub App token handle issuance",
      description: "Mock installation token handles may be issued only after GitHub App, SecretRef metadata, installation, repo, Auth/RBAC, and non-destructive operation gates pass.",
      effect: "allow",
      action: "github_app.installation_token.issue",
      resourceKind: "github_app_installation",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          githubAppEnabled: true,
          githubAppAuthMode: true,
          appIdConfigured: true,
          privateKeySecretRefConfigured: true,
          secretRefActive: true,
          installationAllowlisted: true,
          repoAllowlisted: true,
          privateKeyMaterialExposed: false,
          installationTokenExchangeEnabled: false,
          mockTokenProvider: true,
          destructiveOperation: false
        }
      },
      priority: 300,
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
      id: "policy_git_github_branch_create_allow_v1",
      name: "Allow gated GitHub branch creation",
      description: "GitHub branch creation is allowed only when remote Git, branch creation, repo allowlist, branch prefix, and credential gates pass.",
      effect: "allow",
      action: "git.branch.create",
      resourceKind: "branch",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          remoteGitEnabled: true,
          remoteBranchCreateEnabled: true,
          repoAllowlisted: true,
          branchPrefixAllowed: true,
          credentialsConfigured: true
        }
      },
      priority: 250,
      enabled: true
    },
    {
      id: "policy_git_github_pr_create_allow_v1",
      name: "Allow gated GitHub pull request creation",
      description: "GitHub PR creation is allowed only when remote Git, PR creation, repo allowlist, branch prefix, and credential gates pass.",
      effect: "allow",
      action: "git.pull_request.create",
      resourceKind: "pull_request",
      conditions: {
        providerKinds: ["github"],
        environmentEquals: {
          remoteGitEnabled: true,
          remotePullRequestCreateEnabled: true,
          repoAllowlisted: true,
          branchPrefixAllowed: true,
          credentialsConfigured: true
        }
      },
      priority: 250,
      enabled: true
    },
    {
      id: "policy_llm_remote_completion_deny",
      name: "Deny remote LLM completion",
      description: "Remote model completions require explicit v1 runtime gates.",
      effect: "deny",
      action: "llm.remote_completion",
      resourceKind: "llm_provider",
      conditions: {
        environmentEquals: {
          remoteLlmEnabled: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_llm_remote_completion_gate_deny",
      name: "Deny remote LLM completion without completion gate",
      description: "Remote LLM completion requires the operation-specific completion gate.",
      effect: "deny",
      action: "llm.remote_completion",
      resourceKind: "llm_provider",
      conditions: {
        environmentEquals: {
          remoteCompletionEnabled: false
        }
      },
      priority: 950,
      enabled: true
    },
    {
      id: "policy_llm_remote_completion_allow_openai_v1",
      name: "Allow gated OpenAI-compatible remote completion",
      description: "OpenAI-compatible remote completion may proceed only after v1 config, credential, model allowlist, and budget gates pass.",
      effect: "allow",
      action: "llm.remote_completion",
      resourceKind: "llm_provider",
      conditions: {
        providerKinds: ["openai_compatible"],
        environmentEquals: {
          remoteLlmEnabled: true,
          remoteCompletionEnabled: true,
          baseUrlConfigured: true,
          credentialsConfigured: true,
          modelAllowlisted: true,
          budgetAllowed: true
        }
      },
      priority: 250,
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
      id: "policy_llm_openai_compatible_completion_allow_v1",
      name: "Allow gated OpenAI-compatible completion",
      description: "OpenAI-compatible completions are allowed only after remote, budget, credential, and model allowlist gates pass.",
      effect: "allow",
      action: "llm.completion",
      resourceKind: "llm_provider",
      conditions: {
        providerKinds: ["openai_compatible"],
        environmentEquals: {
          remoteLlmEnabled: true,
          remoteCompletionEnabled: true,
          baseUrlConfigured: true,
          credentialsConfigured: true,
          modelAllowlisted: true,
          budgetAllowed: true
        }
      },
      priority: 250,
      enabled: true
    },
    {
      id: "policy_llm_credential_resolve_deny",
      name: "Deny LLM credential resolution without configured credentials",
      description: "LLM provider credential resolution requires configured SecretRef or legacy credential metadata before any secret provider read.",
      effect: "deny",
      action: "llm.credential.resolve",
      resourceKind: "provider_credential",
      conditions: {
        environmentEquals: {
          credentialsConfigured: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_llm_credential_resolve_allow_env_secretref_v1",
      name: "Allow LLM env-backed SecretRef credential resolution",
      description: "OpenAI-compatible API keys may be resolved only from active env-backed SecretRefs behind the explicit env provider gate.",
      effect: "allow",
      action: "llm.credential.resolve",
      resourceKind: "provider_credential",
      conditions: {
        providerKinds: ["openai_compatible"],
        environmentEquals: {
          credentialsConfigured: true,
          secretRefActive: true,
          envSecretProviderEnabled: true,
          credentialCacheAccessAllowed: false,
          credentialMaterialStored: false
        }
      },
      priority: 300,
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
      id: "policy_llm_route_select_allow_mock_v2",
      name: "Allow mock LLM route selection",
      description: "Mock LLM route selection is allowed when the selected provider is mock and budget gates are still enforced separately.",
      effect: "allow",
      action: "llm.route.select",
      resourceKind: "llm_route",
      conditions: {
        providerKinds: ["mock"]
      },
      priority: 220,
      enabled: true
    },
    {
      id: "policy_llm_route_select_allow_openai_v2",
      name: "Allow gated OpenAI-compatible route selection",
      description: "OpenAI-compatible route selection requires remote gates, credentials, model allowlist, and budget state.",
      effect: "allow",
      action: "llm.route.select",
      resourceKind: "llm_route",
      conditions: {
        providerKinds: ["openai_compatible"],
        environmentEquals: {
          remoteLlmEnabled: true,
          remoteCompletionEnabled: true,
          baseUrlConfigured: true,
          credentialsConfigured: true,
          modelAllowlisted: true,
          budgetAllowed: true
        }
      },
      priority: 240,
      enabled: true
    },
    {
      id: "policy_llm_fallback_deny_disabled_v2",
      name: "Deny LLM fallback when disabled",
      description: "Fallback may not run unless the v2 fallback gate is enabled.",
      effect: "deny",
      action: "llm.fallback",
      resourceKind: "llm_fallback_policy",
      conditions: {
        environmentEquals: {
          fallbackEnabled: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_llm_fallback_allow_bounded_v2",
      name: "Allow bounded LLM fallback",
      description: "Fallback may proceed only when the fallback gate and budget state allow it.",
      effect: "allow",
      action: "llm.fallback",
      resourceKind: "llm_fallback_policy",
      conditions: {
        environmentEquals: {
          fallbackEnabled: true,
          fallbackWithinLimit: true,
          budgetAllowed: true
        }
      },
      priority: 260,
      enabled: true
    },
    {
      id: "policy_runner_command_default_deny",
      name: "Deny runner command execution by default",
      description: "Command execution requires explicit local execution, harness, and workspace gates.",
      effect: "deny",
      action: "runner.command.execute",
      resourceKind: "command",
      conditions: {},
      priority: 100,
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
      conditions: { subjectRolesAny: ["system", "system_admin", "platform_admin", "reviewer", "registry_admin", "registry_reviewer", "improvement_reviewer"] },
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
      description: "Provider credential resolution requires explicit safe runtime configuration.",
      effect: "deny",
      action: "provider.credential.resolve",
      resourceKind: "provider_credential",
      conditions: {
        environmentEquals: {
          credentialsConfigured: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_provider_credential_resolve_allow_env_secretref_v1",
      name: "Allow env-backed SecretRef credential resolution",
      description: "GitHub and OpenAI-compatible provider credentials may be resolved from active env-backed SecretRefs only when the env secret provider is explicitly enabled.",
      effect: "allow",
      action: "provider.credential.resolve",
      resourceKind: "provider_credential",
      conditions: {
        providerKinds: ["github", "openai_compatible"],
        environmentEquals: {
          credentialsConfigured: true,
          secretRefActive: true,
          envSecretProviderEnabled: true,
          credentialCacheAccessAllowed: false,
          credentialMaterialStored: false
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_provider_credential_resolve_allow_openai_env_v1",
      name: "Allow OpenAI-compatible env credential reference",
      description: "OpenAI-compatible v1 may use an environment-sourced API key only when remote gates are enabled and no credential cache access or stored secret material is involved.",
      effect: "allow",
      action: "provider.credential.resolve",
      resourceKind: "provider_credential",
      conditions: {
        providerKinds: ["openai_compatible"],
        environmentEquals: {
          remoteLlmEnabled: true,
          remoteCompletionEnabled: true,
          credentialsConfigured: true,
          credentialCacheAccessAllowed: false,
          credentialMaterialStored: false
        }
      },
      priority: 250,
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
      id: "policy_local_cli_direct_invoke_deny",
      name: "Deny direct local CLI execution",
      description: "Aichestra Cloud must not execute local CLI providers directly.",
      effect: "deny",
      action: "local_cli.invoke",
      resourceKind: "local_cli",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_local_cli_danger_full_access_deny",
      name: "Deny local CLI danger full access",
      description: "danger_full_access is denied by default.",
      effect: "deny",
      action: "local_cli.danger_full_access",
      resourceKind: "local_cli",
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
      id: "policy_local_agent_register_allow_system",
      name: "Allow mock Local Agent registration",
      description: "Mock Local Agent registration is allowed for system and mock admin actors.",
      effect: "allow",
      action: "local_agent.register",
      resourceKind: "local_agent",
      conditions: { subjectRolesAny: ["system", "mock_admin", "local_agent_admin"] },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_channel_create_allow_mock",
      name: "Allow mock Local Agent channel creation",
      description: "Only mock in-memory Local Agent channels are allowed in v1.",
      effect: "allow",
      action: "local_agent.channel.create",
      resourceKind: "local_agent",
      conditions: {
        environmentEquals: {
          mockTransport: true,
          realTransport: false
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_handshake_verify_allow_mock",
      name: "Allow mock Local Agent handshake verification",
      description: "Mock handshakes are deterministic metadata and are not production crypto.",
      effect: "allow",
      action: "local_agent.handshake.verify",
      resourceKind: "local_agent",
      conditions: {
        environmentEquals: {
          mockTransport: true,
          realTransport: false
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_capability_advertise_allow_mock",
      name: "Allow mock capability advertisement",
      description: "Fixture Local Agents may advertise metadata-only capabilities.",
      effect: "allow",
      action: "local_agent.capability.advertise",
      resourceKind: "local_agent",
      conditions: {
        environmentEquals: {
          mockTransport: true
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_compatibility_check_allow_mock",
      name: "Allow mock local CLI compatibility checks",
      description: "Compatibility checks use fixture metadata only and do not run vendor CLIs.",
      effect: "allow",
      action: "local_agent.compatibility.check",
      resourceKind: "local_agent",
      conditions: {
        environmentEquals: {
          mockTransport: true
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_revoke_allow_system",
      name: "Allow mock Local Agent revocation",
      description: "Mock Local Agent revocation is allowed for system and local agent admin actors.",
      effect: "allow",
      action: "local_agent.revoke",
      resourceKind: "local_agent",
      conditions: { subjectRolesAny: ["system", "local_agent_admin"] },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_cancel_allow_system",
      name: "Allow mock Local Agent invocation cancellation",
      description: "Mock Local Agent invocation cancellation is allowed for system actors.",
      effect: "allow",
      action: "local_agent.cancel",
      resourceKind: "local_agent",
      conditions: { subjectRolesAny: ["system", "local_agent_admin"] },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_event_receive_allow_mock",
      name: "Allow mock Local Agent event receipt",
      description: "Mock Local Agent protocol events may be received after redaction controls.",
      effect: "allow",
      action: "local_agent.event.receive",
      resourceKind: "local_agent",
      conditions: {
        environmentEquals: {
          mockTransport: true
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_stream_receive_allow_mock",
      name: "Allow mock Local Agent stream receipt",
      description: "Mock stream events may be received after redaction controls.",
      effect: "allow",
      action: "local_agent.stream.receive",
      resourceKind: "local_agent",
      conditions: {
        environmentEquals: {
          mockTransport: true
        }
      },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_session_expire_allow_system",
      name: "Allow Local Agent session expiry",
      description: "Session expiry is metadata-only and blocks future dispatch.",
      effect: "allow",
      action: "local_agent.session.expire",
      resourceKind: "local_agent",
      conditions: { subjectRolesAny: ["system", "local_agent_admin"] },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_session_approve_allow_mock",
      name: "Allow mock Local Agent session consent approval",
      description: "Session-scoped approval is metadata-only and still expires with Local Agent session state.",
      effect: "allow",
      action: "local_agent.session.approve",
      resourceKind: "local_agent",
      conditions: { subjectRolesAny: ["system", "local_agent_admin"] },
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_consent_request_allow",
      name: "Allow Local Agent consent request",
      description: "Consent requests are allowed because they do not execute local CLI providers.",
      effect: "allow",
      action: "local_agent.consent.request",
      resourceKind: "local_agent",
      conditions: {},
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_consent_approve_allow_mock",
      name: "Allow mock Local Agent consent approval",
      description: "Mock consent decisions may be recorded, but dangerous consent levels remain denied by invocation policy.",
      effect: "allow",
      action: "local_agent.consent.approve",
      resourceKind: "local_agent",
      conditions: {},
      priority: 300,
      enabled: true
    },
    {
      id: "policy_local_agent_invoke_revoked_deny",
      name: "Deny revoked Local Agent invocation",
      description: "Revoked Local Agents cannot receive invocations.",
      effect: "deny",
      action: "local_agent.invoke",
      resourceKind: "local_agent",
      conditions: { resourceStatuses: ["revoked"] },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_local_agent_invoke_disconnected_deny",
      name: "Deny disconnected Local Agent invocation",
      description: "Disconnected Local Agents cannot receive invocations.",
      effect: "deny",
      action: "local_agent.invoke",
      resourceKind: "local_agent",
      conditions: { resourceStatuses: ["disconnected", "unknown", "pending"] },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_local_agent_invoke_read_only_with_consent_allow",
      name: "Allow read-only Local Agent invocation with consent",
      description: "Read-only Local Agent invocations may dispatch only after policy and consent are satisfied.",
      effect: "allow",
      action: "local_agent.invoke",
      resourceKind: "local_agent",
      conditions: {
        environmentEquals: {
          localAgentConnected: true,
          mockTransport: true
        },
        metadataEquals: {
          consentLevel: "read_only",
          consentApproved: true
        }
      },
      priority: 800,
      enabled: true
    },
    {
      id: "policy_local_cli_template_use_incompatible_deny",
      name: "Deny incompatible local CLI template use",
      description: "Local CLI templates require a successful compatibility check before invocation.",
      effect: "deny",
      action: "local_cli.template.use",
      resourceKind: "local_cli",
      conditions: {
        metadataEquals: {
          compatible: false
        }
      },
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_local_cli_template_use_allow_compatible_consent",
      name: "Allow compatible local CLI template use with consent",
      description: "Compatible local CLI templates may be used only after consent is approved.",
      effect: "allow",
      action: "local_cli.template.use",
      resourceKind: "local_cli",
      conditions: {
        metadataEquals: {
          compatible: true,
          consentApproved: true
        }
      },
      priority: 500,
      enabled: true
    },
    {
      id: "policy_local_cli_template_use_requires_consent",
      name: "Require consent for local CLI template use",
      description: "Template use is blocked until compatibility and consent are both satisfied.",
      effect: "require_approval",
      action: "local_cli.template.use",
      resourceKind: "local_cli",
      conditions: {},
      priority: 400,
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
      id: "policy_provider_openai_compatible_invoke_allow_v1",
      name: "Allow gated OpenAI-compatible provider invocation",
      description: "OpenAI-compatible provider invocation may proceed only when LLM v1 remote gates, credentials, model allowlist, and budget checks pass.",
      effect: "allow",
      action: "provider.invoke",
      resourceKind: "llm_provider",
      conditions: {
        providerKinds: ["openai_compatible"],
        environmentEquals: {
          remoteLlmEnabled: true,
          remoteCompletionEnabled: true,
          baseUrlConfigured: true,
          credentialsConfigured: true,
          modelAllowlisted: true,
          budgetAllowed: true
        }
      },
      priority: 250,
      enabled: true
    },
    {
      id: "policy_provider_openai_compatible_model_allowlist_deny_v1",
      name: "Deny OpenAI-compatible provider invocation for non-allowlisted model",
      description: "OpenAI-compatible provider invocation requires the selected model to satisfy the configured allowlist.",
      effect: "deny",
      action: "provider.invoke",
      resourceKind: "llm_provider",
      conditions: {
        providerKinds: ["openai_compatible"],
        environmentEquals: {
          modelAllowlisted: false
        }
      },
      priority: 900,
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
      id: "policy_secret_lease_request_allow_env_provider_credentials_v1",
      name: "Allow metadata lease request for env provider credentials",
      description: "Env-backed provider credential resolution may create a metadata SecretLease after credential policy approval; secret.read remains denied.",
      effect: "allow",
      action: "secret.lease.request",
      resourceKind: "secret_lease",
      conditions: {
        environmentEquals: {
          secretRefActive: true,
          envSecretProviderEnabled: true,
          credentialCacheAccessAllowed: false,
          credentialMaterialStored: false
        }
      },
      priority: 1100,
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
      id: "policy_secret_lease_issue_allow_env_provider_credentials_v1",
      name: "Allow metadata lease issue for env provider credentials",
      description: "Env-backed provider credential resolution may issue a metadata-only SecretLease without exposing the secret value outside the adapter boundary.",
      effect: "allow",
      action: "secret.lease.issue",
      resourceKind: "secret_lease",
      conditions: {
        environmentEquals: {
          secretRefActive: true,
          envSecretProviderEnabled: true,
          credentialCacheAccessAllowed: false,
          credentialMaterialStored: false
        }
      },
      priority: 1100,
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
      id: "policy_sandbox_default_deny_profile_allow",
      name: "Allow default-deny sandbox profile",
      description: "The default-deny sandbox profile may be referenced because it grants no network, secrets, or remote Git access.",
      effect: "allow",
      action: "sandbox.profile.use",
      resourceKind: "sandbox_profile",
      conditions: {
        environmentEquals: {
          sandboxKind: "none",
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
      id: "policy_sandbox_default_deny_session_allow",
      name: "Allow default-deny sandbox session metadata",
      description: "Default-deny sandbox session metadata may be recorded when no network, secrets, or remote Git access is enabled.",
      effect: "allow",
      action: "sandbox.session.create",
      resourceKind: "sandbox_session",
      conditions: {
        environmentEquals: {
          sandboxKind: "none",
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
      id: "policy_mcp_server_list_allow_mock_v0",
      name: "Allow mock MCP server listing",
      description: "Active mock MCP server metadata may be listed by authenticated read roles.",
      effect: "allow",
      action: "mcp.server.list",
      resourceKind: "mcp_server",
      conditions: {
        subjectRolesAny: ["viewer", "developer", "reviewer", "security_admin", "platform_admin", "system_admin", "system"],
        environmentEquals: {
          realTransportEnabled: false
        }
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_mcp_tool_list_allow_mock_v0",
      name: "Allow mock MCP tool listing",
      description: "Active mock MCP tool metadata may be listed by authenticated read roles.",
      effect: "allow",
      action: "mcp.tool.list",
      resourceKind: "mcp_tool",
      conditions: {
        subjectRolesAny: ["viewer", "developer", "reviewer", "security_admin", "platform_admin", "system_admin", "system"],
        environmentEquals: {
          serverKind: "mock",
          serverStatus: "active",
          realTransportEnabled: false
        }
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_mcp_tool_invoke_allow_low_risk_mock_v0",
      name: "Allow low-risk mock MCP tool invocation",
      description: "Low-risk read-only mock MCP tools may run when they require no secrets, network, write, deploy, or real transport.",
      effect: "allow",
      action: "mcp.tool.invoke.low_risk",
      resourceKind: "mcp_tool",
      conditions: {
        subjectRolesAny: ["developer", "service_account_runner", "platform_admin", "system_admin", "system"],
        environmentEquals: {
          serverKind: "mock",
          serverStatus: "active",
          toolStatus: "active",
          riskLevel: "low",
          readOnly: true,
          requiresSecrets: false,
          networkRequired: false,
          writeOperation: false,
          deployOperation: false,
          realTransportEnabled: false,
          localExecutionRequired: false
        }
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_mcp_tool_invoke_allow_generic_low_risk_mock_v0",
      name: "Allow generic low-risk mock MCP invocation",
      description: "The generic MCP invocation gate allows only low-risk read-only mock tools with all unsafe capabilities disabled.",
      effect: "allow",
      action: "mcp.tool.invoke",
      resourceKind: "mcp_tool",
      conditions: {
        subjectRolesAny: ["developer", "service_account_runner", "platform_admin", "system_admin", "system"],
        environmentEquals: {
          serverKind: "mock",
          serverStatus: "active",
          toolStatus: "active",
          riskLevel: "low",
          readOnly: true,
          requiresSecrets: false,
          networkRequired: false,
          writeOperation: false,
          deployOperation: false,
          realTransportEnabled: false,
          localExecutionRequired: false
        }
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_mcp_tool_invoke_high_risk_deny_v0",
      name: "Deny high-risk MCP tool invocation",
      description: "High-risk MCP tools are denied by default in v0.",
      effect: "deny",
      action: "mcp.tool.invoke.high_risk",
      resourceKind: "mcp_tool",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_mcp_tool_invoke_critical_deny_v0",
      name: "Deny critical MCP tool invocation",
      description: "Critical MCP tools are denied by default in v0.",
      effect: "deny",
      action: "mcp.tool.invoke.critical",
      resourceKind: "mcp_tool",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_mcp_tool_secret_resolve_deny_v0",
      name: "Deny MCP tool secret resolution",
      description: "MCP tools do not receive SecretRefs, leases, or raw secret material in v0.",
      effect: "deny",
      action: "mcp.tool.secret.resolve",
      resourceKind: "mcp_tool",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_mcp_tool_network_access_deny_v0",
      name: "Deny MCP tool network access",
      description: "MCP network transport and tool network egress are disabled in v0.",
      effect: "deny",
      action: "mcp.tool.network_access",
      resourceKind: "mcp_tool",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_mcp_tool_write_deny_v0",
      name: "Deny MCP write tools",
      description: "MCP write tools are disabled in v0.",
      effect: "deny",
      action: "mcp.tool.write",
      resourceKind: "mcp_tool",
      conditions: {},
      priority: 1000,
      enabled: true
    },
    {
      id: "policy_mcp_tool_deploy_deny_v0",
      name: "Deny MCP deploy tools",
      description: "MCP deployment tools are disabled in v0.",
      effect: "deny",
      action: "mcp.tool.deploy",
      resourceKind: "mcp_tool",
      conditions: {},
      priority: 1000,
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
      id: "policy_dashboard_read_allow_auth_v0",
      name: "Allow dashboard read for authenticated mock roles",
      description: "Dashboard read models are read-only and may be viewed by default v0 roles.",
      effect: "allow",
      action: "dashboard.read",
      resourceKind: "dashboard",
      conditions: {
        subjectRolesAny: ["viewer", "developer", "reviewer", "security_admin", "platform_admin", "system_admin", "system"]
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_auth_read_allow_v0",
      name: "Allow auth metadata read",
      description: "Auth/RBAC v0 metadata contains no tokens or production sessions.",
      effect: "allow",
      action: "auth.read",
      resourceKind: "auth",
      conditions: {
        subjectRolesAny: ["viewer", "developer", "reviewer", "security_admin", "platform_admin", "system_admin", "system"]
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_auth_authorize_check_allow_v0",
      name: "Allow authorization check endpoint",
      description: "Authorization check evaluates mock RBAC and policy without issuing credentials or sessions.",
      effect: "allow",
      action: "auth.authorize.check",
      resourceKind: "auth",
      conditions: {
        subjectRolesAny: ["security_admin", "platform_admin", "system_admin", "system"]
      },
      priority: 200,
      enabled: true
    },
    {
      id: "policy_auth_admin_future_deny",
      name: "Deny production auth administration",
      description: "Production auth administration is not implemented in v0.",
      effect: "deny",
      action: "auth.admin",
      resourceKind: "auth",
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
