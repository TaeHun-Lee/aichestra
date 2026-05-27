use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

use crate::{
    run_git_output, run_git_stdout, run_git_success_with_config, NativeGitWorktreeManager,
    WorktreeError,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CheckCommand {
    pub name: String,
    pub program: String,
    pub args: Vec<String>,
    pub required: bool,
    pub timeout_ms: Option<u64>,
    pub env: Vec<(String, String)>,
}

impl CheckCommand {
    pub fn display_command(&self) -> String {
        let mut command = self.program.clone();
        for arg in &self.args {
            command.push(' ');
            command.push_str(arg);
        }
        command
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PreflightRequest {
    pub repo_path: PathBuf,
    pub sandbox_path: PathBuf,
    pub session_id: String,
    pub main_before_commit: String,
    pub candidate_commit: String,
    pub check_commands: Vec<CheckCommand>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PreflightCheckOutput {
    pub name: String,
    pub command: String,
    pub required: bool,
    pub timed_out: bool,
    pub passed: bool,
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PreflightVerified {
    pub verified_tree_id: String,
    pub verified_commit_id: String,
    pub checks: Vec<PreflightCheckOutput>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PreflightBlocked {
    pub reason: String,
    pub verified_tree_id: Option<String>,
    pub verified_commit_id: Option<String>,
    pub conflict_files: Vec<String>,
    pub merge_stdout: String,
    pub merge_stderr: String,
    pub checks: Vec<PreflightCheckOutput>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum PreflightOutcome {
    Verified(PreflightVerified),
    Blocked(PreflightBlocked),
}

pub trait PreflightRunner {
    fn run_preflight(&self, request: &PreflightRequest) -> Result<PreflightOutcome, WorktreeError>;
}

impl PreflightRunner for NativeGitWorktreeManager {
    fn run_preflight(&self, request: &PreflightRequest) -> Result<PreflightOutcome, WorktreeError> {
        validate_preflight_request(request)?;

        let parent = request.sandbox_path.parent().ok_or_else(|| {
            WorktreeError::InvalidRequest("sandbox path must have a parent directory".to_string())
        })?;
        fs::create_dir_all(parent)?;

        run_git_stdout(
            &request.repo_path,
            &[
                "worktree",
                "add",
                "--detach",
                &request.sandbox_path.display().to_string(),
                &request.main_before_commit,
            ],
        )?;

        let merge_output = run_git_output(
            &request.sandbox_path,
            &["merge", "--no-ff", "--no-commit", &request.candidate_commit],
        )?;
        if !merge_output.success {
            let conflict_files = run_git_stdout(
                &request.sandbox_path,
                &["diff", "--name-only", "--diff-filter=U"],
            )
            .unwrap_or_default()
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(ToString::to_string)
            .collect();

            return Ok(PreflightOutcome::Blocked(PreflightBlocked {
                reason: "mechanical_conflict".to_string(),
                verified_tree_id: None,
                verified_commit_id: None,
                conflict_files,
                merge_stdout: merge_output.stdout,
                merge_stderr: merge_output.stderr,
                checks: Vec::new(),
            }));
        }

        run_git_success_with_config(
            &request.sandbox_path,
            &[
                "commit",
                "-m",
                &format!("aich: verified {}", request.session_id),
            ],
        )?;
        let verified_commit_id = run_git_stdout(&request.sandbox_path, &["rev-parse", "HEAD"])?
            .trim()
            .to_string();
        let verified_tree_id =
            run_git_stdout(&request.sandbox_path, &["rev-parse", "HEAD^{tree}"])?
                .trim()
                .to_string();

        let mut checks = Vec::new();
        for command in &request.check_commands {
            checks.push(run_check_command(&request.sandbox_path, command)?);
        }

        if checks.iter().any(|check| check.required && !check.passed) {
            return Ok(PreflightOutcome::Blocked(PreflightBlocked {
                reason: "checks_failed".to_string(),
                verified_tree_id: Some(verified_tree_id),
                verified_commit_id: Some(verified_commit_id),
                conflict_files: Vec::new(),
                merge_stdout: merge_output.stdout,
                merge_stderr: merge_output.stderr,
                checks,
            }));
        }

        Ok(PreflightOutcome::Verified(PreflightVerified {
            verified_tree_id,
            verified_commit_id,
            checks,
        }))
    }
}

pub fn validate_preflight_request(request: &PreflightRequest) -> Result<(), WorktreeError> {
    if request.session_id.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "session id is required".to_string(),
        ));
    }
    if request.main_before_commit.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "main_before_commit is required".to_string(),
        ));
    }
    if request.candidate_commit.trim().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "candidate commit is required".to_string(),
        ));
    }
    if request.sandbox_path.as_os_str().is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "sandbox path is required".to_string(),
        ));
    }
    if request.sandbox_path.exists() {
        return Err(WorktreeError::InvalidRequest(format!(
            "sandbox path already exists at {}",
            request.sandbox_path.display()
        )));
    }
    if request.check_commands.is_empty() {
        return Err(WorktreeError::InvalidRequest(
            "at least one check command is required".to_string(),
        ));
    }
    for command in &request.check_commands {
        if command.name.trim().is_empty() {
            return Err(WorktreeError::InvalidRequest(
                "check command name is required".to_string(),
            ));
        }
        if command.program.trim().is_empty() {
            return Err(WorktreeError::InvalidRequest(format!(
                "check command '{}' program is required",
                command.name
            )));
        }
        if command.timeout_ms == Some(0) {
            return Err(WorktreeError::InvalidRequest(format!(
                "check command '{}' timeout must be greater than zero",
                command.name
            )));
        }
        for (key, _) in &command.env {
            if key.trim().is_empty() || key.contains('=') {
                return Err(WorktreeError::InvalidRequest(format!(
                    "check command '{}' has an invalid env key",
                    command.name
                )));
            }
        }
    }

    Ok(())
}

fn run_check_command(
    worktree_path: &Path,
    command: &CheckCommand,
) -> Result<PreflightCheckOutput, WorktreeError> {
    let (output, timed_out) = run_check_process(worktree_path, command)?;
    let mut stderr = String::from_utf8_lossy(&output.stderr).into_owned();
    if timed_out {
        if !stderr.ends_with('\n') && !stderr.is_empty() {
            stderr.push('\n');
        }
        stderr.push_str(&format!(
            "check '{}' timed out after {} ms\n",
            command.name,
            command.timeout_ms.unwrap_or_default()
        ));
    }

    Ok(PreflightCheckOutput {
        name: command.name.clone(),
        command: command.display_command(),
        required: command.required,
        timed_out,
        passed: output.status.success() && !timed_out,
        code: output.status.code(),
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr,
    })
}

fn run_check_process(
    worktree_path: &Path,
    command: &CheckCommand,
) -> Result<(Output, bool), WorktreeError> {
    let mut child = Command::new(&command.program)
        .args(&command.args)
        .envs(command.env.iter().map(|(key, value)| (key, value)))
        .current_dir(worktree_path)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    let Some(timeout_ms) = command.timeout_ms else {
        return Ok((child.wait_with_output()?, false));
    };

    let timeout = Duration::from_millis(timeout_ms);
    let started = Instant::now();
    loop {
        if child.try_wait()?.is_some() {
            return Ok((child.wait_with_output()?, false));
        }

        if started.elapsed() >= timeout {
            let _ = child.kill();
            return Ok((child.wait_with_output()?, true));
        }

        sleep(Duration::from_millis(50).min(timeout.saturating_sub(started.elapsed())));
    }
}
