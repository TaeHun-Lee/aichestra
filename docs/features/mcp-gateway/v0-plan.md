# MCP Gateway v0 Plan

## Current State

Aichestra currently has mock-first orchestration boundaries for LLMs, runners, Git, Auth/RBAC, Policy-as-code, SecretRef-backed credentials, Secrets/Sandbox, and the dashboard read model. The existing MCP surface is only a minimal legacy adapter stub in `packages/adapters`; it echoes mock tool calls and is not a centralized governance layer.

This plan is under `docs/features/mcp-gateway/` because `docs/README.md` defines feature work as `docs/features/<slug>/v0-plan.md` followed by `v0.md`. Existing canonical repository inventory and persistent schema documents currently live under `docs/foundations/`, not `docs/reference/`.

LLM Gateway v2 routes completions through model/provider policy, budget, SecretRef, usage, and audit boundaries. It explicitly does not auto-execute tool calls. Runner v1 and Local Agent Protocol v1 are also mock-first: they do not run vendor CLIs, do not forward secrets, and do not execute MCP tools directly.

Policy-as-code v0 currently denies legacy `mcp.tool.call` by default. Auth/RBAC v0 provides `AuthContext`, roles, permissions, and `AuthorizationService`, but it does not yet define MCP-specific permissions. Secrets/Sandbox v0 provides metadata-only `SecretRef`, lease decisions, network deny-by-default, sandbox metadata, redaction policy, and audit events. SecretRef Provider Credentials v1 adds gated env-backed credential resolution, but no MCP tool should receive real secrets in v0.

The dashboard is API-backed and read-only. It can aggregate service state, config, audits, and blocked examples, but must not invoke tools or expose raw secrets.

## Why MCP Gateway Is Needed

MCP-style tools introduce a separate risk surface from model completion: tools can read external state, write systems, trigger workflows, or request secrets. A central MCP Gateway is needed before any real MCP integration so every tool invocation has a consistent path through Auth/RBAC, Policy-as-code, SecretRef/Secrets/Sandbox, redaction, audit, and dashboard visibility.

## Proposed Server Catalog

MCP Gateway v0 will add provider-neutral catalog models:

- `MCPServerCatalogEntry` for mock and future server registrations.
- `MCPToolDefinition` for tool metadata, risk level, input/output schema, required permissions, required SecretRefs, allowed resource scopes, and status.
- In-memory repositories for server entries, tool definitions, invocation results, and audit events.

Seeded mock servers:

- `mock-github-mcp`
- `mock-docs-search-mcp`
- `mock-jira-mcp`
- `mock-db-schema-mcp`
- `mock-ci-mcp`

Seeded low-risk tools are read-only and deterministic. High-risk and critical examples remain blocked or disabled by default.

## Proposed Invocation Lifecycle

1. Resolve the server and tool from the catalog.
2. Reject unknown, disabled, or deprecated servers/tools.
3. Resolve or accept an explicit `AuthContext`.
4. Check `AuthorizationService` for MCP list/invoke permissions.
5. Evaluate Policy-as-code for tool listing, invocation, risk class, secret use, network access, writes, and deploys.
6. Block secret-requiring tools in v0 before any lease or value forwarding.
7. Block network, write, deploy, local execution, and real transport requests by default.
8. Redact and size-limit input/output previews.
9. Execute only deterministic mock read-only tools.
10. Persist invocation result metadata and MCP audit events.

## Tool-Level Policy Model

Policy actions to add:

- `mcp.server.list`
- `mcp.tool.list`
- `mcp.tool.invoke`
- `mcp.tool.invoke.low_risk`
- `mcp.tool.invoke.high_risk`
- `mcp.tool.invoke.critical`
- `mcp.tool.secret.resolve`
- `mcp.tool.network_access`
- `mcp.tool.write`
- `mcp.tool.deploy`

Default rules will allow listing active mock servers/tools for authenticated mock/system actors, allow low-risk read-only mock tool invocation for permitted roles, and deny high-risk, critical, secret, network, write, deploy, disabled, and legacy `mcp.tool.call` paths by default.

## Secret/Sandbox Requirements

No raw secrets will be stored or returned in any MCP model, DTO, audit event, dashboard section, or health response. Tools requiring secrets will be blocked by default in v0 and will not receive leases or credential handles. Network egress remains denied by default. Any tool that implies local execution, subprocess spawning, CLI use, or Local Agent forwarding remains disabled or unavailable.

Redaction policy will be applied to input/output/audit previews before storage or response.

## API And Dashboard Plan

API endpoints:

- `GET /mcp/config`
- `GET /mcp/servers`
- `GET /mcp/servers/:id`
- `GET /mcp/servers/:id/tools`
- `GET /mcp/tools/:id`
- `POST /mcp/tools/:id/invoke`
- `GET /mcp/invocations`
- `GET /mcp/invocations/:id`
- `GET /mcp/audit`

Health will expose MCP Gateway kind, real transport enabled false, server count, active tool count, and high/critical enabled count. Dashboard read models will expose MCP status, catalogs, risk summary, recent invocations, blocked examples, and recent audit events without secrets or raw unredacted output.

## Out Of Scope

MCP Gateway v0 will not implement real MCP server calls, stdio/http/sse transport, GitHub/Jira/Slack/DB/search integrations, vendor CLI execution, credential cache reads, secret injection, Local Agent MCP forwarding, model-generated automatic tool calls, registry auto-improvement mutation, production persistence, or production-ready authorization.
