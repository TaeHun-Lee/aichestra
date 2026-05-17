# Production RBAC Permission Matrix

This matrix is planning-only for Production Auth/RBAC v1. It does not grant production access today. Policy-as-code remains authoritative, and no role can read raw secrets, bypass SecretRef/lease constraints, bypass provider gates, or override policy denial.

Production Auth Provider Skeleton v1 does not add production permissions or trust a real identity source. Future OIDC/SAML/SCIM/vendor/custom providers remain disabled, cannot authenticate users, cannot issue sessions/JWTs/API keys/service-account credentials, cannot run SCIM sync, and cannot bypass this permission matrix or Policy-as-code.

RequestContext Propagation v1 is implemented as a mock-first attribution layer for selected boundaries. It enriches policy/audit inputs with request id, correlation id, actor/principal metadata, auth mode, and source, but it does not make any role production-authenticated or production-authorized.

Service Account Actor Boundary v1 adds a static mock catalog and serviceAccountId-enriched policy/audit attribution for selected runtime service fallbacks. It does not issue production service-account credentials, rotate credentials, or enable production auth.

Registry/Governance RequestContext Migration v1 adds mock-first request/correlation/service-account attribution to selected registry and governance paths. It does not enable production governance, auto-apply, real eval/canary execution, or active registry mutation from auto-improvement.

Tenant/Repo/Provider Scope Model v1 adds common scope metadata and policy resource scope helpers for future tenant/team/project/repo/provider/model/secret/MCP/registry/local-agent/audit scoping. It does not grant production access, enforce tenant isolation, add row-level security, or enable production dashboard filtering.

## Action Catalog

Actions covered by this v1 matrix:

`dashboard.read`, `task.create`, `task.run`, `git.repo.read`, `git.branch.create`, `git.pull_request.create`, `git.remote_operation`, `git.webhook.process`, `git.audit.read`, `llm.completion`, `llm.remote_completion`, `llm.model.use`, `llm.audit.read`, `mcp.server.list`, `mcp.tool.invoke`, `mcp.tool.invoke.high_risk`, `runner.execute`, `runner.command.execute`, `registry.read`, `registry.create`, `registry.update`, `registry.approve`, `registry.rollback`, `improvement.proposal.approve`, `improvement.apply`, `provider.invoke`, `provider.credential.resolve`, `secret.read`, `secret.lease.request`, `secret.lease.issue`, `security.audit.read`, `policy.evaluate`, `policy.audit.read`, `local_agent.invoke`, `local_agent.consent.approve`, `observability.audit.read`, and `readiness.read`.

## Role Matrix

| Role | Purpose | Allowed actions | Denied actions | Required scopes | Risk | Production default | Audit requirement | Current implementation | Future work |
|---|---|---|---|---|---|---|---|---|---|
| viewer | Read safe metadata. | `dashboard.read`, `registry.read`, `mcp.server.list`, `readiness.read` | `task.run`, `provider.credential.resolve`, `secret.read`, `git.remote_operation`, `llm.remote_completion`, `runner.command.execute` | tenant, workspace, project | low | allow after tenant scoping | metadata reads when required | partial mock | tenant-scoped dashboard filtering |
| developer | Create and run safe workflows. | `task.create`, `task.run`, `git.repo.read`, `git.branch.create`, `git.pull_request.create`, `llm.completion`, `llm.model.use`, `runner.execute`, low-risk `mcp.tool.invoke` | `secret.read`, merge/rebase/force-push/delete, high-risk MCP, `improvement.apply` | tenant, workspace, project, repo | medium | allow after tenant scoping | task, Git, LLM, Runner, MCP audit | partial mock | production IdP mapping and tenant budgets |
| reviewer | Review registry and governance metadata. | `registry.read`, `registry.approve`, `improvement.proposal.approve`, `git.repo.read`, `mcp.audit.read` | `improvement.apply`, `secret.read`, `provider.credential.resolve`, merge/rebase, `runner.command.execute` | tenant, workspace, project, registry | high | allow after workflow review | approval and governance audit | partial mock | approval workflow and tenant-scoped registry |
| security_admin | Review security metadata and credential decisions. | `security.audit.read`, `policy.audit.read`, `observability.audit.read`, `secret.lease.request`, narrow `provider.credential.resolve` | `secret.read`, `credential.cache.read`, `raw_identity_assertion.read`, `runner.secret.inject` | tenant, security, provider, SecretRef | critical | allow after security review | security retention class audit | partial mock | break-glass, tenant audit queries, IdP mapping |
| platform_admin | Operate platform metadata. | `auth.read`, `auth.authorize.check`, `registry.create`, `registry.update`, `policy.evaluate`, `readiness.read`, gated `git.remote_operation`, gated `llm.remote_completion` | `secret.read`, merge/rebase/force-push, `improvement.apply`, production auth enablement without IdP | tenant, platform | critical | future review | actor, principal, scope, policy decision | partial mock | admin workflow and policy bundle governance |
| system_admin | Local mock system role only. | local mock administration only | production auth, `secret.read`, force-push, credential cache access | local | critical | deny | mock actor warning | implemented mock | replace with scoped services and future break-glass |
| service_account_runner | Scoped worker automation. | `task.run`, `runner.execute`, `llm.completion`, `git.branch.create` | `secret.read`, unbounded command execution, merge, broad credential resolve | task, task_run, workspace | high | future review | `service_account_used` and authorization audit | partial mock | credential issuance, rotation, tenant queue |
| git_webhook_service | Process verified webhook metadata. | `git.webhook.process`, `git.repo.read` | merge/rebase/force-push/delete, runner execution | repo, webhook delivery | high | future review | delivery id, repo id, policy decision | mock service-account boundary | GitHub App live integration and durable replay store |
| llm_gateway_service | Route model usage and narrow LLM credential resolution. | `llm.completion`, `llm.model.use`, route selection, narrow credential resolve | `secret.read`, credential cache read, direct local CLI invoke | tenant, provider, model, budget | high | future review | usage, budget, provider, model, actor, policy audit | mock service-account boundary | tenant budgets and backend SecretRef migration |
| mcp_gateway_service | Govern MCP metadata and low-risk tool invocation. | `mcp.server.list`, low-risk `mcp.tool.invoke` | high/critical MCP, `secret.read`, unbounded network egress | tenant, MCP server, MCP tool | critical | future review | tool risk, redaction, actor, policy audit | mock service-account boundary | real transport governance and tool allowlists |
| local_agent_user | Own and consent to Local Agent invocations. | `local_agent.invoke`, `local_agent.consent.approve` | secret forwarding, credential cache read, PTY, unbounded vendor CLI | user, host, Local Agent, tenant | high | future review | consent id, host id, principal, policy decision | planned | daemon identity, device trust, consent UX |
| local_agent_admin | Manage Local Agent enrollment metadata. | Local Agent register/revoke/audit read | credential cache read, vendor CLI execution, secret forwarding | tenant, user, host | critical | future review | registration and revoke audit | planned | device trust and tenant-scoped enrollment |
| audit_reader | Read sanitized audit metadata. | `observability.audit.read`, `git.audit.read`, `llm.audit.read`, `policy.audit.read`, `security.audit.read`, `readiness.read` | raw prompt, raw webhook payload, `secret.read`, identity assertion read | tenant, retention class | high | future review | audit reads audited in future export design | planned | tenant audit filters and legal hold/export controls |
| break_glass_admin_future | Future incident-only role. | none in current runtime | all current runtime actions | future time-bound incident scope | critical | deny | legal/security approval and external audit checkpoint | future only | break-glass design, approvals, audit export |

## Defaults

- Destructive Git actions remain denied.
- Workflow/admin/secrets/deployment-style permissions are not implied by Git or platform roles.
- No role can read raw secrets through API.
- No role bypasses policy denial.
- Break-glass remains future-only and disabled.
