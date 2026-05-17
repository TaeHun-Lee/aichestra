# Scope Fallback Behavior v1

Status: Dashboard/Readiness Tenant Scope Planning `v1_implemented`.

This document defines target fallback behavior for future dashboard/readiness filtering. It is not enforced by this task.

## Defaults

- Local/mock runtime: allow metadata-only display with an explicit missing-scope warning.
- Staging planning: allow display with an explicit warning and production blocker.
- Production: deny scoped details or require explicit tenant/global admin scope.
- Audit views: require explicit audit query scope before production.
- Secret-adjacent views: always redact raw values, even for privileged roles.

## Missing Scope Behavior

| Missing Scope | Local / Mock Runtime | Staging Planning | Production Target | Notes |
|---|---|---|---|---|
| tenantId | display metadata-only dashboard/readiness data with warning | display planning data and mark production blocker | deny scoped details unless future global admin scope is present | tenant is the default production isolation boundary |
| teamId | display tenant/project metadata when available | warn that team membership is unresolved | require team scope for team-specific queues and summaries | not all global planning panels need team scope |
| projectId | display tenant-level planning metadata with warning | mark project-filtering blocker for staging/shared data | deny project/task/release details without project scope | tasks, staging, CI/CD, registry, and runner surfaces need project scope |
| repoId | display non-mutating Git/conflict metadata with warning | mark repo-filtering blocker | deny repo-specific Git, conflict, merge queue, GitHub App, and release details | no provider merge/rebase/push behavior is enabled |
| providerId/modelId | display provider/model catalog metadata with warning | mark provider/model filtering blocker | deny provider/model route, health, budget, and integration detail | LLM and provider panels must not leak tenant budgets |
| SecretRef scope | display counts and high-level readiness only | mark secret-scope blocker | deny secret-adjacent details and always redact values | raw secrets, env values, tokens, Vault values, private keys, and cache paths stay hidden |
| MCP tool scope | display mock catalog summary with warning | mark MCP tool-scope blocker | deny MCP server/tool detail without explicit tool scope | real MCP transport remains disabled by default |
| registry package scope | display package counts and lifecycle summaries | mark package-scope blocker | deny package detail, approval queues, and governance details without package scope | registry gates remain authoritative |
| local agent host scope | display fixture/summary metadata with warning | mark host-scope blocker | deny host/session/channel detail without local-agent host scope | no real daemon, CLI execution, or credential cache read is implemented |
| audit query scope | display aggregate audit-readiness status only | mark audit-scope blocker | deny audit event detail and require tenant/team/project/audit query scope | no raw audit payloads or secret-bearing fields are returned |

## Redaction Guarantees

Fallback behavior must never expose:

- raw secret values;
- env values;
- provider API keys;
- Vault tokens, secret values, or sensitive path/key identifiers;
- GitHub tokens, installation tokens, private keys, or webhook secrets;
- session ids, cookies, JWTs, passwords, client secrets, or raw identity assertions;
- credential cache paths or file contents;
- raw prompts, raw provider responses, raw runner output beyond preview limits, or raw audit payloads.

## Implementation Notes

Dashboard/Readiness Tenant Scope Planning v1 exposes fallback behavior as read-only planning data through `/readiness/tenant-scope/fallback-behavior` and `/dashboard/tenant-scope`. Future implementation must add request-time filtering before treating these rules as active enforcement.
