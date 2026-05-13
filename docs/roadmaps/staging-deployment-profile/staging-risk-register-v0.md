# Staging Risk Register v0

Status: v0_implemented
Scope: open staging risks

| Risk | Severity | Mitigation | Owner | Status | Production impact |
| --- | --- | --- | --- | --- | --- |
| Staging uses mock Auth/RBAC only. | critical | Keep mock actor warning visible; implement production Auth/RBAC before production. | platform-security | open | Blocks production. |
| Real secret backend is not implemented. | critical | Use SecretRef metadata only; implement real backend before production and meaningful provider staging. | platform-security | open | Blocks production. |
| Postgres staging profile is not provisioned. | high | Require Postgres profile and optional contract tests before staging promotion. | platform-ops | open | Blocks durable validation. |
| Backup/restore drills are not implemented. | high | Add non-production restore drills and evidence before operational staging. | platform-ops | open | Blocks production operations. |
| Policy bundle runtime is not implemented. | high | Keep StaticPolicyEngine deny-by-default; implement bundle review/test/signing later. | platform-security | open | Blocks production policy governance. |
| External observability/export/alerting is not implemented. | high | Keep local read-only observability; plan export/alerts in later task. | platform-ops | open | Blocks production operations. |
| GitHub App live token exchange is not enabled. | medium | Use mock token handles only; create dedicated integration-test profile later. | integrations | open | Blocks live GitHub App staging. |
| Remote MCP is blocked. | medium | Keep MCP mock-first; create separate MCP governance milestone. | integrations | accepted | Limits staging scope. |
| Env fallback could be misused. | high | Mark env fallback blocked/discouraged in staging; expose warning and counts only. | platform-security | open | Blocks production secrets readiness. |
| Dashboard/demo fallback could hide readiness gaps. | medium | Require API-backed dashboard for staging and disable demo fallback in future deploy config. | platform | open | Reduces validation confidence. |
