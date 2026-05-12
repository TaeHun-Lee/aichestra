# Secrets and Sandbox Design v0 Plan

## Current policy-as-code status

Policy-as-code v0 is implemented in `packages/policy` with a static, deterministic `PolicyService`, deny-by-default rules for remote Git, remote LLM, MCP, credential cache reads/uploads, provider credential resolution, PTY invocation, local CLI shell/file/network access, runner command execution, and auto-improvement apply. Policy decisions are auditable through the in-memory policy audit repository.

## Current enterprise provider abstraction status

Enterprise LLM Provider Abstraction v0 is implemented in `packages/llm-gateway` with provider-neutral `ProviderKind`, `ProviderAuth`, provider catalog entries, credential manager and token resolver skeletons, provider adapter skeletons, Local Agent boundary models, parser utilities, redaction utilities, provider audit events, and disabled local CLI templates. It does not call provider APIs, execute vendor CLIs, read credential caches, or resolve real secrets.

## Current runner safety status

Local Agent Runner v1 keeps `MockAgentRunner` as the default, keeps `LocalAgentRunner` disabled by default, and gates fixture command execution through runner config, harness policy, command validation, workspace validation, and policy checks. It does not execute arbitrary shell strings, remote Git operations, vendor CLIs, or real provider calls.

## Current secret handling limitations

The repository has policy and provider credential placeholders, but no first-class `SecretRef`, `SecretScope`, `SecretLease`, secret access decision, secret manager interface, lease audit trail, or API/dashboard visibility for secret metadata. Existing provider auth models intentionally avoid raw token storage, but there is no central secret lease model yet.

## Current sandbox limitations

The runner has a fixture workspace boundary, but there is no central sandbox profile model, sandbox session model, network egress policy, or redaction policy that can be shared by runner, provider, and future Local Agent integration. Container, Firecracker, Kubernetes, and production sandboxing are intentionally absent.

## Why this task is needed before real provider integrations

Real provider integrations need explicit boundaries for secret metadata, lease approval, network egress, sandbox capability, output redaction, and audit before credentials, cloud APIs, local CLI providers, or user-machine agents can be safely introduced. This task creates those boundaries while preserving the mock-first runtime.

## What this task implements

- Provider-neutral secret models and an in-memory mock `SecretManager`.
- Provider-neutral sandbox models and in-memory sandbox/session repositories.
- Network egress and redaction policy models.
- Deny-by-default policy actions/resources for secret leases, sandbox usage, network egress, runner secret injection, Local Agent secret forwarding, and secret audit access.
- Security audit events for secret, sandbox, network, and redaction decisions.
- DTO-based security API endpoints and dashboard visibility.
- Runner integration that records sandbox decisions without enabling secrets, network, remote Git, or production sandboxing.
- Provider-facing documentation and policy hooks that keep provider credential resolution blocked.
- Deterministic tests for models, services, policy integration, API, health, dashboard, and regression safety.

## What remains out of scope

- Real Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, or environment secret backends.
- Production secret injection into runner or provider processes.
- Reading vendor credential caches or local auth files.
- Real OAuth, workload identity, IAM, BYOK, or token exchange.
- Real container, VM, Firecracker, Kubernetes, Docker, seccomp, or network sandbox runtime.
- Real Local Agent daemon/protocol and vendor CLI execution.
- Any real provider, hosted Git, MCP, artifact registry, or deployment integration.

## Future integration plan

Future work should implement real secret backends behind `SecretManager`, real sandbox runtimes behind `SandboxProfile.kind`, explicit user/admin approval for lease issuance, Local Agent consent and secure transport, policy-as-code backend integration such as OPA/Rego or Cedar, and integration tests that run only against explicitly configured local or cloud fixtures.
