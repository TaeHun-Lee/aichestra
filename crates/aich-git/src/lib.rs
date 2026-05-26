use std::error::Error;
use std::fmt::{Display, Formatter};
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

fn comparable_path(path: &Path) -> PathBuf {
    match path.canonicalize() {
        Ok(path) => path,
        Err(_) => path.to_path_buf(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
