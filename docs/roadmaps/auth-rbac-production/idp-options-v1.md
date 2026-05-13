# Identity Provider Options v1

Production Auth/RBAC v1 planning is provider-neutral. This document compares future identity provider paths only. It does not implement login, logout, sessions, token validation, SSO, OIDC, SAML, SCIM, password auth, JWT issuance, or external IdP calls.

## Recommendation

The preferred production baseline is environment-dependent, but the default architecture should assume:

- OIDC or SAML for interactive SSO.
- SCIM or an equivalent directory sync for user, team, and deprovisioning lifecycle.
- Service accounts modeled as first-class Aichestra principals with scoped role bindings.
- SecretRef-backed IdP client credentials after real secret backend migration.

`MockAuthProvider` remains local/test only and is not production auth.

## Options

| Option | Strengths | Weaknesses | Operational requirements | Group/team mapping | SCIM support | Service account support | Audit support | Complexity | Production suitability | Risks |
|---|---|---|---|---|---|---|---|---|---|---|
| OIDC | Modern web SSO, standard claims, JWKS rotation, broad IdP support | Requires session/callback design and claim stability | issuer, client metadata, redirect URIs, JWKS cache, claim validation, SecretRef client credentials | groups/roles from claims or directory | not by itself | usually external to OIDC | sign-in and claim audit metadata | medium | recommended baseline when supported | claim drift, group overage, token/assertion exposure if mishandled |
| SAML | Common enterprise SSO, mature IdP support | XML assertion complexity, cert rotation, harder local testing | metadata exchange, assertion validation, signing cert lifecycle, ACS endpoint | attributes or group assertions | not by itself | no native service account model | sign-in and assertion validation metadata | high | recommended when enterprise requires SAML | assertion parsing bugs, cert rollover failure, raw assertion exposure |
| SCIM | Directory lifecycle, deprovisioning, team sync | Not an interactive auth protocol | sync endpoint, idempotency, deprovisioning, retry and audit | primary source for teams and role bindings | yes | can model service principals if IdP supports them | strong lifecycle audit | high | recommended with OIDC/SAML for enterprise | stale users if sync fails, broad group-to-role mapping |
| Microsoft Entra ID | Strong OIDC/SAML/SCIM support and conditional access signals | Tenant-specific configuration and group overage behavior | Entra app registration, claims/groups config, SCIM app, SecretRef credentials | groups, app roles, directory objects | yes | supported through enterprise app/service principal model | good via directory and app logs | medium | good fit for Microsoft-centric orgs | group claim overage, device trust interpretation, client secret handling |
| Okta | Strong OIDC/SAML/SCIM support, mature group mapping | Feature availability depends on plan | Okta app, group rules, SCIM provisioning, SecretRef credentials | groups and app assignments | yes | supported through app/service account patterns | good | medium | good general enterprise option | group/rule drift, SCIM deprovisioning gaps |
| Auth0 | Strong OIDC, flexible rules/actions | Enterprise directory lifecycle may need more design | tenant app, Actions, group/role claim strategy, optional SCIM | roles/organizations/groups depending setup | available in enterprise scenarios | supported by machine-to-machine apps | good | medium | viable managed identity option | custom rules can drift from policy matrix |
| Google Workspace | Useful identity source for Google-centric teams | Group and device trust behavior depends on Cloud Identity setup | OIDC/SAML app, group mapping, optional directory sync | Workspace/Cloud Identity groups | environment-dependent | supported through service accounts, but Aichestra must not read Google credential caches | good | medium | environment-dependent | accidental credential cache reliance, group mapping ambiguity |
| GitHub Enterprise identity mapping | Repo/org ownership signal, useful for GitHub App grants | Not sufficient as the only control-plane IdP | future GitHub App/org mapping, no default API calls in v1 | org/team mapping to repo scopes | possible via Enterprise features | not a full service account strategy | useful for repo-grant audit | high | future supplement, not baseline | conflating repo access with Aichestra authorization |
| Custom enterprise IdP | Can fit regulated environments | High implementation and audit burden | custom protocol adapter, security review, contract tests, SecretRef credentials | custom | custom | custom | custom | high | future only | bespoke protocol bugs and hard-to-audit behavior |
| MockAuthProvider | Deterministic tests and local demos | No SSO, no real assurance, no tenant boundary | none | seeded teams only | no | seeded mock service accounts only | local metadata only | low | local/test only | dangerous if accepted in production |

## Non-Negotiable Constraints

- No raw tokens, cookies, passwords, JWTs, SAML assertions, SCIM bearer tokens, or IdP client secrets in Auth/RBAC models, audit, health, dashboard, or readiness output.
- Production auth must not bypass Policy-as-code, SecretRef, sandbox, Git, LLM, MCP, Local Agent, Runner, Dashboard, Observability, or DB safety gates.
- Real provider adapters require explicit future implementation tasks and integration gates.
