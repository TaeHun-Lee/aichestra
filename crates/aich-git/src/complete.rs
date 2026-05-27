use crate::{
    current_branch_name, git_diff_has_changes, run_git_stdout, run_git_success,
    run_git_success_with_config, NativeGitWorktreeManager, WorktreeError,
};
use std::path::PathBuf;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GitChangedFile {
    pub path: String,
    pub change_type: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompleteSessionWorktreeRequest {
    pub session_id: String,
    pub worktree_path: PathBuf,
    pub session_branch: String,
    pub main_branch: String,
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

impl SessionWorktreeCompleter for NativeGitWorktreeManager {
    fn complete_session_worktree(
        &self,
        request: &CompleteSessionWorktreeRequest,
    ) -> Result<CompleteSessionWorktreeOutcome, WorktreeError> {
        validate_complete_session_worktree_request(request)?;
        ensure_session_worktree_branch(request)?;

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
    if request.session_branch.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "session branch is required".to_string(),
        ));
    }
    if request.main_branch.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "main branch is required".to_string(),
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

fn ensure_session_worktree_branch(
    request: &CompleteSessionWorktreeRequest,
) -> Result<(), WorktreeError> {
    let current_branch = current_branch_name(&request.worktree_path)?;
    match current_branch.as_deref() {
        Some(branch) if branch == request.main_branch => Err(WorktreeError::InvalidRequest(
            format!(
                "session worktree is on configured main branch '{branch}'; refuse to complete from main"
            ),
        )),
        Some(branch) if branch == request.session_branch => Ok(()),
        Some(branch) => Err(WorktreeError::InvalidRequest(format!(
            "session worktree is on branch '{branch}', expected session branch '{}'",
            request.session_branch
        ))),
        None => Err(WorktreeError::InvalidRequest(format!(
            "session worktree is detached; expected session branch '{}'",
            request.session_branch
        ))),
    }
}

pub(crate) fn parse_name_status(output: &str) -> Vec<GitChangedFile> {
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
