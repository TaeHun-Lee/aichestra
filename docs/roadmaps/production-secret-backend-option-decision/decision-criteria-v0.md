# Production Secret Backend Decision Criteria v0

Status: `v0_implemented`

Decision scoring uses a 1-5 score where 5 is strongest. Weights reflect importance for the first production-grade backend implementation path.

| Criterion | Weight | Requirement |
| --- | ---: | --- |
| Security posture | 10 | Strong isolation, least privilege, revocation, and fail-closed behavior. |
| SecretRef compatibility | 10 | Stable SecretRef ids; backend refs and versions as metadata only. |
| Lease/TTL support | 9 | Short-lived access, lease semantics, renewal policy, and revoke semantics. |
| Rotation support | 8 | Manual first, with a path to scheduled/provider-managed rotation. |
| Versioning support | 7 | Version metadata and rollback support without value exposure. |
| Audit capability | 9 | Backend audit plus Aichestra actor/request/task/provider correlation. |
| IAM/RBAC integration | 9 | Backend identity must align with Aichestra Auth/RBAC and Policy. |
| Multi-tenant/team/project scoping | 8 | Namespace, project, tenant, team, or equivalent policy boundary. |
| Local/integration/staging/production usability | 6 | Supports mock/local workflows and gated staging/production rollout. |
| Operational complexity | 6 | Lower operational burden scores higher, but not at the cost of security. |
| Deployment complexity | 5 | Lower deployment complexity scores higher. |
| Cloud/vendor lock-in | 5 | Lower lock-in scores higher while deployment target is undecided. |
| Self-hosted support | 7 | Important because Aichestra is not cloud-targeted yet. |
| Cost | 4 | Includes managed service cost and operator cost. |
| Backup/restore implications | 6 | Must support recoverability without exposing values. |
| Incident response support | 7 | Emergency disable, rotate, audit, and recovery. |
| Break-glass support | 5 | Future audited emergency access without weakening defaults. |
| Developer experience | 4 | Useful diagnostics without value exposure. |
| Testability | 6 | Unit, contract, mock, and skipped-by-default live tests. |
| Future BYOK/OAuth/WIF/IAM/MCP/Local Agent compatibility | 7 | Must not block future enterprise credential patterns. |

## Weighted Summary

| Backend | Weighted decision result | Notes |
| --- | ---: | --- |
| Vault | highest | Best lease, revocation, audit, namespace, self-hosted, and cloud-neutral posture. |
| AWS Secrets Manager | high | Strong AWS-native option; best when deployment is AWS-first. |
| GCP Secret Manager | high | Strong GCP-native option; deferred until deployment is GCP-first. |
| Azure Key Vault | high | Strong Azure/Entra-native option; deferred until deployment is Azure-first. |
| Custom enterprise backend | medium/future | Potentially valid, but needs a contract and security review first. |
| EnvSecretProvider | low | Local/integration fallback only; not a production default. |
| Mock provider | test-only | Deterministic tests only; never production. |

## Decision Criteria Outcome

Vault wins because cloud target is undecided and Aichestra needs the strongest SecretRef lease/revocation proof first. Cloud-native backends remain valid follow-ups when a hosting environment is selected.
