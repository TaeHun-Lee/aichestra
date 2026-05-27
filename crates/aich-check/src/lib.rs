use std::error::Error;
use std::fmt::{Display, Formatter};
use std::path::Path;
use std::process::{Command, Output, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant};

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
pub struct CheckOutput {
    pub name: String,
    pub command: String,
    pub required: bool,
    pub timed_out: bool,
    pub passed: bool,
    pub code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug)]
pub enum CheckError {
    InvalidRequest(String),
    Io(std::io::Error),
}

impl Display for CheckError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidRequest(message) => write!(f, "{message}"),
            Self::Io(error) => write!(f, "io error: {error}"),
        }
    }
}

impl Error for CheckError {}

impl From<std::io::Error> for CheckError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

pub fn validate_check_command(command: &CheckCommand) -> Result<(), CheckError> {
    if command.name.trim().is_empty() {
        return Err(CheckError::InvalidRequest(
            "check command name is required".to_string(),
        ));
    }
    if command.program.trim().is_empty() {
        return Err(CheckError::InvalidRequest(format!(
            "check command '{}' program is required",
            command.name
        )));
    }
    if command.timeout_ms == Some(0) {
        return Err(CheckError::InvalidRequest(format!(
            "check command '{}' timeout must be greater than zero",
            command.name
        )));
    }
    for (key, _) in &command.env {
        if key.trim().is_empty() || key.contains('=') {
            return Err(CheckError::InvalidRequest(format!(
                "check command '{}' has an invalid env key",
                command.name
            )));
        }
    }

    Ok(())
}

pub fn run_check_command(
    worktree_path: &Path,
    command: &CheckCommand,
) -> Result<CheckOutput, CheckError> {
    validate_check_command(command)?;
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

    Ok(CheckOutput {
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
) -> Result<(Output, bool), CheckError> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_check_command_shape() {
        let command = CheckCommand {
            name: "test".to_string(),
            program: "cargo".to_string(),
            args: vec!["test".to_string()],
            required: true,
            timeout_ms: Some(1_000),
            env: vec![("AICH_CHECK_MODE".to_string(), "test".to_string())],
        };

        validate_check_command(&command).expect("valid command");
    }

    #[test]
    fn rejects_invalid_check_env_key() {
        let command = CheckCommand {
            name: "test".to_string(),
            program: "cargo".to_string(),
            args: vec!["test".to_string()],
            required: true,
            timeout_ms: None,
            env: vec![("BAD=KEY".to_string(), "value".to_string())],
        };

        let err = validate_check_command(&command).unwrap_err();
        assert!(matches!(err, CheckError::InvalidRequest(message) if message.contains("env key")));
    }
}
