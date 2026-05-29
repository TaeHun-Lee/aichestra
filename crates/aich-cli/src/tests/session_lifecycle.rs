use super::*;

#[test]
fn session_start_records_session_worktree_request_and_events() {
    let repo = unique_temp_dir();
    let init_options = InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    };
    init_repo(&init_options).expect("init");

    let options = SessionStartOptions {
        repo_root: repo.clone(),
        db_path: None,
        goal: "add auth guard".to_string(),
        provider: "codex".to_string(),
        target_path: Some("src/auth.rs".to_string()),
        operator_id: None,
    };
    let git = MockGitRepository;
    let worktrees = MockWorktreeManager::new();

    let result = start_session_with(&options, &git, &worktrees).expect("start session");

    assert_eq!(result.session.goal, "add auth guard");
    assert_eq!(result.session.provider, "codex");
    assert_eq!(result.operator.id, DEFAULT_OPERATOR_ID);
    assert_eq!(result.session.target_path.as_deref(), Some("src/auth.rs"));
    assert_eq!(result.session.status, SessionStatus::Running);
    assert_eq!(result.session.base_commit, "base-commit");
    assert!(result.session.branch.starts_with("aich/session/session-"));
    assert_ne!(PathBuf::from(&result.session.worktree_path), repo);

    let requests = worktrees.requests.borrow();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].session_id, result.session.id);
    assert_eq!(requests[0].base_ref, "base-commit");

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let sessions = ledger.list_sessions().expect("list sessions");
    assert_eq!(sessions.len(), 1);
    assert_eq!(sessions[0].status, SessionStatus::Running);

    let event_names: Vec<String> = ledger
        .list_events()
        .expect("list events")
        .into_iter()
        .map(|event| event.name)
        .collect();
    assert_eq!(
        event_names,
        vec![
            "repo.initialized",
            "session.created",
            "worktree.created",
            "session.started"
        ]
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_start_reads_base_from_configured_main_ref() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    configure_main_branch(&repo, "trunk");

    let options = SessionStartOptions {
        repo_root: repo.clone(),
        db_path: None,
        goal: "use configured main".to_string(),
        provider: "codex".to_string(),
        target_path: None,
        operator_id: None,
    };
    let git = RecordingGitRepository::new("trunk-base");
    let worktrees = MockWorktreeManager::new();

    let result = start_session_with(&options, &git, &worktrees).expect("start session");

    assert_eq!(result.session.base_commit, "trunk-base");
    assert_eq!(worktrees.requests.borrow()[0].base_ref, "trunk-base");
    assert_eq!(
        git.refs.borrow().as_slice(),
        &["refs/heads/trunk".to_string()]
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_start_reads_branch_prefix_from_config() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    configure_session_branch_prefix(&repo, "custom/sessions/");

    let options = SessionStartOptions {
        repo_root: repo.clone(),
        db_path: None,
        goal: "use configured branch prefix".to_string(),
        provider: "codex".to_string(),
        target_path: None,
        operator_id: None,
    };
    let git = MockGitRepository;
    let worktrees = MockWorktreeManager::new();

    let result = start_session_with(&options, &git, &worktrees).expect("start session");

    assert!(result
        .session
        .branch
        .starts_with("custom/sessions/session-"));
    assert_eq!(worktrees.requests.borrow()[0].branch, result.session.branch);

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_start_records_requested_operator_in_events() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let operator = Operator::new(
        "alice",
        "Alice Maintainer",
        OperatorRole::Maintainer,
        now_millis(),
    )
    .expect("operator");
    ledger.upsert_operator(&operator).expect("upsert operator");

    let options = SessionStartOptions {
        repo_root: repo.clone(),
        db_path: None,
        goal: "wire operator audit".to_string(),
        provider: "codex".to_string(),
        target_path: None,
        operator_id: Some("alice".to_string()),
    };
    let git = MockGitRepository;
    let worktrees = MockWorktreeManager::new();

    let result = start_session_with(&options, &git, &worktrees).expect("start session");
    assert_eq!(result.operator.id, "alice");

    let events = ledger.list_events().expect("list events");
    assert!(events.iter().any(|event| event.name == "session.created"
        && event.data_json.contains("\"operator_id\":\"alice\"")));
    assert!(events.iter().any(|event| event.name == "session.started"
        && event.data_json.contains("\"operator_id\":\"alice\"")));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_run_executes_provider_in_session_worktree_and_records_artifacts() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let command = write_agent_test_command(
        &repo,
        "agent-success",
        r#"$inputText = [Console]::In.ReadToEnd()
Set-Content -LiteralPath "agent-input.txt" -Value $inputText -NoNewline -Encoding UTF8
Set-Content -LiteralPath "agent-cwd.txt" -Value (Get-Location).Path -NoNewline -Encoding UTF8
Set-Content -LiteralPath "agent-marker.txt" -Value "ran" -NoNewline -Encoding UTF8
[Console]::Out.WriteLine("agent stdout")
[Console]::Error.WriteLine("agent stderr")
"#,
        r#"cat > agent-input.txt
pwd > agent-cwd.txt
printf 'ran' > agent-marker.txt
printf 'agent stdout\n'
printf 'agent stderr\n' >&2
"#,
    );
    configure_provider_command(&repo, "test-agent", &command);
    let session = seed_running_agent_session(&repo, "session-agent-run", "test-agent");

    let result = run_session_agent_with(&SessionRunOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("session run");

    let worktree_path = repo.join(".aichestra/worktrees").join(&session.id);
    assert!(result.success);
    assert_eq!(result.provider, "test-agent");
    assert_eq!(result.exit_code, Some(0));
    assert!(result.artifact_dir.is_dir());
    assert!(fs::read_to_string(&result.input_path)
        .expect("input artifact")
        .contains("Session ID: session-agent-run"));
    assert!(fs::read_to_string(&result.stdout_path)
        .expect("stdout artifact")
        .contains("agent stdout"));
    assert!(fs::read_to_string(&result.stderr_path)
        .expect("stderr artifact")
        .contains("agent stderr"));
    assert!(fs::read_to_string(&result.metadata_path)
        .expect("metadata artifact")
        .contains("\"exit_code\":0"));
    assert!(fs::read_to_string(worktree_path.join("agent-input.txt"))
        .expect("agent input")
        .contains("Goal: agent task session-agent-run"));
    assert!(fs::read_to_string(worktree_path.join("agent-marker.txt"))
        .expect("marker")
        .contains("ran"));
    assert!(!repo.join("agent-marker.txt").exists());

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let events = ledger.list_events().expect("events");
    assert!(events
        .iter()
        .any(|event| event.name == "session.agent.started"));
    assert!(events
        .iter()
        .any(|event| event.name == "session.agent.completed"));
    assert!(!events
        .iter()
        .any(|event| event.name == "session.agent.failed"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_run_records_failed_provider_artifacts_and_event() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let command = write_agent_test_command(
        &repo,
        "agent-fail",
        r#"[Console]::Error.WriteLine("agent failed")
exit 7
"#,
        r#"printf 'agent failed\n' >&2
exit 7
"#,
    );
    configure_provider_command(&repo, "test-agent", &command);
    let session = seed_running_agent_session(&repo, "session-agent-fail", "test-agent");

    let err = run_session_agent_with(&SessionRunOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .unwrap_err();

    assert!(
        matches!(err, CliError::Usage(message) if message.contains("session agent command exited"))
    );
    let runs_dir = repo
        .join(".aichestra/artifacts/sessions")
        .join(&session.id)
        .join("runs");
    let run_dirs: Vec<PathBuf> = fs::read_dir(&runs_dir)
        .expect("runs dir")
        .map(|entry| entry.expect("run dir").path())
        .collect();
    assert_eq!(run_dirs.len(), 1);
    assert!(fs::read_to_string(run_dirs[0].join("stderr.txt"))
        .expect("stderr artifact")
        .contains("agent failed"));
    assert!(fs::read_to_string(run_dirs[0].join("metadata.json"))
        .expect("metadata artifact")
        .contains("\"exit_code\":7"));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger
        .list_events()
        .expect("events")
        .iter()
        .any(|event| event.name == "session.agent.failed"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_complete_records_patchset_manifest_and_enqueues_session() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");

    let start_options = SessionStartOptions {
        repo_root: repo.clone(),
        db_path: None,
        goal: "capture completion".to_string(),
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
                symbols_json: "[\"run\"]".to_string(),
            }],
            committed_worktree_changes: true,
        },
    ));

    let result = complete_session_with(&complete_options, &completer).expect("complete session");

    assert_eq!(result.session.status, SessionStatus::Enqueued);
    assert_eq!(result.session.head_commit.as_deref(), Some("head-commit"));
    assert_eq!(result.changed_files.len(), 1);
    assert!(result.patch_set.is_some());
    assert!(result.context_snapshot.is_some());
    assert!(result.change_manifest.is_some());
    let manifest_path = result.manifest_path.expect("manifest path");
    assert!(manifest_path.exists());
    let manifest = fs::read_to_string(&manifest_path).expect("read manifest");
    assert!(manifest.contains("session_id:"));
    assert!(manifest.contains("src/lib.rs"));
    assert!(manifest.contains("- \"run\""));
    assert!(manifest.contains(CHANGE_MANIFEST_VALIDATION_STATUS));

    let requests = completer.requests.borrow();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].session_id, session.id);
    assert_eq!(requests[0].session_branch, session.branch);
    assert_eq!(requests[0].main_branch, "main");
    assert_eq!(requests[0].base_commit, "base-commit");

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let loaded = ledger
        .get_session(&session.id)
        .expect("get session")
        .expect("session exists");
    assert_eq!(loaded.status, SessionStatus::Enqueued);
    assert_eq!(loaded.head_commit.as_deref(), Some("head-commit"));

    let patch_sets = ledger.list_patch_sets(&session.id).expect("patch sets");
    assert_eq!(patch_sets.len(), 1);
    let changed_files = ledger
        .list_changed_files(&patch_sets[0].id)
        .expect("changed files");
    assert_eq!(changed_files[0].path, "src/lib.rs");
    assert_eq!(changed_files[0].change_type, "modified");
    assert_eq!(changed_files[0].symbols_json, "[\"run\"]");
    assert_eq!(
        ledger
            .list_context_snapshots(&session.id)
            .expect("context snapshots")
            .len(),
        1
    );
    assert_eq!(
        ledger
            .list_change_manifests(&session.id)
            .expect("change manifests")
            .len(),
        1
    );

    let event_names: Vec<String> = ledger
        .list_events()
        .expect("list events")
        .into_iter()
        .map(|event| event.name)
        .collect();
    assert!(event_names.contains(&"files.changed".to_string()));
    assert!(event_names.contains(&"patchset.created".to_string()));
    assert!(event_names.contains(&"context.snapshot.created".to_string()));
    assert!(event_names.contains(&"manifest.created".to_string()));
    assert!(event_names.contains(&"manifest.validated".to_string()));
    assert!(event_names.contains(&"session.completed".to_string()));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_complete_uses_command_manifest_adapter_and_preserves_trusted_evidence() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let command = write_agent_test_command(
        &repo,
        "manifest-command-success",
        r#"$inputText = [Console]::In.ReadToEnd()
if (-not $inputText.Contains('Generated Manifest Draft')) {
  [Console]::Error.WriteLine('missing generated draft')
  exit 2
}
if (-not $inputText.Contains('agent stdout for manifest')) {
  [Console]::Error.WriteLine('missing agent stdout')
  exit 3
}
@'
change_manifest:
  session_id: "wrong-session"
  goal: "wrong goal"
  provider: "wrong-provider"
  branch: "wrong-branch"
  base_commit: "wrong-base"
  head_commit: "wrong-head"
  patch_id: "wrong-patch"
  intent:
    summary: "Command manifest summary"
    reason: "The command adapter used actual diff and agent artifacts."
    expected_behavior:
      - "run symbol is documented"
    non_goals: []
  changed_areas:
    - file: "src/lib.rs"
      change_type: "modified"
      symbols:
        - "run"
      purpose: "Document the run symbol."
      semantic_impact: "No public behavior change."
      before: "old docs"
      after: "new docs"
  newly_created_files: []
  deleted_or_renamed_files: []
  compatibility_notes:
    breaking_change: false
    migration_required: []
    backward_compatibility: "compatible"
  tests:
    added: []
    executed:
      - command: "not run"
        result: "skipped"
        output_artifact: ""
  risks:
    level: "low"
    items: []
  uncertainty: []
  evidence:
    diff_stat_artifact: "wrong-stat"
    diff_patch_artifact: "wrong-patch"
    context_snapshot_hash: "wrong-context"
    validation_status: "wrong-status"
'@
"#,
        r#"input=$(cat)
case "$input" in
  *"Generated Manifest Draft"*) ;;
  *) echo "missing generated draft" >&2; exit 2 ;;
esac
case "$input" in
  *"agent stdout for manifest"*) ;;
  *) echo "missing agent stdout" >&2; exit 3 ;;
esac
cat <<'YAML'
change_manifest:
  session_id: "wrong-session"
  goal: "wrong goal"
  provider: "wrong-provider"
  branch: "wrong-branch"
  base_commit: "wrong-base"
  head_commit: "wrong-head"
  patch_id: "wrong-patch"
  intent:
    summary: "Command manifest summary"
    reason: "The command adapter used actual diff and agent artifacts."
    expected_behavior:
      - "run symbol is documented"
    non_goals: []
  changed_areas:
    - file: "src/lib.rs"
      change_type: "modified"
      symbols:
        - "run"
      purpose: "Document the run symbol."
      semantic_impact: "No public behavior change."
      before: "old docs"
      after: "new docs"
  newly_created_files: []
  deleted_or_renamed_files: []
  compatibility_notes:
    breaking_change: false
    migration_required: []
    backward_compatibility: "compatible"
  tests:
    added: []
    executed:
      - command: "not run"
        result: "skipped"
        output_artifact: ""
  risks:
    level: "low"
    items: []
  uncertainty: []
  evidence:
    diff_stat_artifact: "wrong-stat"
    diff_patch_artifact: "wrong-patch"
    context_snapshot_hash: "wrong-context"
    validation_status: "wrong-status"
YAML
"#,
    );
    configure_manifest_command(&repo, "command_manifest_tester", &command);

    let start_options = SessionStartOptions {
        repo_root: repo.clone(),
        db_path: None,
        goal: "capture command manifest".to_string(),
        provider: "codex".to_string(),
        target_path: Some("src/lib.rs".to_string()),
        operator_id: None,
    };
    let git = MockGitRepository;
    let worktrees = MockWorktreeManager::new();
    let session = start_session_with(&start_options, &git, &worktrees)
        .expect("start session")
        .session;

    let run_dir = repo
        .join(".aichestra/artifacts/sessions")
        .join(&session.id)
        .join("runs")
        .join("999-manifest-test");
    fs::create_dir_all(&run_dir).expect("create fake agent run dir");
    fs::write(run_dir.join("input.md"), "agent input").expect("write run input");
    fs::write(run_dir.join("stdout.txt"), "agent stdout for manifest").expect("write stdout");
    fs::write(run_dir.join("stderr.txt"), "").expect("write stderr");
    fs::write(run_dir.join("metadata.json"), "{}").expect("write metadata");

    let result = complete_session_with(
        &SessionCompleteOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockSessionCompleter::new(CompleteSessionWorktreeOutcome::Changes(
            aich_git::CompletedSessionWorktree {
                head_commit: "head-commit".to_string(),
                diff_stat: " src/lib.rs | 1 +\n 1 file changed, 1 insertion(+)\n".to_string(),
                diff_patch: "diff --git a/src/lib.rs b/src/lib.rs\n+pub fn run() {}\n".to_string(),
                changed_files: vec![aich_git::GitChangedFile {
                    path: "src/lib.rs".to_string(),
                    change_type: "modified".to_string(),
                    symbols_json: "[\"run\"]".to_string(),
                }],
                committed_worktree_changes: true,
            },
        )),
    )
    .expect("complete session with command manifest");

    let manifest = result.change_manifest.expect("manifest");
    assert_eq!(manifest.validation_status, CHANGE_MANIFEST_COMMAND_STATUS);
    let manifest_path = result.manifest_path.expect("manifest path");
    let content = fs::read_to_string(&manifest_path).expect("read manifest");
    assert!(content.contains("summary: Command manifest summary"));
    assert!(content.contains(&format!("session_id: {}", session.id)));
    assert!(content.contains("goal: capture command manifest"));
    assert!(content.contains("provider: codex"));
    assert!(content.contains("base_commit: base-commit"));
    assert!(content.contains("head_commit: head-commit"));
    assert!(content.contains("validation_status: generated_by_command"));
    assert!(content.contains("generator_id: command_manifest_tester"));
    assert!(content.contains("generator_adapter: command"));
    assert!(content.contains("diff_stat_artifact: .aichestra/artifacts/sessions/"));
    assert!(content.contains("diff_patch_artifact: .aichestra/artifacts/sessions/"));
    assert!(content.contains("src/lib.rs"));
    assert!(!content.contains("wrong-head"));
    assert!(!content.contains("wrong-context"));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let loaded_manifest = ledger
        .list_change_manifests(&session.id)
        .expect("list manifests")
        .pop()
        .expect("manifest row");
    assert_eq!(
        loaded_manifest.validation_status,
        CHANGE_MANIFEST_COMMAND_STATUS
    );
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "manifest.validated"
            && event
                .data_json
                .contains("\"validation_status\":\"generated_by_command\"")
    }));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_complete_refuses_provider_manifest_that_omits_changed_files() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let command = write_agent_test_command(
        &repo,
        "manifest-command-missing-file",
        r#"@'
change_manifest:
  intent:
    summary: "missing files"
  changed_areas: []
  newly_created_files: []
  deleted_or_renamed_files: []
'@
"#,
        r#"cat <<'YAML'
change_manifest:
  intent:
    summary: "missing files"
  changed_areas: []
  newly_created_files: []
  deleted_or_renamed_files: []
YAML
"#,
    );
    configure_manifest_command(&repo, "bad_manifest_tester", &command);

    let session = start_session_with(
        &SessionStartOptions {
            repo_root: repo.clone(),
            db_path: None,
            goal: "bad manifest".to_string(),
            provider: "codex".to_string(),
            target_path: Some("src/lib.rs".to_string()),
            operator_id: None,
        },
        &MockGitRepository,
        &MockWorktreeManager::new(),
    )
    .expect("start session")
    .session;

    let err = complete_session_with(
        &SessionCompleteOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockSessionCompleter::new(CompleteSessionWorktreeOutcome::Changes(
            aich_git::CompletedSessionWorktree {
                head_commit: "head-commit".to_string(),
                diff_stat: " src/lib.rs | 1 +\n 1 file changed, 1 insertion(+)\n".to_string(),
                diff_patch: "diff --git a/src/lib.rs b/src/lib.rs\n+pub fn run() {}\n".to_string(),
                changed_files: vec![aich_git::GitChangedFile {
                    path: "src/lib.rs".to_string(),
                    change_type: "modified".to_string(),
                    symbols_json: "[\"run\"]".to_string(),
                }],
                committed_worktree_changes: true,
            },
        )),
    )
    .unwrap_err();

    assert!(
        matches!(err, CliError::Usage(message) if message.contains("missing changed file(s)") && message.contains("src/lib.rs"))
    );
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let loaded = ledger
        .get_session(&session.id)
        .expect("get session")
        .expect("session exists");
    assert_eq!(loaded.status, SessionStatus::Running);
    assert_eq!(
        ledger
            .list_change_manifests(&session.id)
            .expect("list manifests")
            .len(),
        0
    );

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_complete_marks_noop_when_no_changes_exist() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");

    let start_options = SessionStartOptions {
        repo_root: repo.clone(),
        db_path: None,
        goal: "no-op task".to_string(),
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
    let completer = MockSessionCompleter::new(CompleteSessionWorktreeOutcome::NoChanges {
        head_commit: "base-commit".to_string(),
    });

    let result = complete_session_with(&complete_options, &completer).expect("complete session");
    assert_eq!(result.session.status, SessionStatus::Noop);
    assert!(result.patch_set.is_none());
    assert!(result.change_manifest.is_none());

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let loaded = ledger
        .get_session(&session.id)
        .expect("get session")
        .expect("session exists");
    assert_eq!(loaded.status, SessionStatus::Noop);
    assert_eq!(
        ledger
            .list_patch_sets(&session.id)
            .expect("patch sets")
            .len(),
        0
    );
    assert_eq!(
        ledger
            .list_change_manifests(&session.id)
            .expect("change manifests")
            .len(),
        0
    );
    assert!(ledger
        .list_events()
        .expect("events")
        .iter()
        .any(|event| event.name == "session.completed"
            && event.data_json.contains("\"no_changes\":true")));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_reopen_returns_rejected_candidate_to_running_state() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);
    let worktree_path = repo.join(&session.worktree_path);
    fs::create_dir_all(&worktree_path).expect("create worktree");
    run_review_with(&ReviewOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("review");
    run_reject_with(&RejectOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
        reason: "Needs another pass before merge.".to_string(),
    })
    .expect("reject");

    let reopened = reopen_session_with(&SessionReopenOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("reopen");

    assert_eq!(reopened.previous_status, "enqueued");
    assert_eq!(reopened.session.status, SessionStatus::Running);
    assert_eq!(reopened.latest_attempt.id, attempt.id);

    let completed = complete_session_with(
        &SessionCompleteOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockSessionCompleter::new(CompleteSessionWorktreeOutcome::Changes(
            aich_git::CompletedSessionWorktree {
                head_commit: "reopened-head".to_string(),
                diff_stat: " README.md | 1 +\n 1 file changed, 1 insertion(+)\n".to_string(),
                diff_patch: "diff --git a/README.md b/README.md\n+reopened\n".to_string(),
                changed_files: vec![aich_git::GitChangedFile {
                    path: "README.md".to_string(),
                    change_type: "modified".to_string(),
                    symbols_json: "[]".to_string(),
                }],
                committed_worktree_changes: true,
            },
        )),
    )
    .expect("complete reopened session");
    assert_eq!(completed.session.status, SessionStatus::Enqueued);

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger
        .list_events()
        .expect("events")
        .iter()
        .any(|event| event.name == "session.reopened"));

    let mut queue = Vec::new();
    render_queue(
        &QueueOptions {
            repo_root: repo.clone(),
            db_path: None,
        },
        &mut queue,
    )
    .expect("queue");
    let queue = String::from_utf8(queue).expect("utf8 queue");
    assert!(queue.contains(&format!("- {} [enqueued]", session.id)));
    assert!(queue.contains(&format!("next: aich preflight {}", session.id)));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_rework_runs_provider_with_fix_artifacts_and_requires_new_completion() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, attempt) = seed_verified_review_candidate(&repo, "README.md", true);
    let worktree_path = repo.join(&session.worktree_path);
    fs::create_dir_all(&worktree_path).expect("create worktree");
    let review_result = run_review_with_adapter(
        &ReviewOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &ProposedPatchSemanticReviewAdapter,
    )
    .expect("review");
    let command = write_agent_test_command(
        &repo,
        "rework-provider",
        r#"$inputText = [Console]::In.ReadToEnd()
if (-not $inputText.Contains('## Fix Plan Artifact')) {
  [Console]::Error.WriteLine('missing fix plan')
  exit 2
}
if (-not $inputText.Contains('## Proposed Patch Artifact')) {
  [Console]::Error.WriteLine('missing patch artifact')
  exit 3
}
Set-Content -Path reworked.txt -Value 'reworked'
"#,
        r###"input=$(cat)
case "$input" in
  *"## Fix Plan Artifact"*) ;;
  *) echo "missing fix plan" >&2; exit 2 ;;
esac
case "$input" in
  *"## Proposed Patch Artifact"*) ;;
  *) echo "missing patch artifact" >&2; exit 3 ;;
esac
printf '%s\n' reworked > reworked.txt
"###,
    );
    configure_provider_command(&repo, "codex", &command);

    let result = run_session_rework_with(&SessionReworkOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        review_id: review_result.semantic_review.id.clone(),
        operator_id: None,
    })
    .expect("rework");

    assert!(result.success);
    assert_eq!(result.session.status, SessionStatus::Running);
    assert!(worktree_path.join("reworked.txt").exists());
    let input = fs::read_to_string(&result.input_path).expect("read rework input");
    assert!(input.contains("Apply the proposed README wording fix."));
    assert!(input.contains("+new"));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let blocked_attempt = ledger
        .get_merge_attempt(&attempt.id)
        .expect("get attempt")
        .expect("attempt exists");
    assert_eq!(blocked_attempt.status, MergeAttemptStatus::Blocked);
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "session.rework.completed"
            && event.data_json.contains(&review_result.semantic_review.id)
    }));

    let err = run_approve_with(
        &ApproveOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
            accept_current: true,
        },
        &MockGitRepository,
    )
    .unwrap_err();
    assert!(
        matches!(err, CliError::Usage(message) if message.contains("not verified") || message.contains("blocked"))
    );

    let completed = complete_session_with(
        &SessionCompleteOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockSessionCompleter::new(CompleteSessionWorktreeOutcome::Changes(
            aich_git::CompletedSessionWorktree {
                head_commit: "reworked-head".to_string(),
                diff_stat: " README.md | 1 +\n 1 file changed, 1 insertion(+)\n".to_string(),
                diff_patch: "diff --git a/README.md b/README.md\n+reworked\n".to_string(),
                changed_files: vec![aich_git::GitChangedFile {
                    path: "README.md".to_string(),
                    change_type: "modified".to_string(),
                    symbols_json: "[]".to_string(),
                }],
                committed_worktree_changes: true,
            },
        )),
    )
    .expect("complete after rework");
    assert_eq!(completed.session.status, SessionStatus::Enqueued);

    let mut queue = Vec::new();
    render_queue(
        &QueueOptions {
            repo_root: repo.clone(),
            db_path: None,
        },
        &mut queue,
    )
    .expect("queue");
    let queue = String::from_utf8(queue).expect("utf8 queue");
    assert!(queue.contains(&format!("- {} [enqueued]", session.id)));
    assert!(queue.contains(&format!("next: aich preflight {}", session.id)));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_abandon_marks_candidate_abandoned_and_removes_from_queue() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let session = seed_enqueued_candidate(&repo, "session-abandon");

    let result = abandon_session_with(&SessionAbandonOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("abandon");

    assert_eq!(result.session.id, session.id);
    assert_eq!(result.previous_status, "enqueued");
    assert_eq!(result.session.status, SessionStatus::Abandoned);
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert_eq!(
        ledger
            .get_session(&session.id)
            .expect("load session")
            .expect("session")
            .status,
        SessionStatus::Abandoned
    );
    assert!(ledger
        .list_events()
        .expect("events")
        .iter()
        .any(|event| event.name == "session.abandoned"
            && event.subject_id.as_deref() == Some(session.id.as_str())));

    let mut output = Vec::new();
    run_with_cwd(["aich", "queue"], &repo, &mut output).expect("queue");
    let output = String::from_utf8(output).expect("utf8 output");
    assert!(output.contains("No queued candidates."));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_abandon_refuses_when_queue_lock_is_held() {
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
            operation: "preflight".to_string(),
            session_id: Some(session.id.clone()),
            acquired_at_ms: now_millis(),
        })
        .expect("acquire lock"));

    let err = abandon_session_with(&SessionAbandonOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id,
        operator_id: None,
    })
    .unwrap_err();

    assert!(matches!(err, CliError::Usage(message) if message.contains("merge queue is locked")));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_abandon_prevents_applying_approved_candidate() {
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
    abandon_session_with(&SessionAbandonOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("abandon");

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
            session_id: session.id,
            operator_id: None,
        },
        &MockGitRepository,
        &applier,
    )
    .unwrap_err();

    assert!(matches!(err, CliError::Usage(message) if message.contains("abandoned")));
    assert!(applier.requests.borrow().is_empty());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_cleanup_removes_applied_session_worktree_branch_and_sandboxes() {
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
    run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
            applied_commit_id: "verified-commit".to_string(),
            applied_tree_id: "verified-tree".to_string(),
            stdout: String::new(),
            stderr: String::new(),
        }),
    )
    .expect("apply");

    let cleaner = MockSessionCleaner::new(CleanupSessionWorktreeOutcome {
        session_worktree_removed: true,
        branch_deleted: true,
        sandbox_worktrees_removed: vec![repo
            .join(".aichestra")
            .join("sandboxes")
            .join(&attempt.id)],
    });
    let result = cleanup_session_with(
        &SessionCleanupOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
        },
        &cleaner,
    )
    .expect("cleanup");

    assert_eq!(result.session.id, session.id);
    assert_eq!(
        result
            .latest_attempt
            .as_ref()
            .map(|attempt| &attempt.status),
        Some(&MergeAttemptStatus::Applied)
    );
    let requests = cleaner.requests.borrow();
    assert_eq!(requests.len(), 1);
    assert_eq!(requests[0].session_id, session.id);
    assert_eq!(requests[0].branch, "aich/session/session-review");
    assert_eq!(
        requests[0].worktree_path,
        repo.join(".aichestra/worktrees/session-review")
    );
    assert_eq!(
        requests[0].sandbox_paths,
        vec![repo.join(".aichestra/sandboxes/merge-review")]
    );

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger
        .list_events()
        .expect("events")
        .iter()
        .any(|event| event.name == "session.cleaned"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_cleanup_rejects_unapplied_session() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let session = seed_enqueued_candidate(&repo, "session-open");
    let cleaner = MockSessionCleaner::new(CleanupSessionWorktreeOutcome {
        session_worktree_removed: true,
        branch_deleted: true,
        sandbox_worktrees_removed: Vec::new(),
    });

    let err = cleanup_session_with(
        &SessionCleanupOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id,
        },
        &cleaner,
    )
    .unwrap_err();

    assert!(matches!(err, CliError::Usage(message) if message.contains("cannot be cleaned")));
    assert!(cleaner.requests.borrow().is_empty());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_cleanup_removes_noop_session_without_merge_attempt() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let session = seed_session_with_status(&repo, "session-noop", SessionStatus::Noop);
    let cleaner = MockSessionCleaner::new(CleanupSessionWorktreeOutcome {
        session_worktree_removed: false,
        branch_deleted: true,
        sandbox_worktrees_removed: Vec::new(),
    });

    let result = cleanup_session_with(
        &SessionCleanupOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
        },
        &cleaner,
    )
    .expect("cleanup noop");

    assert_eq!(result.session.id, session.id);
    assert!(result.latest_attempt.is_none());
    assert_eq!(cleaner.requests.borrow().len(), 1);

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "session.cleaned" && event.data_json.contains("\"cleanup_kind\":\"noop\"")
    }));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_cleanup_removes_failed_start_session_without_candidate() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let session = seed_session_with_status(&repo, "session-failed-start", SessionStatus::Blocked);
    let cleaner = MockSessionCleaner::new(CleanupSessionWorktreeOutcome {
        session_worktree_removed: false,
        branch_deleted: false,
        sandbox_worktrees_removed: Vec::new(),
    });

    let result = cleanup_session_with(
        &SessionCleanupOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
        },
        &cleaner,
    )
    .expect("cleanup failed start");

    assert_eq!(result.session.id, session.id);
    assert!(result.latest_attempt.is_none());
    assert_eq!(cleaner.requests.borrow().len(), 1);

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_cleanup_rejects_already_cleaned_session() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let session = seed_session_with_status(&repo, "session-noop", SessionStatus::Noop);
    mark_session_cleaned(&repo, &session.id);
    let cleaner = MockSessionCleaner::new(CleanupSessionWorktreeOutcome {
        session_worktree_removed: false,
        branch_deleted: false,
        sandbox_worktrees_removed: Vec::new(),
    });

    let err = cleanup_session_with(
        &SessionCleanupOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id,
        },
        &cleaner,
    )
    .unwrap_err();

    assert!(matches!(err, CliError::Usage(message) if message.contains("already been cleaned")));
    assert!(cleaner.requests.borrow().is_empty());

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_cleanup_removes_abandoned_session_with_forced_branch_delete() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let session = seed_enqueued_candidate(&repo, "session-abandoned-cleanup");
    abandon_session_with(&SessionAbandonOptions {
        repo_root: repo.clone(),
        db_path: None,
        session_id: session.id.clone(),
        operator_id: None,
    })
    .expect("abandon");
    let cleaner = MockSessionCleaner::new(CleanupSessionWorktreeOutcome {
        session_worktree_removed: true,
        branch_deleted: true,
        sandbox_worktrees_removed: Vec::new(),
    });

    let result = cleanup_session_with(
        &SessionCleanupOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
        },
        &cleaner,
    )
    .expect("cleanup abandoned");

    assert_eq!(result.session.id, session.id);
    assert_eq!(cleaner.requests.borrow().len(), 1);
    assert!(cleaner.requests.borrow()[0].force_branch_delete);

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "session.cleaned"
            && event.data_json.contains("\"cleanup_kind\":\"abandoned\"")
    }));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_prune_cleans_only_applied_sessions() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let (session, _attempt) = seed_verified_review_candidate(&repo, "README.md", true);
    seed_enqueued_candidate(&repo, "session-open");

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
    run_apply_with(
        &ApplyOptions {
            repo_root: repo.clone(),
            db_path: None,
            session_id: session.id.clone(),
            operator_id: None,
        },
        &MockGitRepository,
        &MockVerifiedCommitApplier::new(AppliedVerifiedCommit {
            applied_commit_id: "verified-commit".to_string(),
            applied_tree_id: "verified-tree".to_string(),
            stdout: String::new(),
            stderr: String::new(),
        }),
    )
    .expect("apply");

    let cleaner = MockSessionCleaner::new(CleanupSessionWorktreeOutcome {
        session_worktree_removed: false,
        branch_deleted: false,
        sandbox_worktrees_removed: Vec::new(),
    });
    let result = prune_sessions_with(
        &SessionPruneOptions {
            repo_root: repo.clone(),
            db_path: None,
            applied: true,
            inactive: false,
        },
        &cleaner,
    )
    .expect("prune");

    assert_eq!(result.cleaned.len(), 1);
    assert_eq!(result.cleaned[0].session.id, session.id);
    assert_eq!(result.skipped, 1);
    assert_eq!(cleaner.requests.borrow().len(), 1);

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_prune_inactive_cleans_noop_and_failed_start_sessions() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let noop = seed_session_with_status(&repo, "session-noop", SessionStatus::Noop);
    let failed_start =
        seed_session_with_status(&repo, "session-failed-start", SessionStatus::Blocked);
    seed_enqueued_candidate(&repo, "session-open");

    let cleaner = MockSessionCleaner::new(CleanupSessionWorktreeOutcome {
        session_worktree_removed: false,
        branch_deleted: false,
        sandbox_worktrees_removed: Vec::new(),
    });
    let result = prune_sessions_with(
        &SessionPruneOptions {
            repo_root: repo.clone(),
            db_path: None,
            applied: false,
            inactive: true,
        },
        &cleaner,
    )
    .expect("prune inactive");

    let cleaned_ids: Vec<&str> = result
        .cleaned
        .iter()
        .map(|cleaned| cleaned.session.id.as_str())
        .collect();
    assert_eq!(
        cleaned_ids,
        vec![noop.id.as_str(), failed_start.id.as_str()]
    );
    assert_eq!(result.skipped, 1);
    assert_eq!(cleaner.requests.borrow().len(), 2);

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_prune_skips_already_cleaned_sessions() {
    let repo = unique_temp_dir();
    init_repo(&InitOptions {
        repo_root: repo.clone(),
        db_path: None,
    })
    .expect("init");
    let cleaned_noop = seed_session_with_status(&repo, "session-cleaned", SessionStatus::Noop);
    let pending_noop = seed_session_with_status(&repo, "session-pending", SessionStatus::Noop);
    mark_session_cleaned(&repo, &cleaned_noop.id);

    let cleaner = MockSessionCleaner::new(CleanupSessionWorktreeOutcome {
        session_worktree_removed: false,
        branch_deleted: false,
        sandbox_worktrees_removed: Vec::new(),
    });
    let result = prune_sessions_with(
        &SessionPruneOptions {
            repo_root: repo.clone(),
            db_path: None,
            applied: false,
            inactive: true,
        },
        &cleaner,
    )
    .expect("prune inactive");

    assert_eq!(result.cleaned.len(), 1);
    assert_eq!(result.cleaned[0].session.id, pending_noop.id);
    assert_eq!(result.skipped, 1);
    assert_eq!(cleaner.requests.borrow().len(), 1);

    let _ = fs::remove_dir_all(repo);
}
