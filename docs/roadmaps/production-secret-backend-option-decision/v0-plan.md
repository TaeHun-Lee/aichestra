# Production Secret Backend Implementation Option Decision v0 Plan

Status: `planned_for_this_task`

Path note: `docs/README.md` places cross-cutting implementation roadmaps under `docs/roadmaps/`. This decision is a production-readiness roadmap item, so `docs/roadmaps/production-secret-backend-option-decision/` is the canonical path.

## Audit Starting Point

The Staging Release Candidate Audit v0 rerun returned `staging_rc_pass_with_warnings`. Validation is green, no critical blockers were found, staging has not been deployed, production readiness remains false, and real human signoffs remain required before actual staging deployment.

## Current SecretRef-backed Provider Credentials v1 Behavior

SecretRef-backed Provider Credentials v1 provides metadata-only `SecretRef` records, explicit env-backed credential resolution, Auth/RBAC checks, Policy checks, transient internal credential handles, credential resolution audit events, and redaction. It currently supports GitHub token, GitHub webhook secret, GitHub App private-key metadata, LLM API key, provider API key, and future credential kinds as references only.

Current behavior remains mock-first:

- `SecretRef` does not store raw values.
- `EnvSecretProvider` is disabled by default.
- Env-backed resolution reads only one requested allowlisted key.
- Public DTOs, health, dashboard, and audit never return secret values or env values.
- SecretRef failure does not silently fall back to legacy env credentials when a SecretRef is configured.
- Vault/cloud/custom secret managers are future placeholders only.

## Current Secret Backend Migration Planning v0 Status

Secret Backend Migration Planning v0 is implemented as read-only planning/readiness data. It documents backend options, migration phases, credential-kind migration, env fallback deprecation, lease/TTL expectations, rotation expectations, readiness checks, risks, API endpoints, health metadata, and dashboard visibility.

It does not select or implement a production backend.

## Current EnvSecretProvider Limitations

`EnvSecretProvider` is useful for local development and controlled integration tests, but it is not sufficient for production because it lacks:

- backend-native audit,
- backend-native versioning,
- backend-enforced leases,
- rotation/revocation workflow,
- high availability posture,
- scoped backend IAM/RBAC,
- backup/restore controls,
- incident-response support,
- tenant/team/project scoping,
- production break-glass controls.

## Current Credential Consumers

| Consumer | Current state | Production requirement |
| --- | --- | --- |
| GitHub token | SecretRef env provider or legacy env fallback behind Real Git Adapter gates | backend-backed SecretRef until GitHub App installation token path is production-ready |
| GitHub webhook secret | SecretRef env provider or legacy env fallback inside verifier boundary | backend-backed SecretRef used only for signature verification |
| GitHub App private key SecretRef metadata | metadata-only, mock token-handle readiness | backend-backed private-key retrieval only inside future signing boundary |
| LLM API key | SecretRef env provider or legacy env fallback behind LLM Gateway gates | backend-backed SecretRef with model, route, budget, Auth/RBAC, and Policy gates |
| Provider API key | future/provider skeleton metadata | backend-backed SecretRef before any provider adapter requires it |
| Future MCP tool secrets | not issued to tools | backend-backed short lease only after real MCP transport governance exists |
| Future Local Agent pairing secret | not implemented | backend-backed short pairing secret only after real daemon/pairing design exists |
| Future service account signing key | not implemented | likely backend/HSM/KMS-backed key metadata only after production Auth/RBAC design |

## Production Requirements

- Real backend selected and implemented behind `packages/security` boundaries.
- Stable `SecretRef` ids remain the application-facing references.
- Backend references and versions remain metadata only.
- Auth/RBAC denies unauthorized secret use before backend access.
- Policy denies unsupported purposes and disabled/revoked refs before backend access.
- Public APIs, health, dashboard, audit, and logs expose no raw values.
- Env fallback is local/integration only, warning-only at most for staging, and blocked as production primary storage.
- Backend audit must correlate with Aichestra actor/request/task/provider/SecretRef metadata.
- Rotation, revocation, incident response, backup/restore, and break-glass plans are documented before production.

## Decision Criteria

This task evaluates security posture, SecretRef compatibility, lease/TTL support, rotation, versioning, audit, IAM/RBAC integration, tenant/team/project scoping, local/integration/staging/production usability, operational complexity, deployment complexity, vendor lock-in, self-hosted support, cost, backup/restore, incident response, break-glass, developer experience, testability, and future BYOK/OAuth/WIF/IAM/MCP/Local Agent compatibility.

## Backend Options To Evaluate

- Vault.
- AWS Secrets Manager.
- GCP Secret Manager.
- Azure Key Vault.
- Custom enterprise secret backend.
- EnvSecretProvider as local/integration fallback only.
- Mock secret provider as test-only.

## What This Task Implements

- Decision criteria document.
- Backend evaluation document.
- Recommendation document.
- SecretRef provider mapping document.
- v1 implementation scope document.
- Env-to-production migration plan.
- v1 test strategy.
- Operational risk register.
- Optional read-only deterministic decision models, API endpoints, health metadata, dashboard panel, and tests if consistent with the current deployment-readiness pattern.
- Updates to canonical docs, status inventories, environment gate matrix, dashboard docs, phase audit, README, and AGENTS.

## What Remains Out Of Scope

- Real Vault integration.
- AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, or custom backend integration.
- Cloud secret manager calls.
- Secret reads, writes, rotation, migration, export, or credential issuance.
- BYOK, OAuth, device-code, WIF, IAM, or cloud identity token exchange.
- Provider API calls, remote Git operations, real LLM calls, real MCP calls, vendor CLI execution, or credential cache reads.
- Production Auth/RBAC implementation.
- Marking the selected backend as implemented.
- Marking secrets or production deployment as production-ready.
