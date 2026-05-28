use super::*;

#[test]
fn init_creates_state_directories_config_db_and_event() {
    let repo = unique_temp_dir();
    let mut output = Vec::new();

    run_with_cwd(["aich", "init"], &repo, &mut output).expect("init");

    assert!(repo.join(".aichestra/config.yaml").exists());
    assert!(repo.join(".aichestra/artifacts").is_dir());
    assert!(repo.join(".aichestra/sandboxes").is_dir());
    assert!(repo.join(".aichestra/worktrees").is_dir());
    assert!(repo.join(".aichestra/prompts/change-manifest.md").exists());
    assert!(repo
        .join(".aichestra/prompts/semantic-merge-review.md")
        .exists());
    assert!(repo
        .join(".aichestra/templates/change-manifest.yaml")
        .exists());
    assert!(repo
        .join(".aichestra/schemas/change-manifest.schema.yaml")
        .exists());
    assert!(repo.join(".aichestra/aichestra.db").exists());

    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let operators = ledger.list_operators().expect("operators");
    assert_eq!(operators.len(), 1);
    assert_eq!(operators[0].id, DEFAULT_OPERATOR_ID);
    assert_eq!(operators[0].role, OperatorRole::Owner);

    let events = ledger.list_events().expect("events");
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].name, "repo.initialized");

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn auth_commands_show_default_operator_and_add_operator() {
    let repo = unique_temp_dir();
    let mut output = Vec::new();
    run_with_cwd(["aich", "init"], &repo, &mut output).expect("init");

    output.clear();
    run_with_cwd(["aich", "auth", "whoami"], &repo, &mut output).expect("whoami");
    let whoami = String::from_utf8(output.clone()).expect("utf8 output");
    assert!(whoami.contains("Operator: local-user"));
    assert!(whoami.contains("Role: owner"));

    output.clear();
    run_with_cwd(
        [
            "aich",
            "auth",
            "operator",
            "add",
            "--id",
            "alice",
            "--name",
            "Alice Maintainer",
            "--role",
            "maintainer",
        ],
        &repo,
        &mut output,
    )
    .expect("add operator");
    let add_output = String::from_utf8(output.clone()).expect("utf8 output");
    assert!(add_output.contains("Saved operator alice"));
    assert!(add_output.contains("Role: maintainer"));

    output.clear();
    run_with_cwd(["aich", "auth", "operator", "list"], &repo, &mut output).expect("list operators");
    let list_output = String::from_utf8(output).expect("utf8 output");
    assert!(list_output.contains("Operators: 2"));
    assert!(list_output.contains("alice [maintainer / active] Alice Maintainer"));

    let _ = fs::remove_dir_all(repo);
}

#[test]
fn session_start_requires_goal() {
    let err = parse_session_start_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("--goal")));
}

#[test]
fn session_complete_requires_session_id() {
    let err = parse_session_complete_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
}

#[test]
fn session_abandon_requires_session_id() {
    let err = parse_session_abandon_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
}

#[test]
fn session_reopen_requires_session_id() {
    let err = parse_session_reopen_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
}

#[test]
fn preflight_requires_session_id() {
    let err = parse_preflight_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
}

#[test]
fn review_requires_session_id() {
    let err = parse_review_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
}

#[test]
fn approve_requires_session_id() {
    let err = parse_approve_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
}

#[test]
fn reject_requires_session_id_and_reason() {
    let err = parse_reject_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));

    let err = parse_reject_options(&["session-1".to_string()], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("--reason")));
}

#[test]
fn apply_requires_session_id() {
    let err = parse_apply_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
}

#[test]
fn queue_unlock_requires_force() {
    let err = parse_queue_unlock_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("--force")));
}

#[test]
fn session_cleanup_requires_session_id() {
    let err = parse_session_cleanup_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("<session-id>")));
}

#[test]
fn session_prune_requires_applied_flag() {
    let err = parse_session_prune_options(&[], Path::new(".")).unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("--applied")));
}
