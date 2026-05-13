# Policy Bundle Schema Plan v0

Status: planning only
Runtime impact: none

v0 defines a future schema shape only. It does not implement parsing, execution, signing, hot reload, remote loading, OPA, or Cedar.

## Bundle Metadata

Required future fields:

- `bundleId`
- `name`
- `version`
- `compatibilityVersion`
- `bundleKind`
- `targetDomains`
- `ownerTeam`
- `createdAt`
- `reviewStatus`
- `approvedBy`
- `signature`
- `rollout`
- `rollback`
- `tests`

## Rule Shape

Each rule should include:

- `ruleId`
- `domain`
- `action`
- `resourceKind`
- `effect`: `allow` or `deny`
- `conditions`
- `requiredInputs`
- `requiredDataSources`
- `audit`
- `redaction`
- `testCases`

The schema must stay declarative. It must not include JavaScript, Rego, Cedar text execution, shell commands, WASM, remote imports, `eval`, or `Function`.

## Example: Git Remote Operation Policy

```yaml
bundleId: git-remote-operations
version: 0.1.0
compatibilityVersion: policy-bundle-v0
targetDomains: [git]
rules:
  - ruleId: git.branch.create.allowed-prefix
    domain: git
    action: git.branch.create
    resourceKind: repository
    effect: allow
    conditions:
      remoteGitEnabled: true
      repoInAllowlist: true
      branchPrefixAllowed: true
      operationGateEnabled: true
    requiredInputs: [actorId, repoId, branchName, allowedRepos, allowedBranchPrefix]
    audit:
      category: policy
      eventType: policy_bundle_git_branch_create_decision_future
```

## Example: LLM Remote Completion Policy

```yaml
bundleId: llm-remote-completion
version: 0.1.0
targetDomains: [llm]
rules:
  - ruleId: llm.remote-completion.requires-budget-and-allowlist
    domain: llm
    action: llm.remote_completion
    resourceKind: llm_provider
    effect: allow
    conditions:
      remoteLlmEnabled: true
      completionGateEnabled: true
      providerAllowed: true
      modelAllowed: true
      budgetDecision: allow
      credentialResolutionDecision: allow
    requiredInputs: [actorId, providerId, modelId, virtualKeyId, budgetDecision, taskId, taskRunId]
    redaction:
      promptContent: redacted
      providerToken: never_store
```

## Example: MCP Tool Invocation Policy

```yaml
bundleId: mcp-tool-invocation
version: 0.1.0
targetDomains: [mcp]
rules:
  - ruleId: mcp.tool.low-risk-readonly-only
    domain: mcp
    action: mcp.tool.invoke
    resourceKind: mcp_tool
    effect: allow
    conditions:
      gatewayKind: mock
      toolRiskLevelIn: [low]
      realTransportEnabled: false
      secretForwardingEnabled: false
    requiredInputs: [actorId, serverId, toolId, toolRiskLevel, redactionClass]
```

## Example: SecretRef Credential Resolution Policy

```yaml
bundleId: secretref-credential-resolution
version: 0.1.0
targetDomains: [secretref]
rules:
  - ruleId: secretref.resolve.requires-purpose-and-scope
    domain: secretref
    action: provider.credential.resolve
    resourceKind: secret_ref
    effect: allow
    conditions:
      secretRefStatus: active
      purposeAllowed: true
      policySubjectAllowed: true
      leaseValid: true
    requiredInputs: [actorId, secretRefId, secretKind, purpose, providerId, scope]
    redaction:
      secretValue: never_store
      envValue: never_return
```

## Example: Local Agent Invocation Policy

```yaml
bundleId: local-agent-invocation
version: 0.1.0
targetDomains: [local_agent]
rules:
  - ruleId: local-agent.invoke.requires-consent
    domain: local_agent
    action: local_agent.invoke
    resourceKind: local_agent
    effect: allow
    conditions:
      mockOrFixtureTransport: true
      consentRecorded: true
      credentialCacheAccess: denied
      vendorCliExecution: disabled
      ptyAccess: denied
    requiredInputs: [actorId, agentId, hostId, consentId, requestedCapabilities]
```

## Compatibility Requirements

- Unknown fields fail validation in future strict mode.
- Unknown actions deny by default.
- Missing inputs deny by default.
- Bundle tests must run before approval.
- Runtime activation remains future work.
