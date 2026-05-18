# Vault Live Integration Enablement v1

Status: `v1_implemented`

Vault Live Integration Enablement v1 makes the skipped-by-default Vault live validation path clearer and safer to operate against one test-only Vault KV v2 path. It does not enable Vault by default, does not call Vault in default runtime/tests, and does not make production Vault rollout ready.

## What v1 Implements

- `VaultLiveIntegrationReadiness`, `VaultLiveValidationCheck`, `VaultLiveValidationRunRecord`, `VaultLiveIntegrationRunbook`, and `VaultLiveIntegrationSummary` metadata models.
- Read-only deployment-readiness service methods for live readiness, checks, runbook, summary, and manual-run eligibility.
- Stronger validation for required gates, unsafe gates, test-only path markers, production-looking paths, path allowlist prefixes, test key markers, and forbidden write/delete/rotate/broad-list flags.
- Read-only endpoints:
  - `GET /readiness/secrets/vault/live-readiness`
  - `GET /readiness/secrets/vault/live-checks`
  - `GET /readiness/secrets/vault/live-runbook`
  - `GET /readiness/secrets/vault/live-summary`
- Dashboard Vault Integration panel fields for live enablement status, live checks, run record, and production rollout false.
- Deterministic tests plus skipped-by-default live enablement skeleton coverage.

## What v1 Does Not Implement

- No production Vault rollout.
- No default Vault connection.
- No Vault write, delete, rotate, broad list, migration, or cleanup.
- No Vault HA, unseal, storage backend, Vault Agent, Vault CSI, sidecar, Terraform, Helm, Kubernetes, or cloud infrastructure.
- No AppRole/Kubernetes auth production flow.
- No BYOK, secret migration, production credential issuance, or credential cache reads.
- No external provider, GitHub, LLM, MCP, Kubernetes, Temporal, OPA, Cedar, artifact registry, cloud, vendor CLI, or external auth call.

## Required Env Gates

All required gates must be configured before a manual live validation can be marked ready:

```text
AICHESTRA_VAULT_INTEGRATION_TESTS=true
AICHESTRA_SECRET_BACKEND_PROVIDER=vault
AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER=true
AICHESTRA_VAULT_ADDR=<configured but never returned>
AICHESTRA_VAULT_AUTH_METHOD=token
AICHESTRA_VAULT_TOKEN=<configured but never returned>
AICHESTRA_VAULT_KV_MOUNT=<test KV v2 mount>
AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES=<narrow test-only prefix list>
AICHESTRA_TEST_VAULT_SECRET_PATH=<allowlisted test-only path>
AICHESTRA_TEST_VAULT_SECRET_KEY=<test-marked key name>
```

Optional:

```text
AICHESTRA_VAULT_NAMESPACE=<configured but never returned>
AICHESTRA_VAULT_REQUEST_TIMEOUT_MS=<bounded timeout>
```

Missing gates keep live readiness skipped or `ready_if_configured`. Unsafe gates make live readiness `blocked_unsafe`.

## Test-only Path Requirements

`AICHESTRA_TEST_VAULT_SECRET_PATH` must:

- be under one configured `AICHESTRA_VAULT_ALLOWED_PATH_PREFIXES` prefix;
- include a non-production marker such as `test`, `tests`, `dev`, `development`, `integration`, `sandbox`, `nonprod`, `non-production`, or `ci`;
- avoid production-looking markers such as `prod`, `production`, `customer`, `tenant`, `live`, `real`, `payment`, `billing`, `private`, or `root`;
- point to one small test-only KV v2 secret.

Readiness surfaces expose only booleans such as `testPathAllowlisted` and `testPathLooksSafe`. They do not return the raw path.

## Path Allowlist Requirements

The allowlist must be narrow and test-only. A prefix permits an exact match or child path only. For example, a test-only prefix can allow one child test secret, but a production-like prefix blocks live readiness.

The allowlist value itself is not returned by API, health, dashboard, audit, or tests.

## Preparing a Test Secret

Prepare the Vault test secret outside Aichestra using your normal non-production operator process. Aichestra does not create, write, delete, rotate, migrate, or clean up this secret.

The test key should be clearly marked as test-only, for example containing `test`, `dummy`, `mock`, `sample`, `sandbox`, `nonprod`, or `ci`. Avoid production credential key names unless they are explicitly test-marked.

## Safe Live Validation

Default validation remains:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Those commands must not call Vault. After explicit operator approval and after `/readiness/secrets/vault/live-readiness` reports `ready_for_manual_live_test`, run only the targeted Vault live skeleton, for example:

```bash
pnpm test tests/vault-secret-backend-v1.test.ts
```

Do not print env values, tokens, paths, keys, or secret values before, during, or after the run.

## No-write / No-delete / No-rotate / No-list Policy

The live enablement path permits only:

- gate validation;
- SecretRef metadata validation;
- test path allowlist validation;
- one gated KV v2 read status check in the existing skipped live skeleton;
- status/metadata and audit redaction assertions.

It forbids:

- write;
- delete;
- rotate;
- broad list;
- migration;
- cleanup;
- secret value output;
- env value output;
- credential cache reads.

## Expected Skip Behavior

Default runtime and tests skip live validation. Missing gates are not default-suite failures. Unsafe gates are blockers and must be corrected before any manual live test.

## Troubleshooting

- `skipped`: configure only the missing gate names shown by readiness.
- `ready_if_configured`: live validation was requested but one or more required gates are still missing.
- `blocked_unsafe`: remove unsafe gates, production-looking paths, unsafe prefixes, write/delete/rotate/broad-list flags, or credential cache references.
- `ready_for_manual_live_test`: all gates are configured and safety checks pass, but the live test still requires explicit operator intent.

## Audit and Redaction Behavior

Public output may include gate counts, gate names, booleans, statuses, and unsafe warning identifiers. It must not include Vault token values, address values, namespace values, path values, key values, secret values, env values, credential cache paths, or raw Vault errors.

## Known Limitations

- Live validation still depends on an operator-managed non-production Vault instance and a pre-created test-only KV v2 secret.
- Token auth is the only concrete v1 live auth method.
- Production Vault rollout, production Auth/RBAC, policy bundle runtime, backend audit-device ownership, rotation, incident response, and env fallback enforcement remain future work.

## Recommended Next Task

Recommended next task: Vault Production Rollout Planning v1, or Env Fallback Production Block v1.
