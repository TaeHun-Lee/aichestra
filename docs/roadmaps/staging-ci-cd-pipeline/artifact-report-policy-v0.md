# CI/CD Artifact And Report Policy v0

Status: v0_implemented
Scope: planning only

## Allowed Artifacts

- test result summaries
- lint/typecheck/build summaries
- redacted safe integration scan classifications
- redacted secret scan summaries
- readiness summaries
- future coverage summaries
- future dashboard/health smoke summaries

## Forbidden Artifacts

- raw secrets
- tokens
- private keys
- webhook secrets
- DB URL values
- raw env dumps
- raw prompts
- raw provider outputs
- raw webhook payloads
- credential-cache contents or paths
- unredacted logs

## Redaction Requirements

Reports must redact:

- API keys
- bearer tokens
- GitHub tokens
- GitHub App private key material
- webhook secrets
- session/JWT secrets
- DB URLs
- credential-cache paths
- raw prompts/outputs and raw webhook payloads

## Retention Guidance

Default retention should be short for failed-job logs and moderate for redacted validation summaries. Long retention should be reserved for security-relevant summaries after no-secret checks pass.

## Failure Reports

Failure reports should include:

- job id
- profile id
- sanitized failure category
- remediation
- whether optional gates were configured
- whether secrets/env values were exposed

They must not include raw logs when raw logs contain sensitive values.
