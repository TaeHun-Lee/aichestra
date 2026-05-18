# Registry Signed Package / Artifact Trust v1 Plan

## Docs Path

This plan follows the current docs organization in `docs/README.md`: feature history lives under `docs/features/<feature>/`. Signed package and artifact trust is a registry feature, so the canonical path is `docs/features/registry-artifact-trust/`.

## Current Registry Package Behavior

Registry packaging v3 defines local `RegistryPackageManifest` records for skills, harnesses, instructions, and bundles. Package manifests are stored through the registry repository boundary, can be exported/imported as local JSON, and expose package list/get/export/import/diff APIs. No real artifact registry, remote import source, package upload, package download, signed artifact, provenance, or publishing workflow exists.

## Current Checksum Behavior

Registry packages have deterministic manifest checksums using `sha256` over stable manifest payloads. Instruction artifacts also carry checksum metadata and local verification status. Existing resolver behavior excludes checksum-mismatched instructions, and policy rules deny registry mutation when checksum mismatch evidence is present. Checksum gates are separate from artifact signatures and must remain authoritative.

## Current Approval, Eval, And Lifecycle Gates

Registry resolver selection remains guarded by:

- lifecycle status: active entries only;
- approval status: `not_required` or `approved`;
- eval status: `not_required` or `passed`;
- checksum status: checksum mismatch excluded;
- semver/version selection rules;
- policy/auth checks around mutation and selected service paths.

Skill / Harness Compatibility Matrix v1 and Registry Tenant Scope Enforcement v1 attach advisory/scope metadata without overriding these gates.

## Current Package Import / Export Behavior

Export creates local package manifests from existing registry entries and includes local metadata snapshots for import. Import validates schema, entries, checksums, conflicts, and dry-run behavior. Dry-run import does not mutate registry state. Real import mutates only local registry repositories, appends audit logs and revisions, and never calls remote artifact registries.

## Current SecretRef, Vault, And Signing-Key Status

SecretRef-backed Provider Credentials v1 and Vault-backed Secret Backend v1 model credential references and gated secret resolution for Git, webhooks, LLM, and provider credentials. They do not implement signing keys for registry artifacts. Vault transit, KMS, Sigstore, Cosign, GPG, cloud signing, signing key generation, and real signature verification are not implemented and must remain out of scope for this task.

## Proposed Artifact Trust Model

Add mock-first metadata models for:

- artifact digest metadata;
- artifact signature metadata;
- artifact provenance metadata;
- artifact trust policy;
- artifact trust decision and summary.

The service will derive deterministic digest/status metadata from existing registry package checksums or registry refs. It will treat mock signatures as local metadata only and never create, read, or verify real keys.

## Proposed Signature Metadata Model

`RegistryArtifactSignature` will carry signature kind/status, signer id, signing authority, optional key ref id, and timestamps. v1 supports only `mock_signature` metadata. Future kinds (`sigstore_future`, `cosign_future`, `gpg_future`, `kms_future`, `vault_transit_future`) remain status metadata and are not executable integrations.

## Proposed Provenance Model

`RegistryArtifactProvenance` will capture source repo/branch/commit, build/task/agent run ids, creator actor/service-account ids, build system, and provenance status. v1 can attach mock/local fixture provenance metadata in memory or derive partial provenance from package/registry metadata. Missing provenance warns by default.

## Proposed Resolver Integration Strategy

Resolver integration will attach artifact trust decisions/summaries to `RegistryResolution` metadata after existing resolver selection. Trust metadata must not make excluded candidates selectable. Pending approval, failed eval, deprecated/archived lifecycle, checksum mismatch, semver errors, and policy deny remain authoritative.

## Trust Decision Strategy

Default v1 policy:

- valid digest + allowed mock signature + provenance present -> `trusted`;
- unsigned artifact -> `trusted_with_warnings`;
- missing provenance -> `trusted_with_warnings`;
- digest mismatch -> `blocked_digest_mismatch`;
- invalid/revoked mock signature -> `blocked_invalid_signature`;
- explicit policy denial -> `untrusted`;
- future real signature requirements -> `future_verification_required`.

Resolver impact is metadata-only by default, with representative blocking for digest mismatch and invalid mock signatures.

## Future Real Signature Verification Strategy

Future real verification requires a separate reviewed integration profile. It would need explicit signing authority policy, key custody, SecretRef/Vault/KMS boundary review, signature transparency/audit design, remote artifact registry gates, and production Auth/RBAC. v1 only documents this path and exposes disabled/future metadata.

## Safety Constraints

- No real cryptographic signing.
- No signing key generation or storage.
- No real signature verification.
- No Sigstore, Cosign, GPG, KMS, Vault transit, cloud signing, or artifact registry calls.
- No artifact upload/download.
- No GitHub, LLM, MCP, Vault, Kubernetes, Temporal, OPA, Cedar, external auth, or cloud service calls.
- No remote Git operations.
- No secrets, env values, raw signatures, private keys, or credential cache exposure.
- No active registry mutation through auto-improvement.
- No lifecycle, approval, eval, checksum, semver, policy, governance, tenant scope, or resolver gate weakening.

## What This Task Implements

- Registry artifact trust models and deterministic service.
- Mock signature/provenance metadata helpers.
- Trust policy and decision evaluation.
- Registry package and resolver metadata integration.
- Readiness/API/dashboard visibility.
- Policy action/resource metadata for artifact trust.
- Documentation and deterministic tests.

## Out Of Scope

- Production artifact signing or verification.
- Real signing keys or key management.
- Remote artifact registry publishing/fetching.
- Sigstore, Cosign, GPG, KMS, Vault transit, or cloud signing integration.
- Production tenant isolation or production Auth/RBAC.
- Enforcing artifact trust as a production resolver gate.
- Auto-improvement mutation of active registry entries.
