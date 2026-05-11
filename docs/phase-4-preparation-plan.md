# Phase 4 Preparation Plan

## Current Phase 1-3 Readiness

- Phase 1 is complete for the current milestone: task creation, task runs, mock policy/model selection, mock Git branch/PR behavior, mock agent execution, usage ledger attribution, API, worker, and dashboard visibility exist.
- Phase 2 is complete for the current milestone: branch leases, deterministic conflict risk scoring, merge queue entries, mock/local-only merge simulation, API visibility, dashboard visibility, and tests exist.
- Phase 3 is v3 implemented: Skill, Harness, and Instruction registries are separate concepts with resolver gates, repository boundaries, DTOs, audit/history/rollback, local eval result metadata, mock mutation auth, local package manifests, import/export, simple semver ranges, package diffs, APIs, dashboard visibility, and tests.

## Why Phase 4 Preparation Is Safe To Start

The validation baseline is clean and the registry foundation now has enough guardrails to store future improvement metadata without changing active artifacts. Phase 4 Preparation can add observation, clustering, proposal, eval requirement, canary plan, and safety policy models without introducing real LLM calls or mutating registry entries.

## Why Auto-Improvement v0 Should Not Be Implemented Yet

Auto-improvement v0 will need a deterministic engine, draft registry change handling, readiness checks, and stricter safety controls. This task only creates the data and API foundation for those future behaviors. It must not generate automatic patches, apply proposals, approve proposals, run eval suites, execute canary rollout, or activate registry entries.

## Required Data Models

- `FailureSignal` captures observed problems from task runs, conflict manager, registry resolver, test results, usage ledger, or manual review.
- `FailureCluster` groups related signals deterministically by category, target kind, and target ref.
- `ImprovementCandidate` identifies a possible Skill, Harness, or Instruction target for future improvement.
- `ImprovementProposal` stores draft proposal metadata without applying changes.
- `EvalRequirement` records checks future proposals must satisfy without executing evals.
- `CanaryRolloutPlan` records future rollout stages without executing rollout.
- `AutoImprovementSafetyPolicy` stores guardrails such as no auto-apply, human approval required, eval required, and canary required.

## Safety Gates Required Before Auto-Improvement

- Auto-apply must remain disabled by default.
- Human approval, eval pass, and canary must be required by default.
- Proposals must remain draft/review objects.
- Candidate and proposal services must not mutate active registry entries.
- Eval requirements must not execute evals.
- Canary plans must not execute rollout.
- Clustering must be deterministic and must not use embeddings or LLMs.
- APIs must return DTOs and deterministic validation errors.

## This Task Implements

- Phase 4 preparation domain models in `packages/core`.
- `packages/improvement` repository interfaces, in-memory repositories, services, DTO mappers, and validation helpers.
- API endpoints under `/improvement/*`.
- Dashboard visibility for signals, clusters, candidates, proposals, eval requirements, canary plans, and safety policy state.
- Deterministic tests covering services, API behavior, dashboard assumptions, and no registry mutation by proposals.
- Documentation for Phase 4 Preparation and updated phase progress status.

## Out Of Scope

- Real LLM calls.
- Embeddings or LLM clustering.
- Auto-improvement engine behavior.
- Draft registry change application.
- Proposal auto-approval.
- Real eval execution.
- Real canary execution.
- Real GitHub, GitLab, Bitbucket, OpenAI, Anthropic, Gemini, Bedrock, MCP, Vault, Kubernetes, Temporal, or artifact registry integrations.
