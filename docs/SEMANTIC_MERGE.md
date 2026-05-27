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

MVP should start with semantic review report generation only.

Automatic patch application is optional and should remain behind explicit human approval. If a proposed patch is applied, the resulting tree becomes a new candidate and must go through checks again.

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
