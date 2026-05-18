# Skill / Harness Compatibility Matrix v1 Plan

Status: v1_planned

## Chosen Docs Path

Per `docs/README.md`, feature-scoped work is filed under `docs/features/<slug>/`. The compatibility matrix is registry-scoped but cross-cuts Skill, Harness, Instruction, Provider/Model, Runner, MCP, Tenant/Repo/Provider Scope, and Policy concerns. To match the rest of the registry hierarchy and avoid mixing concerns into `docs/features/registry/`, this work lives at `docs/features/registry-compatibility-matrix/`.

## Current Behavior

### Skill, Harness, Instruction registry

Skill, Harness, and Instruction artifacts live in `packages/core/src/domain/models.ts` (`SkillPackage`, `HarnessDefinition`/`HarnessPackage`, `InstructionArtifact`). Each carries `status`, `approvalStatus`, `evalStatus`, optional `compatibleAgents`, `compatibleModels`, `requiredTools`, `requiredHarnesses`, and (instructions) `appliesToAgents`, `appliesToRepos`, `appliesToDirectories`, `checksumStatus`. `packages/registry/src/index.ts` implements `RegistryService` and `RegistryResolver`. Default tests cover the v0/v1-hardening/v2-operational-hardening/v3-packaging-versioning surfaces; `instruction-resolver.test.ts` covers selection.

### Registry resolver gates

`selectableRegistryEntry` enforces `status === "active"`, `approvalAllows`, `evalAllows`, and (instructions) `checksumAllows`. The resolver `resolveRegistryContext` calls `resolveSkillEntries`/`resolveHarnessEntry`/`resolveInstructionEntries`, emits warnings/errors, and uses `findRequestedSkill`/`findSelectableHarness`/`highestCompatible` with semver. Lifecycle, approval, eval, checksum, and semver gates are authoritative.

### Tenant/Repo/Provider Scope Model v1

`packages/auth/src/types.ts` defines `TenantScope`, `TeamScope`, `ProjectScope`, `PolicyResourceScope`. `PolicySubject` and `PolicyResource` accept these scopes. Tenant Scope Enforcement v1 records partial enforcement metadata; production tenant isolation remains future.

### Runner / LLM / MCP capability layers

Runners live in `packages/runner` and `packages/llm-gateway`. MCP capability lives in `packages/mcp-gateway`. All are gated/mock by default. Real provider/model/MCP transport is disabled in default runtime/tests.

### Registry / Governance RequestContext Migration v1

`packages/registry/src/index.ts` (`RegistryService` + `RegistryMutationAuthorizer`) and `packages/improvement` use `RequestContext`/`AuthContext` for attribution. Default tests cover service-account fallback metadata.

## Proposed Compatibility Dimensions

Compatibility v1 evaluates these dimensions for a target context:

- `taskKind` (e.g., test_fix, code_mod, conflict_review)
- `taskIntent` (free-form keyword bag from task title/description)
- `repoKind` and `repoLanguages` / `frameworks` / `packageManagers`
- `providerKind` (`mock`, `openai_compatible`, future skeletons) and `modelId` / `modelCapabilities` (e.g., `chat`, `code`, `tool_use`)
- `runnerKind` (`mock`, `local`, future)
- `harnessRequirements` (e.g., `network`, `file_write`, `remote_git`, `secrets`)
- `mcpServerIds` / `mcpToolIds` plus tool-risk levels
- Scope: `tenantId`, `teamId`, `projectId`, `repoId`
- Registry gates: lifecycle, approval, eval, checksum, semver

## Proposed Compatibility Decision Model

For each candidate the service produces a `RegistryCompatibilityDecision`:

- `decision` ∈ {`compatible`, `compatible_with_warnings`, `incompatible`, `blocked_by_policy`, `blocked_by_registry_gate`, `future_unknown`}
- `reasons[]` — short stable strings explaining why
- `warnings[]` — non-blocking concerns
- `blockers[]` — blocking incompatibilities
- `score` — small deterministic integer score (`0..100`)
- `requiredActions[]` — suggested follow-ups (`request_approval`, `attach_eval`, etc.)
- `metadata` — tenant scope summary, resolver-gate snapshot, no-secret-status

Resolver gate findings (`status !== active`, `approvalStatus === pending|rejected`, `evalStatus === pending|failed`, `checksumStatus === mismatch`) always set `decision = blocked_by_registry_gate`. Policy deny sets `decision = blocked_by_policy`. Scope mismatch is `warning` unless the resource scope is `secret_adjacent`, in which case it is `blocking`.

## Proposed Resolver Integration Strategy

Compatibility is advisory metadata in v1. The resolver continues to enforce its existing gates without change. The compatibility service:

- consumes the same `selectableRegistryEntry` predicate so excluded entries always surface as `blocked_by_registry_gate`,
- never adds new selection logic to `resolveRegistryContext`,
- exposes its own service/endpoints (`/registry/compatibility/*`, `/readiness/registry/compatibility/summary`, `/dashboard/registry-compatibility`),
- offers `evaluateCandidates(context)` that callers can read alongside resolver output.

## Dashboard / API / Readiness Plan

Read-only `/registry/compatibility/*` endpoints (GET rules/summary/candidates; POST evaluate/evaluate-many). Read-only `/readiness/registry/compatibility/summary`. Dashboard panel `RegistryCompatibilityReadModel` with rule coverage, candidate counts (compatible / warnings / incompatible / blocked-by-policy / blocked-by-registry-gate / future_unknown), top reasons/blockers, tenant/repo/provider scope summary, resolver-gate relationship, and explicit "no auto-apply" status.

## Safety Constraints

- No external provider/MCP/LLM/vendor CLI calls.
- No registry mutation.
- No bypass of lifecycle / approval / eval / checksum / semver / policy / auth gates.
- No production tenant enforcement.
- No auto-apply of recommendations.
- No exposure of secrets/env values; PR/repo/instruction body content is not returned.
- Default runtime/tests remain mock-first.

## Implemented in This Task

- Models: `RegistryCompatibilityContext`, `SkillCompatibilityProfile`, `HarnessCompatibilityProfile`, `InstructionCompatibilityProfile`, `RegistryCompatibilityRule`, `RegistryCompatibilityDecision`, summary.
- Service: `RegistryCompatibilityService` with deterministic evaluation, seed profiles for the existing seeded skills/harnesses/instructions, summary, and rule listing.
- Default policy actions: `registry.compatibility.read`, `registry.compatibility.evaluate`, `registry.compatibility.matrix.update_future`, `registry.compatibility.override_future`. Read/evaluate allowed; update/override denied.
- API endpoints under `/registry/compatibility/*` and `/readiness/registry/compatibility/summary` (read-only and evaluation-only).
- Dashboard read model + `/dashboard/registry-compatibility` route + rendered HTML panel + demo data provider entry.
- `/health` `registryCompatibility` metadata.
- Deterministic tests covering all required scenarios (resolver preservation, scope warnings, policy deny, no-mutation, no-secret, API/dashboard).
- Documentation: this plan + `v1.md` + cross-references.

## Out of Scope

- Real provider/MCP/LLM execution.
- Auto-apply or registry mutation.
- Production tenant enforcement; scope mismatch remains warning/blocker metadata only.
- Eval/canary execution; the matrix surfaces `requiredActions` only.
- Persistent storage for compatibility profiles (in-memory in v1).
- Skill/Harness/Instruction drift detection (separate planned task).
- Live signed-package trust (separate planned task).

## Recommended Next Task

Eval Suite Execution Harness v1, or Registry Tenant Scope Enforcement v1.
