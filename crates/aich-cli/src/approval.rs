use std::sync::atomic::{AtomicU64, Ordering};

use aich_core::clock::now_millis;
use aich_core::{
    assert_verified_candidate_can_apply, Approval, EventName, MergeAttempt, NewEvent,
    SemanticRiskLevel,
};
use aich_git::GitRepository;
use aich_ledger::Ledger;
use aich_merge::ensure_attempt_can_be_approved as merge_ensure_attempt_can_be_approved;

use crate::config::{main_branch_from_config, main_branch_ref};
use crate::formatting::json_escape;
use crate::options::ApproveOptions;
use crate::session::ensure_session_not_abandoned;
use crate::{
    latest_merge_attempt, open_existing_ledger, resolve_active_operator, ApproveRunResult, CliError,
};

static APPROVAL_COUNTER: AtomicU64 = AtomicU64::new(1);
fn next_approval_id(created_at_ms: i64) -> String {
    let counter = APPROVAL_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("approval-{created_at_ms}-{counter}")
}

pub(crate) fn run_approve_with<R>(
    options: &ApproveOptions,
    git_repo: &R,
) -> Result<ApproveRunResult, CliError>
where
    R: GitRepository,
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
    ensure_session_not_abandoned(&session, "approved")?;
    let attempt = latest_merge_attempt(&ledger, &session.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no preflight attempt; run `aich preflight {}` first",
            session.id, session.id
        ))
    })?;
    ensure_attempt_can_be_approved(&attempt)?;

    let semantic_reviews = ledger.list_semantic_reviews(&attempt.id)?;
    let Some(latest_review) = semantic_reviews.last() else {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' has no semantic review; run `aich review {}` first",
            attempt.id, session.id
        )));
    };
    if latest_review.risk_level == SemanticRiskLevel::Blocked {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' has blocked semantic risk; revise the candidate and run preflight/review again",
            attempt.id
        )));
    }
    if latest_review.proposed_patch_available && !options.accept_current {
        return Err(CliError::Usage(format!(
            "semantic review '{}' produced a proposed patch or fix plan. Choose one path before approving:\n  rework: aich session rework {} --review {}\n  accept current verified tree: aich approve {} --accept-current",
            latest_review.id, session.id, latest_review.id, session.id
        )));
    }

    let main_branch = main_branch_from_config(&config_path)?;
    let current_main = git_repo
        .ref_commit(&options.repo_root, &main_branch_ref(&main_branch))?
        .commit_id;
    let created_at_ms = now_millis();
    let approval = Approval {
        id: next_approval_id(created_at_ms),
        merge_attempt_id: attempt.id.clone(),
        approved_by: operator.id.clone(),
        approved_verified_tree_id: attempt
            .verified_tree_id
            .clone()
            .expect("verified attempt must have tree id"),
        approved_verified_commit_id: attempt
            .verified_commit_id
            .clone()
            .expect("verified attempt must have commit id"),
        created_at_ms,
    };
    assert_verified_candidate_can_apply(&attempt, &approval, &current_main)
        .map_err(|error| CliError::Usage(format!("candidate cannot be approved: {error}")))?;

    let tx = ledger.begin_immediate_transaction()?;
    ledger.append_event(
        &NewEvent::new(EventName::ApprovalRequested)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"verified_tree_id\":\"{}\",\"verified_commit_id\":\"{}\",\"semantic_risk_level\":\"{}\",\"accepted_current_despite_proposed_patch\":{}}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&approval.approved_verified_tree_id),
                json_escape(&approval.approved_verified_commit_id),
                json_escape(attempt.semantic_risk_level.as_deref().unwrap_or("unknown")),
                latest_review.proposed_patch_available && options.accept_current
            )),
    )?;
    ledger.insert_approval(&approval)?;
    ledger.append_event(
        &NewEvent::new(EventName::ApprovalApproved)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"approval_id\":\"{}\",\"verified_tree_id\":\"{}\",\"verified_commit_id\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&approval.id),
                json_escape(&approval.approved_verified_tree_id),
                json_escape(&approval.approved_verified_commit_id)
            )),
    )?;
    tx.commit()?;

    Ok(ApproveRunResult {
        approval,
        merge_attempt: attempt,
        operator,
        semantic_reviews,
    })
}

pub(crate) fn latest_approval(
    ledger: &Ledger,
    merge_attempt_id: &str,
) -> Result<Option<Approval>, CliError> {
    Ok(ledger.list_approvals(merge_attempt_id)?.into_iter().last())
}

pub(crate) fn ensure_attempt_can_be_approved(attempt: &MergeAttempt) -> Result<(), CliError> {
    merge_ensure_attempt_can_be_approved(attempt)
        .map_err(|error| CliError::Usage(error.to_string()))
}
