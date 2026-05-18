import type {
  RegistryPackageKind,
  RegistryPackageManifest,
  RegistryVersionRef
} from "@aichestra/core";
import type { AuthContext, RequestContext } from "@aichestra/auth";
import type { PolicyResourceScope, PolicySubject } from "@aichestra/policy";

export type RegistryArtifactKind =
  | "skill_package"
  | "harness_package"
  | "instruction_artifact"
  | "registry_bundle"
  | "policy_bundle_future"
  | "unknown";

export type RegistryArtifactDigestAlgorithm = "sha256" | "sha512_future" | "unknown";
export type RegistryArtifactDigestStatus = "present" | "missing" | "mismatch" | "unverified" | "future";

export type RegistryArtifactDigest = {
  id: string;
  artifactId: string;
  artifactKind: RegistryArtifactKind;
  digestAlgorithm: RegistryArtifactDigestAlgorithm;
  digestValue: string;
  digestStatus: RegistryArtifactDigestStatus;
  metadata: Record<string, unknown>;
};

export type RegistryArtifactSignatureKind =
  | "mock_signature"
  | "sigstore_future"
  | "cosign_future"
  | "gpg_future"
  | "kms_future"
  | "vault_transit_future"
  | "unknown";

export type RegistryArtifactSignatureStatus =
  | "not_required"
  | "unsigned"
  | "mock_signed"
  | "verification_pending"
  | "verified_future"
  | "invalid"
  | "revoked"
  | "unsupported";

export type RegistryArtifactSignature = {
  id: string;
  artifactId: string;
  signatureKind: RegistryArtifactSignatureKind;
  signatureStatus: RegistryArtifactSignatureStatus;
  signerId?: string;
  signingAuthority?: string;
  signedAt?: Date;
  expiresAt?: Date;
  keyRefId?: string;
  metadata: Record<string, unknown>;
};

export type RegistryArtifactBuildSystem = "mock" | "local_fixture" | "ci_future" | "external_future";
export type RegistryArtifactProvenanceStatus = "present_mock" | "missing" | "incomplete" | "untrusted" | "trusted_future";

export type RegistryArtifactProvenance = {
  id: string;
  artifactId: string;
  sourceRepoId?: string;
  sourceCommitSha?: string;
  sourceBranch?: string;
  buildRunId?: string;
  taskRunId?: string;
  agentRunId?: string;
  createdByActorId?: string;
  createdByServiceAccountId?: string;
  buildSystem: RegistryArtifactBuildSystem;
  provenanceStatus: RegistryArtifactProvenanceStatus;
  metadata: Record<string, unknown>;
};

export type RegistryArtifactTrustPolicyStatus = "active_mock" | "disabled" | "future";

export type RegistryArtifactTrustPolicy = {
  id: string;
  name: string;
  status: RegistryArtifactTrustPolicyStatus;
  requiredDigest: boolean;
  requiredSignature: boolean;
  requiredProvenance: boolean;
  allowedSignatureKinds: RegistryArtifactSignatureKind[];
  allowedSigningAuthorities: string[];
  allowedSourceRepos: string[];
  blockedSigningAuthorities: string[];
  requireNonExpiredSignature: boolean;
  requireNonRevokedSigner: boolean;
  metadata: Record<string, unknown>;
};

export type RegistryArtifactTrustDecisionValue =
  | "trusted"
  | "trusted_with_warnings"
  | "untrusted"
  | "blocked_unsigned"
  | "blocked_digest_mismatch"
  | "blocked_invalid_signature"
  | "blocked_missing_provenance"
  | "future_verification_required";

export type RegistryArtifactResolverImpact = "metadata_only" | "warning" | "block_sensitive" | "future_block";

export type RegistryArtifactTrustDecision = {
  id: string;
  artifactId: string;
  packageId?: string;
  decision: RegistryArtifactTrustDecisionValue;
  reasons: string[];
  warnings: string[];
  blockers: string[];
  resolverImpact: RegistryArtifactResolverImpact;
  createdAt: Date;
  requestId?: string;
  correlationId?: string;
  actorId?: string;
  serviceAccountId?: string;
  metadata: Record<string, unknown>;
};

export type RegistryArtifactTrustSummary = {
  totalArtifacts: number;
  trusted: number;
  warnings: number;
  blocked: number;
  unsigned: number;
  missingProvenance: number;
  realSigningImplemented: false;
  realVerificationImplemented: false;
  externalRegistryCalls: false;
  metadata: Record<string, unknown>;
};

export type RegistryArtifactTrustContext = {
  requestContext?: RequestContext;
  authContext?: AuthContext;
  actorId?: string;
  principalId?: string;
  serviceAccountId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  roles?: string[];
  resourceScopes?: PolicyResourceScope[];
  metadata?: Record<string, unknown>;
};

export type RegistryArtifactTrustEvaluationInput = {
  artifactId: string;
  artifactKind?: RegistryArtifactKind;
  packageId?: string;
  packageKind?: RegistryPackageKind | "unknown";
  checksum?: string;
  digest?: Partial<RegistryArtifactDigest>;
  signature?: Partial<RegistryArtifactSignature>;
  provenance?: Partial<RegistryArtifactProvenance>;
  sensitive?: boolean;
  metadata?: Record<string, unknown>;
};

export type RegistryArtifactTrustPolicyAction =
  | "registry.artifact_trust.read"
  | "registry.artifact_trust.evaluate"
  | "registry.artifact_signature.attach_mock"
  | "registry.artifact_provenance.attach"
  | "registry.artifact_signature.verify_future"
  | "registry.artifact.sign_future"
  | "registry.artifact.import_trusted_future";

export type RegistryArtifactTrustPolicyDecisionSnapshot = {
  decision: "allow" | "deny" | "require_approval" | "not_applicable";
  matchedRuleIds: string[];
  reason: string;
};

export type RegistryArtifactTrustPolicyEvaluationInput = {
  action: RegistryArtifactTrustPolicyAction;
  context: RegistryArtifactTrustContext;
  artifactId?: string;
  metadata?: Record<string, unknown>;
};

export type RegistryArtifactTrustServiceInput = {
  policies?: RegistryArtifactTrustPolicy[];
  policyEvaluator?: (input: RegistryArtifactTrustPolicyEvaluationInput) => RegistryArtifactTrustPolicyDecisionSnapshot;
  now?: () => Date;
};

export type CreateMockSignatureMetadataInput = {
  artifactId: string;
  signatureStatus?: RegistryArtifactSignatureStatus;
  signerId?: string;
  signingAuthority?: string;
  keyRefId?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
};

export type AttachProvenanceMetadataInput = {
  artifactId: string;
  sourceRepoId?: string;
  sourceCommitSha?: string;
  sourceBranch?: string;
  buildRunId?: string;
  taskRunId?: string;
  agentRunId?: string;
  buildSystem?: RegistryArtifactBuildSystem;
  provenanceStatus?: RegistryArtifactProvenanceStatus;
  metadata?: Record<string, unknown>;
};

const defaultTrustPolicy: RegistryArtifactTrustPolicy = {
  id: "registry_artifact_trust_policy_mock_v1",
  name: "Registry Artifact Trust Mock Policy v1",
  status: "active_mock",
  requiredDigest: true,
  requiredSignature: false,
  requiredProvenance: false,
  allowedSignatureKinds: ["mock_signature"],
  allowedSigningAuthorities: ["aichestra_mock_registry", "local_fixture"],
  allowedSourceRepos: [],
  blockedSigningAuthorities: [],
  requireNonExpiredSignature: true,
  requireNonRevokedSigner: true,
  metadata: {
    realSigningImplemented: false,
    realVerificationImplemented: false,
    externalRegistryCalls: false,
    productionReady: false
  }
};

export class RegistryArtifactTrustService {
  private readonly policies: RegistryArtifactTrustPolicy[];
  private readonly policyEvaluator?: (input: RegistryArtifactTrustPolicyEvaluationInput) => RegistryArtifactTrustPolicyDecisionSnapshot;
  private readonly now: () => Date;
  private readonly signatures = new Map<string, RegistryArtifactSignature>();
  private readonly provenances = new Map<string, RegistryArtifactProvenance>();
  private readonly decisions = new Map<string, RegistryArtifactTrustDecision>();

  constructor(input: RegistryArtifactTrustServiceInput = {}) {
    this.policies = input.policies?.map(clonePolicy) ?? [clonePolicy(defaultTrustPolicy)];
    this.policyEvaluator = input.policyEvaluator;
    this.now = input.now ?? (() => new Date());
  }

  evaluateArtifactTrust(input: RegistryArtifactTrustEvaluationInput, context: RegistryArtifactTrustContext = {}): RegistryArtifactTrustDecision {
    const policyDecision = this.policyEvaluator?.({
      action: "registry.artifact_trust.evaluate",
      context,
      artifactId: input.artifactId,
      metadata: input.metadata
    });
    if (policyDecision?.decision === "deny") {
      return this.recordDecision(this.policyDeniedDecision(input, context, policyDecision));
    }

    const policy = this.activePolicy();
    const digest = this.digestFor(input);
    const signature = this.signatureFor(input);
    const provenance = this.provenanceFor(input, context);
    const reasons: string[] = ["artifact_trust_metadata_evaluated"];
    const warnings: string[] = [];
    const blockers: string[] = [];

    if (policy.requiredDigest && digest.digestStatus === "missing") blockers.push("digest_missing");
    if (digest.digestStatus === "mismatch") blockers.push("digest_mismatch");
    if (digest.digestStatus === "unverified") warnings.push("digest_unverified");
    if (digest.digestStatus === "future") warnings.push("digest_future_algorithm");

    if (!policy.allowedSignatureKinds.includes(signature.signatureKind)) {
      if (signature.signatureKind.endsWith("_future")) warnings.push(`signature_kind_future_${signature.signatureKind}`);
      else blockers.push(`signature_kind_not_allowed_${signature.signatureKind}`);
    }
    if (signature.signatureStatus === "unsigned") {
      if (policy.requiredSignature || input.sensitive) blockers.push("signature_unsigned");
      else warnings.push("signature_unsigned");
    }
    if (signature.signatureStatus === "invalid" || signature.signatureStatus === "revoked") blockers.push(`signature_${signature.signatureStatus}`);
    if (signature.signatureStatus === "verification_pending" || signature.signatureStatus === "verified_future" || signature.signatureStatus === "unsupported") {
      warnings.push(`signature_${signature.signatureStatus}`);
    }
    if (signature.signingAuthority && policy.blockedSigningAuthorities.includes(signature.signingAuthority)) blockers.push("signing_authority_blocked");
    if (signature.signingAuthority && policy.allowedSigningAuthorities.length > 0 && !policy.allowedSigningAuthorities.includes(signature.signingAuthority)) {
      warnings.push("signing_authority_not_in_allowlist");
    }
    if (policy.requireNonExpiredSignature && signature.expiresAt && signature.expiresAt.getTime() <= this.now().getTime()) blockers.push("signature_expired");

    if (provenance.provenanceStatus === "missing") {
      if (policy.requiredProvenance || input.sensitive) blockers.push("provenance_missing");
      else warnings.push("provenance_missing");
    }
    if (provenance.provenanceStatus === "incomplete") warnings.push("provenance_incomplete");
    if (provenance.provenanceStatus === "untrusted") blockers.push("provenance_untrusted");
    if (provenance.sourceRepoId && policy.allowedSourceRepos.length > 0 && !policy.allowedSourceRepos.includes(provenance.sourceRepoId)) {
      warnings.push("source_repo_not_in_allowlist");
    }

    const decision = decisionFromEvidence(blockers, warnings, signature);
    const trustDecision: RegistryArtifactTrustDecision = {
      id: decisionId(input.artifactId, decision, context),
      artifactId: input.artifactId,
      packageId: input.packageId,
      decision,
      reasons,
      warnings: [...new Set(warnings)],
      blockers: [...new Set(blockers)],
      resolverImpact: resolverImpactFor(decision),
      createdAt: this.now(),
      requestId: context.requestId ?? context.requestContext?.requestId,
      correlationId: context.correlationId ?? context.requestContext?.correlationId,
      actorId: context.actorId ?? context.authContext?.actor.id ?? context.requestContext?.authContext.actor.id,
      serviceAccountId: context.serviceAccountId ?? stringValue(context.authContext?.metadata.serviceAccountId) ?? stringValue(context.requestContext?.authContext.metadata.serviceAccountId),
      metadata: sanitizeMetadata({
        artifactKind: input.artifactKind ?? "unknown",
        packageKind: input.packageKind,
        digest: digestToJson(digest),
        signature: signatureToJson(signature),
        provenance: provenanceToJson(provenance),
        policyId: policy.id,
        policyStatus: policy.status,
        resolverGatesPreserved: true,
        checksumGatePreserved: true,
        lifecycleApprovalEvalGatesPreserved: true,
        realSigningImplemented: false,
        realVerificationImplemented: false,
        externalRegistryCalls: false,
        noSigningKeysGenerated: true,
        noSecretsExposed: true,
        envValuesExposed: false,
        ...(input.metadata ?? {})
      })
    };
    return this.recordDecision(trustDecision);
  }

  evaluatePackageTrust(manifest: RegistryPackageManifest, context: RegistryArtifactTrustContext = {}): RegistryArtifactTrustDecision {
    return this.evaluateArtifactTrust(registryArtifactInputFromPackageManifest(manifest), context);
  }

  attachResolverTrustMetadata<TResolution extends {
    selectedSkills: RegistryVersionRef[];
    selectedHarness: RegistryVersionRef;
    selectedInstructions: RegistryVersionRef[];
  }>(resolution: TResolution, context: RegistryArtifactTrustContext = {}): TResolution & {
    artifactTrustDecisions: Record<string, unknown>[];
    artifactTrustSummary: Record<string, unknown>;
  } {
    const refs = [
      ...resolution.selectedSkills,
      resolution.selectedHarness,
      ...resolution.selectedInstructions
    ].filter((ref) => ref.name !== "unresolved");
    const decisions = refs.map((ref) => this.evaluateArtifactTrust(registryArtifactInputFromRegistryRef(ref), context));
    return {
      ...resolution,
      artifactTrustDecisions: decisions.map(registryArtifactTrustDecisionToDto),
      artifactTrustSummary: registryArtifactTrustSummaryToDto(this.summarizeDecisions(decisions))
    };
  }

  listTrustPolicies(): RegistryArtifactTrustPolicy[] {
    return this.policies.map(clonePolicy);
  }

  listTrustDecisions(query: {
    artifactId?: string;
    decision?: RegistryArtifactTrustDecisionValue;
  } = {}): RegistryArtifactTrustDecision[] {
    return Array.from(this.decisions.values())
      .filter((decision) => !query.artifactId || decision.artifactId === query.artifactId)
      .filter((decision) => !query.decision || decision.decision === query.decision)
      .map(cloneDecision);
  }

  getTrustSummary(): RegistryArtifactTrustSummary {
    return this.summarizeDecisions();
  }

  summarizeDecisions(decisions: RegistryArtifactTrustDecision[] = this.listTrustDecisions()): RegistryArtifactTrustSummary {
    const blocked = decisions.filter((decision) => isBlockedDecision(decision.decision)).length;
    const warningCount = decisions.filter((decision) => decision.decision === "trusted_with_warnings" || decision.warnings.length > 0).length;
    return {
      totalArtifacts: decisions.length,
      trusted: decisions.filter((decision) => decision.decision === "trusted").length,
      warnings: warningCount,
      blocked,
      unsigned: decisions.filter((decision) => decision.warnings.includes("signature_unsigned") || decision.blockers.includes("signature_unsigned")).length,
      missingProvenance: decisions.filter((decision) => decision.warnings.includes("provenance_missing") || decision.blockers.includes("provenance_missing")).length,
      realSigningImplemented: false,
      realVerificationImplemented: false,
      externalRegistryCalls: false,
      metadata: sanitizeMetadata({
        status: "v1_implemented",
        mockFirst: true,
        resolverGatesPreserved: true,
        lifecycleApprovalEvalChecksumGatesPreserved: true,
        importExportTrustMetadata: true,
        noRealCrypto: true,
        noSigningKeysGenerated: true,
        noExternalRegistryCalls: true,
        noSecretsExposed: true,
        envValuesExposed: false
      })
    };
  }

  createMockSignatureMetadata(input: CreateMockSignatureMetadataInput, context: RegistryArtifactTrustContext = {}): RegistryArtifactSignature {
    const policyDecision = this.policyEvaluator?.({
      action: "registry.artifact_signature.attach_mock",
      context,
      artifactId: input.artifactId,
      metadata: input.metadata
    });
    const now = this.now();
    const signature: RegistryArtifactSignature = {
      id: `registry_signature_${sanitizeId(input.artifactId)}_mock`,
      artifactId: input.artifactId,
      signatureKind: "mock_signature",
      signatureStatus: policyDecision?.decision === "deny" ? "unsupported" : input.signatureStatus ?? "mock_signed",
      signerId: input.signerId ?? context.actorId ?? context.authContext?.actor.id ?? "mock_registry_signer",
      signingAuthority: input.signingAuthority ?? "aichestra_mock_registry",
      signedAt: now,
      expiresAt: input.expiresAt,
      keyRefId: input.keyRefId,
      metadata: sanitizeMetadata({
        ...(input.metadata ?? {}),
        policyDecision,
        mockOnly: true,
        realSigningPerformed: false,
        realSignatureVerificationPerformed: false,
        signingKeyGenerated: false,
        signatureValueStored: false,
        noSecretsExposed: true,
        envValuesExposed: false
      })
    };
    this.signatures.set(input.artifactId, cloneSignature(signature));
    return cloneSignature(signature);
  }

  attachProvenanceMetadata(input: AttachProvenanceMetadataInput, context: RegistryArtifactTrustContext = {}): RegistryArtifactProvenance {
    const policyDecision = this.policyEvaluator?.({
      action: "registry.artifact_provenance.attach",
      context,
      artifactId: input.artifactId,
      metadata: input.metadata
    });
    const provenance: RegistryArtifactProvenance = {
      id: `registry_provenance_${sanitizeId(input.artifactId)}`,
      artifactId: input.artifactId,
      sourceRepoId: input.sourceRepoId,
      sourceCommitSha: input.sourceCommitSha,
      sourceBranch: input.sourceBranch,
      buildRunId: input.buildRunId,
      taskRunId: input.taskRunId,
      agentRunId: input.agentRunId,
      createdByActorId: context.actorId ?? context.authContext?.actor.id ?? context.requestContext?.authContext.actor.id,
      createdByServiceAccountId: context.serviceAccountId ?? stringValue(context.authContext?.metadata.serviceAccountId) ?? stringValue(context.requestContext?.authContext.metadata.serviceAccountId),
      buildSystem: input.buildSystem ?? "mock",
      provenanceStatus: policyDecision?.decision === "deny" ? "untrusted" : input.provenanceStatus ?? "present_mock",
      metadata: sanitizeMetadata({
        ...(input.metadata ?? {}),
        policyDecision,
        mockOnly: true,
        externalBuildSystemCalled: false,
        externalRegistryCalls: false,
        noSecretsExposed: true,
        envValuesExposed: false
      })
    };
    this.provenances.set(input.artifactId, cloneProvenance(provenance));
    return cloneProvenance(provenance);
  }

  private activePolicy(): RegistryArtifactTrustPolicy {
    return this.policies.find((policy) => policy.status === "active_mock") ?? this.policies[0] ?? clonePolicy(defaultTrustPolicy);
  }

  private digestFor(input: RegistryArtifactTrustEvaluationInput): RegistryArtifactDigest {
    const artifactKind = input.artifactKind ?? artifactKindFromPackageKind(input.packageKind);
    const status = input.digest?.digestStatus ?? digestStatusFromInput(input);
    const value = input.digest?.digestValue ?? digestValueFor(input);
    return {
      id: input.digest?.id ?? `registry_digest_${sanitizeId(input.artifactId)}`,
      artifactId: input.artifactId,
      artifactKind,
      digestAlgorithm: input.digest?.digestAlgorithm ?? (value.startsWith("sha256:") ? "sha256" : "unknown"),
      digestValue: value,
      digestStatus: status,
      metadata: sanitizeMetadata({
        ...(input.digest?.metadata ?? {}),
        deterministicMockDigest: !input.checksum,
        checksumGatePreserved: true
      })
    };
  }

  private signatureFor(input: RegistryArtifactTrustEvaluationInput): RegistryArtifactSignature {
    const stored = this.signatures.get(input.artifactId);
    const partial = input.signature;
    if (stored && !partial) return cloneSignature(stored);
    return {
      id: partial?.id ?? stored?.id ?? `registry_signature_${sanitizeId(input.artifactId)}_unsigned`,
      artifactId: input.artifactId,
      signatureKind: partial?.signatureKind ?? stored?.signatureKind ?? "mock_signature",
      signatureStatus: partial?.signatureStatus ?? stored?.signatureStatus ?? "unsigned",
      signerId: partial?.signerId ?? stored?.signerId,
      signingAuthority: partial?.signingAuthority ?? stored?.signingAuthority,
      signedAt: cloneDate(partial?.signedAt) ?? cloneDate(stored?.signedAt),
      expiresAt: cloneDate(partial?.expiresAt) ?? cloneDate(stored?.expiresAt),
      keyRefId: partial?.keyRefId ?? stored?.keyRefId,
      metadata: sanitizeMetadata({
        ...(stored?.metadata ?? {}),
        ...(partial?.metadata ?? {}),
        mockOnly: true,
        rawSignatureStored: false,
        realVerificationPerformed: false
      })
    };
  }

  private provenanceFor(input: RegistryArtifactTrustEvaluationInput, context: RegistryArtifactTrustContext): RegistryArtifactProvenance {
    const stored = this.provenances.get(input.artifactId);
    const partial = input.provenance;
    if (stored && !partial) return cloneProvenance(stored);
    return {
      id: partial?.id ?? stored?.id ?? `registry_provenance_${sanitizeId(input.artifactId)}_missing`,
      artifactId: input.artifactId,
      sourceRepoId: partial?.sourceRepoId ?? stored?.sourceRepoId ?? stringValue(input.metadata?.sourceRepoId),
      sourceCommitSha: partial?.sourceCommitSha ?? stored?.sourceCommitSha ?? stringValue(input.metadata?.sourceCommitSha),
      sourceBranch: partial?.sourceBranch ?? stored?.sourceBranch ?? stringValue(input.metadata?.sourceBranch),
      buildRunId: partial?.buildRunId ?? stored?.buildRunId,
      taskRunId: partial?.taskRunId ?? stored?.taskRunId,
      agentRunId: partial?.agentRunId ?? stored?.agentRunId,
      createdByActorId: partial?.createdByActorId ?? stored?.createdByActorId ?? context.actorId ?? context.authContext?.actor.id,
      createdByServiceAccountId: partial?.createdByServiceAccountId ?? stored?.createdByServiceAccountId ?? context.serviceAccountId,
      buildSystem: partial?.buildSystem ?? stored?.buildSystem ?? "mock",
      provenanceStatus: partial?.provenanceStatus ?? stored?.provenanceStatus ?? (input.metadata?.provenanceStatus === "present_mock" ? "present_mock" : "missing"),
      metadata: sanitizeMetadata({
        ...(stored?.metadata ?? {}),
        ...(partial?.metadata ?? {}),
        mockOnly: true
      })
    };
  }

  private policyDeniedDecision(
    input: RegistryArtifactTrustEvaluationInput,
    context: RegistryArtifactTrustContext,
    policyDecision: RegistryArtifactTrustPolicyDecisionSnapshot
  ): RegistryArtifactTrustDecision {
    return {
      id: decisionId(input.artifactId, "untrusted", context),
      artifactId: input.artifactId,
      packageId: input.packageId,
      decision: "untrusted",
      reasons: ["policy_denied"],
      warnings: [],
      blockers: [`policy_denied:${policyDecision.reason}`],
      resolverImpact: "block_sensitive",
      createdAt: this.now(),
      requestId: context.requestId ?? context.requestContext?.requestId,
      correlationId: context.correlationId ?? context.requestContext?.correlationId,
      actorId: context.actorId ?? context.authContext?.actor.id ?? context.requestContext?.authContext.actor.id,
      serviceAccountId: context.serviceAccountId ?? stringValue(context.authContext?.metadata.serviceAccountId) ?? stringValue(context.requestContext?.authContext.metadata.serviceAccountId),
      metadata: sanitizeMetadata({
        policyDecision,
        policyDenyStillWins: true,
        resolverGatesPreserved: true,
        realSigningImplemented: false,
        realVerificationImplemented: false,
        externalRegistryCalls: false
      })
    };
  }

  private recordDecision(decision: RegistryArtifactTrustDecision): RegistryArtifactTrustDecision {
    this.decisions.set(decision.id, cloneDecision(decision));
    return cloneDecision(decision);
  }
}

export function createRegistryArtifactTrustService(input: RegistryArtifactTrustServiceInput = {}): RegistryArtifactTrustService {
  return new RegistryArtifactTrustService(input);
}

export function registryArtifactInputFromPackageManifest(manifest: RegistryPackageManifest): RegistryArtifactTrustEvaluationInput {
  return {
    artifactId: manifest.id,
    packageId: manifest.id,
    artifactKind: artifactKindFromPackageKind(manifest.packageKind),
    packageKind: manifest.packageKind,
    checksum: manifest.checksum,
    signature: signatureFromMetadata(manifest.metadata.artifactSignature),
    provenance: provenanceFromMetadata(manifest.metadata.artifactProvenance),
    metadata: {
      packageName: manifest.name,
      packageVersion: manifest.version,
      packageKind: manifest.packageKind,
      entryCount: manifest.entries.length,
      artifactTrustMetadata: manifest.metadata.artifactTrust,
      sourceRepoId: manifest.metadata.sourceRepoId,
      sourceCommitSha: manifest.metadata.sourceCommitSha,
      sourceBranch: manifest.metadata.sourceBranch,
      provenanceStatus: manifest.metadata.provenanceStatus
    }
  };
}

export function registryArtifactInputFromRegistryRef(ref: RegistryVersionRef): RegistryArtifactTrustEvaluationInput {
  return {
    artifactId: ref.id ?? `${ref.kind}:${ref.name}@${ref.version}`,
    artifactKind: artifactKindFromPackageKind(ref.kind),
    packageKind: ref.kind,
    checksum: ref.checksum,
    metadata: {
      resolverCandidate: true,
      candidateKind: ref.kind,
      candidateName: ref.name,
      candidateVersion: ref.version
    }
  };
}

export function registryArtifactTrustPolicyToDto(policy: RegistryArtifactTrustPolicy): Record<string, unknown> {
  return {
    ...policy,
    metadata: sanitizeMetadata(policy.metadata)
  };
}

export function registryArtifactTrustDecisionToDto(decision: RegistryArtifactTrustDecision): Record<string, unknown> {
  return {
    ...decision,
    createdAt: decision.createdAt.toISOString(),
    metadata: sanitizeMetadata(decision.metadata)
  };
}

export function registryArtifactSignatureToDto(signature: RegistryArtifactSignature): Record<string, unknown> {
  return signatureToJson(signature);
}

export function registryArtifactProvenanceToDto(provenance: RegistryArtifactProvenance): Record<string, unknown> {
  return provenanceToJson(provenance);
}

export function registryArtifactTrustSummaryToDto(summary: RegistryArtifactTrustSummary): Record<string, unknown> {
  return {
    ...summary,
    metadata: sanitizeMetadata(summary.metadata)
  };
}

function artifactKindFromPackageKind(kind: RegistryPackageKind | "unknown" | undefined): RegistryArtifactKind {
  if (kind === "skill") return "skill_package";
  if (kind === "harness") return "harness_package";
  if (kind === "instruction") return "instruction_artifact";
  if (kind === "bundle") return "registry_bundle";
  return "unknown";
}

function digestStatusFromInput(input: RegistryArtifactTrustEvaluationInput): RegistryArtifactDigestStatus {
  if (input.metadata?.checksumStatus === "mismatch") return "mismatch";
  if (input.metadata?.digestStatus === "mismatch") return "mismatch";
  if (input.checksum) return "present";
  return "missing";
}

function digestValueFor(input: RegistryArtifactTrustEvaluationInput): string {
  if (input.checksum) return input.checksum;
  return `sha256:mock-${sanitizeId(input.artifactId)}`;
}

function decisionFromEvidence(
  blockers: string[],
  warnings: string[],
  signature: RegistryArtifactSignature
): RegistryArtifactTrustDecisionValue {
  if (blockers.includes("digest_mismatch")) return "blocked_digest_mismatch";
  if (blockers.some((blocker) => blocker.startsWith("signature_invalid") || blocker.startsWith("signature_revoked") || blocker === "signature_expired")) return "blocked_invalid_signature";
  if (blockers.includes("signature_unsigned")) return "blocked_unsigned";
  if (blockers.includes("provenance_missing")) return "blocked_missing_provenance";
  if (blockers.length > 0) return "untrusted";
  if (signature.signatureStatus === "verification_pending" || signature.signatureStatus === "verified_future") return "future_verification_required";
  if (warnings.length > 0) return "trusted_with_warnings";
  return "trusted";
}

function resolverImpactFor(decision: RegistryArtifactTrustDecisionValue): RegistryArtifactResolverImpact {
  if (decision === "future_verification_required") return "future_block";
  if (isBlockedDecision(decision)) return "block_sensitive";
  if (decision === "trusted_with_warnings") return "warning";
  return "metadata_only";
}

function isBlockedDecision(decision: RegistryArtifactTrustDecisionValue): boolean {
  return decision === "untrusted" ||
    decision === "blocked_unsigned" ||
    decision === "blocked_digest_mismatch" ||
    decision === "blocked_invalid_signature" ||
    decision === "blocked_missing_provenance";
}

function decisionId(artifactId: string, decision: RegistryArtifactTrustDecisionValue, context: RegistryArtifactTrustContext): string {
  return [
    "registry_artifact_trust",
    sanitizeId(artifactId),
    sanitizeId(decision),
    sanitizeId(context.requestId ?? context.requestContext?.requestId ?? "local")
  ].join("_");
}

function clonePolicy(policy: RegistryArtifactTrustPolicy): RegistryArtifactTrustPolicy {
  return structuredClone(policy);
}

function cloneDecision(decision: RegistryArtifactTrustDecision): RegistryArtifactTrustDecision {
  return structuredClone(decision);
}

function cloneSignature(signature: RegistryArtifactSignature): RegistryArtifactSignature {
  return structuredClone(signature);
}

function cloneProvenance(provenance: RegistryArtifactProvenance): RegistryArtifactProvenance {
  return structuredClone(provenance);
}

function cloneDate(value: Date | string | undefined): Date | undefined {
  if (!value) return undefined;
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function signatureToJson(signature: RegistryArtifactSignature): Record<string, unknown> {
  return {
    ...signature,
    signedAt: signature.signedAt?.toISOString(),
    expiresAt: signature.expiresAt?.toISOString(),
    metadata: sanitizeMetadata(signature.metadata)
  };
}

function provenanceToJson(provenance: RegistryArtifactProvenance): Record<string, unknown> {
  return {
    ...provenance,
    metadata: sanitizeMetadata(provenance.metadata)
  };
}

function digestToJson(digest: RegistryArtifactDigest): Record<string, unknown> {
  return {
    ...digest,
    metadata: sanitizeMetadata(digest.metadata)
  };
}

function signatureFromMetadata(value: unknown): Partial<RegistryArtifactSignature> | undefined {
  if (!isRecord(value)) return undefined;
  return {
    id: stringValue(value.id),
    artifactId: stringValue(value.artifactId) ?? "",
    signatureKind: isSignatureKind(value.signatureKind) ? value.signatureKind : undefined,
    signatureStatus: isSignatureStatus(value.signatureStatus) ? value.signatureStatus : undefined,
    signerId: stringValue(value.signerId),
    signingAuthority: stringValue(value.signingAuthority),
    signedAt: cloneDate(stringValue(value.signedAt)),
    expiresAt: cloneDate(stringValue(value.expiresAt)),
    keyRefId: stringValue(value.keyRefId),
    metadata: isRecord(value.metadata) ? value.metadata : undefined
  };
}

function provenanceFromMetadata(value: unknown): Partial<RegistryArtifactProvenance> | undefined {
  if (!isRecord(value)) return undefined;
  return {
    id: stringValue(value.id),
    artifactId: stringValue(value.artifactId) ?? "",
    sourceRepoId: stringValue(value.sourceRepoId),
    sourceCommitSha: stringValue(value.sourceCommitSha),
    sourceBranch: stringValue(value.sourceBranch),
    buildRunId: stringValue(value.buildRunId),
    taskRunId: stringValue(value.taskRunId),
    agentRunId: stringValue(value.agentRunId),
    createdByActorId: stringValue(value.createdByActorId),
    createdByServiceAccountId: stringValue(value.createdByServiceAccountId),
    buildSystem: isBuildSystem(value.buildSystem) ? value.buildSystem : undefined,
    provenanceStatus: isProvenanceStatus(value.provenanceStatus) ? value.provenanceStatus : undefined,
    metadata: isRecord(value.metadata) ? value.metadata : undefined
  };
}

function isSignatureKind(value: unknown): value is RegistryArtifactSignatureKind {
  return value === "mock_signature" ||
    value === "sigstore_future" ||
    value === "cosign_future" ||
    value === "gpg_future" ||
    value === "kms_future" ||
    value === "vault_transit_future" ||
    value === "unknown";
}

function isSignatureStatus(value: unknown): value is RegistryArtifactSignatureStatus {
  return value === "not_required" ||
    value === "unsigned" ||
    value === "mock_signed" ||
    value === "verification_pending" ||
    value === "verified_future" ||
    value === "invalid" ||
    value === "revoked" ||
    value === "unsupported";
}

function isBuildSystem(value: unknown): value is RegistryArtifactBuildSystem {
  return value === "mock" || value === "local_fixture" || value === "ci_future" || value === "external_future";
}

function isProvenanceStatus(value: unknown): value is RegistryArtifactProvenanceStatus {
  return value === "present_mock" ||
    value === "missing" ||
    value === "incomplete" ||
    value === "untrusted" ||
    value === "trusted_future";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown";
}

function sanitizeMetadata(input: Record<string, unknown> = {}): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (isSafeStatusKey(key)) {
      output[key] = value;
    } else if (/token|secret|password|cookie|credential|session|apiKey|api_key|authorization|privateKey|private_key|signingKey|signing_key|signatureValue|rawSignature|envValue|databaseUrl|database_url|vault/i.test(key)) {
      output[key] = "[redacted]";
    } else if (value instanceof Date) {
      output[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      output[key] = value.map((entry) => entry && typeof entry === "object" ? sanitizeMetadata(entry as Record<string, unknown>) : entry);
    } else if (value && typeof value === "object") {
      output[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function isSafeStatusKey(key: string): boolean {
  return key === "noSecretsExposed" ||
    key === "noSecretValuesExposed" ||
    key === "envValuesExposed" ||
    key === "noEnvValuesExposed";
}

export function artifactTrustPolicySubjectFromContext(context: RegistryArtifactTrustContext): PolicySubject | undefined {
  if (!context.actorId && !context.principalId && !context.serviceAccountId && !context.roles) return undefined;
  return {
    actorId: context.actorId ?? "registry_artifact_trust_mock_actor",
    principalId: context.principalId,
    actorKind: context.serviceAccountId ? "service_account" : "user",
    roles: context.roles ?? ["viewer"],
    serviceAccountId: context.serviceAccountId,
    requestId: context.requestId,
    correlationId: context.correlationId,
    source: context.source,
    isMockActor: true,
    resourceScopes: context.resourceScopes,
    metadata: sanitizeMetadata(context.metadata ?? {})
  };
}
