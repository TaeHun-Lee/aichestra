# Phase 4 Preparation

## What This Phase Implements

Phase 4 Preparation adds the foundation needed before any future auto-improvement engine exists. It introduces failure observation, deterministic clustering, improvement candidates, draft proposal metadata, eval requirements, canary rollout plans, safety policies, service/repository boundaries, API visibility, dashboard visibility, and tests.

This is preparation only. It does not implement automatic improvement.

## What It Does Not Implement

- No real LLM calls.
- No embeddings.
- No external services.
- No automatic Skill, Harness, or InstructionArtifact mutation.
- No proposal auto-approval.
- No real eval execution.
- No real canary execution.
- No real provider, MCP, Vault, Kubernetes, Temporal, or artifact registry integration.

## Domain Models

### FailureSignal

Captures observed failure signals from task runs, conflict manager, registry resolver, test results, usage ledger, or manual review.

Key fields: `sourceType`, `sourceId`, optional `taskId`, optional `taskRunId`, `targetKind`, optional `targetRef`, `severity`, `category`, `summary`, optional `details`, `observedAt`, and `metadata`.

### FailureCluster

Groups related failure signals deterministically. v0 clustering groups by:

```text
category + targetKind + targetRef
```

No embeddings, LLM clustering, or external services are used.

### ImprovementCandidate

Identifies a possible future improvement target for a Skill, Harness, or InstructionArtifact. Candidates do not change registry entries.

### ImprovementProposal

Stores draft proposal metadata such as change type, summary, rationale, safety notes, and status. Proposals do not auto-apply and do not activate registry entries.

### EvalRequirement

Describes a check that a future proposal must satisfy. It does not execute an eval.

### CanaryRolloutPlan

Describes future rollout stages and criteria. It does not execute rollout.

### AutoImprovementSafetyPolicy

Defines guardrails for future auto-improvement. The default policy is:

```text
allowAutoApply = false
requireHumanApproval = true
requireEvalPassed = true
requireCanary = true
```

## Repositories And Services

`packages/improvement` owns Phase 4 Preparation interfaces and in-memory implementations:

- `FailureSignalRepository`
- `FailureClusterRepository`
- `ImprovementCandidateRepository`
- `ImprovementProposalRepository`
- `EvalRequirementRepository`
- `CanaryRolloutPlanRepository`
- `AutoImprovementSafetyPolicyRepository`

Services are deterministic and local-only:

- `FailureSignalService`
- `FailureClusteringService`
- `ImprovementCandidateService`
- `ImprovementProposalService`
- `EvalRequirementService`
- `CanaryRolloutPlanService`
- `AutoImprovementSafetyPolicyService`

## API Endpoints

Implemented endpoints:

```text
GET  /improvement/failure-signals
POST /improvement/failure-signals
GET  /improvement/failure-clusters
POST /improvement/failure-clusters/recompute
GET  /improvement/candidates
POST /improvement/candidates/triage
GET  /improvement/proposals
POST /improvement/proposals
PATCH /improvement/proposals/:id/status
GET  /improvement/eval-requirements
POST /improvement/eval-requirements
GET  /improvement/canary-plans
POST /improvement/canary-plans
GET  /improvement/safety-policies
PATCH /improvement/safety-policies/:id
```

The endpoints use DTO mappers, service-layer validation, and deterministic errors. They do not call LLMs, run evals, execute rollout, or mutate active registry entries.

## Dashboard Changes

The dashboard now shows simple Phase 4 Preparation visibility:

- failure signal count and category
- deterministic failure clusters
- improvement candidates
- draft improvement proposals
- eval requirements
- draft canary plans
- default safety policy state

Dashboard data remains mock/demo data and does not execute an auto-improvement engine.

## Test Strategy

Tests cover:

- failure signal creation/listing and validation
- deterministic clustering and recompute idempotence
- candidate creation, triage, and dismissal behavior
- draft proposal creation and status transitions
- proposal non-mutation of active registry entries
- eval requirement metadata
- canary plan validation
- default safety policy guardrails
- API endpoints under `/improvement/*`
- dashboard Phase 4 Preparation assumptions

## Known Limitations

- Storage is in-memory for Phase 4 Preparation.
- There is no real improvement engine yet.
- There is no draft registry change model yet.
- Proposal readiness checks are future work.
- No eval suite execution exists.
- No canary execution exists.
- No real auth, RBAC, artifact registry, or provider integration exists.

## Next Recommended Task

Phase 4 Auto-improvement v0, still mock-only and draft-only:

- add `AutoImprovementEngine`
- add deterministic `MockAutoImprovementEngine`
- convert failure clusters into candidates and draft proposals
- add draft registry changes
- add proposal readiness checks
- keep auto-apply disabled
- keep active registry entries unchanged
- do not call real LLMs or external services
