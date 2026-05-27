use std::path::{Path, PathBuf};

use crate::{
    comparable_path, run_git_output, run_git_stdout, run_git_success, NativeGitWorktreeManager,
    WorktreeError,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CleanupSessionWorktreeRequest {
    pub repo_path: PathBuf,
    pub main_worktree_path: PathBuf,
    pub session_id: String,
    pub branch: String,
    pub worktree_path: PathBuf,
    pub sandbox_paths: Vec<PathBuf>,
    pub force_branch_delete: bool,
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

        let branch_deleted = delete_branch_if_present(
            &request.repo_path,
            &request.branch,
            request.force_branch_delete,
        )?;

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
        run_git_success(repo_path, &["worktree", "prune", "--expire", "now"])?;
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

fn delete_branch_if_present(
    repo_path: &Path,
    branch: &str,
    force: bool,
) -> Result<bool, WorktreeError> {
    let verify = run_git_output(
        repo_path,
        &["rev-parse", "--verify", &format!("refs/heads/{branch}")],
    )?;
    if !verify.success {
        return Ok(false);
    }

    let delete_flag = if force { "-D" } else { "-d" };
    run_git_success(repo_path, &["branch", delete_flag, branch])?;
    Ok(true)
}

fn same_path(left: &Path, right: &Path) -> bool {
    comparable_path(left) == comparable_path(right)
}
