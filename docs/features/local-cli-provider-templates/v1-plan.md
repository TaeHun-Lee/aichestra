# Local CLI Provider Templates v1 Plan

## Documentation path

`docs/README.md` organizes feature work under `docs/features/<feature-slug>/` with paired plan and implementation documents. This plan therefore lives at `docs/features/local-cli-provider-templates/v1-plan.md`.

## Current Enterprise Provider Abstraction behavior

- `packages/llm-gateway` owns Enterprise LLM Provider Abstraction v0.
- Provider catalog entries can describe `local_cli` providers, but all local CLI entries remain disabled by default.
- Provider invocation flows through provider service boundaries and policy checks.
- Direct local CLI execution is blocked by the local CLI adapter when a Local Agent protocol service is not present or when the configured Local Agent channel/consent/compatibility gates fail.
- Existing catalog metadata covers Claude Code, Codex CLI, and Gemini CLI as local CLI-adjacent providers, but the model is still template-light and does not expose a complete compatibility, parser, or security constraint matrix.

## Current Local CLI provider template behavior

- Existing local CLI configuration is metadata-only and deterministic.
- Existing template-like records include parser hints and safety fields, but they are shaped as adapter config rather than first-class provider templates.
- Existing config uses command labels as metadata only; the default runtime does not spawn vendor CLIs.
- Aider and custom enterprise local CLI template coverage is not yet first-class.

## Current Local Agent Protocol behavior

- Local Agent Protocol v1 is mock-first.
- It models registration, capabilities, consent, signed-channel metadata, fixture daemon behavior, compatibility entries, and audit records.
- The fixture daemon may return deterministic mock results.
- Real daemon transport, PTY automation, vendor CLI execution, credential cache reads, secret forwarding, and production service credentials are unsupported.

## Current Local Agent Runner behavior

- Local Agent Runner v1 remains disabled-by-default for command execution.
- `MockAgentRunner` is the default path.
- Any controlled command behavior is confined to fixture/temp workspaces behind explicit runner, sandbox, and policy gates.
- It must not be used to execute Claude Code, Codex CLI, Gemini CLI, Aider, Cursor, Continue, or any other vendor CLI.

## Current SecretRef and credential-cache restrictions

- SecretRef-backed credential access is behind explicit Auth/RBAC and policy checks.
- Vault-backed credential resolution is gated and non-default.
- Credential cache reads are forbidden for local CLI provider templates.
- Templates must not read `~/.codex/auth.json`, Claude credentials, Google credential caches, vendor config files containing credentials, API key env values, or token caches.
- Templates must not forward secrets into CLI process metadata or invocation requests.

## Proposed provider templates

Local CLI Provider Templates v1 will add first-class metadata-only templates for:

| Template | Provider id | Vendor | Status |
| --- | --- | --- | --- |
| Claude Code | `claude-code-local` | `claude_code` | `template_only` |
| OpenAI Codex CLI | `codex-cli-local` | `openai_codex` | `template_only` |
| Gemini CLI | `gemini-cli-local` | `gemini_cli` | `template_only` |
| Aider | `aider-local` | `aider` | `template_only` |
| Custom local CLI provider | `custom-local-cli` | `custom` | `template_only` |

Each template will model:

- supported input modes
- supported output modes
- required Local Agent capabilities
- forbidden capabilities
- credential policy
- sandbox policy
- parser profile
- compatibility status
- safe metadata

## Compatibility matrix

Compatibility rules will be deterministic, read-only metadata. They will distinguish:

- `supported_mock`: safe metadata or fixture-only behavior
- `unsupported`: intentionally unavailable behavior
- `future`: future integration area
- `blocked`: explicitly denied behavior

Rules will cover at least:

- Local Agent required
- direct execution forbidden
- PTY unsupported
- credential cache read blocked
- secret forwarding blocked
- network disabled by default
- remote Git blocked
- shell escape blocked
- parser profile required

## Parser and normalizer strategy

Parser profiles will describe expected output and normalizer behavior without parsing live vendor output:

- expected output shape
- patch detection strategy
- diff summary strategy
- error detection strategy
- redaction rules
- maximum output preview bytes

The implementation will not stream from real vendor processes, parse PTY output, read vendor logs, or normalize credential-bearing config files.

## Policy and sandbox requirements

Policy metadata will preserve the existing deny-first posture:

- `local_cli.template.read` can be allowed for safe read surfaces.
- `local_cli.invoke` remains blocked unless a mock/local-agent fixture path explicitly permits the boundary.
- `local_cli.execute` is denied.
- `local_cli.credential_cache.read` is denied.
- `local_cli.secret.forward` is denied.
- `local_agent.invoke` remains subject to Local Agent protocol, consent, and policy requirements.
- `provider.invoke` remains subject to provider, policy, budget, and Auth/RBAC gates.

Sandbox metadata must state:

- no direct execution
- no PTY
- no credential cache reads
- no secret forwarding
- no shell escape
- no network by default
- no remote Git
- output redaction required

## What this task implements

- First-class Local CLI Provider Template models.
- Deterministic template catalog for Claude Code, Codex CLI, Gemini CLI, Aider, and custom local CLI providers.
- Compatibility rules, parser profiles, and security constraints.
- Safe integration into Enterprise Provider catalog/readiness/dashboard surfaces.
- Safe integration into Local Agent Protocol compatibility metadata.
- Read-only API endpoints for templates, compatibility, security constraints, and readiness.
- Documentation updates and deterministic tests.
- `phase-progress-checklist.html` progress update after self-analysis.

## What remains out of scope

- Real Claude Code, Codex CLI, Gemini CLI, Aider, Cursor, Continue, or vendor CLI execution.
- Real local CLI command spawning.
- PTY automation.
- Real Local Agent daemon implementation.
- Credential cache reads or validation.
- Secret forwarding.
- OAuth, device-code, WIF, IAM, BYOK, or production service-account credential flow.
- External LLM provider calls.
- Remote Git operations.
- Production-ready local CLI integration.
- Integration-test profile execution against real vendor CLIs.
