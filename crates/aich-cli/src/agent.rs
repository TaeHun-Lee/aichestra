use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};

use aich_core::clock::now_millis;
use aich_core::{EventName, NewEvent, Operator, Session, SessionStatus};

use crate::command_line::{parse_process_command, ProcessCommandSpec};
use crate::config::provider_command_from_config;
use crate::formatting::{display_path_for_ledger, json_escape, path_from_ledger};
use crate::options::SessionRunOptions;
use crate::session::ensure_session_worktree_is_dedicated;
use crate::{open_existing_ledger, resolve_active_operator, CliError, SessionAgentRunResult};

static AGENT_RUN_COUNTER: AtomicU64 = AtomicU64::new(1);

pub(crate) fn run_session_agent_with(
    options: &SessionRunOptions,
) -> Result<SessionAgentRunResult, CliError> {
    let aichestra_dir = options.repo_root.join(".aichestra");
    let config_path = aichestra_dir.join("config.yaml");
    if !config_path.exists() {
        return Err(CliError::Usage(format!(
            "Aichestra config not found at {}; run `aich init` first",
            config_path.display()
        )));
    }

    let (_db_path, ledger) = open_existing_ledger(&options.repo_root, &options.db_path)?;
    let operator = resolve_active_operator(&ledger, options.operator_id.as_deref())?;
    let session = ledger.get_session(&options.session_id)?.ok_or_else(|| {
        CliError::Usage(format!("session '{}' does not exist", options.session_id))
    })?;
    ensure_session_can_run_agent(&session)?;

    let worktree_path = path_from_ledger(&options.repo_root, &session.worktree_path);
    ensure_session_worktree_is_dedicated(&options.repo_root, &worktree_path)?;
    if !worktree_path.is_dir() {
        return Err(CliError::Usage(format!(
            "session '{}' worktree does not exist at {}",
            session.id,
            worktree_path.display()
        )));
    }

    let command_line = provider_command_from_config(&config_path, &session.provider)?;
    let command = parse_process_command(
        &format!("providers.{}.command", session.provider),
        &command_line,
    )?;

    let started_at_ms = now_millis();
    let artifact_id = next_agent_run_id(started_at_ms);
    let artifacts = AgentRunArtifacts::new(&aichestra_dir, &session.id, &artifact_id);
    fs::create_dir_all(&artifacts.artifact_dir)?;
    let input = render_agent_input(&session);
    fs::write(&artifacts.input_path, &input)?;

    ledger.append_event(
        &NewEvent::new(EventName::SessionAgentStarted)
            .with_subject("session", session.id.clone())
            .with_data_json(format!(
                "{{\"operator_id\":\"{}\",\"provider\":\"{}\",\"command\":\"{}\",\"artifact_dir\":\"{}\"}}",
                json_escape(&operator.id),
                json_escape(&session.provider),
                json_escape(&command.display()),
                json_escape(&display_path_for_ledger(&options.repo_root, &artifacts.artifact_dir))
            )),
    )?;

    let output = match run_agent_command(&command, &input, &worktree_path) {
        Ok(output) => output,
        Err(error) => {
            fs::write(&artifacts.stderr_path, &error)?;
            write_agent_metadata(AgentMetadata {
                session: &session,
                operator: &operator,
                command: &command,
                started_at_ms,
                completed_at_ms: now_millis(),
                exit_code: None,
                repo_root: &options.repo_root,
                artifacts: &artifacts,
            })?;
            ledger.append_event(
                &NewEvent::new(EventName::SessionAgentFailed)
                    .with_subject("session", session.id.clone())
                    .with_data_json(format!(
                        "{{\"operator_id\":\"{}\",\"provider\":\"{}\",\"exit_code\":null,\"artifact_dir\":\"{}\",\"error\":\"{}\"}}",
                        json_escape(&operator.id),
                        json_escape(&session.provider),
                        json_escape(&display_path_for_ledger(&options.repo_root, &artifacts.artifact_dir)),
                        json_escape(&error)
                    )),
            )?;
            return Err(CliError::Usage(format!(
                "session agent command failed to run; artifacts: {}",
                artifacts.artifact_dir.display()
            )));
        }
    };

    fs::write(&artifacts.stdout_path, &output.stdout)?;
    fs::write(&artifacts.stderr_path, &output.stderr)?;
    let completed_at_ms = now_millis();
    let exit_code = output.status.code();
    write_agent_metadata(AgentMetadata {
        session: &session,
        operator: &operator,
        command: &command,
        started_at_ms,
        completed_at_ms,
        exit_code,
        repo_root: &options.repo_root,
        artifacts: &artifacts,
    })?;

    let success = output.status.success();
    ledger.append_event(
        &NewEvent::new(if success {
            EventName::SessionAgentCompleted
        } else {
            EventName::SessionAgentFailed
        })
        .with_subject("session", session.id.clone())
        .with_data_json(format!(
            "{{\"operator_id\":\"{}\",\"provider\":\"{}\",\"exit_code\":{},\"artifact_dir\":\"{}\"}}",
            json_escape(&operator.id),
            json_escape(&session.provider),
            exit_code
                .map(|code| code.to_string())
                .unwrap_or_else(|| "null".to_string()),
            json_escape(&display_path_for_ledger(&options.repo_root, &artifacts.artifact_dir))
        )),
    )?;

    let result = SessionAgentRunResult {
        provider: session.provider.clone(),
        session,
        operator,
        command: command.display(),
        artifact_dir: artifacts.artifact_dir,
        input_path: artifacts.input_path,
        stdout_path: artifacts.stdout_path,
        stderr_path: artifacts.stderr_path,
        metadata_path: artifacts.metadata_path,
        exit_code,
        success,
    };

    if !result.success {
        return Err(CliError::Usage(format!(
            "session agent command exited with {}; artifacts: {}",
            output.status,
            result.artifact_dir.display()
        )));
    }

    Ok(result)
}

fn ensure_session_can_run_agent(session: &Session) -> Result<(), CliError> {
    if session.status != SessionStatus::Running {
        return Err(CliError::Usage(format!(
            "session '{}' cannot run an agent from status '{}'; create or reopen a running session first",
            session.id,
            session.status.as_str()
        )));
    }
    Ok(())
}

fn run_agent_command(
    command_spec: &ProcessCommandSpec,
    input: &str,
    worktree_path: &Path,
) -> Result<Output, String> {
    let mut child = Command::new(&command_spec.program)
        .args(&command_spec.args)
        .current_dir(worktree_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            format!(
                "failed to start provider command `{}` in {}: {error}",
                command_spec.display(),
                worktree_path.display()
            )
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        if let Err(error) = stdin.write_all(input.as_bytes()) {
            if error.kind() != std::io::ErrorKind::BrokenPipe {
                return Err(format!(
                    "failed to write task input to provider command `{}`: {error}",
                    command_spec.display()
                ));
            }
        }
    } else {
        return Err(format!(
            "failed to open stdin for provider command `{}`",
            command_spec.display()
        ));
    }

    let output = child.wait_with_output().map_err(|error| {
        format!(
            "failed to wait for provider command `{}`: {error}",
            command_spec.display()
        )
    })?;

    Ok(output)
}

fn render_agent_input(session: &Session) -> String {
    let mut input = String::new();
    input.push_str("# Aichestra Worker Session\n\n");
    input.push_str("Work only in the current session worktree. Do not edit the main worktree.\n");
    input.push_str("Do not merge to main, approve, apply, or clean up the session.\n");
    input.push_str("When the coding task is done, leave files in the worktree for the user to run `aich session complete`.\n\n");
    input.push_str(&format!("Session ID: {}\n", session.id));
    input.push_str(&format!("Goal: {}\n", session.goal));
    input.push_str(&format!("Provider: {}\n", session.provider));
    input.push_str(&format!("Branch: {}\n", session.branch));
    input.push_str(&format!("Base commit: {}\n", session.base_commit));
    if let Some(target_path) = session.target_path.as_deref() {
        input.push_str(&format!("Target path: {target_path}\n"));
    }
    input
}

#[derive(Debug)]
struct AgentRunArtifacts {
    artifact_dir: PathBuf,
    input_path: PathBuf,
    stdout_path: PathBuf,
    stderr_path: PathBuf,
    metadata_path: PathBuf,
}

impl AgentRunArtifacts {
    fn new(aichestra_dir: &Path, session_id: &str, artifact_id: &str) -> Self {
        let artifact_dir = aichestra_dir
            .join("artifacts")
            .join("sessions")
            .join(session_id)
            .join("runs")
            .join(artifact_id);
        Self {
            input_path: artifact_dir.join("input.md"),
            stdout_path: artifact_dir.join("stdout.txt"),
            stderr_path: artifact_dir.join("stderr.txt"),
            metadata_path: artifact_dir.join("metadata.json"),
            artifact_dir,
        }
    }
}

struct AgentMetadata<'a> {
    session: &'a Session,
    operator: &'a Operator,
    command: &'a ProcessCommandSpec,
    started_at_ms: i64,
    completed_at_ms: i64,
    exit_code: Option<i32>,
    repo_root: &'a Path,
    artifacts: &'a AgentRunArtifacts,
}

fn write_agent_metadata(metadata: AgentMetadata<'_>) -> Result<(), CliError> {
    let artifacts = metadata.artifacts;
    fs::write(
        &artifacts.metadata_path,
        format!(
            "{{\"session_id\":\"{}\",\"operator_id\":\"{}\",\"provider\":\"{}\",\"command\":\"{}\",\"started_at_ms\":{},\"completed_at_ms\":{},\"exit_code\":{},\"input_path\":\"{}\",\"stdout_path\":\"{}\",\"stderr_path\":\"{}\"}}\n",
            json_escape(&metadata.session.id),
            json_escape(&metadata.operator.id),
            json_escape(&metadata.session.provider),
            json_escape(&metadata.command.display()),
            metadata.started_at_ms,
            metadata.completed_at_ms,
            metadata.exit_code
                .map(|code| code.to_string())
                .unwrap_or_else(|| "null".to_string()),
            json_escape(&display_path_for_ledger(metadata.repo_root, &artifacts.input_path)),
            json_escape(&display_path_for_ledger(metadata.repo_root, &artifacts.stdout_path)),
            json_escape(&display_path_for_ledger(metadata.repo_root, &artifacts.stderr_path))
        ),
    )?;
    Ok(())
}

fn next_agent_run_id(created_at_ms: i64) -> String {
    let counter = AGENT_RUN_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{created_at_ms}-{counter}")
}
