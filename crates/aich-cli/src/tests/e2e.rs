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
    assert!(review_output.contains("Candidate summary:"));
    assert!(review_output.contains("Changed files: 1"));
    assert!(review_output.contains("- modified app.txt"));
    assert!(review_output.contains(&format!("Approve verified tree: aich approve {session_id}")));

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
    assert!(approve_output.contains("Approval summary:"));
    assert!(approve_output.contains("This approval targets the verified tree"));
    assert!(approve_output.contains(&format!("Apply command: aich apply {session_id}")));

    let apply_output = run_cli(
        &repo,
        vec!["aich".to_string(), "apply".to_string(), session_id.clone()],
    );
    assert!(apply_output.contains("Applied "));
    assert!(apply_output.contains("Apply summary:"));
    assert!(apply_output.contains(
        "Verified tree rule: applied commit/tree matched the approved verified candidate"
    ));
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
    assert!(second_review_output.contains("Candidate summary:"));
    assert!(second_review_output.contains("- modified app.txt"));
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
    assert!(approve_output.contains("Approval summary:"));
    assert!(approve_output.contains(&format!("Apply command: aich apply {session_id}")));
    let apply_output = run_cli(
        &repo,
        vec!["aich".to_string(), "apply".to_string(), session_id.clone()],
    );
    assert!(apply_output.contains("Applied "));
    assert!(apply_output.contains("Apply summary:"));
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

#[test]
fn command_adapter_cli_e2e_parallel_tmp_md_sessions_are_sequentially_verified() {
    let repo = unique_temp_dir();
    let scripts = unique_temp_dir();
    initialize_e2e_git_repo(&repo);
    fs::create_dir_all(&scripts).expect("create scripts dir");
    fs::write(
        repo.join("tmp.md"),
        "title: acceptance\n\nalpha section\nalpha: base\nalpha note: stable\n\nmiddle: unchanged\n\nbeta section\nbeta: base\nbeta note: stable\n",
    )
    .expect("write tmp fixture");
    run_test_git(&repo, &["add", "tmp.md"]);
    run_test_git(&repo, &["commit", "-q", "-m", "add tmp acceptance fixture"]);

    let init_output = run_cli(&repo, ["aich", "init"]);
    assert!(init_output.contains("Initialized Aichestra repository"));

    let provider_command = write_agent_test_command(
        &scripts,
        "acceptance-tmp-provider",
        r#"$inputText = [Console]::In.ReadToEnd()
if ($inputText.Contains('Goal: Acceptance tmp.md first session')) {
  Set-Content -LiteralPath 'tmp.md' -Value "title: acceptance`n`nalpha section`nalpha: session one`nalpha note: stable`n`nmiddle: unchanged`n`nbeta section`nbeta: base`nbeta note: stable`n" -NoNewline -Encoding UTF8
  [Console]::Out.WriteLine('first tmp.md change')
} elseif ($inputText.Contains('Goal: Acceptance tmp.md second session')) {
  Set-Content -LiteralPath 'tmp.md' -Value "title: acceptance`n`nalpha section`nalpha: base`nalpha note: stable`n`nmiddle: unchanged`n`nbeta section`nbeta: session two`nbeta note: stable`n" -NoNewline -Encoding UTF8
  [Console]::Out.WriteLine('second tmp.md change')
} else {
  [Console]::Error.WriteLine('missing acceptance goal')
  exit 2
}
"#,
        r#"input=$(cat)
case "$input" in
  *"Goal: Acceptance tmp.md first session"*)
    printf 'title: acceptance\n\nalpha section\nalpha: session one\nalpha note: stable\n\nmiddle: unchanged\n\nbeta section\nbeta: base\nbeta note: stable\n' > tmp.md
    printf 'first tmp.md change\n'
    ;;
  *"Goal: Acceptance tmp.md second session"*)
    printf 'title: acceptance\n\nalpha section\nalpha: base\nalpha note: stable\n\nmiddle: unchanged\n\nbeta section\nbeta: session two\nbeta note: stable\n' > tmp.md
    printf 'second tmp.md change\n'
    ;;
  *)
    printf 'missing acceptance goal\n' >&2
    exit 2
    ;;
esac
"#,
    );
    let review_command = write_agent_test_command(
        &scripts,
        "acceptance-tmp-reviewer",
        r#"$inputText = [Console]::In.ReadToEnd()
foreach ($needle in @('Semantic Review Input', 'tmp.md', '## Patch Context', 'e2e_command_reviewer')) {
  if (-not $inputText.Contains($needle)) {
    [Console]::Error.WriteLine("missing $needle")
    exit 2
  }
}
if ($inputText.Contains('+beta: session two')) {
  foreach ($needle in @('- relation: `applied`', 'Acceptance tmp.md first session')) {
    if (-not $inputText.Contains($needle)) {
      [Console]::Error.WriteLine("missing second-review evidence $needle")
      exit 3
    }
  }
  $summary = 'Second tmp.md candidate reviewed after first apply.'
} elseif ($inputText.Contains('+alpha: session one')) {
  $summary = 'First tmp.md candidate reviewed.'
} else {
  [Console]::Error.WriteLine('missing tmp.md patch hunk')
  exit 4
}
$report = @"
semantic_review:
  risk_level: low
  summary: "$summary"
  suspected_conflicts: []
  required_actions: []
  suggested_tests:
    - "acceptance-tmp-check"
  proposed_patch:
    available: false
    description: ""
    patch_artifact: ""
    patch: ""
  uncertainty: []
"@
[Console]::Out.WriteLine($report)
"#,
        r###"input=$(cat)
case "$input" in *"Semantic Review Input"*) ;; *) printf 'missing review input\n' >&2; exit 2 ;; esac
case "$input" in *"tmp.md"*) ;; *) printf 'missing tmp.md\n' >&2; exit 2 ;; esac
case "$input" in *"## Patch Context"*) ;; *) printf 'missing patch context\n' >&2; exit 2 ;; esac
case "$input" in *"e2e_command_reviewer"*) ;; *) printf 'missing reviewer id\n' >&2; exit 2 ;; esac
case "$input" in
  *"+beta: session two"*)
    case "$input" in *"- relation: \`applied\`"*) ;; *) printf 'missing applied relation\n' >&2; exit 3 ;; esac
    case "$input" in *"Acceptance tmp.md first session"*) ;; *) printf 'missing first session manifest\n' >&2; exit 3 ;; esac
    summary="Second tmp.md candidate reviewed after first apply."
    ;;
  *"+alpha: session one"*)
    summary="First tmp.md candidate reviewed."
    ;;
  *)
    printf 'missing tmp.md patch hunk\n' >&2
    exit 4
    ;;
esac
cat <<YAML
semantic_review:
  risk_level: low
  summary: "$summary"
  suspected_conflicts: []
  required_actions: []
  suggested_tests:
    - "acceptance-tmp-check"
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
        "acceptance-tmp-check",
        r#"if (-not (Test-Path -LiteralPath 'tmp.md')) {
  [Console]::Error.WriteLine('missing tmp.md')
  exit 2
}
$content = Get-Content -LiteralPath 'tmp.md' -Raw
if (-not $content.Contains('title: acceptance')) {
  [Console]::Error.WriteLine('missing title')
  exit 2
}
if (-not ($content.Contains('session one') -or $content.Contains('session two'))) {
  [Console]::Error.WriteLine('missing session change')
  exit 2
}
"#,
        r#"test -f tmp.md
grep -q 'title: acceptance' tmp.md
grep -Eq 'session one|session two' tmp.md
"#,
    );
    write_e2e_config(&repo, &provider_command, &review_command, &check_command);
    commit_e2e_aichestra_project_files(&repo);

    let first_start = run_cli(
        &repo,
        [
            "aich",
            "session",
            "start",
            "--goal",
            "Acceptance tmp.md first session",
            "--provider",
            "e2e-agent",
            "--target",
            "tmp.md",
        ],
    );
    let first_session_id = parse_started_session_id(&first_start);
    let second_start = run_cli(
        &repo,
        [
            "aich",
            "session",
            "start",
            "--goal",
            "Acceptance tmp.md second session",
            "--provider",
            "e2e-agent",
            "--target",
            "tmp.md",
        ],
    );
    let second_session_id = parse_started_session_id(&second_start);
    assert_ne!(first_session_id, second_session_id);

    {
        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let first = ledger
            .get_session(&first_session_id)
            .expect("get first session")
            .expect("first session");
        let second = ledger
            .get_session(&second_session_id)
            .expect("get second session")
            .expect("second session");
        assert_eq!(first.base_commit, second.base_commit);
        assert_ne!(first.branch, second.branch);
        assert_ne!(first.worktree_path, second.worktree_path);
        assert!(PathBuf::from(&first.worktree_path).ends_with(&first_session_id));
        assert!(PathBuf::from(&second.worktree_path).ends_with(&second_session_id));
    }

    run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "session".to_string(),
            "run".to_string(),
            first_session_id.clone(),
        ],
    );
    run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "session".to_string(),
            "run".to_string(),
            second_session_id.clone(),
        ],
    );

    let first_worktree_tmp = repo
        .join(".aichestra/worktrees")
        .join(&first_session_id)
        .join("tmp.md");
    let second_worktree_tmp = repo
        .join(".aichestra/worktrees")
        .join(&second_session_id)
        .join("tmp.md");
    let first_tmp = fs::read_to_string(&first_worktree_tmp).expect("first tmp");
    let second_tmp = fs::read_to_string(&second_worktree_tmp).expect("second tmp");
    assert!(first_tmp.contains("alpha: session one"));
    assert!(first_tmp.contains("beta: base"));
    assert!(second_tmp.contains("alpha: base"));
    assert!(second_tmp.contains("beta: session two"));
    assert!(fs::read_to_string(repo.join("tmp.md"))
        .expect("main tmp before apply")
        .contains("alpha: base"));

    let first_complete = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "session".to_string(),
            "complete".to_string(),
            first_session_id.clone(),
        ],
    );
    assert!(first_complete.contains("Status: enqueued"));
    assert!(first_complete.contains("Changed files: 1"));
    let second_complete = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "session".to_string(),
            "complete".to_string(),
            second_session_id.clone(),
        ],
    );
    assert!(second_complete.contains("Status: enqueued"));
    assert!(second_complete.contains("Changed files: 1"));

    let queue_output = run_cli(&repo, ["aich", "queue"]);
    assert!(queue_output.contains("Entries: 2"));
    assert!(queue_output.contains(&first_session_id));
    assert!(queue_output.contains(&second_session_id));

    let mut refused_preflight_output = Vec::new();
    let refused_preflight = run_with_cwd(
        vec![
            "aich".to_string(),
            "preflight".to_string(),
            second_session_id.clone(),
        ],
        &repo,
        &mut refused_preflight_output,
    )
    .unwrap_err();
    assert!(
        matches!(refused_preflight, CliError::Usage(message) if message.contains("not the queue head") && message.contains(&first_session_id))
    );

    let first_preflight = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "preflight".to_string(),
            first_session_id.clone(),
        ],
    );
    assert!(first_preflight.contains("Preflight verified"));
    assert!(first_preflight.contains("Checks: 1"));
    let first_review = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "review".to_string(),
            first_session_id.clone(),
        ],
    );
    assert!(first_review.contains("Review low"));
    assert!(first_review.contains("First tmp.md candidate reviewed."));
    let first_approve = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "approve".to_string(),
            first_session_id.clone(),
        ],
    );
    assert!(first_approve.contains("Approved "));
    let first_apply = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "apply".to_string(),
            first_session_id.clone(),
        ],
    );
    assert!(first_apply.contains("Applied "));
    let first_applied_commit = run_test_git(&repo, &["rev-parse", "HEAD"])
        .trim()
        .to_string();
    let main_after_first = fs::read_to_string(repo.join("tmp.md")).expect("main tmp after first");
    assert!(main_after_first.contains("alpha: session one"));
    assert!(main_after_first.contains("beta: base"));

    let second_preflight = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "preflight".to_string(),
            second_session_id.clone(),
        ],
    );
    assert!(second_preflight.contains("Preflight verified"));
    let second_attempt = {
        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let attempts = ledger
            .list_merge_attempts(&second_session_id)
            .expect("second attempts");
        attempts.last().expect("second latest attempt").clone()
    };
    assert_eq!(second_attempt.main_before_commit, first_applied_commit);
    let second_sandbox_tmp = fs::read_to_string(
        repo.join(".aichestra/sandboxes")
            .join(&second_attempt.id)
            .join("tmp.md"),
    )
    .expect("second sandbox tmp");
    assert!(second_sandbox_tmp.contains("alpha: session one"));
    assert!(second_sandbox_tmp.contains("beta: session two"));

    let second_review = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "review".to_string(),
            second_session_id.clone(),
        ],
    );
    assert!(second_review.contains("Review low"));
    assert!(second_review.contains("Second tmp.md candidate reviewed after first apply."));
    let second_approve = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "approve".to_string(),
            second_session_id.clone(),
        ],
    );
    assert!(second_approve.contains("Approved "));
    let second_apply = run_cli(
        &repo,
        vec![
            "aich".to_string(),
            "apply".to_string(),
            second_session_id.clone(),
        ],
    );
    assert!(second_apply.contains("Applied "));

    let final_tmp = fs::read_to_string(repo.join("tmp.md")).expect("final tmp");
    assert!(final_tmp.contains("alpha: session one"));
    assert!(final_tmp.contains("beta: session two"));
    let final_queue = run_cli(&repo, ["aich", "queue"]);
    assert!(final_queue.contains("Entries: 0"));
    assert!(final_queue.contains("No queued candidates."));

    {
        let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
        let first_attempts = ledger
            .list_merge_attempts(&first_session_id)
            .expect("first attempts");
        let first_attempt = first_attempts.last().expect("first latest attempt");
        let second_attempts = ledger
            .list_merge_attempts(&second_session_id)
            .expect("second attempts");
        let second_attempt = second_attempts.last().expect("second latest attempt");
        assert_eq!(first_attempt.status, MergeAttemptStatus::Applied);
        assert_eq!(second_attempt.status, MergeAttemptStatus::Applied);
        assert_eq!(
            first_attempt.verified_commit_id.as_deref(),
            Some(first_applied_commit.as_str())
        );
        assert_eq!(second_attempt.main_before_commit, first_applied_commit);
        assert!(first_attempt.checks_passed);
        assert!(second_attempt.checks_passed);
        assert_eq!(first_attempt.semantic_risk_level.as_deref(), Some("low"));
        assert_eq!(second_attempt.semantic_risk_level.as_deref(), Some("low"));
    }

    let status = run_test_git(&repo, &["status", "--porcelain"]);
    assert!(status.trim().is_empty(), "main worktree dirty:\n{status}");

    let _ = fs::remove_dir_all(repo);
    let _ = fs::remove_dir_all(scripts);
}
