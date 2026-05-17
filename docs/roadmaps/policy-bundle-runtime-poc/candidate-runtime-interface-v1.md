# Candidate Policy Runtime Interface v1

Status: planning only
Runtime impact: none

This document defines future interface expectations for a candidate policy runtime. It does not add an implementation, does not execute candidate policy code, and does not replace `StaticPolicyEngine`.

## Future Interface

```ts
type CandidatePolicyRuntime = {
  getRuntimeKind(): CandidatePolicyRuntimeKind;
  getPolicyBundleVersion(): string;
  evaluate(policyInput: CandidatePolicyInput): Promise<CandidatePolicyDecision>;
  validateBundle(bundle: CandidatePolicyBundle): Promise<CandidateBundleValidationResult>;
  listSupportedDomains(): PolicyDomainName[];
  close(): Promise<void>;
};
```

`CandidatePolicyRuntimeKind` may include:

- `signed_json_yaml_bundle`
- `opa_rego`
- `cedar`
- `custom_future`

## Evaluation Input

Future `policyInput` must be a sanitized, provider-neutral policy input derived from the same context passed to `StaticPolicyEngine`.

Required input classes:

- action
- resource kind and resource id
- sanitized subject and actor metadata
- request id and correlation id
- domain-specific metadata
- tenant/team/project/repo/provider/model/SecretRef/MCP/registry/local-agent/audit-query scope metadata when available
- environment gate booleans and counts only, never env values

Candidate runtimes must never receive raw secrets, tokens, private keys, webhook secrets, raw env values, credential cache contents, raw prompts, raw provider responses, or unredacted logs.

## Evaluation Output

Expected output shape:

- `decision`: allow, deny, require approval, block, or not applicable
- `reason`
- `ruleId`
- `obligations`
- `redactionRequirements`
- `auditMetadata`
- `runtimeMetadata`

Output must be normalized before comparison with the static decision. Candidate output must be record-only until a future approved enforcement milestone.

## Bundle Validation

`validateBundle(bundle)` is future-only. It may eventually validate schema version, target domains, required inputs, required outputs, test coverage, signing metadata, review metadata, and compatibility with golden cases.

v1 does not parse, load, verify, or execute bundles.

## Close Semantics

`close()` must release local resources only. It must not upload logs, flush secrets, call remote policy services, or mutate active runtime configuration.

## Safety Rules

- `StaticPolicyEngine` remains source of truth.
- Candidate runtime must start in shadow mode.
- Candidate runtime output must never affect enforcement in shadow mode.
- Candidate runtime must not call external services by default.
- Candidate runtime must not execute dynamic policy code until a separate reviewed task explicitly implements and gates that behavior.
- Candidate runtime must preserve existing Auth/RBAC, Policy, SecretRef, Git, LLM, MCP, Runner, Local Agent, Registry, Governance, Dashboard, Observability, Tenant Scope, and Secrets/Sandbox gates.
