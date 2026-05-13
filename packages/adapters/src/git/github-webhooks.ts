import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createId } from "@aichestra/core";
import type { GitWebhookVerificationResult } from "@aichestra/core";

export const supportedGitHubWebhookEvents = [
  "ping",
  "pull_request",
  "pull_request_review",
  "check_suite",
  "check_run",
  "status",
  "push"
] as const;

export type GitHubWebhookRuntimeConfig = {
  webhooksEnabled: boolean;
  webhookSecretConfigured: boolean;
  webhookSecretRef?: string;
  webhookSecretSource: "none" | "legacy_env" | "secret_ref";
  webhookSecretStatus: "resolved" | "blocked" | "missing" | "denied" | "unavailable";
  webhookSecretReason?: string;
  webhookAllowedRepos: string[];
  webhookAllowedRepoCount: number;
  webhookIntegrationTestsEnabled: boolean;
  webhookAcceptUnverified: boolean;
  supportedWebhookEvents: string[];
  envSecretProviderEnabled: boolean;
  allowedSecretEnvKeyCount: number;
};

export type GitHubWebhookSecretResolutionRequest = {
  secretRefId: string;
  purpose: "github_webhook_verification";
  providerId: string;
  policyContext: Record<string, unknown>;
};

export type GitHubWebhookSecretResolution = {
  ok: boolean;
  status: "resolved" | "blocked" | "missing" | "denied" | "unavailable";
  value?: string;
  reason?: string;
  credentialHandleId?: string;
};

export type GitHubWebhookFactoryOptions = {
  secretResolver?: (request: GitHubWebhookSecretResolutionRequest) => GitHubWebhookSecretResolution;
  resolvedSecretValue?: string;
};

export type GitHubWebhookVerificationRequest = {
  deliveryId: string;
  signatureHeader?: string;
  rawBody: Buffer | string;
};

export type GitHubWebhookVerifier = {
  getVerifierKind(): "noop" | "mock" | "hmac-sha256";
  verify(request: GitHubWebhookVerificationRequest): GitWebhookVerificationResult;
};

function flag(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function csv(value: string | undefined): string[] {
  return typeof value === "string"
    ? value.split(",").map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function verificationResult(
  deliveryId: string,
  verified: boolean,
  reason: string,
  algorithm: GitWebhookVerificationResult["algorithm"]
): GitWebhookVerificationResult {
  return {
    id: createId("gitverify"),
    deliveryId,
    verified,
    reason,
    algorithm,
    createdAt: new Date()
  };
}

export function hashWebhookPayload(rawBody: Buffer | string): string {
  return `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;
}

export function createGitHubWebhookConfigFromEnv(env: Record<string, string | undefined> = process.env): GitHubWebhookRuntimeConfig {
  const secretRef = env.AICHESTRA_GITHUB_WEBHOOK_SECRET_REF?.trim() || undefined;
  const legacySecretConfigured = Boolean(env.AICHESTRA_GITHUB_WEBHOOK_SECRET);
  const allowedRepos = csv(env.AICHESTRA_GITHUB_WEBHOOK_ALLOWED_REPOS);
  return {
    webhooksEnabled: flag(env.AICHESTRA_ENABLE_GITHUB_WEBHOOKS),
    webhookSecretConfigured: Boolean(secretRef || legacySecretConfigured),
    webhookSecretRef: secretRef,
    webhookSecretSource: secretRef ? "secret_ref" : legacySecretConfigured ? "legacy_env" : "none",
    webhookSecretStatus: secretRef || legacySecretConfigured ? "resolved" : "missing",
    webhookSecretReason: secretRef ? undefined : legacySecretConfigured ? "legacy_env_webhook_secret_configured" : "github_webhook_secret_missing",
    webhookAllowedRepos: allowedRepos,
    webhookAllowedRepoCount: allowedRepos.length,
    webhookIntegrationTestsEnabled: flag(env.AICHESTRA_GITHUB_WEBHOOK_INTEGRATION_TESTS),
    webhookAcceptUnverified: flag(env.AICHESTRA_GITHUB_WEBHOOK_ACCEPT_UNVERIFIED),
    supportedWebhookEvents: [...supportedGitHubWebhookEvents],
    envSecretProviderEnabled: flag(env.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER),
    allowedSecretEnvKeyCount: csv(env.AICHESTRA_ALLOWED_SECRET_ENV_KEYS).length
  };
}

export function createGitHubWebhookRuntimeFromEnv(
  env: Record<string, string | undefined> = process.env,
  options: GitHubWebhookFactoryOptions = {}
): { config: GitHubWebhookRuntimeConfig; verifier: GitHubWebhookVerifier } {
  const baseConfig = createGitHubWebhookConfigFromEnv(env);
  const secret = resolveGitHubWebhookSecret(baseConfig, env, options);
  const config = {
    ...baseConfig,
    webhookSecretConfigured: secret.ok,
    webhookSecretStatus: secret.status,
    webhookSecretReason: secret.reason,
    webhookSecretSource: baseConfig.webhookSecretRef ? "secret_ref" as const : secret.ok ? "legacy_env" as const : "none" as const
  };
  return {
    config,
    verifier: baseConfig.webhooksEnabled && secret.ok && secret.value
      ? new HmacGitHubWebhookVerifier({ enabled: true, secret: secret.value })
      : new NoopGitHubWebhookVerifier(baseConfig.webhooksEnabled ? secret.reason ?? "github_webhook_secret_missing" : "github_webhooks_disabled")
  };
}

function resolveGitHubWebhookSecret(
  config: GitHubWebhookRuntimeConfig,
  env: Record<string, string | undefined>,
  options: GitHubWebhookFactoryOptions
): GitHubWebhookSecretResolution {
  if (options.resolvedSecretValue) {
    return { ok: true, status: "resolved", value: options.resolvedSecretValue, reason: "resolved_secret_value" };
  }
  if (config.webhookSecretRef) {
    if (!options.secretResolver) {
      return { ok: false, status: "blocked", reason: "credential_resolver_unavailable" };
    }
    return options.secretResolver({
      secretRefId: config.webhookSecretRef,
      purpose: "github_webhook_verification",
      providerId: "github",
      policyContext: {
        providerKind: "github",
        githubWebhooksEnabled: config.webhooksEnabled,
        webhookSecretRefConfigured: true,
        repoAllowlisted: config.webhookAllowedRepos.length > 0,
        envSecretProviderEnabled: config.envSecretProviderEnabled
      }
    });
  }
  const secret = env.AICHESTRA_GITHUB_WEBHOOK_SECRET;
  if (secret) {
    return { ok: true, status: "resolved", value: secret, reason: "legacy_env_webhook_secret_configured" };
  }
  return { ok: false, status: "missing", reason: "github_webhook_secret_missing" };
}

export class NoopGitHubWebhookVerifier implements GitHubWebhookVerifier {
  private readonly reason: string;

  constructor(reason = "github_webhooks_disabled") {
    this.reason = reason;
  }

  getVerifierKind(): "noop" {
    return "noop";
  }

  verify(request: GitHubWebhookVerificationRequest): GitWebhookVerificationResult {
    return verificationResult(request.deliveryId, false, this.reason, "none");
  }
}

export type MockGitHubWebhookVerifierOptions = {
  validSignatures?: string[];
  validDeliveryIds?: string[];
};

export class MockGitHubWebhookVerifier implements GitHubWebhookVerifier {
  private readonly validSignatures: Set<string>;
  private readonly validDeliveryIds: Set<string>;

  constructor(options: MockGitHubWebhookVerifierOptions = {}) {
    this.validSignatures = new Set(options.validSignatures ?? ["mock-valid", "sha256=mock-valid"]);
    this.validDeliveryIds = new Set(options.validDeliveryIds ?? []);
  }

  getVerifierKind(): "mock" {
    return "mock";
  }

  verify(request: GitHubWebhookVerificationRequest): GitWebhookVerificationResult {
    const signatureValid = request.signatureHeader !== undefined && this.validSignatures.has(request.signatureHeader);
    const deliveryValid = this.validDeliveryIds.size === 0 || this.validDeliveryIds.has(request.deliveryId);
    const verified = signatureValid && deliveryValid;
    return verificationResult(request.deliveryId, verified, verified ? "signature_verified" : "signature_rejected", "mock");
  }
}

export type HmacGitHubWebhookVerifierOptions = {
  enabled: boolean;
  secret?: string;
};

export class HmacGitHubWebhookVerifier implements GitHubWebhookVerifier {
  private readonly enabled: boolean;
  private readonly secret?: string;

  constructor(options: HmacGitHubWebhookVerifierOptions) {
    this.enabled = options.enabled;
    this.secret = options.secret;
  }

  getVerifierKind(): "hmac-sha256" {
    return "hmac-sha256";
  }

  verify(request: GitHubWebhookVerificationRequest): GitWebhookVerificationResult {
    if (!this.enabled) {
      return verificationResult(request.deliveryId, false, "github_webhooks_disabled", "hmac-sha256");
    }
    if (!this.secret) {
      return verificationResult(request.deliveryId, false, "github_webhook_secret_missing", "hmac-sha256");
    }
    const signature = request.signatureHeader?.trim();
    if (!signature) {
      return verificationResult(request.deliveryId, false, "signature_missing", "hmac-sha256");
    }
    if (!signature.startsWith("sha256=")) {
      return verificationResult(request.deliveryId, false, "unsupported_signature_algorithm", "hmac-sha256");
    }
    const expected = `sha256=${createHmac("sha256", this.secret).update(request.rawBody).digest("hex")}`;
    const verified = constantTimeEqual(signature, expected);
    return verificationResult(request.deliveryId, verified, verified ? "signature_verified" : "signature_mismatch", "hmac-sha256");
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
