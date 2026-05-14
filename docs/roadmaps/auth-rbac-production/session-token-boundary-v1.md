# Session And Token Boundary v1

Status: `boundary_recorded`
Scope: future session/token design only
Production sessions implemented: no
JWT issuance implemented: no
External IdP calls enabled: no

## Purpose

This document defines the future session and token boundary for Production Auth/RBAC.

It does not implement login, logout, callbacks, cookies, JWTs, token validation, password auth, API keys, service-account credentials, refresh tokens, or external IdP calls.

## Boundary Model

Production Auth/RBAC should separate these concepts:

| Concept | Future role | Storage rule |
| --- | --- | --- |
| External identity assertion | Input from OIDC/SAML provider. | Never store raw. Validate inside provider adapter and retain sanitized mapped claims only. |
| Aichestra principal | Stable internal identity linked to external subject. | Store durable metadata and status only. |
| Actor | Runtime actor derived from principal, service account, system actor, or Local Agent user. | Store metadata, roles, teams, status. |
| Session envelope | Future authenticated browser/API session. | Store opaque server-side id hash or handle metadata only. |
| JWT or signed token | Future option for service-to-service or stateless API. | Do not issue in this plan; future keys must be SecretRef-backed. |
| API key | Future non-browser credential option. | Do not issue in this plan; prefer service accounts and scoped SecretRefs first. |
| Service-account credential | Future machine identity credential. | Do not issue in this plan; metadata only until real secret backend and rotation exist. |

## Future Session Requirements

Future sessions must:

- be scoped to tenant/workspace/project where applicable;
- carry request id and correlation id through service calls;
- map to a principal and actor before authorization;
- support revocation and expiry;
- avoid storing raw IdP assertions, access tokens, refresh tokens, cookies, passwords, or API keys;
- record sanitized audit events for creation, refresh, revocation, and denied access;
- fail closed when tenant scope, actor status, provider status, or policy gate is invalid.

## Token Validation Requirements

Future token validation must:

- happen inside an auth provider adapter;
- validate issuer, audience, expiry, signature, nonce/state where applicable, and required claims;
- sanitize validation errors;
- map external subject to a durable principal;
- reject disabled or deleted principals;
- reject stale group/team mappings after deprovisioning;
- never pass raw token material to policy, registry, Git, LLM, MCP, Local Agent, dashboard, or observability layers.

## Cookie And Browser Boundary

Future browser sessions must:

- use secure, HTTP-only, same-site cookies where browser sessions are used;
- store only opaque handles client-side;
- keep CSRF and redirect-state validation inside auth middleware;
- avoid exposing session ids in dashboard, health, audit, errors, or logs;
- avoid client-visible role or secret material that could be trusted without server validation.

## Service-To-Service Boundary

Future service-to-service calls must use scoped service accounts:

- worker service account;
- Git webhook service account;
- Git provider service account;
- LLM Gateway service account;
- MCP Gateway service account;
- Local Agent Protocol service account;
- deployment service account;
- observability export service account.

Each service account requires narrow role bindings, tenant/resource scope, rotation plan, and audit events before credentials are issued.

## Denied In This Milestone

- Password authentication.
- Session creation.
- JWT issuance.
- API-key issuance.
- Service-account credential issuance.
- Refresh-token storage.
- Raw token, cookie, assertion, or session id logging.
- Credential cache reads.
- External IdP calls.

## Future Tests

Future implementation tests must cover:

- invalid token/assertion denied;
- disabled principal denied;
- expired session denied;
- tenant scope mismatch denied;
- policy denial remains authoritative;
- raw tokens/assertions/cookies/session ids never appear in DTOs, audit, health, dashboard, logs, or errors;
- service accounts cannot act outside explicit scopes.
