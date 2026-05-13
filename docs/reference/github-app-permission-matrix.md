# GitHub App Permission Matrix

Status: GitHub App / Production Webhook Hardening Planning v0.

This matrix defines the target least-privilege GitHub App posture. It is planning data only. Aichestra does not create a GitHub App, request installation access tokens, or call GitHub App APIs in v0.

| Aichestra capability | GitHub permission | Required level | Risk | Production default | Approval requirement | Audit requirement | Current implementation | Future only |
|---|---|---:|---|---|---|---|---|---|
| Repository identity and allowlist checks | `metadata` | read | low | allow | app permission review | audit app descriptor and repository grant metadata | token-gated GitHub path has repo metadata behavior; GitHub App path is not live | no |
| Changed-file refresh and branch read models | `contents` | read | medium | allow after review | integration owner approval | audit read-model refresh result and repo ref | gated token path can read changed files | no |
| Future branch creation through installation token | `contents` | write | high | future_review | security plus integration owner approval | audit branch-create request, policy decision, repo grant, and result | token-gated branch create exists; GitHub App path is not live | yes |
| PR sync and PR read models | `pull_requests` | read | medium | allow after review | integration owner approval | audit PR sync read outcome | gated token/webhook read models exist | no |
| Future PR creation through installation token | `pull_requests` | write | medium | future_review | security plus integration owner approval | audit PR-create request, policy decision, repo grant, and result | token-gated PR create exists; GitHub App path is not live | yes |
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
