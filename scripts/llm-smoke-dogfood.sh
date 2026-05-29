#!/usr/bin/env bash
set -euo pipefail

log() {
  printf '\n==> %s\n' "$*"
}

die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

print_cmd() {
  printf '+'
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
  printf '\n'
}

run() {
  print_cmd "$@"
  "$@"
}

LAST_LOG=""
run_log() {
  local name="$1"
  shift
  LAST_LOG="$LOG_DIR/$name.txt"
  print_cmd "$@" | tee "$LAST_LOG"
  "$@" 2>&1 | tee -a "$LAST_LOG"
  local status=${PIPESTATUS[0]}
  if [[ "$status" -ne 0 ]]; then
    die "command failed with status $status; see $LAST_LOG"
  fi
}

expect_fail_log() {
  local name="$1"
  shift
  LAST_LOG="$LOG_DIR/$name.txt"
  print_cmd "$@" | tee "$LAST_LOG"
  set +e
  "$@" 2>&1 | tee -a "$LAST_LOG"
  local status=${PIPESTATUS[0]}
  set -e
  if [[ "$status" -eq 0 ]]; then
    die "command unexpectedly succeeded; see $LAST_LOG"
  fi
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command '$1' was not found"
}

require_clean_worktree() {
  if [[ "${AICH_SMOKE_ALLOW_DIRTY:-0}" == "1" ]]; then
    return
  fi

  if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
    die "repo has uncommitted changes; commit/stash them or set AICH_SMOKE_ALLOW_DIRTY=1"
  fi
}

require_log_contains() {
  local file="$1"
  local pattern="$2"
  grep -F "$pattern" "$file" >/dev/null || die "expected '$pattern' in $file"
}

require_file_contains() {
  local file="$1"
  local pattern="$2"
  grep -F "$pattern" "$file" >/dev/null || die "expected '$pattern' in $file"
}

require_equal() {
  local left="$1"
  local right="$2"
  local message="$3"
  if [[ "$left" != "$right" ]]; then
    die "$message: expected '$left', got '$right'"
  fi
}

require_session_changed_only_tmp() {
  local session_id="$1"
  local status
  status="$(git -C ".aichestra/worktrees/$session_id" status --short)"
  if [[ "$status" != " M tmp.md" ]]; then
    printf '%s\n' "$status" >&2
    die "session $session_id changed files other than tmp.md"
  fi
}

extract_field() {
  local file="$1"
  local prefix="$2"
  awk -v prefix="$prefix" 'index($0, prefix) == 1 {print substr($0, length(prefix) + 1); exit}' "$file"
}

extract_session_id() {
  awk '/^Started session / {print $3; exit}' "$1"
}

extract_report_path() {
  extract_field "$1" "Report: "
}

extract_manifest_path() {
  extract_field "$1" "Change Manifest: "
}

extract_main_before() {
  extract_field "$1" "Main before: "
}

extract_sandbox_path() {
  extract_field "$1" "Sandbox: "
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

require_command git
require_command cargo
require_command codex
require_command perl
require_clean_worktree

AICH_BIN="${AICH_BIN:-$REPO_ROOT/target/debug/aich}"
if [[ ! -x "$AICH_BIN" ]]; then
  log "Building aich CLI"
  run cargo build -p aich-cli --manifest-path "$REPO_ROOT/Cargo.toml"
fi
[[ -x "$AICH_BIN" ]] || die "aich binary was not found at $AICH_BIN"

if [[ -n "${AICH_SMOKE_ROOT:-}" ]]; then
  SMOKE_ROOT="$AICH_SMOKE_ROOT"
  mkdir -p "$SMOKE_ROOT"
else
  SMOKE_ROOT="$(mktemp -d /tmp/aich-llm-smoke.XXXXXX)"
fi

SMOKE_REPO="$SMOKE_ROOT/repo"
LOG_DIR="$SMOKE_ROOT/logs"
mkdir -p "$LOG_DIR"

cleanup() {
  local status=$?
  if [[ "$status" -eq 0 && "${AICH_SMOKE_KEEP:-1}" == "0" ]]; then
    rm -rf "$SMOKE_ROOT"
  else
    printf '\nSmoke repo: %s\nSmoke logs: %s\n' "$SMOKE_REPO" "$LOG_DIR"
  fi
}
trap cleanup EXIT

log "Creating smoke clone"
run git clone "$REPO_ROOT" "$SMOKE_REPO"

cd "$SMOKE_REPO"
SMOKE_MAIN_BRANCH="$(git branch --show-current)"
[[ -n "$SMOKE_MAIN_BRANCH" ]] || die "smoke clone is detached; expected a branch checkout"

log "Configuring fixture, LLM Change Manifest, and LLM semantic review"
SMOKE_MAIN_BRANCH="$SMOKE_MAIN_BRANCH" perl -0pi -e \
  's/(^git:\n  main_branch: ).*/$1$ENV{SMOKE_MAIN_BRANCH}/m' \
  .aichestra/config.yaml
perl -0pi -e \
  's/^manifest:\n(?:  .*\n)*\nchecks:/manifest:\n  required: true\n  validate_against_diff: true\n  warn_on_context_hash_change: true\n  block_on_manifest_diff_mismatch: false\n  adapter: llm\n  generator_provider: codex\n  generator_id: codex_llm_smoke_manifest_generator\n  prompt_path: .aichestra\/prompts\/change-manifest.md\n  timeout_seconds: 600\n\nchecks:/m' \
  .aichestra/config.yaml
perl -0pi -e \
  's/^semantic_review:\n(?:  adapter: .*\n)?(?:  reviewer_provider: .*\n)?(?:  reviewer_id: .*\n)?/semantic_review:\n  adapter: llm\n  reviewer_provider: codex\n  reviewer_id: codex_llm_smoke_reviewer\n/m' \
  .aichestra/config.yaml
cat >tmp.md <<'EOF'
# Aichestra LLM dogfood tmp

Session A area:
LLM_A_STATUS: base

Context spacer:
- This line should remain unchanged.
- This line should remain unchanged.
- This line should remain unchanged.
- This line should remain unchanged.

Session B area:
LLM_B_STATUS: base
EOF
run git add .aichestra/config.yaml tmp.md
run git -c user.name="Aichestra Smoke" \
  -c user.email="aichestra-smoke@example.invalid" \
  commit -m "test: configure llm smoke dogfood"

log "Initializing Aichestra runtime"
run_log init "$AICH_BIN" init

log "Starting two sessions from the same base"
run_log start-a "$AICH_BIN" session start \
  --goal "Use the actual Codex provider to edit tmp.md. Change only the line 'LLM_A_STATUS: base' to 'LLM_A_STATUS: completed by actual Codex session A'. Do not edit any other file or line." \
  --provider codex \
  --target tmp.md
SESSION_A="$(extract_session_id "$LAST_LOG")"
[[ -n "$SESSION_A" ]] || die "failed to parse session A id"

run_log start-b "$AICH_BIN" session start \
  --goal "Use the actual Codex provider to edit tmp.md. Change only the line 'LLM_B_STATUS: base' to 'LLM_B_STATUS: completed by actual Codex session B'. Do not edit any other file or line." \
  --provider codex \
  --target tmp.md
SESSION_B="$(extract_session_id "$LAST_LOG")"
[[ -n "$SESSION_B" ]] || die "failed to parse session B id"

log "Running actual Codex worker sessions"
run_log run-a "$AICH_BIN" session run "$SESSION_A"
require_file_contains ".aichestra/worktrees/$SESSION_A/tmp.md" \
  "LLM_A_STATUS: completed by actual Codex session A"
require_session_changed_only_tmp "$SESSION_A"
run_log run-b "$AICH_BIN" session run "$SESSION_B"
require_file_contains ".aichestra/worktrees/$SESSION_B/tmp.md" \
  "LLM_B_STATUS: completed by actual Codex session B"
require_session_changed_only_tmp "$SESSION_B"

log "Completing both LLM-produced candidates with actual Codex manifest generation"
run_log complete-a "$AICH_BIN" session complete "$SESSION_A"
MANIFEST_A="$(extract_manifest_path "$LAST_LOG")"
[[ -n "$MANIFEST_A" ]] || die "failed to parse session A manifest path"
require_log_contains "$LAST_LOG" "Manifest status: generated_by_llm"
require_file_contains "$MANIFEST_A" "validation_status: generated_by_llm"
require_file_contains "$MANIFEST_A" "generator_id: codex_llm_smoke_manifest_generator"
require_file_contains "$MANIFEST_A" "generator_adapter: llm"
require_file_contains "$MANIFEST_A" "tmp.md"
run_log complete-b "$AICH_BIN" session complete "$SESSION_B"
MANIFEST_B="$(extract_manifest_path "$LAST_LOG")"
[[ -n "$MANIFEST_B" ]] || die "failed to parse session B manifest path"
require_log_contains "$LAST_LOG" "Manifest status: generated_by_llm"
require_file_contains "$MANIFEST_B" "validation_status: generated_by_llm"
require_file_contains "$MANIFEST_B" "generator_id: codex_llm_smoke_manifest_generator"
require_file_contains "$MANIFEST_B" "generator_adapter: llm"
require_file_contains "$MANIFEST_B" "tmp.md"
run_log queue-enqueued "$AICH_BIN" queue
require_log_contains "$LAST_LOG" "$SESSION_A [enqueued]"
require_log_contains "$LAST_LOG" "$SESSION_B [enqueued]"

log "Preflighting queue head and proving the queue is sequential"
run_log preflight-a "$AICH_BIN" preflight "$SESSION_A"
expect_fail_log preflight-b-before-a "$AICH_BIN" preflight "$SESSION_B"
require_log_contains "$LAST_LOG" "while session '$SESSION_A' is verified"

log "Running actual Codex LLM semantic review for session A"
run_log review-a-initial "$AICH_BIN" review "$SESSION_A"
REPORT_A="$(extract_report_path "$LAST_LOG")"
[[ -n "$REPORT_A" ]] || die "failed to parse session A review report path"
require_file_contains "$REPORT_A" "llm_executed: true"
require_file_contains "$REPORT_A" 'reviewer: "codex_llm_smoke_reviewer"'

log "Regenerating session A manifest with actual Codex and proving the prior review is stale"
cp .aichestra/config.yaml "$LOG_DIR/config-before-regenerate-a.yaml"
perl -0pi -e \
  's/generator_id: codex_llm_smoke_manifest_generator/generator_id: codex_llm_smoke_manifest_regenerator/' \
  .aichestra/config.yaml
run_log regenerate-a "$AICH_BIN" manifest regenerate "$SESSION_A"
require_log_contains "$LAST_LOG" "Regenerated Change Manifest"
require_log_contains "$LAST_LOG" "Ledger status: generated_by_llm"
cp "$LOG_DIR/config-before-regenerate-a.yaml" .aichestra/config.yaml
run_log manifest-show-a-regenerated "$AICH_BIN" manifest show "$SESSION_A"
require_log_contains "$LAST_LOG" "validation_status: generated_by_llm"
require_log_contains "$LAST_LOG" "generator_id: codex_llm_smoke_manifest_regenerator"
require_log_contains "$LAST_LOG" "generator_adapter: llm"
require_log_contains "$LAST_LOG" "change-manifest-input.md (present)"
require_log_contains "$LAST_LOG" "change-manifest-stdout.txt (present)"
expect_fail_log approve-a-stale-review "$AICH_BIN" approve "$SESSION_A"
require_log_contains "$LAST_LOG" "stale"
require_log_contains "$LAST_LOG" "manifest_changed"

log "Rerunning actual Codex LLM semantic review for session A after manifest regenerate"
run_log review-a "$AICH_BIN" review "$SESSION_A"
REPORT_A="$(extract_report_path "$LAST_LOG")"
[[ -n "$REPORT_A" ]] || die "failed to parse regenerated session A review report path"
require_file_contains "$REPORT_A" "llm_executed: true"
require_file_contains "$REPORT_A" 'reviewer: "codex_llm_smoke_reviewer"'
run_log approve-a "$AICH_BIN" approve "$SESSION_A"
run_log apply-a "$AICH_BIN" apply "$SESSION_A"
APPLIED_A="$(git rev-parse HEAD)"

log "Preflighting session B against the newly applied main"
run_log preflight-b "$AICH_BIN" preflight "$SESSION_B"
MAIN_BEFORE_B="$(extract_main_before "$LAST_LOG")"
require_equal "$APPLIED_A" "$MAIN_BEFORE_B" "session B preflight did not use the applied session A commit as main_before"
SANDBOX_B="$(extract_sandbox_path "$LAST_LOG")"
[[ -n "$SANDBOX_B" ]] || die "failed to parse session B sandbox path"
require_file_contains "$SANDBOX_B/tmp.md" \
  "LLM_A_STATUS: completed by actual Codex session A"
require_file_contains "$SANDBOX_B/tmp.md" \
  "LLM_B_STATUS: completed by actual Codex session B"

log "Running actual Codex LLM semantic review for session B"
run_log review-b "$AICH_BIN" review "$SESSION_B"
REPORT_B="$(extract_report_path "$LAST_LOG")"
[[ -n "$REPORT_B" ]] || die "failed to parse session B review report path"
require_file_contains "$REPORT_B" "llm_executed: true"
require_file_contains "$REPORT_B" 'reviewer: "codex_llm_smoke_reviewer"'
run_log approve-b "$AICH_BIN" approve "$SESSION_B"
run_log apply-b "$AICH_BIN" apply "$SESSION_B"

log "Verifying final queue, tree, and file content"
run_log queue-final "$AICH_BIN" queue
require_log_contains "$LAST_LOG" "No queued candidates."
require_file_contains tmp.md "LLM_A_STATUS: completed by actual Codex session A"
require_file_contains tmp.md "LLM_B_STATUS: completed by actual Codex session B"
if [[ -n "$(git status --porcelain)" ]]; then
  git status --short
  die "smoke repo ended dirty"
fi

printf '\nLLM smoke dogfood passed.\n'
printf 'Session A: %s\n' "$SESSION_A"
printf 'Session B: %s\n' "$SESSION_B"
printf 'Final commit: %s\n' "$(git rev-parse HEAD)"
printf 'Final tree: %s\n' "$(git rev-parse HEAD^{tree})"
