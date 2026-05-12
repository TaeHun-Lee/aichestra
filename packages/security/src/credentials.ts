import type { CredentialResolutionStatus, EnvSecretProviderConfig, SecretRef } from "./types.ts";

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
