use super::*;

#[test]
fn codex_semantic_review_command_uses_safe_noninteractive_defaults() {
    let command = codex_semantic_review_command(Some("model-x"), Some("semantic-review"));

    assert_eq!(command.program, "codex");
    assert_eq!(command.args[0], "--ask-for-approval");
    assert_eq!(command.args[1], "never");
    assert_eq!(command.args[2], "exec");
    assert!(command.args.contains(&"--sandbox".to_string()));
    assert!(command.args.contains(&"read-only".to_string()));
    assert!(command.args.contains(&"--ask-for-approval".to_string()));
    assert!(command.args.contains(&"never".to_string()));
    assert!(command.args.contains(&"--skip-git-repo-check".to_string()));
    assert!(command.args.contains(&"--ephemeral".to_string()));
    assert!(command.args.contains(&"--model".to_string()));
    assert!(command.args.contains(&"model-x".to_string()));
    assert!(command.args.contains(&"--profile".to_string()));
    assert!(command.args.contains(&"semantic-review".to_string()));
    assert_eq!(command.args.last().map(String::as_str), Some("-"));
}

#[test]
fn structured_manifest_validation_rejects_path_substring_match() {
    let evidence = parse_manifest_diff_evidence(
        "change_manifest:\n  changed_areas:\n    - file: \"docs/src/lib.rs.md\"\n",
    )
    .expect("parse manifest");

    let missing = changed_files_missing_from_manifest(
        &[ChangedFile::new("src/lib.rs", "modified")],
        Some(&evidence),
    );

    assert_eq!(missing, vec!["src/lib.rs".to_string()]);
}

#[test]
fn structured_manifest_validation_normalizes_windows_separators() {
    let evidence = parse_manifest_diff_evidence(
        "change_manifest:\n  changed_areas:\n    - file: \"src\\\\lib.rs\"\n",
    )
    .expect("parse manifest");

    let missing = changed_files_missing_from_manifest(
        &[ChangedFile::new("src/lib.rs", "modified")],
        Some(&evidence),
    );

    assert!(missing.is_empty());
}

#[test]
fn manifest_diff_patch_artifact_is_structured_evidence() {
    let artifact = parse_manifest_diff_patch_artifact(
        "change_manifest:\n  evidence:\n    diff_patch_artifact: \".aichestra\\\\artifacts\\\\sessions\\\\s1\\\\diff.patch\"\n",
    )
    .expect("parse manifest")
    .expect("diff patch artifact");

    assert_eq!(artifact, ".aichestra/artifacts/sessions/s1/diff.patch");
}

#[test]
fn local_review_blocks_invalid_change_manifest_yaml() {
    let manifest = ChangeManifest {
        id: "manifest-1".to_string(),
        session_id: "session-1".to_string(),
        manifest_path: ".aichestra/artifacts/change-manifest.yaml".to_string(),
        manifest_hash: None,
        validation_status: CHANGE_MANIFEST_VALIDATION_STATUS.to_string(),
        created_at_ms: now_millis(),
    };
    let attempt = MergeAttempt {
        id: "merge-1".to_string(),
        session_id: "session-1".to_string(),
        status: MergeAttemptStatus::Verified,
        main_before_commit: "base-commit".to_string(),
        candidate_commit: "head-commit".to_string(),
        apply_strategy: PREFLIGHT_APPLY_STRATEGY.to_string(),
        check_policy_fingerprint: Some("check-policy".to_string()),
        verified_tree_id: Some("tree".to_string()),
        verified_commit_id: Some("commit".to_string()),
        checks_passed: true,
        semantic_risk_level: None,
    };

    let report = build_local_semantic_review_report(
        &manifest,
        Some("change_manifest:\n  changed_areas: ["),
        false,
        &attempt,
        &[ChangedFile::new("README.md", "modified")],
        &[CheckResult {
            id: "check-1".to_string(),
            merge_attempt_id: attempt.id.clone(),
            name: "test".to_string(),
            command: "cargo test --all".to_string(),
            required: true,
            timed_out: false,
            result: CheckResultStatus::Passed,
            stdout_artifact: None,
            stderr_artifact: None,
            created_at_ms: now_millis(),
        }],
    );

    assert_eq!(report.risk_level, SemanticRiskLevel::Blocked);
    assert!(report
        .suspected_conflicts
        .iter()
        .any(|finding| finding.conflict_type == "manifest_mismatch"));
}
#[test]
fn review_records_semantic_report_for_verified_attempt() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "src/lib.rs", true);

    let mut output = Vec::new();
    run_with_cwd(["aich", "review", &session.id], &repo, &mut output).expect("review");
    let output = String::from_utf8(output).expect("utf8 output");
    assert!(output.contains("Review high"));
    assert!(output.contains("Merge attempt: merge-review"));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let reviews = ledger
        .list_semantic_reviews(&attempt.id)
        .expect("semantic reviews");
    assert_eq!(reviews.len(), 1);
    assert_eq!(reviews[0].risk_level, SemanticRiskLevel::High);
    let report_path = repo.join(reviews[0].report_path.as_deref().expect("report path"));
    assert!(report_path.exists());
    let report = fs::read_to_string(report_path).expect("read report");
    assert!(report.contains("local_mvp_static_reviewer"));
    assert!(report.contains("api_contract_change"));

    let loaded_attempt = ledger
        .get_merge_attempt(&attempt.id)
        .expect("get attempt")
        .expect("attempt exists");
    assert_eq!(loaded_attempt.status, MergeAttemptStatus::Verified);
    assert_eq!(loaded_attempt.semantic_risk_level.as_deref(), Some("high"));
    assert!(ledger
        .list_events()
        .expect("events")
        .iter()
        .any(|event| event.name == "merge.semantic_review.completed"
            && event.data_json.contains("\"risk_level\":\"high\"")));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_blocks_when_manifest_artifact_is_missing() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", false);

    let review_options = ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    };
    let result = run_review_with(&review_options).expect("review");

    assert_eq!(
        result.semantic_review.risk_level,
        SemanticRiskLevel::Blocked
    );
    assert!(result.blocked);
    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Blocked);
    assert_eq!(
        result.merge_attempt.semantic_risk_level.as_deref(),
        Some("blocked")
    );
    assert!(result.report_path.exists());
    assert!(result
        .required_actions
        .iter()
        .any(|action| action.contains("Change Manifest")));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.blocked" && event.data_json.contains("semantic_review")
    }));
    assert_eq!(
        ledger
            .list_semantic_reviews(&attempt.id)
            .expect("semantic reviews")
            .len(),
        1
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_uses_injected_semantic_review_adapter() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let result = run_review_with_adapter(
        &ReviewOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockSemanticReviewAdapter,
    )
    .expect("review");

    assert_eq!(result.semantic_review.risk_level, SemanticRiskLevel::Low);
    assert!(!result.blocked);
    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Verified);
    assert_eq!(result.summary, "Mock LLM adapter reviewed the candidate.");

    let report = fs::read_to_string(&result.report_path).expect("read report");
    assert!(report.contains("reviewer: \"mock_llm_reviewer\""));
    assert!(report.contains("llm_executed: true"));
    assert!(report.contains("risk_level: \"low\""));

    let input_path = result
        .report_path
        .with_file_name(format!("{}-input.md", result.semantic_review.id));
    let input = fs::read_to_string(input_path).expect("read input");
    assert!(input.contains("## Adapter Output Contract"));
    assert!(input.contains("Return only a YAML document"));
    assert!(input.contains("semantic_review:"));
    assert!(input.contains("- reviewer: `mock_llm_reviewer`"));
    assert!(input.contains("- llm_executed: `true`"));
    assert!(input.contains("## Patch Context"));
    assert!(input.contains("- included: `full`"));
    assert!(input.contains("+review candidate change"));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.semantic_review.completed"
            && event
                .data_json
                .contains("\"reviewer\":\"mock_llm_reviewer\"")
            && event.data_json.contains("\"llm_executed\":true")
    }));
    assert_eq!(
        ledger
            .list_semantic_reviews(&attempt.id)
            .expect("semantic reviews")
            .len(),
        1
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_persists_proposed_patch_artifacts() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let result = run_review_with_adapter(
        &ReviewOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &ProposedPatchSemanticReviewAdapter,
    )
    .expect("review");

    assert!(result.proposed_patch_available);
    let fix_plan_artifact = result.fix_plan_artifact.expect("fix plan artifact");
    let patch_artifact = result.patch_artifact.expect("patch artifact");
    let fix_plan = fs::read_to_string(repo.join(&fix_plan_artifact)).expect("read fix plan");
    let patch = fs::read_to_string(repo.join(&patch_artifact)).expect("read patch");
    assert!(fix_plan.contains("Update README wording from the review."));
    assert!(fix_plan.contains("Apply the proposed README wording fix."));
    assert!(patch.contains("+new"));

    let report = fs::read_to_string(&result.report_path).expect("read report");
    assert!(report.contains("proposed_patch:"));
    assert!(report.contains("available: true"));
    assert!(report.contains(&fix_plan_artifact));
    assert!(report.contains(&patch_artifact));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let reviews = ledger
        .list_semantic_reviews(&attempt.id)
        .expect("semantic reviews");
    assert_eq!(reviews.len(), 1);
    assert!(reviews[0].proposed_patch_available);
    assert_eq!(
        reviews[0].fix_plan_artifact.as_deref(),
        Some(fix_plan_artifact.as_str())
    );
    assert_eq!(
        reviews[0].patch_artifact.as_deref(),
        Some(patch_artifact.as_str())
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_input_includes_applied_and_queued_manifests() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);
    let applied = seed_enqueued_candidate(&repo, "session-applied-context");
    mark_seeded_candidate_applied(&repo, &applied);
    seed_enqueued_candidate(&repo, "session-queued-context");

    let result = run_review_with_adapter(
        &ReviewOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &RelatedManifestSemanticReviewAdapter,
    )
    .expect("review");

    assert_eq!(result.semantic_review.risk_level, SemanticRiskLevel::Low);
    assert_eq!(result.summary, "Related manifests were included.");

    let input_path = result
        .report_path
        .with_file_name(format!("{}-input.md", result.semantic_review.id));
    let input = fs::read_to_string(input_path).expect("read input");
    assert!(input.contains("## Related Change Manifests"));
    assert!(input.contains("### Applied Manifest: session-applied-context"));
    assert!(input.contains("### Queued Manifest: session-queued-context"));
    assert!(input.contains("session-applied-context"));
    assert!(input.contains("session-queued-context"));
    assert!(!input.contains("### Queued Manifest: session-review"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_runs_configured_command_semantic_adapter() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let command = write_semantic_review_test_command(
        &repo,
        "mock-semantic-review",
        r#"$inputText = [Console]::In.ReadToEnd()
if (-not $inputText.Contains('Semantic Review Input')) {
  [Console]::Error.WriteLine('missing semantic review input')
  exit 2
}
if (-not $inputText.Contains('## Patch Context')) {
  [Console]::Error.WriteLine('missing patch context')
  exit 3
}
if (-not $inputText.Contains('+review candidate change')) {
  [Console]::Error.WriteLine('missing patch hunk')
  exit 4
}
@'
semantic_review:
  risk_level: low
  summary: "Scripted command reviewer accepted the candidate."
  suspected_conflicts: []
  required_actions: []
  suggested_tests:
    - "cargo test --all"
  uncertainty: []
'@
"#,
        r###"input=$(cat)
case "$input" in
  *"Semantic Review Input"*) ;;
  *) echo "missing semantic review input" >&2; exit 2 ;;
esac
case "$input" in
  *"## Patch Context"*) ;;
  *) echo "missing patch context" >&2; exit 3 ;;
esac
case "$input" in
  *"+review candidate change"*) ;;
  *) echo "missing patch hunk" >&2; exit 4 ;;
esac
cat <<'YAML'
semantic_review:
  risk_level: low
  summary: "Scripted command reviewer accepted the candidate."
  suspected_conflicts: []
  required_actions: []
  suggested_tests:
    - "cargo test --all"
  uncertainty: []
YAML
"###,
    );
    configure_semantic_review_command(&repo, "scripted_command_reviewer", &command);
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let result = run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");

    assert_eq!(result.semantic_review.risk_level, SemanticRiskLevel::Low);
    assert!(!result.blocked);
    assert_eq!(
        result.summary,
        "Scripted command reviewer accepted the candidate."
    );
    assert_eq!(result.suggested_tests, vec!["cargo test --all".to_string()]);

    let report = fs::read_to_string(&result.report_path).expect("read report");
    assert!(report.contains("reviewer: \"scripted_command_reviewer\""));
    assert!(report.contains("llm_executed: true"));
    assert!(report.contains("risk_level: \"low\""));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.semantic_review.completed"
            && event
                .data_json
                .contains("\"reviewer\":\"scripted_command_reviewer\"")
            && event.data_json.contains("\"llm_executed\":true")
    }));
    assert_eq!(
        ledger
            .list_semantic_reviews(&attempt.id)
            .expect("semantic reviews")
            .len(),
        1
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_cli_shows_proposed_patch_next_actions() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let command = write_semantic_review_test_command(
        &repo,
        "proposed-semantic-review",
        r#"[Console]::In.ReadToEnd() | Out-Null
@'
semantic_review:
  risk_level: low
  summary: "Proposed patch is available."
  suspected_conflicts: []
  required_actions:
    - "Apply suggested README change."
  suggested_tests: []
  proposed_patch:
    available: true
    description: "Update README text."
    patch: |
      diff --git a/README.md b/README.md
      @@ -1 +1 @@
      -old
      +new
  uncertainty: []
'@
"#,
        r#"cat >/dev/null
cat <<'YAML'
semantic_review:
  risk_level: low
  summary: "Proposed patch is available."
  suspected_conflicts: []
  required_actions:
    - "Apply suggested README change."
  suggested_tests: []
  proposed_patch:
    available: true
    description: "Update README text."
    patch: |
      diff --git a/README.md b/README.md
      @@ -1 +1 @@
      -old
      +new
  uncertainty: []
YAML
"#,
    );
    configure_semantic_review_command(&repo, "proposed_command_reviewer", &command);
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let mut output = Vec::new();
    run_with_cwd(["aich", "review", &session.id], &repo, &mut output).expect("review");
    let output = String::from_utf8(output).expect("utf8 output");

    assert!(output.contains("Proposed patch: available"));
    assert!(output.contains("Fix plan: .aichestra/artifacts/merge-attempts/"));
    assert!(output.contains("Patch artifact: .aichestra/artifacts/merge-attempts/"));
    assert!(output.contains(&format!(
        "Next: aich session rework {} --review semantic-review-",
        session.id
    )));
    assert!(output.contains(&format!(
        "Or approve current verified tree: aich approve {} --accept-current",
        session.id
    )));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_runs_configured_llm_semantic_adapter_with_custom_command() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let command = write_semantic_review_test_command(
        &repo,
        "mock-llm-semantic-review",
        r#"$inputText = [Console]::In.ReadToEnd()
if (-not $inputText.Contains('reviewer: `custom_llm_reviewer`')) {
  [Console]::Error.WriteLine('missing llm reviewer input')
  exit 2
}
if (-not (Get-Location).Path.Contains('aich-cli-test-')) {
  [Console]::Error.WriteLine('command did not run from repo root')
  exit 3
}
@'
semantic_review:
  risk_level: low
  summary: "Custom LLM reviewer accepted the candidate."
  suspected_conflicts: []
  required_actions: []
  suggested_tests:
    - "cargo test --all"
  uncertainty:
    - "Custom command stands in for a provider LLM in this test."
'@
"#,
        r#"input=$(cat)
case "$input" in
  *"reviewer: \`custom_llm_reviewer\`"*) ;;
  *) echo "missing llm reviewer input" >&2; exit 2 ;;
esac
case "$(pwd)" in
  *aich-cli-test-*) ;;
  *) echo "command did not run from repo root" >&2; exit 3 ;;
esac
cat <<'YAML'
semantic_review:
  risk_level: low
  summary: "Custom LLM reviewer accepted the candidate."
  suspected_conflicts: []
  required_actions: []
  suggested_tests:
    - "cargo test --all"
  uncertainty:
    - "Custom command stands in for a provider LLM in this test."
YAML
"#,
    );
    configure_semantic_review_llm(&repo, "custom_llm_reviewer", "custom", &command);
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let result = run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");

    assert_eq!(result.semantic_review.risk_level, SemanticRiskLevel::Low);
    assert!(!result.blocked);
    assert_eq!(
        result.summary,
        "Custom LLM reviewer accepted the candidate."
    );
    assert_eq!(result.suggested_tests, vec!["cargo test --all".to_string()]);

    let report = fs::read_to_string(&result.report_path).expect("read report");
    assert!(report.contains("reviewer: \"custom_llm_reviewer\""));
    assert!(report.contains("llm_executed: true"));
    assert!(report.contains("risk_level: \"low\""));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.semantic_review.completed"
            && event
                .data_json
                .contains("\"reviewer\":\"custom_llm_reviewer\"")
            && event.data_json.contains("\"llm_executed\":true")
    }));
    assert_eq!(
        ledger
            .list_semantic_reviews(&attempt.id)
            .expect("semantic reviews")
            .len(),
        1
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_blocks_when_llm_adapter_returns_prose_instead_of_yaml() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let command = write_semantic_review_test_command(
        &repo,
        "prose-llm-semantic-review",
        r#"[Console]::In.ReadToEnd() | Out-Null
[Console]::Out.WriteLine('The candidate looks fine, but this is not YAML.')
"#,
        r#"cat >/dev/null
printf '%s\n' 'The candidate looks fine, but this is not YAML.'
"#,
    );
    configure_semantic_review_llm(&repo, "prose_llm_reviewer", "custom", &command);
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let result = run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");

    assert_eq!(
        result.semantic_review.risk_level,
        SemanticRiskLevel::Blocked
    );
    assert!(result.blocked);
    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Blocked);
    assert!(result
        .summary
        .contains("Semantic review LLM adapter returned an invalid report"));

    let report = fs::read_to_string(&result.report_path).expect("read report");
    assert!(report.contains("reviewer: \"prose_llm_reviewer\""));
    assert!(report.contains("llm_reviewer_failure"));
    assert!(report.contains("missing semantic_review root"));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert_eq!(
        ledger
            .list_semantic_reviews(&attempt.id)
            .expect("semantic reviews")
            .len(),
        1
    );
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.blocked" && event.data_json.contains("semantic_review")
    }));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_blocks_when_llm_adapter_exits_nonzero() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let command = write_semantic_review_test_command(
        &repo,
        "failing-llm-semantic-review",
        r#"[Console]::In.ReadToEnd() | Out-Null
[Console]::Error.WriteLine('provider failed before YAML')
exit 9
"#,
        r#"cat >/dev/null
printf '%s\n' 'provider failed before YAML' >&2
exit 9
"#,
    );
    configure_semantic_review_llm(&repo, "failing_llm_reviewer", "custom", &command);
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let result = run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");

    assert_eq!(
        result.semantic_review.risk_level,
        SemanticRiskLevel::Blocked
    );
    assert!(result.blocked);
    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Blocked);
    assert!(result
        .summary
        .contains("Semantic review LLM adapter exited with a non-zero status"));

    let report = fs::read_to_string(&result.report_path).expect("read report");
    assert!(report.contains("llm_reviewer_failure"));
    assert!(report.contains("provider failed before YAML"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_blocks_when_llm_adapter_times_out() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let command = write_semantic_review_test_command(
        &repo,
        "timeout-llm-semantic-review",
        r#"while ($true) {
  Start-Sleep -Milliseconds 100
}
"#,
        r#"while :; do :; done
"#,
    );
    configure_semantic_review_llm_with_timeout(
        &repo,
        "timeout_llm_reviewer",
        "custom",
        &command,
        50,
    );
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let result = run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");

    assert_eq!(
        result.semantic_review.risk_level,
        SemanticRiskLevel::Blocked
    );
    assert!(result.blocked);
    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Blocked);
    assert!(result
        .summary
        .contains("Semantic review LLM adapter could not run"));

    let report = fs::read_to_string(&result.report_path).expect("read report");
    assert!(report.contains("llm_reviewer_failure"));
    assert!(report.contains("timed out after 50ms"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn review_blocks_when_command_adapter_returns_invalid_report() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let command = write_semantic_review_test_command(
        &repo,
        "invalid-semantic-review",
        r#"[Console]::In.ReadToEnd() | Out-Null
@'
semantic_review:
  summary: "missing risk"
'@
"#,
        "cat >/dev/null\nprintf '%s\\n' 'semantic_review:' '  summary: \"missing risk\"'\n",
    );
    configure_semantic_review_command(&repo, "invalid_command_reviewer", &command);
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);

    let result = run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");

    assert_eq!(
        result.semantic_review.risk_level,
        SemanticRiskLevel::Blocked
    );
    assert!(result.blocked);
    assert_eq!(result.merge_attempt.status, MergeAttemptStatus::Blocked);
    assert!(result
        .summary
        .contains("Semantic review command returned an invalid report"));
    assert!(result
        .required_actions
        .iter()
        .any(|action| action.contains("semantic_review.command")));

    let report = fs::read_to_string(&result.report_path).expect("read report");
    assert!(report.contains("reviewer: \"invalid_command_reviewer\""));
    assert!(report.contains("reviewer_failure"));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.blocked" && event.data_json.contains("semantic_review")
    }));
    assert_eq!(
        ledger
            .list_semantic_reviews(&attempt.id)
            .expect("semantic reviews")
            .len(),
        1
    );

    let _ = fs::remove_dir_all(repo);
}
