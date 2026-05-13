import type {
  NetworkEgressPolicy,
  RedactionPolicy,
  SandboxDecision,
  SandboxProfile,
  SandboxSession,
  SecretAccessDecision,
  SecretLease,
  SecretRef,
  SecretScope,
  SecurityAuditEvent
} from "./types.ts";

export type SecretRefRepository = {
  listSecretRefs(): SecretRef[];
  getSecretRef(id: string): SecretRef | undefined;
  saveSecretRef(secretRef: SecretRef): SecretRef;
};

export type SecretScopeRepository = {
  listSecretScopes(): SecretScope[];
  getSecretScope(id: string): SecretScope | undefined;
  saveSecretScope(scope: SecretScope): SecretScope;
};

export type SecretLeaseRepository = {
  listSecretLeases(filter?: { taskId?: string; taskRunId?: string; status?: SecretLease["status"] }): SecretLease[];
  getSecretLease(id: string): SecretLease | undefined;
  saveSecretLease(lease: SecretLease): SecretLease;
};

export type SecretAccessDecisionRepository = {
  listSecretAccessDecisions(filter?: { taskId?: string; taskRunId?: string; actorId?: string }): SecretAccessDecision[];
  saveSecretAccessDecision(decision: SecretAccessDecision): SecretAccessDecision;
};

export type SandboxProfileRepository = {
  listSandboxProfiles(): SandboxProfile[];
  getSandboxProfile(id: string): SandboxProfile | undefined;
  saveSandboxProfile(profile: SandboxProfile): SandboxProfile;
};

export type SandboxSessionRepository = {
  listSandboxSessions(filter?: { taskId?: string; taskRunId?: string; status?: SandboxSession["status"] }): SandboxSession[];
  getSandboxSession(id: string): SandboxSession | undefined;
  saveSandboxSession(session: SandboxSession): SandboxSession;
};

export type SandboxDecisionRepository = {
  listSandboxDecisions(filter?: { taskId?: string; taskRunId?: string; actorId?: string }): SandboxDecision[];
  saveSandboxDecision(decision: SandboxDecision): SandboxDecision;
};

export type NetworkEgressPolicyRepository = {
  listNetworkEgressPolicies(): NetworkEgressPolicy[];
  getNetworkEgressPolicy(id: string): NetworkEgressPolicy | undefined;
  saveNetworkEgressPolicy(policy: NetworkEgressPolicy): NetworkEgressPolicy;
};

export type RedactionPolicyRepository = {
  listRedactionPolicies(): RedactionPolicy[];
  getRedactionPolicy(id: string): RedactionPolicy | undefined;
  saveRedactionPolicy(policy: RedactionPolicy): RedactionPolicy;
};

export type SecurityAuditRepository = {
  appendSecurityAuditEvent(event: SecurityAuditEvent): SecurityAuditEvent;
  listSecurityAuditEvents(filter?: { targetKind?: SecurityAuditEvent["targetKind"]; eventType?: string; taskId?: string; taskRunId?: string; actorId?: string }): SecurityAuditEvent[];
};

export type SecurityRepositories = {
  secretRefs: SecretRefRepository;
  secretScopes: SecretScopeRepository;
  secretLeases: SecretLeaseRepository;
  secretAccessDecisions: SecretAccessDecisionRepository;
  sandboxProfiles: SandboxProfileRepository;
  sandboxSessions: SandboxSessionRepository;
  sandboxDecisions: SandboxDecisionRepository;
  networkEgressPolicies: NetworkEgressPolicyRepository;
  redactionPolicies: RedactionPolicyRepository;
  audit: SecurityAuditRepository;
};

export class InMemorySecretRefRepository implements SecretRefRepository {
  private readonly secretRefs = new Map<string, SecretRef>();

  constructor(seed: SecretRef[] = []) {
    for (const item of seed) this.secretRefs.set(item.id, item);
  }

  listSecretRefs(): SecretRef[] {
    return [...this.secretRefs.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getSecretRef(id: string): SecretRef | undefined {
    return this.secretRefs.get(id);
  }

  saveSecretRef(secretRef: SecretRef): SecretRef {
    this.secretRefs.set(secretRef.id, secretRef);
    return secretRef;
  }
}

export class InMemorySecretScopeRepository implements SecretScopeRepository {
  private readonly scopes = new Map<string, SecretScope>();

  constructor(seed: SecretScope[] = []) {
    for (const item of seed) this.scopes.set(item.id, item);
  }

  listSecretScopes(): SecretScope[] {
    return [...this.scopes.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getSecretScope(id: string): SecretScope | undefined {
    return this.scopes.get(id);
  }

  saveSecretScope(scope: SecretScope): SecretScope {
    this.scopes.set(scope.id, scope);
    return scope;
  }
}

export class InMemorySecretLeaseRepository implements SecretLeaseRepository {
  private readonly leases = new Map<string, SecretLease>();

  listSecretLeases(filter: { taskId?: string; taskRunId?: string; status?: SecretLease["status"] } = {}): SecretLease[] {
    return [...this.leases.values()]
      .filter((item) => filter.taskId === undefined || item.taskId === filter.taskId)
      .filter((item) => filter.taskRunId === undefined || item.taskRunId === filter.taskRunId)
      .filter((item) => filter.status === undefined || item.status === filter.status)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  getSecretLease(id: string): SecretLease | undefined {
    return this.leases.get(id);
  }

  saveSecretLease(lease: SecretLease): SecretLease {
    this.leases.set(lease.id, lease);
    return lease;
  }
}

export class InMemorySecretAccessDecisionRepository implements SecretAccessDecisionRepository {
  private readonly decisions = new Map<string, SecretAccessDecision>();

  listSecretAccessDecisions(filter: { taskId?: string; taskRunId?: string; actorId?: string } = {}): SecretAccessDecision[] {
    return [...this.decisions.values()]
      .filter((item) => filter.taskId === undefined || item.taskId === filter.taskId)
      .filter((item) => filter.taskRunId === undefined || item.taskRunId === filter.taskRunId)
      .filter((item) => filter.actorId === undefined || item.actorId === filter.actorId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  }

  saveSecretAccessDecision(decision: SecretAccessDecision): SecretAccessDecision {
    this.decisions.set(decision.id, decision);
    return decision;
  }
}

export class InMemorySandboxProfileRepository implements SandboxProfileRepository {
  private readonly profiles = new Map<string, SandboxProfile>();

  constructor(seed: SandboxProfile[] = []) {
    for (const item of seed) this.profiles.set(item.id, item);
  }

  listSandboxProfiles(): SandboxProfile[] {
    return [...this.profiles.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getSandboxProfile(id: string): SandboxProfile | undefined {
    return this.profiles.get(id);
  }

  saveSandboxProfile(profile: SandboxProfile): SandboxProfile {
    this.profiles.set(profile.id, profile);
    return profile;
  }
}

export class InMemorySandboxSessionRepository implements SandboxSessionRepository {
  private readonly sessions = new Map<string, SandboxSession>();

  listSandboxSessions(filter: { taskId?: string; taskRunId?: string; status?: SandboxSession["status"] } = {}): SandboxSession[] {
    return [...this.sessions.values()]
      .filter((item) => filter.taskId === undefined || item.taskId === filter.taskId)
      .filter((item) => filter.taskRunId === undefined || item.taskRunId === filter.taskRunId)
      .filter((item) => filter.status === undefined || item.status === filter.status)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  }

  getSandboxSession(id: string): SandboxSession | undefined {
    return this.sessions.get(id);
  }

  saveSandboxSession(session: SandboxSession): SandboxSession {
    this.sessions.set(session.id, session);
    return session;
  }
}

export class InMemorySandboxDecisionRepository implements SandboxDecisionRepository {
  private readonly decisions = new Map<string, SandboxDecision>();

  listSandboxDecisions(filter: { taskId?: string; taskRunId?: string; actorId?: string } = {}): SandboxDecision[] {
    return [...this.decisions.values()]
      .filter((item) => filter.taskId === undefined || item.taskId === filter.taskId)
      .filter((item) => filter.taskRunId === undefined || item.taskRunId === filter.taskRunId)
      .filter((item) => filter.actorId === undefined || item.actorId === filter.actorId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  }

  saveSandboxDecision(decision: SandboxDecision): SandboxDecision {
    this.decisions.set(decision.id, decision);
    return decision;
  }
}

export class InMemoryNetworkEgressPolicyRepository implements NetworkEgressPolicyRepository {
  private readonly policies = new Map<string, NetworkEgressPolicy>();

  constructor(seed: NetworkEgressPolicy[] = []) {
    for (const item of seed) this.policies.set(item.id, item);
  }

  listNetworkEgressPolicies(): NetworkEgressPolicy[] {
    return [...this.policies.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getNetworkEgressPolicy(id: string): NetworkEgressPolicy | undefined {
    return this.policies.get(id);
  }

  saveNetworkEgressPolicy(policy: NetworkEgressPolicy): NetworkEgressPolicy {
    this.policies.set(policy.id, policy);
    return policy;
  }
}

export class InMemoryRedactionPolicyRepository implements RedactionPolicyRepository {
  private readonly policies = new Map<string, RedactionPolicy>();

  constructor(seed: RedactionPolicy[] = []) {
    for (const item of seed) this.policies.set(item.id, item);
  }

  listRedactionPolicies(): RedactionPolicy[] {
    return [...this.policies.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getRedactionPolicy(id: string): RedactionPolicy | undefined {
    return this.policies.get(id);
  }

  saveRedactionPolicy(policy: RedactionPolicy): RedactionPolicy {
    this.policies.set(policy.id, policy);
    return policy;
  }
}

export class InMemorySecurityAuditRepository implements SecurityAuditRepository {
  private readonly events: SecurityAuditEvent[] = [];

  appendSecurityAuditEvent(event: SecurityAuditEvent): SecurityAuditEvent {
    this.events.push(event);
    return event;
  }

  listSecurityAuditEvents(filter: { targetKind?: SecurityAuditEvent["targetKind"]; eventType?: string; taskId?: string; taskRunId?: string; actorId?: string } = {}): SecurityAuditEvent[] {
    return this.events
      .filter((item) => filter.targetKind === undefined || item.targetKind === filter.targetKind)
      .filter((item) => filter.eventType === undefined || item.eventType === filter.eventType)
      .filter((item) => filter.taskId === undefined || item.taskId === filter.taskId)
      .filter((item) => filter.taskRunId === undefined || item.taskRunId === filter.taskRunId)
      .filter((item) => filter.actorId === undefined || item.actorId === filter.actorId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  }
}

export function createInMemorySecurityRepositories(seed = createDefaultSecuritySeed()): SecurityRepositories {
  return {
    secretRefs: new InMemorySecretRefRepository(seed.secretRefs),
    secretScopes: new InMemorySecretScopeRepository(seed.secretScopes),
    secretLeases: new InMemorySecretLeaseRepository(),
    secretAccessDecisions: new InMemorySecretAccessDecisionRepository(),
    sandboxProfiles: new InMemorySandboxProfileRepository(seed.sandboxProfiles),
    sandboxSessions: new InMemorySandboxSessionRepository(),
    sandboxDecisions: new InMemorySandboxDecisionRepository(),
    networkEgressPolicies: new InMemoryNetworkEgressPolicyRepository(seed.networkEgressPolicies),
    redactionPolicies: new InMemoryRedactionPolicyRepository(seed.redactionPolicies),
    audit: new InMemorySecurityAuditRepository()
  };
}

export function createDefaultSecuritySeed(): {
  secretRefs: SecretRef[];
  secretScopes: SecretScope[];
  sandboxProfiles: SandboxProfile[];
  networkEgressPolicies: NetworkEgressPolicy[];
  redactionPolicies: RedactionPolicy[];
} {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const deniedCommands = ["curl", "wget", "git fetch", "git push", "git merge", "git rebase", "kubectl", "vault"];
  return {
    secretRefs: [
      {
        id: "secretref_mock_provider_metadata",
        provider: "mock",
        secretKind: "mock_metadata",
        name: "mock-provider-metadata",
        scope: "scope_mock_provider_metadata",
        description: "Mock metadata reference; contains no secret value.",
        status: "active",
        metadata: {
          storesRawSecret: false,
          fixtureOnly: true
        },
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "secretref_vault_future_placeholder",
        provider: "vault_future",
        secretKind: "provider_api_key",
        name: "future-vault-secret",
        scope: "scope_future_real_credentials",
        description: "Future Vault reference placeholder; not connected.",
        status: "disabled",
        metadata: {
          notImplemented: true,
          storesRawSecret: false
        },
        createdAt,
        updatedAt: createdAt
      }
    ],
    secretScopes: [
      {
        id: "scope_mock_provider_metadata",
        name: "Mock provider metadata",
        allowedResourceKinds: ["provider", "llm_provider"],
        allowedActions: ["secret.metadata.read", "provider.credential.resolve"],
        allowedProviderIds: ["mock"],
        allowedRunnerKinds: ["mock", "local"],
        maxTtlSeconds: 300,
        requiresApproval: true,
        metadata: {
          secretMaterialAvailable: false
        }
      },
      {
        id: "scope_future_real_credentials",
        name: "Future real provider credentials",
        allowedResourceKinds: ["provider_credential"],
        allowedActions: ["secret.lease.request"],
        allowedProviderIds: [],
        maxTtlSeconds: 60,
        requiresApproval: true,
        metadata: {
          notImplemented: true
        }
      },
      {
        id: "scope_env_provider_credentials",
        name: "Env-backed provider credentials",
        allowedResourceKinds: ["provider_credential", "llm_provider", "repo"],
        allowedActions: ["provider.credential.resolve", "secret.lease.request", "secret.lease.issue"],
        allowedProviderIds: ["github", "github_app", "openai_compatible", "openai-api-key"],
        maxTtlSeconds: 300,
        requiresApproval: false,
        metadata: {
          secretMaterialAvailable: true,
          envProviderOnly: true,
          credentialCacheAccessAllowed: false
        }
      }
    ],
    sandboxProfiles: [
      {
        id: "sandbox_default_deny",
        name: "Default deny sandbox",
        kind: "none",
        allowNetwork: false,
        allowFileWrite: false,
        allowShellExecution: false,
        allowGitRemote: false,
        allowSecrets: false,
        allowedCommands: [],
        deniedCommands,
        allowedPaths: [],
        deniedPaths: ["."],
        networkPolicyRef: "network_default_deny",
        maxRuntimeMs: 1_000,
        maxOutputBytes: 1_024,
        cleanupPolicy: "none",
        status: "active",
        metadata: {
          default: true
        }
      },
      {
        id: "sandbox_local_temp_fixture",
        name: "Local temp fixture sandbox",
        kind: "local_temp_workspace",
        allowNetwork: false,
        allowFileWrite: true,
        allowShellExecution: true,
        allowGitRemote: false,
        allowSecrets: false,
        allowedCommands: ["node --version", "node fixture-command.mjs", "echo"],
        deniedCommands,
        allowedPaths: ["tests/fixtures", "tmp/aichestra-agent"],
        deniedPaths: ["."],
        networkPolicyRef: "network_default_deny",
        maxRuntimeMs: 2_000,
        maxOutputBytes: 4_096,
        cleanupPolicy: "delete_temp_workspace",
        status: "active",
        metadata: {
          fixtureOnly: true,
          productionSandbox: false
        }
      },
      {
        id: "sandbox_container_future",
        name: "Container sandbox future placeholder",
        kind: "container_future",
        allowNetwork: false,
        allowFileWrite: false,
        allowShellExecution: false,
        allowGitRemote: false,
        allowSecrets: false,
        allowedCommands: [],
        deniedCommands,
        allowedPaths: [],
        deniedPaths: ["."],
        networkPolicyRef: "network_default_deny",
        maxRuntimeMs: 1_000,
        maxOutputBytes: 1_024,
        cleanupPolicy: "none",
        status: "disabled",
        metadata: {
          notImplemented: true
        }
      },
      {
        id: "sandbox_firecracker_future",
        name: "Firecracker sandbox future placeholder",
        kind: "firecracker_future",
        allowNetwork: false,
        allowFileWrite: false,
        allowShellExecution: false,
        allowGitRemote: false,
        allowSecrets: false,
        allowedCommands: [],
        deniedCommands,
        allowedPaths: [],
        deniedPaths: ["."],
        networkPolicyRef: "network_default_deny",
        maxRuntimeMs: 1_000,
        maxOutputBytes: 1_024,
        cleanupPolicy: "none",
        status: "disabled",
        metadata: {
          notImplemented: true
        }
      },
      {
        id: "sandbox_kubernetes_future",
        name: "Kubernetes sandbox future placeholder",
        kind: "kubernetes_future",
        allowNetwork: false,
        allowFileWrite: false,
        allowShellExecution: false,
        allowGitRemote: false,
        allowSecrets: false,
        allowedCommands: [],
        deniedCommands,
        allowedPaths: [],
        deniedPaths: ["."],
        networkPolicyRef: "network_default_deny",
        maxRuntimeMs: 1_000,
        maxOutputBytes: 1_024,
        cleanupPolicy: "none",
        status: "disabled",
        metadata: {
          notImplemented: true
        }
      }
    ],
    networkEgressPolicies: [
      {
        id: "network_default_deny",
        name: "Default deny network egress",
        defaultAction: "deny",
        allowedHosts: [],
        deniedHosts: ["*"],
        allowedPorts: [],
        deniedPorts: [],
        allowLocalhost: false,
        allowPrivateNetwork: false,
        status: "active",
        metadata: {
          enforcement: "model_only_v0"
        }
      }
    ],
    redactionPolicies: [
      {
        id: "redaction_default",
        name: "Default security redaction",
        maskBearerTokens: true,
        maskApiKeys: true,
        maskCredentialPaths: true,
        maskEnvDumps: true,
        maskProviderTokens: true,
        maxPreviewBytes: 128,
        retentionClass: "short_preview",
        status: "active"
      }
    ]
  };
}
