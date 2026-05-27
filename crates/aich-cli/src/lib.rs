use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use aich_core::clock::now_millis;
#[cfg(test)]
use aich_core::CheckResultStatus;
use aich_core::{
    assert_verified_candidate_can_apply, Approval, ChangeManifest, ChangedFile, CheckResult,
    ContextSnapshot, EventName, MergeAttempt, MergeAttemptStatus, NewEvent, Operator, OperatorRole,
    PatchSet, QueueLock, SemanticReview, SemanticRiskLevel, Session, SessionStatus,
};
use aich_git::{
    ApplyVerifiedCommitRequest, CleanupSessionWorktreeOutcome, CleanupSessionWorktreeRequest,
    CompleteSessionWorktreeOutcome, CompleteSessionWorktreeRequest, CreateWorktreeRequest,
    GitRepository, NativeGitWorktreeManager, PreflightBlocked, PreflightOutcome, PreflightRequest,
    PreflightRunner, PreflightVerified, SessionWorktreeCleaner, SessionWorktreeCompleter,
    VerifiedCommitApplier, WorktreeError, WorktreeManager,
};
use aich_ledger::{Ledger, MergeAttemptResultUpdate};

mod checks;
mod command_line;
mod config;
mod formatting;
mod manifest;
mod options;
mod queue;
mod semantic_review;

use checks::{check_commands_from_config, persist_preflight_checks};
use config::{main_branch_from_config, main_branch_ref, DEFAULT_CONFIG};
use formatting::{
    comparable_path, display_path_for_ledger, json_escape, path_from_ledger, sha256_hex,
    short_hash, yes_no,
};
#[cfg(test)]
use manifest::{changed_files_missing_from_manifest, parse_manifest_diff_evidence};
use manifest::{context_snapshot_hash, render_change_manifest};
use options::*;
use queue::{
    format_duration_ms, is_queue_lock_stale, queue_entries, queue_lock_age_ms, queue_next_action,
    render_queue, run_queue_unlock,
};
#[cfg(test)]
use semantic_review::{
    build_local_semantic_review_report, codex_semantic_review_command, run_review_with_adapter,
    LocalSemanticReviewReport, SemanticReviewAdapter, SemanticReviewAdapterRequest,
};
use semantic_review::{ensure_attempt_can_be_reviewed, run_review_with};

static SESSION_COUNTER: AtomicU64 = AtomicU64::new(1);
static ARTIFACT_COUNTER: AtomicU64 = AtomicU64::new(1);
static MERGE_ATTEMPT_COUNTER: AtomicU64 = AtomicU64::new(1);
static SEMANTIC_REVIEW_COUNTER: AtomicU64 = AtomicU64::new(1);
static APPROVAL_COUNTER: AtomicU64 = AtomicU64::new(1);
static QUEUE_LOCK_COUNTER: AtomicU64 = AtomicU64::new(1);

pub(crate) const MILLIS_PER_SECOND: i64 = 1_000;
pub(crate) const QUEUE_LOCK_STALE_AFTER_MS: i64 = 30 * 60 * MILLIS_PER_SECOND;
const DEFAULT_OPERATOR_ID: &str = "local-user";
const DEFAULT_OPERATOR_NAME: &str = "Local User";
pub(crate) const CHANGE_MANIFEST_VALIDATION_STATUS: &str = "generated_from_diff";
const PREFLIGHT_APPLY_STRATEGY: &str = "merge_no_ff_commit";
pub(crate) const LOCAL_SEMANTIC_REVIEWER: &str = "local_mvp_static_reviewer";
pub(crate) const COMMAND_SEMANTIC_REVIEWER: &str = "command_semantic_review_adapter";
pub(crate) const LLM_SEMANTIC_REVIEWER: &str = "llm_semantic_review_adapter";
pub(crate) const MERGE_QUEUE_LOCK_NAME: &str = "merge-queue";
const CONTEXT_SNAPSHOT_FILES: &[&str] = &[
    "AGENTS.md",
    "CLAUDE.md",
    ".aichestra/config.yaml",
    ".aichestra/prompts/change-manifest.md",
    ".aichestra/prompts/semantic-merge-review.md",
];

#[derive(Debug)]
pub enum CliError {
    Io(std::io::Error),
    Git(WorktreeError),
    Ledger(aich_ledger::LedgerError),
    Usage(String),
}

impl Display for CliError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(error) => write!(f, "io error: {error}"),
            Self::Git(error) => write!(f, "{error}"),
            Self::Ledger(error) => write!(f, "{error}"),
            Self::Usage(message) => write!(f, "{message}"),
        }
    }
}

impl Error for CliError {}

impl From<std::io::Error> for CliError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<aich_ledger::LedgerError> for CliError {
    fn from(value: aich_ledger::LedgerError) -> Self {
        Self::Ledger(value)
    }
}

impl From<WorktreeError> for CliError {
    fn from(value: WorktreeError) -> Self {
        Self::Git(value)
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct InitResult {
    pub repo_root: PathBuf,
    pub db_path: PathBuf,
    pub config_created: bool,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct SessionStartResult {
    pub session: Session,
    pub operator: Operator,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct SessionCompleteResult {
    pub session: Session,
    pub operator: Operator,
    pub patch_set: Option<PatchSet>,
    pub changed_files: Vec<ChangedFile>,
    pub context_snapshot: Option<ContextSnapshot>,
    pub change_manifest: Option<ChangeManifest>,
    pub manifest_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct PreflightRunResult {
    pub merge_attempt: MergeAttempt,
    pub operator: Operator,
    pub sandbox_path: PathBuf,
    pub check_results: Vec<CheckResult>,
    pub blocked_reason: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct ReviewRunResult {
    pub semantic_review: SemanticReview,
    pub merge_attempt: MergeAttempt,
    pub operator: Operator,
    pub report_path: PathBuf,
    pub summary: String,
    pub required_actions: Vec<String>,
    pub suggested_tests: Vec<String>,
    pub blocked: bool,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct ApproveRunResult {
    pub approval: Approval,
    pub merge_attempt: MergeAttempt,
    pub operator: Operator,
    pub semantic_reviews: Vec<SemanticReview>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct ApplyRunResult {
    pub merge_attempt: MergeAttempt,
    pub approval: Approval,
    pub operator: Operator,
    pub applied_commit_id: String,
    pub applied_tree_id: String,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct QueueUnlockResult {
    pub released_lock: Option<QueueLock>,
    pub stale: bool,
    pub age_ms: Option<i64>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct SessionCleanupResult {
    pub session: Session,
    pub latest_attempt: MergeAttempt,
    pub cleanup: CleanupSessionWorktreeOutcome,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct SessionPruneResult {
    pub cleaned: Vec<SessionCleanupResult>,
    pub skipped: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum DoctorSeverity {
    Ok,
    Warning,
    Error,
}

impl DoctorSeverity {
    fn as_str(self) -> &'static str {
        match self {
            Self::Ok => "ok",
            Self::Warning => "warning",
            Self::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct DoctorCheck {
    severity: DoctorSeverity,
    name: String,
    detail: String,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct DoctorRunResult {
    repo_root: PathBuf,
    db_path: PathBuf,
    checks: Vec<DoctorCheck>,
}

impl DoctorRunResult {
    fn warning_count(&self) -> usize {
        self.checks
            .iter()
            .filter(|check| check.severity == DoctorSeverity::Warning)
            .count()
    }

    fn error_count(&self) -> usize {
        self.checks
            .iter()
            .filter(|check| check.severity == DoctorSeverity::Error)
            .count()
    }

    fn result_label(&self) -> &'static str {
        if self.error_count() > 0 {
            "error"
        } else if self.warning_count() > 0 {
            "warning"
        } else {
            "ok"
        }
    }
}

pub fn run_with_cwd<I, S, W>(args: I, cwd: &Path, out: &mut W) -> Result<(), CliError>
where
    I: IntoIterator<Item = S>,
    S: Into<String>,
    W: Write,
{
    let args = normalize_args(args);
    match args.first().map(String::as_str) {
        Some("init") => {
            let options = parse_init_options(&args[1..], cwd)?;
            let result = init_repo(&options)?;
            writeln!(
                out,
                "Initialized Aichestra repository at {}",
                result.repo_root.display()
            )?;
            writeln!(out, "Ledger: {}", result.db_path.display())?;
            writeln!(out, "Default operator: {DEFAULT_OPERATOR_ID}")?;
            if result.config_created {
                writeln!(out, "Created .aichestra/config.yaml")?;
            }
            Ok(())
        }
        Some("session") => run_session_command(&args[1..], cwd, out),
        Some("auth") => run_auth_command(&args[1..], cwd, out),
        Some("preflight") => {
            let options = parse_preflight_options(&args[1..], cwd)?;
            let git = NativeGitWorktreeManager;
            let result = run_preflight_with(&options, &git, &git)?;
            writeln!(out, "Preflight {}", result.merge_attempt.status.as_str())?;
            writeln!(out, "Session: {}", result.merge_attempt.session_id)?;
            writeln!(out, "Merge attempt: {}", result.merge_attempt.id)?;
            writeln!(out, "Operator: {}", result.operator.id)?;
            writeln!(out, "Sandbox: {}", result.sandbox_path.display())?;
            writeln!(
                out,
                "Main before: {}",
                result.merge_attempt.main_before_commit
            )?;
            writeln!(out, "Candidate: {}", result.merge_attempt.candidate_commit)?;
            if let Some(tree_id) = result.merge_attempt.verified_tree_id.as_deref() {
                writeln!(out, "Verified tree: {tree_id}")?;
            }
            if let Some(commit_id) = result.merge_attempt.verified_commit_id.as_deref() {
                writeln!(out, "Verified commit: {commit_id}")?;
            }
            writeln!(out, "Checks: {}", result.check_results.len())?;
            if let Some(reason) = result.blocked_reason.as_deref() {
                writeln!(out, "Blocked reason: {reason}")?;
            }
            Ok(())
        }
        Some("review") => {
            let options = parse_review_options(&args[1..], cwd)?;
            let result = run_review_with(&options)?;
            writeln!(out, "Review {}", result.semantic_review.risk_level.as_str())?;
            writeln!(out, "Session: {}", result.merge_attempt.session_id)?;
            writeln!(out, "Merge attempt: {}", result.merge_attempt.id)?;
            writeln!(out, "Semantic review: {}", result.semantic_review.id)?;
            writeln!(out, "Operator: {}", result.operator.id)?;
            writeln!(out, "Report: {}", result.report_path.display())?;
            writeln!(out, "Summary: {}", result.summary)?;
            writeln!(out, "Required actions: {}", result.required_actions.len())?;
            writeln!(out, "Suggested tests: {}", result.suggested_tests.len())?;
            if result.blocked {
                writeln!(out, "Blocked: semantic_review")?;
            }
            Ok(())
        }
        Some("approve") => {
            let options = parse_approve_options(&args[1..], cwd)?;
            let git = NativeGitWorktreeManager;
            let result = run_approve_with(&options, &git)?;
            writeln!(out, "Approved {}", result.merge_attempt.session_id)?;
            writeln!(out, "Approval: {}", result.approval.id)?;
            writeln!(out, "Merge attempt: {}", result.merge_attempt.id)?;
            writeln!(out, "Operator: {}", result.operator.id)?;
            writeln!(
                out,
                "Approved tree: {}",
                result.approval.approved_verified_tree_id
            )?;
            writeln!(
                out,
                "Approved commit: {}",
                result.approval.approved_verified_commit_id
            )?;
            writeln!(
                out,
                "Semantic risk: {}",
                result
                    .merge_attempt
                    .semantic_risk_level
                    .as_deref()
                    .unwrap_or("unknown")
            )?;
            Ok(())
        }
        Some("apply") => {
            let options = parse_apply_options(&args[1..], cwd)?;
            let git = NativeGitWorktreeManager;
            let result = run_apply_with(&options, &git, &git)?;
            writeln!(out, "Applied {}", result.merge_attempt.session_id)?;
            writeln!(out, "Merge attempt: {}", result.merge_attempt.id)?;
            writeln!(out, "Approval: {}", result.approval.id)?;
            writeln!(out, "Operator: {}", result.operator.id)?;
            writeln!(out, "Applied commit: {}", result.applied_commit_id)?;
            writeln!(out, "Applied tree: {}", result.applied_tree_id)?;
            Ok(())
        }
        Some("status") => {
            let options = parse_status_options(&args[1..], cwd)?;
            render_status(&options, out)
        }
        Some("doctor") => {
            let options = parse_doctor_options(&args[1..], cwd)?;
            let result = run_doctor(&options)?;
            render_doctor(&result, out)
        }
        Some("queue") => run_queue_command(&args[1..], cwd, out),
        Some("-h") | Some("--help") | None => {
            write_usage(out)?;
            Ok(())
        }
        Some(command) => Err(CliError::Usage(format!(
            "unknown command '{command}'\n\n{}",
            usage_text()
        ))),
    }
}

fn run_queue_command<W: Write>(args: &[String], cwd: &Path, out: &mut W) -> Result<(), CliError> {
    match args.first().map(String::as_str) {
        Some("unlock") => {
            let options = parse_queue_unlock_options(&args[1..], cwd)?;
            let result = run_queue_unlock(&options)?;
            match result.released_lock {
                Some(lock) => {
                    writeln!(out, "Unlocked queue lock {}", lock.name)?;
                    writeln!(out, "Holder: {}", lock.holder_id)?;
                    writeln!(out, "Operation: {}", lock.operation)?;
                    writeln!(
                        out,
                        "Session: {}",
                        lock.session_id.as_deref().unwrap_or("-")
                    )?;
                    if let Some(age_ms) = result.age_ms {
                        writeln!(out, "Age: {}", format_duration_ms(age_ms))?;
                    }
                    writeln!(out, "Stale: {}", if result.stale { "yes" } else { "no" })?;
                }
                None => {
                    writeln!(out, "Queue lock already free")?;
                }
            }
            Ok(())
        }
        _ => {
            let options = parse_queue_options(args, cwd)?;
            render_queue(&options, out)
        }
    }
}

fn run_session_command<W: Write>(args: &[String], cwd: &Path, out: &mut W) -> Result<(), CliError> {
    match args.first().map(String::as_str) {
        Some("start") => {
            let options = parse_session_start_options(&args[1..], cwd)?;
            let git = NativeGitWorktreeManager;
            let result = start_session_with(&options, &git, &git)?;
            writeln!(out, "Started session {}", result.session.id)?;
            writeln!(out, "Operator: {}", result.operator.id)?;
            writeln!(out, "Branch: {}", result.session.branch)?;
            writeln!(out, "Worktree: {}", result.session.worktree_path)?;
            writeln!(out, "Base commit: {}", result.session.base_commit)?;
            if let Some(target_path) = result.session.target_path.as_deref() {
                writeln!(out, "Target: {target_path}")?;
            }
            Ok(())
        }
        Some("complete") => {
            let options = parse_session_complete_options(&args[1..], cwd)?;
            let git = NativeGitWorktreeManager;
            let result = complete_session_with(&options, &git)?;
            writeln!(out, "Completed session {}", result.session.id)?;
            writeln!(out, "Operator: {}", result.operator.id)?;
            writeln!(out, "Status: {}", result.session.status.as_str())?;
            if let Some(head_commit) = result.session.head_commit.as_deref() {
                writeln!(out, "Head commit: {head_commit}")?;
            }
            if let Some(patch_set) = result.patch_set.as_ref() {
                writeln!(out, "Patch set: {}", patch_set.id)?;
                writeln!(out, "Changed files: {}", result.changed_files.len())?;
            } else {
                writeln!(out, "No changes detected; session was not enqueued.")?;
            }
            if let Some(manifest_path) = result.manifest_path.as_ref() {
                writeln!(out, "Change Manifest: {}", manifest_path.display())?;
            }
            Ok(())
        }
        Some("cleanup") => {
            let options = parse_session_cleanup_options(&args[1..], cwd)?;
            let git = NativeGitWorktreeManager;
            let result = cleanup_session_with(&options, &git)?;
            render_session_cleanup_result(&result, out)
        }
        Some("prune") => {
            let options = parse_session_prune_options(&args[1..], cwd)?;
            let git = NativeGitWorktreeManager;
            let result = prune_sessions_with(&options, &git)?;
            writeln!(out, "Pruned sessions: {}", result.cleaned.len())?;
            writeln!(out, "Skipped sessions: {}", result.skipped)?;
            for cleaned in &result.cleaned {
                render_session_cleanup_result(cleaned, out)?;
            }
            Ok(())
        }
        Some("-h") | Some("--help") | None => Err(CliError::Usage(usage_text())),
        Some(command) => Err(CliError::Usage(format!(
            "unknown session command '{command}'\n\n{}",
            usage_text()
        ))),
    }
}

fn run_auth_command<W: Write>(args: &[String], cwd: &Path, out: &mut W) -> Result<(), CliError> {
    match args.first().map(String::as_str) {
        Some("whoami") => {
            let options = parse_auth_whoami_options(&args[1..], cwd)?;
            let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
            let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;

            writeln!(out, "Operator: {}", operator.id)?;
            writeln!(out, "Name: {}", operator.display_name)?;
            writeln!(out, "Role: {}", operator.role.as_str())?;
            writeln!(out, "Status: {}", operator.status.as_str())?;
            Ok(())
        }
        Some("operator") => run_auth_operator_command(&args[1..], cwd, out),
        Some("-h") | Some("--help") | None => Err(CliError::Usage(usage_text())),
        Some(command) => Err(CliError::Usage(format!(
            "unknown auth command '{command}'\n\n{}",
            usage_text()
        ))),
    }
}

fn render_session_cleanup_result<W: Write>(
    result: &SessionCleanupResult,
    out: &mut W,
) -> Result<(), CliError> {
    writeln!(out, "Cleaned session {}", result.session.id)?;
    writeln!(out, "Merge attempt: {}", result.latest_attempt.id)?;
    writeln!(
        out,
        "Session worktree removed: {}",
        yes_no(result.cleanup.session_worktree_removed)
    )?;
    writeln!(
        out,
        "Branch deleted: {}",
        yes_no(result.cleanup.branch_deleted)
    )?;
    writeln!(
        out,
        "Sandbox worktrees removed: {}",
        result.cleanup.sandbox_worktrees_removed.len()
    )?;
    for sandbox_path in &result.cleanup.sandbox_worktrees_removed {
        writeln!(out, "- {}", sandbox_path.display())?;
    }
    Ok(())
}

fn run_auth_operator_command<W: Write>(
    args: &[String],
    cwd: &Path,
    out: &mut W,
) -> Result<(), CliError> {
    match args.first().map(String::as_str) {
        Some("add") => {
            let options = parse_operator_add_options(&args[1..], cwd)?;
            let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
            let operator = upsert_operator_from_options(&ledger, &options)?;

            writeln!(out, "Saved operator {}", operator.id)?;
            writeln!(out, "Name: {}", operator.display_name)?;
            writeln!(out, "Role: {}", operator.role.as_str())?;
            writeln!(out, "Status: {}", operator.status.as_str())?;
            Ok(())
        }
        Some("list") => {
            let options = parse_operator_list_options(&args[1..], cwd)?;
            let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
            let operators = ledger.list_operators()?;

            writeln!(out, "Operators: {}", operators.len())?;
            for operator in operators {
                writeln!(
                    out,
                    "- {} [{} / {}] {}",
                    operator.id,
                    operator.role.as_str(),
                    operator.status.as_str(),
                    operator.display_name
                )?;
            }
            Ok(())
        }
        Some("-h") | Some("--help") | None => Err(CliError::Usage(usage_text())),
        Some(command) => Err(CliError::Usage(format!(
            "unknown auth operator command '{command}'\n\n{}",
            usage_text()
        ))),
    }
}

pub(crate) fn ledger_path(repo_root: &Path, db_path: &Option<PathBuf>) -> PathBuf {
    db_path
        .clone()
        .unwrap_or_else(|| repo_root.join(".aichestra").join("aichestra.db"))
}

pub(crate) fn open_existing_ledger(
    repo_root: &Path,
    db_path: &Option<PathBuf>,
) -> Result<(PathBuf, Ledger), CliError> {
    let db_path = ledger_path(repo_root, db_path);
    if !db_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra ledger not found at {}; run `aich init` first",
            db_path.display()
        )));
    }

    let ledger = Ledger::open(&db_path)?;
    Ok((db_path, ledger))
}

fn ensure_default_operator(ledger: &Ledger) -> Result<Operator, CliError> {
    if let Some(operator) = ledger.get_operator(DEFAULT_OPERATOR_ID)? {
        return Ok(operator);
    }

    let now = now_millis();
    let operator = Operator::new(
        DEFAULT_OPERATOR_ID,
        DEFAULT_OPERATOR_NAME,
        OperatorRole::Owner,
        now,
    )
    .map_err(CliError::Usage)?;
    ledger.upsert_operator(&operator)?;
    Ok(operator)
}

pub(crate) fn resolve_active_operator(
    ledger: &Ledger,
    requested_operator_id: Option<&str>,
) -> Result<Operator, CliError> {
    let operator_id = match requested_operator_id {
        Some(value) if value.trim().is_empty() => {
            return Err(CliError::Usage("--operator must not be empty".to_string()));
        }
        Some(value) => value.trim().to_string(),
        None => DEFAULT_OPERATOR_ID.to_string(),
    };

    let operator = if operator_id == DEFAULT_OPERATOR_ID {
        ensure_default_operator(ledger)?
    } else {
        ledger.get_operator(&operator_id)?.ok_or_else(|| {
            CliError::Usage(format!(
                "operator '{operator_id}' does not exist; run `aich auth operator add --id {operator_id}` first"
            ))
        })?
    };

    if !operator.is_active() {
        return Err(CliError::Usage(format!(
            "operator '{}' is disabled",
            operator.id
        )));
    }

    Ok(operator)
}

fn upsert_operator_from_options(
    ledger: &Ledger,
    options: &OperatorAddOptions,
) -> Result<Operator, CliError> {
    let now = now_millis();
    let existing = ledger.get_operator(&options.id)?;
    let created_at_ms = existing
        .as_ref()
        .map(|operator| operator.created_at_ms)
        .unwrap_or(now);
    let display_name = options
        .display_name
        .clone()
        .or_else(|| {
            existing
                .as_ref()
                .map(|operator| operator.display_name.clone())
        })
        .unwrap_or_else(|| options.id.clone());

    let mut operator = Operator::new(
        options.id.clone(),
        display_name,
        options.role,
        created_at_ms,
    )
    .map_err(CliError::Usage)?;
    operator.updated_at_ms = now;
    ledger.upsert_operator(&operator)?;
    Ok(operator)
}

fn render_status<W: Write>(options: &StatusOptions, out: &mut W) -> Result<(), CliError> {
    let db_path = ledger_path(&options.repo_root, &options.db_path);
    if !db_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra ledger not found at {}; run `aich init` first",
            db_path.display()
        )));
    }

    let ledger = Ledger::open(&db_path)?;
    let operators = ledger.list_operators()?;
    let sessions = ledger.list_sessions()?;
    let event_count = ledger.event_count()?;
    let recent_events = ledger.recent_events(options.recent_events_limit)?;

    writeln!(out, "Aichestra status")?;
    writeln!(out, "Repo: {}", options.repo_root.display())?;
    writeln!(out, "Ledger: {}", db_path.display())?;
    writeln!(out, "Operators: {}", operators.len())?;
    writeln!(out, "Sessions: {}", sessions.len())?;

    if sessions.is_empty() {
        writeln!(out, "No sessions recorded.")?;
    } else {
        for session in sessions {
            writeln!(out, "- {} [{}]", session.id, session.status.as_str())?;
            writeln!(out, "  provider: {}", session.provider)?;
            writeln!(out, "  branch: {}", session.branch)?;
            writeln!(out, "  worktree: {}", session.worktree_path)?;
            writeln!(
                out,
                "  target: {}",
                session.target_path.as_deref().unwrap_or("-")
            )?;
            writeln!(out, "  base: {}", short_hash(&session.base_commit))?;
            if let Some(head_commit) = session.head_commit.as_deref() {
                writeln!(out, "  head: {}", short_hash(head_commit))?;
            }
        }
    }

    writeln!(out, "Events: {event_count}")?;
    if !recent_events.is_empty() {
        writeln!(out, "Recent events:")?;
        for event in recent_events {
            let subject = match (event.subject_type.as_deref(), event.subject_id.as_deref()) {
                (Some(subject_type), Some(subject_id)) => {
                    format!(" {subject_type}:{subject_id}")
                }
                (Some(subject_type), None) => format!(" {subject_type}"),
                _ => String::new(),
            };
            writeln!(out, "- #{} {}{}", event.id, event.name, subject)?;
        }
    }

    Ok(())
}

fn run_doctor(options: &DoctorOptions) -> Result<DoctorRunResult, CliError> {
    let db_path = ledger_path(&options.repo_root, &options.db_path);
    let aichestra_dir = options.repo_root.join(".aichestra");
    let mut checks = Vec::new();

    add_doctor_path_check(
        &mut checks,
        "config",
        &aichestra_dir.join("config.yaml"),
        "file",
    );
    add_doctor_path_check(
        &mut checks,
        "artifacts",
        &aichestra_dir.join("artifacts"),
        "dir",
    );
    add_doctor_path_check(
        &mut checks,
        "sandboxes",
        &aichestra_dir.join("sandboxes"),
        "dir",
    );
    add_doctor_path_check(
        &mut checks,
        "worktrees",
        &aichestra_dir.join("worktrees"),
        "dir",
    );

    if !db_path.is_file() {
        add_doctor_check(
            &mut checks,
            DoctorSeverity::Error,
            "ledger",
            format!("missing SQLite ledger at {}", db_path.display()),
        );
        return Ok(DoctorRunResult {
            repo_root: options.repo_root.clone(),
            db_path,
            checks,
        });
    }

    let ledger = match Ledger::open(&db_path) {
        Ok(ledger) => {
            add_doctor_check(
                &mut checks,
                DoctorSeverity::Ok,
                "ledger",
                format!("opened {}", db_path.display()),
            );
            ledger
        }
        Err(error) => {
            add_doctor_check(
                &mut checks,
                DoctorSeverity::Error,
                "ledger",
                format!("failed to open {}: {error}", db_path.display()),
            );
            return Ok(DoctorRunResult {
                repo_root: options.repo_root.clone(),
                db_path,
                checks,
            });
        }
    };

    match ledger.get_operator(DEFAULT_OPERATOR_ID) {
        Ok(Some(operator)) if operator.status.as_str() == "active" => add_doctor_check(
            &mut checks,
            DoctorSeverity::Ok,
            "operator",
            format!("default operator {DEFAULT_OPERATOR_ID} is active"),
        ),
        Ok(Some(operator)) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Warning,
            "operator",
            format!(
                "default operator {DEFAULT_OPERATOR_ID} is {}",
                operator.status.as_str()
            ),
        ),
        Ok(None) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Error,
            "operator",
            format!("default operator {DEFAULT_OPERATOR_ID} is missing"),
        ),
        Err(error) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Error,
            "operator",
            format!("failed to read operators: {error}"),
        ),
    }

    match queue_entries(&ledger) {
        Ok(entries) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Ok,
            "queue",
            format!("{} candidate(s) need queue attention", entries.len()),
        ),
        Err(error) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Error,
            "queue",
            format!("failed to read queue entries: {error}"),
        ),
    }

    match ledger.get_queue_lock(MERGE_QUEUE_LOCK_NAME) {
        Ok(Some(lock)) => {
            let now = now_millis();
            let age_ms = queue_lock_age_ms(&lock, now);
            let stale = is_queue_lock_stale(&lock, now);
            add_doctor_check(
                &mut checks,
                if stale {
                    DoctorSeverity::Warning
                } else {
                    DoctorSeverity::Ok
                },
                "queue lock",
                format!(
                    "{} held by {} for {} on session {}",
                    if stale { "stale" } else { "active" },
                    lock.holder_id,
                    lock.operation,
                    lock.session_id.as_deref().unwrap_or("-")
                ),
            );
            add_doctor_check(
                &mut checks,
                if stale {
                    DoctorSeverity::Warning
                } else {
                    DoctorSeverity::Ok
                },
                "queue lock age",
                format_duration_ms(age_ms),
            );
        }
        Ok(None) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Ok,
            "queue lock",
            "free".to_string(),
        ),
        Err(error) => add_doctor_check(
            &mut checks,
            DoctorSeverity::Error,
            "queue lock",
            format!("failed to read queue lock: {error}"),
        ),
    }

    Ok(DoctorRunResult {
        repo_root: options.repo_root.clone(),
        db_path,
        checks,
    })
}

fn render_doctor<W: Write>(result: &DoctorRunResult, out: &mut W) -> Result<(), CliError> {
    writeln!(out, "Aichestra doctor")?;
    writeln!(out, "Repo: {}", result.repo_root.display())?;
    writeln!(out, "Ledger: {}", result.db_path.display())?;
    for check in &result.checks {
        writeln!(
            out,
            "[{}] {}: {}",
            check.severity.as_str(),
            check.name,
            check.detail
        )?;
    }
    writeln!(
        out,
        "Summary: warnings={} errors={}",
        result.warning_count(),
        result.error_count()
    )?;
    writeln!(out, "Result: {}", result.result_label())?;
    Ok(())
}

fn add_doctor_path_check(checks: &mut Vec<DoctorCheck>, name: &str, path: &Path, kind: &str) {
    let ok = match kind {
        "dir" => path.is_dir(),
        "file" => path.is_file(),
        _ => path.exists(),
    };
    if ok {
        add_doctor_check(
            checks,
            DoctorSeverity::Ok,
            name,
            format!("found {}", path.display()),
        );
    } else {
        add_doctor_check(
            checks,
            DoctorSeverity::Error,
            name,
            format!("missing {kind} at {}", path.display()),
        );
    }
}

fn add_doctor_check(
    checks: &mut Vec<DoctorCheck>,
    severity: DoctorSeverity,
    name: impl Into<String>,
    detail: impl Into<String>,
) {
    checks.push(DoctorCheck {
        severity,
        name: name.into(),
        detail: detail.into(),
    });
}

fn init_repo(options: &InitOptions) -> Result<InitResult, CliError> {
    fs::create_dir_all(&options.repo_root)?;
    let aichestra_dir = options.repo_root.join(".aichestra");
    fs::create_dir_all(aichestra_dir.join("artifacts"))?;
    fs::create_dir_all(aichestra_dir.join("sandboxes"))?;
    fs::create_dir_all(aichestra_dir.join("worktrees"))?;

    let config_path = aichestra_dir.join("config.yaml");
    let config_created = if config_path.exists() {
        false
    } else {
        fs::write(&config_path, DEFAULT_CONFIG)?;
        true
    };

    let db_path = options
        .db_path
        .clone()
        .unwrap_or_else(|| aichestra_dir.join("aichestra.db"));
    let ledger = Ledger::open(&db_path)?;
    ensure_default_operator(&ledger)?;
    ledger.record_repo_initialized(&options.repo_root)?;

    Ok(InitResult {
        repo_root: options.repo_root.clone(),
        db_path,
        config_created,
    })
}

fn start_session_with<R, W>(
    options: &SessionStartOptions,
    git_repo: &R,
    worktree_manager: &W,
) -> Result<SessionStartResult, CliError>
where
    R: GitRepository,
    W: WorktreeManager,
{
    let aichestra_dir = options.repo_root.join(".aichestra");
    let config_path = aichestra_dir.join("config.yaml");
    if !config_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra config not found at {}; run `aich init` first",
            config_path.display()
        )));
    }

    fs::create_dir_all(aichestra_dir.join("worktrees"))?;
    let db_path = ledger_path(&options.repo_root, &options.db_path);
    let ledger = Ledger::open(&db_path)?;
    let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;
    let main_branch = main_branch_from_config(&config_path)?;
    let main_ref = main_branch_ref(&main_branch);
    let head = git_repo.ref_commit(&options.repo_root, &main_ref)?;
    let created_at_ms = now_millis();
    let session_id = next_session_id(created_at_ms);
    let branch = format!("aich/session/{session_id}");
    let worktree_path = aichestra_dir.join("worktrees").join(&session_id);

    let mut session = Session::new(
        session_id.clone(),
        options.goal.clone(),
        options.provider.clone(),
        branch.clone(),
        worktree_path.display().to_string(),
        head.commit_id.clone(),
        created_at_ms,
    );
    session.target_path = options.target_path.clone();

    ledger.insert_session(&session)?;
    ledger.append_event(
        &NewEvent::new(EventName::SessionCreated)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\"}}",
                json_escape(&operator.id)
            )),
    )?;

    let request = CreateWorktreeRequest {
        repo_path: options.repo_root.clone(),
        main_worktree_path: options.repo_root.clone(),
        session_id: session.id.clone(),
        branch: branch.clone(),
        base_ref: head.commit_id.clone(),
        worktree_path,
    };

    if let Err(error) = worktree_manager.create_session_worktree(&request) {
        let _ = ledger.update_session_status(&session.id, SessionStatus::Blocked, now_millis());
        return Err(error.into());
    }

    session.status = SessionStatus::Running;
    session.updated_at_ms = now_millis();
    ledger.update_session_status(&session.id, SessionStatus::Running, session.updated_at_ms)?;
    ledger.append_event(
        &NewEvent::new(EventName::WorktreeCreated)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"branch\":\"{}\",\"worktree_path\":\"{}\"}}",
                json_escape(&session.branch),
                json_escape(&session.worktree_path)
            )),
    )?;
    ledger.append_event(
        &NewEvent::new(EventName::SessionStarted)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\"}}",
                json_escape(&operator.id)
            )),
    )?;

    Ok(SessionStartResult { session, operator })
}

fn complete_session_with<C>(
    options: &SessionCompleteOptions,
    completer: &C,
) -> Result<SessionCompleteResult, CliError>
where
    C: SessionWorktreeCompleter,
{
    let aichestra_dir = options.repo_root.join(".aichestra");
    let config_path = aichestra_dir.join("config.yaml");
    if !config_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra config not found at {}; run `aich init` first",
            config_path.display()
        )));
    }

    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;
    let mut session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;

    ensure_session_can_complete(&session)?;
    let worktree_path = PathBuf::from(&session.worktree_path);
    ensure_session_worktree_is_dedicated(&options.repo_root, &worktree_path)?;

    let outcome = completer.complete_session_worktree(&CompleteSessionWorktreeRequest {
        session_id: session.id.clone(),
        worktree_path,
        session_branch: session.branch.clone(),
        main_branch: main_branch_from_config(&config_path)?,
        base_commit: session.base_commit.clone(),
    })?;

    match outcome {
        CompleteSessionWorktreeOutcome::NoChanges { head_commit } => {
            let updated_at_ms = now_millis();
            ledger.update_session_completion(
                &session.id,
                SessionStatus::Noop,
                Some(&head_commit),
                updated_at_ms,
            )?;
            session.status = SessionStatus::Noop;
            session.head_commit = Some(head_commit.clone());
            session.updated_at_ms = updated_at_ms;
            ledger.append_event(
                &NewEvent::new(EventName::SessionCompleted)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"operator_id\":\"{}\",\"status\":\"noop\",\"head_commit\":\"{}\",\"no_changes\":true}}",
                        json_escape(&operator.id),
                        json_escape(&head_commit)
                    )),
            )?;

            Ok(SessionCompleteResult {
                session,
                operator,
                patch_set: None,
                changed_files: Vec::new(),
                context_snapshot: None,
                change_manifest: None,
                manifest_path: None,
            })
        }
        CompleteSessionWorktreeOutcome::Changes(changes) => {
            let created_at_ms = now_millis();
            let artifact_id = next_artifact_id(created_at_ms);
            let artifact_dir = aichestra_dir
                .join("artifacts")
                .join("sessions")
                .join(&session.id)
                .join(&artifact_id);
            fs::create_dir_all(&artifact_dir)?;

            let diff_stat_path = artifact_dir.join("diff.stat");
            let diff_patch_path = artifact_dir.join("diff.patch");
            let manifest_path = artifact_dir.join("change-manifest.yaml");
            fs::write(&diff_stat_path, &changes.diff_stat)?;
            fs::write(&diff_patch_path, &changes.diff_patch)?;

            let changed_files: Vec<ChangedFile> = changes
                .changed_files
                .iter()
                .map(|file| ChangedFile::new(file.path.clone(), file.change_type.clone()))
                .collect();

            let patch_set = PatchSet {
                id: format!("patchset-{}-{artifact_id}", session.id),
                session_id: session.id.clone(),
                base_commit: session.base_commit.clone(),
                head_commit: Some(changes.head_commit.clone()),
                patch_id: Some(changes.head_commit.clone()),
                diff_stat: Some(changes.diff_stat.clone()),
                created_at_ms,
            };

            let context_snapshot = ContextSnapshot {
                id: format!("context-{}-{artifact_id}", session.id),
                session_id: Some(session.id.clone()),
                hash_algorithm: "sha256".to_string(),
                snapshot_hash: context_snapshot_hash(&options.repo_root)?,
                created_at_ms,
            };

            let manifest_content = render_change_manifest(
                &session,
                &patch_set,
                &changed_files,
                &context_snapshot,
                &diff_stat_path,
                &diff_patch_path,
                &options.repo_root,
            );
            fs::write(&manifest_path, &manifest_content)?;
            let manifest_hash = sha256_hex(manifest_content.as_bytes());
            let change_manifest = ChangeManifest {
                id: format!("manifest-{}-{artifact_id}", session.id),
                session_id: session.id.clone(),
                manifest_path: display_path_for_ledger(&options.repo_root, &manifest_path),
                manifest_hash: Some(manifest_hash),
                validation_status: CHANGE_MANIFEST_VALIDATION_STATUS.to_string(),
                created_at_ms,
            };

            ledger.insert_patch_set(&patch_set, &changed_files)?;
            ledger.insert_context_snapshot(&context_snapshot)?;
            ledger.insert_change_manifest(&change_manifest)?;

            let updated_at_ms = now_millis();
            ledger.update_session_completion(
                &session.id,
                SessionStatus::Enqueued,
                Some(&changes.head_commit),
                updated_at_ms,
            )?;
            session.status = SessionStatus::Enqueued;
            session.head_commit = Some(changes.head_commit.clone());
            session.updated_at_ms = updated_at_ms;

            ledger.append_event(
                &NewEvent::new(EventName::FilesChanged)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"operator_id\":\"{}\",\"changed_file_count\":{}}}",
                        json_escape(&operator.id),
                        changed_files.len()
                    )),
            )?;
            ledger.append_event(
                &NewEvent::new(EventName::PatchsetCreated)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"operator_id\":\"{}\",\"patch_set_id\":\"{}\",\"head_commit\":\"{}\",\"committed_worktree_changes\":{}}}",
                        json_escape(&operator.id),
                        json_escape(&patch_set.id),
                        json_escape(&changes.head_commit),
                        changes.committed_worktree_changes
                    )),
            )?;
            ledger.append_event(
                &NewEvent::new(EventName::ContextSnapshotCreated)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"context_snapshot_id\":\"{}\",\"hash_algorithm\":\"sha256\"}}",
                        json_escape(&context_snapshot.id)
                    )),
            )?;
            ledger.append_event(
                &NewEvent::new(EventName::ManifestCreated)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"manifest_id\":\"{}\",\"manifest_path\":\"{}\"}}",
                        json_escape(&change_manifest.id),
                        json_escape(&change_manifest.manifest_path)
                    )),
            )?;
            ledger.append_event(
                &NewEvent::new(EventName::ManifestValidated)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"manifest_id\":\"{}\",\"validation_status\":\"{}\"}}",
                        json_escape(&change_manifest.id),
                        CHANGE_MANIFEST_VALIDATION_STATUS
                    )),
            )?;
            ledger.append_event(
                &NewEvent::new(EventName::SessionCompleted)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"operator_id\":\"{}\",\"status\":\"enqueued\",\"head_commit\":\"{}\",\"no_changes\":false}}",
                        json_escape(&operator.id),
                        json_escape(&changes.head_commit)
                    )),
            )?;

            Ok(SessionCompleteResult {
                session,
                operator,
                patch_set: Some(patch_set),
                changed_files,
                context_snapshot: Some(context_snapshot),
                change_manifest: Some(change_manifest),
                manifest_path: Some(manifest_path),
            })
        }
    }
}

fn cleanup_session_with<C>(
    options: &SessionCleanupOptions,
    cleaner: &C,
) -> Result<SessionCleanupResult, CliError>
where
    C: SessionWorktreeCleaner,
{
    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;
    cleanup_session_record(&options.repo_root, &ledger, session, cleaner)
}

fn prune_sessions_with<C>(
    options: &SessionPruneOptions,
    cleaner: &C,
) -> Result<SessionPruneResult, CliError>
where
    C: SessionWorktreeCleaner,
{
    if !options.applied {
        return Err(CliError::Usage(
            "session prune requires --applied to avoid removing active session worktrees"
                .to_string(),
        ));
    }

    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let mut cleaned = Vec::new();
    let mut skipped = 0;

    for session in ledger.list_sessions()? {
        let latest_attempt = latest_merge_attempt(&ledger, &session.id)?;
        if session.status == SessionStatus::Completed
            && latest_attempt
                .as_ref()
                .map(|attempt| attempt.status == MergeAttemptStatus::Applied)
                .unwrap_or(false)
        {
            cleaned.push(cleanup_session_record(
                &options.repo_root,
                &ledger,
                session,
                cleaner,
            )?);
        } else {
            skipped += 1;
        }
    }

    Ok(SessionPruneResult { cleaned, skipped })
}

fn cleanup_session_record<C>(
    repo_root: &Path,
    ledger: &Ledger,
    session: Session,
    cleaner: &C,
) -> Result<SessionCleanupResult, CliError>
where
    C: SessionWorktreeCleaner,
{
    let latest_attempt = latest_merge_attempt(ledger, &session.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no applied merge attempt; cleanup is only allowed after apply",
            session.id
        ))
    })?;
    ensure_session_can_cleanup(&session, &latest_attempt)?;

    let attempts = ledger.list_merge_attempts(&session.id)?;
    let sandbox_paths: Vec<PathBuf> = attempts
        .iter()
        .map(|attempt| {
            repo_root
                .join(".aichestra")
                .join("sandboxes")
                .join(&attempt.id)
        })
        .collect();
    let request = CleanupSessionWorktreeRequest {
        repo_path: repo_root.to_path_buf(),
        main_worktree_path: repo_root.to_path_buf(),
        session_id: session.id.clone(),
        branch: session.branch.clone(),
        worktree_path: path_from_ledger(repo_root, &session.worktree_path),
        sandbox_paths,
    };
    let cleanup = cleaner.cleanup_session_worktree(&request)?;

    ledger.append_event(
        &NewEvent::new(EventName::SessionCleaned)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"merge_attempt_id\":\"{}\",\"session_worktree_removed\":{},\"branch_deleted\":{},\"sandbox_worktrees_removed\":{}}}",
                json_escape(&latest_attempt.id),
                cleanup.session_worktree_removed,
                cleanup.branch_deleted,
                cleanup.sandbox_worktrees_removed.len()
            )),
    )?;

    Ok(SessionCleanupResult {
        session,
        latest_attempt,
        cleanup,
    })
}

fn run_preflight_with<R, P>(
    options: &PreflightOptions,
    git_repo: &R,
    preflight_runner: &P,
) -> Result<PreflightRunResult, CliError>
where
    R: GitRepository,
    P: PreflightRunner,
{
    let aichestra_dir = options.repo_root.join(".aichestra");
    let config_path = aichestra_dir.join("config.yaml");
    if !config_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra config not found at {}; run `aich init` first",
            config_path.display()
        )));
    }

    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;
    let session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;
    ensure_session_can_preflight(&session)?;

    let candidate_commit = session.head_commit.clone().ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no candidate head commit; run `aich session complete {}` first",
            session.id, session.id
        ))
    })?;

    let manifests = ledger.list_change_manifests(&session.id)?;
    if manifests.is_empty() {
        return Err(CliError::Usage(format!(
            "session '{}' has no Change Manifest; run `aich session complete {}` first",
            session.id, session.id
        )));
    }
    let _queue_lock = acquire_merge_queue_lock(&ledger, "preflight", &session.id)?;
    ensure_preflight_queue_position(&ledger, &session.id)?;

    let main_branch = main_branch_from_config(&config_path)?;
    let main_before = git_repo
        .ref_commit(&options.repo_root, &main_branch_ref(&main_branch))?
        .commit_id;
    let created_at_ms = now_millis();
    let attempt_id = next_merge_attempt_id(created_at_ms);
    let sandbox_path = aichestra_dir.join("sandboxes").join(&attempt_id);
    let artifact_dir = aichestra_dir
        .join("artifacts")
        .join("merge-attempts")
        .join(&attempt_id);
    fs::create_dir_all(&artifact_dir)?;

    let attempt = MergeAttempt {
        id: attempt_id.clone(),
        session_id: session.id.clone(),
        status: MergeAttemptStatus::PreflightRunning,
        main_before_commit: main_before.clone(),
        candidate_commit: candidate_commit.clone(),
        apply_strategy: PREFLIGHT_APPLY_STRATEGY.to_string(),
        verified_tree_id: None,
        verified_commit_id: None,
        checks_passed: false,
        semantic_risk_level: None,
    };
    ledger.insert_merge_attempt(&attempt, created_at_ms, created_at_ms)?;
    ledger.append_event(
        &NewEvent::new(EventName::MergePreflightStarted)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"main_before_commit\":\"{}\",\"candidate_commit\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&main_before),
                json_escape(&candidate_commit)
            )),
    )?;

    let check_commands = check_commands_from_config(&config_path)?;
    let outcome = match preflight_runner.run_preflight(&PreflightRequest {
        repo_path: options.repo_root.clone(),
        sandbox_path: sandbox_path.clone(),
        session_id: session.id.clone(),
        main_before_commit: main_before,
        candidate_commit,
        check_commands,
    }) {
        Ok(outcome) => outcome,
        Err(error) => {
            ledger.update_merge_attempt_result(MergeAttemptResultUpdate {
                id: &attempt.id,
                status: MergeAttemptStatus::Blocked,
                verified_tree_id: None,
                verified_commit_id: None,
                checks_passed: false,
                semantic_risk_level: None,
                updated_at_ms: now_millis(),
            })?;
            ledger.append_event(
                &NewEvent::new(EventName::MergeBlocked)
                    .with_subject("merge_attempt", attempt.id.clone())
                    .with_data_json(format!(
                        "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"reason\":\"preflight_error\",\"error\":\"{}\"}}",
                        json_escape(&operator.id),
                        json_escape(&session.id),
                        json_escape(&error.to_string())
                    )),
            )?;
            return Err(error.into());
        }
    };

    match outcome {
        PreflightOutcome::Verified(verified) => {
            let context = PreflightFinishContext {
                ledger: &ledger,
                attempt_id: &attempt.id,
                session_id: &session.id,
                operator: &operator,
                artifact_dir: &artifact_dir,
                repo_root: &options.repo_root,
                sandbox_path: &sandbox_path,
            };
            finish_verified_preflight(context, verified)
        }
        PreflightOutcome::Blocked(blocked) => {
            let context = PreflightFinishContext {
                ledger: &ledger,
                attempt_id: &attempt.id,
                session_id: &session.id,
                operator: &operator,
                artifact_dir: &artifact_dir,
                repo_root: &options.repo_root,
                sandbox_path: &sandbox_path,
            };
            finish_blocked_preflight(context, blocked)
        }
    }
}

fn next_session_id(created_at_ms: i64) -> String {
    let counter = SESSION_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("session-{created_at_ms}-{counter}")
}

fn next_merge_attempt_id(created_at_ms: i64) -> String {
    let counter = MERGE_ATTEMPT_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("merge-attempt-{created_at_ms}-{counter}")
}

pub(crate) fn next_semantic_review_id(created_at_ms: i64) -> String {
    let counter = SEMANTIC_REVIEW_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("semantic-review-{created_at_ms}-{counter}")
}

fn next_approval_id(created_at_ms: i64) -> String {
    let counter = APPROVAL_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("approval-{created_at_ms}-{counter}")
}

fn next_queue_lock_holder_id(acquired_at_ms: i64) -> String {
    let counter = QUEUE_LOCK_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("queue-lock-{acquired_at_ms}-{counter}")
}

fn next_artifact_id(created_at_ms: i64) -> String {
    let counter = ARTIFACT_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{created_at_ms}-{counter}")
}

struct QueueLockGuard<'a> {
    ledger: &'a Ledger,
    lock: QueueLock,
}

impl Drop for QueueLockGuard<'_> {
    fn drop(&mut self) {
        let _ = self
            .ledger
            .release_queue_lock(&self.lock.name, &self.lock.holder_id);
    }
}

fn acquire_merge_queue_lock<'a>(
    ledger: &'a Ledger,
    operation: &str,
    session_id: &str,
) -> Result<QueueLockGuard<'a>, CliError> {
    let acquired_at_ms = now_millis();
    let lock = QueueLock {
        name: MERGE_QUEUE_LOCK_NAME.to_string(),
        holder_id: next_queue_lock_holder_id(acquired_at_ms),
        operation: operation.to_string(),
        session_id: Some(session_id.to_string()),
        acquired_at_ms,
    };

    if ledger.try_acquire_queue_lock(&lock)? {
        return Ok(QueueLockGuard { ledger, lock });
    }

    let held_by = match ledger.get_queue_lock(MERGE_QUEUE_LOCK_NAME)? {
        Some(existing) => format!(
            " by {} for {}{}",
            existing.holder_id,
            existing.operation,
            existing
                .session_id
                .as_deref()
                .map(|id| format!(" on session {id}"))
                .unwrap_or_default()
        ),
        None => String::new(),
    };

    Err(CliError::Usage(format!(
        "merge queue is locked{held_by}; run `aich queue` to inspect the active lock"
    )))
}

fn ensure_preflight_queue_position(ledger: &Ledger, session_id: &str) -> Result<(), CliError> {
    let entries = queue_entries(ledger)?;

    if let Some(blocking) = entries.iter().find(|entry| {
        entry.session.id != session_id
            && matches!(
                entry.status.as_str(),
                "preflight_running" | "verified" | "approved"
            )
    }) {
        return Err(CliError::Usage(format!(
            "cannot preflight session '{}' while session '{}' is {}; finish it first with `{}`",
            session_id,
            blocking.session.id,
            blocking.status,
            queue_next_action(blocking)
        )));
    }

    let current_status = entries
        .iter()
        .find(|entry| entry.session.id == session_id)
        .map(|entry| entry.status.as_str());

    if matches!(current_status, Some("blocked" | "verified" | "approved")) {
        return Ok(());
    }

    if matches!(current_status, Some("preflight_running")) {
        return Err(CliError::Usage(format!(
            "session '{session_id}' already has a preflight in progress"
        )));
    }

    if !matches!(current_status, Some("enqueued")) {
        return Err(CliError::Usage(format!(
            "session '{session_id}' is not preflightable; run `aich queue` to inspect candidate state"
        )));
    }

    let Some(head) = entries
        .iter()
        .find(|entry| entry.status.as_str() == "enqueued")
    else {
        return Err(CliError::Usage(format!(
            "session '{session_id}' is not preflightable; run `aich queue` to inspect candidate state"
        )));
    };

    if head.session.id != session_id {
        return Err(CliError::Usage(format!(
            "session '{}' is not the queue head; preflight session '{}' first",
            session_id, head.session.id
        )));
    }

    Ok(())
}

fn ensure_session_can_complete(session: &Session) -> Result<(), CliError> {
    match session.status {
        SessionStatus::Created | SessionStatus::Running => Ok(()),
        _ => Err(CliError::Usage(format!(
            "session '{}' cannot be completed from status '{}'",
            session.id,
            session.status.as_str()
        ))),
    }
}

fn ensure_session_can_preflight(session: &Session) -> Result<(), CliError> {
    if session.status != SessionStatus::Enqueued {
        return Err(CliError::Usage(format!(
            "session '{}' cannot be preflighted from status '{}'; run `aich session complete {}` first",
            session.id,
            session.status.as_str(),
            session.id
        )));
    }

    Ok(())
}

fn ensure_session_can_cleanup(
    session: &Session,
    latest_attempt: &MergeAttempt,
) -> Result<(), CliError> {
    if session.status != SessionStatus::Completed {
        return Err(CliError::Usage(format!(
            "session '{}' cannot be cleaned from status '{}'; cleanup is only allowed after apply",
            session.id,
            session.status.as_str()
        )));
    }
    if latest_attempt.status != MergeAttemptStatus::Applied {
        return Err(CliError::Usage(format!(
            "session '{}' latest merge attempt '{}' is '{}'; cleanup is only allowed after apply",
            session.id,
            latest_attempt.id,
            latest_attempt.status.as_str()
        )));
    }

    Ok(())
}

struct PreflightFinishContext<'a> {
    ledger: &'a Ledger,
    attempt_id: &'a str,
    session_id: &'a str,
    operator: &'a Operator,
    artifact_dir: &'a Path,
    repo_root: &'a Path,
    sandbox_path: &'a Path,
}

fn finish_verified_preflight(
    context: PreflightFinishContext<'_>,
    verified: PreflightVerified,
) -> Result<PreflightRunResult, CliError> {
    let check_results = persist_preflight_checks(
        context.ledger,
        context.attempt_id,
        context.artifact_dir,
        context.repo_root,
        &verified.checks,
    )?;
    context
        .ledger
        .update_merge_attempt_result(MergeAttemptResultUpdate {
            id: context.attempt_id,
            status: MergeAttemptStatus::Verified,
            verified_tree_id: Some(&verified.verified_tree_id),
            verified_commit_id: Some(&verified.verified_commit_id),
            checks_passed: true,
            semantic_risk_level: None,
            updated_at_ms: now_millis(),
        })?;
    context.ledger.append_event(
        &NewEvent::new(EventName::MergeMechanicalCompleted)
            .with_subject("merge_attempt", context.attempt_id.to_string())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"status\":\"merged\",\"verified_tree_id\":\"{}\",\"verified_commit_id\":\"{}\"}}",
                json_escape(&context.operator.id),
                json_escape(context.session_id),
                json_escape(&verified.verified_tree_id),
                json_escape(&verified.verified_commit_id)
            )),
    )?;
    context.ledger.append_event(
        &NewEvent::new(EventName::CheckCompleted)
            .with_subject("merge_attempt", context.attempt_id.to_string())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"result\":\"passed\",\"check_count\":{}}}",
                json_escape(&context.operator.id),
                json_escape(context.session_id),
                check_results.len()
            )),
    )?;

    let merge_attempt = context
        .ledger
        .get_merge_attempt(context.attempt_id)?
        .ok_or_else(|| {
            CliError::Usage(format!(
                "merge attempt '{}' does not exist",
                context.attempt_id
            ))
        })?;
    Ok(PreflightRunResult {
        merge_attempt,
        operator: context.operator.clone(),
        sandbox_path: context.sandbox_path.to_path_buf(),
        check_results,
        blocked_reason: None,
    })
}

fn finish_blocked_preflight(
    context: PreflightFinishContext<'_>,
    blocked: PreflightBlocked,
) -> Result<PreflightRunResult, CliError> {
    fs::write(
        context.artifact_dir.join("merge.stdout"),
        &blocked.merge_stdout,
    )?;
    fs::write(
        context.artifact_dir.join("merge.stderr"),
        &blocked.merge_stderr,
    )?;
    if !blocked.conflict_files.is_empty() {
        fs::write(
            context.artifact_dir.join("conflicts.txt"),
            blocked.conflict_files.join("\n"),
        )?;
    }

    let check_results = persist_preflight_checks(
        context.ledger,
        context.attempt_id,
        context.artifact_dir,
        context.repo_root,
        &blocked.checks,
    )?;
    context
        .ledger
        .update_merge_attempt_result(MergeAttemptResultUpdate {
            id: context.attempt_id,
            status: MergeAttemptStatus::Blocked,
            verified_tree_id: blocked.verified_tree_id.as_deref(),
            verified_commit_id: blocked.verified_commit_id.as_deref(),
            checks_passed: false,
            semantic_risk_level: None,
            updated_at_ms: now_millis(),
        })?;
    context.ledger.append_event(
        &NewEvent::new(EventName::MergeMechanicalCompleted)
            .with_subject("merge_attempt", context.attempt_id.to_string())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"status\":\"blocked\",\"reason\":\"{}\",\"conflict_count\":{}}}",
                json_escape(&context.operator.id),
                json_escape(context.session_id),
                json_escape(&blocked.reason),
                blocked.conflict_files.len()
            )),
    )?;
    if !blocked.checks.is_empty() {
        context.ledger.append_event(
            &NewEvent::new(EventName::CheckCompleted)
                .with_subject("merge_attempt", context.attempt_id.to_string())
                .with_data_json(format!(
                    "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"result\":\"failed\",\"check_count\":{}}}",
                    json_escape(&context.operator.id),
                    json_escape(context.session_id),
                    blocked.checks.len()
                )),
        )?;
    }
    context.ledger.append_event(
        &NewEvent::new(EventName::MergeBlocked)
            .with_subject("merge_attempt", context.attempt_id.to_string())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"reason\":\"{}\"}}",
                json_escape(&context.operator.id),
                json_escape(context.session_id),
                json_escape(&blocked.reason)
            )),
    )?;

    let merge_attempt = context
        .ledger
        .get_merge_attempt(context.attempt_id)?
        .ok_or_else(|| {
            CliError::Usage(format!(
                "merge attempt '{}' does not exist",
                context.attempt_id
            ))
        })?;
    Ok(PreflightRunResult {
        merge_attempt,
        operator: context.operator.clone(),
        sandbox_path: context.sandbox_path.to_path_buf(),
        check_results,
        blocked_reason: Some(blocked.reason),
    })
}

pub(crate) fn latest_merge_attempt(
    ledger: &Ledger,
    session_id: &str,
) -> Result<Option<MergeAttempt>, CliError> {
    Ok(ledger.list_merge_attempts(session_id)?.into_iter().last())
}

fn run_approve_with<R>(options: &ApproveOptions, git_repo: &R) -> Result<ApproveRunResult, CliError>
where
    R: GitRepository,
{
    let aichestra_dir = options.repo_root.join(".aichestra");
    let config_path = aichestra_dir.join("config.yaml");
    if !config_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra config not found at {}; run `aich init` first",
            config_path.display()
        )));
    }

    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;
    let session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;
    let attempt = latest_merge_attempt(&ledger, &session.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no preflight attempt; run `aich preflight {}` first",
            session.id, session.id
        ))
    })?;
    ensure_attempt_can_be_approved(&attempt)?;

    let semantic_reviews = ledger.list_semantic_reviews(&attempt.id)?;
    let Some(latest_review) = semantic_reviews.last() else {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' has no semantic review; run `aich review {}` first",
            attempt.id, session.id
        )));
    };
    if latest_review.risk_level == SemanticRiskLevel::Blocked {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' has blocked semantic risk; revise the candidate and run preflight/review again",
            attempt.id
        )));
    }

    let main_branch = main_branch_from_config(&config_path)?;
    let current_main = git_repo
        .ref_commit(&options.repo_root, &main_branch_ref(&main_branch))?
        .commit_id;
    let created_at_ms = now_millis();
    let approval = Approval {
        id: next_approval_id(created_at_ms),
        merge_attempt_id: attempt.id.clone(),
        approved_by: operator.id.clone(),
        approved_verified_tree_id: attempt
            .verified_tree_id
            .clone()
            .expect("verified attempt must have tree id"),
        approved_verified_commit_id: attempt
            .verified_commit_id
            .clone()
            .expect("verified attempt must have commit id"),
        created_at_ms,
    };
    assert_verified_candidate_can_apply(&attempt, &approval, &current_main)
        .map_err(|error| CliError::Usage(format!("candidate cannot be approved: {error}")))?;

    ledger.append_event(
        &NewEvent::new(EventName::ApprovalRequested)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"verified_tree_id\":\"{}\",\"verified_commit_id\":\"{}\",\"semantic_risk_level\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&approval.approved_verified_tree_id),
                json_escape(&approval.approved_verified_commit_id),
                json_escape(attempt.semantic_risk_level.as_deref().unwrap_or("unknown"))
            )),
    )?;
    ledger.insert_approval(&approval)?;
    ledger.append_event(
        &NewEvent::new(EventName::ApprovalApproved)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"approval_id\":\"{}\",\"verified_tree_id\":\"{}\",\"verified_commit_id\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&approval.id),
                json_escape(&approval.approved_verified_tree_id),
                json_escape(&approval.approved_verified_commit_id)
            )),
    )?;

    Ok(ApproveRunResult {
        approval,
        merge_attempt: attempt,
        operator,
        semantic_reviews,
    })
}

fn run_apply_with<R, A>(
    options: &ApplyOptions,
    git_repo: &R,
    applier: &A,
) -> Result<ApplyRunResult, CliError>
where
    R: GitRepository,
    A: VerifiedCommitApplier,
{
    let aichestra_dir = options.repo_root.join(".aichestra");
    let config_path = aichestra_dir.join("config.yaml");
    if !config_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra config not found at {}; run `aich init` first",
            config_path.display()
        )));
    }

    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;
    let session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;
    let attempt = latest_merge_attempt(&ledger, &session.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no preflight attempt; run `aich preflight {}` first",
            session.id, session.id
        ))
    })?;
    ensure_attempt_can_be_approved(&attempt)?;
    let approval = latest_approval(&ledger, &attempt.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "merge attempt '{}' has no approval; run `aich approve {}` first",
            attempt.id, session.id
        ))
    })?;
    let _queue_lock = acquire_merge_queue_lock(&ledger, "apply", &session.id)?;

    let main_branch = main_branch_from_config(&config_path)?;
    let current_main = git_repo
        .ref_commit(&options.repo_root, &main_branch_ref(&main_branch))?
        .commit_id;
    assert_verified_candidate_can_apply(&attempt, &approval, &current_main)
        .map_err(|error| CliError::Usage(format!("candidate cannot be applied: {error}")))?;

    ledger.update_merge_attempt_status(&attempt.id, MergeAttemptStatus::Applying, now_millis())?;
    let applied = match applier.apply_verified_commit(&ApplyVerifiedCommitRequest {
        repo_path: options.repo_root.clone(),
        main_branch,
        verified_commit_id: approval.approved_verified_commit_id.clone(),
        verified_tree_id: approval.approved_verified_tree_id.clone(),
    }) {
        Ok(applied) => applied,
        Err(error) => {
            let _ = ledger.update_merge_attempt_status(
                &attempt.id,
                MergeAttemptStatus::Verified,
                now_millis(),
            );
            return Err(error.into());
        }
    };

    if applied.applied_commit_id != approval.approved_verified_commit_id
        || applied.applied_tree_id != approval.approved_verified_tree_id
    {
        ledger.update_merge_attempt_status(
            &attempt.id,
            MergeAttemptStatus::Blocked,
            now_millis(),
        )?;
        ledger.append_event(
            &NewEvent::new(EventName::MergeBlocked)
                .with_subject("merge_attempt", attempt.id.clone())
                .with_data_json(format!(
                    "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"reason\":\"applied_tree_mismatch\"}}",
                    json_escape(&operator.id),
                    json_escape(&session.id)
                )),
        )?;
        return Err(CliError::Usage(
            "applied commit/tree did not match the approved verified candidate".to_string(),
        ));
    }

    ledger.update_merge_attempt_status(&attempt.id, MergeAttemptStatus::Applied, now_millis())?;
    ledger.update_session_status(&session.id, SessionStatus::Completed, now_millis())?;
    ledger.append_event(
        &NewEvent::new(EventName::MergeApplied)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"approval_id\":\"{}\",\"applied_commit_id\":\"{}\",\"applied_tree_id\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&approval.id),
                json_escape(&applied.applied_commit_id),
                json_escape(&applied.applied_tree_id)
            )),
    )?;

    let merge_attempt = ledger
        .get_merge_attempt(&attempt.id)?
        .ok_or_else(|| CliError::Usage(format!("merge attempt '{}' does not exist", attempt.id)))?;

    Ok(ApplyRunResult {
        merge_attempt,
        approval,
        operator,
        applied_commit_id: applied.applied_commit_id,
        applied_tree_id: applied.applied_tree_id,
    })
}

fn latest_approval(ledger: &Ledger, merge_attempt_id: &str) -> Result<Option<Approval>, CliError> {
    Ok(ledger.list_approvals(merge_attempt_id)?.into_iter().last())
}

fn ensure_attempt_can_be_approved(attempt: &MergeAttempt) -> Result<(), CliError> {
    ensure_attempt_can_be_reviewed(attempt)?;
    if attempt
        .semantic_risk_level
        .as_deref()
        .unwrap_or("")
        .is_empty()
    {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' has no semantic risk result; run `aich review {}` first",
            attempt.id, attempt.session_id
        )));
    }
    if attempt.semantic_risk_level.as_deref() == Some(SemanticRiskLevel::Blocked.as_str()) {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is blocked by semantic review",
            attempt.id
        )));
    }

    Ok(())
}

fn ensure_session_worktree_is_dedicated(
    repo_root: &Path,
    worktree_path: &Path,
) -> Result<(), CliError> {
    if comparable_path(repo_root) == comparable_path(worktree_path) {
        return Err(CliError::Usage(
            "session worktree must not be the main worktree".to_string(),
        ));
    }

    Ok(())
}

fn write_usage<W: Write>(out: &mut W) -> Result<(), CliError> {
    writeln!(out, "{}", usage_text())?;
    Ok(())
}

pub(crate) fn usage_text() -> String {
    "Usage:\n  aich init [--repo PATH] [--db PATH]\n  aich status [--repo PATH] [--db PATH] [--recent-events N]\n  aich doctor [--repo PATH] [--db PATH]\n  aich queue [--repo PATH] [--db PATH]\n  aich queue unlock --force [--reason TEXT] [--repo PATH] [--db PATH]\n  aich auth whoami [--operator ID] [--repo PATH] [--db PATH]\n  aich auth operator add --id ID [--name NAME] [--role owner|maintainer|reviewer] [--repo PATH] [--db PATH]\n  aich auth operator list [--repo PATH] [--db PATH]\n  aich session start --goal TEXT [--provider PROVIDER] [--target PATH] [--operator ID] [--repo PATH] [--db PATH]\n  aich session complete <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich session cleanup <session-id> [--repo PATH] [--db PATH]\n  aich session prune --applied [--repo PATH] [--db PATH]\n  aich preflight <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich review <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich approve <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich apply <session-id> [--operator ID] [--repo PATH] [--db PATH]".to_string()
}

#[cfg(test)]
mod tests;
