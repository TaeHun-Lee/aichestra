# Staging Deployment Rollback Plan v0

Status: `v0_implemented`
Scope: rollback planning/checklist only

No deployment happened, so no rollback command is run. This plan records rollback evidence expected before a future staging deployment.

## Rollback Steps

1. Code rollback: identify the candidate commit range or branch reversal.
2. Config rollback: restore prior staging config gates without exposing env values.
3. Environment gate rollback: disable optional live integration and remote provider gates.
4. Database migration rollback consideration: decide before execution whether migrations are reversible, forward-only, or not part of the deployment.
5. GitHub integration rollback: disable GitHub App/webhook/live Git gates; do not automate branch deletion or force push.
6. LLM integration rollback: return routing to mock-only and preserve budget/policy gates.
7. Vault/SecretRef rollback: disable Vault live test/provider gates and keep SecretRef values hidden.
8. Dashboard/readiness rollback: remove or hide stale readiness panels if they overclaim deployment state.
9. Observability/audit review: capture sanitized incident evidence.
10. Manual verification: verify health, dashboard, readiness, no-secret/no-env status, `stagingDeployed=false`, and `productionReady=false` until explicitly changed by future approved work.

## Triggers

- Health check failure after future deployment.
- Dashboard/readiness secret or env exposure.
- Unexpected external provider call.
- Destructive Git gate enabled.
- Migration failure or data inconsistency.
- Policy/Auth/RBAC bypass.
- Observability or audit gap during validation.

## Owner Roles

Owners map to `engineering_owner`, `platform_owner`, `security_reviewer`, `qa_reviewer`, and `release_manager`. Real human approval remains required before actual staging deployment.
