# AICHESTRA Codex Work Orders: Phase 3 Operational Hardening → Phase 4 Auto-improvement

This document contains sequential Codex work orders for the next recommended Aichestra development path.

Recommended order:

1. **Phase 3 Operational Hardening v2**
2. **Phase 3 Packaging & Versioning v3**
3. **Phase 4 Preparation**
4. **Phase 4 Auto-improvement v0**

Use these work orders one at a time. Do not ask Codex to execute all four phases in one task. Each work order should produce a validated PR or branch before proceeding to the next one.

---

## Current Assumed Project State

The latest reported status is:

```text
Phase 1: complete_for_current_milestone
Phase 2: complete_for_current_milestone
Phase 3: v1_implemented
Phase 4: planned_only
Phase 5: planned_only
```

Latest validation reported:

```text
pnpm lint: pass
pnpm typecheck: pass
pnpm test: pass, 54 tests
pnpm build: pass
pnpm install: not run; no dependency metadata changes required it
```

Current known limitations:

```text
No signed artifacts.
No real artifact registry.
No full approval workflow.
No eval suite execution.
No rollback.
No semver range resolution.
No import/export.
No registry mutation auth/RBAC.
No policy-as-code enforcement.
```

---

## Global Rules for All Work Orders

Codex must follow these rules in every phase below.

```text
Do not add real GitHub/GitLab/Bitbucket integration.
Do not call real LLM providers.
Do not add MCP integration.
Do not add Vault, Kubernetes, Temporal, or production deployment code.
Do not perform real remote git operations.
Do not add real artifact registry integration unless the specific work order explicitly says to design only, not integrate.
Do not implement signed artifact verification unless explicitly requested in a later phase.
Do not implement real SSO/SCIM/auth provider integration.
Keep mock-first architecture.
Keep all provider behavior behind interfaces.
Preserve existing Phase 1 task orchestration.
Preserve existing Phase 2 Conflict Manager behavior.
Preserve existing Phase 3 Registry APIs unless additive DTO changes are needed.
Skill, Harness, and InstructionArtifact must remain separate domain concepts.
All new features must be covered by deterministic tests.
Run validation before final reporting.
```

Standard validation:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm install` only when dependency metadata changes or the repository guidance requires it.

---

# Work Order 1 — Phase 3 Operational Hardening v2

## Codex Prompt

```text
Read the current repository carefully before making changes.

Relevant guidance files may include:
- AGENTS.md
- README.md
- AICHESTRA_BOOTSTRAP.md, if present
- aichestra_codex_bootstrap.md, if present
- AICHESTRA_CODEX_NEXT_STEPS.md, if present
- AICHESTRA_CODEX_CONFLICT_MANAGER_V0.md, if present
- docs/audits/2026-05-11-bootstrap-gap-report.md, if present
- docs/audits/2026-05-11-phase-progress-audit.md, if present
- docs/audits/2026-05-11-phase-1-2-completion-audit.md, if present
- docs/audits/2026-05-11-phase-2-completion-gap.md, if present
- docs/features/conflict-manager/v0.md, if present
- docs/features/conflict-manager/v1.md, if present
- docs/features/registry/v0.md, if present
- docs/features/registry/v1-hardening.md, if present
- docs/audits/2026-05-11-phase-3-completion-gap.md, if present

Your task is to implement Phase 3 Operational Hardening v2.

Context:
The latest result reported:

- Phase 1: complete_for_current_milestone
- Phase 2: complete_for_current_milestone
- Phase 3: v1_implemented
- Phase 4: planned_only
- Phase 5: planned_only

Known remaining limitations include:

- no signed artifacts
- no real artifact registry
- no full approval workflow
- no eval suite execution
- no rollback
- no semver range resolution
- no import/export
- no registry mutation auth/RBAC
- no policy-as-code enforcement

Do not proceed to Phase 4 yet.

This task is not about automatic improvement.
This task is to continue hardening Phase 3 so Registry changes become traceable, reviewable, reversible, and authorization-aware.

Goal:
Implement Phase 3 Operational Hardening v2 by adding registry history, rollback, approval queue read models, local eval result attachment, and registry mutation auth/RBAC design with mock enforcement.

Important constraints:
- Do not add real GitHub/GitLab/Bitbucket integration.
- Do not call real LLM providers.
- Do not add MCP integration.
- Do not add Vault, Kubernetes, Temporal, or production deployment code.
- Do not perform real remote git operations.
- Do not add real artifact registry integration.
- Do not implement signed artifact verification yet.
- Do not implement automatic Skill/Harness/Instruction improvement yet.
- Do not implement real SSO/SCIM/auth provider integration.
- Keep mock-first architecture.
- Keep all provider behavior behind interfaces.
- Preserve existing Phase 1 task orchestration.
- Preserve existing Phase 2 Conflict Manager behavior.
- Preserve existing Phase 3 Registry v1 APIs unless additive DTO changes are needed.
- Skill, Harness, and InstructionArtifact must remain separate domain concepts.

## 1. Pre-implementation audit

Before implementing, create or update:

docs/features/registry/v2-operational-hardening-plan.md

The plan must include:
- current Phase 3 v1 capabilities
- current registry repository boundary
- current DTO boundary
- current audit log behavior
- current approval/eval/checksum behavior
- whether registry history exists
- whether rollback exists
- whether approval queue read models exist
- whether eval result attachment exists
- whether mutation auth/RBAC exists
- what this v2 task will implement
- what remains out of scope

If any critical Phase 1, Phase 2, or Phase 3 v1 blocker is discovered, stop implementation and create:

docs/phase-3-v2-blocked.md

That document must include:
- blocker
- evidence
- recommended fix
- no application code changes made beyond documentation

## 2. Add registry history

Add a registry history model.

Suggested domain model:

RegistryRevision
- id
- targetKind: skill | harness | instruction
- targetId
- targetName
- targetVersion
- revisionNumber
- snapshot
- snapshotChecksum
- changeReason, optional
- createdBy
- createdAt
- sourceAuditLogId, optional

Requirements:
- Registry create operations should create revision 1.
- Registry update operations should create a new revision.
- Status changes should create a new revision.
- Approval status changes should create a new revision.
- Eval status changes should create a new revision.
- Instruction checksum verification should create a new revision if it changes checksum metadata.
- Revisions must be append-only.
- Do not delete previous revisions.
- Do not mutate old revisions.
- History must be queryable through repository interfaces and API.

Add or extend repository interfaces:

RegistryHistoryRepository:
- appendRevision
- listRevisionsForTarget
- getRevision
- getLatestRevisionForTarget

## 3. Add rollback support

Add rollback support for Skill, Harness, and InstructionArtifact.

Suggested domain models:

RegistryRollbackRequest:
- targetKind
- targetId
- targetRevisionId or revisionNumber
- actorId
- reason

RegistryRollbackResult:
- targetKind
- targetId
- rolledBackFromRevision
- rolledBackToRevision
- newRevision
- auditLogId
- createdAt

Rollback rules:
- Rollback must not delete history.
- Rollback must create a new revision representing the restored state.
- Rollback must append an audit log entry.
- Rollback should preserve identity fields where appropriate.
- Rollback should clearly mark that it was created by rollback.
- Rollback must validate that the target revision exists.
- Rollback must fail clearly if targetKind or targetId is invalid.
- Rollback should not bypass approval/eval/checksum rules silently.
- After rollback, RegistryResolver should apply the normal selection rules to the restored item.

Suggested new audit action:
- rollback

Suggested API endpoints:
- GET /registry/skills/:id/history
- POST /registry/skills/:id/rollback
- GET /registry/harnesses/:id/history
- POST /registry/harnesses/:id/rollback
- GET /registry/instructions/:id/history
- POST /registry/instructions/:id/rollback

## 4. Add approval queue read models

Do not implement a full multi-user approval workflow yet.

Implement a read model that makes pending registry approvals visible.

Suggested model:

RegistryApprovalQueueItem
- id
- targetKind: skill | harness | instruction
- targetId
- targetName
- targetVersion
- approvalStatus
- requestedBy
- requestedAt
- reason, optional
- currentStatus
- evalStatus
- checksumStatus, optional
- blockingReasons
- recommendedAction

Rules:
- Items with approvalStatus = pending should appear in the approval queue.
- Items with approvalStatus = rejected may optionally appear in a rejected view.
- Approved and not_required items should not appear in the pending queue.
- Archived items should not appear in the pending queue unless explicitly requested.
- Queue ordering should be deterministic.
- The queue should be read-only for v2 unless existing approval update endpoints already support status changes.
- The queue should not create a real workflow engine dependency.

Suggested API endpoint:
- GET /registry/approval-queue

Optional query filters:
- targetKind
- approvalStatus
- owner
- includeArchived

Dashboard:
- Show a simple approval queue panel.
- Show target kind, name, version, status, eval status, checksum status, and recommended action.

## 5. Add local eval result attachment

Do not implement eval suite execution yet.
Do not run LLM-based evaluation.
Do not run remote evaluation services.

Implement the ability to attach local or manually supplied eval result metadata to registry entries.

Suggested domain model:

RegistryEvalResult
- id
- targetKind: skill | harness | instruction
- targetId
- targetName
- targetVersion
- evalName
- evalType: local | manual | mock
- status: passed | failed | pending | skipped
- score, optional
- maxScore, optional
- summary
- details, optional
- attachedBy
- attachedAt
- source: local_fixture | manual | mock
- artifactRef, optional

Rules:
- Attaching an eval result must append an audit log.
- Attaching an eval result may update evalStatus if requested.
- If eval result status is passed and updateEvalStatus is true, set evalStatus = passed.
- If eval result status is failed and updateEvalStatus is true, set evalStatus = failed.
- RegistryResolver should continue to use evalStatus, not raw eval result details.
- Eval results must be queryable by target.
- Eval result attachment must not call external services.

Suggested API endpoints:
- GET /registry/skills/:id/eval-results
- POST /registry/skills/:id/eval-results
- GET /registry/harnesses/:id/eval-results
- POST /registry/harnesses/:id/eval-results
- GET /registry/instructions/:id/eval-results
- POST /registry/instructions/:id/eval-results

Dashboard:
- Show latest eval result summary for each registry item.
- Show evalStatus separately from attached eval result details.

## 6. Add registry mutation auth/RBAC design and mock enforcement

Do not add real SSO, SCIM, OAuth, or external auth provider integration.

Add a provider-agnostic authorization interface for registry mutations.

Suggested domain models:

RegistryActor:
- id
- displayName
- roles
- teams, optional

RegistryRole:
- registry_viewer
- registry_editor
- registry_reviewer
- registry_admin
- system

RegistryPermission:
- registry.read
- registry.create
- registry.update
- registry.status.change
- registry.approval.change
- registry.eval.change
- registry.checksum.verify
- registry.rollback
- registry.audit.read
- registry.history.read

MutationAuthorizationDecision:
- allowed
- reason
- requiredPermission
- actorId
- targetKind, optional
- targetId, optional

Suggested interface:

RegistryMutationAuthorizer:
- authorize(actor, permission, target)

Rules:
- Read-only registry listing should require registry.read.
- Audit log reading should require registry.audit.read.
- History reading should require registry.history.read.
- Create/update/status changes should require editor or admin permission.
- Approval changes should require reviewer or admin permission.
- Eval status changes and eval attachment should require reviewer or admin permission.
- Rollback should require admin permission.
- System actor may perform seed/setup actions.
- All denied mutations should fail clearly and should not mutate state.

Mock enforcement:
- Implement a mock or in-memory authorizer for tests.
- If the API layer has no real authentication, use a safe mock actor context through existing project conventions.
- Do not pretend this is production auth.
- Document clearly that real auth integration is future work.

## 7. Preserve RegistryResolver behavior

RegistryResolver must continue to enforce:
- lifecycle status
- approvalStatus
- evalStatus
- instruction checksumStatus

After v2, also ensure:
- rollback does not bypass resolver gates
- attached eval results only affect selection through evalStatus
- pending approval queue does not affect selection except through approvalStatus
- unauthorized mutations cannot change resolver outcomes

TaskRun should continue to record:
- selectedSkillRefs
- selectedHarnessRef
- selectedInstructionRefs
- registryResolutionWarnings
- registryResolutionErrors

## 8. Update API DTOs

Add stable DTOs and mappers for new concepts.

Required DTOs:
- RegistryRevisionDto
- RegistryRollbackRequestDto
- RegistryRollbackResultDto
- RegistryApprovalQueueItemDto
- RegistryEvalResultDto
- RegistryActorDto, if exposed
- MutationAuthorizationDecisionDto, if exposed

Rules:
- Do not expose internal domain entities directly.
- Keep API DTOs additive and stable.
- Existing registry v1 APIs should not break unless unavoidable.
- Add validation for invalid status, invalid target kind, missing actor, missing reason where required, invalid rollback revision, and invalid eval result payload.

## 9. Update dashboard

Update dashboard visibility for Phase 3 v2.

Add simple read-only or minimal controls for:
- registry history count or latest revision
- rollback availability indicator
- approval queue
- latest eval result
- audit log events
- resolver warnings
- authorization-related status, if useful

Keep the UI simple.
Do not build a complex workflow UI.
Do not build real multi-user approval UI.
Do not add real authentication UI.

## 10. Documentation

Create:

docs/features/registry/v2-operational-hardening.md

Include:
- what v2 adds over v1
- registry history model
- rollback model
- approval queue read model
- local eval result attachment
- registry mutation auth/RBAC design
- mock authorization behavior
- resolver behavior after rollback/eval/approval changes
- API endpoints
- dashboard changes
- tests
- known limitations
- next recommended task

Update:

docs/audits/2026-05-11-phase-3-completion-gap.md

docs/audits/2026-05-11-phase-progress-audit.md, if present

Suggested status after successful completion:
- Phase 1: complete_for_current_milestone
- Phase 2: complete_for_current_milestone
- Phase 3: v2_implemented or partially_implemented, depending on actual completion
- Phase 4: planned_only
- Phase 5: planned_only

Do not mark Phase 3 as production_ready.

Also update README.md and AGENTS.md if validation commands, architecture boundaries, or project guidance changed.

## 11. Tests

Add deterministic tests for:

Registry history:
- create skill creates revision 1
- update skill creates new revision
- status change creates new revision
- approval update creates new revision
- eval update creates new revision
- instruction checksum metadata update creates new revision
- list history returns deterministic order
- old revisions are immutable

Rollback:
- rollback to previous skill revision creates new revision
- rollback to previous harness revision creates new revision
- rollback to previous instruction revision creates new revision
- rollback appends audit log
- rollback does not delete history
- rollback target not found fails clearly
- rollback respects resolver gates after restored state

Approval queue:
- pending approval item appears in queue
- approved item does not appear in pending queue
- rejected item is handled deterministically
- archived item is excluded unless explicitly requested
- queue ordering is deterministic
- approval queue DTO mapping works

Eval result attachment:
- attach eval result to skill
- attach eval result to harness
- attach eval result to instruction
- attach passed eval result can update evalStatus to passed
- attach failed eval result can update evalStatus to failed
- eval result attachment appends audit log
- eval results are queryable by target
- RegistryResolver uses evalStatus rather than raw eval result details

Mutation auth/RBAC:
- registry_viewer can read but cannot mutate
- registry_editor can create/update but cannot approve or rollback
- registry_reviewer can approve and attach eval result
- registry_admin can rollback
- unauthorized mutation fails without state change
- service layer uses RegistryMutationAuthorizer interface
- mock authorizer works in tests

Regression:
- existing Phase 1 tests still pass
- existing Phase 2 tests still pass
- existing Phase 3 v0/v1 tests still pass
- task run still records registry refs
- usage ledger remains attributed to taskId and taskRunId
- no real external calls are introduced

Tests must not require network access.
Tests must not call GitHub, GitLab, OpenAI, Anthropic, Gemini, Bedrock, MCP, Vault, Temporal, Kubernetes, or remote services.

## 12. Mock-only compliance

Search the repository for real external network/API usage.

Use searches such as:

rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|github|gitlab|bedrock|gemini|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|git fetch|git push" .

Classify any results into:
- safe documentation references
- safe mock references
- safe type/interface references
- safe local-only git usage
- suspicious real integration code
- actual external calls

Do not introduce any actual external calls.

## 13. Validation

Run:

pnpm lint
pnpm typecheck
pnpm test
pnpm build

If dependency metadata changed, run:

pnpm install

At the end, report:
- completed work
- changed files
- validation results
- Phase 1 status
- Phase 2 status
- Phase 3 status
- known limitations
- whether any real external calls were introduced
- recommended next task

Important:
Do not proceed to Phase 4.
This task is Phase 3 operational hardening only.
```

## Expected Result After Work Order 1

```text
Phase 1: complete_for_current_milestone
Phase 2: complete_for_current_milestone
Phase 3: v2_implemented
Phase 4: planned_only
Phase 5: planned_only
```

Proceed to Work Order 2 only if validation passes and no critical blockers are reported.

---

# Work Order 2 — Phase 3 Packaging & Versioning v3

## Codex Prompt

```text
Read the current repository carefully before making changes.

Relevant guidance files may include:
- AGENTS.md
- README.md
- docs/audits/2026-05-11-phase-progress-audit.md, if present
- docs/features/registry/v0.md, if present
- docs/features/registry/v1-hardening.md, if present
- docs/features/registry/v2-operational-hardening.md, if present
- docs/audits/2026-05-11-phase-3-completion-gap.md, if present

Your task is to implement Phase 3 Packaging & Versioning v3.

Context:
Phase 3 v2 should have added or refined:
- registry history
- rollback
- approval queue read models
- eval result attachment
- registry mutation auth/RBAC design with mock enforcement

This task continues Phase 3 hardening. Do not proceed to Phase 4 yet.

Goal:
Make registry entries easier to package, export, import, version, compare, and resolve deterministically without introducing any real artifact registry or signed artifact integration.

Important constraints:
- Do not add real external artifact registry integration.
- Do not implement cryptographic signing yet.
- Do not add real GitHub/GitLab/Bitbucket integration.
- Do not call real LLM providers.
- Do not add MCP integration.
- Do not add Vault, Kubernetes, Temporal, or production deployment code.
- Do not perform real remote git operations.
- Keep mock-first architecture.
- Keep all provider behavior behind interfaces.
- Preserve Phase 1, Phase 2, and Phase 3 v1/v2 behavior.
- Skill, Harness, and InstructionArtifact must remain separate domain concepts.

## 1. Pre-implementation audit

Create or update:

docs/features/registry/v3-packaging-versioning-plan.md

The plan must include:
- current Phase 3 v2 capabilities
- current version fields and version selection behavior
- whether semver exact match exists
- whether semver range resolution exists
- whether registry package manifests exist
- whether local import/export exists
- whether rollback/history exists and remains compatible
- what v3 will implement
- what remains out of scope

If Phase 3 v2 was not implemented or has critical blockers, stop and create:

docs/phase-3-v3-blocked.md

## 2. Add registry package manifests

Add local-only package manifest support for registry entries.

Suggested domain model:

RegistryPackageManifest
- schemaVersion
- packageKind: skill | harness | instruction | registry_bundle
- name
- version
- description
- owner
- lifecycleStatus
- approvalStatus
- evalStatus
- checksum
- checksumAlgorithm
- dependencies
- compatibleAgents
- compatibleModels, optional
- requiredTools, optional
- sourceRefs, optional
- createdAt
- metadata

For bundle manifests:
- includedSkills
- includedHarnesses
- includedInstructions
- bundleChecksum

Requirements:
- Manifests must be generated from existing registry domain models.
- Manifests must not replace domain models.
- Manifests must be stable DTO-like artifacts for export/import.
- Include schemaVersion for future compatibility.
- Include checksums where available.
- Do not implement signed manifests yet.

## 3. Add local export/import

Implement local-only registry export/import.

Suggested API/service capabilities:
- export a single skill manifest
- export a single harness manifest
- export a single instruction manifest
- export a registry bundle manifest
- import a skill manifest
- import a harness manifest
- import an instruction manifest
- import a bundle manifest

Suggested endpoints:
- GET /registry/skills/:id/manifest
- GET /registry/harnesses/:id/manifest
- GET /registry/instructions/:id/manifest
- GET /registry/bundle/manifest
- POST /registry/import

Rules:
- Import must validate schemaVersion.
- Import must validate packageKind.
- Import must validate required fields.
- Import must validate checksum where possible.
- Import should not silently overwrite existing entries.
- If name/version already exists, return a clear conflict unless an explicit importMode is supplied.
- Supported import modes for v3:
  - create_only
  - replace_draft_only
- Do not allow import to replace active approved entries by default.
- Import must append audit logs and revisions.
- Import must respect mutation authorization.
- Import must remain local-only and not call external services.

## 4. Add semver support

Add deterministic semver parsing and range resolution.

Supported for v3:
- exact version: 1.2.3
- caret range: ^1.2.0
- tilde range: ~1.2.0
- major wildcard: 1.x
- latest active compatible version

If dependency metadata changes are required to add a small semver library, it is acceptable, but keep it minimal and run install. If the project already avoids dependencies, implement a small deterministic semver utility with tests.

Rules:
- Exact version pinning must continue to work.
- RegistryVersionRef should support exact version and versionRange.
- Resolver should prefer exact version when provided.
- Resolver should choose the highest compatible active version for ranges.
- Resolver must still enforce lifecycle, approval, eval, and checksum gates.
- Deprecated, archived, rejected, eval_failed, and checksum_mismatch entries must not be selected by default even if they satisfy the version range.
- Missing or invalid range must produce deterministic errors or warnings.

## 5. Add dependency metadata and compatibility checks

Extend registry entries or manifests with dependency metadata.

Suggested dependency shape:

RegistryDependency
- kind: skill | harness | instruction
- name
- versionRange
- required: boolean
- reason, optional

Resolver behavior:
- Required dependencies must be resolved or produce an error.
- Optional dependencies may produce warnings if missing.
- Dependency resolution must not select unsafe entries.
- Circular dependencies must be detected and reported clearly.

Do not implement complex dependency solving. Keep v3 deterministic and simple.

## 6. Add package comparison and diff summary

Add local comparison utilities for registry entries and manifests.

Suggested capabilities:
- compare two revisions
- compare current entry to manifest
- compare two manifests

Return a simple diff summary:
- changedFields
- addedFields
- removedFields
- riskLevel: low | medium | high
- summary

Risk examples:
- instruction body/path changed: medium or high
- network policy changed in harness: high
- required tools changed in harness: medium
- invocation rules changed in skill: medium
- description-only change: low

This is a local deterministic diff utility, not an LLM analysis.

## 7. Update registry resolver and task integration

Update RegistryResolver to support:
- exact version refs
- semver range refs
- latest compatible active selection
- dependency resolution
- deterministic warnings/errors

TaskRun should continue to record:
- selectedSkillRefs
- selectedHarnessRef
- selectedInstructionRefs
- registryResolutionWarnings
- registryResolutionErrors

Add selected manifest checksum or package manifest reference where appropriate, without overcomplicating TaskRun.

## 8. Update API DTOs

Add DTOs:
- RegistryPackageManifestDto
- RegistryImportRequestDto
- RegistryImportResultDto
- RegistryDependencyDto
- RegistryPackageDiffDto
- RegistryVersionResolutionDto, if useful

Rules:
- Do not expose internal entities directly.
- Keep APIs additive and stable.
- Validate invalid package kind, invalid schemaVersion, invalid semver range, missing required fields, import conflict, and circular dependency.

## 9. Update dashboard

Add simple visibility for:
- package manifest summary
- export/import capability status
- version range / exact version display
- dependency list
- latest compatible version chosen by resolver
- package diff summary, if implemented in API

Keep the UI simple. Read-only display is acceptable.

## 10. Documentation

Create:

docs/features/registry/v3-packaging-versioning.md

Include:
- what v3 adds over v2
- package manifest model
- local export/import behavior
- semver support
- dependency metadata
- resolver behavior
- package diff summary
- API endpoints
- dashboard changes
- test strategy
- known limitations
- next recommended task

Update:

docs/audits/2026-05-11-phase-3-completion-gap.md

docs/audits/2026-05-11-phase-progress-audit.md, if present

Suggested status after successful completion:
- Phase 1: complete_for_current_milestone
- Phase 2: complete_for_current_milestone
- Phase 3: v3_implemented or partially_implemented, depending on actual completion
- Phase 4: planned_only
- Phase 5: planned_only

Do not mark Phase 3 as production_ready.

## 11. Tests

Add deterministic tests for:

Manifests:
- generate skill manifest
- generate harness manifest
- generate instruction manifest
- generate bundle manifest
- manifest includes checksum and schemaVersion

Import/export:
- export single registry entry
- import create_only success
- import conflict fails clearly
- replace_draft_only replaces draft but not active approved entry
- invalid schemaVersion fails
- invalid packageKind fails
- import appends audit log and revision
- import respects authorization

Semver:
- exact version resolution
- caret range resolution
- tilde range resolution
- wildcard range resolution
- latest active compatible selection
- deprecated entry excluded
- rejected approval entry excluded
- eval failed entry excluded
- checksum mismatch instruction excluded
- invalid semver range fails clearly

Dependencies:
- required dependency resolves
- missing required dependency errors
- missing optional dependency warns
- unsafe dependency is not selected
- circular dependency detected

Diff:
- revision diff detects changed fields
- manifest diff detects changed fields
- high-risk harness network/tool change
- medium-risk instruction change
- low-risk description-only change

Regression:
- Phase 1 tests still pass
- Phase 2 tests still pass
- Phase 3 v0/v1/v2 tests still pass
- task run still records registry refs
- usage ledger remains attributed to taskId and taskRunId
- no real external calls introduced

Tests must not require network access.

## 12. Mock-only compliance

Search for real external network/API usage:

rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|github|gitlab|bedrock|gemini|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|git fetch|git push" .

Do not introduce actual external calls.

## 13. Validation

Run:

pnpm lint
pnpm typecheck
pnpm test
pnpm build

If dependency metadata changed, run:

pnpm install

At the end, report:
- completed work
- changed files
- validation results
- Phase 1 status
- Phase 2 status
- Phase 3 status
- known limitations
- whether any real external calls were introduced
- recommended next task

Important:
Do not proceed to Phase 4.
This task is Phase 3 packaging and versioning only.
```

## Expected Result After Work Order 2

```text
Phase 1: complete_for_current_milestone
Phase 2: complete_for_current_milestone
Phase 3: v3_implemented
Phase 4: planned_only
Phase 5: planned_only
```

Proceed to Work Order 3 only if validation passes and no critical blockers are reported.

---

# Work Order 3 — Phase 4 Preparation

## Codex Prompt

```text
Read the current repository carefully before making changes.

Relevant guidance files may include:
- AGENTS.md
- README.md
- docs/audits/2026-05-11-phase-progress-audit.md, if present
- docs/features/registry/v0.md, if present
- docs/features/registry/v1-hardening.md, if present
- docs/features/registry/v2-operational-hardening.md, if present
- docs/features/registry/v3-packaging-versioning.md, if present
- docs/audits/2026-05-11-phase-3-completion-gap.md, if present

Your task is to implement Phase 4 Preparation.

Context:
Phase 4 is the auto-improvement phase. Do not implement actual auto-improvement yet.

This preparation task should create the data models, interfaces, read models, and safety gates needed before any LLM-generated Skill/Harness/Instruction changes are proposed or applied.

Goal:
Prepare the system for Phase 4 by adding trace-derived improvement candidate models, failure cluster models, patch proposal models, eval requirement schemas, canary rollout plan models, and safety rules that prevent automatic mutation of active registry entries.

Important constraints:
- Do not call real LLM providers.
- Do not implement LLM-generated patches yet.
- Do not automatically mutate active registry entries.
- Do not add real GitHub/GitLab/Bitbucket integration.
- Do not add MCP integration.
- Do not add Vault, Kubernetes, Temporal, or production deployment code.
- Do not perform real remote git operations.
- Do not add real artifact registry integration.
- Keep mock-first architecture.
- Preserve Phase 1, Phase 2, and Phase 3 behavior.
- Skill, Harness, and InstructionArtifact must remain separate domain concepts.

## 1. Pre-implementation audit

Create:

docs/features/auto-improvement/preparation-plan.md

The plan must include:
- current Phase 3 readiness
- whether registry history exists
- whether rollback exists
- whether approval/eval gates exist
- whether package/versioning exists
- whether task traces and usage ledger are available
- what Phase 4 Preparation will implement
- what remains out of scope

If Phase 3 v2/v3 is missing critical registry safeguards, create:

docs/features/auto-improvement/preparation-blocked.md

and do not implement Phase 4 Preparation code.

## 2. Add improvement candidate domain models

Add domain models for detecting potential improvements without generating patches.

Suggested model:

ImprovementCandidate
- id
- sourceKind: task_run | usage_ledger | conflict_risk | registry_eval | manual
- sourceIds
- targetKind: skill | harness | instruction | model_routing | conflict_policy
- targetId, optional
- targetName, optional
- severity: low | medium | high | critical
- category: cost | quality | failure_rate | conflict_rate | latency | eval_failure | checksum_issue | policy_issue | manual
- title
- summary
- evidence
- recommendedAction
- status: open | triaged | dismissed | converted_to_proposal
- createdAt
- updatedAt

Rules:
- Candidates are observations, not changes.
- Candidates must not mutate registry entries.
- Candidates may be created from mock trace/usage data or manual input.

## 3. Add failure cluster models

Add local deterministic failure clustering models.

Suggested model:

FailureCluster
- id
- category
- sourceRunIds
- affectedRegistryRefs
- fingerprint
- title
- summary
- count
- firstSeenAt
- lastSeenAt
- severity
- exampleEvidence
- status: open | triaged | dismissed

Suggested clustering behavior for v0 preparation:
- deterministic grouping by category + affected registry ref + normalized failure reason
- no embeddings
- no LLM clustering
- no external services

## 4. Add improvement proposal models

Add proposal models but do not generate real patches yet.

Suggested model:

ImprovementProposal
- id
- candidateIds
- targetKind: skill | harness | instruction
- targetId
- targetName
- targetVersion
- proposalType: instruction_change | harness_config_change | skill_workflow_change | registry_metadata_change
- title
- summary
- proposedChangeSummary
- patchDraft, optional
- status: draft | pending_review | rejected | approved_for_eval | eval_passed | eval_failed | approved_for_canary | canary_passed | canary_failed | ready_for_registry_draft
- createdBy
- createdAt
- updatedAt
- safetyNotes

Rules:
- Proposal does not modify active registry entries.
- Proposal may reference a draft registry entry only in later Phase 4 v0.
- Proposal must require approval/eval/canary gates before any activation.

## 5. Add eval requirement schema

Add schema for what eval must be run before accepting a proposal.

Suggested model:

EvalRequirement
- id
- proposalId
- targetKind
- evalName
- evalType: unit | integration | registry_eval | manual | mock
- required: boolean
- passingCriteria
- status: pending | passed | failed | skipped
- resultRef, optional

Rules:
- No real eval suite execution yet.
- Allow attaching mock/manual eval results.
- This schema prepares Phase 4 v0.

## 6. Add canary rollout plan model

Add canary rollout models but do not execute real canaries.

Suggested model:

CanaryRolloutPlan
- id
- proposalId
- targetKind
- targetId
- candidateVersion
- scope: repo | team | task_type | manual
- percentage, optional
- includedRepos, optional
- excludedRepos, optional
- status: draft | pending | running_mock | passed | failed | cancelled
- safetyChecks
- createdAt
- updatedAt

Rules:
- This is a plan/read model only.
- No real rollout execution.
- No automatic registry activation.

## 7. Add Phase 4 safety policy

Create a Phase 4 safety policy module or service.

Required behavior:
- ImprovementCandidate creation is allowed.
- FailureCluster creation is allowed.
- ImprovementProposal creation is allowed.
- Proposal cannot mutate active registry entries.
- Proposal cannot activate registry entries.
- Proposal cannot bypass approval/eval/canary gates.
- Any future auto-improvement must create draft changes only.

Add tests for these safety rules.

## 8. Add APIs

Add simple APIs for Phase 4 preparation.

Suggested endpoints:
- GET /improvements/candidates
- POST /improvements/candidates
- PATCH /improvements/candidates/:id/status
- GET /improvements/failure-clusters
- POST /improvements/failure-clusters/recompute
- GET /improvements/proposals
- POST /improvements/proposals
- GET /improvements/proposals/:id
- GET /improvements/proposals/:id/eval-requirements
- POST /improvements/proposals/:id/eval-requirements
- GET /improvements/proposals/:id/canary-plan
- POST /improvements/proposals/:id/canary-plan

All APIs should use DTOs and validation.

## 9. Update dashboard

Add simple Phase 4 Preparation visibility:
- improvement candidate list
- failure cluster list
- proposal list
- proposal safety status
- eval requirement summary
- canary plan summary

Keep UI simple and read-heavy.
Do not build complex workflow UI.

## 10. Documentation

Create:

docs/features/auto-improvement/preparation.md

Include:
- what Phase 4 Preparation implements
- why it does not implement auto-improvement yet
- improvement candidate model
- failure cluster model
- proposal model
- eval requirement model
- canary rollout plan model
- safety policy
- APIs
- dashboard changes
- test strategy
- known limitations
- next recommended task

Update:

docs/audits/2026-05-11-phase-progress-audit.md, if present

Suggested status after successful completion:
- Phase 1: complete_for_current_milestone
- Phase 2: complete_for_current_milestone
- Phase 3: complete_for_current_milestone or v3_implemented
- Phase 4: preparation_implemented
- Phase 5: planned_only

Do not mark Phase 4 as implemented or production_ready.

## 11. Tests

Add deterministic tests for:

Improvement candidates:
- create candidate
- list candidates
- update candidate status
- candidate does not mutate registry

Failure clusters:
- deterministic grouping by category + registry ref + normalized reason
- list clusters
- recompute clusters from mock evidence

Proposals:
- create proposal
- proposal references candidate
- proposal does not mutate active registry entry
- proposal status transitions are deterministic
- invalid proposal target fails clearly

Eval requirements:
- create eval requirement
- attach manual/mock result if supported
- required failed eval blocks proposal readiness

Canary plan:
- create canary plan
- canary plan does not activate registry entry
- invalid scope fails clearly

Safety policy:
- auto mutation of active registry entry is blocked
- approval/eval/canary gates are required before future activation

Regression:
- Phase 1 tests still pass
- Phase 2 tests still pass
- Phase 3 tests still pass
- no real external calls are introduced

Tests must not require network access.

## 12. Mock-only compliance

Search for real external network/API usage:

rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|github|gitlab|bedrock|gemini|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|git fetch|git push" .

Do not introduce actual external calls.

## 13. Validation

Run:

pnpm lint
pnpm typecheck
pnpm test
pnpm build

If dependency metadata changed, run:

pnpm install

At the end, report:
- completed work
- changed files
- validation results
- Phase 1 status
- Phase 2 status
- Phase 3 status
- Phase 4 status
- known limitations
- whether any real external calls were introduced
- recommended next task

Important:
This task prepares Phase 4 but does not implement automatic improvement.
```

## Expected Result After Work Order 3

```text
Phase 1: complete_for_current_milestone
Phase 2: complete_for_current_milestone
Phase 3: complete_for_current_milestone or v3_implemented
Phase 4: preparation_implemented
Phase 5: planned_only
```

Proceed to Work Order 4 only if validation passes and no critical blockers are reported.

---

# Work Order 4 — Phase 4 Auto-improvement v0

## Codex Prompt

```text
Read the current repository carefully before making changes.

Relevant guidance files may include:
- AGENTS.md
- README.md
- docs/audits/2026-05-11-phase-progress-audit.md, if present
- docs/features/registry/v0.md, if present
- docs/features/registry/v1-hardening.md, if present
- docs/features/registry/v2-operational-hardening.md, if present
- docs/features/registry/v3-packaging-versioning.md, if present
- docs/features/auto-improvement/preparation.md, if present

Your task is to implement Phase 4 Auto-improvement v0.

Context:
Phase 4 Preparation should already exist. It should have created improvement candidates, failure clusters, proposals, eval requirements, canary rollout plan models, and safety rules.

This v0 task introduces mock-only, deterministic auto-improvement proposal generation.

Goal:
Implement a safe, mock-first auto-improvement loop that can generate draft improvement proposals from candidates/failure clusters and create draft registry changes only. It must not activate changes automatically.

Important constraints:
- Do not call real LLM providers.
- Do not generate patches using a real LLM.
- Do not automatically mutate active registry entries.
- Do not automatically activate registry changes.
- Do not bypass approval, eval, canary, rollback, or audit controls.
- Do not add real GitHub/GitLab/Bitbucket integration.
- Do not add MCP integration.
- Do not add Vault, Kubernetes, Temporal, or production deployment code.
- Do not perform real remote git operations.
- Do not add real artifact registry integration.
- Keep mock-first architecture.
- Preserve Phase 1, Phase 2, and Phase 3 behavior.
- Skill, Harness, and InstructionArtifact must remain separate domain concepts.

## 1. Pre-implementation audit

Create:

docs/features/auto-improvement/v0-plan.md

The plan must include:
- current Phase 4 Preparation capabilities
- whether improvement candidates exist
- whether failure clusters exist
- whether proposal models exist
- whether eval requirements exist
- whether canary plan models exist
- whether Phase 4 safety policy exists
- what v0 will implement
- what remains out of scope

If Phase 4 Preparation is missing critical safety gates, stop and create:

docs/features/auto-improvement/v0-blocked.md

## 2. Add AutoImprovementEngine interface

Add a provider-agnostic auto-improvement interface.

Suggested interface:

AutoImprovementEngine:
- analyzeCandidates(request)
- generateProposal(request)
- generateDraftRegistryChange(request)
- attachEvalPlan(request)
- createCanaryPlan(request)

Do not tie this interface to any LLM provider.

## 3. Add MockAutoImprovementEngine

Implement a deterministic mock engine.

Behavior examples:
- cost candidate targeting a skill generates a proposal to simplify instruction steps
- failure_rate candidate targeting a harness generates a proposal to add or adjust test commands
- checksum_issue candidate targeting an instruction generates a proposal to verify/update checksum metadata
- conflict_rate candidate targeting conflict policy generates a proposal to add conflict-risk-reviewer skill guidance

Rules:
- Generated proposals must be deterministic.
- Generated proposals must include evidence references.
- Generated proposals must include safety notes.
- Generated proposals must not alter active registry entries.

## 4. Generate draft registry changes safely

Add support for creating draft registry entries from approved proposals.

Rules:
- Draft change must have lifecycle status = draft.
- Draft change must have approvalStatus = pending or not_required according to existing policy.
- Draft change must have evalStatus = pending or not_required according to existing policy.
- Draft change must create audit log and registry revision.
- Draft change must not replace the active version.
- Draft change must not be selected by RegistryResolver by default until it passes gates.
- Draft change must link back to the proposal that generated it.

Suggested model:

DraftRegistryChange
- id
- proposalId
- targetKind
- sourceTargetId
- draftTargetId
- draftName
- draftVersion
- changeSummary
- status: draft_created | awaiting_eval | eval_passed | eval_failed | awaiting_approval | approved | rejected
- createdAt
- createdBy

## 5. Add proposal gate transitions

Add deterministic proposal workflow transitions.

Suggested transitions:
- draft -> pending_review
- pending_review -> approved_for_eval
- pending_review -> rejected
- approved_for_eval -> eval_passed
- approved_for_eval -> eval_failed
- eval_passed -> approved_for_canary
- approved_for_canary -> canary_passed
- approved_for_canary -> canary_failed
- canary_passed -> ready_for_registry_draft
- ready_for_registry_draft -> draft_registry_change_created

Rules:
- Invalid transitions fail clearly.
- Registry draft creation only allowed from ready_for_registry_draft.
- No active registry activation in v0.

## 6. Attach eval and canary plans automatically, but do not execute them

When the mock engine creates a proposal, it may also create:
- EvalRequirement records
- CanaryRolloutPlan records

Rules:
- Eval plans are metadata only.
- Canary plans are metadata only.
- No real eval execution.
- No real canary execution.
- No automatic activation.

## 7. Add APIs

Add or extend APIs:

- POST /improvements/auto/analyze
- POST /improvements/auto/generate-proposal
- POST /improvements/proposals/:id/transition
- POST /improvements/proposals/:id/create-draft-registry-change
- GET /improvements/draft-registry-changes
- GET /improvements/draft-registry-changes/:id

Rules:
- Use DTOs.
- Validate inputs.
- Enforce mutation authorization where applicable.
- Return clear errors for invalid proposal status transitions.
- Return clear errors if a draft registry change would bypass gates.

## 8. Update dashboard

Add simple Phase 4 v0 dashboard visibility:
- auto-improvement candidate analysis panel
- generated proposal list
- proposal status
- eval plan summary
- canary plan summary
- draft registry changes
- safety gate status

Keep UI simple.
Do not build a complex workflow UI.
Do not add real LLM controls.

## 9. Documentation

Create:

docs/features/auto-improvement/v0.md

Include:
- what v0 implements
- why it is mock-only
- AutoImprovementEngine interface
- MockAutoImprovementEngine behavior
- proposal workflow
- draft registry change rules
- eval/canary metadata behavior
- safety gates
- APIs
- dashboard changes
- tests
- known limitations
- next recommended task

Update:

docs/audits/2026-05-11-phase-progress-audit.md, if present

Suggested status after successful completion:
- Phase 1: complete_for_current_milestone
- Phase 2: complete_for_current_milestone
- Phase 3: complete_for_current_milestone
- Phase 4: v0_implemented
- Phase 5: planned_only

Do not mark Phase 4 as production_ready.

## 10. Tests

Add deterministic tests for:

AutoImprovementEngine:
- analyze candidate produces deterministic result
- generate proposal from cost candidate
- generate proposal from failure_rate candidate
- generate proposal from checksum_issue candidate
- generated proposal references evidence
- generated proposal includes safety notes

Proposal transitions:
- valid transitions succeed
- invalid transitions fail clearly
- proposal cannot create draft registry change before ready_for_registry_draft
- ready proposal can create draft registry change

Draft registry changes:
- draft skill change created
- draft harness change created
- draft instruction change created
- draft entry has draft lifecycle status
- draft entry not selected by RegistryResolver by default
- draft creation appends audit log and revision
- draft links back to proposal

Eval/canary metadata:
- generated proposal can include eval requirements
- generated proposal can include canary plan
- eval plan does not execute real eval
- canary plan does not execute real rollout

Safety policy:
- active registry entry is not mutated
- automatic activation is blocked
- approval/eval/canary gates cannot be bypassed
- no real LLM calls are made

API:
- auto analyze endpoint
- generate proposal endpoint
- proposal transition endpoint
- create draft registry change endpoint
- invalid transition API failure

Regression:
- Phase 1 tests still pass
- Phase 2 tests still pass
- Phase 3 tests still pass
- Phase 4 Preparation tests still pass
- usage ledger remains attributed to taskId and taskRunId
- no real external calls are introduced

Tests must not require network access.

## 11. Mock-only compliance

Search for real external network/API usage:

rg -n "fetch\\(|axios|Octokit|openai|anthropic|claude|github|gitlab|bedrock|gemini|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN|git fetch|git push" .

Do not introduce actual external calls.

## 12. Validation

Run:

pnpm lint
pnpm typecheck
pnpm test
pnpm build

If dependency metadata changed, run:

pnpm install

At the end, report:
- completed work
- changed files
- validation results
- Phase 1 status
- Phase 2 status
- Phase 3 status
- Phase 4 status
- known limitations
- whether any real external calls were introduced
- recommended next task

Important:
This task implements mock-only Phase 4 Auto-improvement v0.
It must not call real LLMs or activate registry changes automatically.
```

## Expected Result After Work Order 4

```text
Phase 1: complete_for_current_milestone
Phase 2: complete_for_current_milestone
Phase 3: complete_for_current_milestone
Phase 4: v0_implemented
Phase 5: planned_only
```

---

# Final Notes

After Work Order 4 succeeds, the next likely path is:

```text
Phase 4 v1: evaluation execution harness, still local/mock-only
Phase 4 v2: canary execution simulation
Phase 4 v3: policy-gated registry activation flow
Phase 5 preparation: enterprise auth/RBAC, audit export, policy-as-code, deployment boundaries
```

Do not introduce real LLM-based auto-improvement until the following are implemented and tested:

```text
Registry rollback
Registry history
Approval/eval gates
Canary plan model
Draft-only proposal flow
Mutation authorization
Audit logs
No-bypass safety policy
```
