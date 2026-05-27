use std::fs;
use std::path::Path;

use aich_core::clock::now_millis;
use aich_core::{CheckResult, CheckResultStatus};
use aich_git::{CheckCommand, PreflightCheckOutput};
use aich_ledger::Ledger;

use crate::command_line::parse_check_command;
use crate::config::{load_config, AichestraCheckCommandConfig};
use crate::formatting::display_path_for_ledger;
use crate::CliError;

pub(crate) fn persist_preflight_checks(
    ledger: &Ledger,
    attempt_id: &str,
    artifact_dir: &Path,
    repo_root: &Path,
    checks: &[PreflightCheckOutput],
) -> Result<Vec<CheckResult>, CliError> {
    let check_dir = artifact_dir.join("checks");
    fs::create_dir_all(&check_dir)?;

    let mut results = Vec::new();
    for (index, check) in checks.iter().enumerate() {
        let safe_name = sanitize_artifact_name(&check.name);
        let stdout_path = check_dir.join(format!("{index}-{safe_name}.stdout"));
        let stderr_path = check_dir.join(format!("{index}-{safe_name}.stderr"));
        fs::write(&stdout_path, &check.stdout)?;
        fs::write(&stderr_path, &check.stderr)?;

        let check_result = CheckResult {
            id: format!("{attempt_id}-check-{index}"),
            merge_attempt_id: attempt_id.to_string(),
            name: check.name.clone(),
            command: check.command.clone(),
            required: check.required,
            timed_out: check.timed_out,
            result: if check.passed {
                CheckResultStatus::Passed
            } else {
                CheckResultStatus::Failed
            },
            stdout_artifact: Some(display_path_for_ledger(repo_root, &stdout_path)),
            stderr_artifact: Some(display_path_for_ledger(repo_root, &stderr_path)),
            created_at_ms: now_millis(),
        };
        ledger.insert_check_result(&check_result)?;
        results.push(check_result);
    }

    Ok(results)
}

pub(crate) fn check_commands_from_config(
    config_path: &Path,
) -> Result<Vec<CheckCommand>, CliError> {
    let config = load_config(config_path)?;
    let mut commands = config
        .checks
        .and_then(|checks| checks.commands)
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .map(|(index, command)| check_command_from_config(index, command))
        .collect::<Result<Vec<_>, _>>()?;

    if commands.is_empty() {
        commands.push(CheckCommand {
            name: "test".to_string(),
            program: "cargo".to_string(),
            args: vec!["test".to_string(), "--all".to_string()],
            required: true,
            timeout_ms: None,
            env: Vec::new(),
        });
    }

    Ok(commands)
}

fn check_command_from_config(
    index: usize,
    config: AichestraCheckCommandConfig,
) -> Result<CheckCommand, CliError> {
    let name = config
        .name
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("check-{}", index + 1));
    let command_line = config
        .command
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            CliError::Usage(format!(
                "checks.commands[{}].command must not be empty",
                index
            ))
        })?;
    let mut command = parse_check_command(&name, &command_line)?;
    command.required = config.required.unwrap_or(true);
    command.timeout_ms = check_timeout_ms(index, &name, config.timeout_ms, config.timeout_seconds)?;
    command.env = check_env(index, &name, config.env)?;
    Ok(command)
}

fn check_timeout_ms(
    index: usize,
    name: &str,
    timeout_ms: Option<u64>,
    timeout_seconds: Option<u64>,
) -> Result<Option<u64>, CliError> {
    match (timeout_ms, timeout_seconds) {
        (Some(_), Some(_)) => Err(CliError::Usage(format!(
            "checks.commands[{index}] '{name}' must use only one of timeout_ms or timeout_seconds"
        ))),
        (Some(0), None) | (None, Some(0)) => Err(CliError::Usage(format!(
            "checks.commands[{index}] '{name}' timeout must be greater than zero"
        ))),
        (Some(value), None) => Ok(Some(value)),
        (None, Some(value)) => value.checked_mul(1_000).map(Some).ok_or_else(|| {
            CliError::Usage(format!(
                "checks.commands[{index}] '{name}' timeout_seconds is too large"
            ))
        }),
        (None, None) => Ok(None),
    }
}

fn check_env(
    index: usize,
    name: &str,
    env: Option<std::collections::HashMap<String, String>>,
) -> Result<Vec<(String, String)>, CliError> {
    let mut env: Vec<(String, String)> = env
        .unwrap_or_default()
        .into_iter()
        .map(|(key, value)| (key.trim().to_string(), value))
        .collect();
    env.sort_by(|left, right| left.0.cmp(&right.0));

    for (key, _) in &env {
        if key.is_empty() || key.contains('=') {
            return Err(CliError::Usage(format!(
                "checks.commands[{index}] '{name}' has invalid env key '{key}'"
            )));
        }
    }

    Ok(env)
}

fn sanitize_artifact_name(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '-'
            }
        })
        .collect();

    if sanitized.is_empty() {
        "check".to_string()
    } else {
        sanitized
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn parses_structured_check_config_required_timeout_and_env() {
        let config_path = temp_config_path("checks-structured");
        fs::write(
            &config_path,
            r#"
checks:
  commands:
    - name: advisory
      command: reviewer --flag "two words"
      required: false
      timeout_seconds: 2
      env:
        AICH_CHECK_MODE: advisory
        Z_FLAG: zed
"#,
        )
        .expect("write config");

        let commands = check_commands_from_config(&config_path).expect("parse checks");

        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].name, "advisory");
        assert_eq!(commands[0].program, "reviewer");
        assert_eq!(commands[0].args, vec!["--flag", "two words"]);
        assert!(!commands[0].required);
        assert_eq!(commands[0].timeout_ms, Some(2_000));
        assert_eq!(
            commands[0].env,
            vec![
                ("AICH_CHECK_MODE".to_string(), "advisory".to_string()),
                ("Z_FLAG".to_string(), "zed".to_string())
            ]
        );

        let _ = fs::remove_file(config_path);
    }

    #[test]
    fn rejects_ambiguous_check_timeout_config() {
        let config_path = temp_config_path("checks-timeout-conflict");
        fs::write(
            &config_path,
            r#"
checks:
  commands:
    - name: test
      command: cargo test --all
      timeout_ms: 100
      timeout_seconds: 1
"#,
        )
        .expect("write config");

        let err = check_commands_from_config(&config_path).unwrap_err();
        assert!(matches!(err, CliError::Usage(message) if message.contains("only one")));

        let _ = fs::remove_file(config_path);
    }

    fn temp_config_path(name: &str) -> std::path::PathBuf {
        let millis = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_millis();
        std::env::temp_dir().join(format!("{name}-{}-{millis}.yaml", std::process::id()))
    }
}
