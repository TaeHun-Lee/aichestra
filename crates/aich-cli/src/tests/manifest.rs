use super::*;

#[test]
fn manifest_show_reports_hash_and_diff_evidence() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let output = run_cli(&repo, ["aich", "manifest", "show", &session.id]);

    assert!(output.contains("Change Manifest"));
    assert!(output.contains("Session: session-review"));
    assert!(output.contains("Hash: ok"));
    assert!(output.contains("YAML: ok"));
    assert!(output.contains("Manifest vs diff: ok"));
    assert!(output.contains("Changed files: 1"));
    assert!(output.contains("  - README.md"));
    assert!(output.contains("Next edit: aich manifest edit session-review"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn manifest_edit_updates_yaml_hash_and_event() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let output = run_cli(
        &repo,
        [
            "aich",
            "manifest",
            "edit",
            &session.id,
            "--set-intent-summary",
            "README wording is clarified for the CLI overview.",
            "--set-risk-level",
            "low",
            "--add-risk",
            "No runtime behavior changes are expected.",
            "--add-test",
            "cargo test --all",
        ],
    );

    assert!(output.contains("Updated Change Manifest"));
    assert!(output.contains("Ledger status: reviewed_by_operator"));
    assert!(output.contains("Changed fields: intent.summary, risks.level, risks.items, tests.executed, evidence.validation_status"));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let manifest = ledger
        .list_change_manifests(&session.id)
        .expect("list manifests")
        .pop()
        .expect("manifest");
    assert_eq!(manifest.validation_status, CHANGE_MANIFEST_REVIEWED_STATUS);
    let content = fs::read_to_string(repo.join(&manifest.manifest_path)).expect("manifest content");
    assert!(content.contains("README wording is clarified"));
    assert!(content.contains("level: low"));
    assert!(content.contains("No runtime behavior changes are expected."));
    assert!(content.contains("cargo test --all"));
    assert!(content.contains("validation_status: reviewed_by_operator"));
    let expected_hash = sha256_hex(content.as_bytes());
    assert_eq!(
        manifest.manifest_hash.as_deref(),
        Some(expected_hash.as_str())
    );
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "manifest.updated"
            && event.subject_id.as_deref() == Some(session.id.as_str())
            && event.data_json.contains("\"operator_id\":\"local-user\"")
    }));

    let show_output = run_cli(&repo, ["aich", "manifest", "show", &session.id]);
    assert!(show_output.contains("Hash: ok"));
    assert!(show_output.contains("Ledger status: reviewed_by_operator"));
    assert!(show_output.contains("Intent summary: README wording is clarified"));
    assert!(show_output.contains("Risk level: low"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn manifest_edit_refuses_already_approved_candidate() {
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

    let error = run_manifest_edit(&ManifestEditOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
        set_intent_summary: Some("too late".to_string()),
        set_risk_level: None,
        add_risks: Vec::new(),
        add_tests: Vec::new(),
        content_file: None,
    })
    .unwrap_err();

    assert!(
        matches!(error, CliError::Usage(ref message) if message.contains("already approved")),
        "{error}"
    );

    let _ = fs::remove_dir_all(repo);
}
