use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};

use aich_core::clock::now_millis;
use aich_core::{
    Approval, CheckResult, CheckResultStatus, EventName, MergeAttempt, MergeAttemptStatus,
    NewEvent, QueueLock, SemanticReview, SemanticRiskLevel, Session, SessionStatus,
};
use aich_ledger::{EventRecord, Ledger};

use crate::formatting::{json_escape, json_string_field, short_hash};
use crate::options::{QueueOptions, QueueUnlockOptions};
use crate::{
    ledger_path, CliError, QueueUnlockResult, MERGE_QUEUE_LOCK_NAME, MILLIS_PER_SECOND,
    QUEUE_LOCK_STALE_AFTER_MS,
};

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct QueueEntry {
    pub(crate) session: Session,
    pub(crate) status: String,
    pub(crate) latest_attempt: Option<MergeAttempt>,
    pub(crate) latest_approval: Option<Approval>,
    pub(crate) latest_review: Option<SemanticReview>,
    pub(crate) check_results: Vec<CheckResult>,
    pub(crate) blocked_recovery: Option<BlockedRecovery>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub(crate) struct BlockedRecovery {
    pub(crate) reason: String,
    pub(crate) summary: String,
    pub(crate) artifacts: Vec<String>,
    pub(crate) next_steps: Vec<String>,
}

pub(crate) fn render_queue<W: Write>(options: &QueueOptions, out: &mut W) -> Result<(), CliError> {
    let db_path = ledger_path(&options.repo_root, &options.db_path);
    if !db_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra ledger not found at {}; run `aich init` first",
            db_path.display()
        )));
    }

    let ledger = Ledger::open(&db_path)?;
    let entries = queue_entries(&ledger)?;
    let summary = queue_status_summary(&entries);
    let queue_lock = ledger.get_queue_lock(MERGE_QUEUE_LOCK_NAME)?;
    let now = now_millis();

    writeln!(out, "Aichestra queue")?;
    writeln!(out, "Repo: {}", options.repo_root.display())?;
    writeln!(out, "Ledger: {}", db_path.display())?;
    match queue_lock.as_ref() {
        Some(lock) => {
            writeln!(
                out,
                "Lock: held by {} ({}, session {})",
                lock.holder_id,
                lock.operation,
                lock.session_id.as_deref().unwrap_or("-")
            )?;
            let age_ms = queue_lock_age_ms(lock, now);
            writeln!(out, "Lock age: {}", format_duration_ms(age_ms))?;
            writeln!(
                out,
                "Lock stale: {}",
                if is_queue_lock_stale(lock, now) {
                    "yes"
                } else {
                    "no"
                }
            )?;
        }
        None => writeln!(out, "Lock: free")?,
    }
    writeln!(out, "Entries: {}", entries.len())?;
    writeln!(
        out,
        "Summary: enqueued={} preflight_running={} applying={} verified={} approved={} blocked={}",
        summary.enqueued,
        summary.preflight_running,
        summary.applying,
        summary.verified,
        summary.approved,
        summary.blocked
    )?;

    if entries.is_empty() {
        writeln!(out, "No queued candidates.")?;
        return Ok(());
    }

    for entry in entries {
        writeln!(out, "- {} [{}]", entry.session.id, entry.status)?;
        writeln!(out, "  goal: {}", entry.session.goal)?;
        writeln!(out, "  branch: {}", entry.session.branch)?;
        writeln!(
            out,
            "  target: {}",
            entry.session.target_path.as_deref().unwrap_or("-")
        )?;
        writeln!(
            out,
            "  candidate: {}",
            entry
                .session
                .head_commit
                .as_deref()
                .map(short_hash)
                .unwrap_or_else(|| "-".to_string())
        )?;
        if let Some(attempt) = entry.latest_attempt.as_ref() {
            writeln!(out, "  attempt: {}", attempt.id)?;
            writeln!(
                out,
                "  main_before: {}",
                short_hash(&attempt.main_before_commit)
            )?;
            if let Some(commit) = attempt.verified_commit_id.as_deref() {
                writeln!(out, "  verified_commit: {}", short_hash(commit))?;
            }
            if let Some(tree) = attempt.verified_tree_id.as_deref() {
                writeln!(out, "  verified_tree: {}", short_hash(tree))?;
            }
            writeln!(
                out,
                "  semantic_risk: {}",
                attempt.semantic_risk_level.as_deref().unwrap_or("unknown")
            )?;
            writeln!(
                out,
                "  checks: {}",
                queue_check_label(attempt, &entry.check_results)
            )?;
        }
        if let Some(review) = entry.latest_review.as_ref() {
            writeln!(
                out,
                "  review: {} ({})",
                review.id,
                review.risk_level.as_str()
            )?;
        }
        if let Some(approval) = entry.latest_approval.as_ref() {
            writeln!(
                out,
                "  approval: {} by {}",
                approval.id, approval.approved_by
            )?;
        }
        if let Some(recovery) = entry.blocked_recovery.as_ref() {
            writeln!(out, "  blocked_reason: {}", recovery.reason)?;
            writeln!(out, "  recovery: {}", recovery.summary)?;
            if !recovery.artifacts.is_empty() {
                writeln!(out, "  artifacts:")?;
                for artifact in &recovery.artifacts {
                    writeln!(out, "    - {artifact}")?;
                }
            }
            if !recovery.next_steps.is_empty() {
                writeln!(out, "  next_steps:")?;
                for step in &recovery.next_steps {
                    writeln!(out, "    - {step}")?;
                }
            }
        }
        writeln!(out, "  next: {}", queue_next_action(&entry))?;
    }

    Ok(())
}

pub(crate) fn run_queue_unlock(
    options: &QueueUnlockOptions,
) -> Result<QueueUnlockResult, CliError> {
    let db_path = ledger_path(&options.repo_root, &options.db_path);
    if !db_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra ledger not found at {}; run `aich init` first",
            db_path.display()
        )));
    }

    let ledger = Ledger::open(&db_path)?;
    let now = now_millis();
    let Some(lock) = ledger.get_queue_lock(MERGE_QUEUE_LOCK_NAME)? else {
        return Ok(QueueUnlockResult {
            released_lock: None,
            stale: false,
            age_ms: None,
        });
    };

    let age_ms = queue_lock_age_ms(&lock, now);
    let stale = is_queue_lock_stale(&lock, now);
    let tx = ledger.begin_immediate_transaction()?;
    let released = ledger.release_queue_lock(&lock.name, &lock.holder_id)?;
    if !released {
        return Err(CliError::Usage(
            "queue lock changed while unlocking; run `aich queue` and retry if needed".to_string(),
        ));
    }

    ledger.append_event(
        &NewEvent::new(EventName::MergeQueueUnlocked)
            .with_subject("queue_lock", lock.name.clone())
            .with_data_json(format!(
                "{{\"holder_id\":\"{}\",\"operation\":\"{}\",\"session_id\":\"{}\",\"force\":{},\"stale\":{},\"age_ms\":{},\"reason\":\"{}\"}}",
                json_escape(&lock.holder_id),
                json_escape(&lock.operation),
                json_escape(lock.session_id.as_deref().unwrap_or("")),
                options.force,
                stale,
                age_ms,
                json_escape(options.reason.as_deref().unwrap_or(""))
            )),
    )?;
    tx.commit()?;

    Ok(QueueUnlockResult {
        released_lock: Some(lock),
        stale,
        age_ms: Some(age_ms),
    })
}

pub(crate) fn queue_lock_age_ms(lock: &QueueLock, now_ms: i64) -> i64 {
    now_ms.saturating_sub(lock.acquired_at_ms)
}

pub(crate) fn is_queue_lock_stale(lock: &QueueLock, now_ms: i64) -> bool {
    queue_lock_age_ms(lock, now_ms) >= QUEUE_LOCK_STALE_AFTER_MS
}

pub(crate) fn format_duration_ms(ms: i64) -> String {
    let seconds = ms.max(0) / MILLIS_PER_SECOND;
    if seconds < 60 {
        format!("{seconds}s")
    } else if seconds < 60 * 60 {
        format!("{}m {}s", seconds / 60, seconds % 60)
    } else {
        format!("{}h {}m", seconds / 3600, (seconds % 3600) / 60)
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
struct QueueStatusSummary {
    enqueued: usize,
    preflight_running: usize,
    applying: usize,
    verified: usize,
    approved: usize,
    blocked: usize,
}

pub(crate) fn queue_entries(ledger: &Ledger) -> Result<Vec<QueueEntry>, CliError> {
    let mut entries = Vec::new();
    let events = ledger.list_events()?;

    for session in ledger.list_sessions()? {
        let attempts = ledger.list_merge_attempts(&session.id)?;
        let latest_attempt = attempts.into_iter().last();
        let mut latest_approval = None;
        let mut latest_review = None;
        let mut check_results = Vec::new();

        if let Some(attempt) = latest_attempt.as_ref() {
            latest_approval = ledger.list_approvals(&attempt.id)?.into_iter().last();
            latest_review = ledger
                .list_semantic_reviews(&attempt.id)?
                .into_iter()
                .last();
            check_results = ledger.list_check_results(&attempt.id)?;
        }

        let Some(status) =
            queue_entry_status(&session, latest_attempt.as_ref(), latest_approval.as_ref())
        else {
            continue;
        };
        let blocked_recovery = latest_attempt.as_ref().and_then(|attempt| {
            blocked_recovery_for_queue_entry(
                &session,
                attempt,
                latest_review.as_ref(),
                &check_results,
                &events,
            )
        });

        entries.push(QueueEntry {
            session,
            status,
            latest_attempt,
            latest_approval,
            latest_review,
            check_results,
            blocked_recovery,
        });
    }

    Ok(entries)
}

fn queue_entry_status(
    session: &Session,
    latest_attempt: Option<&MergeAttempt>,
    latest_approval: Option<&Approval>,
) -> Option<String> {
    if session.status == SessionStatus::Abandoned {
        return None;
    }

    match latest_attempt {
        Some(attempt) => match attempt.status {
            MergeAttemptStatus::PreflightRunning => Some("preflight_running".to_string()),
            MergeAttemptStatus::Applying => Some("applying".to_string()),
            MergeAttemptStatus::Blocked => Some("blocked".to_string()),
            MergeAttemptStatus::Verified if latest_approval.is_some() => {
                Some("approved".to_string())
            }
            MergeAttemptStatus::Verified => Some("verified".to_string()),
            MergeAttemptStatus::Pending if session.status == SessionStatus::Enqueued => {
                Some("enqueued".to_string())
            }
            MergeAttemptStatus::Applied => None,
            MergeAttemptStatus::Pending => None,
        },
        None if session.status == SessionStatus::Enqueued => Some("enqueued".to_string()),
        None => None,
    }
}

fn queue_status_summary(entries: &[QueueEntry]) -> QueueStatusSummary {
    let mut summary = QueueStatusSummary::default();
    for entry in entries {
        match entry.status.as_str() {
            "enqueued" => summary.enqueued += 1,
            "preflight_running" => summary.preflight_running += 1,
            "applying" => summary.applying += 1,
            "verified" => summary.verified += 1,
            "approved" => summary.approved += 1,
            "blocked" => summary.blocked += 1,
            _ => {}
        }
    }
    summary
}

fn queue_check_label(attempt: &MergeAttempt, checks: &[CheckResult]) -> String {
    if checks.is_empty() {
        "none".to_string()
    } else {
        let required_total = checks.iter().filter(|check| check.required).count();
        let required_failed = checks
            .iter()
            .filter(|check| check.required && check.result == CheckResultStatus::Failed)
            .count();
        let optional_failed = checks
            .iter()
            .filter(|check| !check.required && check.result == CheckResultStatus::Failed)
            .count();
        let timed_out = checks.iter().filter(|check| check.timed_out).count();
        let mut parts = Vec::new();

        if required_total > 0 {
            parts.push(format!(
                "{}/{} required passed",
                required_total.saturating_sub(required_failed),
                required_total
            ));
        } else {
            parts.push("no required checks".to_string());
        }
        if optional_failed > 0 {
            parts.push(format!("{optional_failed} optional failed"));
        }
        if timed_out > 0 {
            parts.push(format!("{timed_out} timed out"));
        }
        if !attempt.checks_passed {
            parts.push("gate failed".to_string());
        }

        parts.join(", ")
    }
}

fn blocked_recovery_for_queue_entry(
    session: &Session,
    attempt: &MergeAttempt,
    latest_review: Option<&SemanticReview>,
    check_results: &[CheckResult],
    events: &[EventRecord],
) -> Option<BlockedRecovery> {
    if attempt.status != MergeAttemptStatus::Blocked {
        return None;
    }

    let reason = latest_blocked_reason(attempt, events)
        .unwrap_or_else(|| infer_blocked_reason(attempt, latest_review, check_results));
    let failed_checks: Vec<&CheckResult> = check_results
        .iter()
        .filter(|check| check.required && check.result == CheckResultStatus::Failed)
        .collect();
    let mut artifacts = Vec::new();
    let mut next_steps = vec![
        format!(
            "Fix the candidate in its session worktree: {}",
            session.worktree_path
        ),
        format!("Run `aich session complete {}` after the fix", session.id),
        format!(
            "Run `aich preflight {}` to create a new verified attempt",
            session.id
        ),
    ];

    let summary = match reason.as_str() {
        "mechanical_conflict" => {
            artifacts.push(merge_attempt_artifact(&attempt.id, "conflicts.txt"));
            artifacts.push(merge_attempt_artifact(&attempt.id, "merge.stderr"));
            artifacts.push(merge_attempt_artifact(&attempt.id, "merge.stdout"));
            "Git could not mechanically merge the candidate into latest main.".to_string()
        }
        "checks_failed" => {
            for check in &failed_checks {
                if let Some(stderr) = check.stderr_artifact.as_deref() {
                    artifacts.push(format!("{} stderr: {stderr}", check.name));
                }
                if let Some(stdout) = check.stdout_artifact.as_deref() {
                    artifacts.push(format!("{} stdout: {stdout}", check.name));
                }
            }
            if failed_checks.is_empty() {
                "Sandbox checks failed; inspect the merge-attempt artifacts.".to_string()
            } else {
                format!(
                    "Sandbox check(s) failed: {}.",
                    failed_checks
                        .iter()
                        .map(|check| check.name.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                )
            }
        }
        "semantic_review" => {
            if let Some(review) = latest_review {
                if let Some(report_path) = review.report_path.as_deref() {
                    artifacts.push(format!("semantic review: {report_path}"));
                }
            }
            next_steps.insert(
                0,
                "Read the semantic review report and address the required actions".to_string(),
            );
            "Semantic review found blocker-level risk.".to_string()
        }
        "applied_tree_mismatch" => {
            artifacts.push(merge_attempt_artifact(&attempt.id, "merge.stdout"));
            artifacts.push(merge_attempt_artifact(&attempt.id, "merge.stderr"));
            "The applied commit/tree did not match the approved verified candidate.".to_string()
        }
        "preflight_error" => {
            artifacts.push(merge_attempt_artifact(&attempt.id, "merge.stderr"));
            artifacts.push(merge_attempt_artifact(&attempt.id, "merge.stdout"));
            "Preflight failed before a verified candidate could be produced.".to_string()
        }
        _ => {
            artifacts.push(merge_attempt_artifact(&attempt.id, "merge.stderr"));
            artifacts.push(merge_attempt_artifact(&attempt.id, "merge.stdout"));
            "The merge attempt is blocked; inspect the recorded artifacts and event log."
                .to_string()
        }
    };

    artifacts.sort();
    artifacts.dedup();

    Some(BlockedRecovery {
        reason,
        summary,
        artifacts,
        next_steps,
    })
}

fn latest_blocked_reason(attempt: &MergeAttempt, events: &[EventRecord]) -> Option<String> {
    events
        .iter()
        .rev()
        .find(|event| {
            event.name == EventName::MergeBlocked.as_str()
                && event.subject_type.as_deref() == Some("merge_attempt")
                && event.subject_id.as_deref() == Some(attempt.id.as_str())
        })
        .and_then(|event| json_string_field(&event.data_json, "reason"))
        .filter(|reason| !reason.trim().is_empty())
}

fn infer_blocked_reason(
    attempt: &MergeAttempt,
    latest_review: Option<&SemanticReview>,
    check_results: &[CheckResult],
) -> String {
    if latest_review
        .map(|review| review.risk_level == SemanticRiskLevel::Blocked)
        .unwrap_or(false)
    {
        "semantic_review".to_string()
    } else if check_results
        .iter()
        .any(|check| check.required && check.result == CheckResultStatus::Failed)
    {
        "checks_failed".to_string()
    } else if attempt.verified_commit_id.is_none() || attempt.verified_tree_id.is_none() {
        "mechanical_conflict".to_string()
    } else {
        "unknown".to_string()
    }
}

fn merge_attempt_artifact(attempt_id: &str, artifact_name: &str) -> String {
    format!(".aichestra/artifacts/merge-attempts/{attempt_id}/{artifact_name}")
}

pub(crate) fn queue_next_action(entry: &QueueEntry) -> String {
    match entry.status.as_str() {
        "enqueued" => format!("aich preflight {}", entry.session.id),
        "preflight_running" => "wait for preflight to finish or inspect artifacts".to_string(),
        "applying" => format!(
            "aich apply {} (retry or finalize interrupted apply; unlock a stale queue lock first if needed)",
            entry.session.id
        ),
        "verified" if entry.latest_review.is_some() => format!("aich approve {}", entry.session.id),
        "verified" => format!("aich review {}", entry.session.id),
        "approved" => format!("aich apply {}", entry.session.id),
        "blocked" => format!(
            "follow recovery steps, then run aich session complete {}, then aich preflight {}",
            entry.session.id, entry.session.id
        ),
        _ => "-".to_string(),
    }
}

static QUEUE_LOCK_COUNTER: AtomicU64 = AtomicU64::new(1);

fn next_queue_lock_holder_id(acquired_at_ms: i64) -> String {
    let counter = QUEUE_LOCK_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("queue-lock-{acquired_at_ms}-{counter}")
}

pub(crate) struct QueueLockGuard<'a> {
    ledger: &'a Ledger,
    lock: QueueLock,
}

impl Drop for QueueLockGuard<'_> {
    fn drop(&mut self) {
        let _ = self
            .ledger
            .release_queue_lock(&self.lock.name, &self.lock.holder_id);
    }
}

pub(crate) fn acquire_merge_queue_lock<'a>(
    ledger: &'a Ledger,
    operation: &str,
    session_id: &str,
) -> Result<QueueLockGuard<'a>, CliError> {
    let acquired_at_ms = now_millis();
    let lock = QueueLock {
        name: MERGE_QUEUE_LOCK_NAME.to_string(),
        holder_id: next_queue_lock_holder_id(acquired_at_ms),
        operation: operation.to_string(),
        session_id: Some(session_id.to_string()),
        acquired_at_ms,
    };

    if ledger.try_acquire_queue_lock(&lock)? {
        return Ok(QueueLockGuard { ledger, lock });
    }

    let held_by = match ledger.get_queue_lock(MERGE_QUEUE_LOCK_NAME)? {
        Some(existing) => format!(
            " by {} for {}{}",
            existing.holder_id,
            existing.operation,
            existing
                .session_id
                .as_deref()
                .map(|id| format!(" on session {id}"))
                .unwrap_or_default()
        ),
        None => String::new(),
    };

    Err(CliError::Usage(format!(
        "merge queue is locked{held_by}; run `aich queue` to inspect the active lock"
    )))
}
