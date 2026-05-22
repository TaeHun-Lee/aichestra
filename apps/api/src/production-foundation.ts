import type { StorageHealth, StorageProviderKind } from "@aichestra/db";

export type RuntimeProfile = "local" | "test" | "staging" | "production";

export type ProductionFoundationPhaseStatus = "ready" | "blocked" | "not_required";

export type ProductionFoundationPhaseSummary = {
  id: "phase_1_auth" | "phase_2_secrets" | "phase_3_storage";
  status: ProductionFoundationPhaseStatus;
  blockers: string[];
  metadata: Record<string, unknown>;
};

export type ProductionFoundationOperationalCheck = {
  id: "auth_migration" | "secretref_rollout" | "postgres_operations" | "audit_durability";
  status: ProductionFoundationPhaseStatus;
  blockers: string[];
  metadata: Record<string, unknown>;
};

export type ProductionFoundationSummary = {
  runtimeProfile: RuntimeProfile;
  productionRuntime: boolean;
  status: "ready" | "blocked" | "not_required";
  startupStatus: "ready" | "blocked" | "not_required";
  operationalStatus: "ready" | "blocked" | "not_required";
  blockers: string[];
  startupBlockers: string[];
  operationalBlockers: string[];
  phases: ProductionFoundationPhaseSummary[];
  operationalChecks: ProductionFoundationOperationalCheck[];
  metadata: Record<string, unknown>;
};

export type ProductionFoundationInput = {
  env?: Record<string, string | undefined>;
  storageKind: StorageProviderKind;
  storageHealth?: StorageHealth;
  authConfig: Record<string, unknown>;
  securityConfig: Record<string, unknown>;
};

export function runtimeProfileFromEnv(env: Record<string, string | undefined> = process.env): RuntimeProfile {
  const raw = (env.AICHESTRA_RUNTIME_PROFILE ?? env.APP_RUNTIME_PROFILE ?? env.NODE_ENV ?? "local").toLowerCase();
  if (raw === "production" || raw === "prod") return "production";
  if (raw === "staging" || raw === "stage") return "staging";
  if (raw === "test" || raw === "ci") return "test";
  return "local";
}

export function evaluateProductionFoundation(input: ProductionFoundationInput): ProductionFoundationSummary {
  const env = input.env ?? process.env;
  const runtimeProfile = runtimeProfileFromEnv(env);
  const productionRuntime = runtimeProfile === "production";
  const phases = [
    evaluateAuthPhase(input, productionRuntime, env),
    evaluateSecretPhase(input, productionRuntime),
    evaluateStoragePhase(input, productionRuntime)
  ];
  const operationalChecks = [
    evaluateAuthMigrationCheck(env, productionRuntime),
    evaluateSecretRefRolloutCheck(input, productionRuntime),
    evaluatePostgresOperationsCheck(env, input, productionRuntime),
    evaluateAuditDurabilityCheck(env, productionRuntime)
  ];
  const startupBlockers = phases.flatMap((phase) => phase.blockers);
  const operationalBlockers = operationalChecks.flatMap((check) => check.blockers);
  return {
    runtimeProfile,
    productionRuntime,
    status: productionRuntime ? startupBlockers.length === 0 ? "ready" : "blocked" : "not_required",
    startupStatus: productionRuntime ? startupBlockers.length === 0 ? "ready" : "blocked" : "not_required",
    operationalStatus: productionRuntime ? operationalBlockers.length === 0 ? "ready" : "blocked" : "not_required",
    blockers: startupBlockers,
    startupBlockers,
    operationalBlockers,
    phases,
    operationalChecks,
    metadata: {
      mockRuntimeAllowed: !productionRuntime,
      productionRuntimeBlocksUnsafeDefaults: true,
      noSecretValuesReturned: true,
      envValuesReturned: false,
      operationalChecksDoNotExecuteExternalCalls: true
    }
  };
}

export function assertProductionFoundationReady(input: ProductionFoundationInput): ProductionFoundationSummary {
  const summary = evaluateProductionFoundation(input);
  if (summary.productionRuntime && summary.status !== "ready") {
    throw new Error(`production_foundation_blocked:${summary.blockers.join(",")}`);
  }
  return summary;
}

function evaluateAuthPhase(input: ProductionFoundationInput, productionRuntime: boolean, env: Record<string, string | undefined>): ProductionFoundationPhaseSummary {
  if (!productionRuntime) return notRequiredPhase("phase_1_auth");
  const productionAuthEnabled = input.authConfig.productionAuthEnabled === true;
  const providerKind = stringValue(input.authConfig.providerKind) ?? stringValue(input.authConfig.authProviderKind);
  const tokenValidationEnabled = input.authConfig.tokenValidationEnabled === true;
  const staticActorId = stringValue(env.AICHESTRA_AUTH_STATIC_ACTOR_ID);
  const allowedStaticActors = csv(env.AICHESTRA_AUTH_STATIC_ALLOWED_ACTORS);
  const staticActorAllowlisted = staticActorId !== undefined && allowedStaticActors.includes(staticActorId);
  const blockers = [
    productionAuthEnabled ? undefined : "phase1_auth:production_auth_disabled",
    providerKind === "static_bearer" ? undefined : "phase1_auth:static_bearer_provider_required",
    tokenValidationEnabled ? undefined : "phase1_auth:token_validation_disabled",
    staticActorId ? undefined : "phase1_auth:static_actor_required",
    allowedStaticActors.length > 0 ? undefined : "phase1_auth:static_actor_allowlist_required",
    staticActorAllowlisted ? undefined : "phase1_auth:static_actor_not_allowlisted"
  ].filter((item): item is string => Boolean(item));
  return {
    id: "phase_1_auth",
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    metadata: {
      providerKind,
      productionAuthEnabled,
      tokenValidationEnabled,
      staticActorConfigured: staticActorId !== undefined,
      staticActorAllowlistCount: allowedStaticActors.length,
      staticActorAllowlisted,
      authorizationHeaderStored: false,
      tokenValuesStored: false
    }
  };
}

function evaluateSecretPhase(input: ProductionFoundationInput, productionRuntime: boolean): ProductionFoundationPhaseSummary {
  if (!productionRuntime) return notRequiredPhase("phase_2_secrets");
  const selectedProvider = stringValue(input.securityConfig.secretBackendProviderSelected);
  const vaultEnabled = input.securityConfig.vaultSecretProviderEnabled === true;
  const vaultLiveReady = input.securityConfig.vaultLiveUsageReady === true;
  const envFallbackAllowed = input.securityConfig.envFallbackProductionAllowed === true;
  const envSecretProviderEnabled = input.securityConfig.envSecretProviderEnabled === true;
  const activeEnvSecretRefCount = numberValue(input.securityConfig.activeEnvSecretRefCount);
  const vaultAllowedPathPrefixCount = numberValue(input.securityConfig.vaultAllowedPathPrefixCount);
  const blockers = [
    selectedProvider === "vault" ? undefined : "phase2_secrets:vault_backend_required",
    vaultEnabled ? undefined : "phase2_secrets:vault_provider_disabled",
    vaultLiveReady ? undefined : "phase2_secrets:vault_live_usage_not_ready",
    envFallbackAllowed ? "phase2_secrets:env_fallback_not_allowed_in_production" : undefined,
    envSecretProviderEnabled ? "phase2_secrets:env_secret_provider_disabled_in_production_required" : undefined,
    activeEnvSecretRefCount > 0 ? "phase2_secrets:active_env_secretrefs_not_allowed_in_production" : undefined,
    vaultAllowedPathPrefixCount > 0 ? undefined : "phase2_secrets:vault_allowed_path_prefix_required"
  ].filter((item): item is string => Boolean(item));
  return {
    id: "phase_2_secrets",
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    metadata: {
      selectedProvider,
      vaultEnabled,
      vaultLiveReady,
      envFallbackAllowed,
      envSecretProviderEnabled,
      activeEnvSecretRefCount,
      vaultAllowedPathPrefixCount,
      rawSecretsReturned: false,
      envValuesReturned: false
    }
  };
}

function evaluateStoragePhase(input: ProductionFoundationInput, productionRuntime: boolean): ProductionFoundationPhaseSummary {
  if (!productionRuntime) return notRequiredPhase("phase_3_storage");
  const storageHealthy = input.storageHealth?.healthy;
  const blockers = [
    input.storageKind === "postgres" ? undefined : "phase3_storage:postgres_required",
    storageHealthy === false ? "phase3_storage:postgres_unhealthy" : undefined
  ].filter((item): item is string => Boolean(item));
  return {
    id: "phase_3_storage",
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    metadata: {
      storageKind: input.storageKind,
      storageHealthy: storageHealthy ?? "not_checked",
      storageMessage: input.storageHealth?.message,
      inMemoryProductionAllowed: false
    }
  };
}

function notRequiredPhase(id: ProductionFoundationPhaseSummary["id"]): ProductionFoundationPhaseSummary {
  return {
    id,
    status: "not_required",
    blockers: [],
    metadata: {
      productionRuntime: false
    }
  };
}

function notRequiredCheck(id: ProductionFoundationOperationalCheck["id"]): ProductionFoundationOperationalCheck {
  return {
    id,
    status: "not_required",
    blockers: [],
    metadata: {
      productionRuntime: false
    }
  };
}

function evaluateAuthMigrationCheck(env: Record<string, string | undefined>, productionRuntime: boolean): ProductionFoundationOperationalCheck {
  if (!productionRuntime) return notRequiredCheck("auth_migration");
  const oidcMigrationAcknowledged = flag(env.AICHESTRA_AUTH_OIDC_MIGRATION_PLAN_ACK);
  const blockers = [
    oidcMigrationAcknowledged ? undefined : "auth_migration:oidc_or_idp_migration_plan_not_acknowledged"
  ].filter((item): item is string => Boolean(item));
  return {
    id: "auth_migration",
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    metadata: {
      staticBearerIsBootstrapOnly: true,
      oidcMigrationAcknowledged,
      externalIdpCallsExecuted: false,
      tokensReturned: false
    }
  };
}

function evaluateSecretRefRolloutCheck(input: ProductionFoundationInput, productionRuntime: boolean): ProductionFoundationOperationalCheck {
  if (!productionRuntime) return notRequiredCheck("secretref_rollout");
  const activeVaultSecretRefCount = numberValue(input.securityConfig.activeVaultSecretRefCount);
  const activeEnvSecretRefCount = numberValue(input.securityConfig.activeEnvSecretRefCount);
  const blockers = [
    activeVaultSecretRefCount > 0 ? undefined : "secretref_rollout:active_vault_secretref_required",
    activeEnvSecretRefCount === 0 ? undefined : "secretref_rollout:env_secretrefs_must_be_migrated"
  ].filter((item): item is string => Boolean(item));
  return {
    id: "secretref_rollout",
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    metadata: {
      activeVaultSecretRefCount,
      activeEnvSecretRefCount,
      rawSecretsReturned: false,
      envValuesReturned: false
    }
  };
}

function evaluatePostgresOperationsCheck(
  env: Record<string, string | undefined>,
  input: ProductionFoundationInput,
  productionRuntime: boolean
): ProductionFoundationOperationalCheck {
  if (!productionRuntime) return notRequiredCheck("postgres_operations");
  const migrationsApplied = flag(env.AICHESTRA_DATABASE_MIGRATIONS_APPLIED);
  const backupRestoreRunbookAcknowledged = flag(env.AICHESTRA_DATABASE_BACKUP_RESTORE_RUNBOOK_ACK);
  const blockers = [
    input.storageKind === "postgres" ? undefined : "postgres_operations:postgres_storage_required",
    migrationsApplied ? undefined : "postgres_operations:migration_confirmation_required",
    backupRestoreRunbookAcknowledged ? undefined : "postgres_operations:backup_restore_runbook_ack_required"
  ].filter((item): item is string => Boolean(item));
  return {
    id: "postgres_operations",
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    metadata: {
      storageKind: input.storageKind,
      migrationsApplied,
      backupRestoreRunbookAcknowledged,
      databaseUrlExposed: false,
      migrationExecutionAttempted: false,
      backupExecutionAttempted: false,
      restoreExecutionAttempted: false
    }
  };
}

function evaluateAuditDurabilityCheck(env: Record<string, string | undefined>, productionRuntime: boolean): ProductionFoundationOperationalCheck {
  if (!productionRuntime) return notRequiredCheck("audit_durability");
  const auditDurableStorage = stringValue(env.AICHESTRA_AUDIT_DURABLE_STORAGE);
  const retentionPolicyAcknowledged = flag(env.AICHESTRA_AUDIT_RETENTION_POLICY_ACK);
  const exportDisabledOrGated = env.AICHESTRA_OBSERVABILITY_EXPORT_ENABLED !== "true" || flag(env.AICHESTRA_OBSERVABILITY_EXPORT_REVIEWED);
  const blockers = [
    auditDurableStorage === "postgres" ? undefined : "audit_durability:postgres_audit_storage_not_confirmed",
    retentionPolicyAcknowledged ? undefined : "audit_durability:retention_policy_ack_required",
    exportDisabledOrGated ? undefined : "audit_durability:export_enabled_without_review"
  ].filter((item): item is string => Boolean(item));
  return {
    id: "audit_durability",
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
    metadata: {
      auditDurableStorage: auditDurableStorage ?? "not_configured",
      retentionPolicyAcknowledged,
      exportDisabledOrGated,
      rawPayloadExportAllowed: false,
      secretExportAllowed: false
    }
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function flag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
