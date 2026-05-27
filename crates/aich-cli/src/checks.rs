use std::fs;
use std::path::Path;

use aich_core::clock::now_millis;
use aich_core::{CheckResult, CheckResultStatus};
use aich_git::{CheckCommand, PreflightCheckOutput};
use aich_ledger::Ledger;

use crate::command_line::{parse_check_command, strip_yaml_scalar};
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
    let config = fs::read_to_string(config_path)?;
    let mut commands = Vec::new();
    let mut in_checks = false;
    let mut in_commands = false;
    let mut current_name: Option<String> = None;

    for line in config.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if !line.starts_with(' ') && trimmed.ends_with(':') {
            in_checks = trimmed == "checks:";
            in_commands = false;
            current_name = None;
            continue;
        }

        if !in_checks {
            continue;
        }

        if trimmed == "commands:" {
            in_commands = true;
            continue;
        }

        if !in_commands {
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("- name:") {
            current_name = Some(strip_yaml_scalar(value));
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("name:") {
            current_name = Some(strip_yaml_scalar(value));
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("command:") {
            let command_line = strip_yaml_scalar(value);
            let name = current_name
                .take()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| format!("check-{}", commands.len() + 1));
            commands.push(parse_check_command(&name, &command_line)?);
        }
    }

    if commands.is_empty() {
        commands.push(CheckCommand {
            name: "test".to_string(),
            program: "cargo".to_string(),
            args: vec!["test".to_string(), "--all".to_string()],
        });
    }

    Ok(commands)
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
