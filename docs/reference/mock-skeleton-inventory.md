# Mock / Skeleton Inventory

A maturity classification of every non-production slice in the scaffold, grouped by how far it is from real execution. Derived from code markers (`productionReady: false` ×94, `applyAllowed: false` ×26, ~24 `Mock*` classes, 9 disabled/future auth provider classes, 148 `AICHESTRA_*` env gates, 67 `/readiness` + `/dashboard` surfaces) cross-referenced with [feature-status.md](./feature-status.md) and [mvp-scope.md](./mvp-scope.md).

Tiers, highest maturity first:

- **Tier A — Real integration, disabled by default.** Real code paths exist; flipped on only when every explicit env gate is configured.
- **Tier B — Mock-first functional.** Deterministic mock implementations that fully drive the runtime/tests; no real external calls, ever, in this tier.
- **Tier C — Metadata-only / review-only.** Records decisions, leases, plans, and readiness; never executes (`applyAllowed=false`, no source/Git mutation).
- **Tier D — Planning / readiness-only skeleton.** Readiness models, disabled provider classes, dashboards, and docs only; no implementation behind the surface.

---

## Tier A — Real integration, disabled by default

| Slice | Default | Gate(s) (excerpt) |
| --- | --- | --- |
| Real Git Adapter v2 (GitHub branch/PR/changed-files) | mock | `AICHESTRA_GIT_PROVIDER`, `AICHESTRA_ENABLE_REMOTE_GIT`, `AICHESTRA_ALLOW_REMOTE_BRANCH_CREATE`, repo allowlist, branch prefix |
| GitHub App Controlled Implementation v1 | mock token provider | `AICHESTRA_ENABLE_GITHUB_APP`, App ID/slug, private-key SecretRef |
| GitHub webhook receiver | disabled | `AICHESTRA_ENABLE_GITHUB_WEBHOOKS`, webhook secret SecretRef |
| LLM Gateway v2 (OpenAI-compatible HTTP path) | mock provider | `AICHESTRA_LLM_PROVIDER=openai_compatible`, `AICHESTRA_ENABLE_REMOTE_LLM`, routing/budget/credential gates |
| Env Secret Provider (SecretRef credentials v1) | off | `AICHESTRA_ENABLE_ENV_SECRET_PROVIDER`, `AICHESTRA_ALLOWED_SECRET_ENV_KEYS` |
| Vault-backed Secret Backend v1 | disabled/mock client | `AICHESTRA_ENABLE_VAULT_SECRET_PROVIDER`, Vault addr/auth/mount/path allowlist |
| Persistent Postgres storage | in-memory | `AICHESTRA_STORAGE_PROVIDER=postgres`, `AICHESTRA_DATABASE_URL` |
| Durable Collaboration Stores v1 | in-memory | same Postgres storage gates |

> Even when enabled, merge/rebase/push/force-push/branch-deletion remain unsupported, and only one OpenAI-compatible LLM path is allowed.

## Tier B — Mock-first functional

Deterministic, always-on mocks that the default runtime and the [first vertical slice](../../README.md#first-vertical-slice) depend on:

- `MockGitProvider`, `MockMergeSimulator`, `MockGitHubAppTokenProvider`, `MockGitHubWebhookVerifier`
- `MockLLMProvider`, `MockLlmGateway`, `MockModelRouter`, `MockUsageLedger`
- `MockAgentRunner`, `MockTestRunner`, `MockLocalAgentTransport`
- `MockMCPGateway`
- `MockAuthProvider`, `MockTokenResolver`, `MockOidcTokenVerifier`
- `MockPolicyEngine`, `MockPolicyShadowEvaluator`, `MockRegistryMutationAuthorizer`
- `MockSecretManager`, `MockSecretsBroker`, `MockVaultClient`
- `MockAutoImprovementEngine`, `MockObservabilityExporter`
- Registry resolver + semver/diff/checksum logic, instruction assembly

## Tier C — Metadata-only / review-only (`applyAllowed=false`, no execution)

These produce decisions/records but never mutate Git, source files, or remote state:

- Merge Queue Policy v2 (readiness/holds/ranking; no merge execution)
- Real Merge Execution Policy v1 (preconditions/forbidden-ops; execute/override denied)
- Conflict Resolution Assistant v1 (review-only summaries/plans; no patch apply, no LLM call by default)
- PR Ownership / Handoff Model v1 (local owner/reviewer/handoff metadata; no remote PR update, no auto-merge)
- Branch Orchestrator v2 (safe `aichestra/` branch naming/ownership/collision/drift; no real branch ops)
- Multi-session Agent Run Coordination v1, Cross-session File Lease / Edit Intent Graph v1 (overlap metadata; no file locks, no source mutation)
- Agent Workspace Lifecycle v2, Worktree Allocation v1 (lease/cleanup/allocation metadata; no `git worktree`)
- Branch Cleanup / Orphan Lease Recovery v1 (review-only recommendations; destructive cleanup denied)
- Tenant Scope Enforcement v1, Audit Query Scope Enforcement v1 (partial decision/redaction metadata; no row-level security)
- Registry Signed Package / Artifact Trust v1, Eval Suite Execution Harness v1 (digest/signature/eval metadata; no real signing/verification/external eval)
- External Observability Export v1 (export envelopes/safety checks; no external send)

## Tier D — Planning / readiness-only skeleton

Readiness models, disabled provider classes, `/readiness/*` + `/dashboard/*` surfaces, and design docs only:

- **Auth/RBAC:** Production Auth/RBAC Planning v0, Production Auth/RBAC v1 Planning, Auth Provider Skeleton v1 (`DisabledOidc/Saml/Scim/Okta/MicrosoftEntra/GoogleWorkspace/GithubEnterprise/Custom/Production` provider classes; OIDC Provider Skeleton Hardening v1 — fail-closed, readiness-only)
- **Policy runtime:** Policy Bundle / OPA-Cedar Planning v0, Policy Bundle Runtime PoC Planning v0, Policy Runtime PoC Golden Test Harness v1, Policy Runtime Shadow Evaluation Planning v1 + Shadow Evaluator Skeleton v1 (no candidate runtime, no OPA/Cedar)
- **Secrets/DB:** Production Secret Backend Implementation Option Decision v0, Secret Backend Migration Planning v0, Persistent DB Production Operations v1, Vault Live Integration Enablement v1
- **Tenant scope:** Tenant/Repo/Provider Scope Model v1, Dashboard/Readiness Tenant Scope Planning v1
- **GitHub:** GitHub App / Production Webhook Hardening Planning v0
- **Staging/CI-CD:** Staging Deployment Profile v0, Dry-run Profile v0, Release Candidate Checklist v0, Deployment Execution Plan v0 + Human Signoff Pack v0, CI/CD Pipeline Planning v0
- **Integration-test profiles (skipped by default):** GitHub App, LLM Gateway, Vault, Merge Queue Live
- **LLM/agents:** Enterprise LLM Provider Abstraction v0, Local CLI Provider Templates v1, Local Agent Protocol v1 (mock channels/fixture daemon — no real daemon/transport/CLI execution)

---

## Suggested next consolidation

The scaffold is broad (Tier C/D dominate). Before adding more skeletons, the highest-leverage moves are to **promote one vertical end-to-end**:

1. Pick one Tier-A path (Real Git Adapter v2 against a throwaway repo, or the OpenAI-compatible LLM path) and exercise it through its existing live integration-test profile.
2. Promote the Tier-C merge/PR chain (Merge Queue Policy v2 → Real Merge Execution Policy v1) one step toward execution behind its dedicated integration-test profile.
3. Collapse overlapping planning docs (46 `*plan*.md`) once their implementing slice lands, so `feature-status.md` stays the single source of truth.
