# Secret Backend Options v0

Status: planning/readiness with Vault v1 gated boundary implemented. No backend is the default production secret backend.

## Recommendation

Production Secret Backend Implementation Option Decision v0 selected Vault as the first concrete implementation path. Vault-backed Secret Backend v1 promotes the runtime provider value to `vault` behind explicit gates. AWS Secrets Manager remains the second choice if the first production deployment is explicitly AWS-first.

Earlier environment-dependent guidance still applies to future follow-up backends:

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
- v1 supports gated token-auth client configuration for optional integration testing only. Production service identity, AppRole/workload identity, and token exchange remain future work.

Audit capability:
- Strong backend audit, but Aichestra must correlate actor, request, task, provider, and SecretRef metadata.

Rotation capability:
- Strong for dynamic secrets and manual/provider-specific static credential rotation.

Lease/TTL support:
- Strong backend-native lease semantics.

Local development story:
- Disabled provider by default; deterministic `MockVaultClient` in tests; optional live Vault test skeleton is skipped unless every explicit gate is configured.

Integration complexity:
- High.

Recommended use cases:
- Enterprise deployments with existing Vault operations, dynamic credential needs, or strict revocation requirements.
- First Aichestra production-grade backend implementation path because the hosting cloud is not selected and Vault best exercises lease/revocation-oriented SecretRef behavior.

Production suitability:
- High when already operated well.

Risks:
- Backend outage, policy sprawl, audit misconfiguration, accidental env fallback in production, and operational knowledge gaps.

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

## Related decision

See `docs/roadmaps/production-secret-backend-option-decision/` for the v0 decision criteria, backend evaluation, Vault-first recommendation, v1 implementation scope, migration plan, test strategy, and risk register. See `docs/foundations/vault-secret-backend/v1.md` for the gated Vault implementation boundary and `docs/roadmaps/vault-integration-test-profile/v1.md` for the skipped-by-default optional live KV v2 profile. Vault v1 still does not mark secrets production-ready.
