# Policy Shadow Rollout and Rollback v1

Status: v1_implemented as planning metadata
Runtime impact: none

This document defines future rollout and rollback stages for policy shadow evaluation. It does not enable a shadow evaluator or production policy runtime.

## Rollout Stages

1. `docs_planning`
   - Define architecture, models, taxonomy, reporting, rollout, and safety guarantees.
   - Runtime remains `StaticPolicyEngine`.

2. `golden_harness_only`
   - Run deterministic golden cases against `StaticPolicyEngine`.
   - No candidate runtime execution.

3. `offline_candidate_runtime_evaluation`
   - Future-only.
   - Run sanitized golden cases through a candidate runtime outside live request paths.
   - Record reports only.

4. `live_shadow_record_only`
   - Future-only.
   - Static decision is made first and enforced.
   - Candidate decision is evaluated asynchronously or sidecar-safe and recorded only.

5. `critical_mismatch_alerting`
   - Future-only.
   - Alert on critical mismatches after durable audit and observability controls exist.
   - Alerts do not change enforcement.

6. `selected_non_critical_enforcement`
   - Future-only.
   - Requires explicit reviewed task, production Auth/RBAC, tenant scoping, durable audit, rollback controls, and no critical/high mismatches.

7. `production_enforcement`
   - Future-only.
   - Requires signed bundle verification runtime, policy governance, separation of duties, audit export, tenant scoping, and rollback pinning.

## Rollback Plan

Future rollback actions:

- disable shadow evaluator
- fall back to `StaticPolicyEngine`
- invalidate candidate bundle
- record audit event
- keep enforcement unchanged

Rollback must never delete policy history or shadow reports. It must never expose bundle secrets, signing keys, provider credentials, tokens, webhook secrets, raw env values, credential caches, or raw prompts.

## Rollout Blockers

- Any critical mismatch.
- Any high mismatch without domain owner and security review.
- Candidate runtime error rate above threshold.
- Missing golden cases for a target domain.
- Missing redaction or audit metadata.
- Production Auth/RBAC, tenant scoping, durable audit, or rollback controls absent for enforcement stages.
- Any evidence of dynamic policy execution, external policy service calls, remote bundle loading, or secret/env exposure.

## No-Enforcement Guarantee

v1 and all future shadow stages before explicit activation keep `StaticPolicyEngine` authoritative. Candidate output cannot affect enforcement. A rollback from shadow mode is a metadata/config disable only because enforcement never left the static engine.
