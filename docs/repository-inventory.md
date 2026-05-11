# Repository Inventory

## Summary

Real Integration Foundation v0 keeps the default runtime in-memory, and Persistent DB v1 adds opt-in Postgres repositories for the core durable slice. Phase 4 improvement/governance stores remain in-memory in v1. Persistence priorities:

- `persistent_required`: must be durable before real provider writes or production usage.
- `persistent_recommended`: should become durable soon, but can be recomputed or mocked during integration planning.
- `ephemeral_ok`: can be derived or request-scoped.
- `test_only`: should remain test fixture infrastructure.

## Phase 1

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---:|---|---|---|---|
| TaskRepository | `InMemoryAichestraStore`; opt-in `PostgresAichestraStore` | persistent_required | `tasks` | `id`, `repo_id`, `status`, `requester_user_id`, `created_at` | Project lifetime | Status changes require audit events. |
| TaskRunRepository | `InMemoryAichestraStore`; opt-in `PostgresAichestraStore` | persistent_required | `task_runs` | `id`, `task_id`, `(task_id, attempt)`, `status` | Project lifetime | Run creation, finish, failure, and retry should be audited. |
| UsageLedgerRepository | `InMemoryAichestraStore.recordUsage`; opt-in `PostgresAichestraStore.recordUsage` | persistent_required | `usage_ledger_entries` | `id`, `task_id`, `task_run_id`, `user_id`, `provider`, `created_at` | Long-lived billing/audit retention | Must preserve taskId/taskRunId attribution. |
| RepoRepository | `InMemoryAichestraStore`; opt-in `PostgresAichestraStore`; used by Real Git Adapter v0 | persistent_required before real Git writes | `repos` | `id`, `(provider, owner, name)` | Project lifetime | Repo creation/config changes should be audited. |
| PullRequestRepository | `InMemoryAichestraStore`; opt-in `PostgresAichestraStore`; used by Real Git Adapter v0 | persistent_required before real Git writes | `pull_requests` | `id`, `task_id`, `repo_id`, `provider`, `external_id`, `status` | Until task/PR archival plus audit retention | PR creation and provider metadata updates require sanitized audit. |
| GitAuditRepository | Generic `AuditLog` via `GitIntegrationService.listGitAuditEvents` | persistent_required before real Git writes | `audit_events` or future `git_audit_events` | `id`, `action`, `repo_id`, `task_id`, `created_at` | Long-lived operational/audit retention | Must not store tokens, secrets, or raw unsafe command output. |

## LLM Gateway

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---|---|---|---|---|
| ModelCatalogRepository | `InMemoryModelCatalogRepository` | persistent_recommended before real LLM providers | `llm_models` | `id`, `provider_kind`, `status` | Project/model lifecycle | Model create/status changes should be audited. |
| VirtualModelKeyRepository | `InMemoryVirtualModelKeyRepository` | persistent_required before real multi-user usage | `virtual_model_keys` | `id`, `owner_kind`, `owner_id`, `status` | Key policy lifecycle | Must not store provider API secrets. Status changes should be audited. |
| LLMAuditRepository | `InMemoryLLMAuditRepository` | persistent_required before real provider calls | `llm_audit_events` | `id`, `task_id`, `task_run_id`, `provider_kind`, `model_id`, `created_at` | Long-lived or compliance retention | Append-only; never log API keys or secrets. |
| LLMGatewayRequestRepository | not implemented; request ids live in result metadata | persistent_recommended before real provider calls | `llm_gateway_requests` | `id`, `task_id`, `task_run_id`, `provider_kind`, `model_id`, `created_at` | Debug/audit retention | Store sanitized request/result metadata only. |
| Policy decision records | Currently implicit in workflow/task status and generic audit | persistent_recommended | `policy_decision_events` or common `audit_events` | `task_id`, `task_run_id`, `decision`, `created_at` | Long-lived for compliance | Policy blocks and approvals should be auditable. |

## Phase 2

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---:|---|---|---|---|
| BranchLeaseRepository | `InMemoryAichestraStore`; opt-in `PostgresAichestraStore` | persistent_required | `branch_leases` | `id`, `repo_id`, `task_run_id`, `status`, `expires_at` | Until task/PR archival plus audit retention | Lease create/release/expire must be auditable. |
| ConflictRiskRepository | Derived by `computeRepoConflictRisks` | persistent_recommended | `conflict_risks` | `repo_id`, `source_task_run_id`, `target_task_run_id`, `risk_score` | Can be recomputed if leases and simulations persist | Store snapshots when used for queue decisions. |
| MergeQueueRepository | `InMemoryAichestraStore`; opt-in `PostgresAichestraStore` | persistent_required | `merge_queue_entries` | `id`, `repo_id`, `status`, `priority`, `task_run_id` | Until PR/task archival | Queue status transitions must be auditable. |
| MergeSimulationResultRepository | `InMemoryAichestraStore`; opt-in `PostgresAichestraStore` | persistent_required | `merge_simulation_results` | `id`, `repo_id`, `task_run_id`, `branch_lease_id`, `status` | Long-lived conflict evidence | Simulation command metadata must remain sanitized. |

## Phase 3

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---:|---|---|---|---|
| SkillRegistryRepository | `InMemoryAichestraStore`; file-backed local repo; opt-in `PostgresAichestraStore` | persistent_required | `skills` | `id`, `(name, version)`, `status`, `approval_status`, `eval_status` | Registry lifetime | Create/update/status/approval/eval changes require audit and revision. |
| HarnessRegistryRepository | Same as Skill | persistent_required | `harnesses` | `id`, `(name, version)`, `status`, `runtime_type` | Registry lifetime | Same as Skill. |
| InstructionRegistryRepository | Same as Skill | persistent_required | `instructions` | `id`, `(name, version)`, `checksum_status`, `scope` | Registry lifetime | Checksum verification and status changes require audit and revision. |
| RegistryAuditRepository | In-memory by default; opt-in Postgres | persistent_required | `registry_audit_logs` | `id`, `target_kind`, `target_id`, `actor_id`, `created_at` | Long-lived or compliance retention | Append-only. |
| RegistryHistoryRepository | In-memory by default; opt-in Postgres | persistent_required | `registry_revisions` | `id`, `target_kind`, `target_id`, `revision_number` | Registry lifetime | Append-only rollback source. |
| RegistryPackageRepository | In-memory/file-backed local; opt-in Postgres | persistent_required | `registry_packages` | `id`, `(name, version)`, `package_kind` | Registry package lifetime | Import/export and package creation should be audited. |
| RegistryEvalResultRepository | In-memory by default; opt-in Postgres | persistent_required | `registry_eval_results` | `id`, `target_kind`, `target_id`, `status`, `attached_at` | Long-lived evidence retention | Attachment and status update audit. |
| ApprovalQueue read model | Derived in `RegistryService.listApprovalQueue` | ephemeral_ok | `registry_approval_queue_view` | `approval_status`, `target_kind`, `owner` | Rebuild from registry tables | No separate audit; source mutations are audited. |

## Phase 4

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---:|---|---|---|---|
| FailureSignalRepository | `InMemoryImprovementRepository` | persistent_required | `failure_signals` | `id`, `source_type`, `source_id`, `task_run_id`, `target_kind`, `category` | Retain for improvement analysis window | Manual signal creation should be auditable later. |
| FailureClusterRepository | `InMemoryImprovementRepository` | persistent_required | `failure_clusters` | `id`, `category`, `target_kind`, `target_ref`, `status` | Retain while proposals reference clusters | Status changes should be audited. |
| ImprovementCandidateRepository | `InMemoryImprovementRepository` | persistent_required | `improvement_candidates` | `id`, `source_cluster_id`, `target_kind`, `target_id`, `status` | Retain while proposals exist | Triage decisions should be auditable. |
| ImprovementProposalRepository | `InMemoryImprovementRepository` | persistent_required | `improvement_proposals` | `id`, `candidate_id`, `target_kind`, `target_id`, `status` | Long-lived governance evidence | Status changes and decisions require audit. |
| DraftRegistryChangeRepository | `InMemoryImprovementRepository` | persistent_required | `draft_registry_changes` | `id`, `proposal_id`, `target_kind`, `target_id`, `status` | Retain with proposal history | Must prove no active mutation occurred. |
| ProposalReadinessRepository | `InMemoryImprovementRepository` | persistent_recommended | `proposal_readiness` | `proposal_id`, `evaluated_at` | Latest plus history if needed | Apply gate decisions should reference readiness. |
| ProposalGovernanceDecisionRepository | `InMemoryImprovementRepository` | persistent_required | `proposal_governance_decisions` | `id`, `proposal_id`, `actor_id`, `decision`, `created_at` | Long-lived governance retention | Append-only. |
| ProposalEvalRunRepository | `InMemoryImprovementRepository` | persistent_required | `proposal_eval_runs` | `id`, `proposal_id`, `eval_requirement_id`, `status` | Long-lived evidence retention | Attachment must be audited. |
| CanaryReadinessRepository | `InMemoryImprovementRepository` | persistent_recommended | `canary_readiness` | `proposal_id`, `evaluated_at` | Latest plus optional history | Readiness checks should be auditable. |
| ProposalApplyGateRepository | `InMemoryImprovementRepository` | persistent_required before apply | `proposal_apply_gates` | `proposal_id`, `can_apply`, `evaluated_at` | Long-lived for apply governance | Apply-gate and blocked apply attempts must be audited. |
| ImprovementGovernanceAuditRepository | `InMemoryImprovementRepository` | persistent_required | `improvement_governance_audit_events` | `id`, `proposal_id`, `action`, `actor_id`, `created_at` | Long-lived or compliance retention | Append-only. |

## Test Infrastructure

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---:|---|---|---|---|
| In-memory storage provider | `createInMemoryStorageProvider` | test_only | none | none | Test lifetime | None. |
| Persistent storage provider placeholder | `createPersistentStorageProviderPlaceholder` | test_only | none | none | Not runtime storage | Throws clear not-implemented errors. |
| Postgres storage provider | `createPostgresStorageProvider` | persistent_required for integration environments | Postgres schema in `infra/migrations/0001_initial_aichestra_schema.sql` | Repository-specific indexes above | Environment lifetime | Health check and contract tests are opt-in. |
