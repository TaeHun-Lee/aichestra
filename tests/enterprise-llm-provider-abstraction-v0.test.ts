import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  CloudApiProviderAdapter,
  CloudIamProviderAdapter,
  LocalCliProviderAdapter,
  MockTokenResolver,
  OpenAICompatibleLLMProvider,
  ProviderAbstractionService,
  ProviderCatalogService,
  PtyInteractiveFallbackProviderAdapter,
  StaticCredentialManager,
  WorkloadIdentityProviderAdapter,
  createDefaultLlmGatewayService,
  parseProviderOutput,
  redactSecretText,
  seedLlmModels,
  seedProviderCatalogEntries,
  validateLocalCliProviderConfig,
  validateProviderCatalogEntry
} from "@aichestra/llm-gateway";
import { PolicyService, createPolicyContext, createPolicyResource, createPolicySubject } from "@aichestra/policy";

function getJson(port: number, requestPath: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: "127.0.0.1", port, path: requestPath }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

function postJson(port: number, requestPath: string, body: Record<string, unknown> = {}): Promise<{ statusCode: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(body);
    const request = http.request({
      host: "127.0.0.1",
      port,
      path: requestPath,
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(serialized)
      }
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.end(serialized);
  });
}

test("ProviderAuth validation rejects unsafe credential and local CLI configurations", () => {
  const providers = seedProviderCatalogEntries();
  const localCli = providers.find((provider) => provider.id === "claude-code-local");
  const apiKey = providers.find((provider) => provider.id === "openai-api-key");
  assert.ok(localCli);
  assert.ok(apiKey);

  assert.equal(validateProviderCatalogEntry(localCli).ok, true);
  assert.equal(validateProviderCatalogEntry(apiKey).ok, true);

  const invalidLocalCli = validateProviderCatalogEntry({
    ...localCli,
    auth: { type: "api_key", envKey: "ANTHROPIC_API_KEY" }
  });
  const sharedSession = validateProviderCatalogEntry({
    ...localCli,
    auth: { type: "external_cli_session", credentialAccess: "never_read_tokens", sharedAcrossUsers: true }
  });
  const credentialPath = validateProviderCatalogEntry({
    ...apiKey,
    auth: { type: "api_key", secretRef: "~/.codex/auth.json" }
  });
  const rawToken = validateProviderCatalogEntry({
    ...apiKey,
    auth: { type: "api_key", secretRef: "sk-this-is-a-raw-token-value" }
  });

  assert.equal(invalidLocalCli.ok, false);
  assert.equal(sharedSession.ok, false);
  assert.equal(credentialPath.ok, false);
  assert.equal(rawToken.ok, false);
});

test("provider catalog lists disabled skeleton providers with billing and Local Agent metadata", () => {
  const service = new ProviderAbstractionService();
  const providers = service.listProviders();
  const ids = providers.map((provider) => provider.id);
  const localCli = providers.find((provider) => provider.id === "codex-cli-local");

  assert.deepEqual(ids.includes("anthropic-api-key"), true);
  assert.deepEqual(ids.includes("anthropic-wif"), true);
  assert.deepEqual(ids.includes("claude-code-local"), true);
  assert.deepEqual(ids.includes("openai-api-key"), true);
  assert.deepEqual(ids.includes("codex-cli-local"), true);
  assert.deepEqual(ids.includes("gemini-api-key"), true);
  assert.deepEqual(ids.includes("gemini-cli-local"), true);
  assert.deepEqual(ids.includes("vertex-gemini-cloud"), true);
  assert.deepEqual(ids.includes("bedrock-anthropic-cloud"), true);
  assert.deepEqual(ids.includes("azure-foundry-cloud"), true);
  assert.equal(providers.some((provider) => provider.defaultEnabled), false);
  assert.equal(localCli?.billingMode, "local_user_session");
  assert.equal(localCli?.metadata.localAgentRequired, true);
});

test("credential manager and token resolver never read provider credential caches or return raw tokens", () => {
  const catalog = new ProviderCatalogService();
  const credentialManager = new StaticCredentialManager({ catalog });
  const tokenResolver = new MockTokenResolver(catalog);

  const localCliCredential = credentialManager.getCredentialReference("claude-code-local");
  const apiKeyReference = credentialManager.getCredentialReference("anthropic-api-key");
  const deniedCacheRead = credentialManager.validateCredentialAccess("claude-code-local", {
    actorId: "user_cli",
    requestedPath: "~/.claude/credentials.json",
    operation: "credential.cache.read"
  });
  const localCliEnv = tokenResolver.getSafeEnvironment("claude-code-local");
  const headers = tokenResolver.getAuthHeaders("claude-code-local");

  assert.equal(localCliCredential.ok, true);
  assert.equal(localCliCredential.credentialRef?.kind, "none");
  assert.equal(apiKeyReference.ok, true);
  assert.equal(apiKeyReference.credentialRef?.kind, "env");
  assert.equal(deniedCacheRead.ok, false);
  assert.equal(deniedCacheRead.reason, "credential_cache_access_denied");
  assert.deepEqual(localCliEnv.env, {});
  assert.deepEqual(headers.headers, {});
  assert.equal(JSON.stringify([localCliCredential, apiKeyReference, localCliEnv, headers]).includes("sk-"), false);
});

test("provider adapters are blocked or unavailable by default without external calls", async () => {
  const providers = seedProviderCatalogEntries();
  const cloud = providers.find((provider) => provider.id === "anthropic-api-key");
  const wif = providers.find((provider) => provider.id === "anthropic-wif");
  const iam = providers.find((provider) => provider.id === "bedrock-anthropic-cloud");
  const local = providers.find((provider) => provider.id === "claude-code-local");
  assert.ok(cloud);
  assert.ok(wif);
  assert.ok(iam);
  assert.ok(local);

  const cloudResult = await new CloudApiProviderAdapter(cloud).invoke();
  const wifResult = await new WorkloadIdentityProviderAdapter(wif).invoke();
  const iamResult = await new CloudIamProviderAdapter(iam).invoke();
  const localResult = await new LocalCliProviderAdapter(local).invoke({
    id: "provider_request_local",
    providerId: local.id,
    prompt: "blocked"
  });
  const ptyProvider = {
    ...local,
    id: "pty-provider",
    kind: "pty_interactive_fallback" as const
  };
  const ptyResult = await new PtyInteractiveFallbackProviderAdapter(ptyProvider).invoke();

  assert.equal(cloudResult.status, "blocked");
  assert.equal(cloudResult.error?.code, "provider_calls_disabled");
  assert.equal(wifResult.status, "blocked");
  assert.equal(iamResult.status, "blocked");
  assert.equal(localResult.status, "unavailable");
  assert.equal(localResult.error?.code, "local_agent_required");
  assert.equal(ptyResult.status, "blocked");
  assert.equal(ptyResult.error?.code, "disabled_by_policy");
});

test("provider output parsers normalize raw/json/jsonl/ndjson and redact sensitive output", () => {
  const raw = parseProviderOutput({ mode: "raw", stdout: "hello Bearer token123", stderr: "progress", exitCode: 0 });
  const json = parseProviderOutput({ mode: "json", stdout: "{\"message\":\"ok\"}", exitCode: 0 });
  const malformed = parseProviderOutput({ mode: "json", stdout: "{bad", exitCode: 0 });
  const jsonl = parseProviderOutput({ mode: "jsonl", stdout: "{\"type\":\"token\"}\n{\"type\":\"final\"}", stderr: "progress only", exitCode: 0 });
  const failedExit = parseProviderOutput({ mode: "ndjson", stdout: "{\"type\":\"final\"}", exitCode: 2 });
  const redacted = redactSecretText("OPENAI_API_KEY=sk-secret ~/.codex/auth.json ~/.claude/key application_default_credentials.json");

  assert.equal(raw.ok, true);
  assert.equal(raw.redactionApplied, true);
  assert.equal(raw.stdoutPreview.includes("token123"), false);
  assert.equal(json.ok, true);
  assert.equal(json.output, "{\"message\":\"ok\"}");
  assert.equal(malformed.ok, false);
  assert.equal(jsonl.ok, true);
  assert.equal(jsonl.normalizedEvents.length, 3);
  assert.equal(failedExit.ok, false);
  assert.equal(redacted.includes("sk-secret"), false);
  assert.equal(redacted.includes("auth.json"), false);
  assert.equal(redacted.includes(".claude"), false);
  assert.equal(redacted.includes("application_default_credentials"), false);
});

test("local CLI config and Local Agent boundary fail closed", async () => {
  const service = new ProviderAbstractionService();
  const template = service.listLocalCliTemplates().find((item) => item.id === "codex-cli-jsonl");
  assert.ok(template);
  assert.equal(validateLocalCliProviderConfig(template).ok, true);

  const unsafeTemplate = validateLocalCliProviderConfig({
    ...template,
    invocation: {
      ...template.invocation,
      argsTemplate: ["exec", "{{prompt}}; rm -rf ."]
    }
  });
  const invocation = await service.invoke({
    providerId: "codex-cli-local",
    actorId: "user_local_cli",
    taskId: "task_cli",
    taskRunId: "run_cli",
    modelId: "codex-cli/local",
    prompt: "do not execute vendor CLI"
  });

  assert.equal(unsafeTemplate.ok, false);
  assert.deepEqual(service.listLocalAgents(), []);
  assert.equal(invocation.status, "unavailable");
  assert.equal(invocation.error?.code, "local_agent_required");
  assert.equal(service.listAuditEvents().some((event) => event.eventType === "local_agent_required"), true);
});

test("policy hooks deny credential cache, PTY, and local CLI dangerous operations while allowing mock provider", () => {
  const policy = new PolicyService();
  const subject = createPolicySubject({ actorId: "provider-policy", actorKind: "system", roles: ["system"] });
  const credentialRead = policy.evaluate({
    subject,
    action: "credential.cache.read",
    resource: createPolicyResource({ resourceKind: "provider_credential", resourceId: "codex-cli-local" }),
    context: createPolicyContext()
  });
  const credentialUpload = policy.evaluate({
    subject,
    action: "credential.cache.upload",
    resource: createPolicyResource({ resourceKind: "provider_credential", resourceId: "codex-cli-local" }),
    context: createPolicyContext()
  });
  const pty = policy.evaluate({
    subject,
    action: "provider.pty.invoke",
    resource: createPolicyResource({ resourceKind: "llm_provider", resourceId: "pty" }),
    context: createPolicyContext({ providerKind: "pty_interactive_fallback" })
  });
  const shell = policy.evaluate({
    subject,
    action: "local_cli.shell_execution",
    resource: createPolicyResource({ resourceKind: "local_cli", resourceId: "claude-code-local" }),
    context: createPolicyContext()
  });
  const fileWrite = policy.evaluate({
    subject,
    action: "local_cli.file_write",
    resource: createPolicyResource({ resourceKind: "local_cli", resourceId: "claude-code-local" }),
    context: createPolicyContext()
  });
  const mockProvider = policy.evaluate({
    subject,
    action: "provider.invoke",
    resource: createPolicyResource({ resourceKind: "llm_provider", resourceId: "mock", metadata: { providerKind: "mock" } }),
    context: createPolicyContext({ providerKind: "mock" })
  });

  assert.equal(credentialRead.allowed, false);
  assert.equal(credentialUpload.allowed, false);
  assert.equal(pty.allowed, false);
  assert.equal(shell.allowed, false);
  assert.equal(fileWrite.allowed, false);
  assert.equal(mockProvider.allowed, true);
});

test("LLM Gateway can reference enterprise provider catalog metadata while mock provider remains default", async () => {
  const store = createSeededStore();
  const task = store.createTask({ title: "Provider catalog task", repoId: "repo_demo_backend", baseBranch: "main" });
  const taskRun = store.createTaskRun({ taskId: task.id, attempt: 1, status: "running", agent: "codex", model: "mock-model" });
  const service = createDefaultLlmGatewayService({ usageRepository: store });
  const providers = service.listEnterpriseProviders();

  const completion = await service.routeCompletion({
    taskId: task.id,
    taskRunId: taskRun.id,
    modelRef: "mock-coder@1.0",
    providerId: "anthropic-api-key",
    prompt: "Mock call with provider catalog attribution",
    budgetLimitUsd: 1
  });
  const remoteSkeleton = await new OpenAICompatibleLLMProvider().createCompletion({
    taskId: task.id,
    taskRunId: taskRun.id,
    prompt: "remote must stay blocked"
  }, seedLlmModels().find((model) => model.id === "openai-compatible/default") ?? seedLlmModels()[0]);
  const usage = service.listUsageEvents().at(-1);

  assert.equal(service.getConfig().providerKind, "mock");
  assert.equal(providers.some((provider) => provider.id === "anthropic-api-key"), true);
  assert.equal(completion.ok, true);
  assert.equal(usage?.metadata?.provider_id, "anthropic-api-key");
  assert.equal(usage?.metadata?.billing_mode, "provider_workspace");
  assert.equal(remoteSkeleton.ok, false);
  assert.equal(remoteSkeleton.reason, "blocked_remote_llm_disabled");
});

test("provider API exposes catalog, validation, templates, blocked invocation, audit, and health without secrets", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health");
    assert.equal((health.providerAbstraction as { status: string }).status, "available");
    assert.equal(typeof (health.providerAbstraction as { providerCatalogCount: number }).providerCatalogCount, "number");

    const providers = await getJson(address.port, "/providers") as { providers: { id: string; auth: { secretRefConfigured?: boolean } }[] };
    assert.equal(providers.providers.some((provider) => provider.id === "claude-code-local"), true);
    assert.equal(JSON.stringify(providers).includes("ANTHROPIC_API_KEY"), false);

    const provider = await getJson(address.port, "/providers/claude-code-local") as { provider: { id: string }; credentialReference: { credentialRef: { kind: string } } };
    assert.equal(provider.provider.id, "claude-code-local");
    assert.equal(provider.credentialReference.credentialRef.kind, "none");

    const validation = await postJson(address.port, "/providers/validate", { providerId: "claude-code-local" });
    assert.equal(validation.statusCode, 200);
    assert.equal((validation.body.validation as { ok: boolean }).ok, true);

    const authTypes = await getJson(address.port, "/providers/auth-types") as { authTypes: string[] };
    assert.equal(authTypes.authTypes.includes("external_cli_session"), true);

    const templates = await getJson(address.port, "/providers/local-cli/templates") as { templates: { id: string }[] };
    assert.equal(templates.templates.some((template) => template.id === "codex-cli-jsonl"), true);

    const invoke = await postJson(address.port, "/providers/invoke", {
      providerId: "claude-code-local",
      taskId: "task_provider_api",
      taskRunId: "run_provider_api",
      prompt: "blocked provider invocation"
    });
    assert.equal(invoke.statusCode, 409);
    assert.equal((invoke.body.result as { error: { code: string } }).error.code, "local_agent_required");

    const audit = await getJson(address.port, "/providers/audit") as { auditEvents: { eventType: string }[] };
    assert.equal(audit.auditEvents.some((event) => event.eventType === "local_agent_required"), true);
    assert.equal(JSON.stringify(audit).includes("blocked provider invocation"), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
