import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "@aichestra/api";
import { createSeededStore } from "@aichestra/db";
import {
  FixtureLocalAgentDaemon,
  LocalAgentProtocolError,
  LocalAgentProtocolService,
  ProviderAbstractionService,
  parseLocalAgentStructuredOutput
} from "@aichestra/llm-gateway";
import { PolicyService, createPolicyContext, createPolicyResource, createPolicySubject } from "@aichestra/policy";
import { SecurityControlService } from "@aichestra/security";

function createProtocol(now?: () => Date) {
  const policyService = new PolicyService();
  const securityService = new SecurityControlService({ policyService });
  const protocol = new LocalAgentProtocolService({ policyService, securityService, now });
  return { policyService, securityService, protocol };
}

function createFixtureEnvelope(protocol: LocalAgentProtocolService, agentId: string, channelId: string, overrides: Record<string, unknown> = {}) {
  return protocol.createInvocationEnvelope({
    providerId: "codex-cli-local",
    localAgentId: agentId,
    workspaceRef: "workspace_fixture_protocol",
    requiredConsentLevel: "read_only",
    sandboxProfileId: "sandbox_default_deny",
    networkPolicyId: "network_default_deny",
    redactionPolicyId: "redaction_default",
    secretScopeIds: [],
    taskId: "task_lap_v1",
    taskRunId: "run_lap_v1",
    metadata: {
      requireChannel: true,
      channelId,
      compatibilityRequired: true,
      compatibilityCompatible: true,
      providerTemplateId: "codex-cli-jsonl",
      parserMode: "jsonl",
      fixtureDaemon: true,
      ...overrides
    }
  });
}

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

test("mock signed channel creates pending channel, validates mock handshake, and blocks invalid or revoked channels", async () => {
  let currentTime = new Date("2026-01-01T00:00:00.000Z");
  const { protocol } = createProtocol(() => currentTime);
  const { agent } = protocol.startFixtureAgent({ userId: "user_channel" });
  const created = protocol.createChannel({ agentId: agent.id, expiresInMs: 1000 });
  const invalid = protocol.verifyHandshake({ channelId: created.channel.id, response: "invalid" });

  assert.equal(created.channel.status, "pending");
  assert.equal(created.handshake.responseStatus, "pending");
  assert.equal(invalid.handshake.responseStatus, "invalid");
  assert.equal(invalid.channel.handshakeStatus, "failed");

  const connected = protocol.connectChannel(agent.id);
  assert.equal(connected.channel.status, "established");
  assert.equal(connected.handshake.responseStatus, "mock_valid");

  const revoked = protocol.revokeChannel(connected.channel.id);
  const { invocation } = createFixtureEnvelope(protocol, agent.id, revoked.id);
  const consent = protocol.requestConsent(invocation.id);
  protocol.recordConsentDecision({ consentRequestId: consent.id, userId: agent.userId, decision: "approved_once" });
  assert.equal((await protocol.dispatchInvocation(invocation.id)).statusReason, "channel_revoked");

  const expiringCreated = protocol.createChannel({ agentId: agent.id, expiresInMs: 1000 });
  const expiring = protocol.verifyHandshake({ channelId: expiringCreated.channel.id, response: `mock:${expiringCreated.handshake.challenge}` });
  currentTime = new Date("2026-01-01T00:00:02.000Z");
  const expiredInvocation = createFixtureEnvelope(protocol, agent.id, expiring.channel.id).invocation;
  assert.equal((await protocol.dispatchInvocation(expiredInvocation.id)).statusReason, "channel_expired");

  const sessionExpiryChannel = protocol.createChannel({ agentId: agent.id, expiresInMs: 3 * 60 * 60 * 1000 });
  const sessionChannel = protocol.verifyHandshake({ channelId: sessionExpiryChannel.channel.id, response: `mock:${sessionExpiryChannel.handshake.challenge}` });
  const sessionExpiredInvocation = createFixtureEnvelope(protocol, agent.id, sessionChannel.channel.id).invocation;
  const sessionExpiredConsent = protocol.requestConsent(sessionExpiredInvocation.id);
  protocol.recordConsentDecision({ consentRequestId: sessionExpiredConsent.id, userId: agent.userId, decision: "approved_for_session" });
  currentTime = new Date("2026-01-01T02:00:00.000Z");
  const sessionExpired = await protocol.dispatchInvocation(sessionExpiredInvocation.id);
  assert.equal(sessionExpired.state, "local_agent_unavailable");
  assert.equal(sessionExpired.statusReason, "local_agent_session_expired");
});

test("fixture daemon advertises capabilities, checks compatibility, streams redacted fixture events, and never issues secrets", async () => {
  const { protocol, securityService } = createProtocol();
  const daemon = new FixtureLocalAgentDaemon(protocol);
  const { agent, advertisement } = daemon.startFixtureAgent({ userId: "user_fixture", scenario: "stderr_progress" });
  const { channel } = daemon.connectChannel(agent.id);
  const compatible = protocol.checkCompatibility({
    providerId: "codex-cli-local",
    agentId: agent.id,
    command: "codex",
    providerTemplateId: "codex-cli-jsonl",
    parserMode: "jsonl",
    reportedVersion: "0.1.0"
  });
  const unsupportedParser = protocol.checkCompatibility({
    providerId: "codex-cli-local",
    agentId: agent.id,
    command: "codex",
    providerTemplateId: "codex-cli-jsonl",
    parserMode: "json",
    reportedVersion: "0.1.0"
  });
  const unsupportedTemplate = protocol.checkCompatibility({
    providerId: "codex-cli-local",
    agentId: agent.id,
    command: "codex",
    providerTemplateId: "missing-template",
    parserMode: "jsonl",
    reportedVersion: "0.1.0"
  });
  const claudeJson = protocol.checkCompatibility({
    providerId: "claude-code-local",
    agentId: agent.id,
    command: "claude",
    providerTemplateId: "claude-code-headless-json",
    parserMode: "json",
    reportedVersion: "0.1.0"
  });
  const claudeStream = protocol.checkCompatibility({
    providerId: "claude-code-local",
    agentId: agent.id,
    command: "claude",
    providerTemplateId: "claude-code-stream-json",
    parserMode: "jsonl",
    reportedVersion: "0.1.0"
  });
  const codexRaw = protocol.checkCompatibility({
    providerId: "codex-cli-local",
    agentId: agent.id,
    command: "codex",
    providerTemplateId: "codex-cli-headless",
    parserMode: "raw",
    reportedVersion: "0.1.0"
  });
  const geminiJson = protocol.checkCompatibility({
    providerId: "gemini-cli-local",
    agentId: agent.id,
    command: "gemini",
    providerTemplateId: "gemini-cli-json",
    parserMode: "json",
    reportedVersion: "0.1.0"
  });
  const incompatibleVersion = protocol.checkCompatibility({
    providerId: "codex-cli-local",
    agentId: agent.id,
    command: "codex",
    providerTemplateId: "codex-cli-jsonl",
    parserMode: "jsonl",
    reportedVersion: "2.0.0"
  });
  const ptyEntry = protocol.listCompatibilityEntries().find((entry) => entry.providerTemplateId === "pty-interactive-fallback");

  assert.equal(advertisement.supportsStreaming, true);
  assert.equal(advertisement.supportsCancellation, true);
  assert.equal(advertisement.capabilities.some((capability) => capability.kind === "shell_execution" && capability.enabled), false);
  assert.equal(advertisement.capabilities.some((capability) => capability.kind === "network_access" && capability.enabled), false);
  assert.equal(advertisement.capabilities.some((capability) => capability.kind === "secret_access" && capability.enabled), false);
  assert.equal(compatible.compatible, true);
  assert.equal(unsupportedParser.compatible, false);
  assert.equal(unsupportedTemplate.compatible, false);
  assert.equal(claudeJson.compatible, true);
  assert.equal(claudeStream.compatible, true);
  assert.equal(codexRaw.compatible, true);
  assert.equal(geminiJson.compatible, true);
  assert.equal(incompatibleVersion.compatible, false);
  assert.equal(ptyEntry?.supported, false);
  assert.equal(ptyEntry?.notes.includes("PTY"), true);

  const { invocation } = createFixtureEnvelope(protocol, agent.id, channel.id);
  const consent = protocol.requestConsent(invocation.id);
  assert.deepEqual(consent.requestedCapabilityKinds.includes("workspace_read"), true);
  assert.equal(consent.providerId, "codex-cli-local");
  assert.equal(consent.workspaceRef, "workspace_fixture_protocol");
  protocol.recordConsentDecision({ consentRequestId: consent.id, userId: agent.userId, decision: "approved_for_session" });
  const running = await protocol.dispatchInvocation(invocation.id);
  protocol.receiveInvocationEvent({
    invocationId: running.id,
    source: "stdout",
    type: "message",
    payload: { text: "fixture stdout OPENAI_API_KEY=sk-secret-value ~/.codex/auth.json" }
  });
  const completed = daemon.completeInvocation(running.id);
  const stream = protocol.getStreamForInvocation(running.id);
  const streamEvents = protocol.listStreamEvents({ invocationId: running.id });

  assert.equal(completed.state, "completed");
  assert.equal(stream?.state, "completed");
  assert.equal(streamEvents.map((event) => event.sequence).join(","), "1,2,3,4");
  assert.equal(streamEvents.some((event) => event.source === "stderr" && event.type === "progress"), true);
  assert.equal(JSON.stringify(streamEvents).includes("sk-secret-value"), false);
  assert.equal(securityService.listSecretLeases().length, 0);
  assert.equal(protocol.listAuditEvents().some((event) => event.eventType === "local_agent_stream_completed"), true);
});

test("timeout, cancel, disconnect, revoke, and parser error lifecycle outcomes are deterministic", async () => {
  const { protocol } = createProtocol();
  const { agent } = protocol.startFixtureAgent({ userId: "user_lifecycle" });
  const { channel } = protocol.connectChannel(agent.id);

  const cancelBeforeDispatch = createFixtureEnvelope(protocol, agent.id, channel.id).invocation;
  assert.equal((await protocol.cancelInvocation(cancelBeforeDispatch.id)).state, "cancelled");

  const runningInvocation = createFixtureEnvelope(protocol, agent.id, channel.id).invocation;
  const runningConsent = protocol.requestConsent(runningInvocation.id);
  protocol.recordConsentDecision({ consentRequestId: runningConsent.id, userId: agent.userId, decision: "approved_once" });
  const running = await protocol.dispatchInvocation(runningInvocation.id);
  assert.equal((await protocol.cancelInvocation(running.id)).state, "cancelled");

  const timeoutInvocation = createFixtureEnvelope(protocol, agent.id, channel.id).invocation;
  const timeoutConsent = protocol.requestConsent(timeoutInvocation.id);
  protocol.recordConsentDecision({ consentRequestId: timeoutConsent.id, userId: agent.userId, decision: "approved_once" });
  await protocol.dispatchInvocation(timeoutInvocation.id);
  assert.equal(protocol.timeoutInvocation(timeoutInvocation.id).state, "timed_out");

  const disconnectInvocation = createFixtureEnvelope(protocol, agent.id, channel.id).invocation;
  const disconnectConsent = protocol.requestConsent(disconnectInvocation.id);
  protocol.recordConsentDecision({ consentRequestId: disconnectConsent.id, userId: agent.userId, decision: "approved_once" });
  await protocol.dispatchInvocation(disconnectInvocation.id);
  protocol.disconnectAgent(agent.id);
  assert.equal(protocol.getInvocation(disconnectInvocation.id)?.state, "failed");
  assert.equal(protocol.getInvocation(disconnectInvocation.id)?.statusReason, "local_agent_disconnected");

  const { agent: revokedAgent } = protocol.startFixtureAgent({ userId: "user_revoked_event" });
  const { channel: revokedChannel } = protocol.connectChannel(revokedAgent.id);
  const revokedInvocation = createFixtureEnvelope(protocol, revokedAgent.id, revokedChannel.id).invocation;
  const revokedConsent = protocol.requestConsent(revokedInvocation.id);
  protocol.recordConsentDecision({ consentRequestId: revokedConsent.id, userId: revokedAgent.userId, decision: "approved_once" });
  await protocol.dispatchInvocation(revokedInvocation.id);
  protocol.revokeAgent(revokedAgent.id);
  assert.throws(() => protocol.receiveInvocationEvent({ invocationId: revokedInvocation.id, source: "stdout", type: "message", payload: { text: "blocked" } }), LocalAgentProtocolError);

  const malformed = parseLocalAgentStructuredOutput({ invocationId: "inv_v1_parse", source: "stdout", mode: "jsonl", text: "{\"ok\":true}\n{bad" });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.events[0]?.payload.code, "local_agent_output_parse_error");
});

test("Enterprise Provider local_cli observes v1 channel, consent, compatibility, and fixture completion states", async () => {
  const noAgentProvider = new ProviderAbstractionService();
  assert.equal((await noAgentProvider.invoke({ providerId: "codex-cli-local", prompt: "no real cli" })).error?.code, "local_agent_required");

  const { policyService, protocol } = createProtocol();
  const disconnected = protocol.startFixtureAgent({ userId: "user_provider_disconnected" }).agent;
  protocol.disconnectAgent(disconnected.id);
  const disconnectedProvider = new ProviderAbstractionService({ policyService, localAgentProtocolService: protocol });
  assert.equal((await disconnectedProvider.invoke({ providerId: "codex-cli-local", actorId: disconnected.userId, prompt: "no real cli" })).error?.code, "local_agent_unavailable");

  const { agent } = protocol.startFixtureAgent({ userId: "user_provider_fixture" });
  const actorMismatch = await disconnectedProvider.invoke({ providerId: "codex-cli-local", actorId: "user_without_connected_agent", prompt: "must not borrow another user's agent" });
  assert.equal(actorMismatch.error?.code, "local_agent_required");

  const noChannel = await disconnectedProvider.invoke({ providerId: "codex-cli-local", actorId: agent.userId, prompt: "no real cli", context: { localAgentId: agent.id } });
  assert.equal(noChannel.error?.code, "channel_required");

  protocol.connectChannel(agent.id);
  const awaiting = await disconnectedProvider.invoke({ providerId: "codex-cli-local", actorId: agent.userId, prompt: "no real cli", context: { localAgentId: agent.id } });
  assert.equal(awaiting.status, "awaiting_consent");
  const invocationId = awaiting.metadata.local_agent_invocation_id as string;
  const consentRequestId = awaiting.metadata.consent_request_id as string;
  protocol.recordConsentDecision({ consentRequestId, userId: agent.userId, decision: "denied" });
  const denied = await disconnectedProvider.invoke({ providerId: "codex-cli-local", actorId: agent.userId, prompt: "no real cli", context: { localAgentId: agent.id, localAgentInvocationId: invocationId } });
  assert.equal(denied.error?.code, "consent_denied");

  const { agent: incompatibleAgent } = protocol.startFixtureAgent({ userId: "user_provider_incompatible" });
  protocol.advertiseCapabilities({ agentId: incompatibleAgent.id, supportedProviderTemplates: ["gemini-cli-json"], supportedParserModes: ["json"] });
  protocol.connectChannel(incompatibleAgent.id);
  const incompatible = await disconnectedProvider.invoke({ providerId: "codex-cli-local", actorId: incompatibleAgent.userId, prompt: "no real cli", context: { localAgentId: incompatibleAgent.id } });
  assert.equal(incompatible.error?.code, "provider_template_incompatible");

  const { agent: compatibleAgent } = protocol.startFixtureAgent({ userId: "user_provider_compatible" });
  protocol.connectChannel(compatibleAgent.id);
  const compatibleAwaiting = await disconnectedProvider.invoke({ providerId: "codex-cli-local", actorId: compatibleAgent.userId, prompt: "no real cli", context: { localAgentId: compatibleAgent.id } });
  protocol.recordConsentDecision({
    consentRequestId: compatibleAwaiting.metadata.consent_request_id as string,
    userId: compatibleAgent.userId,
    decision: "approved_once"
  });
  const completed = await disconnectedProvider.invoke({
    providerId: "codex-cli-local",
    actorId: compatibleAgent.userId,
    prompt: "no real cli",
    context: { localAgentId: compatibleAgent.id, localAgentInvocationId: compatibleAwaiting.metadata.local_agent_invocation_id }
  });
  assert.equal(completed.status, "completed");
  assert.equal(completed.metadata.fixture_daemon, true);
  assert.equal(completed.metadata.direct_local_cli_execution, false);
});

test("policy and API expose v1 mock channel, fixture daemon, compatibility, consent, stream, health, and no secrets", async () => {
  const policy = new PolicyService();
  const subject = createPolicySubject({ actorId: "policy_lap_v1", actorKind: "system", roles: ["system"] });
  const realTransport = policy.evaluate({
    subject,
    action: "local_agent.channel.create",
    resource: createPolicyResource({ resourceKind: "local_agent", resourceId: "agent" }),
    context: createPolicyContext({ environment: { mockTransport: false, realTransport: true } })
  });
  const compatibleTemplate = policy.evaluate({
    subject,
    action: "local_cli.template.use",
    resource: createPolicyResource({ resourceKind: "local_cli", resourceId: "codex-cli-local" }),
    context: createPolicyContext({ metadata: { compatible: true, consentApproved: true } })
  });
  const incompatibleTemplate = policy.evaluate({
    subject,
    action: "local_cli.template.use",
    resource: createPolicyResource({ resourceKind: "local_cli", resourceId: "codex-cli-local" }),
    context: createPolicyContext({ metadata: { compatible: false, consentApproved: true } })
  });
  const sessionApproval = policy.evaluate({
    subject,
    action: "local_agent.session.approve",
    resource: createPolicyResource({ resourceKind: "local_agent", resourceId: "agent" }),
    context: createPolicyContext()
  });
  assert.equal(realTransport.allowed, false);
  assert.equal(compatibleTemplate.allowed, true);
  assert.equal(incompatibleTemplate.allowed, false);
  assert.equal(sessionApproval.allowed, true);

  const server = createApiServer(createSeededStore());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const started = await postJson(address.port, "/local-agents/fixture/start", { userId: "user_api_v1", metadata: { token: "sk-api-v1-secret" } });
    assert.equal(started.statusCode, 201);
    const agentId = ((started.body.localAgent as Record<string, unknown>).id) as string;
    const channelCreated = await postJson(address.port, `/local-agents/${agentId}/channels`, { channelKind: "mock_in_memory" });
    const channelId = ((channelCreated.body.channel as Record<string, unknown>).id) as string;
    const challenge = ((channelCreated.body.handshake as Record<string, unknown>).challenge) as string;
    const handshake = await postJson(address.port, `/local-agents/channels/${channelId}/handshake`, { response: `mock:${challenge}` });
    assert.equal(handshake.statusCode, 200);

    const caps = await getJson(address.port, `/local-agents/${agentId}/capabilities`) as { advertisements: unknown[] };
    assert.equal(caps.advertisements.length >= 1, true);

    const compatibility = await postJson(address.port, "/local-agents/compatibility/check", {
      providerId: "codex-cli-local",
      agentId,
      command: "codex",
      providerTemplateId: "codex-cli-jsonl",
      parserMode: "jsonl",
      reportedVersion: "0.1.0"
    });
    assert.equal(compatibility.statusCode, 200);

    const created = await postJson(address.port, "/local-agents/invocations", {
      providerId: "codex-cli-local",
      localAgentId: agentId,
      workspaceRef: "workspace_api_v1",
      requiredConsentLevel: "read_only",
      sandboxProfileId: "sandbox_default_deny",
      networkPolicyId: "network_default_deny",
      redactionPolicyId: "redaction_default",
      metadata: {
        requireChannel: true,
        channelId,
        compatibilityRequired: true,
        compatibilityCompatible: true,
        providerTemplateId: "codex-cli-jsonl"
      }
    });
    const invocationId = ((created.body.invocation as Record<string, unknown>).id) as string;
    const consentRequestId = ((created.body.consentRequest as Record<string, unknown>).id) as string;
    const queue = await getJson(address.port, "/local-agents/consent-queue") as { consentRequests: unknown[] };
    assert.equal(queue.consentRequests.length, 1);
    await postJson(address.port, `/local-agents/consent-requests/${consentRequestId}/decision`, { userId: "user_api_v1", decision: "approved_once" });
    await postJson(address.port, `/local-agents/invocations/${invocationId}/dispatch`);
    const streamEvents = await getJson(address.port, `/local-agents/invocations/${invocationId}/stream/events`) as { events: unknown[] };
    assert.equal(streamEvents.events.length >= 3, true);
    const history = await getJson(address.port, "/local-agents/consent-history") as { approved: unknown[] };
    assert.equal(history.approved.length, 1);
    const health = await getJson(address.port, "/health");
    assert.equal((health.localAgentProtocol as { fixtureDaemonSupportEnabled: boolean }).fixtureDaemonSupportEnabled, true);
    assert.equal((health.localAgentProtocol as { mockChannelSupportEnabled: boolean }).mockChannelSupportEnabled, true);
    assert.equal((health.localAgentProtocol as { realTransportEnabled: boolean }).realTransportEnabled, false);
    assert.equal((health.localAgentProtocol as { vendorCliExecutionEnabled: boolean }).vendorCliExecutionEnabled, false);
    assert.equal(JSON.stringify({ started, channelCreated, handshake, streamEvents, health }).includes("sk-api-v1-secret"), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
