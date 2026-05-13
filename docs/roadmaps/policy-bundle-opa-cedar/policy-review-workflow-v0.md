# Policy Review Workflow v0

Status: planning only

## Roles

- Policy author: drafts bundle changes and test fixtures.
- Domain owner: reviews domain semantics for Git, LLM, MCP, Runner, SecretRef, Local Agent, Provider, Registry, or Auth.
- Security approver: reviews safety gates, deny-by-default behavior, secret exposure, tenant impact, and break-glass implications.
- Audit reader: verifies sanitized audit evidence.
- Platform operator: promotes approved bundles in a future rollout process.

## Lifecycle

1. Draft policy bundle change.
2. Attach schema validation results.
3. Attach golden decision tests and deny-by-default regression results.
4. Domain owner review.
5. Security approval.
6. Future signing checkpoint.
7. Future staged rollout or shadow evaluation.
8. Future rollback pin retained.

## Required Tests Before Approval

- No secret exposure.
- Unknown actions deny.
- Missing inputs deny.
- Tenant scope mismatch denies.
- Provider and credential cache boundaries deny.
- Git destructive operations remain denied.
- Runner command execution remains denied unless explicit fixture/harness gates allow.
- MCP high-risk tools deny by default.

## Audit Events

Planned events:

- `policy_bundle_created_future`
- `policy_bundle_review_requested_future`
- `policy_bundle_approved_future`
- `policy_bundle_rejected_future`
- `policy_bundle_signed_future`

## Separation Of Duties

The same actor must not author and approve a production policy bundle. Security approval is required for bundles touching SecretRef, provider credentials, Git remote operations, runner command execution, MCP high-risk tools, Local Agent invocation, or break-glass.

## Out Of Scope

No workflow engine, approval API, signing, promotion, or runtime policy change is implemented in v0.
