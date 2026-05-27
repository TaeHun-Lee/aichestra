use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

#[cfg(test)]
use aich_core::clock::now_millis;
use aich_core::{
    Approval, ChangeManifest, ChangedFile, CheckResult, ContextSnapshot, MergeAttempt, Operator,
    PatchSet, QueueLock, SemanticReview, Session,
};
#[cfg(test)]
use aich_core::{
    CheckResultStatus, EventName, MergeAttemptStatus, NewEvent, OperatorRole, SemanticRiskLevel,
    SessionStatus,
};
#[cfg(test)]
use aich_git::{
    ApplyVerifiedCommitRequest, CleanupSessionWorktreeRequest, CompleteSessionWorktreeOutcome,
    CompleteSessionWorktreeRequest, CreateWorktreeRequest, GitRepository, PreflightOutcome,
    PreflightRequest, PreflightRunner, SessionWorktreeCleaner, SessionWorktreeCompleter,
    VerifiedCommitApplier, WorktreeManager,
};
use aich_git::{CleanupSessionWorktreeOutcome, NativeGitWorktreeManager, WorktreeError};
use aich_ledger::Ledger;

mod agent;
mod apply;
mod approval;
mod auth;
mod checks;
mod command_line;
mod config;
mod doctor;
mod formatting;
mod manifest;
mod options;
mod preflight;
mod queue;
mod semantic_review;
mod session;
mod status;

use agent::run_session_agent_with;
use apply::run_apply_with;
use approval::run_approve_with;
use auth::run_auth_command;
pub(crate) use auth::{ensure_default_operator, resolve_active_operator};
use config::DEFAULT_CONFIG;
use doctor::{render_doctor, run_doctor};
use formatting::yes_no;
#[cfg(test)]
use formatting::{display_path_for_ledger, sha256_hex};
#[cfg(test)]
use manifest::{changed_files_missing_from_manifest, parse_manifest_diff_evidence};
use options::*;
use preflight::run_preflight_with;
#[cfg(test)]
use preflight::PREFLIGHT_APPLY_STRATEGY;
use queue::{format_duration_ms, render_queue, run_queue_unlock};
use semantic_review::run_review_with;
#[cfg(test)]
use semantic_review::{
    build_local_semantic_review_report, codex_semantic_review_command, run_review_with_adapter,
    LocalSemanticReviewReport, SemanticReviewAdapter, SemanticReviewAdapterRequest,
};
use session::{
    cleanup_session_with, complete_session_with, prune_sessions_with, start_session_with,
};
use status::render_status;

static SEMANTIC_REVIEW_COUNTER: AtomicU64 = AtomicU64::new(1);

pub(crate) const MILLIS_PER_SECOND: i64 = 1_000;
pub(crate) const QUEUE_LOCK_STALE_AFTER_MS: i64 = 30 * 60 * MILLIS_PER_SECOND;
pub(crate) const DEFAULT_OPERATOR_ID: &str = "local-user";
pub(crate) const DEFAULT_OPERATOR_NAME: &str = "Local User";
pub(crate) const CHANGE_MANIFEST_VALIDATION_STATUS: &str = "generated_from_diff";
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
pub struct SessionAgentRunResult {
    pub session: Session,
    pub operator: Operator,
    pub provider: String,
    pub command: String,
    pub artifact_dir: PathBuf,
    pub input_path: PathBuf,
    pub stdout_path: PathBuf,
    pub stderr_path: PathBuf,
    pub metadata_path: PathBuf,
    pub exit_code: Option<i32>,
    pub success: bool,
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
    pub latest_attempt: Option<MergeAttempt>,
    pub cleanup: CleanupSessionWorktreeOutcome,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct SessionPruneResult {
    pub cleaned: Vec<SessionCleanupResult>,
    pub skipped: usize,
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
        Some("run") => {
            let options = parse_session_run_options(&args[1..], cwd)?;
            let result = run_session_agent_with(&options)?;
            writeln!(out, "Ran session agent {}", result.session.id)?;
            writeln!(out, "Operator: {}", result.operator.id)?;
            writeln!(out, "Provider: {}", result.provider)?;
            writeln!(out, "Command: {}", result.command)?;
            writeln!(out, "Exit code: {}", result.exit_code.unwrap_or(-1))?;
            writeln!(out, "Artifacts: {}", result.artifact_dir.display())?;
            writeln!(out, "Stdout: {}", result.stdout_path.display())?;
            writeln!(out, "Stderr: {}", result.stderr_path.display())?;
            writeln!(
                out,
                "Next: inspect the worktree, then run `aich session complete {}`",
                result.session.id
            )?;
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

fn render_session_cleanup_result<W: Write>(
    result: &SessionCleanupResult,
    out: &mut W,
) -> Result<(), CliError> {
    writeln!(out, "Cleaned session {}", result.session.id)?;
    writeln!(
        out,
        "Merge attempt: {}",
        result
            .latest_attempt
            .as_ref()
            .map(|attempt| attempt.id.as_str())
            .unwrap_or("-")
    )?;
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

pub(crate) fn next_semantic_review_id(created_at_ms: i64) -> String {
    let counter = SEMANTIC_REVIEW_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("semantic-review-{created_at_ms}-{counter}")
}

pub(crate) fn latest_merge_attempt(
    ledger: &Ledger,
    session_id: &str,
) -> Result<Option<MergeAttempt>, CliError> {
    Ok(ledger.list_merge_attempts(session_id)?.into_iter().last())
}

fn write_usage<W: Write>(out: &mut W) -> Result<(), CliError> {
    writeln!(out, "{}", usage_text())?;
    Ok(())
}

pub(crate) fn usage_text() -> String {
    "Usage:\n  aich init [--repo PATH] [--db PATH]\n  aich status [--repo PATH] [--db PATH] [--recent-events N]\n  aich doctor [--repo PATH] [--db PATH]\n  aich queue [--repo PATH] [--db PATH]\n  aich queue unlock --force [--reason TEXT] [--repo PATH] [--db PATH]\n  aich auth whoami [--operator ID] [--repo PATH] [--db PATH]\n  aich auth operator add --id ID [--name NAME] [--role owner|maintainer|reviewer] [--repo PATH] [--db PATH]\n  aich auth operator list [--repo PATH] [--db PATH]\n  aich session start --goal TEXT [--provider PROVIDER] [--target PATH] [--operator ID] [--repo PATH] [--db PATH]\n  aich session run <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich session complete <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich session cleanup <session-id> [--repo PATH] [--db PATH]\n  aich session prune --applied|--inactive [--repo PATH] [--db PATH]\n  aich preflight <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich review <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich approve <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich apply <session-id> [--operator ID] [--repo PATH] [--db PATH]".to_string()
}

#[cfg(test)]
mod tests;
