use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HeadCommit {
    pub commit_id: String,
}

pub trait GitRepository {
    fn head_commit(&self, repo_path: &Path) -> Result<HeadCommit, WorktreeError>;
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitChangedFile {
    pub path: String,
    pub change_type: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompleteSessionWorktreeRequest {
    pub session_id: String,
    pub worktree_path: PathBuf,
    pub base_commit: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompletedSessionWorktree {
    pub head_commit: String,
    pub diff_stat: String,
    pub diff_patch: String,
    pub changed_files: Vec<GitChangedFile>,
    pub committed_worktree_changes: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CompleteSessionWorktreeOutcome {
    NoChanges { head_commit: String },
    Changes(CompletedSessionWorktree),
}

pub trait SessionWorktreeCompleter {
    fn complete_session_worktree(
        &self,
        request: &CompleteSessionWorktreeRequest,
    ) -> Result<CompleteSessionWorktreeOutcome, WorktreeError>;
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CleanupSessionWorktreeRequest {
    pub repo_path: PathBuf,
    pub main_worktree_path: PathBuf,
    pub session_id: String,
    pub branch: String,
    pub worktree_path: PathBuf,
    pub sandbox_paths: Vec<PathBuf>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CleanupSessionWorktreeOutcome {
    pub session_worktree_removed: bool,
    pub branch_deleted: bool,
    pub sandbox_worktrees_removed: Vec<PathBuf>,
}

pub trait SessionWorktreeCleaner {
    fn cleanup_session_worktree(
        &self,
        request: &CleanupSessionWorktreeRequest,
    ) -> Result<CleanupSessionWorktreeOutcome, WorktreeError>;
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CheckCommand {
    pub name: String,
    pub program: String,
    pub args: Vec<String>,
}

impl CheckCommand {
    pub fn display_command(&self) -> String {
        let mut command = self.program.clone();
        for arg in &self.args {
            command.push(' ');
            command.push_str(arg);
        }
        command
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PreflightRequest {
    pub repo_path: PathBuf,
    pub sandbox_path: PathBuf,
    pub session_id: String,
    pub main_before_commit: String,
    pub candidate_commit: String,
    pub check_commands: Vec<CheckCommand>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PreflightCheckOutput {
    pub name: String,
    pub command: String,
    pub passed: bool,
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PreflightVerified {
    pub verified_tree_id: String,
    pub verified_commit_id: String,
    pub checks: Vec<PreflightCheckOutput>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PreflightBlocked {
    pub reason: String,
    pub verified_tree_id: Option<String>,
    pub verified_commit_id: Option<String>,
    pub conflict_files: Vec<String>,
    pub merge_stdout: String,
    pub merge_stderr: String,
    pub checks: Vec<PreflightCheckOutput>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PreflightOutcome {
    Verified(PreflightVerified),
    Blocked(PreflightBlocked),
}

pub trait PreflightRunner {
    fn run_preflight(&self, request: &PreflightRequest) -> Result<PreflightOutcome, WorktreeError>;
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApplyVerifiedCommitRequest {
    pub repo_path: PathBuf,
    pub verified_commit_id: String,
    pub verified_tree_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AppliedVerifiedCommit {
    pub applied_commit_id: String,
    pub applied_tree_id: String,
    pub stdout: String,
    pub stderr: String,
}

pub trait VerifiedCommitApplier {
    fn apply_verified_commit(
        &self,
        request: &ApplyVerifiedCommitRequest,
    ) -> Result<AppliedVerifiedCommit, WorktreeError>;
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateWorktreeRequest {
    pub repo_path: PathBuf,
    pub main_worktree_path: PathBuf,
    pub session_id: String,
    pub branch: String,
    pub base_ref: String,
    pub worktree_path: PathBuf,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SessionWorktree {
    pub session_id: String,
    pub branch: String,
    pub path: PathBuf,
    pub base_ref: String,
}

pub trait WorktreeManager {
    fn create_session_worktree(
        &self,
        request: &CreateWorktreeRequest,
    ) -> Result<SessionWorktree, WorktreeError>;
}

#[derive(Debug)]
pub enum WorktreeError {
    InvalidRequest(String),
    Io(std::io::Error),
    GitCommandFailed {
        args: Vec<String>,
        code: Option<i32>,
        stderr: String,
    },
}

impl Display for WorktreeError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidRequest(message) => write!(f, "{message}"),
            Self::Io(error) => write!(f, "io error: {error}"),
            Self::GitCommandFailed { args, code, stderr } => {
                write!(f, "git {:?} failed with code {:?}: {}", args, code, stderr)
            }
        }
    }
}

impl Error for WorktreeError {}

impl From<std::io::Error> for WorktreeError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

pub struct NativeGitWorktreeManager;

impl GitRepository for NativeGitWorktreeManager {
    fn head_commit(&self, repo_path: &Path) -> Result<HeadCommit, WorktreeError> {
        let args = vec!["rev-parse".to_string(), "HEAD".to_string()];
        let output = Command::new("git")
            .arg("-C")
            .arg(repo_path)
            .args(&args)
            .output()?;

        if !output.status.success() {
            return Err(WorktreeError::GitCommandFailed {
                args,
                code: output.status.code(),
                stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            });
        }

        let commit_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if commit_id.is_empty() {
            return Err(WorktreeError::InvalidRequest(
                "git rev-parse HEAD returned an empty commit id".to_string(),
            ));
        }

        Ok(HeadCommit { commit_id })
    }
}

impl WorktreeManager for NativeGitWorktreeManager {
    fn create_session_worktree(
        &self,
        request: &CreateWorktreeRequest,
    ) -> Result<SessionWorktree, WorktreeError> {
        validate_worktree_request(request)?;

        let args = vec![
            "worktree".to_string(),
            "add".to_string(),
            "-b".to_string(),
            request.branch.clone(),
            request.worktree_path.display().to_string(),
            request.base_ref.clone(),
        ];

        let output = Command::new("git")
            .arg("-C")
            .arg(&request.repo_path)
            .args(&args)
            .output()?;

        if !output.status.success() {
            return Err(WorktreeError::GitCommandFailed {
                args,
                code: output.status.code(),
                stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            });
        }

        Ok(SessionWorktree {
            session_id: request.session_id.clone(),
            branch: request.branch.clone(),
            path: request.worktree_path.clone(),
            base_ref: request.base_ref.clone(),
        })
    }
}

impl SessionWorktreeCompleter for NativeGitWorktreeManager {
    fn complete_session_worktree(
        &self,
        request: &CompleteSessionWorktreeRequest,
    ) -> Result<CompleteSessionWorktreeOutcome, WorktreeError> {
        validate_complete_session_worktree_request(request)?;

        let mut committed_worktree_changes = false;
        let status = run_git_stdout(
            &request.worktree_path,
            &["status", "--porcelain", "--untracked-files=all"],
        )?;

        if !status.trim().is_empty() {
            run_git_success(&request.worktree_path, &["add", "-A"])?;
            if git_diff_has_changes(&request.worktree_path, &["--cached"])? {
                run_git_success_with_config(
                    &request.worktree_path,
                    &[
                        "commit",
                        "-m",
                        &format!("aich: complete {}", request.session_id),
                    ],
                )?;
                committed_worktree_changes = true;
            }
        }

        let head_commit = run_git_stdout(&request.worktree_path, &["rev-parse", "HEAD"])?
            .trim()
            .to_string();
        if head_commit.is_empty() {
            return Err(WorktreeError::InvalidRequest(
                "git rev-parse HEAD returned an empty commit id".to_string(),
            ));
        }

        if !git_diff_has_changes(
            &request.worktree_path,
            &[&request.base_commit, &head_commit],
        )? {
            return Ok(CompleteSessionWorktreeOutcome::NoChanges { head_commit });
        }

        let name_status = run_git_stdout(
            &request.worktree_path,
            &["diff", "--name-status", &request.base_commit, &head_commit],
        )?;
        let diff_stat = run_git_stdout(
            &request.worktree_path,
            &["diff", "--stat", &request.base_commit, &head_commit],
        )?;
        let diff_patch = run_git_stdout(
            &request.worktree_path,
            &["diff", "--patch", &request.base_commit, &head_commit],
        )?;

        Ok(CompleteSessionWorktreeOutcome::Changes(
            CompletedSessionWorktree {
                head_commit,
                diff_stat,
                diff_patch,
                changed_files: parse_name_status(&name_status),
                committed_worktree_changes,
            },
        ))
    }
}

impl SessionWorktreeCleaner for NativeGitWorktreeManager {
    fn cleanup_session_worktree(
        &self,
        request: &CleanupSessionWorktreeRequest,
    ) -> Result<CleanupSessionWorktreeOutcome, WorktreeError> {
        validate_cleanup_session_worktree_request(request)?;

        let mut registered_paths = registered_worktree_paths(&request.repo_path)?;
        let session_worktree_removed = remove_registered_worktree(
            &request.repo_path,
            &request.worktree_path,
            &registered_paths,
        )?;
        if session_worktree_removed {
            registered_paths = registered_worktree_paths(&request.repo_path)?;
        }

        let branch_deleted = delete_branch_if_present(&request.repo_path, &request.branch)?;

        let mut sandbox_worktrees_removed = Vec::new();
        for sandbox_path in &request.sandbox_paths {
            if remove_registered_worktree(&request.repo_path, sandbox_path, &registered_paths)? {
                sandbox_worktrees_removed.push(sandbox_path.clone());
                registered_paths = registered_worktree_paths(&request.repo_path)?;
            }
        }

        Ok(CleanupSessionWorktreeOutcome {
            session_worktree_removed,
            branch_deleted,
            sandbox_worktrees_removed,
        })
    }
}

impl PreflightRunner for NativeGitWorktreeManager {
    fn run_preflight(&self, request: &PreflightRequest) -> Result<PreflightOutcome, WorktreeError> {
        validate_preflight_request(request)?;

        let parent = request.sandbox_path.parent().ok_or_else(|| {
            WorktreeError::InvalidRequest("sandbox path must have a parent directory".to_string())
        })?;
        fs::create_dir_all(parent)?;

        run_git_stdout(
            &request.repo_path,
            &[
                "worktree",
                "add",
                "--detach",
                &request.sandbox_path.display().to_string(),
                &request.main_before_commit,
            ],
        )?;

        let merge_output = run_git_output(
            &request.sandbox_path,
            &["merge", "--no-ff", "--no-commit", &request.candidate_commit],
        )?;
        if !merge_output.success {
            let conflict_files = run_git_stdout(
                &request.sandbox_path,
                &["diff", "--name-only", "--diff-filter=U"],
            )
            .unwrap_or_default()
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(ToString::to_string)
            .collect();

            return Ok(PreflightOutcome::Blocked(PreflightBlocked {
                reason: "mechanical_conflict".to_string(),
                verified_tree_id: None,
                verified_commit_id: None,
                conflict_files,
                merge_stdout: merge_output.stdout,
                merge_stderr: merge_output.stderr,
                checks: Vec::new(),
            }));
        }

        run_git_success_with_config(
            &request.sandbox_path,
            &[
                "commit",
                "-m",
                &format!("aich: verified {}", request.session_id),
            ],
        )?;
        let verified_commit_id = run_git_stdout(&request.sandbox_path, &["rev-parse", "HEAD"])?
            .trim()
            .to_string();
        let verified_tree_id =
            run_git_stdout(&request.sandbox_path, &["rev-parse", "HEAD^{tree}"])?
                .trim()
                .to_string();

        let mut checks = Vec::new();
        for command in &request.check_commands {
            checks.push(run_check_command(&request.sandbox_path, command)?);
        }

        if checks.iter().any(|check| !check.passed) {
            return Ok(PreflightOutcome::Blocked(PreflightBlocked {
                reason: "checks_failed".to_string(),
                verified_tree_id: Some(verified_tree_id),
                verified_commit_id: Some(verified_commit_id),
                conflict_files: Vec::new(),
                merge_stdout: merge_output.stdout,
                merge_stderr: merge_output.stderr,
                checks,
            }));
        }

        Ok(PreflightOutcome::Verified(PreflightVerified {
            verified_tree_id,
            verified_commit_id,
            checks,
        }))
    }
}

impl VerifiedCommitApplier for NativeGitWorktreeManager {
    fn apply_verified_commit(
        &self,
        request: &ApplyVerifiedCommitRequest,
    ) -> Result<AppliedVerifiedCommit, WorktreeError> {
        validate_apply_verified_commit_request(request)?;

        let status = run_git_stdout(&request.repo_path, &["status", "--porcelain"])?;
        if !status.trim().is_empty() {
            return Err(WorktreeError::InvalidRequest(
                "main worktree is dirty; refuse to apply verified candidate".to_string(),
            ));
        }

        let actual_tree = run_git_stdout(
            &request.repo_path,
            &[
                "rev-parse",
                &format!("{}^{{tree}}", request.verified_commit_id),
            ],
        )?
        .trim()
        .to_string();
        if actual_tree != request.verified_tree_id {
            return Err(WorktreeError::InvalidRequest(format!(
                "verified commit tree {actual_tree} does not match approved tree {}",
                request.verified_tree_id
            )));
        }

        let ancestry = run_git_output(
            &request.repo_path,
            &[
                "merge-base",
                "--is-ancestor",
                "HEAD",
                &request.verified_commit_id,
            ],
        )?;
        if !ancestry.success {
            return Err(WorktreeError::InvalidRequest(
                "verified commit is not a descendant of current HEAD; re-run preflight".to_string(),
            ));
        }

        let merge_output = run_git_output(
            &request.repo_path,
            &["merge", "--ff-only", &request.verified_commit_id],
        )?;
        if !merge_output.success {
            return Err(WorktreeError::GitCommandFailed {
                args: vec![
                    "merge".to_string(),
                    "--ff-only".to_string(),
                    request.verified_commit_id.clone(),
                ],
                code: merge_output.code,
                stderr: merge_output.stderr,
            });
        }

        let applied_commit_id = run_git_stdout(&request.repo_path, &["rev-parse", "HEAD"])?
            .trim()
            .to_string();
        let applied_tree_id = run_git_stdout(&request.repo_path, &["rev-parse", "HEAD^{tree}"])?
            .trim()
            .to_string();
        if applied_commit_id != request.verified_commit_id {
            return Err(WorktreeError::InvalidRequest(format!(
                "applied commit {applied_commit_id} does not match approved commit {}",
                request.verified_commit_id
            )));
        }
        if applied_tree_id != request.verified_tree_id {
            return Err(WorktreeError::InvalidRequest(format!(
                "applied tree {applied_tree_id} does not match approved tree {}",
                request.verified_tree_id
            )));
        }

        Ok(AppliedVerifiedCommit {
            applied_commit_id,
            applied_tree_id,
            stdout: merge_output.stdout,
            stderr: merge_output.stderr,
        })
    }
}

pub fn validate_worktree_request(request: &CreateWorktreeRequest) -> Result<(), WorktreeError> {
    if request.session_id.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "session id is required".to_string(),
        ));
    }
    if request.branch.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "branch is required".to_string(),
        ));
    }
    if request.base_ref.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "base ref is required".to_string(),
        ));
    }

    let main_path = comparable_path(&request.main_worktree_path);
    let worktree_path = comparable_path(&request.worktree_path);
    if main_path == worktree_path {
        return Err(WorktreeError::InvalidRequest(
            "session worktree must not be the main worktree".to_string(),
        ));
    }

    let git_dir = comparable_path(&request.repo_path.join(".git"));
    if worktree_path.starts_with(&git_dir) {
        return Err(WorktreeError::InvalidRequest(
            "session worktree must not be inside .git".to_string(),
        ));
    }

    Ok(())
}

pub fn validate_complete_session_worktree_request(
    request: &CompleteSessionWorktreeRequest,
) -> Result<(), WorktreeError> {
    if request.session_id.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "session id is required".to_string(),
        ));
    }
    if request.base_commit.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "base commit is required".to_string(),
        ));
    }
    if request.worktree_path.as_os_str().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "worktree path is required".to_string(),
        ));
    }
    if !request.worktree_path.exists() {
        return Err(WorktreeError::InvalidRequest(format!(
            "session worktree does not exist at {}",
            request.worktree_path.display()
        )));
    }

    Ok(())
}

pub fn validate_cleanup_session_worktree_request(
    request: &CleanupSessionWorktreeRequest,
) -> Result<(), WorktreeError> {
    if request.session_id.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "session id is required".to_string(),
        ));
    }
    if request.branch.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "branch is required".to_string(),
        ));
    }
    if request.repo_path.as_os_str().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "repo path is required".to_string(),
        ));
    }
    if request.worktree_path.as_os_str().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "worktree path is required".to_string(),
        ));
    }

    let main_path = comparable_path(&request.main_worktree_path);
    let worktree_path = comparable_path(&request.worktree_path);
    if main_path == worktree_path {
        return Err(WorktreeError::InvalidRequest(
            "session cleanup must not target the main worktree".to_string(),
        ));
    }

    Ok(())
}

pub fn validate_preflight_request(request: &PreflightRequest) -> Result<(), WorktreeError> {
    if request.session_id.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "session id is required".to_string(),
        ));
    }
    if request.main_before_commit.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "main_before_commit is required".to_string(),
        ));
    }
    if request.candidate_commit.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "candidate commit is required".to_string(),
        ));
    }
    if request.sandbox_path.as_os_str().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "sandbox path is required".to_string(),
        ));
    }
    if request.sandbox_path.exists() {
        return Err(WorktreeError::InvalidRequest(format!(
            "sandbox path already exists at {}",
            request.sandbox_path.display()
        )));
    }
    if request.check_commands.is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "at least one check command is required".to_string(),
        ));
    }

    Ok(())
}

pub fn validate_apply_verified_commit_request(
    request: &ApplyVerifiedCommitRequest,
) -> Result<(), WorktreeError> {
    if request.repo_path.as_os_str().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "repo path is required".to_string(),
        ));
    }
    if request.verified_commit_id.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "verified commit id is required".to_string(),
        ));
    }
    if request.verified_tree_id.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "verified tree id is required".to_string(),
        ));
    }

    Ok(())
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct GitCommandOutput {
    success: bool,
    code: Option<i32>,
    stdout: String,
    stderr: String,
}

fn run_git_output(repo_path: &Path, args: &[&str]) -> Result<GitCommandOutput, WorktreeError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()?;

    Ok(GitCommandOutput {
        success: output.status.success(),
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

fn run_git_stdout(repo_path: &Path, args: &[&str]) -> Result<String, WorktreeError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()?;

    if !output.status.success() {
        return Err(WorktreeError::GitCommandFailed {
            args: args.iter().map(|arg| (*arg).to_string()).collect(),
            code: output.status.code(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

fn run_git_success(repo_path: &Path, args: &[&str]) -> Result<(), WorktreeError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()?;

    if !output.status.success() {
        return Err(WorktreeError::GitCommandFailed {
            args: args.iter().map(|arg| (*arg).to_string()).collect(),
            code: output.status.code(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }

    Ok(())
}

fn run_check_command(
    worktree_path: &Path,
    command: &CheckCommand,
) -> Result<PreflightCheckOutput, WorktreeError> {
    let output = Command::new(&command.program)
        .args(&command.args)
        .current_dir(worktree_path)
        .output()?;

    Ok(PreflightCheckOutput {
        name: command.name.clone(),
        command: command.display_command(),
        passed: output.status.success(),
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
    })
}

fn run_git_success_with_config(repo_path: &Path, args: &[&str]) -> Result<(), WorktreeError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .arg("-c")
        .arg("user.name=Aichestra")
        .arg("-c")
        .arg("user.email=aichestra.local@example.invalid")
        .args(args)
        .output()?;

    if !output.status.success() {
        let mut full_args = vec![
            "-c".to_string(),
            "user.name=Aichestra".to_string(),
            "-c".to_string(),
            "user.email=aichestra.local@example.invalid".to_string(),
        ];
        full_args.extend(args.iter().map(|arg| (*arg).to_string()));
        return Err(WorktreeError::GitCommandFailed {
            args: full_args,
            code: output.status.code(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        });
    }

    Ok(())
}

fn git_diff_has_changes(repo_path: &Path, args: &[&str]) -> Result<bool, WorktreeError> {
    let mut full_args = vec!["diff".to_string(), "--quiet".to_string()];
    full_args.extend(args.iter().map(|arg| (*arg).to_string()));

    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(&full_args)
        .output()?;

    match output.status.code() {
        Some(0) => Ok(false),
        Some(1) => Ok(true),
        _ => Err(WorktreeError::GitCommandFailed {
            args: full_args,
            code: output.status.code(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        }),
    }
}

fn registered_worktree_paths(repo_path: &Path) -> Result<Vec<PathBuf>, WorktreeError> {
    let output = run_git_stdout(repo_path, &["worktree", "list", "--porcelain"])?;
    Ok(output
        .lines()
        .filter_map(|line| line.strip_prefix("worktree "))
        .map(PathBuf::from)
        .collect())
}

fn remove_registered_worktree(
    repo_path: &Path,
    worktree_path: &Path,
    registered_paths: &[PathBuf],
) -> Result<bool, WorktreeError> {
    if !registered_paths
        .iter()
        .any(|registered| same_path(registered, worktree_path))
    {
        if worktree_path.exists() {
            return Err(WorktreeError::InvalidRequest(format!(
                "{} exists but is not a registered git worktree; refusing cleanup",
                worktree_path.display()
            )));
        }
        return Ok(false);
    }

    if !worktree_path.exists() {
        run_git_success(repo_path, &["worktree", "prune"])?;
        return Ok(true);
    }

    let status = run_git_stdout(
        worktree_path,
        &["status", "--porcelain", "--untracked-files=all"],
    )?;
    if !status.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(format!(
            "{} is dirty; refusing cleanup",
            worktree_path.display()
        )));
    }

    run_git_success(
        repo_path,
        &["worktree", "remove", &worktree_path.display().to_string()],
    )?;
    Ok(true)
}

fn delete_branch_if_present(repo_path: &Path, branch: &str) -> Result<bool, WorktreeError> {
    let verify = run_git_output(
        repo_path,
        &["rev-parse", "--verify", &format!("refs/heads/{branch}")],
    )?;
    if !verify.success {
        return Ok(false);
    }

    run_git_success(repo_path, &["branch", "-d", branch])?;
    Ok(true)
}

fn same_path(left: &Path, right: &Path) -> bool {
    comparable_path(left) == comparable_path(right)
}

fn parse_name_status(output: &str) -> Vec<GitChangedFile> {
    output
        .lines()
        .filter_map(|line| {
            let mut parts = line.split('\t');
            let status = parts.next()?;
            let first_path = parts.next()?;
            let path = if status.starts_with('R') || status.starts_with('C') {
                parts.next().unwrap_or(first_path)
            } else {
                first_path
            };

            Some(GitChangedFile {
                path: path.to_string(),
                change_type: change_type_from_name_status(status).to_string(),
            })
        })
        .collect()
}

fn change_type_from_name_status(status: &str) -> &'static str {
    match status.chars().next() {
        Some('A') => "added",
        Some('D') => "deleted",
        Some('M') => "modified",
        Some('R') => "renamed",
        Some('C') => "copied",
        Some('T') => "type_changed",
        Some('U') => "unmerged",
        _ => "changed",
    }
}

fn comparable_path(path: &Path) -> PathBuf {
    match path.canonicalize() {
        Ok(path) => path,
        Err(_) => path.to_path_buf(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn rejects_session_worktree_equal_to_main_worktree() {
        let request = CreateWorktreeRequest {
            repo_path: PathBuf::from("repo"),
            main_worktree_path: PathBuf::from("repo"),
            session_id: "session-1".to_string(),
            branch: "aich/session-1/test".to_string(),
            base_ref: "main".to_string(),
            worktree_path: PathBuf::from("repo"),
        };

        let err = validate_worktree_request(&request).unwrap_err();
        assert!(matches!(err, WorktreeError::InvalidRequest(_)));
    }

    #[test]
    fn accepts_dedicated_session_worktree() {
        let request = CreateWorktreeRequest {
            repo_path: PathBuf::from("repo"),
            main_worktree_path: PathBuf::from("repo"),
            session_id: "session-1".to_string(),
            branch: "aich/session-1/test".to_string(),
            base_ref: "main".to_string(),
            worktree_path: PathBuf::from(".aichestra/worktrees/session-1"),
        };

        validate_worktree_request(&request).expect("valid request");
    }

    #[test]
    fn parses_name_status_into_changed_files() {
        let files = parse_name_status(
            "M\tsrc/lib.rs\nA\tREADME.md\nD\told.txt\nR100\told_name.rs\tnew_name.rs\n",
        );

        assert_eq!(
            files,
            vec![
                GitChangedFile {
                    path: "src/lib.rs".to_string(),
                    change_type: "modified".to_string(),
                },
                GitChangedFile {
                    path: "README.md".to_string(),
                    change_type: "added".to_string(),
                },
                GitChangedFile {
                    path: "old.txt".to_string(),
                    change_type: "deleted".to_string(),
                },
                GitChangedFile {
                    path: "new_name.rs".to_string(),
                    change_type: "renamed".to_string(),
                },
            ]
        );
    }

    #[test]
    fn native_preflight_verifies_merge_commit_and_runs_checks() {
        let temp_dir = unique_temp_dir("aich-git-preflight-verified");
        let repo = init_test_repo(&temp_dir);

        fs::write(repo.join("file.txt"), "base\n").expect("write base file");
        git(&repo, &["add", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "initial"]);
        git(&repo, &["branch", "-M", "main"]);
        let main_before = git(&repo, &["rev-parse", "HEAD"]);

        git(&repo, &["checkout", "-q", "-b", "candidate"]);
        fs::write(repo.join("file.txt"), "base\ncandidate\n").expect("write candidate file");
        git(&repo, &["add", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "candidate"]);
        let candidate_commit = git(&repo, &["rev-parse", "HEAD"]);
        git(&repo, &["checkout", "-q", "main"]);

        let sandbox_path = repo.join(".aichestra/sandboxes/preflight-verified");
        let outcome = NativeGitWorktreeManager
            .run_preflight(&PreflightRequest {
                repo_path: repo.clone(),
                sandbox_path: sandbox_path.clone(),
                session_id: "session-1".to_string(),
                main_before_commit: main_before,
                candidate_commit,
                check_commands: vec![CheckCommand {
                    name: "clean".to_string(),
                    program: "git".to_string(),
                    args: vec![
                        "diff".to_string(),
                        "--exit-code".to_string(),
                        "HEAD".to_string(),
                    ],
                }],
            })
            .expect("preflight");

        let verified = match outcome {
            PreflightOutcome::Verified(verified) => verified,
            PreflightOutcome::Blocked(blocked) => panic!("unexpected block: {blocked:?}"),
        };
        assert_eq!(verified.checks.len(), 1);
        assert!(verified.checks[0].passed);
        assert_eq!(
            verified.verified_commit_id,
            git(&sandbox_path, &["rev-parse", "HEAD"])
        );
        assert_eq!(
            verified.verified_tree_id,
            git(&sandbox_path, &["rev-parse", "HEAD^{tree}"])
        );
        assert_eq!(
            fs::read_to_string(sandbox_path.join("file.txt")).expect("read sandbox file"),
            "base\ncandidate\n"
        );

        fs::remove_dir_all(temp_dir).expect("remove temp repo");
    }

    #[test]
    fn native_apply_fast_forwards_to_verified_commit() {
        let temp_dir = unique_temp_dir("aich-git-apply-verified");
        let repo = init_test_repo(&temp_dir);

        fs::write(repo.join(".gitignore"), ".aichestra/\n").expect("write gitignore");
        fs::write(repo.join("file.txt"), "base\n").expect("write base file");
        git(&repo, &["add", ".gitignore", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "initial"]);
        git(&repo, &["branch", "-M", "main"]);
        let main_before = git(&repo, &["rev-parse", "HEAD"]);

        git(&repo, &["checkout", "-q", "-b", "candidate"]);
        fs::write(repo.join("file.txt"), "base\ncandidate\n").expect("write candidate file");
        git(&repo, &["add", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "candidate"]);
        let candidate_commit = git(&repo, &["rev-parse", "HEAD"]);
        git(&repo, &["checkout", "-q", "main"]);

        let sandbox_path = repo.join(".aichestra/sandboxes/preflight-apply");
        let outcome = NativeGitWorktreeManager
            .run_preflight(&PreflightRequest {
                repo_path: repo.clone(),
                sandbox_path,
                session_id: "session-1".to_string(),
                main_before_commit: main_before,
                candidate_commit,
                check_commands: vec![CheckCommand {
                    name: "status".to_string(),
                    program: "git".to_string(),
                    args: vec!["status".to_string(), "--short".to_string()],
                }],
            })
            .expect("preflight");
        let verified = match outcome {
            PreflightOutcome::Verified(verified) => verified,
            PreflightOutcome::Blocked(blocked) => panic!("unexpected block: {blocked:?}"),
        };

        let applied = NativeGitWorktreeManager
            .apply_verified_commit(&ApplyVerifiedCommitRequest {
                repo_path: repo.clone(),
                verified_commit_id: verified.verified_commit_id.clone(),
                verified_tree_id: verified.verified_tree_id.clone(),
            })
            .expect("apply verified commit");

        assert_eq!(applied.applied_commit_id, verified.verified_commit_id);
        assert_eq!(applied.applied_tree_id, verified.verified_tree_id);
        assert_eq!(
            fs::read_to_string(repo.join("file.txt")).expect("read main file"),
            "base\ncandidate\n"
        );

        fs::remove_dir_all(temp_dir).expect("remove temp repo");
    }

    #[test]
    fn native_cleanup_removes_session_worktree_branch_and_sandbox() {
        let temp_dir = unique_temp_dir("aich-git-cleanup-session");
        let repo = init_test_repo(&temp_dir);

        fs::write(repo.join("file.txt"), "base\n").expect("write base file");
        git(&repo, &["add", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "initial"]);
        git(&repo, &["branch", "-M", "main"]);
        let base_commit = git(&repo, &["rev-parse", "HEAD"]);
        let session_worktree = repo.join(".aichestra/worktrees/session-1");
        let sandbox_worktree = repo.join(".aichestra/sandboxes/merge-1");
        git(
            &repo,
            &[
                "worktree",
                "add",
                "-b",
                "aich/session/session-1",
                &session_worktree.display().to_string(),
                &base_commit,
            ],
        );
        git(
            &repo,
            &[
                "worktree",
                "add",
                "--detach",
                &sandbox_worktree.display().to_string(),
                &base_commit,
            ],
        );

        let outcome = NativeGitWorktreeManager
            .cleanup_session_worktree(&CleanupSessionWorktreeRequest {
                repo_path: repo.clone(),
                main_worktree_path: repo.clone(),
                session_id: "session-1".to_string(),
                branch: "aich/session/session-1".to_string(),
                worktree_path: session_worktree.clone(),
                sandbox_paths: vec![sandbox_worktree.clone()],
            })
            .expect("cleanup");

        assert!(outcome.session_worktree_removed);
        assert!(outcome.branch_deleted);
        assert_eq!(
            outcome.sandbox_worktrees_removed,
            vec![sandbox_worktree.clone()]
        );
        assert!(!session_worktree.exists());
        assert!(!sandbox_worktree.exists());
        let branch_verify = Command::new("git")
            .arg("-C")
            .arg(&repo)
            .args(["rev-parse", "--verify", "refs/heads/aich/session/session-1"])
            .output()
            .expect("verify branch");
        assert!(!branch_verify.status.success());

        fs::remove_dir_all(temp_dir).expect("remove temp repo");
    }

    #[test]
    fn native_cleanup_refuses_dirty_session_worktree() {
        let temp_dir = unique_temp_dir("aich-git-cleanup-dirty-session");
        let repo = init_test_repo(&temp_dir);

        fs::write(repo.join("file.txt"), "base\n").expect("write base file");
        git(&repo, &["add", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "initial"]);
        git(&repo, &["branch", "-M", "main"]);
        let base_commit = git(&repo, &["rev-parse", "HEAD"]);
        let session_worktree = repo.join(".aichestra/worktrees/session-1");
        git(
            &repo,
            &[
                "worktree",
                "add",
                "-b",
                "aich/session/session-1",
                &session_worktree.display().to_string(),
                &base_commit,
            ],
        );
        fs::write(session_worktree.join("scratch.txt"), "dirty\n").expect("dirty file");

        let err = NativeGitWorktreeManager
            .cleanup_session_worktree(&CleanupSessionWorktreeRequest {
                repo_path: repo.clone(),
                main_worktree_path: repo.clone(),
                session_id: "session-1".to_string(),
                branch: "aich/session/session-1".to_string(),
                worktree_path: session_worktree.clone(),
                sandbox_paths: Vec::new(),
            })
            .unwrap_err();
        assert!(matches!(err, WorktreeError::InvalidRequest(message) if message.contains("dirty")));

        git(
            &repo,
            &[
                "worktree",
                "remove",
                "--force",
                &session_worktree.display().to_string(),
            ],
        );
        fs::remove_dir_all(temp_dir).expect("remove temp repo");
    }

    #[test]
    fn native_cleanup_prunes_registered_worktree_when_directory_is_missing() {
        let temp_dir = unique_temp_dir("aich-git-cleanup-stale-session");
        let repo = init_test_repo(&temp_dir);

        fs::write(repo.join("file.txt"), "base\n").expect("write base file");
        git(&repo, &["add", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "initial"]);
        git(&repo, &["branch", "-M", "main"]);
        let base_commit = git(&repo, &["rev-parse", "HEAD"]);
        let session_worktree = repo.join(".aichestra/worktrees/session-1");
        git(
            &repo,
            &[
                "worktree",
                "add",
                "-b",
                "aich/session/session-1",
                &session_worktree.display().to_string(),
                &base_commit,
            ],
        );
        fs::remove_dir_all(&session_worktree).expect("remove worktree dir");

        let outcome = NativeGitWorktreeManager
            .cleanup_session_worktree(&CleanupSessionWorktreeRequest {
                repo_path: repo.clone(),
                main_worktree_path: repo.clone(),
                session_id: "session-1".to_string(),
                branch: "aich/session/session-1".to_string(),
                worktree_path: session_worktree.clone(),
                sandbox_paths: Vec::new(),
            })
            .expect("cleanup");

        assert!(outcome.session_worktree_removed);
        assert!(outcome.branch_deleted);
        assert!(!git(&repo, &["worktree", "list", "--porcelain"]).contains("session-1"));

        fs::remove_dir_all(temp_dir).expect("remove temp repo");
    }

    #[test]
    fn native_preflight_blocks_mechanical_conflict() {
        let temp_dir = unique_temp_dir("aich-git-preflight-conflict");
        let repo = init_test_repo(&temp_dir);

        fs::write(repo.join("file.txt"), "base\n").expect("write base file");
        git(&repo, &["add", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "initial"]);
        git(&repo, &["branch", "-M", "main"]);

        git(&repo, &["checkout", "-q", "-b", "candidate"]);
        fs::write(repo.join("file.txt"), "candidate\n").expect("write candidate file");
        git(&repo, &["add", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "candidate"]);
        let candidate_commit = git(&repo, &["rev-parse", "HEAD"]);

        git(&repo, &["checkout", "-q", "main"]);
        fs::write(repo.join("file.txt"), "main\n").expect("write main file");
        git(&repo, &["add", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "main change"]);
        let main_before = git(&repo, &["rev-parse", "HEAD"]);

        let outcome = NativeGitWorktreeManager
            .run_preflight(&PreflightRequest {
                repo_path: repo.clone(),
                sandbox_path: repo.join(".aichestra/sandboxes/preflight-conflict"),
                session_id: "session-1".to_string(),
                main_before_commit: main_before,
                candidate_commit,
                check_commands: vec![CheckCommand {
                    name: "status".to_string(),
                    program: "git".to_string(),
                    args: vec!["status".to_string(), "--short".to_string()],
                }],
            })
            .expect("preflight");

        let blocked = match outcome {
            PreflightOutcome::Blocked(blocked) => blocked,
            PreflightOutcome::Verified(verified) => panic!("unexpected verified: {verified:?}"),
        };
        assert_eq!(blocked.reason, "mechanical_conflict");
        assert_eq!(blocked.conflict_files, vec!["file.txt".to_string()]);
        assert!(blocked.checks.is_empty());

        fs::remove_dir_all(temp_dir).expect("remove temp repo");
    }

    #[test]
    fn native_preflight_blocks_failed_checks_after_creating_verified_tree() {
        let temp_dir = unique_temp_dir("aich-git-preflight-check-fail");
        let repo = init_test_repo(&temp_dir);

        fs::write(repo.join("file.txt"), "base\n").expect("write base file");
        git(&repo, &["add", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "initial"]);
        git(&repo, &["branch", "-M", "main"]);
        let main_before = git(&repo, &["rev-parse", "HEAD"]);

        git(&repo, &["checkout", "-q", "-b", "candidate"]);
        fs::write(repo.join("file.txt"), "base\ncandidate\n").expect("write candidate file");
        git(&repo, &["add", "file.txt"]);
        git(&repo, &["commit", "-q", "-m", "candidate"]);
        let candidate_commit = git(&repo, &["rev-parse", "HEAD"]);
        git(&repo, &["checkout", "-q", "main"]);

        let outcome = NativeGitWorktreeManager
            .run_preflight(&PreflightRequest {
                repo_path: repo,
                sandbox_path: temp_dir.join("sandbox-check-fail"),
                session_id: "session-1".to_string(),
                main_before_commit: main_before,
                candidate_commit,
                check_commands: vec![CheckCommand {
                    name: "changed-from-main".to_string(),
                    program: "git".to_string(),
                    args: vec![
                        "diff".to_string(),
                        "--quiet".to_string(),
                        "HEAD~1".to_string(),
                        "HEAD".to_string(),
                    ],
                }],
            })
            .expect("preflight");

        let blocked = match outcome {
            PreflightOutcome::Blocked(blocked) => blocked,
            PreflightOutcome::Verified(verified) => panic!("unexpected verified: {verified:?}"),
        };
        assert_eq!(blocked.reason, "checks_failed");
        assert!(blocked.verified_tree_id.is_some());
        assert!(blocked.verified_commit_id.is_some());
        assert_eq!(blocked.checks.len(), 1);
        assert!(!blocked.checks[0].passed);

        fs::remove_dir_all(temp_dir).expect("remove temp repo");
    }

    fn unique_temp_dir(name: &str) -> PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_millis();
        let path = env::temp_dir().join(format!("{name}-{}-{millis}", std::process::id()));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    fn init_test_repo(temp_dir: &Path) -> PathBuf {
        let repo = temp_dir.join("repo");
        fs::create_dir_all(&repo).expect("create repo dir");
        let output = Command::new("git")
            .arg("init")
            .arg("-q")
            .arg(&repo)
            .output()
            .expect("run git init");
        assert!(
            output.status.success(),
            "git init failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        git(&repo, &["config", "user.name", "Aichestra Test"]);
        git(
            &repo,
            &["config", "user.email", "aichestra-test@example.invalid"],
        );
        repo
    }

    fn git(repo: &Path, args: &[&str]) -> String {
        let output = Command::new("git")
            .arg("-C")
            .arg(repo)
            .args(args)
            .output()
            .expect("run git");
        assert!(
            output.status.success(),
            "git {:?} failed\nstdout:\n{}\nstderr:\n{}",
            args,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }
}
