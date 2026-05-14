# Production Auth/RBAC Implementation Phases v1

Status: `phases_recorded`
Scope: future implementation sequencing only
Production auth implemented: no

## Purpose

This document defines a safe implementation order for Production Auth/RBAC after planning acceptance.

It does not implement real auth, call external IdPs, issue credentials, or enable production traffic.

## Phase 0 - Boundary Inventory Audit

Goal: find every protected path that currently accepts actor strings, mock actors, or missing tenant scope.

Deliverables:

- API, worker, Git, LLM, MCP, Registry, Security, Local Agent, Dashboard, Observability boundary inventory.
- List of methods that need `RequestContext` or `AuthContext`.
- List of audit events missing request id, correlation id, principal id, or scope.
- No code behavior changes required.

Stop gate: do not implement provider adapters until this inventory is complete.

## Phase 1 - Auth Configuration And Provider Interfaces

Goal: add configuration metadata and provider interface shape for real providers without live calls.

Deliverables:

- production provider config schema with status-only DTOs;
- OIDC/SAML/SCIM disabled adapter skeletons;
- SecretRef metadata references for future client credentials;
- no external calls in default runtime/tests.

Stop gate: no login/callback/token code yet.

## Phase 2 - Durable Auth Repository Design

Goal: design durable auth storage before runtime enablement.

Deliverables:

- principal, actor, team, role, permission, role binding, service account, IdP provider, session metadata schema plan;
- tenant/workspace/project/repo indexes;
- audit retention mapping;
- migration plan.

Stop gate: do not persist raw tokens, assertions, passwords, cookies, or service-account credentials.

## Phase 3 - Request Context Propagation

Goal: replace ad hoc actor strings in protected service paths.

Deliverables:

- `RequestContext` or `AuthContext` accepted by protected API/service methods;
- worker and webhook system contexts mapped to scoped service accounts;
- correlation id propagation into audit;
- tenant scope fields prepared.

Stop gate: production profile fails closed for any protected path without actor and scope attribution.

## Phase 4 - Tenant Scope Enforcement

Goal: enforce tenant/workspace/project/repo filters before production auth enablement.

Deliverables:

- scoped repository query contracts;
- scoped dashboard/readiness/audit filters;
- scoped policy subjects/resources;
- scoped SecretRefs and provider allowlists.

Stop gate: production profile remains blocked until read and write paths are scope-filtered.

## Phase 5 - Interactive Provider Adapter

Goal: implement one real interactive provider path behind explicit gates.

Preferred order:

1. OIDC if the target deployment supports stable OIDC.
2. SAML if required by the target deployment.

Deliverables:

- adapter-level metadata validation;
- login/callback or assertion consumer path only after explicit task approval;
- raw token/assertion redaction tests;
- disabled-by-default provider gates.

Stop gate: no provider enabled without SecretRef credentials, redirect/assertion endpoint review, token/assertion tests, tenant mapping, and policy tests.

## Phase 6 - Directory Lifecycle

Goal: add SCIM or equivalent sync planning/implementation after interactive auth is stable.

Deliverables:

- idempotent user/team lifecycle sync;
- deprovisioning behavior;
- group-to-role mapping review;
- sync audit.

Stop gate: deprovisioned users must fail closed.

## Phase 7 - Service Accounts

Goal: issue or resolve service-account credentials only after real secret backend and rotation design are accepted.

Deliverables:

- scoped service-account principals;
- service-account role bindings;
- credential issuance plan or implementation behind SecretRef;
- rotation and revocation audit.

Stop gate: no raw service-account credential storage.

## Phase 8 - Mock Actor Production Rejection

Goal: make production profile reject mock actors.

Deliverables:

- profile-aware mock actor block;
- dashboard/health/readiness no-mock assertions;
- tests for local/test allowance and production denial;
- migration notes for any remaining mock actor dependency.

Stop gate: production auth cannot be marked ready while mock actors are accepted for production profile.

## Phase 9 - Production Readiness Audit

Goal: verify production Auth/RBAC readiness before any production traffic.

Required verification:

- real provider gate status;
- no-token/no-secret/no-env exposure;
- tenant scope enforcement;
- policy denial authority;
- SecretRef credential boundaries;
- service-account scope;
- audit/observability retention;
- mock actor rejection;
- break-glass remains disabled unless separately approved.

Result options:

- `ready_for_limited_production_auth_validation`
- `blocked`
- `not_ready`

## Recommended First Task

Run Phase 0 Boundary Inventory Audit before implementation. It should be audit-only and produce a report under `docs/audits/`.
