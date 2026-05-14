# Staging Signoff Decision Policy v0

Status: `policy_recorded_pending_signoff`
Scope: documentation/readiness only

This policy governs how Staging Human Signoff Pack v0 is interpreted before any actual staging deployment execution. It does not implement approval workflow, identity, sessions, tokens, production Auth/RBAC, deployment commands, releases, Git tags, GitHub releases, or provider integrations.

## Required Approval Rule

All required roles must approve before actual staging deployment execution:

- `engineering_owner`
- `platform_owner`
- `security_reviewer`
- `product_owner`
- `qa_reviewer`
- `release_manager`

Every required role starts as `pending` unless real approval evidence is already present in the repository. No such real approval evidence is currently present.

## Conditional Approval Rule

Conditional approval is allowed only if all conditions are explicit:

- condition text is recorded,
- owner is recorded,
- evidence needed to close the condition is recorded,
- deadline or validity impact is recorded,
- release manager records whether the condition blocks execution.

Conditional approval does not imply deployment approval until blocking conditions are resolved or explicitly accepted under project rules. Conditional approval cannot waive critical safety gates.

## Rejection Rule

Any rejection by a required role produces `no_go`.

The pack remains `no_go` until the rejecting role records a later approval, conditional approval, or project-accepted resolution in the same reviewed scope.

## Missing Signoff Rule

Any missing required signoff keeps actual staging deployment blocked.

The expected status while one or more required roles are pending is:

- signoff status: `pending`
- actual deployment blocked: true
- production ready: false
- staging deployed: false

## Expiry Rule

Suggested validity window: 7 calendar days from the latest required approval timestamp.

The project may choose a shorter window for higher-risk changes. The chosen window must be recorded in the signoff pack before approval is used.

Expired signoff must be revalidated before actual staging deployment execution.

## Scope Rule

Signoff applies only to the current reviewed commit/diff scope and evidence set.

If code, configuration, dependencies, migrations, readiness models, safety gates, release notes, rollback evidence, signoff evidence, or relevant docs change after signoff, affected roles must revalidate before actual staging deployment execution.

## No Production Deployment Rule

Staging signoff does not imply production deployment approval.

This policy does not mark production ready, does not authorize production traffic, does not waive production blockers, and does not approve production release, Git tag, GitHub release, migration, secret backend rollout, auth rollout, policy bundle runtime, observability export, MCP transport, vendor CLI, or provider rollout work.

## Critical Safety Rule

The following always block actual staging deployment until remediated and re-audited:

- validation failure,
- secret/env exposure,
- release/tag/deployment side effect before approval,
- unsafe default external provider call,
- remote merge, force push, or branch deletion enabled,
- real MCP transport enabled without explicit future approval,
- vendor CLI execution,
- credential-cache access,
- Vault or secret backend call outside explicit gated validation,
- production-ready overclaim,
- staging-deployed overclaim.

## Next Audit Rule

After signoffs are recorded and before actual staging deployment execution, run Staging Deployment Approval Audit v0.

The approval audit must verify:

- all required roles have approved or have explicit accepted conditional approval,
- no required role is rejected, held, or missing,
- the signoff validity window has not expired,
- the reviewed scope is unchanged or revalidated,
- validation remains green,
- safe integration compliance remains pass,
- no-secret/no-env exposure remains pass,
- staging remains not deployed before the explicit deployment task,
- production ready remains false.

