export type DeploymentProfileName = "local" | "integration" | "staging" | "production";
export type DeploymentUnit = "api" | "web" | "worker" | "local-agent" | "migration-job" | "background-job" | "future";
export type ReadinessCheckStatus = "pass" | "fail" | "warning" | "not_applicable" | "not_checked";
export type ReadinessSeverity = "low" | "medium" | "high" | "critical";
export type ProductionRiskLikelihood = "low" | "medium" | "high";
export type ProductionRiskStatus = "open" | "accepted" | "mitigated" | "deferred";
export type StorageMode = "in_memory" | "postgres_optional" | "postgres_required";
export type AuthMode = "mock" | "production_required" | "future_oidc_saml";
export type SecretMode = "metadata_only_env_optional" | "secretref_env" | "real_secret_backend_required";
export type PolicyMode = "static_typescript" | "managed_bundle_required";
export type ObservabilityMode = "local_logs_only" | "required_external_stack";
export type GitHubAppDescriptorStatus = "planned" | "configured_mock" | "disabled" | "future_live";
export type GitHubAppInstallationStatus = "planned" | "active_mock" | "suspended" | "removed" | "future_live";
export type GitHubAppAccountType = "user" | "organization" | "enterprise" | "unknown";
export type GitHubRepositorySelection = "all" | "selected" | "unknown";
export type GitHubRepositoryGrantStatus = "allowed" | "blocked" | "removed" | "unknown";
export type GitHubPermissionLevel = "none" | "read" | "write";
export type GitHubPlanningRiskLevel = "low" | "medium" | "high" | "critical";
export type GitHubWebhookEventSupportStatus = "supported_now" | "planned" | "ignored" | "denied";
export type GitHubWebhookReplayStatus = "first_seen" | "duplicate" | "replay_rejected" | "unknown";
export type GitHubWebhookProcessingStatus = "pending" | "processed" | "failed" | "dead_lettered" | "ignored";
export type DatabaseDeploymentProfileName = "local" | "integration" | "staging" | "production";
export type DatabaseOperationsStatus = "planned" | "partial" | "ready_for_testing" | "not_ready";
export type DatabaseReadinessCategory =
  | "connection"
  | "migration"
  | "backup"
  | "restore"
  | "indexes"
  | "retention"
  | "audit_growth"
  | "webhook_dedupe"
  | "pooling"
  | "monitoring";
export type DatabaseMigrationStatusValue = "planned" | "pending" | "applied" | "failed" | "rolled_back" | "unknown";
export type DatabaseIndexReviewStatus = "implemented_in_schema" | "recommended" | "future";
export type DatabaseStorageProviderKind = "in_memory" | "postgres" | "unknown";
export type SecretBackendKind =
  | "vault"
  | "aws_secrets_manager"
  | "gcp_secret_manager"
  | "azure_key_vault"
  | "env_legacy"
  | "mock"
  | "custom_future";
export type SecretBackendOptionStatus = "planned" | "recommended" | "allowed_for_integration" | "not_recommended" | "future";
export type SecretBackendOperationalComplexity = "low" | "medium" | "high";
export type SecretBackendMigrationPhaseStatus = "planned" | "ready_for_design" | "blocked" | "future";
export type SecretBackendReadinessCategory =
  | "backend_selection"
  | "secret_ref_schema"
  | "lease_ttl"
  | "rotation"
  | "audit"
  | "auth_policy"
  | "env_fallback"
  | "provider_integration"
  | "dashboard"
  | "observability"
  | "incident_response";
export type SecretRotationMode = "manual" | "scheduled_future" | "provider_managed_future" | "not_supported";
export type SecretRotationPlanStatus = "planned" | "future" | "not_ready";
export type SecretLeasePolicyStatus = "planned" | "active_mock" | "future";
export type SecretCredentialKind =
  | "github_token"
  | "github_webhook_secret"
  | "llm_api_key"
  | "provider_api_key"
  | "webhook_secret"
  | "future_oauth_token"
  | "future_cloud_identity"
  | "future_mcp_tool_secret"
  | "future_local_agent_pairing_secret"
  | "future_service_account_signing_key"
  | "future_byok_key";
export type AuthProviderOptionKind =
  | "oidc"
  | "saml"
  | "scim"
  | "github_enterprise"
  | "google_workspace"
  | "microsoft_entra"
  | "okta"
  | "auth0"
  | "custom"
  | "mock";
export type AuthProviderOptionStatus = "planned" | "recommended" | "future" | "not_recommended" | "disabled";
export type ProductionAuthProviderKind =
  | "mock"
  | "oidc_future"
  | "saml_future"
  | "scim_future"
  | "microsoft_entra_future"
  | "okta_future"
  | "auth0_future"
  | "google_workspace_future"
  | "github_enterprise_future"
  | "custom_future";
export type ProductionAuthProviderStatus = "active_mock" | "disabled" | "not_configured" | "future";
export type ProductionAuthProviderReadinessStatus = "ready_mock" | "disabled" | "missing_config" | "blocked" | "future";
export type SessionTokenBoundaryKind =
  | "cookie_session_future"
  | "bearer_jwt_future"
  | "api_key_future"
  | "service_account_token_future"
  | "local_agent_pairing_future";
export type SessionTokenBoundaryStatus = "planned" | "disabled" | "future";
export type IdentityMappingKind =
  | "subject_to_principal"
  | "group_to_team"
  | "role_claim_to_role"
  | "tenant_claim_to_tenant_scope"
  | "repo_claim_to_repo_scope"
  | "service_account_mapping";
export type IdentityMappingStatus = "planned" | "future" | "not_configured";
export type AuthRbacOperationalComplexity = "low" | "medium" | "high";
export type AuthRbacMigrationPhaseStatus = "planned" | "ready_for_design" | "blocked" | "future";
export type AuthRbacReadinessCategory =
  | "identity_provider"
  | "group_sync"
  | "role_mapping"
  | "tenant_isolation"
  | "service_accounts"
  | "local_agent_identity"
  | "webhook_identity"
  | "request_context"
  | "audit_attribution"
  | "mock_actor_deprecation"
  | "policy_subject_mapping"
  | "dashboard_visibility"
  | "break_glass";
export type TenantBoundaryKind = "organization" | "workspace" | "team" | "project" | "repo_scope";
export type TenantBoundaryPlanStatus = "planned" | "future" | "not_ready";
export type ServiceAccountPlanKind =
  | "worker"
  | "git_webhook"
  | "git_provider"
  | "llm_gateway"
  | "mcp_gateway"
  | "local_agent_protocol"
  | "deployment"
  | "observability_export";
export type ServiceAccountPlanStatus = "planned" | "future" | "not_ready";
export type ProductionRbacRoleName =
  | "viewer"
  | "developer"
  | "reviewer"
  | "security_admin"
  | "platform_admin"
  | "system_admin"
  | "service_account_runner"
  | "git_webhook_service"
  | "llm_gateway_service"
  | "mcp_gateway_service"
  | "local_agent_user"
  | "local_agent_admin"
  | "audit_reader"
  | "break_glass_admin_future";
export type PolicyEngineOptionKind =
  | "static_typescript_current"
  | "opa_rego"
  | "cedar"
  | "signed_json_yaml_bundle"
  | "custom_future";
export type PolicyEngineOptionStatus = "current" | "planned" | "recommended" | "not_recommended" | "future";
export type PolicyBundleOperationalComplexity = "low" | "medium" | "high";
export type PolicyBundleKind = "opa_bundle" | "cedar_policy_set" | "json_yaml_policy_bundle" | "static_typescript_legacy";
export type PolicyBundlePlanStatus = "planned" | "ready_for_design" | "blocked" | "future";
export type PolicyDomainName =
  | "git"
  | "git_webhook"
  | "llm"
  | "mcp"
  | "runner"
  | "registry"
  | "improvement"
  | "secretref"
  | "secrets_sandbox"
  | "local_agent"
  | "provider"
  | "auth"
  | "dashboard"
  | "deployment_readiness";
export type PolicyDomainMigrationStatus = "current_static" | "mapped" | "gap" | "future";
export type PolicyBundleReadinessCategory =
  | "engine_selection"
  | "bundle_schema"
  | "signing"
  | "review_workflow"
  | "rollout"
  | "rollback"
  | "tests"
  | "audit"
  | "break_glass"
  | "tenant_scoping"
  | "auth_mapping"
  | "secret_policy"
  | "provider_policy"
  | "dashboard";
export type PolicyBundleMigrationPhaseStatus = "planned" | "ready_for_design" | "blocked" | "future";
export type PolicyShadowEvaluationPlanStatus = "planned" | "ready_for_design" | "blocked" | "future";
export type PolicyShadowSourceOfTruth = "StaticPolicyEngine";
export type PolicyShadowCandidateRuntimeKind =
  | "signed_json_yaml_bundle"
  | "opa_rego"
  | "cedar"
  | "custom_future"
  | "signed_json_yaml_bundle_evaluator_future"
  | "opa_rego_local_library_future"
  | "cedar_local_evaluator_future"
  | "custom_policy_decision_service_future";
export type PolicyRuntimePocOptionKind =
  | "static_policy_engine_baseline"
  | "opa_rego_local_library_future"
  | "opa_rego_server_future"
  | "cedar_local_evaluator_future"
  | "signed_json_yaml_bundle_evaluator_future"
  | "custom_policy_decision_service_future";
export type PolicyRuntimePocOptionStatus = "baseline" | "recommended_for_poc" | "candidate" | "not_recommended" | "future_only";
export type PolicyRuntimePocReadinessCategory =
  | "goals"
  | "input_contract"
  | "domain_mapping"
  | "golden_tests"
  | "shadow_evaluation"
  | "rollout"
  | "rollback"
  | "safety"
  | "audit"
  | "dashboard";
export type PolicyRuntimePocDomainName =
  | "git_remote_operation"
  | "github_app_token_issuance"
  | "github_webhook_processing"
  | "llm_remote_completion"
  | "llm_fallback"
  | "mcp_tool_invocation"
  | "secretref_vault_credential_resolution"
  | "runner_command_execution"
  | "local_agent_invocation"
  | "registry_mutation"
  | "governance_apply_gate"
  | "dashboard_readiness_access"
  | "observability_audit_query";
export type PolicyRuntimePocDecision = "allow" | "deny" | "block" | "warn";
export type PolicyRuntimePocGoldenCaseOutcome = "allow_when_gated" | "deny" | "block" | "warn" | "exclude";
export type PolicyShadowEnforcementMode = "shadow_only";
export type PolicyShadowComparisonKind =
  | "effect_match"
  | "reason_match"
  | "rule_id_match"
  | "obligation_match"
  | "redaction_match"
  | "audit_metadata_match";
export type PolicyShadowMismatchKind =
  | "static_allow_candidate_deny"
  | "static_deny_candidate_allow"
  | "static_block_candidate_allow"
  | "reason_mismatch"
  | "rule_id_mismatch"
  | "missing_obligation"
  | "extra_obligation"
  | "redaction_mismatch"
  | "audit_metadata_mismatch"
  | "error_in_candidate";
export type PolicyShadowMismatchSeverity = "info" | "low" | "medium" | "high" | "critical";
export type PolicyShadowMismatchDefaultAction = "record_only" | "alert_future" | "block_rollout_future";
export type PolicyShadowReadinessCategory =
  | "input_contract"
  | "golden_cases"
  | "candidate_runtime"
  | "comparison_rules"
  | "audit"
  | "observability"
  | "dashboard"
  | "rollout"
  | "rollback"
  | "safety";
export type PolicyShadowReadinessStatus = "pass" | "warning" | "fail" | "not_checked" | "future";
export type StagingDeploymentStatus = "planned" | "ready_for_internal_validation" | "blocked" | "not_ready";
export type StagingIntegrationKind =
  | "postgres"
  | "github_app"
  | "github_webhook"
  | "llm_remote"
  | "mcp_remote"
  | "local_agent"
  | "secret_backend"
  | "auth_provider"
  | "policy_bundle"
  | "observability_export";
export type StagingIntegrationGateStatus = "allowed" | "blocked" | "gated" | "future";
export type StagingReadinessCategory =
  | "storage"
  | "auth"
  | "secrets"
  | "git"
  | "github_app"
  | "webhook"
  | "llm"
  | "mcp"
  | "runner"
  | "local_agent"
  | "policy"
  | "observability"
  | "dashboard"
  | "ci"
  | "security";
export type StagingCriterionStatus = "pass" | "warning" | "fail" | "not_checked";
export type StagingRollbackCriterionStatus = "planned" | "active_mock" | "future";
export type CICDPipelineProfileName = "local_validation" | "pull_request" | "integration" | "staging" | "release_candidate";
export type CICDPipelineProfileStatus = "planned" | "ready_for_dry_run" | "blocked" | "future";
export type CICDJobCategory =
  | "install"
  | "lint"
  | "typecheck"
  | "test"
  | "build"
  | "security_scan"
  | "secret_scan"
  | "optional_postgres"
  | "optional_remote_git"
  | "optional_github_app"
  | "optional_webhook"
  | "optional_remote_llm"
  | "optional_mcp"
  | "optional_auth"
  | "dashboard_smoke"
  | "readiness_check";
export type CICDJobStatus = "planned" | "active_mock" | "future";
export type CICDIntegrationKind =
  | "postgres"
  | "remote_git"
  | "github_app"
  | "github_webhook"
  | "remote_llm"
  | "remote_mcp"
  | "external_auth"
  | "vendor_cli";
export type CICDReadinessCategory =
  | "node"
  | "package_manager"
  | "validation"
  | "test_profiles"
  | "secrets"
  | "integration_gates"
  | "artifacts"
  | "cleanup"
  | "rollback"
  | "security"
  | "staging_promotion";
export type CICDRiskStatus = "open" | "accepted" | "mitigated" | "deferred";
export type GitHubAppIntegrationTestProfileStatus = "disabled" | "ready_if_configured" | "blocked" | "future";
export type GitHubAppIntegrationTestCaseCategory =
  | "config_validation"
  | "installation_token"
  | "branch_create"
  | "pr_create"
  | "changed_files"
  | "webhook_fixture"
  | "webhook_live_future"
  | "cleanup";
export type GitHubAppIntegrationTestCaseStatus = "planned" | "active_mock" | "gated_live" | "future";
export type GitHubAppIntegrationTestSafetyCategory =
  | "env_gates"
  | "repo_allowlist"
  | "branch_prefix"
  | "secretref"
  | "cleanup"
  | "no_auto_merge"
  | "no_force_push"
  | "no_branch_delete"
  | "audit"
  | "observability";
export type LLMIntegrationTestProfileStatus = "disabled" | "ready_if_configured" | "blocked" | "future";
export type LLMIntegrationTestCaseCategory =
  | "config_validation"
  | "credential_resolution"
  | "model_allowlist"
  | "budget_guard"
  | "mock_completion"
  | "remote_completion"
  | "usage_ledger"
  | "audit_redaction"
  | "fallback_disabled";
export type LLMIntegrationTestCaseStatus = "planned" | "active_mock" | "gated_live" | "future";
export type LLMIntegrationTestSafetyCategory =
  | "env_gates"
  | "secretref"
  | "model_allowlist"
  | "budget"
  | "policy"
  | "auth"
  | "redaction"
  | "audit"
  | "no_streaming"
  | "no_tool_calls"
  | "no_unbounded_fallback";
export type VaultIntegrationTestProfileStatus = "disabled" | "ready_if_configured" | "blocked" | "future";
export type VaultIntegrationTestCaseCategory =
  | "config_validation"
  | "secretref_validation"
  | "path_allowlist"
  | "kv_v2_read"
  | "credential_resolution"
  | "auth_policy_gate"
  | "audit_redaction"
  | "no_secret_exposure";
export type VaultIntegrationTestCaseStatus = "planned" | "active_mock" | "gated_live" | "future";
export type VaultIntegrationTestSafetyCategory =
  | "env_gates"
  | "vault_address"
  | "auth_method"
  | "token_presence"
  | "path_allowlist"
  | "test_secret_path"
  | "no_write"
  | "no_delete"
  | "no_rotate"
  | "no_broad_list"
  | "redaction"
  | "audit"
  | "no_secret_exposure";
export type StagingDeploymentDryRunProfileStatus = "ready_to_evaluate" | "blocked" | "warning" | "future";
export type StagingDeploymentDryRunMode = "read_only";
export type StagingDeploymentDryRunSourceKind =
  | "staging_profile"
  | "ci_cd"
  | "postgres"
  | "github_app"
  | "github_integration_tests"
  | "llm_gateway"
  | "llm_integration_tests"
  | "mcp_gateway"
  | "auth_rbac"
  | "secret_backend"
  | "secretref_credentials"
  | "policy_bundle"
  | "observability"
  | "dashboard"
  | "local_agent"
  | "runner"
  | "git";
export type StagingDeploymentDryRunSourceStatus = "pass" | "warning" | "fail" | "skipped" | "future" | "not_applicable";
export type StagingDeploymentDryRunCheckCategory =
  | "validation"
  | "environment"
  | "storage"
  | "secrets"
  | "auth"
  | "policy"
  | "git"
  | "github_app"
  | "webhook"
  | "llm"
  | "mcp"
  | "runner"
  | "local_agent"
  | "observability"
  | "dashboard"
  | "ci_cd"
  | "security"
  | "rollback";
export type StagingDeploymentDryRunCheckStatus = "pass" | "warning" | "fail" | "skipped" | "not_checked" | "not_applicable";
export type StagingDeploymentDryRunBlockingLevel =
  | "blocks_staging_dry_run"
  | "blocks_staging_deployment"
  | "blocks_production_only"
  | "advisory";
export type StagingDeploymentDryRunBlockerStatus = "open" | "accepted" | "mitigated" | "deferred";
export type StagingDeploymentDryRunOverallStatus = "pass" | "pass_with_warnings" | "blocked" | "not_ready";
export type StagingDeploymentDryRunIntegrationStatus = "ready" | "gated" | "skipped" | "blocked" | "future";

export type StagingDeploymentDryRunOptions = {
  requireLiveGitHubValidation?: boolean;
  requireLiveLLMValidation?: boolean;
  validationCommandStatus?: "pass" | "fail";
  failedValidationCommands?: string[];
  secretsExposed?: boolean;
  envValuesExposed?: boolean;
};
export type StagingReleaseCandidateStatus = "ready_to_evaluate" | "pass" | "pass_with_warnings" | "blocked" | "not_ready";
export type StagingReleaseCandidateGateCategory =
  | "validation"
  | "docs"
  | "staging_dry_run"
  | "ci_cd"
  | "git_integration"
  | "llm_integration"
  | "mcp"
  | "db"
  | "secrets"
  | "auth"
  | "policy"
  | "observability"
  | "dashboard"
  | "security"
  | "rollback";
export type StagingReleaseCandidateGateStatus = "pass" | "warning" | "fail" | "skipped" | "not_checked" | "not_applicable";
export type StagingReleaseCandidateBlockingLevel =
  | "blocks_release_candidate"
  | "blocks_staging_deployment"
  | "blocks_production_only"
  | "advisory";
export type StagingReleaseCandidateBlockerStatus = "open" | "accepted" | "mitigated" | "deferred";
export type StagingReleaseCandidateSignoffRole =
  | "engineering_owner"
  | "platform_owner"
  | "security_reviewer"
  | "product_owner"
  | "qa_reviewer"
  | "release_manager";
export type StagingReleaseCandidateSignoffStatus = "pending" | "approved_mock" | "waived" | "not_applicable";
export type StagingHumanSignoffStatus = "pending" | "approved" | "conditionally_approved" | "rejected" | "waived";
export type StagingSignoffReviewedScopeMethod = "commit_sha" | "explicit_diff_scope";
export type StagingSignoffWorktreeStatus = "clean" | "dirty";
export type StagingSignoffReviewedDiffScope = {
  worktreeStatus: StagingSignoffWorktreeStatus;
  modifiedFiles: string[];
  untrackedFiles: string[];
  diffNameStatus?: string[];
  diffStat?: string[];
  diffScopeHash?: string;
};
export type StagingSignoffScopeSnapshot = {
  reviewedCommitSha: string;
  reviewedBranch: string;
  reviewedScopeMethod: StagingSignoffReviewedScopeMethod;
  reviewedDiffScope: StagingSignoffReviewedDiffScope;
  scopeCapturedAt: string;
  scopeEvidencePath: string;
  validationEvidencePaths: string[];
};
export type StagingSignoffScopeReviewStatus = "pending" | "matched" | "stale" | "rejected";
export type StagingSignoffScopeReview = {
  status: StagingSignoffScopeReviewStatus;
  requiredRoleCount: number;
  matchingRoleCount: number;
  pendingRoles: StagingReleaseCandidateSignoffRole[];
  staleRoles: StagingReleaseCandidateSignoffRole[];
  rejectedRoles: StagingReleaseCandidateSignoffRole[];
  conditionalRoles: StagingReleaseCandidateSignoffRole[];
  currentScope: StagingSignoffScopeSnapshot;
  actualDeploymentBlocked: true;
  productionReady: false;
  stagingDeployed: false;
  approvalAuditCanPass: boolean;
  metadata: Record<string, unknown>;
};
export type StagingHumanSignoffEvidence = {
  role: StagingReleaseCandidateSignoffRole;
  required: boolean;
  status: StagingHumanSignoffStatus;
  approverName?: string;
  approverContact?: string;
  signedAt?: string;
  reviewedEvidence: string[];
  reviewedCommitSha?: string;
  reviewedBranch?: string;
  reviewedScopeMethod?: StagingSignoffReviewedScopeMethod;
  reviewedDiffScope?: StagingSignoffReviewedDiffScope;
  scopeCapturedAt?: string;
  scopeEvidencePath?: string;
  validationEvidencePaths?: string[];
  conditions?: string[];
  notes?: string;
  signatureMethod?: string;
  evidenceSource?: string;
  metadata: Record<string, unknown>;
};
export type StagingReleaseNoteSection =
  | "summary"
  | "changed_areas"
  | "validation"
  | "skipped_tests"
  | "known_limitations"
  | "safety_gates"
  | "migration_notes"
  | "dashboard_readiness"
  | "rollback_notes"
  | "follow_ups";
export type StagingReleaseNoteRequirementStatus = "present" | "missing" | "not_applicable";
export type StagingRollbackChecklistCategory =
  | "code_revert"
  | "database"
  | "config"
  | "feature_flags"
  | "git_integration"
  | "llm_integration"
  | "secrets"
  | "observability"
  | "dashboard";
export type StagingRollbackChecklistStatus = "planned" | "missing" | "not_applicable";
export type StagingReleaseCandidateOverallStatus = "pass" | "pass_with_warnings" | "blocked" | "not_ready";

export type StagingReleaseCandidateOptions = {
  validationCommandStatus?: "pass" | "fail" | "not_checked";
  failedValidationCommands?: string[];
  diffCheckStatus?: "pass" | "warning" | "fail" | "not_checked";
  knownDiffCheckWarnings?: string[];
  missingRequiredDocs?: string[];
  releaseNoteSectionsPresent?: Partial<Record<StagingReleaseNoteSection, boolean>>;
  signoffStatuses?: Partial<Record<StagingReleaseCandidateSignoffRole, StagingReleaseCandidateSignoffStatus>>;
  rollbackStatuses?: Partial<Record<StagingRollbackChecklistCategory, StagingRollbackChecklistStatus>>;
  secretsExposed?: boolean;
  envValuesExposed?: boolean;
  releaseCreated?: boolean;
  gitTagCreated?: boolean;
  githubReleaseCreated?: boolean;
  deploymentExecuted?: boolean;
  externalCallsExecuted?: boolean;
  productionReadyClaimed?: boolean;
  stagingDeployedClaimed?: boolean;
};
export type StagingDeploymentExecutionPlanStatus = "planned" | "ready_for_signoff" | "blocked" | "future";
export type StagingDeploymentStepPhase =
  | "pre_deploy"
  | "approval"
  | "config_freeze"
  | "validation"
  | "migration_decision"
  | "deployment_placeholder"
  | "smoke_test"
  | "observability_check"
  | "rollback_decision"
  | "post_deploy_review";
export type StagingDeploymentStepStatus = "planned" | "ready" | "blocked" | "not_applicable" | "future";
export type StagingDeploymentAutomationLevel = "manual" | "scripted_future" | "automated_future";
export type StagingDeploymentGateCategory =
  | "validation"
  | "signoff"
  | "environment"
  | "database"
  | "secrets"
  | "auth"
  | "policy"
  | "git"
  | "github_app"
  | "webhook"
  | "llm"
  | "vault"
  | "mcp"
  | "observability"
  | "dashboard"
  | "rollback";
export type StagingDeploymentGateStatus = "pass" | "warning" | "fail" | "skipped" | "not_checked" | "not_applicable";
export type StagingDeploymentGoNoGoStatus = "go" | "go_with_warnings" | "no_go" | "not_ready";
export type StagingDeploymentRollbackPlanStatus = "planned" | "ready_for_review" | "blocked" | "future";

export type StagingDeploymentExecutionOptions = {
  signoffStatuses?: Partial<Record<StagingReleaseCandidateSignoffRole, StagingReleaseCandidateSignoffStatus>>;
  humanSignoffs?: Partial<Record<StagingReleaseCandidateSignoffRole, StagingHumanSignoffEvidence>>;
  validationCommandStatus?: "pass" | "fail" | "not_checked";
  failedValidationCommands?: string[];
  diffCheckStatus?: "pass" | "warning" | "fail" | "not_checked";
  safeIntegrationScanStatus?: "pass" | "fail" | "not_checked";
  noSecretExposureStatus?: "pass" | "fail" | "not_checked";
  requirePostgresLiveValidation?: boolean;
  requireGitHubLiveValidation?: boolean;
  requireLLMLiveValidation?: boolean;
  requireVaultLiveValidation?: boolean;
  releaseNotesPresent?: boolean;
  rollbackPlanPresent?: boolean;
  deploymentExecuted?: boolean;
  releaseCreated?: boolean;
  gitTagCreated?: boolean;
  externalCallsExecuted?: boolean;
  secretsExposed?: boolean;
  envValuesExposed?: boolean;
  productionReadyClaimed?: boolean;
  stagingDeployedClaimed?: boolean;
};

export type DeploymentProfile = {
  id: DeploymentProfileName;
  name: DeploymentProfileName;
  description: string;
  requiredComponents: DeploymentUnit[];
  requiredEnvVars: string[];
  disabledFeatures: string[];
  allowedProviderKinds: string[];
  storageMode: StorageMode;
  authMode: AuthMode;
  secretMode: SecretMode;
  policyMode: PolicyMode;
  observabilityMode: ObservabilityMode;
  readinessChecks: string[];
  metadata: Record<string, unknown>;
};

export type ReadinessCheck = {
  id: string;
  profileId: DeploymentProfileName;
  category: string;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type ProductionRisk = {
  id: string;
  category: string;
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  owner?: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type DeploymentReadinessEnvironment = {
  requestedProfileId: DeploymentProfileName;
  storageProvider: string;
  databaseConfigured: boolean;
  remoteGitEnabled: boolean;
  githubProviderSelected: boolean;
  githubTokenSecretRefConfigured: boolean;
  githubLegacyTokenConfigured: boolean;
  githubWebhooksEnabled: boolean;
  githubWebhookSecretRefConfigured: boolean;
  githubWebhookLegacySecretConfigured: boolean;
  remoteLlmEnabled: boolean;
  remoteLlmCompletionEnabled: boolean;
  llmProvider: string;
  llmSecretRefConfigured: boolean;
  llmLegacyApiKeyConfigured: boolean;
  llmBaseUrlConfigured: boolean;
  llmRoutingMode: string;
  llmFallbackEnabled: boolean;
  envSecretProviderEnabled: boolean;
  allowedSecretEnvKeyCount: number;
  localAgentRunnerEnabled: boolean;
  localCommandExecutionEnabled: boolean;
  dashboardDataSource: string;
  mcpRealTransportEnabled: false;
  productionAuthEnabled: false;
  realSecretBackendEnabled: false;
  policyBundleRuntimeEnabled: false;
  observabilityBackendConfigured: false;
  auditExportConfigured: false;
  secretsExposed: false;
};

export type DeploymentReadinessSummary = {
  generatedAt: Date;
  currentProfileId: DeploymentProfileName;
  productionReadinessStatus: "planning_only" | "not_ready" | "blocked";
  productionReady: false;
  profileCount: number;
  checkCount: number;
  riskCount: number;
  criticalBlockerCount: number;
  highRiskOpenCount: number;
  checksByStatus: Record<ReadinessCheckStatus, number>;
  risksBySeverity: Record<ReadinessSeverity, number>;
  criticalBlockers: ReadinessCheck[];
  highRiskAreas: ProductionRisk[];
  missingProductionRequirements: string[];
  environmentWarnings: string[];
  environment: DeploymentReadinessEnvironment;
  noSecretsExposed: true;
  metadata: Record<string, unknown>;
};

export type GitHubAppDescriptor = {
  id: string;
  appSlug: string;
  appId?: string;
  name: string;
  status: GitHubAppDescriptorStatus;
  webhookUrl?: string;
  permissions: Record<string, GitHubPermissionLevel>;
  events: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type GitHubAppInstallation = {
  id: string;
  appDescriptorId: string;
  installationId?: string;
  accountLogin: string;
  accountType: GitHubAppAccountType;
  repositorySelection: GitHubRepositorySelection;
  status: GitHubAppInstallationStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type GitHubAppRepositoryGrant = {
  id: string;
  installationId: string;
  repoOwner: string;
  repoName: string;
  repoId?: string;
  permissions: Record<string, GitHubPermissionLevel>;
  status: GitHubRepositoryGrantStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
};

export type GitHubAppPermissionMatrixEntry = {
  id: string;
  githubPermissionName: string;
  requiredLevel: GitHubPermissionLevel;
  requiredFor: string;
  riskLevel: GitHubPlanningRiskLevel;
  productionDefault: "allow" | "deny" | "future_review";
  approvalRequirement: string;
  auditRequirement: string;
  currentlyImplemented: boolean;
  futureOnly: boolean;
  metadata: Record<string, unknown>;
};

export type GitHubWebhookEventAllowlistEntry = {
  id: string;
  eventName: string;
  supportStatus: GitHubWebhookEventSupportStatus;
  actionsHandled: string[];
  signatureVerificationRequired: true;
  idempotencyKey: string;
  sideEffects: string[];
  auditEvents: string[];
  readModelUpdates: string[];
  riskNotes: string[];
  metadata: Record<string, unknown>;
};

export type GitHubWebhookDeliveryRecord = {
  id: string;
  deliveryId: string;
  eventType: string;
  repoRef?: string;
  action?: string;
  receivedAt: Date;
  signatureVerified: boolean;
  replayStatus: GitHubWebhookReplayStatus;
  processingStatus: GitHubWebhookProcessingStatus;
  payloadHash: string;
  attemptCount: number;
  lastAttemptAt?: Date;
  metadata: Record<string, unknown>;
};

export type GitHubWebhookDeadLetterRecord = {
  id: string;
  deliveryId: string;
  eventType: string;
  repoRef?: string;
  reason: string;
  sanitizedPayloadPreview?: string;
  retryable: boolean;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type GitHubWebhookReplayProtectionPlan = {
  id: string;
  status: "planning_only";
  deliveryIdUniqueness: "required";
  payloadHashStrategy: "sha256_metadata_only";
  timestampToleranceSeconds?: number;
  duplicateDeliveryBehavior: string;
  replayRejectedBehavior: string;
  idempotentProcessingBehavior: string;
  persistenceRequirement: string;
  productionReady: false;
  auditEvents: string[];
  testStrategy: string[];
  metadata: Record<string, unknown>;
};

export type GitHubWebhookDeadLetterPlan = {
  id: string;
  status: "planning_only";
  retryableErrors: string[];
  nonRetryableErrors: string[];
  maxRetryAttempts: number;
  backoffStrategy: string;
  manualReviewProcess: string;
  productionReady: false;
  auditEvents: string[];
  observabilityMetrics: string[];
  metadata: Record<string, unknown>;
};

export type GitHubAppCredentialReadiness = {
  id: string;
  status: "planning_only";
  privateKeySecretRefRequired: true;
  privateKeyConfigured: false;
  webhookSecretRefRequired: true;
  webhookSecretConfiguredForProduction: false;
  installationTokenExchangeImplemented: false;
  tokenTtlSeconds: number;
  legacyEnvTokenProductionReady: false;
  migrationSteps: string[];
  auditEvents: string[];
  redactionRequirements: string[];
  noSecretsStored: true;
  metadata: Record<string, unknown>;
};

export type GitHubProductionWebhookEndpointPlan = {
  id: string;
  endpointPath: string;
  status: "planning_only";
  tlsRequired: true;
  rawBodyPreservationRequired: true;
  payloadSizeLimitBytes: number;
  rateLimitStrategy: string;
  queueRequired: true;
  productionReady: false;
  failureModes: string[];
  rolloutSteps: string[];
  metadata: Record<string, unknown>;
};

export type GitHubAppReadinessCheck = {
  id: string;
  category: "permissions" | "credentials" | "webhook_endpoint" | "replay" | "dead_letter" | "observability" | "policy" | "auth" | "storage";
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type GitHubAppProductionRisk = {
  id: string;
  category: string;
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  owner?: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type GitHubWebhookHardeningSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  productionReady: false;
  githubAppLiveEnabled: false;
  productionWebhooksEnabled: false;
  externalCallsEnabled: false;
  appDescriptorCount: number;
  installationCount: number;
  repositoryGrantCount: number;
  permissionCount: number;
  webhookEventCount: number;
  supportedNowEventCount: number;
  plannedEventCount: number;
  deniedEventCount: number;
  replayProtectionStatus: "planned_not_production_ready";
  deadLetterStatus: "planned_not_implemented";
  credentialStatus: "github_app_private_key_future_secretref";
  endpointStatus: "planned_not_deployed";
  blockerCount: number;
  riskCount: number;
  noSecretsExposed: true;
  metadata: Record<string, unknown>;
};

export type DatabaseDeploymentProfile = {
  id: DatabaseDeploymentProfileName;
  name: DatabaseDeploymentProfileName;
  storageProvider: DatabaseStorageProviderKind | "postgres_required";
  postgresRequired: boolean;
  migrationsRequired: boolean;
  poolingRequired: boolean;
  backupRequired: boolean;
  restoreTestRequired: boolean;
  retentionPolicyRequired: boolean;
  monitoringRequired: boolean;
  status: DatabaseOperationsStatus;
  metadata: Record<string, unknown>;
};

export type DatabaseReadinessCheck = {
  id: string;
  profileId: DatabaseDeploymentProfileName;
  category: DatabaseReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type DatabaseOperationRisk = {
  id: string;
  category: DatabaseReadinessCategory | "migration_rollback" | "tenant_scope" | "secret_handling";
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type DatabaseMigrationStatus = {
  id: string;
  migrationId: string;
  name: string;
  status: DatabaseMigrationStatusValue;
  checksum?: string;
  appliedAt?: Date;
  metadata: Record<string, unknown>;
};

export type DatabaseSchemaInventoryItem = {
  id: string;
  tableName: string;
  purpose: string;
  ownerModule: string;
  highGrowth: boolean;
  retentionClass?: string;
  keyIndexes: string[];
  missingIndexes: string[];
  metadata: Record<string, unknown>;
};

export type DatabaseIndexReviewItem = {
  id: string;
  tableName: string;
  queryPattern: string;
  recommendedIndex: string;
  uniquenessRequirements: string;
  retentionPartitioningNotes: string;
  status: DatabaseIndexReviewStatus;
  metadata: Record<string, unknown>;
};

export type DatabaseRetentionPlan = {
  id: string;
  status: "planning_only";
  deletionJobsEnabled: false;
  retentionClassesAligned: true;
  partitioningImplemented: false;
  archiveExportImplemented: false;
  legalHoldImplemented: false;
  highGrowthTables: string[];
  retentionClasses: string[];
  operationalRisks: string[];
  metadata: Record<string, unknown>;
};

export type DatabaseAuditGrowthPlan = {
  id: string;
  status: "planning_only";
  highGrowthTables: string[];
  auditCategories: string[];
  partitioningCandidates: string[];
  requiredQueryLimits: string[];
  noDeletionInV1: true;
  metadata: Record<string, unknown>;
};

export type DatabaseWebhookPersistencePlan = {
  id: string;
  status: "planning_only";
  deliveryRecordTable: string;
  deadLetterTable: string;
  deliveryIdUniqueness: "required";
  payloadHashStrategy: "sha256_metadata_only";
  duplicateDetection: string;
  replayRejection: string;
  retryCounterStrategy: string;
  backgroundWorkerImplemented: false;
  rawPayloadStorage: false;
  indexRequirements: string[];
  retentionRequirements: string[];
  observabilityMetrics: string[];
  metadata: Record<string, unknown>;
};

export type DatabaseOperationsSummary = {
  generatedAt: Date;
  status: "v1_implemented";
  planningOnly: true;
  productionReady: false;
  storageProviderKind: DatabaseStorageProviderKind;
  databaseUrlConfigured: boolean;
  testDatabaseUrlConfigured: boolean;
  migrationRunnerAvailable: boolean;
  migrationFileCount: number;
  schemaInventoryCount: number;
  indexReviewItemCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  riskCount: number;
  poolingStatus: "planned_not_enabled";
  backupStatus: "planned_not_configured";
  restoreStatus: "planned_not_tested";
  retentionDeletionJobsEnabled: false;
  productionDbConnectionAttempted: false;
  noSecretsExposed: true;
  databaseUrlExposed: false;
  metadata: Record<string, unknown>;
};

export type SecretBackendOption = {
  id: string;
  backendKind: SecretBackendKind;
  displayName: string;
  status: SecretBackendOptionStatus;
  supportsLease: boolean;
  supportsRotation: boolean;
  supportsVersioning: boolean;
  supportsAudit: boolean;
  supportsIAM: boolean;
  supportsNamespace: boolean;
  supportsReplication: boolean;
  operationalComplexity: SecretBackendOperationalComplexity;
  productionRecommended: boolean;
  notes: string[];
  metadata: Record<string, unknown>;
};

export type SecretBackendMigrationPhase = {
  id: string;
  name: string;
  order: number;
  sourceProvider: SecretBackendKind;
  targetProvider: SecretBackendKind | "selected_real_backend";
  credentialKinds: SecretCredentialKind[];
  requiredPreconditions: string[];
  migrationSteps: string[];
  validationChecks: string[];
  rollbackPlan: string[];
  status: SecretBackendMigrationPhaseStatus;
  metadata: Record<string, unknown>;
};

export type SecretBackendReadinessCheck = {
  id: string;
  category: SecretBackendReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type SecretBackendRisk = {
  id: string;
  category: SecretBackendReadinessCategory | "credential_migration" | "backend_operations" | "provider_identity";
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type SecretRotationPlan = {
  id: string;
  secretKind: SecretCredentialKind;
  backendKind: SecretBackendKind | "selected_real_backend";
  rotationMode: SecretRotationMode;
  targetIntervalDays?: number;
  requiresDowntime: boolean;
  validationChecks: string[];
  rollbackPlan: string[];
  auditRequirements: string[];
  status: SecretRotationPlanStatus;
  metadata: Record<string, unknown>;
};

export type SecretLeasePolicy = {
  id: string;
  secretKind: SecretCredentialKind;
  maxTtlSeconds: number;
  renewable: boolean;
  requiresApproval: boolean;
  allowedActors: string[];
  allowedPurposes: string[];
  status: SecretLeasePolicyStatus;
  metadata: Record<string, unknown>;
};

export type SecretBackendMigrationSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  productionReady: false;
  currentProfileId: DeploymentProfileName;
  realSecretBackendConfigured: false;
  externalCallsEnabled: false;
  credentialResolutionAttempted: false;
  rotationJobsImplemented: false;
  productionCredentialIssuanceImplemented: false;
  credentialCachesRead: false;
  envFallbackAllowedForCurrentProfile: boolean;
  envFallbackWarning: string;
  envSecretProviderEnabled: boolean;
  allowedSecretEnvKeyCount: number;
  legacyEnvFallbackProductionReady: false;
  backendOptionCount: number;
  recommendedBackendCount: number;
  migrationPhaseCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  riskCount: number;
  rotationPlanCount: number;
  leasePolicyCount: number;
  noSecretsExposed: true;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type SecretBackendDecisionProviderValue =
  | "mock"
  | "env"
  | "vault"
  | "vault_future"
  | "aws_secrets_manager_future"
  | "gcp_secret_manager_future"
  | "azure_key_vault_future"
  | "custom_future";

export type SecretBackendOptionDecisionStatus = "proposed" | "accepted_mock" | "blocked" | "deferred";
export type SecretBackendImplementationScopeStatus = "planned" | "ready_for_implementation" | "v1_implemented" | "blocked" | "future";
export type SecretBackendProviderProductionStatus = "test_only" | "local_integration_only" | "selected_for_v1" | "v1_implemented_gated" | "deferred" | "future" | "not_allowed";
export type SecretBackendDecisionRiskCategory =
  | "secret_exposure"
  | "tenant_access"
  | "env_fallback"
  | "rotation"
  | "backend_outage"
  | "audit"
  | "break_glass"
  | "iam"
  | "credential_cache"
  | "local_agent"
  | "testing"
  | "dashboard_health"
  | "backup_restore"
  | "incident_response";

export type SecretBackendOptionDecision = {
  id: string;
  recommendedBackend: SecretBackendDecisionProviderValue;
  secondChoiceBackend: SecretBackendDecisionProviderValue;
  decisionStatus: SecretBackendOptionDecisionStatus;
  rationale: string[];
  assumptions: string[];
  risks: string[];
  implementationScopeRef: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

export type SecretBackendDecisionCriterion = {
  id: string;
  name: string;
  weight: number;
  description: string;
  metadata: Record<string, unknown>;
};

export type SecretBackendDecisionScore = {
  id: string;
  backendKind: SecretBackendDecisionProviderValue;
  criterionId: string;
  score: number;
  weightedScore: number;
  rationale: string;
  metadata: Record<string, unknown>;
};

export type SecretBackendImplementationScope = {
  id: string;
  backendKind: SecretBackendDecisionProviderValue;
  version: "v1";
  status: SecretBackendImplementationScopeStatus;
  includedCapabilities: string[];
  excludedCapabilities: string[];
  requiredConfig: string[];
  requiredTests: string[];
  metadata: Record<string, unknown>;
};

export type SecretBackendProviderMapping = {
  id: string;
  providerValue: SecretBackendDecisionProviderValue;
  currentStatus: string;
  productionStatus: SecretBackendProviderProductionStatus;
  providerIdentifier: string;
  requiredConfig: string[];
  allowedProfiles: DeploymentProfileName[];
  forbiddenProfiles: DeploymentProfileName[];
  requiredAuthRbac: string[];
  requiredPolicy: string[];
  auditRequirements: string[];
  healthDashboardExposure: string[];
  testStrategy: string[];
  metadata: Record<string, unknown>;
};

export type SecretBackendDecisionRisk = {
  id: string;
  category: SecretBackendDecisionRiskCategory;
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  ownerPlaceholder: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type SecretBackendOptionDecisionSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  decisionStatus: SecretBackendOptionDecisionStatus;
  recommendedBackend: SecretBackendDecisionProviderValue;
  secondChoiceBackend: SecretBackendDecisionProviderValue;
  implementationReady: boolean;
  productionSecretBackendImplemented: false;
  envFallbackProductionAllowed: false;
  externalCallsEnabled: false;
  secretReadsAttempted: false;
  secretRotationsAttempted: false;
  secretMigrationsAttempted: false;
  productionCredentialsIssued: false;
  credentialCachesRead: false;
  criterionCount: number;
  scoreCount: number;
  implementationScopeCount: number;
  riskCount: number;
  criticalRiskCount: number;
  providerMappingCount: number;
  noSecretsExposed: true;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type AuthProviderOption = {
  id: string;
  providerKind: AuthProviderOptionKind;
  displayName: string;
  status: AuthProviderOptionStatus;
  supportsSso: boolean;
  supportsScim: boolean;
  supportsGroups: boolean;
  supportsServiceAccounts: boolean;
  supportsMfaSignals: boolean;
  supportsDeviceTrust: boolean;
  productionRecommended: boolean;
  operationalComplexity: AuthRbacOperationalComplexity;
  notes: string[];
  metadata: Record<string, unknown>;
};

export type AuthRbacMigrationPhase = {
  id: string;
  name: string;
  order: number;
  sourceMode: string;
  targetMode: string;
  requiredPreconditions: string[];
  migrationSteps: string[];
  validationChecks: string[];
  rollbackPlan: string[];
  status: AuthRbacMigrationPhaseStatus;
  metadata: Record<string, unknown>;
};

export type AuthRbacReadinessCheck = {
  id: string;
  category: AuthRbacReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type AuthRbacProductionRisk = {
  id: string;
  category: AuthRbacReadinessCategory | "actor_attribution" | "identity_operations" | "service_boundary";
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type TenantBoundaryPlan = {
  id: string;
  tenantKind: TenantBoundaryKind;
  description: string;
  isolationRequirements: string[];
  dataAccessRules: string[];
  providerAccessRules: string[];
  secretAccessRules: string[];
  auditRequirements: string[];
  status: TenantBoundaryPlanStatus;
  metadata: Record<string, unknown>;
};

export type ServiceAccountPlan = {
  id: string;
  serviceAccountKind: ServiceAccountPlanKind;
  requiredScopes: string[];
  allowedActions: string[];
  forbiddenActions: string[];
  credentialStrategy: string;
  rotationStrategy: string;
  auditRequirements: string[];
  status: ServiceAccountPlanStatus;
  metadata: Record<string, unknown>;
};

export type AuthRbacPermissionMatrixEntry = {
  id: string;
  roleName: ProductionRbacRoleName;
  purpose: string;
  allowedActions: string[];
  deniedActions: string[];
  requiredScopes: string[];
  riskLevel: ReadinessSeverity;
  productionDefault: "allow" | "deny" | "future_review";
  auditRequirement: string;
  currentImplementationStatus: "implemented_mock" | "partial_mock" | "planned" | "future_only";
  futureWork: string[];
  metadata: Record<string, unknown>;
};

export type AuthRbacProductionSummary = {
  generatedAt: Date;
  status: "v1_implemented";
  planningOnly: true;
  productionReady: false;
  currentProfileId: DeploymentProfileName;
  productionAuthEnabled: false;
  authMode: "mock";
  mockActorEnabled: boolean;
  mockActorWarning: string;
  futureIdpConfigured: false;
  externalIdpCallsEnabled: false;
  realSessionsImplemented: false;
  realJwtIssuanceImplemented: false;
  passwordLoginImplemented: false;
  serviceAccountCredentialIssuanceImplemented: false;
  requestContextPropagationStatus: "partial_mock_only";
  serviceAccountModelReady: boolean;
  tenantScopeModelReady: false;
  policySubjectTenantMappingImplemented: false;
  mockHeaderOverrideProductionReady: false;
  providerOptionCount: number;
  recommendedProviderCount: number;
  migrationPhaseCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  riskCount: number;
  tenantBoundaryPlanCount: number;
  serviceAccountPlanCount: number;
  permissionMatrixRoleCount: number;
  noTokensExposed: true;
  cookiesExposed: false;
  sessionIdsExposed: false;
  passwordsExposed: false;
  rawIdentityAssertionsExposed: false;
  metadata: Record<string, unknown>;
};

export type ProductionAuthProviderSkeletonSummary = {
  generatedAt: Date;
  status: "v1_implemented";
  planningOnly: true;
  activeProviderKind: "mock";
  selectedProviderKind: ProductionAuthProviderKind;
  selectedProviderStatus: ProductionAuthProviderStatus;
  productionAuthEnabled: false;
  requireAuthForApi: false;
  futureProviderSelected: boolean;
  futureProviderBlocked: boolean;
  tokenValidationEnabled: false;
  sessionBoundaryEnabled: false;
  sessionBoundaryStatus: "disabled" | "future";
  identityMappingStatus: "not_configured" | "future";
  externalCallsEnabled: false;
  externalIdpCallsEnabled: false;
  missingConfigCount: number;
  blockerCount: number;
  providerOptionCount: number;
  readinessCheckCount: number;
  sessionBoundaryPlanCount: number;
  identityMappingPlanCount: number;
  noTokensExposed: true;
  authorizationHeadersStored: false;
  cookiesStored: false;
  sessionIdsExposed: false;
  envValuesExposed: false;
  secretsExposed: false;
  productionReady: false;
  metadata: Record<string, unknown>;
};

export type PolicyEngineOption = {
  id: string;
  engineKind: PolicyEngineOptionKind;
  displayName: string;
  status: PolicyEngineOptionStatus;
  supportsPartialEvaluation: boolean;
  supportsSignedBundles: boolean;
  supportsDecisionLogs: boolean;
  supportsPolicyTests: boolean;
  supportsHumanReadableReview: boolean;
  supportsResourceHierarchy: boolean;
  supportsTenantIsolation: boolean;
  operationalComplexity: PolicyBundleOperationalComplexity;
  productionRecommended: boolean;
  notes: string[];
  metadata: Record<string, unknown>;
};

export type PolicyBundlePlan = {
  id: string;
  name: string;
  bundleKind: PolicyBundleKind;
  status: PolicyBundlePlanStatus;
  targetDomains: PolicyDomainName[];
  versioningStrategy: string;
  signingStrategy: string;
  reviewStrategy: string;
  rolloutStrategy: string;
  rollbackStrategy: string;
  testStrategy: string;
  metadata: Record<string, unknown>;
};

export type PolicyDomainMapping = {
  id: string;
  domain: PolicyDomainName;
  currentImplementation: string;
  futurePolicyBundle: string;
  requiredInputs: string[];
  requiredOutputs: string[];
  migrationStatus: PolicyDomainMigrationStatus;
  riskLevel: ReadinessSeverity;
  metadata: Record<string, unknown>;
};

export type PolicyBundleReadinessCheck = {
  id: string;
  category: PolicyBundleReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type PolicyBundleRisk = {
  id: string;
  category: PolicyBundleReadinessCategory | "runtime_safety" | "policy_governance" | "migration";
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type PolicyBundleMigrationPhase = {
  id: string;
  name: string;
  order: number;
  sourceMode: string;
  targetMode: string;
  domains: PolicyDomainName[];
  requiredPreconditions: string[];
  migrationSteps: string[];
  validationChecks: string[];
  rollbackPlan: string[];
  status: PolicyBundleMigrationPhaseStatus;
  metadata: Record<string, unknown>;
};

export type PolicyBundleReadinessSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  productionReady: false;
  currentEngineKind: "static_typescript_current";
  policyBundleManagementEnabled: false;
  externalPolicyEngineEnabled: false;
  opaIntegrationEnabled: false;
  cedarIntegrationEnabled: false;
  signedBundleSupportEnabled: false;
  signedBundleVerificationEnabled: false;
  dynamicPolicyExecutionEnabled: false;
  remotePolicyLoadingEnabled: false;
  policyRuntimeChanged: false;
  staticPolicyRuleCount: number;
  engineOptionCount: number;
  recommendedEngineCount: number;
  bundlePlanCount: number;
  domainMappingCount: number;
  mappedDomainCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  riskCount: number;
  migrationPhaseCount: number;
  reviewWorkflowStatus: "planned_not_implemented";
  testStrategyStatus: "planned_not_implemented";
  rolloutStatus: "planned_not_implemented";
  rollbackStatus: "planned_not_implemented";
  breakGlassStatus: "planned_not_implemented";
  noSecretsExposed: true;
  policyCodeExecuted: false;
  externalCallsEnabled: false;
  metadata: Record<string, unknown>;
};

export type ProductionAuthProviderConfig = {
  id: string;
  providerKind: ProductionAuthProviderKind;
  status: ProductionAuthProviderStatus;
  displayName: string;
  issuerConfigured: boolean;
  audienceConfigured: boolean;
  jwksConfigured: boolean;
  metadataUrlConfigured: boolean;
  scimEndpointConfigured: boolean;
  groupMappingConfigured: boolean;
  tenantMappingConfigured: boolean;
  sessionBoundaryConfigured: boolean;
  tokenValidationEnabled: false;
  externalCallsEnabled: false;
  productionReady: false;
  metadata: Record<string, unknown>;
};

export type ProductionAuthProviderReadiness = {
  id: string;
  providerKind: ProductionAuthProviderKind;
  status: ProductionAuthProviderReadinessStatus;
  requiredConfig: string[];
  missingConfig: string[];
  warnings: string[];
  blockers: string[];
  metadata: Record<string, unknown>;
};

export type SessionTokenBoundaryPlan = {
  id: string;
  boundaryKind: SessionTokenBoundaryKind;
  status: SessionTokenBoundaryStatus;
  tokenIssued: false;
  validationEnabled: false;
  storageStrategy: string;
  rotationStrategy: string;
  revocationStrategy: string;
  auditRequirements: string[];
  metadata: Record<string, unknown>;
};

export type IdentityMappingPlan = {
  id: string;
  mappingKind: IdentityMappingKind;
  status: IdentityMappingStatus;
  requiredClaims: string[];
  targetModel: string;
  risks: string[];
  metadata: Record<string, unknown>;
};
export type PolicyRuntimePocOption = {
  id: string;
  optionKind: PolicyRuntimePocOptionKind;
  displayName: string;
  status: PolicyRuntimePocOptionStatus;
  pocGoal: string;
  inputsRequired: string[];
  outputContract: string[];
  testability: string;
  auditability: string;
  developerReviewExperience: string;
  scopeModelCompatibility: string;
  authRbacCompatibility: string;
  performanceConsiderations: string;
  operationalComplexity: PolicyBundleOperationalComplexity;
  securityRisks: string[];
  productionSuitability: string;
  recommendation: string;
  runtimeImplemented: false;
  metadata: Record<string, unknown>;
};

export type PolicyRuntimePocInputContract = {
  id: string;
  version: "policy_runtime_poc_input_v0";
  subjectFields: string[];
  requestFields: string[];
  resourceFields: string[];
  actionField: "action";
  environmentFields: string[];
  contextFields: string[];
  outputFields: string[];
  supportedDecisions: PolicyRuntimePocDecision[];
  redactionRequirements: string[];
  metadata: Record<string, unknown>;
};

export type PolicyRuntimePocDomainMapping = {
  id: string;
  domain: PolicyRuntimePocDomainName;
  currentStaticAction: string;
  currentResourceKind: string;
  requiredSubjectFields: string[];
  requiredScopeFields: string[];
  requiredEnvironmentGates: string[];
  expectedDenyByDefaultBehavior: string;
  pocTestCases: string[];
  futureBundleRepresentation: string;
  metadata: Record<string, unknown>;
};

export type PolicyRuntimePocGoldenCase = {
  id: string;
  domain: PolicyRuntimePocDomainName;
  action: string;
  title: string;
  expectedDecision: PolicyRuntimePocGoldenCaseOutcome;
  expectedReason: string;
  requiredInputs: string[];
  requiredStaticBehavior: string;
  futureBundleExpectation: string;
  metadata: Record<string, unknown>;
};

export type PolicyRuntimePocReadinessCheck = {
  id: string;
  category: PolicyRuntimePocReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type PolicyRuntimePocRisk = {
  id: string;
  category: PolicyRuntimePocReadinessCategory | "runtime_safety" | "policy_governance" | "migration";
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  status: ProductionRiskStatus;
  metadata: Record<string, unknown>;
};

export type PolicyRuntimePocSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  productionReady: false;
  currentRuntime: "StaticPolicyEngine";
  staticPolicyEngineUnchanged: true;
  recommendedPocOptionId: "policy_runtime_poc_signed_json_yaml";
  recommendedPocPath: "signed_json_yaml_shadow_first";
  runtimeEnforcementEnabled: false;
  shadowEvaluationImplemented: false;
  externalPolicyEngineEnabled: false;
  opaRuntimeImplemented: false;
  cedarRuntimeImplemented: false;
  signedJsonYamlRuntimeImplemented: false;
  customPolicyServiceImplemented: false;
  dynamicPolicyExecutionEnabled: false;
  remotePolicyLoadingEnabled: false;
  hotReloadEnabled: false;
  policyCodeExecuted: false;
  optionCount: number;
  domainMappingCount: number;
  goldenCaseCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  riskCount: number;
  noSecretsExposed: true;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type PolicyShadowEvaluationPlan = {
  id: string;
  status: PolicyShadowEvaluationPlanStatus;
  sourceOfTruth: PolicyShadowSourceOfTruth;
  candidateRuntimeKinds: PolicyShadowCandidateRuntimeKind[];
  domains: Array<PolicyDomainName | PolicyRuntimePocDomainName>;
  rolloutStages: string[];
  enforcementMode: PolicyShadowEnforcementMode;
  metadata: Record<string, unknown>;
};

export type PolicyShadowComparisonRule = {
  id: string;
  comparisonKind: PolicyShadowComparisonKind;
  required: boolean;
  severityOnMismatch: PolicyShadowMismatchSeverity;
  metadata: Record<string, unknown>;
};

export type PolicyShadowMismatch = {
  id: string;
  mismatchKind: PolicyShadowMismatchKind;
  severity: PolicyShadowMismatchSeverity;
  defaultAction: PolicyShadowMismatchDefaultAction;
  productionImpact: string;
  metadata: Record<string, unknown>;
};

export type PolicyShadowEvaluationReport = {
  id: string;
  generatedAt: Date;
  domain: PolicyDomainName | PolicyRuntimePocDomainName | "all_domains";
  caseCount: number;
  matchCount: number;
  mismatchCount: number;
  criticalMismatchCount: number;
  enforcementChanged: false;
  sourceOfTruth: PolicyShadowSourceOfTruth;
  candidateRuntimeKind: PolicyShadowCandidateRuntimeKind;
  metadata: Record<string, unknown>;
};

export type PolicyShadowReadinessCheck = {
  id: string;
  category: PolicyShadowReadinessCategory;
  status: PolicyShadowReadinessStatus;
  severity: PolicyShadowMismatchSeverity;
  description: string;
  remediation: string;
  metadata: Record<string, unknown>;
};

export type PolicyShadowEvaluationSummary = {
  generatedAt: Date;
  status: "v1_implemented";
  planningOnly: true;
  productionReady: false;
  sourceOfTruth: PolicyShadowSourceOfTruth;
  enforcementMode: PolicyShadowEnforcementMode;
  enforcementChanged: false;
  staticPolicyEngineAuthoritative: true;
  shadowEvaluatorImplemented: false;
  candidateRuntimeImplemented: false;
  candidateRuntimeExecuted: false;
  candidateBundleValidated: false;
  dynamicPolicyExecutionEnabled: false;
  externalPolicyServiceCallsEnabled: false;
  remotePolicyBundleLoadingEnabled: false;
  signedBundleVerificationRuntimeEnabled: false;
  opaRuntimeEnabled: false;
  cedarRuntimeEnabled: false;
  policyCodeExecuted: false;
  noSecretsExposed: true;
  envValuesExposed: false;
  planStatus: PolicyShadowEvaluationPlanStatus;
  candidateRuntimeKindCount: number;
  domainCount: number;
  rolloutStageCount: number;
  comparisonRuleCount: number;
  requiredComparisonRuleCount: number;
  mismatchTaxonomyCount: number;
  criticalMismatchKindCount: number;
  readinessCheckCount: number;
  readinessFutureCount: number;
  readinessWarningCount: number;
  readinessFailCount: number;
  reportCount: number;
  goldenCaseSource: "Policy Runtime PoC Golden Test Harness v1";
  recommendedNextTask: string;
  currentRolloutStage: "docs_planning_golden_harness_only";
  candidateRuntimeInterfaceImplemented: false;
  staticPolicyEngineUnchanged: true;
  goldenHarnessSourceOfTruth: "StaticPolicyEngine";
  noDynamicPolicyExecution: true;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentProfile = {
  id: string;
  name: "staging";
  description: string;
  status: StagingDeploymentStatus;
  requiredComponents: DeploymentUnit[];
  requiredEnvGates: string[];
  forbiddenEnvGates: string[];
  allowedIntegrations: StagingIntegrationKind[];
  blockedIntegrations: StagingIntegrationKind[];
  requiredStorageMode: StorageMode;
  requiredAuthMode: AuthMode;
  requiredSecretMode: SecretMode;
  requiredPolicyMode: PolicyMode;
  requiredObservabilityMode: ObservabilityMode;
  readinessChecks: string[];
  productionBlockers: string[];
  metadata: Record<string, unknown>;
};

export type StagingIntegrationGate = {
  id: string;
  integrationKind: StagingIntegrationKind;
  status: StagingIntegrationGateStatus;
  requiredEnvVars: string[];
  forbiddenEnvVars: string[];
  requiredPolicies: string[];
  requiredSecrets: string[];
  notes: string[];
  metadata: Record<string, unknown>;
};

export type StagingReadinessCheck = {
  id: string;
  category: StagingReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type StagingPromotionCriterion = {
  id: string;
  fromProfile: "local" | "integration";
  toProfile: "staging";
  criterion: string;
  required: boolean;
  status: StagingCriterionStatus;
  evidence: string[];
  remediation: string;
  metadata: Record<string, unknown>;
};

export type StagingRollbackCriterion = {
  id: string;
  trigger: string;
  severity: ReadinessSeverity;
  requiredAction: string;
  owner?: string;
  status: StagingRollbackCriterionStatus;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  productionReady: false;
  stagingDeployed: false;
  productionTrafficAllowed: false;
  currentProfileId: DeploymentProfileName;
  profileStatus: StagingDeploymentStatus;
  requiredComponentCount: number;
  requiredEnvGateCount: number;
  forbiddenEnvGateCount: number;
  integrationGateCount: number;
  allowedGateCount: number;
  gatedGateCount: number;
  blockedGateCount: number;
  futureGateCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  warningCount: number;
  promotionCriteriaCount: number;
  promotionCriteriaMetCount: number;
  rollbackCriteriaCount: number;
  mockActorWarning: string;
  envFallbackWarning: string;
  postgresRequired: true;
  apiDashboardRequired: true;
  remoteMergeForbidden: true;
  remoteMcpForbidden: true;
  vendorCliForbidden: true;
  deploymentExecuted: false;
  externalCallsEnabled: false;
  noSecretsExposed: true;
  envValuesExposed: false;
  metadata: Record<string, unknown>;
};

export type CICDPipelineProfile = {
  id: string;
  name: CICDPipelineProfileName;
  description: string;
  status: CICDPipelineProfileStatus;
  requiredJobs: string[];
  optionalJobs: string[];
  forbiddenJobs: string[];
  requiredEnvGates: string[];
  forbiddenEnvGates: string[];
  requiredSecrets: string[];
  artifactPolicy: string;
  approvalPolicy: string;
  metadata: Record<string, unknown>;
};

export type CICDJobDefinition = {
  id: string;
  profileId: CICDPipelineProfileName;
  name: string;
  category: CICDJobCategory;
  command: string;
  required: boolean;
  allowedToCallExternalServices: boolean;
  requiresSecrets: boolean;
  requiredEnvVars: string[];
  timeoutMinutes?: number;
  artifacts: string[];
  status: CICDJobStatus;
  metadata: Record<string, unknown>;
};

export type CICDIntegrationTestGate = {
  id: string;
  integrationKind: CICDIntegrationKind;
  enabledByDefault: boolean;
  requiredEnvVars: string[];
  requiredSecrets: string[];
  requiredApprovals: string[];
  cleanupRequired: boolean;
  allowedProfiles: CICDPipelineProfileName[];
  blockedProfiles: CICDPipelineProfileName[];
  riskLevel: ReadinessSeverity;
  metadata: Record<string, unknown>;
};

export type CICDReadinessCheck = {
  id: string;
  category: CICDReadinessCategory;
  name: string;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type CICDRisk = {
  id: string;
  category: CICDReadinessCategory | "remote_integration" | "deployment_safety" | "artifact_governance";
  title: string;
  severity: ReadinessSeverity;
  likelihood: ProductionRiskLikelihood;
  impact: string;
  mitigation: string;
  status: CICDRiskStatus;
  metadata: Record<string, unknown>;
};

export type CICDPipelineReadinessSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  productionReady: false;
  stagingDeployed: false;
  deploymentWorkflowCreated: false;
  activeWorkflowCreated: false;
  externalCallsEnabledByDefault: false;
  remoteIntegrationTestsEnabledByDefault: false;
  secretsExposed: false;
  envValuesExposed: false;
  packageManager: "pnpm";
  expectedNodeVersion: string;
  voltaNodeVersion: string;
  currentNodeVersion: string;
  nodeVersionStatus: "pass" | "warning" | "unknown";
  profileCount: number;
  jobCount: number;
  requiredJobCount: number;
  optionalJobCount: number;
  safetyJobCount: number;
  integrationGateCount: number;
  disabledByDefaultIntegrationGateCount: number;
  readinessCheckCount: number;
  criticalBlockerCount: number;
  riskCount: number;
  stagingPromotionReady: false;
  artifactPolicyStatus: "planned_redacted_only";
  cleanupRollbackStatus: "planned_manual_only";
  noSecretScanStatus: "planned_required";
  metadata: Record<string, unknown>;
};

export type GitHubAppIntegrationTestProfile = {
  id: string;
  name: string;
  status: GitHubAppIntegrationTestProfileStatus;
  requiredEnvVars: string[];
  requiredSecretRefs: string[];
  allowedRepos: string[];
  allowedBranchPrefix: string;
  allowedOperations: string[];
  forbiddenOperations: string[];
  cleanupPolicy: string;
  auditRequirements: string[];
  metadata: Record<string, unknown>;
};

export type GitHubAppIntegrationTestCase = {
  id: string;
  profileId: string;
  name: string;
  category: GitHubAppIntegrationTestCaseCategory;
  enabledByDefault: boolean;
  requiresLiveGitHub: boolean;
  requiredEnvVars: string[];
  expectedSideEffects: string[];
  cleanupRequired: boolean;
  status: GitHubAppIntegrationTestCaseStatus;
  metadata: Record<string, unknown>;
};

export type GitHubAppIntegrationTestSafetyCheck = {
  id: string;
  category: GitHubAppIntegrationTestSafetyCategory;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type GitHubAppIntegrationTestReadinessSummary = {
  generatedAt: Date;
  status: "v1_implemented";
  planningOnly: true;
  productionReady: false;
  liveTestsEnabled: boolean;
  canRunLiveTests: boolean;
  defaultLiveTestsSkipped: true;
  requiredGateCount: number;
  configuredGateCount: number;
  missingGateCount: number;
  unsafeGateCount: number;
  missingRequiredEnvVars: string[];
  unsafeGateWarnings: string[];
  allowedRepoCount: number;
  allowedBranchPrefix: "ai/";
  branchPrefixConfigured: boolean;
  branchPrefixMatchesRequired: boolean;
  requiredSecretRefCount: number;
  configuredSecretRefCount: number;
  testCaseCount: number;
  gatedLiveTestCaseCount: number;
  webhookFixtureTestsEnabled: true;
  liveWebhookTestsEnabled: boolean;
  cleanupPolicyStatus: "manual_close_or_mark_only";
  noAutoMerge: true;
  noForcePush: true;
  noBranchDelete: true;
  noSecretsExposed: true;
  envValuesExposed: false;
  privateKeyExposed: false;
  installationTokenExposed: false;
  githubCallsInDefaultTests: false;
  metadata: Record<string, unknown>;
};

export type LLMIntegrationTestProfile = {
  id: string;
  name: string;
  status: LLMIntegrationTestProfileStatus;
  providerKind: "openai_compatible";
  providerId?: string;
  requiredEnvVars: string[];
  requiredSecretRefs: string[];
  allowedModels: string[];
  requiredBudgetLimitUsd: number;
  requiredPolicies: string[];
  allowedOperations: string[];
  forbiddenOperations: string[];
  promptPolicy: string;
  outputPolicy: string;
  auditRequirements: string[];
  metadata: Record<string, unknown>;
};

export type LLMIntegrationTestCase = {
  id: string;
  profileId: string;
  name: string;
  category: LLMIntegrationTestCaseCategory;
  enabledByDefault: boolean;
  requiresRemoteLLM: boolean;
  requiredEnvVars: string[];
  expectedSideEffects: string[];
  cleanupRequired: boolean;
  status: LLMIntegrationTestCaseStatus;
  metadata: Record<string, unknown>;
};

export type LLMIntegrationTestSafetyCheck = {
  id: string;
  category: LLMIntegrationTestSafetyCategory;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type LLMIntegrationTestReadinessSummary = {
  generatedAt: Date;
  status: "v1_implemented";
  planningOnly: true;
  productionReady: false;
  liveTestsEnabled: boolean;
  canRunLiveTests: boolean;
  defaultLiveTestsSkipped: true;
  requiredGateCount: number;
  configuredGateCount: number;
  missingGateCount: number;
  unsafeGateCount: number;
  missingRequiredEnvVars: string[];
  unsafeGateWarnings: string[];
  providerKind: "openai_compatible";
  providerId: "openai_compatible";
  remoteLlmEnabled: boolean;
  remoteCompletionEnabled: boolean;
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  secretRefConfigured: boolean;
  rawEnvApiKeyConfigured: boolean;
  credentialSource: "secret_ref" | "test_env" | "none";
  envSecretProviderEnabled: boolean;
  allowedSecretEnvKeyConfigured: boolean;
  allowedModelCount: number;
  defaultModelConfigured: boolean;
  defaultModelAllowlisted: boolean;
  routingMode: string;
  routingModeAllowed: boolean;
  fallbackEnabled: boolean;
  maxFallbackAttempts: number;
  fallbackSafe: boolean;
  budgetConfigured: boolean;
  budgetLimitUsdConfigured: boolean;
  promptClassConfigured: boolean;
  requiredSecretRefCount: number;
  configuredSecretRefCount: number;
  testCaseCount: number;
  gatedLiveTestCaseCount: number;
  mockTestCaseCount: number;
  noStreaming: true;
  noToolCalls: true;
  noVendorCli: true;
  noCredentialCacheRead: true;
  noSecretsExposed: true;
  envValuesExposed: false;
  apiKeyExposed: false;
  rawProviderResponseExposed: false;
  remoteLlmCallsInDefaultTests: false;
  metadata: Record<string, unknown>;
};

export type VaultIntegrationTestProfile = {
  id: string;
  name: string;
  status: VaultIntegrationTestProfileStatus;
  backendKind: "vault";
  requiredEnvVars: string[];
  requiredSecretRefs: string[];
  requiredPathAllowlist: string[];
  allowedOperations: string[];
  forbiddenOperations: string[];
  testSecretPattern: string;
  auditRequirements: string[];
  metadata: Record<string, unknown>;
};

export type VaultIntegrationTestCase = {
  id: string;
  profileId: string;
  name: string;
  category: VaultIntegrationTestCaseCategory;
  enabledByDefault: boolean;
  requiresLiveVault: boolean;
  requiredEnvVars: string[];
  expectedSideEffects: string[];
  cleanupRequired: boolean;
  status: VaultIntegrationTestCaseStatus;
  metadata: Record<string, unknown>;
};

export type VaultIntegrationTestSafetyCheck = {
  id: string;
  category: VaultIntegrationTestSafetyCategory;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type VaultIntegrationTestReadinessSummary = {
  generatedAt: Date;
  id: string;
  status: "v1_implemented";
  planningOnly: true;
  productionReady: false;
  profileStatus: VaultIntegrationTestProfileStatus;
  backendKind: "vault";
  liveTestsEnabled: boolean;
  canRunLiveTests: boolean;
  defaultLiveTestsSkipped: true;
  requiredGateCount: number;
  configuredGateCount: number;
  missingGateCount: number;
  unsafeGateCount: number;
  missingRequiredEnvVars: string[];
  unsafeGateWarnings: string[];
  reason: string;
  vaultBackendSelected: boolean;
  vaultProviderEnabled: boolean;
  vaultAddressConfigured: boolean;
  vaultNamespaceConfigured: boolean;
  vaultAuthMethodConfigured: boolean;
  vaultAuthMethod: string;
  vaultTokenConfigured: boolean;
  vaultKvMountConfigured: boolean;
  pathAllowlistConfigured: boolean;
  pathAllowlistPrefixCount: number;
  testSecretPathConfigured: boolean;
  testSecretKeyConfigured: boolean;
  testSecretPathAllowlisted: boolean;
  testSecretPathLooksTestOnly: boolean;
  requiredSecretRefCount: number;
  configuredSecretRefCount: number;
  credentialSource: "vault_secretref" | "none";
  envFallbackUsed: false;
  testCaseCount: number;
  gatedLiveTestCaseCount: number;
  activeMockTestCaseCount: number;
  noWrite: true;
  noDelete: true;
  noRotate: true;
  noBroadList: true;
  noSecretsExposed: true;
  envValuesExposed: false;
  vaultTokenExposed: false;
  vaultAddressExposed: false;
  vaultSecretValueExposed: false;
  vaultCallsInDefaultTests: false;
  metadata: Record<string, unknown>;
};

export type MergeQueueIntegrationTestProfileStatus = "disabled" | "ready_if_configured" | "blocked" | "future";
export type MergeQueueIntegrationTestCaseCategory =
  | "config_validation"
  | "queue_readiness"
  | "dry_run_merge"
  | "branch_lease_check"
  | "conflict_risk_check"
  | "policy_decision_check"
  | "cleanup_check";
export type MergeQueueIntegrationTestCaseStatus = "planned" | "active_mock" | "gated_live" | "future";
export type MergeQueueIntegrationSafetyCategory =
  | "env_gates"
  | "repo_allowlist"
  | "branch_prefix"
  | "no_auto_merge"
  | "no_force_push"
  | "no_branch_delete"
  | "dry_run_only"
  | "cleanup"
  | "audit";

export type MergeQueueIntegrationTestProfile = {
  id: string;
  name: string;
  status: MergeQueueIntegrationTestProfileStatus;
  requiredEnvVars: string[];
  requiredRepoAllowlist: string[];
  requiredBranchPrefix: "aichestra/test/";
  allowedOperations: string[];
  forbiddenOperations: string[];
  cleanupPolicy: "manual_mark_only";
  metadata: Record<string, unknown>;
};

export type MergeQueueIntegrationTestCase = {
  id: string;
  profileId: string;
  name: string;
  category: MergeQueueIntegrationTestCaseCategory;
  enabledByDefault: boolean;
  requiresLiveGit: boolean;
  requiredEnvVars: string[];
  expectedSideEffects: string[];
  cleanupRequired: boolean;
  status: MergeQueueIntegrationTestCaseStatus;
  metadata: Record<string, unknown>;
};

export type MergeQueueIntegrationSafetyCheck = {
  id: string;
  category: MergeQueueIntegrationSafetyCategory;
  status: ReadinessCheckStatus;
  severity: ReadinessSeverity;
  description: string;
  remediation: string;
  evidence: string[];
  metadata: Record<string, unknown>;
};

export type MergeQueueIntegrationTestReadinessSummary = {
  generatedAt: Date;
  id: string;
  status: "v1_implemented";
  planningOnly: true;
  productionReady: false;
  profileStatus: MergeQueueIntegrationTestProfileStatus;
  liveTestsEnabled: boolean;
  canRunLiveTests: boolean;
  defaultLiveTestsSkipped: true;
  requiredGateCount: number;
  configuredGateCount: number;
  missingGateCount: number;
  unsafeGateCount: number;
  missingRequiredEnvVars: string[];
  unsafeGateWarnings: string[];
  reason: string;
  gitProviderConfigured: boolean;
  gitProviderAllowed: boolean;
  remoteGitEnabled: boolean;
  githubIntegrationProfileEnabled: boolean;
  allowedRepoCount: number;
  requiredBranchPrefix: "aichestra/test/";
  branchPrefixConfigured: boolean;
  branchPrefixMatchesRequired: boolean;
  testRepoConfigured: boolean;
  testRepoAllowlisted: boolean;
  testBaseBranchConfigured: boolean;
  testSourceBranchCount: number;
  testSourceBranchesMatchPrefix: boolean;
  baseBranchDistinctFromSources: boolean;
  dryRunOnly: boolean;
  autoMergeForbidden: true;
  remoteMergeForbidden: boolean;
  remoteRebaseForbidden: boolean;
  remoteForcePushForbidden: boolean;
  remoteBranchDeleteForbidden: boolean;
  cleanupPolicy: "manual_mark_only";
  branchDeletionAllowed: false;
  testCaseCount: number;
  gatedLiveTestCaseCount: number;
  activeMockTestCaseCount: number;
  noAutoMerge: true;
  noForcePush: true;
  noBranchDelete: true;
  noSecretsExposed: true;
  envValuesExposed: false;
  repoUrlsExposed: false;
  branchNamesExposed: false;
  remoteGitCallsInDefaultTests: false;
  realMergeExecuted: false;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentDryRunProfile = {
  id: string;
  name: string;
  status: StagingDeploymentDryRunProfileStatus;
  description: string;
  requiredReadinessSources: StagingDeploymentDryRunSourceKind[];
  optionalReadinessSources: StagingDeploymentDryRunSourceKind[];
  blockedCapabilities: string[];
  allowedCapabilities: string[];
  dryRunMode: StagingDeploymentDryRunMode;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentDryRunSource = {
  id: string;
  sourceKind: StagingDeploymentDryRunSourceKind;
  status: StagingDeploymentDryRunSourceStatus;
  severity: ReadinessSeverity;
  summary: string;
  evidence: string[];
  remediation: string;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentDryRunCheck = {
  id: string;
  category: StagingDeploymentDryRunCheckCategory;
  name: string;
  status: StagingDeploymentDryRunCheckStatus;
  severity: ReadinessSeverity;
  requiredForStaging: boolean;
  description: string;
  evidence: string[];
  remediation: string;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentDryRunBlocker = {
  id: string;
  category: StagingDeploymentDryRunCheckCategory | StagingDeploymentDryRunSourceKind;
  title: string;
  severity: ReadinessSeverity;
  blockingLevel: StagingDeploymentDryRunBlockingLevel;
  description: string;
  remediation: string;
  sourceIds: string[];
  status: StagingDeploymentDryRunBlockerStatus;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentDryRunIntegrationProfileStatus = {
  id: string;
  name: string;
  status: StagingDeploymentDryRunIntegrationStatus;
  requiredForStaging: boolean;
  skippedByDefault: boolean;
  summary: string;
  remediation: string;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentDryRunReport = {
  id: string;
  generatedAt: Date;
  overallStatus: StagingDeploymentDryRunOverallStatus;
  summary: string;
  profile: StagingDeploymentDryRunProfile;
  sourceSummaries: StagingDeploymentDryRunSource[];
  checks: StagingDeploymentDryRunCheck[];
  blockers: StagingDeploymentDryRunBlocker[];
  integrationProfiles: StagingDeploymentDryRunIntegrationProfileStatus[];
  promotionGuidance: string[];
  rollbackGuidance: string[];
  recommendedNextActions: string[];
  metadata: Record<string, unknown>;
};

export type StagingDeploymentDryRunSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  dryRunMode: StagingDeploymentDryRunMode;
  overallStatus: StagingDeploymentDryRunOverallStatus;
  profileStatus: StagingDeploymentDryRunProfileStatus;
  productionReady: false;
  stagingDeployed: false;
  deploymentExecuted: false;
  externalCallsEnabled: false;
  remoteIntegrationTestsExecuted: false;
  validationCommandsExecuted: false;
  sourceCount: number;
  requiredSourceCount: number;
  optionalSourceCount: number;
  sourcesByStatus: Record<StagingDeploymentDryRunSourceStatus, number>;
  checkCount: number;
  requiredCheckCount: number;
  checksByStatus: Record<StagingDeploymentDryRunCheckStatus, number>;
  blockerCount: number;
  criticalBlockerCount: number;
  warningCount: number;
  integrationProfileCount: number;
  integrationProfilesByStatus: Record<StagingDeploymentDryRunIntegrationStatus, number>;
  skippedIntegrationProfileCount: number;
  recommendedNextActionCount: number;
  noSecretsExposed: boolean;
  envValuesExposed: boolean;
  productionReadyClaimed: false;
  stagingDeploymentClaimed: false;
  metadata: Record<string, unknown>;
};

export type StagingReleaseCandidateChecklist = {
  id: string;
  name: string;
  status: StagingReleaseCandidateStatus;
  description: string;
  requiredValidationGates: string[];
  optionalIntegrationProfiles: string[];
  allowedSkippedTests: string[];
  blockerPolicy: string[];
  requiredSignoffs: StagingReleaseCandidateSignoffRole[];
  requiredReleaseNotes: StagingReleaseNoteSection[];
  rollbackChecklist: string[];
  knownLimitations: string[];
  metadata: Record<string, unknown>;
};

export type StagingReleaseCandidateGate = {
  id: string;
  category: StagingReleaseCandidateGateCategory;
  name: string;
  status: StagingReleaseCandidateGateStatus;
  required: boolean;
  severity: ReadinessSeverity;
  description: string;
  evidence: string[];
  remediation: string;
  metadata: Record<string, unknown>;
};

export type StagingReleaseCandidateBlocker = {
  id: string;
  category: StagingReleaseCandidateGateCategory | "release" | "deployment" | "production";
  title: string;
  severity: ReadinessSeverity;
  blockingLevel: StagingReleaseCandidateBlockingLevel;
  description: string;
  evidence: string[];
  remediation: string;
  source: string;
  status: StagingReleaseCandidateBlockerStatus;
  metadata: Record<string, unknown>;
};

export type StagingReleaseCandidateSignoff = {
  id: string;
  role: StagingReleaseCandidateSignoffRole;
  required: boolean;
  status: StagingReleaseCandidateSignoffStatus;
  reason?: string;
  metadata: Record<string, unknown>;
};

export type StagingReleaseNoteRequirement = {
  id: string;
  section: StagingReleaseNoteSection;
  required: boolean;
  status: StagingReleaseNoteRequirementStatus;
  guidance: string;
  metadata: Record<string, unknown>;
};

export type StagingRollbackChecklistItem = {
  id: string;
  category: StagingRollbackChecklistCategory;
  name: string;
  required: boolean;
  status: StagingRollbackChecklistStatus;
  description: string;
  metadata: Record<string, unknown>;
};

export type StagingReleaseCandidateReport = {
  id: string;
  generatedAt: Date;
  overallStatus: StagingReleaseCandidateOverallStatus;
  summary: string;
  checklist: StagingReleaseCandidateChecklist;
  gates: StagingReleaseCandidateGate[];
  blockers: StagingReleaseCandidateBlocker[];
  signoffs: StagingReleaseCandidateSignoff[];
  releaseNoteRequirements: StagingReleaseNoteRequirement[];
  rollbackChecklist: StagingRollbackChecklistItem[];
  skippedTests: string[];
  recommendedNextActions: string[];
  metadata: Record<string, unknown>;
};

export type StagingReleaseCandidateSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  overallStatus: StagingReleaseCandidateOverallStatus;
  checklistStatus: StagingReleaseCandidateStatus;
  productionReady: false;
  stagingDeployed: false;
  releaseCreated: false;
  gitTagCreated: false;
  githubReleaseCreated: false;
  deploymentExecuted: false;
  externalCallsEnabled: false;
  remoteIntegrationTestsExecuted: false;
  gateCount: number;
  requiredGateCount: number;
  gatesByStatus: Record<StagingReleaseCandidateGateStatus, number>;
  blockerCount: number;
  criticalBlockerCount: number;
  signoffCount: number;
  requiredSignoffCount: number;
  pendingSignoffCount: number;
  releaseNoteRequirementCount: number;
  missingReleaseNoteRequirementCount: number;
  rollbackItemCount: number;
  missingRollbackItemCount: number;
  skippedTestCount: number;
  recommendedNextActionCount: number;
  noSecretsExposed: boolean;
  envValuesExposed: boolean;
  productionReadyClaimed: boolean;
  stagingDeploymentClaimed: boolean;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentExecutionPlan = {
  id: string;
  name: string;
  status: StagingDeploymentExecutionPlanStatus;
  description: string;
  requiredSignoffs: StagingReleaseCandidateSignoffRole[];
  requiredPreDeployChecks: string[];
  optionalIntegrationChecks: string[];
  deploymentSteps: string[];
  postDeployChecks: string[];
  rollbackSteps: string[];
  goNoGoCriteria: string[];
  metadata: Record<string, unknown>;
};

export type StagingDeploymentStep = {
  id: string;
  order: number;
  phase: StagingDeploymentStepPhase;
  name: string;
  description: string;
  required: boolean;
  status: StagingDeploymentStepStatus;
  automationLevel: StagingDeploymentAutomationLevel;
  ownerRole: StagingReleaseCandidateSignoffRole | "operator" | "system";
  evidenceRequired: string[];
  metadata: Record<string, unknown>;
};

export type StagingDeploymentGate = {
  id: string;
  category: StagingDeploymentGateCategory;
  name: string;
  status: StagingDeploymentGateStatus;
  severity: ReadinessSeverity;
  required: boolean;
  description: string;
  evidence: string[];
  remediation: string;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentGoNoGoDecision = {
  id: string;
  status: StagingDeploymentGoNoGoStatus;
  reason: string;
  requiredApprovals: StagingReleaseCandidateSignoffRole[];
  pendingApprovals: StagingReleaseCandidateSignoffRole[];
  blockers: string[];
  acceptedRisks: string[];
  generatedAt: Date;
  metadata: Record<string, unknown>;
};

export type StagingDeploymentRollbackPlan = {
  id: string;
  status: StagingDeploymentRollbackPlanStatus;
  triggers: string[];
  rollbackSteps: StagingDeploymentStep[];
  manualVerification: string[];
  dataConsiderations: string[];
  auditRequirements: string[];
  ownerRoles: StagingReleaseCandidateSignoffRole[];
  metadata: Record<string, unknown>;
};

export type StagingDeploymentExecutionSummary = {
  generatedAt: Date;
  status: "v0_implemented";
  planningOnly: true;
  planStatus: StagingDeploymentExecutionPlanStatus;
  goNoGoStatus: StagingDeploymentGoNoGoStatus;
  productionReady: false;
  stagingDeployed: false;
  deploymentExecuted: false;
  releaseCreated: false;
  gitTagCreated: false;
  externalCallsEnabled: false;
  remoteIntegrationTestsExecuted: false;
  gateCount: number;
  requiredGateCount: number;
  gatesByStatus: Record<StagingDeploymentGateStatus, number>;
  blockerCount: number;
  criticalBlockerCount: number;
  warningCount: number;
  stepCount: number;
  readyStepCount: number;
  signoffPackAvailable: true;
  requiredSignoffCount: number;
  pendingSignoffCount: number;
  approvedSignoffCount: number;
  conditionalSignoffCount: number;
  rejectedSignoffCount: number;
  missingRequiredSignoffCount: number;
  signoffStatus: StagingHumanSignoffStatus;
  actualDeploymentBlocked: true;
  optionalIntegrationDecisionCount: number;
  rollbackStepCount: number;
  noSecretsExposed: boolean;
  envValuesExposed: boolean;
  productionReadyClaimed: boolean;
  stagingDeployedClaimed: boolean;
  metadata: Record<string, unknown>;
};
