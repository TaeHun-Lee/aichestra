use std::sync::atomic::{AtomicU64, Ordering};

use aich_core::clock::now_millis;
use aich_core::{ApprovalRejection, EventName, MergeAttemptStatus, NewEvent, SemanticRiskLevel};
use aich_ledger::MergeAttemptResultUpdate;

use crate::approval::{ensure_attempt_can_be_approved, latest_approval};
use crate::formatting::json_escape;
use crate::options::RejectOptions;
use crate::session::ensure_session_not_abandoned;
use crate::RejectRunResult;
use crate::{latest_merge_attempt, open_existing_ledger, resolve_active_operator, CliError};

static REJECTION_COUNTER: AtomicU64 = AtomicU64::new(1);

fn next_rejection_id(created_at_ms: i64) -> String {
    let counter = REJECTION_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("rejection-{created_at_ms}-{counter}")
}

pub(crate) fn run_reject_with(options: &RejectOptions) -> Result<RejectRunResult, CliError> {
    let config_path = options.repo_root.join(".aichestra").join("config.yaml");
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
    ensure_session_not_abandoned(&session, "rejected")?;

    let attempt = latest_merge_attempt(&ledger, &session.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no preflight attempt to reject",
            session.id
        ))
    })?;
    if matches!(
        attempt.status,
        MergeAttemptStatus::Applying | MergeAttemptStatus::Applied
    ) {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is {} and cannot be rejected",
            attempt.id,
            attempt.status.as_str()
        )));
    }
    ensure_attempt_can_be_approved(&attempt)?;

    let semantic_reviews = ledger.list_semantic_reviews(&attempt.id)?;
    let Some(latest_review) = semantic_reviews.last() else {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' has no semantic review; run `aich review {}` before reject",
            attempt.id, session.id
        )));
    };
    if latest_review.risk_level == SemanticRiskLevel::Blocked {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is already blocked by semantic review; run `aich session reopen {}` to revise it",
            attempt.id, session.id
        )));
    }
    if latest_approval(&ledger, &attempt.id)?.is_some() {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is already approved and cannot be rejected",
            attempt.id
        )));
    }

    let verified_tree_id = attempt
        .verified_tree_id
        .as_deref()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            CliError::Usage(format!(
                "merge attempt '{}' has no verified tree id and cannot be rejected",
                attempt.id
            ))
        })?;
    let verified_commit_id = attempt
        .verified_commit_id
        .as_deref()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            CliError::Usage(format!(
                "merge attempt '{}' has no verified commit id and cannot be rejected",
                attempt.id
            ))
        })?;

    let created_at_ms = now_millis();
    let rejection = ApprovalRejection {
        id: next_rejection_id(created_at_ms),
        merge_attempt_id: attempt.id.clone(),
        rejected_by: operator.id.clone(),
        rejected_verified_tree_id: verified_tree_id.to_string(),
        rejected_verified_commit_id: verified_commit_id.to_string(),
        reason: options.reason.trim().to_string(),
        created_at_ms,
    };

    let tx = ledger.begin_immediate_transaction()?;
    ledger.insert_rejection(&rejection)?;
    ledger.update_merge_attempt_result(MergeAttemptResultUpdate {
        id: &attempt.id,
        status: MergeAttemptStatus::Blocked,
        verified_tree_id: attempt.verified_tree_id.as_deref(),
        verified_commit_id: attempt.verified_commit_id.as_deref(),
        checks_passed: attempt.checks_passed,
        semantic_risk_level: attempt.semantic_risk_level.as_deref(),
        updated_at_ms: created_at_ms,
    })?;
    ledger.append_event(
        &NewEvent::new(EventName::ApprovalRejected)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"rejection_id\":\"{}\",\"semantic_review_id\":\"{}\",\"verified_tree_id\":\"{}\",\"verified_commit_id\":\"{}\",\"reason\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&rejection.id),
                json_escape(&latest_review.id),
                json_escape(&rejection.rejected_verified_tree_id),
                json_escape(&rejection.rejected_verified_commit_id),
                json_escape(&rejection.reason)
            )),
    )?;
    ledger.append_event(
        &NewEvent::new(EventName::MergeBlocked)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"reason\":\"rejected\",\"rejection_id\":\"{}\",\"semantic_review_id\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&rejection.id),
                json_escape(&latest_review.id)
            )),
    )?;
    tx.commit()?;

    let mut rejected_attempt = attempt;
    rejected_attempt.status = MergeAttemptStatus::Blocked;

    Ok(RejectRunResult {
        rejection,
        merge_attempt: rejected_attempt,
        operator,
    })
}
