# Break-glass Policy Plan v0

Status: planning only

Break-glass is not implemented, enabled, or executable in v0.

## Use Cases

- Restore access after production IdP outage.
- Temporarily inspect sanitized audit metadata during incident response.
- Temporarily approve rollback of a faulty policy bundle.

## Request And Approval

Future break-glass requires:

- named requester
- incident id
- time-bound duration
- security approver
- platform approver
- narrow scope
- mandatory post-incident review
- full audit trail

## Actions That Remain Forbidden

Even under future break-glass:

- raw secret read
- provider credential cache read
- unredacted prompt/output read
- unverified webhook processing
- automatic merge
- rebase push
- force push
- branch deletion
- runner unrestricted shell execution
- MCP high-risk write/deploy tool invocation without explicit future approval
- Local Agent danger/full-access mode

## Audit

Planned events:

- `policy_break_glass_requested_future`
- `policy_break_glass_approved_future`
- `policy_break_glass_expired_future`

## Dashboard Visibility

Dashboard should show break-glass as future/disabled until production Auth/RBAC, audit export, policy bundle workflow, and incident review controls exist.
