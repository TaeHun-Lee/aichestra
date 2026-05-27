use aich_core::clock::now_millis;
use aich_core::{
    assert_verified_candidate_can_apply, EventName, MergeAttemptStatus, NewEvent, SessionStatus,
    VerifiedTreeViolation,
};
use aich_git::{ApplyVerifiedCommitRequest, GitRepository, VerifiedCommitApplier, WorktreeError};

use crate::approval::{ensure_attempt_can_be_approved, latest_approval};
use crate::config::{main_branch_from_config, main_branch_ref};
use crate::formatting::json_escape;
use crate::options::ApplyOptions;
use crate::queue::acquire_merge_queue_lock;
use crate::session::ensure_session_not_abandoned;
use crate::{
    latest_merge_attempt, open_existing_ledger, resolve_active_operator, ApplyRunResult, CliError,
};
pub(crate) fn run_apply_with<R, A>(
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
    ensure_session_not_abandoned(&session, "applied")?;
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
    let locked_session = ledger
        .get_session(&session.id)?
        .ok_or_else(|| CliError::Usage(format!("session '{}' does not exist", session.id)))?;
    ensure_session_not_abandoned(&locked_session, "applied")?;

    let main_branch = main_branch_from_config(&config_path)?;
    let main_ref = main_branch_ref(&main_branch);
    let current_main = git_repo
        .ref_commit(&options.repo_root, &main_ref)
        .map_err(|error| {
            CliError::Usage(format!(
                "cannot resolve configured main branch '{main_branch}' ({main_ref}) for apply: {error}. Update `.aichestra/config.yaml` `git.main_branch` or create the local branch, then re-run preflight/review/approve before apply."
            ))
        })?
        .commit_id;
    assert_verified_candidate_can_apply(&attempt, &approval, &current_main)
        .map_err(|error| CliError::Usage(apply_violation_message(&session.id, &error)))?;

    ledger.update_merge_attempt_status(&attempt.id, MergeAttemptStatus::Applying, now_millis())?;
    let applied = match applier.apply_verified_commit(&ApplyVerifiedCommitRequest {
        repo_path: options.repo_root.clone(),
        main_branch: main_branch.clone(),
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
            return Err(CliError::Usage(apply_worktree_error_message(
                &session.id,
                &main_branch,
                &error,
            )));
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

fn apply_violation_message(session_id: &str, error: &VerifiedTreeViolation) -> String {
    match error {
        VerifiedTreeViolation::MainMoved { .. } => format!(
            "candidate cannot be applied: {error}. Main changed after preflight. Re-run `aich preflight {session_id}`, `aich review {session_id}`, and `aich approve {session_id}` before applying again."
        ),
        VerifiedTreeViolation::AttemptNotVerified { .. }
        | VerifiedTreeViolation::ChecksNotPassed
        | VerifiedTreeViolation::MissingVerifiedTree
        | VerifiedTreeViolation::MissingVerifiedCommit => format!(
            "candidate cannot be applied: {error}. Re-run `aich preflight {session_id}` and continue with review/approval before applying."
        ),
        VerifiedTreeViolation::ApprovalAttemptMismatch { .. }
        | VerifiedTreeViolation::VerifiedTreeMismatch { .. }
        | VerifiedTreeViolation::VerifiedCommitMismatch { .. } => format!(
            "candidate cannot be applied: {error}. The approval no longer matches the verified candidate; re-run review and approval for session '{session_id}'."
        ),
    }
}

fn apply_worktree_error_message(
    session_id: &str,
    main_branch: &str,
    error: &WorktreeError,
) -> String {
    match error {
        WorktreeError::InvalidRequest(message)
            if message.contains("expected configured main branch") =>
        {
            format!(
                "{message}. Switch to the configured branch with `git switch {main_branch}`, then re-run `aich apply {session_id}`. If you intended to use the current branch as main, update `.aichestra/config.yaml` `git.main_branch` and re-run preflight/review/approve before apply."
            )
        }
        WorktreeError::InvalidRequest(message) if message.contains("dirty") => {
            format!(
                "{message}. Commit, stash, or discard local changes in the configured main worktree, then re-run `aich apply {session_id}`."
            )
        }
        WorktreeError::InvalidRequest(message) if message.contains("not a descendant") => {
            format!(
                "{message}. Re-run `aich preflight {session_id}`, `aich review {session_id}`, and `aich approve {session_id}` before applying again."
            )
        }
        _ => format!("apply failed for session '{session_id}': {error}"),
    }
}
