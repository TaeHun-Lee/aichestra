# Staging CI/CD Job Matrix v0

Status: v0_implemented
Scope: planning only

## Required Baseline Jobs

| Job | Command | Required env vars | Allowed profiles | Forbidden profiles | External calls | Secrets required | Artifacts | Cleanup | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| install | `pnpm install` | none | local, pull_request, integration, staging | none | no provider calls | no | redacted install summary | none | fail profile when dependency metadata changed and install fails |
| lint | `pnpm lint` | none | all | none | no | no | lint summary | none | fail profile |
| typecheck | `pnpm typecheck` | none | all | none | no | no | typecheck summary | none | fail profile |
| test | `pnpm test` | none | all | none | no default remote calls | no | test summary | temp workspace cleanup only | fail profile |
| build | `pnpm build` | none | all | none | no | no | build summary | none | fail profile |
| diff check | `git diff --check` | none | all | none | no | no | diff-check summary | none | fail profile |

## Safety Jobs

| Job | Command | Required env vars | Allowed profiles | External calls | Secrets required | Artifacts | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| safe integration scan | `rg -n '<safe integration pattern>' .` | none | pull_request, integration, staging | no | no | classified findings | fail on suspicious/default unsafe findings |
| secret exposure scan | `rg -n '<secret exposure pattern>' .` | none | pull_request, integration, staging | no | no | redacted scan summary | fail on unredacted secret exposure |
| docs path consistency | `rg -n 'older flat docs paths|TODO production-ready claim' docs` | none | pull_request, staging | no | no | docs findings | fail or require review |
| no production-ready overclaim | `rg -n 'production-ready|production ready' docs README.md AGENTS.md` | none | pull_request, staging | no | no | claim review | fail on unqualified production-ready claims |
| Node/Volta check | `node --version` | none | all | no | no | runtime version summary | warn/fail on non-Node 24 based on profile |
| dependency lockfile check | `git diff -- pnpm-lock.yaml package.json` | none | pull_request, staging | no | no | dependency diff summary | require review when changed |
| dashboard no-secret smoke | `pnpm test -- tests/dashboard-read-model-v0.test.ts` | none | staging | no | no | redacted dashboard smoke summary | fail on secret/env exposure |
| health no-secret smoke | `pnpm test -- tests/api-health.test.ts` | none | staging | no | no | redacted health smoke summary | fail on secret/env exposure |

## Optional Profiles

| Job | Command | Required env vars | Allowed profiles | Forbidden profiles | External calls | Secrets required | Artifacts | Cleanup | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| optional Postgres contracts | `pnpm test -- tests/repository-contracts.test.ts` | `AICHESTRA_TEST_DATABASE_URL` | integration, staging | local, pull_request, release_candidate | no external provider calls | yes, DB URL | redacted DB summary | test DB cleanup required | fail configured profile only |
| optional remote Git | `pnpm test -- tests/real-git-adapter-v2.test.ts` | Real Git gates and allowlists | integration, staging | local, pull_request, release_candidate | yes, gated | yes | redacted Git summary | branch/PR cleanup policy required | fail configured profile only |
| optional GitHub App | `pnpm test -- tests/github-app-controlled-v1.test.ts` | GitHub App gates and allowlists | integration, staging | local, pull_request, release_candidate | future gated | yes | redacted GitHub App summary | cleanup policy required | fail configured profile only |
| optional webhook | `pnpm test -- tests/real-git-adapter-v2.test.ts` | webhook gates and SecretRef | integration, staging | local, pull_request, release_candidate | no public endpoint by default | yes | redacted webhook summary | none for fixture tests | fail configured profile only |
| optional remote LLM | `pnpm test -- tests/llm-gateway-integration-test-profile-v1.test.ts tests/llm-gateway-v2.test.ts` | LLM integration-test profile v1 gates, model allowlist/default model, budget cap, safe prompt class, SecretRef-preferred credential gate | integration, staging | local, pull_request, release_candidate | yes, gated | yes | redacted LLM integration summary | none | skip unless fully gated; fail unsafe configured profile |
| optional remote MCP | future remote MCP test profile | future MCP gates | none in v0 | all | no in v0 | future | none | future | blocked |
| optional external auth | future external auth test profile | future IdP gates | none in v0 | all | no in v0 | future | none | future | blocked |
| optional vendor CLI | future Local Agent/vendor CLI profile | future Local Agent gates | none in v0 | all | no in v0 | no cache reads | none | future | blocked |

## Notes

- Default CI must not call external providers.
- Optional integration tests must be skipped unless every explicit gate is configured.
- No job deploys infrastructure or production traffic.
- No job may print secrets, DB URLs, private keys, webhook secrets, raw prompts, raw provider outputs, raw webhook payloads, or credential-cache paths.
