# GitHub App Credentials v0

Status: planning plus controlled runtime alignment. GitHub App Controlled Implementation v1 adds metadata-only private-key SecretRef checks and mock token-handle issuance, but no private key signing or live installation token exchange is implemented.

## Private Key Handling

- GitHub App private keys must live in a future real secret backend behind `SecretRef`.
- Aichestra must not store private keys in source, config, audit, dashboard, logs, tests, or read models.
- The env SecretRef provider is not sufficient for production private-key management.
- v0 and GitHub App Controlled Implementation v1 do not generate, read, parse, or sign with a GitHub App private key.

## App And Installation IDs

- App id and installation id are metadata only.
- Installation ids should be mapped to approved organizations/accounts and repository grants.
- Repository grants must still pass Aichestra allowlists, Auth/RBAC, and Policy-as-code checks.

## Future Installation Token Path

Future work may:

1. resolve private key by SecretRef inside a narrow credential boundary;
2. sign a GitHub App JWT inside that boundary;
3. exchange it for an installation access token;
4. use the short-lived token only inside `GitHubClient`;
5. audit metadata only.

v0 implements none of these live steps. GitHub App Controlled Implementation v1 implements only the metadata request/result boundary and mock token-handle result for deterministic tests and gated status checks.

## SecretRefs

Supported/planned refs:

- GitHub App private key SecretRef (`github_app_private_key`) as metadata-only runtime support in GitHub App Controlled Implementation v1.
- GitHub App webhook secret SecretRef as metadata/config support.
- optional installation-level metadata refs, if needed

SecretRef ids may appear in metadata. Secret values must not.

## Token TTL And Refresh

- Target installation token TTL: 3600 seconds or provider limit.
- Refresh should be just-in-time and operation-scoped.
- Tokens must not be cached in audit, dashboard, health, read models, or tests.

## Audit Requirements

Planned audit events:

- `github_installation_token_requested_future`
- `github_installation_token_issued_future_metadata_only`
- `github_app_repo_grant_changed`

Audit may include app descriptor id, installation id, repo ref, actor id, policy decision id, and outcome. Audit must not include private key material, webhook secrets, JWTs, installation tokens, PATs, or credential cache contents.

## Why Legacy Env Token Fallback Is Not Production Ready

Legacy env tokens are broad, long-lived, harder to rotate safely, and not installation-scoped. They remain useful only for gated integration testing and compatibility. Production should migrate to GitHub App installation tokens after real secret backend, policy, observability, and replay/dead-letter controls are implemented.
