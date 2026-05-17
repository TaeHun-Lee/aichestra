# Policy Runtime PoC Input/Output Contract v0

Status: planning/readiness only
Runtime impact: none

This contract defines the normalized shape a future shadow evaluator should consume and emit. Policy Runtime Shadow Evaluation Planning v1 uses it as the planned static-vs-candidate comparison input shape. It does not implement parsing, schema validation, OPA/Rego execution, Cedar execution, JSON/YAML bundle execution, remote loading, hot reload, or enforcement.

Policy Runtime PoC Golden Test Harness v1 uses this contract where current `packages/policy` types support it. The harness stores normalized subject/resource/environment/context fixtures and compares current `StaticPolicyEngine` decisions, but it does not implement a new parser, runtime, bundle loader, or enforcement path.

## Future Normalized Input

### subject

- `actorId`
- `principalId`
- `actorKind`
- `serviceAccountId`
- `roles`
- `teams`
- `authMode`
- `isMockActor`

Rules:

- Service accounts are subject metadata, not a bypass.
- Missing production subject fields must deny in future enforcement.
- Mock actors are allowed only for local/readiness/test PoC fixtures.

### request

- `requestId`
- `correlationId`
- `source`
- `taskId`
- `taskRunId`

Rules:

- Request and correlation ids are required for auditability in shadow evaluation.
- Raw headers, cookies, tokens, sessions, and identity assertions are not policy input.

### resource

- `resourceKind`
- `resourceId`
- `tenantId`
- `teamId`
- `projectId`
- `repoId`
- `providerId`
- `modelId`
- `secretRefId`
- `mcpServerId`
- `mcpToolId`
- `registryPackageId`
- `localAgentHostId`

Rules:

- Missing tenant/resource scope must not grant access.
- Future tenant mismatch must deny once production tenant enforcement exists.

### action

- `action`

The action uses current provider-neutral policy action names where possible, such as `git.remote_operation`, `llm.remote_completion`, `mcp.tool.invoke`, `provider.credential.resolve`, `runner.command.execute`, `local_agent.invoke`, `registry.update`, and `improvement.apply`.

### environment

- integration gates
- deployment profile
- staging flags
- production flags

Examples include remote Git, remote LLM, fallback, webhook, GitHub App, Vault, MCP, runner command, and production/staging profile booleans. Env var values are never included.

### context

- risk level
- budget
- secret lease state
- audit correlation metadata

Context must be structured metadata only. Raw prompts, raw provider responses, raw webhook payloads, secret values, provider tokens, credential cache paths, and env values are not policy input.

## Future Output

- `decision`: `allow | deny | block | warn`
- `reason`
- `ruleId`
- `policyBundleId`
- `policyVersion`
- `obligations`
- `auditMetadata`
- `redactionRequirements`

Rules:

- `allow` never bypasses Auth/RBAC, SecretRef, provider, budget, harness, registry, governance, sandbox, redaction, or tenant gates.
- `deny` remains the safe default for unknown actions, missing inputs, tenant mismatch, unsafe integration gates, and policy errors.
- `block` is for critical safety failures requiring review.
- `warn` is for sanitized read-only metadata visibility, not for allowing unsafe behavior.

## Redaction Requirements

All future outputs must preserve:

- no raw secrets
- no env values
- no provider tokens
- no credential cache paths
- no raw webhook payloads
- no raw prompts or provider responses in policy audit
- bounded preview metadata only

## Status

This contract is represented as deterministic read-only metadata in `packages/deployment-readiness`, typed static golden fixtures for the v1 harness, and shadow planning metadata for future candidate comparisons. No runtime parser, bundle evaluator, shadow evaluator, candidate runtime, or production policy runtime exists.
