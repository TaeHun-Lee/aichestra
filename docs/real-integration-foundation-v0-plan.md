# Real Integration Foundation v0 Plan

## Current Phase Status

- Phase 1: `complete_for_current_milestone`
- Phase 2: `complete_for_current_milestone`
- Phase 3: `v3_implemented`
- Phase 4: `v1_implemented`
- Phase 5: `planned_only`

## Current Validation Status

Latest known baseline before this task:

- `pnpm lint`: pass
- `pnpm typecheck`: pass
- `pnpm test`: pass, 84 tests
- `pnpm build`: pass
- Mock-only compliance: intact

## Repository Interfaces Currently Present

Core store and ledger:

- `InMemoryAichestraStore` in `packages/db/src/repository.ts`
- `UsageLedger` and `MockUsageLedger` in `packages/db/src/usage-ledger.ts`

Registry:

- `SkillRegistryRepository`
- `HarnessRegistryRepository`
- `InstructionRegistryRepository`
- `RegistryAuditRepository`
- `RegistryHistoryRepository`
- `RegistryEvalResultRepository`
- `RegistryPackageRepository`

Improvement and governance:

- `FailureSignalRepository`
- `FailureClusterRepository`
- `ImprovementCandidateRepository`
- `ImprovementProposalRepository`
- `EvalRequirementRepository`
- `CanaryRolloutPlanRepository`
- `AutoImprovementSafetyPolicyRepository`
- `AutoImprovementAnalysisRepository`
- `DraftRegistryChangeRepository`
- `ProposalReadinessRepository`
- `ProposalGovernanceDecisionRepository`
- `ProposalEvalRunRepository`
- `CanaryReadinessRepository`
- `ProposalApplyGateRepository`
- `ImprovementGovernanceAuditRepository`

## In-Memory-Only Repositories

- Task, TaskRun, branch lease, merge simulation, merge queue, pull request, usage, and generic audit storage are currently held by `InMemoryAichestraStore`.
- Phase 4 improvement and governance storage is currently held by `InMemoryImprovementRepository`.
- Registry storage has `InMemoryRegistryRepository` and file-backed local storage, but the API and worker default to the seeded in-memory store.

## Data That Must Become Persistent Before Real Integrations

Persistent required:

- Tasks and TaskRuns.
- Usage ledger entries.
- Branch leases.
- Merge simulations and merge queue entries.
- Pull requests and provider identifiers.
- Registry entities, audit logs, revisions, eval results, and package manifests.
- Improvement proposals, draft registry changes, governance decisions, eval runs, readiness, apply gates, and governance audit events.
- Common audit events.

## Data That Can Remain Ephemeral

Ephemeral is acceptable for:

- Request-scoped DTOs.
- Derived dashboard read models if they can be rebuilt from persistent state.
- Recomputed conflict risk scores, as long as leases and simulation evidence are persistent.
- Temporary local merge simulation work directories.

## Current Audit/Event Storage Limitations

- Generic task audit events are in-memory.
- Registry audit logs and revisions are in-memory in the default runtime.
- Improvement governance audit events are in-memory.
- There is no common append-only event store yet.
- Audit retention, export, tamper evidence, and compliance controls remain future work.

## Current Mock Actor/Auth Limitations

- Registry mutation authorization uses mock actors and mock RBAC.
- Governance decisions use deterministic mock actor behavior.
- API routes do not authenticate callers.
- There is no SSO, SCIM, session model, access token model, or production authorization middleware.

## What This Task Implements

- Storage provider and repository factory abstraction.
- In-memory storage provider that exposes current repositories through injectable contracts.
- Persistent storage provider placeholder that fails clearly instead of pretending to be wired.
- Repository inventory.
- Postgres-oriented schema design.
- SQL migration skeleton.
- Repository contract tests for current in-memory repositories.
- Auth/RBAC readiness documentation.
- Real Git Adapter v0 readiness documentation.
- Dashboard read model plan.
- Real integration roadmap.

## Out of Scope

- Live Postgres connectivity.
- Prisma client wiring.
- Real GitHub, GitLab, or Bitbucket adapters.
- Real LLM gateway.
- Real auth/RBAC, SSO, SCIM, or secrets integration.
- MCP, Vault, Kubernetes, Temporal, or artifact registry integrations.
- Automatic registry mutation or Phase 4 apply behavior.
