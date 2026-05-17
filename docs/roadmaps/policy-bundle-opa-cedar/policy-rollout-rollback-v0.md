# Policy Rollout and Rollback Strategy v0

Status: planning only

## Versioning

Future policy bundles should use:

- semantic bundle version
- compatibility version
- target domain list
- static rule baseline reference
- changelog summary
- test fixture revision
- signing metadata placeholder

## Staged Rollout

Future rollout stages:

1. Draft bundle, not executable.
2. Validated bundle, tests attached.
3. Reviewed bundle, approved but inactive.
4. Shadow evaluation against `StaticPolicyEngine`, using the planning model in `docs/roadmaps/policy-bundle-runtime-poc/shadow-evaluation-v1.md`.
5. Dry-run decisions recorded but not enforced.
6. Per-domain activation behind explicit gates.
7. Full activation only after production Auth/RBAC, tenant scope, audit, and rollback controls exist.

## Rollback Triggers

- deny rate spike
- allow/deny mismatch against static baseline
- tenant scope mismatch
- secret exposure finding
- provider safety gate regression
- latency or availability regression
- emergency security review

## Rollback Process

Future rollback must pin the previous approved bundle id and preserve audit evidence. It must not delete policy history.

## Audit Requirements

Planned events:

- `policy_bundle_rollout_started_future`
- `policy_bundle_rollback_started_future`
- `policy_bundle_shadow_mismatch_future`

## Out Of Scope

No rollout controller, background job, policy runtime activation, shadow evaluator, candidate runtime execution, or rollback mechanism exists in v0.
