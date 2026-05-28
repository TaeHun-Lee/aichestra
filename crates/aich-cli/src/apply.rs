use aich_core::clock::now_millis;
use aich_core::{
    assert_verified_candidate_can_apply, Approval, EventName, MergeAttempt, MergeAttemptStatus,
    NewEvent, Operator, SemanticRiskLevel, Session, SessionStatus, VerifiedTreeViolation,
};
use aich_git::{ApplyVerifiedCommitRequest, GitRepository, VerifiedCommitApplier, WorktreeError};
use aich_ledger::Ledger;

use crate::approval::{ensure_attempt_can_be_approved, latest_approval};
use crate::config::{main_branch_from_config, main_branch_ref};
use crate::formatting::json_escape;
use crate::options::ApplyOptions;
use crate::preflight::ensure_preflight_check_policy_current;
use crate::queue::acquire_merge_queue_lock;
use crate::session::ensure_session_not_abandoned;
use crate::{
    latest_merge_attempt, load_verified_candidate_summary, open_existing_ledger,
    resolve_active_operator, ApplyRunResult, CliError,
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
    latest_merge_attempt(&ledger, &session.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no preflight attempt; run `aich preflight {}` first",
            session.id, session.id
        ))
    })?;
    let _queue_lock = acquire_merge_queue_lock(&ledger, "apply", &session.id)?;
    let locked_session = ledger
        .get_session(&session.id)?
        .ok_or_else(|| CliError::Usage(format!("session '{}' does not exist", session.id)))?;
    ensure_session_not_abandoned(&locked_session, "applied")?;
    let mut attempt = latest_merge_attempt(&ledger, &locked_session.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no preflight attempt; run `aich preflight {}` first",
            locked_session.id, locked_session.id
        ))
    })?;
    let approval = latest_approval(&ledger, &attempt.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "merge attempt '{}' has no approval; run `aich approve {}` first",
            attempt.id, locked_session.id
        ))
    })?;

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
    match attempt.status {
        MergeAttemptStatus::Applying => {
            if let Some(recovered) = recover_interrupted_apply(
                &ledger,
                &locked_session,
                &attempt,
                &approval,
                &operator,
                &current_main,
            )? {
                return Ok(recovered);
            }
            attempt = ledger.get_merge_attempt(&attempt.id)?.ok_or_else(|| {
                CliError::Usage(format!("merge attempt '{}' does not exist", attempt.id))
            })?;
        }
        MergeAttemptStatus::Applied => {
            return recover_already_applied_attempt(
                &ledger,
                &locked_session,
                &attempt,
                &approval,
                &operator,
                &current_main,
            );
        }
        _ => {}
    }

    ensure_attempt_can_be_approved(&attempt)?;
    ensure_preflight_check_policy_current(&attempt, &config_path, &locked_session.id)?;
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
        let tx = ledger.begin_immediate_transaction()?;
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
        tx.commit()?;
        return Err(CliError::Usage(
            "applied commit/tree did not match the approved verified candidate".to_string(),
        ));
    }

    finish_applied_attempt(
        &ledger,
        &locked_session,
        &attempt,
        &approval,
        &operator,
        AppliedCandidate {
            commit_id: &applied.applied_commit_id,
            tree_id: &applied.applied_tree_id,
            recovered: false,
        },
    )
}

fn recover_interrupted_apply(
    ledger: &Ledger,
    session: &Session,
    attempt: &MergeAttempt,
    approval: &Approval,
    operator: &Operator,
    current_main: &str,
) -> Result<Option<ApplyRunResult>, CliError> {
    ensure_recoverable_attempt_matches_approval(attempt, approval)?;

    if current_main == approval.approved_verified_commit_id {
        return finish_applied_attempt(
            ledger,
            session,
            attempt,
            approval,
            operator,
            AppliedCandidate {
                commit_id: &approval.approved_verified_commit_id,
                tree_id: &approval.approved_verified_tree_id,
                recovered: true,
            },
        )
        .map(Some);
    }

    if current_main == attempt.main_before_commit {
        ledger.update_merge_attempt_status(
            &attempt.id,
            MergeAttemptStatus::Verified,
            now_millis(),
        )?;
        return Ok(None);
    }

    Err(CliError::Usage(format!(
        "merge attempt '{}' is applying but configured main is at {}; expected main_before {} to retry apply or approved verified commit {} to finalize recovery. Inspect `aich queue` and `aich doctor` before retrying.",
        attempt.id,
        current_main,
        attempt.main_before_commit,
        approval.approved_verified_commit_id
    )))
}

fn recover_already_applied_attempt(
    ledger: &Ledger,
    session: &Session,
    attempt: &MergeAttempt,
    approval: &Approval,
    operator: &Operator,
    current_main: &str,
) -> Result<ApplyRunResult, CliError> {
    ensure_recoverable_attempt_matches_approval(attempt, approval)?;

    if current_main == approval.approved_verified_commit_id {
        return finish_applied_attempt(
            ledger,
            session,
            attempt,
            approval,
            operator,
            AppliedCandidate {
                commit_id: &approval.approved_verified_commit_id,
                tree_id: &approval.approved_verified_tree_id,
                recovered: true,
            },
        );
    }

    Err(CliError::Usage(format!(
        "merge attempt '{}' is already marked applied but configured main is at {}; expected approved verified commit {}. Inspect `aich queue` and `aich doctor` before changing ledger state.",
        attempt.id, current_main, approval.approved_verified_commit_id
    )))
}

fn ensure_recoverable_attempt_matches_approval(
    attempt: &MergeAttempt,
    approval: &Approval,
) -> Result<(), CliError> {
    if !matches!(
        attempt.status,
        MergeAttemptStatus::Applying | MergeAttemptStatus::Applied
    ) {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is not in an apply recovery state; status is {}",
            attempt.id,
            attempt.status.as_str()
        )));
    }
    if !attempt.checks_passed {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is applying but checks were not recorded as passed; inspect queue state before recovery",
            attempt.id
        )));
    }
    if approval.merge_attempt_id != attempt.id {
        return Err(CliError::Usage(format!(
            "approval '{}' targets merge attempt '{}', not applying attempt '{}'",
            approval.id, approval.merge_attempt_id, attempt.id
        )));
    }
    let verified_tree_id = attempt
        .verified_tree_id
        .as_deref()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            CliError::Usage(format!(
                "merge attempt '{}' is applying but has no verified tree id",
                attempt.id
            ))
        })?;
    let verified_commit_id = attempt
        .verified_commit_id
        .as_deref()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            CliError::Usage(format!(
                "merge attempt '{}' is applying but has no verified commit id",
                attempt.id
            ))
        })?;
    if approval.approved_verified_tree_id != verified_tree_id
        || approval.approved_verified_commit_id != verified_commit_id
    {
        return Err(CliError::Usage(format!(
            "approval '{}' no longer matches applying merge attempt '{}'",
            approval.id, attempt.id
        )));
    }
    if attempt.semantic_risk_level.as_deref() == Some(SemanticRiskLevel::Blocked.as_str()) {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is blocked by semantic review and cannot be recovered as applied",
            attempt.id
        )));
    }

    Ok(())
}

#[derive(Clone, Copy)]
struct AppliedCandidate<'a> {
    commit_id: &'a str,
    tree_id: &'a str,
    recovered: bool,
}

fn finish_applied_attempt(
    ledger: &Ledger,
    session: &Session,
    attempt: &MergeAttempt,
    approval: &Approval,
    operator: &Operator,
    applied: AppliedCandidate<'_>,
) -> Result<ApplyRunResult, CliError> {
    let tx = ledger.begin_immediate_transaction()?;
    if attempt.status != MergeAttemptStatus::Applied {
        ledger.update_merge_attempt_status(
            &attempt.id,
            MergeAttemptStatus::Applied,
            now_millis(),
        )?;
    }
    if session.status != SessionStatus::Completed {
        ledger.update_session_status(&session.id, SessionStatus::Completed, now_millis())?;
    }
    if !merge_applied_event_exists(ledger, &attempt.id)? {
        ledger.append_event(
            &NewEvent::new(EventName::MergeApplied)
                .with_subject("merge_attempt", attempt.id.clone())
                .with_data_json(format!(
                    "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"approval_id\":\"{}\",\"applied_commit_id\":\"{}\",\"applied_tree_id\":\"{}\",\"recovered\":{}}}",
                    json_escape(&operator.id),
                    json_escape(&session.id),
                    json_escape(&approval.id),
                    json_escape(applied.commit_id),
                    json_escape(applied.tree_id),
                    applied.recovered
                )),
        )?;
    }
    tx.commit()?;

    let merge_attempt = ledger
        .get_merge_attempt(&attempt.id)?
        .ok_or_else(|| CliError::Usage(format!("merge attempt '{}' does not exist", attempt.id)))?;
    let candidate_summary = load_verified_candidate_summary(ledger, &session.id, &attempt.id)?;

    Ok(ApplyRunResult {
        merge_attempt,
        approval: approval.clone(),
        operator: operator.clone(),
        candidate_summary,
        applied_commit_id: applied.commit_id.to_string(),
        applied_tree_id: applied.tree_id.to_string(),
    })
}

fn merge_applied_event_exists(ledger: &Ledger, attempt_id: &str) -> Result<bool, CliError> {
    Ok(ledger.list_events()?.iter().any(|event| {
        event.name == EventName::MergeApplied.as_str()
            && event.subject_type.as_deref() == Some("merge_attempt")
            && event.subject_id.as_deref() == Some(attempt_id)
    }))
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
