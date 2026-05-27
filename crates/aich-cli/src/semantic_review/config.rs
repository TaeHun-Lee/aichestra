use std::fs;
use std::path::Path;

use aich_core::SemanticRiskLevel;

use crate::command_line::{parse_process_command, strip_yaml_scalar, ProcessCommandSpec};
use crate::CliError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) enum SemanticReviewAdapterKind {
    Local,
    Command,
    Llm,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct SemanticReviewAdapterConfig {
    pub(super) kind: SemanticReviewAdapterKind,
    pub(super) provider: Option<String>,
    pub(super) reviewer_id: Option<String>,
    pub(super) model: Option<String>,
    pub(super) profile: Option<String>,
    pub(super) command: Option<ProcessCommandSpec>,
}

pub(super) fn semantic_review_adapter_config_from_config(
    config_path: &Path,
) -> Result<SemanticReviewAdapterConfig, CliError> {
    let config = fs::read_to_string(config_path)?;
    let mut in_semantic_review = false;
    let mut kind: Option<SemanticReviewAdapterKind> = None;
    let mut legacy_provider: Option<String> = None;
    let mut reviewer_id: Option<String> = None;
    let mut model: Option<String> = None;
    let mut profile: Option<String> = None;
    let mut command_line: Option<String> = None;

    for line in config.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if !line.starts_with(' ') && trimmed.ends_with(':') {
            in_semantic_review = trimmed == "semantic_review:";
            continue;
        }

        if !in_semantic_review {
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("adapter:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                kind = Some(parse_semantic_review_adapter_kind(&value)?);
            }
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("reviewer_provider:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                legacy_provider = Some(value);
            }
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("reviewer_id:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                reviewer_id = Some(value);
            }
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("model:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                model = Some(value);
            }
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("profile:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                profile = Some(value);
            }
            continue;
        }

        if let Some(value) = trimmed.strip_prefix("command:") {
            let value = strip_yaml_scalar(value);
            if !value.trim().is_empty() {
                command_line = Some(value);
            }
        }
    }

    let kind = kind.unwrap_or_else(|| {
        if legacy_provider.as_deref() == Some("command") {
            SemanticReviewAdapterKind::Command
        } else {
            SemanticReviewAdapterKind::Local
        }
    });
    let command = command_line
        .as_deref()
        .map(|line| parse_process_command("semantic_review.command", line))
        .transpose()?;

    Ok(SemanticReviewAdapterConfig {
        kind,
        provider: legacy_provider,
        reviewer_id,
        model,
        profile,
        command,
    })
}

fn parse_semantic_review_adapter_kind(value: &str) -> Result<SemanticReviewAdapterKind, CliError> {
    match value.trim() {
        "local" => Ok(SemanticReviewAdapterKind::Local),
        "command" => Ok(SemanticReviewAdapterKind::Command),
        "llm" => Ok(SemanticReviewAdapterKind::Llm),
        other => Err(CliError::Usage(format!(
            "semantic_review.adapter must be 'local', 'command', or 'llm', got '{other}'"
        ))),
    }
}

pub(super) fn llm_semantic_review_command_from_config(
    config: &SemanticReviewAdapterConfig,
) -> Result<ProcessCommandSpec, CliError> {
    if let Some(command) = config.command.clone() {
        return Ok(command);
    }

    let provider = config.provider.as_deref().unwrap_or("codex");
    match provider {
        "codex" => Ok(codex_semantic_review_command(
            config.model.as_deref(),
            config.profile.as_deref(),
        )),
        "custom" => Err(CliError::Usage(
            "semantic_review.command must be configured when semantic_review.adapter is llm and reviewer_provider is custom"
                .to_string(),
        )),
        other => Err(CliError::Usage(format!(
            "semantic_review.reviewer_provider '{other}' is not supported by the built-in LLM adapter; configure semantic_review.command or use adapter: command"
        ))),
    }
}

pub(crate) fn codex_semantic_review_command(
    model: Option<&str>,
    profile: Option<&str>,
) -> ProcessCommandSpec {
    let mut args = vec![
        "--ask-for-approval".to_string(),
        "never".to_string(),
        "exec".to_string(),
        "--sandbox".to_string(),
        "read-only".to_string(),
        "--skip-git-repo-check".to_string(),
        "--ephemeral".to_string(),
        "--color".to_string(),
        "never".to_string(),
    ];

    if let Some(model) = model.filter(|value| !value.trim().is_empty()) {
        args.push("--model".to_string());
        args.push(model.to_string());
    }

    if let Some(profile) = profile.filter(|value| !value.trim().is_empty()) {
        args.push("--profile".to_string());
        args.push(profile.to_string());
    }

    args.push("-".to_string());

    ProcessCommandSpec {
        program: "codex".to_string(),
        args,
    }
}

pub(super) fn semantic_review_prompt_path_from_config(config_path: &Path) -> String {
    let Ok(config) = fs::read_to_string(config_path) else {
        return ".aichestra/prompts/semantic-merge-review.md".to_string();
    };
    let mut in_semantic_review = false;

    for line in config.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if !line.starts_with(' ') && trimmed.ends_with(':') {
            in_semantic_review = trimmed == "semantic_review:";
            continue;
        }

        if in_semantic_review {
            if let Some(value) = trimmed.strip_prefix("prompt_path:") {
                let prompt_path = strip_yaml_scalar(value);
                if !prompt_path.trim().is_empty() {
                    return prompt_path;
                }
            }
        }
    }

    ".aichestra/prompts/semantic-merge-review.md".to_string()
}

pub(super) fn semantic_block_levels_from_config(
    config_path: &Path,
) -> Result<Vec<SemanticRiskLevel>, CliError> {
    let config = fs::read_to_string(config_path)?;
    let mut block_levels = Vec::new();
    let mut in_semantic_review = false;
    let mut in_block_levels = false;

    for line in config.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if !line.starts_with(' ') && trimmed.ends_with(':') {
            in_semantic_review = trimmed == "semantic_review:";
            in_block_levels = false;
            continue;
        }

        if !in_semantic_review {
            continue;
        }

        if trimmed == "risk_block_levels:" {
            in_block_levels = true;
            continue;
        }

        if in_block_levels {
            if let Some(value) = trimmed.strip_prefix('-') {
                block_levels.push(
                    SemanticRiskLevel::parse(strip_yaml_scalar(value).as_str())
                        .map_err(CliError::Usage)?,
                );
            } else if !line.starts_with("    ") {
                in_block_levels = false;
            }
        }
    }

    if block_levels.is_empty() {
        block_levels.push(SemanticRiskLevel::Blocked);
    }

    Ok(block_levels)
}
