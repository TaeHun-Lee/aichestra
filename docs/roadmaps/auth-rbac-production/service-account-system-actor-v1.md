# Service Account And System Actor Plan v1

This plan defines future service-account and system-actor architecture. It does not issue credentials, sign tokens, create sessions, rotate secrets, or connect to any identity provider.

## Current State

- Auth/RBAC v0 seeds mock actors and service-account metadata.
- Service Account Actor Boundary v1 now adds a static mock service-account catalog and `ServiceAccountContextFactory` for selected service/system attribution.
- Some services still synthesize system actor ids or accept service-specific actor strings, especially tenant/read-service paths. Registry/Governance RequestContext Migration v1 migrates high-value registry/governance paths while preserving explicit actor compatibility fields.
- SecretRef-backed credentials require Auth/RBAC and Policy checks before credential resolution.
- GitHub webhooks, LLM routing, MCP, runner, Local Agent Protocol, and deployment/readiness flows all need explicit actor attribution before production use.

## Service Account Categories

| Kind | Allowed scope | Allowed actions | Denied actions | Credential strategy | Audit requirement | Status |
|---|---|---|---|---|---|---|
| worker | task, task_run, workspace | task run, runner execute, mock/gated LLM, branch create | raw secret read, unbounded command, merge/rebase | future backend-backed service credential | `service_account_used`, authorization audit | planned |
| git_webhook | repo, webhook delivery | verified webhook process, repo read | merge, rebase, force-push, branch delete, runner execute | webhook secret via SecretRef, no raw storage | delivery id, repo, policy decision | planned |
| git_provider | repo, installation, provider | repo read, branch/PR create, narrow credential resolve | merge, rebase, force-push, branch delete | future GitHub App installation token path | provider credential and Git audit | future |
| llm_gateway | tenant, provider, model, budget | LLM completion, route select, model use, narrow credential resolve | secret read, credential cache read, direct local CLI invoke | future backend SecretRefs | usage, budget, model/provider, policy audit | planned |
| mcp_gateway | tenant, MCP server, MCP tool | server list, low-risk read-only mock tool invoke | high/critical tools, secret read, unbounded network | no tool secret forwarding in v1 | tool risk, actor, redaction, policy audit | future |
| local_agent_protocol | user, host, Local Agent, tenant | Local Agent invoke and consent coordination | secret forwarding, credential cache read, PTY, vendor CLI | future pairing secret through backend SecretRef | consent and protocol audit | future |
| deployment | migration, release, environment | readiness read and future release metadata | `kubectl`, Vault write, automatic DB migration, secret read | future release service identity | deployment/migration approval audit | future |
| observability_export | tenant, audit export, retention class | sanitized audit export future | raw secrets, raw prompts, raw webhook payloads | future export credential after export design | export checkpoint, retention/legal review | future |

Current runtime status: `git_webhook`, `git_provider`, `llm_gateway`, `mcp_gateway`, selected credential resolver, runner, Local Agent protocol, `registry_governance`, and `improvement_governance` policy/audit fallback attribution are mock-first and partially implemented by Service Account Actor Boundary v1 plus Registry/Governance RequestContext Migration v1. This does not issue credentials and does not make service accounts production-ready.

## System Actor Rules

- System actors are never a substitute for production auth.
- System actors must be scoped to a service, tenant, purpose, and policy resource.
- System actors cannot bypass Policy-as-code or SecretRef gates.
- Mock `system_admin` remains local/test only.
- Break-glass is future-only, time-bound, reviewed, and audited.

## Credential And Rotation Requirements

- Auth repositories store service-account metadata only.
- Service account credentials require a real secret backend and explicit future task.
- Rotation must be auditable and tied to SecretRef/lease policy.
- No raw service-account secrets, API keys, JWT signing keys, cookies, or IdP assertions may be stored in auth, audit, dashboard, or readiness output.
