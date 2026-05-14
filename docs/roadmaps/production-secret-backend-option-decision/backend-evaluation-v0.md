# Production Secret Backend Backend Evaluation v0

Status: `v0_implemented`

No backend is implemented by this document. No backend is called.

## Vault

Recommendation: `prefer`.

Summary: Cloud-neutral, self-hostable, lease-oriented secret backend.

Strengths:

- Strong security posture, leases, TTLs, revocation, namespaces, policy, audit, and dynamic secret path.
- Fits undecided cloud target and self-hosted deployments.
- Maps well to SecretRef metadata and future lease records.

Weaknesses:

- Highest operational complexity.
- Requires HA, seal/unseal or auto-unseal ownership, backup/restore, audit device configuration, auth method design, and on-call ownership.

Required infrastructure: Vault cluster or managed Vault, audit device, storage backend, backup/restore plan, service identity, network policy, operator runbooks.

Authentication model: future service identity or workload auth. v0 does not implement Vault auth or token exchange.

Policy integration approach: Aichestra Auth/RBAC and Policy must allow the purpose before Vault access. Vault policy should then enforce narrow path/namespace access.

SecretRef provider mapping: target provider value `vault`; `vault_future` remains a planning alias only. Backend path/version are stored as metadata only.

Lease/TTL model: strongest native fit.

Rotation model: manual first, with future dynamic/static rotation support.

Audit model: Vault audit plus Aichestra actor/request/task/provider/SecretRef correlation.

Operational complexity: high.

Production suitability: high if operated well.

Staging suitability: high after non-production Vault namespace and fake/test secrets exist.

Local development story: mock provider by default; optional local Vault fixture only in future gated integration tests.

Integration test story: skipped by default behind `AICHESTRA_SECRET_BACKEND_INTEGRATION_TESTS=true`.

Risks: outage, policy sprawl, operational ownership gap.

## AWS Secrets Manager

Recommendation: `acceptable` and second choice for AWS-first deployments.

Strengths: AWS IAM, CloudTrail, KMS, versions, replication, managed rotation hooks.

Weaknesses: No Vault-style per-read lease semantics; AWS lock-in; rotation is provider-specific.

Required infrastructure: AWS account, IAM role, KMS posture, CloudTrail, region/replication strategy, rotation runbooks.

Authentication model: future IAM role or workload identity. v0 does not implement IAM/token exchange.

Policy integration approach: Aichestra gates before AWS access; AWS IAM restricts secret ARN/prefix.

SecretRef provider mapping: `aws_secrets_manager_future`.

Lease/TTL model: application-modeled, not native Vault-style.

Rotation model: good for supported kinds, manual for provider tokens first.

Audit model: CloudTrail plus Aichestra metadata.

Operational complexity: medium.

Production suitability: high for AWS deployments.

Staging suitability: high in AWS non-production accounts.

Local development story: mock/env only.

Integration test story: skipped by default with safe test secret ARN only.

Risks: IAM over-permissioning, region mistakes, rotation rollout failures.

## GCP Secret Manager

Recommendation: `defer` unless deployment is GCP-first.

Strengths: GCP IAM, audit logs, explicit versions, replication controls.

Weaknesses: No Vault-style per-read lease; GCP lock-in; rotation orchestration remains external.

Required infrastructure: GCP project, service account, IAM policy, audit logs, replication policy.

Authentication model: future service account or WIF. v0 does not implement WIF/IAM exchange.

Policy integration approach: Aichestra gates before GCP access; IAM restricts secret/project scope.

SecretRef provider mapping: `gcp_secret_manager_future`.

Lease/TTL model: application-modeled.

Rotation model: version-based with external orchestration.

Audit model: Cloud Audit Logs plus Aichestra metadata.

Operational complexity: medium.

Production suitability: high for GCP deployments.

Staging suitability: high in non-production projects.

Local development story: mock/env only.

Integration test story: skipped by default.

Risks: service account scope creep, stale versions, incomplete rotation drills.

## Azure Key Vault

Recommendation: `defer` unless deployment is Azure/Entra-first.

Strengths: Azure RBAC/managed identity, diagnostics, versioning, key/secret lifecycle controls.

Weaknesses: No Vault-style per-read lease; Azure lock-in; tenant/app registration complexity.

Required infrastructure: Key Vault, managed identity or app registration, diagnostics, backup/restore posture.

Authentication model: future managed identity or service principal. v0 does not implement token exchange.

Policy integration approach: Aichestra gates before Key Vault access; Azure RBAC restricts vault/secret scope.

SecretRef provider mapping: `azure_key_vault_future`.

Lease/TTL model: application-modeled.

Rotation model: good for Azure-native keys/secrets; provider tokens need runbooks.

Audit model: Azure diagnostics plus Aichestra metadata.

Operational complexity: medium.

Production suitability: high for Azure deployments.

Staging suitability: high in non-production tenant/subscription.

Local development story: mock/env only.

Integration test story: skipped by default.

Risks: access policy sprawl, tenant complexity, rotation gaps.

## Custom Enterprise Secret Backend

Recommendation: `defer`.

Strengths: Can match enterprise-mandated platforms.

Weaknesses: Bespoke contract, adapter, test harness, support model, and security review.

Required infrastructure: enterprise-specific.

Authentication model: enterprise-specific future work.

Policy integration approach: must satisfy the common SecretRef, Auth/RBAC, Policy, audit, and redaction contract.

SecretRef provider mapping: `custom_future`.

Lease/TTL model: backend-specific.

Rotation model: backend-specific.

Audit model: must meet or exceed common audit envelope requirements.

Operational complexity: high.

Production suitability: future only until a concrete platform is chosen.

Staging suitability: future only.

Local development story: mock only.

Integration test story: future adapter contract tests.

Risks: contract drift, unclear ownership, under-tested security behavior.

## EnvSecretProvider

Recommendation: `reject` as production default; keep local/integration fallback only.

Strengths: simple local and controlled integration setup; already gated and allowlisted.

Weaknesses: no backend-native audit, versioning, leases, rotation, revocation, HA, IAM, or backup/restore.

Required infrastructure: process env only.

Authentication model: none.

Policy integration approach: existing Auth/RBAC and Policy checks before env read.

SecretRef provider mapping: `env`.

Lease/TTL model: none.

Rotation model: manual process/env rollout only.

Audit model: Aichestra metadata only.

Operational complexity: low, but not production-safe.

Production suitability: not suitable.

Staging suitability: warning-only if project policy explicitly permits.

Local development story: allowed when explicit and allowlisted.

Integration test story: acceptable with fake/non-production values and no output exposure.

Risks: stale credentials, env drift, inadequate audit and revocation.

## Mock Provider

Recommendation: `reject` for production; keep test-only.

Strengths: deterministic, safe, no external calls.

Weaknesses: not real secret storage.

Production suitability: not suitable.

Test strategy: default unit and dashboard tests.
