import { createId } from "@aichestra/core";
import {
  PolicyService,
  createPolicyContext,
  createPolicyResource,
  createPolicySubject
} from "@aichestra/policy";
import type { PolicyAction, PolicyDecision } from "@aichestra/policy";
import type { SecurityControlService } from "@aichestra/security";

export type LocalAgentRegistrationStatus = "pending" | "connected" | "disconnected" | "revoked" | "unknown";

export type LocalAgentCapabilityKind =
  | "local_cli"
  | "workspace_read"
  | "workspace_write"
  | "shell_execution"
  | "network_access"
  | "secret_access"
  | "stdout_streaming"
  | "stderr_streaming"
  | "json_output"
  | "jsonl_output"
  | "sandbox";

export type LocalAgentCapability = {
  id: string;
  kind: LocalAgentCapabilityKind;
  enabled: boolean;
  policyRequired: boolean;
  metadata: Record<string, unknown>;
};

export type LocalAgentRegistration = {
  id: string;
  userId: string;
  hostId: string;
  displayName: string;
  agentVersion: string;
  platform: string;
  status: LocalAgentRegistrationStatus;
  capabilities: LocalAgentCapability[];
  registeredAt: Date;
  lastSeenAt?: Date;
  metadata: Record<string, unknown>;
};

export type LocalAgentSessionStatus = "active" | "expired" | "revoked" | "disconnected";

export type LocalAgentSession = {
  id: string;
  agentId: string;
  userId: string;
  status: LocalAgentSessionStatus;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  metadata: Record<string, unknown>;
};

export type LocalAgentConsentLevel =
  | "read_only"
  | "workspace_write"
  | "shell_execution"
  | "network_or_secret_access"
  | "danger_full_access";

export type LocalAgentInvocationSignatureStatus = "not_required_mock" | "valid_mock" | "invalid" | "missing";

export type LocalAgentInvocationEnvelope = {
  id: string;
  taskId?: string;
  taskRunId?: string;
  providerId: string;
  localAgentId: string;
  workspaceRef: string;
  instructionSetHash?: string;
  promptRef?: string;
  requiredConsentLevel: LocalAgentConsentLevel;
  sandboxProfileId?: string;
  networkPolicyId?: string;
  redactionPolicyId?: string;
  secretScopeIds: string[];
  timeoutMs: number;
  createdAt: Date;
  signatureStatus: LocalAgentInvocationSignatureStatus;
  metadata: Record<string, unknown>;
};

export type LocalAgentInvocationState =
  | "requested"
  | "awaiting_consent"
  | "consent_denied"
  | "policy_blocked"
  | "dispatched"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "local_agent_unavailable";

export type LocalAgentNormalizedEventSource = "stdout" | "stderr" | "system";

export type LocalAgentNormalizedEventType =
  | "token"
  | "message"
  | "progress"
  | "warning"
  | "error"
  | "final"
  | "metadata";

export type LocalAgentNormalizedEvent = {
  id: string;
  invocationId: string;
  source: LocalAgentNormalizedEventSource;
  type: LocalAgentNormalizedEventType;
  payload: Record<string, unknown>;
  redacted: boolean;
  createdAt: Date;
};

export type LocalAgentInvocation = {
  id: string;
  envelopeId: string;
  state: LocalAgentInvocationState;
  statusReason?: string;
  startedAt?: Date;
  completedAt?: Date;
  exitCode?: number;
  normalizedEvents: LocalAgentNormalizedEvent[];
  redactionApplied: boolean;
  metadata: Record<string, unknown>;
};

export type LocalAgentConsentRequest = {
  id: string;
  invocationId: string;
  userId: string;
  consentLevel: LocalAgentConsentLevel;
  providerId?: string;
  workspaceRef?: string;
  requestedCapabilityKinds: LocalAgentCapabilityKind[];
  timeoutMs?: number;
  safetyNotes: string[];
  reason: string;
  requestedAt: Date;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
};

export type LocalAgentConsentDecisionValue = "approved" | "approved_once" | "approved_for_session" | "denied" | "expired";

export type LocalAgentConsentDecision = {
  id: string;
  consentRequestId: string;
  userId: string;
  decision: LocalAgentConsentDecisionValue;
  reason?: string;
  decidedAt: Date;
  metadata: Record<string, unknown>;
};

export type LocalAgentProtocolAuditEventType =
  | "local_agent_registered"
  | "local_agent_heartbeat"
  | "local_agent_revoked"
  | "local_agent_disconnected"
  | "local_agent_reconnected"
  | "local_agent_fixture_started"
  | "local_agent_fixture_stopped"
  | "local_agent_channel_created"
  | "local_agent_channel_established"
  | "local_agent_channel_revoked"
  | "local_agent_handshake_failed"
  | "local_agent_capability_advertised"
  | "local_agent_compatibility_checked"
  | "local_agent_invocation_requested"
  | "local_agent_invocation_policy_blocked"
  | "local_agent_invocation_awaiting_consent"
  | "local_agent_consent_requested"
  | "local_agent_consent_approved"
  | "local_agent_consent_denied"
  | "local_agent_invocation_dispatched"
  | "local_agent_unavailable"
  | "local_agent_stream_started"
  | "local_agent_stream_event_received"
  | "local_agent_stream_completed"
  | "local_agent_event_received"
  | "local_agent_invocation_completed"
  | "local_agent_invocation_cancelled"
  | "local_agent_invocation_timed_out"
  | "local_agent_output_redacted"
  | "credential_cache_access_denied"
  | "local_cli_direct_execution_blocked";

export type LocalAgentProtocolAuditEvent = {
  id: string;
  eventType: LocalAgentProtocolAuditEventType;
  actorId?: string;
  userId?: string;
  agentId?: string;
  invocationId?: string;
  providerId?: string;
  taskId?: string;
  taskRunId?: string;
  result: "allowed" | "blocked" | "created" | "updated" | "redacted";
  reason?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type LocalAgentRegisterRequest = {
  userId: string;
  hostId: string;
  displayName: string;
  agentVersion: string;
  platform: string;
  status?: LocalAgentRegistrationStatus;
  capabilities?: LocalAgentCapability[];
  metadata?: Record<string, unknown>;
  actorId?: string;
};

export type LocalAgentInvocationEnvelopeRequest = {
  taskId?: string;
  taskRunId?: string;
  providerId: string;
  localAgentId: string;
  workspaceRef: string;
  instructionSetHash?: string;
  promptRef?: string;
  requiredConsentLevel: LocalAgentConsentLevel;
  sandboxProfileId?: string;
  networkPolicyId?: string;
  redactionPolicyId?: string;
  secretScopeIds?: string[];
  timeoutMs?: number;
  signatureStatus?: LocalAgentInvocationSignatureStatus;
  metadata?: Record<string, unknown>;
  actorId?: string;
};

export type LocalAgentInvocationEnvelopeResult = {
  envelope: LocalAgentInvocationEnvelope;
  invocation: LocalAgentInvocation;
};

export type LocalAgentConsentDecisionRequest = {
  consentRequestId: string;
  userId: string;
  decision: LocalAgentConsentDecisionValue;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type LocalAgentChannelKind = "mock_in_memory" | "future_websocket" | "future_grpc" | "future_http_tunnel";
export type LocalAgentChannelStatus = "pending" | "established" | "expired" | "revoked" | "disconnected";
export type LocalAgentHandshakeStatus = "not_started" | "challenge_issued" | "mock_verified" | "failed";
export type LocalAgentHandshakeResponseStatus = "pending" | "mock_valid" | "invalid" | "expired";

export type LocalAgentChannel = {
  id: string;
  agentId: string;
  userId: string;
  channelKind: LocalAgentChannelKind;
  status: LocalAgentChannelStatus;
  handshakeStatus: LocalAgentHandshakeStatus;
  createdAt: Date;
  establishedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  metadata: Record<string, unknown>;
};

export type LocalAgentHandshake = {
  id: string;
  channelId: string;
  agentId: string;
  challenge: string;
  responseStatus: LocalAgentHandshakeResponseStatus;
  issuedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
};

export type LocalAgentCapabilityAdvertisement = {
  id: string;
  agentId: string;
  agentVersion: string;
  platform: string;
  capabilities: LocalAgentCapability[];
  supportedProviderTemplates: string[];
  supportedParserModes: Array<"raw" | "json" | "jsonl" | "ndjson">;
  supportedConsentLevels: LocalAgentConsentLevel[];
  supportedSandboxKinds: string[];
  maxTimeoutMs: number;
  supportsStreaming: boolean;
  supportsCancellation: boolean;
  advertisedAt: Date;
  metadata: Record<string, unknown>;
};

export type LocalCliCompatibilityEntry = {
  id: string;
  vendor: "anthropic" | "openai" | "google" | "custom";
  command: "claude" | "codex" | "gemini" | "custom";
  versionRange: string;
  providerTemplateId: string;
  parserMode: "raw" | "json" | "jsonl" | "ndjson";
  stdoutPolicy: string;
  stderrPolicy: string;
  supported: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
};

export type LocalCliCompatibilityResult = {
  id: string;
  providerId: string;
  agentId: string;
  command: string;
  reportedVersion?: string;
  compatible: boolean;
  reason: string;
  parserMode: "raw" | "json" | "jsonl" | "ndjson";
  warnings: string[];
  checkedAt: Date;
  metadata: Record<string, unknown>;
};

export type LocalAgentInvocationStreamState = "not_started" | "streaming" | "completed" | "failed" | "cancelled";

export type LocalAgentInvocationStream = {
  id: string;
  invocationId: string;
  state: LocalAgentInvocationStreamState;
  eventCount: number;
  startedAt: Date;
  completedAt?: Date;
};

export type LocalAgentStreamEvent = {
  id: string;
  streamId: string;
  invocationId: string;
  sequence: number;
  source: LocalAgentNormalizedEventSource;
  type: LocalAgentNormalizedEventType;
  payloadPreview: Record<string, unknown>;
  redacted: boolean;
  createdAt: Date;
};

export type LocalAgentChannelCreateRequest = {
  agentId: string;
  channelKind?: LocalAgentChannelKind;
  expiresInMs?: number;
  actorId?: string;
  metadata?: Record<string, unknown>;
};

export type LocalAgentHandshakeVerifyRequest = {
  channelId: string;
  response?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
};

export type LocalAgentCapabilityAdvertisementRequest = {
  agentId: string;
  capabilities?: LocalAgentCapability[];
  supportedProviderTemplates?: string[];
  supportedParserModes?: Array<"raw" | "json" | "jsonl" | "ndjson">;
  supportedConsentLevels?: LocalAgentConsentLevel[];
  supportedSandboxKinds?: string[];
  maxTimeoutMs?: number;
  supportsStreaming?: boolean;
  supportsCancellation?: boolean;
  metadata?: Record<string, unknown>;
};

export type LocalCliCompatibilityCheckRequest = {
  providerId: string;
  agentId: string;
  command: string;
  providerTemplateId: string;
  parserMode: "raw" | "json" | "jsonl" | "ndjson";
  reportedVersion?: string;
  metadata?: Record<string, unknown>;
};

export type FixtureLocalAgentStartRequest = {
  userId: string;
  hostId?: string;
  displayName?: string;
  agentVersion?: string;
  platform?: string;
  scenario?: "normal_completion" | "timeout" | "parser_error" | "stderr_progress" | "cancellation";
  metadata?: Record<string, unknown>;
};

export type LocalAgentEventReceiveRequest = {
  invocationId: string;
  source: LocalAgentNormalizedEventSource;
  type: LocalAgentNormalizedEventType;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type LocalAgentCompleteInvocationRequest = {
  invocationId: string;
  exitCode?: number;
  statusReason?: string;
  metadata?: Record<string, unknown>;
};

export type LocalAgentTransportDispatchResult = {
  ok: boolean;
  reason?: string;
  events: Omit<LocalAgentEventReceiveRequest, "invocationId">[];
  exitCode?: number;
  metadata?: Record<string, unknown>;
};

export type LocalAgentTransport = {
  getTransportKind(): "mock_in_memory";
  sendInvocation(envelope: LocalAgentInvocationEnvelope): Promise<LocalAgentTransportDispatchResult>;
  cancelInvocation(invocationId: string): Promise<{ ok: boolean; reason?: string }>;
  streamEvents?(invocationId: string): AsyncIterable<Omit<LocalAgentEventReceiveRequest, "invocationId">>;
};

export type LocalAgentRegistrationRepository = {
  saveRegistration(registration: LocalAgentRegistration): LocalAgentRegistration;
  getRegistration(id: string): LocalAgentRegistration | undefined;
  listRegistrations(filter?: { userId?: string; status?: LocalAgentRegistrationStatus }): LocalAgentRegistration[];
};

export type LocalAgentSessionRepository = {
  saveSession(session: LocalAgentSession): LocalAgentSession;
  getSession(id: string): LocalAgentSession | undefined;
  listSessions(filter?: { agentId?: string; userId?: string; status?: LocalAgentSessionStatus }): LocalAgentSession[];
};

export type LocalAgentEnvelopeRepository = {
  saveEnvelope(envelope: LocalAgentInvocationEnvelope): LocalAgentInvocationEnvelope;
  getEnvelope(id: string): LocalAgentInvocationEnvelope | undefined;
  listEnvelopes(filter?: { taskId?: string; taskRunId?: string; localAgentId?: string; providerId?: string }): LocalAgentInvocationEnvelope[];
};

export type LocalAgentInvocationRepository = {
  saveInvocation(invocation: LocalAgentInvocation): LocalAgentInvocation;
  getInvocation(id: string): LocalAgentInvocation | undefined;
  listInvocations(filter?: { taskId?: string; taskRunId?: string; localAgentId?: string; providerId?: string; state?: LocalAgentInvocationState }): LocalAgentInvocation[];
};

export type LocalAgentConsentRequestRepository = {
  saveConsentRequest(consentRequest: LocalAgentConsentRequest): LocalAgentConsentRequest;
  getConsentRequest(id: string): LocalAgentConsentRequest | undefined;
  listConsentRequests(filter?: { userId?: string; invocationId?: string; pendingOnly?: boolean }): LocalAgentConsentRequest[];
};

export type LocalAgentConsentDecisionRepository = {
  saveConsentDecision(decision: LocalAgentConsentDecision): LocalAgentConsentDecision;
  getConsentDecision(id: string): LocalAgentConsentDecision | undefined;
  listConsentDecisions(filter?: { consentRequestId?: string; userId?: string; decision?: LocalAgentConsentDecisionValue }): LocalAgentConsentDecision[];
};

export type LocalAgentEventRepository = {
  saveEvent(event: LocalAgentNormalizedEvent): LocalAgentNormalizedEvent;
  listEvents(filter?: { invocationId?: string; source?: LocalAgentNormalizedEventSource }): LocalAgentNormalizedEvent[];
};

export type LocalAgentProtocolAuditRepository = {
  appendAuditEvent(event: LocalAgentProtocolAuditEvent): LocalAgentProtocolAuditEvent;
  listAuditEvents(filter?: { agentId?: string; invocationId?: string; providerId?: string; eventType?: LocalAgentProtocolAuditEventType }): LocalAgentProtocolAuditEvent[];
};

export type LocalAgentChannelRepository = {
  saveChannel(channel: LocalAgentChannel): LocalAgentChannel;
  getChannel(id: string): LocalAgentChannel | undefined;
  listChannels(filter?: { agentId?: string; status?: LocalAgentChannelStatus; channelKind?: LocalAgentChannelKind }): LocalAgentChannel[];
};

export type LocalAgentHandshakeRepository = {
  saveHandshake(handshake: LocalAgentHandshake): LocalAgentHandshake;
  getHandshake(id: string): LocalAgentHandshake | undefined;
  listHandshakes(filter?: { channelId?: string; agentId?: string; responseStatus?: LocalAgentHandshakeResponseStatus }): LocalAgentHandshake[];
};

export type LocalAgentCapabilityAdvertisementRepository = {
  saveAdvertisement(advertisement: LocalAgentCapabilityAdvertisement): LocalAgentCapabilityAdvertisement;
  listAdvertisements(filter?: { agentId?: string }): LocalAgentCapabilityAdvertisement[];
};

export type LocalCliCompatibilityRepository = {
  saveEntry(entry: LocalCliCompatibilityEntry): LocalCliCompatibilityEntry;
  listEntries(filter?: { providerTemplateId?: string; command?: string; parserMode?: "raw" | "json" | "jsonl" | "ndjson" }): LocalCliCompatibilityEntry[];
  saveResult(result: LocalCliCompatibilityResult): LocalCliCompatibilityResult;
  listResults(filter?: { agentId?: string; providerId?: string; compatible?: boolean }): LocalCliCompatibilityResult[];
};

export type LocalAgentInvocationStreamRepository = {
  saveStream(stream: LocalAgentInvocationStream): LocalAgentInvocationStream;
  getStream(id: string): LocalAgentInvocationStream | undefined;
  getStreamForInvocation(invocationId: string): LocalAgentInvocationStream | undefined;
  listStreams(filter?: { invocationId?: string; state?: LocalAgentInvocationStreamState }): LocalAgentInvocationStream[];
};

export type LocalAgentStreamEventRepository = {
  saveStreamEvent(event: LocalAgentStreamEvent): LocalAgentStreamEvent;
  listStreamEvents(filter?: { invocationId?: string; streamId?: string; source?: LocalAgentNormalizedEventSource }): LocalAgentStreamEvent[];
};

export type LocalAgentProtocolRepositories = {
  registrations: LocalAgentRegistrationRepository;
  sessions: LocalAgentSessionRepository;
  envelopes: LocalAgentEnvelopeRepository;
  invocations: LocalAgentInvocationRepository;
  consentRequests: LocalAgentConsentRequestRepository;
  consentDecisions: LocalAgentConsentDecisionRepository;
  events: LocalAgentEventRepository;
  audit: LocalAgentProtocolAuditRepository;
  channels: LocalAgentChannelRepository;
  handshakes: LocalAgentHandshakeRepository;
  capabilityAdvertisements: LocalAgentCapabilityAdvertisementRepository;
  compatibility: LocalCliCompatibilityRepository;
  streams: LocalAgentInvocationStreamRepository;
  streamEvents: LocalAgentStreamEventRepository;
};

export class LocalAgentProtocolError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export class InMemoryLocalAgentRegistrationRepository implements LocalAgentRegistrationRepository {
  private readonly registrations = new Map<string, LocalAgentRegistration>();

  saveRegistration(registration: LocalAgentRegistration): LocalAgentRegistration {
    this.registrations.set(registration.id, clone(registration));
    return clone(registration);
  }

  getRegistration(id: string): LocalAgentRegistration | undefined {
    const registration = this.registrations.get(id);
    return registration ? clone(registration) : undefined;
  }

  listRegistrations(filter: { userId?: string; status?: LocalAgentRegistrationStatus } = {}): LocalAgentRegistration[] {
    return [...this.registrations.values()]
      .filter((item) => filter.userId === undefined || item.userId === filter.userId)
      .filter((item) => filter.status === undefined || item.status === filter.status)
      .sort((left, right) => left.registeredAt.getTime() - right.registeredAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalAgentSessionRepository implements LocalAgentSessionRepository {
  private readonly sessions = new Map<string, LocalAgentSession>();

  saveSession(session: LocalAgentSession): LocalAgentSession {
    this.sessions.set(session.id, clone(session));
    return clone(session);
  }

  getSession(id: string): LocalAgentSession | undefined {
    const session = this.sessions.get(id);
    return session ? clone(session) : undefined;
  }

  listSessions(filter: { agentId?: string; userId?: string; status?: LocalAgentSessionStatus } = {}): LocalAgentSession[] {
    return [...this.sessions.values()]
      .filter((item) => filter.agentId === undefined || item.agentId === filter.agentId)
      .filter((item) => filter.userId === undefined || item.userId === filter.userId)
      .filter((item) => filter.status === undefined || item.status === filter.status)
      .sort((left, right) => left.issuedAt.getTime() - right.issuedAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalAgentEnvelopeRepository implements LocalAgentEnvelopeRepository {
  private readonly envelopes = new Map<string, LocalAgentInvocationEnvelope>();

  saveEnvelope(envelope: LocalAgentInvocationEnvelope): LocalAgentInvocationEnvelope {
    this.envelopes.set(envelope.id, clone(envelope));
    return clone(envelope);
  }

  getEnvelope(id: string): LocalAgentInvocationEnvelope | undefined {
    const envelope = this.envelopes.get(id);
    return envelope ? clone(envelope) : undefined;
  }

  listEnvelopes(filter: { taskId?: string; taskRunId?: string; localAgentId?: string; providerId?: string } = {}): LocalAgentInvocationEnvelope[] {
    return [...this.envelopes.values()]
      .filter((item) => filter.taskId === undefined || item.taskId === filter.taskId)
      .filter((item) => filter.taskRunId === undefined || item.taskRunId === filter.taskRunId)
      .filter((item) => filter.localAgentId === undefined || item.localAgentId === filter.localAgentId)
      .filter((item) => filter.providerId === undefined || item.providerId === filter.providerId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalAgentInvocationRepository implements LocalAgentInvocationRepository {
  private readonly invocations = new Map<string, LocalAgentInvocation>();

  saveInvocation(invocation: LocalAgentInvocation): LocalAgentInvocation {
    this.invocations.set(invocation.id, clone(invocation));
    return clone(invocation);
  }

  getInvocation(id: string): LocalAgentInvocation | undefined {
    const invocation = this.invocations.get(id);
    return invocation ? clone(invocation) : undefined;
  }

  listInvocations(filter: { taskId?: string; taskRunId?: string; localAgentId?: string; providerId?: string; state?: LocalAgentInvocationState } = {}): LocalAgentInvocation[] {
    return [...this.invocations.values()]
      .filter((invocation) => {
        if (filter.state !== undefined && invocation.state !== filter.state) return false;
        const envelope = this.envelopeResolver?.(invocation.envelopeId);
        if (!envelope) return filter.taskId === undefined && filter.taskRunId === undefined && filter.localAgentId === undefined && filter.providerId === undefined;
        return (filter.taskId === undefined || envelope.taskId === filter.taskId) &&
          (filter.taskRunId === undefined || envelope.taskRunId === filter.taskRunId) &&
          (filter.localAgentId === undefined || envelope.localAgentId === filter.localAgentId) &&
          (filter.providerId === undefined || envelope.providerId === filter.providerId);
      })
      .sort((left, right) => (left.startedAt?.getTime() ?? 0) - (right.startedAt?.getTime() ?? 0) || left.id.localeCompare(right.id))
      .map(clone);
  }

  setEnvelopeResolver(resolver: (envelopeId: string) => LocalAgentInvocationEnvelope | undefined): void {
    this.envelopeResolver = resolver;
  }

  private envelopeResolver?: (envelopeId: string) => LocalAgentInvocationEnvelope | undefined;
}

export class InMemoryLocalAgentConsentRequestRepository implements LocalAgentConsentRequestRepository {
  private readonly consentRequests = new Map<string, LocalAgentConsentRequest>();
  private readonly decisionResolver?: (consentRequestId: string) => LocalAgentConsentDecision | undefined;

  constructor(decisionResolver?: (consentRequestId: string) => LocalAgentConsentDecision | undefined) {
    this.decisionResolver = decisionResolver;
  }

  saveConsentRequest(consentRequest: LocalAgentConsentRequest): LocalAgentConsentRequest {
    this.consentRequests.set(consentRequest.id, clone(consentRequest));
    return clone(consentRequest);
  }

  getConsentRequest(id: string): LocalAgentConsentRequest | undefined {
    const request = this.consentRequests.get(id);
    return request ? clone(request) : undefined;
  }

  listConsentRequests(filter: { userId?: string; invocationId?: string; pendingOnly?: boolean } = {}): LocalAgentConsentRequest[] {
    return [...this.consentRequests.values()]
      .filter((item) => filter.userId === undefined || item.userId === filter.userId)
      .filter((item) => filter.invocationId === undefined || item.invocationId === filter.invocationId)
      .filter((item) => !filter.pendingOnly || this.decisionResolver?.(item.id) === undefined)
      .sort((left, right) => left.requestedAt.getTime() - right.requestedAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalAgentConsentDecisionRepository implements LocalAgentConsentDecisionRepository {
  private readonly decisions = new Map<string, LocalAgentConsentDecision>();

  saveConsentDecision(decision: LocalAgentConsentDecision): LocalAgentConsentDecision {
    this.decisions.set(decision.id, clone(decision));
    return clone(decision);
  }

  getConsentDecision(id: string): LocalAgentConsentDecision | undefined {
    const decision = this.decisions.get(id);
    return decision ? clone(decision) : undefined;
  }

  listConsentDecisions(filter: { consentRequestId?: string; userId?: string; decision?: LocalAgentConsentDecisionValue } = {}): LocalAgentConsentDecision[] {
    return [...this.decisions.values()]
      .filter((item) => filter.consentRequestId === undefined || item.consentRequestId === filter.consentRequestId)
      .filter((item) => filter.userId === undefined || item.userId === filter.userId)
      .filter((item) => filter.decision === undefined || item.decision === filter.decision)
      .sort((left, right) => left.decidedAt.getTime() - right.decidedAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalAgentEventRepository implements LocalAgentEventRepository {
  private readonly events = new Map<string, LocalAgentNormalizedEvent>();

  saveEvent(event: LocalAgentNormalizedEvent): LocalAgentNormalizedEvent {
    this.events.set(event.id, clone(event));
    return clone(event);
  }

  listEvents(filter: { invocationId?: string; source?: LocalAgentNormalizedEventSource } = {}): LocalAgentNormalizedEvent[] {
    return [...this.events.values()]
      .filter((item) => filter.invocationId === undefined || item.invocationId === filter.invocationId)
      .filter((item) => filter.source === undefined || item.source === filter.source)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalAgentProtocolAuditRepository implements LocalAgentProtocolAuditRepository {
  private readonly events: LocalAgentProtocolAuditEvent[] = [];

  appendAuditEvent(event: LocalAgentProtocolAuditEvent): LocalAgentProtocolAuditEvent {
    this.events.push(clone(event));
    return clone(event);
  }

  listAuditEvents(filter: { agentId?: string; invocationId?: string; providerId?: string; eventType?: LocalAgentProtocolAuditEventType } = {}): LocalAgentProtocolAuditEvent[] {
    return this.events
      .filter((item) => filter.agentId === undefined || item.agentId === filter.agentId)
      .filter((item) => filter.invocationId === undefined || item.invocationId === filter.invocationId)
      .filter((item) => filter.providerId === undefined || item.providerId === filter.providerId)
      .filter((item) => filter.eventType === undefined || item.eventType === filter.eventType)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalAgentChannelRepository implements LocalAgentChannelRepository {
  private readonly channels = new Map<string, LocalAgentChannel>();

  saveChannel(channel: LocalAgentChannel): LocalAgentChannel {
    this.channels.set(channel.id, clone(channel));
    return clone(channel);
  }

  getChannel(id: string): LocalAgentChannel | undefined {
    const channel = this.channels.get(id);
    return channel ? clone(channel) : undefined;
  }

  listChannels(filter: { agentId?: string; status?: LocalAgentChannelStatus; channelKind?: LocalAgentChannelKind } = {}): LocalAgentChannel[] {
    return [...this.channels.values()]
      .filter((item) => filter.agentId === undefined || item.agentId === filter.agentId)
      .filter((item) => filter.status === undefined || item.status === filter.status)
      .filter((item) => filter.channelKind === undefined || item.channelKind === filter.channelKind)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalAgentHandshakeRepository implements LocalAgentHandshakeRepository {
  private readonly handshakes = new Map<string, LocalAgentHandshake>();

  saveHandshake(handshake: LocalAgentHandshake): LocalAgentHandshake {
    this.handshakes.set(handshake.id, clone(handshake));
    return clone(handshake);
  }

  getHandshake(id: string): LocalAgentHandshake | undefined {
    const handshake = this.handshakes.get(id);
    return handshake ? clone(handshake) : undefined;
  }

  listHandshakes(filter: { channelId?: string; agentId?: string; responseStatus?: LocalAgentHandshakeResponseStatus } = {}): LocalAgentHandshake[] {
    return [...this.handshakes.values()]
      .filter((item) => filter.channelId === undefined || item.channelId === filter.channelId)
      .filter((item) => filter.agentId === undefined || item.agentId === filter.agentId)
      .filter((item) => filter.responseStatus === undefined || item.responseStatus === filter.responseStatus)
      .sort((left, right) => left.issuedAt.getTime() - right.issuedAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalAgentCapabilityAdvertisementRepository implements LocalAgentCapabilityAdvertisementRepository {
  private readonly advertisements = new Map<string, LocalAgentCapabilityAdvertisement>();

  saveAdvertisement(advertisement: LocalAgentCapabilityAdvertisement): LocalAgentCapabilityAdvertisement {
    this.advertisements.set(advertisement.id, clone(advertisement));
    return clone(advertisement);
  }

  listAdvertisements(filter: { agentId?: string } = {}): LocalAgentCapabilityAdvertisement[] {
    return [...this.advertisements.values()]
      .filter((item) => filter.agentId === undefined || item.agentId === filter.agentId)
      .sort((left, right) => left.advertisedAt.getTime() - right.advertisedAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalCliCompatibilityRepository implements LocalCliCompatibilityRepository {
  private readonly entries = new Map<string, LocalCliCompatibilityEntry>();
  private readonly results = new Map<string, LocalCliCompatibilityResult>();

  constructor(seed: LocalCliCompatibilityEntry[] = seedLocalCliCompatibilityEntries()) {
    for (const entry of seed) {
      this.entries.set(entry.id, clone(entry));
    }
  }

  saveEntry(entry: LocalCliCompatibilityEntry): LocalCliCompatibilityEntry {
    this.entries.set(entry.id, clone(entry));
    return clone(entry);
  }

  listEntries(filter: { providerTemplateId?: string; command?: string; parserMode?: "raw" | "json" | "jsonl" | "ndjson" } = {}): LocalCliCompatibilityEntry[] {
    return [...this.entries.values()]
      .filter((item) => filter.providerTemplateId === undefined || item.providerTemplateId === filter.providerTemplateId)
      .filter((item) => filter.command === undefined || item.command === filter.command)
      .filter((item) => filter.parserMode === undefined || item.parserMode === filter.parserMode)
      .sort((left, right) => left.providerTemplateId.localeCompare(right.providerTemplateId) || left.id.localeCompare(right.id))
      .map(clone);
  }

  saveResult(result: LocalCliCompatibilityResult): LocalCliCompatibilityResult {
    this.results.set(result.id, clone(result));
    return clone(result);
  }

  listResults(filter: { agentId?: string; providerId?: string; compatible?: boolean } = {}): LocalCliCompatibilityResult[] {
    return [...this.results.values()]
      .filter((item) => filter.agentId === undefined || item.agentId === filter.agentId)
      .filter((item) => filter.providerId === undefined || item.providerId === filter.providerId)
      .filter((item) => filter.compatible === undefined || item.compatible === filter.compatible)
      .sort((left, right) => left.checkedAt.getTime() - right.checkedAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalAgentInvocationStreamRepository implements LocalAgentInvocationStreamRepository {
  private readonly streams = new Map<string, LocalAgentInvocationStream>();

  saveStream(stream: LocalAgentInvocationStream): LocalAgentInvocationStream {
    this.streams.set(stream.id, clone(stream));
    return clone(stream);
  }

  getStream(id: string): LocalAgentInvocationStream | undefined {
    const stream = this.streams.get(id);
    return stream ? clone(stream) : undefined;
  }

  getStreamForInvocation(invocationId: string): LocalAgentInvocationStream | undefined {
    return this.listStreams({ invocationId }).at(-1);
  }

  listStreams(filter: { invocationId?: string; state?: LocalAgentInvocationStreamState } = {}): LocalAgentInvocationStream[] {
    return [...this.streams.values()]
      .filter((item) => filter.invocationId === undefined || item.invocationId === filter.invocationId)
      .filter((item) => filter.state === undefined || item.state === filter.state)
      .sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export class InMemoryLocalAgentStreamEventRepository implements LocalAgentStreamEventRepository {
  private readonly events = new Map<string, LocalAgentStreamEvent>();

  saveStreamEvent(event: LocalAgentStreamEvent): LocalAgentStreamEvent {
    this.events.set(event.id, clone(event));
    return clone(event);
  }

  listStreamEvents(filter: { invocationId?: string; streamId?: string; source?: LocalAgentNormalizedEventSource } = {}): LocalAgentStreamEvent[] {
    return [...this.events.values()]
      .filter((item) => filter.invocationId === undefined || item.invocationId === filter.invocationId)
      .filter((item) => filter.streamId === undefined || item.streamId === filter.streamId)
      .filter((item) => filter.source === undefined || item.source === filter.source)
      .sort((left, right) => left.sequence - right.sequence || left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
      .map(clone);
  }
}

export function createInMemoryLocalAgentProtocolRepositories(): LocalAgentProtocolRepositories {
  const consentDecisions = new InMemoryLocalAgentConsentDecisionRepository();
  const envelopes = new InMemoryLocalAgentEnvelopeRepository();
  const invocations = new InMemoryLocalAgentInvocationRepository();
  invocations.setEnvelopeResolver((envelopeId) => envelopes.getEnvelope(envelopeId));
  return {
    registrations: new InMemoryLocalAgentRegistrationRepository(),
    sessions: new InMemoryLocalAgentSessionRepository(),
    envelopes,
    invocations,
    consentRequests: new InMemoryLocalAgentConsentRequestRepository((consentRequestId) => consentDecisions.listConsentDecisions({ consentRequestId }).at(-1)),
    consentDecisions,
    events: new InMemoryLocalAgentEventRepository(),
    audit: new InMemoryLocalAgentProtocolAuditRepository(),
    channels: new InMemoryLocalAgentChannelRepository(),
    handshakes: new InMemoryLocalAgentHandshakeRepository(),
    capabilityAdvertisements: new InMemoryLocalAgentCapabilityAdvertisementRepository(),
    compatibility: new InMemoryLocalCliCompatibilityRepository(),
    streams: new InMemoryLocalAgentInvocationStreamRepository(),
    streamEvents: new InMemoryLocalAgentStreamEventRepository()
  };
}

export class MockLocalAgentTransport implements LocalAgentTransport {
  getTransportKind(): "mock_in_memory" {
    return "mock_in_memory";
  }

  async sendInvocation(envelope: LocalAgentInvocationEnvelope): Promise<LocalAgentTransportDispatchResult> {
    return {
      ok: true,
      exitCode: 0,
      events: [
        {
          source: "system",
          type: "progress",
          payload: {
            code: "mock_local_agent_dispatched",
            providerId: envelope.providerId,
            workspaceRef: envelope.workspaceRef
          }
        },
        {
          source: "stdout",
          type: "message",
          payload: {
            text: `Mock Local Agent accepted ${envelope.providerId} invocation for ${envelope.workspaceRef}.`
          }
        },
        {
          source: "stderr",
          type: "progress",
          payload: {
            text: "mock progress only; stderr progress is not failure"
          }
        }
      ],
      metadata: {
        transport: "mock_in_memory"
      }
    };
  }

  async cancelInvocation(): Promise<{ ok: boolean; reason?: string }> {
    return { ok: true };
  }
}

export class FixtureLocalAgentDaemon {
  private readonly service: LocalAgentProtocolService;

  constructor(service: LocalAgentProtocolService) {
    this.service = service;
  }

  startFixtureAgent(request: FixtureLocalAgentStartRequest): { agent: LocalAgentRegistration; advertisement: LocalAgentCapabilityAdvertisement } {
    return this.service.startFixtureAgent(request);
  }

  stopFixtureAgent(agentId: string): LocalAgentRegistration {
    return this.service.stopFixtureAgent(agentId);
  }

  connectChannel(agentId: string): { channel: LocalAgentChannel; handshake: LocalAgentHandshake } {
    return this.service.connectChannel(agentId);
  }

  disconnectChannel(agentId: string): LocalAgentChannel | undefined {
    const channel = this.service.getActiveChannel(agentId);
    return channel ? this.service.disconnectChannel(channel.id) : undefined;
  }

  advertiseCapabilities(agentId: string): LocalAgentCapabilityAdvertisement {
    return this.service.advertiseCapabilities({ agentId });
  }

  async receiveInvocation(envelope: LocalAgentInvocationEnvelope): Promise<LocalAgentInvocation> {
    const invocation = this.service.listInvocations({ localAgentId: envelope.localAgentId })
      .find((item) => item.envelopeId === envelope.id);
    if (!invocation) {
      throw new LocalAgentProtocolError("local_agent_invocation_not_found", `Local Agent invocation not found for envelope ${envelope.id}.`);
    }
    return this.service.dispatchInvocation(invocation.id);
  }

  emitFixtureEvents(invocationId: string): LocalAgentStreamEvent[] {
    return this.service.listStreamEvents({ invocationId });
  }

  completeInvocation(invocationId: string): LocalAgentInvocation {
    return this.service.completeInvocation({ invocationId, exitCode: 0, statusReason: "fixture_mock_completed" });
  }
}

export type LocalAgentProtocolServiceInput = {
  repositories?: LocalAgentProtocolRepositories;
  policyService?: PolicyService;
  securityService?: SecurityControlService;
  transport?: LocalAgentTransport;
  now?: () => Date;
};

export class LocalAgentProtocolService {
  private readonly repositories: LocalAgentProtocolRepositories;
  private readonly policyService: PolicyService;
  private readonly securityService?: SecurityControlService;
  private readonly transport: LocalAgentTransport;
  private readonly now: () => Date;

  constructor(input: LocalAgentProtocolServiceInput = {}) {
    this.repositories = input.repositories ?? createInMemoryLocalAgentProtocolRepositories();
    this.policyService = input.policyService ?? new PolicyService();
    this.securityService = input.securityService;
    this.transport = input.transport ?? new MockLocalAgentTransport();
    this.now = input.now ?? (() => new Date());
  }

  getConfig() {
    const agents = this.listAgents();
    const activeChannels = this.listChannels({ status: "established" }).filter((channel) => !isExpired(channel.expiresAt, this.now()));
    return {
      status: "available",
      transportKind: this.transport.getTransportKind(),
      mockTransportEnabled: this.transport.getTransportKind() === "mock_in_memory",
      fixtureDaemonSupportEnabled: true,
      mockChannelSupportEnabled: true,
      registeredAgents: agents.length,
      connectedAgents: agents.filter((agent) => agent.status === "connected").length,
      connectedFixtureAgents: agents.filter((agent) => agent.status === "connected" && isFixtureAgent(agent)).length,
      activeMockChannels: activeChannels.filter((channel) => channel.channelKind === "mock_in_memory").length,
      pendingConsentRequests: this.listConsentRequests({ pendingOnly: true }).length,
      localCliExecutionEnabled: false,
      realTransportEnabled: false,
      vendorCliExecutionEnabled: false,
      credentialCacheAccessAllowed: false
    };
  }

  registerAgent(request: LocalAgentRegisterRequest): LocalAgentRegistration {
    if (!request.userId || !request.hostId || !request.displayName || !request.agentVersion || !request.platform) {
      throw new LocalAgentProtocolError("invalid_local_agent_registration", "userId, hostId, displayName, agentVersion, and platform are required.");
    }
    const registration: LocalAgentRegistration = {
      id: createId("localagent"),
      userId: request.userId,
      hostId: request.hostId,
      displayName: request.displayName,
      agentVersion: request.agentVersion,
      platform: request.platform,
      status: request.status ?? "connected",
      capabilities: sanitizeCapabilities(request.capabilities ?? createDefaultLocalAgentCapabilities()),
      registeredAt: this.now(),
      lastSeenAt: request.status === "disconnected" || request.status === "revoked" ? undefined : this.now(),
      metadata: sanitizeProtocolMetadata(request.metadata ?? {})
    };
    const decision = this.evaluatePolicy({
      action: "local_agent.register",
      actorId: request.actorId ?? request.userId,
      userId: request.userId,
      agentId: registration.id,
      resourceId: registration.id,
      environment: {
        mockRegistration: true,
        status: registration.status
      },
      metadata: {
        source: "local_agent_protocol",
        hostId: registration.hostId
      }
    });
    if (!decision.allowed) {
      throw new LocalAgentProtocolError("local_agent_registration_policy_denied", decision.reason);
    }
    const saved = this.repositories.registrations.saveRegistration(registration);
    if (saved.status === "connected") {
      this.repositories.sessions.saveSession({
        id: createId("localagentsession"),
        agentId: saved.id,
        userId: saved.userId,
        status: "active",
        issuedAt: saved.registeredAt,
        expiresAt: new Date(saved.registeredAt.getTime() + 60 * 60 * 1000),
        metadata: { mock: true }
      });
    }
    this.recordAudit({
      eventType: "local_agent_registered",
      actorId: request.actorId,
      userId: saved.userId,
      agentId: saved.id,
      result: "created",
      metadata: {
        platform: saved.platform,
        capabilityKinds: saved.capabilities.map((capability) => capability.kind),
        policyDecisionId: decision.id
      }
    });
    return saved;
  }

  heartbeat(agentId: string): LocalAgentRegistration {
    const agent = this.getAgentOrThrow(agentId);
    if (agent.status === "revoked") {
      throw new LocalAgentProtocolError("local_agent_revoked", `Local Agent ${agentId} is revoked.`);
    }
    const now = this.now();
    const updated = this.repositories.registrations.saveRegistration({
      ...agent,
      status: "connected",
      lastSeenAt: now
    });
    const activeSession = this.repositories.sessions.listSessions({ agentId, status: "active" }).at(-1);
    if (!activeSession) {
      this.repositories.sessions.saveSession({
        id: createId("localagentsession"),
        agentId: updated.id,
        userId: updated.userId,
        status: "active",
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        metadata: { mock: true }
      });
    }
    this.recordAudit({
      eventType: "local_agent_heartbeat",
      userId: updated.userId,
      agentId,
      result: "updated",
      metadata: { status: updated.status }
    });
    return updated;
  }

  listAgents(filter: { userId?: string; status?: LocalAgentRegistrationStatus } = {}): LocalAgentRegistration[] {
    return this.repositories.registrations.listRegistrations(filter);
  }

  getAgent(agentId: string): LocalAgentRegistration | undefined {
    return this.repositories.registrations.getRegistration(agentId);
  }

  findConnectedAgent(userId?: string): LocalAgentRegistration | undefined {
    return this.listAgents({ userId, status: "connected" }).at(0) ?? this.listAgents({ status: "connected" }).at(0);
  }

  revokeAgent(agentId: string, actorId?: string): LocalAgentRegistration {
    const agent = this.getAgentOrThrow(agentId);
    const decision = this.evaluatePolicy({
      action: "local_agent.revoke",
      actorId: actorId ?? agent.userId,
      userId: agent.userId,
      agentId,
      resourceId: agentId,
      metadata: { source: "local_agent_protocol" }
    });
    if (!decision.allowed) {
      throw new LocalAgentProtocolError("local_agent_revoke_policy_denied", decision.reason);
    }
    const updated = this.repositories.registrations.saveRegistration({
      ...agent,
      status: "revoked"
    });
    for (const session of this.repositories.sessions.listSessions({ agentId, status: "active" })) {
      this.repositories.sessions.saveSession({
        ...session,
        status: "revoked",
        revokedAt: this.now()
      });
    }
    for (const channel of this.repositories.channels.listChannels({ agentId })) {
      if (channel.status === "established" || channel.status === "pending") {
        this.repositories.channels.saveChannel({
          ...channel,
          status: "revoked",
          revokedAt: this.now()
        });
      }
    }
    this.recordAudit({
      eventType: "local_agent_revoked",
      actorId,
      userId: updated.userId,
      agentId,
      result: "updated",
      metadata: { policyDecisionId: decision.id }
    });
    return updated;
  }

  listSessions(filter: { agentId?: string; userId?: string; status?: LocalAgentSessionStatus } = {}): LocalAgentSession[] {
    return this.repositories.sessions.listSessions(filter);
  }

  createChannel(request: LocalAgentChannelCreateRequest): { channel: LocalAgentChannel; handshake: LocalAgentHandshake } {
    const agent = this.getAgentOrThrow(request.agentId);
    const channelKind = request.channelKind ?? "mock_in_memory";
    if (channelKind !== "mock_in_memory") {
      throw new LocalAgentProtocolError("real_local_agent_transport_denied", "Local Agent Protocol v1 supports mock_in_memory channels only.");
    }
    const decision = this.evaluatePolicy({
      action: "local_agent.channel.create",
      actorId: request.actorId ?? agent.userId,
      userId: agent.userId,
      agentId: agent.id,
      resourceId: agent.id,
      environment: { mockTransport: true, realTransport: false },
      metadata: { channelKind, source: "local_agent_protocol" }
    });
    if (!decision.allowed) {
      throw new LocalAgentProtocolError("local_agent_channel_policy_denied", decision.reason);
    }
    const now = this.now();
    const channel = this.repositories.channels.saveChannel({
      id: createId("localagentchannel"),
      agentId: agent.id,
      userId: agent.userId,
      channelKind,
      status: "pending",
      handshakeStatus: "challenge_issued",
      createdAt: now,
      expiresAt: new Date(now.getTime() + (request.expiresInMs ?? 60 * 60 * 1000)),
      metadata: sanitizeProtocolMetadata({
        ...(request.metadata ?? {}),
        mockSignedChannel: true,
        productionCrypto: false
      })
    });
    const handshake = this.repositories.handshakes.saveHandshake({
      id: createId("localagenthandshake"),
      channelId: channel.id,
      agentId: agent.id,
      challenge: `mock-challenge:${channel.id}:${agent.id}`,
      responseStatus: "pending",
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
      metadata: { mockSignatureOnly: true }
    });
    this.recordAudit({
      eventType: "local_agent_channel_created",
      actorId: request.actorId,
      userId: agent.userId,
      agentId: agent.id,
      result: "created",
      metadata: { channelId: channel.id, channelKind, handshakeId: handshake.id, policyDecisionId: decision.id }
    });
    return { channel, handshake };
  }

  verifyHandshake(request: LocalAgentHandshakeVerifyRequest): { channel: LocalAgentChannel; handshake: LocalAgentHandshake } {
    const channel = this.getChannelOrThrow(request.channelId);
    const agent = this.getAgentOrThrow(channel.agentId);
    const handshake = this.repositories.handshakes.listHandshakes({ channelId: channel.id }).at(-1);
    if (!handshake) {
      throw new LocalAgentProtocolError("local_agent_handshake_not_found", `Handshake not found for channel ${channel.id}.`);
    }
    const decision = this.evaluatePolicy({
      action: "local_agent.handshake.verify",
      actorId: request.actorId ?? agent.userId,
      userId: agent.userId,
      agentId: agent.id,
      resourceId: channel.id,
      environment: { mockTransport: channel.channelKind === "mock_in_memory", realTransport: false },
      metadata: { channelKind: channel.channelKind, source: "local_agent_protocol" }
    });
    if (!decision.allowed) {
      throw new LocalAgentProtocolError("local_agent_handshake_policy_denied", decision.reason);
    }
    const now = this.now();
    const expired = isExpired(handshake.expiresAt, now) || isExpired(channel.expiresAt, now);
    const validResponse = request.response === undefined || request.response === `mock:${handshake.challenge}`;
    if (expired || !validResponse) {
      const failedHandshake = this.repositories.handshakes.saveHandshake({
        ...handshake,
        responseStatus: expired ? "expired" : "invalid",
        completedAt: now,
        metadata: sanitizeProtocolMetadata({ ...handshake.metadata, ...(request.metadata ?? {}) })
      });
      const failedChannel = this.repositories.channels.saveChannel({
        ...channel,
        status: expired ? "expired" : channel.status,
        handshakeStatus: "failed"
      });
      this.recordAudit({
        eventType: "local_agent_handshake_failed",
        actorId: request.actorId,
        userId: agent.userId,
        agentId: agent.id,
        result: "blocked",
        reason: expired ? "handshake_expired" : "mock_handshake_invalid",
        metadata: { channelId: channel.id, handshakeId: handshake.id, policyDecisionId: decision.id }
      });
      return { channel: failedChannel, handshake: failedHandshake };
    }
    const verifiedHandshake = this.repositories.handshakes.saveHandshake({
      ...handshake,
      responseStatus: "mock_valid",
      completedAt: now,
      metadata: sanitizeProtocolMetadata({ ...handshake.metadata, ...(request.metadata ?? {}) })
    });
    const established = this.repositories.channels.saveChannel({
      ...channel,
      status: "established",
      handshakeStatus: "mock_verified",
      establishedAt: now
    });
    this.recordAudit({
      eventType: "local_agent_channel_established",
      actorId: request.actorId,
      userId: agent.userId,
      agentId: agent.id,
      result: "allowed",
      metadata: { channelId: established.id, handshakeId: verifiedHandshake.id, policyDecisionId: decision.id }
    });
    return { channel: established, handshake: verifiedHandshake };
  }

  revokeChannel(channelId: string, actorId?: string): LocalAgentChannel {
    const channel = this.getChannelOrThrow(channelId);
    const updated = this.repositories.channels.saveChannel({
      ...channel,
      status: "revoked",
      revokedAt: this.now()
    });
    this.recordAudit({
      eventType: "local_agent_channel_revoked",
      actorId,
      userId: channel.userId,
      agentId: channel.agentId,
      result: "updated",
      metadata: { channelId }
    });
    return updated;
  }

  disconnectChannel(channelId: string, actorId?: string): LocalAgentChannel {
    const channel = this.getChannelOrThrow(channelId);
    const updated = this.repositories.channels.saveChannel({
      ...channel,
      status: "disconnected"
    });
    this.recordAudit({
      eventType: "local_agent_disconnected",
      actorId,
      userId: channel.userId,
      agentId: channel.agentId,
      result: "updated",
      metadata: { channelId }
    });
    return updated;
  }

  listChannels(filter: { agentId?: string; status?: LocalAgentChannelStatus; channelKind?: LocalAgentChannelKind } = {}): LocalAgentChannel[] {
    return this.repositories.channels.listChannels(filter);
  }

  getChannel(channelId: string): LocalAgentChannel | undefined {
    return this.repositories.channels.getChannel(channelId);
  }

  getActiveChannel(agentId: string): LocalAgentChannel | undefined {
    return this.repositories.channels.listChannels({ agentId, status: "established" })
      .filter((channel) => !isExpired(channel.expiresAt, this.now()))
      .at(-1);
  }

  listHandshakes(filter: { channelId?: string; agentId?: string; responseStatus?: LocalAgentHandshakeResponseStatus } = {}): LocalAgentHandshake[] {
    return this.repositories.handshakes.listHandshakes(filter);
  }

  advertiseCapabilities(request: LocalAgentCapabilityAdvertisementRequest): LocalAgentCapabilityAdvertisement {
    const agent = this.getAgentOrThrow(request.agentId);
    const decision = this.evaluatePolicy({
      action: "local_agent.capability.advertise",
      actorId: agent.userId,
      userId: agent.userId,
      agentId: agent.id,
      resourceId: agent.id,
      environment: { mockTransport: true },
      metadata: { source: "local_agent_protocol" }
    });
    if (!decision.allowed) {
      throw new LocalAgentProtocolError("local_agent_capability_policy_denied", decision.reason);
    }
    const advertisement = this.repositories.capabilityAdvertisements.saveAdvertisement({
      id: createId("localagentcapad"),
      agentId: agent.id,
      agentVersion: agent.agentVersion,
      platform: agent.platform,
      capabilities: sanitizeCapabilities(request.capabilities ?? agent.capabilities),
      supportedProviderTemplates: [...(request.supportedProviderTemplates ?? defaultSupportedProviderTemplates())],
      supportedParserModes: [...(request.supportedParserModes ?? ["raw", "json", "jsonl", "ndjson"])],
      supportedConsentLevels: [...(request.supportedConsentLevels ?? ["read_only"])],
      supportedSandboxKinds: [...(request.supportedSandboxKinds ?? ["mock_metadata", "local_fixture"])],
      maxTimeoutMs: request.maxTimeoutMs ?? 120000,
      supportsStreaming: request.supportsStreaming ?? true,
      supportsCancellation: request.supportsCancellation ?? true,
      advertisedAt: this.now(),
      metadata: sanitizeProtocolMetadata(request.metadata ?? {})
    });
    this.repositories.registrations.saveRegistration({
      ...agent,
      capabilities: advertisement.capabilities,
      metadata: sanitizeProtocolMetadata({
        ...agent.metadata,
        latestCapabilityAdvertisementId: advertisement.id
      })
    });
    this.recordAudit({
      eventType: "local_agent_capability_advertised",
      userId: agent.userId,
      agentId: agent.id,
      result: "updated",
      metadata: {
        advertisementId: advertisement.id,
        supportedProviderTemplates: advertisement.supportedProviderTemplates,
        supportedParserModes: advertisement.supportedParserModes,
        policyDecisionId: decision.id
      }
    });
    return advertisement;
  }

  listCapabilityAdvertisements(filter: { agentId?: string } = {}): LocalAgentCapabilityAdvertisement[] {
    return this.repositories.capabilityAdvertisements.listAdvertisements(filter);
  }

  getLatestCapabilityAdvertisement(agentId: string): LocalAgentCapabilityAdvertisement | undefined {
    return this.repositories.capabilityAdvertisements.listAdvertisements({ agentId }).at(-1);
  }

  listCompatibilityEntries(filter: { providerTemplateId?: string; command?: string; parserMode?: "raw" | "json" | "jsonl" | "ndjson" } = {}): LocalCliCompatibilityEntry[] {
    return this.repositories.compatibility.listEntries(filter);
  }

  checkCompatibility(request: LocalCliCompatibilityCheckRequest): LocalCliCompatibilityResult {
    const agent = this.getAgentOrThrow(request.agentId);
    const advertisement = this.getLatestCapabilityAdvertisement(agent.id);
    const entry = this.repositories.compatibility.listEntries({
      providerTemplateId: request.providerTemplateId,
      command: request.command,
      parserMode: request.parserMode
    }).at(0);
    const warnings: string[] = [];
    if (!advertisement) warnings.push("capability_advertisement_missing");
    if (request.command === "pty") warnings.push("pty_future_unstable");
    const templateSupported = advertisement?.supportedProviderTemplates.includes(request.providerTemplateId) ?? !isFixtureAgent(agent);
    const parserSupported = advertisement?.supportedParserModes.includes(request.parserMode) ?? !isFixtureAgent(agent);
    const entrySupported = entry?.supported === true;
    const versionCompatible = entry ? isFixtureVersionCompatible(request.reportedVersion, entry.versionRange) : false;
    const compatible = Boolean(entry && entrySupported && templateSupported && parserSupported && versionCompatible);
    const reason = compatible
      ? "compatible_fixture_template"
      : !entry ? "provider_template_not_in_matrix"
        : !entrySupported ? "provider_template_unsupported"
          : !templateSupported ? "provider_template_not_advertised"
            : !parserSupported ? "parser_mode_not_advertised"
              : "fixture_cli_version_incompatible";
    const decision = this.evaluatePolicy({
      action: "local_agent.compatibility.check",
      actorId: agent.userId,
      userId: agent.userId,
      agentId: agent.id,
      resourceId: request.providerId,
      providerId: request.providerId,
      environment: { mockTransport: true },
      metadata: {
        providerTemplateId: request.providerTemplateId,
        parserMode: request.parserMode,
        compatible
      }
    });
    if (!decision.allowed) {
      throw new LocalAgentProtocolError("local_agent_compatibility_policy_denied", decision.reason);
    }
    const result = this.repositories.compatibility.saveResult({
      id: createId("localagentcompat"),
      providerId: request.providerId,
      agentId: agent.id,
      command: request.command,
      reportedVersion: request.reportedVersion,
      compatible,
      reason,
      parserMode: request.parserMode,
      warnings,
      checkedAt: this.now(),
      metadata: sanitizeProtocolMetadata({
        ...(request.metadata ?? {}),
        providerTemplateId: request.providerTemplateId,
        matrixEntryId: entry?.id,
        policyDecisionId: decision.id
      })
    });
    this.recordAudit({
      eventType: "local_agent_compatibility_checked",
      userId: agent.userId,
      agentId: agent.id,
      providerId: request.providerId,
      result: compatible ? "allowed" : "blocked",
      reason,
      metadata: {
        compatibilityResultId: result.id,
        providerTemplateId: request.providerTemplateId,
        parserMode: request.parserMode,
        warnings,
        policyDecisionId: decision.id
      }
    });
    return result;
  }

  listCompatibilityResults(filter: { agentId?: string; providerId?: string; compatible?: boolean } = {}): LocalCliCompatibilityResult[] {
    return this.repositories.compatibility.listResults(filter);
  }

  startFixtureAgent(request: FixtureLocalAgentStartRequest): { agent: LocalAgentRegistration; advertisement: LocalAgentCapabilityAdvertisement } {
    const agent = this.registerAgent({
      userId: request.userId,
      hostId: request.hostId ?? `fixture_host_${request.userId}`,
      displayName: request.displayName ?? "Fixture Local Agent",
      agentVersion: request.agentVersion ?? "0.1.0-fixture",
      platform: request.platform ?? "fixture-linux-x64",
      status: "connected",
      metadata: {
        ...(request.metadata ?? {}),
        fixtureDaemon: true,
        fixtureScenario: request.scenario ?? "normal_completion",
        noNetworkTransport: true,
        vendorCliExecution: false
      }
    });
    const advertisement = this.advertiseCapabilities({ agentId: agent.id });
    this.recordAudit({
      eventType: "local_agent_fixture_started",
      userId: agent.userId,
      agentId: agent.id,
      result: "created",
      metadata: { scenario: request.scenario ?? "normal_completion", advertisementId: advertisement.id }
    });
    return { agent: this.getAgentOrThrow(agent.id), advertisement };
  }

  stopFixtureAgent(agentId: string): LocalAgentRegistration {
    const agent = this.disconnectAgent(agentId, "fixture_agent_stopped");
    this.recordAudit({
      eventType: "local_agent_fixture_stopped",
      userId: agent.userId,
      agentId,
      result: "updated",
      metadata: { noVendorCliExecuted: true }
    });
    return agent;
  }

  disconnectAgent(agentId: string, reason = "local_agent_disconnected"): LocalAgentRegistration {
    const agent = this.getAgentOrThrow(agentId);
    const updated = this.repositories.registrations.saveRegistration({
      ...agent,
      status: "disconnected"
    });
    for (const session of this.repositories.sessions.listSessions({ agentId, status: "active" })) {
      this.repositories.sessions.saveSession({ ...session, status: "disconnected" });
    }
    for (const channel of this.repositories.channels.listChannels({ agentId, status: "established" })) {
      this.repositories.channels.saveChannel({ ...channel, status: "disconnected" });
    }
    for (const invocation of this.repositories.invocations.listInvocations({ localAgentId: agentId })) {
      if (invocation.state === "running" || invocation.state === "dispatched") {
        this.failInvocationForDisconnect(invocation, reason);
      }
    }
    this.recordAudit({
      eventType: "local_agent_disconnected",
      userId: agent.userId,
      agentId,
      result: "updated",
      reason,
      metadata: {}
    });
    return updated;
  }

  reconnectAgent(agentId: string): LocalAgentRegistration {
    const updated = this.heartbeat(agentId);
    this.recordAudit({
      eventType: "local_agent_reconnected",
      userId: updated.userId,
      agentId,
      result: "updated",
      metadata: {}
    });
    return updated;
  }

  connectChannel(agentId: string): { channel: LocalAgentChannel; handshake: LocalAgentHandshake } {
    const created = this.createChannel({ agentId });
    return this.verifyHandshake({ channelId: created.channel.id, response: `mock:${created.handshake.challenge}` });
  }

  createInvocationEnvelope(request: LocalAgentInvocationEnvelopeRequest): LocalAgentInvocationEnvelopeResult {
    if (!request.providerId || !request.localAgentId || !request.workspaceRef || !request.requiredConsentLevel) {
      throw new LocalAgentProtocolError("invalid_local_agent_invocation_envelope", "providerId, localAgentId, workspaceRef, and requiredConsentLevel are required.");
    }
    if (request.timeoutMs !== undefined && request.timeoutMs <= 0) {
      throw new LocalAgentProtocolError("invalid_local_agent_invocation_timeout", "timeoutMs must be greater than zero.");
    }
    const envelope: LocalAgentInvocationEnvelope = {
      id: createId("localagentenvelope"),
      taskId: request.taskId,
      taskRunId: request.taskRunId,
      providerId: request.providerId,
      localAgentId: request.localAgentId,
      workspaceRef: request.workspaceRef,
      instructionSetHash: request.instructionSetHash,
      promptRef: request.promptRef,
      requiredConsentLevel: request.requiredConsentLevel,
      sandboxProfileId: request.sandboxProfileId,
      networkPolicyId: request.networkPolicyId,
      redactionPolicyId: request.redactionPolicyId,
      secretScopeIds: request.secretScopeIds ?? [],
      timeoutMs: request.timeoutMs ?? 120000,
      createdAt: this.now(),
      signatureStatus: request.signatureStatus ?? "valid_mock",
      metadata: sanitizeProtocolMetadata(request.metadata ?? {})
    };
    const invocation: LocalAgentInvocation = {
      id: createId("localagentinv"),
      envelopeId: envelope.id,
      state: "requested",
      normalizedEvents: [],
      redactionApplied: false,
      metadata: {}
    };
    this.repositories.envelopes.saveEnvelope(envelope);
    const savedInvocation = this.repositories.invocations.saveInvocation(invocation);
    this.recordAudit({
      eventType: "local_agent_invocation_requested",
      actorId: request.actorId,
      agentId: envelope.localAgentId,
      invocationId: savedInvocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "created",
      metadata: {
        consentLevel: envelope.requiredConsentLevel,
        signatureStatus: envelope.signatureStatus,
        sandboxProfileId: envelope.sandboxProfileId,
        networkPolicyId: envelope.networkPolicyId,
        redactionPolicyId: envelope.redactionPolicyId,
        secretScopeCount: envelope.secretScopeIds.length
      }
    });
    return { envelope, invocation: savedInvocation };
  }

  requestConsent(invocationId: string): LocalAgentConsentRequest {
    const invocation = this.getInvocationOrThrow(invocationId);
    const envelope = this.getEnvelopeOrThrow(invocation.envelopeId);
    const agent = this.getAgentOrThrow(envelope.localAgentId);
    if (envelope.requiredConsentLevel === "danger_full_access") {
      this.updateInvocationState(invocation, "policy_blocked", "danger_full_access_denied");
      this.recordAudit({
        eventType: "local_agent_invocation_policy_blocked",
        userId: agent.userId,
        agentId: agent.id,
        invocationId,
        providerId: envelope.providerId,
        taskId: envelope.taskId,
        taskRunId: envelope.taskRunId,
        result: "blocked",
        reason: "danger_full_access_denied",
        metadata: { consentLevel: envelope.requiredConsentLevel }
      });
      throw new LocalAgentProtocolError("danger_full_access_denied", "danger_full_access is denied by default.");
    }
    const existing = this.repositories.consentRequests.listConsentRequests({ invocationId, pendingOnly: true }).at(-1);
    if (existing) return existing;
    const now = this.now();
    const consentRequest = this.repositories.consentRequests.saveConsentRequest({
      id: createId("localagentconsent"),
      invocationId,
      userId: agent.userId,
      consentLevel: envelope.requiredConsentLevel,
      providerId: envelope.providerId,
      workspaceRef: envelope.workspaceRef,
      requestedCapabilityKinds: requestedCapabilitiesForConsent(envelope.requiredConsentLevel),
      timeoutMs: envelope.timeoutMs,
      safetyNotes: safetyNotesForConsent(envelope.requiredConsentLevel),
      reason: consentReasonForLevel(envelope.requiredConsentLevel),
      requestedAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      metadata: {
        providerId: envelope.providerId,
        workspaceRef: envelope.workspaceRef,
        requiredConsentLevel: envelope.requiredConsentLevel,
        timeoutMs: envelope.timeoutMs,
        sandboxProfileId: envelope.sandboxProfileId,
        networkPolicyId: envelope.networkPolicyId,
        redactionPolicyId: envelope.redactionPolicyId
      }
    });
    this.updateInvocationState(invocation, "awaiting_consent", "consent_required");
    this.recordAudit({
      eventType: "local_agent_invocation_awaiting_consent",
      userId: agent.userId,
      agentId: agent.id,
      invocationId,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "blocked",
      reason: "consent_required",
      metadata: { consentRequestId: consentRequest.id, consentLevel: consentRequest.consentLevel }
    });
    this.recordAudit({
      eventType: "local_agent_consent_requested",
      userId: agent.userId,
      agentId: agent.id,
      invocationId,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "created",
      metadata: { consentRequestId: consentRequest.id, consentLevel: consentRequest.consentLevel }
    });
    return consentRequest;
  }

  recordConsentDecision(request: LocalAgentConsentDecisionRequest): LocalAgentConsentDecision {
    const consentRequest = this.repositories.consentRequests.getConsentRequest(request.consentRequestId);
    if (!consentRequest) {
      throw new LocalAgentProtocolError("local_agent_consent_request_not_found", `Consent request not found: ${request.consentRequestId}`);
    }
    const invocation = this.getInvocationOrThrow(consentRequest.invocationId);
    const envelope = this.getEnvelopeOrThrow(invocation.envelopeId);
    const agent = this.getAgentOrThrow(envelope.localAgentId);
    const decisionPolicy = this.evaluatePolicy({
      action: isApprovedConsentDecisionValue(request.decision) ? "local_agent.consent.approve" : "local_agent.consent.request",
      actorId: request.userId,
      userId: consentRequest.userId,
      agentId: agent.id,
      resourceId: agent.id,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      metadata: {
        consentLevel: consentRequest.consentLevel,
        decision: request.decision
      }
    });
    if (!decisionPolicy.allowed) {
      throw new LocalAgentProtocolError("local_agent_consent_policy_denied", decisionPolicy.reason);
    }
    const expired = consentRequest.expiresAt !== undefined && consentRequest.expiresAt.getTime() <= this.now().getTime();
    const decisionValue: LocalAgentConsentDecisionValue = expired ? "expired" : request.decision;
    const decision = this.repositories.consentDecisions.saveConsentDecision({
      id: createId("localagentdecision"),
      consentRequestId: consentRequest.id,
      userId: request.userId,
      decision: decisionValue,
      reason: request.reason,
      decidedAt: this.now(),
      metadata: sanitizeProtocolMetadata(request.metadata ?? {})
    });
    if (!isApprovedConsentDecisionValue(decision.decision)) {
      this.updateInvocationState(invocation, "consent_denied", decision.decision === "expired" ? "consent_expired" : "consent_denied");
    } else {
      this.updateInvocationState(invocation, "awaiting_consent", "consent_approved");
    }
    this.recordAudit({
      eventType: isApprovedConsentDecisionValue(decision.decision) ? "local_agent_consent_approved" : "local_agent_consent_denied",
      actorId: request.userId,
      userId: consentRequest.userId,
      agentId: agent.id,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: isApprovedConsentDecisionValue(decision.decision) ? "allowed" : "blocked",
      reason: decision.decision,
      metadata: {
        consentRequestId: consentRequest.id,
        consentDecision: decision.decision,
        sessionScoped: decision.decision === "approved_for_session",
        policyDecisionId: decisionPolicy.id
      }
    });
    return decision;
  }

  async dispatchInvocation(invocationId: string): Promise<LocalAgentInvocation> {
    const invocation = this.getInvocationOrThrow(invocationId);
    assertDispatchable(invocation);
    const envelope = this.getEnvelopeOrThrow(invocation.envelopeId);
    const agent = this.repositories.registrations.getRegistration(envelope.localAgentId);
    if (!agent || agent.status !== "connected") {
      return this.markUnavailable(invocation, envelope, agent?.status ?? "unregistered_local_agent");
    }
    const session = this.getActiveSession(agent.id);
    if (!session) {
      return this.markUnavailable(invocation, envelope, "local_agent_session_expired");
    }
    const channelGate = this.evaluateChannelGate(envelope, agent);
    if (!channelGate.allowed) {
      return this.markPolicyBlocked(invocation, envelope, channelGate.reason);
    }
    if (envelope.metadata.compatibilityRequired === true && envelope.metadata.compatibilityCompatible !== true) {
      return this.markPolicyBlocked(invocation, envelope, "provider_template_incompatible");
    }

    const gate = this.evaluateDispatchGates(invocation, envelope, agent);
    if (gate.state === "awaiting_consent") {
      this.requestConsent(invocation.id);
      return this.getInvocationOrThrow(invocation.id);
    }
    if (gate.state === "policy_blocked") {
      return this.markPolicyBlocked(invocation, envelope, gate.reason, gate.policyDecision);
    }

    const dispatched = this.repositories.invocations.saveInvocation({
      ...invocation,
      state: "dispatched",
      statusReason: "mock_transport_dispatch_requested",
      startedAt: invocation.startedAt ?? this.now()
    });
    this.recordAudit({
      eventType: "local_agent_invocation_dispatched",
      userId: agent.userId,
      agentId: agent.id,
      invocationId: dispatched.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "allowed",
      metadata: {
        transportKind: this.transport.getTransportKind(),
        policyDecisionId: gate.policyDecision?.id
      }
    });
    this.ensureInvocationStream(dispatched.id);
    const transportResult = await this.transport.sendInvocation(envelope);
    if (!transportResult.ok) {
      return this.markUnavailable(dispatched, envelope, transportResult.reason ?? "mock_transport_unavailable");
    }
    let current = this.repositories.invocations.saveInvocation({
      ...dispatched,
      state: "running",
      statusReason: "mock_transport_running",
      metadata: {
        ...dispatched.metadata,
        transport: sanitizeProtocolMetadata(transportResult.metadata ?? {})
      }
    });
    for (const event of transportResult.events) {
      this.receiveInvocationEvent({
        invocationId: current.id,
        ...event
      });
    }
    current = this.getInvocationOrThrow(current.id);
    return current;
  }

  receiveInvocationEvent(request: LocalAgentEventReceiveRequest): LocalAgentNormalizedEvent {
    const invocation = this.getInvocationOrThrow(request.invocationId);
    if (isTerminalState(invocation.state)) {
      throw new LocalAgentProtocolError("invalid_invocation_transition", `Cannot receive events for ${invocation.state} invocation ${invocation.id}.`);
    }
    const envelope = this.getEnvelopeOrThrow(invocation.envelopeId);
    const agent = this.getAgent(envelope.localAgentId);
    if (agent?.status === "revoked") {
      throw new LocalAgentProtocolError("local_agent_revoked", `Revoked Local Agent ${envelope.localAgentId} cannot emit events.`);
    }
    const decision = this.evaluatePolicy({
      action: "local_agent.stream.receive",
      actorId: agent?.userId,
      userId: agent?.userId,
      agentId: envelope.localAgentId,
      resourceId: envelope.localAgentId,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      environment: { mockTransport: true },
      metadata: { source: request.source, type: request.type }
    });
    if (!decision.allowed) {
      throw new LocalAgentProtocolError("local_agent_stream_policy_denied", decision.reason);
    }
    if (!envelope.redactionPolicyId) {
      const blocked = this.markPolicyBlocked(invocation, envelope, "redaction_policy_required");
      throw new LocalAgentProtocolError("redaction_policy_required", blocked.statusReason ?? "redaction_policy_required");
    }
    const redacted = this.redactPayload(request.payload, envelope);
    const event = this.repositories.events.saveEvent({
      id: createId("localagentevent"),
      invocationId: request.invocationId,
      source: request.source,
      type: request.type,
      payload: redacted.payload,
      redacted: redacted.redactionApplied,
      createdAt: this.now()
    });
    this.saveStreamEvent(invocation.id, event);
    const existingEvents = this.repositories.events.listEvents({ invocationId: invocation.id });
    this.repositories.invocations.saveInvocation({
      ...invocation,
      normalizedEvents: existingEvents,
      redactionApplied: invocation.redactionApplied || redacted.redactionApplied
    });
    this.recordAudit({
      eventType: "local_agent_event_received",
      agentId: envelope.localAgentId,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "updated",
      metadata: {
        source: event.source,
        type: event.type,
        redacted: event.redacted,
        policyDecisionId: decision.id
      }
    });
    if (event.redacted) {
      this.recordAudit({
        eventType: "local_agent_output_redacted",
        agentId: envelope.localAgentId,
        invocationId: invocation.id,
        providerId: envelope.providerId,
        taskId: envelope.taskId,
        taskRunId: envelope.taskRunId,
        result: "redacted",
        metadata: { eventId: event.id, source: event.source }
      });
    }
    return event;
  }

  completeInvocation(request: LocalAgentCompleteInvocationRequest): LocalAgentInvocation {
    const invocation = this.getInvocationOrThrow(request.invocationId);
    if (invocation.state === "completed" || invocation.state === "failed") {
      throw new LocalAgentProtocolError("invalid_invocation_transition", `Cannot complete ${invocation.state} invocation ${invocation.id} again.`);
    }
    if (invocation.state !== "running" && invocation.state !== "dispatched") {
      throw new LocalAgentProtocolError("invalid_invocation_transition", `Cannot complete ${invocation.state} invocation ${invocation.id}.`);
    }
    const envelope = this.getEnvelopeOrThrow(invocation.envelopeId);
    const exitCode = request.exitCode ?? 0;
    const state: LocalAgentInvocationState = exitCode === 0 ? "completed" : "failed";
    const updated = this.repositories.invocations.saveInvocation({
      ...invocation,
      state,
      statusReason: request.statusReason ?? (state === "completed" ? "mock_completed" : `process_exit_${exitCode}`),
      completedAt: this.now(),
      exitCode,
      normalizedEvents: this.repositories.events.listEvents({ invocationId: invocation.id }),
      metadata: {
        ...invocation.metadata,
        ...sanitizeProtocolMetadata(request.metadata ?? {})
      }
    });
    this.completeStream(invocation.id, state === "completed" ? "completed" : "failed");
    this.recordAudit({
      eventType: "local_agent_invocation_completed",
      agentId: envelope.localAgentId,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: state === "completed" ? "allowed" : "blocked",
      reason: updated.statusReason,
      metadata: { exitCode }
    });
    return updated;
  }

  async cancelInvocation(invocationId: string): Promise<LocalAgentInvocation> {
    const invocation = this.getInvocationOrThrow(invocationId);
    if (invocation.state === "completed" || invocation.state === "failed" || invocation.state === "timed_out") {
      throw new LocalAgentProtocolError("invalid_invocation_transition", `Cannot cancel ${invocation.state} invocation ${invocation.id}.`);
    }
    if (invocation.state === "cancelled") {
      throw new LocalAgentProtocolError("invalid_invocation_transition", `Cannot cancel ${invocation.state} invocation ${invocation.id}.`);
    }
    const envelope = this.getEnvelopeOrThrow(invocation.envelopeId);
    const decision = this.evaluatePolicy({
      action: "local_agent.cancel",
      agentId: envelope.localAgentId,
      resourceId: envelope.localAgentId,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      metadata: { source: "local_agent_protocol" }
    });
    if (!decision.allowed) {
      throw new LocalAgentProtocolError("local_agent_cancel_policy_denied", decision.reason);
    }
    if (invocation.state === "dispatched" || invocation.state === "running") {
      await this.transport.cancelInvocation(invocation.id);
    }
    const updated = this.repositories.invocations.saveInvocation({
      ...invocation,
      state: "cancelled",
      statusReason: "cancelled_by_request",
      completedAt: this.now()
    });
    this.completeStream(invocation.id, "cancelled");
    this.recordAudit({
      eventType: "local_agent_invocation_cancelled",
      agentId: envelope.localAgentId,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "updated",
      metadata: { policyDecisionId: decision.id }
    });
    return updated;
  }

  timeoutInvocation(invocationId: string): LocalAgentInvocation {
    const invocation = this.getInvocationOrThrow(invocationId);
    if (isTerminalState(invocation.state)) {
      throw new LocalAgentProtocolError("invalid_invocation_transition", `Cannot time out ${invocation.state} invocation ${invocation.id}.`);
    }
    const envelope = this.getEnvelopeOrThrow(invocation.envelopeId);
    const updated = this.repositories.invocations.saveInvocation({
      ...invocation,
      state: "timed_out",
      statusReason: "invocation_timed_out",
      completedAt: this.now()
    });
    this.completeStream(invocation.id, "failed");
    this.recordAudit({
      eventType: "local_agent_invocation_timed_out",
      agentId: envelope.localAgentId,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "blocked",
      reason: "invocation_timed_out",
      metadata: { timeoutMs: envelope.timeoutMs }
    });
    return updated;
  }

  listInvocations(filter: { taskId?: string; taskRunId?: string; localAgentId?: string; providerId?: string; state?: LocalAgentInvocationState } = {}): LocalAgentInvocation[] {
    return this.repositories.invocations.listInvocations(filter);
  }

  getInvocation(invocationId: string): LocalAgentInvocation | undefined {
    return this.repositories.invocations.getInvocation(invocationId);
  }

  getEnvelope(envelopeId: string): LocalAgentInvocationEnvelope | undefined {
    return this.repositories.envelopes.getEnvelope(envelopeId);
  }

  listConsentRequests(filter: { userId?: string; invocationId?: string; pendingOnly?: boolean } = {}): LocalAgentConsentRequest[] {
    return this.repositories.consentRequests.listConsentRequests(filter);
  }

  listConsentDecisions(filter: { consentRequestId?: string; userId?: string; decision?: LocalAgentConsentDecisionValue } = {}): LocalAgentConsentDecision[] {
    return this.repositories.consentDecisions.listConsentDecisions(filter);
  }

  listEvents(filter: { invocationId?: string; source?: LocalAgentNormalizedEventSource } = {}): LocalAgentNormalizedEvent[] {
    return this.repositories.events.listEvents(filter);
  }

  listStreams(filter: { invocationId?: string; state?: LocalAgentInvocationStreamState } = {}): LocalAgentInvocationStream[] {
    return this.repositories.streams.listStreams(filter);
  }

  getStreamForInvocation(invocationId: string): LocalAgentInvocationStream | undefined {
    return this.repositories.streams.getStreamForInvocation(invocationId);
  }

  listStreamEvents(filter: { invocationId?: string; streamId?: string; source?: LocalAgentNormalizedEventSource } = {}): LocalAgentStreamEvent[] {
    return this.repositories.streamEvents.listStreamEvents(filter);
  }

  listAuditEvents(filter: { agentId?: string; invocationId?: string; providerId?: string; eventType?: LocalAgentProtocolAuditEventType } = {}): LocalAgentProtocolAuditEvent[] {
    return this.repositories.audit.listAuditEvents(filter);
  }

  recordCredentialCacheAccessDenied(input: { actorId?: string; userId?: string; agentId?: string; providerId?: string; reason?: string; metadata?: Record<string, unknown> } = {}): LocalAgentProtocolAuditEvent {
    return this.recordAudit({
      eventType: "credential_cache_access_denied",
      actorId: input.actorId,
      userId: input.userId,
      agentId: input.agentId,
      providerId: input.providerId,
      result: "blocked",
      reason: input.reason ?? "credential_cache_access_denied",
      metadata: input.metadata ?? {}
    });
  }

  recordDirectLocalCliExecutionBlocked(input: { actorId?: string; userId?: string; agentId?: string; providerId?: string; reason?: string; metadata?: Record<string, unknown> } = {}): LocalAgentProtocolAuditEvent {
    return this.recordAudit({
      eventType: "local_cli_direct_execution_blocked",
      actorId: input.actorId,
      userId: input.userId,
      agentId: input.agentId,
      providerId: input.providerId,
      result: "blocked",
      reason: input.reason ?? "aichestra_cloud_must_not_execute_local_cli_directly",
      metadata: input.metadata ?? {}
    });
  }

  private getActiveSession(agentId: string): LocalAgentSession | undefined {
    const active = this.repositories.sessions.listSessions({ agentId, status: "active" }).at(-1);
    if (!active) return undefined;
    if (!isExpired(active.expiresAt, this.now())) return active;
    this.repositories.sessions.saveSession({
      ...active,
      status: "expired"
    });
    this.evaluatePolicy({
      action: "local_agent.session.expire",
      actorId: active.userId,
      userId: active.userId,
      agentId,
      resourceId: active.id,
      metadata: { source: "local_agent_protocol" }
    });
    return undefined;
  }

  private evaluateChannelGate(envelope: LocalAgentInvocationEnvelope, agent: LocalAgentRegistration): { allowed: boolean; reason: string; channel?: LocalAgentChannel } {
    const required = envelope.metadata.requireChannel === true || typeof envelope.metadata.channelId === "string" || isFixtureAgent(agent);
    if (!required) return { allowed: true, reason: "channel_not_required_for_legacy_mock" };
    const channelId = typeof envelope.metadata.channelId === "string" ? envelope.metadata.channelId : undefined;
    const channel = channelId ? this.repositories.channels.getChannel(channelId) : this.getActiveChannel(agent.id);
    if (!channel) return { allowed: false, reason: "channel_required" };
    if (channel.agentId !== agent.id) return { allowed: false, reason: "channel_agent_mismatch" };
    if (channel.status !== "established") return { allowed: false, reason: `channel_${channel.status}` };
    if (channel.handshakeStatus !== "mock_verified") return { allowed: false, reason: "mock_handshake_required" };
    if (isExpired(channel.expiresAt, this.now())) {
      this.repositories.channels.saveChannel({ ...channel, status: "expired" });
      return { allowed: false, reason: "channel_expired" };
    }
    return { allowed: true, reason: "channel_established", channel };
  }

  private ensureInvocationStream(invocationId: string): LocalAgentInvocationStream {
    const existing = this.repositories.streams.getStreamForInvocation(invocationId);
    if (existing) return existing;
    const stream = this.repositories.streams.saveStream({
      id: createId("localagentstream"),
      invocationId,
      state: "streaming",
      eventCount: 0,
      startedAt: this.now()
    });
    const invocation = this.getInvocationOrThrow(invocationId);
    const envelope = this.getEnvelopeOrThrow(invocation.envelopeId);
    this.recordAudit({
      eventType: "local_agent_stream_started",
      agentId: envelope.localAgentId,
      invocationId,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "created",
      metadata: { streamId: stream.id }
    });
    return stream;
  }

  private saveStreamEvent(invocationId: string, event: LocalAgentNormalizedEvent): LocalAgentStreamEvent {
    const stream = this.ensureInvocationStream(invocationId);
    const nextSequence = this.repositories.streamEvents.listStreamEvents({ streamId: stream.id }).length + 1;
    const streamEvent = this.repositories.streamEvents.saveStreamEvent({
      id: createId("localagentstreamevent"),
      streamId: stream.id,
      invocationId,
      sequence: nextSequence,
      source: event.source,
      type: event.type,
      payloadPreview: event.payload,
      redacted: event.redacted,
      createdAt: event.createdAt
    });
    this.repositories.streams.saveStream({
      ...stream,
      state: stream.state === "not_started" ? "streaming" : stream.state,
      eventCount: nextSequence
    });
    const invocation = this.getInvocationOrThrow(invocationId);
    const envelope = this.getEnvelopeOrThrow(invocation.envelopeId);
    this.recordAudit({
      eventType: "local_agent_stream_event_received",
      agentId: envelope.localAgentId,
      invocationId,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "updated",
      metadata: {
        streamId: stream.id,
        sequence: streamEvent.sequence,
        source: streamEvent.source,
        type: streamEvent.type,
        redacted: streamEvent.redacted
      }
    });
    return streamEvent;
  }

  private completeStream(invocationId: string, state: Exclude<LocalAgentInvocationStreamState, "not_started" | "streaming">): void {
    const stream = this.repositories.streams.getStreamForInvocation(invocationId);
    if (!stream || stream.state === "completed" || stream.state === "failed" || stream.state === "cancelled") return;
    const updated = this.repositories.streams.saveStream({
      ...stream,
      state,
      eventCount: this.repositories.streamEvents.listStreamEvents({ streamId: stream.id }).length,
      completedAt: this.now()
    });
    const invocation = this.getInvocationOrThrow(invocationId);
    const envelope = this.getEnvelopeOrThrow(invocation.envelopeId);
    this.recordAudit({
      eventType: "local_agent_stream_completed",
      agentId: envelope.localAgentId,
      invocationId,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: state === "completed" ? "allowed" : "blocked",
      reason: state,
      metadata: { streamId: updated.id, eventCount: updated.eventCount }
    });
  }

  private failInvocationForDisconnect(invocation: LocalAgentInvocation, reason: string): LocalAgentInvocation {
    const envelope = this.getEnvelopeOrThrow(invocation.envelopeId);
    const updated = this.repositories.invocations.saveInvocation({
      ...invocation,
      state: "failed",
      statusReason: reason,
      completedAt: this.now(),
      normalizedEvents: this.repositories.events.listEvents({ invocationId: invocation.id })
    });
    this.completeStream(invocation.id, "failed");
    this.recordAudit({
      eventType: "local_agent_invocation_completed",
      agentId: envelope.localAgentId,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "blocked",
      reason,
      metadata: { disconnected: true }
    });
    return updated;
  }

  private evaluateDispatchGates(invocation: LocalAgentInvocation, envelope: LocalAgentInvocationEnvelope, agent: LocalAgentRegistration): {
    state: "allowed" | "awaiting_consent" | "policy_blocked";
    reason?: string;
    policyDecision?: PolicyDecision;
  } {
    if (envelope.signatureStatus === "invalid" || envelope.signatureStatus === "missing") {
      return { state: "policy_blocked", reason: `signature_${envelope.signatureStatus}` };
    }
    if (envelope.requiredConsentLevel === "danger_full_access") {
      const decision = this.evaluateCapabilityPolicy("local_cli.danger_full_access", envelope, agent, "danger_full_access_denied");
      return { state: "policy_blocked", reason: "danger_full_access_denied", policyDecision: decision };
    }
    if (envelope.requiredConsentLevel === "network_or_secret_access") {
      const decision = this.evaluateCapabilityPolicy("local_cli.network_access", envelope, agent, "network_or_secret_access_denied");
      return { state: "policy_blocked", reason: "network_or_secret_access_denied", policyDecision: decision };
    }
    if (envelope.requiredConsentLevel === "shell_execution") {
      const decision = this.evaluateCapabilityPolicy("local_cli.shell_execution", envelope, agent, "shell_execution_denied");
      return { state: "policy_blocked", reason: "shell_execution_denied", policyDecision: decision };
    }
    if (envelope.requiredConsentLevel === "workspace_write") {
      const decision = this.evaluateCapabilityPolicy("local_cli.file_write", envelope, agent, "workspace_write_denied");
      return { state: "policy_blocked", reason: "workspace_write_denied", policyDecision: decision };
    }
    if (envelope.secretScopeIds.length > 0) {
      const decision = this.evaluateCapabilityPolicy("local_agent.secret.forward", envelope, agent, "secret_forwarding_denied");
      return { state: "policy_blocked", reason: "secret_forwarding_denied", policyDecision: decision };
    }
    if (requiresSandboxProfile(envelope) && !envelope.sandboxProfileId) {
      return { state: "policy_blocked", reason: "sandbox_profile_required" };
    }
    if (envelope.sandboxProfileId && this.securityService) {
      const profile = this.securityService.listSandboxProfiles().find((item) => item.id === envelope.sandboxProfileId);
      if (!profile || profile.status !== "active") {
        return { state: "policy_blocked", reason: "sandbox_profile_unavailable" };
      }
      const sandbox = this.securityService.createSandboxSession({
        profileId: envelope.sandboxProfileId,
        taskId: envelope.taskId,
        taskRunId: envelope.taskRunId,
        actorId: agent.userId,
        runnerKind: "local_agent_protocol",
        workspaceId: envelope.workspaceRef,
        metadata: {
          invocationId: invocation.id,
          providerId: envelope.providerId
        }
      });
      if (!sandbox.decision.allowed) {
        return { state: "policy_blocked", reason: sandbox.decision.reason };
      }
    }
    if (!envelope.redactionPolicyId) {
      return { state: "policy_blocked", reason: "redaction_policy_required" };
    }
    if (envelope.redactionPolicyId && this.securityService) {
      const redactionPolicy = this.securityService.listRedactionPolicies().find((item) => item.id === envelope.redactionPolicyId);
      if (!redactionPolicy || redactionPolicy.status !== "active") {
        return { state: "policy_blocked", reason: "redaction_policy_unavailable" };
      }
    }

    const approvedConsent = this.getApprovedConsent(invocation.id);
    if (envelope.metadata.compatibilityRequired === true && typeof envelope.metadata.providerTemplateId === "string") {
      const templateDecision = this.evaluatePolicy({
        action: "local_cli.template.use",
        actorId: agent.userId,
        userId: agent.userId,
        agentId: agent.id,
        resourceId: envelope.providerId,
        invocationId: invocation.id,
        providerId: envelope.providerId,
        taskId: envelope.taskId,
        taskRunId: envelope.taskRunId,
        environment: {
          mockTransport: this.transport.getTransportKind() === "mock_in_memory"
        },
        metadata: {
          providerTemplateId: envelope.metadata.providerTemplateId,
          compatible: envelope.metadata.compatibilityCompatible === true,
          consentApproved: approvedConsent !== undefined
        }
      });
      if (!templateDecision.allowed) {
        if (templateDecision.decision === "require_approval" && !approvedConsent) {
          return { state: "awaiting_consent", reason: "consent_required_for_template_use", policyDecision: templateDecision };
        }
        return { state: "policy_blocked", reason: templateDecision.reason, policyDecision: templateDecision };
      }
    }
    const decision = this.evaluatePolicy({
      action: "local_agent.invoke",
      actorId: agent.userId,
      userId: agent.userId,
      agentId: agent.id,
      resourceId: agent.id,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      environment: {
        localAgentConnected: true,
        mockTransport: this.transport.getTransportKind() === "mock_in_memory"
      },
      metadata: {
        consentLevel: envelope.requiredConsentLevel,
        consentApproved: approvedConsent !== undefined,
        agentStatus: agent.status
      }
    });
    if (decision.allowed) return { state: "allowed", policyDecision: decision };
    if (decision.decision === "require_approval" && !approvedConsent) {
      return { state: "awaiting_consent", reason: "consent_required", policyDecision: decision };
    }
    return { state: "policy_blocked", reason: decision.reason, policyDecision: decision };
  }

  private evaluateCapabilityPolicy(action: PolicyAction, envelope: LocalAgentInvocationEnvelope, agent: LocalAgentRegistration, reason: string): PolicyDecision {
    return this.evaluatePolicy({
      action,
      actorId: agent.userId,
      userId: agent.userId,
      agentId: agent.id,
      resourceId: envelope.providerId,
      invocationId: undefined,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      metadata: {
        reason,
        consentLevel: envelope.requiredConsentLevel
      }
    });
  }

  private evaluatePolicy(input: {
    action: PolicyAction;
    actorId?: string;
    userId?: string;
    agentId?: string;
    resourceId?: string;
    invocationId?: string;
    providerId?: string;
    taskId?: string;
    taskRunId?: string;
    environment?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): PolicyDecision {
    return this.policyService.evaluate({
      subject: createPolicySubject({
        actorId: input.actorId ?? "mock-local-agent-protocol",
        actorKind: input.actorId ? "user" : "service",
        roles: ["system"]
      }),
      action: input.action,
      resource: createPolicyResource({
        resourceKind: input.action.startsWith("local_cli.") ? "local_cli" : "local_agent",
        resourceId: input.resourceId ?? input.agentId,
        metadata: sanitizeProtocolMetadata({
          status: input.agentId ? this.getAgent(input.agentId)?.status : undefined,
          providerId: input.providerId,
          ...input.metadata
        })
      }),
      context: createPolicyContext({
        taskId: input.taskId,
        taskRunId: input.taskRunId,
        providerKind: "local_cli",
        environment: input.environment ?? {},
        metadata: sanitizeProtocolMetadata({
          source: "local_agent_protocol",
          agentId: input.agentId,
          invocationId: input.invocationId,
          providerId: input.providerId,
          ...input.metadata
        })
      })
    });
  }

  private markUnavailable(invocation: LocalAgentInvocation, envelope: LocalAgentInvocationEnvelope, reason: string): LocalAgentInvocation {
    const updated = this.repositories.invocations.saveInvocation({
      ...invocation,
      state: "local_agent_unavailable",
      statusReason: reason,
      completedAt: this.now()
    });
    this.completeStream(invocation.id, "failed");
    this.recordAudit({
      eventType: "local_agent_unavailable",
      agentId: envelope.localAgentId,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "blocked",
      reason,
      metadata: {}
    });
    return updated;
  }

  private markPolicyBlocked(invocation: LocalAgentInvocation, envelope: LocalAgentInvocationEnvelope, reason = "policy_blocked", policyDecision?: PolicyDecision): LocalAgentInvocation {
    const updated = this.repositories.invocations.saveInvocation({
      ...invocation,
      state: "policy_blocked",
      statusReason: reason,
      completedAt: this.now()
    });
    this.completeStream(invocation.id, "failed");
    this.recordAudit({
      eventType: "local_agent_invocation_policy_blocked",
      agentId: envelope.localAgentId,
      invocationId: invocation.id,
      providerId: envelope.providerId,
      taskId: envelope.taskId,
      taskRunId: envelope.taskRunId,
      result: "blocked",
      reason,
      metadata: {
        policyDecisionId: policyDecision?.id,
        matchedRuleIds: policyDecision?.matchedRuleIds
      }
    });
    return updated;
  }

  private updateInvocationState(invocation: LocalAgentInvocation, state: LocalAgentInvocationState, statusReason: string): LocalAgentInvocation {
    return this.repositories.invocations.saveInvocation({
      ...invocation,
      state,
      statusReason,
      completedAt: isTerminalState(state) ? this.now() : invocation.completedAt
    });
  }

  private getApprovedConsent(invocationId: string): LocalAgentConsentDecision | undefined {
    const consentRequests = this.repositories.consentRequests.listConsentRequests({ invocationId });
    const invocation = this.repositories.invocations.getInvocation(invocationId);
    const envelope = invocation ? this.repositories.envelopes.getEnvelope(invocation.envelopeId) : undefined;
    for (const consentRequest of consentRequests.toReversed()) {
      const decision = this.repositories.consentDecisions.listConsentDecisions({ consentRequestId: consentRequest.id }).at(-1);
      if (!decision) continue;
      if (!isApprovedConsentDecisionValue(decision.decision)) continue;
      if (consentRequest.expiresAt && consentRequest.expiresAt.getTime() <= this.now().getTime()) continue;
      if (decision.decision === "approved_for_session" && envelope && !this.getActiveSession(envelope.localAgentId)) continue;
      return decision;
    }
    return undefined;
  }

  private redactPayload(payload: Record<string, unknown>, envelope: LocalAgentInvocationEnvelope): { payload: Record<string, unknown>; redactionApplied: boolean } {
    let redactionApplied = false;
    const redactValue = (value: unknown): unknown => {
      if (typeof value === "string") {
        const result = this.securityService?.redactText({
          text: value,
          policyId: envelope.redactionPolicyId,
          taskId: envelope.taskId,
          taskRunId: envelope.taskRunId,
          metadata: { source: "local_agent_protocol" }
        });
        const redacted = result?.preview ?? limitBytes(applyLocalRedaction(value), 512);
        redactionApplied ||= redacted !== value;
        return redacted;
      }
      if (Array.isArray(value)) return value.map(redactValue);
      if (typeof value === "object" && value !== null) {
        const output: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value)) {
          output[key] = /token|secret|key|credential|prompt/i.test(key) ? "[redacted]" : redactValue(item);
          redactionApplied ||= output[key] !== item;
        }
        return output;
      }
      return value;
    };
    return {
      payload: redactValue(payload) as Record<string, unknown>,
      redactionApplied
    };
  }

  private getAgentOrThrow(agentId: string): LocalAgentRegistration {
    const agent = this.repositories.registrations.getRegistration(agentId);
    if (!agent) throw new LocalAgentProtocolError("local_agent_not_found", `Local Agent not found: ${agentId}`);
    return agent;
  }

  private getInvocationOrThrow(invocationId: string): LocalAgentInvocation {
    const invocation = this.repositories.invocations.getInvocation(invocationId);
    if (!invocation) throw new LocalAgentProtocolError("local_agent_invocation_not_found", `Local Agent invocation not found: ${invocationId}`);
    return invocation;
  }

  private getEnvelopeOrThrow(envelopeId: string): LocalAgentInvocationEnvelope {
    const envelope = this.repositories.envelopes.getEnvelope(envelopeId);
    if (!envelope) throw new LocalAgentProtocolError("local_agent_envelope_not_found", `Local Agent envelope not found: ${envelopeId}`);
    return envelope;
  }

  private getChannelOrThrow(channelId: string): LocalAgentChannel {
    const channel = this.repositories.channels.getChannel(channelId);
    if (!channel) throw new LocalAgentProtocolError("local_agent_channel_not_found", `Local Agent channel not found: ${channelId}`);
    return channel;
  }

  private recordAudit(input: Omit<LocalAgentProtocolAuditEvent, "id" | "createdAt">): LocalAgentProtocolAuditEvent {
    return this.repositories.audit.appendAuditEvent({
      id: createId("localagentaudit"),
      createdAt: this.now(),
      ...input,
      metadata: sanitizeProtocolMetadata(input.metadata)
    });
  }
}

export function createDefaultLocalAgentCapabilities(): LocalAgentCapability[] {
  const capability = (kind: LocalAgentCapabilityKind, enabled: boolean, policyRequired = true): LocalAgentCapability => ({
    id: `cap_${kind}`,
    kind,
    enabled,
    policyRequired,
    metadata: {}
  });
  return [
    capability("local_cli", true),
    capability("workspace_read", true),
    capability("workspace_write", false),
    capability("shell_execution", false),
    capability("network_access", false),
    capability("secret_access", false),
    capability("stdout_streaming", true, false),
    capability("stderr_streaming", true, false),
    capability("json_output", true, false),
    capability("jsonl_output", true, false),
    capability("sandbox", true)
  ];
}

export function seedLocalCliCompatibilityEntries(): LocalCliCompatibilityEntry[] {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const entry = (input: Omit<LocalCliCompatibilityEntry, "createdAt" | "updatedAt" | "versionRange" | "stdoutPolicy" | "stderrPolicy" | "supported" | "notes"> & Partial<Pick<LocalCliCompatibilityEntry, "versionRange" | "stdoutPolicy" | "stderrPolicy" | "supported" | "notes">>): LocalCliCompatibilityEntry => ({
    versionRange: ">=0.0.0 <2.0.0",
    stdoutPolicy: "normalized_preview_only",
    stderrPolicy: "progress_not_failure",
    supported: true,
    notes: "Fixture metadata only; no CLI version detection or command execution.",
    createdAt: now,
    updatedAt: now,
    ...input
  });
  return [
    entry({ id: "compat_claude_code_headless_json", vendor: "anthropic", command: "claude", providerTemplateId: "claude-code-headless-json", parserMode: "json" }),
    entry({ id: "compat_claude_code_stream_json", vendor: "anthropic", command: "claude", providerTemplateId: "claude-code-stream-json", parserMode: "jsonl" }),
    entry({ id: "compat_codex_cli_headless", vendor: "openai", command: "codex", providerTemplateId: "codex-cli-headless", parserMode: "raw" }),
    entry({ id: "compat_codex_cli_jsonl", vendor: "openai", command: "codex", providerTemplateId: "codex-cli-jsonl", parserMode: "jsonl" }),
    entry({ id: "compat_gemini_cli_json", vendor: "google", command: "gemini", providerTemplateId: "gemini-cli-json", parserMode: "json" }),
    entry({
      id: "compat_pty_future_unstable",
      vendor: "custom",
      command: "custom",
      providerTemplateId: "pty-interactive-fallback",
      parserMode: "raw",
      supported: false,
      notes: "PTY is future-only and unsupported in Local Agent Protocol v1."
    })
  ];
}

export function parseLocalAgentStructuredOutput(input: {
  invocationId: string;
  source: LocalAgentNormalizedEventSource;
  mode: "raw" | "json" | "jsonl" | "ndjson";
  text: string;
}): { ok: boolean; events: Omit<LocalAgentNormalizedEvent, "id" | "createdAt">[]; error?: string } {
  try {
    if (input.mode === "raw") {
      return {
        ok: true,
        events: [{ invocationId: input.invocationId, source: input.source, type: "final", payload: { text: input.text }, redacted: false }]
      };
    }
    if (input.mode === "json") {
      return {
        ok: true,
        events: [{ invocationId: input.invocationId, source: input.source, type: "final", payload: { json: JSON.parse(input.text) as unknown }, redacted: false }]
      };
    }
    const events = input.text
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line): Omit<LocalAgentNormalizedEvent, "id" | "createdAt"> => ({
        invocationId: input.invocationId,
        source: input.source,
        type: "message",
        payload: { json: JSON.parse(line) as unknown },
        redacted: false
      }));
    return { ok: true, events };
  } catch (error) {
    return {
      ok: false,
      events: [{
        invocationId: input.invocationId,
        source: "system",
        type: "error",
        payload: { code: "local_agent_output_parse_error", message: error instanceof Error ? error.message : "parse_error" },
        redacted: false
      }],
      error: error instanceof Error ? error.message : "parse_error"
    };
  }
}

function sanitizeCapabilities(capabilities: LocalAgentCapability[]): LocalAgentCapability[] {
  return capabilities.map((capability) => ({
    ...capability,
    metadata: sanitizeProtocolMetadata(capability.metadata)
  }));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function consentReasonForLevel(level: LocalAgentConsentLevel): string {
  if (level === "read_only") return "Read-only Local Agent invocation requires user consent.";
  if (level === "workspace_write") return "Workspace write Local Agent invocation requires explicit approval.";
  if (level === "shell_execution") return "Shell execution is denied by default and requires future policy.";
  if (level === "network_or_secret_access") return "Network or secret access is denied by default.";
  return "danger_full_access is denied by default.";
}

function requestedCapabilitiesForConsent(level: LocalAgentConsentLevel): LocalAgentCapabilityKind[] {
  if (level === "read_only") return ["local_cli", "workspace_read", "stdout_streaming", "stderr_streaming", "sandbox"];
  if (level === "workspace_write") return ["local_cli", "workspace_read", "workspace_write", "stdout_streaming", "stderr_streaming", "sandbox"];
  if (level === "shell_execution") return ["local_cli", "workspace_read", "shell_execution", "stdout_streaming", "stderr_streaming", "sandbox"];
  if (level === "network_or_secret_access") return ["local_cli", "workspace_read", "network_access", "secret_access", "stdout_streaming", "stderr_streaming", "sandbox"];
  return ["local_cli", "workspace_read", "workspace_write", "shell_execution", "network_access", "secret_access", "stdout_streaming", "stderr_streaming", "sandbox"];
}

function safetyNotesForConsent(level: LocalAgentConsentLevel): string[] {
  if (level === "read_only") return ["mock_fixture_only", "no_vendor_cli_execution", "no_credential_cache_access", "no_secret_forwarding"];
  if (level === "workspace_write") return ["workspace_write_denied_by_default_in_v1", "no_vendor_cli_execution"];
  if (level === "shell_execution") return ["shell_execution_denied_by_default_in_v1", "no_pty", "no_vendor_cli_execution"];
  if (level === "network_or_secret_access") return ["network_and_secret_access_denied_by_default_in_v1", "no_secret_lease_issued"];
  return ["danger_full_access_denied_regardless_of_user_approval"];
}

function isApprovedConsentDecisionValue(value: LocalAgentConsentDecisionValue): boolean {
  return value === "approved" || value === "approved_once" || value === "approved_for_session";
}

function defaultSupportedProviderTemplates(): string[] {
  return seedLocalCliCompatibilityEntries().filter((entry) => entry.supported).map((entry) => entry.providerTemplateId);
}

function isFixtureAgent(agent: LocalAgentRegistration): boolean {
  return agent.metadata.fixtureDaemon === true;
}

function isExpired(expiresAt: Date | undefined, now: Date): boolean {
  return expiresAt !== undefined && expiresAt.getTime() <= now.getTime();
}

function isFixtureVersionCompatible(reportedVersion: string | undefined, range: string): boolean {
  if (!reportedVersion) return true;
  if (/unsupported|invalid/i.test(reportedVersion)) return false;
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(reportedVersion);
  if (!match) return true;
  const major = Number(match[1]);
  if (range.includes("<2.0.0") && major >= 2) return false;
  return true;
}

function isTerminalState(state: LocalAgentInvocationState): boolean {
  return state === "completed" ||
    state === "failed" ||
    state === "cancelled" ||
    state === "timed_out" ||
    state === "consent_denied" ||
    state === "policy_blocked" ||
    state === "local_agent_unavailable";
}

function assertDispatchable(invocation: LocalAgentInvocation): void {
  if (invocation.state === "completed" || invocation.state === "failed" || invocation.state === "cancelled" || invocation.state === "timed_out") {
    throw new LocalAgentProtocolError("invalid_invocation_transition", `Cannot dispatch ${invocation.state} invocation ${invocation.id}.`);
  }
  if (invocation.state === "policy_blocked" || invocation.state === "consent_denied" || invocation.state === "local_agent_unavailable") {
    throw new LocalAgentProtocolError("invalid_invocation_transition", `Cannot dispatch blocked invocation ${invocation.id}.`);
  }
}

function requiresSandboxProfile(envelope: LocalAgentInvocationEnvelope): boolean {
  return envelope.providerId.endsWith("-local") || envelope.metadata.requiresSandbox === true;
}

function sanitizeProtocolMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitizeValue = (key: string, value: unknown): unknown => {
    if (/token|secret|key|credential|prompt/i.test(key)) return "[redacted]";
    if (typeof value === "string") {
      if (looksSensitive(value)) return "[redacted]";
      return applyLocalRedaction(value);
    }
    if (Array.isArray(value)) return value.map((item) => sanitizeValue("", item));
    if (typeof value === "object" && value !== null) {
      const output: Record<string, unknown> = {};
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        output[nestedKey] = sanitizeValue(nestedKey, nestedValue);
      }
      return output;
    }
    return value;
  };
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    output[key] = sanitizeValue(key, value);
  }
  return output;
}

function applyLocalRedaction(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(sk-[A-Za-z0-9_-]{8,})\b/g, "[redacted-api-key]")
    .replace(/\b(AIza[0-9A-Za-z_-]{8,})\b/g, "[redacted-api-key]")
    .replace(/\b((?:OPENAI|ANTHROPIC|AICHESTRA_LLM|LLM|GITHUB|GOOGLE_APPLICATION)_API_KEY)\s*=\s*[^\s]+/gi, "$1=[redacted]")
    .replace(/\b((?:OPENAI|ANTHROPIC|AICHESTRA_LLM|LLM|GITHUB|GOOGLE_APPLICATION)_TOKEN)\s*=\s*[^\s]+/gi, "$1=[redacted]")
    .replace(/GOOGLE_APPLICATION_CREDENTIALS\s*=\s*[^\s]+/gi, "GOOGLE_APPLICATION_CREDENTIALS=[redacted]")
    .replace(/~[\\/]\.codex[\\/]auth\.json/gi, "[redacted-credential-cache]")
    .replace(/~[\\/]\.claude[^\s]*/gi, "[redacted-credential-cache]")
    .replace(/application_default_credentials\.json/gi, "[redacted-credential-cache]")
    .replace(/gcloud[\\/]application_default_credentials/gi, "[redacted-credential-cache]");
}

function looksSensitive(value: string): boolean {
  return /\bsk-[A-Za-z0-9_-]{8,}\b/.test(value) ||
    /Bearer\s+[A-Za-z0-9._~+/=-]+/i.test(value) ||
    /~[\\/]\.codex[\\/]auth\.json/i.test(value) ||
    /~[\\/]\.claude/i.test(value) ||
    /application_default_credentials\.json/i.test(value) ||
    /gcloud[\\/]application_default_credentials/i.test(value);
}

function limitBytes(input: string, maxBytes: number): string {
  const buffer = Buffer.from(input);
  if (buffer.byteLength <= maxBytes) return input;
  return buffer.subarray(0, maxBytes).toString("utf8");
}
