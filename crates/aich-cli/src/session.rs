use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use aich_core::clock::now_millis;
use aich_core::{
    ChangeManifest, ChangedFile, ContextSnapshot, EventName, MergeAttempt, MergeAttemptStatus,
    NewEvent, PatchSet, Session, SessionStatus,
};
use aich_git::{
    CleanupSessionWorktreeRequest, CompleteSessionWorktreeOutcome, CompleteSessionWorktreeRequest,
    CreateWorktreeRequest, GitRepository, SessionWorktreeCleaner, SessionWorktreeCompleter,
    WorktreeManager,
};
use aich_ledger::Ledger;

use crate::cleanup_state::{cleaned_session_ids, session_is_cleaned};
use crate::config::{main_branch_from_config, main_branch_ref, session_branch_prefix_from_config};
use crate::formatting::{
    comparable_path, display_path_for_ledger, json_escape, path_from_ledger, sha256_hex,
};
use crate::manifest::{context_snapshot_hash, render_change_manifest};
use crate::options::{
    SessionAbandonOptions, SessionCleanupOptions, SessionCompleteOptions, SessionPruneOptions,
    SessionReopenOptions, SessionStartOptions,
};
use crate::queue::acquire_merge_queue_lock;
use crate::{
    latest_merge_attempt, ledger_path, open_existing_ledger, resolve_active_operator, CliError,
    SessionAbandonResult, SessionCleanupResult, SessionCompleteResult, SessionPruneResult,
    SessionReopenResult, SessionStartResult, CHANGE_MANIFEST_VALIDATION_STATUS,
};

static SESSION_COUNTER: AtomicU64 = AtomicU64::new(1);
static ARTIFACT_COUNTER: AtomicU64 = AtomicU64::new(1);

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
enum CleanupEligibility {
    Applied,
    Noop,
    FailedStart,
    Abandoned,
}

pub(crate) fn start_session_with<R, W>(
    options: &SessionStartOptions,
    git_repo: &R,
    worktree_manager: &W,
) -> Result<SessionStartResult, CliError>
where
    R: GitRepository,
    W: WorktreeManager,
{
    let aichestra_dir = options.repo_root.join(".aichestra");
    let config_path = aichestra_dir.join("config.yaml");
    if !config_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra config not found at {}; run `aich init` first",
            config_path.display()
        )));
    }

    fs::create_dir_all(aichestra_dir.join("worktrees"))?;
    let db_path = ledger_path(&options.repo_root, &options.db_path);
    let ledger = Ledger::open(&db_path)?;
    let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;
    let main_branch = main_branch_from_config(&config_path)?;
    let main_ref = main_branch_ref(&main_branch);
    let head = git_repo.ref_commit(&options.repo_root, &main_ref)?;
    let branch_prefix = session_branch_prefix_from_config(&config_path)?;
    let created_at_ms = now_millis();
    let session_id = next_session_id(created_at_ms);
    let branch = format!("{branch_prefix}/{session_id}");
    let worktree_path = aichestra_dir.join("worktrees").join(&session_id);

    let mut session = Session::new(
        session_id.clone(),
        options.goal.clone(),
        options.provider.clone(),
        branch.clone(),
        worktree_path.display().to_string(),
        head.commit_id.clone(),
        created_at_ms,
    );
    session.target_path = options.target_path.clone();

    let tx = ledger.begin_immediate_transaction()?;
    ledger.insert_session(&session)?;
    ledger.append_event(
        &NewEvent::new(EventName::SessionCreated)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\"}}",
                json_escape(&operator.id)
            )),
    )?;
    tx.commit()?;

    let request = CreateWorktreeRequest {
        repo_path: options.repo_root.clone(),
        main_worktree_path: options.repo_root.clone(),
        session_id: session.id.clone(),
        branch: branch.clone(),
        base_ref: head.commit_id.clone(),
        worktree_path,
    };

    if let Err(error) = worktree_manager.create_session_worktree(&request) {
        let _ = ledger.update_session_status(&session.id, SessionStatus::Blocked, now_millis());
        return Err(error.into());
    }

    session.status = SessionStatus::Running;
    session.updated_at_ms = now_millis();
    let tx = ledger.begin_immediate_transaction()?;
    ledger.update_session_status(&session.id, SessionStatus::Running, session.updated_at_ms)?;
    ledger.append_event(
        &NewEvent::new(EventName::WorktreeCreated)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"branch\":\"{}\",\"worktree_path\":\"{}\"}}",
                json_escape(&session.branch),
                json_escape(&session.worktree_path)
            )),
    )?;
    ledger.append_event(
        &NewEvent::new(EventName::SessionStarted)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\"}}",
                json_escape(&operator.id)
            )),
    )?;
    tx.commit()?;

    Ok(SessionStartResult { session, operator })
}

pub(crate) fn complete_session_with<C>(
    options: &SessionCompleteOptions,
    completer: &C,
) -> Result<SessionCompleteResult, CliError>
where
    C: SessionWorktreeCompleter,
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
    let mut session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;

    ensure_session_can_complete(&session)?;
    let worktree_path = PathBuf::from(&session.worktree_path);
    ensure_session_worktree_is_dedicated(&options.repo_root, &worktree_path)?;

    let outcome = completer.complete_session_worktree(&CompleteSessionWorktreeRequest {
        session_id: session.id.clone(),
        worktree_path,
        session_branch: session.branch.clone(),
        main_branch: main_branch_from_config(&config_path)?,
        base_commit: session.base_commit.clone(),
    })?;

    match outcome {
        CompleteSessionWorktreeOutcome::NoChanges { head_commit } => {
            let updated_at_ms = now_millis();
            let tx = ledger.begin_immediate_transaction()?;
            ledger.update_session_completion(
                &session.id,
                SessionStatus::Noop,
                Some(&head_commit),
                updated_at_ms,
            )?;
            session.status = SessionStatus::Noop;
            session.head_commit = Some(head_commit.clone());
            session.updated_at_ms = updated_at_ms;
            ledger.append_event(
                &NewEvent::new(EventName::SessionCompleted)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"operator_id\":\"{}\",\"status\":\"noop\",\"head_commit\":\"{}\",\"no_changes\":true}}",
                        json_escape(&operator.id),
                        json_escape(&head_commit)
                    )),
            )?;
            tx.commit()?;

            Ok(SessionCompleteResult {
                session,
                operator,
                patch_set: None,
                changed_files: Vec::new(),
                context_snapshot: None,
                change_manifest: None,
                manifest_path: None,
            })
        }
        CompleteSessionWorktreeOutcome::Changes(changes) => {
            let created_at_ms = now_millis();
            let artifact_id = next_artifact_id(created_at_ms);
            let artifact_dir = aichestra_dir
                .join("artifacts")
                .join("sessions")
                .join(&session.id)
                .join(&artifact_id);
            fs::create_dir_all(&artifact_dir)?;

            let diff_stat_path = artifact_dir.join("diff.stat");
            let diff_patch_path = artifact_dir.join("diff.patch");
            let manifest_path = artifact_dir.join("change-manifest.yaml");
            fs::write(&diff_stat_path, &changes.diff_stat)?;
            fs::write(&diff_patch_path, &changes.diff_patch)?;

            let changed_files: Vec<ChangedFile> = changes
                .changed_files
                .iter()
                .map(|file| ChangedFile {
                    path: file.path.clone(),
                    change_type: file.change_type.clone(),
                    symbols_json: file.symbols_json.clone(),
                })
                .collect();

            let patch_set = PatchSet {
                id: format!("patchset-{}-{artifact_id}", session.id),
                session_id: session.id.clone(),
                base_commit: session.base_commit.clone(),
                head_commit: Some(changes.head_commit.clone()),
                patch_id: Some(changes.head_commit.clone()),
                diff_stat: Some(changes.diff_stat.clone()),
                created_at_ms,
            };

            let context_snapshot = ContextSnapshot {
                id: format!("context-{}-{artifact_id}", session.id),
                session_id: Some(session.id.clone()),
                hash_algorithm: "sha256".to_string(),
                snapshot_hash: context_snapshot_hash(&options.repo_root)?,
                created_at_ms,
            };

            let manifest_content = render_change_manifest(
                &session,
                &patch_set,
                &changed_files,
                &context_snapshot,
                &diff_stat_path,
                &diff_patch_path,
                &options.repo_root,
            );
            fs::write(&manifest_path, &manifest_content)?;
            let manifest_hash = sha256_hex(manifest_content.as_bytes());
            let change_manifest = ChangeManifest {
                id: format!("manifest-{}-{artifact_id}", session.id),
                session_id: session.id.clone(),
                manifest_path: display_path_for_ledger(&options.repo_root, &manifest_path),
                manifest_hash: Some(manifest_hash),
                validation_status: CHANGE_MANIFEST_VALIDATION_STATUS.to_string(),
                created_at_ms,
            };

            let tx = ledger.begin_immediate_transaction()?;
            ledger.insert_patch_set(&patch_set, &changed_files)?;
            ledger.insert_context_snapshot(&context_snapshot)?;
            ledger.insert_change_manifest(&change_manifest)?;

            let updated_at_ms = now_millis();
            ledger.update_session_completion(
                &session.id,
                SessionStatus::Enqueued,
                Some(&changes.head_commit),
                updated_at_ms,
            )?;
            session.status = SessionStatus::Enqueued;
            session.head_commit = Some(changes.head_commit.clone());
            session.updated_at_ms = updated_at_ms;

            ledger.append_event(
                &NewEvent::new(EventName::FilesChanged)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"operator_id\":\"{}\",\"changed_file_count\":{}}}",
                        json_escape(&operator.id),
                        changed_files.len()
                    )),
            )?;
            ledger.append_event(
                &NewEvent::new(EventName::PatchsetCreated)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"operator_id\":\"{}\",\"patch_set_id\":\"{}\",\"head_commit\":\"{}\",\"committed_worktree_changes\":{}}}",
                        json_escape(&operator.id),
                        json_escape(&patch_set.id),
                        json_escape(&changes.head_commit),
                        changes.committed_worktree_changes
                    )),
            )?;
            ledger.append_event(
                &NewEvent::new(EventName::ContextSnapshotCreated)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"context_snapshot_id\":\"{}\",\"hash_algorithm\":\"sha256\"}}",
                        json_escape(&context_snapshot.id)
                    )),
            )?;
            ledger.append_event(
                &NewEvent::new(EventName::ManifestCreated)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"manifest_id\":\"{}\",\"manifest_path\":\"{}\"}}",
                        json_escape(&change_manifest.id),
                        json_escape(&change_manifest.manifest_path)
                    )),
            )?;
            ledger.append_event(
                &NewEvent::new(EventName::ManifestValidated)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"manifest_id\":\"{}\",\"validation_status\":\"{}\"}}",
                        json_escape(&change_manifest.id),
                        CHANGE_MANIFEST_VALIDATION_STATUS
                    )),
            )?;
            ledger.append_event(
                &NewEvent::new(EventName::SessionCompleted)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"operator_id\":\"{}\",\"status\":\"enqueued\",\"head_commit\":\"{}\",\"no_changes\":false}}",
                        json_escape(&operator.id),
                        json_escape(&changes.head_commit)
                    )),
            )?;
            tx.commit()?;

            Ok(SessionCompleteResult {
                session,
                operator,
                patch_set: Some(patch_set),
                changed_files,
                context_snapshot: Some(context_snapshot),
                change_manifest: Some(change_manifest),
                manifest_path: Some(manifest_path),
            })
        }
    }
}

pub(crate) fn cleanup_session_with<C>(
    options: &SessionCleanupOptions,
    cleaner: &C,
) -> Result<SessionCleanupResult, CliError>
where
    C: SessionWorktreeCleaner,
{
    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;
    cleanup_session_record(&options.repo_root, &ledger, session, cleaner)
}

pub(crate) fn abandon_session_with(
    options: &SessionAbandonOptions,
) -> Result<SessionAbandonResult, CliError> {
    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;
    let session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;
    if session_is_cleaned(&ledger, &session.id)? {
        return Err(CliError::Usage(format!(
            "session '{}' has already been cleaned and cannot be abandoned",
            session.id
        )));
    }
    let latest_attempt = latest_merge_attempt(&ledger, &session.id)?;
    ensure_session_can_abandon(&session, latest_attempt.as_ref())?;
    let _queue_lock = acquire_merge_queue_lock(&ledger, "abandon", &session.id)?;

    let previous_status = session.status.as_str().to_string();
    let updated_at_ms = now_millis();
    let tx = ledger.begin_immediate_transaction()?;
    ledger.update_session_status(&session.id, SessionStatus::Abandoned, updated_at_ms)?;
    ledger.append_event(
        &NewEvent::new(EventName::SessionAbandoned)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"previous_status\":\"{}\",\"merge_attempt_id\":{},\"merge_attempt_status\":{}}}",
                json_escape(&operator.id),
                json_escape(&previous_status),
                latest_attempt
                    .as_ref()
                    .map(|attempt| format!("\"{}\"", json_escape(&attempt.id)))
                    .unwrap_or_else(|| "null".to_string()),
                latest_attempt
                    .as_ref()
                    .map(|attempt| format!("\"{}\"", attempt.status.as_str()))
                    .unwrap_or_else(|| "null".to_string())
            )),
    )?;
    tx.commit()?;

    let session = ledger
        .get_session(&session.id)?
        .ok_or_else(|| CliError::Usage("abandoned session disappeared from ledger".to_string()))?;

    Ok(SessionAbandonResult {
        session,
        previous_status,
        latest_attempt,
        operator,
    })
}

pub(crate) fn reopen_session_with(
    options: &SessionReopenOptions,
) -> Result<SessionReopenResult, CliError> {
    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;
    let session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;
    if session_is_cleaned(&ledger, &session.id)? {
        return Err(CliError::Usage(format!(
            "session '{}' has already been cleaned and cannot be reopened",
            session.id
        )));
    }
    ensure_session_can_reopen(&session)?;

    let latest_attempt = latest_merge_attempt(&ledger, &session.id)?.ok_or_else(|| {
        CliError::Usage(format!(
            "session '{}' has no blocked merge attempt to reopen",
            session.id
        ))
    })?;
    if latest_attempt.status != MergeAttemptStatus::Blocked {
        return Err(CliError::Usage(format!(
            "session '{}' latest merge attempt '{}' is {}, not blocked",
            session.id,
            latest_attempt.id,
            latest_attempt.status.as_str()
        )));
    }
    if ledger.list_approvals(&latest_attempt.id)?.last().is_some() {
        return Err(CliError::Usage(format!(
            "merge attempt '{}' is already approved; create a new session for additional work",
            latest_attempt.id
        )));
    }

    let worktree_path = path_from_ledger(&options.repo_root, &session.worktree_path);
    ensure_session_worktree_is_dedicated(&options.repo_root, &worktree_path)?;
    if !worktree_path.is_dir() {
        return Err(CliError::Usage(format!(
            "session '{}' worktree does not exist at {}",
            session.id,
            worktree_path.display()
        )));
    }

    let previous_status = session.status.as_str().to_string();
    let updated_at_ms = now_millis();
    let tx = ledger.begin_immediate_transaction()?;
    ledger.update_session_status(&session.id, SessionStatus::Running, updated_at_ms)?;
    ledger.append_event(
        &NewEvent::new(EventName::SessionReopened)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"previous_status\":\"{}\",\"merge_attempt_id\":\"{}\",\"merge_attempt_status\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&previous_status),
                json_escape(&latest_attempt.id),
                latest_attempt.status.as_str()
            )),
    )?;
    tx.commit()?;

    let session = ledger
        .get_session(&session.id)?
        .ok_or_else(|| CliError::Usage("reopened session disappeared from ledger".to_string()))?;

    Ok(SessionReopenResult {
        session,
        previous_status,
        latest_attempt,
        operator,
    })
}

pub(crate) fn prune_sessions_with<C>(
    options: &SessionPruneOptions,
    cleaner: &C,
) -> Result<SessionPruneResult, CliError>
where
    C: SessionWorktreeCleaner,
{
    if !options.applied && !options.inactive {
        return Err(CliError::Usage(
            "session prune requires --applied or --inactive to avoid removing active session worktrees"
                .to_string(),
        ));
    }

    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let mut cleaned = Vec::new();
    let mut skipped = 0;
    let already_cleaned = cleaned_session_ids(&ledger)?;

    for session in ledger.list_sessions()? {
        if already_cleaned.contains(&session.id) {
            skipped += 1;
            continue;
        }

        let latest_attempt = latest_merge_attempt(&ledger, &session.id)?;
        let eligibility = cleanup_eligibility(&session, latest_attempt.as_ref());
        let should_clean = match eligibility {
            Ok(CleanupEligibility::Applied) => options.applied,
            Ok(
                CleanupEligibility::Noop
                | CleanupEligibility::FailedStart
                | CleanupEligibility::Abandoned,
            ) => options.inactive,
            Err(_) => false,
        };

        if should_clean {
            cleaned.push(cleanup_session_record(
                &options.repo_root,
                &ledger,
                session,
                cleaner,
            )?);
        } else {
            skipped += 1;
        }
    }

    Ok(SessionPruneResult { cleaned, skipped })
}

fn cleanup_session_record<C>(
    repo_root: &Path,
    ledger: &Ledger,
    session: Session,
    cleaner: &C,
) -> Result<SessionCleanupResult, CliError>
where
    C: SessionWorktreeCleaner,
{
    if session_is_cleaned(ledger, &session.id)? {
        return Err(CliError::Usage(format!(
            "session '{}' has already been cleaned; repeated cleanup is skipped to avoid deleting unrelated paths",
            session.id
        )));
    }

    let latest_attempt = latest_merge_attempt(ledger, &session.id)?;
    let eligibility = cleanup_eligibility(&session, latest_attempt.as_ref())?;

    let attempts = ledger.list_merge_attempts(&session.id)?;
    let sandbox_paths: Vec<PathBuf> = attempts
        .iter()
        .map(|attempt| {
            repo_root
                .join(".aichestra")
                .join("sandboxes")
                .join(&attempt.id)
        })
        .collect();
    let request = CleanupSessionWorktreeRequest {
        repo_path: repo_root.to_path_buf(),
        main_worktree_path: repo_root.to_path_buf(),
        session_id: session.id.clone(),
        branch: session.branch.clone(),
        worktree_path: path_from_ledger(repo_root, &session.worktree_path),
        sandbox_paths,
        force_branch_delete: eligibility == CleanupEligibility::Abandoned,
    };
    let cleanup = cleaner.cleanup_session_worktree(&request)?;

    ledger.append_event(
        &NewEvent::new(EventName::SessionCleaned)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"cleanup_kind\":\"{}\",\"merge_attempt_id\":{},\"session_worktree_removed\":{},\"branch_deleted\":{},\"sandbox_worktrees_removed\":{}}}",
                cleanup_kind_label(eligibility),
                latest_attempt
                    .as_ref()
                    .map(|attempt| format!("\"{}\"", json_escape(&attempt.id)))
                    .unwrap_or_else(|| "null".to_string()),
                cleanup.session_worktree_removed,
                cleanup.branch_deleted,
                cleanup.sandbox_worktrees_removed.len()
            )),
    )?;

    Ok(SessionCleanupResult {
        session,
        latest_attempt,
        cleanup,
    })
}

fn next_session_id(created_at_ms: i64) -> String {
    let counter = SESSION_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("session-{created_at_ms}-{counter}")
}

fn next_artifact_id(created_at_ms: i64) -> String {
    let counter = ARTIFACT_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{created_at_ms}-{counter}")
}

fn ensure_session_can_complete(session: &Session) -> Result<(), CliError> {
    match session.status {
        SessionStatus::Created | SessionStatus::Running => Ok(()),
        _ => Err(CliError::Usage(format!(
            "session '{}' cannot be completed from status '{}'",
            session.id,
            session.status.as_str()
        ))),
    }
}

pub(crate) fn ensure_session_can_preflight(session: &Session) -> Result<(), CliError> {
    if session.status != SessionStatus::Enqueued {
        return Err(CliError::Usage(format!(
            "session '{}' cannot be preflighted from status '{}'; run `aich session complete {}` first",
            session.id,
            session.status.as_str(),
            session.id
        )));
    }

    Ok(())
}

pub(crate) fn ensure_session_not_abandoned(
    session: &Session,
    action: &str,
) -> Result<(), CliError> {
    if session.status == SessionStatus::Abandoned {
        return Err(CliError::Usage(format!(
            "session '{}' is abandoned and cannot be {}; start a new session for further work",
            session.id, action
        )));
    }
    Ok(())
}

fn ensure_session_can_abandon(
    session: &Session,
    latest_attempt: Option<&MergeAttempt>,
) -> Result<(), CliError> {
    match session.status {
        SessionStatus::Completed => {
            return Err(CliError::Usage(format!(
                "session '{}' is completed and cannot be abandoned; use cleanup after apply",
                session.id
            )));
        }
        SessionStatus::Abandoned => {
            return Err(CliError::Usage(format!(
                "session '{}' is already abandoned",
                session.id
            )));
        }
        _ => {}
    }

    if let Some(attempt) = latest_attempt {
        match attempt.status {
            MergeAttemptStatus::Applied => {
                return Err(CliError::Usage(format!(
                    "session '{}' has already been applied and cannot be abandoned",
                    session.id
                )));
            }
            MergeAttemptStatus::Applying => {
                return Err(CliError::Usage(format!(
                    "session '{}' is currently applying and cannot be abandoned",
                    session.id
                )));
            }
            _ => {}
        }
    }

    Ok(())
}

fn ensure_session_can_reopen(session: &Session) -> Result<(), CliError> {
    match session.status {
        SessionStatus::Abandoned => Err(CliError::Usage(format!(
            "session '{}' is abandoned and cannot be reopened; start a new session for further work",
            session.id
        ))),
        SessionStatus::Completed => Err(CliError::Usage(format!(
            "session '{}' is completed and cannot be reopened",
            session.id
        ))),
        SessionStatus::Running => Err(CliError::Usage(format!(
            "session '{}' is already running",
            session.id
        ))),
        _ => Ok(()),
    }
}

fn cleanup_eligibility(
    session: &Session,
    latest_attempt: Option<&MergeAttempt>,
) -> Result<CleanupEligibility, CliError> {
    match session.status {
        SessionStatus::Completed
            if latest_attempt
                .map(|attempt| attempt.status == MergeAttemptStatus::Applied)
                .unwrap_or(false) =>
        {
            Ok(CleanupEligibility::Applied)
        }
        SessionStatus::Completed => Err(CliError::Usage(format!(
            "session '{}' cannot be cleaned because its latest merge attempt is not applied",
            session.id
        ))),
        SessionStatus::Noop if latest_attempt.is_none() => Ok(CleanupEligibility::Noop),
        SessionStatus::Noop => Err(CliError::Usage(format!(
            "session '{}' is noop but has merge attempts; refusing cleanup",
            session.id
        ))),
        SessionStatus::Blocked if latest_attempt.is_none() && session.head_commit.is_none() => {
            Ok(CleanupEligibility::FailedStart)
        }
        SessionStatus::Blocked => Err(CliError::Usage(format!(
            "session '{}' is blocked with candidate or merge state; keep it for recovery instead of cleanup",
            session.id
        ))),
        SessionStatus::Abandoned => Ok(CleanupEligibility::Abandoned),
        _ => Err(CliError::Usage(format!(
            "session '{}' cannot be cleaned from status '{}'; cleanup is allowed only for applied, noop, failed-start, or abandoned sessions",
            session.id,
            session.status.as_str()
        ))),
    }
}

fn cleanup_kind_label(eligibility: CleanupEligibility) -> &'static str {
    match eligibility {
        CleanupEligibility::Applied => "applied",
        CleanupEligibility::Noop => "noop",
        CleanupEligibility::FailedStart => "failed_start",
        CleanupEligibility::Abandoned => "abandoned",
    }
}

pub(crate) fn ensure_session_worktree_is_dedicated(
    repo_root: &Path,
    worktree_path: &Path,
) -> Result<(), CliError> {
    if comparable_path(repo_root) == comparable_path(worktree_path) {
        return Err(CliError::Usage(
            "session worktree must not be the main worktree".to_string(),
        ));
    }

    Ok(())
}
