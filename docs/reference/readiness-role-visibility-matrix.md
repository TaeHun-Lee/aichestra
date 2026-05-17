# Readiness Role Visibility Matrix

Status:

- Dashboard/Readiness Tenant Scope Planning: `v1_implemented`
- Dashboard/Readiness Tenant Scope Implementation: `v1_implemented`

This matrix defines target visibility for future readiness endpoint filtering. It is not active production enforcement.

Implementation v1 exposes these rows as readiness role visibility hints inside `ScopedReadModelMetadata`; they are display metadata only and do not filter endpoint responses.

| Readiness Endpoint Group | Allowed Roles | Required Scopes | Redaction Behavior | Production Enforcement Requirement | Staging Behavior | Future Implementation Phase |
|---|---|---|---|---|---|---|
| `/readiness/deployment/*` | release_manager, platform_admin, security_admin | tenant, team, project, repo, provider, secret, audit query | hide secret-adjacent checks from lower roles | tenant/project filtering and role redaction required | metadata allowed with production blocker | phase 4 endpoint guards |
| `/readiness/database/*` | platform_admin, security_admin, audit_reader | tenant, team, project, audit query | hide schema detail and never expose DB URLs | tenant/project/audit scope required | local migration metadata allowed | phase 4 endpoint guards, phase 5 query filters |
| `/readiness/secrets/*` | security_admin, platform_admin | tenant, team, project, secret, audit query | never expose secret values, env values, credential values, or cache paths | secret scope and security/platform role required | planning metadata allowed with warning | phase 4 endpoint guards |
| `/readiness/secrets/vault/*` | security_admin, platform_admin | tenant, team, project, secret, audit query | never expose Vault token, secret value, sensitive path/key, or env value | Vault/SecretRef scope required | gated metadata allowed; no live call | phase 4 endpoint guards |
| `/readiness/auth/*` | security_admin, platform_admin, audit_reader | tenant, team, project, audit query | no session, token, cookie, password, JWT, or raw assertion | production auth scope required | mock-auth planning visible with warning | phase 4 endpoint guards |
| `/readiness/auth-providers/*` | security_admin, platform_admin, audit_reader | tenant, team, project, audit query | no token, cookie, session id, Authorization header, raw claim, client secret, provider credential, or env value | production auth provider admin scope required before real provider hardening | disabled provider skeleton metadata visible with warning | phase 4 endpoint guards |
| `/readiness/policy-bundles/*` | security_admin, platform_admin, audit_reader | tenant, team, project, audit query | no dynamic policy code or remote bundle content | policy scope required | planning metadata visible | phase 4 endpoint guards |
| `/readiness/policy-shadow/*` | security_admin, platform_admin, audit_reader | tenant, team, project, provider, model, secret, mcp server/tool, registry package, audit query | no candidate runtime output, dynamic policy code, external policy service content, secrets, or env values | policy and audit scope required before live shadow reports | planning metadata visible | phase 4 endpoint guards |
| `/readiness/github-app/*` | security_admin, platform_admin, release_manager | tenant, team, project, repo, secret, audit query | no app private key, token, webhook secret, or env value | repo and secret scope required | planning metadata visible; live behavior disabled | phase 4 endpoint guards |
| `/readiness/github-app-integration/*` | security_admin, platform_admin, release_manager | tenant, team, project, repo, secret, audit query | no token/private key/webhook secret/env value | repo and test-only secret scope required | skipped-by-default profile visible | phase 4 endpoint guards |
| `/readiness/llm-integration/*` | security_admin, platform_admin, release_manager | tenant, team, project, provider, model, secret, audit query | no API key, raw prompt, raw response, or env value | provider/model/secret scopes and budget policy required | skipped-by-default profile visible | phase 4 endpoint guards |
| `/readiness/vault-integration/*` | security_admin, platform_admin, release_manager | tenant, team, project, secret, audit query | no Vault token, secret value, sensitive path/key, or env value | allowlisted test-only secret scope required | skipped-by-default profile visible | phase 4 endpoint guards |
| `/readiness/staging/*` | release_manager, platform_admin, security_admin | tenant, team, project, repo, provider, audit query | hide blocked optional integration detail from lower roles | project/repo release scope required | required before shared staging | phase 3 dashboard filters, phase 4 endpoint guards |
| `/readiness/staging-dry-run/*` | release_manager, platform_admin, security_admin | tenant, team, project, repo, audit query | redact evidence details if secret-adjacent | project/repo release scope required | required before shared staging | phase 3 dashboard filters, phase 4 endpoint guards |
| `/readiness/staging-rc/*` | release_manager, reviewer, platform_admin | tenant, team, project, repo, audit query | hide signoff evidence details outside role scope | release target/evidence scope required | required before shared staging | phase 3 dashboard filters, phase 4 endpoint guards |
| `/readiness/staging-execution/*` | release_manager, reviewer, platform_admin, security_admin | tenant, team, project, repo, audit query | redact execution evidence where secret-adjacent | execution target/evidence/governance scopes required | required before shared staging | phase 3 dashboard filters, phase 4 endpoint guards |
| `/readiness/ci-cd/*` | release_manager, platform_admin | tenant, team, project, repo, audit query | no secrets; redact artifact internals for lower roles | project/repo CI scope required | required before shared staging | phase 3 dashboard filters, phase 4 endpoint guards |
| `/readiness/scopes/*` | viewer, developer, security_admin, platform_admin, audit_reader | tenant, team, project, repo, provider, model, secret, mcp server/tool, registry package, local agent host, audit query | hide secret-adjacent scope detail from lower roles | tenant-filtered scope catalog required | mock catalog allowed with warning | phase 2 request scopes, phase 4 endpoint guards |
| `/readiness/secret-backend-decision/*` | security_admin, platform_admin | tenant, team, project, secret, audit query | no backend credentials, secret values, or env values | secret/backend admin scope required | planning metadata allowed | phase 4 endpoint guards |
| `/readiness/tenant-scope/*` | platform_admin, security_admin, audit_reader | tenant, team, project, audit query | planning-only; no secret material | use to drive future filters; production details require tenant scope | visible in local/staging planning with warning | phase 1 planning inventory |

## Special Rules

- `/readiness/secrets/*` must not expose secret values.
- `/readiness/secrets/vault/*` must not expose Vault token/path/key values when those identifiers are sensitive.
- `/readiness/auth/*` must not expose session, token, cookie, password, JWT, client secret, or raw identity assertion data.
- `/readiness/auth-providers/*` must not call IdPs, validate tokens, parse cookies, issue sessions or credentials, or expose Authorization headers, env values, client secrets, or raw claims.
- Audit and observability readiness surfaces must be scoped before production.
- `/readiness/scopes/*` may show the mock scope catalog in local/staging planning, but must be tenant-filtered before production.
