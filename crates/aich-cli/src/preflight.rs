use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use aich_core::clock::now_millis;
use aich_core::{EventName, MergeAttempt, MergeAttemptStatus, NewEvent, Operator};
use aich_git::{
    GitRepository, PreflightBlocked, PreflightOutcome, PreflightRequest, PreflightRunner,
    PreflightVerified,
};
use aich_ledger::{Ledger, MergeAttemptResultUpdate};

use crate::checks::{check_commands_from_config, persist_preflight_checks};
use crate::config::{main_branch_from_config, main_branch_ref};
use crate::formatting::json_escape;
use crate::options::PreflightOptions;
use crate::queue::{acquire_merge_queue_lock, queue_entries, queue_next_action};
use crate::session::ensure_session_can_preflight;
use crate::{open_existing_ledger, resolve_active_operator, CliError, PreflightRunResult};

static MERGE_ATTEMPT_COUNTER: AtomicU64 = AtomicU64::new(1);
pub(crate) const PREFLIGHT_APPLY_STRATEGY: &str = "merge_no_ff_commit";
pub(crate) fn run_preflight_with<R, P>(
    options: &PreflightOptions,
    git_repo: &R,
    preflight_runner: &P,
) -> Result<PreflightRunResult, CliError>
where
    R: GitRepository,
    P: PreflightRunner,
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
    ensure_session_can_preflight(&session)?;

    let candidate_commit = session.head_commit.clone().ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no candidate head commit; run `aich session complete {}` first",
            session.id, session.id
        ))
    })?;

    let manifests = ledger.list_change_manifests(&session.id)?;
    if manifests.is_empty() {
        return Err(CliError::Usage(format!(
            "session '{}' has no Change Manifest; run `aich session complete {}` first",
            session.id, session.id
        )));
    }
    let _queue_lock = acquire_merge_queue_lock(&ledger, "preflight", &session.id)?;
    ensure_preflight_queue_position(&ledger, &session.id)?;

    let main_branch = main_branch_from_config(&config_path)?;
    let main_before = git_repo
        .ref_commit(&options.repo_root, &main_branch_ref(&main_branch))?
        .commit_id;
    let created_at_ms = now_millis();
    let attempt_id = next_merge_attempt_id(created_at_ms);
    let sandbox_path = aichestra_dir.join("sandboxes").join(&attempt_id);
    let artifact_dir = aichestra_dir
        .join("artifacts")
        .join("merge-attempts")
        .join(&attempt_id);
    fs::create_dir_all(&artifact_dir)?;

    let attempt = MergeAttempt {
        id: attempt_id.clone(),
        session_id: session.id.clone(),
        status: MergeAttemptStatus::PreflightRunning,
        main_before_commit: main_before.clone(),
        candidate_commit: candidate_commit.clone(),
        apply_strategy: PREFLIGHT_APPLY_STRATEGY.to_string(),
        verified_tree_id: None,
        verified_commit_id: None,
        checks_passed: false,
        semantic_risk_level: None,
    };
    ledger.insert_merge_attempt(&attempt, created_at_ms, created_at_ms)?;
    ledger.append_event(
        &NewEvent::new(EventName::MergePreflightStarted)
            .with_subject("merge_attempt", attempt.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"main_before_commit\":\"{}\",\"candidate_commit\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&session.id),
                json_escape(&main_before),
                json_escape(&candidate_commit)
            )),
    )?;

    let check_commands = check_commands_from_config(&config_path)?;
    let outcome = match preflight_runner.run_preflight(&PreflightRequest {
        repo_path: options.repo_root.clone(),
        sandbox_path: sandbox_path.clone(),
        session_id: session.id.clone(),
        main_before_commit: main_before,
        candidate_commit,
        check_commands,
    }) {
        Ok(outcome) => outcome,
        Err(error) => {
            ledger.update_merge_attempt_result(MergeAttemptResultUpdate {
                id: &attempt.id,
                status: MergeAttemptStatus::Blocked,
                verified_tree_id: None,
                verified_commit_id: None,
                checks_passed: false,
                semantic_risk_level: None,
                updated_at_ms: now_millis(),
            })?;
            ledger.append_event(
                &NewEvent::new(EventName::MergeBlocked)
                    .with_subject("merge_attempt", attempt.id.clone())
                    .with_data_json(format!(
                        "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"reason\":\"preflight_error\",\"error\":\"{}\"}}",
                        json_escape(&operator.id),
                        json_escape(&session.id),
                        json_escape(&error.to_string())
                    )),
            )?;
            return Err(error.into());
        }
    };

    match outcome {
        PreflightOutcome::Verified(verified) => {
            let context = PreflightFinishContext {
                ledger: &ledger,
                attempt_id: &attempt.id,
                session_id: &session.id,
                operator: &operator,
                artifact_dir: &artifact_dir,
                repo_root: &options.repo_root,
                sandbox_path: &sandbox_path,
            };
            finish_verified_preflight(context, verified)
        }
        PreflightOutcome::Blocked(blocked) => {
            let context = PreflightFinishContext {
                ledger: &ledger,
                attempt_id: &attempt.id,
                session_id: &session.id,
                operator: &operator,
                artifact_dir: &artifact_dir,
                repo_root: &options.repo_root,
                sandbox_path: &sandbox_path,
            };
            finish_blocked_preflight(context, blocked)
        }
    }
}

fn next_merge_attempt_id(created_at_ms: i64) -> String {
    let counter = MERGE_ATTEMPT_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("merge-attempt-{created_at_ms}-{counter}")
}

fn ensure_preflight_queue_position(ledger: &Ledger, session_id: &str) -> Result<(), CliError> {
    let entries = queue_entries(ledger)?;

    if let Some(blocking) = entries.iter().find(|entry| {
        entry.session.id != session_id
            && matches!(
                entry.status.as_str(),
                "preflight_running" | "verified" | "approved"
            )
    }) {
        return Err(CliError::Usage(format!(
            "cannot preflight session '{}' while session '{}' is {}; finish it first with `{}`",
            session_id,
            blocking.session.id,
            blocking.status,
            queue_next_action(blocking)
        )));
    }

    let current_status = entries
        .iter()
        .find(|entry| entry.session.id == session_id)
        .map(|entry| entry.status.as_str());

    if matches!(current_status, Some("blocked" | "verified" | "approved")) {
        return Ok(());
    }

    if matches!(current_status, Some("preflight_running")) {
        return Err(CliError::Usage(format!(
            "session '{session_id}' already has a preflight in progress"
        )));
    }

    if !matches!(current_status, Some("enqueued")) {
        return Err(CliError::Usage(format!(
            "session '{session_id}' is not preflightable; run `aich queue` to inspect candidate state"
        )));
    }

    let Some(head) = entries
        .iter()
        .find(|entry| entry.status.as_str() == "enqueued")
    else {
        return Err(CliError::Usage(format!(
            "session '{session_id}' is not preflightable; run `aich queue` to inspect candidate state"
        )));
    };

    if head.session.id != session_id {
        return Err(CliError::Usage(format!(
            "session '{}' is not the queue head; preflight session '{}' first",
            session_id, head.session.id
        )));
    }

    Ok(())
}

struct PreflightFinishContext<'a> {
    ledger: &'a Ledger,
    attempt_id: &'a str,
    session_id: &'a str,
    operator: &'a Operator,
    artifact_dir: &'a Path,
    repo_root: &'a Path,
    sandbox_path: &'a Path,
}

fn finish_verified_preflight(
    context: PreflightFinishContext<'_>,
    verified: PreflightVerified,
) -> Result<PreflightRunResult, CliError> {
    let check_results = persist_preflight_checks(
        context.ledger,
        context.attempt_id,
        context.artifact_dir,
        context.repo_root,
        &verified.checks,
    )?;
    context
        .ledger
        .update_merge_attempt_result(MergeAttemptResultUpdate {
            id: context.attempt_id,
            status: MergeAttemptStatus::Verified,
            verified_tree_id: Some(&verified.verified_tree_id),
            verified_commit_id: Some(&verified.verified_commit_id),
            checks_passed: true,
            semantic_risk_level: None,
            updated_at_ms: now_millis(),
        })?;
    context.ledger.append_event(
        &NewEvent::new(EventName::MergeMechanicalCompleted)
            .with_subject("merge_attempt", context.attempt_id.to_string())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"status\":\"merged\",\"verified_tree_id\":\"{}\",\"verified_commit_id\":\"{}\"}}",
                json_escape(&context.operator.id),
                json_escape(context.session_id),
                json_escape(&verified.verified_tree_id),
                json_escape(&verified.verified_commit_id)
            )),
    )?;
    context.ledger.append_event(
        &NewEvent::new(EventName::CheckCompleted)
            .with_subject("merge_attempt", context.attempt_id.to_string())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"result\":\"passed\",\"check_count\":{}}}",
                json_escape(&context.operator.id),
                json_escape(context.session_id),
                check_results.len()
            )),
    )?;

    let merge_attempt = context
        .ledger
        .get_merge_attempt(context.attempt_id)?
        .ok_or_else(|| {
            CliError::Usage(format!(
                "merge attempt '{}' does not exist",
                context.attempt_id
            ))
        })?;
    Ok(PreflightRunResult {
        merge_attempt,
        operator: context.operator.clone(),
        sandbox_path: context.sandbox_path.to_path_buf(),
        check_results,
        blocked_reason: None,
    })
}

fn finish_blocked_preflight(
    context: PreflightFinishContext<'_>,
    blocked: PreflightBlocked,
) -> Result<PreflightRunResult, CliError> {
    fs::write(
        context.artifact_dir.join("merge.stdout"),
        &blocked.merge_stdout,
    )?;
    fs::write(
        context.artifact_dir.join("merge.stderr"),
        &blocked.merge_stderr,
    )?;
    if !blocked.conflict_files.is_empty() {
        fs::write(
            context.artifact_dir.join("conflicts.txt"),
            blocked.conflict_files.join("\n"),
        )?;
    }

    let check_results = persist_preflight_checks(
        context.ledger,
        context.attempt_id,
        context.artifact_dir,
        context.repo_root,
        &blocked.checks,
    )?;
    context
        .ledger
        .update_merge_attempt_result(MergeAttemptResultUpdate {
            id: context.attempt_id,
            status: MergeAttemptStatus::Blocked,
            verified_tree_id: blocked.verified_tree_id.as_deref(),
            verified_commit_id: blocked.verified_commit_id.as_deref(),
            checks_passed: false,
            semantic_risk_level: None,
            updated_at_ms: now_millis(),
        })?;
    context.ledger.append_event(
        &NewEvent::new(EventName::MergeMechanicalCompleted)
            .with_subject("merge_attempt", context.attempt_id.to_string())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"status\":\"blocked\",\"reason\":\"{}\",\"conflict_count\":{}}}",
                json_escape(&context.operator.id),
                json_escape(context.session_id),
                json_escape(&blocked.reason),
                blocked.conflict_files.len()
            )),
    )?;
    if !blocked.checks.is_empty() {
        context.ledger.append_event(
            &NewEvent::new(EventName::CheckCompleted)
                .with_subject("merge_attempt", context.attempt_id.to_string())
                .with_data_json(format!(
                    "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"result\":\"failed\",\"check_count\":{}}}",
                    json_escape(&context.operator.id),
                    json_escape(context.session_id),
                    blocked.checks.len()
                )),
        )?;
    }
    context.ledger.append_event(
        &NewEvent::new(EventName::MergeBlocked)
            .with_subject("merge_attempt", context.attempt_id.to_string())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"session_id\":\"{}\",\"reason\":\"{}\"}}",
                json_escape(&context.operator.id),
                json_escape(context.session_id),
                json_escape(&blocked.reason)
            )),
    )?;

    let merge_attempt = context
        .ledger
        .get_merge_attempt(context.attempt_id)?
        .ok_or_else(|| {
            CliError::Usage(format!(
                "merge attempt '{}' does not exist",
                context.attempt_id
            ))
        })?;
    Ok(PreflightRunResult {
        merge_attempt,
        operator: context.operator.clone(),
        sandbox_path: context.sandbox_path.to_path_buf(),
        check_results,
        blocked_reason: Some(blocked.reason),
    })
}
