use std::error::Error;
use std::fmt::{Display, Formatter};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use aich_core::clock::now_millis;
use aich_core::{EventName, NewEvent, Session, SessionStatus};
use aich_git::{
    CreateWorktreeRequest, GitRepository, NativeGitWorktreeManager, WorktreeError, WorktreeManager,
};
use aich_ledger::Ledger;

static SESSION_COUNTER: AtomicU64 = AtomicU64::new(1);

const DEFAULT_CONFIG: &str = r#"project:
  name: aichestra-local-mvp
  mode: local-single-user

storage:
  sqlite_path: .aichestra/aichestra.db
  artifact_dir: .aichestra/artifacts
  worktree_dir: .aichestra/worktrees
  sandbox_dir: .aichestra/sandboxes

sessions:
  branch_prefix: aich/session
  require_dedicated_worktree: true
  disallow_main_worktree_for_llm: true
  completion_trigger: human_command

merge:
  queue_mode: sequential
  sandbox_strategy: temporary_worktree
  apply_policy: verified_tree_only
  require_human_approval: true
  block_if_main_moved_after_preflight: true
  semantic_review_required: true

manifest:
  required: true
  validate_against_diff: true
  warn_on_context_hash_change: true
  block_on_manifest_diff_mismatch: false

checks:
  commands:
    - name: fmt
      command: cargo fmt --all -- --check
      required: true
    - name: clippy
      command: cargo clippy --all-targets -- -D warnings
      required: true
    - name: test
      command: cargo test --all
      required: true

semantic_review:
  reviewer_provider: codex
  prompt_path: .aichestra/prompts/semantic-merge-review.md
  risk_block_levels:
    - blocked
  allow_patch_suggestions: true
  auto_apply_patch_suggestions: false

context:
  files:
    - AGENTS.md
    - CLAUDE.md
    - .aichestra/config.yaml
    - .aichestra/prompts/change-manifest.md
    - .aichestra/prompts/semantic-merge-review.md
  hash_algorithm: sha256

safety:
  warn_if_main_dirty: true
  refuse_apply_if_main_dirty: true
  refuse_force_push_features: true
"#;

#[derive(Debug)]
pub enum CliError {
    Io(std::io::Error),
    Git(WorktreeError),
    Ledger(aich_ledger::LedgerError),
    Usage(String),
}

impl Display for CliError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(error) => write!(f, "io error: {error}"),
            Self::Git(error) => write!(f, "{error}"),
            Self::Ledger(error) => write!(f, "{error}"),
            Self::Usage(message) => write!(f, "{message}"),
        }
    }
}

impl Error for CliError {}

impl From<std::io::Error> for CliError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<aich_ledger::LedgerError> for CliError {
    fn from(value: aich_ledger::LedgerError) -> Self {
        Self::Ledger(value)
    }
}

impl From<WorktreeError> for CliError {
    fn from(value: WorktreeError) -> Self {
        Self::Git(value)
    }
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct InitResult {
    pub repo_root: PathBuf,
    pub db_path: PathBuf,
    pub config_created: bool,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct InitOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub struct SessionStartResult {
    pub session: Session,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct StatusOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    recent_events_limit: usize,
}

#[derive(Debug, Clone, Eq, PartialEq)]
struct SessionStartOptions {
    repo_root: PathBuf,
    db_path: Option<PathBuf>,
    goal: String,
    provider: String,
    target_path: Option<String>,
}

pub fn run_with_cwd<I, S, W>(args: I, cwd: &Path, out: &mut W) -> Result<(), CliError>
where
    I: IntoIterator<Item = S>,
    S: Into<String>,
    W: Write,
{
    let args = normalize_args(args);
    match args.first().map(String::as_str) {
        Some("init") => {
            let options = parse_init_options(&args[1..], cwd)?;
            let result = init_repo(&options)?;
            writeln!(
                out,
                "Initialized Aichestra repository at {}",
                result.repo_root.display()
            )?;
            writeln!(out, "Ledger: {}", result.db_path.display())?;
            if result.config_created {
                writeln!(out, "Created .aichestra/config.yaml")?;
            }
            Ok(())
        }
        Some("session") => run_session_command(&args[1..], cwd, out),
        Some("status") => {
            let options = parse_status_options(&args[1..], cwd)?;
            render_status(&options, out)
        }
        Some("-h") | Some("--help") | None => {
            write_usage(out)?;
            Ok(())
        }
        Some(command) => Err(CliError::Usage(format!(
            "unknown command '{command}'\n\n{}",
            usage_text()
        ))),
    }
}

fn run_session_command<W: Write>(args: &[String], cwd: &Path, out: &mut W) -> Result<(), CliError> {
    match args.first().map(String::as_str) {
        Some("start") => {
            let options = parse_session_start_options(&args[1..], cwd)?;
            let git = NativeGitWorktreeManager;
            let result = start_session_with(&options, &git, &git)?;
            writeln!(out, "Started session {}", result.session.id)?;
            writeln!(out, "Branch: {}", result.session.branch)?;
            writeln!(out, "Worktree: {}", result.session.worktree_path)?;
            writeln!(out, "Base commit: {}", result.session.base_commit)?;
            if let Some(target_path) = result.session.target_path.as_deref() {
                writeln!(out, "Target: {target_path}")?;
            }
            Ok(())
        }
        Some("-h") | Some("--help") | None => Err(CliError::Usage(usage_text())),
        Some(command) => Err(CliError::Usage(format!(
            "unknown session command '{command}'\n\n{}",
            usage_text()
        ))),
    }
}

fn normalize_args<I, S>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: Into<String>,
{
    let mut args: Vec<String> = args.into_iter().map(Into::into).collect();
    if args
        .first()
        .map(|arg| arg.ends_with("aich") || arg.ends_with("aich.exe"))
        .unwrap_or(false)
    {
        args.remove(0);
    }
    args
}

fn parse_init_options(args: &[String], cwd: &Path) -> Result<InitOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown init option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(InitOptions { repo_root, db_path })
}

fn parse_status_options(args: &[String], cwd: &Path) -> Result<StatusOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut recent_events_limit = 5;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--recent-events" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage(
                        "--recent-events requires a number".to_string(),
                    ));
                };
                recent_events_limit = value.parse::<usize>().map_err(|_| {
                    CliError::Usage("--recent-events requires a non-negative number".to_string())
                })?;
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown status option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    Ok(StatusOptions {
        repo_root,
        db_path,
        recent_events_limit,
    })
}

fn parse_session_start_options(
    args: &[String],
    cwd: &Path,
) -> Result<SessionStartOptions, CliError> {
    let mut repo_root = cwd.to_path_buf();
    let mut db_path = None;
    let mut goal = None;
    let mut provider = "codex".to_string();
    let mut target_path = None;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "--repo" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--repo requires a path".to_string()));
                };
                repo_root = PathBuf::from(value);
            }
            "--db" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--db requires a path".to_string()));
                };
                db_path = Some(PathBuf::from(value));
            }
            "--goal" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--goal requires text".to_string()));
                };
                goal = Some(value.clone());
            }
            "--provider" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage(
                        "--provider requires a provider".to_string(),
                    ));
                };
                provider = value.clone();
            }
            "--target" => {
                index += 1;
                let Some(value) = args.get(index) else {
                    return Err(CliError::Usage("--target requires a path".to_string()));
                };
                target_path = Some(value.clone());
            }
            "-h" | "--help" => {
                return Err(CliError::Usage(usage_text()));
            }
            other => {
                return Err(CliError::Usage(format!(
                    "unknown session start option '{other}'\n\n{}",
                    usage_text()
                )));
            }
        }
        index += 1;
    }

    let Some(goal) = goal.filter(|value| !value.trim().is_empty()) else {
        return Err(CliError::Usage("session start requires --goal".to_string()));
    };

    Ok(SessionStartOptions {
        repo_root,
        db_path,
        goal,
        provider,
        target_path,
    })
}

fn render_status<W: Write>(options: &StatusOptions, out: &mut W) -> Result<(), CliError> {
    let db_path = options
        .db_path
        .clone()
        .unwrap_or_else(|| options.repo_root.join(".aichestra").join("aichestra.db"));
    if !db_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra ledger not found at {}; run `aich init` first",
            db_path.display()
        )));
    }

    let ledger = Ledger::open(&db_path)?;
    let sessions = ledger.list_sessions()?;
    let event_count = ledger.event_count()?;
    let recent_events = ledger.recent_events(options.recent_events_limit)?;

    writeln!(out, "Aichestra status")?;
    writeln!(out, "Repo: {}", options.repo_root.display())?;
    writeln!(out, "Ledger: {}", db_path.display())?;
    writeln!(out, "Sessions: {}", sessions.len())?;

    if sessions.is_empty() {
        writeln!(out, "No sessions recorded.")?;
    } else {
        for session in sessions {
            writeln!(out, "- {} [{}]", session.id, session.status.as_str())?;
            writeln!(out, "  provider: {}", session.provider)?;
            writeln!(out, "  branch: {}", session.branch)?;
            writeln!(out, "  worktree: {}", session.worktree_path)?;
            writeln!(
                out,
                "  target: {}",
                session.target_path.as_deref().unwrap_or("-")
            )?;
            writeln!(out, "  base: {}", short_hash(&session.base_commit))?;
        }
    }

    writeln!(out, "Events: {event_count}")?;
    if !recent_events.is_empty() {
        writeln!(out, "Recent events:")?;
        for event in recent_events {
            let subject = match (event.subject_type.as_deref(), event.subject_id.as_deref()) {
                (Some(subject_type), Some(subject_id)) => {
                    format!(" {subject_type}:{subject_id}")
                }
                (Some(subject_type), None) => format!(" {subject_type}"),
                _ => String::new(),
            };
            writeln!(out, "- #{} {}{}", event.id, event.name, subject)?;
        }
    }

    Ok(())
}

fn init_repo(options: &InitOptions) -> Result<InitResult, CliError> {
    fs::create_dir_all(&options.repo_root)?;
    let aichestra_dir = options.repo_root.join(".aichestra");
    fs::create_dir_all(aichestra_dir.join("artifacts"))?;
    fs::create_dir_all(aichestra_dir.join("sandboxes"))?;
    fs::create_dir_all(aichestra_dir.join("worktrees"))?;

    let config_path = aichestra_dir.join("config.yaml");
    let config_created = if config_path.exists() {
        false
    } else {
        fs::write(&config_path, DEFAULT_CONFIG)?;
        true
    };

    let db_path = options
        .db_path
        .clone()
        .unwrap_or_else(|| aichestra_dir.join("aichestra.db"));
    let ledger = Ledger::open(&db_path)?;
    ledger.record_repo_initialized(&options.repo_root)?;

    Ok(InitResult {
        repo_root: options.repo_root.clone(),
        db_path,
        config_created,
    })
}

fn start_session_with<R, W>(
    options: &SessionStartOptions,
    git_repo: &R,
    worktree_manager: &W,
) -> Result<SessionStartResult, CliError>
where
    R: GitRepository,
    W: WorktreeManager,
{
    let aichestra_dir = options.repo_root.join(".aichestra");
    let config_path = aichestra_dir.join("config.yaml");
    if !config_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra config not found at {}; run `aich init` first",
            config_path.display()
        )));
    }

    fs::create_dir_all(aichestra_dir.join("worktrees"))?;
    let db_path = options
        .db_path
        .clone()
        .unwrap_or_else(|| aichestra_dir.join("aichestra.db"));
    let ledger = Ledger::open(&db_path)?;
    let head = git_repo.head_commit(&options.repo_root)?;
    let created_at_ms = now_millis();
    let session_id = next_session_id(created_at_ms);
    let branch = format!("aich/session/{session_id}");
    let worktree_path = aichestra_dir.join("worktrees").join(&session_id);

    let mut session = Session::new(
        session_id.clone(),
        options.goal.clone(),
        options.provider.clone(),
        branch.clone(),
        worktree_path.display().to_string(),
        head.commit_id.clone(),
        created_at_ms,
    );
    session.target_path = options.target_path.clone();

    ledger.insert_session(&session)?;
    ledger.append_event(
        &NewEvent::new(EventName::SessionCreated).with_subject("session", session.id.clone()),
    )?;

    let request = CreateWorktreeRequest {
        repo_path: options.repo_root.clone(),
        main_worktree_path: options.repo_root.clone(),
        session_id: session.id.clone(),
        branch: branch.clone(),
        base_ref: head.commit_id.clone(),
        worktree_path,
    };

    if let Err(error) = worktree_manager.create_session_worktree(&request) {
        let _ = ledger.update_session_status(&session.id, SessionStatus::Blocked, now_millis());
        return Err(error.into());
    }

    session.status = SessionStatus::Running;
    session.updated_at_ms = now_millis();
    ledger.update_session_status(&session.id, SessionStatus::Running, session.updated_at_ms)?;
    ledger.append_event(
        &NewEvent::new(EventName::WorktreeCreated)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"branch\":\"{}\",\"worktree_path\":\"{}\"}}",
                json_escape(&session.branch),
                json_escape(&session.worktree_path)
            )),
    )?;
    ledger.append_event(
        &NewEvent::new(EventName::SessionStarted).with_subject("session", session.id.clone()),
    )?;

    Ok(SessionStartResult { session })
}

fn next_session_id(created_at_ms: i64) -> String {
    let counter = SESSION_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("session-{created_at_ms}-{counter}")
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

fn short_hash(value: &str) -> String {
    value.chars().take(7).collect()
}

fn write_usage<W: Write>(out: &mut W) -> Result<(), CliError> {
    writeln!(out, "{}", usage_text())?;
    Ok(())
}

fn usage_text() -> String {
    "Usage:\n  aich init [--repo PATH] [--db PATH]\n  aich status [--repo PATH] [--db PATH] [--recent-events N]\n  aich session start --goal TEXT [--provider PROVIDER] [--target PATH] [--repo PATH] [--db PATH]".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use aich_git::{validate_worktree_request, HeadCommit, SessionWorktree};
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
        let events = ledger.list_events().expect("events");
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].name, "repo.initialized");

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn session_start_requires_goal() {
        let err = parse_session_start_options(&[], Path::new(".")).unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("--goal")));
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
        };
        let git = MockGitRepository;
        let worktrees = MockWorktreeManager::new();

        let result = start_session_with(&options, &git, &worktrees).expect("start session");

        assert_eq!(result.session.goal, "add auth guard");
        assert_eq!(result.session.provider, "codex");
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
}
