use super::*;

#[test]
fn approve_records_exact_verified_tree_after_review() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");

    let result = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");

    assert_eq!(result.merge_attempt.id, attempt.id);
    assert_eq!(result.approval.merge_attempt_id, attempt.id);
    assert_eq!(result.approval.approved_by, DEFAULT_OPERATOR_ID);
    assert_eq!(result.approval.approved_verified_tree_id, "verified-tree");
    assert_eq!(
        result.approval.approved_verified_commit_id,
        "verified-commit"
    );
    assert_eq!(
        result.merge_attempt.semantic_risk_level.as_deref(),
        Some("medium")
    );
    assert_eq!(result.semantic_reviews.len(), 1);

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert_eq!(
        ledger.list_approvals(&attempt.id).expect("list approvals"),
        vec![result.approval]
    );
    let event_names: Vec<String> = ledger
        .list_events()
        .expect("events")
        .into_iter()
        .map(|event| event.name)
        .collect();
    assert!(event_names.contains(&"approval.requested".to_string()));
    assert!(event_names.contains(&"approval.approved".to_string()));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn approve_requires_semantic_review_first() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let err = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("aich review")));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn approve_refuses_stale_semantic_review_after_manifest_edit() {
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
        set_intent_summary: Some("README wording was reviewed by a human.".to_string()),
        set_risk_level: Some("low".to_string()),
        add_risks: Vec::new(),
        add_tests: vec!["cargo test --all".to_string()],
        content_file: None,
    })
    .expect("edit manifest");

    let err = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .unwrap_err();
    assert!(
        matches!(err, CliError::Usage(ref message) if message.contains("Semantic review") && message.contains("manifest_changed") && message.contains("aich review")),
        "{err}"
    );

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("rerun review");
    let result = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve after fresh review");

    assert_eq!(result.approval.merge_attempt_id, result.merge_attempt.id);

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn approve_refuses_stale_semantic_review_after_check_evidence_changes() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    ledger
        .insert_check_result(&CheckResult {
            id: "check-after-review".to_string(),
            merge_attempt_id: attempt.id.clone(),
            name: "extra".to_string(),
            command: "cargo clippy --all-targets".to_string(),
            required: false,
            timed_out: false,
            result: CheckResultStatus::Passed,
            stdout_artifact: None,
            stderr_artifact: None,
            created_at_ms: now_millis(),
        })
        .expect("insert check after review");

    let err = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .unwrap_err();
    assert!(
        matches!(err, CliError::Usage(ref message) if message.contains("checks_changed") && message.contains("aich review")),
        "{err}"
    );

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("rerun review");
    let result = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve after fresh review");

    assert_eq!(result.approval.merge_attempt_id, result.merge_attempt.id);

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn approve_refuses_stale_semantic_review_after_verified_candidate_changes() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    ledger
        .update_merge_attempt_result(aich_ledger::MergeAttemptResultUpdate {
            id: &attempt.id,
            status: MergeAttemptStatus::Verified,
            verified_tree_id: Some("verified-tree-after-review"),
            verified_commit_id: Some("verified-commit-after-review"),
            checks_passed: true,
            semantic_risk_level: Some("medium"),
            updated_at_ms: now_millis(),
        })
        .expect("update verified candidate");

    let err = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .unwrap_err();
    assert!(
        matches!(err, CliError::Usage(ref message) if message.contains("verified_candidate_changed") && message.contains("aich review")),
        "{err}"
    );

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("rerun review");
    let result = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve after fresh review");

    assert_eq!(
        result.approval.approved_verified_commit_id,
        "verified-commit-after-review"
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn approve_refuses_stale_semantic_review_after_review_policy_changes() {
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
        "Updated semantic review prompt for policy stale testing.\n",
    )
    .expect("update semantic review prompt");

    let err = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .unwrap_err();
    assert!(
        matches!(err, CliError::Usage(ref message) if message.contains("semantic_review_policy_changed") && message.contains("aich review")),
        "{err}"
    );

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("rerun review");
    let result = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve after fresh review policy");

    assert_eq!(result.approval.merge_attempt_id, result.merge_attempt.id);

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn approve_explains_legacy_semantic_review_evidence() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    ledger
        .insert_semantic_review(&SemanticReview {
            id: "legacy-review".to_string(),
            merge_attempt_id: attempt.id.clone(),
            risk_level: SemanticRiskLevel::Low,
            report_path: Some(".aichestra/artifacts/legacy-review.yaml".to_string()),
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
        .expect("insert legacy review");
    ledger
        .update_merge_attempt_semantic_review(aich_ledger::MergeAttemptSemanticReviewUpdate {
            id: &attempt.id,
            status: MergeAttemptStatus::Verified,
            semantic_risk_level: SemanticRiskLevel::Low,
            updated_at_ms: now_millis(),
        })
        .expect("record semantic risk");

    let err = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .unwrap_err();

    assert!(
        matches!(err, CliError::Usage(ref message) if message.contains("legacy_review_evidence") && message.contains("created before review evidence fingerprints were recorded") && message.contains("aich review")),
        "{err}"
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_refuses_stale_preflight_after_check_policy_changes() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);
    configure_single_check(
        &repo,
        "new-required-check",
        "cargo test --all --locked",
        true,
    );

    let err = run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .unwrap_err();

    assert!(
        matches!(err, CliError::Usage(ref message) if message.contains("check_policy_changed") && message.contains("aich preflight")),
        "{err}"
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn approve_refuses_stale_preflight_after_check_policy_changes() {
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

    let err = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .unwrap_err();
    assert!(
        matches!(err, CliError::Usage(ref message) if message.contains("check_policy_changed") && message.contains("aich preflight")),
        "{err}"
    );

    let preflight_runner =
        MockPreflightRunner::new(PreflightOutcome::Verified(aich_git::PreflightVerified {
            verified_tree_id: "verified-tree-after-policy-change".to_string(),
            verified_commit_id: "verified-commit-after-policy-change".to_string(),
            checks: vec![PreflightCheckOutput {
                name: "new-required-check".to_string(),
                command: "cargo test --all --locked".to_string(),
                required: true,
                timed_out: false,
                passed: true,
                code: Some(0),
                stdout: "ok\n".to_string(),
                stderr: String::new(),
            }],
        }));
    run_preflight_with(
        &PreflightOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &preflight_runner,
    )
    .expect("refresh preflight");
    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review after refresh");
    let result = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve after refresh");

    assert_eq!(
        result.approval.approved_verified_commit_id,
        "verified-commit-after-policy-change"
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn approve_requires_explicit_accept_current_when_review_has_proposed_patch() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);
    run_review_with_adapter(
        &ReviewOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &ProposedPatchSemanticReviewAdapter,
    )
    .expect("review");

    let err = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .unwrap_err();
    assert!(
        matches!(err, CliError::Usage(message) if message.contains("aich session rework") && message.contains("--accept-current"))
    );

    let result = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: true,
        },
        &MockGitRepository,
    )
    .expect("approve current");

    assert_eq!(result.approval.merge_attempt_id, result.merge_attempt.id);

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn reject_records_human_rejection_and_blocks_verified_attempt() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);
    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");

    let result = run_reject_with(&RejectOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
        reason: "The user-facing behavior is incomplete.".to_string(),
    })
    .expect("reject");

    assert_eq!(result.merge_attempt.id, attempt.id);
    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Blocked);
    assert_eq!(result.rejection.merge_attempt_id, attempt.id);
    assert_eq!(result.rejection.rejected_by, DEFAULT_OPERATOR_ID);
    assert_eq!(result.rejection.rejected_verified_tree_id, "verified-tree");
    assert_eq!(
        result.rejection.rejected_verified_commit_id,
        "verified-commit"
    );

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let blocked_attempt = ledger
        .get_merge_attempt(&attempt.id)
        .expect("get attempt")
        .expect("attempt exists");
    assert_eq!(blocked_attempt.status, MergeAttemptStatus::Blocked);
    assert_eq!(
        ledger
            .list_rejections(&attempt.id)
            .expect("list rejections"),
        vec![result.rejection]
    );
    assert!(ledger
        .list_approvals(&attempt.id)
        .expect("list approvals")
        .is_empty());
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "approval.rejected"
            && event
                .data_json
                .contains("user-facing behavior is incomplete")
    }));
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.blocked" && event.data_json.contains("\"reason\":\"rejected\"")
    }));

    let err = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .unwrap_err();
    assert!(
        matches!(err, CliError::Usage(message) if message.contains("blocked") || message.contains("not verified"))
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn reject_refuses_already_approved_attempt() {
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
    run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");

    let err = run_reject_with(&RejectOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
        reason: "changed my mind".to_string(),
    })
    .unwrap_err();

    assert!(matches!(err, CliError::Usage(message) if message.contains("already approved")));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_uses_approved_verified_commit_and_marks_applied() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    configure_main_branch(&repo, "trunk");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");
    let approval = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve")
    .approval;
    let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
        applied_commit_id: "verified-commit".to_string(),
        applied_tree_id: "verified-tree".to_string(),
        stdout: "fast-forward\n".to_string(),
        stderr: String::new(),
    });

    let result = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &applier,
    )
    .expect("apply");

    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Applied);
    assert_eq!(result.approval, approval);
    assert_eq!(result.applied_commit_id, "verified-commit");
    assert_eq!(result.applied_tree_id, "verified-tree");
    let requests = applier.requests.borrow();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].verified_commit_id, "verified-commit");
    assert_eq!(requests[0].verified_tree_id, "verified-tree");
    assert_eq!(requests[0].main_branch, "trunk");

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let loaded_session = ledger
        .get_session(&session.id)
        .expect("get session")
        .expect("session");
    assert_eq!(loaded_session.status, SessionStatus::Completed);
    let loaded_attempt = ledger
        .get_merge_attempt(&attempt.id)
        .expect("get attempt")
        .expect("attempt");
    assert_eq!(loaded_attempt.status, MergeAttemptStatus::Applied);
    assert_eq!(
        ledger
            .get_queue_lock(MERGE_QUEUE_LOCK_NAME)
            .expect("queue lock"),
        None
    );
    assert!(ledger
        .list_events()
        .expect("events")
        .iter()
        .any(|event| event.name == "merge.applied"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_refuses_when_check_policy_changes_after_approval() {
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
    run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");
    configure_single_check(
        &repo,
        "new-required-check",
        "cargo test --all --locked",
        true,
    );
    let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
        applied_commit_id: "verified-commit".to_string(),
        applied_tree_id: "verified-tree".to_string(),
        stdout: String::new(),
        stderr: String::new(),
    });

    let err = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &applier,
    )
    .unwrap_err();

    assert!(
        matches!(err, CliError::Usage(ref message) if message.contains("check_policy_changed") && message.contains("aich preflight")),
        "{err}"
    );
    assert!(applier.requests.borrow().is_empty());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_refuses_when_semantic_review_policy_changes_after_approval() {
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
    run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");
    fs::write(
        repo.join(".aichestra/prompts/semantic-merge-review.md"),
        "Updated semantic review prompt after approval.\n",
    )
    .expect("update semantic review prompt");
    let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
        applied_commit_id: "verified-commit".to_string(),
        applied_tree_id: "verified-tree".to_string(),
        stdout: String::new(),
        stderr: String::new(),
    });

    let err = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &applier,
    )
    .unwrap_err();

    assert!(
        matches!(err, CliError::Usage(ref message) if message.contains("semantic_review_policy_changed") && message.contains("aich review")),
        "{err}"
    );
    assert!(applier.requests.borrow().is_empty());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_refuses_when_semantic_review_evidence_changes_after_approval() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");
    run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");
    Ledger::open(repo.join(".aichestra/aichestra.db"))
        .expect("open ledger")
        .insert_check_result(&CheckResult {
            id: "check-after-approval".to_string(),
            merge_attempt_id: attempt.id.clone(),
            name: "extra".to_string(),
            command: "cargo clippy --all-targets".to_string(),
            required: false,
            timed_out: false,
            result: CheckResultStatus::Passed,
            stdout_artifact: None,
            stderr_artifact: None,
            created_at_ms: now_millis(),
        })
        .expect("insert check after approval");
    let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
        applied_commit_id: "verified-commit".to_string(),
        applied_tree_id: "verified-tree".to_string(),
        stdout: String::new(),
        stderr: String::new(),
    });

    let err = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &applier,
    )
    .unwrap_err();

    assert!(
        matches!(err, CliError::Usage(ref message) if message.contains("checks_changed") && message.contains("aich review")),
        "{err}"
    );
    assert!(applier.requests.borrow().is_empty());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_recovers_when_verified_commit_is_already_on_main() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");
    run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    ledger
        .update_merge_attempt_status(&attempt.id, MergeAttemptStatus::Applying, now_millis())
        .expect("mark applying");
    let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
        applied_commit_id: "verified-commit".to_string(),
        applied_tree_id: "verified-tree".to_string(),
        stdout: String::new(),
        stderr: String::new(),
    });

    let result = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &RecordingGitRepository::new("verified-commit"),
        &applier,
    )
    .expect("recover apply");

    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Applied);
    assert!(applier.requests.borrow().is_empty());
    let loaded_session = ledger
        .get_session(&session.id)
        .expect("get session")
        .expect("session");
    assert_eq!(loaded_session.status, SessionStatus::Completed);
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.applied"
            && event.subject_id.as_deref() == Some(attempt.id.as_str())
            && event.data_json.contains("\"recovered\":true")
    }));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_retries_when_applying_but_main_has_not_moved() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");
    run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    ledger
        .update_merge_attempt_status(&attempt.id, MergeAttemptStatus::Applying, now_millis())
        .expect("mark applying");
    let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
        applied_commit_id: "verified-commit".to_string(),
        applied_tree_id: "verified-tree".to_string(),
        stdout: String::new(),
        stderr: String::new(),
    });

    let result = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &applier,
    )
    .expect("retry apply");

    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Applied);
    assert_eq!(applier.requests.borrow().len(), 1);
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.applied"
            && event.subject_id.as_deref() == Some(attempt.id.as_str())
            && event.data_json.contains("\"recovered\":false")
    }));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_recovery_rejects_unexpected_main_for_applying_attempt() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");
    run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");
    Ledger::open(repo.join(".aichestra/aichestra.db"))
        .expect("open ledger")
        .update_merge_attempt_status(&attempt.id, MergeAttemptStatus::Applying, now_millis())
        .expect("mark applying");
    let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
        applied_commit_id: "verified-commit".to_string(),
        applied_tree_id: "verified-tree".to_string(),
        stdout: String::new(),
        stderr: String::new(),
    });

    let err = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockMovedGitRepository,
        &applier,
    )
    .unwrap_err();

    assert!(
        matches!(err, CliError::Usage(message) if message.contains("is applying") && message.contains("expected main_before"))
    );
    assert!(applier.requests.borrow().is_empty());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_finalizes_partially_recorded_applied_attempt() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");
    run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    ledger
        .update_merge_attempt_status(&attempt.id, MergeAttemptStatus::Applied, now_millis())
        .expect("mark applied");
    let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
        applied_commit_id: "verified-commit".to_string(),
        applied_tree_id: "verified-tree".to_string(),
        stdout: String::new(),
        stderr: String::new(),
    });

    let result = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &RecordingGitRepository::new("verified-commit"),
        &applier,
    )
    .expect("finalize partially applied attempt");

    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Applied);
    assert!(applier.requests.borrow().is_empty());
    assert_eq!(
        ledger
            .get_session(&session.id)
            .expect("get session")
            .expect("session")
            .status,
        SessionStatus::Completed
    );
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.applied"
            && event.subject_id.as_deref() == Some(attempt.id.as_str())
            && event.data_json.contains("\"recovered\":true")
    }));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_refuses_when_queue_lock_is_held() {
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
    run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger
        .try_acquire_queue_lock(&QueueLock {
            name: MERGE_QUEUE_LOCK_NAME.to_string(),
            holder_id: "holder-1".to_string(),
            operation: "preflight".to_string(),
            session_id: Some("other-session".to_string()),
            acquired_at_ms: now_millis(),
        })
        .expect("acquire lock"));
    let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
        applied_commit_id: "verified-commit".to_string(),
        applied_tree_id: "verified-tree".to_string(),
        stdout: String::new(),
        stderr: String::new(),
    });

    let err = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &applier,
    )
    .unwrap_err();

    assert!(matches!(err, CliError::Usage(message) if message.contains("merge queue is locked")));
    assert!(applier.requests.borrow().is_empty());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_requires_approval_first() {
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
    let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
        applied_commit_id: "verified-commit".to_string(),
        applied_tree_id: "verified-tree".to_string(),
        stdout: String::new(),
        stderr: String::new(),
    });
    let err = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &applier,
    )
    .unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("aich approve")));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_wrong_branch_error_includes_recovery_hint() {
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
    run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");
    let applier = MockFailingVerifiedCommitApplier::invalid_request(
        "main worktree is on branch 'feature', expected configured main branch 'main'",
    );

    let err = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &applier,
    )
    .unwrap_err();

    assert!(
        matches!(err, CliError::Usage(message) if message.contains("git switch main") && message.contains("git.main_branch") && message.contains(&format!("aich apply {}", session.id)))
    );
    assert_eq!(applier.requests.borrow().len(), 1);

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn apply_rejects_when_main_moved_after_approval() {
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
    run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: false,
        },
        &MockGitRepository,
    )
    .expect("approve");
    let applier = MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
        applied_commit_id: "verified-commit".to_string(),
        applied_tree_id: "verified-tree".to_string(),
        stdout: String::new(),
        stderr: String::new(),
    });

    let err = run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockMovedGitRepository,
        &applier,
    )
    .unwrap_err();
    assert!(
        matches!(err, CliError::Usage(message) if message.contains("main moved") && message.contains("aich preflight") && message.contains("aich approve"))
    );
    assert!(applier.requests.borrow().is_empty());

    let _ = fs::remove_dir_all(repo);
}
