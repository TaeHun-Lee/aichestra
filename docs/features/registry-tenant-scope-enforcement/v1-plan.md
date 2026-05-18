# Registry Tenant Scope Enforcement v1 Plan

## Status

Planned for this task. This document follows the current docs organization in `docs/README.md`: feature work lives under `docs/features/<feature>/`, while shared auth/scope foundations remain under `docs/foundations/auth-rbac/`.

## Current Registry Resolver Behavior

- Registry v3 resolves skills, harnesses, and instructions deterministically from in-memory/mock registry repositories.
- Resolver selection preserves lifecycle, approval, eval, checksum, dependency, and simple semver gates.
- Pending approval, failed evals, non-active lifecycle entries, and checksum mismatch remain exclusion/blocker inputs.
- Resolver APIs and DTOs currently return selected refs, warnings, errors, and timestamps, but do not attach registry-specific tenant scope decisions.

## Current Registry Package and Scope Metadata

- Registry resources can carry request/audit metadata through Registry/Governance RequestContext Migration v1.
- `ScopeContextFactory` can model registry package scope and convert it to policy resource scopes.
- Registry package manifests preserve metadata locally and do not publish to a remote artifact registry.
- Existing registry read paths do not provide production tenant isolation or row-level filtering.

## Current Tenant Scope Enforcement v1 Behavior

- Tenant Scope Enforcement v1 is partial representative scaffolding.
- It compares subject and resource metadata for tenant, team, project, repo, provider, model, SecretRef, MCP, registry package, local-agent host, and audit-query scope.
- Dashboard/readiness behavior is metadata-only or warning-oriented by default.
- Secret-adjacent helper paths can deny representative sensitive access, but this is not production tenant isolation.
- Scope allow metadata does not override Policy-as-code deny.

## Current Registry/Governance RequestContext Migration Behavior

- Registry mutation, resolver, approval, eval, audit, and governance paths can carry actor, principal, service-account, request, correlation, source, tenant/team/project, and resource-scope metadata.
- The migration preserves mock-first attribution and does not implement production auth, durable grants, or production tenant enforcement.

## Current Policy/Auth Behavior

- Policy-as-code v0 is static/mock and authoritative for denied operations.
- Registry mutations already flow through a registry authorizer and optional policy-backed authorizer.
- Mock auth and service-account actor boundaries preserve attribution only; they do not issue credentials or bypass policy.

## Proposed Registry Scope Enforcement Strategy

- Add `RegistryScopeDecision` and `RegistryScopeEnforcementSummary` models in `packages/registry`.
- Add `RegistryTenantScopeEnforcementService` as a deterministic helper that evaluates registry resources using Tenant Scope Enforcement when available.
- Keep default behavior representative:
  - general registry reads: warning/metadata decisions,
  - resolver candidates: attach decisions and warnings without weakening resolver gates,
  - sensitive representative paths: deny out-of-scope or missing-scope decisions,
  - mutation scope checks: evaluate before mutation where practical, with policy deny still winning.
- Persist only in-memory decision metadata for dashboard/API/readiness.

## Resolver Integration Strategy

- Attach scope decisions and a scope summary to resolver results.
- Scope warnings must not make excluded entries selectable.
- Existing lifecycle, approval, eval, checksum, semver, dependency, and policy gates remain authoritative.
- Scope denial can add errors/warnings to metadata but must not override a stricter existing gate.

## Approval Queue and Read Model Strategy

- Evaluate approval queue items and registry resource lists into summarized scope status.
- Expose missing-scope and out-of-scope warnings/denials through dashboard/readiness/API metadata.
- Do not hide dashboard panels or claim production filtering.

## Audit and Readiness Strategy

- Add read-only registry scope endpoints and readiness summary.
- Include request/correlation/actor/service-account metadata in decisions when available.
- Sanitize metadata and expose booleans/counts/statuses only; no secrets or env values.

## Safety Constraints

- No production tenant provisioning.
- No database row-level security.
- No production Auth/RBAC implementation.
- No sessions, JWTs, API keys, service-account credentials, or external IdP calls.
- No active registry mutation through auto-improvement.
- No bypass of resolver lifecycle, approval, eval, checksum, semver, policy, or governance gates.
- No external provider, LLM, MCP, Git, Vault, or credential-cache access.
- No secrets or env values in API, dashboard, audit, docs, or tests.

## This Task Implements

- Registry scope decision and summary models.
- Deterministic registry scope enforcement service/helper.
- Representative resolver, approval queue, mutation check, API, dashboard, and readiness integration.
- Policy action/resource declarations for registry scope evaluation.
- Documentation and tests for mock-safe scope behavior.

## Out of Scope

- Production tenant isolation.
- Durable tenant grants and production auth claims.
- Database row-level security.
- Remote registry/package/provider integrations.
- Resolver override based on future production scope policy.
- Auto-application of registry/governance changes.
