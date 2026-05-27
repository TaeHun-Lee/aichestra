use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use aich_core::clock::now_millis;
use aich_core::{
    assert_verified_candidate_can_apply, Approval, ChangeManifest, ChangedFile, CheckResult,
    CheckResultStatus, ContextSnapshot, EventName, MergeAttempt, MergeAttemptStatus, NewEvent,
    Operator, OperatorRole, PatchSet, QueueLock, SemanticReview, SemanticRiskLevel, Session,
    SessionStatus,
};
use aich_git::{
    ApplyVerifiedCommitRequest, CheckCommand, CompleteSessionWorktreeOutcome,
    CompleteSessionWorktreeRequest, CreateWorktreeRequest, GitRepository, NativeGitWorktreeManager,
    PreflightBlocked, PreflightCheckOutput, PreflightOutcome, PreflightRequest, PreflightRunner,
    PreflightVerified, SessionWorktreeCompleter, VerifiedCommitApplier, WorktreeError,
    WorktreeManager,
};
use aich_ledger::{Ledger, MergeAttemptResultUpdate, MergeAttemptSemanticReviewUpdate};
use sha2::{Digest, Sha256};

static SESSION_COUNTER: AtomicU64 = AtomicU64::new(1);
static ARTIFACT_COUNTER: AtomicU64 = AtomicU64::new(1);
static MERGE_ATTEMPT_COUNTER: AtomicU64 = AtomicU64::new(1);
static SEMANTIC_REVIEW_COUNTER: AtomicU64 = AtomicU64::new(1);
static APPROVAL_COUNTER: AtomicU64 = AtomicU64::new(1);
static QUEUE_LOCK_COUNTER: AtomicU64 = AtomicU64::new(1);

const MILLIS_PER_SECOND: i64 = 1_000;
const QUEUE_LOCK_STALE_AFTER_MS: i64 = 30 * 60 * MILLIS_PER_SECOND;
const DEFAULT_OPERATOR_ID: &str = "local-user";
const DEFAULT_OPERATOR_NAME: &str = "Local User";
const CHANGE_MANIFEST_VALIDATION_STATUS: &str = "generated_from_diff";
const PREFLIGHT_APPLY_STRATEGY: &str = "merge_no_ff_commit";
const LOCAL_SEMANTIC_REVIEWER: &str = "local_mvp_static_reviewer";
const MERGE_QUEUE_LOCK_NAME: &str = "merge-queue";
const CONTEXT_SNAPSHOT_FILES: &[&str] = &[
    "AGENTS.md",
    "CLAUDE.md",
    ".aichestra/config.yaml",
    ".aichestra/prompts/change-manifest.md",
    ".aichestra/prompts/semantic-merge-review.md",
];

const DEFAULT_CONFIG: &str = r#"project:
  name: aichestra-local-mvp
  mode: local-single-user

storage:
  sqlite_path: .aichestra/aichestra.db
  artifact_dir: .aichestra/artifacts
  worktree_dir: .aichestra/worktrees
  sandbox_dir: .aichestra/sandboxes

sessions:
  branch_prefix: aich/session
  require_dedicated_worktree: true
  disallow_main_worktree_for_llm: true
  completion_trigger: human_command

auth:
  default_operator_id: local-user
  require_active_operator: true

merge:
  queue_mode: sequential
  sandbox_strategy: temporary_worktree
  apply_policy: verified_tree_only
  require_human_approval: true
  block_if_main_moved_after_preflight: true
  semantic_review_required: true

manifest:
  required: true
  validate_against_diff: true
  warn_on_context_hash_change: true
  block_on_manifest_diff_mismatch: false

checks:
  commands:
    - name: fmt
      command: cargo fmt --all -- --check
      required: true
    - name: clippy
      command: cargo clippy --all-targets -- -D warnings
      required: true
    - name: test
      command: cargo test --all
      required: true

semantic_review:
  reviewer_provider: codex
  prompt_path: .aichestra/prompts/semantic-merge-review.md
  risk_block_levels:
    - blocked
  allow_patch_suggestions: true
  auto_apply_patch_suggestions: false

context:
  files:
    - AGENTS.md
    - CLAUDE.md
    - .aichestra/config.yaml
    - .aichestra/prompts/change-manifest.md
    - .aichestra/prompts/semantic-merge-review.md
  hash_algorithm: sha256

safety:
  warn_if_main_dirty: true
  refuse_apply_if_main_dirty: true
  refuse_force_push_features: true
"#;

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
struct InitOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
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

#[derive(Debug, Clone, Eq, PartialEq)]
struct StatusOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    recent_events_limit: usize,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct QueueOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct QueueUnlockOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    force: bool,
    reason: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct DoctorOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct SessionStartOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    goal: String,
    provider: String,
    target_path: Option<String>,
    operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct SessionCompleteOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    session_id: String,
    operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct PreflightOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    session_id: String,
    operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct ReviewOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    session_id: String,
    operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct ApproveOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    session_id: String,
    operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct ApplyOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    session_id: String,
    operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct QueueEntry {
    session: Session,
    status: String,
    latest_attempt: Option<MergeAttempt>,
    latest_approval: Option<Approval>,
    latest_review: Option<SemanticReview>,
    check_count: usize,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct AuthWhoamiOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    operator_id: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct OperatorAddOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    id: String,
    display_name: Option<String>,
    role: OperatorRole,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct OperatorListOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
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

fn normalize_args<I, S>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: Into<String>,
{
    let mut args: Vec<String> = args.into_iter().map(Into::into).collect();
    if args
        .first()
        .map(|arg| arg.ends_with("aich") || arg.ends_with("aich.exe"))
        .unwrap_or(false)
    {
        args.remove(0);
    }
    args
}

fn parse_init_options(args: &[String], cwd: &Path) -> Result<InitOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown init option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(InitOptions { repo_root, db_path })
}

fn parse_status_options(args: &[String], cwd: &Path) -> Result<StatusOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut recent_events_limit = 5;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--recent-events" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage(
                        "--recent-events requires a number".to_string(),
                    ));
                };
                recent_events_limit = value.parse::<usize>().map_err(|_| {
                    CliError::Usage("--recent-events requires a non-negative number".to_string())
                })?;
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown status option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(StatusOptions {
        repo_root,
        db_path,
        recent_events_limit,
    })
}

fn parse_doctor_options(args: &[String], cwd: &Path) -> Result<DoctorOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown doctor option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(DoctorOptions { repo_root, db_path })
}

fn parse_queue_options(args: &[String], cwd: &Path) -> Result<QueueOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown queue option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(QueueOptions { repo_root, db_path })
}

fn parse_queue_unlock_options(args: &[String], cwd: &Path) -> Result<QueueUnlockOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut force = false;
    let mut reason = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--reason" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--reason requires text".to_string()));
                };
                reason = Some(value.clone());
            }
            "--force" => {
                force = true;
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown queue unlock option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    if !force {
        return Err(CliError::Usage(
            "queue unlock requires --force because it can release an active merge queue lock"
                .to_string(),
        ));
    }

    Ok(QueueUnlockOptions {
        repo_root,
        db_path,
        force,
        reason,
    })
}

fn parse_session_start_options(
    args: &[String],
    cwd: &Path,
) -> Result<SessionStartOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut goal = None;
    let mut provider = "codex".to_string();
    let mut target_path = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--goal" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--goal requires text".to_string()));
                };
                goal = Some(value.clone());
            }
            "--provider" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage(
                        "--provider requires a provider".to_string(),
                    ));
                };
                provider = value.clone();
            }
            "--target" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--target requires a path".to_string()));
                };
                target_path = Some(value.clone());
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown session start option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    let Some(goal) = goal.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage("session start requires --goal".to_string()));
    };

    Ok(SessionStartOptions {
        repo_root,
        db_path,
        goal,
        provider,
        target_path,
        operator_id,
    })
}

fn parse_session_complete_options(
    args: &[String],
    cwd: &Path,
) -> Result<SessionCompleteOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown session complete option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "session complete accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "session complete requires <session-id>".to_string(),
        ));
    };

    Ok(SessionCompleteOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

fn parse_preflight_options(args: &[String], cwd: &Path) -> Result<PreflightOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown preflight option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "preflight accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "preflight requires <session-id>".to_string(),
        ));
    };

    Ok(PreflightOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

fn parse_review_options(args: &[String], cwd: &Path) -> Result<ReviewOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown review option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "review accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage("review requires <session-id>".to_string()));
    };

    Ok(ReviewOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

fn parse_approve_options(args: &[String], cwd: &Path) -> Result<ApproveOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown approve option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "approve accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage("approve requires <session-id>".to_string()));
    };

    Ok(ApproveOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

fn parse_apply_options(args: &[String], cwd: &Path) -> Result<ApplyOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut session_id = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            value if value.starts_with('-') => {
                return Err(CliError::Usage(format!(
                    "unknown apply option '{value}'\n\n{}",
                    usage_text()
                )));
            }
            value => {
                if session_id.is_some() {
                    return Err(CliError::Usage(
                        "apply accepts only one session id".to_string(),
                    ));
                }
                session_id = Some(value.to_string());
            }
        }
        index += 1;
    }

    let Some(session_id) = session_id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage("apply requires <session-id>".to_string()));
    };

    Ok(ApplyOptions {
        repo_root,
        db_path,
        session_id,
        operator_id,
    })
}

fn parse_auth_whoami_options(args: &[String], cwd: &Path) -> Result<AuthWhoamiOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut operator_id = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--operator" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--operator requires an id".to_string()));
                };
                operator_id = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown auth whoami option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(AuthWhoamiOptions {
        repo_root,
        db_path,
        operator_id,
    })
}

fn parse_operator_add_options(args: &[String], cwd: &Path) -> Result<OperatorAddOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut id = None;
    let mut display_name = None;
    let mut role = OperatorRole::Reviewer;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--id" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--id requires an operator id".to_string()));
                };
                id = Some(value.clone());
            }
            "--name" | "--display-name" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--name requires text".to_string()));
                };
                display_name = Some(value.clone());
            }
            "--role" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--role requires a role".to_string()));
                };
                role = OperatorRole::parse(value).map_err(CliError::Usage)?;
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown auth operator add option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    let Some(id) = id.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage(
            "auth operator add requires --id".to_string(),
        ));
    };

    if matches!(display_name.as_deref(), Some(value) if value.trim().is_empty()) {
        return Err(CliError::Usage("--name must not be empty".to_string()));
    }

    Ok(OperatorAddOptions {
        repo_root,
        db_path,
        id,
        display_name,
        role,
    })
}

fn parse_operator_list_options(
    args: &[String],
    cwd: &Path,
) -> Result<OperatorListOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown auth operator list option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(OperatorListOptions { repo_root, db_path })
}

fn ledger_path(repo_root: &Path, db_path: &Option<PathBuf>) -> PathBuf {
    db_path
        .clone()
        .unwrap_or_else(|| repo_root.join(".aichestra").join("aichestra.db"))
}

fn open_existing_ledger(
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

fn resolve_active_operator(
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

fn render_queue<W: Write>(options: &QueueOptions, out: &mut W) -> Result<(), CliError> {
    let db_path = ledger_path(&options.repo_root, &options.db_path);
    if !db_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra ledger not found at {}; run `aich init` first",
            db_path.display()
        )));
    }

    let ledger = Ledger::open(&db_path)?;
    let entries = queue_entries(&ledger)?;
    let summary = queue_status_summary(&entries);
    let queue_lock = ledger.get_queue_lock(MERGE_QUEUE_LOCK_NAME)?;
    let now = now_millis();

    writeln!(out, "Aichestra queue")?;
    writeln!(out, "Repo: {}", options.repo_root.display())?;
    writeln!(out, "Ledger: {}", db_path.display())?;
    match queue_lock.as_ref() {
        Some(lock) => {
            writeln!(
                out,
                "Lock: held by {} ({}, session {})",
                lock.holder_id,
                lock.operation,
                lock.session_id.as_deref().unwrap_or("-")
            )?;
            let age_ms = queue_lock_age_ms(lock, now);
            writeln!(out, "Lock age: {}", format_duration_ms(age_ms))?;
            writeln!(
                out,
                "Lock stale: {}",
                if is_queue_lock_stale(lock, now) {
                    "yes"
                } else {
                    "no"
                }
            )?;
        }
        None => writeln!(out, "Lock: free")?,
    }
    writeln!(out, "Entries: {}", entries.len())?;
    writeln!(
        out,
        "Summary: enqueued={} preflight_running={} verified={} approved={} blocked={}",
        summary.enqueued,
        summary.preflight_running,
        summary.verified,
        summary.approved,
        summary.blocked
    )?;

    if entries.is_empty() {
        writeln!(out, "No queued candidates.")?;
        return Ok(());
    }

    for entry in entries {
        writeln!(out, "- {} [{}]", entry.session.id, entry.status)?;
        writeln!(out, "  goal: {}", entry.session.goal)?;
        writeln!(out, "  branch: {}", entry.session.branch)?;
        writeln!(
            out,
            "  target: {}",
            entry.session.target_path.as_deref().unwrap_or("-")
        )?;
        writeln!(
            out,
            "  candidate: {}",
            entry
                .session
                .head_commit
                .as_deref()
                .map(short_hash)
                .unwrap_or_else(|| "-".to_string())
        )?;
        if let Some(attempt) = entry.latest_attempt.as_ref() {
            writeln!(out, "  attempt: {}", attempt.id)?;
            writeln!(
                out,
                "  main_before: {}",
                short_hash(&attempt.main_before_commit)
            )?;
            if let Some(commit) = attempt.verified_commit_id.as_deref() {
                writeln!(out, "  verified_commit: {}", short_hash(commit))?;
            }
            if let Some(tree) = attempt.verified_tree_id.as_deref() {
                writeln!(out, "  verified_tree: {}", short_hash(tree))?;
            }
            writeln!(
                out,
                "  semantic_risk: {}",
                attempt.semantic_risk_level.as_deref().unwrap_or("unknown")
            )?;
            writeln!(
                out,
                "  checks: {}",
                queue_check_label(attempt, entry.check_count)
            )?;
        }
        if let Some(review) = entry.latest_review.as_ref() {
            writeln!(
                out,
                "  review: {} ({})",
                review.id,
                review.risk_level.as_str()
            )?;
        }
        if let Some(approval) = entry.latest_approval.as_ref() {
            writeln!(
                out,
                "  approval: {} by {}",
                approval.id, approval.approved_by
            )?;
        }
        writeln!(out, "  next: {}", queue_next_action(&entry))?;
    }

    Ok(())
}

fn run_queue_unlock(options: &QueueUnlockOptions) -> Result<QueueUnlockResult, CliError> {
    let db_path = ledger_path(&options.repo_root, &options.db_path);
    if !db_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra ledger not found at {}; run `aich init` first",
            db_path.display()
        )));
    }

    let ledger = Ledger::open(&db_path)?;
    let now = now_millis();
    let Some(lock) = ledger.get_queue_lock(MERGE_QUEUE_LOCK_NAME)? else {
        return Ok(QueueUnlockResult {
            released_lock: None,
            stale: false,
            age_ms: None,
        });
    };

    let age_ms = queue_lock_age_ms(&lock, now);
    let stale = is_queue_lock_stale(&lock, now);
    let released = ledger.release_queue_lock(&lock.name, &lock.holder_id)?;
    if !released {
        return Err(CliError::Usage(
            "queue lock changed while unlocking; run `aich queue` and retry if needed".to_string(),
        ));
    }

    ledger.append_event(
        &NewEvent::new(EventName::MergeQueueUnlocked)
            .with_subject("queue_lock", lock.name.clone())
            .with_data_json(format!(
                "{{\"holder_id\":\"{}\",\"operation\":\"{}\",\"session_id\":\"{}\",\"force\":{},\"stale\":{},\"age_ms\":{},\"reason\":\"{}\"}}",
                json_escape(&lock.holder_id),
                json_escape(&lock.operation),
                json_escape(lock.session_id.as_deref().unwrap_or("")),
                options.force,
                stale,
                age_ms,
                json_escape(options.reason.as_deref().unwrap_or(""))
            )),
    )?;

    Ok(QueueUnlockResult {
        released_lock: Some(lock),
        stale,
        age_ms: Some(age_ms),
    })
}

fn queue_lock_age_ms(lock: &QueueLock, now_ms: i64) -> i64 {
    now_ms.saturating_sub(lock.acquired_at_ms)
}

fn is_queue_lock_stale(lock: &QueueLock, now_ms: i64) -> bool {
    queue_lock_age_ms(lock, now_ms) >= QUEUE_LOCK_STALE_AFTER_MS
}

fn format_duration_ms(ms: i64) -> String {
    let seconds = ms.max(0) / MILLIS_PER_SECOND;
    if seconds < 60 {
        format!("{seconds}s")
    } else if seconds < 60 * 60 {
        format!("{}m {}s", seconds / 60, seconds % 60)
    } else {
        format!("{}h {}m", seconds / 3600, (seconds % 3600) / 60)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
struct QueueStatusSummary {
    enqueued: usize,
    preflight_running: usize,
    verified: usize,
    approved: usize,
    blocked: usize,
}

fn queue_entries(ledger: &Ledger) -> Result<Vec<QueueEntry>, CliError> {
    let mut entries = Vec::new();

    for session in ledger.list_sessions()? {
        let attempts = ledger.list_merge_attempts(&session.id)?;
        let latest_attempt = attempts.into_iter().last();
        let mut latest_approval = None;
        let mut latest_review = None;
        let mut check_count = 0;

        if let Some(attempt) = latest_attempt.as_ref() {
            latest_approval = ledger.list_approvals(&attempt.id)?.into_iter().last();
            latest_review = ledger
                .list_semantic_reviews(&attempt.id)?
                .into_iter()
                .last();
            check_count = ledger.list_check_results(&attempt.id)?.len();
        }

        let Some(status) =
            queue_entry_status(&session, latest_attempt.as_ref(), latest_approval.as_ref())
        else {
            continue;
        };

        entries.push(QueueEntry {
            session,
            status,
            latest_attempt,
            latest_approval,
            latest_review,
            check_count,
        });
    }

    Ok(entries)
}

fn queue_entry_status(
    session: &Session,
    latest_attempt: Option<&MergeAttempt>,
    latest_approval: Option<&Approval>,
) -> Option<String> {
    match latest_attempt {
        Some(attempt) => match attempt.status {
            MergeAttemptStatus::PreflightRunning | MergeAttemptStatus::Applying => {
                Some("preflight_running".to_string())
            }
            MergeAttemptStatus::Blocked => Some("blocked".to_string()),
            MergeAttemptStatus::Verified if latest_approval.is_some() => {
                Some("approved".to_string())
            }
            MergeAttemptStatus::Verified => Some("verified".to_string()),
            MergeAttemptStatus::Pending if session.status == SessionStatus::Enqueued => {
                Some("enqueued".to_string())
            }
            MergeAttemptStatus::Applied => None,
            MergeAttemptStatus::Pending => None,
        },
        None if session.status == SessionStatus::Enqueued => Some("enqueued".to_string()),
        None => None,
    }
}

fn queue_status_summary(entries: &[QueueEntry]) -> QueueStatusSummary {
    let mut summary = QueueStatusSummary::default();
    for entry in entries {
        match entry.status.as_str() {
            "enqueued" => summary.enqueued += 1,
            "preflight_running" => summary.preflight_running += 1,
            "verified" => summary.verified += 1,
            "approved" => summary.approved += 1,
            "blocked" => summary.blocked += 1,
            _ => {}
        }
    }
    summary
}

fn queue_check_label(attempt: &MergeAttempt, check_count: usize) -> String {
    if check_count == 0 {
        "none".to_string()
    } else if attempt.checks_passed {
        format!("{check_count} passed")
    } else {
        format!("{check_count} recorded, not passed")
    }
}

fn queue_next_action(entry: &QueueEntry) -> String {
    match entry.status.as_str() {
        "enqueued" => format!("aich preflight {}", entry.session.id),
        "preflight_running" => "wait for preflight to finish or inspect artifacts".to_string(),
        "verified" => format!("aich review {}", entry.session.id),
        "approved" => format!("aich apply {}", entry.session.id),
        "blocked" => "revise candidate, then run aich preflight again".to_string(),
        _ => "-".to_string(),
    }
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
    let head = git_repo.head_commit(&options.repo_root)?;
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

    let main_before = git_repo.head_commit(&options.repo_root)?.commit_id;
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

fn next_semantic_review_id(created_at_ms: i64) -> String {
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

#[derive(Clone, Debug, Eq, PartialEq)]
struct SemanticConflictFinding {
    conflict_type: String,
    files: Vec<String>,
    explanation: String,
    confidence: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct LocalSemanticReviewReport {
    risk_level: SemanticRiskLevel,
    summary: String,
    suspected_conflicts: Vec<SemanticConflictFinding>,
    required_actions: Vec<String>,
    suggested_tests: Vec<String>,
    uncertainty: Vec<String>,
}

fn run_review_with(options: &ReviewOptions) -> Result<ReviewRunResult, CliError> {
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
    let manifest = ledger
        .list_change_manifests(&session.id)?
        .into_iter()
        .last()
        .ok_or_else(|| {
            CliError::Usage(format!(
                "session '{}' has no Change Manifest; run `aich session complete {}` first",
                session.id, session.id
            ))
        })?;
    let attempt = latest_merge_attempt(&ledger, &session.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no preflight attempt; run `aich preflight {}` first",
            session.id, session.id
        ))
    })?;
    ensure_attempt_can_be_reviewed(&attempt)?;

    let patch_set = ledger.list_patch_sets(&session.id)?.into_iter().last();
    let changed_files = match patch_set.as_ref() {
        Some(patch_set) => ledger.list_changed_files(&patch_set.id)?,
        None => Vec::new(),
    };
    let check_results = ledger.list_check_results(&attempt.id)?;
    let manifest_path = path_from_ledger(&options.repo_root, &manifest.manifest_path);
    let manifest_content = read_optional_text(&manifest_path)?;
    let manifest_hash_mismatch = manifest_content
        .as_ref()
        .zip(manifest.manifest_hash.as_ref())
        .is_some_and(|(content, expected)| sha256_hex(content.as_bytes()) != *expected);
    let prompt_path = semantic_review_prompt_path_from_config(&config_path);
    let prompt_content = read_optional_text(&path_from_ledger(&options.repo_root, &prompt_path))?;

    let report = build_local_semantic_review_report(
        &manifest,
        manifest_content.as_deref(),
        manifest_hash_mismatch,
        &attempt,
        &changed_files,
        &check_results,
    );
    let created_at_ms = now_millis();
    let review_id = next_semantic_review_id(created_at_ms);
    let artifact_dir = aichestra_dir
        .join("artifacts")
        .join("merge-attempts")
        .join(&attempt.id);
    fs::create_dir_all(&artifact_dir)?;
    let input_path = artifact_dir.join(format!("{review_id}-input.md"));
    let report_path = artifact_dir.join(format!("{review_id}.yaml"));
    let input = render_semantic_review_input(SemanticReviewInput {
        session: &session,
        attempt: &attempt,
        manifest: &manifest,
        manifest_content: manifest_content.as_deref(),
        patch_set: patch_set.as_ref(),
        changed_files: &changed_files,
        check_results: &check_results,
        config_path: &config_path,
        prompt_path: &prompt_path,
        prompt_content: prompt_content.as_deref(),
    });
    fs::write(&input_path, input)?;
    let report_yaml = render_semantic_review_yaml(
        &review_id,
        &session,
        &attempt,
        &operator,
        &report,
        &display_path_for_ledger(&options.repo_root, &input_path),
    );
    fs::write(&report_path, report_yaml)?;

    let semantic_review = SemanticReview {
        id: review_id,
        merge_attempt_id: attempt.id.clone(),
        risk_level: report.risk_level,
        report_path: Some(display_path_for_ledger(&options.repo_root, &report_path)),
        created_at_ms,
    };
    ledger.insert_semantic_review(&semantic_review)?;

    let block_levels = semantic_block_levels_from_config(&config_path)?;
    let blocked = block_levels.contains(&report.risk_level);
    ledger.update_merge_attempt_semantic_review(MergeAttemptSemanticReviewUpdate {
        id: &attempt.id,
        status: if blocked {
            MergeAttemptStatus::Blocked
        } else {
            MergeAttemptStatus::Verified
        },
        semantic_risk_level: report.risk_level,
        updated_at_ms: now_millis(),
    })?;
    ledger.append_event(
        &NewEvent::new(EventName::MergeSemanticReviewCompleted)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"semantic_review_id\":\"{}\",\"risk_level\":\"{}\",\"blocked\":{}}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&semantic_review.id),
                report.risk_level.as_str(),
                blocked
            )),
    )?;
    if blocked {
        ledger.append_event(
            &NewEvent::new(EventName::MergeBlocked)
                .with_subject("merge_attempt", attempt.id.clone())
                .with_data_json(format!(
                    "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"reason\":\"semantic_review\",\"risk_level\":\"{}\"}}",
                    json_escape(&operator.id),
                    json_escape(&session.id),
                    report.risk_level.as_str()
                )),
        )?;
    }

    let merge_attempt = ledger
        .get_merge_attempt(&attempt.id)?
        .ok_or_else(|| CliError::Usage(format!("merge attempt '{}' does not exist", attempt.id)))?;

    Ok(ReviewRunResult {
        semantic_review,
        merge_attempt,
        operator,
        report_path,
        summary: report.summary,
        required_actions: report.required_actions,
        suggested_tests: report.suggested_tests,
        blocked,
    })
}

fn latest_merge_attempt(
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

    let current_main = git_repo.head_commit(&options.repo_root)?.commit_id;
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

    let current_main = git_repo.head_commit(&options.repo_root)?.commit_id;
    assert_verified_candidate_can_apply(&attempt, &approval, &current_main)
        .map_err(|error| CliError::Usage(format!("candidate cannot be applied: {error}")))?;

    ledger.update_merge_attempt_status(&attempt.id, MergeAttemptStatus::Applying, now_millis())?;
    let applied = match applier.apply_verified_commit(&ApplyVerifiedCommitRequest {
        repo_path: options.repo_root.clone(),
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

fn ensure_attempt_can_be_reviewed(attempt: &MergeAttempt) -> Result<(), CliError> {
    if attempt.status != MergeAttemptStatus::Verified {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is not verified; run `aich preflight {}` again",
            attempt.id, attempt.session_id
        )));
    }
    if !attempt.checks_passed {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' did not pass checks; fix the candidate and run preflight again",
            attempt.id
        )));
    }
    if attempt.verified_tree_id.as_deref().unwrap_or("").is_empty()
        || attempt
            .verified_commit_id
            .as_deref()
            .unwrap_or("")
            .is_empty()
    {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' has no verified tree/commit; run `aich preflight {}` again",
            attempt.id, attempt.session_id
        )));
    }

    Ok(())
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

fn build_local_semantic_review_report(
    manifest: &ChangeManifest,
    manifest_content: Option<&str>,
    manifest_hash_mismatch: bool,
    attempt: &MergeAttempt,
    changed_files: &[ChangedFile],
    check_results: &[CheckResult],
) -> LocalSemanticReviewReport {
    let mut findings = Vec::new();
    let mut required_actions = Vec::new();
    let mut suggested_tests = Vec::new();
    let mut uncertainty = vec![
        "The MVP local reviewer does not build a call graph or run a remote LLM provider."
            .to_string(),
        "Clean Git merge and passing checks do not prove business-level correctness.".to_string(),
    ];

    if manifest_content.is_none() {
        findings.push(SemanticConflictFinding {
            conflict_type: "manifest_mismatch".to_string(),
            files: vec![manifest.manifest_path.clone()],
            explanation: "The Change Manifest artifact recorded in the ledger is missing."
                .to_string(),
            confidence: "high".to_string(),
        });
        required_actions
            .push("Restore or regenerate the Change Manifest before approval.".to_string());
    }

    if manifest_hash_mismatch {
        findings.push(SemanticConflictFinding {
            conflict_type: "manifest_mismatch".to_string(),
            files: vec![manifest.manifest_path.clone()],
            explanation: "The Change Manifest artifact hash no longer matches the ledger record."
                .to_string(),
            confidence: "high".to_string(),
        });
        required_actions.push(
            "Inspect the manifest artifact for drift and regenerate completion evidence if needed."
                .to_string(),
        );
    }

    let missing_manifest_files =
        changed_files_missing_from_manifest(changed_files, manifest_content);
    if !missing_manifest_files.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "manifest_mismatch".to_string(),
            files: missing_manifest_files.clone(),
            explanation: "Actual changed files are not all represented in the Change Manifest."
                .to_string(),
            confidence: "high".to_string(),
        });
        required_actions.push(
            "Update the Change Manifest so it matches the actual diff before approval.".to_string(),
        );
    }

    if changed_files.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "unknown".to_string(),
            files: Vec::new(),
            explanation: "No changed-file evidence is available for this candidate.".to_string(),
            confidence: "high".to_string(),
        });
        required_actions
            .push("Re-run session completion so changed-file evidence is recorded.".to_string());
    }

    let failed_checks: Vec<String> = check_results
        .iter()
        .filter(|check| check.result == CheckResultStatus::Failed)
        .map(|check| check.name.clone())
        .collect();
    if !attempt.checks_passed || !failed_checks.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "test_gap".to_string(),
            files: Vec::new(),
            explanation: format!(
                "The verified candidate does not have a clean check gate: {}",
                failed_checks.join(", ")
            ),
            confidence: "high".to_string(),
        });
        required_actions.push("Fix failing checks and run `aich preflight` again.".to_string());
    }

    if check_results.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "test_gap".to_string(),
            files: Vec::new(),
            explanation: "No preflight check results are recorded for this merge attempt."
                .to_string(),
            confidence: "medium".to_string(),
        });
        required_actions.push("Run preflight with configured checks before approval.".to_string());
    }

    let shared_contract_files = shared_contract_files(changed_files);
    if !shared_contract_files.is_empty() {
        findings.push(SemanticConflictFinding {
            conflict_type: "api_contract_change".to_string(),
            files: shared_contract_files.clone(),
            explanation:
                "The candidate touches shared API, schema, dependency, config, or migration surfaces."
                    .to_string(),
            confidence: "medium".to_string(),
        });
        required_actions.push(
            "Confirm compatibility assumptions and dependent call sites before approval."
                .to_string(),
        );
        suggested_tests.push(
            "Run targeted tests around the touched shared contract or config surface.".to_string(),
        );
    }

    if manifest.validation_status == CHANGE_MANIFEST_VALIDATION_STATUS {
        uncertainty.push(
            "The Change Manifest was generated from diff metadata, so intent details may be incomplete."
                .to_string(),
        );
    }

    suggested_tests.extend(check_results.iter().map(|check| {
        format!(
            "Keep `{}` green for the verified sandbox tree.",
            check.command
        )
    }));
    if suggested_tests.is_empty() {
        suggested_tests
            .push("Run the target repo's configured test/typecheck/lint gate.".to_string());
    }

    let risk_level = if findings.iter().any(|finding| {
        finding.confidence == "high"
            && matches!(
                finding.conflict_type.as_str(),
                "manifest_mismatch" | "unknown"
            )
    }) || !failed_checks.is_empty()
        || !attempt.checks_passed
    {
        SemanticRiskLevel::Blocked
    } else if !shared_contract_files.is_empty() {
        SemanticRiskLevel::High
    } else if manifest.validation_status == CHANGE_MANIFEST_VALIDATION_STATUS
        || check_results.is_empty()
    {
        SemanticRiskLevel::Medium
    } else {
        SemanticRiskLevel::Low
    };

    let summary = match risk_level {
        SemanticRiskLevel::Blocked => {
            "Semantic review found blocking evidence gaps or manifest/check mismatches.".to_string()
        }
        SemanticRiskLevel::High => {
            "No blocking evidence gap was found, but the candidate touches shared contract surfaces."
                .to_string()
        }
        SemanticRiskLevel::Medium => {
            "No direct blocker was found; review remains conservative because intent is generated from diff evidence."
                .to_string()
        }
        SemanticRiskLevel::Low => {
            "No direct semantic conflict was found from recorded manifest, diff, and check evidence."
                .to_string()
        }
    };

    LocalSemanticReviewReport {
        risk_level,
        summary,
        suspected_conflicts: findings,
        required_actions,
        suggested_tests,
        uncertainty,
    }
}

fn changed_files_missing_from_manifest(
    changed_files: &[ChangedFile],
    manifest_content: Option<&str>,
) -> Vec<String> {
    let Some(manifest_content) = manifest_content else {
        return Vec::new();
    };

    changed_files
        .iter()
        .filter(|file| !manifest_content.contains(&file.path))
        .map(|file| file.path.clone())
        .collect()
}

fn shared_contract_files(changed_files: &[ChangedFile]) -> Vec<String> {
    changed_files
        .iter()
        .filter(|file| is_shared_contract_path(&file.path))
        .map(|file| file.path.clone())
        .collect()
}

fn is_shared_contract_path(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower == "cargo.toml"
        || lower == "cargo.lock"
        || lower.ends_with("/cargo.toml")
        || lower.ends_with("/cargo.lock")
        || lower.contains("migration")
        || lower.contains("schema")
        || lower.contains("config")
        || lower.contains("types")
        || lower.ends_with("/lib.rs")
        || lower.ends_with("/mod.rs")
}

struct SemanticReviewInput<'a> {
    session: &'a Session,
    attempt: &'a MergeAttempt,
    manifest: &'a ChangeManifest,
    manifest_content: Option<&'a str>,
    patch_set: Option<&'a PatchSet>,
    changed_files: &'a [ChangedFile],
    check_results: &'a [CheckResult],
    config_path: &'a Path,
    prompt_path: &'a str,
    prompt_content: Option<&'a str>,
}

fn render_semantic_review_input(input: SemanticReviewInput<'_>) -> String {
    let mut output = String::new();
    output.push_str("# Semantic Review Input\n\n");
    output.push_str(&format!("- reviewer: `{LOCAL_SEMANTIC_REVIEWER}`\n"));
    output.push_str("- llm_executed: `false`\n");
    output.push_str(&format!("- session_id: `{}`\n", input.session.id));
    output.push_str(&format!("- goal: `{}`\n", input.session.goal));
    output.push_str(&format!("- merge_attempt_id: `{}`\n", input.attempt.id));
    output.push_str(&format!(
        "- verified_tree_id: `{}`\n",
        input.attempt.verified_tree_id.as_deref().unwrap_or("")
    ));
    output.push_str(&format!(
        "- verified_commit_id: `{}`\n",
        input.attempt.verified_commit_id.as_deref().unwrap_or("")
    ));
    output.push_str(&format!(
        "- config_path: `{}`\n",
        input.config_path.display()
    ));
    output.push_str(&format!("- prompt_path: `{}`\n", input.prompt_path));
    output.push_str("\n## Change Manifest\n\n");
    output.push_str(&format!("- id: `{}`\n", input.manifest.id));
    output.push_str(&format!("- path: `{}`\n", input.manifest.manifest_path));
    output.push_str(&format!(
        "- validation_status: `{}`\n\n",
        input.manifest.validation_status
    ));
    match input.manifest_content {
        Some(content) => {
            output.push_str("```yaml\n");
            output.push_str(content);
            if !content.ends_with('\n') {
                output.push('\n');
            }
            output.push_str("```\n\n");
        }
        None => output.push_str("_Manifest artifact could not be read._\n\n"),
    }

    output.push_str("## Diff Evidence\n\n");
    if let Some(patch_set) = input.patch_set {
        output.push_str(&format!("- patch_set_id: `{}`\n", patch_set.id));
        output.push_str(&format!("- base_commit: `{}`\n", patch_set.base_commit));
        output.push_str(&format!(
            "- head_commit: `{}`\n",
            patch_set.head_commit.as_deref().unwrap_or("")
        ));
        if let Some(diff_stat) = patch_set.diff_stat.as_deref() {
            output.push_str("\n```text\n");
            output.push_str(diff_stat);
            if !diff_stat.ends_with('\n') {
                output.push('\n');
            }
            output.push_str("```\n");
        }
    } else {
        output.push_str("_No patch set evidence is recorded._\n");
    }

    output.push_str("\n## Changed Files\n\n");
    if input.changed_files.is_empty() {
        output.push_str("- none recorded\n");
    } else {
        for file in input.changed_files {
            output.push_str(&format!("- `{}` ({})\n", file.path, file.change_type));
        }
    }

    output.push_str("\n## Check Results\n\n");
    if input.check_results.is_empty() {
        output.push_str("- none recorded\n");
    } else {
        for check in input.check_results {
            output.push_str(&format!(
                "- `{}`: {} via `{}`\n",
                check.name,
                check.result.as_str(),
                check.command
            ));
        }
    }

    output.push_str("\n## Prompt\n\n");
    match input.prompt_content {
        Some(content) => {
            output.push_str("```markdown\n");
            output.push_str(content);
            if !content.ends_with('\n') {
                output.push('\n');
            }
            output.push_str("```\n");
        }
        None => output.push_str("_Semantic review prompt artifact could not be read._\n"),
    }

    output
}

fn render_semantic_review_yaml(
    review_id: &str,
    session: &Session,
    attempt: &MergeAttempt,
    operator: &Operator,
    report: &LocalSemanticReviewReport,
    input_artifact: &str,
) -> String {
    let mut output = String::new();
    output.push_str("semantic_review:\n");
    output.push_str(&format!("  id: {}\n", yaml_quote(review_id)));
    output.push_str(&format!("  session_id: {}\n", yaml_quote(&session.id)));
    output.push_str(&format!(
        "  merge_attempt_id: {}\n",
        yaml_quote(&attempt.id)
    ));
    output.push_str(&format!(
        "  reviewer: {}\n",
        yaml_quote(LOCAL_SEMANTIC_REVIEWER)
    ));
    output.push_str("  llm_executed: false\n");
    output.push_str(&format!("  operator_id: {}\n", yaml_quote(&operator.id)));
    output.push_str(&format!(
        "  risk_level: {}\n",
        yaml_quote(report.risk_level.as_str())
    ));
    output.push_str(&format!("  summary: {}\n", yaml_quote(&report.summary)));
    output.push_str(&format!(
        "  input_artifact: {}\n",
        yaml_quote(input_artifact)
    ));
    output.push_str("  suspected_conflicts:\n");
    append_semantic_conflicts_yaml(&mut output, &report.suspected_conflicts, 4);
    output.push_str("  required_actions:\n");
    append_string_list_yaml(&mut output, &report.required_actions, 4);
    output.push_str("  suggested_tests:\n");
    append_string_list_yaml(&mut output, &report.suggested_tests, 4);
    output.push_str("  proposed_patch:\n");
    output.push_str("    available: false\n");
    output.push_str("    description: \"\"\n");
    output.push_str("    patch_artifact: \"\"\n");
    output.push_str("  uncertainty:\n");
    append_string_list_yaml(&mut output, &report.uncertainty, 4);
    output
}

fn append_semantic_conflicts_yaml(
    output: &mut String,
    findings: &[SemanticConflictFinding],
    indent: usize,
) {
    if findings.is_empty() {
        output.push_str(&format!("{}[]\n", " ".repeat(indent)));
        return;
    }

    for finding in findings {
        output.push_str(&format!(
            "{}- type: {}\n",
            " ".repeat(indent),
            yaml_quote(&finding.conflict_type)
        ));
        output.push_str(&format!("{}  files:\n", " ".repeat(indent)));
        append_string_list_yaml(output, &finding.files, indent + 4);
        output.push_str(&format!("{}  symbols: []\n", " ".repeat(indent)));
        output.push_str(&format!(
            "{}  explanation: {}\n",
            " ".repeat(indent),
            yaml_quote(&finding.explanation)
        ));
        output.push_str(&format!(
            "{}  confidence: {}\n",
            " ".repeat(indent),
            yaml_quote(&finding.confidence)
        ));
    }
}

fn append_string_list_yaml(output: &mut String, values: &[String], indent: usize) {
    if values.is_empty() {
        output.push_str(&format!("{}[]\n", " ".repeat(indent)));
        return;
    }

    for value in values {
        output.push_str(&format!("{}- {}\n", " ".repeat(indent), yaml_quote(value)));
    }
}

fn semantic_review_prompt_path_from_config(config_path: &Path) -> String {
    let Ok(config) = fs::read_to_string(config_path) else {
        return ".aichestra/prompts/semantic-merge-review.md".to_string();
    };
    let mut in_semantic_review = false;

    for line in config.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if !line.starts_with(' ') && trimmed.ends_with(':') {
            in_semantic_review = trimmed == "semantic_review:";
            continue;
        }

        if in_semantic_review {
            if let Some(value) = trimmed.strip_prefix("prompt_path:") {
                let prompt_path = strip_yaml_scalar(value);
                if !prompt_path.trim().is_empty() {
                    return prompt_path;
                }
            }
        }
    }

    ".aichestra/prompts/semantic-merge-review.md".to_string()
}

fn semantic_block_levels_from_config(
    config_path: &Path,
) -> Result<Vec<SemanticRiskLevel>, CliError> {
    let config = fs::read_to_string(config_path)?;
    let mut block_levels = Vec::new();
    let mut in_semantic_review = false;
    let mut in_block_levels = false;

    for line in config.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if !line.starts_with(' ') && trimmed.ends_with(':') {
            in_semantic_review = trimmed == "semantic_review:";
            in_block_levels = false;
            continue;
        }

        if !in_semantic_review {
            continue;
        }

        if trimmed == "risk_block_levels:" {
            in_block_levels = true;
            continue;
        }

        if in_block_levels {
            if let Some(value) = trimmed.strip_prefix('-') {
                block_levels.push(
                    SemanticRiskLevel::parse(strip_yaml_scalar(value).as_str())
                        .map_err(CliError::Usage)?,
                );
            } else if !line.starts_with("    ") {
                in_block_levels = false;
            }
        }
    }

    if block_levels.is_empty() {
        block_levels.push(SemanticRiskLevel::Blocked);
    }

    Ok(block_levels)
}

fn path_from_ledger(repo_root: &Path, path: &str) -> PathBuf {
    let path = PathBuf::from(path);
    if path.is_absolute() {
        path
    } else {
        repo_root.join(path)
    }
}

fn read_optional_text(path: &Path) -> Result<Option<String>, CliError> {
    match fs::read_to_string(path) {
        Ok(value) => Ok(Some(value)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(CliError::Io(error)),
    }
}

fn persist_preflight_checks(
    ledger: &Ledger,
    attempt_id: &str,
    artifact_dir: &Path,
    repo_root: &Path,
    checks: &[PreflightCheckOutput],
) -> Result<Vec<CheckResult>, CliError> {
    let check_dir = artifact_dir.join("checks");
    fs::create_dir_all(&check_dir)?;

    let mut results = Vec::new();
    for (index, check) in checks.iter().enumerate() {
        let safe_name = sanitize_artifact_name(&check.name);
        let stdout_path = check_dir.join(format!("{index}-{safe_name}.stdout"));
        let stderr_path = check_dir.join(format!("{index}-{safe_name}.stderr"));
        fs::write(&stdout_path, &check.stdout)?;
        fs::write(&stderr_path, &check.stderr)?;

        let check_result = CheckResult {
            id: format!("{attempt_id}-check-{index}"),
            merge_attempt_id: attempt_id.to_string(),
            name: check.name.clone(),
            command: check.command.clone(),
            result: if check.passed {
                CheckResultStatus::Passed
            } else {
                CheckResultStatus::Failed
            },
            stdout_artifact: Some(display_path_for_ledger(repo_root, &stdout_path)),
            stderr_artifact: Some(display_path_for_ledger(repo_root, &stderr_path)),
            created_at_ms: now_millis(),
        };
        ledger.insert_check_result(&check_result)?;
        results.push(check_result);
    }

    Ok(results)
}

fn check_commands_from_config(config_path: &Path) -> Result<Vec<CheckCommand>, CliError> {
    let config = fs::read_to_string(config_path)?;
    let mut commands = Vec::new();
    let mut in_checks = false;
    let mut in_commands = false;
    let mut current_name: Option<String> = None;

    for line in config.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if !line.starts_with(' ') && trimmed.ends_with(':') {
            in_checks = trimmed == "checks:";
            in_commands = false;
            current_name = None;
            continue;
        }

        if !in_checks {
            continue;
        }

        if trimmed == "commands:" {
            in_commands = true;
            continue;
        }

        if !in_commands {
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("- name:") {
            current_name = Some(strip_yaml_scalar(value));
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("name:") {
            current_name = Some(strip_yaml_scalar(value));
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("command:") {
            let command_line = strip_yaml_scalar(value);
            let name = current_name
                .take()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| format!("check-{}", commands.len() + 1));
            commands.push(parse_check_command(&name, &command_line)?);
        }
    }

    if commands.is_empty() {
        commands.push(CheckCommand {
            name: "test".to_string(),
            program: "cargo".to_string(),
            args: vec!["test".to_string(), "--all".to_string()],
        });
    }

    Ok(commands)
}

fn parse_check_command(name: &str, command_line: &str) -> Result<CheckCommand, CliError> {
    let mut parts = command_line.split_whitespace();
    let Some(program) = parts.next() else {
        return Err(CliError::Usage(format!(
            "check command '{name}' must not be empty"
        )));
    };

    Ok(CheckCommand {
        name: name.to_string(),
        program: program.to_string(),
        args: parts.map(ToString::to_string).collect(),
    })
}

fn strip_yaml_scalar(value: &str) -> String {
    let value = value.trim();
    if value.len() >= 2 {
        let bytes = value.as_bytes();
        if (bytes[0] == b'"' && bytes[value.len() - 1] == b'"')
            || (bytes[0] == b'\'' && bytes[value.len() - 1] == b'\'')
        {
            return value[1..value.len() - 1].to_string();
        }
    }
    value.to_string()
}

fn sanitize_artifact_name(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect();

    if sanitized.is_empty() {
        "check".to_string()
    } else {
        sanitized
    }
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

fn context_snapshot_hash(repo_root: &Path) -> Result<String, CliError> {
    let mut hasher = Sha256::new();

    for relative_path in CONTEXT_SNAPSHOT_FILES {
        hasher.update(relative_path.as_bytes());
        hasher.update([0]);
        let path = repo_root.join(relative_path);
        match fs::read(&path) {
            Ok(bytes) => {
                hasher.update(b"present");
                hasher.update([0]);
                hasher.update(bytes);
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                hasher.update(b"missing");
            }
            Err(error) => return Err(CliError::Io(error)),
        }
        hasher.update([0]);
    }

    Ok(hex_lower(&hasher.finalize()))
}

fn render_change_manifest(
    session: &Session,
    patch_set: &PatchSet,
    changed_files: &[ChangedFile],
    context_snapshot: &ContextSnapshot,
    diff_stat_path: &Path,
    diff_patch_path: &Path,
    repo_root: &Path,
) -> String {
    let created_files: Vec<&ChangedFile> = changed_files
        .iter()
        .filter(|file| file.change_type == "added")
        .collect();
    let deleted_or_renamed_files: Vec<&ChangedFile> = changed_files
        .iter()
        .filter(|file| file.change_type == "deleted" || file.change_type == "renamed")
        .collect();

    let mut output = String::new();
    output.push_str("change_manifest:\n");
    output.push_str(&format!("  session_id: {}\n", yaml_quote(&session.id)));
    output.push_str(&format!("  goal: {}\n", yaml_quote(&session.goal)));
    output.push_str(&format!("  provider: {}\n", yaml_quote(&session.provider)));
    output.push_str(&format!("  branch: {}\n", yaml_quote(&session.branch)));
    output.push_str(&format!(
        "  base_commit: {}\n",
        yaml_quote(&session.base_commit)
    ));
    output.push_str(&format!(
        "  head_commit: {}\n",
        yaml_quote(patch_set.head_commit.as_deref().unwrap_or(""))
    ));
    output.push_str(&format!(
        "  patch_id: {}\n",
        yaml_quote(patch_set.patch_id.as_deref().unwrap_or(""))
    ));
    output.push_str("  intent:\n");
    output.push_str("    summary: ");
    output.push_str(&yaml_quote(
        "Generated from the session goal and actual diff; review before semantic merge.",
    ));
    output.push('\n');
    output.push_str(&format!("    reason: {}\n", yaml_quote(&session.goal)));
    output.push_str("    expected_behavior: []\n");
    output.push_str("    non_goals: []\n");
    output.push_str("  changed_areas:\n");
    append_changed_areas_yaml(&mut output, changed_files, 4);
    output.push_str("  newly_created_files:\n");
    append_file_path_yaml(&mut output, &created_files, 4);
    output.push_str("  deleted_or_renamed_files:\n");
    append_file_path_yaml(&mut output, &deleted_or_renamed_files, 4);
    output.push_str("  compatibility_notes:\n");
    output.push_str("    breaking_change: false\n");
    output.push_str("    migration_required: []\n");
    output.push_str("    backward_compatibility: \"unknown until reviewed\"\n");
    output.push_str("  tests:\n");
    output.push_str("    added: []\n");
    output.push_str("    executed: []\n");
    output.push_str("  risks:\n");
    output.push_str("    level: \"unknown\"\n");
    output.push_str("    items:\n");
    output.push_str("      - \"This manifest was generated from Git diff metadata and still needs human review.\"\n");
    output.push_str("  uncertainty:\n");
    output.push_str(
        "    - \"Changed symbols and semantic impact are not inferred in this MVP path.\"\n",
    );
    output.push_str("  evidence:\n");
    output.push_str(&format!(
        "    diff_stat_artifact: {}\n",
        yaml_quote(&display_path_for_ledger(repo_root, diff_stat_path))
    ));
    output.push_str(&format!(
        "    diff_patch_artifact: {}\n",
        yaml_quote(&display_path_for_ledger(repo_root, diff_patch_path))
    ));
    output.push_str(&format!(
        "    context_snapshot_hash: {}\n",
        yaml_quote(&context_snapshot.snapshot_hash)
    ));
    output.push_str(&format!(
        "    validation_status: {}\n",
        yaml_quote(CHANGE_MANIFEST_VALIDATION_STATUS)
    ));
    output
}

fn append_changed_areas_yaml(output: &mut String, changed_files: &[ChangedFile], indent: usize) {
    if changed_files.is_empty() {
        output.push_str(&format!("{}[]\n", " ".repeat(indent)));
        return;
    }

    for file in changed_files {
        output.push_str(&format!(
            "{}- file: {}\n",
            " ".repeat(indent),
            yaml_quote(&file.path)
        ));
        output.push_str(&format!(
            "{}  change_type: {}\n",
            " ".repeat(indent),
            yaml_quote(&file.change_type)
        ));
        output.push_str(&format!("{}  symbols: []\n", " ".repeat(indent)));
        output.push_str(&format!(
            "{}  purpose: \"Detected by git diff during session completion.\"\n",
            " ".repeat(indent)
        ));
        output.push_str(&format!(
            "{}  semantic_impact: \"unknown\"\n",
            " ".repeat(indent)
        ));
        output.push_str(&format!("{}  before: \"\"\n", " ".repeat(indent)));
        output.push_str(&format!("{}  after: \"\"\n", " ".repeat(indent)));
    }
}

fn append_file_path_yaml(output: &mut String, changed_files: &[&ChangedFile], indent: usize) {
    if changed_files.is_empty() {
        output.push_str(&format!("{}[]\n", " ".repeat(indent)));
        return;
    }

    for file in changed_files {
        output.push_str(&format!(
            "{}- {}\n",
            " ".repeat(indent),
            yaml_quote(&file.path)
        ));
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    hex_lower(&Sha256::digest(bytes))
}

fn hex_lower(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push_str(&format!("{byte:02x}"));
    }
    output
}

fn yaml_quote(value: &str) -> String {
    format!(
        "\"{}\"",
        value
            .replace('\\', "\\\\")
            .replace('"', "\\\"")
            .replace('\n', "\\n")
    )
}

fn display_path_for_ledger(repo_root: &Path, path: &Path) -> String {
    path.strip_prefix(repo_root)
        .unwrap_or(path)
        .display()
        .to_string()
}

fn comparable_path(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

fn short_hash(value: &str) -> String {
    value.chars().take(7).collect()
}

fn write_usage<W: Write>(out: &mut W) -> Result<(), CliError> {
    writeln!(out, "{}", usage_text())?;
    Ok(())
}

fn usage_text() -> String {
    "Usage:\n  aich init [--repo PATH] [--db PATH]\n  aich status [--repo PATH] [--db PATH] [--recent-events N]\n  aich doctor [--repo PATH] [--db PATH]\n  aich queue [--repo PATH] [--db PATH]\n  aich queue unlock --force [--reason TEXT] [--repo PATH] [--db PATH]\n  aich auth whoami [--operator ID] [--repo PATH] [--db PATH]\n  aich auth operator add --id ID [--name NAME] [--role owner|maintainer|reviewer] [--repo PATH] [--db PATH]\n  aich auth operator list [--repo PATH] [--db PATH]\n  aich session start --goal TEXT [--provider PROVIDER] [--target PATH] [--operator ID] [--repo PATH] [--db PATH]\n  aich session complete <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich preflight <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich review <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich approve <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich apply <session-id> [--operator ID] [--repo PATH] [--db PATH]".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use aich_git::{validate_worktree_request, AppliedVerifiedCommit, HeadCommit, SessionWorktree};
    use aich_ledger::Ledger;
    use std::cell::RefCell;
    use std::env;
    use std::process;
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

    struct MockGitRepository;

    impl GitRepository for MockGitRepository {
        fn head_commit(&self, _repo_path: &Path) -> Result<HeadCommit, WorktreeError> {
            Ok(HeadCommit {
                commit_id: "base-commit".to_string(),
            })
        }
    }

    struct MockMovedGitRepository;

    impl GitRepository for MockMovedGitRepository {
        fn head_commit(&self, _repo_path: &Path) -> Result<HeadCommit, WorktreeError> {
            Ok(HeadCommit {
                commit_id: "other-main".to_string(),
            })
        }
    }

    struct MockWorktreeManager {
        requests: RefCell<Vec<CreateWorktreeRequest>>,
    }

    impl MockWorktreeManager {
        fn new() -> Self {
            Self {
                requests: RefCell::new(Vec::new()),
            }
        }
    }

    impl WorktreeManager for MockWorktreeManager {
        fn create_session_worktree(
            &self,
            request: &CreateWorktreeRequest,
        ) -> Result<SessionWorktree, WorktreeError> {
            validate_worktree_request(request)?;
            self.requests.borrow_mut().push(request.clone());
            Ok(SessionWorktree {
                session_id: request.session_id.clone(),
                branch: request.branch.clone(),
                path: request.worktree_path.clone(),
                base_ref: request.base_ref.clone(),
            })
        }
    }

    struct MockSessionCompleter {
        requests: RefCell<Vec<CompleteSessionWorktreeRequest>>,
        outcome: CompleteSessionWorktreeOutcome,
    }

    impl MockSessionCompleter {
        fn new(outcome: CompleteSessionWorktreeOutcome) -> Self {
            Self {
                requests: RefCell::new(Vec::new()),
                outcome,
            }
        }
    }

    struct MockPreflightRunner {
        requests: RefCell<Vec<PreflightRequest>>,
        outcome: PreflightOutcome,
    }

    impl MockPreflightRunner {
        fn new(outcome: PreflightOutcome) -> Self {
            Self {
                requests: RefCell::new(Vec::new()),
                outcome,
            }
        }
    }

    impl PreflightRunner for MockPreflightRunner {
        fn run_preflight(
            &self,
            request: &PreflightRequest,
        ) -> Result<PreflightOutcome, WorktreeError> {
            self.requests.borrow_mut().push(request.clone());
            Ok(self.outcome.clone())
        }
    }

    struct MockVerifiedCommitApplier {
        requests: RefCell<Vec<ApplyVerifiedCommitRequest>>,
        result: AppliedVerifiedCommit,
    }

    impl MockVerifiedCommitApplier {
        fn new(result: AppliedVerifiedCommit) -> Self {
            Self {
                requests: RefCell::new(Vec::new()),
                result,
            }
        }
    }

    impl VerifiedCommitApplier for MockVerifiedCommitApplier {
        fn apply_verified_commit(
            &self,
            request: &ApplyVerifiedCommitRequest,
        ) -> Result<AppliedVerifiedCommit, WorktreeError> {
            self.requests.borrow_mut().push(request.clone());
            Ok(self.result.clone())
        }
    }

    impl SessionWorktreeCompleter for MockSessionCompleter {
        fn complete_session_worktree(
            &self,
            request: &CompleteSessionWorktreeRequest,
        ) -> Result<CompleteSessionWorktreeOutcome, WorktreeError> {
            self.requests.borrow_mut().push(request.clone());
            Ok(self.outcome.clone())
        }
    }

    fn unique_temp_dir() -> PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_millis();
        let counter = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        env::temp_dir().join(format!(
            "aich-cli-test-{}-{millis}-{counter}",
            process::id()
        ))
    }

    #[test]
    fn init_creates_state_directories_config_db_and_event() {
        let repo = unique_temp_dir();
        let mut output = Vec::new();

        run_with_cwd(["aich", "init"], &repo, &mut output).expect("init");

        assert!(repo.join(".aichestra/config.yaml").exists());
        assert!(repo.join(".aichestra/artifacts").is_dir());
        assert!(repo.join(".aichestra/sandboxes").is_dir());
        assert!(repo.join(".aichestra/worktrees").is_dir());
        assert!(repo.join(".aichestra/aichestra.db").exists());

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let operators = ledger.list_operators().expect("operators");
        assert_eq!(operators.len(), 1);
        assert_eq!(operators[0].id, DEFAULT_OPERATOR_ID);
        assert_eq!(operators[0].role, OperatorRole::Owner);

        let events = ledger.list_events().expect("events");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].name, "repo.initialized");

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn auth_commands_show_default_operator_and_add_operator() {
        let repo = unique_temp_dir();
        let mut output = Vec::new();
        run_with_cwd(["aich", "init"], &repo, &mut output).expect("init");

        output.clear();
        run_with_cwd(["aich", "auth", "whoami"], &repo, &mut output).expect("whoami");
        let whoami = String::from_utf8(output.clone()).expect("utf8 output");
        assert!(whoami.contains("Operator: local-user"));
        assert!(whoami.contains("Role: owner"));

        output.clear();
        run_with_cwd(
            [
                "aich",
                "auth",
                "operator",
                "add",
                "--id",
                "alice",
                "--name",
                "Alice Maintainer",
                "--role",
                "maintainer",
            ],
            &repo,
            &mut output,
        )
        .expect("add operator");
        let add_output = String::from_utf8(output.clone()).expect("utf8 output");
        assert!(add_output.contains("Saved operator alice"));
        assert!(add_output.contains("Role: maintainer"));

        output.clear();
        run_with_cwd(["aich", "auth", "operator", "list"], &repo, &mut output)
            .expect("list operators");
        let list_output = String::from_utf8(output).expect("utf8 output");
        assert!(list_output.contains("Operators: 2"));
        assert!(list_output.contains("alice [maintainer / active] Alice Maintainer"));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn session_start_requires_goal() {
        let err = parse_session_start_options(&[], Path::new(".")).unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("--goal")));
    }

    #[test]
    fn session_complete_requires_session_id() {
        let err = parse_session_complete_options(&[], Path::new(".")).unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
    }

    #[test]
    fn preflight_requires_session_id() {
        let err = parse_preflight_options(&[], Path::new(".")).unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
    }

    #[test]
    fn review_requires_session_id() {
        let err = parse_review_options(&[], Path::new(".")).unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
    }

    #[test]
    fn approve_requires_session_id() {
        let err = parse_approve_options(&[], Path::new(".")).unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
    }

    #[test]
    fn apply_requires_session_id() {
        let err = parse_apply_options(&[], Path::new(".")).unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
    }

    #[test]
    fn queue_unlock_requires_force() {
        let err = parse_queue_unlock_options(&[], Path::new(".")).unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("--force")));
    }

    fn seed_verified_review_candidate(
        repo: &Path,
        changed_file_path: &str,
        write_manifest: bool,
    ) -> (Session, MergeAttempt) {
        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let now = now_millis();
        let mut session = Session::new(
            "session-review",
            "review candidate",
            "codex",
            "aich/session/session-review",
            ".aichestra/worktrees/session-review",
            "base-commit",
            now,
        );
        session.status = SessionStatus::Enqueued;
        session.head_commit = Some("head-commit".to_string());
        session.updated_at_ms = now + 1;
        ledger.insert_session(&session).expect("insert session");

        let patch_set = PatchSet {
            id: "patch-review".to_string(),
            session_id: session.id.clone(),
            base_commit: "base-commit".to_string(),
            head_commit: Some("head-commit".to_string()),
            patch_id: Some("head-commit".to_string()),
            diff_stat: Some(format!(" {changed_file_path} | 1 +\n 1 file changed\n")),
            created_at_ms: now + 2,
        };
        let changed_files = vec![ChangedFile::new(changed_file_path, "modified")];
        ledger
            .insert_patch_set(&patch_set, &changed_files)
            .expect("insert patch set");

        let artifact_dir = repo
            .join(".aichestra/artifacts/sessions")
            .join(&session.id)
            .join("review-seed");
        fs::create_dir_all(&artifact_dir).expect("artifact dir");
        let manifest_path = artifact_dir.join("change-manifest.yaml");
        let manifest_content = format!(
            "change_manifest:\n  session_id: \"{}\"\n  changed_areas:\n    - file: \"{}\"\n",
            session.id, changed_file_path
        );
        let manifest_hash = if write_manifest {
            fs::write(&manifest_path, &manifest_content).expect("write manifest");
            Some(sha256_hex(manifest_content.as_bytes()))
        } else {
            None
        };
        let manifest = ChangeManifest {
            id: "manifest-review".to_string(),
            session_id: session.id.clone(),
            manifest_path: display_path_for_ledger(repo, &manifest_path),
            manifest_hash,
            validation_status: CHANGE_MANIFEST_VALIDATION_STATUS.to_string(),
            created_at_ms: now + 3,
        };
        ledger
            .insert_change_manifest(&manifest)
            .expect("insert manifest");

        let attempt = MergeAttempt {
            id: "merge-review".to_string(),
            session_id: session.id.clone(),
            status: MergeAttemptStatus::Verified,
            main_before_commit: "base-commit".to_string(),
            candidate_commit: "head-commit".to_string(),
            apply_strategy: PREFLIGHT_APPLY_STRATEGY.to_string(),
            verified_tree_id: Some("verified-tree".to_string()),
            verified_commit_id: Some("verified-commit".to_string()),
            checks_passed: true,
            semantic_risk_level: None,
        };
        ledger
            .insert_merge_attempt(&attempt, now + 4, now + 4)
            .expect("insert merge attempt");
        ledger
            .insert_check_result(&CheckResult {
                id: "check-review".to_string(),
                merge_attempt_id: attempt.id.clone(),
                name: "test".to_string(),
                command: "cargo test --all".to_string(),
                result: CheckResultStatus::Passed,
                stdout_artifact: None,
                stderr_artifact: None,
                created_at_ms: now + 5,
            })
            .expect("insert check");

        (session, attempt)
    }

    fn seed_enqueued_candidate(repo: &Path, id: &str) -> Session {
        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let now = now_millis();
        let mut session = Session::new(
            id,
            format!("candidate {id}"),
            "codex",
            format!("aich/session/{id}"),
            format!(".aichestra/worktrees/{id}"),
            "base-commit",
            now,
        );
        session.status = SessionStatus::Enqueued;
        session.head_commit = Some("head-commit".to_string());
        session.updated_at_ms = now + 1;
        ledger.insert_session(&session).expect("insert session");

        let patch_set = PatchSet {
            id: format!("patch-{id}"),
            session_id: session.id.clone(),
            base_commit: "base-commit".to_string(),
            head_commit: Some("head-commit".to_string()),
            patch_id: Some("head-commit".to_string()),
            diff_stat: Some(" README.md | 1 +\n".to_string()),
            created_at_ms: now + 2,
        };
        ledger
            .insert_patch_set(&patch_set, &[ChangedFile::new("README.md", "modified")])
            .expect("insert patch set");

        let artifact_dir = repo
            .join(".aichestra/artifacts/sessions")
            .join(&session.id)
            .join("completion");
        fs::create_dir_all(&artifact_dir).expect("artifact dir");
        let manifest_path = artifact_dir.join("change-manifest.yaml");
        let manifest_content = format!(
            "change_manifest:\n  session_id: \"{}\"\n  changed_areas:\n    - file: \"README.md\"\n",
            session.id
        );
        fs::write(&manifest_path, &manifest_content).expect("write manifest");
        ledger
            .insert_change_manifest(&ChangeManifest {
                id: format!("manifest-{id}"),
                session_id: session.id.clone(),
                manifest_path: display_path_for_ledger(repo, &manifest_path),
                manifest_hash: Some(sha256_hex(manifest_content.as_bytes())),
                validation_status: CHANGE_MANIFEST_VALIDATION_STATUS.to_string(),
                created_at_ms: now + 3,
            })
            .expect("insert manifest");

        session
    }

    fn insert_queue_candidate(
        ledger: &Ledger,
        id: &str,
        session_status: SessionStatus,
        attempt_status: Option<MergeAttemptStatus>,
        approved: bool,
    ) {
        let now = now_millis();
        let mut session = Session::new(
            id,
            format!("queue task {id}"),
            "codex",
            format!("aich/session/{id}"),
            format!(".aichestra/worktrees/{id}"),
            "base-commit",
            now,
        );
        session.status = session_status;
        session.head_commit = Some(format!("{id}-head"));
        session.updated_at_ms = now + 1;
        ledger
            .insert_session(&session)
            .expect("insert queue session");

        let Some(status) = attempt_status else {
            return;
        };

        let needs_verified_ids = matches!(
            status,
            MergeAttemptStatus::Verified | MergeAttemptStatus::Applied
        );
        let attempt = MergeAttempt {
            id: format!("merge-{id}"),
            session_id: id.to_string(),
            status,
            main_before_commit: "base-commit".to_string(),
            candidate_commit: format!("{id}-head"),
            apply_strategy: PREFLIGHT_APPLY_STRATEGY.to_string(),
            verified_tree_id: needs_verified_ids.then(|| format!("{id}-tree")),
            verified_commit_id: needs_verified_ids.then(|| format!("{id}-verified")),
            checks_passed: needs_verified_ids,
            semantic_risk_level: needs_verified_ids.then(|| "medium".to_string()),
        };
        ledger
            .insert_merge_attempt(&attempt, now + 2, now + 2)
            .expect("insert queue attempt");

        if approved {
            ledger
                .insert_approval(&Approval {
                    id: format!("approval-{id}"),
                    merge_attempt_id: attempt.id,
                    approved_by: DEFAULT_OPERATOR_ID.to_string(),
                    approved_verified_tree_id: format!("{id}-tree"),
                    approved_verified_commit_id: format!("{id}-verified"),
                    created_at_ms: now + 3,
                })
                .expect("insert queue approval");
        }
    }

    #[test]
    fn session_start_records_session_worktree_request_and_events() {
        let repo = unique_temp_dir();
        let init_options = InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        };
        init_repo(&init_options).expect("init");

        let options = SessionStartOptions {
            repo_root: repo.clone(),
            db_path: None,
            goal: "add auth guard".to_string(),
            provider: "codex".to_string(),
            target_path: Some("src/auth.rs".to_string()),
            operator_id: None,
        };
        let git = MockGitRepository;
        let worktrees = MockWorktreeManager::new();

        let result = start_session_with(&options, &git, &worktrees).expect("start session");

        assert_eq!(result.session.goal, "add auth guard");
        assert_eq!(result.session.provider, "codex");
        assert_eq!(result.operator.id, DEFAULT_OPERATOR_ID);
        assert_eq!(result.session.target_path.as_deref(), Some("src/auth.rs"));
        assert_eq!(result.session.status, SessionStatus::Running);
        assert_eq!(result.session.base_commit, "base-commit");
        assert!(result.session.branch.starts_with("aich/session/session-"));
        assert_ne!(PathBuf::from(&result.session.worktree_path), repo);

        let requests = worktrees.requests.borrow();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].session_id, result.session.id);
        assert_eq!(requests[0].base_ref, "base-commit");

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let sessions = ledger.list_sessions().expect("list sessions");
        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].status, SessionStatus::Running);

        let event_names: Vec<String> = ledger
            .list_events()
            .expect("list events")
            .into_iter()
            .map(|event| event.name)
            .collect();
        assert_eq!(
            event_names,
            vec![
                "repo.initialized",
                "session.created",
                "worktree.created",
                "session.started"
            ]
        );

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn session_start_records_requested_operator_in_events() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let operator = Operator::new(
            "alice",
            "Alice Maintainer",
            OperatorRole::Maintainer,
            now_millis(),
        )
        .expect("operator");
        ledger.upsert_operator(&operator).expect("upsert operator");

        let options = SessionStartOptions {
            repo_root: repo.clone(),
            db_path: None,
            goal: "wire operator audit".to_string(),
            provider: "codex".to_string(),
            target_path: None,
            operator_id: Some("alice".to_string()),
        };
        let git = MockGitRepository;
        let worktrees = MockWorktreeManager::new();

        let result = start_session_with(&options, &git, &worktrees).expect("start session");
        assert_eq!(result.operator.id, "alice");

        let events = ledger.list_events().expect("list events");
        assert!(events.iter().any(|event| event.name == "session.created"
            && event.data_json.contains("\"operator_id\":\"alice\"")));
        assert!(events.iter().any(|event| event.name == "session.started"
            && event.data_json.contains("\"operator_id\":\"alice\"")));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn session_complete_records_patchset_manifest_and_enqueues_session() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");

        let start_options = SessionStartOptions {
            repo_root: repo.clone(),
            db_path: None,
            goal: "capture completion".to_string(),
            provider: "codex".to_string(),
            target_path: Some("src/lib.rs".to_string()),
            operator_id: None,
        };
        let git = MockGitRepository;
        let worktrees = MockWorktreeManager::new();
        let session = start_session_with(&start_options, &git, &worktrees)
            .expect("start session")
            .session;

        let complete_options = SessionCompleteOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        };
        let completer = MockSessionCompleter::new(CompleteSessionWorktreeOutcome::Changes(
            aich_git::CompletedSessionWorktree {
                head_commit: "head-commit".to_string(),
                diff_stat: " src/lib.rs | 1 +\n 1 file changed, 1 insertion(+)\n".to_string(),
                diff_patch: "diff --git a/src/lib.rs b/src/lib.rs\n".to_string(),
                changed_files: vec![aich_git::GitChangedFile {
                    path: "src/lib.rs".to_string(),
                    change_type: "modified".to_string(),
                }],
                committed_worktree_changes: true,
            },
        ));

        let result =
            complete_session_with(&complete_options, &completer).expect("complete session");

        assert_eq!(result.session.status, SessionStatus::Enqueued);
        assert_eq!(result.session.head_commit.as_deref(), Some("head-commit"));
        assert_eq!(result.changed_files.len(), 1);
        assert!(result.patch_set.is_some());
        assert!(result.context_snapshot.is_some());
        assert!(result.change_manifest.is_some());
        let manifest_path = result.manifest_path.expect("manifest path");
        assert!(manifest_path.exists());
        let manifest = fs::read_to_string(&manifest_path).expect("read manifest");
        assert!(manifest.contains("session_id:"));
        assert!(manifest.contains("src/lib.rs"));
        assert!(manifest.contains(CHANGE_MANIFEST_VALIDATION_STATUS));

        let requests = completer.requests.borrow();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].session_id, session.id);
        assert_eq!(requests[0].base_commit, "base-commit");

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let loaded = ledger
            .get_session(&session.id)
            .expect("get session")
            .expect("session exists");
        assert_eq!(loaded.status, SessionStatus::Enqueued);
        assert_eq!(loaded.head_commit.as_deref(), Some("head-commit"));

        let patch_sets = ledger.list_patch_sets(&session.id).expect("patch sets");
        assert_eq!(patch_sets.len(), 1);
        let changed_files = ledger
            .list_changed_files(&patch_sets[0].id)
            .expect("changed files");
        assert_eq!(changed_files[0].path, "src/lib.rs");
        assert_eq!(changed_files[0].change_type, "modified");
        assert_eq!(
            ledger
                .list_context_snapshots(&session.id)
                .expect("context snapshots")
                .len(),
            1
        );
        assert_eq!(
            ledger
                .list_change_manifests(&session.id)
                .expect("change manifests")
                .len(),
            1
        );

        let event_names: Vec<String> = ledger
            .list_events()
            .expect("list events")
            .into_iter()
            .map(|event| event.name)
            .collect();
        assert!(event_names.contains(&"files.changed".to_string()));
        assert!(event_names.contains(&"patchset.created".to_string()));
        assert!(event_names.contains(&"context.snapshot.created".to_string()));
        assert!(event_names.contains(&"manifest.created".to_string()));
        assert!(event_names.contains(&"manifest.validated".to_string()));
        assert!(event_names.contains(&"session.completed".to_string()));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn session_complete_marks_noop_when_no_changes_exist() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");

        let start_options = SessionStartOptions {
            repo_root: repo.clone(),
            db_path: None,
            goal: "no-op task".to_string(),
            provider: "codex".to_string(),
            target_path: None,
            operator_id: None,
        };
        let git = MockGitRepository;
        let worktrees = MockWorktreeManager::new();
        let session = start_session_with(&start_options, &git, &worktrees)
            .expect("start session")
            .session;

        let complete_options = SessionCompleteOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        };
        let completer = MockSessionCompleter::new(CompleteSessionWorktreeOutcome::NoChanges {
            head_commit: "base-commit".to_string(),
        });

        let result =
            complete_session_with(&complete_options, &completer).expect("complete session");
        assert_eq!(result.session.status, SessionStatus::Noop);
        assert!(result.patch_set.is_none());
        assert!(result.change_manifest.is_none());

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let loaded = ledger
            .get_session(&session.id)
            .expect("get session")
            .expect("session exists");
        assert_eq!(loaded.status, SessionStatus::Noop);
        assert_eq!(
            ledger
                .list_patch_sets(&session.id)
                .expect("patch sets")
                .len(),
            0
        );
        assert_eq!(
            ledger
                .list_change_manifests(&session.id)
                .expect("change manifests")
                .len(),
            0
        );
        assert!(ledger
            .list_events()
            .expect("events")
            .iter()
            .any(|event| event.name == "session.completed"
                && event.data_json.contains("\"no_changes\":true")));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn preflight_records_verified_attempt_and_check_artifacts() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");

        let start_options = SessionStartOptions {
            repo_root: repo.clone(),
            db_path: None,
            goal: "verify candidate".to_string(),
            provider: "codex".to_string(),
            target_path: Some("src/lib.rs".to_string()),
            operator_id: None,
        };
        let git = MockGitRepository;
        let worktrees = MockWorktreeManager::new();
        let session = start_session_with(&start_options, &git, &worktrees)
            .expect("start session")
            .session;

        let complete_options = SessionCompleteOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        };
        let completer = MockSessionCompleter::new(CompleteSessionWorktreeOutcome::Changes(
            aich_git::CompletedSessionWorktree {
                head_commit: "head-commit".to_string(),
                diff_stat: " src/lib.rs | 1 +\n 1 file changed, 1 insertion(+)\n".to_string(),
                diff_patch: "diff --git a/src/lib.rs b/src/lib.rs\n".to_string(),
                changed_files: vec![aich_git::GitChangedFile {
                    path: "src/lib.rs".to_string(),
                    change_type: "modified".to_string(),
                }],
                committed_worktree_changes: true,
            },
        ));
        complete_session_with(&complete_options, &completer).expect("complete session");

        let preflight_options = PreflightOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        };
        let preflight_runner =
            MockPreflightRunner::new(PreflightOutcome::Verified(aich_git::PreflightVerified {
                verified_tree_id: "verified-tree".to_string(),
                verified_commit_id: "verified-commit".to_string(),
                checks: vec![PreflightCheckOutput {
                    name: "test".to_string(),
                    command: "cargo test --all".to_string(),
                    passed: true,
                    code: Some(0),
                    stdout: "ok\n".to_string(),
                    stderr: String::new(),
                }],
            }));

        let result =
            run_preflight_with(&preflight_options, &git, &preflight_runner).expect("preflight");

        assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Verified);
        assert_eq!(
            result.merge_attempt.verified_tree_id.as_deref(),
            Some("verified-tree")
        );
        assert_eq!(
            result.merge_attempt.verified_commit_id.as_deref(),
            Some("verified-commit")
        );
        assert!(result.merge_attempt.checks_passed);
        assert_eq!(result.check_results.len(), 1);
        assert_eq!(result.check_results[0].result, CheckResultStatus::Passed);
        assert!(result.check_results[0]
            .stdout_artifact
            .as_deref()
            .expect("stdout artifact")
            .contains(".aichestra/artifacts/merge-attempts"));

        let requests = preflight_runner.requests.borrow();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].session_id, session.id);
        assert_eq!(requests[0].main_before_commit, "base-commit");
        assert_eq!(requests[0].candidate_commit, "head-commit");
        assert_eq!(requests[0].check_commands.len(), 3);

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        assert_eq!(
            ledger
                .list_merge_attempts(&session.id)
                .expect("merge attempts")
                .len(),
            1
        );
        assert_eq!(
            ledger
                .list_check_results(&result.merge_attempt.id)
                .expect("check results")
                .len(),
            1
        );
        assert_eq!(
            ledger
                .get_queue_lock(MERGE_QUEUE_LOCK_NAME)
                .expect("queue lock"),
            None
        );
        let event_names: Vec<String> = ledger
            .list_events()
            .expect("events")
            .into_iter()
            .map(|event| event.name)
            .collect();
        assert!(event_names.contains(&"merge.preflight.started".to_string()));
        assert!(event_names.contains(&"merge.mechanical.completed".to_string()));
        assert!(event_names.contains(&"check.completed".to_string()));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn preflight_refuses_when_queue_lock_is_held() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let session = seed_enqueued_candidate(&repo, "session-lock");
        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        assert!(ledger
            .try_acquire_queue_lock(&QueueLock {
                name: MERGE_QUEUE_LOCK_NAME.to_string(),
                holder_id: "holder-1".to_string(),
                operation: "apply".to_string(),
                session_id: Some("other-session".to_string()),
                acquired_at_ms: now_millis(),
            })
            .expect("acquire lock"));

        let preflight_runner =
            MockPreflightRunner::new(PreflightOutcome::Verified(aich_git::PreflightVerified {
                verified_tree_id: "verified-tree".to_string(),
                verified_commit_id: "verified-commit".to_string(),
                checks: Vec::new(),
            }));

        let err = run_preflight_with(
            &PreflightOptions {
                repo_root: repo.clone(),
                db_path: None,
                session_id: session.id.clone(),
                operator_id: None,
            },
            &MockGitRepository,
            &preflight_runner,
        )
        .unwrap_err();

        assert!(
            matches!(err, CliError::Usage(message) if message.contains("merge queue is locked"))
        );
        assert!(preflight_runner.requests.borrow().is_empty());
        assert!(ledger
            .get_queue_lock(MERGE_QUEUE_LOCK_NAME)
            .expect("queue lock")
            .is_some());

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn preflight_records_blocked_attempt_when_checks_fail() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");

        let start_options = SessionStartOptions {
            repo_root: repo.clone(),
            db_path: None,
            goal: "block candidate".to_string(),
            provider: "codex".to_string(),
            target_path: None,
            operator_id: None,
        };
        let git = MockGitRepository;
        let worktrees = MockWorktreeManager::new();
        let session = start_session_with(&start_options, &git, &worktrees)
            .expect("start session")
            .session;

        let complete_options = SessionCompleteOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        };
        let completer = MockSessionCompleter::new(CompleteSessionWorktreeOutcome::Changes(
            aich_git::CompletedSessionWorktree {
                head_commit: "head-commit".to_string(),
                diff_stat: " README.md | 1 +\n".to_string(),
                diff_patch: "diff --git a/README.md b/README.md\n".to_string(),
                changed_files: vec![aich_git::GitChangedFile {
                    path: "README.md".to_string(),
                    change_type: "modified".to_string(),
                }],
                committed_worktree_changes: true,
            },
        ));
        complete_session_with(&complete_options, &completer).expect("complete session");

        let preflight_options = PreflightOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        };
        let preflight_runner =
            MockPreflightRunner::new(PreflightOutcome::Blocked(aich_git::PreflightBlocked {
                reason: "checks_failed".to_string(),
                verified_tree_id: Some("tree-after-merge".to_string()),
                verified_commit_id: Some("commit-after-merge".to_string()),
                conflict_files: Vec::new(),
                merge_stdout: String::new(),
                merge_stderr: String::new(),
                checks: vec![PreflightCheckOutput {
                    name: "test".to_string(),
                    command: "cargo test --all".to_string(),
                    passed: false,
                    code: Some(101),
                    stdout: String::new(),
                    stderr: "failed\n".to_string(),
                }],
            }));

        let result =
            run_preflight_with(&preflight_options, &git, &preflight_runner).expect("preflight");

        assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Blocked);
        assert_eq!(result.blocked_reason.as_deref(), Some("checks_failed"));
        assert!(!result.merge_attempt.checks_passed);
        assert_eq!(result.check_results[0].result, CheckResultStatus::Failed);

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        assert!(ledger
            .list_events()
            .expect("events")
            .iter()
            .any(
                |event| event.name == "merge.blocked" && event.data_json.contains("checks_failed")
            ));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn review_records_semantic_report_for_verified_attempt() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let (session, attempt) = seed_verified_review_candidate(&repo, "src/lib.rs", true);

        let mut output = Vec::new();
        run_with_cwd(["aich", "review", &session.id], &repo, &mut output).expect("review");
        let output = String::from_utf8(output).expect("utf8 output");
        assert!(output.contains("Review high"));
        assert!(output.contains("Merge attempt: merge-review"));

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let reviews = ledger
            .list_semantic_reviews(&attempt.id)
            .expect("semantic reviews");
        assert_eq!(reviews.len(), 1);
        assert_eq!(reviews[0].risk_level, SemanticRiskLevel::High);
        let report_path = repo.join(reviews[0].report_path.as_deref().expect("report path"));
        assert!(report_path.exists());
        let report = fs::read_to_string(report_path).expect("read report");
        assert!(report.contains("local_mvp_static_reviewer"));
        assert!(report.contains("api_contract_change"));

        let loaded_attempt = ledger
            .get_merge_attempt(&attempt.id)
            .expect("get attempt")
            .expect("attempt exists");
        assert_eq!(loaded_attempt.status, MergeAttemptStatus::Verified);
        assert_eq!(loaded_attempt.semantic_risk_level.as_deref(), Some("high"));
        assert!(ledger
            .list_events()
            .expect("events")
            .iter()
            .any(|event| event.name == "merge.semantic_review.completed"
                && event.data_json.contains("\"risk_level\":\"high\"")));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn review_blocks_when_manifest_artifact_is_missing() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", false);

        let review_options = ReviewOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        };
        let result = run_review_with(&review_options).expect("review");

        assert_eq!(
            result.semantic_review.risk_level,
            SemanticRiskLevel::Blocked
        );
        assert!(result.blocked);
        assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Blocked);
        assert_eq!(
            result.merge_attempt.semantic_risk_level.as_deref(),
            Some("blocked")
        );
        assert!(result.report_path.exists());
        assert!(result
            .required_actions
            .iter()
            .any(|action| action.contains("Change Manifest")));

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        assert!(ledger.list_events().expect("events").iter().any(|event| {
            event.name == "merge.blocked" && event.data_json.contains("semantic_review")
        }));
        assert_eq!(
            ledger
                .list_semantic_reviews(&attempt.id)
                .expect("semantic reviews")
                .len(),
            1
        );

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn approve_records_exact_verified_tree_after_review() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

        run_review_with(&ReviewOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        })
        .expect("review");

        let result = run_approve_with(
            &ApproveOptions {
                repo_root: repo.clone(),
                db_path: None,
                session_id: session.id.clone(),
                operator_id: None,
            },
            &MockGitRepository,
        )
        .expect("approve");

        assert_eq!(result.merge_attempt.id, attempt.id);
        assert_eq!(result.approval.merge_attempt_id, attempt.id);
        assert_eq!(result.approval.approved_by, DEFAULT_OPERATOR_ID);
        assert_eq!(result.approval.approved_verified_tree_id, "verified-tree");
        assert_eq!(
            result.approval.approved_verified_commit_id,
            "verified-commit"
        );
        assert_eq!(
            result.merge_attempt.semantic_risk_level.as_deref(),
            Some("medium")
        );
        assert_eq!(result.semantic_reviews.len(), 1);

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        assert_eq!(
            ledger.list_approvals(&attempt.id).expect("list approvals"),
            vec![result.approval]
        );
        let event_names: Vec<String> = ledger
            .list_events()
            .expect("events")
            .into_iter()
            .map(|event| event.name)
            .collect();
        assert!(event_names.contains(&"approval.requested".to_string()));
        assert!(event_names.contains(&"approval.approved".to_string()));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn approve_requires_semantic_review_first() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);

        let err = run_approve_with(
            &ApproveOptions {
                repo_root: repo.clone(),
                db_path: None,
                session_id: session.id.clone(),
                operator_id: None,
            },
            &MockGitRepository,
        )
        .unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("aich review")));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn apply_uses_approved_verified_commit_and_marks_applied() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

        run_review_with(&ReviewOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        })
        .expect("review");
        let approval = run_approve_with(
            &ApproveOptions {
                repo_root: repo.clone(),
                db_path: None,
                session_id: session.id.clone(),
                operator_id: None,
            },
            &MockGitRepository,
        )
        .expect("approve")
        .approval;
        let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
            applied_commit_id: "verified-commit".to_string(),
            applied_tree_id: "verified-tree".to_string(),
            stdout: "fast-forward\n".to_string(),
            stderr: String::new(),
        });

        let result = run_apply_with(
            &ApplyOptions {
                repo_root: repo.clone(),
                db_path: None,
                session_id: session.id.clone(),
                operator_id: None,
            },
            &MockGitRepository,
            &applier,
        )
        .expect("apply");

        assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Applied);
        assert_eq!(result.approval, approval);
        assert_eq!(result.applied_commit_id, "verified-commit");
        assert_eq!(result.applied_tree_id, "verified-tree");
        let requests = applier.requests.borrow();
        assert_eq!(requests.len(), 1);
        assert_eq!(requests[0].verified_commit_id, "verified-commit");
        assert_eq!(requests[0].verified_tree_id, "verified-tree");

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let loaded_session = ledger
            .get_session(&session.id)
            .expect("get session")
            .expect("session");
        assert_eq!(loaded_session.status, SessionStatus::Completed);
        let loaded_attempt = ledger
            .get_merge_attempt(&attempt.id)
            .expect("get attempt")
            .expect("attempt");
        assert_eq!(loaded_attempt.status, MergeAttemptStatus::Applied);
        assert_eq!(
            ledger
                .get_queue_lock(MERGE_QUEUE_LOCK_NAME)
                .expect("queue lock"),
            None
        );
        assert!(ledger
            .list_events()
            .expect("events")
            .iter()
            .any(|event| event.name == "merge.applied"));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn apply_refuses_when_queue_lock_is_held() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);

        run_review_with(&ReviewOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        })
        .expect("review");
        run_approve_with(
            &ApproveOptions {
                repo_root: repo.clone(),
                db_path: None,
                session_id: session.id.clone(),
                operator_id: None,
            },
            &MockGitRepository,
        )
        .expect("approve");

        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        assert!(ledger
            .try_acquire_queue_lock(&QueueLock {
                name: MERGE_QUEUE_LOCK_NAME.to_string(),
                holder_id: "holder-1".to_string(),
                operation: "preflight".to_string(),
                session_id: Some("other-session".to_string()),
                acquired_at_ms: now_millis(),
            })
            .expect("acquire lock"));
        let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
            applied_commit_id: "verified-commit".to_string(),
            applied_tree_id: "verified-tree".to_string(),
            stdout: String::new(),
            stderr: String::new(),
        });

        let err = run_apply_with(
            &ApplyOptions {
                repo_root: repo.clone(),
                db_path: None,
                session_id: session.id.clone(),
                operator_id: None,
            },
            &MockGitRepository,
            &applier,
        )
        .unwrap_err();

        assert!(
            matches!(err, CliError::Usage(message) if message.contains("merge queue is locked"))
        );
        assert!(applier.requests.borrow().is_empty());

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn apply_requires_approval_first() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);

        run_review_with(&ReviewOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        })
        .expect("review");
        let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
            applied_commit_id: "verified-commit".to_string(),
            applied_tree_id: "verified-tree".to_string(),
            stdout: String::new(),
            stderr: String::new(),
        });
        let err = run_apply_with(
            &ApplyOptions {
                repo_root: repo.clone(),
                db_path: None,
                session_id: session.id.clone(),
                operator_id: None,
            },
            &MockGitRepository,
            &applier,
        )
        .unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("aich approve")));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn apply_rejects_when_main_moved_after_approval() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);

        run_review_with(&ReviewOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        })
        .expect("review");
        run_approve_with(
            &ApproveOptions {
                repo_root: repo.clone(),
                db_path: None,
                session_id: session.id.clone(),
                operator_id: None,
            },
            &MockGitRepository,
        )
        .expect("approve");
        let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
            applied_commit_id: "verified-commit".to_string(),
            applied_tree_id: "verified-tree".to_string(),
            stdout: String::new(),
            stderr: String::new(),
        });

        let err = run_apply_with(
            &ApplyOptions {
                repo_root: repo.clone(),
                db_path: None,
                session_id: session.id.clone(),
                operator_id: None,
            },
            &MockMovedGitRepository,
            &applier,
        )
        .unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("main moved")));
        assert!(applier.requests.borrow().is_empty());

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn queue_shows_human_readable_candidate_states() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");

        insert_queue_candidate(
            &ledger,
            "session-enqueued",
            SessionStatus::Enqueued,
            None,
            false,
        );
        insert_queue_candidate(
            &ledger,
            "session-preflight",
            SessionStatus::Enqueued,
            Some(MergeAttemptStatus::PreflightRunning),
            false,
        );
        insert_queue_candidate(
            &ledger,
            "session-verified",
            SessionStatus::Enqueued,
            Some(MergeAttemptStatus::Verified),
            false,
        );
        insert_queue_candidate(
            &ledger,
            "session-blocked",
            SessionStatus::Enqueued,
            Some(MergeAttemptStatus::Blocked),
            false,
        );
        insert_queue_candidate(
            &ledger,
            "session-approved",
            SessionStatus::Enqueued,
            Some(MergeAttemptStatus::Verified),
            true,
        );
        insert_queue_candidate(
            &ledger,
            "session-applied",
            SessionStatus::Completed,
            Some(MergeAttemptStatus::Applied),
            true,
        );

        let options = QueueOptions {
            repo_root: repo.clone(),
            db_path: None,
        };
        let mut output = Vec::new();
        render_queue(&options, &mut output).expect("render queue");
        let output = String::from_utf8(output).expect("utf8 output");

        assert!(output.contains("Aichestra queue"));
        assert!(output.contains("Lock: free"));
        assert!(output
            .contains("Summary: enqueued=1 preflight_running=1 verified=1 approved=1 blocked=1"));
        assert!(output.contains("- session-enqueued [enqueued]"));
        assert!(output.contains("- session-preflight [preflight_running]"));
        assert!(output.contains("- session-verified [verified]"));
        assert!(output.contains("- session-blocked [blocked]"));
        assert!(output.contains("- session-approved [approved]"));
        assert!(output.contains("next: aich preflight session-enqueued"));
        assert!(output.contains("next: aich review session-verified"));
        assert!(output.contains("next: aich apply session-approved"));
        assert!(!output.contains("session-applied ["));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn queue_shows_active_lock() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        assert!(ledger
            .try_acquire_queue_lock(&QueueLock {
                name: MERGE_QUEUE_LOCK_NAME.to_string(),
                holder_id: "holder-1".to_string(),
                operation: "preflight".to_string(),
                session_id: Some("session-1".to_string()),
                acquired_at_ms: now_millis(),
            })
            .expect("acquire lock"));

        let mut output = Vec::new();
        render_queue(
            &QueueOptions {
                repo_root: repo.clone(),
                db_path: None,
            },
            &mut output,
        )
        .expect("render queue");
        let output = String::from_utf8(output).expect("utf8 output");

        assert!(output.contains("Lock: held by holder-1 (preflight, session session-1)"));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn queue_marks_old_lock_as_stale() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        assert!(ledger
            .try_acquire_queue_lock(&QueueLock {
                name: MERGE_QUEUE_LOCK_NAME.to_string(),
                holder_id: "holder-1".to_string(),
                operation: "preflight".to_string(),
                session_id: Some("session-1".to_string()),
                acquired_at_ms: now_millis() - QUEUE_LOCK_STALE_AFTER_MS - MILLIS_PER_SECOND,
            })
            .expect("acquire lock"));

        let mut output = Vec::new();
        render_queue(
            &QueueOptions {
                repo_root: repo.clone(),
                db_path: None,
            },
            &mut output,
        )
        .expect("render queue");
        let output = String::from_utf8(output).expect("utf8 output");

        assert!(output.contains("Lock stale: yes"));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn queue_unlock_releases_lock_and_records_event() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        assert!(ledger
            .try_acquire_queue_lock(&QueueLock {
                name: MERGE_QUEUE_LOCK_NAME.to_string(),
                holder_id: "holder-1".to_string(),
                operation: "preflight".to_string(),
                session_id: Some("session-1".to_string()),
                acquired_at_ms: now_millis() - QUEUE_LOCK_STALE_AFTER_MS - MILLIS_PER_SECOND,
            })
            .expect("acquire lock"));

        let result = run_queue_unlock(&QueueUnlockOptions {
            repo_root: repo.clone(),
            db_path: None,
            force: true,
            reason: Some("stale process".to_string()),
        })
        .expect("unlock");

        assert_eq!(
            result
                .released_lock
                .as_ref()
                .map(|lock| lock.holder_id.as_str()),
            Some("holder-1")
        );
        assert!(result.stale);
        assert_eq!(
            ledger
                .get_queue_lock(MERGE_QUEUE_LOCK_NAME)
                .expect("queue lock"),
            None
        );
        assert!(ledger.list_events().expect("events").iter().any(|event| {
            event.name == "merge.queue_unlocked" && event.data_json.contains("stale process")
        }));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn doctor_reports_missing_init_without_creating_ledger() {
        let repo = unique_temp_dir();
        let result = run_doctor(&DoctorOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("doctor");

        assert_eq!(result.result_label(), "error");
        assert!(result.error_count() > 0);
        assert!(!repo.join(".aichestra/aichestra.db").exists());

        let mut output = Vec::new();
        render_doctor(&result, &mut output).expect("render doctor");
        let output = String::from_utf8(output).expect("utf8 output");
        assert!(output.contains("Aichestra doctor"));
        assert!(output.contains("Result: error"));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn doctor_reports_initialized_repo_ok() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");

        let mut output = Vec::new();
        run_with_cwd(["aich", "doctor"], &repo, &mut output).expect("doctor");
        let output = String::from_utf8(output).expect("utf8 output");

        assert!(output.contains("[ok] config:"));
        assert!(output.contains("[ok] ledger:"));
        assert!(output.contains("[ok] operator: default operator local-user is active"));
        assert!(output.contains("[ok] queue lock: free"));
        assert!(output.contains("Summary: warnings=0 errors=0"));
        assert!(output.contains("Result: ok"));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn doctor_warns_when_queue_lock_is_stale() {
        let repo = unique_temp_dir();
        init_repo(&InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        })
        .expect("init");
        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        assert!(ledger
            .try_acquire_queue_lock(&QueueLock {
                name: MERGE_QUEUE_LOCK_NAME.to_string(),
                holder_id: "holder-1".to_string(),
                operation: "preflight".to_string(),
                session_id: Some("session-1".to_string()),
                acquired_at_ms: now_millis() - QUEUE_LOCK_STALE_AFTER_MS - MILLIS_PER_SECOND,
            })
            .expect("acquire lock"));

        let mut output = Vec::new();
        run_with_cwd(["aich", "doctor"], &repo, &mut output).expect("doctor");
        let output = String::from_utf8(output).expect("utf8 output");

        assert!(output.contains("[warning] queue lock: stale held by holder-1"));
        assert!(output.contains("Result: warning"));

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn status_lists_sessions_and_recent_events() {
        let repo = unique_temp_dir();
        let init_options = InitOptions {
            repo_root: repo.clone(),
            db_path: None,
        };
        init_repo(&init_options).expect("init");

        let options = SessionStartOptions {
            repo_root: repo.clone(),
            db_path: None,
            goal: "add status command".to_string(),
            provider: "codex".to_string(),
            target_path: Some("src/status.rs".to_string()),
            operator_id: None,
        };
        let git = MockGitRepository;
        let worktrees = MockWorktreeManager::new();
        let session = start_session_with(&options, &git, &worktrees)
            .expect("start session")
            .session;

        let status_options = StatusOptions {
            repo_root: repo.clone(),
            db_path: None,
            recent_events_limit: 2,
        };
        let mut output = Vec::new();
        render_status(&status_options, &mut output).expect("render status");
        let output = String::from_utf8(output).expect("utf8 output");

        assert!(output.contains("Aichestra status"));
        assert!(output.contains("Operators: 1"));
        assert!(output.contains("Sessions: 1"));
        assert!(output.contains(&format!("- {} [running]", session.id)));
        assert!(output.contains("provider: codex"));
        assert!(output.contains(&format!("branch: {}", session.branch)));
        assert!(output.contains(&format!("worktree: {}", session.worktree_path)));
        assert!(output.contains("target: src/status.rs"));
        assert!(output.contains("base: base-co"));
        assert!(output.contains("Events: 4"));
        assert!(output.contains("Recent events:"));
        assert!(output.contains("session.started"));

        let _ = fs::remove_dir_all(repo);
    }
}
