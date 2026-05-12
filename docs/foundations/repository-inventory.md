# Repository Inventory

## Summary

Real Integration Foundation v0 keeps the default runtime in-memory, and Persistent DB v1 adds opt-in Postgres repositories for the core durable slice. Phase 4 improvement/governance stores remain in-memory in v1. Persistence priorities:

- `persistent_required`: must be durable before real provider writes or production usage.
- `persistent_recommended`: should become durable soon, but can be recomputed or mocked during integration planning.
- `ephemeral_ok`: can be derived or request-scoped.
- `test_only`: should remain test fixture infrastructure.

## Dashboard Read Models

Dashboard API-backed Read Model v0 does not add persistent storage. `/dashboard/*` routes derive read-only DTOs from existing repositories, service config, and audit repositories, then sanitize output through shared read-model helpers. `DemoDashboardDataProvider` remains a test/offline fixture path and is not production persistence.

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---:|---|---|---|---|
| DashboardReadModels | Derived in `apps/api/src/dashboard-read-model.ts`; consumed by `ApiDashboardDataProvider` | ephemeral_ok | future materialized dashboard views only if needed | section, generated_at, tenant/project when auth exists | Recompute from source tables | Must not trigger workflows/provider calls or expose secrets/tokens/unredacted logs. |
| Dashboard demo fallback | `DemoDashboardDataProvider` over deterministic `apps/web/lib/mock-data.ts` fixtures | test_only | none | none | Test/offline render lifetime | Must remain explicit and must not be used as production state. |

## Phase 1

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---:|---|---|---|---|
| TaskRepository | `InMemoryAichestraStore`; opt-in `PostgresAichestraStore` | persistent_required | `tasks` | `id`, `repo_id`, `status`, `requester_user_id`, `created_at` | Project lifetime | Status changes require audit events. |
| TaskRunRepository | `InMemoryAichestraStore`; opt-in `PostgresAichestraStore` | persistent_required | `task_runs` | `id`, `task_id`, `(task_id, attempt)`, `status` | Project lifetime | Run creation, finish, failure, and retry should be audited. |
| UsageLedgerRepository | `InMemoryAichestraStore.recordUsage`; opt-in `PostgresAichestraStore.recordUsage` | persistent_required | `usage_ledger_entries` | `id`, `task_id`, `task_run_id`, `user_id`, `provider`, `created_at` | Long-lived billing/audit retention | Must preserve taskId/taskRunId attribution. |
| RepoRepository | `InMemoryAichestraStore`; opt-in `PostgresAichestraStore`; used by Real Git Adapter v1 | persistent_required before real Git writes | `repos` | `id`, `(provider, owner, name)` | Project lifetime | Repo creation/config changes and remote config validation should be audited. |
| PullRequestRepository | `InMemoryAichestraStore`; opt-in `PostgresAichestraStore`; used by Real Git Adapter v1 | persistent_required before real Git writes | `pull_requests` | `id`, `task_id`, `repo_id`, `provider`, `external_id`, `status` | Until task/PR archival plus audit retention | PR creation and provider metadata updates require sanitized audit. GitHub PR numbers are stored as provider external ids. |
| GitAuditRepository | Generic `AuditLog` via `GitIntegrationService.listGitAuditEvents` | persistent_required before real Git writes | `audit_events` or future `git_audit_events` | `id`, `action`, `repo_id`, `task_id`, `created_at` | Long-lived operational/audit retention | Must not store tokens, secrets, raw credentials, or raw unsafe command output. v1 remote branch/PR/changed-file events use sanitized metadata. |

## LLM Gateway

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---|---|---|---|---|
| ModelCatalogRepository | `InMemoryModelCatalogRepository` | persistent_recommended before real LLM providers | `llm_models` | `id`, `provider_kind`, `status` | Project/model lifecycle | Model create/status changes should be audited. |
| VirtualModelKeyRepository | `InMemoryVirtualModelKeyRepository` | persistent_required before real multi-user usage | `virtual_model_keys` | `id`, `owner_kind`, `owner_id`, `status` | Key policy lifecycle | Must not store provider API secrets. Status changes should be audited. |
| LLMAuditRepository | `InMemoryLLMAuditRepository` | persistent_required for LLM Gateway v1 remote calls before production usage | `llm_audit_events` | `id`, `task_id`, `task_run_id`, `provider_kind`, `model_id`, `created_at` | Long-lived or compliance retention | Append-only; never log API keys, bearer tokens, raw prompts, unredacted output, or credential cache contents. |
| LLMGatewayRequestRepository | not implemented; request ids live in result metadata | persistent_recommended before production real provider calls | `llm_gateway_requests` | `id`, `task_id`, `task_run_id`, `provider_kind`, `model_id`, `created_at` | Debug/audit retention | Store sanitized request/result metadata only. LLM Gateway v1 does not persist raw requests. |
| ProviderCatalogRepository | `InMemoryProviderCatalogRepository` | persistent_recommended before real enterprise provider management | `provider_catalog_entries` | `id`, `vendor`, `kind`, `status` | Provider lifecycle | Auth config must contain references only, never raw tokens or credential cache paths. |
| ProviderAuditRepository | `InMemoryProviderAuditRepository` | persistent_required before real provider calls or Local Agent invocation | `provider_audit_events` | `id`, `provider_id`, `event_type`, `task_id`, `task_run_id`, `created_at` | Compliance/audit retention | Append-only; sanitized metadata only; no raw prompts, tokens, or credential cache contents. |
| LocalAgentRegistrationRepository | `InMemoryLocalAgentRegistrationRepository` in `packages/llm-gateway` | persistent_required before real Local Agent pairing | `local_agent_registrations` | `id`, `user_id`, `host_id`, `status`, `last_seen_at` | Agent connection lifecycle | Must not store vendor credentials or local credential cache content. |
| LocalAgentSessionRepository | `InMemoryLocalAgentSessionRepository` | persistent_required before real Local Agent sessions | `local_agent_sessions` | `id`, `agent_id`, `user_id`, `status`, `expires_at` | Session lifecycle plus audit retention | Session metadata only; no bearer tokens or provider credentials. |
| LocalAgentChannelRepository | `InMemoryLocalAgentChannelRepository` | persistent_required before real Local Agent pairing | `local_agent_channels` | `id`, `agent_id`, `user_id`, `status`, `channel_kind`, `expires_at` | Channel lifecycle and consent evidence | Mock channel metadata only; no real transport keys or credential material. |
| LocalAgentHandshakeRepository | `InMemoryLocalAgentHandshakeRepository` | persistent_required before real Local Agent pairing | `local_agent_handshakes` | `id`, `channel_id`, `agent_id`, `response_status`, `expires_at` | Pairing lifecycle evidence | Mock challenges only; no production private keys or credential cache content. |
| LocalAgentCapabilityAdvertisementRepository | `InMemoryLocalAgentCapabilityAdvertisementRepository` | persistent_required before real Local Agent compatibility enforcement | `local_agent_capability_advertisements` | `id`, `agent_id`, `agent_version`, `advertised_at` | Agent capability history | Capabilities are not permissions; no secrets. |
| LocalCliCompatibilityRepository | `InMemoryLocalCliCompatibilityRepository` | persistent_recommended before real Local Agent compatibility enforcement | `local_cli_compatibility_entries`, `local_cli_compatibility_results` | `provider_template_id`, `agent_id`, `provider_id`, `created_at` | Compatibility audit/debug retention | Fixture versions and parser metadata only; no real CLI execution output. |
| LocalAgentInvocationEnvelopeRepository | `InMemoryLocalAgentInvocationEnvelopeRepository` | persistent_required before real Local Agent dispatch | `local_agent_invocation_envelopes` | `id`, `task_id`, `task_run_id`, `provider_id`, `local_agent_id`, `created_at` | Retain with invocation/audit history | Envelope stores refs, hashes, policy ids, and mock signature status only; no raw prompts or secrets. |
| LocalAgentInvocationRepository | `InMemoryLocalAgentInvocationRepository` | persistent_required before real Local Agent dispatch | `local_agent_invocations` | `id`, `envelope_id`, `state`, `created_at`, `completed_at` | Retain with task/run history | Lifecycle transitions and redaction status must be auditable. |
| LocalAgentConsentRequestRepository | `InMemoryLocalAgentConsentRequestRepository` | persistent_required before real Local Agent dispatch | `local_agent_consent_requests` | `id`, `invocation_id`, `user_id`, `consent_level`, `expires_at` | Consent evidence retention | Consent request reasons must be sanitized. |
| LocalAgentConsentDecisionRepository | `InMemoryLocalAgentConsentDecisionRepository` | persistent_required before real Local Agent dispatch | `local_agent_consent_decisions` | `id`, `consent_request_id`, `user_id`, `decision`, `decided_at` | Consent evidence retention | Append-only consent decisions; no raw secrets. |
| LocalAgentInvocationStreamRepository | `InMemoryLocalAgentInvocationStreamRepository` | persistent_required before real Local Agent output retention | `local_agent_invocation_streams` | `id`, `invocation_id`, `state`, `started_at` | Bounded event retention | Stream state only; no raw unredacted output. |
| LocalAgentStreamEventRepository | `InMemoryLocalAgentStreamEventRepository` | persistent_required before real Local Agent output retention | `local_agent_stream_events` | `stream_id`, `invocation_id`, `sequence`, `source` | Bounded event retention | Store size-limited redacted previews only. |
| LocalAgentNormalizedEventRepository | `InMemoryLocalAgentNormalizedEventRepository` | persistent_required before real Local Agent output retention | `local_agent_normalized_events` | `id`, `invocation_id`, `source`, `type`, `created_at` | Bounded event retention | Store size-limited redacted stdout/stderr/system payloads only. |
| LocalAgentProtocolAuditRepository | `InMemoryLocalAgentProtocolAuditRepository` | persistent_required before real Local Agent dispatch | `local_agent_protocol_audit_events` | `id`, `event_type`, `agent_id`, `invocation_id`, `task_id`, `task_run_id`, `created_at` | Long-lived compliance retention | Append-only; no provider API keys, bearer tokens, OAuth tokens, or credential cache contents. |
| PolicyDecisionAuditRepository | `InMemoryPolicyDecisionAuditRepository` in `packages/policy`; schema skeleton only for Postgres | persistent_required before real provider integrations | `policy_decision_audit_entries` | `policy_decision_id`, `action`, `resource_kind`, `actor_id`, `task_id`, `task_run_id`, `created_at` | Long-lived for compliance | Append-only; must not store secrets or raw prompts. |

## Policy-as-code

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---|---|---|---|---|
| PolicyRule store | Static code-defined rules in `createDefaultPolicyRules` | persistent_recommended before production policy management | `policy_rules` future table or versioned policy bundle store | `id`, `action`, `resource_kind`, `enabled`, `priority` | Policy bundle lifecycle | Rule changes must be reviewed and audited. Not implemented in v0. |
| PolicyDecisionAuditRepository | `InMemoryPolicyDecisionAuditRepository` | persistent_required before real integrations | `policy_decision_audit_entries` | `policy_decision_id`, `action`, `resource_kind`, `actor_id`, `task_id`, `task_run_id`, `created_at` | Compliance/audit retention | Store decision summaries only; no secrets, tokens, API keys, or raw prompts. |

## Local Agent Runner

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---|---|---|---|---|
| AgentRunRepository | `InMemoryAgentRunRepository` in `packages/runner` | persistent_required before controlled local execution | `agent_runs` | `id`, `task_id`, `task_run_id`, `runner_kind`, `status`, `created_at` | Retain with TaskRun history | Runner start, completion, failure, and block status should be auditable. |
| AgentRunAuditRepository | `InMemoryAgentRunAuditRepository` in `packages/runner` | persistent_required before controlled local execution | `agent_run_audit_events` | `id`, `task_id`, `task_run_id`, `runner_kind`, `event_type`, `created_at` | Long-lived operational/audit retention | Append-only; never store secrets or unsafe command output. |
| InstructionAssemblyRepository | `InMemoryInstructionAssemblyRepository` in `packages/runner` | persistent_recommended before real runner execution | `instruction_assemblies` | `id`, `task_id`, `task_run_id`, `instruction_set_hash` | Retain with TaskRun history | Must preserve selected refs and hash used for runner input. |
| AgentWorkspaceRepository | `InMemoryAgentWorkspaceRepository` in `packages/runner` | persistent_recommended before wider local runner use | `agent_workspaces` | `id`, `task_id`, `task_run_id`, `status`, `created_at` | Retain with AgentRun history | Workspace status and cleanup must be auditable; never store secrets or workspace contents. |
| CommandExecutionResultRepository | `InMemoryCommandExecutionResultRepository` in `packages/runner` | persistent_recommended before wider local runner use | `command_execution_results` | `id`, `agent_run_id`, `task_id`, `task_run_id`, `status`, `created_at` | Retain bounded previews with AgentRun history | Store size-limited sanitized previews only; blocked/timeout reasons should be auditable. |

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

## Secrets and Sandbox

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---|---|---|---|---|
| SecretRefRepository | `InMemorySecretRefRepository` in `packages/security`; extended by SecretRef-backed Provider Credentials v1 | persistent_required before real secret backend integration | `secret_refs` | `id`, `provider`, `secret_kind`, `scope`, `status`, `env_key` | Secret reference lifecycle | Must never store raw secret values, env var values, or credential cache paths. `env_key` is a reference only. |
| SecretScopeRepository | `InMemorySecretScopeRepository` | persistent_required before production secret leasing | `secret_scopes` | `id`, `requires_approval` | Scope/policy lifecycle | Scope changes must be audited before production. |
| SecretLeaseRepository | `InMemorySecretLeaseRepository` | persistent_required before any real secret issuance | `secret_leases` | `id`, `secret_ref_id`, `scope_id`, `task_id`, `task_run_id`, `status`, `expires_at` | Lease lifecycle plus compliance retention | Lease requests, denials, metadata credential handle issuance, expiration, and revocation must be audited without secret values. |
| SecretAccessDecisionRepository | `InMemorySecretAccessDecisionRepository` | persistent_required before real secret issuance | `secret_access_decisions` | `id`, `secret_ref_id`, `scope_id`, `actor_id`, `task_id`, `task_run_id`, `created_at` | Compliance/audit retention | Decision records must link to policy decisions and never contain raw secrets. |
| SandboxProfileRepository | `InMemorySandboxProfileRepository` | persistent_required before production sandbox configuration | `sandbox_profiles` | `id`, `kind`, `status` | Sandbox profile lifecycle | Profile changes require review/audit. Future container/Firecracker/Kubernetes profiles remain disabled placeholders. |
| SandboxSessionRepository | `InMemorySandboxSessionRepository` | persistent_recommended before broader local runner use | `sandbox_sessions` | `id`, `profile_id`, `task_id`, `task_run_id`, `runner_kind`, `status`, `created_at` | Retain with AgentRun history | Session create/complete/cleanup must be audited. |
| SandboxDecisionRepository | `InMemorySandboxDecisionRepository` | persistent_required before production sandbox use | `sandbox_decisions` | `id`, `profile_id`, `task_id`, `task_run_id`, `actor_id`, `created_at` | Compliance/audit retention | Decisions should link to policy decisions. |
| NetworkEgressPolicyRepository | `InMemoryNetworkEgressPolicyRepository` | persistent_required before real network egress controls | `network_egress_policies` | `id`, `status`, `default_action` | Network policy lifecycle | Policy changes and blocked egress decisions require audit. |
| RedactionPolicyRepository | `InMemoryRedactionPolicyRepository` | persistent_required before real provider output retention | `redaction_policies` | `id`, `status`, `retention_class` | Redaction policy lifecycle | Policy changes require audit/review before production. |
| SecurityAuditRepository | `InMemorySecurityAuditRepository` | persistent_required before real secrets/sandbox/provider integrations | `security_audit_events` | `id`, `event_type`, `target_kind`, `task_id`, `task_run_id`, `actor_id`, `created_at` | Long-lived compliance retention | Append-only; metadata must be sanitized and must not contain secrets, tokens, credential cache contents, or raw prompts. |
| CredentialHandleRepository | Not persisted in v1; handles are returned as metadata-only resolution results | persistent_recommended before production credential resolution | `credential_handles` future table | `id`, `secret_ref_id`, `secret_kind`, `status`, `expires_at` | Short-lived resolution evidence | Must never store raw credential values; link to policy and audit events only. |

## Test Infrastructure

| Repository or Store | Current Implementation | Priority | Recommended Table | Key Indexes | Retention | Audit Requirements |
|---|---|---:|---|---|---|---|
| In-memory storage provider | `createInMemoryStorageProvider` | test_only | none | none | Test lifetime | None. |
| Persistent storage provider placeholder | `createPersistentStorageProviderPlaceholder` | test_only | none | none | Not runtime storage | Throws clear not-implemented errors. |
| Postgres storage provider | `createPostgresStorageProvider` | persistent_required for integration environments | Postgres schema in `infra/migrations/0001_initial_aichestra_schema.sql` | Repository-specific indexes above | Environment lifetime | Health check and contract tests are opt-in. |
