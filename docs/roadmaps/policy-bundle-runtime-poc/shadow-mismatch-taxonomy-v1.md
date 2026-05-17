# Policy Shadow Mismatch Taxonomy v1

Status: v1_implemented as planning metadata
Runtime impact: none

Shadow mismatches compare a future candidate runtime decision against the `StaticPolicyEngine` source-of-truth decision. v1 defines taxonomy only; it does not compare live decisions.

## Severity Rules

| Severity | Meaning | Default rollout impact |
| --- | --- | --- |
| `info` | Cosmetic or supplemental difference. | Record only. |
| `low` | Operationally minor drift that should be reviewed. | Record only. |
| `medium` | Traceability or review quality gap. | Record and alert in future. |
| `high` | Missing obligation, runtime error, or rule mapping gap. | Block domain rollout future. |
| `critical` | Candidate could weaken a static deny/block or redaction requirement. | Block rollout future. |

## Mismatch Types

| Mismatch | Severity | Example | Operational impact | Remediation |
| --- | --- | --- | --- | --- |
| `static_allow_candidate_deny` | medium | Static allows mock dashboard read, candidate denies. | Candidate may break expected workflows. | Review rule mapping and candidate conditions. |
| `static_deny_candidate_allow` | critical | Static denies `secret.read`, candidate allows. | Candidate may bypass critical safety gates. | Block rollout; fix candidate bundle/runtime. |
| `static_block_candidate_allow` | critical | Static blocks governance apply, candidate allows. | Candidate may bypass governance, destructive Git, credential cache, or critical MCP gates. | Block rollout; require security review. |
| `reason_mismatch` | low | Both deny, but candidate omits repo allowlist reason. | Operators lose context. | Normalize reason vocabulary. |
| `rule_id_mismatch` | medium | Static matches a named deny rule, candidate reports generic deny. | Audit traceability weakens. | Add rule alias mapping. |
| `missing_obligation` | high | Candidate omits required budget, redaction, approval, or lease obligation. | Future enforcement would be incomplete. | Add obligation mapping and tests. |
| `extra_obligation` | low | Candidate adds manual review for low-risk mock read. | UX or operator workflow may drift. | Review if extra obligation is intentional. |
| `redaction_mismatch` | critical | Candidate audit metadata includes env-like value. | No-secret/no-env guarantee is at risk. | Block rollout; fix redaction contract. |
| `audit_metadata_mismatch` | medium | Candidate omits `requestId` or `serviceAccountId`. | Correlation and audit review weaken. | Add required audit fields. |
| `error_in_candidate` | high | Candidate throws for a golden case. | Candidate readiness cannot be trusted. | Fix runtime error and rerun golden cases. |

## Critical Examples

- Static denies destructive Git operation but candidate allows.
- Static denies `secret.read` but candidate allows.
- Static blocks governance apply but candidate allows.
- Static denies credential cache read but candidate allows.
- Static denies critical MCP tool invocation but candidate allows.
- Static requires no-secret redaction but candidate output exposes secret-adjacent metadata.

## Rollout Impact

Any critical mismatch blocks future candidate rollout. Any high mismatch blocks domain activation until remediated. Medium mismatches require audit or operator review before alerting. Low and info mismatches remain record-only unless they accumulate or affect a regulated domain.

## Remediation Guidance

Remediation must update candidate rules, rule alias mapping, input normalization, obligation mapping, redaction mapping, or audit metadata mapping. It must not change `StaticPolicyEngine` to fit a candidate runtime unless a separate policy change is reviewed and golden cases are updated.
