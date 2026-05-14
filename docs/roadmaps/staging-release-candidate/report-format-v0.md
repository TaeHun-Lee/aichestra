# Staging Release Candidate Report Format v0

Status: `v0_implemented`

The staging RC report is a deterministic read model. It is safe to return from API, health, dashboard, and tests because it contains no secret values, env values, tokens, raw logs, raw prompts, raw provider responses, release artifacts, deployment output, or external-call results.

## Schema

```ts
type StagingReleaseCandidateReport = {
  id: string;
  generatedAt: Date;
  overallStatus: "pass" | "pass_with_warnings" | "blocked" | "not_ready";
  summary: string;
  checklist: StagingReleaseCandidateChecklist;
  gates: StagingReleaseCandidateGate[];
  blockers: StagingReleaseCandidateBlocker[];
  signoffs: StagingReleaseCandidateSignoff[];
  releaseNoteRequirements: StagingReleaseNoteRequirement[];
  rollbackChecklist: StagingRollbackChecklistItem[];
  skippedTests: string[];
  recommendedNextActions: string[];
  metadata: Record<string, unknown>;
};
```

## Example Report

```json
{
  "id": "staging_release_candidate_report_v0",
  "overallStatus": "not_ready",
  "summary": "Staging release candidate checklist is not ready; required validation, signoff, release notes, or rollback evidence is missing.",
  "skippedTests": [
    "staging_rc_optional_postgres_profile_documented",
    "staging_rc_github_integration_profile_documented",
    "staging_rc_llm_integration_profile_documented"
  ],
  "recommendedNextActions": [
    "Do not create a release, Git tag, GitHub release, or deployment from this checklist.",
    "Run required local validation commands and record their status before staging RC designation.",
    "Document skipped optional integration tests and why their gates were not configured."
  ],
  "metadata": {
    "releaseCreated": false,
    "gitTagCreated": false,
    "githubReleaseCreated": false,
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

## Evidence Pack Fields

The report schema is unchanged for Evidence Pack v0. Evidence is carried by documentation references rather than additional runtime fields:

- `docs/audits/staging-rc-evidence-pack-v0.md`
- `docs/roadmaps/staging-release-candidate/release-notes-draft-v0.md`
- `docs/roadmaps/staging-release-candidate/rollback-evidence-v0.md`
- `docs/roadmaps/staging-release-candidate/signoff-readiness-v0.md`

Future audits may use these documents to classify release notes and rollback evidence as present. Signoffs remain pending/planning-ready unless real approval or explicit waiver evidence is added.

## Status Examples

`pass`: all required gates are passed, no open RC blockers exist, signoffs are approved or not applicable, release-note requirements are present, rollback items are planned, and no unsafe safety flag is enabled.

`pass_with_warnings`: required gates pass, but optional integration profiles are skipped, production-only blockers are accepted, or a signoff/release-note/rollback item is explicitly waived or not applicable.

With Evidence Pack v0, `pass_with_warnings` is the target only if a future audit accepts planning-ready signoff evidence as a warning. It must not be used to claim real human approval, release creation, staging deployment, or production readiness.

`not_ready`: no critical safety blocker exists, but required validation is unchecked, required signoffs are pending, required docs/release-note sections are missing, rollback items are missing, or a non-critical RC blocker remains open.

`blocked`: any open critical blocker exists, including validation failure, no-secret/no-env failure, release/tag/deployment execution, external calls, destructive Git, real MCP transport, vendor CLI execution, or readiness overclaim.

## Blocker Example

```json
{
  "id": "blocker_staging_rc_no_release_or_deployment_execution",
  "category": "security",
  "title": "No release or deployment execution",
  "severity": "critical",
  "blockingLevel": "blocks_release_candidate",
  "status": "open",
  "source": "staging_rc_no_release_or_deployment_execution"
}
```

## Warning Example

```json
{
  "id": "blocker_staging_rc_real_secret_backend_missing",
  "category": "secrets",
  "severity": "medium",
  "blockingLevel": "blocks_production_only",
  "status": "accepted"
}
```

## Skipped Integration Example

```json
{
  "id": "staging_rc_github_integration_profile_documented",
  "category": "git_integration",
  "status": "skipped",
  "required": false,
  "severity": "medium"
}
```

## Signoff Example

```json
{
  "id": "staging_rc_signoff_security_reviewer",
  "role": "security_reviewer",
  "required": true,
  "status": "pending"
}
```

## Rollback Checklist Example

```json
{
  "id": "staging_rc_rollback_config",
  "category": "config",
  "name": "config",
  "required": true,
  "status": "planned"
}
```

## Promotion Recommendation Examples

- Pass with warnings: "Record optional integration skips and accepted production-only blockers in release notes before RC designation."
- Not ready: "Run required validation commands and complete signoffs/release notes before RC designation."
- Blocked: "Resolve critical safety blockers before calling the branch a staging release candidate."

The report never recommends deployment execution. Staging deployment validation remains a separate future task.
