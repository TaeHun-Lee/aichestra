use std::path::{Path, PathBuf};
use std::process::Command;

use crate::{
    comparable_path, current_branch_name, resolve_commit, NativeGitWorktreeManager, WorktreeError,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HeadCommit {
    pub commit_id: String,
}

pub trait GitRepository {
    fn head_commit(&self, repo_path: &Path) -> Result<HeadCommit, WorktreeError>;

    fn ref_commit(&self, repo_path: &Path, git_ref: &str) -> Result<HeadCommit, WorktreeError> {
        let _ = git_ref;
        self.head_commit(repo_path)
    }

    fn current_branch(&self, _repo_path: &Path) -> Result<Option<String>, WorktreeError> {
        Ok(None)
    }
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

impl GitRepository for NativeGitWorktreeManager {
    fn head_commit(&self, repo_path: &Path) -> Result<HeadCommit, WorktreeError> {
        resolve_commit(repo_path, "HEAD")
    }

    fn ref_commit(&self, repo_path: &Path, git_ref: &str) -> Result<HeadCommit, WorktreeError> {
        if git_ref.trim().is_empty() {
            return Err(WorktreeError::InvalidRequest(
                "git ref is required".to_string(),
            ));
        }

        resolve_commit(repo_path, &format!("{}^{{commit}}", git_ref.trim()))
    }

    fn current_branch(&self, repo_path: &Path) -> Result<Option<String>, WorktreeError> {
        current_branch_name(repo_path)
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
