use super::*;

#[test]
fn command_adapter_cli_e2e_runs_init_to_apply() {
    let repo = unique_temp_dir();
    let scripts = unique_temp_dir();
    initialize_e2e_git_repo(&repo);
    fs::create_dir_all(&scripts).expect("create scripts dir");

    let init_output = run_cli(&repo, ["aich", "init"]);
    assert!(init_output.contains("Initialized Aichestra repository"));

    let provider_command = write_agent_test_command(
        &scripts,
        "e2e-provider",
        r#"$inputText = [Console]::In.ReadToEnd()
if (-not $inputText.Contains('Goal: E2E command adapter flow')) {
  [Console]::Error.WriteLine('missing goal')
  exit 2
}
Set-Content -LiteralPath 'app.txt' -Value "base`nagent change`n" -NoNewline -Encoding UTF8
[Console]::Out.WriteLine('provider completed')
"#,
        r#"input=$(cat)
case "$input" in
  *"Goal: E2E command adapter flow"*) ;;
  *) printf 'missing goal\n' >&2; exit 2 ;;
esac
printf 'base\nagent change\n' > app.txt
printf 'provider completed\n'
"#,
    );
    let review_command = write_agent_test_command(
        &scripts,
        "e2e-reviewer",
        r#"$inputText = [Console]::In.ReadToEnd()
foreach ($needle in @('Semantic Review Input', '## Patch Context', '+agent change', 'e2e_command_reviewer')) {
  if (-not $inputText.Contains($needle)) {
    [Console]::Error.WriteLine("missing $needle")
    exit 2
  }
}
$report = @'
semantic_review:
  risk_level: low
  summary: "Command adapter reviewed the verified candidate."
  suspected_conflicts: []
  required_actions: []
  suggested_tests:
    - "e2e-check"
  proposed_patch:
    available: false
    description: ""
    patch_artifact: ""
    patch: ""
  uncertainty: []
'@
[Console]::Out.WriteLine($report)
"#,
        r###"input=$(cat)
case "$input" in *"Semantic Review Input"*) ;; *) printf 'missing review input\n' >&2; exit 2 ;; esac
case "$input" in *"## Patch Context"*) ;; *) printf 'missing patch context\n' >&2; exit 2 ;; esac
case "$input" in *"+agent change"*) ;; *) printf 'missing patch hunk\n' >&2; exit 2 ;; esac
case "$input" in *"e2e_command_reviewer"*) ;; *) printf 'missing reviewer id\n' >&2; exit 2 ;; esac
cat <<'YAML'
semantic_review:
  risk_level: low
  summary: "Command adapter reviewed the verified candidate."
  suspected_conflicts: []
  required_actions: []
  suggested_tests:
    - "e2e-check"
  proposed_patch:
    available: false
    description: ""
    patch_artifact: ""
    patch: ""
  uncertainty: []
YAML
"###,
    );
    let check_command = write_agent_test_command(
        &scripts,
        "e2e-check",
        r#"if (-not (Test-Path -LiteralPath 'app.txt')) {
  [Console]::Error.WriteLine('missing app.txt')
  exit 2
}
if (-not (Get-Content -LiteralPath 'app.txt' -Raw).Contains('agent change')) {
  [Console]::Error.WriteLine('missing agent change')
  exit 2
}
"#,
        r#"test -f app.txt
grep -q 'agent change' app.txt
"#,
    );
    write_e2e_config(&repo, &provider_command, &review_command, &check_command);
    commit_e2e_aichestra_project_files(&repo);

    let start_output = run_cli(
        &repo,
        [
            "aich",
            "session",
            "start",
            "--goal",
            "E2E command adapter flow",
            "--provider",
            "e2e-agent",
            "--target",
            "app.txt",
        ],
    );
    let session_id = parse_started_session_id(&start_output);
    assert!(start_output.contains("Worktree:"));

    let run_output = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "session".to_string(),
            "run".to_string(),
            session_id.clone(),
        ],
    );
    assert!(run_output.contains("Ran session agent"));
    assert!(fs::read_to_string(
        repo.join(".aichestra/worktrees")
            .join(&session_id)
            .join("app.txt")
    )
    .expect("worktree app")
    .contains("agent change"));

    let complete_output = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "session".to_string(),
            "complete".to_string(),
            session_id.clone(),
        ],
    );
    assert!(complete_output.contains("Status: enqueued"));
    assert!(complete_output.contains("Changed files: 1"));

    let preflight_output = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "preflight".to_string(),
            session_id.clone(),
        ],
    );
    assert!(preflight_output.contains("Preflight verified"));
    assert!(preflight_output.contains("Checks: 1"));

    let review_output = run_cli(
        &repo,
        vec!["aich".to_string(), "review".to_string(), session_id.clone()],
    );
    assert!(review_output.contains("Review low"));
    assert!(review_output.contains("Command adapter reviewed the verified candidate."));

    let approve_output = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "approve".to_string(),
            session_id.clone(),
        ],
    );
    assert!(approve_output.contains("Approved "));
    assert!(approve_output.contains("Semantic risk: low"));

    let apply_output = run_cli(
        &repo,
        vec!["aich".to_string(), "apply".to_string(), session_id.clone()],
    );
    assert!(apply_output.contains("Applied "));
    assert!(fs::read_to_string(repo.join("app.txt"))
        .expect("main app")
        .contains("agent change"));

    let status = run_test_git(&repo, &["status", "--porcelain"]);
    assert!(status.trim().is_empty(), "main worktree dirty:\n{status}");

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let session = ledger
        .get_session(&session_id)
        .expect("get session")
        .expect("session");
    assert_eq!(session.status, SessionStatus::Completed);
    let attempts = ledger
        .list_merge_attempts(&session_id)
        .expect("merge attempts");
    let attempt = attempts.last().expect("latest attempt");
    assert_eq!(attempt.status, MergeAttemptStatus::Applied);
    assert!(attempt.checks_passed);
    assert_eq!(attempt.semantic_risk_level.as_deref(), Some("low"));
    assert_eq!(
        ledger
            .list_semantic_reviews(&attempt.id)
            .expect("semantic reviews")
            .len(),
        1
    );
    let event_names: Vec<String> = ledger
        .list_events()
        .expect("events")
        .into_iter()
        .map(|event| event.name)
        .collect();
    for expected in [
        "repo.initialized",
        "session.started",
        "session.agent.completed",
        "session.completed",
        "merge.preflight.started",
        "merge.semantic_review.completed",
        "approval.approved",
        "merge.applied",
    ] {
        assert!(
            event_names.contains(&expected.to_string()),
            "missing event {expected}; events: {event_names:?}"
        );
    }

    let _ = fs::remove_dir_all(repo);
    let _ = fs::remove_dir_all(scripts);
}

#[test]
fn command_adapter_cli_e2e_reworks_proposed_patch_before_apply() {
    let repo = unique_temp_dir();
    let scripts = unique_temp_dir();
    initialize_e2e_git_repo(&repo);
    fs::create_dir_all(&scripts).expect("create scripts dir");

    let init_output = run_cli(&repo, ["aich", "init"]);
    assert!(init_output.contains("Initialized Aichestra repository"));

    let provider_command = write_agent_test_command(
        &scripts,
        "e2e-rework-provider",
        r#"$inputText = [Console]::In.ReadToEnd()
if ($inputText.Contains('Aichestra Session Rework')) {
  foreach ($needle in @('Proposed Patch Artifact', '+reworked change', 'Add the reviewed follow-up line.')) {
    if (-not $inputText.Contains($needle)) {
      [Console]::Error.WriteLine("missing rework input $needle")
      exit 2
    }
  }
  Set-Content -LiteralPath 'app.txt' -Value "base`nagent change`nreworked change`n" -NoNewline -Encoding UTF8
  [Console]::Out.WriteLine('rework completed')
} else {
  if (-not $inputText.Contains('Goal: E2E rework command adapter flow')) {
    [Console]::Error.WriteLine('missing goal')
    exit 3
  }
  Set-Content -LiteralPath 'app.txt' -Value "base`nagent change`n" -NoNewline -Encoding UTF8
  [Console]::Out.WriteLine('initial provider completed')
}
"#,
        r#"input=$(cat)
case "$input" in
  *"Aichestra Session Rework"*)
    case "$input" in *"Proposed Patch Artifact"*) ;; *) printf 'missing proposed patch artifact\n' >&2; exit 2 ;; esac
    case "$input" in *"+reworked change"*) ;; *) printf 'missing proposed patch hunk\n' >&2; exit 2 ;; esac
    case "$input" in *"Add the reviewed follow-up line."*) ;; *) printf 'missing required action\n' >&2; exit 2 ;; esac
    printf 'base\nagent change\nreworked change\n' > app.txt
    printf 'rework completed\n'
    ;;
  *)
    case "$input" in *"Goal: E2E rework command adapter flow"*) ;; *) printf 'missing goal\n' >&2; exit 3 ;; esac
    printf 'base\nagent change\n' > app.txt
    printf 'initial provider completed\n'
    ;;
esac
"#,
    );
    let review_command = write_agent_test_command(
        &scripts,
        "e2e-rework-reviewer",
        r#"$inputText = [Console]::In.ReadToEnd()
foreach ($needle in @('Semantic Review Input', '## Patch Context', 'e2e_command_reviewer')) {
  if (-not $inputText.Contains($needle)) {
    [Console]::Error.WriteLine("missing $needle")
    exit 2
  }
}
if ($inputText.Contains('+reworked change')) {
  $report = @'
semantic_review:
  risk_level: low
  summary: "Reworked candidate accepted."
  suspected_conflicts: []
  required_actions: []
  suggested_tests:
    - "e2e-check"
  proposed_patch:
    available: false
    description: ""
    patch_artifact: ""
    patch: ""
  uncertainty: []
'@
  [Console]::Out.WriteLine($report)
} elseif ($inputText.Contains('+agent change')) {
  $report = @'
semantic_review:
  risk_level: low
  summary: "Reviewer found one follow-up fix before approval."
  suspected_conflicts: []
  required_actions:
    - "Add the reviewed follow-up line."
  suggested_tests:
    - "e2e-check"
  proposed_patch:
    available: true
    description: "Add the reviewed follow-up line."
    patch: |
      diff --git a/app.txt b/app.txt
      --- a/app.txt
      +++ b/app.txt
      @@ -1,2 +1,3 @@
       base
       agent change
      +reworked change
  uncertainty: []
'@
  [Console]::Out.WriteLine($report)
} else {
  [Console]::Error.WriteLine('missing expected patch hunk')
  exit 3
}
"#,
        r###"input=$(cat)
case "$input" in *"Semantic Review Input"*) ;; *) printf 'missing review input\n' >&2; exit 2 ;; esac
case "$input" in *"## Patch Context"*) ;; *) printf 'missing patch context\n' >&2; exit 2 ;; esac
case "$input" in *"e2e_command_reviewer"*) ;; *) printf 'missing reviewer id\n' >&2; exit 2 ;; esac
case "$input" in
  *"+reworked change"*)
    cat <<'YAML'
semantic_review:
  risk_level: low
  summary: "Reworked candidate accepted."
  suspected_conflicts: []
  required_actions: []
  suggested_tests:
    - "e2e-check"
  proposed_patch:
    available: false
    description: ""
    patch_artifact: ""
    patch: ""
  uncertainty: []
YAML
    ;;
  *"+agent change"*)
    cat <<'YAML'
semantic_review:
  risk_level: low
  summary: "Reviewer found one follow-up fix before approval."
  suspected_conflicts: []
  required_actions:
    - "Add the reviewed follow-up line."
  suggested_tests:
    - "e2e-check"
  proposed_patch:
    available: true
    description: "Add the reviewed follow-up line."
    patch: |
      diff --git a/app.txt b/app.txt
      --- a/app.txt
      +++ b/app.txt
      @@ -1,2 +1,3 @@
       base
       agent change
      +reworked change
  uncertainty: []
YAML
    ;;
  *)
    printf 'missing expected patch hunk\n' >&2
    exit 3
    ;;
esac
"###,
    );
    let check_command = write_agent_test_command(
        &scripts,
        "e2e-rework-check",
        r#"if (-not (Test-Path -LiteralPath 'app.txt')) {
  [Console]::Error.WriteLine('missing app.txt')
  exit 2
}
if (-not (Get-Content -LiteralPath 'app.txt' -Raw).Contains('agent change')) {
  [Console]::Error.WriteLine('missing agent change')
  exit 2
}
"#,
        r#"test -f app.txt
grep -q 'agent change' app.txt
"#,
    );
    write_e2e_config(&repo, &provider_command, &review_command, &check_command);
    commit_e2e_aichestra_project_files(&repo);

    let start_output = run_cli(
        &repo,
        [
            "aich",
            "session",
            "start",
            "--goal",
            "E2E rework command adapter flow",
            "--provider",
            "e2e-agent",
            "--target",
            "app.txt",
        ],
    );
    let session_id = parse_started_session_id(&start_output);

    run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "session".to_string(),
            "run".to_string(),
            session_id.clone(),
        ],
    );
    run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "session".to_string(),
            "complete".to_string(),
            session_id.clone(),
        ],
    );
    run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "preflight".to_string(),
            session_id.clone(),
        ],
    );
    let first_review_output = run_cli(
        &repo,
        vec!["aich".to_string(), "review".to_string(), session_id.clone()],
    );
    assert!(first_review_output.contains("Proposed patch: available"));
    assert!(first_review_output.contains("Reviewer found one follow-up fix before approval."));
    let first_review_id = parse_semantic_review_id(&first_review_output);

    let mut approve_output = Vec::new();
    let approve_err = run_with_cwd(
        vec![
            "aich".to_string(),
            "approve".to_string(),
            session_id.clone(),
        ],
        &repo,
        &mut approve_output,
    )
    .unwrap_err();
    assert!(
        matches!(approve_err, CliError::Usage(message) if message.contains("aich session rework") && message.contains("--accept-current"))
    );

    let rework_output = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "session".to_string(),
            "rework".to_string(),
            session_id.clone(),
            "--review".to_string(),
            first_review_id.clone(),
        ],
    );
    assert!(rework_output.contains("Reworked session"));
    assert!(fs::read_to_string(
        repo.join(".aichestra/worktrees")
            .join(&session_id)
            .join("app.txt")
    )
    .expect("reworked app")
    .contains("reworked change"));

    run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "session".to_string(),
            "complete".to_string(),
            session_id.clone(),
        ],
    );
    run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "preflight".to_string(),
            session_id.clone(),
        ],
    );
    let second_review_output = run_cli(
        &repo,
        vec!["aich".to_string(), "review".to_string(), session_id.clone()],
    );
    assert!(second_review_output.contains("Review low"));
    assert!(second_review_output.contains("Reworked candidate accepted."));
    assert!(!second_review_output.contains("Proposed patch: available"));

    let approve_output = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "approve".to_string(),
            session_id.clone(),
        ],
    );
    assert!(approve_output.contains("Approved "));
    let apply_output = run_cli(
        &repo,
        vec!["aich".to_string(), "apply".to_string(), session_id.clone()],
    );
    assert!(apply_output.contains("Applied "));
    assert!(fs::read_to_string(repo.join("app.txt"))
        .expect("main app")
        .contains("reworked change"));

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let attempts = ledger
        .list_merge_attempts(&session_id)
        .expect("merge attempts");
    assert_eq!(attempts.len(), 2);
    assert_eq!(attempts[0].status, MergeAttemptStatus::Blocked);
    assert_eq!(attempts[1].status, MergeAttemptStatus::Applied);
    let event_names: Vec<String> = ledger
        .list_events()
        .expect("events")
        .into_iter()
        .map(|event| event.name)
        .collect();
    for expected in [
        "session.rework.started",
        "session.rework.completed",
        "approval.approved",
        "merge.applied",
    ] {
        assert!(
            event_names.contains(&expected.to_string()),
            "missing event {expected}; events: {event_names:?}"
        );
    }
    assert!(ledger.list_events().expect("events").iter().any(|event| {
        event.name == "merge.blocked"
            && event.data_json.contains("\"reason\":\"rework_started\"")
            && event.data_json.contains(&first_review_id)
    }));

    let status = run_test_git(&repo, &["status", "--porcelain"]);
    assert!(status.trim().is_empty(), "main worktree dirty:\n{status}");

    let _ = fs::remove_dir_all(repo);
    let _ = fs::remove_dir_all(scripts);
}
