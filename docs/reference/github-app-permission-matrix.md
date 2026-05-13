# GitHub App Permission Matrix

Status: GitHub App / Production Webhook Hardening Planning v0 plus GitHub App Controlled Implementation v1 alignment.

This matrix defines the target least-privilege GitHub App posture. GitHub App Controlled Implementation v1 can issue metadata-only mock token handles after local gates pass, but Aichestra still does not create a GitHub App, sign JWTs, request live installation access tokens, or call GitHub App APIs by default.

| Aichestra capability | GitHub permission | Required level | Risk | Production default | Approval requirement | Audit requirement | Current implementation | Future only |
|---|---|---:|---|---|---|---|---|---|
| Repository identity and allowlist checks | `metadata` | read | low | allow | app permission review | audit app descriptor and repository grant metadata | token-gated GitHub path has repo metadata behavior; GitHub App path is not live | no |
| Changed-file refresh and branch read models | `contents` | read | medium | allow after review | integration owner approval | audit read-model refresh result and repo ref | gated token path can read changed files | no |
| Branch creation through controlled GitHub App boundary | `contents` | write | high | future_review | security plus integration owner approval | audit branch-create request, policy decision, repo grant, token handle id, and result | token-gated branch create exists; GitHub App v1 mock token-handle path exists; live installation token path is not implemented | no for mock path; live path future |
| PR sync and PR read models | `pull_requests` | read | medium | allow after review | integration owner approval | audit PR sync read outcome | gated token/webhook read models exist | no |
| PR creation through controlled GitHub App boundary | `pull_requests` | write | medium | future_review | security plus integration owner approval | audit PR-create request, policy decision, repo grant, token handle id, and result | token-gated PR create exists; GitHub App v1 mock token-handle path exists; live installation token path is not implemented | no for mock path; live path future |
| Check status read model | `checks` | read | medium | allow after review | read-only app permission review | audit check ingestion outcomes | read-model planning only | yes |
| Commit status read model | `statuses` | read | medium | allow after review | read-only app permission review | audit status ingestion outcomes | read-model planning only | yes |
| Future issue linking | `issues` | read | medium | future_review | separate product/security approval | audit issue metadata reads if enabled | not implemented | yes |
| Workflow automation | `workflows` | none | critical | deny | explicit future milestone only | audit denied workflow permission requests | not implemented | no |
| Repository administration | `administration` | none | critical | deny | not allowed by this roadmap | audit denied admin permission requests | not implemented | no |
| Repository secrets | `secrets` | none | critical | deny | not allowed by this roadmap | audit denied secrets permission requests | not implemented | no |
| Deployments | `deployments` | none | high | deny | separate deployment milestone only | audit denied deployment permission requests | not implemented | no |

Production rules:

- Default GitHub App permissions must be least privilege.
- Workflow, administration, secrets, and deployment permissions are denied by default.
- Contents write and pull request write are for future branch/PR creation only and do not imply merge.
- Merge, rebase, force push, branch deletion, workflow dispatch, and deployment actions remain out of scope.
- Aichestra repo allowlists, Auth/RBAC, Policy-as-code, SecretRef, and audit gates remain authoritative even when GitHub App permissions exist.
