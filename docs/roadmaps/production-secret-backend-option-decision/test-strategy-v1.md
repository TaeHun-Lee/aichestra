# Secret Backend Implementation v1 Test Strategy

Status: `v1_implemented`

## Unit Tests

- provider config parsing;
- selected backend disabled by default;
- missing config fails closed;
- disabled/revoked SecretRefs fail closed;
- backend error redaction;
- no credential cache reads;
- env fallback denied for production profile.

## Contract Tests

- `SecretValueProvider` contract with mock Vault client;
- metadata-only SecretRef mapping;
- version metadata handling;
- missing secret;
- permission denied;
- backend unavailable;
- timeout/fail-closed behavior.

## Optional Integration Tests

Skipped by default. Live Vault tests require all gates:

- `AICHESTRA_VAULT_INTEGRATION_TESTS=true`
- `AICHESTRA_SECRET_BACKEND_PROVIDER=vault`
- `AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true`
- `AICHESTRA_VAULT_ADDR`
- `AICHESTRA_VAULT_AUTH_METHOD=token`
- `AICHESTRA_VAULT_TOKEN`
- `AICHESTRA_VAULT_KV_MOUNT`
- `AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES`
- `AICHESTRA_TEST_VAULT_SECRET_PATH`
- `AICHESTRA_TEST_VAULT_SECRET_KEY`
- optional `AICHESTRA_VAULT_NAMESPACE`
- no production secret path;
- no raw value output.

## Mock Backend Tests

Mock backend remains the default for deterministic tests and demo dashboard data.

## Selected Backend Tests

Vault v1 tests must use mock client by default. Live Vault calls must be skipped unless every explicit gate is set.

## Secret Redaction Tests

Use fake secret-looking values and verify they are redacted from:

- API responses;
- health;
- dashboard read models;
- audit events;
- error messages;
- test output previews.

## Failure Tests

- backend unavailable;
- missing SecretRef;
- missing backend ref metadata;
- disabled SecretRef;
- revoked SecretRef;
- auth denied;
- policy denied;
- backend permission denied;
- backend returns secret-looking error.

## Rotation Future Tests

v1 may include metadata-only rotation readiness tests. Real rotation jobs remain future.

## No-secret API/Dashboard/Health Tests

Required for every new endpoint or panel. Assert:

- no secret values;
- no env values;
- no credential cache paths;
- no raw private keys;
- no tokens;
- production secret backend implemented false until production rollout controls complete.

## Live Test Skip Policy

Default tests must not call Vault/cloud secret managers. Skipped live tests should document missing gates and remain safe when gates are absent.
