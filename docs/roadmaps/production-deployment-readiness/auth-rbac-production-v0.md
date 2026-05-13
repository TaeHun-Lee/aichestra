# Auth/RBAC Production Plan v0

Planning only. No real auth provider is implemented.

## Current Mock Auth State

Production Auth/RBAC Planning v0 provides provider-neutral models, deterministic mock actors, role bindings, service accounts, disabled future provider placeholders, and `AuthorizationService`. It does not implement real login, token validation, sessions, SSO, OIDC, SAML, SCIM, passwords, or API-key issuance.

## Target Options

### OIDC

- Preferred for modern enterprise SSO.
- Requires issuer, client id/secret or private key, JWKS validation, callback/session strategy, and group/claim mapping.

### SAML

- Required for some enterprise IdPs.
- Requires metadata exchange, assertion validation, signing cert rotation, and group mapping.

### SCIM

- Directory provisioning for users, teams, and status.
- Requires idempotent sync, deprovisioning, and audit.

## Principal, Team, And Role Mapping

- External subject maps to `Principal.externalSubject`.
- IdP groups map to teams or role bindings.
- App roles remain explicit Aichestra roles.
- Tenant/org id must be part of request context and policy subject.
- Disabled/deleted principals must fail closed.

## Service Account Strategy

- Service accounts are principals with scoped role bindings.
- Raw service account secrets are not stored in auth repositories.
- Credential issuance and rotation require SecretRef or a future token service.
- Service-account usage must be audited.

## Local Agent Identity Strategy

- Local Agent principals represent paired user-machine agents.
- Agent registration must bind to a human or service account owner.
- Agent sessions/channels must be revocable.
- Local Agent invocations must preserve user consent attribution.

## GitHub Webhook/System Actor Strategy

- Webhook processing uses explicit system/service actors.
- System actors must be scoped to webhook read-model operations.
- Verified webhook processing still goes through policy.
- System actors do not bypass merge/rebase/force-push denials.

## Policy Subject Mapping

`AuthContext` must map:

- actor id
- principal id
- teams
- roles
- tenant/org id
- auth mode
- service account id
- request source

Policy denial remains authoritative even for admin roles.

## Audit Actor Attribution

Audit records must preserve request id, correlation id, actor id, principal id, team ids, source, action, resource, policy decision id, and result. Audit metadata must not include tokens, cookies, passwords, API keys, session secrets, SSO tokens, or provider credentials.

## Tenant Boundary

Production requires tenant filters in:

- task/repo/registry repositories;
- Git/LLM/MCP/runner operations;
- dashboard read models;
- audit queries;
- policy resources;
- SecretRef scopes.

## Mock Actor Deprecation Plan

1. Add production profile validator.
2. Reject `MockAuthProvider` when production profile is selected.
3. Reject header actor override in production.
4. Keep mock auth available for local/tests only.
5. Add tests proving production profile fails closed.
