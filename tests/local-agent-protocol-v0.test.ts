import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  LocalAgentProtocolError,
  LocalAgentProtocolService,
  ProviderAbstractionService,
  parseLocalAgentStructuredOutput
} from "@aichestra/llm-gateway";
import { PolicyService, createPolicyContext, createPolicyResource, createPolicySubject } from "@aichestra/policy";
import { SecurityControlService } from "@aichestra/security";

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

function createProtocol() {
  const policyService = new PolicyService();
  const securityService = new SecurityControlService({ policyService });
  return {
    policyService,
    securityService,
    protocol: new LocalAgentProtocolService({ policyService, securityService })
  };
}

function createReadOnlyEnvelope(protocol: LocalAgentProtocolService, agentId: string, overrides: Record<string, unknown> = {}) {
  return protocol.createInvocationEnvelope({
    providerId: "codex-cli-local",
    localAgentId: agentId,
    workspaceRef: "workspace_test",
    requiredConsentLevel: "read_only",
    sandboxProfileId: "sandbox_default_deny",
    networkPolicyId: "network_default_deny",
    redactionPolicyId: "redaction_default",
    secretScopeIds: [],
    taskId: "task_local_agent",
    taskRunId: "run_local_agent",
    ...overrides
  });
}

test("Local Agent registration, capabilities, heartbeat, and revoke are metadata-only", () => {
  const { protocol } = createProtocol();
  const agent = protocol.registerAgent({
    userId: "user_local_agent",
    hostId: "host_1",
    displayName: "Mock Local Agent",
    agentVersion: "0.0.0-mock",
    platform: "linux-x64",
    metadata: { token: "sk-should-redact" }
  });
  const heartbeat = protocol.heartbeat(agent.id);
  const revoked = protocol.revokeAgent(agent.id);

  assert.equal(protocol.listAgents().length, 1);
  assert.equal(agent.capabilities.some((capability) => capability.kind === "local_cli" && capability.enabled), true);
  assert.equal(agent.capabilities.some((capability) => capability.kind === "shell_execution" && capability.enabled), false);
  assert.equal(agent.capabilities.some((capability) => capability.kind === "network_access" && capability.enabled), false);
  assert.equal(agent.capabilities.some((capability) => capability.kind === "secret_access" && capability.enabled), false);
  assert.ok(heartbeat.lastSeenAt);
  assert.equal(revoked.status, "revoked");
  assert.equal(JSON.stringify(protocol.listAgents()).includes("sk-should-redact"), false);
  assert.equal(protocol.listAuditEvents().some((event) => event.eventType === "local_agent_registered"), true);
  assert.equal(protocol.listAuditEvents().some((event) => event.eventType === "local_agent_revoked"), true);
});

test("disconnected or revoked Local Agents cannot be dispatched", async () => {
  const { protocol } = createProtocol();
  const disconnected = protocol.registerAgent({
    userId: "user_disconnected",
    hostId: "host_disconnected",
    displayName: "Disconnected Agent",
    agentVersion: "0.0.0-mock",
    platform: "linux-x64",
    status: "disconnected"
  });
  const disconnectedInvocation = createReadOnlyEnvelope(protocol, disconnected.id);
  const disconnectedDispatch = await protocol.dispatchInvocation(disconnectedInvocation.invocation.id);

  const connected = protocol.registerAgent({
    userId: "user_revoked",
    hostId: "host_revoked",
    displayName: "Revoked Agent",
    agentVersion: "0.0.0-mock",
    platform: "linux-x64"
  });
  protocol.revokeAgent(connected.id);
  const revokedInvocation = createReadOnlyEnvelope(protocol, connected.id);
  const revokedDispatch = await protocol.dispatchInvocation(revokedInvocation.invocation.id);

  assert.equal(disconnectedDispatch.state, "local_agent_unavailable");
  assert.equal(revokedDispatch.state, "local_agent_unavailable");
  assert.equal(protocol.listAuditEvents().filter((event) => event.eventType === "local_agent_unavailable").length, 2);
});

test("read-only invocation requires consent, dispatches through mock transport, stores redacted stdout/stderr, and completes once", async () => {
  const { protocol } = createProtocol();
  const agent = protocol.registerAgent({
    userId: "user_protocol",
    hostId: "host_protocol",
    displayName: "Protocol Agent",
    agentVersion: "0.0.0-mock",
    platform: "linux-x64"
  });
  const { envelope, invocation } = createReadOnlyEnvelope(protocol, agent.id, { metadata: { apiKey: "sk-no-store" } });

  assert.equal(envelope.signatureStatus, "valid_mock");
  assert.equal(JSON.stringify(envelope).includes("sk-no-store"), false);

  const awaiting = await protocol.dispatchInvocation(invocation.id);
  const consent = protocol.listConsentRequests({ invocationId: invocation.id }).at(-1);
  assert.equal(awaiting.state, "awaiting_consent");
  assert.ok(consent);

  protocol.recordConsentDecision({
    consentRequestId: consent.id,
    userId: agent.userId,
    decision: "approved",
    reason: "test read only approval"
  });
  const running = await protocol.dispatchInvocation(invocation.id);
  assert.equal(running.state, "running");
  assert.equal(protocol.listEvents({ invocationId: invocation.id }).some((event) => event.source === "stdout"), true);
  assert.equal(protocol.listEvents({ invocationId: invocation.id }).some((event) => event.source === "stderr"), true);

  protocol.receiveInvocationEvent({
    invocationId: invocation.id,
    source: "stdout",
    type: "message",
    payload: { text: "OPENAI_API_KEY=sk-secret-value ~/.codex/auth.json" }
  });
  const completed = protocol.completeInvocation({ invocationId: invocation.id, exitCode: 0 });

  assert.equal(completed.state, "completed");
  assert.equal(completed.redactionApplied, true);
  assert.equal(JSON.stringify(protocol.listEvents({ invocationId: invocation.id })).includes("sk-secret-value"), false);
  assert.throws(() => protocol.completeInvocation({ invocationId: invocation.id, exitCode: 0 }), LocalAgentProtocolError);
});

test("consent denial, consent expiry, danger, shell execution, missing sandbox, missing redaction, and secret/network requests fail closed", async () => {
  let currentTime = new Date("2026-01-01T00:00:00.000Z");
  const policyService = new PolicyService();
  const securityService = new SecurityControlService({ policyService });
  const protocol = new LocalAgentProtocolService({ policyService, securityService, now: () => currentTime });
  const agent = protocol.registerAgent({
    userId: "user_fail_closed",
    hostId: "host_fail_closed",
    displayName: "Fail Closed Agent",
    agentVersion: "0.0.0-mock",
    platform: "linux-x64"
  });

  const denied = createReadOnlyEnvelope(protocol, agent.id);
  const deniedRequest = protocol.requestConsent(denied.invocation.id);
  protocol.recordConsentDecision({ consentRequestId: deniedRequest.id, userId: agent.userId, decision: "denied" });
  assert.equal(protocol.getInvocation(denied.invocation.id)?.state, "consent_denied");

  const expired = createReadOnlyEnvelope(protocol, agent.id);
  const expiredRequest = protocol.requestConsent(expired.invocation.id);
  currentTime = new Date("2026-01-01T00:11:00.000Z");
  const expiredDecision = protocol.recordConsentDecision({ consentRequestId: expiredRequest.id, userId: agent.userId, decision: "approved" });
  assert.equal(expiredDecision.decision, "expired");
  assert.equal(protocol.getInvocation(expired.invocation.id)?.state, "consent_denied");

  const danger = createReadOnlyEnvelope(protocol, agent.id, { requiredConsentLevel: "danger_full_access" });
  const shell = createReadOnlyEnvelope(protocol, agent.id, { requiredConsentLevel: "shell_execution" });
  const network = createReadOnlyEnvelope(protocol, agent.id, { requiredConsentLevel: "network_or_secret_access" });
  const secret = createReadOnlyEnvelope(protocol, agent.id, { secretScopeIds: ["scope_future_real_credentials"] });
  const noSandbox = createReadOnlyEnvelope(protocol, agent.id, { sandboxProfileId: undefined });
  const noRedaction = createReadOnlyEnvelope(protocol, agent.id, { redactionPolicyId: undefined });

  assert.equal((await protocol.dispatchInvocation(danger.invocation.id)).state, "policy_blocked");
  assert.equal((await protocol.dispatchInvocation(shell.invocation.id)).statusReason, "shell_execution_denied");
  assert.equal((await protocol.dispatchInvocation(network.invocation.id)).statusReason, "network_or_secret_access_denied");
  assert.equal((await protocol.dispatchInvocation(secret.invocation.id)).statusReason, "secret_forwarding_denied");
  assert.equal((await protocol.dispatchInvocation(noSandbox.invocation.id)).statusReason, "sandbox_profile_required");
  assert.equal((await protocol.dispatchInvocation(noRedaction.invocation.id)).statusReason, "redaction_policy_required");
  assert.equal(securityService.listSecretLeases().length, 0);
});

test("running invocation can be cancelled and illegal transitions are rejected", async () => {
  const { protocol } = createProtocol();
  const agent = protocol.registerAgent({
    userId: "user_cancel",
    hostId: "host_cancel",
    displayName: "Cancel Agent",
    agentVersion: "0.0.0-mock",
    platform: "linux-x64"
  });
  const { invocation } = createReadOnlyEnvelope(protocol, agent.id);
  const consent = protocol.requestConsent(invocation.id);
  protocol.recordConsentDecision({ consentRequestId: consent.id, userId: agent.userId, decision: "approved" });
  const running = await protocol.dispatchInvocation(invocation.id);
  const cancelled = await protocol.cancelInvocation(running.id);

  assert.equal(cancelled.state, "cancelled");
  await assert.rejects(() => protocol.dispatchInvocation(cancelled.id), LocalAgentProtocolError);
  await assert.rejects(() => protocol.cancelInvocation(cancelled.id), LocalAgentProtocolError);
});

test("policy integration denies credential caches and dangerous local CLI while allowing read-only consented mock dispatch", () => {
  const policy = new PolicyService();
  const subject = createPolicySubject({ actorId: "policy_local_agent", actorKind: "system", roles: ["system"] });
  const localAgentInvoke = policy.evaluate({
    subject,
    action: "local_agent.invoke",
    resource: createPolicyResource({ resourceKind: "local_agent", resourceId: "agent", metadata: { status: "connected" } }),
    context: createPolicyContext({ providerKind: "local_cli", environment: { localAgentConnected: true, mockTransport: true }, metadata: { consentLevel: "read_only", consentApproved: true } })
  });
  const consentRequired = policy.evaluate({
    subject,
    action: "local_agent.invoke",
    resource: createPolicyResource({ resourceKind: "local_agent", resourceId: "agent", metadata: { status: "connected" } }),
    context: createPolicyContext({ providerKind: "local_cli", environment: { localAgentConnected: true, mockTransport: true }, metadata: { consentLevel: "read_only", consentApproved: false } })
  });
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
  const directLocalCli = policy.evaluate({
    subject,
    action: "local_cli.invoke",
    resource: createPolicyResource({ resourceKind: "local_cli", resourceId: "codex-cli-local" }),
    context: createPolicyContext()
  });
  const danger = policy.evaluate({
    subject,
    action: "local_cli.danger_full_access",
    resource: createPolicyResource({ resourceKind: "local_cli", resourceId: "codex-cli-local" }),
    context: createPolicyContext()
  });
  const network = policy.evaluate({
    subject,
    action: "local_cli.network_access",
    resource: createPolicyResource({ resourceKind: "local_cli", resourceId: "codex-cli-local" }),
    context: createPolicyContext()
  });

  assert.equal(localAgentInvoke.allowed, true);
  assert.equal(consentRequired.decision, "require_approval");
  assert.equal(credentialRead.allowed, false);
  assert.equal(credentialUpload.allowed, false);
  assert.equal(directLocalCli.allowed, false);
  assert.equal(danger.allowed, false);
  assert.equal(network.allowed, false);
});

test("Enterprise Provider local_cli uses protocol states: required, awaiting consent, and mock completed", async () => {
  const noAgentProvider = new ProviderAbstractionService();
  const noAgent = await noAgentProvider.invoke({
    providerId: "codex-cli-local",
    taskId: "task_provider_protocol",
    taskRunId: "run_provider_protocol",
    prompt: "must not execute"
  });
  assert.equal(noAgent.status, "unavailable");
  assert.equal(noAgent.error?.code, "local_agent_required");

  const { policyService, securityService, protocol } = createProtocol();
  const agent = protocol.registerAgent({
    userId: "user_provider_protocol",
    hostId: "host_provider_protocol",
    displayName: "Provider Protocol Agent",
    agentVersion: "0.0.0-mock",
    platform: "linux-x64"
  });
  const provider = new ProviderAbstractionService({ policyService, localAgentProtocolService: protocol });
  const awaiting = await provider.invoke({
    providerId: "codex-cli-local",
    actorId: agent.userId,
    taskId: "task_provider_protocol",
    taskRunId: "run_provider_protocol",
    prompt: "must not execute"
  });
  const invocationId = awaiting.metadata.local_agent_invocation_id;
  const consentRequestId = awaiting.metadata.consent_request_id;
  assert.equal(awaiting.status, "awaiting_consent");
  assert.equal(typeof invocationId, "string");
  assert.equal(typeof consentRequestId, "string");

  protocol.recordConsentDecision({
    consentRequestId: consentRequestId as string,
    userId: agent.userId,
    decision: "approved"
  });
  const completed = await provider.invoke({
    providerId: "codex-cli-local",
    actorId: agent.userId,
    taskId: "task_provider_protocol",
    taskRunId: "run_provider_protocol",
    prompt: "must not execute",
    context: { localAgentInvocationId: invocationId }
  });

  assert.equal(completed.status, "completed");
  assert.equal(completed.metadata.direct_local_cli_execution, false);
  assert.equal(completed.normalizedEvents.some((event) => event.source === "stderr" && event.type === "progress"), true);
  assert.equal(provider.listAuditEvents().some((event) => event.eventType === "awaiting_consent"), true);
  assert.equal(provider.listAuditEvents().some((event) => event.eventType === "mock_completed"), true);
  assert.equal(securityService.listSecretLeases().length, 0);
});

test("event normalization keeps stdout/stderr separate and fails malformed structured output clearly", () => {
  const raw = parseLocalAgentStructuredOutput({ invocationId: "inv_parse", source: "stdout", mode: "raw", text: "hello" });
  const jsonl = parseLocalAgentStructuredOutput({ invocationId: "inv_parse", source: "stdout", mode: "jsonl", text: "{\"type\":\"token\"}\n{\"type\":\"final\"}" });
  const malformed = parseLocalAgentStructuredOutput({ invocationId: "inv_parse", source: "stdout", mode: "json", text: "{bad" });

  assert.equal(raw.ok, true);
  assert.equal(raw.events[0]?.source, "stdout");
  assert.equal(jsonl.ok, true);
  assert.equal(jsonl.events.length, 2);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.events[0]?.source, "system");
  assert.equal(malformed.events[0]?.payload.code, "local_agent_output_parse_error");
});

test("Local Agent Protocol API exposes registration, consent, dispatch, events, audit, health, and no secrets", async () => {
  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const health = await getJson(address.port, "/health");
    assert.equal((health.localAgentProtocol as { status: string }).status, "available");
    assert.equal((health.localAgentProtocol as { mockTransportEnabled: boolean }).mockTransportEnabled, true);
    assert.equal((health.localAgentProtocol as { localCliExecutionEnabled: boolean }).localCliExecutionEnabled, false);
    assert.equal((health.localAgentProtocol as { credentialCacheAccessAllowed: boolean }).credentialCacheAccessAllowed, false);

    const registered = await postJson(address.port, "/local-agents/register", {
      userId: "user_api_agent",
      hostId: "host_api_agent",
      displayName: "API Mock Local Agent",
      agentVersion: "0.0.0-mock",
      platform: "linux-x64",
      metadata: { token: "sk-api-secret" }
    });
    assert.equal(registered.statusCode, 201);
    const agentId = ((registered.body.localAgent as Record<string, unknown>).id) as string;

    const agents = await getJson(address.port, "/local-agents") as { localAgents: { id: string; containsSecretMaterial: boolean }[] };
    assert.equal(agents.localAgents.some((agent) => agent.id === agentId), true);
    assert.equal(JSON.stringify(agents).includes("sk-api-secret"), false);

    const heartbeat = await postJson(address.port, `/local-agents/${agentId}/heartbeat`);
    assert.equal(heartbeat.statusCode, 200);

    const created = await postJson(address.port, "/local-agents/invocations", {
      providerId: "codex-cli-local",
      localAgentId: agentId,
      workspaceRef: "workspace_api_protocol",
      requiredConsentLevel: "read_only",
      sandboxProfileId: "sandbox_default_deny",
      networkPolicyId: "network_default_deny",
      redactionPolicyId: "redaction_default",
      taskId: "task_api_protocol",
      taskRunId: "run_api_protocol"
    });
    assert.equal(created.statusCode, 201);
    const invocationId = ((created.body.invocation as Record<string, unknown>).id) as string;
    const consentRequestId = ((created.body.consentRequest as Record<string, unknown>).id) as string;

    const consentList = await getJson(address.port, "/local-agents/consent-requests?pendingOnly=true") as { consentRequests: unknown[] };
    assert.equal(consentList.consentRequests.length, 1);

    const decision = await postJson(address.port, `/local-agents/consent-requests/${consentRequestId}/decision`, {
      userId: "user_api_agent",
      decision: "approved"
    });
    assert.equal(decision.statusCode, 201);

    const dispatched = await postJson(address.port, `/local-agents/invocations/${invocationId}/dispatch`);
    assert.equal(dispatched.statusCode, 200);
    assert.equal((dispatched.body.invocation as { state: string }).state, "running");

    const events = await getJson(address.port, `/local-agents/invocations/${invocationId}/events`) as { events: { source: string }[] };
    assert.equal(events.events.some((event) => event.source === "stdout"), true);
    assert.equal(events.events.some((event) => event.source === "stderr"), true);

    const completed = await postJson(address.port, `/local-agents/invocations/${invocationId}/complete`, { exitCode: 0 });
    assert.equal(completed.statusCode, 200);
    assert.equal((completed.body.invocation as { state: string }).state, "completed");

    const audit = await getJson(address.port, "/local-agents/audit") as { auditEvents: { eventType: string }[] };
    assert.equal(audit.auditEvents.some((event) => event.eventType === "local_agent_invocation_completed"), true);
    assert.equal(JSON.stringify({ health, registered, agents, created, events, completed, audit }).includes("sk-api-secret"), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
