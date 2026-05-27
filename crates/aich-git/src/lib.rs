use std::error::Error;
use std::fmt::{Display, Formatter};
use std::path::Path;
use std::process::Command;

mod apply;
mod cleanup;
mod complete;
mod preflight;
mod worktree;

pub use apply::{
    validate_apply_verified_commit_request, AppliedVerifiedCommit, ApplyVerifiedCommitRequest,
    VerifiedCommitApplier,
};
pub use cleanup::{
    validate_cleanup_session_worktree_request, CleanupSessionWorktreeOutcome,
    CleanupSessionWorktreeRequest, SessionWorktreeCleaner,
};
pub use complete::{
    validate_complete_session_worktree_request, CompleteSessionWorktreeOutcome,
    CompleteSessionWorktreeRequest, CompletedSessionWorktree, GitChangedFile,
    SessionWorktreeCompleter,
};
pub use preflight::{
    validate_preflight_request, CheckCommand, PreflightBlocked, PreflightCheckOutput,
    PreflightOutcome, PreflightRequest, PreflightRunner, PreflightVerified,
};
pub use worktree::{
    validate_worktree_request, CreateWorktreeRequest, GitRepository, HeadCommit, SessionWorktree,
    WorktreeManager,
};

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

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct GitCommandOutput {
    pub(crate) success: bool,
    pub(crate) code: Option<i32>,
    pub(crate) stdout: String,
    pub(crate) stderr: String,
}

pub(crate) fn resolve_commit(repo_path: &Path, rev: &str) -> Result<HeadCommit, WorktreeError> {
    let commit_id = run_git_stdout(repo_path, &["rev-parse", "--verify", rev])?
        .trim()
        .to_string();
    if commit_id.is_empty() {
        return Err(WorktreeError::InvalidRequest(format!(
            "git rev-parse {rev} returned an empty commit id"
        )));
    }

    Ok(HeadCommit { commit_id })
}

pub(crate) fn current_branch_name(repo_path: &Path) -> Result<Option<String>, WorktreeError> {
    let branch = run_git_stdout(repo_path, &["branch", "--show-current"])?
        .trim()
        .to_string();
    if branch.is_empty() {
        Ok(None)
    } else {
        Ok(Some(branch))
    }
}

pub(crate) fn run_git_output(
    repo_path: &Path,
    args: &[&str],
) -> Result<GitCommandOutput, WorktreeError> {
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

pub(crate) fn run_git_stdout(repo_path: &Path, args: &[&str]) -> Result<String, WorktreeError> {
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

pub(crate) fn run_git_success(repo_path: &Path, args: &[&str]) -> Result<(), WorktreeError> {
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

pub(crate) fn run_git_success_with_config(
    repo_path: &Path,
    args: &[&str],
) -> Result<(), WorktreeError> {
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

pub(crate) fn git_diff_has_changes(repo_path: &Path, args: &[&str]) -> Result<bool, WorktreeError> {
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

pub(crate) fn comparable_path(path: &Path) -> std::path::PathBuf {
    match path.canonicalize() {
        Ok(path) => path,
        Err(_) => path.to_path_buf(),
    }
}

#[cfg(test)]
mod tests;
