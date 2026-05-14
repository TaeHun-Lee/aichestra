# Production Auth Security And Audit Requirements v1

Status: `requirements_recorded`
Scope: security and audit planning only
Production auth implemented: no
Audit export implemented: no

## Purpose

This document defines security and audit requirements for a future Production Auth/RBAC implementation.

It does not implement real IdP calls, audit export, SIEM integration, sessions, JWTs, service-account credentials, secret reads, or credential-cache access.

## No-Secret And No-Token Rules

The following must never appear in source, DTOs, audit, health, dashboard, readiness, errors, test snapshots, logs, or reports:

- OIDC access tokens;
- OIDC refresh tokens;
- OIDC ID tokens;
- SAML assertions;
- SCIM bearer tokens;
- cookies;
- session ids;
- passwords;
- API keys;
- service-account credentials;
- IdP client secrets;
- signing keys;
- private keys;
- raw identity provider payloads;
- credential-cache paths or contents;
- env values.

## Required Audit Events

Future implementation should emit sanitized events for:

| Event | Required metadata | Forbidden metadata |
| --- | --- | --- |
| `auth_provider_config_checked` | provider kind, configured booleans, missing gate names | client secrets, issuer secrets, raw env values |
| `auth_login_started` | request id, provider kind, tenant hint | redirect secret, state value, raw URL with secrets |
| `auth_login_completed` | principal id, actor id, provider id, mapped claim names | raw token, raw assertion |
| `auth_login_denied` | reason code, provider kind, request id | raw error response with credentials |
| `session_created` | actor id, principal id, session handle hash prefix, expiry class | raw cookie, full session id |
| `session_revoked` | actor id, principal id, revocation reason | raw session id |
| `scim_sync_processed` | operation type, object kind, mapped ids, result | bearer token, raw user payload |
| `role_binding_evaluated` | role id, scope kind/id, result | secrets, assertions |
| `tenant_scope_denied` | actor id, principal id, requested scope, allowed scope summary | raw data payload |
| `service_account_used` | service account id, scope, action, policy decision id | service credential |
| `mock_actor_blocked` | profile, actor id, source | raw header values beyond actor id |
| `policy_denied_after_rbac_allow` | policy decision id, action, resource kind | prompts, provider response, secrets |

## Audit Dimensions

Every protected auth event should include where available:

- request id;
- correlation id;
- actor id;
- principal id;
- service account id;
- tenant id;
- workspace id;
- project id;
- repo id;
- source boundary;
- auth provider id;
- auth mode;
- policy decision id;
- result;
- reason code.

## Observability Alignment

Auth events must flow into Observability / Audit Retention through sanitized envelopes.

Requirements:

- auth and credential events use security or compliance retention classes where appropriate;
- redaction class is `sensitive_metadata` or `secret_adjacent` for auth-adjacent records;
- audit queries must become tenant-scoped before production export;
- export checkpoints must not include raw tokens, prompts, webhook payloads, or provider credentials;
- denied/blocked auth events must be countable without exposing raw data.

## Security Gates

Production auth cannot be enabled until:

- mock actors are blocked for production profile;
- tenant scope model is enforced in protected reads and writes;
- provider credentials use SecretRef-backed resolution;
- service-account credentials are metadata-only or issued through a real secret backend in a later approved task;
- policy denial remains authoritative;
- no-secret/no-token tests pass;
- audit event redaction tests pass;
- request context propagation tests pass.

## Incident And Break-Glass Notes

Break-glass remains future-only. Before any break-glass role is enabled, the project needs:

- time-bound approval;
- explicit incident id;
- second-person review;
- legal/security audit retention;
- tenant-scoped access limit;
- post-incident review;
- no raw secret access through auth APIs.
