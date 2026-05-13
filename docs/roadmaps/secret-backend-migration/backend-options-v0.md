# Secret Backend Options v0

Status: planning/readiness only. No real backend integration is implemented.

## Recommendation

The default production path is environment-dependent because the repository does not yet select a hosting platform, production identity provider, or operations owner. Use:

- Vault when the organization already operates Vault or needs dynamic leases and strong revocation semantics.
- AWS Secrets Manager for AWS-native deployments.
- GCP Secret Manager for GCP-native deployments.
- Azure Key Vault for Azure-native deployments.

`EnvSecretProvider` is not production-sufficient except in tightly controlled local/integration contexts. It lacks backend-native audit, rotation, revocation, versioning, HA, and lease enforcement.

## Vault

Strengths:
- Strong lease, TTL, revocation, policy, namespace, and audit model.
- Good fit for dynamic credentials and strict operator control.

Weaknesses:
- Higher operational complexity.
- Requires HA, backup/restore, auth method, policy, and seal/unseal ownership.

Operational requirements:
- HA Vault deployment, audit devices, backup/restore drills, service identity, break-glass process, and policy promotion.

Auth/IAM model:
- Future service identity or workload auth. This task does not implement token exchange or Vault auth.

Audit capability:
- Strong backend audit, but Aichestra must correlate actor, request, task, provider, and SecretRef metadata.

Rotation capability:
- Strong for dynamic secrets and manual/provider-specific static credential rotation.

Lease/TTL support:
- Strong backend-native lease semantics.

Local development story:
- Mock provider by default; optional local Vault fixture would be a future gated integration test.

Integration complexity:
- High.

Recommended use cases:
- Enterprise deployments with existing Vault operations, dynamic credential needs, or strict revocation requirements.

Production suitability:
- High when already operated well.

Risks:
- Backend outage, policy sprawl, audit misconfiguration, and operational knowledge gaps.

## AWS Secrets Manager

Strengths:
- AWS-native IAM, CloudTrail audit integration, versions, replication, and rotation hooks.

Weaknesses:
- Lease semantics are not Vault-style.
- Rotation behavior is provider-specific and needs careful rollout.

Operational requirements:
- IAM role design, CloudTrail, KMS, backup/replication posture, rotation Lambda or provider-managed rotation where applicable.

Auth/IAM model:
- Future IAM role or workload identity. This task does not implement IAM or token exchange.

Audit capability:
- Strong with CloudTrail plus Aichestra metadata audit.

Rotation capability:
- Good for supported secret kinds; manual plans remain required for provider tokens.

Lease/TTL support:
- No native per-read lease model like Vault.

Local development story:
- Mock or env fallback only; real AWS tests must be explicitly gated in future work.

Integration complexity:
- Medium.

Recommended use cases:
- AWS-native production deployments.

Production suitability:
- High for AWS deployments.

Risks:
- IAM over-permissioning, region/replication gaps, and rotation rollout mistakes.

## GCP Secret Manager

Strengths:
- GCP-native IAM, audit logs, versioning, and replication.

Weaknesses:
- No Vault-style per-read lease model.
- Rotation orchestration remains mostly application/operations-owned.

Operational requirements:
- Service account design, audit logs, replication policy, version management, and rotation runbooks.

Auth/IAM model:
- Future service account or workload identity. This task does not implement WIF/IAM.

Audit capability:
- Strong with Cloud Audit Logs plus Aichestra metadata audit.

Rotation capability:
- Version-based rotation with external orchestration.

Lease/TTL support:
- No native dynamic lease semantics.

Local development story:
- Mock or env fallback only; real GCP tests must be explicitly gated in future work.

Integration complexity:
- Medium.

Recommended use cases:
- GCP-native production deployments.

Production suitability:
- High for GCP deployments.

Risks:
- Service account scope creep, stale versions, and insufficient rotation drills.

## Azure Key Vault

Strengths:
- Azure-native managed identity, audit integration, versioning, and key/secret lifecycle controls.

Weaknesses:
- Lease semantics are not Vault-style.
- Rotation orchestration varies by credential kind.

Operational requirements:
- Managed identity or app registration, access policy/RBAC, diagnostic logs, backup/restore posture, and rotation runbooks.

Auth/IAM model:
- Future managed identity or service principal. This task does not implement identity token exchange.

Audit capability:
- Strong with Azure diagnostics plus Aichestra metadata audit.

Rotation capability:
- Good for Azure-native secrets/keys; provider tokens still need runbooks.

Lease/TTL support:
- No native dynamic lease semantics.

Local development story:
- Mock or env fallback only; real Azure tests must be explicitly gated in future work.

Integration complexity:
- Medium.

Recommended use cases:
- Azure-native production deployments.

Production suitability:
- High for Azure deployments.

Risks:
- Access policy sprawl, tenant/app registration complexity, and rotation gaps.

## Custom Enterprise Secret Backend

Strengths:
- Can adapt to existing enterprise secret platforms behind Aichestra interfaces.

Weaknesses:
- Requires bespoke adapter, test harnesses, security review, and operational docs.

Operational requirements:
- Contract definition, adapter lifecycle, audit integration, HA/restore posture, and support ownership.

Auth/IAM model:
- Environment-specific and future-only.

Audit capability:
- Must meet or exceed the common audit envelope and backend audit correlation requirements.

Rotation capability:
- Backend-specific.

Lease/TTL support:
- Backend-specific.

Local development story:
- Mock provider only until an explicit adapter task exists.

Integration complexity:
- High.

Recommended use cases:
- Enterprises with a mandated internal secret platform.

Production suitability:
- Future only.

Risks:
- Contract drift, under-tested edge cases, and unclear operational ownership.

## Env Provider Legacy Fallback

Strengths:
- Simple local/integration setup.
- Already wired through explicit allowlists and SecretRef metadata.

Weaknesses:
- No backend-native lease, rotation, revocation, audit, versioning, replication, or HA.
- Process/env rollout can expose stale or inconsistent values.

Operational requirements:
- Local/integration only with explicit warnings.

Auth/IAM model:
- None.

Audit capability:
- Aichestra metadata audit only.

Rotation capability:
- Manual process/env rollout only.

Lease/TTL support:
- None.

Local development story:
- Allowed when explicitly enabled and allowlisted.

Integration complexity:
- Low.

Recommended use cases:
- Local demos and tightly controlled integration tests.

Production suitability:
- Not suitable.

Risks:
- Production leakage, stale credentials, and weak revocation.
