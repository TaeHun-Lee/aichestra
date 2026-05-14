# Signoff Scope Separation Policy v0

Status: `policy_recorded`
Scope: cross-signoff readiness and evidence policy
Production ready: no
Staging deployed: no

## Purpose

This policy defines how Aichestra separates the object being approved from audit, readiness, execution-request, runbook, and post-approval evidence documents.

It is written for Staging Deployment Execution v0, but the model is intentionally general: future signoff, audit, approval, execution-request, release-candidate, policy, configuration, and operational-action workflows should use the same classification before deciding whether a new file or diff requires reapproval.

This policy does not approve deployment, create a release, create a Git tag, create a GitHub release, run remote Git operations, call external providers, call real LLM/MCP/Vault/auth services, execute vendor CLIs, read credential caches, expose secrets, expose env values, mark staging deployed, or mark production ready.

## Core Rule

Every signoff or audit must classify repository changes into four scopes before deciding materiality:

| Scope | Meaning | Examples |
| --- | --- | --- |
| Reviewed target scope | The object signers are actually approving. | code candidate commit, release candidate, config change, policy document, execution command, artifact digest |
| Evidence scope | Documents or records used to support, audit, or explain a decision. | audit reports, readiness reports, validation summaries, signoff packs, execution-request templates, runbooks, post-execution evidence |
| Execution scope | The concrete operational action to be performed. | operator, target environment, deployment command or platform action, rollback action, smoke base URL, execution window |
| Governance/policy scope | Rules that define who must approve and how decisions are interpreted. | role matrix, validity window, materiality rules, safety gates, waiver rules |

A new or modified document does not automatically change the reviewed target scope. It changes the reviewed target scope only when the document itself is the target under review or when it materially changes the target, execution action, governance rule, safety gate, or accepted condition.

## Target Scope Record

Each future signoff should record a target scope with these fields:

| Field | Required | Notes |
| --- | --- | --- |
| `signoffTarget.kind` | yes | Examples: `code_candidate`, `document_policy`, `execution_request`, `release_candidate`, `config_change`, `operational_action`. |
| `signoffTarget.scopeMethod` | yes | Examples: `commit_sha`, `explicit_diff_scope`, `document_hash`, `artifact_digest`, `command_record`. |
| `signoffTarget.scopeId` | yes | Commit SHA, hash, digest, or stable record identifier. |
| `includedPaths` | yes when path-based | Paths that are part of the reviewed target. |
| `excludedEvidencePaths` | yes when evidence is generated after target freeze | Audit, readiness, runbook, or request documents that are evidence only. |
| `validationEvidencePaths` | yes when validation is required | Paths or records for lint/typecheck/test/build/diff-check evidence. |
| `scopeCapturedAt` | yes | Timestamp with timezone. |
| `scopeOwner` | yes | Role or owner accountable for the scope classification. |

## Evidence Scope Rules

Evidence-only updates do not require reapproval of the target when all of these are true:

- the reviewed target scope is already recorded by commit SHA, diff scope, document hash, artifact digest, or command record;
- the evidence path is recorded as evidence, not as target;
- the evidence does not change the target content, runtime behavior, deployment behavior, required approvers, validity window, safety gates, execution command, rollback action, or accepted conditions;
- the evidence does not introduce a blocker, rejection, expired validity finding, no-secret/no-env failure, validation failure, or scope mismatch;
- the target can still be validated from a clean target worktree or reproducible artifact.

Evidence-only updates may still change the decision state. For example, an audit report that finds a blocker keeps execution held even if it does not change the target scope.

## Materiality Rules

| Change type | Classification | Required action |
| --- | --- | --- |
| Source code, runtime config, dependency, migration, test, package, or deployment-behavior change in the target | target scope change | Revalidate and recollect or revalidate required signoffs for the new scope. |
| Audit, readiness, request, runbook, or post-execution document generated after target freeze and recorded as evidence only | evidence scope change | No target reapproval by default; review evidence decision impact. |
| Evidence document reports blocker, rejection, hold, expired validity, validation failure, no-secret/no-env failure, or scope mismatch | evidence decision change | Keep execution blocked until remediated and re-audited. |
| Execution command, deployment target, rollback action, smoke target, operator, or execution window changes | execution scope change | Require operator reconfirmation and release-manager review; reapproval if risk or target changes. |
| Required role, approval rule, validity window, waiver rule, or safety gate changes | governance/policy scope change | Require policy review and affected-role revalidation before relying on prior approvals. |
| The document itself is the object being approved | reviewed target scope | Treat that document path/hash as target; changes require document-scope reapproval. |

## Worktree And Commit Rules

- Actual target verification should compare against the recorded target scope, not automatically against the latest evidence commit.
- If evidence documents are created after target signoff, the main worktree may contain evidence commits after the approved candidate. That is acceptable only if the deployment target remains the recorded candidate commit or artifact.
- Pre-execution validation should run in a clean target worktree, clean artifact workspace, or equivalent reproducible source for the recorded target scope.
- `git status --porcelain` on an evidence branch can show evidence changes; that does not by itself invalidate the target if the target scope is separately clean and reproducible.
- If the approved target is `commit_sha`, deploy or execute only that commit or a verified artifact derived from it.
- If the approved target is `explicit_diff_scope`, record modified/untracked paths, name-status/stat summary, and a safe diff scope hash without raw secret or env contents.

## Path Classification Heuristics

Default target-scope candidates:

- `apps/**`
- `packages/**`
- `scripts/**` when behavior, validation, build, migration, or execution changes
- `infra/**` when runtime, migration, database, deployment, or infrastructure behavior changes
- `package.json`, lockfiles, workspace config, TypeScript config, and other build/test/runtime config
- docs that define the approved product scope, policy target, execution action, rollback action, or accepted condition when those docs are the object being approved

Default evidence-scope candidates:

- `docs/audits/**`
- signoff packs, evidence checklists, approval audit reports, readiness reports, validation summaries, runbooks, execution-request templates, and post-execution evidence generated to support a separately recorded target

Default execution-scope candidates:

- operator record, deployment target, deployment command or platform action, rollback command or platform action, smoke base URL, execution window, migration decision, and post-execution evidence location

Default governance/policy-scope candidates:

- role matrix, signoff decision policy, scope-separation policy, materiality rules, validity window, waiver rules, hold rules, safety gates, and no-secret/no-env rules

These are heuristics, not absolute path rules. Classification must follow the actual purpose of the change.

## Current Staging Application

For the current staging execution flow:

- the approved deployment-candidate scope is the recorded candidate commit or accepted explicit diff scope;
- approval audits, readiness reports, runbooks, execution request documents, and post-approval notes are evidence scope unless explicitly promoted to target scope;
- actual staging deployment remains blocked until execution scope is supplied and reviewed;
- production ready remains false;
- staging deployed remains false until real execution evidence exists.

## Audit Requirements

Future audits should report:

- reviewed target kind, method, id, included paths, and excluded evidence paths;
- whether evidence-only changes were present after target freeze;
- whether any evidence-only document changed the decision state;
- whether execution scope is complete, pending, or changed;
- whether governance/policy scope changed after signoff;
- whether reapproval, revalidation, operator reconfirmation, or policy review is required;
- no-secret/no-env exposure result.

## Hold Rules

Keep execution blocked when:

- target scope is missing, ambiguous, or unreproducible;
- evidence scope is incorrectly mixed into target scope;
- target scope changed without revalidation;
- an evidence document introduces a blocker or rejection;
- execution scope is missing or changed without confirmation;
- governance/policy scope changed without affected-role review;
- validation, safe integration compliance, or no-secret/no-env checks fail;
- staging deployed or production ready is claimed without real evidence.

## Recommendation

Use this policy before every future signoff/audit/request workflow. Record the approved target separately from evidence documents, and verify the target from a clean target worktree or artifact rather than treating later audit/readiness document commits as part of the deployment candidate by default.
