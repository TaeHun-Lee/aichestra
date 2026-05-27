use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use aich_core::clock::now_millis;
use aich_core::{
    ChangeManifest, ChangedFile, CheckResult, CheckResultStatus, ContextSnapshot, EventName,
    MergeAttempt, MergeAttemptStatus, NewEvent, Operator, OperatorRole, PatchSet, Session,
    SessionStatus,
};
use aich_git::{
    CheckCommand, CompleteSessionWorktreeOutcome, CompleteSessionWorktreeRequest,
    CreateWorktreeRequest, GitRepository, NativeGitWorktreeManager, PreflightBlocked,
    PreflightCheckOutput, PreflightOutcome, PreflightRequest, PreflightRunner, PreflightVerified,
    SessionWorktreeCompleter, WorktreeError, WorktreeManager,
};
use aich_ledger::{Ledger, MergeAttemptResultUpdate};
use sha2::{Digest, Sha256};

static SESSION_COUNTER: AtomicU64 = AtomicU64::new(1);
static ARTIFACT_COUNTER: AtomicU64 = AtomicU64::new(1);
static MERGE_ATTEMPT_COUNTER: AtomicU64 = AtomicU64::new(1);

const DEFAULT_OPERATOR_ID: &str = "local-user";
const DEFAULT_OPERATOR_NAME: &str = "Local User";
const CHANGE_MANIFEST_VALIDATION_STATUS: &str = "generated_from_diff";
const PREFLIGHT_APPLY_STRATEGY: &str = "merge_no_ff_commit";
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
struct StatusOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    recent_events_limit: usize,
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
        Some("status") => {
            let options = parse_status_options(&args[1..], cwd)?;
            render_status(&options, out)
        }
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

fn next_artifact_id(created_at_ms: i64) -> String {
    let counter = ARTIFACT_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{created_at_ms}-{counter}")
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
    "Usage:\n  aich init [--repo PATH] [--db PATH]\n  aich status [--repo PATH] [--db PATH] [--recent-events N]\n  aich auth whoami [--operator ID] [--repo PATH] [--db PATH]\n  aich auth operator add --id ID [--name NAME] [--role owner|maintainer|reviewer] [--repo PATH] [--db PATH]\n  aich auth operator list [--repo PATH] [--db PATH]\n  aich session start --goal TEXT [--provider PROVIDER] [--target PATH] [--operator ID] [--repo PATH] [--db PATH]\n  aich session complete <session-id> [--operator ID] [--repo PATH] [--db PATH]\n  aich preflight <session-id> [--operator ID] [--repo PATH] [--db PATH]".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use aich_git::{validate_worktree_request, HeadCommit, SessionWorktree};
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
