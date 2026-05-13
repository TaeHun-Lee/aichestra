import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { AuthorizationService, InMemoryAuthRepository, MockAuthProvider } from "@aichestra/auth";
import { createSeededStore } from "@aichestra/db";
import { createGitHubWebhookRuntimeFromEnv, createGitProviderFromEnv } from "@aichestra/git-adapter";
import {
  InMemoryVirtualModelKeyRepository,
  LLMGatewayService,
  createLlmProviderFromEnv,
  type OpenAICompatibleHttpClient,
  type VirtualModelKey
} from "@aichestra/llm-gateway";
import { ProviderCatalogService, StaticCredentialManager, validateProviderCatalogEntry } from "@aichestra/llm-gateway";
import { PolicyService } from "@aichestra/policy";
import { EnvSecretProvider, SecurityControlService, credentialResolutionResultToDto, secretRefToDto } from "@aichestra/security";
import type { CredentialResolutionRequest, InternalCredentialResolutionResult, SecretKind, SecretRef } from "@aichestra/security";

function envWithSecrets(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    AICHESTRA_ENABLE_ENV_SECRET_PROVIDER: "true",
    AICHESTRA_ALLOWED_SECRET_ENV_KEYS: "AICHESTRA_GITHUB_TOKEN,AICHESTRA_LLM_API_KEY",
    AICHESTRA_GITHUB_TOKEN: "ghp_secretrefprovidercredential",
    AICHESTRA_LLM_API_KEY: "sk-secretref-provider-credential",
    ...overrides
  };
}

function createEnvSecretRef(service: SecurityControlService, input: { id: string; secretKind: SecretKind; envKey: string; status?: SecretRef["status"] }): SecretRef {
  return service.createSecretRef({
    id: input.id,
    name: `${input.id} reference`,
    provider: "env",
    secretKind: input.secretKind,
    envKey: input.envKey,
    scope: "scope_env_provider_credentials",
    status: input.status ?? "active",
    metadata: { fixture: "secretref_provider_credentials_v1" }
  });
}

function createAuthorizationService(policyService = new PolicyService()): AuthorizationService {
  const repository = new InMemoryAuthRepository();
  return new AuthorizationService({
    repository,
    provider: new MockAuthProvider({ repository }),
    policyService
  });
}

function resolveForGit(security: SecurityControlService) {
  return (request: { secretRefId: string; purpose: "github_api_call"; providerId: string; policyContext: Record<string, unknown> }) => {
    const resolved = security.resolveCredentialForInternalUse(request);
    return {
      ok: resolved.allowed,
      status: resolved.status,
      value: resolved.value,
      reason: resolved.blockedReason,
      credentialHandleId: resolved.credentialHandle?.id
    };
  };
}

function noSecretValue(value: unknown): boolean {
  const text = JSON.stringify(value);
  return !text.includes("ghp_secretrefprovidercredential") &&
    !text.includes("sk-secretref-provider-credential") &&
    !text.includes("webhook-secret-value") &&
    !text.includes("AICHESTRA_GITHUB_TOKEN=ghp_") &&
    !text.includes("AICHESTRA_LLM_API_KEY=sk-") &&
    !text.includes("AICHESTRA_GITHUB_WEBHOOK_SECRET=webhook-secret");
}

function remoteVirtualKey(): VirtualModelKey {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "vmk_secretref_openai_fixture",
    ownerKind: "system",
    ownerId: "system",
    displayName: "SecretRef OpenAI-compatible Fixture Key",
    allowedProviderKinds: ["openai_compatible"],
    allowedModelIds: ["openai-compatible/default"],
    perTaskBudgetUsd: 10,
    monthlyBudgetUsd: 100,
    rpmLimit: 60,
    tpmLimit: 100000,
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

function createMockHttpClient() {
  const calls: unknown[] = [];
  const client: OpenAICompatibleHttpClient = {
    async postJson(request) {
      calls.push(request);
      return {
        ok: true,
        status: 200,
        body: {
          id: "chatcmpl_secretref_fixture",
          choices: [
            {
              message: { content: "fixture completion with sk-secretref-provider-credential redacted" },
              finish_reason: "stop"
            }
          ],
          usage: { prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 }
        }
      };
    }
  };
  return { client, calls };
}

async function getJson(port: number, path: string) {
  return requestJson(port, "GET", path);
}

async function postJson(port: number, path: string, body: unknown, headers: Record<string, string> = {}) {
  return requestJson(port, "POST", path, body, headers);
}

async function patchJson(port: number, path: string, body: unknown) {
  return requestJson(port, "PATCH", path, body);
}

async function requestJson(port: number, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: unknown }> {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload), ...headers } : headers
    }, (response) => {
      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { text += chunk; });
      response.on("end", () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body: text ? JSON.parse(text) : {}
        });
      });
    });
    request.on("error", reject);
    if (payload) request.write(payload);
    request.end();
  });
}

test("SecretRef credential refs reject raw values and cache paths while DTOs stay metadata-only", () => {
  const security = new SecurityControlService({ env: envWithSecrets() });
  const ref = createEnvSecretRef(security, {
    id: "secretref_github_token_v1",
    secretKind: "github_token",
    envKey: "AICHESTRA_GITHUB_TOKEN"
  });

  const dto = secretRefToDto(ref);
  assert.equal(dto.envKey, "AICHESTRA_GITHUB_TOKEN");
  assert.equal(JSON.stringify(dto).includes("ghp_secretrefprovidercredential"), false);

  assert.throws(() => security.createSecretRef({
    id: "secretref_raw_value",
    name: "raw value",
    provider: "env",
    secretKind: "llm_api_key",
    envKey: "AICHESTRA_LLM_API_KEY",
    scope: "scope_env_provider_credentials",
    status: "active",
    metadata: { value: "sk-secretref-provider-credential" }
  }), /raw secret material/);

  assert.throws(() => security.createSecretRef({
    id: "secretref_cache_path",
    name: "~/.codex/auth.json",
    provider: "env",
    secretKind: "provider_api_key",
    envKey: "AICHESTRA_LLM_API_KEY",
    scope: "scope_env_provider_credentials",
    status: "active",
    metadata: {}
  }), /credential cache paths/);
});

test("EnvSecretProvider is disabled by default and only resolves allowlisted env refs when enabled", () => {
  const ref: SecretRef = {
    id: "secretref_env_provider_unit",
    name: "Env provider unit",
    provider: "env",
    secretKind: "llm_api_key",
    envKey: "AICHESTRA_LLM_API_KEY",
    scope: "scope_env_provider_credentials",
    status: "active",
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };
  assert.equal(new EnvSecretProvider({ env: envWithSecrets() }).resolve(ref).reason, "env_secret_provider_disabled");
  assert.equal(new EnvSecretProvider({
    enabled: true,
    allowedEnvKeys: ["AICHESTRA_LLM_API_KEY"],
    env: envWithSecrets()
  }).resolve(ref).ok, true);
  assert.equal(new EnvSecretProvider({
    enabled: true,
    allowedEnvKeys: ["AICHESTRA_GITHUB_TOKEN"],
    env: envWithSecrets()
  }).resolve(ref).reason, "env_key_not_allowlisted");
  assert.equal(new EnvSecretProvider({
    enabled: true,
    allowedEnvKeys: ["AICHESTRA_LLM_API_KEY"],
    env: envWithSecrets({ AICHESTRA_LLM_API_KEY: undefined })
  }).resolve(ref).reason, "env_secret_missing");
});

test("CredentialManager resolves env-backed SecretRefs internally without exposing values in DTO or audit", () => {
  const security = new SecurityControlService({ env: envWithSecrets() });
  createEnvSecretRef(security, {
    id: "secretref_llm_api_key_v1",
    secretKind: "llm_api_key",
    envKey: "AICHESTRA_LLM_API_KEY"
  });

  const request: CredentialResolutionRequest = {
    secretRefId: "secretref_llm_api_key_v1",
    purpose: "llm_api_call",
    providerId: "openai_compatible",
    policyContext: {
      providerKind: "openai_compatible",
      remoteLlmEnabled: true,
      remoteCompletionEnabled: true,
      credentialsConfigured: true
    }
  };
  const internal = security.resolveCredentialForInternalUse(request);
  assert.equal(internal.allowed, true);
  assert.equal(internal.status, "resolved");
  assert.equal(internal.value, "sk-secretref-provider-credential");

  const publicResult = security.resolveCredential(request);
  const dto = credentialResolutionResultToDto(publicResult);
  assert.equal(JSON.stringify(dto).includes("sk-secretref-provider-credential"), false);
  assert.equal(noSecretValue(security.listAuditEvents()), true);
  assert.equal(security.listSecretLeases({ status: "issued" }).length >= 1, true);
  assert.equal(security.listSecretAccessDecisions().some((decision) => decision.allowed), true);
});

test("CredentialManager checks Auth/RBAC and policy before reading env-backed credential values", () => {
  const guardedEnv: Record<string, string | undefined> = {
    AICHESTRA_ENABLE_ENV_SECRET_PROVIDER: "true",
    AICHESTRA_ALLOWED_SECRET_ENV_KEYS: "AICHESTRA_LLM_API_KEY"
  };
  Object.defineProperty(guardedEnv, "AICHESTRA_LLM_API_KEY", {
    get() {
      throw new Error("env_secret_was_read_before_auth_allow");
    }
  });
  const policyService = new PolicyService();
  const authorizationService = createAuthorizationService(policyService);
  const security = new SecurityControlService({ env: guardedEnv, policyService, authorizationService });
  createEnvSecretRef(security, {
    id: "secretref_auth_guarded_llm_v1",
    secretKind: "llm_api_key",
    envKey: "AICHESTRA_LLM_API_KEY"
  });
  const viewer = authorizationService.getAuthContext({ actorId: "user_demo_viewer", source: "test" });

  const denied = security.resolveCredential({
    secretRefId: "secretref_auth_guarded_llm_v1",
    purpose: "llm_api_call",
    actorId: viewer.actor.id,
    principalId: viewer.principal.id,
    authContext: viewer,
    providerId: "openai_compatible",
    policyContext: {
      providerKind: "openai_compatible",
      remoteLlmEnabled: true,
      remoteCompletionEnabled: true,
      credentialsConfigured: true
    }
  });

  assert.equal(denied.allowed, false);
  assert.equal(denied.status, "denied");
  assert.match(denied.blockedReason ?? "", /authorization_denied/);
  assert.equal(Boolean(denied.authorizationDecisionId), true);
  assert.equal(security.listAuditEvents({ eventType: "credential_resolution_authorization_denied" }).length, 1);
  assert.equal(authorizationService.listAuditEvents({ eventType: "authorization_denied" }).some((event) => event.action === "provider.credential.resolve"), true);
  assert.equal(noSecretValue({ denied, securityAudit: security.listAuditEvents(), authAudit: authorizationService.listAuditEvents() }), true);
});

test("CredentialManager blocks disabled, revoked, missing, non-allowlisted, and policy-denied credential refs", () => {
  const security = new SecurityControlService({ env: envWithSecrets({ AICHESTRA_ALLOWED_SECRET_ENV_KEYS: "AICHESTRA_GITHUB_TOKEN" }) });
  createEnvSecretRef(security, { id: "secretref_disabled_v1", secretKind: "github_token", envKey: "AICHESTRA_GITHUB_TOKEN", status: "disabled" });
  createEnvSecretRef(security, { id: "secretref_revoked_v1", secretKind: "github_token", envKey: "AICHESTRA_GITHUB_TOKEN", status: "revoked" });
  createEnvSecretRef(security, { id: "secretref_non_allowlisted_v1", secretKind: "llm_api_key", envKey: "AICHESTRA_LLM_API_KEY" });

  const base = {
    purpose: "github_api_call" as const,
    providerId: "github",
    policyContext: { providerKind: "github", credentialsConfigured: true }
  };
  assert.equal(security.resolveCredential({ ...base, secretRefId: "secretref_disabled_v1" }).blockedReason, "secret_ref_disabled");
  assert.equal(security.resolveCredential({ ...base, secretRefId: "secretref_revoked_v1" }).blockedReason, "secret_ref_revoked");
  assert.equal(security.resolveCredential({ ...base, secretRefId: "secretref_missing_v1" }).blockedReason, "secret_ref_missing");
  assert.equal(security.resolveCredential({
    secretRefId: "secretref_non_allowlisted_v1",
    purpose: "llm_api_call",
    providerId: "openai_compatible",
    policyContext: { providerKind: "openai_compatible", remoteLlmEnabled: true, remoteCompletionEnabled: true, credentialsConfigured: true }
  }).blockedReason, "env_key_not_allowlisted");

  const guardedEnv: Record<string, string | undefined> = {
    AICHESTRA_ENABLE_ENV_SECRET_PROVIDER: "true",
    AICHESTRA_ALLOWED_SECRET_ENV_KEYS: "CUSTOM_SECRET"
  };
  Object.defineProperty(guardedEnv, "CUSTOM_SECRET", {
    get() {
      throw new Error("env_secret_was_read_before_policy_allow");
    }
  });
  const policyDenied = new SecurityControlService({ env: guardedEnv });
  createEnvSecretRef(policyDenied, { id: "secretref_custom_v1", secretKind: "provider_api_key", envKey: "CUSTOM_SECRET" });
  const denied = policyDenied.resolveCredential({
    secretRefId: "secretref_custom_v1",
    purpose: "provider_api_call",
    providerId: "custom",
    policyContext: { providerKind: "custom", credentialsConfigured: true }
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.status, "denied");
});

test("Real Git Adapter v1 can resolve GitHub credentials through SecretRef without exposing token", () => {
  const env = envWithSecrets({
    AICHESTRA_GIT_PROVIDER: "github",
    AICHESTRA_ENABLE_REMOTE_GIT: "true",
    AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE: "true",
    AICHESTRA_ALLOW_REMOTE_PR_CREATE: "true",
    AICHESTRA_GITHUB_OWNER: "aichestra",
    AICHESTRA_GITHUB_REPO: "demo-backend",
    AICHESTRA_GITHUB_ALLOWED_REPOS: "aichestra/demo-backend",
    AICHESTRA_GITHUB_TOKEN_SECRET_REF: "secretref_github_v1"
  });
  const security = new SecurityControlService({ env });
  createEnvSecretRef(security, { id: "secretref_github_v1", secretKind: "github_token", envKey: "AICHESTRA_GITHUB_TOKEN" });

  const runtime = createGitProviderFromEnv(env, { credentialResolver: resolveForGit(security) });
  assert.equal(runtime.config.providerKind, "github");
  assert.equal(runtime.config.githubCredentialSource, "secret_ref");
  assert.equal(runtime.config.githubCredentialStatus, "resolved");
  assert.equal(runtime.config.githubConfigured, true);
  assert.equal(noSecretValue(runtime.config), true);
  assert.equal(noSecretValue(security.listAuditEvents()), true);

  const missing = createGitProviderFromEnv({ ...env, AICHESTRA_GITHUB_TOKEN_SECRET_REF: "secretref_missing_git_v1" }, { credentialResolver: resolveForGit(security) });
  assert.equal(missing.config.githubCredentialStatus, "missing");
  assert.equal(missing.config.githubCredentialReason, "secret_ref_missing");

  security.updateSecretRefStatus("secretref_github_v1", "revoked");
  const revoked = createGitProviderFromEnv(env, { credentialResolver: resolveForGit(security) });
  assert.equal(revoked.config.githubCredentialStatus, "denied");
  assert.equal(revoked.config.githubCredentialReason, "secret_ref_revoked");
});

test("Real Git Adapter v2 can resolve GitHub webhook secrets through SecretRef without exposing value", () => {
  const env = envWithSecrets({
    AICHESTRA_ALLOWED_SECRET_ENV_KEYS: "AICHESTRA_GITHUB_WEBHOOK_SECRET",
    AICHESTRA_GITHUB_WEBHOOK_SECRET: "webhook-secret-value",
    AICHESTRA_ENABLE_GITHUB_WEBHOOKS: "true",
    AICHESTRA_GITHUB_WEBHOOK_SECRET_REF: "secretref_github_webhook_v1",
    AICHESTRA_GITHUB_WEBHOOK_ALLOWED_REPOS: "aichestra/demo-backend"
  });
  const security = new SecurityControlService({ env });
  createEnvSecretRef(security, {
    id: "secretref_github_webhook_v1",
    secretKind: "github_webhook_secret",
    envKey: "AICHESTRA_GITHUB_WEBHOOK_SECRET"
  });

  const runtime = createGitHubWebhookRuntimeFromEnv(env, {
    secretResolver: (request) => {
      const resolved = security.resolveCredentialForInternalUse(request);
      return {
        ok: resolved.allowed,
        status: resolved.status,
        value: resolved.value,
        reason: resolved.blockedReason,
        credentialHandleId: resolved.credentialHandle?.id
      };
    }
  });
  assert.equal(runtime.config.webhookSecretSource, "secret_ref");
  assert.equal(runtime.config.webhookSecretStatus, "resolved");
  assert.equal(runtime.verifier.getVerifierKind(), "hmac-sha256");
  assert.equal(noSecretValue(runtime.config), true);
  assert.equal(noSecretValue(security.listAuditEvents()), true);

  const missing = createGitHubWebhookRuntimeFromEnv({ ...env, AICHESTRA_GITHUB_WEBHOOK_SECRET_REF: "secretref_missing_webhook_v1" }, {
    secretResolver: (request) => {
      const resolved = security.resolveCredentialForInternalUse(request);
      return {
        ok: resolved.allowed,
        status: resolved.status,
        value: resolved.value,
        reason: resolved.blockedReason,
        credentialHandleId: resolved.credentialHandle?.id
      };
    }
  });
  assert.equal(missing.config.webhookSecretStatus, "missing");
  assert.equal(missing.config.webhookSecretReason, "secret_ref_missing");

  security.updateSecretRefStatus("secretref_github_webhook_v1", "revoked");
  const revoked = createGitHubWebhookRuntimeFromEnv(env, {
    secretResolver: (request) => {
      const resolved = security.resolveCredentialForInternalUse(request);
      return {
        ok: resolved.allowed,
        status: resolved.status,
        value: resolved.value,
        reason: resolved.blockedReason,
        credentialHandleId: resolved.credentialHandle?.id
      };
    }
  });
  assert.equal(revoked.config.webhookSecretStatus, "denied");
  assert.equal(revoked.config.webhookSecretReason, "secret_ref_revoked");
});

test("LLM Gateway v1 resolves OpenAI-compatible API key through SecretRef and keeps usage/audit redacted", async () => {
  const env = envWithSecrets({
    AICHESTRA_LLM_PROVIDER: "openai_compatible",
    AICHESTRA_ENABLE_REMOTE_LLM: "true",
    AICHESTRA_ALLOW_REMOTE_LLM_COMPLETION: "true",
    AICHESTRA_LLM_BASE_URL: "https://llm.example/v1",
    AICHESTRA_LLM_ALLOWED_MODELS: "gpt-test",
    AICHESTRA_LLM_DEFAULT_MODEL: "gpt-test",
    AICHESTRA_LLM_API_KEY_SECRET_REF: "secretref_llm_v1"
  });
  const security = new SecurityControlService({ env });
  createEnvSecretRef(security, { id: "secretref_llm_v1", secretKind: "llm_api_key", envKey: "AICHESTRA_LLM_API_KEY" });
  const { client, calls } = createMockHttpClient();
  const runtime = createLlmProviderFromEnv(env, {
    credentialResolver: (request) => security.resolveCredentialForInternalUse(request),
    httpClient: client
  });
  const store = createSeededStore();
  const task = store.createTask({ title: "SecretRef LLM", repoId: "repo_demo_backend", baseBranch: "main" });
  const taskRun = store.createTaskRun({ taskId: task.id, attempt: 1, status: "running", agent: "codex", model: "openai-compatible/default" });
  const service = new LLMGatewayService({
    provider: runtime.provider,
    config: runtime.config,
    virtualKeyRepository: new InMemoryVirtualModelKeyRepository([remoteVirtualKey()]),
    usageRepository: store
  });

  const completion = await service.routeCompletion({
    taskId: task.id,
    taskRunId: taskRun.id,
    modelRef: "openai-compatible/default",
    virtualKeyId: "vmk_secretref_openai_fixture",
    providerId: "openai_compatible",
    prompt: "hello",
    budgetLimitUsd: 1
  });

  assert.equal(runtime.config.credentialSource, "secret_ref");
  assert.equal(runtime.config.credentialStatus, "resolved");
  assert.equal(completion.ok, true, completion.reason);
  assert.equal(calls.length, 1);
  assert.equal(completion.usageEvent?.taskId, task.id);
  assert.equal(completion.usageEvent?.taskRunId, taskRun.id);
  assert.equal(noSecretValue(completion), true);
  assert.equal(noSecretValue(service.listAuditEvents()), true);
  assert.equal(noSecretValue(security.listAuditEvents()), true);

  const missing = createLlmProviderFromEnv({ ...env, AICHESTRA_LLM_API_KEY_SECRET_REF: "secretref_missing_llm_v1" }, {
    credentialResolver: (request) => security.resolveCredentialForInternalUse(request),
    httpClient: client
  });
  assert.equal(missing.config.credentialStatus, "missing");
  assert.equal(missing.config.credentialReason, "secret_ref_missing");

  security.updateSecretRefStatus("secretref_llm_v1", "revoked");
  const revoked = createLlmProviderFromEnv(env, {
    credentialResolver: (request) => security.resolveCredentialForInternalUse(request),
    httpClient: client
  });
  assert.equal(revoked.config.credentialStatus, "denied");
  assert.equal(revoked.config.credentialReason, "secret_ref_revoked");
});

test("Enterprise Provider Abstraction accepts api_key SecretRef while local_cli remains never-read-tokens", () => {
  const catalog = new ProviderCatalogService();
  const cloudValidation = validateProviderCatalogEntry({
    id: "openai-secretref-provider",
    displayName: "OpenAI SecretRef Provider",
    vendor: "openai",
    kind: "cloud_api",
    auth: { type: "api_key", secretRef: "secretref_llm_v1" },
    supportedModels: ["openai-compatible/default"],
    billingMode: "aichestra_owned",
    capabilities: ["completion"],
    defaultEnabled: true,
    status: "active",
    policyNotes: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  });
  assert.equal(cloudValidation.ok, true);

  const credentials = new StaticCredentialManager({ catalog });
  assert.equal(credentials.getCredentialReference("anthropic-api-key").credentialRef?.kind, "env");
  assert.equal(credentials.getCredentialReference("claude-code-local").credentialRef?.kind, "none");
  assert.equal(credentials.validateCredentialAccess("claude-code-local", {
    operation: "credential.cache.read",
    requestedPath: "~/.claude/credentials.json"
  }).reason, "credential_cache_access_denied");
});

test("Security credential API, health, and dashboard expose status only and never secret values", async () => {
  const previousEnv = {
    AICHESTRA_ENABLE_ENV_SECRET_PROVIDER: process.env.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER,
    AICHESTRA_ALLOWED_SECRET_ENV_KEYS: process.env.AICHESTRA_ALLOWED_SECRET_ENV_KEYS,
    AICHESTRA_LLM_API_KEY: process.env.AICHESTRA_LLM_API_KEY
  };
  process.env.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER = "true";
  process.env.AICHESTRA_ALLOWED_SECRET_ENV_KEYS = "AICHESTRA_LLM_API_KEY";
  process.env.AICHESTRA_LLM_API_KEY = "sk-secretref-provider-credential";
  const server = createApiServer();
  try {
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;

    const create = await postJson(port, "/security/credentials/refs", {
      id: "secretref_api_llm_v1",
      name: "API LLM key ref",
      provider: "env",
      secretKind: "llm_api_key",
      envKey: "AICHESTRA_LLM_API_KEY",
      scope: "scope_env_provider_credentials",
      metadata: { source: "api_test" }
    });
    assert.equal(create.statusCode, 201);

    const raw = await postJson(port, "/security/credentials/refs", {
      id: "secretref_raw_api_v1",
      name: "raw",
      provider: "env",
      secretKind: "llm_api_key",
      envKey: "AICHESTRA_LLM_API_KEY",
      value: "sk-secretref-provider-credential"
    });
    assert.equal(raw.statusCode, 400);

    const check = await postJson(port, "/security/credentials/resolve/check", {
      secretRefId: "secretref_api_llm_v1",
      purpose: "llm_api_call",
      providerId: "openai_compatible",
      policyContext: {
        providerKind: "openai_compatible",
        remoteLlmEnabled: true,
        remoteCompletionEnabled: true,
        credentialsConfigured: true
      }
    });
    assert.equal(check.statusCode, 200);
    assert.equal(noSecretValue(check.body), true);
    const viewerDenied = await postJson(port, "/security/credentials/resolve/check", {
      secretRefId: "secretref_api_llm_v1",
      purpose: "llm_api_call",
      providerId: "openai_compatible",
      policyContext: {
        providerKind: "openai_compatible",
        remoteLlmEnabled: true,
        remoteCompletionEnabled: true,
        credentialsConfigured: true
      }
    }, { "x-aichestra-actor-id": "user_demo_viewer" });
    assert.equal(viewerDenied.statusCode, 200);
    assert.equal((viewerDenied.body as { result: { allowed: boolean } }).result.allowed, false);
    assert.match((viewerDenied.body as { result: { blockedReason: string } }).result.blockedReason, /authorization_denied/);
    assert.equal(noSecretValue(viewerDenied.body), true);

    const status = await patchJson(port, "/security/credentials/refs/secretref_api_llm_v1/status", { status: "disabled" });
    assert.equal(status.statusCode, 200);
    const disabled = await postJson(port, "/security/credentials/resolve/check", {
      secretRefId: "secretref_api_llm_v1",
      purpose: "llm_api_call",
      providerId: "openai_compatible",
      policyContext: { providerKind: "openai_compatible", remoteLlmEnabled: true, remoteCompletionEnabled: true, credentialsConfigured: true }
    });
    assert.equal((disabled.body as { result: { blockedReason: string } }).result.blockedReason, "secret_ref_disabled");

    const refs = await getJson(port, "/security/credentials/refs");
    const audit = await getJson(port, "/security/credentials/audit");
    const health = await getJson(port, "/health");
    const dashboard = await getJson(port, "/dashboard/security");
    assert.equal(refs.statusCode, 200);
    assert.equal(audit.statusCode, 200);
    assert.equal(health.statusCode, 200);
    assert.equal(dashboard.statusCode, 200);
    assert.equal(noSecretValue(refs.body), true);
    assert.equal(noSecretValue(audit.body), true);
    assert.equal(noSecretValue(health.body), true);
    assert.equal(noSecretValue(dashboard.body), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (previousEnv.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER === undefined) delete process.env.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER;
    else process.env.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER = previousEnv.AICHESTRA_ENABLE_ENV_SECRET_PROVIDER;
    if (previousEnv.AICHESTRA_ALLOWED_SECRET_ENV_KEYS === undefined) delete process.env.AICHESTRA_ALLOWED_SECRET_ENV_KEYS;
    else process.env.AICHESTRA_ALLOWED_SECRET_ENV_KEYS = previousEnv.AICHESTRA_ALLOWED_SECRET_ENV_KEYS;
    if (previousEnv.AICHESTRA_LLM_API_KEY === undefined) delete process.env.AICHESTRA_LLM_API_KEY;
    else process.env.AICHESTRA_LLM_API_KEY = previousEnv.AICHESTRA_LLM_API_KEY;
  }
});
