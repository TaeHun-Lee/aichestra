use std::path::{Path, PathBuf};

use crate::{
    current_branch_name, run_git_output, run_git_stdout, NativeGitWorktreeManager, WorktreeError,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApplyVerifiedCommitRequest {
    pub repo_path: PathBuf,
    pub main_branch: String,
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

impl VerifiedCommitApplier for NativeGitWorktreeManager {
    fn apply_verified_commit(
        &self,
        request: &ApplyVerifiedCommitRequest,
    ) -> Result<AppliedVerifiedCommit, WorktreeError> {
        validate_apply_verified_commit_request(request)?;
        ensure_main_worktree_branch(&request.repo_path, &request.main_branch)?;

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

pub fn validate_apply_verified_commit_request(
    request: &ApplyVerifiedCommitRequest,
) -> Result<(), WorktreeError> {
    if request.repo_path.as_os_str().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "repo path is required".to_string(),
        ));
    }
    if request.main_branch.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "main branch is required".to_string(),
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

fn ensure_main_worktree_branch(repo_path: &Path, main_branch: &str) -> Result<(), WorktreeError> {
    let current_branch = current_branch_name(repo_path)?;
    match current_branch.as_deref() {
        Some(branch) if branch == main_branch => Ok(()),
        Some(branch) => Err(WorktreeError::InvalidRequest(format!(
            "main worktree is on branch '{branch}', expected configured main branch '{main_branch}'"
        ))),
        None => Err(WorktreeError::InvalidRequest(format!(
            "main worktree is detached; expected configured main branch '{main_branch}'"
        ))),
    }
}
