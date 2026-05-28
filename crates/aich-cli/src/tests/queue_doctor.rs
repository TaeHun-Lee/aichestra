use super::*;

#[test]
fn queue_shows_human_readable_candidate_states() {
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
        "session-enqueued",
        SessionStatus::Enqueued,
        None,
        false,
    );
    insert_queue_candidate(
        &repo,
        &ledger,
        "session-preflight",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::PreflightRunning),
        false,
    );
    insert_queue_candidate(
        &repo,
        &ledger,
        "session-verified",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Verified),
        false,
    );
    ledger
        .insert_semantic_review(&SemanticReview {
            id: "review-session-verified".to_string(),
            merge_attempt_id: "merge-session-verified".to_string(),
            risk_level: SemanticRiskLevel::Low,
            report_path: Some(".aichestra/artifacts/review-session-verified.yaml".to_string()),
            change_manifest_id: None,
            change_manifest_hash: None,
            verified_candidate_fingerprint: None,
            changed_files_fingerprint: None,
            check_results_fingerprint: None,
            review_evidence_fingerprint: None,
            semantic_review_policy_fingerprint: Some(current_semantic_review_policy_fingerprint(
                &repo,
            )),
            proposed_patch_available: false,
            fix_plan_artifact: None,
            patch_artifact: None,
            created_at_ms: now_millis(),
        })
        .expect("insert verified review");
    insert_queue_candidate(
        &repo,
        &ledger,
        "session-blocked",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Blocked),
        false,
    );
    insert_queue_candidate(
        &repo,
        &ledger,
        "session-approved",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Verified),
        true,
    );
    insert_queue_candidate(
        &repo,
        &ledger,
        "session-applying",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Applying),
        true,
    );
    insert_queue_candidate(
        &repo,
        &ledger,
        "session-applied",
        SessionStatus::Completed,
        Some(MergeAttemptStatus::Applied),
        true,
    );

    let options = QueueOptions {
        repo_root: repo.clone(),
        db_path: None,
    };
    let mut output = Vec::new();
    render_queue(&options, &mut output).expect("render queue");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("Aichestra queue"));
    assert!(output.contains("Lock: free"));
    assert!(output.contains(
        "Summary: enqueued=1 preflight_running=1 applying=1 verified=1 approved=1 blocked=1"
    ));
    assert!(output.contains("- session-enqueued [enqueued]"));
    assert!(output.contains("- session-preflight [preflight_running]"));
    assert!(output.contains("- session-verified [verified]"));
    assert!(output.contains("- session-blocked [blocked]"));
    assert!(output.contains("- session-approved [approved]"));
    assert!(output.contains("- session-applying [applying]"));
    assert!(output.contains("next: aich preflight session-enqueued"));
    assert!(output.contains("review: review-session-verified (low)"));
    assert!(output.contains("next: aich approve session-verified"));
    assert!(output.contains("next: aich apply session-approved"));
    assert!(output.contains("next: aich apply session-applying"));
    assert!(!output.contains("session-applied ["));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn queue_points_stale_semantic_review_back_to_review() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);
    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");
    run_manifest_edit(&ManifestEditOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
        set_intent_summary: Some("Manifest was refined after review.".to_string()),
        set_risk_level: Some("low".to_string()),
        add_risks: Vec::new(),
        add_tests: Vec::new(),
        content_file: None,
    })
    .expect("edit manifest");

    let options = QueueOptions {
        repo_root: repo.clone(),
        db_path: None,
    };
    let mut output = Vec::new();
    render_queue(&options, &mut output).expect("render queue");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("review_stale: yes (manifest_changed"));
    assert!(output.contains("next: aich review session-review"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn queue_points_stale_preflight_check_policy_back_to_preflight() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);
    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");
    configure_single_check(
        &repo,
        "new-required-check",
        "cargo test --all --locked",
        true,
    );

    let options = QueueOptions {
        repo_root: repo.clone(),
        db_path: None,
    };
    let mut output = Vec::new();
    render_queue(&options, &mut output).expect("render queue");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("preflight_stale: yes (check_policy_changed)"));
    assert!(output.contains("next: aich preflight session-review"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn queue_points_stale_semantic_review_policy_back_to_review() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);
    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");
    fs::write(
        repo.join(".aichestra/prompts/semantic-merge-review.md"),
        "Updated semantic review prompt for queue stale testing.\n",
    )
    .expect("update semantic review prompt");

    let options = QueueOptions {
        repo_root: repo.clone(),
        db_path: None,
    };
    let mut output = Vec::new();
    render_queue(&options, &mut output).expect("render queue");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("review_stale: yes (semantic_review_policy_changed)"));
    assert!(output.contains("next: aich review session-review"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn queue_shows_blocked_check_recovery_guidance() {
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
        "session-blocked-check",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Blocked),
        false,
    );
    ledger
            .insert_check_result(&CheckResult {
                id: "check-blocked".to_string(),
                merge_attempt_id: "merge-session-blocked-check".to_string(),
                name: "test".to_string(),
                command: "cargo test --all".to_string(),
                required: true,
                timed_out: false,
                result: CheckResultStatus::Failed,
                stdout_artifact: Some(
                    ".aichestra/artifacts/merge-attempts/merge-session-blocked-check/checks/0-test.stdout"
                        .to_string(),
                ),
                stderr_artifact: Some(
                    ".aichestra/artifacts/merge-attempts/merge-session-blocked-check/checks/0-test.stderr"
                        .to_string(),
                ),
                created_at_ms: now_millis(),
            })
            .expect("insert failed check");
    ledger
            .append_event(
                &NewEvent::new(EventName::MergeBlocked)
                    .with_subject("merge_attempt", "merge-session-blocked-check")
                    .with_data_json(
                        "{\"operator_id\":\"local-user\",\"session_id\":\"session-blocked-check\",\"reason\":\"checks_failed\"}",
                    ),
            )
            .expect("blocked event");

    let mut output = Vec::new();
    render_queue(
        &QueueOptions {
            repo_root: repo.clone(),
            db_path: None,
        },
        &mut output,
    )
    .expect("render queue");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("blocked_reason: checks_failed"));
    assert!(output.contains("recovery: Sandbox check(s) failed: test."));
    assert!(output.contains("test stderr: .aichestra/artifacts/merge-attempts/merge-session-blocked-check/checks/0-test.stderr"));
    assert!(output.contains("Run `aich session reopen session-blocked-check`"));
    assert!(output.contains("Run `aich session complete session-blocked-check` after the fix"));
    assert!(output.contains("next: aich session reopen session-blocked-check"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn queue_shows_rejected_recovery_guidance() {
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
        "session-rejected",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Verified),
        false,
    );
    ledger
        .insert_semantic_review(&SemanticReview {
            id: "review-session-rejected".to_string(),
            merge_attempt_id: "merge-session-rejected".to_string(),
            risk_level: SemanticRiskLevel::Medium,
            report_path: Some(".aichestra/artifacts/rejected-review.yaml".to_string()),
            change_manifest_id: None,
            change_manifest_hash: None,
            verified_candidate_fingerprint: None,
            changed_files_fingerprint: None,
            check_results_fingerprint: None,
            review_evidence_fingerprint: None,
            semantic_review_policy_fingerprint: Some(current_semantic_review_policy_fingerprint(
                &repo,
            )),
            proposed_patch_available: false,
            fix_plan_artifact: None,
            patch_artifact: None,
            created_at_ms: now_millis(),
        })
        .expect("insert review");
    ledger
        .update_merge_attempt_status(
            "merge-session-rejected",
            MergeAttemptStatus::Blocked,
            now_millis(),
        )
        .expect("block rejected");
    ledger
        .append_event(
            &NewEvent::new(EventName::MergeBlocked)
                .with_subject("merge_attempt", "merge-session-rejected")
                .with_data_json(
                    "{\"operator_id\":\"local-user\",\"session_id\":\"session-rejected\",\"reason\":\"rejected\"}",
                ),
        )
        .expect("blocked event");

    let mut output = Vec::new();
    render_queue(
        &QueueOptions {
            repo_root: repo.clone(),
            db_path: None,
        },
        &mut output,
    )
    .expect("render queue");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("blocked_reason: rejected"));
    assert!(output.contains("recovery: A human rejected the verified candidate before apply."));
    assert!(output.contains("semantic review: .aichestra/artifacts/rejected-review.yaml"));
    assert!(output.contains("Run `aich session reopen session-rejected`"));
    assert!(output.contains("next: aich session reopen session-rejected"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn queue_shows_active_lock() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger
        .try_acquire_queue_lock(&QueueLock {
            name: MERGE_QUEUE_LOCK_NAME.to_string(),
            holder_id: "holder-1".to_string(),
            operation: "preflight".to_string(),
            session_id: Some("session-1".to_string()),
            acquired_at_ms: now_millis(),
        })
        .expect("acquire lock"));

    let mut output = Vec::new();
    render_queue(
        &QueueOptions {
            repo_root: repo.clone(),
            db_path: None,
        },
        &mut output,
    )
    .expect("render queue");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("Lock: held by holder-1 (preflight, session session-1)"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn queue_marks_old_lock_as_stale() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger
        .try_acquire_queue_lock(&QueueLock {
            name: MERGE_QUEUE_LOCK_NAME.to_string(),
            holder_id: "holder-1".to_string(),
            operation: "preflight".to_string(),
            session_id: Some("session-1".to_string()),
            acquired_at_ms: now_millis() - QUEUE_LOCK_STALE_AFTER_MS - MILLIS_PER_SECOND,
        })
        .expect("acquire lock"));

    let mut output = Vec::new();
    render_queue(
        &QueueOptions {
            repo_root: repo.clone(),
            db_path: None,
        },
        &mut output,
    )
    .expect("render queue");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("Lock stale: yes"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn queue_unlock_releases_lock_and_records_event() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger
        .try_acquire_queue_lock(&QueueLock {
            name: MERGE_QUEUE_LOCK_NAME.to_string(),
            holder_id: "holder-1".to_string(),
            operation: "preflight".to_string(),
            session_id: Some("session-1".to_string()),
            acquired_at_ms: now_millis() - QUEUE_LOCK_STALE_AFTER_MS - MILLIS_PER_SECOND,
        })
        .expect("acquire lock"));

    let result = run_queue_unlock(&QueueUnlockOptions {
        repo_root: repo.clone(),
        db_path: None,
        force: true,
        reason: Some("stale process".to_string()),
    })
    .expect("unlock");

    assert_eq!(
        result
            .released_lock
            .as_ref()
            .map(|lock| lock.holder_id.as_str()),
        Some("holder-1")
    );
    assert!(result.stale);
    assert_eq!(
        ledger
            .get_queue_lock(MERGE_QUEUE_LOCK_NAME)
            .expect("queue lock"),
        None
    );
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.queue_unlocked" && event.data_json.contains("stale process")
    }));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn doctor_reports_missing_init_without_creating_ledger() {
    let repo = unique_temp_dir();
    let result = run_doctor(&DoctorOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("doctor");

    assert_eq!(result.result_label(), "error");
    assert!(result.error_count() > 0);
    assert!(!repo.join(".aichestra/aichestra.db").exists());

    let mut output = Vec::new();
    render_doctor(&result, &mut output).expect("render doctor");
    let output = String::from_utf8(output).expect("utf8 output");
    assert!(output.contains("Aichestra doctor"));
    assert!(output.contains("Result: error"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn doctor_reports_initialized_repo_ok() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");

    let mut output = Vec::new();
    run_with_cwd(["aich", "doctor"], &repo, &mut output).expect("doctor");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("[ok] config:"));
    assert!(output.contains("[ok] ledger:"));
    assert!(output.contains("[ok] operator: default operator local-user is active"));
    assert!(output.contains("[ok] queue lock: free"));
    assert!(output.contains("Summary: warnings=0 errors=0"));
    assert!(output.contains("Result: ok"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn doctor_warns_when_queue_lock_is_stale() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger
        .try_acquire_queue_lock(&QueueLock {
            name: MERGE_QUEUE_LOCK_NAME.to_string(),
            holder_id: "holder-1".to_string(),
            operation: "preflight".to_string(),
            session_id: Some("session-1".to_string()),
            acquired_at_ms: now_millis() - QUEUE_LOCK_STALE_AFTER_MS - MILLIS_PER_SECOND,
        })
        .expect("acquire lock"));

    let mut output = Vec::new();
    run_with_cwd(["aich", "doctor"], &repo, &mut output).expect("doctor");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("[warning] queue lock: stale held by holder-1"));
    assert!(output.contains("Result: warning"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn doctor_warns_when_apply_recovery_is_pending() {
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
        "session-applying",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Applying),
        true,
    );

    let mut output = Vec::new();
    run_with_cwd(["aich", "doctor"], &repo, &mut output).expect("doctor");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("[warning] apply recovery:"));
    assert!(output.contains("aich apply session-applying"));
    assert!(output.contains("Result: warning"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn status_lists_sessions_and_recent_events() {
    let repo = unique_temp_dir();
    let init_options = InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    };
    init_repo(&init_options).expect("init");

    let options = SessionStartOptions {
        repo_root: repo.clone(),
        db_path: None,
        goal: "add status command".to_string(),
        provider: "codex".to_string(),
        target_path: Some("src/status.rs".to_string()),
        operator_id: None,
    };
    let git = MockGitRepository;
    let worktrees = MockWorktreeManager::new();
    let session = start_session_with(&options, &git, &worktrees)
        .expect("start session")
        .session;

    let status_options = StatusOptions {
        repo_root: repo.clone(),
        db_path: None,
        recent_events_limit: 2,
    };
    let mut output = Vec::new();
    render_status(&status_options, &mut output).expect("render status");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("Aichestra status"));
    assert!(output.contains("Operators: 1"));
    assert!(output.contains("Sessions: 1"));
    assert!(output.contains(&format!("- {} [running]", session.id)));
    assert!(output.contains("provider: codex"));
    assert!(output.contains(&format!("branch: {}", session.branch)));
    assert!(output.contains(&format!("worktree: {}", session.worktree_path)));
    assert!(output.contains("target: src/status.rs"));
    assert!(output.contains("base: base-co"));
    assert!(output.contains("Events: 4"));
    assert!(output.contains("Recent events:"));
    assert!(output.contains("session.started"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn status_marks_cleaned_sessions() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let session = seed_session_with_status(&repo, "session-cleaned", SessionStatus::Noop);
    mark_session_cleaned(&repo, &session.id);

    let status_options = StatusOptions {
        repo_root: repo.clone(),
        db_path: None,
        recent_events_limit: 0,
    };
    let mut output = Vec::new();
    render_status(&status_options, &mut output).expect("render status");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains(&format!("- {} [noop]", session.id)));
    assert!(output.contains("cleanup: cleaned"));

    let _ = fs::remove_dir_all(repo);
}
