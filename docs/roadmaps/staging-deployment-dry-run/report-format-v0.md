# Staging Deployment Dry-run Report Format v0

Status: v0_implemented
Scope: read-only report schema

## Report Schema

`StagingDeploymentDryRunReport` contains:

- `id`: stable report id.
- `generatedAt`: generation timestamp.
- `overallStatus`: `pass`, `pass_with_warnings`, `blocked`, or `not_ready`.
- `summary`: human-readable status summary.
- `profile`: `StagingDeploymentDryRunProfile`.
- `sourceSummaries`: `StagingDeploymentDryRunSource[]`.
- `checks`: `StagingDeploymentDryRunCheck[]`.
- `blockers`: `StagingDeploymentDryRunBlocker[]`.
- `integrationProfiles`: integration profiles classified as `ready`, `gated`, `skipped`, `blocked`, or `future`.
- `promotionGuidance`: guidance for when staging validation may be attempted.
- `rollbackGuidance`: guidance for stopping or reverting future validation attempts.
- `recommendedNextActions`: deterministic next actions.
- `metadata`: sanitized booleans/counts/status only.

## Example Report

```json
{
  "id": "staging_dry_run_report_v0",
  "overallStatus": "blocked",
  "summary": "Staging deployment validation is blocked by critical readiness or safety blockers.",
  "profile": {
    "id": "staging_dry_run_profile_v0",
    "dryRunMode": "read_only",
    "status": "blocked"
  },
  "sourceSummaries": [
    {
      "id": "staging_dry_run_source_staging_profile",
      "sourceKind": "staging_profile",
      "status": "fail",
      "severity": "critical"
    },
    {
      "id": "staging_dry_run_source_github_integration_tests",
      "sourceKind": "github_integration_tests",
      "status": "skipped",
      "severity": "medium"
    }
  ],
  "checks": [
    {
      "id": "dry_run_no_deployment_execution",
      "category": "environment",
      "status": "pass",
      "severity": "critical",
      "requiredForStaging": true
    }
  ],
  "blockers": [
    {
      "id": "blocker_missing_secret_backend",
      "severity": "critical",
      "blockingLevel": "blocks_staging_deployment",
      "status": "open"
    }
  ],
  "integrationProfiles": [
    {
      "id": "github_app_integration_test_profile_v1",
      "status": "skipped",
      "requiredForStaging": false,
      "skippedByDefault": true
    }
  ],
  "metadata": {
    "deploymentExecuted": false,
    "externalCallsExecuted": false,
    "remoteIntegrationTestsExecuted": false,
    "secretsReturned": false,
    "envValuesReturned": false,
    "productionReady": false,
    "stagingDeployed": false
  }
}
```

## Blocker Examples

- `blocker_dry_run_remote_merge_forbidden`: critical, `blocks_staging_dry_run`.
- `blocker_dry_run_force_push_forbidden`: critical, `blocks_staging_dry_run`.
- `blocker_dry_run_branch_deletion_forbidden`: critical, `blocks_staging_dry_run`.
- `blocker_dry_run_vendor_cli_forbidden`: critical, `blocks_staging_dry_run`.
- `blocker_dry_run_real_mcp_transport_forbidden`: critical, `blocks_staging_dry_run`.
- `blocker_missing_secret_backend`: critical, `blocks_staging_deployment`.
- `blocker_mock_auth_production`: critical, `blocks_production_only`.

## Warning Examples

- Missing production auth while mock auth is explicitly allowed for read-only dry-run.
- Missing real secret backend when no live provider validation is required yet.
- Policy bundle runtime still planning-only.
- Observability external backend missing.
- GitHub App integration-test profile skipped by default.
- LLM Gateway integration-test profile skipped by default.

## Skipped Integration Examples

GitHub App integration-test profile v1 is `skipped` when live-test gates are missing and the dry-run does not require live GitHub validation.

LLM Gateway integration-test profile v1 is `skipped` when live-test gates are missing and the dry-run does not require live LLM validation.

Skipped profiles become `gated` or fail relevant checks only when the dry-run explicitly requires them.

## Promotion Recommendation Examples

- Do not mark staging as deployed from this report.
- Resolve all `blocks_staging_dry_run` and `blocks_staging_deployment` blockers before attempting deployment validation.
- Run normal local validation commands outside the dry-run report.
- Run optional GitHub App or LLM live profiles only as explicit gated validation tasks.

## Rollback Recommendation Examples

- If a future validation exposes secret/env data, revoke exposed credentials out of band and block the dry-run until sanitized.
- If destructive Git gates are enabled, disable them before retrying.
- If vendor CLI execution or real MCP transport becomes enabled, return to mock-first defaults before continuing.
