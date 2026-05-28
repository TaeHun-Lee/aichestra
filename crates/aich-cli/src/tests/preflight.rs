use super::*;

#[test]
fn preflight_records_verified_attempt_and_check_artifacts() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");

    let start_options = SessionStartOptions {
        repo_root: repo.clone(),
        db_path: None,
        goal: "verify candidate".to_string(),
        provider: "codex".to_string(),
        target_path: Some("src/lib.rs".to_string()),
        operator_id: None,
    };
    let git = MockGitRepository;
    let worktrees = MockWorktreeManager::new();
    let session = start_session_with(&start_options, &git, &worktrees)
        .expect("start session")
        .session;

    let complete_options = SessionCompleteOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    };
    let completer = MockSessionCompleter::new(CompleteSessionWorktreeOutcome::Changes(
        aich_git::CompletedSessionWorktree {
            head_commit: "head-commit".to_string(),
            diff_stat: " src/lib.rs | 1 +\n 1 file changed, 1 insertion(+)\n".to_string(),
            diff_patch: "diff --git a/src/lib.rs b/src/lib.rs\n".to_string(),
            changed_files: vec![aich_git::GitChangedFile {
                path: "src/lib.rs".to_string(),
                change_type: "modified".to_string(),
                symbols_json: "[]".to_string(),
            }],
            committed_worktree_changes: true,
        },
    ));
    complete_session_with(&complete_options, &completer).expect("complete session");

    let preflight_options = PreflightOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    };
    let preflight_runner =
        MockPreflightRunner::new(PreflightOutcome::Verified(aich_git::PreflightVerified {
            verified_tree_id: "verified-tree".to_string(),
            verified_commit_id: "verified-commit".to_string(),
            checks: vec![PreflightCheckOutput {
                name: "test".to_string(),
                command: "cargo test --all".to_string(),
                required: true,
                timed_out: false,
                passed: true,
                code: Some(0),
                stdout: "ok\n".to_string(),
                stderr: String::new(),
            }],
        }));

    let result =
        run_preflight_with(&preflight_options, &git, &preflight_runner).expect("preflight");

    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Verified);
    assert_eq!(
        result.merge_attempt.verified_tree_id.as_deref(),
        Some("verified-tree")
    );
    assert_eq!(
        result.merge_attempt.verified_commit_id.as_deref(),
        Some("verified-commit")
    );
    assert!(result.merge_attempt.checks_passed);
    let expected_check_policy_fingerprint = current_check_policy_fingerprint(&repo);
    assert_eq!(
        result.merge_attempt.check_policy_fingerprint.as_deref(),
        Some(expected_check_policy_fingerprint.as_str())
    );
    assert_eq!(result.check_results.len(), 1);
    assert_eq!(result.check_results[0].result, CheckResultStatus::Passed);
    assert!(result.check_results[0]
        .stdout_artifact
        .as_deref()
        .expect("stdout artifact")
        .contains(".aichestra/artifacts/merge-attempts"));

    let requests = preflight_runner.requests.borrow();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].session_id, session.id);
    assert_eq!(requests[0].main_before_commit, "base-commit");
    assert_eq!(requests[0].candidate_commit, "head-commit");
    assert_eq!(requests[0].check_commands.len(), 3);

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert_eq!(
        ledger
            .list_merge_attempts(&session.id)
            .expect("merge attempts")
            .len(),
        1
    );
    assert_eq!(
        ledger
            .list_check_results(&result.merge_attempt.id)
            .expect("check results")
            .len(),
        1
    );
    assert_eq!(
        ledger
            .get_queue_lock(MERGE_QUEUE_LOCK_NAME)
            .expect("queue lock"),
        None
    );
    let event_names: Vec<String> = ledger
        .list_events()
        .expect("events")
        .into_iter()
        .map(|event| event.name)
        .collect();
    assert!(event_names.contains(&"merge.preflight.started".to_string()));
    assert!(event_names.contains(&"merge.mechanical.completed".to_string()));
    assert!(event_names.contains(&"check.completed".to_string()));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn preflight_refuses_when_queue_lock_is_held() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let session = seed_enqueued_candidate(&repo, "session-lock");
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger
        .try_acquire_queue_lock(&QueueLock {
            name: MERGE_QUEUE_LOCK_NAME.to_string(),
            holder_id: "holder-1".to_string(),
            operation: "apply".to_string(),
            session_id: Some("other-session".to_string()),
            acquired_at_ms: now_millis(),
        })
        .expect("acquire lock"));

    let preflight_runner =
        MockPreflightRunner::new(PreflightOutcome::Verified(aich_git::PreflightVerified {
            verified_tree_id: "verified-tree".to_string(),
            verified_commit_id: "verified-commit".to_string(),
            checks: Vec::new(),
        }));

    let err = run_preflight_with(
        &PreflightOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &preflight_runner,
    )
    .unwrap_err();

    assert!(matches!(err, CliError::Usage(message) if message.contains("merge queue is locked")));
    assert!(preflight_runner.requests.borrow().is_empty());
    assert!(ledger
        .get_queue_lock(MERGE_QUEUE_LOCK_NAME)
        .expect("queue lock")
        .is_some());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn preflight_requires_queue_head() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let head = seed_enqueued_candidate(&repo, "session-a");
    let later = seed_enqueued_candidate(&repo, "session-b");
    let preflight_runner =
        MockPreflightRunner::new(PreflightOutcome::Verified(aich_git::PreflightVerified {
            verified_tree_id: "verified-tree".to_string(),
            verified_commit_id: "verified-commit".to_string(),
            checks: Vec::new(),
        }));

    let err = run_preflight_with(
        &PreflightOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: later.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &preflight_runner,
    )
    .unwrap_err();

    assert!(
        matches!(err, CliError::Usage(message) if message.contains("queue head") && message.contains(&format!("aich preflight {}", head.id)) && message.contains("aich queue"))
    );
    assert!(preflight_runner.requests.borrow().is_empty());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn preflight_refuses_while_verified_candidate_is_pending() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    insert_queue_candidate(
        &repo,
        &ledger,
        "session-verified",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Verified),
        false,
    );
    let later = seed_enqueued_candidate(&repo, "session-later");
    let preflight_runner =
        MockPreflightRunner::new(PreflightOutcome::Verified(aich_git::PreflightVerified {
            verified_tree_id: "verified-tree".to_string(),
            verified_commit_id: "verified-commit".to_string(),
            checks: Vec::new(),
        }));

    let err = run_preflight_with(
        &PreflightOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: later.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &preflight_runner,
    )
    .unwrap_err();

    assert!(
        matches!(err, CliError::Usage(message) if message.contains("session-verified") && message.contains("verified") && message.contains("then re-run"))
    );
    assert!(preflight_runner.requests.borrow().is_empty());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn preflight_allows_refreshing_same_verified_candidate() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let session = seed_enqueued_candidate(&repo, "session-refresh");
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    ledger
        .insert_merge_attempt(
            &MergeAttempt {
                id: "merge-refresh".to_string(),
                session_id: session.id.clone(),
                status: MergeAttemptStatus::Verified,
                main_before_commit: "old-main".to_string(),
                candidate_commit: "head-commit".to_string(),
                apply_strategy: PREFLIGHT_APPLY_STRATEGY.to_string(),
                check_policy_fingerprint: Some(current_check_policy_fingerprint(&repo)),
                verified_tree_id: Some("old-tree".to_string()),
                verified_commit_id: Some("old-commit".to_string()),
                checks_passed: true,
                semantic_risk_level: Some("medium".to_string()),
            },
            now_millis(),
            now_millis(),
        )
        .expect("insert verified attempt");
    let preflight_runner =
        MockPreflightRunner::new(PreflightOutcome::Verified(aich_git::PreflightVerified {
            verified_tree_id: "new-tree".to_string(),
            verified_commit_id: "new-commit".to_string(),
            checks: Vec::new(),
        }));

    let result = run_preflight_with(
        &PreflightOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &preflight_runner,
    )
    .expect("preflight");

    assert_eq!(
        result.merge_attempt.verified_tree_id.as_deref(),
        Some("new-tree")
    );
    assert_eq!(preflight_runner.requests.borrow().len(), 1);

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn preflight_reads_main_before_from_configured_main_ref() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    configure_main_branch(&repo, "trunk");

    let start_options = SessionStartOptions {
        repo_root: repo.clone(),
        db_path: None,
        goal: "verify trunk candidate".to_string(),
        provider: "codex".to_string(),
        target_path: None,
        operator_id: None,
    };
    let git = RecordingGitRepository::new("trunk-base");
    let worktrees = MockWorktreeManager::new();
    let session = start_session_with(&start_options, &git, &worktrees)
        .expect("start session")
        .session;
    let completer = MockSessionCompleter::new(CompleteSessionWorktreeOutcome::Changes(
        aich_git::CompletedSessionWorktree {
            head_commit: "head-commit".to_string(),
            diff_stat: " README.md | 1 +\n".to_string(),
            diff_patch: "diff --git a/README.md b/README.md\n".to_string(),
            changed_files: vec![aich_git::GitChangedFile {
                path: "README.md".to_string(),
                change_type: "modified".to_string(),
                symbols_json: "[]".to_string(),
            }],
            committed_worktree_changes: true,
        },
    ));
    complete_session_with(
        &SessionCompleteOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &completer,
    )
    .expect("complete session");

    let preflight_runner =
        MockPreflightRunner::new(PreflightOutcome::Verified(aich_git::PreflightVerified {
            verified_tree_id: "verified-tree".to_string(),
            verified_commit_id: "verified-commit".to_string(),
            checks: Vec::new(),
        }));
    let result = run_preflight_with(
        &PreflightOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &git,
        &preflight_runner,
    )
    .expect("preflight");

    assert_eq!(result.merge_attempt.main_before_commit, "trunk-base");
    assert_eq!(
        preflight_runner.requests.borrow()[0].main_before_commit,
        "trunk-base"
    );
    assert_eq!(
        git.refs.borrow().as_slice(),
        &[
            "refs/heads/trunk".to_string(),
            "refs/heads/trunk".to_string()
        ]
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn preflight_records_blocked_attempt_when_checks_fail() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");

    let start_options = SessionStartOptions {
        repo_root: repo.clone(),
        db_path: None,
        goal: "block candidate".to_string(),
        provider: "codex".to_string(),
        target_path: None,
        operator_id: None,
    };
    let git = MockGitRepository;
    let worktrees = MockWorktreeManager::new();
    let session = start_session_with(&start_options, &git, &worktrees)
        .expect("start session")
        .session;

    let complete_options = SessionCompleteOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    };
    let completer = MockSessionCompleter::new(CompleteSessionWorktreeOutcome::Changes(
        aich_git::CompletedSessionWorktree {
            head_commit: "head-commit".to_string(),
            diff_stat: " README.md | 1 +\n".to_string(),
            diff_patch: "diff --git a/README.md b/README.md\n".to_string(),
            changed_files: vec![aich_git::GitChangedFile {
                path: "README.md".to_string(),
                change_type: "modified".to_string(),
                symbols_json: "[]".to_string(),
            }],
            committed_worktree_changes: true,
        },
    ));
    complete_session_with(&complete_options, &completer).expect("complete session");

    let preflight_options = PreflightOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    };
    let preflight_runner =
        MockPreflightRunner::new(PreflightOutcome::Blocked(aich_git::PreflightBlocked {
            reason: "checks_failed".to_string(),
            verified_tree_id: Some("tree-after-merge".to_string()),
            verified_commit_id: Some("commit-after-merge".to_string()),
            conflict_files: Vec::new(),
            merge_stdout: String::new(),
            merge_stderr: String::new(),
            checks: vec![PreflightCheckOutput {
                name: "test".to_string(),
                command: "cargo test --all".to_string(),
                required: true,
                timed_out: false,
                passed: false,
                code: Some(101),
                stdout: String::new(),
                stderr: "failed\n".to_string(),
            }],
        }));

    let result =
        run_preflight_with(&preflight_options, &git, &preflight_runner).expect("preflight");

    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Blocked);
    assert_eq!(result.blocked_reason.as_deref(), Some("checks_failed"));
    assert!(!result.merge_attempt.checks_passed);
    assert_eq!(result.check_results[0].result, CheckResultStatus::Failed);

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger
        .list_events()
        .expect("events")
        .iter()
        .any(|event| event.name == "merge.blocked" && event.data_json.contains("checks_failed")));

    let _ = fs::remove_dir_all(repo);
}
