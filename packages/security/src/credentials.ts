import type {
  CredentialResolutionStatus,
  EnvSecretProviderConfig,
  SecretRef,
  VaultClientHealth,
  VaultClientKind,
  VaultKvReadRequest,
  VaultKvReadResult,
  VaultSecretProviderConfig,
  VaultSecretProviderResolveResult,
  VaultSecretRefMetadata
} from "./types.ts";
import { sanitizeSecurityMetadata } from "./redaction.ts";

export type EnvSecretProviderResolveResult = {
  ok: boolean;
  status: CredentialResolutionStatus;
  value?: string;
  reason?: string;
};

export type EnvSecretProviderInput = {
  enabled?: boolean;
  allowedEnvKeys?: string[];
  env?: Record<string, string | undefined>;
};

export class EnvSecretProvider {
  private readonly enabled: boolean;
  private readonly allowedEnvKeys: string[];
  private readonly env: Record<string, string | undefined>;

  constructor(input: EnvSecretProviderInput = {}) {
    this.enabled = input.enabled ?? false;
    this.allowedEnvKeys = input.allowedEnvKeys ?? [];
    this.env = input.env ?? process.env;
  }

  getConfig(): EnvSecretProviderConfig {
    return {
      enabled: this.enabled,
      allowedEnvKeys: [...this.allowedEnvKeys],
      allowedEnvKeyCount: this.allowedEnvKeys.length
    };
  }

  resolve(secretRef: SecretRef): EnvSecretProviderResolveResult {
    if (!this.enabled) {
      return { ok: false, status: "blocked", reason: "env_secret_provider_disabled" };
    }
    if (secretRef.provider !== "env") {
      return { ok: false, status: "unavailable", reason: "secret_provider_not_env" };
    }
    if (!secretRef.envKey) {
      return { ok: false, status: "missing", reason: "secret_env_key_missing" };
    }
    if (this.allowedEnvKeys.length > 0 && !this.allowedEnvKeys.includes(secretRef.envKey)) {
      return { ok: false, status: "denied", reason: "env_key_not_allowlisted" };
    }
    const value = this.env[secretRef.envKey];
    if (!value) {
      return { ok: false, status: "missing", reason: "env_secret_missing" };
    }
    return { ok: true, status: "resolved", value };
  }
}

export function createEnvSecretProviderConfigFromEnv(env: Record<string, string | undefined> = process.env): EnvSecretProviderConfig {
  const allowedEnvKeys = parseCsv(env.AICHESTRA_ALLOWED_SECRET_ENV_KEYS);
  return {
    enabled: env.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER === "true",
    allowedEnvKeys,
    allowedEnvKeyCount: allowedEnvKeys.length
  };
}

export function createEnvSecretProviderFromEnv(env: Record<string, string | undefined> = process.env): EnvSecretProvider {
  const config = createEnvSecretProviderConfigFromEnv(env);
  return new EnvSecretProvider({
    enabled: config.enabled,
    allowedEnvKeys: config.allowedEnvKeys,
    env
  });
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export type VaultClient = {
  getClientKind(): VaultClientKind;
  validateConnection(): Promise<VaultClientHealth> | VaultClientHealth;
  readKvSecret(request: VaultKvReadRequest): Promise<VaultKvReadResult> | VaultKvReadResult;
  readKvMetadata?(request: VaultKvReadRequest): Promise<VaultKvReadResult> | VaultKvReadResult;
  close?(): Promise<void> | void;
};

export class DisabledVaultClient implements VaultClient {
  private readonly config: VaultSecretProviderConfig;

  constructor(config: VaultSecretProviderConfig = createVaultSecretProviderConfigFromEnv({})) {
    this.config = config;
  }

  getClientKind(): VaultClientKind {
    return "disabled";
  }

  validateConnection(): VaultClientHealth {
    return vaultHealthFromConfig(this.config, this.getClientKind(), "disabled");
  }

  readKvSecret(request: VaultKvReadRequest): VaultKvReadResult {
    return {
      status: "unavailable",
      dataShape: request.dataShape,
      metadata: {
        clientKind: this.getClientKind(),
        reason: "vault_client_disabled",
        containsSecretMaterial: false
      },
      errorCode: "vault_client_disabled",
      sanitizedError: "vault_client_disabled"
    };
  }
}

export type MockVaultSecretRecord = {
  mount: string;
  path: string;
  namespace?: string;
  data: Record<string, string>;
  version?: number;
  status?: "found" | "missing" | "forbidden" | "unavailable";
};

export class MockVaultClient implements VaultClient {
  private readonly config: VaultSecretProviderConfig;
  private readonly records = new Map<string, MockVaultSecretRecord>();
  private readCount = 0;

  constructor(records: MockVaultSecretRecord[] = [], config: VaultSecretProviderConfig = {
    ...createVaultSecretProviderConfigFromEnv({}),
    selectedProvider: "vault",
    vaultProviderEnabled: true,
    vaultAddressConfigured: true,
    vaultTokenConfigured: true,
    liveUsageReady: true,
    configStatus: "ready",
    missingConfig: []
  }) {
    this.config = config;
    for (const record of records) {
      this.records.set(vaultRecordKey(record.mount, record.path, record.namespace), record);
    }
  }

  getClientKind(): VaultClientKind {
    return "mock";
  }

  getReadCount(): number {
    return this.readCount;
  }

  validateConnection(): VaultClientHealth {
    return vaultHealthFromConfig(this.config, this.getClientKind(), "ready");
  }

  readKvSecret(request: VaultKvReadRequest): VaultKvReadResult {
    this.readCount += 1;
    const record = this.records.get(vaultRecordKey(request.mount, request.path, request.namespace));
    if (!record || record.status === "missing") {
      return {
        status: "missing",
        dataShape: request.dataShape,
        metadata: mockVaultResultMetadata(this.getClientKind(), request)
      };
    }
    if (record.status === "forbidden") {
      return {
        status: "forbidden",
        dataShape: request.dataShape,
        metadata: mockVaultResultMetadata(this.getClientKind(), request),
        errorCode: "vault_forbidden",
        sanitizedError: "vault_forbidden"
      };
    }
    if (record.status === "unavailable") {
      return {
        status: "unavailable",
        dataShape: request.dataShape,
        metadata: mockVaultResultMetadata(this.getClientKind(), request),
        errorCode: "vault_unavailable",
        sanitizedError: "vault_unavailable"
      };
    }
    const value = request.dataShape === "full_object"
      ? JSON.stringify(record.data)
      : request.key
        ? record.data[request.key]
        : undefined;
    if (value === undefined) {
      return {
        status: "missing",
        dataShape: request.dataShape,
        version: record.version,
        metadata: mockVaultResultMetadata(this.getClientKind(), request)
      };
    }
    return {
      status: "found",
      value,
      dataShape: request.dataShape,
      version: record.version,
      metadata: mockVaultResultMetadata(this.getClientKind(), request)
    };
  }
}

export type GatedHttpVaultClientInput = {
  config: VaultSecretProviderConfig;
  address: string;
  token: string;
  fetchImpl?: typeof fetch;
};

export class GatedHttpVaultClient implements VaultClient {
  private readonly config: VaultSecretProviderConfig;
  private readonly address: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;

  constructor(input: GatedHttpVaultClientInput) {
    this.config = input.config;
    this.address = input.address.replace(/\/+$/, "");
    this.token = input.token;
    this.fetchImpl = input.fetchImpl ?? fetch;
  }

  getClientKind(): VaultClientKind {
    return "gated_http";
  }

  validateConnection(): VaultClientHealth {
    return vaultHealthFromConfig(this.config, this.getClientKind(), this.config.liveUsageReady ? "ready" : "missing_config");
  }

  async readKvSecret(request: VaultKvReadRequest): Promise<VaultKvReadResult> {
    if (!this.config.liveUsageReady) {
      return {
        status: "unavailable",
        dataShape: request.dataShape,
        metadata: gatedVaultResultMetadata(this.getClientKind(), request),
        errorCode: "vault_config_not_ready",
        sanitizedError: "vault_config_not_ready"
      };
    }
    const url = new URL(`${this.address}/v1/${encodeVaultPathSegment(request.mount)}/data/${encodeVaultPath(request.path)}`);
    if (request.version !== undefined) {
      url.searchParams.set("version", String(request.version));
    }
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          "X-Vault-Token": this.token,
          ...(request.namespace ? { "X-Vault-Namespace": request.namespace } : {})
        },
        signal: AbortSignal.timeout(request.timeoutMs ?? this.config.requestTimeoutMs)
      });
      if (response.status === 404) {
        return { status: "missing", dataShape: request.dataShape, metadata: gatedVaultResultMetadata(this.getClientKind(), request) };
      }
      if (response.status === 403) {
        return {
          status: "forbidden",
          dataShape: request.dataShape,
          metadata: gatedVaultResultMetadata(this.getClientKind(), request),
          errorCode: "vault_forbidden",
          sanitizedError: "vault_forbidden"
        };
      }
      if (!response.ok) {
        return {
          status: "error",
          dataShape: request.dataShape,
          metadata: gatedVaultResultMetadata(this.getClientKind(), request),
          errorCode: `vault_http_${response.status}`,
          sanitizedError: `vault_http_${response.status}`
        };
      }
      const body = await response.json() as { data?: { data?: Record<string, unknown>; metadata?: { version?: number } } };
      const data = body.data?.data ?? {};
      const value = request.dataShape === "full_object"
        ? JSON.stringify(data)
        : request.key
          ? data[request.key]
          : undefined;
      if (typeof value !== "string") {
        return {
          status: "missing",
          dataShape: request.dataShape,
          version: body.data?.metadata?.version,
          metadata: gatedVaultResultMetadata(this.getClientKind(), request)
        };
      }
      return {
        status: "found",
        value,
        dataShape: request.dataShape,
        version: body.data?.metadata?.version,
        metadata: gatedVaultResultMetadata(this.getClientKind(), request)
      };
    } catch (error) {
      return {
        status: "unavailable",
        dataShape: request.dataShape,
        metadata: gatedVaultResultMetadata(this.getClientKind(), request),
        errorCode: "vault_request_failed",
        sanitizedError: sanitizeVaultError(error)
      };
    }
  }
}

export class VaultSecretProvider {
  private readonly config: VaultSecretProviderConfig;
  private readonly client: VaultClient;

  constructor(input: { config?: VaultSecretProviderConfig; client?: VaultClient } = {}) {
    this.config = input.config ?? createVaultSecretProviderConfigFromEnv();
    this.client = input.client ?? createVaultClientFromEnv(process.env, this.config);
  }

  getProviderKind() {
    return "vault" as const;
  }

  getConfig(): VaultSecretProviderConfig {
    return {
      ...this.config,
      vaultAllowedPathPrefixes: [...this.config.vaultAllowedPathPrefixes],
      missingConfig: [...this.config.missingConfig]
    };
  }

  getClientKind(): VaultClientKind {
    return this.client.getClientKind();
  }

  healthCheck(): VaultClientHealth {
    const health = this.client.validateConnection();
    if (health instanceof Promise) {
      return vaultHealthFromConfig(this.config, this.client.getClientKind(), this.config.liveUsageReady ? "ready" : "missing_config");
    }
    return health;
  }

  validateSecretRef(secretRef: SecretRef): { ok: boolean; errors: string[]; metadata?: Required<Pick<VaultSecretRefMetadata, "vaultMount" | "vaultPath" | "vaultKey" | "dataShape">> & VaultSecretRefMetadata } {
    const errors: string[] = [];
    if (secretRef.provider !== "vault") errors.push("vault secret provider requires provider=vault");
    const metadata = vaultMetadataFromSecretRef(secretRef);
    if (!metadata.vaultMount) errors.push("vault SecretRef requires metadata.vaultMount");
    if (!metadata.vaultPath) errors.push("vault SecretRef requires metadata.vaultPath");
    if (!metadata.vaultKey) errors.push("vault SecretRef requires metadata.vaultKey");
    if (metadata.dataShape !== undefined && metadata.dataShape !== "single_key" && metadata.dataShape !== "full_object") {
      errors.push("vault SecretRef metadata.dataShape must be single_key or full_object");
    }
    if (metadata.vaultPath && looksLikeUnsafeVaultReference(metadata.vaultPath)) {
      errors.push("vault SecretRef path must be a backend reference, not a credential cache or env dump");
    }
    if (metadata.vaultMount && looksLikeUnsafeVaultReference(metadata.vaultMount)) {
      errors.push("vault SecretRef mount must be a backend reference, not a credential cache or env dump");
    }
    if (metadata.vaultKey && looksLikeUnsafeVaultReference(metadata.vaultKey)) {
      errors.push("vault SecretRef key must be a backend reference, not raw secret material");
    }
    return errors.length === 0
      ? {
        ok: true,
        errors,
        metadata: {
          ...metadata,
          vaultMount: metadata.vaultMount as string,
          vaultPath: metadata.vaultPath as string,
          vaultKey: metadata.vaultKey as string,
          dataShape: metadata.dataShape ?? "single_key"
        }
      }
      : { ok: false, errors };
  }

  isSecretRefPathAllowed(secretRef: SecretRef): boolean {
    const metadata = vaultMetadataFromSecretRef(secretRef);
    if (!metadata.vaultMount || !metadata.vaultPath) return false;
    return this.isPathAllowed(metadata.vaultMount, metadata.vaultPath);
  }

  isPathAllowed(mount: string, path: string): boolean {
    if (this.config.vaultAllowedPathPrefixes.length === 0) return true;
    const normalizedPath = normalizeVaultPath(path);
    const fullPath = normalizeVaultPath(`${mount}/${path}`);
    return this.config.vaultAllowedPathPrefixes
      .map(normalizeVaultPath)
      .some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`) || fullPath === prefix || fullPath.startsWith(`${prefix}/`));
  }

  resolveSecret(secretRef: SecretRef): VaultSecretProviderResolveResult {
    if (this.config.selectedProvider !== "vault") {
      return { ok: false, status: "blocked", reason: "vault_secret_backend_not_selected", metadata: this.safeStatusMetadata(secretRef) };
    }
    if (!this.config.vaultProviderEnabled) {
      return { ok: false, status: "blocked", reason: "vault_secret_provider_disabled", metadata: this.safeStatusMetadata(secretRef) };
    }
    if (!this.config.liveUsageReady && this.client.getClientKind() !== "mock") {
      return { ok: false, status: "unavailable", reason: "vault_config_missing", metadata: this.safeStatusMetadata(secretRef) };
    }
    const validation = this.validateSecretRef(secretRef);
    if (!validation.ok || !validation.metadata) {
      return { ok: false, status: "denied", reason: validation.errors[0] ?? "vault_secret_ref_invalid", metadata: this.safeStatusMetadata(secretRef) };
    }
    if (!this.isPathAllowed(validation.metadata.vaultMount, validation.metadata.vaultPath)) {
      return { ok: false, status: "denied", reason: "vault_path_not_allowlisted", metadata: this.safeStatusMetadata(secretRef) };
    }
    const read = this.client.readKvSecret({
      mount: validation.metadata.vaultMount,
      path: validation.metadata.vaultPath,
      key: validation.metadata.vaultKey,
      version: validation.metadata.vaultVersion,
      namespace: validation.metadata.vaultNamespace ?? (this.config.vaultNamespaceConfigured ? undefined : undefined),
      timeoutMs: this.config.requestTimeoutMs,
      dataShape: validation.metadata.dataShape,
      metadata: {
        secretRefId: secretRef.id,
        secretKind: secretRef.secretKind,
        containsSecretMaterial: false
      }
    });
    if (read instanceof Promise) {
      return { ok: false, status: "unavailable", reason: "vault_async_client_requires_explicit_integration_path", metadata: this.safeStatusMetadata(secretRef) };
    }
    return this.mapReadResult(secretRef, read);
  }

  async resolveSecretAsync(secretRef: SecretRef): Promise<VaultSecretProviderResolveResult> {
    if (this.config.selectedProvider !== "vault") {
      return { ok: false, status: "blocked", reason: "vault_secret_backend_not_selected", metadata: this.safeStatusMetadata(secretRef) };
    }
    if (!this.config.vaultProviderEnabled) {
      return { ok: false, status: "blocked", reason: "vault_secret_provider_disabled", metadata: this.safeStatusMetadata(secretRef) };
    }
    if (!this.config.liveUsageReady && this.client.getClientKind() !== "mock") {
      return { ok: false, status: "unavailable", reason: "vault_config_missing", metadata: this.safeStatusMetadata(secretRef) };
    }
    const validation = this.validateSecretRef(secretRef);
    if (!validation.ok || !validation.metadata) {
      return { ok: false, status: "denied", reason: validation.errors[0] ?? "vault_secret_ref_invalid", metadata: this.safeStatusMetadata(secretRef) };
    }
    if (!this.isPathAllowed(validation.metadata.vaultMount, validation.metadata.vaultPath)) {
      return { ok: false, status: "denied", reason: "vault_path_not_allowlisted", metadata: this.safeStatusMetadata(secretRef) };
    }
    const read = await this.client.readKvSecret({
      mount: validation.metadata.vaultMount,
      path: validation.metadata.vaultPath,
      key: validation.metadata.vaultKey,
      version: validation.metadata.vaultVersion,
      namespace: validation.metadata.vaultNamespace ?? (this.config.vaultNamespaceConfigured ? undefined : undefined),
      timeoutMs: this.config.requestTimeoutMs,
      dataShape: validation.metadata.dataShape,
      metadata: {
        secretRefId: secretRef.id,
        secretKind: secretRef.secretKind,
        containsSecretMaterial: false
      }
    });
    return this.mapReadResult(secretRef, read);
  }

  private mapReadResult(secretRef: SecretRef, read: VaultKvReadResult): VaultSecretProviderResolveResult {
    if (read.status === "found" && read.value) {
      return {
        ok: true,
        status: "resolved",
        value: read.value,
        metadata: {
          ...this.safeStatusMetadata(secretRef),
          vaultVersion: read.version,
          clientKind: this.client.getClientKind()
        }
      };
    }
    const status = read.status === "missing" ? "missing" : read.status === "unavailable" || read.status === "error" ? "unavailable" : "denied";
    return {
      ok: false,
      status,
      reason: read.errorCode ?? `vault_secret_${read.status}`,
      metadata: {
        ...this.safeStatusMetadata(secretRef),
        clientKind: this.client.getClientKind(),
        errorCode: read.errorCode,
        sanitizedError: read.sanitizedError
      }
    };
  }

  private safeStatusMetadata(secretRef?: SecretRef): Record<string, unknown> {
    return {
      provider: "vault",
      selectedProvider: this.config.selectedProvider,
      vaultProviderEnabled: this.config.vaultProviderEnabled,
      vaultAddressConfigured: this.config.vaultAddressConfigured,
      vaultNamespaceConfigured: this.config.vaultNamespaceConfigured,
      vaultAuthMethod: this.config.vaultAuthMethod,
      vaultTokenConfigured: this.config.vaultTokenConfigured,
      allowedPathPrefixCount: this.config.vaultAllowedPathPrefixCount,
      integrationTestsEnabled: this.config.vaultIntegrationTestsEnabled,
      clientKind: this.client.getClientKind(),
      secretRefId: secretRef?.id,
      secretKind: secretRef?.secretKind,
      vaultMountConfigured: Boolean(secretRef && vaultMetadataFromSecretRef(secretRef).vaultMount),
      vaultPathConfigured: Boolean(secretRef && vaultMetadataFromSecretRef(secretRef).vaultPath),
      vaultKeyConfigured: Boolean(secretRef && vaultMetadataFromSecretRef(secretRef).vaultKey),
      containsSecretMaterial: false
    };
  }
}

export function createVaultSecretProviderConfigFromEnv(env: Record<string, string | undefined> = process.env): VaultSecretProviderConfig {
  const selectedProvider = env.AICHESTRA_SECRET_BACKEND_PROVIDER === "vault"
    ? "vault"
    : env.AICHESTRA_SECRET_BACKEND_PROVIDER === "env"
      ? "env"
      : "mock";
  const vaultProviderEnabled = env.AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER === "true";
  const vaultAddressConfigured = Boolean(env.AICHESTRA_VAULT_ADDR);
  const vaultNamespaceConfigured = Boolean(env.AICHESTRA_VAULT_NAMESPACE);
  const vaultAuthMethod = env.AICHESTRA_VAULT_AUTH_METHOD === "approle_future" ? "approle_future" : "token";
  const vaultTokenConfigured = Boolean(env.AICHESTRA_VAULT_TOKEN);
  const vaultTokenSecretRefConfigured = Boolean(env.AICHESTRA_VAULT_TOKEN_SECRET_REF);
  const vaultKvMount = env.AICHESTRA_VAULT_KV_MOUNT || env.AICHESTRA_VAULT_SECRET_MOUNT || "secret";
  const vaultAllowedPathPrefixes = parseCsv(env.AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES);
  const requestTimeoutMs = parsePositiveInt(env.AICHESTRA_VAULT_REQUEST_TIMEOUT_MS, 2_000);
  const missingConfig: string[] = [];
  if (selectedProvider === "vault" || vaultProviderEnabled) {
    if (selectedProvider !== "vault") missingConfig.push("AICHESTRA_SECRET_BACKEND_PROVIDER=vault");
    if (!vaultProviderEnabled) missingConfig.push("AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true");
    if (!vaultAddressConfigured) missingConfig.push("AICHESTRA_VAULT_ADDR");
    if (vaultAuthMethod !== "token") missingConfig.push("AICHESTRA_VAULT_AUTH_METHOD=token");
    if (!vaultTokenConfigured && !vaultTokenSecretRefConfigured) missingConfig.push("AICHESTRA_VAULT_TOKEN or AICHESTRA_VAULT_TOKEN_SECRET_REF");
  }
  const liveUsageReady = selectedProvider === "vault" &&
    vaultProviderEnabled &&
    vaultAddressConfigured &&
    vaultAuthMethod === "token" &&
    vaultTokenConfigured;
  const configStatus = !vaultProviderEnabled && selectedProvider !== "vault"
    ? "disabled"
    : vaultAuthMethod !== "token"
      ? "blocked"
      : missingConfig.length === 0
        ? "ready"
        : "missing_config";
  return {
    selectedProvider,
    vaultProviderEnabled,
    vaultAddressConfigured,
    vaultNamespaceConfigured,
    vaultKvMount,
    vaultAuthMethod,
    vaultTokenConfigured,
    vaultTokenSecretRefConfigured,
    vaultAllowedPathPrefixes,
    vaultAllowedPathPrefixCount: vaultAllowedPathPrefixes.length,
    vaultIntegrationTestsEnabled: env.AICHESTRA_VAULT_INTEGRATION_TESTS === "true" || env.AICHESTRA_SECRET_BACKEND_INTEGRATION_TESTS === "true",
    requestTimeoutMs,
    liveUsageReady,
    configStatus,
    missingConfig,
    productionSecretBackendImplemented: false,
    envFallbackProductionAllowed: false,
    containsSecretMaterial: false
  };
}

export function createVaultClientFromEnv(env: Record<string, string | undefined> = process.env, config = createVaultSecretProviderConfigFromEnv(env)): VaultClient {
  if (!config.liveUsageReady || !env.AICHESTRA_VAULT_ADDR || !env.AICHESTRA_VAULT_TOKEN) {
    return new DisabledVaultClient(config);
  }
  return new GatedHttpVaultClient({
    config,
    address: env.AICHESTRA_VAULT_ADDR,
    token: env.AICHESTRA_VAULT_TOKEN
  });
}

export function createVaultSecretProviderFromEnv(env: Record<string, string | undefined> = process.env): VaultSecretProvider {
  const config = createVaultSecretProviderConfigFromEnv(env);
  return new VaultSecretProvider({
    config,
    client: createVaultClientFromEnv(env, config)
  });
}

export function vaultMetadataFromSecretRef(secretRef: SecretRef): VaultSecretRefMetadata {
  const metadata = secretRef.metadata ?? {};
  return {
    vaultMount: stringValue(metadata.vaultMount),
    vaultPath: stringValue(metadata.vaultPath),
    vaultKey: stringValue(metadata.vaultKey),
    vaultVersion: numberValue(metadata.vaultVersion),
    vaultNamespace: stringValue(metadata.vaultNamespace),
    vaultTransitWrapped: metadata.vaultTransitWrapped === true,
    dataShape: metadata.dataShape === "full_object" ? "full_object" : "single_key",
    description: stringValue(metadata.description)
  };
}

function vaultHealthFromConfig(config: VaultSecretProviderConfig, clientKind: VaultClientKind, status: VaultClientHealth["status"], sanitizedError?: string): VaultClientHealth {
  return {
    clientKind,
    status,
    configStatus: config.configStatus,
    vaultProviderEnabled: config.vaultProviderEnabled,
    vaultAddressConfigured: config.vaultAddressConfigured,
    vaultNamespaceConfigured: config.vaultNamespaceConfigured,
    vaultAuthMethod: config.vaultAuthMethod,
    allowedPathPrefixCount: config.vaultAllowedPathPrefixCount,
    integrationTestsEnabled: config.vaultIntegrationTestsEnabled,
    liveCallAttempted: false,
    containsSecretMaterial: false,
    sanitizedError
  };
}

function mockVaultResultMetadata(clientKind: VaultClientKind, request: VaultKvReadRequest): Record<string, unknown> {
  return {
    clientKind,
    mountConfigured: Boolean(request.mount),
    pathConfigured: Boolean(request.path),
    keyConfigured: Boolean(request.key),
    namespaceConfigured: Boolean(request.namespace),
    containsSecretMaterial: false
  };
}

function gatedVaultResultMetadata(clientKind: VaultClientKind, request: VaultKvReadRequest): Record<string, unknown> {
  return mockVaultResultMetadata(clientKind, request);
}

function vaultRecordKey(mount: string, path: string, namespace?: string): string {
  return `${namespace ?? "default"}:${normalizeVaultPath(mount)}:${normalizeVaultPath(path)}`;
}

function normalizeVaultPath(value: string): string {
  return value.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
}

function encodeVaultPath(value: string): string {
  return normalizeVaultPath(value).split("/").map(encodeURIComponent).join("/");
}

function encodeVaultPathSegment(value: string): string {
  return encodeURIComponent(normalizeVaultPath(value));
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function looksLikeUnsafeVaultReference(value: string): boolean {
  return /~[\\/]\.codex[\\/]auth\.json/i.test(value) ||
    /~[\\/]\.claude/i.test(value) ||
    /application_default_credentials\.json/i.test(value) ||
    /gcloud[\\/]application_default_credentials/i.test(value) ||
    /\bhv[bs]\.[A-Za-z0-9_-]{8,}\b/.test(value) ||
    /\b[A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*[^\s]+/i.test(value) ||
    /Bearer\s+[A-Za-z0-9._~+/=-]+/i.test(value);
}

function sanitizeVaultError(error: unknown): string {
  const sanitized = sanitizeSecurityMetadata({
    message: error instanceof Error ? error.message : String(error)
  }) as { message?: unknown };
  return typeof sanitized.message === "string" ? sanitized.message : "vault_request_failed";
}
