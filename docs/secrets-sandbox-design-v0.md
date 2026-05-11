# Secrets and Sandbox Design v0

## What v0 Implements

Secrets and Sandbox Design v0 adds a mock-first security boundary for secret metadata, secret lease requests, sandbox profiles, sandbox sessions, network egress policy, redaction policy, security audit events, API visibility, dashboard visibility, and deterministic tests.

It does not implement real secret retrieval, production secret injection, cloud secret managers, container/VM sandboxes, network enforcement, vendor credential cache access, or real provider calls.

## Secret Models

`packages/security` defines:

- `SecretRef`: metadata-only secret reference. It stores provider, name, scope, status, and metadata, but never raw secret material.
- `SecretScope`: policy scope for allowed resource kinds, actions, provider ids, runner kinds, TTL, and approval requirement.
- `SecretLease`: request/approval lifecycle metadata for future secret access. It never stores the secret value.
- `SecretAccessDecision`: deterministic allow/deny/require-approval decision linked to policy decisions.

The default seed includes a mock metadata reference and disabled future cloud-secret placeholders only.

## SecretManager Interface

`SecurityControlService` implements the v0 `SecretManager` interface:

- `getManagerKind()`
- `validateSecretRef(secretRef)`
- `requestLease(request)`
- `revokeLease(leaseId)`
- `getSafeEnvironment(leaseId)`
- `getSecretMetadata(secretRefId)`
- `recordSecretAudit(event)`

Default behavior denies lease issuance without policy approval and returns no raw environment secret. Future `VaultSecretManagerFuture`, `AwsSecretsManagerFuture`, `GcpSecretManagerFuture`, and `AzureKeyVaultFuture` placeholders throw clear not-implemented errors and do not connect.

## Sandbox Models

`SandboxProfile` describes allowed capabilities such as network, file write, shell execution, remote Git, secrets, commands, paths, runtime, output limits, and cleanup policy.

`SandboxSession` records a requested/active/completed/cleaned-up sandbox session. v0 creates metadata records only and does not run a real sandbox runtime.

Default profiles:

- `sandbox_default_deny`: denies network, secrets, remote Git, arbitrary shell execution, and file write.
- `sandbox_local_temp_fixture`: permits only safe fixture/temp workspace command execution metadata with network/secrets/remote Git denied.
- future container, Firecracker, and Kubernetes profiles are disabled placeholders.

## Network Egress Policy

`NetworkEgressPolicy` models default allow/deny, allowed/denied hosts, ports, localhost/private-network flags, and metadata.

The default policy is `network_default_deny`, which denies all external network egress. v0 records decisions but does not implement OS-level network enforcement.

## Redaction Policy

`RedactionPolicy` controls masking of bearer tokens, API-key-like strings, environment dumps, provider tokens, and credential cache paths. It also limits stored preview bytes.

`redactWithPolicy` masks sensitive strings before API/dashboard/audit storage where v0 controls the path.

## Policy-as-code Integration

Policy-as-code v0 now includes actions and resources for:

- `secret.metadata.read`
- `secret.lease.request`
- `secret.lease.issue`
- `secret.lease.revoke`
- `sandbox.profile.use`
- `sandbox.session.create`
- `network.egress`
- `runner.secret.inject`
- `provider.credential.resolve`
- `local_agent.secret.forward`
- `audit.secret.view`

Default rules deny secret reads, runner secret injection, provider credential resolution for real credentials, network egress, Local Agent secret forwarding, and secret audit viewing. Safe local sandbox profile/session use is allowed only when network, secrets, and remote Git are disabled.

## Runner Integration

`AgentRunnerService` can receive `SecurityControlService`. When controlled local command execution is enabled for an explicit local workspace, it records a safe local sandbox session before the run and stores sandbox decision/session ids in run metadata. This does not enable secrets, network, remote Git, or production sandboxing.

## Enterprise Provider Integration

Enterprise Provider Abstraction remains blocked by default. Provider catalog entries may reference `secretRef` metadata, but v0 does not resolve raw provider credentials. Local CLI providers still require a future Aichestra Local Agent and must not read vendor credential caches.

## Audit Events

Security audit events include:

- `secret_ref_validated`
- `secret_lease_requested`
- `secret_lease_denied`
- `secret_lease_issued_mock`
- `secret_lease_revoked`
- `secret_access_blocked`
- `sandbox_profile_selected`
- `sandbox_session_requested`
- `sandbox_session_created`
- `sandbox_session_completed`
- `sandbox_session_cleaned_up`
- `network_egress_blocked`
- `redaction_applied`
- `unsafe_output_truncated`

Audit metadata is sanitized and must not include raw secrets, provider tokens, credential cache content, or raw prompts.

## API Endpoints

Secrets:

- `GET /security/secrets/refs`
- `GET /security/secrets/scopes`
- `POST /security/secrets/leases/request`
- `GET /security/secrets/leases`
- `POST /security/secrets/leases/:id/revoke`
- `GET /security/secrets/audit`

Sandbox:

- `GET /security/sandbox/profiles`
- `GET /security/sandbox/sessions`
- `POST /security/sandbox/sessions`
- `GET /security/sandbox/audit`

Network and redaction:

- `GET /security/network/policies`
- `GET /security/redaction/policies`
- `POST /security/redaction/test`

`GET /health` now reports secret manager kind, sandbox support status, default sandbox profile, network default action, and redaction status without exposing secrets.

## Dashboard Changes

The dashboard shows:

- secret manager kind
- secret refs metadata
- secret scopes
- denied lease request examples
- sandbox profiles and sessions
- network egress policy
- redaction policy
- recent security audit events
- blocked secret/network examples

The dashboard does not expose raw secrets.

## Test Strategy

`tests/secrets-sandbox-design-v0.test.ts` covers:

- secret refs contain no raw values
- invalid raw-secret and credential-cache references are rejected
- mock lease requests are denied without approval
- lease revoke works
- safe environment returns no raw secret by default
- default sandbox denies network/secrets/remote Git
- safe local fixture profile remains constrained
- future sandbox profiles are disabled placeholders
- network egress is denied
- redaction masks bearer tokens, API keys, env dumps, and credential cache paths
- policy decisions deny secret/network/runner secret operations
- runner integration records sandbox metadata
- provider boundary remains blocked
- security API, health, dashboard, and repository behavior

## Known Limitations

- Secret backends are in-memory and metadata-only.
- No real Vault/cloud secret manager integration exists.
- No production secret injection exists.
- No real sandbox runtime exists.
- Network egress is modeled and policy-checked, not enforced by OS/container controls.
- Local Agent daemon/protocol and vendor CLI execution remain future work.
- Security repositories are in-memory; Postgres tables are schema skeleton only.

## Next Recommended Task

Aichestra Local Agent Protocol v0, or Real Git Adapter v1 if controlled remote Git branch/PR creation should be enabled next.
