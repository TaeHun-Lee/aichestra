# Production Secret Backend Decision Risk Register v0

Status: `v0_implemented`

| Risk | Severity | Likelihood | Impact | Mitigation | Owner placeholder | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Accidental secret exposure | critical | medium | Raw credentials leak through API, dashboard, audit, logs, or tests | Metadata-only DTOs, redaction, no-secret tests | security_owner | open |
| Wrong tenant/team secret access | critical | medium | Credentials resolved outside intended scope | Production Auth/RBAC, service accounts, backend namespaces/policies | identity_platform_owner | open |
| Env fallback used in production | critical | medium | Bypasses backend audit/rotation/revocation | Block env fallback in production | platform_owner | open |
| Stale credential | high | medium | Old provider access remains active | stale checks and rotation runbooks | security_owner | open |
| Failed rotation | high | medium | Provider access breaks | staged validation and rollback to disabled/mock | integrations_owner | open |
| Backend outage | high | medium | Live integrations fail | HA, retries, fail-closed behavior, alerting | platform_ops_owner | open |
| Audit gap | high | medium | Incident cannot be reconstructed | backend audit plus Aichestra correlation | observability_owner | open |
| Missing break-glass process | high | medium | Emergency access is improvised | explicit audited break-glass design | security_owner | open |
| Overbroad IAM | critical | medium | Service account reads too many credentials | least privilege backend policy and review | platform_security_owner | open |
| Provider credential cache misuse | critical | low | User-owned provider credentials are read/uploaded | keep cache reads denied and tested | security_owner | open |
| Local Agent secret forwarding | high | medium | Secrets forwarded to user machine/vendor CLI | keep forwarding denied | local_agent_owner | open |
| Test secret leakage | high | medium | Live test output exposes secret material | skipped-by-default live tests and redaction | qa_owner | open |
| Dashboard/health leak | critical | low | Readiness output exposes values | booleans/counts/status only | dashboard_owner | open |
| Backup/restore contains sensitive refs | medium | medium | metadata reveals sensitive paths/names | opaque ids and metadata review | db_owner | open |
| Incident response gap | high | medium | leak/outage response is slow or incomplete | runbooks and drills | security_owner | open |

No listed risk is mitigated by this decision alone. The v1 implementation task must keep these risks visible.
