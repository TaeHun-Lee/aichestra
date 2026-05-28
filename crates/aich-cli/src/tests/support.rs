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
        assert!(request.related_manifests.is_empty());
        let diff_patch_context = request.diff_patch_context.expect("diff patch context");
        assert!(diff_patch_context.artifact_path.ends_with("diff.patch"));
        assert!(diff_patch_context
            .content
            .as_deref()
            .expect("patch content")
            .contains("+review candidate change"));
        assert!(!diff_patch_context.truncated);

        Ok(LocalSemanticReviewReport {
            risk_level: SemanticRiskLevel::Low,
            summary: "Mock LLM adapter reviewed the candidate.".to_string(),
            suspected_conflicts: Vec::new(),
            required_actions: Vec::new(),
            suggested_tests: vec!["cargo test --all".to_string()],
            proposed_patch: ProposedPatch::unavailable(),
            uncertainty: vec!["Mock adapter output is test-only.".to_string()],
        })
    }
}

struct RelatedManifestSemanticReviewAdapter;

impl SemanticReviewAdapter for RelatedManifestSemanticReviewAdapter {
    fn reviewer_id(&self) -> &str {
        "related_manifest_reviewer"
    }

    fn llm_executed(&self) -> bool {
        true
    }

    fn review(
        &self,
        request: &SemanticReviewAdapterRequest<'_>,
    ) -> Result<LocalSemanticReviewReport, CliError> {
        assert_eq!(request.related_manifests.len(), 2);
        assert_eq!(request.related_manifests[0].relation.as_str(), "applied");
        assert_eq!(
            request.related_manifests[0].session_id,
            "session-applied-context"
        );
        assert!(request.related_manifests[0]
            .manifest_content
            .as_deref()
            .unwrap_or("")
            .contains("session-applied-context"));
        assert_eq!(request.related_manifests[1].relation.as_str(), "queued");
        assert_eq!(
            request.related_manifests[1].session_id,
            "session-queued-context"
        );
        assert!(request.related_manifests[1]
            .manifest_content
            .as_deref()
            .unwrap_or("")
            .contains("session-queued-context"));

        Ok(LocalSemanticReviewReport {
            risk_level: SemanticRiskLevel::Low,
            summary: "Related manifests were included.".to_string(),
            suspected_conflicts: Vec::new(),
            required_actions: Vec::new(),
            suggested_tests: Vec::new(),
            proposed_patch: ProposedPatch::unavailable(),
            uncertainty: Vec::new(),
        })
    }
}

struct ProposedPatchSemanticReviewAdapter;

impl SemanticReviewAdapter for ProposedPatchSemanticReviewAdapter {
    fn reviewer_id(&self) -> &str {
        "proposed_patch_reviewer"
    }

    fn llm_executed(&self) -> bool {
        true
    }

    fn review(
        &self,
        _request: &SemanticReviewAdapterRequest<'_>,
    ) -> Result<LocalSemanticReviewReport, CliError> {
        Ok(LocalSemanticReviewReport {
            risk_level: SemanticRiskLevel::Low,
            summary: "Reviewer proposed a follow-up fix.".to_string(),
            suspected_conflicts: Vec::new(),
            required_actions: vec!["Apply the proposed README wording fix.".to_string()],
            suggested_tests: vec!["cargo test --all".to_string()],
            proposed_patch: ProposedPatch {
                available: true,
                description: Some("Update README wording from the review.".to_string()),
                patch: Some(
                    "diff --git a/README.md b/README.md\n@@ -1 +1 @@\n-old\n+new\n".to_string(),
                ),
                fix_plan_artifact: None,
                patch_artifact: None,
            },
            uncertainty: vec!["Proposed patch is advisory.".to_string()],
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
    let diff_patch_path = artifact_dir.join("diff.patch");
    let diff_patch_content = format!(
        "diff --git a/{changed_file_path} b/{changed_file_path}\n@@ -1 +1 @@\n+review candidate change\n"
    );
    fs::write(&diff_patch_path, diff_patch_content).expect("write diff patch");
    let manifest_content = format!(
        "change_manifest:\n  session_id: \"{}\"\n  changed_areas:\n    - file: \"{}\"\n  evidence:\n    diff_patch_artifact: \"{}\"\n",
        session.id,
        changed_file_path,
        display_path_for_ledger(repo, &diff_patch_path)
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
        check_policy_fingerprint: Some(current_check_policy_fingerprint(repo)),
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
            required: true,
            timed_out: false,
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
                "{}semantic_review:\n  adapter: command\n  reviewer_id: {reviewer_id}\n  command: {command}\n  prompt_path: .aichestra/prompts/semantic-merge-review.md\n  risk_block_levels:\n    - blocked\n",
                default_checks_config_yaml()
            ),
        )
        .expect("write semantic review config");
}

fn configure_semantic_review_llm(repo: &Path, reviewer_id: &str, provider: &str, command: &str) {
    fs::write(
            repo.join(".aichestra/config.yaml"),
            format!(
                "{}semantic_review:\n  adapter: llm\n  reviewer_provider: {provider}\n  reviewer_id: {reviewer_id}\n  command: {command}\n  prompt_path: .aichestra/prompts/semantic-merge-review.md\n  risk_block_levels:\n    - blocked\n",
                default_checks_config_yaml()
            ),
        )
        .expect("write semantic review llm config");
}

fn configure_semantic_review_llm_with_timeout(
    repo: &Path,
    reviewer_id: &str,
    provider: &str,
    command: &str,
    timeout_ms: u64,
) {
    fs::write(
            repo.join(".aichestra/config.yaml"),
            format!(
                "{}semantic_review:\n  adapter: llm\n  reviewer_provider: {provider}\n  reviewer_id: {reviewer_id}\n  command: {command}\n  prompt_path: .aichestra/prompts/semantic-merge-review.md\n  timeout_ms: {timeout_ms}\n  risk_block_levels:\n    - blocked\n",
                default_checks_config_yaml()
            ),
        )
        .expect("write semantic review llm timeout config");
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

fn configure_single_check(repo: &Path, name: &str, command: &str, required: bool) {
    fs::write(
        repo.join(".aichestra/config.yaml"),
        format!(
            "checks:\n  commands:\n    - name: {name}\n      command: {}\n      required: {required}\n      timeout_seconds: 30\n",
            yaml_single_quote(command)
        ),
    )
    .expect("write check config");
}

fn default_checks_config_yaml() -> &'static str {
    "checks:\n  commands:\n    - name: fmt\n      command: cargo fmt --all -- --check\n      required: true\n      timeout_seconds: 600\n    - name: clippy\n      command: cargo clippy --all-targets -- -D warnings\n      required: true\n      timeout_seconds: 600\n    - name: test\n      command: cargo test --all\n      required: true\n      timeout_seconds: 600\n"
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

fn run_cli<I, S>(repo: &Path, args: I) -> String
where
    I: IntoIterator<Item = S>,
    S: Into<String>,
{
    let args: Vec<String> = args.into_iter().map(Into::into).collect();
    let command = args.join(" ");
    let mut output = Vec::new();
    run_with_cwd(args, repo, &mut output).unwrap_or_else(|error| {
        panic!(
            "CLI command `{command}` failed: {error}\n{}",
            String::from_utf8_lossy(&output)
        )
    });
    String::from_utf8(output).expect("utf8 CLI output")
}

fn run_test_git(repo: &Path, args: &[&str]) -> String {
    let output = process::Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .unwrap_or_else(|error| panic!("failed to run git {:?}: {error}", args));
    if !output.status.success() {
        panic!(
            "git {:?} failed with {}\nstdout:\n{}\nstderr:\n{}",
            args,
            output.status,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }

    String::from_utf8(output.stdout).expect("utf8 git stdout")
}

fn initialize_e2e_git_repo(repo: &Path) {
    fs::create_dir_all(repo).expect("create e2e repo");
    run_test_git(repo, &["init", "-q"]);
    run_test_git(repo, &["checkout", "-q", "-B", "main"]);
    run_test_git(repo, &["config", "user.name", "Aichestra Test"]);
    run_test_git(
        repo,
        &["config", "user.email", "aichestra-test@example.invalid"],
    );
    fs::write(repo.join("README.md"), "# E2E fixture\n").expect("write readme");
    fs::write(repo.join("app.txt"), "base\n").expect("write app");
    fs::write(
        repo.join(".gitignore"),
        "/.aichestra/aichestra.db\n\
         /.aichestra/aichestra.db-*\n\
         /.aichestra/artifacts/\n\
         /.aichestra/sandboxes/\n\
         /.aichestra/worktrees/\n",
    )
    .expect("write gitignore");
    run_test_git(repo, &["add", "README.md", "app.txt", ".gitignore"]);
    run_test_git(repo, &["commit", "-q", "-m", "initial"]);
}

fn commit_e2e_aichestra_project_files(repo: &Path) {
    run_test_git(
        repo,
        &[
            "add",
            ".aichestra/config.yaml",
            ".aichestra/prompts/change-manifest.md",
            ".aichestra/prompts/semantic-merge-review.md",
            ".aichestra/templates/change-manifest.yaml",
            ".aichestra/schemas/change-manifest.schema.yaml",
        ],
    );
    run_test_git(repo, &["commit", "-q", "-m", "configure aichestra"]);
}

fn write_e2e_config(
    repo: &Path,
    provider_command: &str,
    review_command: &str,
    check_command: &str,
) {
    fs::write(
        repo.join(".aichestra/config.yaml"),
        format!(
            "providers:\n  e2e-agent:\n    command: {}\n\
             git:\n  main_branch: main\n\
             checks:\n  commands:\n    - name: e2e-check\n      command: {}\n      required: true\n      timeout_seconds: 30\n\
             semantic_review:\n  adapter: command\n  reviewer_id: e2e_command_reviewer\n  command: {}\n  prompt_path: .aichestra/prompts/semantic-merge-review.md\n  risk_block_levels:\n    - blocked\n",
            yaml_single_quote(provider_command),
            yaml_single_quote(check_command),
            yaml_single_quote(review_command)
        ),
    )
    .expect("write e2e config");
}

fn parse_started_session_id(output: &str) -> String {
    output
        .lines()
        .find_map(|line| line.strip_prefix("Started session "))
        .expect("started session line")
        .to_string()
}

fn parse_semantic_review_id(output: &str) -> String {
    output
        .lines()
        .find_map(|line| line.strip_prefix("Semantic review: "))
        .expect("semantic review line")
        .to_string()
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

fn mark_seeded_candidate_applied(repo: &Path, session: &Session) {
    let ledger = Ledger::open(repo.join(".aichestra/aichestra.db")).expect("open ledger");
    let now = now_millis();
    let attempt = MergeAttempt {
        id: format!("merge-{}", session.id),
        session_id: session.id.clone(),
        status: MergeAttemptStatus::Applied,
        main_before_commit: "base-commit".to_string(),
        candidate_commit: session
            .head_commit
            .clone()
            .unwrap_or_else(|| "head-commit".to_string()),
        apply_strategy: PREFLIGHT_APPLY_STRATEGY.to_string(),
        check_policy_fingerprint: Some(current_check_policy_fingerprint(repo)),
        verified_tree_id: Some(format!("{}-tree", session.id)),
        verified_commit_id: Some(format!("{}-verified", session.id)),
        checks_passed: true,
        semantic_risk_level: Some("low".to_string()),
    };
    ledger
        .insert_merge_attempt(&attempt, now + 4, now + 4)
        .expect("insert applied attempt");
    ledger
        .update_session_status(&session.id, SessionStatus::Completed, now + 5)
        .expect("mark session completed");
}

fn insert_queue_candidate(
    repo: &Path,
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
        check_policy_fingerprint: Some(current_check_policy_fingerprint(repo)),
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

fn current_check_policy_fingerprint(repo: &Path) -> String {
    crate::checks::check_policy_fingerprint_from_config(&repo.join(".aichestra/config.yaml"))
        .expect("check policy fingerprint")
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
