import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import { DemoDashboardDataProvider } from "../apps/web/lib/dashboard-data-provider.ts";
import { ProviderAbstractionService, StaticCredentialManager, MockTokenResolver, ProviderCatalogService } from "@aichestra/llm-gateway";
import { PolicyService, createPolicyContext, createPolicyResource, createPolicySubject } from "@aichestra/policy";
import {
  AgentRunnerService,
  LocalAgentRunner,
  LocalAgentWorkspaceManager,
  createAgentRunnerConfigFromEnv
} from "@aichestra/runner";
import {
  MockSecretManager,
  SecurityControlService,
  applySecurityRedaction,
  createInMemorySecurityRepositories,
  createDefaultSecuritySeed
} from "@aichestra/security";
import { createDefaultLlmGatewayService } from "@aichestra/llm-gateway";
import { renderDashboardHtml } from "../apps/web/src/render.ts";

const fixtureRoot = path.resolve("tests", "fixtures");
const fixtureWorkspace = path.resolve(fixtureRoot, "agent-runner");

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

test("secret models and mock manager never store or return raw secret material", () => {
  const security = new MockSecretManager();
  const secretRef = security.listSecretRefs()[0];
  assert.ok(secretRef);
  assert.equal(JSON.stringify(secretRef).includes("sk-"), false);

  const validation = security.validateSecretRef(secretRef);
  const invalid = security.validateSecretRef({
    ...secretRef,
    id: "secretref_invalid",
    metadata: { value: "sk-this-should-not-be-stored" }
  });
  const credentialCache = security.validateSecretRef({
    ...secretRef,
    id: "secretref_cache_path",
    name: "~/.codex/auth.json"
  });

  const lease = security.requestLease({
    secretRefId: secretRef.id,
    scopeId: "scope_mock_provider_metadata",
    taskId: "task_secret",
    taskRunId: "run_secret",
    actorId: "user_secret",
    reason: "test lease"
  });
  const safeEnv = security.getSafeEnvironment(lease.id);
  const revoked = security.revokeLease(lease.id);

  assert.equal(validation.ok, true);
  assert.equal(invalid.ok, false);
  assert.equal(credentialCache.ok, false);
  assert.equal(lease.status, "denied");
  assert.equal(safeEnv.ok, false);
  assert.deepEqual(safeEnv.env, {});
  assert.equal(revoked.status, "revoked");
  assert.equal(JSON.stringify([lease, safeEnv, revoked]).includes("sk-"), false);
  assert.equal(security.listAuditEvents({ targetKind: "secret" }).some((event) => event.eventType === "secret_lease_denied"), true);
});

test("sandbox, network, and redaction models fail closed by default", () => {
  const security = new SecurityControlService();
  const defaultSandbox = security.getDefaultSandboxProfile();
  const localSandbox = security.getSafeLocalSandboxProfile();
  const futureSandboxes = security.listSandboxProfiles().filter((profile) => profile.kind.endsWith("_future"));
  const egress = security.evaluateNetworkEgress({ host: "api.example.invalid", port: 443 });
  const redaction = security.redactText({
    text: "Bearer token-secret OPENAI_API_KEY=sk-secret ~/.claude/key application_default_credentials.json" + "x".repeat(200)
  });

  assert.ok(defaultSandbox);
  assert.equal(defaultSandbox.allowNetwork, false);
  assert.equal(defaultSandbox.allowSecrets, false);
  assert.equal(defaultSandbox.allowGitRemote, false);
  assert.ok(localSandbox);
  assert.equal(localSandbox.kind, "local_temp_workspace");
  assert.equal(localSandbox.allowNetwork, false);
  assert.equal(localSandbox.allowSecrets, false);
  assert.equal(futureSandboxes.every((profile) => profile.status === "disabled"), true);
  assert.equal(egress.allowed, false);
  assert.equal(redaction.redactedText.includes("sk-secret"), false);
  assert.equal(redaction.redactedText.includes(".claude"), false);
  assert.equal(redaction.previewBytes <= 128, true);
  assert.equal(security.listAuditEvents({ targetKind: "network" }).some((event) => event.eventType === "network_egress_blocked"), true);
  assert.equal(security.listAuditEvents({ targetKind: "redaction" }).some((event) => event.eventType === "redaction_applied"), true);
});

test("security policy actions deny secrets, network, and runner secret injection while allowing safe local sandbox profile", () => {
  const policy = new PolicyService();
  const subject = createPolicySubject({ actorId: "security-policy", actorKind: "system", roles: ["system"] });
  const secretRead = policy.evaluate({
    subject,
    action: "secret.read",
    resource: createPolicyResource({ resourceKind: "secret_scope", resourceId: "scope_future_real_credentials" }),
    context: createPolicyContext()
  });
  const leaseRequest = policy.evaluate({
    subject,
    action: "secret.lease.request",
    resource: createPolicyResource({ resourceKind: "secret_lease", resourceId: "secretref_mock_provider_metadata" }),
    context: createPolicyContext()
  });
  const runnerSecret = policy.evaluate({
    subject,
    action: "runner.secret.inject",
    resource: createPolicyResource({ resourceKind: "runner", resourceId: "local" }),
    context: createPolicyContext({ runnerKind: "local" })
  });
  const network = policy.evaluate({
    subject,
    action: "network.egress",
    resource: createPolicyResource({ resourceKind: "network_egress_policy", resourceId: "network_default_deny" }),
    context: createPolicyContext()
  });
  const safeSandbox = policy.evaluate({
    subject,
    action: "sandbox.profile.use",
    resource: createPolicyResource({ resourceKind: "sandbox_profile", resourceId: "sandbox_local_temp_fixture" }),
    context: createPolicyContext({
      environment: {
        sandboxKind: "local_temp_workspace",
        profileStatus: "active",
        networkAllowed: false,
        secretsAllowed: false,
        remoteGitAllowed: false
      }
    })
  });
  const futureSandbox = policy.evaluate({
    subject,
    action: "sandbox.profile.use",
    resource: createPolicyResource({ resourceKind: "sandbox_profile", resourceId: "sandbox_container_future" }),
    context: createPolicyContext({
      environment: {
        sandboxKind: "container_future",
        profileStatus: "disabled",
        networkAllowed: false,
        secretsAllowed: false,
        remoteGitAllowed: false
      }
    })
  });

  assert.equal(secretRead.allowed, false);
  assert.equal(leaseRequest.allowed, false);
  assert.equal(leaseRequest.decision, "require_approval");
  assert.equal(runnerSecret.allowed, false);
  assert.equal(network.allowed, false);
  assert.equal(safeSandbox.allowed, true);
  assert.equal(futureSandbox.allowed, false);
});

test("runner integration records safe local sandbox use without enabling secrets or network", async () => {
  const store = createSeededStore();
  const policyService = new PolicyService();
  const securityService = new SecurityControlService({ policyService });
  const llmGateway = createDefaultLlmGatewayService({ usageRepository: store, policyService });
  const config = createAgentRunnerConfigFromEnv({
    AICHESTRA_AGENT_RUNNER: "local",
    AICHESTRA_ENABLE_LOCAL_AGENT_RUNNER: "true",
    AICHESTRA_ALLOW_LOCAL_COMMAND_EXECUTION: "true",
    AICHESTRA_AGENT_WORKSPACE_ROOT: fixtureRoot
  });
  const service = new AgentRunnerService({
    runner: new LocalAgentRunner({
      enabled: true,
      allowCommandExecution: true,
      workspaceRoot: fixtureRoot,
      maxRuntimeMs: 2_000
    }, {
      llmGateway,
      workspaceManager: new LocalAgentWorkspaceManager({ workspaceRoot: fixtureRoot })
    }),
    config,
    policyService,
    securityService
  });
  const run = await service.runAgent({
    taskId: "task_security_runner",
    taskRunId: "run_security_runner",
    actorId: "user_security_runner",
    repoRef: { repoId: "repo_fixture", provider: "local", localPath: fixtureWorkspace },
    branchRef: { repoId: "repo_fixture", branchName: "local/security", baseBranch: "main" },
    selectedModelRef: "mock-coder@1.0",
    selectedSkillRefs: [{ kind: "skill", name: "auth-debugging", version: "1.0.0" }],
    selectedHarnessRef: { kind: "harness", name: "backend-node20", version: "1.0.0" },
    selectedInstructionRefs: [{ kind: "instruction", name: "org-secure-coding-baseline", version: "1.0.0" }],
    prompt: "Run fixture command without network or secrets.",
    allowedCommands: ["node fixture-command.mjs"],
    testCommands: ["node fixture-command.mjs"],
    maxRuntimeMs: 2_000,
    metadata: {}
  });
  const sessions = securityService.listSandboxSessions({ taskRunId: "run_security_runner" });

  assert.equal(run.status, "completed");
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.profileId, "sandbox_local_temp_fixture");
  assert.equal(securityService.getSafeLocalSandboxProfile()?.allowSecrets, false);
  assert.equal(securityService.getSafeLocalSandboxProfile()?.allowNetwork, false);
});

test("enterprise provider boundary remains blocked and security redaction protects provider output", async () => {
  const provider = new ProviderAbstractionService();
  const invocation = await provider.invoke({
    providerId: "claude-code-local",
    taskId: "task_provider_security",
    taskRunId: "run_provider_security",
    prompt: "must require Local Agent"
  });
  const catalog = new ProviderCatalogService();
  const credentialManager = new StaticCredentialManager({ catalog });
  const tokenResolver = new MockTokenResolver(catalog);
  const cacheRead = credentialManager.validateCredentialAccess("claude-code-local", {
    requestedPath: "~/.claude/credentials.json",
    operation: "credential.cache.read"
  });
  const localCliEnv = tokenResolver.getSafeEnvironment("claude-code-local");
  const redacted = applySecurityRedaction("Bearer vendor-token GOOGLE_APPLICATION_CREDENTIALS=/tmp/application_default_credentials.json", createDefaultSecuritySeed().redactionPolicies[0]);

  assert.equal(invocation.status, "unavailable");
  assert.equal(invocation.error?.code, "local_agent_required");
  assert.equal(cacheRead.ok, false);
  assert.deepEqual(localCliEnv.env, {});
  assert.equal(redacted.includes("vendor-token"), false);
  assert.equal(redacted.includes("application_default_credentials"), false);
});

test("security API exposes metadata-only secrets, sandbox, network, redaction, audit, and health", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health");
    assert.equal((health.security as { secretManagerKind: string }).secretManagerKind, "mock");
    assert.equal((health.security as { networkDefaultAction: string }).networkDefaultAction, "deny");

    const refs = await getJson(address.port, "/security/secrets/refs") as { secretRefs: { containsSecretMaterial: boolean }[] };
    assert.equal(refs.secretRefs.some((ref) => ref.containsSecretMaterial), false);

    const lease = await postJson(address.port, "/security/secrets/leases/request", {
      secretRefId: "secretref_mock_provider_metadata",
      scopeId: "scope_mock_provider_metadata",
      taskId: "task_security_api",
      taskRunId: "run_security_api",
      actorId: "user_security_api"
    });
    assert.equal(lease.statusCode, 409);
    assert.equal((lease.body.lease as { status: string }).status, "denied");
    assert.equal(JSON.stringify(lease.body).includes("sk-"), false);

    const revoke = await postJson(address.port, `/security/secrets/leases/${(lease.body.lease as { id: string }).id}/revoke`);
    assert.equal(revoke.statusCode, 200);
    assert.equal((revoke.body.lease as { status: string }).status, "revoked");

    const sandbox = await postJson(address.port, "/security/sandbox/sessions", {
      profileId: "sandbox_local_temp_fixture",
      taskId: "task_security_api",
      taskRunId: "run_security_api",
      runnerKind: "local",
      workspaceId: "workspace_security_api"
    });
    assert.equal(sandbox.statusCode, 201);
    assert.equal((sandbox.body.decision as { allowed: boolean }).allowed, true);

    const policies = await getJson(address.port, "/security/network/policies") as { networkPolicies: { defaultAction: string }[] };
    assert.equal(policies.networkPolicies[0]?.defaultAction, "deny");

    const redaction = await postJson(address.port, "/security/redaction/test", {
      text: "Bearer api-token ANTHROPIC_API_KEY=sk-api-secret ~/.codex/auth.json"
    });
    assert.equal(redaction.statusCode, 200);
    assert.equal(JSON.stringify(redaction.body).includes("sk-api-secret"), false);
    assert.equal(JSON.stringify(redaction.body).includes("auth.json"), false);

    const audit = await getJson(address.port, "/security/secrets/audit") as { auditEvents: { eventType: string }[] };
    assert.equal(audit.auditEvents.some((event) => event.eventType === "secret_lease_denied"), true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("dashboard renders security panels without exposing secrets", async () => {
  const html = await renderDashboardHtml(new DemoDashboardDataProvider());

  assert.equal(html.includes("Secrets and Sandbox"), true);
  assert.equal(html.includes("Secret manager"), true);
  assert.equal(html.includes("Sandbox profiles"), true);
  assert.equal(html.includes("Network egress policy"), true);
  assert.equal(html.includes("Redaction policy"), true);
  assert.equal(html.includes("credential cache paths redacted"), true);
  assert.equal(html.includes("sk-dashboard-secret"), false);
  assert.equal(html.includes("auth.json"), false);
});

test("security repositories keep v0 state queryable for future persistence contracts", () => {
  const repositories = createInMemorySecurityRepositories();
  const security = new SecurityControlService({ repositories });
  const session = security.createSandboxSession({
    profileId: "sandbox_local_temp_fixture",
    taskId: "task_repo_security",
    taskRunId: "run_repo_security",
    runnerKind: "local",
    workspaceId: "workspace_repo_security"
  });
  assert.equal(session.decision.allowed, true);
  assert.equal(repositories.sandboxSessions.listSandboxSessions({ taskRunId: "run_repo_security" }).length, 1);
  assert.equal(repositories.secretRefs.listSecretRefs().length >= 1, true);
  assert.equal(repositories.redactionPolicies.listRedactionPolicies()[0]?.id, "redaction_default");
});
