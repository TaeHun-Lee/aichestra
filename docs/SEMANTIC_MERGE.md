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

`aich session complete <session-id>` always creates a generated Change Manifest draft from the session goal and actual Git diff metadata. It records the base commit, head commit, changed files, diff artifacts, and context snapshot hash. With the default `manifest.adapter: generated`, this draft is stored directly with `validation_status: generated_from_diff`.

This generated manifest is evidence, not final proof of intent. It includes MVP changed-symbol hints extracted from Git diff hunk headers and changed declaration lines, but those hints are heuristic. It still does not prove semantic impact, so human review or a later LLM manifest-edit step must fill in intent details before relying on it for semantic merge decisions.

`manifest.adapter: command` and `manifest.adapter: llm` let completion ask a provider to generate or enrich the manifest before it is stored. The adapter input includes:

- the generated manifest draft
- actual diff stat and patch artifacts
- changed-file and changed-symbol evidence
- context snapshot hash
- latest `aich session run` stdout/stderr artifacts when present
- the configured Change Manifest prompt

Provider-backed manifest output is evidence, not authority. Aichestra parses the returned `change_manifest:` YAML, overwrites trusted identity and evidence fields from local completion data, stores generator metadata under `change_manifest.evidence`, and records `validation_status: generated_by_command` or `generated_by_llm`. If the provider output is invalid YAML or does not declare every actual changed file in structured manifest fields, `aich session complete` refuses before enqueueing the candidate.

Manifest-vs-diff validation parses the Change Manifest as YAML and compares actual changed files against structured fields such as `change_manifest.changed_areas[].file`, `newly_created_files`, and `deleted_or_renamed_files`. It does not treat arbitrary string containment as proof that a file was declared. Invalid YAML or missing structured file evidence is a manifest mismatch.

## Change Manifest review/edit UX

`aich manifest show <session-id>` is the human inspection step for the latest Change Manifest. It reports the artifact path, ledger validation status, hash status, YAML parse status, changed-file evidence, manifest-vs-diff mismatches, intent summary, risk level, and generation evidence. For `generated_by_command` or `generated_by_llm` manifests, it also points to the manifest-generation input, stdout, stderr, and generated-draft artifacts so the operator can audit what the provider saw and returned without using `--content`. `--content` also prints the YAML artifact.

`aich manifest edit <session-id>` lets the operator update reviewable intent fields without hand-editing ledger metadata:

```bash
aich manifest edit <session-id> \
  --set-intent-summary "What changed and why" \
  --set-risk-level low \
  --add-risk "Known residual risk" \
  --add-test "cargo test --all"
```

The edit command parses the manifest as YAML, changes structured fields, writes the artifact back, updates the ledger hash to match the artifact, marks the manifest as `reviewed_by_operator`, and records `manifest.updated`. `--from-file PATH` can replace the YAML artifact when the operator wants to edit externally first.

Editing a Change Manifest does not change the candidate patch, verified commit, verified tree, or approval state. It is evidence for the next semantic review. Already approved, applying, applied, or abandoned sessions cannot have their current manifest edited because that would mutate evidence after a downstream decision.

Every semantic review stores fingerprints for the evidence it reviewed: Change Manifest id/hash, verified candidate fields, changed files, sandbox check results, and an aggregate review-evidence fingerprint. If any of those inputs change after review, the previous review becomes stale. `aich approve <session-id>` and `aich apply <session-id>` refuse stale review evidence and ask the operator to rerun `aich review <session-id>`. `aich queue` also points the candidate back to review instead of approval when it detects stale review evidence.

The merge attempt separately stores the preflight check policy fingerprint. If `.aichestra/config.yaml` check commands, required flags, timeouts, or explicit environment settings change after preflight, Aichestra treats the verified attempt as stale before semantic review can be trusted. The operator must rerun `aich preflight <session-id>` and then run semantic review again.

Each semantic review also stores the semantic review policy fingerprint. If adapter settings, reviewer/provider/model/profile/command, timeout, risk block levels, prompt path, or prompt file content change after review, Aichestra treats that review as stale and asks the operator to rerun `aich review <session-id>` before approval or apply.

If stale output includes `legacy_review_evidence` or `legacy_semantic_review_policy_evidence`, the review was created before that fingerprint type existed. Aichestra still treats it as stale because it cannot prove what evidence or policy the old review saw; rerun `aich review <session-id>` to refresh the review.

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
- Relevant manifests from other queued candidates
- Actual diff summary
- Actual patch hunk context from the recorded diff patch artifact, included fully when small enough and truncated with an artifact pointer when large
- Changed file list
- Changed symbol summary if available
- Mechanical merge result
- Check results, if already run, including whether each check was required and whether it timed out
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
    description: ""
    fix_plan_artifact: ""
    patch_artifact: ""
    patch: ""
  uncertainty:
    - "No call graph index is available in MVP; review is based on manifests and diffs."
```

## MVP behavior

MVP starts with semantic review report generation only.

`aich review <session-id>` runs semantic review through a `SemanticReviewAdapter` boundary. The current default adapter is a local deterministic reviewer rather than an external LLM provider. It reads the latest verified merge attempt, Change Manifest artifact, related applied and queued Change Manifest artifacts, changed-file and MVP changed-symbol evidence, patch summary, bounded patch hunk context from the recorded diff patch artifact, configured semantic-review prompt, and sandbox check results, then writes:

- a review input artifact for auditability
- a YAML semantic review report
- a `semantic_reviews` ledger row
- `merge.semantic_review.completed` event data

The review input artifact includes the candidate manifest separately from the related manifest bundle. It also includes a `Patch Context` section sourced from `change_manifest.evidence.diff_patch_artifact`; small patches are included in full, while large patches are capped and retain the artifact path for manual inspection. Related manifests are labeled as `applied` or `queued`, include session and latest-attempt metadata when available, and are evidence for stale assumptions or cross-session conflicts; they do not by themselves approve, block, or reorder the queue.

The `merge_attempts` ledger row records the preflight `check_policy_fingerprint`. The `semantic_reviews` ledger row records `change_manifest_id`, `change_manifest_hash`, `verified_candidate_fingerprint`, `changed_files_fingerprint`, `check_results_fingerprint`, `review_evidence_fingerprint`, and `semantic_review_policy_fingerprint` so later approval can verify that the report still corresponds to the current evidence bundle and review policy.

The report records the adapter reviewer id and `llm_executed` flag so the user can distinguish local deterministic evidence from a provider-backed Semantic Merge LLM review. If the adapter returns `proposed_patch.available: true`, Aichestra stores a generated fix-plan artifact and, when inline `proposed_patch.patch` is present, a generated patch artifact under the merge-attempt artifact directory. Future LLM adapters should consume the same evidence bundle and return the same risk/report shape. They remain advisory and cannot approve, apply, reorder the queue, or bypass the integration-sandbox checks.

The adapter is configured in `.aichestra/config.yaml`:

```yaml
semantic_review:
  adapter: local | command | llm
  reviewer_id: local_mvp_static_reviewer
  reviewer_provider: codex
  model: optional-provider-model
  profile: optional-provider-profile
  command: your-review-command --flag
  timeout_seconds: 600
```

The normalized semantic review policy fingerprint includes the adapter kind, reviewer id/provider/model/profile/command, timeout, sorted `risk_block_levels`, prompt path, and prompt file content hash. A missing prompt is also fingerprinted, so adding or removing the prompt file invalidates older reviews.

`adapter: command` is provider-agnostic. Aichestra passes the rendered review input artifact to the command on stdin and expects stdout to contain a `semantic_review:` YAML document matching the report schema. The report is parsed with `serde_yaml` into a structured report model; malformed YAML, missing `risk_level`, missing `summary`, invalid risk values, or incorrectly typed lists are rejected. The command is executed directly as a program plus args, not through a shell. If the command exits non-zero, times out via `timeout_ms` or `timeout_seconds`, or returns an invalid report, Aichestra records a `blocked` semantic review so the candidate cannot be approved or applied until the reviewer configuration/output is fixed.

`adapter: llm` is the built-in LLM wrapper path. With `reviewer_provider: codex`, Aichestra runs `codex exec` non-interactively with a read-only sandbox, no command approval, the rendered review input on stdin, and the same YAML output contract. Custom LLM providers can use `adapter: llm` with an explicit `command`, which lets a local wrapper call any provider while keeping the same audit artifacts and blocking behavior.

`aich init` writes the default semantic review prompt under `.aichestra/prompts/semantic-merge-review.md`. The rendered adapter input also begins with the required YAML output contract so provider-backed reviewers still receive the parser contract even if a target repo has an older or missing prompt file. A provider response that contains prose instead of a `semantic_review:` document is recorded as a blocked reviewer failure.

Automatic patch application is not part of the MVP path. If a proposed patch or fix plan is produced, `aich approve <session-id>` refuses by default and asks the user to choose either `aich session rework <session-id> --review <semantic-review-id>` or `aich approve <session-id> --accept-current`. Rework runs the configured provider in the existing session worktree with the fix artifacts as input, then the resulting session changes must go through `complete`, `preflight`, `review`, `approve`, and `apply` again.

## Implementation boundaries

Semantic review is being split across crates in small steps:

- `aich-llm`: report contract structs, proposed patch model, command/LLM YAML output parsing, review input model, related manifest model, diff patch context model, provider-facing review input rendering, stored semantic-review YAML report rendering, and proposed-fix-plan artifact content rendering
- `aich-cli::semantic_review::adapter`: local, command, and LLM adapter process execution
- `aich-cli::semantic_review::config`: `.aichestra/config.yaml` semantic review settings
- `aich-cli::semantic_review::report`: local deterministic review construction and reviewer failure reports
- `aich-cli::semantic_review`: ledger reads/writes, artifact file placement, and adapter orchestration

The external review contract remains the same `semantic_review:` YAML report shape. The split does not make the reviewer authoritative; it still cannot approve, apply, reorder the queue, or bypass sandbox checks.

## Local reviewer risk heuristics

The local MVP reviewer is intentionally conservative:

- `blocked`: missing manifest artifact, manifest hash drift, changed-file evidence missing from the manifest, missing changed-file evidence, or failed required check evidence
- `high`: shared API, schema, config, dependency, migration, type, `lib.rs`, or `mod.rs` surfaces changed
- `medium`: no direct blocker found, but the Change Manifest is generated from diff metadata, semantic impact is not inferred, or optional checks failed
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
- exact verified commit/tree that approval would target
- changed files and check summary for the verified candidate

The user should approve with awareness of semantic risk.

`aich approve <session-id>` can approve `low`, `medium`, or `high` semantic review results, because those risks remain advisory. A `blocked` semantic review marks the merge attempt blocked and must be resolved before approval.

When the latest review includes a proposed patch, approval requires `--accept-current` to make clear that the operator is approving the already verified tree without applying the reviewer proposal.

If the human reviewer decides the verified candidate should not continue, `aich reject <session-id> --reason TEXT` records that decision and blocks the verified attempt. The recovery path is `aich session reopen <session-id>`, revise the session worktree, then repeat `session complete -> preflight -> review -> approve -> apply`. Reopen does not apply reviewer suggestions automatically and does not carry the old verified tree forward.
