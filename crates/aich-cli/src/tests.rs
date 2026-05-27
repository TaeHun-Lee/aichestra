use super::*;
use aich_git::{
    validate_worktree_request, AppliedVerifiedCommit, HeadCommit, PreflightCheckOutput,
    SessionWorktree,
};
use aich_ledger::Ledger;
use std::cell::RefCell;
use std::env;
use std::process;
use std::time::{SystemTime, UNIX_EPOCH};

static TEST_COUNTER: AtomicU64 = AtomicU64::new(1);

struct MockGitRepository;

impl GitRepository for MockGitRepository {
    fn head_commit(&self, _repo_path: &Path) -> Result<HeadCommit, WorktreeError> {
        Ok(HeadCommit {
            commit_id: "base-commit".to_string(),
        })
    }
}

struct MockMovedGitRepository;

impl GitRepository for MockMovedGitRepository {
    fn head_commit(&self, _repo_path: &Path) -> Result<HeadCommit, WorktreeError> {
        Ok(HeadCommit {
            commit_id: "other-main".to_string(),
        })
    }
}

struct RecordingGitRepository {
    refs: RefCell<Vec<String>>,
    commit_id: String,
}

impl RecordingGitRepository {
    fn new(commit_id: &str) -> Self {
        Self {
            refs: RefCell::new(Vec::new()),
            commit_id: commit_id.to_string(),
        }
    }
}

impl GitRepository for RecordingGitRepository {
    fn head_commit(&self, _repo_path: &Path) -> Result<HeadCommit, WorktreeError> {
        Ok(HeadCommit {
            commit_id: "head-commit".to_string(),
        })
    }

    fn ref_commit(&self, _repo_path: &Path, git_ref: &str) -> Result<HeadCommit, WorktreeError> {
        self.refs.borrow_mut().push(git_ref.to_string());
        Ok(HeadCommit {
            commit_id: self.commit_id.clone(),
        })
    }
}

struct MockWorktreeManager {
    requests: RefCell<Vec<CreateWorktreeRequest>>,
}

impl MockWorktreeManager {
    fn new() -> Self {
        Self {
            requests: RefCell::new(Vec::new()),
        }
    }
}

impl WorktreeManager for MockWorktreeManager {
    fn create_session_worktree(
        &self,
        request: &CreateWorktreeRequest,
    ) -> Result<SessionWorktree, WorktreeError> {
        validate_worktree_request(request)?;
        self.requests.borrow_mut().push(request.clone());
        Ok(SessionWorktree {
            session_id: request.session_id.clone(),
            branch: request.branch.clone(),
            path: request.worktree_path.clone(),
            base_ref: request.base_ref.clone(),
        })
    }
}

struct MockSessionCompleter {
    requests: RefCell<Vec<CompleteSessionWorktreeRequest>>,
    outcome: CompleteSessionWorktreeOutcome,
}

impl MockSessionCompleter {
    fn new(outcome: CompleteSessionWorktreeOutcome) -> Self {
        Self {
            requests: RefCell::new(Vec::new()),
            outcome,
        }
    }
}

struct MockPreflightRunner {
    requests: RefCell<Vec<PreflightRequest>>,
    outcome: PreflightOutcome,
}

impl MockPreflightRunner {
    fn new(outcome: PreflightOutcome) -> Self {
        Self {
            requests: RefCell::new(Vec::new()),
            outcome,
        }
    }
}

impl PreflightRunner for MockPreflightRunner {
    fn run_preflight(&self, request: &PreflightRequest) -> Result<PreflightOutcome, WorktreeError> {
        self.requests.borrow_mut().push(request.clone());
        Ok(self.outcome.clone())
    }
}

struct MockSemanticReviewAdapter;

impl SemanticReviewAdapter for MockSemanticReviewAdapter {
    fn reviewer_id(&self) -> &str {
        "mock_llm_reviewer"
    }

    fn llm_executed(&self) -> bool {
        true
    }

    fn review(
        &self,
        request: &SemanticReviewAdapterRequest<'_>,
    ) -> Result<LocalSemanticReviewReport, CliError> {
        assert_eq!(request.session.id, "session-review");
        assert_eq!(request.attempt.id, "merge-review");
        assert!(request.manifest_content.is_some());
        assert!(request.config_path.ends_with(".aichestra/config.yaml"));
        assert_eq!(
            request.prompt_path,
            ".aichestra/prompts/semantic-merge-review.md"
        );
        assert_eq!(request.changed_files.len(), 1);
        assert_eq!(request.check_results.len(), 1);

        Ok(LocalSemanticReviewReport {
            risk_level: SemanticRiskLevel::Low,
            summary: "Mock LLM adapter reviewed the candidate.".to_string(),
            suspected_conflicts: Vec::new(),
            required_actions: Vec::new(),
            suggested_tests: vec!["cargo test --all".to_string()],
            uncertainty: vec!["Mock adapter output is test-only.".to_string()],
        })
    }
}

struct MockVerifiedCommitApplier {
    requests: RefCell<Vec<ApplyVerifiedCommitRequest>>,
    result: AppliedVerifiedCommit,
}

impl MockVerifiedCommitApplier {
    fn new(result: AppliedVerifiedCommit) -> Self {
        Self {
            requests: RefCell::new(Vec::new()),
            result,
        }
    }
}

impl VerifiedCommitApplier for MockVerifiedCommitApplier {
    fn apply_verified_commit(
        &self,
        request: &ApplyVerifiedCommitRequest,
    ) -> Result<AppliedVerifiedCommit, WorktreeError> {
        self.requests.borrow_mut().push(request.clone());
        Ok(self.result.clone())
    }
}

struct MockFailingVerifiedCommitApplier {
    requests: RefCell<Vec<ApplyVerifiedCommitRequest>>,
    message: String,
}

impl MockFailingVerifiedCommitApplier {
    fn invalid_request(message: &str) -> Self {
        Self {
            requests: RefCell::new(Vec::new()),
            message: message.to_string(),
        }
    }
}

impl VerifiedCommitApplier for MockFailingVerifiedCommitApplier {
    fn apply_verified_commit(
        &self,
        request: &ApplyVerifiedCommitRequest,
    ) -> Result<AppliedVerifiedCommit, WorktreeError> {
        self.requests.borrow_mut().push(request.clone());
        Err(WorktreeError::InvalidRequest(self.message.clone()))
    }
}

struct MockSessionCleaner {
    requests: RefCell<Vec<CleanupSessionWorktreeRequest>>,
    outcome: CleanupSessionWorktreeOutcome,
}

impl MockSessionCleaner {
    fn new(outcome: CleanupSessionWorktreeOutcome) -> Self {
        Self {
            requests: RefCell::new(Vec::new()),
            outcome,
        }
    }
}

impl SessionWorktreeCleaner for MockSessionCleaner {
    fn cleanup_session_worktree(
        &self,
        request: &CleanupSessionWorktreeRequest,
    ) -> Result<CleanupSessionWorktreeOutcome, WorktreeError> {
        self.requests.borrow_mut().push(request.clone());
        Ok(self.outcome.clone())
    }
}

impl SessionWorktreeCompleter for MockSessionCompleter {
    fn complete_session_worktree(
        &self,
        request: &CompleteSessionWorktreeRequest,
    ) -> Result<CompleteSessionWorktreeOutcome, WorktreeError> {
        self.requests.borrow_mut().push(request.clone());
        Ok(self.outcome.clone())
    }
}

fn unique_temp_dir() -> PathBuf {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time")
        .as_millis();
    let counter = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
    env::temp_dir().join(format!(
        "aich-cli-test-{}-{millis}-{counter}",
        process::id()
    ))
}

#[test]
fn init_creates_state_directories_config_db_and_event() {
    let repo = unique_temp_dir();
    let mut output = Vec::new();

    run_with_cwd(["aich", "init"], &repo, &mut output).expect("init");

    assert!(repo.join(".aichestra/config.yaml").exists());
    assert!(repo.join(".aichestra/artifacts").is_dir());
    assert!(repo.join(".aichestra/sandboxes").is_dir());
    assert!(repo.join(".aichestra/worktrees").is_dir());
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

fn seed_verified_review_candidate(
    repo: &Path,
    changed_file_path: &str,
    write_manifest: bool,
) -> (Session, MergeAttempt) {
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let now = now_millis();
    let mut session = Session::new(
        "session-review",
        "review candidate",
        "codex",
        "aich/session/session-review",
        ".aichestra/worktrees/session-review",
        "base-commit",
        now,
    );
    session.status = SessionStatus::Enqueued;
    session.head_commit = Some("head-commit".to_string());
    session.updated_at_ms = now + 1;
    ledger.insert_session(&session).expect("insert session");

    let patch_set = PatchSet {
        id: "patch-review".to_string(),
        session_id: session.id.clone(),
        base_commit: "base-commit".to_string(),
        head_commit: Some("head-commit".to_string()),
        patch_id: Some("head-commit".to_string()),
        diff_stat: Some(format!(" {changed_file_path} | 1 +\n 1 file changed\n")),
        created_at_ms: now + 2,
    };
    let changed_files = vec![ChangedFile::new(changed_file_path, "modified")];
    ledger
        .insert_patch_set(&patch_set, &changed_files)
        .expect("insert patch set");

    let artifact_dir = repo
        .join(".aichestra/artifacts/sessions")
        .join(&session.id)
        .join("review-seed");
    fs::create_dir_all(&artifact_dir).expect("artifact dir");
    let manifest_path = artifact_dir.join("change-manifest.yaml");
    let manifest_content = format!(
        "change_manifest:\n  session_id: \"{}\"\n  changed_areas:\n    - file: \"{}\"\n",
        session.id, changed_file_path
    );
    let manifest_hash = if write_manifest {
        fs::write(&manifest_path, &manifest_content).expect("write manifest");
        Some(sha256_hex(manifest_content.as_bytes()))
    } else {
        None
    };
    let manifest = ChangeManifest {
        id: "manifest-review".to_string(),
        session_id: session.id.clone(),
        manifest_path: display_path_for_ledger(repo, &manifest_path),
        manifest_hash,
        validation_status: CHANGE_MANIFEST_VALIDATION_STATUS.to_string(),
        created_at_ms: now + 3,
    };
    ledger
        .insert_change_manifest(&manifest)
        .expect("insert manifest");

    let attempt = MergeAttempt {
        id: "merge-review".to_string(),
        session_id: session.id.clone(),
        status: MergeAttemptStatus::Verified,
        main_before_commit: "base-commit".to_string(),
        candidate_commit: "head-commit".to_string(),
        apply_strategy: PREFLIGHT_APPLY_STRATEGY.to_string(),
        verified_tree_id: Some("verified-tree".to_string()),
        verified_commit_id: Some("verified-commit".to_string()),
        checks_passed: true,
        semantic_risk_level: None,
    };
    ledger
        .insert_merge_attempt(&attempt, now + 4, now + 4)
        .expect("insert merge attempt");
    ledger
        .insert_check_result(&CheckResult {
            id: "check-review".to_string(),
            merge_attempt_id: attempt.id.clone(),
            name: "test".to_string(),
            command: "cargo test --all".to_string(),
            result: CheckResultStatus::Passed,
            stdout_artifact: None,
            stderr_artifact: None,
            created_at_ms: now + 5,
        })
        .expect("insert check");

    (session, attempt)
}

fn configure_semantic_review_command(repo: &Path, reviewer_id: &str, command: &str) {
    fs::write(
            repo.join(".aichestra/config.yaml"),
            format!(
                "semantic_review:\n  adapter: command\n  reviewer_id: {reviewer_id}\n  command: {command}\n  prompt_path: .aichestra/prompts/semantic-merge-review.md\n  risk_block_levels:\n    - blocked\n"
            ),
        )
        .expect("write semantic review config");
}

fn configure_semantic_review_llm(repo: &Path, reviewer_id: &str, provider: &str, command: &str) {
    fs::write(
            repo.join(".aichestra/config.yaml"),
            format!(
                "semantic_review:\n  adapter: llm\n  reviewer_provider: {provider}\n  reviewer_id: {reviewer_id}\n  command: {command}\n  prompt_path: .aichestra/prompts/semantic-merge-review.md\n  risk_block_levels:\n    - blocked\n"
            ),
        )
        .expect("write semantic review llm config");
}

fn configure_provider_command(repo: &Path, provider: &str, command: &str) {
    fs::write(
        repo.join(".aichestra/config.yaml"),
        format!(
            "providers:\n  {provider}:\n    command: {}\n",
            yaml_single_quote(command)
        ),
    )
    .expect("write provider command config");
}

fn yaml_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn write_agent_test_command(
    repo: &Path,
    script_stem: &str,
    powershell_script: &str,
    shell_script: &str,
) -> String {
    if cfg!(windows) {
        let script_path = repo.join(format!("{script_stem}.ps1"));
        fs::write(&script_path, powershell_script).expect("write script");
        format!(
            "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"{}\"",
            script_path.display()
        )
    } else {
        let script_path = repo.join(format!("{script_stem}.sh"));
        fs::write(&script_path, shell_script).expect("write script");
        format!("sh \"{}\"", script_path.display())
    }
}

fn configure_main_branch(repo: &Path, branch: &str) {
    let config_path = repo.join(".aichestra/config.yaml");
    let config = fs::read_to_string(&config_path).expect("read config");
    let updated = if config.contains("main_branch:") {
        config
            .lines()
            .map(|line| {
                if line.trim_start().starts_with("main_branch:") {
                    format!("  main_branch: {branch}")
                } else {
                    line.to_string()
                }
            })
            .collect::<Vec<_>>()
            .join("\n")
    } else {
        format!("{config}\ngit:\n  main_branch: {branch}\n")
    };
    fs::write(config_path, updated).expect("write main branch config");
}

fn configure_session_branch_prefix(repo: &Path, branch_prefix: &str) {
    let config_path = repo.join(".aichestra/config.yaml");
    let config = fs::read_to_string(&config_path).expect("read config");
    let updated = config
        .lines()
        .map(|line| {
            if line.trim_start().starts_with("branch_prefix:") {
                format!("  branch_prefix: {branch_prefix}")
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n");
    fs::write(config_path, updated).expect("write session branch prefix config");
}

fn seed_session_with_status(repo: &Path, id: &str, status: SessionStatus) -> Session {
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let now = now_millis();
    let mut session = Session::new(
        id,
        format!("session {id}"),
        "codex",
        format!("aich/session/{id}"),
        format!(".aichestra/worktrees/{id}"),
        "base-commit",
        now,
    );
    session.status = status;
    session.updated_at_ms = now + 1;
    ledger.insert_session(&session).expect("insert session");
    session
}

fn mark_session_cleaned(repo: &Path, session_id: &str) {
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    ledger
        .append_event(
            &NewEvent::new(EventName::SessionCleaned)
                .with_subject("session", session_id)
                .with_data_json("{\"cleanup_kind\":\"test\"}"),
        )
        .expect("append cleanup event");
}

fn seed_running_agent_session(repo: &Path, id: &str, provider: &str) -> Session {
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let now = now_millis();
    let worktree_path = repo.join(".aichestra/worktrees").join(id);
    fs::create_dir_all(&worktree_path).expect("create session worktree");
    let mut session = Session::new(
        id,
        format!("agent task {id}"),
        provider,
        format!("aich/session/{id}"),
        display_path_for_ledger(repo, &worktree_path),
        "base-commit",
        now,
    );
    session.status = SessionStatus::Running;
    session.target_path = Some("README.md".to_string());
    session.updated_at_ms = now + 1;
    ledger.insert_session(&session).expect("insert session");
    session
}

fn seed_enqueued_candidate(repo: &Path, id: &str) -> Session {
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let now = now_millis();
    let mut session = Session::new(
        id,
        format!("candidate {id}"),
        "codex",
        format!("aich/session/{id}"),
        format!(".aichestra/worktrees/{id}"),
        "base-commit",
        now,
    );
    session.status = SessionStatus::Enqueued;
    session.head_commit = Some("head-commit".to_string());
    session.updated_at_ms = now + 1;
    ledger.insert_session(&session).expect("insert session");

    let patch_set = PatchSet {
        id: format!("patch-{id}"),
        session_id: session.id.clone(),
        base_commit: "base-commit".to_string(),
        head_commit: Some("head-commit".to_string()),
        patch_id: Some("head-commit".to_string()),
        diff_stat: Some(" README.md | 1 +\n".to_string()),
        created_at_ms: now + 2,
    };
    ledger
        .insert_patch_set(&patch_set, &[ChangedFile::new("README.md", "modified")])
        .expect("insert patch set");

    let artifact_dir = repo
        .join(".aichestra/artifacts/sessions")
        .join(&session.id)
        .join("completion");
    fs::create_dir_all(&artifact_dir).expect("artifact dir");
    let manifest_path = artifact_dir.join("change-manifest.yaml");
    let manifest_content = format!(
        "change_manifest:\n  session_id: \"{}\"\n  changed_areas:\n    - file: \"README.md\"\n",
        session.id
    );
    fs::write(&manifest_path, &manifest_content).expect("write manifest");
    ledger
        .insert_change_manifest(&ChangeManifest {
            id: format!("manifest-{id}"),
            session_id: session.id.clone(),
            manifest_path: display_path_for_ledger(repo, &manifest_path),
            manifest_hash: Some(sha256_hex(manifest_content.as_bytes())),
            validation_status: CHANGE_MANIFEST_VALIDATION_STATUS.to_string(),
            created_at_ms: now + 3,
        })
        .expect("insert manifest");

    session
}

fn insert_queue_candidate(
    ledger: &Ledger,
    id: &str,
    session_status: SessionStatus,
    attempt_status: Option<MergeAttemptStatus>,
    approved: bool,
) {
    let now = now_millis();
    let mut session = Session::new(
        id,
        format!("queue task {id}"),
        "codex",
        format!("aich/session/{id}"),
        format!(".aichestra/worktrees/{id}"),
        "base-commit",
        now,
    );
    session.status = session_status;
    session.head_commit = Some(format!("{id}-head"));
    session.updated_at_ms = now + 1;
    ledger
        .insert_session(&session)
        .expect("insert queue session");

    let Some(status) = attempt_status else {
        return;
    };

    let needs_verified_ids = matches!(
        status,
        MergeAttemptStatus::Verified | MergeAttemptStatus::Applying | MergeAttemptStatus::Applied
    );
    let attempt = MergeAttempt {
        id: format!("merge-{id}"),
        session_id: id.to_string(),
        status,
        main_before_commit: "base-commit".to_string(),
        candidate_commit: format!("{id}-head"),
        apply_strategy: PREFLIGHT_APPLY_STRATEGY.to_string(),
        verified_tree_id: needs_verified_ids.then(|| format!("{id}-tree")),
        verified_commit_id: needs_verified_ids.then(|| format!("{id}-verified")),
        checks_passed: needs_verified_ids,
        semantic_risk_level: needs_verified_ids.then(|| "medium".to_string()),
    };
    ledger
        .insert_merge_attempt(&attempt, now + 2, now + 2)
        .expect("insert queue attempt");

    if approved {
        ledger
            .insert_approval(&Approval {
                id: format!("approval-{id}"),
                merge_attempt_id: attempt.id,
                approved_by: DEFAULT_OPERATOR_ID.to_string(),
                approved_verified_tree_id: format!("{id}-tree"),
                approved_verified_commit_id: format!("{id}-verified"),
                created_at_ms: now + 3,
            })
            .expect("insert queue approval");
    }
}

fn write_semantic_review_test_command(
    repo: &Path,
    script_stem: &str,
    powershell_script: &str,
    shell_script: &str,
) -> String {
    if cfg!(windows) {
        let script_path = repo.join(format!("{script_stem}.ps1"));
        fs::write(&script_path, powershell_script).expect("write script");
        format!(
            "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"{}\"",
            script_path.display()
        )
    } else {
        let script_path = repo.join(format!("{script_stem}.sh"));
        fs::write(&script_path, shell_script).expect("write script");
        format!("sh \"{}\"", script_path.display())
    }
}

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
    assert!(input.contains("- reviewer: `mock_llm_reviewer`"));
    assert!(input.contains("- llm_executed: `true`"));

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
        r#"input=$(cat)
case "$input" in
  *"Semantic Review Input"*) ;;
  *) echo "missing semantic review input" >&2; exit 2 ;;
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
"#,
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
        },
        &MockGitRepository,
    )
    .unwrap_err();
    assert!(matches!(err, CliError::Usage(message) if message.contains("aich review")));

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
        &ledger,
        "session-enqueued",
        SessionStatus::Enqueued,
        None,
        false,
    );
    insert_queue_candidate(
        &ledger,
        "session-preflight",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::PreflightRunning),
        false,
    );
    insert_queue_candidate(
        &ledger,
        "session-verified",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Verified),
        false,
    );
    insert_queue_candidate(
        &ledger,
        "session-blocked",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Blocked),
        false,
    );
    insert_queue_candidate(
        &ledger,
        "session-approved",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Verified),
        true,
    );
    insert_queue_candidate(
        &ledger,
        "session-applying",
        SessionStatus::Enqueued,
        Some(MergeAttemptStatus::Applying),
        true,
    );
    insert_queue_candidate(
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
    assert!(output.contains("next: aich review session-verified"));
    assert!(output.contains("next: aich apply session-approved"));
    assert!(output.contains("next: aich apply session-applying"));
    assert!(!output.contains("session-applied ["));

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
    assert!(output.contains("Run `aich session complete session-blocked-check` after the fix"));
    assert!(output.contains("then run aich session complete session-blocked-check"));

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
