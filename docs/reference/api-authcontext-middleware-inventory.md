# API AuthContext Middleware Inventory

Status: API AuthContext Middleware Skeleton `v1_implemented`; Service Account Actor Boundary `v1_implemented`; Registry/Governance RequestContext Migration `v1_implemented`; Production Auth Provider Skeleton `v1_implemented`.

This inventory tracks API ingress context coverage after v1. It is not a production auth readiness claim.

| Route Group | Middleware/Helper Applied | Source Mode | Auth Mode | RequestContext Passed To Services | Audit Correlation Added | Remaining Gap | Production Impact |
|---|---:|---|---|---:|---:|---|---|
| `/health` | yes | `api` | mock | n/a | auth audit only | safe summary omits ids to avoid noise; auth-provider skeleton exposes booleans/status only | production auth still disabled |
| `/auth/*` | yes | `api` | mock | partial | yes | `/auth/authorize/check` can still evaluate explicit target actors for compatibility; `/auth/config` includes safe provider kind/status metadata | no real auth/session/token validation |
| `/policy/*` | yes | `api` | mock | partial | yes for evaluations | read-only rule/audit endpoints do not require route permission matrix yet | deny-by-default unchanged |
| `/security/credentials/*` | yes | `api` | mock | yes for resolve checks | yes | create/status/list routes still have compatibility actor/status fields | no secret exposure added |
| `/security/secrets/*` | yes | `api` | mock | partial | yes for Vault/credential checks | leases/sandbox/redaction paths still partially actor-field based | Vault remains gated/non-default |
| `/git/*` | yes | `api`, webhook for `POST /git/github/webhooks` | mock | partial | yes | webhook receiver/sync and GitHub App token-handle internals now use explicit mock service accounts; production webhook replay remains future | remote Git gates unchanged |
| `/llm/*` | yes | `api` | mock | yes for route/completion | yes | route/model/admin mutation paths are not production-scoped | remote LLM gates unchanged |
| `/mcp/*` | yes | `api` | mock | yes for list/invoke/audit gates | yes | no tenant/server/tool grants | real MCP transport disabled |
| `/local-agents/*` | yes | `api` | mock | partial | partial | registration/channel/compatibility paths still accept explicit actor/user fields | no real daemon/transport |
| `/providers/*` | yes | `api` | mock | partial | partial | catalog/admin paths are mostly metadata-only; invoke path carries context metadata | provider calls remain blocked/mock |
| `/agents/*` | yes | `api` | mock | partial | partial | command execution path still relies on runner service fields | command gates unchanged |
| `/tasks/:id/run-agent` | yes | `api` | mock | partial | partial | worker/background path still needs service-account actor boundary | task run conflict behavior unchanged |
| `/dashboard/*` | yes | `dashboard` | mock | internal read model only | auth audit only | no tenant/team/dashboard filter scoping | read-only only |
| `/readiness/*` | yes | `readiness` | mock | read-only services only | auth audit only | no production viewer/tenant scoping; `/readiness/auth-providers/*` is disabled/readiness-only | planning/readiness only |
| `/observability/*` | yes | `api` | mock | read-only observability service | source events only | audit query access is not production role/tenant scoped | external export disabled |
| `/registry/*` | yes at ingress | `api` | mock | partial/yes for representative mutation, audit, queue, package, resolver paths | yes for migrated registry audit/revision/eval records | explicit actor compatibility remains; tenant/repo scoping future | registry gates unchanged |
| `/improvement/*` | yes at ingress | `api` | mock | partial/yes for representative proposal, draft-change, decision, eval, canary, apply-gate paths | yes for migrated governance audit records | proposal/read-model legacy actor fields remain; tenant/team scoping future | apply still blocked |
| legacy `/repos`, `/usage`, `/audit` | yes at ingress | `api` | mock | no | no/partial | legacy read/write scaffolding still direct store-based | mock scaffold only |

## Safe Header Handling

Accepted as safe metadata:

- `x-aichestra-request-id`;
- `x-aichestra-correlation-id`;
- `x-aichestra-actor-id` for mock/local actor override only;
- `x-github-delivery` as webhook delivery/correlation metadata.

Rejected or ignored as auth:

- Authorization headers;
- cookies;
- bearer tokens;
- JWTs;
- session ids;
- API keys;
- secret-like id header values.

Production Auth Provider Skeleton v1 can report selected provider kind and disabled future-provider status in request summaries, but it still treats Authorization headers and cookies as rejected/ignored auth input.

## Remaining Route Gaps

Highest-value follow-ups:

- finish replacing remaining registry/governance actor-id compatibility fields with production-scoped RequestContext-derived actor metadata;
- continue service-account migration for registry/governance, worker persistence, dashboard/readiness read service, and observability read service work;
- introduce route permission matrix skeleton without real production auth;
- add tenant/team/project/repo scoping before production dashboard/readiness/audit use;
- harden the future provider boundary with explicit token validators/session stores only after a separate reviewed task.

## Production Impact

The v1 middleware improves consistency and audit attribution but does not make API access production-authenticated. Production auth remains blocked until real provider/session boundaries, tenant scoping, durable auth repositories, service-account credential lifecycle, and dashboard/audit query scoping are separately implemented and reviewed.
