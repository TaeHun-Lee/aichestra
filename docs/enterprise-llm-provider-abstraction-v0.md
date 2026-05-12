# Enterprise LLM Provider Abstraction v0

## What v0 Implements

Enterprise LLM Provider Abstraction v0 incorporates the closed enterprise provider design into Aichestra's mock-first architecture.

It adds provider catalog, auth, credential, token, adapter, Local Agent boundary, parser, redaction, audit, API, dashboard, policy, and schema skeletons. It does not make real provider calls.

## ProviderKind Model

`packages/llm-gateway/src/enterprise-providers.ts` defines:

- `cloud_api`
- `oauth_api`
- `workload_identity_api`
- `cloud_iam`
- `local_cli`
- `pty_interactive_fallback`

These are enterprise provider transport/auth classes, separate from the older LLM model provider kinds such as `mock` and `openai_compatible`.

## ProviderAuth Model

Supported auth union:

- `api_key`: env key or secret reference only; no raw key value.
- `oauth_user`: future OAuth user path.
- `device_code`: future device-code path.
- `workload_identity`: future WIF path.
- `cloud_iam`: future cloud IAM path.
- `external_cli_session`: local CLI session boundary with `credentialAccess = never_read_tokens`.

Validation rejects raw tokens, credential cache paths, local CLI auth other than `external_cli_session`, PTY default enablement, and shared user CLI sessions.

## ProviderCatalog

Seeded disabled/skeleton entries:

- `anthropic-api-key`
- `anthropic-wif`
- `claude-code-local`
- `openai-api-key`
- `codex-cli-local`
- `gemini-api-key`
- `gemini-cli-local`
- `vertex-gemini-cloud`
- `bedrock-anthropic-cloud`
- `azure-foundry-cloud`

Entries record vendor, kind, auth type, supported models, billing mode, capabilities, policy notes, metadata, and lifecycle status. No provider is enabled for real calls.

## CredentialManager

`StaticCredentialManager`:

- returns credential references only;
- returns no token for local CLI providers;
- records credential access audit;
- denies credential cache read attempts;
- keeps secret resolution as `secret_resolution_not_implemented`.

It never reads `~/.codex/auth.json`, `~/.claude`, Google ADC cache files, keychains, or vendor credential stores.

## TokenResolver

`MockTokenResolver`:

- returns empty headers/env for local CLI providers;
- returns not-implemented for real token headers, refresh, OAuth, WIF, and IAM exchange;
- returns no raw provider secrets.

## ProviderAdapter

Skeleton adapters:

- `CloudApiProviderAdapter`
- `OAuthApiProviderAdapter`
- `WorkloadIdentityProviderAdapter`
- `CloudIamProviderAdapter`
- `LocalCliProviderAdapter`
- `PtyInteractiveFallbackProviderAdapter`

Cloud/OAuth/WIF/IAM adapters return blocked results. Local CLI returns `local_agent_required` unless a future Local Agent exists. PTY returns `disabled_by_policy`.

## Local CLI Provider Contract

Local CLI templates are metadata only:

- Claude headless JSON
- Claude stream JSON
- Codex headless
- Codex JSONL
- Gemini JSON

Templates use argv arrays, not shell strings. They are not executed in v0.

Rules:

- Aichestra Cloud does not execute vendor CLIs directly.
- Aichestra must not read local vendor credential caches.
- Local CLI requires a future Aichestra Local Agent.
- Danger/full-access modes are denied by default.

## Aichestra Cloud vs Aichestra Local Agent

Local Agent Runner v1 is Aichestra's mock/local task runner.

Aichestra Local Agent is future user-machine infrastructure for brokering vendor local CLI providers. v0 only defines the protocol models:

- `LocalAgentDescriptor`
- `LocalAgentInvocationRequest`
- `LocalAgentInvocationResult`
- `LocalAgentConsentLevel`

No daemon, socket protocol, PTY automation, or vendor CLI execution is implemented.

## Parser Strategy

Provider parser utilities support:

- `raw`
- `json`
- `jsonl`
- `ndjson`

Malformed JSON returns deterministic parse errors. Stderr progress logs do not automatically mean failure. Exit code plus parser status determines success/failure.

## Redaction Strategy

`redactSecretText` masks:

- bearer tokens;
- API key-like strings;
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `AICHESTRA_LLM_API_KEY`, `LLM_API_KEY`, `GITHUB_TOKEN`, and Google credential env dumps;
- `~/.codex/auth.json`;
- `~/.claude`;
- Google ADC cache references.

Provider audit metadata also redacts secret, token, key, prompt, and credential fields.

## Policy Hooks

Policy-as-code v0 now includes:

- `provider.invoke`
- `provider.credential.resolve`
- `provider.local_cli.invoke`
- `provider.pty.invoke`
- `provider.cloud_api.invoke`
- `local_agent.invoke`
- `local_cli.file_write`
- `local_cli.shell_execution`
- `local_cli.network_access`
- `credential.cache.read`
- `credential.cache.upload`

Defaults deny credential cache access, PTY invocation, cloud provider invocation, credential resolution, and dangerous local CLI capabilities. Mock provider invocation remains allowed.

## Audit Events

Provider audit events include:

- `provider_catalog_entry_created`
- `provider_validation_requested`
- `provider_invocation_requested`
- `provider_invocation_blocked`
- `credential_resolution_requested`
- `credential_resolution_blocked`
- `local_agent_required`
- `local_agent_unavailable`
- `local_cli_invocation_requested`
- `local_cli_invocation_blocked`
- `credential_cache_access_denied`
- `provider_output_redacted`
- `parser_error`

Audit never stores raw provider secrets or credential cache contents.

## API Endpoints

- `GET /providers`
- `GET /providers/:id`
- `POST /providers/validate`
- `GET /providers/catalog`
- `GET /providers/auth-types`
- `GET /providers/local-cli/templates`
- `GET /providers/local-agents`
- `POST /providers/invoke`
- `GET /providers/audit`

`POST /providers/invoke` returns blocked/unavailable results by default.

## Dashboard Changes

The dashboard shows:

- provider abstraction status;
- provider catalog count and kinds;
- auth types;
- local CLI template count;
- Local Agent required state;
- blocked credential cache and PTY examples;
- provider audit event count.

## Tests

Tests cover:

- auth validation;
- provider catalog seeds;
- CredentialManager and TokenResolver behavior;
- adapter blocked/unavailable behavior;
- parser and redaction behavior;
- Local Agent boundary;
- policy hooks;
- LLM Gateway provider catalog attribution;
- API and dashboard visibility;
- regression behavior for existing mock-first gates.

## Known Limitations

- No real provider API calls.
- No real OAuth/device-code/WIF/IAM exchange.
- No secret manager integration.
- No real Aichestra Local Agent.
- No vendor CLI execution.
- No PTY automation.
- Provider catalog and provider audit are in-memory at runtime.
- No production provider governance or legal/terms validation.

## Next Recommended Task

Secrets and Sandbox Design v0 has now added metadata-only `SecretRef`, `SecretScope`, `SecretLease`, sandbox, network egress, and redaction models. Enterprise provider entries may reference secret metadata, but provider adapters still receive no raw credentials and remain blocked by default.

Next recommended task: Aichestra Local Agent Protocol v0, or Real Git Adapter v1 if controlled remote Git branch/PR creation should be enabled next.
