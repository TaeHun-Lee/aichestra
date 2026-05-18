import type {
  AuthProviderOption,
  AuthRbacMigrationPhase,
  AuthRbacPermissionMatrixEntry,
  AuthRbacProductionRisk,
  AuthRbacReadinessCheck,
  CICDIntegrationTestGate,
  CICDJobDefinition,
  CICDPipelineProfile,
  CICDReadinessCheck,
  CICDRisk,
  DatabaseAuditGrowthPlan,
  DatabaseDeploymentProfile,
  DatabaseIndexReviewItem,
  DatabaseOperationRisk,
  DatabaseReadinessCheck,
  DatabaseRetentionPlan,
  DatabaseSchemaInventoryItem,
  DatabaseWebhookPersistencePlan,
  DeploymentProfile,
  GitHubAppCredentialReadiness,
  GitHubAppDescriptor,
  GitHubAppIntegrationTestCase,
  GitHubAppIntegrationTestProfile,
  GitHubAppIntegrationTestSafetyCheck,
  LLMIntegrationTestCase,
  LLMIntegrationTestProfile,
  LLMIntegrationTestSafetyCheck,
  VaultIntegrationTestCase,
  VaultIntegrationTestProfile,
  VaultIntegrationTestSafetyCheck,
  MergeQueueIntegrationTestCase,
  MergeQueueIntegrationTestProfile,
  MergeQueueIntegrationSafetyCheck,
  GitHubAppInstallation,
  GitHubAppPermissionMatrixEntry,
  GitHubAppProductionRisk,
  GitHubAppReadinessCheck,
  GitHubAppRepositoryGrant,
  GitHubProductionWebhookEndpointPlan,
  GitHubWebhookDeadLetterPlan,
  GitHubWebhookDeadLetterRecord,
  GitHubWebhookDeliveryRecord,
  GitHubWebhookEventAllowlistEntry,
  GitHubWebhookReplayProtectionPlan,
  PolicyBundleMigrationPhase,
  PolicyBundlePlan,
  PolicyBundleReadinessCheck,
  PolicyBundleRisk,
  PolicyDomainMapping,
  PolicyEngineOption,
  PolicyRuntimePocDomainMapping,
  PolicyRuntimePocGoldenCase,
  PolicyRuntimePocInputContract,
  PolicyRuntimePocOption,
  PolicyRuntimePocReadinessCheck,
  PolicyRuntimePocRisk,
  PolicyShadowComparisonRule,
  PolicyShadowEvaluationPlan,
  PolicyShadowEvaluationReport,
  PolicyShadowMismatch,
  PolicyShadowReadinessCheck,
  ProductionAuthProviderConfig,
  ProductionAuthProviderReadiness,
  IdentityMappingPlan,
  ProductionRisk,
  ReadinessCheck,
  SecretBackendDecisionCriterion,
  SecretBackendDecisionRisk,
  SecretBackendDecisionScore,
  SecretBackendImplementationScope,
  SecretBackendMigrationPhase,
  SecretBackendOption,
  SecretBackendOptionDecision,
  SecretBackendProviderMapping,
  SecretBackendReadinessCheck,
  SecretBackendRisk,
  ServiceAccountPlan,
  TenantBoundaryPlan,
  StagingDeploymentProfile,
  StagingDeploymentDryRunProfile,
  StagingDeploymentExecutionPlan,
  StagingReleaseCandidateChecklist,
  StagingIntegrationGate,
  StagingPromotionCriterion,
  StagingReadinessCheck,
  StagingRollbackCriterion,
  SecretLeasePolicy,
  SecretRotationPlan,
  SessionTokenBoundaryPlan
} from "./types.ts";

export const defaultDeploymentProfiles: DeploymentProfile[] = [
  {
    id: "local",
    name: "local",
    description: "Default developer profile: in-memory state, mock providers, demo/API dashboard, no external calls.",
    requiredComponents: ["api", "web", "worker"],
    requiredEnvVars: [],
    disabledFeatures: [
      "remote_git_by_default",
      "remote_llm_by_default",
      "real_mcp_transport",
      "production_auth",
      "real_secret_backend",
      "vendor_cli_execution",
      "production_deployment"
    ],
    allowedProviderKinds: ["mock", "local_fixture"],
    storageMode: "in_memory",
    authMode: "mock",
    secretMode: "metadata_only_env_optional",
    policyMode: "static_typescript",
    observabilityMode: "local_logs_only",
    readinessChecks: ["local_mock_first_pass", "local_in_memory_warning", "local_no_external_calls_pass"],
    metadata: { productionTrafficAllowed: false, mockFirst: true }
  },
  {
    id: "integration",
    name: "integration",
    description: "Optional integration profile for gated GitHub/OpenAI-compatible/Postgres tests without production traffic.",
    requiredComponents: ["api", "web", "worker", "migration-job"],
    requiredEnvVars: [],
    disabledFeatures: [
      "production_auth",
      "real_secret_backend",
      "auto_merge",
      "real_mcp_transport",
      "vendor_cli_execution",
      "production_deployment"
    ],
    allowedProviderKinds: ["mock", "github_gated", "openai_compatible_gated", "local_fixture"],
    storageMode: "postgres_optional",
    authMode: "mock",
    secretMode: "secretref_env",
    policyMode: "static_typescript",
    observabilityMode: "local_logs_only",
    readinessChecks: ["integration_gates_pass", "integration_mock_auth_warning", "integration_postgres_optional_warning"],
    metadata: { productionTrafficAllowed: false, integrationTestsGated: true }
  },
  {
    id: "staging",
    name: "staging",
    description: "Pre-production rehearsal target. Current repository only defines required blockers; it does not implement staging deployment.",
    requiredComponents: ["api", "web", "worker", "migration-job", "background-job"],
    requiredEnvVars: ["AICHESTRA_STORAGE_PROVIDER", "AICHESTRA_DATABASE_URL"],
    disabledFeatures: ["auto_merge", "vendor_cli_execution", "real_mcp_transport_until_allowlisted"],
    allowedProviderKinds: ["mock", "github_gated", "openai_compatible_gated"],
    storageMode: "postgres_required",
    authMode: "future_oidc_saml",
    secretMode: "real_secret_backend_required",
    policyMode: "managed_bundle_required",
    observabilityMode: "required_external_stack",
    readinessChecks: [
      "staging_postgres_required",
      "staging_migration_runner_required",
      "staging_real_auth_required",
      "staging_secret_backend_required",
      "staging_audit_retention_required"
    ],
    metadata: { productionTrafficAllowed: false, rehearsalOnly: true }
  },
  {
    id: "production",
    name: "production",
    description: "Target production profile. This is a planning model only and is blocked until required controls are implemented.",
    requiredComponents: ["api", "web", "worker", "migration-job", "background-job", "local-agent"],
    requiredEnvVars: ["AICHESTRA_STORAGE_PROVIDER", "AICHESTRA_DATABASE_URL"],
    disabledFeatures: ["mock_actor", "legacy_env_credentials", "auto_merge", "unsafe_default_providers", "vendor_cli_credential_cache_read"],
    allowedProviderKinds: ["github_app_future", "openai_compatible_gated", "mcp_allowlisted_future", "local_agent_governed_future"],
    storageMode: "postgres_required",
    authMode: "production_required",
    secretMode: "real_secret_backend_required",
    policyMode: "managed_bundle_required",
    observabilityMode: "required_external_stack",
    readinessChecks: [
      "production_postgres_required",
      "production_auth_required",
      "production_secret_backend_required",
      "production_policy_bundle_required",
      "production_observability_required",
      "production_audit_retention_required",
      "production_backup_restore_required",
      "production_tenant_isolation_required",
      "production_mock_actor_disabled_required",
      "production_no_env_fallback_required",
      "production_no_unsafe_default_providers_required"
    ],
    metadata: { productionTrafficAllowed: false, productionReady: false }
  }
];

export const defaultReadinessChecks: ReadinessCheck[] = [
  {
    id: "local_mock_first_pass",
    profileId: "local",
    category: "runtime",
    name: "Mock-first local runtime",
    status: "pass",
    severity: "low",
    description: "Local profile defaults to mock providers and in-memory state.",
    remediation: "Keep local defaults mock-first.",
    evidence: ["README.md", "AGENTS.md", "docs/audits/2026-05-11-phase-progress-audit.md"],
    metadata: { externalCalls: false }
  },
  {
    id: "local_in_memory_warning",
    profileId: "local",
    category: "database",
    name: "In-memory state is not production persistence",
    status: "warning",
    severity: "medium",
    description: "The default store is intentionally in-memory.",
    remediation: "Use Postgres with migrations and backups before staging or production.",
    evidence: ["docs/features/persistent-db/v1.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "local_no_external_calls_pass",
    profileId: "local",
    category: "integration",
    name: "Default runtime avoids external calls",
    status: "pass",
    severity: "low",
    description: "Default tests and runtime do not call real providers.",
    remediation: "Keep integration tests behind explicit gates.",
    evidence: ["docs/audits/2026-05-11-phase-progress-audit.md"],
    metadata: { mockFirst: true }
  },
  {
    id: "integration_gates_pass",
    profileId: "integration",
    category: "integration",
    name: "Real provider paths remain gated",
    status: "pass",
    severity: "medium",
    description: "GitHub and OpenAI-compatible paths require explicit env gates and allowlists.",
    remediation: "Continue requiring operation-specific gates and integration-test env flags.",
    evidence: ["docs/features/real-git-adapter/v2.md", "docs/features/llm-gateway/v2.md"],
    metadata: { productionTrafficAllowed: false }
  },
  {
    id: "integration_mock_auth_warning",
    profileId: "integration",
    category: "identity",
    name: "Integration profile still uses mock auth",
    status: "warning",
    severity: "high",
    description: "Integration testing can use mock actors, but this cannot be promoted to production.",
    remediation: "Implement production IdP and request auth middleware before staging/production.",
    evidence: ["docs/foundations/auth-rbac/v0.md"],
    metadata: { mockActorAllowed: true }
  },
  {
    id: "integration_postgres_optional_warning",
    profileId: "integration",
    category: "database",
    name: "Postgres is optional in integration",
    status: "warning",
    severity: "medium",
    description: "Postgres contract tests are optional unless AICHESTRA_TEST_DATABASE_URL is set.",
    remediation: "Make Postgres mandatory in staging.",
    evidence: ["docs/features/persistent-db/v1.md"],
    metadata: { postgresRequired: false }
  },
  {
    id: "staging_postgres_required",
    profileId: "staging",
    category: "database",
    name: "Staging requires Postgres",
    status: "fail",
    severity: "high",
    description: "Staging must not run on in-memory repositories.",
    remediation: "Require AICHESTRA_STORAGE_PROVIDER=postgres, AICHESTRA_DATABASE_URL, migration job, and repository contract validation.",
    evidence: ["docs/features/persistent-db/v1.md"],
    metadata: { requiredBeforeStaging: true }
  },
  {
    id: "staging_migration_runner_required",
    profileId: "staging",
    category: "database",
    name: "Migration runner is not operationalized",
    status: "fail",
    severity: "high",
    description: "Migrations are explicit scripts but not wrapped in a release process.",
    remediation: "Define migration job ordering, rollback, backup, and restore rehearsal.",
    evidence: ["scripts/db/migrate.mjs"],
    metadata: { deploymentImplementation: false }
  },
  {
    id: "staging_real_auth_required",
    profileId: "staging",
    category: "identity",
    name: "Production auth provider is missing",
    status: "fail",
    severity: "critical",
    description: "Only MockAuthProvider and disabled future provider placeholders exist.",
    remediation: "Implement OIDC/SAML request authentication, SCIM/team sync planning, and tenant-aware authorization.",
    evidence: ["docs/foundations/auth-rbac/v0.md"],
    metadata: { productionAuthEnabled: false }
  },
  {
    id: "staging_secret_backend_required",
    profileId: "staging",
    category: "secrets",
    name: "Real secret backend is missing",
    status: "fail",
    severity: "critical",
    description: "SecretRef-backed credentials currently use an explicit env provider only.",
    remediation: "Add a real secret backend behind SecretManager before staging.",
    evidence: ["docs/foundations/secretref-provider-credentials/v1.md", "docs/features/secrets-sandbox/v0.md"],
    metadata: { envProviderOnly: true }
  },
  {
    id: "staging_audit_retention_required",
    profileId: "staging",
    category: "audit",
    name: "Audit retention is not configured",
    status: "fail",
    severity: "high",
    description: "Audit repositories are mostly in-memory and no retention/export process exists.",
    remediation: "Define durable audit stores, retention classes, export jobs, and redaction checks.",
    evidence: ["docs/foundations/repository-inventory.md"],
    metadata: { auditExportConfigured: false }
  },
  {
    id: "production_postgres_required",
    profileId: "production",
    category: "database",
    name: "Production Postgres and migrations required",
    status: "fail",
    severity: "critical",
    description: "Production requires durable storage, migration governance, indexes, backups, and restore testing.",
    remediation: "Promote Postgres from opt-in to required for production profile and add operational migration controls.",
    evidence: ["docs/features/persistent-db/v1.md", "docs/foundations/persistent-storage-schema-v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "production_auth_required",
    profileId: "production",
    category: "identity",
    name: "Production Auth/RBAC required",
    status: "fail",
    severity: "critical",
    description: "Mock auth is not production authentication.",
    remediation: "Implement production OIDC/SAML and service-account authentication with tenant/team scoping.",
    evidence: ["docs/foundations/auth-rbac/v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "production_secret_backend_required",
    profileId: "production",
    category: "secrets",
    name: "Production secret backend required",
    status: "fail",
    severity: "critical",
    description: "Env SecretRef provider is not sufficient for production secret management.",
    remediation: "Implement Vault or cloud secret manager integration behind existing SecretManager boundaries.",
    evidence: ["docs/features/secrets-sandbox/v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "production_policy_bundle_required",
    profileId: "production",
    category: "policy",
    name: "Managed policy bundles required",
    status: "fail",
    severity: "high",
    description: "Policy rules are static TypeScript defaults and cannot yet be reviewed, signed, versioned, or rolled back as bundles.",
    remediation: "Add a reviewed policy bundle workflow before production.",
    evidence: ["docs/features/policy-as-code/v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "production_observability_required",
    profileId: "production",
    category: "observability",
    name: "Observability stack required",
    status: "fail",
    severity: "high",
    description: "No production logging, metrics, tracing, alerting, or SLO backend is wired.",
    remediation: "Implement structured logs, metrics, traces, dashboards, and alerts.",
    evidence: ["docs/features/dashboard/v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "production_audit_retention_required",
    profileId: "production",
    category: "audit",
    name: "Audit retention and export required",
    status: "fail",
    severity: "high",
    description: "Compliance-grade audit retention and export are not implemented.",
    remediation: "Persist audit events, define retention classes, and add export controls.",
    evidence: ["docs/foundations/repository-inventory.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "production_backup_restore_required",
    profileId: "production",
    category: "database",
    name: "Backup and restore required",
    status: "fail",
    severity: "high",
    description: "No backup, restore test, or recovery objective process exists.",
    remediation: "Define backup schedule, restore drills, RPO/RTO, and migration rollback playbooks.",
    evidence: ["docs/features/persistent-db/v1.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "production_tenant_isolation_required",
    profileId: "production",
    category: "tenancy",
    name: "Tenant isolation required",
    status: "fail",
    severity: "critical",
    description: "Current read models and repositories are not production tenant scoped.",
    remediation: "Add tenant/org ids to request context, repository filters, audit, dashboard, and policy subjects.",
    evidence: ["docs/features/dashboard/v0.md", "docs/foundations/auth-rbac/v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "production_mock_actor_disabled_required",
    profileId: "production",
    category: "identity",
    name: "Mock actor must be disabled",
    status: "fail",
    severity: "critical",
    description: "Header-selected mock actors and MockAuthProvider are local/test-only.",
    remediation: "Reject mock actor modes in production profile after real auth exists.",
    evidence: ["docs/foundations/auth-rbac/v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "production_no_env_fallback_required",
    profileId: "production",
    category: "secrets",
    name: "Legacy env credential fallback must be disabled",
    status: "fail",
    severity: "high",
    description: "Legacy env fallback remains for compatibility when no SecretRef is configured.",
    remediation: "Add production profile validation that requires SecretRef plus real secret backend and blocks legacy env credentials.",
    evidence: ["docs/foundations/secretref-provider-credentials/v1.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "production_no_unsafe_default_providers_required",
    profileId: "production",
    category: "integration",
    name: "Unsafe default providers must be blocked",
    status: "fail",
    severity: "high",
    description: "Mock/default provider modes are local-safe but not production deployment controls.",
    remediation: "Add production profile boot validation for provider allowlists, MCP server allowlists, and disabled vendor CLI defaults.",
    evidence: ["docs/features/mcp-gateway/v0.md", "docs/features/llm-gateway/v2.md", "docs/features/real-git-adapter/v2.md"],
    metadata: { productionBlocker: true }
  }
];

export const defaultProductionRisks: ProductionRisk[] = [
  {
    id: "risk_mock_auth_in_production",
    category: "identity",
    title: "Mock auth accidentally promoted",
    severity: "critical",
    likelihood: "medium",
    impact: "Request attribution, RBAC, and audit evidence would not be trustworthy.",
    mitigation: "Implement production IdP integration and production profile boot-time rejection of mock auth.",
    owner: "platform-security",
    status: "open",
    metadata: { blocksProduction: true }
  },
  {
    id: "risk_env_secret_provider",
    category: "secrets",
    title: "Env SecretRef provider is insufficient for production",
    severity: "critical",
    likelihood: "high",
    impact: "Secret rotation, audit, leasing, and central revocation cannot be enforced.",
    mitigation: "Move SecretRef providers to Vault or a cloud secret manager before production.",
    owner: "platform-security",
    status: "open",
    metadata: { blocksProduction: true }
  },
  {
    id: "risk_in_memory_repositories",
    category: "database",
    title: "In-memory repositories lose operational state",
    severity: "high",
    likelihood: "high",
    impact: "Task, audit, policy, Local Agent, MCP, and governance records may be lost across restarts.",
    mitigation: "Finish durable repositories for every production-required store and mandate Postgres in staging/production.",
    owner: "platform",
    status: "open",
    metadata: { blocksProduction: true }
  },
  {
    id: "risk_static_policy_rules",
    category: "policy",
    title: "Static policy rules lack production change control",
    severity: "high",
    likelihood: "medium",
    impact: "Policy changes cannot be independently reviewed, signed, promoted, or rolled back.",
    mitigation: "Adopt signed policy bundles with tests and rollout/rollback controls.",
    owner: "platform-security",
    status: "open",
    metadata: { blocksProduction: true }
  },
  {
    id: "risk_no_observability_stack",
    category: "observability",
    title: "No production observability backend",
    severity: "high",
    likelihood: "high",
    impact: "Provider failures, policy denials, queue stalls, and credential issues may be invisible.",
    mitigation: "Add structured logs, metrics, traces, SLOs, dashboards, and alerts.",
    owner: "platform-ops",
    status: "open",
    metadata: { blocksProduction: true }
  },
  {
    id: "risk_webhook_replay_hardening",
    category: "git",
    title: "Webhook replay and GitHub App hardening are incomplete",
    severity: "high",
    likelihood: "medium",
    impact: "Webhook processing could be harder to operate safely under production traffic.",
    mitigation: "Plan GitHub App auth, delivery replay protection, idempotency, and rate-limit handling.",
    owner: "integrations",
    status: "deferred",
    metadata: { recommendedNextTask: true }
  }
];

const plannedAt = new Date("2026-05-13T00:00:00.000Z");

export const defaultGitHubAppDescriptors: GitHubAppDescriptor[] = [
  {
    id: "github_app_descriptor_planned",
    appSlug: "aichestra-production-planned",
    appId: undefined,
    name: "Aichestra Production GitHub App (planned)",
    status: "planned",
    webhookUrl: "https://aichestra.example.invalid/git/github/webhooks",
    permissions: {
      metadata: "read",
      contents: "write",
      pull_requests: "write",
      checks: "read",
      statuses: "read",
      issues: "none",
      workflows: "none",
      administration: "none",
      secrets: "none",
      deployments: "none"
    },
    events: ["ping", "pull_request", "push", "check_run", "check_suite", "status", "pull_request_review"],
    createdAt: plannedAt,
    updatedAt: plannedAt,
    metadata: {
      planningOnly: true,
      privateKeyStored: false,
      installationTokenExchangeImplemented: false,
      productionWebhookEnabled: false
    }
  }
];

export const defaultGitHubAppInstallations: GitHubAppInstallation[] = [
  {
    id: "github_app_installation_planned_aichestra",
    appDescriptorId: "github_app_descriptor_planned",
    installationId: undefined,
    accountLogin: "aichestra",
    accountType: "organization",
    repositorySelection: "selected",
    status: "planned",
    createdAt: plannedAt,
    updatedAt: plannedAt,
    metadata: {
      planningOnly: true,
      liveInstallation: false,
      installationTokenIssued: false
    }
  }
];

export const defaultGitHubAppRepositoryGrants: GitHubAppRepositoryGrant[] = [
  {
    id: "github_app_repo_grant_demo_backend",
    installationId: "github_app_installation_planned_aichestra",
    repoOwner: "aichestra",
    repoName: "demo-backend",
    repoId: undefined,
    permissions: {
      metadata: "read",
      contents: "write",
      pull_requests: "write",
      checks: "read",
      statuses: "read",
      workflows: "none",
      administration: "none",
      secrets: "none",
      deployments: "none"
    },
    status: "allowed",
    createdAt: plannedAt,
    updatedAt: plannedAt,
    metadata: {
      planningOnly: true,
      selectedRepositoryOnly: true,
      mergePermission: false
    }
  }
];

export const defaultGitHubAppPermissionMatrix: GitHubAppPermissionMatrixEntry[] = [
  {
    id: "permission_metadata_read",
    githubPermissionName: "metadata",
    requiredLevel: "read",
    requiredFor: "repository identity, installation repository grants, safe PR/branch read model correlation",
    riskLevel: "low",
    productionDefault: "allow",
    approvalRequirement: "platform approval with repo allowlist",
    auditRequirement: "record repository grant and installation metadata changes",
    currentlyImplemented: false,
    futureOnly: true,
    metadata: { leastPrivilege: true }
  },
  {
    id: "permission_contents_read",
    githubPermissionName: "contents",
    requiredLevel: "read",
    requiredFor: "future base branch SHA lookup and changed-file/read metadata",
    riskLevel: "medium",
    productionDefault: "future_review",
    approvalRequirement: "security review before live GitHub App activation",
    auditRequirement: "audit content metadata reads without file contents unless explicitly required",
    currentlyImplemented: false,
    futureOnly: true,
    metadata: { liveGitHubAppRequired: true }
  },
  {
    id: "permission_contents_write",
    githubPermissionName: "contents",
    requiredLevel: "write",
    requiredFor: "future GitHub App branch creation only",
    riskLevel: "high",
    productionDefault: "future_review",
    approvalRequirement: "explicit branch-create gate, repo grant, branch prefix, Auth/RBAC, and Policy approval",
    auditRequirement: "audit branch create request, policy decisions, installation id, repo grant, and branch prefix",
    currentlyImplemented: false,
    futureOnly: true,
    metadata: { doesNotPermitMerge: true, branchDeletionAllowed: false, forcePushAllowed: false }
  },
  {
    id: "permission_pull_requests_read",
    githubPermissionName: "pull_requests",
    requiredLevel: "read",
    requiredFor: "PR sync read models and changed-file refresh planning",
    riskLevel: "medium",
    productionDefault: "allow",
    approvalRequirement: "repo grant and PR read policy",
    auditRequirement: "audit PR read/sync metadata and rate-limit warnings",
    currentlyImplemented: false,
    futureOnly: true,
    metadata: { readModelOnly: true }
  },
  {
    id: "permission_pull_requests_write",
    githubPermissionName: "pull_requests",
    requiredLevel: "write",
    requiredFor: "future GitHub App pull request creation",
    riskLevel: "high",
    productionDefault: "future_review",
    approvalRequirement: "explicit PR-create gate, repo grant, branch prefix, Auth/RBAC, and Policy approval",
    auditRequirement: "audit PR create request, policy decisions, installation id, repo grant, and PR id",
    currentlyImplemented: false,
    futureOnly: true,
    metadata: { doesNotPermitMerge: true, reviewerAutomationAllowed: false }
  },
  {
    id: "permission_checks_read",
    githubPermissionName: "checks",
    requiredLevel: "read",
    requiredFor: "future CI/check read-model updates",
    riskLevel: "medium",
    productionDefault: "allow",
    approvalRequirement: "read-only app permission review",
    auditRequirement: "audit check_run/check_suite ingestion outcomes",
    currentlyImplemented: false,
    futureOnly: true,
    metadata: { readModelOnly: true }
  },
  {
    id: "permission_statuses_read",
    githubPermissionName: "statuses",
    requiredLevel: "read",
    requiredFor: "future commit status read-model updates",
    riskLevel: "medium",
    productionDefault: "allow",
    approvalRequirement: "read-only app permission review",
    auditRequirement: "audit status ingestion outcomes",
    currentlyImplemented: false,
    futureOnly: true,
    metadata: { readModelOnly: true }
  },
  {
    id: "permission_issues_read",
    githubPermissionName: "issues",
    requiredLevel: "read",
    requiredFor: "future issue-linking only if product scope requires it",
    riskLevel: "medium",
    productionDefault: "future_review",
    approvalRequirement: "separate product/security approval",
    auditRequirement: "audit issue metadata reads if enabled",
    currentlyImplemented: false,
    futureOnly: true,
    metadata: { notRequiredForMvp: true }
  },
  {
    id: "permission_workflows_none",
    githubPermissionName: "workflows",
    requiredLevel: "none",
    requiredFor: "not required",
    riskLevel: "critical",
    productionDefault: "deny",
    approvalRequirement: "explicit future milestone only",
    auditRequirement: "audit denied workflow permission requests",
    currentlyImplemented: false,
    futureOnly: false,
    metadata: { deniedByDefault: true }
  },
  {
    id: "permission_administration_none",
    githubPermissionName: "administration",
    requiredLevel: "none",
    requiredFor: "not required",
    riskLevel: "critical",
    productionDefault: "deny",
    approvalRequirement: "not allowed by this roadmap",
    auditRequirement: "audit denied admin permission requests",
    currentlyImplemented: false,
    futureOnly: false,
    metadata: { deniedByDefault: true }
  },
  {
    id: "permission_secrets_none",
    githubPermissionName: "secrets",
    requiredLevel: "none",
    requiredFor: "not required",
    riskLevel: "critical",
    productionDefault: "deny",
    approvalRequirement: "not allowed by this roadmap",
    auditRequirement: "audit denied secrets permission requests",
    currentlyImplemented: false,
    futureOnly: false,
    metadata: { deniedByDefault: true }
  },
  {
    id: "permission_deployments_none",
    githubPermissionName: "deployments",
    requiredLevel: "none",
    requiredFor: "not required by default",
    riskLevel: "high",
    productionDefault: "deny",
    approvalRequirement: "separate deployment milestone only",
    auditRequirement: "audit denied deployment permission requests",
    currentlyImplemented: false,
    futureOnly: false,
    metadata: { deniedByDefault: true }
  }
];

export const defaultGitHubWebhookEventAllowlist: GitHubWebhookEventAllowlistEntry[] = [
  {
    id: "webhook_event_ping",
    eventName: "ping",
    supportStatus: "supported_now",
    actionsHandled: ["*"],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["record_webhook_event", "record_audit"],
    auditEvents: ["github_webhook_received", "github_webhook_processed"],
    readModelUpdates: ["webhook delivery metadata"],
    riskNotes: ["safe connectivity event; no repository mutation"],
    metadata: { destructiveActionsAllowed: false }
  },
  {
    id: "webhook_event_pull_request",
    eventName: "pull_request",
    supportStatus: "supported_now",
    actionsHandled: ["opened", "synchronize", "reopened", "closed"],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["upsert_pr_sync_state", "upsert_branch_sync_state", "record_audit"],
    auditEvents: ["github_pr_sync_started", "github_pr_sync_completed", "github_pr_sync_failed"],
    readModelUpdates: ["PR sync state", "branch sync state", "merge queue risk read model when mapped"],
    riskNotes: ["read-model only; no merge, rebase, reviewer request, workflow dispatch, or branch cleanup"],
    metadata: { destructiveActionsAllowed: false }
  },
  {
    id: "webhook_event_push",
    eventName: "push",
    supportStatus: "supported_now",
    actionsHandled: ["refs/heads/* metadata"],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["upsert_branch_sync_state", "record_audit"],
    auditEvents: ["github_branch_sync_started", "github_branch_sync_completed", "github_branch_sync_failed"],
    readModelUpdates: ["branch sync state"],
    riskNotes: ["records deleted remote ref as metadata only; does not delete Aichestra or GitHub branches"],
    metadata: { destructiveActionsAllowed: false }
  },
  {
    id: "webhook_event_check_run",
    eventName: "check_run",
    supportStatus: "supported_now",
    actionsHandled: ["read_model_metadata_only"],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["record_webhook_event", "record_audit"],
    auditEvents: ["github_webhook_processed"],
    readModelUpdates: ["future check run status read model"],
    riskNotes: ["recognized read-only event; no workflow action"],
    metadata: { destructiveActionsAllowed: false }
  },
  {
    id: "webhook_event_check_suite",
    eventName: "check_suite",
    supportStatus: "supported_now",
    actionsHandled: ["read_model_metadata_only"],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["record_webhook_event", "record_audit"],
    auditEvents: ["github_webhook_processed"],
    readModelUpdates: ["future check suite status read model"],
    riskNotes: ["recognized read-only event; no workflow action"],
    metadata: { destructiveActionsAllowed: false }
  },
  {
    id: "webhook_event_status",
    eventName: "status",
    supportStatus: "supported_now",
    actionsHandled: ["read_model_metadata_only"],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["record_webhook_event", "record_audit"],
    auditEvents: ["github_webhook_processed"],
    readModelUpdates: ["future commit status read model"],
    riskNotes: ["recognized read-only event"],
    metadata: { destructiveActionsAllowed: false }
  },
  {
    id: "webhook_event_pull_request_review",
    eventName: "pull_request_review",
    supportStatus: "supported_now",
    actionsHandled: ["read_model_metadata_only"],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["record_webhook_event", "record_audit"],
    auditEvents: ["github_webhook_processed"],
    readModelUpdates: ["future review status read model"],
    riskNotes: ["recognized read-only event; no reviewer automation"],
    metadata: { destructiveActionsAllowed: false }
  },
  {
    id: "webhook_event_installation",
    eventName: "installation",
    supportStatus: "planned",
    actionsHandled: ["created", "deleted", "suspend", "unsuspend"],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["future_upsert_installation_read_model"],
    auditEvents: ["github_app_installation_created_future", "github_app_installation_suspended"],
    readModelUpdates: ["GitHub App installation read model"],
    riskNotes: ["future only; must not issue tokens from webhook processing"],
    metadata: { futureOnly: true }
  },
  {
    id: "webhook_event_installation_repositories",
    eventName: "installation_repositories",
    supportStatus: "planned",
    actionsHandled: ["added", "removed"],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["future_update_repo_grant_read_model"],
    auditEvents: ["github_app_repo_grant_changed"],
    readModelUpdates: ["repository grant read model"],
    riskNotes: ["future only; grants still require Aichestra repo allowlist and policy"],
    metadata: { futureOnly: true }
  },
  {
    id: "webhook_event_repository",
    eventName: "repository",
    supportStatus: "planned",
    actionsHandled: ["created", "deleted", "archived", "renamed", "transferred"],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["future_update_repo_metadata_read_model"],
    auditEvents: ["github_webhook_processed"],
    readModelUpdates: ["repository metadata read model"],
    riskNotes: ["future only; must not delete Aichestra records automatically"],
    metadata: { futureOnly: true }
  },
  {
    id: "webhook_event_workflow_run",
    eventName: "workflow_run",
    supportStatus: "ignored",
    actionsHandled: [],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["record_unsupported_event_audit"],
    auditEvents: ["github_webhook_unsupported_event"],
    readModelUpdates: [],
    riskNotes: ["ignored until explicitly needed; no workflow automation"],
    metadata: { ignoredByDefault: true }
  },
  {
    id: "webhook_event_deployment",
    eventName: "deployment",
    supportStatus: "denied",
    actionsHandled: [],
    signatureVerificationRequired: true,
    idempotencyKey: "deliveryId",
    sideEffects: ["record_denied_event_audit"],
    auditEvents: ["github_webhook_unsupported_event"],
    readModelUpdates: [],
    riskNotes: ["deployment operations are out of scope"],
    metadata: { deniedByDefault: true }
  }
];

export const defaultGitHubWebhookDeliveryRecords: GitHubWebhookDeliveryRecord[] = [
  {
    id: "github_delivery_first_seen",
    deliveryId: "delivery-demo-first",
    eventType: "pull_request",
    repoRef: "aichestra/demo-backend",
    action: "opened",
    receivedAt: plannedAt,
    signatureVerified: true,
    replayStatus: "first_seen",
    processingStatus: "processed",
    payloadHash: "sha256:demo-first",
    attemptCount: 1,
    lastAttemptAt: plannedAt,
    metadata: { planningOnly: true }
  },
  {
    id: "github_delivery_duplicate",
    deliveryId: "delivery-demo-first",
    eventType: "pull_request",
    repoRef: "aichestra/demo-backend",
    action: "opened",
    receivedAt: plannedAt,
    signatureVerified: true,
    replayStatus: "duplicate",
    processingStatus: "ignored",
    payloadHash: "sha256:demo-first",
    attemptCount: 2,
    lastAttemptAt: plannedAt,
    metadata: { duplicateOf: "github_delivery_first_seen" }
  }
];

export const defaultGitHubWebhookDeadLetterRecords: GitHubWebhookDeadLetterRecord[] = [
  {
    id: "github_dead_letter_malformed_payload",
    deliveryId: "delivery-demo-dead-letter",
    eventType: "pull_request",
    repoRef: "aichestra/demo-backend",
    reason: "malformed_payload_non_retryable",
    sanitizedPayloadPreview: "{\"action\":\"[redacted-invalid-preview]\"}",
    retryable: false,
    createdAt: plannedAt,
    metadata: {
      planningOnly: true,
      rawPayloadStored: false
    }
  }
];

export const defaultGitHubWebhookReplayProtectionPlan: GitHubWebhookReplayProtectionPlan = {
  id: "github_webhook_replay_protection_v0",
  status: "planning_only",
  deliveryIdUniqueness: "required",
  payloadHashStrategy: "sha256_metadata_only",
  timestampToleranceSeconds: 300,
  duplicateDeliveryBehavior: "same delivery id and same payload hash is idempotently ignored after audit",
  replayRejectedBehavior: "same delivery id with a different payload hash is rejected and audited",
  idempotentProcessingBehavior: "read-model upserts use delivery id plus repo/PR/branch keys; destructive actions are forbidden",
  persistenceRequirement: "production requires durable shared storage or queue-backed idempotency across API replicas",
  productionReady: false,
  auditEvents: ["github_webhook_duplicate_rejected", "github_webhook_processed", "github_webhook_payload_rejected"],
  testStrategy: ["duplicate same hash", "duplicate mismatched hash", "missing delivery id", "idempotent PR and branch sync upsert"],
  metadata: {
    distributedReplayCacheImplemented: false,
    rawPayloadStorage: false
  }
};

export const defaultGitHubWebhookDeadLetterPlan: GitHubWebhookDeadLetterPlan = {
  id: "github_webhook_retry_dead_letter_v0",
  status: "planning_only",
  retryableErrors: ["transient_storage_failure", "queue_unavailable", "rate_limit_read_model_refresh", "temporary_policy_bundle_unavailable"],
  nonRetryableErrors: ["invalid_signature", "missing_headers", "repo_not_allowlisted", "malformed_payload", "unsupported_event", "policy_denied"],
  maxRetryAttempts: 5,
  backoffStrategy: "exponential_backoff_with_jitter_future_worker",
  manualReviewProcess: "operators review sanitized dead-letter metadata, delivery id, event type, repo ref, and payload hash before any future replay",
  productionReady: false,
  auditEvents: ["github_webhook_dead_lettered", "github_webhook_duplicate_rejected"],
  observabilityMetrics: ["github.webhook.dead_letters", "github.webhook.retry_attempts", "github.webhook.processing_latency_ms"],
  metadata: {
    backgroundRetryWorkerImplemented: false,
    rawPayloadStorage: false
  }
};

export const defaultGitHubAppCredentialReadiness: GitHubAppCredentialReadiness = {
  id: "github_app_credentials_v0",
  status: "planning_only",
  privateKeySecretRefRequired: true,
  privateKeyConfigured: false,
  webhookSecretRefRequired: true,
  webhookSecretConfiguredForProduction: false,
  installationTokenExchangeImplemented: false,
  tokenTtlSeconds: 3600,
  legacyEnvTokenProductionReady: false,
  migrationSteps: [
    "create GitHub App in GitHub manually outside Aichestra",
    "store private key in future Vault/cloud SecretRef backend",
    "store webhook secret in future SecretRef backend",
    "map installation id to approved repositories",
    "replace legacy token fallback with installation-token exchange behind explicit gates"
  ],
  auditEvents: ["github_installation_token_requested_future", "github_installation_token_issued_future_metadata_only"],
  redactionRequirements: ["never store private keys", "never store webhook secrets", "never return installation tokens", "audit metadata only"],
  noSecretsStored: true,
  metadata: {
    privateKeySigningImplemented: false,
    installationTokenExchangeImplemented: false,
    legacyEnvFallbackProductionBlocked: true
  }
};

export const defaultGitHubProductionWebhookEndpointPlan: GitHubProductionWebhookEndpointPlan = {
  id: "github_production_webhook_endpoint_v0",
  endpointPath: "/git/github/webhooks",
  status: "planning_only",
  tlsRequired: true,
  rawBodyPreservationRequired: true,
  payloadSizeLimitBytes: 1048576,
  rateLimitStrategy: "reverse_proxy_and_application_rate_limits_future",
  queueRequired: true,
  productionReady: false,
  failureModes: ["signature_rejected", "repo_not_allowlisted", "duplicate_delivery", "queue_unavailable", "dead_lettered"],
  rolloutSteps: [
    "deploy endpoint behind TLS and reverse proxy",
    "verify raw body preservation",
    "enable signature verification with SecretRef-backed webhook secret",
    "enable queue-backed processing",
    "monitor duplicate/dead-letter metrics before allowing production traffic"
  ],
  metadata: {
    endpointDeployed: false,
    productionWebhooksEnabled: false
  }
};

export const defaultGitHubAppReadinessChecks: GitHubAppReadinessCheck[] = [
  {
    id: "github_app_private_key_secretref_required",
    category: "credentials",
    name: "GitHub App private key SecretRef required",
    status: "fail",
    severity: "critical",
    description: "Production GitHub App authentication requires a private key stored in a real secret backend.",
    remediation: "Add SecretRef-backed private key handling through a future Vault/cloud secret manager before live GitHub App use.",
    evidence: ["docs/roadmaps/github-app-production-webhook-hardening/github-app-credentials-v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "github_app_permissions_least_privilege_defined",
    category: "permissions",
    name: "Least-privilege permission matrix defined",
    status: "pass",
    severity: "medium",
    description: "The planning matrix denies workflows, administration, secrets, and deployments by default.",
    remediation: "Review matrix before live GitHub App creation.",
    evidence: ["docs/reference/github-app-permission-matrix.md"],
    metadata: { productionBlocker: false }
  },
  {
    id: "github_webhook_replay_storage_required",
    category: "replay",
    name: "Durable replay protection required",
    status: "fail",
    severity: "high",
    description: "Production webhook replay protection needs shared durable state across API replicas.",
    remediation: "Add durable delivery id and payload hash tracking before production webhooks.",
    evidence: ["docs/roadmaps/github-app-production-webhook-hardening/webhook-replay-protection-v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "github_webhook_dead_letter_worker_required",
    category: "dead_letter",
    name: "Retry and dead-letter worker required",
    status: "fail",
    severity: "high",
    description: "v0 models dead-letter records only; no background retry worker exists.",
    remediation: "Add queue-backed retry/dead-letter processing in a future milestone.",
    evidence: ["docs/roadmaps/github-app-production-webhook-hardening/webhook-retry-dead-letter-v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "github_webhook_endpoint_hardening_required",
    category: "webhook_endpoint",
    name: "Production webhook endpoint hardening required",
    status: "fail",
    severity: "high",
    description: "Production endpoint still needs TLS, raw-body preservation checks, payload limits, rate limits, and queue handoff.",
    remediation: "Implement endpoint hardening and deployment validation before enabling production webhooks.",
    evidence: ["docs/roadmaps/github-app-production-webhook-hardening/production-webhook-endpoint-v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "github_webhook_observability_required",
    category: "observability",
    name: "Production webhook observability required",
    status: "warning",
    severity: "high",
    description: "Planned metrics and audit events are defined, but no production exporter or alert delivery exists.",
    remediation: "Implement durable observability/export/alerts after Observability v0.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { productionBlocker: true }
  }
];

export const defaultGitHubAppProductionRisks: GitHubAppProductionRisk[] = [
  {
    id: "risk_github_app_private_key_mismanagement",
    category: "credentials",
    title: "GitHub App private key mishandled",
    severity: "critical",
    likelihood: "medium",
    impact: "A leaked private key could mint installation tokens for approved repositories.",
    mitigation: "Use a real secret backend, strict SecretRef policy, rotation, redaction, and metadata-only audit.",
    owner: "platform-security",
    status: "open",
    metadata: { productionBlocker: true }
  },
  {
    id: "risk_github_webhook_replay_without_shared_state",
    category: "webhook",
    title: "Webhook replay accepted across replicas",
    severity: "high",
    likelihood: "medium",
    impact: "Duplicate or replayed deliveries could repeatedly update read models or future queues.",
    mitigation: "Use durable delivery id and payload hash tracking with idempotent queue consumers.",
    owner: "integrations",
    status: "open",
    metadata: { productionBlocker: true }
  },
  {
    id: "risk_github_app_overprivileged_permissions",
    category: "permissions",
    title: "GitHub App receives excessive permissions",
    severity: "high",
    likelihood: "medium",
    impact: "Overbroad permissions increase blast radius beyond branch/PR read-model operations.",
    mitigation: "Use the least-privilege matrix and deny workflows, administration, secrets, and deployments by default.",
    owner: "integrations",
    status: "open",
    metadata: { productionBlocker: true }
  }
];

export const defaultDatabaseDeploymentProfiles: DatabaseDeploymentProfile[] = [
  {
    id: "local",
    name: "local",
    storageProvider: "in_memory",
    postgresRequired: false,
    migrationsRequired: false,
    poolingRequired: false,
    backupRequired: false,
    restoreTestRequired: false,
    retentionPolicyRequired: false,
    monitoringRequired: false,
    status: "partial",
    metadata: { mockFirstDefault: true, productionTrafficAllowed: false }
  },
  {
    id: "integration",
    name: "integration",
    storageProvider: "postgres",
    postgresRequired: false,
    migrationsRequired: true,
    poolingRequired: false,
    backupRequired: false,
    restoreTestRequired: true,
    retentionPolicyRequired: true,
    monitoringRequired: false,
    status: "ready_for_testing",
    metadata: { optionalPostgresContractTests: true, productionTrafficAllowed: false }
  },
  {
    id: "staging",
    name: "staging",
    storageProvider: "postgres_required",
    postgresRequired: true,
    migrationsRequired: true,
    poolingRequired: true,
    backupRequired: true,
    restoreTestRequired: true,
    retentionPolicyRequired: true,
    monitoringRequired: true,
    status: "not_ready",
    metadata: { releaseRehearsalProfile: true, productionTrafficAllowed: false }
  },
  {
    id: "production",
    name: "production",
    storageProvider: "postgres_required",
    postgresRequired: true,
    migrationsRequired: true,
    poolingRequired: true,
    backupRequired: true,
    restoreTestRequired: true,
    retentionPolicyRequired: true,
    monitoringRequired: true,
    status: "not_ready",
    metadata: { productionReady: false, requiresSecretBackend: true, requiresTenantScoping: true }
  }
];

export const defaultDatabaseReadinessChecks: DatabaseReadinessCheck[] = [
  {
    id: "db_local_in_memory_default",
    profileId: "local",
    category: "connection",
    name: "Local default remains in-memory",
    status: "pass",
    severity: "low",
    description: "Local development uses the mock-first in-memory storage provider unless Postgres is explicitly selected.",
    remediation: "Keep in-memory as the default for local tests and demos.",
    evidence: ["packages/db/src/storage.ts", "docs/features/persistent-db/v1.md"],
    metadata: { productionBlocker: false }
  },
  {
    id: "db_integration_optional_contract_tests",
    profileId: "integration",
    category: "migration",
    name: "Optional Postgres contract profile exists",
    status: "pass",
    severity: "medium",
    description: "The Postgres repository contract suite runs only when AICHESTRA_TEST_DATABASE_URL is configured.",
    remediation: "Keep the optional profile out of default tests and add CI coverage for a dedicated test database later.",
    evidence: ["tests/repository-contracts.test.ts"],
    metadata: { testDatabaseUrlValueExposed: false }
  },
  {
    id: "db_migration_runner_manual",
    profileId: "staging",
    category: "migration",
    name: "Migration runner is manual only",
    status: "warning",
    severity: "high",
    description: "The SQL runner exists but has no release job, migration lock, migration history, approval, or rollback workflow.",
    remediation: "Wrap migrations in a controlled release job with backup gate, checksum verification, lock, and post-migration checks.",
    evidence: ["scripts/db/migrate.mjs", "infra/migrations/0001_initial_aichestra_schema.sql"],
    metadata: { automaticMigrations: false }
  },
  {
    id: "db_pooling_required",
    profileId: "production",
    category: "pooling",
    name: "Production pooling is not implemented",
    status: "fail",
    severity: "critical",
    description: "Persistent DB v1 uses a psql CLI boundary per query to preserve current synchronous contracts.",
    remediation: "Add a pooled Node Postgres client and async repository/service boundary before production traffic.",
    evidence: ["packages/db/src/postgres.ts", "docs/features/persistent-db/v1.md"],
    metadata: { productionBlocker: true, currentClient: "psql_cli_per_query" }
  },
  {
    id: "db_backup_restore_required",
    profileId: "production",
    category: "backup",
    name: "Backup and restore process missing",
    status: "fail",
    severity: "critical",
    description: "No production backup job, restore drill, RPO/RTO, or recovery checklist is implemented.",
    remediation: "Define managed backup configuration and isolated restore drills before staging or production.",
    evidence: ["docs/roadmaps/production-deployment-readiness/database-operations-v0.md"],
    metadata: { productionBlocker: true, backupJobsImplemented: false }
  },
  {
    id: "db_index_review_required",
    profileId: "production",
    category: "indexes",
    name: "Index review required",
    status: "warning",
    severity: "high",
    description: "Core indexes exist, but high-growth audit, webhook, LLM, MCP, Local Agent, auth, and security query patterns need a production review.",
    remediation: "Review and stage recommended indexes with query plans before production.",
    evidence: ["docs/roadmaps/persistent-db-production-operations/index-review-v1.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "db_retention_no_deletion_v1",
    profileId: "production",
    category: "retention",
    name: "Retention enforcement remains future work",
    status: "fail",
    severity: "high",
    description: "Retention classes are modeled by Observability v0, but no deletion, legal hold, archive, or export control exists.",
    remediation: "Add reviewed retention enforcement and legal hold controls in a future milestone.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { deletionJobsEnabled: false, productionBlocker: true }
  },
  {
    id: "db_webhook_dedupe_persistence_required",
    profileId: "production",
    category: "webhook_dedupe",
    name: "Webhook replay/dead-letter persistence required",
    status: "fail",
    severity: "high",
    description: "GitHub App hardening defines replay and dead-letter behavior, but durable delivery records and dead-letter tables are not implemented.",
    remediation: "Add durable shared delivery id/payload hash and dead-letter persistence before enabling production webhooks.",
    evidence: ["docs/roadmaps/github-app-production-webhook-hardening/v0.md"],
    metadata: { productionBlocker: true, rawPayloadStorageAllowed: false }
  },
  {
    id: "db_monitoring_required",
    profileId: "production",
    category: "monitoring",
    name: "DB operations monitoring missing",
    status: "fail",
    severity: "high",
    description: "No production DB metrics, alerting, slow-query tracking, replication health, or storage growth alerts exist.",
    remediation: "Add observability backend and DB SLOs after the core operations plan is implemented.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { externalObservabilityBackend: false, productionBlocker: true }
  }
];

export const defaultDatabaseOperationRisks: DatabaseOperationRisk[] = [
  {
    id: "risk_db_psql_cli_runtime",
    category: "connection",
    title: "Per-query psql client is not production-grade",
    severity: "critical",
    likelihood: "high",
    impact: "Connection churn, process spawn overhead, and weak pooling controls would limit reliability under production traffic.",
    mitigation: "Introduce an async pooled DB client behind the storage provider boundary before production.",
    status: "open",
    metadata: { productionBlocker: true }
  },
  {
    id: "risk_db_backup_restore_absent",
    category: "restore",
    title: "No tested restore path",
    severity: "critical",
    likelihood: "medium",
    impact: "A failed migration, accidental data corruption, or infrastructure issue could become unrecoverable.",
    mitigation: "Define backup cadence, PITR posture, restore drill, and post-restore validation.",
    status: "open",
    metadata: { productionBlocker: true }
  },
  {
    id: "risk_db_audit_growth_unbounded",
    category: "audit_growth",
    title: "Audit and event tables can grow without operational controls",
    severity: "high",
    likelihood: "high",
    impact: "Audit, webhook, LLM, MCP, security, and Local Agent tables can degrade dashboard and API reads.",
    mitigation: "Add query limits, time indexes, partitioning plan, retention enforcement, and export/archive controls.",
    status: "open",
    metadata: { productionBlocker: true }
  },
  {
    id: "risk_db_webhook_replay_state_not_shared",
    category: "webhook_dedupe",
    title: "Webhook replay state is not durably shared",
    severity: "high",
    likelihood: "medium",
    impact: "Multiple API replicas could process duplicate or replayed deliveries inconsistently.",
    mitigation: "Persist delivery id and payload hash with uniqueness constraints before production webhooks.",
    status: "open",
    metadata: { productionBlocker: true }
  },
  {
    id: "risk_db_migration_rollback_untested",
    category: "migration_rollback",
    title: "Migration rollback process is not tested",
    severity: "high",
    likelihood: "medium",
    impact: "A bad migration could require unsafe manual intervention.",
    mitigation: "Prefer forward fixes, backup-gated migrations, compatibility windows, and rehearsed restore-based rollback.",
    status: "open",
    metadata: { productionBlocker: true }
  }
];

export const defaultDatabaseSchemaInventory: DatabaseSchemaInventoryItem[] = [
  {
    id: "schema_tasks",
    tableName: "tasks",
    purpose: "Durable task state",
    ownerModule: "core",
    highGrowth: false,
    retentionClass: "project_lifetime",
    keyIndexes: ["idx_tasks_repo_status", "idx_tasks_requester"],
    missingIndexes: ["created_at time index for production lists"],
    metadata: { implementedInSchema: true }
  },
  {
    id: "schema_task_runs",
    tableName: "task_runs",
    purpose: "Durable task execution attempts",
    ownerModule: "core",
    highGrowth: true,
    retentionClass: "project_lifetime",
    keyIndexes: ["task_id,attempt unique", "idx_task_runs_task", "idx_task_runs_status"],
    missingIndexes: ["status,created_at composite index"],
    metadata: { implementedInSchema: true }
  },
  {
    id: "schema_usage_ledger_entries",
    tableName: "usage_ledger_entries",
    purpose: "Cost and usage attribution",
    ownerModule: "core",
    highGrowth: true,
    retentionClass: "billing_audit",
    keyIndexes: ["idx_usage_task", "idx_usage_run", "idx_usage_provider_time"],
    missingIndexes: ["user_id,created_at", "repo_id,created_at"],
    metadata: { implementedInSchema: true }
  },
  {
    id: "schema_git_webhook_events",
    tableName: "git_webhook_events",
    purpose: "GitHub webhook delivery metadata without raw payloads",
    ownerModule: "git-adapter",
    highGrowth: true,
    retentionClass: "operational",
    keyIndexes: ["idx_git_webhook_events_delivery", "idx_git_webhook_events_repo_status", "idx_git_webhook_events_type_time"],
    missingIndexes: ["delivery_id unique future for production replay store"],
    metadata: { rawPayloadStorage: false, implementedInSchema: true }
  },
  {
    id: "schema_git_pull_request_sync_states",
    tableName: "git_pull_request_sync_states",
    purpose: "PR sync read model",
    ownerModule: "git-adapter",
    highGrowth: false,
    retentionClass: "operational",
    keyIndexes: ["repo_ref,pull_request_number unique", "idx_git_pr_sync_repo_state", "idx_git_pr_sync_task_run"],
    missingIndexes: ["last_synced_at for stale sync scans"],
    metadata: { implementedInSchema: true }
  },
  {
    id: "schema_git_branch_sync_states",
    tableName: "git_branch_sync_states",
    purpose: "Branch sync read model",
    ownerModule: "git-adapter",
    highGrowth: false,
    retentionClass: "operational",
    keyIndexes: ["repo_ref,branch_name unique", "idx_git_branch_sync_repo_exists"],
    missingIndexes: ["last_synced_at for stale branch scans"],
    metadata: { implementedInSchema: true }
  },
  {
    id: "schema_git_webhook_audit_events",
    tableName: "git_webhook_audit_events",
    purpose: "Append-only webhook audit",
    ownerModule: "git-adapter",
    highGrowth: true,
    retentionClass: "security",
    keyIndexes: ["idx_git_webhook_audit_event_type", "idx_git_webhook_audit_delivery", "idx_git_webhook_audit_repo"],
    missingIndexes: ["created_at partitioning future"],
    metadata: { rawPayloadStorage: false, implementedInSchema: true }
  },
  {
    id: "schema_audit_events",
    tableName: "audit_events",
    purpose: "Common task/system audit table for current core and Git audit records",
    ownerModule: "core",
    highGrowth: true,
    retentionClass: "compliance",
    keyIndexes: ["idx_audit_target", "idx_audit_task"],
    missingIndexes: ["created_at", "actor_user_id,created_at", "repo_id,created_at"],
    metadata: { appendOnly: true, implementedInSchema: true }
  },
  {
    id: "schema_observability_audit_events_future",
    tableName: "observability_audit_events",
    purpose: "Future durable common AuditEventEnvelope storage",
    ownerModule: "observability",
    highGrowth: true,
    retentionClass: "compliance",
    keyIndexes: [],
    missingIndexes: ["category,created_at", "outcome,created_at", "severity,created_at", "task_id,task_run_id", "correlation_id"],
    metadata: { implementedInSchema: false, futureOnly: true }
  },
  {
    id: "schema_github_webhook_delivery_records_future",
    tableName: "github_webhook_delivery_records",
    purpose: "Future durable replay/dedupe delivery records",
    ownerModule: "git-adapter",
    highGrowth: true,
    retentionClass: "operational",
    keyIndexes: [],
    missingIndexes: ["delivery_id unique", "event_type,received_at", "repo_ref,received_at", "processing_status,received_at"],
    metadata: { implementedInSchema: false, rawPayloadStorage: false, futureOnly: true }
  },
  {
    id: "schema_github_webhook_dead_letter_records_future",
    tableName: "github_webhook_dead_letter_records",
    purpose: "Future sanitized webhook dead-letter records",
    ownerModule: "git-adapter",
    highGrowth: true,
    retentionClass: "security",
    keyIndexes: [],
    missingIndexes: ["delivery_id", "event_type,created_at", "retryable,created_at"],
    metadata: { implementedInSchema: false, rawPayloadStorage: false, futureOnly: true }
  }
];

export const defaultDatabaseIndexReview: DatabaseIndexReviewItem[] = [
  {
    id: "index_tasks_status_created_at",
    tableName: "tasks",
    queryPattern: "Dashboard and task lists by repo/status/time.",
    recommendedIndex: "CREATE INDEX idx_tasks_repo_status_created_at ON tasks (repo_id, status, created_at DESC);",
    uniquenessRequirements: "none",
    retentionPartitioningNotes: "Project lifetime; no partitioning in v1.",
    status: "recommended",
    metadata: { priority: "medium" }
  },
  {
    id: "index_task_runs_task_attempt",
    tableName: "task_runs",
    queryPattern: "Fetch attempts for a task and active runs by status.",
    recommendedIndex: "UNIQUE (task_id, attempt); CREATE INDEX idx_task_runs_status_created_at ON task_runs (status, created_at DESC);",
    uniquenessRequirements: "task_id plus attempt is already unique.",
    retentionPartitioningNotes: "Retain with task history.",
    status: "implemented_in_schema",
    metadata: { hasAdditionalRecommendation: true }
  },
  {
    id: "index_usage_ledger_time",
    tableName: "usage_ledger_entries",
    queryPattern: "Usage by task/run/provider/user over time.",
    recommendedIndex: "CREATE INDEX idx_usage_user_time ON usage_ledger_entries (user_id, created_at DESC);",
    uniquenessRequirements: "event id primary key only.",
    retentionPartitioningNotes: "High-growth billing/audit table; partition by created_at in future.",
    status: "recommended",
    metadata: { highGrowth: true }
  },
  {
    id: "index_branch_leases_active",
    tableName: "branch_leases",
    queryPattern: "Conflict scans by repo and active lease status.",
    recommendedIndex: "CREATE INDEX idx_branch_leases_repo_status_expires ON branch_leases (repo_id, status, expires_at);",
    uniquenessRequirements: "future unique active branch per repo if needed.",
    retentionPartitioningNotes: "Retain with task/PR; expire active leases through future non-destructive status changes first.",
    status: "recommended",
    metadata: { productionReview: true }
  },
  {
    id: "index_merge_queue_repo_status",
    tableName: "merge_queue_entries",
    queryPattern: "Queue scans by repo/status/priority.",
    recommendedIndex: "CREATE INDEX idx_merge_queue_repo_status_priority ON merge_queue_entries (repo_id, status, priority);",
    uniquenessRequirements: "future active queue uniqueness for branch_lease_id if needed.",
    retentionPartitioningNotes: "Retain task/PR history.",
    status: "recommended",
    metadata: { currentIndexes: ["idx_merge_queue_repo_status", "idx_merge_queue_priority"] }
  },
  {
    id: "index_git_webhook_delivery_unique",
    tableName: "git_webhook_events",
    queryPattern: "Webhook replay lookup by delivery id and event processing by repo/status/time.",
    recommendedIndex: "CREATE UNIQUE INDEX idx_git_webhook_events_delivery_unique ON git_webhook_events (delivery_id);",
    uniquenessRequirements: "Production replay store needs delivery id uniqueness or a dedicated delivery table.",
    retentionPartitioningNotes: "High-growth webhook metadata; partition by received_at in future.",
    status: "recommended",
    metadata: { rawPayloadStorage: false }
  },
  {
    id: "index_git_pr_sync_unique",
    tableName: "git_pull_request_sync_states",
    queryPattern: "Lookup PR sync state by repo ref and PR number.",
    recommendedIndex: "UNIQUE (repo_ref, pull_request_number);",
    uniquenessRequirements: "Implemented in schema.",
    retentionPartitioningNotes: "Retain with PR/task history.",
    status: "implemented_in_schema",
    metadata: { readModelOnly: true }
  },
  {
    id: "index_registry_audit_time",
    tableName: "registry_audit_logs",
    queryPattern: "Registry history and audit by target, actor, and time.",
    recommendedIndex: "CREATE INDEX idx_registry_audit_created_at ON registry_audit_logs (created_at DESC);",
    uniquenessRequirements: "append-only id primary key.",
    retentionPartitioningNotes: "Compliance retention; partition by created_at in future if volume grows.",
    status: "recommended",
    metadata: { appendOnly: true }
  },
  {
    id: "index_llm_routing_decisions_future",
    tableName: "llm_routing_decisions",
    queryPattern: "Future route decisions by request, provider/model, decision, and time.",
    recommendedIndex: "CREATE INDEX idx_llm_routing_decisions_provider_time ON llm_routing_decisions (selected_provider_id, created_at DESC);",
    uniquenessRequirements: "request_id should be unique when persisted.",
    retentionPartitioningNotes: "Operational/audit retention; no raw prompts.",
    status: "future",
    metadata: { futureOnly: true, rawPromptStorage: false }
  },
  {
    id: "index_mcp_invocations_future",
    tableName: "mcp_invocations",
    queryPattern: "Future MCP invocation lookups by server/tool/status/time.",
    recommendedIndex: "CREATE INDEX idx_mcp_invocations_tool_status_time ON mcp_invocations (tool_id, status, created_at DESC);",
    uniquenessRequirements: "request_id unique future if externally correlated.",
    retentionPartitioningNotes: "Store sanitized previews only; partition by created_at if high growth.",
    status: "future",
    metadata: { futureOnly: true, rawToolInputStorage: false }
  },
  {
    id: "index_observability_audit_events_future",
    tableName: "observability_audit_events",
    queryPattern: "Future common audit envelope queries by category/outcome/severity/task/correlation/time.",
    recommendedIndex: "CREATE INDEX idx_observability_audit_category_time ON observability_audit_events (category, created_at DESC);",
    uniquenessRequirements: "id primary key; correlation ids are not unique.",
    retentionPartitioningNotes: "Partition by created_at and retention class in future.",
    status: "future",
    metadata: { futureOnly: true, rawPayloadStorage: false }
  }
];

export const defaultDatabaseRetentionPlan: DatabaseRetentionPlan = {
  id: "db_retention_plan_v1",
  status: "planning_only",
  deletionJobsEnabled: false,
  retentionClassesAligned: true,
  partitioningImplemented: false,
  archiveExportImplemented: false,
  legalHoldImplemented: false,
  highGrowthTables: [
    "usage_ledger_entries",
    "audit_events",
    "git_webhook_events",
    "git_webhook_audit_events",
    "llm_audit_events",
    "mcp_invocations",
    "policy_decision_audit_entries",
    "security_audit_events",
    "local_agent_stream_events"
  ],
  retentionClasses: ["short_debug", "operational", "security", "compliance", "ephemeral"],
  operationalRisks: ["unbounded_audit_growth", "manual_retention_only", "legal_hold_missing", "archive_export_missing"],
  metadata: {
    alignsWith: "docs/foundations/observability-audit-retention/v0.md",
    destructiveDeletionImplemented: false
  }
};

export const defaultDatabaseAuditGrowthPlan: DatabaseAuditGrowthPlan = {
  id: "db_audit_growth_plan_v1",
  status: "planning_only",
  highGrowthTables: [
    "audit_events",
    "git_webhook_events",
    "git_webhook_audit_events",
    "llm_audit_events",
    "mcp_audit_events",
    "security_audit_events",
    "local_agent_protocol_audit_events",
    "observability_audit_events_future"
  ],
  auditCategories: ["auth", "policy", "credential", "git", "git_webhook", "llm", "mcp", "runner", "registry", "improvement", "local_agent", "security", "dashboard", "system"],
  partitioningCandidates: ["audit_events", "git_webhook_events", "git_webhook_audit_events", "observability_audit_events_future"],
  requiredQueryLimits: ["dashboard audit panels", "observability audit events API", "webhook delivery listing", "LLM/MCP/security audit listing"],
  noDeletionInV1: true,
  metadata: {
    externalExportImplemented: false,
    legalHoldImplemented: false,
    rawPayloadStorageAllowed: false
  }
};

export const defaultDatabaseWebhookPersistencePlan: DatabaseWebhookPersistencePlan = {
  id: "db_webhook_persistence_v1",
  status: "planning_only",
  deliveryRecordTable: "github_webhook_delivery_records_future",
  deadLetterTable: "github_webhook_dead_letter_records_future",
  deliveryIdUniqueness: "required",
  payloadHashStrategy: "sha256_metadata_only",
  duplicateDetection: "same delivery id and same payload hash is duplicate and ignored after audit",
  replayRejection: "same delivery id with a different payload hash is rejected and audited",
  retryCounterStrategy: "attempt count and last attempt timestamp stored in future delivery/dead-letter tables",
  backgroundWorkerImplemented: false,
  rawPayloadStorage: false,
  indexRequirements: ["delivery_id unique", "payload_hash", "event_type,received_at", "repo_ref,received_at", "processing_status,received_at"],
  retentionRequirements: ["operational retention for delivery records", "security retention for replay/dead-letter audit", "no raw payload retention"],
  observabilityMetrics: [
    "github.webhook.deliveries.received",
    "github.webhook.deliveries.verified",
    "github.webhook.deliveries.rejected",
    "github.webhook.duplicate_deliveries",
    "github.webhook.dead_letters",
    "github.webhook.processing_latency_ms"
  ],
  metadata: {
    alignedWithGithubAppHardeningV0: true,
    durableSharedStoreImplemented: false,
    productionWebhooksReady: false
  }
};

export const defaultSecretBackendOptions: SecretBackendOption[] = [
  {
    id: "secret_backend_vault",
    backendKind: "vault",
    displayName: "Vault",
    status: "recommended",
    supportsLease: true,
    supportsRotation: true,
    supportsVersioning: true,
    supportsAudit: true,
    supportsIAM: true,
    supportsNamespace: true,
    supportsReplication: true,
    operationalComplexity: "high",
    productionRecommended: true,
    notes: [
      "Best fit where dynamic leases and mature secret operations already exist.",
      "Requires operator ownership, HA posture, auth method design, and restore drills."
    ],
    metadata: { planningOnly: true, externalCallsEnabled: false, defaultIfAlreadyOperated: true }
  },
  {
    id: "secret_backend_aws_secrets_manager",
    backendKind: "aws_secrets_manager",
    displayName: "AWS Secrets Manager",
    status: "planned",
    supportsLease: false,
    supportsRotation: true,
    supportsVersioning: true,
    supportsAudit: true,
    supportsIAM: true,
    supportsNamespace: false,
    supportsReplication: true,
    operationalComplexity: "medium",
    productionRecommended: true,
    notes: [
      "Good fit for AWS-native deployments with IAM, CloudTrail, and managed rotation hooks.",
      "Requires future IAM design; this task does not implement IAM or token exchange."
    ],
    metadata: { planningOnly: true, cloudNative: "aws", identityExchangeImplemented: false }
  },
  {
    id: "secret_backend_gcp_secret_manager",
    backendKind: "gcp_secret_manager",
    displayName: "GCP Secret Manager",
    status: "planned",
    supportsLease: false,
    supportsRotation: false,
    supportsVersioning: true,
    supportsAudit: true,
    supportsIAM: true,
    supportsNamespace: false,
    supportsReplication: true,
    operationalComplexity: "medium",
    productionRecommended: true,
    notes: [
      "Good fit for GCP-native deployments with IAM, audit logs, and explicit versions.",
      "Requires future service account and workload identity design."
    ],
    metadata: { planningOnly: true, cloudNative: "gcp", workloadIdentityImplemented: false }
  },
  {
    id: "secret_backend_azure_key_vault",
    backendKind: "azure_key_vault",
    displayName: "Azure Key Vault",
    status: "planned",
    supportsLease: false,
    supportsRotation: true,
    supportsVersioning: true,
    supportsAudit: true,
    supportsIAM: true,
    supportsNamespace: false,
    supportsReplication: true,
    operationalComplexity: "medium",
    productionRecommended: true,
    notes: [
      "Good fit for Azure-native deployments with managed identity and key vault auditing.",
      "Requires future managed identity and access policy design."
    ],
    metadata: { planningOnly: true, cloudNative: "azure", managedIdentityImplemented: false }
  },
  {
    id: "secret_backend_custom_future",
    backendKind: "custom_future",
    displayName: "Custom enterprise secret backend",
    status: "future",
    supportsLease: true,
    supportsRotation: true,
    supportsVersioning: true,
    supportsAudit: true,
    supportsIAM: true,
    supportsNamespace: true,
    supportsReplication: true,
    operationalComplexity: "high",
    productionRecommended: false,
    notes: [
      "Potential fit for enterprise-controlled secret platforms behind the same SecretManager contract.",
      "Requires a future adapter, security review, compatibility tests, and operational runbooks."
    ],
    metadata: { planningOnly: true, adapterImplemented: false }
  },
  {
    id: "secret_backend_env_legacy",
    backendKind: "env_legacy",
    displayName: "EnvSecretProvider legacy fallback",
    status: "not_recommended",
    supportsLease: false,
    supportsRotation: false,
    supportsVersioning: false,
    supportsAudit: false,
    supportsIAM: false,
    supportsNamespace: false,
    supportsReplication: false,
    operationalComplexity: "low",
    productionRecommended: false,
    notes: [
      "Allowed only for local development and tightly controlled integration profiles with warnings.",
      "Must be disabled for staging and production."
    ],
    metadata: { planningOnly: true, localOnly: true, productionBlocked: true }
  },
  {
    id: "secret_backend_mock",
    backendKind: "mock",
    displayName: "Mock secret backend",
    status: "allowed_for_integration",
    supportsLease: true,
    supportsRotation: false,
    supportsVersioning: false,
    supportsAudit: true,
    supportsIAM: false,
    supportsNamespace: false,
    supportsReplication: false,
    operationalComplexity: "low",
    productionRecommended: false,
    notes: [
      "Useful for deterministic tests and dashboard demos.",
      "Must not be promoted to production traffic."
    ],
    metadata: { planningOnly: true, deterministicTests: true, productionBlocked: true }
  }
];

export const defaultSecretBackendMigrationPhases: SecretBackendMigrationPhase[] = [
  {
    id: "secret_migration_phase_1_inventory",
    name: "Inventory SecretRefs and legacy env fallbacks",
    order: 1,
    sourceProvider: "env_legacy",
    targetProvider: "selected_real_backend",
    credentialKinds: ["github_token", "github_webhook_secret", "llm_api_key", "provider_api_key", "webhook_secret"],
    requiredPreconditions: ["SecretRef v1 metadata is available", "credential audit remains metadata-only"],
    migrationSteps: [
      "list SecretRef kinds and call sites without resolving values",
      "record legacy env fallback usage as booleans/counts only",
      "verify redaction for provider tokens, webhook secrets, and credential cache references"
    ],
    validationChecks: ["no secret values exposed", "no env values exposed", "no credential caches read"],
    rollbackPlan: ["keep existing local/integration env fallback until real backend parity is proven"],
    status: "ready_for_design",
    metadata: { planningOnly: true, externalCallsEnabled: false }
  },
  {
    id: "secret_migration_phase_2_backend_selection",
    name: "Select backend and profile gates",
    order: 2,
    sourceProvider: "env_legacy",
    targetProvider: "selected_real_backend",
    credentialKinds: ["github_token", "github_webhook_secret", "llm_api_key", "provider_api_key"],
    requiredPreconditions: ["deployment profile ownership", "production identity plan", "backend operations owner"],
    migrationSteps: [
      "choose Vault or cloud-native backend per deployment environment",
      "define SecretRef provider ids and backend path/version metadata",
      "define Auth/RBAC roles and service accounts that can request leases"
    ],
    validationChecks: ["backend selected for staging", "backend selected for production", "env fallback policy documented"],
    rollbackPlan: ["do not enable production traffic until backend gates pass"],
    status: "planned",
    metadata: { backendChoiceEnvironmentDependent: true }
  },
  {
    id: "secret_migration_phase_3_core_credentials",
    name: "Migrate GitHub, webhook, and LLM credentials",
    order: 3,
    sourceProvider: "env_legacy",
    targetProvider: "selected_real_backend",
    credentialKinds: ["github_token", "github_webhook_secret", "llm_api_key"],
    requiredPreconditions: ["real backend adapter implemented", "policy gates reviewed", "credential audit coverage available"],
    migrationSteps: [
      "create backend-backed SecretRefs for GitHub token, webhook secret, and LLM API key",
      "switch gated integrations to require SecretRef in staging",
      "record env fallback usage warnings without returning env values"
    ],
    validationChecks: ["GitHub gates use SecretRef", "webhook verifier uses SecretRef", "LLM gateway uses SecretRef", "legacy env fallback denied for production profile"],
    rollbackPlan: ["disable live integration gates and return to mock providers; do not print or export secret material"],
    status: "planned",
    metadata: { actualSecretMigrationImplemented: false }
  },
  {
    id: "secret_migration_phase_4_rotation_revocation",
    name: "Add rotation and revocation operations",
    order: 4,
    sourceProvider: "env_legacy",
    targetProvider: "selected_real_backend",
    credentialKinds: ["github_token", "github_webhook_secret", "llm_api_key", "provider_api_key", "webhook_secret"],
    requiredPreconditions: ["backend adapter implemented", "lease policy enforced", "operator runbooks approved"],
    migrationSteps: [
      "define manual rotation first",
      "add stale credential detection",
      "add emergency revocation and rollback procedures"
    ],
    validationChecks: ["rotation audit events emitted", "revoked SecretRefs denied", "stale credentials visible on dashboard"],
    rollbackPlan: ["disable affected provider gates and fall back to mock providers until a valid SecretRef is approved"],
    status: "future",
    metadata: { scheduledRotationJobsImplemented: false }
  },
  {
    id: "secret_migration_phase_5_future_credentials",
    name: "Future provider, MCP, Local Agent, OAuth, cloud identity, and BYOK credentials",
    order: 5,
    sourceProvider: "mock",
    targetProvider: "selected_real_backend",
    credentialKinds: [
      "provider_api_key",
      "future_oauth_token",
      "future_cloud_identity",
      "future_mcp_tool_secret",
      "future_local_agent_pairing_secret",
      "future_service_account_signing_key",
      "future_byok_key"
    ],
    requiredPreconditions: ["explicit future task", "production Auth/RBAC", "policy review", "backend-specific security design"],
    migrationSteps: [
      "design each credential kind separately",
      "deny raw credential cache reads",
      "keep BYOK, OAuth, WIF, IAM, and cloud identity exchange unimplemented until explicit milestones"
    ],
    validationChecks: ["no vendor CLI execution", "no provider cache reads", "no automatic credential issuance"],
    rollbackPlan: ["keep future credential kinds disabled and do not create live leases"],
    status: "future",
    metadata: { byokImplemented: false, oauthImplemented: false, cloudIdentityExchangeImplemented: false }
  },
  {
    id: "secret_migration_phase_6_disable_env_fallback",
    name: "Disable env fallback for staging and production",
    order: 6,
    sourceProvider: "env_legacy",
    targetProvider: "selected_real_backend",
    credentialKinds: ["github_token", "github_webhook_secret", "llm_api_key", "provider_api_key", "webhook_secret"],
    requiredPreconditions: ["backend-backed SecretRefs validated", "rollback tested", "observability and audit checks pass"],
    migrationSteps: [
      "warn on env fallback in integration",
      "block env fallback in staging and production",
      "keep local profile mock-first with explicit warnings"
    ],
    validationChecks: ["production profile reports env fallback blocked", "dashboard shows no-secret/no-env status", "health exposes booleans only"],
    rollbackPlan: ["deactivate production gates rather than re-enable env fallback"],
    status: "blocked",
    metadata: { requiresRealBackendImplementation: true }
  }
];

export const defaultSecretBackendReadinessChecks: SecretBackendReadinessCheck[] = [
  {
    id: "secret_backend_selection_required",
    category: "backend_selection",
    name: "Production secret backend selection required",
    status: "fail",
    severity: "critical",
    description: "Production cannot rely on EnvSecretProvider or mock secret managers.",
    remediation: "Select Vault or a cloud-native secret manager and define backend operations ownership.",
    evidence: ["docs/roadmaps/secret-backend-migration/backend-options-v0.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "secret_ref_schema_metadata_only",
    category: "secret_ref_schema",
    name: "SecretRef schema is metadata-only",
    status: "pass",
    severity: "medium",
    description: "Current SecretRefs model provider, kind, scope, status, and metadata without storing raw values.",
    remediation: "Keep backend-specific values and secret material out of SecretRef DTOs and audits.",
    evidence: ["docs/foundations/secretref-provider-credentials/v1.md"],
    metadata: { rawSecretStorage: false }
  },
  {
    id: "secret_lease_ttl_strategy_required",
    category: "lease_ttl",
    name: "Lease TTL strategy required",
    status: "warning",
    severity: "high",
    description: "Mock leases exist, but production TTL, renewal, and approval behavior are not enforced by a backend.",
    remediation: "Implement backend-backed lease TTL enforcement before production credential resolution.",
    evidence: ["docs/roadmaps/secret-backend-migration/lease-ttl-rotation-v0.md"],
    metadata: { backendEnforcedTtl: false }
  },
  {
    id: "secret_rotation_jobs_not_implemented",
    category: "rotation",
    name: "Production rotation jobs are not implemented",
    status: "fail",
    severity: "high",
    description: "Rotation and revocation are planned but no scheduled jobs, backend writes, or credential issuance exist.",
    remediation: "Add manual then scheduled/provider-managed rotation only in a future explicit task.",
    evidence: ["docs/roadmaps/secret-backend-migration/lease-ttl-rotation-v0.md"],
    metadata: { rotationJobsImplemented: false }
  },
  {
    id: "secret_audit_metadata_only",
    category: "audit",
    name: "Credential audit remains metadata-only",
    status: "pass",
    severity: "high",
    description: "Credential resolution audit records outcomes and references, not secret values.",
    remediation: "Extend audit taxonomy for future backend events without adding raw credential payloads.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { rawSecretAuditStorage: false }
  },
  {
    id: "secret_auth_policy_alignment_required",
    category: "auth_policy",
    name: "Production Auth/RBAC and Policy alignment required",
    status: "warning",
    severity: "critical",
    description: "Mock auth and static policy can model desired behavior but are not production identity or policy bundle governance.",
    remediation: "Add production Auth/RBAC and managed policy bundle controls before live backend access.",
    evidence: ["docs/foundations/auth-rbac/v0.md", "docs/features/policy-as-code/v0.md"],
    metadata: { productionAuthImplemented: false, managedPolicyBundlesImplemented: false }
  },
  {
    id: "secret_env_fallback_blocked_for_production",
    category: "env_fallback",
    name: "Env fallback must be blocked for production",
    status: "fail",
    severity: "critical",
    description: "Env fallback is acceptable only for local and controlled integration profiles; production requires a real backend.",
    remediation: "Reject legacy env provider and legacy provider secret env vars in production profile after real backend migration.",
    evidence: ["docs/roadmaps/secret-backend-migration/env-fallback-deprecation-v0.md"],
    metadata: { productionBlocker: true, envValuesExposed: false }
  },
  {
    id: "secret_provider_integration_secretrefs_defined",
    category: "provider_integration",
    name: "Core provider SecretRefs are defined",
    status: "pass",
    severity: "medium",
    description: "GitHub token, webhook secret, and LLM API key SecretRef hooks are documented.",
    remediation: "Migrate those refs to a real backend in a future implementation task.",
    evidence: ["docs/features/real-git-adapter/v2.md", "docs/features/llm-gateway/v2.md"],
    metadata: { actualBackendIntegrationImplemented: false }
  },
  {
    id: "secret_dashboard_panel_available",
    category: "dashboard",
    name: "Secret backend migration dashboard panel available",
    status: "pass",
    severity: "low",
    description: "Dashboard can expose planning status, blockers, risks, and no-secret/no-env posture.",
    remediation: "Keep the panel read-only and free of secret names or values.",
    evidence: ["docs/features/dashboard/v0.md"],
    metadata: { readOnly: true }
  },
  {
    id: "secret_observability_alignment_planned",
    category: "observability",
    name: "Observability metrics and audit events planned",
    status: "warning",
    severity: "medium",
    description: "Planned metrics and audit events exist, but no external exporter or alert delivery is implemented.",
    remediation: "Add production observability/export/alerting in a future milestone.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { externalExporterImplemented: false }
  },
  {
    id: "secret_incident_response_runbook_required",
    category: "incident_response",
    name: "Secret incident response runbook required",
    status: "warning",
    severity: "high",
    description: "Emergency rotation, revocation, and communication procedures need operator-ready runbooks.",
    remediation: "Add incident response drills after backend selection and before production traffic.",
    evidence: ["docs/roadmaps/secret-backend-migration/lease-ttl-rotation-v0.md"],
    metadata: { emergencyRotationDrilled: false }
  }
];

export const defaultSecretBackendRisks: SecretBackendRisk[] = [
  {
    id: "risk_secret_env_fallback_in_production",
    category: "env_fallback",
    title: "Legacy env fallback used in production",
    severity: "critical",
    likelihood: "medium",
    impact: "Long-lived env credentials could bypass backend audit, rotation, revocation, and least-privilege controls.",
    mitigation: "Block env fallback in staging and production profiles after backend-backed SecretRefs are validated.",
    status: "open",
    metadata: { productionBlocker: true }
  },
  {
    id: "risk_secret_backend_outage",
    category: "backend_operations",
    title: "Secret backend outage blocks provider operations",
    severity: "high",
    likelihood: "medium",
    impact: "GitHub, webhook, LLM, and future provider operations may fail closed during backend outages.",
    mitigation: "Design backend HA, retry budget, cached metadata only, fail-closed behavior, and operator runbooks.",
    status: "open",
    metadata: { failClosedRequired: true }
  },
  {
    id: "risk_secret_rotation_breaks_provider_access",
    category: "rotation",
    title: "Rotation invalidates provider access unexpectedly",
    severity: "high",
    likelihood: "medium",
    impact: "Provider integrations could fail until new refs are validated and rollout completes.",
    mitigation: "Use staged rotation, validation checks, provider-specific rollback, and dashboard/observability signals.",
    status: "open",
    metadata: { scheduledRotationImplemented: false }
  },
  {
    id: "risk_secret_backend_iam_sprawl",
    category: "auth_policy",
    title: "Secret backend identity permissions sprawl",
    severity: "high",
    likelihood: "medium",
    impact: "Overbroad service accounts or backend policies could allow credential access outside intended scopes.",
    mitigation: "Use least-privilege backend policies, production Auth/RBAC, service account review, and policy audit.",
    status: "open",
    metadata: { requiresProductionAuth: true }
  },
  {
    id: "risk_secret_audit_gap",
    category: "audit",
    title: "Backend audit is not correlated with Aichestra audit",
    severity: "high",
    likelihood: "medium",
    impact: "Credential access may be hard to investigate across backend and Aichestra control-plane events.",
    mitigation: "Correlate actor, request id, task id, provider id, SecretRef id, and backend audit metadata without exposing values.",
    status: "open",
    metadata: { externalAuditExportImplemented: false }
  },
  {
    id: "risk_secret_identifier_leakage",
    category: "secret_ref_schema",
    title: "Secret identifiers reveal sensitive naming conventions",
    severity: "medium",
    likelihood: "medium",
    impact: "Overly descriptive SecretRef ids or backend paths could reveal provider, tenant, or environment details.",
    mitigation: "Use stable opaque ids in dashboard/API and restrict backend path visibility to operators.",
    status: "open",
    metadata: { secretValuesExposed: false }
  }
];

// Decision v0 is intentionally seeded readiness data. It records the selected
// backend path without constructing a backend client or reading values.
export const defaultSecretBackendOptionDecision: SecretBackendOptionDecision = {
  id: "production_secret_backend_option_decision_v0",
  recommendedBackend: "vault",
  secondChoiceBackend: "aws_secrets_manager_future",
  decisionStatus: "accepted_mock",
  rationale: [
    "Vault is the best first implementation path for Aichestra because the repository has not selected a cloud target and Vault gives the strongest cloud-neutral lease, revocation, namespace, and audit model.",
    "Vault-backed Secret Backend v1 implements the selected provider as a gated, non-default SecretRef boundary without making production secrets ready.",
    "A Vault-backed adapter can prove the production SecretRef contract without coupling Aichestra to one cloud provider first.",
    "AWS Secrets Manager is the second choice if the first production deployment is explicitly AWS-first."
  ],
  assumptions: [
    "The first v1 implementation remains behind SecretRef, Auth/RBAC, Policy, and redaction boundaries.",
    "Production Auth/RBAC, service identities, and policy bundle runtime are still separate production blockers.",
    "EnvSecretProvider remains local/integration fallback only and is not a production default."
  ],
  risks: [
    "Vault adds operational complexity and requires owner assignment before production.",
    "Backend outage must fail closed without leaking secret values.",
    "Overbroad backend policy or tenant mapping mistakes could expose wrong-team credentials unless production Auth/RBAC and policy checks are enforced."
  ],
  implementationScopeRef: "docs/roadmaps/production-secret-backend-option-decision/implementation-scope-v1.md",
  createdAt: new Date("2026-05-14T00:00:00.000Z"),
  metadata: {
    docs: "docs/roadmaps/production-secret-backend-option-decision/recommendation-v0.md",
    selectedBackendImplemented: true,
    vaultSecretBackendV1Implemented: true,
    realVaultIntegrationImplemented: true,
    realCloudSecretManagerIntegrationImplemented: false,
    productionSecretsReady: false
  }
};

export const defaultSecretBackendDecisionCriteria: SecretBackendDecisionCriterion[] = [
  { id: "security_posture", name: "Security posture", weight: 10, description: "Strength of isolation, access control, revocation, and safe failure behavior.", metadata: { required: true } },
  { id: "secretref_compatibility", name: "SecretRef compatibility", weight: 10, description: "Ability to keep stable SecretRef ids while storing backend reference/version metadata only.", metadata: { required: true } },
  { id: "lease_ttl_support", name: "Lease and TTL support", weight: 9, description: "Backend-native support for short-lived access, leases, renewal policy, and revocation.", metadata: { required: true } },
  { id: "rotation_support", name: "Rotation support", weight: 8, description: "Manual and future scheduled/provider-managed rotation support.", metadata: { required: true } },
  { id: "versioning_support", name: "Versioning support", weight: 7, description: "Secret version metadata and rollback support without exposing values.", metadata: { required: true } },
  { id: "audit_capability", name: "Audit capability", weight: 9, description: "Backend audit detail and correlation with Aichestra actor/request/task/provider metadata.", metadata: { required: true } },
  { id: "iam_rbac_integration", name: "IAM/RBAC integration", weight: 9, description: "Ability to align backend identity with Aichestra Auth/RBAC and policy decisions.", metadata: { required: true } },
  { id: "tenant_team_project_scoping", name: "Tenant/team/project scoping", weight: 8, description: "Supports per-tenant/team/project namespaces, policies, or equivalent isolation.", metadata: { required: true } },
  { id: "environment_usability", name: "Local/integration/staging/production usability", weight: 6, description: "Works across local mock, integration, staging validation, and production.", metadata: { required: true } },
  { id: "operational_complexity", name: "Operational complexity", weight: 6, description: "Operational burden, HA ownership, backup/restore, and on-call requirements.", metadata: { lowerComplexityScoresHigher: true } },
  { id: "deployment_complexity", name: "Deployment complexity", weight: 5, description: "Complexity of deploying and configuring the backend safely.", metadata: { lowerComplexityScoresHigher: true } },
  { id: "vendor_lock_in", name: "Cloud/vendor lock-in", weight: 5, description: "Portability across self-hosted and cloud deployments.", metadata: { lowerLockInScoresHigher: true } },
  { id: "self_hosted_support", name: "Self-hosted support", weight: 7, description: "Suitability for self-hosted or cloud-neutral production deployments.", metadata: { required: false } },
  { id: "cost", name: "Cost", weight: 4, description: "Expected service and operational cost profile.", metadata: { required: false } },
  { id: "backup_restore", name: "Backup and restore implications", weight: 6, description: "Recoverability without secret exposure or metadata corruption.", metadata: { required: true } },
  { id: "incident_response", name: "Incident response support", weight: 7, description: "Emergency revoke, disable, audit, rotate, and recovery support.", metadata: { required: true } },
  { id: "break_glass", name: "Break-glass support", weight: 5, description: "Audited emergency access compatibility without weakening default gates.", metadata: { future: true } },
  { id: "developer_experience", name: "Developer experience", weight: 4, description: "Ease of local development and operator diagnostics without values.", metadata: { required: false } },
  { id: "testability", name: "Testability", weight: 6, description: "Supports deterministic unit/contract tests and skipped-by-default live tests.", metadata: { required: true } },
  { id: "future_extension_compatibility", name: "Future BYOK/OAuth/WIF/IAM/MCP/Local Agent compatibility", weight: 7, description: "Future compatibility with enterprise credential patterns without reading caches or exposing values.", metadata: { required: false } }
];

export const defaultSecretBackendDecisionScores: SecretBackendDecisionScore[] = [
  {
    id: "score_vault_security_posture",
    backendKind: "vault",
    criterionId: "security_posture",
    score: 5,
    weightedScore: 50,
    rationale: "Vault has strong policy, namespace, lease, revoke, and audit semantics when operated correctly.",
    metadata: { implemented: true, productionReady: false }
  },
  {
    id: "score_vault_lease_ttl_support",
    backendKind: "vault",
    criterionId: "lease_ttl_support",
    score: 5,
    weightedScore: 45,
    rationale: "Vault is the strongest option for backend-native leases and TTLs.",
    metadata: { implemented: true, productionReady: false }
  },
  {
    id: "score_vault_vendor_lock_in",
    backendKind: "vault",
    criterionId: "vendor_lock_in",
    score: 5,
    weightedScore: 25,
    rationale: "Vault keeps the first adapter cloud-neutral while deployment target remains undecided.",
    metadata: { implemented: true, productionReady: false }
  },
  {
    id: "score_aws_security_posture",
    backendKind: "aws_secrets_manager_future",
    criterionId: "security_posture",
    score: 4,
    weightedScore: 40,
    rationale: "AWS Secrets Manager is strong for AWS-native deployments but ties the first implementation to AWS IAM and operations.",
    metadata: { implemented: false }
  },
  {
    id: "score_gcp_security_posture",
    backendKind: "gcp_secret_manager_future",
    criterionId: "security_posture",
    score: 4,
    weightedScore: 40,
    rationale: "GCP Secret Manager is strong for GCP-native deployments but lacks Vault-style lease semantics.",
    metadata: { implemented: false }
  },
  {
    id: "score_azure_security_posture",
    backendKind: "azure_key_vault_future",
    criterionId: "security_posture",
    score: 4,
    weightedScore: 40,
    rationale: "Azure Key Vault is strong for Azure/Entra deployments but should follow an Azure target decision.",
    metadata: { implemented: false }
  },
  {
    id: "score_env_production_suitability",
    backendKind: "env",
    criterionId: "security_posture",
    score: 1,
    weightedScore: 10,
    rationale: "Env fallback lacks backend-native audit, rotation, versioning, HA, lease, and IAM controls; it is not production-suitable.",
    metadata: { productionDefaultAllowed: false }
  },
  {
    id: "score_mock_testability",
    backendKind: "mock",
    criterionId: "testability",
    score: 5,
    weightedScore: 30,
    rationale: "Mock provider is excellent for deterministic tests but must remain test-only.",
    metadata: { productionDefaultAllowed: false }
  }
];

export const defaultSecretBackendImplementationScopes: SecretBackendImplementationScope[] = [
  {
    id: "vault_secret_backend_implementation_scope_v1",
    backendKind: "vault",
    version: "v1",
    status: "v1_implemented",
    includedCapabilities: [
      "Vault-backed SecretRef provider class behind SecurityControlService",
      "metadata-only backend reference and version fields",
      "read-only config validation and health status",
      "CredentialManager and TokenResolver integration through existing Auth/RBAC and Policy gates",
      "manual rotation metadata and revoked/disabled fail-closed behavior",
      "API/dashboard/health no-secret/no-env contract tests",
      "skipped-by-default Vault integration-test skeleton behind explicit gates"
    ],
    excludedCapabilities: [
      "automatic secret migration",
      "scheduled rotation jobs",
      "BYOK",
      "OAuth/device-code/WIF/IAM token exchange",
      "provider credential cache reads",
      "Local CLI credential reads",
      "Local Agent secret forwarding",
      "production credential issuance"
    ],
    requiredConfig: [
      "AICHESTRA_SECRET_BACKEND_PROVIDER=vault",
      "AICHESTRA_VAULT_ADDR configured as status only",
      "AICHESTRA_VAULT_NAMESPACE optional status only",
      "AICHESTRA_VAULT_AUTH_METHOD future explicit value",
      "AICHESTRA_SECRET_BACKEND_INTEGRATION_TESTS=false by default"
    ],
    requiredTests: [
      "unit tests for provider config validation",
      "contract tests with mock Vault client",
      "no-secret API/dashboard/health tests",
      "permission denied and policy denied tests",
      "missing/revoked secret tests",
      "skipped live integration test skeleton"
    ],
    metadata: {
      docs: "docs/roadmaps/production-secret-backend-option-decision/implementation-scope-v1.md",
      dependencyDecision: "isolated_gated_http_client_boundary_without_new_dependency",
      externalCallsInDefaultTests: false,
      selectedBackendImplemented: true,
      productionSecretBackendReady: false
    }
  }
];

export const defaultSecretBackendProviderMappings: SecretBackendProviderMapping[] = [
  {
    id: "secret_backend_provider_mapping_mock",
    providerValue: "mock",
    currentStatus: "implemented as metadata/mock behavior",
    productionStatus: "test_only",
    providerIdentifier: "mock",
    requiredConfig: [],
    allowedProfiles: ["local", "integration"],
    forbiddenProfiles: ["staging", "production"],
    requiredAuthRbac: ["mock actor allowed only for local/test metadata"],
    requiredPolicy: ["secret.read remains denied"],
    auditRequirements: ["metadata-only mock lease and resolution audit"],
    healthDashboardExposure: ["kind/status/counts only"],
    testStrategy: ["deterministic unit tests"],
    metadata: { productionDefaultAllowed: false }
  },
  {
    id: "secret_backend_provider_mapping_env",
    providerValue: "env",
    currentStatus: "implemented as explicit allowlisted EnvSecretProvider",
    productionStatus: "local_integration_only",
    providerIdentifier: "env",
    requiredConfig: ["AICHESTRA_ENABLE_ENV_SECRET_PROVIDER", "AICHESTRA_ALLOWED_SECRET_ENV_KEYS"],
    allowedProfiles: ["local", "integration"],
    forbiddenProfiles: ["production"],
    requiredAuthRbac: ["AuthorizationService allow before env read"],
    requiredPolicy: ["provider.credential.resolve", "secret.lease.request", "secret.lease.issue"],
    auditRequirements: ["legacy fallback warning and credential resolution metadata only"],
    healthDashboardExposure: ["enabled boolean and allowlisted env key count only"],
    testStrategy: ["fake env values in tests; assert values never appear"],
    metadata: { productionDefaultAllowed: false, stagingAllowedOnlyAsWarning: true }
  },
  {
    id: "secret_backend_provider_mapping_vault",
    providerValue: "vault",
    currentStatus: "v1 implemented as gated non-default SecretRef provider",
    productionStatus: "v1_implemented_gated",
    providerIdentifier: "vault",
    requiredConfig: ["AICHESTRA_SECRET_BACKEND_PROVIDER=vault", "AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true", "AICHESTRA_VAULT_ADDR", "AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES", "gated Vault token auth for integration tests only"],
    allowedProfiles: ["integration", "staging", "production"],
    forbiddenProfiles: [],
    requiredAuthRbac: ["security_admin setup", "service account resolve for narrow purposes", "tenant/team/project scope checks"],
    requiredPolicy: ["deny disabled/revoked refs", "deny env fallback in production", "deny broad secret.read"],
    auditRequirements: ["Aichestra audit correlation plus Vault audit event reference metadata"],
    healthDashboardExposure: ["provider kind, configured booleans, readiness status, no values"],
    testStrategy: ["mock client contract tests and skipped live tests behind explicit gates"],
    metadata: { selectedForV1: true, implemented: true, productionReady: false }
  },
  {
    id: "secret_backend_provider_mapping_aws",
    providerValue: "aws_secrets_manager_future",
    currentStatus: "future placeholder only",
    productionStatus: "deferred",
    providerIdentifier: "aws_secrets_manager_future",
    requiredConfig: ["future AWS region/status", "future IAM role/status"],
    allowedProfiles: ["integration", "staging", "production"],
    forbiddenProfiles: [],
    requiredAuthRbac: ["service account identity mapped to IAM role"],
    requiredPolicy: ["purpose-scoped credential resolve checks"],
    auditRequirements: ["Aichestra audit plus CloudTrail correlation metadata"],
    healthDashboardExposure: ["provider kind and configured booleans only"],
    testStrategy: ["future mock AWS client contract tests; skipped live tests"],
    metadata: { secondChoiceIfAwsFirst: true, implemented: false }
  },
  {
    id: "secret_backend_provider_mapping_gcp",
    providerValue: "gcp_secret_manager_future",
    currentStatus: "future placeholder only",
    productionStatus: "deferred",
    providerIdentifier: "gcp_secret_manager_future",
    requiredConfig: ["future project/status", "future workload identity/status"],
    allowedProfiles: ["integration", "staging", "production"],
    forbiddenProfiles: [],
    requiredAuthRbac: ["service account identity mapped to project scope"],
    requiredPolicy: ["purpose-scoped credential resolve checks"],
    auditRequirements: ["Aichestra audit plus Cloud Audit Logs correlation metadata"],
    healthDashboardExposure: ["provider kind and configured booleans only"],
    testStrategy: ["future mock GCP client contract tests; skipped live tests"],
    metadata: { implemented: false }
  },
  {
    id: "secret_backend_provider_mapping_azure",
    providerValue: "azure_key_vault_future",
    currentStatus: "future placeholder only",
    productionStatus: "deferred",
    providerIdentifier: "azure_key_vault_future",
    requiredConfig: ["future vault uri/status", "future managed identity/status"],
    allowedProfiles: ["integration", "staging", "production"],
    forbiddenProfiles: [],
    requiredAuthRbac: ["service account identity mapped to tenant/scope"],
    requiredPolicy: ["purpose-scoped credential resolve checks"],
    auditRequirements: ["Aichestra audit plus Azure diagnostics correlation metadata"],
    healthDashboardExposure: ["provider kind and configured booleans only"],
    testStrategy: ["future mock Azure client contract tests; skipped live tests"],
    metadata: { implemented: false }
  },
  {
    id: "secret_backend_provider_mapping_custom",
    providerValue: "custom_future",
    currentStatus: "future custom adapter only",
    productionStatus: "future",
    providerIdentifier: "custom_future",
    requiredConfig: ["future enterprise backend endpoint/status", "future adapter id/status"],
    allowedProfiles: ["integration", "staging", "production"],
    forbiddenProfiles: [],
    requiredAuthRbac: ["enterprise-defined service identity and tenant mapping"],
    requiredPolicy: ["contract-specific policy checks"],
    auditRequirements: ["must meet common audit envelope and backend audit correlation"],
    healthDashboardExposure: ["provider kind and contract status only"],
    testStrategy: ["future adapter contract tests"],
    metadata: { implemented: false }
  }
];

export const defaultSecretBackendDecisionRisks: SecretBackendDecisionRisk[] = [
  { id: "secret_decision_risk_accidental_exposure", category: "secret_exposure", title: "Accidental secret exposure", severity: "critical", likelihood: "medium", impact: "Raw credentials could leak through API, dashboard, logs, audit, or test output.", mitigation: "Keep DTO sanitization, no-secret tests, redaction, and metadata-only audit mandatory.", ownerPlaceholder: "security_owner", status: "open", metadata: { noSecretTestsRequired: true } },
  { id: "secret_decision_risk_wrong_tenant_access", category: "tenant_access", title: "Wrong tenant or team secret access", severity: "critical", likelihood: "medium", impact: "A service could resolve credentials outside its tenant/team/project scope.", mitigation: "Require production Auth/RBAC, scoped service accounts, backend namespace/policy mapping, and policy checks.", ownerPlaceholder: "identity_platform_owner", status: "open", metadata: { requiresProductionAuth: true } },
  { id: "secret_decision_risk_env_fallback_production", category: "env_fallback", title: "Env fallback used in production", severity: "critical", likelihood: "medium", impact: "Production could bypass backend audit, rotation, and revocation.", mitigation: "Block env fallback for production and prefer backend-backed SecretRefs.", ownerPlaceholder: "platform_owner", status: "open", metadata: { productionBlocker: true } },
  { id: "secret_decision_risk_stale_credential", category: "rotation", title: "Stale credential remains active", severity: "high", likelihood: "medium", impact: "Provider access may continue beyond expected validity or ownership.", mitigation: "Add stale version checks, manual rotation runbooks, and future rotation jobs.", ownerPlaceholder: "security_owner", status: "open", metadata: { rotationJobsImplemented: false } },
  { id: "secret_decision_risk_failed_rotation", category: "rotation", title: "Failed rotation breaks provider access", severity: "high", likelihood: "medium", impact: "GitHub, webhook, LLM, or provider operations may fail.", mitigation: "Use staged rotation, validation checks, and rollback to disabled/mock gates.", ownerPlaceholder: "integrations_owner", status: "open", metadata: { failClosedRequired: true } },
  { id: "secret_decision_risk_backend_outage", category: "backend_outage", title: "Backend outage", severity: "high", likelihood: "medium", impact: "Credential resolution fails for live integrations.", mitigation: "Design HA, timeout, retry budget, fail-closed behavior, and operator alerting.", ownerPlaceholder: "platform_ops_owner", status: "open", metadata: { externalBackendImplemented: false } },
  { id: "secret_decision_risk_audit_gap", category: "audit", title: "Audit correlation gap", severity: "high", likelihood: "medium", impact: "Incident response cannot correlate backend access with Aichestra actors and requests.", mitigation: "Correlate request id, actor, service account, task, provider, SecretRef id, and backend audit reference.", ownerPlaceholder: "observability_owner", status: "open", metadata: { externalAuditExportImplemented: false } },
  { id: "secret_decision_risk_missing_break_glass", category: "break_glass", title: "Missing break-glass process", severity: "high", likelihood: "medium", impact: "Emergency access may be improvised or unaudited.", mitigation: "Define explicit break-glass workflow before production backend rollout.", ownerPlaceholder: "security_owner", status: "open", metadata: { breakGlassImplemented: false } },
  { id: "secret_decision_risk_overbroad_iam", category: "iam", title: "Overbroad backend IAM", severity: "critical", likelihood: "medium", impact: "Service accounts could read too many credentials.", mitigation: "Use least-privilege backend policies, review service account scopes, and deny broad secret.read.", ownerPlaceholder: "platform_security_owner", status: "open", metadata: { leastPrivilegeRequired: true } },
  { id: "secret_decision_risk_credential_cache_misuse", category: "credential_cache", title: "Provider credential cache misuse", severity: "critical", likelihood: "low", impact: "Provider-owned user credentials could be read or uploaded.", mitigation: "Keep credential cache reads denied and covered by tests.", ownerPlaceholder: "security_owner", status: "open", metadata: { credentialCachesRead: false } },
  { id: "secret_decision_risk_local_agent_forwarding", category: "local_agent", title: "Local Agent secret forwarding", severity: "high", likelihood: "medium", impact: "Secrets could be forwarded to user machines or vendor CLIs.", mitigation: "Keep Local Agent secret forwarding denied until explicit future design.", ownerPlaceholder: "local_agent_owner", status: "open", metadata: { localAgentSecretForwardingEnabled: false } },
  { id: "secret_decision_risk_test_secret_leakage", category: "testing", title: "Test secret leakage", severity: "high", likelihood: "medium", impact: "Live integration tests could expose non-production secret material.", mitigation: "Use skipped-by-default live tests, safe namespaces, fake fixtures, and output redaction.", ownerPlaceholder: "qa_owner", status: "open", metadata: { liveTestsSkippedByDefault: true } },
  { id: "secret_decision_risk_dashboard_health_leak", category: "dashboard_health", title: "Dashboard or health leak", severity: "critical", likelihood: "low", impact: "Readiness surfaces could leak backend paths, env values, or credential values.", mitigation: "Expose booleans/counts/status only and keep no-secret dashboard tests.", ownerPlaceholder: "dashboard_owner", status: "open", metadata: { healthValuesExposed: false } },
  { id: "secret_decision_risk_backup_restore_refs", category: "backup_restore", title: "Backup/restore contains sensitive references", severity: "medium", likelihood: "medium", impact: "Backups may reveal sensitive naming or stale SecretRef mappings.", mitigation: "Use opaque ids, review metadata, and keep secret values exclusively in backend backups.", ownerPlaceholder: "db_owner", status: "open", metadata: { rawSecretsInDbBackups: false } },
  { id: "secret_decision_risk_incident_response_gap", category: "incident_response", title: "Incident response gap", severity: "high", likelihood: "medium", impact: "Operators may not have a tested response for leak, outage, or compromised service account.", mitigation: "Add incident runbook, drills, escalation, audit review, and communication steps.", ownerPlaceholder: "security_owner", status: "open", metadata: { drillCompleted: false } }
];

export const defaultSecretRotationPlans: SecretRotationPlan[] = [
  {
    id: "rotation_github_token",
    secretKind: "github_token",
    backendKind: "selected_real_backend",
    rotationMode: "manual",
    targetIntervalDays: 90,
    requiresDowntime: false,
    validationChecks: ["repo allowlist still enforced", "branch and PR gates still require policy", "token value never logged"],
    rollbackPlan: ["disable remote Git gates and return to mock provider until a valid SecretRef is approved"],
    auditRequirements: ["secret_rotation_requested_future", "secret_rotation_completed_future", "credential_resolution_attempt_metadata_only"],
    status: "planned",
    metadata: { githubAppInstallationTokensPreferredFuture: true }
  },
  {
    id: "rotation_github_webhook_secret",
    secretKind: "github_webhook_secret",
    backendKind: "selected_real_backend",
    rotationMode: "manual",
    targetIntervalDays: 180,
    requiresDowntime: false,
    validationChecks: ["signature verification passes with new SecretRef", "old secret revoked after overlap window", "raw webhook payloads remain unstored"],
    rollbackPlan: ["disable webhook receiver and reject deliveries until operators restore a valid SecretRef"],
    auditRequirements: ["secret_rotation_requested_future", "secret_rotation_completed_future", "github_webhook_signature_verified_metadata_only"],
    status: "planned",
    metadata: { overlapWindowRequired: true }
  },
  {
    id: "rotation_llm_api_key",
    secretKind: "llm_api_key",
    backendKind: "selected_real_backend",
    rotationMode: "manual",
    targetIntervalDays: 90,
    requiresDowntime: false,
    validationChecks: ["provider/model allowlist intact", "budget policy intact", "raw prompts and API keys not stored"],
    rollbackPlan: ["disable remote LLM completion and use mock-only routing"],
    auditRequirements: ["secret_rotation_requested_future", "secret_rotation_completed_future", "llm_credential_resolution_metadata_only"],
    status: "planned",
    metadata: { remoteCompletionGateStillRequired: true }
  },
  {
    id: "rotation_provider_api_key",
    secretKind: "provider_api_key",
    backendKind: "selected_real_backend",
    rotationMode: "manual",
    targetIntervalDays: 90,
    requiresDowntime: false,
    validationChecks: ["provider-specific adapter gates remain disabled unless explicitly enabled", "SecretRef status active"],
    rollbackPlan: ["disable affected provider adapter and keep provider skeleton disabled"],
    auditRequirements: ["secret_rotation_requested_future", "secret_rotation_completed_future"],
    status: "future",
    metadata: { providerAdaptersMostlyFuture: true }
  },
  {
    id: "rotation_future_oauth_token",
    secretKind: "future_oauth_token",
    backendKind: "selected_real_backend",
    rotationMode: "provider_managed_future",
    requiresDowntime: false,
    validationChecks: ["OAuth implementation exists", "refresh token handling reviewed", "raw tokens never returned"],
    rollbackPlan: ["disable OAuth provider integration"],
    auditRequirements: ["secret_rotation_requested_future", "oauth_token_refresh_future_metadata_only"],
    status: "future",
    metadata: { oauthImplemented: false }
  },
  {
    id: "rotation_future_cloud_identity",
    secretKind: "future_cloud_identity",
    backendKind: "selected_real_backend",
    rotationMode: "provider_managed_future",
    requiresDowntime: false,
    validationChecks: ["WIF/IAM implementation exists", "service account scope reviewed"],
    rollbackPlan: ["disable cloud identity provider integration"],
    auditRequirements: ["cloud_identity_token_requested_future_metadata_only"],
    status: "future",
    metadata: { wifIamImplemented: false }
  },
  {
    id: "rotation_future_mcp_tool_secret",
    secretKind: "future_mcp_tool_secret",
    backendKind: "selected_real_backend",
    rotationMode: "manual",
    targetIntervalDays: 60,
    requiresDowntime: false,
    validationChecks: ["MCP real transport explicitly enabled", "tool risk approved", "no tool input raw secret storage"],
    rollbackPlan: ["disable real MCP tool and keep mock gateway"],
    auditRequirements: ["secret_rotation_requested_future", "mcp_tool_secret_resolution_future_metadata_only"],
    status: "future",
    metadata: { realMcpTransportImplemented: false }
  },
  {
    id: "rotation_future_local_agent_pairing_secret",
    secretKind: "future_local_agent_pairing_secret",
    backendKind: "selected_real_backend",
    rotationMode: "manual",
    targetIntervalDays: 30,
    requiresDowntime: false,
    validationChecks: ["Local Agent real transport exists", "consent and pairing audit recorded"],
    rollbackPlan: ["invalidate pairing and keep mock transport"],
    auditRequirements: ["secret_rotation_requested_future", "local_agent_pairing_secret_rotated_future"],
    status: "future",
    metadata: { realLocalAgentDaemonImplemented: false }
  },
  {
    id: "rotation_future_service_account_signing_key",
    secretKind: "future_service_account_signing_key",
    backendKind: "selected_real_backend",
    rotationMode: "scheduled_future",
    targetIntervalDays: 90,
    requiresDowntime: false,
    validationChecks: ["production Auth/RBAC exists", "key id rollover supported", "old key revoked after validation"],
    rollbackPlan: ["disable service account issuance and rotate to previous approved key id if still valid"],
    auditRequirements: ["secret_rotation_requested_future", "service_account_signing_key_rotated_future"],
    status: "future",
    metadata: { productionTokenIssuanceImplemented: false }
  }
];

export const defaultSecretLeasePolicies: SecretLeasePolicy[] = [
  {
    id: "lease_policy_github_token",
    secretKind: "github_token",
    maxTtlSeconds: 3600,
    renewable: false,
    requiresApproval: true,
    allowedActors: ["service_account:git_adapter", "role:security_admin"],
    allowedPurposes: ["remote_git_branch_create", "remote_git_pr_create", "github_read_model_refresh"],
    status: "planned",
    metadata: { mergePurposeAllowed: false, forcePushPurposeAllowed: false, branchDeletionPurposeAllowed: false }
  },
  {
    id: "lease_policy_github_webhook_secret",
    secretKind: "github_webhook_secret",
    maxTtlSeconds: 300,
    renewable: false,
    requiresApproval: false,
    allowedActors: ["service_account:api_webhook_receiver"],
    allowedPurposes: ["github_webhook_signature_verification"],
    status: "planned",
    metadata: { rawWebhookSecretReturnedToDashboard: false }
  },
  {
    id: "lease_policy_llm_api_key",
    secretKind: "llm_api_key",
    maxTtlSeconds: 1800,
    renewable: false,
    requiresApproval: true,
    allowedActors: ["service_account:llm_gateway", "role:security_admin"],
    allowedPurposes: ["remote_llm_completion"],
    status: "planned",
    metadata: { budgetPolicyRequired: true, modelAllowlistRequired: true }
  },
  {
    id: "lease_policy_provider_api_key",
    secretKind: "provider_api_key",
    maxTtlSeconds: 1800,
    renewable: false,
    requiresApproval: true,
    allowedActors: ["service_account:provider_adapter", "role:security_admin"],
    allowedPurposes: ["future_provider_api_call"],
    status: "future",
    metadata: { providerAdaptersDisabledByDefault: true }
  },
  {
    id: "lease_policy_future_mcp_tool_secret",
    secretKind: "future_mcp_tool_secret",
    maxTtlSeconds: 900,
    renewable: false,
    requiresApproval: true,
    allowedActors: ["service_account:mcp_gateway", "role:security_admin"],
    allowedPurposes: ["future_allowlisted_mcp_tool_call"],
    status: "future",
    metadata: { realTransportDisabledByDefault: true, toolRiskApprovalRequired: true }
  },
  {
    id: "lease_policy_future_local_agent_pairing_secret",
    secretKind: "future_local_agent_pairing_secret",
    maxTtlSeconds: 600,
    renewable: false,
    requiresApproval: true,
    allowedActors: ["service_account:local_agent_protocol", "role:security_admin"],
    allowedPurposes: ["future_local_agent_pairing"],
    status: "future",
    metadata: { realDaemonImplemented: false, consentRequired: true }
  },
  {
    id: "lease_policy_future_service_account_signing_key",
    secretKind: "future_service_account_signing_key",
    maxTtlSeconds: 300,
    renewable: false,
    requiresApproval: true,
    allowedActors: ["role:identity_admin", "role:security_admin"],
    allowedPurposes: ["future_service_account_token_issuance"],
    status: "future",
    metadata: { productionCredentialIssuanceImplemented: false }
  }
];

export const defaultAuthProviderOptions: AuthProviderOption[] = [
  {
    id: "auth_provider_oidc",
    providerKind: "oidc",
    displayName: "OpenID Connect",
    status: "recommended",
    supportsSso: true,
    supportsScim: false,
    supportsGroups: true,
    supportsServiceAccounts: false,
    supportsMfaSignals: true,
    supportsDeviceTrust: true,
    productionRecommended: true,
    operationalComplexity: "medium",
    notes: ["Preferred interactive SSO baseline when the enterprise IdP supports stable claims, groups, and JWKS rotation."],
    metadata: { realProviderImplemented: false, tokenValidationImplemented: false }
  },
  {
    id: "auth_provider_saml",
    providerKind: "saml",
    displayName: "SAML",
    status: "planned",
    supportsSso: true,
    supportsScim: false,
    supportsGroups: true,
    supportsServiceAccounts: false,
    supportsMfaSignals: true,
    supportsDeviceTrust: false,
    productionRecommended: true,
    operationalComplexity: "high",
    notes: ["Required for some enterprise IdPs; assertion validation and certificate rotation need a dedicated implementation task."],
    metadata: { assertionParsingImplemented: false, rawAssertionsStored: false }
  },
  {
    id: "auth_provider_scim",
    providerKind: "scim",
    displayName: "SCIM directory sync",
    status: "planned",
    supportsSso: false,
    supportsScim: true,
    supportsGroups: true,
    supportsServiceAccounts: false,
    supportsMfaSignals: false,
    supportsDeviceTrust: false,
    productionRecommended: true,
    operationalComplexity: "high",
    notes: ["Directory lifecycle sync for users, teams, and role assignments; complements OIDC or SAML."],
    metadata: { syncImplemented: false, deprovisioningRequired: true }
  },
  {
    id: "auth_provider_microsoft_entra",
    providerKind: "microsoft_entra",
    displayName: "Microsoft Entra ID",
    status: "planned",
    supportsSso: true,
    supportsScim: true,
    supportsGroups: true,
    supportsServiceAccounts: true,
    supportsMfaSignals: true,
    supportsDeviceTrust: true,
    productionRecommended: true,
    operationalComplexity: "medium",
    notes: ["Strong fit for Microsoft-centric enterprises through OIDC/SAML plus SCIM; no direct integration exists in v1 planning."],
    metadata: { externalCallsEnabled: false }
  },
  {
    id: "auth_provider_okta",
    providerKind: "okta",
    displayName: "Okta",
    status: "planned",
    supportsSso: true,
    supportsScim: true,
    supportsGroups: true,
    supportsServiceAccounts: true,
    supportsMfaSignals: true,
    supportsDeviceTrust: true,
    productionRecommended: true,
    operationalComplexity: "medium",
    notes: ["Common enterprise baseline through OIDC/SAML plus SCIM; no Okta API calls are implemented."],
    metadata: { externalCallsEnabled: false }
  },
  {
    id: "auth_provider_auth0",
    providerKind: "auth0",
    displayName: "Auth0",
    status: "planned",
    supportsSso: true,
    supportsScim: true,
    supportsGroups: true,
    supportsServiceAccounts: true,
    supportsMfaSignals: true,
    supportsDeviceTrust: false,
    productionRecommended: true,
    operationalComplexity: "medium",
    notes: ["Viable managed identity option through OIDC/SAML; production suitability depends on tenant operations and group mapping."],
    metadata: { externalCallsEnabled: false }
  },
  {
    id: "auth_provider_google_workspace",
    providerKind: "google_workspace",
    displayName: "Google Workspace",
    status: "planned",
    supportsSso: true,
    supportsScim: true,
    supportsGroups: true,
    supportsServiceAccounts: true,
    supportsMfaSignals: true,
    supportsDeviceTrust: true,
    productionRecommended: false,
    operationalComplexity: "medium",
    notes: ["Environment-dependent option; production design must avoid Google credential cache reads."],
    metadata: { credentialCachesRead: false, externalCallsEnabled: false }
  },
  {
    id: "auth_provider_github_enterprise",
    providerKind: "github_enterprise",
    displayName: "GitHub Enterprise identity mapping",
    status: "future",
    supportsSso: true,
    supportsScim: true,
    supportsGroups: true,
    supportsServiceAccounts: false,
    supportsMfaSignals: false,
    supportsDeviceTrust: false,
    productionRecommended: false,
    operationalComplexity: "high",
    notes: ["Useful for repo/org ownership mapping but not a full production auth replacement by itself."],
    metadata: { githubApiCallsImplemented: false }
  },
  {
    id: "auth_provider_custom",
    providerKind: "custom",
    displayName: "Custom enterprise IdP",
    status: "future",
    supportsSso: true,
    supportsScim: false,
    supportsGroups: true,
    supportsServiceAccounts: true,
    supportsMfaSignals: false,
    supportsDeviceTrust: false,
    productionRecommended: false,
    operationalComplexity: "high",
    notes: ["Future adapter option behind the same AuthProvider boundary after security review."],
    metadata: { adapterImplemented: false }
  },
  {
    id: "auth_provider_mock",
    providerKind: "mock",
    displayName: "MockAuthProvider",
    status: "not_recommended",
    supportsSso: false,
    supportsScim: false,
    supportsGroups: true,
    supportsServiceAccounts: true,
    supportsMfaSignals: false,
    supportsDeviceTrust: false,
    productionRecommended: false,
    operationalComplexity: "low",
    notes: ["Allowed for local and deterministic tests only. It is not production authentication."],
    metadata: { localOnly: true, productionBlocked: true }
  }
];

function productionAuthProviderConfig(input: {
  providerKind: ProductionAuthProviderConfig["providerKind"];
  status: ProductionAuthProviderConfig["status"];
  displayName: string;
  requiredConfig: string[];
  protocolFamily: string;
}): ProductionAuthProviderConfig {
  return {
    id: `production_auth_provider_${input.providerKind}`,
    providerKind: input.providerKind,
    status: input.status,
    displayName: input.displayName,
    issuerConfigured: false,
    audienceConfigured: false,
    jwksConfigured: false,
    metadataUrlConfigured: false,
    scimEndpointConfigured: false,
    groupMappingConfigured: false,
    tenantMappingConfigured: false,
    sessionBoundaryConfigured: false,
    tokenValidationEnabled: false,
    externalCallsEnabled: false,
    productionReady: false,
    metadata: {
      requiredConfig: input.requiredConfig,
      protocolFamily: input.protocolFamily,
      providerImplemented: input.providerKind === "mock",
      futureProviderImplemented: false,
      rawEnvValuesReturned: false,
      noTokenValidation: true,
      noSessionIssuance: true,
      noExternalCalls: true
    }
  };
}

export const defaultProductionAuthProviderConfigs: ProductionAuthProviderConfig[] = [
  productionAuthProviderConfig({ providerKind: "mock", status: "active_mock", displayName: "MockAuthProvider", requiredConfig: [], protocolFamily: "mock" }),
  productionAuthProviderConfig({ providerKind: "oidc_future", status: "future", displayName: "Disabled OIDC provider", requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE", "AICHESTRA_AUTH_OIDC_JWKS_URI"], protocolFamily: "oidc" }),
  productionAuthProviderConfig({ providerKind: "saml_future", status: "future", displayName: "Disabled SAML provider", requiredConfig: ["AICHESTRA_AUTH_SAML_METADATA_URL"], protocolFamily: "saml" }),
  productionAuthProviderConfig({ providerKind: "scim_future", status: "future", displayName: "Disabled SCIM directory provider", requiredConfig: ["AICHESTRA_AUTH_SCIM_ENDPOINT"], protocolFamily: "scim" }),
  productionAuthProviderConfig({ providerKind: "microsoft_entra_future", status: "future", displayName: "Disabled Microsoft Entra provider", requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE", "AICHESTRA_AUTH_OIDC_JWKS_URI", "AICHESTRA_AUTH_SCIM_ENDPOINT"], protocolFamily: "oidc_scim" }),
  productionAuthProviderConfig({ providerKind: "okta_future", status: "future", displayName: "Disabled Okta provider", requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE", "AICHESTRA_AUTH_OIDC_JWKS_URI", "AICHESTRA_AUTH_SCIM_ENDPOINT"], protocolFamily: "oidc_scim" }),
  productionAuthProviderConfig({ providerKind: "auth0_future", status: "future", displayName: "Disabled Auth0 provider", requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE", "AICHESTRA_AUTH_OIDC_JWKS_URI"], protocolFamily: "oidc" }),
  productionAuthProviderConfig({ providerKind: "google_workspace_future", status: "future", displayName: "Disabled Google Workspace provider", requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE", "AICHESTRA_AUTH_OIDC_JWKS_URI", "AICHESTRA_AUTH_SCIM_ENDPOINT"], protocolFamily: "oidc_scim" }),
  productionAuthProviderConfig({ providerKind: "github_enterprise_future", status: "future", displayName: "Disabled GitHub Enterprise identity provider", requiredConfig: ["AICHESTRA_AUTH_OIDC_ISSUER", "AICHESTRA_AUTH_OIDC_AUDIENCE"], protocolFamily: "oidc" }),
  productionAuthProviderConfig({ providerKind: "custom_future", status: "future", displayName: "Disabled custom production auth provider", requiredConfig: [], protocolFamily: "custom" })
];

function productionAuthProviderReadiness(config: ProductionAuthProviderConfig): ProductionAuthProviderReadiness {
  return {
    id: `readiness_${config.providerKind}`,
    providerKind: config.providerKind,
    status: config.providerKind === "mock" ? "ready_mock" : "future",
    requiredConfig: Array.isArray(config.metadata.requiredConfig) ? config.metadata.requiredConfig.filter((item): item is string => typeof item === "string") : [],
    missingConfig: [],
    warnings: config.providerKind === "mock"
      ? ["mock_provider_is_not_production_authentication"]
      : ["future_provider_disabled", "token_validation_enabled:false", "external_calls_enabled:false"],
    blockers: config.providerKind === "mock" ? ["production_auth_provider_not_implemented"] : [],
    metadata: {
      selected: config.providerKind === "mock",
      providerImplemented: config.providerKind === "mock",
      futureProviderImplemented: false,
      rawEnvValuesReturned: false,
      noTokenValidation: true,
      noSessionIssuance: true,
      noExternalCalls: true
    }
  };
}

export const defaultProductionAuthProviderReadiness: ProductionAuthProviderReadiness[] = defaultProductionAuthProviderConfigs.map(productionAuthProviderReadiness);

function sessionTokenBoundaryPlan(boundaryKind: SessionTokenBoundaryPlan["boundaryKind"], storageStrategy: string): SessionTokenBoundaryPlan {
  return {
    id: `session_token_boundary_${boundaryKind}`,
    boundaryKind,
    status: "future",
    tokenIssued: false,
    validationEnabled: false,
    storageStrategy,
    rotationStrategy: "future_rotation_design_required_before_any_token_material_exists",
    revocationStrategy: "future_revocation_design_required_before_any_session_or_token_is_issued",
    auditRequirements: [
      "auth_token_validation_attempt_future",
      "auth_session_created_future",
      "auth_session_revoked_future"
    ],
    metadata: {
      noTokenMaterialStored: true,
      noSessionCookieStored: true,
      noCredentialIssued: true,
      productionReady: false
    }
  };
}

export const defaultSessionTokenBoundaryPlans: SessionTokenBoundaryPlan[] = [
  sessionTokenBoundaryPlan("cookie_session_future", "HttpOnly server session with CSRF protection, tenant scope binding, and server-side revocation metadata."),
  sessionTokenBoundaryPlan("bearer_jwt_future", "JWT validation boundary only; signing, issuance, and trust configuration remain future work."),
  sessionTokenBoundaryPlan("api_key_future", "API key metadata boundary for future service-to-service access; no key material is issued."),
  sessionTokenBoundaryPlan("service_account_token_future", "Service-account credential lifecycle boundary; no JWTs, client secrets, or installation tokens are minted."),
  sessionTokenBoundaryPlan("local_agent_pairing_future", "Local Agent pairing token boundary; pairing remains consent metadata only.")
];

function identityMappingPlan(mappingKind: IdentityMappingPlan["mappingKind"], requiredClaims: string[], targetModel: string, risks: string[]): IdentityMappingPlan {
  return {
    id: `identity_mapping_${mappingKind}`,
    mappingKind,
    status: "future",
    requiredClaims,
    targetModel,
    risks,
    metadata: {
      externalClaimsParsed: false,
      tokenValidationRequiredFirst: true,
      productionReady: false
    }
  };
}

export const defaultIdentityMappingPlans: IdentityMappingPlan[] = [
  identityMappingPlan("subject_to_principal", ["sub", "iss"], "Principal", ["claim_stability_required", "duplicate_subject_collision"]),
  identityMappingPlan("group_to_team", ["groups"], "Team", ["group_overbreadth", "deprovisioning_delay"]),
  identityMappingPlan("role_claim_to_role", ["roles"], "RoleBinding", ["claim_spoofing_if_unvalidated", "role_drift"]),
  identityMappingPlan("tenant_claim_to_tenant_scope", ["tenant", "org"], "TenantScope", ["cross_tenant_claim_confusion"]),
  identityMappingPlan("repo_claim_to_repo_scope", ["repo", "repository"], "RepoScope", ["repo_rename_drift"]),
  identityMappingPlan("service_account_mapping", ["client_id", "service_account_id"], "ServiceAccount", ["credential_lifecycle_required"])
];

export const defaultAuthRbacMigrationPhases: AuthRbacMigrationPhase[] = [
  {
    id: "auth_phase_1_inventory",
    name: "Inventory actors, service strings, and request context gaps",
    order: 1,
    sourceMode: "mock_actor_strings",
    targetMode: "documented_request_context_contract",
    requiredPreconditions: ["Auth/RBAC v0 models exist", "audit source inventory exists"],
    migrationSteps: ["document service-specific actor strings", "identify API and worker boundaries that lack RequestContext", "record mock actor usage as readiness metadata"],
    validationChecks: ["no tokens or cookies collected", "no external IdP calls", "service-specific actor gaps documented"],
    rollbackPlan: ["keep existing mock actors and do not enable production auth gates"],
    status: "ready_for_design",
    metadata: { planningOnly: true }
  },
  {
    id: "auth_phase_2_provider_selection",
    name: "Select OIDC/SAML/SCIM production baseline",
    order: 2,
    sourceMode: "mock",
    targetMode: "oidc_or_saml_plus_scim",
    requiredPreconditions: ["tenant model agreed", "secret backend selected", "session strategy reviewed"],
    migrationSteps: ["choose OIDC or SAML for interactive auth", "choose SCIM for directory lifecycle when required", "define claim/group mapping"],
    validationChecks: ["IdP option selected", "groups map to teams or role bindings", "disabled principals fail closed"],
    rollbackPlan: ["keep MockAuthProvider local-only and leave production traffic disabled"],
    status: "planned",
    metadata: { realIdpImplemented: false }
  },
  {
    id: "auth_phase_3_tenant_scope",
    name: "Define tenant, team, project, and repo scoping",
    order: 3,
    sourceMode: "global_mock_scope",
    targetMode: "tenant_aware_policy_subjects_and_queries",
    requiredPreconditions: ["repository scope model", "policy subject scope fields", "dashboard filtering plan"],
    migrationSteps: ["add tenant/workspace/project/repo scope to request context", "require scope on policy resources", "plan tenant filters for dashboard and audit"],
    validationChecks: ["tenant scope appears in policy subjects", "audit queries are scope-aware", "SecretRef scopes are tenant-aware"],
    rollbackPlan: ["do not enable production profile until tenant filters are present"],
    status: "blocked",
    metadata: { multiTenancyImplemented: false }
  },
  {
    id: "auth_phase_4_service_accounts",
    name: "Harden service accounts and system actors",
    order: 4,
    sourceMode: "mock_service_actor_strings",
    targetMode: "scoped_service_account_principals",
    requiredPreconditions: ["real secret backend", "rotation plan", "role matrix reviewed"],
    migrationSteps: ["define service-account kinds", "bind allowed scopes and forbidden actions", "route credential resolution through service-account context"],
    validationChecks: ["no service account can bypass policy", "service-account usage audited", "no credentials stored in auth repositories"],
    rollbackPlan: ["disable live integration gates instead of issuing broad service credentials"],
    status: "planned",
    metadata: { credentialIssuanceImplemented: false }
  },
  {
    id: "auth_phase_5_mock_actor_deprecation",
    name: "Disable mock actor behavior for staging and production",
    order: 5,
    sourceMode: "mock_header_actor_override",
    targetMode: "production_auth_required",
    requiredPreconditions: ["production AuthProvider implemented", "tenant filters implemented", "break-glass design approved"],
    migrationSteps: ["warn in local and integration", "block mock header actor overrides in staging/production", "fail production health when production auth is absent"],
    validationChecks: ["production profile reports mock actor blocked", "dashboard warning visible", "tests prove no login/session endpoint exists in planning v1"],
    rollbackPlan: ["return to local/integration profile only; do not accept production traffic"],
    status: "blocked",
    metadata: { productionAuthImplemented: false }
  }
];

export const defaultAuthRbacReadinessChecks: AuthRbacReadinessCheck[] = [
  {
    id: "auth_identity_provider_required",
    category: "identity_provider",
    name: "Production IdP implementation required",
    status: "fail",
    severity: "critical",
    description: "OIDC or SAML is not implemented, and MockAuthProvider is not production auth.",
    remediation: "Select and implement a gated production AuthProvider in a future explicit task.",
    evidence: ["docs/roadmaps/auth-rbac-production/idp-options-v1.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "auth_group_sync_required",
    category: "group_sync",
    name: "Group and SCIM sync are not implemented",
    status: "warning",
    severity: "high",
    description: "Team and role-binding lifecycle is seeded locally; directory sync and deprovisioning remain future work.",
    remediation: "Add SCIM or equivalent directory ingestion with idempotent deprovisioning before production.",
    evidence: ["docs/roadmaps/auth-rbac-production/idp-options-v1.md"],
    metadata: { scimImplemented: false }
  },
  {
    id: "auth_role_mapping_matrix_defined",
    category: "role_mapping",
    name: "Production permission matrix documented",
    status: "pass",
    severity: "high",
    description: "Production roles, allowed/denied actions, scopes, audit requirements, and future work are documented.",
    remediation: "Review matrix with security owners before implementation.",
    evidence: ["docs/reference/production-rbac-permission-matrix.md"],
    metadata: { matrixReadModelAvailable: true }
  },
  {
    id: "auth_tenant_isolation_required",
    category: "tenant_isolation",
    name: "Tenant isolation remains unimplemented",
    status: "fail",
    severity: "critical",
    description: "Repositories, dashboard read models, audit queries, provider gates, and SecretRef scopes are not production tenant-filtered.",
    remediation: "Implement tenant/workspace/project/repo scoping before production auth is enabled.",
    evidence: ["docs/roadmaps/auth-rbac-production/tenant-scope-model-v1.md"],
    metadata: { tenantIsolationImplemented: false }
  },
  {
    id: "auth_service_account_plan_defined",
    category: "service_accounts",
    name: "Service account plan defined, credential issuance future",
    status: "warning",
    severity: "high",
    description: "Service account categories and scopes are planned; production credential issuance and rotation are not implemented.",
    remediation: "Implement service-account credential issuance only after real secret backend and policy bundle controls exist.",
    evidence: ["docs/roadmaps/auth-rbac-production/service-account-system-actor-v1.md"],
    metadata: { credentialIssuanceImplemented: false }
  },
  {
    id: "auth_local_agent_identity_required",
    category: "local_agent_identity",
    name: "Local Agent user/device identity is future work",
    status: "warning",
    severity: "high",
    description: "Local Agent Protocol v1 has mock sessions and consent metadata but no production user/device trust.",
    remediation: "Bind Local Agent registration and consent to production principal, device, and tenant identity in a future task.",
    evidence: ["docs/features/local-agent-protocol/v1.md"],
    metadata: { realDaemonIdentityImplemented: false }
  },
  {
    id: "auth_webhook_identity_required",
    category: "webhook_identity",
    name: "Webhook actors require scoped service identity",
    status: "warning",
    severity: "high",
    description: "GitHub webhook processing uses system/service actor strings and must become scoped service accounts before production webhooks.",
    remediation: "Use a git_webhook service account with repo-scoped permissions and policy checks before live webhook processing.",
    evidence: ["docs/roadmaps/github-app-production-webhook-hardening/v0.md"],
    metadata: { productionWebhooksEnabled: false }
  },
  {
    id: "auth_request_context_partial",
    category: "request_context",
    name: "Request context propagation is partial",
    status: "warning",
    severity: "high",
    description: "RequestContextResolver exists, but many service methods still accept ad hoc actor strings or synthesize system actors.",
    remediation: "Adopt RequestContext across API, worker, webhook, credential, Local Agent, and dashboard read boundaries.",
    evidence: ["docs/roadmaps/auth-rbac-production/request-context-propagation-v1.md"],
    metadata: { propagationStatus: "partial_mock_only" }
  },
  {
    id: "auth_audit_attribution_metadata_only",
    category: "audit_attribution",
    name: "Audit attribution model is metadata-only",
    status: "pass",
    severity: "high",
    description: "Auth/RBAC audit events carry actor/principal/request metadata and do not store tokens, cookies, passwords, or assertions.",
    remediation: "Add tenant and service-account scope to future audit records without raw identity assertions.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { tokensStored: false, rawAssertionsStored: false }
  },
  {
    id: "auth_mock_actor_deprecation_required",
    category: "mock_actor_deprecation",
    name: "Mock actor must be disabled for production",
    status: "fail",
    severity: "critical",
    description: "MockAuthProvider and header actor override remain available for local/test flows and must not be accepted in production.",
    remediation: "Add production profile rejection of mock auth/header actor overrides after real auth is implemented.",
    evidence: ["docs/roadmaps/auth-rbac-production/mock-actor-deprecation-v1.md"],
    metadata: { productionBlocker: true }
  },
  {
    id: "auth_policy_subject_scope_gap",
    category: "policy_subject_mapping",
    name: "PolicySubject lacks production tenant mapping",
    status: "warning",
    severity: "high",
    description: "AuthContext maps actor/principal/roles/teams/auth mode today; tenant/org/project scope remains future.",
    remediation: "Add tenant scope to AuthContext, PolicySubject, and PolicyResource once tenant model is approved.",
    evidence: ["docs/foundations/auth-rbac/v0.md", "docs/features/policy-as-code/v0.md"],
    metadata: { tenantPolicyMappingImplemented: false }
  },
  {
    id: "auth_dashboard_visibility_available",
    category: "dashboard_visibility",
    name: "Auth production readiness dashboard panel available",
    status: "pass",
    severity: "medium",
    description: "Dashboard exposes production Auth/RBAC readiness without tokens, cookies, sessions, passwords, or assertions.",
    remediation: "Keep dashboard read-only and add tenant filtering before production use.",
    evidence: ["docs/features/dashboard/v0.md"],
    metadata: { dashboardReadOnly: true }
  },
  {
    id: "auth_break_glass_future_only",
    category: "break_glass",
    name: "Break-glass is future-only",
    status: "warning",
    severity: "critical",
    description: "Break-glass admin is documented as a future role and is not implemented.",
    remediation: "Design audited break-glass with time-bound approval, SecretRef controls, and external audit before production.",
    evidence: ["docs/reference/production-rbac-permission-matrix.md"],
    metadata: { breakGlassImplemented: false }
  }
];

export const defaultAuthRbacProductionRisks: AuthRbacProductionRisk[] = [
  {
    id: "auth_risk_mock_actor_production",
    category: "mock_actor_deprecation",
    title: "Mock actor accepted in production",
    severity: "critical",
    likelihood: "medium",
    impact: "Requests could be attributed to local/demo actors rather than verified enterprise identities.",
    mitigation: "Reject MockAuthProvider and header actor override in staging/production after real AuthProvider implementation.",
    status: "open",
    metadata: { productionBlocker: true }
  },
  {
    id: "auth_risk_tenant_data_leakage",
    category: "tenant_isolation",
    title: "Dashboard or audit read models lack tenant filtering",
    severity: "critical",
    likelihood: "medium",
    impact: "Cross-tenant tasks, audit events, provider metadata, or SecretRef metadata could become visible.",
    mitigation: "Add tenant scope to repositories, policy subjects/resources, dashboard DTOs, and audit queries before production.",
    status: "open",
    metadata: { tenantFilteringImplemented: false }
  },
  {
    id: "auth_risk_service_account_sprawl",
    category: "service_accounts",
    title: "Service accounts gain broad scopes",
    severity: "high",
    likelihood: "medium",
    impact: "Internal automation could resolve credentials or trigger provider operations beyond its intended scope.",
    mitigation: "Use scoped service-account role bindings, explicit allowed/forbidden action lists, rotation, and audit.",
    status: "open",
    metadata: { broadCredentialsIssued: false }
  },
  {
    id: "auth_risk_context_drift",
    category: "request_context",
    title: "Service boundaries keep ad hoc actor strings",
    severity: "high",
    likelihood: "high",
    impact: "Audit attribution and policy decisions may lose request, correlation, tenant, or principal context.",
    mitigation: "Propagate RequestContext through API, worker, webhook, Git, LLM, MCP, Runner, Local Agent, Security, and Dashboard boundaries.",
    status: "open",
    metadata: { propagationStatus: "partial_mock_only" }
  },
  {
    id: "auth_risk_assertion_exposure",
    category: "identity_provider",
    title: "Raw identity assertions exposed in audit or dashboard",
    severity: "critical",
    likelihood: "low",
    impact: "OIDC/SAML/SCIM tokens or assertions could leak through logs, DTOs, or read models.",
    mitigation: "Store only sanitized claims and metadata, never raw assertions, cookies, sessions, JWTs, or provider credentials.",
    status: "open",
    metadata: { rawAssertionsStored: false }
  }
];

export const defaultTenantBoundaryPlans: TenantBoundaryPlan[] = [
  {
    id: "tenant_boundary_organization",
    tenantKind: "organization",
    description: "Top-level production tenant boundary for enterprise customers or internal organizations.",
    isolationRequirements: ["all persistent records carry tenant id", "audit queries filter by tenant", "SecretRefs are tenant-scoped"],
    dataAccessRules: ["dashboard and APIs return only authorized tenant data", "cross-tenant reads require future audited break-glass"],
    providerAccessRules: ["Git, LLM, MCP, and provider credentials must be tenant allowlisted"],
    secretAccessRules: ["secret leases require tenant-scoped SecretRef and purpose"],
    auditRequirements: ["actor, principal, tenant, request id, correlation id, and policy decision id recorded"],
    status: "not_ready",
    metadata: { implemented: false }
  },
  {
    id: "tenant_boundary_workspace",
    tenantKind: "workspace",
    description: "Workspace boundary for teams of repositories, tasks, models, and registry packages.",
    isolationRequirements: ["workspace id propagates through RequestContext", "workspace limits apply to model budgets"],
    dataAccessRules: ["tasks, runs, usage, and dashboard panels filter by workspace"],
    providerAccessRules: ["provider route allowlists can be workspace-specific"],
    secretAccessRules: ["workspace SecretRefs require owner approval and audit"],
    auditRequirements: ["workspace id included in auth, policy, provider, and credential audit"],
    status: "future",
    metadata: { schemaImplemented: false }
  },
  {
    id: "tenant_boundary_project",
    tenantKind: "project",
    description: "Project boundary for task, registry, improvement, and Local Agent consent grouping.",
    isolationRequirements: ["project membership and role bindings are explicit"],
    dataAccessRules: ["project-scoped users read only project tasks, registry refs, and audit"],
    providerAccessRules: ["LLM virtual keys and MCP allowlists can be project-scoped"],
    secretAccessRules: ["project-specific provider credentials are separate SecretRefs"],
    auditRequirements: ["project id included when available"],
    status: "future",
    metadata: { planningOnly: true }
  },
  {
    id: "tenant_boundary_team",
    tenantKind: "team",
    description: "Team boundary for group/SCIM role binding and approval ownership.",
    isolationRequirements: ["IdP groups map deterministically to teams or role bindings"],
    dataAccessRules: ["team membership drives scoped role checks"],
    providerAccessRules: ["team-level provider access requires least privilege"],
    secretAccessRules: ["security team approves secret lease/rotation metadata"],
    auditRequirements: ["team ids recorded in AuthContext and audit envelopes"],
    status: "planned",
    metadata: { seededTeamsAvailable: true, scimSyncImplemented: false }
  },
  {
    id: "tenant_boundary_repo_scope",
    tenantKind: "repo_scope",
    description: "Repository boundary for Git operations, webhooks, branch/PR read models, and repo-linked tasks.",
    isolationRequirements: ["repo allowlist is tied to tenant/workspace/project"],
    dataAccessRules: ["repo metadata and PR sync states filter by repo scope"],
    providerAccessRules: ["GitHub App repository grants and webhook actors are repo-scoped"],
    secretAccessRules: ["GitHub token/App installation SecretRefs are repo or installation scoped"],
    auditRequirements: ["repo id/provider id included in Git, webhook, credential, and auth audit"],
    status: "planned",
    metadata: { githubAppPlanningAvailable: true }
  }
];

export const defaultServiceAccountPlans: ServiceAccountPlan[] = [
  {
    id: "service_account_worker",
    serviceAccountKind: "worker",
    requiredScopes: ["task", "task_run", "workspace"],
    allowedActions: ["task.run", "runner.execute", "llm.completion", "git.branch.create"],
    forbiddenActions: ["secret.read", "git.merge", "git.rebase", "runner.command.execute.unbounded"],
    credentialStrategy: "future backend-backed service account credential; none issued in v1 planning",
    rotationStrategy: "future scheduled rotation through real secret backend",
    auditRequirements: ["service_account_used", "authorization_allowed", "authorization_denied"],
    status: "planned",
    metadata: { credentialsIssued: false }
  },
  {
    id: "service_account_git_webhook",
    serviceAccountKind: "git_webhook",
    requiredScopes: ["repo", "git_webhook_delivery"],
    allowedActions: ["git.webhook.process", "git.repo.read"],
    forbiddenActions: ["git.merge", "git.rebase", "git.remote_operation.write", "secret.read"],
    credentialStrategy: "GitHub webhook secret through SecretRef; no raw value in auth repositories",
    rotationStrategy: "future webhook secret rotation through secret backend and deployment rollout",
    auditRequirements: ["service_account_used", "git_webhook_duplicate_rejected", "authorization_denied"],
    status: "planned",
    metadata: { productionWebhookEnabled: false }
  },
  {
    id: "service_account_git_provider",
    serviceAccountKind: "git_provider",
    requiredScopes: ["repo", "provider", "installation"],
    allowedActions: ["git.repo.read", "git.branch.create", "git.pull_request.create", "provider.credential.resolve"],
    forbiddenActions: ["git.merge", "git.rebase", "git.force_push", "git.branch.delete"],
    credentialStrategy: "future GitHub App installation token via SecretRef-backed private key, not implemented",
    rotationStrategy: "short-lived installation tokens only in future implementation",
    auditRequirements: ["service_account_used", "provider.credential.resolve", "git.audit.read"],
    status: "future",
    metadata: { installationTokenExchangeImplemented: false }
  },
  {
    id: "service_account_llm_gateway",
    serviceAccountKind: "llm_gateway",
    requiredScopes: ["provider", "model", "budget", "tenant"],
    allowedActions: ["llm.completion", "llm.model.use", "llm.route.select", "llm.credential.resolve"],
    forbiddenActions: ["credential.cache.read", "local_cli.invoke.direct", "secret.read"],
    credentialStrategy: "backend-backed LLM API key SecretRefs in future; env fallback local/integration only",
    rotationStrategy: "manual then provider-managed future rotation",
    auditRequirements: ["service_account_used", "llm.audit.read", "authorization_denied"],
    status: "planned",
    metadata: { remoteProviderCallsDefault: false }
  },
  {
    id: "service_account_mcp_gateway",
    serviceAccountKind: "mcp_gateway",
    requiredScopes: ["mcp_server", "mcp_tool", "tenant"],
    allowedActions: ["mcp.server.list", "mcp.tool.invoke.low_risk"],
    forbiddenActions: ["mcp.tool.invoke.high_risk", "mcp.tool.invoke.critical", "secret.read", "network.egress.unbounded"],
    credentialStrategy: "no MCP tool secret forwarding in v1 planning",
    rotationStrategy: "future only after real MCP transport design",
    auditRequirements: ["service_account_used", "mcp audit event", "policy decision id"],
    status: "future",
    metadata: { realTransportEnabled: false }
  },
  {
    id: "service_account_local_agent_protocol",
    serviceAccountKind: "local_agent_protocol",
    requiredScopes: ["local_agent", "host", "user", "tenant"],
    allowedActions: ["local_agent.invoke", "local_agent.consent.approve"],
    forbiddenActions: ["local_agent.secret.forward", "credential.cache.read", "pty.invoke", "vendor_cli.execute"],
    credentialStrategy: "future pairing secret through backend SecretRef; no real daemon credentials in v1 planning",
    rotationStrategy: "future pairing revocation and channel rotation",
    auditRequirements: ["service_account_used", "local_agent protocol audit", "consent decision id"],
    status: "future",
    metadata: { realDaemonImplemented: false }
  },
  {
    id: "service_account_deployment",
    serviceAccountKind: "deployment",
    requiredScopes: ["migration", "release", "environment"],
    allowedActions: ["readiness.read"],
    forbiddenActions: ["kubectl.apply", "vault.write", "database.migrate.auto", "secret.read"],
    credentialStrategy: "future release service identity; no cloud or Kubernetes integration in v1 planning",
    rotationStrategy: "future release credential rotation through backend",
    auditRequirements: ["deployment readiness audit", "migration approval audit"],
    status: "future",
    metadata: { infraIntegrationImplemented: false }
  },
  {
    id: "service_account_observability_export",
    serviceAccountKind: "observability_export",
    requiredScopes: ["audit_export", "tenant", "retention_class"],
    allowedActions: ["observability.audit.read"],
    forbiddenActions: ["secret.read", "raw_prompt.read", "raw_webhook_payload.read"],
    credentialStrategy: "future export credential through real secret backend after audit export design",
    rotationStrategy: "future controlled rotation with export checkpoint review",
    auditRequirements: ["export checkpoint id", "tenant id", "retention class", "legal review status"],
    status: "future",
    metadata: { externalExportEnabled: false }
  }
];

export const defaultAuthRbacPermissionMatrix: AuthRbacPermissionMatrixEntry[] = [
  {
    id: "rbac_role_viewer",
    roleName: "viewer",
    purpose: "Read-only dashboard and low-risk metadata access.",
    allowedActions: ["dashboard.read", "registry.read", "mcp.server.list", "mcp.tool.list", "readiness.read"],
    deniedActions: ["task.run", "provider.credential.resolve", "secret.read", "git.remote_operation", "llm.remote_completion", "runner.command.execute"],
    requiredScopes: ["tenant", "workspace", "project"],
    riskLevel: "low",
    productionDefault: "allow",
    auditRequirement: "metadata reads logged when audit policy requires it; no raw secrets or sessions.",
    currentImplementationStatus: "partial_mock",
    futureWork: ["tenant-scoped dashboard filtering"],
    metadata: { noSecretAccess: true }
  },
  {
    id: "rbac_role_developer",
    roleName: "developer",
    purpose: "Create and run mock/local-safe development workflows.",
    allowedActions: ["task.create", "task.run", "git.repo.read", "git.branch.create", "git.pull_request.create", "llm.completion", "llm.model.use", "runner.execute", "mcp.tool.invoke.low_risk"],
    deniedActions: ["secret.read", "git.merge", "git.rebase", "git.force_push", "mcp.tool.invoke.high_risk", "improvement.apply"],
    requiredScopes: ["tenant", "workspace", "project", "repo_scope"],
    riskLevel: "medium",
    productionDefault: "allow",
    auditRequirement: "task, Git, LLM, Runner, and MCP actions audit actor/principal/scope.",
    currentImplementationStatus: "partial_mock",
    futureWork: ["production tenant scoping", "real auth provider mapping"],
    metadata: { policyStillAuthoritative: true }
  },
  {
    id: "rbac_role_reviewer",
    roleName: "reviewer",
    purpose: "Review registry and improvement governance metadata.",
    allowedActions: ["registry.read", "registry.approve", "improvement.proposal.approve", "improvement.eval.attach", "git.repo.read", "mcp.audit.read"],
    deniedActions: ["improvement.apply", "secret.read", "provider.credential.resolve", "git.merge", "runner.command.execute"],
    requiredScopes: ["tenant", "workspace", "project", "registry"],
    riskLevel: "high",
    productionDefault: "allow",
    auditRequirement: "approval and governance decisions require actor, principal, request id, and policy decision id.",
    currentImplementationStatus: "partial_mock",
    futureWork: ["production approval workflow", "tenant-scoped registry repositories"],
    metadata: { applyDeniedByPolicy: true }
  },
  {
    id: "rbac_role_security_admin",
    roleName: "security_admin",
    purpose: "Manage security metadata, audits, SecretRef review, and policy visibility without raw secret access.",
    allowedActions: ["auth.read", "auth.authorize.check", "security.audit.read", "policy.audit.read", "observability.audit.read", "secret.lease.request", "provider.credential.resolve"],
    deniedActions: ["secret.read", "credential.cache.read", "raw_identity_assertion.read", "runner.secret.inject"],
    requiredScopes: ["tenant", "security", "provider", "secret_ref"],
    riskLevel: "critical",
    productionDefault: "allow",
    auditRequirement: "all security admin actions are security retention class and never include raw credentials.",
    currentImplementationStatus: "partial_mock",
    futureWork: ["real IdP role mapping", "break-glass workflow", "tenant-scoped audit queries"],
    metadata: { rawSecretAccessAllowed: false }
  },
  {
    id: "rbac_role_platform_admin",
    roleName: "platform_admin",
    purpose: "Operate platform metadata and integration gates while still obeying policy.",
    allowedActions: ["auth.read", "auth.authorize.check", "registry.create", "registry.update", "policy.evaluate", "readiness.read", "git.remote_operation", "llm.remote_completion"],
    deniedActions: ["secret.read", "git.merge", "git.rebase", "git.force_push", "improvement.apply", "production_auth.enable_without_idp"],
    requiredScopes: ["tenant", "platform"],
    riskLevel: "critical",
    productionDefault: "future_review",
    auditRequirement: "platform changes require actor/principal/scope and policy decision audit.",
    currentImplementationStatus: "partial_mock",
    futureWork: ["production admin workflow", "managed policy bundle review"],
    metadata: { policyStillAuthoritative: true }
  },
  {
    id: "rbac_role_system_admin",
    roleName: "system_admin",
    purpose: "Local mock system role; not a production standing role.",
    allowedActions: ["local_mock_admin_only"],
    deniedActions: ["production_auth", "secret.read", "git.force_push", "credential.cache.read"],
    requiredScopes: ["local"],
    riskLevel: "critical",
    productionDefault: "deny",
    auditRequirement: "mock actor usage warning in local/integration only.",
    currentImplementationStatus: "implemented_mock",
    futureWork: ["remove from production profile", "replace with scoped service accounts and break-glass future"],
    metadata: { productionBlocked: true }
  },
  {
    id: "rbac_role_service_account_runner",
    roleName: "service_account_runner",
    purpose: "Scoped worker/runner automation.",
    allowedActions: ["task.run", "runner.execute", "llm.completion", "git.branch.create"],
    deniedActions: ["secret.read", "runner.command.execute.unbounded", "git.merge", "provider.credential.resolve.broad"],
    requiredScopes: ["task", "task_run", "workspace"],
    riskLevel: "high",
    productionDefault: "future_review",
    auditRequirement: "service_account_used and authorization events required for every invocation.",
    currentImplementationStatus: "partial_mock",
    futureWork: ["credential issuance and rotation", "tenant scoped task queue"],
    metadata: { credentialsIssued: false }
  },
  {
    id: "rbac_role_git_webhook_service",
    roleName: "git_webhook_service",
    purpose: "Process verified webhook metadata and update read models.",
    allowedActions: ["git.webhook.process", "git.repo.read"],
    deniedActions: ["git.merge", "git.rebase", "git.force_push", "git.branch.delete", "runner.execute"],
    requiredScopes: ["repo_scope", "webhook_delivery"],
    riskLevel: "high",
    productionDefault: "future_review",
    auditRequirement: "delivery id, repo id, actor, and policy decision id recorded.",
    currentImplementationStatus: "planned",
    futureWork: ["GitHub App live integration", "durable replay store", "service account credential strategy"],
    metadata: { productionWebhooksEnabled: false }
  },
  {
    id: "rbac_role_llm_gateway_service",
    roleName: "llm_gateway_service",
    purpose: "Route model usage and resolve LLM credentials for narrow purposes.",
    allowedActions: ["llm.completion", "llm.model.use", "llm.route.select", "llm.credential.resolve"],
    deniedActions: ["secret.read", "credential.cache.read", "local_cli.invoke.direct"],
    requiredScopes: ["tenant", "provider", "model", "budget"],
    riskLevel: "high",
    productionDefault: "future_review",
    auditRequirement: "usage, budget, provider, model, actor, and policy decision audit required.",
    currentImplementationStatus: "planned",
    futureWork: ["tenant budgets", "backend SecretRef migration", "provider data-retention review"],
    metadata: { remoteLlmDefault: false }
  },
  {
    id: "rbac_role_mcp_gateway_service",
    roleName: "mcp_gateway_service",
    purpose: "Govern MCP server/tool metadata and future tool invocations.",
    allowedActions: ["mcp.server.list", "mcp.tool.list", "mcp.tool.invoke.low_risk"],
    deniedActions: ["mcp.tool.invoke.high_risk", "mcp.tool.invoke.critical", "secret.read", "network.egress.unbounded"],
    requiredScopes: ["tenant", "mcp_server", "mcp_tool"],
    riskLevel: "critical",
    productionDefault: "future_review",
    auditRequirement: "tool risk, input/output redaction, actor, scope, and policy decision audit required.",
    currentImplementationStatus: "planned",
    futureWork: ["real MCP transport governance", "tool allowlists", "tenant scoping"],
    metadata: { realTransportEnabled: false }
  },
  {
    id: "rbac_role_local_agent_user",
    roleName: "local_agent_user",
    purpose: "Own and consent to Local Agent invocations on a paired user machine.",
    allowedActions: ["local_agent.invoke", "local_agent.consent.approve"],
    deniedActions: ["local_agent.secret.forward", "credential.cache.read", "pty.invoke", "vendor_cli.execute.unbounded"],
    requiredScopes: ["user", "host", "local_agent", "tenant"],
    riskLevel: "high",
    productionDefault: "future_review",
    auditRequirement: "consent id, host id, user principal id, and policy decision id recorded.",
    currentImplementationStatus: "planned",
    futureWork: ["real daemon identity", "device trust", "consent UX"],
    metadata: { realDaemonImplemented: false }
  },
  {
    id: "rbac_role_local_agent_admin",
    roleName: "local_agent_admin",
    purpose: "Administer Local Agent enrollment and revocation metadata.",
    allowedActions: ["local_agent.register", "local_agent.revoke", "local_agent.audit.read"],
    deniedActions: ["credential.cache.read", "vendor_cli.execute", "local_agent.secret.forward"],
    requiredScopes: ["tenant", "user", "host"],
    riskLevel: "critical",
    productionDefault: "future_review",
    auditRequirement: "registration, revoke, and compatibility changes audited.",
    currentImplementationStatus: "planned",
    futureWork: ["device trust policy", "tenant-scoped enrollment"],
    metadata: { productionDeviceTrustImplemented: false }
  },
  {
    id: "rbac_role_audit_reader",
    roleName: "audit_reader",
    purpose: "Read sanitized audit and readiness metadata.",
    allowedActions: ["observability.audit.read", "git.audit.read", "llm.audit.read", "policy.audit.read", "security.audit.read", "mcp.audit.read", "readiness.read"],
    deniedActions: ["raw_prompt.read", "raw_webhook_payload.read", "secret.read", "identity_assertion.read"],
    requiredScopes: ["tenant", "retention_class"],
    riskLevel: "high",
    productionDefault: "future_review",
    auditRequirement: "audit reads are themselves audited when production audit export exists.",
    currentImplementationStatus: "planned",
    futureWork: ["tenant-scoped audit queries", "legal hold and export controls"],
    metadata: { rawPayloadAccessAllowed: false }
  },
  {
    id: "rbac_role_break_glass_admin_future",
    roleName: "break_glass_admin_future",
    purpose: "Future emergency role only; not implemented or enabled.",
    allowedActions: [],
    deniedActions: ["all_current_runtime_actions"],
    requiredScopes: ["future_time_bound_incident"],
    riskLevel: "critical",
    productionDefault: "deny",
    auditRequirement: "future explicit legal/security review, time-bound approval, and external audit checkpoint.",
    currentImplementationStatus: "future_only",
    futureWork: ["break-glass design", "approval workflow", "secret backend integration", "audit export"],
    metadata: { implemented: false }
  }
];

export const defaultPolicyEngineOptions: PolicyEngineOption[] = [
  {
    id: "policy_engine_static_typescript_current",
    engineKind: "static_typescript_current",
    displayName: "Current Static TypeScript Policy Engine",
    status: "current",
    supportsPartialEvaluation: false,
    supportsSignedBundles: false,
    supportsDecisionLogs: true,
    supportsPolicyTests: true,
    supportsHumanReadableReview: false,
    supportsResourceHierarchy: false,
    supportsTenantIsolation: false,
    operationalComplexity: "low",
    productionRecommended: false,
    notes: ["Deterministic and safe for the current milestone", "Policy changes require code review and release", "Insufficient for production bundle governance"],
    metadata: { runtimeImplemented: true, externalEngineCalls: false, dynamicPolicyExecution: false }
  },
  {
    id: "policy_engine_signed_json_yaml_bundle",
    engineKind: "signed_json_yaml_bundle",
    displayName: "Signed JSON/YAML Policy Bundle",
    status: "recommended",
    supportsPartialEvaluation: false,
    supportsSignedBundles: true,
    supportsDecisionLogs: true,
    supportsPolicyTests: true,
    supportsHumanReadableReview: true,
    supportsResourceHierarchy: true,
    supportsTenantIsolation: true,
    operationalComplexity: "medium",
    productionRecommended: true,
    notes: ["Recommended near-term bridge before adopting a full policy language", "Keeps bundle review explicit and schema-driven", "Signing verification remains future work"],
    metadata: { runtimeImplemented: false, signingVerificationImplemented: false, recommendedNearTerm: true }
  },
  {
    id: "policy_engine_opa_rego",
    engineKind: "opa_rego",
    displayName: "OPA/Rego",
    status: "planned",
    supportsPartialEvaluation: true,
    supportsSignedBundles: true,
    supportsDecisionLogs: true,
    supportsPolicyTests: true,
    supportsHumanReadableReview: false,
    supportsResourceHierarchy: true,
    supportsTenantIsolation: true,
    operationalComplexity: "high",
    productionRecommended: true,
    notes: ["Strong ecosystem for policy-as-code and bundle distribution", "Requires strict input schemas and operational ownership", "No runtime integration in v0"],
    metadata: { runtimeImplemented: false, wasmPolicyExecutionEnabled: false, externalServiceCalls: false }
  },
  {
    id: "policy_engine_cedar",
    engineKind: "cedar",
    displayName: "Cedar",
    status: "future",
    supportsPartialEvaluation: false,
    supportsSignedBundles: false,
    supportsDecisionLogs: true,
    supportsPolicyTests: true,
    supportsHumanReadableReview: true,
    supportsResourceHierarchy: true,
    supportsTenantIsolation: true,
    operationalComplexity: "medium",
    productionRecommended: false,
    notes: ["Good fit for authorization-style resource policies", "Needs evaluation against operational gates such as runner, MCP, and provider controls", "No runtime integration in v0"],
    metadata: { runtimeImplemented: false, cedarPoliciesLoaded: false }
  },
  {
    id: "policy_engine_custom_future",
    engineKind: "custom_future",
    displayName: "Custom Future Policy Service",
    status: "not_recommended",
    supportsPartialEvaluation: false,
    supportsSignedBundles: false,
    supportsDecisionLogs: true,
    supportsPolicyTests: true,
    supportsHumanReadableReview: false,
    supportsResourceHierarchy: true,
    supportsTenantIsolation: true,
    operationalComplexity: "high",
    productionRecommended: false,
    notes: ["Only appropriate if OPA, Cedar, and schema bundles cannot satisfy requirements", "Would create significant operational surface area"],
    metadata: { externalDecisionServiceImplemented: false }
  }
];

export const defaultPolicyBundlePlans: PolicyBundlePlan[] = [
  {
    id: "policy_bundle_static_typescript_legacy",
    name: "Static TypeScript legacy rule catalog",
    bundleKind: "static_typescript_legacy",
    status: "ready_for_design",
    targetDomains: ["git", "git_webhook", "llm", "mcp", "runner", "registry", "improvement", "secretref", "secrets_sandbox", "local_agent", "provider", "auth", "dashboard", "deployment_readiness"],
    versioningStrategy: "code release version only",
    signingStrategy: "none in current runtime",
    reviewStrategy: "standard code review",
    rolloutStrategy: "application release only",
    rollbackStrategy: "application rollback only",
    testStrategy: "deterministic TypeScript unit and API regression tests",
    metadata: { currentRuntime: true, productionReady: false }
  },
  {
    id: "policy_bundle_schema_bridge",
    name: "Schema-driven JSON/YAML policy bundle bridge",
    bundleKind: "json_yaml_policy_bundle",
    status: "planned",
    targetDomains: ["git", "git_webhook", "llm", "mcp", "runner", "secretref", "secrets_sandbox", "local_agent", "provider"],
    versioningStrategy: "semantic bundle version plus compatibility version",
    signingStrategy: "future offline signature metadata and verification checkpoint",
    reviewStrategy: "policy author, domain owner, and security approver separation",
    rolloutStrategy: "future dry-run, shadow evaluation, then staged activation",
    rollbackStrategy: "previous approved bundle id retained for manual rollback",
    testStrategy: "golden decisions, deny-by-default regressions, tenant and secret exposure tests",
    metadata: { recommendedNearTerm: true, parserImplemented: false, executionImplemented: false }
  },
  {
    id: "policy_bundle_opa_future",
    name: "OPA/Rego bundle candidate",
    bundleKind: "opa_bundle",
    status: "future",
    targetDomains: ["git", "llm", "mcp", "runner", "secretref", "provider"],
    versioningStrategy: "OPA bundle revision plus Aichestra compatibility metadata",
    signingStrategy: "future signed bundle transport and offline verification",
    reviewStrategy: "Rego review with generated decision examples",
    rolloutStrategy: "future sidecar/service or embedded evaluator after explicit design",
    rollbackStrategy: "pin previous signed OPA bundle revision",
    testStrategy: "Rego unit tests plus Aichestra golden decision fixtures",
    metadata: { opaRuntimeImplemented: false, externalOpaServiceCalls: false }
  },
  {
    id: "policy_bundle_cedar_future",
    name: "Cedar policy set candidate",
    bundleKind: "cedar_policy_set",
    status: "future",
    targetDomains: ["auth", "dashboard", "registry", "secretref", "local_agent"],
    versioningStrategy: "Cedar policy set version plus schema version",
    signingStrategy: "future signature metadata",
    reviewStrategy: "authorization-focused review with resource hierarchy examples",
    rolloutStrategy: "future shadow decisions for Auth/RBAC-heavy domains",
    rollbackStrategy: "pin previous approved Cedar policy set",
    testStrategy: "Cedar authorization tests and cross-checks against static decisions",
    metadata: { cedarRuntimeImplemented: false }
  }
];

export const defaultPolicyDomainMappings: PolicyDomainMapping[] = [
  {
    id: "policy_domain_git",
    domain: "git",
    currentImplementation: "Static rules gate git.branch.create, git.pull_request.create, git.remote_operation, and destructive Git denials.",
    futurePolicyBundle: "git-remote-operations bundle",
    requiredInputs: ["actor", "repo", "branchPrefix", "allowedRepos", "operationGate", "taskId", "taskRunId"],
    requiredOutputs: ["allow_or_deny", "matched_rule_ids", "audit_retention_class"],
    migrationStatus: "mapped",
    riskLevel: "high",
    metadata: { actions: ["git.branch.create", "git.pull_request.create", "git.merge", "git.rebase"], staticRuleLocation: "packages/policy", destructiveActionsDenied: true }
  },
  {
    id: "policy_domain_git_webhook",
    domain: "git_webhook",
    currentImplementation: "Static rules require verified GitHub webhook metadata and deny unverified processing.",
    futurePolicyBundle: "git-webhook-receiver bundle",
    requiredInputs: ["deliveryId", "eventType", "repoRef", "signatureVerified", "replayStatus", "allowedRepos"],
    requiredOutputs: ["allow_or_deny", "read_model_update_scope", "audit_event_type"],
    migrationStatus: "mapped",
    riskLevel: "high",
    metadata: { actions: ["git.webhook.process"], staticRuleLocation: "packages/policy", rawPayloadStored: false }
  },
  {
    id: "policy_domain_llm",
    domain: "llm",
    currentImplementation: "Static rules gate llm.completion, remote completion, model/provider allowlists, virtual keys, budgets, and fallback.",
    futurePolicyBundle: "llm-provider-routing bundle",
    requiredInputs: ["actor", "modelId", "providerId", "providerKind", "budget", "virtualKey", "taskId", "taskRunId"],
    requiredOutputs: ["allow_or_deny", "budget_requirement", "fallback_limit", "audit_class"],
    migrationStatus: "mapped",
    riskLevel: "critical",
    metadata: { actions: ["llm.completion", "llm.remote_completion", "llm.model.use"], rawPromptsStored: false }
  },
  {
    id: "policy_domain_mcp",
    domain: "mcp",
    currentImplementation: "Static rules deny high-risk MCP tool invocation by default and keep real transport disabled.",
    futurePolicyBundle: "mcp-tool-risk bundle",
    requiredInputs: ["actor", "serverId", "toolId", "riskLevel", "inputRedactionClass", "networkPolicy"],
    requiredOutputs: ["allow_or_deny", "redaction_requirement", "audit_requirement"],
    migrationStatus: "mapped",
    riskLevel: "critical",
    metadata: { actions: ["mcp.server.list", "mcp.tool.invoke", "mcp.tool.invoke.high_risk"], realTransportEnabled: false }
  },
  {
    id: "policy_domain_runner",
    domain: "runner",
    currentImplementation: "Static rules deny command execution and secret injection unless explicit harness/workspace gates allow controlled fixtures.",
    futurePolicyBundle: "runner-execution bundle",
    requiredInputs: ["actor", "runnerKind", "command", "workspace", "harnessPolicy", "networkPolicy"],
    requiredOutputs: ["allow_or_deny", "command_constraints", "preview_limits"],
    migrationStatus: "mapped",
    riskLevel: "critical",
    metadata: { actions: ["runner.execute", "runner.command.execute", "runner.secret.inject"], shellStringExecutionAllowed: false }
  },
  {
    id: "policy_domain_registry",
    domain: "registry",
    currentImplementation: "Static rules and registry authorizer gate create, update, approve, rollback, and package import operations.",
    futurePolicyBundle: "registry-governance bundle",
    requiredInputs: ["actor", "targetKind", "targetId", "lifecycle", "approvalStatus", "evalStatus", "checksum"],
    requiredOutputs: ["allow_or_deny", "approval_requirement", "audit_requirement"],
    migrationStatus: "mapped",
    riskLevel: "high",
    metadata: { actions: ["registry.create", "registry.update", "registry.approve", "registry.rollback"], historyAppendOnly: true }
  },
  {
    id: "policy_domain_improvement",
    domain: "improvement",
    currentImplementation: "Static rules deny improvement.apply and enforce governance apply gate defaults.",
    futurePolicyBundle: "improvement-governance bundle",
    requiredInputs: ["actor", "proposalId", "evalStatus", "canaryStatus", "humanApproval", "safetyPolicy"],
    requiredOutputs: ["allow_or_deny", "apply_gate_requirement", "audit_event"],
    migrationStatus: "mapped",
    riskLevel: "critical",
    metadata: { actions: ["improvement.proposal.approve", "improvement.apply"], autoApplyDefault: false }
  },
  {
    id: "policy_domain_secretref",
    domain: "secretref",
    currentImplementation: "Static rules gate provider credential resolution before EnvSecretProvider access and deny raw secret reads.",
    futurePolicyBundle: "secretref-resolution bundle",
    requiredInputs: ["actor", "secretRefId", "secretKind", "purpose", "lease", "providerId", "scope"],
    requiredOutputs: ["allow_or_deny", "lease_requirement", "redaction_class", "audit_event"],
    migrationStatus: "mapped",
    riskLevel: "critical",
    metadata: { actions: ["provider.credential.resolve", "secret.read", "secret.lease.request"], rawSecretReadAllowed: false }
  },
  {
    id: "policy_domain_secrets_sandbox",
    domain: "secrets_sandbox",
    currentImplementation: "Static rules deny broad network egress, runner secret injection, and unsafe sandbox behavior.",
    futurePolicyBundle: "sandbox-network bundle",
    requiredInputs: ["actor", "sandboxProfile", "networkPolicy", "secretScopes", "commandKind"],
    requiredOutputs: ["allow_or_deny", "sandbox_constraints", "egress_decision"],
    migrationStatus: "mapped",
    riskLevel: "critical",
    metadata: { actions: ["network.egress", "runner.secret.inject", "sandbox.session.create"], networkDefaultDeny: true }
  },
  {
    id: "policy_domain_local_agent",
    domain: "local_agent",
    currentImplementation: "Static rules gate Local Agent invocation, consent, capabilities, PTY, vendor CLI, and credential-cache access.",
    futurePolicyBundle: "local-agent-consent bundle",
    requiredInputs: ["actor", "agentId", "hostId", "capabilities", "consentLevel", "deviceTrustFuture"],
    requiredOutputs: ["allow_or_deny", "consent_requirement", "stream_policy"],
    migrationStatus: "mapped",
    riskLevel: "critical",
    metadata: { actions: ["local_agent.invoke", "local_agent.consent.approve", "credential.cache.read"], realDaemonEnabled: false }
  },
  {
    id: "policy_domain_provider",
    domain: "provider",
    currentImplementation: "Static rules deny broad provider invocation, local CLI danger modes, PTY, and credential-cache reads.",
    futurePolicyBundle: "enterprise-provider-boundary bundle",
    requiredInputs: ["actor", "providerId", "providerKind", "authType", "credentialAccess", "operation"],
    requiredOutputs: ["allow_or_deny", "credential_resolution_scope", "adapter_constraints"],
    migrationStatus: "mapped",
    riskLevel: "critical",
    metadata: { actions: ["provider.invoke", "provider.credential.resolve", "local_cli.invoke"], credentialCacheAccessAllowed: false }
  },
  {
    id: "policy_domain_auth",
    domain: "auth",
    currentImplementation: "Auth/RBAC v0/v1 planning enriches policy subjects but production identity is not implemented.",
    futurePolicyBundle: "auth-subject-mapping bundle",
    requiredInputs: ["principalId", "actorId", "roles", "teams", "tenant", "serviceAccountKind"],
    requiredOutputs: ["policy_subject", "scope_constraints", "audit_attribution"],
    migrationStatus: "gap",
    riskLevel: "critical",
    metadata: { actions: ["policy.evaluate", "auth.authorize"], productionAuthEnabled: false, tenantEnforcementImplemented: false }
  },
  {
    id: "policy_domain_dashboard",
    domain: "dashboard",
    currentImplementation: "Dashboard read models are read-only and sanitized, but tenant-scoped access is future work.",
    futurePolicyBundle: "dashboard-read-scope bundle",
    requiredInputs: ["actor", "panel", "tenant", "retentionClass", "auditScope"],
    requiredOutputs: ["allow_or_deny", "redaction_requirement", "scope_filter"],
    migrationStatus: "gap",
    riskLevel: "high",
    metadata: { actions: ["dashboard.read", "observability.audit.read"], writeOperationsEnabled: false }
  },
  {
    id: "policy_domain_deployment_readiness",
    domain: "deployment_readiness",
    currentImplementation: "Readiness endpoints expose deterministic planning metadata and do not run live checks.",
    futurePolicyBundle: "readiness-access bundle",
    requiredInputs: ["actor", "profile", "readinessCategory", "environment"],
    requiredOutputs: ["allow_or_deny", "sensitive_field_masking", "audit_requirement"],
    migrationStatus: "future",
    riskLevel: "medium",
    metadata: { actions: ["readiness.read"], liveInfrastructureChecksEnabled: false }
  }
];

export const defaultPolicyBundleReadinessChecks: PolicyBundleReadinessCheck[] = [
  {
    id: "policy_bundle_engine_options_documented",
    category: "engine_selection",
    name: "Engine options documented",
    status: "pass",
    severity: "medium",
    description: "OPA/Rego, Cedar, signed JSON/YAML bundle, static TypeScript, and custom future paths are modeled.",
    remediation: "Keep production engine selection behind an explicit follow-up design.",
    evidence: ["docs/roadmaps/policy-bundle-opa-cedar/engine-options-v0.md"],
    metadata: { runtimeChanged: false }
  },
  {
    id: "policy_bundle_schema_required",
    category: "bundle_schema",
    name: "Policy bundle schema remains planning-only",
    status: "warning",
    severity: "high",
    description: "A schema plan exists, but no parser, compatibility checker, or runtime loader exists.",
    remediation: "Implement a schema validator and non-executing bundle import dry-run before runtime migration.",
    evidence: ["docs/roadmaps/policy-bundle-opa-cedar/policy-bundle-schema-v0.md"],
    metadata: { parserImplemented: false }
  },
  {
    id: "policy_bundle_signing_future",
    category: "signing",
    name: "Signed bundle verification is future work",
    status: "fail",
    severity: "high",
    description: "v0 documents signing metadata but does not implement signature creation or verification.",
    remediation: "Add offline signing and verification controls in a future milestone.",
    evidence: ["docs/roadmaps/policy-bundle-opa-cedar/v0.md"],
    metadata: { signingVerificationImplemented: false }
  },
  {
    id: "policy_bundle_review_workflow_planned",
    category: "review_workflow",
    name: "Review workflow planned",
    status: "warning",
    severity: "high",
    description: "Policy author, reviewer, and security approver workflow is documented but not enforced.",
    remediation: "Implement policy change requests and approvals after production Auth/RBAC is available.",
    evidence: ["docs/roadmaps/policy-bundle-opa-cedar/policy-review-workflow-v0.md"],
    metadata: { workflowEngineImplemented: false }
  },
  {
    id: "policy_bundle_rollout_rollback_future",
    category: "rollout",
    name: "Rollout and rollback are future work",
    status: "fail",
    severity: "high",
    description: "Staged rollout, shadow evaluation, dry-run activation, and rollback triggers are not implemented.",
    remediation: "Add rollout controller and rollback pinning in a future policy bundle implementation.",
    evidence: ["docs/roadmaps/policy-bundle-opa-cedar/policy-rollout-rollback-v0.md"],
    metadata: { rolloutImplemented: false, rollbackImplemented: false }
  },
  {
    id: "policy_bundle_tests_planned",
    category: "tests",
    name: "Policy test strategy planned",
    status: "warning",
    severity: "medium",
    description: "Golden decisions, deny-by-default regressions, tenant isolation, and secret exposure tests are specified.",
    remediation: "Attach bundle test fixtures before enabling bundle evaluation.",
    evidence: ["docs/roadmaps/policy-bundle-opa-cedar/policy-test-strategy-v0.md"],
    metadata: { bundleTestRunnerImplemented: false }
  },
  {
    id: "policy_bundle_domain_mapping_complete",
    category: "audit",
    name: "Current policy domains mapped",
    status: "pass",
    severity: "medium",
    description: "All current static policy domains are mapped to future bundle inputs and outputs.",
    remediation: "Keep mapping synchronized with new policy actions.",
    evidence: ["docs/reference/policy-domain-mapping.md"],
    metadata: { mappedDomainCount: 14 }
  },
  {
    id: "policy_bundle_break_glass_future",
    category: "break_glass",
    name: "Break-glass remains disabled",
    status: "fail",
    severity: "critical",
    description: "Break-glass policy is documented only and cannot grant runtime access.",
    remediation: "Require production Auth/RBAC, audit export, approval workflow, and time-bound enforcement before implementation.",
    evidence: ["docs/roadmaps/policy-bundle-opa-cedar/break-glass-policy-v0.md"],
    metadata: { breakGlassImplemented: false }
  },
  {
    id: "policy_bundle_tenant_scoping_blocked",
    category: "tenant_scoping",
    name: "Tenant-scoped policy inputs depend on production auth",
    status: "fail",
    severity: "critical",
    description: "Policy bundles need tenant/workspace/project/repo inputs that are not production-enforced yet.",
    remediation: "Complete production Auth/RBAC and request context propagation before production bundle activation.",
    evidence: ["docs/roadmaps/auth-rbac-production/v1.md"],
    metadata: { productionAuthRequired: true }
  },
  {
    id: "policy_bundle_dashboard_panel_available",
    category: "dashboard",
    name: "Dashboard readiness panel available",
    status: "pass",
    severity: "low",
    description: "Dashboard exposes policy bundle planning status without executing policy code.",
    remediation: "Keep panel read-only.",
    evidence: ["apps/api/src/dashboard-read-model.ts", "apps/web/src/render.ts"],
    metadata: { dashboardReadOnly: true }
  }
];

export const defaultPolicyBundleRisks: PolicyBundleRisk[] = [
  {
    id: "policy_bundle_risk_dynamic_execution",
    category: "runtime_safety",
    title: "Dynamic policy execution introduced too early",
    severity: "critical",
    likelihood: "medium",
    impact: "Untrusted policy code could bypass safety gates or execute unexpected logic.",
    mitigation: "Keep v0 read-only and require explicit review before any policy runtime integration.",
    status: "open",
    metadata: { dynamicPolicyExecutionEnabled: false }
  },
  {
    id: "policy_bundle_risk_unsigned_policy_change",
    category: "signing",
    title: "Unsigned policy bundle promoted",
    severity: "high",
    likelihood: "medium",
    impact: "Production gates could change without trustworthy provenance or rollback evidence.",
    mitigation: "Add signing and verification before production bundle activation.",
    status: "open",
    metadata: { signingVerificationImplemented: false }
  },
  {
    id: "policy_bundle_risk_tenant_context_gap",
    category: "tenant_scoping",
    title: "Policy decisions lack production tenant context",
    severity: "critical",
    likelihood: "high",
    impact: "A future bundle could allow cross-tenant reads or provider actions if scoped inputs are absent.",
    mitigation: "Block production bundle activation until Auth/RBAC v1+ tenant propagation is implemented.",
    status: "open",
    metadata: { tenantEnforcementImplemented: false }
  },
  {
    id: "policy_bundle_risk_break_glass_overreach",
    category: "break_glass",
    title: "Break-glass grants unsafe privileges",
    severity: "critical",
    likelihood: "medium",
    impact: "Emergency access could bypass secret, provider, Git, or runner safety gates.",
    mitigation: "Keep break-glass future-only, time-bound, audited, and unable to read raw secrets or enable destructive operations.",
    status: "open",
    metadata: { breakGlassImplemented: false }
  },
  {
    id: "policy_bundle_risk_shadow_mismatch",
    category: "rollout",
    title: "Bundle shadow decisions diverge from static decisions",
    severity: "high",
    likelihood: "medium",
    impact: "Runtime migration could introduce behavior changes across Git, LLM, MCP, Runner, and SecretRef gates.",
    mitigation: "Require golden decision tests and shadow evaluation mismatch review before activation.",
    status: "deferred",
    metadata: { shadowEvaluationImplemented: false }
  }
];

export const defaultPolicyBundleMigrationPhases: PolicyBundleMigrationPhase[] = [
  {
    id: "policy_bundle_phase_1_inventory",
    name: "Inventory static rules and policy domains",
    order: 1,
    sourceMode: "static_typescript",
    targetMode: "mapped_static_domains",
    domains: ["git", "git_webhook", "llm", "mcp", "runner", "registry", "improvement", "secretref", "secrets_sandbox", "local_agent", "provider", "auth", "dashboard", "deployment_readiness"],
    requiredPreconditions: ["Policy-as-code v0 static rule catalog available"],
    migrationSteps: ["Map actions, resources, inputs, outputs, audit events, and environment gates"],
    validationChecks: ["Domain mapping covers every current policy boundary", "No runtime policy behavior changes"],
    rollbackPlan: ["Keep StaticPolicyEngine as the only runtime"],
    status: "ready_for_design",
    metadata: { completedByV0Planning: true }
  },
  {
    id: "policy_bundle_phase_2_schema_and_tests",
    name: "Define bundle schema and golden tests",
    order: 2,
    sourceMode: "mapped_static_domains",
    targetMode: "schema_bundle_dry_run",
    domains: ["git", "llm", "mcp", "runner", "secretref", "local_agent", "provider"],
    requiredPreconditions: ["Domain mapping complete", "Production Auth/RBAC subject schema planned"],
    migrationSteps: ["Define bundle metadata", "Define rule input/output contracts", "Create golden decision fixtures"],
    validationChecks: ["Deny-by-default tests pass", "Secret exposure tests pass", "No dynamic execution"],
    rollbackPlan: ["Discard dry-run bundle artifacts and keep static rules"],
    status: "planned",
    metadata: { parserImplemented: false }
  },
  {
    id: "policy_bundle_phase_3_review_and_signing",
    name: "Add review workflow and future signing checkpoint",
    order: 3,
    sourceMode: "schema_bundle_dry_run",
    targetMode: "reviewed_signed_bundle_future",
    domains: ["git", "llm", "mcp", "runner", "secretref", "provider", "auth"],
    requiredPreconditions: ["Production Auth/RBAC reviewer roles", "Policy bundle schema validator"],
    migrationSteps: ["Create policy change request model", "Attach tests", "Record approvals", "Add signature metadata placeholder"],
    validationChecks: ["Separation of duties enforced", "Unsigned bundles cannot become active"],
    rollbackPlan: ["Disable bundle promotion and keep last static rule release"],
    status: "blocked",
    metadata: { blockedByProductionAuth: true, signingImplemented: false }
  },
  {
    id: "policy_bundle_phase_4_shadow_rollout",
    name: "Shadow evaluate bundles against static decisions",
    order: 4,
    sourceMode: "static_runtime_with_reviewed_bundle",
    targetMode: "shadow_policy_evaluation_future",
    domains: ["git", "git_webhook", "llm", "mcp", "runner", "secretref", "local_agent", "provider"],
    requiredPreconditions: ["Reviewed bundle exists", "Safe shadow evaluator implemented", "Observability metrics available"],
    migrationSteps: ["Evaluate bundle in dry-run only", "Compare against static decision", "Record mismatches"],
    validationChecks: ["Mismatch count under threshold", "No bundle decision controls runtime"],
    rollbackPlan: ["Disable shadow evaluator and keep static runtime"],
    status: "future",
    metadata: { shadowEvaluatorImplemented: false }
  },
  {
    id: "policy_bundle_phase_5_controlled_runtime",
    name: "Controlled bundle runtime activation",
    order: 5,
    sourceMode: "static_runtime",
    targetMode: "bundle_runtime_future",
    domains: ["git", "llm", "mcp", "runner", "secretref", "provider"],
    requiredPreconditions: ["Signed reviewed bundle", "Production auth", "Tenant scoping", "Rollback pinning", "Audit export"],
    migrationSteps: ["Activate per-domain bundle behind explicit feature gate", "Monitor denies and mismatches", "Pin rollback bundle"],
    validationChecks: ["No bypass of SecretRef, Auth/RBAC, Git, LLM, MCP, Runner, Local Agent, or sandbox gates"],
    rollbackPlan: ["Switch back to StaticPolicyEngine or prior approved bundle"],
    status: "future",
    metadata: { runtimeActivationImplemented: false }
  }
];

export const defaultPolicyRuntimePocOptions: PolicyRuntimePocOption[] = [
  {
    id: "policy_runtime_poc_static_baseline",
    optionKind: "static_policy_engine_baseline",
    displayName: "StaticPolicyEngine baseline",
    status: "baseline",
    pocGoal: "Keep the current deny-by-default runtime as the source of truth and produce baseline fixtures for all PoC comparisons.",
    inputsRequired: ["PolicySubject", "PolicyResource", "PolicyAction", "PolicyContext", "environment gates"],
    outputContract: ["PolicyDecision", "matched rule ids", "sanitized audit metadata"],
    testability: "High. Existing deterministic TypeScript policy tests and API tests already exercise the baseline.",
    auditability: "High for current audit fields, but bundle version and shadow mismatch fields are future work.",
    developerReviewExperience: "Code review of TypeScript rule diffs.",
    scopeModelCompatibility: "Compatible with Tenant/Repo/Provider Scope metadata where current callers populate it.",
    authRbacCompatibility: "Compatible with mock AuthContext, RequestContext, and service-account attribution; production Auth/RBAC remains future.",
    performanceConsiderations: "In-process deterministic rule matching with low operational overhead.",
    operationalComplexity: "low",
    securityRisks: ["Policy changes are tied to code releases", "No independent bundle review or rollback artifact"],
    productionSuitability: "Current scaffold only; not sufficient for production policy governance.",
    recommendation: "Use as the mandatory source of truth for all PoC golden decisions and shadow comparisons.",
    runtimeImplemented: false,
    metadata: { staticRuntimeAlreadyActive: true, sourceOfTruth: true, policyRuntimeChanged: false }
  },
  {
    id: "policy_runtime_poc_signed_json_yaml",
    optionKind: "signed_json_yaml_bundle_evaluator_future",
    displayName: "Signed JSON/YAML bundle evaluator",
    status: "recommended_for_poc",
    pocGoal: "Evaluate a narrow declarative bundle shape against static golden decisions before adopting a full policy language.",
    inputsRequired: ["normalized policy input contract", "bundle id", "bundle version", "schema compatibility version", "golden fixtures"],
    outputContract: ["decision", "reason", "ruleId", "policyBundleId", "policyVersion", "obligations", "redaction requirements"],
    testability: "High if the schema remains declarative and fixture-driven.",
    auditability: "High once bundle id/version and rule id are emitted with every shadow decision.",
    developerReviewExperience: "Readable for domain owners when rules stay schema-driven and examples are generated.",
    scopeModelCompatibility: "Strong. The schema can directly require tenant, repo, provider, model, SecretRef, MCP, registry, Local Agent, and audit scopes.",
    authRbacCompatibility: "Strong after production Auth/RBAC supplies stable subjects; current mock subjects can exercise the shape only.",
    performanceConsiderations: "Expected low overhead if implemented as a bounded schema evaluator with no dynamic code.",
    operationalComplexity: "medium",
    securityRisks: ["A too-expressive schema could become an unsafe policy language", "Signing verification and compatibility enforcement are future work"],
    productionSuitability: "Good first PoC path, not production-ready until signing, review, shadow, rollback, and tenant controls exist.",
    recommendation: "Recommended first runtime PoC path in shadow mode after golden fixtures exist.",
    runtimeImplemented: false,
    metadata: { parserImplemented: false, evaluatorImplemented: false, signingVerificationImplemented: false }
  },
  {
    id: "policy_runtime_poc_opa_local",
    optionKind: "opa_rego_local_library_future",
    displayName: "OPA/Rego local evaluator",
    status: "candidate",
    pocGoal: "Assess whether local Rego evaluation can reproduce static decisions without an external policy service.",
    inputsRequired: ["strict JSON input contract", "versioned Rego module", "data bundle", "golden fixtures"],
    outputContract: ["decision", "reason", "ruleId", "policyBundleId", "policyVersion", "obligations"],
    testability: "Strong when Rego unit tests and Aichestra golden fixtures are both required.",
    auditability: "Strong if decision logs include bundle revision and exact input schema version.",
    developerReviewExperience: "Specialized. Rego reviewers need generated examples and domain-owner review.",
    scopeModelCompatibility: "Good if every scope field is normalized into the input document.",
    authRbacCompatibility: "Good after production Auth/RBAC subjects are stable; current mock subjects remain non-production.",
    performanceConsiderations: "Requires latency benchmarks and bounded input size review before shadow mode.",
    operationalComplexity: "high",
    securityRisks: ["Input schema drift", "Unexpected policy complexity", "WASM or dynamic execution must remain disabled unless explicitly designed later"],
    productionSuitability: "Future candidate after input contract and governance controls are proven.",
    recommendation: "Evaluate after the JSON/YAML schema PoC defines stable fixtures.",
    runtimeImplemented: false,
    metadata: { opaRuntimeImplemented: false, wasmPolicyExecutionEnabled: false }
  },
  {
    id: "policy_runtime_poc_opa_server",
    optionKind: "opa_rego_server_future",
    displayName: "OPA/Rego server or sidecar",
    status: "future_only",
    pocGoal: "Assess remote or sidecar policy-service boundaries only after local/shadow fixtures are stable.",
    inputsRequired: ["strict JSON input contract", "service availability contract", "mTLS/auth future", "decision timeout", "fallback policy"],
    outputContract: ["decision", "reason", "ruleId", "policyBundleId", "policyVersion", "latency", "service health metadata"],
    testability: "Medium. Requires service fixture tests in addition to golden decisions.",
    auditability: "Medium to high if request ids, bundle revision, and service latency are captured.",
    developerReviewExperience: "Specialized Rego review plus service-operations review.",
    scopeModelCompatibility: "Good if the same normalized input contract is used.",
    authRbacCompatibility: "Requires production service identity, request signing, and no-secret audit review.",
    performanceConsiderations: "Adds network or IPC latency and availability risk.",
    operationalComplexity: "high",
    securityRisks: ["External policy service outage", "Policy bypass during timeout handling", "Service auth and request signing are not implemented"],
    productionSuitability: "Not near-term; consider only after local evaluator and rollback controls exist.",
    recommendation: "Do not start with this path.",
    runtimeImplemented: false,
    metadata: { externalPolicyServiceImplemented: false, serviceCallsEnabled: false }
  },
  {
    id: "policy_runtime_poc_cedar",
    optionKind: "cedar_local_evaluator_future",
    displayName: "Cedar local evaluator",
    status: "candidate",
    pocGoal: "Evaluate Cedar for authorization-heavy domains such as dashboard access, SecretRef authorization, registry mutation, and Local Agent ownership.",
    inputsRequired: ["principal entity", "action", "resource entity", "entity hierarchy", "context object"],
    outputContract: ["decision", "reason", "policy id", "policy set version", "obligations", "redaction requirements"],
    testability: "Strong for authorization cases after entity schemas are stable.",
    auditability: "Good if policy set version and entity ids are always recorded.",
    developerReviewExperience: "Readable for authorization reviewers, less direct for operational gates.",
    scopeModelCompatibility: "Strong for tenant, team, project, repo, provider, SecretRef, registry, Local Agent, and audit query hierarchies.",
    authRbacCompatibility: "Strong future fit once production principals and service accounts exist.",
    performanceConsiderations: "Expected to be acceptable for scoped authorization, but needs benchmark coverage.",
    operationalComplexity: "medium",
    securityRisks: ["Operational gates may be awkward to model", "Entity hierarchy drift can cause incorrect decisions"],
    productionSuitability: "Candidate for selected authorization-heavy domains, not the broad first PoC.",
    recommendation: "Evaluate with dashboard, SecretRef, registry, and audit-query golden cases after the shared input contract lands.",
    runtimeImplemented: false,
    metadata: { cedarRuntimeImplemented: false, cedarPoliciesLoaded: false }
  },
  {
    id: "policy_runtime_poc_custom_service",
    optionKind: "custom_policy_decision_service_future",
    displayName: "Custom policy decision service",
    status: "not_recommended",
    pocGoal: "Only evaluate if OPA, Cedar, and schema-driven bundles fail Aichestra-specific requirements.",
    inputsRequired: ["service API contract", "authentication boundary", "decision timeout", "audit schema", "rollback contract"],
    outputContract: ["decision", "reason", "rule id", "service version", "obligations", "audit metadata"],
    testability: "Medium. A bespoke service requires a larger fixture and contract-test surface.",
    auditability: "Depends on custom implementation and therefore carries high review cost.",
    developerReviewExperience: "Bespoke and harder to staff than schema, OPA, or Cedar review.",
    scopeModelCompatibility: "Possible, but all semantics would be custom.",
    authRbacCompatibility: "Requires production service identity and request authorization that do not exist yet.",
    performanceConsiderations: "Adds service latency and availability constraints.",
    operationalComplexity: "high",
    securityRisks: ["New service boundary", "Custom authorization semantics", "Higher bypass and availability risk"],
    productionSuitability: "Not recommended for near-term production planning.",
    recommendation: "Keep as an escape hatch only.",
    runtimeImplemented: false,
    metadata: { customServiceImplemented: false, recommendedNearTerm: false }
  }
];

export const defaultPolicyRuntimePocInputContract: PolicyRuntimePocInputContract = {
  id: "policy_runtime_poc_input_contract_v0",
  version: "policy_runtime_poc_input_v0",
  subjectFields: ["actorId", "principalId", "actorKind", "serviceAccountId", "roles", "teams", "authMode", "isMockActor"],
  requestFields: ["requestId", "correlationId", "source", "taskId", "taskRunId"],
  resourceFields: ["resourceKind", "resourceId", "tenantId", "teamId", "projectId", "repoId", "providerId", "modelId", "secretRefId", "mcpServerId", "mcpToolId", "registryPackageId", "localAgentHostId"],
  actionField: "action",
  environmentFields: ["integrationGates", "deploymentProfile", "stagingFlags", "productionFlags"],
  contextFields: ["riskLevel", "budget", "secretLeaseState", "auditCorrelationMetadata"],
  outputFields: ["decision", "reason", "ruleId", "policyBundleId", "policyVersion", "obligations", "auditMetadata", "redactionRequirements"],
  supportedDecisions: ["allow", "deny", "block", "warn"],
  redactionRequirements: ["never return raw secrets", "never return env values", "never return credential-cache paths", "never return raw provider tokens", "redact prompts and webhook payloads in audit previews"],
  metadata: {
    docs: "docs/roadmaps/policy-bundle-runtime-poc/policy-io-contract-v0.md",
    parserImplemented: false,
    runtimeExecutionImplemented: false
  }
};

export const defaultPolicyRuntimePocDomainMappings: PolicyRuntimePocDomainMapping[] = [
  {
    id: "policy_runtime_poc_domain_git_remote_operation",
    domain: "git_remote_operation",
    currentStaticAction: "git.remote_operation, git.merge, git.rebase, git.branch.delete",
    currentResourceKind: "git_operation",
    requiredSubjectFields: ["actorId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "repoId", "projectId"],
    requiredEnvironmentGates: ["AICHESTRA_ENABLE_REMOTE_GIT", "operation-specific Git gate", "repo allowlist", "allowed branch prefix"],
    expectedDenyByDefaultBehavior: "remote merge, rebase, force push, branch deletion, and unknown Git operations deny.",
    pocTestCases: ["git_remote_merge_denied", "git_force_push_denied"],
    futureBundleRepresentation: "git-remote-operations bundle rule with destructive actions denied before allow rules.",
    metadata: { currentRuntime: "StaticPolicyEngine", remoteProviderCallsDefault: false }
  },
  {
    id: "policy_runtime_poc_domain_github_app_token",
    domain: "github_app_token_issuance",
    currentStaticAction: "github_app.installation_token.issue",
    currentResourceKind: "github_app_installation",
    requiredSubjectFields: ["actorId", "serviceAccountId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "repoId", "providerId"],
    requiredEnvironmentGates: ["AICHESTRA_GITHUB_AUTH_MODE", "AICHESTRA_ENABLE_GITHUB_APP", "installation allowlist", "repo allowlist", "private-key SecretRef metadata"],
    expectedDenyByDefaultBehavior: "real installation token issuance is not implemented and token handles remain metadata-only.",
    pocTestCases: ["service_account_cannot_bypass_policy"],
    futureBundleRepresentation: "github-app-token-handle bundle rule requiring service account, SecretRef metadata, allowlists, and no live token value output.",
    metadata: { liveInstallationTokenIssued: false }
  },
  {
    id: "policy_runtime_poc_domain_github_webhook",
    domain: "github_webhook_processing",
    currentStaticAction: "git.webhook.process",
    currentResourceKind: "git_operation",
    requiredSubjectFields: ["actorId", "serviceAccountId", "authMode"],
    requiredScopeFields: ["tenantId", "repoId"],
    requiredEnvironmentGates: ["AICHESTRA_ENABLE_GITHUB_WEBHOOKS", "signature verified", "webhook repo allowlist", "replay check"],
    expectedDenyByDefaultBehavior: "unverified or unallowlisted webhook processing denies and stores no raw payload.",
    pocTestCases: ["github_webhook_unverified_denied"],
    futureBundleRepresentation: "git-webhook-receiver bundle with signature, replay, and repo allowlist conditions.",
    metadata: { rawPayloadStored: false }
  },
  {
    id: "policy_runtime_poc_domain_llm_remote_completion",
    domain: "llm_remote_completion",
    currentStaticAction: "llm.remote_completion",
    currentResourceKind: "llm_provider",
    requiredSubjectFields: ["actorId", "principalId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "providerId", "modelId"],
    requiredEnvironmentGates: ["AICHESTRA_ENABLE_REMOTE_LLM", "AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION", "base URL configured", "credential metadata", "model allowlist", "budget allow"],
    expectedDenyByDefaultBehavior: "remote completion denies unless every gate, allowlist, budget, credential, Auth/RBAC, and Policy condition passes.",
    pocTestCases: ["llm_remote_completion_requires_gates"],
    futureBundleRepresentation: "llm-remote-completion bundle rule with budget and credential obligations.",
    metadata: { rawPromptStored: false }
  },
  {
    id: "policy_runtime_poc_domain_llm_fallback",
    domain: "llm_fallback",
    currentStaticAction: "llm.fallback",
    currentResourceKind: "llm_fallback_policy",
    requiredSubjectFields: ["actorId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "providerId", "modelId"],
    requiredEnvironmentGates: ["fallback enabled", "max fallback attempts bounded", "provider/model allowlists", "budget allow"],
    expectedDenyByDefaultBehavior: "fallback is disabled and unbounded fallback denies.",
    pocTestCases: ["llm_fallback_bounded"],
    futureBundleRepresentation: "llm-fallback bundle rule requiring bounded attempts and no allowlist bypass.",
    metadata: { fallbackBypassAllowed: false }
  },
  {
    id: "policy_runtime_poc_domain_mcp",
    domain: "mcp_tool_invocation",
    currentStaticAction: "mcp.tool.invoke, mcp.tool.invoke.critical",
    currentResourceKind: "mcp_tool",
    requiredSubjectFields: ["actorId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "mcpServerId", "mcpToolId"],
    requiredEnvironmentGates: ["mock gateway active", "tool risk low", "real transport disabled", "secret forwarding disabled", "network disabled"],
    expectedDenyByDefaultBehavior: "critical, high-risk, write, deploy, network, and secret-resolving tools deny by default.",
    pocTestCases: ["mcp_critical_tool_denied"],
    futureBundleRepresentation: "mcp-tool-risk bundle rule with risk, transport, network, and redaction constraints.",
    metadata: { realTransportEnabled: false }
  },
  {
    id: "policy_runtime_poc_domain_secretref_vault",
    domain: "secretref_vault_credential_resolution",
    currentStaticAction: "provider.credential.resolve, secret.read, secret.lease.request",
    currentResourceKind: "secret_ref",
    requiredSubjectFields: ["actorId", "serviceAccountId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "providerId", "secretRefId"],
    requiredEnvironmentGates: ["SecretRef active", "Auth/RBAC allow", "Policy allow", "Vault provider gate when provider is vault", "path allowlist"],
    expectedDenyByDefaultBehavior: "raw secret read and credential cache access deny; Vault resolution needs Auth/RBAC, Policy, active SecretRef, provider gates, and allowlisted path.",
    pocTestCases: ["secret_read_denied", "credential_cache_read_denied", "vault_secret_resolution_requires_auth_policy_path_allowlist"],
    futureBundleRepresentation: "secretref-resolution bundle rule with lease and redaction obligations.",
    metadata: { secretValuesReturned: false }
  },
  {
    id: "policy_runtime_poc_domain_runner",
    domain: "runner_command_execution",
    currentStaticAction: "runner.command.execute, runner.secret.inject",
    currentResourceKind: "command",
    requiredSubjectFields: ["actorId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "repoId", "projectId"],
    requiredEnvironmentGates: ["local execution gate", "harness policy allow", "fixture workspace", "network disabled", "secret injection denied"],
    expectedDenyByDefaultBehavior: "runner command execution and secret injection deny by default outside explicit fixture gates.",
    pocTestCases: ["runner_secret_injection_denied"],
    futureBundleRepresentation: "runner-execution bundle with command, workspace, output, network, and secret obligations.",
    metadata: { shellStringExecutionAllowed: false }
  },
  {
    id: "policy_runtime_poc_domain_local_agent",
    domain: "local_agent_invocation",
    currentStaticAction: "local_agent.invoke, local_agent.secret.forward, credential.cache.read",
    currentResourceKind: "local_agent",
    requiredSubjectFields: ["actorId", "principalId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "localAgentHostId"],
    requiredEnvironmentGates: ["mock transport", "connected host", "consent recorded", "sandbox profile", "redaction policy"],
    expectedDenyByDefaultBehavior: "real transport, PTY, secret forwarding, credential cache reads, and vendor CLI execution deny.",
    pocTestCases: ["credential_cache_read_denied", "service_account_cannot_bypass_policy"],
    futureBundleRepresentation: "local-agent-consent bundle with consent, capability, sandbox, and redaction obligations.",
    metadata: { realDaemonImplemented: false }
  },
  {
    id: "policy_runtime_poc_domain_registry",
    domain: "registry_mutation",
    currentStaticAction: "registry.create, registry.update, registry.approve, registry.rollback",
    currentResourceKind: "registry_item",
    requiredSubjectFields: ["actorId", "principalId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "registryPackageId"],
    requiredEnvironmentGates: ["registry mutation authorizer allow", "lifecycle gate", "approval gate", "checksum gate", "eval gate"],
    expectedDenyByDefaultBehavior: "pending approval entries are excluded from resolver selection and mutation roles remain required.",
    pocTestCases: ["registry_pending_approval_excluded"],
    futureBundleRepresentation: "registry-governance bundle with lifecycle, approval, eval, checksum, and rollback obligations.",
    metadata: { activeMutationFromAutoImprovementAllowed: false }
  },
  {
    id: "policy_runtime_poc_domain_governance",
    domain: "governance_apply_gate",
    currentStaticAction: "improvement.apply",
    currentResourceKind: "improvement_proposal",
    requiredSubjectFields: ["actorId", "serviceAccountId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "registryPackageId"],
    requiredEnvironmentGates: ["human approval", "eval passed", "canary ready", "auto apply disabled"],
    expectedDenyByDefaultBehavior: "governance apply remains denied and auto-apply remains disabled.",
    pocTestCases: ["governance_apply_gate_denied"],
    futureBundleRepresentation: "improvement-governance bundle with apply obligations and human review requirements.",
    metadata: { allowAutoApply: false }
  },
  {
    id: "policy_runtime_poc_domain_dashboard",
    domain: "dashboard_readiness_access",
    currentStaticAction: "dashboard.read, readiness.read",
    currentResourceKind: "dashboard",
    requiredSubjectFields: ["actorId", "principalId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "teamId", "projectId", "audit query scope"],
    requiredEnvironmentGates: ["read-only route", "sanitized DTO", "no secret/env values", "production dashboard filtering future"],
    expectedDenyByDefaultBehavior: "viewers can see safe summaries but not secret-adjacent raw details.",
    pocTestCases: ["dashboard_viewer_no_secret_adjacent_details", "tenant_scope_mismatch_denied_future"],
    futureBundleRepresentation: "dashboard-read-scope bundle with tenant, retention, and redaction obligations.",
    metadata: { dashboardFilteringImplemented: false }
  },
  {
    id: "policy_runtime_poc_domain_observability",
    domain: "observability_audit_query",
    currentStaticAction: "observability.audit.read, policy.audit.read",
    currentResourceKind: "dashboard",
    requiredSubjectFields: ["actorId", "principalId", "roles", "authMode"],
    requiredScopeFields: ["tenantId", "audit query scope", "retention class"],
    requiredEnvironmentGates: ["sanitized audit envelope", "retention class allowed", "raw secret and prompt views denied"],
    expectedDenyByDefaultBehavior: "security_admin can view sanitized audit metadata but not raw secrets, tokens, prompts, or webhook payloads.",
    pocTestCases: ["security_admin_audit_metadata_no_raw_secrets"],
    futureBundleRepresentation: "audit-query-scope bundle with retention, redaction, and tenant obligations.",
    metadata: { rawSecretAuditViewAllowed: false }
  }
];

export const defaultPolicyRuntimePocGoldenCases: PolicyRuntimePocGoldenCase[] = [
  {
    id: "git_remote_merge_denied",
    domain: "git_remote_operation",
    action: "git.merge",
    title: "Git remote merge denied",
    expectedDecision: "deny",
    expectedReason: "remote provider merge is unsupported and denied by static policy.",
    requiredInputs: ["actorId", "repoId", "action", "environment.remoteMergeEnabled"],
    requiredStaticBehavior: "Deny regardless of mock admin or service-account role.",
    futureBundleExpectation: "Bundle must deny merge before any allow rule can match.",
    metadata: { destructiveGitDenied: true }
  },
  {
    id: "git_force_push_denied",
    domain: "git_remote_operation",
    action: "git.force_push",
    title: "Force push denied",
    expectedDecision: "deny",
    expectedReason: "force push is outside Real Git Adapter v2 and remains unsupported.",
    requiredInputs: ["actorId", "repoId", "action", "riskLevel"],
    requiredStaticBehavior: "Unknown/destructive Git operation denies.",
    futureBundleExpectation: "Bundle must deny force push explicitly or through destructive operation class.",
    metadata: { forcePushSupported: false }
  },
  {
    id: "secret_read_denied",
    domain: "secretref_vault_credential_resolution",
    action: "secret.read",
    title: "Raw secret read denied",
    expectedDecision: "deny",
    expectedReason: "raw secret reads are never exposed through policy, API, health, dashboard, or audit surfaces.",
    requiredInputs: ["actorId", "secretRefId", "action"],
    requiredStaticBehavior: "Deny direct secret.read for all roles.",
    futureBundleExpectation: "Bundle output must never include a secret value obligation.",
    metadata: { rawSecretValueReturned: false }
  },
  {
    id: "credential_cache_read_denied",
    domain: "local_agent_invocation",
    action: "credential.cache.read",
    title: "Credential cache read denied",
    expectedDecision: "deny",
    expectedReason: "provider-owned credential caches are not read by Aichestra.",
    requiredInputs: ["actorId", "providerId", "action"],
    requiredStaticBehavior: "Deny credential-cache read and upload for every provider path.",
    futureBundleExpectation: "Bundle must deny credential cache actions even under service account or break-glass future roles.",
    metadata: { credentialCacheReadAllowed: false }
  },
  {
    id: "runner_secret_injection_denied",
    domain: "runner_command_execution",
    action: "runner.secret.inject",
    title: "Runner secret injection denied",
    expectedDecision: "deny",
    expectedReason: "runner secret injection is not allowed in the default runtime.",
    requiredInputs: ["actorId", "runnerKind", "workspace", "secretRefId"],
    requiredStaticBehavior: "Deny secret injection by default.",
    futureBundleExpectation: "Bundle must deny unless a future explicit policy and sandbox design allow it.",
    metadata: { productionSecretInjection: false }
  },
  {
    id: "mcp_critical_tool_denied",
    domain: "mcp_tool_invocation",
    action: "mcp.tool.invoke.critical",
    title: "MCP critical tool denied",
    expectedDecision: "deny",
    expectedReason: "critical MCP tools, write/deploy tools, network tools, and secret tools deny by default.",
    requiredInputs: ["actorId", "mcpServerId", "mcpToolId", "riskLevel"],
    requiredStaticBehavior: "Deny critical MCP tool invocation.",
    futureBundleExpectation: "Bundle must preserve risk-level denial and real transport disabled behavior.",
    metadata: { criticalToolAllowed: false }
  },
  {
    id: "llm_remote_completion_requires_gates",
    domain: "llm_remote_completion",
    action: "llm.remote_completion",
    title: "LLM remote completion requires gates",
    expectedDecision: "deny",
    expectedReason: "remote completion denies unless every LLM gate, allowlist, credential, budget, Auth/RBAC, and Policy check passes.",
    requiredInputs: ["actorId", "providerId", "modelId", "taskId", "taskRunId", "budget"],
    requiredStaticBehavior: "Deny when remote LLM or completion gate is disabled.",
    futureBundleExpectation: "Bundle must require the same gates and emit redaction obligations.",
    metadata: { rawPromptReturned: false }
  },
  {
    id: "llm_fallback_bounded",
    domain: "llm_fallback",
    action: "llm.fallback",
    title: "LLM fallback bounded",
    expectedDecision: "deny",
    expectedReason: "fallback is disabled by default and must be bounded when enabled.",
    requiredInputs: ["actorId", "providerId", "modelId", "maxFallbackAttempts"],
    requiredStaticBehavior: "Deny disabled or unbounded fallback.",
    futureBundleExpectation: "Bundle must not allow fallback to bypass provider/model/budget gates.",
    metadata: { fallbackBypassAllowed: false }
  },
  {
    id: "vault_secret_resolution_requires_auth_policy_path_allowlist",
    domain: "secretref_vault_credential_resolution",
    action: "provider.credential.resolve",
    title: "Vault secret resolution requires Auth/RBAC, Policy, and path allowlist",
    expectedDecision: "allow_when_gated",
    expectedReason: "Vault-backed SecretRef resolution is allowed only after explicit Vault gates, active SecretRef, Auth/RBAC, Policy, lease, and path allowlist checks.",
    requiredInputs: ["actorId", "serviceAccountId", "secretRefId", "providerId", "secretLeaseState"],
    requiredStaticBehavior: "Deny unless all configured checks pass; never expose secret values.",
    futureBundleExpectation: "Bundle must emit lease and redaction obligations for any allow.",
    metadata: { vaultDefaultEnabled: false, secretValuesReturned: false }
  },
  {
    id: "registry_pending_approval_excluded",
    domain: "registry_mutation",
    action: "registry.resolve",
    title: "Registry pending approval excluded",
    expectedDecision: "exclude",
    expectedReason: "pending approval registry entries are excluded by resolver gates.",
    requiredInputs: ["actorId", "registryPackageId", "approvalStatus", "lifecycle"],
    requiredStaticBehavior: "Resolver must exclude pending approval entries.",
    futureBundleExpectation: "Bundle must not weaken lifecycle, approval, eval, checksum, or resolver gates.",
    metadata: { approvalBypassAllowed: false }
  },
  {
    id: "governance_apply_gate_denied",
    domain: "governance_apply_gate",
    action: "improvement.apply",
    title: "Governance apply gate denied",
    expectedDecision: "deny",
    expectedReason: "auto-improvement apply is not implemented and remains blocked by policy and governance gates.",
    requiredInputs: ["actorId", "proposalId", "evalStatus", "canaryStatus", "humanApproval"],
    requiredStaticBehavior: "Deny improvement.apply.",
    futureBundleExpectation: "Bundle must require human approval, eval pass, canary readiness, and explicit future implementation before any allow.",
    metadata: { autoApplyAllowed: false }
  },
  {
    id: "dashboard_viewer_no_secret_adjacent_details",
    domain: "dashboard_readiness_access",
    action: "dashboard.read",
    title: "Dashboard viewer cannot see secret-adjacent details",
    expectedDecision: "warn",
    expectedReason: "viewer dashboards may show safe counts/statuses only and must not expose secret-adjacent raw values.",
    requiredInputs: ["actorId", "roles", "panel", "tenantId"],
    requiredStaticBehavior: "Return sanitized read models only.",
    futureBundleExpectation: "Bundle must emit redaction obligations and tenant scope filters.",
    metadata: { rawEnvValuesExposed: false }
  },
  {
    id: "security_admin_audit_metadata_no_raw_secrets",
    domain: "observability_audit_query",
    action: "observability.audit.read",
    title: "security_admin can view audit metadata but not raw secrets",
    expectedDecision: "warn",
    expectedReason: "security_admin may inspect sanitized audit metadata but never raw secret, token, prompt, or payload values.",
    requiredInputs: ["actorId", "roles", "auditQueryScope", "retentionClass"],
    requiredStaticBehavior: "Return sanitized audit envelopes only.",
    futureBundleExpectation: "Bundle must separate metadata visibility from raw sensitive value access.",
    metadata: { rawSecretAuditViewAllowed: false }
  },
  {
    id: "service_account_cannot_bypass_policy",
    domain: "github_app_token_issuance",
    action: "github_app.installation_token.issue",
    title: "Service account cannot bypass policy",
    expectedDecision: "deny",
    expectedReason: "mock service accounts add attribution but do not bypass Policy-as-code or SecretRef gates.",
    requiredInputs: ["actorId", "serviceAccountId", "roles", "authMode", "repoId"],
    requiredStaticBehavior: "Deny when required GitHub App gates or policy conditions are missing.",
    futureBundleExpectation: "Bundle must treat service-account identity as subject metadata, not a bypass.",
    metadata: { serviceAccountCredentialIssued: false }
  },
  {
    id: "tenant_scope_mismatch_denied_future",
    domain: "dashboard_readiness_access",
    action: "readiness.read",
    title: "Tenant scope mismatch denied in future",
    expectedDecision: "deny",
    expectedReason: "future production tenant scope mismatch must deny cross-tenant readiness or audit reads.",
    requiredInputs: ["actorId", "tenantId", "resource.tenantId", "requestId", "correlationId"],
    requiredStaticBehavior: "Current metadata-only scope model does not enforce production tenant isolation.",
    futureBundleExpectation: "Bundle must deny tenant mismatch once production tenant enforcement exists.",
    metadata: { productionTenantEnforcementImplemented: false }
  }
];

export const defaultPolicyRuntimePocReadinessChecks: PolicyRuntimePocReadinessCheck[] = [
  {
    id: "policy_runtime_poc_goals_documented",
    category: "goals",
    name: "PoC goals documented",
    status: "pass",
    severity: "medium",
    description: "Runtime PoC goals and boundaries are documented without implementing an evaluator.",
    remediation: "Keep runtime implementation behind a future explicit task.",
    evidence: ["docs/roadmaps/policy-bundle-runtime-poc/v0-plan.md"],
    metadata: { runtimeImplemented: false }
  },
  {
    id: "policy_runtime_poc_input_contract_defined",
    category: "input_contract",
    name: "Policy input/output contract defined",
    status: "pass",
    severity: "high",
    description: "A normalized input and output contract exists for future shadow evaluation.",
    remediation: "Add schema validation before any future runtime evaluator or bundle loader.",
    evidence: ["docs/roadmaps/policy-bundle-runtime-poc/policy-io-contract-v0.md", "docs/roadmaps/policy-bundle-runtime-poc/golden-test-harness-v1.md"],
    metadata: { schemaValidatorImplemented: false }
  },
  {
    id: "policy_runtime_poc_domain_mapping_complete",
    category: "domain_mapping",
    name: "PoC domains mapped",
    status: "pass",
    severity: "high",
    description: "Git, GitHub App, webhook, LLM, MCP, SecretRef/Vault, Runner, Local Agent, Registry, Governance, Dashboard, and Observability domains are mapped.",
    remediation: "Keep mappings synchronized with new static policy actions.",
    evidence: ["docs/roadmaps/policy-bundle-runtime-poc/domain-poc-mapping-v0.md"],
    metadata: { mappedDomainCount: 13 }
  },
  {
    id: "policy_runtime_poc_golden_cases_defined",
    category: "golden_tests",
    name: "Golden decision cases defined",
    status: "pass",
    severity: "high",
    description: "Golden decision cases define expected allow/deny/block/warn/exclude outcomes without running a policy runtime.",
    remediation: "Keep golden fixtures synchronized with StaticPolicyEngine before any future shadow evaluator.",
    evidence: ["docs/roadmaps/policy-bundle-runtime-poc/golden-decision-tests-v0.md", "docs/roadmaps/policy-bundle-runtime-poc/golden-test-harness-v1.md"],
    metadata: { goldenHarnessImplemented: true, sourceOfTruth: "StaticPolicyEngine" }
  },
  {
    id: "policy_runtime_poc_shadow_evaluator_future",
    category: "shadow_evaluation",
    name: "Shadow evaluator is future work",
    status: "fail",
    severity: "critical",
    description: "No shadow evaluator exists yet; StaticPolicyEngine remains the only source of truth.",
    remediation: "Implement shadow evaluation only after offline golden fixtures pass.",
    evidence: ["docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v0.md"],
    metadata: { shadowEvaluatorImplemented: false }
  },
  {
    id: "policy_runtime_poc_runtime_execution_disabled",
    category: "safety",
    name: "Runtime execution disabled",
    status: "pass",
    severity: "critical",
    description: "No OPA, Cedar, JSON/YAML evaluator, custom policy service, dynamic code execution, remote policy loading, or hot reload is implemented.",
    remediation: "Preserve this invariant until a future runtime PoC task is explicitly approved.",
    evidence: ["packages/policy/src/engine.ts", "packages/deployment-readiness/src/catalog.ts"],
    metadata: { dynamicPolicyExecutionEnabled: false, remotePolicyLoadingEnabled: false }
  },
  {
    id: "policy_runtime_poc_rollout_rollback_planned",
    category: "rollback",
    name: "Rollout and rollback strategy planned",
    status: "warning",
    severity: "high",
    description: "Rollout phases and rollback triggers are documented, but no controller or runtime switch exists.",
    remediation: "Add rollout state and rollback pinning only after shadow evaluation proves stable.",
    evidence: ["docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v0.md"],
    metadata: { rolloutControllerImplemented: false, rollbackImplemented: false }
  },
  {
    id: "policy_runtime_poc_dashboard_panel_available",
    category: "dashboard",
    name: "Dashboard panel available",
    status: "pass",
    severity: "low",
    description: "Dashboard exposes read-only Policy Runtime PoC planning status.",
    remediation: "Keep dashboard/API surfaces read-only and sanitized.",
    evidence: ["apps/api/src/dashboard-read-model.ts", "apps/web/src/render.ts"],
    metadata: { dashboardReadOnly: true }
  }
];

export const defaultPolicyRuntimePocRisks: PolicyRuntimePocRisk[] = [
  {
    id: "policy_runtime_poc_risk_dynamic_execution",
    category: "runtime_safety",
    title: "Dynamic policy execution accidentally introduced",
    severity: "critical",
    likelihood: "medium",
    impact: "A runtime PoC could execute untrusted policy logic or bypass existing safety gates.",
    mitigation: "Keep this milestone planning-only and block eval, new Function, WASM policy execution, remote loading, and hot reload.",
    status: "open",
    metadata: { dynamicPolicyExecutionEnabled: false }
  },
  {
    id: "policy_runtime_poc_risk_shadow_mismatch",
    category: "shadow_evaluation",
    title: "Shadow decisions diverge from StaticPolicyEngine",
    severity: "high",
    likelihood: "high",
    impact: "A future runtime could allow operations currently denied by static policy.",
    mitigation: "Require offline golden fixtures and shadow mismatch review before any enforcement.",
    status: "open",
    metadata: { staticPolicyEngineSourceOfTruth: true }
  },
  {
    id: "policy_runtime_poc_risk_scope_gap",
    category: "input_contract",
    title: "Input contract lacks production tenant scope",
    severity: "critical",
    likelihood: "high",
    impact: "A future runtime could make cross-tenant decisions without trustworthy tenant, repo, provider, SecretRef, or audit query scope.",
    mitigation: "Block enforcement until production Auth/RBAC and tenant scope enforcement exist.",
    status: "open",
    metadata: { productionTenantEnforcementImplemented: false }
  },
  {
    id: "policy_runtime_poc_risk_secret_exposure",
    category: "safety",
    title: "Policy input/output exposes secrets or env values",
    severity: "critical",
    likelihood: "medium",
    impact: "A future evaluator or audit record could leak credentials, secret values, env values, prompts, or raw webhook payloads.",
    mitigation: "Use only metadata fields and require redaction obligations in every output.",
    status: "open",
    metadata: { noSecretsExposed: true, envValuesExposed: false }
  },
  {
    id: "policy_runtime_poc_risk_operational_complexity",
    category: "migration",
    title: "PoC selects a high-complexity runtime too early",
    severity: "high",
    likelihood: "medium",
    impact: "A service-based or expressive runtime could add availability, latency, and review burden before contracts are stable.",
    mitigation: "Start with signed JSON/YAML golden fixtures and shadow-only comparison.",
    status: "open",
    metadata: { recommendedPocOptionId: "policy_runtime_poc_signed_json_yaml" }
  }
];

export const defaultPolicyShadowEvaluationPlan: PolicyShadowEvaluationPlan = {
  id: "policy_shadow_evaluation_v1_plan",
  status: "ready_for_design",
  sourceOfTruth: "StaticPolicyEngine",
  candidateRuntimeKinds: [
    "signed_json_yaml_bundle",
    "opa_rego",
    "cedar",
    "custom_future",
    "signed_json_yaml_bundle_evaluator_future",
    "opa_rego_local_library_future",
    "cedar_local_evaluator_future",
    "custom_policy_decision_service_future"
  ],
  domains: [
    "git",
    "git_webhook",
    "llm",
    "mcp",
    "runner",
    "registry",
    "improvement",
    "secretref",
    "secrets_sandbox",
    "local_agent",
    "provider",
    "auth",
    "dashboard",
    "deployment_readiness",
    "git_remote_operation",
    "github_app_token_issuance",
    "github_webhook_processing",
    "llm_remote_completion",
    "llm_fallback",
    "mcp_tool_invocation",
    "secretref_vault_credential_resolution",
    "runner_command_execution",
    "local_agent_invocation",
    "registry_mutation",
    "governance_apply_gate",
    "dashboard_readiness_access",
    "observability_audit_query"
  ],
  rolloutStages: [
    "docs_planning",
    "golden_harness_only",
    "offline_candidate_runtime_evaluation_future",
    "live_shadow_record_only_future",
    "critical_mismatch_alerting_future",
    "selected_non_critical_enforcement_future",
    "production_enforcement_future"
  ],
  enforcementMode: "shadow_only",
  metadata: {
    docs: "docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v1.md",
    planDocs: "docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v1-plan.md",
    candidateRuntimeInterfaceDocs: "docs/roadmaps/policy-bundle-runtime-poc/candidate-runtime-interface-v1.md",
    staticPolicyEngineAuthoritative: true,
    enforcementChanged: false,
    shadowEvaluatorImplemented: false,
    candidateRuntimeImplemented: false,
    dynamicPolicyExecutionEnabled: false,
    externalPolicyServiceCallsEnabled: false,
    noSecretsOrEnvValues: true,
    runtimeExecutionImplemented: false
  }
};

export const defaultPolicyShadowComparisonRules: PolicyShadowComparisonRule[] = [
  {
    id: "policy_shadow_compare_effect_match",
    comparisonKind: "effect_match",
    required: true,
    severityOnMismatch: "critical",
    metadata: { compares: ["decision", "allowed"], blocksRuntimeRolloutFuture: true }
  },
  {
    id: "policy_shadow_compare_reason_match",
    comparisonKind: "reason_match",
    required: false,
    severityOnMismatch: "medium",
    metadata: { normalizedTextMatchAllowed: true, recordOnlyInV1: true }
  },
  {
    id: "policy_shadow_compare_rule_id_match",
    comparisonKind: "rule_id_match",
    required: true,
    severityOnMismatch: "high",
    metadata: { acceptsExplicitRuleAliasMappingFuture: true }
  },
  {
    id: "policy_shadow_compare_obligation_match",
    comparisonKind: "obligation_match",
    required: true,
    severityOnMismatch: "high",
    metadata: { obligationsMayIncludeApprovalLeaseRedactionOrBudgetRequirements: true }
  },
  {
    id: "policy_shadow_compare_redaction_match",
    comparisonKind: "redaction_match",
    required: true,
    severityOnMismatch: "critical",
    metadata: { rawSecretOrPromptExposureBlocksRolloutFuture: true }
  },
  {
    id: "policy_shadow_compare_audit_metadata_match",
    comparisonKind: "audit_metadata_match",
    required: true,
    severityOnMismatch: "medium",
    metadata: { requiredFields: ["action", "resourceKind", "actor", "requestId", "correlationId"], recordOnlyInV1: true }
  }
];

export const defaultPolicyShadowMismatches: PolicyShadowMismatch[] = [
  {
    id: "policy_shadow_mismatch_static_allow_candidate_deny",
    mismatchKind: "static_allow_candidate_deny",
    severity: "medium",
    defaultAction: "record_only",
    productionImpact: "Candidate runtime could block an operation currently allowed by the static source of truth; future enforcement could create false denials for safe read-only workflows.",
    metadata: { example: "Static allows low-risk mock MCP read but candidate denies.", rolloutImpact: "review_before_rollout" }
  },
  {
    id: "policy_shadow_mismatch_static_deny_candidate_allow",
    mismatchKind: "static_deny_candidate_allow",
    severity: "critical",
    defaultAction: "block_rollout_future",
    productionImpact: "Candidate runtime could allow an operation denied by StaticPolicyEngine, including destructive provider or secret-adjacent actions; future enforcement could allow operations currently denied by static policy.",
    metadata: { examples: ["force push", "secret.read", "credential cache read", "MCP critical tool"], rolloutImpact: "block_rollout" }
  },
  {
    id: "policy_shadow_mismatch_static_block_candidate_allow",
    mismatchKind: "static_block_candidate_allow",
    severity: "critical",
    defaultAction: "block_rollout_future",
    productionImpact: "Candidate runtime could bypass a static block such as governance apply, credential cache read, critical MCP invocation, or destructive Git.",
    metadata: { rolloutImpact: "blocks_rollout", example: "Static blocks governance apply but candidate allows it." }
  },
  {
    id: "policy_shadow_mismatch_reason_mismatch",
    mismatchKind: "reason_mismatch",
    severity: "low",
    defaultAction: "record_only",
    productionImpact: "Decision outcome may match, but operators could lose useful review context.",
    metadata: { rolloutImpact: "review_before_alerting", example: "Both deny but candidate omits the branch prefix reason." }
  },
  {
    id: "policy_shadow_mismatch_rule_id_mismatch",
    mismatchKind: "rule_id_mismatch",
    severity: "medium",
    defaultAction: "record_only",
    productionImpact: "Auditors may not be able to trace a candidate decision to the equivalent static rule; future enforcement could bypass a hard block such as governance apply.",
    metadata: { example: "Static blocks governance apply but candidate allows.", rolloutImpact: "block_rollout" }
  },
  {
    id: "policy_shadow_mismatch_missing_obligation",
    mismatchKind: "missing_obligation",
    severity: "high",
    defaultAction: "block_rollout_future",
    productionImpact: "Candidate runtime may omit required approvals, leases, budgets, redaction, or audit obligations; future enforcement could skip required review, redaction, lease, or audit obligations.",
    metadata: { rolloutImpact: "block_enforcement", example: "Candidate allows remote LLM without budget obligation metadata." }
  },
  {
    id: "policy_shadow_mismatch_extra_obligation",
    mismatchKind: "extra_obligation",
    severity: "low",
    defaultAction: "record_only",
    productionImpact: "Candidate runtime may add a requirement that changes UX or operational review without changing enforcement yet.",
    metadata: { rolloutImpact: "review_required", example: "Candidate adds manual review to a low-risk mock read." }
  },
  {
    id: "policy_shadow_mismatch_redaction_mismatch",
    mismatchKind: "redaction_mismatch",
    severity: "critical",
    defaultAction: "block_rollout_future",
    productionImpact: "Candidate runtime may fail to preserve no-secret, no-env, no-token, prompt, credential-cache, or webhook payload redaction requirements.",
    metadata: { rolloutImpact: "blocks_rollout", example: "Candidate audit metadata includes an env value that static policy never returns." }
  },
  {
    id: "policy_shadow_mismatch_audit_metadata_mismatch",
    mismatchKind: "audit_metadata_mismatch",
    severity: "medium",
    defaultAction: "alert_future",
    productionImpact: "Candidate runtime may weaken traceability for request, correlation, actor, service account, tenant, or resource scope metadata.",
    metadata: { rolloutImpact: "requires_audit_review", example: "Candidate omits serviceAccountId or correlationId." }
  },
  {
    id: "policy_shadow_mismatch_error_in_candidate",
    mismatchKind: "error_in_candidate",
    severity: "high",
    defaultAction: "block_rollout_future",
    productionImpact: "Candidate runtime errors could create noisy reports or hide decision gaps; enforcement still stays on StaticPolicyEngine.",
    metadata: { rolloutImpact: "blocks_candidate_runtime_activation", example: "Candidate evaluator throws while static decision succeeds." }
  }
];

export const defaultPolicyShadowEvaluationReports: PolicyShadowEvaluationReport[] = [
  {
    id: "policy_shadow_report_planning_only_v1",
    generatedAt: new Date("2026-05-17T00:00:00.000Z"),
    domain: "deployment_readiness",
    caseCount: 0,
    matchCount: 0,
    mismatchCount: 0,
    criticalMismatchCount: 0,
    enforcementChanged: false,
    sourceOfTruth: "StaticPolicyEngine",
    candidateRuntimeKind: "signed_json_yaml_bundle",
    metadata: {
      planningOnly: true,
      candidateRuntimeExecuted: false,
      goldenCasesLinked: true,
      reportFormatDefinedOnly: true,
      noExternalObservabilityExport: true
    }
  }
];

export const defaultPolicyShadowReadinessChecks: PolicyShadowReadinessCheck[] = [
  {
    id: "policy_shadow_input_contract_planned",
    category: "input_contract",
    status: "warning",
    severity: "medium",
    description: "Candidate runtime input and output contracts are documented, but no runtime interface is implemented.",
    remediation: "Implement a non-executing schema contract before any candidate evaluator is wired.",
    metadata: { docs: "docs/roadmaps/policy-bundle-runtime-poc/candidate-runtime-interface-v1.md", interfaceImplemented: false }
  },
  {
    id: "policy_shadow_golden_cases_available",
    category: "golden_cases",
    status: "pass",
    severity: "medium",
    description: "Golden policy decisions remain anchored to StaticPolicyEngine as the source of truth.",
    remediation: "Keep golden cases deterministic and expand coverage before candidate runtime evaluation.",
    metadata: { sourceOfTruth: "StaticPolicyEngine", goldenHarnessStatus: "v1_implemented" }
  },
  {
    id: "policy_shadow_input_contract_ready",
    category: "input_contract",
    status: "pass",
    severity: "high",
    description: "Policy Runtime PoC input/output contract exists for future shadow comparisons.",
    remediation: "Add schema validation before candidate runtime execution.",
    metadata: { docs: "docs/roadmaps/policy-bundle-runtime-poc/policy-io-contract-v0.md" }
  },
  {
    id: "policy_shadow_golden_cases_ready",
    category: "golden_cases",
    status: "pass",
    severity: "high",
    description: "Golden Harness v1 provides deterministic StaticPolicyEngine decisions for future candidate comparison.",
    remediation: "Keep golden cases synchronized with static policy rule changes.",
    metadata: { goldenHarnessImplemented: true, sourceOfTruth: "StaticPolicyEngine" }
  },
  {
    id: "policy_shadow_candidate_runtime_future",
    category: "candidate_runtime",
    status: "future",
    severity: "critical",
    description: "No candidate policy runtime is implemented or executed in this milestone; shadow evaluation cannot run yet.",
    remediation: "Implement a candidate runtime only in a future explicit task and keep it shadow-only.",
    metadata: { candidateRuntimeImplemented: false, candidateRuntimeExecuted: false, shadowEvaluationCanRun: false }
  },
  {
    id: "policy_shadow_comparison_rules_defined",
    category: "comparison_rules",
    status: "pass",
    severity: "high",
    description: "Comparison rules define effect, reason, rule id, obligation, redaction, and audit metadata checks.",
    remediation: "Keep effect and redaction mismatches rollout-blocking before future runtime activation; extend comparison rules when new output obligations are added.",
    metadata: { comparisonRuleCount: defaultPolicyShadowComparisonRules.length }
  },
  {
    id: "policy_shadow_audit_events_planned",
    category: "audit",
    status: "warning",
    severity: "medium",
    description: "Shadow audit events are documented but not emitted by runtime code.",
    remediation: "Add sanitized audit persistence before live shadow evaluation.",
    metadata: { auditEmissionImplemented: false, noSecretsExposed: true }
  },
  {
    id: "policy_shadow_observability_planned",
    category: "observability",
    status: "warning",
    severity: "medium",
    description: "Shadow metrics are planned as internal read models only; no external exporter is enabled.",
    remediation: "Add durable metrics and alert thresholds before critical mismatch alerting.",
    metadata: { externalObservabilityExportEnabled: false }
  },
  {
    id: "policy_shadow_dashboard_panel_available",
    category: "dashboard",
    status: "pass",
    severity: "low",
    description: "Dashboard/readiness can show planning status without implying shadow evaluation is running.",
    remediation: "Keep candidate runtime and enforcement flags false.",
    metadata: { dashboardReadOnly: true }
  },
  {
    id: "policy_shadow_rollout_future",
    category: "rollout",
    status: "future",
    severity: "high",
    description: "Rollout stages are documented only; live shadow and enforcement stages remain future.",
    remediation: "Implement record-only live shadow after offline evaluation and observability are ready.",
    metadata: { liveShadowEvaluationEnabled: false, runtimeActivationImplemented: false }
  },
  {
    id: "policy_shadow_rollback_future",
    category: "rollback",
    status: "future",
    severity: "high",
    description: "Rollback behavior is documented only; disabling shadow keeps StaticPolicyEngine authoritative.",
    remediation: "Add candidate bundle invalidation and audit events before live shadow rollout.",
    metadata: { rollbackControllerImplemented: false }
  },
  {
    id: "policy_shadow_safety_guarantees_hold",
    category: "safety",
    status: "pass",
    severity: "critical",
    description: "No enforcement change, no candidate execution, no dynamic policy execution, no external calls, and no secrets/env values are exposed.",
    remediation: "Reject any future change that weakens StaticPolicyEngine authority or executes dynamic policy code by default.",
    metadata: {
      enforcementChanged: false,
      staticPolicyEngineAuthoritative: true,
      dynamicPolicyExecutionEnabled: false,
      externalPolicyServiceCallsEnabled: false,
      noSecretsOrEnvValues: true,
      auditEventsEmitted: false
    }
  },
  {
    id: "policy_shadow_observability_metrics_planned",
    category: "observability",
    status: "future",
    severity: "medium",
    description: "Shadow metrics are planned as local/read-model metadata only.",
    remediation: "Add metrics after shadow reporting exists; external export requires separate approval.",
    metadata: { externalObservabilityExportEnabled: false }
  },
  {
    id: "policy_shadow_dashboard_planning_visible",
    category: "dashboard",
    status: "pass",
    severity: "low",
    description: "Dashboard read model exposes shadow planning status without claiming shadow evaluation is running.",
    remediation: "Keep dashboard/API surfaces read-only and sanitized.",
    metadata: { dashboardReadOnly: true }
  },
  {
    id: "policy_shadow_rollout_stages_planned",
    category: "rollout",
    status: "future",
    severity: "high",
    description: "Rollout stages are documented, but no rollout controller or runtime selector exists.",
    remediation: "Implement rollout controls only after offline and live shadow comparisons are stable.",
    metadata: { rolloutControllerImplemented: false }
  },
  {
    id: "policy_shadow_rollback_strategy_planned",
    category: "rollback",
    status: "pass",
    severity: "high",
    description: "Rollback keeps StaticPolicyEngine as source of truth and disables future shadow/candidate paths.",
    remediation: "Add runtime switches only after rollback audit and bundle invalidation behavior are implemented.",
    metadata: { enforcementChanged: false }
  },
  {
    id: "policy_shadow_safety_invariants_hold",
    category: "safety",
    status: "pass",
    severity: "critical",
    description: "No dynamic policy execution, external policy service, remote loading, hot reload, secrets, or env values are exposed.",
    remediation: "Block any future task that violates shadow-only safety constraints.",
    metadata: {
      dynamicPolicyExecutionEnabled: false,
      policyCodeExecuted: false,
      externalPolicyServiceCallsEnabled: false,
      noSecretsExposed: true,
      envValuesExposed: false
    }
  }
];

export const defaultStagingDeploymentProfile: StagingDeploymentProfile = {
  id: "staging_profile_v0",
  name: "staging",
  description: "Non-production controlled validation profile. It defines gates and readiness expectations but does not deploy Aichestra or allow production traffic.",
  status: "not_ready",
  requiredComponents: ["api", "web", "worker", "migration-job", "background-job"],
  requiredEnvGates: [
    "AICHESTRA_STORAGE_PROVIDER",
    "AICHESTRA_DATABASE_URL",
    "AICHESTRA_DASHBOARD_DATA_SOURCE"
  ],
  forbiddenEnvGates: [
    "AICHESTRA_ALLOW_REMOTE_MERGE",
    "AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION",
    "AICHESTRA_ENABLE_MCP_REAL_TRANSPORT",
    "GITHUB_APP_PRIVATE_KEY"
  ],
  allowedIntegrations: ["postgres", "github_app", "github_webhook", "llm_remote", "local_agent"],
  blockedIntegrations: ["mcp_remote", "observability_export"],
  requiredStorageMode: "postgres_required",
  requiredAuthMode: "future_oidc_saml",
  requiredSecretMode: "real_secret_backend_required",
  requiredPolicyMode: "managed_bundle_required",
  requiredObservabilityMode: "required_external_stack",
  readinessChecks: [
    "staging_storage_postgres_required",
    "staging_auth_mock_actor_warning",
    "staging_secret_backend_required",
    "staging_git_remote_merge_forbidden",
    "staging_mcp_remote_forbidden",
    "staging_dashboard_api_required"
  ],
  productionBlockers: [
    "production_auth_not_implemented",
    "real_secret_backend_not_implemented",
    "policy_bundle_runtime_not_implemented",
    "external_observability_export_not_implemented",
    "db_backup_restore_pooling_not_implemented"
  ],
  metadata: {
    productionTrafficAllowed: false,
    stagingDeployed: false,
    deploymentArtifactsCreated: false,
    profileContractDocs: "docs/roadmaps/staging-deployment-profile/profile-contract-v0.md"
  }
};

export const defaultStagingDeploymentDryRunProfile: StagingDeploymentDryRunProfile = {
  id: "staging_dry_run_profile_v0",
  name: "Staging Deployment Dry-run Profile v0",
  status: "ready_to_evaluate",
  description: "Read-only dry-run profile that aggregates staging readiness sources before any staging deployment validation attempt.",
  requiredReadinessSources: [
    "staging_profile",
    "ci_cd",
    "postgres",
    "github_app",
    "llm_gateway",
    "mcp_gateway",
    "auth_rbac",
    "secret_backend",
    "secretref_credentials",
    "policy_bundle",
    "observability",
    "dashboard",
    "local_agent",
    "runner",
    "git"
  ],
  optionalReadinessSources: ["github_integration_tests", "llm_integration_tests"],
  blockedCapabilities: [
    "deployment_execution",
    "production_traffic",
    "external_provider_calls",
    "remote_integration_test_execution",
    "remote_merge",
    "force_push",
    "branch_deletion",
    "vendor_cli_execution",
    "real_mcp_transport_without_policy_secret_sandbox_readiness",
    "secret_or_env_value_exposure",
    "credential_cache_reads"
  ],
  allowedCapabilities: [
    "read_only_readiness_aggregation",
    "sanitized_counts_statuses_and_booleans",
    "deterministic_blocker_classification",
    "dashboard_and_api_read_models",
    "promotion_and_rollback_guidance"
  ],
  dryRunMode: "read_only",
  metadata: {
    docs: "docs/roadmaps/staging-deployment-dry-run/v0.md",
    planDocs: "docs/roadmaps/staging-deployment-dry-run/v0-plan.md",
    reportFormatDocs: "docs/roadmaps/staging-deployment-dry-run/report-format-v0.md",
    blockerTaxonomyDocs: "docs/roadmaps/staging-deployment-dry-run/blocker-taxonomy-v0.md",
    deploymentImplemented: false,
    integrationTestsExecutedByDryRun: false,
    externalCallsEnabled: false,
    secretsReturned: false,
    envValuesReturned: false
  }
};

export const defaultStagingReleaseCandidateChecklist: StagingReleaseCandidateChecklist = {
  id: "staging_release_candidate_checklist_v0",
  name: "Staging Release Candidate Checklist v0",
  status: "ready_to_evaluate",
  description: "Read-only checklist that defines whether a commit or branch can be called a staging release candidate without creating a release or deploying anything.",
  requiredValidationGates: [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm build",
    "git diff --check",
    "safe integration scan",
    "no-secret/no-env exposure scan",
    "docs update check",
    "dashboard/readiness no-secret check"
  ],
  optionalIntegrationProfiles: [
    "optional_postgres_repository_contracts",
    "optional_remote_git_integration",
    "github_app_integration_test_profile_v1",
    "github_webhook_integration",
    "llm_gateway_integration_test_profile_v1",
    "future_remote_mcp_profile",
    "future_external_auth_profile"
  ],
  allowedSkippedTests: [
    "postgres_contract_skipped_without_AICHESTRA_TEST_DATABASE_URL",
    "remote_git_skipped_without_all_explicit_gates",
    "github_app_integration_skipped_without_all_explicit_gates",
    "github_webhook_integration_skipped_without_all_explicit_gates",
    "llm_integration_skipped_without_all_explicit_gates",
    "remote_mcp_future_blocked_by_default",
    "external_auth_future_blocked_by_default"
  ],
  blockerPolicy: [
    "critical_blocker_blocks_release_candidate",
    "validation_failure_blocks_release_candidate",
    "secret_or_env_exposure_blocks_release_candidate",
    "remote_merge_force_push_branch_delete_blocks_release_candidate",
    "release_or_deployment_execution_blocks_release_candidate",
    "production_ready_or_staging_deployed_overclaim_blocks_release_candidate"
  ],
  requiredSignoffs: [
    "engineering_owner",
    "platform_owner",
    "security_reviewer",
    "product_owner",
    "qa_reviewer",
    "release_manager"
  ],
  requiredReleaseNotes: [
    "summary",
    "changed_areas",
    "validation",
    "skipped_tests",
    "known_limitations",
    "safety_gates",
    "migration_notes",
    "dashboard_readiness",
    "rollback_notes",
    "follow_ups"
  ],
  rollbackChecklist: [
    "code_revert",
    "database",
    "config",
    "feature_flags",
    "git_integration",
    "llm_integration",
    "secrets",
    "observability",
    "dashboard"
  ],
  knownLimitations: [
    "No staging deployment execution exists.",
    "No release is created by this checklist.",
    "No Git tag or GitHub release is created.",
    "Production auth remains planning-only.",
    "Real secret backend remains planning-only.",
    "External observability backend and audit export remain future work.",
    "Optional GitHub and LLM live integration profiles are skipped by default."
  ],
  metadata: {
    docs: "docs/roadmaps/staging-release-candidate/v0.md",
    planDocs: "docs/roadmaps/staging-release-candidate/v0-plan.md",
    reportFormatDocs: "docs/roadmaps/staging-release-candidate/report-format-v0.md",
    releaseNotesTemplateDocs: "docs/roadmaps/staging-release-candidate/release-notes-template-v0.md",
    rollbackChecklistDocs: "docs/roadmaps/staging-release-candidate/rollback-checklist-v0.md",
    releaseCreated: false,
    deploymentExecuted: false,
    gitTagCreated: false,
    githubReleaseCreated: false,
    externalCallsEnabled: false,
    secretsReturned: false,
    envValuesReturned: false
  }
};

export const defaultStagingDeploymentExecutionPlan: StagingDeploymentExecutionPlan = {
  id: "staging_deployment_execution_plan_v0",
  name: "Staging Deployment Execution Plan v0",
  status: "ready_for_signoff",
  description: "Read-only, non-deploying execution plan for a future controlled staging deployment validation after human signoff.",
  requiredSignoffs: [
    "engineering_owner",
    "platform_owner",
    "security_reviewer",
    "product_owner",
    "qa_reviewer",
    "release_manager"
  ],
  requiredPreDeployChecks: [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm build",
    "git diff --check",
    "safe integration scan",
    "no-secret/no-env exposure scan",
    "staging RC pass or pass_with_warnings",
    "human signoff collected",
    "release notes present",
    "rollback plan present"
  ],
  optionalIntegrationChecks: [
    "optional_postgres_repository_contracts",
    "github_app_integration_test_profile_v1",
    "github_webhook_integration",
    "llm_gateway_integration_test_profile_v1",
    "vault_integration_test_profile_v1",
    "future_mcp_integration",
    "future_external_auth_integration",
    "future_vendor_cli_integration"
  ],
  deploymentSteps: [
    "confirm_worktree_or_diff_scope",
    "confirm_node_volta_baseline",
    "run_required_validation",
    "confirm_staging_rc_decision",
    "collect_human_signoffs",
    "freeze_config_environment_gates",
    "decide_optional_live_integration_tests",
    "confirm_postgres_staging_db_decision",
    "confirm_secret_backend_vault_decision",
    "confirm_github_app_integration_decision",
    "confirm_llm_integration_decision",
    "confirm_mcp_mock_future_policy",
    "confirm_auth_rbac_staging_approval",
    "confirm_dashboard_readiness_surfaces",
    "confirm_observability_audit_readiness",
    "confirm_rollback_plan",
    "final_go_no_go_decision",
    "future_deployment_execution_placeholder",
    "post_deployment_smoke_test_placeholder",
    "post_deployment_review_placeholder"
  ],
  postDeployChecks: [
    "GET /health",
    "GET /dashboard/overview",
    "GET /dashboard/staging",
    "GET /dashboard/staging-dry-run",
    "GET /dashboard/staging-rc",
    "GET /dashboard/observability",
    "GET /readiness/deployment/summary",
    "GET /readiness/staging-dry-run/summary",
    "GET /readiness/staging-rc/summary",
    "GET /observability/audit/summary",
    "no-secret/no-env smoke check"
  ],
  rollbackSteps: [
    "code_rollback",
    "config_rollback",
    "environment_gate_rollback",
    "database_migration_rollback_decision",
    "github_integration_gate_rollback",
    "llm_integration_gate_rollback",
    "vault_secretref_gate_rollback",
    "dashboard_readiness_rollback",
    "observability_audit_review",
    "manual_verification"
  ],
  goNoGoCriteria: [
    "no critical blockers",
    "required validation gates pass",
    "no secret or env value exposure",
    "staging RC accepted as pass or pass_with_warnings",
    "all required human signoffs collected",
    "release notes and rollback plan present",
    "optional integration decisions documented",
    "deployment remains unexecuted until an explicit future task"
  ],
  metadata: {
    docs: "docs/roadmaps/staging-deployment-execution/v0.md",
    planDocs: "docs/roadmaps/staging-deployment-execution/v0-plan.md",
    executionSequenceDocs: "docs/roadmaps/staging-deployment-execution/execution-sequence-v0.md",
    preDeployGatesDocs: "docs/roadmaps/staging-deployment-execution/pre-deploy-gates-v0.md",
    liveIntegrationDecisionDocs: "docs/roadmaps/staging-deployment-execution/live-integration-decision-v0.md",
    postDeploySmokeDocs: "docs/roadmaps/staging-deployment-execution/post-deploy-smoke-checks-v0.md",
    rollbackPlanDocs: "docs/roadmaps/staging-deployment-execution/rollback-plan-v0.md",
    humanSignoffPackDocs: "docs/roadmaps/staging-deployment-execution/human-signoff-pack-v0.md",
    signoffEvidenceChecklistDocs: "docs/roadmaps/staging-deployment-execution/signoff-evidence-checklist-v0.md",
    signoffDecisionPolicyDocs: "docs/roadmaps/staging-deployment-execution/signoff-decision-policy-v0.md",
    signoffPackAvailable: true,
    signoffStatus: "pending",
    approvedSignoffCount: 0,
    conditionalSignoffCount: 0,
    rejectedSignoffCount: 0,
    missingRequiredSignoffCount: 6,
    actualDeploymentBlocked: true,
    deploymentExecuted: false,
    releaseCreated: false,
    gitTagCreated: false,
    externalCallsEnabled: false,
    secretsReturned: false,
    envValuesReturned: false,
    productionReady: false,
    stagingDeployed: false
  }
};

export const defaultStagingIntegrationGates: StagingIntegrationGate[] = [
  {
    id: "staging_gate_postgres",
    integrationKind: "postgres",
    status: "gated",
    requiredEnvVars: ["AICHESTRA_STORAGE_PROVIDER", "AICHESTRA_DATABASE_URL"],
    forbiddenEnvVars: [],
    requiredPolicies: ["database.migration.readiness", "database.url.no_value_exposure"],
    requiredSecrets: ["database_url_future_secretref_or_platform_config"],
    notes: ["Postgres is required or strongly recommended for staging; the readiness model reports booleans/counts only."],
    metadata: { storageProviderRequiredValue: "postgres", databaseUrlValueExposed: false, productionDbConnectionAttempted: false }
  },
  {
    id: "staging_gate_github_app",
    integrationKind: "github_app",
    status: "gated",
    requiredEnvVars: ["AICHESTRA_GITHUB_AUTH_MODE", "AICHESTRA_ENABLE_GITHUB_APP", "AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF", "AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS", "AICHESTRA_GITHUB_APP_ALLOWED_REPOS"],
    forbiddenEnvVars: ["GITHUB_APP_PRIVATE_KEY", "AICHESTRA_GITHUB_APP_PRIVATE_KEY"],
    requiredPolicies: ["github_app.installation_token.issue", "github_app.repo_grant.use", "git.remote_operation"],
    requiredSecrets: ["github_app_private_key_secretref_metadata"],
    notes: ["Controlled v1 issues mock token handles only; live installation-token exchange remains future."],
    metadata: { liveGitHubAppCallsEnabled: false, tokenHandlesOnly: true, privateKeyValueSupported: false }
  },
  {
    id: "staging_gate_github_webhook",
    integrationKind: "github_webhook",
    status: "gated",
    requiredEnvVars: ["AICHESTRA_ENABLE_GITHUB_WEBHOOKS", "AICHESTRA_GITHUB_WEBHOOK_SECRET_REF"],
    forbiddenEnvVars: ["AICHESTRA_GITHUB_WEBHOOK_SECRET"],
    requiredPolicies: ["git.webhook.process"],
    requiredSecrets: ["github_webhook_secret_ref"],
    notes: ["Webhook signature verification and repo allowlists are required; webhook-triggered agent execution remains forbidden."],
    metadata: { signatureVerificationRequired: true, rawPayloadStorage: false, agentExecutionFromWebhook: false }
  },
  {
    id: "staging_gate_llm_remote",
    integrationKind: "llm_remote",
    status: "gated",
    requiredEnvVars: ["AICHESTRA_LLM_INTEGRATION_TESTS", "AICHESTRA_LLM_PROVIDER", "AICHESTRA_ENABLE_REMOTE_LLM", "AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION", "AICHESTRA_LLM_API_KEY_SECRET_REF", "AICHESTRA_LLM_ALLOWED_MODELS", "AICHESTRA_LLM_DEFAULT_MODEL", "AICHESTRA_LLM_TEST_BUDGET_USD"],
    forbiddenEnvVars: ["AICHESTRA_LLM_API_KEY"],
    requiredPolicies: ["llm.remote_completion", "llm.model.use", "provider.credential.resolve"],
    requiredSecrets: ["llm_api_key_secretref"],
    notes: ["Remote completion is optional and must remain behind LLM integration-test profile gates, budget, model allowlist, SecretRef, Auth/RBAC, and Policy gates."],
    metadata: { mockOnlyDefault: true, remoteLlmDefault: false, byokImplemented: false, streamingAllowed: false, toolCallsAllowed: false }
  },
  {
    id: "staging_gate_mcp_remote",
    integrationKind: "mcp_remote",
    status: "blocked",
    requiredEnvVars: [],
    forbiddenEnvVars: ["AICHESTRA_ENABLE_MCP_REAL_TRANSPORT"],
    requiredPolicies: ["mcp.tool.invoke.high_risk", "mcp.tool.invoke.critical"],
    requiredSecrets: [],
    notes: ["Real MCP transport, high/critical tools, write/deploy tools, and secret forwarding are blocked in staging v0."],
    metadata: { realTransportEnabled: false, highCriticalToolsEnabled: false, secretForwardingEnabled: false }
  },
  {
    id: "staging_gate_local_agent",
    integrationKind: "local_agent",
    status: "gated",
    requiredEnvVars: [],
    forbiddenEnvVars: ["AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION"],
    requiredPolicies: ["local_agent.invoke", "runner.command.execute"],
    requiredSecrets: [],
    notes: ["Local Agent Protocol remains mock/fixture-only; vendor CLI execution and credential cache reads are forbidden."],
    metadata: { fixtureOnly: true, vendorCliExecutionEnabled: false, credentialCacheAccessAllowed: false }
  },
  {
    id: "staging_gate_secret_backend",
    integrationKind: "secret_backend",
    status: "future",
    requiredEnvVars: ["AICHESTRA_SECRET_BACKEND_PROVIDER"],
    forbiddenEnvVars: ["AICHESTRA_ENABLE_ENV_SECRET_PROVIDER"],
    requiredPolicies: ["provider.credential.resolve", "secret.lease.request", "secret.lease.issue"],
    requiredSecrets: [],
    notes: ["A real secret backend is required before meaningful staging use, but no backend integration exists in v0."],
    metadata: { realBackendImplemented: false, envFallbackProductionReady: false }
  },
  {
    id: "staging_gate_auth_provider",
    integrationKind: "auth_provider",
    status: "future",
    requiredEnvVars: ["future OIDC/SAML/SCIM SecretRef-backed config"],
    forbiddenEnvVars: ["SESSION_SECRET", "JWT_SECRET"],
    requiredPolicies: ["auth.authorize", "policy.evaluate"],
    requiredSecrets: [],
    notes: ["Real Auth/RBAC is planned but not implemented; mock actor warnings must remain visible."],
    metadata: { productionAuthEnabled: false, externalIdpCallsEnabled: false, realSessionsImplemented: false }
  },
  {
    id: "staging_gate_policy_bundle",
    integrationKind: "policy_bundle",
    status: "future",
    requiredEnvVars: ["future policy bundle source and signing SecretRefs"],
    forbiddenEnvVars: ["POLICY_BUNDLE_SECRET", "OPA_TOKEN", "CEDAR_SECRET"],
    requiredPolicies: ["policy.evaluate"],
    requiredSecrets: [],
    notes: ["StaticPolicyEngine remains runtime; OPA/Cedar, signed bundles, remote loading, and dynamic policy execution are not enabled."],
    metadata: { staticPolicyRuntime: true, dynamicPolicyExecutionEnabled: false, externalPolicyEngineEnabled: false }
  },
  {
    id: "staging_gate_observability_export",
    integrationKind: "observability_export",
    status: "blocked",
    requiredEnvVars: [],
    forbiddenEnvVars: ["future observability exporter credentials"],
    requiredPolicies: ["observability.audit.read"],
    requiredSecrets: [],
    notes: ["Observability v0 is read-only/in-memory; audit export, alert delivery, and external exporters are blocked in staging v0."],
    metadata: { externalExporterEnabled: false, alertDeliveryEnabled: false, retentionDeletionJobsEnabled: false }
  }
];

export const defaultStagingReadinessChecks: StagingReadinessCheck[] = [
  {
    id: "staging_storage_postgres_required",
    category: "storage",
    name: "Postgres required for staging profile",
    status: "fail",
    severity: "high",
    description: "Staging must not depend on in-memory repositories for validation evidence.",
    remediation: "Configure Postgres through safe config/SecretRef-backed deployment plumbing and run migration readiness checks without exposing DB URL values.",
    evidence: ["docs/roadmaps/persistent-db-production-operations/v1.md", "docs/reference/staging-environment-gate-matrix.md"],
    metadata: { postgresRequired: true, databaseUrlValueExposed: false }
  },
  {
    id: "staging_migrations_visible",
    category: "storage",
    name: "Migration status visible",
    status: "pass",
    severity: "medium",
    description: "Persistent DB Production Operations v1 exposes local migration file metadata and checksums without executing migrations.",
    remediation: "Keep migration execution explicit and add release-controlled migration jobs later.",
    evidence: ["packages/deployment-readiness/src/service.ts", "infra/migrations/0001_initial_aichestra_schema.sql"],
    metadata: { automaticMigrationExecution: false }
  },
  {
    id: "staging_backup_restore_blocker",
    category: "storage",
    name: "Backup and restore remain staging blockers",
    status: "fail",
    severity: "high",
    description: "Backup jobs and restore drills are documented but not implemented.",
    remediation: "Add non-production restore drill evidence before treating staging as operationally meaningful.",
    evidence: ["docs/roadmaps/persistent-db-production-operations/backup-restore-runbook-v1.md"],
    metadata: { backupJobsImplemented: false, restoreDrillsImplemented: false }
  },
  {
    id: "staging_auth_mock_actor_warning",
    category: "auth",
    name: "Mock actor warning visible",
    status: "warning",
    severity: "critical",
    description: "Production Auth/RBAC is planning-only; staging must surface the mock actor warning until real auth exists.",
    remediation: "Implement real AuthProvider, request context propagation, and tenant scoping before production promotion.",
    evidence: ["docs/roadmaps/auth-rbac-production/v1.md"],
    metadata: { productionAuthEnabled: false, mockActorWarningRequired: true }
  },
  {
    id: "staging_service_account_plan_exists",
    category: "auth",
    name: "Service account plan exists",
    status: "pass",
    severity: "medium",
    description: "Production Auth/RBAC v1 documents service-account categories and scope expectations.",
    remediation: "Implement service-account identity and credential issuance in a future auth milestone.",
    evidence: ["docs/roadmaps/auth-rbac-production/service-account-system-actor-v1.md"],
    metadata: { serviceAccountCredentialIssuanceImplemented: false }
  },
  {
    id: "staging_secret_backend_required",
    category: "secrets",
    name: "Real secret backend remains missing",
    status: "fail",
    severity: "critical",
    description: "Secret Backend Migration v0 is planning-only and no real Vault/cloud/custom backend exists.",
    remediation: "Implement a reviewed real secret backend before meaningful staging/provider validation.",
    evidence: ["docs/roadmaps/secret-backend-migration/v0.md"],
    metadata: { realSecretBackendConfigured: false, envFallbackProductionReady: false }
  },
  {
    id: "staging_env_fallback_warning_visible",
    category: "secrets",
    name: "Env fallback warning visible",
    status: "warning",
    severity: "high",
    description: "Env SecretRef fallback is local/integration compatibility only and should be blocked for staging except controlled tests.",
    remediation: "Disable env fallback in future staging profile enforcement after real secret backend migration.",
    evidence: ["docs/roadmaps/secret-backend-migration/env-fallback-deprecation-v0.md"],
    metadata: { envValuesExposed: false }
  },
  {
    id: "staging_github_app_boundary_exists",
    category: "github_app",
    name: "GitHub App controlled boundary exists",
    status: "pass",
    severity: "medium",
    description: "GitHub App Controlled Implementation v1 exposes metadata-only config, installation, repository grant, and mock token-handle status.",
    remediation: "Keep live token exchange out of staging until a dedicated integration-test profile exists.",
    evidence: ["docs/features/real-git-adapter/github-app-controlled-v1.md"],
    metadata: { liveInstallationTokenExchangeEnabled: false }
  },
  {
    id: "staging_git_remote_merge_forbidden",
    category: "git",
    name: "Remote merge remains forbidden",
    status: "pass",
    severity: "critical",
    description: "Remote merge, rebase, force push, and branch deletion are not supported and must stay forbidden in staging.",
    remediation: "Keep destructive Git operations disabled until an explicit future production governance task.",
    evidence: ["AGENTS.md", "docs/features/real-git-adapter/v2.md"],
    metadata: { remoteMergeEnabled: false, forcePushEnabled: false, branchDeletionEnabled: false }
  },
  {
    id: "staging_webhook_signature_required",
    category: "webhook",
    name: "Webhook signatures required",
    status: "pass",
    severity: "high",
    description: "Webhook handling remains disabled by default and requires signature verification and allowlists when enabled.",
    remediation: "Add durable replay/dead-letter storage and queue processing before production webhooks.",
    evidence: ["docs/roadmaps/github-app-production-webhook-hardening/v0.md"],
    metadata: { unverifiedWebhookProcessingAllowed: false, rawPayloadStorage: false }
  },
  {
    id: "staging_llm_remote_gated",
    category: "llm",
    name: "Remote LLM remains gated",
    status: "pass",
    severity: "high",
    description: "Remote LLM completion requires explicit LLM Gateway v2 gates, model allowlists, budget checks, SecretRef, Auth/RBAC, and Policy.",
    remediation: "Keep mock-only as default and run remote LLM tests only under explicit integration gates.",
    evidence: ["docs/features/llm-gateway/v2.md"],
    metadata: { remoteLlmDefault: false, byokImplemented: false }
  },
  {
    id: "staging_mcp_remote_forbidden",
    category: "mcp",
    name: "Real MCP transport forbidden",
    status: "pass",
    severity: "critical",
    description: "MCP Gateway v0 is mock-first and real transport remains disabled.",
    remediation: "Keep real MCP transport out of staging until a dedicated real MCP governance milestone.",
    evidence: ["docs/features/mcp-gateway/v0.md"],
    metadata: { realMcpTransportEnabled: false, highCriticalToolsEnabled: false }
  },
  {
    id: "staging_runner_command_execution_forbidden",
    category: "runner",
    name: "Vendor CLI and command execution forbidden",
    status: "pass",
    severity: "critical",
    description: "Local command execution is disabled by default and vendor CLI execution remains forbidden.",
    remediation: "Keep command execution fixture-only and do not read credential caches.",
    evidence: ["docs/features/local-agent-runner/v1.md"],
    metadata: { vendorCliExecutionEnabled: false, credentialCacheAccessAllowed: false }
  },
  {
    id: "staging_local_agent_fixture_only",
    category: "local_agent",
    name: "Local Agent remains fixture-only",
    status: "pass",
    severity: "high",
    description: "Local Agent Protocol v1 is mock/fixture metadata coordination only.",
    remediation: "Add a real pairing/transport/device trust design before any live staging Local Agent rollout.",
    evidence: ["docs/features/local-agent-protocol/v1.md"],
    metadata: { realTransportEnabled: false }
  },
  {
    id: "staging_policy_static_current",
    category: "policy",
    name: "Static policy remains runtime",
    status: "warning",
    severity: "high",
    description: "Policy Bundle / OPA-Cedar v0 is planning-only; StaticPolicyEngine remains the only runtime.",
    remediation: "Implement reviewed policy bundle dry-run, tests, signing, and rollout controls before production.",
    evidence: ["docs/roadmaps/policy-bundle-opa-cedar/v0.md"],
    metadata: { dynamicPolicyExecutionEnabled: false, externalPolicyEngineEnabled: false }
  },
  {
    id: "staging_observability_export_blocked",
    category: "observability",
    name: "External observability export blocked",
    status: "warning",
    severity: "high",
    description: "Observability / Audit Retention v0 has read-only in-memory metrics/traces/audit read models but no exporter or alert delivery.",
    remediation: "Add durable audit storage, export, alerts, and retention governance in a future operations milestone.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { externalExporterEnabled: false, alertDeliveryEnabled: false, retentionDeletionJobsEnabled: false }
  },
  {
    id: "staging_dashboard_api_required",
    category: "dashboard",
    name: "Dashboard API-backed read models required",
    status: "pass",
    severity: "medium",
    description: "Dashboard read models are API-backed and sanitized; demo fallback should be disabled in a real staging deployment profile.",
    remediation: "Set API dashboard source and disable demo fallback in future deployment config.",
    evidence: ["docs/features/dashboard/v0.md"],
    metadata: { dashboardReadOnly: true, noSecretsExposed: true }
  },
  {
    id: "staging_ci_validation_documented",
    category: "ci",
    name: "Validation commands documented",
    status: "pass",
    severity: "medium",
    description: "The required validation commands are documented for every controlled profile.",
    remediation: "Add a real staging CI/CD pipeline in a future task.",
    evidence: ["docs/roadmaps/production-deployment-readiness/ci-cd-release-v0.md"],
    metadata: { realPipelineImplemented: false }
  },
  {
    id: "staging_no_secret_exposure_guard",
    category: "security",
    name: "No-secret exposure guard",
    status: "pass",
    severity: "critical",
    description: "Readiness, health, and dashboard surfaces expose booleans/counts/status only.",
    remediation: "Keep adding no-secret regression tests when new profile surfaces are added.",
    evidence: ["packages/deployment-readiness/src/dto.ts", "packages/shared/src/dashboard-read-models.ts"],
    metadata: { noSecretsExposed: true, envValuesExposed: false }
  }
];

export const defaultStagingPromotionCriteria: StagingPromotionCriterion[] = [
  {
    id: "staging_promotion_validation_green",
    fromProfile: "integration",
    toProfile: "staging",
    criterion: "lint, typecheck, tests, build, and diff checks pass before staging promotion.",
    required: true,
    status: "pass",
    evidence: ["docs/roadmaps/production-deployment-readiness/ci-cd-release-v0.md"],
    remediation: "Add CI enforcement for these commands before real staging rollout.",
    metadata: { commands: ["pnpm lint", "pnpm typecheck", "pnpm test", "pnpm build", "git diff --check"] }
  },
  {
    id: "staging_promotion_postgres_profile",
    fromProfile: "integration",
    toProfile: "staging",
    criterion: "Postgres storage is configured and migration status is visible without exposing DB URL values.",
    required: true,
    status: "fail",
    evidence: ["docs/roadmaps/persistent-db-production-operations/v1.md"],
    remediation: "Create a non-production Postgres profile and run optional contract tests with a staging-safe test URL.",
    metadata: { databaseUrlValueExposed: false }
  },
  {
    id: "staging_promotion_secret_backend_plan",
    fromProfile: "integration",
    toProfile: "staging",
    criterion: "Real secret backend migration path is selected or env fallback risk is explicitly accepted for controlled tests.",
    required: true,
    status: "fail",
    evidence: ["docs/roadmaps/secret-backend-migration/v0.md"],
    remediation: "Implement real secret backend integration or keep staging limited to mock/status validation.",
    metadata: { realSecretBackendImplemented: false }
  },
  {
    id: "staging_promotion_auth_warning_accepted",
    fromProfile: "integration",
    toProfile: "staging",
    criterion: "Mock actor warning remains visible and production auth gap is accepted for non-production validation only.",
    required: true,
    status: "warning",
    evidence: ["docs/roadmaps/auth-rbac-production/v1.md"],
    remediation: "Implement production Auth/RBAC before production promotion.",
    metadata: { productionAuthEnabled: false }
  },
  {
    id: "staging_promotion_destructive_ops_disabled",
    fromProfile: "local",
    toProfile: "staging",
    criterion: "Remote merge, rebase, force push, branch deletion, remote MCP, and vendor CLI execution are disabled.",
    required: true,
    status: "pass",
    evidence: ["AGENTS.md", "docs/reference/staging-environment-gate-matrix.md"],
    remediation: "Keep forbidden gates blocked in every staging profile.",
    metadata: { remoteMergeEnabled: false, realMcpTransportEnabled: false, vendorCliExecutionEnabled: false }
  },
  {
    id: "staging_promotion_dashboard_api",
    fromProfile: "integration",
    toProfile: "staging",
    criterion: "Dashboard uses API-backed read models and does not expose secrets or env values.",
    required: true,
    status: "pass",
    evidence: ["docs/features/dashboard/v0.md"],
    remediation: "Disable demo fallback in future staging deployment config.",
    metadata: { dashboardReadOnly: true, noSecretsExposed: true }
  }
];

export const defaultStagingRollbackCriteria: StagingRollbackCriterion[] = [
  {
    id: "staging_rollback_secret_exposure",
    trigger: "Any staging API, health, dashboard, audit, or log output exposes a secret, token, DB URL value, private key, webhook secret, raw prompt, raw payload, or credential-cache path.",
    severity: "critical",
    requiredAction: "Disable provider gates, revoke exposed test credentials, preserve audit evidence, and return to local/integration profile.",
    owner: "platform-security",
    status: "planned",
    metadata: { noSecretsExposedRequired: true }
  },
  {
    id: "staging_rollback_external_call_outside_gate",
    trigger: "A default staging runtime or test path calls GitHub, LLM, MCP, IdP, secret backend, cloud, OPA/Cedar, Kubernetes, Temporal, or artifact registry outside explicit gates.",
    severity: "critical",
    requiredAction: "Disable the offending gate and restore mock-first boundary behavior.",
    owner: "platform",
    status: "planned",
    metadata: { defaultExternalCallsAllowed: false }
  },
  {
    id: "staging_rollback_destructive_git_enabled",
    trigger: "Remote merge, rebase push, force push, branch deletion, workflow/admin/secrets/deployment permissions, or webhook-triggered execution becomes enabled.",
    severity: "critical",
    requiredAction: "Disable remote Git gates and revert the profile contract change before further validation.",
    owner: "integrations",
    status: "planned",
    metadata: { destructiveGitForbidden: true }
  },
  {
    id: "staging_rollback_storage_integrity",
    trigger: "Migration readiness, Postgres contract tests, or read-only DB health metadata indicates unsafe schema drift or DB URL exposure.",
    severity: "high",
    requiredAction: "Pause staging promotion, preserve DB state, and run restore/migration review.",
    owner: "platform-ops",
    status: "planned",
    metadata: { destructiveDbOperationsEnabled: false }
  },
  {
    id: "staging_rollback_policy_bypass",
    trigger: "Any role, service account, provider path, or staging gate bypasses Auth/RBAC, Policy-as-code, SecretRef, sandbox, or dashboard read-only constraints.",
    severity: "critical",
    requiredAction: "Disable the gate, preserve policy/audit evidence, and restore deny-by-default rules.",
    owner: "platform-security",
    status: "planned",
    metadata: { policyBypassAllowed: false }
  }
];

export const defaultCicdPipelineProfiles: CICDPipelineProfile[] = [
  {
    id: "cicd_profile_local_validation",
    name: "local_validation",
    description: "Developer/local validation profile. Runs baseline commands only and never calls external providers.",
    status: "ready_for_dry_run",
    requiredJobs: ["cicd_job_install", "cicd_job_lint", "cicd_job_typecheck", "cicd_job_test", "cicd_job_build", "cicd_job_diff_check"],
    optionalJobs: [],
    forbiddenJobs: ["cicd_job_optional_remote_git", "cicd_job_optional_remote_llm", "cicd_job_optional_mcp", "cicd_job_optional_auth", "cicd_job_vendor_cli_future"],
    requiredEnvGates: [],
    forbiddenEnvGates: ["AICHESTRA_ENABLE_REMOTE_GIT", "AICHESTRA_ENABLE_REMOTE_LLM", "AICHESTRA_ENABLE_MCP_REAL_TRANSPORT", "AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION"],
    requiredSecrets: [],
    artifactPolicy: "redacted_logs_only",
    approvalPolicy: "none",
    metadata: { externalCallsAllowed: false, deploys: false }
  },
  {
    id: "cicd_profile_pull_request",
    name: "pull_request",
    description: "Pull request validation profile. Adds safety scans and docs checks to the baseline without remote integrations.",
    status: "ready_for_dry_run",
    requiredJobs: ["cicd_job_install", "cicd_job_lint", "cicd_job_typecheck", "cicd_job_test", "cicd_job_build", "cicd_job_diff_check", "cicd_job_safe_integration_scan", "cicd_job_secret_exposure_scan", "cicd_job_docs_path_consistency"],
    optionalJobs: [],
    forbiddenJobs: ["cicd_job_optional_remote_git", "cicd_job_optional_github_app", "cicd_job_optional_webhook", "cicd_job_optional_remote_llm", "cicd_job_optional_mcp", "cicd_job_optional_auth"],
    requiredEnvGates: [],
    forbiddenEnvGates: ["AICHESTRA_GITHUB_INTEGRATION_TESTS", "AICHESTRA_LLM_INTEGRATION_TESTS", "AICHESTRA_GITHUB_APP_INTEGRATION_TESTS"],
    requiredSecrets: [],
    artifactPolicy: "redacted_validation_reports_only",
    approvalPolicy: "code_review_required",
    metadata: { remoteIntegrationTestsSkippedByDefault: true, deploys: false }
  },
  {
    id: "cicd_profile_integration",
    name: "integration",
    description: "Optional integration profile for local/test Postgres and explicitly gated provider tests. Still no deployment.",
    status: "planned",
    requiredJobs: ["cicd_job_install", "cicd_job_lint", "cicd_job_typecheck", "cicd_job_test", "cicd_job_build", "cicd_job_diff_check", "cicd_job_safe_integration_scan"],
    optionalJobs: ["cicd_job_optional_postgres", "cicd_job_optional_remote_git", "cicd_job_optional_github_app", "cicd_job_optional_webhook", "cicd_job_optional_remote_llm"],
    forbiddenJobs: ["cicd_job_optional_mcp", "cicd_job_optional_auth", "cicd_job_vendor_cli_future"],
    requiredEnvGates: [],
    forbiddenEnvGates: ["AICHESTRA_ALLOW_REMOTE_MERGE", "AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION", "AICHESTRA_ENABLE_MCP_REAL_TRANSPORT"],
    requiredSecrets: [],
    artifactPolicy: "redacted_test_reports_only",
    approvalPolicy: "integration_owner_approval_for_remote_profiles",
    metadata: { optionalIntegrationsRequireExplicitGates: true, deploys: false }
  },
  {
    id: "cicd_profile_staging",
    name: "staging",
    description: "Non-production staging validation profile. Requires baseline, safety scans, staging readiness checks, and explicit approvals for any optional remote tests.",
    status: "blocked",
    requiredJobs: ["cicd_job_install", "cicd_job_lint", "cicd_job_typecheck", "cicd_job_test", "cicd_job_build", "cicd_job_diff_check", "cicd_job_safe_integration_scan", "cicd_job_dashboard_smoke", "cicd_job_health_smoke", "cicd_job_staging_readiness"],
    optionalJobs: ["cicd_job_optional_postgres", "cicd_job_optional_remote_git", "cicd_job_optional_github_app", "cicd_job_optional_webhook", "cicd_job_optional_remote_llm"],
    forbiddenJobs: ["cicd_job_optional_mcp", "cicd_job_optional_auth", "cicd_job_vendor_cli_future", "cicd_job_deploy_future"],
    requiredEnvGates: ["AICHESTRA_DEPLOYMENT_PROFILE", "AICHESTRA_DASHBOARD_DATA_SOURCE"],
    forbiddenEnvGates: ["AICHESTRA_ALLOW_REMOTE_MERGE", "AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION", "AICHESTRA_ENABLE_MCP_REAL_TRANSPORT", "GITHUB_APP_PRIVATE_KEY"],
    requiredSecrets: [],
    artifactPolicy: "redacted_readiness_reports_only",
    approvalPolicy: "platform_and_security_approval_required",
    metadata: { productionTrafficAllowed: false, stagingDeployed: false, remoteIntegrationsEnabledByDefault: false }
  },
  {
    id: "cicd_profile_release_candidate",
    name: "release_candidate",
    description: "Future release-candidate profile. Defines promotion constraints but does not build or publish production artifacts in v0.",
    status: "future",
    requiredJobs: ["cicd_job_install", "cicd_job_lint", "cicd_job_typecheck", "cicd_job_test", "cicd_job_build", "cicd_job_diff_check", "cicd_job_safe_integration_scan", "cicd_job_no_production_ready_overclaim"],
    optionalJobs: [],
    forbiddenJobs: ["cicd_job_deploy_future", "cicd_job_artifact_registry_push_future", "cicd_job_optional_mcp", "cicd_job_optional_auth"],
    requiredEnvGates: [],
    forbiddenEnvGates: ["production traffic", "production deployment credentials"],
    requiredSecrets: [],
    artifactPolicy: "future_signed_release_metadata_without_secret_values",
    approvalPolicy: "future_release_approval_required",
    metadata: { productionReady: false, artifactPublishingImplemented: false }
  }
];

export const defaultCicdJobDefinitions: CICDJobDefinition[] = [
  {
    id: "cicd_job_install",
    profileId: "local_validation",
    name: "Install dependencies when metadata changes",
    category: "install",
    command: "pnpm install",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 10,
    artifacts: ["pnpm-install-summary-redacted"],
    status: "planned",
    metadata: { runCondition: "dependency metadata changed", defaultRuntimeProviderCalls: false }
  },
  {
    id: "cicd_job_lint",
    profileId: "local_validation",
    name: "Lint",
    category: "lint",
    command: "pnpm lint",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 5,
    artifacts: ["lint-summary"],
    status: "active_mock",
    metadata: { defaultValidation: true }
  },
  {
    id: "cicd_job_typecheck",
    profileId: "local_validation",
    name: "Typecheck",
    category: "typecheck",
    command: "pnpm typecheck",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 5,
    artifacts: ["typecheck-summary"],
    status: "active_mock",
    metadata: { defaultValidation: true }
  },
  {
    id: "cicd_job_test",
    profileId: "local_validation",
    name: "Test",
    category: "test",
    command: "pnpm test",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 20,
    artifacts: ["test-summary-redacted"],
    status: "active_mock",
    metadata: { optionalRemoteTestsSkippedByDefault: true }
  },
  {
    id: "cicd_job_build",
    profileId: "local_validation",
    name: "Build",
    category: "build",
    command: "pnpm build",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 10,
    artifacts: ["build-summary"],
    status: "active_mock",
    metadata: { deploys: false }
  },
  {
    id: "cicd_job_diff_check",
    profileId: "local_validation",
    name: "Diff whitespace check",
    category: "security_scan",
    command: "git diff --check",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 3,
    artifacts: ["diff-check-summary"],
    status: "active_mock",
    metadata: { mutatesWorkingTree: false }
  },
  {
    id: "cicd_job_safe_integration_scan",
    profileId: "pull_request",
    name: "Safe integration compliance scan",
    category: "security_scan",
    command: "rg -n '<safe integration pattern>' .",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 5,
    artifacts: ["safe-integration-classification-redacted"],
    status: "planned",
    metadata: { classifiesFindings: true, suspiciousFindingsFail: true }
  },
  {
    id: "cicd_job_secret_exposure_scan",
    profileId: "pull_request",
    name: "Secret exposure scan",
    category: "secret_scan",
    command: "rg -n '<secret exposure pattern>' .",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 5,
    artifacts: ["secret-scan-summary-redacted"],
    status: "planned",
    metadata: { rawEnvDumpsForbidden: true, credentialCachePathsForbidden: true }
  },
  {
    id: "cicd_job_docs_path_consistency",
    profileId: "pull_request",
    name: "Docs path consistency check",
    category: "readiness_check",
    command: "rg -n 'older flat docs paths|TODO production-ready claim' docs",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 3,
    artifacts: ["docs-consistency-summary"],
    status: "planned",
    metadata: { docsOnly: true }
  },
  {
    id: "cicd_job_no_production_ready_overclaim",
    profileId: "pull_request",
    name: "No production-ready overclaim check",
    category: "readiness_check",
    command: "rg -n 'production-ready|production ready' docs README.md AGENTS.md",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 3,
    artifacts: ["production-ready-claim-review"],
    status: "planned",
    metadata: { mustClassifyClaims: true }
  },
  {
    id: "cicd_job_node_volta_check",
    profileId: "pull_request",
    name: "Node and Volta baseline check",
    category: "readiness_check",
    command: "node --version",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 1,
    artifacts: ["node-version-summary"],
    status: "planned",
    metadata: { expectedNodeMajor: 24, voltaNode: "24.15.0" }
  },
  {
    id: "cicd_job_dashboard_smoke",
    profileId: "staging",
    name: "Dashboard no-secret smoke",
    category: "dashboard_smoke",
    command: "pnpm test -- tests/dashboard-read-model-v0.test.ts",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 10,
    artifacts: ["dashboard-smoke-summary-redacted"],
    status: "planned",
    metadata: { noSecretAssertionRequired: true, noEnvValueAssertionRequired: true }
  },
  {
    id: "cicd_job_health_smoke",
    profileId: "staging",
    name: "Health no-secret smoke",
    category: "readiness_check",
    command: "pnpm test -- tests/api-health.test.ts",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 5,
    artifacts: ["health-smoke-summary-redacted"],
    status: "planned",
    metadata: { noEnvValueAssertionRequired: true }
  },
  {
    id: "cicd_job_staging_readiness",
    profileId: "staging",
    name: "Staging readiness checks",
    category: "readiness_check",
    command: "pnpm test -- tests/staging-deployment-profile-v0.test.ts",
    required: true,
    allowedToCallExternalServices: false,
    requiresSecrets: false,
    requiredEnvVars: [],
    timeoutMinutes: 10,
    artifacts: ["staging-readiness-summary"],
    status: "planned",
    metadata: { deploys: false, productionReadyClaimAllowed: false }
  },
  {
    id: "cicd_job_optional_postgres",
    profileId: "integration",
    name: "Optional Postgres repository contracts",
    category: "optional_postgres",
    command: "pnpm test -- tests/repository-contracts.test.ts",
    required: false,
    allowedToCallExternalServices: false,
    requiresSecrets: true,
    requiredEnvVars: ["AICHESTRA_TEST_DATABASE_URL"],
    timeoutMinutes: 20,
    artifacts: ["postgres-contract-summary-redacted"],
    status: "planned",
    metadata: { skippedByDefault: true, productionDbForbidden: true, dbUrlValueExposed: false }
  },
  {
    id: "cicd_job_optional_remote_git",
    profileId: "integration",
    name: "Optional remote Git integration",
    category: "optional_remote_git",
    command: "pnpm test -- tests/real-git-adapter-v2.test.ts",
    required: false,
    allowedToCallExternalServices: true,
    requiresSecrets: true,
    requiredEnvVars: ["AICHESTRA_GITHUB_INTEGRATION_TESTS", "AICHESTRA_ENABLE_REMOTE_GIT", "AICHESTRA_GITHUB_ALLOWED_REPOS", "AICHESTRA_GITHUB_ALLOWED_BRANCH_PREFIX"],
    timeoutMinutes: 20,
    artifacts: ["remote-git-summary-redacted"],
    status: "planned",
    metadata: { enabledByDefault: false, noAutoMerge: true, noForcePush: true, noBranchDelete: true }
  },
  {
    id: "cicd_job_optional_github_app",
    profileId: "integration",
    name: "Optional GitHub App integration-test profile",
    category: "optional_github_app",
    command: "pnpm test -- tests/github-app-controlled-v1.test.ts",
    required: false,
    allowedToCallExternalServices: true,
    requiresSecrets: true,
    requiredEnvVars: ["AICHESTRA_GITHUB_APP_INTEGRATION_TESTS", "AICHESTRA_ENABLE_GITHUB_APP", "AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF", "AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS", "AICHESTRA_GITHUB_APP_ALLOWED_REPOS"],
    timeoutMinutes: 20,
    artifacts: ["github-app-summary-redacted"],
    status: "future",
    metadata: { liveTokenExchangeDefault: false, privateKeyValueExposed: false }
  },
  {
    id: "cicd_job_optional_webhook",
    profileId: "integration",
    name: "Optional GitHub webhook fixture/integration tests",
    category: "optional_webhook",
    command: "pnpm test -- tests/real-git-adapter-v2.test.ts",
    required: false,
    allowedToCallExternalServices: false,
    requiresSecrets: true,
    requiredEnvVars: ["AICHESTRA_GITHUB_WEBHOOK_INTEGRATION_TESTS", "AICHESTRA_ENABLE_GITHUB_WEBHOOKS", "AICHESTRA_GITHUB_WEBHOOK_SECRET_REF"],
    timeoutMinutes: 15,
    artifacts: ["webhook-summary-redacted"],
    status: "planned",
    metadata: { signedFixturesAllowed: true, publicEndpointRequired: false, rawPayloadStored: false }
  },
  {
    id: "cicd_job_optional_remote_llm",
    profileId: "integration",
    name: "Optional remote LLM integration",
    category: "optional_remote_llm",
    command: "pnpm test -- tests/llm-gateway-integration-test-profile-v1.test.ts tests/llm-gateway-v2.test.ts",
    required: false,
    allowedToCallExternalServices: true,
    requiresSecrets: true,
    requiredEnvVars: [
      "AICHESTRA_LLM_INTEGRATION_TESTS",
      "AICHESTRA_LLM_PROVIDER",
      "AICHESTRA_ENABLE_REMOTE_LLM",
      "AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION",
      "AICHESTRA_LLM_BASE_URL",
      "AICHESTRA_LLM_API_KEY_SECRET_REF_or_AICHESTRA_LLM_API_KEY",
      "AICHESTRA_LLM_ALLOWED_MODELS",
      "AICHESTRA_LLM_DEFAULT_MODEL",
      "AICHESTRA_LLM_TEST_BUDGET_USD",
      "AICHESTRA_LLM_TEST_PROMPT_CLASS"
    ],
    timeoutMinutes: 20,
    artifacts: ["llm-integration-summary-redacted"],
    status: "planned",
    metadata: { enabledByDefault: false, budgetCapRequired: true, rawPromptOutputForbidden: true, streamingAllowed: false, toolCallsAllowed: false }
  },
  {
    id: "cicd_job_optional_mcp",
    profileId: "integration",
    name: "Optional remote MCP integration",
    category: "optional_mcp",
    command: "future remote MCP test profile",
    required: false,
    allowedToCallExternalServices: false,
    requiresSecrets: true,
    requiredEnvVars: ["future MCP server allowlist and SecretRefs"],
    timeoutMinutes: 20,
    artifacts: ["future-mcp-summary-redacted"],
    status: "future",
    metadata: { realMcpTransportEnabled: false, highCriticalToolsAllowed: false }
  },
  {
    id: "cicd_job_optional_auth",
    profileId: "integration",
    name: "Optional external auth integration",
    category: "optional_auth",
    command: "future external auth test profile",
    required: false,
    allowedToCallExternalServices: false,
    requiresSecrets: true,
    requiredEnvVars: ["future OIDC/SAML/SCIM config SecretRefs"],
    timeoutMinutes: 20,
    artifacts: ["future-auth-summary-redacted"],
    status: "future",
    metadata: { realIdpCallsEnabled: false, sessionsIssued: false }
  }
];

export const defaultCicdIntegrationTestGates: CICDIntegrationTestGate[] = [
  {
    id: "cicd_gate_postgres",
    integrationKind: "postgres",
    enabledByDefault: false,
    requiredEnvVars: ["AICHESTRA_TEST_DATABASE_URL"],
    requiredSecrets: ["non_production_test_database_url"],
    requiredApprovals: ["platform_ops"],
    cleanupRequired: true,
    allowedProfiles: ["integration", "staging"],
    blockedProfiles: ["local_validation", "pull_request", "release_candidate"],
    riskLevel: "medium",
    metadata: { productionDatabaseForbidden: true, migrationsAutoRun: false, dbUrlValueExposed: false }
  },
  {
    id: "cicd_gate_remote_git",
    integrationKind: "remote_git",
    enabledByDefault: false,
    requiredEnvVars: ["AICHESTRA_GITHUB_INTEGRATION_TESTS", "AICHESTRA_ENABLE_REMOTE_GIT", "AICHESTRA_GITHUB_ALLOWED_REPOS", "AICHESTRA_GITHUB_ALLOWED_BRANCH_PREFIX"],
    requiredSecrets: ["github_token_secretref_or_controlled_legacy_env"],
    requiredApprovals: ["integrations_owner"],
    cleanupRequired: true,
    allowedProfiles: ["integration", "staging"],
    blockedProfiles: ["local_validation", "pull_request", "release_candidate"],
    riskLevel: "high",
    metadata: { autoMergeAllowed: false, forcePushAllowed: false, branchDeleteAllowed: false }
  },
  {
    id: "cicd_gate_github_app",
    integrationKind: "github_app",
    enabledByDefault: false,
    requiredEnvVars: ["AICHESTRA_GITHUB_APP_INTEGRATION_TESTS", "AICHESTRA_ENABLE_GITHUB_APP", "AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF", "AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS", "AICHESTRA_GITHUB_APP_ALLOWED_REPOS"],
    requiredSecrets: ["github_app_private_key_secretref_metadata"],
    requiredApprovals: ["integrations_owner", "platform_security"],
    cleanupRequired: true,
    allowedProfiles: ["integration", "staging"],
    blockedProfiles: ["local_validation", "pull_request", "release_candidate"],
    riskLevel: "high",
    metadata: { privateKeyEnvForbidden: true, liveTokenExchangeDefault: false }
  },
  {
    id: "cicd_gate_github_webhook",
    integrationKind: "github_webhook",
    enabledByDefault: false,
    requiredEnvVars: ["AICHESTRA_GITHUB_WEBHOOK_INTEGRATION_TESTS", "AICHESTRA_ENABLE_GITHUB_WEBHOOKS", "AICHESTRA_GITHUB_WEBHOOK_SECRET_REF"],
    requiredSecrets: ["github_webhook_secret_ref"],
    requiredApprovals: ["integrations_owner"],
    cleanupRequired: false,
    allowedProfiles: ["integration", "staging"],
    blockedProfiles: ["local_validation", "pull_request", "release_candidate"],
    riskLevel: "medium",
    metadata: { unverifiedPayloadAllowed: false, publicEndpointRequired: false, rawPayloadStored: false }
  },
  {
    id: "cicd_gate_remote_llm",
    integrationKind: "remote_llm",
    enabledByDefault: false,
    requiredEnvVars: [
      "AICHESTRA_LLM_INTEGRATION_TESTS",
      "AICHESTRA_LLM_PROVIDER",
      "AICHESTRA_ENABLE_REMOTE_LLM",
      "AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION",
      "AICHESTRA_LLM_BASE_URL",
      "AICHESTRA_LLM_API_KEY_SECRET_REF_or_AICHESTRA_LLM_API_KEY",
      "AICHESTRA_LLM_ALLOWED_MODELS",
      "AICHESTRA_LLM_DEFAULT_MODEL",
      "AICHESTRA_LLM_ROUTING_MODE",
      "AICHESTRA_ENABLE_LLM_FALLBACK",
      "AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS",
      "AICHESTRA_LLM_TEST_BUDGET_USD",
      "AICHESTRA_LLM_TEST_PROMPT_CLASS"
    ],
    requiredSecrets: ["llm_api_key_secretref_preferred_or_controlled_test_env"],
    requiredApprovals: ["platform_security", "llm_owner"],
    cleanupRequired: false,
    allowedProfiles: ["integration", "staging"],
    blockedProfiles: ["local_validation", "pull_request", "release_candidate"],
    riskLevel: "high",
    metadata: { budgetCapRequired: true, uncontrolledFallbackAllowed: false, streamingAllowed: false, toolCallsAllowed: false, promptOutputRedactionRequired: true, readinessEndpoint: "/readiness/llm-integration/summary" }
  },
  {
    id: "cicd_gate_remote_mcp",
    integrationKind: "remote_mcp",
    enabledByDefault: false,
    requiredEnvVars: ["future MCP transport gates"],
    requiredSecrets: ["future MCP SecretRefs"],
    requiredApprovals: ["platform_security"],
    cleanupRequired: true,
    allowedProfiles: [],
    blockedProfiles: ["local_validation", "pull_request", "integration", "staging", "release_candidate"],
    riskLevel: "critical",
    metadata: { futureOnly: true, realMcpTransportEnabled: false, highCriticalToolsAllowed: false }
  },
  {
    id: "cicd_gate_external_auth",
    integrationKind: "external_auth",
    enabledByDefault: false,
    requiredEnvVars: ["future IdP config SecretRefs"],
    requiredSecrets: ["future IdP client secret SecretRefs"],
    requiredApprovals: ["platform_security"],
    cleanupRequired: true,
    allowedProfiles: [],
    blockedProfiles: ["local_validation", "pull_request", "integration", "staging", "release_candidate"],
    riskLevel: "critical",
    metadata: { futureOnly: true, realIdpCallsEnabled: false, sessionsIssued: false }
  },
  {
    id: "cicd_gate_vendor_cli",
    integrationKind: "vendor_cli",
    enabledByDefault: false,
    requiredEnvVars: ["future local agent vendor CLI gates"],
    requiredSecrets: [],
    requiredApprovals: ["platform_security", "local_agent_owner"],
    cleanupRequired: true,
    allowedProfiles: [],
    blockedProfiles: ["local_validation", "pull_request", "integration", "staging", "release_candidate"],
    riskLevel: "critical",
    metadata: { futureOnly: true, credentialCacheReadsAllowed: false, vendorCliExecutionAllowed: false }
  }
];

export const defaultCicdReadinessChecks: CICDReadinessCheck[] = [
  {
    id: "cicd_node_24_baseline",
    category: "node",
    name: "Node 24 baseline documented",
    status: "pass",
    severity: "medium",
    description: "The repository pins Node 24 through package engines, Volta, and .nvmrc.",
    remediation: "Make CI run Node 24.x and warn on mismatches.",
    evidence: ["package.json", ".nvmrc"],
    metadata: { expectedMajor: 24, voltaNode: "24.15.0" }
  },
  {
    id: "cicd_pnpm_baseline",
    category: "package_manager",
    name: "pnpm baseline documented",
    status: "pass",
    severity: "low",
    description: "All validation commands use pnpm scripts.",
    remediation: "Keep dependency metadata and lockfile changes explicit.",
    evidence: ["package.json", "pnpm-lock.yaml"],
    metadata: { packageManager: "pnpm" }
  },
  {
    id: "cicd_required_validation_jobs",
    category: "validation",
    name: "Required validation jobs defined",
    status: "pass",
    severity: "high",
    description: "lint, typecheck, test, build, and diff checks are represented in the CI/CD job matrix.",
    remediation: "Keep these jobs required for staging promotion.",
    evidence: ["docs/roadmaps/staging-ci-cd-pipeline/job-matrix-v0.md"],
    metadata: { requiredCommands: ["pnpm lint", "pnpm typecheck", "pnpm test", "pnpm build", "git diff --check"] }
  },
  {
    id: "cicd_optional_remote_tests_disabled_default",
    category: "test_profiles",
    name: "Optional remote tests disabled by default",
    status: "pass",
    severity: "critical",
    description: "Remote Git, GitHub App, webhook, remote LLM, MCP, external auth, and vendor CLI profiles require explicit gates and are skipped by default.",
    remediation: "Do not add active workflows that enable remote integrations by default.",
    evidence: ["docs/roadmaps/staging-ci-cd-pipeline/integration-test-gates-v0.md"],
    metadata: { remoteIntegrationTestsEnabledByDefault: false }
  },
  {
    id: "cicd_secret_env_safety_policy",
    category: "secrets",
    name: "Secret and env safety policy defined",
    status: "pass",
    severity: "critical",
    description: "CI/CD planning defines secret-bearing vars, mask requirements, SecretRef preference, and no env value exposure.",
    remediation: "Add active secret scanning before any real pipeline rollout.",
    evidence: ["docs/roadmaps/staging-ci-cd-pipeline/secret-env-safety-v0.md"],
    metadata: { secretsExposed: false, envValuesExposed: false }
  },
  {
    id: "cicd_external_call_scan_planned",
    category: "integration_gates",
    name: "Safe integration scan planned",
    status: "pass",
    severity: "high",
    description: "The pipeline matrix includes a static scan to classify external-call and unsafe credential findings.",
    remediation: "Convert the planning check into a real CI job after dry-run review.",
    evidence: ["docs/roadmaps/staging-ci-cd-pipeline/job-matrix-v0.md"],
    metadata: { externalCallsEnabledByDefault: false }
  },
  {
    id: "cicd_artifact_policy_redacted",
    category: "artifacts",
    name: "Artifact policy redacted-only",
    status: "pass",
    severity: "high",
    description: "Reports and logs must be redacted and must not include raw secrets, DB URLs, prompts, provider outputs, payloads, or credential-cache paths.",
    remediation: "Add artifact redaction checks before upload in a future workflow.",
    evidence: ["docs/roadmaps/staging-ci-cd-pipeline/artifact-report-policy-v0.md"],
    metadata: { rawProviderOutputUploaded: false, rawPromptUploaded: false }
  },
  {
    id: "cicd_cleanup_rollback_planned",
    category: "cleanup",
    name: "Cleanup and rollback policy planned",
    status: "warning",
    severity: "high",
    description: "Manual cleanup and rollback criteria are documented, but no cleanup jobs are implemented.",
    remediation: "Add controlled cleanup automation only after dedicated integration-test profiles exist.",
    evidence: ["docs/roadmaps/staging-ci-cd-pipeline/cleanup-rollback-v0.md"],
    metadata: { cleanupJobsImplemented: false, remoteCleanupCallsEnabled: false }
  },
  {
    id: "cicd_staging_promotion_blocked",
    category: "staging_promotion",
    name: "Staging promotion remains blocked",
    status: "warning",
    severity: "critical",
    description: "Staging promotion criteria exist but real auth, real secret backend, and operational DB evidence remain blockers.",
    remediation: "Keep staging non-production until blockers are addressed.",
    evidence: ["docs/roadmaps/staging-ci-cd-pipeline/staging-promotion-v0.md"],
    metadata: { stagingPromotionReady: false, productionReady: false }
  }
];

export const defaultCicdRisks: CICDRisk[] = [
  {
    id: "cicd_risk_remote_tests_accidentally_enabled",
    category: "remote_integration",
    title: "Remote integration tests accidentally enabled",
    severity: "critical",
    likelihood: "medium",
    impact: "CI could call GitHub, LLM, MCP, auth, or secret backends outside reviewed gates.",
    mitigation: "Keep optional gates disabled by default, require explicit env vars and approvals, and run safe integration scans.",
    status: "open",
    metadata: { enabledByDefault: false }
  },
  {
    id: "cicd_risk_secret_leak_in_logs",
    category: "secrets",
    title: "Secret or env value leakage in CI logs",
    severity: "critical",
    likelihood: "medium",
    impact: "Tokens, private keys, webhook secrets, DB URLs, or credential-cache references could be exposed.",
    mitigation: "Use SecretRef where possible, mask CI secrets, avoid env dumps, redact artifacts, and fail no-secret smoke tests.",
    status: "open",
    metadata: { secretValuesStored: false, envValuesReturned: false }
  },
  {
    id: "cicd_risk_staging_overclaim",
    category: "deployment_safety",
    title: "Staging or production readiness overclaimed",
    severity: "high",
    likelihood: "medium",
    impact: "Planning-only readiness data could be mistaken for a deployed staging or production-ready environment.",
    mitigation: "Expose productionReady=false, stagingDeployed=false, and no active deployment workflow in health/dashboard/readiness.",
    status: "open",
    metadata: { productionReady: false, stagingDeployed: false }
  },
  {
    id: "cicd_risk_artifact_overcollection",
    category: "artifact_governance",
    title: "Artifacts capture raw prompts, outputs, payloads, or logs",
    severity: "high",
    likelihood: "medium",
    impact: "Sensitive user content or provider output could be persisted in CI artifacts.",
    mitigation: "Allow redacted summaries only and forbid raw prompts, raw payloads, raw provider outputs, and credential-cache paths.",
    status: "open",
    metadata: { rawPromptArtifactsAllowed: false, rawProviderOutputArtifactsAllowed: false }
  },
  {
    id: "cicd_risk_cleanup_absent_for_future_live_tests",
    category: "cleanup",
    title: "Future live integration tests lack cleanup automation",
    severity: "high",
    likelihood: "medium",
    impact: "Branches, PRs, test data, or sessions could accumulate if future optional live tests fail.",
    mitigation: "Keep live remote tests disabled until manual cleanup checklist and future cleanup automation are approved.",
    status: "open",
    metadata: { cleanupJobsImplemented: false }
  }
];

export const defaultGitHubAppIntegrationTestProfile: GitHubAppIntegrationTestProfile = {
  id: "github_app_integration_test_profile_v1",
  name: "GitHub App integration-test profile v1",
  status: "ready_if_configured",
  requiredEnvVars: [
    "AICHESTRA_GITHUB_APP_INTEGRATION_TESTS",
    "AICHESTRA_ENABLE_REMOTE_GIT",
    "AICHESTRA_GITHUB_AUTH_MODE",
    "AICHESTRA_ENABLE_GITHUB_APP",
    "AICHESTRA_GITHUB_APP_ID",
    "AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF",
    "AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS",
    "AICHESTRA_GITHUB_APP_ALLOWED_REPOS",
    "AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX",
    "AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE",
    "AICHESTRA_ALLOW_REMOTE_PR_CREATE",
    "AICHESTRA_ALLOW_REMOTE_MERGE"
  ],
  requiredSecretRefs: [
    "github_app_private_key_secretref_metadata",
    "github_webhook_secretref_metadata_for_webhook_tests"
  ],
  allowedRepos: ["configured_allowlist_required"],
  allowedBranchPrefix: "ai/",
  allowedOperations: [
    "config_validation",
    "installation_token_check_status_only",
    "branch_create_in_allowlisted_test_repo",
    "pull_request_create_in_allowlisted_test_repo",
    "changed_files_read",
    "signed_webhook_fixture_verification"
  ],
  forbiddenOperations: [
    "auto_merge",
    "rebase_push",
    "force_push",
    "branch_delete",
    "unallowlisted_repo_access",
    "unverified_webhook_processing",
    "private_key_value_return",
    "installation_token_value_return"
  ],
  cleanupPolicy: "manual_close_or_mark_only; branch deletion remains forbidden in v1",
  auditRequirements: [
    "github_app_token_requested",
    "github_app_token_issued_mock_or_gated_metadata_only",
    "github_app_operation_used_for_branch_create",
    "github_app_operation_used_for_pr_create",
    "github_webhook_verified_fixture",
    "github_app_integration_test_skipped_when_gates_missing"
  ],
  metadata: {
    docs: "docs/roadmaps/github-app-integration-test-profile/v1.md",
    liveTestsEnabledByDefault: false,
    noProductionReposByDefault: true,
    noSecretsReturned: true,
    noGitHubCallsInDefaultTests: true
  }
};

export const defaultGitHubAppIntegrationTestCases: GitHubAppIntegrationTestCase[] = [
  {
    id: "github_app_it_config_validation",
    profileId: "github_app_integration_test_profile_v1",
    name: "Validate GitHub App config gates",
    category: "config_validation",
    enabledByDefault: true,
    requiresLiveGitHub: false,
    requiredEnvVars: [],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { validatesBooleansAndCountsOnly: true, envValuesReturned: false }
  },
  {
    id: "github_app_it_installation_token_gated",
    profileId: "github_app_integration_test_profile_v1",
    name: "Issue installation token through gated provider boundary",
    category: "installation_token",
    enabledByDefault: false,
    requiresLiveGitHub: true,
    requiredEnvVars: [
      "AICHESTRA_GITHUB_APP_INTEGRATION_TESTS",
      "AICHESTRA_GITHUB_AUTH_MODE",
      "AICHESTRA_ENABLE_GITHUB_APP",
      "AICHESTRA_GITHUB_APP_ID",
      "AICHESTRA_GITHUB_APP_PRIVATE_KEY_SECRET_REF",
      "AICHESTRA_GITHUB_APP_ALLOWED_INSTALLATIONS"
    ],
    expectedSideEffects: ["metadata_only_token_handle"],
    cleanupRequired: false,
    status: "gated_live",
    metadata: { rawTokenReturned: false, liveGitHubSkippedByDefault: true }
  },
  {
    id: "github_app_it_branch_create",
    profileId: "github_app_integration_test_profile_v1",
    name: "Create test branch in allowlisted repository",
    category: "branch_create",
    enabledByDefault: false,
    requiresLiveGitHub: true,
    requiredEnvVars: [
      "AICHESTRA_GITHUB_APP_INTEGRATION_TESTS",
      "AICHESTRA_ENABLE_REMOTE_GIT",
      "AICHESTRA_GITHUB_APP_ALLOWED_REPOS",
      "AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX",
      "AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE"
    ],
    expectedSideEffects: ["test_branch_created_with_ai_prefix"],
    cleanupRequired: true,
    status: "gated_live",
    metadata: { branchDeletionAllowed: false, cleanupMode: "manual_close_or_mark_only" }
  },
  {
    id: "github_app_it_pr_create",
    profileId: "github_app_integration_test_profile_v1",
    name: "Create test pull request in allowlisted repository",
    category: "pr_create",
    enabledByDefault: false,
    requiresLiveGitHub: true,
    requiredEnvVars: [
      "AICHESTRA_GITHUB_APP_INTEGRATION_TESTS",
      "AICHESTRA_ENABLE_REMOTE_GIT",
      "AICHESTRA_GITHUB_APP_ALLOWED_REPOS",
      "AICHESTRA_ALLOW_REMOTE_PR_CREATE"
    ],
    expectedSideEffects: ["test_pr_created_no_merge"],
    cleanupRequired: true,
    status: "gated_live",
    metadata: { autoMergeAllowed: false, closePrOnlyIfExplicitlyConfiguredFuture: true }
  },
  {
    id: "github_app_it_changed_files",
    profileId: "github_app_integration_test_profile_v1",
    name: "Read changed files for allowlisted test pull request",
    category: "changed_files",
    enabledByDefault: false,
    requiresLiveGitHub: true,
    requiredEnvVars: [
      "AICHESTRA_GITHUB_APP_INTEGRATION_TESTS",
      "AICHESTRA_ENABLE_REMOTE_GIT",
      "AICHESTRA_GITHUB_APP_ALLOWED_REPOS"
    ],
    expectedSideEffects: ["read_model_updated_only"],
    cleanupRequired: false,
    status: "gated_live",
    metadata: { writeOperation: false }
  },
  {
    id: "github_app_it_webhook_fixture",
    profileId: "github_app_integration_test_profile_v1",
    name: "Verify signed webhook fixtures without public endpoint",
    category: "webhook_fixture",
    enabledByDefault: true,
    requiresLiveGitHub: false,
    requiredEnvVars: [],
    expectedSideEffects: ["in_memory_webhook_read_model_update"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { publicEndpointRequired: false, rawPayloadStored: false }
  },
  {
    id: "github_app_it_webhook_live_future",
    profileId: "github_app_integration_test_profile_v1",
    name: "Live webhook delivery test",
    category: "webhook_live_future",
    enabledByDefault: false,
    requiresLiveGitHub: true,
    requiredEnvVars: [
      "AICHESTRA_GITHUB_APP_INTEGRATION_TESTS",
      "AICHESTRA_ENABLE_GITHUB_WEBHOOKS",
      "AICHESTRA_GITHUB_WEBHOOK_SECRET_REF",
      "AICHESTRA_GITHUB_WEBHOOK_ACCEPT_UNVERIFIED"
    ],
    expectedSideEffects: ["future_public_endpoint_delivery"],
    cleanupRequired: false,
    status: "future",
    metadata: { productionWebhookEndpointImplemented: false, unverifiedWebhookAllowed: false }
  },
  {
    id: "github_app_it_cleanup_policy",
    profileId: "github_app_integration_test_profile_v1",
    name: "Validate cleanup policy without destructive branch deletion",
    category: "cleanup",
    enabledByDefault: true,
    requiresLiveGitHub: false,
    requiredEnvVars: [],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { branchDeletionAllowed: false, remoteCleanupCallsEnabledByDefault: false }
  }
];

export const defaultGitHubAppIntegrationTestSafetyChecks: GitHubAppIntegrationTestSafetyCheck[] = [
  {
    id: "github_app_it_env_gates_missing_skip",
    category: "env_gates",
    status: "warning",
    severity: "high",
    description: "Live GitHub App integration tests must skip unless every required gate is configured.",
    remediation: "Set all documented gates only in a reviewed non-production integration profile.",
    evidence: ["docs/roadmaps/github-app-integration-test-profile/v1.md"],
    metadata: { missingGatesSkipNotFail: true }
  },
  {
    id: "github_app_it_repo_allowlist_required",
    category: "repo_allowlist",
    status: "warning",
    severity: "critical",
    description: "Live tests require an explicit non-production repository allowlist.",
    remediation: "Configure AICHESTRA_GITHUB_APP_ALLOWED_REPOS for a test repository only.",
    evidence: ["docs/roadmaps/github-app-integration-test-profile/v1.md"],
    metadata: { productionRepoForbiddenByDefault: true }
  },
  {
    id: "github_app_it_branch_prefix_required",
    category: "branch_prefix",
    status: "warning",
    severity: "high",
    description: "Live branch/PR tests require the ai/ branch prefix.",
    remediation: "Set AICHESTRA_GITHUB_APP_ALLOWED_BRANCH_PREFIX=ai/ before enabling live tests.",
    evidence: ["docs/roadmaps/github-app-integration-test-profile/v1.md"],
    metadata: { expectedPrefix: "ai/" }
  },
  {
    id: "github_app_it_secretref_required",
    category: "secretref",
    status: "warning",
    severity: "critical",
    description: "Private key and webhook secret material must be referenced through SecretRef metadata only.",
    remediation: "Configure SecretRef IDs, never raw private key or webhook secret env values.",
    evidence: ["docs/features/real-git-adapter/github-app-controlled-v1.md"],
    metadata: { privateKeyEnvForbidden: true, secretValuesReturned: false }
  },
  {
    id: "github_app_it_cleanup_manual_only",
    category: "cleanup",
    status: "pass",
    severity: "high",
    description: "Cleanup is manual close/mark-only in v1; branch deletion remains forbidden.",
    remediation: "Keep branch deletion disabled until a future destructive-operation policy explicitly allows it.",
    evidence: ["docs/roadmaps/github-app-integration-test-profile/v1.md"],
    metadata: { branchDeletionAllowed: false }
  },
  {
    id: "github_app_it_no_auto_merge",
    category: "no_auto_merge",
    status: "pass",
    severity: "critical",
    description: "Automatic merge is forbidden for the integration-test profile.",
    remediation: "Keep AICHESTRA_ALLOW_REMOTE_MERGE=false and fail unsafe gate detection if enabled.",
    evidence: ["AGENTS.md"],
    metadata: { autoMergeAllowed: false }
  },
  {
    id: "github_app_it_no_force_push",
    category: "no_force_push",
    status: "pass",
    severity: "critical",
    description: "Force-push remains unsupported and forbidden.",
    remediation: "Do not add force-push integration tests or runtime operations.",
    evidence: ["AGENTS.md"],
    metadata: { forcePushAllowed: false }
  },
  {
    id: "github_app_it_no_branch_delete",
    category: "no_branch_delete",
    status: "pass",
    severity: "critical",
    description: "Branch deletion remains unsupported and forbidden.",
    remediation: "Use manual close/mark cleanup only.",
    evidence: ["AGENTS.md"],
    metadata: { branchDeleteAllowed: false }
  },
  {
    id: "github_app_it_audit_metadata_only",
    category: "audit",
    status: "pass",
    severity: "high",
    description: "Audit entries must record metadata and token handles only, never private keys or installation tokens.",
    remediation: "Keep DTO/audit redaction tests in the profile.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { rawTokenStored: false, rawPrivateKeyStored: false }
  },
  {
    id: "github_app_it_observability_no_export",
    category: "observability",
    status: "pass",
    severity: "medium",
    description: "Observability remains local/read-only; no external export is enabled by this test profile.",
    remediation: "Keep external observability/export out of this profile.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { externalExportEnabled: false }
  }
];

export const defaultLLMIntegrationTestProfile: LLMIntegrationTestProfile = {
  id: "llm_gateway_integration_test_profile_v1",
  name: "LLM Gateway integration-test profile v1",
  status: "ready_if_configured",
  providerKind: "openai_compatible",
  providerId: "openai_compatible",
  requiredEnvVars: [
    "AICHESTRA_LLM_INTEGRATION_TESTS",
    "AICHESTRA_LLM_PROVIDER",
    "AICHESTRA_ENABLE_REMOTE_LLM",
    "AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION",
    "AICHESTRA_LLM_BASE_URL",
    "AICHESTRA_LLM_API_KEY_SECRET_REF_or_AICHESTRA_LLM_API_KEY",
    "AICHESTRA_LLM_ALLOWED_MODELS",
    "AICHESTRA_LLM_DEFAULT_MODEL",
    "AICHESTRA_LLM_ROUTING_MODE",
    "AICHESTRA_ENABLE_LLM_FALLBACK",
    "AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS",
    "AICHESTRA_LLM_TEST_BUDGET_USD",
    "AICHESTRA_LLM_TEST_PROMPT_CLASS"
  ],
  requiredSecretRefs: ["llm_api_key_secretref_metadata_preferred"],
  allowedModels: ["configured_model_allowlist_required"],
  requiredBudgetLimitUsd: 1,
  requiredPolicies: [
    "llm.remote_completion",
    "llm.model.use",
    "provider.credential.resolve",
    "policy.evaluate"
  ],
  allowedOperations: [
    "config_validation",
    "credential_resolution_status_only",
    "model_allowlist_validation",
    "budget_guard_validation",
    "mock_completion_fixture",
    "one_minimal_remote_completion_when_gated",
    "usage_ledger_verification",
    "audit_redaction_verification"
  ],
  forbiddenOperations: [
    "streaming",
    "tool_calls",
    "local_cli_provider_execution",
    "vendor_cli_execution",
    "credential_cache_read",
    "byok",
    "oauth_device_code_wif_iam",
    "unbounded_fallback",
    "raw_api_key_return",
    "raw_env_value_return",
    "raw_provider_response_storage"
  ],
  promptPolicy: "safe_non_sensitive_smoke_prompt_only",
  outputPolicy: "preview_limited_redacted_output_only",
  auditRequirements: [
    "llm_integration_test_skipped_when_gates_missing",
    "llm_remote_completion_requested_metadata_only",
    "llm_remote_completion_blocked_by_budget_or_policy",
    "llm_remote_completion_usage_recorded",
    "llm_remote_completion_output_redacted_preview_only"
  ],
  metadata: {
    docs: "docs/roadmaps/llm-gateway-integration-test-profile/v1.md",
    liveTestsEnabledByDefault: false,
    openAiCompatibleOnly: true,
    noStreaming: true,
    noToolCalls: true,
    noVendorCli: true,
    noCredentialCacheRead: true,
    noSecretsReturned: true,
    noRemoteLLMCallsInDefaultTests: true
  }
};

export const defaultLLMIntegrationTestCases: LLMIntegrationTestCase[] = [
  {
    id: "llm_it_config_validation",
    profileId: "llm_gateway_integration_test_profile_v1",
    name: "Validate LLM integration gates",
    category: "config_validation",
    enabledByDefault: true,
    requiresRemoteLLM: false,
    requiredEnvVars: [],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { validatesBooleansAndCountsOnly: true, envValuesReturned: false }
  },
  {
    id: "llm_it_credential_resolution_status",
    profileId: "llm_gateway_integration_test_profile_v1",
    name: "Validate credential readiness without reading API key values",
    category: "credential_resolution",
    enabledByDefault: true,
    requiresRemoteLLM: false,
    requiredEnvVars: ["AICHESTRA_LLM_API_KEY_SECRET_REF_or_AICHESTRA_LLM_API_KEY"],
    expectedSideEffects: ["credential_status_metadata_only"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { secretRefPreferred: true, rawApiKeyReturned: false, secretResolutionAttemptedByReadiness: false }
  },
  {
    id: "llm_it_model_allowlist",
    profileId: "llm_gateway_integration_test_profile_v1",
    name: "Require explicit model allowlist and default model",
    category: "model_allowlist",
    enabledByDefault: true,
    requiresRemoteLLM: false,
    requiredEnvVars: ["AICHESTRA_LLM_ALLOWED_MODELS", "AICHESTRA_LLM_DEFAULT_MODEL"],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { modelNamesReturned: false, allowlistCountOnly: true }
  },
  {
    id: "llm_it_budget_guard",
    profileId: "llm_gateway_integration_test_profile_v1",
    name: "Require live-test budget cap",
    category: "budget_guard",
    enabledByDefault: true,
    requiresRemoteLLM: false,
    requiredEnvVars: ["AICHESTRA_LLM_TEST_BUDGET_USD"],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { requiredMaximumBudgetUsd: 1 }
  },
  {
    id: "llm_it_mock_completion",
    profileId: "llm_gateway_integration_test_profile_v1",
    name: "Validate mock completion fixture remains default",
    category: "mock_completion",
    enabledByDefault: true,
    requiresRemoteLLM: false,
    requiredEnvVars: [],
    expectedSideEffects: ["mock_usage_metadata_only"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { remoteProviderCalled: false }
  },
  {
    id: "llm_it_remote_completion_gated",
    profileId: "llm_gateway_integration_test_profile_v1",
    name: "Run one minimal OpenAI-compatible remote completion only when all gates pass",
    category: "remote_completion",
    enabledByDefault: false,
    requiresRemoteLLM: true,
    requiredEnvVars: [
      "AICHESTRA_LLM_INTEGRATION_TESTS",
      "AICHESTRA_LLM_PROVIDER",
      "AICHESTRA_ENABLE_REMOTE_LLM",
      "AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION",
      "AICHESTRA_LLM_BASE_URL",
      "AICHESTRA_LLM_ALLOWED_MODELS",
      "AICHESTRA_LLM_DEFAULT_MODEL",
      "AICHESTRA_LLM_TEST_BUDGET_USD"
    ],
    expectedSideEffects: ["bounded_provider_call_when_explicitly_configured", "sanitized_usage_record"],
    cleanupRequired: false,
    status: "gated_live",
    metadata: { liveLLMSkippedByDefault: true, streamingEnabled: false, toolCallsEnabled: false }
  },
  {
    id: "llm_it_usage_ledger",
    profileId: "llm_gateway_integration_test_profile_v1",
    name: "Verify usage ledger metadata after gated completion",
    category: "usage_ledger",
    enabledByDefault: false,
    requiresRemoteLLM: true,
    requiredEnvVars: ["AICHESTRA_LLM_INTEGRATION_TESTS", "AICHESTRA_LLM_TEST_BUDGET_USD"],
    expectedSideEffects: ["usage_ledger_metadata_only"],
    cleanupRequired: false,
    status: "gated_live",
    metadata: { rawPromptStored: false, rawProviderResponseStored: false }
  },
  {
    id: "llm_it_audit_redaction",
    profileId: "llm_gateway_integration_test_profile_v1",
    name: "Verify audit and output redaction metadata",
    category: "audit_redaction",
    enabledByDefault: true,
    requiresRemoteLLM: false,
    requiredEnvVars: [],
    expectedSideEffects: ["sanitized_audit_metadata"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { apiKeyStored: false, rawPromptStored: false, rawOutputStored: false }
  },
  {
    id: "llm_it_fallback_disabled",
    profileId: "llm_gateway_integration_test_profile_v1",
    name: "Require fallback disabled unless a future bounded fallback test is explicit",
    category: "fallback_disabled",
    enabledByDefault: true,
    requiresRemoteLLM: false,
    requiredEnvVars: ["AICHESTRA_ENABLE_LLM_FALLBACK", "AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS"],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { fallbackMustBeFalseByDefault: true, maxFallbackAttemptsExpected: 0 }
  }
];

export const defaultLLMIntegrationTestSafetyChecks: LLMIntegrationTestSafetyCheck[] = [
  {
    id: "llm_it_env_gates_missing_skip",
    category: "env_gates",
    status: "warning",
    severity: "high",
    description: "Live LLM integration tests must skip unless every required gate is configured.",
    remediation: "Set all documented gates only in a reviewed non-production integration profile.",
    evidence: ["docs/roadmaps/llm-gateway-integration-test-profile/v1.md"],
    metadata: { missingGatesSkipNotFail: true }
  },
  {
    id: "llm_it_secretref_preferred",
    category: "secretref",
    status: "warning",
    severity: "critical",
    description: "LLM API keys should be referenced through SecretRef metadata; controlled raw env key fallback is test-only.",
    remediation: "Configure AICHESTRA_LLM_API_KEY_SECRET_REF and env SecretRef provider gates for integration tests.",
    evidence: ["docs/foundations/secretref-provider-credentials/v1.md"],
    metadata: { secretValuesReturned: false, rawEnvFallbackProductionReady: false }
  },
  {
    id: "llm_it_model_allowlist_required",
    category: "model_allowlist",
    status: "warning",
    severity: "critical",
    description: "Live tests require an explicit model allowlist and default model within that allowlist.",
    remediation: "Set AICHESTRA_LLM_ALLOWED_MODELS and AICHESTRA_LLM_DEFAULT_MODEL for a low-cost test model.",
    evidence: ["docs/features/llm-gateway/v2.md"],
    metadata: { modelNamesReturned: false }
  },
  {
    id: "llm_it_budget_cap_required",
    category: "budget",
    status: "warning",
    severity: "critical",
    description: "Live tests require a small explicit budget cap.",
    remediation: "Set AICHESTRA_LLM_TEST_BUDGET_USD to a positive value at or below the profile maximum.",
    evidence: ["docs/roadmaps/llm-gateway-integration-test-profile/v1.md"],
    metadata: { requiredMaximumBudgetUsd: 1 }
  },
  {
    id: "llm_it_policy_required",
    category: "policy",
    status: "pass",
    severity: "critical",
    description: "Remote completion must still pass Policy-as-code before any provider call.",
    remediation: "Do not bypass StaticPolicyEngine for integration tests.",
    evidence: ["docs/foundations/policy-as-code/v0.md"],
    metadata: { policyBypassAllowed: false }
  },
  {
    id: "llm_it_auth_required",
    category: "auth",
    status: "pass",
    severity: "high",
    description: "Integration-test calls must preserve Auth/RBAC actor attribution metadata.",
    remediation: "Keep RequestContext/AuthContext propagation in the LLM gateway path.",
    evidence: ["docs/roadmaps/auth-rbac-production/v1.md"],
    metadata: { mockAuthProductionReady: false }
  },
  {
    id: "llm_it_redaction_required",
    category: "redaction",
    status: "pass",
    severity: "critical",
    description: "Prompts, outputs, API keys, and provider responses must be redacted or preview-limited before storage.",
    remediation: "Keep no-secret and no-raw-output tests with the profile.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { rawPromptStored: false, rawOutputStored: false, apiKeyStored: false }
  },
  {
    id: "llm_it_audit_metadata_only",
    category: "audit",
    status: "pass",
    severity: "high",
    description: "Audit entries must record sanitized metadata only.",
    remediation: "Do not store raw prompts, outputs, API keys, env values, or provider responses in audit.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { externalAuditExportEnabled: false }
  },
  {
    id: "llm_it_no_streaming",
    category: "no_streaming",
    status: "pass",
    severity: "high",
    description: "Streaming remains out of scope for the integration-test profile.",
    remediation: "Keep streaming disabled and fail unsafe gate detection if a streaming flag is enabled.",
    evidence: ["AGENTS.md"],
    metadata: { streamingAllowed: false }
  },
  {
    id: "llm_it_no_tool_calls",
    category: "no_tool_calls",
    status: "pass",
    severity: "high",
    description: "Tool calling remains out of scope for the integration-test profile.",
    remediation: "Keep tool calls disabled and fail unsafe gate detection if a tool-call flag is enabled.",
    evidence: ["AGENTS.md"],
    metadata: { toolCallsAllowed: false }
  },
  {
    id: "llm_it_no_unbounded_fallback",
    category: "no_unbounded_fallback",
    status: "pass",
    severity: "critical",
    description: "Fallback must be disabled by default and never unbounded.",
    remediation: "Keep AICHESTRA_ENABLE_LLM_FALLBACK=false and AICHESTRA_LLM_MAX_FALLBACK_ATTEMPTS=0 for this profile.",
    evidence: ["docs/features/llm-gateway/v2.md"],
    metadata: { fallbackEnabledByDefault: false, maxFallbackAttempts: 0 }
  }
];

export const defaultVaultIntegrationTestProfile: VaultIntegrationTestProfile = {
  id: "vault_integration_test_profile_v1",
  name: "Vault integration-test profile v1",
  status: "ready_if_configured",
  backendKind: "vault",
  requiredEnvVars: [
    "AICHESTRA_VAULT_INTEGRATION_TESTS",
    "AICHESTRA_SECRET_BACKEND_PROVIDER",
    "AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER",
    "AICHESTRA_VAULT_ADDR",
    "AICHESTRA_VAULT_AUTH_METHOD",
    "AICHESTRA_VAULT_TOKEN",
    "AICHESTRA_VAULT_KV_MOUNT",
    "AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES",
    "AICHESTRA_TEST_VAULT_SECRET_PATH",
    "AICHESTRA_TEST_VAULT_SECRET_KEY"
  ],
  requiredSecretRefs: ["vault_test_secretref_metadata"],
  requiredPathAllowlist: ["AICHESTRA_TEST_VAULT_SECRET_PATH must be under AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES"],
  allowedOperations: [
    "config_validation",
    "secretref_validation_status_only",
    "path_allowlist_validation",
    "one_kv_v2_read_from_allowlisted_test_path_when_gated",
    "credential_handle_resolution_status_only",
    "auth_policy_gate_validation",
    "audit_redaction_validation",
    "no_secret_exposure_validation"
  ],
  forbiddenOperations: [
    "vault_write",
    "vault_delete",
    "vault_rotate",
    "vault_broad_list",
    "production_path_access",
    "secret_value_return",
    "vault_token_return",
    "env_value_return",
    "credential_cache_read",
    "production_vault_rollout"
  ],
  testSecretPattern: "provider=vault, metadata.vaultMount=<AICHESTRA_VAULT_KV_MOUNT>, metadata.vaultPath=<AICHESTRA_TEST_VAULT_SECRET_PATH>, metadata.vaultKey=<AICHESTRA_TEST_VAULT_SECRET_KEY>, dataShape=single_key",
  auditRequirements: [
    "vault_integration_test_skipped_when_gates_missing",
    "vault_config_validated_metadata_only",
    "vault_path_allowlist_checked",
    "vault_secret_resolution_requested_metadata_only",
    "vault_secret_resolution_allowed_or_missing_metadata_only",
    "vault_secret_value_redacted"
  ],
  metadata: {
    docs: "docs/roadmaps/vault-integration-test-profile/v1.md",
    liveTestsEnabledByDefault: false,
    kvVersion: "v2",
    noWrite: true,
    noDelete: true,
    noRotate: true,
    noBroadList: true,
    noSecretsReturned: true,
    noVaultCallsInDefaultTests: true
  }
};

export const defaultVaultIntegrationTestCases: VaultIntegrationTestCase[] = [
  {
    id: "vault_it_config_validation",
    profileId: "vault_integration_test_profile_v1",
    name: "Validate Vault integration gates",
    category: "config_validation",
    enabledByDefault: true,
    requiresLiveVault: false,
    requiredEnvVars: [],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { validatesBooleansAndCountsOnly: true, envValuesReturned: false }
  },
  {
    id: "vault_it_secretref_validation",
    profileId: "vault_integration_test_profile_v1",
    name: "Validate provider=vault SecretRef metadata shape",
    category: "secretref_validation",
    enabledByDefault: true,
    requiresLiveVault: false,
    requiredEnvVars: ["AICHESTRA_VAULT_KV_MOUNT", "AICHESTRA_TEST_VAULT_SECRET_PATH", "AICHESTRA_TEST_VAULT_SECRET_KEY"],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { secretValueReturned: false, secretRefMetadataOnly: true }
  },
  {
    id: "vault_it_path_allowlist",
    profileId: "vault_integration_test_profile_v1",
    name: "Validate test Vault path allowlist",
    category: "path_allowlist",
    enabledByDefault: true,
    requiresLiveVault: false,
    requiredEnvVars: ["AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES", "AICHESTRA_TEST_VAULT_SECRET_PATH"],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { pathValuesReturned: false, allowlistCountOnly: true }
  },
  {
    id: "vault_it_kv_v2_read_gated",
    profileId: "vault_integration_test_profile_v1",
    name: "Read one KV v2 test secret only when every gate passes",
    category: "kv_v2_read",
    enabledByDefault: false,
    requiresLiveVault: true,
    requiredEnvVars: [
      "AICHESTRA_VAULT_INTEGRATION_TESTS",
      "AICHESTRA_SECRET_BACKEND_PROVIDER",
      "AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER",
      "AICHESTRA_VAULT_ADDR",
      "AICHESTRA_VAULT_AUTH_METHOD",
      "AICHESTRA_VAULT_TOKEN",
      "AICHESTRA_VAULT_KV_MOUNT",
      "AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES",
      "AICHESTRA_TEST_VAULT_SECRET_PATH",
      "AICHESTRA_TEST_VAULT_SECRET_KEY"
    ],
    expectedSideEffects: ["single_allowlisted_read_status_only"],
    cleanupRequired: false,
    status: "gated_live",
    metadata: { liveVaultSkippedByDefault: true, writeAllowed: false, broadListAllowed: false }
  },
  {
    id: "vault_it_credential_resolution_gated",
    profileId: "vault_integration_test_profile_v1",
    name: "Resolve a CredentialHandle through a Vault-backed SecretRef when gated",
    category: "credential_resolution",
    enabledByDefault: false,
    requiresLiveVault: true,
    requiredEnvVars: [
      "AICHESTRA_VAULT_INTEGRATION_TESTS",
      "AICHESTRA_SECRET_BACKEND_PROVIDER",
      "AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER",
      "AICHESTRA_TEST_VAULT_SECRET_PATH",
      "AICHESTRA_TEST_VAULT_SECRET_KEY"
    ],
    expectedSideEffects: ["metadata_only_credential_handle"],
    cleanupRequired: false,
    status: "gated_live",
    metadata: { credentialValueReturned: false, leaseMetadataOnly: true }
  },
  {
    id: "vault_it_auth_policy_gate",
    profileId: "vault_integration_test_profile_v1",
    name: "Verify Auth/RBAC and Policy gates before Vault reads",
    category: "auth_policy_gate",
    enabledByDefault: true,
    requiresLiveVault: false,
    requiredEnvVars: [],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { authBypassAllowed: false, policyBypassAllowed: false }
  },
  {
    id: "vault_it_audit_redaction",
    profileId: "vault_integration_test_profile_v1",
    name: "Verify Vault audit metadata and redaction",
    category: "audit_redaction",
    enabledByDefault: true,
    requiresLiveVault: false,
    requiredEnvVars: [],
    expectedSideEffects: ["sanitized_audit_metadata"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { vaultTokenStored: false, vaultSecretValueStored: false, envValuesStored: false }
  },
  {
    id: "vault_it_no_secret_exposure",
    profileId: "vault_integration_test_profile_v1",
    name: "Verify public results contain no Vault secret material",
    category: "no_secret_exposure",
    enabledByDefault: true,
    requiresLiveVault: false,
    requiredEnvVars: [],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { vaultTokenExposed: false, vaultSecretValueExposed: false, envValuesExposed: false }
  }
];

export const defaultVaultIntegrationTestSafetyChecks: VaultIntegrationTestSafetyCheck[] = [
  {
    id: "vault_it_env_gates_missing_skip",
    category: "env_gates",
    status: "warning",
    severity: "high",
    description: "Live Vault integration tests must skip unless every required gate is configured.",
    remediation: "Set every documented Vault integration-test gate only in a reviewed non-production profile.",
    evidence: ["docs/roadmaps/vault-integration-test-profile/v1.md"],
    metadata: { missingGatesSkipNotFail: true }
  },
  {
    id: "vault_it_address_configured",
    category: "vault_address",
    status: "warning",
    severity: "high",
    description: "Live tests require a Vault address, but readiness surfaces must expose only configured true/false.",
    remediation: "Configure AICHESTRA_VAULT_ADDR for live tests; never return the value in API/health/dashboard.",
    evidence: ["docs/foundations/vault-secret-backend/v1.md"],
    metadata: { addressValueReturned: false }
  },
  {
    id: "vault_it_token_auth_only",
    category: "auth_method",
    status: "warning",
    severity: "high",
    description: "v1 live tests support token auth only; AppRole and cloud identity remain future.",
    remediation: "Set AICHESTRA_VAULT_AUTH_METHOD=token for live tests.",
    evidence: ["docs/foundations/vault-secret-backend/v1.md"],
    metadata: { approleProductionRolloutImplemented: false }
  },
  {
    id: "vault_it_token_configured_hidden",
    category: "token_presence",
    status: "warning",
    severity: "critical",
    description: "Live tests require a Vault token, and the token must never be returned.",
    remediation: "Configure AICHESTRA_VAULT_TOKEN only in a test environment and rely on no-secret assertions.",
    evidence: ["docs/foundations/vault-secret-backend/v1.md"],
    metadata: { tokenValueReturned: false }
  },
  {
    id: "vault_it_path_allowlist_required",
    category: "path_allowlist",
    status: "warning",
    severity: "critical",
    description: "The configured test path must be under an explicit allowed path prefix.",
    remediation: "Set AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES to include only non-production test prefixes.",
    evidence: ["docs/roadmaps/vault-integration-test-profile/v1.md"],
    metadata: { pathValuesReturned: false, broadListingAllowed: false }
  },
  {
    id: "vault_it_test_path_nonproduction",
    category: "test_secret_path",
    status: "warning",
    severity: "critical",
    description: "The test secret path must be clearly non-production and test-only.",
    remediation: "Use a path containing test, tests, integration, sandbox, nonprod, or ci.",
    evidence: ["docs/roadmaps/vault-integration-test-profile/v1.md"],
    metadata: { rawPathReturned: false }
  },
  {
    id: "vault_it_no_write",
    category: "no_write",
    status: "pass",
    severity: "critical",
    description: "The profile must not write Vault secrets.",
    remediation: "Keep live tests read-only and do not add write endpoints.",
    evidence: ["AGENTS.md"],
    metadata: { writeAllowed: false }
  },
  {
    id: "vault_it_no_delete",
    category: "no_delete",
    status: "pass",
    severity: "critical",
    description: "The profile must not delete Vault secrets or metadata.",
    remediation: "Keep cleanup as no-op; do not add destructive Vault calls.",
    evidence: ["AGENTS.md"],
    metadata: { deleteAllowed: false }
  },
  {
    id: "vault_it_no_rotate",
    category: "no_rotate",
    status: "pass",
    severity: "critical",
    description: "The profile must not rotate Vault secrets.",
    remediation: "Leave rotation as future planning only.",
    evidence: ["AGENTS.md"],
    metadata: { rotateAllowed: false }
  },
  {
    id: "vault_it_no_broad_list",
    category: "no_broad_list",
    status: "pass",
    severity: "critical",
    description: "The profile must not list broad Vault paths.",
    remediation: "Read only the explicitly configured test path/key.",
    evidence: ["docs/foundations/vault-secret-backend/v1.md"],
    metadata: { broadListAllowed: false }
  },
  {
    id: "vault_it_redaction_required",
    category: "redaction",
    status: "pass",
    severity: "critical",
    description: "Vault tokens, env dumps, secret values, and credential cache paths must be redacted.",
    remediation: "Keep redaction and no-secret tests with the profile.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { vaultTokenStored: false, vaultSecretValueStored: false }
  },
  {
    id: "vault_it_audit_metadata_only",
    category: "audit",
    status: "pass",
    severity: "high",
    description: "Audit entries must record sanitized Vault metadata only.",
    remediation: "Do not store Vault tokens, secret values, env values, or raw path lists in audit.",
    evidence: ["docs/foundations/vault-secret-backend/v1.md"],
    metadata: { rawSecretStored: false, externalAuditExportEnabled: false }
  },
  {
    id: "vault_it_no_secret_exposure",
    category: "no_secret_exposure",
    status: "pass",
    severity: "critical",
    description: "Readiness, API, health, dashboard, tests, and audit must not expose Vault secret material.",
    remediation: "Expose booleans, counts, statuses, and sanitized identifiers only.",
    evidence: ["docs/features/dashboard/v0.md"],
    metadata: { vaultTokenExposed: false, vaultSecretValueExposed: false, envValuesExposed: false }
  }
];

export const defaultMergeQueueIntegrationTestProfile: MergeQueueIntegrationTestProfile = {
  id: "merge_queue_integration_test_profile_v1",
  name: "Merge Queue live integration-test profile v1",
  status: "disabled",
  requiredEnvVars: [
    "AICHESTRA_MERGE_QUEUE_INTEGRATION_TESTS",
    "AICHESTRA_ENABLE_REMOTE_GIT",
    "AICHESTRA_GIT_PROVIDER",
    "AICHESTRA_GIT_ALLOWED_REPOS",
    "AICHESTRA_GIT_ALLOWED_BRANCH_PREFIX",
    "AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY",
    "AICHESTRA_TEST_MERGE_QUEUE_REPO",
    "AICHESTRA_TEST_MERGE_QUEUE_BASE_BRANCH",
    "AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES"
  ],
  requiredRepoAllowlist: ["AICHESTRA_TEST_MERGE_QUEUE_REPO must be listed in AICHESTRA_GIT_ALLOWED_REPOS"],
  requiredBranchPrefix: "aichestra/test/",
  allowedOperations: [
    "config_validation",
    "queue_readiness_metadata_evaluation",
    "local_dry_run_merge_simulation_only",
    "branch_lease_metadata_check",
    "conflict_risk_metadata_check",
    "policy_decision_metadata_check",
    "cleanup_metadata_check"
  ],
  forbiddenOperations: [
    "real_merge_execution",
    "auto_merge",
    "remote_merge_api_call",
    "remote_rebase",
    "remote_force_push",
    "remote_branch_delete",
    "remote_pr_update",
    "fetch",
    "push",
    "git_checkout",
    "git_switch",
    "vendor_cli_execution",
    "llm_call",
    "workspace_mutation",
    "env_value_return",
    "credential_cache_read"
  ],
  cleanupPolicy: "manual_mark_only",
  metadata: {
    docs: "docs/features/merge-queue-live-integration-test-profile/v1.md",
    planDocs: "docs/features/merge-queue-live-integration-test-profile/v1-plan.md",
    liveTestsEnabledByDefault: false,
    noAutoMerge: true,
    noForcePush: true,
    noBranchDelete: true,
    noRemoteMerge: true,
    noRemoteRebase: true,
    dryRunOnly: true,
    realMergeExecuted: false,
    remoteGitCallsInDefaultTests: false,
    envValuesReturned: false,
    repoUrlsReturned: false,
    branchNamesReturned: false
  }
};

export const defaultMergeQueueIntegrationTestCases: MergeQueueIntegrationTestCase[] = [
  {
    id: "mq_it_config_validation",
    profileId: "merge_queue_integration_test_profile_v1",
    name: "Validate merge queue integration-test gates",
    category: "config_validation",
    enabledByDefault: true,
    requiresLiveGit: false,
    requiredEnvVars: [],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { validatesBooleansAndCountsOnly: true, envValuesReturned: false }
  },
  {
    id: "mq_it_queue_readiness",
    profileId: "merge_queue_integration_test_profile_v1",
    name: "Evaluate merge queue readiness against test-only branch metadata",
    category: "queue_readiness",
    enabledByDefault: true,
    requiresLiveGit: false,
    requiredEnvVars: [],
    expectedSideEffects: ["readiness_metadata_only"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { mergeExecuted: false, autoMergeEnabled: false }
  },
  {
    id: "mq_it_dry_run_merge_local",
    profileId: "merge_queue_integration_test_profile_v1",
    name: "Run local dry-run merge simulation against test fixtures",
    category: "dry_run_merge",
    enabledByDefault: true,
    requiresLiveGit: false,
    requiredEnvVars: [],
    expectedSideEffects: ["local_dry_run_metadata"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { fetchOrPush: false, providerCall: false }
  },
  {
    id: "mq_it_branch_lease_check",
    profileId: "merge_queue_integration_test_profile_v1",
    name: "Validate branch lease metadata for the test fixtures",
    category: "branch_lease_check",
    enabledByDefault: true,
    requiresLiveGit: false,
    requiredEnvVars: [],
    expectedSideEffects: ["lease_metadata_only"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { leaseMetadataOnly: true }
  },
  {
    id: "mq_it_conflict_risk_check",
    profileId: "merge_queue_integration_test_profile_v1",
    name: "Validate conflict risk scoring metadata for the test fixtures",
    category: "conflict_risk_check",
    enabledByDefault: true,
    requiresLiveGit: false,
    requiredEnvVars: [],
    expectedSideEffects: ["risk_metadata_only"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { riskMetadataOnly: true }
  },
  {
    id: "mq_it_policy_decision_check",
    profileId: "merge_queue_integration_test_profile_v1",
    name: "Validate Merge Queue Policy v2 decision metadata under the live profile",
    category: "policy_decision_check",
    enabledByDefault: true,
    requiresLiveGit: false,
    requiredEnvVars: [],
    expectedSideEffects: ["policy_metadata_only"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { mergeExecuteFutureDenied: true }
  },
  {
    id: "mq_it_cleanup_check",
    profileId: "merge_queue_integration_test_profile_v1",
    name: "Confirm cleanup is manual mark-only and branch deletion is forbidden",
    category: "cleanup_check",
    enabledByDefault: true,
    requiresLiveGit: false,
    requiredEnvVars: [],
    expectedSideEffects: ["none"],
    cleanupRequired: false,
    status: "active_mock",
    metadata: { branchDeletionAllowed: false, manualMarkOnly: true }
  },
  {
    id: "mq_it_live_dry_run_evaluation_gated",
    profileId: "merge_queue_integration_test_profile_v1",
    name: "Evaluate merge queue against configured test branches only when every gate is configured",
    category: "queue_readiness",
    enabledByDefault: false,
    requiresLiveGit: true,
    requiredEnvVars: [
      "AICHESTRA_MERGE_QUEUE_INTEGRATION_TESTS",
      "AICHESTRA_ENABLE_REMOTE_GIT",
      "AICHESTRA_GIT_PROVIDER",
      "AICHESTRA_GIT_ALLOWED_REPOS",
      "AICHESTRA_GIT_ALLOWED_BRANCH_PREFIX",
      "AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY",
      "AICHESTRA_TEST_MERGE_QUEUE_REPO",
      "AICHESTRA_TEST_MERGE_QUEUE_BASE_BRANCH",
      "AICHESTRA_TEST_MERGE_QUEUE_SOURCE_BRANCHES"
    ],
    expectedSideEffects: ["readiness_metadata_only"],
    cleanupRequired: false,
    status: "gated_live",
    metadata: { liveMergeExecuted: false, providerMergeCallEnabled: false }
  }
];

export const defaultMergeQueueIntegrationSafetyChecks: MergeQueueIntegrationSafetyCheck[] = [
  {
    id: "mq_it_env_gates_missing_skip",
    category: "env_gates",
    status: "warning",
    severity: "high",
    description: "Live merge queue integration tests must skip unless every required gate is configured.",
    remediation: "Set every documented merge queue integration gate only in a reviewed non-production profile.",
    evidence: ["docs/features/merge-queue-live-integration-test-profile/v1.md"],
    metadata: { missingGatesSkipNotFail: true }
  },
  {
    id: "mq_it_repo_allowlist_required",
    category: "repo_allowlist",
    status: "warning",
    severity: "critical",
    description: "The configured test repo must appear in the allowlist; arbitrary repos are forbidden.",
    remediation: "Set AICHESTRA_GIT_ALLOWED_REPOS and AICHESTRA_TEST_MERGE_QUEUE_REPO to a non-production fixture repo.",
    evidence: ["docs/features/merge-queue-live-integration-test-profile/v1.md"],
    metadata: { repoValuesReturned: false }
  },
  {
    id: "mq_it_branch_prefix_required",
    category: "branch_prefix",
    status: "warning",
    severity: "critical",
    description: "All test branches must use the aichestra/test/ prefix; other prefixes are unsafe.",
    remediation: "Configure AICHESTRA_GIT_ALLOWED_BRANCH_PREFIX=aichestra/test/ and ensure base/source branches comply.",
    evidence: ["docs/features/merge-queue-live-integration-test-profile/v1.md"],
    metadata: { branchValuesReturned: false }
  },
  {
    id: "mq_it_no_auto_merge",
    category: "no_auto_merge",
    status: "pass",
    severity: "critical",
    description: "The profile must not enable auto-merge or remote merge execution.",
    remediation: "Keep AICHESTRA_ALLOW_REMOTE_MERGE=false and never call provider merge APIs from this profile.",
    evidence: ["AGENTS.md", "docs/features/merge-queue-policy/v2.md"],
    metadata: { autoMergeAllowed: false, remoteMergeAllowed: false }
  },
  {
    id: "mq_it_no_force_push",
    category: "no_force_push",
    status: "pass",
    severity: "critical",
    description: "Force-push must remain forbidden.",
    remediation: "Keep AICHESTRA_ALLOW_REMOTE_FORCE_PUSH=false.",
    evidence: ["docs/features/real-git-adapter/v2.md"],
    metadata: { forcePushAllowed: false }
  },
  {
    id: "mq_it_no_branch_delete",
    category: "no_branch_delete",
    status: "pass",
    severity: "critical",
    description: "Branch deletion must remain forbidden, including for cleanup.",
    remediation: "Keep AICHESTRA_ALLOW_REMOTE_BRANCH_DELETE=false.",
    evidence: ["docs/features/real-git-adapter/v2.md"],
    metadata: { branchDeletionAllowed: false }
  },
  {
    id: "mq_it_dry_run_only",
    category: "dry_run_only",
    status: "warning",
    severity: "critical",
    description: "Live validation must remain dry-run-only.",
    remediation: "Keep AICHESTRA_MERGE_QUEUE_DRY_RUN_ONLY=true and only run the existing safe local/mock dry-run path.",
    evidence: ["docs/features/merge-queue-policy/v2.md"],
    metadata: { realMergeExecuted: false }
  },
  {
    id: "mq_it_cleanup_manual",
    category: "cleanup",
    status: "pass",
    severity: "high",
    description: "Cleanup must remain manual mark-only.",
    remediation: "Do not delete branches, close PRs, or call provider mutation APIs from this profile.",
    evidence: ["docs/features/merge-queue-live-integration-test-profile/v1.md"],
    metadata: { manualMarkOnly: true, branchDeletionAllowed: false }
  },
  {
    id: "mq_it_audit_sanitized",
    category: "audit",
    status: "pass",
    severity: "high",
    description: "Audit and dashboard entries must record sanitized metadata only, with no env values, repo URLs, branch names, or remote merge calls.",
    remediation: "Keep redaction in dashboard sanitization and never log env values.",
    evidence: ["docs/foundations/observability-audit-retention/v0.md"],
    metadata: { envValuesStored: false, repoUrlsStored: false, branchNamesStored: false }
  }
];
