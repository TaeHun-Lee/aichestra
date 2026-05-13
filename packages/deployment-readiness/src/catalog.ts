import type {
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
  ProductionRisk,
  ReadinessCheck,
  SecretBackendMigrationPhase,
  SecretBackendOption,
  SecretBackendReadinessCheck,
  SecretBackendRisk,
  SecretLeasePolicy,
  SecretRotationPlan
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
