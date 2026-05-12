# Policy-as-code Skeleton v0 Plan

## Current Safety Gates

Current controls are distributed across packages:

- Git Adapter v0 blocks remote Git by default through provider config and the gated GitHub skeleton.
- LLM Gateway v0 blocks remote LLM calls by default, excludes disabled/deprecated models, and enforces deterministic budget checks.
- Local Agent Runner v1 keeps the mock runner as default, disables local runner/command execution by default, validates workspaces, and enforces harness command policy.
- Registry v3 enforces mock RBAC through `RegistryMutationAuthorizer`, approval/eval/checksum gates, append-only history, rollback, and audit logs.
- Phase 4 Governance v1 blocks apply by design through readiness/apply gates and keeps draft registry changes inactive.

These controls are effective for the mock-first milestone but are not centralized.

## Why a Central Policy Layer Is Needed

Real integrations will need one auditable policy decision layer for:

- consistent allow/deny/review decisions;
- cross-domain safety rules;
- policy decision audit trails;
- future OPA/Rego or Cedar adapter boundaries;
- avoiding ad hoc safety checks inside provider implementations.

## Proposed Policy Domains

Policy v0 covers:

- tasks and task runs;
- Git branch/PR/remote operations;
- LLM model/provider/completion operations;
- runner execution, command execution, and workspaces;
- registry items and registry mutations;
- improvement proposals and draft registry changes;
- MCP tools and secret scopes.

## Proposed Policy Decision Model

Policy v0 introduces:

- `PolicySubject`
- `PolicyResource`
- `PolicyAction`
- `PolicyContext`
- `PolicyRule`
- `PolicyDecision`
- `PolicyDecisionAuditEntry`

Decisions are deterministic and include matched rule ids.

## Default Deny-by-default Rules

Default rules are intentionally restrictive:

- deny remote Git operations, merge, rebase, and branch deletion;
- deny remote LLM completion;
- deny runner command execution unless fixture-local execution is enabled and harness/workspace checks pass;
- deny secret reads;
- deny MCP tool calls;
- deny improvement apply;
- deny registry mutations unless actor roles are sufficient;
- allow mock Git and mock LLM operations;
- allow safe local read-only Git fixture contexts;
- require approval for high-risk task execution examples.

## Integration Points

This task will integrate policy checks where practical:

- `GitIntegrationService` for branch and PR creation and remote-operation attempts;
- `LLMGatewayService` for model use, mock/remote completion, and provider calls;
- `AgentRunnerService` for runner execution and command execution;
- Registry authorization through a policy-backed authorizer compatible with existing mock RBAC;
- API, health, and dashboard policy visibility.

Phase 4 governance apply remains denied/unimplemented.

## This Task Implements

- Policy domain models and validators.
- Static/mock policy engine with a default policy set.
- Policy decision audit repository and service.
- DTO mappers.
- Policy API endpoints.
- Service-boundary policy checks for Git, LLM, Runner, and Registry where practical.
- Dashboard policy summary and blocked examples.
- Schema and repository inventory updates.
- Deterministic tests.

## Out of Scope

- real OPA/Rego integration;
- real Cedar integration;
- external policy services;
- dynamic policy code upload;
- `eval()` or user-provided policy execution;
- production auth/RBAC;
- production secrets management;
- real provider calls;
- remote Git operations;
- auto-apply of improvement proposals.

## Future OPA/Rego or Cedar Plan

Future work can add a `PolicyEngine` implementation that delegates to OPA/Rego or Cedar while preserving the same `PolicyEvaluationRequest` and `PolicyDecision` boundary. That future adapter must be explicitly configured, auditable, deterministic in tests, and disabled by default until production auth/secrets/sandboxing exist.
