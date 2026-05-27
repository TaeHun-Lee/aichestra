# Semantic Merge Review

## Problem

Git detects many textual conflicts, but it can miss semantic conflicts.

Example:

- Session A changes `login(userId: string)` to `login(user: User)`.
- Session B adds a new call `login("u-123")` in a different file.
- Git may merge cleanly, but the program is now wrong.

Aichestra reduces this risk by recording each session's change intent and running a dedicated Semantic Merge LLM review before approval.

## Change Intent Ledger

The Change Intent Ledger combines:

- worker LLM's Change Manifest
- actual Git diff
- changed file list
- changed symbol summary when available
- test evidence
- context snapshot hashes
- semantic review reports

The manifest is useful but not authoritative. Actual diff data always wins.

## MVP manifest generation

`aich session complete <session-id>` creates a generated Change Manifest draft from the session goal and actual Git diff metadata. It records the base commit, head commit, changed files, diff artifacts, and context snapshot hash with `validation_status: generated_from_diff`.

This generated manifest is evidence, not final proof of intent. It does not infer changed symbols or semantic impact in the MVP path, so human review or a later LLM manifest-edit step must fill in intent details before relying on it for semantic merge decisions.

Manifest-vs-diff validation parses the Change Manifest as YAML and compares actual changed files against structured fields such as `change_manifest.changed_areas[].file`, `newly_created_files`, and `deleted_or_renamed_files`. It does not treat arbitrary string containment as proof that a file was declared. Invalid YAML or missing structured file evidence is a manifest mismatch.

## Semantic Merge LLM role

The Semantic Merge LLM is an advisory reviewer and patch planner.

It should:

- compare change intent across sessions
- identify changed assumptions
- identify breaking API or behavior changes
- find likely stale call sites
- propose tests to run
- propose a fix plan if needed
- produce a clear review summary

It must not:

- approve its own merge
- bypass tests
- bypass human approval
- claim complete safety without evidence
- hide uncertainty

## Inputs

The reviewer should receive:

```text
- Project rules from AGENTS.md
- Candidate session manifest
- Relevant previous manifests already applied after the candidate base commit
- Actual diff summary
- Changed file list
- Changed symbol summary if available
- Mechanical merge result
- Check results, if already run
- Test commands configured in .aichestra/config.yaml
```

## Output schema

Recommended shape:

```yaml
semantic_review:
  session_id: session-123
  merge_attempt_id: merge-attempt-456
  risk_level: low | medium | high | blocked
  summary: "..."
  suspected_conflicts:
    - type: api_contract_change | stale_assumption | behavior_conflict | test_gap | config_conflict | unknown
      files:
        - src/auth/login.ts
      symbols:
        - login
      explanation: "..."
      confidence: low | medium | high
  required_actions:
    - "Update call sites to new login(User) signature."
  suggested_tests:
    - "cargo test auth_login"
  proposed_patch:
    available: false
    path: null
  uncertainty:
    - "No call graph index is available in MVP; review is based on manifests and diffs."
```

## MVP behavior

MVP starts with semantic review report generation only.

`aich review <session-id>` runs semantic review through a `SemanticReviewAdapter` boundary. The current default adapter is a local deterministic reviewer rather than an external LLM provider. It reads the latest verified merge attempt, Change Manifest artifact, changed-file evidence, patch summary, configured semantic-review prompt, and sandbox check results, then writes:

- a review input artifact for auditability
- a YAML semantic review report
- a `semantic_reviews` ledger row
- `merge.semantic_review.completed` event data

The report records the adapter reviewer id and `llm_executed` flag so the user can distinguish local deterministic evidence from a provider-backed Semantic Merge LLM review. Future LLM adapters should consume the same evidence bundle and return the same risk/report shape. They remain advisory and cannot approve, apply, or bypass the integration-sandbox checks.

The adapter is configured in `.aichestra/config.yaml`:

```yaml
semantic_review:
  adapter: local | command | llm
  reviewer_id: local_mvp_static_reviewer
  reviewer_provider: codex
  model: optional-provider-model
  profile: optional-provider-profile
  command: your-review-command --flag
```

`adapter: command` is provider-agnostic. Aichestra passes the rendered review input artifact to the command on stdin and expects stdout to contain a `semantic_review:` YAML document matching the report schema. The command is executed directly as a program plus args, not through a shell. If the command exits non-zero or returns an invalid report, Aichestra records a `blocked` semantic review so the candidate cannot be approved or applied until the reviewer configuration/output is fixed.

`adapter: llm` is the built-in LLM wrapper path. With `reviewer_provider: codex`, Aichestra runs `codex exec` non-interactively with a read-only sandbox, no command approval, the rendered review input on stdin, and the same YAML output contract. Custom LLM providers can use `adapter: llm` with an explicit `command`, which lets a local wrapper call any provider while keeping the same audit artifacts and blocking behavior.

Automatic patch application is optional and should remain behind explicit human approval. If a proposed patch is applied, the resulting tree becomes a new candidate and must go through checks again.

## Local reviewer risk heuristics

The local MVP reviewer is intentionally conservative:

- `blocked`: missing manifest artifact, manifest hash drift, changed-file evidence missing from the manifest, missing changed-file evidence, or failed check evidence
- `high`: shared API, schema, config, dependency, migration, type, `lib.rs`, or `mod.rs` surfaces changed
- `medium`: no direct blocker found, but the Change Manifest is generated from diff metadata and semantic impact is not inferred
- `low`: reserved for reviewed manifest evidence with no direct conflict or shared-surface risk

Only configured block levels mark the merge attempt blocked. The default config blocks `blocked` only.

## Risk classification

Use `blocked` when:

- the reviewer finds a likely break that tests have not resolved
- the manifest and actual diff materially disagree
- a public API changed and dependent changes are missing
- config or migration behavior changed without clear compatibility plan

Use `high` when:

- there is a likely semantic conflict but not enough evidence to block automatically
- tests are weak or absent around changed behavior

Use `medium` when:

- changes touch related areas or shared modules
- no direct break is found, but assumptions may overlap

Use `low` when:

- changes are isolated
- manifests match diff
- tests cover affected behavior

## Review UX

Human review should show:

- normal diff summary
- Change Manifest summary
- semantic risk level
- suspected conflicts
- suggested tests
- whether the exact candidate tree passed checks
- unresolved uncertainty

The user should approve with awareness of semantic risk.

`aich approve <session-id>` can approve `low`, `medium`, or `high` semantic review results, because those risks remain advisory. A `blocked` semantic review marks the merge attempt blocked and must be resolved before approval.
